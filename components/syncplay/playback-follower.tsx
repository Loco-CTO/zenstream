"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchDetailData } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";

export function SyncplayPlaybackFollower({ session }: { session: AuthSession }) {
	const { active } = useSyncplay();
	const pathname = usePathname() ?? "/";
	const router = useRouter();
	const requestedItemRef = useRef<string | null>(null);

	useEffect(() => {
		if (!active?.playing && !active?.resumeWhenReady) requestedItemRef.current = null;
	}, [active?.playing, active?.resumeWhenReady]);

	useEffect(() => {
		const itemId = active?.playing || active?.resumeWhenReady ? active.itemId : null;
		if (!itemId || isViewingItem(pathname, itemId) || requestedItemRef.current === itemId)
			return;
		const targetItemId = itemId;
		requestedItemRef.current = targetItemId;
		let cancelled = false;
		void fetchDetailData(session, targetItemId)
			.then(({ item }) => {
				if (cancelled) return;
				const target = playbackPath(item.Id ?? targetItemId, item.Type, item.SeriesId);
				if (target !== pathname) router.push(target);
			})
			.catch(() => {
				if (!cancelled) requestedItemRef.current = null;
			});
		return () => {
			cancelled = true;
		};
	}, [active?.itemId, active?.playing, active?.resumeWhenReady, pathname, router, session]);

	return null;
}

export function playbackPath(itemId: string, itemType?: string, seriesId?: string) {
	if (itemType === "Episode" && seriesId)
		return `/show/${encodeURIComponent(seriesId)}/episode/${encodeURIComponent(itemId)}`;
	return `/show/${encodeURIComponent(itemId)}`;
}

function isViewingItem(pathname: string, itemId: string) {
	return pathname === `/show/${encodeURIComponent(itemId)}` || pathname.endsWith(`/episode/${encodeURIComponent(itemId)}`);
}
