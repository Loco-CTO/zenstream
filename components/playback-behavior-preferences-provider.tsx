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
};

type PlaybackBehaviorPreferencesContext = PlaybackBehaviorPreferences & {
	setAutoplayNextEpisode: (value: boolean) => void;
	setAutoplayBrowse: (value: boolean) => void;
};

export const DEFAULT_PLAYBACK_BEHAVIOR_PREFERENCES: PlaybackBehaviorPreferences =
	{
		autoplayNextEpisode: true,
		autoplayBrowse: true,
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
	setAutoplayNextEpisode: () => undefined,
	setAutoplayBrowse: () => undefined,
});

export function PlaybackBehaviorPreferencesProvider({
	userId,
	children,
}: {
	userId: string;
	children: ReactNode;
}) {
	const [preferences, setPreferences] = useState(() => readPreferences(userId));

	useEffect(() => {
		// The provider is keyed by user in AppShell, but keeping this reset here also
		// makes direct reuse safe when its userId prop changes.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPreferences(readPreferences(userId));
		const key = playbackBehaviorStorageKey(userId);
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== key) return;
			setPreferences(parsePreferences(event.newValue));
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [userId]);

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

	return (
		<Context.Provider
			value={{ ...preferences, setAutoplayNextEpisode, setAutoplayBrowse }}
		>
			{children}
		</Context.Provider>
	);
}

export function usePlaybackBehaviorPreferences() {
	return useContext(Context);
}
