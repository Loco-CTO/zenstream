import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getLocalePreference,
	getStoredLocale,
	LOCALE_STORAGE_KEY,
	setLocalePreference,
	storeLocale,
	clearPreferenceCache,
	getPlaybackPreference,
	setPlaybackPreference,
	getWatchHistoryPreference,
	setWatchHistoryPreference,
} from "@/lib/preferences";
import { clearWatchHistory } from "@/lib/media-api";
import {
	DEFAULT_SUBTITLE_STYLE,
	clearStoredSubtitleStyle,
	isSubtitleStyle,
	parseWebVttCues,
	readStoredSubtitleStyle,
	SUBTITLE_STYLE_STORAGE_KEY,
	writeStoredSubtitleStyle,
} from "@/lib/subtitle-preferences";

const storage = new Map<string, string>();
const session = { token: "", userId: "user-1", username: "Alex" };

beforeEach(() => {
	clearPreferenceCache();
	clearStoredSubtitleStyle();
	storage.clear();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: {
			clear: () => storage.clear(),
			getItem: (key: string) => storage.get(key) ?? null,
			removeItem: (key: string) => storage.delete(key),
			setItem: (key: string, value: string) => storage.set(key, value),
		},
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("locale preferences", () => {
	it("loads a valid locale", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ locale: "ja" })));
		await expect(getLocalePreference(session)).resolves.toBe("ja");
	});

	it("rejects invalid responses", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ locale: "fr" })));
		await expect(getLocalePreference(session)).rejects.toThrow("Invalid locale");
	});

	it("persists locale with PATCH", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ locale: "ja" })));
		await expect(setLocalePreference(session, "ja")).resolves.toBe("ja");
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/preferences/locale"),
			expect.objectContaining({
				method: "PATCH",
				credentials: "include",
				body: JSON.stringify({ locale: "ja" }),
			}),
		);
		expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("ja");
	});

	it("reads and validates the locally cached locale", () => {
		storeLocale("ja");
		expect(getStoredLocale()).toBe("ja");
		localStorage.setItem(LOCALE_STORAGE_KEY, "fr");
		expect(getStoredLocale()).toBeNull();
	});
});

describe("subtitle preferences", () => {
	it("uses the requested default appearance", () => {
		expect(DEFAULT_SUBTITLE_STYLE).toEqual({
			renderer: "native",
			fontFamily: "sans",
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 2,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		});
	});

	const style = {
		renderer: "native" as const,
		fontFamily: "serif" as const,
		bold: true,
		textScale: 125,
		fontColor: "#abcdef",
		borderSize: 2,
		borderColor: "#000000",
		backgroundColor: "#112233",
		backgroundOpacity: 40,
	};

	it("loads and validates the locally stored style", () => {
		localStorage.setItem(SUBTITLE_STYLE_STORAGE_KEY, JSON.stringify(style));
		expect(readStoredSubtitleStyle()).toEqual(style);
		expect(isSubtitleStyle({ ...style, textScale: 201 })).toBe(false);
	});

	it("defaults legacy and malformed local values safely", () => {
		const legacyStyle = {
			textScale: style.textScale,
			fontColor: style.fontColor,
			borderSize: style.borderSize,
			borderColor: style.borderColor,
			backgroundColor: style.backgroundColor,
			backgroundOpacity: style.backgroundOpacity,
		};
		localStorage.setItem(SUBTITLE_STYLE_STORAGE_KEY, JSON.stringify(legacyStyle));
		expect(readStoredSubtitleStyle()).toEqual({
			...legacyStyle,
			renderer: "native",
			fontFamily: "sans",
			bold: false,
		});
		localStorage.setItem(SUBTITLE_STYLE_STORAGE_KEY, "not-json");
		expect(readStoredSubtitleStyle()).toEqual(DEFAULT_SUBTITLE_STYLE);
		localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify({ ...style, textScale: 201 }),
		);
		expect(readStoredSubtitleStyle()).toEqual(DEFAULT_SUBTITLE_STYLE);
	});

	it("persists the complete style locally without a network request", () => {
		const fetchMock = vi.spyOn(globalThis, "fetch");
		expect(writeStoredSubtitleStyle(style)).toBe(true);
		expect(readStoredSubtitleStyle()).toEqual(style);
		expect(localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY)).toBe(
			JSON.stringify(style),
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("parses unstyled and authored-style WebVTT cues for the custom renderer", () => {
		expect(
			parseWebVttCues("WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nHello<br>world"),
		).toEqual([{ start: 1, end: 3.5, text: "Hello\nworld" }]);
		expect(
			parseWebVttCues(
				"WEBVTT\n\n00:00:01.000 --> 00:00:03.500 line:80%\n{\\bord4}<i>Styled</i> text",
			),
		).toEqual([{ start: 1, end: 3.5, text: "Styled text" }]);
		expect(
			parseWebVttCues(
				"WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nFirst\n\n00:00:01.000 --> 00:00:03.500\nSecond",
			),
		).toHaveLength(2);
		expect(
			parseWebVttCues(
				"WEBVTT\r\n00:00:01,000 --> 00:00:03,500\r\nA &amp; B\r\n\r\nNOTE ignored\r\n",
			),
		).toEqual([{ start: 1, end: 3.5, text: "A & B" }]);
	});
});

describe("playback language preferences", () => {
	const preference = {
		audioLanguage: null,
		subtitleLanguage: "off",
		audioLanguages: [{ value: "en", label: "English" }],
		subtitleLanguages: [{ value: "ja", label: "Japanese" }],
	};

	it("loads the permission-filtered language options", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(preference)));
		await expect(getPlaybackPreference(session)).resolves.toEqual(preference);
	});

	it("persists shared language selections", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify(preference)));
		await setPlaybackPreference(session, {
			audioLanguage: "en",
			subtitleLanguage: "ja",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/preferences/playback"),
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ audioLanguage: "en", subtitleLanguage: "ja" }),
			}),
		);
	});
});

describe("watch history preferences", () => {
	it("loads a valid persisted value", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ enabled: false })));

		await expect(getWatchHistoryPreference(session)).resolves.toEqual({
			enabled: false,
		});
	});

	it("rejects an invalid persisted value", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ enabled: "false" })));

		await expect(getWatchHistoryPreference(session)).rejects.toThrow(
			"Invalid watch history preference",
		);
	});

	it("persists the toggle with PATCH", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ enabled: false })));

		await expect(setWatchHistoryPreference(session, false)).resolves.toEqual({
			enabled: false,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/preferences/watch-history"),
			expect.objectContaining({
				method: "PATCH",
				body: JSON.stringify({ enabled: false }),
			}),
		);
	});

	it("clears watch history with an account-wide DELETE", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 204 }));

		await expect(clearWatchHistory(session)).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/account/watch-history"),
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
