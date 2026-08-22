import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { DEFAULT_SUBTITLE_STYLE } from "@/lib/subtitle-preferences";
import * as jellyfin from "@/lib/media-api";
import * as preferences from "@/lib/preferences";
import * as session from "@/lib/session";
import * as subtitlePreferences from "@/lib/subtitle-preferences";

const playbackPreference: preferences.PlaybackPreference = {
	audioLanguage: "en",
	subtitleLanguage: "ja",
	audioLanguages: [{ value: "en", label: "English" }],
	subtitleLanguages: [{ value: "ja", label: "Japanese" }],
};

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function renderSettings(
	auth = { token: "", userId: "user", username: "Alex" },
) {
	vi.spyOn(session, "getAuthSession").mockReturnValue(auth);
	return render(
		<ProgressProvider>
			<AppShell />
		</ProgressProvider>,
	);
}

async function openAppearance() {
	fireEvent.click(await screen.findByRole("button", { name: "Appearance" }));
	return screen.getAllByRole("combobox");
}

vi.mock("next/navigation", () => ({
	usePathname: () => "/settings",
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
	useSearchParams: () => new URLSearchParams(),
}));

describe("settings route", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi
			.spyOn(jellyfin, "validateBrowserSession")
			.mockImplementation(async (value) => value);
		vi.spyOn(jellyfin, "fetchHomeData").mockResolvedValue({} as never);
		vi.spyOn(preferences, "getLocalePreference").mockResolvedValue("en");
		vi.spyOn(preferences, "getMetadataLanguages").mockResolvedValue(["en", "ja"]);
		vi.spyOn(preferences, "getMetadataLanguagePreference").mockResolvedValue({
			mode: "auto",
			language: "en",
		});
		vi
			.spyOn(subtitlePreferences, "getSubtitlePreference")
			.mockResolvedValue(DEFAULT_SUBTITLE_STYLE);
		vi
			.spyOn(preferences, "getPlaybackPreference")
			.mockResolvedValue(playbackPreference);
		vi
			.spyOn(preferences, "getWatchHistoryPreference")
			.mockResolvedValue({ enabled: true });
	});

	it("does not render the home navigation while home data is loading", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue({
			token: "token",
			userId: "user",
			username: "Alex",
		});
		vi
			.spyOn(jellyfin, "fetchHomeData")
			.mockReturnValue(new Promise(() => undefined));

		render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		expect(
			await screen.findByRole("heading", { name: "Settings" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("navigation", { name: "Settings" }),
		).toBeInTheDocument();
	});

	it("revokes an explicit browser session only once", async () => {
		const auth = { token: "", userId: "user", username: "Alex" };
		vi.spyOn(session, "getAuthSession").mockReturnValue(auth);
		const revoke = vi
			.spyOn(jellyfin, "revokeAuthSession")
			.mockResolvedValue(undefined);

		render(
			<ProgressProvider>
				<AppShell />
			</ProgressProvider>,
		);

		const logout = await screen.findByRole("button", { name: /log out/i });
		fireEvent.click(logout);
		fireEvent.click(logout);
		expect(revoke).toHaveBeenCalledOnce();
	});

	it("serializes locale changes and ignores a stale failed mutation", async () => {
		const first = deferred<"ja">();
		const second = deferred<"en">();
		const save = vi
			.spyOn(preferences, "setLocalePreference")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderSettings();

		let [localeSelect] = await openAppearance();
		fireEvent.click(localeSelect);
		fireEvent.click(await screen.findByRole("option", { name: "Japanese" }));
		localeSelect = screen.getAllByRole("combobox")[0];
		fireEvent.click(localeSelect);
		fireEvent.click(await screen.findByRole("option", { name: "英語" }));

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[1]).toBe("ja");
		await act(async () => {
			first.reject(new Error("first write failed"));
			await Promise.resolve();
		});
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1]?.[1]).toBe("en");
		await act(async () => second.resolve("en"));

		await waitFor(() =>
			expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("English"),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("reloads playback languages when the Playback section opens", async () => {
		const load = vi.mocked(preferences.getPlaybackPreference);
		load.mockReset();
		load
			.mockRejectedValueOnce(new Error("initial playback load failed"))
			.mockResolvedValue(playbackPreference);
		renderSettings();

		await screen.findByRole("heading", { name: "Settings" });
		fireEvent.click(screen.getByRole("button", { name: "Playback" }));
		await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: "Audio Language" }),
			).toHaveTextContent("English"),
		);
	});

	it("keeps rapid audio and subtitle changes ordered", async () => {
		const first = deferred<preferences.PlaybackPreference>();
		const second = deferred<preferences.PlaybackPreference>();
		const save = vi
			.spyOn(preferences, "setPlaybackPreference")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderSettings();

		fireEvent.click(await screen.findByRole("button", { name: "Playback" }));
		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: "Audio Language" }),
			).toHaveTextContent("English"),
		);

		fireEvent.click(screen.getByRole("combobox", { name: "Audio Language" }));
		fireEvent.click(await screen.findByRole("option", { name: "English" }));
		fireEvent.click(screen.getByRole("combobox", { name: "Subtitle Language" }));
		fireEvent.click(await screen.findByRole("option", { name: "Japanese" }));

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[1]).toEqual({
			audioLanguage: "en",
			subtitleLanguage: "ja",
		});
		await act(async () =>
			first.resolve({ ...playbackPreference, subtitleLanguage: null }),
		);
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1]?.[1]).toEqual({
			audioLanguage: "en",
			subtitleLanguage: "ja",
		});
		await act(async () => second.resolve(playbackPreference));
		await waitFor(() =>
			expect(
				screen.getByRole("combobox", { name: "Subtitle Language" }),
			).toHaveTextContent("Japanese"),
		);
	});

	it("serializes Watch History changes and keeps the latest value", async () => {
		const first = deferred<preferences.WatchHistoryPreference>();
		const second = deferred<preferences.WatchHistoryPreference>();
		const save = vi
			.spyOn(preferences, "setWatchHistoryPreference")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderSettings();

		fireEvent.click(
			await screen.findByRole("button", { name: "Privacy & Data" }),
		);
		const toggle = await screen.findByRole("switch", { name: "Watch History" });
		fireEvent.click(toggle);
		fireEvent.click(toggle);

		await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
		expect(save.mock.calls[0]?.[1]).toBe(false);
		await act(async () => first.resolve({ enabled: false }));
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1]?.[1]).toBe(true);
		await act(async () => second.resolve({ enabled: true }));
		await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("rolls Watch History back when saving fails", async () => {
		vi
			.spyOn(preferences, "setWatchHistoryPreference")
			.mockRejectedValue(new Error("save failed"));
		renderSettings();

		fireEvent.click(
			await screen.findByRole("button", { name: "Privacy & Data" }),
		);
		const toggle = await screen.findByRole("switch", { name: "Watch History" });
		fireEvent.click(toggle);

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent(
				"Could not save the Watch History setting.",
			),
		);
		expect(toggle).toHaveAttribute("aria-checked", "true");
	});

	it("serializes metadata-language changes and ignores a stale failed mutation", async () => {
		const first = deferred<preferences.MetadataLanguagePreference>();
		const second = deferred<preferences.MetadataLanguagePreference>();
		const save = vi
			.spyOn(preferences, "setMetadataLanguagePreference")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderSettings();

		let metadataSelect = (await openAppearance())[1];
		fireEvent.click(metadataSelect);
		fireEvent.click(await screen.findByRole("option", { name: "Japanese" }));
		metadataSelect = screen.getAllByRole("combobox")[1];
		fireEvent.click(metadataSelect);
		fireEvent.click(await screen.findByRole("option", { name: "English" }));

		expect(save).toHaveBeenCalledTimes(1);
		expect(save.mock.calls[0]?.[1]).toBe("ja");
		await act(async () => {
			first.reject(new Error("first write failed"));
			await Promise.resolve();
		});
		await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
		expect(save.mock.calls[1]?.[1]).toBe("en");
		await act(async () => second.resolve({ mode: "explicit", language: "en" }));

		await waitFor(() =>
			expect(screen.getAllByRole("combobox")[1]).toHaveTextContent("English"),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("returns Settings to login when a locale mutation receives 401", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.includes("/api/preferences/locale") && init?.method === "PATCH")
				return new Response(null, { status: 401 });
			if (url.includes("/api/auth/socket-ticket"))
				return new Response(JSON.stringify({ ticket: "socket-ticket" }));
			if (url.includes("/api/syncplay/groups"))
				return new Response(JSON.stringify({ groups: [] }));
			return new Response(JSON.stringify({}));
		});
		renderSettings();

		const [localeSelect] = await openAppearance();
		fireEvent.click(localeSelect);
		fireEvent.click(await screen.findByRole("option", { name: "Japanese" }));

		expect(
			await screen.findByRole("heading", {
				name: /Welcome back|おかえりなさい/,
			}),
		).toBeInTheDocument();
		expect(screen.queryByRole("navigation", { name: "Settings" })).toBeNull();
	});
});
