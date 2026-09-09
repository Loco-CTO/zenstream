import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArtistPage } from "@/components/pages/artist-page";
import type { ArtistData, MediaItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const playerActions = vi.hoisted(() => ({ playAlbum: vi.fn() }));
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
const followActions = vi.hoisted(() => ({ setFollowing: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: {
		href: string;
		children: ReactNode;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/components/audio/audio-player-provider", () => ({
	useAudioPlayer: () => ({ playAlbum: playerActions.playAlbum }),
}));

vi.mock("@/lib/media-api", async () => ({
	...(await vi.importActual<typeof import("@/lib/media-api")>(
		"@/lib/media-api",
	)),
	setFollowing: followActions.setFollowing,
}));

vi.mock("@/components/home/media-card", () => ({
	SquareAudioCard: ({ item }: { item: MediaItem }) => (
		<a href={`/album/${item.Id}`}>{item.Name}</a>
	),
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => null,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string, values?: { count?: number }) =>
			values?.count == null ? key : `${key}:${values.count}`,
	}),
}));

const session: AuthSession = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};

function item(
	id: string,
	name: string,
	metadata: Partial<MediaItem> = {},
): MediaItem {
	return { Id: id, Name: name, Type: "MusicAlbum", ...metadata };
}

function artistData(): ArtistData {
	return {
		artist: {
			Id: "artist-1",
			Name: "Artist One",
			Type: "MusicArtist",
			Overview: "An artist overview.",
			Tags: ["Orchestral"],
		},
		albums: [
			item("album-1", "Album", { AlbumType: "Album" }),
			item("ep-1", "EP", { AlbumType: "EP" }),
			item("live-1", "Live", {
				AlbumType: "Album",
				AlbumSecondaryTypes: ["Live"],
			}),
			item("single-1", "Single", { AlbumType: "Single" }),
		],
		appearsIn: [item("appears-1", "Appears In")],
		tracks: [
			{ Id: "track-1", Name: "Track 1", Type: "Audio" },
			{ Id: "track-2", Name: "Track 2", Type: "Audio" },
		],
		relatedArtists: [{ Id: "artist-2", Name: "Artist Two", Type: "MusicArtist" }],
	};
}

describe("artist page", () => {
	it("returns to the previous view instead of routing to the library", () => {
		render(<ArtistPage data={artistData()} session={session} />);

		const originalHistoryLength = window.history.length;
		window.history.pushState({}, "", "/artist/artist-1");
		fireEvent.click(screen.getByRole("button", { name: "back" }));

		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
		window.history.go(-(window.history.length - originalHistoryLength));
	});

	it("renders the redesigned release sections and related artist links", () => {
		render(<ArtistPage data={artistData()} session={session} />);

		for (const label of [
			"artistAppearsIn",
			"artistAlbums",
			"artistEps",
			"artistSingles",
			"artistLive",
			"relatedArtists",
		]) {
			expect(screen.getByText(label)).toBeInTheDocument();
		}
		expect(screen.getByRole("link", { name: "Artist Two" })).toHaveAttribute(
			"href",
			"/artist/artist-2",
		);
	});

	it("plays every credited track from the hero action", () => {
		const data = artistData();
		render(<ArtistPage data={data} session={session} />);

		fireEvent.click(screen.getByRole("button", { name: "playAll" }));

		expect(playerActions.playAlbum).toHaveBeenCalledWith(
			data.artist,
			data.tracks,
		);
	});

	it("follows the artist and rolls back when the mutation fails", async () => {
		followActions.setFollowing.mockResolvedValueOnce(undefined);
		const data = artistData();
		data.artist.UserData = { IsFollowing: false };
		render(<ArtistPage data={data} session={session} />);

		fireEvent.click(screen.getByRole("button", { name: "follow" }));
		expect(screen.getByRole("button", { name: "unfollow" })).toBeInTheDocument();
		await waitFor(() =>
			expect(followActions.setFollowing).toHaveBeenCalledWith(
				session,
				"artist-1",
				true,
			),
		);

		followActions.setFollowing.mockRejectedValueOnce(new Error("failed"));
		fireEvent.click(screen.getByRole("button", { name: "unfollow" }));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "unfollow" })).toBeInTheDocument(),
		);
		expect(screen.getByRole("alert")).toHaveTextContent("detailLoadFailed");
	});
});
