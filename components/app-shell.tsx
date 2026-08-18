"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
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
const HomePage = dynamic(
	() => import("@/components/pages/home-page").then((m) => m.HomePage),
	{ ssr: false },
);
const LoginPage = dynamic(
	() => import("@/components/pages/login-page").then((m) => m.LoginPage),
	{ ssr: false },
);
const SettingsPage = dynamic(
	() => import("@/components/pages/settings-page").then((m) => m.SettingsPage),
	{ ssr: false },
);
const DetailPage = dynamic(
	() => import("@/components/pages/detail-page").then((m) => m.DetailPage),
	{ ssr: false },
);
const PlayerPage = dynamic(
	() => import("@/components/pages/player-page").then((m) => m.PlayerPage),
	{ ssr: false },
);
const LibraryPage = dynamic(
	() => import("@/components/pages/library-page").then((m) => m.LibraryPage),
	{ ssr: false },
);
const FavoritesPage = dynamic(
	() => import("@/components/pages/favorites-page").then((m) => m.FavoritesPage),
	{ ssr: false },
);
const SearchPage = dynamic(
	() => import("@/components/pages/search-page").then((m) => m.SearchPage),
	{ ssr: false },
);
const CollectionPage = dynamic(
	() =>
		import("@/components/pages/collection-page").then((m) => m.CollectionPage),
	{ ssr: false },
);
import { ErrorPanel } from "@/components/status/error-panel";
import { useProgress } from "@/components/status/progress-indicator";
import { I18nProvider, type Locale } from "@/lib/i18n";
import {
	getLocalePreference,
	getMetadataLanguagePreference,
	getMetadataLanguages,
	getPlaybackPreference,
	getStoredLocale,
	setLocalePreference,
	setMetadataLanguagePreference,
	setPlaybackPreference as savePlaybackPreference,
	storeLocale,
	clearPreferenceCache,
	type MetadataLanguagePreference,
	type PlaybackPreference,
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
	"checking" | "login" | "loading" | "ready" | "error" | "bootstrap-error";

const EMPTY_PLAYBACK_PREFERENCE: PlaybackPreference = {
	audioLanguage: null,
	subtitleLanguage: null,
	audioLanguages: [],
	subtitleLanguages: [],
};

export function AppShell() {
	const pathname = usePathname() ?? "/";
	const { start } = useProgress();
	const [session, setSession] = useState<AuthSession | null>(null);
	const [avatarVersion, setAvatarVersion] = useState<string | null>(null);
	const [homeData, setHomeData] = useState<HomeData | null>(null);
	const [searchData, setSearchData] = useState<string | null>(null);

	const [detailData, setDetailData] = useState<DetailData | null>(null);
	const [status, setStatus] = useState<AppStatus>("checking");
	const [error, setError] = useState<string | null>(null);
	const [locale, setLocale] = useState<Locale>("en");
	const [metadataLanguages, setMetadataLanguages] = useState<string[]>(["en"]);
	const [metadataLanguage, setMetadataLanguage] =
		useState<MetadataLanguagePreference>({ mode: "auto", language: "en" });
	const [playbackPreference, setPlaybackPreference] =
		useState<PlaybackPreference>(EMPTY_PLAYBACK_PREFERENCE);
	const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
		DEFAULT_SUBTITLE_STYLE,
	);
	const [, setResourceTicketRevision] = useState(0);
	const loadedPreferencesSession = useRef<AuthSession | null>(null);
	const sessionRef = useRef<AuthSession | null>(null);
	const routeLoadGeneration = useRef(0);
	const preferencesGeneration = useRef(0);
	const playbackPreferenceRef = useRef(EMPTY_PLAYBACK_PREFERENCE);
	const confirmedPlaybackPreference = useRef(EMPTY_PLAYBACK_PREFERENCE);
	const playbackPreferenceMutationGeneration = useRef(0);
	const playbackPreferenceMutationQueue = useRef<Promise<void>>(
		Promise.resolve(),
	);
	const localeMutationGeneration = useRef(0);
	const localeMutationQueue = useRef<Promise<void>>(Promise.resolve());
	const confirmedLocale = useRef<Locale>("en");
	const metadataLanguageMutationGeneration = useRef(0);
	const metadataLanguageMutationQueue = useRef<Promise<void>>(Promise.resolve());
	const confirmedMetadataLanguage = useRef<MetadataLanguagePreference>({
		mode: "auto",
		language: "en",
	});
	const metadataLanguageRef = useRef<MetadataLanguagePreference>({
		mode: "auto",
		language: "en",
	});
	const bootstrapInFlight = useRef<Promise<AuthSession | null> | null>(null);
	const authExpiryHandled = useRef<AuthSession | null>(null);
	const homeLoadInFlight = useRef(false);
	const homeTrailingRefresh = useRef(false);
	const homeTrailingRequest = useRef<{
		session: AuthSession;
		generation: number;
	} | null>(null);
	const loadHomeRef = useRef<
		| ((nextSession: AuthSession, requestedGeneration?: number) => Promise<void>)
		| null
	>(null);
	const homeDataRef = useRef<HomeData | null>(null);
	const detailRefreshGeneration = useRef(0);
	const detailRefreshInFlight = useRef(false);
	const detailTrailingRefresh = useRef(false);
	const detailRefreshController = useRef<AbortController | null>(null);
	const detailLoadController = useRef<AbortController | null>(null);
	const loadPreferences = useCallback((nextSession: AuthSession) => {
		const generation = ++preferencesGeneration.current;
		const localeGeneration = localeMutationGeneration.current;
		const metadataLanguageGeneration = metadataLanguageMutationGeneration.current;
		const playbackMutationGeneration =
			playbackPreferenceMutationGeneration.current;
		const commit = (callback: () => void) => {
			if (
				generation === preferencesGeneration.current &&
				sessionRef.current === nextSession
			)
				callback();
		};
		void getLocalePreference(nextSession)
			.then((remoteLocale) => {
				if (localeGeneration !== localeMutationGeneration.current) return;
				commit(() => {
					confirmedLocale.current = remoteLocale;
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
		void getPlaybackPreference(nextSession)
			.then((value) => {
				if (
					playbackMutationGeneration !== playbackPreferenceMutationGeneration.current
				)
					return;
				commit(() => {
					confirmedPlaybackPreference.current = value;
					playbackPreferenceRef.current = value;
					setPlaybackPreference(value);
				});
			})
			.catch(() => undefined);
		void getMetadataLanguagePreference(nextSession)
			.then((value) => {
				if (
					metadataLanguageGeneration !== metadataLanguageMutationGeneration.current
				)
					return;
				commit(() => {
					confirmedMetadataLanguage.current = value;
					metadataLanguageRef.current = value;
					setMetadataLanguage(value);
				});
			})
			.catch(() => undefined);
	}, []);

	const loadHome = useCallback(
		async (
			nextSession: AuthSession,
			requestedGeneration = routeLoadGeneration.current,
		) => {
			const isCurrent = () =>
				sessionRef.current === nextSession &&
				requestedGeneration === routeLoadGeneration.current;
			if (homeLoadInFlight.current) {
				if (sessionRef.current === nextSession) homeTrailingRefresh.current = true;
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
						void primeResourceTicket(nextSession);
						const data = await fetchHomeData(nextSession, (section) => {
							if (!isCurrent()) return;
							setHomeData((current) => {
								const next = mergeHomeSection(current, section);
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
		async (
			nextSession: AuthSession,
			itemId: string,
			signal?: AbortSignal,
			onSection?: (section: Partial<DetailData>) => void,
		) => {
			void primeResourceTicket(nextSession);
			if (pathname === "/search") return null;
			return playId
				? fetchPlayData(nextSession, itemId)
				: fetchDetailData(
						nextSession,
						itemId,
						new URLSearchParams(window.location.search).get("seasonId") ?? undefined,
						signal,
						onSection,
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
			detailLoadController.current?.abort();
			const loadController = new AbortController();
			detailLoadController.current = loadController;
			if (isCurrent()) {
				setStatus("loading");
				setError(null);
			}
			try {
				if (pathname === "/search") {
					if (isCurrent()) {
						setSearchData(searchQuery);
						setStatus("ready");
					}
					return;
				}
				const nextData = await fetchDetailPayload(
					nextSession,
					itemId,
					loadController.signal,
					(section) => {
						if (!isCurrent()) return;
						setDetailData(
							(current) => ({ ...(current ?? {}), ...section }) as DetailData,
						);
						if (section.item) setStatus("ready");
					},
				);
				if (isCurrent()) {
					setDetailData(nextData);
					setStatus("ready");
				}
			} catch (err) {
				if (loadController.signal.aborted) return;
				if (isCurrent()) {
					setError(
						err instanceof Error ? err.message : "Could not load this title.",
					);
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
		if (storedLocale) {
			confirmedLocale.current = storedLocale;
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setLocale(storedLocale);
		}
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
					setAvatarVersion(null);
					setStatus("login");
					return;
				}
				setAuthCookies(verified);
				sessionRef.current = verified;
				setAvatarVersion(verified.avatarVersion ?? null);
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
		if (loadedPreferencesSession.current !== session) {
			loadedPreferencesSession.current = session;
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
				void primeResourceTicket(session);
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
		setAvatarVersion(nextSession.avatarVersion ?? null);
		setSession(nextSession);
		const generation = ++routeLoadGeneration.current;
		loadPreferences(nextSession);
		void primeResourceTicket(nextSession);
		if (detailId || playId)
			await loadDetail(nextSession, detailId ?? playId!, generation);
		else if (pathname === "/search") {
			if (generation === routeLoadGeneration.current) {
				setSearchData(searchQuery);
				setStatus("ready");
			}
		} else if (pathname === "/library" || pathname === "/favorites") {
			if (generation === routeLoadGeneration.current) setStatus("ready");
		} else await loadHome(nextSession, generation);
	};

	const clearLocalSession = useCallback(
		(expiredSession?: AuthSession) => {
			if (expiredSession && sessionRef.current !== expiredSession) return;
			const activeSession = sessionRef.current ?? session;
			clearAuthCookies();
			clearMediaClientSession();
			clearPreferenceCache();
			clearSubtitlePreferenceCache();
			clearMediaClientCache();
			routeLoadGeneration.current += 1;
			preferencesGeneration.current += 1;
			localeMutationGeneration.current += 1;
			metadataLanguageMutationGeneration.current += 1;
			playbackPreferenceMutationGeneration.current += 1;
			localeMutationQueue.current = Promise.resolve();
			metadataLanguageMutationQueue.current = Promise.resolve();
			playbackPreferenceMutationQueue.current = Promise.resolve();
			detailRefreshGeneration.current += 1;
			detailRefreshController.current?.abort();
			sessionRef.current = null;
			setAvatarVersion(null);
			setSession(null);
			loadedPreferencesSession.current = null;
			playbackPreferenceRef.current = EMPTY_PLAYBACK_PREFERENCE;
			confirmedPlaybackPreference.current = EMPTY_PLAYBACK_PREFERENCE;
			setPlaybackPreference(EMPTY_PLAYBACK_PREFERENCE);
			homeDataRef.current = null;
			homeTrailingRefresh.current = false;
			homeTrailingRequest.current = null;
			setHomeData(null);
			setDetailData(null);
			setSearchData(null);
			setError(null);
			setStatus("login");
			return activeSession;
		},
		[session],
	);

	const handleLogout = useCallback(() => {
		const currentSession = sessionRef.current;
		if (!currentSession) return;
		const activeSession = clearLocalSession(currentSession);
		if (activeSession)
			void revokeAuthSession(activeSession).catch(() => undefined);
	}, [clearLocalSession]);

	useEffect(() => {
		const handleAuthExpired = (event: Event) => {
			const expiredSession = (event as CustomEvent<{ session?: AuthSession }>)
				.detail?.session;
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
		const refreshImageUrls = () =>
			setResourceTicketRevision((value) => value + 1);
		window.addEventListener("zenstream:resource-ticket", refreshImageUrls);
		return () =>
			window.removeEventListener("zenstream:resource-ticket", refreshImageUrls);
	}, []);

	useEffect(() => {
		if (!session || pathname !== "/") return;
		const refresh = (rawEvent: Event) => {
			const event = rawEvent as CustomEvent<{ reason?: "scan" | "refresh" }>;
			if (event.detail?.reason === "scan") return;
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
		const activeSession = session;
		const generation = ++localeMutationGeneration.current;
		const finishProgress = start();
		setLocale(nextLocale);
		storeLocale(nextLocale);
		if (!activeSession) {
			finishProgress();
			return;
		}
		const mutation = localeMutationQueue.current.then(async () => {
			if (sessionRef.current !== activeSession) return null;
			return setLocalePreference(activeSession, nextLocale);
		});
		localeMutationQueue.current = mutation.then(
			() => undefined,
			() => undefined,
		);
		try {
			const savedLocale = await mutation;
			if (savedLocale === null || sessionRef.current !== activeSession) return;
			confirmedLocale.current = savedLocale;
			if (generation !== localeMutationGeneration.current) return;
			setLocale(savedLocale);
			storeLocale(savedLocale);
			if (metadataLanguageRef.current.mode === "auto") {
				const metadataGeneration = metadataLanguageMutationGeneration.current;
				const updated = await getMetadataLanguagePreference(activeSession);
				if (
					generation !== localeMutationGeneration.current ||
					metadataGeneration !== metadataLanguageMutationGeneration.current ||
					sessionRef.current !== activeSession
				)
					return;
				confirmedMetadataLanguage.current = updated;
				metadataLanguageRef.current = updated;
				setMetadataLanguage(updated);
				clearMediaClientCache();
				if (detailId) await loadDetail(activeSession, detailId);
				else await loadHome(activeSession);
			}
		} catch (saveError) {
			if (
				generation !== localeMutationGeneration.current ||
				sessionRef.current !== activeSession
			)
				return;
			setLocale(confirmedLocale.current);
			storeLocale(confirmedLocale.current);
			throw saveError;
		} finally {
			finishProgress();
		}
	};

	const handleMetadataLanguageChange = async (language: string | null) => {
		const activeSession = session;
		const generation = ++metadataLanguageMutationGeneration.current;
		const optimistic = {
			mode: language ? "explicit" : "auto",
			language: language ?? locale,
		} as MetadataLanguagePreference;
		metadataLanguageRef.current = optimistic;
		setMetadataLanguage(optimistic);
		if (!activeSession) return;
		const mutation = metadataLanguageMutationQueue.current.then(async () => {
			if (sessionRef.current !== activeSession) return null;
			return setMetadataLanguagePreference(activeSession, language);
		});
		metadataLanguageMutationQueue.current = mutation.then(
			() => undefined,
			() => undefined,
		);
		try {
			const updated = await mutation;
			if (updated === null || sessionRef.current !== activeSession) return;
			confirmedMetadataLanguage.current = updated;
			if (generation !== metadataLanguageMutationGeneration.current) return;
			metadataLanguageRef.current = updated;
			setMetadataLanguage(updated);
			clearMediaClientCache();
			if (detailId) await loadDetail(activeSession, detailId);
			else await loadHome(activeSession);
		} catch (error) {
			if (
				generation !== metadataLanguageMutationGeneration.current ||
				sessionRef.current !== activeSession
			)
				return;
			metadataLanguageRef.current = confirmedMetadataLanguage.current;
			setMetadataLanguage(confirmedMetadataLanguage.current);
			throw error;
		}
	};

	const handlePlaybackPreferenceChange = async (
		field: "audioLanguage" | "subtitleLanguage",
		value: string | null,
	) => {
		const activeSession = session;
		if (!activeSession) return;
		const generation = ++playbackPreferenceMutationGeneration.current;
		const optimistic = {
			...playbackPreferenceRef.current,
			[field]: value,
		};
		playbackPreferenceRef.current = optimistic;
		setPlaybackPreference(optimistic);
		const mutation = playbackPreferenceMutationQueue.current.then(async () => {
			if (sessionRef.current !== activeSession) return null;
			return savePlaybackPreference(activeSession, {
				audioLanguage: optimistic.audioLanguage,
				subtitleLanguage: optimistic.subtitleLanguage,
			});
		});
		playbackPreferenceMutationQueue.current = mutation.then(
			() => undefined,
			() => undefined,
		);
		try {
			const saved = await mutation;
			if (saved === null || sessionRef.current !== activeSession) return;
			confirmedPlaybackPreference.current = saved;
			if (generation !== playbackPreferenceMutationGeneration.current) return;
			playbackPreferenceRef.current = saved;
			setPlaybackPreference(saved);
		} catch (error) {
			if (
				generation !== playbackPreferenceMutationGeneration.current ||
				sessionRef.current !== activeSession
			)
				return;
			playbackPreferenceRef.current = confirmedPlaybackPreference.current;
			setPlaybackPreference(confirmedPlaybackPreference.current);
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
									session={session}
									avatarVersion={avatarVersion}
									onAvatarVersionChange={setAvatarVersion}
									locale={locale}
									onLocaleChange={handleLocaleChange}
									metadataLanguages={metadataLanguages}
									metadataLanguage={metadataLanguage}
									onMetadataLanguageChange={handleMetadataLanguageChange}
									playbackPreference={playbackPreference}
									onPlaybackPreferenceChange={handlePlaybackPreferenceChange}
									onPlaybackPreferenceLoad={() => loadPreferences(session)}
									onLogout={handleLogout}
								/>
							) : (
								<div className="min-h-screen bg-background text-foreground">
									<Navbar
										displayName={session.username}
										userId={session.userId}
										avatarVersion={avatarVersion}
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

function mergeHomeSection(
	current: HomeData | null,
	section: Partial<HomeData>,
): HomeData {
	const next = { ...(current ?? {}), ...section } as HomeData;
	const currentLatestItems = current?.latestItems;
	const sectionLatestItems = section.latestItems;

	// The first featured response is intentionally limited to one item while the
	// complete hero list loads. Keep an already-rendered full list during that
	// intermediate refresh so the active slide cannot disappear and fall back to
	// the first item for a render.
	if (
		currentLatestItems &&
		sectionLatestItems &&
		currentLatestItems.length > sectionLatestItems.length
	) {
		next.latestItems = currentLatestItems;
	}

	return next;
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
