"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import {
	emptySearchFacets,
	getSearchPage,
	landscapeImage,
	posterImage,
	type MediaItem,
	type SearchFacets,
	type SearchFilter,
} from "@/lib/media-api";
import { releaseYear, runtimeLabel } from "@/lib/media";
import { useI18n, type Locale, type TranslationKey } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

const SEARCH_PAGE_SIZE = 20;
const FILTER_ORDER: SearchFilter[] = [
	"all",
	"series",
	"movie",
	"release",
	"artist",
	"track",
	"collection",
];

const FILTER_LABEL_KEYS: Record<SearchFilter, TranslationKey> = {
	all: "all",
	series: "series",
	movie: "movie",
	release: "album",
	artist: "artist",
	track: "track",
	collection: "collection",
};

export function SearchPage({
	session,
	query,
}: {
	session: AuthSession;
	query: string;
}) {
	const { locale, t } = useI18n();
	const { start } = useProgress();
	const [selectedFilter, setSelectedFilter] = useState<SearchFilter>("all");
	const [items, setItems] = useState<MediaItem[]>([]);
	const [facets, setFacets] = useState<SearchFacets>(() => emptySearchFacets());
	const [total, setTotal] = useState(0);
	const [loadedKey, setLoadedKey] = useState<string | null>(null);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loadMoreError, setLoadMoreError] = useState(false);
	const [retryKey, setRetryKey] = useState(0);
	const requestGenerationRef = useRef(0);
	const requestRef = useRef<AbortController | null>(null);
	const loadedPageRef = useRef(0);
	const itemsRef = useRef<MediaItem[]>([]);
	const totalRef = useRef(0);
	const requestedPagesRef = useRef(new Set<number>());
	const loadingMoreRef = useRef(false);
	const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
	const activeFilter = selectedFilter;
	const requestKey = `${query}:${activeFilter}:${retryKey}`;
	const loading = loadedKey !== requestKey;
	const error = errorKey === requestKey;

	useEffect(() => {
		const requestGeneration = ++requestGenerationRef.current;
		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		loadedPageRef.current = 0;
		itemsRef.current = [];
		totalRef.current = 0;
		requestedPagesRef.current = new Set([1]);
		loadingMoreRef.current = false;
		const finishProgress = start();
		let finished = false;
		const finish = () => {
			if (finished) return;
			finished = true;
			finishProgress();
		};

		getSearchPage(session, query, {
			page: 1,
			pageSize: SEARCH_PAGE_SIZE,
			type: activeFilter,
			signal: controller.signal,
		})
			.then((page) => {
				if (
					controller.signal.aborted ||
					requestGenerationRef.current !== requestGeneration
				)
					return;
				const nextItems = uniqueItems(page.items);
				itemsRef.current = nextItems;
				totalRef.current = page.total;
				setItems(nextItems);
				setTotal(page.total);
				setFacets(page.facets ?? emptySearchFacets());
				loadedPageRef.current = page.page;
				setErrorKey(null);
				setLoadMoreError(false);
				setLoadedKey(requestKey);
			})
			.catch(() => {
				if (
					!controller.signal.aborted &&
					requestGenerationRef.current === requestGeneration
				) {
					setErrorKey(requestKey);
					setLoadedKey(requestKey);
				}
			})
			.finally(finish);
		return () => {
			requestRef.current?.abort();
			controller.abort();
			finish();
		};
	}, [activeFilter, query, requestKey, session, start]);

	const retry = useCallback(() => {
		setItems([]);
		setTotal(0);
		setLoadingMore(false);
		setLoadMoreError(false);
		setRetryKey((value) => value + 1);
	}, []);

	const loadMore = useCallback(async () => {
		if (
			loading ||
			error ||
			loadingMoreRef.current ||
			loadedPageRef.current === 0 ||
			itemsRef.current.length >= totalRef.current
		)
			return;
		const nextPage = loadedPageRef.current + 1;
		if (requestedPagesRef.current.has(nextPage)) return;
		requestedPagesRef.current.add(nextPage);
		loadingMoreRef.current = true;
		setLoadingMore(true);
		setLoadMoreError(false);
		const requestGeneration = requestGenerationRef.current;
		const controller = new AbortController();
		requestRef.current = controller;
		const finishProgress = start();
		try {
			const page = await getSearchPage(session, query, {
				page: nextPage,
				pageSize: SEARCH_PAGE_SIZE,
				type: activeFilter,
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				requestGenerationRef.current !== requestGeneration
			)
				return;
			const nextItems = uniqueItems([...itemsRef.current, ...page.items]);
			itemsRef.current = nextItems;
			totalRef.current = page.total;
			setItems(nextItems);
			setTotal(page.total);
			setFacets(page.facets ?? emptySearchFacets());
			loadedPageRef.current = nextPage;
		} catch {
			requestedPagesRef.current.delete(nextPage);
			if (
				!controller.signal.aborted &&
				requestGenerationRef.current === requestGeneration
			) {
				setLoadMoreError(true);
			}
		} finally {
			if (requestGenerationRef.current === requestGeneration) {
				loadingMoreRef.current = false;
				setLoadingMore(false);
			}
			finishProgress();
		}
	}, [activeFilter, error, loading, query, session, start]);

	useEffect(() => {
		const sentinel = loadMoreSentinelRef.current;
		if (!sentinel || typeof IntersectionObserver === "undefined") return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting && !loadMoreError) void loadMore();
			},
			{ rootMargin: "0px 0px 640px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [items.length, loadMore, loadMoreError, loadingMore, total]);

	useEffect(() => {
		const refresh = (rawEvent: Event) => {
			const event = rawEvent as CustomEvent<{ reason?: "scan" | "refresh" }>;
			if (event.detail?.reason === "scan") return;
			setRetryKey((value) => value + 1);
		};
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, []);

	const featured = findFeaturedItem(items);
	const visibleItems = featured
		? items.filter((item) => item.Id !== featured.item.Id)
		: items;
	const filterOptions = FILTER_ORDER.filter(
		(filter) => filter === "all" || facets[filter] > 0,
	);
	const showLoadingMore = loadingMore && loadedKey === requestKey;
	const title = query ? `${t("searchResults")} · ${query}` : t("search");

	return (
		<main className="min-h-screen px-4 pb-24 pt-28 sm:px-6 md:px-8 md:pt-24">
			<div className="mx-auto max-w-4xl">
				<h1 className="sr-only">{title}</h1>
				{!loading && !error && (
					<div
						role="tablist"
						aria-label={t("search")}
						className="mb-7 flex gap-2 overflow-x-auto pb-1"
					>
						{filterOptions.map((filter) => (
							<button
								key={filter}
								type="button"
								role="tab"
								aria-selected={activeFilter === filter}
								aria-label={`${t(FILTER_LABEL_KEYS[filter])} ${facets[filter]}`}
								onClick={() => setSelectedFilter(filter)}
								className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 ${
									activeFilter === filter
										? "border-white bg-white text-black"
										: "border-white/10 bg-white/[0.025] text-white/55 hover:border-white/25 hover:text-white"
								}`}
							>
								<span>{t(FILTER_LABEL_KEYS[filter])}</span>
								<span
									className={activeFilter === filter ? "text-black/60" : "text-white/30"}
								>
									{facets[filter]}
								</span>
							</button>
						))}
					</div>
				)}

				{error ? (
					<ErrorPanel message={t("searchLoadFailed")} onRetry={retry} />
				) : loading ? (
					<SearchResultsSkeleton />
				) : items.length === 0 ? (
					<div className="border-t border-white/[0.08] px-6 py-20 text-center">
						<h2 className="text-lg font-semibold text-white/80">
							{t("noSearchResults")}
						</h2>
						<p className="mt-2 text-sm text-white/30">{t("searchPlaceholder")}</p>
					</div>
				) : (
					<>
						{featured && (
							<SearchFeatured item={featured.item} image={featured.image} t={t} />
						)}
						<div className={featured ? "mt-5" : ""}>
							{visibleItems.map((item) => (
								<SearchResultRow key={item.Id} item={item} locale={locale} t={t} />
							))}
						</div>
						{items.length < total && (
							<>
								<div ref={loadMoreSentinelRef} aria-hidden="true" className="h-px" />
								{showLoadingMore && (
									<div className="py-8 text-center" aria-live="polite">
										<span className="text-xs uppercase tracking-widest text-white/35">
											{t("loadingMore")}
										</span>
									</div>
								)}
								{loadMoreError && (
									<div className="mt-5">
										<ErrorPanel message={t("searchLoadFailed")} onRetry={loadMore} />
									</div>
								)}
							</>
						)}
					</>
				)}
			</div>
		</main>
	);
}

function SearchFeatured({
	item,
	image,
	t,
}: {
	item: MediaItem;
	image: NonNullable<ReturnType<typeof landscapeImage>>;
	t: ReturnType<typeof useI18n>["t"];
}) {
	return (
		<Link
			href={searchItemHref(item)}
			aria-label={item.Name}
			data-testid="search-featured"
			className="group relative isolate block aspect-[3/1] min-h-64 overflow-hidden rounded-xl bg-[var(--c-card-thumb)]"
		>
			<BlurHashImage
				image={image}
				alt={item.Name}
				sizes="(max-width: 896px) calc(100vw - 2rem), 896px"
				className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
			/>
			<div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-black/20" />
			<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
			<div className="absolute inset-x-5 bottom-5 sm:inset-x-6 sm:bottom-6">
				<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
					{searchItemLabel(item, t)}
				</p>
				<h2 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-3xl">
					{item.Name}
				</h2>
				{releaseYear(item) && (
					<p className="mt-1 text-xs text-white/45">{releaseYear(item)}</p>
				)}
			</div>
		</Link>
	);
}

function SearchResultRow({
	item,
	locale,
	t,
}: {
	item: MediaItem;
	locale: Locale;
	t: ReturnType<typeof useI18n>["t"];
}) {
	const image = rowImage(item);
	const posterArtwork = isPosterResult(item);
	const secondary = rowSecondary(item);
	const metadata = [releaseYear(item), runtimeLabel(item, locale)].filter(
		Boolean,
	);
	return (
		<article
			data-testid="search-result-row"
			className="border-t border-white/[0.08]"
		>
			<Link
				href={searchItemHref(item)}
				aria-label={item.Name}
				className={`group flex items-center gap-3 py-3 transition hover:bg-white/[0.025] sm:gap-4 sm:px-2 ${posterArtwork ? "min-h-[96px] sm:min-h-[108px]" : "min-h-[76px]"}`}
			>
				<div
					data-testid="search-result-artwork"
					className={`relative shrink-0 overflow-hidden rounded-md bg-[var(--c-card-thumb)] ${posterArtwork ? "aspect-[2/3] w-12 sm:w-14" : "aspect-square w-12 sm:w-14"}`}
				>
					{image ? (
						<BlurHashImage
							image={image}
							alt=""
							sizes="(max-width: 639px) 48px, 56px"
							className="h-full w-full object-cover"
						/>
					) : (
						<MediaPlaceholder />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-sm font-semibold text-white/90 transition group-hover:text-white">
						{item.Name}
					</h2>
					{secondary && (
						<p className="mt-0.5 truncate text-xs text-white/40">{secondary}</p>
					)}
					<div className="mt-1.5 flex min-w-0 items-center gap-2 text-[10px] text-white/30">
						<span className="shrink-0 rounded bg-white/[0.08] px-1.5 py-0.5 font-semibold text-white/55">
							{searchItemLabel(item, t)}
						</span>
						{metadata.map((value) => (
							<span key={value} className="truncate">
								{value}
							</span>
						))}
					</div>
				</div>
			</Link>
		</article>
	);
}

function SearchResultsSkeleton() {
	return (
		<div className="animate-pulse">
			<div className="mb-7 flex gap-2">
				{Array.from({ length: 4 }, (_, index) => (
					<div key={index} className="h-8 w-20 rounded-full bg-white/[0.06]" />
				))}
			</div>
			{Array.from({ length: 6 }, (_, index) => (
				<div
					key={index}
					className="flex min-h-[76px] items-center gap-4 border-t border-white/[0.08] py-3"
				>
					<div className="h-14 w-[88px] shrink-0 rounded-md bg-white/[0.06]" />
					<div className="min-w-0 flex-1">
						<div className="h-3 w-2/5 rounded bg-white/[0.06]" />
						<div className="mt-2 h-2.5 w-1/4 rounded bg-white/[0.04]" />
						<div className="mt-2 h-4 w-20 rounded bg-white/[0.04]" />
					</div>
				</div>
			))}
		</div>
	);
}

function findFeaturedItem(items: MediaItem[]) {
	for (const item of items) {
		if (item.Type !== "Movie" && item.Type !== "Series" && item.Type !== "BoxSet")
			continue;
		const image = landscapeImage(item);
		if (image) return { item, image };
	}
	return null;
}

function rowImage(item: MediaItem) {
	return posterImage(item);
}

function isPosterResult(item: MediaItem) {
	return (
		item.Type === "Movie" || item.Type === "Series" || item.Type === "BoxSet"
	);
}

function rowSecondary(item: MediaItem) {
	if (item.Type === "MusicArtist") {
		return item.Genres?.slice(0, 2).join(" · ") || undefined;
	}
	if (item.Type === "MusicAlbum") {
		return item.AlbumArtist || item.Artists?.join(" · ") || undefined;
	}
	if (item.Type === "Audio") {
		return (
			[item.AlbumArtist, item.Album].filter(Boolean).join(" · ") || undefined
		);
	}
	return item.SeriesName || undefined;
}

function searchItemLabel(item: MediaItem, t: ReturnType<typeof useI18n>["t"]) {
	const filter = filterForItem(item);
	return t(FILTER_LABEL_KEYS[filter]);
}

function filterForItem(item: MediaItem): SearchFilter {
	if (item.Type === "Movie") return "movie";
	if (item.Type === "Series") return "series";
	if (item.Type === "BoxSet") return "collection";
	if (item.Type === "MusicAlbum") return "release";
	if (item.Type === "MusicArtist") return "artist";
	return "track";
}

function searchItemHref(item: MediaItem) {
	if (item.Type === "BoxSet")
		return `/collection/${encodeURIComponent(item.Id)}`;
	if (item.Type === "MusicArtist")
		return `/artist/${encodeURIComponent(item.Id)}`;
	if (item.Type === "MusicAlbum") return `/album/${encodeURIComponent(item.Id)}`;
	if (item.Type === "Audio") {
		const albumId = item.AlbumId ?? item.Id;
		const track = item.AlbumId ? `?trackId=${encodeURIComponent(item.Id)}` : "";
		return `/album/${encodeURIComponent(albumId)}${track}`;
	}
	return `/show/${encodeURIComponent(item.Id)}`;
}

function uniqueItems(items: MediaItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}
