import { getAuthSession, type AuthSession } from "@/lib/session";
import { browserDeviceProfile } from "@/lib/browser-device-profile";
import {
	authenticatedFetch,
	orchestratorBaseUrl as sharedOrchestratorBaseUrl,
} from "@/lib/authenticated-request";
import {
	catalogRequest,
	toMediaItem,
	toMediaStreams,
	type CatalogItem,
} from "@/lib/catalog";

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
	SeriesProductionYear?: number;
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
	LastAddedAt?: string;
	CollectionType?: string;
	SeriesPrimaryImageTag?: string;
	SeriesPrimaryImageBlurHash?: string;
	Trickplay?: Record<string, Record<string, TrickplayInfo>>;
	LibraryId?: string;
	CatalogParentId?: string;
	ChildIds?: string[];
}

export function savedPlaybackPositionSeconds(
	item: Pick<MediaItem, "UserData">,
) {
	const ticks = item.UserData?.PlaybackPositionTicks;
	return typeof ticks === "number" && Number.isFinite(ticks) && ticks > 0
		? ticks / 10_000_000
		: 0;
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
	state?: string;
	sourceId?: string;
	frameWidth?: number;
	frameHeight?: number;
	intervalSeconds?: number;
	columns?: number;
	rows?: number;
	frameCount?: number;
	sheets?: TrickplaySheet[];
	Width?: number;
	Height?: number;
	TileWidth?: number;
	TileHeight?: number;
	ThumbnailCount?: number;
	Interval?: number;
	TileCount?: number;
}

export interface TrickplaySheet {
	index: number;
	frameCount?: number;
	url: string;
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
const clientInFlight = new Map<
	string,
	{ promise: Promise<unknown>; controller: AbortController }
>();
const heroTrailerCache = new Map<string, Promise<HeroTrailer | null>>();

function combinedSignal(
	external: AbortSignal | undefined,
	internal: AbortSignal,
) {
	if (!external) return internal;
	return AbortSignal.any([external, internal]);
}

async function cachedClientRequest<T>(
	key: string,
	loader: (signal: AbortSignal) => Promise<T>,
	ttl = LIST_CACHE_TTL_MS,
	reuseInFlight = true,
): Promise<T> {
	const cached = clientCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.value as T;
	const pending = clientInFlight.get(key);
	if (reuseInFlight && pending) return pending.promise as Promise<T>;
	if (pending) pending.controller.abort();
	const controller = new AbortController();
	const request = Promise.resolve()
		.then(() => loader(controller.signal))
		.then((value) => {
			if (clientInFlight.get(key)?.controller === controller) {
				clientCache.set(key, { expiresAt: Date.now() + ttl, value });
			}
			return value;
		});
	const trackedRequest = request.finally(() => {
		if (clientInFlight.get(key)?.promise === trackedRequest) {
			clientInFlight.delete(key);
		}
	});
	clientInFlight.set(key, { promise: trackedRequest, controller });
	return trackedRequest;
}

export function clearMediaClientCache(scope?: {
	libraryId?: string;
	rootEntityId?: string;
}) {
	const affected = (key: string, value?: unknown) => {
		if (!scope?.libraryId && !scope?.rootEntityId) return true;
		if (/^(home|search|libraries|favorites):/.test(key)) return true;
		if (scope.libraryId && key.includes(`:${scope.libraryId}:`)) return true;
		if (
			scope.rootEntityId &&
			(key.includes(`:${scope.rootEntityId}:`) ||
				key.endsWith(`:${scope.rootEntityId}`))
		)
			return true;
		const item =
			value && typeof value === "object" && "item" in value
				? (value as DetailData).item
				: (value as MediaItem | undefined);
		return Boolean(scope.libraryId && item?.LibraryId === scope.libraryId);
	};
	for (const [key, cached] of clientCache) {
		if (affected(key, cached.value)) clientCache.delete(key);
	}
	for (const [key, pending] of clientInFlight) {
		if (!affected(key)) continue;
		pending.controller.abort();
		clientInFlight.delete(key);
	}
	heroTrailerCache.clear();
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
	Id?: string;
	Name: string;
	Role?: string;
	Type?: string;
	CreditType?: "cast" | "crew";
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
	recentlyPlayed?: MediaItem[];
	genreRows?: HomeGenreSection[];
}

export interface HomeLibrarySection extends NewlyAddedSection {
	titleKey: "newlyAddedOn" | "topRated";
	stackEpisodes?: boolean;
}

export interface HomeGenreSection {
	genre: string;
	items: MediaItem[];
}

export type LibrarySortBy =
	"title" | "added" | "lastAdded" | "release" | "rating" | "runtime";

export interface LibraryView extends MediaItem {
	CollectionType?: string;
	SupportsLastAdded?: boolean;
	CatalogGeneration?: number;
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
		async (signal) => {
			const result = await catalogRequest<{ items: CatalogItem[] }>(
				session,
				`/api/catalog/search?query=${encodeURIComponent(term)}&pageSize=40&view=card`,
				{ signal: combinedSignal(options.signal, signal) },
			);
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
	return sharedOrchestratorBaseUrl();
}

let resourceTicket: {
	value: string;
	expiresAt: number;
	sessionKey: string;
} | null = null;

function resourceSessionKey(session: AuthSession | null | undefined) {
	return session ? `${session.userId}:${session.token || "browser-cookie"}` : "";
}

export function clearMediaClientSession() {
	clearMediaClientCache();
	resourceTicket = null;
}

export async function revokeAuthSession(session: AuthSession): Promise<void> {
	const response = await authenticatedFetch(
		session,
		"/api/auth/logout",
		{
			method: "POST",
			cache: "no-store",
			keepalive: true,
		},
		{ notifyOnUnauthorized: false },
	);
	// An expired token is already effectively revoked.
	if (!response.ok && response.status !== 401) {
		throw new Error(`Logout failed with ${response.status}.`);
	}
}

export async function primeResourceTicket(
	session: AuthSession,
): Promise<string | null> {
	if (
		resourceTicket &&
		resourceTicket.sessionKey === resourceSessionKey(session) &&
		resourceTicket.expiresAt > Date.now() + 30_000
	)
		return resourceTicket.value;
	try {
		const response = await authenticatedFetch(
			session,
			"/api/auth/resource-ticket",
			{ cache: "no-store" },
		);
		if (!response.ok) return null;
		const payload = (await response.json()) as {
			ticket?: unknown;
			expiresAt?: unknown;
		};
		if (typeof payload.ticket !== "string") return null;
		const responseValue = payload as { expiresIn?: unknown };
		const expiresAt =
			typeof payload.expiresAt === "number"
				? payload.expiresAt * 1000
				: typeof responseValue.expiresIn === "number"
					? Date.now() + responseValue.expiresIn * 1000
					: Date.now() + 10 * 60_000;
		resourceTicket = {
			value: payload.ticket,
			expiresAt,
			sessionKey: resourceSessionKey(session),
		};
		if (typeof window !== "undefined")
			window.dispatchEvent(new Event("zenstream:resource-ticket"));
		return payload.ticket;
	} catch {
		return null;
	}
}

function addResourceTicket(params: URLSearchParams, sessionToken?: string) {
	const activeSession = getAuthSession();
	const activeKey = sessionToken
		? resourceSessionKey({
				...(activeSession ?? { userId: "", username: "" }),
				token: sessionToken,
			})
		: resourceSessionKey(activeSession);
	if (
		resourceTicket &&
		resourceTicket.sessionKey === activeKey &&
		resourceTicket.expiresAt > Date.now()
	)
		params.set("access", resourceTicket.value);
}

export async function authenticateByName(
	username: string,
	password: string,
): Promise<AuthResponse> {
	const response = await fetch(
		`${orchestratorBaseUrl()}/api/auth/browser-login`,
		{
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify({
				username: username.trim(),
				password,
			}),
			credentials: "include",
		},
	);

	if (!response.ok) {
		throw new Error(`Login failed with ${response.status}.`);
	}

	return (await response.json()) as AuthResponse;
}

export async function validateBrowserSession(
	session: AuthSession,
): Promise<AuthSession | null> {
	let response = await authenticatedFetch(
		session,
		"/api/auth/bootstrap",
		{ cache: "no-store" },
		{ notifyOnUnauthorized: false },
	);
	if (response.status === 404) {
		response = await authenticatedFetch(
			session,
			"/api/auth/me",
			{ cache: "no-store" },
			{ notifyOnUnauthorized: false },
		);
	}
	if (response.status === 401) return null;
	if (!response.ok)
		throw new Error(`Session validation failed with ${response.status}.`);
	const payload = (await response.json()) as {
		user?: { id?: unknown; username?: unknown };
		resourceTicket?: unknown;
		resourceTicketExpiresIn?: unknown;
	};
	if (typeof payload.user?.id !== "string")
		throw new Error("Server did not return a complete session response.");
	if (typeof payload.resourceTicket === "string") {
		resourceTicket = {
			value: payload.resourceTicket,
			expiresAt:
				Date.now() +
				(typeof payload.resourceTicketExpiresIn === "number"
					? payload.resourceTicketExpiresIn * 1000
					: 10 * 60_000),
			sessionKey: resourceSessionKey({
				token: "",
				userId: payload.user.id,
				username:
					typeof payload.user.username === "string"
						? payload.user.username
						: "ZenStream",
			}),
		};
		if (typeof window !== "undefined")
			window.dispatchEvent(new Event("zenstream:resource-ticket"));
	}
	return {
		token: "",
		userId: payload.user.id,
		username:
			typeof payload.user.username === "string"
				? payload.user.username
				: "ZenStream",
	};
}

export async function fetchHomeData(
	session: AuthSession,
	onSection?: (section: Partial<HomeData>) => void,
): Promise<HomeData> {
	const data = await cachedClientRequest(
		`home:${session.userId}`,
		async (signal) => {
			const section = async <T>(
				name: string,
				limit?: number,
				extra?: Record<string, string>,
			) => {
				const params = new URLSearchParams({ section: name, view: "card" });
				if (limit !== undefined) params.set("limit", String(limit));
				for (const [key, value] of Object.entries(extra ?? {}))
					params.set(key, value);
				return catalogRequest<T>(session, `/api/catalog/home?${params}`, {
					signal,
				});
			};

			const featured = await section<{ latestItems?: CatalogItem[] }>(
				"featured",
				1,
			);
			const first = { latestItems: (featured.latestItems ?? []).map(toMediaItem) };
			onSection?.(first);

			const rest = await Promise.all([
				section<{ continueWatching?: CatalogItem[] }>("continueWatching", 18),
				section<{ nextUp?: CatalogItem[] }>("nextUp", 18),
				section<{
					myList?: CatalogItem[];
					recentlyPlayed?: CatalogItem[];
					genreRows?: Array<{ genre: string; items: CatalogItem[] }>;
				}>("derived", 18),
				getLibraryViews(session),
			]);
			const continueWatching = (rest[0].continueWatching ?? []).map(toMediaItem);
			const nextUp = (rest[1].nextUp ?? []).map(toMediaItem);
			const derived = rest[2];
			const libraries = rest[3] as LibraryView[];
			onSection?.({
				continueWatching,
				nextUp,
				myList: (derived.myList ?? []).map(toMediaItem),
				recentlyPlayed: (derived.recentlyPlayed ?? []).map(toMediaItem),
				genreRows: (derived.genreRows ?? []).map((row) => ({
					...row,
					items: row.items.map(toMediaItem),
				})),
			});

			const libraryRows: HomeLibrarySection[] = [];
			for (let offset = 0; offset < libraries.length; offset += 3) {
				const batch = await Promise.all(
					libraries.slice(offset, offset + 3).map(async (library) => {
						const result = await section<{
							libraryRows?: Array<
								Omit<HomeLibrarySection, "items"> & { items: CatalogItem[] }
							>;
						}>("library", 18, { libraryId: library.Id });
						return (result.libraryRows ?? []).map((row) => ({
							...row,
							items: row.items.map(toMediaItem),
						}));
					}),
				);
				libraryRows.push(...batch.flat());
				onSection?.({ libraryRows: [...libraryRows] });
			}

			const allFeatured = await section<{ latestItems?: CatalogItem[] }>(
				"featured",
				25,
			);
			const result: HomeData = {
				latestItems: (allFeatured.latestItems ?? []).map(toMediaItem),
				continueWatching,
				nextUp,
				myList: (derived.myList ?? []).map(toMediaItem),
				recentlyPlayed: (derived.recentlyPlayed ?? []).map(toMediaItem),
				genreRows: (derived.genreRows ?? []).map((row) => ({
					...row,
					items: row.items.map(toMediaItem),
				})),
				libraryRows,
			};
			onSection?.(result);
			return result;
		},
	);
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
	const params = new URLSearchParams({ pageSize: "100", view: "card" });
	if (options.sortBy) params.set("sortBy", options.sortBy);
	if (options.sortOrder) params.set("sortOrder", options.sortOrder);
	return cachedClientRequest(
		`favorites:${session.userId}:${params}`,
		async () => {
			const result = await catalogRequest<{ items: CatalogItem[] }>(
				session,
				`/api/catalog/favorites?${params}`,
			);
			return result.items.map(toMediaItem);
		},
	);
}

export async function getLibraryViews(session: AuthSession) {
	return cachedClientRequest(`libraries:${session.userId}`, async () => {
		const result = await catalogRequest<{
			libraries: Array<{
				id: string;
				name: string;
				type: string;
				supportsLastAdded?: boolean;
				catalogGeneration?: number;
			}>;
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
			CatalogGeneration: library.catalogGeneration ?? 0,
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
		view: "card",
		sortBy: catalogSort(options.sortBy),
		sortOrder: options.sortOrder.toLowerCase(),
	});
	return cachedClientRequest(
		`library:${session.userId}:${options.parentId}:${options.startIndex}:${limit}:${options.sortBy}:${options.sortOrder}`,
		async (signal) => {
			const result = await catalogRequest<{
				items: CatalogItem[];
				total: number;
			}>(session, `/api/catalog/items?${params}`, {
				signal: combinedSignal(options.signal, signal),
			});
			return {
				items: result.items.map(toMediaItem),
				totalRecordCount: result.total,
			};
		},
		LIST_CACHE_TTL_MS,
		false,
	);
}

function catalogSort(value: LibrarySortBy) {
	return value;
}

export async function fetchDetailData(
	session: AuthSession,
	itemId: string,
	requestedSeasonId?: string,
	requestSignal?: AbortSignal,
	onSection?: (section: Partial<DetailData>) => void,
): Promise<DetailData> {
	const data = await cachedClientRequest(
		`detail:${session.userId}:${itemId}:${requestedSeasonId ?? ""}`,
		async (signal) => {
			const params = new URLSearchParams({ section: "header" });
			if (requestedSeasonId) params.set("seasonId", requestedSeasonId);
			try {
				const header = await catalogRequest<{
					item: CatalogItem;
					backgroundItem?: CatalogItem | null;
					seasons: CatalogItem[];
				}>(
					session,
					`/api/catalog/items/${encodeURIComponent(itemId)}/detail?${params}`,
					{ signal: combinedSignal(requestSignal, signal) },
				);
				const initial: DetailData = {
					item: toMediaItem(header.item),
					backgroundItem: header.backgroundItem
						? toMediaItem(header.backgroundItem)
						: undefined,
					seasons: (header.seasons ?? []).map(toMediaItem),
					episodes: [],
					similar: [],
				};
				onSection?.(initial);
				const item = initial.item;
				const season = getInitialSeason(item, initial.seasons, requestedSeasonId);
				const episodeParams = new URLSearchParams({
					section: "episodes",
					page: "1",
					pageSize: "40",
					view: "card",
				});
				if (season) episodeParams.set("seasonId", season.Id);
				const episodesPromise =
					season && (item.Type === "Series" || item.Type === "Episode")
						? catalogRequest<{
							 episodes?: CatalogItem[];
							 total?: number;
						 }>(session, `/api/catalog/items/${encodeURIComponent(itemId)}/detail?${episodeParams}`, {
							 signal: combinedSignal(requestSignal, signal),
						 })
						: Promise.resolve({ episodes: [], total: 0 });
				const similarPromise =
					item.Type === "Episode"
						? Promise.resolve({ similar: [] as CatalogItem[] })
						: catalogRequest<{ similar?: CatalogItem[] }>(
								session,
								`/api/catalog/items/${encodeURIComponent(itemId)}/detail?section=similar&view=card`,
								{ signal: combinedSignal(requestSignal, signal) },
						  );
				const creditsPromise = catalogRequest<{
					credits?: { cast?: unknown[]; crew?: unknown[] };
				}>(session, `/api/catalog/items/${encodeURIComponent(itemId)}/detail?section=credits`, {
					signal: combinedSignal(requestSignal, signal),
				});
				const collectionPromise =
					item.Type === "BoxSet"
						? getChildren(session, item)
						: Promise.resolve(undefined);
				const [episodes, similar, credits, collectionItems] = await Promise.all([
					episodesPromise,
					similarPromise,
					creditsPromise,
					collectionPromise,
				]);
				let episodeItems = (episodes.episodes ?? []).map(toMediaItem);
				const episodeTotal = Number(episodes.total ?? episodeItems.length);
				for (
					let episodePage = 2;
					episodePage <= Math.ceil(episodeTotal / 40);
					episodePage += 1
				) {
					if (requestSignal?.aborted || signal.aborted) break;
					const pageParams = new URLSearchParams({
						section: "episodes",
						page: String(episodePage),
						pageSize: "40",
						view: "card",
					});
					if (season) pageParams.set("seasonId", season.Id);
					const page = await catalogRequest<{ episodes?: CatalogItem[] }>(
						session,
						`/api/catalog/items/${encodeURIComponent(itemId)}/detail?${pageParams}`,
						{ signal: combinedSignal(requestSignal, signal) },
					);
					episodeItems = episodeItems.concat((page.episodes ?? []).map(toMediaItem));
					onSection?.({ episodes: episodeItems });
				}
				const similarItems = (similar.similar ?? []).map(toMediaItem);
				const completed: DetailData = {
					...initial,
					episodes: episodeItems,
					similar: similarItems,
					collectionItems,
				};
				if (credits.credits) {
					completed.item = toMediaItem({
						...header.item,
						metadata: { ...header.item.metadata, credits: credits.credits },
					} as CatalogItem);
				}
				onSection?.({ episodes: episodeItems, similar: similarItems });
				return completed;
			} catch (error) {
				const status =
					error instanceof Error
						? error.message.match(/Request failed with (\d+)/)?.[1]
						: undefined;
				if (status !== "404" && status !== "405") throw error;
			}
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
				item.Type === "BoxSet" ? await getChildren(session, item) : undefined;
			return { item, backgroundItem, seasons, episodes, similar, collectionItems };
		},
		DETAIL_CACHE_TTL_MS,
	);
	onSection?.(data);
	return data;
}

export async function fetchPlayData(
	session: AuthSession,
	itemId: string,
): Promise<DetailData> {
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
		source: Record<string, unknown> & {
			streams?: Array<Record<string, unknown>>;
		};
		sessionId?: string;
		startPositionSeconds?: number;
		url: string;
	}>(session, `/api/playback/items/${encodeURIComponent(itemId)}/negotiate`, {
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
	});
	const source = mediaSourceFromPayload(response.source, itemId, {
		url: response.url,
		mode: response.mode,
		sessionState: response.sessionState,
		sessionId: response.sessionId,
		startPositionSeconds: response.startPositionSeconds ?? 0,
	});
	return {
		source,
		sessionId: response.sessionId,
		startPositionSeconds: response.startPositionSeconds ?? 0,
	};
}

export async function getPlaybackSource(
	session: AuthSession,
	itemId: string,
): Promise<MediaSource> {
	const response = await catalogRequest<
		Record<string, unknown> & { streams?: Array<Record<string, unknown>> }
	>(session, `/api/playback/items/${encodeURIComponent(itemId)}/source`);
	return mediaSourceFromPayload(response, itemId);
}

function mediaSourceFromPayload(
	source: Record<string, unknown> & { streams?: Array<Record<string, unknown>> },
	itemId: string,
	playback: Pick<
		MediaSource,
		"url" | "mode" | "sessionState" | "sessionId" | "startPositionSeconds"
	> = {},
): MediaSource {
	return {
		Id: String(source.id ?? itemId),
		Container:
			typeof source.container === "string" ? source.container : undefined,
		Bitrate: typeof source.bitrate === "number" ? source.bitrate : undefined,
		SupportsDirectPlay: playback.mode === "direct",
		SupportsDirectStream:
			playback.mode === "remux" || playback.mode === "audio-transcode",
		SupportsTranscoding: playback.mode != null,
		...playback,
		MediaStreams: toMediaStreams(source.streams ?? []),
	};
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
		{ method: "DELETE", keepalive: true },
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
		latest?.errorCode ??
			"Playback session did not become ready before the deadline.",
	);
}

export async function getTrickplayInfo(
	session: AuthSession,
	itemId: string,
	sourceId?: string,
): Promise<TrickplayInfo | undefined> {
	const params = new URLSearchParams();
	if (sourceId) params.set("sourceId", sourceId);
	const response = await catalogRequest<unknown>(
		session,
		`/api/playback/items/${encodeURIComponent(itemId)}/trickplay${params.size ? `?${params}` : ""}`,
	);
	if (!isRecord(response)) return undefined;
	const nested = isRecord(response.trickplay)
		? response.trickplay
		: isRecord(response.sources) &&
			  sourceId &&
			  isRecord(response.sources[sourceId])
			? response.sources[sourceId]
			: response;
	if (nested.state !== "ready" || !Array.isArray(nested.sheets))
		return undefined;
	const sheets = nested.sheets.flatMap((sheet): TrickplaySheet[] => {
		if (!isRecord(sheet)) return [];
		const index = Number(sheet.index);
		const rawUrl = typeof sheet.url === "string" ? sheet.url : "";
		let url = "";
		try {
			url = rawUrl ? new URL(rawUrl, orchestratorBaseUrl()).toString() : "";
		} catch {
			return [];
		}
		if (!Number.isInteger(index) || index < 0 || !url) return [];
		const frameCount = Number(sheet.frameCount);
		return [
			{
				index,
				url,
				...(Number.isFinite(frameCount) && frameCount > 0 ? { frameCount } : {}),
			},
		];
	});
	if (!sheets.length) return undefined;
	return {
		state: "ready",
		sourceId: typeof nested.sourceId === "string" ? nested.sourceId : sourceId,
		frameWidth: numberValue(nested.frameWidth ?? nested.width),
		frameHeight: numberValue(nested.frameHeight ?? nested.height),
		intervalSeconds: numberValue(nested.intervalSeconds),
		columns: numberValue(nested.columns),
		rows: numberValue(nested.rows),
		frameCount: numberValue(nested.frameCount),
		sheets,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function numberValue(value: unknown) {
	const number = Number(value);
	return Number.isFinite(number) ? number : undefined;
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

export function playbackUrl(source?: MediaSource) {
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
	addResourceTicket(params, session.token);
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
	void session;
	void itemId;
	const entries = Object.entries(source?.Trickplay ?? {}).sort(
		([a], [b]) => Number(b) - Number(a),
	);
	const [width, info] = entries[0] ?? [];
	if (!width || !info) return null;
	const details = info as TrickplayInfo & {
		width?: number;
		height?: number;
		tileWidth?: number;
		tileHeight?: number;
		interval?: number;
	};
	const thumbnailWidth =
		details.frameWidth ?? details.Width ?? details.width ?? Number(width);
	const thumbnailHeight =
		details.frameHeight ??
		details.Height ??
		details.height ??
		Math.round((thumbnailWidth * 9) / 16);
	const columns =
		details.columns ?? details.TileWidth ?? details.tileWidth ?? 10;
	const rows = details.rows ?? details.TileHeight ?? details.tileHeight ?? 10;
	const intervalSeconds =
		details.intervalSeconds ??
		(details.Interval ?? details.interval ?? 0) / 1_000;
	const frameCount = details.frameCount ?? details.ThumbnailCount ?? 0;
	if (
		![
			thumbnailWidth,
			thumbnailHeight,
			columns,
			rows,
			intervalSeconds,
			frameCount,
		].every(Number.isFinite)
	)
		return null;
	if (
		thumbnailWidth <= 0 ||
		thumbnailHeight <= 0 ||
		columns <= 0 ||
		rows <= 0 ||
		intervalSeconds <= 0 ||
		frameCount <= 0
	)
		return null;
	const thumbnail = Math.max(0, Math.floor(timeSeconds / intervalSeconds));
	if (thumbnail >= frameCount) return null;
	const tileSize = columns * rows;
	const tileIndex = Math.floor(thumbnail / tileSize);
	const tileOffset = thumbnail % tileSize;
	const sheet = details.sheets?.find((entry) => entry.index === tileIndex);
	if (!sheet?.url) return null;
	return {
		url: sheet.url,
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
	await catalogRequest(
		session,
		`/api/catalog/items/${encodeURIComponent(itemId)}/state`,
		{
			method: "PATCH",
			body: JSON.stringify({
				positionSeconds: Math.max(0, positionSeconds),
				...(durationSeconds != null &&
				Number.isFinite(durationSeconds) &&
				durationSeconds > 0
					? { durationSeconds }
					: {}),
			}),
		},
	);
	clearMediaClientCache({ rootEntityId: itemId });
}

export async function getPlaybackMarkers(
	session: AuthSession,
	itemId: string,
	sourceId?: string,
): Promise<{ intro?: PlaybackMarker; outro?: PlaybackMarker } | null> {
	const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : "";
	const value = await catalogRequest(
		session,
		`/api/playback/items/${encodeURIComponent(itemId)}/segments${query}`,
	);
	const segments = Array.isArray((value as { segments?: unknown }).segments)
		? (value as { segments: Array<Record<string, unknown>> }).segments
		: [];
	const marker = (type: "intro" | "outro") => {
		const match = segments.find(
			(segment) => String(segment.type).toLowerCase() === type,
		);
		return match ? toMarker(match.startSeconds, match.endSeconds) : undefined;
	};
	const intro = marker("intro");
	const outro = marker("outro");
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
		(
			await Promise.all(seasons.map((season) => getChildren(session, season)))
		).flat(),
	);
}

export function getSimilarItems(session: AuthSession, itemId: string) {
	return catalogRequest<{ items: CatalogItem[] }>(
		session,
		`/api/catalog/items/${encodeURIComponent(itemId)}/similar?view=card`,
	).then((result) => result.items.map(toMediaItem));
}

async function getChildren(session: AuthSession, parent: MediaItem) {
	if (!parent.LibraryId) return [];
	const params = new URLSearchParams({
		libraryId: parent.LibraryId,
		parentId: parent.Id,
		pageSize: "100",
		view: "card",
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
	await catalogRequest(
		session,
		`/api/catalog/items/${encodeURIComponent(itemId)}/state`,
		{
			method: "PATCH",
			body: JSON.stringify({ favorite }),
		},
	);
	clearMediaClientCache();
}

export async function setPlayed(
	session: AuthSession,
	itemId: string,
	played: boolean,
) {
	await catalogRequest(
		session,
		`/api/catalog/items/${encodeURIComponent(itemId)}/state`,
		{
			method: "PATCH",
			body: JSON.stringify({ played }),
		},
	);
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
			ImageBlurHashes: {
				...item.ImageBlurHashes,
				Primary: item.SeriesPrimaryImageBlurHash
					? { [item.SeriesPrimaryImageTag]: item.SeriesPrimaryImageBlurHash }
					: undefined,
			},
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
	return imageData(item, "Logo", 680, 300);
}

export function userImageUrl(userId: string): string | null {
	void userId;
	return null;
}

export function userInitial(username?: string | null) {
	return Array.from(username?.trim() ?? "")[0]?.toLocaleUpperCase() ?? "?";
}

export function personImageUrl(person: MediaPerson) {
	return personImage(person);
}

export function personImage(person: MediaPerson) {
	const tag = person.PrimaryImageTag;
	if (!tag) return null;
	if (tag.startsWith("/api/")) {
		const url = new URL(tag, orchestratorBaseUrl());
		if (
			resourceTicket &&
			resourceTicket.sessionKey === resourceSessionKey(getAuthSession()) &&
			resourceTicket.expiresAt > Date.now()
		)
			url.searchParams.set("access", resourceTicket.value);
		return {
			src: url.toString(),
			blurHash: person.ImageBlurHashes?.Primary?.[tag],
		};
	}
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
		if (
			resourceTicket &&
			resourceTicket.sessionKey === resourceSessionKey(getAuthSession()) &&
			resourceTicket.expiresAt > Date.now()
		)
			url.searchParams.set("access", resourceTicket.value);
		return {
			src: url.toString(),
			blurHash:
				imageType === "Logo" ? undefined : item.ImageBlurHashes?.[imageType]?.[tag],
		};
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
			imageType === "Logo" ? undefined : item.ImageBlurHashes?.[imageType]?.[tag],
	};
}
