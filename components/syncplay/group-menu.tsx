"use client";

import { useState } from "react";
import { userImageUrl, userInitial } from "@/lib/media-api";
import { useRouter } from "next/navigation";
import {
	ChevronLeft,
	ChevronRight,
	Crown,
	Plus,
	Users,
	X,
	Trash2,
	Eye,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSyncplay } from "@/lib/syncplay";
import { Checkbox } from "@/components/ui/checkbox";

export function SyncplayGroupMenu({
	userId,
	buttonClassName,
	playerContext = false,
}: {
	userId: string;
	buttonClassName?: string;
	playerContext?: boolean;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [showGroupList, setShowGroupList] = useState(true);
	const {
		groups,
		active,
		currentMember,
		refresh,
		create,
		join,
		leave,
		setControls,
		removeMember,
		setWatchingTogether,
	} = useSyncplay();
	const panelClass = playerContext
		? "fixed inset-x-3 bottom-3 z-[90] max-h-[calc(100dvh-1.5rem)] w-auto max-w-none overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-[22rem] md:max-w-[calc(100vw-2rem)] md:overflow-hidden"
		: "fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-[90] max-h-[calc(100dvh-5rem)] w-auto max-w-none overflow-y-auto rounded-xl border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-[22rem] md:max-w-[calc(100vw-2rem)] md:overflow-hidden";

	async function returnToView(group = active) {
		if (!group?.itemId) return;
		if (active?.id !== group.id || !currentMember)
			await join(group.id).catch(() => undefined);
		void setWatchingTogether(true).catch(() => undefined);
		router.push(`/play/${encodeURIComponent(group.itemId)}`);
		setOpen(false);
	}

	return (
		<div className="relative" data-player-context={playerContext || undefined}>
			<button
				aria-label={t("syncplayGroups")}
				onClick={() => {
					setOpen((value) => !value);
					setShowGroupList(!active);
					void refresh().catch(() => undefined);
				}}
				className={
					buttonClassName ??
					"flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
				}
			>
				<Users className="h-[22px] w-[22px]" />
			</button>
			{open && (
				<div
					data-testid="syncplay-group-popup"
					data-player-context={playerContext || undefined}
					className={panelClass}
				>
					{active && !showGroupList ? (
						<ActiveGroupView
							group={active}
							userId={userId}
							onBack={() => setShowGroupList(true)}
							onLeave={() => void leave().catch(() => undefined)}
							onRemoveMember={(memberId) =>
								void removeMember(memberId).catch(() => undefined)
							}
							onControls={(checked) =>
								void setControls(checked).catch(() => undefined)
							}
							onReturn={() => void returnToView(active)}
							t={t}
						/>
					) : (
						<>
							<div className="flex items-center justify-between border-b border-white/[0.08] px-3 pb-3 pt-2">
								<div>
									<p className="text-sm font-semibold tracking-tight text-white">
										{t("syncplayGroups")}
									</p>
									<p className="mt-0.5 text-[10px] text-white/40">
										{groups.length}{" "}
										{t(groups.length === 1 ? "syncplayRoom" : "syncplayRooms")}
									</p>
								</div>
								<button
									disabled={Boolean(active)}
									onClick={() => void create().catch(() => undefined)}
									className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
								>
									<Plus className="h-3.5 w-3.5" />
									{t("createGroup")}
								</button>
							</div>
							<div className="space-y-2 pb-0 pt-2">
								{groups.length === 0 ? (
									<div className="px-3 py-8 text-center">
										<Users className="mx-auto mb-2 h-6 w-6 text-white/20" />
										<p className="text-xs text-white/45">
											{t("noSyncplayGroups")}
										</p>
									</div>
								) : (
									groups.map((group) => {
										const isMember = group.members.some(
											(member) => member.userId === userId,
										);
										const isActive = active?.id === group.id;
										return (
											<div
												key={group.id}
												className={`rounded-xl border px-3 py-3 transition ${isActive ? "border-violet-300/30 bg-violet-400/[0.08]" : "border-transparent hover:bg-white/[0.05]"}`}
											>
												<div className="flex items-start gap-3">
													<div
														className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isActive ? "bg-violet-300/20 text-violet-200" : "bg-white/[0.08] text-white/45"}`}
													>
														<Users className="h-4 w-4" />
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-1.5">
															<p className="truncate text-xs font-medium text-white/90">
																{group.name}
															</p>
														</div>
														<p className="mt-1 truncate text-[10px] text-white/40">
															{group.members.length}{" "}
															{group.members.length === 1
																? t("syncplayMember")
																: t("syncplayMembers")}
														</p>
													</div>
													{isActive && (
														<button
															type="button"
															aria-label={t("syncplayGroups")}
															onClick={() => setShowGroupList(false)}
															className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
														>
															<ChevronRight className="h-4 w-4" />
														</button>
													)}
													<button
														disabled={Boolean(active && !isActive)}
														onClick={() =>
															void (isActive ? leave() : join(group.id)).catch(
																() => undefined,
															)
														}
														className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${isActive ? "text-white/50 hover:bg-white/10 hover:text-red-200" : "bg-white text-black hover:bg-violet-100"}`}
													>
														{isActive ? (
															<>
																<X className="h-3 w-3" />
																{t("leaveGroup")}
															</>
														) : (
															<>
																{t("joinView")}
																<ChevronRight className="h-3 w-3" />
															</>
														)}
													</button>
												</div>
												{isMember && (
													<div className="mt-3 border-t border-white/[0.07] pt-2.5">
														<div className="space-y-2">
															{group.members.map((member) => (
																<div
																	key={member.participantId ?? member.userId}
																	className="relative flex items-center gap-2 pr-10 text-xs"
																>
																	<div className="relative shrink-0">
																		<MemberAvatar
																			userId={member.userId}
																			username={member.username}
																			size="sm"
																		/>
																		{member.watchingTogether !== false && (
																			<Eye className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-violet-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] stroke-[2.5]" />
																		)}
																	</div>
																	<span className="min-w-0 flex-1 truncate text-white/60">
																		{member.username}
																		{member.userId === group.hostUserId && (
																			<Crown className="ml-1 inline-block h-3 w-3 align-[-1px] text-amber-200/70" />
																		)}
																	</span>
																	{isActive &&
																		active.hostUserId === userId &&
																		member.userId !== userId && (
																			<button
																				onClick={() =>
																					void removeMember(
																						member.userId,
																					).catch(() => undefined)
																				}
																				aria-label={t("syncplayRemoveMember", {
																					member: member.username,
																				})}
																				title={t("syncplayRemoveMember", {
																					member: member.username,
																				})}
																				className="absolute right-0 rounded-md p-1 text-red-100/45 transition hover:bg-red-200/10 hover:text-red-100"
																			>
																				<Trash2 className="h-3.5 w-3.5" />
																			</button>
																		)}
																</div>
															))}
														</div>
													</div>
												)}
												{isMember && group.itemId && (
													<button
														type="button"
														onClick={() => void returnToView(group)}
														className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg bg-violet-300 px-3 py-2.5 text-xs font-semibold text-black transition hover:bg-violet-200"
													>
														{t("syncplayReturnToView")}
														<ChevronRight className="h-3 w-3" />
													</button>
												)}
											</div>
										);
									})
								)}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}

function MemberAvatar({
	userId,
	username,
	size,
}: {
	userId: string;
	username: string;
	size: "sm" | "md";
}) {
	const [failed, setFailed] = useState(false);
	const dimensions = size === "md" ? "h-6 w-6" : "h-5 w-5";
	const imageUrl = userImageUrl(userId);
	return !imageUrl || failed ? (
		<span
			className={
				dimensions +
				" flex items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white/60"
			}
		>
			{userInitial(username)}
		</span>
	) : (
		<img
			src={imageUrl}
			alt=""
			onError={() => setFailed(true)}
			className={dimensions + " rounded-full bg-white/10 object-cover"}
		/>
	);
}

function ActiveGroupView({
	group,
	userId,
	onBack,
	onLeave,
	onRemoveMember,
	onControls,
	onReturn,
	t,
}: {
	group: ReturnType<typeof useSyncplay>["active"] & object;
	userId: string;
	onBack: () => void;
	onLeave: () => void;
	onRemoveMember: (id: string) => void;
	onControls: (checked: boolean) => void;
	onReturn: () => void;
	t: ReturnType<typeof useI18n>["t"];
}) {
	return (
		<>
			<div className="flex items-center gap-2 border-b border-white/[0.08] px-1 pb-3 pt-1">
				<button
					onClick={onBack}
					aria-label={t("syncplayBackToGroups")}
					className="rounded-md p-1 text-white/45 transition hover:bg-white/10 hover:text-white"
				>
					<ChevronLeft className="h-4 w-4" />
				</button>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-white">
						{group.name}
					</p>
					<p className="mt-0.5 text-xs text-white/40">
						{group.members.length}{" "}
						{t(
							group.members.length === 1 ? "syncplayMember" : "syncplayMembers",
						)}
					</p>
				</div>
			</div>
			<div className="px-1 py-3">
				<p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/35">
					{t("syncplayMembersHeading")}
				</p>
				<div className="space-y-2">
					{group.members.map((member) => (
						<div
							key={member.participantId ?? member.userId}
							className="relative flex items-center gap-2 pr-10 text-xs"
						>
							<div className="relative shrink-0">
								<MemberAvatar
									userId={member.userId}
									username={member.username}
									size="md"
								/>
								{member.watchingTogether !== false && (
									<Eye className="absolute -bottom-1 -right-1 h-3.5 w-3.5 text-violet-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)] stroke-[2.5]" />
								)}
							</div>
							<span className="min-w-0 flex-1 truncate text-white/70">
								{member.username}
								{member.userId === group.hostUserId && (
									<Crown className="ml-1 inline-block h-3 w-3 align-[-1px] text-amber-200/70" />
								)}
							</span>
							{group.hostUserId === userId && member.userId !== userId && (
								<button
									onClick={() => onRemoveMember(member.userId)}
									aria-label={t("syncplayRemoveMember", {
										member: member.username,
									})}
									title={t("syncplayRemoveMember", { member: member.username })}
									className="absolute right-0 rounded-md p-1 text-red-100/45 transition hover:bg-red-200/10 hover:text-red-100"
								>
									<Trash2 className="h-3.5 w-3.5" />
								</button>
							)}
						</div>
					))}
				</div>
			</div>
			{group.itemId && (
				<button
					type="button"
					onClick={onReturn}
					className="mb-3 flex w-full items-center justify-center gap-1 rounded-lg bg-violet-300 px-3 py-2.5 text-xs font-semibold text-black transition hover:bg-violet-200"
				>
					{t("syncplayReturnToView")}
					<ChevronRight className="h-3 w-3" />
				</button>
			)}
			{group.hostUserId === userId && (
				<div className="border-t border-white/[0.08] px-1 pt-3">
					<Checkbox
						checked={group.allowViewerControls}
						onChange={onControls}
						label={t("allowViewerControls")}
					/>
				</div>
			)}
			<button
				onClick={onLeave}
				className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300/15 px-3 py-2.5 text-xs text-red-200/65 transition hover:bg-red-400/10 hover:text-red-200"
			>
				<X className="h-3 w-3" />
				{t("leaveGroup")}
			</button>
		</>
	);
}

