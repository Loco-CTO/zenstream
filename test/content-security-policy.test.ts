// @ts-expect-error The Next.js configuration is an untyped ECMAScript module.
import { buildContentSecurityPolicy } from "../next.config.mjs";

describe("Content Security Policy", () => {
	it("permits the configured local Orchestrator WebSocket origin", () => {
		const policy = buildContentSecurityPolicy("http://localhost:9098");

		expect(policy).toContain(
			"connect-src 'self' https: wss: http://localhost:9098 ws://localhost:9098;",
		);
	});

	it("derives a secure WebSocket origin from an HTTPS Orchestrator", () => {
		const policy = buildContentSecurityPolicy("https://media.example.test/api");

		expect(policy).toContain(
			"connect-src 'self' https: wss: https://media.example.test wss://media.example.test;",
		);
	});

	it("permits eval only for the Next.js development runtime", () => {
		const developmentPolicy = buildContentSecurityPolicy(undefined, true);
		const productionPolicy = buildContentSecurityPolicy(undefined, false);

		expect(developmentPolicy).toContain(
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		);
		expect(productionPolicy).toContain("script-src 'self' 'unsafe-inline'");
		expect(productionPolicy).not.toContain("'unsafe-eval'");
	});
});
