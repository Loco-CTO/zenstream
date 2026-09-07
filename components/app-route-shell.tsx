"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type AppRouteShellProps = {
	children: ReactNode;
	shell?: ReactNode;
};

function isAppRoute(pathname: string) {
	return (
		pathname === "/" ||
		pathname === "/calendar" ||
		pathname === "/favorites" ||
		pathname === "/library" ||
		pathname === "/notifications" ||
		pathname === "/search" ||
		pathname === "/settings" ||
		pathname.startsWith("/album/") ||
		pathname.startsWith("/artist/") ||
		pathname.startsWith("/collection/") ||
		pathname.startsWith("/library/") ||
		pathname.startsWith("/play/") ||
		pathname.startsWith("/show/")
	);
}

export function AppRouteShell({ children, shell }: AppRouteShellProps) {
	const pathname = usePathname();

	return pathname && isAppRoute(pathname) ? (shell ?? <AppShell />) : children;
}
