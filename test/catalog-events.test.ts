import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const catalogRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/catalog", async () => {
	const actual = await vi.importActual<typeof import("@/lib/catalog")>(
		"@/lib/catalog",
	);
	return { ...actual, catalogRequest };
});

import {
	catalogStatusChanges,
	parseCatalogEvent,
	startCatalogEvents,
	type CatalogEvent,
} from "@/lib/catalog-events";

class TestWebSocket {
	static instances: TestWebSocket[] = [];
	onmessage: ((event: MessageEvent) => void) | null = null;
	onopen: (() => void) | null = null;
	onclose: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(readonly url: string) {
		TestWebSocket.instances.push(this);
	}

	emit(data: string) {
		this.onmessage?.({ data } as MessageEvent);
	}

	close() {
		this.onclose?.();
	}
}

describe("catalog events", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("WebSocket", TestWebSocket);
		TestWebSocket.instances = [];
		catalogRequest.mockResolvedValue({ ticket: "socket-ticket" });
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		catalogRequest.mockReset();
	});

	it("parses catalog updates", () => {
		expect(
			parseCatalogEvent('{"type":"catalog.updated","generation":4}'),
		).toEqual({
			type: "catalog.updated",
			generation: 4,
		});
	});

	it("ignores invalid JSON", () => {
		expect(parseCatalogEvent("invalid")).toBeNull();
	});

	it("turns reconnect status into library-wide invalidations", () => {
		const status = parseCatalogEvent(
			'{"type":"catalog.status","libraries":[{"id":"tv","catalogGeneration":7}]}',
		);
		expect(status && catalogStatusChanges(status)).toEqual([
			{
				type: "catalog.updated",
				libraryId: "tv",
				generation: 7,
				rootEntityId: null,
				reason: "refresh",
			},
		]);
	});

	it("ignores heartbeat statuses while preserving updates and reconnect invalidation", async () => {
		const changes: CatalogEvent[] = [];
		const handleChange = (event: Event) => {
			changes.push((event as CustomEvent<CatalogEvent>).detail);
		};
		window.addEventListener("zenstream:catalog-changed", handleChange);
		const stop = startCatalogEvents({
			token: "token",
			userId: "user",
			username: "Alex",
		});

		await vi.waitFor(() => expect(TestWebSocket.instances).toHaveLength(1));
		const firstSocket = TestWebSocket.instances[0];
		const status =
			'{"type":"catalog.status","libraries":[{"id":"tv","catalogGeneration":7}]}';
		firstSocket.emit(status);
		firstSocket.emit(status);
		await vi.advanceTimersByTimeAsync(250);
			expect(changes).toHaveLength(1);

		firstSocket.emit(
			'{"type":"catalog.updated","libraryId":"tv","rootEntityId":"series-1","reason":"refresh"}',
		);
		await vi.advanceTimersByTimeAsync(250);
			expect(changes).toHaveLength(2);

		firstSocket.close();
		await vi.advanceTimersByTimeAsync(1_000);
		await vi.waitFor(() => expect(TestWebSocket.instances).toHaveLength(2));
		TestWebSocket.instances[1].emit(status);
		await vi.advanceTimersByTimeAsync(250);
			expect(changes).toHaveLength(3);

		stop();
		window.removeEventListener("zenstream:catalog-changed", handleChange);
	});
});
