"use client";

import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type PointerEvent,
} from "react";
import {
	miniGeometry,
	nearestMiniCorner,
	readMiniPlacement,
	writeMiniPlacement,
	MINI_PADDING,
	type MiniPlacement,
} from "@/lib/video-miniplayer";

export function MiniPlayerFrame({
	minimized,
	children,
}: {
	minimized: boolean;
	children: ReactNode;
}) {
	const [placement, setPlacement] = useState<MiniPlacement>(readMiniPlacement);
	const [viewport, setViewport] = useState({ width: 1280, height: 720 });
	const [live, setLive] = useState<{
		x: number;
		y: number;
		width: number;
	} | null>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const animationRef = useRef<Animation | null>(null);
	const pendingSnap = useRef<{
		from: { x: number; y: number };
		to: { x: number; y: number };
	} | null>(null);
	useLayoutEffect(() => {
		const snap = pendingSnap.current;
		pendingSnap.current = null;
		if (!snap || !frameRef.current) return;
		animationRef.current?.cancel();
		animationRef.current = frameRef.current.animate(
			[
				{
					transform: `translate(${snap.from.x - snap.to.x}px, ${snap.from.y - snap.to.y}px)`,
				},
				{ transform: "translate(0px, 0px)" },
			],
			{ duration: 280, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
		);
	});
	useEffect(() => () => animationRef.current?.cancel(), []);
	const gesture = useRef<{
		id: number;
		x: number;
		y: number;
		origin: ReturnType<typeof miniGeometry>;
		edge?: string;
		moved: boolean;
	} | null>(null);
	const suppressClick = useRef(false);
	useEffect(() => {
		const resize = () =>
			setViewport({ width: window.innerWidth, height: window.innerHeight });
		resize();
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, []);
	const geometry = miniGeometry(placement, viewport);
	const rect = live ?? geometry;
	function start(event: PointerEvent<HTMLDivElement>, edge?: string) {
		if (
			!minimized ||
			event.button !== 0 ||
			(event.target as Element).closest("button,input,a,[data-mini-no-drag]")
		)
			return;
		event.preventDefault();
		const current = frameRef.current?.getBoundingClientRect();
		const origin = current
			? {
					x: current.x,
					y: current.y,
					width: current.width,
					height: current.height,
				}
			: geometry;
		animationRef.current?.cancel();
		if (current) setLive(origin);
		gesture.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			origin,
			edge,
			moved: false,
		};
		// Capture only once a drag starts so ordinary clicks still reach the video.
	}
	function move(event: PointerEvent<HTMLDivElement>) {
		const g = gesture.current;
		if (!g || event.pointerId !== g.id) return;
		const dx = event.clientX - g.x,
			dy = event.clientY - g.y;
		if (!g.moved && Math.hypot(dx, dy) < 5) return;
		g.moved = true;
		event.currentTarget.setPointerCapture(event.pointerId);
		if (g.edge) {
			const horizontal = placement.corner.endsWith("right") ? -dx : dx;
			const vertical =
				((placement.corner.startsWith("bottom") ? -dy : dy) * 16) / 9;
			const delta =
				g.edge === "corner"
					? Math.abs(horizontal) > Math.abs(vertical)
						? horizontal
						: vertical
					: g.edge === "horizontal"
						? horizontal
						: vertical;
			const next = miniGeometry(
				{ ...placement, width: g.origin.width + delta },
				viewport,
			);
			setLive(next);
		} else {
			setLive({
				x: Math.max(
					MINI_PADDING,
					Math.min(viewport.width - MINI_PADDING - geometry.width, g.origin.x + dx),
				),
				y: Math.max(
					MINI_PADDING,
					Math.min(
						viewport.height - MINI_PADDING - geometry.height,
						g.origin.y + dy,
					),
				),
				width: geometry.width,
			});
		}
	}
	function end(event: PointerEvent<HTMLDivElement>) {
		const g = gesture.current;
		if (!g || g.id !== event.pointerId) return;
		if (g.moved) {
			suppressClick.current = true;
			const next = {
				corner: g.edge
					? placement.corner
					: nearestMiniCorner(rect.x, rect.y, rect.width, rect.height, viewport),
				width: rect.width,
			};
			pendingSnap.current = { from: rect, to: miniGeometry(next, viewport) };
			setPlacement(next);
			writeMiniPlacement(next);
		}
		gesture.current = null;
		setLive(null);
	}
	const right = placement.corner.endsWith("right"),
		bottom = placement.corner.startsWith("bottom");
	return (
		<div
			ref={frameRef}
			data-testid="video-player-frame"
			data-minimized={minimized}
			className={
				minimized
					? "zenstream-mini-frame fixed z-[190] rounded-xl bg-neutral-900 text-white shadow-2xl ring-1 ring-white/10"
					: "fixed inset-0 z-[200] h-[100dvh] bg-black text-white"
			}
			style={
				minimized
					? {
							left: rect.x,
							top: rect.y,
							width: rect.width,
							height: rect.height,
							transition: live
								? "none"
								: "width 160ms ease-out, height 160ms ease-out",
							touchAction: "none",
							userSelect: "none",
						}
					: undefined
			}
			onPointerDown={start}
			onPointerMove={move}
			onPointerUp={end}
			onPointerCancel={end}
			onLostPointerCapture={end}
			onClickCapture={(e) => {
				if (suppressClick.current) {
					suppressClick.current = false;
					e.preventDefault();
					e.stopPropagation();
				}
			}}
		>
			<div
				className={
					minimized
						? "relative aspect-video w-full overflow-hidden rounded-xl"
						: "relative h-full w-full"
				}
			>
				{children}
			</div>
			{minimized && (
				<>
					<div
						aria-hidden
						className={`zenstream-mini-resize absolute inset-y-2 w-2 cursor-ew-resize ${right ? "-left-1" : "-right-1"}`}
						onPointerDown={(e) => {
							e.stopPropagation();
							start(e, "horizontal");
						}}
					/>
					<div
						aria-hidden
						className={`zenstream-mini-resize absolute inset-x-2 h-2 cursor-ns-resize ${bottom ? "-top-1" : "-bottom-1"}`}
						onPointerDown={(e) => {
							e.stopPropagation();
							start(e, "vertical");
						}}
					/>
					<div
						aria-hidden
						className={`zenstream-mini-resize absolute h-4 w-4 ${right ? "-left-1" : "-right-1"} ${bottom ? "-top-1" : "-bottom-1"} ${right === bottom ? "cursor-nwse-resize" : "cursor-nesw-resize"}`}
						onPointerDown={(e) => {
							e.stopPropagation();
							start(e, "corner");
						}}
					/>
				</>
			)}
		</div>
	);
}
