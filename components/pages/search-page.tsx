"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from "react";
import { PosterCard } from "@/components/home/media-card";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { getSearchPage, type MediaItem } from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

const SEARCH_PAGE_SIZE = 20;

export function SearchPage({
	session,
	query,
}: {
	session: AuthSession;
	query: string;
}) {
	const { t } = useI18n();
	const { start } = useProgress();
	const [items, setItems] = useState<MediaItem[]>([]);
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
	const requestKey = `${query}:${retryKey}`;
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
		setItems([]);
		setTotal(0);
		setLoadingMore(false);
		setLoadMoreError(false);
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
			signal: controller.signal,
		})
			.then((page) => {
				if (
					controller.signal.aborted ||
					requestGenerationRef.current !== requestGeneration
				)
					return;
				const nextItems = uniqueItems(rankSearchResults(page.items, query));
				itemsRef.current = nextItems;
				totalRef.current = page.total;
				setItems(nextItems);
				setTotal(page.total);
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
	}, [query, requestKey, session, start]);

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
				signal: controller.signal,
			});
			if (
				controller.signal.aborted ||
				requestGenerationRef.current !== requestGeneration
			)
				return;
			const nextItems = uniqueItems([
				...itemsRef.current,
				...rankSearchResults(page.items, query),
			]);
			itemsRef.current = nextItems;
			totalRef.current = page.total;
			setItems(nextItems);
			setTotal(page.total);
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
	}, [error, loading, query, session, start]);

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
		const refresh = () => setRetryKey((value) => value + 1);
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, []);

	const title = query ? `${t("searchResults")} · ${query}` : t("search");
	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-8 md:px-12 md:pb-10 md:pt-28">
			<div className="mx-auto max-w-[1800px]">
				<header className="mb-8 flex flex-col items-start gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h1 className="max-w-full break-words text-3xl font-black leading-none tracking-tight text-white md:text-4xl">
							{title}
						</h1>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{!loading && !error && (
							<p className="pb-0.5 text-xs uppercase tracking-widest text-white/25">
								{t("items", { count: total })}
							</p>
						)}
					</div>
				</header>
				{error ? (
					<ErrorPanel
						message={t("searchLoadFailed")}
						onRetry={() => setRetryKey((value) => value + 1)}
					/>
				) : loading ? (
					<SearchGridSkeleton />
				) : items.length === 0 ? (
					<div className="rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-20 text-center shadow-2xl shadow-black/20">
						<h2 className="text-lg font-semibold text-white/80">
							{t("noSearchResults")}
						</h2>
						<p className="mt-2 text-sm text-white/30">{t("searchPlaceholder")}</p>
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7 [&>article]:w-full">
							{items.map((item) => (
								<PosterCard key={item.Id} item={item} session={session} />
							))}
						</div>
						{items.length < total && (
							<>
								<div
									ref={loadMoreSentinelRef}
									aria-hidden="true"
									className="h-px"
								/>
								{loadingMore && (
									<div className="py-8 text-center" aria-live="polite">
										<span className="text-xs uppercase tracking-widest text-white/35">
											{t("loadingMore")}
										</span>
									</div>
								)}
								{loadMoreError && (
									<div className="mt-5">
										<ErrorPanel
											message={t("searchLoadFailed")}
											onRetry={loadMore}
										/>
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

function rankSearchResults(items: MediaItem[], query: string) {
	const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	const normalizedQuery = terms.join(" ");
	return items
		.map((item, index) => {
			const title = item.Name.trim().toLocaleLowerCase();
			const words = title.split(/\s+/);
			const score =
				title === normalizedQuery
					? 1000
					: title.startsWith(normalizedQuery)
						? 700
						: terms.every((term) => words.some((word) => word.startsWith(term)))
							? 500
							: terms.every((term) => title.includes(term))
								? 300
								: terms.reduce(
										(total, term) => total + (title.includes(term) ? 1 : 0),
										0,
									) * 50;
			return { item, index, score };
		})
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ item }) => item);
}

function uniqueItems(items: MediaItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}

function SearchGridSkeleton() {
	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7">
			{Array.from({ length: 14 }, (_, index) => (
				<div key={index} className="animate-pulse">
					<div className="aspect-[2/3] rounded-sm bg-white/[0.06]" />
					<div className="mt-3 h-3 w-4/5 rounded bg-white/[0.06]" />
					<div className="mt-2 h-2.5 w-2/5 rounded bg-white/[0.04]" />
				</div>
			))}
		</div>
	);
}
