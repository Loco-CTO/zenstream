import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PosterCard, StackedPosterCard, WideCard } from "@/components/home/media-card";
import type { JellyfinItem } from "@/lib/jellyfin";

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

    expect(container.firstElementChild).toHaveClass("w-[320px]");
  });

  it("uses the enlarged portrait card width", () => {
    const { container } = render(<PosterCard item={item} />);

    expect(container.firstElementChild).toHaveClass("w-[200px]");
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
