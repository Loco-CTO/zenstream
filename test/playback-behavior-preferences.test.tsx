import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
	PlaybackBehaviorPreferencesProvider,
	playbackBehaviorStorageKey,
	usePlaybackBehaviorPreferences,
} from "@/components/playback-behavior-preferences-provider";
import {
	HoverPreviewVideo,
	useHoverPreview,
} from "@/components/ui/hover-preview";
import { getPlaybackInfo, playbackUrl } from "@/lib/media-api";

vi.mock("@/lib/media-api", async () => {
	const actual =
		await vi.importActual<typeof import("@/lib/media-api")>("@/lib/media-api");
	return {
		...actual,
		getPlaybackInfo: vi.fn(),
		playbackUrl: vi.fn(),
	};
});

const session = { token: "token", userId: "user-1", username: "Alex" };

function installLocalStorage() {
	const storage = new Map<string, string>();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key),
			clear: () => storage.clear(),
		},
	});
}

function PreferenceProbe() {
	const {
		autoplayNextEpisode,
		autoplayBrowse,
		useHeroTrailer,
		setAutoplayNextEpisode,
		setAutoplayBrowse,
		setUseHeroTrailer,
	} = usePlaybackBehaviorPreferences();
	return (
		<>
			<button
				role="switch"
				aria-label="Autoplay Next Episode"
				aria-checked={autoplayNextEpisode}
				onClick={() => setAutoplayNextEpisode(!autoplayNextEpisode)}
			/>
			<button
				role="switch"
				aria-label="Autoplay on Browse"
				aria-checked={autoplayBrowse}
				onClick={() => setAutoplayBrowse(!autoplayBrowse)}
			/>
			<button
				role="switch"
				aria-label="Use trailers in hero"
				aria-checked={useHeroTrailer}
				onClick={() => setUseHeroTrailer(!useHeroTrailer)}
			/>
		</>
	);
}

function HoverPreviewHarness() {
	const preview = useHoverPreview("movie", 120 * 10_000_000, session);
	const { autoplayBrowse, setAutoplayBrowse } = usePlaybackBehaviorPreferences();
	return (
		<>
			<button type="button" onPointerEnter={preview.start}>
				Hover
			</button>
			<button
				role="switch"
				aria-label="Autoplay on Browse"
				aria-checked={autoplayBrowse}
				onClick={() => setAutoplayBrowse(!autoplayBrowse)}
			/>
			<HoverPreviewVideo preview={preview} />
		</>
	);
}

describe("playback behavior preferences", () => {
	beforeEach(() => {
		installLocalStorage();
		vi.useFakeTimers();
		vi.mocked(getPlaybackInfo).mockReset();
		vi.mocked(playbackUrl).mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("defaults behavior toggles on and persists changes per user", () => {
		const view = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<PreferenceProbe />
			</PlaybackBehaviorPreferencesProvider>,
		);

		expect(
			view.getByRole("switch", { name: "Autoplay Next Episode" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			view.getByRole("switch", { name: "Autoplay on Browse" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			view.getByRole("switch", { name: "Use trailers in hero" }),
		).toHaveAttribute("aria-checked", "true");

		fireEvent.click(view.getByRole("switch", { name: "Autoplay Next Episode" }));
		fireEvent.click(view.getByRole("switch", { name: "Autoplay on Browse" }));
		fireEvent.click(view.getByRole("switch", { name: "Use trailers in hero" }));

		expect(
			window.localStorage.getItem(playbackBehaviorStorageKey("user-1")),
		).toBe(
			JSON.stringify({
				autoplayNextEpisode: false,
				autoplayBrowse: false,
				useHeroTrailer: false,
			}),
		);

		view.unmount();
		const restored = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<PreferenceProbe />
			</PlaybackBehaviorPreferencesProvider>,
		);
		expect(
			restored.getByRole("switch", { name: "Autoplay Next Episode" }),
		).toHaveAttribute("aria-checked", "false");
		expect(
			restored.getByRole("switch", { name: "Autoplay on Browse" }),
		).toHaveAttribute("aria-checked", "false");
		expect(
			restored.getByRole("switch", { name: "Use trailers in hero" }),
		).toHaveAttribute("aria-checked", "false");
	});

	it("isolates users and falls back safely for invalid stored values", () => {
		window.localStorage.setItem(
			playbackBehaviorStorageKey("user-1"),
			JSON.stringify({ autoplayNextEpisode: false, autoplayBrowse: true }),
		);
		window.localStorage.setItem(playbackBehaviorStorageKey("user-2"), "invalid");

		const view = render(
			<PlaybackBehaviorPreferencesProvider userId="user-2">
				<PreferenceProbe />
			</PlaybackBehaviorPreferencesProvider>,
		);

		expect(
			view.getByRole("switch", { name: "Autoplay Next Episode" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			view.getByRole("switch", { name: "Autoplay on Browse" }),
		).toHaveAttribute("aria-checked", "true");

		view.unmount();
		const userOne = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<PreferenceProbe />
			</PlaybackBehaviorPreferencesProvider>,
		);
		expect(
			userOne.getByRole("switch", { name: "Autoplay Next Episode" }),
		).toHaveAttribute("aria-checked", "false");
		expect(
			userOne.getByRole("switch", { name: "Use trailers in hero" }),
		).toHaveAttribute("aria-checked", "true");
	});

	it("continues working in memory when browser storage throws", () => {
		const originalStorage = window.localStorage;
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				getItem: () => {
					throw new Error("storage unavailable");
				},
				setItem: () => {
					throw new Error("storage unavailable");
				},
			},
		});
		try {
			const view = render(
				<PlaybackBehaviorPreferencesProvider userId="user-1">
					<PreferenceProbe />
				</PlaybackBehaviorPreferencesProvider>,
			);
			const next = view.getByRole("switch", {
				name: "Autoplay Next Episode",
			});
			fireEvent.click(next);
			expect(next).toHaveAttribute("aria-checked", "false");
			view.unmount();
		} finally {
			Object.defineProperty(window, "localStorage", {
				configurable: true,
				value: originalStorage,
			});
			installLocalStorage();
		}
	});

	it("applies hero preference changes from another browser tab", () => {
		const view = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<PreferenceProbe />
			</PlaybackBehaviorPreferencesProvider>,
		);

		act(() => {
			window.dispatchEvent(
				new StorageEvent("storage", {
					key: playbackBehaviorStorageKey("user-1"),
					newValue: JSON.stringify({
						autoplayNextEpisode: true,
						autoplayBrowse: true,
						useHeroTrailer: false,
					}),
				}),
			);
		});

		expect(
			view.getByRole("switch", { name: "Use trailers in hero" }),
		).toHaveAttribute("aria-checked", "false");
	});
});

describe("hover preview autoplay", () => {
	beforeEach(() => {
		installLocalStorage();
		vi.useFakeTimers();
		vi
			.mocked(getPlaybackInfo)
			.mockReset()
			.mockResolvedValue({
				source: { Id: "source", mode: "direct", url: "/movie.mp4" },
			} as never);
		vi.mocked(playbackUrl).mockReturnValue("/movie.mp4");
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("does not request or play a preview when browsing autoplay is off", async () => {
		window.localStorage.setItem(
			playbackBehaviorStorageKey("user-1"),
			JSON.stringify({ autoplayNextEpisode: true, autoplayBrowse: false }),
		);
		const view = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<HoverPreviewHarness />
			</PlaybackBehaviorPreferencesProvider>,
		);
		const video = view.container.querySelector("video")!;
		const play = vi.spyOn(video, "play").mockResolvedValue(undefined);

		fireEvent.pointerEnter(view.getByRole("button", { name: "Hover" }));
		act(() => vi.advanceTimersByTime(100));
		await act(async () => {
			await Promise.resolve();
		});

		expect(getPlaybackInfo).not.toHaveBeenCalled();
		expect(play).not.toHaveBeenCalled();
	});

	it("stops an active preview when browsing autoplay is disabled", async () => {
		const view = render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<HoverPreviewHarness />
			</PlaybackBehaviorPreferencesProvider>,
		);
		const video = view.container.querySelector("video")!;
		const play = vi.spyOn(video, "play").mockResolvedValue(undefined);
		const pause = vi.spyOn(video, "pause").mockImplementation(() => undefined);
		vi.spyOn(video, "load").mockImplementation(() => undefined);

		fireEvent.pointerEnter(view.getByRole("button", { name: "Hover" }));
		act(() => vi.advanceTimersByTime(100));
		await act(async () => {
			await Promise.resolve();
		});
		expect(getPlaybackInfo).toHaveBeenCalledOnce();
		expect(play).toHaveBeenCalledOnce();

		fireEvent.click(view.getByRole("switch", { name: "Autoplay on Browse" }));
		expect(pause).toHaveBeenCalledOnce();
		expect(video).not.toHaveAttribute("src", "/movie.mp4");
	});
});
