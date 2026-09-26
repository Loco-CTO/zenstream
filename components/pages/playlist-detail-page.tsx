"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
	ArrowLeft,
	LockKeyhole,
	Play,
	Share2,
	SquarePen,
	Trash2,
	X,
} from "lucide-react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import { AudioDetailPlaybackActions } from "@/components/audio/audio-detail-playback-actions";
import { AudioPlayingIndicator } from "@/components/audio/audio-playing-indicator";
import { useAudioRowReorder } from "@/components/audio/use-audio-row-reorder";
import { BlurHashImage, MediaPlaceholder } from "@/components/ui/blurhash-image";
import { ErrorPanel } from "@/components/status/error-panel";
import { Toggle } from "@/components/ui/toggle";
import { useI18n } from "@/lib/i18n";
import {
	deletePlaylist,
	fetchPlaylist,
	fetchSharedPlaylist,
	movePlaylistEntry,
	removePlaylistEntry,
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
	const [loadedPlaylistRoute, setLoadedPlaylistRoute] = useState<string | null>(null);
	const [failedPlaylistRoute, setFailedPlaylistRoute] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retry, setRetry] = useState(0);
	const [busy, setBusy] = useState(false);
	const [editOpen, setEditOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [previewOrder, setPreviewOrder] = useState<string[] | null>(null);
	const [nextPage, setNextPage] = useState<number | null>(null);
	const [pageLoading, setPageLoading] = useState(false);
	const [pageError, setPageError] = useState(false);
	const [playLoading, setPlayLoading] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const pageRequestRef = useRef(false);
	const generationRef = useRef(0);
	const refreshInFlightRef = useRef(false);
	const loadedPlaylistRouteRef = useRef<string | null>(null);
	const playlistRef = useRef<Playlist | null>(playlist);
	const playlistRouteKey = shareToken ? `shared:${shareToken}` : `owned:${playlistId ?? ""}`;
	const playlistRouteKeyRef = useRef(playlistRouteKey);
	useEffect(() => {
		playlistRef.current = playlist;
	}, [playlist]);

	useEffect(() => {
		let active = true;
		playlistRouteKeyRef.current = playlistRouteKey;
		const existingPlaylist = loadedPlaylistRouteRef.current === playlistRouteKey
			? playlistRef.current
			: null;
		if (!existingPlaylist) {
			generationRef.current += 1;
			pageRequestRef.current = false;
			loadedPlaylistRouteRef.current = null;
			playlistRef.current = null;
			queueMicrotask(() => {
				if (!active) return;
				setPlaylist(null);
				setLoadedPlaylistRoute(null);
				setFailedPlaylistRoute(null);
				setLoading(true);
				setError(false);
				setPageError(false);
				setPageLoading(false);
				setNextPage(null);
				setPreviewOrder(null);
			});
		}
		// For an already-loaded route, revalidate in the background without
		// changing the visible rows or scroll position.
		const requestGeneration = generationRef.current;
		refreshInFlightRef.current = true;
		const fetchPage = (page: number) => shareToken
			? fetchSharedPlaylist(session, shareToken, page)
			: playlistId
				? fetchPlaylist(session, playlistId, page)
				: Promise.reject(new Error("Playlist not found"));
		void (async () => {
			try {
				const firstPage = await fetchPage(1);
				if (!active || requestGeneration !== generationRef.current) return;
				const currentPlaylist = loadedPlaylistRouteRef.current === playlistRouteKey
					? playlistRef.current
					: null;
				if (currentPlaylist?.id === firstPage.id && currentPlaylist.updatedAt === firstPage.updatedAt) {
					// The playlist did not change; keep every already-loaded page and
					// its scroll position instead of resetting to page one.
					setLoadedPlaylistRoute(playlistRouteKey);
					setFailedPlaylistRoute(null);
					setError(false);
					setPageError(false);
					return;
				}

				if (currentPlaylist?.id === firstPage.id && currentPlaylist.items.length > firstPage.items.length) {
					const loadedPageCount = Math.max(
						1,
						Math.min(
							Math.ceil(currentPlaylist.items.length / 20),
							Math.max(1, Math.ceil(firstPage.itemCount / 20)),
						),
					);
					generationRef.current += 1;
					const generation = generationRef.current;
					pageRequestRef.current = false;
					setPageLoading(false);
					const remainingPages = await Promise.all(
						Array.from({ length: loadedPageCount - 1 }, (_, index) => fetchPage(index + 2)),
					);
					const pages = [firstPage, ...remainingPages];
					if (
						!active ||
						generation !== generationRef.current ||
						pages.some((page) => page.updatedAt !== firstPage.updatedAt)
					) return;
					const seen = new Set<string>();
					const refreshedItems = pages
						.flatMap((page) => page.items)
						.filter((entry) => !seen.has(entry.entryId) && Boolean(seen.add(entry.entryId)));
					const lastPage = pages.at(-1)!;
					const refreshedPlaylist = { ...firstPage, items: refreshedItems, hasMore: lastPage.hasMore };
					playlistRef.current = refreshedPlaylist;
					setPlaylist(refreshedPlaylist);
					setNextPage(lastPage.hasMore ? pages.length + 1 : null);
					setPreviewOrder(null);
				} else {
					playlistRef.current = firstPage;
					setPlaylist(firstPage);
					setNextPage(firstPage.hasMore ? 2 : null);
					setPreviewOrder(null);
				}
				loadedPlaylistRouteRef.current = playlistRouteKey;
				setLoadedPlaylistRoute(playlistRouteKey);
				setFailedPlaylistRoute(null);
				setError(false);
				setPageError(false);
			} catch {
				// A failed background revalidation should not replace a usable page
				// with an error state.
				if (active && !existingPlaylist) {
					setFailedPlaylistRoute(playlistRouteKey);
					setError(true);
				}
			} finally {
				if (active) {
					refreshInFlightRef.current = false;
					setLoading(false);
				}
			}
		})();
		return () => { active = false; };
	}, [playlistId, playlistRouteKey, retry, session, shareToken]);

	useEffect(() => {
		let lastRefreshAt = 0;
		const refresh = () => {
			if (
				loadedPlaylistRouteRef.current !== playlistRouteKeyRef.current ||
				refreshInFlightRef.current
			) return;
			const now = Date.now();
			if (now - lastRefreshAt < 10_000) return;
			lastRefreshAt = now;
			setRetry((value) => value + 1);
		};
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	const items = useMemo(() => playlist?.items ?? [], [playlist?.items]);
	const album = useMemo(() => playlist ? { Id: playlist.id, Name: playlist.name, Type: "MusicAlbum" } : null, [playlist]);
	const displayItems = useMemo(() => previewOrder
		? previewOrder.map((id) => items.find((entry) => entry.entryId === id)).filter((entry): entry is Playlist["items"][number] => Boolean(entry))
		: items, [items, previewOrder]);
	const loadNextPage = useCallback(async () => {
		if (!nextPage || pageRequestRef.current || refreshInFlightRef.current || !playlist) return;
		pageRequestRef.current = true;
		setPageLoading(true);
		setPageError(false);
		const generation = generationRef.current;
		try {
			const result = shareToken
				? await fetchSharedPlaylist(session, shareToken, nextPage)
				: await fetchPlaylist(session, playlist.id, nextPage);
			if (generation !== generationRef.current) return;
			if (result.updatedAt !== playlist.updatedAt) {
				if (!refreshInFlightRef.current) setRetry((value) => value + 1);
				return;
			}
			setPlaylist((value) => {
				if (!value) return result;
				const ids = new Set(value.items.map((entry) => entry.entryId));
				return { ...result, items: [...value.items, ...result.items.filter((entry) => !ids.has(entry.entryId))] };
			});
			setNextPage(result.hasMore ? nextPage + 1 : null);
		} catch {
			if (generation === generationRef.current) setPageError(true);
		} finally {
			pageRequestRef.current = false;
			if (generation === generationRef.current) setPageLoading(false);
		}
	}, [nextPage, playlist, session, shareToken]);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !nextPage || pageError) return;
		const observer = new IntersectionObserver((entries) => {
			if (entries[0]?.isIntersecting) void loadNextPage();
		}, { rootMargin: "600px 0px" });
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [loadNextPage, nextPage, pageError]);

	const playFullPlaylist = useCallback(async (trackId?: string, shuffle = false) => {
		if (!album || !playlist || playLoading) return;
		setPlayLoading(true);
		setError(false);
		try {
			const full = shareToken
				? await fetchSharedPlaylist(session, shareToken)
				: await fetchPlaylist(session, playlist.id);
			playAlbum(album, full.items.map((entry) => entry.item), trackId, shuffle || undefined, Boolean(trackId));
		} catch { setError(true); }
		finally { setPlayLoading(false); }
	}, [album, playAlbum, playLoading, playlist, session, shareToken]);
	const playPlaylistTrack = useCallback((trackId: string) => {
		void playFullPlaylist(trackId);
	}, [playFullPlaylist]);
	const refreshLoaded = useCallback(async (count: number) => {
		if (!playlistId) return;
		const generation = generationRef.current;
		const pages = await Promise.all(Array.from({ length: Math.max(1, Math.ceil(count / 20)) }, (_, index) => fetchPlaylist(session, playlistId, index + 1)));
		if (generation !== generationRef.current || pages.some((page) => page.updatedAt !== pages[0].updatedAt)) return;
		const ids = new Set<string>();
		const reconciled = pages.flatMap((page) => page.items).filter((entry) => !ids.has(entry.entryId) && Boolean(ids.add(entry.entryId)));
		setPlaylist({ ...pages[0], items: reconciled });
		setNextPage(pages.at(-1)?.hasMore ? pages.length + 1 : null);
	}, [playlistId, session]);
	const saveOrder = useCallback(async (order: string[], moved: string, originalIndex: number, destination: number) => {
		if (!playlist || busy) return;
		if (order.length !== playlist.items.length || order.every((id, index) => id === playlist.items[index]?.entryId)) {
			setPreviewOrder(null);
			return;
		}
		setBusy(true);
		generationRef.current += 1;
		pageRequestRef.current = false;
		setNextPage(null);
		try {
			const anchor = destination < originalIndex
				? { beforeEntryId: order[destination + 1] }
				: { afterEntryId: order[destination - 1] };
			const orderedItems = order.map((id) => playlist.items.find((entry) => entry.entryId === id)!).filter(Boolean);
			setPlaylist((value) => value ? { ...value, items: orderedItems } : value);
			const summary = await movePlaylistEntry(session, playlist.id, moved, anchor);
			setPlaylist((value) => value ? { ...value, ...summary, items: value.items } : value);
			setPreviewOrder(null);
			await refreshLoaded(orderedItems.length);
		} catch {
			setError(true);
			setPreviewOrder(null);
			void refreshLoaded(playlist.items.length).catch(() => setRetry((value) => value + 1));
		}
		finally { setBusy(false); }
	}, [busy, playlist, refreshLoaded, session]);
	const onReorder = useCallback((from: number, to: number) => {
		if (!playlist || busy || !playlist.isOwner) return;
		const next = [...playlist.items];
		const [moving] = next.splice(from, 1);
		next.splice(to, 0, moving);
		const order = next.map((entry) => entry.entryId);
		setPreviewOrder(order);
		void saveOrder(order, moving.entryId, from, to);
	}, [busy, playlist, saveOrder]);
	const reorder = useAudioRowReorder(items.length, onReorder, "playlist", playlist?.isOwner === true && !busy);

	const remove = useCallback(async (entryId: string) => {
		if (!playlist || busy) return;
		setBusy(true);
		generationRef.current += 1;
		pageRequestRef.current = false;
		setNextPage(null);
		try {
			const summary = await removePlaylistEntry(session, playlist.id, entryId);
			setPlaylist((value) => value ? { ...value, ...summary, items: value.items.filter((entry) => entry.entryId !== entryId) } : value);
			setPreviewOrder(null);
			await refreshLoaded(playlist.items.length);
		}
		catch { setError(true); }
		finally { setBusy(false); }
	}, [busy, playlist, refreshLoaded, session]);

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

	if (loadedPlaylistRoute !== playlistRouteKey) {
		if (failedPlaylistRoute === playlistRouteKey && error && !loading) {
			return <main className="min-h-screen px-6 pb-28 pt-28"><ErrorPanel message={t("playlistLoadFailed")} onRetry={() => setRetry((value) => value + 1)} /></main>;
		}
		return <main className="min-h-screen px-6 pb-28 pt-28" />;
	}
	if (loading && !playlist) return <main className="min-h-screen px-6 pb-28 pt-28" />;
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
			<div className="mt-7 flex flex-wrap items-center gap-2">
				{playlist.isOwner && !playlist.isPrivate && <button type="button" onClick={() => void sharePlaylist()} aria-label={copied ? t("linkCopied") : t("copyShareLink")} title={copied ? t("linkCopied") : t("copyShareLink")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><Share2 className="h-5 w-5" /></button>}
				{playlist.isOwner && <button type="button" onClick={() => setEditOpen(true)} aria-label={t("editPlaylist")} title={t("editPlaylist")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/35 transition-colors hover:text-white/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"><SquarePen className="h-5 w-5" /></button>}
				{playlist.isOwner && <button type="button" onClick={() => setDeleteOpen(true)} aria-label={t("deletePlaylist")} title={t("deletePlaylist")} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-200/65 transition-colors hover:bg-red-500/10 hover:text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"><Trash2 className="h-5 w-5" /></button>}
				<AudioDetailPlaybackActions
					className="ml-auto"
					playLabel={t("playAll")}
					shuffleLabel={t("shuffle")}
					onPlay={() => void playFullPlaylist()}
					onShuffle={() => void playFullPlaylist(undefined, true)}
					disabled={playlist.itemCount === 0 || playLoading}
					busy={playLoading}
				/>
			</div>
			{error && <p role="alert" className="mt-4 text-xs text-red-200/80">{t("playlistSaveFailed")}</p>}
			{items.length === 0 ? <div className="mt-8 rounded-xl border border-white/10 px-6 py-16 text-center text-sm text-white/45">{t("playlistEmpty")}</div> : <PlaylistTrackList
				items={items}
				displayItems={displayItems}
				isOwner={playlist.isOwner}
				busy={busy}
				currentTrackId={currentTrack?.Id}
				isPlaying={isPlaying}
				onPlayTrack={playPlaylistTrack}
				onRemove={remove}
				onPointerDown={reorder.onPointerDown}
				onClickCapture={reorder.onClickCapture}
				playLabel={t("play")}
				removeLabel={t("removeFromPlaylist")}
				nowPlayingLabel={t("nowPlaying")}
			/>}
			{nextPage && <div ref={sentinelRef} className="py-5 text-center text-xs text-white/40">{pageError ? <button type="button" onClick={() => void loadNextPage()}>{t("retry")}</button> : pageLoading ? t("loading") : null}</div>}
			{editOpen && <EditPlaylistDialog session={session} playlist={playlist} onClose={() => setEditOpen(false)} onSaved={(value) => {
				generationRef.current += 1;
				const current = playlistRef.current ?? playlist;
				const updated = { ...current, ...value, items: current.items };
				playlistRef.current = updated;
				setPlaylist(updated);
				setEditOpen(false);
			}} />}
			{deleteOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#171719] p-5"><h2 className="text-base font-bold text-white">{t("deletePlaylist")}</h2><p className="mt-2 text-sm text-white/55">{t("deletePlaylistConfirm", { name: playlist.name })}</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setDeleteOpen(false)} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/55">{t("cancel")}</button><button type="button" disabled={busy} onClick={() => void removePlaylist()} className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-100">{t("delete")}</button></div></div></div>}
		</main>
	);
}

type PlaylistTrackListProps = {
	items: Playlist["items"];
	displayItems: Playlist["items"];
	isOwner: boolean;
	busy: boolean;
	currentTrackId?: string;
	isPlaying: boolean;
	onPlayTrack: (trackId: string) => void;
	onRemove: (entryId: string) => Promise<void>;
	onPointerDown: ReturnType<typeof useAudioRowReorder>["onPointerDown"];
	onClickCapture: ReturnType<typeof useAudioRowReorder>["onClickCapture"];
	playLabel: string;
	removeLabel: string;
	nowPlayingLabel: string;
};

const PlaylistTrackList = memo(function PlaylistTrackList({
	items,
	displayItems,
	isOwner,
	busy,
	currentTrackId,
	isPlaying,
	onPlayTrack,
	onRemove,
	onPointerDown,
	onClickCapture,
	playLabel,
	removeLabel,
	nowPlayingLabel,
}: PlaylistTrackListProps) {
	const baseIndexByEntryId = new Map(items.map((entry, index) => [entry.entryId, index]));
	return (
		<div
			data-audio-reorder-list
			onPointerDown={onPointerDown}
			onClickCapture={onClickCapture}
			className="mt-8 divide-y divide-white/[0.08]"
		>
			{displayItems.map((entry, index) => {
				const baseIndex = baseIndexByEntryId.get(entry.entryId) ?? index;
				const image = seriesPosterImage(entry.item);
				const active = currentTrackId === entry.item.Id;
				return <div
					key={entry.entryId}
					data-audio-reorder-scope={isOwner ? "playlist" : undefined}
					data-audio-reorder-index={baseIndex}
					className={`group relative flex items-center gap-3 py-3 transition-transform duration-100 ease-out ${isOwner ? "cursor-grab active:cursor-grabbing" : ""}`}
				>
					<button type="button" aria-label={`${playLabel} ${entry.item.Name}`} onClick={() => onPlayTrack(entry.item.Id)} className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
						{image ? <BlurHashImage image={image} alt="" sizes="48px" className="h-full w-full object-cover" /> : <MediaPlaceholder />}
						<span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition group-hover:opacity-100">{active && isPlaying ? <AudioPlayingIndicator ariaLabel={nowPlayingLabel} /> : <Play className="h-4 w-4 fill-white text-white" />}</span>
					</button>
					<button type="button" onClick={() => onPlayTrack(entry.item.Id)} className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-white/85 hover:text-white">{entry.item.Name}</button>
					{isOwner && <div className="flex shrink-0 items-center gap-1 opacity-65 transition group-hover:opacity-100">
						<button type="button" disabled={busy} aria-label={removeLabel} onClick={() => void onRemove(entry.entryId)} className="rounded p-1 text-white/35 hover:bg-white/[0.08] hover:text-white disabled:opacity-25"><X className="h-4 w-4" /></button>
					</div>}
				</div>;
			})}
		</div>
	);
});

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

	const privacyLabel = t(isPrivate ? "privatePlaylist" : "publicPlaylist");

	return (
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-xl sm:p-6"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose();
			}}
		>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby="edit-playlist-title"
				aria-busy={busy}
				onSubmit={(event) => void submit(event)}
				className="w-full max-w-md rounded-2xl border border-white/10 bg-black/35 p-5 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-6"
			>
				<div className="mb-5 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
					<h2
						id="edit-playlist-title"
						className="text-base font-semibold tracking-tight text-white"
					>
						{t("editPlaylist")}
					</h2>
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
							{busy ? t("saving") : t("save")}
						</button>
					</div>
				</div>
			</form>
		</div>
	);
}
