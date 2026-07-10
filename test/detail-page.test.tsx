import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DetailPage } from "@/components/pages/detail-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import type { DetailData, JellyfinItem } from "@/lib/jellyfin";

const session = { token: "token", userId: "user", username: "Alex" };

describe("detail views", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
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
    expect(relatedCard).toHaveClass("w-[200px]");
    expect(screen.getByText("Related Film")).toHaveClass("text-xs");
    expect(screen.getByText("Related Film").closest("a")).toHaveAttribute("href", "/show/similar");
    const playButton = screen.getByRole("button", { name: "Play" });
    expect(playButton).not.toBeDisabled();
    expect(playButton).toHaveClass("h-11", "min-w-28", "bg-white", "px-5");
    expect(playButton).toHaveClass("text-sm", "font-semibold", "tracking-normal", "text-black");
    expect(playButton).not.toHaveClass("uppercase", "bg-gradient-to-br");
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
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      Items: [{ ...episode("ep-2", 1), Name: "Second Season Premiere" }],
    }), { status: 200 }));

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
    expect(screen.getByText("1. Episode 1").closest("a")?.querySelector("div")).toHaveClass("h-[120px]", "w-[213px]");
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

  it("uses the shared horizontal scroller for an episode season", () => {
    renderDetail({
      item: episode("ep-1", 1),
      seasons: [],
      episodes: [episode("ep-1", 1), episode("ep-2", 2)],
      similar: [],
    });

    const scroller = screen.getByText("2. Episode 2").closest("a")?.parentElement;
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
    fireEvent.scroll(scroller);

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
    expect(card).toHaveClass("group/card");
    expect(card?.querySelector("img")).toHaveClass("group-hover/card:brightness-50");
    expect(card?.querySelector(".lucide-play")?.parentElement?.parentElement).toHaveClass(
      "group-hover/card:bg-black/15",
      "group-hover/card:opacity-100",
    );
    expect(container.querySelectorAll(".lucide-play")).toHaveLength(2);
  });

  it("uses the shared horizontal scroller for cast and similar titles", () => {
    renderDetail({
      item: {
        ...movie(),
        People: [{ Name: "Actor One", Role: "Lead", Type: "Actor" }],
      },
      seasons: [],
      episodes: [],
      similar: [{ ...movie(), Id: "similar", Name: "Related Film" }],
    });

    const castScroller = screen.getByText("Actor One").closest(".w-\\[120px\\]")?.parentElement;
    const similarScroller = screen.getByText("Related Film").closest("article")?.parentElement;
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
      fireEvent.scroll(scroller);
    }

    fireEvent.click(screen.getByRole("button", { name: "Scroll Cast & Crew right" }));
    fireEvent.click(screen.getByRole("button", { name: "Scroll More Like This right" }));
    animationFrames.shift()?.(0);
    animationFrames.shift()?.(0);
    expect(castScroller.scrollLeft).toBeCloseTo(51.2);
    expect(similarScroller.scrollLeft).toBeCloseTo(51.2);
  });

  it("rolls back an optimistic favorite mutation after failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
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
