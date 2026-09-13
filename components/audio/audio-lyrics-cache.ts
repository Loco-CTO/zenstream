import {
	getAudioLyrics,
	type AudioLyrics,
} from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const MAX_ENTRIES = 48;
const values = new Map<string, AudioLyrics | null>();
const inFlight = new Map<string, Promise<AudioLyrics | null>>();

function cacheKey(session: AuthSession, itemId: string) {
	return `${session.userId}:${itemId}`;
}

function remember(key: string, value: AudioLyrics | null) {
	values.delete(key);
	values.set(key, value);
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
	if (values.has(key)) return Promise.resolve(values.get(key) ?? null);
	const existing = inFlight.get(key);
	if (existing) return existing;
	const request = getAudioLyrics(session, itemId)
		.then((lyrics) => {
			remember(key, lyrics);
			return lyrics;
		})
		.finally(() => {
			if (inFlight.get(key) === request) inFlight.delete(key);
		});
	inFlight.set(key, request);
	return request;
}

export function prefetchAudioLyrics(session: AuthSession, itemId: string) {
	void loadAudioLyrics(session, itemId).catch(() => undefined);
}

export function clearAudioLyricsCache() {
	values.clear();
	inFlight.clear();
}
