import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { Navbar } from "@/components/layout/navbar";
import * as notifications from "@/lib/notifications";

const navigation = vi.hoisted(() => ({ pathname: "/", query: "" }));
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

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
