import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	authenticateByName,
	getItems,
	getSearchItems,
	getLibraryItems,
	getLibraryViews,
	ITEM_IMAGE_TYPES,
	getLatestItems,
	getNewlyAddedItems,
	getNextUpItems,
	getResumeItems,
	getItem,
	getPlaybackInfo,
	getSeasons,
	getEpisodes,
	getSimilarItems,
	setFavorite,
	setPlayed,
	heroImage,
	heroImageUrl,
	landscapeImage,
	landscapeImageUrl,
	personImage,
	posterImage,
	seriesPosterImage,
	seriesPosterImageUrl,
	titleLogoImage,
	titleLogoImageUrl,
	getHeroTrailer,
	playbackStreams,
	playbackUrl,
	subtitleUrl,
	preserveTrickplay,
	trickplayPreview,
	youtubeVideoId,
	type JellyfinItem,
} from "@/lib/jellyfin";

const session = { token: "abc", userId: "user-1", username: "Alex" };

describe("jellyfin api helpers", () => {
	it("builds relevance-ranked search queries", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ Items: [] }), { status: 200 }));

		await getSearchItems(session, "  dune  ");

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/Items");
		expect(url.searchParams.get("searchTerm")).toBe("dune");
		expect(url.searchParams.has("sortBy")).toBe(false);
		expect(url.searchParams.has("sortOrder")).toBe(false);
	});

	it("notifies the app when an authenticated request is unauthorized", async () => {
		const onExpired = vi.fn();
		window.addEventListener("zenstream:auth-expired", onExpired);
		vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

		await expect(getItems(session, { limit: 1 })).rejects.toThrow("Request failed with 401.");
		expect(onExpired).toHaveBeenCalledOnce();
		window.removeEventListener("zenstream:auth-expired", onExpired);
	});
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ Items: [] }), { status: 200 }),
			),
		);
	});

	it("sends the login request shape", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					AccessToken: "token",
					User: { Id: "user", Name: "Alex" },
				}),
				{ status: 200 },
			),
		);

		await authenticateByName(" alex ", " secret ");

		expect(fetch).toHaveBeenCalledWith(
			"https://demo.jellyfin.org/stable/Users/AuthenticateByName",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: expect.stringMatching(/MediaBrowser Client="Web".*DeviceId="[^"]+"/),
				}),
				body: JSON.stringify({ Username: "alex", Pw: "secret" }),
			}),
		);
	});

	it("keeps a unique device identity across authenticated requests", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(new Response(JSON.stringify({ AccessToken: "token" }), { status: 200 }))
			.mockResolvedValueOnce(new Response(JSON.stringify({ Items: [] }), { status: 200 }));

		await authenticateByName("alex", "secret");
		await getItems(session, { limit: 1 });

		const loginAuthorization = String(vi.mocked(fetch).mock.calls[0][1]?.headers && (vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>).Authorization);
		const requestAuthorization = String(vi.mocked(fetch).mock.calls[1][1]?.headers && (vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>).Authorization);
		const loginDevice = loginAuthorization.match(/DeviceId="([^"]+)"/)?.[1];
		const requestDevice = requestAuthorization.match(/DeviceId="([^"]+)"/)?.[1];
		expect(loginDevice).toBeTruthy();
		expect(requestDevice).toBe(loginDevice);
		expect(loginDevice).not.toBe("Web");
	});

	it("uses the fixed playback quality ladder regardless of source bitrate", () => {
		const { qualities } = playbackStreams({
			MediaSources: [{ Bitrate: 1_000_000 }],
		});

		expect(qualities).toEqual(
			[0, 1, 2, 4, 8, 16, 32, 64].map((mbps) => mbps * 1_000_000),
		);
	});

	it("uses Jellyfin's negotiated HLS transcode URL for selected quality", () => {
		const url = playbackUrl(session, "episode-1", {
			Id: "source-1",
			TranscodingUrl: "/Videos/episode-guid/master.m3u8?PlaySessionId=session-1&ApiKey=abc",
		}, 4_000_000);

		expect(url).toBe(
			"https://miru.amai.space/Videos/episode-guid/master.m3u8?PlaySessionId=session-1&ApiKey=abc",
		);
	});

	it("does not add transcoding codec constraints to direct-play URLs", () => {
		const url = playbackUrl(session, "movie-1", { Id: "source-1" });
		const parsed = new URL(url, "https://miru.amai.space");

		expect(parsed.searchParams.get("Static")).toBe("true");
		expect(parsed.searchParams.has("VideoCodec")).toBe(false);
		expect(parsed.searchParams.has("AudioCodec")).toBe(false);
	});

	it("disables server-selected subtitles for playback", async () => {
		await getPlaybackInfo(session, "episode-1", { subtitleStreamIndex: -1 });

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.searchParams.get("subtitleStreamIndex")).toBe("-1");
		expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
			UserId: "user-1",
		});
	});

	it("requests Jellyfin subtitles as timeline-preserving WebVTT", () => {
		const url = new URL(subtitleUrl(session, "movie-1", { Id: "source-1" }, 3), "https://app.test");
		expect(url.pathname).toBe("/api/jellyfin/video/movie-1/source-1/Subtitles/3/Stream.vtt");
		expect(url.searchParams.get("MediaSourceId")).toBe("source-1");
		expect(url.searchParams.get("format")).toBe("vtt");
		expect(url.searchParams.get("addVttTimeMap")).toBe("true");
		expect(url.searchParams.get("copyTimestamps")).toBe("true");
	});

	it("sends playback limits and stream selections in the PlaybackInfo body", async () => {
		await getPlaybackInfo(session, "episode-1", {
			maxStreamingBitrate: 4_000_000,
			startTimeTicks: 123,
			mediaSourceId: "source-1",
			audioStreamIndex: 2,
			subtitleStreamIndex: -1,
		});

		expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
			UserId: "user-1",
			MaxStreamingBitrate: 4_000_000,
			StartTimeTicks: 123,
			MediaSourceId: "source-1",
			AudioStreamIndex: 2,
			SubtitleStreamIndex: -1,
			EnableDirectPlay: true,
			EnableDirectStream: true,
			EnableTranscoding: true,
			DeviceProfile: { MaxStreamingBitrate: 4_000_000 },
		});
	});

	it("preserves trickplay metadata when a negotiated source omits it", () => {
		const trickplay = { "320": { Width: 320, Height: 180, Interval: 10_000 } };
		const source = preserveTrickplay(
			{ Id: "source-1", TranscodingUrl: "/master.m3u8" },
			{ Id: "source-1", Trickplay: trickplay },
		);

		expect(source?.Trickplay).toEqual(trickplay);
	});

	it("keeps the media source id on trickplay preview URLs", () => {
		const preview = trickplayPreview(
			session,
			"episode-1",
			{
				Id: "source-1",
				Trickplay: { "320": { Width: 320, Height: 180, Interval: 10_000 } },
			},
			15,
		);

		expect(preview?.url).toContain("MediaSourceId=source-1");
	});

	it("builds resume row query parameters", async () => {
		await getResumeItems(session);

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/UserItems/Resume");
		expect(url.searchParams.get("userId")).toBe("user-1");
		expect(url.searchParams.get("includeItemTypes")).toBe("Episode,Movie");
		expect(url.searchParams.get("enableImageTypes")).toBe(ITEM_IMAGE_TYPES);
		expect(url.searchParams.get("enableTotalRecordCount")).toBe("false");
	});

	it("builds next up row query parameters", async () => {
		await getNextUpItems(session);

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/Shows/NextUp");
		expect(url.searchParams.get("disableFirstEpisode")).toBe("true");
		expect(url.searchParams.get("enableRewatching")).toBe("false");
	});

	it("builds item row query parameters", async () => {
		await getItems(session, {
			includeItemTypes: "Movie",
			sortBy: "DateCreated",
			sortOrder: "Descending",
			isFavorite: true,
		});

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/Items");
		expect(url.searchParams.get("recursive")).toBe("true");
		expect(url.searchParams.get("includeItemTypes")).toBe("Movie");
		expect(url.searchParams.get("sortBy")).toBe("DateCreated");
		expect(url.searchParams.get("isFavorite")).toBe("true");
	});

	it("builds latest feature query parameters", async () => {
		await getLatestItems(session);

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/Items");
		expect(url.searchParams.get("limit")).toBe("25");
		expect(url.searchParams.get("includeItemTypes")).toBe("Series,Movie");
		expect(url.searchParams.get("sortBy")).toBe("DateCreated");
		expect(url.searchParams.get("sortOrder")).toBe("Descending");
	});

	it("loads user-visible library views and excludes playlists", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					Items: [
						{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
						{ Id: "movies", Name: "Movies", CollectionType: "movies" },
						{
							Id: "collections",
							Name: "Collections",
							CollectionType: "boxsets",
						},
						{ Id: "lists", Name: "Playlists", CollectionType: "playlists" },
						{ Id: "music", Name: "Music", CollectionType: "music" },
					],
				}),
				{ status: 200 },
			),
		);

		const libraries = await getLibraryViews(session);
		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);

		expect(url.pathname).toBe("/Users/user-1/Views");
		expect(libraries.map((library) => library.Id)).toEqual([
			"shows",
			"movies",
			"collections",
		]);
	});

	it("builds paginated, server-sorted library queries and returns totals", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					Items: [{ Id: "series-41", Name: "Series" }],
					TotalRecordCount: 81,
				}),
				{ status: 200 },
			),
		);

		const page = await getLibraryItems(session, {
			parentId: "shows",
			collectionType: "tvshows",
			startIndex: 40,
			limit: 40,
			sortBy: "ProductionYear",
			sortOrder: "Ascending",
		});
		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);

		expect(url.pathname).toBe("/Items");
		expect(url.searchParams.get("parentId")).toBe("shows");
		expect(url.searchParams.get("startIndex")).toBe("40");
		expect(url.searchParams.get("limit")).toBe("40");
		expect(url.searchParams.get("includeItemTypes")).toBe("Series");
		expect(url.searchParams.get("sortBy")).toBe("ProductionYear");
		expect(url.searchParams.get("sortOrder")).toBe("Ascending");
		expect(url.searchParams.get("enableTotalRecordCount")).toBe("true");
		expect(page.totalRecordCount).toBe(81);
	});

	it("requests box sets for collection libraries", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ Items: [], TotalRecordCount: 0 }), {
				status: 200,
			}),
		);

		await getLibraryItems(session, {
			parentId: "collections",
			collectionType: "boxsets",
			startIndex: 0,
			sortBy: "SortName",
			sortOrder: "Ascending",
		});

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.searchParams.get("includeItemTypes")).toBe("BoxSet");
	});

	it("loads newly added episodes, movies, and collections only", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						Items: [
							{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
							{ Id: "movies", Name: "Movies", CollectionType: "movies" },
							{
								Id: "collections",
								Name: "Collections",
								CollectionType: "boxsets",
							},
							{
								Id: "playlists",
								Name: "Playlists",
								CollectionType: "playlists",
							},
							{ Id: "music", Name: "Music", CollectionType: "music" },
						],
					}),
					{ status: 200 },
				),
			)
			.mockImplementation(
				async () =>
					new Response(JSON.stringify({ Items: [] }), { status: 200 }),
			);

		const sections = await getNewlyAddedItems(session);

		const urls = vi
			.mocked(fetch)
			.mock.calls.map(([input]) => new URL(input as string));
		expect(urls[0].pathname).toBe("/Users/user-1/Views");
		expect(urls[1].searchParams.get("parentId")).toBe("shows");
		expect(urls[1].searchParams.get("includeItemTypes")).toBe("Episode");
		expect(urls[2].searchParams.get("parentId")).toBe("movies");
		expect(urls[2].searchParams.get("includeItemTypes")).toBe("Movie");
		expect(urls[3].searchParams.get("parentId")).toBe("collections");
		expect(urls[3].searchParams.get("includeItemTypes")).toBe("BoxSet");
		expect(sections.map((section) => section.libraryName)).toEqual([
			"Shows",
			"Movies",
			"Collections",
		]);
		expect(urls).toHaveLength(4);
		expect(
			urls.some((url) => url.searchParams.get("parentId") === "playlists"),
		).toBe(false);
		expect(urls[1].searchParams.get("fields")).toContain("SeriesPrimaryImage");
	});

	it("uses the parent series poster for newly added episodes", () => {
		const url = seriesPosterImageUrl({
			Id: "episode-1",
			Name: "Episode",
			Type: "Episode",
			SeriesId: "series-1",
			SeriesPrimaryImageTag: "series-poster",
			ImageTags: { Primary: "episode-thumbnail" },
		});

		expect(url).toContain("/Items/series-1/Images/Primary?");
		expect(url).toContain("tag=series-poster");
		expect(url).not.toContain("episode-1");
	});

	it("prefers Thumb images for landscape cards and Backdrop for hero", () => {
		const item: JellyfinItem = {
			Id: "item-1",
			Name: "Show",
			ImageTags: { Primary: "primary-tag", Thumb: "thumb-tag" },
			BackdropImageTags: ["backdrop-tag"],
		};

		expect(landscapeImageUrl(item)).toContain("/Images/Thumb?");
		expect(heroImageUrl(item)).toContain("/Images/Backdrop/0?");
	});

	it("returns the blurhash for the selected item image type and tag", () => {
		const item: JellyfinItem = {
			Id: "item-1",
			Name: "Show",
			ImageTags: { Primary: "primary-tag", Thumb: "thumb-tag" },
			BackdropImageTags: ["backdrop-tag"],
			ImageBlurHashes: {
				Primary: { "primary-tag": "primary-hash" },
				Thumb: { "thumb-tag": "thumb-hash" },
				Backdrop: { "backdrop-tag": "backdrop-hash" },
				Logo: { "logo-tag": "logo-hash" },
			},
		};

		expect(landscapeImage(item)).toMatchObject({
			src: expect.stringContaining("/Images/Thumb?"),
			blurHash: "thumb-hash",
		});
		expect(heroImage(item)).toMatchObject({
			src: expect.stringContaining("/Images/Backdrop/0?"),
			blurHash: "backdrop-hash",
		});
		expect(posterImage(item)).toMatchObject({
			src: expect.stringContaining("/Images/Primary?"),
			blurHash: "primary-hash",
		});
		expect(
			titleLogoImage({ ...item, ImageTags: { Logo: "logo-tag" } }),
		).toEqual({
			src: expect.stringContaining("/Images/Logo?"),
			blurHash: undefined,
		});
	});

	it("returns the blurhash for parent series and person images when provided", () => {
		expect(
			seriesPosterImage({
				Id: "episode-1",
				Name: "Episode",
				Type: "Episode",
				SeriesId: "series-1",
				SeriesPrimaryImageTag: "series-poster",
				ImageBlurHashes: {
					Primary: { "series-poster": "series-poster-hash" },
				},
			}),
		).toMatchObject({
			src: expect.stringContaining("/Items/series-1/Images/Primary?"),
			blurHash: "series-poster-hash",
		});

		expect(
			personImage({
				Name: "Actor One",
				PrimaryImageTag: "person-tag",
				ImageBlurHashes: {
					Primary: { "person-tag": "person-hash" },
				},
			}),
		).toMatchObject({
			src: expect.stringContaining("/Persons/Actor%20One/Images/Primary?"),
			blurHash: "person-hash",
		});
	});

	it("does not use thumbnail or poster artwork for backgrounds", () => {
		const item: JellyfinItem = {
			Id: "item-1",
			Name: "Show",
			ImageTags: { Primary: "primary-tag", Thumb: "thumb-tag" },
		};

		expect(heroImageUrl(item)).toBeNull();
	});

	it("builds title logo image URLs when returns a Logo tag", () => {
		const item: JellyfinItem = {
			Id: "item-1",
			Name: "Show",
			ImageTags: { Logo: "logo-tag" },
		};

		const url = titleLogoImageUrl(item);

		expect(url).toContain("/Items/item-1/Images/Logo?");
		expect(url).toContain("tag=logo-tag");
	});

	it("recognizes supported YouTube trailer URL shapes", () => {
		expect(youtubeVideoId("https://www.youtube.com/watch?v=video-1")).toBe(
			"video-1",
		);
		expect(youtubeVideoId("https://youtu.be/video-2")).toBe("video-2");
		expect(youtubeVideoId("https://vimeo.com/video-3")).toBeNull();
	});

	it("prefers a YouTube trailer without requesting local trailers", async () => {
		const trailer = await getHeroTrailer(session, {
			Id: "remote-trailer-item",
			Name: "Remote Trailer",
			RemoteTrailers: [{ Url: "https://youtu.be/remote-video" }],
			LocalTrailerCount: 1,
		});

		expect(trailer).toEqual({
			kind: "youtube",
			url: "https://www.youtube.com/embed/remote-video",
			videoId: "remote-video",
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("falls back to an authenticated local trailer", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify([{ Id: "local trailer" }]), { status: 200 }),
		);

		const trailer = await getHeroTrailer(session, {
			Id: "local-trailer-item",
			Name: "Local Trailer",
			RemoteTrailers: [{ Url: "https://vimeo.com/unsupported" }],
			LocalTrailerCount: 1,
		});

		expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).pathname).toBe(
			"/Items/local-trailer-item/LocalTrailers",
		);
		expect(trailer?.kind).toBe("local");
		if (trailer?.kind === "local") {
			const streamUrl = new URL(trailer.url);
			expect(streamUrl.pathname).toBe("/Videos/local%20trailer/stream");
			expect(streamUrl.searchParams.get("api_key")).toBe("abc");
			expect(streamUrl.searchParams.get("Static")).toBe("true");
		}
	});

	it("caches unavailable trailer results", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					Id: "no-trailer-item",
					Name: "No Trailer",
					LocalTrailerCount: 0,
				}),
				{ status: 200 },
			),
		);
		const item = { Id: "no-trailer-item", Name: "No Trailer" };

		await expect(getHeroTrailer(session, item)).resolves.toBeNull();
		await expect(getHeroTrailer(session, item)).resolves.toBeNull();

		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("loads detail, season, episode, and similar resources", async () => {
		await getItem(session, "item 1");
		await getSeasons(session, "series-1");
		await getEpisodes(session, "series-1", "season-2");
		await getSimilarItems(session, "series-1");

		const urls = vi
			.mocked(fetch)
			.mock.calls.map(([input]) => new URL(input as string));
		expect(urls[0].pathname).toBe("/Items/item%201");
		expect(urls[1].pathname).toBe("/Shows/series-1/Seasons");
		expect(urls[1].searchParams.get("userId")).toBe("user-1");
		expect(urls[2].pathname).toBe("/Shows/series-1/Episodes");
		expect(urls[2].searchParams.get("seasonId")).toBe("season-2");
		expect(urls[3].pathname).toBe("/Items/series-1/Similar");
		expect(urls[3].searchParams.get("limit")).toBe("8");
	});

	it("persists favorite and played state with the correct methods", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));

		await setFavorite(session, "item-1", true);
		await setFavorite(session, "item-1", false);
		await setPlayed(session, "item-1", true);
		await setPlayed(session, "item-1", false);

		expect(
			vi
				.mocked(fetch)
				.mock.calls.map(([input, init]) => [
					new URL(input as string).pathname,
					init?.method,
				]),
		).toEqual([
			["/UserFavoriteItems/item-1", "POST"],
			["/UserFavoriteItems/item-1", "DELETE"],
			["/UserPlayedItems/item-1", "POST"],
			["/UserPlayedItems/item-1", "DELETE"],
		]);
	});
});
