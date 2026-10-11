import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { Navbar } from "@/components/layout/navbar";
import * as lumi from "@/lib/lumi";
import * as notifications from "@/lib/notifications";

const navigation = vi.hoisted(() => ({ pathname: "/", query: "" }));
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
const session = { token: "token", userId: "user-123", username: "Test User" };
const lumiModels = {
	models: [{ id: "qwen-small", label: "Qwen small", supportsThinking: true }],
	defaultModel: "qwen-small",
	defaultThinking: false,
};

vi.mock("next/navigation", () => ({
	usePathname: () => navigation.pathname,
	useRouter: () => router,
	useSearchParams: () => new URLSearchParams(navigation.query),
}));

describe("Navbar", () => {
	beforeEach(() => {
		navigation.pathname = "/";
		navigation.query = "";
		router.push.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	const renderNavbar = () =>
		render(
			<Navbar
				displayName="Test User"
				userId="user-123"
				onLogout={() => undefined}
			/>,
		);

	it("uses the enlarged top-bar typography and artwork", () => {
		renderNavbar();

		expect(screen.getByRole("navigation")).toHaveClass("h-16", "md:h-20");
		expect(screen.getByRole("navigation").innerHTML).not.toContain(
			"bg-gradient-to-b",
		);
		expect(screen.getByAltText("ZenStream")).toHaveClass(
			"h-9",
			"w-9",
			"md:h-10",
			"md:w-10",
		);
		expect(screen.getByRole("link", { name: "Home" })).toHaveClass("text-sm");
		expect(screen.getByRole("button", { name: "Search" })).toHaveClass(
			"h-11",
			"w-11",
		);
		expect(screen.getByRole("button", { name: "Profile" })).toHaveClass(
			"h-10",
			"w-10",
		);
		expect(screen.getByTestId("header-actions")).toHaveClass(
			"items-center",
			"gap-2",
			"sm:gap-3",
		);
	});

	it("uses the user's uppercase initial when no profile image is available", () => {
		renderNavbar();

		expect(screen.getByTestId("default-user-initial")).toHaveTextContent("T");
		expect(
			screen.getByRole("button", { name: "Profile" }).querySelector("img"),
		).not.toBeInTheDocument();
	});

	it("links profile settings to the settings page", () => {
		renderNavbar();
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));
		expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
			"href",
			"/settings",
		);
	});

	it("shows available Lumi as an experimental profile-menu link", async () => {
		navigation.pathname = "/search";
		navigation.query = "q=anime";
		vi.spyOn(lumi, "getLumiModels").mockResolvedValue(lumiModels);

		render(
			<Navbar
				displayName="Test User"
				userId="user-123"
				onLogout={() => undefined}
				session={session}
			/>,
		);
		expect(
			screen.queryByRole("link", { name: /Ask Lumi/ }),
		).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));

		const lumiLink = await screen.findByRole("link", { name: /Ask Lumi/ });
		expect(lumiLink).toHaveAttribute(
			"href",
			"/lumi?returnTo=%2Fsearch%3Fq%3Danime",
		);
		expect(lumiLink).toHaveTextContent("Experimental");
		expect(lumiLink).toHaveTextContent("Experimental preview");
		fireEvent.click(lumiLink);
		expect(screen.queryByTestId("profile-popup")).not.toBeInTheDocument();
	});

	it("keeps Lumi hidden when it has no available models or cannot be reached", async () => {
		const getModels = vi
			.spyOn(lumi, "getLumiModels")
			.mockResolvedValueOnce({ ...lumiModels, models: [] })
			.mockRejectedValueOnce(new Error("Lumi unavailable"));

		render(
			<Navbar
				displayName="Test User"
				userId="user-123"
				onLogout={() => undefined}
				session={session}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));
		await waitFor(() => expect(getModels).toHaveBeenCalledTimes(1));
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: /Ask Lumi/ }),
			).not.toBeInTheDocument(),
		);

		fireEvent.focus(window);
		await waitFor(() => expect(getModels).toHaveBeenCalledTimes(2));
		await waitFor(() =>
			expect(
				screen.queryByRole("link", { name: /Ask Lumi/ }),
			).not.toBeInTheDocument(),
		);
	});

	it("refreshes Lumi availability when the page becomes visible and aborts on close", async () => {
		const signals: AbortSignal[] = [];
		const getModels = vi
			.spyOn(lumi, "getLumiModels")
			.mockImplementation(async (_session, signal) => {
				if (signal) signals.push(signal);
				return { ...lumiModels, models: [] };
			});

		render(
			<Navbar
				displayName="Test User"
				userId="user-123"
				onLogout={() => undefined}
				session={session}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));
		await waitFor(() => expect(getModels).toHaveBeenCalledTimes(1));

		fireEvent.visibilityChange(document);
		await waitFor(() => expect(getModels).toHaveBeenCalledTimes(2));

		fireEvent.pointerDown(document.body);
		expect(signals[1]?.aborted).toBe(true);
	});

	it("links Library to the Library route", () => {
		renderNavbar();
		expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
			"href",
			"/library",
		);
	});

	it("submits the shared search form on the search route", () => {
		navigation.pathname = "/search";
		navigation.query = "q=old";
		renderNavbar();

		const input = screen.getByRole("textbox", { name: "Search" });
		expect(input).toHaveValue("old");
		expect(input.closest("form")).toHaveClass(
			"left-0",
			"right-0",
			"top-14",
			"md:left-1/2",
			"md:right-auto",
			"md:top-1/2",
			"md:w-[min(38rem,calc(100vw-2rem))]",
			"md:-translate-x-1/2",
			"md:-translate-y-1/2",
		);
		fireEvent.change(input, { target: { value: "Demon Slayer" } });
		fireEvent.submit(input.closest("form")!);

		expect(router.push).toHaveBeenCalledWith("/search?q=Demon%20Slayer");
	});

	it("renders the profile popup with the shared neutral glass styling", () => {
		renderNavbar();
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));

		expect(screen.getByTestId("profile-popup")).toHaveClass(
			"rounded-xl",
			"border-white/10",
			"bg-black/25",
			"backdrop-blur-xl",
		);
		expect(screen.getByTestId("profile-popup").className).not.toContain(
			"linear-gradient",
		);
	});

	it("closes the profile popup when a pointer lands outside it", () => {
		renderNavbar();
		fireEvent.click(screen.getByRole("button", { name: "Profile" }));
		expect(screen.getByTestId("profile-popup")).toBeInTheDocument();

		fireEvent.pointerDown(document.body);

		expect(screen.queryByTestId("profile-popup")).not.toBeInTheDocument();
	});

	it("keeps the mobile groups panel inside the viewport", () => {
		renderNavbar();
		fireEvent.click(screen.getByRole("button", { name: "Groups" }));

		expect(screen.getByTestId("syncplay-group-popup")).toHaveClass(
			"fixed",
			"inset-x-3",
			"md:absolute",
		);
	});

	it("opens the notification modal from the authenticated bell", async () => {
		vi.spyOn(notifications, "getNotificationSummary").mockResolvedValue({
			unreadCount: 0,
		});
		vi.spyOn(notifications, "getNotifications").mockResolvedValue({
			items: [],
			unreadCount: 0,
			nextCursor: null,
		});

		render(
			<Navbar
				displayName="Test User"
				userId="user-123"
				onLogout={() => undefined}
				session={{ token: "token", userId: "user-123", username: "Test User" }}
			/>,
		);
		const trigger = screen.getByRole("button", { name: "Notifications" });
		fireEvent.click(trigger);

		await waitFor(() =>
			expect(screen.getByTestId("notification-popup")).toBeInTheDocument(),
		);
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("notification-popup")).toHaveClass(
			"fixed",
			"inset-x-3",
			"md:absolute",
		);
	});
});
