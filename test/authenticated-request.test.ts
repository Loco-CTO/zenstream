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

	it("does not persist a bearer token in readable cookies", () => {
		setAuthCookies({ token: "secret", userId: "user-1", username: "Alex" });
		expect(document.cookie).not.toContain("token=");
	});
});
