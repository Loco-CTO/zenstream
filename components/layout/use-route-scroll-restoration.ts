"use client";

import { useLayoutEffect, useRef } from "react";

const HISTORY_KEY = "zenstreamScrollEntry";
const MAX_ENTRIES = 50;
const RESTORE_TIMEOUT_MS = 8_000;
let nextEntryId = 0;

function currentHref() {
	const search = new URLSearchParams(window.location.search).toString();
	return window.location.pathname + (search ? `?${search}` : "");
}

export function useRouteScrollRestoration(href: string, userId?: string) {
	const commit = useRef<((href: string) => void) | null>(null);

	useLayoutEffect(() => {
		if (!userId) return;
		const positions = new Map<number, number>();
		let active: { href: string; browserHref: string; id: number } | undefined;
		let arrival: { href: string; y: number } | undefined;
		let stopRestoring: (() => void) | undefined;

		const save = () => {
			if (
				!active ||
				location.pathname + location.search !== active.browserHref ||
				arrival ||
				stopRestoring
			)
				return;
			positions.set(active.id, window.scrollY);
			if (positions.size > MAX_ENTRIES) {
				const oldest = positions.keys().next().value;
				if (oldest !== undefined) positions.delete(oldest);
			}
		};

		const restore = () => {
			if (!arrival || arrival.href !== active?.href) return;
			const { href: destination, y } = arrival;
			arrival = undefined;
			const progressive =
				destination === "/" || /^\/(library|search)(\?|$)/.test(destination);
			let frame = 0;
			const observer =
				typeof ResizeObserver === "undefined"
					? null
					: new ResizeObserver(() => schedule());
			const timeout = setTimeout(() => stop(), RESTORE_TIMEOUT_MS);
			const interruptKeys = new Set([
				"ArrowUp",
				"ArrowDown",
				"PageUp",
				"PageDown",
				"Home",
				"End",
				" ",
			]);
			const onKey = (event: KeyboardEvent) => {
				if (interruptKeys.has(event.key)) stop();
			};
			const stop = () => {
				cancelAnimationFrame(frame);
				clearTimeout(timeout);
				observer?.disconnect();
				window.removeEventListener("wheel", stop);
				window.removeEventListener("touchmove", stop);
				window.removeEventListener("pointerdown", stop);
				window.removeEventListener("keydown", onKey);
				stopRestoring = undefined;
			};
			const apply = () => {
				if (currentHref() !== destination) return stop();
				const scrollRoot = document.scrollingElement ?? document.documentElement;
				const max = Math.max(0, scrollRoot.scrollHeight - window.innerHeight);
				if (y <= max + 1) {
					window.scrollTo({ top: y, behavior: "instant" });
					stop();
				} else if (progressive && max > window.scrollY) {
					// Bring deferred rows or the pagination sentinel into view.
					window.scrollTo({ top: max, behavior: "instant" });
				}
			};
			const schedule = () => {
				cancelAnimationFrame(frame);
				frame = requestAnimationFrame(apply);
			};
			stopRestoring = stop;
			window.addEventListener("wheel", stop, { passive: true });
			window.addEventListener("touchmove", stop, { passive: true });
			window.addEventListener("pointerdown", stop, { passive: true });
			window.addEventListener("keydown", onKey);
			observer?.observe(document.body);
			schedule();
		};

		const onPopState = (event: PopStateEvent) => {
			stopRestoring?.();
			const y = positions.get(event.state?.[HISTORY_KEY]);
			arrival =
				y !== undefined && !window.location.hash
					? { href: currentHref(), y }
					: undefined;
			if (active?.href === currentHref()) commit.current?.(currentHref());
		};
		commit.current = (nextHref) => {
			if (currentHref() !== nextHref) return;
			stopRestoring?.();
			const previousHref = active?.href;
			const id = window.history.state?.[HISTORY_KEY] ?? ++nextEntryId;
			if (window.history.state?.[HISTORY_KEY] !== id)
				window.history.replaceState(
					{ ...window.history.state, [HISTORY_KEY]: id },
					"",
				);
			active = {
				href: nextHref,
				browserHref: location.pathname + location.search,
				id,
			};
			if (arrival?.href === nextHref) {
				restore();
				return;
			}
			arrival = undefined;
			// The router can commit a traversal before the browser emits popstate.
			// Keep the destination's saved offset until the event arrives.
			if (positions.has(id)) return;
			if (
				previousHref &&
				!window.location.hash &&
				!location.pathname.startsWith("/play/")
			) {
				const previous = new URL(previousHref, location.origin);
				const changedPage = previous.pathname !== location.pathname;
				const changedSearch =
					location.pathname === "/search" &&
					previous.searchParams.get("q") !==
						new URL(location.href).searchParams.get("q");
				if ((changedPage || changedSearch) && window.scrollY > 0)
					window.scrollTo({ top: 0, behavior: "instant" });
			}
			save();
		};

		window.addEventListener("scroll", save, { passive: true });
		// Read the saved position before the router commits the traversed entry.
		window.addEventListener("popstate", onPopState, { capture: true });
		return () => {
			stopRestoring?.();
			commit.current = null;
			window.removeEventListener("scroll", save);
			window.removeEventListener("popstate", onPopState, { capture: true });
		};
	}, [userId]);

	useLayoutEffect(() => {
		commit.current?.(href);
	}, [href, userId]);
}
