import type { MediaStream } from "@/lib/media-api";

export function preferredTrackIndex(
	tracks: MediaStream[],
	preferredLanguage: string | null,
): number | undefined {
	return (
		(preferredLanguage
			? tracks.find(
					(track) =>
						track.Language?.toLowerCase() === preferredLanguage.toLowerCase(),
				)
			: undefined)?.Index ??
		tracks.find((track) => track.IsDefault)?.Index ??
		tracks[0]?.Index
	);
}

export function preferredSubtitleIndex(
	tracks: MediaStream[],
	preference: string | null,
): number | null | undefined {
	if (preference === "off") return null;
	return preferredTrackIndex(tracks, preference);
}
