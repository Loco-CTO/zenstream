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
				? (data.groups.find((group) => group.id === current.id) ?? null)
				: (data.groups.find((group) =>
						group.members.some((member) => member.userId === session.userId),
					) ?? null),
		);
	}, [reconcile, session.userId]);
	useEffect(() => {
		const initial = window.setTimeout(
			() => void refresh().catch(() => undefined),
			0,
		);
		const interval = window.setInterval(
			() => void refresh().catch(() => undefined),
			1500,
		);
		return () => {
			window.clearTimeout(initial);
			window.clearInterval(interval);
		};
	}, [refresh]);
	const adopt = useCallback(
		(group: SyncplayGroup, announceNewMedia = false) => {
			if (
				announceNewMedia &&
				group.itemId &&
				group.itemId !== activeRef.current?.itemId
			)
				announcePlayback(group.itemId);
			setCurrent(group);
			setGroups((old) => [
				group,
				...old.filter((entry) => entry.id !== group.id),
			]);
		},
		[announcePlayback, setCurrent],
	);
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
		if (!group) return;
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
