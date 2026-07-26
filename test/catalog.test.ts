import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogRequest, toMediaItem, type CatalogItem } from "@/lib/catalog";
import { authenticateByName, getPlaybackInfo } from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

afterEach(() => vi.restoreAllMocks());

describe("catalog client", () => {
	it("maps catalog metadata, state, and canonical artwork", () => {
		const item = toMediaItem({
			id: "movie-1",
			libraryId: "movies",
			type: "movie",
			name: "Fallback",
			metadata: {
				title: "Dune",
				officialRating: "PG-13",
				runtimeMinutes: 155,
				images: {
					Primary: { url: "/api/catalog/items/movie-1/images/Primary?language=en" },
					Backdrop: { url: "/api/catalog/items/movie-1/images/Backdrop?language=en" },
				},
			},
			userState: {
				favorite: true,
				played: false,
				unplayedItemCount: 3,
				playCount: 2,
				durationSeconds: 120,
				lastPlayedAt: "2026-07-26T00:00:00Z",
				positionSeconds: 42,
			},
		} satisfies CatalogItem);

		expect(item.Name).toBe("Dune");
		expect(item.ImageTags).toEqual({
			Primary: "/api/catalog/items/movie-1/images/Primary?language=en",
			Logo: undefined,
		});
		expect(item.BackdropImageTags).toEqual([
			"/api/catalog/items/movie-1/images/Backdrop?language=en",
		]);
		expect(item.UserData?.PlaybackPositionTicks).toBe(420_000_000);
		expect(item.OfficialRating).toBe("PG-13");
		expect(item.UserData).toMatchObject({
			UnplayedItemCount: 3,
			PlayCount: 2,
			DurationSeconds: 120,
			LastPlayedAt: "2026-07-26T00:00:00Z",
		});
	});

	it("maps URL-based TVDB trailers into remote trailers", () => {
		const item = toMediaItem({
			id: "series-1",
			libraryId: "shows",
			type: "series",
			name: "Fallback",
			metadata: {
				title: "Example Show",
				trailers: [
					{
						id: 123,
						language: "eng",
						name: "Official trailer",
						url: "https://www.youtube.com/watch?v=tvdb-trailer",
						runtime: 120,
					},
				],
			},
		} satisfies CatalogItem);

		expect(item.RemoteTrailers).toEqual([
			{ Url: "https://www.youtube.com/watch?v=tvdb-trailer" },
		]);
	});

	it("uses a Bearer token for catalog requests", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ libraries: [] }), { status: 200 }),
		);
		await catalogRequest(session, "/api/catalog/libraries");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/catalog/libraries"),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer opaque-token" }),
			}),
		);
	});

	it("sends JSON credentials to the account login endpoint", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ token: "token", user: { id: "u", username: "alex" } }), { status: 200 }),
		);
		await authenticateByName(" alex ", "password-123");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/auth/login"),
			expect.objectContaining({ method: "POST", body: JSON.stringify({ username: "alex", password: "password-123" }) }),
		);
	});

	it("negotiates playback through the catalog playback endpoint", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ mode: "direct", url: "/api/playback/items/movie-1/stream", source: { id: "source-1", container: "mp4", streams: [] } }), { status: 200 }),
		);
		const playback = await getPlaybackInfo(session, "movie-1");
		expect(playback.source?.mode).toBe("direct");
		expect(playback.source?.url).toContain("/api/playback/items/movie-1/stream");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/playback/items/movie-1/negotiate"),
			expect.objectContaining({ method: "POST" }),
		);
	});
});
