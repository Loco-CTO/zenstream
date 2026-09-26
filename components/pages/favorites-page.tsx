"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Heart, Plus, Trash2 } from "lucide-react";
import {
	MEDIA_CARD_IMAGE_CLASS,
	SquareAudioCard,
	WideCard,
	PosterCard,
} from "@/components/home/media-card";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import { BlurHashImage, MediaPlaceholder } from "@/components/ui/blurhash-image";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import {
	getFavoriteItems,
	landscapeImage,
	type MediaItem,
	seriesPosterImage,
} from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useSortPreference } from "@/lib/sort-preferences";
import {
	fetchPlaylists,
	fetchWatchlist,
	type Playlist,
	type PlaylistSummary,
} from "@/lib/playlists";
import { CreatePlaylistDialog } from "@/components/audio/playlist-picker";
import { setFavorite, setFollowing, savedPlaybackPositionSeconds } from "@/lib/media-api";

type ListsTab = "watchlist" | "favorites" | "playlists";

const FAVORITES_CARD_WIDTH_CLASS =
	"w-[148px] shrink-0 sm:w-[180px] md:w-[200px]";

export function FavoritesPage({
	session,
	initialTab = "watchlist",
}: {
	session: AuthSession;
	initialTab?: ListsTab;
}) {
	const { t } = useI18n();
	const { start } = useProgress();
	const [activeTab, setActiveTab] = useState<ListsTab>(initialTab);
	const tabListRef = useRef<HTMLDivElement>(null);
	const hasMeasuredTabUnderline = useRef(false);
	const [tabUnderline, setTabUnderline] = useState({ left: 0, width: 0 });
	const [tabUnderlineReady, setTabUnderlineReady] = useState(false);
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
	useEffect(() => setActiveTab(initialTab), [initialTab]);
	useEffect(() => {
		const tabList = tabListRef.current;
		if (!tabList) return;
		let initialAnimationFrame: number | null = null;

		const updateUnderline = () => {
			const activeButton = tabList.querySelector<HTMLButtonElement>(
				`[data-list-tab="${activeTab}"]`,
			);
			if (!activeButton) return;
			const tabListBounds = tabList.getBoundingClientRect();
			const activeButtonBounds = activeButton.getBoundingClientRect();

			setTabUnderline({
				left: activeButtonBounds.left - tabListBounds.left,
				width: activeButtonBounds.width,
			});

			if (!hasMeasuredTabUnderline.current && initialAnimationFrame === null) {
				initialAnimationFrame = window.requestAnimationFrame(() => {
					initialAnimationFrame = null;
					hasMeasuredTabUnderline.current = true;
					setTabUnderlineReady(true);
				});
			}
		};

		updateUnderline();
		const resizeObserver =
			typeof ResizeObserver === "undefined"
				? null
				: new ResizeObserver(updateUnderline);
		resizeObserver?.observe(tabList);
		tabList
			.querySelectorAll<HTMLButtonElement>("[data-list-tab]")
			.forEach((button) => resizeObserver?.observe(button));
		window.addEventListener("resize", updateUnderline);

		return () => {
			if (initialAnimationFrame !== null) {
				window.cancelAnimationFrame(initialAnimationFrame);
			}
			resizeObserver?.disconnect();
			window.removeEventListener("resize", updateUnderline);
		};
	}, [activeTab]);
	const episodes = items.filter((item) => item.Type === "Episode");
	const movies = items.filter((item) => item.Type === "Movie");
	const series = items.filter((item) => item.Type === "Series");
	const audioArtists = uniqueItems(
		items.filter((item) => item.Type === "MusicArtist"),
	);
	const audioAlbums = uniqueItems(
		items.filter((item) => item.Type === "MusicAlbum"),
	);
	const audioTracks = uniqueItems(items.filter((item) => item.Type === "Audio"));

	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
			<div className="relative mb-7 border-b border-white/10">
				<div
					ref={tabListRef}
					role="tablist"
					aria-label={t("myLists")}
					className="relative -mb-px flex"
				>
					{(["watchlist", "favorites", "playlists"] as const).map((tab) => (
						<button
							key={tab}
							type="button"
							role="tab"
							data-list-tab={tab}
							aria-selected={activeTab === tab}
							onClick={() => setActiveTab(tab)}
							className={`px-4 py-3 text-sm font-semibold transition-colors ${activeTab === tab ? "text-white" : "text-white/40 hover:text-white/75"}`}
						>
							{t(
								tab === "watchlist"
									? "watchlist"
									: tab === "favorites"
										? "favorites"
										: "playlists",
							)}
						</button>
					))}
					<span
						aria-hidden="true"
						className="pointer-events-none absolute bottom-[-1px] left-0 h-0.5 bg-white"
						style={{
							width: `${tabUnderline.width}px`,
							transform: `translateX(${tabUnderline.left}px)`,
							transition: tabUnderlineReady
								? "transform 300ms ease-out, width 300ms ease-out"
								: "none",
						}}
					/>
				</div>
				{activeTab === "favorites" && (
					<div className="flex w-full shrink-0 items-center gap-2 pb-2 sm:absolute sm:right-0 sm:top-1/2 sm:w-auto sm:-translate-y-1/2 sm:pb-0">
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
				)}
			</div>
			{activeTab === "watchlist" ? <WatchlistSection session={session} /> : activeTab === "playlists" ? <PlaylistsSection session={session} /> : error ? (
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
							<div className="flex gap-4">
								{audioArtists.map((item) => (
									<SquareAudioCard
										key={item.Id}
										item={item}
										session={session}
										className={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
					{audioAlbums.length > 0 && (
						<HorizontalScroller title={t("favoriteAudioAlbums")} className="mb-8">
							<div className="flex gap-4">
								{audioAlbums.map((item) => (
									<SquareAudioCard
										key={item.Id}
										item={item}
										session={session}
										className={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
					{audioTracks.length > 0 && (
						<HorizontalScroller title={t("favoriteAudioTracks")} className="mb-8">
							<div className="flex gap-4">
								{audioTracks.map((item) => (
									<SquareAudioCard
										key={item.Id}
										item={item}
										session={session}
										className={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
					{episodes.length > 0 && (
						<HorizontalScroller title={t("favoriteEpisodes")} className="mb-8">
							<div className="flex gap-4">
								{episodes.map((item) => (
									<WideCard
										key={item.Id}
										item={item}
										session={session}
										widthClassName={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
					{movies.length > 0 && (
						<HorizontalScroller title={t("favoriteMovies")} className="mb-8">
							<div className="flex gap-4">
								{movies.map((item) => (
									<PosterCard
										key={item.Id}
										item={item}
										session={session}
										widthClassName={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
					{series.length > 0 && (
						<HorizontalScroller title={t("favoriteSeries")}>
							<div className="flex gap-4">
								{series.map((item) => (
									<PosterCard
										key={item.Id}
										item={item}
										widthClassName={FAVORITES_CARD_WIDTH_CLASS}
									/>
								))}
							</div>
						</HorizontalScroller>
					)}
				</>
			)}
		</main>
	);
}

function WatchlistSection({ session }: { session: AuthSession }) {
	const { t } = useI18n();
	const [items, setItems] = useState<MediaItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(false);
		void fetchWatchlist(session).then((value) => {
			if (active) setItems(value);
		}).catch(() => {
			if (active) setError(true);
		}).finally(() => {
			if (active) setLoading(false);
		});
		return () => { active = false; };
	}, [retry, session]);

	useEffect(() => {
		const refresh = (rawEvent?: Event) => {
			const event = rawEvent as CustomEvent<{ reason?: "scan" | "refresh" }> | undefined;
			if (event?.detail?.reason === "scan") return;
			setRetry((value) => value + 1);
		};
		window.addEventListener("focus", refresh);
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => {
			window.removeEventListener("focus", refresh);
			window.removeEventListener("zenstream:catalog-changed", refresh);
		};
	}, []);

	async function toggleFavorite(item: MediaItem) {
		if (busy) return;
		const previous = Boolean(item.UserData?.IsFavorite);
		setBusy(item.Id);
		setItems((current) => current.map((value) => value.Id === item.Id ? { ...value, UserData: { ...value.UserData, IsFavorite: !previous } } : value));
		try {
			await setFavorite(session, item.Id, !previous);
		} catch {
			setItems((current) => current.map((value) => value.Id === item.Id ? { ...value, UserData: { ...value.UserData, IsFavorite: previous } } : value));
			setError(true);
		} finally { setBusy(null); }
	}

	async function unfollow(item: MediaItem) {
		if (busy) return;
		setBusy(item.Id);
		setItems((current) => current.filter((value) => value.Id !== item.Id));
		try {
			await setFollowing(session, item.Id, false);
		} catch {
			setError(true);
			setRetry((value) => value + 1);
		} finally { setBusy(null); }
	}

	if (loading) return null;
	if (error && items.length === 0) return <ErrorPanel message={t("watchlistLoadFailed")} onRetry={() => setRetry((value) => value + 1)} />;
	if (items.length === 0) return <div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center"><h2 className="text-lg font-semibold text-white/80">{t("watchlistEmpty")}</h2><p className="mt-2 text-sm text-white/40">{t("watchlistEmptyHint")}</p></div>;
	return (
		<div className="divide-y divide-white/[0.08]">
			{items.map((item) => {
				const status = item.WatchlistStatus;
				const nextEpisode =
					status?.kind === "upNext" ? status.nextEpisode : undefined;
				const episodeImage = nextEpisode
					? landscapeImage(nextEpisode)
					: null;
				const image = episodeImage ?? seriesPosterImage(item);
				const portraitSeries = item.Type === "Series" && !episodeImage;
				const position = savedPlaybackPositionSeconds(item);
				const duration = item.UserData?.DurationSeconds ?? item.DurationSeconds ?? 0;
				const progress = duration > 0 ? Math.min(100, Math.max(0, position / duration * 100)) : 0;
				const href =
					item.Type === "MusicArtist"
						? `/artist/${encodeURIComponent(item.Id)}`
						: item.Type === "Series"
							? `/show/${encodeURIComponent(item.Id)}`
							: `/play/${encodeURIComponent(item.Id)}`;
				return <div key={item.Id} className="flex min-h-28 items-center gap-4 py-4">
					<Link
						href={href}
						className={`relative ${portraitSeries ? "aspect-[2/3] w-14" : "h-20 w-32"} shrink-0 overflow-hidden rounded-lg bg-white/[0.04]`}
					>
						{image ? (
							<BlurHashImage
								image={image}
								alt={episodeImage ? nextEpisode?.Name ?? item.Name : item.Name}
								sizes={portraitSeries ? "56px" : "128px"}
								className="h-full w-full object-cover"
							/>
						) : (
							<MediaPlaceholder />
						)}
						{progress > 0 && <span className="absolute inset-x-0 bottom-0 h-1 bg-white/20"><span className="block h-full bg-violet-300" style={{ width: `${progress}%` }} /></span>}
					</Link>
					<div className="min-w-0 flex-1">
						<Link href={href} className="block truncate text-sm font-semibold text-white hover:underline">{item.Name}</Link>
						<p className="mt-1 truncate text-xs text-white/40">
							{status?.kind === "continue"
								? t("continueWatching")
								: status?.kind === "upNext" ? (
									<>
										{t("upNextEpisode", {
											season: status.seasonNumber ?? 0,
											episode: status.episodeNumber ?? 0,
										})}
										{nextEpisode?.Name ? ` · ${nextEpisode.Name}` : ""}
									</>
								) : item.Type === "MusicArtist"
									? t("artist")
									: item.Type === "Series"
										? t("series")
										: t("movie")}
						</p>
					</div>
					<button type="button" disabled={busy !== null} aria-label={item.UserData?.IsFavorite ? t("removeFavorite") : t("addFavorite")} onClick={() => void toggleFavorite(item)} className={`rounded p-2 transition hover:bg-white/[0.06] ${item.UserData?.IsFavorite ? "text-violet-300" : "text-white/40 hover:text-white"}`}><Heart className="h-4 w-4" fill={item.UserData?.IsFavorite ? "currentColor" : "none"} /></button>
					<button type="button" disabled={busy !== null} aria-label={t("removeFromWatchlist")} onClick={() => void unfollow(item)} className="rounded p-2 text-white/35 transition hover:bg-white/[0.06] hover:text-white"><Trash2 className="h-4 w-4" /></button>
				</div>;
			})}
		</div>
	);
}

function PlaylistsSection({ session }: { session: AuthSession }) {
	const { t } = useI18n();
	const { start } = useProgress();
	const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		let active = true;
		let progressFinished = false;
		const finish = start();
		const finishProgress = () => {
			if (progressFinished) return;
			progressFinished = true;
			finish();
		};
		void fetchPlaylists(session).then((value) => {
			if (active) setPlaylists(value);
		}).catch(() => {
			if (active) setError(true);
		}).finally(() => {
			if (active) setLoading(false);
			finishProgress();
		});
		return () => { active = false; finishProgress(); };
	}, [retry, session, start]);

	useEffect(() => {
		const refresh = () => setRetry((value) => value + 1);
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	if (loading) return null;
	return (
		<>
			{error && <ErrorPanel message={t("playlistsLoadFailed")} onRetry={() => setRetry((value) => value + 1)} />}
			<div className="flex flex-wrap gap-5">
				<button type="button" onClick={() => setCreating(true)} className="flex h-[148px] w-[148px] shrink-0 flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-white/20 bg-white/[0.02] text-white/45 transition hover:border-white/40 hover:bg-white/[0.05] hover:text-white sm:h-[180px] sm:w-[180px] md:h-[200px] md:w-[200px]"><Plus className="h-6 w-6" /><span className="text-[10px] font-semibold uppercase tracking-wider">{t("newPlaylist")}</span></button>
				{playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} />)}
			</div>
			{creating && <CreatePlaylistDialog session={session} onClose={() => setCreating(false)} onCreated={(playlist: Playlist) => { setPlaylists((value) => [playlist, ...value]); setCreating(false); }} />}
		</>
	);
}

function PlaylistCard({ playlist }: { playlist: PlaylistSummary }) {
	const { t } = useI18n();
	const useArtworkMosaic = playlist.itemCount >= 4;
	const mosaicItems = Array.from(
		{ length: 4 },
		(_, index) => playlist.artworkItems[index] ?? null,
	);
	const artwork = playlist.artworkItems.find((item) => seriesPosterImage(item));
	const image = artwork ? seriesPosterImage(artwork) : null;
	return (
		<article className={`group/card ${FAVORITES_CARD_WIDTH_CLASS} min-w-0 cursor-pointer select-none`}>
			<div className="relative">
				<Link href={`/playlist/${encodeURIComponent(playlist.id)}`} aria-label={playlist.name} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
					<div className="relative aspect-square overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
						{useArtworkMosaic ? (
							<div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black">
								{mosaicItems.map((item, index) => {
									const tileImage = item ? seriesPosterImage(item) : null;
									return (
										<div key={item?.Id ?? `empty-${index}`} className="relative min-h-0 min-w-0 overflow-hidden bg-[var(--c-card-thumb)]">
											{tileImage ? (
												<BlurHashImage
													image={tileImage}
													alt={item?.Name ?? playlist.name}
													useArtworkVariants
													draggable={false}
													sizes="(max-width: 639px) 74px, (max-width: 767px) 90px, 100px"
													className={MEDIA_CARD_IMAGE_CLASS}
												/>
											) : (
												<MediaPlaceholder />
											)}
										</div>
									);
								})}
							</div>
						) : image ? (
							<BlurHashImage
								image={image}
								alt={artwork?.Name ?? playlist.name}
								useArtworkVariants
								draggable={false}
								sizes="(max-width: 639px) 148px, (max-width: 767px) 180px, 200px"
								className={MEDIA_CARD_IMAGE_CLASS}
							/>
						) : (
							<MediaPlaceholder />
						)}
						<div
							aria-hidden="true"
							className="pointer-events-none absolute inset-0 z-10 bg-black/0 transition-colors duration-200 group-hover/card:bg-black/15"
						/>
					</div>
				</Link>
			</div>
			<div className="mt-2 min-w-0">
				<p className="truncate text-xs font-medium text-white/85">{playlist.name}</p>
				<p className="mt-0.5 truncate text-xs text-white/40">{t("playlistTrackCount", { count: playlist.itemCount })} · {playlist.isPrivate ? t("privatePlaylist") : t("publicPlaylist")}</p>
			</div>
		</article>
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
