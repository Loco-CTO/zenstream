import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	SyncplayPresenceQueue,
	syncplayRetryDelay,
	type ReliablePresenceReport,
} from "@/lib/syncplay-presence";

const report = (
	sequence = 1,
	viewing = true,
	loading = false,
): ReliablePresenceReport => ({
	groupId: "room",
	itemId: "movie",
	generation: 1,
	timelineRevision: 4,
	sequence,
	operationId: `operation-${sequence}`,
	viewing,
	loading,
});

describe("reliable SyncPlay presence", () => {
	const queues: SyncplayPresenceQueue[] = [];
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		for (const queue of queues) queue.stop();
		queues.length = 0;
		vi.useRealTimers();
	});
	function queue(
		send: (
			value: ReliablePresenceReport,
			signal: AbortSignal,
		) => Promise<boolean>,
		isCurrent = () => true,
	) {
		const instance = new SyncplayPresenceQueue({
			send,
			isCurrent,
			isRetryable: () => true,
			failed: vi.fn(),
		});
		queues.push(instance);
		return instance;
	}
	it("retries the same report after a transient readiness failure", async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Network changed"))
			.mockResolvedValue(true);
		const instance = queue(send);
		const result = instance.enqueue(report());
		await vi.advanceTimersByTimeAsync(0);
		expect(send).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(500);
		expect(await result).toBe("acknowledged");
		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls[1][0]).toEqual(send.mock.calls[0][0]);
	});
	it("does not duplicate an operation when its accepted response is lost", async () => {
		const operations = new Set<string>();
		const send = vi.fn(async (value: ReliablePresenceReport) => {
			operations.add(value.operationId);
			if (send.mock.calls.length === 1) throw new TypeError("Response lost");
			return true;
		});
		const result = queue(send).enqueue(report());
		await vi.advanceTimersByTimeAsync(500);
		expect(await result).toBe("acknowledged");
		expect(send).toHaveBeenCalledTimes(2);
		expect(operations.size).toBe(1);
	});
	it("shares a pending delivery instead of assigning it another operation", async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error("Offline"))
			.mockResolvedValue(true);
		const instance = queue(send);
		const first = instance.enqueue(report());
		await vi.advanceTimersByTimeAsync(0);
		const second = instance.enqueue(report(2));
		expect(second).toBe(first);
		await vi.advanceTimersByTimeAsync(500);
		expect(await second).toBe("acknowledged");
		expect(send.mock.calls[1][0].operationId).toBe("operation-1");
	});
	it("preserves a lifecycle release before the latest ready report", async () => {
		const send = vi
			.fn()
			.mockRejectedValueOnce(new Error("Offline"))
			.mockResolvedValue(true);
		const instance = queue(send);
		const release = instance.enqueue(report(1, false));
		await vi.advanceTimersByTimeAsync(0);
		const obsolete = instance.enqueue(report(2, true, true));
		const ready = instance.enqueue(report(3));
		expect(await obsolete).toBe("superseded");
		await vi.advanceTimersByTimeAsync(500);
		expect(await release).toBe("acknowledged");
		expect(await ready).toBe("acknowledged");
		expect(send.mock.calls.map(([value]) => value.viewing)).toEqual([
			false,
			false,
			true,
		]);
	});
	it("drops a ready report when its timeline changes during backoff", async () => {
		let current = true;
		const send = vi.fn().mockRejectedValue(new Error("Offline"));
		const instance = queue(send, () => current);
		const result = instance.enqueue(report());
		await vi.advanceTimersByTimeAsync(0);
		current = false;
		await vi.advanceTimersByTimeAsync(500);
		expect(await result).toBe("superseded");
		expect(send).toHaveBeenCalledTimes(1);
	});
	it("stops retries and settles outstanding reports on disposal", async () => {
		const send = vi.fn().mockRejectedValue(new Error("Offline"));
		const instance = queue(send);
		const result = instance.enqueue(report());
		await vi.advanceTimersByTimeAsync(0);
		instance.stop();
		await vi.advanceTimersByTimeAsync(30_000);
		expect(await result).toBe("superseded");
		expect(send).toHaveBeenCalledTimes(1);
		expect(vi.getTimerCount()).toBe(0);
	});
	it("caps backoff without exhausting the recovery attempts", () => {
		expect(
			Array.from({ length: 8 }, (_, value) => syncplayRetryDelay(value)),
		).toEqual([500, 1000, 2000, 4000, 8000, 10_000, 10_000, 10_000]);
	});
});
