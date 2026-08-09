import type { HomeData, MediaItem } from "@/lib/media-api";
import { translate, type Locale, type TranslationKey } from "@/lib/i18n";

export const HOME_ROWS: Array<{
	key: "continueWatching" | "nextUp";
	titleKey: TranslationKey;
	variant: "wide" | "poster";
}> = [
	{ key: "continueWatching", titleKey: "continueWatching", variant: "wide" },
	{ key: "nextUp", titleKey: "nextUp", variant: "wide" },
];

export interface MediaStack {
	key: string;
	items: MediaItem[];
}

export function stackNewlyAdded(items: MediaItem[]): MediaStack[] {
	const stacks: MediaStack[] = [];
	for (const item of items) {
		const previousStack = stacks.at(-1);
		const previous = previousStack?.items.at(-1);
		if (previousStack && previous && areBatchEpisodes(previous, item)) {
			previousStack.items.push(item);
		} else {
			stacks.push({ key: item.Id, items: [item] });
		}
	}
	return stacks;
}

export function pickHeroItem(data: Partial<HomeData>) {
	return (
		data.newReleases?.find(hasVisualImage) ??
		data.topRated?.find(hasVisualImage) ??
		data.newReleases?.[0] ??
		data.topRated?.[0] ??
		null
	);
}

export function runtimeLabel(item: MediaItem, locale: Locale = "en") {
	if (item.RunTimeTicks) {
		return translate(locale, "minutes", {
			count: Math.round(item.RunTimeTicks / 600000000),
		});
	}
	if (item.ChildCount) {
		return translate(locale, "episodes", { count: item.ChildCount });
	}
	if (item.RecursiveItemCount) {
		return translate(locale, "items", { count: item.RecursiveItemCount });
	}
	return undefined;
}

/** Formats the most precise known release/premiere date for detail views. */
export function releaseDateLabel(item: MediaItem, locale: Locale = "en") {
	if (item.PremiereDate) {
		// Date-only provider values are parsed as local midnight
		// so users west of UTC do not see the previous calendar day.
		const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item.PremiereDate);
		const date = dateOnly
			? new Date(
					Number(dateOnly[1]),
					Number(dateOnly[2]) - 1,
					Number(dateOnly[3]),
				)
			: new Date(item.PremiereDate);
		if (!Number.isNaN(date.getTime())) {
			return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-GB", {
				day: "numeric",
				month: "long",
				year: "numeric",
			}).format(date);
		}
	}
	return item.ProductionYear?.toString();
}

export function releaseYear(
	item: Pick<MediaItem, "ProductionYear" | "PremiereDate">,
) {
	if (Number.isFinite(item.ProductionYear)) {
		return String(item.ProductionYear);
	}

	return /^(\d{4})/.exec(item.PremiereDate ?? "")?.[1];
}

export function subtitle(item: MediaItem) {
	if (
		item.Type === "Episode" &&
		item.ParentIndexNumber != null &&
		item.IndexNumber != null
	) {
		return `S${item.ParentIndexNumber}:E${item.IndexNumber}`;
	}

	return (
		[releaseYear(item), item.SeriesName, item.OfficialRating]
			.filter(Boolean)
			.join(" ・ ") || item.Type
	);
}

export function progressPercent(item: MediaItem) {
	if (item.Type !== "Movie" && item.Type !== "Episode") {
		return undefined;
	}
	if (item.UserData?.PlayedPercentage != null) {
		return Math.max(0, Math.min(100, item.UserData.PlayedPercentage));
	}
	if (!item.RunTimeTicks || !item.UserData?.PlaybackPositionTicks) {
		return undefined;
	}
	return Math.max(
		0,
		Math.min(
			100,
			(item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100,
		),
	);
}

function areBatchEpisodes(a: MediaItem, b: MediaItem) {
	return (
		a.Type === "Episode" &&
		b.Type === "Episode" &&
		Boolean(a.SeriesId) &&
		a.SeriesId === b.SeriesId &&
		Boolean(a.SeasonId) &&
		a.SeasonId === b.SeasonId &&
		a.ParentIndexNumber === b.ParentIndexNumber &&
		a.IndexNumber != null &&
		b.IndexNumber != null &&
		Math.abs(a.IndexNumber - b.IndexNumber) === 1 &&
		addedWithinOneHour(a.LastAddedAt, b.LastAddedAt)
	);
}

function addedWithinOneHour(a?: string, b?: string) {
	const aTime = a ? Date.parse(a) : Number.NaN;
	const bTime = b ? Date.parse(b) : Number.NaN;
	return Number.isFinite(aTime) && Number.isFinite(bTime) && Math.abs(aTime - bTime) <= 3_600_000;
}

function hasVisualImage(item: MediaItem) {
	return Boolean(item.BackdropImageTags?.length);
}
