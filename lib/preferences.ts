import { isLocale, type Locale } from "@/lib/i18n";

export const LOCALE_STORAGE_KEY = "zenstream.locale";

export function getStoredLocale(): Locale | null {
  if (typeof window === "undefined") return null;
  try {
    const locale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(locale) ? locale : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The remote preference remains authoritative when browser storage is unavailable.
  }
}

export async function getLocalePreference(): Promise<Locale> {
  const response = await fetch("/api/preferences/locale", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load locale preference.");
  const data: unknown = await response.json();
  if (!isPreference(data)) throw new Error("Invalid locale preference response.");
  storeLocale(data.locale);
  return data.locale;
}

export async function setLocalePreference(locale: Locale): Promise<Locale> {
  const response = await fetch("/api/preferences/locale", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) throw new Error("Could not save locale preference.");
  const data: unknown = await response.json();
  if (!isPreference(data)) throw new Error("Invalid locale preference response.");
  storeLocale(data.locale);
  return data.locale;
}

function isPreference(value: unknown): value is { locale: Locale } {
  return typeof value === "object" && value !== null && isLocale((value as { locale?: unknown }).locale);
}
