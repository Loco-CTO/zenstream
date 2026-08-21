"use client";

import Link from "next/link";
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type RefObject,
} from "react";
import {
	AlertTriangle,
	Inbox,
	LoaderCircle,
	Mail,
	MailOpen,
	MoreVertical,
	RefreshCw,
	Trash2,
} from "lucide-react";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import { catalogImage } from "@/lib/media-api";
import {
	deleteNotification,
	getNotifications,
	markAllNotificationsRead,
	setNotificationRead,
	type NotificationItem,
} from "@/lib/notifications";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";

type ProgressStarter = () => () => void;

export type NotificationFeed = {
	items: NotificationItem[];
	unreadCount: number;
	nextCursor: string | null;
	loading: boolean;
	loadingMore: boolean;
	loaded: boolean;
	error: string | null;
	refresh: () => Promise<void>;
	loadMore: () => Promise<void>;
	toggleRead: (item: NotificationItem) => Promise<void>;
	remove: (item: NotificationItem) => Promise<void>;
	markAllRead: () => Promise<void>;
};

function dedupeItems(items: NotificationItem[]) {
	const seen = new Set<string>();
	return items.filter((item) => {
		if (seen.has(item.id)) return false;
		seen.add(item.id);
		return true;
	});
}

export function useNotificationFeed(
	session: AuthSession | null,
	{ enabled = true, start }: { enabled?: boolean; start?: ProgressStarter } = {},
): NotificationFeed {
	const { t } = useI18n();
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const nextCursorRef = useRef<string | null>(null);
	const loadingRef = useRef(false);
	const loadingMoreRef = useRef(false);
	const generationRef = useRef(0);

	const refresh = useCallback(async () => {
		if (!session) return;
		const generation = ++generationRef.current;
		loadingRef.current = true;
		loadingMoreRef.current = false;
		nextCursorRef.current = null;
		setLoading(true);
		setLoadingMore(false);
		setError(null);
		const finish = start?.();
		try {
			const result = await getNotifications(session, 50);
			if (generation !== generationRef.current) return;
			setItems(dedupeItems(result.items));
			setUnreadCount(result.unreadCount);
			nextCursorRef.current = result.nextCursor;
			setNextCursor(result.nextCursor);
			setLoaded(true);
		} catch (nextError) {
			if (generation !== generationRef.current) return;
			setError(
				nextError instanceof Error
					? nextError.message
					: t("notificationsLoadFailed"),
			);
		} finally {
			if (generation === generationRef.current) {
				loadingRef.current = false;
				setLoading(false);
			}
			finish?.();
		}
	}, [session, start, t]);

	const loadMore = useCallback(async () => {
		if (
			!session ||
			!nextCursorRef.current ||
			loadingRef.current ||
			loadingMoreRef.current
		)
			return;
		const generation = generationRef.current;
		const cursor = nextCursorRef.current;
		loadingMoreRef.current = true;
		setLoadingMore(true);
		setError(null);
		const finish = start?.();
		try {
			const result = await getNotifications(session, 50, cursor);
			if (generation !== generationRef.current) return;
			setItems((current) => dedupeItems([...current, ...result.items]));
			setUnreadCount(result.unreadCount);
			nextCursorRef.current = result.nextCursor;
			setNextCursor(result.nextCursor);
		} catch (nextError) {
			if (generation !== generationRef.current) return;
			setError(
				nextError instanceof Error
					? nextError.message
					: t("notificationsLoadFailed"),
			);
		} finally {
			loadingMoreRef.current = false;
			if (generation === generationRef.current) setLoadingMore(false);
			finish?.();
		}
	}, [session, start, t]);

	useEffect(() => {
		if (!enabled || !session) return;
		const refreshTimer = window.setTimeout(() => {
			void refresh();
		}, 0);
		return () => window.clearTimeout(refreshTimer);
	}, [enabled, refresh, session]);

	const toggleRead = useCallback(
		async (item: NotificationItem) => {
			const nextRead = !item.readAt;
			setItems((current) =>
				current.map((value) =>
					value.id === item.id
						? {
								...value,
								readAt: nextRead ? new Date().toISOString() : null,
							}
						: value,
				),
			);
			setUnreadCount((current) => Math.max(0, current + (nextRead ? -1 : 1)));
			if (!session) return;
			try {
				await setNotificationRead(session, item.id, nextRead);
			} catch {
				setItems((current) =>
					current.map((value) =>
						value.id === item.id ? { ...value, readAt: item.readAt } : value,
					),
				);
				setUnreadCount((current) => Math.max(0, current + (nextRead ? 1 : -1)));
			}
		},
		[session],
	);

	const markAllRead = useCallback(async () => {
		if (!session) return;
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
			void refresh();
		}
	}, [refresh, session]);

	const remove = useCallback(
		async (item: NotificationItem) => {
			if (!session) return;
			const wasUnread = !item.readAt;
			setItems((current) => current.filter((value) => value.id !== item.id));
			if (wasUnread) {
				setUnreadCount((current) => Math.max(0, current - 1));
			}
			try {
				await deleteNotification(session, item.id);
			} catch {
				void refresh();
			}
		},
		[refresh, session],
	);

	return {
		items,
		unreadCount,
		nextCursor,
		loading,
		loadingMore,
		loaded,
		error,
		refresh,
		loadMore,
		toggleRead,
		remove,
		markAllRead,
	};
}

export function NotificationLoadMore({
	hasMore,
	loading,
	loadingMore,
	onLoadMore,
	rootRef,
}: {
	hasMore: boolean;
	loading: boolean;
	loadingMore: boolean;
	onLoadMore: () => void;
	rootRef?: RefObject<HTMLDivElement | null>;
}) {
	const { t } = useI18n();
	const sentinelRef = useRef<HTMLDivElement>(null);
	const canObserve =
		typeof window !== "undefined" && "IntersectionObserver" in window;

	useEffect(() => {
		if (!hasMore || loading || loadingMore || !sentinelRef.current || !canObserve)
			return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
			},
			{
				root: rootRef?.current ?? null,
				rootMargin: "0px 0px 144px",
			},
		);
		observer.observe(sentinelRef.current);
		return () => observer.disconnect();
	}, [canObserve, hasMore, loading, loadingMore, onLoadMore, rootRef]);

	if (!hasMore && !loadingMore) return null;
	return (
		<div ref={sentinelRef} className="flex min-h-12 items-center justify-center">
			{loadingMore ? (
				<div
					aria-live="polite"
					className="flex items-center gap-2 text-[10px] text-white/35"
				>
					<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
					{t("loadingMore")}
				</div>
			) : !canObserve ? (
				<button
					type="button"
					onClick={onLoadMore}
					className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold text-white/55 transition hover:border-white/25 hover:text-white"
				>
					{t("loadMore")}
				</button>
			) : null}
		</div>
	);
}

export function NotificationListSkeleton({
	compact = false,
}: {
	compact?: boolean;
}) {
	return (
		<div
			className={
				compact
					? "space-y-0"
					: "overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]"
			}
		>
			{Array.from({ length: compact ? 5 : 4 }, (_, index) => (
				<div
					key={index}
					className={`flex items-start gap-3 border-b border-white/[.07] last:border-b-0 ${compact ? "min-h-[76px] px-3 py-3" : "min-h-[88px] p-4 sm:min-h-24 sm:px-5"}`}
				>
					<div
						className={`${compact ? "h-9 w-16 rounded-lg" : "h-14 w-24 rounded-xl sm:h-16 sm:w-28"} shrink-0 animate-pulse bg-white/[.06]`}
					/>
					<div className="min-w-0 flex-1 space-y-2.5 pt-1">
						<div className="h-3.5 w-3/4 animate-pulse rounded-full bg-white/[.07]" />
						<div className="h-3 w-1/2 animate-pulse rounded-full bg-white/[.045]" />
						<div className="h-2.5 w-24 animate-pulse rounded-full bg-white/[.035]" />
					</div>
				</div>
			))}
		</div>
	);
}

export function NotificationErrorState({
	message,
	onRetry,
	compact = false,
}: {
	message: string;
	onRetry: () => void;
	compact?: boolean;
}) {
	const { t } = useI18n();
	return (
		<div
			role="alert"
			className={
				compact
					? "m-3 rounded-lg border border-red-400/20 bg-red-400/[.05] p-3"
					: "mb-5 rounded-xl border border-red-400/20 bg-red-400/[.05] px-5 py-5"
			}
		>
			<div className="flex items-start gap-3">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-300/15 bg-red-300/10 text-red-200">
					<AlertTriangle className="h-4 w-4" />
				</div>
				<div className="min-w-0">
					<p className="text-xs leading-5 text-red-100">{message}</p>
					<button
						type="button"
						onClick={onRetry}
						className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[10px] font-semibold text-black transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
					>
						<RefreshCw className="h-3 w-3" />
						{t("retry")}
					</button>
				</div>
			</div>
		</div>
	);
}

export function NotificationEmptyState({
	compact = false,
}: {
	compact?: boolean;
}) {
	const { t } = useI18n();
	return (
		<div
			className={
				compact
					? "px-4 py-12 text-center"
					: "rounded-xl border border-white/10 bg-white/[0.025] px-6 py-16 text-center"
			}
		>
			<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.045] text-white/25">
				<Inbox className="h-4 w-4" />
			</div>
			<h2 className="mt-4 text-sm font-semibold text-white/80">
				{t("notificationsEmpty")}
			</h2>
			<p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-white/30">
				{t("notificationsEmptyDescription")}
			</p>
		</div>
	);
}

export function NotificationRow({
	item,
	locale,
	onToggleRead,
	onRemove,
	onNavigate,
	compact = false,
}: {
	item: NotificationItem;
	locale: string;
	onToggleRead: () => void;
	onRemove: () => void;
	onNavigate?: () => void;
	compact?: boolean;
}) {
	const { t } = useI18n();
	const [actionsOpen, setActionsOpen] = useState(false);
	const actionsRef = useRef<HTMLDivElement>(null);
	const thumbnail = item.thumbnail?.url
		? catalogImage(item.thumbnail.url, item.thumbnail.blurHash)
		: null;
	const ActionIcon = item.readAt ? Mail : MailOpen;
	const actionLabel = t(item.readAt ? "markUnread" : "markRead");
	const parsedDate = new Date(item.createdAt);
	const formattedDate = Number.isNaN(parsedDate.getTime())
		? item.createdAt
		: new Intl.DateTimeFormat(locale, {
				dateStyle: compact ? "short" : "medium",
				timeStyle: "short",
			}).format(parsedDate);

	useEffect(() => {
		if (!actionsOpen) return;
		const close = (event: PointerEvent) => {
			if (!actionsRef.current?.contains(event.target as Node))
				setActionsOpen(false);
		};
		document.addEventListener("pointerdown", close);
		return () => document.removeEventListener("pointerdown", close);
	}, [actionsOpen]);

	return (
		<article
			className={`group flex items-start gap-2.5 border-b border-white/[.07] border-l-2 transition last:border-b-0 ${compact ? "min-h-[76px] px-3 py-3" : "min-h-[88px] gap-3 p-4 sm:min-h-24 sm:gap-4 sm:px-5"} ${item.readAt ? "border-l-transparent bg-transparent hover:bg-white/[.035]" : "border-l-violet-300 bg-violet-400/[.055] hover:bg-violet-400/[.09]"}`}
		>
			<div
				data-testid={`notification-thumbnail-${item.id}`}
				className={`relative mt-0.5 shrink-0 overflow-hidden border ${compact ? "h-9 w-16 rounded-lg" : "h-14 w-24 rounded-xl sm:h-16 sm:w-28"} ${item.readAt ? "border-white/10 bg-white/[.045]" : "border-violet-300/20 bg-violet-300/10"}`}
			>
				{thumbnail && (
					<BlurHashImage
						image={thumbnail}
						alt=""
						aria-hidden="true"
						className="h-full w-full object-cover"
					/>
				)}
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<Link
						href={item.navigationTarget}
						onClick={() => {
							if (!item.readAt) onToggleRead();
							onNavigate?.();
						}}
						className={`min-w-0 ${compact ? "line-clamp-2 text-xs leading-5" : "text-sm leading-6"} font-semibold transition ${item.readAt ? "text-white/70 hover:text-white" : "text-white hover:text-violet-200"}`}
					>
						{item.title}
					</Link>
					{!compact && (
						<time className="shrink-0 text-[10px] text-white/50 sm:pt-1">
							{formattedDate}
						</time>
					)}
				</div>
				{item.subtitle && (
					<p
						className={`mt-1 ${compact ? "line-clamp-1 text-[10px]" : "text-xs"} leading-5 text-white/55`}
					>
						{item.subtitle}
					</p>
				)}
				{compact && (
					<time className="mt-1 block text-[10px] text-white/35">
						{formattedDate}
					</time>
				)}
			</div>
			{compact ? (
				<div ref={actionsRef} className="relative shrink-0">
					<button
						type="button"
						aria-label={t("notificationActions")}
						aria-expanded={actionsOpen}
						onClick={() => setActionsOpen((value) => !value)}
						className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/[.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70"
					>
						<MoreVertical className="h-4 w-4" />
					</button>
					{actionsOpen && (
						<div
							role="menu"
							className="absolute right-0 top-9 z-10 min-w-32 overflow-hidden rounded-lg border border-white/10 bg-black/70 p-1 shadow-2xl shadow-black/50 backdrop-blur-xl"
						>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setActionsOpen(false);
									onToggleRead();
								}}
								className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-white/70 transition hover:bg-white/[.08] hover:text-white"
							>
								<ActionIcon className="h-3.5 w-3.5" />
								{actionLabel}
							</button>
							<button
								type="button"
								role="menuitem"
								onClick={() => {
									setActionsOpen(false);
									onRemove();
								}}
								className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[10px] text-red-200/75 transition hover:bg-red-400/[.08] hover:text-red-100"
							>
								<Trash2 className="h-3.5 w-3.5" />
								{t("removeNotification")}
							</button>
						</div>
					)}
				</div>
			) : (
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						aria-label={actionLabel}
						title={actionLabel}
						onClick={onToggleRead}
						className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 transition hover:bg-white/[.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:font-semibold"
					>
						<ActionIcon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
						<span className="hidden sm:inline">{actionLabel}</span>
					</button>
					<button
						type="button"
						aria-label={t("removeNotification")}
						title={t("removeNotification")}
						onClick={onRemove}
						className="flex h-11 w-11 items-center justify-center rounded-full text-red-200/60 transition hover:bg-red-400/[.08] hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[10px] sm:font-semibold"
					>
						<Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
						<span className="hidden sm:inline">{t("removeNotification")}</span>
					</button>
				</div>
			)}
		</article>
	);
}
