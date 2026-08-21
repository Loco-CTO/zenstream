"use client";

import { CheckCheck, RefreshCw } from "lucide-react";
import {
	NotificationEmptyState,
	NotificationErrorState,
	NotificationListSkeleton,
	NotificationLoadMore,
	NotificationRow,
	useNotificationFeed,
} from "@/components/notifications/notification-feed";
import { useProgress } from "@/components/status/progress-indicator";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

export function NotificationsPage({ session }: { session: AuthSession }) {
	const { t, locale } = useI18n();
	const { start } = useProgress();
	const feed = useNotificationFeed(session, { start });

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
						{feed.unreadCount > 0 && (
							<button
								type="button"
								onClick={() => void feed.markAllRead()}
								className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3.5 text-xs font-semibold text-white/60 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:min-h-9 sm:flex-none"
							>
								<CheckCheck className="h-3.5 w-3.5" />
								{t("markAllRead")}
							</button>
						)}
						<button
							type="button"
							aria-label={t("retry")}
							onClick={() => void feed.refresh()}
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-white/40 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-9 sm:w-9"
						>
							<RefreshCw
								className={`h-3.5 w-3.5 ${feed.loading ? "animate-spin" : ""}`}
							/>
						</button>
					</div>
				</header>

				<section aria-label={t("notifications")}>
					{feed.error && (
						<NotificationErrorState
							message={feed.error}
							onRetry={() => void feed.refresh()}
						/>
					)}
					{!feed.error && feed.loading && feed.items.length === 0 ? (
						<NotificationListSkeleton />
					) : feed.items.length === 0 && !feed.error ? (
						<NotificationEmptyState />
					) : feed.items.length > 0 ? (
						<div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
							{feed.items.map((item) => (
								<NotificationRow
									key={item.id}
									item={item}
									locale={locale}
									onToggleRead={() => void feed.toggleRead(item)}
									onRemove={() => void feed.remove(item)}
								/>
							))}
						</div>
					) : null}
					{feed.items.length > 0 && (
						<NotificationLoadMore
							hasMore={Boolean(feed.nextCursor) && !feed.error}
							loading={feed.loading}
							loadingMore={feed.loadingMore}
							onLoadMore={() => void feed.loadMore()}
						/>
					)}
				</section>
			</div>
		</main>
	);
}
