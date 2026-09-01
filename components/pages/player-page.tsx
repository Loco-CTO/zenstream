"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import {
	playbackStreams,
	savedPlaybackPositionSeconds,
	getPlaybackSource,
	type DetailData,
} from "@/lib/media-api";
import { getPlaybackInfo } from "@/lib/media-api";
import {
	getPlaybackPreference,
	type PlaybackPreference,
} from "@/lib/preferences";
import {
	preferredSubtitleIndex,
	preferredTrackIndex,
} from "@/lib/playback-preferences";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";
import { getLastNonPlayerPath } from "@/lib/player-navigation";

type TrackChoice = { audio?: number; subtitle?: number | null };

const DEFAULT_PLAYBACK_PREFERENCE: PlaybackPreference = {
	audioLanguage: null,
	subtitleLanguage: null,
	audioLanguages: [],
	subtitleLanguages: [],
};

function logPlaybackPreferenceFallback(itemId: string, error: unknown) {
	if (typeof window === "undefined") return;
	console.warn("[Player] playback preference fallback", {
		itemId,
		reason:
			error instanceof Error ? `${error.name}: ${error.message}` : String(error),
		tracks: "default/first",
	});
}

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
	watchHistoryEnabled = true,
	watchHistoryLoaded = false,
}: {
	initialData: DetailData;
	session: AuthSession;
	watchHistoryEnabled?: boolean;
	watchHistoryLoaded?: boolean;
}) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { active, setWatchingTogether } = useSyncplay();
	const [item, setItem] = useState(initialData.item);
	const [streams, setStreams] = useState<ReturnType<typeof playbackStreams>>();
	const [streamsRequestKey, setStreamsRequestKey] = useState<string>();
	const [selected, setSelected] = useState<{
		audio?: number;
		subtitle?: number | null;
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
	const playbackRequestKey = `${item.Id}:${requestedTracks.audio ?? "auto"}:${
		requestedTracks.subtitle === null
			? "off"
			: (requestedTracks.subtitle ?? "auto")
	}`;

	useEffect(() => {
		let active = true;
		const playbackPreference = getPlaybackPreference(session).catch((error) => {
			if (active) logPlaybackPreferenceFallback(item.Id, error);
			return DEFAULT_PLAYBACK_PREFERENCE;
		});
		void Promise.all([getPlaybackSource(session, item.Id), playbackPreference])
			.then(([source, preference]) => {
				const sourceStreams = playbackStreams({ source });
				const preferredAudio =
					requestedTracks.audio ??
					preferredTrackIndex(sourceStreams.audio, preference.audioLanguage);
				const preferredSubtitle =
					requestedTracks.subtitle !== undefined
						? requestedTracks.subtitle
						: preferredSubtitleIndex(
								sourceStreams.subtitles,
								preference.subtitleLanguage,
							);
				if (active)
					setSelected({ audio: preferredAudio, subtitle: preferredSubtitle });
				return getPlaybackInfo(session, item.Id, {
					startPositionSeconds,
					audioStreamId: preferredAudio,
				}).then((playback) => ({ playback, preference }));
			})
			.then(({ playback, preference }) => {
				if (!active) return;
				const parsed = playbackStreams(playback);
				setStreams(parsed);
				setStreamsRequestKey(playbackRequestKey);
				setSelected({
					audio:
						requestedTracks.audio ??
						preferredTrackIndex(parsed.audio, preference.audioLanguage),
					subtitle:
						requestedTracks.subtitle !== undefined
							? requestedTracks.subtitle
							: preferredSubtitleIndex(parsed.subtitles, preference.subtitleLanguage),
				});
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [
		item.Id,
		playbackRequestKey,
		requestedTracks.audio,
		requestedTracks.subtitle,
		session,
		startPositionSeconds,
	]);

	return (
		<VideoPlayer
			key={item.Id}
			item={playerItem}
			session={session}
			watchHistoryEnabled={watchHistoryEnabled}
			watchHistoryLoaded={watchHistoryLoaded}
			// These are available as soon as the player mounts. Passing them here as
			// well as through the initial negotiation prevents the player's fallback
			// negotiation from briefly restoring the default tracks.
			initialAudioStreamId={
				requestedTracks.audio ??
				(streamsRequestKey === playbackRequestKey ? selected.audio : undefined)
			}
			initialSubtitleStreamIndex={
				requestedTracks.subtitle !== undefined
					? requestedTracks.subtitle
					: streamsRequestKey === playbackRequestKey
						? selected.subtitle
						: undefined
			}
			// PlayerPage owns the initial negotiation. Do not let VideoPlayer start
			// another request while the route-level streams are still arriving.
			deferPlaybackNegotiation
			// VideoPlayer treats initialStreams as authoritative. Ignore the previous
			// item's result until playback info for this item has arrived.
			initialStreams={
				streamsRequestKey === playbackRequestKey ? streams : undefined
			}
			onClose={() => {
				if (active) void setWatchingTogether(false).catch(() => undefined);
				router.replace(getLastNonPlayerPath());
			}}
			onNext={(next) => {
				if (active) return;
				setItem(next);
				router.replace(`/play/${encodeURIComponent(next.Id)}`);
			}}
			onPlayedChange={() => undefined}
		/>
	);
}
