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
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-white/[0.06] hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
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
				className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/35 transition hover:bg-white/[0.06] hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
			</button>
		</div>
	);
}
