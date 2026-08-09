import { describe, expect, it } from "vitest";
import { catalogStatusChanges, parseCatalogEvent } from "@/lib/catalog-events";

describe("catalog events", () => {
	it("parses catalog updates", () => {
		expect(parseCatalogEvent('{"type":"catalog.updated","generation":4}')).toEqual({
			type: "catalog.updated",
			generation: 4,
		});
	});

	it("ignores invalid JSON", () => {
		expect(parseCatalogEvent("invalid")).toBeNull();
	});

	it("turns reconnect status into library-wide invalidations", () => {
		const status = parseCatalogEvent('{"type":"catalog.status","libraries":[{"id":"tv","catalogGeneration":7}]}');
		expect(status && catalogStatusChanges(status)).toEqual([{
			type: "catalog.updated",
			libraryId: "tv",
			generation: 7,
			rootEntityId: null,
		}]);
	});
});
