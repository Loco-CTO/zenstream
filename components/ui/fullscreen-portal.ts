"use client";

import { useSyncExternalStore } from "react";

let portalTarget: HTMLDivElement | null = null;
let subscribers = 0;

/** Moves the shared portal root into the active fullscreen element. */
function moveToActiveFullscreenElement() {
	if (!portalTarget) return;
	const parent = document.fullscreenElement ?? document.body;
	if (parent && portalTarget.parentNode !== parent) {
		parent.appendChild(portalTarget);
	}
}

function getSnapshot() {
	return portalTarget;
}

function getServerSnapshot() {
	return null;
}

function subscribe(listener: () => void) {
	if (typeof document === "undefined") return () => {};
	subscribers += 1;

	if (!portalTarget) {
		portalTarget = document.createElement("div");
		portalTarget.dataset.fullscreenPortalRoot = "";
		portalTarget.style.display = "contents";
		moveToActiveFullscreenElement();
		document.addEventListener("fullscreenchange", moveToActiveFullscreenElement);
	}

	listener();

	return () => {
		subscribers -= 1;
		if (subscribers === 0 && portalTarget) {
			document.removeEventListener(
				"fullscreenchange",
				moveToActiveFullscreenElement,
			);
			portalTarget.remove();
			portalTarget = null;
		}
	};
}

/** Keeps shared overlay portals inside the active browser fullscreen element. */
export function useFullscreenPortalTarget() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
