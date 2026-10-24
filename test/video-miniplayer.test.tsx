import { useEffect } from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	miniGeometry,
	nearestMiniCorner,
	readMiniPlacement,
	writeMiniPlacement,
} from "@/lib/video-miniplayer";
import { MiniPlayerFrame } from "@/components/player/mini-player-frame";
import { VideoPlaybackHost } from "@/components/player/video-playback-host";
import type { DetailData } from "@/lib/media-api";

const mocks = vi.hoisted(() => ({
	mounted: vi.fn(),
	disposed: vi.fn(),
	replace: vi.fn(),
	push: vi.fn(),
	continue: true,
}));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock("@/components/pages/player-page", () => ({
	PlayerPage: (props: {
		minimized: boolean;
		onDismiss: () => void;
		onBack: () => void;
		onExpand: () => void;
	}) => {
		useEffect(() => {
			mocks.mounted();
			return () => mocks.disposed();
		}, []);
		return (
			<>
				<video data-testid="persistent-video" />
				<button onClick={props.onDismiss}>Close</button>
				<button onClick={props.onBack}>Back</button>
				<button onClick={props.onExpand}>Expand</button>
			</>
		);
	},
}));
vi.mock("@/components/player/video-player", () => ({
	exitFullscreenSafely: vi.fn(),
}));
vi.mock("@/components/syncplay/playback-follower", () => ({
	SyncplayPlaybackFollower: () => null,
}));
vi.mock("@/components/playback-behavior-preferences-provider", () => ({
	usePlaybackBehaviorPreferences: () => ({
		continueVideoInMiniPlayer: mocks.continue,
	}),
}));
vi.mock("@/lib/media-api", () => ({ fetchPlayData: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.continue = true;
	localStorage.clear();
});

describe("mini-player bounds", () => {
	it.each([
		[1920, 1080],
		[800, 400],
		[360, 640],
	])("fits a quarter viewport at %s x %s with edge padding", (width, height) => {
		for (const corner of [
			"top-left",
			"top-right",
			"bottom-left",
			"bottom-right",
		] as const) {
			const rect = miniGeometry({ corner, width: 99999 }, { width, height });
			expect(rect.width).toBeLessThanOrEqual(width / 2);
			expect(rect.height).toBeLessThanOrEqual(height / 2);
			expect(rect.x).toBeGreaterThanOrEqual(16);
			expect(rect.y).toBeGreaterThanOrEqual(16);
			expect(rect.x + rect.width).toBeLessThanOrEqual(width - 16);
			expect(rect.y + rect.height).toBeLessThanOrEqual(height - 16);
		}
	});
	it("chooses the nearest corner from the player center", () => {
		expect(
			nearestMiniCorner(30, 40, 240, 180, { width: 1200, height: 800 }),
		).toBe("top-left");
		expect(
			nearestMiniCorner(800, 500, 240, 180, { width: 1200, height: 800 }),
		).toBe("bottom-right");
	});
	it("remembers placement and rejects corrupt persisted values", () => {
		writeMiniPlacement({ corner: "top-left", width: 400 });
		expect(readMiniPlacement()).toEqual({ corner: "top-left", width: 400 });
		localStorage.setItem(
			"zenstream:video:miniplayer",
			'{"corner":"invalid","width":1e99}',
		);
		expect(readMiniPlacement().corner).toBe("bottom-right");
	});
});

describe("smooth release alignment", () => {
	it("animates from the drop position even when the browser reports reduced motion", () => {
		const animation = vi.fn().mockReturnValue({ cancel: vi.fn() });
		vi.stubGlobal("PointerEvent", MouseEvent);
		vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
		Object.defineProperty(Element.prototype, "animate", {
			configurable: true,
			value: animation,
		});
		Object.defineProperty(Element.prototype, "setPointerCapture", {
			configurable: true,
			value: vi.fn(),
		});
		const view = render(
			<MiniPlayerFrame minimized>
				<div>Video</div>
			</MiniPlayerFrame>,
		);
		const frame = view.getByTestId("video-player-frame");
		vi
			.spyOn(frame, "getBoundingClientRect")
			.mockReturnValue(new DOMRect(648, 497, 360, 254.5));
		fireEvent.pointerDown(frame, { button: 0, clientX: 800, clientY: 650 });
		fireEvent.pointerMove(frame, { buttons: 1, clientX: 430, clientY: 330 });
		fireEvent.pointerUp(frame, { button: 0, clientX: 430, clientY: 330 });
		expect(animation).toHaveBeenCalledOnce();
		const [keyframes, options] = animation.mock.calls[0];
		expect(keyframes[0].transform).not.toBe("translate(0px, 0px)");
		expect(keyframes[1].transform).toBe("translate(0px, 0px)");
		expect(options.duration).toBe(280);
		vi.unstubAllGlobals();
	});
});

describe("video-only mini-player frame", () => {
	it("uses the video aspect ratio without a title panel", () => {
		const view = render(
			<MiniPlayerFrame minimized>
				<div>Video</div>
			</MiniPlayerFrame>,
		);
		const frame = view.getByTestId("video-player-frame");

		expect(frame.style.height).toBe("202.5px");
		expect(frame.firstElementChild).toHaveClass("rounded-xl");
	});
});

describe("persistent video ownership", () => {
	const props = {
		playId: "movie-1",
		data: {
			item: { Id: "movie-1", Name: "Movie", Type: "Movie" },
			seasons: [],
			episodes: [],
			similar: [],
		} as unknown as DetailData,
		ready: true,
		search: "?audio=2&subtitle=off",
		session: { token: "test", userId: "user", username: "User" },
		fullscreenHostRef: { current: null },
		watchHistoryEnabled: true,
		watchHistoryLoaded: true,
	};
	it("keeps the same media element when minimizing, browsing, and expanding", () => {
		const view = render(<VideoPlaybackHost {...props} />);
		const video = view.getByTestId("persistent-video");
		view.rerender(
			<VideoPlaybackHost
				{...props}
				playId={null}
				data={null}
				ready={false}
				search="?q=new"
			/>,
		);
		expect(view.getByTestId("persistent-video")).toBe(video);
		expect(view.getByTestId("video-player-frame")).toHaveAttribute(
			"data-minimized",
			"true",
		);
		expect(view.queryByText("Movie")).not.toBeInTheDocument();
		fireEvent.click(view.getByText("Expand"));
		expect(mocks.push).toHaveBeenCalledWith("/play/movie-1?audio=2&subtitle=off");
		view.rerender(<VideoPlaybackHost {...props} />);
		expect(view.getByTestId("persistent-video")).toBe(video);
		expect(mocks.mounted).toHaveBeenCalledOnce();
		expect(mocks.disposed).not.toHaveBeenCalled();
	});
	it("closes and releases minimized playback", () => {
		const view = render(<VideoPlaybackHost {...props} />);
		view.rerender(<VideoPlaybackHost {...props} playId={null} />);
		fireEvent.click(view.getByText("Close"));
		expect(view.queryByTestId("persistent-video")).toBeNull();
		expect(mocks.disposed).toHaveBeenCalledOnce();
	});
	it("respects Stop playback when leaving the player", () => {
		mocks.continue = false;
		const view = render(<VideoPlaybackHost {...props} />);
		view.rerender(<VideoPlaybackHost {...props} playId={null} />);
		expect(view.queryByTestId("persistent-video")).toBeNull();
		expect(mocks.disposed).toHaveBeenCalledOnce();
	});
});
