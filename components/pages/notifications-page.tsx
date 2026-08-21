"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import {
	getNotifications,
	markAllNotificationsRead,
	setNotificationRead,
	type NotificationItem,
} from "@/lib/notifications";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/components/status/progress-indicator";

export function NotificationsPage({ session }: { session: AuthSession }) {
	const { t, locale } = useI18n();
	const { start } = useProgress();
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(
		async (cursor?: string | null) => {
			const finish = start();
			if (cursor) setLoadingMore(true);
			else setLoading(true);
			setError(null);
			try {
				const result = await getNotifications(session, 50, cursor);
				setItems((current) =>
					cursor ? [...current, ...result.items] : result.items,
				);
				setUnreadCount(result.unreadCount);
				setNextCursor(result.nextCursor);
			} catch (nextError) {
				setError(
					nextError instanceof Error
						? nextError.message
						: t("notificationsLoadFailed"),
				);
			} finally {
				setLoading(false);
				setLoadingMore(false);
				finish();
			}
		},
		[session, start, t],
	);

	useEffect(() => {
		const timer = window.setTimeout(() => void load(), 0);
		return () => window.clearTimeout(timer);
	}, [load]);

	async function toggleRead(item: NotificationItem) {
		const nextRead = !item.readAt;
		setItems((current) =>
			current.map((value) =>
				value.id === item.id
					? { ...value, readAt: nextRead ? new Date().toISOString() : null }
					: value,
			),
		);
		setUnreadCount((current) => Math.max(0, current + (nextRead ? -1 : 1)));
		try {
			await setNotificationRead(session, item.id, nextRead);
		} catch {
			setItems((current) =>
				current.map((value) =>
					value.id === item.id ? { ...value, readAt: item.readAt } : value,
				),
			);
			setUnreadCount((current) => current + (nextRead ? 1 : -1));
		}
	}

	async function markAllRead() {
		setItems((current) =>
			current.map((item) => ({
				...item,
				readAt: item.readAt ?? new Date().toISOString(),
			})),
		);
		setUnreadCount(0);
		try {
			await markAllNotificationsRead(session);
		} catch {
			void load();
		}
	}

	return (
		<main className="min-h-screen px-4 pb-24 pt-24 md:px-12 md:pt-28">
			<div className="mx-auto max-w-3xl">
				<div className="mb-8 flex items-start justify-between gap-4">
					<div>
						<div className="mb-2 flex items-center gap-2 text-violet-300">
							<Bell className="h-4 w-4" />
							<span className="text-xs font-semibold uppercase tracking-[.14em]">
								{t("notifications")}
							</span>
						</div>
						<h1 className="text-3xl font-black tracking-tight text-white">
							{t("notificationInbox")}
						</h1>
						<p className="mt-2 text-sm text-white/40">
							{t("notificationInboxDescription")}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						{unreadCount > 0 && (
							<button
								type="button"
								onClick={() => void markAllRead()}
								className="flex items-center gap-2 rounded border border-white/10 px-3 py-2 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
							>
								<CheckCheck className="h-3.5 w-3.5" />
								{t("markAllRead")}
							</button>
						)}
						<button
							type="button"
							aria-label={t("retry")}
							onClick={() => void load()}
							className="rounded p-2 text-white/35 transition hover:bg-white/[.06] hover:text-white"
						>
							<RefreshCw className="h-4 w-4" />
						</button>
					</div>
				</div>

				{error ? (
					<div className="rounded-lg border border-red-400/20 bg-red-400/[.05] p-5 text-sm text-red-100">
						{error}
					</div>
				) : loading ? (
					<div className="py-20 text-center text-sm text-white/30">
						{t("loadingMore")}
					</div>
				) : items.length === 0 ? (
					<div className="flex flex-col items-center rounded-xl border border-white/[.08] bg-white/[.02] px-6 py-20 text-center">
						<Bell className="mb-4 h-8 w-8 text-white/15" />
						<p className="text-sm font-semibold text-white/60">
							{t("notificationsEmpty")}
						</p>
						<p className="mt-2 max-w-sm text-xs text-white/30">
							{t("notificationsEmptyDescription")}
						</p>
					</div>
				) : (
					<div className="overflow-hidden rounded-xl border border-white/[.08] bg-white/[.02]">
						{items.map((item) => (
							<NotificationRow
								key={item.id}
								item={item}
								locale={locale}
								onToggleRead={() => void toggleRead(item)}
							/>
						))}
					</div>
				)}
				{nextCursor && !loading && (
					<button
						type="button"
						disabled={loadingMore}
						onClick={() => void load(nextCursor)}
						className="mx-auto mt-5 block rounded border border-white/10 px-4 py-2 text-xs font-semibold text-white/55 transition hover:border-white/25 hover:text-white disabled:opacity-40"
					>
						{loadingMore ? t("loadingMore") : t("loadMore")}
					</button>
				)}
			</div>
		</main>
	);
}

function NotificationRow({
	item,
	locale,
	onToggleRead,
}: {
	item: NotificationItem;
	locale: string;
	onToggleRead: () => void;
}) {
	const { t } = useI18n();
	return (
		<div
			className={`flex items-start gap-3 border-b border-white/[.06] p-4 last:border-b-0 ${item.readAt ? "opacity-60" : "bg-violet-400/[.05]"}`}
		>
			<span
				className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-white/15" : "bg-violet-300"}`}
			/>
			<div className="min-w-0 flex-1">
				<Link
					href={item.navigationTarget}
					onClick={() => {
						if (!item.readAt) onToggleRead();
					}}
					className="block text-sm font-semibold text-white transition hover:text-violet-200"
				>
					{item.title}
				</Link>
				{item.subtitle && (
					<p className="mt-1 text-xs text-white/45">{item.subtitle}</p>
				)}
				<p className="mt-2 text-[10px] text-white/25">
					{new Intl.DateTimeFormat(locale, {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(new Date(item.createdAt))}
				</p>
			</div>
			<button
				type="button"
				aria-label={t(item.readAt ? "markUnread" : "markRead")}
				onClick={onToggleRead}
				className="shrink-0 rounded px-2 py-1 text-[10px] font-semibold text-white/35 transition hover:bg-white/[.07] hover:text-white"
			>
				{t(item.readAt ? "markUnread" : "markRead")}
			</button>
		</div>
	);
}
