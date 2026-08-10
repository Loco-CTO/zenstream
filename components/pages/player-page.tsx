"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import type { DetailData } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";
import { getLastNonPlayerPath } from "@/lib/player-navigation";

type TrackChoice = { audio?: number; subtitle?: number | null };

export function playbackTrackChoices(
	search: Pick<URLSearchParams, "get">,
): TrackChoice {
	const trackId = (name: string) => {
		const value = search.get(name);
		if (value == null || value.trim() === "") return undefined;
		const parsed = Number(value);
		return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
	};
	const subtitle = search.get("subtitle");
	return {
		audio: trackId("audio"),
		subtitle: subtitle === "off" ? null : trackId("subtitle"),
	};
}

export function PlayerPage({
	initialData,
	session,
}: {
	initialData: DetailData;
	session: AuthSession;
}) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { active, setWatchingTogether } = useSyncplay();
	const [item, setItem] = useState(initialData.item);
	const playerItem =
		item.Type === "Episode" &&
		!item.SeriesName &&
		initialData.backgroundItem?.Name
			? { ...item, SeriesName: initialData.backgroundItem.Name }
			: item;
	const requestedTracks = useMemo(
		() => playbackTrackChoices(searchParams),
		[searchParams],
	);

	return (
		<VideoPlayer
			item={playerItem}
			session={session}
			initialAudioStreamId={requestedTracks.audio}
			initialSubtitleStreamIndex={requestedTracks.subtitle}
			onClose={() => {
				if (active) void setWatchingTogether(false).catch(() => undefined);
				router.replace(getLastNonPlayerPath());
			}}
			onNext={(next) => {
				setItem(next);
				router.replace(`/play/${encodeURIComponent(next.Id)}`);
			}}
			onPlayedChange={() => undefined}
		/>
	);
}
