import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { ProgressProvider } from "@/components/status/progress-indicator";
import * as jellyfin from "@/lib/media-api";
import * as session from "@/lib/session";

vi.mock("next/navigation", () => ({
	usePathname: () => "/settings",
	useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

describe("settings route", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		vi.spyOn(jellyfin, "validateBrowserSession").mockImplementation(
			async (value) => value,
		);
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
		expect(screen.getByRole("navigation", { name: "Settings" })).toBeInTheDocument();
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
});
