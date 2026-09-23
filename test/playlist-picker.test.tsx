import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistPicker } from "@/components/audio/playlist-picker";
import type { Playlist, PlaylistSummary } from "@/lib/playlists";
import type { AuthSession } from "@/lib/session";

const api = vi.hoisted(() => ({
	add: vi.fn(),
	create: vi.fn(),
	fetch: vi.fn(),
	get: vi.fn(),
	remove: vi.fn(),
}));

vi.mock("@/lib/playlists", () => ({
	addPlaylistItems: api.add,
	createPlaylist: api.create,
	fetchPlaylists: api.fetch,
	fetchPlaylist: api.get,
	removePlaylistEntry: api.remove,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string, values?: { name?: string }) =>
			values?.name == null ? key : `${key}:${values.name}`,
	}),
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => <div />,
}));

const session: AuthSession = { token: "token", userId: "user-1", username: "Alex" };

function summary(id = "playlist-1"): PlaylistSummary {
	return {
		id,
		name: "Road Mix",
		description: null,
		isPrivate: true,
		itemCount: 0,
		artworkItems: [],
		createdAt: "",
		updatedAt: "",
		isOwner: true,
	};
}

function playlist(items: Playlist["items"] = []): Playlist {
	return { ...summary(), items, itemCount: items.length };
}

describe("audio playlist picker", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		api.fetch.mockResolvedValue([summary()]);
		api.get.mockResolvedValue(playlist());
		api.add.mockResolvedValue(playlist([
			{
				entryId: "entry-1",
				position: 0,
				addedAt: "2026-09-01T12:00:00Z",
				item: { Id: "track-1", Name: "Track One", Type: "Audio" },
			},
		]));
		api.create.mockResolvedValue(playlist());
		api.remove.mockResolvedValue(playlist());
	});

	it("adds the selected audio track and updates its membership indicator", async () => {
		render(
			<PlaylistPicker
				session={session}
				entityId="track-1"
				entityName="Track One"
				trackIds={["track-1"]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "addToPlaylist" }));
		fireEvent.click(await screen.findByRole("button", { name: /Road Mix/ }));

		expect(api.add).toHaveBeenCalledWith(session, "playlist-1", ["track-1"]);
		await waitFor(() => expect(screen.getByLabelText("inPlaylist")).toBeInTheDocument());
	});

	it("sends an album source for server-side track expansion", async () => {
		render(
			<PlaylistPicker
				session={session}
				entityId="album-1"
				entityName="Album One"
				trackIds={["track-1", "track-2"]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "addToPlaylist" }));
		fireEvent.click(await screen.findByRole("button", { name: /Road Mix/ }));

		expect(api.add).toHaveBeenCalledWith(session, "playlist-1", ["album-1"]);
	});

	it("creates a playlist from the picker with the selected source attached", async () => {
		render(
			<PlaylistPicker
				session={session}
				entityId="album-1"
				entityName="Album One"
				trackIds={["track-1", "track-2"]}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "addToPlaylist" }));
		fireEvent.click(await screen.findByRole("button", { name: "createPlaylist" }));
		fireEvent.change(screen.getByPlaceholderText("playlistName"), {
			target: { value: "Album Favorites" },
		});
		fireEvent.click(screen.getByRole("button", { name: "create" }));

		await waitFor(() => expect(api.create).toHaveBeenCalledWith(
			session,
			expect.objectContaining({
				name: "Album Favorites",
				isPrivate: true,
				entityId: "album-1",
			}),
		));
	});
});
