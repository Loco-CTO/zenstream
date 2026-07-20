import type { HomeData, JellyfinItem } from "@/lib/jellyfin";
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
	items: JellyfinItem[];
}

export function stackNewlyAdded(items: JellyfinItem[]): MediaStack[] {
	const stacks: MediaStack[] = [];
	for (const item of items) {
		const previousStack = stacks.at(-1);
		const previous = previousStack?.items.at(-1);
		if (previousStack && previous && areSequentialEpisodes(previous, item)) {
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

export function runtimeLabel(item: JellyfinItem, locale: Locale = "en") {
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

/** Formats Jellyfin's most precise known release/premiere date for detail views. */
export function releaseDateLabel(item: JellyfinItem, locale: Locale = "en") {
	if (item.PremiereDate) {
		// Jellyfin commonly returns a date-only value; parse it as local midnight
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

export function subtitle(item: JellyfinItem) {
	if (
		item.Type === "Episode" &&
		item.ParentIndexNumber != null &&
		item.IndexNumber != null
	) {
		return `S${item.ParentIndexNumber}:E${item.IndexNumber}`;
	}

	return (
		[item.ProductionYear, item.SeriesName, item.OfficialRating]
			.filter(Boolean)
			.join(" ・ ") || item.Type
	);
}

export function progressPercent(item: JellyfinItem) {
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

function areSequentialEpisodes(a: JellyfinItem, b: JellyfinItem) {
	return (
		a.Type === "Episode" &&
		b.Type === "Episode" &&
		Boolean(a.SeriesId) &&
		a.SeriesId === b.SeriesId &&
		a.ParentIndexNumber === b.ParentIndexNumber &&
		a.IndexNumber != null &&
		b.IndexNumber != null &&
		Math.abs(a.IndexNumber - b.IndexNumber) === 1
	);
}

function hasVisualImage(item: JellyfinItem) {
	return Boolean(
		item.BackdropImageTags?.length ||
		item.ImageTags?.Thumb ||
		item.ImageTags?.Primary,
	);
}
