import { describe, expect, it } from "vitest";
import { playbackTrackChoices } from "@/components/pages/player-page";
import {
	preferredSubtitleIndex,
	preferredTrackIndex,
} from "@/lib/playback-preferences";

describe("player page track choices", () => {
	it("reads valid detail-page track choices from the player URL", () => {
		expect(
			playbackTrackChoices(new URLSearchParams("audio=2&subtitle=4")),
		).toEqual({ audio: 2, subtitle: 4 });
	});

	it("preserves an explicit subtitles-off choice", () => {
		expect(playbackTrackChoices(new URLSearchParams("subtitle=off"))).toEqual({
			audio: undefined,
			subtitle: null,
		});
		expect(playbackTrackChoices(new URLSearchParams())).toEqual({
			audio: undefined,
			subtitle: undefined,
		});
	});

	it("ignores invalid track choices", () => {
		expect(
			playbackTrackChoices(new URLSearchParams("audio=two&subtitle=-1")),
		).toEqual({ audio: undefined, subtitle: undefined });
	});

	it("prefers the saved language, then the marked default, then the first track", () => {
		const tracks = [
			{ Index: 3, Language: "ja", IsDefault: false },
			{ Index: 7, Language: "en", IsDefault: true },
		];
		expect(preferredTrackIndex(tracks, "ja")).toBe(3);
		expect(preferredTrackIndex(tracks, "fr")).toBe(7);
		expect(preferredSubtitleIndex(tracks, "off")).toBeNull();
	});
});
