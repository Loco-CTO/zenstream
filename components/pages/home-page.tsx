"use client";

import type { HomeData } from "@/lib/media-api";
import { HOME_ROWS, pickHeroItem } from "@/lib/media";
import { Hero } from "@/components/home/hero";
import { MediaRow } from "@/components/home/media-row";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { zenstreamVersion } from "@/lib/version";

export function libraryHref(options: {
	libraryId?: string;
	sortBy: string;
	sortOrder: string;
}) {
	const params = new URLSearchParams();
	if (options.libraryId) params.set("libraryId", options.libraryId);
	params.set("sortBy", options.sortBy);
	params.set("sortOrder", options.sortOrder.toLowerCase());
	return `/library?${params.toString()}`;
}

export function HomePage({
	data,
	session,
}: {
	data: Partial<HomeData>;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const hero = pickHeroItem(data);
	const heroItems =
		(data.latestItems?.length ?? 0) > 0
			? (data.latestItems ?? [])
			: hero
				? [hero]
				: [];
	const libraryRows = [
		...(data.libraryRows ?? []).filter(
			(section) => section.titleKey === "newlyAddedOn" && section.items.length > 0,
		),
	];

	return (
		<main className="pb-24 md:pb-0">
			<Hero items={heroItems} session={session} />
			<div className="relative z-10 mt-[-1.5rem] space-y-1">
				{HOME_ROWS.slice(0, 2).map((row) => (
					<MediaRow
						key={row.key}
						title={t(row.titleKey)}
						items={data[row.key] ?? []}
						variant={row.variant}
						session={session}
					/>
				))}
				{libraryRows.map((section) => (
					<MediaRow
						key={`${section.libraryId}:${section.titleKey}`}
						title={t("newlyAddedOn", { library: section.libraryName })}
						items={section.items}
						variant="poster"
						stackEpisodes={section.stackEpisodes}
						session={session}
						viewAllHref={undefined}
					/>
				))}
				<MediaRow
					title={t("myList")}
					items={data.myList ?? []}
					variant="poster"
					session={session}
					viewAllHref="/favorites"
				/>
				{(data.genreRows ?? []).map((section) => (
					<MediaRow
						key={`genre:${section.genre}`}
						title={section.genre}
						items={section.items}
						variant="poster"
						session={session}
					/>
				))}
			</div>
			<footer className="mt-2 border-t border-white/5 px-5 py-5 sm:px-10">
				<div className="flex items-center gap-2">
					<img
						src="/icon.png"
						alt=""
						className="h-4 w-4 object-contain opacity-50"
					/>
					<span className="text-xs text-white/25">ZenStream {zenstreamVersion}</span>
				</div>
			</footer>
		</main>
	);
}
