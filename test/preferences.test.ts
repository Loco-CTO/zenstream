import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLocalePreference, getStoredLocale, LOCALE_STORAGE_KEY, setLocalePreference, storeLocale } from "@/lib/preferences";

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
