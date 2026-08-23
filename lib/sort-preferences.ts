"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SortOrder = "Ascending" | "Descending";

interface SortPreference<T> {
	sortBy: T;
	sortOrder: SortOrder;
}

function parsePreference<T extends string>(
	value: string | null,
	defaults: SortPreference<T>,
	validSortBy: readonly T[],
): SortPreference<T> {
	try {
		const parsed: unknown = value ? JSON.parse(value) : null;
		if (!parsed || typeof parsed !== "object") return defaults;
		const stored = parsed as Partial<SortPreference<T>>;
		return {
			sortBy: validSortBy.includes(stored.sortBy as T)
				? (stored.sortBy as T)
				: defaults.sortBy,
			sortOrder:
				stored.sortOrder === "Ascending" || stored.sortOrder === "Descending"
					? stored.sortOrder
					: defaults.sortOrder,
		};
	} catch {
		return defaults;
	}
}

export function useSortPreference<T extends string>(
	key: string,
	defaults: SortPreference<T>,
	validSortBy: readonly T[],
) {
	const [preference, setPreference] = useState(defaults);
	const [hydratedKey, setHydratedKey] = useState<string | null>(null);
	const hydratedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (hydratedKeyRef.current === key) return;
		hydratedKeyRef.current = null;
		setHydratedKey(null);
		setPreference(defaults);
		if (!key) return;
		let stored: string | null = null;
		try {
			stored = window.localStorage.getItem(key);
		} catch {
			stored = null;
		}
		setPreference(parsePreference(stored, defaults, validSortBy));
		hydratedKeyRef.current = key;
		setHydratedKey(key);
	}, [defaults, key, validSortBy]);

	const updatePreference = useCallback(
		(
			value:
				SortPreference<T> | ((current: SortPreference<T>) => SortPreference<T>),
		) => {
			setPreference((current) => {
				const next = typeof value === "function" ? value(current) : value;
				if (hydratedKeyRef.current === key) {
					try {
						window.localStorage.setItem(key, JSON.stringify(next));
					} catch {
						// Preferences remain available for the current session.
					}
				}
				return next;
			});
		},
		[key],
	);

	return [preference, updatePreference, hydratedKey === key] as const;
}
