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
	PictureInPicture,
	Play,
	Settings,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
} from "lucide-react";
import {
	getPlaybackInfo,
	waitForPlaybackReady,
	cancelPlaybackSession,
	getPlaybackSessionStatus,
	getPlaybackMarkers,
	getEpisodes,
	getSeasons,
	landscapeImage,
	getTrickplayInfo,
	playbackStreams,
	playbackUrl,
	preserveTrickplay,
	reportPlayback,
	savedPlaybackPositionSeconds,
	setPlayed,
	subtitleUrl,
	trickplayPreview,
	type MediaItem,
	type MediaSource,
	type PlaybackInfo,
	type PlaybackMarker,
} from "@/lib/media-api";
import { shouldUseHlsJs } from "@/lib/browser-device-profile";
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
import { BlurHashImage } from "@/components/ui/blurhash-image";

type Props = {
	item: MediaItem;
	session: AuthSession;
	initialAudioStreamId?: number;
	initialSubtitleStreamIndex?: number;
	initialStreams?: ReturnType<typeof playbackStreams>;
	onClose: () => void;
	onNext?: (item: MediaItem) => void;
	onPlayedChange?: (played: boolean) => void;
};
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
export const HLS_TEXT_TRACK_CONFIG = {
	enableWebVTT: false,
	enableCEA708Captions: false,
	renderTextTracksNatively: false,
	subtitleDisplay: false,
};
const playerDebug = (event: string, details?: unknown) => {
	if (typeof window === "undefined") return;
	const rendered = typeof details === "string" ? details : JSON.stringify(details ?? "");
	const safe = rendered.replace(/access=[^&\s"']+/gi, "access=<redacted>");
	const method = /error|failed|fatal|timeout|fallback/i.test(event) ? "warn" : "info";
	console[method](`[Player] ${event}`, safe);
};

function safePlayerUrl(value?: string) {
	if (!value) return "-";
	try {
		const parsed = new URL(value, window.location.origin);
		return `${parsed.pathname}${parsed.searchParams.has("access") ? "?access=<redacted>" : parsed.search}`;
	} catch {
		return value.replace(/access=[^&\s"']+/gi, "access=<redacted>");
	}
}

export async function clearMediaSession(
	video: HTMLVideoElement,
	hls?: Hls | null,
) {
	hls?.stopLoad();
	hls?.detachMedia();
	hls?.destroy();
	video.pause();
	video.removeAttribute("src");
	for (const child of Array.from(video.children)) {
		if (child.tagName !== "TRACK") child.remove();
	}
	video.load();
}

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
		state.resumeWhenReady &&
		(state.members.length === 0 ||
			state.members.some(
				(member) =>
					member.watchingTogether !== false &&
					(!member.viewing ||
						member.loading ||
						(member.readyGeneration ?? -1) !== (state.mediaGeneration ?? -1)),
			))
	);
}

export function advanceToNextEpisode(
	nextItem: MediaItem | null,
	onNext: Props["onNext"],
	onClose: Props["onClose"],
) {
	if (nextItem && onNext) {
		onNext(nextItem);
		return;
	}
	onClose();
}

export function nextEpisodeSyncplayCommand(item: MediaItem) {
	return { action: "media", itemId: item.Id, position: 0, playing: true };
}

export function advanceToNextEpisodeWithSyncplay(
	nextItem: MediaItem,
	command: (
		value: ReturnType<typeof nextEpisodeSyncplayCommand>,
	) => Promise<unknown>,
	onNext: Props["onNext"],
	onClose: Props["onClose"],
) {
	advanceToNextEpisode(nextItem, onNext, onClose);
	void command(nextEpisodeSyncplayCommand(nextItem)).catch(() => undefined);
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

export function syncplayWaitingEventIsBuffering(
	video: Pick<HTMLMediaElement, "readyState">,
) {
	return !syncplayMediaIsReady(video);
}

export function syncplayWaitingIsSeekTransition(
	seekSettlingUntil: number,
	now: number,
) {
	return seekSettlingUntil > now;
}

export type SyncplayBufferingReport = {
	groupId: string;
	itemId: string;
	mediaGeneration: number;
	timelineRevision: number;
	epoch: number;
};

export function syncplayBufferingReportIsCurrent(
	report: SyncplayBufferingReport,
	current: SyncplayGroup | null,
	currentEpoch: number,
) {
	return Boolean(
		current &&
		report.epoch === currentEpoch &&
		report.groupId === current.id &&
		report.itemId === current.itemId &&
		report.mediaGeneration === (current.mediaGeneration ?? 0) &&
		report.timelineRevision === (current.timelineRevision ?? current.revision),
	);
}

export function syncplayInitialLoading(
	video: Pick<HTMLMediaElement, "readyState"> | null,
) {
	return !video || !syncplayMediaIsReady(video);
}

export function syncplayItemIsLoading(
	readyItemId: string | null,
	itemId: string,
	video: Pick<HTMLMediaElement, "readyState"> | null,
) {
	return readyItemId !== itemId || syncplayInitialLoading(video);
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
	disabled = false,
}: {
	markers: { intro?: PlaybackMarker; outro?: PlaybackMarker } | null;
	currentTime: number;
	labelIntro: string;
	labelOutro: string;
	onSkip: (marker: PlaybackMarker) => void;
	disabled?: boolean;
}) {
	return (
		<div className="zenstream-player-skip-actions pointer-events-none absolute bottom-24 left-5 right-5 z-20 flex flex-wrap justify-end gap-2 md:bottom-28 md:left-10 md:right-10">
			{markers?.intro &&
				currentTime >= markers.intro.start &&
				currentTime < markers.intro.end && (
					<button
						aria-label={labelIntro}
						disabled={disabled}
						className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3 py-2 text-sm font-medium text-white/90 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/40 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-45 sm:px-6 sm:py-3 sm:text-base"
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
						disabled={disabled}
						className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-black/25 px-3 py-2 text-sm font-medium text-white/90 shadow-xl shadow-black/20 backdrop-blur-xl transition hover:border-white/40 hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-45 sm:px-6 sm:py-3 sm:text-base"
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
	initialAudioStreamId,
	initialSubtitleStreamIndex,
	initialStreams,
	onClose,
	onNext,
	onPlayedChange,
}: Props) {
	const { t } = useI18n();
	const { style, refresh: refreshSubtitleStyle } = useSubtitlePreferences();
	const syncplay = useSyncplay();
	const syncplayActive = syncplay.active;
	const syncplayGroupId = syncplayActive?.id;
	const syncplayItemId = syncplayActive?.itemId;
	const syncplayGeneration = syncplayActive?.mediaGeneration ?? 0;
	const syncplayTimelineRevision =
		syncplayActive?.timelineRevision ?? syncplayActive?.revision;
	const syncplayServerNow = syncplay.serverNow;
	const applyingSyncRef = useRef(false);
	const suppressSyncPlayRef = useRef(false);
	const suppressSyncPauseRef = useRef(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const nativeSubtitleTrackRef = useRef<HTMLTrackElement>(null);
	const playerRef = useRef<HTMLDivElement>(null);
	const hlsRef = useRef<Hls | null>(null);
	const syncplayStateRef = useRef(syncplay.active);
	const syncplayApiRef = useRef({
		presence: syncplay.presence,
		serverNow: syncplay.serverNow,
	});
	const qualityRequestRef = useRef(0);
	const sourceRef = useRef<MediaSource | undefined>(
		initialStreams?.source,
	);
	const transcodeAttemptRef = useRef(false);
	const resumeTimeRef = useRef<number | null>(null);
	const resumePlayingRef = useRef<boolean | null>(null);
	const clearedPlayedRef = useRef(false);
	const advancingToNextRef = useRef(false);
	const suppressNextClickRef = useRef(false);
	const videoClickTimerRef = useRef<number | null>(null);
	const touchVideoInteractionRef = useRef(false);
	const controlsTimerRef = useRef<number | undefined>(undefined);
	const bufferingTimerRef = useRef<number | undefined>(undefined);
	const bufferingEpochRef = useRef(0);
	const retryAfterBufferingRef = useRef(false);
	const bufferedRef = useRef(false);
	const readyItemIdRef = useRef<string | null>(null);
	const appliedTimelineRef = useRef<string | null>(null);
	const seekPreviewRef = useRef<{ itemId: string; value: number } | null>(null);
	const optimisticSeekRef = useRef<{
		itemId: string;
		position: number;
		playing: boolean;
		startedAt: number;
		expiresAt: number;
	} | null>(null);
	// Browsers briefly emit waiting/pause while a seek switches decoder
	// timestamps. Do not publish that transient state to the Syncplay room.
	const seekSettlingUntilRef = useRef(0);
	const [url, setUrl] = useState<string | undefined>(() =>
		initialStreams?.source
			? playbackUrl(initialStreams.source)
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
	const [debugOpen, setDebugOpen] = useState(false);
	const [debugStats, setDebugStats] = useState({
		manifestParsed: false,
		fragmentsRequested: 0,
		fragmentsBuffered: 0,
		lastRequest: "",
		lastFragment: "",
		hlsErrors: 0,
		lastHlsError: "",
	});
	const [trackMenu, setTrackMenu] = useState<"audio" | "subtitle" | null>(null);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [volume, setVolume] = useState(1);
	const [speed, setSpeed] = useState("1");
	const [quality, setQuality] = useState("0");
	const [audio, setAudio] = useState(
		initialAudioStreamId == null ? "" : String(initialAudioStreamId),
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
	const [bufferedRanges, setBufferedRanges] = useState<{
		itemId: string;
		ranges: Array<[number, number]>;
	}>({ itemId: item.Id, ranges: [] });
	const [error, setError] = useState("");
	const [buffering, setBuffering] = useState(true);
	const [controlsVisible, setControlsVisible] = useState(true);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const [pipSupported, setPipSupported] = useState(false);
	const [isPictureInPicture, setIsPictureInPicture] = useState(false);
	const [timelinePreview, setTimelinePreview] = useState<
		ReturnType<typeof trickplayPreview> & { time: number; left: number }
	>();
	const [seekPreview, setSeekPreview] = useState<{
		itemId: string;
		value: number;
	} | null>(null);
	const [, setDebugRefresh] = useState(0);
	const [previewUnavailable, setPreviewUnavailable] = useState(false);
	const [nextItem, setNextItem] = useState<MediaItem | null>(null);
	const [nextChecked, setNextChecked] = useState(false);
	const savedPositionSeconds = savedPlaybackPositionSeconds(item);
	const knownDuration = item.RunTimeTicks ? item.RunTimeTicks / 10_000_000 : 0;
	const displayedCurrentTime =
		seekPreview?.itemId === item.Id ? seekPreview.value : currentTime;
	const debugSource = sourceRef.current ?? info?.source;
	const playbackSessionId = info?.source?.sessionId;
	const selectedSubtitleStream = info?.subtitles.find(
		(stream) => stream.Index === Number(subtitle),
	);
	const nativeSubtitleTrackUrl =
		style.renderer === "native" && subtitle && info?.source
			? subtitleUrl(session, item.Id, info.source, Number(subtitle))
			: "";
	const cancelActiveSession = useCallback(
		async (reason: string) => {
			const source = sourceRef.current ?? info?.source;
			if (!source?.sessionId || source.mode === "direct") return;
			const sessionId = source.sessionId;
			await cancelPlaybackSession(session, sessionId).then(
				() => playerDebug("HLS session cancellation requested", { sessionId, reason }),
				(error) =>
					playerDebug("HLS session cancellation failed", {
						sessionId,
						reason,
						error: error instanceof Error ? error.message : String(error),
					}),
			);
		},
		[info?.source, session],
	);
	const handleClose = useCallback(() => {
		if (document.pictureInPictureElement === videoRef.current)
			void document.exitPictureInPicture().catch(() => undefined);
		void cancelActiveSession("player_close");
		onClose();
	}, [cancelActiveSession, onClose]);
	const debugVideo = videoRef.current;
	const debugVideoStream = debugSource?.MediaStreams?.find(
		(stream) => stream.Type === "Video",
	);
	const debugAudioStream = debugSource?.MediaStreams?.find(
		(stream) => stream.Type === "Audio",
	);
	const debugBufferAhead = bufferedRanges.ranges.reduce(
		(maximum, [, end]) => Math.max(maximum, end - currentTime),
		0,
	);
	const nextUpVisible =
		item.Type === "Episode" &&
		nextChecked &&
		duration > 0 &&
		duration - currentTime <= 10 &&
		Boolean(nextItem);
	useEffect(() => {
		if (!debugOpen) return;
		const timer = window.setInterval(() => setDebugRefresh((value) => value + 1), 250);
		return () => window.clearInterval(timer);
	}, [debugOpen]);
	useEffect(() => {
		if (!playbackSessionId || info?.source?.mode === "direct") return;
		let active = true;
		const heartbeat = () => {
			void getPlaybackSessionStatus(session, playbackSessionId)
				.then((status) => {
					if (!active) return;
					playerDebug("HLS session heartbeat", {
						sessionId: status.sessionId,
						sessionState: status.sessionState,
						processAlive: status.processAlive,
						segmentCount: status.segmentCount,
					});
				})
				.catch((error) => {
					if (active)
						playerDebug("HLS session heartbeat failed", {
							sessionId: playbackSessionId,
							error: error instanceof Error ? error.message : String(error),
						});
				});
		};
		const timer = window.setInterval(heartbeat, 15_000);
		const cancelOnPageHide = () => {
			active = false;
			void cancelPlaybackSession(session, playbackSessionId).catch(() => undefined);
		};
		window.addEventListener("pagehide", cancelOnPageHide);
		return () => {
			active = false;
			window.clearInterval(timer);
			window.removeEventListener("pagehide", cancelOnPageHide);
			void cancelPlaybackSession(session, playbackSessionId).then(
				() => playerDebug("HLS session cancelled", { sessionId: playbackSessionId }),
				(error) =>
					playerDebug("HLS session cancellation failed", {
						sessionId: playbackSessionId,
						error: error instanceof Error ? error.message : String(error),
					}),
			);
		};
	}, [info?.source?.mode, playbackSessionId, session]);
	const reportCurrentProgress = useCallback(
		(video: HTMLVideoElement | null) => {
			if (!video || !Number.isFinite(video.currentTime) || video.currentTime <= 0)
				return;
			const mediaDuration = Number.isFinite(video.duration) ? video.duration : 0;
			const durationSeconds =
				mediaDuration > 0 ? mediaDuration : duration || knownDuration;
			const position = video.currentTime;
			void reportPlayback(
				session,
				item.Id,
				position,
				video.paused,
				durationSeconds,
			).catch(() => undefined);
		},
		[duration, item.Id, knownDuration, session],
	);
	const updateBufferedRanges = (video: HTMLVideoElement) => {
		const ranges: Array<[number, number]> = [];
		for (let index = 0; index < video.buffered.length; index += 1) {
			const start = video.buffered.start(index);
			const end = video.buffered.end(index);
			if (Number.isFinite(start) && Number.isFinite(end) && end > start)
				ranges.push([start, end]);
		}
		setBufferedRanges({ itemId: item.Id, ranges });
	};
	const cancelPendingBufferingReport = useCallback(
		(reason: string) => {
			if (bufferingTimerRef.current !== undefined) {
				window.clearTimeout(bufferingTimerRef.current);
				bufferingTimerRef.current = undefined;
			}
			bufferingEpochRef.current += 1;
			playerDebug("buffering report canceled", {
				itemId: item.Id,
				reason,
				epoch: bufferingEpochRef.current,
			});
		},
		[item.Id],
	);

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
		cancelPendingBufferingReport("item changed");
		sourceRef.current = undefined;
		transcodeAttemptRef.current = false;
		resumeTimeRef.current = null;
		resumePlayingRef.current = null;
		advancingToNextRef.current = false;
		readyItemIdRef.current = null;
		bufferedRef.current = true;
	}, [cancelPendingBufferingReport, item.Id]);
	const currentBufferedRanges =
		bufferedRanges.itemId === item.Id ? bufferedRanges.ranges : [];

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
			// Move the initiating player immediately. Waiting for the command response
			// leaves the old player mounted while the new readiness barrier is created,
			// allowing old cleanup/presence events to race with the transition.
			setNextItem(null);
			setNextChecked(false);
			setCurrentTime(0);
			setDuration(0);
			setUrl(undefined);
			advanceToNextEpisodeWithSyncplay(
				target,
				syncplay.command,
				onNext,
				onClose,
			);
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
		const resolvePlaybackReady = async (playback: PlaybackInfo) => {
			const sessionId = playback.source?.sessionId;
			playerDebug("negotiation complete", {
				mode: playback.source?.mode,
				sessionId,
				sessionState: playback.source?.sessionState,
				url: playback.source?.url,
			});
			if (sessionId && playback.source?.sessionState === "starting") {
				playerDebug("waiting for HLS session readiness", {
					sessionId,
					mode: playback.source.mode,
				});
				const status = await waitForPlaybackReady(session, sessionId);
				playerDebug("HLS session ready", {
					sessionId: status.sessionId,
					sessionState: status.sessionState,
					playlistReady: status.playlistReady,
					segmentCount: status.segmentCount,
				});
				return {
					...playback,
					sessionId,
					source: { ...playback.source, sessionState: "ready" },
				};
			}
			return playback;
		};
		const streams = (initialStreams
			? Promise.resolve(initialStreams)
			: getPlaybackInfo(session, item.Id, {
					audioStreamId: initialAudioStreamId,
					startPositionSeconds: savedPositionSeconds,
					// Keep subtitles out of the media pipeline; the selected track is
					// fetched as VTT and rendered by CustomSubtitleCue below.
				})
				).then(resolvePlaybackReady).then(playbackStreams);
		streams
			.then(async (parsed) => {
				const markerData = parsed.source?.Id
					? await getPlaybackMarkers(session, item.Id, parsed.source.Id).catch(() => null)
					: null;
				const trickplay = parsed.source?.Id
					? await getTrickplayInfo(session, item.Id, parsed.source.Id).catch(
							() => undefined,
						)
					: undefined;
				return { parsed, markerData, trickplay };
			})
			.then(({ parsed, markerData, trickplay }) => {
				if (!active) return;
				const source =
					parsed.source && !parsed.source.Trickplay && trickplay
						? {
								...parsed.source,
								Trickplay: {
									[String(trickplay.frameWidth ?? 0)]: trickplay,
								},
							}
						: parsed.source;
				const next = { ...parsed, source };
				playerDebug("playback source selected", {
					mode: next.source?.mode,
					sessionId: next.source?.sessionId,
					sessionState: next.source?.sessionState,
					url: next.source?.url,
					fallbackCount: transcodeAttemptRef.current ? 1 : 0,
				});
				sourceRef.current = next.source;
				// The first negotiation is automatic. A fallback is allowed exactly
				// once, and only when the initial direct source genuinely fails.
				transcodeAttemptRef.current = next.source?.mode === "video-transcode";
				setInfo(next);
				setUrl(playbackUrl(next.source));
				setMarkers(markerData);
				const initialAudio =
					initialAudioStreamId == null
						? (next.audio.find((track) => track.IsDefault) ?? next.audio[0])
						: next.audio.find(
							(track) => track.Index === initialAudioStreamId,
							);
				if (initialAudio?.Index != null) setAudio(String(initialAudio.Index));
			})
			.catch((error) => {
				if (!active) return;
				playerDebug("playback negotiation or readiness failed", {
					error: error instanceof Error ? error.message : String(error),
				});
				setBuffering(false);
				setError("Playback could not be loaded.");
			});
		return () => {
			active = false;
		};
	}, [
		item.Id,
		session,
		initialAudioStreamId,
		initialSubtitleStreamIndex,
		initialStreams,
		savedPositionSeconds,
	]);
	useEffect(() => {
		if (!syncplayGroupId || syncplayItemId !== item.Id) return;
		// A client can join after the media element already emitted `canplay`.
		// In that case there may be no future event to clear the loading flag, so
		// inspect the current readyState when entering the readiness barrier.
		const video = videoRef.current;
		// A reused <video> can still report the previous episode's readyState while
		// Next Up is replacing its source. Never count that stale media as readiness
		// for the new item/generation.
		const loading = syncplayItemIsLoading(
			readyItemIdRef.current,
			item.Id,
			video,
		);
		// Keep this in the same meaning as reportBuffering(): it stores the last
		// loading state sent to the server, not whether the video is buffered.
		// Otherwise a later canplay event can be incorrectly deduplicated.
		bufferedRef.current = loading;
		void syncplayApiRef.current
			.presence(true, loading, syncplayGeneration)
			.catch(() => undefined);
	}, [
		syncplayGroupId,
		syncplayItemId,
		syncplayGeneration,
		syncplayTimelineRevision,
		item.Id,
	]);
	useEffect(() => {
		return () => {
			void syncplayApiRef.current.presence(false, false).catch(() => undefined);
		};
	}, []);
	useEffect(() => {
		const state = syncplayActive;
		const video = videoRef.current;
		if (!state || !video || state.itemId !== item.Id) {
			cancelPendingBufferingReport("timeline no longer applies");
			return;
		}
		cancelPendingBufferingReport("authoritative timeline changed");
		const timelineKey = `${state.mediaGeneration ?? 0}:${state.timelineRevision ?? state.revision}`;
		let forceSeek = appliedTimelineRef.current !== timelineKey;
		appliedTimelineRef.current = timelineKey;
		if (forceSeek) optimisticSeekRef.current = null;
		const seekBarrier = forceSeek && state.pauseReason === "seek";
		if (
			forceSeek &&
			readyItemIdRef.current === item.Id &&
			syncplayMediaIsReady(video)
		) {
			playerDebug("reasserting readiness for new timeline", {
				groupId: state.id,
				itemId: item.Id,
				generation: state.mediaGeneration,
				timelineRevision: state.timelineRevision,
			});
			void syncplayApiRef.current
				.presence(true, seekBarrier, state.mediaGeneration ?? 0)
				.catch(() => undefined);
		}
		const apply = () => {
			const now = syncplayServerNow();
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
			if (timeline.shouldPlay && !syncplayMediaIsReady(video)) {
				video.playbackRate = 1;
				return;
			}
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
		const startDelay = Math.max(0, (startsAt - syncplayServerNow()) * 1000);
		const startTimer = window.setTimeout(apply, startDelay + 20);
		return () => {
			window.clearInterval(interval);
			window.clearTimeout(startTimer);
			video.playbackRate = 1;
		};
	}, [
		syncplayActive,
		item.Id,
		syncplayServerNow,
		cancelPendingBufferingReport,
	]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !url) return;
		let active = true;
		setBuffering(true);
		setDebugStats({
			manifestParsed: false,
			fragmentsRequested: 0,
			fragmentsBuffered: 0,
			lastRequest: safePlayerUrl(url),
			lastFragment: "",
			hlsErrors: 0,
			lastHlsError: "",
		});
		void clearMediaSession(video, hlsRef.current);
		hlsRef.current = null;
		// Native HLS and hls.js can add a second subtitle track asynchronously.
		// Install the suppression listener before assigning src so the browser
		// cannot briefly select the stream's original captions.
		disableNativeSubtitleTracks(video, nativeSubtitleTrackRef.current?.track);
		const position = savedPositionSeconds;
		const onMetadata = () => {
			void (async () => {
				if (!active) return;
				disableNativeSubtitleTracks(video, nativeSubtitleTrackRef.current?.track);
				setBuffering(false);
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
				const mediaDuration = Number.isFinite(video.duration)
					? video.duration
					: 0;
				const negotiatedPosition = sourceRef.current?.startPositionSeconds ?? 0;
				const requestedPosition =
					resumeTimeRef.current ??
					(negotiatedPosition > 0 ? negotiatedPosition : position);
				if (
					Number.isFinite(requestedPosition) &&
					requestedPosition > 0 &&
					(!mediaDuration || requestedPosition < mediaDuration)
				) {
					playerDebug("native initial position", {
						requestedPosition,
						mode: sourceRef.current?.mode,
						sessionId: sourceRef.current?.sessionId,
						duration: mediaDuration,
					});
					video.currentTime = requestedPosition;
				}
				resumeTimeRef.current = null;
				setDuration(Math.max(knownDuration, mediaDuration));
				const shouldPlay = resumePlayingRef.current ?? true;
				resumePlayingRef.current = null;
				if (shouldPlay) void video.play().catch(() => undefined);
			})();
		};
		const onTextTrackAdded = () =>
			disableNativeSubtitleTracks(video, nativeSubtitleTrackRef.current?.track);
		const suppressHlsSubtitles = () => {
			const hls = hlsRef.current;
			if (hls) {
				hls.subtitleDisplay = false;
				hls.subtitleTrack = -1;
			}
			disableNativeSubtitleTracks(video, nativeSubtitleTrackRef.current?.track);
		};
		const textTracks = video.textTracks;
		const onCanPlay = () => {
			setBuffering(false);
			playerDebug("media canplay", {
				readyState: video.readyState,
				networkState: video.networkState,
				buffered: video.buffered.length,
			});
		};
		const onPlaying = () => {
			playerDebug("media first playable signal", {
				readyState: video.readyState,
				networkState: video.networkState,
				currentTime: video.currentTime,
			});
		};
		const onMediaError = () => {
			playerDebug("media error", {
				readyState: video.readyState,
				networkState: video.networkState,
				code: video.error?.code,
				message: video.error?.message,
			},);
		};
		video.addEventListener("loadedmetadata", onMetadata, { once: true });
		video.addEventListener("canplay", onCanPlay);
		video.addEventListener("playing", onPlaying);
		video.addEventListener("error", onMediaError);
		video.addEventListener("canplay", onTextTrackAdded);
		video.addEventListener("playing", onTextTrackAdded);
		video.addEventListener("progress", onTextTrackAdded);
		video.addEventListener("timeupdate", onTextTrackAdded);
		if (typeof textTracks.addEventListener === "function")
			textTracks.addEventListener("addtrack", onTextTrackAdded);
		if (/\.m3u8(?:\?|$)/i.test(url) && shouldUseHlsJs() && Hls.isSupported()) {
			const hls = new Hls(HLS_TEXT_TRACK_CONFIG);
			hlsRef.current = hls;
			suppressHlsSubtitles();
			hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, suppressHlsSubtitles);
			hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, suppressHlsSubtitles);
			hls.on(Hls.Events.SUBTITLE_TRACK_LOADED, suppressHlsSubtitles);
			hls.on(Hls.Events.MANIFEST_PARSED, () => {
				if (!active) return;
				playerDebug("HLS manifest parsed", { url, mode: sourceRef.current?.mode });
				setDebugStats((previous) => ({ ...previous, manifestParsed: true }));
				setError("");
			});
			hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
				if (!active) return;
				setDebugStats((previous) => ({
					...previous,
					fragmentsRequested: previous.fragmentsRequested + 1,
					lastRequest: safePlayerUrl(data.frag?.url),
				}));
			});
				hls.on(Hls.Events.FRAG_BUFFERED, (_event, data) => {
				if (!active) return;
				playerDebug("HLS fragment buffered", {
					url: data.frag?.url,
					currentTime: video.currentTime,
				});
				setDebugStats((previous) => ({
					...previous,
					fragmentsBuffered: previous.fragmentsBuffered + 1,
					lastFragment: safePlayerUrl(data.frag?.url),
				}));
				setError("");
				updateBufferedRanges(video);
				setBuffering(false);
			});
				hls.on(Hls.Events.ERROR, (_event, data) => {
				playerDebug(data.fatal ? "HLS fatal error" : "HLS error", {
					type: data.type,
					details: data.details,
					fatal: data.fatal,
					responseCode: data.response?.code,
					url: data.url,
				});
				setDebugStats((previous) => ({
					...previous,
					hlsErrors: previous.hlsErrors + 1,
					lastHlsError: `${data.type}/${data.details}${data.fatal ? " (fatal)" : ""}`,
				}));
				if (!active || !data.fatal) return;
				setBuffering(false);
				void requestTranscodedPlayback();
			});
			hls.loadSource(url);
			hls.attachMedia(video);
		} else {
			video.src = url;
			video.load();
		}
		return () => {
			active = false;
			video.removeEventListener("loadedmetadata", onMetadata);
			video.removeEventListener("canplay", onCanPlay);
			video.removeEventListener("playing", onPlaying);
			video.removeEventListener("error", onMediaError);
			video.removeEventListener("canplay", onTextTrackAdded);
			video.removeEventListener("playing", onTextTrackAdded);
			video.removeEventListener("progress", onTextTrackAdded);
			video.removeEventListener("timeupdate", onTextTrackAdded);
			if (typeof textTracks.removeEventListener === "function")
				textTracks.removeEventListener("addtrack", onTextTrackAdded);
			hlsRef.current?.destroy();
			hlsRef.current = null;
		};
	}, [url, item.Id, savedPositionSeconds, knownDuration]);

	useEffect(() => {
		if (videoRef.current) videoRef.current.volume = volume;
	}, [volume]);

	useEffect(() => {
		const video = videoRef.current;
		const track = nativeSubtitleTrackRef.current;
		if (!video) return;
		if (!nativeSubtitleTrackUrl || !track) {
			disableNativeSubtitleTracks(video);
			return;
		}
		const selectedTrack = track.track;
		if (!selectedTrack) return;
		const showSelectedTrack = () => {
			disableNativeSubtitleTracks(video, selectedTrack);
			selectedTrack.mode = "showing";
		};
		showSelectedTrack();
		track.addEventListener("load", showSelectedTrack);
		return () => track.removeEventListener("load", showSelectedTrack);
	}, [nativeSubtitleTrackUrl]);

	useEffect(() => {
		if (style.renderer !== "overlay" || !subtitle || !info?.source) {
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
	}, [info?.source, item.Id, session, style.renderer, subtitle]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			reportCurrentProgress(videoRef.current);
		}, 10_000);
		const flushOnLifecycle = () => reportCurrentProgress(videoRef.current);
		const handleVisibility = () => {
			if (document.visibilityState === "hidden") flushOnLifecycle();
		};
		window.addEventListener("pagehide", flushOnLifecycle);
		document.addEventListener("visibilitychange", handleVisibility);
		return () => {
			window.clearInterval(timer);
			flushOnLifecycle();
			window.removeEventListener("pagehide", flushOnLifecycle);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [reportCurrentProgress]);

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
			if (bufferingTimerRef.current !== undefined)
				window.clearTimeout(bufferingTimerRef.current);
			bufferingTimerRef.current = undefined;
			bufferingEpochRef.current += 1;
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
		const player = playerRef.current;
		const syncFullscreenState = () =>
			setIsFullscreen(document.fullscreenElement === player);
		document.addEventListener("fullscreenchange", syncFullscreenState);
		syncFullscreenState();
		return () => {
			document.removeEventListener("fullscreenchange", syncFullscreenState);
			if (document.fullscreenElement === player)
				exitFullscreenSafely();
		};
	}, []);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		setPipSupported(
			Boolean(
				document.pictureInPictureEnabled &&
				typeof video.requestPictureInPicture === "function",
			),
		);
		const onEnter = () => setIsPictureInPicture(true);
		const onLeave = () => setIsPictureInPicture(false);
		video.addEventListener("enterpictureinpicture", onEnter);
		video.addEventListener("leavepictureinpicture", onLeave);
		return () => {
			video.removeEventListener("enterpictureinpicture", onEnter);
			video.removeEventListener("leavepictureinpicture", onLeave);
			if (document.pictureInPictureElement === video)
				void document.exitPictureInPicture().catch(() => undefined);
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
		cancelPendingBufferingReport(
			loading ? "new loading signal" : "new ready signal",
		);
		const state = syncplayStateRef.current;
		if (!state || state.itemId !== item.Id || bufferedRef.current === loading)
			return;
		const itemId = item.Id;
		const generation = state.mediaGeneration ?? 0;
		const timelineRevision = state.timelineRevision ?? state.revision;
		const epoch = bufferingEpochRef.current;
		const report = {
			groupId: state.id,
			itemId,
			mediaGeneration: generation,
			timelineRevision,
			epoch,
		};
		playerDebug("buffering changed", {
			loading,
			groupId: state.id,
			itemId,
			generation,
			timelineRevision,
			epoch,
		});
		bufferingTimerRef.current = window.setTimeout(
			() => {
				bufferingTimerRef.current = undefined;
				const current = syncplayStateRef.current;
				if (
					!syncplayBufferingReportIsCurrent(
						report,
						current,
						bufferingEpochRef.current,
					)
				) {
					playerDebug("buffering report discarded", {
						loading,
						...report,
						currentGeneration: current?.mediaGeneration,
						currentTimelineRevision:
							current?.timelineRevision ?? current?.revision,
					});
					return;
				}
				bufferedRef.current = loading;
				playerDebug("buffering report sent", {
					loading,
					groupId: state.id,
					itemId,
					generation,
					timelineRevision,
					epoch,
				});
				void syncplayApiRef.current
					.presence(true, loading, generation)
					.catch(() => undefined);
			},
			loading ? 750 : 300,
		);
	}
	async function fetchTranscodedPlayback(
		audioStreamId?: number,
		previousSource?: MediaSource,
	) {
		let playback: Awaited<ReturnType<typeof getPlaybackInfo>> | undefined;
		try {
			playback = await getPlaybackInfo(session, item.Id, {
				sourceId: previousSource?.Id ?? sourceRef.current?.Id,
				audioStreamId: audioStreamId ?? (audio ? Number(audio) : undefined),
				requestedMode: "video-transcode",
				startPositionSeconds:
					resumeTimeRef.current ?? savedPositionSeconds,
			});
			if (playback.sessionId && playback.source?.sessionState === "starting") {
				const status = await waitForPlaybackReady(session, playback.sessionId);
				playerDebug("fallback HLS session ready", {
					sessionId: status.sessionId,
					mode: playback.source.mode,
					sessionState: status.sessionState,
					playlistReady: status.playlistReady,
					segmentCount: status.segmentCount,
				});
				playback.source.sessionState = "ready";
			}
			const parsed = playbackStreams(playback);
			if (!parsed.source || parsed.source.mode === "direct")
				throw new Error("The server did not return a transcoded session.");
			return {
				...parsed,
				source: preserveTrickplay(
					parsed.source,
					previousSource ?? sourceRef.current,
				),
			};
		} catch (error) {
			if (
				playback?.sessionId &&
				playback.sessionId !== sourceRef.current?.sessionId
			) {
				await cancelPlaybackSession(session, playback.sessionId).catch(() => undefined);
				playerDebug("canceled uncommitted fallback session", {
					sessionId: playback.sessionId,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
			throw error;
		}
	}
	function seekPlayback(target: number) {
		const video = videoRef.current;
		const source = sourceRef.current;
		if (!video || !source) return;
		const mediaDuration = Number.isFinite(video.duration) && video.duration > 0
			? video.duration
			: duration || knownDuration;
		const boundedTarget = Math.max(
			0,
			Math.min(mediaDuration || target, target),
		);
		playerDebug("native media seek", {
			target: boundedTarget,
			currentTime: video.currentTime,
			readyState: video.readyState,
			networkState: video.networkState,
			buffered: video.buffered.length,
			mode: source.mode,
			sessionId: source.sessionId,
		});
		video.currentTime = boundedTarget;
		setError("");
	}
	async function requestTranscodedPlayback() {
		if (transcodeAttemptRef.current) {
			setBuffering(false);
			setError(t("mediaPlaybackFailed"));
			return false;
		}
		transcodeAttemptRef.current = true;
		const video = videoRef.current;
		if (video && Number.isFinite(video.currentTime))
		resumeTimeRef.current =
			video.currentTime;
		setError("");
		setBuffering(true);
		try {
			const next = await fetchTranscodedPlayback();
			if (!next.source) throw new Error("Missing transcoded source.");
			sourceRef.current = next.source;
			setInfo((previous) => ({
				...next,
				qualities: previous?.qualities ?? next.qualities,
			}));
			setQuality("1");
			setUrl(playbackUrl(next.source));
			return true;
		} catch (error) {
			playerDebug("video fallback failed", {
				error: error instanceof Error ? error.message : String(error),
				fallbackCount: 1,
			});
			setBuffering(false);
			setError(t("mediaPlaybackFailed"));
			return false;
		}
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
	function togglePictureInPicture() {
		const video = videoRef.current;
		if (!video || !document.pictureInPictureEnabled) {
			setError(t("pictureInPictureUnavailable"));
			return;
		}
		if (document.pictureInPictureElement === video) {
			void document.exitPictureInPicture().catch(() =>
				setError(t("pictureInPictureUnavailable")),
			);
			return;
		}
		void video.requestPictureInPicture().catch(() =>
			setError(t("pictureInPictureUnavailable")),
		);
	}
	function handleVideoPointerDown(event: React.PointerEvent<HTMLVideoElement>) {
		if (event.pointerType !== "touch") return;
		touchVideoInteractionRef.current = true;
		event.stopPropagation();
		if (controlsVisible) {
			if (controlsTimerRef.current)
				window.clearTimeout(controlsTimerRef.current);
			setControlsVisible(false);
		} else {
			showControls();
		}
	}
	function handleVideoClick() {
		if (touchVideoInteractionRef.current) {
			touchVideoInteractionRef.current = false;
			return;
		}
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
		const previewTarget = seekPreviewRef.current?.itemId === item.Id
			? seekPreviewRef.current.value
			: video.currentTime;
		const target = Math.max(
			0,
			Math.min(duration || video.duration || Infinity, previewTarget + delta),
		);
		stageSeek(target);
		commitPendingSeek();
	}
	function stageSeek(target: number) {
		const video = videoRef.current;
		if (!video) return;
		const preview = { itemId: item.Id, value: target };
		if (syncplay.active) {
			if (syncplay.canControl) {
				seekPreviewRef.current = preview;
				setSeekPreview(preview);
			}
			return;
		}
		// Keep slider movement visual-only until release. The backend owns the
		// logical HLS timeline; native media seeking requests its segment.
		seekPreviewRef.current = preview;
		setSeekPreview(preview);
	}
	function commitPendingSeek() {
		const pending = seekPreviewRef.current;
		const video = videoRef.current;
		if (
			!pending ||
			pending.itemId !== item.Id ||
			!video
		)
			return;
		const target = pending.value;
		if (!syncplay.active) {
			// Keep the selected value rendered until the media element confirms the
			// native seek. Clearing it here makes a paused slider jump back to the
			// old currentTime for one render, which is especially visible during
			// repeated or reverse seeks.
			setCurrentTime(target);
			seekPlayback(target);
			return;
		}
		if (!syncplay.canControl) return;
		cancelPendingBufferingReport("local seek committed");
		seekPreviewRef.current = null;
		setSeekPreview(null);
		// Let the person who moved the slider see the seek immediately. The group
		// command remains authoritative and will correct other members (or this
		// player after a rejected command), but waiting for a network round trip
		// makes the control feel broken.
		const wasPlaying = !video.paused;
		const optimistic = {
			itemId: item.Id,
			position: target,
			playing: false,
			startedAt: syncplay.serverNow(),
			expiresAt: Date.now() + 8_000,
		};
		seekSettlingUntilRef.current = performance.now() + 1500;
		applyingSyncRef.current = true;
		window.setTimeout(() => {
			if (performance.now() >= seekSettlingUntilRef.current)
				applyingSyncRef.current = false;
		}, 1600);
		optimisticSeekRef.current = optimistic;
		video.currentTime = target;
		if (wasPlaying) {
			suppressSyncPauseRef.current = true;
			video.pause();
		}
		setCurrentTime(target);
		void syncplay
			.command({
				action: "seek",
				itemId: item.Id,
				position: target,
				playing: wasPlaying,
			})
			.catch(() => {
				if (optimisticSeekRef.current === optimistic)
					optimisticSeekRef.current = null;
			});
	}
	function commitTimelineSeek(value: string) {
		stageSeek(Number(value));
		commitPendingSeek();
	}
	function chooseQuality(value: string) {
		const video = videoRef.current;
		resumeTimeRef.current =
			video && Number.isFinite(video.currentTime)
				? video.currentTime
				: currentTime;
		setError("");
		setBuffering(true);
		setDuration(knownDuration);
		setQuality(value);
		const bitrate = Number(value);
		const request = ++qualityRequestRef.current;
		let pendingSessionId: string | undefined;
		void getPlaybackInfo(session, item.Id, {
			...(bitrate ? { maxStreamingBitrate: bitrate } : {}),
			sourceId: info?.source?.Id,
			audioStreamId: audio ? Number(audio) : undefined,
			// Subtitles are rendered by the custom VTT overlay; never ask the server
			// to encode them into the video stream.
		})
			.then(async (playback) => {
				pendingSessionId = playback.sessionId;
				if (request !== qualityRequestRef.current) {
					if (pendingSessionId && pendingSessionId !== info?.source?.sessionId)
						await cancelPlaybackSession(session, pendingSessionId).catch(() => undefined);
					return;
				}
				if (playback.sessionId && playback.source?.sessionState === "starting") {
					const status = await waitForPlaybackReady(session, playback.sessionId);
					playerDebug("quality HLS session ready", {
						sessionId: status.sessionId,
						mode: playback.source.mode,
						playlistReady: status.playlistReady,
						segmentCount: status.segmentCount,
					});
					playback.source.sessionState = "ready";
				}
				const parsed = playbackStreams(playback);
				if (!parsed.source)
					throw new Error("The server did not return a playback source.");
				const source = preserveTrickplay(parsed.source, info?.source);
				sourceRef.current = source;
				transcodeAttemptRef.current = source?.mode === "video-transcode";
				setInfo((previous) => ({
					...parsed,
					source,
					qualities: previous?.qualities ?? parsed.qualities,
				}));
				setUrl(playbackUrl(source));
			})
			.catch((error) => {
				if (pendingSessionId && pendingSessionId !== info?.source?.sessionId)
					void cancelPlaybackSession(session, pendingSessionId).catch(() => undefined);
				playerDebug("quality change failed", {
					error: error instanceof Error ? error.message : String(error),
				});
				if (request === qualityRequestRef.current) {
					setBuffering(false);
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
			video && Number.isFinite(video.currentTime) ? video.currentTime : currentTime;
		const nextAudio = value;
		setAudio(value);
		if (!info?.source) return;
		const request = ++qualityRequestRef.current;
		let pendingSessionId: string | undefined;
		resumeTimeRef.current = position;
		setBuffering(true);
		setError("");
		void getPlaybackInfo(session, item.Id, {
			sourceId: info.source.Id,
			audioStreamId: nextAudio ? Number(nextAudio) : undefined,
		})
			.then(async (playback) => {
				pendingSessionId = playback.sessionId;
				if (request !== qualityRequestRef.current) {
					if (pendingSessionId && pendingSessionId !== info.source?.sessionId)
						await cancelPlaybackSession(session, pendingSessionId).catch(() => undefined);
					return;
				}
				if (playback.sessionId && playback.source?.sessionState === "starting") {
					const status = await waitForPlaybackReady(session, playback.sessionId);
					playerDebug("audio HLS session ready", {
						sessionId: status.sessionId,
						mode: playback.source.mode,
						playlistReady: status.playlistReady,
						segmentCount: status.segmentCount,
					});
					playback.source.sessionState = "ready";
				}
				const parsed = playbackStreams(playback);
				const source = preserveTrickplay(parsed.source, info.source);
				if (!source) throw new Error("The server did not return a media source.");
				sourceRef.current = source;
				transcodeAttemptRef.current = source.mode === "video-transcode";
				setInfo((previous) => ({
					...parsed,
					source,
					qualities: previous?.qualities ?? parsed.qualities,
				}));
				setUrl(playbackUrl(source));
				setTrackMenu(null);
			})
			.catch(() => {
				if (pendingSessionId && pendingSessionId !== info.source?.sessionId)
					void cancelPlaybackSession(session, pendingSessionId).catch(() => undefined);
				if (request === qualityRequestRef.current) {
					setBuffering(false);
					setError("This track could not be loaded.");
				}
			});
	}
	function skip(marker?: PlaybackMarker) {
		if (!marker) return;
		stageSeek(marker.end);
		commitPendingSeek();
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
			{style.renderer === "native" && (
				<style>{nativeSubtitleCueCss(style)}</style>
			)}
			<video
				ref={videoRef}
				className="zenstream-video h-full w-full object-contain"
				crossOrigin="anonymous"
				onPointerDown={handleVideoPointerDown}
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
					if (videoRef.current) updateBufferedRanges(videoRef.current);
				}}
				onProgress={(event) => updateBufferedRanges(event.currentTarget)}
				onWaiting={() => {
					// `waiting` is also emitted while a browser is seeking to the
					// synchronized timeline.  That is not a transport stall when the
					// element already has future data; reporting it to the server makes
					// the whole room pause, then resume, and seek again in a loop.
					const video = videoRef.current;
					if (
						syncplayWaitingIsSeekTransition(
							seekSettlingUntilRef.current,
							performance.now(),
						)
					) {
						playerDebug("video waiting ignored during seek transition", {
							currentTime: video?.currentTime,
							readyState: video?.readyState,
						});
						return;
					}
					if (video && !syncplayWaitingEventIsBuffering(video)) {
						playerDebug("video waiting ignored; media has future data", {
							readyState: video.readyState,
						});
						return;
					}
					setBuffering(true);
					retryAfterBufferingRef.current = true;
					playerDebug("video waiting", {
						currentTime: video?.currentTime,
						readyState: video?.readyState,
					});
					reportBuffering(true);
				}}
				onCanPlay={() => {
					// A media error can be emitted while the browser is still
					// recovering the source. `canplay` is the authoritative signal
					// that the current element can be played, so clear any stale
					// error overlay here.
					setError("");
					setBuffering(false);
					cancelPendingBufferingReport("canplay");
					seekSettlingUntilRef.current = 0;
					applyingSyncRef.current = false;
					readyItemIdRef.current = item.Id;
					retryAfterBufferingRef.current = false;
					playerDebug("video canplay", {
						currentTime: videoRef.current?.currentTime,
						readyState: videoRef.current?.readyState,
					});
					// Do not rely on reportBuffering's local de-duplication here. The
					// initial presence request can be in flight when canplay arrives;
					// explicitly acknowledging readiness guarantees the server clears a
					// stale loading flag and releases the room barrier.
					const syncState = syncplayStateRef.current;
					if (syncState?.itemId === item.Id) {
						bufferedRef.current = false;
						void syncplayApiRef.current
							.presence(true, false, syncState.mediaGeneration ?? 0)
							.catch(() => undefined);
					}
					reportBuffering(false);
					const video = videoRef.current;
					if (
						video?.paused &&
						syncplayStateWantsPlaying(syncplayStateRef.current, item.Id)
					)
						startSyncedPlayback(video);
				}}
					onDurationChange={() => {
					const value = videoRef.current?.duration ?? 0;
					if (Number.isFinite(value) && value > 0)
						setDuration(Math.max(knownDuration, value));
				}}
					onSeeking={(event) => {
						playerDebug("media seeking", {
							currentTime: event.currentTarget.currentTime,
							readyState: event.currentTarget.readyState,
						});
					}}
					onSeeked={(event) => {
						const value = event.currentTarget.currentTime;
						setCurrentTime(Number.isFinite(value) ? value : 0);
						const pending = seekPreviewRef.current;
						if (
							pending?.itemId === item.Id &&
							Math.abs(pending.value - value) < 1.5
						) {
							seekPreviewRef.current = null;
							setSeekPreview(null);
						}
						playerDebug("media seeked", {
							currentTime: value,
							readyState: event.currentTarget.readyState,
						});
						const syncState = syncplayStateRef.current;
						if (
							syncState?.itemId === item.Id &&
							syncState.pauseReason === "seek" &&
							syncplayMediaIsReady(event.currentTarget)
						) {
							bufferedRef.current = false;
							void syncplayApiRef.current
								.presence(true, false, syncState.mediaGeneration ?? 0)
								.catch(() => undefined);
						}
					}}
						 onTimeUpdate={() => {
					const value = videoRef.current?.currentTime ?? 0;
					setCurrentTime(
						Number.isFinite(value)
							? Math.min(value, duration || value)
							: 0,
					);
					if (videoRef.current) updateBufferedRanges(videoRef.current);
				}}
				onEnded={() => {
					if (nextChecked && nextItem) void playNext();
					else onClose();
				}}
				 onPlay={(e) => {
					const logicalTime = e.currentTarget.currentTime;
					const syncState = syncplayStateRef.current;
					const syncWantsPlaying = Boolean(
						syncState?.playing || syncState?.playbackState === "playing",
					);
					playerDebug("video play event", {
						currentTime: logicalTime,
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
								position: logicalTime,
								playing: true,
							})
							.catch(() => undefined);
				}}
					onPlaying={(event) => {
					disableNativeSubtitleTracks(
						event.currentTarget,
						nativeSubtitleTrackRef.current?.track,
					);
					setBuffering(false);
					cancelPendingBufferingReport("playing");
					seekSettlingUntilRef.current = 0;
					applyingSyncRef.current = false;
					reportBuffering(false);
				}}
					onPause={(e) => {
					const logicalTime = e.currentTarget.currentTime;
						reportCurrentProgress(e.currentTarget);
					const syncState = syncplayStateRef.current;
					const syncWantsPlaying = Boolean(
						syncState?.playing || syncState?.playbackState === "playing",
					);
					playerDebug("video pause event", {
						currentTime: logicalTime,
						suppressed: suppressSyncPauseRef.current,
						applying: applyingSyncRef.current,
						authoritativePlaying: syncWantsPlaying,
						canControl: syncplay.canControl,
					});
					if (
						syncplayWaitingIsSeekTransition(
							seekSettlingUntilRef.current,
							performance.now(),
						)
					) {
						playerDebug("video pause ignored during seek transition");
						return;
					}
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
								position: logicalTime,
								playing: false,
							})
							.catch(() => undefined);
				}}
				onError={() => {
					const video = videoRef.current;
					if (
						!transcodeAttemptRef.current &&
							sourceRef.current?.mode === "direct"
					) {
						void requestTranscodedPlayback();
						return;
					}
					// Do not replace an already playable source with an error overlay
					// when the browser has recovered and can play it.
					if (video && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA)
						return;
					setBuffering(false);
					setError(t("mediaPlaybackFailed"));
				}}
			>
				{nativeSubtitleTrackUrl && (
					<track
						key={nativeSubtitleTrackUrl}
						ref={nativeSubtitleTrackRef}
						kind="subtitles"
						src={nativeSubtitleTrackUrl}
						srcLang={selectedSubtitleStream?.Language ?? "und"}
						label={
							selectedSubtitleStream?.DisplayTitle ??
							selectedSubtitleStream?.Language ??
							t("subtitleTrack")
						}
						default
					/>
				)}
			</video>
			{style.renderer === "overlay" &&
				subtitle &&
				subtitleCueData?.track === subtitle && (
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
					onClick={handleClose}
				>
					<ArrowLeft />
				</button>
				<div className="min-w-0">
					{item.Type === "Episode" && (
						<p className="truncate text-xs uppercase tracking-[.16em] text-white/55 sm:tracking-[.2em]">
							{`${item.SeriesName ?? "Series"} · S${item.ParentIndexNumber ?? 0}:E${item.IndexNumber ?? 0}`}
						</p>
					)}
					{item.Name && (
						<h1 className="mt-1 line-clamp-2 text-base font-semibold sm:text-lg">
							{item.Name}
						</h1>
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
			{debugOpen && (
				<div
					data-testid="player-debug-panel"
					className="pointer-events-none absolute left-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 w-[min(29rem,calc(100vw-1.5rem))] rounded-lg border border-white/10 bg-[#10151bcc] px-3 py-2 font-mono text-[10px] leading-[1.35] text-white/85 shadow-2xl backdrop-blur-md sm:left-5 sm:top-24 md:left-10"
				>
					<div className="mb-1 text-[11px] font-semibold text-white">Playback diagnostics</div>
					<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
						<span className="text-white/50">Mode</span><span>{debugSource?.mode ?? "negotiating"}</span>
						<span className="text-white/50">Session</span><span>{debugSource?.sessionId ?? "direct/no session"}</span>
						<span className="text-white/50">State</span><span>{debugSource?.sessionState ?? "ready"}</span>
						<span className="text-white/50">Stream</span><span className="truncate" title={safePlayerUrl(url)}>{safePlayerUrl(url)}</span>
						<span className="text-white/50">Source</span><span>{debugSource?.Container ?? "-"} / {debugSource?.Bitrate ? `${Math.round(debugSource.Bitrate / 1000)} kbps` : "bitrate -"}</span>
						<span className="text-white/50">Video</span><span>{debugVideoStream?.Codec ?? "-"} {debugVideoStream?.Width ?? "?"}x{debugVideoStream?.Height ?? "?"}</span>
						<span className="text-white/50">Audio</span><span>{debugAudioStream?.Codec ?? "-"} / {debugAudioStream?.Channels ?? "?"}ch</span>
						<span className="text-white/50">Position</span><span>{displayedCurrentTime.toFixed(2)} / {(duration || knownDuration || 0).toFixed(2)}s</span>
						<span className="text-white/50">Buffered</span><span>{bufferedRanges.ranges.length ? bufferedRanges.ranges.map(([start, end]) => `${start.toFixed(1)}-${end.toFixed(1)}`).join(" ") : "none"} ({debugBufferAhead.toFixed(1)}s ahead)</span>
						<span className="text-white/50">Native</span><span>{debugVideo?.paused ? "paused" : "playing"} / ready {debugVideo?.readyState ?? 0} / network {debugVideo?.networkState ?? 0}</span>
						<span className="text-white/50">HLS</span><span>manifest {debugStats.manifestParsed ? "yes" : "no"} / requested {debugStats.fragmentsRequested} / buffered {debugStats.fragmentsBuffered}</span>
						<span className="text-white/50">Request</span><span className="truncate" title={debugStats.lastRequest || undefined}>{debugStats.lastRequest || "-"}</span>
						<span className="text-white/50">Last segment</span><span className="truncate" title={debugStats.lastFragment || undefined}>{debugStats.lastFragment || "-"}</span>
						<span className="text-white/50">Errors</span><span>{debugStats.hlsErrors}{debugStats.lastHlsError ? ` / ${debugStats.lastHlsError}` : ""}</span>
					</div>
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
				<div
					role="alert"
					className="absolute left-1/2 top-1/2 flex -translate-x-1/2 flex-col items-center gap-3 rounded bg-black/70 px-4 py-3 text-sm text-red-200"
				>
					<p>{error}</p>
				</div>
			)}
			<SkipMarkerActions
				markers={markers}
				currentTime={currentTime}
				labelIntro={t("skipIntro")}
				labelOutro={t("skipOutro")}
				onSkip={skip}
				disabled={Boolean(syncplay.active && !syncplay.canControl)}
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
							{(() => {
								const image = landscapeImage(nextItem);
								return image ? (
									<div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl shadow-lg shadow-black/30 sm:h-[4.5rem] sm:w-36">
										<BlurHashImage
											image={image}
											alt=""
											className="h-full w-full object-cover"
										/>
									</div>
								) : null;
							})()}
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
								onClick={handleClose}
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
					<div
						data-testid="player-timeline"
						className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded bg-white/20"
					>
						{duration > 0 &&
							currentBufferedRanges.map(([start, end]) => (
								<span
									key={`${start}-${end}`}
									data-testid="player-buffered-range"
									className="absolute inset-y-0 bg-white/35"
									style={{
										left: `${(start / duration) * 100}%`,
										width: `${((end - start) / duration) * 100}%`,
									}}
								/>
							))}
						<span
							className="absolute inset-y-0 left-0 bg-violet-400"
							style={{
								width: `${duration > 0 ? (displayedCurrentTime / duration) * 100 : 0}%`,
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
							displayedCurrentTime,
							duration || displayedCurrentTime,
						)}
						className="absolute inset-x-0 top-1/2 z-10 h-5 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent accent-violet-300 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:bg-transparent"
						onPointerMove={previewTimeline}
						onPointerLeave={() => {
							setTimelinePreview(undefined);
							setPreviewUnavailable(false);
						}}
						onPointerDown={previewTimeline}
						onPointerUp={(event) =>
							commitTimelineSeek(event.currentTarget.value)
						}
						onBlur={(event) =>
							commitTimelineSeek(event.currentTarget.value)
						}
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
								commitTimelineSeek(event.currentTarget.value);
						}}
						onInput={(event) => stageSeek(Number(event.currentTarget.value))}
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
						-{formatPlayerTime(Math.max(0, duration - displayedCurrentTime))}
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
					{pipSupported && (
						<button
							aria-label={
								isPictureInPicture
									? t("exitPictureInPicture")
									: t("pictureInPicture")
							}
							onClick={togglePictureInPicture}
							className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 md:h-auto md:w-auto"
						>
							<PictureInPicture />
						</button>
					)}
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
									{style.renderer === "overlay" && (
										<MenuRow
											label={t("subtitleOffset")}
											onClick={() => setSettingsSection("offset")}
										/>
									)}
									<MenuRow
										label={debugOpen ? "Hide diagnostics" : "Show diagnostics"}
										onClick={() => {
											setDebugOpen(!debugOpen);
											setSettingsOpen(false);
										}}
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

export function nativeSubtitleCueCss(style: SubtitleStyle) {
	const cue = "video.zenstream-video::cue";
	const text = `${cue}(*)`;
	const textStyle = `color: ${style.fontColor}; font-family: ${SUBTITLE_FONT_STACKS[style.fontFamily]}; font-size: clamp(16px, ${style.textScale / 20}vh, 72px); font-weight: ${style.bold ? 700 : 400}; line-height: 1.15; text-shadow: ${subtitleOuterShadow(style.borderSize, style.borderColor)}; white-space: pre-line;`;
	return `${cue} { ${textStyle} background-color: ${hexToRgba(style.backgroundColor, style.backgroundOpacity)}; } ${text} { ${textStyle} }`;
}

export function disableNativeSubtitleTracks(
	video: HTMLVideoElement,
	selectedTrack?: TextTrack | null,
) {
	for (const track of Array.from(video.textTracks)) {
		track.mode = track === selectedTrack ? "showing" : "disabled";
	}
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

export function TrickplayBubble({
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
			className="zenstream-player-timeline-preview pointer-events-none absolute bottom-8 z-20 -translate-x-1/2 overflow-hidden rounded-md border border-white/20 bg-black shadow-2xl"
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
