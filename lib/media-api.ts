import type { AuthSession } from "@/lib/session";
import { browserDeviceProfile } from "@/lib/browser-device-profile";
import { catalogRequest, toMediaItem, toMediaStreams, type CatalogItem } from "@/lib/catalog";

export interface AuthResponse {
	token?: string;
	expiresAt?: string;
	user?: {
		id?: string;
		username?: string;
	};
}

export interface MediaItem {
	Id: string;
	Name: string;
	Type?: string;
	SeriesName?: string;
	ParentIndexNumber?: number;
	IndexNumber?: number;
	Overview?: string;
	ProductionYear?: number;
	PremiereDate?: string;
	OfficialRating?: string;
	RunTimeTicks?: number;
	ChildCount?: number;
	RecursiveItemCount?: number;
	CommunityRating?: number;
	Genres?: string[];
	Studios?: Array<{ Name: string }>;
	People?: MediaPerson[];
	SeriesId?: string;
	SeasonId?: string;
	ImageTags?: Record<string, string | undefined>;
	BackdropImageTags?: string[];
	ImageBlurHashes?: ImageBlurHashes;
	RemoteTrailers?: Array<{ Url?: string }>;
	LocalTrailerCount?: number;
	UserData?: {
		IsFavorite?: boolean;
		UnplayedItemCount?: number;
		PlayedPercentage?: number;
		PlaybackPositionTicks?: number;
		Played?: boolean;
		PlayCount?: number;
		DurationSeconds?: number;
		LastPlayedAt?: string;
	};
	DateCreated?: string;
	CollectionType?: string;
	SeriesPrimaryImageTag?: string;
	Trickplay?: Record<string, Record<string, TrickplayInfo>>;
	LibraryId?: string;
	CatalogParentId?: string;
	ChildIds?: string[];
}

export interface MediaStream {
	Index?: number;
	Type?: "Video" | "Audio" | "Subtitle" | string;
	Language?: string;
	DisplayTitle?: string;
	Title?: string;
	Codec?: string;
	Profile?: string;
	Level?: number;
	BitDepth?: number;
	VideoRangeType?: string;
	ColorPrimaries?: string;
	ColorTransfer?: string;
	ColorSpace?: string;
	IsInterlaced?: boolean;
	Width?: number;
	Height?: number;
	BitRate?: number;
	AverageFrameRate?: number;
	RealFrameRate?: number;
	Channels?: number;
	SampleRate?: number;
	IsDefault?: boolean;
	IsForced?: boolean;
	IsExternal?: boolean;
	DeliveryMethod?: string;
	FileId?: string;
}

export interface MediaSource {
	Id?: string;
	Container?: string;
	Name?: string;
	Bitrate?: number;
	Size?: number;
	SupportsDirectPlay?: boolean;
	SupportsDirectStream?: boolean;
	SupportsTranscoding?: boolean;
	url?: string;
	mode?: "direct" | "remux" | "audio-transcode" | "video-transcode";
	sessionState?: string;
	sessionId?: string;
	startPositionSeconds?: number;
	actualStartPositionSeconds?: number;
	MediaStreams?: MediaStream[];
	Trickplay?: Record<string, TrickplayInfo>;
}

export interface TrickplayInfo {
	Width?: number;
	Height?: number;
	TileWidth?: number;
	TileHeight?: number;
	ThumbnailCount?: number;
	Interval?: number;
	TileCount?: number;
}

export interface PlaybackInfo {
	source?: MediaSource;
	sessionId?: string;
	startPositionSeconds?: number;
}

export interface PlaybackSessionStatus {
	sessionId: string;
	sessionState: string;
	sourceId?: string;
	playlistReady?: boolean;
	segmentCount?: number;
	firstSegmentDurationSeconds?: number;
	processAlive?: boolean;
	requestedStartPositionSeconds?: number;
	actualStartPositionSeconds?: number;
	seekGeneration?: number;
	errorCode?: string;
	errorDetail?: string;
	lastAccessedAt?: string;
}

export interface PlaybackMarker {
	start: number;
	end: number;
}

export type ArtworkType = "Primary" | "Backdrop" | "Logo" | "Banner";

const LIST_CACHE_TTL_MS = 30_000;
const DETAIL_CACHE_TTL_MS = 120_000;
const clientCache = new Map<string, { expiresAt: number; value: unknown }>();
const clientInFlight = new Map<string, Promise<unknown>>();

async function cachedClientRequest<T>(
	key: string,
	loader: () => Promise<T>,
	ttl = LIST_CACHE_TTL_MS,
): Promise<T> {
	const cached = clientCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.value as T;
	const pending = clientInFlight.get(key);
	if (pending) return pending as Promise<T>;
	const request = loader().then((value) => {
		clientCache.set(key, { expiresAt: Date.now() + ttl, value });
		return value;
	}).finally(() => clientInFlight.delete(key));
	clientInFlight.set(key, request);
	return request;
}

export function clearMediaClientCache() {
	clientCache.clear();
}

export type ImageBlurHashes = Partial<
	Record<ArtworkType, Record<string, string | undefined>>
>;

export interface MediaImage {
	src: string;
	blurHash?: string;
}

export type HeroTrailer =
	| { kind: "youtube"; url: string; videoId: string }
	| { kind: "local"; url: string };

export interface MediaPerson {
	Name: string;
	Role?: string;
	Type?: string;
	PrimaryImageTag?: string;
	ImageBlurHashes?: Pick<ImageBlurHashes, "Primary">;
}

export interface DetailData {
	item: MediaItem;
	backgroundItem?: MediaItem;
	seasons: MediaItem[];
	episodes: MediaItem[];
	similar: MediaItem[];
	collectionItems?: MediaItem[];
}

export interface HomeData {
	latestItems: MediaItem[];
	newlyAdded?: NewlyAddedSection[];
	continueWatching: MediaItem[];
	nextUp: MediaItem[];
	libraryRows: HomeLibrarySection[];
	topRated?: MediaItem[];
	newReleases?: MediaItem[];
	movies?: MediaItem[];
	myList?: MediaItem[];
}

export interface HomeLibrarySection extends NewlyAddedSection {
	titleKey: "topRated" | "newReleases" | "newlyAddedOn";
	stackEpisodes?: boolean;
}

export type LibrarySortBy =
	| "title"
	| "added"
	| "lastAdded"
	| "release"
	| "rating"
	| "runtime";

export interface LibraryView extends MediaItem {
	CollectionType?: string;
	SupportsLastAdded?: boolean;
}

export interface LibraryPage {
	items: MediaItem[];
	totalRecordCount: number;
}

export async function getSearchItems(
	session: AuthSession,
	query: string,
	options: { limit?: number; signal?: AbortSignal } = {},
): Promise<MediaItem[]> {
	const term = query.trim();
	if (!term) return [];
	const limit = options.limit ?? 40;
	return cachedClientRequest(
		`search:${session.userId}:${term.toLocaleLowerCase()}`,
		async () => {
			const result = await catalogRequest<{ items: CatalogItem[] }>(session, `/api/catalog/search?query=${encodeURIComponent(term)}&pageSize=40`);
			return result.items.map(toMediaItem);
		},
	).then((items) => items.slice(0, limit));
}

export interface NewlyAddedSection {
	libraryId: string;
	libraryName: string;
	items: MediaItem[];
}

export function orchestratorBaseUrl() {
	if (process.env.NEXT_PUBLIC_ZSO_URL)
		return process.env.NEXT_PUBLIC_ZSO_URL.replace(/\/+$/, "");
	if (typeof window !== "undefined") return window.location.origin;
	return "http://127.0.0.1:9090";
}

let resourceTicket: { value: string; expiresAt: number; token: string } | null = null;

export async function primeResourceTicket(session: AuthSession): Promise<string | null> {
	if (resourceTicket && resourceTicket.token === session.token && resourceTicket.expiresAt > Date.now() + 30_000)
		return resourceTicket.value;
	try {
		const response = await fetch(`${orchestratorBaseUrl()}/api/auth/resource-ticket`, {
			headers: { Authorization: `Bearer ${session.token}` },
			cache: "no-store",
		});
		if (!response.ok) return null;
		const payload = (await response.json()) as { ticket?: unknown; expiresAt?: unknown };
		if (typeof payload.ticket !== "string") return null;
		const responseValue = payload as { expiresIn?: unknown };
		const expiresAt = typeof payload.expiresAt === "number" ? payload.expiresAt * 1000 : typeof responseValue.expiresIn === "number" ? Date.now() + responseValue.expiresIn * 1000 : Date.now() + 10 * 60_000;
		resourceTicket = { value: payload.ticket, expiresAt, token: session.token };
		return payload.ticket;
	} catch {
		return null;
	}
}

function addResourceTicket(params: URLSearchParams) {
	if (resourceTicket && resourceTicket.expiresAt > Date.now()) params.set("access", resourceTicket.value);
}

export async function authenticateByName(
	username: string,
	password: string,
): Promise<AuthResponse> {
	const response = await fetch(
		`${orchestratorBaseUrl()}/api/auth/login`,
		{
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({ username: username.trim(), password: password.trim() }),
		},
	);

	if (!response.ok) {
		throw new Error(`Login failed with ${response.status}.`);
	}

	return (await response.json()) as AuthResponse;
}

export async function fetchHomeData(
	session: AuthSession,
	onSection?: (section: Partial<HomeData>) => void,
): Promise<HomeData> {
	const data = await cachedClientRequest(`home:${session.userId}`, async () => {
	const result = await catalogRequest<{ latestItems: CatalogItem[]; continueWatching: CatalogItem[]; nextUp: CatalogItem[]; libraryRows: Array<Omit<HomeLibrarySection, "items"> & { items: CatalogItem[] }> }>(session, "/api/catalog/home");
	return {
		latestItems: result.latestItems.map(toMediaItem),
		continueWatching: result.continueWatching.map(toMediaItem),
		nextUp: result.nextUp.map(toMediaItem),
		libraryRows: result.libraryRows.map((row) => ({ ...row, items: row.items.map(toMediaItem) })),
	};
	});
	onSection?.(data);
	return data;
}

export function getFavoriteItems(
	session: AuthSession,
	options: {
		sortBy?: string;
		sortOrder?: "Ascending" | "Descending";
		signal?: AbortSignal;
	} = {},
) {
	const params = new URLSearchParams({ pageSize: "100" });
	if (options.sortBy) params.set("sortBy", options.sortBy);
	if (options.sortOrder) params.set("sortOrder", options.sortOrder);
	return cachedClientRequest(`favorites:${session.userId}:${params}`, async () => {
		const result = await catalogRequest<{ items: CatalogItem[] }>(session, `/api/catalog/favorites?${params}`);
		return result.items.map(toMediaItem);
	});
}

export async function getLibraryViews(
	session: AuthSession,
) {
	return cachedClientRequest(`libraries:${session.userId}`, async () => {
	const result = await catalogRequest<{
		libraries: Array<{ id: string; name: string; type: string; supportsLastAdded?: boolean }>;
	}>(session, "/api/catalog/libraries");
	return result.libraries.map((library) => ({
		Id: library.id,
		Name: library.name,
		Type: "CollectionFolder",
		CollectionType:
			library.type === "tv_series"
				? "tvshows"
				: library.type === "movies"
					? "movies"
					: "boxsets",
		SupportsLastAdded: library.supportsLastAdded ?? library.type !== "movies",
	})) as LibraryView[];
	});
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
	const limit = options.limit ?? 40;
	const params = new URLSearchParams({
		libraryId: options.parentId,
		page: String(Math.floor(options.startIndex / limit) + 1),
		pageSize: String(limit),
		sortBy: catalogSort(options.sortBy),
		sortOrder: options.sortOrder.toLowerCase(),
	});
	return cachedClientRequest(`library:${session.userId}:${options.parentId}:${options.startIndex}:${limit}:${options.sortBy}:${options.sortOrder}`, async () => {
	const result = await catalogRequest<{
		items: CatalogItem[];
		total: number;
	}>(session, `/api/catalog/items?${params}`, { signal: options.signal });
	return {
		items: result.items.map(toMediaItem),
		totalRecordCount: result.total,
	};
	});
}

function catalogSort(value: LibrarySortBy) {
	return value;
}

export async function fetchDetailData(
	session: AuthSession,
	itemId: string,
	requestedSeasonId?: string,
): Promise<DetailData> {
	return cachedClientRequest(`detail:${session.userId}:${itemId}:${requestedSeasonId ?? ""}`, async () => {
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
	const selectedSeason = getInitialSeason(item, seasons, requestedSeasonId);
	const episodes =
		seriesId && selectedSeason
			? await getEpisodes(session, seriesId, selectedSeason.Id)
			: [];
	const similar =
		item.Type === "Episode" ? [] : await getSimilarItems(session, item.Id);
	const collectionItems =
		item.Type === "BoxSet"
			? await getChildren(session, item)
			: undefined;
	return { item, backgroundItem, seasons, episodes, similar, collectionItems };
	}, DETAIL_CACHE_TTL_MS);
}

export async function fetchPlayData(session: AuthSession, itemId: string): Promise<DetailData> {
	const item = await getItem(session, itemId);
	const seriesId = item.Type === "Episode" ? item.SeriesId : undefined;
	const backgroundItem = seriesId ? await getItem(session, seriesId) : undefined;
	return { item, backgroundItem, seasons: [], episodes: [], similar: [] };
}

export function getInitialSeason(
	item: MediaItem,
	seasons: MediaItem[],
	requestedSeasonId?: string,
) {
	if (requestedSeasonId) {
		const requested = seasons.find((season) => season.Id === requestedSeasonId);
		if (requested) return requested;
	}
	if (item.SeasonId) {
		return seasons.find((season) => season.Id === item.SeasonId);
	}

	return seasons.find((season) => season.IndexNumber === 1) ?? seasons[0];
}

export async function getItem(session: AuthSession, itemId: string) {
	return cachedClientRequest(
		`item:${session.userId}:${itemId}`,
		async () =>
			toMediaItem(
				await catalogRequest<CatalogItem>(
					session,
					`/api/catalog/items/${encodeURIComponent(itemId)}`,
				),
			),
		DETAIL_CACHE_TTL_MS,
	);
}

export async function getPlaybackInfo(
	session: AuthSession,
	itemId: string,
	options: {
		maxStreamingBitrate?: number;
		startPositionSeconds?: number;
		sourceId?: string;
		audioStreamId?: number;
		forceTranscoding?: boolean;
		directPlayOnly?: boolean;
		requestedMode?: "video-transcode";
	} = {},
) {
	const profile = browserDeviceProfile();
	const response = await catalogRequest<{
		mode: "direct" | "remux" | "audio-transcode" | "video-transcode";
		sessionState?: string;
		source: Record<string, unknown> & { streams?: Array<Record<string, unknown>> };
		sessionId?: string;
		startPositionSeconds?: number;
		url: string;
	}>(
		session,
		`/api/playback/items/${encodeURIComponent(itemId)}/negotiate`,
		{
			method: "POST",
			body: JSON.stringify({
				engine: "web",
				sourceId: options.sourceId,
				forceTranscoding: options.forceTranscoding === true,
				requestedMode: options.requestedMode,
				directPlayOnly: options.directPlayOnly === true,
				containers: profile.directPlayProfiles.flatMap((entry) =>
					String(entry.Container ?? "").split(","),
				),
				videoCodecs: profile.directPlayProfiles.flatMap((entry) =>
					String(entry.VideoCodec ?? "").split(","),
				),
				audioCodecs: profile.directPlayProfiles.flatMap((entry) =>
					String(entry.AudioCodec ?? "").split(","),
				),
				maxAudioChannels: profile.maxAudioChannels,
				maxStreamingBitrate: options.maxStreamingBitrate,
				startPositionSeconds: options.startPositionSeconds,
				audioStreamId: options.audioStreamId,
			}),
		},
	);
	const source: MediaSource = {
		Id: String(response.source.id ?? itemId),
		Container:
			typeof response.source.container === "string"
				? response.source.container
				: undefined,
		Bitrate:
			typeof response.source.bitrate === "number"
				? response.source.bitrate
				: undefined,
		SupportsDirectPlay: response.mode === "direct",
		SupportsDirectStream: response.mode === "remux" || response.mode === "audio-transcode",
		SupportsTranscoding: true,
		url: response.url,
		mode: response.mode,
		sessionState: response.sessionState,
		sessionId: response.sessionId,
		startPositionSeconds: response.startPositionSeconds ?? 0,
		MediaStreams: toMediaStreams(response.source.streams ?? []),
	};
	return { source, sessionId: response.sessionId, startPositionSeconds: response.startPositionSeconds ?? 0 };
}

export async function getPlaybackSessionStatus(
	session: AuthSession,
	sessionId: string,
): Promise<PlaybackSessionStatus> {
	return catalogRequest<PlaybackSessionStatus>(
		session,
		`/api/playback/sessions/${encodeURIComponent(sessionId)}`,
	);
}

export async function cancelPlaybackSession(
	session: AuthSession,
	sessionId: string,
): Promise<void> {
	await catalogRequest(
		session,
		`/api/playback/sessions/${encodeURIComponent(sessionId)}`,
		{ method: "DELETE" },
	);
}

export async function waitForPlaybackReady(
	session: AuthSession,
	sessionId: string,
	options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<PlaybackSessionStatus> {
	const deadline = Date.now() + (options.timeoutMs ?? 15_000);
	const intervalMs = options.intervalMs ?? 350;
	let latest: PlaybackSessionStatus | undefined;
	while (Date.now() <= deadline) {
		latest = await getPlaybackSessionStatus(session, sessionId);
		if (latest.sessionState === "ready" && latest.playlistReady !== false)
			return latest;
		if (["failed", "stopping", "expired"].includes(latest.sessionState)) {
			throw new Error(
				latest.errorCode
					? `${latest.errorCode}: ${latest.errorDetail ?? "Playback session failed."}`
					: "Playback session failed before becoming ready.",
			);
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}
	throw new Error(
		latest?.errorCode ?? "Playback session did not become ready before the deadline.",
	);
}

export async function getTrickplayInfo(session: AuthSession, itemId: string) {
	void session;
	void itemId;
	return undefined;
}

const playbackQualities = [0, 1, 2, 4, 8, 16, 32, 64].map(
	(mbps) => mbps * 1_000_000,
);

export function playbackStreams(
	info: PlaybackInfo,
	trickplay?: Record<string, Record<string, TrickplayInfo>>,
) {
	const source = info.source;
	const sourceWithTrickplay: MediaSource | undefined = source
		? {
				...source,
				Trickplay: source.Trickplay ?? trickplay?.[source.Id ?? ""],
			}
		: undefined;
	return {
		source: sourceWithTrickplay,
		audio: (source?.MediaStreams ?? []).filter(
			(stream) => stream.Type === "Audio",
		),
		subtitles: (source?.MediaStreams ?? []).filter(
			(stream) => stream.Type === "Subtitle",
		),
		qualities: playbackQualities,
	};
}

export function preserveTrickplay(
	source: MediaSource | undefined,
	previousSource: MediaSource | undefined,
) {
	if (!source || source.Trickplay || !previousSource?.Trickplay) return source;
	return { ...source, Trickplay: previousSource.Trickplay };
}

export function playbackUrl(
	source?: MediaSource,
) {
	const negotiatedUrl = source?.url;
	if (negotiatedUrl) {
		const gatewayUrl = new URL(orchestratorBaseUrl());
		const resolved = new URL(negotiatedUrl, gatewayUrl);
		if (resolved.origin === gatewayUrl.origin) return resolved.toString();
	}
	throw new Error("Canonical playback response did not include a usable URL.");
}

export function subtitleUrl(
	session: AuthSession,
	itemId: string,
	source: MediaSource | undefined,
	streamIndex: number,
) {
	const mediaFileId = source?.MediaStreams?.find(
		(entry) => entry.Index === streamIndex && entry.Type === "Subtitle",
	)?.FileId;
	if (!mediaFileId) return "";
	const params = new URLSearchParams();
	addResourceTicket(params);
	return `${orchestratorBaseUrl()}/api/playback/items/${encodeURIComponent(itemId)}/subtitles/${encodeURIComponent(mediaFileId)}.vtt?${params}`;
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

export function trickplayPreview(
	session: AuthSession,
	itemId: string,
	source: MediaSource | undefined,
	timeSeconds: number,
): TrickplayPreview | null {
	const entries = Object.entries(source?.Trickplay ?? {}).sort(
		([a], [b]) => Number(b) - Number(a),
	);
	const [width, info] = entries[0] ?? [];
	if (!width || !info || !Number.isFinite(Number(width))) return null;
	const details = info as TrickplayInfo & {
		width?: number;
		height?: number;
		tileWidth?: number;
		tileHeight?: number;
		interval?: number;
	};
	const thumbnailWidth = details.Width ?? details.width ?? Number(width);
	const thumbnailHeight =
		details.Height ?? details.height ?? Math.round((thumbnailWidth * 9) / 16);
	const columns = details.TileWidth ?? details.tileWidth ?? 10;
	const rows = details.TileHeight ?? details.tileHeight ?? 10;
	const interval = details.Interval ?? details.interval ?? 10_000;
	if (
		![thumbnailWidth, thumbnailHeight, columns, rows, interval].every(
			Number.isFinite,
		)
	)
		return null;
	const intervalSeconds = Math.max(1, interval / 1_000);
	const thumbnail = Math.max(0, Math.floor(timeSeconds / intervalSeconds));
	const tileSize = columns * rows;
	const tileIndex = Math.floor(thumbnail / tileSize);
	const tileOffset = thumbnail % tileSize;
	const params = new URLSearchParams({
		MediaSourceId: source?.Id ?? itemId,
	});
	addResourceTicket(params);
	return {
		url: `${orchestratorBaseUrl()}/api/video/${encodeURIComponent(itemId)}/trickplay/${width}/${tileIndex}?${params}`,
		width: thumbnailWidth,
		height: thumbnailHeight,
		tileIndex,
		cellX: tileOffset % columns,
		cellY: Math.floor(tileOffset / columns),
		columns,
		rows,
	};
}

export async function reportPlayback(
	session: AuthSession,
	itemId: string,
	positionSeconds: number,
	isPaused: boolean,
	durationSeconds?: number,
) {
	void isPaused;
	await catalogRequest(session, `/api/catalog/items/${encodeURIComponent(itemId)}/state`, {
		method: "PATCH",
		body: JSON.stringify({
			positionSeconds: Math.max(0, positionSeconds),
			...(durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > 0
				? { durationSeconds }
				: {}),
		}),
	});
}

export async function getPlaybackMarkers(
	session: AuthSession,
	itemId: string,
): Promise<{ intro?: PlaybackMarker; outro?: PlaybackMarker } | null> {
	void session;
	void itemId;
	return null;
}

function normalizePlaybackMarkers(
	value: unknown,
): { intro?: PlaybackMarker; outro?: PlaybackMarker } | null {
	const segments = Array.isArray(value)
		? value
		: Array.isArray((value as { Items?: unknown[] })?.Items)
			? (value as { Items: unknown[] }).Items
			: null;
	if (segments) {
		const byType = (types: string[]) =>
			segments.find((segment) => {
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
	const namedMarker = (names: string[]) => {
		const entry = Object.entries(data).find(([key]) =>
			names.includes(key.toLowerCase()),
		)?.[1];
		if (!entry || typeof entry !== "object") return undefined;
		const segment = entry as Record<string, unknown>;
		return toMarker(segment.Start ?? segment.start, segment.End ?? segment.end);
	};
	const marker = (
		name: "intro" | "outro",
		startKeys: string[],
		endKeys: string[],
	) => {
		const nested = data[name] as Record<string, unknown> | undefined;
		const start =
			nested?.start ??
			nested?.Start ??
			startKeys
				.map((key) => data[key])
				.find((entry) => typeof entry === "number");
		const end =
			nested?.end ??
			nested?.End ??
			endKeys
				.map((key) => data[key])
				.find((entry) => typeof entry === "number");
		return toMarker(start, end);
	};
	const intro =
		namedMarker(["intro", "introduction", "opening"]) ??
		marker(
			"intro",
			["IntroStart", "IntroStartTicks", "StartTicks"],
			["IntroEnd", "IntroEndTicks", "EndTicks"],
		);
	const outro =
		namedMarker(["outro", "credits", "closing"]) ??
		marker(
			"outro",
			["OutroStart", "CreditsStart", "CreditsStartTicks"],
			["OutroEnd", "CreditsEnd", "CreditsEndTicks"],
		);
	return intro || outro ? { intro, outro } : null;
}

function toMarker(start: unknown, end: unknown): PlaybackMarker | undefined {
	if (typeof start !== "number" || typeof end !== "number" || end <= start)
		return undefined;
	return {
		start: start > 1_000_000 ? start / 10_000_000 : start,
		end: end > 1_000_000 ? end / 10_000_000 : end,
	};
}

const heroTrailerCache = new Map<string, Promise<HeroTrailer | null>>();

export function getHeroTrailer(
	session: AuthSession,
	item: MediaItem,
): Promise<HeroTrailer | null> {
	const cacheKey = `${orchestratorBaseUrl()}:${session.userId}:${item.Id}`;
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
	item: MediaItem,
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

	const detailedItem = await getItem(session, item.Id);
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

	return null;
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
	return getItem(session, seriesId).then((item) => getChildren(session, item));
}

export function getEpisodes(
	session: AuthSession,
	seriesId: string,
	seasonId: string,
) {
	void seriesId;
	return getItem(session, seasonId).then((item) => getChildren(session, item));
}

/** Loads every episode in display order so series playback can resume at the first unwatched item. */
export function getSeriesEpisodes(session: AuthSession, seriesId: string) {
	return getSeasons(session, seriesId).then(async (seasons) =>
		(await Promise.all(seasons.map((season) => getChildren(session, season)))).flat(),
	);
}

export function getSimilarItems(session: AuthSession, itemId: string) {
	return catalogRequest<{ items: CatalogItem[] }>(
		session,
		`/api/catalog/items/${encodeURIComponent(itemId)}/similar`,
	).then((result) => result.items.map(toMediaItem));
}

async function getChildren(session: AuthSession, parent: MediaItem) {
	if (!parent.LibraryId) return [];
	const params = new URLSearchParams({
		libraryId: parent.LibraryId,
		parentId: parent.Id,
		pageSize: "100",
	});
	const result = await catalogRequest<{ items: CatalogItem[] }>(
		session,
		`/api/catalog/items?${params}`,
	);
	return result.items.map(toMediaItem);
}

export async function setFavorite(
	session: AuthSession,
	itemId: string,
	favorite: boolean,
) {
	await catalogRequest(session, `/api/catalog/items/${encodeURIComponent(itemId)}/state`, {
		method: "PATCH",
		body: JSON.stringify({ favorite }),
	});
	clearMediaClientCache();
}

export async function setPlayed(
	session: AuthSession,
	itemId: string,
	played: boolean,
) {
	await catalogRequest(session, `/api/catalog/items/${encodeURIComponent(itemId)}/state`, {
		method: "PATCH",
		body: JSON.stringify({ played }),
	});
	clearMediaClientCache();
}

export function landscapeImageUrl(item: MediaItem) {
	return landscapeImage(item)?.src ?? null;
}

export function landscapeImage(item: MediaItem) {
	return imageData(
		item,
		item.Type === "Episode" ? "Primary" : "Backdrop",
		400,
		225,
	);
}

export function heroImageUrl(item: MediaItem) {
	return heroImage(item)?.src ?? null;
}

export function heroImage(item: MediaItem) {
	return imageData(item, "Backdrop", 1600, 900);
}

export function posterImageUrl(item: MediaItem) {
	return posterImage(item)?.src ?? null;
}

export function posterImage(item: MediaItem) {
	return imageData(item, "Primary", 280, 420);
}

export function seriesPosterImageUrl(item: MediaItem) {
	return seriesPosterImage(item)?.src ?? null;
}

export function seriesPosterImage(item: MediaItem) {
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

export function titleLogoImageUrl(item: MediaItem) {
	return titleLogoImage(item)?.src ?? null;
}

export function titleLogoImage(item: MediaItem) {
	return imageData(item, "Logo", 680, 260);
}

export function userImageUrl(userId: string) {
	void userId;
	return "/icon.png";
}

export function personImageUrl(person: MediaPerson) {
	return personImage(person);
}

export function personImage(person: MediaPerson) {
	void person;
	return null;
}

function imageData(
	item: MediaItem,
	imageType: ArtworkType,
	width: number,
	height: number,
) {
	const tag =
		imageType === "Backdrop"
			? item.BackdropImageTags?.[0]
			: item.ImageTags?.[imageType];
	if (!tag) return null;
	if (tag.startsWith("/api/")) {
		const url = new URL(tag, orchestratorBaseUrl());
		if (resourceTicket && resourceTicket.expiresAt > Date.now())
			url.searchParams.set("access", resourceTicket.value);
		return { src: url.toString(), blurHash: undefined };
	}

	const index = imageType === "Backdrop" ? "/0" : "";
	const params = new URLSearchParams({
		fillWidth: String(width),
		fillHeight: String(height),
		quality: "90",
		tag,
	});
	addResourceTicket(params);

	return {
		src: `${orchestratorBaseUrl()}/api/assets/items/${item.Id}/images/${imageType}?${params.toString()}${index ? `&index=${index.slice(1)}` : ""}`,
		blurHash:
			imageType === "Logo"
				? undefined
				: item.ImageBlurHashes?.[imageType]?.[tag],
	};
}
