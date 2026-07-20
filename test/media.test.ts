import { describe, expect, it } from "vitest";
import { releaseDateLabel, stackNewlyAdded } from "@/lib/media";
import type { JellyfinItem } from "@/lib/jellyfin";

describe("newly added grouping", () => {
	it("stacks adjacent sequential episodes from the same series", () => {
		const items: JellyfinItem[] = [
			episode("ep-2", "series-1", 2),
			episode("ep-1", "series-1", 1),
			episode("other", "series-2", 4),
		];

		expect(
			stackNewlyAdded(items).map((stack) => stack.items.map((item) => item.Id)),
		).toEqual([["ep-2", "ep-1"], ["other"]]);
	});

	it("does not stack non-sequential releases", () => {
		expect(
			stackNewlyAdded([
				episode("ep-3", "series-1", 3),
				episode("ep-1", "series-1", 1),
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
			releaseDateLabel(
				{ Id: "movie", Name: "Film", ProductionYear: 2025 },
				"en",
			),
		).toBe("2025");
	});
});

function episode(id: string, seriesId: string, index: number): JellyfinItem {
	return {
		Id: id,
		Name: id,
		Type: "Episode",
		SeriesId: seriesId,
		ParentIndexNumber: 1,
		IndexNumber: index,
	};
}
