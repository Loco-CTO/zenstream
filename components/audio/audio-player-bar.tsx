"use client";

import Link from "next/link";
import {
	Heart,
	ListMusic,
	LoaderCircle,
	MicVocal,
	Pause,
	Play,
	Repeat,
	Repeat1,
	RepeatOff,
	Shuffle,
	SkipBack,
	SkipForward,
	Square,
	Volume2,
	VolumeX,
} from "lucide-react";
import { type ReactNode } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { seriesPosterImage, type MediaItem } from "@/lib/media-api";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";
import { AudioLyricsOverlay } from "@/components/audio/audio-lyrics-overlay";
import { formatTrackArtists } from "@/lib/music";

type AudioPlayer = ReturnType<typeof useAudioPlayer>;

type TransportLabels = {
	shuffle: string;
	loopOff: string;
	loopQueue: string;
	loopSingle: string;
	previous: string;
	play: string;
	pause: string;
	resume: string;
	next: string;
	stop: string;
	addFavorite: string;
	removeFavorite: string;
};

type ActionLabels = {
	volume: string;
	mute: string;
	unmute: string;
	lyrics: string;
	queue: string;
};

export function AudioPlayerBar() {
	const { t } = useI18n();
	const player = useAudioPlayer();
	const track = player.currentTrack;
	if (!track && player.queue.length === 0) return null;

	const image = track ? seriesPosterImage(track) : null;
	const duration = player.durationSeconds || track?.DurationSeconds || 0;
	const position = duration
		? Math.min(duration, Math.max(0, player.positionSeconds))
		: 0;
	const artist = trackArtist(track);
	const album = track?.Album ?? "";
	const transportLabels: TransportLabels = {
		shuffle: t("shuffle"),
		loopOff: t("loopOff"),
		loopQueue: t("loopQueue"),
		loopSingle: t("loopSingle"),
		previous: t("previous"),
		play: t("play"),
		pause: t("pause"),
		resume: t("resumeAudio"),
		next: t("next"),
		stop: t("stopPlaying"),
		addFavorite: t("addFavorite"),
		removeFavorite: t("removeFavorite"),
	};
	const actionLabels: ActionLabels = {
		volume: t("volume"),
		mute: t("mute"),
		unmute: t("unmute"),
		lyrics: t("openLyrics"),
		queue: t("queue"),
	};

	return (
		<>
			{track && (
				<AudioLyricsOverlay
					key={track.Id}
					track={track}
					open={player.lyricsOpen}
					onClose={() => {
						player.setLyricsOpen(false);
						player.setQueueOpen(false);
					}}
				/>
			)}

			<div
				data-testid="audio-player-bar"
				className="zenstream-audio-player-bar fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[75] h-[5.75rem] overflow-visible border-t border-white/5 bg-[#090909]/[0.98] px-2 backdrop-blur-2xl md:bottom-0 md:h-20 md:px-4"
			>
				<div className="relative hidden h-full min-w-0 grid-cols-[minmax(11rem,1fr)_minmax(15rem,40rem)_minmax(11rem,1fr)] items-center gap-3 md:grid lg:gap-5">
					<TrackIdentity
						track={track}
						image={image}
						artist={artist}
						album={album}
						fallback={t("queue")}
						error={player.error}
					/>
					<div className="flex min-w-0 flex-col justify-center gap-1">
						<TransportControls
							player={player}
							track={track}
							labels={transportLabels}
							includeShuffle
							includeLoop
						/>
						<SeekControl
							position={position}
							duration={duration}
							onSeek={player.seek}
							label={t("duration")}
						/>
					</div>
					<div className="min-w-0 justify-self-end">
						<ActionControls player={player} labels={actionLabels} />
					</div>
				</div>

				<div className="relative flex h-full min-w-0 flex-col gap-1 py-1.5 md:hidden">
					<div className="flex min-h-0 flex-1 items-center gap-2">
						<TrackIdentity
							track={track}
							image={image}
							artist={artist}
							album={album}
							fallback={t("queue")}
							error={player.error}
							compact
						/>
						<TransportControls
							player={player}
							track={track}
							labels={transportLabels}
							includeShuffle
							includeLoop
							compact
						/>
					</div>
					<div className="flex min-h-0 items-center gap-1">
						<div className="min-w-0 flex-1">
							<SeekControl
								position={position}
								duration={duration}
								onSeek={player.seek}
								label={t("duration")}
								compact
							/>
						</div>
						<ActionControls player={player} labels={actionLabels} compact />
					</div>
				</div>
			</div>
		</>
	);
}

function TrackIdentity({
	track,
	image,
	artist,
	album,
	fallback,
	error,
	compact = false,
}: {
	track: MediaItem | null;
	image: ReturnType<typeof seriesPosterImage>;
	artist: string;
	album: string;
	fallback: string;
	error: string | null;
	compact?: boolean;
}) {
	const albumHref = track?.AlbumId
		? `/album/${encodeURIComponent(track.AlbumId)}`
		: undefined;
	const trackHref = track?.AlbumId
		? `/album/${encodeURIComponent(track.AlbumId)}?trackId=${encodeURIComponent(track.Id)}`
		: undefined;
	const artistHref = track?.ArtistId
		? `/artist/${encodeURIComponent(track.ArtistId)}`
		: undefined;
	const linkClass =
		"transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";
	const artwork = (
		<div
			className={`relative shrink-0 overflow-hidden rounded-md bg-white/[0.06] ${compact ? "h-11 w-11" : "h-14 w-14"}`}
		>
			{image ? (
				<BlurHashImage
					image={image}
					alt=""
					sizes={compact ? "44px" : "56px"}
					className="h-full w-full object-cover"
				/>
			) : (
				<MediaPlaceholder />
			)}
		</div>
	);
	const content = (
		<>
			{albumHref ? (
				<Link
					href={albumHref}
					aria-label={album ? `${album} artwork` : fallback}
					className="shrink-0"
				>
					{artwork}
				</Link>
			) : (
				artwork
			)}
			<div className="min-w-0 leading-tight">
				<p className="truncate text-[18px] font-semibold text-white/90">
					{trackHref ? (
						<Link href={trackHref} className={linkClass}>
							{track?.Name}
						</Link>
					) : (
						(track?.Name ?? fallback)
					)}
				</p>
				<p className="mt-1 truncate text-[14px] text-white/55">
					{artistHref ? (
						<Link href={artistHref} className={linkClass}>
							{artist}
						</Link>
					) : (
						artist || " "
					)}
				</p>
				<p
					className={`mt-0.5 truncate text-[14px] ${error ? "text-red-200/80" : "text-white/35"}`}
					title={error ?? album}
					role={error ? "alert" : undefined}
				>
					{error ? (
						error
					) : albumHref ? (
						<Link href={albumHref} className={linkClass}>
							{album}
						</Link>
					) : (
						album || " "
					)}
				</p>
			</div>
		</>
	);

	return <div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>;
}

function TransportControls({
	player,
	track,
	labels,
	includeShuffle,
	includeLoop,
	compact = false,
}: {
	player: AudioPlayer;
	track: MediaItem | null;
	labels: TransportLabels;
	includeShuffle?: boolean;
	includeLoop?: boolean;
	compact?: boolean;
}) {
	const playLabel = player.isPlaying
		? labels.pause
		: player.autoplayBlocked
			? labels.resume
			: labels.play;
	const disabled = !player.currentTrack || player.isLoading;

	return (
		<div
			className={`flex items-center justify-center ${compact ? "gap-0" : "gap-1.5 lg:gap-3"}`}
		>
			<IconButton
				label={labels.stop}
				onClick={player.stop}
				disabled={!player.currentTrack}
				compact={compact}
			>
				<Square className="h-3.5 w-3.5 fill-current" />
			</IconButton>
			{includeShuffle && (
				<IconButton
					label={labels.shuffle}
					onClick={player.toggleShuffle}
					pressed={player.shuffle}
					dimmed={!player.shuffle}
					compact={compact}
				>
					<Shuffle className="h-4 w-4" />
				</IconButton>
			)}
			<IconButton
				label={labels.previous}
				onClick={player.playPrevious}
				disabled={disabled || player.currentIndex <= 0}
				compact={compact}
			>
				<SkipBack className="h-4 w-4" />
			</IconButton>
			<IconButton
				label={playLabel}
				onClick={player.autoplayBlocked ? player.resume : player.togglePlay}
				primary
				disabled={disabled}
				compact={compact}
			>
				{player.isLoading ? (
					<LoaderCircle className="h-4 w-4 animate-spin" />
				) : player.isPlaying ? (
					<Pause className="h-4 w-4" />
				) : (
					<Play className="ml-0.5 h-4 w-4 fill-current" />
				)}
			</IconButton>
			<IconButton
				label={labels.next}
				onClick={player.playNext}
				disabled={
					disabled ||
					player.currentIndex < 0 ||
					player.currentIndex >= player.queue.length - 1
				}
				compact={compact}
			>
				<SkipForward className="h-4 w-4" />
			</IconButton>
			{includeLoop && (
				<IconButton
					label={
						player.loopMode === "off"
							? labels.loopOff
							: player.loopMode === "queue"
								? labels.loopQueue
								: labels.loopSingle
					}
					onClick={player.cycleLoopMode}
					pressed={player.loopMode !== "off"}
					dimmed={player.loopMode === "off"}
					compact={compact}
				>
					{player.loopMode === "off" ? (
						<RepeatOff className="h-4 w-4" />
					) : player.loopMode === "single" ? (
						<Repeat1 className="h-4 w-4" />
					) : (
						<Repeat className="h-4 w-4" />
					)}
				</IconButton>
			)}
			{track && (
				<IconButton
					label={
						track.UserData?.IsFavorite ? labels.removeFavorite : labels.addFavorite
					}
					onClick={() => void player.toggleFavorite()}
					pressed={Boolean(track.UserData?.IsFavorite)}
					compact={compact}
				>
					<Heart
						className="h-4 w-4"
						fill={track.UserData?.IsFavorite ? "currentColor" : "none"}
					/>
				</IconButton>
			)}
		</div>
	);
}

function SeekControl({
	position,
	duration,
	onSeek,
	label,
	compact = false,
}: {
	position: number;
	duration: number;
	onSeek: (position: number) => void;
	label: string;
	compact?: boolean;
}) {
	return (
		<div
			className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center ${compact ? "gap-1" : "gap-2"}`}
		>
			<span
				className={`${compact ? "text-[9px]" : "text-[10px]"} tabular-nums text-white/45`}
			>
				{formatTime(position)}
			</span>
			<div className="relative flex h-4 min-w-0 items-center">
				<div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-white/20">
					<div
						className="h-full rounded-full bg-white/85 transition-[width] duration-150"
						style={{ width: `${duration ? (position / duration) * 100 : 0}%` }}
					/>
				</div>
				<input
					data-testid="audio-seek"
					type="range"
					min={0}
					max={Math.max(duration, 0.1)}
					step={0.1}
					value={position}
					disabled={!duration}
					onChange={(event) => onSeek(Number(event.target.value))}
					aria-label={label}
					className="relative z-10 h-5 w-full cursor-pointer appearance-none bg-transparent accent-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-default"
				/>
			</div>
			<span
				className={`${compact ? "text-[9px]" : "text-[10px]"} tabular-nums text-white/45`}
			>
				{formatTime(duration)}
			</span>
		</div>
	);
}

function ActionControls({
	player,
	labels,
	compact = false,
}: {
	player: AudioPlayer;
	labels: ActionLabels;
	compact?: boolean;
}) {
	return (
		<div
			className={`flex shrink-0 items-center ${compact ? "gap-0" : "gap-0.5 lg:gap-1"}`}
		>
			<IconButton
				label={labels.lyrics}
				onClick={() => {
					if (player.lyricsOpen && !player.queueOpen) {
						player.setLyricsOpen(false);
						return;
					}
					player.setQueueOpen(false);
					player.setLyricsOpen(true);
				}}
				pressed={player.lyricsOpen && !player.queueOpen}
				compact={compact}
			>
				<MicVocal className="h-4 w-4" />
			</IconButton>
			<IconButton
				label={labels.queue}
				onClick={() => {
					if (player.queueOpen && player.lyricsOpen) {
						player.setQueueOpen(false);
						player.setLyricsOpen(false);
					} else {
						player.setQueueOpen(true);
						player.setLyricsOpen(true);
					}
				}}
				pressed={player.queueOpen && player.lyricsOpen}
				compact={compact}
			>
				<ListMusic className="h-4 w-4" />
			</IconButton>
			<div className="flex shrink-0 items-center gap-1">
				<IconButton
					label={player.muted ? labels.unmute : labels.mute}
					onClick={player.toggleMuted}
					compact={compact}
				>
					{player.muted ? (
						<VolumeX className="h-4 w-4" />
					) : (
						<Volume2 className="h-4 w-4" />
					)}
				</IconButton>
				<input
					type="range"
					min={0}
					max={1}
					step={0.01}
					value={player.muted ? 0 : player.volume}
					onChange={(event) => player.setVolume(Number(event.target.value))}
					aria-label={labels.volume}
					className={`zenstream-audio-volume-slider h-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white ${compact ? "w-12" : "w-14 sm:w-16 lg:w-20"}`}
				/>
			</div>
		</div>
	);
}

function IconButton({
	label,
	onClick,
	children,
	primary = false,
	pressed = false,
	dimmed = false,
	disabled = false,
	compact = false,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
	primary?: boolean;
	pressed?: boolean;
	dimmed?: boolean;
	disabled?: boolean;
	compact?: boolean;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={pressed || undefined}
			onClick={onClick}
			disabled={disabled}
			className={`flex shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-25 ${compact ? "h-7 w-7" : primary ? "h-9 w-9 md:h-10 md:w-10" : "h-8 w-8"} ${primary ? "bg-white text-black hover:bg-violet-200" : pressed ? "text-white" : dimmed ? "text-white/35 hover:bg-white/10 hover:text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
		>
			{children}
		</button>
	);
}

function trackArtist(track: MediaItem | null) {
	return formatTrackArtists(track);
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0:00";
	const seconds = Math.floor(value);
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
