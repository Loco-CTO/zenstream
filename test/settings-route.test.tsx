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
