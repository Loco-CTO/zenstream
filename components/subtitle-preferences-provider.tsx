"use client";

import {
	createContext,
	useCallback,
	useContext,
	useState,
	type ReactNode,
} from "react";
import {
	DEFAULT_SUBTITLE_STYLE,
	getSubtitlePreference,
	setSubtitlePreference,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";
import type { AuthSession } from "@/lib/session";

const Context = createContext<{
	style: SubtitleStyle;
	update: (change: Partial<SubtitleStyle>) => Promise<void>;
	refresh: () => Promise<void>;
	error: boolean;
}>({
	style: DEFAULT_SUBTITLE_STYLE,
	update: async () => undefined,
	refresh: async () => undefined,
	error: false,
});

export function SubtitlePreferencesProvider({
	session,
	initialStyle,
	children,
}: {
	session?: AuthSession | null;
	initialStyle?: SubtitleStyle;
	children: ReactNode;
}) {
	const activeSession = session ?? null;
	const [style, setStyle] = useState(initialStyle ?? DEFAULT_SUBTITLE_STYLE);
	const [error, setError] = useState(false);
	const refresh = useCallback(async () => {
		if (!activeSession) return;
		try {
			setStyle(await getSubtitlePreference(activeSession));
			setError(false);
		} catch {
			// Retain the most recently known appearance if the preference service is unavailable.
		}
	}, [activeSession]);
	const update = useCallback(
		async (change: Partial<SubtitleStyle>) => {
			const previous = style;
			const next = { ...style, ...change };
			setStyle(next);
			setError(false);
			if (!activeSession) return;
			try {
				setStyle(await setSubtitlePreference(activeSession, next));
			} catch {
				setStyle(previous);
				setError(true);
			}
		},
		[activeSession, style],
	);
	return (
		<Context.Provider value={{ style, update, refresh, error }}>
			{children}
		</Context.Provider>
	);
}

export function useSubtitlePreferences() {
	return useContext(Context);
}
