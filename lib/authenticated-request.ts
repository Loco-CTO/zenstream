import type { AuthSession } from "@/lib/session";

export const AUTH_FLOW_HEADER = "X-ZenStream-Auth-Flow";
export const AUTH_FLOW_VERSION = "refresh-v1";
export const AUTH_REFRESH_RESULT_HEADER = "X-ZenStream-Auth-Refresh";

type RefreshResult = "refreshed" | "unauthorized" | "unavailable";

let browserRefreshInFlight: Promise<RefreshResult> | null = null;

export function orchestratorBaseUrl() {
	if (process.env.NEXT_PUBLIC_ZSO_URL)
		return process.env.NEXT_PUBLIC_ZSO_URL.replace(/\/+$/, "");
	if (typeof window !== "undefined") return window.location.origin;
	return "http://127.0.0.1:9090";
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
	try {
		const response = await fetch(
			`${orchestratorBaseUrl()}/api/auth/refresh`,
			{
				method: "POST",
				credentials: "include",
				cache: "no-store",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					[AUTH_FLOW_HEADER]: AUTH_FLOW_VERSION,
				},
				body: "{}",
			},
		);
		if (response.ok) return "refreshed";
		if (response.status === 401 || response.status === 403)
			return "unauthorized";
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

	const refreshResult = await refreshBrowserSessionOnce();
	if (refreshResult === "refreshed")
		return sendAuthenticatedRequest(session, path, init);
	if (
		refreshResult === "unauthorized" &&
		options.notifyOnUnauthorized !== false
	)
		dispatchAuthExpired(session);
	if (refreshResult === "unavailable") return markRefreshUnavailable(response);
	return response;
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
