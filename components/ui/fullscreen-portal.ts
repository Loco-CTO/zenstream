"use client";

import { useEffect, useState } from "react";

/** Keeps a stable portal root inside the active browser fullscreen element. */
export function useFullscreenPortalTarget() {
	const [target, setTarget] = useState<HTMLDivElement | null>(null);

	useEffect(() => {
		const root = document.createElement("div");
		root.dataset.fullscreenPortalRoot = "";
		root.style.display = "contents";

		const moveToActiveFullscreenElement = () => {
			const parent = document.fullscreenElement ?? document.body;
			if (root.parentNode !== parent) parent.appendChild(root);
		};

		moveToActiveFullscreenElement();
		document.addEventListener("fullscreenchange", moveToActiveFullscreenElement);
		setTarget(root);

		return () => {
			document.removeEventListener(
				"fullscreenchange",
				moveToActiveFullscreenElement,
			);
			root.remove();
		};
	}, []);

	return target;
}
