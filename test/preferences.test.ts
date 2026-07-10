import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalePreference, getStoredLocale, LOCALE_STORAGE_KEY, setLocalePreference, storeLocale } from "@/lib/preferences";
import { getSubtitlePreference, isSubtitleStyle, parseWebVttCues, setSubtitlePreference, subtitleHasEmbeddedStyle } from "@/lib/subtitle-preferences";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("locale preferences", () => {
  it("loads a valid locale", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ locale: "ja" })));
    await expect(getLocalePreference()).resolves.toBe("ja");
  });

  it("rejects invalid responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ locale: "fr" })));
    await expect(getLocalePreference()).rejects.toThrow("Invalid locale");
  });

  it("persists locale with PATCH", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ locale: "ja" })),
    );
    await expect(setLocalePreference("ja")).resolves.toBe("ja");
    expect(fetchMock).toHaveBeenCalledWith("/api/preferences/locale", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ locale: "ja" }),
    }));
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
  });

  it("reads and validates the locally cached locale", () => {
    storeLocale("ja");
    expect(getStoredLocale()).toBe("ja");
    localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
    expect(getStoredLocale()).toBeNull();
  });
});

describe("subtitle preferences", () => {
  const style = { textScale: 125, fontColor: "#abcdef", borderSize: 2, borderColor: "#000000", backgroundColor: "#112233", backgroundOpacity: 40 };

  it("loads and validates an account style", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
    await expect(getSubtitlePreference()).resolves.toEqual(style);
    expect(isSubtitleStyle({ ...style, textScale: 201 })).toBe(false);
  });

  it("persists the complete style with PATCH", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
    await expect(setSubtitlePreference(style)).resolves.toEqual(style);
    expect(fetchMock).toHaveBeenCalledWith("/api/preferences/subtitles", expect.objectContaining({ method: "PATCH", body: JSON.stringify(style) }));
  });

  it("detects embedded WebVTT and ASS styling", () => {
    expect(subtitleHasEmbeddedStyle("WEBVTT\n\nSTYLE\n::cue { color: red; }" )).toBe(true);
    expect(subtitleHasEmbeddedStyle("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nPlain text")).toBe(false);
    expect(subtitleHasEmbeddedStyle("Dialogue: {\\bord4}Styled text")).toBe(true);
  });

  it("parses unstyled WebVTT cues for the custom renderer", () => {
    expect(parseWebVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello<br>world")).toEqual([{ start: 1, end: 3.5, text: "Hello\nworld" }]);
  });
});
