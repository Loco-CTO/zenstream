"use client";

import { Download, ExternalLink, Smartphone, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { orchestratorBaseUrl } from "@/lib/authenticated-request";
import {
	NATIVE_APP_BANNER_DISMISSAL_KEY,
	NATIVE_APP_RELEASE_URL,
	buildNativeAppOpenUrl,
	buildNativeAppTarget,
	isAndroidMobileUserAgent,
	isStandaloneDisplayMode,
	shouldShowNativeAppBanner,
} from "@/lib/native-app-promotion";
import { useI18n } from "@/lib/i18n";

const NATIVE_APP_BANNER_CHANGE_EVENT = "zenstream:native-app-banner-changed";

function subscribeToNativeAppBanner(listener: () => void) {
	window.addEventListener("storage", listener);
	window.addEventListener(NATIVE_APP_BANNER_CHANGE_EVENT, listener);
	return () => {
		window.removeEventListener("storage", listener);
		window.removeEventListener(NATIVE_APP_BANNER_CHANGE_EVENT, listener);
	};
}

function getNativeAppBannerSnapshot() {
	if (!isAndroidMobileUserAgent(navigator.userAgent)) return false;
	if (isStandaloneDisplayMode()) return false;
	let dismissedAt: string | null = null;
	try {
		dismissedAt = window.localStorage.getItem(NATIVE_APP_BANNER_DISMISSAL_KEY);
	} catch {
		// A restricted storage context should not prevent the banner from rendering.
	}
	return shouldShowNativeAppBanner(Date.now(), dismissedAt);
}

function getServerNativeAppBannerSnapshot() {
	return false;
}

export function NativeAppBanner() {
	const { t } = useI18n();
	const pathname = usePathname() ?? "/";
	const searchParams = useSearchParams();
	const visible = useSyncExternalStore(
		subscribeToNativeAppBanner,
		getNativeAppBannerSnapshot,
		getServerNativeAppBannerSnapshot,
	);

	const dismiss = () => {
		try {
			window.localStorage.setItem(
				NATIVE_APP_BANNER_DISMISSAL_KEY,
				String(Date.now()),
			);
		} finally {
			window.dispatchEvent(new Event(NATIVE_APP_BANNER_CHANGE_EVENT));
		}
	};

	if (!visible) return null;

	const target = buildNativeAppTarget(pathname, searchParams.toString());
	const openUrl = buildNativeAppOpenUrl(
		orchestratorBaseUrl(),
		target,
		navigator.userAgent,
	);

	return (
		<div className="relative md:hidden">
			<aside
				data-testid="native-app-banner"
				aria-labelledby="native-app-banner-title"
				className="relative isolate flex w-full items-start gap-3 overflow-hidden border-y border-white/10 bg-[#0c0b10]/95 px-3 py-3 shadow-[0_10px_36px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_8%_50%,rgba(139,92,246,0.23),transparent_46%),linear-gradient(95deg,rgba(124,58,237,0.08),transparent_62%)]"
				/>
				<div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 text-violet-300">
					<Smartphone className="h-5 w-5" aria-hidden="true" />
				</div>
				<div className="relative z-10 min-w-0 flex-1">
					<p
						id="native-app-banner-title"
						className="pr-7 text-sm font-semibold text-white"
					>
						{t("nativeAppBannerTitle")}
					</p>
					<p className="mt-0.5 text-xs leading-4 text-white/55">
						{t("nativeAppBannerDescription")}
					</p>
					<div className="mt-2 flex flex-wrap gap-2">
						<a
							href={openUrl}
							className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold text-black transition hover:bg-white/85"
						>
							{t("nativeAppOpen")}
							<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
						</a>
						<a
							href={NATIVE_APP_RELEASE_URL}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 text-xs font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
						>
							<Download className="h-3.5 w-3.5" aria-hidden="true" />
							{t("nativeAppDownload")}
						</a>
					</div>
				</div>
				<button
					type="button"
					aria-label={t("nativeAppDismiss")}
					onClick={dismiss}
					className="absolute right-1.5 top-1.5 z-20 flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
				>
					<X className="h-4 w-4" aria-hidden="true" />
				</button>
			</aside>
		</div>
	);
}
