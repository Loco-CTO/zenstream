import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogRequest, toMediaItem, type CatalogItem } from "@/lib/catalog";
import {
	authenticateByName,
	getPlaybackInfo,
	getTrickplayInfo,
	trickplayPreview,
	type MediaSource,
} from "@/lib/media-api";

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

	it("loads ready trickplay manifests for the selected playback source", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					state: "ready",
					sourceId: "source-1",
					frameWidth: 320,
					frameHeight: 180,
					intervalSeconds: 5,
					columns: 10,
					rows: 10,
					frameCount: 103,
					sheets: [{ index: 0, frameCount: 100, url: "/api/playback/trickplay/0.jpg?access=ticket" }],
				}),
				{ status: 200 },
			),
		);

		await expect(getTrickplayInfo(session, "movie-1", "source-1")).resolves.toMatchObject({
			frameWidth: 320,
			frameHeight: 180,
			sheets: [{ index: 0, url: "/api/playback/trickplay/0.jpg?access=ticket" }],
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/playback/items/movie-1/trickplay?sourceId=source-1"),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer opaque-token" }),
			}),
		);
	});

	it("uses the manifest sheet URL and crops the requested timeline frame", () => {
		const source: MediaSource = {
			Id: "source-1",
			Trickplay: {
				"320": {
					state: "ready",
					frameWidth: 320,
					frameHeight: 180,
					intervalSeconds: 5,
					columns: 2,
					rows: 2,
					frameCount: 7,
					sheets: [
						{ index: 0, url: "/trickplay/0.jpg?access=ticket" },
						{ index: 1, url: "/trickplay/1.jpg?access=ticket" },
					],
				},
			},
		};

		expect(trickplayPreview(session, "movie-1", source, 22)).toEqual({
			url: "/trickplay/1.jpg?access=ticket",
			width: 320,
			height: 180,
			tileIndex: 1,
			cellX: 0,
			cellY: 0,
			columns: 2,
			rows: 2,
		});
		expect(trickplayPreview(session, "movie-1", source, 35)).toBeNull();
	});
});
