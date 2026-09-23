import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistDetailPage } from "@/components/pages/playlist-detail-page";
import type { Playlist } from "@/lib/playlists";
import type { AuthSession } from "@/lib/session";

const player = vi.hoisted(() => ({
	currentTrack: null,
	isPlaying: false,
	playAlbum: vi.fn(),
}));
const api = vi.hoisted(() => ({ fetchPlaylist: vi.fn() }));

vi.mock("next/link", () => ({
	default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
		<a href={href} {...props}>{children}</a>
	),
}));

vi.mock("@/components/audio/audio-player-provider", () => ({
	useAudioPlayer: () => player,
}));

vi.mock("@/lib/playlists", () => ({
	fetchPlaylist: api.fetchPlaylist,
	deletePlaylist: vi.fn(),
	fetchSharedPlaylist: vi.fn(),
	removePlaylistEntry: vi.fn(),
	reorderPlaylist: vi.fn(),
	updatePlaylist: vi.fn(),
}));

vi.mock("@/lib/media-api", async () => ({
	...(await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api")),
	seriesPosterImage: () => null,
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => <div />,
}));

vi.mock("@/components/status/error-panel", () => ({
	ErrorPanel: ({ message }: { message: string }) => <p>{message}</p>,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string, values?: { count?: number; name?: string }) => {
			if (values?.count != null) return `${key}:${values.count}`;
			if (values?.name != null) return `${key}:${values.name}`;
			return key;
		},
	}),
}));

const session: AuthSession = { token: "token", userId: "user-1", username: "Alex" };
const tracks = [
	{ Id: "track-1", Name: "Track One", Type: "Audio" },
	{ Id: "track-2", Name: "Track Two", Type: "Audio" },
];
const detail: Playlist = {
	id: "playlist-1",
	name: "Road Mix",
	description: null,
	isPrivate: true,
	itemCount: tracks.length,
	artworkItems: [],
	createdAt: "",
	updatedAt: "",
	isOwner: true,
	items: tracks.map((item, index) => ({
		entryId: `entry-${index + 1}`,
		position: index,
		addedAt: "2026-09-01T12:00:00Z",
		item,
	})),
};

describe("playlist detail playback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		player.currentTrack = null;
		player.isPlaying = false;
		api.fetchPlaylist.mockResolvedValue(detail);
	});

	it("plays the playlist queue and preserves the selected start track", async () => {
		render(<PlaylistDetailPage session={session} playlistId={detail.id} />);
		const playAll = await screen.findByRole("button", { name: "playAll" });
		fireEvent.click(playAll);

		const syntheticPlaylist = {
			Id: detail.id,
			Name: detail.name,
			Type: "MusicAlbum",
		};
		expect(player.playAlbum).toHaveBeenLastCalledWith(syntheticPlaylist, tracks);

		fireEvent.click(screen.getByRole("button", { name: "play Track Two" }));
		expect(player.playAlbum).toHaveBeenLastCalledWith(
			syntheticPlaylist,
			tracks,
			"track-2",
			undefined,
			true,
		);
	});
});
