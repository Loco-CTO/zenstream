import { afterEach, describe, expect, it, vi } from "vitest";
import { validateBrowserSession } from "@/lib/media-api";
import { authenticatedFetch } from "@/lib/authenticated-request";
import { clearAuthCookies, setAuthCookies } from "@/lib/session";

const session = { token: "", userId: "user-1", username: "Alex" };

afterEach(() => {
	vi.restoreAllMocks();
	clearAuthCookies();
});

describe("browser authentication transport", () => {
	it("includes cookies and reports the originating session on protected 401s", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 401 }));
		const expired = vi.fn();
		window.addEventListener("zenstream:auth-expired", expired);

		await authenticatedFetch(session, "/api/catalog/home");

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/catalog/home"),
			expect.objectContaining({
				credentials: "include",
				headers: expect.objectContaining({ Accept: "application/json" }),
			}),
		);
		expect(expired).toHaveBeenCalledWith(
			expect.objectContaining({ detail: { session } }),
		);
		window.removeEventListener("zenstream:auth-expired", expired);
	});

	it("validates the HttpOnly browser session without recursively emitting expiry", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ user: { id: "fresh", username: "Fresh" } }), {
				status: 200,
			}),
		);

		await expect(validateBrowserSession(session)).resolves.toEqual({
			token: "",
			userId: "fresh",
			username: "Fresh",
		});
	});

	it("single-flights browser refresh and retries concurrent 401s once", async () => {
		let protectedRequests = 0;
		let refreshRequests = 0;
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			const url = String(input);
			if (url.includes("/api/auth/refresh")) {
				refreshRequests += 1;
				return new Response(JSON.stringify({ user: { id: "user-1" } }), {
					status: 200,
				});
			}
			protectedRequests += 1;
			return new Response(null, {
				status: protectedRequests <= 2 ? 401 : 200,
			});
		});

		const responses = await Promise.all([
			authenticatedFetch(session, "/api/catalog/home"),
			authenticatedFetch(session, "/api/catalog/libraries"),
		]);

		expect(responses.every((response) => response.ok)).toBe(true);
		expect(refreshRequests).toBe(1);
		expect(protectedRequests).toBe(4);
		expect(fetchMock.mock.calls[2][1]).toEqual(
			expect.objectContaining({
				credentials: "include",
				headers: expect.objectContaining({
					"X-ZenStream-Auth-Flow": "refresh-v1",
				}),
			}),
		);
	});

	it("does not clear the session when refresh is unavailable", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			String(input).includes("/api/auth/refresh")
				? new Response(null, { status: 503 })
				: new Response(null, { status: 401 }),
		);
		const expired = vi.fn();
		window.addEventListener("zenstream:auth-expired", expired);

		const response = await authenticatedFetch(session, "/api/catalog/home");

		expect(response.status).toBe(401);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(expired).not.toHaveBeenCalled();
		window.removeEventListener("zenstream:auth-expired", expired);
	});

	it("keeps startup validation retryable when refresh is unavailable", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
			String(input).includes("/api/auth/refresh")
				? new Response(null, { status: 503 })
				: new Response(null, { status: 401 }),
		);

		await expect(validateBrowserSession(session)).rejects.toThrow(
			"Could not refresh the browser session.",
		);
	});

	it("does not persist a bearer token in readable cookies", () => {
		setAuthCookies({ token: "secret", userId: "user-1", username: "Alex" });
		expect(document.cookie).not.toContain("token=");
	});
});
