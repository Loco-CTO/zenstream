export interface AuthSession {
	token: string;
	userId: string;
	username: string;
}

const COOKIE_TOKEN = "token";
const COOKIE_USER_ID = "userId";
const COOKIE_USERNAME = "username";

export function getAuthSession(): AuthSession | null {
	const token = readCookie(COOKIE_TOKEN);
	const userId = readCookie(COOKIE_USER_ID);
	const username = readCookie(COOKIE_USERNAME);

	if (!token || !userId) {
		return null;
	}

	return {
		token,
		userId,
		username: username || "ZenStream",
	};
}

export function setAuthCookies(session: AuthSession) {
	writeCookie(COOKIE_TOKEN, session.token);
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
