import { isLocale, type Locale } from "@/lib/i18n";
import { getAuthSession } from "@/lib/session";

function preferencesUrl(path: string) {
	return `${(process.env.NEXT_PUBLIC_ZSO_URL ?? "").replace(/\/+$/, "")}/api/preferences/${path}`;
}
function preferenceHeaders(): Record<string, string> {
	const token = getAuthSession()?.token;
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export type MetadataLanguagePreference = {
	mode: "auto" | "explicit";
	language: string;
};

const PREFERENCE_TTL_MS = 30_000;
const preferenceCache = new Map<string, { expiresAt: number; value: unknown }>();
const preferenceInFlight = new Map<string, Promise<unknown>>();

async function cachedPreference<T>(key: string, loader: () => Promise<T>): Promise<T> {
	const cached = preferenceCache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.value as T;
	const pending = preferenceInFlight.get(key);
	if (pending) return pending as Promise<T>;
	const request = loader().then((value) => {
		preferenceCache.set(key, { expiresAt: Date.now() + PREFERENCE_TTL_MS, value });
		return value;
	}).finally(() => preferenceInFlight.delete(key));
	preferenceInFlight.set(key, request);
	return request;
}

export function clearPreferenceCache() {
	preferenceCache.clear();
}

export async function getMetadataLanguages(): Promise<string[]> {
	return cachedPreference("metadata-languages", async () => {
	const base = (process.env.NEXT_PUBLIC_ZSO_URL ?? "").replace(/\/+$/, "");
	const response = await fetch(`${base}/api/metadata/languages`, {
		cache: "no-store",
		headers: preferenceHeaders(),
	});
	if (!response.ok) throw new Error("Could not load metadata languages.");
	const data = (await response.json()) as { languages?: unknown };
	if (!Array.isArray(data.languages) || !data.languages.every((value) => typeof value === "string"))
		throw new Error("Invalid metadata language response.");
	return data.languages;
	});
}

export async function getMetadataLanguagePreference(): Promise<MetadataLanguagePreference> {
	return cachedPreference("metadata-language", async () => {
	const response = await fetch(preferencesUrl("metadata-language"), { cache: "no-store", headers: preferenceHeaders() });
	if (!response.ok) throw new Error("Could not load metadata language preference.");
	const data = (await response.json()) as Partial<MetadataLanguagePreference>;
	if ((data.mode !== "auto" && data.mode !== "explicit") || typeof data.language !== "string")
		throw new Error("Invalid metadata language preference response.");
	return data as MetadataLanguagePreference;
	});
}

export async function setMetadataLanguagePreference(language: string | null): Promise<MetadataLanguagePreference> {
	const response = await fetch(preferencesUrl("metadata-language"), {
		method: "PATCH",
		headers: { ...preferenceHeaders(), "Content-Type": "application/json" },
		body: JSON.stringify({ language }),
	});
	if (!response.ok) throw new Error("Could not save metadata language preference.");
	const data = (await response.json()) as Partial<MetadataLanguagePreference>;
	if ((data.mode !== "auto" && data.mode !== "explicit") || typeof data.language !== "string")
		throw new Error("Invalid metadata language preference response.");
	clearPreferenceCache();
	return data as MetadataLanguagePreference;
}

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
	return cachedPreference("locale", async () => {
	const response = await fetch(preferencesUrl("locale"), {
		cache: "no-store",
		headers: preferenceHeaders(),
	});
	if (!response.ok) throw new Error("Could not load locale preference.");
	const data: unknown = await response.json();
	if (!isPreference(data))
		throw new Error("Invalid locale preference response.");
	storeLocale(data.locale);
	return data.locale;
	});
}

export async function setLocalePreference(locale: Locale): Promise<Locale> {
	const response = await fetch(preferencesUrl("locale"), {
		method: "PATCH",
		headers: { ...preferenceHeaders(), "Content-Type": "application/json" },
		body: JSON.stringify({ locale }),
	});
	if (!response.ok) throw new Error("Could not save locale preference.");
	const data: unknown = await response.json();
	if (!isPreference(data))
		throw new Error("Invalid locale preference response.");
	clearPreferenceCache();
	storeLocale(data.locale);
	return data.locale;
}

function isPreference(value: unknown): value is { locale: Locale } {
	return (
		typeof value === "object" &&
		value !== null &&
		isLocale((value as { locale?: unknown }).locale)
	);
}
