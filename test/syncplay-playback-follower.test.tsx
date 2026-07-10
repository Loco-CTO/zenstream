import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";
import type { SyncplayGroup } from "@/lib/syncplay";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({ pathname: "/library", active: null as SyncplayGroup | null }));
const fetchDetailData = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
	usePathname: () => state.pathname,
	useRouter: () => router,
}));
vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({ active: state.active }),
}));
vi.mock("@/lib/jellyfin", () => ({ fetchDetailData }));

const group = (overrides: Partial<SyncplayGroup> = {}): SyncplayGroup => ({
	id: "group",
	name: "Alex's group",
	hostUserId: "host",
	hostName: "Alex",
	allowViewerControls: false,
	itemId: "episode-2",
	position: 4,
	playing: true,
	resumeWhenReady: false,
	revision: 3,
	updatedAt: 0,
	members: [],
	...overrides,
});

describe("SyncplayPlaybackFollower", () => {
	beforeEach(() => {
		router.push.mockReset();
		fetchDetailData.mockReset();
		state.pathname = "/library";
		state.active = null;
	});

	it("opens the host's episode for every member when playback begins", async () => {
		state.active = group();
		fetchDetailData.mockResolvedValue({ item: { Id: "episode-2", Type: "Episode", SeriesId: "series-1" } });

		render(<SyncplayPlaybackFollower session={{ token: "token", userId: "viewer", username: "Sam" }} />);

		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/show/series-1/episode/episode-2"));
	});

	it("opens the host's episode while the group waits for every member to load", async () => {
		state.active = group({ playing: false, resumeWhenReady: true });
		fetchDetailData.mockResolvedValue({ item: { Id: "episode-2", Type: "Episode", SeriesId: "series-1" } });

		render(<SyncplayPlaybackFollower session={{ token: "token", userId: "viewer", username: "Sam" }} />);

		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/show/series-1/episode/episode-2"));
	});

	it("does not pull members into media that is only paused", () => {
		state.active = group({ playing: false });
		render(<SyncplayPlaybackFollower session={{ token: "token", userId: "viewer", username: "Sam" }} />);

		expect(fetchDetailData).not.toHaveBeenCalled();
		expect(router.push).not.toHaveBeenCalled();
	});
});
