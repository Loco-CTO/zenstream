"use client";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

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
type Context = {
	groups: SyncplayGroup[];
	active: SyncplayGroup | null;
	create: () => Promise<void>;
	join: (id: string) => Promise<void>;
	leave: () => Promise<void>;
	refresh: () => Promise<void>;
	setControls: (value: boolean) => Promise<void>;
	command: (value: {
		action: string;
		itemId?: string;
		position: number;
		playing: boolean;
	}) => Promise<void>;
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
	const r = await fetch(`/api/syncplay/${path}`, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
	});
	if (!r.ok)
		throw new SyncplayRequestError(
			(await r.json().catch(() => ({}))).message ?? "Syncplay request failed.",
			r.status,
		);
	return r.status === 204 ? null : r.json();
}
export function SyncplayProvider({
	userId,
	children,
}: {
	userId: string;
	children: ReactNode;
}) {
	const [groups, setGroups] = useState<SyncplayGroup[]>([]);
	const [active, setActive] = useState<SyncplayGroup | null>(null);
	const refresh = useCallback(async () => {
		const d = await call("groups");
		setGroups(d.groups);
		setActive((current) => {
			if (current) return d.groups.find((x: SyncplayGroup) => x.id === current.id) ?? null;
			return d.groups.find((x: SyncplayGroup) => x.members.some((member) => member.userId === userId)) ?? null;
		});
	}, [userId]);
	useEffect(() => {
		const initial = window.setTimeout(
			() => void refresh().catch(() => undefined),
			0,
		);
		const id = window.setInterval(
			() => void refresh().catch(() => undefined),
			1500,
		);
		return () => {
			window.clearTimeout(initial);
			window.clearInterval(id);
		};
	}, [refresh]);
	const adopt = (group: SyncplayGroup) => {
		setActive(group);
		setGroups((old) => [group, ...old.filter((x) => x.id !== group.id)]);
	};
	const create = async () => adopt(await call("groups", "POST"));
	const join = async (id: string) =>
		adopt(await call(`groups/${id}/join`, "POST"));
	const leave = async () => {
		if (!active) return;
		try {
			await call(`groups/${active.id}`, "DELETE");
		} catch (error) {
			// The group may have been ended or left from another client meanwhile.
			if (
				error instanceof SyncplayRequestError &&
				(error.status === 403 || error.status === 404)
			) {
				setActive(null);
				await refresh().catch(() => undefined);
				return;
			}
			throw error;
		}
		setActive(null);
		await refresh();
	};
	const setControls = async (value: boolean) => {
		if (active)
			adopt(
				await call(`groups/${active.id}`, "PATCH", {
					allowViewerControls: value,
				}),
			);
	};
	const command = async (value: {
		action: string;
		itemId?: string;
		position: number;
		playing: boolean;
	}) => {
		if (!active) return;
		const send = (revision: number) =>
			call(`groups/${active.id}/command`, "POST", {
				...value,
				revision,
			});
		try {
			adopt(await send(active.revision));
		} catch (error) {
			if (!(error instanceof SyncplayRequestError) || error.status !== 409)
				throw error;
			const latest = await call(`groups/${active.id}`);
			adopt(latest);
			adopt(await send(latest.revision));
		}
	};
	const presence = async (viewing: boolean, loading: boolean) => {
		if (active)
			adopt(
				await call(`groups/${active.id}/presence`, "POST", {
					viewing,
					loading,
				}),
			);
	};
	const value = useMemo(
		() => ({
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
				active && (active.hostUserId === userId || active.allowViewerControls),
			),
		}),
		[groups, active, userId, refresh],
	);
	return (
		<SyncplayContext.Provider value={value}>
			{children}
		</SyncplayContext.Provider>
	);
}
export function useSyncplay() {
	return useContext(SyncplayContext);
}
