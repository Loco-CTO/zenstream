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
	const [preference, setPreference] = useState(defaults);
	const keyRef = useRef(key);
	const hydratedRef = useRef(false);

	useEffect(() => {
		if (keyRef.current === key && hydratedRef.current) return;
		keyRef.current = key;
		if (!key) return;
		hydratedRef.current = false;
		let stored: Partial<SortPreference<T>> = {};
		try {
			stored = JSON.parse(localStorage.getItem(key) ?? "{}");
		} catch {
			stored = {};
		}
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setPreference({
			sortBy: validSortBy.includes(stored.sortBy as T)
				? (stored.sortBy as T)
				: defaults.sortBy,
			sortOrder:
				stored.sortOrder === "Ascending" || stored.sortOrder === "Descending"
					? stored.sortOrder
					: defaults.sortOrder,
		});
		hydratedRef.current = true;
	}, [defaults.sortBy, defaults.sortOrder, key, validSortBy]);

	const updatePreference = useCallback(
		(
			value:
				| SortPreference<T>
				| ((current: SortPreference<T>) => SortPreference<T>),
		) => {
			setPreference((current) => {
				const next = typeof value === "function" ? value(current) : value;
				if (
					key &&
					hydratedRef.current &&
					typeof localStorage.setItem === "function"
				)
					localStorage.setItem(key, JSON.stringify(next));
				return next;
			});
		},
		[key],
	);

	return [preference, updatePreference] as const;
}
