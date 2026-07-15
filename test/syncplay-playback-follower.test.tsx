import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";
import type { SyncplayGroup } from "@/lib/syncplay";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const state = vi.hoisted(() => ({ pathname: "/library", active: null as SyncplayGroup | null }));
const setWatchingTogether = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("next/navigation", () => ({
	usePathname: () => state.pathname,
	useRouter: () => router,
}));
vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({ active: state.active, setWatchingTogether }),
}));

const member = (watchingTogether = true) => ({
	userId: "viewer",
	username: "Sam",
	watchingTogether,
	viewing: false,
	loading: false,
	role: "viewer" as const,
});
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
	mediaGeneration: 1,
	updatedAt: 0,
	members: [member()],
	...overrides,
});
const session = { token: "token", userId: "viewer", username: "Sam" };

describe("SyncplayPlaybackFollower", () => {
	beforeEach(() => {
		router.push.mockReset();
		setWatchingTogether.mockClear();
		state.pathname = "/library";
		state.active = null;
	});

	it("opens the current media for a member who is viewing together", async () => {
		state.active = group();
		render(<SyncplayPlaybackFollower session={session} />);
		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play/episode-2"));
	});

	it("does not redirect a member who chose to browse", () => {
		state.active = group({ members: [member(false)] });
		render(<SyncplayPlaybackFollower session={session} />);
		expect(router.push).not.toHaveBeenCalled();
	});

	it("marks a member as browsing when they leave the same media generation", async () => {
		state.pathname = "/play/episode-2";
		state.active = group();
		const view = render(<SyncplayPlaybackFollower session={session} />);
		state.pathname = "/library";
		view.rerender(<SyncplayPlaybackFollower session={session} />);
		await waitFor(() => expect(setWatchingTogether).toHaveBeenCalledWith(false));
		expect(router.push).not.toHaveBeenCalled();
	});

	it("follows a new generation instead of treating it as a player exit", async () => {
		state.pathname = "/play/episode-1";
		state.active = group({ itemId: "episode-1", mediaGeneration: 1 });
		const view = render(<SyncplayPlaybackFollower session={session} />);
		act(() => {
			state.active = group({ itemId: "episode-2", mediaGeneration: 2 });
		});
		view.rerender(<SyncplayPlaybackFollower session={session} />);
		await waitFor(() => expect(router.push).toHaveBeenCalledWith("/play/episode-2"));
		expect(setWatchingTogether).not.toHaveBeenCalled();
	});
});
