import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogRequest, toMediaItem, type CatalogItem } from "@/lib/catalog";
import {
	authenticateByName,
	fetchDetailData,
	fetchHomeData,
	getEpisodes,
	getInitialSeason,
	getPlaybackInfo,
	getPlaybackMarkers,
	getPlaybackSource,
	clearMediaClientSession,
	catalogImage,
	getTrickplayInfo,
	primeArtworkTicket,
	trickplayPreview,
	type MediaSource,
} from "@/lib/media-api";

const session = { token: "opaque-token", userId: "user-1", username: "Alex" };

afterEach(() => vi.restoreAllMocks());

describe("catalog client", () => {
	it("uses a stable direct artwork URL for the session capability", async () => {
		document.cookie = "userId=user-1";
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({ ticket: "artwork-ticket", expiresIn: 604800 }),
				{
					status: 200,
				},
			),
		);
		const browserSession = { token: "", userId: "user-1", username: "Alex" };

		await primeArtworkTicket(browserSession);
		const first = catalogImage(
			"/api/catalog/items/movie-1/images/Primary?language=en&v=version-1",
		);
		await primeArtworkTicket(browserSession);
		const second = catalogImage(
			"/api/catalog/items/movie-1/images/Primary?language=en&v=version-1",
		);

		expect(first?.src).toBe(second?.src);
		expect(first?.src).toContain("/api/catalog/items/movie-1/images/Primary");
		expect(first?.src).toContain("access=artwork-ticket");
		expect(first?.src).not.toContain("/api/artwork/");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		clearMediaClientSession();
		document.cookie = "userId=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
	});

	it("loads full metadata for featured hero items while keeping other home sections compact", async () => {
		const featuredRequests: URL[] = [];
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				const parsed = new URL(url);
				if (parsed.pathname === "/api/catalog/home") {
					if (parsed.searchParams.get("section") === "featured") {
						featuredRequests.push(parsed);
						return new Response(
							JSON.stringify({
								latestItems: [
									{
										id: "hero-1",
										libraryId: "movies",
										type: "movie",
										name: "Hero Movie",
										metadata: {
											title: "Hero Movie",
											overview: "Hero synopsis",
											images: {
												Backdrop: { url: "/backdrop" },
												Logo: { url: "/logo" },
											},
										},
									},
								],
							}),
							{ status: 200 },
						);
					}
					return new Response(JSON.stringify({}), { status: 200 });
				}
				if (parsed.pathname === "/api/catalog/libraries") {
					return new Response(JSON.stringify({ libraries: [] }), { status: 200 });
				}
				return new Response(null, { status: 404 });
			});

		const data = await fetchHomeData(session);

		expect(data.latestItems[0]).toMatchObject({
			Overview: "Hero synopsis",
			ImageTags: { Logo: "/logo" },
			BackdropImageTags: ["/backdrop"],
		});
		const homeRequests = fetchMock.mock.calls
			.map(([input]) => new URL(String(input)))
			.filter((url) => url.pathname === "/api/catalog/home");
		expect(featuredRequests).toHaveLength(1);
		expect(featuredRequests[0].searchParams.get("limit")).toBe("25");
		expect(
			homeRequests
				.filter((url) => url.searchParams.get("section") === "featured")
				.every((url) => url.searchParams.get("view") === "full"),
		).toBe(true);
		expect(
			homeRequests
				.filter((url) => url.searchParams.get("section") !== "featured")
				.every((url) => url.searchParams.get("view") === "card"),
		).toBe(true);
	});

	it("loads episode descriptions from the full detail projection", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = String(input);
				if (url.includes("section=header")) {
					return new Response(
						JSON.stringify({
							item: {
								id: "series-1",
								libraryId: "shows",
								type: "series",
								name: "Example Show",
								metadata: { title: "Example Show" },
							},
							seasons: [
								{
									id: "season-1",
									libraryId: "shows",
									type: "season",
									name: "Season 1",
									seasonNumber: 1,
									metadata: { title: "Season 1" },
								},
							],
						}),
						{ status: 200 },
					);
				}
				if (url.includes("section=episodes")) {
					const page = new URL(url).searchParams.get("page");
					return new Response(
						JSON.stringify({
							episodes: [
								{
									id: page === "2" ? "episode-2" : "episode-1",
									libraryId: "shows",
									type: "episode",
									name: page === "2" ? "Episode 2" : "Episode 1",
									seasonId: "season-1",
									seasonNumber: 1,
									episodeNumber: page === "2" ? 2 : 1,
									metadata:
										page === "2"
											? { title: "Episode 2", description: "Fallback description" }
											: { title: "Episode 1", overview: "Localized overview" },
								},
							],
							total: 41,
						}),
						{ status: 200 },
					);
				}
				if (url.includes("section=similar")) {
					return new Response(JSON.stringify({ similar: [] }), { status: 200 });
				}
				if (url.includes("section=credits")) {
					return new Response(JSON.stringify({ credits: { cast: [], crew: [] } }), {
						status: 200,
					});
				}
				return new Response(null, { status: 404 });
			});

		const data = await fetchDetailData(session, "series-1");

		expect(data.episodes.map((episode) => episode.Overview)).toEqual([
			"Localized overview",
			"Fallback description",
		]);
		const episodeRequests = fetchMock.mock.calls
			.map(([input]) => String(input))
			.filter((url) => url.includes("section=episodes"));
		expect(episodeRequests).toHaveLength(2);
		expect(episodeRequests.every((url) => url.includes("view=full"))).toBe(true);
		expect(episodeRequests.some((url) => url.includes("page=2"))).toBe(true);
	});

	it("loads switched-season episodes with full metadata", async () => {
		const seasonId = "season-switched-full";
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input) => {
				const url = new URL(String(input));
				if (url.pathname === `/api/catalog/items/${seasonId}`) {
					return new Response(
						JSON.stringify({
							id: seasonId,
							libraryId: "shows",
							type: "season",
							name: "Season 2",
							seasonNumber: 2,
							metadata: { title: "Season 2" },
						}),
						{ status: 200 },
					);
				}
				if (
					url.pathname === "/api/catalog/items" &&
					url.searchParams.get("parentId") === seasonId
				) {
					return new Response(
						JSON.stringify({
							items: [
								{
									id: "episode-switched-full",
									libraryId: "shows",
									type: "episode",
									name: "Second Season Premiere",
									seasonId,
									seasonNumber: 2,
									episodeNumber: 1,
									metadata: {
										title: "Second Season Premiere",
										overview: "Second season overview",
									},
								},
							],
						}),
						{ status: 200 },
					);
				}
				return new Response(null, { status: 404 });
			});

		const episodes = await getEpisodes(session, "series-1", seasonId);

		expect(episodes[0]?.Overview).toBe("Second season overview");
		const childrenRequest = fetchMock.mock.calls
			.map(([input]) => new URL(String(input)))
			.find(
				(url) =>
					url.pathname === "/api/catalog/items" &&
					url.searchParams.get("parentId") === seasonId,
			);
		expect(childrenRequest?.searchParams.get("view")).toBe("full");
	});

	it("loads source-specific intro and outro markers from the Orchestrator", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					segments: [
						{ type: "intro", startSeconds: 5, endSeconds: 35 },
						{ type: "outro", startSeconds: 1200, endSeconds: 1260 },
					],
				}),
				{ status: 200 },
			),
		);
		await expect(
			getPlaybackMarkers(session, "episode-1", "source-1"),
		).resolves.toEqual({
			intro: { start: 5, end: 35 },
			outro: { start: 1200, end: 1260 },
		});
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining(
				"/api/playback/items/episode-1/segments?sourceId=source-1",
			),
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
					cast: [
						{
							id: "person-1",
							name: "Actor",
							character: "Lead",
							image: {
								url: "/api/catalog/items/movie-1/people/person-1/image",
								blurHash: "hash",
							},
						},
					],
					crew: [
						{
							id: "person-2",
							name: "Director",
							job: "Director",
							department: "Directing",
						},
					],
				},
			},
		} satisfies CatalogItem);

		expect(item.People).toEqual([
			expect.objectContaining({
				Id: "person-1",
				Name: "Actor",
				Role: "Lead",
				CreditType: "cast",
				PrimaryImageTag: "/api/catalog/items/movie-1/people/person-1/image",
			}),
			expect.objectContaining({
				Id: "person-2",
				Name: "Director",
				Role: "Director",
				Type: "Directing",
				CreditType: "crew",
			}),
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
			getInitialSeason({ Id: "series", Name: "Example", Type: "Series" }, seasons)
				?.Id,
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
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					user: { id: "u", username: "alex" },
				}),
				{ status: 200 },
			),
		);
		await authenticateByName(" alex ", "password-123");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/auth/browser-login"),
			expect.objectContaining({
				method: "POST",
			}),
		);
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		expect(body).toMatchObject({ username: "alex", password: "password-123" });
		expect(body.device).toMatchObject({
			deviceType: "browser",
			clientName: "ZenStream Web",
		});
	});

	it("negotiates playback through the catalog playback endpoint", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
		expect(playback.source?.url).toContain("/api/playback/items/movie-1/stream");
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
