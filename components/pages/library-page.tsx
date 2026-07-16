"use client";

import Link from "next/link";
import {
	ArrowDown,
	ArrowUp,
	Star,
} from "lucide-react";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	MediaCardOverlay,
	MEDIA_CARD_IMAGE_CLASS,
	WatchedIndicator,
} from "@/components/home/media-card";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import {
	getLibraryItems,
	getLibraryViews,
	posterImage,
	type LibrarySortBy,
	type LibraryView,
	type JellyfinItem,
} from "@/lib/jellyfin";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useSortPreference } from "@/lib/sort-preferences";

const PAGE_SIZE = 40;
const CARD_MIN_WIDTH = 200;
const MOBILE_CARD_MIN_WIDTH = 132;
const GRID_GAP = 12;
const CARD_TEXT_HEIGHT = 48;
const OVERSCAN_ROWS = 3;

const SORTS = [
	{ value: "CommunityRating", labelKey: "sortRating" },
	{ value: "SortName", labelKey: "sortTitle" },
	{ value: "DateCreated", labelKey: "sortDateAdded" },
	{ value: "DateLastContentAdded", labelKey: "sortLastAdded" },
	{ value: "PremiereDate", labelKey: "sortReleaseDate" },
	{ value: "ProductionYear", labelKey: "sortYear" },
	{ value: "CriticRating", labelKey: "sortCriticRating" },
	{ value: "Runtime", labelKey: "sortRuntime" },
	{ value: "DatePlayed", labelKey: "sortLastPlayed" },
	{ value: "PlayCount", labelKey: "sortPlayCount" },
] as const;

export function LibraryPage({ session }: { session: AuthSession }) {
	const { t } = useI18n();
	const { start } = useProgress();
	const [libraries, setLibraries] = useState<LibraryView[]>([]);
	const [libraryId, setLibraryId] = useState("");
	const [items, setItems] = useState<JellyfinItem[]>([]);
	const [loadedCount, setLoadedCount] = useState(0);
	const [total, setTotal] = useState(0);
	const [sort, setSort] = useSortPreference(`zenstream:sort:library:${libraryId}`, { sortBy: "CommunityRating" as LibrarySortBy, sortOrder: "Descending" }, SORTS.map((item) => item.value));
	const { sortBy, sortOrder } = sort;
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const requestRef = useRef<AbortController | null>(null);
	const loadingMoreRef = useRef(false);
	const loadedQueryRef = useRef("");
	const requestedOffsetsRef = useRef(new Set<number>());

	const activeLibrary = libraries.find((library) => library.Id === libraryId);

	const loadLibraries = useCallback(async () => {
		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		const finish = start();
		setLoading(true);
		setError(null);
		try {
			const nextLibraries = await getLibraryViews(session, controller.signal);
			if (controller.signal.aborted) return;
			setLibraries(nextLibraries);
			setLibraryId((current) =>
				nextLibraries.some((library) => library.Id === current)
					? current
					: nextLibraries[0]?.Id ?? "",
			);
			if (nextLibraries.length === 0) setLoading(false);
		} catch (nextError) {
			if (!controller.signal.aborted) {
				setError(nextError instanceof Error ? nextError.message : "Library request failed.");
				setLoading(false);
			}
		} finally {
			finish();
		}
	}, [session, start]);

	useEffect(() => {
		// Async hydration is intentionally owned by this route component.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void loadLibraries();
		return () => requestRef.current?.abort();
	}, [loadLibraries]);

	const loadFirstPage = useCallback(async (force = false) => {
		if (!activeLibrary) return;
		const queryKey = `${activeLibrary.Id}:${sortBy}:${sortOrder}`;
		if (!force && loadedQueryRef.current === queryKey) return;
		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		loadingMoreRef.current = false;
		requestedOffsetsRef.current = new Set([0]);
		const finish = start();
		setLoading(true);
		setItems([]);
		setLoadedCount(0);
		setTotal(0);
		setError(null);
		try {
			const page = await getLibraryItems(session, {
				parentId: activeLibrary.Id,
				collectionType: activeLibrary.CollectionType,
				startIndex: 0,
				limit: PAGE_SIZE,
				sortBy,
				sortOrder,
				signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			setItems(uniqueItems(page.items));
			setLoadedCount(page.items.length);
			setTotal(page.totalRecordCount);
			loadedQueryRef.current = queryKey;
		} catch (nextError) {
			if (!controller.signal.aborted) {
				setError(nextError instanceof Error ? nextError.message : "Library request failed.");
			}
		} finally {
			if (!controller.signal.aborted) setLoading(false);
			finish();
		}
	}, [activeLibrary, session, sortBy, sortOrder, start]);

	useEffect(() => {
		// A library or sort change replaces the current result set.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (activeLibrary) void loadFirstPage();
	}, [activeLibrary, loadFirstPage]);

	const loadMore = useCallback(async () => {
		if (
			!activeLibrary ||
			loading ||
			loadingMoreRef.current ||
			loadedCount >= total
		) return;
		const startIndex = loadedCount;
		if (requestedOffsetsRef.current.has(startIndex)) return;
		requestedOffsetsRef.current.add(startIndex);
		loadingMoreRef.current = true;
		setLoadingMore(true);
		const controller = new AbortController();
		requestRef.current = controller;
		const finish = start();
		try {
			const page = await getLibraryItems(session, {
				parentId: activeLibrary.Id,
				collectionType: activeLibrary.CollectionType,
				startIndex,
				limit: PAGE_SIZE,
				sortBy,
				sortOrder,
				signal: controller.signal,
			});
			if (controller.signal.aborted) return;
			setItems((current) => uniqueItems([...current, ...page.items]));
			setLoadedCount((current) => current + page.items.length);
			setTotal(page.totalRecordCount);
			setError(null);
		} catch (nextError) {
			requestedOffsetsRef.current.delete(startIndex);
			if (!controller.signal.aborted) {
				setError(nextError instanceof Error ? nextError.message : "Library request failed.");
			}
		} finally {
			loadingMoreRef.current = false;
			if (!controller.signal.aborted) setLoadingMore(false);
			finish();
		}
	}, [activeLibrary, loadedCount, loading, session, sortBy, sortOrder, start, total]);

	const sortOptions = useMemo<DropdownOption[]>(
		() => SORTS.map((sort) => ({ value: sort.value, label: t(sort.labelKey) })),
		[t],
	);

	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
			<div className="mb-8 flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/[0.035] p-1 sm:mb-10 sm:w-fit">
				{libraries.map((library) => (
					<button
						key={library.Id}
						type="button"
						onClick={() => setLibraryId(library.Id)}
						className={`shrink-0 rounded-lg px-5 py-2 text-sm font-semibold transition ${
							library.Id === libraryId
								? "bg-white/10 text-white shadow-lg shadow-black/30"
								: "text-white/30 hover:text-white/60"
						}`}
					>
						{library.Name}
					</button>
				))}
			</div>

			<div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-3xl font-black leading-none tracking-tight text-white">
						{activeLibrary?.Name ?? t("library")}
					</h1>
					<p className="mt-1 text-xs uppercase tracking-widest text-white/25">
						{t("libraryItems", { count: total })}
					</p>
				</div>
				<div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
					<button
						type="button"
						aria-label={sortOrder === "Ascending" ? t("sortAscending") : t("sortDescending")}
						onClick={() => setSort((value) => ({ ...value, sortOrder: value.sortOrder === "Ascending" ? "Descending" : "Ascending" }))}
						className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/45 transition hover:border-white/20 hover:text-white"
					>
						{sortOrder === "Ascending" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
					</button>
					<Dropdown
						aria-label={t("sortBy")}
						value={sortBy}
						options={sortOptions}
						onChange={(value) => setSort((current) => ({ ...current, sortBy: value as LibrarySortBy }))}
						className="w-full min-w-0 rounded-full py-1.5 uppercase tracking-wider sm:w-auto sm:min-w-36"
					/>
				</div>
			</div>

			{error && items.length === 0 ? (
				<ErrorPanel
					message={t("libraryLoadPageFailed")}
					onRetry={libraries.length ? () => loadFirstPage(true) : loadLibraries}
				/>
			) : !loading && libraries.length === 0 ? (
				<EmptyState title={t("noLibraries")} detail={t("noLibrariesHint")} />
			) : !loading && items.length === 0 ? (
				<EmptyState title={t("emptyLibrary")} detail={t("emptyLibraryHint")} />
			) : (
				<VirtualMediaGrid items={items} hasMore={loadedCount < total} onLoadMore={loadMore} session={session} />
			)}

			{error && items.length > 0 && (
				<div className="mt-5">
					<ErrorPanel message={t("libraryLoadMoreFailed")} onRetry={loadMore} />
				</div>
			)}
			{loadingMore && <p className="sr-only" aria-live="polite">{t("loadingMore")}</p>}
		</main>
	);
}

function VirtualMediaGrid({
	items,
	hasMore,
	onLoadMore,
	session,
}: {
	items: JellyfinItem[];
	hasMore: boolean;
	onLoadMore: () => void;
	session: AuthSession;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [width, setWidth] = useState(0);
	const [containerTop, setContainerTop] = useState(0);
	const [viewport, setViewport] = useState({ scrollY: 0, height: 900 });

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const measure = () => {
			setWidth(element.clientWidth);
			setContainerTop(element.getBoundingClientRect().top + window.scrollY);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		let frame = 0;
		const measureViewport = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() =>
				setViewport({ scrollY: window.scrollY, height: window.innerHeight }),
			);
		};
		measureViewport();
		window.addEventListener("scroll", measureViewport, { passive: true });
		window.addEventListener("resize", measureViewport);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", measureViewport);
			window.removeEventListener("resize", measureViewport);
		};
	}, []);

	const minCardWidth = width > 0 && width < 640 ? MOBILE_CARD_MIN_WIDTH : CARD_MIN_WIDTH;
	const columns = Math.max(1, Math.floor((width + GRID_GAP) / (minCardWidth + GRID_GAP)));
	const cardWidth = width > 0 ? (width - GRID_GAP * (columns - 1)) / columns : minCardWidth;
	const rowHeight = cardWidth * 1.5 + CARD_TEXT_HEIGHT + GRID_GAP;
	const rowCount = Math.ceil(items.length / columns);
	const relativeTop = Math.max(0, viewport.scrollY - containerTop);
	const startRow = Math.max(0, Math.floor(relativeTop / rowHeight) - OVERSCAN_ROWS);
	const endRow = Math.min(
		rowCount,
		Math.ceil((relativeTop + viewport.height) / rowHeight) + OVERSCAN_ROWS,
	);

	useEffect(() => {
		if (hasMore && endRow >= rowCount - 2) onLoadMore();
	}, [endRow, hasMore, onLoadMore, rowCount]);

	const rows = [];
	for (let row = startRow; row < endRow; row += 1) {
		const rowItems = items.slice(row * columns, row * columns + columns);
		rows.push(
			<div
				key={row}
				data-testid="virtual-grid-row"
				className="absolute left-0 right-0 grid gap-3"
				style={{
					top: row * rowHeight,
					gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
				}}
			>
				{rowItems.map((item) => <LibraryCard key={item.Id} item={item} session={session} />)}
			</div>,
		);
	}

	return (
		<div
			ref={containerRef}
			data-testid="virtual-media-grid"
			className="relative"
			style={{ height: rowCount * rowHeight }}
		>
			{rows}
		</div>
	);
}

function LibraryCard({ item, session }: { item: JellyfinItem; session: AuthSession }) {
	const image = posterImage(item);
	const href = item.Type === "BoxSet"
		? `/collection/${item.Id}`
		: item.Type === "Episode" && item.SeriesId
		? `/show/${item.SeriesId}/episode/${item.Id}`
		: `/show/${item.Id}`;
	return (
		<article className="group/card min-w-0 cursor-pointer select-none">
			<div className="relative">
			<Link href={href} className="block">
				<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
					{image && (
						<BlurHashImage
							image={image}
							alt={item.Name}
							loading="lazy"
							decoding="async"
							className={`brightness-[0.85] ${MEDIA_CARD_IMAGE_CLASS}`}
						/>
					)}
					{item.CommunityRating != null && (
						<div className="absolute bottom-2 left-2 flex items-center gap-1">
							<Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
							<span className="text-xs font-semibold text-white/80">{item.CommunityRating.toFixed(1)}</span>
						</div>
					)}
					<WatchedIndicator item={item} />
				</div>
				<p className="mt-2 truncate text-xs font-medium text-white/80">{item.Name}</p>
				<p className="mt-0.5 truncate text-xs text-white/30">{item.ProductionYear ?? item.Type}</p>
			</Link>
			<MediaCardOverlay href={href} title={item.Name} item={item} session={session} className="inset-x-0 top-0 aspect-[2/3]" />
			</div>
		</article>
	);
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center">
			<h2 className="text-lg font-semibold text-white/80">{title}</h2>
			<p className="mt-2 text-sm text-white/35">{detail}</p>
		</div>
	);
}

function uniqueItems(items: JellyfinItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}
