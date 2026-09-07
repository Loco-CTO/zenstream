import type { ArtistCredit, MediaItem } from "./media-api";

type ArtistCreditSource = {
	Id?: string;
	Name: string;
	JoinPhrase?: string;
};

function creditId(value: ArtistCreditSource) {
	const id = value.Id?.trim();
	return id || undefined;
}

function creditName(value: ArtistCreditSource) {
	return value.Name.trim();
}

function creditJoinPhrase(value: ArtistCreditSource) {
	return typeof value.JoinPhrase === "string" ? value.JoinPhrase : undefined;
}

/**
 * Return ordered, atomic credits while keeping the first source's ordering
 * and display data. Later sources can fill an ID or an omitted join phrase,
 * but cannot replace an explicitly supplied value.
 */
export function normalizeArtistCredits(
	...sources: Array<readonly ArtistCreditSource[] | undefined>
): ArtistCredit[] {
	const credits: ArtistCredit[] = [];
	const byName = new Map<string, number>();
	const byId = new Map<string, number>();

	for (const source of sources) {
		if (!Array.isArray(source)) continue;
		for (const value of source) {
			const name = creditName(value);
			if (!name) continue;
			const id = creditId(value);
			const nameKey = name.toLocaleLowerCase();
			const idIndex = id ? byId.get(id) : undefined;
			const nameIndex = byName.get(nameKey);
			const nameMatchesDifferentId =
				nameIndex !== undefined &&
				Boolean(id && credits[nameIndex]?.Id && credits[nameIndex].Id !== id);
			const existingIndex =
				idIndex ?? (nameMatchesDifferentId ? undefined : nameIndex);

			if (existingIndex !== undefined) {
				const existing = credits[existingIndex];
				if (id && !existing.Id) {
					existing.Id = id;
					byId.set(id, existingIndex);
				}
				if (existing.JoinPhrase === undefined) {
					const joinPhrase = creditJoinPhrase(value);
					if (joinPhrase !== undefined) existing.JoinPhrase = joinPhrase;
				}
				continue;
			}

			const credit: ArtistCredit = { Name: name };
			if (id) credit.Id = id;
			const joinPhrase = creditJoinPhrase(value);
			if (joinPhrase !== undefined) credit.JoinPhrase = joinPhrase;
			const index = credits.push(credit) - 1;
			byName.set(nameKey, index);
			if (id) byId.set(id, index);
		}
	}

	return credits;
}

export function artistCreditSeparator(
	credits: readonly ArtistCredit[],
	index: number,
) {
	const joinPhrase = credits[index]?.JoinPhrase;
	if (joinPhrase !== undefined) return joinPhrase;
	return index < credits.length - 1 ? ", " : "";
}

export function formatArtistCredits(credits: readonly ArtistCredit[]) {
	return credits
		.map(
			(credit, index) => `${credit.Name}${artistCreditSeparator(credits, index)}`,
		)
		.join("");
}

export function artistCreditsForTrack(
	track: Pick<
		MediaItem,
		| "ArtistCredits"
		| "Artists"
		| "ContributingArtists"
		| "AlbumArtist"
		| "ArtistId"
	>,
) {
	const sourceCredits: ArtistCreditSource[] =
		track.ArtistCredits && track.ArtistCredits.length > 0
			? track.ArtistCredits
			: [
					...(track.Artists ?? []).map((Name): ArtistCredit => ({ Name })),
					...(track.ContributingArtists ?? []).map((Name): ArtistCredit => ({
						Name,
					})),
				];
	const credits = normalizeArtistCredits(sourceCredits);

	if (credits.length === 0) {
		const albumArtist = track.AlbumArtist?.trim();
		if (albumArtist) credits.push({ Name: albumArtist });
	}

	const albumArtist = track.AlbumArtist?.trim().toLocaleLowerCase();
	return credits.map((credit, index) => {
		if (credit.Id || !track.ArtistId) return credit;
		const isPrimaryArtist = albumArtist
			? credit.Name.trim().toLocaleLowerCase() === albumArtist
			: index === 0;
		return isPrimaryArtist ? { ...credit, Id: track.ArtistId } : credit;
	});
}

export function artistCreditsForAlbum(
	album: Pick<
		MediaItem,
		| "ArtistCredits"
		| "Artists"
		| "ContributingArtists"
		| "AlbumArtist"
		| "ArtistId"
	>,
	primaryArtist?: Pick<MediaItem, "Id" | "Name"> | null,
) {
	const credits =
		album.ArtistCredits && album.ArtistCredits.length > 0
			? normalizeArtistCredits(album.ArtistCredits)
			: normalizeArtistCredits([
					...(album.Artists ?? []).map((Name): ArtistCredit => ({ Name })),
					...(album.ContributingArtists ?? []).map((Name): ArtistCredit => ({
						Name,
					})),
				]);
	const primaryName = (primaryArtist?.Name ?? album.AlbumArtist)
		?.trim()
		.toLocaleLowerCase();
	const primaryId = primaryArtist?.Id ?? album.ArtistId;
	const primaryIndex = primaryName
		? credits.findIndex(
				(credit) => credit.Name.trim().toLocaleLowerCase() === primaryName,
			)
		: -1;

	if (credits.length === 0) {
		const fallbackName = primaryArtist?.Name?.trim() || album.AlbumArtist?.trim();
		return fallbackName
			? [{ Name: fallbackName, ...(primaryId ? { Id: primaryId } : {}) }]
			: [];
	}

	return credits.map((credit, index) => {
		if (credit.Id || !primaryId) return credit;
		const isPrimary = primaryIndex >= 0 ? index === primaryIndex : index === 0;
		return isPrimary ? { ...credit, Id: primaryId } : credit;
	});
}

export function formatTrackArtists(track: MediaItem | null | undefined) {
	return track ? formatArtistCredits(artistCreditsForTrack(track)) : "";
}
