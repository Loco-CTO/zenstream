"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { PosterCard } from "@/components/home/media-card";
import { ErrorPanel } from "@/components/status/error-panel";
import { getSearchItems, type JellyfinItem } from "@/lib/jellyfin";
import { useI18n } from "@/lib/i18n";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import type { AuthSession } from "@/lib/session";

export function SearchPage({ session, query }: { session: AuthSession; query: string }) {
	const { t } = useI18n();
	const [items, setItems] = useState<JellyfinItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retryKey, setRetryKey] = useState(0);
	const [sortBy, setSortBy] = useState("SortName");
	const [sortOrder, setSortOrder] = useState<"Ascending" | "Descending">("Ascending");

	useEffect(() => {
		const controller = new AbortController();
		getSearchItems(session, query, { sortBy, sortOrder, signal: controller.signal })
			.then(setItems)
			.catch(() => { if (!controller.signal.aborted) setError(true); })
			.finally(() => { if (!controller.signal.aborted) setLoading(false); });
		return () => controller.abort();
	}, [query, retryKey, session, sortBy, sortOrder]);

	const sortOptions: DropdownOption[] = [
		{ value: "SortName", label: t("sortTitle") },
		{ value: "CommunityRating", label: t("sortRating") },
		{ value: "DateCreated", label: t("sortDateAdded") },
		{ value: "PremiereDate", label: t("sortReleaseDate") },
		{ value: "ProductionYear", label: t("sortYear") },
	];

	const title = query ? `${t("searchResults")} · ${query}` : t("search");
	return <main className="min-h-screen px-5 pb-24 pt-24 sm:px-8 md:px-12 md:pb-10 md:pt-28">
		<div className="mx-auto max-w-[1800px]">
			<header className="mb-8 flex items-end justify-between gap-5 border-b border-white/[0.07] pb-5">
				<div className="min-w-0">
					<div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-violet-300/65"><Search className="h-3.5 w-3.5" />{t("search")}</div>
					<h1 className="truncate text-3xl font-black leading-none tracking-tight text-white md:text-4xl">{title}</h1>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{!loading && !error && <p className="hidden pb-0.5 text-xs uppercase tracking-widest text-white/25 sm:block">{t("items", { count: items.length })}</p>}
					<button type="button" aria-label={sortOrder === "Ascending" ? t("sortAscending") : t("sortDescending")} onClick={() => setSortOrder((order) => order === "Ascending" ? "Descending" : "Ascending")} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/45 transition hover:border-white/20 hover:text-white">{sortOrder === "Ascending" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}</button>
					<Dropdown aria-label={t("sortBy")} value={sortBy} options={sortOptions} onChange={setSortBy} className="min-w-32 rounded-full py-1.5 uppercase tracking-wider" />
				</div>
			</header>
			{error ? <ErrorPanel message={t("searchLoadFailed")} onRetry={() => setRetryKey((value) => value + 1)} /> : loading ? <SearchGridSkeleton /> : items.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-6 py-20 text-center shadow-2xl shadow-black/20"><h2 className="text-lg font-semibold text-white/80">{t("noSearchResults")}</h2><p className="mt-2 text-sm text-white/30">{t("searchPlaceholder")}</p></div> : <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7 [&>article]:w-full">{items.map((item) => <PosterCard key={item.Id} item={item} />)}</div>}
		</div>
	</main>;
}

function SearchGridSkeleton() {
	return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 md:grid-cols-5 lg:grid-cols-6 2xl:grid-cols-7">{Array.from({ length: 14 }, (_, index) => <div key={index} className="animate-pulse"><div className="aspect-[2/3] rounded-sm bg-white/[0.06]" /><div className="mt-3 h-3 w-4/5 rounded bg-white/[0.06]" /><div className="mt-2 h-2.5 w-2/5 rounded bg-white/[0.04]" /></div>)}</div>;
}
