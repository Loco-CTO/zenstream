const LAST_NON_PLAYER_PATH_KEY = "zenstream:last-non-player-path";

export function isPlayerPath(pathname: string) {
	return /^\/play(?:\/|$)/.test(pathname);
}

export function rememberLastNonPlayerPath(pathname: string) {
	if (
		typeof window === "undefined" ||
		isPlayerPath(pathname) ||
		!pathname.startsWith("/")
	) {
		return;
	}

	try {
		window.sessionStorage.setItem(LAST_NON_PLAYER_PATH_KEY, pathname);
	} catch {
		// Session storage may be unavailable in privacy-restricted browsers.
	}
}

export function getLastNonPlayerPath() {
	if (typeof window === "undefined") return "/";

	try {
		const pathname = window.sessionStorage.getItem(LAST_NON_PLAYER_PATH_KEY);
		return pathname && pathname.startsWith("/") && !isPlayerPath(pathname)
			? pathname
			: "/";
	} catch {
		return "/";
	}
}
