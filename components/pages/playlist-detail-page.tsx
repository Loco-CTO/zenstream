"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	LockKeyhole,
	Play,
	Share2,
	Shuffle,
	Trash2,
	X,
} from "lucide-react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { AudioPlayingIndicator } from "@/components/audio/audio-playing-indicator";
import { BlurHashImage, MediaPlaceholder } from "@/components/ui/blurhash-image";
import { ErrorPanel } from "@/components/status/error-panel";
import { useI18n } from "@/lib/i18n";
import {
	deletePlaylist,
	fetchPlaylist,
	fetchSharedPlaylist,
	removePlaylistEntry,
	reorderPlaylist,
	updatePlaylist,
	type Playlist,
} from "@/lib/playlists";
import { seriesPosterImage } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

export function PlaylistDetailPage({
	session,
	playlistId,
	shareToken,
}: {
	session: AuthSession;
	playlistId?: string;
	shareToken?: string;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const { currentTrack, isPlaying, playAlbum } = useAudioPlayer();
	const [playlist, setPlaylist] = useState<Playlist | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [busy, setBusy] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		let active = true;
		setLoading(true);
		setError(false);
		const request = shareToken
			? fetchSharedPlaylist(session, shareToken)
			: playlistId
				? fetchPlaylist(session, playlistId)
				: Promise.reject(new Error("Playlist not found"));
		void request.then((value) => {
			if (active) setPlaylist(value);
		}).catch(() => {
			if (active) setError(true);
		}).finally(() => {
			if (active) setLoading(false);
		});
		return () => { active = false; };
	}, [playlistId, retry, session, shareToken]);

	useEffect(() => {
		const refresh = () => setRetry((value) => value + 1);
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	const tracks = playlist?.items.map((entry) => entry.item) ?? [];
	const album = playlist ? { Id: playlist.id, Name: playlist.name, Type: "MusicAlbum" } : null;

	async function remove(entryId: string) {
		if (!playlist || busy) return;
		setBusy(true);
		try { setPlaylist(await removePlaylistEntry(session, playlist.id, entryId)); }
		catch { setError(true); }
		finally { setBusy(false); }
	}

	async function move(entryIndex: number, direction: -1 | 1) {
		if (!playlist || busy) return;
		const next = [...playlist.items];
		const target = entryIndex + direction;
		if (target < 0 || target >= next.length) return;
		[next[entryIndex], next[target]] = [next[target], next[entryIndex]];
		setBusy(true);
		try { setPlaylist(await reorderPlaylist(session, playlist.id, next.map((entry) => entry.entryId))); }
		catch { setError(true); }
		finally { setBusy(false); }
	}

	async function removePlaylist() {
		if (!playlist || busy) return;
		setBusy(true);
		try {
			await deletePlaylist(session, playlist.id);
			router.push("/my-lists?tab=playlists");
		} catch { setError(true); setBusy(false); }
	}

	async function sharePlaylist() {
		if (!playlist) return;
		const token = playlist.shareToken;
		if (!token) return;
		try {
			await navigator.clipboard.writeText(`${window.location.origin}/shared/playlist/${encodeURIComponent(token)}`);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1800);
		} catch { setError(true); }
	}

	if (loading) return <main className="min-h-screen px-6 pb-28 pt-28" />;
	if (error && !playlist) return <main className="min-h-screen px-6 pb-28 pt-28"><ErrorPanel message={t("playlistLoadFailed")} onRetry={() => setRetry((value) => value + 1)} /></main>;
	if (!playlist || !album) return null;
	const artwork = playlist.artworkItems[0] ? seriesPosterImage(playlist.artworkItems[0]) : null;

	return (
		<main className="min-h-screen px-4 pb-28 pt-24 sm:px-8 md:px-12 md:pt-28">
			<Link href="/my-lists?tab=playlists" className="mb-7 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4" />{t("backToMyLists")}</Link>
			<header className="flex flex-col gap-6 sm:flex-row sm:items-end">
				<div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-xl bg-white/[0.04] shadow-xl shadow-black/30">
					{artwork ? <BlurHashImage image={artwork} alt={playlist.name} sizes="176px" className="h-full w-full object-cover" /> : <MediaPlaceholder />}
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{t("playlist")}</p>
					<h1 className="mt-2 break-words text-4xl font-black tracking-tight text-white">{playlist.name}</h1>
					{playlist.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">{playlist.description}</p>}
					<p className="mt-3 flex items-center gap-2 text-xs text-white/40">{playlist.isPrivate ? <LockKeyhole className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}{t("playlistTrackCount", { count: playlist.itemCount })} · {playlist.isPrivate ? t("privatePlaylist") : t("publicPlaylist")}</p>
				</div>
			</header>
			<div className="mt-7 flex flex-wrap items-center gap-3">
				<button type="button" disabled={tracks.length === 0} onClick={() => playAlbum(album, tracks)} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-40"><Play className="h-4 w-4 fill-current" />{t("playAll")}</button>
				<button type="button" disabled={tracks.length === 0} onClick={() => playAlbum(album, tracks, undefined, true)} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-semibold text-white/65 hover:text-white disabled:opacity-40"><Shuffle className="h-4 w-4" />{t("shuffle")}</button>
				{playlist.isOwner && !playlist.isPrivate && <button type="button" onClick={() => void sharePlaylist()} className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white">{copied ? t("linkCopied") : t("copyShareLink")}</button>}
				{playlist.isOwner && <button type="button" onClick={() => setEditOpen(true)} className="rounded-full border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white">{t("editPlaylist")}</button>}
				{playlist.isOwner && <button type="button" onClick={() => setDeleteOpen(true)} aria-label={t("deletePlaylist")} className="rounded-full border border-red-300/15 p-2.5 text-red-200/65 hover:bg-red-500/10 hover:text-red-100"><Trash2 className="h-4 w-4" /></button>}
			</div>
			{error && <p role="alert" className="mt-4 text-xs text-red-200/80">{t("playlistSaveFailed")}</p>}
			{playlist.items.length === 0 ? <div className="mt-8 rounded-xl border border-white/10 px-6 py-16 text-center text-sm text-white/45">{t("playlistEmpty")}</div> : <div className="mt-8 divide-y divide-white/[0.08]">
				{playlist.items.map((entry, index) => {
					const image = seriesPosterImage(entry.item);
					const active = currentTrack?.Id === entry.item.Id;
					return <div key={entry.entryId} className="group flex items-center gap-3 py-3">
						<button type="button" aria-label={`${t("play")} ${entry.item.Name}`} onClick={() => playAlbum(album, tracks, entry.item.Id, undefined, true)} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
							{image ? <BlurHashImage image={image} alt="" sizes="48px" className="h-full w-full object-cover" /> : <MediaPlaceholder />}
							<span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">{active && isPlaying ? <AudioPlayingIndicator ariaLabel={t("nowPlaying")} /> : <Play className="h-4 w-4 fill-white text-white" />}</span>
						</button>
						<button type="button" onClick={() => playAlbum(album, tracks, entry.item.Id, undefined, true)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white/85 hover:text-white">{entry.item.Name}</button>
						{playlist.isOwner && <div className="flex shrink-0 items-center gap-1 opacity-65 transition group-hover:opacity-100">
							<button type="button" disabled={busy || index === 0} aria-label={t("moveUp")} onClick={() => void move(index, -1)} className="rounded p-1 text-white/50 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"><ArrowUp className="h-4 w-4" /></button>
							<button type="button" disabled={busy || index === playlist.items.length - 1} aria-label={t("moveDown")} onClick={() => void move(index, 1)} className="rounded p-1 text-white/50 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"><ArrowDown className="h-4 w-4" /></button>
							<button type="button" disabled={busy} aria-label={t("removeFromPlaylist")} onClick={() => void remove(entry.entryId)} className="rounded p-1 text-white/35 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"><X className="h-4 w-4" /></button>
						</div>}
					</div>;
				})}
			</div>}
			{editOpen && <EditPlaylistDialog session={session} playlist={playlist} onClose={() => setEditOpen(false)} onSaved={(value) => { setPlaylist(value); setEditOpen(false); }} />}
			{deleteOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#171719] p-5"><h2 className="text-base font-bold text-white">{t("deletePlaylist")}</h2><p className="mt-2 text-sm text-white/55">{t("deletePlaylistConfirm", { name: playlist.name })}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/55">{t("cancel")}</button><button type="button" disabled={busy} onClick={() => void removePlaylist()} className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100">{t("delete")}</button></div></div></div>}
		</main>
	);
}

function EditPlaylistDialog({
	session,
	playlist,
	onClose,
	onSaved,
}: {
	session: AuthSession;
	playlist: Playlist;
	onClose: () => void;
	onSaved: (playlist: Playlist) => void;
}) {
	const { t } = useI18n();
	const [name, setName] = useState(playlist.name);
	const [description, setDescription] = useState(playlist.description ?? "");
	const [isPrivate, setIsPrivate] = useState(playlist.isPrivate);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setError(false);
		try { onSaved(await updatePlaylist(session, playlist.id, { name: name.trim(), description: description.trim() || null, isPrivate })); }
		catch { setError(true); setBusy(false); }
	}

	return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#171719] p-5">
		<div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-white">{t("editPlaylist")}</h2><button type="button" aria-label={t("close")} onClick={onClose} className="rounded-full bg-white/[0.07] p-2 text-white/50"><X className="h-4 w-4" /></button></div>
		<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("playlistName")} className="mb-4 w-full border-b border-white/15 bg-transparent py-2 text-sm text-white outline-none focus:border-violet-300" />
		<input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("playlistDescription")} className="mb-5 w-full border-b border-white/15 bg-transparent py-2 text-sm text-white outline-none focus:border-violet-300" />
		<label className="mb-5 flex items-center justify-between text-xs text-white/65">{t("privatePlaylist")}<input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} className="h-5 w-5 accent-violet-400" /></label>
		{error && <p role="alert" className="mb-3 text-xs text-red-200/80">{t("playlistSaveFailed")}</p>}
		<div className="grid grid-cols-2 gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-white/55">{t("cancel")}</button><button type="submit" disabled={!name.trim() || busy} className="rounded-lg bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white/80 disabled:opacity-35">{busy ? t("saving") : t("save")}</button></div>
	</form></div>;
}
