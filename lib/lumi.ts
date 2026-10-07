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
			body: JSON.stringify({
				message,
				...(choice ? { model: choice.model, thinking: choice.thinking } : {}),
			}),
			signal,
		},
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
