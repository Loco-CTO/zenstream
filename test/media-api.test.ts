import { afterEach, describe, expect, it, vi } from "vitest";
import {
	changeAccountPassword,
	getAudioLyrics,
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
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
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
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
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

describe("audio lyrics requests", () => {
	it("converts timed lyric payloads and forwards the abort signal", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					trackId: "track-1",
					lyrics: {
						source: "embedded",
						timed: true,
						language: null,
						lines: [
							{ text: "First", startSeconds: 1.25, endSeconds: 3.5 },
							{ text: "", startSeconds: 3.5, endSeconds: 4 },
						],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } },
			),
		);
		const controller = new AbortController();

		await expect(
			getAudioLyrics(session, "track-1", controller.signal),
		).resolves.toEqual({
			source: "embedded",
			timed: true,
			language: null,
			lines: [{ text: "First", startSeconds: 1.25, endSeconds: 3.5 }],
		});
		const [url, init] = fetchMock.mock.calls[0] ?? [];
		expect(String(url)).toContain("/api/playback/items/track-1/lyrics");
		expect((init as RequestInit | undefined)?.signal).toBeDefined();
		expect((init as RequestInit | undefined)?.signal?.aborted).toBe(false);
	});

	it("keeps lyric subtitle streams out of the normal subtitle list", async () => {
		const { playbackStreams } = await import("@/lib/media-api");
		const result = playbackStreams({
			source: {
				MediaStreams: [
					{ Type: "Subtitle", Kind: "lyrics" },
					{ Type: "Subtitle", Kind: "subtitle" },
				],
			},
		});

		expect(result.subtitles).toHaveLength(1);
		expect(result.subtitles[0]?.Kind).toBe("subtitle");
		expect(result.lyrics).toHaveLength(1);
		expect(result.lyrics?.[0]?.Kind).toBe("lyrics");
	});
});
