"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSyncplay } from "@/lib/syncplay";

export function SyncplayGroupMenu({ userId, buttonClassName, playerContext = false }: { userId: string; buttonClassName?: string; playerContext?: boolean }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const { groups, active, create, join, leave, removeMember } = useSyncplay();
	return <div className="relative" data-player-context={playerContext || undefined}>
		<button aria-label={t("syncplayGroups")} onClick={() => setOpen((value) => !value)} className={buttonClassName ?? "flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"}><Users className="h-[22px] w-[22px]" /></button>
		{open && <div data-player-context={playerContext || undefined} className="absolute right-0 top-full z-[90] mt-2 w-80 rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
			<div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-white">{t("syncplayGroups")}</p><button onClick={() => void create().catch(() => undefined)} className="rounded-lg bg-violet-400 px-3 py-1.5 text-xs font-semibold text-black">{t("createGroup")}</button></div>
			{groups.length === 0 ? <p className="px-2 py-4 text-xs text-white/45">{t("noSyncplayGroups")}</p> : groups.map((group) => <div key={group.id} className="rounded-lg px-2 py-2 hover:bg-white/5"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs text-white/85">{group.name}</p><p className="truncate text-xs text-white/45">{group.itemId ? t("syncplayWatching") : t("syncplayNoMedia")} · {group.members.length}</p></div><button onClick={() => void (active?.id === group.id ? leave() : join(group.id)).catch(() => undefined)} className="rounded-lg px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10">{active?.id === group.id ? t("leaveGroup") : t("joinView")}</button></div>{active?.id === group.id && active.hostUserId === userId && group.members.filter((member) => member.userId !== userId && (!member.viewing || member.loading)).map((member) => <button key={member.userId} onClick={() => void removeMember(member.userId).catch(() => undefined)} className="mt-1 text-xs text-red-200 hover:text-red-100">{t("syncplayRemoveMember", { member: member.username })}</button>)}</div>)}
			{active?.hostUserId === userId && <label className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-white/60"><input type="checkbox" checked={active.allowViewerControls} onChange={(event) => void setControls(event.target.checked).catch(() => undefined)} />{t("allowViewerControls")}</label>}
		</div>}
	</div>;
}
