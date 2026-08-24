"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import {
	DEFAULT_SUBTITLE_STYLE,
	readStoredSubtitleStyle,
	SUBTITLE_STYLE_STORAGE_KEY,
	writeStoredSubtitleStyle,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";

const Context = createContext<{
	style: SubtitleStyle;
	update: (change: Partial<SubtitleStyle>) => Promise<void>;
	error: boolean;
}>({
	style: DEFAULT_SUBTITLE_STYLE,
	update: async () => undefined,
	error: false,
});

export function SubtitlePreferencesProvider({ children }: { children: ReactNode }) {
	const [style, setStyle] = useState(readStoredSubtitleStyle);
	const [error, setError] = useState(false);
	const styleRef = useRef(style);
	useEffect(() => {
		styleRef.current = style;
	}, [style]);
	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key !== null && event.key !== SUBTITLE_STYLE_STORAGE_KEY) return;
			const next = readStoredSubtitleStyle();
			styleRef.current = next;
			setStyle(next);
			setError(false);
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);
	const update = useCallback(
		async (change: Partial<SubtitleStyle>) => {
			const next = { ...styleRef.current, ...change };
			styleRef.current = next;
			setStyle(next);
			setError(!writeStoredSubtitleStyle(next));
		},
		[],
	);
	return (
		<Context.Provider value={{ style, update, error }}>
			{children}
		</Context.Provider>
	);
}

export function useSubtitlePreferences() {
	return useContext(Context);
}
