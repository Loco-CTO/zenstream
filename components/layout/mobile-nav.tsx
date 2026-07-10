"use client";

import Link from "next/link";
import { Heart, Home, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export function MobileNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/5 bg-black/65 backdrop-blur-2xl md:hidden">
      <Link href="/" className={`flex flex-col items-center gap-1.5 px-5 py-2 ${pathname === "/" ? "text-violet-400" : "text-white/30"}`}>
        <Home className="h-[22px] w-[22px]" />
        <span className="text-xs font-medium uppercase tracking-widest">{t("home")}</span>
      </Link>
      <Link href="/library" className={`flex flex-col items-center gap-1.5 px-5 py-2 ${pathname === "/library" ? "text-violet-400" : "text-white/30"}`}>
        <Search className="h-[22px] w-[22px]" />
        <span className="text-xs font-medium uppercase tracking-widest">{t("library")}</span>
      </Link>
      <Link href="/favorites" className={`flex flex-col items-center gap-1.5 px-5 py-2 ${pathname === "/favorites" ? "text-violet-400" : "text-white/30"}`}>
        <Heart className="h-[22px] w-[22px]" />
        <span className="text-xs font-medium uppercase tracking-widest">{t("favorites")}</span>
      </Link>
    </nav>
  );
}
