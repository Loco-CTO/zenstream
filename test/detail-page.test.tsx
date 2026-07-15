import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DetailPage,
  syncplayMediaStartCommand,
} from "@/components/pages/detail-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import type { DetailData, JellyfinItem } from "@/lib/jellyfin";

const session = { token: "token", userId: "user", username: "Alex" };
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

describe("detail views", () => {
	beforeEach(() => {
		router.back.mockClear();
		router.push.mockClear();
		vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
	});
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("uses browser history for the detail back button", () => {
		window.history.pushState({}, "", "/library");
		window.history.pushState({}, "", "/show/movie");
		renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

		fireEvent.click(screen.getByRole("button", { name: "Back" }));

		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
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
    expect(screen.getByText("Related Film").closest("a")).toHaveAttribute("href", "/show/similar");
    const playButton = screen.getByRole("button", { name: "Play" });
    expect(playButton).not.toBeDisabled();
    expect(playButton).toHaveClass("h-11", "min-w-28", "bg-white", "px-5");
    expect(playButton).toHaveClass("text-sm", "font-semibold", "tracking-normal", "text-black");
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

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/UserPlayedItems/movie"),
      expect.objectContaining({ method: "DELETE" }),
    ));
  });

  it("opens the player immediately while media information is still loading", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));
    renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

    fireEvent.click(screen.getByRole("button", { name: "Play" }));

    expect(document.querySelector("video")).toBeInTheDocument();
  });


  it("announces new host media before the player is mounted", () => {
    expect(syncplayMediaStartCommand({
      id: "group",
      itemId: null,
    } as never, true, "movie")).toEqual({
      action: "media",
      itemId: "movie",
      position: 0,
      playing: true,
    });
    expect(syncplayMediaStartCommand({ id: "group", itemId: "movie" } as never, true, "movie")).toEqual({
      action: "media",
      itemId: "movie",
      position: 0,
      playing: true,
    });
    expect(syncplayMediaStartCommand({ id: "group", itemId: null } as never, false, "movie")).toBeNull();
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
    expect(logo).toHaveAttribute("src", expect.stringContaining("/Items/movie/Images/Logo?"));
    expect(logo).toHaveAttribute("src", expect.stringContaining("tag=movie-logo"));
    expect(logo).toHaveClass("max-h-24", "object-contain", "object-left");
  });

  it("renders series episodes and switches seasons", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("seasonId=s2")) {
        return new Response(JSON.stringify({
          Items: [{ ...episode("ep-2", 1), Name: "Second Season Premiere" }],
        }), { status: 200 });
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

    expect(screen.getByText("1. Episode 1").closest("a")).toHaveAttribute("href", "/show/series/episode/ep-1");
    expect(screen.getByRole("img", { name: "Episode 1" }).parentElement?.parentElement).toHaveClass("h-[120px]", "w-[213px]");
    expect(screen.getByText("1. Episode 1")).toHaveClass("text-sm");
    expect(screen.getByText("Episode overview")).toHaveClass("text-xs");
    expect(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent("S1: The Beginning");
    fireEvent.click(screen.getByRole("combobox", { name: "Season" }));
    fireEvent.click(screen.getByRole("option", { name: "S2: The Return" }));
    expect(await screen.findByText("1. Second Season Premiere")).toBeInTheDocument();
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

    expect(screen.getByRole("combobox", { name: "Season" })).toHaveTextContent("S1: Season 1");
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
      expect.stringContaining("/Items/series/Images/Backdrop/0?"),
    );
  });

  it("uses the shared horizontal scroller for an episode season", async () => {
    renderDetail({
      item: episode("ep-1", 1),
      seasons: [],
      episodes: [episode("ep-1", 1), episode("ep-2", 2)],
      similar: [],
    });

    const scroller = screen.getByRole("region", { name: "Episodes" }).querySelector('[aria-label="Episodes"]');
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
    await waitFor(() => expect(screen.getByRole("button", { name: "Scroll Episodes right" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Scroll Episodes right" }));
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
    expect(card?.parentElement?.querySelector("img")).toHaveClass("group-hover/card:brightness-50");
    expect(card?.parentElement?.querySelector(".lucide-play")?.parentElement?.parentElement).toHaveClass(
      "group-hover/card:bg-black/15",
      "group-hover/card:opacity-100",
    );
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

    const castScroller = screen.getByLabelText("Cast & Crew");
    const similarScroller = screen.getByLabelText("More Like This");
    if (!castScroller || !similarScroller) throw new Error("Detail scrollers were not rendered");

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
      expect(screen.getByRole("button", { name: "Scroll Cast & Crew right" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Scroll More Like This right" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Scroll Cast & Crew right" }));
    fireEvent.click(screen.getByRole("button", { name: "Scroll More Like This right" }));
    animationFrames.shift()?.(0);
    animationFrames.shift()?.(0);
    expect(castScroller.scrollLeft).toBeCloseTo(51.2);
    expect(similarScroller.scrollLeft).toBeCloseTo(51.2);
  });

  it("rolls back an optimistic favorite mutation after failure", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (String(input).includes("/UserFavoriteItems/")) throw new Error("offline");
      return new Response(null, { status: 204 });
    });
    renderDetail({ item: movie(), seasons: [], episodes: [], similar: [] });

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }));
    expect(screen.getByRole("button", { name: "Remove from favorites" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Add to favorites" })).toBeInTheDocument());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});

function renderDetail(data: DetailData) {
  return render(<ProgressProvider><DetailPage initialData={data} session={session} /></ProgressProvider>);
}

function movie(): JellyfinItem {
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

function episode(id: string, number: number): JellyfinItem {
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
