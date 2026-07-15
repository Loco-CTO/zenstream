"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";

export function SyncplayPlaybackFollower({ session }: { session: AuthSession }) {
	const { active, setWatchingTogether } = useSyncplay();
	const pathname = usePathname() ?? "/";
	const router = useRouter();
	const requestedGenerationRef = useRef<string | null>(null);
	const viewedGenerationRef = useRef<string | null>(null);

	useEffect(() => {
		const itemId = active?.itemId;
		const member = active?.members.find((entry) => entry.userId === session.userId);
		if (!active || !itemId || !member || member.watchingTogether === false) {
			requestedGenerationRef.current = null;
			viewedGenerationRef.current = null;
			return;
		}
		const generationKey = `${active.id}:${active.mediaGeneration ?? 0}`;
		if (isViewingItem(pathname, itemId)) {
			requestedGenerationRef.current = null;
			viewedGenerationRef.current = generationKey;
			return;
		}
		if (viewedGenerationRef.current === generationKey) {
			viewedGenerationRef.current = null;
			void setWatchingTogether(false).catch(() => undefined);
			return;
		}
		if (requestedGenerationRef.current === generationKey) return;
		requestedGenerationRef.current = generationKey;
		router.push(playbackPath(itemId));
	}, [active, pathname, router, session.userId, setWatchingTogether]);

	return null;
}

export function playbackPath(itemId: string) {
	return `/play/${encodeURIComponent(itemId)}`;
}

function isViewingItem(pathname: string, itemId: string) {
	return pathname === playbackPath(itemId);
}
