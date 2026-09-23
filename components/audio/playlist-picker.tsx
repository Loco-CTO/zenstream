"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Circle, ListPlus, Plus, X } from "lucide-react";
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
	const [itemIds, setItemIds] = useState<string[]>(trackIds ?? [entityId]);
	const [loading, setLoading] = useState(false);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		if (trackIds?.length) setItemIds(trackIds);
		else if (!artistSource) setItemIds([entityId]);
	}, [artistSource, entityId, trackIds]);

	const selectedIds = useMemo(() => new Set(itemIds), [itemIds]);

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
		setBusyId(playlistId);
		setError(false);
		try {
			const currentIds = new Set(current.items.map((entry) => entry.item.Id));
			const selected = itemIds.filter((id) => currentIds.has(id));
			let updated = current;
			if (selected.length > 0 && selected.length === itemIds.length) {
				for (const entry of current.items.filter((value) => selectedIds.has(value.item.Id))) {
					updated = await removePlaylistEntry(session, playlistId, entry.entryId);
				}
			} else {
				updated = await addPlaylistItems(session, playlistId, [entityId]);
			}
			setDetails((value) => ({ ...value, [playlistId]: updated }));
			setPlaylists((value) =>
				value.map((playlist) =>
					playlist.id === playlistId ? { ...playlist, ...updated } : playlist,
				),
			);
		} catch {
			setError(true);
		} finally {
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
				type="button"
				aria-label={t("addToPlaylist")}
				aria-expanded={open}
				onClick={() => (open ? setOpen(false) : void openPicker())}
				className={`inline-flex ${compact ? "h-7 w-7 rounded p-1" : "h-10 rounded-full px-4"} items-center justify-center gap-2 border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/65 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${className}`}
			>
				<ListPlus className="h-4 w-4" />
				{!compact && <span>{t("addToPlaylist")}</span>}
			</button>
			{open && (
				<div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-white/15 bg-[#171719] p-2 shadow-2xl shadow-black/70">
					<button
						type="button"
						onClick={() => setCreating(true)}
						className="flex w-full items-center gap-3 rounded-lg border-b border-white/10 px-2 py-3 text-left text-sm font-semibold text-white/80 hover:bg-white/[0.06]"
					>
						<span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.08]"><Plus className="h-4 w-4" /></span>
						{t("createPlaylist")}
					</button>
					<div className="max-h-72 overflow-y-auto py-1">
						{loading ? (
							<p className="px-3 py-5 text-center text-xs text-white/40">{t("loading")}</p>
						) : playlists.length === 0 ? (
							<p className="px-3 py-5 text-center text-xs text-white/40">{t("noPlaylists")}</p>
						) : (
							playlists.map((playlist) => {
								const entries = details[playlist.id]?.items ?? [];
								const membership = itemIds.length > 0 && itemIds.every((id) => entries.some((entry) => entry.item.Id === id));
								const artwork = playlist.artworkItems[0];
								return (
									<button
										key={playlist.id}
										type="button"
										disabled={busyId !== null || loading || itemIds.length === 0}
										onClick={() => void togglePlaylist(playlist.id)}
										className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-white/70 transition hover:bg-white/[0.06] disabled:opacity-50"
									>
										<div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
											{artwork && seriesPosterImage(artwork) ? (
												<BlurHashImage image={seriesPosterImage(artwork)!} alt="" sizes="36px" className="h-full w-full object-cover" />
											) : <MediaPlaceholder />}
										</div>
										<span className="min-w-0 flex-1 truncate">{playlist.name}</span>
										<span aria-label={membership ? t("inPlaylist") : t("notInPlaylist")} className="flex h-5 w-5 items-center justify-center text-white/45">
											{membership ? <Check className="h-4 w-4 text-violet-300" /> : <Circle className="h-4 w-4" />}
										</span>
									</button>
								);
							})
						)}
					</div>
					{error && <p role="alert" className="px-3 py-2 text-xs text-red-200/80">{t("playlistSaveFailed")}</p>}
				</div>
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

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#171719] p-5 shadow-2xl shadow-black/70">
				<div className="mb-5 flex items-center justify-between">
					<div>
						<h2 className="text-base font-bold text-white">{t("newPlaylist")}</h2>
						{entityName && <p className="mt-1 text-xs text-white/40">{t("addToPlaylistFor", { name: entityName })}</p>}
					</div>
					<button type="button" aria-label={t("close")} onClick={onClose} className="rounded-full bg-white/[0.07] p-2 text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
				</div>
				<label className="mb-4 block">
					<span className="sr-only">{t("playlistName")}</span>
					<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("playlistName")} className="w-full border-0 border-b border-white/15 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-300" />
				</label>
				<label className="mb-5 block">
					<span className="sr-only">{t("playlistDescription")}</span>
					<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("playlistDescription")} className="w-full border-0 border-b border-white/15 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-300" />
				</label>
				<label className="mb-5 flex cursor-pointer items-center justify-between gap-4">
					<span><span className="block text-xs font-semibold text-white/70">{t("privatePlaylist")}</span><span className="mt-1 block text-[11px] text-white/35">{t("privatePlaylistHint")}</span></span>
					<input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} className="h-5 w-5 accent-violet-400" />
				</label>
				{error && <p role="alert" className="mb-3 text-xs text-red-200/80">{t("playlistSaveFailed")}</p>}
				<div className="grid grid-cols-2 gap-2">
					<button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/55 hover:text-white">{t("cancel")}</button>
					<button type="submit" disabled={!name.trim() || busy} className="rounded-lg bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/[0.13] disabled:opacity-35">{busy ? t("saving") : t("create")}</button>
				</div>
			</form>
		</div>
	);
}
