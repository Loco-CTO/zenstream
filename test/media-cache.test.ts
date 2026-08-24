import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearMediaClientCache,
	getHeroTrailer,
	getLibraryItems,
	type MediaItem,
} from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

afterEach(() => {
	vi.restoreAllMocks();
	clearMediaClientCache();
});

describe("media client cache", () => {
	it("clears the resolved hero trailer cache with media caches", async () => {
		const item: MediaItem = {
			Id: "movie-1",
			Name: "Movie",
			RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=english" }],
		};
		const first = await getHeroTrailer(session, item);
		expect(first).toMatchObject({ kind: "youtube", videoId: "english" });

		clearMediaClientCache();
		const localized: MediaItem = {
			...item,
			RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=japanese" }],
		};
		const second = await getHeroTrailer(session, localized);
		expect(second).toMatchObject({ kind: "youtube", videoId: "japanese" });
	});

	it("does not reuse an invalidated in-flight library request", async () => {
		const firstController = new AbortController();
		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockImplementationOnce(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				}),
		);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "fresh",
							libraryId: "shows",
							type: "series",
							name: "Fresh",
							metadata: {},
						},
					],
					total: 1,
				}),
				{ status: 200 },
			),
		);

		const firstRequest = getLibraryItems(session, {
			parentId: "shows",
			startIndex: 0,
			limit: 40,
			sortBy: "lastAdded",
			sortOrder: "Descending",
			signal: firstController.signal,
		});
		await Promise.resolve();

		clearMediaClientCache();
		firstController.abort();
		const freshPage = await getLibraryItems(session, {
			parentId: "shows",
			startIndex: 0,
			limit: 40,
			sortBy: "lastAdded",
			sortOrder: "Descending",
		});

		await expect(firstRequest).rejects.toMatchObject({ name: "AbortError" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(freshPage.items[0]?.Id).toBe("fresh");
	});

	it("does not reuse an aborted in-flight library request", async () => {
		const firstController = new AbortController();
		const fetchMock = vi.spyOn(globalThis, "fetch");
		fetchMock.mockImplementationOnce(
			(_input, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				}),
		);
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					items: [
						{
							id: "fresh",
							libraryId: "shows",
							type: "series",
							name: "Fresh",
							metadata: {},
						},
					],
					total: 1,
				}),
				{ status: 200 },
			),
		);

		const firstRequest = getLibraryItems(session, {
			parentId: "shows",
			startIndex: 0,
			limit: 40,
			sortBy: "lastAdded",
			sortOrder: "Descending",
			signal: firstController.signal,
		});
		await Promise.resolve();

		firstController.abort();
		const freshPage = await getLibraryItems(session, {
			parentId: "shows",
			startIndex: 0,
			limit: 40,
			sortBy: "lastAdded",
			sortOrder: "Descending",
		});

		await expect(firstRequest).rejects.toMatchObject({ name: "AbortError" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(freshPage.items[0]?.Id).toBe("fresh");
	});
});
