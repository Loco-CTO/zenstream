"use client";

import Link from "next/link";
import {
	CalendarDays,
	Home,
	LayoutGrid,
	Library,
	Sparkles,
} from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function MobileNav() {
	const { t } = useI18n();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const currentQuery = searchParams.toString();
	const lumiReturnTo =
		pathname && pathname !== "/lumi"
			? `${pathname}${currentQuery ? `?${currentQuery}` : ""}`
			: "/";
	const lumiHref = `/lumi?returnTo=${encodeURIComponent(lumiReturnTo)}`;
	return (
		<nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center justify-around border-t border-white/5 bg-black/65 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl md:hidden">
			<Link
				href="/"
				className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 ${pathname === "/" ? "text-violet-400" : "text-white/30"}`}
			>
				<Home className="h-5 w-5" />
				<span className="text-xs font-medium uppercase tracking-[0.12em]">
					{t("home")}
				</span>
			</Link>
			<Link
				href="/library"
				className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 ${pathname === "/library" ? "text-violet-400" : "text-white/30"}`}
			>
				<Library className="h-5 w-5" />
				<span className="text-xs font-medium uppercase tracking-[0.12em]">
					{t("library")}
				</span>
			</Link>
			<Link
				href="/my-lists"
				className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 ${pathname === "/my-lists" || pathname === "/favorites" || pathname.startsWith("/playlist/") || pathname.startsWith("/shared/playlist/") ? "text-violet-400" : "text-white/30"}`}
			>
				<LayoutGrid className="h-5 w-5" />
				<span className="text-xs font-medium uppercase tracking-[0.12em]">
					{t("myLists")}
				</span>
			</Link>
			<Link
				href="/calendar"
				className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 ${pathname === "/calendar" ? "text-violet-400" : "text-white/30"}`}
			>
				<CalendarDays className="h-5 w-5" />
				<span className="text-xs font-medium uppercase tracking-[0.12em]">
					{t("calendar")}
				</span>
			</Link>
			<Link
				href={lumiHref}
				aria-current={pathname === "/lumi" ? "page" : undefined}
				className={`flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-2 ${pathname === "/lumi" ? "text-violet-400" : "text-white/30"}`}
			>
				<Sparkles className="h-5 w-5" />
				<span className="text-xs font-medium uppercase tracking-[0.12em]">
					{t("lumi")}
				</span>
			</Link>
		</nav>
	);
}
