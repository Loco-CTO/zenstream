"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	RefreshCw,
	X,
} from "lucide-react";
import { getCalendar, type CalendarEvent } from "@/lib/calendar";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useProgress } from "@/components/status/progress-indicator";

type CalendarView = "week" | "day";

type CalendarRange = {
	start: Date;
	end: Date;
	days: Date[];
};

type Translator = (
	key: TranslationKey,
	values?: Record<string, string | number>,
) => string;

const EVENT_COLORS = [
	"#6d5dfc",
	"#1aa7a1",
	"#d17b35",
	"#b14e9b",
	"#3b82b6",
	"#8e7d36",
];

const MIN_WEEK_OFFSET = -1;
const MAX_WEEK_OFFSET = 16;

function startOfDay(value: Date) {
	const result = new Date(value);
	result.setHours(0, 0, 0, 0);
	return result;
}

function startOfWeek(value: Date) {
	const result = startOfDay(value);
	result.setDate(result.getDate() - result.getDay());
	return result;
}

function addDays(value: Date, days: number) {
	const result = new Date(value);
	result.setDate(result.getDate() + days);
	return result;
}

function localKey(value: Date) {
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function compareDates(left: Date, right: Date) {
	return startOfDay(left).getTime() - startOfDay(right).getTime();
}

function calendarBounds(now = new Date()) {
	const currentWeek = startOfWeek(now);
	const minimum = addDays(currentWeek, MIN_WEEK_OFFSET * 7);
	const maximumWeek = addDays(currentWeek, MAX_WEEK_OFFSET * 7);
	const maximum = addDays(maximumWeek, 6);
	return {
		minimum,
		maximum,
		maximumWeek,
	};
}

function clampAnchor(value: Date, view: CalendarView, now = new Date()) {
	const bounds = calendarBounds(now);
	const candidate = view === "week" ? startOfWeek(value) : startOfDay(value);
	const maximum = view === "week" ? bounds.maximumWeek : bounds.maximum;
	if (compareDates(candidate, bounds.minimum) < 0) return bounds.minimum;
	if (compareDates(candidate, maximum) > 0) return maximum;
	return candidate;
}

function navigationState(view: CalendarView, anchor: Date, now = new Date()) {
	const bounds = calendarBounds(now);
	const candidate = view === "week" ? startOfWeek(anchor) : startOfDay(anchor);
	const maximum = view === "week" ? bounds.maximumWeek : bounds.maximum;
	return {
		atStart: compareDates(candidate, bounds.minimum) <= 0,
		atEnd: compareDates(candidate, maximum) >= 0,
	};
}

function eventDayKey(event: CalendarEvent) {
	return event.allDay ? event.eventDate : localKey(new Date(event.eventAt));
}

function rangeFor(view: CalendarView, anchor: Date): CalendarRange {
	if (view === "day") {
		const start = startOfDay(anchor);
		return { start, end: addDays(start, 1), days: [start] };
	}
	const start = startOfWeek(anchor);
	return {
		start,
		end: addDays(start, 7),
		days: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
	};
}

function moveAnchor(anchor: Date, view: CalendarView, amount: number) {
	const next = addDays(anchor, amount * (view === "week" ? 7 : 1));
	return clampAnchor(next, view);
}

function formatDay(
	value: Date,
	locale: string,
	options: Intl.DateTimeFormatOptions,
) {
	return new Intl.DateTimeFormat(locale, options).format(value);
}

function eventColor(event: CalendarEvent) {
	let hash = 0;
	for (const character of `${event.libraryId}:${event.seriesTitle || event.title || event.id}`) {
		hash = (hash * 31 + character.charCodeAt(0)) | 0;
	}
	return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

function formatEventTime(
	event: CalendarEvent,
	locale: string,
	allDayLabel: string,
) {
	if (event.allDay) return allDayLabel;
	return formatDay(new Date(event.eventAt), locale, {
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
}

function episodePosition(event: CalendarEvent) {
	if (event.kind !== "episode") return null;
	if (event.episodeNumber == null) return null;
	const episode = String(event.episodeNumber).padStart(2, "0");
	if (event.seasonNumber == null) return `E${episode}`;
	return `S${String(event.seasonNumber).padStart(2, "0")}E${episode}`;
}

function eventTitle(event: CalendarEvent, t: Translator) {
	return (
		event.title ||
		(event.kind === "movie"
			? t("calendarMovie")
			: episodePosition(event) || t("calendarEpisode"))
	);
}

export function CalendarPage({ session }: { session: AuthSession }) {
	const { locale, t } = useI18n();
	const { start: startProgress } = useProgress();
	const translatorRef = useRef(t);
	const [view, setView] = useState<CalendarView>("week");
	const [anchor, setAnchor] = useState(() => new Date());
	const [events, setEvents] = useState<CalendarEvent[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const range = useMemo(() => rangeFor(view, anchor), [anchor, view]);
	const navigation = useMemo(
		() => navigationState(view, anchor),
		[anchor, view],
	);

	useEffect(() => {
		translatorRef.current = t;
	}, [t]);

	const load = useCallback(
		async (signal?: AbortSignal) => {
			const finish = startProgress();
			setLoading(true);
			setError(null);
			try {
				const response = await getCalendar(session, range.start, range.end, signal);
				if (signal?.aborted) return;
				const nextEvents = response.events || [];
				setEvents(nextEvents);
				setSelectedId((current) =>
					current && nextEvents.some((event) => event.id === current)
						? current
						: null,
				);
			} catch (nextError) {
				if (!signal?.aborted) {
					setError(
						nextError instanceof Error
							? nextError.message
							: translatorRef.current("calendarLoadFailed"),
					);
				}
			} finally {
				if (!signal?.aborted) setLoading(false);
				finish();
			}
		},
		[range.end, range.start, session, startProgress],
	);

	useEffect(() => {
		const controller = new AbortController();
		// The data request owns this screen's loading state.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void load(controller.signal);
		return () => controller.abort();
	}, [load]);

	const eventsByDay = useMemo(() => {
		const grouped = new Map<string, CalendarEvent[]>();
		for (const event of events) {
			const key = eventDayKey(event);
			const current = grouped.get(key) || [];
			current.push(event);
			grouped.set(key, current);
		}
		for (const value of grouped.values()) {
			value.sort((left, right) => left.eventAt.localeCompare(right.eventAt));
		}
		return grouped;
	}, [events]);

	const selected = events.find((event) => event.id === selectedId) || null;
	const rangeTitle =
		view === "day"
			? formatDay(anchor, locale, {
					weekday: "long",
					month: "long",
					day: "numeric",
					year: "numeric",
				})
			: `${formatDay(range.start, locale, { month: "short", day: "numeric" })} – ${formatDay(addDays(range.end, -1), locale, { month: "short", day: "numeric" })}, ${addDays(range.end, -1).getFullYear()}`;

	function resetToday() {
		setAnchor(clampAnchor(new Date(), view));
	}

	function toggleSelection(id: string) {
		setSelectedId((current) => (current === id ? null : id));
	}

	return (
		<main className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--c-page)] pb-[calc(4rem+env(safe-area-inset-bottom))] pt-20 md:pb-0">
			<CalendarToolbar
				view={view}
				rangeTitle={rangeTitle}
				onToday={resetToday}
				onPrevious={() => setAnchor((current) => moveAnchor(current, view, -1))}
				onNext={() => setAnchor((current) => moveAnchor(current, view, 1))}
				disablePrevious={navigation.atStart}
				disableNext={navigation.atEnd}
				onViewChange={(nextView) => {
					setView(nextView);
					setAnchor((current) => clampAnchor(current, nextView));
					setSelectedId(null);
				}}
				t={t}
			/>

			{error ? (
				<div className="flex min-h-0 flex-1 items-center justify-center p-6">
					<div className="w-full max-w-xl rounded-lg border border-red-400/20 bg-red-400/[0.05] p-5 text-sm text-red-100">
						<div className="flex items-center justify-between gap-4">
							<span>{error}</span>
							<button
								type="button"
								onClick={() => void load()}
								className="flex shrink-0 items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
							>
								<RefreshCw className="h-3.5 w-3.5" />
								{t("retry")}
							</button>
						</div>
					</div>
				</div>
			) : (
				<div className="relative flex min-h-0 flex-1 flex-col">
					{view === "day" ? (
						<DayView
							events={eventsByDay.get(localKey(range.days[0])) || []}
							locale={locale}
							onSelect={toggleSelection}
							t={t}
						/>
					) : (
						<CalendarGrid
								days={range.days}
								eventsByDay={eventsByDay}
								locale={locale}
								onSelect={toggleSelection}
							t={t}
						/>
					)}
					{selected && (
						<SelectionPanel
							event={selected}
							locale={locale}
							onClose={() => setSelectedId(null)}
							t={t}
						/>
					)}
					{loading && (
						<div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/25">
							Loading…
						</div>
					)}
				</div>
			)}
		</main>
	);
}

function CalendarToolbar({
	view,
	rangeTitle,
	onToday,
	onPrevious,
	onNext,
	disablePrevious,
	disableNext,
	onViewChange,
	t,
}: {
	view: CalendarView;
	rangeTitle: string;
	onToday: () => void;
	onPrevious: () => void;
	onNext: () => void;
	disablePrevious: boolean;
	disableNext: boolean;
	onViewChange: (view: CalendarView) => void;
	t: Translator;
}) {
	return (
		<div className="flex h-11 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[var(--c-nav-from)] px-4 md:px-7">
			<button
				type="button"
				onClick={onToday}
				className="rounded border border-white/[0.12] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition hover:border-white/25 hover:text-white"
			>
				{t("calendarToday")}
			</button>
			<div className="flex items-center">
				<button
					type="button"
					aria-label={t("calendarPrevious")}
					onClick={onPrevious}
					disabled={disablePrevious}
					className="flex h-7 w-7 items-center justify-center text-white/30 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/10 disabled:hover:text-white/10"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<button
					type="button"
					aria-label={t("calendarNext")}
					onClick={onNext}
					disabled={disableNext}
					className="flex h-7 w-7 items-center justify-center text-white/30 transition hover:text-white disabled:cursor-not-allowed disabled:text-white/10 disabled:hover:text-white/10"
				>
					<ChevronRight className="h-4 w-4" />
				</button>
			</div>
			<span className="min-w-0 truncate text-sm font-semibold text-white/65">
				{rangeTitle}
			</span>
			<div className="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02] p-0.5">
				{(["week", "day"] as const).map((value) => (
					<button
						key={value}
						type="button"
						onClick={() => onViewChange(value)}
						className={`rounded-md px-3 py-1 text-[11px] font-semibold transition ${view === value ? "bg-white/[0.12] text-white" : "text-white/30 hover:text-white/60"}`}
					>
						{value === "week" ? t("calendarWeek") : t("calendarDay")}
					</button>
				))}
			</div>
		</div>
	);
}

function CalendarGrid({
	days,
	eventsByDay,
	locale,
	onSelect,
	t,
}: {
	days: Date[];
	eventsByDay: Map<string, CalendarEvent[]>;
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
}) {
	const headerDays = days.slice(0, 7);
	const todayKey = localKey(new Date());

	return (
		<div
			className="min-h-0 flex-1 overflow-auto"
			style={{ scrollbarWidth: "thin" }}
		>
			<div className="min-w-[700px]">
				<div className="sticky top-0 z-10 grid grid-cols-7 border-b border-white/[0.06] bg-[var(--c-page)]">
					{headerDays.map((day) => {
						const isToday = localKey(day) === todayKey;
						return (
							<div
								key={localKey(day)}
								className={`border-r border-white/[0.05] px-3 py-2.5 last:border-0 ${isToday ? "bg-violet-500/[0.08]" : ""}`}
							>
								<span
									className={`text-[10px] font-semibold uppercase tracking-widest ${isToday ? "text-violet-400" : "text-white/25"}`}
								>
									{formatDay(day, locale, { weekday: "short" })}
								</span>
								<span
									className={`ml-1.5 text-sm font-black ${isToday ? "text-violet-300" : "text-white/50"}`}
								>
									{day.getDate()}
								</span>
							</div>
						);
					})}
				</div>

				<div
					className="grid grid-cols-7 divide-x divide-white/[0.05]"
					style={{ minHeight: "calc(100dvh - 8.125rem)" }}
				>
					{days.map((day) => {
						const isToday = localKey(day) === todayKey;
						return (
							<div
								key={localKey(day)}
								className={`flex min-w-0 flex-col gap-1 p-1 ${isToday ? "bg-violet-500/[0.04]" : ""}`}
							>
								{(eventsByDay.get(localKey(day)) || []).map((event) => (
									<EventBlock
										key={event.id}
										event={event}
										locale={locale}
										onSelect={onSelect}
										t={t}
									/>
								))}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function DayView({
	events,
	locale,
	onSelect,
	t,
}: {
	events: CalendarEvent[];
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
}) {
	return (
		<div
			className="min-h-0 flex-1 overflow-auto px-4 py-6 md:px-10"
			style={{ scrollbarWidth: "thin" }}
		>
			{events.length ? (
				<div className="max-w-xl space-y-1.5">
					{events.map((event) => (
						<EventBlock
							key={event.id}
							event={event}
							locale={locale}
							onSelect={onSelect}
							t={t}
						/>
					))}
				</div>
			) : (
				<div className="flex h-64 flex-col items-center justify-center text-center">
					<CalendarDays className="mb-3 h-8 w-8 text-white/10" />
					<p className="text-sm text-white/25">{t("calendarEmpty")}</p>
				</div>
			)}
		</div>
	);
}

function EventBlock({
	event,
	locale,
	onSelect,
	t,
	compact = false,
}: {
	event: CalendarEvent;
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
	compact?: boolean;
}) {
	const color = eventColor(event);
	const title = eventTitle(event, t);
	const position = episodePosition(event);
	const primaryTitle = event.seriesTitle || title;
	const secondaryTitle = event.seriesTitle
		? event.title || position
		: event.kind === "movie"
			? event.releaseType || t("calendarMovie")
			: event.title
				? position
				: null;
	const episodeLabel =
		event.kind === "episode"
			? position || t("calendarEpisode")
			: t("calendarRelease");

	return (
		<button
			type="button"
			onClick={() => onSelect(event.id)}
			className={`block w-full shrink-0 overflow-hidden rounded-[4px] text-left transition hover:brightness-125 ${compact ? "px-1.5 py-0.5" : "px-2 py-1.5"}`}
			style={{
				backgroundColor: `${color}20`,
				borderLeft: `2.5px solid ${color}`,
			}}
		>
			<p
				className="truncate font-bold text-[12px] leading-tight"
				style={{ color }}
			>
				{primaryTitle}
			</p>
			{!compact && secondaryTitle && (
				<p className="mt-0.5 truncate text-[11px] leading-snug text-white/55">
					{secondaryTitle}
				</p>
			)}
			{!compact && (
				<p className="mt-0.5 truncate text-[10px] tabular-nums text-white/28">
					{formatEventTime(event, locale, t("calendarAllDay"))} · {episodeLabel}
				</p>
			)}
		</button>
	);
}

function SelectionPanel({
	event,
	locale,
	onClose,
	t,
}: {
	event: CalendarEvent;
	locale: string;
	onClose: () => void;
	t: Translator;
}) {
	const color = eventColor(event);
	const title = eventTitle(event, t);
	const position = episodePosition(event);
	const href = event.catalogItemId
		? event.kind === "episode" && event.catalogSeriesId
			? `/show/${event.catalogSeriesId}/episode/${event.catalogItemId}`
			: `/show/${event.catalogItemId}`
		: null;

	return (
		<div
			className="pointer-events-auto absolute inset-x-4 bottom-3 z-20 overflow-hidden rounded-lg border border-white/[0.08] border-l-[3px] bg-[var(--c-page)] shadow-2xl md:inset-x-8"
			style={{ borderLeftColor: color }}
		>
			<div className="flex items-start gap-4 p-4">
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-white">
						{event.seriesTitle ? `${event.seriesTitle} · ` : ""}
						{title}
					</p>
					<p className="mt-0.5 text-xs text-white/40">
						{position ? `${position} · ` : ""}
						{formatDay(new Date(event.eventAt), locale, {
							weekday: "long",
							month: "long",
							day: "numeric",
						})}
					</p>
					<p className="mt-1 text-[11px] tabular-nums text-white/25">
						{formatEventTime(event, locale, t("calendarAllDay"))} ·{" "}
						{event.libraryName}
					</p>
				</div>
				<div className="flex shrink-0 items-start gap-2">
					<span className="hidden rounded border border-white/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 sm:inline">
						{event.state === "existing" ? t("calendarCatalog") : t("calendarFuture")}
					</span>
					{href && (
						<Link
							href={href}
							className="rounded border border-white/[0.1] px-3 py-1.5 text-[11px] font-semibold text-white/60 transition hover:border-white/25 hover:text-white"
						>
							{t("info")}
						</Link>
					)}
					<button
						type="button"
						aria-label={t("close")}
						onClick={onClose}
						className="rounded p-1 text-white/40 transition hover:bg-white/[0.08] hover:text-white"
					>
						<X className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	);
}
