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

	it("refreshes after a terminal catalog update but not during a scan", async () => {
		const getCalendar = mockCalendar();

		renderPage();

		await waitFor(() => expect(getCalendar).toHaveBeenCalledTimes(1));
		window.dispatchEvent(
			new CustomEvent("zenstream:catalog-changed", {
				detail: { reason: "scan" },
			}),
		);
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(getCalendar).toHaveBeenCalledTimes(1);

		window.dispatchEvent(
			new CustomEvent("zenstream:catalog-changed", {
				detail: { reason: "refresh" },
			}),
		);
		await waitFor(() => expect(getCalendar).toHaveBeenCalledTimes(2));
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

	it("overlays the selected event and supports closing it", async () => {
		const firstEventAt = new Date();
		firstEventAt.setHours(12, 0, 0, 0);
		const secondEventAt = new Date(firstEventAt);
		secondEventAt.setDate(secondEventAt.getDate() + 1);
		vi.spyOn(calendar, "getCalendar").mockResolvedValue({
			start: weekStart.toISOString(),
			end: weekEnd.toISOString(),
			events: [
				{
					id: "event-1",
					provider: "sonarr",
					libraryId: "library",
					libraryName: "Anime",
					kind: "episode",
					releaseType: "air",
					eventAt: firstEventAt.toISOString(),
					eventDate: firstEventAt.toISOString().slice(0, 10),
					allDay: false,
					seasonNumber: 1,
					episodeNumber: 2,
					hasFile: true,
					monitored: true,
					state: "future",
					title: "Episode title",
					seriesTitle: "Series title",
					catalogItemId: "episode-1",
					catalogSeriesId: "series-1",
					metadataStatus: "future",
				},
				{
					id: "event-2",
					provider: "sonarr",
					libraryId: "library",
					libraryName: "Anime",
					kind: "episode",
					releaseType: "air",
					eventAt: secondEventAt.toISOString(),
					eventDate: secondEventAt.toISOString().slice(0, 10),
					allDay: false,
					seasonNumber: 1,
					episodeNumber: 3,
					hasFile: false,
					monitored: true,
					state: "future",
					title: "Unreleased episode",
					seriesTitle: "Series title",
					metadataStatus: "future",
				},
			],
		});
		renderPage();

		const event = await screen.findByRole("button", { name: /Episode title/ });
		expect(event.style.backgroundColor).not.toBe("transparent");
		const unavailable = screen.getByRole("button", {
			name: /Unreleased episode/,
		});
		expect(unavailable.style.backgroundColor).toBe("transparent");
		expect(unavailable).toHaveClass("border");
		fireEvent.click(event);

		const close = screen.getByRole("button", { name: "Close" });
		expect(screen.getByRole("link", { name: "Open episode" })).toHaveAttribute(
			"href",
			"/show/series-1/episode/episode-1",
		);
		expect(close.closest("div.absolute")).toHaveClass("bottom-3");
		fireEvent.click(event);
		expect(
			screen.queryByRole("button", { name: "Close" }),
		).not.toBeInTheDocument();

		fireEvent.click(event);
		expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
		fireEvent.pointerDown(document.body);
		expect(
			screen.queryByRole("button", { name: "Close" }),
		).not.toBeInTheDocument();

		fireEvent.click(event);
		expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
		const reopenedClose = screen.getByRole("button", { name: "Close" });
		fireEvent.click(reopenedClose);
		expect(
			screen.queryByRole("button", { name: "Close" }),
		).not.toBeInTheDocument();
	});
});
