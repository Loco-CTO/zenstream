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
type Socket = SyncplaySocket;
type SyncplayEvent = unknown;
class SyncplaySocket {
	private ws: WebSocket | null = null;
	private listeners = new Map<string, ((value?: SyncplayEvent) => void)[]>();
	id = "syncplay";
	constructor(
		private readonly url: string,
		private readonly auth: { token: string; participantId: string },
	) {}
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
	async connect() {
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING)
		)
			return;
		const httpOrigin = this.url
			.replace(/^ws:/, "http:")
			.replace(/^wss:/, "https:")
			.replace(/\/api\/ws\/syncplay$/, "");
		let ticket: string;
		try {
			const response = await fetch(`${httpOrigin}/api/auth/socket-ticket`, {
				method: "POST",
				headers: { Authorization: `Bearer ${this.auth.token}` },
			});
			if (!response.ok) throw new Error("Socket ticket request failed");
			ticket = String((await response.json()).ticket ?? "");
			if (!ticket) throw new Error("Socket ticket was empty");
		} catch (error) {
			this.fire("connect_error", error as Error);
			return;
		}
		const ws = new WebSocket(
			`${this.url}?ticket=${encodeURIComponent(ticket)}&participantId=${encodeURIComponent(this.auth.participantId)}`,
		);
		this.ws = ws;
		ws.onopen = () => this.fire("connect");
		ws.onclose = (event) => {
			if (this.ws === ws) this.ws = null;
			this.fire("disconnect", event.reason);
		};
		ws.onerror = () =>
			this.fire("connect_error", new Error("WebSocket connection failed"));
		ws.onmessage = (event) => {
			const message = JSON.parse(event.data);
			if (message.type === "groups") this.fire("syncplay:groups", message);
			else if (message.type === "group") this.fire("syncplay:group", message);
			else if (message.type === "group-ended")
				this.fire("syncplay:group-ended", message);
			else if (message.type === "participant-replaced")
				this.fire("syncplay:participant-replaced", message);
			else if (message.type === "clock") this.fire("clock", message);
		};
	}
	emit<T = SyncplayEvent>(
		event: string,
		payload: Record<string, unknown>,
		callback?: (value: T) => void,
	) {
		if (event === "syncplay:clock") {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
			this.once("clock", callback);
			this.ws.send(JSON.stringify({ type: "clock", ...payload }));
		}
	}
	once<T = SyncplayEvent>(event: string, callback?: (value: T) => void) {
		if (callback) {
			const listener = (value: T) => {
				callback(value);
				this.listeners.set(
					event,
					(this.listeners.get(event) ?? []).filter((entry) => entry !== listener),
				);
			};
			this.on(event, listener);
		}
	}
	disconnect() {
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
		auth: { token: string; participantId: string };
		path?: string;
		autoConnect?: boolean;
	},
) => new SyncplaySocket(normalizeSyncplayOrigin(origin), options.auth);
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { getItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { getAuthSession } from "@/lib/session";

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
	) => Promise<void>;
	canControl: boolean;
	serverNow: () => number;
};
const emptyContext: Context = {
	groups: [],
	active: null,
	currentMember: null,
	create: async () => undefined,
	join: async () => undefined,
	leave: async () => undefined,
	refresh: async () => undefined,
	setControls: async () => undefined,
	removeMember: async () => undefined,
	setWatchingTogether: async () => undefined,
	command: async () => undefined,
	presence: async () => undefined,
	canControl: false,
	serverNow: () => Date.now() / 1000,
};
const SyncplayContext = createContext<Context>(emptyContext);
const SYNCPLAY_REQUEST_TIMEOUT_MS = 8_000;
const SYNCPLAY_PARTICIPANT_KEY = "zenstream-syncplay-tab-id";
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
function isCurrentParticipant(
	member: { participantId?: string },
	currentId: string,
) {
	return member.participantId == null
		? true
		: member.participantId === currentId;
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
async function call(path: string, method = "GET", body?: unknown) {
	const started = performance.now();
	syncplayDebug("HTTP request", { path, method, body });
	const controller = new AbortController();
	const timeout = window.setTimeout(
		() => controller.abort(),
		SYNCPLAY_REQUEST_TIMEOUT_MS,
	);
	let response: Response;
	try {
		const base = (process.env.NEXT_PUBLIC_ZSO_URL ?? "").replace(/\/+$/, "");
		response = await fetch(`${base}/api/syncplay/${path}`, {
			method,
			headers: {
				...(getAuthSession()?.token
					? { Authorization: `Bearer ${getAuthSession()!.token}` }
					: {}),
				...(getAuthSession()?.username
					? { "X-ZenStream-Username": getAuthSession()!.username }
					: {}),
				"X-ZenStream-Participant": participantId(),
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
			cache: "no-store",
			signal: controller.signal,
		});
	} finally {
		window.clearTimeout(timeout);
	}
	syncplayDebug("HTTP response", {
		path,
		method,
		status: response.status,
		elapsedMs: Math.round(performance.now() - started),
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		syncplayDebug("HTTP error", {
			path,
			method,
			status: response.status,
			error,
		});
		throw new SyncplayRequestError(
			error.message ?? "Syncplay request failed.",
			response.status,
			error.group,
		);
	}
	return response.status === 204 ? null : response.json();
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
	const { t } = useI18n();
	const toast = useToast();
	const [groups, setGroups] = useState<SyncplayGroup[]>([]);
	const [active, setActive] = useState<SyncplayGroup | null>(null);
	const activeRef = useRef<SyncplayGroup | null>(null);
	const socketRef = useRef<Socket | null>(null);
	const commandChainRef = useRef(Promise.resolve());
	const latestSeekRef = useRef(0);
	const presenceChainRef = useRef(Promise.resolve());
	const presenceSequenceRef = useRef(0);
	const revisionRef = useRef(new Map<string, number>());
	const tombstonesRef = useRef(new Map<string, number>());
	const clockOffsetRef = useRef(0);
	const bestRttRef = useRef(Infinity);
	const hydratedRef = useRef(false);
	const titleCache = useRef(new Map<string, string>());
	const announcedMediaGenerationRef = useRef<string | null>(null);
	const announcementItemRef = useRef<string | null>(null);
	const membershipActionRef = useRef(false);
	const socketHandlersRef = useRef<{
		adopt: (group: SyncplayGroup, announceNewMedia?: boolean) => void;
		setCurrent: (group: SyncplayGroup | null) => void;
		t: ReturnType<typeof useI18n>["t"];
		toast: ReturnType<typeof useToast>;
	} | null>(null);
	const [currentParticipantId] = useState(participantId);
	const serverNow = useCallback(
		() => Date.now() / 1000 + clockOffsetRef.current,
		[],
	);

	const setCurrent = useCallback((group: SyncplayGroup | null) => {
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
		activeRef.current = group;
		setActive(group);
	}, []);
	const announcePlayback = useCallback(
		(itemId: string) => {
			announcementItemRef.current = itemId;
			const title = titleCache.current.get(itemId);
			if (title) {
				toast.success(t("syncplayNowPlaying", { title }));
				return;
			}
			void getItem(session, itemId)
				.then((item) => {
					titleCache.current.set(itemId, item.Name);
					if (announcementItemRef.current === itemId)
						toast.success(t("syncplayNowPlaying", { title: item.Name }));
				})
				.catch(() => {
					if (announcementItemRef.current === itemId)
						toast.success(t("syncplayNowPlayingFallback"));
				});
		},
		[session, t, toast],
	);
	const reconcile = useCallback(
		(next: SyncplayGroup | null) => {
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
				next.revision < previous.revision
			)
				return;
			if (previous && !next)
				toast.success(t("syncplayGroupEnded", { group: previous.name }));
			if (previous && next && previous.id === next.id) {
				if (!previous.hostDisconnectedAt && next.hostDisconnectedAt)
					toast.error(t("syncplayHostDisconnected"));
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
						toast.success(t("syncplayMemberJoined", { member: member.username }));
				for (const member of previous.members)
					if (
						member.participantId !== currentParticipantId &&
						!after.has(member.participantId)
					)
						toast.success(t("syncplayMemberLeft", { member: member.username }));
				if (
					next.itemId &&
					(next.mediaGeneration ?? 0) !== (previous.mediaGeneration ?? 0)
				) {
					// Keep the marker from the host's click through the command
					// response. The player will emit a later `play` event once its
					// media is ready; that event must not announce the same title again.
					const generationKey = `${next.id}:${next.mediaGeneration ?? 0}`;
					if (announcedMediaGenerationRef.current !== generationKey) {
						announcePlayback(next.itemId);
						announcedMediaGenerationRef.current = generationKey;
					}
				}
			}
			setCurrent(next);
		},
		[announcePlayback, currentParticipantId, setCurrent, t, toast],
	);
	const refresh = useCallback(async () => {
		const data = (await call("groups")) as { groups: SyncplayGroup[] };
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
		setGroups((old) =>
			data.groups.map((group) => {
				const known = old.find((entry) => entry.id === group.id);
				return known && known.revision > group.revision ? known : group;
			}),
		);
		const current = activeRef.current;
		reconcile(
			current
				? // A recovery read can have started before a local join completed.
					// Only WebSocket end/membership events are authoritative removals.
					(data.groups.find((group) => group.id === current.id) ?? current)
				: (data.groups.find((group) =>
						group.members.some((member) =>
							isCurrentParticipant(member, currentParticipantId),
						),
					) ?? null),
		);
	}, [currentParticipantId, reconcile]);
	const reconcileRef = useRef(reconcile);
	const refreshRef = useRef(refresh);
	useEffect(() => {
		reconcileRef.current = reconcile;
		refreshRef.current = refresh;
	}, [reconcile, refresh]);
	const adopt = useCallback(
		(group: SyncplayGroup, announceNewMedia = false) => {
			const tombstone = tombstonesRef.current.get(group.id);
			const knownRevision = revisionRef.current.get(group.id);
			if (
				(tombstone != null && group.revision <= tombstone) ||
				(knownRevision != null && group.revision < knownRevision)
			)
				return;
			if (
				activeRef.current?.id === group.id &&
				group.revision < activeRef.current.revision
			)
				return;
			if (
				activeRef.current?.id === group.id &&
				activeRef.current.allowViewerControls !== group.allowViewerControls
			)
				toast.success(
					t(
						group.allowViewerControls
							? "syncplayViewerControlsEnabled"
							: "syncplayViewerControlsDisabled",
					),
				);
			hydratedRef.current = true;
			revisionRef.current.set(group.id, group.revision);
			if (
				announceNewMedia &&
				activeRef.current?.id !== group.id &&
				group.itemId &&
				group.itemId !== activeRef.current?.itemId
			)
				announcePlayback(group.itemId);
			const isMember = group.members.some((member) =>
				isCurrentParticipant(member, currentParticipantId),
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
		[announcePlayback, currentParticipantId, reconcile, setCurrent, t, toast],
	);
	useEffect(() => {
		socketHandlersRef.current = { adopt, setCurrent, t, toast };
	}, [adopt, setCurrent, t, toast]);
	useEffect(() => {
		let disposed = false;
		// The HTTP snapshot is the source of truth when the WebSocket upgrade is
		// unavailable (or its first server message is lost). It also lets a user
		// discover groups created by other people before the socket reconnects.
		void refreshRef.current().catch(() => undefined);
		const socketOrigin = (
			process.env.NEXT_PUBLIC_ZSO_URL ?? window.location.origin
		).replace(/\/+$/, "");
		const socket = io(socketOrigin, {
			path: "/api/socket.io",
			auth: { token: session.token, participantId: currentParticipantId },
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
			void refreshRef
				.current()
				.catch((error) => syncplayDebug("socket refresh failed", error));
			syncClock();
		});
		socket.on<Error>("connect_error", (error) =>
			syncplayDebug("socket connect error", {
				message: error.message,
			}),
		);
		socket.on<string>("disconnect", (reason) =>
			syncplayDebug("socket disconnected", { reason }),
		);
		const clockTimer = window.setInterval(syncClock, 30_000);
		socket.on("syncplay:groups", (message: { groups?: SyncplayGroup[] }) => {
			syncplayDebug("socket groups", message);
			const next = message.groups ?? [];
			for (const group of next) socketHandlersRef.current?.adopt(group);
			const current = activeRef.current;
			if (current) {
				const candidate = next.find((group) => group.id === current.id);
				// A connection snapshot can be older than a command response or a
				// socket event already applied locally. It must not evict the session.
				if (candidate && candidate.revision >= current.revision)
					reconcileRef.current(
						candidate.members.some((member) =>
							isCurrentParticipant(member, currentParticipantId),
						)
							? candidate
							: null,
					);
			} else
				reconcileRef.current(
					next.find((group) =>
						group.members.some((member) =>
							isCurrentParticipant(member, currentParticipantId),
						),
					) ?? null,
				);
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
				const known = revisionRef.current.get(id) ?? -1;
				if (revision < known) return;
				tombstonesRef.current.set(id, revision);
				revisionRef.current.set(id, revision);
				setGroups((old) => old.filter((group) => group.id !== id));
				if (activeRef.current?.id === id) reconcileRef.current(null);
			},
		);
		socket.on("syncplay:participant-replaced", (message: { id?: string }) => {
			syncplayDebug("participant replaced", message);
			if (!message.id || activeRef.current?.id !== message.id) return;
			tombstonesRef.current.set(message.id, Number.MAX_SAFE_INTEGER);
			socketHandlersRef.current?.setCurrent(null);
			socketHandlersRef.current?.toast.error(
				socketHandlersRef.current.t("syncplayParticipantReplaced"),
			);
		});
		return () => {
			window.clearInterval(clockTimer);
			disposed = true;
			socket.disconnect();
			if (socketRef.current === socket) socketRef.current = null;
		};
	}, [currentParticipantId, session.token]);
	const create = async () => {
		if (activeRef.current || membershipActionRef.current) return;
		membershipActionRef.current = true;
		try {
			const group = (await call("groups", "POST")) as SyncplayGroup;
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
		try {
			const known = groups.find((entry) => entry.id === id);
			const group = (await call(`groups/${id}/join`, "POST", {
				expectedRevision: known?.revision,
				operationId: operationId(),
			})) as SyncplayGroup;
			tombstonesRef.current.delete(id);
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
		if (!group) return;
		try {
			await call(`groups/${group.id}`, "DELETE", {
				expectedRevision: group.revision,
				operationId: operationId(),
			});
			setCurrent(null);
			await refresh();
			toast.success(t("syncplayLeftGroup", { group: group.name }));
		} catch (error) {
			if (
				error instanceof SyncplayRequestError &&
				(error.status === 403 || error.status === 404)
			) {
				setCurrent(null);
				await refresh().catch(() => undefined);
				toast.success(t("syncplayGroupEnded", { group: group.name }));
				return;
			}
			toast.error(t("syncplayLeaveFailed"));
			throw error;
		}
	};
	const setControls = async (value: boolean) => {
		const group = activeRef.current;
		if (!group) return;
		try {
			adopt(
				(await call(`groups/${group.id}`, "PATCH", {
					allowViewerControls: value,
					expectedRevision: group.revision,
					operationId: operationId(),
				})) as SyncplayGroup,
			);
		} catch (error) {
			toast.error(t("syncplaySettingsFailed"));
			throw error;
		}
	};
	const removeMember = async (userId: string) => {
		const group = activeRef.current;
		if (!group) return;
		try {
			adopt(
				(await call(
					`groups/${group.id}/members/${encodeURIComponent(userId)}`,
					"DELETE",
					{ expectedRevision: group.revision, operationId: operationId() },
				)) as SyncplayGroup,
			);
		} catch (error) {
			toast.error(t("syncplaySettingsFailed"));
			throw error;
		}
	};
	const setWatchingTogether = async (value: boolean) => {
		const group = activeRef.current;
		if (!group) return;
		const update = (state: SyncplayGroup): SyncplayGroup => ({
			...state,
			members: state.members.map((member) =>
				isCurrentParticipant(member, currentParticipantId)
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
				(await call(`groups/${group.id}/participation`, "POST", {
					watchingTogether: value,
					operationId: operationId(),
				})) as SyncplayGroup,
			);
		} catch (error) {
			adopt((await call(`groups/${group.id}`)) as SyncplayGroup);
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
			announcedMediaGenerationRef.current = `${group.id}:${(group.mediaGeneration ?? 0) + 1}`;
			announcePlayback(itemId);
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
				call(`groups/${groupId}/command`, "POST", {
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
						(await call(`groups/${groupId}`))) as SyncplayGroup;
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
						adopt((await call(`groups/${groupId}`)) as SyncplayGroup);
					}
				}
			} catch (error) {
				syncplayDebug("command failed", { groupId, value, error });
				toast.error(t("syncplayPlaybackFailed"));
				throw error;
			}
		};
		const next = commandChainRef.current.catch(() => undefined).then(run);
		commandChainRef.current = next;
		return next;
	};
	const presence = async (
		viewing: boolean,
		loading: boolean,
		mediaGeneration?: number,
	) => {
		const group = activeRef.current;
		if (!group) return;
		const groupId = group.id;
		const generation = mediaGeneration ?? group.mediaGeneration ?? 0;
		const timelineRevision = group.timelineRevision ?? group.revision;
		const sequence = ++presenceSequenceRef.current;
		const send = async () => {
			if (activeRef.current?.id !== groupId) return;
			try {
				syncplayDebug("presence send", {
					groupId,
					viewing,
					loading,
					generation,
					timelineRevision,
					sequence,
				});
				adopt(
					(await call(`groups/${groupId}/presence`, "POST", {
						viewing,
						loading,
						mediaGeneration: generation,
						timelineRevision,
						presenceSequence: sequence,
						operationId: operationId(),
					})) as SyncplayGroup,
				);
			} catch (error) {
				syncplayDebug("presence failed", {
					groupId,
					viewing,
					loading,
					generation,
					timelineRevision,
					sequence,
					error,
				});
				toast.error(t("syncplayPresenceFailed"));
				throw error;
			}
		};
		const next = presenceChainRef.current.catch(() => undefined).then(send);
		presenceChainRef.current = next;
		return next;
	};
	const value = {
		groups,
		active,
		currentMember:
			active?.members.find((member) =>
				isCurrentParticipant(member, currentParticipantId),
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
