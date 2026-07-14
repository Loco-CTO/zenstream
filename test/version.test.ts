import { describe, expect, it, vi } from "vitest";
import { fetchOrchestratorVersion, zenstreamVersion } from "@/lib/version";

describe("version metadata", () => {
	it("formats the frontend version", () => {
		expect(zenstreamVersion).toMatch(/^v\d+\.\d+\.\d+-main\.\d+$/);
	});

	it("formats the orchestrator version response", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ version: "1.4.3", main: 127 }))));
		expect(await fetchOrchestratorVersion()).toBe("v1.4.3-main.127");
	});

	it("returns null when the orchestrator is unavailable", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
		expect(await fetchOrchestratorVersion()).toBeNull();
	});
});
