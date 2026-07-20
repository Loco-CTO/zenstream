"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import {
	I18nProvider,
	type Locale,
	type TranslationKey,
	useI18n,
} from "@/lib/i18n";
import { getStoredLocale } from "@/lib/preferences";
import {
	clearAuthCookies,
	getAuthSession,
	type AuthSession,
} from "@/lib/session";

export function ErrorPage({
	statusCode,
	titleKey,
	messageKey,
}: {
	statusCode?: string;
	titleKey: TranslationKey;
	messageKey: TranslationKey;
}) {
	const [locale, setLocale] = useState<Locale>("en");
	const [session, setSession] = useState<AuthSession | null>(null);
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		const storedLocale = getStoredLocale();
		// Cookie-backed auth and stored locale are only available after hydration.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		if (storedLocale) setLocale(storedLocale);
		setSession(getAuthSession());
		setHydrated(true);
	}, []);

	const handleLogout = () => {
		clearAuthCookies();
		setSession(null);
	};

	return (
		<I18nProvider locale={locale}>
			<ErrorPageFrame
				hydrated={hydrated}
				session={session}
				statusCode={statusCode}
				titleKey={titleKey}
				messageKey={messageKey}
				onLogout={handleLogout}
			/>
		</I18nProvider>
	);
}

function ErrorPageFrame({
	hydrated,
	session,
	statusCode,
	titleKey,
	messageKey,
	onLogout,
}: {
	hydrated: boolean;
	session: AuthSession | null;
	statusCode?: string;
	titleKey: TranslationKey;
	messageKey: TranslationKey;
	onLogout: () => void;
}) {
	const { t } = useI18n();

	return (
		<div className="relative min-h-screen overflow-hidden bg-background text-foreground">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.16),transparent_34%),linear-gradient(180deg,#121212,#080808_48%,#050505)]" />
			{hydrated && session ? (
				<Navbar
					displayName={session.username}
					userId={session.userId}
					onLogout={onLogout}
				/>
			) : (
				<IconOnlyTopbar />
			)}
			<ErrorContent
				statusCode={statusCode}
				title={t(titleKey)}
				message={t(messageKey)}
				action={
					hydrated && session ? (
						<Link
							href="/"
							className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold tracking-normal text-black shadow-lg shadow-black/30 transition hover:bg-white/90"
						>
							<Home className="h-4 w-4" />
							{t("returnHome")}
						</Link>
					) : null
				}
			/>
		</div>
	);
}

function IconOnlyTopbar() {
	return (
		<nav className="absolute left-0 right-0 top-0 z-50 flex h-16 items-center px-4 md:h-20 md:px-12">
			<Link
				href="/"
				aria-label="ZenStream"
				className="flex shrink-0 items-center"
			>
				<img
					src="/icon.png"
					alt="ZenStream"
					className="h-9 w-9 object-contain md:h-10 md:w-10"
				/>
			</Link>
		</nav>
	);
}

export function ErrorContent({
	statusCode,
	title,
	message,
	action,
	onRetry,
}: {
	statusCode?: string;
	title: string;
	message?: string | null;
	action?: ReactNode;
	onRetry?: () => void;
}) {
	const { t } = useI18n();

	return (
		<main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-24 sm:px-6">
			<section className="w-full max-w-2xl text-center">
				<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-white/70 shadow-2xl shadow-black/30 backdrop-blur-xl">
					<AlertTriangle className="h-6 w-6" />
				</div>
				{statusCode && (
					<p className="mt-7 text-xs font-bold uppercase tracking-[0.28em] text-violet-300/75">
						{statusCode}
					</p>
				)}
				<h1 className="mx-auto mt-3 max-w-xl text-3xl font-black leading-tight tracking-normal text-white sm:text-4xl md:text-5xl">
					{title}
				</h1>
				{message && (
					<p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-white/45 md:text-base">
						{message}
					</p>
				)}
				{(action || onRetry) && (
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						{action}
						{onRetry && (
							<button
								type="button"
								onClick={onRetry}
								className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold tracking-normal text-black shadow-lg shadow-black/30 transition hover:bg-white/90"
							>
								<RotateCcw className="h-4 w-4" />
								{t("retry")}
							</button>
						)}
					</div>
				)}
			</section>
		</main>
	);
}
