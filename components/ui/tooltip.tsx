"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const TOOLTIP_ID = "zenstream-global-tooltip";
const SHOW_DELAY_MS = 350;
const EDGE_PADDING = 8;
const ARROW_PADDING = 10;
const TOOLTIP_TRANSLATIONS: Record<string, TranslationKey> = {
	"Close player": "closePlayer",
	"Skip back 10 seconds": "skipBackTenSeconds",
	"Skip forward 10 seconds": "skipForwardTenSeconds",
	Play: "play",
	Pause: "pause",
	Mute: "mute",
	Unmute: "unmute",
	Fullscreen: "fullscreen",
	"Exit fullscreen": "exitFullscreen",
	"Copy color": "copyColor",
	Copied: "colorCopied",
};

/** Schedules a callback for the next browser animation frame. */
function requestFrame(callback: FrameRequestCallback) {
	if (typeof window.requestAnimationFrame === "function") {
		return window.requestAnimationFrame(callback);
	}
	return window.setTimeout(() => callback(performance.now()), 16);
}

/** Cancels a frame scheduled by {@link requestFrame}. */
function cancelFrame(frame: number) {
	if (typeof window.cancelAnimationFrame === "function") {
		window.cancelAnimationFrame(frame);
	} else {
		window.clearTimeout(frame);
	}
}

type TooltipTarget = {
	target: HTMLButtonElement;
	label: string;
};

export type TooltipPosition = {
	left: number;
	top: number;
	side: "top" | "bottom";
	arrowLeft: number;
};

/** Keeps a tooltip inside the viewport and flips it when there is more room. */
export function calculateTooltipPosition(
	anchor: { left: number; top: number; width: number; height: number },
	tooltip: { width: number; height: number },
	viewport: { width: number; height: number },
): TooltipPosition {
	const anchorCenterX = anchor.left + anchor.width / 2;
	const spaceAbove = anchor.top - EDGE_PADDING;
	const spaceBelow =
		viewport.height - (anchor.top + anchor.height) - EDGE_PADDING;
	const fitsAbove = spaceAbove >= tooltip.height + EDGE_PADDING;
	const fitsBelow = spaceBelow >= tooltip.height + EDGE_PADDING;
	const side =
		fitsAbove || (!fitsBelow && spaceAbove >= spaceBelow) ? "top" : "bottom";
	const maxLeft = Math.max(
		EDGE_PADDING,
		viewport.width - tooltip.width - EDGE_PADDING,
	);
	const left = Math.min(
		maxLeft,
		Math.max(EDGE_PADDING, anchorCenterX - tooltip.width / 2),
	);
	const preferredTop =
		side === "top"
			? anchor.top - tooltip.height - EDGE_PADDING
			: anchor.top + anchor.height + EDGE_PADDING;
	const maxTop = Math.max(
		EDGE_PADDING,
		viewport.height - tooltip.height - EDGE_PADDING,
	);
	const top = Math.min(maxTop, Math.max(EDGE_PADDING, preferredTop));
	const arrowLeft = Math.min(
		Math.max(ARROW_PADDING, tooltip.width - ARROW_PADDING),
		Math.max(ARROW_PADDING, anchorCenterX - left),
	);

	return { left, top, side, arrowLeft };
}

/** Finds the nearest button for a delegated pointer event. */
function buttonFromTarget(
	target: EventTarget | null,
): HTMLButtonElement | null {
	if (!(target instanceof Element)) return null;
	const button = target.closest("button");
	return button instanceof HTMLButtonElement ? button : null;
}

/** Returns whether a button has visible text content. */
function hasVisibleText(button: HTMLButtonElement) {
	return (button.innerText ?? button.textContent ?? "").trim().length > 0;
}

/** Selects icon-only buttons and buttons with an explicit tooltip label. */
function tooltipTrigger(button: HTMLButtonElement) {
	if (button.hasAttribute("data-tooltip")) return button;
	if (button.getAttribute("aria-label")?.trim() && !hasVisibleText(button)) {
		return button;
	}
	return null;
}

/** Reads the tooltip label, preferring an explicit or migrated title. */
function tooltipLabel(button: HTMLButtonElement) {
	return (
		button.getAttribute("data-tooltip")?.trim() ||
		button.getAttribute("aria-label")?.trim() ||
		null
	);
}

/** Localizes legacy English player labels while preserving localized labels. */
function localizeTooltipLabel(
	label: string,
	t: (key: TranslationKey) => string,
) {
	const key = TOOLTIP_TRANSLATIONS[label];
	return key ? t(key) : label;
}

/** Removes the browser's native title and migrates it to the global tooltip. */
function migrateNativeTitle(button: HTMLButtonElement) {
	if (!button.hasAttribute("title")) return;
	const title = button.getAttribute("title")?.trim();
	button.removeAttribute("title");
	if (!title) return;
	button.setAttribute("data-tooltip", title);
	if (!button.getAttribute("aria-label") && !hasVisibleText(button)) {
		button.setAttribute("aria-label", title);
	}
}

/** Adds or removes the global tooltip's accessible description reference. */
function updateDescribedBy(button: HTMLButtonElement, add: boolean) {
	const ids = new Set(
		(button.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean),
	);
	if (add) ids.add(TOOLTIP_ID);
	else ids.delete(TOOLTIP_ID);
	if (ids.size) button.setAttribute("aria-describedby", [...ids].join(" "));
	else button.removeAttribute("aria-describedby");
}

/** Renders the single viewport-aware tooltip for hovered buttons. */
export function Tooltip() {
	const { t } = useI18n();
	const [active, setActive] = useState<TooltipTarget | null>(null);
	const activeRef = useRef<TooltipTarget | null>(null);
	const hoveredTargetRef = useRef<HTMLButtonElement | null>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);

	const setActiveTooltip = useCallback((next: TooltipTarget | null) => {
		const current = activeRef.current;
		if (current?.target !== next?.target) {
			if (current) updateDescribedBy(current.target, false);
			if (next) updateDescribedBy(next.target, true);
		}
		activeRef.current = next;
		setActive(next);
	}, []);

	useEffect(() => {
		let showTimer: number | undefined;
		/** Hides the active tooltip and clears any pending hover timer. */
		const hide = () => {
			if (showTimer !== undefined) window.clearTimeout(showTimer);
			showTimer = undefined;
			hoveredTargetRef.current = null;
			setActiveTooltip(null);
		};
		/** Migrates titles from a newly inserted button subtree. */
		const scanNode = (node: Node) => {
			if (node instanceof HTMLButtonElement) migrateNativeTitle(node);
			if (node instanceof Element) {
				node
					.querySelectorAll<HTMLButtonElement>("button[title]")
					.forEach(migrateNativeTitle);
			}
		};
		/** Starts a delayed tooltip when a mouse or pen enters a labeled button. */
		const handlePointerOver = (event: PointerEvent) => {
			const button = buttonFromTarget(event.target);
			if (!button) return;
			migrateNativeTitle(button);
			if (event.pointerType === "touch") {
				hide();
				return;
			}
			const trigger = tooltipTrigger(button);
			if (!trigger) return;
			if (
				event.relatedTarget instanceof Node &&
				trigger.contains(event.relatedTarget)
			) {
				return;
			}
			const label = tooltipLabel(trigger);
			if (!label) return;
			if (showTimer !== undefined) window.clearTimeout(showTimer);
			hoveredTargetRef.current = trigger;
			showTimer = window.setTimeout(() => {
				if (hoveredTargetRef.current !== trigger || !trigger.isConnected) return;
				const currentLabel = tooltipLabel(trigger);
				if (currentLabel)
					setActiveTooltip({
						target: trigger,
						label: localizeTooltipLabel(currentLabel, t),
					});
			}, SHOW_DELAY_MS);
		};
		/** Hides the tooltip after the pointer leaves its button. */
		const handlePointerOut = (event: PointerEvent) => {
			const hoveredTarget = hoveredTargetRef.current;
			if (!hoveredTarget || !(event.target instanceof Node)) return;
			if (!hoveredTarget.contains(event.target)) return;
			if (
				event.relatedTarget instanceof Node &&
				hoveredTarget.contains(event.relatedTarget)
			) {
				return;
			}
			hide();
		};
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === "childList") {
					record.addedNodes.forEach(scanNode);
					const current = activeRef.current;
					if (current && !current.target.isConnected) hide();
					continue;
				}
				if (!(record.target instanceof HTMLButtonElement)) continue;
				const button = record.target;
				if (record.attributeName === "title") migrateNativeTitle(button);
				if (activeRef.current?.target === button) {
					const label = tooltipLabel(button);
					if (label)
						setActiveTooltip({
							target: button,
							label: localizeTooltipLabel(label, t),
						});
					else hide();
				}
			}
		});

		document
			.querySelectorAll<HTMLButtonElement>("button[title]")
			.forEach(migrateNativeTitle);
		observer.observe(document.body, {
			attributes: true,
			attributeFilter: ["title", "aria-label", "data-tooltip"],
			childList: true,
			subtree: true,
		});
		document.addEventListener("pointerover", handlePointerOver, true);
		document.addEventListener("pointerout", handlePointerOut, true);
		document.addEventListener("pointerdown", hide, true);
		window.addEventListener("blur", hide);

		return () => {
			if (showTimer !== undefined) window.clearTimeout(showTimer);
			observer.disconnect();
			document.removeEventListener("pointerover", handlePointerOver, true);
			document.removeEventListener("pointerout", handlePointerOut, true);
			document.removeEventListener("pointerdown", hide, true);
			window.removeEventListener("blur", hide);
			if (activeRef.current) updateDescribedBy(activeRef.current.target, false);
			activeRef.current = null;
		};
	}, [setActiveTooltip, t]);

	useEffect(() => {
		const tooltip = tooltipRef.current;
		const target = active?.target;
		if (!tooltip || !target) return undefined;

		let frame: number | undefined;
		/** Repositions the tooltip beside its current anchor. */
		const updatePosition = () => {
			frame = undefined;
			const anchor = target.getBoundingClientRect();
			const viewportWidth =
				document.documentElement.clientWidth || window.innerWidth;
			const viewportHeight = window.innerHeight;
			if (
				!target.isConnected ||
				anchor.bottom < 0 ||
				anchor.top > viewportHeight
			) {
				tooltip.style.visibility = "hidden";
			} else {
				const bounds = tooltip.getBoundingClientRect();
				const position = calculateTooltipPosition(
					anchor,
					{ width: bounds.width, height: bounds.height },
					{ width: viewportWidth, height: viewportHeight },
				);
				tooltip.style.left = `${position.left}px`;
				tooltip.style.top = `${position.top}px`;
				tooltip.dataset.placement = position.side;
				tooltip.style.visibility = "visible";
				const arrow = tooltip.querySelector<HTMLElement>("[data-tooltip-arrow]");
				if (arrow) {
					arrow.style.left = `${position.arrowLeft}px`;
					arrow.style.top = position.side === "bottom" ? "-4px" : "auto";
					arrow.style.bottom = position.side === "top" ? "-4px" : "auto";
				}
			}
		};
		/** Schedules a position update on the next animation frame. */
		const schedulePosition = () => {
			if (frame !== undefined) cancelFrame(frame);
			frame = requestFrame(updatePosition);
		};

		schedulePosition();
		window.addEventListener("resize", schedulePosition);
		window.addEventListener("scroll", schedulePosition, true);
		return () => {
			if (frame !== undefined) cancelFrame(frame);
			window.removeEventListener("resize", schedulePosition);
			window.removeEventListener("scroll", schedulePosition, true);
		};
	}, [active]);

	if (!active || typeof document === "undefined") return null;
	return createPortal(
		<div
			id={TOOLTIP_ID}
			ref={tooltipRef}
			role="tooltip"
			className="pointer-events-none fixed z-[9999] w-max max-w-[calc(100vw-1rem)] rounded-md border border-white/15 bg-neutral-950/95 px-2.5 py-1.5 text-xs leading-4 whitespace-normal text-white shadow-xl shadow-black/40"
			style={{ left: 0, top: 0, visibility: "hidden" }}
		>
			{active.label}
			<span
				aria-hidden="true"
				data-tooltip-arrow
				className="absolute h-2 w-2 -translate-x-1/2 rotate-45 border border-white/15 bg-neutral-950"
				style={{ left: "50%" }}
			/>
		</div>,
		document.body,
	);
}
