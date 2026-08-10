export interface AuthSession {
	token: string;
	userId: string;
	username: string;
}

const COOKIE_TOKEN = "token";
const COOKIE_USER_ID = "userId";
const COOKIE_USERNAME = "username";

export function getAuthSession(): AuthSession | null {
	// Legacy token cookies are intentionally ignored; browser auth now uses the
	// Orchestrator's HttpOnly session cookie.
	const token = null;
	const userId = readCookie(COOKIE_USER_ID);
	const username = readCookie(COOKIE_USERNAME);

	if (!userId) {
		return null;
	}

	return {
		token: token ?? "",
		userId,
		username: username || "ZenStream",
	};
}

export function setAuthCookies(session: AuthSession) {
	// The browser bearer is issued by the Orchestrator as an HttpOnly cookie.
	// Keep only non-sensitive identity metadata client-readable for hydration.
	deleteCookie(COOKIE_TOKEN);
	writeCookie(COOKIE_USER_ID, session.userId);
	writeCookie(COOKIE_USERNAME, session.username);
}

export function clearAuthCookies() {
	deleteCookie(COOKIE_TOKEN);
	deleteCookie(COOKIE_USER_ID);
	deleteCookie(COOKIE_USERNAME);
}

function readCookie(name: string) {
	if (typeof document === "undefined") return null;

	const prefix = `${name}=`;
	const cookie = document.cookie
		.split(";")
		.map((part) => part.trim())
		.find((part) => part.startsWith(prefix));

	return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function writeCookie(name: string, value: string) {
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=2592000; samesite=lax`;
}

function deleteCookie(name: string) {
	document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax`;
}
