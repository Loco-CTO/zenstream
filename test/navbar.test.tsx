import { fireEvent, render, screen } from "@testing-library/react";
import { Navbar } from "@/components/layout/navbar";

describe("Navbar", () => {
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

	it("keeps the mobile groups panel inside the viewport", () => {
		renderNavbar();
		fireEvent.click(screen.getByRole("button", { name: "Groups" }));

		expect(screen.getByTestId("syncplay-group-popup")).toHaveClass(
			"fixed",
			"inset-x-3",
			"md:absolute",
		);
	});
});
