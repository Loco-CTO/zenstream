import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
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
	streamLumiTurn: vi.fn(),
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
		vi.mocked(lumi.streamLumiTurn).mockReset();
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
		vi.mocked(lumi.streamLumiTurn).mockResolvedValue({
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
						websiteName: "example.org",
						title: "Review",
						faviconUrl: "https://example.org/favicon.ico",
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
		expect(screen.getByTestId("lumi-source-favicon")).toHaveAttribute(
			"src",
			"https://example.org/favicon.ico",
		);
		expect(screen.getByText("example.org")).toBeInTheDocument();
		expect(screen.getByTestId("lumi-source-favicon")).toHaveAttribute(
			"referrerpolicy",
			"no-referrer",
		);
		expect(lumi.updateLumiModelPreference).not.toHaveBeenCalled();
		expect(lumi.streamLumiTurn).toHaveBeenCalledWith(
			session,
			"new-conversation",
			"Recommend a thoughtful science fiction movie",
			expect.any(Function),
			expect.any(AbortSignal),
			undefined,
			expect.any(Function),
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
		vi.mocked(lumi.streamLumiTurn).mockResolvedValue({
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
		expect(lumi.streamLumiTurn).toHaveBeenCalledWith(
			session,
			"new-conversation",
			"Use a fast model",
			expect.any(Function),
			expect.any(AbortSignal),
			{ model: "qwen-fast", thinking: false },
			expect.any(Function),
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

	it("renders streamed Markdown and replaces it with the exact completion without duplication", async () => {
		const created = conversation({
			id: "new-conversation",
			title: "Streamed chat",
		});
		let emitDelta: ((text: string) => void) | undefined;
		let completeTurn: ((result: lumi.LumiTurnResponse) => void) | undefined;
		vi
			.mocked(lumi.streamLumiTurn)
			.mockImplementation((_session, _id, _message, onDelta) => {
				emitDelta = onDelta;
				return new Promise((resolve) => {
					completeTurn = resolve;
				});
			});
		renderPage();
		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, { target: { value: "Stream a short answer" } });
		fireEvent.submit(composer.closest("form")!);

		act(() => emitDelta?.("A partial "));
		expect(await screen.findByText("A partial")).toBeInTheDocument();
		act(() => emitDelta?.("**answer**"));
		expect(
			await screen.findByText("answer", { selector: "strong" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Stop generating" }),
		).toBeInTheDocument();
		act(() =>
			completeTurn?.({
				conversation: created,
				answer: {
					markdown: "A partial **answer**",
					references: [],
					sources: [],
				},
			}),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Stop generating" }),
			).not.toBeInTheDocument(),
		);
		const assistant = screen.getByRole("article", { name: "Lumi" });
		expect(
			within(assistant).getByText("answer", { selector: "strong" }),
		).toBeInTheDocument();
		expect(assistant.textContent).not.toContain("A partial A partial");
	});

	it("follows streamed text until the user scrolls away", async () => {
		let emitDelta: ((text: string) => void) | undefined;
		vi
			.mocked(lumi.streamLumiTurn)
			.mockImplementation((_session, _id, _message, onDelta) => {
				emitDelta = onDelta;
				return new Promise<lumi.LumiTurnResponse>(() => undefined);
			});
		renderPage();
		const scroller = await screen.findByTestId("lumi-message-scroller");
		Object.defineProperties(scroller, {
			scrollHeight: { configurable: true, value: 500 },
			clientHeight: { configurable: true, value: 100 },
		});
		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, {
			target: { value: "Keep the response in view" },
		});
		fireEvent.submit(composer.closest("form")!);
		await waitFor(() => expect(scroller.scrollTop).toBe(500));

		act(() => {
			scroller.scrollTop = 100;
			fireEvent.scroll(scroller);
			emitDelta?.("A streamed answer");
		});
		expect(await screen.findByText("A streamed answer")).toBeInTheDocument();
		await waitFor(() => expect(scroller.scrollTop).toBe(100));

		Object.defineProperty(scroller, "scrollHeight", {
			configurable: true,
			value: 600,
		});
		act(() => {
			scroller.scrollTop = 500;
			fireEvent.scroll(scroller);
			emitDelta?.(" and more text");
		});
		await waitFor(() => expect(scroller.scrollTop).toBe(600));
	});

	it("clears GPU partial text on reset and shows a retry status until new text arrives", async () => {
		const created = conversation({
			id: "new-conversation",
			title: "Fallback chat",
		});
		let emitDelta: ((text: string) => void) | undefined;
		let emitReset: ((reason: lumi.LumiStreamResetReason) => void) | undefined;
		let completeTurn: ((result: lumi.LumiTurnResponse) => void) | undefined;
		vi
			.mocked(lumi.streamLumiTurn)
			.mockImplementation(
				(_session, _id, _message, onDelta, _signal, _choice, onReset) => {
					emitDelta = onDelta;
					emitReset = onReset;
					return new Promise((resolve) => {
						completeTurn = resolve;
					});
				},
			);
		renderPage();
		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, { target: { value: "Try a GPU answer" } });
		fireEvent.submit(composer.closest("form")!);

		act(() => emitDelta?.("GPU partial answer"));
		expect(await screen.findByText("GPU partial answer")).toBeInTheDocument();
		act(() => emitReset?.("cpu_fallback"));
		expect(screen.queryByText("GPU partial answer")).not.toBeInTheDocument();
		expect(await screen.findByText("Switching to CPU…")).toBeInTheDocument();

		act(() => emitDelta?.("CPU partial answer"));
		expect(await screen.findByText("CPU partial answer")).toBeInTheDocument();
		expect(screen.queryByText("Switching to CPU…")).not.toBeInTheDocument();
		act(() => emitReset?.("intermediate"));
		expect(screen.queryByText("CPU partial answer")).not.toBeInTheDocument();
		expect(screen.queryByText("Switching to CPU…")).not.toBeInTheDocument();
		expect(screen.getByText("Lumi is thinking…")).toBeInTheDocument();
		act(() => emitDelta?.("Unknown-reset partial"));
		expect(await screen.findByText("Unknown-reset partial")).toBeInTheDocument();
		act(() => emitReset?.("unknown"));
		expect(screen.queryByText("Unknown-reset partial")).not.toBeInTheDocument();
		expect(screen.queryByText("Switching to CPU…")).not.toBeInTheDocument();
		expect(screen.getByText("Lumi is thinking…")).toBeInTheDocument();

		act(() => emitDelta?.("CPU fallback answer"));
		expect(await screen.findByText("CPU fallback answer")).toBeInTheDocument();
		act(() =>
			completeTurn?.({
				conversation: created,
				answer: {
					markdown: "CPU fallback answer",
					references: [],
					sources: [],
				},
			}),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Stop generating" }),
			).not.toBeInTheDocument(),
		);
		const assistant = screen.getByRole("article", { name: "Lumi" });
		expect(assistant).toHaveTextContent("CPU fallback answer");
		expect(assistant).not.toHaveTextContent("GPU partial answer");
	});

	it("shows a safe stream error and keeps the submitted text in the composer", async () => {
		vi
			.mocked(lumi.streamLumiTurn)
			.mockRejectedValue(new Error("Model stream is unavailable."));
		renderPage();
		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, { target: { value: "Keep this question" } });
		fireEvent.submit(composer.closest("form")!);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Model stream is unavailable.",
		);
		expect(composer).toHaveValue("Keep this question");
		expect(
			screen.queryByRole("button", { name: "Stop generating" }),
		).not.toBeInTheDocument();
	});

	it("shows a stop control during generation and aborts the active request", async () => {
		let requestSignal: AbortSignal | undefined;
		vi
			.mocked(lumi.streamLumiTurn)
			.mockImplementation((_session, _id, _message, onDelta, signal) => {
				requestSignal = signal;
				onDelta("First token");
				return new Promise((_resolve, reject) => {
					signal?.addEventListener(
						"abort",
						() => reject(new DOMException("Aborted", "AbortError")),
						{ once: true },
					);
				});
			});
		renderPage();
		const composer = await screen.findByRole("textbox", { name: "Message Lumi" });
		fireEvent.change(composer, { target: { value: "Stop this answer" } });
		fireEvent.submit(composer.closest("form")!);

		const stop = await screen.findByRole("button", { name: "Stop generating" });
		expect(screen.getByText("First token")).toBeInTheDocument();
		fireEvent.click(stop);
		await waitFor(() => expect(requestSignal?.aborted).toBe(true));
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Stop generating" }),
			).not.toBeInTheDocument(),
		);
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});
});
