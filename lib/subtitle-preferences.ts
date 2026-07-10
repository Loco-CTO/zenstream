export type SubtitleStyle = {
  textScale: number;
  fontColor: string;
  borderSize: number;
  borderColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = { textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 };

/** WebVTT produced from ASS can retain inline tags or a STYLE block. */
export function subtitleHasEmbeddedStyle(input: string): boolean {
  return /(^|\n)STYLE(?:\s|$)/im.test(input) ||
    /::cue(?:\s*\{|\s*\()/i.test(input) ||
    /<(?:c(?:\.[^>\s]+)*|b|i|u|ruby|rt)(?:\s|>)/i.test(input) ||
    /\{\\(?:[ibu]|fn|fs|c|1c|3c|4c|bord|outline|shad|alpha|a\d)/i.test(input);
}

export async function getSubtitlePreference(): Promise<SubtitleStyle> {
  const response = await fetch("/api/preferences/subtitles", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load subtitle preferences.");
  const data: unknown = await response.json();
  if (!isSubtitleStyle(data)) throw new Error("Invalid subtitle preference response.");
  return data;
}

export async function setSubtitlePreference(style: SubtitleStyle): Promise<SubtitleStyle> {
  const response = await fetch("/api/preferences/subtitles", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(style) });
  if (!response.ok) throw new Error("Could not save subtitle preferences.");
  const data: unknown = await response.json();
  if (!isSubtitleStyle(data)) throw new Error("Invalid subtitle preference response.");
  return data;
}

export function isSubtitleStyle(value: unknown): value is SubtitleStyle {
  if (typeof value !== "object" || value === null) return false;
  const style = value as Record<string, unknown>;
  return typeof style.textScale === "number" && style.textScale >= 50 && style.textScale <= 200 &&
    typeof style.borderSize === "number" && style.borderSize >= 0 && style.borderSize <= 8 &&
    typeof style.backgroundOpacity === "number" && style.backgroundOpacity >= 0 && style.backgroundOpacity <= 100 &&
    ["fontColor", "borderColor", "backgroundColor"].every((key) => typeof style[key] === "string" && /^#[0-9a-f]{6}$/i.test(style[key] as string));
}
