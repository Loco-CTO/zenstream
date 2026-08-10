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
});
