"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTENT_DELAY_MS = 120;

export function useNavigationPrefetch(
	prefetch: ((url: URL) => Promise<unknown> | undefined) | null,
) {
	const router = useRouter();
	useEffect(() => {
		if (!prefetch) return;
		const connection = (
			navigator as Navigator & {
				connection?: { saveData?: boolean; effectiveType?: string };
			}
		).connection;
		if (connection?.saveData || connection?.effectiveType?.endsWith("2g")) return;

		let timer: ReturnType<typeof setTimeout> | undefined;
		let intentLink: HTMLAnchorElement | undefined;
		let pending = false;
		const cancel = () => {
			clearTimeout(timer);
			intentLink = undefined;
		};
		const onIntent = (event: Event) => {
			if (!(event.target instanceof Element)) return;
			const link = event.target.closest<HTMLAnchorElement>(
				"a[data-prefetch-media]",
			);
			if (!link || link.target || link.hasAttribute("download")) return;
			if (
				event instanceof MouseEvent &&
				(event.button !== 0 ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					event.shiftKey)
			)
				return;
			const related = (event as MouseEvent).relatedTarget;
			if (related instanceof Node && link.contains(related)) return;
			const url = new URL(link.href);
			if (
				url.origin !== location.origin ||
				url.pathname + url.search === location.pathname + location.search
			)
				return;
			const warm = () => {
				if (pending || !link.isConnected) return;
				const request = prefetch(url);
				if (!request) return;
				pending = true;
				router.prefetch?.(url.pathname + url.search);
				void request
					.catch(() => undefined)
					.finally(() => {
						pending = false;
					});
			};
			cancel();
			if (event.type === "pointerdown") warm();
			else if (!("pointerType" in event) || event.pointerType !== "touch") {
				intentLink = link;
				timer = setTimeout(warm, INTENT_DELAY_MS);
			}
		};
		const onLeave = (event: Event) => {
			if (!(event.target instanceof Element)) return;
			const link = event.target.closest("a[data-prefetch-media]");
			if (!link || link !== intentLink) return;
			const related = (event as MouseEvent).relatedTarget;
			if (!(related instanceof Node) || !link.contains(related)) cancel();
		};
		const intentEvents = ["pointerover", "pointerdown", "focusin"];
		const leaveEvents = ["pointerout", "focusout"];
		for (const type of intentEvents) document.addEventListener(type, onIntent);
		for (const type of leaveEvents) document.addEventListener(type, onLeave);
		return () => {
			cancel();
			for (const type of intentEvents)
				document.removeEventListener(type, onIntent);
			for (const type of leaveEvents) document.removeEventListener(type, onLeave);
		};
	}, [prefetch, router]);
}
