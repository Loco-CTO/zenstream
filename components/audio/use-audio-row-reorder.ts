"use client";

import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
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
	active: boolean;
	rowHeight: number;
	previousPointerEvents: string;
	previousUserSelect: string;
};

/** Pointer-driven row reordering for the playlist and audio queue lists. */
export function useAudioRowReorder(
	itemCount: number,
	onReorder: (from: number, to: number) => void,
	scope: "playlist" | "queue",
) {
	const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
	const [targetIndex, setTargetIndex] = useState<number | null>(null);
	const [draggedHeight, setDraggedHeight] = useState(0);
	const gestureRef = useRef<DragGesture | null>(null);
	const targetIndexRef = useRef<number | null>(null);
	const itemCountRef = useRef(itemCount);
	const onReorderRef = useRef(onReorder);
	const suppressClickUntilRef = useRef(0);
	useLayoutEffect(() => {
		itemCountRef.current = itemCount;
		onReorderRef.current = onReorder;
	}, [itemCount, onReorder]);

	useEffect(() => {
		let frame: number | null = null;

		const setTarget = (next: number) => {
			if (targetIndexRef.current === next) return;
			targetIndexRef.current = next;
			setTargetIndex(next);
		};

		const updateTargetFromPointer = (gesture: DragGesture) => {
			const selector = `[data-audio-reorder-scope="${scope}"][data-audio-reorder-index]`;
			const element = document.elementFromPoint(gesture.clientX, gesture.clientY);
			const row = element?.closest(selector) as HTMLElement | null;
			const rawIndex = row?.dataset.audioReorderIndex;
			if (rawIndex == null) return;
			const hitIndex = Number(rawIndex);
			const count = itemCountRef.current;
			if (!Number.isInteger(hitIndex) || hitIndex < 0 || hitIndex >= count) return;
			const bounds = row.getBoundingClientRect();
			let insertionIndex = hitIndex + (gesture.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
			if (insertionIndex > gesture.from) insertionIndex -= 1;
			setTarget(Math.max(0, Math.min(count - 1, insertionIndex)));
		};

		const autoScrollAtPointer = (gesture: DragGesture) => {
			const scrollContainer = gesture.row.closest<HTMLElement>("[data-audio-reorder-scroll]");
			if (scrollContainer) {
				const bounds = scrollContainer.getBoundingClientRect();
				const edgeSize = Math.min(64, bounds.height * 0.2);
				const maxStep = 14;
				if (gesture.clientY < bounds.top + edgeSize && scrollContainer.scrollTop > 0) {
					const strength = (bounds.top + edgeSize - gesture.clientY) / edgeSize;
					const previous = scrollContainer.scrollTop;
					scrollContainer.scrollTop -= Math.max(2, Math.round(maxStep * Math.min(1, strength)));
					return scrollContainer.scrollTop - previous;
				}
				const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
				if (gesture.clientY > bounds.bottom - edgeSize && scrollContainer.scrollTop < maxScroll) {
					const strength = (gesture.clientY - (bounds.bottom - edgeSize)) / edgeSize;
					const previous = scrollContainer.scrollTop;
					scrollContainer.scrollTop += Math.max(2, Math.round(maxStep * Math.min(1, strength)));
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
				scrollRoot.scrollTop -= Math.max(2, Math.round(maxStep * Math.min(1, strength)));
				return scrollRoot.scrollTop - previous;
			}
			const maxScroll = scrollRoot.scrollHeight - window.innerHeight;
			if (gesture.clientY > window.innerHeight - edgeSize && scrollRoot.scrollTop < maxScroll) {
				const strength = (gesture.clientY - (window.innerHeight - edgeSize)) / edgeSize;
				const previous = scrollRoot.scrollTop;
				scrollRoot.scrollTop += Math.max(2, Math.round(maxStep * Math.min(1, strength)));
				return scrollRoot.scrollTop - previous;
			}
			return 0;
		};

		const schedulePreviewFrame = () => {
			if (frame != null) return;
			frame = window.requestAnimationFrame(() => {
				frame = null;
				const current = gestureRef.current;
				if (!current?.active) return;
				const scrollDelta = autoScrollAtPointer(current);
				if (scrollDelta !== 0) {
					current.scrollAdjustmentY += scrollDelta;
					current.row.style.setProperty(
						"--audio-reorder-delta-y",
						`${current.clientY - current.startY + current.scrollAdjustmentY}px`,
					);
				}
				updateTargetFromPointer(current);
				if (scrollDelta !== 0) schedulePreviewFrame();
			});
		};

		const restoreGesture = (gesture: DragGesture) => {
			gesture.row.style.pointerEvents = gesture.previousPointerEvents;
			gesture.row.style.removeProperty("--audio-reorder-delta-y");
			document.documentElement.style.userSelect = gesture.previousUserSelect;
		};

		const finish = (event: PointerEvent | null, commit: boolean) => {
			const gesture = gestureRef.current;
			if (!gesture || (event && event.pointerId !== gesture.pointerId)) return;
			if (frame != null) {
				window.cancelAnimationFrame(frame);
				frame = null;
			}
			if (event) {
				gesture.clientX = event.clientX;
				gesture.clientY = event.clientY;
			}
			if (gesture.active) {
				if (commit) {
					updateTargetFromPointer(gesture);
					const destination = targetIndexRef.current ?? gesture.from;
					if (destination !== gesture.from) onReorderRef.current(gesture.from, destination);
					suppressClickUntilRef.current = performance.now() + 300;
				} else {
					suppressClickUntilRef.current = performance.now() + 300;
				}
				restoreGesture(gesture);
			}
			gestureRef.current = null;
			targetIndexRef.current = null;
			setDraggedIndex(null);
			setTargetIndex(null);
			setDraggedHeight(0);
		};

		const handlePointerMove = (event: PointerEvent) => {
			const gesture = gestureRef.current;
			if (!gesture || event.pointerId !== gesture.pointerId) return;
			gesture.clientX = event.clientX;
			gesture.clientY = event.clientY;
			if (!gesture.active) {
				const distance = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
				if (distance < 5) return;
				gesture.active = true;
				gesture.previousPointerEvents = gesture.row.style.pointerEvents;
				gesture.previousUserSelect = document.documentElement.style.userSelect;
				gesture.row.style.pointerEvents = "none";
				document.documentElement.style.userSelect = "none";
				targetIndexRef.current = gesture.from;
				setDraggedIndex(gesture.from);
				setTargetIndex(gesture.from);
				setDraggedHeight(gesture.rowHeight);
			}
			event.preventDefault();
			gesture.row.style.setProperty(
				"--audio-reorder-delta-y",
				`${event.clientY - gesture.startY + gesture.scrollAdjustmentY}px`,
			);
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
			if (frame != null) window.cancelAnimationFrame(frame);
			const gesture = gestureRef.current;
			if (gesture?.active) restoreGesture(gesture);
			gestureRef.current = null;
		};
	}, [scope]);

	const onPointerDown = (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
		if (
			!event.isPrimary ||
			event.button !== 0 ||
			event.pointerType === "touch" ||
			itemCountRef.current < 2 ||
			index < 0 ||
			index >= itemCountRef.current
		) {
			return;
		}
		gestureRef.current = {
			pointerId: event.pointerId,
			from: index,
			startX: event.clientX,
			startY: event.clientY,
			clientX: event.clientX,
			clientY: event.clientY,
			scrollAdjustmentY: 0,
			row: event.currentTarget,
			active: false,
			rowHeight: event.currentTarget.getBoundingClientRect().height,
			previousPointerEvents: "",
			previousUserSelect: "",
		};
	};

	const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
		if (performance.now() >= suppressClickUntilRef.current) return;
		event.preventDefault();
		event.stopPropagation();
		suppressClickUntilRef.current = 0;
	};

	const rowOffset = (index: number) => {
		if (draggedIndex == null || targetIndex == null || draggedIndex === targetIndex) return 0;
		if (draggedIndex < targetIndex && index > draggedIndex && index <= targetIndex) return -draggedHeight;
		if (draggedIndex > targetIndex && index >= targetIndex && index < draggedIndex) return draggedHeight;
		return 0;
	};

	return { draggedIndex, targetIndex, rowOffset, onPointerDown, onClickCapture };
}
