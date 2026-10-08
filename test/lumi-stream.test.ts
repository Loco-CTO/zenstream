import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/authenticated-request";
import {
	LumiStreamError,
	parseLumiEventStream,
	streamLumiTurn,
	type LumiTurnResponse,
} from "@/lib/lumi";

vi.mock("@/lib/authenticated-request", () => ({
	authenticatedFetch: vi.fn(),
}));

const session = { token: "token", userId: "user-1", username: "Alex" };
const completion: LumiTurnResponse = {
	conversation: {
		id: "conversation-1",
		title: "A chat",
		model: "qwen-fast",
		thinking: false,
		createdAt: "2026-10-06T10:00:00Z",
		updatedAt: "2026-10-06T10:01:00Z",
	},
	answer: {
		markdown: "Hello **world**",
		references: [],
		sources: [],
	},
};

function byteStream(chunks: Uint8Array[]) {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

function encodedChunks(text: string, chunkSize = 1) {
	const bytes = new TextEncoder().encode(text);
	const chunks: Uint8Array[] = [];
	for (let offset = 0; offset < bytes.length; offset += chunkSize) {
		chunks.push(bytes.slice(offset, offset + chunkSize));
	}
	return chunks;
}

function sseBody(text: string, chunkSize?: number) {
	return byteStream(encodedChunks(text, chunkSize));
}

function event(name: string, payload: unknown) {
	return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;
}

describe("Lumi stream client", () => {
	beforeEach(() => vi.mocked(authenticatedFetch).mockReset());

	it("parses byte-split UTF-8, CRLF, comments, and multiple event frames", async () => {
		const body = sseBody(
			`: keepalive\r\nevent: delta\r\ndata: {"text":"こんにちは 🌐"}\r\n\r\nevent: delta\ndata: {"text":" next"}\n\n`,
		);
		const parsed: Array<{ event: string; data: string }> = [];
		for await (const item of parseLumiEventStream(body)) parsed.push(item);

		expect(parsed).toEqual([
			{ event: "delta", data: '{"text":"こんにちは 🌐"}' },
			{ event: "delta", data: '{"text":" next"}' },
		]);
	});

	it("flushes a final event at EOF and joins repeated data fields", async () => {
		const body = sseBody('event: delta\ndata: {"text":\ndata: "end"}', 3);
		const parsed: Array<{ event: string; data: string }> = [];
		for await (const item of parseLumiEventStream(body)) parsed.push(item);

		expect(parsed).toEqual([{ event: "delta", data: '{"text":\n"end"}' }]);
	});

	it("posts the normal turn body and returns one exact completion after text deltas", async () => {
		const body = sseBody(
			`${event("delta", { text: "Hello " })}${event("delta", { text: "**world**" })}${event("complete", completion)}`,
			5,
		);
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(new Response(body, { status: 200 }));
		const deltas: string[] = [];

		const result = await streamLumiTurn(
			session,
			"conversation/1",
			"Hello",
			(text) => deltas.push(text),
			undefined,
			{ model: "qwen-fast", thinking: false },
		);

		expect(deltas).toEqual(["Hello ", "**world**"]);
		expect(result).toEqual(completion);
		expect(authenticatedFetch).toHaveBeenCalledWith(
			session,
			"/api/lumi/conversations/conversation%2F1/turns/stream",
			expect.objectContaining({
				method: "POST",
				cache: "no-store",
				headers: { Accept: "text/event-stream" },
				body: JSON.stringify({
					message: "Hello",
					model: "qwen-fast",
					thinking: false,
				}),
			}),
		);
	});

	it("surfaces safe server stream errors", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue(
			new Response(sseBody(event("error", { message: "Model is unavailable." })), {
				status: 200,
			}),
		);

		await expect(
			streamLumiTurn(session, "conversation-1", "Hello", vi.fn()),
		).rejects.toMatchObject({
			name: "LumiStreamError",
			message: "Model is unavailable.",
		});
	});

	it("rejects EOF without a completion event", async () => {
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(
				new Response(sseBody(event("delta", { text: "Partial" })), { status: 200 }),
			);

		await expect(
			streamLumiTurn(session, "conversation-1", "Hello", vi.fn()),
		).rejects.toBeInstanceOf(LumiStreamError);
	});

	it("aborts the request and cancels its reader while streaming", async () => {
		let cancelled = false;
		const body = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(
					new TextEncoder().encode(event("delta", { text: "First token" })),
				);
			},
			cancel() {
				cancelled = true;
			},
		});
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(new Response(body, { status: 200 }));
		const controller = new AbortController();

		await expect(
			streamLumiTurn(
				session,
				"conversation-1",
				"Hello",
				() => controller.abort(),
				controller.signal,
			),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(controller.signal.aborted).toBe(true);
		expect(cancelled).toBe(true);
	});
});
