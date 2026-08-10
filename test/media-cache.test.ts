import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearMediaClientCache,
	clearMediaClientSession,
	fetchHomeData,
	getHeroTrailer,
	getLibraryItems,
	posterImage,
	primeResourceTicket,
	reportPlayback,
	type MediaItem,
} from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

afterEach(() => {
	vi.restoreAllMocks();
	clearMediaClientSession();
});

describe("media client cache", () => {
	it("clears the resolved hero trailer cache with media caches", async () => {
		const item: MediaItem = {
			Id: "movie-1",
			Name: "Movie",
			RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=english" }],
		};
		const first = await getHeroTrailer(session, item);
		expect(first?.videoId).toBe("english");

		clearMediaClientCache();
		const localized: MediaItem = {
			...item,
			RemoteTrailers: [{ Url: "https://www.youtube.com/watch?v=japanese" }],
		};
		const second = await getHeroTrailer(session, localized);
		expect(second?.videoId).toBe("japanese");
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

	it("removes the previous account's resource ticket on session teardown", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ticket: "private-ticket", expiresIn: 600 }), {
				status: 200,
			}),
		);
		await primeResourceTicket(session);
		const item = {
			Id: "movie-1",
			Name: "Movie",
			ImageTags: { Primary: "/api/catalog/items/movie-1/images/Primary" },
		} as MediaItem;
		expect(posterImage(item)?.src).toContain("access=private-ticket");

		clearMediaClientSession();

		expect(posterImage(item)?.src).not.toContain("access=");
	});

	it("invalidates cached home progress after reporting playback", async () => {
		const home = (name: string) => ({
			latestItems: [{ id: "movie-1", type: "movie", name, metadata: {} }],
			continueWatching: [],
			nextUp: [],
			myList: [],
			recentlyPlayed: [],
			genreRows: [],
			libraryRows: [],
		});
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				new Response(JSON.stringify(home("Before")), { status: 200 }),
			)
			.mockResolvedValueOnce(new Response(null, { status: 204 }))
			.mockResolvedValueOnce(
				new Response(JSON.stringify(home("After")), { status: 200 }),
			);

		await expect(fetchHomeData(session)).resolves.toMatchObject({
			latestItems: [{ Name: "Before" }],
		});
		await expect(fetchHomeData(session)).resolves.toMatchObject({
			latestItems: [{ Name: "Before" }],
		});
		await reportPlayback(session, "movie-1", 30, false, 120);
		await expect(fetchHomeData(session)).resolves.toMatchObject({
			latestItems: [{ Name: "After" }],
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});
});
