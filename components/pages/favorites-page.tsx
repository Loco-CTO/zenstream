"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { SquareAudioCard, WideCard, PosterCard } from "@/components/home/media-card";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { getFavoriteItems, type MediaItem } from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useSortPreference } from "@/lib/sort-preferences";

export function FavoritesPage({ session }: { session: AuthSession }) {
	const { t } = useI18n();
	const { start } = useProgress();
	const [items, setItems] = useState<MediaItem[]>([]);
	const [sort, setSort] = useSortPreference(
		"zenstream:sort:favorites",
		{ sortBy: "SortName", sortOrder: "Ascending" },
		["SortName", "DateCreated", "PremiereDate", "CommunityRating"] as const,
	);
	const { sortBy, sortOrder } = sort;
	const [loadedKey, setLoadedKey] = useState<string | null>(null);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [retryKey, setRetryKey] = useState(0);
	const requestKey = `${session.userId}:${sortBy}:${sortOrder}:${retryKey}`;
	const loading = loadedKey !== requestKey;
	const error = errorKey === requestKey;

	useEffect(() => {
		const controller = new AbortController();
		const finish = start();
		getFavoriteItems(session, { sortBy, sortOrder, signal: controller.signal })
			.then((nextItems) => {
				setItems(nextItems);
				setErrorKey(null);
				setLoadedKey(requestKey);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setErrorKey(requestKey);
					setLoadedKey(requestKey);
				}
			})
			.finally(() => {
				finish();
			});
		return () => controller.abort();
	}, [requestKey, session, sortBy, sortOrder, start]);

	useEffect(() => {
		const refresh = (rawEvent: Event) => {
			const event = rawEvent as CustomEvent<{ reason?: "scan" | "refresh" }>;
			if (event.detail?.reason === "scan") return;
			setRetryKey((value) => value + 1);
		};
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, []);

	const options: DropdownOption[] = [
		{ value: "SortName", label: t("sortTitle") },
		{ value: "DateCreated", label: t("sortDateAdded") },
		{ value: "PremiereDate", label: t("sortReleaseDate") },
		{ value: "CommunityRating", label: t("sortRating") },
	];
	const episodes = items.filter((item) => item.Type === "Episode");
	const movies = items.filter((item) => item.Type === "Movie");
	const series = items.filter((item) => item.Type === "Series");
	const audioArtists = uniqueItems(items.filter((item) => item.Type === "MusicArtist"));
	const audioAlbums = uniqueItems(items.filter((item) => item.Type === "MusicAlbum"));
	const audioTracks = uniqueItems(items.filter((item) => item.Type === "Audio"));

	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
			<div className="mb-8 flex flex-col items-start gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
				<h1 className="text-3xl font-black tracking-tight text-white">
					{t("favorites")}
				</h1>
				<div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
					<button
						type="button"
						aria-label={
							sortOrder === "Ascending" ? t("sortAscending") : t("sortDescending")
						}
						onClick={() =>
							setSort((value) => ({
								...value,
								sortOrder: value.sortOrder === "Ascending" ? "Descending" : "Ascending",
							}))
						}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/45 hover:text-white"
					>
						{sortOrder === "Ascending" ? (
							<ArrowUp className="h-3.5 w-3.5" />
						) : (
							<ArrowDown className="h-3.5 w-3.5" />
						)}
					</button>
					<Dropdown
						aria-label={t("sortBy")}
						value={sortBy}
						options={options}
						onChange={(value) =>
							setSort((current) => ({
								...current,
								sortBy: value as typeof current.sortBy,
							}))
						}
						className="w-full min-w-0 rounded-full py-1.5 uppercase tracking-wider sm:w-auto sm:min-w-32"
					/>
				</div>
			</div>
			{error ? (
				<ErrorPanel
					message={t("favoritesLoadFailed")}
					onRetry={() => setRetryKey((value) => value + 1)}
				/>
			) : loading ? null : items.length === 0 ? (
				<div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center">
					<h2 className="text-lg font-semibold text-white/80">{t("noFavorites")}</h2>
				</div>
			) : (
				<>
					{audioArtists.length > 0 && (
						<HorizontalScroller title={t("favoriteAudioArtists")} className="mb-8">
							<div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7">
								{audioArtists.map((item) => <SquareAudioCard key={item.Id} item={item} session={session} />)}
							</div>
						</HorizontalScroller>
					)}
					{audioAlbums.length > 0 && (
						<HorizontalScroller title={t("favoriteAudioAlbums")} className="mb-8">
							<div className="flex gap-4">
								{audioAlbums.map((item) => <SquareAudioCard key={item.Id} item={item} session={session} className="w-[148px] sm:w-[180px] md:w-[200px]" />)}
							</div>
						</HorizontalScroller>
					)}
					{audioTracks.length > 0 && (
						<HorizontalScroller title={t("favoriteAudioTracks")} className="mb-8">
							<div className="flex gap-4">
								{audioTracks.map((item) => <SquareAudioCard key={item.Id} item={item} session={session} className="w-[148px] sm:w-[180px] md:w-[200px]" />)}
							</div>
						</HorizontalScroller>
					)}
					{episodes.length > 0 && (
						<HorizontalScroller title={t("favoriteEpisodes")} className="mb-8">
							<div className="flex gap-4">
								{episodes.map((item) => (
									<WideCard key={item.Id} item={item} session={session} />
								))}
							</div>
						</HorizontalScroller>
					)}
					{movies.length > 0 && (
						<HorizontalScroller title={t("favoriteMovies")} className="mb-8">
							<div className="flex gap-4">
								{movies.map((item) => (
									<PosterCard key={item.Id} item={item} session={session} />
								))}
							</div>
						</HorizontalScroller>
					)}
					{series.length > 0 && (
						<HorizontalScroller title={t("favoriteSeries")}>
							<div className="flex gap-4">
								{series.map((item) => (
									<PosterCard key={item.Id} item={item} />
								))}
							</div>
						</HorizontalScroller>
					)}
				</>
			)}
		</main>
	);
}

function uniqueItems(items: MediaItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}
