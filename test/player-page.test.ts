import { describe, expect, it } from "vitest";
import { playbackTrackChoices } from "@/components/pages/player-page";

describe("player page track choices", () => {
	it("reads valid detail-page track choices from the player URL", () => {
		expect(
			playbackTrackChoices(new URLSearchParams("audio=2&subtitle=4")),
		).toEqual({ audio: 2, subtitle: 4 });
	});

	it("ignores invalid track choices", () => {
		expect(
			playbackTrackChoices(new URLSearchParams("audio=two&subtitle=-1")),
		).toEqual({ audio: undefined, subtitle: undefined });
	});
});
