"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import {
	DEFAULT_HOME_LAYOUT_PREFERENCE,
	homeLayoutStorageKey,
	parseHomeLayoutPreference,
	reorderHomeLayoutPreference,
	setHomeSectionHidden,
	type HomeLayoutPreference,
} from "@/lib/home-layout";

type HomeLayoutContextValue = {
	preference: HomeLayoutPreference;
	reorder: (availableIds: string[], reorderedIds: string[]) => void;
	setHidden: (id: string, hidden: boolean) => void;
};

const HomeLayoutContext = createContext<HomeLayoutContextValue>({
	preference: DEFAULT_HOME_LAYOUT_PREFERENCE,
	reorder: () => undefined,
	setHidden: () => undefined,
});

function readPreference(serverUrl: string, userId: string) {
	if (typeof window === "undefined") return DEFAULT_HOME_LAYOUT_PREFERENCE;
	try {
		return parseHomeLayoutPreference(
			window.localStorage.getItem(homeLayoutStorageKey(serverUrl, userId)),
		);
	} catch {
		return DEFAULT_HOME_LAYOUT_PREFERENCE;
	}
}

export function HomeLayoutPreferencesProvider({
	serverUrl,
	userId,
	children,
}: {
	serverUrl: string;
	userId: string;
	children: ReactNode;
}) {
	const storageKey = homeLayoutStorageKey(serverUrl, userId);
	const [preference, setPreference] = useState(() =>
		readPreference(serverUrl, userId),
	);

	useEffect(() => {
		const handleStorage = (event: StorageEvent) => {
			if (event.key === storageKey) {
				setPreference(parseHomeLayoutPreference(event.newValue));
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, [storageKey]);

	const save = useCallback(
		(update: (current: HomeLayoutPreference) => HomeLayoutPreference) => {
			setPreference((current) => {
				const next = update(current);
				try {
					window.localStorage.setItem(storageKey, JSON.stringify(next));
				} catch {
					// Keep the preference available in memory when storage is unavailable.
				}
				return next;
			});
		},
		[storageKey],
	);

	const reorder = useCallback(
		(availableIds: string[], reorderedIds: string[]) =>
			save((current) =>
				reorderHomeLayoutPreference(current, availableIds, reorderedIds),
			),
		[save],
	);
	const setHidden = useCallback(
		(id: string, hidden: boolean) =>
			save((current) => setHomeSectionHidden(current, id, hidden)),
		[save],
	);

	return (
		<HomeLayoutContext.Provider value={{ preference, reorder, setHidden }}>
			{children}
		</HomeLayoutContext.Provider>
	);
}

export function useHomeLayoutPreferences() {
	return useContext(HomeLayoutContext);
}
