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
});
