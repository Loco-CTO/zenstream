import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "@/components/pages/notifications-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import * as notifications from "@/lib/notifications";
import type { NotificationItem } from "@/lib/notifications";

const session = { token: "token", userId: "user", username: "Alex" };

function item(id: string, readAt: string | null = null): NotificationItem {
	return {
		id,
		kind: "new_episode",
		title: `Episode ${id}`,
		subtitle: "S01E01 — Pilot",
		createdAt: "2026-08-21T00:00:00.000Z",
		readAt,
		navigationTarget: `/show/${id}`,
		thumbnail: {
			url: `/api/catalog/items/${id}/images/Primary?language=en`,
		},
	};
}

describe("NotificationsPage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not refetch continuously when loading state changes", async () => {
		const getNotifications = vi
			.spyOn(notifications, "getNotifications")
			.mockResolvedValue({ items: [], unreadCount: 0, nextCursor: null });

		render(
			<I18nProvider locale="en">
				<ProgressProvider>
					<NotificationsPage session={session} />
				</ProgressProvider>
			</I18nProvider>,
		);

		await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(getNotifications).toHaveBeenCalledTimes(1);
	});

	it("keeps notification actions in the dots menu", async () => {
		vi.spyOn(notifications, "getNotifications").mockResolvedValue({
			items: [item("one")],
			unreadCount: 1,
			nextCursor: null,
		});
		const setNotificationRead = vi
			.spyOn(notifications, "setNotificationRead")
			.mockResolvedValue({ id: "one", readAt: "2026-08-21T01:00:00.000Z" });

		render(
			<I18nProvider locale="en">
				<ProgressProvider>
					<NotificationsPage session={session} />
				</ProgressProvider>
			</I18nProvider>,
		);

		await screen.findByRole("link", { name: "Episode one" });
		const actions = screen.getByRole("button", { name: "Notification actions" });
		expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

		fireEvent.click(actions);
		expect(screen.getByRole("menuitem", { name: "Mark as read" })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: "Remove notification" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("menuitem", { name: "Mark as read" }));
		await waitFor(() =>
			expect(setNotificationRead).toHaveBeenCalledWith(session, "one", true),
		);
	});
});
