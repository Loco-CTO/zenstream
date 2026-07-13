"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { WideCard, PosterCard } from "@/components/home/media-card";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { ErrorPanel } from "@/components/status/error-panel";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { getFavoriteItems, type JellyfinItem } from "@/lib/jellyfin";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useSortPreference } from "@/lib/sort-preferences";

export function FavoritesPage({ session }: { session: AuthSession }) {
	const { t } = useI18n();
	const [items, setItems] = useState<JellyfinItem[]>([]);
	const [sort, setSort] = useSortPreference("zenstream:sort:favorites", { sortBy: "SortName", sortOrder: "Ascending" }, ["SortName", "DateCreated", "PremiereDate", "CommunityRating"] as const);
	const { sortBy, sortOrder } = sort;
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(true);
	const [retryKey, setRetryKey] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		// Loading state is reset when the sort query changes.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setLoading(true);
		setError(false);
		getFavoriteItems(session, { sortBy, sortOrder, signal: controller.signal })
			.then((nextItems) => setItems(nextItems))
			.catch(() => { if (!controller.signal.aborted) setError(true); })
			.finally(() => { if (!controller.signal.aborted) setLoading(false); });
		return () => controller.abort();
	}, [retryKey, session, sortBy, sortOrder]);

	const options: DropdownOption[] = [
		{ value: "SortName", label: t("sortTitle") },
		{ value: "DateCreated", label: t("sortDateAdded") },
		{ value: "PremiereDate", label: t("sortReleaseDate") },
		{ value: "CommunityRating", label: t("sortRating") },
	];
	const episodes = items.filter((item) => item.Type === "Episode");
	const movies = items.filter((item) => item.Type === "Movie");
	const series = items.filter((item) => item.Type === "Series");

	return <main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
		<div className="mb-8 flex flex-col items-start gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
			<h1 className="text-3xl font-black tracking-tight text-white">{t("favorites")}</h1>
			<div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
				<button type="button" aria-label={sortOrder === "Ascending" ? t("sortAscending") : t("sortDescending")} onClick={() => setSort((value) => ({ ...value, sortOrder: value.sortOrder === "Ascending" ? "Descending" : "Ascending" }))} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/45 hover:text-white">
					{sortOrder === "Ascending" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
				</button>
				<Dropdown aria-label={t("sortBy")} value={sortBy} options={options} onChange={(value) => setSort((current) => ({ ...current, sortBy: value as typeof current.sortBy }))} className="w-full min-w-0 rounded-full py-1.5 uppercase tracking-wider sm:w-auto sm:min-w-32" />
			</div>
		</div>
		{error ? <ErrorPanel message={t("favoritesLoadFailed")} onRetry={() => setRetryKey((value) => value + 1)} /> : loading ? null : items.length === 0 ? <div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center"><h2 className="text-lg font-semibold text-white/80">{t("noFavorites")}</h2></div> : <>
			{episodes.length > 0 && <HorizontalScroller title={t("favoriteEpisodes")} className="mb-8"><div className="flex gap-4">{episodes.map((item) => <WideCard key={item.Id} item={item} session={session} />)}</div></HorizontalScroller>}
			{movies.length > 0 && <HorizontalScroller title={t("favoriteMovies")} className="mb-8"><div className="flex gap-4">{movies.map((item) => <PosterCard key={item.Id} item={item} session={session} />)}</div></HorizontalScroller>}
			{series.length > 0 && <HorizontalScroller title={t("favoriteSeries")}><div className="flex gap-4">{series.map((item) => <PosterCard key={item.Id} item={item} />)}</div></HorizontalScroller>}
		</>}
	</main>;
}
