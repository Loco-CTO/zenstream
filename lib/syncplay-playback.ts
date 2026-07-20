"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { getSeriesEpisodes, type JellyfinItem } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";

export function syncplayMediaStartCommand(itemId: string) {
	return { action: "media", itemId, position: 0, playing: true };
}

export async function resolvePlaybackTarget(
	session: AuthSession,
	item: JellyfinItem,
) {
	if (item.Type !== "Series") return item;
	const episodes = await getSeriesEpisodes(session, item.Id);
	const ordered = [...episodes].sort(
		(a, b) =>
			(a.ParentIndexNumber ?? 0) - (b.ParentIndexNumber ?? 0) ||
			(a.IndexNumber ?? 0) - (b.IndexNumber ?? 0),
	);
	return (
		ordered.find((episode) => !episode.UserData?.Played) ?? ordered[0] ?? null
	);
}

export function useSyncplayPlayback(session?: AuthSession) {
	const router = useRouter();
	const { active, canControl, command } = useSyncplay();
	const canStartPlayback = !active || canControl;

	const startPlayback = useCallback(
		async (item: JellyfinItem) => {
			if (!session || !canStartPlayback) return false;
			const target = await resolvePlaybackTarget(session, item);
			if (!target?.Id) return false;
			if (active) await command(syncplayMediaStartCommand(target.Id));
			router.push(`/play/${encodeURIComponent(target.Id)}`);
			return true;
		},
		[active, canStartPlayback, command, router, session],
	);

	return { active, canStartPlayback, startPlayback };
}
