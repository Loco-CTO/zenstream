import {
	buildRuntimeConfigScript,
	configuredOrchestratorUrl,
	normalizeOrchestratorUrl,
} from "../lib/runtime-config.mjs";

describe("runtime Orchestrator configuration", () => {
	it("normalizes the configured URL without dropping a path prefix", () => {
		expect(
			normalizeOrchestratorUrl("https://media.example.test/gateway///"),
		).toBe("https://media.example.test/gateway");
	});

	it("prefers the container runtime variable over the build-time compatibility value", () => {
		expect(
			configuredOrchestratorUrl({
				ZENSTREAM_ORCHESTRATOR_URL: "https://runtime.example.test",
				NEXT_PUBLIC_ZSO_URL: "https://build.example.test",
			}),
		).toBe("https://runtime.example.test");
	});

	it("rejects unsupported schemes, credentials, query strings, and fragments", () => {
		for (const value of [
			"ftp://media.example.test",
			"https://user:pass@media.example.test",
			"https://media.example.test?private=true",
			"https://media.example.test#fragment",
		]) {
			expect(() => normalizeOrchestratorUrl(value)).toThrow();
		}
	});

	it("serializes runtime configuration as JavaScript data", () => {
		expect(buildRuntimeConfigScript("https://media.example.test/api")).toBe(
			'window.__ZENSTREAM_RUNTIME_CONFIG__ = Object.freeze({ orchestratorUrl: "https://media.example.test/api" });\n',
		);
	});
});
