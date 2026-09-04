import { describe, expect, it } from "vitest";
import {
	releaseDateLabel,
	selectRandomHeroItems,
	stackNewlyAdded,
	subtitle,
} from "@/lib/media";
import type { MediaItem } from "@/lib/media-api";

describe("random hero selection", () => {
	it("selects five unique visual items without always taking the prefix", () => {
		const items = Array.from({ length: 10 }, (_, index) =>
			heroItem(`hero-${index}`),
		);
		const selected = selectRandomHeroItems(items, () => 0.99);

		expect(selected).toHaveLength(5);
		expect(new Set(selected.map((item) => item.Id)).size).toBe(5);
		expect(selected.map((item) => item.Id)).not.toEqual(
			items.slice(0, 5).map((item) => item.Id),
		);
	});

	it("filters out non-visual items and keeps all available items below the cap", () => {
		const items = [
			{ Id: "no-backdrop", Name: "No Backdrop" },
			heroItem("hero-1"),
			heroItem("hero-2"),
			heroItem("hero-3"),
		];

		expect(selectRandomHeroItems(items, () => 0)).toEqual(
			expect.arrayContaining([items[1], items[2], items[3]]),
		);
		expect(selectRandomHeroItems(items, () => 0)).toHaveLength(3);
	});
});

describe("newly added grouping", () => {
	it("stacks adjacent sequential episodes added within one hour", () => {
		const items: MediaItem[] = [
			episode("ep-2", "series-1", 2, "2026-01-01T12:00:00Z"),
			episode("ep-1", "series-1", 1, "2026-01-01T11:15:00Z"),
			episode("other", "series-2", 4, "2026-01-01T10:00:00Z"),
		];

		expect(
			stackNewlyAdded(items).map((stack) => stack.items.map((item) => item.Id)),
		).toEqual([["ep-2", "ep-1"], ["other"]]);
	});

	it("does not stack non-sequential or separately added releases", () => {
		expect(
			stackNewlyAdded([
				episode("ep-3", "series-1", 3, "2026-01-01T12:00:00Z"),
				episode("ep-1", "series-1", 1, "2026-01-01T11:30:00Z"),
			]),
		).toHaveLength(2);
		expect(
			stackNewlyAdded([
				episode("ep-2", "series-1", 2, "2026-01-01T12:00:00Z"),
				episode("ep-1", "series-1", 1, "2026-01-01T10:59:59Z"),
			]),
		).toHaveLength(2);
	});
});

describe("release date labels", () => {
	it("shows the complete premiere date when available", () => {
		expect(
			releaseDateLabel(
				{ Id: "movie", Name: "Film", PremiereDate: "2025-03-09T00:00:00Z" },
				"en",
			),
		).toBe("9 March 2025");
	});

	it("falls back to the production year", () => {
		expect(
			releaseDateLabel({ Id: "movie", Name: "Film", ProductionYear: 2025 }, "en"),
		).toBe("2025");
	});

	it("uses the premiere date year when the production year is missing", () => {
		expect(
			subtitle({
				Id: "series",
				Name: "Series",
				Type: "Series",
				PremiereDate: "2026-04-01",
			}),
		).toBe("2026");
	});
});

describe("media subtitles", () => {
	it("uses a real Japanese middle dot between non-episode metadata", () => {
		expect(
			subtitle({
				Id: "series",
				Name: "Series",
				Type: "Series",
				ProductionYear: 2026,
				OfficialRating: "PG-13",
			}),
		).toBe("2026 ・ PG-13");
	});
});

function episode(
	id: string,
	seriesId: string,
	index: number,
	lastAddedAt: string,
): MediaItem {
	return {
		Id: id,
		Name: id,
		Type: "Episode",
		SeriesId: seriesId,
		SeasonId: "season-1",
		ParentIndexNumber: 1,
		IndexNumber: index,
		LastAddedAt: lastAddedAt,
	};
}

function heroItem(id: string): MediaItem {
	return {
		Id: id,
		Name: id,
		Type: "Movie",
		BackdropImageTags: [`/api/catalog/items/${id}/images/Backdrop`],
	};
}
