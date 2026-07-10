"use client";

import type { HomeData } from "@/lib/jellyfin";
import { HOME_ROWS, pickHeroItem } from "@/lib/media";
import { Hero } from "@/components/home/hero";
import { MediaRow } from "@/components/home/media-row";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

export function HomePage({ data, session }: { data: HomeData; session: AuthSession }) {
	const { t } = useI18n();
	const hero = pickHeroItem(data);
	const heroItems =
		data.latestItems.length > 0 ? data.latestItems : hero ? [hero] : [];

	return (
		<main className="pb-24 md:pb-0">
			<Hero items={heroItems} session={session} />
			<div className="relative z-10 mt-[-1.5rem] space-y-1">
				{data.newlyAdded.map((section) => (
					<MediaRow
						key={section.libraryId}
						title={t("newlyAddedOn", { library: section.libraryName })}
						items={section.items}
						variant="poster"
						stackEpisodes
						session={session}
					/>
				))}
				{HOME_ROWS.map((row) => (
					<MediaRow
						key={row.key}
						title={t(row.titleKey)}
						items={data[row.key]}
						variant={row.variant}
						session={session}
					/>
				))}
			</div>
			<footer className="mt-2 border-t border-white/5 px-10 py-5">
				<div className="flex items-center gap-2">
					<img
						src="/icon.png"
						alt=""
						className="h-4 w-4 object-contain opacity-50"
					/>
					<span className="text-xs text-white/25">ZenStream</span>
				</div>
			</footer>
		</main>
	);
}
