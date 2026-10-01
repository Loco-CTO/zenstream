import type { SyncplayPresenceReport } from "./syncplay";

export type SyncplayPresenceDelivery = "acknowledged" | "superseded";
export type ReliablePresenceReport = SyncplayPresenceReport & {
	operationId: string;
};
type Submission = {
	report: ReliablePresenceReport;
	controller: AbortController;
	result: Promise<SyncplayPresenceDelivery>;
	resolve: (value: SyncplayPresenceDelivery) => void;
	reject: (error: unknown) => void;
};

export const syncplayRetryDelay = (attempt: number) =>
	Math.min(10_000, 500 * 2 ** Math.min(attempt, 5));

export class SyncplayPresenceQueue {
	private pending: Submission | null = null;
	private lifecycle: Submission[] = [];
	private current: Submission | null = null;
	private worker: Promise<void> | null = null;
	private generation = 0;
	private stopped = false;
	private wake: (() => void) | null = null;
	constructor(
		private handlers: {
			isCurrent: (report: ReliablePresenceReport) => boolean;
			send: (
				report: ReliablePresenceReport,
				signal: AbortSignal,
			) => Promise<boolean>;
			isRetryable: (error: unknown) => boolean;
			failed: (
				report: ReliablePresenceReport,
				error: unknown,
				retrying: boolean,
			) => void;
		} = {
			isCurrent: () => false,
			send: async () => false,
			isRetryable: () => false,
			failed: () => undefined,
		},
	) {}
	setHandlers(handlers: typeof this.handlers) {
		this.handlers = handlers;
	}
	private sameIntent(a: ReliablePresenceReport, b: ReliablePresenceReport) {
		return (
			a.groupId === b.groupId &&
			a.itemId === b.itemId &&
			a.generation === b.generation &&
			a.timelineRevision === b.timelineRevision &&
			a.viewing === b.viewing &&
			a.loading === b.loading
		);
	}
	enqueue(report: ReliablePresenceReport): Promise<SyncplayPresenceDelivery> {
		if (this.stopped || !this.handlers.isCurrent(report))
			return Promise.resolve("superseded");
		const existing = this.pending ?? this.lifecycle.at(-1) ?? this.current;
		if (existing && this.sameIntent(existing.report, report))
			return existing.result;
		let resolve!: Submission["resolve"];
		let reject!: Submission["reject"];
		const result = new Promise<SyncplayPresenceDelivery>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		const next = {
			report,
			result,
			resolve,
			reject,
			controller: new AbortController(),
		};
		if (this.pending) this.supersede(this.pending);
		this.pending = null;
		if (this.current?.report.viewing) this.supersede(this.current);
		if (!report.viewing) this.lifecycle.push(next);
		else this.pending = next;
		if (!this.current || this.current.controller.signal.aborted) this.wake?.();
		this.start();
		return result;
	}
	private supersede(submission: Submission) {
		submission.controller.abort();
		submission.resolve("superseded");
	}
	private start() {
		if (this.worker || this.stopped) return;
		const generation = this.generation;
		const worker = this.drain(generation).finally(() => {
			if (this.worker !== worker) return;
			this.worker = null;
			if (this.lifecycle.length || this.pending) this.start();
		});
		this.worker = worker;
	}
	private async drain(generation: number) {
		// Yield before dispatch so multiple reports from one React commit coalesce.
		await Promise.resolve();
		while (!this.stopped && generation === this.generation) {
			const next = this.lifecycle.shift() ?? this.pending;
			if (!next) break;
			if (next === this.pending) this.pending = null;
			this.current = next;
			let attempt = 0;
			while (
				!this.stopped &&
				generation === this.generation &&
				!next.controller.signal.aborted &&
				this.handlers.isCurrent(next.report)
			) {
				try {
					const acknowledged = await this.handlers.send(
						next.report,
						next.controller.signal,
					);
					if (!next.controller.signal.aborted && generation === this.generation) {
						next.resolve(acknowledged ? "acknowledged" : "superseded");
					}
					break;
				} catch (error) {
					if (next.controller.signal.aborted || generation !== this.generation)
						break;
					const retrying = this.handlers.isRetryable(error);
					this.handlers.failed(next.report, error, retrying);
					if (!retrying) {
						next.reject(error);
						break;
					}
					await new Promise<void>((resolve) => {
						const finish = () => {
							clearTimeout(timer);
							if (this.wake === finish) this.wake = null;
							resolve();
						};
						const timer = setTimeout(finish, syncplayRetryDelay(attempt++));
						this.wake = finish;
					});
				}
			}
			next.resolve("superseded");
			if (this.current === next) this.current = null;
		}
	}
	clear() {
		this.generation += 1;
		if (this.current) this.supersede(this.current);
		if (this.pending) this.supersede(this.pending);
		for (const report of this.lifecycle) this.supersede(report);
		this.current = this.pending = null;
		this.lifecycle = [];
		this.worker = null;
		this.wake?.();
	}
	resume() {
		this.stopped = false;
	}
	stop() {
		this.stopped = true;
		this.clear();
	}
}
