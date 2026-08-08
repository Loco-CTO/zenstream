"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { PosterCard } from "@/components/home/media-card";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { getSearchItems, type MediaItem } from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

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
	const [loadedKey, setLoadedKey] = useState<string | null>(null);
	const [errorKey, setErrorKey] = useState<string | null>(null);
	const [retryKey, setRetryKey] = useState(0);
	const requestKey = `${query}:${retryKey}`;
	const loading = loadedKey !== requestKey;
	const error = errorKey === requestKey;

	useEffect(() => {
		const controller = new AbortController();
		const finish = start();
		getSearchItems(session, query, { signal: controller.signal })
			.then((results) => {
				if (controller.signal.aborted) return;
				setItems(rankSearchResults(results, query));
				setErrorKey(null);
				setLoadedKey(requestKey);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setErrorKey(requestKey);
					setLoadedKey(requestKey);
				}
			});
		return () => {
			controller.abort();
			finish();
		};
	}, [query, requestKey, session, start]);

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
						<div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-300/65">
							<Search className="h-3.5 w-3.5" />
							{t("search")}
						</div>
						<h1 className="max-w-full break-words text-3xl font-black leading-none tracking-tight text-white md:text-4xl">
							{title}
						</h1>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{!loading && !error && (
							<p className="hidden pb-0.5 text-xs uppercase tracking-widest text-white/25 sm:block">
								{t("items", { count: items.length })}
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
						<p className="mt-2 text-sm text-white/30">
							{t("searchPlaceholder")}
						</p>
					</div>
				) : (
					<div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7 [&>article]:w-full">
						{items.map((item) => (
							<PosterCard key={item.Id} item={item} session={session} />
						))}
					</div>
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

