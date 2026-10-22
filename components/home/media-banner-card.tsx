"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import {
	landscapeImage,
	seriesPosterImage,
	type MediaItem,
} from "@/lib/media-api";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";

export function MediaBannerCard({
	item,
	href,
}: {
	item: MediaItem;
	href: string | null;
}) {
	const backdrop = landscapeImage(item);
	const poster = seriesPosterImage(item) ?? backdrop;
	const year = item.ProductionYear ?? item.SeriesProductionYear;
	const genres = (item.Genres ?? []).filter(Boolean).slice(0, 2);
	const content = (
		<>
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				{backdrop && (
					<BlurHashImage
						image={backdrop}
						alt=""
						aria-hidden="true"
						useArtworkVariants
						sizes="(max-width: 639px) 92vw, 600px"
						className="object-cover opacity-25 transition-opacity duration-200 group-hover/banner:opacity-35"
					/>
				)}
				<div className="absolute inset-0 bg-gradient-to-r from-[#111115]/95 via-[#111115]/90 to-violet-950/40" />
			</div>
			<div className="relative aspect-[2/3] overflow-hidden bg-black/25">
				{poster ? (
					<BlurHashImage
						image={poster}
						alt={item.Name}
						useArtworkVariants
						sizes="88px"
						className="h-full w-full object-contain"
					/>
				) : (
					<MediaPlaceholder />
				)}
				<div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
			</div>
			<div className="relative flex min-w-0 flex-col justify-center px-3 py-3 sm:px-4">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">
					{item.Type && <span>{item.Type}</span>}
					{year && <span>{year}</span>}
					{item.OfficialRating && <span>{item.OfficialRating}</span>}
					{typeof item.CommunityRating === "number" &&
						Number.isFinite(item.CommunityRating) && (
							<span className="inline-flex items-center gap-1 text-amber-100/85">
								<Star aria-hidden="true" className="h-3 w-3 fill-current" />
								{item.CommunityRating.toFixed(1)}
							</span>
						)}
				</div>
				<h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white sm:text-base">
					{item.Name}
				</h3>
				{item.Overview && (
					<p className="mt-1 line-clamp-3 text-[11px] leading-[1.15rem] text-white/65 sm:text-xs">
						{item.Overview}
					</p>
				)}
				{genres.length > 0 && (
					<div className="mt-2 flex flex-wrap gap-1.5">
						{genres.map((genre) => (
							<span
								key={genre}
								className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/65"
							>
								{genre}
							</span>
						))}
					</div>
				)}
			</div>
		</>
	);
	const className =
		"group/banner relative my-3 grid w-full grid-cols-[88px_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/10 bg-[#111115] shadow-lg shadow-black/20 transition hover:border-violet-200/25 hover:bg-[#17161b]";

	return href ? (
		<Link href={href} aria-label={item.Name} className={className}>
			{content}
		</Link>
	) : (
		<div className={className}>{content}</div>
	);
}
