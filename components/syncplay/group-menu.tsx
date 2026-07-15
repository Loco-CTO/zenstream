"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSyncplay } from "@/lib/syncplay";

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
	const {
		groups,
		active,
		currentMember,
		create,
		join,
		leave,
		setControls,
		removeMember,
		setWatchingTogether,
	} = useSyncplay();
	const panelClass = playerContext
		? "fixed inset-x-3 bottom-3 z-[90] max-h-[calc(100dvh-1.5rem)] w-auto max-w-none overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-80 md:max-w-[calc(100vw-2rem)] md:overflow-hidden"
		: "fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-[90] max-h-[calc(100dvh-5rem)] w-auto max-w-none overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-80 md:max-w-[calc(100vw-2rem)] md:overflow-hidden";

	async function returnToView(group = active) {
		if (!group?.itemId) return;
		if (active?.id !== group.id || !currentMember) {
			await join(group.id).catch(() => undefined);
		}
		void setWatchingTogether(true).catch(() => undefined);
		router.push(`/play/${encodeURIComponent(group.itemId)}`);
		setOpen(false);
	}

	return (
		<div className="relative" data-player-context={playerContext || undefined}>
			<button
				aria-label={t("syncplayGroups")}
				onClick={() => setOpen((value) => !value)}
				className={
					buttonClassName ??
					"flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
				}
			>
				<Users className="h-[22px] w-[22px]" />
			</button>
			{open && (
				<div
					data-player-context={playerContext || undefined}
					className={panelClass}
				>
					<div className="mb-2 flex items-center justify-between">
						<p className="text-xs font-semibold text-white">
							{t("syncplayGroups")}
						</p>
						<button
							disabled={Boolean(active)}
							onClick={() => void create().catch(() => undefined)}
							className="rounded-lg bg-violet-400 px-3 py-1.5 text-xs font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
						>
							{t("createGroup")}
						</button>
					</div>
					{groups.length === 0 ? (
						<p className="px-2 py-4 text-xs text-white/45">
							{t("noSyncplayGroups")}
						</p>
					) : (
						groups.map((group) => (
							<div
								key={group.id}
								className="rounded-lg px-2 py-2 hover:bg-white/5"
							>
								<div className="flex items-center gap-2">
									<div className="min-w-0 flex-1">
										<p className="truncate text-xs text-white/85">
											{group.name}
										</p>
										<p className="truncate text-xs text-white/45">
											{group.itemId
												? t("syncplayWatching")
												: t("syncplayNoMedia")}{" "}
											· {group.members.length}
										</p>
									</div>
									<button
										disabled={Boolean(active && active.id !== group.id)}
										onClick={() =>
											void (
												active?.id === group.id ? leave() : join(group.id)
											).catch(() => undefined)
										}
										className="rounded-lg px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
									>
										{active?.id === group.id ? t("leaveGroup") : t("joinView")}
									</button>
								</div>
				{group.members.length > 0 && (
									<div className="mt-2 space-y-1 border-t border-white/10 pt-2">
										{group.members.map((member) => (
											<div
												key={member.participantId ?? member.userId}
												className="flex items-center gap-2 text-xs"
											>
												<span className="min-w-0 flex-1 truncate text-white/65">
													{member.username}
												</span>
												<span
													className={
														member.watchingTogether !== false
															? "text-emerald-200/75"
															: "text-white/35"
													}
												>
													{member.watchingTogether !== false
														? t("syncplayViewingTogether")
														: t("syncplayBrowsing")}
												</span>
								{active?.id === group.id && active.hostUserId === userId &&
													member.userId !== userId && (
														<button
															onClick={() =>
																void removeMember(member.userId).catch(
																	() => undefined,
																)
															}
															className="text-red-200 hover:text-red-100"
														>
															{t("syncplayRemoveMember", {
																member: member.username,
															})}
														</button>
													)}
											</div>
										))}
									</div>
								)}
								{group.itemId && active?.id !== group.id && (
										<button
											type="button"
											onClick={() => void returnToView(group)}
											className="mt-2 w-full rounded-lg bg-violet-400 px-3 py-2 text-xs font-semibold text-black"
										>
											{t("syncplayReturnToView")}
										</button>
									)}
							</div>
						))
					)}
					{active?.itemId && (
						<button
							type="button"
							onClick={() => void returnToView()}
							className="mt-2 w-full rounded-lg bg-violet-400 px-3 py-2 text-xs font-semibold text-black"
						>
							{t("syncplayReturnToView")}
						</button>
					)}
					{active?.hostUserId === userId && (
						<label className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-white/60">
							<input
								type="checkbox"
								checked={active.allowViewerControls}
								onChange={(event) =>
									void setControls(event.target.checked).catch(() => undefined)
								}
							/>
							{t("allowViewerControls")}
						</label>
					)}
				</div>
			)}
		</div>
	);
}
