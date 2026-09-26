"use client";

import { LoaderCircle, Play, Shuffle } from "lucide-react";

export function AudioDetailPlaybackActions({
	playLabel,
	shuffleLabel,
	onPlay,
	onShuffle,
	disabled = false,
	busy = false,
	className = "",
}: {
	playLabel: string;
	shuffleLabel: string;
	onPlay: () => void;
	onShuffle: () => void;
	disabled?: boolean;
	busy?: boolean;
	className?: string;
}) {
	return (
		<div className={`flex shrink-0 items-center gap-2 ${className}`}>
			<button
				type="button"
				disabled={disabled}
				onClick={onShuffle}
				aria-label={shuffleLabel}
				title={shuffleLabel}
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40"
			>
				<Shuffle className="h-5 w-5" />
			</button>
			<button
				type="button"
				disabled={disabled}
				onClick={onPlay}
				aria-label={playLabel}
				aria-busy={busy}
				title={playLabel}
				className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
			</button>
		</div>
	);
}
