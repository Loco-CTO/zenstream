"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import {
	playbackStreams,
	savedPlaybackPositionSeconds,
	type DetailData,
} from "@/lib/media-api";
import { getPlaybackInfo } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";
import { getLastNonPlayerPath } from "@/lib/player-navigation";

type TrackChoice = { audio?: number; subtitle?: number };

export function playbackTrackChoices(
	search: Pick<URLSearchParams, "get">,
): TrackChoice {
	const trackId = (name: string) => {
		const value = search.get(name);
		if (value == null || value.trim() === "") return undefined;
		const parsed = Number(value);
		return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
	};
	return { audio: trackId("audio"), subtitle: trackId("subtitle") };
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
	const [streams, setStreams] = useState<ReturnType<typeof playbackStreams>>();
	const [streamsItemId, setStreamsItemId] = useState<string>();
	const [selected, setSelected] = useState<{
		audio?: number;
		subtitle?: number;
	}>({});
	const playerItem =
		item.Type === "Episode" &&
		!item.SeriesName &&
		initialData.backgroundItem?.Name
			? { ...item, SeriesName: initialData.backgroundItem.Name }
			: item;
	const startPositionSeconds = savedPlaybackPositionSeconds(item);
	const requestedTracks = useMemo(
		() => playbackTrackChoices(searchParams),
		[searchParams],
	);

	useEffect(() => {
		let active = true;
		void getPlaybackInfo(session, item.Id, {
			startPositionSeconds,
			audioStreamId: requestedTracks.audio,
		})
			.then((playback) => {
				if (!active) return;
				const parsed = playbackStreams(playback);
				setStreams(parsed);
				setStreamsItemId(item.Id);
				setSelected({
					audio:
						requestedTracks.audio ??
						parsed.audio.find((track) => track.IsDefault)?.Index ??
						parsed.audio[0]?.Index,
					subtitle:
						requestedTracks.subtitle ??
						parsed.subtitles.find((track) => track.IsDefault)?.Index ??
						parsed.subtitles[0]?.Index,
				});
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [
		item.Id,
		requestedTracks.audio,
		requestedTracks.subtitle,
		session,
		startPositionSeconds,
	]);

	return (
		<VideoPlayer
			item={playerItem}
			session={session}
			// These are available as soon as the player mounts. Passing them here as
			// well as through the initial negotiation prevents the player's fallback
			// negotiation from briefly restoring the default tracks.
			initialAudioStreamId={requestedTracks.audio ?? selected.audio}
			initialSubtitleStreamIndex={requestedTracks.subtitle ?? selected.subtitle}
			// VideoPlayer treats initialStreams as authoritative. Ignore the previous
			// item's result until playback info for this item has arrived.
			initialStreams={streamsItemId === item.Id ? streams : undefined}
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
