import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ProgressProvider } from "@/components/status/progress-indicator";
import * as mediaApi from "@/lib/media-api";
import * as preferences from "@/lib/preferences";
import * as sessionApi from "@/lib/session";
import type { MediaItem } from "@/lib/media-api";

const navigation = vi.hoisted(() => ({
	pathname: "/album/album-1",
	searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useSearchParams: () => navigation.searchParams,
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/layout/mobile-nav", () => ({
	MobileNav: () => null,
}));

vi.mock("@/components/layout/navbar", () => ({
	Navbar: () => null,
}));

vi.mock("@/components/pages/audio-album-page", () => ({
	AudioAlbumPage: ({ data }: { data: { album: MediaItem } }) => (
		<div data-testid="audio-album-page">{data.album.Name}</div>
	),
}));

vi.mock("@/components/pages/artist-page", () => ({
	ArtistPage: ({ data }: { data: { artist: MediaItem } }) => (
		<div data-testid="artist-page">{data.artist.Name}</div>
	),
}));

vi.mock("@/components/audio/audio-player-provider", () => ({
	AudioPlayerProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/audio/audio-player-bar", () => ({
	AudioPlayerBar: () => null,
}));

vi.mock("@/lib/syncplay", () => ({
	SyncplayProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/syncplay/playback-follower", () => ({
	SyncplayPlaybackFollower: () => null,
}));

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((resolvePromise) => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function albumData(name: string) {
	return {
		album: {
			Id: "album-1",
			Name: name,
			Type: "MusicAlbum",
		} as MediaItem,
		artist: null,
		tracks: [],
		relatedAlbums: [],
	};
}

function artistData(name: string) {
	return {
		artist: {
			Id: "artist-1",
			Name: name,
			Type: "MusicArtist",
		} as MediaItem,
		albums: [],
		tracks: [],
		appearsIn: [],
		relatedArtists: [],
	};
}

describe("audio album route refreshes", () => {
	beforeEach(() => {
		navigation.pathname = "/album/album-1";
		navigation.searchParams = new URLSearchParams();
		vi.restoreAllMocks();
		vi.spyOn(sessionApi, "getAuthSession").mockReturnValue({
			token: "",
			userId: "user",
			username: "Alex",
		});
		vi.spyOn(mediaApi, "validateBrowserSession").mockResolvedValue({
			token: "",
			userId: "user",
			username: "Alex",
		});
		vi.spyOn(preferences, "getStoredLocale").mockReturnValue("en");
		vi.spyOn(preferences, "getLocalePreference").mockResolvedValue("en");
		vi.spyOn(preferences, "getMetadataLanguages").mockResolvedValue(["en"]);
		vi.spyOn(preferences, "getMetadataLanguagePreference").mockResolvedValue({
			mode: "auto",
			language: "en",
		});
		vi.spyOn(preferences, "getPlaybackPreference").mockResolvedValue({
			audioLanguage: null,
			subtitleLanguage: null,
			audioLanguages: [],
			subtitleLanguages: [],
		});
		vi.spyOn(preferences, "getWatchHistoryPreference").mockResolvedValue({
			enabled: true,
		});
		vi.spyOn(sessionApi, "setAuthCookies").mockImplementation(() => undefined);
		vi.spyOn(mediaApi, "primeArtworkTicket").mockResolvedValue(null);
		vi.spyOn(mediaApi, "primeResourceTicket").mockResolvedValue(null);
	});

	it("keeps the album mounted while refreshing play counts", async () => {
		const refresh = deferred<ReturnType<typeof albumData>>();
		const fetchAlbum = vi
			.spyOn(mediaApi, "fetchAudioAlbumData")
			.mockResolvedValueOnce(albumData("Before play"))
			.mockReturnValueOnce(refresh.promise);

		render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() =>
			expect(screen.getByTestId("audio-album-page")).toHaveTextContent(
				"Before play",
			),
		);

		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { reason: "refresh", rootEntityId: "track-1" },
				}),
			);
		});

		expect(fetchAlbum).toHaveBeenCalledTimes(2);
		expect(screen.getByTestId("audio-album-page")).toHaveTextContent(
			"Before play",
		);
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuetext",
			"Idle",
		);

		await act(async () => refresh.resolve(albumData("After play")));
		await waitFor(() =>
			expect(screen.getByTestId("audio-album-page")).toHaveTextContent(
				"After play",
			),
		);
	});

	it("does not abort the initial artist load during a catalog refresh", async () => {
		navigation.pathname = "/artist/artist-1";
		const initial = deferred<ReturnType<typeof artistData>>();
		const fetchArtist = vi
			.spyOn(mediaApi, "fetchArtistData")
			.mockReturnValue(initial.promise);

		render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() => expect(fetchArtist).toHaveBeenCalledTimes(1));
		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { reason: "refresh" },
				}),
			);
		});

		expect(fetchArtist).toHaveBeenCalledTimes(1);

		await act(async () => initial.resolve(artistData("Artist after scan")));
		await waitFor(() =>
			expect(screen.getByTestId("artist-page")).toHaveTextContent(
				"Artist after scan",
			),
		);
	});
});
