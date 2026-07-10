"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { sessionFromAuth } from "@/lib/auth";
import {
	authenticateByName,
	fetchDetailData,
	fetchHomeData,
	type DetailData,
	type HomeData,
} from "@/lib/jellyfin";
import {
	clearAuthCookies,
	getAuthSession,
	setAuthCookies,
	type AuthSession,
} from "@/lib/session";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Navbar } from "@/components/layout/navbar";
import { HomePage } from "@/components/pages/home-page";
import { LoginPage } from "@/components/pages/login-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { DetailPage } from "@/components/pages/detail-page";
import { LibraryPage } from "@/components/pages/library-page";
import { FavoritesPage } from "@/components/pages/favorites-page";
import { SearchPage } from "@/components/pages/search-page";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { I18nProvider, type Locale } from "@/lib/i18n";
import {
	getLocalePreference,
	getStoredLocale,
	setLocalePreference,
	storeLocale,
} from "@/lib/preferences";
import {
	DEFAULT_SUBTITLE_STYLE,
	getSubtitlePreference,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { SyncplayProvider } from "@/lib/syncplay";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";

type AppStatus = "checking" | "login" | "loading" | "ready" | "error";

export function AppShell() {
	const pathname = usePathname() ?? "/";
	const { start } = useProgress();
	const [session, setSession] = useState<AuthSession | null>(null);
	const [homeData, setHomeData] = useState<HomeData | null>(null);
	const [searchData, setSearchData] = useState<string | null>(null);

	const [detailData, setDetailData] = useState<DetailData | null>(null);
	const [status, setStatus] = useState<AppStatus>("checking");
	const [error, setError] = useState<string | null>(null);
	const [locale, setLocale] = useState<Locale>("en");
	const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
		DEFAULT_SUBTITLE_STYLE,
	);
	const loadPreferences = useCallback(() => {
		void getLocalePreference()
			.then((remoteLocale) => {
				storeLocale(remoteLocale);
				setLocale(remoteLocale);
			})
			.catch(() => undefined);
		void getSubtitlePreference()
			.then(setSubtitleStyle)
			.catch(() => undefined);
	}, []);

	const loadHome = useCallback(
		async (nextSession: AuthSession) => {
			const finishProgress = start();
			setStatus("loading");
			setHomeData(null);
			setError(null);
			try {
				const data = await fetchHomeData(nextSession, (section) => {
					setHomeData(
						(current) => ({ ...(current ?? {}), ...section }) as HomeData,
					);
					if (sectionHasContent(section)) setStatus("ready");
				});
				setHomeData(data);
				setStatus("ready");
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Could not load your library.",
				);
				setStatus("error");
			} finally {
				finishProgress();
			}
		},
		[start],
	);

	const detailId = detailIdFromPath(pathname);
	const searchQuery =
		typeof window !== "undefined"
			? (new URLSearchParams(window.location.search).get("q") ?? "")
			: "";
	const loadDetail = useCallback(
		async (nextSession: AuthSession, itemId: string) => {
			const finishProgress = start();
			setStatus("loading");
			setError(null);
			setDetailData(null);
			try {
				if (pathname === "/search") {
					setSearchData(searchQuery);
					setStatus("ready");
					return;
				}
				setDetailData(await fetchDetailData(nextSession, itemId));
				setStatus("ready");
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Could not load this title.",
				);
				setStatus("error");
			} finally {
				finishProgress();
			}
		},
		[start, pathname, searchQuery],
	);

	useEffect(() => {
		const finishProgress = start();
		const stored = getAuthSession();
		const storedLocale = getStoredLocale();
		// Apply both hydrated preferences before revealing the authenticated UI.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (storedLocale) setLocale(storedLocale);
		if (!stored) {
			// Cookie-backed auth is only available after hydration.
			setStatus("login");
			finishProgress();
			return;
		}
		setSession(stored);
		loadPreferences();
		finishProgress();
		if (detailId) void loadDetail(stored, detailId);
		else if (pathname === "/library" || pathname === "/favorites")
			setStatus("ready");
		else void loadHome(stored);
	}, [
		detailId,
		loadDetail,
		loadHome,
		loadPreferences,
		pathname,
		searchQuery,
		start,
	]);

	const handleLogin = async (username: string, password: string) => {
		const response = await authenticateByName(username, password);
		const nextSession = sessionFromAuth(response);
		setAuthCookies(nextSession);
		setSession(nextSession);
		loadPreferences();
		if (detailId) await loadDetail(nextSession, detailId);
		else if (pathname === "/search") {
			setSearchData(searchQuery);
			setStatus("ready");
		} else if (pathname === "/library" || pathname === "/favorites")
			setStatus("ready");
		else await loadHome(nextSession);
	};

	const handleLogout = useCallback(() => {
		clearAuthCookies();
		setSession(null);
		setHomeData(null);
		setDetailData(null);
		setSearchData(null);
		setError(null);
		setStatus("login");
	}, []);

	useEffect(() => {
		const handleAuthExpired = () => handleLogout();
		window.addEventListener("zenstream:auth-expired", handleAuthExpired);
		return () =>
			window.removeEventListener("zenstream:auth-expired", handleAuthExpired);
	}, [handleLogout]);

	const handleLocaleChange = async (nextLocale: Locale) => {
		const previousLocale = locale;
		const finishProgress = start();
		setLocale(nextLocale);
		storeLocale(nextLocale);
		try {
			await setLocalePreference(nextLocale);
		} catch (saveError) {
			setLocale(previousLocale);
			storeLocale(previousLocale);
			throw saveError;
		} finally {
			finishProgress();
		}
	};

	return (
		<I18nProvider locale={locale}>
			<SubtitlePreferencesProvider
				key={JSON.stringify(subtitleStyle)}
				initialStyle={subtitleStyle}
			>
				{status === "checking" ? (
					<div className="min-h-screen bg-background" />
				) : status === "login" || !session ? (
					<LoginPage onLogin={handleLogin} />
				) : (
					<SyncplayProvider userId={session.userId}>
						<SyncplayPlaybackFollower session={session} />
						{pathname === "/settings" ? (
							<SettingsPage
								displayName={session.username}
								userId={session.userId}
								locale={locale}
								onLocaleChange={handleLocaleChange}
								onLogout={handleLogout}
							/>
						) : (
							<div className="min-h-screen bg-background text-foreground">
							<Navbar
								displayName={session.username}
								userId={session.userId}
								onLogout={handleLogout}
								session={session}
							/>
							<MobileNav />
							{status === "error" && (
								<ErrorPanel
									titleKey={detailId ? "detailLoadFailed" : "libraryLoadFailed"}
									message={error}
									onRetry={() =>
										detailId ? loadDetail(session, detailId) : loadHome(session)
									}
								/>
							)}
							{status === "ready" && detailData && detailId && (
								<DetailPage initialData={detailData} session={session} />
							)}
							{status === "ready" && pathname === "/library" && (
								<LibraryPage session={session} />
							)}
							{status === "ready" && pathname === "/favorites" && (
								<FavoritesPage session={session} />
							)}
							{status === "ready" && pathname === "/search" && (
								<SearchPage
									session={session}
									query={searchData ?? searchQuery}
								/>
							)}
							{homeData &&
								!detailId &&
								pathname !== "/library" &&
								pathname !== "/favorites" &&
								pathname !== "/search" && (
									<HomePage data={homeData} session={session} />
								)}
							</div>
						)}
					</SyncplayProvider>
				)}
			</SubtitlePreferencesProvider>
		</I18nProvider>
	);
}

function sectionHasContent(section: Partial<HomeData>) {
	return Object.values(section).some((value) =>
		Array.isArray(value)
			? value.some((item) =>
					Array.isArray(item)
						? item.length > 0
						: typeof item === "object" && item !== null && "items" in item
							? Array.isArray(item.items) && item.items.length > 0
							: Boolean(item),
				)
			: Boolean(value),
	);
}

function detailIdFromPath(pathname: string) {
	const episode = pathname.match(/^\/show\/[^/]+\/episode\/([^/]+)$/);
	if (episode) return decodeURIComponent(episode[1]);
	const show = pathname.match(/^\/show\/([^/]+)$/);
	return show ? decodeURIComponent(show[1]) : null;
}
