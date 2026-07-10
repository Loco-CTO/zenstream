import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "@/components/pages/settings-page";
import { SubtitlePreferencesProvider } from "@/components/subtitle-preferences-provider";
import { I18nProvider } from "@/lib/i18n";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("SettingsPage", () => {
  beforeEach(() => {
    router.back.mockClear();
    router.push.mockClear();
  });

  it("renders the design sections and changes app language", async () => {
    const onLocaleChange = vi.fn().mockResolvedValue(undefined);
    render(<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={onLocaleChange} onLogout={() => undefined} />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Playback" })).toBeInTheDocument();
    expect(screen.getByText("Playback")).toHaveClass("text-xs");
    expect(screen.getByText("Alex")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: "Japanese" }));
    await waitFor(() => expect(onLocaleChange).toHaveBeenCalledWith("ja"));
  });

  it("supports toggles, logout, and locale save errors", async () => {
    const onLogout = vi.fn();
    render(<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn().mockRejectedValue(new Error("offline"))} onLogout={onLogout} />);

    const autoplay = screen.getByRole("switch", { name: "Autoplay Next Episode" });
    fireEvent.click(autoplay);
    expect(autoplay).toHaveAttribute("aria-checked", "false");
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: "Japanese" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("persists the selected subtitle font family", async () => {
    const style = { fontFamily: "serif", bold: false, textScale: 100, fontColor: "#ffffff", borderSize: 0, borderColor: "#000000", backgroundColor: "#000000", backgroundOpacity: 0 };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(style)));
    render(<SubtitlePreferencesProvider><SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} /></SubtitlePreferencesProvider>);

    fireEvent.click(screen.getByRole("combobox", { name: "Subtitle font" }));
    fireEvent.click(screen.getByRole("option", { name: "Serif" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/preferences/subtitles", expect.objectContaining({ method: "PATCH", body: JSON.stringify(style) })));
		fireEvent.click(screen.getByRole("switch", { name: "Bold subtitles" }));
		await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/preferences/subtitles", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ ...style, bold: true }) })));
  });

  it("localizes every settings section and control", () => {
    render(
      <I18nProvider locale="ja">
        <SettingsPage displayName="Alex" userId="user-1" locale="ja" onLocaleChange={vi.fn()} onLogout={() => undefined} />
      </I18nProvider>,
    );

    expect(screen.getByRole("heading", { name: "設定" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "再生" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "プライバシーとデータ" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "次のエピソードを自動再生" })).toBeInTheDocument();
    expect(screen.queryByText("Change Password")).not.toBeInTheDocument();
  });

  it("uses browser history for the settings back button", () => {
    window.history.pushState({}, "", "/show/item-1");
    window.history.pushState({}, "", "/settings");
    render(<SettingsPage displayName="Alex" userId="user-1" locale="en" onLocaleChange={vi.fn()} onLogout={() => undefined} />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });
});
