"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { sessionFromAuth } from "@/lib/auth";
import {
	authenticateByName,
	fetchDetailData,
	fetchPlayData,
	fetchHomeData,
	clearMediaClientCache,
	primeResourceTicket,
	type DetailData,
	type HomeData,
} from "@/lib/media-api";
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
import { PlayerPage } from "@/components/pages/player-page";
import { LibraryPage } from "@/components/pages/library-page";
import { FavoritesPage } from "@/components/pages/favorites-page";
import { SearchPage } from "@/components/pages/search-page";
import { CollectionPage } from "@/components/pages/collection-page";
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { I18nProvider, type Locale } from "@/lib/i18n";
import {
	getLocalePreference,
	getMetadataLanguagePreference,
	getMetadataLanguages,
	getStoredLocale,
	setLocalePreference,
	setMetadataLanguagePreference,
	storeLocale,
	type MetadataLanguagePreference,
} from "@/lib/preferences";
import {
	DEFAULT_SUBTITLE_STYLE,
	getSubtitlePreference,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { SyncplayProvider } from "@/lib/syncplay";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";
import { ToastProvider } from "@/components/ui/toast";
import { rememberLastNonPlayerPath } from "@/lib/player-navigation";
import { startCatalogEvents } from "@/lib/catalog-events";

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
	const [metadataLanguages, setMetadataLanguages] = useState<string[]>(["en"]);
	const [metadataLanguage, setMetadataLanguage] = useState<MetadataLanguagePreference>({ mode: "auto", language: "en" });
	const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
		DEFAULT_SUBTITLE_STYLE,
	);
	const loadedPreferencesToken = useRef<string | null>(null);
	const homeLoadInFlight = useRef(false);
	const homeDataRef = useRef<HomeData | null>(null);
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
		void getMetadataLanguages().then(setMetadataLanguages).catch(() => undefined);
		void getMetadataLanguagePreference().then(setMetadataLanguage).catch(() => undefined);
	}, []);

	const loadHome = useCallback(
		async (nextSession: AuthSession) => {
			if (homeLoadInFlight.current) return;
			homeLoadInFlight.current = true;
			const hasExistingHome = homeDataRef.current !== null;
			const finishProgress = start();
			if (!hasExistingHome) {
				setStatus("loading");
				setHomeData(null);
			}
			setError(null);
			try {
				await primeResourceTicket(nextSession);
				const data = await fetchHomeData(nextSession, (section) => {
					setHomeData(
						(current) => {
							const next = ({ ...(current ?? {}), ...section }) as HomeData;
							homeDataRef.current = next;
							return next;
						},
					);
					if (sectionHasContent(section)) setStatus("ready");
				});
				homeDataRef.current = data;
				setHomeData(data);
				setStatus("ready");
			} catch (err) {
				if (!hasExistingHome) {
					setError(
						err instanceof Error ? err.message : "Could not load your library.",
					);
					setStatus("error");
				}
			} finally {
				homeLoadInFlight.current = false;
				finishProgress();
			}
		},
		[start],
	);

	const detailId = detailIdFromPath(pathname);
	const playId = playIdFromPath(pathname);
	const searchQuery =
		typeof window !== "undefined"
			? (new URLSearchParams(window.location.search).get("q") ?? "")
			: "";
	const currentSearch =
		typeof window !== "undefined" ? window.location.search : "";
	const loadDetail = useCallback(
		async (nextSession: AuthSession, itemId: string) => {
			const finishProgress = start();
			setStatus("loading");
			setError(null);
			setDetailData(null);
			try {
				await primeResourceTicket(nextSession);
				if (pathname === "/search") {
					setSearchData(searchQuery);
					setStatus("ready");
					return;
				}
				setDetailData(
					playId
						? await fetchPlayData(nextSession, itemId)
						: await fetchDetailData(
							nextSession,
							itemId,
							new URLSearchParams(window.location.search).get("seasonId") ??
								undefined,
						),
				);
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
		[start, pathname, playId, searchQuery],
	);

	useEffect(() => {
		rememberLastNonPlayerPath(`${pathname}${currentSearch}`);
	}, [currentSearch, pathname]);

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
		if (loadedPreferencesToken.current !== stored.token) {
			loadedPreferencesToken.current = stored.token;
			loadPreferences();
		}
		void (async () => {
			if (detailId || playId) await loadDetail(stored, detailId ?? playId!);
			else if (pathname === "/search" || pathname === "/settings") {
				if (pathname === "/search") setSearchData(searchQuery);
				setStatus("ready");
			}
			else if (pathname === "/library" || pathname === "/favorites") {
				await primeResourceTicket(stored);
				setStatus("ready");
			} else await loadHome(stored);
			finishProgress();
		})();
	}, [
		detailId,
		playId,
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
		await primeResourceTicket(nextSession);
		if (detailId || playId) await loadDetail(nextSession, detailId ?? playId!);
		else if (pathname === "/search") {
			setSearchData(searchQuery);
			setStatus("ready");
		} else if (pathname === "/library" || pathname === "/favorites")
			setStatus("ready");
		else await loadHome(nextSession);
	};

	const handleLogout = useCallback(() => {
		clearAuthCookies();
		clearMediaClientCache();
		setSession(null);
		loadedPreferencesToken.current = null;
		homeDataRef.current = null;
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

	useEffect(() => {
		if (!session || process.env.NODE_ENV === "test") return;
		return startCatalogEvents(session);
	}, [session]);

	useEffect(() => {
		if (!session || pathname !== "/") return;
		const refresh = () => { void loadHome(session); };
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, [loadHome, pathname, session]);

	useEffect(() => {
		if (!session || !detailId || playId) return;
		const refresh = () => { void loadDetail(session, detailId); };
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, [detailId, loadDetail, pathname, playId, session]);

	const handleLocaleChange = async (nextLocale: Locale) => {
		const previousLocale = locale;
		const finishProgress = start();
		setLocale(nextLocale);
		storeLocale(nextLocale);
		try {
			await setLocalePreference(nextLocale);
			if (metadataLanguage.mode === "auto") {
				const updated = await getMetadataLanguagePreference();
				setMetadataLanguage(updated);
				if (session) {
					if (detailId) await loadDetail(session, detailId);
					else await loadHome(session);
				}
			}
		} catch (saveError) {
			setLocale(previousLocale);
			storeLocale(previousLocale);
			throw saveError;
		} finally {
			finishProgress();
		}
	};

	const handleMetadataLanguageChange = async (language: string | null) => {
		const previous = metadataLanguage;
		setMetadataLanguage({ mode: language ? "explicit" : "auto", language: language ?? locale });
		try {
			const updated = await setMetadataLanguagePreference(language);
			setMetadataLanguage(updated);
			if (session) {
				if (detailId) await loadDetail(session, detailId);
				else await loadHome(session);
			}
		} catch (error) {
			setMetadataLanguage(previous);
			throw error;
		}
	};

	return (
		<I18nProvider locale={locale}>
			<ToastProvider>
				<SubtitlePreferencesProvider
					key={JSON.stringify(subtitleStyle)}
					initialStyle={subtitleStyle}
				>
					{status === "checking" ? (
						<div className="min-h-screen bg-background" />
					) : status === "login" || !session ? (
						<LoginPage onLogin={handleLogin} />
					) : (
						<SyncplayProvider session={session}>
							<SyncplayPlaybackFollower />
							{pathname === "/settings" ? (
								<SettingsPage
									displayName={session.username}
									userId={session.userId}
									locale={locale}
									onLocaleChange={handleLocaleChange}
									metadataLanguages={metadataLanguages}
									metadataLanguage={metadataLanguage}
									onMetadataLanguageChange={handleMetadataLanguageChange}
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
											titleKey={
												detailId ? "detailLoadFailed" : "libraryLoadFailed"
											}
											message={error}
											onRetry={() =>
												detailId
													? loadDetail(session, detailId)
													: loadHome(session)
											}
										/>
									)}
									{status === "ready" && detailData && playId && (
										<PlayerPage initialData={detailData} session={session} />
									)}
									{status === "ready" &&
										detailData &&
										detailId &&
										!playId &&
										(detailData.item.Type === "BoxSet" ? (
											<CollectionPage
												initialData={detailData}
												session={session}
											/>
										) : (
											<DetailPage initialData={detailData} session={session} />
										))}
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
			</ToastProvider>
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
	const collection = pathname.match(/^\/collection\/([^/]+)$/);
	if (collection) return decodeURIComponent(collection[1]);
	const episode = pathname.match(/^\/show\/[^/]+\/episode\/([^/]+)$/);
	if (episode) return decodeURIComponent(episode[1]);
	const show = pathname.match(/^\/show\/([^/]+)$/);
	return show ? decodeURIComponent(show[1]) : null;
}

function playIdFromPath(pathname: string) {
	const match = pathname.match(/^\/play\/([^/]+)$/);
	return match ? decodeURIComponent(match[1]) : null;
}
