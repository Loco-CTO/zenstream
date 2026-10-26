import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HomeLayoutPreferencesProvider } from "@/components/home-layout-preferences-provider";
import { HomePage } from "@/components/pages/home-page";
import {
	getHomeCarouselSections,
	homeGenreSectionId,
	homeLayoutStorageKey,
	homeLibrarySectionId,
	orderHomeSections,
	parseHomeLayoutPreference,
	reorderHomeLayoutPreference,
	visibleHomeSections,
	type HomeLayoutPreference,
} from "@/lib/home-layout";
import { I18nProvider } from "@/lib/i18n";
import type { HomeData, MediaItem } from "@/lib/media-api";

vi.mock("@/components/home/hero", () => ({
	Hero: () => <div data-testid="home-hero" />,
}));

vi.mock("@/components/home/media-row", () => ({
	MediaRow: ({ title }: { title: string }) => (
		<div data-testid="home-row">{title}</div>
	),
}));

function item(Id: string, Type = "Movie") {
	return { Id, Type } as MediaItem;
}

const session = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};

function sampleHomeData(): Partial<HomeData> {
	return {
		continueWatching: [item("continue")],
		nextUp: [item("next")],
		recommendations: [item("recommendation")],
		libraryRows: [
			{
				libraryId: "library-a",
				libraryName: "Movies A",
				titleKey: "newlyAddedOn",
				items: [item("new-a")],
			},
			{
				libraryId: "library-b",
				libraryName: "Movies B",
				titleKey: "topRated",
				items: [item("rated-b")],
			},
		],
		favoriteMusic: [item("artist", "MusicArtist")],
		myList: [item("favorite")],
		genreRows: [{ genre: "Comedy", items: [item("comedy")] }],
	};
}

describe("Home layout preferences", () => {
	it("uses the existing default order and stable per-library and genre IDs", () => {
		const sections = getHomeCarouselSections(sampleHomeData());
		expect(sections.map(({ id }) => id)).toEqual([
			"home:continueWatching",
			"home:nextUp",
			"home:recommendations",
			homeLibrarySectionId("library-a", "newlyAddedOn"),
			homeLibrarySectionId("library-b", "topRated"),
			"home:favoriteMusic",
			"home:favorites",
			homeGenreSectionId("Comedy"),
		]);
		expect(orderHomeSections(sections, { order: [], hidden: [] })).toEqual(
			sections,
		);
	});

	it("reorders available sections, keeps unavailable IDs, and hides only selected rows", () => {
		const preference: HomeLayoutPreference = {
			order: ["home:nextUp", "home:offline", "home:continueWatching"],
			hidden: ["home:continueWatching", "home:offline"],
		};
		const available = [
			"home:continueWatching",
			"home:nextUp",
			"home:recommendations",
		];
		const reordered = reorderHomeLayoutPreference(preference, available, [
			"home:recommendations",
			"home:nextUp",
			"home:continueWatching",
		]);

		expect(reordered.order).toEqual([
			"home:recommendations",
			"home:offline",
			"home:nextUp",
			"home:continueWatching",
		]);
		expect(reordered.hidden).toEqual(preference.hidden);
		expect(
			visibleHomeSections(
				available.map((id) => ({ id })),
				reordered,
			).map(({ id }) => id),
		).toEqual(["home:recommendations", "home:nextUp"]);
	});

	it("falls back on malformed storage and appends newly available rows visibly", () => {
		expect(parseHomeLayoutPreference("not-json")).toEqual({
			order: [],
			hidden: [],
		});
		expect(
			parseHomeLayoutPreference('{"order":"bad","hidden":["home:nextUp"]}'),
		).toEqual({
			order: [],
			hidden: [],
		});
		expect(
			orderHomeSections([{ id: "a" }, { id: "b" }, { id: "new" }], {
				order: ["b", "a", "temporarily-missing"],
				hidden: [],
			}),
		).toEqual([{ id: "b" }, { id: "a" }, { id: "new" }]);
	});

	it("applies a saved hidden state to Home while leaving the hero fixed", () => {
		const serverUrl = "https://server.example";
		window.localStorage.setItem(
			homeLayoutStorageKey(serverUrl, session.userId),
			JSON.stringify({
				order: ["home:nextUp", "home:continueWatching"],
				hidden: ["home:continueWatching"],
			}),
		);

		render(
			<I18nProvider locale="en">
				<HomeLayoutPreferencesProvider
					serverUrl={serverUrl}
					userId={session.userId}
				>
					<HomePage data={sampleHomeData()} session={session} />
				</HomeLayoutPreferencesProvider>
			</I18nProvider>,
		);

		expect(screen.getByTestId("home-hero")).toBeInTheDocument();
		expect(
			screen.getAllByTestId("home-row").map((row) => row.textContent),
		).toEqual([
			"Next Up",
			"Recommended for you",
			"Newly Added on Movies A",
			"Top Rated on Movies B",
			"Favorite Music",
			"Favorites",
			"Comedy",
		]);
	});
});
