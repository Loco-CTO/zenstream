import type { MediaItem, MediaStream } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { authenticatedFetch } from "@/lib/authenticated-request";

export { orchestratorBaseUrl } from "@/lib/authenticated-request";

export type CatalogItem = {
	id: string;
	libraryId: string;
	parentId?: string | null;
	seriesId?: string | null;
	seriesName?: string | null;
	seriesProductionYear?: number | null;
	seriesPrimaryImage?: { url?: string; blurHash?: string } | null;
	seasonId?: string | null;
	type: "movie" | "series" | "season" | "episode" | "collection" | string;
	name: string;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	dateAdded?: string;
	lastAddedAt?: string;
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
		officialRating?: string;
		people?: Array<Record<string, unknown>>;
		credits?: {
			cast?: Array<Record<string, unknown>>;
			crew?: Array<Record<string, unknown>>;
		};
		trailers?: Array<Record<string, unknown>>;
		images?: Partial<
			Record<
				"Primary" | "Backdrop" | "Logo" | "Banner",
				{ url?: string; blurHash?: string }
			>
		>;
	};
	userState?: {
		favorite?: boolean;
		played?: boolean;
		playCount?: number;
		durationSeconds?: number;
		lastPlayedAt?: string | null;
		unplayedItemCount?: number;
		playedPercentage?: number;
		positionSeconds?: number;
	};
};

export async function catalogRequest<T>(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), 20_000);
	const abort = () => controller.abort();
	init.signal?.addEventListener("abort", abort, { once: true });
	let response: Response;
	try {
		response = await authenticatedFetch(session, path, {
			...init,
			signal: controller.signal,
		});
	} catch (error) {
		if (controller.signal.aborted && !init.signal?.aborted) {
			throw new Error("The Orchestrator did not respond within 20 seconds.");
		}
		throw error;
	} finally {
		window.clearTimeout(timeout);
		init.signal?.removeEventListener("abort", abort);
	}
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

function metadataYear(value: unknown, date: unknown) {
	for (const candidate of [value, date]) {
		const match = /^(\d{4})/.exec(String(candidate ?? ""));
		if (match) return Number(match[1]);
	}
	return undefined;
}

export function toMediaItem(item: CatalogItem): MediaItem {
	const images = item.metadata.images ?? {};
	const people = (["cast", "crew"] as const).flatMap((creditType) =>
		(item.metadata.credits?.[creditType] ?? []).map((person) => {
			const image = person.image;
			const imageUrl =
				image &&
				typeof image === "object" &&
				typeof (image as Record<string, unknown>).url === "string"
					? String((image as Record<string, unknown>).url)
					: undefined;
			const blurHash =
				image &&
				typeof image === "object" &&
				typeof (image as Record<string, unknown>).blurHash === "string"
					? String((image as Record<string, unknown>).blurHash)
					: undefined;
			return {
				Id: typeof person.id === "string" ? person.id : undefined,
				Name: String(person.name ?? ""),
				Role:
					typeof (creditType === "cast" ? person.character : person.job) === "string"
						? String(creditType === "cast" ? person.character : person.job)
						: undefined,
				Type: typeof person.department === "string" ? person.department : undefined,
				CreditType: creditType,
				PrimaryImageTag: imageUrl,
				ImageBlurHashes:
					imageUrl && blurHash ? { Primary: { [imageUrl]: blurHash } } : undefined,
			};
		}),
	);
	const trailers = (item.metadata.trailers ?? []).flatMap((trailer) => {
		const site = String(
			trailer.site ?? trailer.provider ?? trailer.source ?? "",
		).toLowerCase();
		const key = trailer.key ?? trailer.videoId;
		if (site === "youtube" && key) {
			return [{ Url: `https://www.youtube.com/watch?v=${String(key)}` }];
		}
		const url =
			[trailer.url, trailer.link, trailer.videoUrl, trailer.youtubeUrl]
				.find(
					(value): value is string =>
						typeof value === "string" && /^https?:\/\//i.test(value.trim()),
				)
				?.trim() ?? "";
		return /^https?:\/\//i.test(url) ? [{ Url: url }] : [];
	});
	const productionYear = metadataYear(item.metadata.year, item.metadata.date);
	return {
		Id: item.id,
		Name: item.metadata.title ?? item.name,
		Type: itemTypes[item.type] ?? item.type,
		SeriesId: item.seriesId ?? undefined,
		SeriesName: item.seriesName ?? undefined,
		SeriesProductionYear: item.seriesProductionYear ?? undefined,
		SeriesPrimaryImageTag: item.seriesPrimaryImage?.url,
		SeriesPrimaryImageBlurHash: item.seriesPrimaryImage?.blurHash,
		SeasonId: item.seasonId ?? undefined,
		ParentIndexNumber: item.seasonNumber ?? undefined,
		IndexNumber:
			item.type === "season"
				? (item.seasonNumber ?? undefined)
				: (item.episodeNumber ?? undefined),
		Overview: item.metadata.overview ?? item.metadata.description,
		ProductionYear: productionYear,
		PremiereDate: item.metadata.date,
		RunTimeTicks: item.metadata.runtimeMinutes
			? item.metadata.runtimeMinutes * 60 * 10_000_000
			: undefined,
		CommunityRating: item.metadata.communityRating,
		OfficialRating: item.metadata.officialRating,
		Genres: item.metadata.tags,
		People: people,
		RemoteTrailers: trailers,
		ImageTags: {
			Primary: images.Primary?.url,
			Logo: images.Logo?.url,
		},
		BackdropImageTags: images.Backdrop?.url ? [images.Backdrop.url] : [],
		ImageBlurHashes: {
			Primary:
				images.Primary?.url && images.Primary.blurHash
					? { [images.Primary.url]: images.Primary.blurHash }
					: undefined,
			Backdrop:
				images.Backdrop?.url && images.Backdrop.blurHash
					? { [images.Backdrop.url]: images.Backdrop.blurHash }
					: undefined,
			Banner:
				images.Banner?.url && images.Banner.blurHash
					? { [images.Banner.url]: images.Banner.blurHash }
					: undefined,
		},
		UserData: {
			IsFavorite: item.userState?.favorite,
			Played: item.userState?.played,
			UnplayedItemCount: item.userState?.unplayedItemCount,
			PlayedPercentage: item.userState?.playedPercentage,
			PlaybackPositionTicks: item.userState?.positionSeconds
				? item.userState.positionSeconds * 10_000_000
				: 0,
			PlayCount: item.userState?.playCount,
			DurationSeconds: item.userState?.durationSeconds,
			LastPlayedAt: item.userState?.lastPlayedAt ?? undefined,
		},
		DateCreated: item.dateAdded,
		LastAddedAt: item.lastAddedAt,
		LibraryId: item.libraryId,
		CatalogParentId: item.parentId ?? undefined,
		ChildIds: item.childIds ?? [],
	};
}

export function toMediaStreams(
	streams: Array<Record<string, unknown>>,
): MediaStream[] {
	return streams.map((stream, index) => ({
		Index: typeof stream.index === "number" ? stream.index : index,
		Type: (() => {
			const value = String(stream.codec_type ?? stream.type ?? "").toLowerCase();
			return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
		})(),
		Language:
			typeof (stream.tags as Record<string, unknown> | undefined)?.language ===
			"string"
				? String((stream.tags as Record<string, unknown>).language)
				: undefined,
		DisplayTitle:
			typeof (stream.tags as Record<string, unknown> | undefined)?.title ===
				"string" && String((stream.tags as Record<string, unknown>).title)
				? String((stream.tags as Record<string, unknown>).title)
				: undefined,
		Codec: typeof stream.codec_name === "string" ? stream.codec_name : undefined,
		Width: typeof stream.width === "number" ? stream.width : undefined,
		Height: typeof stream.height === "number" ? stream.height : undefined,
		Channels: typeof stream.channels === "number" ? stream.channels : undefined,
		FileId: typeof stream.fileId === "string" ? stream.fileId : undefined,
		IsExternal: Boolean(stream.fileId),
	}));
}
