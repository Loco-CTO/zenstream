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
		expect(screen.getByText("Related Film").closest("a")).toHaveAttribute(
			"href",
			"/show/similar",
		);
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

	it("marks a watched item unwatched when playback starts", async () => {
		renderDetail({
			item: { ...movie(), UserData: { IsFavorite: false, Played: true } },
			seasons: [],
			episodes: [],
			similar: [],
		});

		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		const video = document.querySelector("video");
		expect(video).toBeInTheDocument();
		fireEvent.play(video!);

		await waitFor(() =>
			expect(fetch).toHaveBeenCalledWith(
				expect.stringContaining("/UserPlayedItems/movie"),
				expect.objectContaining({ method: "DELETE" }),
			),
		);
	});

	it("opens the player immediately while media information is still loading", () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => new Promise<Response>(() => undefined)),
		);
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		expect(document.querySelector("video")).toBeInTheDocument();
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
				ImageTags: { ...movie().ImageTags, Logo: "movie-logo" },
			},
			seasons: [],
			episodes: [],
			similar: [],
		});

		const heading = screen.getByRole("heading", { name: "Film" });
		const logo = within(heading).getByAltText("Film");
		expect(heading).toContainElement(logo);
		expect(logo).toHaveAttribute(
			"src",
			expect.stringContaining("/api/assets/items/movie/images/Logo?"),
		);
		expect(logo).toHaveAttribute(
			"src",
			expect.stringContaining("tag=movie-logo"),
		);
		expect(logo).toHaveClass("max-h-24", "object-contain", "object-left");
	});

	it("renders series episodes and switches seasons", async () => {
		vi.mocked(fetch).mockImplementation(async (input) => {
			if (String(input).includes("seasonId=s2")) {
				return new Response(
					JSON.stringify({
						Items: [{ ...episode("ep-2", 1), Name: "Second Season Premiere" }],
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

		await waitFor(() => expect(window.location.search).toBe(`?seasonId=${seasonId}`));
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
				BackdropImageTags: ["series-backdrop"],
			},
			seasons: [],
			episodes: [],
			similar: [],
		});

		expect(container.querySelector("section > img")).toHaveAttribute(
			"src",
			expect.stringContaining("/api/assets/items/series/images/Backdrop?"),
		);
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
		const animationFrames: Array<FrameRequestCallback> = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		});
		Object.defineProperties(scroller, {
			clientWidth: { configurable: true, value: 320 },
			scrollWidth: { configurable: true, value: 640 },
		});
		Object.defineProperty(scroller, "scrollTo", {
			configurable: true,
			value: vi.fn(),
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
		animationFrames.shift()?.(0);
		expect(scroller.scrollLeft).toBeCloseTo(51.2);
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

		const animationFrames: Array<FrameRequestCallback> = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			animationFrames.push(callback);
			return animationFrames.length;
		});
		for (const scroller of [castScroller, similarScroller]) {
			Object.defineProperties(scroller, {
				clientWidth: { configurable: true, value: 320 },
				scrollWidth: { configurable: true, value: 640 },
			});
			Object.defineProperty(scroller, "scrollTo", {
				configurable: true,
				value: vi.fn(),
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
		animationFrames.shift()?.(0);
		animationFrames.shift()?.(0);
		expect(castScroller.scrollLeft).toBeCloseTo(51.2);
		expect(similarScroller.scrollLeft).toBeCloseTo(51.2);
	});

	it("rolls back an optimistic favorite mutation after failure", async () => {
		vi.mocked(fetch).mockImplementation(async (input) => {
			if (String(input).includes("/UserFavoriteItems/"))
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
		ImageTags: { Primary: "poster" },
		BackdropImageTags: ["backdrop"],
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
		ImageTags: { Thumb: "thumb" },
	};
}
