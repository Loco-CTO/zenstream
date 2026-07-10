import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalePreference, getStoredLocale, LOCALE_STORAGE_KEY, setLocalePreference, storeLocale } from "@/lib/preferences";
import { getSubtitlePreference, isSubtitleStyle, parseWebVttCues, setSubtitlePreference } from "@/lib/subtitle-preferences";

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
  const style = { fontFamily: "serif" as const, textScale: 125, fontColor: "#abcdef", borderSize: 2, borderColor: "#000000", backgroundColor: "#112233", backgroundOpacity: 40 };

  it("loads and validates an account style", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
    await expect(getSubtitlePreference()).resolves.toEqual(style);
    expect(isSubtitleStyle({ ...style, textScale: 201 })).toBe(false);
  });

  it("defaults a legacy response without a font family to sans", async () => {
    const legacyStyle = { textScale: style.textScale, fontColor: style.fontColor, borderSize: style.borderSize, borderColor: style.borderColor, backgroundColor: style.backgroundColor, backgroundOpacity: style.backgroundOpacity };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(legacyStyle)));
    await expect(getSubtitlePreference()).resolves.toEqual({ ...legacyStyle, fontFamily: "sans" });
  });

  it("persists the complete style with PATCH", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
    await expect(setSubtitlePreference(style)).resolves.toEqual(style);
    expect(fetchMock).toHaveBeenCalledWith("/api/preferences/subtitles", expect.objectContaining({ method: "PATCH", body: JSON.stringify(style) }));
  });

  it("parses unstyled and authored-style WebVTT cues for the custom renderer", () => {
    expect(parseWebVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello<br>world")).toEqual([{ start: 1, end: 3.5, text: "Hello\nworld" }]);
    expect(parseWebVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.500 line:80%\n{\\bord4}<i>Styled</i> text")).toEqual([{ start: 1, end: 3.5, text: "Styled text" }]);
    expect(parseWebVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nFirst\n\n00:00:01.000 --> 00:00:03.500\nSecond")).toHaveLength(2);
  });
});
