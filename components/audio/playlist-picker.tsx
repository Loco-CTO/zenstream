"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { CirclePlus, Plus, X } from "lucide-react";
import {
	addPlaylistItems,
	createPlaylist,
	fetchPlaylist,
	fetchPlaylists,
	removePlaylistEntry,
	type Playlist,
	type PlaylistSummary,
} from "@/lib/playlists";
import { fetchArtistTracks, seriesPosterImage } from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { BlurHashImage, MediaPlaceholder } from "@/components/ui/blurhash-image";
import { Toggle } from "@/components/ui/toggle";

export function PlaylistPicker({
	session,
	entityId,
	entityName,
	trackIds,
	artistSource = false,
	compact = false,
	className = "",
}: {
	session: AuthSession;
	entityId: string;
	entityName: string;
	trackIds?: string[];
	artistSource?: boolean;
	compact?: boolean;
	className?: string;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
	const [details, setDetails] = useState<Record<string, Playlist>>({});
	const [pendingMembership, setPendingMembership] = useState<Record<string, boolean>>({});
	const [itemIds, setItemIds] = useState<string[]>(trackIds ?? [entityId]);
	const [loading, setLoading] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (trackIds?.length) setItemIds(trackIds);
		else if (!artistSource) setItemIds([entityId]);
	}, [artistSource, entityId, trackIds]);

	useEffect(() => {
		if (!open) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			if (creating) {
				setCreating(false);
				return;
			}
			setOpen(false);
			triggerRef.current?.focus();
		};
		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [creating, open]);

	async function openPicker() {
		setOpen(true);
		setError(false);
		setLoading(true);
		try {
			const ids =
				trackIds?.length
					? trackIds
					: artistSource
						? (await fetchArtistTracks(session, entityId)).map((item) => item.Id)
						: [entityId];
			setItemIds(ids);
			const summaries = await fetchPlaylists(session);
			const playlistDetails = await Promise.all(
				summaries.map((playlist) => fetchPlaylist(session, playlist.id)),
			);
			setPlaylists(summaries);
			setDetails(
				Object.fromEntries(playlistDetails.map((playlist) => [playlist.id, playlist])),
			);
		} catch {
			setError(true);
		} finally {
			setLoading(false);
		}
	}

	async function togglePlaylist(playlistId: string) {
		const current = details[playlistId];
		if (!current || busyId) return;
		const requestedIds = [...new Set(itemIds)];
		const requestedIdSet = new Set(requestedIds);
		const selectedEntries = current.items.filter((entry) => requestedIdSet.has(entry.item.Id));
		const isMember =
			requestedIds.length > 0 &&
			requestedIds.every((id) => selectedEntries.some((entry) => entry.item.Id === id));
		const shouldBeMember = !isMember;
		setBusyId(playlistId);
		setError(false);
		setPendingMembership((value) => ({ ...value, [playlistId]: shouldBeMember }));

		function updatePlaylist(updated: Playlist) {
			setDetails((value) => ({ ...value, [playlistId]: updated }));
			setPlaylists((value) =>
				value.map((playlist) =>
					playlist.id === playlistId ? { ...playlist, ...updated } : playlist,
				),
			);
		}

		function hasRequestedMembership(playlist: Playlist) {
			const currentIds = new Set(playlist.items.map((entry) => entry.item.Id));
			const matchedCount = requestedIds.filter((id) => currentIds.has(id)).length;
			return shouldBeMember
				? requestedIds.length > 0 && matchedCount === requestedIds.length
				: matchedCount === 0;
		}

		try {
			if (isMember) {
				for (const entry of selectedEntries) {
					await removePlaylistEntry(session, playlistId, entry.entryId);
				}
			} else {
				await addPlaylistItems(session, playlistId, [entityId]);
			}
			const updated = await fetchPlaylist(session, playlistId);
			updatePlaylist(updated);
			if (!hasRequestedMembership(updated)) setError(true);
		} catch {
			try {
				const updated = await fetchPlaylist(session, playlistId);
				updatePlaylist(updated);
				setError(!hasRequestedMembership(updated));
			} catch {
				setError(true);
			}
		} finally {
			setPendingMembership((value) => {
				const next = { ...value };
				delete next[playlistId];
				return next;
			});
			setBusyId(null);
		}
	}

	function onCreated(playlist: Playlist) {
		setPlaylists((value) => [playlist, ...value]);
		setDetails((value) => ({ ...value, [playlist.id]: playlist }));
		setCreating(false);
	}

	return (
		<div className="relative inline-flex">
			<button
				ref={triggerRef}
				type="button"
				aria-label={t("addToPlaylist")}
				aria-expanded={open}
				onClick={(event) => {
					event.stopPropagation();
					if (open) {
						setOpen(false);
					} else {
						void openPicker();
					}
				}}
				className={`inline-flex ${compact ? "h-7 w-7 rounded p-1" : "h-10 w-10 rounded-full"} items-center justify-center text-white/25 transition-colors hover:text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${className}`}
			>
				<CirclePlus className={compact ? "h-3.5 w-3.5" : "h-5 w-5"} />
			</button>
			{open &&
				typeof document !== "undefined" &&
				createPortal(
					<div
						className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-6"
						onMouseDown={(event) => {
							if (event.target === event.currentTarget && !busyId && !creating) {
								setOpen(false);
								triggerRef.current?.focus();
							}
						}}
						onClick={(event) => event.stopPropagation()}
					>
						<div
							role="dialog"
							aria-modal="true"
							aria-labelledby="playlist-picker-title"
							aria-busy={loading || busyId !== null}
							className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-2xl shadow-black/60 backdrop-blur-2xl"
							onClick={(event) => event.stopPropagation()}
						>
							<div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
								<h2
									id="playlist-picker-title"
									className="text-base font-semibold tracking-tight text-white"
								>
									{t("addToPlaylist")}
								</h2>
								<button
									type="button"
									aria-label={t("close")}
									onClick={() => {
										setOpen(false);
										triggerRef.current?.focus();
									}}
									className="rounded-full p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
								>
									<X className="h-4 w-4" />
								</button>
							</div>
							<button
								type="button"
								disabled={itemIds.length === 0 || busyId !== null}
								onClick={() => setCreating(true)}
								className="mx-4 mt-3 flex w-auto shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/[0.07] disabled:opacity-50"
							>
								<span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.08]">
									<Plus className="h-4 w-4" />
								</span>
								{t("createPlaylist")}
							</button>
							<div className="min-h-0 max-h-[min(18rem,calc(100dvh-8rem))] flex-1 overflow-y-auto px-3 py-2">
								{loading ? (
									<p className="px-2 py-8 text-center text-xs text-white/40">
										{t("loading")}
									</p>
								) : playlists.length === 0 ? (
									<p className="px-2 py-8 text-center text-xs text-white/40">
										{t("noPlaylists")}
									</p>
								) : (
									playlists.map((playlist) => {
										const entries = details[playlist.id]?.items ?? [];
										const savedMembership =
											itemIds.length > 0 &&
											itemIds.every((id) =>
												entries.some((entry) => entry.item.Id === id),
											);
										const membership =
											pendingMembership[playlist.id] ?? savedMembership;
										const artwork = playlist.artworkItems[0];
										return (
											<button
												key={playlist.id}
												type="button"
												aria-label={`${playlist.name}: ${
													membership ? t("inPlaylist") : t("notInPlaylist")
												}`}
												aria-pressed={membership}
												disabled={busyId !== null || loading || itemIds.length === 0}
												onClick={() => void togglePlaylist(playlist.id)}
												className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/75 transition hover:bg-white/[0.06] disabled:opacity-50"
											>
												<div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
													{artwork && seriesPosterImage(artwork) ? (
														<BlurHashImage
															image={seriesPosterImage(artwork)!}
															alt=""
															sizes="40px"
															className="h-full w-full object-cover"
														/>
													) : (
														<MediaPlaceholder />
													)}
												</div>
												<span className="min-w-0 flex-1 truncate">
													{playlist.name}
												</span>
												<span
													aria-hidden="true"
													className={`h-4 w-4 shrink-0 rounded-[3px] border transition-[background-color,border-color,transform] duration-200 ease-out ${membership ? "scale-100 border-white bg-white" : "scale-95 border-white/45 bg-transparent"}`}
												/>
											</button>
										);
									})
								)}
							</div>
							{error && (
								<p role="alert" className="shrink-0 px-5 py-2 text-xs text-red-200/80">
									{t("playlistSaveFailed")}
								</p>
							)}
							<div className="flex shrink-0 justify-end border-t border-white/10 px-4 py-3">
								<button
									type="button"
									onClick={() => {
										setOpen(false);
										triggerRef.current?.focus();
									}}
									className="rounded-lg px-4 py-2 text-sm font-medium text-white/70 transition hover:bg-white/[0.08] hover:text-white"
								>
									{t("close")}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
			{creating && (
				<CreatePlaylistDialog
					session={session}
					entityId={entityId}
					entityName={entityName}
					onClose={() => setCreating(false)}
					onCreated={onCreated}
				/>
			)}
		</div>
	);
}

export function CreatePlaylistDialog({
	session,
	entityId,
	entityName,
	onClose,
	onCreated,
}: {
	session: AuthSession;
	entityId?: string;
	entityName?: string;
	onClose: () => void;
	onCreated: (playlist: Playlist) => void;
}) {
	const { t } = useI18n();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isPrivate, setIsPrivate] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!name.trim() || busy) return;
		setBusy(true);
		setError(false);
		try {
			const playlist = await createPlaylist(session, {
				name: name.trim(),
				description: description.trim() || undefined,
				isPrivate,
				entityId,
			});
			onCreated(playlist);
		} catch {
			setError(true);
		} finally {
			setBusy(false);
		}
	}

	const privacyLabel = t(isPrivate ? "privatePlaylist" : "publicPlaylist");

	if (typeof document === "undefined") return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-6"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="new-playlist-title"
				aria-busy={busy}
				onSubmit={(event) => void submit(event)}
				className="w-full max-w-md rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6"
			>
				<div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
					<div className="min-w-0">
						<h2
							id="new-playlist-title"
							className="text-base font-semibold tracking-tight text-white"
						>
							{t("newPlaylist")}
						</h2>
						{entityName && (
							<p className="mt-1 text-xs text-white/45">
								{t("addToPlaylistFor", { name: entityName })}
							</p>
						)}
					</div>
					<button
						type="button"
						aria-label={t("close")}
						onClick={onClose}
						className="shrink-0 rounded-lg p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="space-y-4">
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold text-white/65">
							{t("playlistName")}
						</span>
						<input
							autoFocus
							required
							maxLength={100}
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder={t("playlistName")}
							className="w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/10"
						/>
					</label>
					<label className="block">
						<span className="mb-1.5 block text-xs font-semibold text-white/65">
							{t("playlistDescription")}
						</span>
						<input
							maxLength={500}
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							placeholder={t("playlistDescription")}
							className="w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 transition focus:border-violet-300/50 focus:ring-2 focus:ring-violet-300/10"
						/>
					</label>

					<div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-3.5">
						<div className="min-w-0">
							<p className="text-xs font-semibold text-white/75">{privacyLabel}</p>
							<p className="mt-1 text-[11px] text-white/40">
								{t(isPrivate ? "privatePlaylistHint" : "publicPlaylistHint")}
							</p>
						</div>
						<Toggle
							label={t("privatePlaylist")}
							checked={isPrivate}
							onChange={setIsPrivate}
						/>
					</div>

					{error && (
						<p role="alert" className="text-xs text-red-200/80">
							{t("playlistSaveFailed")}
						</p>
					)}

					<div className="grid grid-cols-2 gap-2 pt-1">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.07] hover:text-white"
						>
							{t("cancel")}
						</button>
						<button
							type="submit"
							disabled={!name.trim() || busy}
							className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{busy ? t("saving") : t("create")}
						</button>
					</div>
				</div>
			</form>
		</div>,
		document.body,
	);
}
