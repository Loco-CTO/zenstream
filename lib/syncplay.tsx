"use client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { orchestratorBaseUrl } from "@/lib/authenticated-request";
import {
	SyncplayPresenceQueue,
	syncplayRetryDelay,
	type SyncplayPresenceDelivery,
} from "./syncplay-presence";
type Socket = SyncplaySocket;
type SyncplayEvent = unknown;
const SYNCPLAY_RECONNECT_INITIAL_MS = 500;
const SYNCPLAY_RECONNECT_MAX_MS = 30_000;
class SyncplaySocket {
	private ws: WebSocket | null = null;
	private connecting: Promise<void> | null = null;
	private connectGeneration = 0;
	private ticketController: AbortController | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private reconnectDisabled = false;
	private openingTimer: ReturnType<typeof setTimeout> | null = null;
	private livenessTimer: ReturnType<typeof setInterval> | null = null;
	private lastClockReplyAt = 0;
	private clockReply: {
		sent: number;
		callback?: (value: unknown) => void;
	} | null = null;
	private listeners = new Map<string, ((value?: SyncplayEvent) => void)[]>();
	id = "syncplay";
	constructor(
		private readonly url: string,
		private readonly auth: { session: AuthSession; participantId: string },
	) {}
	updateSession(session: AuthSession) {
		this.auth.session = session;
	}
	on<T = SyncplayEvent>(event: string, listener: (value: T) => void) {
		this.listeners.set(event, [
			...(this.listeners.get(event) ?? []),
			listener as unknown as (value?: SyncplayEvent) => void,
		]);
		return this;
	}
	private fire(event: string, value?: SyncplayEvent) {
		for (const listener of this.listeners.get(event) ?? []) listener(value);
	}
	private async open(generation: number, controller: AbortController) {
		let ticket: string;
		try {
			ticket = await syncplayRequest(async (signal) => {
				const response = await authenticatedFetch(
					this.auth.session,
					"/api/auth/socket-ticket",
					{ method: "POST", signal },
				);
				signal.throwIfAborted();
				if (!response.ok)
					throw new SyncplayRequestError(
						"Socket ticket request failed",
						response.status,
					);
				return String((await response.json()).ticket ?? "");
			}, controller.signal);
			if (!ticket) throw new Error("Socket ticket was empty");
		} catch (error) {
			if (generation === this.connectGeneration && !controller.signal.aborted)
				this.fire("connect_error", error as Error);
			return;
		} finally {
			if (this.ticketController === controller) this.ticketController = null;
		}
		if (generation !== this.connectGeneration) return;
		let ws: WebSocket;
		try {
			ws = new WebSocket(
				`${this.url}?ticket=${encodeURIComponent(ticket)}&participantId=${encodeURIComponent(this.auth.participantId)}`,
			);
		} catch (error) {
			if (generation === this.connectGeneration)
				this.fire("connect_error", error as Error);
			return;
		}
		if (generation !== this.connectGeneration) {
			ws.close();
			return;
		}
		this.ws = ws;
		const isCurrent = () =>
			this.connectGeneration === generation && this.ws === ws;
		const abandon = (reason: string) => {
			if (!isCurrent()) return;
			this.ws = null;
			this.connectGeneration += 1;
			this.clearSocketTimers();
			ws.close();
			this.fire("disconnect", reason);
			this.scheduleReconnect();
		};
		this.openingTimer = setTimeout(() => abandon("opening timeout"), 10_000);
		ws.onopen = () => {
			if (isCurrent()) {
				this.clearSocketTimers();
				this.lastClockReplyAt = Date.now();
				this.livenessTimer = setInterval(() => {
					if (Date.now() - this.lastClockReplyAt >= 90_000) abandon("clock timeout");
				}, 30_000);
				this.reconnectAttempt = 0;
				this.fire("connect");
			}
		};
		ws.onclose = (event) => {
			if (!isCurrent()) return;
			this.ws = null;
			this.clearSocketTimers();
			this.fire("disconnect", event.reason);
			this.scheduleReconnect();
		};
		ws.onerror = () => {
			if (isCurrent())
				this.fire("connect_error", new Error("WebSocket connection failed"));
		};
		ws.onmessage = (event) => {
			if (!isCurrent()) return;
			let message;
			try {
				message = JSON.parse(event.data);
			} catch {
				return;
			}
			if (!message || typeof message !== "object") return;
			if (message.type === "groups") this.fire("syncplay:groups", message);
			else if (message.type === "group") this.fire("syncplay:group", message);
			else if (message.type === "group-ended")
				this.fire("syncplay:group-ended", message);
			else if (message.type === "participant-replaced")
				this.fire("syncplay:participant-replaced", message);
			else if (
				message.type === "clock" &&
				this.clockReply &&
				Number.isFinite(message.serverReceivedAt) &&
				Number.isFinite(message.serverSentAt) &&
				this.clockReply?.sent === message.clientSentAt
			) {
				this.lastClockReplyAt = Date.now();
				const callback = this.clockReply.callback;
				this.clockReply = null;
				callback?.(message);
			}
		};
	}
	private scheduleReconnect() {
		if (this.reconnectDisabled || this.ws || this.reconnectTimer !== null) return;
		const delay = Math.min(
			SYNCPLAY_RECONNECT_MAX_MS,
			SYNCPLAY_RECONNECT_INITIAL_MS * 2 ** this.reconnectAttempt,
		);
		this.reconnectAttempt = Math.min(this.reconnectAttempt + 1, 16);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.connect();
		}, delay);
	}
	async connect() {
		this.reconnectDisabled = false;
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING)
		)
			return;
		if (this.connecting) return this.connecting;
		const generation = ++this.connectGeneration;
		const controller = new AbortController();
		this.ticketController = controller;
		const pending = this.open(generation, controller).finally(() => {
			if (this.connecting === pending) this.connecting = null;
			if (
				!this.ws &&
				!this.reconnectDisabled &&
				generation === this.connectGeneration
			)
				this.scheduleReconnect();
		});
		this.connecting = pending;
		return pending;
	}
	emit<T = SyncplayEvent>(
		event: string,
		payload: Record<string, unknown>,
		callback?: (value: T) => void,
	) {
		if (event === "syncplay:clock") {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
			this.clockReply = {
				sent: Number(payload.clientSentAt),
				callback: callback as ((value: unknown) => void) | undefined,
			};
			this.ws.send(JSON.stringify({ type: "clock", ...payload }));
		}
	}
	private clearSocketTimers() {
		if (this.openingTimer !== null) clearTimeout(this.openingTimer);
		if (this.livenessTimer !== null) clearInterval(this.livenessTimer);
		this.openingTimer = this.livenessTimer = null;
		this.clockReply = null;
	}
	disconnect() {
		this.reconnectDisabled = true;
		this.connectGeneration += 1;
		this.ticketController?.abort();
		this.ticketController = null;
		if (this.reconnectTimer !== null) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.connecting = null;
		this.clearSocketTimers();
		const ws = this.ws;
		this.ws = null;
		ws?.close();
	}
}
function normalizeSyncplayOrigin(origin: string) {
	const websocketProtocol = location.protocol === "https:" ? "wss:" : "ws:";
	return `${origin.replace(/^https?:/, websocketProtocol).replace(/\/+$/, "")}/api/ws/syncplay`;
}
const io = (
	origin: string,
	options: {
		auth: { session: AuthSession; participantId: string };
		path?: string;
		autoConnect?: boolean;
	},
) => new SyncplaySocket(normalizeSyncplayOrigin(origin), options.auth);
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { getItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { authenticatedFetch } from "@/lib/authenticated-request";

export type SyncplayGroup = {
	id: string;
	name: string;
	hostUserId: string;
	hostName: string;
	allowViewerControls: boolean;
	itemId: string | null;
	position: number;
	playing: boolean;
	resumeWhenReady: boolean;
	revision: number;
	mediaGeneration?: number;
	groupRevision?: number;
	timelineRevision?: number;
	anchorPosition?: number;
	anchorServerTime?: number;
	effectiveAt?: number;
	playbackState?: "playing" | "paused";
	pauseReason?: string | null;
	hostDisconnectedAt?: number | null;
	updatedAt: number;
	members: {
		userId: string;
		participantId?: string;
		username: string;
		watchingTogether?: boolean;
		viewing: boolean;
		loading: boolean;
		readyGeneration?: number;
		role: "host" | "viewer";
	}[];
};
export type SyncplayPresenceReport = {
	groupId: string;
	itemId: string | null;
	viewing: boolean;
	loading: boolean;
	generation: number;
	timelineRevision: number;
	sequence: number;
};

export function syncplayPresenceReportIsCurrent(
	report: Pick<
		SyncplayPresenceReport,
		"groupId" | "itemId" | "generation" | "timelineRevision"
	>,
	active: SyncplayGroup | null,
): boolean {
	return Boolean(
		active &&
		report.groupId === active.id &&
		report.itemId === active.itemId &&
		report.generation === (active.mediaGeneration ?? 0) &&
		report.timelineRevision === (active.timelineRevision ?? active.revision),
	);
}
type Command = {
	action: string;
	itemId?: string;
	position: number;
	playing: boolean;
};
type Context = {
	groups: SyncplayGroup[];
	active: SyncplayGroup | null;
	currentMember: SyncplayGroup["members"][number] | null;
	recoveryEpoch: number;
	create: () => Promise<void>;
	join: (id: string) => Promise<SyncplayGroup | undefined>;
	leave: () => Promise<void>;
	refresh: () => Promise<void>;
	setControls: (value: boolean) => Promise<void>;
	removeMember: (userId: string) => Promise<void>;
	setWatchingTogether: (value: boolean) => Promise<void>;
	command: (value: Command) => Promise<void>;
	presence: (
		viewing: boolean,
		loading: boolean,
		mediaGeneration?: number,
		timelineRevision?: number,
	) => Promise<SyncplayPresenceDelivery>;
	canControl: boolean;
	serverNow: () => number;
};
const emptyContext: Context = {
	groups: [],
	active: null,
	currentMember: null,
	recoveryEpoch: 0,
	create: async () => undefined,
	join: async () => undefined,
	leave: async () => undefined,
	refresh: async () => undefined,
	setControls: async () => undefined,
	removeMember: async () => undefined,
	setWatchingTogether: async () => undefined,
	command: async () => undefined,
	presence: async () => "superseded",
	canControl: false,
	serverNow: () => Date.now() / 1000,
};
const SyncplayContext = createContext<Context>(emptyContext);
const SYNCPLAY_REQUEST_TIMEOUT_MS = 8_000;
const SYNCPLAY_PARTICIPANT_KEY = "zenstream-syncplay-tab-id";
const SYNCPLAY_PRESENCE_SEQUENCE_KEY = "zenstream-syncplay-presence-sequence";
let memoryParticipantId: string | null = null;
function participantId() {
	if (typeof window === "undefined") return "server";
	try {
		const stored = window.sessionStorage.getItem(SYNCPLAY_PARTICIPANT_KEY);
		if (stored) return stored;
	} catch {
		/* fall through to memory */
	}
	if (memoryParticipantId) return memoryParticipantId;
	const generated =
		globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
	memoryParticipantId = generated;
	try {
		window.sessionStorage.setItem(SYNCPLAY_PARTICIPANT_KEY, generated);
	} catch {
		/* private mode */
	}
	return generated;
}
function presenceSequenceKey(participant: string) {
	return `${SYNCPLAY_PRESENCE_SEQUENCE_KEY}:${participant}`;
}
function readPresenceSequence(participant: string) {
	try {
		const value = Number(
			window.sessionStorage.getItem(presenceSequenceKey(participant)),
		);
		return Number.isSafeInteger(value) && value >= 0 ? value : 0;
	} catch {
		return 0;
	}
}
function writePresenceSequence(participant: string, sequence: number) {
	try {
		window.sessionStorage.setItem(
			presenceSequenceKey(participant),
			String(sequence),
		);
	} catch {
		/* private mode or unavailable storage */
	}
}
function isCurrentParticipant(
	member: { participantId?: string; userId?: string },
	currentParticipantId: string,
	currentUserId: string,
) {
	if (member.participantId) {
		return member.participantId === currentParticipantId;
	}
	return Boolean(member.userId) && member.userId === currentUserId;
}
const syncplayDebug = (event: string, details?: unknown) => {
	if (typeof window === "undefined") return;
	console.debug(`[Syncplay] ${event}`, details ?? "");
};
class SyncplayRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly group?: SyncplayGroup,
	) {
		super(message);
	}
}
function isTerminalSyncplayError(
	error: unknown,
): error is SyncplayRequestError {
	return (
		error instanceof SyncplayRequestError &&
		(error.status === 404 ||
			error.status === 410 ||
			(error.status === 403 && error.message === "Join this group first."))
	);
}
function isRetryableSyncplayError(error: unknown): boolean {
	return (
		!(error instanceof SyncplayRequestError) ||
		error.status === 429 ||
		error.status >= 500
	);
}
async function syncplayRequest<T>(
	request: (signal: AbortSignal) => Promise<T>,
	parent?: AbortSignal,
): Promise<T> {
	const controller = new AbortController();
	const abort = () => controller.abort(parent?.reason);
	if (parent?.aborted) abort();
	else parent?.addEventListener("abort", abort, { once: true });
	const timer = setTimeout(
		() =>
			controller.abort(
				new DOMException("SyncPlay request timed out", "TimeoutError"),
			),
		SYNCPLAY_REQUEST_TIMEOUT_MS,
	);
	let abortListener: () => void = () => undefined;
	try {
		controller.signal.throwIfAborted();
		return await Promise.race([
			request(controller.signal),
			new Promise<never>((_, reject) => {
				abortListener = () => reject(controller.signal.reason);
				controller.signal.addEventListener("abort", abortListener, { once: true });
			}),
		]);
	} finally {
		clearTimeout(timer);
		parent?.removeEventListener("abort", abort);
		controller.signal.removeEventListener("abort", abortListener);
	}
}
function recoveryPause(delay: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const abort = () => {
			clearTimeout(timer);
			reject(signal.reason);
		};
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", abort);
			resolve();
		}, delay);
		if (signal.aborted) abort();
		else signal.addEventListener("abort", abort, { once: true });
	});
}
async function call(
	session: AuthSession,
	path: string,
	method = "GET",
	body?: unknown,
	signal?: AbortSignal,
) {
	const started = performance.now();
	syncplayDebug("HTTP request", { path, method, body });
	return syncplayRequest(async (requestSignal) => {
		const response = await authenticatedFetch(session, `/api/syncplay/${path}`, {
			method,
			headers: {
				...(session.username ? { "X-ZenStream-Username": session.username } : {}),
				"X-ZenStream-Participant": participantId(),
			},
			body: body ? JSON.stringify(body) : undefined,
			cache: "no-store",
			signal: requestSignal,
		});
		requestSignal.throwIfAborted();
		syncplayDebug("HTTP response", {
			path,
			method,
			status: response.status,
			elapsedMs: Math.round(performance.now() - started),
		});
		if (!response.ok) {
			const error = await response.json().catch(() => ({}));
			const detail = error.detail ?? error;
			syncplayDebug("HTTP error", {
				path,
				method,
				status: response.status,
				error,
			});
			throw new SyncplayRequestError(
				typeof detail === "string"
					? detail
					: (detail.message ?? "Syncplay request failed."),
				response.status,
				detail.group,
			);
		}
		return response.status === 204 ? null : await response.json();
	}, signal);
}

function operationId() {
	return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function SyncplayProvider({
	session,
	children,
}: {
	session: AuthSession;
	children: ReactNode;
}) {
	return (
		<SyncplaySessionProvider
			key={`${orchestratorBaseUrl()}:${session.userId}`}
			session={session}
		>
			{children}
		</SyncplaySessionProvider>
	);
}

function SyncplaySessionProvider({
	session,
	children,
}: {
	session: AuthSession;
	children: ReactNode;
}) {
	const { t } = useI18n();
	const toast = useToast();
	const [groups, setGroups] = useState<SyncplayGroup[]>([]);
	const [active, setActive] = useState<SyncplayGroup | null>(null);
	const [recoveryEpoch, setRecoveryEpoch] = useState(0);
	const sessionRef = useRef(session);
	const recoveryControllerRef = useRef<AbortController | null>(null);
	const recoveryJobRef = useRef<Promise<void> | null>(null);
	const requestRecoveryRef = useRef<() => void>(() => undefined);
	const activeRef = useRef<SyncplayGroup | null>(null);
	const socketRef = useRef<Socket | null>(null);
	const commandChainRef = useRef(Promise.resolve());
	const latestSeekRef = useRef(0);
	const lastPresenceRef = useRef<SyncplayPresenceReport | null>(null);
	const replayPresenceRef = useRef<
		() => Promise<SyncplayPresenceDelivery | undefined>
	>(async () => undefined);
	const revisionRef = useRef(new Map<string, number>());
	const tombstonesRef = useRef(new Map<string, number>());
	const leftGroupsRef = useRef(new Set<string>());
	const membershipGenerationRef = useRef(0);
	const clockOffsetRef = useRef(0);
	const bestRttRef = useRef(Infinity);
	const hydratedRef = useRef(false);
	const titleCache = useRef(new Map<string, string>());
	const announcedMediaGenerationRef = useRef<string | null>(null);
	const announcementItemRef = useRef<string | null>(null);
	const notificationKeysRef = useRef(new Set<string>());
	const controlsUpdateRef = useRef<{
		groupId: string;
		value: boolean;
		promise: Promise<void>;
	} | null>(null);
	const membershipActionRef = useRef(false);
	const socketHandlersRef = useRef<{
		adopt: (group: SyncplayGroup, announceNewMedia?: boolean) => void;
		setCurrent: (group: SyncplayGroup | null) => void;
		t: ReturnType<typeof useI18n>["t"];
		toast: ReturnType<typeof useToast>;
	} | null>(null);
	const [currentParticipantId] = useState(participantId);
	const socketOrigin = orchestratorBaseUrl();
	const presenceSequenceRef = useRef(readPresenceSequence(currentParticipantId));
	const serverNow = useCallback(
		() => Date.now() / 1000 + clockOffsetRef.current,
		[],
	);
	useEffect(() => {
		sessionRef.current = session;
		socketRef.current?.updateSession(session);
	}, [session]);
	const [presenceQueue] = useState(() => new SyncplayPresenceQueue());

	const setCurrent = useCallback(
		(group: SyncplayGroup | null) => {
			syncplayDebug(
				"active group changed",
				group && {
					id: group.id,
					itemId: group.itemId,
					playing: group.playing,
					playbackState: group.playbackState,
					resumeWhenReady: group.resumeWhenReady,
					revision: group.revision,
					mediaGeneration: group.mediaGeneration,
					members: group.members,
				},
			);
			if (group) revisionRef.current.set(group.id, group.revision);
			if (activeRef.current && activeRef.current.id !== group?.id) {
				membershipGenerationRef.current += 1;
				presenceQueue.clear();
				recoveryControllerRef.current?.abort();
			}
			if (!group) lastPresenceRef.current = null;
			activeRef.current = group;
			setActive(group);
		},
		[presenceQueue],
	);
	const clearStaleGroup = useCallback(
		(groupId: string, expectedRevision?: number) => {
			const current = activeRef.current;
			if (
				!current ||
				current.id !== groupId ||
				(expectedRevision != null && current.revision !== expectedRevision)
			)
				return;
			tombstonesRef.current.set(groupId, Number.MAX_SAFE_INTEGER);
			latestSeekRef.current += 1;
			presenceSequenceRef.current += 1;
			writePresenceSequence(currentParticipantId, presenceSequenceRef.current);
			lastPresenceRef.current = null;
			presenceQueue.clear();
			if (controlsUpdateRef.current?.groupId === groupId)
				controlsUpdateRef.current = null;
			setGroups((old) => old.filter((entry) => entry.id !== groupId));
			setCurrent(null);
			syncplayDebug("stale group cleared", { groupId });
		},
		[currentParticipantId, presenceQueue, setCurrent],
	);
	useEffect(() => {
		presenceQueue.setHandlers({
			isCurrent: (report) => {
				const group = activeRef.current;
				const member = group?.members.find((value) =>
					isCurrentParticipant(
						value,
						currentParticipantId,
						sessionRef.current.userId,
					),
				);
				return Boolean(
					group &&
					member &&
					group.id === report.groupId &&
					(!report.viewing ||
						(syncplayPresenceReportIsCurrent(report, group) &&
							member.watchingTogether !== false)),
				);
			},
			send: async (report, signal) => {
				const group = (await call(
					sessionRef.current,
					`groups/${report.groupId}/presence`,
					"POST",
					{
						viewing: report.viewing,
						loading: report.loading,
						mediaGeneration: report.generation,
						timelineRevision: report.timelineRevision,
						presenceSequence: report.sequence,
						operationId: report.operationId,
					},
					signal,
				)) as SyncplayGroup;
				if (
					signal.aborted ||
					activeRef.current?.id !== report.groupId ||
					(report.viewing &&
						!syncplayPresenceReportIsCurrent(report, activeRef.current))
				)
					return false;
				socketHandlersRef.current?.adopt(group);
				const member = group.members.find((value) =>
					isCurrentParticipant(
						value,
						currentParticipantId,
						sessionRef.current.userId,
					),
				);
				const acknowledged = Boolean(
					member &&
					member.viewing === report.viewing &&
					member.loading === report.loading &&
					(!report.viewing ||
						(syncplayPresenceReportIsCurrent(report, group) &&
							syncplayPresenceReportIsCurrent(report, activeRef.current) &&
							(report.loading ||
								member.readyGeneration == null ||
								member.readyGeneration === report.generation))),
				);
				if (!acknowledged) requestRecoveryRef.current();
				return acknowledged;
			},
			isRetryable: isRetryableSyncplayError,
			failed: (report, error, retrying) => {
				syncplayDebug("presence failed", {
					groupId: report.groupId,
					sequence: report.sequence,
					retrying,
					error,
				});
				if (isTerminalSyncplayError(error)) clearStaleGroup(report.groupId);
				else if (retrying) requestRecoveryRef.current();
				else toast.error(t("syncplayPresenceFailed"));
			},
		});
	}, [clearStaleGroup, currentParticipantId, presenceQueue, t, toast]);

	const announceOnce = useCallback((key: string, announce: () => void) => {
		const keys = notificationKeysRef.current;
		if (keys.has(key)) return false;
		keys.add(key);
		if (keys.size > 256) {
			const oldest = keys.values().next().value;
			if (typeof oldest === "string") keys.delete(oldest);
		}
		announce();
		return true;
	}, []);
	const announcePlayback = useCallback(
		(itemId: string, notificationKey: string) => {
			if (!announceOnce(notificationKey, () => undefined)) return;
			announcementItemRef.current = notificationKey;
			const title = titleCache.current.get(itemId);
			if (title) {
				toast.success(t("syncplayNowPlaying", { title }));
				return;
			}
			void getItem(session, itemId)
				.then((item) => {
					titleCache.current.set(itemId, item.Name);
					if (announcementItemRef.current === notificationKey)
						toast.success(t("syncplayNowPlaying", { title: item.Name }));
				})
				.catch(() => {
					if (announcementItemRef.current === notificationKey)
						toast.success(t("syncplayNowPlayingFallback"));
				});
		},
		[announceOnce, session, t, toast],
	);
	const reconcile = useCallback(
		(next: SyncplayGroup | null, eventRevision?: number) => {
			const previous = activeRef.current;
			if (!hydratedRef.current) {
				hydratedRef.current = true;
				setCurrent(next);
				return;
			}
			if (
				previous &&
				next &&
				previous.id === next.id &&
				next.revision <= previous.revision
			)
				return;
			const revision = eventRevision ?? next?.revision ?? previous?.revision ?? -1;
			if (previous && !next)
				announceOnce(`group:${previous.id}:${revision}:ended`, () =>
					toast.success(t("syncplayGroupEnded", { group: previous.name })),
				);
			if (previous && next && previous.id === next.id) {
				if (!previous.hostDisconnectedAt && next.hostDisconnectedAt)
					announceOnce(`group:${next.id}:${next.revision}:host-disconnected`, () =>
						toast.error(t("syncplayHostDisconnected")),
					);
				const before = new Map(
					previous.members.map((member) => [member.participantId, member]),
				);
				const after = new Map(
					next.members.map((member) => [member.participantId, member]),
				);
				for (const member of next.members)
					if (
						member.participantId !== currentParticipantId &&
						!before.has(member.participantId)
					)
						announceOnce(
							`group:${next.id}:${next.revision}:member-joined:${member.participantId ?? member.userId}`,
							() =>
								toast.success(t("syncplayMemberJoined", { member: member.username })),
						);
				for (const member of previous.members)
					if (
						member.participantId !== currentParticipantId &&
						!after.has(member.participantId)
					)
						announceOnce(
							`group:${next.id}:${next.revision}:member-left:${member.participantId ?? member.userId}`,
							() =>
								toast.success(t("syncplayMemberLeft", { member: member.username })),
						);
				if (previous.allowViewerControls !== next.allowViewerControls)
					announceOnce(
						`group:${next.id}:${next.revision}:viewer-controls:${next.allowViewerControls ? "enabled" : "disabled"}`,
						() =>
							toast.success(
								t(
									next.allowViewerControls
										? "syncplayViewerControlsEnabled"
										: "syncplayViewerControlsDisabled",
								),
							),
					);
				if (
					next.itemId &&
					(next.mediaGeneration ?? 0) !== (previous.mediaGeneration ?? 0)
				) {
					// Keep the marker from the host's click through the command
					// response. The player will emit a later `play` event once its
					// media is ready; that event must not announce the same title again.
					const generationKey = `${next.id}:${next.mediaGeneration ?? 0}`;
					if (announcedMediaGenerationRef.current !== generationKey) {
						announcePlayback(next.itemId, `media:${generationKey}`);
						announcedMediaGenerationRef.current = generationKey;
					}
				}
			}
			setCurrent(next);
		},
		[announceOnce, announcePlayback, currentParticipantId, setCurrent, t, toast],
	);
	const refresh = useCallback(
		async (signal?: AbortSignal) => {
			const requestedActive = activeRef.current;
			const membershipGeneration = membershipGenerationRef.current;
			const data = (await call(
				sessionRef.current,
				"groups",
				"GET",
				undefined,
				signal,
			)) as { groups: SyncplayGroup[] };
			if (
				signal?.aborted ||
				membershipGeneration !== membershipGenerationRef.current ||
				membershipActionRef.current
			)
				return;
			syncplayDebug(
				"groups refreshed",
				JSON.stringify(
					data.groups.map((group) => ({
						id: group.id,
						itemId: group.itemId,
						memberCount: group.members?.length ?? 0,
						members:
							group.members?.map((member) => ({
								userId: member.userId,
								participantId: member.participantId,
								watchingTogether: member.watchingTogether,
							})) ?? [],
					})),
				),
			);
			const visibleGroups = data.groups.filter((group) => {
				const tombstone = tombstonesRef.current.get(group.id);
				return tombstone == null || group.revision > tombstone;
			});
			setGroups((old) =>
				visibleGroups.map((group) => {
					const known = old.find((entry) => entry.id === group.id);
					return known && known.revision >= group.revision ? known : group;
				}),
			);
			const current = activeRef.current;
			if (
				requestedActive &&
				current?.id === requestedActive.id &&
				current.revision === requestedActive.revision &&
				!membershipActionRef.current &&
				!visibleGroups.some((group) => group.id === requestedActive.id)
			) {
				clearStaleGroup(requestedActive.id, requestedActive.revision);
				return;
			}
			const candidate = current
				? (visibleGroups.find((group) => group.id === current.id) ?? current)
				: (visibleGroups.find(
						(group) =>
							!leftGroupsRef.current.has(group.id) &&
							group.members.some((member) =>
								isCurrentParticipant(
									member,
									currentParticipantId,
									sessionRef.current.userId,
								),
							),
					) ?? null);
			if (current && candidate && candidate.revision < current.revision) return;
			if (
				current &&
				candidate &&
				!candidate.members.some((member) =>
					isCurrentParticipant(
						member,
						currentParticipantId,
						sessionRef.current.userId,
					),
				)
			) {
				clearStaleGroup(current.id, current.revision);
				return;
			}
			reconcile(
				candidate?.members.some((member) =>
					isCurrentParticipant(
						member,
						currentParticipantId,
						sessionRef.current.userId,
					),
				)
					? candidate
					: null,
			);
		},
		[clearStaleGroup, currentParticipantId, reconcile],
	);
	const reconcileRef = useRef(reconcile);
	const refreshRef = useRef(refresh);
	useEffect(() => {
		reconcileRef.current = reconcile;
		refreshRef.current = refresh;
	}, [reconcile, refresh]);
	const adopt = useCallback(
		(group: SyncplayGroup, announceNewMedia = false) => {
			if (
				leftGroupsRef.current.has(group.id) &&
				group.members.some((member) =>
					isCurrentParticipant(member, currentParticipantId, session.userId),
				)
			)
				return;
			const tombstone = tombstonesRef.current.get(group.id);
			const knownRevision = revisionRef.current.get(group.id);
			if (
				(tombstone != null && group.revision <= tombstone) ||
				(knownRevision != null && group.revision <= knownRevision)
			)
				return;
			if (
				activeRef.current?.id === group.id &&
				group.revision <= activeRef.current.revision
			)
				return;
			hydratedRef.current = true;
			revisionRef.current.set(group.id, group.revision);
			if (
				announceNewMedia &&
				activeRef.current?.id !== group.id &&
				group.itemId &&
				group.itemId !== activeRef.current?.itemId
			)
				announcePlayback(
					group.itemId,
					`media:${group.id}:${group.mediaGeneration ?? 0}`,
				);
			const isMember = group.members.some((member) =>
				isCurrentParticipant(member, currentParticipantId, session.userId),
			);
			if (activeRef.current?.id === group.id) reconcile(isMember ? group : null);
			// All users receive group broadcasts so they can discover public groups.
			// A broadcast for a group someone else joined must never turn that group
			// into this user's active session.
			else if (isMember) setCurrent(group);
			setGroups((old) => {
				const previous = old.find((entry) => entry.id === group.id);
				if (previous && previous.revision > group.revision) return old;
				return [group, ...old.filter((entry) => entry.id !== group.id)];
			});
		},
		[
			announcePlayback,
			currentParticipantId,
			reconcile,
			session.userId,
			setCurrent,
		],
	);
	useEffect(() => {
		socketHandlersRef.current = { adopt, setCurrent, t, toast };
	}, [adopt, setCurrent, t, toast]);
	useEffect(() => {
		let disposed = false;
		let firstConnection = true;
		presenceQueue.resume();
		const recover = () => {
			if (disposed || recoveryJobRef.current) return;
			const controller = new AbortController();
			recoveryControllerRef.current = controller;
			const job = (async () => {
				let attempt = 0;
				while (!disposed && !controller.signal.aborted) {
					try {
						await refreshRef.current(controller.signal);
						if (controller.signal.aborted) return;
						setRecoveryEpoch((value) => value + 1);
						await recoveryPause(0, controller.signal);
						const delivery = await syncplayRequest(
							() => replayPresenceRef.current(),
							controller.signal,
						);
						if (
							delivery === "superseded" &&
							lastPresenceRef.current &&
							syncplayPresenceReportIsCurrent(
								lastPresenceRef.current,
								activeRef.current,
							)
						) {
							throw new Error("Presence was not acknowledged");
						}
						if (!controller.signal.aborted) syncplayDebug("recovery complete");
						return;
					} catch (error) {
						if (disposed || controller.signal.aborted) return;
						if (!isRetryableSyncplayError(error)) {
							syncplayDebug("recovery stopped", error);
							return;
						}
						const delay = syncplayRetryDelay(attempt++);
						syncplayDebug("recovery retry", { delay, error });
						await recoveryPause(delay, controller.signal).catch(() => undefined);
					}
				}
			})().finally(() => {
				if (recoveryJobRef.current === job) recoveryJobRef.current = null;
				if (recoveryControllerRef.current === controller)
					recoveryControllerRef.current = null;
			});
			recoveryJobRef.current = job;
		};
		requestRecoveryRef.current = recover;
		// The HTTP snapshot is the source of truth when the WebSocket upgrade is
		// unavailable (or its first server message is lost). It also lets a user
		// discover groups created by other people before the socket reconnects.
		recover();
		const socket = io(socketOrigin, {
			path: "/api/socket.io",
			auth: { session: sessionRef.current, participantId: currentParticipantId },
			autoConnect: false,
		});
		socketRef.current = socket;
		syncplayDebug("socket created", { socketOrigin, path: "/api/socket.io" });
		queueMicrotask(() => {
			if (!disposed) socket.connect();
		});
		// A single recovery read covers an upgrade that loses its first frame.
		const syncClock = () => {
			if (typeof (socket as unknown as { emit?: unknown }).emit !== "function")
				return;
			const sent = Date.now() / 1000;
			socket.emit(
				"syncplay:clock",
				{ clientSentAt: sent },
				(reply?: { serverReceivedAt?: number; serverSentAt?: number }) => {
					const received = Date.now() / 1000;
					if (!reply?.serverReceivedAt || !reply.serverSentAt) return;
					const rtt = Math.max(
						0,
						received - sent - (reply.serverSentAt - reply.serverReceivedAt),
					);
					if (rtt <= bestRttRef.current) {
						bestRttRef.current = rtt;
						clockOffsetRef.current =
							(reply.serverReceivedAt + reply.serverSentAt - (sent + received)) / 2;
					}
				},
			);
		};
		socket.on("connect", () => {
			syncplayDebug("socket connected", { id: socket.id });
			if (firstConnection && recoveryJobRef.current) {
				firstConnection = false;
				void recoveryJobRef.current.then(recover);
				syncClock();
				return;
			}
			firstConnection = false;
			recoveryControllerRef.current?.abort();
			recoveryJobRef.current = null;
			recover();
			syncClock();
		});
		socket.on<Error>("connect_error", (error) =>
			syncplayDebug("socket connect error", {
				message: error.message,
			}),
		);
		socket.on<string>("disconnect", (reason) => {
			recoveryControllerRef.current?.abort();
			recoveryJobRef.current = null;
			syncplayDebug("socket disconnected", { reason });
		});
		window.addEventListener("online", recover);
		const clockTimer = window.setInterval(syncClock, 30_000);
		socket.on("syncplay:groups", (message: { groups?: SyncplayGroup[] }) => {
			syncplayDebug("socket groups", message);
			const next = message.groups ?? [];
			for (const group of next) socketHandlersRef.current?.adopt(group);
		});
		socket.on("syncplay:group", (message: { group?: SyncplayGroup }) => {
			syncplayDebug("socket group", message);
			if (!message.group) return;
			const group = message.group;
			socketHandlersRef.current?.adopt(group);
		});
		socket.on(
			"syncplay:group-ended",
			(message: { id?: string; revision?: number }) => {
				syncplayDebug("socket group ended", message);
				if (!message.id) return;
				const id = message.id;
				const revision = message.revision ?? Number.MAX_SAFE_INTEGER;
				const tombstone = tombstonesRef.current.get(id);
				if (tombstone === Number.MAX_SAFE_INTEGER) return;
				const known = Math.max(revisionRef.current.get(id) ?? -1, tombstone ?? -1);
				if (revision <= known) return;
				tombstonesRef.current.set(id, Math.max(tombstone ?? -1, revision));
				revisionRef.current.set(id, revision);
				setGroups((old) => old.filter((group) => group.id !== id));
				if (activeRef.current?.id === id) reconcileRef.current(null, revision);
			},
		);
		socket.on("syncplay:participant-replaced", (message: { id?: string }) => {
			syncplayDebug("participant replaced", message);
			if (!message.id || activeRef.current?.id !== message.id) return;
			if (tombstonesRef.current.get(message.id) === Number.MAX_SAFE_INTEGER)
				return;
			tombstonesRef.current.set(message.id, Number.MAX_SAFE_INTEGER);
			socketHandlersRef.current?.setCurrent(null);
			socketHandlersRef.current?.toast.error(
				socketHandlersRef.current.t("syncplayParticipantReplaced"),
			);
		});
		return () => {
			window.clearInterval(clockTimer);
			disposed = true;
			window.removeEventListener("online", recover);
			requestRecoveryRef.current = () => undefined;
			recoveryControllerRef.current?.abort();
			recoveryJobRef.current = null;
			presenceQueue.stop();
			socket.disconnect();
			if (socketRef.current === socket) socketRef.current = null;
		};
	}, [currentParticipantId, presenceQueue, session.userId, socketOrigin]);
	const create = async () => {
		if (activeRef.current || membershipActionRef.current) return;
		membershipActionRef.current = true;
		membershipGenerationRef.current += 1;
		recoveryControllerRef.current?.abort();
		try {
			const group = (await call(session, "groups", "POST")) as SyncplayGroup;
			adopt(group);
			toast.success(t("syncplayGroupCreated"));
		} catch (error) {
			toast.error(
				error instanceof SyncplayRequestError && error.status === 409
					? t("syncplayAlreadyInGroup")
					: t("syncplayCreateFailed"),
			);
			throw error;
		} finally {
			membershipActionRef.current = false;
		}
	};
	const join = async (id: string) => {
		if (
			(activeRef.current && activeRef.current.id !== id) ||
			membershipActionRef.current
		)
			return;
		membershipActionRef.current = true;
		membershipGenerationRef.current += 1;
		recoveryControllerRef.current?.abort();
		try {
			const known = groups.find((entry) => entry.id === id);
			const group = (await call(session, `groups/${id}/join`, "POST", {
				expectedRevision: known?.revision,
				operationId: operationId(),
			})) as SyncplayGroup;
			tombstonesRef.current.delete(id);
			leftGroupsRef.current.delete(id);
			revisionRef.current.delete(id);
			adopt(group);
			toast.success(t("syncplayJoinedGroup", { group: group.name }));
			return group;
		} catch (error) {
			toast.error(
				error instanceof SyncplayRequestError && error.status === 409
					? t("syncplayMustLeaveGroup")
					: t("syncplayJoinFailed"),
			);
			throw error;
		} finally {
			membershipActionRef.current = false;
		}
	};
	const leave = async () => {
		const group = activeRef.current;
		if (!group || membershipActionRef.current) return;
		membershipActionRef.current = true;
		membershipGenerationRef.current += 1;
		recoveryControllerRef.current?.abort();
		recoveryJobRef.current = null;
		presenceQueue.clear();
		lastPresenceRef.current = null;
		latestSeekRef.current += 1;
		try {
			await call(sessionRef.current, `groups/${group.id}`, "DELETE", {
				expectedRevision: group.revision,
				operationId: operationId(),
			});
			leftGroupsRef.current.add(group.id);
			if (activeRef.current?.id === group.id) setCurrent(null);
			membershipActionRef.current = false;
			await refresh();
			toast.success(t("syncplayLeftGroup", { group: group.name }));
		} catch (error) {
			if (isTerminalSyncplayError(error)) {
				clearStaleGroup(group.id);
				return;
			}
			if (error instanceof SyncplayRequestError && error.status === 403) {
				setCurrent(null);
				await refresh().catch(() => undefined);
				toast.success(t("syncplayGroupEnded", { group: group.name }));
				return;
			}
			if (isRetryableSyncplayError(error)) requestRecoveryRef.current();
			toast.error(t("syncplayLeaveFailed"));
			throw error;
		} finally {
			membershipActionRef.current = false;
		}
	};
	const setControls = async (value: boolean) => {
		const group = activeRef.current;
		if (!group) return;
		const pending = controlsUpdateRef.current;
		if (pending && pending.groupId === group.id && pending.value === value)
			return pending.promise;
		const request = (async () => {
			try {
				adopt(
					(await call(session, `groups/${group.id}`, "PATCH", {
						allowViewerControls: value,
						expectedRevision: group.revision,
						operationId: operationId(),
					})) as SyncplayGroup,
				);
			} catch (error) {
				if (isTerminalSyncplayError(error)) {
					clearStaleGroup(group.id);
					return;
				}
				toast.error(t("syncplaySettingsFailed"));
				throw error;
			}
		})().finally(() => {
			if (controlsUpdateRef.current?.promise === request)
				controlsUpdateRef.current = null;
		});
		controlsUpdateRef.current = { groupId: group.id, value, promise: request };
		return request;
	};
	const removeMember = async (userId: string) => {
		const group = activeRef.current;
		if (!group) return;
		try {
			adopt(
				(await call(
					session,
					`groups/${group.id}/members/${encodeURIComponent(userId)}`,
					"DELETE",
					{ expectedRevision: group.revision, operationId: operationId() },
				)) as SyncplayGroup,
			);
		} catch (error) {
			if (isTerminalSyncplayError(error)) {
				clearStaleGroup(group.id);
				return;
			}
			toast.error(t("syncplaySettingsFailed"));
			throw error;
		}
	};
	const setWatchingTogether = async (value: boolean) => {
		const group = activeRef.current;
		if (!group) return;
		if (!value) {
			lastPresenceRef.current = null;
			presenceQueue.clear();
			recoveryControllerRef.current?.abort();
		}
		const update = (state: SyncplayGroup): SyncplayGroup => ({
			...state,
			members: state.members.map((member) =>
				isCurrentParticipant(member, currentParticipantId, session.userId)
					? {
							...member,
							watchingTogether: value,
							viewing: false,
							loading: false,
							readyGeneration: -1,
						}
					: member,
			),
		});
		setCurrent(update(group));
		setGroups((old) =>
			old.map((entry) => (entry.id === group.id ? update(entry) : entry)),
		);
		try {
			adopt(
				(await call(session, `groups/${group.id}/participation`, "POST", {
					watchingTogether: value,
					operationId: operationId(),
				})) as SyncplayGroup,
			);
		} catch (error) {
			if (isTerminalSyncplayError(error)) {
				clearStaleGroup(group.id);
				return;
			}
			adopt((await call(session, `groups/${group.id}`)) as SyncplayGroup);
			toast.error(t("syncplayPresenceFailed"));
			throw error;
		}
	};
	const command = (value: Command) => {
		const group = activeRef.current;
		if (!group) return Promise.resolve();
		const itemId = value.itemId ?? group.itemId;
		const shouldAnnounce =
			itemId &&
			(session.userId === group.hostUserId || value.action === "media") &&
			value.action === "media";
		if (shouldAnnounce) {
			// Announce the host's explicit media selection at the button command
			// boundary. Play/pause commands must remain silent, including resume.
			const generationKey = `${group.id}:${(group.mediaGeneration ?? 0) + 1}`;
			announcedMediaGenerationRef.current = generationKey;
			announcePlayback(itemId, `media:${generationKey}`);
		}
		const groupId = group.id;
		const seekVersion = value.action === "seek" ? ++latestSeekRef.current : null;
		const run = async () => {
			syncplayDebug("command queued", { groupId, value, seekVersion });
			// Arrow-key seeks can arrive faster than a round trip. Older queued
			// seeks are obsolete, so only send the destination the user settled on.
			if (seekVersion != null && seekVersion !== latestSeekRef.current) return;
			const current = activeRef.current;
			if (!current || current.id !== groupId) return;
			const id = operationId();
			const send = (revision: number) =>
				call(session, `groups/${groupId}/command`, "POST", {
					...value,
					expectedRevision: revision,
					operationId: id,
				}) as Promise<SyncplayGroup>;
			try {
				try {
					syncplayDebug("command send", {
						groupId,
						revision: current.revision,
						operationId: id,
						value,
					});
					adopt(await send(current.revision), true);
				} catch (error) {
					if (!(error instanceof SyncplayRequestError) || error.status !== 409)
						throw error;
					const latest = (error.group ??
						(await call(session, `groups/${groupId}`))) as SyncplayGroup;
					syncplayDebug("command stale; retrying", {
						groupId,
						latestRevision: latest.revision,
						error,
					});
					adopt(latest);
					try {
						adopt(await send(latest.revision), true);
					} catch (retryError) {
						if (
							!(retryError instanceof SyncplayRequestError) ||
							retryError.status !== 409
						)
							throw retryError;
						adopt((await call(session, `groups/${groupId}`)) as SyncplayGroup);
						throw retryError;
					}
				}
			} catch (error) {
				if (isTerminalSyncplayError(error)) {
					clearStaleGroup(groupId);
					return;
				}
				syncplayDebug("command failed", { groupId, value, error });
				toast.error(t("syncplayPlaybackFailed"));
				throw error;
			}
		};
		const next = commandChainRef.current.catch(() => undefined).then(run);
		commandChainRef.current = next;
		return next;
	};
	const presence = useCallback(
		(
			viewing: boolean,
			loading: boolean,
			mediaGeneration?: number,
			timelineRevision?: number,
		): Promise<SyncplayPresenceDelivery> => {
			const group = activeRef.current;
			if (!group || membershipActionRef.current)
				return Promise.resolve("superseded");
			const report: SyncplayPresenceReport = {
				groupId: group.id,
				itemId: group.itemId,
				viewing,
				loading,
				generation: mediaGeneration ?? group.mediaGeneration ?? 0,
				timelineRevision:
					timelineRevision ?? group.timelineRevision ?? group.revision,
				sequence: ++presenceSequenceRef.current,
			};
			writePresenceSequence(currentParticipantId, report.sequence);
			lastPresenceRef.current = report;
			return presenceQueue.enqueue({ ...report, operationId: operationId() });
		},
		[currentParticipantId, presenceQueue],
	);
	useEffect(() => {
		replayPresenceRef.current = async () => {
			const intent = lastPresenceRef.current;
			const group = activeRef.current;
			if (
				!intent ||
				!group ||
				group.id !== intent.groupId ||
				(intent.viewing && !syncplayPresenceReportIsCurrent(intent, group))
			)
				return;
			return presence(
				intent.viewing,
				intent.loading,
				intent.generation,
				intent.timelineRevision,
			);
		};
		return () => {
			replayPresenceRef.current = async () => undefined;
		};
	}, [presence]);
	const value = {
		groups,
		active,
		recoveryEpoch,
		currentMember:
			active?.members.find((member) =>
				isCurrentParticipant(member, currentParticipantId, session.userId),
			) ?? null,
		create,
		join,
		leave,
		refresh,
		setControls,
		removeMember,
		setWatchingTogether,
		command,
		presence,
		canControl: Boolean(
			active &&
			(active.hostUserId === session.userId || active.allowViewerControls),
		),
		serverNow,
	};
	return (
		<SyncplayContext.Provider value={value}>{children}</SyncplayContext.Provider>
	);
}
export function useSyncplay() {
	return useContext(SyncplayContext);
}
