export type AudioLoopMode = "off" | "queue" | "single";

export type AudioPlayerPreferences = {
	volume: number;
	muted: boolean;
	shuffle: boolean;
	loopMode: AudioLoopMode;
};

export type VideoPlayerPreferences = {
	volume: number;
	muted: boolean;
};

export const AUDIO_PLAYER_PREFERENCES_STORAGE_KEY = "zenstream:player:audio";
export const VIDEO_PLAYER_PREFERENCES_STORAGE_KEY = "zenstream:player:video";

export const DEFAULT_AUDIO_PLAYER_PREFERENCES: AudioPlayerPreferences = {
	volume: 1,
	muted: false,
	shuffle: false,
	loopMode: "off",
};

export const DEFAULT_VIDEO_PLAYER_PREFERENCES: VideoPlayerPreferences = {
	volume: 1,
	muted: false,
};

let fallbackAudioPreferences = { ...DEFAULT_AUDIO_PLAYER_PREFERENCES };
let fallbackVideoPreferences = { ...DEFAULT_VIDEO_PLAYER_PREFERENCES };

function safeVolume(value: unknown, fallback: number) {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.max(0, Math.min(1, value));
}

function parseRecord(value: string | null): Record<string, unknown> {
	if (!value) return {};
	try {
		const parsed: unknown = JSON.parse(value);
		return parsed && typeof parsed === "object"
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}

function parseAudioPreferences(value: string | null): AudioPlayerPreferences {
	const stored = parseRecord(value);
	const loopMode = stored.loopMode;
	return {
		volume: safeVolume(stored.volume, DEFAULT_AUDIO_PLAYER_PREFERENCES.volume),
		muted:
			typeof stored.muted === "boolean"
				? stored.muted
				: DEFAULT_AUDIO_PLAYER_PREFERENCES.muted,
		shuffle:
			typeof stored.shuffle === "boolean"
				? stored.shuffle
				: DEFAULT_AUDIO_PLAYER_PREFERENCES.shuffle,
		loopMode:
			loopMode === "off" || loopMode === "queue" || loopMode === "single"
				? loopMode
				: DEFAULT_AUDIO_PLAYER_PREFERENCES.loopMode,
	};
}

function parseVideoPreferences(value: string | null): VideoPlayerPreferences {
	const stored = parseRecord(value);
	return {
		volume: safeVolume(stored.volume, DEFAULT_VIDEO_PLAYER_PREFERENCES.volume),
		muted:
			typeof stored.muted === "boolean"
				? stored.muted
				: DEFAULT_VIDEO_PLAYER_PREFERENCES.muted,
	};
}

export function readStoredAudioPlayerPreferences(): AudioPlayerPreferences {
	if (typeof window === "undefined") return { ...fallbackAudioPreferences };
	try {
		const preferences = parseAudioPreferences(
			window.localStorage.getItem(AUDIO_PLAYER_PREFERENCES_STORAGE_KEY),
		);
		fallbackAudioPreferences = preferences;
		return { ...preferences };
	} catch {
		return { ...fallbackAudioPreferences };
	}
}

export function writeStoredAudioPlayerPreferences(
	preferences: AudioPlayerPreferences,
) {
	const normalized = parseAudioPreferences(JSON.stringify(preferences));
	fallbackAudioPreferences = normalized;
	try {
		window.localStorage.setItem(
			AUDIO_PLAYER_PREFERENCES_STORAGE_KEY,
			JSON.stringify(normalized),
		);
	} catch {
		// The in-memory value remains usable when browser storage is unavailable.
	}
}

export function readStoredVideoPlayerPreferences(): VideoPlayerPreferences {
	if (typeof window === "undefined") return { ...fallbackVideoPreferences };
	try {
		const preferences = parseVideoPreferences(
			window.localStorage.getItem(VIDEO_PLAYER_PREFERENCES_STORAGE_KEY),
		);
		fallbackVideoPreferences = preferences;
		return { ...preferences };
	} catch {
		return { ...fallbackVideoPreferences };
	}
}

export function writeStoredVideoPlayerPreferences(
	preferences: VideoPlayerPreferences,
) {
	const normalized = parseVideoPreferences(JSON.stringify(preferences));
	fallbackVideoPreferences = normalized;
	try {
		window.localStorage.setItem(
			VIDEO_PLAYER_PREFERENCES_STORAGE_KEY,
			JSON.stringify(normalized),
		);
	} catch {
		// The in-memory value remains usable when browser storage is unavailable.
	}
}
