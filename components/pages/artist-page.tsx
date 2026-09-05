"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SquareAudioCard } from "@/components/home/media-card";
import type { ArtistData } from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

export function ArtistPage({
	data,
	session,
}: {
	data: ArtistData;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const albums = uniqueItems(data.albums);

	return (
		<main className="min-h-screen px-4 pb-32 pt-24 sm:px-8 md:px-12 md:pb-24 md:pt-28">
			<div className="mx-auto max-w-[1500px]">
				<Link href="/library" className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/35 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
					<ArrowLeft className="h-3.5 w-3.5" /> {t("musicLibrary")}
				</Link>
				<header className="mb-10 border-b border-white/[0.08] pb-7">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/75">{t("artist")}</p>
					<h1 className="mt-3 break-words text-4xl font-black tracking-tight text-white md:text-6xl">{data.artist.Name}</h1>
					<p className="mt-3 text-sm text-white/40">{albums.length} {t("albums").toLocaleLowerCase()}</p>
				</header>
				{albums.length === 0 ? (
					<div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-20 text-center text-sm text-white/45">{t("audioEmpty")}</div>
				) : (
					<section aria-labelledby="artist-albums-heading">
						<h2 id="artist-albums-heading" className="sr-only">{t("albums")}</h2>
						<div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
							{albums.map((album) => <SquareAudioCard key={album.Id} item={album} session={session} />)}
						</div>
					</section>
				)}
			</div>
		</main>
	);
}

function uniqueItems<T extends { Id: string }>(items: T[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}
