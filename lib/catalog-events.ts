import { catalogRequest, orchestratorBaseUrl } from "@/lib/catalog";
import { clearMediaClientCache } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

type CatalogEvent = {
	type?: string;
	generation?: number;
	libraryId?: string;
	rootEntityId?: string | null;
	libraries?: Array<{ id?: string; catalogGeneration?: number }>;
};

export function parseCatalogEvent(value: string): CatalogEvent | null {
	try {
		const parsed = JSON.parse(value) as CatalogEvent;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function catalogSocketUrl(ticket: string) {
	const url = new URL(orchestratorBaseUrl());
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	url.pathname = `${url.pathname.replace(/\/+$/, "")}/api/ws/catalog`;
	url.search = new URLSearchParams({ ticket }).toString();
	return url.toString();
}

export function startCatalogEvents(session: AuthSession): () => void {
	let stopped = false;
	let socket: WebSocket | null = null;
	let retryTimer: number | null = null;
	let retryDelay = 1_000;
	let refreshTimer: number | null = null;
	const pendingEvents = new Map<string, CatalogEvent>();

	const scheduleReconnect = () => {
		if (stopped || retryTimer !== null) return;
		retryTimer = window.setTimeout(() => {
			retryTimer = null;
			void connect();
		}, retryDelay);
		retryDelay = Math.min(15_000, retryDelay * 2);
	};

	const connect = async () => {
		try {
			const { ticket } = await catalogRequest<{ ticket: string }>(
				session,
				"/api/auth/socket-ticket",
				{ method: "POST" },
			);
			if (stopped) return;
			socket = new WebSocket(catalogSocketUrl(ticket));
			socket.onopen = () => { retryDelay = 1_000; };
		socket.onmessage = (message) => {
			const event = parseCatalogEvent(String(message.data));
			if (event?.type === "catalog.status") {
				for (const library of event.libraries ?? []) {
					if (!library.id) continue;
					pendingEvents.set(`status:${library.id}`, {
						type: "catalog.updated",
						libraryId: library.id,
						generation: library.catalogGeneration,
						rootEntityId: null,
					});
				}
			} else if (event?.type === "catalog.updated" || event?.type === "catalog.changed") {
				const eventKey = `${event.libraryId ?? "global"}:${event.rootEntityId ?? "root"}`;
				pendingEvents.set(eventKey, event);
			} else {
				return;
			}
			if (refreshTimer !== null) return;
			refreshTimer = window.setTimeout(() => {
				refreshTimer = null;
				const nextEvents = [...pendingEvents.values()];
				pendingEvents.clear();
				for (const nextEvent of nextEvents) {
					clearMediaClientCache({
						libraryId: nextEvent.libraryId,
						rootEntityId: nextEvent.rootEntityId ?? undefined,
					});
					window.dispatchEvent(
						new CustomEvent("zenstream:catalog-changed", { detail: nextEvent }),
					);
				}
			}, 250);
		};
			socket.onclose = scheduleReconnect;
			socket.onerror = () => socket?.close();
		} catch {
			scheduleReconnect();
		}
	};

	void connect();
	return () => {
		stopped = true;
		if (retryTimer !== null) window.clearTimeout(retryTimer);
		if (refreshTimer !== null) window.clearTimeout(refreshTimer);
		socket?.close();
	};
}
