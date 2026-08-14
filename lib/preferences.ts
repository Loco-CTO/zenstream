import { isLocale, type Locale } from "@/lib/i18n";
import { authenticatedFetch } from "@/lib/authenticated-request";
import type { AuthSession } from "@/lib/session";

export type MetadataLanguagePreference = {
	mode: "auto" | "explicit";
	language: string;
};

export type PlaybackLanguageOption = { value: string; label: string };
export type PlaybackPreference = {
	audioLanguage: string | null;
	subtitleLanguage: string | null;
	audioLanguages: PlaybackLanguageOption[];
	subtitleLanguages: PlaybackLanguageOption[];
};

const PREFERENCE_TTL_MS = 30_000;
type CacheEntry = { expiresAt: number; value: unknown };
type InFlightEntry = { promise: Promise<unknown>; controller: AbortController };
const preferenceCache = new Map<AuthSession, Map<string, CacheEntry>>();
const preferenceInFlight = new Map<AuthSession, Map<string, InFlightEntry>>();

async function cachedPreference<T>(
	session: AuthSession,
	key: string,
	loader: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
	const cache = preferenceCache.get(session) ?? new Map<string, CacheEntry>();
	preferenceCache.set(session, cache);
	const cached = cache.get(key);
	if (cached && cached.expiresAt > Date.now()) return cached.value as T;
	const inFlight =
		preferenceInFlight.get(session) ?? new Map<string, InFlightEntry>();
	preferenceInFlight.set(session, inFlight);
	const pending = inFlight.get(key);
	if (pending) return pending.promise as Promise<T>;
	const controller = new AbortController();
	const request = loader(controller.signal).then((value) => {
		if (inFlight.get(key)?.controller === controller)
			cache.set(key, { expiresAt: Date.now() + PREFERENCE_TTL_MS, value });
		return value;
	});
	const tracked = request.finally(() => {
		if (inFlight.get(key)?.promise === tracked) inFlight.delete(key);
		if (inFlight.size === 0) preferenceInFlight.delete(session);
	});
	inFlight.set(key, { promise: tracked, controller });
	return tracked;
}

export function clearPreferenceCache(session?: AuthSession) {
	const targets = session
		? [session]
		: [...new Set([...preferenceCache.keys(), ...preferenceInFlight.keys()])];
	for (const target of targets) {
		preferenceCache.delete(target);
		const inFlight = preferenceInFlight.get(target);
		if (!inFlight) continue;
		for (const entry of inFlight.values()) entry.controller.abort();
		preferenceInFlight.delete(target);
	}
}

export async function getMetadataLanguages(
	session: AuthSession,
): Promise<string[]> {
	return cachedPreference(session, "metadata-languages", async (signal) => {
		const response = await authenticatedFetch(
			session,
			"/api/metadata/languages",
			{ cache: "no-store", signal },
		);
		if (!response.ok) throw new Error("Could not load metadata languages.");
		const data = (await response.json()) as { languages?: unknown };
		if (
			!Array.isArray(data.languages) ||
			!data.languages.every((value) => typeof value === "string")
		)
			throw new Error("Invalid metadata language response.");
		return data.languages;
	});
}

export async function getMetadataLanguagePreference(
	session: AuthSession,
): Promise<MetadataLanguagePreference> {
	return cachedPreference(session, "metadata-language", async (signal) => {
		const response = await authenticatedFetch(
			session,
			"/api/preferences/metadata-language",
			{ cache: "no-store", signal },
		);
		if (!response.ok)
			throw new Error("Could not load metadata language preference.");
		const data = (await response.json()) as Partial<MetadataLanguagePreference>;
		if (
			(data.mode !== "auto" && data.mode !== "explicit") ||
			typeof data.language !== "string"
		)
			throw new Error("Invalid metadata language preference response.");
		return data as MetadataLanguagePreference;
	});
}

export async function setMetadataLanguagePreference(
	session: AuthSession,
	language: string | null,
): Promise<MetadataLanguagePreference> {
	const response = await authenticatedFetch(
		session,
		"/api/preferences/metadata-language",
		{
			method: "PATCH",
			body: JSON.stringify({ language }),
		},
	);
	if (!response.ok)
		throw new Error("Could not save metadata language preference.");
	const data = (await response.json()) as Partial<MetadataLanguagePreference>;
	if (
		(data.mode !== "auto" && data.mode !== "explicit") ||
		typeof data.language !== "string"
	)
		throw new Error("Invalid metadata language preference response.");
	clearPreferenceCache(session);
	return data as MetadataLanguagePreference;
}

function isPlaybackLanguageOption(
	value: unknown,
): value is PlaybackLanguageOption {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { value?: unknown }).value === "string" &&
		typeof (value as { label?: unknown }).label === "string"
	);
}

function isPlaybackPreference(value: unknown): value is PlaybackPreference {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<PlaybackPreference>;
	return (
		(candidate.audioLanguage === null ||
			typeof candidate.audioLanguage === "string") &&
		(candidate.subtitleLanguage === null ||
			typeof candidate.subtitleLanguage === "string") &&
		Array.isArray(candidate.audioLanguages) &&
		candidate.audioLanguages.every(isPlaybackLanguageOption) &&
		Array.isArray(candidate.subtitleLanguages) &&
		candidate.subtitleLanguages.every(isPlaybackLanguageOption)
	);
}

export async function getPlaybackPreference(
	session: AuthSession,
): Promise<PlaybackPreference> {
	return cachedPreference(session, "playback", async (signal) => {
		const response = await authenticatedFetch(
			session,
			"/api/preferences/playback",
			{
				cache: "no-store",
				signal,
			},
		);
		if (!response.ok) throw new Error("Could not load playback preferences.");
		const value: unknown = await response.json();
		if (!isPlaybackPreference(value))
			throw new Error("Invalid playback preference response.");
		return value;
	});
}

export async function setPlaybackPreference(
	session: AuthSession,
	value: Pick<PlaybackPreference, "audioLanguage" | "subtitleLanguage">,
): Promise<PlaybackPreference> {
	const response = await authenticatedFetch(
		session,
		"/api/preferences/playback",
		{
			method: "PATCH",
			body: JSON.stringify(value),
		},
	);
	if (!response.ok) throw new Error("Could not save playback preferences.");
	const next: unknown = await response.json();
	if (!isPlaybackPreference(next))
		throw new Error("Invalid playback preference response.");
	clearPreferenceCache(session);
	return next;
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

export async function getLocalePreference(
	session: AuthSession,
): Promise<Locale> {
	return cachedPreference(session, "locale", async (signal) => {
		const response = await authenticatedFetch(
			session,
			"/api/preferences/locale",
			{ cache: "no-store", signal },
		);
		if (!response.ok) throw new Error("Could not load locale preference.");
		const data: unknown = await response.json();
		if (!isPreference(data))
			throw new Error("Invalid locale preference response.");
		storeLocale(data.locale);
		return data.locale;
	});
}

export async function setLocalePreference(
	session: AuthSession,
	locale: Locale,
): Promise<Locale> {
	const response = await authenticatedFetch(session, "/api/preferences/locale", {
		method: "PATCH",
		body: JSON.stringify({ locale }),
	});
	if (!response.ok) throw new Error("Could not save locale preference.");
	const data: unknown = await response.json();
	if (!isPreference(data))
		throw new Error("Invalid locale preference response.");
	clearPreferenceCache(session);
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
