export type SubtitleStyle = {
  textScale: number;
  fontColor: string;
  borderSize: number;
  borderColor: string;
  backgroundColor: string;
  backgroundOpacity: number;
};

export type SubtitleCue = { start: number; end: number; text: string };

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = { textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 };

/** WebVTT produced from ASS can retain inline tags or a STYLE block. */
export function subtitleHasEmbeddedStyle(input: string): boolean {
  return /(^|\n)STYLE(?:\s|$)/im.test(input) ||
    /::cue(?:\s*\{|\s*\()/i.test(input) ||
    /<(?:c(?:\.[^>\s]+)*|b|i|u|ruby|rt)(?:\s|>)/i.test(input) ||
    /\{\\(?:[ibu]|fn|fs|c|1c|3c|4c|bord|outline|shad|alpha|a\d)/i.test(input);
}

export function parseWebVttCues(input: string): SubtitleCue[] {
  return input.split(/\r?\n\s*\r?\n/).flatMap((block) => {
    const lines = block.split(/\r?\n/);
    const timingIndex = lines.findIndex((line) => line.includes(" --> "));
    if (timingIndex < 0) return [];
    const timing = lines[timingIndex].split(" --> ");
    const start = parseSubtitleTimestamp(timing[0]);
    const end = parseSubtitleTimestamp(timing[1]?.split(/\s+/)[0] ?? "");
    if (start == null || end == null) return [];
    const text = lines.slice(timingIndex + 1).join("\n").replace(/<br\s*\/?>(?=\S)/gi, "\n").replace(/<[^>]+>/g, "").trim();
    return text ? [{ start, end, text }] : [];
  });
}

function parseSubtitleTimestamp(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
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
