import type { AuthSession } from "@/lib/session";
import { catalogRequest } from "@/lib/catalog";

export type CalendarEvent = {
	id: string;
	provider: "sonarr" | "radarr" | "catalog" | string;
	libraryId: string;
	libraryName: string;
	kind: "episode" | "movie" | "series" | string;
	releaseType: string;
	eventAt: string;
	eventDate: string;
	allDay: boolean;
	seasonNumber?: number | null;
	episodeNumber?: number | null;
	hasFile: boolean;
	monitored: boolean;
	state: "future" | "existing" | string;
	title?: string | null;
	seriesTitle?: string | null;
	catalogItemId?: string | null;
	catalogSeriesId?: string | null;
	metadataStatus: "future" | "catalog" | "pending" | string;
};

export type CalendarResponse = {
	start: string;
	end: string;
	events: CalendarEvent[];
};

export function getCalendar(
	session: AuthSession,
	start: Date,
	end: Date,
	signal?: AbortSignal,
) {
	const params = new URLSearchParams({
		start: start.toISOString(),
		end: end.toISOString(),
	});
	return catalogRequest<CalendarResponse>(
		session,
		`/api/calendar?${params.toString()}`,
		{ signal },
	);
}
