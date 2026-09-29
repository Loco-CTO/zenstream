import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	PlaybackBehaviorPreferencesProvider,
	playbackBehaviorStorageKey,
} from "@/components/playback-behavior-preferences-provider";
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

	let restoreFullscreenApi: (() => void) | undefined;

	afterEach(() => {
		restoreFullscreenApi?.();
		restoreFullscreenApi = undefined;
		window.localStorage.removeItem(playbackBehaviorStorageKey(session.userId));
		vi.restoreAllMocks();
	});

	function mockFullscreenApi() {
		const fullscreenElementDescriptor = Object.getOwnPropertyDescriptor(
			document,
			"fullscreenElement",
		);
		const exitFullscreenDescriptor = Object.getOwnPropertyDescriptor(
			document,
			"exitFullscreen",
		);
		const requestFullscreenDescriptor = Object.getOwnPropertyDescriptor(
			HTMLElement.prototype,
			"requestFullscreen",
		);
		let activeElement: Element | null = null;
		const requestFullscreen = vi.fn(function (this: HTMLElement) {
			activeElement = this;
			document.dispatchEvent(new Event("fullscreenchange"));
			return Promise.resolve();
		});
		const exitFullscreen = vi.fn(() => {
			activeElement = null;
			document.dispatchEvent(new Event("fullscreenchange"));
			return Promise.resolve();
		});
		Object.defineProperty(document, "fullscreenElement", {
			configurable: true,
			get: () => activeElement,
		});
		Object.defineProperty(document, "exitFullscreen", {
			configurable: true,
			value: exitFullscreen,
		});
		Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
			configurable: true,
			value: requestFullscreen,
		});
		return {
			get activeElement() {
				return activeElement;
			},
			exitFullscreen,
			restore() {
				if (fullscreenElementDescriptor)
					Object.defineProperty(
						document,
						"fullscreenElement",
						fullscreenElementDescriptor,
					);
				else
					delete (document as Document & {
						fullscreenElement?: Element | null;
					}).fullscreenElement;
				if (exitFullscreenDescriptor)
					Object.defineProperty(
						document,
						"exitFullscreen",
						exitFullscreenDescriptor,
					);
				else
					delete (document as Document & {
						exitFullscreen?: () => Promise<void>;
					}).exitFullscreen;
				if (requestFullscreenDescriptor)
					Object.defineProperty(
						HTMLElement.prototype,
						"requestFullscreen",
						requestFullscreenDescriptor,
					);
				else
					delete (HTMLElement.prototype as HTMLElement & {
						requestFullscreen?: () => Promise<void>;
					}).requestFullscreen;
			},
		};
	}

	it.each([
		{ label: "automatic next episode playback", autoplayNextEpisode: true },
		{ label: "manual Next Up playback", autoplayNextEpisode: false },
	])("keeps fullscreen during $label", async ({ autoplayNextEpisode }) => {
		const episode2 = {
			Id: "episode-2",
			Name: "Episode 2",
			Type: "Episode",
			SeriesId: "series-1",
			ParentIndexNumber: 1,
			IndexNumber: 2,
			RunTimeTicks: 120 * 10_000_000,
		} as MediaItem;
		const episode3 = {
			...episode2,
			Id: "episode-3",
			Name: "Episode 3",
			IndexNumber: 3,
		} as MediaItem;
		mocks.getSeasons.mockResolvedValue([
			{ Id: "season-1", Type: "Season", IndexNumber: 1 } as MediaItem,
		]);
		mocks.getEpisodes.mockResolvedValue([episode2, episode3]);
		mocks.getPlaybackPreference.mockResolvedValue({
			audioLanguage: null,
			subtitleLanguage: null,
			audioLanguages: [],
			subtitleLanguages: [],
		});
		mocks.getPlaybackInfo.mockImplementation(async (_session, itemId) => ({
			source: { ...negotiatedSource, url: `/media/${itemId}.mp4` },
		}));
		window.localStorage.setItem(
			playbackBehaviorStorageKey(session.userId),
			JSON.stringify({ autoplayNextEpisode, autoplayBrowse: true }),
		);
		const fullscreen = mockFullscreenApi();
		restoreFullscreenApi = fullscreen.restore;
		const episodeData = {
			item: episode2,
			seasons: [],
			episodes: [],
			similar: [],
		} satisfies DetailData;
		const view = render(
			<I18nProvider locale="en">
				<ToastProvider>
					<PlaybackBehaviorPreferencesProvider userId={session.userId}>
						<SubtitlePreferencesProvider>
							<PlayerPage initialData={episodeData} session={session} />
						</SubtitlePreferencesProvider>
					</PlaybackBehaviorPreferencesProvider>
				</ToastProvider>
			</I18nProvider>,
		);
		const fullscreenHost = view.getByTestId("player-fullscreen-host");
		await waitFor(() => expect(mocks.getPlaybackInfo).toHaveBeenCalled());
		fireEvent.click(view.getByRole("button", { name: "Fullscreen" }));
		await waitFor(() => expect(fullscreen.activeElement).toBe(fullscreenHost));

		const video = view.container.querySelector("video");
		if (!video) throw new Error("The player did not render a video element.");
		Object.defineProperty(video, "duration", {
			configurable: true,
			value: 120,
		});
		Object.defineProperty(video, "currentTime", {
			configurable: true,
			writable: true,
			value: 119,
		});
		fireEvent.loadedMetadata(video);
		fireEvent.timeUpdate(video);
		await waitFor(() => expect(view.getByTestId("next-up")).toBeInTheDocument());

		if (autoplayNextEpisode) {
			Object.defineProperty(video, "currentTime", {
				configurable: true,
				writable: true,
				value: 120,
			});
			fireEvent.ended(video);
		} else {
			fireEvent.click(view.getByRole("button", { name: /Play next/i }));
		}

		await waitFor(() =>
			expect(
				view.getByRole("heading", { name: "Episode 3" }),
			).toBeInTheDocument(),
		);
		expect(view.getByTestId("player-fullscreen-host")).toBe(fullscreenHost);
		expect(fullscreen.activeElement).toBe(fullscreenHost);
		expect(fullscreen.exitFullscreen).not.toHaveBeenCalled();
		expect(
			view.getByRole("button", { name: "Exit fullscreen" }),
		).toBeInTheDocument();

		view.unmount();
		expect(fullscreen.exitFullscreen).toHaveBeenCalledOnce();
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
