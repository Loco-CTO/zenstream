export type MiniCorner =
	"top-left" | "top-right" | "bottom-left" | "bottom-right";
export type MiniPlacement = { corner: MiniCorner; width: number };
export const MINI_PADDING = 16;
export const DEFAULT_MINI_PLACEMENT: MiniPlacement = {
	corner: "bottom-right",
	width: 360,
};
const STORAGE_KEY = "zenstream:video:miniplayer";

export function miniGeometry(
	placement: MiniPlacement,
	viewport: { width: number; height: number },
) {
	const maximum = Math.max(
		1,
		Math.min(
			viewport.width / 2 - MINI_PADDING,
			((viewport.height / 2 - MINI_PADDING) * 16) / 9,
		),
	);
	const width = Math.min(
		maximum,
		Math.max(Math.min(240, maximum), placement.width),
	);
	const height = (width * 9) / 16;
	return {
		width,
		height,
		x: placement.corner.endsWith("right")
			? viewport.width - MINI_PADDING - width
			: MINI_PADDING,
		y: placement.corner.startsWith("bottom")
			? viewport.height - MINI_PADDING - height
			: MINI_PADDING,
	};
}

export function nearestMiniCorner(
	x: number,
	y: number,
	width: number,
	height: number,
	viewport: { width: number; height: number },
): MiniCorner {
	return `${y + height / 2 < viewport.height / 2 ? "top" : "bottom"}-${x + width / 2 < viewport.width / 2 ? "left" : "right"}`;
}

export function readMiniPlacement(): MiniPlacement {
	try {
		const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
		if (
			["top-left", "top-right", "bottom-left", "bottom-right"].includes(
				value?.corner,
			) &&
			Number.isFinite(value?.width) &&
			value.width > 0
		)
			return value;
	} catch {
		/* Storage is optional. */
	}
	return DEFAULT_MINI_PLACEMENT;
}

export function writeMiniPlacement(value: MiniPlacement) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
	} catch {
		/* Keep the current in-memory placement. */
	}
}
