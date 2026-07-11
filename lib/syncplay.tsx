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
import { io, type Socket } from "socket.io-client";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { getItem } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";

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
	updatedAt: number;
	members: {
		userId: string;
		username: string;
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
	create: () => Promise<void>;
	join: (id: string) => Promise<void>;
	leave: () => Promise<void>;
	refresh: () => Promise<void>;
	setControls: (value: boolean) => Promise<void>;
	removeMember: (userId: string) => Promise<void>;
	command: (value: Command) => Promise<void>;
	presence: (viewing: boolean, loading: boolean) => Promise<void>;
	canControl: boolean;
	serverNow: () => number;
};
const emptyContext: Context = {
	groups: [],
	active: null,
	create: async () => undefined,
	join: async () => undefined,
	leave: async () => undefined,
	refresh: async () => undefined,
	setControls: async () => undefined,
	removeMember: async () => undefined,
	command: async () => undefined,
	presence: async () => undefined,
	canControl: false,
	serverNow: () => Date.now() / 1000,
};
const SyncplayContext = createContext<Context>(emptyContext);
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
	const response = await fetch(`/api/syncplay/${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
	});
	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new SyncplayRequestError(
			error.message ??
				"Syncplay request failed.",
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
	const commandInFlightRef = useRef(false);
	const presenceChainRef = useRef(Promise.resolve());
	const presenceSequenceRef = useRef(0);
	const revisionRef = useRef(new Map<string, number>());
	const tombstonesRef = useRef(new Map<string, number>());
	const clockOffsetRef = useRef(0);
	const bestRttRef = useRef(Infinity);
	const hydratedRef = useRef(false);
	const titleCache = useRef(new Map<string, string>());

	const setCurrent = useCallback((group: SyncplayGroup | null) => {
		if (group) revisionRef.current.set(group.id, group.revision);
		activeRef.current = group;
		setActive(group);
	}, []);
	const announcePlayback = useCallback(
		(itemId: string) => {
			const title = titleCache.current.get(itemId);
			if (title) {
				toast.success(t("syncplayNowPlaying", { title }));
				return;
			}
			void getItem(session, itemId)
				.then((item) => {
					titleCache.current.set(itemId, item.Name);
					if (activeRef.current?.itemId === itemId)
						toast.success(t("syncplayNowPlaying", { title: item.Name }));
				})
				.catch(() => {
					if (activeRef.current?.itemId === itemId)
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
				const before = new Map(
					previous.members.map((member) => [member.userId, member]),
				);
				const after = new Map(
					next.members.map((member) => [member.userId, member]),
				);
				for (const member of next.members)
					if (member.userId !== session.userId && !before.has(member.userId))
						toast.success(
							t("syncplayMemberJoined", { member: member.username }),
						);
				for (const member of previous.members)
					if (member.userId !== session.userId && !after.has(member.userId))
						toast.success(t("syncplayMemberLeft", { member: member.username }));
				if (next.itemId && next.itemId !== previous.itemId)
					announcePlayback(next.itemId);
			}
			setCurrent(next);
		},
		[announcePlayback, session.userId, setCurrent, t, toast],
	);
	const refresh = useCallback(async () => {
		const data = (await call("groups")) as { groups: SyncplayGroup[] };
		setGroups((old) => data.groups.map((group) => {
			const known = old.find((entry) => entry.id === group.id);
			return known && known.revision > group.revision ? known : group;
		}));
		const current = activeRef.current;
		reconcile(
			current
				// A recovery read can have started before a local join completed.
				// Only WebSocket end/membership events are authoritative removals.
				? (data.groups.find((group) => group.id === current.id) ?? current)
				: (data.groups.find((group) =>
						group.members.some((member) => member.userId === session.userId),
					) ?? null),
		);
	}, [reconcile, session.userId]);
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
			if ((tombstone != null && group.revision <= tombstone) || (knownRevision != null && group.revision < knownRevision)) return;
			if (activeRef.current?.id === group.id && group.revision < activeRef.current.revision)
				return;
			hydratedRef.current = true;
			revisionRef.current.set(group.id, group.revision);
			if (
				announceNewMedia &&
				activeRef.current?.id !== group.id &&
				group.itemId &&
				group.itemId !== activeRef.current?.itemId
			)
				announcePlayback(group.itemId);
			if (activeRef.current?.id === group.id)
				reconcile(group.members.some((member) => member.userId === session.userId) ? group : null);
			else setCurrent(group);
			setGroups((old) => {
				const previous = old.find((entry) => entry.id === group.id);
				if (previous && previous.revision > group.revision) return old;
				return [group, ...old.filter((entry) => entry.id !== group.id)];
			});
		},
		[announcePlayback, reconcile, session.userId, setCurrent],
	);
	useEffect(() => {
		let disposed = false;
		// The HTTP snapshot is the source of truth when the WebSocket upgrade is
		// unavailable (or its first server message is lost). It also lets a user
		// discover groups created by other people before the socket reconnects.
		void refreshRef.current().catch(() => undefined);
		const socketOrigin = (process.env.NEXT_PUBLIC_ZSO_URL ?? window.location.origin)
			.replace(/\/+$/, "");
		const socket = io(`${socketOrigin}/syncplay`, {
			path: "/api/socket.io",
			transports: ["websocket"],
			auth: { token: session.token },
			autoConnect: false,
		});
		socketRef.current = socket;
		queueMicrotask(() => {
			if (!disposed) socket.connect();
		});
		// A single recovery read covers an upgrade that loses its first frame.
		const syncClock = () => {
			if (typeof (socket as unknown as { emit?: unknown }).emit !== "function") return;
			const sent = Date.now() / 1000;
			socket.emit("syncplay:clock", { clientSentAt: sent }, (reply?: { serverReceivedAt?: number; serverSentAt?: number }) => {
				const received = Date.now() / 1000;
				if (!reply?.serverReceivedAt || !reply.serverSentAt) return;
				const rtt = Math.max(0, received - sent - (reply.serverSentAt - reply.serverReceivedAt));
				if (rtt <= bestRttRef.current) {
					bestRttRef.current = rtt;
					clockOffsetRef.current = ((reply.serverReceivedAt + reply.serverSentAt) - (sent + received)) / 2;
				}
			});
		};
		socket.on("connect", () => { void refreshRef.current().catch(() => undefined); syncClock(); });
		const clockTimer = window.setInterval(syncClock, 30_000);
		socket.on("syncplay:groups", (message: { groups?: SyncplayGroup[] }) => {
			const next = message.groups ?? [];
			for (const group of next) adopt(group);
			const current = activeRef.current;
			if (current) {
				const candidate = next.find((group) => group.id === current.id);
				// A connection snapshot can be older than a command response or a
				// socket event already applied locally. It must not evict the session.
				if (candidate && candidate.revision >= current.revision)
					reconcileRef.current(candidate.members.some((member) => member.userId === session.userId) ? candidate : null);
			} else reconcileRef.current(next.find((group) => group.members.some((member) => member.userId === session.userId)) ?? null);
		});
		socket.on("syncplay:group", (message: { group?: SyncplayGroup }) => {
			if (!message.group) return;
			const group = message.group;
			adopt(group);
		});
		socket.on("syncplay:group-ended", (message: { id?: string; revision?: number }) => {
			if (!message.id) return;
			const id = message.id;
			const revision = message.revision ?? Number.MAX_SAFE_INTEGER;
			const known = revisionRef.current.get(id) ?? -1;
			if (revision < known) return;
			tombstonesRef.current.set(id, revision);
			revisionRef.current.set(id, revision);
			setGroups((old) => old.filter((group) => group.id !== id));
			if (activeRef.current?.id === id) reconcileRef.current(null);
		});
		return () => {
			window.clearInterval(clockTimer);
			disposed = true;
			socket.disconnect();
			if (socketRef.current === socket) socketRef.current = null;
		};
	}, [session.token, session.userId]);
	const create = async () => {
		try {
			const group = (await call("groups", "POST")) as SyncplayGroup;
			adopt(group);
			toast.success(t("syncplayGroupCreated"));
		} catch (error) {
			toast.error(t("syncplayCreateFailed"));
			throw error;
		}
	};
	const join = async (id: string) => {
		try {
			const known = groups.find((entry) => entry.id === id);
			const group = (await call(`groups/${id}/join`, "POST", { expectedRevision: known?.revision, operationId: operationId() })) as SyncplayGroup;
			adopt(group);
			toast.success(t("syncplayJoinedGroup", { group: group.name }));
		} catch (error) {
			toast.error(t("syncplayJoinFailed"));
			throw error;
		}
	};
	const leave = async () => {
		const group = activeRef.current;
		if (!group) return;
		try {
			await call(`groups/${group.id}`, "DELETE", { expectedRevision: group.revision, operationId: operationId() });
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
			adopt((await call(`groups/${group.id}/members/${encodeURIComponent(userId)}`, "DELETE", { expectedRevision: group.revision, operationId: operationId() })) as SyncplayGroup);
		} catch (error) {
			toast.error(t("syncplaySettingsFailed"));
			throw error;
		}
	};
	const command = async (value: Command) => {
		const group = activeRef.current;
		if (!group || commandInFlightRef.current) return;
		commandInFlightRef.current = true;
		const id = operationId();
		const send = (revision: number) =>
			call(`groups/${group.id}/command`, "POST", {
				...value,
				expectedRevision: revision,
				operationId: id,
			}) as Promise<SyncplayGroup>;
		try {
			try {
				adopt(await send(group.revision), true);
			} catch (error) {
				if (!(error instanceof SyncplayRequestError) || error.status !== 409)
					throw error;
				const latest = (error.group ?? await call(`groups/${group.id}`)) as SyncplayGroup;
				adopt(latest);
				try {
					adopt(await send(latest.revision), true);
				} catch (retryError) {
					if (
						!(retryError instanceof SyncplayRequestError) ||
						retryError.status !== 409
					)
						throw retryError;
					adopt((await call(`groups/${group.id}`)) as SyncplayGroup);
				}
			}
		} catch (error) {
			toast.error(t("syncplayPlaybackFailed"));
			throw error;
		} finally {
			commandInFlightRef.current = false;
		}
	};
	const presence = async (viewing: boolean, loading: boolean) => {
		const group = activeRef.current;
		if (!group) return;
		const sequence = ++presenceSequenceRef.current;
		const send = async () => {
			try {
				adopt((await call(`groups/${group.id}/presence`, "POST", {
					viewing, loading, mediaGeneration: group.mediaGeneration ?? 0,
					presenceSequence: sequence, operationId: operationId(),
				})) as SyncplayGroup);
			} catch (error) {
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
		create,
		join,
		leave,
		refresh,
		setControls,
		removeMember,
		command,
		presence,
		canControl: Boolean(
			active &&
			(active.hostUserId === session.userId || active.allowViewerControls),
		),
		serverNow: () => Date.now() / 1000 + clockOffsetRef.current,
	};
	return (
		<SyncplayContext.Provider value={value}>
			{children}
		</SyncplayContext.Provider>
	);
}
export function useSyncplay() {
	return useContext(SyncplayContext);
}
