import { describe, expect, it } from "vitest";
import { stackNewlyAdded } from "@/lib/media";
import type { JellyfinItem } from "@/lib/jellyfin";

describe("newly added grouping", () => {
	it("stacks adjacent sequential episodes from the same series", () => {
		const items: JellyfinItem[] = [
			episode("ep-2", "series-1", 2),
			episode("ep-1", "series-1", 1),
			episode("other", "series-2", 4),
		];

		expect(stackNewlyAdded(items).map((stack) => stack.items.map((item) => item.Id))).toEqual([
			["ep-2", "ep-1"],
			["other"],
		]);
	});

	it("does not stack non-sequential releases", () => {
		expect(stackNewlyAdded([
			episode("ep-3", "series-1", 3),
			episode("ep-1", "series-1", 1),
		])).toHaveLength(2);
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
