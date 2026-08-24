"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";

export type PlaybackBehaviorPreferences = {
	autoplayNextEpisode: boolean;
	autoplayBrowse: boolean;
	useHeroTrailer: boolean;
};

type PlaybackBehaviorPreferencesContext = PlaybackBehaviorPreferences & {
	heroPreferenceRevision: number;
	setAutoplayNextEpisode: (value: boolean) => void;
	setAutoplayBrowse: (value: boolean) => void;
	setUseHeroTrailer: (value: boolean) => void;
};

export const DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES: PlaybackBehaviorPreferences =
	{
		autoplayNextEpisode: true,
		autoplayBrowse: true,
		useHeroTrailer: true,
	};

export function playbackBehaviorStorageKey(userId: string) {
	return `zenstream:${userId}:playback:behavior`;
}

function parsePreferences(value: string | null) {
	if (!value) return DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES;
	try {
		const parsed: unknown = JSON.parse(value);
		if (typeof parsed !== "object" || parsed === null)
			return DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES;
		const candidate = parsed as Partial<PlaybackBehaviorPreferences>;
		return {
			autoplayNextEpisode:
				typeof candidate.autoplayNextEpisode === "boolean"
					? candidate.autoplayNextEpisode
					: DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES.autoplayNextEpisode,
			autoplayBrowse:
				typeof candidate.autoplayBrowse === "boolean"
					? candidate.autoplayBrowse
					: DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES.autoplayBrowse,
			useHeroTrailer:
				typeof candidate.useHeroTrailer === "boolean"
					? candidate.useHeroTrailer
					: DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES.useHeroTrailer,
		};
	} catch {
		return DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES;
	}
}

function readPreferences(userId: string) {
	if (typeof window === "undefined")
		return DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES;
	try {
		return parsePreferences(
			window.localStorage.getItem(playbackBehaviorStorageKey(userId)),
		);
	} catch {
		return DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES;
	}
}

function writePreferences(
	userId: string,
	preferences: PlaybackBehaviorPreferences,
) {
	try {
		window.localStorage.setItem(
			playbackBehaviorStorageKey(userId),
			JSON.stringify(preferences),
		);
	} catch {
		// The in-memory preference remains usable when browser storage is unavailable.
	}
}

const Context = createContext<PlaybackBehaviorPreferencesContext>({
	...DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES,
	heroPreferenceRevision: 0,
	setAutoplayNextEpisode: () => undefined,
	setAutoplayBrowse: () => undefined,
	setUseHeroTrailer: () => undefined,
});

export function PlaybackBehaviorPreferencesProvider({
	userId,
	children,
}: {
	userId: string;
	children: ReactNode;
}) {
	const [preferences, setPreferences] = useState(() => readPreferences(userId));
	const [heroPreferenceRevision, setHeroPreferenceRevision] = useState(0);

	useEffect(() => {
		const key = playbackBehaviorStorageKey(userId);
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== key) return;
			const next = parsePreferences(event.newValue);
			if (next.useHeroTrailer !== preferences.useHeroTrailer) {
				setHeroPreferenceRevision((revision) => revision + 1);
			}
			setPreferences(next);
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [preferences.useHeroTrailer, userId]);

	const update = useCallback(
		(field: keyof PlaybackBehaviorPreferences, value: boolean) => {
			setPreferences((current) => {
				const next = { ...current, [field]: value };
				writePreferences(userId, next);
				return next;
			});
		},
		[userId],
	);
	const setAutoplayNextEpisode = useCallback(
		(value: boolean) => update("autoplayNextEpisode", value),
		[update],
	);
	const setAutoplayBrowse = useCallback(
		(value: boolean) => update("autoplayBrowse", value),
		[update],
	);
	const setUseHeroTrailer = useCallback(
		(value: boolean) => {
			setHeroPreferenceRevision((revision) => revision + 1);
			update("useHeroTrailer", value);
		},
		[update],
	);

	return (
		<Context.Provider
			value={{
				...preferences,
				heroPreferenceRevision,
				setAutoplayNextEpisode,
				setAutoplayBrowse,
				setUseHeroTrailer,
			}}
		>
			{children}
		</Context.Provider>
	);
}

export function usePlaybackBehaviorPreferences() {
	return useContext(Context);
}
