"use client";

import Image from "next/image";
import type { HomeData } from "@/lib/media-api";
import { pickHeroItem } from "@/lib/media";
import {
	getHomeCarouselSections,
	visibleHomeSections,
} from "@/lib/home-layout";
import { Hero } from "@/components/home/hero";
import { MediaRow } from "@/components/home/media-row";
import { useI18n } from "@/lib/i18n";
import { useHomeLayoutPreferences } from "@/components/home-layout-preferences-provider";
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
	const { preference } = useHomeLayoutPreferences();
	const videoLatestItems = (data.latestItems ?? []).filter(
		(item) => !isAudioItem(item),
	);
	const hero = pickHeroItem({ ...data, latestItems: videoLatestItems });
	const heroItems =
		videoLatestItems.length > 0 ? videoLatestItems : hero ? [hero] : [];
	const sections = visibleHomeSections(
		getHomeCarouselSections(data),
		preference,
	);

	return (
		<main className="pb-24 md:pb-0">
			<Hero items={heroItems} session={session} />
			<div className="relative z-10 mt-[-1.5rem] space-y-1">
				{sections.map((section) => (
					<MediaRow
						key={section.id}
						title={
							section.title ??
							(section.titleKey ? t(section.titleKey, section.titleValues) : "")
						}
						items={section.items}
						variant={section.variant ?? "poster"}
						stackEpisodes={section.stackEpisodes}
						session={session}
						viewAllHref={section.viewAllHref}
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
	return (
		item.Type === "MusicArtist" ||
		item.Type === "MusicAlbum" ||
		item.Type === "Audio"
	);
}
