"use client";

import {
	ArrowUp,
	CircleAlert,
	EllipsisVertical,
	ExternalLink,
	Globe2,
	LoaderCircle,
	Menu,
	MoreHorizontal,
	Pencil,
	Plus,
	Sparkles,
	Square,
	Trash2,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	useCallback,
	useEffect,
	useMemo,
	useLayoutEffect,
	useRef,
	useState,
	Fragment,
	type FormEvent,
	type KeyboardEvent,
	type ReactNode,
} from "react";
import { useI18n } from "@/lib/i18n";
import { getItem, type MediaItem } from "@/lib/media-api";
import { detailHref } from "@/lib/media-links";
import { MediaBannerCard } from "@/components/home/media-banner-card";
import { Toggle } from "@/components/ui/toggle";
import {
	deleteLumiConversation,
	getLumiConversation,
	getLumiConversations,
	getLumiModels,
	renameLumiConversation,
	streamLumiTurn,
	updateLumiConversationChoice,
	updateLumiModelPreference,
	type LumiConversation,
	type LumiEntityReference,
	type LumiMessage,
	type LumiModelChoice,
	type LumiModelOption,
	type LumiSource,
	type LumiStreamStatus,
} from "@/lib/lumi";
import type { AuthSession } from "@/lib/session";

type LumiPageProps = { session: AuthSession };

type DetailState = {
	id: string;
	conversation: LumiConversation;
	messages: LumiMessage[];
	nextCursor: string | null;
	hasMore: boolean;
	hasSummary: boolean;
};

type ChoiceOverride = {
	conversationId: string | null;
	choice: LumiModelChoice;
};

export function LumiPage({ session }: LumiPageProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const selectedId = searchParams.get("conversation");
	const [models, setModels] = useState<LumiModelOption[]>([]);
	const [configuredDefault, setConfiguredDefault] =
		useState<LumiModelChoice | null>(null);
	const [savedDefault, setSavedDefault] = useState<LumiModelChoice | null>(null);
	const [conversations, setConversations] = useState<LumiConversation[]>([]);
	const [listLoading, setListLoading] = useState(true);
	const [modelsError, setModelsError] = useState<string | null>(null);
	const [listError, setListError] = useState<string | null>(null);
	const [detailState, setDetailState] = useState<DetailState | null>(null);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set());
	const [choiceOverrideEntry, setChoiceOverrideEntry] =
		useState<ChoiceOverride | null>(null);
	const [choiceBusy, setChoiceBusy] = useState(false);
	const [choiceNotice, setChoiceNotice] = useState<string | null>(null);
	const [composer, setComposer] = useState("");
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [streamedAnswer, setStreamedAnswer] = useState("");
	const [switchingToCpu, setSwitchingToCpu] = useState(false);
	const [contextStageEntry, setContextStageEntry] = useState<{
		conversationId: string;
		stage: LumiStreamStatus;
	} | null>(null);
	const contextStage =
		contextStageEntry?.conversationId === selectedId
			? contextStageEntry.stage
			: null;
	const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);
	const historyLoading = Boolean(selectedId && historyLoadingId === selectedId);
	const [historyErrorEntry, setHistoryErrorEntry] = useState<{
		conversationId: string;
		message: string;
	} | null>(null);
	const historyError =
		historyErrorEntry?.conversationId === selectedId
			? historyErrorEntry.message
			: null;
	const [sending, setSending] = useState(false);
	const [sendError, setSendError] = useState<string | null>(null);
	const [sendSequence, setSendSequence] = useState(0);
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
	const [chatActionMenuId, setChatActionMenuId] = useState<string | null>(null);
	const [renameTarget, setRenameTarget] = useState<LumiConversation | null>(
		null,
	);
	const [renameValue, setRenameValue] = useState("");
	const [renameError, setRenameError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<LumiConversation | null>(
		null,
	);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [conversationActionBusy, setConversationActionBusy] = useState(false);
	const composerRef = useRef<HTMLTextAreaElement>(null);
	const messagesScrollRef = useRef<HTMLDivElement>(null);
	const shouldFollowMessagesRef = useRef(true);
	const activeRequest = useRef<AbortController | null>(null);
	const historyRequest = useRef<AbortController | null>(null);
	const pendingScrollRestore = useRef<{
		conversationId: string;
		scrollHeight: number;
		scrollTop: number;
	} | null>(null);
	const { locale, t } = useI18n();
	const returnTo = useMemo(
		() => safeLumiReturnTo(searchParams.get("returnTo")),
		[searchParams],
	);
	const closeLumi = useCallback(
		() => router.replace(returnTo),
		[returnTo, router],
	);

	const savedConversation =
		conversations.find((item) => item.id === selectedId) ?? null;
	const detailConversation =
		detailState?.id === selectedId ? detailState.conversation : null;
	const activeConversation = savedConversation ?? detailConversation;
	const activeIsDraft = selectedId !== null && draftIds.has(selectedId);
	const defaultChoice = savedDefault ??
		configuredDefault ?? { model: "", thinking: false };
	const choiceOverride =
		choiceOverrideEntry?.conversationId === selectedId
			? choiceOverrideEntry.choice
			: null;
	const choice = choiceOverride ?? activeConversation ?? defaultChoice;
	const selectedModel =
		models.find((model) => model.id === choice.model) ?? null;
	const choiceChanged = Boolean(
		activeConversation &&
		(choice.model !== activeConversation.model ||
			choice.thinking !== activeConversation.thinking),
	);
	const visibleMessages =
		selectedId && detailState?.id === selectedId && !activeIsDraft
			? detailState.messages
			: [];
	const knownConversation = conversations.some((item) => item.id === selectedId);
	const activeHasMore = Boolean(
		detailState?.id === selectedId && detailState.hasMore,
	);
	const activeHasSummary = Boolean(
		detailState?.id === selectedId && detailState.hasSummary,
	);
	const conversationIds = useMemo(
		() => conversations.map((item) => item.id).join("\u0000"),
		[conversations],
	);

	useEffect(() => {
		const controller = new AbortController();
		let current = true;
		void Promise.allSettled([
			getLumiModels(session, controller.signal),
			getLumiConversations(session, controller.signal),
		]).then(([modelResult, conversationResult]) => {
			if (!current || controller.signal.aborted) return;
			if (modelResult.status === "fulfilled") {
				setModels(modelResult.value.models);
				setConfiguredDefault({
					model: modelResult.value.defaultModel,
					thinking: modelResult.value.defaultThinking,
				});
			} else {
				setModelsError(
					requestMessage(modelResult.reason, t("lumiModelsLoadFailed")),
				);
			}
			if (conversationResult.status === "fulfilled") {
				setConversations(conversationResult.value.conversations);
			} else {
				setListError(
					requestMessage(conversationResult.reason, t("lumiHistoryLoadFailed")),
				);
			}
			setListLoading(false);
		});
		return () => {
			current = false;
			controller.abort();
		};
	}, [session, t]);

	useEffect(() => {
		if (
			!selectedId ||
			activeIsDraft ||
			!knownConversation ||
			detailState?.id === selectedId
		)
			return;
		const controller = new AbortController();
		activeRequest.current?.abort();
		activeRequest.current = controller;
		void getLumiConversation(session, selectedId, controller.signal)
			.then((detail) => {
				if (controller.signal.aborted) return;
				setDetailState({
					id: selectedId,
					conversation: detail.conversation,
					messages: detail.messages,
					nextCursor: detail.nextCursor ?? null,
					hasMore: detail.hasMore === true,
					hasSummary: detail.hasSummary === true,
				});
				setConversations((current) =>
					current.map((item) =>
						item.id === detail.conversation.id ? detail.conversation : item,
					),
				);
				setChoiceOverrideEntry(null);
				setDetailError(null);
			})
			.catch((error: unknown) => {
				if (!controller.signal.aborted)
					setDetailError(requestMessage(error, t("lumiConversationLoadFailed")));
			})
			.finally(() => {
				if (activeRequest.current === controller) activeRequest.current = null;
			});
		return () => controller.abort();
	}, [
		activeIsDraft,
		detailState?.id,
		knownConversation,
		selectedId,
		session,
		t,
		conversationIds,
	]);

	useEffect(() => {
		historyRequest.current?.abort();
		pendingScrollRestore.current = null;
	}, [selectedId]);

	useEffect(() => () => activeRequest.current?.abort(), []);

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, []);

	useEffect(() => {
		const closeOnEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key !== "Escape" || event.isComposing) return;
			event.preventDefault();
			if (renameTarget) setRenameTarget(null);
			else if (deleteTarget) setDeleteTarget(null);
			else if (chatActionMenuId) setChatActionMenuId(null);
			else if (conversationMenuOpen) setConversationMenuOpen(false);
			else if (sidebarOpen) setSidebarOpen(false);
			else closeLumi();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [
		chatActionMenuId,
		closeLumi,
		conversationMenuOpen,
		deleteTarget,
		renameTarget,
		sidebarOpen,
	]);

	useEffect(() => {
		shouldFollowMessagesRef.current = true;
	}, [selectedId]);

	useLayoutEffect(() => {
		const pending = pendingScrollRestore.current;
		const container = messagesScrollRef.current;
		if (
			!pending ||
			!container ||
			pending.conversationId !== selectedId ||
			historyLoading
		) {
			return;
		}
		container.scrollTop =
			pending.scrollTop + (container.scrollHeight - pending.scrollHeight);
		pendingScrollRestore.current = null;
	}, [historyLoading, selectedId, visibleMessages.length]);

	useEffect(() => {
		if (!shouldFollowMessagesRef.current) return;
		const frame = window.requestAnimationFrame(() => {
			const container = messagesScrollRef.current;
			if (container && shouldFollowMessagesRef.current)
				container.scrollTop = container.scrollHeight;
		});
		return () => window.cancelAnimationFrame(frame);
	}, [
		pendingMessage,
		selectedId,
		sending,
		streamedAnswer,
		visibleMessages.length,
	]);

	useEffect(() => {
		const textarea = composerRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
	}, [composer]);

	const loadEarlierMessages = async () => {
		const conversationId = selectedId;
		const current = detailState;
		if (
			!conversationId ||
			current?.id !== conversationId ||
			!current.hasMore ||
			!current.nextCursor ||
			historyLoading
		) {
			return;
		}
		const container = messagesScrollRef.current;
		if (container) {
			pendingScrollRestore.current = {
				conversationId,
				scrollHeight: container.scrollHeight,
				scrollTop: container.scrollTop,
			};
		}
		shouldFollowMessagesRef.current = false;
		setHistoryLoadingId(conversationId);
		setHistoryErrorEntry(null);
		const controller = new AbortController();
		historyRequest.current?.abort();
		historyRequest.current = controller;
		try {
			const page = await getLumiConversation(
				session,
				conversationId,
				controller.signal,
				current.nextCursor,
			);
			if (controller.signal.aborted || selectedId !== conversationId) return;
			setDetailState((state) => {
				if (state?.id !== conversationId) return state;
				const knownIds = new Set(state.messages.map((message) => message.id));
				const earlier = page.messages.filter((message) => {
					if (knownIds.has(message.id)) return false;
					knownIds.add(message.id);
					return true;
				});
				return {
					...state,
					conversation: page.conversation,
					messages: [...earlier, ...state.messages],
					nextCursor: page.nextCursor ?? null,
					hasMore: page.hasMore === true,
					hasSummary: state.hasSummary || page.hasSummary === true,
				};
			});
			setConversations((items) =>
				items.map((item) =>
					item.id === page.conversation.id ? page.conversation : item,
				),
			);
		} catch (error) {
			if (!controller.signal.aborted) {
				pendingScrollRestore.current = null;
				setHistoryErrorEntry({
					conversationId,
					message: requestMessage(error, t("lumiHistoryPageLoadFailed")),
				});
			}
		} finally {
			if (historyRequest.current === controller) {
				historyRequest.current = null;
				setHistoryLoadingId((current) =>
					current === conversationId ? null : current,
				);
			}
		}
	};

	const createConversation = () => {
		const id = createConversationId();
		activeRequest.current?.abort();
		setDraftIds((current) => new Set(current).add(id));
		setDetailError(null);
		setSendError(null);
		setChoiceNotice(null);
		setStreamedAnswer("");
		setSwitchingToCpu(false);
		setContextStageEntry(null);
		setChoiceOverrideEntry({
			conversationId: id,
			choice: { ...(selectedId === null ? choice : defaultChoice) },
		});
		setComposer("");
		setSidebarOpen(false);
		setConversationMenuOpen(false);
		router.push(lumiConversationHref(id, returnTo));
	};

	const selectConversation = (conversation: LumiConversation) => {
		activeRequest.current?.abort();
		setChatActionMenuId(null);
		setSendError(null);
		setDetailError(null);
		setChoiceNotice(null);
		setStreamedAnswer("");
		setSwitchingToCpu(false);
		setContextStageEntry(null);
		setChoiceOverrideEntry({
			conversationId: conversation.id,
			choice: { model: conversation.model, thinking: conversation.thinking },
		});
		setComposer("");
		setSidebarOpen(false);
		router.push(lumiConversationHref(conversation.id, returnTo));
	};

	const setChoiceModel = (modelId: string) => {
		const model = models.find((item) => item.id === modelId);
		setChoiceOverrideEntry({
			conversationId: selectedId,
			choice: {
				model: modelId,
				thinking: model?.supportsThinking ? choice.thinking : false,
			},
		});
		setChoiceNotice(null);
	};

	const applyConversationChoice = async () => {
		if (!selectedId || !activeConversation || !choiceChanged || choiceBusy)
			return;
		setChoiceBusy(true);
		setChoiceNotice(null);
		try {
			const result = await updateLumiConversationChoice(session, selectedId, {
				model: choice.model,
				thinking: choice.thinking,
			});
			setDetailState((current) =>
				current?.id === selectedId
					? { ...current, conversation: result.conversation }
					: current,
			);
			setConversations((current) =>
				current.map((item) =>
					item.id === selectedId ? result.conversation : item,
				),
			);
			setChoiceOverrideEntry(null);
			setChoiceNotice(t("lumiChoiceSaved"));
		} catch (error) {
			setChoiceNotice(requestMessage(error, t("lumiChoiceSaveFailed")));
		} finally {
			setChoiceBusy(false);
		}
	};

	const saveDefaultChoice = async () => {
		if (!choice.model || choiceBusy) return;
		setChoiceBusy(true);
		setChoiceNotice(null);
		try {
			const result = await updateLumiModelPreference(session, {
				model: choice.model,
				thinking: choice.thinking,
			});
			setSavedDefault(result.preference);
			setChoiceNotice(t("lumiDefaultSaved"));
		} catch (error) {
			setChoiceNotice(requestMessage(error, t("lumiDefaultSaveFailed")));
		} finally {
			setChoiceBusy(false);
		}
	};

	const beginRenameConversation = (conversation: LumiConversation) => {
		setChatActionMenuId(null);
		setRenameTarget(conversation);
		setRenameValue(conversation.title);
		setRenameError(null);
	};

	const renameConversation = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!renameTarget || conversationActionBusy) return;
		const title = renameValue.trim().replace(/\s+/g, " ");
		if (!title || title.length > 120) {
			setRenameError(t("lumiRenameChatFailed"));
			return;
		}
		setConversationActionBusy(true);
		setRenameError(null);
		try {
			const result = await renameLumiConversation(session, renameTarget.id, title);
			setConversations((current) =>
				current
					.map((item) =>
						item.id === result.conversation.id ? result.conversation : item,
					)
					.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
			);
			setDetailState((current) =>
				current?.id === result.conversation.id
					? { ...current, conversation: result.conversation }
					: current,
			);
			setRenameTarget(null);
		} catch (error) {
			setRenameError(requestMessage(error, t("lumiRenameChatFailed")));
		} finally {
			setConversationActionBusy(false);
		}
	};

	const deleteConversation = async () => {
		if (!deleteTarget || conversationActionBusy) return;
		const conversationId = deleteTarget.id;
		setConversationActionBusy(true);
		setDeleteError(null);
		if (selectedId === conversationId) activeRequest.current?.abort();
		try {
			await deleteLumiConversation(session, conversationId);
			setConversations((current) =>
				current.filter((item) => item.id !== conversationId),
			);
			setDraftIds((current) => {
				const next = new Set(current);
				next.delete(conversationId);
				return next;
			});
			setDetailState((current) =>
				current?.id === conversationId ? null : current,
			);
			if (selectedId === conversationId) {
				setChoiceOverrideEntry(null);
				setComposer("");
				setPendingMessage(null);
				setStreamedAnswer("");
				setSending(false);
				router.replace(returnTo);
			}
			setDeleteTarget(null);
		} catch (error) {
			setDeleteError(requestMessage(error, t("lumiDeleteChatFailed")));
		} finally {
			setConversationActionBusy(false);
		}
	};

	const submitMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const message = composer.trim();
		if (!message || sending || !choice.model || loadingDetail) return;

		let conversationId = selectedId;
		const isNewConversation =
			!conversationId || activeIsDraft || !activeConversation;
		const firstTurnChoice =
			isNewConversation && choiceOverrideEntry?.conversationId === selectedId
				? { ...choice }
				: undefined;
		if (!conversationId) {
			conversationId = createConversationId();
			setDraftIds((current) => new Set(current).add(conversationId!));
			setChoiceOverrideEntry({
				conversationId,
				choice: { ...choice },
			});
			router.push(lumiConversationHref(conversationId, returnTo));
		}
		const targetId = conversationId;
		const sendId = sendSequence + 1;
		setSendSequence(sendId);
		setSending(true);
		setPendingMessage(message);
		setStreamedAnswer("");
		setContextStageEntry(null);
		shouldFollowMessagesRef.current = true;
		setSwitchingToCpu(false);
		setSendError(null);
		setChoiceNotice(null);
		const controller = new AbortController();
		activeRequest.current?.abort();
		activeRequest.current = controller;
		try {
			if (
				!isNewConversation &&
				activeConversation &&
				(choice.model !== activeConversation.model ||
					choice.thinking !== activeConversation.thinking)
			) {
				const updated = await updateLumiConversationChoice(
					session,
					targetId,
					choice,
					controller.signal,
				);
				setConversations((current) =>
					current.map((item) =>
						item.id === targetId ? updated.conversation : item,
					),
				);
			}
			const result = await streamLumiTurn(
				session,
				targetId,
				message,
				(text) => {
					if (!controller.signal.aborted && activeRequest.current === controller) {
						setContextStageEntry(null);
						setSwitchingToCpu(false);
						setStreamedAnswer((current) => current + text);
					}
				},
				controller.signal,
				firstTurnChoice,
				(reason) => {
					if (!controller.signal.aborted && activeRequest.current === controller) {
						setContextStageEntry(null);
						setStreamedAnswer("");
						setSwitchingToCpu(reason === "cpu_fallback");
					}
				},
				(stage) => {
					if (!controller.signal.aborted && activeRequest.current === controller) {
						setContextStageEntry(
							stage === "generation" ? null : { conversationId: targetId, stage },
						);
						if (stage === "summarization") {
							setDetailState((current) =>
								current?.id === targetId ? { ...current, hasSummary: true } : current,
							);
						}
					}
				},
			);
			if (selectedId !== targetId && !isNewConversation) return;
			const createdAt = new Date().toISOString();
			const userMessage: LumiMessage = {
				id: `local-user-${sendId}`,
				role: "user",
				content: message,
				createdAt,
				references: [],
				sources: [],
			};
			const assistantMessage: LumiMessage = {
				id: `local-assistant-${sendId}`,
				role: "assistant",
				content: result.answer.markdown,
				createdAt,
				references: result.answer.references,
				sources: result.answer.sources,
				finishReason: result.answer.finishReason ?? "stop",
			};
			setConversations((current) =>
				[
					result.conversation,
					...current.filter((item) => item.id !== result.conversation.id),
				].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
			);
			setDraftIds((current) => {
				const next = new Set(current);
				next.delete(targetId);
				return next;
			});
			setDetailState((current) => {
				const previous =
					current?.id === targetId
						? current
						: {
								id: targetId,
								conversation: result.conversation,
								messages: [],
								nextCursor: null,
								hasMore: false,
								hasSummary: false,
							};
				return {
					...previous,
					conversation: result.conversation,
					messages: [...previous.messages, userMessage, assistantMessage],
				};
			});
			setChoiceOverrideEntry(null);
			setComposer("");
			setPendingMessage(null);
			setStreamedAnswer("");
			setSwitchingToCpu(false);
			setContextStageEntry(null);
		} catch (error) {
			if (!controller.signal.aborted)
				setSendError(requestMessage(error, t("lumiSendFailed")));
		} finally {
			if (activeRequest.current === controller) activeRequest.current = null;
			setPendingMessage(null);
			setStreamedAnswer("");
			setSwitchingToCpu(false);
			setContextStageEntry(null);
			setSending(false);
		}
	};

	const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing)
			return;
		event.preventDefault();
		event.currentTarget.form?.requestSubmit();
	};

	const loadingDetail = Boolean(
		selectedId &&
		!activeIsDraft &&
		knownConversation &&
		detailState?.id !== selectedId,
	);
	const selectedModelSupportsThinking = selectedModel?.supportsThinking ?? false;
	const promptSuggestions = [
		t("lumiSuggestionTonight"),
		t("lumiSuggestionHiddenGems"),
		t("lumiSuggestionPlaylist"),
		t("lumiSuggestionSimilar"),
	];

	return (
		<main
			data-testid="lumi-overlay"
			className="fixed inset-0 z-[100] h-dvh overflow-hidden bg-[#070707] text-white"
		>
			{sidebarOpen && (
				<button
					type="button"
					aria-label={t("lumiCloseRecentChats")}
					onClick={() => setSidebarOpen(false)}
					className="fixed inset-0 z-20 bg-black/70 md:hidden"
				/>
			)}
			<div className="flex h-full min-h-0">
				<aside
					aria-label={t("lumiHistory")}
					className={`fixed inset-y-0 left-0 z-30 flex w-[min(18rem,88vw)] flex-col border-r border-white/[0.08] bg-[#080808] transition-transform duration-200 md:static md:z-auto md:w-[234px] md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
				>
					<div className="flex h-12 shrink-0 items-center gap-2 px-4 text-sm font-semibold">
						<Sparkles className="h-4 w-4 text-violet-300" />
						<span>Lumi</span>
					</div>
					<button
						type="button"
						onClick={createConversation}
						className="mx-3 flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 text-left text-xs font-medium text-white/75 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
					>
						<Plus className="h-3.5 w-3.5 text-neutral-500" />
						{t("lumiNewChat")}
					</button>
					<div className="px-4 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
						{t("lumiRecentLabel")}
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
						{listError ? (
							<p className="px-2 py-2 text-xs leading-5 text-rose-200/80" role="alert">
								{listError}
							</p>
						) : listLoading ? (
							<div
								className="flex items-center gap-2 px-2 py-2 text-xs text-white/40"
								role="status"
							>
								<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
								{t("loading")}
							</div>
						) : conversations.length === 0 ? (
							<p className="px-2 py-2 text-xs leading-5 text-white/35">
								{t("lumiNoHistory")}
							</p>
						) : (
							<ul className="space-y-1" aria-label={t("lumiHistory")}>
								{conversations.map((conversation) => {
									const selected = selectedId === conversation.id;
									const actionMenuOpen = chatActionMenuId === conversation.id;
									const title = conversation.title || t("lumiNewChat");
									return (
										<li key={conversation.id}>
											<div className="group relative">
												<button
													type="button"
													aria-current={selected ? "page" : undefined}
													onClick={() => selectConversation(conversation)}
													className={`w-full rounded-lg py-2 pl-2.5 pr-9 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 ${selected ? "bg-[#1c1921] text-white ring-1 ring-inset ring-violet-300/20" : "text-white/65 hover:bg-white/[0.05] hover:text-white"}`}
												>
													<span className="block truncate text-xs font-medium">{title}</span>
													<time
														className="mt-0.5 block text-[10px] text-white/35"
														dateTime={conversation.updatedAt}
													>
														{formatConversationDate(conversation.updatedAt, locale)}
													</time>
												</button>
												<div className="absolute right-1 top-1">
													<button
														type="button"
														aria-label={`${t("lumiChatOptions")}: ${title}`}
														aria-haspopup="menu"
														aria-expanded={actionMenuOpen}
														onClick={() =>
															setChatActionMenuId((current) =>
																current === conversation.id ? null : conversation.id,
															)
														}
														className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 opacity-100 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
													>
														<EllipsisVertical className="h-4 w-4 text-neutral-500" />
													</button>
													{actionMenuOpen && (
														<div
															role="menu"
															aria-label={`${t("lumiChatOptions")}: ${title}`}
															className="absolute right-0 top-full z-40 mt-1 w-40 rounded-xl border border-white/10 bg-[#151416] p-1.5 shadow-2xl shadow-black/60"
														>
															<button
																type="button"
																role="menuitem"
																onClick={() => beginRenameConversation(conversation)}
																className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-white/75 transition hover:bg-white/[0.07] hover:text-white"
															>
																<Pencil className="h-3.5 w-3.5 text-neutral-500" />
																{t("lumiRenameChat")}
															</button>
															<button
																type="button"
																role="menuitem"
																onClick={() => {
																	setChatActionMenuId(null);
																	setDeleteTarget(conversation);
																	setDeleteError(null);
																}}
																className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-200/80 transition hover:bg-rose-300/[0.09] hover:text-rose-100"
															>
																<Trash2 className="h-3.5 w-3.5" />
																{t("lumiDeleteChat")}
															</button>
														</div>
													)}
												</div>
											</div>
										</li>
									);
								})}
							</ul>
						)}
					</div>
					<div className="flex h-12 shrink-0 items-center gap-2.5 border-t border-white/[0.08] px-3">
						<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#242227] text-[11px] font-medium text-white/75">
							{(session.username || "Z").trim().slice(0, 1).toUpperCase()}
						</div>
						<span className="truncate text-xs text-white/60">{session.username}</span>
					</div>
				</aside>

				<section
					className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
					aria-label={t("lumiConversationPanel")}
				>
					<header className="flex h-[58px] shrink-0 items-center justify-between gap-3 px-3 sm:px-5">
						<div className="flex min-w-0 items-center gap-2">
							<button
								type="button"
								aria-label={t("lumiOpenRecentChats")}
								aria-expanded={sidebarOpen}
								onClick={() => setSidebarOpen(true)}
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/45 transition hover:bg-white/[0.06] hover:text-white md:hidden"
							>
								<Menu className="h-4 w-4 text-neutral-500" />
							</button>
							<div className="relative">
								<button
									type="button"
									aria-label={t("lumiChatOptions")}
									aria-expanded={conversationMenuOpen}
									onClick={() => setConversationMenuOpen((open) => !open)}
									className="flex h-9 w-9 items-center justify-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-white"
								>
									<MoreHorizontal className="h-4 w-4 text-neutral-500" />
								</button>
								{conversationMenuOpen && (
									<div className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-xl border border-white/10 bg-[#151416] p-1.5 shadow-2xl shadow-black/60">
										{choiceNotice && (
											<p className="px-2 py-1.5 text-xs text-white/55" role="status">
												{choiceNotice}
											</p>
										)}
										{choiceChanged && (
											<button
												type="button"
												onClick={() => void applyConversationChoice()}
												disabled={choiceBusy || sending}
												className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-white/75 transition hover:bg-white/[0.07] disabled:opacity-45"
											>
												{choiceBusy ? t("saving") : t("lumiApplyChoice")}
											</button>
										)}
										<button
											type="button"
											onClick={() => void saveDefaultChoice()}
											disabled={choiceBusy || sending || !choice.model}
											className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-white/75 transition hover:bg-white/[0.07] disabled:opacity-45"
										>
											{choiceBusy ? t("saving") : t("lumiMakeDefault")}
										</button>
									</div>
								)}
							</div>
						</div>

						<div className="flex min-w-0 shrink-0 items-center justify-end gap-2 sm:gap-3">
							<label className="min-w-0">
								<span className="sr-only">{t("lumiModel")}</span>
								<select
									aria-label={t("lumiModel")}
									value={choice.model}
									onChange={(event) => setChoiceModel(event.target.value)}
									disabled={models.length === 0 || sending || choiceBusy}
									className="h-9 max-w-[37vw] rounded-lg border border-white/10 bg-white/[0.035] px-2 text-xs text-white/75 outline-none transition focus:border-violet-300/40 disabled:opacity-50 sm:max-w-[13rem] sm:px-3 sm:text-sm [&>option]:bg-[#171719]"
								>
									{models.length === 0 && <option value="">{t("lumiNoModels")}</option>}
									{models.map((model) => (
										<option key={model.id} value={model.id}>
											{model.label}
										</option>
									))}
								</select>
							</label>
							<div className="flex h-9 items-center gap-2 rounded-lg px-1 text-[11px] text-white/55 sm:px-2 sm:text-xs">
								<span className="hidden sm:inline">{t("lumiThinking")}</span>
								<Toggle
									label={t("lumiThinking")}
									checked={choice.thinking && selectedModelSupportsThinking}
									disabled={!selectedModelSupportsThinking || sending || choiceBusy}
									onChange={(thinking) =>
										setChoiceOverrideEntry({
											conversationId: selectedId,
											choice: { ...choice, thinking },
										})
									}
								/>
							</div>
							<button
								type="button"
								aria-label={t("lumiClose")}
								title={t("lumiClose")}
								onClick={closeLumi}
								className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
							>
								<X className="h-4 w-4 text-neutral-500" />
							</button>
						</div>
					</header>
					{modelsError && (
						<p className="px-5 pb-2 text-xs text-rose-200/75" role="alert">
							{modelsError}
						</p>
					)}

					<div
						ref={messagesScrollRef}
						data-testid="lumi-message-scroller"
						onScroll={(event) => {
							const container = event.currentTarget;
							shouldFollowMessagesRef.current =
								container.scrollHeight - container.scrollTop - container.clientHeight <=
								96;
						}}
						className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 sm:px-6"
						aria-live="polite"
						aria-relevant="additions text"
					>
						{loadingDetail ? (
							<div className="flex flex-1 items-center justify-center text-sm text-white/45">
								<LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
								{t("lumiLoadingConversation")}
							</div>
						) : detailError ? (
							<div
								className="mx-auto my-auto flex max-w-lg items-start gap-3 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-4 text-sm leading-6 text-rose-100/85"
								role="alert"
							>
								<CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
								<span>{detailError}</span>
							</div>
						) : visibleMessages.length === 0 && !pendingMessage && !streamedAnswer ? (
							<div className="flex min-h-full flex-col items-center justify-center px-4 pb-24 text-center">
								<h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
									{t("lumiWelcome")}
								</h1>
								<p className="mt-2 max-w-md text-sm leading-6 text-white/45">
									{t("lumiWelcomeHint")}
								</p>
								<div className="mt-7 grid w-full max-w-[22rem] grid-cols-2 gap-2">
									{promptSuggestions.map((suggestion) => (
										<button
											key={suggestion}
											type="button"
											onClick={() => {
												setComposer(suggestion);
												composerRef.current?.focus();
											}}
											className="min-h-[52px] rounded-xl border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-left text-xs leading-5 text-white/65 transition hover:border-violet-300/25 hover:bg-violet-300/[0.06] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"
										>
											{suggestion}
										</button>
									))}
								</div>
							</div>
						) : (
							<div className="mx-auto flex w-full max-w-[620px] flex-col py-5">
								{activeHasSummary && (
									<p className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs leading-5 text-white/45">
										{t("lumiHistorySummaryNotice")}
									</p>
								)}
								{activeHasMore && (
									<div className="mb-3 flex flex-col items-center gap-1">
										<button
											type="button"
											disabled={historyLoading || sending}
											onClick={() => void loadEarlierMessages()}
											className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] px-3 py-1.5 text-xs text-white/50 transition hover:border-white/15 hover:text-white/75 disabled:cursor-wait disabled:opacity-45"
										>
											{historyLoading && (
												<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
											)}
											{t("lumiLoadEarlierMessages")}
										</button>
										{historyError && (
											<p className="text-xs text-rose-200/75" role="alert">
												{historyError}
											</p>
										)}
									</div>
								)}
								{visibleMessages.map((message) => (
									<ChatMessage key={message.id} message={message} session={session} />
								))}
								{pendingMessage && (
									<div
										className="my-3 ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[#242126] px-4 py-3 text-sm leading-6 text-white/90"
										aria-label={t("lumiYou")}
									>
										{pendingMessage}
									</div>
								)}
								{streamedAnswer && (
									<ChatMessage
										message={{
											id: `streaming-assistant-${sendSequence}`,
											role: "assistant",
											content: streamedAnswer,
											createdAt: "",
											references: [],
											sources: [],
										}}
										session={session}
										streaming
									/>
								)}
								{sending && (
									<div
										className="flex items-center gap-2 py-3 text-sm text-white/45"
										role="status"
									>
										<LoaderCircle className="h-4 w-4 animate-spin text-violet-200/75" />
										{switchingToCpu
											? t("lumiSwitchingToCpu")
											: contextStage === "context_expansion"
												? t("lumiExpandingChatMemory")
												: contextStage === "summarization"
													? t("lumiSummarizingEarlierMessages")
													: t("lumiThinkingStatus")}
									</div>
								)}
							</div>
						)}
					</div>

					<div className="shrink-0 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 sm:px-5 sm:pb-4">
						<div className="mx-auto max-w-[38rem]">
							{sendError && (
								<p
									className="mb-2 flex items-start gap-2 px-1 text-xs leading-5 text-rose-200/85"
									role="alert"
								>
									<CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
									{sendError}
								</p>
							)}
							<form
								onSubmit={(event) => void submitMessage(event)}
								className="rounded-2xl border border-white/[0.11] bg-[#151515] px-3 py-2 transition focus-within:border-white/20"
							>
								<label className="sr-only" htmlFor="lumi-composer">
									{t("lumiMessageLabel")}
								</label>
								<div className="flex items-end gap-2">
									<textarea
										ref={composerRef}
										id="lumi-composer"
										value={composer}
										onChange={(event) => setComposer(event.target.value)}
										onKeyDown={handleComposerKeyDown}
										placeholder={t("lumiMessagePlaceholder")}
										maxLength={6000}
										rows={1}
										disabled={sending || models.length === 0}
										className="max-h-40 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-2 text-sm leading-6 text-white outline-none placeholder:text-white/30 disabled:opacity-50"
									/>
									{sending ? (
										<button
											type="button"
											aria-label={t("lumiStopGenerating")}
											onClick={() => activeRequest.current?.abort()}
											className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-300 text-[#16131b] transition hover:bg-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-100"
										>
											<Square className="h-3.5 w-3.5 fill-current" />
										</button>
									) : (
										<button
											type="submit"
											disabled={
												!composer.trim() ||
												loadingDetail ||
												!choice.model ||
												models.length === 0
											}
											aria-label={t("lumiSend")}
											className="group mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#252329] text-white/35 transition hover:bg-violet-300 hover:text-[#16131b] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25"
										>
											<ArrowUp className="h-4 w-4 text-neutral-500 group-hover:text-[#16131b]" />
										</button>
									)}
								</div>
							</form>
							<div className="flex items-center justify-between px-1 pt-2 text-[10px] text-white/30">
								<span>{selectedModel?.label ?? t("lumi")}</span>
								<span>{t("lumiEnterHint")}</span>
							</div>
							<p className="mt-1 px-1 text-center text-[10px] leading-4 text-white/30">
								{t("lumiExperimentalNote")}
							</p>
						</div>
					</div>
				</section>
			</div>
			{renameTarget && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
					<form
						role="dialog"
						aria-modal="true"
						aria-labelledby="lumi-rename-title"
						onSubmit={(event) => void renameConversation(event)}
						className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151416] p-5 shadow-2xl shadow-black/60"
					>
						<h2 id="lumi-rename-title" className="text-base font-semibold text-white">
							{t("lumiRenameChat")}
						</h2>
						<label className="mt-4 block text-xs text-white/60">
							<span>{t("lumiChatName")}</span>
							<input
								autoFocus
								aria-label={t("lumiChatName")}
								value={renameValue}
								onChange={(event) => setRenameValue(event.target.value)}
								maxLength={120}
								className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-violet-300/45"
							/>
						</label>
						{renameError && (
							<p className="mt-2 text-xs text-rose-200" role="alert">
								{renameError}
							</p>
						)}
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								disabled={conversationActionBusy}
								onClick={() => setRenameTarget(null)}
								className="rounded-lg px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
							>
								{t("cancel")}
							</button>
							<button
								type="submit"
								disabled={conversationActionBusy || !renameValue.trim()}
								className="rounded-lg bg-violet-300 px-3 py-2 text-xs font-medium text-[#17131c] transition hover:bg-violet-200 disabled:opacity-50"
							>
								{conversationActionBusy ? t("saving") : t("save")}
							</button>
						</div>
					</form>
				</div>
			)}
			{deleteTarget && (
				<div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4">
					<div
						role="dialog"
						aria-modal="true"
						aria-labelledby="lumi-delete-title"
						className="w-full max-w-md rounded-2xl border border-white/10 bg-[#151416] p-5 shadow-2xl shadow-black/60"
					>
						<h2 id="lumi-delete-title" className="text-base font-semibold text-white">
							{t("lumiDeleteChat")}
						</h2>
						<p className="mt-2 text-sm leading-6 text-white/60">
							{t("lumiDeleteChatConfirm")}
						</p>
						<p className="mt-1 truncate text-xs text-white/40">
							{deleteTarget.title}
						</p>
						{deleteError && (
							<p className="mt-2 text-xs text-rose-200" role="alert">
								{deleteError}
							</p>
						)}
						<div className="mt-5 flex justify-end gap-2">
							<button
								type="button"
								disabled={conversationActionBusy}
								onClick={() => setDeleteTarget(null)}
								className="rounded-lg px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
							>
								{t("cancel")}
							</button>
							<button
								type="button"
								disabled={conversationActionBusy}
								onClick={() => void deleteConversation()}
								className="rounded-lg bg-rose-300 px-3 py-2 text-xs font-medium text-[#211214] transition hover:bg-rose-200 disabled:opacity-50"
							>
								{conversationActionBusy ? t("saving") : t("delete")}
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}

function ChatMessage({
	message,
	session,
	streaming = false,
}: {
	message: LumiMessage;
	session: AuthSession;
	streaming?: boolean;
}) {
	const { t } = useI18n();
	const isAssistant = message.role === "assistant";
	return (
		<article
			className={`flex w-full py-3 ${isAssistant ? "justify-start" : "justify-end"}`}
			aria-label={isAssistant ? t("lumiAssistant") : t("lumiYou")}
			aria-live={streaming ? "off" : undefined}
		>
			{isAssistant ? (
				<div className="min-w-0 w-full text-sm leading-6 text-white/90">
					<AnswerText message={message} session={session} />
					{message.finishReason === "context_exhausted" && (
						<p className="mt-2 text-xs text-amber-100/55" role="status">
							{t("lumiIncompleteContext")}
						</p>
					)}
					{message.finishReason === "deadline" && (
						<p className="mt-2 text-xs text-amber-100/55" role="status">
							{t("lumiIncompleteDeadline")}
						</p>
					)}
					<AnswerMetadata sources={message.sources} />
				</div>
			) : (
				<div className="max-w-[88%] rounded-2xl rounded-br-md bg-[#242126] px-4 py-3 text-sm leading-6 text-white/90 sm:max-w-[78%]">
					<div className="whitespace-pre-wrap break-words">{message.content}</div>
				</div>
			)}
		</article>
	);
}

function AnswerText({
	message,
	session,
}: {
	message: LumiMessage;
	session: AuthSession;
}) {
	const references = new Map(
		(message.references ?? []).map((reference) => [
			`${reference.type}:${reference.id}`,
			reference,
		]),
	);
	const contentWithoutCode = message.content.replace(/```[\s\S]*?```/g, "");
	const inlineReferenceKeys = new Set(
		Array.from(
			contentWithoutCode.matchAll(
				/:::zenstream\s*\{\s*type="([^"]+)"\s+id="([^"]+)"\s*\}/g,
			),
			(match) => `${match[1]}:${match[2]}`,
		),
	);
	const remainingReferences = [...references.values()].filter(
		(reference) => !inlineReferenceKeys.has(`${reference.type}:${reference.id}`),
	);
	return (
		<div className="break-words text-sm leading-7 text-white/85">
			<MarkdownContent
				content={message.content}
				references={references}
				session={session}
			/>
			{remainingReferences.length > 0 && (
				<div className="mt-3">
					{remainingReferences.map((reference) => (
						<LumiRecommendationCard
							key={`${reference.type}:${reference.id}`}
							reference={reference}
							session={session}
						/>
					))}
				</div>
			)}
		</div>
	);
}

type MarkdownBlock =
	| { kind: "paragraph" | "quote"; lines: string[] }
	| { kind: "heading"; level: number; text: string }
	| { kind: "list"; ordered: boolean; items: string[] }
	| { kind: "code"; text: string };

const markdownHeadingTags = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function MarkdownContent({
	content,
	references,
	session,
}: {
	content: string;
	references: Map<string, LumiEntityReference>;
	session: AuthSession;
}) {
	return (
		<div className="space-y-3">
			{parseMarkdownBlocks(content).map((block, index) => {
				if (block.kind === "heading") {
					const Heading = markdownHeadingTags[block.level - 1];
					const heading = (
						<MarkdownInline
							text={block.text}
							references={references}
							session={session}
						/>
					);
					return containsLumiReference(block.text) ? (
						<div key={index} className="font-semibold leading-snug text-white/95">
							{heading}
						</div>
					) : (
						<Heading key={index} className="font-semibold leading-snug text-white/95">
							{heading}
						</Heading>
					);
				}
				if (block.kind === "code") {
					return (
						<pre
							key={index}
							className="overflow-x-auto rounded-xl border border-white/10 bg-black/35 p-3 text-xs leading-5 text-white/75"
						>
							<code>{block.text}</code>
						</pre>
					);
				}
				if (block.kind === "list") {
					const List = block.ordered ? "ol" : "ul";
					return (
						<List
							key={index}
							className={`space-y-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}
						>
							{block.items.map((item, itemIndex) => (
								<li key={`${itemIndex}:${item}`}>
									<MarkdownInline
										text={item}
										references={references}
										session={session}
									/>
								</li>
							))}
						</List>
					);
				}
				const hasReference = block.lines.some(containsLumiReference);
				const Paragraph =
					block.kind === "quote" ? "blockquote" : hasReference ? "div" : "p";
				return (
					<Paragraph
						key={index}
						className={
							block.kind === "quote"
								? "border-l-2 border-violet-300/30 pl-3 text-white/65"
								: ""
						}
					>
						{block.lines.map((line, lineIndex) => (
							<Fragment key={`${lineIndex}:${line}`}>
								<MarkdownInline text={line} references={references} session={session} />
								{lineIndex < block.lines.length - 1 && <br />}
							</Fragment>
						))}
					</Paragraph>
				);
			})}
		</div>
	);
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
	const blocks: MarkdownBlock[] = [];
	const lines = content.split(/\r?\n/);
	let currentKind: "paragraph" | "quote" | "ul" | "ol" | null = null;
	let currentLines: string[] = [];
	const flush = () => {
		if (!currentKind || currentLines.length === 0) return;
		if (currentKind === "ul" || currentKind === "ol") {
			blocks.push({
				kind: "list",
				ordered: currentKind === "ol",
				items: currentLines,
			});
		} else {
			blocks.push({ kind: currentKind, lines: currentLines });
		}
		currentKind = null;
		currentLines = [];
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.trim()) {
			flush();
			continue;
		}
		if (/^\s*```/.test(line)) {
			flush();
			const codeLines: string[] = [];
			index += 1;
			while (index < lines.length && !/^\s*```/.test(lines[index])) {
				codeLines.push(lines[index].replace(/:::zenstream\s*(?:\{[^}]*\})?/g, ""));
				index += 1;
			}
			blocks.push({ kind: "code", text: codeLines.join("\n") });
			continue;
		}
		const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (heading) {
			flush();
			blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
			continue;
		}
		const list = line.match(/^\s*(?:([-+*])\s+|(\d+)[.)]\s+)(.*)$/);
		if (list) {
			const nextKind = list[2] ? "ol" : "ul";
			if (currentKind !== nextKind) flush();
			currentKind = nextKind;
			currentLines.push(list[3]);
			continue;
		}
		const quote = line.match(/^\s*>\s?(.*)$/);
		if (quote) {
			if (currentKind !== "quote") flush();
			currentKind = "quote";
			currentLines.push(quote[1]);
			continue;
		}
		if (currentKind !== "paragraph") flush();
		currentKind = "paragraph";
		currentLines.push(line);
	}
	flush();
	return blocks;
}

function MarkdownInline({
	text,
	references,
	session,
	emphasis = [],
}: {
	text: string;
	references: Map<string, LumiEntityReference>;
	session: AuthSession;
	emphasis?: Array<"strong" | "em">;
}) {
	const tokens =
		/\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_|:::zenstream\s*\{\s*type="([^"]+)"\s+id="([^"]+)"\s*\}|:::zenstream\s*\{[^}]*\}/g;
	const parts: ReactNode[] = [];
	let cursor = 0;
	let match: RegExpExecArray | null;
	let index = 0;
	let styledPartIndex = 0;
	const applyEmphasis = (node: ReactNode) => {
		let result = node;
		for (const [emphasisIndex, style] of emphasis.entries()) {
			const key = `inline-emphasis-${styledPartIndex}-${emphasisIndex}`;
			result =
				style === "strong" ? (
					<strong key={key} className="font-semibold text-white/95">
						{result}
					</strong>
				) : (
					<em key={key} className="italic text-white/90">
						{result}
					</em>
				);
		}
		styledPartIndex += 1;
		return result;
	};
	while ((match = tokens.exec(text)) !== null) {
		let before = text.slice(cursor, match.index);
		if (match[8] !== undefined && match[9] !== undefined) {
			const reference = references.get(`${match[8]}:${match[9]}`);
			if (reference) {
				const trimmed = before.trimEnd();
				const title = reference.title.trim();
				if (
					title.length > 0 &&
					trimmed.toLocaleLowerCase().endsWith(title.toLocaleLowerCase())
				) {
					before = trimmed.slice(0, trimmed.length - title.length);
				}
			}
		}
		if (before) parts.push(applyEmphasis(before));
		if (match[8] !== undefined && match[9] !== undefined) {
			const reference = references.get(`${match[8]}:${match[9]}`);
			parts.push(
				reference ? (
					<LumiRecommendationCard
						key={index}
						reference={reference}
						session={session}
					/>
				) : null,
			);
			const rest = text.slice(tokens.lastIndex);
			const duplicateTitle = rest.match(/^\s+\(([^)]+)\)/);
			if (
				reference &&
				duplicateTitle?.[1].trim().toLocaleLowerCase() ===
					reference.title.trim().toLocaleLowerCase()
			) {
				tokens.lastIndex += duplicateTitle[0].length;
			}
		} else if (match[10] !== undefined) {
			// Suppress malformed internal markers instead of exposing implementation text.
		} else if (match[1] !== undefined && match[2] !== undefined) {
			const href = safeExternalUrl(match[2]);
			const link = href ? (
				<a
					key={index}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className="text-violet-200 underline decoration-violet-200/30 underline-offset-2 hover:text-violet-100"
				>
					{match[1]}
				</a>
			) : (
				match[1]
			);
			parts.push(applyEmphasis(link));
		} else if (match[3] !== undefined || match[4] !== undefined) {
			parts.push(
				<MarkdownInline
					key={index}
					text={match[3] ?? match[4]}
					references={references}
					session={session}
					emphasis={[...emphasis, "strong"]}
				/>,
			);
		} else if (match[5] !== undefined) {
			parts.push(
				applyEmphasis(
					<code
						key={index}
						className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.9em] text-violet-100/90"
					>
						{match[5]}
					</code>,
				),
			);
		} else {
			parts.push(
				<MarkdownInline
					key={index}
					text={match[6] ?? match[7]}
					references={references}
					session={session}
					emphasis={[...emphasis, "em"]}
				/>,
			);
		}
		cursor = tokens.lastIndex;
		index += 1;
	}
	if (cursor < text.length) {
		const tail = text.slice(cursor);
		const partialMarkerIndex = tail.indexOf(":::zenstream");
		const visibleTail =
			partialMarkerIndex < 0 ? tail : tail.slice(0, partialMarkerIndex);
		if (visibleTail) parts.push(applyEmphasis(visibleTail));
	}
	return <>{parts}</>;
}

function containsLumiReference(text: string) {
	return /:::zenstream\s*\{/.test(text);
}

const supportedReferenceTypes: Record<string, string[]> = {
	movie: ["Movie"],
	series: ["Series"],
	season: ["Season"],
	episode: ["Episode"],
	album: ["MusicAlbum"],
	release: ["MusicAlbum"],
	artist: ["MusicArtist"],
	track: ["Audio"],
	collection: ["BoxSet"],
};

function LumiRecommendationCard({
	reference,
	session,
}: {
	reference: LumiEntityReference;
	session: AuthSession;
}) {
	const [resolution, setResolution] = useState<{
		key: string;
		item: MediaItem | null;
	} | null>(null);
	const referenceKey = `${session.userId}:${reference.type}:${reference.id}`;
	useEffect(() => {
		let current = true;
		if (!supportedReferenceTypes[reference.type]) {
			return () => {
				current = false;
			};
		}
		void getItem(session, reference.id)
			.then((result) => {
				if (current) {
					setResolution({
						key: referenceKey,
						item:
							result.Id === reference.id &&
							supportedReferenceTypes[reference.type].includes(result.Type ?? "")
								? result
								: null,
					});
				}
			})
			.catch(() => {
				if (current) setResolution({ key: referenceKey, item: null });
			});
		return () => {
			current = false;
		};
	}, [reference.id, reference.type, referenceKey, session]);
	if (!supportedReferenceTypes[reference.type]) return null;
	const resolved = resolution?.key === referenceKey;
	const item = resolved ? resolution.item : null;
	if (resolved && !item) return null;
	if (!item) {
		return (
			<div
				aria-hidden="true"
				className="my-3 h-36 w-full animate-pulse rounded-xl border border-white/10 bg-white/[0.04]"
			/>
		);
	}
	return (
		<MediaBannerCard item={item} href={catalogReferenceHref(reference, item)} />
	);
}

function AnswerMetadata({ sources }: { sources: LumiSource[] }) {
	const { t } = useI18n();
	const safeSources = sources.flatMap((source) => {
		const safeUrl = safeExternalUrl(source.url);
		const safeFaviconUrl = source.faviconUrl
			? safeExternalUrl(source.faviconUrl)
			: null;
		return safeUrl ? [{ ...source, safeUrl, safeFaviconUrl }] : [];
	});
	return (
		<div className="mt-4 space-y-3">
			{safeSources.length > 0 && (
				<section aria-label={t("lumiSources")}>
					<h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
						{t("lumiSources")}
					</h3>
					<ul className="space-y-1.5">
						{safeSources.map((source, index) => (
							<li key={`${source.safeUrl}:${index}`}>
								<a
									href={source.safeUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="group inline-flex max-w-full items-start gap-2 text-xs text-white/60 transition hover:text-white/90"
								>
									<span className="relative mt-0.5 h-3.5 w-3.5 shrink-0">
										<Globe2 className="absolute inset-0 h-3.5 w-3.5 text-neutral-500" />
										{source.safeFaviconUrl && (
											<img
												data-testid="lumi-source-favicon"
												src={source.safeFaviconUrl}
												alt=""
												aria-hidden="true"
												loading="lazy"
												referrerPolicy="no-referrer"
												className="relative h-3.5 w-3.5 rounded-sm"
												onError={(event) => {
													event.currentTarget.style.display = "none";
												}}
											/>
										)}
									</span>
									<span className="min-w-0">
										<span className="block truncate">
											{source.title || source.websiteName}
										</span>
										<span className="mt-0.5 block truncate text-white/30 group-hover:text-white/45">
											{source.websiteName}
										</span>
									</span>
									<ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-70 text-neutral-500" />
								</a>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}

function catalogReferenceHref(reference: LumiEntityReference, item: MediaItem) {
	if (!supportedReferenceTypes[reference.type]?.includes(item.Type ?? ""))
		return null;
	if (reference.type === "season") {
		return item.SeriesId
			? `/show/${encodeURIComponent(item.SeriesId)}?seasonId=${encodeURIComponent(item.Id)}`
			: null;
	}
	if (reference.type === "episode" && !item.SeriesId) return null;
	if (reference.type === "track" && !item.AlbumId) return null;
	return detailHref(item);
}

function safeExternalUrl(value: string) {
	try {
		const parsed = new URL(value);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.href
			: null;
	} catch {
		return null;
	}
}

function requestMessage(error: unknown, fallback: string) {
	return error instanceof Error && error.message ? error.message : fallback;
}

function createConversationId() {
	const cryptoApi = window.crypto;
	if (typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
	const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	return [...bytes]
		.map(
			(byte, index) =>
				`${index === 4 || index === 6 || index === 8 || index === 10 ? "-" : ""}${byte.toString(16).padStart(2, "0")}`,
		)
		.join("");
}

function lumiConversationHref(conversationId: string, returnTo: string) {
	const params = new URLSearchParams({ conversation: conversationId });
	if (returnTo !== "/") params.set("returnTo", returnTo);
	return `/lumi?${params.toString()}`;
}

function safeLumiReturnTo(candidate: string | null) {
	if (
		!candidate ||
		!candidate.startsWith("/") ||
		candidate.startsWith("//") ||
		candidate.includes("\\") ||
		/^\/(%2f|%5c)/i.test(candidate)
	)
		return "/";
	try {
		const url = new URL(candidate, "https://zenstream.invalid");
		const decodedPath = decodeURIComponent(url.pathname);
		if (
			url.origin !== "https://zenstream.invalid" ||
			decodedPath === "/lumi" ||
			decodedPath.startsWith("/lumi/")
		)
			return "/";
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return "/";
	}
}

function formatConversationDate(value: string, locale: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}
