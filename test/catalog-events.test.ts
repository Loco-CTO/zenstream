import { describe, expect, it } from "vitest";
import { parseCatalogEvent } from "@/lib/catalog-events";

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
});
