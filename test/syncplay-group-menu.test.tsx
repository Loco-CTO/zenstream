import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncplayGroupMenu } from "@/components/syncplay/group-menu";

const push = vi.hoisted(() => vi.fn());
const setWatchingTogether = vi.hoisted(() =>
	vi.fn().mockResolvedValue(undefined),
);
const syncplayState = vi.hoisted(() => ({
	groups: [] as (typeof active)[],
	active: null as typeof active | null,
}));
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
const publicGroup = {
	...active,
	id: "public-group",
	name: "Public group",
	members: [{ ...currentMember, userId: "host" }],
};

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string) =>
			({
				syncplayGroups: "Groups",
				syncplayReturnToView: "Return to view",
				syncplayWatching: "Watching",
				syncplayViewingTogether: "Viewing together",
				syncplayBrowsing: "Browsing",
				leaveGroup: "Leave group",
				createGroup: "Create group",
				allowViewerControls: "Allow viewer controls",
			})[key] ?? key,
	}),
}));
vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({
		groups: syncplayState.groups,
		active: syncplayState.active,
		currentMember: syncplayState.active ? currentMember : null,
		refresh: vi.fn().mockResolvedValue(undefined),
		setWatchingTogether,
		create: vi.fn(),
		join: vi.fn(),
		leave: vi.fn(),
		setControls: vi.fn(),
		removeMember: vi.fn(),
	}),
}));

describe("SyncplayGroupMenu", () => {
	beforeEach(() => {
		syncplayState.groups = [active];
		syncplayState.active = active;
	});
	it("always offers Return to view to the browsing participant", () => {
		render(<SyncplayGroupMenu userId="viewer" />);
		fireEvent.click(screen.getByRole("button", { name: "Groups" }));
		fireEvent.click(screen.getByRole("button", { name: "Return to view" }));
		expect(setWatchingTogether).toHaveBeenCalledWith(true);
		expect(push).toHaveBeenCalledWith("/play/episode-2");
	});

	it("only shows group info and Join view for a non-member", () => {
		syncplayState.groups = [publicGroup];
		syncplayState.active = null;
		render(<SyncplayGroupMenu userId="viewer" />);
		fireEvent.click(screen.getByRole("button", { name: "Groups" }));
		expect(screen.getByText("Public group")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Join view" }),
		).toBeInTheDocument();
		expect(screen.queryByText("Viewer")).not.toBeInTheDocument();
		expect(screen.queryByText("Viewing together")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Return to view" }),
		).not.toBeInTheDocument();
	});
});
