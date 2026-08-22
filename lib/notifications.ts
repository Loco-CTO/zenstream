import type { AuthSession } from "@/lib/session";
import { catalogRequest } from "@/lib/catalog";

export type NotificationItem = {
	id: string;
	kind: "new_episode" | "new_movie" | string;
	title: string;
	subtitle?: string | null;
	itemId?: string | null;
	seriesId?: string | null;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	createdAt: string;
	readAt?: string | null;
	navigationTarget: string;
	thumbnail?: {
		url: string;
		blurHash?: string | null;
	} | null;
};

export type NotificationPage = {
	items: NotificationItem[];
	unreadCount: number;
	nextCursor: string | null;
};

export function getNotifications(
	session: AuthSession,
	limit = 50,
	cursor?: string | null,
) {
	const params = new URLSearchParams({ limit: String(limit) });
	if (cursor) params.set("cursor", cursor);
	return catalogRequest<NotificationPage>(
		session,
		`/api/notifications?${params.toString()}`,
	);
}

export function getNotificationSummary(session: AuthSession) {
	return catalogRequest<{ unreadCount: number }>(
		session,
		"/api/notifications/summary",
	);
}

export async function setNotificationRead(
	session: AuthSession,
	notificationId: string,
	read: boolean,
) {
	const result = await catalogRequest<{ id: string; readAt: string | null }>(
		session,
		`/api/notifications/${encodeURIComponent(notificationId)}`,
		{
			method: "PATCH",
			body: JSON.stringify({ read }),
		},
	);
	notifyNotificationsChanged();
	return result;
}

export async function deleteNotification(
	session: AuthSession,
	notificationId: string,
) {
	const result = await catalogRequest<{ id: string; removed: boolean }>(
		session,
		`/api/notifications/${encodeURIComponent(notificationId)}`,
		{ method: "DELETE" },
	);
	notifyNotificationsChanged();
	return result;
}

export async function markAllNotificationsRead(session: AuthSession) {
	const result = await catalogRequest<{ unreadCount: number }>(
		session,
		"/api/notifications/read-all",
		{ method: "POST" },
	);
	notifyNotificationsChanged();
	return result;
}

export function notifyNotificationsChanged() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event("zenstream:notifications-changed"));
}
