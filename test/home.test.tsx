import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import * as jellyfin from "@/lib/media-api";
import * as session from "@/lib/session";

describe("home screen", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("shows login when no session exists", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue(null);

		render(
			<ProgressProvider>
				<Page />
			</ProgressProvider>,
		);

		expect(
			await screen.findByRole("heading", { name: /welcome back/i }),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /login/i })).toHaveClass(
			"bg-white",
			"text-black",
		);
		expect(
			screen.getByRole("button", { name: /login/i }).className,
		).not.toContain("bg-gradient");
	});

	it("loads and renders populated home rows", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue({
			token: "token",
			userId: "user",
			username: "Alex",
		});
		vi.spyOn(jellyfin, "fetchHomeData").mockResolvedValue({
			latestItems: [
				item("latest-1", "Latest Feature"),
				item("latest-2", "Second Feature"),
			],
			newlyAdded: [
				{
					libraryId: "anime",
					libraryName: "Anime",
					items: [item("added-1", "Newly Added Movie")],
				},
			],
			libraryRows: [
				{
					libraryId: "anime",
					libraryName: "Anime",
					titleKey: "newlyAddedOn",
					stackEpisodes: true,
					items: [item("added-1", "Newly Added Movie")],
				},
				{
					libraryId: "anime",
					libraryName: "Anime",
					titleKey: "topRated",
					items: [item("top-1", "Top Rated")],
				},
				{
					libraryId: "anime",
					libraryName: "Anime",
					titleKey: "newReleases",
					items: [item("new-1", "New Release")],
				},
			],
			continueWatching: [item("resume-1", "Resume Show")],
			nextUp: [item("next-1", "Next Episode")],
			topRated: [item("top-1", "Top Rated")],
			newReleases: [item("new-1", "New Release")],
			movies: [item("movie-1", "Movie")],
			myList: [item("list-1", "Favorite")],
			recentlyPlayed: [item("recent-1", "Recently Played Title")],
			genreRows: [{ genre: "Drama", items: [item("drama-1", "Drama Title")] }],
		});

		render(
			<ProgressProvider>
				<Page />
			</ProgressProvider>,
		);

		expect(
			await screen.findByRole("heading", { name: "Latest Feature" }),
		).toBeInTheDocument();
		const hero = screen.getByRole("region", { name: /featured title/i });
		const heroPlayButton = within(hero).getByRole("button", {
			name: /^play$/i,
		});

		expect(heroPlayButton).toHaveClass("bg-white", "text-black");
		expect(heroPlayButton.className).not.toContain("bg-gradient");
		expect(
			screen.getByRole("button", { name: /show slide 2: second feature/i }),
		).toBeInTheDocument();
		expect(screen.getByText("New Release")).toBeInTheDocument();
		expect(screen.getByText("Newly Added on Anime")).toBeInTheDocument();
		expect(screen.getByText("Newly Added Movie")).toBeInTheDocument();
		expect(
			within(
				screen.getByText("Newly Added on Anime").closest("section")!,
			).queryByRole("link", { name: /all/i }),
		).not.toBeInTheDocument();
		expect(screen.getByText("Continue Watching")).toBeInTheDocument();
		expect(screen.getByText("Next Up")).toBeInTheDocument();
		expect(screen.getByText("My List")).toBeInTheDocument();
		expect(screen.getByText("Recently Played")).toBeInTheDocument();
		expect(screen.getByText("Drama")).toBeInTheDocument();
		expect(screen.getByText("Favorite")).toBeInTheDocument();
		expect(screen.getByText("Recently Played Title")).toBeInTheDocument();
		expect(
			within(screen.getByText("My List").closest("section")!).getByRole("link", {
				name: /all/i,
			}),
		).toHaveAttribute("href", "/favorites");

		const sectionHeadings = screen
			.getAllByRole("heading")
			.map((heading) => heading.textContent);
		expect(sectionHeadings.indexOf("Continue Watching")).toBeLessThan(
			sectionHeadings.indexOf("Newly Added on Anime"),
		);
		expect(sectionHeadings.indexOf("Next Up")).toBeLessThan(
			sectionHeadings.indexOf("Newly Added on Anime"),
		);
		expect(sectionHeadings.indexOf("Newly Added on Anime")).toBeLessThan(
			sectionHeadings.indexOf("Recently Played"),
		);
		expect(sectionHeadings.indexOf("Recently Played")).toBeLessThan(
			sectionHeadings.indexOf("Drama"),
		);

		const resumeCard = screen.getByText("Resume Show").closest("article");
		expect(screen.getByText("Continue Watching").closest("section")).toHaveClass(
			"select-none",
		);
		expect(resumeCard).toHaveClass("select-none");
		expect(screen.getByRole("img", { name: "Resume Show" })).toHaveAttribute(
			"draggable",
			"false",
		);
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
				libraryRows: [
					{
						libraryId: "anime",
						libraryName: "Anime",
						titleKey: "topRated",
						items: [item("top-1", "Recovered")],
					},
				],
				continueWatching: [],
				nextUp: [],
				topRated: [item("top-1", "Recovered")],
				newReleases: [],
				movies: [],
				myList: [],
			});

		render(
			<ProgressProvider>
				<Page />
			</ProgressProvider>,
		);

		await screen.findByText("Could not load your library");
		fireEvent.click(screen.getByRole("button", { name: /retry/i }));

		await waitFor(() => expect(fetchHomeData).toHaveBeenCalledTimes(2));
		expect(await screen.findAllByText("Recovered")).toHaveLength(2);
	});

	it("retries an invalidated in-flight home load without showing its abort error", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue({
			token: "token",
			userId: "user",
			username: "Alex",
		});
		let rejectFirst!: (reason: unknown) => void;
		const fetchHomeData = vi
			.spyOn(jellyfin, "fetchHomeData")
			.mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						rejectFirst = reject;
					}),
			)
			.mockResolvedValueOnce({
				latestItems: [],
				libraryRows: [
					{
						libraryId: "anime",
						libraryName: "Anime",
						titleKey: "topRated",
						items: [item("fresh", "Fresh Home")],
					},
				],
				continueWatching: [],
				nextUp: [],
			});

		render(
			<ProgressProvider>
				<Page />
			</ProgressProvider>,
		);

		await waitFor(() => expect(fetchHomeData).toHaveBeenCalledTimes(1));
		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { libraryId: "anime" },
				}),
			);
			rejectFirst(
				new DOMException("This signal is aborted without reason", "AbortError"),
			);
		});

		await waitFor(() => expect(fetchHomeData).toHaveBeenCalledTimes(2));
		expect(await screen.findByText("Fresh Home")).toBeInTheDocument();
		expect(
			screen.queryByText("This signal is aborted without reason"),
		).not.toBeInTheDocument();
	});

	it("does not show the empty-library state while home data is loading", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue({
			token: "token",
			userId: "user",
			username: "Alex",
		});
		let resolveHome!: (data: jellyfin.HomeData) => void;
		vi.spyOn(jellyfin, "fetchHomeData").mockReturnValue(
			new Promise((resolve) => {
				resolveHome = resolve;
			}),
		);

		render(
			<ProgressProvider>
				<Page />
			</ProgressProvider>,
		);

		await waitFor(() => expect(jellyfin.fetchHomeData).toHaveBeenCalled());
		expect(screen.queryByText("Your library is empty")).not.toBeInTheDocument();

		resolveHome({
			latestItems: [],
			newlyAdded: [],
			libraryRows: [],
			continueWatching: [],
			nextUp: [],
			topRated: [],
			newReleases: [],
			movies: [],
			myList: [],
		});

		expect(await screen.findByText("Your library is empty")).toBeInTheDocument();
	});
});

function item(id: string, name: string): jellyfin.MediaItem {
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
