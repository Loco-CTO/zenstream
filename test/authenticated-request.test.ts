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
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
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

	it("rechecks protected requests under the cross-tab refresh lock", async () => {
		const previousLocks = Object.getOwnPropertyDescriptor(navigator, "locks");
		let lockTail = Promise.resolve();
		const locks = {
			request: vi.fn(async (_name: string, callback: () => Promise<Response>) => {
				const previous = lockTail;
				let release!: () => void;
				lockTail = new Promise<void>((resolve) => {
					release = resolve;
				});
				await previous;
				try {
					return await callback();
				} finally {
					release();
				}
			}),
		};
		Object.defineProperty(navigator, "locks", {
			configurable: true,
			value: locks,
		});
		let refreshed = false;
		let refreshRequests = 0;
		const protectedAttempts = new Map<string, number>();
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("/api/auth/refresh")) {
					refreshRequests += 1;
					refreshed = true;
					return new Response(null, { status: 200 });
				}
				const attempt = (protectedAttempts.get(url) ?? 0) + 1;
				protectedAttempts.set(url, attempt);
				return new Response(null, {
					status: attempt === 1 || !refreshed ? 401 : 200,
				});
			});

		try {
			const responses = await Promise.all([
				authenticatedFetch(session, "/api/catalog/home"),
				authenticatedFetch(session, "/api/catalog/libraries"),
			]);

			expect(responses.every((response) => response.ok)).toBe(true);
			expect(refreshRequests).toBe(1);
			expect(
				[...protectedAttempts.values()].reduce((sum, count) => sum + count, 0),
			).toBe(5);
			expect(locks.request).toHaveBeenCalledTimes(2);
			expect(locks.request).toHaveBeenCalledWith(
				expect.stringContaining("zenstream:auth-refresh"),
				expect.any(Function),
			);
			expect(fetchMock).toHaveBeenCalled();
		} finally {
			if (previousLocks) Object.defineProperty(navigator, "locks", previousLocks);
			else Reflect.deleteProperty(navigator, "locks");
		}
	});

	it("does not clear the session when refresh is unavailable", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) =>
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
		vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) =>
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
