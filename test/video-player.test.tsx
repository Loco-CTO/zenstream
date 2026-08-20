import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
	CustomSubtitleCue,
	TrickplayBubble,
	advanceToNextEpisode,
	advanceToNextEpisodeWithSyncplay,
	bufferedSecondsAhead,
	nextEpisodeSyncplayCommand,
	nativeSubtitleCueCss,
	normalizeBufferedRanges,
	disableNativeSubtitleTracks,
	exitFullscreenSafely,
	HLS_TEXT_TRACK_CONFIG,
	optimisticSeekTimelineTarget,
	SkipMarkerActions,
	startSyncedMedia,
	syncplayBufferingReportIsCurrent,
	syncplayInitialLoading,
	syncplayItemIsLoading,
	syncplayMediaIsReady,
	syncplayWaitingEventIsBuffering,
	syncplayWaitingIsSeekTransition,
	syncplayStateWantsPlaying,
	syncplayTimelineTarget,
	VideoPlayer,
	syncplayWaitingForMembers,
} from "@/components/player/video-player";
import {
	DEFAULT_SUBTITLE_STYLE,
	parseWebVttCues,
} from "@/lib/subtitle-preferences";
import { I18nProvider } from "@/lib/i18n";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { SyncplayProvider } from "@/lib/syncplay";
import { ToastProvider } from "@/components/ui/toast";
import {
	getPlaybackInfo,
	playbackStreams,
	type MediaItem,
} from "@/lib/media-api";
import type { SyncplayGroup } from "@/lib/syncplay";

vi.mock("@/lib/media-api", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api");
	return {
		...actual,
		getPlaybackInfo: vi.fn().mockResolvedValue({}),
		getPlaybackMarkers: vi.fn().mockResolvedValue(null),
		getTrickplayInfo: vi.fn().mockResolvedValue(undefined),
		playbackStreams: vi.fn().mockReturnValue({
			source: { TranscodingUrl: "/video.m3u8" },
			audio: [],
			subtitles: [],
			qualities: [],
		}),
		playbackUrl: vi.fn().mockReturnValue("/video.m3u8"),
	};
});

const defaultPlaybackStreams = {
	source: { TranscodingUrl: "/video.m3u8" },
	audio: [],
	subtitles: [],
	qualities: [],
} as ReturnType<typeof playbackStreams>;
const PLAYER_TIME_DISPLAY_STORAGE_KEY = "zenstream:player:time-display";

describe("video player controls", () => {
	it("recognizes the transient decoder window after a seek", () => {
		expect(syncplayWaitingIsSeekTransition(1500, 1000)).toBe(true);
		expect(syncplayWaitingIsSeekTransition(1000, 1000)).toBe(false);
	});

	it("rejects a delayed buffering report from an older seek timeline", () => {
		const report = {
			groupId: "group",
			itemId: "movie",
			mediaGeneration: 3,
			timelineRevision: 8,
			epoch: 4,
		};
		const current = {
			id: "group",
			itemId: "movie",
			mediaGeneration: 3,
			timelineRevision: 9,
			revision: 12,
		} as SyncplayGroup;

		expect(syncplayBufferingReportIsCurrent(report, current, 4)).toBe(false);
		expect(
			syncplayBufferingReportIsCurrent(
				{ ...report, timelineRevision: 9 },
				current,
				4,
			),
		).toBe(true);
		expect(syncplayBufferingReportIsCurrent(report, current, 5)).toBe(false);
	});
	beforeEach(() => {
		vi.useFakeTimers();
		const storage = new Map<string, string>();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key),
				clear: () => storage.clear(),
			},
		});
		window.localStorage.removeItem(PLAYER_TIME_DISPLAY_STORAGE_KEY);
		vi
			.mocked(playbackStreams)
			.mockReset()
			.mockReturnValue(defaultPlaybackStreams);
	});
	afterEach(() => vi.useRealTimers());

	it("detects when an active Syncplay member is waiting", () => {
		const group = {
			itemId: "movie",
			resumeWhenReady: true,
			mediaGeneration: 2,
			members: [
				{
					userId: "other",
					username: "Other",
					viewing: true,
					loading: true,
					readyGeneration: -1,
					role: "viewer",
				},
			],
		} as SyncplayGroup;
		expect(syncplayWaitingForMembers(group, "movie")).toBe(true);
		expect(
			syncplayWaitingForMembers(
				{
					...group,
					resumeWhenReady: false,
					playing: true,
					playbackState: "playing",
					members: [
						{
							userId: "other",
							username: "Other",
							viewing: true,
							loading: true,
							readyGeneration: -1,
							role: "viewer",
						},
					],
				},
				"movie",
			),
		).toBe(false);
		expect(
			syncplayWaitingForMembers(
				{
					...group,
					resumeWhenReady: false,
					members: [
						{
							userId: "other",
							username: "Other",
							viewing: true,
							loading: false,
							readyGeneration: 2,
							role: "viewer",
						},
					],
				},
				"movie",
			),
		).toBe(false);
		expect(
			syncplayWaitingForMembers(
				{
					...group,
					resumeWhenReady: false,
					playing: false,
					playbackState: "paused",
					members: [
						{
							userId: "other",
							username: "Other",
							viewing: true,
							loading: true,
							readyGeneration: -1,
							role: "viewer",
						},
					],
				},
				"movie",
			),
		).toBe(false);
		expect(syncplayWaitingForMembers(group, "other")).toBe(false);
	});

	it("clears the solo-host readiness overlay after playback is released", () => {
		expect(
			syncplayWaitingForMembers(
				{
					itemId: "movie",
					resumeWhenReady: false,
					playing: true,
					playbackState: "playing",
					mediaGeneration: 2,
					members: [
						{
							userId: "host",
							username: "Host",
							viewing: true,
							loading: false,
							readyGeneration: 2,
							role: "host",
						},
					],
				} as SyncplayGroup,
				"movie",
			),
		).toBe(false);
	});

	it("recognizes an authoritative playing state for the current item", () => {
		const state = {
			itemId: "movie",
			playing: true,
			playbackState: "playing" as const,
		} as SyncplayGroup;
		expect(syncplayStateWantsPlaying(state, "movie")).toBe(true);
		expect(
			syncplayStateWantsPlaying(
				{ ...state, playing: false, playbackState: "paused" },
				"movie",
			),
		).toBe(false);
		expect(syncplayStateWantsPlaying(state, "other")).toBe(false);
	});

	it("recognizes media that was already buffered before joining Syncplay", () => {
		expect(syncplayInitialLoading(null)).toBe(true);
		expect(syncplayInitialLoading({ readyState: 2 })).toBe(true);
		expect(syncplayInitialLoading({ readyState: 4 })).toBe(false);
		expect(syncplayMediaIsReady({ readyState: 2 })).toBe(false);
		expect(syncplayMediaIsReady({ readyState: 3 })).toBe(true);
		expect(syncplayMediaIsReady({ readyState: 4 })).toBe(true);
		expect(syncplayWaitingEventIsBuffering({ readyState: 2 })).toBe(true);
		expect(syncplayWaitingEventIsBuffering({ readyState: 3 })).toBe(false);
	});

	it("normalizes overlapping buffered ranges and only reports buffer at the playhead", () => {
		expect(
			normalizeBufferedRanges([
				[19.8, 192.5],
				[0, 109.2],
				[300, 301],
				[301.03, 302],
			]),
		).toEqual([
			[0, 192.5],
			[300, 302],
		]);
		expect(bufferedSecondsAhead([[0, 192.5]], 97.4)).toBeCloseTo(95.1);
		expect(bufferedSecondsAhead([[0, 192.5]], 250)).toBe(0);
	});

	it("does not reuse the previous episode's readiness for Next Up", () => {
		expect(
			syncplayItemIsLoading("episode-1", "episode-2", { readyState: 4 }),
		).toBe(true);
		expect(
			syncplayItemIsLoading("episode-2", "episode-2", { readyState: 4 }),
		).toBe(false);
	});

	it("contains player overlays without creating a scrollbar", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider session={null}>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		expect(container.firstElementChild).toHaveClass("overflow-hidden");
	});

	it("does not show an unavailable preview notice without trickplay data", () => {
		const { container, queryByText } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						initialStreams={
							{
								source: { Id: "source", mode: "direct", url: "/movie.mp4" },
								audio: [],
								subtitles: [],
								qualities: [],
							} as never
						}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const video = container.querySelector("video");
		const timeline = container.querySelector('input[aria-label="Seek"]');
		expect(video).not.toBeNull();
		expect(timeline).not.toBeNull();
		if (!video || !timeline) return;
		vi.spyOn(video, "play").mockResolvedValue(undefined);
		Object.defineProperty(video, "duration", {
			configurable: true,
			value: 120,
		});
		fireEvent.loadedMetadata(video);
		fireEvent.pointerMove(timeline, { clientX: 1 });

		expect(queryByText("Preview unavailable")).not.toBeInTheDocument();
	});

	it("toggles and remembers elapsed and remaining timer formats", async () => {
		const item = {
			Id: "movie",
			Name: "Movie",
			Type: "Movie",
			RunTimeTicks: 1_500 * 10_000_000,
		} as MediaItem;
		const streams = {
			source: { Id: "source", mode: "direct", url: "/movie.mp4" },
			audio: [],
			subtitles: [],
			qualities: [],
		} as never;
		const renderPlayer = () =>
			render(
				<I18nProvider locale="en">
					<SubtitlePreferencesProvider>
						<VideoPlayer
							item={item}
							session={{ token: "token", userId: "user", username: "Alex" }}
							initialStreams={streams}
							onClose={vi.fn()}
						/>
					</SubtitlePreferencesProvider>
				</I18nProvider>,
			);

		const first = renderPlayer();
		const firstVideo = first.container.querySelector("video")!;
		Object.defineProperty(firstVideo, "duration", {
			configurable: true,
			value: 1_425,
		});
		Object.defineProperty(firstVideo, "currentTime", {
			configurable: true,
			writable: true,
			value: 83,
		});
		fireEvent.loadedMetadata(firstVideo);
		fireEvent.timeUpdate(firstVideo);

		const firstTimer = first.getByTestId("player-time");
		expect(firstTimer).toHaveTextContent("-22:22/23:45");
		expect(firstTimer).toHaveAccessibleName("Show elapsed time");
		expect(firstTimer).toHaveAttribute("aria-pressed", "false");

		fireEvent.click(firstTimer);
		expect(firstTimer).toHaveTextContent("1:23/23:45");
		expect(firstTimer).toHaveAccessibleName("Show remaining time");
		expect(firstTimer).toHaveAttribute("aria-pressed", "true");
		expect(window.localStorage.getItem(PLAYER_TIME_DISPLAY_STORAGE_KEY)).toBe(
			"elapsed",
		);

		first.unmount();
		const second = renderPlayer();
		await act(async () => {
			await Promise.resolve();
		});
		const secondVideo = second.container.querySelector("video")!;
		Object.defineProperty(secondVideo, "duration", {
			configurable: true,
			value: 1_425,
		});
		Object.defineProperty(secondVideo, "currentTime", {
			configurable: true,
			writable: true,
			value: 83,
		});
		fireEvent.loadedMetadata(secondVideo);
		fireEvent.timeUpdate(secondVideo);

		const secondTimer = second.getByTestId("player-time");
		expect(secondTimer).toHaveTextContent("1:23/23:45");
	});

	it("falls back to remaining mode for an invalid stored timer preference", () => {
		window.localStorage.setItem(PLAYER_TIME_DISPLAY_STORAGE_KEY, "invalid");
		const { getByTestId } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={
							{
								Id: "movie",
								Name: "Movie",
								Type: "Movie",
								RunTimeTicks: 1_425 * 10_000_000,
							} as MediaItem
						}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const timer = getByTestId("player-time");
		expect(timer).toHaveTextContent("-23:45/23:45");
		expect(timer).toHaveAccessibleName("Show elapsed time");
	});

	it("adds the selected VTT stream as a native subtitle track", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						initialSubtitleStreamIndex={3}
						initialStreams={
							{
								source: {
									Id: "source",
									MediaStreams: [
										{
											Index: 3,
											Type: "Subtitle",
											FileId: "subtitle-file",
											Language: "en",
											DisplayTitle: "English",
										},
									],
								},
								audio: [],
								subtitles: [
									{
										Index: 3,
										Type: "Subtitle",
										FileId: "subtitle-file",
										Language: "en",
										DisplayTitle: "English",
									},
								],
								qualities: [],
							} as never
						}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const track = container.querySelector("track");
		expect(track).toHaveAttribute("kind", "subtitles");
		expect(track?.getAttribute("src")).toContain("/subtitles/subtitle-file.vtt");
	});

	it("applies initial audio and subtitle choices that arrive after mount", async () => {
		const source = {
			Id: "source",
			MediaStreams: [
				{ Index: 2, Type: "Audio", DisplayTitle: "Japanese" },
				{ Index: 4, Type: "Audio", DisplayTitle: "English" },
				{ Index: 3, Type: "Subtitle", FileId: "subtitle-file" },
			],
		};
		const streams = {
			source,
			audio: [
				{ Index: 2, Type: "Audio", DisplayTitle: "Japanese" },
				{ Index: 4, Type: "Audio", DisplayTitle: "English" },
			],
			subtitles: [{ Index: 3, Type: "Subtitle", FileId: "subtitle-file" }],
			qualities: [],
		} as never;
		vi.mocked(playbackStreams).mockReturnValue(streams);
		const props = {
			item: { Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem,
			session: { token: "token", userId: "user", username: "Alex" },
			initialStreams: streams,
			onClose: vi.fn(),
		};
		const view = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer {...props} />
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		await act(async () => {
			await Promise.resolve();
		});
		view.rerender(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						{...props}
						initialAudioStreamId={2}
						initialSubtitleStreamIndex={3}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);
		await act(async () => {
			await Promise.resolve();
		});

		fireEvent.click(view.getByRole("button", { name: "Audio" }));
		const japanese = view.getByRole("button", { name: "Japanese" });
		expect(japanese.querySelector("svg")).toBeInTheDocument();
		expect(view.container.querySelector("track")).toHaveAttribute(
			"src",
			expect.stringContaining("/subtitles/subtitle-file.vtt"),
		);

		view.rerender(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						{...props}
						initialAudioStreamId={2}
						initialSubtitleStreamIndex={null}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);
		await act(async () => {
			await Promise.resolve();
		});
		expect(view.container.querySelector("track")).not.toBeInTheDocument();
	});

	it("requests Picture in Picture when the browser supports it", () => {
		const requestPictureInPicture = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(document, "pictureInPictureEnabled", {
			configurable: true,
			value: true,
		});
		Object.defineProperty(HTMLVideoElement.prototype, "requestPictureInPicture", {
			configurable: true,
			value: requestPictureInPicture,
		});
		const { getByRole } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		fireEvent.click(getByRole("button", { name: "Picture in Picture" }));
		expect(requestPictureInPicture).toHaveBeenCalledOnce();
		delete (
			document as Omit<Document, "pictureInPictureEnabled"> & {
				pictureInPictureEnabled?: boolean;
			}
		).pictureInPictureEnabled;
		delete (
			HTMLVideoElement.prototype as Omit<
				HTMLVideoElement,
				"requestPictureInPicture"
			> & {
				requestPictureInPicture?: () => Promise<unknown>;
			}
		).requestPictureInPicture;
	});

	it("negotiates playback from the saved progress", async () => {
		const session = { token: "token", userId: "user", username: "Alex" };
		vi.mocked(getPlaybackInfo).mockClear();
		render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider session={null}>
					<VideoPlayer
						item={
							{
								Id: "movie",
								Name: "Movie",
								Type: "Movie",
								UserData: { PlaybackPositionTicks: 420_000_000 },
							} as MediaItem
						}
						session={session}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(getPlaybackInfo).toHaveBeenCalledWith(
			session,
			"movie",
			expect.objectContaining({ startPositionSeconds: 42 }),
		);
	});

	it("renders movie names as the prominent player title", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		expect(container.querySelector("h1")).toHaveTextContent("Movie");
		expect(container.querySelector("h1")).toHaveClass("font-semibold");
	});

	it("keeps the mobile toolbar controls touch-sized and responsive", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const controls = container.querySelector(".zenstream-player-controls");
		const toolbar = container.querySelector(".zenstream-player-toolbar");
		const toolbarButtons = toolbar
			? Array.from(toolbar.querySelectorAll("button"))
			: [];
		const timerButton = toolbar?.querySelector('[data-testid="player-time"]');
		const iconButtons = toolbar
			? Array.from(
					toolbar.querySelectorAll('button:not([data-testid="player-time"])'),
				)
			: [];

		expect(controls).toHaveClass("zenstream-player-controls");
		expect(toolbar).toHaveClass("zenstream-player-toolbar");
		expect(toolbarButtons.length).toBeGreaterThan(0);
		expect(
			iconButtons.every(
				(button) =>
					button.classList.contains("h-10") && button.classList.contains("w-10"),
			),
		).toBe(true);
		expect(timerButton).toHaveClass("h-10", "min-w-[5.5rem]");
	});

	it("does not toggle playback when the video is touched", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);
		const video = container.querySelector("video")!;
		const pause = vi.spyOn(video, "pause");
		const play = vi.spyOn(video, "play").mockResolvedValue(undefined);

		fireEvent.pointerDown(video, { pointerType: "touch" });
		fireEvent.click(video);

		expect(pause).not.toHaveBeenCalled();
		expect(play).not.toHaveBeenCalled();
	});

	it("shows the Syncplay groups control in the player header", () => {
		const { container, getByRole } = render(
			<I18nProvider locale="en">
				<ToastProvider>
					<SyncplayProvider
						session={{ token: "token", userId: "user", username: "Alex" }}
					>
						<SubtitlePreferencesProvider>
							<VideoPlayer
								item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
								session={{ token: "token", userId: "user", username: "Alex" }}
								onClose={vi.fn()}
							/>
						</SubtitlePreferencesProvider>
					</SyncplayProvider>
				</ToastProvider>
			</I18nProvider>,
		);
		const groupButton = getByRole("button", { name: "Groups" });
		const groupContainer = groupButton.parentElement?.parentElement;
		expect(groupButton).toBeInTheDocument();
		expect(groupContainer).toHaveClass("opacity-100");

		fireEvent.pointerMove(container.firstElementChild!);
		act(() => vi.advanceTimersByTime(2501));
		expect(groupContainer).toHaveClass("pointer-events-none", "opacity-0");

		fireEvent.pointerMove(container.firstElementChild!);
		expect(groupContainer).toHaveClass("opacity-100");
	});

	it("locks document scrolling while the player is open and restores it on close", () => {
		document.documentElement.style.overflow = "auto";
		document.body.style.overflow = "scroll";
		const { unmount } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		expect(document.documentElement).toHaveStyle({ overflow: "hidden" });
		expect(document.body).toHaveStyle({ overflow: "hidden" });
		unmount();
		expect(document.documentElement).toHaveStyle({ overflow: "auto" });
		expect(document.body).toHaveStyle({ overflow: "scroll" });
		document.documentElement.style.overflow = "";
		document.body.style.overflow = "";
	});

	it("hides the player gradient when controls time out", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const gradient = container.querySelector(".bg-gradient-to-b");
		expect(gradient).toHaveClass("opacity-100");
		fireEvent.pointerMove(container.firstElementChild!);
		act(() => vi.advanceTimersByTime(2501));
		expect(gradient).toHaveClass("opacity-0");
	});

	it("keeps the loading indicator visible after controls time out", () => {
		const { container, getByTestId } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		fireEvent.pointerMove(container.firstElementChild!);
		act(() => vi.advanceTimersByTime(2501));

		expect(getByTestId("player-loading")).toBeVisible();
		fireEvent.canPlay(container.querySelector("video")!);
		expect(container.querySelector('[data-testid="player-loading"]')).toBeNull();
	});

	it("keeps the active skip intro action interactive independently of controls", () => {
		const onSkip = vi.fn();
		const { getByRole } = render(
			<SkipMarkerActions
				markers={{ intro: { start: 10, end: 20 } }}
				currentTime={12}
				labelIntro="Skip Intro"
				labelOutro="Skip Outro"
				onSkip={onSkip}
			/>,
		);
		const skipButton = getByRole("button", { name: "Skip Intro" });
		fireEvent.click(skipButton);
		expect(onSkip).toHaveBeenCalledOnce();
		expect(skipButton).toHaveClass("pointer-events-auto");
	});

	it("keeps Syncplay skip markers visible for viewers without room controls", () => {
		const { getByRole } = render(
			<SkipMarkerActions
				markers={{ outro: { start: 10, end: 20 } }}
				currentTime={12}
				labelIntro="Skip Intro"
				labelOutro="Skip Outro"
				onSkip={vi.fn()}
				disabled
			/>,
		);
		expect(getByRole("button", { name: "Skip Outro" })).toBeDisabled();
	});

	it("uses the next episode action without closing the player when Next Up is available", () => {
		const onNext = vi.fn();
		const onClose = vi.fn();

		advanceToNextEpisode(
			{ Id: "episode-2", Name: "Episode 2", Type: "Episode" } as MediaItem,
			onNext,
			onClose,
		);

		expect(onNext).toHaveBeenCalledWith(
			expect.objectContaining({ Id: "episode-2" }),
		);
		expect(onClose).not.toHaveBeenCalled();
	});

	it("closes the player when no next episode is available", () => {
		const onNext = vi.fn();
		const onClose = vi.fn();

		advanceToNextEpisode(null, onNext, onClose);

		expect(onNext).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it("starts the next episode at the beginning for Syncplay", () => {
		expect(nextEpisodeSyncplayCommand({ Id: "episode-2" } as MediaItem)).toEqual({
			action: "media",
			itemId: "episode-2",
			position: 0,
			playing: true,
		});
	});

	it("navigates only after the Syncplay media command resolves", async () => {
		let resolveCommand!: (value: unknown) => void;
		const command = vi.fn(
			() => new Promise<unknown>((resolve) => (resolveCommand = resolve)),
		);
		const onNext = vi.fn();
		const onClose = vi.fn();
		const next = {
			Id: "episode-2",
			Name: "Episode 2",
			Type: "Episode",
		} as MediaItem;

		advanceToNextEpisodeWithSyncplay(next, command, onNext, onClose);

		expect(onNext).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
		expect(command).toHaveBeenCalledWith(nextEpisodeSyncplayCommand(next));
		await act(async () => {
			resolveCommand({});
			await Promise.resolve();
		});
		expect(onNext).toHaveBeenCalledWith(next);
	});

	it("holds a scheduled Syncplay start until its server timestamp", () => {
		const state = {
			id: "group",
			name: "Alex's group",
			hostUserId: "user",
			hostName: "Alex",
			allowViewerControls: false,
			itemId: "movie",
			position: 30,
			playing: true,
			resumeWhenReady: false,
			revision: 2,
			timelineRevision: 2,
			anchorPosition: 30,
			anchorServerTime: 110,
			effectiveAt: 110,
			playbackState: "playing" as const,
			updatedAt: 100,
			members: [],
		};

		expect(syncplayTimelineTarget(state, 109)).toEqual({
			position: 30,
			shouldPlay: false,
			startsAt: 110,
		});
		expect(syncplayTimelineTarget(state, 112)).toEqual({
			position: 32,
			shouldPlay: true,
			startsAt: 110,
		});
	});

	it("keeps the seek initiator on their chosen position while the command is in flight", () => {
		expect(optimisticSeekTimelineTarget(45, false, 100, 102)).toEqual({
			position: 45,
			shouldPlay: false,
			startsAt: 100,
		});
		expect(optimisticSeekTimelineTarget(45, true, 100, 102)).toEqual({
			position: 47,
			shouldPlay: true,
			startsAt: 100,
		});
	});

	it("retries a rejected Syncplay start muted before blocking the group", async () => {
		const video = {
			muted: false,
			play: vi
				.fn()
				.mockRejectedValueOnce(new Error("Autoplay blocked"))
				.mockResolvedValueOnce(undefined),
		};
		const muted = vi.fn();
		const blocked = vi.fn();

		await expect(startSyncedMedia(video, muted, blocked)).resolves.toBe(true);
		expect(video.muted).toBe(true);
		expect(video.play).toHaveBeenCalledTimes(2);
		expect(muted).toHaveBeenCalledOnce();
		expect(blocked).not.toHaveBeenCalled();
	});

	it("blocks Syncplay readiness when playback still cannot start", async () => {
		const video = {
			muted: false,
			play: vi.fn().mockRejectedValue(new Error("No buffer")),
		};
		const muted = vi.fn();
		const blocked = vi.fn();

		await expect(startSyncedMedia(video, muted, blocked)).resolves.toBe(false);
		expect(video.play).toHaveBeenCalledTimes(2);
		expect(muted).toHaveBeenCalledOnce();
		expect(blocked).toHaveBeenCalledOnce();
	});

	it("loads subtitle preferences when playback opens", async () => {
		const style = {
			renderer: "native" as const,
			fontFamily: "sans",
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 0,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		};
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(style)));
		render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider
					session={{ token: "token", userId: "user", username: "Alex" }}
				>
					<VideoPlayer
						item={{ Id: "movie", Name: "Movie", Type: "Movie" } as MediaItem}
						session={{ token: "token", userId: "user", username: "Alex" }}
						onClose={vi.fn()}
					/>
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		await act(async () => {
			await Promise.resolve();
		});
		expect(fetchMock).toHaveBeenCalled();
		const [requestUrl, requestInit] = fetchMock.mock.calls[0] as [
			string,
			RequestInit,
		];
		expect(requestUrl).toContain("/api/preferences/subtitles");
		expect(requestInit).toEqual(
			expect.objectContaining({
				cache: "no-store",
				credentials: "include",
			}),
		);
	});

	it("stacks active cues and applies the saved custom appearance", () => {
		const { getAllByTestId } = render(
			<CustomSubtitleCue
				cues={[
					{ start: 1, end: 3, text: "First line" },
					{ start: 1, end: 3, text: "Second line" },
					{ start: 3, end: 4, text: "Next line" },
				]}
				time={2}
				style={{
					renderer: "native",
					fontFamily: "serif",
					bold: true,
					textScale: 160,
					fontColor: "#aabbcc",
					borderSize: 2,
					borderColor: "#112233",
					backgroundColor: "#445566",
					backgroundOpacity: 40,
				}}
			/>,
		);

		const cues = getAllByTestId("subtitle-cue");
		expect(cues).toHaveLength(2);
		expect(cues.map((cue) => cue.textContent)).toEqual([
			"First line",
			"Second line",
		]);
		expect(cues[0]).toHaveStyle({ color: "rgb(170, 187, 204)" });
		expect(cues[0].getAttribute("style")).toContain("font-weight: 700");
		expect(cues[0].getAttribute("style")).toContain(
			"background-color: rgba(68, 85, 102, 0.4)",
		);
		expect(cues[0].getAttribute("style")).toContain(
			'font-family: Georgia, "Times New Roman", serif',
		);
		expect(
			nativeSubtitleCueCss({
				renderer: "native",
				fontFamily: "serif",
				bold: true,
				textScale: 160,
				fontColor: "#aabbcc",
				borderSize: 2,
				borderColor: "#112233",
				backgroundColor: "#445566",
				backgroundOpacity: 40,
			}),
		).toContain("font-size: clamp(16px, 8vh, 72px)");
		expect(cues[0].getAttribute("style")).not.toContain("-webkit-text-stroke");
		expect(cues[0].getAttribute("style")).toContain(
			"text-shadow: -2px -2px 0 #112233",
		);
		expect(cues[0].getAttribute("style")).toContain("2px 2px 0 #112233");
	});

	it("renders trickplay previews above subtitles", () => {
		const { getByAltText } = render(
			<TrickplayBubble
				preview={{
					url: "/trickplay.webp",
					width: 320,
					height: 180,
					tileIndex: 0,
					columns: 1,
					rows: 1,
					cellX: 0,
					cellY: 0,
					time: 70,
					left: 0.5,
				}}
				onError={vi.fn()}
			/>,
		);

		expect(
			getByAltText("Timeline preview").parentElement?.parentElement,
		).toHaveClass("z-20");
	});

	it("parses Jellyfin VTT with a BOM and cue settings", () => {
		expect(
			parseWebVttCues(
				"\uFEFFWEBVTT\n\n1\n00:00.000 --> 00:02.000 align:start\nHello",
			),
		).toEqual([{ start: 0, end: 2, text: "Hello" }]);
	});

	it("does not show an ending cue at the next cue boundary", () => {
		const { queryByTestId } = render(
			<CustomSubtitleCue
				cues={[{ start: 1, end: 2, text: "Finished" }]}
				time={2}
				style={{
					renderer: "native",
					fontFamily: "sans",
					bold: false,
					textScale: 100,
					fontColor: "#ffffff",
					borderSize: 0,
					borderColor: "#000000",
					backgroundColor: "#000000",
					backgroundOpacity: 0,
				}}
			/>,
		);
		expect(queryByTestId("subtitle-overlay")).not.toBeInTheDocument();
	});

	it("disables HLS and browser-native subtitle tracks", () => {
		expect(HLS_TEXT_TRACK_CONFIG).toMatchObject({
			enableWebVTT: false,
			enableCEA708Captions: false,
			renderTextTracksNatively: false,
			subtitleDisplay: false,
		});
		const tracks = [{ mode: "showing" }, { mode: "hidden" }];
		disableNativeSubtitleTracks({
			textTracks: tracks,
		} as unknown as HTMLVideoElement);
		expect(tracks).toEqual([{ mode: "disabled" }, { mode: "disabled" }]);
		const selected = { mode: "disabled" };
		disableNativeSubtitleTracks(
			{
				textTracks: [selected, { mode: "showing" }],
			} as unknown as HTMLVideoElement,
			selected as unknown as TextTrack,
		);
		expect(selected.mode).toBe("showing");
	});

	it("renders every shared subtitle preference through native cue CSS", () => {
		const css = nativeSubtitleCueCss({
			...DEFAULT_SUBTITLE_STYLE,
			fontFamily: "serif",
			bold: true,
			textScale: 160,
			fontColor: "#aabbcc",
			backgroundColor: "#445566",
			backgroundOpacity: 40,
			borderSize: 2,
			borderColor: "#112233",
		});
		expect(css).toContain("video.zenstream-video::cue {");
		expect(css).toContain("video.zenstream-video::cue(*) {");
		expect(css).toContain("color: #aabbcc");
		expect(css).toContain("font-family: Georgia, 'Times New Roman', serif");
		expect(css).toContain("font-size: clamp(16px, 8vh, 72px)");
		expect(css).toContain("font-weight: 700");
		expect(css).toContain("background-color: rgba(68, 85, 102, 0.4)");
		expect(css).toContain("text-shadow: -2px -2px 0 #112233");
	});

	it("renders the default subtitle outline and transparent background", () => {
		const css = nativeSubtitleCueCss(DEFAULT_SUBTITLE_STYLE);
		expect(css).toContain("color: #ffffff");
		expect(css).toContain("font-family: 'Noto Sans', Arial, sans-serif");
		expect(css).toContain("text-shadow: -2px -2px 0 #000000");
		expect(css).toContain("2px 2px 0 #000000");
		expect(css).toContain("background-color: rgba(0, 0, 0, 0)");

		const { getByTestId } = render(
			<CustomSubtitleCue
				cues={[{ start: 0, end: 2, text: "Default subtitle" }]}
				time={1}
				style={DEFAULT_SUBTITLE_STYLE}
			/>,
		);
		expect(getByTestId("subtitle-cue").getAttribute("style")).toContain(
			"text-shadow: -2px -2px 0 #000000",
		);
	});

	it("ignores fullscreen exit failures when the document is no longer active", async () => {
		const exitFullscreen = vi
			.fn()
			.mockRejectedValue(new DOMException("Document not active"));
		Object.defineProperty(document, "exitFullscreen", {
			configurable: true,
			value: exitFullscreen,
		});

		exitFullscreenSafely();
		await expect(Promise.resolve()).resolves.toBeUndefined();
		delete (
			document as Omit<Document, "exitFullscreen"> & {
				exitFullscreen?: () => Promise<void>;
			}
		).exitFullscreen;
	});
});
