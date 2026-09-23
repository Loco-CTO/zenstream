import { catalogRequest, toMediaItem, type CatalogItem } from "@/lib/catalog";
import type { AuthSession } from "@/lib/session";
import type { MediaItem } from "@/lib/media-api";

export type PlaylistEntry = {
	entryId: string;
	position: number;
	addedAt: string;
	item: MediaItem;
};

export type PlaylistSummary = {
	id: string;
	name: string;
	description: string | null;
	isPrivate: boolean;
	shareToken?: string | null;
	itemCount: number;
	artworkItems: MediaItem[];
	createdAt: string;
	updatedAt: string;
	isOwner: boolean;
};

export type Playlist = PlaylistSummary & { items: PlaylistEntry[] };

type PlaylistPayload = Omit<Playlist, "artworkItems" | "items"> & {
	artworkItems?: CatalogItem[];
	items?: Array<{
		entryId: string;
		position: number;
		addedAt: string;
		item: CatalogItem;
	}>;
};

function mapPlaylist(value: PlaylistPayload): Playlist {
	return {
		...value,
		artworkItems: (value.artworkItems ?? []).map(toMediaItem),
		items: (value.items ?? []).map((entry) => ({
			...entry,
			item: toMediaItem(entry.item),
		})),
	};
}

export async function fetchWatchlist(session: AuthSession) {
	const response = await catalogRequest<{ items: CatalogItem[] }>(
		session,
		"/api/catalog/following",
	);
	return response.items.map(toMediaItem);
}

export async function fetchPlaylists(session: AuthSession) {
	const response = await catalogRequest<{ items: PlaylistPayload[] }>(
		session,
		"/api/account/playlists",
	);
	return response.items.map(mapPlaylist);
}

export async function fetchPlaylist(session: AuthSession, playlistId: string) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}`,
	);
	return mapPlaylist(response);
}

export async function fetchSharedPlaylist(session: AuthSession, token: string) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		`/api/shared/playlists/${encodeURIComponent(token)}`,
	);
	return mapPlaylist(response);
}

export async function createPlaylist(
	session: AuthSession,
	input: {
		name: string;
		description?: string;
		isPrivate?: boolean;
		entityId?: string;
	},
) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		"/api/account/playlists",
		{
			method: "POST",
			body: JSON.stringify({ isPrivate: true, ...input }),
		},
	);
	return mapPlaylist(response);
}

export async function updatePlaylist(
	session: AuthSession,
	playlistId: string,
	input: { name?: string; description?: string | null; isPrivate?: boolean },
) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}`,
		{ method: "PATCH", body: JSON.stringify(input) },
	);
	return mapPlaylist(response);
}

export async function deletePlaylist(session: AuthSession, playlistId: string) {
	await catalogRequest<void>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}`,
		{ method: "DELETE" },
	);
}

export async function addPlaylistItems(
	session: AuthSession,
	playlistId: string,
	entityIds: string[],
) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}/items`,
		{ method: "POST", body: JSON.stringify({ entityIds }) },
	);
	return mapPlaylist(response);
}

export async function removePlaylistEntry(
	session: AuthSession,
	playlistId: string,
	entryId: string,
) {
	const response = await catalogRequest<PlaylistPayload | null>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}/items/${encodeURIComponent(entryId)}`,
		{ method: "DELETE" },
	);
	return response ? mapPlaylist(response) : fetchPlaylist(session, playlistId);
}

export async function reorderPlaylist(
	session: AuthSession,
	playlistId: string,
	entryIds: string[],
) {
	const response = await catalogRequest<PlaylistPayload>(
		session,
		`/api/account/playlists/${encodeURIComponent(playlistId)}/order`,
		{ method: "PUT", body: JSON.stringify({ entryIds }) },
	);
	return mapPlaylist(response);
}
