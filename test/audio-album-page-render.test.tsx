import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AudioAlbumPage } from "@/components/pages/audio-album-page";
import type { AudioAlbumData, MediaItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const playerActions = vi.hoisted(() => ({
	playTrack: vi.fn(),
	playAlbum: vi.fn(),
	addAlbumToQueue: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: {
		href: string;
		children: ReactNode;
		onClick?: React.MouseEventHandler<HTMLAnchorElement>;
		onKeyDown?: React.KeyboardEventHandler<HTMLAnchorElement>;
		className?: string;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/components/audio/audio-player-provider", () => ({
	useAudioPlayer: () => ({
		currentTrack: null,
		isPlaying: false,
		playTrack: playerActions.playTrack,
		playAlbum: playerActions.playAlbum,
		addAlbumToQueue: playerActions.addAlbumToQueue,
	}),
}));

vi.mock("@/components/audio/audio-playing-indicator", () => ({
	AudioPlayingIndicator: () => null,
}));

vi.mock("@/components/home/media-card", () => ({
	SquareAudioCard: () => null,
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => null,
}));

vi.mock("@/components/ui/horizontal-scroller", () => ({
	HorizontalScroller: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({ t: (key: string) => key }),
}));

const session: AuthSession = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};

function albumData(): AudioAlbumData {
	const track: MediaItem = {
		Id: "track-1",
		Name: "Track",
		Type: "Audio",
		TrackNumber: 1,
		DurationSeconds: 120,
		ArtistId: "artist-album",
		AlbumArtist: "Album Artist",
		ArtistCredits: [
			{ Name: "Album Artist" },
			{ Name: "Unresolved Guest" },
			{ Id: "artist-featured", Name: "Featured Artist" },
		],
	};

	return {
		album: {
			Id: "album-1",
			Name: "Album",
			Type: "MusicAlbum",
			AlbumArtist: "Album Artist",
		},
		artist: {
			Id: "artist-album",
			Name: "Album Artist",
			Type: "MusicArtist",
		},
		tracks: [track],
		relatedAlbums: [],
	};
}

describe("audio album track artist links", () => {
	it("links resolvable artists and keeps unresolved credits as text", () => {
		render(<AudioAlbumPage data={albumData()} session={session} />);

		const row = screen
			.getAllByRole("row")
			.find((candidate) => candidate.textContent?.includes("Track"));
		expect(row).toBeDefined();
		const trackRow = row as HTMLElement;

		expect(
			within(trackRow).getByRole("link", { name: "Album Artist" }),
		).toHaveAttribute("href", "/artist/artist-album");
		expect(
			within(trackRow).getByRole("link", { name: "Featured Artist" }),
		).toHaveAttribute("href", "/artist/artist-featured");
		expect(
			within(trackRow).queryByRole("link", { name: "Unresolved Guest" }),
		).toBeNull();
		expect(trackRow).toHaveTextContent("Unresolved Guest");
	});

	it("does not start playback when an artist link is clicked", () => {
		render(<AudioAlbumPage data={albumData()} session={session} />);

		const row = screen
			.getAllByRole("row")
			.find((candidate) => candidate.textContent?.includes("Track"));
		const artistLink = within(row as HTMLElement).getByRole("link", {
			name: "Featured Artist",
		});

		fireEvent.click(artistLink);

		expect(playerActions.playTrack).not.toHaveBeenCalled();
	});

	it("uses the primary album artist in the header and separate track links", () => {
		const data = albumData();
		data.album.Name = "new world";
		data.album.AlbumArtist = "Aiobahn";
		data.artist = {
			Id: "artist-aiobahn",
			Name: "Aiobahn",
			Type: "MusicArtist",
		};
		data.tracks[0].ArtistId = "artist-aiobahn";
		data.tracks[0].AlbumArtist = "Aiobahn";
		data.tracks[0].ArtistCredits = [
			{ Id: "artist-aiobahn", Name: "Aiobahn" },
			{ Id: "artist-uisekai", Name: "ヰ世界情緒" },
		];

		render(<AudioAlbumPage data={data} session={session} />);

		expect(
			screen
				.getAllByRole("link", { name: "Aiobahn" })
				.map((link) => link.getAttribute("href")),
		).toEqual(["/artist/artist-aiobahn", "/artist/artist-aiobahn"]);
		expect(screen.getByRole("link", { name: "ヰ世界情緒" })).toHaveAttribute(
			"href",
			"/artist/artist-uisekai",
		);
	});

	it("renders ordered co-release artists as separate header links", () => {
		const data = albumData();
		data.album.ArtistCredits = [
			{ Id: "artist-uisekai", Name: "ヰ世界情緒", JoinPhrase: "×" },
			{ Id: "artist-haruka", Name: "春猿火", JoinPhrase: "" },
		];
		data.album.AlbumArtist = "ヰ世界情緒";
		data.artist = {
			Id: "artist-uisekai",
			Name: "ヰ世界情緒",
			Type: "MusicArtist",
		};

		render(<AudioAlbumPage data={data} session={session} />);

		const header = screen.getByRole("heading", { name: "Album" }).parentElement;
		expect(header).toHaveTextContent("ヰ世界情緒×春猿火");
		expect(
			within(header as HTMLElement).getByRole("link", { name: "ヰ世界情緒" }),
		).toHaveAttribute("href", "/artist/artist-uisekai");
		expect(
			within(header as HTMLElement).getByRole("link", { name: "春猿火" }),
		).toHaveAttribute("href", "/artist/artist-haruka");
		expect(header).not.toHaveTextContent("ヰ世界情緒, 春猿火");
	});

	it("renders exact credit separators without merging artist links", () => {
		const data = albumData();
		data.tracks[0].ArtistCredits = [
			{ Id: "artist-album", Name: "ヰ世界情緒", JoinPhrase: "×" },
			{ Id: "artist-guest", Name: "春猿火", JoinPhrase: "" },
		];

		render(<AudioAlbumPage data={data} session={session} />);

		const row = screen
			.getAllByRole("row")
			.find((candidate) => candidate.textContent?.includes("Track"));
		if (!row) throw new Error("track row was not rendered");
		expect(row).toHaveTextContent("ヰ世界情緒×春猿火");
		expect(row).not.toHaveTextContent("ヰ世界情緒, 春猿火");
		expect(within(row).getByRole("link", { name: "ヰ世界情緒" })).toHaveAttribute(
			"href",
			"/artist/artist-album",
		);
		expect(within(row).getByRole("link", { name: "春猿火" })).toHaveAttribute(
			"href",
			"/artist/artist-guest",
		);
	});
});
