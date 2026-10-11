import type { AuthSession } from "@/lib/session";

export const AUTH_FLOW_HEADER = "X-ZenStream-Auth-Flow";
export const AUTH_FLOW_VERSION = "refresh-v1";
export const AUTH_REFRESH_RESULT_HEADER = "X-ZenStream-Auth-Refresh";

type RefreshResult = "refreshed" | "unauthorized" | "unavailable";

let browserRefreshInFlight: Promise<RefreshResult> | null = null;
let memoryRefreshAttemptId: string | null = null;

const REFRESH_ATTEMPT_ID_KEY = "zenstream.auth-refresh-attempt-id";
const REFRESH_ATTEMPT_DATABASE_NAME = "zenstream-auth-refresh-attempts";
const REFRESH_ATTEMPT_OBJECT_STORE = "attempts";
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let refreshAttemptDatabase: Promise<IDBDatabase> | null = null;

export function orchestratorBaseUrl() {
	if (typeof window !== "undefined") {
		const runtimeUrl = window.__ZENSTREAM_RUNTIME_CONFIG__?.orchestratorUrl;
		if (runtimeUrl) return runtimeUrl.replace(/\/+$/, "");
	}
	if (process.env.ZENSTREAM_ORCHESTRATOR_URL)
		return process.env.ZENSTREAM_ORCHESTRATOR_URL.replace(/\/+$/, "");
	if (process.env.NEXT_PUBLIC_ZSO_URL)
		return process.env.NEXT_PUBLIC_ZSO_URL.replace(/\/+$/, "");
	return "http://127.0.0.1:9090";
}

function createRefreshAttemptId() {
	const browserCrypto = globalThis.crypto;
	if (typeof browserCrypto?.randomUUID === "function")
		return browserCrypto.randomUUID();

	const bytes = new Uint8Array(16);
	if (typeof browserCrypto?.getRandomValues === "function") {
		browserCrypto.getRandomValues(bytes);
	} else {
		for (let index = 0; index < bytes.length; index += 1)
			bytes[index] = Math.floor(Math.random() * 256);
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function refreshAttemptStorageKey() {
	return `${REFRESH_ATTEMPT_ID_KEY}:${new URL(orchestratorBaseUrl()).origin}`;
}

function openRefreshAttemptDatabase() {
	if (typeof window === "undefined" || !window.indexedDB)
		return Promise.reject(new Error("IndexedDB is unavailable."));

	if (!refreshAttemptDatabase) {
		const opening = new Promise<IDBDatabase>((resolve, reject) => {
			const request = window.indexedDB.open(REFRESH_ATTEMPT_DATABASE_NAME, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(REFRESH_ATTEMPT_OBJECT_STORE))
					request.result.createObjectStore(REFRESH_ATTEMPT_OBJECT_STORE);
			};
			request.onsuccess = () => {
				const database = request.result;
				database.onversionchange = () => {
					database.close();
					if (refreshAttemptDatabase === opening) refreshAttemptDatabase = null;
				};
				resolve(database);
			};
			request.onerror = () =>
				reject(request.error ?? new Error("Could not open refresh storage."));
		});
		refreshAttemptDatabase = opening;
		void opening.catch(() => {
			if (refreshAttemptDatabase === opening) refreshAttemptDatabase = null;
		});
	}

	return refreshAttemptDatabase;
}

// A readwrite transaction on this shared store serializes first-use creation across tabs.
async function readOrCreateRefreshAttemptIdFromIndexedDB() {
	const database = await openRefreshAttemptDatabase();
	const key = refreshAttemptStorageKey();
	return await new Promise<string>((resolve, reject) => {
		const transaction = database.transaction(
			REFRESH_ATTEMPT_OBJECT_STORE,
			"readwrite",
		);
		const store = transaction.objectStore(REFRESH_ATTEMPT_OBJECT_STORE);
		const request = store.get(key);
		let attemptId: string | null = null;

		request.onsuccess = () => {
			const stored = request.result;
			if (typeof stored === "string" && UUID_PATTERN.test(stored)) {
				attemptId = stored.toLowerCase();
				return;
			}

			let legacyStored: string | null = null;
			try {
				legacyStored = window.localStorage.getItem(key);
			} catch {
				// IndexedDB remains usable when localStorage is disabled.
			}
			attemptId =
				legacyStored && UUID_PATTERN.test(legacyStored)
					? legacyStored.toLowerCase()
					: createRefreshAttemptId();
			store.put(attemptId, key);
		};
		transaction.oncomplete = () => {
			if (attemptId) resolve(attemptId);
			else reject(new Error("Refresh attempt ID was not stored."));
		};
		transaction.onerror = () =>
			reject(transaction.error ?? new Error("Could not read refresh storage."));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error("Refresh storage was aborted."));
	});
}

export async function getRefreshAttemptId() {
	if (typeof window === "undefined")
		return (memoryRefreshAttemptId ??= createRefreshAttemptId());

	try {
		if (window.indexedDB) {
			const stored = await readOrCreateRefreshAttemptIdFromIndexedDB();
			memoryRefreshAttemptId = stored;
			try {
				window.localStorage.setItem(refreshAttemptStorageKey(), stored);
			} catch {
				// IndexedDB is the cross-tab source of truth.
			}
			return stored;
		}
	} catch {
		// Fall back to Web Locks and localStorage when IndexedDB is unavailable.
	}

	const readOrCreate = () => {
		try {
			const key = refreshAttemptStorageKey();
			const stored = window.localStorage.getItem(key);
			if (stored && UUID_PATTERN.test(stored)) {
				memoryRefreshAttemptId = stored.toLowerCase();
				return memoryRefreshAttemptId;
			}

			const generated = createRefreshAttemptId();
			window.localStorage.setItem(key, generated);
			const shared = window.localStorage.getItem(key);
			memoryRefreshAttemptId =
				shared && UUID_PATTERN.test(shared) ? shared.toLowerCase() : generated;
			return memoryRefreshAttemptId;
		} catch {
			// Keep refresh available when browser storage is disabled.
			return (memoryRefreshAttemptId ??= createRefreshAttemptId());
		}
	};

	const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
	if (!locks) return readOrCreate();

	// localStorage has no atomic read/create operation. A separate lock protects
	// first-use ID creation without re-entering the refresh lock held by callers.
	const lockName = `zenstream:auth-refresh-attempt-id:${new URL(orchestratorBaseUrl()).origin}`;
	try {
		return await locks.request(lockName, readOrCreate);
	} catch {
		return readOrCreate();
	}
}

async function advanceRefreshAttemptId(attemptId: string) {
	const nextId = createRefreshAttemptId();
	if (typeof window === "undefined") {
		if (memoryRefreshAttemptId === attemptId) memoryRefreshAttemptId = nextId;
		return;
	}

	try {
		const key = refreshAttemptStorageKey();
		const database = await openRefreshAttemptDatabase();
		const advanced = await new Promise<boolean>((resolve, reject) => {
			const transaction = database.transaction(
				REFRESH_ATTEMPT_OBJECT_STORE,
				"readwrite",
			);
			const store = transaction.objectStore(REFRESH_ATTEMPT_OBJECT_STORE);
			const request = store.get(key);
			let didAdvance = false;

			request.onsuccess = () => {
				if (
					typeof request.result === "string" &&
					request.result.toLowerCase() === attemptId
				) {
					store.put(nextId, key);
					didAdvance = true;
				}
			};
			transaction.oncomplete = () => resolve(didAdvance);
			transaction.onerror = () =>
				reject(transaction.error ?? new Error("Could not update refresh storage."));
			transaction.onabort = () =>
				reject(transaction.error ?? new Error("Refresh storage was aborted."));
		});
		if (advanced) {
			memoryRefreshAttemptId = nextId;
			try {
				window.localStorage.setItem(key, nextId);
			} catch {
				// IndexedDB is the cross-tab source of truth.
			}
		}
		return;
	} catch {
		// Fall back to localStorage if IndexedDB is unavailable.
	}

	try {
		const key = refreshAttemptStorageKey();
		if (window.localStorage.getItem(key)?.toLowerCase() === attemptId) {
			window.localStorage.setItem(key, nextId);
			memoryRefreshAttemptId = nextId;
		}
	} catch {
		if (memoryRefreshAttemptId === attemptId) memoryRefreshAttemptId = nextId;
	}
}

export type AuthExpiredDetail = { session: AuthSession };

export function dispatchAuthExpired(session: AuthSession) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<AuthExpiredDetail>("zenstream:auth-expired", {
			detail: { session },
		}),
	);
}

function isAuthBootstrapPath(path: string) {
	return /^\/api\/auth\/(login|browser-login|refresh)$/.test(path);
}

async function refreshBrowserSession(): Promise<RefreshResult> {
	const refreshAttemptId = await getRefreshAttemptId();
	try {
		const response = await fetch(`${orchestratorBaseUrl()}/api/auth/refresh`, {
			method: "POST",
			credentials: "include",
			cache: "no-store",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				[AUTH_FLOW_HEADER]: AUTH_FLOW_VERSION,
			},
			body: JSON.stringify({ refreshAttemptId }),
		});
		if (response.ok) {
			await advanceRefreshAttemptId(refreshAttemptId);
			return "refreshed";
		}
		if (response.status === 401 || response.status === 403) return "unauthorized";
		return "unavailable";
	} catch {
		return "unavailable";
	}
}

function refreshBrowserSessionOnce() {
	if (!browserRefreshInFlight) {
		const pending = refreshBrowserSession();
		const tracked = pending.finally(() => {
			if (browserRefreshInFlight === tracked) browserRefreshInFlight = null;
		});
		browserRefreshInFlight = tracked;
	}
	return browserRefreshInFlight;
}

async function refreshAfterUnauthorizedResponse(
	response: Response,
	session: AuthSession,
	path: string,
	init: RequestInit,
	options: { notifyOnUnauthorized?: boolean },
) {
	const refreshResult = await refreshBrowserSessionOnce();
	if (refreshResult === "refreshed")
		return sendAuthenticatedRequest(session, path, init);
	if (refreshResult === "unauthorized" && options.notifyOnUnauthorized !== false)
		dispatchAuthExpired(session);
	if (refreshResult === "unavailable") return markRefreshUnavailable(response);
	return response;
}

function markRefreshUnavailable(response: Response) {
	const headers = new Headers(response.headers);
	headers.set(AUTH_REFRESH_RESULT_HEADER, "unavailable");
	return new Response(response.clone().body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function requestHeaders(session: AuthSession, init: RequestInit) {
	return {
		Accept: "application/json",
		[AUTH_FLOW_HEADER]: AUTH_FLOW_VERSION,
		...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
		...(init.body ? { "Content-Type": "application/json" } : {}),
		...init.headers,
	};
}

function sendAuthenticatedRequest(
	session: AuthSession,
	path: string,
	init: RequestInit,
) {
	return fetch(`${orchestratorBaseUrl()}${path}`, {
		...init,
		credentials: "include",
		headers: requestHeaders(session, init),
	});
}

export async function authenticatedFetch(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
	options: { notifyOnUnauthorized?: boolean } = {},
) {
	const response = await sendAuthenticatedRequest(session, path, init);
	if (response.status !== 401 || isAuthBootstrapPath(path)) return response;
	const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
	if (!locks) {
		return refreshAfterUnauthorizedResponse(
			response,
			session,
			path,
			init,
			options,
		);
	}
	const lockName = `zenstream:auth-refresh:${new URL(orchestratorBaseUrl()).origin}`;
	return locks.request(lockName, async () => {
		// The HttpOnly cookie is shared by same-origin tabs. Another tab may have
		// rotated it while this request waited for the lock, so retry before rotating again.
		const retried = await sendAuthenticatedRequest(session, path, init);
		if (retried.status !== 401) return retried;
		return refreshAfterUnauthorizedResponse(
			retried,
			session,
			path,
			init,
			options,
		);
	});
}

export async function authenticatedJson<T>(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
	options: { notifyOnUnauthorized?: boolean } = {},
): Promise<T> {
	const response = await authenticatedFetch(session, path, init, options);
	if (!response.ok) throw new Error(`Request failed with ${response.status}.`);
	if (response.status === 204) return null as T;
	return (await response.json()) as T;
}
