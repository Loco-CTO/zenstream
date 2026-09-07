import { describe, expect, it } from "vitest";
import {
	albumTypeLabel,
	trackArtistCredits,
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

	it("uses per-credit IDs and the primary album artist fallback", () => {
		expect(
			trackArtistCredits({
				...track("song", 1),
				ArtistId: "album-artist-id",
				AlbumArtist: "Album Artist",
				ArtistCredits: [
					{ Name: "Album Artist" },
					{ Id: "guest-id", Name: "Guest Artist" },
				],
			}),
		).toEqual([
			{ Id: "album-artist-id", Name: "Album Artist" },
			{ Id: "guest-id", Name: "Guest Artist" },
		]);
	});

	it("keeps unresolved artist credits visible without an ID", () => {
		expect(
			trackArtistCredits({
				...track("song", 1),
				ArtistCredits: [{ Name: "Local Artist" }],
			}),
		).toEqual([{ Name: "Local Artist" }]);
	});

	it("renders the exact ordered join phrase for each credit", () => {
		expect(
			trackArtistLabel({
				...track("call", 1),
				ArtistCredits: [
					{ Name: "ヰ世界情緒", JoinPhrase: "×" },
					{ Name: "春猿火", JoinPhrase: "" },
				],
			}),
		).toBe("ヰ世界情緒×春猿火");
		expect(
			trackArtistLabel({
				...track("feat", 1),
				ArtistCredits: [
					{ Name: "明透", JoinPhrase: " feat. " },
					{ Name: "Sooda", JoinPhrase: "" },
				],
			}),
		).toBe("明透 feat. Sooda");
	});
});

describe("audio album type display", () => {
	it("localizes the primary and secondary release types", () => {
		expect(
			albumTypeLabel(
				"EP",
				["Live", "EP"],
				(key) =>
					(
						({
							albumTypeEp: "EP",
							albumTypeLive: "Live",
						}) as Record<string, string>
					)[key] ?? key,
			),
		).toBe("EP · Live");
	});
});
