import type { HomeData, MediaItem } from "@/lib/media-api";
import { HOME_ROWS } from "@/lib/media";
import type { TranslationKey } from "@/lib/i18n";

export type HomeLayoutPreference = {
	order: string[];
	hidden: string[];
};

export type HomeCarouselSection = {
	id: string;
	titleKey?: TranslationKey;
	titleValues?: { library: string };
	title?: string;
	items: MediaItem[];
	variant: "wide" | "poster" | "square";
	stackEpisodes?: boolean;
	viewAllHref?: string;
};

export const DEFAULT_HOME_LAYOUT_PREFERENCE: HomeLayoutPreference = {
	order: [],
	hidden: [],
};

export function homeLayoutStorageKey(serverUrl: string, userId: string) {
	return `zenstream:${encodeURIComponent(serverUrl)}:${encodeURIComponent(userId)}:home:layout`;
}

export function parseHomeLayoutPreference(
	value: string | null,
): HomeLayoutPreference {
	if (!value) return DEFAULT_HOME_LAYOUT_PREFERENCE;
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== "object" || parsed === null)
			return DEFAULT_HOME_LAYOUT_PREFERENCE;
		const candidate = parsed as Partial<HomeLayoutPreference>;
		if (!Array.isArray(candidate.order) || !Array.isArray(candidate.hidden)) {
			return DEFAULT_HOME_LAYOUT_PREFERENCE;
		}
		return {
			order: uniqueStrings(candidate.order),
			hidden: uniqueStrings(candidate.hidden),
		};
	} catch {
		return DEFAULT_HOME_LAYOUT_PREFERENCE;
	}
}

export function getHomeCarouselSections(
	data: Partial<HomeData>,
): HomeCarouselSection[] {
	const recommendations = uniqueItems(data.recommendations ?? []);
	const favoriteMusic = uniqueItems(data.favoriteMusic ?? []).filter(
		isAudioItem,
	);
	const videoFavorites = uniqueItems(data.myList ?? []).filter(
		(item) => !isAudioItem(item),
	);
	const canonicalLibraryRows = (data.libraryRows ?? []).filter(
		(section) =>
			(section.titleKey === "newlyAddedOn" || section.titleKey === "topRated") &&
			uniqueItems(section.items).length > 0,
	);
	const hasCanonicalNewlyAdded = canonicalLibraryRows.some(
		(section) => section.titleKey === "newlyAddedOn",
	);
	const legacyNewlyAdded = !hasCanonicalNewlyAdded
		? (data.newlyAdded ?? [])
				.filter((section) => uniqueItems(section.items).length > 0)
				.map((section) => ({
					...section,
					titleKey: "newlyAddedOn" as const,
					stackEpisodes: false,
					variant: "poster" as const,
				}))
		: [];
	const libraryRows = [...legacyNewlyAdded, ...canonicalLibraryRows];
	const sections: HomeCarouselSection[] = [];
	for (const row of HOME_ROWS.slice(0, 2)) {
		const items = uniqueItems(data[row.key] ?? []);
		if (items.length > 0) {
			sections.push({
				id: homeGlobalSectionId(row.key),
				titleKey: row.titleKey,
				items,
				variant: row.variant,
			});
		}
	}
	if (recommendations.length > 0) {
		sections.push({
			id: homeGlobalSectionId("recommendations"),
			titleKey: "recommendationsForYou",
			items: recommendations,
			variant: "poster",
		});
	}
	for (const section of libraryRows) {
		const items = uniqueItems(section.items);
		if (items.length === 0) continue;
		sections.push({
			id: homeLibrarySectionId(section.libraryId, section.titleKey),
			titleKey: section.titleKey === "topRated" ? "topRatedOn" : "newlyAddedOn",
			titleValues: { library: section.libraryName },
			items,
			variant: section.variant ?? "poster",
			stackEpisodes: section.stackEpisodes,
		});
	}
	if (favoriteMusic.length > 0) {
		sections.push({
			id: homeGlobalSectionId("favoriteMusic"),
			titleKey: "favoriteMusic",
			items: favoriteMusic,
			variant: "square",
			viewAllHref: "/favorites",
		});
	}
	sections.push({
		id: homeGlobalSectionId("favorites"),
		titleKey: "favorites",
		items: videoFavorites,
		variant: "poster",
		viewAllHref: "/favorites",
	});
	for (const section of data.genreRows ?? []) {
		const items = uniqueItems(section.items);
		if (items.length === 0) continue;
		sections.push({
			id: homeGenreSectionId(section.genre),
			title: section.genre,
			items,
			variant: "poster",
		});
	}
	return sections;
}

export function orderHomeSections<T extends { id: string }>(
	sections: T[],
	preference: HomeLayoutPreference,
): T[] {
	const byId = new Map(sections.map((section) => [section.id, section]));
	const ordered: T[] = [];
	const seen = new Set<string>();
	for (const id of preference.order) {
		const section = byId.get(id);
		if (section && !seen.has(id)) {
			ordered.push(section);
			seen.add(id);
		}
	}
	for (const section of sections) {
		if (!seen.has(section.id)) ordered.push(section);
	}
	return ordered;
}

export function visibleHomeSections<T extends { id: string }>(
	sections: T[],
	preference: HomeLayoutPreference,
): T[] {
	const hidden = new Set(preference.hidden);
	return orderHomeSections(sections, preference).filter(
		(section) => !hidden.has(section.id),
	);
}

export function reorderHomeLayoutPreference(
	preference: HomeLayoutPreference,
	availableIds: string[],
	reorderedIds: string[],
): HomeLayoutPreference {
	const available = new Set(availableIds);
	const reordered = uniqueStrings(reorderedIds).filter((id) =>
		available.has(id),
	);
	const order = uniqueStrings(preference.order);
	for (const id of availableIds) {
		if (!order.includes(id)) order.push(id);
	}
	let nextIndex = 0;
	const merged = order.map((id) =>
		available.has(id) ? (reordered[nextIndex++] ?? id) : id,
	);
	return { ...preference, order: uniqueStrings(merged) };
}

export function setHomeSectionHidden(
	preference: HomeLayoutPreference,
	id: string,
	hidden: boolean,
): HomeLayoutPreference {
	const hiddenIds = new Set(preference.hidden);
	if (hidden) hiddenIds.add(id);
	else hiddenIds.delete(id);
	return { ...preference, hidden: [...hiddenIds] };
}

export function homeGlobalSectionId(key: string) {
	return `home:${key}`;
}

export function homeLibrarySectionId(libraryId: string, titleKey: string) {
	return `home:library:${libraryId}:${titleKey}`;
}

export function homeGenreSectionId(genre: string) {
	return `home:genre:${encodeURIComponent(genre.trim().toLowerCase())}`;
}

function uniqueItems<T extends { Id: string }>(items: T[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}

function uniqueStrings(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return [
		...new Set(
			value.filter(
				(entry): entry is string => typeof entry === "string" && entry.length > 0,
			),
		),
	];
}

function isAudioItem(item: { Type?: string }) {
	return (
		item.Type === "MusicArtist" ||
		item.Type === "MusicAlbum" ||
		item.Type === "Audio"
	);
}
