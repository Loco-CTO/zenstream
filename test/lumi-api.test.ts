import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/authenticated-request";
import { sendLumiTurn } from "@/lib/lumi";

vi.mock("@/lib/authenticated-request", () => ({
	authenticatedFetch: vi.fn(),
}));

const session = { token: "token", userId: "user-1", username: "Alex" };
const response = {
	conversation: {
		id: "conversation-1",
		title: "A chat",
		model: "qwen-fast",
		thinking: false,
		createdAt: "2026-10-06T10:00:00Z",
		updatedAt: "2026-10-06T10:00:00Z",
	},
	answer: { markdown: "An answer", references: [], sources: [] },
};

describe("Lumi API client", () => {
	beforeEach(() => vi.mocked(authenticatedFetch).mockReset());

	it("sends an optional per-conversation choice with the first turn", async () => {
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

		await sendLumiTurn(session, "conversation/1", "Hello", undefined, {
			model: "qwen-fast",
			thinking: false,
		});

		expect(authenticatedFetch).toHaveBeenCalledWith(
			session,
			"/api/lumi/conversations/conversation%2F1/turns",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					message: "Hello",
					model: "qwen-fast",
					thinking: false,
				}),
			}),
		);
	});

	it("omits the optional choice when a new chat uses its default", async () => {
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));

		await sendLumiTurn(session, "conversation-1", "Hello");

		expect(authenticatedFetch).toHaveBeenCalledWith(
			session,
			"/api/lumi/conversations/conversation-1/turns",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ message: "Hello" }),
			}),
		);
	});
});
