"use client";

import Link from "next/link";
import { Check, Play } from "lucide-react";
import {
	landscapeImage,
	seriesPosterImage,
	type JellyfinItem,
} from "@/lib/jellyfin";
import { progressPercent, subtitle } from "@/lib/media";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";

export function WideCard({ item }: { item: JellyfinItem }) {
	const image = landscapeImage(item);
	const progress = progressPercent(item);

	return (
		<article className="group/card w-[320px] shrink-0 cursor-pointer select-none">
			<Link href={detailHref(item)} draggable={false} className="block">
			<div className="relative aspect-video overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
				{image && (
					<BlurHashImage
						image={image}
						alt={item.Name}
						draggable={false}
						className={`brightness-[0.82] ${MEDIA_CARD_IMAGE_CLASS}`}
					/>
				)}
				<WatchProgress progress={progress} />
				<WatchedIndicator item={item} />
				<MediaCardOverlay />
			</div>
			<CardText item={item} />
			</Link>
		</article>
	);
}

export function PosterCard({ item }: { item: JellyfinItem }) {
	const image = seriesPosterImage(item);

	return (
		<article className="group/card w-[200px] shrink-0 cursor-pointer select-none">
			<Link href={detailHref(item)} draggable={false} className="block">
			<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
				{image && (
					<BlurHashImage
						image={image}
						alt={item.Name}
						draggable={false}
						className={`brightness-[0.85] ${MEDIA_CARD_IMAGE_CLASS}`}
					/>
				)}
				<MediaCardOverlay />
				<WatchedIndicator item={item} />
			</div>
			<CardText item={item} />
			</Link>
		</article>
	);
}

export function StackedPosterCard({ items }: { items: JellyfinItem[] }) {
	const item = items[0];
	const stacked = items.length > 1;
	const image = seriesPosterImage(item);

	return (
		<article className="group/card w-[200px] shrink-0 cursor-pointer select-none">
			<Link href={detailHref(item)} draggable={false} className="block">
				<div className="relative">
					{stacked && <>
						<div className="absolute inset-x-3 -top-2 bottom-2 rounded-sm bg-white/10" />
						<div className="absolute inset-x-1.5 -top-1 bottom-1 rounded-sm bg-white/15" />
					</>}
					<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
						{image && <BlurHashImage image={image} alt={stacked ? item.SeriesName ?? item.Name : item.Name} draggable={false} className={`brightness-[0.85] ${MEDIA_CARD_IMAGE_CLASS}`} />}
						{stacked && <span className={`absolute right-2 top-2 ${MEDIA_CARD_TAG_CLASS}`}>{items.length} EP</span>}
						<WatchedIndicator item={item} unwatchedCount={items.filter((episode) => !episode.UserData?.Played).length} />
						<MediaCardOverlay />
					</div>
				</div>
				<div className="mt-2">
					<p className="truncate text-xs font-medium text-white/80">{stacked ? item.SeriesName ?? item.Name : item.Name}</p>
					<p className="mt-0.5 truncate text-xs text-white/30">{stacked ? item.ProductionYear ?? item.Type : subtitle(item)}</p>
				</div>
			</Link>
		</article>
	);
}

function detailHref(item: JellyfinItem) {
	return item.Type === "Episode" && item.SeriesId
		? `/show/${item.SeriesId}/episode/${item.Id}`
		: `/show/${item.Id}`;
}

export const MEDIA_CARD_IMAGE_CLASS =
	"h-full w-full object-cover transition group-hover/card:brightness-50";

export const MEDIA_CARD_TAG_CLASS =
	"rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/75 backdrop-blur-sm";

export function MediaCardOverlay() {
	return (
		<div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/card:bg-black/15 group-hover/card:opacity-100">
			<span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15 backdrop-blur">
				<Play className="ml-0.5 h-4 w-4 fill-white text-white" />
			</span>
		</div>
	);
}

export function WatchedIndicator({ item, unwatchedCount }: { item: JellyfinItem; unwatchedCount?: number }) {
	const { t } = useI18n();
	const count = item.Type === "Series" ? (unwatchedCount ?? item.UserData?.UnplayedItemCount) : undefined;
	const watched = item.Type !== "Series" && item.UserData?.Played === true;
	if (!watched && count == null) return null;
	const allWatched = item.Type === "Series" ? count === 0 : watched;
	return <div aria-label={allWatched ? t("allEpisodesWatched") : `${count} ${t("unwatchedEpisodes")}`} className={`absolute right-2 top-2 flex items-center gap-1 ${MEDIA_CARD_TAG_CLASS}`}>
		{allWatched ? <Check aria-hidden="true" className="h-3 w-3 text-emerald-300/80" /> : <>{count} {t("unwatchedEpisodes")}</>}
	</div>;
}

export function WatchProgress({ progress }: { progress: number | undefined }) {
	if (progress == null) {
		return null;
	}

	return (
		<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
			<div
				className="h-full bg-gradient-to-r from-violet-700 to-violet-300"
				style={{ width: `${progress}%` }}
			/>
		</div>
	);
}

function CardText({ item }: { item: JellyfinItem }) {
	return (
		<div className="mt-2">
			<p className="truncate text-xs font-medium text-white/80">{item.Name}</p>
			<p className="mt-0.5 truncate text-xs text-white/30">{subtitle(item)}</p>
		</div>
	);
}
