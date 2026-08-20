"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	Film,
	RefreshCw,
	Tv,
} from "lucide-react";
import { getCalendar, type CalendarEvent } from "@/lib/calendar";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useProgress } from "@/components/status/progress-indicator";

type CalendarView = "week" | "month" | "day";

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

function eventDayKey(event: CalendarEvent) {
	return event.allDay ? event.eventDate : localKey(new Date(event.eventAt));
}

function rangeFor(view: CalendarView, anchor: Date): CalendarRange {
	if (view === "day") {
		const start = startOfDay(anchor);
		return { start, end: addDays(start, 1), days: [start] };
	}
	if (view === "month") {
		const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
		const start = startOfWeek(monthStart);
		const end = addDays(start, 42);
		return {
			start,
			end,
			days: Array.from({ length: 42 }, (_, index) => addDays(start, index)),
		};
	}
	const start = startOfWeek(anchor);
	return {
		start,
		end: addDays(start, 7),
		days: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
	};
}

function moveAnchor(anchor: Date, view: CalendarView, amount: number) {
	const result = new Date(anchor);
	if (view === "month") result.setMonth(result.getMonth() + amount);
	else result.setDate(result.getDate() + amount * (view === "week" ? 7 : 1));
	return result;
}

function formatDay(value: Date, locale: string, options: Intl.DateTimeFormatOptions) {
	return new Intl.DateTimeFormat(locale, options).format(value);
}

function eventColor(event: CalendarEvent) {
	let hash = 0;
	for (const character of `${event.libraryId}:${event.title || event.id}`) {
		hash = (hash * 31 + character.charCodeAt(0)) | 0;
	}
	return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

export function CalendarPage({ session }: { session: AuthSession }) {
	const { locale, t } = useI18n();
	const { start: startProgress } = useProgress();
	const [view, setView] = useState<CalendarView>("week");
	const [anchor, setAnchor] = useState(() => new Date());
	const [events, setEvents] = useState<CalendarEvent[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const range = useMemo(() => rangeFor(view, anchor), [anchor, view]);

	const load = useCallback(
		async (signal?: AbortSignal) => {
			const finish = startProgress();
			setLoading(true);
			setError(null);
			try {
				const response = await getCalendar(session, range.start, range.end, signal);
				if (signal?.aborted) return;
				setEvents(response.events || []);
				setSelectedId((current) =>
					current && response.events.some((event) => event.id === current)
						? current
						: response.events[0]?.id || null,
				);
			} catch (nextError) {
				if (!signal?.aborted) {
					setError(nextError instanceof Error ? nextError.message : t("calendarLoadFailed"));
				}
			} finally {
				if (!signal?.aborted) setLoading(false);
				finish();
			}
		},
		[range.end, range.start, session, startProgress, t],
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
		view === "month"
			? formatDay(anchor, locale, { month: "long", year: "numeric" })
			: view === "day"
				? formatDay(anchor, locale, { weekday: "long", month: "long", day: "numeric" })
				: `${formatDay(range.start, locale, { month: "short", day: "numeric" })} – ${formatDay(addDays(range.end, -1), locale, { month: "short", day: "numeric", year: "numeric" })}`;

	function resetToday() {
		setAnchor(new Date());
	}

	return (
		<main className="min-h-screen px-4 pb-28 pt-24 sm:px-6 md:px-10 md:pb-8">
			<div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
				<div>
					<div className="flex items-center gap-3 text-violet-300/80">
						<CalendarDays className="h-5 w-5" />
						<span className="text-xs font-semibold uppercase tracking-[0.22em]">{t("calendar")}</span>
					</div>
					<h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{rangeTitle}</h1>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button type="button" onClick={resetToday} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/[0.09]">{t("calendarToday")}</button>
					<div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
						<button type="button" aria-label={t("calendarPrevious")} onClick={() => setAnchor((current) => moveAnchor(current, view, -1))} className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
						<button type="button" aria-label={t("calendarNext")} onClick={() => setAnchor((current) => moveAnchor(current, view, 1))} className="flex h-8 w-8 items-center justify-center rounded-full text-white/55 hover:bg-white/10 hover:text-white"><ChevronRight className="h-4 w-4" /></button>
					</div>
					<div className="flex items-center rounded-full border border-white/10 bg-white/[0.04] p-1">
						{(["week", "month", "day"] as const).map((value) => (
							<button key={value} type="button" onClick={() => setView(value)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${view === value ? "bg-white text-black" : "text-white/50 hover:text-white"}`}>
								{value === "week" ? t("calendarWeek") : value === "month" ? t("calendarMonth") : t("calendarDay")}
							</button>
						))}
					</div>
				</div>
			</div>

			{error ? (
				<div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6 text-sm text-red-100">
					<div className="flex items-center justify-between gap-4">
						<span>{error}</span>
						<button type="button" onClick={() => void load()} className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/75 hover:bg-white/10"><RefreshCw className="h-3.5 w-3.5" />{t("retry")}</button>
					</div>
				</div>
			) : (
				<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
					<div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl shadow-black/20">
						{view === "day" ? (
							<DayView day={range.days[0]} events={eventsByDay.get(localKey(range.days[0])) || []} locale={locale} onSelect={setSelectedId} t={t} />
						) : (
							<GridView view={view} days={range.days} anchor={anchor} eventsByDay={eventsByDay} locale={locale} onSelect={setSelectedId} t={t} />
						)}
						{loading && <div className="border-t border-white/10 px-4 py-2 text-xs text-white/35">Loading…</div>}
					</div>
					<DetailPanel event={selected} locale={locale} t={t} />
				</div>
			)}
		</main>
	);
}

function GridView({
	view,
	days,
	anchor,
	eventsByDay,
	locale,
	onSelect,
	t,
}: {
	view: CalendarView;
	days: Date[];
	anchor: Date;
	eventsByDay: Map<string, CalendarEvent[]>;
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
}) {
	const weekdays = days.slice(0, 7);
	return (
		<div className={`grid ${view === "month" ? "grid-cols-7" : "grid-cols-7"}`}>
			{weekdays.map((day) => (
				<div key={day.getDay()} className="border-b border-white/10 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/35 sm:px-3">
					<span className="sm:hidden">{formatDay(day, locale, { weekday: "narrow" })}</span>
					<span className="hidden sm:inline">{formatDay(day, locale, { weekday: "short" })}</span>
				</div>
			))}
			{days.map((day) => {
				const dayEvents = eventsByDay.get(localKey(day)) || [];
				const muted = view === "month" && day.getMonth() !== anchor.getMonth();
				return (
					<div key={localKey(day)} className={`min-h-[118px] border-b border-r border-white/[0.07] p-1.5 sm:min-h-[150px] sm:p-2 ${muted ? "bg-white/[0.012] opacity-45" : ""}`}>
						<div className={`mb-1 flex h-6 items-center justify-center text-xs font-semibold ${localKey(day) === localKey(new Date()) ? "mx-auto w-6 rounded-full bg-violet-500 text-white" : "text-white/45"}`}>{day.getDate()}</div>
						<div className="space-y-1">
							{dayEvents.map((event) => <EventBlock key={event.id} event={event} locale={locale} onSelect={onSelect} t={t} compact={view === "month"} />)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

function DayView({
	day,
	events,
	locale,
	onSelect,
	t,
}: {
	day: Date;
	events: CalendarEvent[];
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
}) {
	return (
		<div>
			<div className="border-b border-white/10 px-5 py-4">
				<p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300/80">{formatDay(day, locale, { weekday: "long" })}</p>
				<p className="mt-1 text-xl font-bold text-white">{formatDay(day, locale, { month: "long", day: "numeric", year: "numeric" })}</p>
			</div>
			{events.length ? <div className="divide-y divide-white/[0.07]">{events.map((event) => <EventRow key={event.id} event={event} locale={locale} onSelect={onSelect} t={t} />)}</div> : <EmptyDay t={t} />}
		</div>
	);
}

function EventBlock({
	event,
	locale,
	onSelect,
	t,
	compact,
}: {
	event: CalendarEvent;
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
	compact?: boolean;
}) {
	const title = event.title || (event.kind === "movie" ? t("calendarMovie") : t("calendarEpisode"));
	return (
		<button type="button" onClick={() => onSelect(event.id)} className="block w-full overflow-hidden rounded-md px-2 py-1.5 text-left text-white shadow-lg transition hover:brightness-125" style={{ backgroundColor: eventColor(event) }}>
			<div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/65">
				{event.kind === "movie" ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
				{event.allDay ? t("calendarAllDay") : formatDay(new Date(event.eventAt), locale, { hour: "numeric", minute: "2-digit" })}
			</div>
			<p className="mt-0.5 truncate text-xs font-semibold">{event.seriesTitle && !compact ? `${event.seriesTitle} · ` : ""}{title}</p>
			{!compact && event.kind === "episode" && event.seasonNumber != null && event.episodeNumber != null && <p className="mt-0.5 text-[10px] text-white/65">S{event.seasonNumber} E{event.episodeNumber}</p>}
		</button>
	);
}

function EventRow({
	event,
	locale,
	onSelect,
	t,
}: {
	event: CalendarEvent;
	locale: string;
	onSelect: (id: string) => void;
	t: Translator;
}) {
	const title = event.title || (event.kind === "movie" ? t("calendarMovie") : t("calendarEpisode"));
	return (
		<button type="button" onClick={() => onSelect(event.id)} className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04]">
			<div className="w-20 shrink-0 text-xs font-semibold text-white/45">{event.allDay ? t("calendarAllDay") : formatDay(new Date(event.eventAt), locale, { hour: "numeric", minute: "2-digit" })}</div>
			<div className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: eventColor(event) }} />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-bold text-white">{event.seriesTitle ? `${event.seriesTitle} · ` : ""}{title}</p>
				<p className="mt-1 text-xs text-white/40">{event.kind === "episode" && event.seasonNumber != null && event.episodeNumber != null ? `S${event.seasonNumber} E${event.episodeNumber}` : t("calendarRelease")} · {event.libraryName}</p>
			</div>
		</button>
	);
}

function EmptyDay({ t }: { t: Translator }) {
	return <div className="px-5 py-14 text-center text-sm text-white/35">{t("calendarEmpty")}</div>;
}

function DetailPanel({
	event,
	locale,
	t,
}: {
	event: CalendarEvent | null;
	locale: string;
	t: Translator;
}) {
	if (!event) return <div className="hidden rounded-2xl border border-white/10 bg-black/20 p-6 lg:block" />;
	const title = event.title || (event.kind === "movie" ? t("calendarMovie") : t("calendarEpisode"));
	const href = event.catalogItemId
		? event.kind === "episode" && event.catalogSeriesId
			? `/show/${event.catalogSeriesId}/episode/${event.catalogItemId}`
			: `/show/${event.catalogItemId}`
		: null;
	return (
		<aside className="rounded-2xl border border-white/10 bg-black/20 p-5 lg:sticky lg:top-24 lg:self-start">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-violet-300/75"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: eventColor(event) }} />{event.kind === "movie" ? t("calendarMovie") : t("calendarEpisode")}</div>
				<span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${event.state === "existing" ? "bg-emerald-400/10 text-emerald-200" : "bg-white/8 text-white/55"}`}>{event.state === "existing" ? t("calendarCatalog") : t("calendarFuture")}</span>
			</div>
			<h2 className="mt-5 text-xl font-bold leading-tight text-white">{title}</h2>
			{event.seriesTitle && <p className="mt-2 text-sm text-white/55">{event.seriesTitle}</p>}
			<div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
				<div className="flex items-start gap-3 text-white/65"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-white/35" /><span>{event.allDay ? t("calendarAllDay") : formatDay(new Date(event.eventAt), locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span></div>
				{event.kind === "episode" && event.seasonNumber != null && event.episodeNumber != null && <div className="flex items-center gap-3 text-white/65"><Tv className="h-4 w-4 text-white/35" /><span>S{event.seasonNumber} E{event.episodeNumber}</span></div>}
				<div className="flex items-center gap-3 text-white/65"><CalendarDays className="h-4 w-4 text-white/35" /><span>{event.libraryName}</span></div>
			</div>
			{href && <Link href={href} className="mt-7 flex w-full items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-violet-200">{t("info")}</Link>}
		</aside>
	);
}
