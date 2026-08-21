import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationMenu } from "@/components/notifications/notification-menu";
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

function renderMenu() {
	return render(
		<I18nProvider locale="en">
			<NotificationMenu displayPath="/" session={session} />
		</I18nProvider>,
	);
}

describe("NotificationMenu", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it("opens as a bounded SyncPlay-style panel and loads only when opened", async () => {
		vi.spyOn(notifications, "getNotificationSummary").mockResolvedValue({
			unreadCount: 1,
		});
		const getNotifications = vi
			.spyOn(notifications, "getNotifications")
			.mockResolvedValue({
				items: [item("one")],
				unreadCount: 1,
				nextCursor: null,
			});

		renderMenu();
		const trigger = screen.getByRole("button", { name: "Notifications" });
		expect(getNotifications).not.toHaveBeenCalled();

		fireEvent.click(trigger);
		await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(1));
		expect(trigger).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByTestId("notification-thumbnail-one")).toBeInTheDocument();
		expect(screen.getByTestId("notification-popup")).toHaveClass(
			"fixed",
			"inset-x-3",
			"md:absolute",
			"backdrop-blur-xl",
		);

		fireEvent.click(trigger);
		expect(screen.queryByTestId("notification-popup")).not.toBeInTheDocument();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
	});

	it("loads the next cursor once when the scroll sentinel intersects", async () => {
		class ImmediateIntersectionObserver {
			private readonly callback: IntersectionObserverCallback;

			constructor(callback: IntersectionObserverCallback) {
				this.callback = callback;
			}

			observe() {
				this.callback(
					[{ isIntersecting: true } as IntersectionObserverEntry],
					this as unknown as IntersectionObserver,
				);
			}

			disconnect() {}
		}
		vi.stubGlobal("IntersectionObserver", ImmediateIntersectionObserver);
		vi.spyOn(notifications, "getNotificationSummary").mockResolvedValue({
			unreadCount: 2,
		});
		const getNotifications = vi
			.spyOn(notifications, "getNotifications")
			.mockResolvedValueOnce({
				items: [item("one")],
				unreadCount: 2,
				nextCursor: "50",
			})
			.mockResolvedValueOnce({
				items: [item("two", "2026-08-21T00:00:00.000Z")],
				unreadCount: 2,
				nextCursor: null,
			});

		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

		await waitFor(() => expect(getNotifications).toHaveBeenCalledTimes(2));
		expect(getNotifications.mock.calls[1]?.[2]).toBe("50");
		expect(screen.getByRole("link", { name: "Episode two" })).toBeInTheDocument();
	});

	it("closes when a pointer lands outside the panel", async () => {
		vi.spyOn(notifications, "getNotificationSummary").mockResolvedValue({
			unreadCount: 0,
		});
		vi.spyOn(notifications, "getNotifications").mockResolvedValue({
			items: [],
			unreadCount: 0,
			nextCursor: null,
		});

		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
		await screen.findByTestId("notification-popup");

		fireEvent.pointerDown(document.body);

		expect(screen.queryByTestId("notification-popup")).not.toBeInTheDocument();
	});

	it("marks an unread notification read and closes after navigation", async () => {
		vi.spyOn(notifications, "getNotificationSummary").mockResolvedValue({
			unreadCount: 1,
		});
		vi.spyOn(notifications, "getNotifications").mockResolvedValue({
			items: [item("one")],
			unreadCount: 1,
			nextCursor: null,
		});
		const setNotificationRead = vi
			.spyOn(notifications, "setNotificationRead")
			.mockResolvedValue({ id: "one", readAt: "2026-08-21T01:00:00.000Z" });

		renderMenu();
		fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
		const link = await screen.findByRole("link", { name: "Episode one" });
		fireEvent.click(link);

		expect(link).toHaveAttribute("href", "/show/one");
		expect(setNotificationRead).toHaveBeenCalledWith(session, "one", true);
		expect(screen.queryByTestId("notification-popup")).not.toBeInTheDocument();
	});
});
