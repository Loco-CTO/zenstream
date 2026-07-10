import type { AuthSession } from "@/lib/session";

export interface AuthResponse {
	AccessToken?: string;
	User?: {
		Id?: string;
		Name?: string;
	};
}

export interface JellyfinItem {
	Id: string;
	Name: string;
	Type?: string;
	SeriesName?: string;
	ParentIndexNumber?: number;
	IndexNumber?: number;
	Overview?: string;
	ProductionYear?: number;
	OfficialRating?: string;
	RunTimeTicks?: number;
	ChildCount?: number;
	RecursiveItemCount?: number;
	CommunityRating?: number;
	Genres?: string[];
	Studios?: Array<{ Name: string }>;
	People?: JellyfinPerson[];
	SeriesId?: string;
	SeasonId?: string;
	ImageTags?: Record<string, string | undefined>;
	BackdropImageTags?: string[];
	ImageBlurHashes?: JellyfinImageBlurHashes;
	RemoteTrailers?: Array<{ Url?: string }>;
	LocalTrailerCount?: number;
	UserData?: {
		IsFavorite?: boolean;
		UnplayedItemCount?: number;
		PlayedPercentage?: number;
		PlaybackPositionTicks?: number;
		Played?: boolean;
	};
	DateCreated?: string;
	CollectionType?: string;
	SeriesPrimaryImageTag?: string;
}

export interface JellyfinMediaStream {
	Index?: number;
	Type?: "Video" | "Audio" | "Subtitle" | string;
	Language?: string;
	DisplayTitle?: string;
	Title?: string;
	Codec?: string;
	IsDefault?: boolean;
	IsForced?: boolean;
	IsExternal?: boolean;
	DeliveryMethod?: string;
}

export interface JellyfinMediaSource {
	Id?: string;
	Container?: string;
	Name?: string;
	Bitrate?: number;
	Size?: number;
	SupportsDirectPlay?: boolean;
	SupportsDirectStream?: boolean;
	SupportsTranscoding?: boolean;
	DirectStreamUrl?: string;
	TranscodingUrl?: string;
	MediaStreams?: JellyfinMediaStream[];
	Trickplay?: Record<string, JellyfinTrickplayInfo>;
}

export interface JellyfinTrickplayInfo {
	Width?: number;
	Height?: number;
	TileWidth?: number;
	TileHeight?: number;
	ThumbnailCount?: number;
	Interval?: number;
	TileCount?: number;
}

export interface JellyfinPlaybackInfo {
	MediaSources?: JellyfinMediaSource[];
}

export interface PlaybackMarker {
	start: number;
	end: number;
}

export type JellyfinImageType = "Primary" | "Backdrop" | "Thumb" | "Logo";

export type JellyfinImageBlurHashes = Partial<
	Record<JellyfinImageType, Record<string, string | undefined>>
>;

export interface JellyfinImage {
	src: string;
	blurHash?: string;
}

export type HeroTrailer =
	| { kind: "youtube"; url: string; videoId: string }
	| { kind: "local"; url: string };

export interface JellyfinPerson {
	Name: string;
	Role?: string;
	Type?: string;
	PrimaryImageTag?: string;
	ImageBlurHashes?: Pick<JellyfinImageBlurHashes, "Primary">;
}

export interface DetailData {
	item: JellyfinItem;
	backgroundItem?: JellyfinItem;
	seasons: JellyfinItem[];
	episodes: JellyfinItem[];
	similar: JellyfinItem[];
}

export interface HomeData {
	latestItems: JellyfinItem[];
	newlyAdded: NewlyAddedSection[];
	continueWatching: JellyfinItem[];
	nextUp: JellyfinItem[];
	topRated: JellyfinItem[];
	newReleases: JellyfinItem[];
	movies: JellyfinItem[];
	myList: JellyfinItem[];
}

export type LibrarySortBy =
	| "SortName"
	| "DateCreated"
	| "DateLastContentAdded"
	| "PremiereDate"
	| "ProductionYear"
	| "CommunityRating"
	| "CriticRating"
	| "Runtime"
	| "DatePlayed"
	| "PlayCount";

export interface LibraryView extends JellyfinItem {
	CollectionType?: string;
}

export interface LibraryPage {
	items: JellyfinItem[];
	totalRecordCount: number;
}

export interface NewlyAddedSection {
	libraryId: string;
	libraryName: string;
	items: JellyfinItem[];
}

export const ITEM_FIELDS =
	"Overview,Genres,PrimaryImageAspectRatio,CommunityRating,ProductionYear,RecursiveItemCount,ParentId,ImageTags,BackdropImageTags,ImageBlurHashes,RemoteTrailers,UserData";
export const ITEM_IMAGE_TYPES = "Primary,Backdrop,Logo,Thumb";

export function jellyfinBaseUrl() {
	return (
		process.env.NEXT_PUBLIC_JELLYFIN_URL || "https://miru.amai.space"
	).replace(/\/+$/, "");
}

export function authorizationHeader(token?: string) {
	const parts = [
		token ? `Token="${token}"` : null,
		'Client="Web"',
		'Device="ZenStream"',
		'DeviceId="Web"',
		'Version="0.0.1b"',
	].filter(Boolean);

	return `MediaBrowser ${parts.join(", ")}`;
}

export async function authenticateByName(
	username: string,
	password: string,
): Promise<AuthResponse> {
	const response = await fetch(
		`${jellyfinBaseUrl()}/Users/AuthenticateByName`,
		{
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				Authorization: authorizationHeader(),
			},
			body: JSON.stringify({
				Username: username.trim(),
				Pw: password.trim(),
			}),
		},
	);

	if (!response.ok) {
		throw new Error(`Login failed with ${response.status}.`);
	}

	return response.json() as Promise<AuthResponse>;
}

export async function fetchHomeData(session: AuthSession): Promise<HomeData> {
	const [
		latestItems,
		newlyAdded,
		continueWatching,
		nextUp,
		topRated,
		newReleases,
		movies,
		myList,
	] = await Promise.all([
		getLatestItems(session),
		getNewlyAddedItems(session),
		getResumeItems(session),
		getNextUpItems(session),
		getItems(session, {
			sortBy: "CommunityRating",
			sortOrder: "Descending",
		}),
		getItems(session, {
			sortBy: "PremiereDate",
			sortOrder: "Descending",
		}),
		getItems(session, {
			includeItemTypes: "Movie",
			sortBy: "DateCreated",
			sortOrder: "Descending",
		}),
		getItems(session, {
			isFavorite: true,
			sortBy: "SortName",
			sortOrder: "Ascending",
		}),
	]);

	return {
		latestItems,
		newlyAdded,
		continueWatching,
		nextUp,
		topRated,
		newReleases,
		movies,
		myList,
	};
}

export async function getNewlyAddedItems(session: AuthSession) {
	const libraries = await getItemList(
		session,
		`/Users/${encodeURIComponent(session.userId)}/Views`,
		{
			fields: "CollectionType",
		},
	);
	return Promise.all(
		libraries
			.filter((library) => isSupportedLibraryType(library.CollectionType))
			.map(async (library) => ({
				libraryId: library.Id,
				libraryName: library.Name,
				items: await getItemList(session, "/Items", {
					userId: session.userId,
					parentId: library.Id,
					recursive: true,
					limit: 18,
					includeItemTypes: libraryItemTypes(library.CollectionType, true),
					sortBy: "DateCreated",
					sortOrder: "Descending",
					fields: `${ITEM_FIELDS},DateCreated,SeriesPrimaryImage`,
					enableImages: true,
					imageTypeLimit: 1,
					enableImageTypes: ITEM_IMAGE_TYPES,
					enableUserData: true,
				}),
			})),
	);
}

export function getLatestItems(session: AuthSession) {
	return getItems(session, {
		limit: 25,
		includeItemTypes: "Series,Movie",
		sortBy: "DateCreated",
		sortOrder: "Descending",
	});
}

export function getResumeItems(session: AuthSession) {
	return getItemList(session, "/UserItems/Resume", {
		userId: session.userId,
		limit: 18,
		startIndex: 0,
		includeItemTypes: "Episode,Movie",
		fields: ITEM_FIELDS,
		enableImages: true,
		imageTypeLimit: 1,
		enableImageTypes: ITEM_IMAGE_TYPES,
		enableUserData: true,
		enableTotalRecordCount: false,
	});
}

export function getNextUpItems(session: AuthSession) {
	return getItemList(session, "/Shows/NextUp", {
		userId: session.userId,
		limit: 18,
		startIndex: 0,
		fields: ITEM_FIELDS,
		enableImages: true,
		imageTypeLimit: 1,
		enableImageTypes: ITEM_IMAGE_TYPES,
		enableUserData: true,
		enableTotalRecordCount: false,
		disableFirstEpisode: true,
		enableResumable: false,
		enableRewatching: false,
	});
}

export function getItems(
	session: AuthSession,
	options: {
		limit?: number;
		startIndex?: number;
		includeItemTypes?: string;
		sortBy?: string;
		sortOrder?: "Ascending" | "Descending";
		isFavorite?: boolean;
	} = {},
) {
	return getItemList(session, "/Items", {
		userId: session.userId,
		startIndex: options.startIndex ?? 0,
		limit: options.limit ?? 18,
		recursive: true,
		includeItemTypes: options.includeItemTypes ?? "Series,Movie",
		sortBy: options.sortBy,
		sortOrder: options.sortOrder ?? "Descending",
		isFavorite: options.isFavorite,
		fields: ITEM_FIELDS,
		enableImages: true,
		imageTypeLimit: 1,
		enableImageTypes: ITEM_IMAGE_TYPES,
		enableUserData: true,
	});
}

export async function getLibraryViews(
	session: AuthSession,
	signal?: AbortSignal,
) {
	const libraries = await getItemList(
		session,
		`/Users/${encodeURIComponent(session.userId)}/Views`,
		{ fields: "CollectionType" },
		signal,
	);
	return libraries.filter(
		(library) => isSupportedLibraryType(library.CollectionType),
	) as LibraryView[];
}

export async function getLibraryItems(
	session: AuthSession,
	options: {
		parentId: string;
		collectionType?: string;
		startIndex: number;
		limit?: number;
		sortBy: LibrarySortBy;
		sortOrder: "Ascending" | "Descending";
		signal?: AbortSignal;
	},
): Promise<LibraryPage> {
	const includeItemTypes = libraryItemTypes(options.collectionType);
	const data = await jellyfinRequest(
		session,
		`/Items?${queryString({
			userId: session.userId,
			parentId: options.parentId,
			startIndex: options.startIndex,
			limit: options.limit ?? 40,
			recursive: true,
			includeItemTypes,
			sortBy: options.sortBy,
			sortOrder: options.sortOrder,
			fields: ITEM_FIELDS,
			enableImages: true,
			imageTypeLimit: 1,
			enableImageTypes: ITEM_IMAGE_TYPES,
			enableUserData: true,
			enableTotalRecordCount: true,
		})}`,
		{ signal: options.signal },
	);
	const result = data as { Items?: JellyfinItem[]; TotalRecordCount?: number };
	return {
		items: Array.isArray(result?.Items) ? result.Items : [],
		totalRecordCount:
			typeof result?.TotalRecordCount === "number"
				? result.TotalRecordCount
				: Array.isArray(result?.Items)
					? result.Items.length
					: 0,
	};
}

function isSupportedLibraryType(collectionType?: string) {
	return collectionType === "tvshows" || collectionType === "movies" || collectionType === "boxsets";
}

function libraryItemTypes(collectionType?: string, newlyAdded = false) {
	if (collectionType === "tvshows") return newlyAdded ? "Episode" : "Series";
	if (collectionType === "movies") return "Movie";
	if (collectionType === "boxsets") return "BoxSet";
	return "Series,Movie";
}

export async function fetchDetailData(
	session: AuthSession,
	itemId: string,
): Promise<DetailData> {
	const item = await getItem(session, itemId);
	const seriesId = item.Type === "Episode" ? item.SeriesId : item.Id;
	const backgroundItem =
		item.Type === "Episode" && !item.BackdropImageTags?.length && seriesId
			? await getItem(session, seriesId)
			: undefined;
	const seasons =
		(item.Type === "Series" || item.Type === "Episode") && seriesId
			? await getSeasons(session, seriesId)
			: [];
	const selectedSeason = getInitialSeason(item, seasons);
	const episodes =
		seriesId && selectedSeason
			? await getEpisodes(session, seriesId, selectedSeason.Id)
			: [];
	const similar =
		item.Type === "Episode" ? [] : await getSimilarItems(session, item.Id);
	return { item, backgroundItem, seasons, episodes, similar };
}

export function getInitialSeason(item: JellyfinItem, seasons: JellyfinItem[]) {
	if (item.SeasonId) {
		return seasons.find((season) => season.Id === item.SeasonId);
	}

	return seasons.find((season) => season.IndexNumber === 1) ?? seasons[0];
}

export async function getItem(session: AuthSession, itemId: string) {
	const response = await jellyfinRequest(
		session,
		`/Items/${encodeURIComponent(itemId)}`,
	);
	return response as JellyfinItem;
}

export async function getPlaybackInfo(
	session: AuthSession,
	itemId: string,
	options: { maxStreamingBitrate?: number; audioStreamIndex?: number; subtitleStreamIndex?: number } = {},
) {
	const response = await jellyfinRequest(
		session,
		`/Items/${encodeURIComponent(itemId)}/PlaybackInfo?${queryString({
			userId: session.userId,
			startTimeTicks: 0,
			maxStreamingBitrate: options.maxStreamingBitrate,
			audioStreamIndex: options.audioStreamIndex,
			subtitleStreamIndex: options.subtitleStreamIndex,
			mediaSourceId: itemId,
			enableTrickplay: true,
		})}`,
		{ method: "POST", body: JSON.stringify({ UserId: session.userId, EnableTrickplay: true, DeviceProfile: { Name: "ZenStream Web", MaxStreamingBitrate: options.maxStreamingBitrate } }) },
	);
	return response as JellyfinPlaybackInfo;
}

export function playbackStreams(info: JellyfinPlaybackInfo) {
	const source = info.MediaSources?.[0];
	return {
		source,
		audio: (source?.MediaStreams ?? []).filter((stream) => stream.Type === "Audio"),
		subtitles: (source?.MediaStreams ?? []).filter((stream) => stream.Type === "Subtitle"),
		qualities: [0, 1_000_000, 2_500_000, 5_000_000, 10_000_000].filter((bitrate) => !source?.Bitrate || bitrate === 0 || bitrate <= source.Bitrate),
	};
}

export function playbackUrl(session: AuthSession, itemId: string, source?: JellyfinMediaSource, bitrate?: number) {
	const params = new URLSearchParams({
		api_key: session.token,
		Static: bitrate ? "false" : "true",
		MediaSourceId: source?.Id ?? itemId,
		VideoCodec: "h264",
		AudioCodec: "aac",
		TranscodingMaxAudioChannels: "2",
		...(bitrate ? { TranscodingMaxBitrate: String(bitrate) } : {}),
	});
	return `${jellyfinBaseUrl()}/Videos/${encodeURIComponent(itemId)}/stream?${params}`;
}

export function subtitleUrl(session: AuthSession, itemId: string, source: JellyfinMediaSource | undefined, streamIndex: number) {
	const params = new URLSearchParams({ api_key: session.token, MediaSourceId: source?.Id ?? itemId });
	return `${jellyfinBaseUrl()}/Videos/${encodeURIComponent(itemId)}/${encodeURIComponent(source?.Id ?? itemId)}/Subtitles/${streamIndex}/Stream.vtt?${params}`;
}

export interface TrickplayPreview {
	url: string;
	width: number;
	height: number;
	tileIndex: number;
	cellX: number;
	cellY: number;
	columns: number;
	rows: number;
}

export function trickplayPreview(session: AuthSession, itemId: string, source: JellyfinMediaSource | undefined, timeSeconds: number): TrickplayPreview | null {
	const entries = Object.entries(source?.Trickplay ?? {}).sort(([a], [b]) => Number(b) - Number(a));
	const [width, info] = entries[0] ?? [];
	if (!width || !info) return null;
	const intervalSeconds = Math.max(1, (info.Interval ?? 10_000) / 1_000);
	const thumbnail = Math.max(0, Math.floor(timeSeconds / intervalSeconds));
	const columns = Math.max(1, info.TileWidth ?? 10);
	const rows = Math.max(1, info.TileHeight ?? 10);
	const tileSize = columns * rows;
	const tileIndex = Math.floor(thumbnail / tileSize);
	const tileOffset = thumbnail % tileSize;
	const params = new URLSearchParams({ api_key: session.token, MediaSourceId: source?.Id ?? itemId });
	return {
		url: `${jellyfinBaseUrl()}/Videos/${encodeURIComponent(itemId)}/Trickplay/${width}/${tileIndex}.jpg?${params}`,
		width: info.Width ?? Number(width),
		height: info.Height ?? Math.round(Number(width) * 9 / 16),
		tileIndex,
		cellX: tileOffset % columns,
		cellY: Math.floor(tileOffset / columns),
		columns,
		rows,
	};
}

export async function reportPlayback(session: AuthSession, itemId: string, positionSeconds: number, isPaused: boolean) {
	await jellyfinRequest(session, "/Sessions/Playing/Progress", {
		method: "POST",
		body: JSON.stringify({ ItemId: itemId, PositionTicks: Math.max(0, Math.round(positionSeconds * 10_000_000)), IsPaused: isPaused, PlayMethod: "DirectStream", PlaySessionId: "zenstream" }),
	});
}

export async function getPlaybackMarkers(session: AuthSession, itemId: string): Promise<{ intro?: PlaybackMarker; outro?: PlaybackMarker } | null> {
	const configuredEndpoint = process.env.NEXT_PUBLIC_INTRO_ENDPOINT;
	const itemPath = encodeURIComponent(itemId);
	const endpoints = [
		...(configuredEndpoint
			? [configuredEndpoint.includes("{itemId}") ? configuredEndpoint.replace("{itemId}", itemPath) : `${configuredEndpoint.replace(/\/$/, "")}/${itemPath}`]
			: []),
		`${jellyfinBaseUrl()}/Episode/${itemPath}/IntroTimestamps`,
		`${jellyfinBaseUrl()}/MediaSegments/${itemPath}`,
	];
	for (const endpoint of endpoints) {
		try {
			const response = await fetch(endpoint, { headers: { Authorization: authorizationHeader(session.token) } });
			if (!response.ok) continue;
			const markers = normalizePlaybackMarkers(await response.json());
			if (markers) return markers;
		} catch {
			// Marker providers are optional; try the next server-supported provider.
		}
	}
	return null;
}

function normalizePlaybackMarkers(value: unknown): { intro?: PlaybackMarker; outro?: PlaybackMarker } | null {
	const segments = Array.isArray(value)
		? value
		: Array.isArray((value as { Items?: unknown[] })?.Items)
			? (value as { Items: unknown[] }).Items
			: null;
	if (segments) {
		const byType = (types: string[]) => segments.find((segment) => {
			const type = (segment as { Type?: unknown }).Type;
			return typeof type === "string" && types.includes(type.toLowerCase());
		});
		const segmentMarker = (segment: unknown) => {
			if (!segment || typeof segment !== "object") return undefined;
			const data = segment as Record<string, unknown>;
			const start = data.StartTicks ?? data.StartTimeTicks;
			const end = data.EndTicks ?? data.EndTimeTicks;
			return toMarker(start, end);
		};
		const intro = segmentMarker(byType(["intro", "opening"]));
		const outro = segmentMarker(byType(["outro", "credits", "closing"]));
		return intro || outro ? { intro, outro } : null;
	}
	if (!value || typeof value !== "object") return null;
	const data = value as Record<string, unknown>;
	const marker = (name: "intro" | "outro", startKeys: string[], endKeys: string[]) => {
		const nested = data[name] as Record<string, unknown> | undefined;
		const start = nested?.start ?? nested?.Start ?? startKeys.map((key) => data[key]).find((entry) => typeof entry === "number");
		const end = nested?.end ?? nested?.End ?? endKeys.map((key) => data[key]).find((entry) => typeof entry === "number");
		return toMarker(start, end);
	};
	const intro = marker("intro", ["IntroStart", "IntroStartTicks", "StartTicks"], ["IntroEnd", "IntroEndTicks", "EndTicks"]);
	const outro = marker("outro", ["OutroStart", "CreditsStart", "CreditsStartTicks"], ["OutroEnd", "CreditsEnd", "CreditsEndTicks"]);
	return intro || outro ? { intro, outro } : null;
}

function toMarker(start: unknown, end: unknown): PlaybackMarker | undefined {
	if (typeof start !== "number" || typeof end !== "number" || end <= start) return undefined;
	return { start: start > 1_000_000 ? start / 10_000_000 : start, end: end > 1_000_000 ? end / 10_000_000 : end };
}

const heroTrailerCache = new Map<string, Promise<HeroTrailer | null>>();

export function getHeroTrailer(
	session: AuthSession,
	item: JellyfinItem,
): Promise<HeroTrailer | null> {
	const cacheKey = `${jellyfinBaseUrl()}:${session.userId}:${item.Id}`;
	const cached = heroTrailerCache.get(cacheKey);
	if (cached) return cached;

	const pending = resolveHeroTrailer(session, item).catch((error) => {
		heroTrailerCache.delete(cacheKey);
		throw error;
	});
	heroTrailerCache.set(cacheKey, pending);
	return pending;
}

async function resolveHeroTrailer(
	session: AuthSession,
	item: JellyfinItem,
): Promise<HeroTrailer | null> {
	const listedRemoteTrailer = item.RemoteTrailers?.map((trailer) =>
		youtubeVideoId(trailer.Url),
	).find(Boolean);

	if (listedRemoteTrailer) {
		return {
			kind: "youtube",
			url: `https://www.youtube.com/embed/${listedRemoteTrailer}`,
			videoId: listedRemoteTrailer,
		};
	}

	const detailedItem =
		item.LocalTrailerCount !== undefined
			? item
			: await getItem(session, item.Id);
	const detailedRemoteTrailer = detailedItem.RemoteTrailers?.map((trailer) =>
		youtubeVideoId(trailer.Url),
	).find(Boolean);
	if (detailedRemoteTrailer) {
		return {
			kind: "youtube",
			url: `https://www.youtube.com/embed/${detailedRemoteTrailer}`,
			videoId: detailedRemoteTrailer,
		};
	}

	if (!detailedItem.LocalTrailerCount) return null;

	const localTrailers = await jellyfinRequest(
		session,
		`/Items/${encodeURIComponent(detailedItem.Id)}/LocalTrailers`,
	);
	const trailer = Array.isArray(localTrailers)
		? (localTrailers[0] as { Id?: string } | undefined)
		: undefined;
	if (!trailer?.Id) return null;

	const params = new URLSearchParams({
		Static: "true",
		MediaSourceId: trailer.Id,
		api_key: session.token,
	});
	return {
		kind: "local",
		url: `${jellyfinBaseUrl()}/Videos/${encodeURIComponent(trailer.Id)}/stream?${params}`,
	};
}

export function youtubeVideoId(url?: string) {
	if (!url) return null;

	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.replace(/^www\./, "");
		if (hostname === "youtu.be") return parsed.pathname.split("/")[1] || null;
		if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;
		if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
		if (
			parsed.pathname.startsWith("/embed/") ||
			parsed.pathname.startsWith("/shorts/")
		) {
			return parsed.pathname.split("/")[2] || null;
		}
	} catch {
		return null;
	}

	return null;
}

export function getSeasons(session: AuthSession, seriesId: string) {
	return getItemList(
		session,
		`/Shows/${encodeURIComponent(seriesId)}/Seasons`,
		{
			userId: session.userId,
			fields: ITEM_FIELDS,
			enableImages: true,
			enableUserData: true,
		},
	);
}

export function getEpisodes(
	session: AuthSession,
	seriesId: string,
	seasonId: string,
) {
	return getItemList(
		session,
		`/Shows/${encodeURIComponent(seriesId)}/Episodes`,
		{
			userId: session.userId,
			seasonId,
			fields: ITEM_FIELDS,
			enableImages: true,
			imageTypeLimit: 1,
			enableImageTypes: ITEM_IMAGE_TYPES,
			enableUserData: true,
		},
	);
}

export function getSimilarItems(session: AuthSession, itemId: string) {
	return getItemList(session, `/Items/${encodeURIComponent(itemId)}/Similar`, {
		userId: session.userId,
		limit: 8,
		fields: ITEM_FIELDS,
	});
}

export async function setFavorite(
	session: AuthSession,
	itemId: string,
	favorite: boolean,
) {
	await jellyfinRequest(
		session,
		`/UserFavoriteItems/${encodeURIComponent(itemId)}`,
		{
			method: favorite ? "POST" : "DELETE",
		},
	);
}

export async function setPlayed(
	session: AuthSession,
	itemId: string,
	played: boolean,
) {
	await jellyfinRequest(
		session,
		`/UserPlayedItems/${encodeURIComponent(itemId)}`,
		{
			method: played ? "POST" : "DELETE",
		},
	);
}

export function landscapeImageUrl(item: JellyfinItem) {
	return landscapeImage(item)?.src ?? null;
}

export function landscapeImage(item: JellyfinItem) {
	return (
		imageData(item, "Thumb", 400, 225) ??
		imageData(item, "Backdrop", 400, 225) ??
		imageData(item, "Primary", 400, 225)
	);
}

export function heroImageUrl(item: JellyfinItem) {
	return heroImage(item)?.src ?? null;
}

export function heroImage(item: JellyfinItem) {
	return imageData(item, "Backdrop", 1600, 900);
}

export function posterImageUrl(item: JellyfinItem) {
	return posterImage(item)?.src ?? null;
}

export function posterImage(item: JellyfinItem) {
	return (
		imageData(item, "Primary", 280, 420) ??
		imageData(item, "Backdrop", 280, 420) ??
		imageData(item, "Thumb", 280, 420)
	);
}

export function seriesPosterImageUrl(item: JellyfinItem) {
	return seriesPosterImage(item)?.src ?? null;
}

export function seriesPosterImage(item: JellyfinItem) {
	if (item.Type !== "Episode") {
		return posterImage(item);
	}
	if (!item.SeriesId || !item.SeriesPrimaryImageTag) return null;
	return imageData(
		{
			...item,
			Id: item.SeriesId,
			ImageTags: { Primary: item.SeriesPrimaryImageTag },
		},
		"Primary",
		280,
		420,
	);
}

export function titleLogoImageUrl(item: JellyfinItem) {
	return titleLogoImage(item)?.src ?? null;
}

export function titleLogoImage(item: JellyfinItem) {
	return imageData(item, "Logo", 680, 260);
}

export function userImageUrl(userId: string) {
	const params = new URLSearchParams({
		maxWidth: "80",
		quality: "90",
	});

	return `${jellyfinBaseUrl()}/Users/${encodeURIComponent(userId)}/Images/Primary?${params.toString()}`;
}

export function personImageUrl(person: JellyfinPerson) {
	return personImage(person)?.src ?? null;
}

export function personImage(person: JellyfinPerson) {
	if (!person.PrimaryImageTag) return null;
	const params = new URLSearchParams({
		maxWidth: "144",
		quality: "90",
		tag: person.PrimaryImageTag,
	});
	return {
		src: `${jellyfinBaseUrl()}/Persons/${encodeURIComponent(person.Name)}/Images/Primary?${params}`,
		blurHash: person.ImageBlurHashes?.Primary?.[person.PrimaryImageTag],
	};
}

function imageData(
	item: JellyfinItem,
	imageType: JellyfinImageType,
	width: number,
	height: number,
) {
	const tag =
		imageType === "Backdrop"
			? item.BackdropImageTags?.[0]
			: item.ImageTags?.[imageType];
	if (!tag) return null;

	const index = imageType === "Backdrop" ? "/0" : "";
	const params = new URLSearchParams({
		fillWidth: String(width),
		fillHeight: String(height),
		quality: "90",
		tag,
	});

	return {
		src: `${jellyfinBaseUrl()}/Items/${item.Id}/Images/${imageType}${index}?${params.toString()}`,
		blurHash:
			imageType === "Logo"
				? undefined
				: item.ImageBlurHashes?.[imageType]?.[tag],
	};
}

async function getItemList(
	session: AuthSession,
	path: string,
	query: Record<string, unknown>,
	signal?: AbortSignal,
) {
	const data = await jellyfinRequest(session, `${path}?${queryString(query)}`, {
		signal,
	});
	if (Array.isArray(data)) {
		return data as JellyfinItem[];
	}
	if (Array.isArray((data as { Items?: unknown[] })?.Items)) {
		return (data as { Items: JellyfinItem[] }).Items;
	}
	return [];
}

async function jellyfinRequest(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
) {
	const response = await fetch(`${jellyfinBaseUrl()}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			Authorization: authorizationHeader(session.token),
			...init.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`Request failed with ${response.status}.`);
	}

	if (response.status === 204) return null;
	const text = await response.text();
	return text ? JSON.parse(text) : null;
}

function queryString(query: Record<string, unknown>) {
	const params = new URLSearchParams();

	Object.entries(query).forEach(([key, value]) => {
		if (value == null || value === "") return;
		params.set(key, String(value));
	});

	return params.toString();
}
