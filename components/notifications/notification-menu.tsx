"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import {
	NotificationEmptyState,
	NotificationErrorState,
	NotificationListSkeleton,
	NotificationLoadMore,
	NotificationRow,
	useNotificationFeed,
} from "@/components/notifications/notification-feed";
import { useI18n } from "@/lib/i18n";
import { getNotificationSummary } from "@/lib/notifications";
import type { AuthSession } from "@/lib/session";

export function NotificationMenu({
	displayPath,
	session,
}: {
	displayPath: string | null;
	session?: AuthSession;
}) {
	const { t, locale } = useI18n();
	const [open, setOpen] = useState(false);
	const [summaryUnreadCount, setSummaryUnreadCount] = useState(0);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const feed = useNotificationFeed(session ?? null, { enabled: open });

	useEffect(() => {
		if (!session) return;
		let active = true;
		const refresh = () => {
			void getNotificationSummary(session)
				.then((result) => {
					if (active) setSummaryUnreadCount(result.unreadCount);
				})
				.catch(() => undefined);
		};
		refresh();
		window.addEventListener("zenstream:notifications-changed", refresh);
		return () => {
			active = false;
			window.removeEventListener("zenstream:notifications-changed", refresh);
		};
	}, [session]);

	useEffect(() => {
		if (!open) return;
		const closeOnOutsideClick = (event: PointerEvent) => {
			const target = event.target as Node;
			if (
				panelRef.current?.contains(target) ||
				triggerRef.current?.contains(target)
			)
				return;
			setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsideClick);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	const badgeCount = open && feed.loaded ? feed.unreadCount : summaryUnreadCount;
	const badge = badgeCount > 99 ? "99+" : badgeCount;

	if (!session) {
		return (
			<Link
				href="/notifications"
				aria-label={t("notifications")}
				className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white ${displayPath === "/notifications" ? "text-white" : ""}`}
			>
				<Bell className="h-[22px] w-[22px]" />
			</Link>
		);
	}

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				aria-label={t("notifications")}
				aria-expanded={open}
				aria-controls={open ? "notification-menu" : undefined}
				onClick={() => setOpen((value) => !value)}
				className={`relative flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white ${displayPath === "/notifications" || open ? "text-white" : ""}`}
			>
				<Bell className="h-[22px] w-[22px]" />
				{summaryUnreadCount > 0 && (
					<span className="absolute right-2 top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-400 px-0.5 text-[9px] font-bold leading-none text-black">
						{badge}
					</span>
				)}
			</button>
			{open && (
				<div
					id="notification-menu"
					ref={panelRef}
					role="dialog"
					aria-modal="false"
					aria-labelledby="notification-menu-title"
					data-testid="notification-popup"
					className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-[90] flex max-h-[calc(100dvh-5rem)] w-auto max-w-none flex-col overflow-hidden rounded-xl border border-white/10 bg-black/35 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-[calc(100dvh-5rem)] md:w-[22rem] md:max-w-[calc(100vw-2rem)]"
				>
					<div className="flex shrink-0 items-center gap-2 border-b border-white/[0.08] px-3 pb-3 pt-2">
						<div className="min-w-0 flex-1">
							<p
								id="notification-menu-title"
								className="truncate text-sm font-semibold tracking-tight text-white"
							>
								{t("notifications")}
							</p>
							{summaryUnreadCount > 0 && (
								<p className="mt-0.5 text-[10px] text-white/40">
									{summaryUnreadCount} {t("unreadNotifications")}
								</p>
							)}
						</div>
						<div className="flex items-center gap-1">
							{feed.unreadCount > 0 && (
								<button
									type="button"
									aria-label={t("markAllRead")}
									onClick={() => void feed.markAllRead()}
									className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
								>
									<CheckCheck className="h-4 w-4" />
								</button>
							)}
							<button
								type="button"
								aria-label={t("close")}
								onClick={() => {
									setOpen(false);
									triggerRef.current?.focus();
								}}
								className="flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
					<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
						{feed.error && (
							<NotificationErrorState
								message={feed.error}
								onRetry={() => void feed.refresh()}
								compact
							/>
						)}
						{feed.loading && feed.items.length === 0 ? (
							<NotificationListSkeleton compact />
						) : !feed.error && feed.items.length === 0 ? (
							<NotificationEmptyState compact />
						) : (
							feed.items.map((item) => (
								<NotificationRow
									key={item.id}
									item={item}
									locale={locale}
									compact
									onToggleRead={() => void feed.toggleRead(item)}
									onNavigate={() => setOpen(false)}
								/>
							))
						)}
						<NotificationLoadMore
							hasMore={Boolean(feed.nextCursor) && !feed.error}
							loading={feed.loading}
							loadingMore={feed.loadingMore}
							onLoadMore={() => void feed.loadMore()}
							rootRef={scrollRef}
						/>
					</div>
					<div className="shrink-0 border-t border-white/[0.08] px-3 py-2.5">
						<Link
							href="/notifications"
							onClick={() => setOpen(false)}
							className="flex w-full items-center justify-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
						>
							{t("viewAllNotifications")}
						</Link>
					</div>
				</div>
			)}
		</div>
	);
}
