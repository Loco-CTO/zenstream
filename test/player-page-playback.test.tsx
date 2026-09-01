import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaybackBehaviorPreferencesProvider } from "@/components/playback-behavior-preferences-provider";
import { PlayerPage } from "@/components/pages/player-page";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";
import type {
	DetailData,
	MediaItem,
	MediaSource,
	PlaybackInfo,
} from "@/lib/media-api";
import type { SyncplayGroup } from "@/lib/syncplay";

const mocks = vi.hoisted(() => ({
	getPlaybackInfo: vi.fn(),
	getPlaybackMarkers: vi.fn(),
	getPlaybackSource: vi.fn(),
	getTrickplayInfo: vi.fn(),
	getPlaybackPreference: vi.fn(),
	getEpisodes: vi.fn(),
	getSeasons: vi.fn(),
	presence: vi.fn(),
	setWatchingTogether: vi.fn(),
	serverNow: vi.fn(),
	replace: vi.fn(),
	searchParams: new URLSearchParams(),
	active: null as SyncplayGroup | null,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		back: vi.fn(),
		push: vi.fn(),
		replace: mocks.replace,
	}),
	usePathname: () => "/play/item-1",
	useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/lib/media-api", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api");
	return {
		...actual,
		getEpisodes: mocks.getEpisodes,
		getPlaybackInfo: mocks.getPlaybackInfo,
		getPlaybackMarkers: mocks.getPlaybackMarkers,
		getPlaybackSource: mocks.getPlaybackSource,
		getSeasons: mocks.getSeasons,
		getTrickplayInfo: mocks.getTrickplayInfo,
	};
});

vi.mock("@/lib/preferences", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/preferences")>(
			"@/lib/preferences",
		);
	return { ...actual, getPlaybackPreference: mocks.getPlaybackPreference };
});

vi.mock("@/lib/player-navigation", () => ({
	getLastNonPlayerPath: () => "/",
}));

vi.mock("@/lib/syncplay", () => ({
	useSyncplay: () => ({
		active: mocks.active,
		canControl: true,
		command: vi.fn().mockResolvedValue(undefined),
		create: vi.fn().mockResolvedValue(undefined),
		currentMember: mocks.active?.members[0] ?? null,
		groups: mocks.active ? [mocks.active] : [],
		join: vi.fn().mockResolvedValue(undefined),
		leave: vi.fn().mockResolvedValue(undefined),
		presence: mocks.presence,
		refresh: vi.fn().mockResolvedValue(undefined),
		removeMember: vi.fn().mockResolvedValue(undefined),
		serverNow: mocks.serverNow,
		setControls: vi.fn().mockResolvedValue(undefined),
		setWatchingTogether: mocks.setWatchingTogether,
	}),
}));

vi.mock("@/components/syncplay/group-menu", () => ({
	SyncplayGroupMenu: () => null,
}));

describe("PlayerPage playback startup", () => {
	const session = { token: "token", userId: "user", username: "Alex" };
	const source = {
		Id: "source-1",
		MediaStreams: [
			{ Index: 1, Type: "Audio", Language: "en", IsDefault: true },
			{ Index: 1000, Type: "Subtitle", Language: "en", IsDefault: true },
		],
	} satisfies MediaSource;
	const negotiatedSource = {
		...source,
		mode: "direct" as const,
		url: "/media/item-1.mp4",
	};

	beforeEach(() => {
		mocks.searchParams = new URLSearchParams("subtitle=off");
		mocks.active = {
			id: "group-1",
			name: "Alex's group",
			hostUserId: session.userId,
			hostName: session.username,
			allowViewerControls: false,
			itemId: "item-1",
			position: 0,
			playing: false,
			resumeWhenReady: false,
			revision: 1,
			mediaGeneration: 1,
			timelineRevision: 1,
			updatedAt: 0,
			members: [
				{
					userId: session.userId,
					username: session.username,
					viewing: true,
					loading: true,
					readyGeneration: -1,
					role: "host",
				},
			],
		};
		mocks.getPlaybackSource.mockReset().mockResolvedValue(source);
		mocks.getPlaybackInfo
			.mockReset()
			.mockResolvedValue({ source: negotiatedSource } satisfies PlaybackInfo);
		mocks.getPlaybackPreference
			.mockReset()
			.mockRejectedValue(new DOMException("request aborted", "AbortError"));
		mocks.getPlaybackMarkers.mockReset().mockResolvedValue(null);
		mocks.getTrickplayInfo.mockReset().mockResolvedValue(undefined);
		mocks.getEpisodes.mockReset().mockResolvedValue([]);
		mocks.getSeasons.mockReset().mockResolvedValue([]);
		mocks.presence.mockReset().mockResolvedValue(undefined);
		mocks.setWatchingTogether.mockReset().mockResolvedValue(undefined);
		mocks.serverNow.mockReset().mockReturnValue(0);
		mocks.replace.mockReset();
		vi
			.spyOn(HTMLMediaElement.prototype, "load")
			.mockImplementation(() => undefined);
		vi
			.spyOn(HTMLMediaElement.prototype, "pause")
			.mockImplementation(() => undefined);
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("negotiates direct media and clears SyncPlay loading after an aborted preference request", async () => {
		const item = {
			Id: "item-1",
			Name: "Movie",
			Type: "Movie",
			RunTimeTicks: 120 * 10_000_000,
		} as MediaItem;
		const initialData = {
			item,
			seasons: [],
			episodes: [],
			similar: [],
		} satisfies DetailData;
		const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);

		const view = render(
			<I18nProvider locale="en">
				<ToastProvider>
					<PlaybackBehaviorPreferencesProvider userId={session.userId}>
						<SubtitlePreferencesProvider>
							<PlayerPage initialData={initialData} session={session} />
						</SubtitlePreferencesProvider>
					</PlaybackBehaviorPreferencesProvider>
				</ToastProvider>
			</I18nProvider>,
		);

		await waitFor(() => expect(mocks.getPlaybackInfo).toHaveBeenCalledOnce());
		expect(mocks.getPlaybackInfo).toHaveBeenCalledWith(
			session,
			item.Id,
			expect.objectContaining({
				audioStreamId: 1,
				startPositionSeconds: 0,
			}),
		);
		expect(warning).toHaveBeenCalledWith(
			"[Player] playback preference fallback",
			expect.objectContaining({
				itemId: item.Id,
				reason: expect.stringContaining("AbortError"),
				tracks: "default/first",
			}),
		);

		const video = view.container.querySelector("video");
		if (!video) throw new Error("The player did not render a video element.");
		await waitFor(() => expect(video.src).toContain("/media/item-1.mp4"));
		expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();

		Object.defineProperty(video, "readyState", {
			configurable: true,
			value: HTMLMediaElement.HAVE_FUTURE_DATA,
		});
		await act(async () => {
			fireEvent.canPlay(video);
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(mocks.presence).toHaveBeenCalledWith(true, false, 1, 1),
		);
	});
});
