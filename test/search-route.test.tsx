import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { DEFAULT_SUBTITLE_STYLE } from "@/lib/subtitle-preferences";
import * as mediaApi from "@/lib/media-api";
import * as preferences from "@/lib/preferences";
import * as sessionApi from "@/lib/session";
import * as subtitlePreferences from "@/lib/subtitle-preferences";

const navigation = vi.hoisted(() => ({
	pathname: "/search",
	searchParams: new URLSearchParams("q=first"),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useSearchParams: () => navigation.searchParams,
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/components/layout/mobile-nav", () => ({
	MobileNav: () => null,
}));

vi.mock("@/components/layout/navbar", () => ({
	Navbar: () => null,
}));

vi.mock("@/components/pages/search-page", () => ({
	SearchPage: ({ query }: { query: string }) => (
		<div data-testid="search-query">{query}</div>
	),
}));

vi.mock("@/lib/syncplay", () => ({
	SyncplayProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/syncplay/playback-follower", () => ({
	SyncplayPlaybackFollower: () => null,
}));

const auth = { token: "", userId: "user", username: "Alex" };

describe("search route", () => {
	beforeEach(() => {
		navigation.pathname = "/search";
		navigation.searchParams = new URLSearchParams("q=first");
		vi.restoreAllMocks();
		vi.spyOn(sessionApi, "getAuthSession").mockReturnValue(auth);
		vi.spyOn(mediaApi, "validateBrowserSession").mockResolvedValue(auth);
		vi.spyOn(preferences, "getStoredLocale").mockReturnValue("en");
		vi.spyOn(preferences, "getLocalePreference").mockResolvedValue("en");
		vi.spyOn(preferences, "getMetadataLanguages").mockResolvedValue(["en"]);
		vi.spyOn(preferences, "getMetadataLanguagePreference").mockResolvedValue({
			mode: "auto",
			language: "en",
		});
		vi.spyOn(preferences, "getPlaybackPreference").mockResolvedValue({
			audioLanguage: null,
			subtitleLanguage: null,
			audioLanguages: [],
			subtitleLanguages: [],
		});
		vi.spyOn(preferences, "getWatchHistoryPreference").mockResolvedValue({
			enabled: true,
		});
		vi.spyOn(sessionApi, "setAuthCookies").mockImplementation(() => undefined);
		vi.spyOn(mediaApi, "primeResourceTicket").mockResolvedValue(null);
		vi
			.spyOn(subtitlePreferences, "getSubtitlePreference")
			.mockResolvedValue(DEFAULT_SUBTITLE_STYLE);
	});

	it("updates the mounted results page when only the q parameter changes", async () => {
		const view = render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() =>
			expect(screen.getByTestId("search-query")).toHaveTextContent("first"),
		);

		navigation.searchParams = new URLSearchParams("q=second");
		view.rerender(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		await waitFor(() =>
			expect(screen.getByTestId("search-query")).toHaveTextContent("second"),
		);
	});
});
