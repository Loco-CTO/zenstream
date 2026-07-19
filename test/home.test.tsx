import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { HomePage } from "@/components/pages/home-page";
import { I18nProvider } from "@/lib/i18n";
import * as jellyfin from "@/lib/jellyfin";
import * as session from "@/lib/session";

describe("home screen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows login when no session exists", async () => {
    vi.spyOn(session, "getAuthSession").mockReturnValue(null);

    render(<ProgressProvider><Page /></ProgressProvider>);

    expect(await screen.findByRole("heading", { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /login/i })).toHaveClass("bg-white", "text-black");
    expect(screen.getByRole("button", { name: /login/i }).className).not.toContain("bg-gradient");
  });

  it("loads and renders populated home rows", async () => {
    vi.spyOn(session, "getAuthSession").mockReturnValue({ token: "token", userId: "user", username: "Alex" });
    vi.spyOn(jellyfin, "fetchHomeData").mockResolvedValue({
      latestItems: [item("latest-1", "Latest Feature"), item("latest-2", "Second Feature")],
      newlyAdded: [{
        libraryId: "anime",
        libraryName: "Anime",
        items: [item("added-1", "Newly Added Movie")],
      }],
      continueWatching: [item("resume-1", "Resume Show")],
      nextUp: [item("next-1", "Next Episode")],
      topRated: [item("top-1", "Top Rated")],
      newReleases: [item("new-1", "New Release")],
      movies: [item("movie-1", "Movie")],
      myList: [item("list-1", "Favorite")],
    });

    render(<ProgressProvider><Page /></ProgressProvider>);

    expect(await screen.findByRole("heading", { name: "Latest Feature" })).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: /featured title/i });
    const heroPlayButton = within(hero).getByRole("button", { name: /^play$/i });

    expect(heroPlayButton).toHaveClass("bg-white", "text-black");
    expect(heroPlayButton.className).not.toContain("bg-gradient");
    expect(screen.getByRole("button", { name: /show slide 2: second feature/i })).toBeInTheDocument();
    expect(screen.getByText("New Release")).toBeInTheDocument();
    expect(screen.getByText("Newly Added on Anime")).toBeInTheDocument();
		expect(screen.getByText("Newly Added Movie")).toBeInTheDocument();
    expect(screen.getByText("Continue Watching")).toBeInTheDocument();
    expect(screen.getByText("Next Up")).toBeInTheDocument();
    expect(screen.getByText("Top Rated Anime")).toBeInTheDocument();

    const sectionHeadings = screen.getAllByRole("heading").map((heading) => heading.textContent);
    expect(sectionHeadings.indexOf("Continue Watching")).toBeLessThan(sectionHeadings.indexOf("Newly Added on Anime"));
    expect(sectionHeadings.indexOf("Next Up")).toBeLessThan(sectionHeadings.indexOf("Newly Added on Anime"));

    const resumeCard = screen.getByText("Resume Show").closest("article");
    expect(screen.getByText("Continue Watching").closest("section")).toHaveClass("select-none");
    expect(resumeCard).toHaveClass("select-none");
    expect(screen.getByRole("img", { name: "Resume Show" })).toHaveAttribute("draggable", "false");
  });

  it("renders error and retries home loading", async () => {
    const auth = { token: "token", userId: "user", username: "Alex" };
    vi.spyOn(session, "getAuthSession").mockReturnValue(auth);
    const fetchHomeData = vi
      .spyOn(jellyfin, "fetchHomeData")
      .mockRejectedValueOnce(new Error("Nope"))
      .mockResolvedValueOnce({
        latestItems: [],
        newlyAdded: [],
        continueWatching: [],
        nextUp: [],
        topRated: [item("top-1", "Recovered")],
        newReleases: [],
        movies: [],
        myList: [],
      });

    render(<ProgressProvider><Page /></ProgressProvider>);

    await screen.findByText("Could not load your library");
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => expect(fetchHomeData).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText("Recovered")).toHaveLength(2);
  });

  it("opens newly added rows as series sorted by the latest episode added date", () => {
    render(
      <I18nProvider locale="en">
        <HomePage
          data={{
            libraryRows: [{
              libraryId: "anime",
              libraryName: "Anime",
              titleKey: "newlyAddedOn",
              stackEpisodes: true,
              items: [item("added-1", "Newly Added Series")],
            }],
          }}
          session={{ token: "token", userId: "user", username: "Alex" }}
        />
      </I18nProvider>,
    );

    const section = screen.getByRole("heading", { name: "Newly Added on Anime" }).closest("section");
    expect(section).not.toBeNull();
    const viewAll = within(section!).getByRole("link", { name: /all/i });
    expect(viewAll).toHaveAttribute(
      "href",
      "/library?sortBy=DateLastContentAdded&sortOrder=Descending&libraryId=anime",
    );
    expect(viewAll.getAttribute("href")).not.toContain("newlyAdded");
  });

  it("does not show the empty-library state while home data is loading", async () => {
    vi.spyOn(session, "getAuthSession").mockReturnValue({ token: "token", userId: "user", username: "Alex" });
    let resolveHome!: (data: jellyfin.HomeData) => void;
    vi.spyOn(jellyfin, "fetchHomeData").mockReturnValue(new Promise((resolve) => {
      resolveHome = resolve;
    }));

    render(<ProgressProvider><Page /></ProgressProvider>);

    await waitFor(() => expect(jellyfin.fetchHomeData).toHaveBeenCalled());
    expect(screen.queryByText("Your library is empty")).not.toBeInTheDocument();

    resolveHome({
      latestItems: [], newlyAdded: [], continueWatching: [], nextUp: [],
      topRated: [], newReleases: [], movies: [], myList: [],
    });

    expect(await screen.findByText("Your library is empty")).toBeInTheDocument();
  });
});

function item(id: string, name: string): jellyfin.JellyfinItem {
  return {
    Id: id,
    Name: name,
    Type: "Series",
    ProductionYear: 2024,
    Overview: "Overview",
    ImageTags: { Primary: "primary", Thumb: "thumb" },
    BackdropImageTags: ["backdrop"],
    LocalTrailerCount: 0,
  };
}
