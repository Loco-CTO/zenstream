"use client";

import Link from "next/link";
import {
	ChevronDown,
	ChevronUp,
	Heart,
	ListMusic,
	LoaderCircle,
	Pause,
	Play,
	Shuffle,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { seriesPosterImage, type MediaItem } from "@/lib/media-api";
import {
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";

type AudioPlayer = ReturnType<typeof useAudioPlayer>;

type TransportLabels = {
	shuffle: string;
	previous: string;
	play: string;
	pause: string;
	resume: string;
	next: string;
};

type ActionLabels = {
	shuffle: string;
	volume: string;
	mute: string;
	unmute: string;
	addFavorite: string;
	removeFavorite: string;
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
		previous: t("previous"),
		play: t("play"),
		pause: t("pause"),
		resume: t("resumeAudio"),
		next: t("next"),
	};
	const actionLabels: ActionLabels = {
		shuffle: t("shuffle"),
		volume: t("volume"),
		mute: t("mute"),
		unmute: t("unmute"),
		addFavorite: t("addFavorite"),
		removeFavorite: t("removeFavorite"),
		queue: t("queue"),
	};

	return (
		<>
			{player.queueOpen && <QueuePanel player={player} />}

			<div
				data-testid="audio-player-bar"
				className="zenstream-audio-player-bar fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[75] h-[5.75rem] overflow-visible border-t border-white/5 bg-[#090909]/[0.98] px-2 shadow-[0_-12px_30px_rgba(0,0,0,0.3)] backdrop-blur-2xl md:bottom-0 md:h-20 md:px-4"
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
							labels={transportLabels}
							includeShuffle
						/>
						<SeekControl
							position={position}
							duration={duration}
							onSeek={player.seek}
							label={t("duration")}
						/>
					</div>
					<div className="min-w-0 justify-self-end">
						<ActionControls player={player} track={track} labels={actionLabels} />
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
						<TransportControls player={player} labels={transportLabels} compact />
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
						<ActionControls
							player={player}
							track={track}
							labels={actionLabels}
							includeShuffle
							compact
						/>
					</div>
				</div>
			</div>
		</>
	);
}

function QueuePanel({ player }: { player: AudioPlayer }) {
	const { t } = useI18n();

	return (
		<div
			role="dialog"
			aria-label={t("queue")}
			className="zenstream-audio-player-queue fixed right-2 z-[90] w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/[0.12] bg-[#151419]/[0.98] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:right-4"
		>
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<div>
					<h2 className="text-sm font-semibold text-white">{t("queue")}</h2>
					<p className="mt-0.5 text-xs text-white/35">
						{player.queue.length} {t("tracks").toLocaleLowerCase()}
					</p>
				</div>
				<button
					type="button"
					aria-label={t("close")}
					onClick={() => player.setQueueOpen(false)}
					className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="max-h-[min(60vh,30rem)] overflow-y-auto p-2">
				{player.queue.length === 0 ? (
					<p className="px-3 py-8 text-center text-sm text-white/40">
						{t("queueEmpty")}
					</p>
				) : (
					player.queue.map((entry, index) => {
						const selected = index === player.currentIndex;
						const entryImage = seriesPosterImage(entry.track);
						return (
							<div
								key={entry.id}
								className={`flex items-center gap-2 rounded-xl px-2 py-2 ${selected ? "bg-violet-500/15" : "hover:bg-white/[0.05]"}`}
							>
								<div className="relative h-9 w-9 shrink-0 overflow-hidden rounded bg-white/[0.06]">
									{entryImage ? (
										<BlurHashImage
											image={entryImage}
											alt=""
											sizes="36px"
											className="h-full w-full object-cover"
										/>
									) : (
										<MediaPlaceholder />
									)}
								</div>
								<button
									type="button"
									aria-label={`${t("play")} ${entry.track.Name}`}
									onClick={() => player.playQueueItem(index)}
									className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
								>
									<p className="truncate text-xs font-medium text-white/85">
										{entry.track.Name}
									</p>
									<p className="truncate text-[11px] text-white/35">
										{trackArtist(entry.track) || entry.track.Album || ""}
									</p>
								</button>
								<div className="flex items-center gap-0.5">
									<button
										type="button"
										aria-label={t("moveUp")}
										disabled={index === 0}
										onClick={() => player.reorderQueue(index, index - 1)}
										className="rounded p-1 text-white/30 transition hover:bg-white/10 hover:text-white disabled:opacity-20"
									>
										<ChevronUp className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										aria-label={t("moveDown")}
										disabled={index === player.queue.length - 1}
										onClick={() => player.reorderQueue(index, index + 1)}
										className="rounded p-1 text-white/30 transition hover:bg-white/10 hover:text-white disabled:opacity-20"
									>
										<ChevronDown className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										aria-label={`${t("removeFromQueue")} ${entry.track.Name}`}
										onClick={() => player.removeQueueItem(entry.id)}
										className="rounded p-1 text-white/30 transition hover:bg-red-400/15 hover:text-red-200"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
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
	const content = (
		<>
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
			<div className="min-w-0 leading-tight">
				<p className="truncate text-[18px] font-semibold text-white/90">
					{track?.Name ?? fallback}
				</p>
				<p className="truncate text-[14px] text-white/55">{artist || " "}</p>
				<p
					className={`truncate text-[14px] ${error ? "text-red-200/80" : "text-white/35"}`}
					title={error ?? album}
					role={error ? "alert" : undefined}
				>
					{error || album || " "}
				</p>
			</div>
		</>
	);

	if (!track?.AlbumId) {
		return (
			<div className="flex min-w-0 flex-1 items-center gap-2">{content}</div>
		);
	}

	return (
		<Link
			href={`/album/${track.AlbumId}?trackId=${encodeURIComponent(track.Id)}`}
			className="flex min-w-0 flex-1 items-center gap-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
		>
			{content}
		</Link>
	);
}

function TransportControls({
	player,
	labels,
	includeShuffle,
	compact = false,
}: {
	player: AudioPlayer;
	labels: TransportLabels;
	includeShuffle?: boolean;
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
			{includeShuffle && (
				<IconButton
					label={labels.shuffle}
					onClick={player.toggleShuffle}
					pressed={player.shuffle}
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
	track,
	labels,
	includeShuffle = false,
	compact = false,
}: {
	player: AudioPlayer;
	track: MediaItem | null;
	labels: ActionLabels;
	includeShuffle?: boolean;
	compact?: boolean;
}) {
	return (
		<div
			className={`flex shrink-0 items-center ${compact ? "gap-0" : "gap-0.5 lg:gap-1"}`}
		>
			{includeShuffle && (
				<IconButton
					label={labels.shuffle}
					onClick={player.toggleShuffle}
					pressed={player.shuffle}
					compact={compact}
				>
					<Shuffle className="h-4 w-4" />
				</IconButton>
			)}
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
			<IconButton
				label={labels.queue}
				onClick={() => player.setQueueOpen(!player.queueOpen)}
				pressed={player.queueOpen}
				compact={compact}
			>
				<ListMusic className="h-4 w-4" />
			</IconButton>
		</div>
	);
}

function IconButton({
	label,
	onClick,
	children,
	primary = false,
	pressed = false,
	disabled = false,
	compact = false,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
	primary?: boolean;
	pressed?: boolean;
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
			className={`flex shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-25 ${compact ? "h-7 w-7" : primary ? "h-9 w-9 md:h-10 md:w-10" : "h-8 w-8"} ${primary ? "bg-white text-black hover:bg-violet-200" : pressed ? "text-white" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
		>
			{children}
		</button>
	);
}

function trackArtist(track: MediaItem | null) {
	if (!track) return "";
	return (
		track.Artists?.filter(Boolean).join(", ") ||
		track.ContributingArtists?.filter(Boolean).join(", ") ||
		track.AlbumArtist ||
		""
	);
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0:00";
	const seconds = Math.floor(value);
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
