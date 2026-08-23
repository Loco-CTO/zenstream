"use client";

import { useCallback, useSyncExternalStore } from "react";

type SortOrder = "Ascending" | "Descending";

interface SortPreference<T> {
	sortBy: T;
	sortOrder: SortOrder;
}

const sortPreferenceListeners = new Map<string, Set<() => void>>();
const inMemorySortPreferences = new Map<string, string>();

function readStoredPreference(key: string) {
	if (!key || typeof window === "undefined") return "";
	try {
		return (
			window.localStorage.getItem(key) ?? inMemorySortPreferences.get(key) ?? ""
		);
	} catch {
		return inMemorySortPreferences.get(key) ?? "";
	}
}

function subscribeToSortPreference(key: string, listener: () => void) {
	if (!key || typeof window === "undefined") return () => undefined;
	const listeners = sortPreferenceListeners.get(key) ?? new Set<() => void>();
	listeners.add(listener);
	sortPreferenceListeners.set(key, listeners);
	const handleStorage = (event: StorageEvent) => {
		if (event.key === key) listener();
	};
	window.addEventListener("storage", handleStorage);
	return () => {
		listeners.delete(listener);
		window.removeEventListener("storage", handleStorage);
	};
}

function getSortPreferenceSnapshot(key: string) {
	return key ? `${key}\u0000${readStoredPreference(key)}` : "";
}

function getServerSortPreferenceSnapshot() {
	return "";
}

function notifySortPreferenceListeners(key: string) {
	for (const listener of sortPreferenceListeners.get(key) ?? []) listener();
}

function writeStoredPreference(key: string, value: string) {
	inMemorySortPreferences.set(key, value);
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// The in-memory value remains usable when browser storage is unavailable.
	}
	notifySortPreferenceListeners(key);
}

function parsePreference<T extends string>(
	serialized: string,
	defaults: SortPreference<T>,
	validSortBy: readonly T[],
) {
	let stored: Partial<SortPreference<T>> = {};
	try {
		const parsed: unknown = serialized ? JSON.parse(serialized) : {};
		if (parsed && typeof parsed === "object")
			stored = parsed as Partial<SortPreference<T>>;
	} catch {
		stored = {};
	}
	return {
		sortBy: validSortBy.includes(stored.sortBy as T)
			? (stored.sortBy as T)
			: defaults.sortBy,
		sortOrder:
			stored.sortOrder === "Ascending" || stored.sortOrder === "Descending"
				? stored.sortOrder
				: defaults.sortOrder,
	};
}

export function useSortPreference<T extends string>(
	key: string,
	defaults: SortPreference<T>,
	validSortBy: readonly T[],
) {
	const subscribe = useCallback(
		(listener: () => void) => subscribeToSortPreference(key, listener),
		[key],
	);
	const getSnapshot = useCallback(() => getSortPreferenceSnapshot(key), [key]);
	const serializedSnapshot = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSortPreferenceSnapshot,
	);
	const serialized = serializedSnapshot.startsWith(`${key}\u0000`)
		? serializedSnapshot.slice(key.length + 1)
		: "";
	const preference = parsePreference(serialized, defaults, validSortBy);
	const hydrated = !key || serializedSnapshot !== "";

	const updatePreference = useCallback(
		(
			value:
				SortPreference<T> | ((current: SortPreference<T>) => SortPreference<T>),
		) => {
			const current = parsePreference(
				readStoredPreference(key),
				defaults,
				validSortBy,
			);
			const next = typeof value === "function" ? value(current) : value;
			if (key) writeStoredPreference(key, JSON.stringify(next));
		},
		[key, defaults, validSortBy],
	);

	return [preference, updatePreference, hydrated] as const;
}
