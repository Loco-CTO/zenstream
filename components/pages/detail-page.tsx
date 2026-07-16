"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Heart, Play, Star } from "lucide-react";
import {
	getPlaybackInfo,
	getEpisodes,
	getInitialSeason,
	heroImage,
	landscapeImage,
	personImage,
	posterImage,
	setFavorite,
	setPlayed,
	titleLogoImage,
	playbackStreams,
	type DetailData,
	type JellyfinItem,
} from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { releaseDateLabel, runtimeLabel, progressPercent } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/components/status/progress-indicator";
import { PrimaryActionButton } from "@/components/ui/primary-action-button";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import {
	MEDIA_CARD_IMAGE_CLASS,
	MediaCardOverlay,
	PosterCard,
	WatchedIndicator,
	WatchProgress,
} from "@/components/home/media-card";
import { Dropdown } from "@/components/ui/dropdown";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import {
	HoverPreviewVideo,
	useHoverPreview,
} from "@/components/ui/hover-preview";
import { useSyncplay, type SyncplayGroup } from "@/lib/syncplay";
import { resolvePlaybackTarget, syncplayMediaStartCommand as mediaStartCommand } from "@/lib/syncplay-playback";

type TrackChoice = { audio?: number | string; subtitle?: number };

export function syncplayMediaStartCommand(
	active: SyncplayGroup | null,
	canControl: boolean,
	itemId: string,
) {
	if (!active || !canControl) return null;
	return mediaStartCommand(itemId);
}

export function DetailPage({
	initialData,
	session,
}: {
	initialData: DetailData;
	session: AuthSession;
}) {
	const { t, locale } = useI18n();
	const router = useRouter();
	const { start } = useProgress();
	const [item, setItem] = useState(initialData.item);
	const [episodes, setEpisodes] = useState(initialData.episodes);
	const [seasonId, setSeasonId] = useState(
		getInitialSeason(
			initialData.item,
			initialData.seasons,
			getRequestedSeasonId(),
		)?.Id ?? "",
	);
	const [mutationError, setMutationError] = useState("");
	const [trackChoices, setTrackChoices] = useState<{
		itemId: string;
		streams: ReturnType<typeof playbackStreams>;
	}>();
	const [selectedTracks, setSelectedTracks] = useState<TrackChoice>({});
	const { active, canControl, command } = useSyncplay();
	const isEpisode = item.Type === "Episode";
	const isSeries = item.Type === "Series";
	const seriesId = isEpisode ? item.SeriesId : item.Id;
	const background =
		heroImage(item) ??
		(isEpisode && initialData.backgroundItem
			? heroImage(initialData.backgroundItem)
			: null);
	const titleLogo = titleLogoImage(item);
	const people =
		item.People?.filter(
			(person) => person.Type === "Actor" || person.Type === "Director",
		) ?? [];
	const currentTrackChoices =
		trackChoices?.itemId === item.Id ? trackChoices.streams : undefined;

	useEffect(() => {
		let active = true;
		void getPlaybackInfo(session, item.Id, { subtitleStreamIndex: -1 })
			.then((playback) => {
				if (!active) return;
				const parsed = playbackStreams(playback);
				setTrackChoices({ itemId: item.Id, streams: parsed });
				const audio =
					parsed.audio.find((track) => track.IsDefault) ?? parsed.audio[0];
				const subtitle =
					parsed.subtitles.find((track) => track.IsDefault) ??
					parsed.subtitles[0];
				setSelectedTracks({ audio: audio?.Index, subtitle: subtitle?.Index });
			})
			.catch(() => undefined);
		return () => {
			active = false;
		};
	}, [item.Id, session]);
	function goBack() {
		if (isEpisode && seriesId) {
			const season = item.SeasonId ?? "";
			router.replace(
				`/show/${encodeURIComponent(seriesId)}${season ? `?seasonId=${encodeURIComponent(season)}` : ""}`,
			);
			return;
		}
		if (window.history.length > 1) {
			router.back();
			return;
		}
		router.push("/");
	}

	async function selectSeason(nextSeasonId: string) {
		if (!seriesId || nextSeasonId === seasonId) return;
		const previous = seasonId;
		setSeasonId(nextSeasonId);
		const finish = start();
		try {
			setEpisodes(await getEpisodes(session, seriesId, nextSeasonId));
		} catch {
			setSeasonId(previous);
			setMutationError(t("detailLoadFailed"));
		} finally {
			finish();
		}
	}

	async function toggleFavorite() {
		const previous = Boolean(item.UserData?.IsFavorite);
		setItem(updateUserData(item, { IsFavorite: !previous }));
		setMutationError("");
		const finish = start();
		try {
			await setFavorite(session, item.Id, !previous);
		} catch {
			setItem(updateUserData(item, { IsFavorite: previous }));
			setMutationError(t("detailLoadFailed"));
		} finally {
			finish();
		}
	}

	async function togglePlayed() {
		const previous = Boolean(item.UserData?.Played);
		setItem(updateUserData(item, { Played: !previous }));
		setMutationError("");
		const finish = start();
		try {
			await setPlayed(session, item.Id, !previous);
		} catch {
			setItem(updateUserData(item, { Played: previous }));
			setMutationError(t("detailLoadFailed"));
		} finally {
			finish();
		}
	}

	const startPlayback = useCallback(async () => {
		setMutationError("");
		let target = item;
		if (isSeries) {
			const finish = start();
			try {
				const resolved = await resolvePlaybackTarget(session, item);
				if (!resolved) return;
				target = resolved;
				setItem(target);
			} catch {
				setMutationError(t("detailLoadFailed"));
				return;
			} finally {
				finish();
			}
		}
		// Send the media transition before navigating away. The route transition can
		// briefly tear down the current page; if navigation happens first, the host
		// socket may be treated as disconnected before the room receives the media
		// command.
		const mediaCommand = syncplayMediaStartCommand(active, canControl, target.Id);
		if (mediaCommand) {
			try {
				// Complete the host's media transition before leaving this route. The
				// provider announces immediately, but awaiting the request prevents the
				// navigation from racing the command transport.
				await command(mediaCommand);
			} catch {
				setMutationError("Playback could not be loaded.");
				return;
			}
		}
		router.push(`/play/${encodeURIComponent(target.Id)}`);
	}, [active, canControl, command, isSeries, item, router, session, start, t]);

	return (
		<>
			<main className="min-h-screen pb-24">
				<section className="relative h-[clamp(24rem,62svh,35rem)] overflow-hidden md:h-[min(70vh,560px)]">
					{background && (
						<BlurHashImage
							image={background}
							alt=""
							className="absolute inset-0 h-full w-full object-cover brightness-[.42]"
						/>
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-[var(--c-hero-bottom)] via-[var(--c-hero-btm-mid)] to-transparent" />
					<div className="absolute inset-0 bg-[linear-gradient(105deg,var(--c-hero-side)_0%,var(--c-hero-side-mid)_35%,transparent_68%)]" />
					<button
						type="button"
						onClick={goBack}
						aria-label={t("back")}
						className="absolute left-4 top-[calc(4rem+env(safe-area-inset-top))] flex items-center gap-1 rounded-md px-2 py-2 text-xs uppercase tracking-wider text-white/60 hover:text-white sm:left-5 md:left-8 md:top-20"
					>
						<ChevronLeft className="h-4 w-4" />
						{isEpisode ? item.SeriesName : t("back")}
					</button>
					<div className="absolute bottom-6 left-4 right-4 flex items-end gap-3 sm:left-6 sm:right-6 md:bottom-8 md:left-14 md:right-14 md:gap-6">
						<DetailArtwork item={item} episode={isEpisode} />
						<div className="min-w-0 flex-1">
							{isEpisode && (
								<p className="mb-2 text-xs uppercase tracking-[.18em] text-white/40">
									{t("season")} {item.ParentIndexNumber ?? 0} ·{" "}
									{t("episodesLabel")} {item.IndexNumber ?? 0}
								</p>
							)}
							<h1 className="mb-3 text-[clamp(2rem,5vw,3.5rem)] font-black leading-none tracking-normal text-white">
								{titleLogo ? (
									<BlurHashImage
										image={titleLogo}
										alt={item.Name}
										className="max-h-24 max-w-full object-contain object-left md:max-h-32"
									/>
								) : (
									item.Name
								)}
							</h1>
							<Metadata item={item} locale={locale} />
							{isEpisode && item.Overview && (
								<p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/45">
									{item.Overview}
								</p>
							)}
						</div>
					</div>
				</section>

				<div className="space-y-8 px-4 pt-5 sm:px-6 sm:pt-6 md:space-y-9 md:px-14">
					<div className="space-y-3">
						<div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3 md:mb-8">
							<PrimaryActionButton
								onClick={startPlayback}
							>
								<Play className="h-4 w-4 fill-black text-black" />
								{t("play")}
							</PrimaryActionButton>
							<ActionButton
								active={Boolean(item.UserData?.Played)}
								label={t(
									item.UserData?.Played ? "markUnwatched" : "markWatched",
								)}
								onClick={togglePlayed}
								icon={<Check className="h-4 w-4" />}
							/>
							<ActionButton
								active={Boolean(item.UserData?.IsFavorite)}
								label={t(
									item.UserData?.IsFavorite ? "removeFavorite" : "addFavorite",
								)}
								onClick={toggleFavorite}
								icon={
									<Heart
										className={`h-4 w-4 ${item.UserData?.IsFavorite ? "fill-violet-300" : ""}`}
									/>
								}
							/>
						</div>
						{currentTrackChoices &&
							(currentTrackChoices.audio.length > 0 ||
								currentTrackChoices.subtitles.length > 0) && (
								<InlineTrackChoices
									tracks={currentTrackChoices}
									selected={selectedTracks}
									onChange={setSelectedTracks}
								/>
							)}
					</div>
					{mutationError && (
						<p role="alert" className="text-xs text-red-300">
							{mutationError}
						</p>
					)}

					{item.Genres?.length ? (
						<div className="flex flex-wrap gap-2">
							{item.Genres.map((genre) => (
								<span
									key={genre}
									className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs uppercase tracking-wider text-white/45"
								>
									{genre}
								</span>
							))}
						</div>
					) : null}
					{!isEpisode && item.Overview && (
						<p className="max-w-3xl text-sm leading-relaxed text-white/50">
							{item.Overview}
						</p>
					)}

					{(isSeries || isEpisode) && (
						<EpisodeSection
							item={item}
							session={session}
							seasons={initialData.seasons}
							seasonId={seasonId}
							episodes={episodes}
							onSeasonChange={selectSeason}
						/>
					)}
					{people.length > 0 && <PeopleSection people={people} />}
					{!isEpisode && initialData.similar.length > 0 && (
						<SimilarSection items={initialData.similar} session={session} />
					)}
				</div>
			</main>
		</>
	);
}

function getRequestedSeasonId() {
		if (typeof window === "undefined") return undefined;
		return new URLSearchParams(window.location.search).get("seasonId") ?? undefined;
}

function InlineTrackChoices({
	tracks,
	selected,
	onChange,
}: {
	tracks: ReturnType<typeof playbackStreams>;
	selected: TrackChoice;
	onChange: (value: TrackChoice) => void;
}) {
	const { t } = useI18n();
	const options = (kind: "audio" | "subtitle") =>
		(kind === "audio" ? tracks.audio : tracks.subtitles).map((track) => ({
			value: String(track.Index),
			label:
				track.DisplayTitle ??
				track.Language ??
				t(kind === "audio" ? "audioTrack" : "subtitleTrack"),
		}));
	return (
		<div className="w-full min-w-0 max-w-md space-y-2 md:w-fit">
			{tracks.audio.length > 1 && (
				<TrackSelect
					label={t("audioTrack")}
					options={options("audio")}
					value={selected.audio}
					onChange={(audio) => onChange({ ...selected, audio: Number(audio) })}
				/>
			)}
			{tracks.subtitles.length > 0 && (
				<TrackSelect
					label={t("subtitleTrack")}
					options={[
						{ value: "", label: t("subtitlesOff") },
						...options("subtitle"),
					]}
					value={selected.subtitle}
					onChange={(subtitle) =>
						onChange({
							...selected,
							subtitle: subtitle ? Number(subtitle) : undefined,
						})
					}
				/>
			)}
		</div>
	);
}

function TrackSelectionDialog({
	tracks,
	selected,
	onChange,
	onCancel,
	onPlay,
}: {
	tracks: ReturnType<typeof playbackStreams>;
	selected: TrackChoice;
	onChange: (value: TrackChoice) => void;
	onCancel: () => void;
	onPlay: () => void;
}) {
	const { t } = useI18n();
	const options = (kind: "audio" | "subtitle") =>
		(kind === "audio" ? tracks.audio : tracks.subtitles).map((track) => ({
			value: String(track.Index),
			label:
				track.DisplayTitle ??
				track.Language ??
				t(kind === "audio" ? "audioTrack" : "subtitleTrack"),
		}));
	return (
		<div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
			<div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-white/15 bg-black/25 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
				<h2 className="text-lg font-semibold text-white">
					{t("selectTracks")}
				</h2>
				<div className="mt-5 grid gap-4">
					{tracks.audio.length > 1 && (
						<TrackSelect
							label={t("audioTrack")}
							options={options("audio")}
							value={selected.audio}
							onChange={(audio) => onChange({ ...selected, audio })}
						/>
					)}
					{tracks.subtitles.length > 0 && (
						<TrackSelect
							label={t("subtitleTrack")}
							options={[
								{ value: "", label: t("subtitlesOff") },
								...options("subtitle"),
							]}
							value={selected.subtitle}
							onChange={(subtitle) =>
								onChange({
									...selected,
									subtitle: subtitle ? Number(subtitle) : undefined,
								})
							}
						/>
					)}
				</div>
				<div className="mt-6 flex flex-wrap justify-end gap-2">
					<button
						type="button"
						onClick={onCancel}
						className="rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10"
					>
						{t("cancel")}
					</button>
					<button
						type="button"
						onClick={onPlay}
						className="rounded-lg bg-violet-300 px-4 py-2 text-sm font-semibold text-black"
					>
						{t("play")}
					</button>
				</div>
			</div>
		</div>
	);
}

function TrackSelect({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: { value: string; label: string }[];
	value?: number | string;
	onChange: (value: string) => void;
}) {
	return (
		<div className="flex min-h-10 items-center justify-between gap-4 px-3 py-1 text-sm text-white/70 backdrop-blur-xl">
			<span className="shrink-0 text-xs font-medium uppercase tracking-wider text-white/45">
				{label}
			</span>
			<Dropdown
				aria-label={label}
				value={value == null ? "" : String(value)}
				options={options}
				onChange={onChange}
			/>
		</div>
	);
}

function DetailArtwork({
	item,
	episode,
}: {
	item: JellyfinItem;
	episode: boolean;
}) {
	const image = episode ? landscapeImage(item) : posterImage(item);
	if (!image) return null;
	return (
		<div
			className={`relative hidden shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 shadow-2xl md:block ${episode ? "h-[180px] w-[320px]" : "h-[240px] w-[160px]"}`}
		>
			<BlurHashImage
				image={image}
				alt={item.Name}
				className="h-full w-full object-cover"
			/>
		</div>
	);
}

function Metadata({
	item,
	locale,
}: {
	item: JellyfinItem;
	locale: "en" | "ja";
}) {
	return (
		<div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
			{item.CommunityRating != null && (
				<span className="flex items-center gap-1 font-semibold text-white/80">
					<Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
					{item.CommunityRating.toFixed(1)}
				</span>
			)}
			{releaseDateLabel(item, locale) && <span>{releaseDateLabel(item, locale)}</span>}
			{item.OfficialRating && (
				<span className="rounded border border-white/15 px-2 py-0.5 text-xs">
					{item.OfficialRating}
				</span>
			)}
			{runtimeLabel(item, locale) && <span>{runtimeLabel(item, locale)}</span>}
			{item.Studios?.[0]?.Name && (
				<span className="text-white/30">{item.Studios[0].Name}</span>
			)}
		</div>
	);
}

function ActionButton({
	active,
	label,
	onClick,
	icon,
}: {
	active: boolean;
	label: string;
	onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
	icon: React.ReactNode;
}) {
	return (
		<button
			aria-label={label}
			title={label}
			onClick={onClick}
			className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${active ? "border-violet-400/40 bg-violet-500/15 text-violet-300" : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}
		>
			{icon}
		</button>
	);
}

function EpisodeSection({
	item,
	session,
	seasons,
	seasonId,
	episodes,
	onSeasonChange,
}: {
	item: JellyfinItem;
	session: AuthSession;
	seasons: JellyfinItem[];
	seasonId: string;
	episodes: JellyfinItem[];
	onSeasonChange: (id: string) => void;
}) {
	const { t } = useI18n();
	const [seasonItems, setSeasonItems] = useState(seasons);
	const selectedSeason = seasonItems.find((season) => season.Id === seasonId) ?? seasonItems[0];
	async function toggleSeason(season: JellyfinItem, field: "Played" | "IsFavorite") {
		const previous = Boolean(season.UserData?.[field]);
		setSeasonItems((items) => items.map((item) => item.Id === season.Id ? updateUserData(item, { [field]: !previous }) : item));
		try {
			if (field === "Played") await setPlayed(session, season.Id, !previous);
			else await setFavorite(session, season.Id, !previous);
		}
		catch { setSeasonItems((items) => items.map((item) => item.Id === season.Id ? updateUserData(item, { [field]: previous }) : item)); }
	}
	return (
		<section aria-labelledby="episodes-heading">
			<div className="mb-5 flex items-center justify-between">
				<h2
					id="episodes-heading"
					className="text-xs font-semibold uppercase tracking-[.13em] text-white/50"
				>
					{t("episodesLabel")}
				</h2>
				<div className="flex items-center gap-2">
					{seasonItems.length > 1 && <Dropdown aria-label={t("season")} value={seasonId} onChange={onSeasonChange} options={seasonItems.map((season) => ({ value: season.Id, label: seasonLabel(season) }))} />}
					{selectedSeason && <ItemActionButtons item={selectedSeason} onToggle={(field) => void toggleSeason(selectedSeason, field)} />}
				</div>
			</div>
			{item.Type === "Episode" ? (
				<HorizontalScroller
					title={t("episodesLabel")}
					className="pb-2"
					initialScrollIndex={Math.max(0, episodes.findIndex((episode) => episode.Id === item.Id))}
				>
					{episodes.map((episode) => (
						<EpisodeCard
							key={episode.Id}
							seriesId={item.SeriesId!}
							episode={episode}
							horizontal
							active={episode.Id === item.Id}
							session={session}
						/>
					))}
				</HorizontalScroller>
			) : (
				<div className="space-y-2">
					{episodes.map((episode) => (
						<EpisodeCard
							key={episode.Id}
							seriesId={item.Id}
							episode={episode}
							horizontal={false}
							active={false}
							session={session}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function seasonLabel(season: JellyfinItem) {
	const number = season.IndexNumber;
	const name = season.Name.trim();
	if (number === undefined) return name;
	return name ? `S${number}: ${name}` : `S${number}`;
}

export function EpisodeCard({
	seriesId,
	episode,
	horizontal,
	active,
	session,
}: {
	seriesId: string;
	episode: JellyfinItem;
	horizontal: boolean;
	active: boolean;
	session?: AuthSession;
}) {
	const [currentEpisode, setCurrentEpisode] = useState(episode);
	const image = landscapeImage(episode);
	const progress = progressPercent(episode);
	const preview = useHoverPreview(episode.Id, episode.RunTimeTicks, session);
	return (
		<div
			onPointerEnter={horizontal ? preview.start : undefined}
			onPointerLeave={horizontal ? preview.stop : undefined}
			className={
				horizontal
					? "group/card w-[240px] shrink-0 sm:w-[280px] md:w-[320px]"
					: "group/card flex items-start gap-4 rounded-lg p-2 hover:bg-white/[.04]"
			}
		>
			<div className={`relative shrink-0 ${horizontal ? "aspect-video w-full" : "h-[120px] w-[213px]"}`}>
			<Link
				href={`/show/${seriesId}/episode/${episode.Id}`}
				className="block h-full w-full overflow-hidden rounded bg-white/5"
			>
				{horizontal && <HoverPreviewVideo preview={preview} />}
				{image && (
					<BlurHashImage
						image={image}
						alt={episode.Name}
						className={
							horizontal
								? `brightness-75 ${MEDIA_CARD_IMAGE_CLASS}`
								: "h-full w-full object-cover brightness-75"
						}
					/>
				)}
				{horizontal && <WatchProgress progress={progress} />}
				<WatchedIndicator item={currentEpisode} />
			</Link>
			{!active && <MediaCardOverlay href={`/play/${episode.Id}`} title={episode.Name} item={episode} session={session} />}
			</div>
			<Link href={`/show/${seriesId}/episode/${episode.Id}`} className={horizontal ? "mt-2 block" : "min-w-0 flex-1 pt-0.5"}>
				<p className="truncate text-sm font-medium text-white/80">
					{episode.IndexNumber}. {episode.Name}
				</p>
				<p
					className={`mt-1 text-xs leading-relaxed text-white/30 ${horizontal ? "truncate" : "line-clamp-3"}`}
				>
					{episode.Overview}
				</p>
			</Link>
			{!horizontal && <ItemActionButtons item={currentEpisode} onToggle={async (field) => {
				const previous = Boolean(currentEpisode.UserData?.[field]);
				setCurrentEpisode(updateUserData(currentEpisode, { [field]: !previous }));
				try {
					if (field === "Played") await setPlayed(session!, episode.Id, !previous);
					else await setFavorite(session!, episode.Id, !previous);
				}
				catch { setCurrentEpisode(updateUserData(currentEpisode, { [field]: previous })); }
			}} />}
		</div>
	);
}

function ItemActionButtons({ item, onToggle }: { item: JellyfinItem; onToggle: (field: "Played" | "IsFavorite") => void }) {
	const { t } = useI18n();
	const buttonClass = "flex h-8 w-8 items-center justify-center rounded-md text-white/35 transition hover:bg-white/[.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50";
	return <div className="flex shrink-0 items-center gap-0.5">
		<button type="button" aria-label={t(item.UserData?.Played ? "markUnwatched" : "markWatched")} title={t(item.UserData?.Played ? "markUnwatched" : "markWatched")} className={`${buttonClass} ${item.UserData?.Played ? "text-violet-300" : ""}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggle("Played"); }}>
			<Check className="h-4 w-4" />
		</button>
		<button type="button" aria-label={t(item.UserData?.IsFavorite ? "removeFavorite" : "addFavorite")} title={t(item.UserData?.IsFavorite ? "removeFavorite" : "addFavorite")} className={`${buttonClass} ${item.UserData?.IsFavorite ? "text-violet-300" : ""}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggle("IsFavorite"); }}>
			<Heart className={`h-4 w-4 ${item.UserData?.IsFavorite ? "fill-violet-300" : ""}`} />
		</button>
	</div>;
}

function PeopleSection({
	people,
}: {
	people: NonNullable<JellyfinItem["People"]>;
}) {
	const { t } = useI18n();
	const title = t("castCrew");
	return (
		<section>
			<h2 className="mb-4 text-xs font-semibold uppercase tracking-[.13em] text-white/50">
				{title}
			</h2>
			<HorizontalScroller title={title} className="gap-4">
				{people.map((person) => {
					const image = personImage(person);
					return (
						<div
							key={`${person.Name}-${person.Role}`}
							className="w-[120px] shrink-0 text-center"
						>
							<div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">
								{image && (
									<BlurHashImage
										image={image}
										alt={person.Name}
										className="h-full w-full object-cover brightness-90"
									/>
								)}
							</div>
							<p className="mt-2 truncate text-xs font-medium text-white/70">
								{person.Name}
							</p>
							<p className="truncate text-xs text-white/30">
								{person.Role ?? person.Type}
							</p>
						</div>
					);
				})}
			</HorizontalScroller>
		</section>
	);
}

function SimilarSection({
	items,
	session,
}: {
	items: JellyfinItem[];
	session: AuthSession;
}) {
	const { t } = useI18n();
	const title = t("moreLikeThis");
	return (
		<section>
			<h2 className="mb-4 text-xs font-semibold uppercase tracking-[.13em] text-white/50">
				{title}
			</h2>
			<HorizontalScroller title={title} className="pb-2">
				{items.map((similar) => (
					<PosterCard key={similar.Id} item={similar} session={session} />
				))}
			</HorizontalScroller>
		</section>
	);
}

function updateUserData(
	item: JellyfinItem,
	patch: NonNullable<JellyfinItem["UserData"]>,
) {
	return { ...item, UserData: { ...item.UserData, ...patch } };
}
