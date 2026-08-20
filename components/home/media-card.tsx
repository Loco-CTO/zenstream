"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Check, Play } from "lucide-react";
import {
	landscapeImage,
	seriesPosterImage,
	setFollowing,
	type MediaItem,
} from "@/lib/media-api";
import { progressPercent, subtitle } from "@/lib/media";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import {
	HoverPreviewVideo,
	useHoverPreview,
} from "@/components/ui/hover-preview";
import { useSyncplayPlayback } from "@/lib/syncplay-playback";

export function WideCard({
	item,
	session,
}: {
	item: MediaItem;
	session?: AuthSession;
}) {
	const image = landscapeImage(item);
	const progress = progressPercent(item);
	const preview = useHoverPreview(item.Id, item.RunTimeTicks, session);

	return (
		<article
			onPointerEnter={preview.start}
			onPointerLeave={preview.stop}
			className="group/card w-[min(calc((100vw-2.75rem)/2),180px)] shrink-0 cursor-pointer select-none sm:w-[240px] md:w-[320px]"
		>
			<div className="relative">
				<Link
					href={detailHref(item)}
					aria-label={item.Name}
					draggable={false}
					className="block"
				>
					<div className="relative aspect-video overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
						{(item.Type === "Movie" || item.Type === "Episode") && (
							<HoverPreviewVideo preview={preview} />
						)}
						{image && (
							<BlurHashImage
								image={image}
								alt={item.Name}
								draggable={false}
								className={`${MEDIA_CARD_IMAGE_CLASS}`}
							/>
						)}
						{!image && <MediaPlaceholder />}
						<WatchProgress progress={progress} />
						<WatchedIndicator item={item} />
					</div>
				</Link>
				<CardText item={item} />
				<MediaCardOverlay
					href={detailHref(item)}
					title={item.Name}
					item={item}
					session={session}
					className="inset-x-0 top-0 aspect-video"
				/>
			</div>
		</article>
	);
}

export function PosterCard({
	item,
	session,
}: {
	item: MediaItem;
	session?: AuthSession;
}) {
	const image = seriesPosterImage(item);
	const progress = progressPercent(item);

	return (
		<article className="group/card w-[148px] shrink-0 cursor-pointer select-none sm:w-[180px] md:w-[200px]">
			<div className="relative">
				<Link
					href={detailHref(item)}
					aria-label={item.Name}
					draggable={false}
					className="block"
				>
					<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
						{image && (
							<BlurHashImage
								image={image}
								alt={item.Name}
								draggable={false}
								className={`${MEDIA_CARD_IMAGE_CLASS}`}
							/>
						)}
						{!image && <MediaPlaceholder />}
						<WatchProgress progress={progress} />
						<WatchedIndicator item={item} />
					</div>
				</Link>
				<CardText item={item} />
				<MediaCardOverlay
					href={detailHref(item)}
					title={item.Name}
					item={item}
					session={session}
					className="inset-x-0 top-0 aspect-[2/3]"
				/>
			</div>
		</article>
	);
}

export function StackedPosterCard({
	items,
	session,
}: {
	items: MediaItem[];
	session?: AuthSession;
}) {
	const item = items[0];
	const stacked = items.length > 1;
	const episode = item.Type === "Episode" && Boolean(item.SeriesId);
	const image = seriesPosterImage(item);

	return (
		<article className="group/card w-[148px] shrink-0 cursor-pointer select-none sm:w-[180px] md:w-[200px]">
			<div className="relative">
				<Link href={detailHref(item)} draggable={false} className="block">
					<div className="relative">
						{stacked && (
							<>
								<div className="absolute inset-x-3 -top-2 bottom-2 rounded-sm bg-white/10" />
								<div className="absolute inset-x-1.5 -top-1 bottom-1 rounded-sm bg-white/15" />
							</>
						)}
						<div className="relative aspect-[2/3] overflow-hidden rounded-sm bg-[var(--c-card-thumb)]">
							{image && (
								<BlurHashImage
									image={image}
									alt={stacked || episode ? (item.SeriesName ?? item.Name) : item.Name}
									draggable={false}
									className={`${MEDIA_CARD_IMAGE_CLASS}`}
								/>
							)}
							{!image && <MediaPlaceholder />}
							{stacked && (
								<span className={`absolute right-2 top-2 ${MEDIA_CARD_TAG_CLASS}`}>
									{items.length} EP
								</span>
							)}
							<WatchedIndicator
								item={item}
								unwatchedCount={
									items.filter((episode) => !episode.UserData?.Played).length
								}
							/>
						</div>
					</div>
					<div className="mt-2">
						<p className="truncate text-xs font-medium text-white/80">
							{stacked || episode ? (item.SeriesName ?? item.Name) : item.Name}
						</p>
						<p className="mt-0.5 truncate text-xs text-white/30">
							{stacked
								? (item.SeriesProductionYear ?? item.ProductionYear ?? item.Type)
								: episode
									? episodeLabel(item)
									: subtitle(item)}
						</p>
					</div>
				</Link>
				<MediaCardOverlay
					href={detailHref(item)}
					title={stacked || episode ? (item.SeriesName ?? item.Name) : item.Name}
					item={item}
					session={session}
					className="inset-x-0 top-0 aspect-[2/3]"
				/>
			</div>
		</article>
	);
}

function detailHref(item: MediaItem) {
	if (item.Type === "BoxSet") return `/collection/${item.Id}`;
	return item.Type === "Episode" && item.SeriesId
		? `/show/${item.SeriesId}/episode/${item.Id}`
		: `/show/${item.Id}`;
}

export const MEDIA_CARD_IMAGE_CLASS =
	"h-full w-full object-cover transition group-hover/card:brightness-50";

export const MEDIA_CARD_TAG_CLASS =
	"rounded-full border border-white/10 bg-black/40 px-1.5 py-0.5 text-xs font-medium tracking-wide text-white/75 backdrop-blur-sm";

export function MediaCardOverlay({
	href,
	title,
	item,
	session,
	className = "inset-0",
}: {
	href: string;
	title?: string;
	item?: MediaItem;
	session?: AuthSession;
	className?: string;
}) {
	const router = useRouter();
	const { t } = useI18n();
	const { canStartPlayback, startPlayback } = useSyncplayPlayback(session);
	const [followingOverride, setFollowingOverride] = useState<boolean | null>(null);
	const following = followingOverride ?? Boolean(item?.UserData?.IsFollowing);

	useEffect(() => {
		setFollowingOverride(null);
	}, [item?.Id, item?.UserData?.IsFollowing]);

	async function toggleFollowing(event: React.MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (!item || !session) return;
		const next = !following;
		setFollowingOverride(next);
		try {
			await setFollowing(session, item.Id, next);
		} catch {
			setFollowingOverride(following);
		}
	}

	return (
		<div
			className={`pointer-events-none absolute z-10 flex items-center justify-center bg-black/0 opacity-0 transition group-hover/card:bg-black/15 group-hover/card:opacity-100 ${className}`}
		>
			<button
				type="button"
				aria-label={title ? `${t("play")} ${title}` : t("play")}
				disabled={Boolean(item && session && !canStartPlayback)}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (item && session) void startPlayback(item).catch(() => undefined);
					else router.push(playHref(href));
				}}
				className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur transition duration-200 hover:scale-110 hover:border-white/60 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 focus:ring-offset-black disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Play className="ml-0.5 h-4 w-4 fill-white text-white" />
			</button>
			{item &&
				session &&
				(item.Type === "Movie" || item.Type === "Series") && (
					<button
						type="button"
						aria-label={t(following ? "unfollow" : "follow")}
						aria-pressed={following}
						title={t(following ? "unfollow" : "follow")}
						onClick={toggleFollowing}
						className={`pointer-events-auto absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/35 text-white backdrop-blur transition hover:scale-110 hover:border-white/60 hover:bg-black/55 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-2 focus:ring-offset-black ${following ? "text-violet-200" : "text-white/80"}`}
					>
						<Bookmark className={`h-4 w-4 ${following ? "fill-violet-200" : ""}`} />
					</button>
				)}
		</div>
	);
}

function playHref(href: string) {
	const match = href.match(/\/show\/[^/]+\/episode\/([^/?#]+)/);
	if (match) return `/play/${match[1]}`;
	const itemId = href.match(/\/show\/([^/?#]+)/)?.[1];
	return itemId ? `/play/${itemId}` : href;
}

export function WatchedIndicator({
	item,
	unwatchedCount,
}: {
	item: MediaItem;
	unwatchedCount?: number;
}) {
	const { t } = useI18n();
	const count =
		item.Type === "Series"
			? (unwatchedCount ?? item.UserData?.UnplayedItemCount)
			: undefined;
	const watched = item.Type !== "Series" && item.UserData?.Played === true;
	if (!watched && count == null) return null;
	const allWatched = item.Type === "Series" ? count === 0 : watched;
	return (
		<div
			aria-label={
				allWatched ? t("allEpisodesWatched") : `${count} ${t("unwatchedEpisodes")}`
			}
			className={`absolute right-2 top-2 flex items-center gap-1 ${MEDIA_CARD_TAG_CLASS}`}
		>
			{allWatched ? (
				<Check aria-hidden="true" className="h-3 w-3 text-emerald-300/80" />
			) : (
				<>
					{count} {t("unwatchedEpisodes")}
				</>
			)}
		</div>
	);
}

export function WatchProgress({ progress }: { progress: number | undefined }) {
	if (progress == null) {
		return null;
	}

	return (
		<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/25 backdrop-blur-sm">
			<div
				className="h-full bg-gradient-to-r from-violet-700 to-violet-300"
				style={{ width: `${progress}%` }}
			/>
		</div>
	);
}

function CardText({ item }: { item: MediaItem }) {
	if (item.Type === "Episode" && item.SeriesId) {
		return (
			<div className="mt-2 min-w-0">
				<Link
					href={`/show/${item.SeriesId}`}
					className="block truncate text-xs font-medium text-white/80 hover:underline focus:outline-none focus-visible:underline"
				>
					{item.SeriesName ?? "Series"}
				</Link>
				<Link
					aria-label="Episode details"
					href={detailHref(item)}
					className="mt-0.5 block truncate text-xs text-white/50 transition-colors hover:text-white/90 focus:outline-none focus-visible:text-white/90 focus-visible:underline"
				>
					{episodeLabel(item)}
				</Link>
			</div>
		);
	}

	return (
		<div className="mt-2">
			<p className="truncate text-xs font-medium text-white/80">{item.Name}</p>
			<p className="mt-0.5 truncate text-xs text-white/30">{subtitle(item)}</p>
		</div>
	);
}

function episodeLabel(item: MediaItem) {
	const season =
		item.ParentIndexNumber == null
			? "??"
			: String(item.ParentIndexNumber).padStart(2, "0");
	const episode =
		item.IndexNumber == null ? "??" : String(item.IndexNumber).padStart(2, "0");
	return `S${season}E${episode}・${item.Name}`;
}
