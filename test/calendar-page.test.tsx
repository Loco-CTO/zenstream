import { render, waitFor } from "@testing-library/react";
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
});
