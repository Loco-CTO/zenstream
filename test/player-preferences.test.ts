import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	AUDIO_PLAYER_PREFERENCES_STORAGE_KEY,
	DEFAULT_AUDIO_PLAYER_PREFERENCES,
	DEFAULT_VIDEO_PLAYER_PREFERENCES,
	VIDEO_PLAYER_PREFERENCES_STORAGE_KEY,
	readStoredAudioPlayerPreferences,
	readStoredVideoPlayerPreferences,
	writeStoredAudioPlayerPreferences,
	writeStoredVideoPlayerPreferences,
} from "@/lib/player-preferences";

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

describe("player preferences", () => {
	beforeEach(() => {
		installLocalStorage();
		readStoredAudioPlayerPreferences();
		readStoredVideoPlayerPreferences();
	});

	afterEach(() => {
		installLocalStorage();
	});

	it("uses defaults when preference records are missing", () => {
		expect(readStoredAudioPlayerPreferences()).toEqual(
			DEFAULT_AUDIO_PLAYER_PREFERENCES,
		);
		expect(readStoredVideoPlayerPreferences()).toEqual(
			DEFAULT_VIDEO_PLAYER_PREFERENCES,
		);
	});

	it("uses separate browser records and round-trips both profiles", () => {
		const audio = {
			volume: 0.4,
			muted: true,
			shuffle: true,
			loopMode: "single" as const,
		};
		const video = { volume: 0.7, muted: false };

		writeStoredAudioPlayerPreferences(audio);
		writeStoredVideoPlayerPreferences(video);

		expect(
			window.localStorage.getItem(AUDIO_PLAYER_PREFERENCES_STORAGE_KEY),
		).toBe(JSON.stringify(audio));
		expect(
			window.localStorage.getItem(VIDEO_PLAYER_PREFERENCES_STORAGE_KEY),
		).toBe(JSON.stringify(video));
		expect(readStoredAudioPlayerPreferences()).toEqual(audio);
		expect(readStoredVideoPlayerPreferences()).toEqual(video);
	});

	it("falls back safely and normalizes invalid stored values", () => {
		window.localStorage.setItem(
			AUDIO_PLAYER_PREFERENCES_STORAGE_KEY,
			JSON.stringify({
				volume: 2,
				muted: "yes",
				shuffle: true,
				loopMode: "invalid",
			}),
		);
		window.localStorage.setItem(
			VIDEO_PLAYER_PREFERENCES_STORAGE_KEY,
			JSON.stringify({ volume: -1, muted: "no" }),
		);

		expect(readStoredAudioPlayerPreferences()).toEqual({
			...DEFAULT_AUDIO_PLAYER_PREFERENCES,
			volume: 1,
			shuffle: true,
		});
		expect(readStoredVideoPlayerPreferences()).toEqual({
			...DEFAULT_VIDEO_PLAYER_PREFERENCES,
			volume: 0,
		});

		window.localStorage.setItem(AUDIO_PLAYER_PREFERENCES_STORAGE_KEY, "broken");
		expect(readStoredAudioPlayerPreferences()).toEqual(
			DEFAULT_AUDIO_PLAYER_PREFERENCES,
		);
	});

	it("keeps the latest profiles usable when browser storage throws", () => {
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

		const audio = {
			volume: 0.25,
			muted: true,
			shuffle: false,
			loopMode: "queue" as const,
		};
		const video = { volume: 0.5, muted: true };

		expect(() => writeStoredAudioPlayerPreferences(audio)).not.toThrow();
		expect(() => writeStoredVideoPlayerPreferences(video)).not.toThrow();
		expect(readStoredAudioPlayerPreferences()).toEqual(audio);
		expect(readStoredVideoPlayerPreferences()).toEqual(video);
	});
});
