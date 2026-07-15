import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncplayGroupMenu } from "@/components/syncplay/group-menu";

const push = vi.hoisted(() => vi.fn());
const setWatchingTogether = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const currentMember = {
	userId: "viewer",
	participantId: "this-tab",
	username: "Viewer",
	watchingTogether: false,
	viewing: false,
	loading: false,
	role: "viewer" as const,
};
const active = {
	id: "group",
	name: "Host's group",
	hostUserId: "host",
	hostName: "Host",
	allowViewerControls: false,
	itemId: "episode-2",
	position: 12,
	playing: true,
	resumeWhenReady: false,
	revision: 3,
	mediaGeneration: 2,
	updatedAt: 0,
	members: [currentMember],
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string) => ({
			syncplayGroups: "Groups",
			syncplayReturnToView: "Return to view",
			syncplayWatching: "Watching",
			syncplayViewingTogether: "Viewing together",
			syncplayBrowsing: "Browsing",
			leaveGroup: "Leave group",
			createGroup: "Create group",
			allowViewerControls: "Allow viewer controls",
		}[key] ?? key),
	}),
}));
vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({
		groups: [active], active, currentMember, setWatchingTogether,
		create: vi.fn(), join: vi.fn(), leave: vi.fn(), setControls: vi.fn(), removeMember: vi.fn(),
	}),
}));

describe("SyncplayGroupMenu", () => {
	it("always offers Return to view to the browsing participant", () => {
		render(<SyncplayGroupMenu userId="viewer" />);
		fireEvent.click(screen.getByRole("button", { name: "Groups" }));
		fireEvent.click(screen.getByRole("button", { name: "Return to view" }));
		expect(setWatchingTogether).toHaveBeenCalledWith(true);
		expect(push).toHaveBeenCalledWith("/play/episode-2");
	});
});
