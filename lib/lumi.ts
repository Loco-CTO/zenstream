import { authenticatedFetch } from "@/lib/authenticated-request";
import type { AuthSession } from "@/lib/session";

export type LumiModelOption = {
	id: string;
	label: string;
	supportsThinking: boolean;
};

export type LumiModelCatalog = {
	models: LumiModelOption[];
	defaultModel: string;
	defaultThinking: boolean;
};

export type LumiModelChoice = {
	model: string;
	thinking: boolean;
};

export type LumiConversation = LumiModelChoice & {
	id: string;
	title: string;
	createdAt: string;
	updatedAt: string;
};

export type LumiEntityReference = {
	type: string;
	id: string;
	title: string;
};

export type LumiSource = {
	url: string;
	websiteName: string;
	title: string;
	faviconUrl: string | null;
};

export type LumiMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
	references: LumiEntityReference[];
	sources: LumiSource[];
};

export type LumiConversationList = {
	conversations: LumiConversation[];
};

export type LumiConversationDetail = {
	conversation: LumiConversation;
	messages: LumiMessage[];
};

export type LumiTurnResponse = {
	conversation: LumiConversation;
	answer: {
		markdown: string;
		references: LumiEntityReference[];
		sources: LumiSource[];
	};
};

export type LumiStreamEvent = {
	event: string;
	data: string;
};

export type LumiChoiceResponse = { conversation: LumiConversation };
export type LumiPreferenceResponse = { preference: LumiModelChoice };

export class LumiRequestError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.name = "LumiRequestError";
		this.status = status;
	}
}

export class LumiStreamError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "LumiStreamError";
	}
}

function turnBody(message: string, choice?: LumiModelChoice) {
	return JSON.stringify({
		message,
		...(choice ? { model: choice.model, thinking: choice.thinking } : {}),
	});
}

function abortError(signal?: AbortSignal) {
	if (signal?.reason instanceof Error) return signal.reason;
	return new DOMException("The operation was aborted.", "AbortError");
}

/** Parse the SSE framing layer while preserving UTF-8 and event boundaries. */
export async function* parseLumiEventStream(
	body: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<LumiStreamEvent> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let line = "";
	let pendingCarriageReturn = false;
	let eventName = "";
	let dataLines: string[] = [];
	let streamEnded = false;

	const dispatch = (events: LumiStreamEvent[]) => {
		if (dataLines.length > 0 || eventName === "reset") {
			events.push({
				event: eventName || "message",
				data: dataLines.join("\n"),
			});
		}
		eventName = "";
		dataLines = [];
	};
	const processLine = (events: LumiStreamEvent[]) => {
		if (line === "") {
			dispatch(events);
			return;
		}
		if (line.startsWith(":")) {
			line = "";
			return;
		}
		const separator = line.indexOf(":");
		const field = separator < 0 ? line : line.slice(0, separator);
		let value = separator < 0 ? "" : line.slice(separator + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "data") dataLines.push(value);
		else if (field === "event" && !value.includes("\0")) eventName = value;
		line = "";
	};
	const consume = (text: string, final: boolean) => {
		const events: LumiStreamEvent[] = [];
		for (const character of text) {
			if (pendingCarriageReturn) {
				pendingCarriageReturn = false;
				processLine(events);
				if (character === "\n") continue;
			}
			if (character === "\r") pendingCarriageReturn = true;
			else if (character === "\n") processLine(events);
			else line += character;
		}
		if (final) {
			if (pendingCarriageReturn) {
				pendingCarriageReturn = false;
				processLine(events);
			} else if (line !== "") {
				processLine(events);
			}
			dispatch(events);
		}
		return events;
	};

	const cancelReaderOnAbort = () => {
		void reader.cancel(signal?.reason).catch(() => {});
	};
	signal?.addEventListener("abort", cancelReaderOnAbort, { once: true });
	try {
		while (true) {
			if (signal?.aborted) throw abortError(signal);
			const { done, value } = await reader.read();
			if (signal?.aborted) throw abortError(signal);
			for (const event of consume(
				done ? decoder.decode() : decoder.decode(value, { stream: true }),
				done,
			)) {
				yield event;
			}
			if (done) {
				streamEnded = true;
				return;
			}
		}
	} finally {
		signal?.removeEventListener("abort", cancelReaderOnAbort);
		if (!streamEnded) await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

async function lumiRequest<T>(
	session: AuthSession,
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const response = await authenticatedFetch(session, path, {
		cache: "no-store",
		...init,
	});
	const payload: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		const detail =
			typeof payload === "object" && payload !== null && "detail" in payload
				? (payload as { detail?: unknown }).detail
				: null;
		const message =
			typeof detail === "string" && detail.trim()
				? detail
				: `Lumi request failed with status ${response.status}.`;
		throw new LumiRequestError(response.status, message);
	}
	return payload as T;
}

export function getLumiModels(session: AuthSession, signal?: AbortSignal) {
	return lumiRequest<LumiModelCatalog>(session, "/api/lumi/models", { signal });
}

export function getLumiConversations(
	session: AuthSession,
	signal?: AbortSignal,
) {
	return lumiRequest<LumiConversationList>(session, "/api/lumi/conversations", {
		signal,
	});
}

export function getLumiConversation(
	session: AuthSession,
	conversationId: string,
	signal?: AbortSignal,
) {
	return lumiRequest<LumiConversationDetail>(
		session,
		`/api/lumi/conversations/${encodeURIComponent(conversationId)}`,
		{ signal },
	);
}

export function sendLumiTurn(
	session: AuthSession,
	conversationId: string,
	message: string,
	signal?: AbortSignal,
	choice?: LumiModelChoice,
) {
	return lumiRequest<LumiTurnResponse>(
		session,
		`/api/lumi/conversations/${encodeURIComponent(conversationId)}/turns`,
		{
			method: "POST",
			body: turnBody(message, choice),
			signal,
		},
	);
}

export async function streamLumiTurn(
	session: AuthSession,
	conversationId: string,
	message: string,
	onDelta: (text: string) => void,
	signal?: AbortSignal,
	choice?: LumiModelChoice,
	onReset?: () => void,
): Promise<LumiTurnResponse> {
	const response = await authenticatedFetch(
		session,
		`/api/lumi/conversations/${encodeURIComponent(conversationId)}/turns/stream`,
		{
			method: "POST",
			headers: { Accept: "text/event-stream" },
			body: turnBody(message, choice),
			signal,
			cache: "no-store",
		},
	);
	if (!response.ok) {
		const payload: unknown = await response.json().catch(() => null);
		const detail =
			typeof payload === "object" && payload !== null && "detail" in payload
				? (payload as { detail?: unknown }).detail
				: null;
		const message =
			typeof detail === "string" && detail.trim()
				? detail
				: `Lumi request failed with status ${response.status}.`;
		throw new LumiRequestError(response.status, message);
	}
	if (!response.body)
		throw new LumiStreamError("Lumi returned an empty stream.");

	for await (const frame of parseLumiEventStream(response.body, signal)) {
		if (signal?.aborted) throw abortError(signal);
		if (frame.event === "reset") {
			onReset?.();
			continue;
		}
		let payload: unknown;
		try {
			payload = JSON.parse(frame.data);
		} catch {
			throw new LumiStreamError("Lumi returned an invalid stream event.");
		}
		if (frame.event === "delta") {
			if (
				typeof payload === "object" &&
				payload !== null &&
				"text" in payload &&
				typeof (payload as { text?: unknown }).text === "string"
			) {
				const text = (payload as { text: string }).text;
				onDelta(text);
			}
			continue;
		}
		if (frame.event === "error") {
			const message =
				typeof payload === "object" &&
				payload !== null &&
				"message" in payload &&
				typeof (payload as { message?: unknown }).message === "string"
					? (payload as { message: string }).message
					: "Lumi could not complete the response.";
			throw new LumiStreamError(message);
		}
		if (frame.event === "complete") {
			if (
				typeof payload !== "object" ||
				payload === null ||
				!("conversation" in payload) ||
				!("answer" in payload) ||
				typeof payload.answer !== "object" ||
				payload.answer === null ||
				!("markdown" in payload.answer) ||
				typeof payload.answer.markdown !== "string" ||
				!("references" in payload.answer) ||
				!Array.isArray(payload.answer.references) ||
				!("sources" in payload.answer) ||
				!Array.isArray(payload.answer.sources)
			) {
				throw new LumiStreamError("Lumi returned an invalid completion event.");
			}
			return payload as LumiTurnResponse;
		}
	}
	throw new LumiStreamError(
		"Lumi ended the stream before completing the response.",
	);
}

export function updateLumiConversationChoice(
	session: AuthSession,
	conversationId: string,
	choice: LumiModelChoice,
	signal?: AbortSignal,
) {
	return lumiRequest<LumiChoiceResponse>(
		session,
		`/api/lumi/conversations/${encodeURIComponent(conversationId)}/choice`,
		{ method: "PATCH", body: JSON.stringify(choice), signal },
	);
}

export function updateLumiModelPreference(
	session: AuthSession,
	choice: LumiModelChoice,
	signal?: AbortSignal,
) {
	return lumiRequest<LumiPreferenceResponse>(
		session,
		"/api/lumi/preferences/model",
		{ method: "PUT", body: JSON.stringify(choice), signal },
	);
}
