"use client";

import Link from "next/link";
import {
	Bookmark,
	ChevronLeft,
	CirclePlus,
	Heart,
	ListPlus,
	MoreHorizontal,
	Play,
	Shuffle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { SquareAudioCard } from "@/components/home/media-card";
import { PlaylistPicker } from "@/components/audio/playlist-picker";
import {
	AudioDetailActionSheet,
	AudioDetailSheetAction,
} from "@/components/audio/audio-detail-action-sheet";
import { AudioDetailPlaybackActions } from "@/components/audio/audio-detail-playback-actions";
import { CopyShareLinkButton } from "@/components/ui/copy-share-link-button";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { ExpandableDescription } from "@/components/ui/expandable-description";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
	fetchArtistTracks,
	seriesPosterImage,
	setFollowing,
	setFavorite,
	withPrimaryArtworkFallback,
	type MediaItem,
} from "@/lib/media-api";
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
	const { addAlbumToQueue, playAlbum } = useAudioPlayer();
	const albums = uniqueItems(data.albums);
	const tracks = uniqueItems(data.tracks);
	const trackCount = data.trackCount ?? tracks.length;
	const appearsIn = uniqueItems(data.appearsIn);
	const relatedArtists = uniqueItems(data.relatedArtists);
	const grouped = useMemo(() => groupReleases(albums), [albums]);
	const image = seriesPosterImage(data.artist);
	const [followOverride, setFollowOverride] = useState<{
		artistId: string;
		value: boolean;
	} | null>(null);
	const [followBusy, setFollowBusy] = useState(false);
	const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
	const [moreOpen, setMoreOpen] = useState(false);
	const [playBusy, setPlayBusy] = useState(false);
	const [playError, setPlayError] = useState(false);
	const [queueBusy, setQueueBusy] = useState(false);
	const [queueError, setQueueError] = useState(false);
	const [followErrorArtistId, setFollowErrorArtistId] = useState<string | null>(
		null,
	);
	const following =
		followOverride?.artistId === data.artist.Id
			? followOverride.value
			: Boolean(data.artist.UserData?.IsFollowing);
	const favorite = favoriteOverride ?? Boolean(data.artist.UserData?.IsFavorite);
	const followError = followErrorArtistId === data.artist.Id;
	const tags = uniqueStrings([
		...(data.artist.Tags ?? []),
		...(data.artist.Genres ?? []),
	]);
	const releaseCount = uniqueItems([...albums, ...appearsIn]).length;

	async function playAll() {
		if (playBusy || trackCount === 0) return;
		setPlayBusy(true);
		setPlayError(false);
		try {
			const queue = tracks.length
				? tracks
				: await fetchArtistTracks(session, data.artist.Id);
			if (queue.length > 0) playAlbum(data.artist, withArtistArtwork(queue));
		} catch {
			setPlayError(true);
		} finally {
			setPlayBusy(false);
		}
	}

	async function shuffleAll() {
		if (playBusy || trackCount === 0) return;
		setPlayBusy(true);
		setPlayError(false);
		try {
			const queue = tracks.length
				? tracks
				: await fetchArtistTracks(session, data.artist.Id);
			if (queue.length > 0)
				playAlbum(data.artist, withArtistArtwork(queue), undefined, true);
		} catch {
			setPlayError(true);
		} finally {
			setPlayBusy(false);
		}
	}

	async function addAllToQueue() {
		if (queueBusy || trackCount === 0) return;
		setQueueBusy(true);
		setQueueError(false);
		try {
			const queue = tracks.length
				? tracks
				: await fetchArtistTracks(session, data.artist.Id);
			if (queue.length > 0) addAlbumToQueue(data.artist, withArtistArtwork(queue));
		} catch {
			setQueueError(true);
		} finally {
			setQueueBusy(false);
		}
	}

	async function toggleFollowing() {
		const previous = following;
		const next = !previous;
		setFollowOverride({ artistId: data.artist.Id, value: next });
		setFollowBusy(true);
		setFollowErrorArtistId(null);
		try {
			await setFollowing(session, data.artist.Id, next);
		} catch {
			setFollowOverride({ artistId: data.artist.Id, value: previous });
			setFollowErrorArtistId(data.artist.Id);
		} finally {
			setFollowBusy(false);
		}
	}

	function withArtistArtwork(items: MediaItem[]) {
		const releases = new Map<string, MediaItem>(
			[...albums, ...appearsIn].map((release) => [release.Id, release] as const),
		);
		return items.map((track) =>
			withPrimaryArtworkFallback(
				track,
				releases.get(track.AlbumId ?? "") ?? data.artist,
			),
		);
	}

	async function toggleFavorite() {
		const previous = favorite;
		setFavoriteOverride(!previous);
		try {
			await setFavorite(session, data.artist.Id, !previous);
		} catch {
			setFavoriteOverride(previous);
			setFollowErrorArtistId(data.artist.Id);
		}
	}

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
							<ExpandableDescription
								description={data.artist.Overview}
								className="mt-5 max-w-2xl text-sm leading-6 text-white/55"
							/>
						)}
						<div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
							<span>{t("artistReleaseCount", { count: releaseCount })}</span>
							<span aria-hidden="true">·</span>
							<span>{t("artistTrackCount", { count: trackCount })}</span>
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

				<div className="mt-8 flex items-center gap-2">
					<button
						type="button"
						disabled={followBusy}
						onClick={() => void toggleFollowing()}
						aria-label={t(following ? "unfollow" : "follow")}
						title={t(following ? "unfollow" : "follow")}
						className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-wait disabled:opacity-50 ${following ? "text-violet-200" : "text-white/35 hover:text-white/75"}`}
					>
						<Bookmark className={`h-5 w-5 ${following ? "fill-current" : ""}`} />
					</button>
					<button
						type="button"
						onClick={() => void toggleFavorite()}
						aria-label={favorite ? t("removeFavorite") : t("addFavorite")}
						title={favorite ? t("removeFavorite") : t("addFavorite")}
						className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${favorite ? "text-white" : "text-white/35 hover:text-white/75"}`}
					>
						<Heart className="h-5 w-5" fill={favorite ? "currentColor" : "none"} />
					</button>
					<CopyShareLinkButton />
					<div className="hidden items-center gap-3 md:flex">
						<PlaylistPicker
							session={session}
							entityId={data.artist.Id}
							entityName={data.artist.Name}
							artistSource
							trackIds={tracks.length ? tracks.map((track) => track.Id) : undefined}
						/>
						<button
							type="button"
							disabled={trackCount === 0 || queueBusy}
							onClick={() => void addAllToQueue()}
							aria-label={t("addToQueue")}
							aria-busy={queueBusy}
							title={t("addToQueue")}
							className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
						>
							<ListPlus className="h-5 w-5" />
						</button>
					</div>
					<button
						type="button"
						onClick={() => setMoreOpen(true)}
						aria-label={t("showMore")}
						className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white md:hidden"
					>
						<MoreHorizontal className="h-5 w-5" />
					</button>
					<AudioDetailPlaybackActions
						className="ml-auto"
						playLabel={t("playAll")}
						shuffleLabel={t("shuffle")}
						onPlay={() => void playAll()}
						onShuffle={() => void shuffleAll()}
						disabled={trackCount === 0 || playBusy}
						busy={playBusy}
					/>
					{playError && (
						<p role="alert" className="text-xs text-red-200/80">
							{t("detailLoadFailed")}
						</p>
					)}
					{queueError && (
						<p role="alert" className="text-xs text-red-200/80">
							{t("detailLoadFailed")}
						</p>
					)}
					{followError && (
						<p role="alert" className="text-xs text-red-200/80">
							{t("detailLoadFailed")}
						</p>
					)}
				</div>
				{moreOpen && (
					<AudioDetailActionSheet
						item={data.artist}
						subtitle={t("artist")}
						onClose={() => setMoreOpen(false)}
					>
						<AudioDetailSheetAction
							icon={<Play className="h-5 w-5 fill-current" />}
							onClick={() => {
								setMoreOpen(false);
								void playAll();
							}}
						>
							{t("playAll")}
						</AudioDetailSheetAction>
						<AudioDetailSheetAction
							icon={<Shuffle className="h-5 w-5" />}
							onClick={() => {
								setMoreOpen(false);
								void shuffleAll();
							}}
						>
							{t("shuffle")}
						</AudioDetailSheetAction>
						<PlaylistPicker
							session={session}
							entityId={data.artist.Id}
							entityName={data.artist.Name}
							artistSource
							trackIds={tracks.length ? tracks.map((track) => track.Id) : undefined}
							containerClassName="w-full"
							triggerClassName="flex min-h-14 w-full items-center gap-4 rounded-xl px-3 text-left text-base text-white/85 transition hover:bg-white/[0.07]"
							triggerContent={
								<>
									<span className="flex h-9 w-9 shrink-0 items-center justify-center text-white/75">
										<CirclePlus className="h-5 w-5" />
									</span>
									<span>{t("addToPlaylist")}</span>
								</>
							}
						/>
						<AudioDetailSheetAction
							icon={<ListPlus className="h-5 w-5" />}
							onClick={() => {
								setMoreOpen(false);
								void addAllToQueue();
							}}
						>
							{t("addToQueue")}
						</AudioDetailSheetAction>
					</AudioDetailActionSheet>
				)}

				{trackCount === 0 ? (
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
