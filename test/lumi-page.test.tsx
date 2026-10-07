import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LumiPage } from "@/components/pages/lumi-page";
import { I18nProvider } from "@/lib/i18n";
import * as lumi from "@/lib/lumi";
import * as mediaApi from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const navigation = vi.hoisted(() => ({ query: "" }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
	useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock("@/lib/lumi", () => ({
	getLumiConversation: vi.fn(),
	getLumiConversations: vi.fn(),
	getLumiModels: vi.fn(),
	sendLumiTurn: vi.fn(),
	updateLumiConversationChoice: vi.fn(),
	updateLumiModelPreference: vi.fn(),
}));

vi.mock("@/lib/media-api", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/media-api")>();
	return { ...actual, getItem: vi.fn() };
});

const session: AuthSession = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};
const modelList: lumi.LumiModelOption[] = [
	{ id: "qwen-small", label: "Qwen small", supportsThinking: true },
	{ id: "qwen-fast", label: "Qwen fast", supportsThinking: false },
];

function conversation(
	overrides: Partial<lumi.LumiConversation> = {},
): lumi.LumiConversation {
	return {
		id: "conversation-1",
		title: "Find a movie",
		model: "qwen-small",
		thinking: true,
		createdAt: "2026-10-06T10:00:00Z",
		updatedAt: "2026-10-06T10:00:00Z",
		...overrides,
	};
}

function renderPage() {
	return render(
		<I18nProvider locale="en">
			<LumiPage session={session} />
		</I18nProvider>,
	);
}

function mockModels() {
	vi.mocked(lumi.getLumiModels).mockResolvedValue({
		models: modelList,
		defaultModel: "qwen-small",
		defaultThinking: true,
	});
}

describe("LumiPage", () => {
	beforeEach(() => {
		navigation.query = "conversation=new-conversation";
		router.push.mockReset();
		router.replace.mockReset();
		mockModels();
		vi.mocked(lumi.getLumiConversations).mockResolvedValue({ conversations: [] });
		vi.mocked(lumi.getLumiConversation).mockReset();
		vi.mocked(lumi.sendLumiTurn).mockReset();
		vi.mocked(lumi.updateLumiConversationChoice).mockReset();
		vi.mocked(lumi.updateLumiModelPreference).mockReset();
		vi.mocked(mediaApi.getItem).mockReset();
	});

	it("returns to the launching ZenStream route from the close control", async () => {
		navigation.query = "returnTo=%2Flibrary%3Ftab%3Dmusic";
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Return to ZenStream" }));

		expect(router.replace).toHaveBeenCalledWith("/library?tab=music");
	});

	it("uses the ZenStream home route when opened without an in-app return path", () => {
		navigation.query = "";
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Return to ZenStream" }));

		expect(router.replace).toHaveBeenCalledWith("/");
	});

	it("keeps the launching route when starting a new conversation", () => {
		navigation.query = "returnTo=%2Flibrary%3Ftab%3Dmusic";
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "New chat" }));

		const pushedRoute = router.push.mock.calls[0]?.[0];
		expect(pushedRoute).toContain("/lumi?");
		const params = new URLSearchParams(pushedRoute.split("?")[1]);
		expect(params.get("conversation")).toBeTruthy();
		expect(params.get("returnTo")).toBe("/library?tab=music");
	});

	it("rejects an external close destination", () => {
		navigation.query = "returnTo=https%3A%2F%2Fevil.example";
		renderPage();

		fireEvent.click(screen.getByRole("button", { name: "Return to ZenStream" }));

		expect(router.replace).toHaveBeenCalledWith("/");
	});

	it("puts a selected starter prompt into the composer", async () => {
		renderPage();

		fireEvent.click(
			await screen.findByRole("button", { name: "What should I watch tonight?" }),
		);

		expect(screen.getByRole("textbox", { name: "Message Lumi" })).toHaveValue(
			"What should I watch tonight?",
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllMocks();
	});

	it("creates a conversation on its first turn and displays validated references and sources", async () => {
		const created = conversation({
			id: "new-conversation",
			title: "Find a movie",
		});
		vi.mocked(lumi.sendLumiTurn).mockResolvedValue({
			conversation: created,
			answer: {
				markdown:
					'Here is a **match**:\n:::zenstream{type="movie" id="movie-1"}\n:::zenstream{type="movie" id="other-movie"}',
				references: [
					{ type: "movie", id: "movie-1", title: "Arrival" },
					{ type: "series", id: "missing-series", title: "Unresolved series" },
				],
				sources: [
					{
						url: "https://example.org/review",
						websiteName: "Example",
						title: "Review",
						faviconUrl: null,
					},
					{
						url: "javascript:alert(1)",
						websiteName: "Unsafe",
						title: "Unsafe source",
						faviconUrl: null,
					},
				],
			},
		});
		vi.mocked(mediaApi.getItem).mockResolvedValue({
			Id: "movie-1",
			Name: "Arrival",
			Type: "Movie",
		});
		const storageWrite = vi.spyOn(Storage.prototype, "setItem");
		renderPage();

		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, {
			target: { value: "Recommend a thoughtful science fiction movie" },
		});
		fireEvent.submit(composer.closest("form")!);

		await screen.findByText("match", { selector: "strong" });
		expect(lumi.updateLumiModelPreference).not.toHaveBeenCalled();
		expect(lumi.sendLumiTurn).toHaveBeenCalledWith(
			session,
			"new-conversation",
			"Recommend a thoughtful science fiction movie",
			expect.any(AbortSignal),
			undefined,
		);
		expect(await screen.findAllByRole("link", { name: /Arrival/ })).toHaveLength(
			2,
		);
		expect(screen.getAllByRole("link", { name: /Arrival/ })[0]).toHaveAttribute(
			"href",
			"/show/movie-1",
		);
		expect(
			screen.queryByRole("link", { name: /Unresolved series/ }),
		).not.toBeInTheDocument();
		expect(screen.getByText("Unresolved series")).toBeInTheDocument();
		expect(
			screen.getByText(':::zenstream{type="movie" id="other-movie"}'),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Review/ })).toHaveAttribute(
			"href",
			"https://example.org/review",
		);
		expect(screen.queryByText("Unsafe source")).not.toBeInTheDocument();
		expect(storageWrite).not.toHaveBeenCalled();
	});

	it("sends a draft model choice with the first turn without changing the default", async () => {
		vi.mocked(lumi.sendLumiTurn).mockResolvedValue({
			conversation: conversation({
				id: "new-conversation",
				model: "qwen-fast",
				thinking: false,
			}),
			answer: { markdown: "A quick suggestion.", references: [], sources: [] },
		});
		renderPage();

		fireEvent.change(await screen.findByRole("combobox", { name: "Model" }), {
			target: { value: "qwen-fast" },
		});
		const composer = screen.getByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, { target: { value: "Use a fast model" } });
		fireEvent.submit(composer.closest("form")!);

		await screen.findByText("A quick suggestion.");
		expect(lumi.sendLumiTurn).toHaveBeenCalledWith(
			session,
			"new-conversation",
			"Use a fast model",
			expect.any(AbortSignal),
			{ model: "qwen-fast", thinking: false },
		);
		expect(lumi.updateLumiConversationChoice).not.toHaveBeenCalled();
		expect(lumi.updateLumiModelPreference).not.toHaveBeenCalled();
	});

	it("loads a saved conversation and applies its model choice", async () => {
		const existing = conversation();
		navigation.query = "conversation=conversation-1";
		vi
			.mocked(lumi.getLumiConversations)
			.mockResolvedValue({ conversations: [existing] });
		vi.mocked(lumi.getLumiConversation).mockResolvedValue({
			conversation: existing,
			messages: [],
		});
		vi.mocked(lumi.updateLumiConversationChoice).mockResolvedValue({
			conversation: conversation({ model: "qwen-fast", thinking: false }),
		});
		vi.mocked(lumi.updateLumiModelPreference).mockResolvedValue({
			preference: { model: "qwen-fast", thinking: false },
		});
		renderPage();

		const model = await screen.findByRole("combobox", { name: "Model" });
		fireEvent.change(model, { target: { value: "qwen-fast" } });
		fireEvent.click(screen.getByRole("button", { name: "Chat options" }));
		fireEvent.click(screen.getByRole("button", { name: "Apply to chat" }));

		await screen.findByRole("status");
		expect(lumi.updateLumiConversationChoice).toHaveBeenCalledWith(
			session,
			"conversation-1",
			{ model: "qwen-fast", thinking: false },
		);
		expect(
			screen.getByRole("button", { name: "Make default" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Make default" }));
		await screen.findByText("Default model saved for new chats.");
		expect(lumi.updateLumiModelPreference).toHaveBeenCalledWith(session, {
			model: "qwen-fast",
			thinking: false,
		});
	});
});
