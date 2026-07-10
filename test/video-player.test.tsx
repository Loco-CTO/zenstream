import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { nativeSubtitleStyles, VideoPlayer } from "@/components/player/video-player";
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

	it("scales native captions as a percentage and applies a real stroke", () => {
		const css = nativeSubtitleStyles(200, "#ffffff", 4, "#000000", "#000000", 0);
		expect(css).toContain("font-size: 200% !important");
		expect(css).toContain("-webkit-text-stroke: 4px #000000 !important");
	});
});
