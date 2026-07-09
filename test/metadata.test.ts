import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("site metadata", () => {
	it("uses the ZenStream icon as the favicon", () => {
		const root = process.cwd();
		const layout = readFileSync(join(root, "app", "layout.tsx"), "utf8");

		expect(layout).toContain('icon: "/icon.png"');
		expect(existsSync(join(root, "public", "icon.png"))).toBe(true);
	});
});
