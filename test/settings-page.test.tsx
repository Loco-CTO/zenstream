import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/pages/settings-page";
import {
	PlaybackBehaviorPreferencesProvider,
	playbackBehaviorStorageKey,
} from "@/components/playback-behavior-preferences-provider";
import {
	SubtitlePreferencesProvider,
	useSubtitlePreferences,
} from "@/components/subtitle-preferences-provider";
import { I18nProvider, translate } from "@/lib/i18n";
import * as mediaApi from "@/lib/media-api";
import { SUBTITLE_STYLE_STORAGE_KEY } from "@/lib/subtitle-preferences";

const router = vi.hoisted(() => ({
	back: vi.fn(),
	push: vi.fn(),
}));
const session = { token: "token", userId: "user-1", username: "Alex" };

function installLocalStorage() {
	const storage = new Map<string, string>();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key),
			clear: () => storage.clear(),
		},
	});
}

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

function openSection(name: string) {
	fireEvent.click(screen.getByRole("button", { name }));
}

function SubtitleStyleProbe() {
	const { style } = useSubtitlePreferences();
	return (
		<output data-testid="subtitle-style">
			{style.fontFamily}:{style.renderer}
		</output>
	);
}

describe("SettingsPage", () => {
	beforeEach(() => {
		router.back.mockClear();
		router.push.mockClear();
		installLocalStorage();
	});

	it("shows a settings index and opens Appearance for language changes", async () => {
		const onLocaleChange = vi.fn().mockResolvedValue(undefined);
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={onLocaleChange}
				onLogout={() => undefined}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
		expect(
			screen.getByRole("navigation", { name: "Settings" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Appearance" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Notifications" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("region", { name: "Playback" }),
		).not.toBeInTheDocument();

		openSection("Appearance");
		expect(
			screen.getByRole("heading", { name: "Appearance" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "Appearance" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
		fireEvent.click(screen.getByRole("option", { name: "Japanese" }));
		await waitFor(() => expect(onLocaleChange).toHaveBeenCalledWith("ja"));
	});

	it("returns to the index from a category and keeps logout on the index", () => {
		const onLogout = vi.fn();
		render(
			<PlaybackBehaviorPreferencesProvider userId="user-1">
				<SettingsPage
					displayName="Alex"
					userId="user-1"
					locale="en"
					onLocaleChange={vi.fn()}
					onLogout={onLogout}
				/>
			</PlaybackBehaviorPreferencesProvider>,
		);

		openSection("Playback");
		const autoplay = screen.getByRole("switch", {
			name: "Autoplay Next Episode",
		});
		fireEvent.click(autoplay);
		expect(autoplay).toHaveAttribute("aria-checked", "false");
		const browseAutoplay = screen.getByRole("switch", {
			name: "Autoplay on Browse",
		});
		fireEvent.click(browseAutoplay);
		expect(browseAutoplay).toHaveAttribute("aria-checked", "false");
		expect(
			window.localStorage.getItem(playbackBehaviorStorageKey("user-1")),
		).toBe(JSON.stringify({ autoplayNextEpisode: false, autoplayBrowse: false }));
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(
			screen.getByRole("navigation", { name: "Settings" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Log out" }));
		expect(onLogout).toHaveBeenCalledOnce();
	});

	it("shows only the server-provided playback languages and saves selections", async () => {
		const onPlaybackPreferenceChange = vi.fn().mockResolvedValue(undefined);
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				onPlaybackPreferenceChange={onPlaybackPreferenceChange}
				playbackPreference={{
					audioLanguage: null,
					subtitleLanguage: null,
					audioLanguages: [{ value: "en", label: "English" }],
					subtitleLanguages: [{ value: "ja", label: "Japanese" }],
				}}
				onLogout={() => undefined}
			/>,
		);
		openSection("Playback");
		fireEvent.click(screen.getByRole("combobox", { name: "Audio Language" }));
		expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument();
		expect(
			screen.queryByRole("option", { name: "Spanish" }),
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("option", { name: "English" }));
		await waitFor(() =>
			expect(onPlaybackPreferenceChange).toHaveBeenCalledWith(
				"audioLanguage",
				"en",
			),
		);
	});

	it("uses the persisted Watch History toggle and removes Data Saver", async () => {
		const onWatchHistoryChange = vi.fn().mockResolvedValue(undefined);
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				watchHistoryEnabled
				onWatchHistoryChange={onWatchHistoryChange}
				onLogout={() => undefined}
			/>,
		);

		openSection("Privacy & Data");
		const toggle = screen.getByRole("switch", { name: "Watch History" });
		expect(toggle).toHaveAttribute("aria-checked", "true");
		fireEvent.click(toggle);
		await waitFor(() => expect(onWatchHistoryChange).toHaveBeenCalledWith(false));
		expect(toggle).toHaveAttribute("aria-checked", "true");
		expect(screen.queryByText("Data Saver")).not.toBeInTheDocument();
	});

	it("requires confirmation before clearing watch history", async () => {
		const onClearWatchHistory = vi.fn().mockResolvedValue(undefined);
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				onClearWatchHistory={onClearWatchHistory}
				onLogout={() => undefined}
			/>,
		);

		openSection("Privacy & Data");
		fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
		const dialog = screen.getByRole("dialog", { name: "Clear watch history?" });
		expect(dialog).toHaveTextContent(
			"This permanently removes your playback progress, watched status, play counts, and watched timestamps. This action is irreversible.",
		);

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(onClearWatchHistory).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
		fireEvent.pointerDown(screen.getByRole("dialog").parentElement!);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(onClearWatchHistory).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
		fireEvent.keyDown(window, { key: "Escape" });
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
		fireEvent.click(
			screen.getByRole("button", { name: /^Clear watch history$/ }),
		);
		await waitFor(() => expect(onClearWatchHistory).toHaveBeenCalledOnce());
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("keeps the clear modal open and reports failures", async () => {
		const onClearWatchHistory = vi
			.fn()
			.mockRejectedValue(new Error("clear failed"));
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				onClearWatchHistory={onClearWatchHistory}
				onLogout={() => undefined}
			/>,
		);

		openSection("Privacy & Data");
		fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
		fireEvent.click(
			screen.getByRole("button", { name: /^Clear watch history$/ }),
		);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Could not clear watch history. Please try again.",
			),
		);
		expect(screen.getByRole("dialog")).toBeInTheDocument();
	});

	it("shows subtitle controls only in the Subtitles category and saves changes", async () => {
		const style = {
			renderer: "native" as const,
			fontFamily: "serif" as const,
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 0,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		};
		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(style),
		);
		const fetchMock = vi.spyOn(globalThis, "fetch");
		render(
			<SubtitlePreferencesProvider>
				<SettingsPage
					displayName="Alex"
					userId="user-1"
					locale="en"
					onLocaleChange={vi.fn()}
					onLogout={() => undefined}
				/>
			</SubtitlePreferencesProvider>,
		);

		expect(
			screen.queryByRole("combobox", { name: "Subtitle font" }),
		).not.toBeInTheDocument();
		openSection("Subtitles");
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitle font" }));
		fireEvent.click(screen.getByRole("option", { name: "Noto Sans" }));
		await waitFor(() =>
			expect(
				JSON.parse(localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY)!),
			).toEqual({
				...style,
				fontFamily: "sans",
			}),
		);
		expect(
			fetchMock.mock.calls.filter(([url]) =>
				String(url).includes("/api/preferences/subtitles"),
			),
		).toHaveLength(0);
		expect(screen.queryByText("Autoplay Next Episode")).not.toBeInTheDocument();
	});

	it("updates from a subtitle style change in another browser tab", async () => {
		const initialStyle = {
			renderer: "native" as const,
			fontFamily: "sans" as const,
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 2,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		};
		const nextStyle = { ...initialStyle, renderer: "overlay" as const };
		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(initialStyle),
		);
		render(
			<SubtitlePreferencesProvider>
				<SubtitleStyleProbe />
			</SubtitlePreferencesProvider>,
		);
		expect(screen.getByTestId("subtitle-style")).toHaveTextContent("sans:native");

		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(nextStyle),
		);
		window.dispatchEvent(
			new StorageEvent("storage", {
				key: SUBTITLE_STYLE_STORAGE_KEY,
				newValue: JSON.stringify(nextStyle),
			}),
		);

		await waitFor(() =>
			expect(screen.getByTestId("subtitle-style")).toHaveTextContent(
				"sans:overlay",
			),
		);
	});

	it("opens the change-password form, validates it, and completes sign-in handoff", async () => {
		const changePassword = vi
			.spyOn(mediaApi, "changeAccountPassword")
			.mockResolvedValue(undefined);
		const onPasswordChanged = vi.fn();
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				session={session}
				locale="en"
				onLocaleChange={vi.fn()}
				onPasswordChanged={onPasswordChanged}
				onLogout={() => undefined}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Account/ }));
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		expect(
			screen.getByRole("dialog", { name: "Change Password" }),
		).toBeInTheDocument();

		fireEvent.change(screen.getByLabelText("Current password"), {
			target: { value: "current-password" },
		});
		fireEvent.change(screen.getByLabelText("New password"), {
			target: { value: "short" },
		});
		fireEvent.change(screen.getByLabelText("Confirm new password"), {
			target: { value: "short" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Password must be at least 8 characters.",
		);
		expect(changePassword).not.toHaveBeenCalled();

		fireEvent.change(screen.getByLabelText("New password"), {
			target: { value: "new-password" },
		});
		fireEvent.change(screen.getByLabelText("Confirm new password"), {
			target: { value: "new-password" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		await waitFor(() =>
			expect(changePassword).toHaveBeenCalledWith(
				session,
				"current-password",
				"new-password",
				"new-password",
			),
		);
		expect(
			screen.getByRole("heading", { name: "Password changed" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Continue to sign in" }));
		expect(onPasswordChanged).toHaveBeenCalledOnce();
	});

	it("closes the change-password modal when a pointer lands outside it", () => {
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				session={session}
				locale="en"
				onLocaleChange={vi.fn()}
				onLogout={() => undefined}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /Account/ }));
		fireEvent.click(screen.getByRole("button", { name: "Change Password" }));
		expect(
			screen.getByRole("dialog", { name: "Change Password" }),
		).toBeInTheDocument();

		fireEvent.pointerDown(
			screen.getByRole("dialog", { name: "Change Password" }).parentElement!,
		);

		expect(
			screen.queryByRole("dialog", { name: "Change Password" }),
		).not.toBeInTheDocument();
	});

	it("saves the selected subtitle renderer", async () => {
		const style = {
			renderer: "native" as const,
			fontFamily: "sans" as const,
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 0,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		};
		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(style),
		);
		const fetchMock = vi.spyOn(globalThis, "fetch");
		render(
			<SubtitlePreferencesProvider>
				<SettingsPage
					displayName="Alex"
					userId="user-1"
					locale="en"
					onLocaleChange={vi.fn()}
					onLogout={() => undefined}
				/>
			</SubtitlePreferencesProvider>,
		);

		openSection("Subtitles");
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitle Renderer" }));
		fireEvent.click(screen.getByRole("option", { name: /Overlay/ }));
		await waitFor(() =>
			expect(
				JSON.parse(localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY)!),
			).toEqual({
				...style,
				renderer: "overlay",
			}),
		);
		expect(
			fetchMock.mock.calls.filter(([url]) =>
				String(url).includes("/api/preferences/subtitles"),
			),
		).toHaveLength(0);
	});

	it("uses an in-app subtitle color popover", async () => {
		const style = {
			renderer: "native" as const,
			fontFamily: "sans" as const,
			bold: false,
			textScale: 100,
			fontColor: "#ffffff",
			borderSize: 0,
			borderColor: "#000000",
			backgroundColor: "#000000",
			backgroundOpacity: 0,
		};
		window.localStorage.setItem(
			SUBTITLE_STYLE_STORAGE_KEY,
			JSON.stringify(style),
		);
		render(
			<SubtitlePreferencesProvider>
				<SettingsPage
					displayName="Alex"
					userId="user-1"
					locale="en"
					onLocaleChange={vi.fn()}
					onLogout={() => undefined}
				/>
			</SubtitlePreferencesProvider>,
		);

		openSection("Subtitles");
		const fontColorControl = screen.getByRole("button", {
			name: "Subtitle font color",
		});
		expect(fontColorControl).toHaveAttribute("aria-haspopup", "dialog");
		fireEvent.click(fontColorControl);
		const colorDialog = screen.getByRole("dialog", {
			name: "Subtitle font color",
		});
		expect(colorDialog).toBeInTheDocument();
		expect(colorDialog.closest(".overflow-hidden")).toBeNull();
		const hexInput = screen.getByRole("textbox", {
			name: "Subtitle font color hex",
		});
		const storageBeforeEdit = localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY);
		fireEvent.change(hexInput, { target: { value: "#818cf8" } });
		expect(localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY)).toBe(
			storageBeforeEdit,
		);
		fireEvent.blur(hexInput);
		await waitFor(() =>
			expect(
				JSON.parse(localStorage.getItem(SUBTITLE_STYLE_STORAGE_KEY)!),
			).toEqual({
				...style,
				fontColor: "#818cf8",
			}),
		);
	});

	it("localizes the settings index and category controls", () => {
		const settings = translate("ja", "settings");
		const playback = translate("ja", "playback");
		const privacy = translate("ja", "privacyData");
		const autoplay = translate("ja", "autoplayNextEpisode");
		render(
			<I18nProvider locale="ja">
				<SettingsPage
					displayName="Alex"
					userId="user-1"
					locale="ja"
					onLocaleChange={vi.fn()}
					onLogout={() => undefined}
				/>
			</I18nProvider>,
		);

		expect(screen.getByRole("heading", { name: settings })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: playback })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: privacy })).toBeInTheDocument();
		openSection(playback);
		expect(screen.getByRole("switch", { name: autoplay })).toBeInTheDocument();
		expect(screen.queryByText("Change Password")).not.toBeInTheDocument();
	});

	it("uses browser history when leaving the settings index", () => {
		window.history.pushState({}, "", "/show/item-1");
		window.history.pushState({}, "", "/settings");
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				onLogout={() => undefined}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
	});
});
