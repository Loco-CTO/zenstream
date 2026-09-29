// @ts-expect-error The Next.js configuration is an untyped ECMAScript module.
import nextConfig, { buildContentSecurityPolicy } from "../next.config.mjs";

describe("Content Security Policy", () => {
	it("keeps capability artwork URLs direct without a build-time host allowlist", () => {
		expect(nextConfig.images).toMatchObject({ unoptimized: true });
		expect(nextConfig.images.remotePatterns).toBeUndefined();
	});

	it("limits HTTP and WebSocket access to the configured Orchestrator origin", () => {
		const policy = buildContentSecurityPolicy("http://localhost:9098");

		expect(policy).toContain(
			"connect-src 'self' http://localhost:9098 ws://localhost:9098",
		);
		expect(policy).toContain("img-src 'self' data: blob: http://localhost:9098");
		expect(policy).toContain("media-src 'self' blob: http://localhost:9098");
		expect(policy).not.toContain("img-src 'self' data: blob: https:");
		expect(policy).not.toContain("connect-src 'self' https: wss:");
	});

	it("derives a secure WebSocket origin from an HTTPS Orchestrator", () => {
		const policy = buildContentSecurityPolicy("https://media.example.test/api");

		expect(policy).toContain(
			"connect-src 'self' https://media.example.test wss://media.example.test",
		);
	});

	it("permits eval only for the Next.js development runtime", () => {
		const developmentPolicy = buildContentSecurityPolicy(
			"http://127.0.0.1:9090",
			true,
		);
		const productionPolicy = buildContentSecurityPolicy(
			"http://127.0.0.1:9090",
			false,
		);

		expect(developmentPolicy).toContain(
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		);
		expect(productionPolicy).toContain("script-src 'self' 'unsafe-inline'");
		expect(productionPolicy).not.toContain("'unsafe-eval'");
	});
});
