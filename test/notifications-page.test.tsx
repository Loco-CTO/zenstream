import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "@/components/pages/notifications-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import * as notifications from "@/lib/notifications";

const session = { token: "token", userId: "user", username: "Alex" };

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
});
