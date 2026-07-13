"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search, Settings, User, Users } from "lucide-react";
import { SearchOverlay } from "@/components/layout/search-overlay";
import { userImageUrl } from "@/lib/jellyfin";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";

export function Navbar({
	displayName,
	userId,
	onLogout,
	session,
}: {
	displayName: string;
	userId: string;
	onLogout: () => void;
	session?: AuthSession;
}) {
	const { t } = useI18n();
	const pathname = usePathname();
	const [searchOpen, setSearchOpen] = useState(false);
	const [profileOpen, setProfileOpen] = useState(false);
	const [groupsOpen, setGroupsOpen] = useState(false);
	const { groups, active, create, join, leave, setControls } = useSyncplay();

	return (
		<>
			<nav className="absolute left-0 right-0 top-0 z-50 flex h-16 items-center gap-6 px-4 md:h-20 md:px-12">
				<div className="relative flex w-full items-center gap-8">
					<Link href="/" className="flex shrink-0 items-center">
						<img
							src="/icon.png"
							alt="ZenStream"
							className="h-9 w-9 object-contain md:h-10 md:w-10"
						/>
					</Link>
					<div className="hidden items-center gap-1 md:flex">
						<Link
							className={`rounded px-3 py-1.5 text-sm font-medium tracking-wide ${pathname === "/" ? "text-white" : "text-white/35 hover:text-white/70"}`}
							href="/"
						>
							{t("home")}
						</Link>
						<Link
							href="/library"
							className={`rounded px-3 py-1.5 text-sm font-medium tracking-wide ${pathname === "/library" ? "text-white" : "text-white/35 hover:text-white/70"}`}
						>
							{t("library")}
						</Link>
						<Link
							href="/favorites"
							className={`rounded px-3 py-1.5 text-sm font-medium tracking-wide ${pathname === "/favorites" ? "text-white" : "text-white/35 hover:text-white/70"}`}
						>
							{t("favorites")}
						</Link>
					</div>
					<div className="flex-1" />
					<div data-testid="header-actions" className="flex items-center gap-2 sm:gap-3">
						<div className="relative">
							<button
								aria-label={t("syncplayGroups")}
								onClick={() => setGroupsOpen((open) => !open)}
								className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
							>
								<Users className="h-[22px] w-[22px]" />
							</button>
							{groupsOpen && (
							<div data-testid="navbar-group-popup" className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-[90] max-h-[calc(100dvh-5rem)] w-auto max-w-none overflow-y-auto rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:w-80 md:max-w-[calc(100vw-2rem)] md:overflow-hidden">
								<div className="mb-2 flex items-center justify-between">
									<p className="text-xs font-semibold text-white">
										{t("syncplayGroups")}
									</p>
									<button
										onClick={() => void create().catch(() => undefined)}
										className="rounded-lg bg-violet-400 px-3 py-1.5 text-xs font-semibold text-black"
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
											className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-white/5"
										>
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
												onClick={() =>
											void (active?.id === group.id
													? leave()
													: join(group.id)).catch(() => undefined)
												}
												className="rounded-lg px-2 py-1.5 text-xs text-violet-200 hover:bg-white/10"
											>
												{active?.id === group.id
													? t("leaveGroup")
													: t("joinView")}
											</button>
										</div>
									))
								)}
								{active?.hostUserId === userId && (
									<label className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-xs text-white/60">
										<input
											type="checkbox"
											checked={active.allowViewerControls}
										onChange={(e) => void setControls(e.target.checked).catch(() => undefined)}
										/>
										{t("allowViewerControls")}
									</label>
								)}
							</div>
						)}
					</div>
						<button
						aria-label={t("search")}
						onClick={() => setSearchOpen(true)}
						className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
					>
						<Search className="h-[22px] w-[22px]" />
					</button>
						<button
						aria-label={t("notifications")}
						className="relative flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
					>
						<Bell className="h-[22px] w-[22px]" />
						<span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-violet-400" />
					</button>
						<div className="relative">
						<button
							aria-label={t("profile")}
							onClick={() => setProfileOpen((open) => !open)}
							className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/8 text-white/70 transition hover:border-violet-400/60"
						>
							<UserAvatar key={userId} userId={userId} />
						</button>
						{profileOpen && (
							<div
								data-testid="profile-popup"
								className="absolute right-0 top-full z-[90] mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-black/25 shadow-2xl shadow-black/40 backdrop-blur-xl"
							>
								<div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
									<p className="truncate text-xs font-semibold text-white">
										{displayName}
									</p>
								</div>
								<Link
									href="/settings"
									onClick={() => setProfileOpen(false)}
									className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs text-white/70 transition hover:bg-white/[0.06] hover:text-white"
								>
									<Settings className="h-3.5 w-3.5" />
									{t("settings")}
								</Link>
								<button
									onClick={onLogout}
									className="flex w-full items-center gap-2.5 border-t border-white/[0.06] px-4 py-3 text-left text-xs text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300"
								>
									<LogOut className="h-3.5 w-3.5" />
									{t("logout")}
								</button>
							</div>
							)}
						</div>
					</div>
				</div>
			</nav>
			{searchOpen && session && (
				<SearchOverlay session={session} onClose={() => setSearchOpen(false)} />
			)}
		</>
	);
}

function UserAvatar({ userId }: { userId: string }) {
	const [imageFailed, setImageFailed] = useState(false);

	if (imageFailed) {
		return <User data-testid="default-user-icon" className="h-5 w-5" />;
	}

	return (
		<img
			src={userImageUrl(userId)}
			alt=""
			className="h-full w-full object-cover"
			onError={() => setImageFailed(true)}
		/>
	);
}
