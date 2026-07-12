"use client";

import { createContext, useContext, type ReactNode } from "react";
import en from "@/locale/en.yaml";
import ja from "@/locale/ja.yaml";

export const SUPPORTED_LOCALES = ["en", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const TRANSLATION_KEYS = [
	"home",
	"library",
	"favorites",
	"list",
	"search",
	"notifications",
	"profile",
	"settings",
	"language",
	"english",
	"japanese",
	"logout",
	"all",
	"play",
	"skipIntro",
	"skipOutro",
	"info",
	"save",
	"saved",
	"welcome",
	"loginDescription",
	"username",
	"password",
	"login",
	"loginFailed",
	"libraryLoadFailed",
	"retry",
	"returnHome",
	"pageNotFoundTitle",
	"pageNotFoundMessage",
	"unexpectedErrorTitle",
	"unexpectedErrorMessage",
	"emptyLibrary",
	"emptyLibraryHint",
	"featuredTitle",
	"previousSlide",
	"nextSlide",
	"searchSoon",
	"searchPlaceholder",
	"searchLoading",
	"searchLoadFailed",
	"noSearchResults",
	"searchResults",
	"movie",
	"series",
	"close",
	"localeSaveFailed",
	"continueWatching",
	"newlyAddedOn",
	"nextUp",
	"playNext",
	"stopPlaying",
	"topRated",
	"newReleases",
	"movies",
	"myList",
	"minutes",
	"episodes",
	"unwatchedEpisodes",
	"allEpisodesWatched",
	"items",
	"scrollLeft",
	"scrollRight",
	"showSlide",
	"account",
	"edit",
	"changePassword",
	"appearance",
	"languageDescription",
	"playback",
	"audioLanguage",
	"subtitleLanguage",
	"audioTrack",
	"subtitleTrack",
	"subtitlesOff",
	"selectTracks",
	"cancel",
	"quality",
	"switchingQuality",
	"speed",
	"subtitleOffset",
	"subtitleFont",
	"subtitleBold",
	"subtitlePreview",
	"subtitlePreviewText",
	"subtitleTextSize",
	"subtitleFontColor",
	"subtitleBorderSize",
	"subtitleBorderColor",
	"subtitleBackgroundColor",
	"subtitleBackgroundOpacity",
	"subtitleSaveFailed",
	"spanish",
	"french",
	"off",
	"autoplayNextEpisode",
	"autoplayBrowse",
	"autoplayBrowseDescription",
	"newEpisodes",
	"newEpisodesDescription",
	"newSeasons",
	"watchReminders",
	"watchRemindersDescription",
	"appUpdates",
	"privacyData",
	"watchHistory",
	"watchHistoryDescription",
	"dataSaver",
	"dataSaverDescription",
	"clearWatchHistory",
	"clear",
	"dangerZone",
	"back",
	"episodesLabel",
	"season",
	"castCrew",
	"moreLikeThis",
	"markWatched",
	"markUnwatched",
	"addFavorite",
	"removeFavorite",
	"detailLoadFailed",
	"itemNotFound",
	"muteTrailer",
	"unmuteTrailer",
	"sortBy",
	"sortAscending",
	"sortDescending",
	"sortRating",
	"sortTitle",
	"sortDateAdded",
	"sortLastAdded",
	"sortReleaseDate",
	"sortYear",
	"sortCriticRating",
	"sortRuntime",
	"sortLastPlayed",
	"sortPlayCount",
	"libraryItems",
	"libraryLoadPageFailed",
	"libraryLoadMoreFailed",
	"loadingMore",
	"noLibraries",
	"noLibrariesHint",
	"favoriteEpisodes",
	"favoriteMovies",
	"favoriteSeries",
	"noFavorites",
	"favoritesLoadFailed",
	"syncplayGroups",
	"createGroup",
	"noSyncplayGroups",
	"syncplayWatching",
	"syncplayNoMedia",
	"joinView",
	"leaveGroup",
	"allowViewerControls",
	"toastDismiss",
	"syncplayGroupCreated",
	"syncplayJoinedGroup",
	"syncplayLeftGroup",
	"syncplayMemberJoined",
	"syncplayMemberLeft",
	"syncplayGroupEnded",
	"syncplayNowPlaying",
	"syncplayNowPlayingFallback",
	"syncplayCreateFailed",
	"syncplayJoinFailed",
	"syncplayLeaveFailed",
	"syncplaySettingsFailed",
	"syncplayPlaybackFailed",
	"syncplayPresenceFailed",
	"syncplayRemoveMember",
	"syncplayAlreadyInGroup",
	"syncplayMustLeaveGroup",
	"syncplayHostDisconnected",
] as const;

export type TranslationKey = (typeof TRANSLATION_KEYS)[number];
type Dictionary = Record<TranslationKey, string>;

const dictionaries: Record<Locale, Dictionary> = {
	en: validateDictionary("en", en),
	ja: validateDictionary("ja", ja),
};
const I18nContext = createContext<Locale>("en");

function validateDictionary(
	language: Locale,
	dictionary: Record<string, string>,
): Dictionary {
	const expected = new Set<string>(TRANSLATION_KEYS);
	const missing = TRANSLATION_KEYS.filter((key) => !(key in dictionary));
	const unexpected = Object.keys(dictionary).filter(
		(key) => !expected.has(key),
	);
	if (missing.length || unexpected.length) {
		throw new Error(
			`Invalid ${language} language dictionary (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}).`,
		);
	}
	return dictionary as Dictionary;
}

export function isLocale(value: unknown): value is Locale {
	return (
		typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale)
	);
}

export function translate(
	locale: Locale,
	key: TranslationKey,
	values?: Record<string, string | number>,
) {
	let result = dictionaries[locale][key];
	for (const [name, value] of Object.entries(values ?? {})) {
		result = result.replaceAll(`{${name}}`, String(value));
	}
	return result;
}

export function I18nProvider({
	locale,
	children,
}: {
	locale: Locale;
	children: ReactNode;
}) {
	return <I18nContext.Provider value={locale}>{children}</I18nContext.Provider>;
}

export function useI18n() {
	const locale = useContext(I18nContext);
	return {
		locale,
		t: (key: TranslationKey, values?: Record<string, string | number>) =>
			translate(locale, key, values),
	};
}
