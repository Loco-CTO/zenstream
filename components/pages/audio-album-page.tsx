"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Heart, MoreHorizontal, Pause, Play, Shuffle } from "lucide-react";
import { useState } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { SquareAudioCard } from "@/components/home/media-card";
import {
	setFavorite,
	seriesPosterImage,
	type AudioAlbumData as AlbumData,
	type MediaItem,
} from "@/lib/media-api";
import { releaseDateLabel, releaseYear } from "@/lib/media";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

export function AudioAlbumPage({
	data,
	session,
}: {
	data: AlbumData;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const searchParams = useSearchParams();
	const { currentTrack, isPlaying, playAlbum, playTrack, addAlbumToQueue } =
		useAudioPlayer();
	const selectedTrackId = searchParams.get("trackId");
	const [favorite, setFavoriteState] = useState(
		Boolean(data.album.UserData?.IsFavorite),
	);
	const [mutationError, setMutationError] = useState<string | null>(null);
	const image = seriesPosterImage(data.album);
	const tracks = data.tracks.filter((track) => track.Type === "Audio");
	const totalDuration = tracks.reduce(
		(total, track) => total + durationSeconds(track),
		0,
	);
	const year = releaseYear(data.album);
	const artistName = data.artist?.Name ?? data.album.AlbumArtist;

	const toggleFavorite = async () => {
		const next = !favorite;
		setFavoriteState(next);
		setMutationError(null);
		try {
			await setFavorite(session, data.album.Id, next);
		} catch (error) {
			setFavoriteState(!next);
			setMutationError(
				error instanceof Error ? error.message : t("detailLoadFailed"),
			);
		}
	};

	if (!data.album) {
		return <AudioState title={t("audioNotFound")} />;
	}

	return (
		<main className="min-h-screen pb-28" style={{ background: "var(--c-page)" }}>
			<div className="mx-auto max-w-[1500px] px-6 pb-12 pt-24 md:px-10">
				<section className="flex flex-col items-start gap-6 sm:flex-row sm:items-end md:gap-8">
					<div className="h-44 w-44 shrink-0 overflow-hidden rounded-sm bg-[var(--c-card-thumb)] shadow-2xl md:h-52 md:w-52">
						<div className="h-full w-full">
							{image ? (
								<BlurHashImage
									image={image}
									alt={data.album.Name}
									sizes="208px"
									className="h-full w-full object-cover"
								/>
							) : (
								<MediaPlaceholder />
							)}
						</div>
					</div>
					<div className="min-w-0 pb-1">
						<h1 className="break-words text-3xl font-black leading-tight tracking-[-0.025em] text-white sm:text-4xl md:text-5xl">
							{data.album.Name}
						</h1>
						{data.artist ? (
							<Link
								href={`/artist/${data.artist.Id}`}
								className="mt-2 inline-block text-sm font-semibold text-white/80 transition hover:text-white hover:underline"
							>
								{artistName}
							</Link>
						) : artistName ? (
							<p className="mt-2 text-sm font-semibold text-white/80">{artistName}</p>
						) : null}
						<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
							{data.album.Show && (
								<>
									<span>{data.album.Show}</span>
									<span>·</span>
								</>
							)}
							{year && <span>{year}</span>}
							{year && <span>·</span>}
							<span>
								{tracks.length} {t("tracks")}
							</span>
							{totalDuration > 0 && (
								<>
									<span>·</span>
									<span>{formatTotalDuration(totalDuration)}</span>
								</>
							)}
						</div>
						<div className="mt-5 flex flex-col gap-3">
							{data.album.Genres && data.album.Genres.length > 0 && (
								<div>
									<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
										{t("tags")}
									</p>
									<div className="flex flex-wrap gap-1.5">
										{data.album.Genres.map((tag) => (
											<span
												key={tag}
												className="rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium leading-none text-white/55"
											>
												{tag}
											</span>
										))}
									</div>
								</div>
							)}
							{data.album.Label && (
								<div>
									<p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
										{t("label")}
									</p>
									<span className="inline-block rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium leading-none text-white/55">
										{data.album.Label}
									</span>
								</div>
							)}
						</div>
						{data.album.PremiereDate && (
							<p className="mt-3 text-xs text-white/35">
								{releaseDateLabel(data.album)}
							</p>
						)}
					</div>
				</section>

				<section className="flex items-center gap-5 py-4">
					<button
						type="button"
						onClick={() => playAlbum(data.album, tracks)}
						disabled={tracks.length === 0}
						aria-label={t("play")}
						className="flex h-12 w-12 items-center justify-center rounded-full bg-white transition hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Play className="ml-0.5 h-5 w-5 fill-black text-black" />
					</button>
					<button
						type="button"
						onClick={() => playAlbum(data.album, tracks, undefined, true)}
						disabled={tracks.length === 0}
						aria-label={t("shuffle")}
						className="text-white/25 transition hover:text-white/55 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Shuffle className="h-5 w-5" />
					</button>
					<button
						type="button"
						onClick={toggleFavorite}
						aria-pressed={favorite}
						aria-label={favorite ? t("removeFavorite") : t("addFavorite")}
						className={`transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300 ${favorite ? "text-white" : "text-white/25 hover:text-white/55"}`}
					>
						<Heart className="h-5 w-5" fill={favorite ? "currentColor" : "none"} />
					</button>
					<button
						type="button"
						onClick={() => addAlbumToQueue(data.album, tracks)}
						disabled={tracks.length === 0}
						aria-label={t("addToQueue")}
						className="ml-auto text-white/20 transition hover:text-white/45 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<MoreHorizontal className="h-5 w-5" />
					</button>
				</section>
				{mutationError && (
					<p role="alert" className="-mt-2 mb-3 text-xs text-red-200/80">
						{mutationError}
					</p>
				)}

				<section className="mt-2">
					<div className="mb-1 grid items-center px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/22 [grid-template-columns:36px_1fr_80px_56px]">
						<span className="text-center">#</span>
						<span>{t("track")}</span>
						<span className="text-right">{t("playCount")}</span>
						<span className="text-right">{t("duration")}</span>
					</div>
					{tracks.length === 0 ? (
						<AudioState title={t("audioEmpty")} compact />
					) : (
						<div className="overflow-hidden">
							{tracks.map((track, index) => (
								<TrackRow
									key={track.Id}
									track={track}
									index={index}
									selected={selectedTrackId === track.Id}
									current={currentTrack?.Id === track.Id}
									playing={currentTrack?.Id === track.Id && isPlaying}
									playLabel={t("play")}
									onPlay={() => void playTrack(track, tracks)}
								/>
							))}
						</div>
					)}
				</section>

				{data.relatedAlbums.length > 0 && (
					<section className="mt-12">
						<h2 className="mb-4 text-lg font-black tracking-[-0.01em] text-white">
							{t("moreSoundtracks")}
						</h2>
						<div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
							{uniqueItems(data.relatedAlbums).map((album) => (
								<SquareAudioCard key={album.Id} item={album} session={session} />
							))}
						</div>
					</section>
				)}
			</div>
		</main>
	);
}

function TrackRow({
	track,
	index,
	selected,
	current,
	playing,
	playLabel,
	onPlay,
}: {
	track: MediaItem;
	index: number;
	selected: boolean;
	current: boolean;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
}) {
	return (
		<div
			role="row"
			aria-current={current ? "true" : undefined}
			className={`group grid items-center border-b border-white/[0.06] last:border-0 [grid-template-columns:36px_minmax(0,1fr)_80px_56px] ${selected || current ? "bg-violet-400/[0.1]" : "hover:bg-white/[0.045]"}`}
		>
			<div
				role="cell"
				className="px-2 py-3 text-center text-xs tabular-nums text-white/35"
			>
				{track.TrackNumber ?? index + 1}
			</div>
			<div role="cell" className="min-w-0 px-2 py-3">
				<button
					type="button"
					onClick={onPlay}
					aria-label={`${playLabel} ${track.Name}`}
					className="flex max-w-full items-center gap-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
				>
					<span className="flex h-7 w-7 shrink-0 items-center justify-center text-violet-200 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
						{playing ? (
							<Pause className="h-3.5 w-3.5" />
						) : (
							<Play className="h-3.5 w-3.5 fill-current" />
						)}
					</span>
					<span
						className={`truncate text-sm ${current ? "text-violet-100" : "text-white/80"}`}
					>
						{track.Name}
					</span>
				</button>
			</div>
			<div
				role="cell"
				className="px-2 py-3 text-right text-xs tabular-nums text-white/40"
			>
				{track.UserData?.PlayCount ?? 0}
			</div>
			<div
				role="cell"
				className="px-4 py-3 text-right text-xs tabular-nums text-white/40"
			>
				{formatDuration(durationSeconds(track))}
			</div>
		</div>
	);
}

function durationSeconds(track: MediaItem) {
	return (
		track.DurationSeconds ??
		track.UserData?.DurationSeconds ??
		(track.RunTimeTicks ? track.RunTimeTicks / 10_000_000 : 0)
	);
}

function formatDuration(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "—";
	const seconds = Math.round(value);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatTotalDuration(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "—";
	const minutes = Math.round(value / 60);
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function uniqueItems(items: MediaItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (!item.Id || seen.has(item.Id)) return false;
		seen.add(item.Id);
		return true;
	});
}

function AudioState({
	title,
	compact = false,
}: {
	title: string;
	compact?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border border-white/10 bg-white/[0.025] text-center text-sm text-white/45 ${compact ? "px-6 py-10" : "px-6 py-24"}`}
		>
			{title}
		</div>
	);
}
