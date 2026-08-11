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
	clearMediaClientSession,
	primeResourceTicket,
	revokeAuthSession,
	validateBrowserSession,
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
	clearPreferenceCache,
	type MetadataLanguagePreference,
} from "@/lib/preferences";
import {
	DEFAULT_SUBTITLE_STYLE,
	getSubtitlePreference,
	clearSubtitlePreferenceCache,
	type SubtitleStyle,
} from "@/lib/subtitle-preferences";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { SyncplayProvider } from "@/lib/syncplay";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";
import { ToastProvider } from "@/components/ui/toast";
import { rememberLastNonPlayerPath } from "@/lib/player-navigation";
import { startCatalogEvents } from "@/lib/catalog-events";

type AppStatus =
	| "checking"
	| "login"
	| "loading"
	| "ready"
	| "error"
	| "bootstrap-error";

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
	const [metadataLanguage, setMetadataLanguage] =
		useState<MetadataLanguagePreference>({ mode: "auto", language: "en" });
	const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
		DEFAULT_SUBTITLE_STYLE,
	);
	const loadedPreferencesToken = useRef<string | null>(null);
	const sessionRef = useRef<AuthSession | null>(null);
	const routeLoadGeneration = useRef(0);
	const preferencesGeneration = useRef(0);
	const bootstrapInFlight = useRef<Promise<AuthSession | null> | null>(null);
	const authExpiryHandled = useRef<AuthSession | null>(null);
	const homeLoadInFlight = useRef(false);
	const homeTrailingRefresh = useRef(false);
	const homeTrailingRequest = useRef<{
		session: AuthSession;
		generation: number;
	} | null>(null);
	const loadHomeRef = useRef<
		((nextSession: AuthSession, requestedGeneration?: number) => Promise<void>) | null
	>(null);
	const homeDataRef = useRef<HomeData | null>(null);
	const detailRefreshGeneration = useRef(0);
	const detailRefreshInFlight = useRef(false);
	const detailTrailingRefresh = useRef(false);
	const detailRefreshController = useRef<AbortController | null>(null);
	const loadPreferences = useCallback((nextSession: AuthSession) => {
		const generation = ++preferencesGeneration.current;
		const commit = (callback: () => void) => {
			if (
				generation === preferencesGeneration.current &&
				sessionRef.current === nextSession
			)
				callback();
		};
		void getLocalePreference(nextSession)
			.then((remoteLocale) => {
				commit(() => {
					storeLocale(remoteLocale);
					setLocale(remoteLocale);
				});
			})
			.catch(() => undefined);
		void getSubtitlePreference(nextSession)
			.then((value) => commit(() => setSubtitleStyle(value)))
			.catch(() => undefined);
		void getMetadataLanguages(nextSession)
			.then((value) => commit(() => setMetadataLanguages(value)))
			.catch(() => undefined);
		void getMetadataLanguagePreference(nextSession)
			.then((value) => commit(() => setMetadataLanguage(value)))
			.catch(() => undefined);
	}, []);

	const loadHome = useCallback(
		async (nextSession: AuthSession, requestedGeneration = routeLoadGeneration.current) => {
			const isCurrent = () =>
				sessionRef.current === nextSession &&
				requestedGeneration === routeLoadGeneration.current;
			if (homeLoadInFlight.current) {
				if (sessionRef.current === nextSession)
					homeTrailingRefresh.current = true;
				else
					homeTrailingRequest.current = {
						session: nextSession,
						generation: requestedGeneration,
					};
				return;
			}
			homeLoadInFlight.current = true;
			const hasExistingHome = homeDataRef.current !== null;
			const finishProgress = start();
			if (!hasExistingHome) {
				if (isCurrent()) {
					setStatus("loading");
					setHomeData(null);
				}
			}
			if (isCurrent()) setError(null);
			try {
				do {
					homeTrailingRefresh.current = false;
					try {
						await primeResourceTicket(nextSession);
						const data = await fetchHomeData(nextSession, (section) => {
							if (!isCurrent()) return;
							setHomeData((current) => {
								const next = { ...(current ?? {}), ...section } as HomeData;
								homeDataRef.current = next;
								return next;
							});
							if (sectionHasContent(section)) setStatus("ready");
						});
						if (isCurrent()) {
							homeDataRef.current = data;
							setHomeData(data);
							setStatus("ready");
						}
					} catch (err) {
						if (homeTrailingRefresh.current) continue;
						if (!hasExistingHome && isCurrent()) {
							setError(
								err instanceof Error ? err.message : "Could not load your library.",
							);
							setStatus("error");
						}
					}
				} while (homeTrailingRefresh.current);
			} finally {
				homeLoadInFlight.current = false;
				finishProgress();
				const trailing = homeTrailingRequest.current;
				homeTrailingRequest.current = null;
				if (trailing && sessionRef.current === trailing.session)
					queueMicrotask(() => {
						void loadHomeRef.current?.(trailing.session, trailing.generation);
					});
			}
		},
		[start],
	);
	useEffect(() => {
		loadHomeRef.current = loadHome;
	}, [loadHome]);

	const detailId = detailIdFromPath(pathname);
	const playId = playIdFromPath(pathname);
	const searchQuery =
		typeof window !== "undefined"
			? (new URLSearchParams(window.location.search).get("q") ?? "")
			: "";
	const currentSearch =
		typeof window !== "undefined" ? window.location.search : "";
	const fetchDetailPayload = useCallback(
		async (nextSession: AuthSession, itemId: string, signal?: AbortSignal) => {
			await primeResourceTicket(nextSession);
			if (pathname === "/search") return null;
			return playId
				? fetchPlayData(nextSession, itemId)
				: fetchDetailData(
						nextSession,
						itemId,
						new URLSearchParams(window.location.search).get("seasonId") ?? undefined,
						signal,
					);
		},
		[pathname, playId],
	);
	const loadDetail = useCallback(
		async (
			nextSession: AuthSession,
			itemId: string,
			requestedGeneration = routeLoadGeneration.current,
		) => {
			const isCurrent = () =>
				sessionRef.current === nextSession &&
				requestedGeneration === routeLoadGeneration.current;
			const finishProgress = start();
			if (isCurrent()) {
				setStatus("loading");
				setError(null);
				setDetailData(null);
			}
			try {
				if (pathname === "/search") {
					if (isCurrent()) {
						setSearchData(searchQuery);
						setStatus("ready");
					}
					return;
				}
				const nextData = await fetchDetailPayload(nextSession, itemId);
				if (isCurrent()) {
					setDetailData(nextData);
					setStatus("ready");
				}
			} catch (err) {
				if (isCurrent()) {
					setError(err instanceof Error ? err.message : "Could not load this title.");
					setStatus("error");
				}
			} finally {
				finishProgress();
			}
		},
		[fetchDetailPayload, pathname, searchQuery, start],
	);

	const refreshDetail = useCallback(
		async (nextSession: AuthSession, itemId: string) => {
			if (detailRefreshInFlight.current) {
				detailTrailingRefresh.current = true;
				detailRefreshController.current?.abort();
				return;
			}
			detailRefreshInFlight.current = true;
			const finishProgress = start();
			try {
				do {
					detailTrailingRefresh.current = false;
					const generation = ++detailRefreshGeneration.current;
					const controller = new AbortController();
					detailRefreshController.current = controller;
					try {
						const nextData = await fetchDetailPayload(
							nextSession,
							itemId,
							controller.signal,
						);
						if (generation === detailRefreshGeneration.current && nextData)
							setDetailData(nextData);
					} catch (error) {
						if (!controller.signal.aborted) throw error;
					}
				} while (detailTrailingRefresh.current);
			} catch {
				// Keep the already-rendered detail page available on refresh failure.
			} finally {
				detailRefreshController.current = null;
				detailRefreshInFlight.current = false;
				finishProgress();
			}
		},
		[fetchDetailPayload, start],
	);

	useEffect(() => {
		rememberLastNonPlayerPath(`${pathname}${currentSearch}`);
	}, [currentSearch, pathname]);

	useEffect(() => {
		let disposed = false;
		const finishProgress = start();
		const stored = getAuthSession();
		const storedLocale = getStoredLocale();
		// Hydrate the locally cached interface language before authenticated content renders.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (storedLocale) setLocale(storedLocale);
		if (!stored) {
			setStatus("login");
			finishProgress();
			return () => {
				disposed = true;
			};
		}
		const validation =
			bootstrapInFlight.current ??
			(validateBrowserSession(stored).finally(() => {
				bootstrapInFlight.current = null;
			}) as Promise<AuthSession | null>);
		bootstrapInFlight.current = validation;
		void validation
			.then((verified) => {
				if (disposed) return;
				if (!verified) {
					clearAuthCookies();
					clearMediaClientSession();
					clearPreferenceCache();
					clearSubtitlePreferenceCache();
					setStatus("login");
					return;
				}
				setAuthCookies(verified);
				sessionRef.current = verified;
				setSession(verified);
				setStatus("checking");
			})
			.catch((validationError) => {
				if (disposed) return;
				setError(
					validationError instanceof Error
						? validationError.message
						: "Could not reach the Orchestrator.",
				);
				setStatus("bootstrap-error");
			})
			.finally(finishProgress);
		return () => {
			disposed = true;
		};
	}, [start]);

	useEffect(() => {
		if (!session) return;
		const generation = ++routeLoadGeneration.current;
		if (loadedPreferencesToken.current !== session.userId) {
			loadedPreferencesToken.current = session.userId;
			loadPreferences(session);
		}
		const finishProgress = start();
		void (async () => {
			if (detailId || playId)
				await loadDetail(session, detailId ?? playId!, generation);
			else if (pathname === "/search" || pathname === "/settings") {
				if (generation === routeLoadGeneration.current) {
					if (pathname === "/search") setSearchData(searchQuery);
					setStatus("ready");
				}
			} else if (pathname === "/library" || pathname === "/favorites") {
				await primeResourceTicket(session);
				if (generation === routeLoadGeneration.current) setStatus("ready");
			} else await loadHome(session, generation);
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
		session,
		start,
	]);

	const handleLogin = async (username: string, password: string) => {
		const response = await authenticateByName(username, password);
		const nextSession = sessionFromAuth(response);
		setAuthCookies(nextSession);
		sessionRef.current = nextSession;
		authExpiryHandled.current = null;
		setSession(nextSession);
		const generation = ++routeLoadGeneration.current;
		loadPreferences(nextSession);
		await primeResourceTicket(nextSession);
		if (detailId || playId)
			await loadDetail(nextSession, detailId ?? playId!, generation);
		else if (pathname === "/search") {
			if (generation === routeLoadGeneration.current) {
				setSearchData(searchQuery);
				setStatus("ready");
			}
		} else if (pathname === "/library" || pathname === "/favorites")
			{
				if (generation === routeLoadGeneration.current) setStatus("ready");
			}
		else await loadHome(nextSession, generation);
	};

	const clearLocalSession = useCallback((expiredSession?: AuthSession) => {
		if (expiredSession && sessionRef.current !== expiredSession) return;
		const activeSession = sessionRef.current ?? session;
		clearAuthCookies();
		clearMediaClientSession();
		clearPreferenceCache();
		clearSubtitlePreferenceCache();
		clearMediaClientCache();
		routeLoadGeneration.current += 1;
		preferencesGeneration.current += 1;
		detailRefreshGeneration.current += 1;
		detailRefreshController.current?.abort();
		sessionRef.current = null;
		setSession(null);
		loadedPreferencesToken.current = null;
		homeDataRef.current = null;
		homeTrailingRefresh.current = false;
		homeTrailingRequest.current = null;
		setHomeData(null);
		setDetailData(null);
		setSearchData(null);
		setError(null);
		setStatus("login");
		return activeSession;
	}, [session]);

	const handleLogout = useCallback(() => {
		const currentSession = sessionRef.current;
		if (!currentSession) return;
		const activeSession = clearLocalSession(currentSession);
		if (activeSession) void revokeAuthSession(activeSession).catch(() => undefined);
	}, [clearLocalSession]);

	useEffect(() => {
		const handleAuthExpired = (event: Event) => {
			const expiredSession = (event as CustomEvent<{ session?: AuthSession }>).detail
				?.session;
			if (expiredSession && sessionRef.current !== expiredSession) return;
			if (authExpiryHandled.current === expiredSession) return;
			authExpiryHandled.current = expiredSession ?? sessionRef.current;
			clearLocalSession(expiredSession);
		};
		window.addEventListener("zenstream:auth-expired", handleAuthExpired);
		return () =>
			window.removeEventListener("zenstream:auth-expired", handleAuthExpired);
	}, [clearLocalSession]);

	useEffect(() => {
		if (!session || process.env.NODE_ENV === "test") return;
		return startCatalogEvents(session);
	}, [session]);

	useEffect(() => {
		if (!session || pathname !== "/") return;
		const refresh = () => {
			void loadHome(session);
		};
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, [loadHome, pathname, session]);

	useEffect(() => {
		detailRefreshGeneration.current += 1;
	}, [detailId, playId]);

	useEffect(() => {
		if (!session || !detailId || playId) return;
		const refresh = (rawEvent: Event) => {
			const event = rawEvent as CustomEvent<{ libraryId?: string }>;
			if (
				event.detail?.libraryId &&
				detailData?.item.LibraryId !== event.detail.libraryId
			)
				return;
			void refreshDetail(session, detailId);
		};
		window.addEventListener("zenstream:catalog-changed", refresh);
		return () => window.removeEventListener("zenstream:catalog-changed", refresh);
	}, [
		detailData?.item.LibraryId,
		detailId,
		pathname,
		playId,
		refreshDetail,
		session,
	]);

	const handleLocaleChange = async (nextLocale: Locale) => {
		const previousLocale = locale;
		const finishProgress = start();
		setLocale(nextLocale);
		storeLocale(nextLocale);
		try {
			if (!session) return;
			await setLocalePreference(session, nextLocale);
			if (metadataLanguage.mode === "auto") {
				const updated = await getMetadataLanguagePreference(session);
				setMetadataLanguage(updated);
				if (session) {
					clearMediaClientCache();
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
		setMetadataLanguage({
			mode: language ? "explicit" : "auto",
			language: language ?? locale,
		});
		try {
			if (!session) return;
			const updated = await setMetadataLanguagePreference(session, language);
			setMetadataLanguage(updated);
			if (session) {
				clearMediaClientCache();
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
					session={session}
					initialStyle={subtitleStyle}
				>
					{status === "checking" ? (
						<div className="min-h-screen bg-background" />
					) : status === "bootstrap-error" ? (
						<ErrorPanel
							title="Could not connect to ZenStream"
							message={error}
							onRetry={() => {
								setStatus("checking");
								setError(null);
								window.location.reload();
							}}
						/>
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
											titleKey={detailId ? "detailLoadFailed" : "libraryLoadFailed"}
											message={error}
											onRetry={() =>
												detailId ? loadDetail(session, detailId) : loadHome(session)
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
											<CollectionPage initialData={detailData} session={session} />
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
										<SearchPage session={session} query={searchData ?? searchQuery} />
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
