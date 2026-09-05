import { useEffect, useRef } from "react";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioPlayerBar } from "@/components/audio/audio-player-bar";
import {
	AudioPlayerProvider,
	useAudioPlayer,
} from "@/components/audio/audio-player-provider";
import { I18nProvider } from "@/lib/i18n";
import * as mediaApi from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

const session = { token: "token", userId: "user", username: "Alex" };
const album: MediaItem = {
	Id: "album-1",
	Name: "Album One",
	Type: "MusicAlbum",
	AlbumArtist: "Album Artist",
};
const tracks: MediaItem[] = [
	{
		Id: "track-1",
		Name: "Track One",
		Type: "Audio",
		AlbumId: album.Id,
		Album: album.Name,
		Artists: ["Track Artist"],
		AlbumArtist: album.AlbumArtist,
		DurationSeconds: 214,
		ImageTags: { Primary: "/api/catalog/items/track-1/images/Primary" },
		UserData: { IsFavorite: false },
	},
	{
		Id: "track-2",
		Name: "Track Two",
		Type: "Audio",
		AlbumId: album.Id,
		Album: album.Name,
		ContributingArtists: ["Second Artist"],
		AlbumArtist: album.AlbumArtist,
		DurationSeconds: 185,
		ImageTags: { Primary: "/api/catalog/items/track-2/images/Primary" },
		UserData: { IsFavorite: false },
	},
];

function SeededBar() {
	const player = useAudioPlayer();
	const seeded = useRef(false);

	useEffect(() => {
		if (seeded.current) return;
		seeded.current = true;
		player.playAlbum(album, tracks);
	}, [player]);

	return <AudioPlayerBar />;
}

function renderBar() {
	return render(
		<I18nProvider locale="en">
			<AudioPlayerProvider session={session}>
				<SeededBar />
			</AudioPlayerProvider>
		</I18nProvider>,
	);
}

describe("AudioPlayerBar", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(mediaApi, "getPlaybackInfo").mockResolvedValue({
			source: { url: "/api/catalog/audio/track-1", mode: "direct" },
			sessionId: undefined,
			startPositionSeconds: 0,
			viewerSessionId: undefined,
		});
		vi.spyOn(mediaApi, "recordAudioPlayStart").mockResolvedValue(undefined);
		vi.spyOn(mediaApi, "reportPlayback").mockResolvedValue(undefined);
		vi.spyOn(mediaApi, "setFavorite").mockResolvedValue(undefined);
		vi
			.spyOn(HTMLMediaElement.prototype, "load")
			.mockImplementation(() => undefined);
		vi
			.spyOn(HTMLMediaElement.prototype, "pause")
			.mockImplementation(() => undefined);
		vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("renders primary artwork, track metadata, and only supported controls", async () => {
		const view = renderBar();
		const bar = await screen.findByTestId("audio-player-bar");

		expect(bar).toHaveTextContent("Track One");
		expect(bar).toHaveTextContent("Track Artist");
		expect(bar).toHaveTextContent("Album One");
		expect(
			bar.querySelectorAll('img[src*="/images/Primary"]').length,
		).toBeGreaterThan(0);
		expect(
			bar.querySelector('img[src*="/images/Backdrop"]'),
		).not.toBeInTheDocument();
		expect(bar).toHaveClass("zenstream-audio-player-bar");
		expect(screen.getAllByRole("slider", { name: "Volume" })[0]).toHaveClass(
			"zenstream-audio-volume-slider",
		);
		expect(
			screen.getAllByRole("button", { name: "Shuffle" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Previous" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Next" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Queue" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.queryByRole("button", {
				name: /star|rating|timer|auto dj|repeat|lyrics|stop/i,
			}),
		).not.toBeInTheDocument();
		view.unmount();
	});

	it("wires transport, seek, volume, shuffle, favorite, and queue actions", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Shuffle" })[0]);
		expect(screen.getAllByRole("button", { name: "Shuffle" })[0]).toHaveAttribute(
			"aria-pressed",
			"true",
		);

		fireEvent.change(screen.getAllByRole("slider", { name: "Volume" })[0], {
			target: { value: "0.4" },
		});
		expect(screen.getAllByRole("slider", { name: "Volume" })[0]).toHaveValue(
			"0.4",
		);
		fireEvent.click(screen.getAllByRole("button", { name: "Mute" })[0]);
		expect(
			screen.getAllByRole("button", { name: "Unmute" }).length,
		).toBeGreaterThan(0);

		fireEvent.change(screen.getAllByRole("slider", { name: "Duration" })[0], {
			target: { value: "42" },
		});
		expect(screen.getAllByRole("slider", { name: "Duration" })[0]).toHaveValue(
			"42",
		);

		fireEvent.click(
			screen.getAllByRole("button", { name: /add to favorites/i })[0],
		);
		await waitFor(() =>
			expect(mediaApi.setFavorite).toHaveBeenCalledWith(session, "track-1", true),
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		expect(screen.getByRole("dialog", { name: "Queue" })).toBeInTheDocument();
		expect(screen.getByRole("dialog", { name: "Queue" })).toHaveClass(
			"zenstream-audio-player-queue",
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
		await waitFor(() =>
			expect(screen.getAllByText("Track Two").length).toBeGreaterThan(0),
		);
		fireEvent.click(screen.getAllByRole("button", { name: "Previous" })[0]);
		await waitFor(() =>
			expect(screen.getAllByText("Track One").length).toBeGreaterThan(0),
		);
	});

	it("shows playback errors without removing the bar", async () => {
		vi
			.mocked(mediaApi.getPlaybackInfo)
			.mockRejectedValueOnce(new Error("Audio failed"));
		renderBar();

		const bar = await screen.findByTestId("audio-player-bar");
		await waitFor(() => expect(bar).toHaveTextContent("Audio failed"));
		expect(bar).toBeInTheDocument();
	});
});
