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
		ArtistId: "artist-1",
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
		ArtistId: "artist-1",
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

function StopHarness() {
	const player = useAudioPlayer();
	const seeded = useRef(false);

	useEffect(() => {
		if (seeded.current) return;
		seeded.current = true;
		player.playAlbum(album, tracks);
	}, [player]);

	return (
		<>
			<AudioPlayerBar />
			<button type="button" onClick={() => player.playAlbum(album, tracks)}>
				Start fresh queue
			</button>
		</>
	);
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
		for (const [name, href] of [
			["Track One", "/album/album-1?trackId=track-1"],
			["Track Artist", "/artist/artist-1"],
			["Album One", "/album/album-1"],
		] as const) {
			const links = screen.getAllByRole("link", { name });
			expect(links.length).toBe(2);
			for (const link of links) {
				expect(link).toHaveAttribute("href", href);
				expect(link).toHaveClass("hover:underline");
			}
		}
		expect(
			bar.querySelectorAll('img[src*="/images/Primary"]').length,
		).toBeGreaterThan(0);
		expect(
			bar.querySelector('img[src*="/images/Backdrop"]'),
		).not.toBeInTheDocument();
		expect(
			Array.from(bar.children).some(
				(element) => element.getAttribute("aria-hidden") === "true",
			),
		).toBe(false);
		expect(bar).toHaveClass("zenstream-audio-player-bar");
		expect(screen.getAllByRole("slider", { name: "Volume" })[0]).toHaveClass(
			"zenstream-audio-volume-slider",
		);
		expect(
			Array.from(bar.querySelectorAll("p")).some((element) =>
				element.classList.contains("text-[18px]"),
			),
		).toBe(true);
		expect(
			Array.from(bar.querySelectorAll("p")).filter((element) =>
				element.classList.contains("text-[14px]"),
			).length,
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.getAllByRole("button", { name: "Shuffle" }).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByRole("button", { name: "Shuffle" })[0]).toHaveClass(
			"text-white/35",
		);
		expect(
			screen.getAllByRole("button", { name: "Previous" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Next" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Stop playing" }).length,
		).toBeGreaterThan(0);
		expect(
			screen.getAllByRole("button", { name: "Queue" }).length,
		).toBeGreaterThan(0);
		const queueButton = screen.getAllByRole("button", { name: "Queue" })[0];
		const favoriteButton = screen.getAllByRole("button", {
			name: /add to favorites/i,
		})[0];
		expect(
			favoriteButton.compareDocumentPosition(queueButton) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			screen.getAllByRole("button", { name: "Loop off" }).length,
		).toBeGreaterThan(0);
		expect(screen.getAllByRole("button", { name: "Loop off" })[0]).toHaveClass(
			"text-white/35",
		);
		expect(
			screen.queryByRole("button", {
				name: /star|rating|timer|auto dj|lyrics/i,
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
		fireEvent.click(screen.getAllByRole("button", { name: "Loop off" })[0]);
		expect(
			screen.getAllByRole("button", { name: "Loop queue" }).length,
		).toBeGreaterThan(0);
		fireEvent.click(screen.getAllByRole("button", { name: "Loop queue" })[0]);
		expect(
			screen.getAllByRole("button", { name: "Loop current track" }).length,
		).toBeGreaterThan(0);
		fireEvent.click(
			screen.getAllByRole("button", { name: "Loop current track" })[0],
		);
		expect(
			screen.getAllByRole("button", { name: "Loop off" }).length,
		).toBeGreaterThan(0);

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

	it("keeps the final queue item inside the scrollable drawer", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		const queue = screen.getByRole("dialog", { name: "Queue" });
		const list = queue.querySelector(".zenstream-audio-player-queue-list");

		expect(list).toHaveClass("min-h-0", "flex-1", "overflow-y-auto", "pb-3");
		expect(queue).toHaveClass("flex", "flex-col", "bg-black", "border-white/10");
		expect(queue).not.toHaveClass("bg-[#151419]/[0.98]", "backdrop-blur-2xl");
		expect(
			queue.querySelector(".zenstream-audio-player-queue-current"),
		).toHaveClass("bg-white/[0.08]");
		expect(
			screen.getByRole("button", { name: "Play Track Two" }),
		).toBeInTheDocument();
	});

	it("fully clears the player and allows a fresh queue to start", async () => {
		render(
			<I18nProvider locale="en">
				<AudioPlayerProvider session={session}>
					<StopHarness />
				</AudioPlayerProvider>
			</I18nProvider>,
		);
		await screen.findByTestId("audio-player-bar");
		const audio = document.querySelector("audio");
		if (!audio) throw new Error("audio element was not rendered");

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		expect(screen.getByRole("dialog", { name: "Queue" })).toBeInTheDocument();
		const pauseMock = vi.mocked(HTMLMediaElement.prototype.pause);
		const pauseCallsBeforeStop = pauseMock.mock.calls.length;

		fireEvent.click(screen.getAllByRole("button", { name: "Stop playing" })[0]);

		await waitFor(() =>
			expect(screen.queryByTestId("audio-player-bar")).not.toBeInTheDocument(),
		);
		expect(
			screen.queryByRole("dialog", { name: "Queue" }),
		).not.toBeInTheDocument();
		expect(audio.getAttribute("src")).toBeNull();
		expect(pauseMock.mock.calls.length).toBeGreaterThan(pauseCallsBeforeStop);

		fireEvent.click(screen.getByRole("button", { name: "Start fresh queue" }));
		await screen.findByTestId("audio-player-bar");
		expect(screen.getAllByText("Track One").length).toBeGreaterThan(0);
	});

	it("advances, wraps, and repeats according to the selected loop mode", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");
		const audio = document.querySelector("audio");
		if (!audio) throw new Error("audio element was not rendered");

		fireEvent.click(screen.getAllByRole("button", { name: "Loop off" })[0]);
		fireEvent.ended(audio);
		await waitFor(() =>
			expect(screen.getAllByText("Track Two").length).toBeGreaterThan(0),
		);

		fireEvent.ended(audio);
		await waitFor(() =>
			expect(screen.getAllByText("Track One").length).toBeGreaterThan(0),
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Loop queue" })[0]);
		const playMock = vi.mocked(HTMLMediaElement.prototype.play);
		const playCallsBeforeSingleLoop = playMock.mock.calls.length;
		fireEvent.ended(audio);
		await waitFor(() =>
			expect(playMock.mock.calls.length).toBeGreaterThan(
				playCallsBeforeSingleLoop,
			),
		);
		expect(screen.getAllByText("Track One").length).toBeGreaterThan(0);
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
