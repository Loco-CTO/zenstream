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
	updatedAt: number;
	members: {
		userId: string;
		username: string;
		viewing: boolean;
		loading: boolean;
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
	command: (value: Command) => Promise<void>;
	presence: (viewing: boolean, loading: boolean) => Promise<void>;
	canControl: boolean;
};
const emptyContext: Context = {
	groups: [],
	active: null,
	create: async () => undefined,
	join: async () => undefined,
	leave: async () => undefined,
	refresh: async () => undefined,
	setControls: async () => undefined,
	command: async () => undefined,
	presence: async () => undefined,
	canControl: false,
};
const SyncplayContext = createContext<Context>(emptyContext);
class SyncplayRequestError extends Error {
	constructor(
		message: string,
		readonly status: number,
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
	if (!response.ok)
		throw new SyncplayRequestError(
			(await response.json().catch(() => ({}))).message ??
				"Syncplay request failed.",
			response.status,
		);
	return response.status === 204 ? null : response.json();
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
	const socketRef = useRef<WebSocket | null>(null);
	const commandInFlightRef = useRef(false);
	const hydratedRef = useRef(false);
	const titleCache = useRef(new Map<string, string>());

	const setCurrent = useCallback((group: SyncplayGroup | null) => {
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
		setGroups(data.groups);
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
			if (activeRef.current?.id === group.id && group.revision < activeRef.current.revision)
				return;
			hydratedRef.current = true;
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
		// The HTTP snapshot is the source of truth when the WebSocket upgrade is
		// unavailable (or its first server message is lost). It also lets a user
		// discover groups created by other people before the socket reconnects.
		void refreshRef.current().catch(() => undefined);
		const scheme = window.location.protocol === "https:" ? "wss" : "ws";
		const socket = new WebSocket(`${scheme}://${window.location.host}/api/syncplay/ws/syncplay?token=${encodeURIComponent(session.token)}`);
		socketRef.current = socket;
		// A single recovery read covers an upgrade that loses its first frame.
		socket.onopen = () => void refreshRef.current().catch(() => undefined);
		socket.onmessage = ({ data }) => {
			const message = JSON.parse(String(data)) as { type: string; groups?: SyncplayGroup[]; group?: SyncplayGroup; id?: string };
			if (message.type === "syncplay:groups") {
			const next = message.groups ?? [];
			setGroups(next);
			const current = activeRef.current;
			reconcileRef.current(current
				? (next.find((group) => group.id === current.id && group.members.some((member) => member.userId === session.userId)) ?? null)
				: (next.find((group) => group.members.some((member) => member.userId === session.userId)) ?? null));
			return;
			}
			if (message.type === "syncplay:group" && message.group) {
			const group = message.group;
			setGroups((old) => {
				const previous = old.find((entry) => entry.id === group.id);
				if (previous && previous.revision > group.revision) return old;
				return [group, ...old.filter((entry) => entry.id !== group.id)];
			});
			if (activeRef.current?.id === group.id)
				reconcileRef.current(group.members.some((member) => member.userId === session.userId) ? group : null);
			else if (!activeRef.current && group.members.some((member) => member.userId === session.userId)) reconcileRef.current(group);
			return;
			}
			if (message.type !== "syncplay:group-ended" || !message.id) return;
			const id = message.id;
			setGroups((old) => old.filter((group) => group.id !== id));
			if (activeRef.current?.id === id) reconcileRef.current(null);
		};
		return () => {
			socket.close();
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
			const group = (await call(`groups/${id}/join`, "POST")) as SyncplayGroup;
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
			await call(`groups/${group.id}`, "DELETE");
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
				})) as SyncplayGroup,
			);
		} catch (error) {
			toast.error(t("syncplaySettingsFailed"));
			throw error;
		}
	};
	const command = async (value: Command) => {
		const group = activeRef.current;
		if (!group || commandInFlightRef.current) return;
		commandInFlightRef.current = true;
		const send = (revision: number) =>
			call(`groups/${group.id}/command`, "POST", {
				...value,
				revision,
			}) as Promise<SyncplayGroup>;
		try {
			try {
				adopt(await send(group.revision), true);
			} catch (error) {
				if (!(error instanceof SyncplayRequestError) || error.status !== 409)
					throw error;
				const latest = (await call(`groups/${group.id}`)) as SyncplayGroup;
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
		try {
			adopt(
				(await call(`groups/${group.id}/presence`, "POST", {
					viewing,
					loading,
				})) as SyncplayGroup,
			);
		} catch (error) {
			toast.error(t("syncplayPresenceFailed"));
			throw error;
		}
	};
	const value = {
		groups,
		active,
		create,
		join,
		leave,
		refresh,
		setControls,
		command,
		presence,
		canControl: Boolean(
			active &&
			(active.hostUserId === session.userId || active.allowViewerControls),
		),
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
