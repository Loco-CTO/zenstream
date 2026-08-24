"use client";

import { AlertTriangle, Download, LoaderCircle, Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	downloadBazarrSubtitle,
	getBazarrStatus,
	searchBazarrSubtitles,
	type BazarrSearchResult,
	type BazarrStatus,
} from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

const BAZARR_MISSING_VALUE = "—";

function formatBazarrScore(score: number | null | undefined) {
	if (score == null || !Number.isFinite(score)) return BAZARR_MISSING_VALUE;
	return `${Number.isInteger(score) ? score : score}%`;
}

function formatBazarrValue(value: string | null | undefined) {
	return value?.trim() || BAZARR_MISSING_VALUE;
}

export function isSubtitleDownloaderAvailable(status: BazarrStatus | null) {
	return status?.state === "matched" || status?.state === "download_started";
}

export function BazarrSubtitles({
	session,
	itemId,
	sourceId,
	open,
	onOpenChange,
	onAvailabilityChange,
}: {
	session: AuthSession;
	itemId: string;
	sourceId?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAvailabilityChange: (available: boolean) => void;
}) {
	const { t } = useI18n();
	const [status, setStatus] = useState<BazarrStatus | null>(null);
	const [search, setSearch] = useState<BazarrSearchResult | null>(null);
	const [busy, setBusy] = useState<"search" | "download" | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!sourceId) {
			onAvailabilityChange(false);
			return;
		}
		let active = true;
		onAvailabilityChange(false);
		void getBazarrStatus(session, itemId, sourceId)
			.then((value) => {
				if (!active) return;
				setStatus(value);
				onAvailabilityChange(isSubtitleDownloaderAvailable(value));
			})
			.catch(() => {
				if (!active) return;
				setStatus(null);
				setError(t("bazarrSearchFailed"));
				onAvailabilityChange(false);
			});
		return () => {
			active = false;
		};
	}, [itemId, onAvailabilityChange, session, sourceId, t]);

	const closeModal = useCallback(() => {
		if (busy !== null) return;
		setSearch(null);
		setError("");
		onOpenChange(false);
	}, [busy, onOpenChange]);

	useEffect(() => {
		if (!open) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") closeModal();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [closeModal, open]);

	if (!open || !sourceId || !isSubtitleDownloaderAvailable(status)) return null;
	const selectedSourceId = sourceId;

	async function findSubtitles() {
		setBusy("search");
		setError("");
		setSearch(null);
		try {
			setSearch(await searchBazarrSubtitles(session, itemId, selectedSourceId));
		} catch {
			setError(t("bazarrSearchFailed"));
		} finally {
			setBusy(null);
		}
	}

	async function download(matchId: string) {
		setBusy("download");
		setError("");
		try {
			await downloadBazarrSubtitle(session, itemId, selectedSourceId, matchId);
			setSearch(null);
			setStatus((current) =>
				current ? { ...current, state: "download_started" } : current,
			);
			onAvailabilityChange(true);
		} catch {
			setError(t("bazarrDownloadFailed"));
		} finally {
			setBusy(null);
		}
	}

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-6"
			onPointerDown={(event) => {
				if (event.target === event.currentTarget) closeModal();
			}}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="subtitle-downloader-title"
				className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/60 backdrop-blur-2xl sm:max-h-[calc(100dvh-3rem)]"
			>
				<div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
					<div className="min-w-0">
						<h2
							id="subtitle-downloader-title"
							className="text-base font-semibold tracking-tight text-white sm:text-lg"
						>
							{t("bazarrSubtitles")}
						</h2>
					</div>
					<button
						type="button"
						aria-label={t("close")}
						onClick={closeModal}
						disabled={busy !== null}
						className="shrink-0 rounded-lg p-2 text-white/45 transition hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
					>
						<X className="h-5 w-5" />
					</button>
				</div>
				<div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
					<button
						type="button"
						onClick={() => void findSubtitles()}
						disabled={busy !== null}
						className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-xs font-semibold text-black transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{busy === "search" ? (
							<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Search className="h-3.5 w-3.5" />
						)}
						{busy === "search" ? t("bazarrSearching") : t("bazarrFindSubtitles")}
					</button>
					{status?.state === "download_started" && (
						<div
							role="status"
							className="mt-4 rounded-lg border border-violet-300/20 bg-violet-400/[.05] px-3 py-2.5 text-xs leading-5 text-violet-100/75"
						>
							{t("bazarrDownloadQueued")}
						</div>
					)}
					{error && (
						<div
							role="alert"
							className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-400/20 bg-red-400/[.05] px-3 py-2.5"
						>
							<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-200/80" />
							<p className="text-xs leading-5 text-red-100/80">{error}</p>
						</div>
					)}
					{search && (
						<div className="mt-4 max-h-[min(42vh,24rem)] overflow-y-auto rounded-xl border border-white/10 bg-white/[.025]">
							{search.matches.length === 0 ? (
								<div className="px-4 py-10 text-center">
									<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[.045] text-white/25">
										<Search className="h-4 w-4" />
									</div>
									<p className="mt-3 text-xs font-medium text-white/65">
										{t("bazarrNoMatches")}
									</p>
								</div>
							) : (
								<div className="divide-y divide-white/[.07]">
									{search.matches.map((match) => (
										<div
											key={match.matchId}
											className="flex flex-col gap-3 px-4 py-3 transition hover:bg-white/[.035] sm:flex-row sm:items-center sm:justify-between"
										>
											<div className="min-w-0">
												<p className="truncate text-sm font-medium text-white/80">
													{formatBazarrValue(match.releaseName)}
												</p>
												<p className="mt-1 text-[11px] leading-4 text-white/35">
													{[
														formatBazarrScore(match.score),
														formatBazarrValue(match.language),
														formatBazarrValue(match.provider),
														formatBazarrValue(match.uploader),
													].join(" · ")}
												</p>
											</div>
											<button
												type="button"
												onClick={() => void download(match.matchId)}
												disabled={busy !== null}
												className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
											>
												{busy === "download" ? (
													<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
												) : (
													<Download className="h-3.5 w-3.5" />
												)}
												{t("bazarrDownload")}
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
