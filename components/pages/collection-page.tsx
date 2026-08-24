"use client";
import Link from "next/link";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { posterImage, type DetailData, type MediaItem } from "@/lib/media-api";
import { progressPercent } from "@/lib/media";
import { WatchedIndicator, WatchProgress } from "@/components/home/media-card";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

export function CollectionPage({
	initialData,
	session: _session,
}: {
	initialData: DetailData;
	session: AuthSession;
}) {
	void _session;
	const { t } = useI18n();
	const items = initialData.collectionItems ?? [];
	return (
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8">
			<h1 className="text-3xl font-black tracking-tight text-white">
				{initialData.item.Name}
			</h1>
			<p className="mt-1 text-xs uppercase tracking-widest text-white/25">
				{t("collectionItems", { count: items.length })}
			</p>
			{items.length === 0 ? (
				<div className="mt-8 rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center text-white/40">
					{t("collectionEmpty")}
				</div>
			) : (
				<div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
					{items.map((item) => (
						<CollectionCard key={item.Id} item={item} />
					))}
				</div>
			)}
		</main>
	);
}
function CollectionCard({ item }: { item: MediaItem }) {
	const image = posterImage(item);
	return (
		<article className="min-w-0">
			<Link href={`/show/${item.Id}`} className="block">
				<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
					{image && (
						<BlurHashImage
							image={image}
							alt={item.Name}
							sizes="(max-width: 639px) 148px, (max-width: 767px) 180px, 200px"
							loading="lazy"
							decoding="async"
							className="h-full w-full object-cover transition hover:brightness-50"
						/>
					)}
					{!image && <MediaPlaceholder />}
					<WatchProgress progress={progressPercent(item)} />
					<WatchedIndicator item={item} />
				</div>
				<p className="mt-2 truncate text-xs font-medium text-white/80">
					{item.Name}
				</p>
				<p className="mt-0.5 truncate text-xs text-white/30">
					{item.ProductionYear ?? item.Type}
				</p>
			</Link>
		</article>
	);
}
