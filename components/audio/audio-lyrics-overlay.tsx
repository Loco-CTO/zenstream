"use client";

import Link from "next/link";
import {
	ChevronDown,
	ChevronUp,
	LoaderCircle,
	LocateFixed,
	X,
} from "lucide-react";
import {
	useEffect,
	useMemo,
	useRef,
	useState,
	type MutableRefObject,
} from "react";
import { useAudioPlayer } from "@/components/audio/audio-player-provider";
import {
	getAudioLyrics,
	seriesPosterImage,
	type AudioLyrics,
	type MediaItem,
} from "@/lib/media-api";
import { useI18n } from "@/lib/i18n";
import {
	BlurHashGlow,
	BlurHashImage,
	MediaPlaceholder,
} from "@/components/ui/blurhash-image";
import { AudioPlayingIndicator } from "@/components/audio/audio-playing-indicator";

type OverlayTab = "nextUp" | "lyrics";
type AudioPlayer = ReturnType<typeof useAudioPlayer>;

export function AudioLyricsOverlay({
	track,
	onClose,
}: {
	track: MediaItem;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const player = useAudioPlayer();
	const image = seriesPosterImage(track);
	const [lyrics, setLyrics] = useState<AudioLyrics | null>(null);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [follow, setFollow] = useState(true);
	const [activeTab, setActiveTab] = useState<OverlayTab>("lyrics");
	const panelRef = useRef<HTMLDivElement | null>(null);
	const closeRef = useRef<HTMLButtonElement | null>(null);
	const lineRefs = useRef<Array<HTMLButtonElement | HTMLDivElement | null>>([]);
	const ignoreScrollRef = useRef(false);

	useEffect(() => {
		const controller = new AbortController();
		lineRefs.current = [];
		void getAudioLyrics(player.session, track.Id, controller.signal)
			.then(setLyrics)
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setLoadError(
					error instanceof Error ? error.message : t("lyricsLoadFailed"),
				);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [player.session, t, track.Id]);

	useEffect(() => {
		closeRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const activeIndex = useMemo(
		() => activeLyricIndex(lyrics, player.positionSeconds),
		[lyrics, player.positionSeconds],
	);

	useEffect(() => {
		if (!follow || activeIndex < 0) return;
		const target = lineRefs.current[activeIndex];
		if (!target || typeof target.scrollIntoView !== "function") return;
		ignoreScrollRef.current = true;
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		const timeout = window.setTimeout(() => {
			ignoreScrollRef.current = false;
		}, 450);
		return () => window.clearTimeout(timeout);
	}, [activeIndex, follow]);

	const artist = trackArtist(track);
	const albumHref = track.AlbumId
		? `/album/${encodeURIComponent(track.AlbumId)}`
		: undefined;
	const artistHref = track.ArtistId
		? `/artist/${encodeURIComponent(track.ArtistId)}`
		: undefined;
	const linkClass =
		"transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300";

	return (
		<div
			data-testid="audio-lyrics-overlay"
			role="dialog"
			aria-modal="true"
			aria-label={`${t("lyrics")}: ${track.Name}`}
			className="zenstream-audio-lyrics-overlay fixed inset-x-0 top-0 z-[70] overflow-hidden bg-[#100c10] text-white"
		>
			<div className="absolute inset-0 overflow-hidden">
				{image && <BlurHashGlow image={image} className="opacity-10" />}
				<div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(13,10,14,0.97),rgba(13,10,14,0.82)_42%,rgba(13,10,14,0.98))]" />
			</div>
			<div className="relative flex h-full min-h-0 flex-col">
				<header className="relative grid h-14 shrink-0 grid-cols-1 items-center px-4 md:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] md:gap-9 md:px-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-14">
					<button
						ref={closeRef}
						type="button"
						aria-label={t("closeLyrics")}
						onClick={onClose}
						className="absolute left-4 rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 md:left-10 lg:left-14"
					>
						<ChevronDown className="h-5 w-5" />
					</button>
					<nav
						aria-label={t("lyrics")}
						role="tablist"
						className="mx-auto flex h-full items-center gap-7 md:col-start-2 md:mx-0"
					>
						<TabButton
							active={activeTab === "nextUp"}
							label={t("nextUp")}
							onClick={() => setActiveTab("nextUp")}
							tabId="audio-next-up-tab"
							panelId="audio-next-up-panel"
						/>
						<TabButton
							active={activeTab === "lyrics"}
							label={t("lyrics")}
							onClick={() => setActiveTab("lyrics")}
							tabId="audio-lyrics-tab"
							panelId="audio-lyrics-panel"
						/>
					</nav>
				</header>

				<div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden px-4 pb-5 pt-5 md:grid-cols-[minmax(14rem,17rem)_minmax(0,1fr)] md:gap-9 md:px-10 md:pb-8 md:pt-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-14">
					<section className="flex min-h-0 items-center justify-center md:justify-start">
						<div className="w-full max-w-[13rem] text-center">
							<div className="relative mx-auto aspect-square w-[min(56vw,13rem)] overflow-hidden rounded-md bg-black/45 shadow-2xl md:w-full">
								{image ? (
									<BlurHashImage
										image={image}
										alt=""
										sizes="(max-width: 767px) 56vw, 208px"
										className="h-full w-full object-cover"
									/>
								) : (
									<MediaPlaceholder />
								)}
							</div>
							<div className="mt-4 min-w-0 md:mt-6">
								<h1 className="truncate text-xl font-semibold text-white md:text-2xl">
									{track.Name}
								</h1>
								<p className="mt-2 truncate text-base text-white/65">
									{artistHref ? (
										<Link href={artistHref} className={linkClass}>
											{artist}
										</Link>
									) : (
										artist || " "
									)}
								</p>
								<p className="mt-1 truncate text-sm text-white/40">
									{albumHref ? (
										<Link href={albumHref} className={linkClass}>
											{track.Album || " "}
										</Link>
									) : (
										track.Album || " "
									)}
								</p>
							</div>
						</div>
					</section>

					<section
						id={activeTab === "nextUp" ? "audio-next-up-panel" : "audio-lyrics-panel"}
						role="tabpanel"
						aria-labelledby={
							activeTab === "nextUp" ? "audio-next-up-tab" : "audio-lyrics-tab"
						}
						className="min-h-0 overflow-hidden"
					>
						{activeTab === "nextUp" ? (
							<NextUpPanel player={player} />
						) : (
							<LyricsPanel
								activeIndex={activeIndex}
								follow={follow}
								ignoreScrollRef={ignoreScrollRef}
								lineRefs={lineRefs}
								loading={loading}
								loadError={loadError}
								lyrics={lyrics}
								panelRef={panelRef}
								player={player}
								setFollow={setFollow}
							/>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}

function TabButton({
	active,
	label,
	onClick,
	tabId,
	panelId,
}: {
	active: boolean;
	label: string;
	onClick: () => void;
	tabId: string;
	panelId: string;
}) {
	return (
		<button
			id={tabId}
			type="button"
			role="tab"
			aria-selected={active}
			aria-controls={panelId}
			tabIndex={active ? 0 : -1}
			onClick={onClick}
			className={`relative flex h-full items-center px-1 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${active ? "text-white" : "text-white/35 hover:text-white/75"}`}
		>
			{label}
			{active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white" />}
		</button>
	);
}

function NextUpPanel({ player }: { player: AudioPlayer }) {
	const { t } = useI18n();

	return (
		<div
			data-testid="audio-next-up-panel"
			className="flex h-full min-h-0 flex-col"
		>
			<p className="mb-4 shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
				{t("nextUp")}
			</p>
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:rgba(255,255,255,0.25)_transparent]">
				{player.queue.length === 0 ? (
					<p className="py-10 text-center text-sm text-white/45">
						{t("queueEmpty")}
					</p>
				) : (
					<div className="space-y-1 pb-8">
						{player.queue.map((entry, index) => {
							const selected = index === player.currentIndex;
							const duration =
								entry.track.DurationSeconds ??
								entry.track.UserData?.DurationSeconds ??
								0;
							return (
								<div
									key={entry.id}
									aria-current={selected ? "true" : undefined}
									className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/[0.04]"
								>
									<span
										aria-hidden="true"
										className={`flex h-4 w-6 shrink-0 items-center justify-end text-xs tabular-nums ${selected ? "text-white" : "text-white/25"}`}
									>
										{selected ? <AudioPlayingIndicator className="h-3 w-4" /> : index + 1}
									</span>
									<button
										type="button"
										aria-label={`${t("play")} ${entry.track.Name}`}
										onClick={() => player.playQueueItem(index)}
										className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
									>
										<span
											className={`block truncate text-sm font-semibold ${selected ? "text-white" : "text-white/65"}`}
										>
											{entry.track.Name}
										</span>
									</button>
									<div className="relative h-6 w-[5.5rem] shrink-0">
										<span className="absolute inset-0 flex items-center justify-end text-xs tabular-nums text-white/35 group-hover:hidden group-focus-within:hidden">
											{formatTime(duration)}
										</span>
										<div className="absolute inset-0 hidden items-center justify-end gap-0.5 group-hover:flex group-focus-within:flex">
											<button
												type="button"
												aria-label={t("moveUp")}
												disabled={index === 0}
												onClick={() => player.reorderQueue(index, index - 1)}
												className="rounded p-1 text-white/35 transition hover:bg-white/10 hover:text-white disabled:opacity-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
											>
												<ChevronUp className="h-3.5 w-3.5" />
											</button>
											<button
												type="button"
												aria-label={t("moveDown")}
												disabled={index === player.queue.length - 1}
												onClick={() => player.reorderQueue(index, index + 1)}
												className="rounded p-1 text-white/35 transition hover:bg-white/10 hover:text-white disabled:opacity-20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
											>
												<ChevronDown className="h-3.5 w-3.5" />
											</button>
											<button
												type="button"
												aria-label={`${t("removeFromQueue")} ${entry.track.Name}`}
												onClick={() => player.removeQueueItem(entry.id)}
												className="rounded p-1 text-white/35 transition hover:bg-red-400/15 hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
											>
												<X className="h-3.5 w-3.5" />
											</button>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

function LyricsPanel({
	activeIndex,
	follow,
	ignoreScrollRef,
	lineRefs,
	loading,
	loadError,
	lyrics,
	panelRef,
	player,
	setFollow,
}: {
	activeIndex: number;
	follow: boolean;
	ignoreScrollRef: MutableRefObject<boolean>;
	lineRefs: MutableRefObject<Array<HTMLButtonElement | HTMLDivElement | null>>;
	loading: boolean;
	loadError: string | null;
	lyrics: AudioLyrics | null;
	panelRef: MutableRefObject<HTMLDivElement | null>;
	player: AudioPlayer;
	setFollow: (value: boolean) => void;
}) {
	const { t } = useI18n();

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div
				ref={panelRef}
				onScroll={() => {
					if (!ignoreScrollRef.current) setFollow(false);
				}}
				aria-label={t("lyrics")}
				className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-5 [scrollbar-color:rgba(255,255,255,0.25)_transparent] md:px-5 md:py-7"
			>
				{lyrics?.timed && !follow && (
					<div className="sticky top-2 z-10 flex justify-end">
						<button
							type="button"
							onClick={() => setFollow(true)}
							className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs text-white/70 backdrop-blur transition hover:border-white/30 hover:bg-black/75 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
						>
							<LocateFixed className="h-3.5 w-3.5" />
							{t("resumeLyricFollow")}
						</button>
					</div>
				)}
				{loading ? (
					<div
						role="status"
						className="flex h-full min-h-36 items-center justify-center text-white/55"
					>
						<LoaderCircle
							className="h-6 w-6 animate-spin"
							aria-label={t("lyricsLoading")}
						/>
					</div>
				) : loadError ? (
					<p role="alert" className="py-10 text-center text-sm text-red-200/80">
						{loadError}
					</p>
				) : !lyrics ? (
					<p role="status" className="py-10 text-center text-sm text-white/45">
						{t("lyricsUnavailable")}
					</p>
				) : lyrics.timed ? (
					<div className="space-y-5 pb-8 md:space-y-7 md:pb-10">
						{lyrics.lines.map((line, index) => (
							<button
								key={`${line.startSeconds ?? "plain"}-${index}`}
								ref={(element) => {
									lineRefs.current[index] = element;
								}}
								type="button"
								disabled={line.startSeconds === undefined}
								onClick={() => {
									if (line.startSeconds === undefined) return;
									player.seek(line.startSeconds);
									setFollow(true);
								}}
								aria-label={
									line.startSeconds === undefined
										? line.text
										: `${t("seekToLyric")} ${line.text}`
								}
								aria-current={index === activeIndex ? "true" : undefined}
								className={`block w-full text-left text-xl font-semibold leading-relaxed transition md:text-2xl ${index === activeIndex ? "text-white" : "text-white/35 hover:text-white/75"} disabled:cursor-default`}
							>
								{line.text}
							</button>
						))}
					</div>
				) : (
					<div className="whitespace-pre-wrap pb-8 text-base leading-loose text-white/75 md:text-lg">
						{lyrics.lines.map((line, index) => (
							<div key={`${line.text}-${index}`}>{line.text}</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function activeLyricIndex(lyrics: AudioLyrics | null, position: number) {
	if (!lyrics?.timed) return -1;
	let active = -1;
	for (const [index, line] of lyrics.lines.entries()) {
		if (line.startSeconds === undefined || line.startSeconds > position) continue;
		if (line.endSeconds !== undefined && position >= line.endSeconds) continue;
		active = index;
	}
	if (active >= 0) return active;
	for (let index = lyrics.lines.length - 1; index >= 0; index -= 1) {
		const line = lyrics.lines[index];
		if (line?.startSeconds !== undefined && line.startSeconds <= position) {
			return index;
		}
	}
	return -1;
}

function trackArtist(track: MediaItem) {
	return (
		track.Artists?.filter(Boolean).join(", ") ||
		track.ContributingArtists?.filter(Boolean).join(", ") ||
		track.AlbumArtist ||
		""
	);
}

function formatTime(value: number) {
	if (!Number.isFinite(value) || value <= 0) return "0:00";
	const seconds = Math.floor(value);
	const minutes = Math.floor(seconds / 60);
	return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}
