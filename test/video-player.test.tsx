import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CustomSubtitleCue, disableNativeSubtitleTracks, exitFullscreenSafely, HLS_TEXT_TRACK_CONFIG, SkipMarkerActions, VideoPlayer } from "@/components/player/video-player";
import { I18nProvider } from "@/lib/i18n";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { SyncplayProvider } from "@/lib/syncplay";
import type { JellyfinItem } from "@/lib/jellyfin";

vi.mock("@/lib/jellyfin", async () => {
	const actual = await vi.importActual<typeof import("@/lib/jellyfin")>("@/lib/jellyfin");
	return {
		...actual,
		getPlaybackInfo: vi.fn().mockResolvedValue({}),
		getPlaybackMarkers: vi.fn().mockResolvedValue(null),
		getTrickplayInfo: vi.fn().mockResolvedValue(undefined),
		playbackStreams: vi.fn().mockReturnValue({ source: { TranscodingUrl: "/video.m3u8" }, audio: [], subtitles: [], qualities: [] }),
		playbackUrl: vi.fn().mockReturnValue("/video.m3u8"),
	};
});

describe("video player controls", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("contains player overlays without creating a scrollbar", () => {
		const { container } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} />
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		expect(container.firstElementChild).toHaveClass("overflow-hidden");
	});

	it("shows the Syncplay groups control in the player header", () => {
		const { getByRole } = render(<I18nProvider locale="en"><SyncplayProvider userId="user"><SubtitlePreferencesProvider><VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} /></SubtitlePreferencesProvider></SyncplayProvider></I18nProvider>);
		expect(getByRole("button", { name: "Groups" })).toBeInTheDocument();
	});

	it("locks document scrolling while the player is open and restores it on close", () => {
		document.documentElement.style.overflow = "auto";
		document.body.style.overflow = "scroll";
		const { unmount } = render(
			<I18nProvider locale="en">
				<SubtitlePreferencesProvider>
					<VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} />
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
					<VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} />
				</SubtitlePreferencesProvider>
			</I18nProvider>,
		);

		const gradient = container.querySelector(".bg-gradient-to-b");
		expect(gradient).toHaveClass("opacity-100");
		fireEvent.pointerMove(container.firstElementChild!);
		act(() => vi.advanceTimersByTime(2501));
		expect(gradient).toHaveClass("opacity-0");
	});

	it("keeps the active skip intro action interactive independently of controls", () => {
		const onSkip = vi.fn();
		const { getByRole } = render(<SkipMarkerActions markers={{ intro: { start: 10, end: 20 } }} currentTime={12} labelIntro="Skip Intro" labelOutro="Skip Outro" onSkip={onSkip} />);
		const skipButton = getByRole("button", { name: "Skip Intro" });
		fireEvent.click(skipButton);
		expect(onSkip).toHaveBeenCalledOnce();
		expect(skipButton).toHaveClass("pointer-events-auto");
	});

	it("loads subtitle preferences when playback opens", async () => {
        const style = { fontFamily: "sans", bold: false, textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
		render(<I18nProvider locale="en"><SubtitlePreferencesProvider><VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} /></SubtitlePreferencesProvider></I18nProvider>);

		expect(fetchMock).toHaveBeenCalledWith("/api/preferences/subtitles", { cache: "no-store" });
	});


	it("stacks active cues and applies the saved custom appearance", () => {
		const { getAllByTestId } = render(<CustomSubtitleCue cues={[
			{ start: 1, end: 3, text: "First line" },
			{ start: 1, end: 3, text: "Second line" },
			{ start: 3, end: 4, text: "Next line" },
		]} time={2} style={{ fontFamily: "serif", bold: true, textScale: 160, fontColor: "#aabbcc", borderSize: 2, borderColor: "#112233", backgroundColor: "#445566", backgroundOpacity: 40 }} />);

		const cues = getAllByTestId("subtitle-cue");
		expect(cues).toHaveLength(2);
		expect(cues.map((cue) => cue.textContent)).toEqual(["First line", "Second line"]);
		expect(cues[0]).toHaveStyle({ color: "rgb(170, 187, 204)" });
		expect(cues[0].getAttribute("style")).toContain("font-weight: 700");
		expect(cues[0].getAttribute("style")).toContain("background-color: rgba(68, 85, 102, 0.4)");
		expect(cues[0].getAttribute("style")).toContain('font-family: Georgia, "Times New Roman", serif');
		expect(cues[0].getAttribute("style")).toContain("font-size: clamp(16px, 8vh, 72px)");
		expect(cues[0].getAttribute("style")).not.toContain("-webkit-text-stroke");
		expect(cues[0].getAttribute("style")).toContain("text-shadow: -2px -2px 0 #112233");
		expect(cues[0].getAttribute("style")).toContain("2px 2px 0 #112233");
	});

	it("does not show an ending cue at the next cue boundary", () => {
		const { queryByTestId } = render(<CustomSubtitleCue cues={[{ start: 1, end: 2, text: "Finished" }]} time={2} style={{ fontFamily: "sans", bold: false, textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 }} />);
		expect(queryByTestId("subtitle-overlay")).not.toBeInTheDocument();
	});

	it("disables HLS and browser-native subtitle tracks", () => {
		expect(HLS_TEXT_TRACK_CONFIG).toMatchObject({ enableWebVTT: false, enableCEA708Captions: false, renderTextTracksNatively: false });
		const tracks = [{ mode: "showing" }, { mode: "hidden" }];
		disableNativeSubtitleTracks({ textTracks: tracks } as unknown as HTMLVideoElement);
		expect(tracks).toEqual([{ mode: "disabled" }, { mode: "disabled" }]);
	});

	it("ignores fullscreen exit failures when the document is no longer active", async () => {
		const exitFullscreen = vi.fn().mockRejectedValue(new DOMException("Document not active"));
		Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exitFullscreen });

		exitFullscreenSafely();
		await expect(Promise.resolve()).resolves.toBeUndefined();
		delete (document as Document & { exitFullscreen?: () => Promise<void> }).exitFullscreen;
	});
});
