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
};

export type NotificationPage = {
	items: NotificationItem[];
	unreadCount: number;
	nextCursor: string | null;
};

export type PushConfig = {
	configured: boolean;
	publicKey: string | null;
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

export async function markAllNotificationsRead(session: AuthSession) {
	const result = await catalogRequest<{ unreadCount: number }>(
		session,
		"/api/notifications/read-all",
		{ method: "POST" },
	);
	notifyNotificationsChanged();
	return result;
}

export function getBrowserPushConfig(session: AuthSession) {
	return catalogRequest<PushConfig>(session, "/api/notifications/push-config");
}

export function browserPushSupported() {
	return (
		typeof window !== "undefined" &&
		"Notification" in window &&
		"serviceWorker" in navigator &&
		"PushManager" in window
	);
}

function decodeBase64Url(value: string) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	const binary = window.atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function registerBrowserPush(
	session: AuthSession,
	publicKey: string,
) {
	if (!browserPushSupported()) throw new Error("Browser push is unavailable.");
	const permission =
		Notification.permission === "granted"
			? "granted"
			: await Notification.requestPermission();
	if (permission !== "granted") throw new Error("Browser notifications are blocked.");
	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: decodeBase64Url(publicKey),
		}));
	await catalogRequest(session, "/api/notifications/push-subscription", {
		method: "PUT",
		body: JSON.stringify(subscription.toJSON()),
	});
	return subscription;
}

export async function unregisterBrowserPush(session: AuthSession) {
	if (!browserPushSupported()) return;
	const registration = await navigator.serviceWorker.ready;
	const subscription = await registration.pushManager.getSubscription();
	if (!subscription) return;
	await catalogRequest(
		session,
		`/api/notifications/push-subscription?endpoint=${encodeURIComponent(subscription.endpoint)}`,
		{ method: "DELETE" },
	);
	await subscription.unsubscribe();
}

export function notifyNotificationsChanged() {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event("zenstream:notifications-changed"));
}

