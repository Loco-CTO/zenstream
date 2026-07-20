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
	getSeriesEpisodes,
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
	authorizationHeader,
	type JellyfinItem,
} from "@/lib/jellyfin";
import { browserDeviceProfile } from "@/lib/browser-device-profile";
import { zenstreamVersion } from "@/lib/version";

const session = { token: "abc", userId: "user-1", username: "Alex" };

describe("jellyfin api helpers", () => {
	it("builds relevance-ranked search queries", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ Items: [] }), { status: 200 }),
		);

		await getSearchItems(session, "  dune  ");

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/api/content/items");
		expect(url.searchParams.get("searchTerm")).toBe("dune");
		expect(url.searchParams.has("sortBy")).toBe(false);
		expect(url.searchParams.has("sortOrder")).toBe(false);
	});

	it("notifies the app when an authenticated request is unauthorized", async () => {
		const onExpired = vi.fn();
		window.addEventListener("zenstream:auth-expired", onExpired);
		vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

		await expect(getItems(session, { limit: 1 })).rejects.toThrow(
			"Request failed with 401.",
		);
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
			"http://localhost:3000/api/auth/login",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					Authorization: expect.stringMatching(
						/MediaBrowser Client="Web".*DeviceId="[^"]+"/,
					),
				}),
				body: JSON.stringify({ username: "alex", password: "secret" }),
			}),
		);
	});

	it("sends the current frontend version in the Jellyfin device info", () => {
		const header = authorizationHeader();
		expect(header).toContain(`Version="${zenstreamVersion}"`);
	});

	it("keeps a unique device identity across authenticated requests", async () => {
		vi.mocked(fetch)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ AccessToken: "token" }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ Items: [] }), { status: 200 }),
			);

		await authenticateByName("alex", "secret");
		await getItems(session, { limit: 1 });

		const loginAuthorization = String(
			vi.mocked(fetch).mock.calls[0][1]?.headers &&
				(vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>)
					.Authorization,
		);
		const requestAuthorization = String(
			vi.mocked(fetch).mock.calls[1][1]?.headers &&
				(vi.mocked(fetch).mock.calls[1][1]?.headers as Record<string, string>)
					.Authorization,
		);
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
		const url = playbackUrl(
			session,
			"episode-1",
			{
				Id: "source-1",
			TranscodingUrl:
					"/api/video/episode-1/stream?lease=lease-1",
			},
			4_000_000,
		);

		expect(url).toBe(
			"http://localhost:3000/api/video/episode-1/stream?lease=lease-1",
		);
	});

	it("uses Jellyfin's negotiated direct stream URL without rebuilding it", () => {
		const url = playbackUrl(session, "episode-1", {
			Id: "source-1",
			DirectStreamUrl: "/api/video/episode-1/stream?lease=lease-1",
		});

		const parsed = new URL(url);
		expect(parsed.pathname).toBe("/api/video/episode-1/stream");
		expect(parsed.searchParams.has("MediaSourceId")).toBe(false);
		expect(parsed.searchParams.get("lease")).toBe("lease-1");
		expect(parsed.searchParams.has("VideoCodec")).toBe(false);
	});

	it("falls back to the gateway when an upstream URL escapes the gateway origin", () => {
		const url = new URL(
			playbackUrl(session, "episode-1", {
				Id: "source-1",
				DirectStreamUrl: "https://jellyfin.example/Videos/episode-1/stream",
			}),
		);

		expect(url.origin).toBe("http://localhost:3000");
		expect(url.pathname).toBe("/api/video/episode-1/stream");
		expect(url.searchParams.get("MediaSourceId")).toBe("source-1");
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
		expect(
			JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)),
		).toMatchObject({
			UserId: "user-1",
		});
	});

	it("requests Jellyfin subtitles as timeline-preserving WebVTT", () => {
		const url = new URL(
			subtitleUrl(session, "movie-1", { Id: "source-1" }, 3),
			"https://app.test",
		);
		expect(url.pathname).toBe(
			"/api/video/movie-1/subtitles/source-1/3",
		);
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

		expect(
			JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)),
		).toMatchObject({
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

	it("uses a Jellyfin-style device profile and keeps H.264/AAC transcoding conservative", () => {
		const profile = browserDeviceProfile({
			canPlayType: (mime) =>
				mime.includes("hvc1") || mime.includes("avc1") || mime.includes("mp4a")
					? "probably"
					: "",
		});

		expect(profile.directPlayProfiles).toContainEqual(
			expect.objectContaining({
				Container: "mp4,m4v",
				VideoCodec: "hevc,h264",
				AudioCodec: "aac",
			}),
		);
		expect(profile.transcodingProfiles).toEqual([
			expect.objectContaining({
				Container: "ts",
				VideoCodec: "h264",
				AudioCodec: "aac",
			}),
		]);
	});

	it("builds the device profile synchronously before PlaybackInfo", async () => {
		const canPlayType = vi.fn((mime: string) =>
			mime.includes("avc1") || mime.includes("mp4a") ? "probably" : "",
		);
		const createElement = vi
			.spyOn(document, "createElement")
			.mockReturnValue({ canPlayType } as unknown as HTMLVideoElement);
		try {
			await getPlaybackInfo(session, "movie-1");
		} finally {
			createElement.mockRestore();
		}
		expect(canPlayType).toHaveBeenCalled();
		expect(canPlayType.mock.invocationCallOrder[0]).toBeLessThan(
			vi.mocked(fetch).mock.invocationCallOrder[0],
		);
	});

	it("forces direct-play negotiation off for an explicit transcode request", async () => {
		await getPlaybackInfo(session, "movie-1", { forceTranscoding: true });

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
		expect(url.searchParams.get("enableDirectPlay")).toBe("false");
		expect(url.searchParams.get("enableDirectStream")).toBe("false");
		expect(body.EnableDirectPlay).toBe(false);
		expect(body.EnableDirectStream).toBe(false);
		expect(body.AllowVideoStreamCopy).toBe(false);
		expect(body.AllowAudioStreamCopy).toBe(false);
	});

	it("disables transcoding and transcoding profiles for hover-style direct-play requests", async () => {
		await getPlaybackInfo(session, "movie-1", { directPlayOnly: true });

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
		expect(url.searchParams.get("enableDirectPlay")).toBe("true");
		expect(url.searchParams.get("enableTranscoding")).toBe("false");
		expect(body.EnableDirectPlay).toBe(true);
		expect(body.EnableTranscoding).toBe(false);
		expect(body.DeviceProfile.TranscodingProfiles).toEqual([]);
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
		expect(url.pathname).toBe("/api/content/resume");
		expect(url.searchParams.get("userId")).toBe("user-1");
		expect(url.searchParams.get("includeItemTypes")).toBe("Episode,Movie");
		expect(url.searchParams.get("enableImageTypes")).toBe(ITEM_IMAGE_TYPES);
		expect(url.searchParams.get("enableTotalRecordCount")).toBe("false");
	});

	it("builds next up row query parameters", async () => {
		await getNextUpItems(session);

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/api/content/next-up");
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
		expect(url.pathname).toBe("/api/content/items");
		expect(url.searchParams.get("recursive")).toBe("true");
		expect(url.searchParams.get("includeItemTypes")).toBe("Movie");
		expect(url.searchParams.get("sortBy")).toBe("DateCreated");
		expect(url.searchParams.get("isFavorite")).toBe("true");
	});

	it("builds latest feature query parameters", async () => {
		await getLatestItems(session);

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/api/content/items");
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

		expect(url.pathname).toBe("/api/content/views");
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

		expect(url.pathname).toBe("/api/content/items");
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
		expect(urls[0].pathname).toBe("/api/content/views");
		expect(urls[1].searchParams.get("parentId")).toBe("shows");
		expect(urls[1].searchParams.get("includeItemTypes")).toBe("Episode");
		expect(urls[2].searchParams.get("parentId")).toBe("movies");
		expect(urls[2].searchParams.get("includeItemTypes")).toBe("Movie");
		expect(sections.map((section) => section.libraryName)).toEqual([
			"Shows",
			"Movies",
		]);
		expect(urls).toHaveLength(3);
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

		expect(url).toContain("/api/assets/items/series-1/images/Primary?");
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

		expect(landscapeImageUrl(item)).toContain("/images/Thumb?");
		expect(heroImageUrl(item)).toContain("/images/Backdrop?");
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
			src: expect.stringContaining("/images/Thumb?"),
			blurHash: "thumb-hash",
		});
		expect(heroImage(item)).toMatchObject({
			src: expect.stringContaining("/images/Backdrop?"),
			blurHash: "backdrop-hash",
		});
		expect(posterImage(item)).toMatchObject({
			src: expect.stringContaining("/images/Primary?"),
			blurHash: "primary-hash",
		});
		expect(
			titleLogoImage({ ...item, ImageTags: { Logo: "logo-tag" } }),
		).toEqual({
			src: expect.stringContaining("/images/Logo?"),
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
		src: expect.stringContaining("/api/assets/items/series-1/images/Primary?"),
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
			src: expect.stringContaining("/api/assets/people/Actor%20One/image?"),
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

		expect(url).toContain("/api/assets/items/item-1/images/Logo?");
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
			"/api/content/items/local-trailer-item/local-trailers",
		);
		expect(trailer?.kind).toBe("local");
		if (trailer?.kind === "local") {
			const streamUrl = new URL(trailer.url);
			expect(streamUrl.pathname).toBe("/api/video/local%20trailer/stream");
			expect(streamUrl.searchParams.has("api_key")).toBe(false);
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
		expect(urls[0].pathname).toBe("/api/content/items/item%201");
		expect(urls[1].pathname).toBe("/api/content/shows/series-1/seasons");
		expect(urls[1].searchParams.get("userId")).toBe("user-1");
		expect(urls[2].pathname).toBe("/api/content/shows/series-1/episodes");
		expect(urls[2].searchParams.get("seasonId")).toBe("season-2");
		expect(urls[3].pathname).toBe("/api/content/items/series-1/similar");
		expect(urls[3].searchParams.get("limit")).toBe("8");
	});

	it("loads all series episodes with user play state", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ Items: [] }), { status: 200 }),
		);

		await getSeriesEpisodes(session, "series 1");

		const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string);
		expect(url.pathname).toBe("/api/content/shows/series%201/episodes");
		expect(url.searchParams.get("userId")).toBe("user-1");
		expect(url.searchParams.has("seasonId")).toBe(false);
		expect(url.searchParams.get("enableUserData")).toBe("true");
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
			["/api/user/items/item-1/favorite", "POST"],
			["/api/user/items/item-1/favorite", "DELETE"],
			["/api/user/items/item-1/played", "POST"],
			["/api/user/items/item-1/played", "DELETE"],
		]);
	});
});
