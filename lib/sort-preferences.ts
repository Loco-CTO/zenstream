"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SortOrder = "Ascending" | "Descending";

interface SortPreference<T> {
	sortBy: T;
	sortOrder: SortOrder;
}

export function useSortPreference<T extends string>(
	key: string,
	defaults: SortPreference<T>,
	validSortBy: readonly T[],
) {
	const { sortBy: defaultSortBy, sortOrder: defaultSortOrder } = defaults;
	const [preference, setPreference] = useState(defaults);
	const [hydratedKey, setHydratedKey] = useState<string | null>(null);
	const hydratedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (hydratedKeyRef.current === key) return;
		hydratedKeyRef.current = null;
		// Do not render the previous key's value while the new preference is
		// being read. This matters when switching libraries in one route.
		setHydratedKey(null);
		setPreference({ sortBy: defaultSortBy, sortOrder: defaultSortOrder });
		if (!key) {
			hydratedKeyRef.current = key;
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setHydratedKey(key);
			return;
		}
		let stored: Partial<SortPreference<T>> = {};
		try {
			stored = JSON.parse(localStorage.getItem(key) ?? "{}");
		} catch {
			stored = {};
		}
		setPreference({
			sortBy: validSortBy.includes(stored.sortBy as T)
				? (stored.sortBy as T)
				: defaultSortBy,
			sortOrder:
				stored.sortOrder === "Ascending" || stored.sortOrder === "Descending"
					? stored.sortOrder
					: defaultSortOrder,
		});
		hydratedKeyRef.current = key;
		setHydratedKey(key);
	}, [defaultSortBy, defaultSortOrder, key, validSortBy]);

	const updatePreference = useCallback(
		(
			value:
				SortPreference<T> | ((current: SortPreference<T>) => SortPreference<T>),
		) => {
			setPreference((current) => {
				const next = typeof value === "function" ? value(current) : value;
				if (
					key &&
					hydratedKeyRef.current === key &&
					typeof localStorage.setItem === "function"
				)
					localStorage.setItem(key, JSON.stringify(next));
				return next;
			});
		},
		[key],
	);

	return [preference, updatePreference, hydratedKey === key] as const;
}
