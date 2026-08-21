import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { SearchPage } from "@/components/pages/search-page";
import { getSearchItems, type MediaItem } from "@/lib/media-api";

vi.mock("@/components/home/media-card", () => ({
	PosterCard: ({ item }: { item: MediaItem }) => <div>{item.Name}</div>,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock("@/lib/media-api", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api");
	return { ...actual, getSearchItems: vi.fn() };
});

const session = { token: "token", userId: "user", username: "Alex" };
const result: MediaItem = { Id: "movie-1", Name: "A Livid", Type: "Movie" };

describe("SearchPage", () => {
	beforeEach(() => {
		vi.mocked(getSearchItems).mockReset();
	});

	it("finishes the global progress task after results load", async () => {
		vi.mocked(getSearchItems).mockResolvedValue([result]);

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

	it("finishes the global progress task after a failed search", async () => {
		vi.mocked(getSearchItems).mockRejectedValue(new Error("Search failed"));

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
});
