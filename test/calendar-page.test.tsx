import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CalendarPage } from "@/components/pages/calendar-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import * as calendar from "@/lib/calendar";

const session = { token: "token", userId: "user", username: "Alex" };

describe("CalendarPage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not refetch continuously when loading state changes", async () => {
		const getCalendar = vi.spyOn(calendar, "getCalendar").mockResolvedValue({
			start: "2026-08-16T00:00:00.000Z",
			end: "2026-08-23T00:00:00.000Z",
			events: [],
		});

		render(
			<I18nProvider locale="en">
				<ProgressProvider>
					<CalendarPage session={session} />
				</ProgressProvider>
			</I18nProvider>,
		);

		await waitFor(() => expect(getCalendar).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(getCalendar).toHaveBeenCalledTimes(1);
	});

	it("renders catalog series cards as all-day premieres instead of episodes", async () => {
		const today = new Date();
		const eventDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
		vi.spyOn(calendar, "getCalendar").mockResolvedValue({
			start: `${eventDate}T00:00:00.000Z`,
			end: `${eventDate}T00:00:00.000Z`,
			events: [
				{
					id: "catalog-series",
					provider: "catalog",
					libraryId: "library",
					libraryName: "Library",
					kind: "series",
					releaseType: "premiere",
					eventAt: `${eventDate}T00:00:00+00:00`,
					eventDate,
					allDay: true,
					hasFile: true,
					monitored: false,
					state: "existing",
					title: "Series premiere",
					catalogItemId: "series-1",
					metadataStatus: "catalog",
				},
			],
		});

		render(
			<I18nProvider locale="en">
				<ProgressProvider>
					<CalendarPage session={session} />
				</ProgressProvider>
			</I18nProvider>,
		);

		await waitFor(() => expect(screen.getByText("Series premiere")).toBeInTheDocument());
		expect(screen.getAllByText("Premiere").length).toBeGreaterThan(0);
		expect(screen.queryByText("Episode")).not.toBeInTheDocument();
	});
});
