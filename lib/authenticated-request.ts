import type { AuthSession } from "@/lib/session";

export function orchestratorBaseUrl() {
	if (process.env.NEXT_PUBLIC_ZSO_URL)
		return process.env.NEXT_PUBLIC_ZSO_URL.replace(/\/+$/, "");
	if (typeof window !== "undefined") return window.location.origin;
	return "http://127.0.0.1:9090";
}

export type AuthExpiredDetail = { session: AuthSession };

export function authSessionMatches(
	left: AuthSession | null | undefined,
	right: AuthSession,
) {
	return Boolean(
		left &&
		left.userId === right.userId &&
		(left.token || "") === (right.token || ""),
	);
}

export function dispatchAuthExpired(session: AuthSession) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<AuthExpiredDetail>("zenstream:auth-expired", {
			detail: { session },
		}),
	);
}

export async function authenticatedFetch(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
	options: { notifyOnUnauthorized?: boolean } = {},
) {
	const response = await fetch(`${orchestratorBaseUrl()}${path}`, {
		...init,
		credentials: "include",
		headers: {
			Accept: "application/json",
			...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...init.headers,
		},
	});
	if (response.status === 401 && options.notifyOnUnauthorized !== false)
		dispatchAuthExpired(session);
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
