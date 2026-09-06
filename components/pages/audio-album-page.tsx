"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
	ChevronLeft,
	Clock,
	Heart,
	MoreHorizontal,
	Play,
	Shuffle,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { SquareAudioCard } from "@/components/home/media-card";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
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
import { AudioPlayingIndicator } from "@/components/audio/audio-playing-indicator";

export function AudioAlbumPage({
	data,
	session,
}: {
	data: AlbumData;
	session: AuthSession;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { currentTrack, isPlaying, playAlbum, playTrack, addAlbumToQueue } =
		useAudioPlayer();
	const selectedTrackId = searchParams.get("trackId");
	const [favorite, setFavoriteState] = useState(
		Boolean(data.album.UserData?.IsFavorite),
	);
	const [favoriteTracks, setFavoriteTracks] = useState(
		() =>
			new Set(
				data.tracks
					.filter((track) => track.UserData?.IsFavorite)
					.map((track) => track.Id),
			),
	);
	const [mutationError, setMutationError] = useState<string | null>(null);
	const image = seriesPosterImage(data.album);
	const tracks = data.tracks.filter((track) => track.Type === "Audio");
	const discNumbers = trackDiscNumbers(tracks);
	const showDiscHeaders =
		new Set(
			discNumbers.filter((discNumber): discNumber is number => discNumber != null),
		).size > 1;
	const totalDuration = tracks.reduce(
		(total, track) => total + durationSeconds(track),
		0,
	);
	const year = releaseYear(data.album);
	const artistName = data.artist?.Name ?? data.album.AlbumArtist;

	function goBack() {
		if (window.history.length > 1) {
			router.back();
			return;
		}
		router.push("/");
	}

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

	const toggleTrackFavorite = async (track: MediaItem) => {
		const previous = favoriteTracks.has(track.Id);
		const next = !previous;
		setFavoriteTracks((current) => {
			const updated = new Set(current);
			if (next) updated.add(track.Id);
			else updated.delete(track.Id);
			return updated;
		});
		setMutationError(null);
		try {
			await setFavorite(session, track.Id, next);
		} catch (error) {
			setFavoriteTracks((current) => {
				const updated = new Set(current);
				if (previous) updated.add(track.Id);
				else updated.delete(track.Id);
				return updated;
			});
			setMutationError(
				error instanceof Error ? error.message : t("detailLoadFailed"),
			);
		}
	};

	if (!data.album) {
		return <AudioState title={t("audioNotFound")} />;
	}

	return (
		<main
			className="relative min-h-screen pb-28"
			style={{ background: "var(--c-page)" }}
		>
			<button
				type="button"
				onClick={goBack}
				aria-label={t("back")}
				className="absolute left-4 top-[calc(4rem+env(safe-area-inset-top))] z-10 flex items-center gap-1 rounded-md px-2 py-2 text-xs uppercase tracking-wider text-white/60 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 sm:left-5 md:left-8 md:top-20"
			>
				<ChevronLeft className="h-4 w-4" />
				{t("back")}
			</button>
			<section className="flex flex-col items-start gap-6 px-6 pb-8 pt-32 sm:flex-row sm:items-end md:gap-8 md:px-10">
				<div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-sm bg-[var(--c-card-thumb)] shadow-2xl md:h-52 md:w-52">
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
					<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/45">
						{artistName &&
							(data.artist ? (
								<Link
									href={`/artist/${data.artist.Id}`}
									className="font-semibold text-white/80 transition hover:text-white hover:underline"
								>
									{artistName}
								</Link>
							) : (
								<span className="font-semibold text-white/80">{artistName}</span>
							))}
						{artistName && data.album.Show && <span>·</span>}
						{data.album.Show && (
							<>
								<span>{data.album.Show}</span>
								<span>·</span>
							</>
						)}
						{year && (
							<>
								<span>{year}</span>
								<span>·</span>
							</>
						)}
						<span>
							{tracks.length} {t("tracks").toLocaleLowerCase()}
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
								<p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-white/35">
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

			<section className="flex items-center gap-5 px-6 py-4 md:px-10">
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

			<section className="mt-2 px-6 md:px-10">
				<div className="mb-1 grid items-center px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-white/22 [grid-template-columns:36px_minmax(0,1.5fr)_minmax(0,1fr)_72px_56px_32px]">
					<span className="text-center">#</span>
					<span>{t("track")}</span>
					<span>{t("artist")}</span>
					<span className="text-right">{t("playCount")}</span>
					<span className="flex justify-end" aria-label={t("duration")}>
						<Clock className="h-3.5 w-3.5" />
					</span>
					<span aria-hidden="true" />
				</div>
				{tracks.length === 0 ? (
					<AudioState title={t("audioEmpty")} compact />
				) : (
					<div className="overflow-hidden">
						{tracks.map((track, index) => {
							const discNumber = discNumbers[index];
							const previousDiscNumber = discNumbers[index - 1];
							const showDiscHeader =
								showDiscHeaders &&
								discNumber != null &&
								(index === 0 || previousDiscNumber !== discNumber);

							return (
								<Fragment key={track.Id}>
									{showDiscHeader && (
										<div
											role="row"
											aria-label={`${t("disc")} ${discNumber}`}
											className={`px-2 pb-2 pl-11 text-sm font-semibold uppercase tracking-[0.14em] text-white/45 ${
												index === 0 ? "pt-2" : "mt-4 pt-5"
											}`}
										>
											{t("disc")} {discNumber}
										</div>
									)}
									<TrackRow
										track={track}
										index={index}
										selected={selectedTrackId === track.Id}
										current={currentTrack?.Id === track.Id}
										playing={currentTrack?.Id === track.Id && isPlaying}
										liked={favoriteTracks.has(track.Id)}
										playLabel={t("play")}
										addFavoriteLabel={t("addFavorite")}
										removeFavoriteLabel={t("removeFavorite")}
										onPlay={() => void playTrack(track, tracks)}
										onToggleFavorite={() => void toggleTrackFavorite(track)}
									/>
								</Fragment>
							);
						})}
					</div>
				)}
			</section>

			{data.relatedAlbums.length > 0 && (
				<section className="mt-12 px-6 md:px-10">
					<h2 className="mb-4 text-lg font-black tracking-[-0.01em] text-white">
						{t("moreSoundtracks")}
					</h2>
					<HorizontalScroller title={t("moreSoundtracks")}>
						{uniqueItems(data.relatedAlbums).map((album) => (
							<SquareAudioCard
								key={album.Id}
								item={album}
								session={session}
								className="w-[148px] shrink-0 sm:w-[180px] md:w-[200px]"
							/>
						))}
					</HorizontalScroller>
				</section>
			)}
		</main>
	);
}

function TrackRow({
	track,
	index,
	selected,
	current,
	playing,
	liked,
	playLabel,
	addFavoriteLabel,
	removeFavoriteLabel,
	onPlay,
	onToggleFavorite,
}: {
	track: MediaItem;
	index: number;
	selected: boolean;
	current: boolean;
	playing: boolean;
	liked: boolean;
	playLabel: string;
	addFavoriteLabel: string;
	removeFavoriteLabel: string;
	onPlay: () => void;
	onToggleFavorite: () => void;
}) {
	return (
		<div
			role="row"
			tabIndex={0}
			aria-current={current ? "true" : undefined}
			onClick={onPlay}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					onPlay();
				}
			}}
			className={`group/track grid cursor-pointer items-center rounded-md px-2 py-2.5 transition-colors [grid-template-columns:36px_minmax(0,1.5fr)_minmax(0,1fr)_72px_56px_32px] ${selected || current ? "bg-white/[0.08]" : "hover:bg-white/[0.04]"}`}
		>
			<div role="cell" className="flex items-center justify-center">
				{playing ? (
					<AudioPlayingIndicator ariaLabel={playLabel} />
				) : (
					<>
						<span
							className={`text-sm font-medium tabular-nums group-hover/track:hidden ${current ? "text-white" : "text-white/30"}`}
						>
							{track.TrackNumber ?? index + 1}
						</span>
						<Play
							className="hidden h-4 w-4 fill-white text-white group-hover/track:block"
							aria-hidden="true"
						/>
					</>
				)}
			</div>
			<div role="cell" className="min-w-0 pr-4">
				<button
					type="button"
					onClick={(event) => {
						event.stopPropagation();
						onPlay();
					}}
					aria-label={`${playLabel} ${track.Name}`}
					className={`min-w-0 truncate text-left text-sm font-medium focus:outline-none focus-visible:underline ${current ? "text-white" : "text-white/85"}`}
				>
					{track.Name}
				</button>
			</div>
			<div
				role="cell"
				className="min-w-0 truncate px-2 text-sm text-white/45"
				title={trackArtistLabel(track) || undefined}
			>
				{trackArtistLabel(track) || "—"}
			</div>
			<div
				role="cell"
				className="px-2 text-right text-xs tabular-nums text-white/28"
			>
				{track.UserData?.PlayCount ?? 0}
			</div>
			<div role="cell" className="text-right text-xs tabular-nums text-white/28">
				{formatDuration(durationSeconds(track))}
			</div>
			<div role="cell" className="flex justify-end">
				<button
					type="button"
					aria-label={liked ? removeFavoriteLabel : addFavoriteLabel}
					aria-pressed={liked}
					onClick={(event) => {
						event.stopPropagation();
						onToggleFavorite();
					}}
					className={`rounded p-1 transition group-hover/track:opacity-100 focus:opacity-100 ${liked ? "text-white opacity-100" : "text-white/25 opacity-0 hover:text-white/60"}`}
				>
					<Heart className="h-3.5 w-3.5" fill={liked ? "currentColor" : "none"} />
				</button>
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

export function trackArtistLabel(track: MediaItem) {
	const artists = [
		...(track.Artists ?? []),
		...(track.ContributingArtists ?? []),
	]
		.map((artist) => artist.trim())
		.filter(Boolean);
	const uniqueArtists = Array.from(new Set(artists));
	return uniqueArtists.join(", ") || track.AlbumArtist?.trim() || "";
}

export function trackDiscNumbers(
	tracks: MediaItem[],
): Array<number | undefined> {
	let currentDisc: number | undefined;
	let previousTrack: number | undefined;

	return tracks.map((track) => {
		if (track.DiscNumber != null) {
			currentDisc = track.DiscNumber;
		} else if (currentDisc == null) {
			currentDisc = 1;
		} else if (
			track.TrackNumber != null &&
			previousTrack != null &&
			track.TrackNumber < previousTrack
		) {
			currentDisc += 1;
		}
		previousTrack = track.TrackNumber;
		return currentDisc;
	});
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
