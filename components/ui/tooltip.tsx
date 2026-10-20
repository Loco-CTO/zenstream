"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TOOLTIP_ID = "zenstream-global-tooltip";
const SHOW_DELAY_MS = 350;
const EDGE_PADDING = 8;
const ARROW_PADDING = 10;

function requestFrame(callback: FrameRequestCallback) {
	if (typeof window.requestAnimationFrame === "function") {
		return window.requestAnimationFrame(callback);
	}
	return window.setTimeout(() => callback(performance.now()), 16);
}

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

function buttonFromTarget(
	target: EventTarget | null,
): HTMLButtonElement | null {
	if (!(target instanceof Element)) return null;
	const button = target.closest("button");
	return button instanceof HTMLButtonElement ? button : null;
}

function hasVisibleText(button: HTMLButtonElement) {
	return (button.innerText ?? button.textContent ?? "").trim().length > 0;
}

function tooltipTrigger(button: HTMLButtonElement) {
	if (button.hasAttribute("data-tooltip")) return button;
	if (button.getAttribute("aria-label")?.trim() && !hasVisibleText(button)) {
		return button;
	}
	return null;
}

function tooltipLabel(button: HTMLButtonElement) {
	return (
		button.getAttribute("aria-label")?.trim() ||
		button.getAttribute("data-tooltip")?.trim() ||
		null
	);
}

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

function updateDescribedBy(button: HTMLButtonElement, add: boolean) {
	const ids = new Set(
		(button.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean),
	);
	if (add) ids.add(TOOLTIP_ID);
	else ids.delete(TOOLTIP_ID);
	if (ids.size) button.setAttribute("aria-describedby", [...ids].join(" "));
	else button.removeAttribute("aria-describedby");
}

export function Tooltip() {
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
		const hide = () => {
			if (showTimer !== undefined) window.clearTimeout(showTimer);
			showTimer = undefined;
			hoveredTargetRef.current = null;
			setActiveTooltip(null);
		};
		const scanNode = (node: Node) => {
			if (node instanceof HTMLButtonElement) migrateNativeTitle(node);
			if (node instanceof Element) {
				node
					.querySelectorAll<HTMLButtonElement>("button[title]")
					.forEach(migrateNativeTitle);
			}
		};
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
					setActiveTooltip({ target: trigger, label: currentLabel });
			}, SHOW_DELAY_MS);
		};
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
					if (label) setActiveTooltip({ target: button, label });
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
	}, [setActiveTooltip]);

	useEffect(() => {
		const tooltip = tooltipRef.current;
		const target = active?.target;
		if (!tooltip || !target) return;

		let frame: number | undefined;
		const updatePosition = () => {
			frame = undefined;
			if (!target.isConnected) {
				tooltip.style.visibility = "hidden";
				return;
			}
			const anchor = target.getBoundingClientRect();
			const viewportWidth =
				document.documentElement.clientWidth || window.innerWidth;
			const viewportHeight = window.innerHeight;
			if (anchor.bottom < 0 || anchor.top > viewportHeight) {
				tooltip.style.visibility = "hidden";
				return;
			}
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
		};
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
