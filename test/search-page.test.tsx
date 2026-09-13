import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { SearchPage } from "@/components/pages/search-page";
import {
	emptySearchFacets,
	getSearchPage,
	landscapeImage,
	posterImage,
	type MediaItem,
	type SearchPage as SearchPageData,
} from "@/lib/media-api";

vi.mock("@/components/home/media-card", () => ({
	PosterCard: ({ item }: { item: MediaItem }) => <div>{item.Name}</div>,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		locale: "en",
		t: (key: string, values?: { count?: number }) =>
			key === "items" ? `${key}:${values?.count ?? ""}` : key,
	}),
}));

vi.mock("@/lib/media-api", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api");
	return {
		...actual,
		getSearchPage: vi.fn(),
		landscapeImage: vi.fn(actual.landscapeImage),
		posterImage: vi.fn(actual.posterImage),
	};
});

const session = { token: "token", userId: "user", username: "Alex" };
const result: MediaItem = { Id: "movie-1", Name: "A Livid", Type: "Movie" };
const secondResult: MediaItem = {
	Id: "movie-2",
	Name: "Another Livid",
	Type: "Movie",
};

function page(
	items: MediaItem[],
	total = items.length,
	pageNumber = 1,
	facetOverrides: Partial<ReturnType<typeof emptySearchFacets>> = {},
): SearchPageData {
	return {
		items,
		total,
		page: pageNumber,
		pageSize: 20,
		facets: { ...emptySearchFacets(), all: total, ...facetOverrides },
	};
}

describe("SearchPage", () => {
	beforeEach(() => {
		vi.mocked(getSearchPage).mockReset();
		vi.mocked(landscapeImage).mockReset();
		vi.mocked(posterImage).mockReset();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("finishes the global progress task after results load", async () => {
		vi.mocked(getSearchPage).mockResolvedValue(page([result]));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="a livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("A Livid")).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuetext",
			"Idle",
		);
	});

	it("shows server facets and requests a filtered page when a pill is selected", async () => {
		const series: MediaItem = {
			Id: "series-1",
			Name: "Livid Series",
			Type: "Series",
		};
		vi
			.mocked(getSearchPage)
			.mockResolvedValueOnce(page([result], 2, 1, { movie: 1, series: 1 }))
			.mockResolvedValueOnce(page([series], 1, 1, { series: 1 }));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("A Livid")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: "series 1" }));
		expect(await screen.findByText("Livid Series")).toBeInTheDocument();
		expect(vi.mocked(getSearchPage)).toHaveBeenNthCalledWith(
			2,
			session,
			"livid",
			expect.objectContaining({ page: 1, pageSize: 20, type: "series" }),
		);
	});

	it("does not render a featured panel when no backdrop is available", async () => {
		vi.mocked(getSearchPage).mockResolvedValue(page([result]));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("A Livid")).toBeInTheDocument();
		expect(screen.queryByTestId("search-featured")).not.toBeInTheDocument();
		expect(screen.getByTestId("search-result-row")).toBeInTheDocument();
	});

	it("uses poster proportions for video results and square cover art for music", async () => {
		const album: MediaItem = {
			Id: "album-1",
			Name: "Livid Album",
			Type: "MusicAlbum",
			AlbumArtist: "Livid Artist",
		};
		vi.mocked(posterImage).mockImplementation((item) => ({
			src: `/${item.Id}.jpg`,
			blurHash: undefined,
			width: 280,
			height: 420,
		}));
		vi
			.mocked(getSearchPage)
			.mockResolvedValue(page([result, album], 2, 1, { movie: 1, release: 1 }));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("Livid Album")).toBeInTheDocument();
		const artwork = screen.getAllByTestId("search-result-artwork");
		expect(artwork[0]).toHaveClass("aspect-[2/3]");
		expect(artwork[1]).toHaveClass("aspect-square");
	});

	it("uses the highest-ranked backdrop result as the featured panel", async () => {
		const series: MediaItem = {
			Id: "series-1",
			Name: "Livid Series",
			Type: "Series",
			ProductionYear: 2026,
		};
		vi.mocked(landscapeImage).mockImplementation((item) =>
			item.Id === "series-1"
				? {
						src: "/backdrop.jpg",
						blurHash: undefined,
						width: 400,
						height: 225,
					}
				: null,
		);
		vi.mocked(getSearchPage).mockResolvedValue(page([series]));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		const featured = await screen.findByTestId("search-featured");
		expect(featured).toBeInTheDocument();
		expect(featured).toHaveClass("aspect-[3/1]", "min-h-64");
		expect(screen.queryByTestId("search-result-row")).not.toBeInTheDocument();
	});

	it("finishes the global progress task after a failed search", async () => {
		vi.mocked(getSearchPage).mockRejectedValue(new Error("Search failed"));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="missing" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("searchLoadFailed")).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuetext",
			"Idle",
		);
	});

	it("requests and appends 20-item pages while showing the server total", async () => {
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(
					private readonly callback: (
						entries: Array<{ isIntersecting: boolean }>,
					) => void,
				) {}

				observe() {
					queueMicrotask(() => this.callback([{ isIntersecting: true }]));
				}

				disconnect() {}
			},
		);
		vi
			.mocked(getSearchPage)
			.mockResolvedValueOnce(page([result], 2, 1, { movie: 2 }))
			.mockResolvedValueOnce(page([result, secondResult], 2, 2, { movie: 2 }));

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("Another Livid")).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "all 2" })).toBeInTheDocument();
		expect(vi.mocked(getSearchPage)).toHaveBeenNthCalledWith(
			1,
			session,
			"livid",
			expect.objectContaining({ page: 1, pageSize: 20 }),
		);
		expect(vi.mocked(getSearchPage)).toHaveBeenNthCalledWith(
			2,
			session,
			"livid",
			expect.objectContaining({ page: 2, pageSize: 20 }),
		);
	});

	it("preserves loaded results and exposes retry when a later page fails", async () => {
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(
					private readonly callback: (
						entries: Array<{ isIntersecting: boolean }>,
					) => void,
				) {}

				observe() {
					queueMicrotask(() => this.callback([{ isIntersecting: true }]));
				}

				disconnect() {}
			},
		);
		const requestedPages: number[] = [];
		vi.mocked(getSearchPage).mockImplementation((_session, _query, options) => {
			const requestedPage = options?.page ?? 1;
			requestedPages.push(requestedPage);
			if (requestedPages.length === 1)
				return Promise.resolve(page([result], 2, 1));
			if (requestedPages.length === 2)
				return Promise.reject(new Error("page failed"));
			return Promise.resolve(page([secondResult], 2, 2));
		});

		render(
			<ProgressProvider>
				<SearchPage session={session} query="livid" />
			</ProgressProvider>,
		);

		expect(await screen.findByText("searchLoadFailed")).toBeInTheDocument();
		expect(screen.getByText("A Livid")).toBeInTheDocument();
		screen.getByRole("button", { name: "retry" }).click();
		expect(await screen.findByText("Another Livid")).toBeInTheDocument();
		expect(requestedPages).toEqual([1, 2, 2]);
	});

	it("ignores a stale page-one response after the query changes", async () => {
		let resolveFirst!: (value: SearchPageData) => void;
		let resolveSecond!: (value: SearchPageData) => void;
		const first = new Promise<SearchPageData>((resolve) => {
			resolveFirst = resolve;
		});
		const second = new Promise<SearchPageData>((resolve) => {
			resolveSecond = resolve;
		});
		vi
			.mocked(getSearchPage)
			.mockImplementationOnce(() => first)
			.mockImplementationOnce(() => second);

		const view = render(
			<ProgressProvider>
				<SearchPage session={session} query="old" />
			</ProgressProvider>,
		);
		view.rerender(
			<ProgressProvider>
				<SearchPage session={session} query="new" />
			</ProgressProvider>,
		);

		resolveSecond(page([secondResult]));
		expect(await screen.findByText("Another Livid")).toBeInTheDocument();
		resolveFirst(page([result]));
		await waitFor(() =>
			expect(screen.queryByText("A Livid")).not.toBeInTheDocument(),
		);
	});
});
