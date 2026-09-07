"use client";

import Link from "next/link";
import { ChevronLeft, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { SquareAudioCard } from "@/components/home/media-card";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import { seriesPosterImage, type MediaItem } from "@/lib/media-api";
import type { ArtistData } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const RELEASE_BUCKETS = [
	{ key: "album", label: "artistAlbums" },
	{ key: "ep", label: "artistEps" },
	{ key: "single", label: "artistSingles" },
	{ key: "live", label: "artistLive" },
	{ key: "remix", label: "artistRemixes" },
	{ key: "soundtrack", label: "artistSoundtracks" },
] as const satisfies ReadonlyArray<{
	key: ReleaseBucket;
	label: TranslationKey;
}>;

type ReleaseBucket =
	"album" | "ep" | "single" | "live" | "remix" | "soundtrack";

export function ArtistPage({
	data,
	session,
}: {
	data: ArtistData;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const { playAlbum } = useAudioPlayer();
	const albums = uniqueItems(data.albums);
	const tracks = uniqueItems(data.tracks);
	const appearsIn = uniqueItems(data.appearsIn);
	const relatedArtists = uniqueItems(data.relatedArtists);
	const grouped = useMemo(() => groupReleases(albums), [albums]);
	const image = seriesPosterImage(data.artist);
	const tags = uniqueStrings([
		...(data.artist.Tags ?? []),
		...(data.artist.Genres ?? []),
	]);
	const releaseCount = uniqueItems([...albums, ...appearsIn]).length;

	function goBack() {
		if (window.history.length > 1) {
			router.back();
			return;
		}
		router.push("/");
	}

	return (
		<main className="relative min-h-screen overflow-hidden px-4 pb-32 pt-20 sm:px-8 md:px-12 md:pb-28 md:pt-24">
			{image && (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] opacity-30 blur-3xl"
					style={{
						backgroundImage: `linear-gradient(180deg, rgba(9, 9, 9, 0.28), rgba(9, 9, 9, 0.98)), url(${image.src})`,
						backgroundPosition: "center top",
						backgroundSize: "cover",
					}}
				/>
			)}
			<div className="relative mx-auto">
				<button
					type="button"
					onClick={goBack}
					aria-label={t("back")}
					className="mb-8 inline-flex items-center gap-1 rounded-md px-2 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
				>
					<ChevronLeft className="h-4 w-4" /> {t("back")}
				</button>

				<header className="grid items-end gap-8 md:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)]">
					<div className="relative aspect-square w-44 overflow-hidden rounded-2xl bg-white/[0.04] shadow-2xl shadow-black/40 md:w-full">
						{image ? (
							<BlurHashImage
								image={image}
								alt={data.artist.Name}
								sizes="(max-width: 767px) 176px, 208px"
								className="h-full w-full object-cover"
							/>
						) : (
							<MediaPlaceholder />
						)}
					</div>
					<div className="min-w-0 pb-1">
						<p className="text-xs font-bold uppercase tracking-[0.2em] text-white/45">
							{t("artist")}
						</p>
						<h1 className="mt-2 break-words text-4xl font-black leading-[0.98] tracking-[-0.04em] text-white sm:text-5xl md:text-7xl">
							{data.artist.Name}
						</h1>
						{data.artist.Overview && (
							<p className="mt-5 max-w-2xl text-sm leading-6 text-white/55">
								{data.artist.Overview}
							</p>
						)}
						<div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
							<span>{t("artistReleaseCount", { count: releaseCount })}</span>
							<span aria-hidden="true">·</span>
							<span>{t("artistTrackCount", { count: tracks.length })}</span>
						</div>
						{tags.length > 0 && (
							<div className="mt-4 flex flex-wrap gap-2">
								{tags.map((tag) => (
									<span
										key={tag}
										className="rounded border border-white/15 bg-black/20 px-2.5 py-1 text-xs text-white/65"
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</div>
				</header>

				<div className="mt-8 flex items-center gap-3">
					<button
						type="button"
						disabled={tracks.length === 0}
						onClick={() => playAlbum(data.artist, tracks)}
						className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition hover:scale-[1.03] hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Play className="h-4 w-4 fill-current" />
						{t("playAll")}
					</button>
				</div>

				{tracks.length === 0 ? (
					<div className="mt-16 rounded-xl border border-white/10 bg-black/20 px-6 py-16 text-center text-sm text-white/45">
						{t("artistNoMusic")}
					</div>
				) : (
					<div className="mt-14 space-y-14">
						{appearsIn.length > 0 && (
							<ReleaseSection
								title={t("artistAppearsIn")}
								items={appearsIn}
								session={session}
							/>
						)}
						{RELEASE_BUCKETS.map(({ key, label }) =>
							grouped[key].length > 0 ? (
								<ReleaseSection
									key={key}
									title={t(label)}
									items={grouped[key]}
									session={session}
								/>
							) : null,
						)}
						{relatedArtists.length > 0 && (
							<section aria-labelledby="artist-related-heading">
								<h2
									id="artist-related-heading"
									className="mb-5 text-xl font-black tracking-[-0.02em] text-white"
								>
									{t("relatedArtists")}
								</h2>
								<div className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-10">
									{relatedArtists.map((artist) => (
										<ArtistCard key={artist.Id} artist={artist} />
									))}
								</div>
							</section>
						)}
					</div>
				)}
			</div>
		</main>
	);
}

function ReleaseSection({
	title,
	items,
	session,
}: {
	title: string;
	items: MediaItem[];
	session: AuthSession;
}) {
	return (
		<section aria-label={title}>
			<h2 className="mb-5 text-xl font-black tracking-[-0.02em] text-white">
				{title}
			</h2>
			<div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-8 sm:grid-cols-[repeat(auto-fill,minmax(184px,1fr))] sm:gap-x-5 [&>article]:w-full">
				{items.map((item) => (
					<SquareAudioCard
						key={item.Id}
						item={item}
						session={session}
						className="w-full"
					/>
				))}
			</div>
		</section>
	);
}

function ArtistCard({ artist }: { artist: MediaItem }) {
	const image = seriesPosterImage(artist);
	return (
		<Link
			href={`/artist/${encodeURIComponent(artist.Id)}`}
			className="group min-w-0 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
		>
			<div className="relative mx-auto aspect-square w-full max-w-28 overflow-hidden rounded-full border border-white/10 bg-white/[0.04] transition duration-300 group-hover:scale-[1.03] group-hover:border-white/30">
				{image ? (
					<BlurHashImage
						image={image}
						alt={artist.Name}
						sizes="112px"
						className="h-full w-full object-cover"
					/>
				) : (
					<MediaPlaceholder />
				)}
			</div>
			<p className="mt-3 truncate text-xs font-semibold text-white/80 group-hover:text-white group-hover:underline">
				{artist.Name}
			</p>
		</Link>
	);
}

function groupReleases(items: MediaItem[]) {
	const grouped = Object.fromEntries(
		RELEASE_BUCKETS.map(({ key }) => [key, [] as MediaItem[]]),
	) as Record<ReleaseBucket, MediaItem[]>;
	for (const item of items) grouped[releaseBucket(item)].push(item);
	return grouped;
}

function releaseBucket(item: MediaItem): ReleaseBucket {
	const primary = normalizeReleaseType(item.AlbumType);
	if (
		primary &&
		primary !== "album" &&
		primary !== "compilation" &&
		primary !== "other"
	) {
		return primary;
	}
	for (const value of item.AlbumSecondaryTypes ?? []) {
		const secondary = normalizeReleaseType(value);
		if (
			secondary &&
			secondary !== "album" &&
			secondary !== "compilation" &&
			secondary !== "other"
		) {
			return secondary;
		}
	}
	return "album";
}

function normalizeReleaseType(
	value: string | undefined,
): ReleaseBucket | "compilation" | "other" | null {
	const normalized = value?.trim().toLowerCase();
	if (!normalized) return null;
	if (normalized === "ep") return "ep";
	if (normalized === "single") return "single";
	if (normalized === "live") return "live";
	if (normalized === "remix" || normalized === "remixes") return "remix";
	if (normalized === "soundtrack" || normalized === "soundtracks") {
		return "soundtrack";
	}
	if (normalized === "album") return "album";
	if (normalized === "compilation") return "compilation";
	if (normalized === "other") return "other";
	return null;
}

function uniqueItems<T extends { Id: string }>(items: T[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}

function uniqueStrings(values: string[]) {
	const seen = new Set<string>();
	return values.filter((value) => {
		const normalized = value.trim().toLocaleLowerCase();
		if (!normalized || seen.has(normalized)) return false;
		seen.add(normalized);
		return true;
	});
}
