import { afterEach, describe, expect, it, vi } from "vitest";
import {
	clearMediaClientCache,
	fetchDetailData,
	getHeroTrailer,
	getFavoriteItems,
	getLibraryItems,
	getSearchPage,
	type MediaItem,
} from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

function jsonResponse(value: unknown) {
	return new Response(JSON.stringify(value), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

function listResponse(id: string) {
	return jsonResponse({
		items: [
			{
				id,
				libraryId: "shows",
				type: "series",
				name: id,
				metadata: {},
			},
		],
		total: 1,
		page: 1,
		pageSize: 20,
	});
}

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

	it("evicts pending requests without aborting callers or caching stale results", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		let resolveFirst!: (response: Response) => void;
		let firstSignal: AbortSignal | null | undefined;
		fetchMock.mockImplementationOnce((_input, init) => {
			firstSignal = init?.signal;
			return new Promise<Response>((resolve) => {
				resolveFirst = resolve;
			});
		});
		fetchMock.mockResolvedValueOnce(listResponse("fresh"));

		const firstRequest = getSearchPage(session, "invalidated", {
			page: 1,
			pageSize: 20,
			signal: new AbortController().signal,
		});
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		clearMediaClientCache();
		expect(firstSignal?.aborted).toBe(false);
		resolveFirst(listResponse("stale"));
		const stalePage = await firstRequest;
		const freshPage = await getSearchPage(session, "invalidated", {
			page: 1,
			pageSize: 20,
		});

		expect(stalePage.items[0]?.Id).toBe("stale");
		expect(freshPage.items[0]?.Id).toBe("fresh");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not share an aborted in-flight search request between callers", async () => {
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
		fetchMock.mockResolvedValueOnce(listResponse("fresh-search"));

		const firstRequest = getSearchPage(session, "revisit", {
			page: 1,
			pageSize: 20,
			signal: firstController.signal,
		});
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		firstController.abort();
		const secondRequest = getSearchPage(session, "revisit", {
			page: 1,
			pageSize: 20,
			signal: new AbortController().signal,
		});

		await expect(firstRequest).rejects.toMatchObject({ name: "AbortError" });
		const freshPage = await secondRequest;
		expect(freshPage.items[0]?.Id).toBe("fresh-search");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not share an aborted in-flight favorites request between callers", async () => {
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
		fetchMock.mockResolvedValueOnce(listResponse("fresh-favorite"));

		const firstRequest = getFavoriteItems(session, {
			signal: firstController.signal,
		});
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		firstController.abort();
		const secondRequest = getFavoriteItems(session, {
			signal: new AbortController().signal,
		});

		await expect(firstRequest).rejects.toMatchObject({ name: "AbortError" });
		const freshItems = await secondRequest;
		expect(freshItems[0]?.Id).toBe("fresh-favorite");
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("does not reuse an aborted in-flight detail request when a route is revisited", async () => {
		const firstController = new AbortController();
		const fetchMock = vi.spyOn(globalThis, "fetch");
		let fetchCount = 0;
		fetchMock.mockImplementation((input, init) => {
			fetchCount += 1;
			if (fetchCount === 1) {
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				});
			}

			const url = String(input);
			if (url.includes("section=header")) {
				return Promise.resolve(
					jsonResponse({
						item: {
							id: "movie-1",
							libraryId: "shows",
							type: "movie",
							name: "Fresh movie",
							metadata: {},
						},
						seasons: [],
					}),
				);
			}
			if (url.includes("section=similar")) {
				return Promise.resolve(jsonResponse({ similar: [] }));
			}
			return Promise.resolve(jsonResponse({ credits: { cast: [], crew: [] } }));
		});

		const firstRequest = fetchDetailData(
			session,
			"movie-1",
			undefined,
			firstController.signal,
		);
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

		firstController.abort();
		const secondRequest = fetchDetailData(
			session,
			"movie-1",
			undefined,
			new AbortController().signal,
		);

		await expect(firstRequest).rejects.toMatchObject({ name: "AbortError" });
		const freshDetail = await secondRequest;
		expect(freshDetail.item.Id).toBe("movie-1");
		expect(freshDetail.item.Name).toBe("Fresh movie");
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});
