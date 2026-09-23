import { describe, expect, it, vi } from "vitest";
import {
	orderAudioPlaylistStart,
	selectNextAudioQueueEntry,
	selectPreviousAudioQueueEntry,
} from "@/components/audio/audio-queue-logic";

const entries = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("audio queue selection", () => {
	it("keeps a playlist track selected by the user first while shuffling the rest", () => {
		const ordered = orderAudioPlaylistStart(
			entries,
			1,
			true,
			true,
			() => 0,
		);

		expect(ordered[0]).toEqual({ id: "b" });
		expect(new Set(ordered.map((entry) => entry.id))).toEqual(
			new Set(["a", "b", "c"]),
		);
	});

	it("chooses a random unplayed entry and stops after an off pass", () => {
		const random = vi.fn(() => 0.99);
		expect(
			selectNextAudioQueueEntry(
				entries,
				0,
				true,
				"off",
				true,
				new Set(["a"]),
				random,
			),
		).toMatchObject({ index: 2, resetPlayed: false });
		expect(
			selectNextAudioQueueEntry(
				entries,
				2,
				true,
				"off",
				true,
				new Set(["a", "b", "c"]),
			),
		).toBeNull();
	});

	it("resets the played pass for queue repeat", () => {
		const selection = selectNextAudioQueueEntry(
			entries,
			2,
			true,
			"queue",
			true,
			new Set(["a", "b", "c"]),
			() => 0,
		);
		expect(selection).toMatchObject({ index: 0, resetPlayed: true });
		expect(selection?.playedEntryIds).toEqual(new Set());
	});

	it("keeps track repeat scoped to forced end-of-track transitions", () => {
		expect(
			selectNextAudioQueueEntry(
				entries,
				1,
				false,
				"single",
				true,
				new Set(["a", "b"]),
			),
		).toMatchObject({ index: 1 });
		expect(
			selectNextAudioQueueEntry(
				entries,
				1,
				false,
				"single",
				false,
				new Set(["a", "b"]),
			),
		).toMatchObject({ index: 2 });
	});

	it("uses shuffle history for previous", () => {
		expect(selectPreviousAudioQueueEntry(entries, 2, true, ["a", "b"])).toEqual({
			index: 1,
			history: ["a"],
		});
		expect(selectPreviousAudioQueueEntry(entries, 0, true, [])).toBeNull();
	});
});
