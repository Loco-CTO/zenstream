import { afterEach, describe, expect, it, vi } from "vitest";
import {
	changeAccountPassword,
	getSearchItems,
	getSearchPage,
} from "@/lib/media-api";

const session = { token: "bearer-token", userId: "user-1", username: "Alex" };

afterEach(() => {
	vi.restoreAllMocks();
});

describe("changeAccountPassword", () => {
	it("posts the authenticated password payload and accepts 204", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 204 }));

		await changeAccountPassword(
			session,
			"current-password",
			"new-password",
			"new-password",
		);

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/account/password"),
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Bearer bearer-token",
					"Content-Type": "application/json",
				}),
				body: JSON.stringify({
					currentPassword: "current-password",
					newPassword: "new-password",
					confirmNewPassword: "new-password",
				}),
			}),
		);
	});
});

describe("search pagination requests", () => {
	it("includes page, page size, and card view in result requests", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ items: [], total: 41, page: 2, pageSize: 20 }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		await expect(
			getSearchPage(session, "paged-search", { page: 2, pageSize: 20 }),
		).resolves.toMatchObject({
			items: [],
			total: 41,
			page: 2,
			pageSize: 20,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/catalog/search?query=paged-search&page=2&pageSize=20&view=card",
			),
			expect.anything(),
		);
	});

	it("uses one eight-item request for overlay search results", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ items: [], total: 41, page: 1, pageSize: 8 }),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);

		await getSearchItems(session, "overlay-search", { limit: 8 });

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/catalog/search?query=overlay-search&page=1&pageSize=8&view=card",
			),
			expect.anything(),
		);
	});
});
