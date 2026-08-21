"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
	Bell,
	CheckCheck,
	ChevronDown,
	AlertTriangle,
	Film,
	Inbox,
	LoaderCircle,
	Mail,
	MailOpen,
	RefreshCw,
	Tv,
} from "lucide-react";
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
		<main className="min-h-screen px-4 pb-24 pt-24 sm:px-6 md:px-10 md:pb-8 md:pt-28">
			<div className="mx-auto max-w-3xl">
				<header className="mb-8 flex flex-col items-start gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="min-w-0">
						<h1 className="max-w-full break-words text-3xl font-black leading-none tracking-tight text-white md:text-4xl">
							{t("notificationInbox")}
						</h1>
					</div>
					<div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
						{unreadCount > 0 && (
							<button
								type="button"
								onClick={() => void markAllRead()}
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-9 sm:flex-none"
							>
								<CheckCheck className="h-3.5 w-3.5" />
								{t("markAllRead")}
							</button>
						)}
						<button
							type="button"
							aria-label={t("retry")}
							onClick={() => void load()}
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/40 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-9 sm:w-9"
						>
							<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
						</button>
					</div>
				</header>

				<section aria-label={t("notifications")}>
					{error && (
						<div
							aria-live="polite"
							className="mb-5 rounded-xl border border-red-400/20 bg-red-400/[.05] px-5 py-5"
						>
							<div className="flex items-start gap-4">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-300/15 bg-red-300/10 text-red-200">
									<AlertTriangle className="h-5 w-5" />
								</div>
								<div className="min-w-0">
									<p className="text-sm leading-6 text-red-100">{error}</p>
									<button
										type="button"
										onClick={() => void load()}
										className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-9"
									>
										<RefreshCw className="h-3.5 w-3.5" />
										{t("retry")}
									</button>
								</div>
							</div>
						</div>
					)}
					{!error && loading && items.length === 0 ? (
						<NotificationListSkeleton />
					) : !error && items.length === 0 ? (
						<div className="rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center">
							<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] text-white/25">
								<Inbox className="h-5 w-5" />
							</div>
							<h2 className="mt-5 text-lg font-semibold text-white/80">
								{t("notificationsEmpty")}
							</h2>
							<p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/30">
								{t("notificationsEmptyDescription")}
							</p>
						</div>
					) : items.length > 0 ? (
						<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
							{items.map((item) => (
								<NotificationRow
									key={item.id}
									item={item}
									locale={locale}
									onToggleRead={() => void toggleRead(item)}
								/>
							))}
						</div>
					) : null}
					{nextCursor && !loading && !error && (
						<button
							type="button"
							disabled={loadingMore}
							onClick={() => void load(nextCursor)}
							className="mx-auto mt-5 flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-semibold text-white/55 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-40 sm:min-h-9"
						>
							{loadingMore ? (
								<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
							) : (
								<ChevronDown className="h-3.5 w-3.5" />
							)}
							{loadingMore ? t("loadingMore") : t("loadMore")}
						</button>
					)}
				</section>
			</div>
		</main>
	);
}

function NotificationListSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
			{Array.from({ length: 4 }, (_, index) => (
				<div
					key={index}
					className="flex min-h-[88px] items-start gap-3 border-b border-white/[.07] p-4 last:border-b-0 sm:min-h-24 sm:gap-4 sm:px-5"
				>
					<div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-white/[.06]" />
					<div className="min-w-0 flex-1 space-y-2.5 pt-1">
						<div className="h-3.5 w-3/4 animate-pulse rounded-full bg-white/[.07]" />
						<div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[.045]" />
						<div className="h-2.5 w-24 animate-pulse rounded-full bg-white/[.035]" />
					</div>
					<div className="h-8 w-16 shrink-0 animate-pulse rounded-full bg-white/[.045]" />
				</div>
			))}
		</div>
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
	const Icon = item.kind === "new_movie" ? Film : Tv;
	const ActionIcon = item.readAt ? Mail : MailOpen;
	const actionLabel = t(item.readAt ? "markUnread" : "markRead");
	const formattedDate = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(item.createdAt));
	return (
		<article
			className={`group flex min-h-[88px] items-start gap-3 border-b border-white/[.07] border-l-2 p-4 transition last:border-b-0 sm:min-h-24 sm:gap-4 sm:px-5 ${item.readAt ? "border-l-transparent bg-transparent hover:bg-white/[.035]" : "border-l-violet-300 bg-violet-400/[.055] hover:bg-violet-400/[.09]"}`}
		>
			<div
				className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${item.readAt ? "border-white/10 bg-white/[.045] text-white/30" : "border-violet-300/20 bg-violet-300/10 text-violet-200"}`}
			>
				<Icon className="h-4 w-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
					<Link
						href={item.navigationTarget}
						onClick={() => {
							if (!item.readAt) onToggleRead();
						}}
						className={`min-w-0 text-sm font-semibold leading-6 transition ${item.readAt ? "text-white/70 hover:text-white" : "text-white hover:text-violet-200"}`}
					>
						{item.title}
					</Link>
					<time className="shrink-0 text-[10px] text-white/50 sm:pt-1">
						{formattedDate}
					</time>
				</div>
				{item.subtitle && (
					<p className="mt-1 text-xs leading-5 text-white/55">{item.subtitle}</p>
				)}
			</div>
			<button
				type="button"
				aria-label={actionLabel}
				title={actionLabel}
				onClick={onToggleRead}
				className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:font-semibold"
			>
				<ActionIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
				<span className="hidden sm:inline">{actionLabel}</span>
			</button>
		</article>
	);
}
