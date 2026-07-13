import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PosterCard, StackedPosterCard, WideCard } from "@/components/home/media-card";
import { EpisodeCard } from "@/components/pages/detail-page";
import type { JellyfinItem } from "@/lib/jellyfin";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const item = {
  Id: "item-1",
  Name: "Test title",
  Type: "Movie",
} as JellyfinItem;

describe("media card sizing", () => {
  it.each([
    ["movie", { ...item, Type: "Movie" }, "/show/item-1"],
    ["series", { ...item, Type: "Series" }, "/show/item-1"],
    ["episode", { ...item, Type: "Episode", SeriesId: "series-1" }, "/show/series-1/episode/item-1"],
  ])("links a %s card to its detail view", (_, mediaItem, href) => {
    render(<WideCard item={mediaItem} />);

    expect(screen.getByRole("link", { name: /Test title/ })).toHaveAttribute("href", href);
  });

  it("uses the enlarged landscape card width", () => {
    const { container } = render(<WideCard item={item} />);

    expect(container.firstElementChild).toHaveClass("w-[min(calc((100vw-2.75rem)/2),180px)]", "md:w-[320px]");
  });

  it("routes the play button to autoplay without changing the detail link", () => {
    render(<WideCard item={item} />);

    expect(screen.getByRole("link", { name: /Test title/ })).toHaveAttribute("href", "/show/item-1");
    const playButton = screen.getByRole("button", { name: "Play Test title" });
    expect(playButton).toHaveClass("hover:scale-110", "focus:ring-2");
    expect(playButton).not.toHaveClass("shadow-lg", "shadow-black/40");
    playButton.click();

    expect(router.push).toHaveBeenCalledWith("/show/item-1?autoplay=1");
  });

  it("uses the enlarged portrait card width", () => {
    const { container } = render(<PosterCard item={item} />);

    expect(container.firstElementChild).toHaveClass("w-[148px]", "md:w-[200px]");
  });

  it.each([
    ["landscape", WideCard],
    ["portrait", PosterCard],
  ])("does not render an info action on %s cards", (_, Card) => {
    const { container } = render(<Card item={item} />);

    expect(container.querySelector(".lucide-info")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-play")).toBeInTheDocument();
  });

  it("shows a year instead of season and episode numbers for stacked releases", () => {
    render(<StackedPosterCard items={[
      { ...item, Id: "episode-2", Name: "Second", Type: "Episode", SeriesId: "series", SeriesName: "Series", SeriesPrimaryImageTag: "poster", ParentIndexNumber: 1, IndexNumber: 2, ProductionYear: 2026 },
      { ...item, Id: "episode-1", Name: "First", Type: "Episode", SeriesId: "series", SeriesName: "Series", ParentIndexNumber: 1, IndexNumber: 1, ProductionYear: 2026 },
    ]} />);

    expect(screen.getByText("2 EP")).toBeInTheDocument();
    expect(screen.getByText("2 EP")).toHaveClass("bg-black/40", "rounded-full");
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.queryByText("S1:E2")).not.toBeInTheDocument();
  });

  it("uses a two-pixel progress bar on in-progress landscape cards", () => {
    const { container } = render(
      <WideCard
        item={{
          ...item,
          UserData: { PlayedPercentage: 50 },
        }}
      />,
    );

    expect(container.querySelector('[style="width: 50%;"]')?.parentElement).toHaveClass("h-0.5");
  });

  it("shows watched badges for movies, episodes, and series", () => {
    const { rerender } = render(<PosterCard item={{ ...item, UserData: { Played: true } }} />);
    expect(screen.getByLabelText("All episodes watched")).toHaveClass("text-xs");

    rerender(<PosterCard item={{ ...item, Type: "Series", UserData: { UnplayedItemCount: 4 } }} />);
    expect(screen.getByLabelText("4 unwatched")).toBeInTheDocument();
  });

  it("shows watch progress on horizontal detail episode thumbnails", () => {
    const { container } = render(
      <EpisodeCard
        seriesId="series-1"
        episode={{
          ...item,
          Type: "Episode",
          SeriesId: "series-1",
          RunTimeTicks: 100,
          UserData: { PlaybackPositionTicks: 25 },
        }}
        horizontal
        active={false}
      />,
    );

    expect(container.querySelector('[style="width: 25%;"]')?.parentElement).toHaveClass("h-0.5");
  });

  it("adds a playable overlay to vertical season episode rows", () => {
    render(
      <EpisodeCard
        seriesId="series-1"
        episode={{ ...item, Type: "Episode", SeriesId: "series-1", IndexNumber: 1 }}
        horizontal={false}
        active={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Play Test title" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /1\. Test title/ })).toHaveAttribute(
      "href",
      "/show/series-1/episode/item-1",
    );
  });

  it.each([
    ["landscape", WideCard],
    ["portrait", PosterCard],
  ])("shows season and episode numbers under episode titles on %s cards", (_, Card) => {
    render(
      <Card
        item={{
          ...item,
          Type: "Episode",
          ParentIndexNumber: 1,
          IndexNumber: 3,
        }}
      />,
    );

    expect(screen.getByText("S1:E3")).toBeInTheDocument();
  });
});
