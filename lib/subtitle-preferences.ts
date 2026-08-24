export const SUBTITLE_FONT_FAMILIES = ["sans", "serif", "mono"] as const;
export type SubtitleFontFamily = (typeof SUBTITLE_FONT_FAMILIES)[number];
export const SUBTITLE_RENDERERS = ["native", "overlay"] as const;
export type SubtitleRenderer = (typeof SUBTITLE_RENDERERS)[number];

export type SubtitleStyle = {
	renderer: SubtitleRenderer;
	fontFamily: SubtitleFontFamily;
	bold: boolean;
	textScale: number;
	fontColor: string;
	borderSize: number;
	borderColor: string;
	backgroundColor: string;
	backgroundOpacity: number;
};

export type SubtitleCue = { start: number; end: number; text: string };

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
	renderer: "native",
	fontFamily: "sans",
	bold: false,
	textScale: 100,
	fontColor: "#ffffff",
	borderSize: 2,
	borderColor: "#000000",
	backgroundColor: "#000000",
	backgroundOpacity: 0,
};

export const SUBTITLE_STYLE_STORAGE_KEY = "zenstream:subtitle:style";

let fallbackSubtitleStyle = DEFAULT_SUBTITLE_STYLE;

export function readStoredSubtitleStyle(): SubtitleStyle {
	if (typeof window === "undefined") return fallbackSubtitleStyle;

	let stored: string | null;
	try {
		stored = window.localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY);
	} catch {
		return fallbackSubtitleStyle;
	}
	if (!stored) {
		fallbackSubtitleStyle = DEFAULT_SUBTITLE_STYLE;
		return fallbackSubtitleStyle;
	}

	try {
		const parsed: unknown = JSON.parse(stored);
		fallbackSubtitleStyle = normalizeSubtitleStyle(parsed) ?? DEFAULT_SUBTITLE_STYLE;
	} catch {
		fallbackSubtitleStyle = DEFAULT_SUBTITLE_STYLE;
	}
	return fallbackSubtitleStyle;
}

export function writeStoredSubtitleStyle(style: SubtitleStyle): boolean {
	const normalized = normalizeSubtitleStyle(style);
	if (!normalized) return false;
	fallbackSubtitleStyle = normalized;
	if (typeof window === "undefined") return true;
	try {
		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(normalized),
		);
		return true;
	} catch {
		return false;
	}
}

export function clearStoredSubtitleStyle() {
	fallbackSubtitleStyle = DEFAULT_SUBTITLE_STYLE;
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(SUBTITLE_STYLE_STORAGE_KEY);
	} catch {
		// Ignore unavailable browser storage; the in-memory default remains usable.
	}
}

export const SUBTITLE_FONT_STACKS: Record<SubtitleFontFamily, string> = {
	sans: "'Noto Sans', Arial, sans-serif",
	serif: "Georgia, 'Times New Roman', serif",
	mono: "ui-monospace, 'SFMono-Regular', Consolas, monospace",
};

export function subtitleOuterShadow(size: number, color: string) {
	if (!size) return "none";
	const radius = Math.max(0, Math.round(size));
	const shadows: string[] = [];
	for (let y = -radius; y <= radius; y += 1) {
		for (let x = -radius; x <= radius; x += 1) {
			if (x === 0 && y === 0) continue;
			shadows.push(`${x}px ${y}px 0 ${color}`);
		}
	}
	return shadows.join(", ");
}

export function parseWebVttCues(input: string): SubtitleCue[] {
	const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
	const cues: SubtitleCue[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const timing = lines[index].match(/^\s*(\S+)\s+-->\s+(\S+)/);
		if (!timing) continue;
		const start = parseSubtitleTimestamp(timing[1]);
		const end = parseSubtitleTimestamp(timing[2]);
		if (start == null || end == null || end <= start) continue;
		const textLines: string[] = [];
		for (
			index += 1;
			index < lines.length && lines[index].trim() !== "";
			index += 1
		)
			textLines.push(lines[index]);
		const text = decodeSubtitleText(textLines.join("\n"));
		if (text) cues.push({ start, end, text });
	}
	return cues;
}

function parseSubtitleTimestamp(value: string): number | null {
	const match = value
		.trim()
		.replace(",", ".")
		.match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
	if (!match) return null;
	return (
		Number(match[1] ?? 0) * 3600 +
		Number(match[2]) * 60 +
		Number(match[3]) +
		Number(match[4]) / 1000
	);
}

function decodeSubtitleText(value: string) {
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/\{\\[^}]*\}/g, "")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&nbsp;/gi, " ")
		.trim();
}

export function isSubtitleStyle(value: unknown): value is SubtitleStyle {
	return normalizeSubtitleStyle(value, false) !== null;
}

function normalizeSubtitleStyle(
	value: unknown,
	allowLegacyFont = true,
): SubtitleStyle | null {
	if (typeof value !== "object" || value === null) return null;
	const style = value as Record<string, unknown>;
	const fontFamily =
		style.fontFamily ??
		(allowLegacyFont ? DEFAULT_SUBTITLE_STYLE.fontFamily : undefined);
	const renderer =
		style.renderer ??
		(allowLegacyFont ? DEFAULT_SUBTITLE_STYLE.renderer : undefined);
	const bold =
		style.bold ?? (allowLegacyFont ? DEFAULT_SUBTITLE_STYLE.bold : undefined);
	if (
		typeof style.textScale !== "number" ||
		style.textScale < 50 ||
		style.textScale > 200 ||
		typeof style.borderSize !== "number" ||
		style.borderSize < 0 ||
		style.borderSize > 8 ||
		typeof style.backgroundOpacity !== "number" ||
		style.backgroundOpacity < 0 ||
		style.backgroundOpacity > 100 ||
		!["fontColor", "borderColor", "backgroundColor"].every(
			(key) =>
				typeof style[key] === "string" &&
				/^#[0-9a-f]{6}$/i.test(style[key] as string),
		) ||
		!SUBTITLE_FONT_FAMILIES.includes(fontFamily as SubtitleFontFamily) ||
		!SUBTITLE_RENDERERS.includes(renderer as SubtitleRenderer) ||
		typeof bold !== "boolean"
	)
		return null;
	return { ...style, renderer, fontFamily, bold } as SubtitleStyle;
}
