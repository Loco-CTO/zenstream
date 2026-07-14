import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

describe("ServiceWorkerRegistration", () => {
	afterEach(() => vi.restoreAllMocks());

	it("registers the production service worker", async () => {
		vi.stubEnv("NODE_ENV", "production");
		const register = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "serviceWorker", {
			configurable: true,
			value: { register },
		});
		render(<ServiceWorkerRegistration />);
		await vi.waitFor(() =>
			expect(register).toHaveBeenCalledWith("/sw.js", {
				scope: "/",
				updateViaCache: "none",
			}),
		);
	});
});
