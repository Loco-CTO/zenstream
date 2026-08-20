import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "@/components/pages/calendar-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import * as calendar from "@/lib/calendar";

const session = { token: "token", userId: "user", username: "Alex" };

describe("CalendarPage", () => {
	function renderPage() {
		return render(
			<I18nProvider locale="en">
				<ProgressProvider>
					<CalendarPage session={session} />
				</ProgressProvider>
			</I18nProvider>,
		);
	}

	function mockCalendar() {
		return vi.spyOn(calendar, "getCalendar").mockResolvedValue({
			start: "2026-08-16T00:00:00.000Z",
			end: "2026-08-23T00:00:00.000Z",
			events: [],
		});
	}

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not refetch continuously when loading state changes", async () => {
		const getCalendar = mockCalendar();

		renderPage();

		await waitFor(() => expect(getCalendar).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(getCalendar).toHaveBeenCalledTimes(1);
	});

	it("only exposes week and day views and bounds week navigation", async () => {
		mockCalendar();
		renderPage();

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Week" })).toBeInTheDocument(),
		);
		expect(screen.getByRole("button", { name: "Day" })).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Month" }),
		).not.toBeInTheDocument();

		const previous = screen.getByRole("button", { name: "Previous" });
		const next = screen.getByRole("button", { name: "Next" });
		fireEvent.click(previous);
		await waitFor(() => expect(previous).toBeDisabled());

		fireEvent.click(screen.getByRole("button", { name: "Today" }));
		for (let index = 0; index < 16; index += 1) {
			fireEvent.click(next);
		}
		await waitFor(() => expect(next).toBeDisabled());
	});

	it("keeps day navigation inside the same bounded window", async () => {
		mockCalendar();
		renderPage();

		await waitFor(() =>
			expect(screen.getByRole("button", { name: "Week" })).toBeInTheDocument(),
		);
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		for (let index = 1; index < 16; index += 1) {
			fireEvent.click(screen.getByRole("button", { name: "Next" }));
		}
		fireEvent.click(screen.getByRole("button", { name: "Day" }));

		const next = screen.getByRole("button", { name: "Next" });
		for (let index = 0; index < 6; index += 1) {
			fireEvent.click(next);
		}
		await waitFor(() => expect(next).toBeDisabled());
	});
});
