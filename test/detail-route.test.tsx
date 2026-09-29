import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ProgressProvider } from "@/components/status/progress-indicator";
import * as mediaApi from "@/lib/media-api";
import * as preferences from "@/lib/preferences";
import * as sessionApi from "@/lib/session";
import type { DetailData, MediaItem } from "@/lib/media-api";

const navigation = vi.hoisted(() => ({
	pathname: "/show/show-1",
	searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useSearchParams: () => navigation.searchParams,
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/layout/mobile-nav", () => ({
	MobileNav: () => null,
}));

vi.mock("@/components/layout/navbar", () => ({
	Navbar: () => null,
}));

vi.mock("@/components/pages/detail-page", () => ({
	DetailPage: ({ initialData }: { initialData: DetailData }) => (
		<div data-testid="detail-page">{initialData.item.Name}</div>
	),
}));

vi.mock("@/components/pages/player-page", () => ({
	PlayerPage: ({
		initialData,
		fullscreenHostRef,
	}: {
		initialData: DetailData;
		fullscreenHostRef?: { current: HTMLDivElement | null };
	}) => (
		<div data-testid="player-page">
			{initialData.item.Name}
			<button
				aria-label="Enter fullscreen"
				onClick={() => {
					const host = fullscreenHostRef?.current;
					if (host) void host.requestFullscreen?.();
				}}
			/>
		</div>
	),
}));

vi.mock("@/components/pages/settings-page", () => ({
	SettingsPage: () => null,
}));

vi.mock("@/components/audio/audio-player-provider", () => ({
	AudioPlayerProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/audio/audio-player-bar", () => ({
	AudioPlayerBar: () => null,
}));

vi.mock("@/lib/syncplay", () => ({
	SyncplayProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/syncplay/playback-follower", () => ({
	SyncplayPlaybackFollower: () => null,
}));

function detailData(name: string): DetailData {
	return {
		item: {
			Id: "show-1",
			Name: name,
			Type: "Movie",
			LibraryId: "shows",
		} as MediaItem,
		seasons: [],
		episodes: [],
		similar: [],
	};
}

function playData(id: string, name: string, index: number): DetailData {
	return {
		item: {
			Id: id,
			Name: name,
			Type: "Episode",
			SeriesId: "series-1",
			IndexNumber: index,
			ParentIndexNumber: 1,
		} as MediaItem,
		seasons: [],
		episodes: [],
		similar: [],
	};
}

let restoreFullscreenApi: (() => void) | undefined;

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
	let requestedElement: Element | null = null;
	const requestFullscreen = vi.fn(() => {
		activeElement = requestedElement;
		return Promise.resolve();
	});
	const exitFullscreen = vi.fn(() => {
		activeElement = null;
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
		setTarget(element: Element) {
			requestedElement = element;
		},
		restore() {
			if (fullscreenElementDescriptor)
				Object.defineProperty(
					document,
					"fullscreenElement",
					fullscreenElementDescriptor,
				);
			else Reflect.deleteProperty(document, "fullscreenElement");
			if (exitFullscreenDescriptor)
				Object.defineProperty(document, "exitFullscreen", exitFullscreenDescriptor);
			else Reflect.deleteProperty(document, "exitFullscreen");
			if (requestFullscreenDescriptor)
				Object.defineProperty(
					HTMLElement.prototype,
					"requestFullscreen",
					requestFullscreenDescriptor,
				);
			else Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
		},
	};
}

describe("detail route refreshes", () => {
	afterEach(() => {
		restoreFullscreenApi?.();
		restoreFullscreenApi = undefined;
	});

	beforeEach(() => {
		navigation.pathname = "/show/show-1";
		navigation.searchParams = new URLSearchParams();
		vi.restoreAllMocks();
		vi.spyOn(sessionApi, "getAuthSession").mockReturnValue({
			token: "",
			userId: "user",
			username: "Alex",
		});
		vi.spyOn(mediaApi, "validateBrowserSession").mockResolvedValue({
			token: "",
			userId: "user",
			username: "Alex",
		});
		vi.spyOn(preferences, "getStoredLocale").mockReturnValue("en");
		vi.spyOn(preferences, "getLocalePreference").mockResolvedValue("en");
		vi.spyOn(preferences, "getMetadataLanguages").mockResolvedValue(["en"]);
		vi.spyOn(preferences, "getMetadataLanguagePreference").mockResolvedValue({
			mode: "auto",
			language: "en",
		});
		vi.spyOn(preferences, "getPlaybackPreference").mockResolvedValue({
			audioLanguage: null,
			subtitleLanguage: null,
			audioLanguages: [],
			subtitleLanguages: [],
		});
		vi.spyOn(preferences, "getWatchHistoryPreference").mockResolvedValue({
			enabled: true,
		});
		vi.spyOn(sessionApi, "setAuthCookies").mockImplementation(() => undefined);
		vi.spyOn(mediaApi, "primeArtworkTicket").mockResolvedValue(null);
		vi.spyOn(mediaApi, "primeResourceTicket").mockResolvedValue(null);
	});

	it("retries a detail load aborted by catalog invalidation without showing an error", async () => {
		let rejectInitial!: (reason: unknown) => void;
		const fetchDetail = vi
			.spyOn(mediaApi, "fetchDetailData")
			.mockImplementationOnce(
				() =>
					new Promise<DetailData>((_resolve, reject) => {
						rejectInitial = reject;
					}),
			)
			.mockResolvedValueOnce(detailData("Catalog refresh"))
			.mockResolvedValueOnce(detailData("Recovered title"));

		render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() => expect(fetchDetail).toHaveBeenCalledTimes(1));
		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { reason: "refresh", rootEntityId: "show-1" },
				}),
			);
			rejectInitial(
				new DOMException("This signal is aborted without reason", "AbortError"),
			);
		});

		await waitFor(() =>
			expect(screen.getByTestId("detail-page")).toHaveTextContent(
				"Recovered title",
			),
		);
		expect(fetchDetail).toHaveBeenCalledTimes(3);
		expect(
			screen.queryByText("This signal is aborted without reason"),
		).not.toBeInTheDocument();
	});

	it("aborts detail work when leaving the route and starts a fresh load on return", async () => {
		let firstSignal: AbortSignal | undefined;
		const fetchDetail = vi
			.spyOn(mediaApi, "fetchDetailData")
			.mockImplementationOnce(
				(_session, _itemId, _seasonId, requestSignal) =>
					new Promise<DetailData>((_resolve, reject) => {
						firstSignal = requestSignal;
						requestSignal?.addEventListener(
							"abort",
							() => reject(new DOMException("Aborted", "AbortError")),
							{ once: true },
						);
					}),
			)
			.mockResolvedValueOnce(detailData("Fresh title"));

		const view = render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() => {
			expect(fetchDetail).toHaveBeenCalledTimes(1);
			expect(firstSignal).toBeDefined();
		});

		await act(async () => {
			navigation.pathname = "/settings";
			view.rerender(
				<ProgressProvider>
					<AppShell />
				</ProgressProvider>,
			);
		});
		await waitFor(() => expect(firstSignal?.aborted).toBe(true));

		await act(async () => {
			navigation.pathname = "/show/show-1";
			view.rerender(
				<ProgressProvider>
					<AppShell />
				</ProgressProvider>,
			);
		});

		await waitFor(() => expect(fetchDetail).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(screen.getByTestId("detail-page")).toHaveTextContent("Fresh title"),
		);
	});

	it("keeps fullscreen mounted while the next episode route loads", async () => {
		const episode2 = playData("episode-2", "Episode 2", 2);
		const episode3 = playData("episode-3", "Episode 3", 3);
		let resolveEpisode3!: (data: DetailData) => void;
		const episode3Load = new Promise<DetailData>((resolve) => {
			resolveEpisode3 = resolve;
		});
		const fetchPlayData = vi
			.spyOn(mediaApi, "fetchPlayData")
			.mockImplementation((_session, itemId) =>
				itemId === "episode-2" ? Promise.resolve(episode2) : episode3Load,
			);
		const fullscreen = mockFullscreenApi();
		restoreFullscreenApi = fullscreen.restore;
		navigation.pathname = "/play/episode-2";
		const view = render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);
		const host = await screen.findByTestId("player-fullscreen-host");
		await waitFor(() =>
			expect(screen.getByTestId("player-page")).toHaveTextContent("Episode 2"),
		);
		fullscreen.setTarget(host);
		fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
		await waitFor(() => expect(fullscreen.activeElement).toBe(host));

		await act(async () => {
			navigation.pathname = "/play/episode-3";
			view.rerender(
				<ProgressProvider>
					<AppShell />
				</ProgressProvider>,
			);
		});
		await waitFor(() =>
			expect(fetchPlayData).toHaveBeenCalledWith(expect.anything(), "episode-3"),
		);
		await waitFor(() =>
			expect(screen.getByTestId("player-route-loading")).toBeInTheDocument(),
		);
		expect(screen.getByTestId("player-fullscreen-host")).toBe(host);
		expect(fullscreen.activeElement).toBe(host);
		expect(fullscreen.exitFullscreen).not.toHaveBeenCalled();

		await act(async () => {
			resolveEpisode3(episode3);
			await episode3Load;
		});
		await waitFor(() =>
			expect(screen.getByTestId("player-page")).toHaveTextContent("Episode 3"),
		);
		expect(screen.getByTestId("player-fullscreen-host")).toBe(host);
		expect(fullscreen.activeElement).toBe(host);
		expect(fullscreen.exitFullscreen).not.toHaveBeenCalled();

		await act(async () => {
			navigation.pathname = "/settings";
			view.rerender(
				<ProgressProvider>
					<AppShell />
				</ProgressProvider>,
			);
		});
		await waitFor(() => expect(fullscreen.exitFullscreen).toHaveBeenCalledOnce());
	});
});
