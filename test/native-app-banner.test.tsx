import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NativeAppBanner } from "@/components/native-app-banner";
import {
	NATIVE_APP_BANNER_COOLDOWN_MS,
	NATIVE_APP_BANNER_DISMISSAL_KEY,
	buildNativeAppOpenUrl,
	shouldShowNativeAppBanner,
} from "@/lib/native-app-promotion";

const navigation = vi.hoisted(() => ({
	pathname: "/album/album-1",
	query: "trackId=track-1",
}));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useSearchParams: () => new URLSearchParams(navigation.query),
}));

function setUserAgent(userAgent: string) {
	Object.defineProperty(window.navigator, "userAgent", {
		configurable: true,
		value: userAgent,
	});
}

describe("native app promotion", () => {
	beforeEach(() => {
		localStorage.clear();
		navigation.pathname = "/album/album-1";
		navigation.query = "trackId=track-1";
		setUserAgent(
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
		);
		vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		}));
		vi.stubEnv("NEXT_PUBLIC_ZSO_URL", "https://server.example");
	});

	it("shows the banner on Android and builds a package-pinned intent URL", async () => {
		render(<NativeAppBanner />);

		const banner = await screen.findByTestId("native-app-banner");
		expect(banner).toBeInTheDocument();
		const open = screen.getByRole("link", { name: /open in app/i });
		expect(open.getAttribute("href")).toContain("intent://open?");
		expect(open.getAttribute("href")).toContain(
			"package=com.zenstream.zenstreammobile",
		);
		expect(open.getAttribute("href")).toContain(
			"server=https%3A%2F%2Fserver.example",
		);
		expect(open.getAttribute("href")).toContain(
			"target=%2Falbum%2Falbum-1%3FtrackId%3Dtrack-1",
		);
	});

	it("stores a seven-day dismissal timestamp and reappears after the cooldown", async () => {
		render(<NativeAppBanner />);
		await screen.findByTestId("native-app-banner");

		fireEvent.click(screen.getByRole("button", { name: /dismiss android/i }));
		const dismissedAt = localStorage.getItem(NATIVE_APP_BANNER_DISMISSAL_KEY);
		expect(dismissedAt).toMatch(/^\d+$/);
		expect(shouldShowNativeAppBanner(Number(dismissedAt), dismissedAt)).toBe(
			false,
		);
		expect(
			shouldShowNativeAppBanner(
				Number(dismissedAt) + NATIVE_APP_BANNER_COOLDOWN_MS,
				dismissedAt,
			),
		).toBe(true);
	});

	it("does not render on desktop or in standalone display mode", async () => {
		setUserAgent(
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
		);
		const { unmount } = render(<NativeAppBanner />);
		await waitFor(() =>
			expect(screen.queryByTestId("native-app-banner")).not.toBeInTheDocument(),
		);

		unmount();
		setUserAgent(
			"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36",
		);
		vi.spyOn(window, "matchMedia").mockImplementation(() => ({
			matches: true,
			media: "(display-mode: standalone)",
			onchange: null,
			addListener: () => undefined,
			removeListener: () => undefined,
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
			dispatchEvent: () => false,
		}));
		render(<NativeAppBanner />);
		await waitFor(() =>
			expect(screen.queryByTestId("native-app-banner")).not.toBeInTheDocument(),
		);
	});

	it("uses the custom scheme for non-Chromium Android browsers", () => {
		const url = buildNativeAppOpenUrl(
			"https://server.example",
			"/favorites",
			"Mozilla/5.0 (Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0",
		);
		expect(url).toBe(
			"zenstream://open?server=https%3A%2F%2Fserver.example&target=%2Ffavorites",
		);
	});
});
