import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotFound from "@/app/not-found";
import { ErrorPage } from "@/components/status/error-page";
import { ErrorPanel } from "@/components/status/error-panel";
import { I18nProvider } from "@/lib/i18n";
import * as session from "@/lib/session";

describe("error pages", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("renders the full topbar and home action for logged-in users", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue({
			token: "token",
			userId: "user-123",
			username: "Alex",
		});

		render(
			<ErrorPage
				statusCode="404"
				titleKey="pageNotFoundTitle"
				messageKey="pageNotFoundMessage"
			/>,
		);

		expect(await screen.findByRole("link", { name: "Home" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Profile" })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute(
			"href",
			"/",
		);
	});

	it("renders only the icon topbar for logged-out users", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue(null);

		render(
			<ErrorPage
				statusCode="404"
				titleKey="pageNotFoundTitle"
				messageKey="pageNotFoundMessage"
			/>,
		);

		await waitFor(() => expect(session.getAuthSession).toHaveBeenCalled());
		expect(screen.getByRole("link", { name: "ZenStream" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Search" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Profile" }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: "Return home" }),
		).not.toBeInTheDocument();
	});

	it("renders the custom not-found copy", async () => {
		vi.spyOn(session, "getAuthSession").mockReturnValue(null);

		render(<NotFound />);

		expect(
			await screen.findByRole("heading", { name: "Page not found" }),
		).toBeInTheDocument();
		expect(screen.getByText("404")).toBeInTheDocument();
		expect(
			screen.getByText("This screen is not available or may have moved."),
		).toBeInTheDocument();
	});

	it("keeps retry behavior for load failures", () => {
		const onRetry = vi.fn();

		render(
			<I18nProvider locale="en">
				<ErrorPanel message="Nope" onRetry={onRetry} />
			</I18nProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));

		expect(
			screen.getByRole("heading", { name: "Could not load your library" }),
		).toBeInTheDocument();
		expect(screen.getByText("Nope")).toBeInTheDocument();
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("uses a restrained responsive size for long error titles", () => {
		render(
			<I18nProvider locale="ja">
				<ErrorPanel message="Failed to fetch" onRetry={vi.fn()} />
			</I18nProvider>,
		);

		expect(screen.getByRole("heading")).toHaveClass(
			"max-w-xl",
			"text-3xl",
			"sm:text-4xl",
			"md:text-5xl",
		);
	});
});
