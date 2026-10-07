import type { MediaItem } from "@/lib/media-api";

export function detailHref(item: MediaItem) {
	if (item.Type === "BoxSet") return `/collection/${item.Id}`;
	if (item.Type === "MusicArtist") return `/artist/${item.Id}`;
	if (item.Type === "MusicAlbum") return `/album/${item.Id}`;
	if (item.Type === "Audio") return audioHref(item);
	return item.Type === "Episode" && item.SeriesId
		? `/show/${item.SeriesId}/episode/${item.Id}`
		: `/show/${item.Id}`;
}

export function audioHref(item: MediaItem) {
	if (item.Type === "MusicArtist") return `/artist/${item.Id}`;
	if (item.Type === "MusicAlbum") return `/album/${item.Id}`;
	if (item.Type === "Audio" && item.AlbumId)
		return `/album/${item.AlbumId}?trackId=${encodeURIComponent(item.Id)}`;
	return `/album/${item.Id}`;
}
