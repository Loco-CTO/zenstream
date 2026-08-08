import { catalogRequest, orchestratorBaseUrl } from "@/lib/catalog";
import { clearMediaClientCache } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

type CatalogEvent = {
	type?: string;
	generation?: number;
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
				if (event?.type !== "catalog.updated" && event?.type !== "catalog.changed") return;
				clearMediaClientCache();
				window.dispatchEvent(new CustomEvent("zenstream:catalog-changed", { detail: event }));
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
		socket?.close();
	};
}
