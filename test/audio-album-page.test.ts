import { describe, expect, it } from "vitest";
import {
	trackArtistLabel,
	trackDiscNumbers,
} from "@/components/pages/audio-album-page";
import type { MediaItem } from "@/lib/media-api";

function track(
	id: string,
	trackNumber: number,
	discNumber?: number,
): MediaItem {
	return {
		Id: id,
		Name: id,
		Type: "Audio",
		TrackNumber: trackNumber,
		DiscNumber: discNumber,
	};
}

describe("audio album disc display", () => {
	it("keeps explicit disc numbers for multi-disc albums", () => {
		expect(
			trackDiscNumbers([
				track("one", 1, 1),
				track("two", 2, 1),
				track("three", 1, 2),
				track("four", 2, 2),
			]),
		).toEqual([1, 1, 2, 2]);
	});

	it("infers a disc boundary when legacy data omits disc numbers", () => {
		expect(
			trackDiscNumbers([track("one", 1), track("two", 2), track("three", 1)]),
		).toEqual([1, 1, 2]);
	});
});

describe("audio album track artist display", () => {
	it("combines unique track and contributing artists", () => {
		expect(
			trackArtistLabel({
				...track("song", 1),
				Artists: ["Artist A", "Artist B"],
				ContributingArtists: ["Artist B", "Artist C"],
			}),
		).toBe("Artist A, Artist B, Artist C");
	});

	it("falls back to the album artist when track artists are unavailable", () => {
		expect(
			trackArtistLabel({
				...track("song", 1),
				AlbumArtist: "Album Artist",
			}),
		).toBe("Album Artist");
	});
});
