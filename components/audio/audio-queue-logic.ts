import type { AudioLoopMode } from "@/lib/player-preferences";

export type AudioQueueEntryLike = {
	id: string;
};

export type AudioQueueAdvanceSelection = {
	index: number;
	playedEntryIds: Set<string>;
	resetPlayed: boolean;
};

export type AudioQueuePreviousSelection = {
	index: number;
	history: string[];
};

function randomIndex(values: number[], random: () => number) {
	if (values.length === 0) return -1;
	const sampled = random();
	const value = Number.isFinite(sampled) ? sampled : 0;
	return values[
		Math.min(values.length - 1, Math.max(0, Math.floor(value * values.length)))
	];
}

function orderedAfterCurrent(size: number, currentIndex: number) {
	return Array.from(
		{ length: Math.max(0, size - 1) },
		(_, offset) => (currentIndex + 1 + offset) % size,
	);
}

export function selectNextAudioQueueEntry(
	entries: readonly AudioQueueEntryLike[],
	currentIndex: number,
	shuffle: boolean,
	loopMode: AudioLoopMode,
	force: boolean,
	playedEntryIds: ReadonlySet<string>,
	random: () => number = Math.random,
): AudioQueueAdvanceSelection | null {
	if (entries.length === 0) return null;
	const current = Math.min(entries.length - 1, Math.max(0, currentIndex));
	const queueIds = new Set(entries.map((entry) => entry.id));
	const played = new Set(
		[...playedEntryIds].filter((entryId) => queueIds.has(entryId)),
	);
	if (loopMode === "single" && force) {
		return { index: current, playedEntryIds: played, resetPlayed: false };
	}

	const unplayed = entries.flatMap((entry, index) =>
		played.has(entry.id) ? [] : [index],
	);
	if (shuffle) {
		const candidates = unplayed.filter((index) => index !== current);
		if (candidates.length > 0) {
			return {
				index: randomIndex(candidates, random),
				playedEntryIds: played,
				resetPlayed: false,
			};
		}
		if (!played.has(entries[current].id)) {
			return { index: current, playedEntryIds: played, resetPlayed: false };
		}
		if (loopMode !== "queue") return null;
		const resetCandidates =
			entries.length > 1
				? entries.map((_entry, index) => index).filter((index) => index !== current)
				: [current];
		return {
			index: randomIndex(resetCandidates, random),
			playedEntryIds: new Set(),
			resetPlayed: true,
		};
	}

	const order = orderedAfterCurrent(entries.length, current);
	const nextUnplayed = order.find((index) => unplayed.includes(index));
	if (nextUnplayed !== undefined) {
		return { index: nextUnplayed, playedEntryIds: played, resetPlayed: false };
	}
	if (!played.has(entries[current].id)) {
		return { index: current, playedEntryIds: played, resetPlayed: false };
	}
	if (loopMode !== "queue") return null;
	return {
		index: order[0] ?? current,
		playedEntryIds: new Set(),
		resetPlayed: true,
	};
}

export function selectPreviousAudioQueueEntry(
	entries: readonly AudioQueueEntryLike[],
	currentIndex: number,
	shuffle: boolean,
	shuffleHistory: readonly string[],
): AudioQueuePreviousSelection | null {
	if (entries.length === 0) return null;
	const current = Math.min(entries.length - 1, Math.max(0, currentIndex));
	if (shuffle) {
		for (
			let historyIndex = shuffleHistory.length - 1;
			historyIndex >= 0;
			historyIndex -= 1
		) {
			const entryId = shuffleHistory[historyIndex];
			const index = entries.findIndex((entry) => entry.id === entryId);
			if (index >= 0 && index !== current) {
				return {
					index,
					history: shuffleHistory.slice(0, historyIndex),
				};
			}
		}
		return null;
	}
	const index = current - 1;
	return index >= 0 ? { index, history: [] } : null;
}
