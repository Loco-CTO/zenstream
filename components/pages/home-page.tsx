"use client";

import Image from "next/image";
import type { HomeData } from "@/lib/media-api";
import { HOME_ROWS, pickHeroItem } from "@/lib/media";
import { Hero } from "@/components/home/hero";
import { MediaRow } from "@/components/home/media-row";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { zenstreamVersion } from "@/lib/version";

export function HomePage({
	data,
	session,
}: {
	data: Partial<HomeData>;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const videoLatestItems = uniqueItems(
		(data.latestItems ?? []).filter((item) => !isAudioItem(item)),
	);
	const hero = pickHeroItem({ ...data, latestItems: videoLatestItems });
	const heroItems =
		videoLatestItems.length > 0
			? videoLatestItems
			: hero
				? [hero]
				: [];
	const audioRows = (data.audioRows ?? [])
		.map((section) => ({ ...section, items: uniqueItems(section.items).filter(isAudioItem) }))
		.filter((section) => section.items.length > 0);
	const mixedFavorites = uniqueItems(data.myList ?? []);
	const audioFavorites = mixedFavorites.filter(isAudioItem);
	const videoFavorites = mixedFavorites.filter((item) => !isAudioItem(item));
	const canonicalLibraryRows = (data.libraryRows ?? []).filter(
		(section) =>
			(section.titleKey === "newlyAddedOn" || section.titleKey === "topRated") &&
			section.items.length > 0,
	);
	const canonicalNewlyAdded = canonicalLibraryRows.filter(
		(section) => section.titleKey === "newlyAddedOn",
	);
	const legacyNewlyAdded =
		canonicalNewlyAdded.length === 0
			? (data.newlyAdded ?? [])
					.filter((section) => section.items.length > 0)
					.map((section) => ({
						...section,
						titleKey: "newlyAddedOn" as const,
						stackEpisodes: false,
					}))
			: [];
	const libraryRows = [
		...canonicalNewlyAdded,
		...legacyNewlyAdded,
		...canonicalLibraryRows.filter((section) => section.titleKey === "topRated"),
	];

	return (
		<main className="pb-24 md:pb-0">
			<Hero items={heroItems} session={session} />
			<div className="relative z-10 mt-[-1.5rem] space-y-1">
				{audioRows.map((section) => (
					<MediaRow
						key={`audio:${section.key}`}
						title={t(section.titleKey as Parameters<typeof t>[0])}
						items={section.items}
						variant="square"
						session={session}
					/>
				))}
				{HOME_ROWS.slice(0, 2).map((row) => (
					<MediaRow
						key={row.key}
						title={t(row.titleKey)}
						items={uniqueItems(data[row.key] ?? [])}
						variant={row.variant}
						session={session}
					/>
				))}
				{libraryRows.map((section) => (
					<MediaRow
						key={`${section.libraryId}:${section.titleKey}`}
						title={t(
							section.titleKey === "topRated" ? "topRatedOn" : "newlyAddedOn",
							{ library: section.libraryName },
						)}
						items={uniqueItems(section.items)}
						variant="poster"
						stackEpisodes={section.stackEpisodes}
						session={session}
						viewAllHref={undefined}
					/>
				))}
				<MediaRow
					title={t("myList")}
					items={videoFavorites}
					variant="poster"
					session={session}
						viewAllHref="/favorites"
				/>
				{audioFavorites.length > 0 && (
					<MediaRow
						title={t("favoriteAudio")}
						items={audioFavorites}
						variant="square"
						session={session}
						viewAllHref="/favorites"
					/>
				)}
				{(data.genreRows ?? []).map((section) => (
					<MediaRow
						key={`genre:${section.genre}`}
						title={section.genre}
						items={uniqueItems(section.items)}
						variant="poster"
						session={session}
					/>
				))}
			</div>
			<footer className="mt-2 border-t border-white/5 px-5 py-5 sm:px-10">
				<div className="flex items-center gap-2">
					<Image
						src="/icon.png"
						alt=""
						width={16}
						height={16}
						className="h-4 w-4 object-contain opacity-50"
					/>
					<span className="text-xs text-white/25">ZenStream {zenstreamVersion}</span>
				</div>
			</footer>
		</main>
	);
}

function isAudioItem(item: { Type?: string }) {
	return item.Type === "MusicArtist" || item.Type === "MusicAlbum" || item.Type === "Audio";
}

function uniqueItems<T extends { Id: string }>(items: T[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}
