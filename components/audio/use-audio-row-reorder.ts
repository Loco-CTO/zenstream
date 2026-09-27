"use client";

import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	type MouseEvent as ReactMouseEvent,
	type PointerEvent as ReactPointerEvent,
} from "react";

type DragGesture = {
	pointerId: number;
	from: number;
	startX: number;
	startY: number;
	clientX: number;
	clientY: number;
	scrollAdjustmentY: number;
	row: HTMLElement;
	list: HTMLElement;
	active: boolean;
	rowStep: number;
	previewTarget: number;
	offsetRows: Map<number, { row: HTMLElement; previousTransform: string }>;
	previousPointerEvents: string;
	previousOpacity: string;
	previousTransform: string;
	previousTransition: string;
	previousZIndex: string;
	previousUserSelect: string;
};

function restoreGestureVisuals(gesture: DragGesture) {
	for (const { row, previousTransform } of gesture.offsetRows.values()) {
		row.style.transform = previousTransform;
	}
	gesture.offsetRows.clear();
	gesture.row.style.pointerEvents = gesture.previousPointerEvents;
	gesture.row.style.opacity = gesture.previousOpacity;
	gesture.row.style.transform = gesture.previousTransform;
	gesture.row.style.transition = gesture.previousTransition;
	gesture.row.style.zIndex = gesture.previousZIndex;
	document.documentElement.style.userSelect = gesture.previousUserSelect;
}

/** Keeps drag previews out of React's render path for large lists. */
export function useAudioRowReorder(
	itemCount: number,
	onReorder: (from: number, to: number) => void,
	scope: "playlist" | "queue",
	enabled = true,
) {
	const gestureRef = useRef<DragGesture | null>(null);
	const pendingCleanupRef = useRef<DragGesture | null>(null);
	const pendingCleanupFrameRef = useRef<number | null>(null);
	const itemCountRef = useRef(itemCount);
	const onReorderRef = useRef(onReorder);
	const enabledRef = useRef(enabled);
	const suppressClickUntilRef = useRef(0);
	useLayoutEffect(() => {
		itemCountRef.current = itemCount;
		onReorderRef.current = onReorder;
		enabledRef.current = enabled;
	}, [enabled, itemCount, onReorder]);

	useEffect(() => {
		let previewFrame: number | null = null;
		let cleanupFrame: number | null = null;

		const getRowAtIndex = (gesture: DragGesture, index: number) => {
			const row = gesture.list.children.item(index);
			if (
				!(row instanceof HTMLElement) ||
				Number(row.dataset.audioReorderIndex) !== index
			)
				return null;
			return row;
		};

		const setOffset = (gesture: DragGesture, index: number, offset: number) => {
			const row = getRowAtIndex(gesture, index);
			if (!row) return;
			if (!gesture.offsetRows.has(index)) {
				gesture.offsetRows.set(index, {
					row,
					previousTransform: row.style.transform,
				});
			}
			row.style.transform = `translateY(${offset}px)`;
		};

		const clearOffset = (gesture: DragGesture, index: number) => {
			const entry = gesture.offsetRows.get(index);
			if (!entry) return;
			entry.row.style.transform = entry.previousTransform;
			gesture.offsetRows.delete(index);
		};

		const applyTarget = (gesture: DragGesture, target: number) => {
			const previous = gesture.previewTarget;
			if (target === previous) return;
			const previousDirection = Math.sign(previous - gesture.from);
			const nextDirection = Math.sign(target - gesture.from);

			if (previousDirection === nextDirection) {
				if (nextDirection > 0) {
					if (target > previous) {
						for (let index = previous + 1; index <= target; index += 1)
							setOffset(gesture, index, -gesture.rowStep);
					} else {
						for (let index = target + 1; index <= previous; index += 1)
							clearOffset(gesture, index);
					}
				} else if (nextDirection < 0) {
					if (target < previous) {
						for (let index = target; index < previous; index += 1)
							setOffset(gesture, index, gesture.rowStep);
					} else {
						for (let index = previous; index < target; index += 1)
							clearOffset(gesture, index);
					}
				}
			} else {
				if (previousDirection > 0) {
					for (let index = gesture.from + 1; index <= previous; index += 1)
						clearOffset(gesture, index);
				} else if (previousDirection < 0) {
					for (let index = previous; index < gesture.from; index += 1)
						clearOffset(gesture, index);
				}
				if (nextDirection > 0) {
					for (let index = gesture.from + 1; index <= target; index += 1)
						setOffset(gesture, index, -gesture.rowStep);
				} else if (nextDirection < 0) {
					for (let index = target; index < gesture.from; index += 1)
						setOffset(gesture, index, gesture.rowStep);
				}
			}
			gesture.previewTarget = target;
		};

		const updateTargetFromPointer = (gesture: DragGesture) => {
			const selector = `[data-audio-reorder-scope="${scope}"][data-audio-reorder-index]`;
			const element = document.elementFromPoint(gesture.clientX, gesture.clientY);
			const row = element?.closest(selector) as HTMLElement | null;
			if (!row || row.closest("[data-audio-reorder-list]") !== gesture.list)
				return;
			const hitIndex = Number(row.dataset.audioReorderIndex);
			const count = itemCountRef.current;
			if (!Number.isInteger(hitIndex) || hitIndex < 0 || hitIndex >= count) return;
			const bounds = row.getBoundingClientRect();
			let insertionIndex =
				hitIndex + (gesture.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
			if (insertionIndex > gesture.from) insertionIndex -= 1;
			applyTarget(gesture, Math.max(0, Math.min(count - 1, insertionIndex)));
		};

		const autoScrollAtPointer = (gesture: DragGesture) => {
			const scrollContainer = gesture.row.closest<HTMLElement>(
				"[data-audio-reorder-scroll]",
			);
			if (scrollContainer) {
				const bounds = scrollContainer.getBoundingClientRect();
				const edgeSize = Math.min(64, bounds.height * 0.2);
				const maxStep = 14;
				if (
					gesture.clientY < bounds.top + edgeSize &&
					scrollContainer.scrollTop > 0
				) {
					const strength = (bounds.top + edgeSize - gesture.clientY) / edgeSize;
					const previous = scrollContainer.scrollTop;
					scrollContainer.scrollTop -= Math.max(
						2,
						Math.round(maxStep * Math.min(1, strength)),
					);
					return scrollContainer.scrollTop - previous;
				}
				const maxScroll =
					scrollContainer.scrollHeight - scrollContainer.clientHeight;
				if (
					gesture.clientY > bounds.bottom - edgeSize &&
					scrollContainer.scrollTop < maxScroll
				) {
					const strength = (gesture.clientY - (bounds.bottom - edgeSize)) / edgeSize;
					const previous = scrollContainer.scrollTop;
					scrollContainer.scrollTop += Math.max(
						2,
						Math.round(maxStep * Math.min(1, strength)),
					);
					return scrollContainer.scrollTop - previous;
				}
				return 0;
			}

			const scrollRoot = document.scrollingElement;
			if (!scrollRoot) return 0;
			const edgeSize = 64;
			const maxStep = 14;
			if (gesture.clientY < edgeSize && scrollRoot.scrollTop > 0) {
				const strength = (edgeSize - gesture.clientY) / edgeSize;
				const previous = scrollRoot.scrollTop;
				scrollRoot.scrollTop -= Math.max(
					2,
					Math.round(maxStep * Math.min(1, strength)),
				);
				return scrollRoot.scrollTop - previous;
			}
			const maxScroll = scrollRoot.scrollHeight - window.innerHeight;
			if (
				gesture.clientY > window.innerHeight - edgeSize &&
				scrollRoot.scrollTop < maxScroll
			) {
				const strength =
					(gesture.clientY - (window.innerHeight - edgeSize)) / edgeSize;
				const previous = scrollRoot.scrollTop;
				scrollRoot.scrollTop += Math.max(
					2,
					Math.round(maxStep * Math.min(1, strength)),
				);
				return scrollRoot.scrollTop - previous;
			}
			return 0;
		};

		const schedulePreviewFrame = () => {
			if (previewFrame != null) return;
			previewFrame = window.requestAnimationFrame(() => {
				previewFrame = null;
				const gesture = gestureRef.current;
				if (!gesture?.active) return;
				const scrollDelta = autoScrollAtPointer(gesture);
				if (scrollDelta !== 0) {
					gesture.scrollAdjustmentY += scrollDelta;
					gesture.row.style.transform = `translateY(${gesture.clientY - gesture.startY + gesture.scrollAdjustmentY}px)`;
				}
				updateTargetFromPointer(gesture);
				if (scrollDelta !== 0) schedulePreviewFrame();
			});
		};

		const releasePointer = (gesture: DragGesture) => {
			gesture.row.style.pointerEvents = gesture.previousPointerEvents;
			document.documentElement.style.userSelect = gesture.previousUserSelect;
		};

		const finish = (event: PointerEvent | null, commit: boolean) => {
			const gesture = gestureRef.current;
			if (!gesture || (event && event.pointerId !== gesture.pointerId)) return;
			if (previewFrame != null) {
				window.cancelAnimationFrame(previewFrame);
				previewFrame = null;
			}
			if (event) {
				gesture.clientX = event.clientX;
				gesture.clientY = event.clientY;
			}
			let destination = gesture.from;
			if (gesture.active) {
				if (commit) {
					updateTargetFromPointer(gesture);
					destination = gesture.previewTarget;
				}
				suppressClickUntilRef.current = performance.now() + 300;
			}
			gestureRef.current = null;
			releasePointer(gesture);

			if (gesture.active && commit && destination !== gesture.from) {
				onReorderRef.current(gesture.from, destination);
				pendingCleanupRef.current = gesture;
				cleanupFrame = window.requestAnimationFrame(() => {
					cleanupFrame = null;
					if (pendingCleanupRef.current !== gesture) return;
					restoreGestureVisuals(gesture);
					pendingCleanupRef.current = null;
					pendingCleanupFrameRef.current = null;
				});
				pendingCleanupFrameRef.current = cleanupFrame;
			} else {
				restoreGestureVisuals(gesture);
			}
		};

		const handlePointerMove = (event: PointerEvent) => {
			const gesture = gestureRef.current;
			if (!gesture || event.pointerId !== gesture.pointerId) return;
			gesture.clientX = event.clientX;
			gesture.clientY = event.clientY;
			if (!gesture.active) {
				if (
					Math.hypot(
						event.clientX - gesture.startX,
						event.clientY - gesture.startY,
					) < 5
				)
					return;
				gesture.active = true;
				gesture.row.style.pointerEvents = "none";
				gesture.row.style.opacity = "0.45";
				gesture.row.style.transition = "none";
				gesture.row.style.zIndex = "20";
				document.documentElement.style.userSelect = "none";
			}
			event.preventDefault();
			gesture.row.style.transform = `translateY(${event.clientY - gesture.startY + gesture.scrollAdjustmentY}px)`;
			schedulePreviewFrame();
		};

		const handlePointerUp = (event: PointerEvent) => finish(event, true);
		const handlePointerCancel = (event: PointerEvent) => finish(event, false);
		const handleWindowBlur = () => finish(null, false);

		window.addEventListener("pointermove", handlePointerMove, { passive: false });
		window.addEventListener("pointerup", handlePointerUp);
		window.addEventListener("pointercancel", handlePointerCancel);
		window.addEventListener("blur", handleWindowBlur);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
			window.removeEventListener("pointercancel", handlePointerCancel);
			window.removeEventListener("blur", handleWindowBlur);
			if (previewFrame != null) window.cancelAnimationFrame(previewFrame);
			if (cleanupFrame != null) window.cancelAnimationFrame(cleanupFrame);
			if (pendingCleanupFrameRef.current != null)
				window.cancelAnimationFrame(pendingCleanupFrameRef.current);
			if (gestureRef.current?.active) restoreGestureVisuals(gestureRef.current);
			if (pendingCleanupRef.current)
				restoreGestureVisuals(pendingCleanupRef.current);
			gestureRef.current = null;
			pendingCleanupRef.current = null;
			pendingCleanupFrameRef.current = null;
		};
	}, [scope]);

	const onPointerDown = useCallback(
		(event: ReactPointerEvent<HTMLDivElement>) => {
			if (
				!enabledRef.current ||
				!event.isPrimary ||
				event.button !== 0 ||
				event.pointerType === "touch" ||
				itemCountRef.current < 2
			)
				return;
			const target = event.target as Element;
			const row = target.closest<HTMLElement>(
				`[data-audio-reorder-scope="${scope}"][data-audio-reorder-index]`,
			);
			const list = event.currentTarget;
			if (!row || row.closest("[data-audio-reorder-list]") !== list) return;
			const from = Number(row.dataset.audioReorderIndex);
			if (!Number.isInteger(from) || from < 0 || from >= itemCountRef.current)
				return;

			if (pendingCleanupFrameRef.current != null)
				window.cancelAnimationFrame(pendingCleanupFrameRef.current);
			if (pendingCleanupRef.current)
				restoreGestureVisuals(pendingCleanupRef.current);
			pendingCleanupFrameRef.current = null;
			pendingCleanupRef.current = null;

			const next = list.children.item(from + 1) as HTMLElement | null;
			const previous = list.children.item(from - 1) as HTMLElement | null;
			const bounds = row.getBoundingClientRect();
			const neighbor = next ?? previous;
			const rowStep = neighbor
				? Math.abs(neighbor.getBoundingClientRect().top - bounds.top)
				: bounds.height;
			gestureRef.current = {
				pointerId: event.pointerId,
				from,
				startX: event.clientX,
				startY: event.clientY,
				clientX: event.clientX,
				clientY: event.clientY,
				scrollAdjustmentY: 0,
				row,
				list,
				active: false,
				rowStep,
				previewTarget: from,
				offsetRows: new Map(),
				previousPointerEvents: row.style.pointerEvents,
				previousOpacity: row.style.opacity,
				previousTransform: row.style.transform,
				previousTransition: row.style.transition,
				previousZIndex: row.style.zIndex,
				previousUserSelect: document.documentElement.style.userSelect,
			};
		},
		[scope],
	);

	const onClickCapture = useCallback(
		(event: ReactMouseEvent<HTMLDivElement>) => {
			if (performance.now() >= suppressClickUntilRef.current) return;
			event.preventDefault();
			event.stopPropagation();
			suppressClickUntilRef.current = 0;
		},
		[],
	);

	return { onPointerDown, onClickCapture };
}
