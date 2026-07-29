import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/pages/settings-page";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { I18nProvider, translate } from "@/lib/i18n";

const router = vi.hoisted(() => ({
	back: vi.fn(),
	push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

function openSection(name: string) {
	fireEvent.click(screen.getByRole("button", { name }));
}

describe("SettingsPage", () => {
	beforeEach(() => {
		router.back.mockClear();
		router.push.mockClear();
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
		expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Appearance" })).toBeInTheDocument();
		expect(screen.queryByRole("region", { name: "Playback" })).not.toBeInTheDocument();

		openSection("Appearance");
		expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
		expect(screen.getByRole("region", { name: "Appearance" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
		fireEvent.click(screen.getByRole("option", { name: "Japanese" }));
		await waitFor(() => expect(onLocaleChange).toHaveBeenCalledWith("ja"));
	});

	it("returns to the index from a category and keeps logout on the index", () => {
		const onLogout = vi.fn();
		render(
			<SettingsPage
				displayName="Alex"
				userId="user-1"
				locale="en"
				onLocaleChange={vi.fn()}
				onLogout={onLogout}
			/>,
		);

		openSection("Playback");
		const autoplay = screen.getByRole("switch", { name: "Autoplay Next Episode" });
		fireEvent.click(autoplay);
		expect(autoplay).toHaveAttribute("aria-checked", "false");
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Log out" }));
		expect(onLogout).toHaveBeenCalledOnce();
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
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
		render(
			<SubtitlePreferencesProvider initialStyle={style}>
				<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} />
			</SubtitlePreferencesProvider>,
		);

		expect(screen.queryByRole("combobox", { name: "Subtitle font" })).not.toBeInTheDocument();
		openSection("Subtitles");
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitle font" }));
		fireEvent.click(screen.getByRole("option", { name: "Noto Sans" }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/preferences/subtitles",
				expect.objectContaining({
					method: "PATCH",
					body: JSON.stringify({ ...style, fontFamily: "sans" }),
				}),
			),
		);
		expect(screen.queryByText("Autoplay Next Episode")).not.toBeInTheDocument();
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
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...style, renderer: "overlay" })));
		render(
			<SubtitlePreferencesProvider initialStyle={style}>
				<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} />
			</SubtitlePreferencesProvider>,
		);

		openSection("Subtitles");
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitle Renderer" }));
		fireEvent.click(screen.getByRole("option", { name: /Overlay/ }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/preferences/subtitles",
				expect.objectContaining({
					method: "PATCH",
					body: JSON.stringify({ ...style, renderer: "overlay" }),
				}),
			),
		);
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
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...style, fontColor: "#818cf8" })));
		render(
			<SubtitlePreferencesProvider initialStyle={style}>
				<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} />
			</SubtitlePreferencesProvider>,
		);

		openSection("Subtitles");
		const fontColorControl = screen.getByRole("button", { name: "Subtitle font color" });
		expect(fontColorControl).toHaveAttribute("aria-haspopup", "dialog");
		fireEvent.click(fontColorControl);
		const colorDialog = screen.getByRole("dialog", { name: "Subtitle font color" });
		expect(colorDialog).toBeInTheDocument();
		expect(colorDialog.closest(".overflow-hidden")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "#818cf8" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
			"/api/preferences/subtitles",
			expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ...style, fontColor: "#818cf8" }) }),
		));
	});

	it("localizes the settings index and category controls", () => {
		const settings = translate("ja", "settings");
		const playback = translate("ja", "playback");
		const privacy = translate("ja", "privacyData");
		const autoplay = translate("ja", "autoplayNextEpisode");
		render(
			<I18nProvider locale="ja">
				<SettingsPage displayName="Alex" userId="user-1" locale="ja" onLocaleChange={vi.fn()} onLogout={() => undefined} />
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
		render(<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} />);
		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
	});
});
