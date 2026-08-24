import {
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DetailPage,
	playbackPath,
	syncplayMediaStartCommand,
} from "@/components/pages/detail-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import type { DetailData, MediaItem } from "@/lib/media-api";

const session = { token: "token", userId: "user", username: "Alex" };
const router = vi.hoisted(() => ({
	back: vi.fn(),
	push: vi.fn(),
	replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

describe("detail views", () => {
	beforeEach(() => {
		router.back.mockClear();
		router.push.mockClear();
		router.replace.mockClear();
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => new Response(null, { status: 204 })),
		);
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("includes detail track selections in the player path", () => {
		expect(playbackPath("movie", { audio: 2, subtitle: 4 })).toBe(
			"/play/movie?audio=2&subtitle=4",
		);
		expect(playbackPath("movie", { subtitle: 4 })).toBe("/play/movie?subtitle=4");
		expect(playbackPath("movie", { subtitle: null })).toBe(
			"/play/movie?subtitle=off",
		);
	});

	it("shows the downloader after off without changing the selected track", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "matched", hasLocalSubtitle: false },
			streams: [
				{ index: 1, type: "audio", tags: { title: "English" } },
				{ index: 2, type: "subtitle", tags: { title: "Japanese" } },
			],
		});
		renderDetail({
			item: episode("episode-downloader", 1),
			seasons: [],
			episodes: [],
			similar: [],
		});

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		const selector = await screen.findByRole("combobox", {
			name: "Subtitles",
		});
		fireEvent.click(selector);
		const options = screen.getAllByRole("option");
		expect(options.map((option) => option.textContent)).toEqual([
			"Subtitles off",
			"Find subtitles",
			"Japanese",
		]);

		fireEvent.click(screen.getByRole("option", { name: "Find subtitles" }));
		expect(
			screen.getByRole("dialog", { name: "Subtitle downloader" }),
		).toBeInTheDocument();
		expect(selector).toHaveTextContent("Japanese");
	});

	it("shows search results, keeps the modal open, and reports a queued download", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "matched", hasLocalSubtitle: false },
			streams: [
				{ index: 1, type: "audio", tags: { title: "English" } },
				{ index: 2, type: "subtitle", tags: { title: "Japanese" } },
			],
			search: {
				state: "matched",
				sourceId: "source-1",
				matches: [
					{
						matchId: "match-1",
						name: "Japanese subtitle",
						releaseName: "[SubsPlease] Show - 01 [1080p].srt",
						language: "ja",
						provider: "opensubtitles",
						score: 86,
						uploader: "excaliburrr",
						format: "srt",
					},
				],
			},
		});
		renderDetail({
			item: episode("episode-results", 1),
			seasons: [],
			episodes: [],
			similar: [],
		});

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitles" }));
		fireEvent.click(screen.getByRole("option", { name: "Find subtitles" }));
		fireEvent.click(screen.getByRole("button", { name: "Find subtitles" }));

		await screen.findByText("[SubsPlease] Show - 01 [1080p].srt");
		expect(
			screen.getByText("86% · ja · opensubtitles · excaliburrr"),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Download" }));

		await waitFor(() =>
			expect(
				screen.getByText("Download queued; the library will refresh shortly"),
			).toBeInTheDocument(),
		);
		expect(
			screen.getByRole("dialog", { name: "Subtitle downloader" }),
		).toBeInTheDocument();
		expect(playback.downloadRequested()).toBe(true);
	});

	it("shows no-match and search-error states inside the modal", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "matched" },
			streams: [{ index: 1, type: "audio" }],
			search: { state: "matched", sourceId: "source-1", matches: [] },
		});
		renderDetail({
			item: episode("episode-no-match", 1),
			seasons: [],
			episodes: [],
			similar: [],
		});

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitles" }));
		fireEvent.click(screen.getByRole("option", { name: "Find subtitles" }));
		fireEvent.click(screen.getByRole("button", { name: "Find subtitles" }));
		expect(
			await screen.findByText("No subtitle matches were found"),
		).toBeInTheDocument();

		playback.failSearch = true;
		fireEvent.click(screen.getByRole("button", { name: "Find subtitles" }));
		expect(
			await screen.findByText("Could not search for subtitles"),
		).toBeInTheDocument();
	});

	it("hides the selector when an episode has no matched downloader or tracks", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "unmatched" },
			streams: [{ index: 1, type: "audio" }],
		});
		renderDetail({
			item: episode("episode-unmatched", 1),
			seasons: [],
			episodes: [],
			similar: [],
		});

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		expect(
			screen.queryByRole("combobox", { name: "Subtitles" }),
		).not.toBeInTheDocument();
	});

	it("keeps existing subtitle tracks without adding the downloader when unmatched", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "ambiguous" },
			streams: [
				{ index: 1, type: "audio" },
				{ index: 2, type: "subtitle", tags: { title: "English" } },
			],
		});
		renderDetail({
			item: episode("episode-existing-track", 1),
			seasons: [],
			episodes: [],
			similar: [],
		});

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		const selector = await screen.findByRole("combobox", {
			name: "Subtitles",
		});
		fireEvent.click(selector);
		expect(
			screen.queryByRole("option", { name: "Find subtitles" }),
		).not.toBeInTheDocument();
	});

	it("supports movie subtitle search and queued download", async () => {
		const playback = stubEpisodePlayback({
			status: {
				state: "matched",
				movie: { movieId: 42, title: "Film" },
			},
			streams: [{ index: 1, type: "audio" }],
			search: {
				state: "matches",
				sourceId: "source-1",
				matches: [
					{
						matchId: "movie-match",
						name: "English subtitle",
						releaseName: null,
						score: null,
						language: null,
						provider: null,
						uploader: null,
					},
				],
			},
		});
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitles" }));
		fireEvent.click(screen.getByRole("option", { name: "Find subtitles" }));
		fireEvent.click(screen.getByRole("button", { name: "Find subtitles" }));
		await screen.findByText("— · — · — · —");
		fireEvent.click(screen.getByRole("button", { name: "Download" }));

		await waitFor(() => expect(playback.downloadRequested()).toBe(true));
		expect(
			screen.getByText("Download queued; the library will refresh shortly"),
		).toBeInTheDocument();
	});

	it("hides the movie downloader when its mapping is unmatched", async () => {
		const playback = stubEpisodePlayback({
			status: { state: "unmatched" },
			streams: [{ index: 1, type: "audio" }],
		});
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		await waitFor(() => expect(playback.statusRequested()).toBe(true));
		expect(
			screen.queryByRole("combobox", { name: "Subtitles" }),
		).not.toBeInTheDocument();
	});

	it("uses browser history for the detail back button", () => {
		window.history.pushState({}, "", "/library");
		window.history.pushState({}, "", "/show/movie");
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
	});

	it("returns from an episode to its series and preserves the episode season", () => {
		renderDetail({
			item: {
				...episode("ep-4-1", 1),
				SeriesId: "series",
				SeasonId: "s4",
				ParentIndexNumber: 4,
			},
			seasons: [],
			episodes: [],
			similar: [],
		});

		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(router.replace).toHaveBeenCalledWith("/show/series?seasonId=s4");
		expect(router.back).not.toHaveBeenCalled();
	});

	it("initializes a series from the requested season", () => {
		window.history.pushState({}, "", "/show/series?seasonId=s4");
		renderDetail({
			item: { ...movie(), Id: "series", Type: "Series" },
			seasons: [
				{ Id: "s1", Name: "Season 1", IndexNumber: 1 },
				{ Id: "s4", Name: "Season 4", IndexNumber: 4 },
			],
			episodes: [episode("ep-4-1", 1)],
			similar: [],
		});

		expect(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent(
			"S4: Season 4",
		);
	});

	it("renders a movie with live metadata and recommendations", () => {
		renderDetail({
			item: movie(),
			seasons: [],
			episodes: [],
			similar: [{ ...movie(), Id: "similar", Name: "Related Film" }],
		});

		expect(screen.getByRole("heading", { name: "Film" })).toBeInTheDocument();
		expect(screen.getByText("Drama")).toBeInTheDocument();
		expect(screen.getByText("Drama")).toHaveClass("text-xs");
		expect(screen.getByText("Studio")).toBeInTheDocument();
		const relatedCard = screen.getByText("Related Film").closest("article");
		expect(relatedCard).toHaveClass("w-[148px]", "md:w-[200px]");
		expect(screen.getByText("Related Film")).toHaveClass("text-xs");
		expect(
			within(relatedCard!).getByRole("link", { name: "Related Film" }),
		).toHaveAttribute("href", "/show/similar");
		const playButton = screen.getByRole("button", { name: "Play" });
		expect(playButton).not.toBeDisabled();
		expect(playButton).toHaveClass("h-11", "min-w-28", "bg-white", "px-5");
		expect(playButton).toHaveClass(
			"text-sm",
			"font-semibold",
			"tracking-normal",
			"text-black",
		);
		expect(playButton).not.toHaveClass("uppercase", "bg-gradient-to-br");
	});

	it("navigates a watched item to the player", () => {
		renderDetail({
			item: { ...movie(), UserData: { IsFavorite: false, Played: true } },
			seasons: [],
			episodes: [],
			similar: [],
		});

		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		expect(router.push).toHaveBeenCalledWith("/play/movie");
	});

	it("opens the player immediately while media information is still loading", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => undefined)),
		);
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		expect(router.push).toHaveBeenCalledWith("/play/movie");
	});

	it("announces new host media before the player is mounted", () => {
		expect(
			syncplayMediaStartCommand(
				{
					id: "group",
					itemId: null,
				} as never,
				true,
				"movie",
			),
		).toEqual({
			action: "media",
			itemId: "movie",
			position: 0,
			playing: true,
		});
		expect(
			syncplayMediaStartCommand(
				{ id: "group", itemId: "movie" } as never,
				true,
				"movie",
			),
		).toEqual({
			action: "media",
			itemId: "movie",
			position: 0,
			playing: true,
		});
		expect(
			syncplayMediaStartCommand(
				{ id: "group", itemId: null } as never,
				false,
				"movie",
			),
		).toBeNull();
	});

	it("uses a Jellyfin logo in place of the detail title when available", () => {
		renderDetail({
			item: {
				...movie(),
				ImageTags: {
					...movie().ImageTags,
					Logo: "/api/catalog/items/movie/images/Logo?language=en&v=movie-logo",
				},
			},
			seasons: [],
			episodes: [],
			similar: [],
		});

		const heading = screen.getByRole("heading", { name: "Film" });
		const logo = within(heading).getByAltText("Film");
		expect(heading).toContainElement(logo);
		expect(decodeURIComponent(logo.getAttribute("src") ?? "")).toContain(
			"/api/catalog/items/movie/images/Logo",
		);
		expect(logo).toHaveClass("max-h-24", "object-contain", "object-left");
	});

	it("renders series episodes and switches seasons", async () => {
		vi.mocked(fetch).mockImplementation(async (input) => {
			const url = new URL(String(input));
			if (url.pathname === "/api/catalog/items/s2") {
				return new Response(
					JSON.stringify({
						id: "s2",
						libraryId: "shows",
						type: "season",
						name: "The Return",
						metadata: { title: "The Return" },
					}),
					{ status: 200 },
				);
			}
			if (
				url.pathname === "/api/catalog/items" &&
				url.searchParams.get("parentId") === "s2"
			) {
				return new Response(
					JSON.stringify({
						items: [
							{
								id: "ep-2",
								libraryId: "shows",
								type: "episode",
								name: "Second Season Premiere",
								seriesId: "series",
								seasonId: "s2",
								episodeNumber: 1,
								metadata: {
									title: "Second Season Premiere",
									overview: "Episode overview",
								},
							},
						],
					}),
					{ status: 200 },
				);
			}
			return new Response(null, { status: 204 });
		});

		renderDetail({
			item: { ...movie(), Id: "series", Type: "Series", ChildCount: 2 },
			seasons: [
				{ Id: "s1", Name: "The Beginning", IndexNumber: 1 },
				{ Id: "s2", Name: "The Return", IndexNumber: 2 },
			],
			episodes: [episode("ep-1", 1)],
			similar: [],
		});

		expect(screen.getByText("1. Episode 1").closest("a")).toHaveAttribute(
			"href",
			"/show/series/episode/ep-1",
		);
		expect(
			screen.getByRole("img", { name: "Episode 1" }).parentElement?.parentElement,
		).toHaveClass("h-[120px]", "w-[213px]");
		expect(screen.getByText("1. Episode 1")).toHaveClass("text-sm");
		expect(screen.getByText("Episode overview")).toHaveClass("text-xs");
		expect(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent(
			"S1: The Beginning",
		);
		fireEvent.click(screen.getByRole("combobox", { name: "Season" }));
		fireEvent.click(screen.getByRole("option", { name: "S2: The Return" }));
		expect(
			await screen.findByText("1. Second Season Premiere"),
		).toBeInTheDocument();
	});

	it("keeps the selected season in the detail URL for refreshes", async () => {
		window.history.replaceState({}, "", "/show/series");
		const seasonId = "season-url-2";
		vi.mocked(fetch).mockImplementation(async (input) => {
			const url = new URL(String(input));
			if (url.pathname === `/api/catalog/items/${seasonId}`) {
				return new Response(
					JSON.stringify({
						id: seasonId,
						libraryId: "shows",
						type: "season",
						name: "Season 2",
						seasonNumber: 2,
						metadata: { title: "Season 2" },
					}),
					{ status: 200 },
				);
			}
			if (
				url.pathname === "/api/catalog/items" &&
				url.searchParams.get("parentId") === seasonId
			) {
				return new Response(JSON.stringify({ items: [] }), { status: 200 });
			}
			return new Response(null, { status: 404 });
		});

		renderDetail({
			item: { Id: "series", Name: "Series", Type: "Series" },
			seasons: [
				{ Id: "season-url-1", Name: "Season 1", IndexNumber: 1 },
				{ Id: seasonId, Name: "Season 2", IndexNumber: 2 },
			],
			episodes: [],
			similar: [],
		});

		fireEvent.click(screen.getByRole("combobox", { name: "Season" }));
		fireEvent.click(screen.getByRole("option", { name: "S2: Season 2" }));

		await waitFor(() =>
			expect(window.location.search).toBe(`?seasonId=${seasonId}`),
		);
	});

	it("defaults a series to season one when specials are listed first", () => {
		renderDetail({
			item: { ...movie(), Id: "series", Type: "Series" },
			seasons: [
				{ Id: "specials", Name: "Specials", IndexNumber: 0 },
				{ Id: "s1", Name: "Season 1", IndexNumber: 1 },
			],
			episodes: [episode("ep-1", 1)],
			similar: [],
		});

		expect(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent(
			"S1: Season 1",
		);
	});

	it("uses the series backdrop when an episode has no backdrop", () => {
		const { container } = renderDetail({
			item: episode("ep-1", 1),
			backgroundItem: {
				Id: "series",
				Name: "Series",
				Type: "Series",
				BackdropImageTags: [
					"/api/catalog/items/series/images/Backdrop?language=en&v=series-backdrop",
				],
			},
			seasons: [],
			episodes: [],
			similar: [],
		});

		expect(
			decodeURIComponent(
				container.querySelector("section > img")?.getAttribute("src") ?? "",
			),
		).toContain("/api/catalog/items/series/images/Backdrop");
	});

	it("uses the shared horizontal scroller for an episode season", async () => {
		renderDetail({
			item: episode("ep-1", 1),
			seasons: [],
			episodes: [episode("ep-1", 1), episode("ep-2", 2)],
			similar: [],
		});

		const scroller = screen
			.getByRole("region", { name: "Episodes" })
			.querySelector('[aria-label="Episodes"]');
		if (!scroller) throw new Error("Episode scroller was not rendered");
		Object.defineProperties(scroller, {
			clientWidth: { configurable: true, value: 320 },
			scrollWidth: { configurable: true, value: 640 },
		});
		const scrollTo = vi.fn();
		Object.defineProperty(scroller, "scrollTo", {
			configurable: true,
			value: scrollTo,
		});
		fireEvent.scroll(scroller);

		fireEvent.scroll(scroller);
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Scroll Episodes right" }),
			).toBeInTheDocument(),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Scroll Episodes right" }),
		);
		expect(scrollTo).toHaveBeenCalledWith({ left: 320, behavior: "smooth" });
	});

	it("uses the home media-card hover treatment for horizontally scrolling episodes", () => {
		const { container } = renderDetail({
			item: episode("ep-1", 1),
			seasons: [],
			episodes: [episode("ep-2", 2)],
			similar: [],
		});

		const card = screen.getByText("2. Episode 2").closest("a");
		expect(card?.parentElement).toHaveClass("group/card");
		expect(card?.parentElement?.querySelector("img")).toHaveClass(
			"group-hover/card:brightness-50",
		);
		expect(
			card?.parentElement?.querySelector(".lucide-play")?.parentElement
				?.parentElement,
		).toHaveClass("group-hover/card:bg-black/15", "group-hover/card:opacity-100");
		expect(container.querySelectorAll(".lucide-play")).toHaveLength(2);
	});

	it("uses the shared horizontal scroller for cast and similar titles", async () => {
		renderDetail({
			item: {
				...movie(),
				People: [{ Name: "Actor One", Role: "Lead", Type: "Actor" }],
			},
			seasons: [],
			episodes: [],
			similar: [{ ...movie(), Id: "similar", Name: "Related Film" }],
		});

		const castScroller = screen.getByLabelText("Cast");
		const similarScroller = screen.getByLabelText("More Like This");
		if (!castScroller || !similarScroller)
			throw new Error("Detail scrollers were not rendered");

		const scrollToCalls = new Map<Element, ReturnType<typeof vi.fn>>();
		for (const scroller of [castScroller, similarScroller]) {
			Object.defineProperties(scroller, {
				clientWidth: { configurable: true, value: 320 },
				scrollWidth: { configurable: true, value: 640 },
			});
			const scrollTo = vi.fn();
			scrollToCalls.set(scroller, scrollTo);
			Object.defineProperty(scroller, "scrollTo", {
				configurable: true,
				value: scrollTo,
			});
			fireEvent.scroll(scroller);
		}

		fireEvent.scroll(castScroller);
		fireEvent.scroll(similarScroller);
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Scroll Cast right" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Scroll More Like This right" }),
			).toBeInTheDocument();
		});
		fireEvent.click(screen.getByRole("button", { name: "Scroll Cast right" }));
		fireEvent.click(
			screen.getByRole("button", { name: "Scroll More Like This right" }),
		);
		expect(scrollToCalls.get(castScroller)).toHaveBeenCalledWith({
			left: 320,
			behavior: "smooth",
		});
		expect(scrollToCalls.get(similarScroller)).toHaveBeenCalledWith({
			left: 320,
			behavior: "smooth",
		});
	});

	it("rolls back an optimistic favorite mutation after failure", async () => {
		vi.mocked(fetch).mockImplementation(async (input, init) => {
			if (
				String(input).includes("/api/catalog/items/movie/state") &&
				init?.method === "PATCH"
			)
				throw new Error("offline");
			return new Response(null, { status: 204 });
		});
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
		expect(
			screen.getByRole("button", { name: "Remove from favorites" }),
		).toBeInTheDocument();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Add to favorites" }),
			).toBeInTheDocument(),
		);
		expect(screen.getByRole("alert")).toBeInTheDocument();
	});
});

function renderDetail(data: DetailData) {
	return render(
		<ProgressProvider>
			<DetailPage initialData={data} session={session} />
		</ProgressProvider>,
	);
}

function movie(): MediaItem {
	return {
		Id: "movie",
		Name: "Film",
		Type: "Movie",
		ProductionYear: 2025,
		CommunityRating: 8.4,
		RunTimeTicks: 7_200_000_000,
		Overview: "A detailed overview.",
		Genres: ["Drama"],
		Studios: [{ Name: "Studio" }],
		UserData: { IsFavorite: false, Played: false },
		ImageTags: {
			Primary: "/api/catalog/items/movie/images/Primary?language=en&v=poster",
		},
		BackdropImageTags: [
			"/api/catalog/items/movie/images/Backdrop?language=en&v=backdrop",
		],
	};
}

function episode(id: string, number: number): MediaItem {
	return {
		Id: id,
		Name: `Episode ${number}`,
		Type: "Episode",
		SeriesId: "series",
		ParentIndexNumber: 1,
		IndexNumber: number,
		Overview: "Episode overview",
		ImageTags: {
			Primary: `/api/catalog/items/${id}/images/Primary?language=en&v=thumb`,
		},
	};
}

function stubEpisodePlayback({
	status,
	streams,
	search = { state: "matched", sourceId: "source-1", matches: [] },
}: {
	status: Record<string, unknown>;
	streams: Array<Record<string, unknown>>;
	search?: Record<string, unknown>;
}) {
	let statusRequested = false;
	let downloadRequested = false;
	let failSearch = false;
	vi.mocked(fetch).mockImplementation(async (input) => {
		const url = new URL(String(input), "http://localhost");
		if (url.pathname.endsWith("/source")) {
			return jsonResponse({ id: "source-1", streams });
		}
		if (url.pathname === "/api/preferences/playback") {
			return jsonResponse({
				audioLanguage: null,
				subtitleLanguage: null,
				audioLanguages: [],
				subtitleLanguages: [],
			});
		}
		if (url.pathname.endsWith("/bazarr/status")) {
			statusRequested = true;
			return jsonResponse(status);
		}
		if (url.pathname.endsWith("/bazarr/search")) {
			if (failSearch) return new Response(null, { status: 500 });
			return jsonResponse(search);
		}
		if (url.pathname.endsWith("/bazarr/download")) {
			downloadRequested = true;
			return jsonResponse({ state: "download_started" });
		}
		return new Response(null, { status: 204 });
	});
	return {
		statusRequested: () => statusRequested,
		downloadRequested: () => downloadRequested,
		get failSearch() {
			return failSearch;
		},
		set failSearch(value: boolean) {
			failSearch = value;
		},
	};
}

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: { "content-type": "application/json" },
	});
}
