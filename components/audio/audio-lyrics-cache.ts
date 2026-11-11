import { getAudioLyrics, type AudioLyrics } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const MAX_ENTRIES = 48;
const MISS_TTL_MS = 60_000;
const values = new Map<
	string,
	{ lyrics: AudioLyrics | null; expiresAt: number }
>();
const inFlight = new Map<string, Promise<AudioLyrics | null>>();

function cacheKey(session: AuthSession, itemId: string) {
	return `${session.userId}:${itemId}`;
}

function remember(key: string, value: AudioLyrics | null) {
	values.delete(key);
	values.set(key, {
		lyrics: value,
		expiresAt: value ? Infinity : Date.now() + MISS_TTL_MS,
	});
	while (values.size > MAX_ENTRIES) {
		const oldest = values.keys().next().value;
		if (oldest === undefined) break;
		values.delete(oldest);
	}
}

export function loadAudioLyrics(
	session: AuthSession,
	itemId: string,
): Promise<AudioLyrics | null> {
	const key = cacheKey(session, itemId);
	const cached = values.get(key);
	if (cached && cached.expiresAt > Date.now())
		return Promise.resolve(cached.lyrics);
	const existing = inFlight.get(key);
	if (existing) return existing;
	const request = getAudioLyrics(session, itemId)
		.then((lyrics) => {
			if (inFlight.get(key) === request) remember(key, lyrics);
			return lyrics;
		})
		.finally(() => {
			if (inFlight.get(key) === request) inFlight.delete(key);
		});
	inFlight.set(key, request);
	return request;
}

export function clearAudioLyricsCache() {
	values.clear();
	inFlight.clear();
}
