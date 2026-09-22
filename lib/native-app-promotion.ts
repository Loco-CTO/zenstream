export const NATIVE_APP_PACKAGE_NAME = "com.zenstream.zenstreammobile";
export const NATIVE_APP_RELEASE_URL =
	"https://github.com/Loco-CTO/zenstream-mobile/releases/latest";
export const NATIVE_APP_BANNER_DISMISSAL_KEY =
	"zenstream:native-app-banner:dismissed-at";
export const NATIVE_APP_BANNER_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export function isAndroidMobileUserAgent(userAgent: string) {
	const normalized = userAgent.toLowerCase();
	return (
		normalized.includes("android") &&
		!normalized.includes("android tv") &&
		!normalized.includes("googletv")
	);
}

export function isChromiumIntentBrowser(userAgent: string) {
	return /\b(?:chrome|chromium|edga|opr)\//i.test(userAgent);
}

export function isStandaloneDisplayMode() {
	if (typeof window === "undefined") return false;
	const navigatorWithStandalone = navigator as Navigator & {
		standalone?: boolean;
	};
	return (
		window.matchMedia?.("(display-mode: standalone)").matches === true ||
		navigatorWithStandalone.standalone === true
	);
}

export function shouldShowNativeAppBanner(
	now = Date.now(),
	dismissedAt: string | null = null,
) {
	if (!dismissedAt) return true;
	const timestamp = Number(dismissedAt);
	if (!Number.isFinite(timestamp) || timestamp < 0) return true;
	return now - timestamp >= NATIVE_APP_BANNER_COOLDOWN_MS;
}

export function buildNativeAppTarget(pathname: string, serializedSearch = "") {
	const path = pathname || "/";
	return serializedSearch ? `${path}?${serializedSearch}` : path;
}

export function buildNativeAppOpenUrl(
	serverUrl: string,
	target: string,
	userAgent: string,
) {
	const params = new URLSearchParams({ server: serverUrl, target });
	if (isChromiumIntentBrowser(userAgent)) {
		return `intent://open?${params.toString()}#Intent;scheme=zenstream;package=${NATIVE_APP_PACKAGE_NAME};S.browser_fallback_url=${encodeURIComponent(NATIVE_APP_RELEASE_URL)};end`;
	}
	return `zenstream://open?${params.toString()}`;
}
