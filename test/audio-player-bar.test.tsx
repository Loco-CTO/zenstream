import { useEffect, useRef } from "react";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
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
		ArtistCredits: [
			{ Id: "artist-1", Name: "Second Artist", JoinPhrase: " feat. " },
			{ Name: "Guest Artist", JoinPhrase: "" },
		],
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
		vi.spyOn(mediaApi, "getAudioLyrics").mockResolvedValue(null);
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
		const volumeSlider = screen.getAllByRole("slider", { name: "Volume" })[0];
		expect(
			queueButton.compareDocumentPosition(volumeSlider) &
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
				name: /star|rating|timer|auto dj/i,
			}),
		).not.toBeInTheDocument();
		expect(
			screen.getAllByRole("button", { name: "Open lyrics" }).length,
		).toBeGreaterThan(0);
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
		expect(screen.getByTestId("audio-lyrics-overlay")).toBeInTheDocument();
		expect(screen.getByTestId("audio-next-up-panel")).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute(
			"aria-selected",
			"true",
		);

		fireEvent.click(screen.getAllByRole("button", { name: "Next" })[0]);
		await waitFor(() =>
			expect(screen.getAllByText("Track Two").length).toBeGreaterThan(0),
		);
		fireEvent.click(screen.getAllByRole("button", { name: "Previous" })[0]);
		await waitFor(() =>
			expect(screen.getAllByText("Track One").length).toBeGreaterThan(0),
		);
		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		await waitFor(() =>
			expect(screen.getByTestId("audio-lyrics-overlay")).toHaveAttribute(
				"data-open",
				"false",
			),
		);
	});

	it("keeps the final queue item inside the queue page", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		const queue = screen.getByTestId("audio-next-up-panel");

		expect(
			queue.querySelector(".min-h-0.flex-1.overflow-y-auto"),
		).toBeInTheDocument();
		expect(queue).not.toHaveClass("bg-black", "bg-[#151419]/[0.98]");
		expect(queue.querySelector('[data-track-id="track-1"]')).toHaveClass(
			"bg-white/[0.08]",
		);
		const firstItem = queue.querySelector('[data-track-id="track-1"]');
		if (!firstItem) throw new Error("first queue item was not rendered");
		expect(
			within(firstItem as HTMLElement).getByRole("button", {
				name: "Play Track One",
			}),
		).toHaveTextContent("Track One");
		const firstArtist = within(firstItem as HTMLElement).getByRole("link", {
			name: "Track Artist",
		});
		expect(firstArtist).toHaveAttribute("href", "/artist/artist-1");
		expect(firstArtist).toHaveClass("hover:underline");
		expect(
			within(queue).queryByRole("button", { name: "Move up" }),
		).not.toBeInTheDocument();
		expect(
			within(queue).queryByRole("button", { name: "Move down" }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Play Track Two" }),
		).toBeInTheDocument();
	});

	it("reorders queue items by dragging them directly", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		const queue = screen.getByTestId("audio-next-up-panel");
		expect(queue).not.toHaveTextContent("Next Up");
		const list = queue.querySelector('[data-testid="audio-queue-list"]');
		if (!list) throw new Error("queue list was not rendered");
		const items = list.querySelectorAll("[data-track-id]");
		expect(items).toHaveLength(2);

		fireEvent.dragStart(items[0]);
		fireEvent.dragOver(items[1]);
		expect(items[1].querySelector("span.pointer-events-none")).toHaveClass(
			"bg-white/85",
		);
		expect(items[1]).not.toHaveClass("bg-white/[0.1]");
		fireEvent.drop(items[1]);

		await waitFor(() => {
			const orderedItems = Array.from(
				list.querySelectorAll("[data-track-id]"),
			).sort(
				(a, b) =>
					Number(a.getAttribute("data-queue-index")) -
					Number(b.getAttribute("data-queue-index")),
			);
			expect(orderedItems[0]).toHaveAttribute("data-track-id", "track-2");
			expect(orderedItems[1]).toHaveAttribute("data-track-id", "track-1");
		});
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
		expect(screen.getByTestId("audio-lyrics-overlay")).toBeInTheDocument();
		const pauseMock = vi.mocked(HTMLMediaElement.prototype.pause);
		const pauseCallsBeforeStop = pauseMock.mock.calls.length;

		fireEvent.click(screen.getAllByRole("button", { name: "Stop playing" })[0]);

		await waitFor(() =>
			expect(screen.queryByTestId("audio-player-bar")).not.toBeInTheDocument(),
		);
		expect(screen.queryByTestId("audio-lyrics-overlay")).not.toBeInTheDocument();
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

	it("switches between lyrics and queue without closing the overlay", async () => {
		vi.mocked(mediaApi.getAudioLyrics).mockResolvedValue({
			source: "sidecar",
			timed: false,
			language: null,
			lines: [{ text: "Plain lyrics" }],
		});
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Open lyrics" })[0]);
		const overlay = await screen.findByTestId("audio-lyrics-overlay");
		expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		expect(
			screen.getAllByRole("button", { name: "Open lyrics" })[0],
		).toHaveAttribute("aria-pressed", "true");

		fireEvent.click(screen.getAllByRole("button", { name: "Queue" })[0]);
		expect(overlay).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		expect(
			screen.getAllByRole("button", { name: "Open lyrics" })[0],
		).not.toHaveAttribute("aria-pressed");

		fireEvent.click(screen.getAllByRole("button", { name: "Open lyrics" })[0]);
		expect(overlay).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Lyrics" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("opens local lyrics, follows playback, and keeps the player bar mounted", async () => {
		vi.mocked(mediaApi.getAudioLyrics).mockResolvedValue({
			source: "sidecar",
			timed: true,
			language: null,
			lines: [
				{ text: "First line", startSeconds: 0, endSeconds: 4 },
				{ text: "Second line", startSeconds: 4, endSeconds: 8 },
			],
		});
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Open lyrics" })[0]);
		const overlay = await screen.findByTestId("audio-lyrics-overlay");
		expect(overlay).toHaveAttribute("role", "dialog");
		expect(overlay).toHaveTextContent("First line");
		expect(overlay).toHaveTextContent("Second line");
		expect(overlay).toHaveClass("zenstream-audio-lyrics-overlay");
		expect(
			screen.getByRole("button", { name: "Seek to lyric First line" }),
		).toHaveClass(
			"zenstream-audio-lyrics-line",
			"transition-[color,transform,opacity,scale]",
			"scale-[1.08]",
			"text-white",
		);
		expect(overlay.querySelector(".zenstream-audio-lyrics-panel")).toHaveClass(
			"overflow-x-hidden",
		);
		expect(screen.getByTestId("audio-player-bar")).toBeInTheDocument();
		expect(
			overlay.querySelector('img[src*="/images/Backdrop"]'),
		).not.toBeInTheDocument();
		expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute(
			"aria-selected",
			"false",
		);
		const lyricsPanel = overlay.querySelector<HTMLElement>(
			".zenstream-audio-lyrics-panel",
		);
		if (!lyricsPanel) throw new Error("lyrics panel was not rendered");
		fireEvent.scroll(lyricsPanel);
		expect(
			screen.queryByRole("button", { name: "Resume follow" }),
		).not.toBeInTheDocument();
		fireEvent.wheel(lyricsPanel, { deltaY: 120 });
		expect(
			screen.getByRole("button", { name: "Resume follow" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("tab", { name: "Queue" }));
		expect(screen.getByTestId("audio-next-up-panel")).toHaveTextContent(
			"Track Two",
		);
		fireEvent.click(screen.getByRole("tab", { name: "Lyrics" }));
		expect(overlay).toHaveTextContent("First line");

		fireEvent.keyDown(document, { key: "Escape" });
		await waitFor(() => expect(overlay).toHaveAttribute("data-open", "false"));
	});

	it("keeps next-up rows stable and uses the album playing indicator", async () => {
		renderBar();
		await screen.findByTestId("audio-player-bar");

		fireEvent.click(screen.getAllByRole("button", { name: "Open lyrics" })[0]);
		const overlay = await screen.findByTestId("audio-lyrics-overlay");
		fireEvent.click(screen.getByRole("tab", { name: "Queue" }));

		const panel = within(overlay).getByTestId("audio-next-up-panel");
		expect(panel.querySelectorAll('span[style*="pulse"]')).toHaveLength(6);
		expect(
			panel.querySelector('span[aria-hidden="true"] > span.h-2'),
		).toHaveClass("w-4");
		expect(panel.querySelectorAll(".relative.h-10")).toHaveLength(3);
		const secondItem = panel.querySelector('[data-track-id="track-2"]');
		if (!secondItem) throw new Error("second queue item was not rendered");
		expect(secondItem).toHaveTextContent("Second Artist feat. Guest Artist");
		expect(
			within(secondItem as HTMLElement).getByRole("link", {
				name: "Second Artist feat. Guest Artist",
			}),
		).toHaveAttribute("href", "/artist/artist-1");
	});
});
