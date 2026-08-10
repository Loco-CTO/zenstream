import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
	PlayerPage,
	playbackTrackChoices,
} from "@/components/pages/player-page";

const mocks = vi.hoisted(() => ({ videoPlayer: vi.fn(() => null) }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({ active: null, setWatchingTogether: vi.fn() }),
}));
vi.mock("@/components/player/video-player", () => ({
	VideoPlayer: mocks.videoPlayer,
}));

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

	it("preserves an explicit subtitles-off choice", () => {
		expect(
			playbackTrackChoices(new URLSearchParams("audio=2&subtitle=off")),
		).toEqual({ audio: 2, subtitle: null });
	});

	it("delegates negotiation to the mounted video player", () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		render(
			createElement(PlayerPage, {
				initialData: {
					item: { Id: "movie-1", Name: "Movie", Type: "Movie" },
				} as never,
				session: { token: "token", userId: "user", username: "Alex" },
			}),
		);

		expect(mocks.videoPlayer).toHaveBeenCalledOnce();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
