"use client";

import Link from "next/link";
import {
	ChevronDown,
	ChevronUp,
	ListMusic,
	Pause,
	Play,
	Shuffle,
	SkipBack,
	SkipForward,
	Volume2,
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

	return (
		<>
			{player.queueOpen && (
				<div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-2 z-[80] w-[min(25rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#16131d]/95 shadow-2xl shadow-black/60 backdrop-blur-xl md:bottom-[4.5rem] md:right-6">
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
						<p className="px-3 py-8 text-center text-sm text-white/40">{t("queueEmpty")}</p>
					) : (
						player.queue.map((entry, index) => {
							const selected = index === player.currentIndex;
							return (
								<div
									key={entry.id}
									className={`flex items-center gap-2 rounded-xl px-2 py-2 ${selected ? "bg-violet-500/15" : "hover:bg-white/[0.05]"}`}
								>
									<button
										type="button"
										aria-label={`${t("play")} ${entry.track.Name}`}
										onClick={() => player.playQueueItem(index)}
										className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
									>
										<p className="truncate text-xs font-medium text-white/85">{entry.track.Name}</p>
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

			<div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[75] overflow-hidden border-t border-white/10 bg-[#100e16]/95 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur-xl md:bottom-0 md:px-6">
				{image && (
					<div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
						<BlurHashGlow image={image} className="opacity-30" />
						<div className="absolute inset-0 bg-[#100e16]/80" />
					</div>
				)}
				<div className="relative mx-auto flex max-w-[1800px] items-center gap-3">
					<Link
						href={track?.AlbumId ? `/album/${track.AlbumId}?trackId=${encodeURIComponent(track.Id)}` : "/library"}
						className="hidden min-w-0 items-center gap-2 sm:flex sm:w-52"
					>
						<div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-white/[0.06]">
							{image ? (
								<BlurHashImage image={image} alt="" sizes="40px" className="h-full w-full object-cover" />
							) : (
								<MediaPlaceholder />
							)}
						</div>
						<div className="min-w-0">
							<p className="truncate text-xs font-semibold text-white/85">{track?.Name ?? t("queue")}</p>
							<p className="truncate text-[11px] text-white/35">{track?.AlbumArtist ?? track?.Album ?? ""}</p>
						</div>
					</Link>

					<div className="flex shrink-0 items-center gap-1">
						<IconButton label={t("previous")} onClick={player.playPrevious}>
							<SkipBack className="h-4 w-4" />
						</IconButton>
						<IconButton
							label={player.isPlaying ? t("pause") : player.autoplayBlocked ? t("resumeAudio") : t("play")}
							onClick={player.autoplayBlocked ? player.resume : player.togglePlay}
							primary
						>
							{player.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
						</IconButton>
						<IconButton label={t("next")} onClick={player.playNext}>
							<SkipForward className="h-4 w-4" />
						</IconButton>
					</div>

					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="hidden w-9 text-right text-[10px] tabular-nums text-white/35 sm:inline">
								{formatTime(player.positionSeconds)}
							</span>
							<input
								type="range"
								min={0}
								max={Math.max(duration, 0.1)}
								step={0.1}
								value={Math.min(player.positionSeconds, duration || 0)}
								disabled={!duration}
								onChange={(event) => player.seek(Number(event.target.value))}
								aria-label={t("duration")}
								className="h-1 min-w-0 flex-1 accent-violet-400"
							/>
							<span className="w-9 text-[10px] tabular-nums text-white/35">{formatTime(duration)}</span>
						</div>
						{player.error && (
							<div className="mt-1 flex items-center gap-2 text-[10px] text-red-200/75">
								<span className="truncate">{player.error}</span>
								{player.autoplayBlocked && (
									<button type="button" onClick={player.resume} className="shrink-0 underline hover:text-white">
										{t("resumeAudio")}
									</button>
								)}
							</div>
						)}
					</div>

					<div className="hidden items-center gap-2 md:flex">
						<ShuffleButton active={player.shuffle} onClick={player.toggleShuffle} label={t("shuffle")} />
						<Volume2 className="h-4 w-4 text-white/35" aria-hidden="true" />
						<input
							type="range"
							min={0}
							max={1}
							step={0.01}
							value={player.volume}
							onChange={(event) => player.setVolume(Number(event.target.value))}
							aria-label={t("volume")}
							className="w-20 accent-violet-400"
						/>
					</div>
					<IconButton label={t("queue")} onClick={() => player.setQueueOpen(!player.queueOpen)}>
						<ListMusic className="h-4 w-4" />
					</IconButton>
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

function ShuffleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			aria-label={label}
			aria-pressed={active}
			onClick={onClick}
			className={`rounded-full p-2 transition focus:outline-none focus:ring-2 focus:ring-violet-300 ${active ? "text-violet-300" : "text-white/45 hover:bg-white/10 hover:text-white"}`}
		>
			<Shuffle className="h-4 w-4" />
		</button>
	);
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0:00";
	const seconds = Math.floor(value);
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
