import type { MediaItem, MediaStream } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

export type CatalogItem = {
	id: string;
	libraryId: string;
	parentId?: string | null;
	seriesId?: string | null;
	seasonId?: string | null;
	type: "movie" | "series" | "season" | "episode" | "collection" | string;
	name: string;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	dateAdded?: string;
	childIds?: string[];
	metadata: Record<string, unknown> & {
		title?: string;
		overview?: string;
		description?: string;
		year?: string | number;
		date?: string;
		runtimeMinutes?: number;
		tags?: string[];
		communityRating?: number;
		people?: Array<Record<string, unknown>>;
		trailers?: Array<Record<string, unknown>>;
		images?: Partial<Record<"Primary" | "Backdrop" | "Logo" | "Banner", { url?: string }>>;
	};
	userState?: {
		favorite?: boolean;
		played?: boolean;
		playedPercentage?: number;
		positionSeconds?: number;
	};
};

export function orchestratorBaseUrl() {
	if (process.env.NEXT_PUBLIC_ZSO_URL) return process.env.NEXT_PUBLIC_ZSO_URL.replace(/\/+$/, "");
	if (typeof window !== "undefined") return window.location.origin;
	return "http://127.0.0.1:9090";
}

export async function catalogRequest<T>(session: AuthSession, path: string, init: RequestInit = {}): Promise<T> {
	const response = await fetch(`${orchestratorBaseUrl()}${path}`, {
		...init,
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${session.token}`,
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
	});
	if (response.status === 401 && typeof window !== "undefined") window.dispatchEvent(new Event("zenstream:auth-expired"));
	if (!response.ok) throw new Error(`Request failed with ${response.status}.`);
	if (response.status === 204) return null as T;
	return response.json() as Promise<T>;
}

const itemTypes: Record<string, string> = {
	movie: "Movie",
	series: "Series",
	season: "Season",
	episode: "Episode",
	collection: "BoxSet",
};

export function toMediaItem(item: CatalogItem): MediaItem {
	const images = item.metadata.images ?? {};
	const people = (item.metadata.people ?? []).map((person) => ({
		Name: String(person.name ?? ""),
		Role: typeof person.role === "string" ? person.role : undefined,
		Type: typeof person.department === "string" ? person.department : undefined,
	}));
	const trailers = (item.metadata.trailers ?? []).flatMap((trailer) => {
		const site = String(trailer.site ?? "").toLowerCase();
		if (site === "youtube" && trailer.key) {
			return [{ Url: `https://www.youtube.com/watch?v=${trailer.key}` }];
		}
		const url = typeof trailer.url === "string" ? trailer.url.trim() : "";
		return /^https?:\/\//i.test(url) ? [{ Url: url }] : [];
	});
	return {
		Id: item.id,
		Name: item.metadata.title ?? item.name,
		Type: itemTypes[item.type] ?? item.type,
		SeriesId: item.seriesId ?? undefined,
		SeasonId: item.seasonId ?? undefined,
		ParentIndexNumber: item.seasonNumber ?? undefined,
		IndexNumber: item.episodeNumber ?? undefined,
		Overview: item.metadata.overview ?? item.metadata.description,
		ProductionYear: item.metadata.year ? Number(item.metadata.year) : undefined,
		PremiereDate: item.metadata.date,
		RunTimeTicks: item.metadata.runtimeMinutes ? item.metadata.runtimeMinutes * 60 * 10_000_000 : undefined,
		CommunityRating: item.metadata.communityRating,
		Genres: item.metadata.tags,
		People: people,
		RemoteTrailers: trailers,
		ImageTags: {
			Primary: images.Primary?.url,
			Logo: images.Logo?.url,
		},
		BackdropImageTags: images.Backdrop?.url ? [images.Backdrop.url] : [],
		UserData: {
			IsFavorite: item.userState?.favorite,
			Played: item.userState?.played,
			PlayedPercentage: item.userState?.playedPercentage,
			PlaybackPositionTicks: item.userState?.positionSeconds ? item.userState.positionSeconds * 10_000_000 : 0,
		},
		DateCreated: item.dateAdded,
		LibraryId: item.libraryId,
		CatalogParentId: item.parentId ?? undefined,
		ChildIds: item.childIds ?? [],
	};
}

export function toMediaStreams(streams: Array<Record<string, unknown>>): MediaStream[] {
	return streams.map((stream, index) => ({
		Index: typeof stream.index === "number" ? stream.index : index,
		Type: (() => {
			const value = String(stream.codec_type ?? stream.type ?? "").toLowerCase();
			return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
		})(),
		Language: typeof (stream.tags as Record<string, unknown> | undefined)?.language === "string" ? String((stream.tags as Record<string, unknown>).language) : undefined,
		DisplayTitle: typeof (stream.tags as Record<string, unknown> | undefined)?.title === "string" && String((stream.tags as Record<string, unknown>).title) ? String((stream.tags as Record<string, unknown>).title) : undefined,
		Codec: typeof stream.codec_name === "string" ? stream.codec_name : undefined,
		Width: typeof stream.width === "number" ? stream.width : undefined,
		Height: typeof stream.height === "number" ? stream.height : undefined,
		Channels: typeof stream.channels === "number" ? stream.channels : undefined,
		FileId: typeof stream.fileId === "string" ? stream.fileId : undefined,
		IsExternal: Boolean(stream.fileId),
	}));
}
