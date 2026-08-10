import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogRequest, toMediaItem, type CatalogItem } from "@/lib/catalog";
import {
	authenticateByName,
	getInitialSeason,
	getPlaybackInfo,
	getPlaybackMarkers,
	getPlaybackSource,
	getTrickplayInfo,
	trickplayPreview,
	type MediaSource,
} from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

afterEach(() => vi.restoreAllMocks());

describe("catalog client", () => {
	it("loads source-specific intro and outro markers from the Orchestrator", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
			segments: [
				{ type: "intro", startSeconds: 5, endSeconds: 35 },
				{ type: "outro", startSeconds: 1200, endSeconds: 1260 },
			],
		}), { status: 200 }));
		await expect(getPlaybackMarkers(session, "episode-1", "source-1")).resolves.toEqual({
			intro: { start: 5, end: 35 }, outro: { start: 1200, end: 1260 },
		});
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/playback/items/episode-1/segments?sourceId=source-1"),
			expect.any(Object),
		);
	});

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
					Primary: {
						url: "/api/catalog/items/movie-1/images/Primary?language=en",
					},
					Backdrop: {
						url: "/api/catalog/items/movie-1/images/Backdrop?language=en",
					},
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

	it("derives the production year from the metadata date", () => {
		const item = toMediaItem({
			id: "series-1",
			libraryId: "shows",
			type: "series",
			name: "Example Show",
			metadata: { date: "2026-04-01" },
		} satisfies CatalogItem);

		expect(item.ProductionYear).toBe(2026);
	});

	it("maps separate cast and crew credits with authenticated portrait paths", () => {
		const item = toMediaItem({
			id: "movie-1",
			libraryId: "movies",
			type: "movie",
			name: "Fallback",
			metadata: {
				credits: {
					cast: [{ id: "person-1", name: "Actor", character: "Lead", image: { url: "/api/catalog/items/movie-1/people/person-1/image", blurHash: "hash" } }],
					crew: [{ id: "person-2", name: "Director", job: "Director", department: "Directing" }],
				},
			},
		} satisfies CatalogItem);

		expect(item.People).toEqual([
			expect.objectContaining({ Id: "person-1", Name: "Actor", Role: "Lead", CreditType: "cast", PrimaryImageTag: "/api/catalog/items/movie-1/people/person-1/image" }),
			expect.objectContaining({ Id: "person-2", Name: "Director", Role: "Director", Type: "Directing", CreditType: "crew" }),
		]);
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

	it("restores a missing YouTube trailer URL from its video key", () => {
		const item = toMediaItem({
			id: "movie-1",
			libraryId: "movies",
			type: "movie",
			name: "Example Movie",
			metadata: {
				trailers: [{ provider: "YouTube", videoId: "youtube-trailer" }],
			},
		} satisfies CatalogItem);

		expect(item.RemoteTrailers).toEqual([
			{ Url: "https://www.youtube.com/watch?v=youtube-trailer" },
		]);
	});

	it("prefers season 1 over specials when opening a series", () => {
		const seasons = [
			toMediaItem({
				id: "specials",
				libraryId: "shows",
				type: "season",
				name: "Specials",
				seasonNumber: 0,
				metadata: {},
			} satisfies CatalogItem),
			toMediaItem({
				id: "season-1",
				libraryId: "shows",
				type: "season",
				name: "Season 1",
				seasonNumber: 1,
				metadata: {},
			} satisfies CatalogItem),
		];

		expect(
			getInitialSeason(
				{ Id: "series", Name: "Example", Type: "Series" },
				seasons,
			)?.Id,
		).toBe("season-1");
	});

	it("uses a Bearer token for catalog requests", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ libraries: [] }), { status: 200 }),
			);
		await catalogRequest(session, "/api/catalog/libraries");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/catalog/libraries"),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer opaque-token",
				}),
			}),
		);
	});

	it("sends JSON credentials to the account login endpoint", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(
					JSON.stringify({
						token: "token",
						user: { id: "u", username: "alex" },
					}),
					{ status: 200 },
				),
			);
		await authenticateByName(" alex ", "password-123");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/auth/login"),
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ username: "alex", password: "password-123" }),
			}),
		);
	});

	it("negotiates playback through the catalog playback endpoint", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(
					JSON.stringify({
						mode: "direct",
						url: "/api/playback/items/movie-1/stream",
						source: { id: "source-1", container: "mp4", streams: [] },
					}),
					{ status: 200 },
				),
			);
		const playback = await getPlaybackInfo(session, "movie-1");
		expect(playback.source?.mode).toBe("direct");
		expect(playback.source?.url).toContain(
			"/api/playback/items/movie-1/stream",
		);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/playback/items/movie-1/negotiate"),
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("loads playback source metadata without negotiating playback", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					id: "source-1",
					streams: [{ index: 2, codec_type: "audio" }],
				}),
				{ status: 200 },
			),
		);
		const source = await getPlaybackSource(session, "movie-1");
		expect(source.Id).toBe("source-1");
		expect(source.MediaStreams).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/playback/items/movie-1/source"),
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: "Bearer opaque-token" }),
			}),
		);
		expect(fetchMock).not.toHaveBeenCalledWith(
			expect.stringContaining("/negotiate"),
			expect.anything(),
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
					sheets: [
						{
							index: 0,
							frameCount: 100,
							url: "/api/playback/trickplay/0.webp?access=ticket",
						},
					],
				}),
				{ status: 200 },
			),
		);

		const trickplay = await getTrickplayInfo(session, "movie-1", "source-1");
		expect(trickplay).toMatchObject({
			frameWidth: 320,
			frameHeight: 180,
			sheets: [{ index: 0 }],
		});
		expect(trickplay?.sheets?.[0]?.url).toMatch(
			/^https?:\/\/.*\/api\/playback\/trickplay\/0\.webp\?access=ticket$/,
		);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/playback/items/movie-1/trickplay?sourceId=source-1",
			),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer opaque-token",
				}),
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
						{ index: 0, url: "/trickplay/0.webp?access=ticket" },
						{ index: 1, url: "/trickplay/1.webp?access=ticket" },
					],
				},
			},
		};

		expect(trickplayPreview(session, "movie-1", source, 22)).toEqual({
			url: "/trickplay/1.webp?access=ticket",
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
