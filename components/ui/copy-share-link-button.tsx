"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Share2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const FEEDBACK_DURATION = 1_800;

export function CopyShareLinkButton({
	className = "",
}: {
	className?: string;
}) {
	const { t } = useI18n();
	const [copied, setCopied] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timeout = window.setTimeout(() => setCopied(false), FEEDBACK_DURATION);
		return () => window.clearTimeout(timeout);
	}, [copied]);

	async function copyLink() {
		setCopied(false);
		setFailed(false);
		try {
			if (!navigator.clipboard?.writeText)
				throw new Error("Clipboard unavailable");
			const url = new URL(window.location.href);
			url.hash = "";
			await navigator.clipboard.writeText(url.toString());
			setCopied(true);
		} catch {
			setFailed(true);
		}
	}

	const feedback = copied ? t("linkCopied") : failed ? t("copyLinkFailed") : "";

	return (
		<span className="inline-flex items-center" aria-live="polite">
			<button
				type="button"
				onClick={() => void copyLink()}
				aria-label={feedback || t("copyShareLink")}
				title={feedback || t("copyShareLink")}
				className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${className}`}
			>
				{copied ? (
					<Check className="h-5 w-5 text-violet-200" />
				) : failed ? (
					<CircleAlert className="h-5 w-5 text-red-300" />
				) : (
					<Share2 className="h-5 w-5" />
				)}
			</button>
			<span className="sr-only" role={failed ? "alert" : "status"}>
				{feedback}
			</span>
		</span>
	);
}
