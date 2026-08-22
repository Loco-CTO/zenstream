"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ClearWatchHistoryModalProps = {
	onClose: () => void;
	onConfirm: () => Promise<void>;
};

export function ClearWatchHistoryModal({
	onClose,
	onConfirm,
}: ClearWatchHistoryModalProps) {
	const { t } = useI18n();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape" && !submitting) onClose();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, submitting]);

	const confirm = async () => {
		if (submitting) return;
		setError(false);
		setSubmitting(true);
		try {
			await onConfirm();
			onClose();
		} catch {
			setError(true);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm sm:p-6"
			onPointerDown={(event) => {
				if (!submitting && event.target === event.currentTarget) onClose();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="clear-watch-history-title"
				aria-describedby="clear-watch-history-description"
				className="w-full max-w-md rounded-2xl border border-red-400/20 bg-[#141414] p-5 shadow-2xl shadow-black/50 sm:p-7"
			>
				<div className="flex items-center justify-between gap-4">
					<h2
						id="clear-watch-history-title"
						className="text-lg font-bold text-white"
					>
						{t("clearWatchHistoryTitle")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						disabled={submitting}
						aria-label={t("close")}
						className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white disabled:opacity-40"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="mt-5 space-y-4">
					<p
						id="clear-watch-history-description"
						className="text-sm leading-6 text-white/55"
					>
						{t("clearWatchHistoryDescription")}
					</p>
					{error && (
						<p role="alert" className="text-sm text-red-300">
							{t("clearWatchHistoryFailed")}
						</p>
					)}
					<div className="flex justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							disabled={submitting}
							className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
						>
							{t("cancel")}
						</button>
						<button
							type="button"
							onClick={() => void confirm()}
							disabled={submitting}
							className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-red-400 px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-red-300 disabled:cursor-not-allowed disabled:opacity-45"
						>
							{submitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
							{t("clearWatchHistoryConfirm")}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
