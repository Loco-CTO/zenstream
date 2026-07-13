"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
	ArrowLeft,
	AudioLines,
	Captions,
	Check,
	ChevronLeft,
	FastForward,
	LoaderCircle,
	Maximize,
	Minimize,
	Pause,
	Play,
	Settings,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
} from "lucide-react";
import {
	getPlaybackInfo,
	getPlaybackMarkers,
	getEpisodes,
	getSeasons,
	landscapeImageUrl,
	getTrickplayInfo,
	playbackStreams,
	playbackUrl,
	preserveTrickplay,
	reportPlayback,
	setPlayed,
	subtitleUrl,
	trickplayPreview,
	type JellyfinItem,
	type PlaybackMarker,
} from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { useSubtitlePreferences } from "@/components/subtitle-preferences-provider";
import { SyncplayGroupMenu } from "@/components/syncplay/group-menu";
import {
	parseWebVttCues,
	SUBTITLE_FONT_STACKS,
	subtitleOuterShadow,
	type SubtitleCue,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";
import { useSyncplay, type SyncplayGroup } from "@/lib/syncplay";

type Props = {
	item: JellyfinItem;
	session: AuthSession;
	initialAudioStreamIndex?: number;
	initialSubtitleStreamIndex?: number;
	initialStreams?: ReturnType<typeof playbackStreams>;
	onClose: () => void;
	onNext?: (item: JellyfinItem) => void;
	onPlayedChange?: (played: boolean) => void;
};
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const HLS_TEXT_TRACK_CONFIG = {
	enableWebVTT: false,
	enableCEA708Captions: false,
	renderTextTracksNatively: false,
};
const playerDebug = (event: string, details?: unknown) => {
	if (typeof window === "undefined") return;
	console.debug(`[Player] ${event}`, details ?? "");
};

export function syncplayWaitingForMembers(
	state: SyncplayGroup | null,
	itemId: string,
) {
	if (!state || state.itemId !== itemId) return false;
	// An intentional pause is not a readiness barrier. A member can still have
	// a stale loading flag from the last playback transition, but that should
	// not obscure a paused player's controls with the loading indicator.
	const playbackState =
		state.playbackState ?? (state.playing ? "playing" : "paused");
	if (!state.resumeWhenReady && playbackState === "paused") return false;
	return (
		state.resumeWhenReady ||
		state.members.some(
			(member) =>
				!member.viewing ||
				member.loading ||
				(member.readyGeneration ?? -1) !== (state.mediaGeneration ?? -1),
		)
	);
}

export function advanceToNextEpisode(
	nextItem: JellyfinItem | null,
	onNext: Props["onNext"],
	onClose: Props["onClose"],
) {
	if (nextItem && onNext) {
		onNext(nextItem);
		return;
	}
	onClose();
}

export function nextEpisodeSyncplayCommand(item: JellyfinItem) {
	return { action: "media", itemId: item.Id, position: 0, playing: true };
}

export function syncplayTimelineTarget(state: SyncplayGroup, now: number) {
	const playbackState =
		state.playbackState ?? (state.playing ? "playing" : "paused");
	const startsAt = state.effectiveAt ?? state.updatedAt;
	const anchorAt = state.anchorServerTime ?? state.updatedAt;
	const shouldPlay = playbackState === "playing" && now >= startsAt;
	return {
		position:
			(state.anchorPosition ?? state.position) +
			(shouldPlay ? Math.max(0, now - anchorAt) : 0),
		shouldPlay,
		startsAt,
	};
}

export function syncplayStateWantsPlaying(
	state: SyncplayGroup | null,
	itemId: string,
) {
	return Boolean(
		state &&
		state.itemId === itemId &&
		(state.playing || state.playbackState === "playing"),
	);
}

export function syncplayMediaIsReady(
	video: Pick<HTMLMediaElement, "readyState">,
) {
	return video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA;
}

export function hasRenderedVideoFrame(
	video: Pick<HTMLVideoElement, "videoWidth" | "videoHeight">,
) {
	return video.videoWidth > 0 && video.videoHeight > 0;
}

export function syncplayInitialLoading(
	video: Pick<HTMLMediaElement, "readyState"> | null,
) {
	return !video || !syncplayMediaIsReady(video);
}

export function optimisticSeekTimelineTarget(
	position: number,
	playing: boolean,
	startedAt: number,
	now: number,
) {
	return {
		position: position + (playing ? Math.max(0, now - startedAt) : 0),
		shouldPlay: playing,
		startsAt: startedAt,
	};
}

export async function startSyncedMedia(
	video: Pick<HTMLMediaElement, "muted" | "play">,
	onMutedFallback: () => void,
	onBlocked: () => void,
) {
	playerDebug("play requested", { muted: video.muted });
	try {
		await video.play();
		playerDebug("play started", { muted: video.muted });
		return true;
	} catch (error) {
		playerDebug("play rejected", { muted: video.muted, error });
		if (!video.muted) {
			video.muted = true;
			onMutedFallback();
			try {
				await video.play();
				playerDebug("muted fallback play started");
				return true;
			} catch {
				// The stream is still not playable; use the readiness barrier below.
			}
		}
		onBlocked();
		playerDebug("play blocked; reporting buffering");
		return false;
	}
}

export function SkipMarkerActions({
	markers,
	currentTime,
	labelIntro,
	labelOutro,
	onSkip,
}: {
	markers: { intro?: PlaybackMarker; outro?: PlaybackMarker } | null;
	currentTime: number;
	labelIntro: string;
	labelOutro: string;
	onSkip: (marker: PlaybackMarker) => void;
}) {
	return (
		<div className="zenstream-player-skip-actions pointer-events-none absolute bottom-24 left-5 right-5 z-20 flex flex-wrap justify-end gap-2 md:bottom-28 md:left-10 md:right-10">
			{markers?.intro &&
				currentTime >= markers.intro.start &&
				currentTime < markers.intro.end && (
					<button
						aria-label={labelIntro}
						className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3 py-2 text-sm font-medium text-white/90 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/40 hover:bg-black/40 sm:px-6 sm:py-3 sm:text-base"
						onClick={() => {
							if (markers.intro) onSkip(markers.intro);
						}}
					>
						<FastForward className="h-5 w-5" />
						{labelIntro}
					</button>
				)}
			{markers?.outro &&
				currentTime >= markers.outro.start &&
				currentTime < markers.outro.end && (
					<button
						aria-label={labelOutro}
						className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3 py-2 text-sm font-medium text-white/90 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/40 hover:bg-black/40 sm:px-6 sm:py-3 sm:text-base"
						onClick={() => {
							if (markers.outro) onSkip(markers.outro);
						}}
					>
						<FastForward className="h-5 w-5" />
						{labelOutro}
					</button>
				)}
		</div>
	);
}

export function VideoPlayer({
	item,
	session,
	initialAudioStreamIndex,
	initialSubtitleStreamIndex,
	initialStreams,
	onClose,
	onNext,
	onPlayedChange,
}: Props) {
	const { t } = useI18n();
	const { style, refresh: refreshSubtitleStyle } = useSubtitlePreferences();
	const syncplay = useSyncplay();
	const applyingSyncRef = useRef(false);
	const suppressSyncPlayRef = useRef(false);
	const suppressSyncPauseRef = useRef(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const playerRef = useRef<HTMLDivElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const syncplayStateRef = useRef(syncplay.active);
	const syncplayApiRef = useRef({
		presence: syncplay.presence,
		serverNow: syncplay.serverNow,
	});
	const qualityRequestRef = useRef(0);
	const directPlayFallbackRef = useRef(false);
	const resumeTimeRef = useRef(0);
	const clearedPlayedRef = useRef(false);
	const advancingToNextRef = useRef(false);
	const suppressNextClickRef = useRef(false);
	const videoClickTimerRef = useRef<number | null>(null);
	const controlsTimerRef = useRef<number | undefined>(undefined);
	const bufferingTimerRef = useRef<number | undefined>(undefined);
	const videoFrameTimerRef = useRef<number | undefined>(undefined);
	const retryAfterBufferingRef = useRef(false);
	const bufferedRef = useRef(false);
	const appliedTimelineRef = useRef<string | null>(null);
	const seekPreviewRef = useRef<{ itemId: string; value: number } | null>(null);
	const optimisticSeekRef = useRef<{
		itemId: string;
		position: number;
		playing: boolean;
		startedAt: number;
		expiresAt: number;
	} | null>(null);
	const [url, setUrl] = useState<string | undefined>(() =>
		initialStreams?.source
			? playbackUrl(session, item.Id, initialStreams.source, 0)
			: undefined,
	);
	const [info, setInfo] = useState<
		ReturnType<typeof playbackStreams> | undefined
	>(initialStreams);
	const [markers, setMarkers] = useState<{
		intro?: PlaybackMarker;
		outro?: PlaybackMarker;
	} | null>(null);
	const [settingsSection, setSettingsSection] = useState<
		"root" | "quality" | "speed" | "offset"
	>("root");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [trackMenu, setTrackMenu] = useState<"audio" | "subtitle" | null>(null);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [volume, setVolume] = useState(1);
	const [speed, setSpeed] = useState("1");
	const [quality, setQuality] = useState("0");
	const [audio, setAudio] = useState(
		initialAudioStreamIndex == null ? "" : String(initialAudioStreamIndex),
	);
	const [subtitle, setSubtitle] = useState(
		initialSubtitleStreamIndex == null
			? ""
			: String(initialSubtitleStreamIndex),
	);
	const [subtitleCueData, setSubtitleCueData] = useState<{
		track: string;
		cues: SubtitleCue[];
	}>();
	const [offset, setOffset] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState("");
	const [qualityLoading, setQualityLoading] = useState(false);
	const [buffering, setBuffering] = useState(true);
	const [controlsVisible, setControlsVisible] = useState(true);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [timelinePreview, setTimelinePreview] = useState<
		ReturnType<typeof trickplayPreview> & { time: number; left: number }
	>();
	const [seekPreview, setSeekPreview] = useState<{
		itemId: string;
		value: number;
	} | null>(null);
	const [previewUnavailable, setPreviewUnavailable] = useState(false);
	const [nextItem, setNextItem] = useState<JellyfinItem | null>(null);
	const [nextChecked, setNextChecked] = useState(false);
	const knownDuration = item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 : 0;
	const nextUpVisible =
		item.Type === "Episode" &&
		nextChecked &&
		duration > 0 &&
		duration - currentTime <= 10 &&
		Boolean(nextItem);

	useEffect(() => {
		syncplayStateRef.current = syncplay.active;
	}, [syncplay.active]);
	useEffect(() => {
		syncplayApiRef.current = {
			presence: syncplay.presence,
			serverNow: syncplay.serverNow,
		};
	}, [syncplay.presence, syncplay.serverNow]);
	useEffect(() => {
		directPlayFallbackRef.current = false;
		advancingToNextRef.current = false;
	}, [item.Id]);

	useEffect(() => {
		let active = true;
		Promise.resolve().then(() => {
			if (active) {
				setNextItem(null);
				setNextChecked(false);
			}
		});
		if (
			item.Type !== "Episode" ||
			!item.SeriesId ||
			item.IndexNumber == null ||
			item.ParentIndexNumber == null
		) {
			Promise.resolve().then(() => active && setNextChecked(true));
			return;
		}
		const seriesId = item.SeriesId;
		void (async () => {
			try {
				const seasons = await getSeasons(session, seriesId);
				const current = seasons.find(
					(season) => season.IndexNumber === item.ParentIndexNumber,
				);
				let episodes = current?.Id
					? await getEpisodes(session, seriesId, current.Id)
					: [];
				let next = episodes
					.filter((episode) => (episode.IndexNumber ?? 0) > item.IndexNumber!)
					.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0))[0];
				if (!next) {
					const season = seasons
						.filter(
							(entry) => (entry.IndexNumber ?? 0) > item.ParentIndexNumber!,
						)
						.sort((a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0))[0];
					if (season?.Id) {
						episodes = await getEpisodes(session, seriesId, season.Id);
						next = episodes.sort(
							(a, b) => (a.IndexNumber ?? 0) - (b.IndexNumber ?? 0),
						)[0];
					}
				}
				if (active) setNextItem(next ?? null);
			} catch {
				/* optional */
			}
			if (active) setNextChecked(true);
		})();
		return () => {
			active = false;
		};
	}, [
		item.Id,
		item.Type,
		item.SeriesId,
		item.IndexNumber,
		item.ParentIndexNumber,
		session,
	]);

	const playNext = useCallback(async () => {
		const target = nextItem;
		if (advancingToNextRef.current) return;
		if (target && syncplay.active) {
			if (!syncplay.canControl) return;
			advancingToNextRef.current = true;
			// Move this player immediately. Waiting for the Syncplay round trip here
			// leaves every member on the old media's readiness barrier while the
			// command is in flight. The command remains authoritative for the group;
			// remote members will navigate from the resulting media state.
			setNextItem(null);
			setNextChecked(false);
			setCurrentTime(0);
			setDuration(0);
			setUrl(undefined);
			advanceToNextEpisode(target, onNext, onClose);
			void syncplay.command(nextEpisodeSyncplayCommand(target)).catch(() => {
				// The local transition is still useful if the request is delayed or
				// fails; the next group snapshot will reconcile the other members.
			});
			return;
		}
		advancingToNextRef.current = true;
		setNextItem(null);
		setNextChecked(false);
		setCurrentTime(0);
		setDuration(0);
		setUrl(undefined);
		advanceToNextEpisode(target, onNext, onClose);
	}, [
		nextItem,
		onClose,
		onNext,
		syncplay.active,
		syncplay.canControl,
		syncplay.command,
	]);

	useEffect(() => {
		void refreshSubtitleStyle();
	}, [refreshSubtitleStyle]);

	useEffect(() => {
		let active = true;
		const streams = initialStreams
			? Promise.resolve(initialStreams)
			: getPlaybackInfo(session, item.Id, {
					audioStreamIndex: initialAudioStreamIndex,
					// Keep subtitles out of the media pipeline; the selected track is
					// fetched as VTT and rendered by CustomSubtitleCue below.
					subtitleStreamIndex: -1,
				}).then((playback) => playbackStreams(playback));
		Promise.all([
			streams,
			getPlaybackMarkers(session, item.Id),
			getTrickplayInfo(session, item.Id).catch(() => undefined),
		])
			.then(([parsed, markerData, trickplay]) => {
				if (!active) return;
				const source =
					parsed.source && !parsed.source.Trickplay && trickplay
						? {
								...parsed.source,
								Trickplay: trickplay[parsed.source.Id ?? ""],
							}
						: parsed.source;
				const next = { ...parsed, source };
				setInfo(next);
				setUrl(playbackUrl(session, item.Id, source, 0));
				setMarkers(markerData);
				const initialAudio =
					initialAudioStreamIndex == null
						? (next.audio.find((track) => track.IsDefault) ?? next.audio[0])
						: next.audio.find(
								(track) => track.Index === initialAudioStreamIndex,
							);
				if (initialAudio?.Index != null) setAudio(String(initialAudio.Index));
			})
			.catch(() => active && setError("Playback could not be loaded."));
		return () => {
			active = false;
		};
	}, [
		item.Id,
		session,
		initialAudioStreamIndex,
		initialSubtitleStreamIndex,
		initialStreams,
	]);
	useEffect(() => {
		const state = syncplay.active;
		if (!state || state.itemId !== item.Id) return;
		const generation = state.mediaGeneration ?? 0;
		// A client can join after the media element already emitted `canplay`.
		// In that case there may be no future event to clear the loading flag, so
		// inspect the current readyState when entering the readiness barrier.
		const video = videoRef.current;
		const loading = syncplayInitialLoading(video);
		// Keep this in the same meaning as reportBuffering(): it stores the last
		// loading state sent to the server, not whether the video is buffered.
		// Otherwise a later canplay event can be incorrectly deduplicated.
		bufferedRef.current = loading;
		void syncplayApiRef.current
			.presence(true, loading, generation)
			.catch(() => undefined);
		return () => {
			void syncplayApiRef.current
				.presence(false, false, generation)
				.catch(() => undefined);
		};
	}, [
		syncplay.active?.id,
		syncplay.active?.itemId,
		syncplay.active?.mediaGeneration,
		item.Id,
	]);
	useEffect(() => {
		const state = syncplay.active;
		const video = videoRef.current;
		if (!state || !video || state.itemId !== item.Id) return;
		const timelineKey = `${state.mediaGeneration ?? 0}:${state.timelineRevision ?? state.revision}`;
		let forceSeek = appliedTimelineRef.current !== timelineKey;
		appliedTimelineRef.current = timelineKey;
		if (forceSeek) optimisticSeekRef.current = null;
		const apply = () => {
			const now = syncplay.serverNow();
			const pendingSeek = optimisticSeekRef.current;
			const timeline =
				pendingSeek &&
				pendingSeek.itemId === item.Id &&
				Date.now() < pendingSeek.expiresAt
					? optimisticSeekTimelineTarget(
							pendingSeek.position,
							pendingSeek.playing,
							pendingSeek.startedAt,
							now,
						)
					: syncplayTimelineTarget(state, now);
			const error = video.currentTime - timeline.position;
			applyingSyncRef.current = true;
			if (forceSeek || Math.abs(error) > 2)
				video.currentTime = timeline.position;
			else if (Math.abs(error) <= 0.25) video.playbackRate = 1;
			else video.playbackRate = Math.max(0.95, Math.min(1.05, 1 - error / 12));
			if (timeline.shouldPlay && video.paused) startSyncedPlayback(video);
			if (!timeline.shouldPlay && !video.paused) {
				suppressSyncPauseRef.current = true;
				video.pause();
				video.playbackRate = 1;
			}
			window.setTimeout(() => {
				applyingSyncRef.current = false;
			}, 0);
			forceSeek = false;
		};
		apply();
		const interval = window.setInterval(apply, 1000);
		const startsAt = state.effectiveAt ?? state.updatedAt;
		const startDelay = Math.max(0, (startsAt - syncplay.serverNow()) * 1000);
		const startTimer = window.setTimeout(apply, startDelay + 20);
		return () => {
			window.clearInterval(interval);
			window.clearTimeout(startTimer);
			video.playbackRate = 1;
		};
	}, [
		syncplay.active?.timelineRevision,
		syncplay.active?.mediaGeneration,
		syncplay.active?.itemId,
		item.Id,
		syncplay.serverNow,
	]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !url) return;
		setBuffering(true);
		hlsRef.current?.destroy();
		hlsRef.current = null;
		if (/\.m3u8(?:\?|$)/i.test(url) && Hls.isSupported()) {
			const hls = new Hls(HLS_TEXT_TRACK_CONFIG);
			hlsRef.current = hls;
			hls.loadSource(url);
			hls.attachMedia(video);
		} else {
			video.src = url;
			video.load();
		}
		const position = item.UserData?.PlaybackPositionTicks
			? item.UserData.PlaybackPositionTicks / 10_000_000
			: 0;
		const onMetadata = () => {
			disableNativeSubtitleTracks(video);
			// A quality/track switch can resolve through the Syncplay path too;
			// clear the transient overlay before any early return below.
			setQualityLoading(false);
			const groupState = syncplayStateRef.current;
			const syncplayApi = syncplayApiRef.current;
			if (groupState?.itemId === item.Id) {
				const timeline = syncplayTimelineTarget(
					groupState,
					syncplayApi.serverNow(),
				);
				applyingSyncRef.current = true;
				if (
					Number.isFinite(timeline.position) &&
					timeline.position < video.duration
				)
					video.currentTime = timeline.position;
				if (timeline.shouldPlay) startSyncedPlayback(video);
				else if (!video.paused) {
					suppressSyncPauseRef.current = true;
					video.pause();
				}
				window.setTimeout(() => {
					applyingSyncRef.current = false;
				}, 0);
				return;
			}
			if (groupState) return;
			const resumeTime = resumeTimeRef.current || position;
			if (resumeTime > 0 && resumeTime < video.duration - 5)
				video.currentTime = resumeTime;
			resumeTimeRef.current = 0;
			const mediaDuration = Number.isFinite(video.duration)
				? video.duration
				: 0;
			setDuration(Math.max(knownDuration, mediaDuration));
			void video.play().catch(() => undefined);
		};
		const onTextTrackAdded = () => disableNativeSubtitleTracks(video);
		video.addEventListener("loadedmetadata", onMetadata, { once: true });
		video.textTracks.addEventListener("addtrack", onTextTrackAdded);
		return () => {
			video.removeEventListener("loadedmetadata", onMetadata);
			video.textTracks.removeEventListener("addtrack", onTextTrackAdded);
			hlsRef.current?.destroy();
			hlsRef.current = null;
		};
	}, [url, item.UserData?.PlaybackPositionTicks, knownDuration]);

	useEffect(() => {
		if (videoRef.current) videoRef.current.volume = volume;
	}, [volume]);

	useEffect(() => {
		if (!subtitle || !info?.source) {
			return;
		}
		const controller = new AbortController();
		const url = subtitleUrl(session, item.Id, info.source, Number(subtitle));
		void fetch(url, { cache: "no-store", signal: controller.signal })
			.then(async (response) => {
				if (!response.ok) throw new Error("Subtitle request failed.");
				const text = await response.text();
				if (!controller.signal.aborted)
					setSubtitleCueData({ track: subtitle, cues: parseWebVttCues(text) });
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setSubtitleCueData({ track: subtitle, cues: [] });
				}
			});
		return () => controller.abort();
	}, [info?.source, item.Id, session, subtitle]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			const video = videoRef.current;
			if (video && video.currentTime > 0)
				void reportPlayback(
					session,
					item.Id,
					video.currentTime,
					video.paused,
				).catch(() => undefined);
		}, 10_000);
		return () => window.clearInterval(timer);
	}, [item.Id, session]);

	useEffect(() => {
		if (!settingsOpen && !trackMenu) return;
		const closeMenus = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (
				target?.closest("[data-player-context], [data-player-context-trigger]")
			)
				return;
			suppressNextClickRef.current = true;
			setSettingsOpen(false);
			setTrackMenu(null);
		};
		document.addEventListener("pointerdown", closeMenus);
		return () => document.removeEventListener("pointerdown", closeMenus);
	}, [settingsOpen, trackMenu]);

	useEffect(
		() => () => {
			if (controlsTimerRef.current)
				window.clearTimeout(controlsTimerRef.current);
			if (bufferingTimerRef.current)
				window.clearTimeout(bufferingTimerRef.current);
			if (videoFrameTimerRef.current)
				window.clearTimeout(videoFrameTimerRef.current);
			if (videoClickTimerRef.current)
				window.clearTimeout(videoClickTimerRef.current);
		},
		[],
	);

	useEffect(() => {
		const { documentElement, body } = document;
		const previousDocumentOverflow = documentElement.style.overflow;
		const previousBodyOverflow = body.style.overflow;
		documentElement.style.overflow = "hidden";
		body.style.overflow = "hidden";

		return () => {
			documentElement.style.overflow = previousDocumentOverflow;
			body.style.overflow = previousBodyOverflow;
		};
	}, []);

	useEffect(() => {
		const syncFullscreenState = () =>
			setIsFullscreen(document.fullscreenElement === playerRef.current);
		document.addEventListener("fullscreenchange", syncFullscreenState);
		syncFullscreenState();
		return () => {
			document.removeEventListener("fullscreenchange", syncFullscreenState);
			if (document.fullscreenElement === playerRef.current)
				exitFullscreenSafely();
		};
	}, []);

	function showControls() {
		setControlsVisible(true);
		if (controlsTimerRef.current) window.clearTimeout(controlsTimerRef.current);
		controlsTimerRef.current = window.setTimeout(() => {
			if (!settingsOpen && !trackMenu) setControlsVisible(false);
		}, 2500);
	}
	function reportBuffering(loading: boolean) {
		const state = syncplayStateRef.current;
		if (!state || state.itemId !== item.Id || bufferedRef.current === loading)
			return;
		playerDebug("buffering changed", {
			loading,
			groupId: state.id,
			itemId: item.Id,
			generation: state.mediaGeneration,
		});
		if (bufferingTimerRef.current)
			window.clearTimeout(bufferingTimerRef.current);
		bufferingTimerRef.current = window.setTimeout(
			() => {
				const current = syncplayStateRef.current;
				if (!current || current.itemId !== item.Id) return;
				bufferedRef.current = loading;
				void syncplayApiRef.current
					.presence(true, loading, current.mediaGeneration ?? 0)
					.catch(() => undefined);
			},
			loading ? 750 : 300,
		);
	}
	function startSyncedPlayback(video: HTMLVideoElement) {
		playerDebug("sync timeline requested playback", {
			currentTime: video.currentTime,
			readyState: video.readyState,
			networkState: video.networkState,
		});
		suppressSyncPlayRef.current = true;
		void startSyncedMedia(
			video,
			() => setMuted(true),
			() => {
				// A rejected play() means this member is not ready, even if the
				// media element previously emitted canplay. Clear the optimistic
				// readiness flag so the barrier receives the loading transition.
				bufferedRef.current = false;
				reportBuffering(true);
			},
		).then((started) => {
			if (!started) suppressSyncPlayRef.current = false;
		});
	}
	function scheduleVideoFrameCheck() {
		if (videoFrameTimerRef.current)
			window.clearTimeout(videoFrameTimerRef.current);
		videoFrameTimerRef.current = window.setTimeout(() => {
			videoFrameTimerRef.current = undefined;
			const video = videoRef.current;
			if (
				!video ||
				video.paused ||
				video.readyState < HTMLMediaElement.HAVE_METADATA ||
				hasRenderedVideoFrame(video)
			)
				return;
			// Mobile browsers may emit play/playing and continue the audio track
			// without raising a media error when the video codec is unsupported.
			playerDebug("playback has audio but no rendered video frame", {
				readyState: video.readyState,
				networkState: video.networkState,
			});
			handleVideoError(true);
		}, 3000);
	}

	function togglePlay() {
		const video = videoRef.current;
		if (!video || (syncplay.active && !syncplay.canControl)) return;
		playerDebug("toggle play", {
			paused: video?.paused,
			currentTime: video?.currentTime,
			canControl: syncplay.canControl,
			groupId: syncplay.active?.id,
		});
		if (syncplay.active) {
			void syncplay
				.command({
					action: video.paused ? "play" : "pause",
					itemId: item.Id,
					position: video.currentTime,
					playing: video.paused,
				})
				.catch(() => undefined);
			return;
		}
		if (video.paused) void video.play().catch(() => undefined);
		else video.pause();
	}
	function toggleFullscreen() {
		if (videoClickTimerRef.current) {
			window.clearTimeout(videoClickTimerRef.current);
			videoClickTimerRef.current = null;
		}
		if (document.fullscreenElement) {
			exitFullscreenSafely();
		} else {
			void playerRef.current?.requestFullscreen?.();
		}
	}
	function handleVideoClick() {
		if (videoClickTimerRef.current)
			window.clearTimeout(videoClickTimerRef.current);
		videoClickTimerRef.current = window.setTimeout(() => {
			videoClickTimerRef.current = null;
			togglePlay();
		}, 250);
	}
	function handlePlay() {
		setPlaying(true);
		if (!item.UserData?.Played || clearedPlayedRef.current) return;
		clearedPlayedRef.current = true;
		void setPlayed(session, item.Id, false)
			.then(() => onPlayedChange?.(false))
			.catch(() => {
				clearedPlayedRef.current = false;
			});
	}
	function seek(delta: number) {
		const video = videoRef.current;
		if (!video) return;
		const target = Math.max(
			0,
			Math.min(duration || Infinity, currentTime + delta),
		);
		stageSeek(target);
		commitPendingSeek();
	}
	function stageSeek(target: number) {
		const video = videoRef.current;
		if (!video) return;
		if (syncplay.active) {
			if (syncplay.canControl) {
				const preview = { itemId: item.Id, value: target };
				seekPreviewRef.current = preview;
				setSeekPreview(preview);
			}
			return;
		}
		video.currentTime = target;
		setCurrentTime(target);
	}
	function commitPendingSeek() {
		const pending = seekPreviewRef.current;
		const video = videoRef.current;
		if (
			!pending ||
			pending.itemId !== item.Id ||
			!video ||
			!syncplay.active ||
			!syncplay.canControl
		)
			return;
		const target = pending.value;
		seekPreviewRef.current = null;
		setSeekPreview(null);
		// Let the person who moved the slider see the seek immediately. The group
		// command remains authoritative and will correct other members (or this
		// player after a rejected command), but waiting for a network round trip
		// makes the control feel broken.
		const optimistic = {
			itemId: item.Id,
			position: target,
			playing: !video.paused,
			startedAt: syncplay.serverNow(),
			expiresAt: Date.now() + 8_000,
		};
		optimisticSeekRef.current = optimistic;
		video.currentTime = target;
		setCurrentTime(target);
		void syncplay
			.command({
				action: "seek",
				itemId: item.Id,
				position: target,
				playing: !video.paused,
			})
			.catch(() => {
				if (optimisticSeekRef.current === optimistic)
					optimisticSeekRef.current = null;
			});
	}
	function chooseQuality(value: string) {
		const video = videoRef.current;
		resumeTimeRef.current =
			video && Number.isFinite(video.currentTime)
				? video.currentTime
				: currentTime;
		setError("");
		setQualityLoading(true);
		setDuration(knownDuration);
		setQuality(value);
		const bitrate = Number(value);
		if (!bitrate) {
			qualityRequestRef.current += 1;
			setUrl(playbackUrl(session, item.Id, info?.source, 0));
			return;
		}
		const request = ++qualityRequestRef.current;
		void getPlaybackInfo(session, item.Id, {
			maxStreamingBitrate: bitrate,
			mediaSourceId: info?.source?.Id,
			audioStreamIndex: audio ? Number(audio) : undefined,
			// Subtitles are rendered by the custom VTT overlay; never ask Jellyfin
			// to encode them into the video stream.
			subtitleStreamIndex: -1,
		})
			.then((playback) => {
				if (request !== qualityRequestRef.current) return;
				const parsed = playbackStreams(playback);
				if (!parsed.source?.TranscodingUrl)
					throw new Error("Jellyfin did not return a transcoding URL.");
				const source = preserveTrickplay(parsed.source, info?.source);
				setInfo((previous) => ({
					...parsed,
					source,
					qualities: previous?.qualities ?? parsed.qualities,
				}));
				setUrl(playbackUrl(session, item.Id, source, bitrate));
			})
			.catch(() => {
				if (request === qualityRequestRef.current) {
					setQualityLoading(false);
					setError("This quality could not be loaded.");
				}
			});
	}
	function chooseTrack(kind: "audio" | "subtitle", value: string) {
		if (kind === "subtitle") {
			setSubtitle(value);
			setSubtitleCueData(undefined);
			setTrackMenu(null);
			return;
		}
		const video = videoRef.current;
		const position =
			video && Number.isFinite(video.currentTime)
				? video.currentTime
				: currentTime;
		const nextAudio = value;
		setAudio(value);
		if (!info?.source) return;
		const request = ++qualityRequestRef.current;
		resumeTimeRef.current = position;
		setQualityLoading(true);
		setError("");
		void getPlaybackInfo(session, item.Id, {
			mediaSourceId: info.source.Id,
			audioStreamIndex: nextAudio ? Number(nextAudio) : undefined,
			subtitleStreamIndex: -1,
		})
			.then((playback) => {
				if (request !== qualityRequestRef.current) return;
				const parsed = playbackStreams(playback);
				const source = preserveTrickplay(parsed.source, info.source);
				if (!source) throw new Error("Jellyfin did not return a media source.");
				setInfo((previous) => ({
					...parsed,
					source,
					qualities: previous?.qualities ?? parsed.qualities,
				}));
				setUrl(
					playbackUrl(
						session,
						item.Id,
						source,
						source.TranscodingUrl ? 1_000_000 : 0,
					),
				);
				setTrackMenu(null);
			})
			.catch(() => {
				if (request === qualityRequestRef.current) {
					setQualityLoading(false);
					setError("This track could not be loaded.");
				}
			});
	}
	function skip(marker?: PlaybackMarker) {
		if (!marker) return;
		stageSeek(marker.end);
		commitPendingSeek();
	}
	function handleVideoError(forceTranscode = false) {
		const video = videoRef.current;
		if (!video || directPlayFallbackRef.current || !info?.source) {
			setError("This media could not be played.");
			return;
		}
		const errorCode = video.error?.code;
		if (
			!forceTranscode &&
			errorCode !== MediaError.MEDIA_ERR_DECODE &&
			errorCode !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
		) {
			setError("This media could not be played.");
			return;
		}
		directPlayFallbackRef.current = true;
		setError("");
		setQualityLoading(true);
		void getPlaybackInfo(session, item.Id, {
			mediaSourceId: info.source.Id,
			audioStreamIndex: audio ? Number(audio) : undefined,
			subtitleStreamIndex: -1,
		})
			.then((playback) => {
				const parsed = playbackStreams(playback);
				if (!parsed.source?.TranscodingUrl)
					throw new Error("Jellyfin did not return a transcoding URL.");
				const source = preserveTrickplay(parsed.source, info.source);
				setInfo((previous) => ({
					...parsed,
					source,
					qualities: previous?.qualities ?? parsed.qualities,
				}));
				setQuality("1");
				setUrl(playbackUrl(session, item.Id, source, 1_000_000));
			})
			.catch(() => {
				setQualityLoading(false);
				setError("This media could not be played.");
			});
	}
	function previewTimeline(event: React.PointerEvent<HTMLInputElement>) {
		if (!duration) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const left = Math.max(
			0,
			Math.min(1, (event.clientX - rect.left) / rect.width),
		);
		const time = left * duration;
		const preview = trickplayPreview(session, item.Id, info?.source, time);
		if (preview) {
			setPreviewUnavailable(false);
			setTimelinePreview({ time, left, ...preview });
		} else {
			setTimelinePreview(undefined);
			setPreviewUnavailable(Boolean(info));
		}
	}

	return (
		<div
			ref={playerRef}
			className={`fixed inset-0 z-[200] h-[100dvh] overflow-hidden bg-black text-white ${controlsVisible ? "cursor-default" : "cursor-none"}`}
			onPointerMove={showControls}
			onPointerDown={showControls}
			onClickCapture={(event) => {
				if (!suppressNextClickRef.current) return;
				suppressNextClickRef.current = false;
				event.preventDefault();
				event.stopPropagation();
			}}
			onKeyDown={(event) => {
				showControls();
				if (event.target !== event.currentTarget) return;
				if (event.key === " ") {
					event.preventDefault();
					togglePlay();
				}
				if (event.key === "ArrowLeft") seek(-10);
				if (event.key === "ArrowRight") seek(10);
			}}
			tabIndex={0}
		>
			<video
				ref={videoRef}
				className="zenstream-video h-full w-full object-contain"
				playsInline
				preload="auto"
				onClick={handleVideoClick}
				onDoubleClick={toggleFullscreen}
				muted={muted}
				onLoadedMetadata={() => {
					const value = videoRef.current?.duration ?? 0;
					setDuration(
						Math.max(knownDuration, Number.isFinite(value) ? value : 0),
					);
				}}
				onWaiting={() => {
					setBuffering(true);
					retryAfterBufferingRef.current = true;
					playerDebug("video waiting", {
						currentTime: videoRef.current?.currentTime,
						readyState: videoRef.current?.readyState,
					});
					reportBuffering(true);
				}}
				onCanPlay={() => {
					setBuffering(false);
					const shouldRetry = retryAfterBufferingRef.current;
					retryAfterBufferingRef.current = false;
					playerDebug("video canplay", {
						currentTime: videoRef.current?.currentTime,
						readyState: videoRef.current?.readyState,
					});
					reportBuffering(false);
					const video = videoRef.current;
					if (
						shouldRetry &&
						video?.paused &&
						syncplayStateWantsPlaying(syncplayStateRef.current, item.Id)
					)
						startSyncedPlayback(video);
				}}
				onPlaying={scheduleVideoFrameCheck}
				onDurationChange={() => {
					const value = videoRef.current?.duration ?? 0;
					if (Number.isFinite(value) && value > 0)
						setDuration(Math.max(knownDuration, value));
				}}
				onTimeUpdate={() => {
					const value = videoRef.current?.currentTime ?? 0;
					setCurrentTime(
						Number.isFinite(value) ? Math.min(value, duration || value) : 0,
					);
				}}
				onEnded={() => {
					if (nextChecked && nextItem) void playNext();
					else onClose();
				}}
				onPlay={(e) => {
					const syncState = syncplayStateRef.current;
					const syncWantsPlaying = Boolean(
						syncState?.playing || syncState?.playbackState === "playing",
					);
					playerDebug("video play event", {
						currentTime: e.currentTarget.currentTime,
						suppressed: suppressSyncPlayRef.current,
						applying: applyingSyncRef.current,
						authoritativePlaying: syncWantsPlaying,
						canControl: syncplay.canControl,
					});
					handlePlay();
					if (suppressSyncPlayRef.current) {
						suppressSyncPlayRef.current = false;
						return;
					}
					if (
						syncplay.active &&
						!applyingSyncRef.current &&
						!syncWantsPlaying &&
						syncplay.canControl
					)
						void syncplay
							.command({
								action: "play",
								itemId: item.Id,
								position: e.currentTarget.currentTime,
								playing: true,
							})
							.catch(() => undefined);
				}}
				onPause={(e) => {
					const syncState = syncplayStateRef.current;
					const syncWantsPlaying = Boolean(
						syncState?.playing || syncState?.playbackState === "playing",
					);
					playerDebug("video pause event", {
						currentTime: e.currentTarget.currentTime,
						suppressed: suppressSyncPauseRef.current,
						applying: applyingSyncRef.current,
						authoritativePlaying: syncWantsPlaying,
						canControl: syncplay.canControl,
					});
					setPlaying(false);
					if (suppressSyncPauseRef.current) {
						suppressSyncPauseRef.current = false;
						return;
					}
					if (
						syncplay.active &&
						!applyingSyncRef.current &&
						syncWantsPlaying &&
						syncplay.canControl
					)
						void syncplay
							.command({
								action: "pause",
								itemId: item.Id,
								position: e.currentTarget.currentTime,
								playing: false,
							})
							.catch(() => undefined);
				}}
				onError={() => {
					setBuffering(false);
					handleVideoError();
				}}
			></video>
			{subtitle && subtitleCueData?.track === subtitle && (
				<CustomSubtitleCue
					cues={subtitleCueData.cues}
					time={currentTime + offset}
					style={style}
				/>
			)}
			<div
				className={`pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85 transition-opacity duration-300 ${controlsVisible || settingsOpen || trackMenu ? "opacity-100" : "opacity-0"}`}
			/>
			<div
				className={`absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex max-w-[calc(100%-4.5rem)] items-start gap-2 transition-opacity duration-300 sm:left-5 sm:top-5 sm:gap-3 md:left-10 md:top-8 ${controlsVisible || settingsOpen || trackMenu ? "opacity-100" : "pointer-events-none opacity-0"}`}
			>
				<button
					aria-label="Close player"
					className="pointer-events-auto rounded-full bg-black/30 p-2 text-white/70 hover:text-white"
					onClick={onClose}
				>
					<ArrowLeft />
				</button>
				<div className="min-w-0">
					<p className="truncate text-xs uppercase tracking-[.16em] text-white/55 sm:tracking-[.2em]">
						{item.Type === "Episode"
							? `${item.SeriesName ?? "Series"} · S${item.ParentIndexNumber ?? 0}:E${item.IndexNumber ?? 0}`
							: item.Name}
					</p>
					{item.Type === "Episode" && (
						<h1 className="mt-1 line-clamp-2 text-base font-semibold sm:text-lg">{item.Name}</h1>
					)}
				</div>
			</div>
			<div
				className={`absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] transition-opacity duration-300 sm:right-5 sm:top-5 md:right-10 md:top-8 ${controlsVisible || settingsOpen || trackMenu ? "opacity-100" : "pointer-events-none opacity-0"}`}
			>
				<SyncplayGroupMenu
					userId={session.userId}
					playerContext
					buttonClassName="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white/70 transition hover:bg-black/50 hover:text-white"
				/>
			</div>
			{qualityLoading && (
				<div
					role="status"
					aria-live="polite"
					className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-full bg-black/70 px-5 py-3 text-sm text-white/90 shadow-xl backdrop-blur-md"
				>
					<LoaderCircle className="h-5 w-5 animate-spin text-violet-300" />
					{t("switchingQuality")}
				</div>
			)}
			{(buffering || syncplayWaitingForMembers(syncplay.active, item.Id)) && (
				<div
					data-testid="player-loading"
					className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 p-4 shadow-xl backdrop-blur-md"
					role="status"
					aria-label="Loading"
				>
					<LoaderCircle className="h-8 w-8 animate-spin text-white/85 drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]" />
				</div>
			)}
			{error && (
				<p
					role="alert"
					className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded bg-black/70 px-4 py-3 text-sm text-red-200"
				>
					{error}
				</p>
			)}
			<SkipMarkerActions
				markers={markers}
				currentTime={currentTime}
				labelIntro={t("skipIntro")}
				labelOutro={t("skipOutro")}
				onSkip={skip}
			/>
			{nextUpVisible && nextItem && (
				<div
					data-testid="next-up"
					className="zenstream-player-next-up absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-30 w-[min(calc(100vw-1.5rem),380px)] overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:right-4 md:bottom-28 md:right-10"
				>
					<div className="h-1 bg-gradient-to-r from-violet-400 via-fuchsia-300 to-violet-400" />
					<div className="p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="text-[11px] font-semibold uppercase tracking-[.22em] text-violet-200">
								{t("nextUp")}
							</p>
							<span className="text-[11px] text-white/45">
								{nextItem.RunTimeTicks
									? formatPlayerTime(nextItem.RunTimeTicks / 10_000_000)
									: ""}
							</span>
						</div>
						<div className="mt-3 flex gap-3 sm:gap-3.5">
							<img
								src={landscapeImageUrl(nextItem) ?? undefined}
								alt=""
								className="h-16 w-24 shrink-0 rounded-xl object-cover shadow-lg shadow-black/30 sm:h-[4.5rem] sm:w-36"
							/>
							<div className="min-w-0 self-center">
								<p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
									S{nextItem.ParentIndexNumber ?? 0}:E
									{nextItem.IndexNumber ?? 0}
								</p>
								<p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">
									{nextItem.Name}
								</p>
							</div>
						</div>
						<div className="mt-4 flex items-center justify-end gap-2 border-t border-white/10 pt-3">
							<button
								type="button"
								onClick={onClose}
								className="rounded-lg px-3 py-2 text-xs font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
							>
								{t("stopPlaying")}
							</button>
							<button
								type="button"
								onClick={() => {
									void playNext();
								}}
								className="rounded-lg bg-violet-400 px-4 py-2 text-xs font-semibold text-black shadow-lg shadow-violet-950/30 transition hover:bg-violet-300"
							>
								{t("playNext")}
							</button>
						</div>
					</div>
				</div>
			)}
			<div
				className={`zenstream-player-controls absolute bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 transition-opacity duration-300 sm:bottom-5 sm:left-5 sm:right-5 md:bottom-8 md:left-10 md:right-10 ${controlsVisible || settingsOpen || trackMenu ? "opacity-100" : "pointer-events-none opacity-0"}`}
			>
				<div className="relative mb-3 flex h-5 items-center">
					<div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded bg-white/20">
						<span
							className="absolute inset-y-0 left-0 bg-violet-400"
							style={{
								width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
							}}
						/>
						{markers?.intro && duration > 0 && (
							<span
								className="absolute inset-y-0 bg-violet-300/90"
								style={{
									left: `${(markers.intro.start / duration) * 100}%`,
									width: `${((markers.intro.end - markers.intro.start) / duration) * 100}%`,
								}}
							/>
						)}
						{markers?.outro && duration > 0 && (
							<span
								className="absolute inset-y-0 bg-violet-300/90"
								style={{
									left: `${(markers.outro.start / duration) * 100}%`,
									width: `${((markers.outro.end - markers.outro.start) / duration) * 100}%`,
								}}
							/>
						)}
					</div>
					<input
						aria-label="Seek"
						type="range"
						min="0"
						max={duration}
						step="0.1"
						value={Math.min(
							seekPreview?.itemId === item.Id ? seekPreview.value : currentTime,
							duration || currentTime,
						)}
						className="absolute inset-x-0 top-1/2 z-10 h-5 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-violet-300 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent"
						onPointerMove={previewTimeline}
						onPointerLeave={() => {
							setTimelinePreview(undefined);
							setPreviewUnavailable(false);
						}}
						onPointerDown={previewTimeline}
						onPointerUp={() => commitPendingSeek()}
						onBlur={() => commitPendingSeek()}
						onKeyUp={(event) => {
							if (
								[
									"ArrowLeft",
									"ArrowRight",
									"Home",
									"End",
									"PageUp",
									"PageDown",
								].includes(event.key)
							)
								commitPendingSeek();
						}}
						onChange={(event) => stageSeek(Number(event.target.value))}
					/>
					{timelinePreview && (
						<TrickplayBubble
							preview={timelinePreview}
							onError={() => {
								setTimelinePreview(undefined);
								setPreviewUnavailable(true);
							}}
						/>
					)}
					{previewUnavailable && (
						<div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded bg-black/90 px-3 py-2 text-xs text-white/65">
							Preview unavailable
						</div>
					)}
				</div>
				<div className="zenstream-player-toolbar relative flex flex-wrap items-center gap-1.5 sm:gap-3">
					<button
						aria-label="Skip back 10 seconds"
						onClick={() => seek(-10)}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
					>
						<SkipBack />
					</button>
					<button
						aria-label={playing ? "Pause" : "Play"}
						onClick={togglePlay}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
					>
						{playing ? <Pause /> : <Play />}
					</button>
					<button
						aria-label="Skip forward 10 seconds"
						onClick={() => seek(10)}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
					>
						<SkipForward />
					</button>
					<span className="min-w-10 shrink-0 text-xs tabular-nums text-white/80 sm:text-sm">
						-{formatPlayerTime(Math.max(0, duration - currentTime))}
					</span>
					<span className="min-w-2 flex-1" />
					{(info?.audio.length ?? 0) > 1 && (
						<button
							data-player-context-trigger
							aria-label={t("audioTrack")}
							onClick={() => {
								setTrackMenu(trackMenu === "audio" ? null : "audio");
								setSettingsOpen(false);
							}}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white md:h-auto md:w-auto"
						>
							<AudioLines />
						</button>
					)}
					{(info?.subtitles.length ?? 0) > 0 && (
						<button
							data-player-context-trigger
							aria-label={t("subtitleTrack")}
							onClick={() => {
								setTrackMenu(trackMenu === "subtitle" ? null : "subtitle");
								setSettingsOpen(false);
							}}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white md:h-auto md:w-auto"
						>
							<Captions />
						</button>
					)}
					<div className="group relative flex items-center">
						<div className="zenstream-player-volume-popover pointer-events-none absolute bottom-full left-1/2 z-30 flex h-36 max-h-[30vh] -translate-x-1/2 items-center rounded-2xl border border-white/20 bg-black/25 px-3 py-4 opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
							<input
								aria-label="Volume"
								type="range"
								min="0"
								max="1"
								step="0.01"
								value={muted ? 0 : volume}
								onChange={(event) => {
									setVolume(Number(event.target.value));
									setMuted(false);
								}}
								className="zenstream-player-volume-input h-28 w-5 cursor-pointer [writing-mode:vertical-lr] [direction:rtl] accent-violet-300"
							/>
						</div>
						<button
							aria-label={muted ? "Unmute" : "Mute"}
							onClick={() => setMuted(!muted)}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
						>
							{muted ? <VolumeX /> : <Volume2 />}
						</button>
					</div>
					<button
						data-player-context-trigger
						aria-label={t("settings")}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
						onClick={() => {
							setSettingsOpen(!settingsOpen);
							setSettingsSection("root");
							setTrackMenu(null);
						}}
					>
						<Settings />
					</button>
					<button
						aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
						onClick={toggleFullscreen}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
					>
						{isFullscreen ? <Minimize /> : <Maximize />}
					</button>
					{trackMenu === "audio" && (
						<ChoicePanel
							options={info!.audio.map((track) => ({
								value: String(track.Index),
								label: track.DisplayTitle ?? track.Language ?? t("audioTrack"),
							}))}
							value={audio}
							onChange={(value) => chooseTrack("audio", value)}
						/>
					)}
					{trackMenu === "subtitle" && (
						<ChoicePanel
							options={[
								{ value: "", label: t("subtitlesOff") },
								...info!.subtitles.map((track) => ({
									value: String(track.Index),
									label:
										track.DisplayTitle ?? track.Language ?? t("subtitleTrack"),
								})),
							]}
							value={subtitle}
							onChange={(value) => chooseTrack("subtitle", value)}
						/>
					)}
					{settingsOpen && (
						<div
							data-player-context
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => event.stopPropagation()}
							className="zenstream-player-panel absolute bottom-full right-0 z-30 mb-2 w-[min(16rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-black/25 p-2 text-xs shadow-2xl backdrop-blur-xl"
						>
							{settingsSection === "root" && (
								<div className="grid gap-1">
									<MenuRow
										label={t("quality")}
										onClick={() => setSettingsSection("quality")}
									/>
									<MenuRow
										label={t("speed")}
										onClick={() => setSettingsSection("speed")}
									/>
									<MenuRow
										label={t("subtitleOffset")}
										onClick={() => setSettingsSection("offset")}
									/>
								</div>
							)}
							{settingsSection === "quality" && (
								<SettingsSubmenu
									title={t("quality")}
									onBack={() => setSettingsSection("root")}
								>
									<ChoicePanel
										floating={false}
										options={(info?.qualities ?? [0]).map((value) => ({
											value: String(value),
											label: value
												? `${Math.round(value / 1_000_000)} Mbps`
												: "Auto",
										}))}
										value={quality}
										onChange={chooseQuality}
									/>
								</SettingsSubmenu>
							)}
							{settingsSection === "speed" && (
								<SettingsSubmenu
									title={t("speed")}
									onBack={() => setSettingsSection("root")}
								>
									<ChoicePanel
										floating={false}
										options={speeds.map((value) => ({
											value: String(value),
											label: `${value}x`,
										}))}
										value={speed}
										onChange={(value) => {
											setSpeed(value);
											if (videoRef.current)
												videoRef.current.playbackRate = Number(value);
										}}
									/>
								</SettingsSubmenu>
							)}
							{settingsSection === "offset" && (
								<SettingsSubmenu
									title={t("subtitleOffset")}
									onBack={() => setSettingsSection("root")}
								>
									<div className="grid gap-2">
										<span className="text-white/60">
											{offset > 0 ? "+" : ""}
											{offset.toFixed(1)}s
										</span>
										<input
											aria-label={t("subtitleOffset")}
											type="range"
											min="-5"
											max="5"
											step="0.1"
											value={offset}
											onChange={(event) =>
												setOffset(Number(event.target.value))
											}
											className="accent-violet-400"
										/>
									</div>
								</SettingsSubmenu>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function MenuRow({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="rounded-md px-3 py-2 text-left text-xs font-normal leading-5 text-white/75 transition hover:bg-white/10 hover:text-white"
		>
			{label}
		</button>
	);
}

function SettingsSubmenu({
	title,
	onBack,
	children,
}: {
	title: string;
	onBack: () => void;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-1">
			<button
				type="button"
				onClick={onBack}
				className="mb-1 flex items-center gap-1 rounded-lg px-2 py-2 text-left text-xs font-medium leading-5 text-white/85 transition hover:bg-white/10 hover:text-white"
			>
				<ChevronLeft className="h-4 w-4" />
				{title}
			</button>
			{children}
		</div>
	);
}

function ChoicePanel({
	options,
	value,
	onChange,
	floating = true,
}: {
	options: Array<{ value: string; label: string }>;
	value: string;
	onChange: (value: string) => void;
	floating?: boolean;
}) {
	return (
		<div
			data-player-context={floating ? true : undefined}
			className={
				floating
					? "zenstream-player-panel absolute bottom-full right-0 z-20 mb-2 w-[min(14rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/20 bg-black/25 p-2 text-xs shadow-2xl backdrop-blur-xl"
					: "text-xs"
			}
		>
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-normal leading-5 text-white/75 transition hover:bg-white/10 hover:text-white"
				>
					{option.value === value ? (
						<Check className="h-4 w-4 shrink-0" />
					) : (
						<span className="h-4 w-4 shrink-0" />
					)}
					{option.label}
				</button>
			))}
		</div>
	);
}

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function formatPlayerTime(seconds: number) {
	const rounded = Math.max(0, Math.round(seconds));
	const minutes = Math.floor(rounded / 60);
	return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function hexToRgba(hex: string, opacity: number) {
	const value = hex.slice(1);
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}

export function disableNativeSubtitleTracks(video: HTMLVideoElement) {
	for (const track of Array.from(video.textTracks)) track.mode = "disabled";
}

export function exitFullscreenSafely() {
	const exitFullscreen = document.exitFullscreen?.();
	if (exitFullscreen) void exitFullscreen.catch(() => undefined);
}

export function CustomSubtitleCue({
	cues,
	time,
	style,
}: {
	cues: SubtitleCue[];
	time: number;
	style: SubtitleStyle;
}) {
	const activeCues = cues.filter(
		(candidate) => time >= candidate.start && time < candidate.end,
	);
	if (!activeCues.length) return null;
	const shadow = subtitleOuterShadow(style.borderSize, style.borderColor);
	const cueStyle: React.CSSProperties = {
		color: style.fontColor,
		backgroundColor: hexToRgba(style.backgroundColor, style.backgroundOpacity),
		fontFamily: SUBTITLE_FONT_STACKS[style.fontFamily],
		fontSize: `clamp(16px, ${style.textScale / 20}vh, 72px)`,
		fontWeight: style.bold ? 700 : 400,
		lineHeight: 1.15,
		whiteSpace: "pre-line",
		padding: style.backgroundOpacity ? "0.08em 0.2em" : undefined,
		textShadow: shadow,
	};
	return (
		<div
			data-testid="subtitle-overlay"
			className="pointer-events-none absolute inset-x-4 bottom-[12%] z-10 flex flex-col items-center gap-1 text-center"
			aria-live="off"
		>
			{activeCues.map((cue, index) => (
				<span
					data-testid="subtitle-cue"
					key={`${cue.start}-${cue.end}-${index}`}
					style={cueStyle}
				>
					{cue.text}
				</span>
			))}
		</div>
	);
}

function TrickplayBubble({
	preview,
	onError,
}: {
	preview: NonNullable<ReturnType<typeof trickplayPreview>> & {
		time: number;
		left: number;
	};
	onError: () => void;
}) {
	const scale = Math.min(1, 240 / preview.width, 150 / preview.height);
	const previewWidth = preview.width * scale;
	const previewEdge = previewWidth / 2;
	return (
		<div
			className="zenstream-player-timeline-preview pointer-events-none absolute bottom-8 -translate-x-1/2 overflow-hidden rounded-md border border-white/20 bg-black shadow-2xl"
			style={{
				left: `clamp(${previewEdge}px, ${preview.left * 100}%, calc(100% - ${previewEdge}px))`,
				width: previewWidth,
			}}
		>
			<div
				className="relative overflow-hidden"
				style={{ height: preview.height * scale }}
			>
				<img
					src={preview.url}
					alt="Timeline preview"
					onError={onError}
					className="absolute left-0 top-0 max-w-none"
					style={{
						width: preview.width * preview.columns * scale,
						height: preview.height * preview.rows * scale,
						transform: `translate(${-preview.cellX * preview.width * scale}px, ${-preview.cellY * preview.height * scale}px)`,
					}}
				/>
			</div>
			<span className="block px-2 py-1 text-center text-xs text-white/80">
				{formatTime(preview.time)}
			</span>
		</div>
	);
}
