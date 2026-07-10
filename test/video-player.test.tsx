import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { CustomSubtitleCue, disableNativeSubtitleTracks, HLS_TEXT_TRACK_CONFIG, VideoPlayer } from "@/components/player/video-player";
import { I18nProvider } from "@/lib/i18n";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
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

	it("loads subtitle preferences when playback opens", async () => {
		const style = { fontFamily: "sans", textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
		render(<I18nProvider locale="en"><SubtitlePreferencesProvider><VideoPlayer item={{ Id: "movie", Name: "Movie", Type: "Movie" } as JellyfinItem} session={{ token: "token", userId: "user", username: "Alex" }} onClose={vi.fn()} /></SubtitlePreferencesProvider></I18nProvider>);

		expect(fetchMock).toHaveBeenCalledWith("/api/preferences/subtitles", { cache: "no-store" });
	});


	it("stacks active cues and applies the saved custom appearance", () => {
		const { getAllByTestId } = render(<CustomSubtitleCue cues={[
			{ start: 1, end: 3, text: "First line" },
			{ start: 1, end: 3, text: "Second line" },
			{ start: 3, end: 4, text: "Next line" },
		]} time={2} style={{ fontFamily: "serif", textScale: 160, fontColor: "#aabbcc", borderSize: 2, borderColor: "#112233", backgroundColor: "#445566", backgroundOpacity: 40 }} />);

		const cues = getAllByTestId("subtitle-cue");
		expect(cues).toHaveLength(2);
		expect(cues.map((cue) => cue.textContent)).toEqual(["First line", "Second line"]);
		expect(cues[0]).toHaveStyle({ color: "rgb(170, 187, 204)" });
		expect(cues[0].getAttribute("style")).toContain("background-color: rgba(68, 85, 102, 0.4)");
		expect(cues[0].getAttribute("style")).toContain('font-family: Georgia, "Times New Roman", serif');
		expect(cues[0].getAttribute("style")).toContain("font-size: clamp(16px, 8vh, 72px)");
		expect(cues[0].getAttribute("style")).not.toContain("-webkit-text-stroke");
		expect(cues[0].getAttribute("style")).toContain("text-shadow: -2px -2px 0 #112233");
		expect(cues[0].getAttribute("style")).toContain("2px 2px 0 #112233");
	});

	it("does not show an ending cue at the next cue boundary", () => {
		const { queryByTestId } = render(<CustomSubtitleCue cues={[{ start: 1, end: 2, text: "Finished" }]} time={2} style={{ fontFamily: "sans", textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 }} />);
		expect(queryByTestId("subtitle-overlay")).not.toBeInTheDocument();
	});

	it("disables HLS and browser-native subtitle tracks", () => {
		expect(HLS_TEXT_TRACK_CONFIG).toMatchObject({ enableWebVTT: false, enableCEA708Captions: false, renderTextTracksNatively: false });
		const tracks = [{ mode: "showing" }, { mode: "hidden" }];
		disableNativeSubtitleTracks({ textTracks: tracks } as unknown as HTMLVideoElement);
		expect(tracks).toEqual([{ mode: "disabled" }, { mode: "disabled" }]);
	});
});
