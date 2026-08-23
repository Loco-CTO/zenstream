"use client";

import { Download, Languages, LoaderCircle, Search } from "lucide-react";
import { useEffect, useState } from "react";
import {
	downloadBazarrSubtitle,
	getBazarrStatus,
	searchBazarrSubtitles,
	type BazarrSearchResult,
	type BazarrStatus,
} from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

export function BazarrSubtitles({
	session,
	itemId,
	sourceId,
}: {
	session: AuthSession;
	itemId: string;
	sourceId?: string;
}) {
	const { t } = useI18n();
	const [status, setStatus] = useState<BazarrStatus | null>(null);
	const [search, setSearch] = useState<BazarrSearchResult | null>(null);
	const [busy, setBusy] = useState<"search" | "download" | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		if (!sourceId) return;
		let active = true;
		void getBazarrStatus(session, itemId, sourceId)
			.then((value) => {
				if (active) setStatus(value);
			})
			.catch(() => {
				if (active) setError(t("bazarrSearchFailed"));
			})
			.finally(() => {
				if (active) setBusy(null);
			});
		return () => {
			active = false;
		};
	}, [itemId, session, sourceId, t]);

	if (!sourceId) return null;
	const selectedSourceId = sourceId;
	const statusLoading = status === null && !error && busy === null;
	const currentBusy = statusLoading ? "status" : busy;

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
		} catch {
			setError(t("bazarrDownloadFailed"));
		} finally {
			setBusy(null);
		}
	}

	const hasLocal = Boolean(status?.hasLocalSubtitle);
	const stateMessage =
		status?.state === "not_configured"
			? t("bazarrNotConfigured")
			: status?.state === "unmatched" ||
				  status?.state === "ambiguous" ||
				  status?.state === "identity_conflict"
				? t("bazarrPathConflict")
				: status?.state === "download_started"
					? t("bazarrDownloadQueued")
					: hasLocal
						? t("bazarrExisting")
						: undefined;

	return (
		<section className="max-w-xl rounded-xl border border-white/10 bg-white/[.025] p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<Languages className="h-4 w-4 shrink-0 text-violet-300" />
					<div className="min-w-0">
						<h2 className="text-xs font-semibold uppercase tracking-[.13em] text-white/60">
							{t("bazarrSubtitles")}
						</h2>
						{stateMessage && (
							<p className="mt-1 text-xs text-white/40">{stateMessage}</p>
						)}
					</div>
				</div>
				<button
					type="button"
					onClick={() => void findSubtitles()}
					disabled={currentBusy !== null || status?.state === "not_configured"}
					className="inline-flex shrink-0 items-center gap-2 rounded-full border border-violet-300/30 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{currentBusy === "search" || currentBusy === "status" ? (
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
					) : (
						<Search className="h-3.5 w-3.5" />
					)}
					{currentBusy === "search"
						? t("bazarrSearching")
						: t("bazarrFindSubtitles")}
				</button>
			</div>
			{error && <p className="mt-3 text-xs text-red-300">{error}</p>}
			{search && (
				<div className="mt-4 space-y-2">
					{search.matches.length === 0 ? (
						<p className="text-xs text-white/40">{t("bazarrNoMatches")}</p>
					) : (
						search.matches.map((match) => (
							<div
								key={match.matchId}
								className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-black/20 px-3 py-2"
							>
								<div className="min-w-0">
									<p className="truncate text-sm text-white/75">{match.name}</p>
									<p className="mt-0.5 text-xs text-white/35">
										{[match.language, match.provider, match.format]
											.filter(Boolean)
											.join(" · ")}
									</p>
								</div>
								<button
									type="button"
									onClick={() => void download(match.matchId)}
									disabled={busy !== null}
									className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-violet-200 hover:bg-violet-400/10 disabled:opacity-50"
								>
									{busy === "download" ? (
										<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
									) : (
										<Download className="h-3.5 w-3.5" />
									)}
									{t("bazarrDownload")}
								</button>
							</div>
						))
					)}
				</div>
			)}
		</section>
	);
}
