"use client";

import Link from "next/link";
import {
	ChevronDown,
	ChevronUp,
	Heart,
	ListMusic,
	Pause,
	Play,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
} from "lucide-react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { seriesPosterImage } from "@/lib/media-api";
import {
	BlurHashGlow,
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";

export function AudioPlayerBar() {
	const { t } = useI18n();
	const player = useAudioPlayer();
	const track = player.currentTrack;
	if (!track && player.queue.length === 0) return null;

	const image = track ? seriesPosterImage(track) : null;
	const duration = player.durationSeconds || track?.DurationSeconds || 0;
	const progress = duration
		? Math.min(100, Math.max(0, (player.positionSeconds / duration) * 100))
		: 0;

	return (
		<>
			{player.queueOpen && (
				<div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-2 z-[80] w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/[0.12] bg-[#151419]/[0.98] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-2xl md:bottom-[3.75rem] md:right-3">
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
							className="rounded-full p-2 text-white/45 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300"
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
												{entry.track.Album ?? entry.track.AlbumArtist ?? ""}
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
			)}

			<div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[75] h-[3.75rem] overflow-visible border-t border-white/10 bg-[#0b0b0d]/[0.98] px-3 shadow-[0_-12px_30px_rgba(0,0,0,0.28)] backdrop-blur-2xl md:bottom-0 md:px-6">
				{image && (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						aria-hidden="true"
					>
						<BlurHashGlow image={image} className="opacity-[0.08]" />
						<div className="absolute inset-0 bg-[#0b0b0d]/[0.95]" />
					</div>
				)}
				<div
					className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-white/[0.08]"
					aria-hidden="true"
				>
					<div
						className="h-full bg-violet-300 shadow-[0_0_10px_rgba(196,181,253,0.8)] transition-[width] duration-150"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<input
					type="range"
					min={0}
					max={Math.max(duration, 0.1)}
					step={0.1}
					value={Math.min(player.positionSeconds, duration || 0)}
					disabled={!duration}
					onChange={(event) => player.seek(Number(event.target.value))}
					aria-label={t("duration")}
					className="absolute inset-x-0 top-[-5px] z-20 h-3 w-full cursor-pointer opacity-0 outline-none focus-visible:opacity-100 disabled:cursor-default"
				/>
				<div className="relative grid h-full w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
					<div className="flex min-w-0 items-center gap-2">
						<Link
							href={
								track?.AlbumId
									? `/album/${track.AlbumId}?trackId=${encodeURIComponent(track.Id)}`
									: "/library"
							}
							className="hidden min-w-0 items-center gap-2 sm:flex"
						>
							<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-white/[0.06]">
								{image ? (
									<BlurHashImage
										image={image}
										alt=""
										sizes="40px"
										className="h-full w-full object-cover"
									/>
								) : (
									<MediaPlaceholder />
								)}
							</div>
							<div className="min-w-0">
								<p className="truncate text-xs font-semibold text-white/85">
									{track?.Name ?? t("queue")}
								</p>
								<p className="truncate text-[11px] text-white/35">
									{track?.AlbumArtist ?? track?.Album ?? ""}
								</p>
							</div>
						</Link>
						{track && (
							<button
								type="button"
								onClick={() => void player.toggleFavorite()}
								aria-label={
									track.UserData?.IsFavorite ? t("removeFavorite") : t("addFavorite")
								}
								aria-pressed={Boolean(track.UserData?.IsFavorite)}
								className={`hidden rounded-full p-1.5 transition focus:outline-none focus:ring-2 focus:ring-violet-300 sm:block ${track.UserData?.IsFavorite ? "text-white" : "text-white/35 hover:bg-white/10 hover:text-white"}`}
							>
								<Heart
									className="h-4 w-4"
									fill={track.UserData?.IsFavorite ? "currentColor" : "none"}
								/>
							</button>
						)}
					</div>

					<div className="flex shrink-0 items-center justify-self-center gap-1 sm:gap-2">
						<IconButton label={t("previous")} onClick={player.playPrevious}>
							<SkipBack className="h-4 w-4" />
						</IconButton>
						<IconButton
							label={
								player.isPlaying
									? t("pause")
									: player.autoplayBlocked
										? t("resumeAudio")
										: t("play")
							}
							onClick={player.autoplayBlocked ? player.resume : player.togglePlay}
							primary
						>
							{player.isPlaying ? (
								<Pause className="h-4 w-4" />
							) : (
								<Play className="ml-0.5 h-4 w-4 fill-current" />
							)}
						</IconButton>
						<IconButton label={t("next")} onClick={player.playNext}>
							<SkipForward className="h-4 w-4" />
						</IconButton>
					</div>

					<div className="flex min-w-0 items-center justify-end gap-2">
						<div className="hidden items-center gap-1 text-[11px] tabular-nums text-white/40 lg:flex">
							<span>{formatTime(player.positionSeconds)}</span>
							<span className="text-white/20">/</span>
							<span>{formatTime(duration)}</span>
						</div>
						{player.error && (
							<span
								className="hidden max-w-36 truncate text-[10px] text-red-200/75 xl:inline"
								title={player.error}
							>
								{player.error}
							</span>
						)}

						<div className="group relative hidden items-center md:flex">
							<div className="pointer-events-none absolute bottom-full left-1/2 z-30 flex h-36 max-h-[30vh] -translate-x-1/2 items-center rounded-2xl border border-white/20 bg-black/25 px-3 py-4 opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
								<input
									type="range"
									min={0}
									max={1}
									step={0.01}
									value={player.muted ? 0 : player.volume}
									onChange={(event) => player.setVolume(Number(event.target.value))}
									aria-label={t("volume")}
									className="h-28 w-5 cursor-pointer [writing-mode:vertical-lr] [direction:rtl] accent-violet-300"
								/>
							</div>
							<button
								type="button"
								aria-label={player.muted ? "Unmute" : "Mute"}
								onClick={player.toggleMuted}
								className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-300"
							>
								{player.muted ? (
									<VolumeX className="h-4 w-4" />
								) : (
									<Volume2 className="h-4 w-4" />
								)}
							</button>
						</div>
						<IconButton
							label={t("queue")}
							onClick={() => player.setQueueOpen(!player.queueOpen)}
						>
							<ListMusic className="h-4 w-4" />
						</IconButton>
					</div>
				</div>
			</div>
		</>
	);
}

function IconButton({
	label,
	onClick,
	primary = false,
	children,
}: {
	label: string;
	onClick: () => void;
	primary?: boolean;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			onClick={onClick}
			className={`flex h-8 w-8 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-violet-300 ${primary ? "bg-white text-black hover:bg-violet-200" : "text-white/55 hover:bg-white/10 hover:text-white"}`}
		>
			{children}
		</button>
	);
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0:00";
	const seconds = Math.floor(value);
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
