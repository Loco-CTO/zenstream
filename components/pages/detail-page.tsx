"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, Heart, Play, Star } from "lucide-react";
import {
  getEpisodes,
  getInitialSeason,
  heroImage,
  landscapeImage,
  personImage,
  posterImage,
  setFavorite,
  setPlayed,
  titleLogoImage,
  type DetailData,
  type JellyfinItem,
} from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { runtimeLabel, progressPercent } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { useProgress } from "@/components/status/progress-indicator";
import { PrimaryActionButton } from "@/components/ui/primary-action-button";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import {
  MEDIA_CARD_IMAGE_CLASS,
  MediaCardOverlay,
  PosterCard,
  WatchProgress,
} from "@/components/home/media-card";
import { Dropdown } from "@/components/ui/dropdown";
import { BlurHashImage } from "@/components/ui/blurhash-image";

export function DetailPage({ initialData, session }: { initialData: DetailData; session: AuthSession }) {
  const { t, locale } = useI18n();
  const { start } = useProgress();
  const [item, setItem] = useState(initialData.item);
  const [episodes, setEpisodes] = useState(initialData.episodes);
  const [seasonId, setSeasonId] = useState(
    getInitialSeason(initialData.item, initialData.seasons)?.Id ?? "",
  );
  const [mutationError, setMutationError] = useState("");
  const isEpisode = item.Type === "Episode";
  const isSeries = item.Type === "Series";
  const seriesId = isEpisode ? item.SeriesId : item.Id;
  const background = heroImage(item) ?? (
    isEpisode && initialData.backgroundItem
      ? heroImage(initialData.backgroundItem)
      : null
  );
  const titleLogo = titleLogoImage(item);
  const people = item.People?.filter((person) => person.Type === "Actor" || person.Type === "Director") ?? [];

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

  return (
    <main className="min-h-screen pb-24">
      <section className="relative h-[min(70vh,560px)] overflow-hidden">
        {background && <BlurHashImage image={background} alt="" className="absolute inset-0 h-full w-full object-cover brightness-[.42]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--c-hero-bottom)] via-[var(--c-hero-btm-mid)] to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,var(--c-hero-side)_0%,var(--c-hero-side-mid)_35%,transparent_68%)]" />
        <Link
          href={isEpisode && item.SeriesId ? `/show/${item.SeriesId}` : "/"}
          className="absolute left-5 top-20 flex items-center gap-1 rounded-md bg-black/25 px-3 py-2 text-xs uppercase tracking-wider text-white/60 backdrop-blur hover:text-white md:left-8"
        >
          <ChevronLeft className="h-4 w-4" />{isEpisode ? item.SeriesName : t("back")}
        </Link>
        <div className="absolute bottom-8 left-6 right-6 flex items-end gap-6 md:left-14 md:right-14">
          <DetailArtwork item={item} episode={isEpisode} />
          <div className="min-w-0 flex-1">
            {isEpisode && (
              <p className="mb-2 text-xs uppercase tracking-[.18em] text-white/40">
                {t("season")} {item.ParentIndexNumber ?? 0} · {t("episodesLabel")} {item.IndexNumber ?? 0}
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
            {isEpisode && item.Overview && <p className="mt-4 line-clamp-2 max-w-2xl text-sm leading-relaxed text-white/45">{item.Overview}</p>}
          </div>
        </div>
      </section>

      <div className="space-y-9 px-6 pt-6 md:px-14">
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryActionButton disabled title={t("playbackUnavailable")}>
            <Play className="h-4 w-4 fill-black text-black" />{t("play")}
          </PrimaryActionButton>
          <ActionButton
            active={Boolean(item.UserData?.Played)}
            label={t(item.UserData?.Played ? "markUnwatched" : "markWatched")}
            onClick={togglePlayed}
            icon={<Check className="h-4 w-4" />}
          />
          <ActionButton
            active={Boolean(item.UserData?.IsFavorite)}
            label={t(item.UserData?.IsFavorite ? "removeFavorite" : "addFavorite")}
            onClick={toggleFavorite}
            icon={<Heart className={`h-4 w-4 ${item.UserData?.IsFavorite ? "fill-violet-300" : ""}`} />}
          />
          <span className="text-xs text-white/30">{t("playbackUnavailable")}</span>
        </div>
        {mutationError && <p role="alert" className="text-xs text-red-300">{mutationError}</p>}

        {item.Genres?.length ? (
          <div className="flex flex-wrap gap-2">{item.Genres.map((genre) => <span key={genre} className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs uppercase tracking-wider text-white/45">{genre}</span>)}</div>
        ) : null}
        {!isEpisode && item.Overview && <p className="max-w-3xl text-sm leading-relaxed text-white/50">{item.Overview}</p>}

        {(isSeries || isEpisode) && (
          <EpisodeSection
            item={item}
            seasons={initialData.seasons}
            seasonId={seasonId}
            episodes={episodes}
            onSeasonChange={selectSeason}
          />
        )}
        {people.length > 0 && <PeopleSection people={people} />}
        {!isEpisode && initialData.similar.length > 0 && <SimilarSection items={initialData.similar} />}
      </div>
    </main>
  );
}

function DetailArtwork({ item, episode }: { item: JellyfinItem; episode: boolean }) {
  const image = episode ? landscapeImage(item) : posterImage(item);
  if (!image) return null;
  return <div className={`relative hidden shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 shadow-2xl md:block ${episode ? "h-[180px] w-[320px]" : "h-[240px] w-[160px]"}`}><BlurHashImage image={image} alt={item.Name} className="h-full w-full object-cover" /></div>;
}

function Metadata({ item, locale }: { item: JellyfinItem; locale: "en" | "ja" }) {
  return <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
    {item.CommunityRating != null && <span className="flex items-center gap-1 font-semibold text-white/80"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{item.CommunityRating.toFixed(1)}</span>}
    {item.ProductionYear && <span>{item.ProductionYear}</span>}
    {item.OfficialRating && <span className="rounded border border-white/15 px-2 py-0.5 text-xs">{item.OfficialRating}</span>}
    {runtimeLabel(item, locale) && <span>{runtimeLabel(item, locale)}</span>}
    {item.Studios?.[0]?.Name && <span className="text-white/30">{item.Studios[0].Name}</span>}
  </div>;
}

function ActionButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return <button aria-label={label} title={label} onClick={onClick} className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${active ? "border-violet-400/40 bg-violet-500/15 text-violet-300" : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"}`}>{icon}</button>;
}

function EpisodeSection({ item, seasons, seasonId, episodes, onSeasonChange }: {
  item: JellyfinItem; seasons: JellyfinItem[]; seasonId: string; episodes: JellyfinItem[]; onSeasonChange: (id: string) => void;
}) {
  const { t } = useI18n();
  return <section aria-labelledby="episodes-heading">
    <div className="mb-5 flex items-center justify-between">
      <h2 id="episodes-heading" className="text-xs font-semibold uppercase tracking-[.13em] text-white/50">{t("episodesLabel")}</h2>
      {seasons.length > 1 && <Dropdown
        aria-label={t("season")}
        value={seasonId}
        onChange={onSeasonChange}
        options={seasons.map((season) => ({ value: season.Id, label: seasonLabel(season) }))}
      />}
    </div>
    {item.Type === "Episode" ? (
      <HorizontalScroller title={t("episodesLabel")} className="pb-2">
        {episodes.map((episode) => <EpisodeCard key={episode.Id} seriesId={item.SeriesId!} episode={episode} horizontal active={episode.Id === item.Id} />)}
      </HorizontalScroller>
    ) : (
      <div className="space-y-2">
        {episodes.map((episode) => <EpisodeCard key={episode.Id} seriesId={item.Id} episode={episode} horizontal={false} active={false} />)}
      </div>
    )}
  </section>;
}

function seasonLabel(season: JellyfinItem) {
  const number = season.IndexNumber;
  const name = season.Name.trim();
  if (number === undefined) return name;
  return name ? `S${number}: ${name}` : `S${number}`;
}

export function EpisodeCard({ seriesId, episode, horizontal, active }: { seriesId: string; episode: JellyfinItem; horizontal: boolean; active: boolean }) {
  const image = landscapeImage(episode);
  const progress = progressPercent(episode);
  return <Link href={`/show/${seriesId}/episode/${episode.Id}`} className={horizontal ? "group/card w-[320px] shrink-0" : "group flex items-start gap-4 rounded-lg p-2 hover:bg-white/[.04]"}>
    <div className={`relative shrink-0 overflow-hidden rounded bg-white/5 ${horizontal ? "aspect-video w-full" : "h-[90px] w-[160px]"}`}>
      {image && <BlurHashImage image={image} alt={episode.Name} className={horizontal ? `brightness-75 ${MEDIA_CARD_IMAGE_CLASS}` : "h-full w-full object-cover brightness-75"} />}
      {horizontal && !active && <MediaCardOverlay />}
      {active && <div className="absolute inset-0 flex items-center justify-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/80"><Play className="h-4 w-4 fill-white" /></span></div>}
      {horizontal && <WatchProgress progress={progress} />}
    </div>
    <div className={horizontal ? "mt-2" : "min-w-0 flex-1 pt-0.5"}>
      <p className="truncate text-sm font-medium text-white/80">{episode.IndexNumber}. {episode.Name}</p>
      <p className={`mt-1 text-xs leading-relaxed text-white/30 ${horizontal ? "truncate" : "line-clamp-3"}`}>{episode.Overview}</p>
    </div>
  </Link>;
}

function PeopleSection({ people }: { people: NonNullable<JellyfinItem["People"]> }) {
  const { t } = useI18n();
  const title = t("castCrew");
  return <section><h2 className="mb-4 text-xs font-semibold uppercase tracking-[.13em] text-white/50">{title}</h2><HorizontalScroller title={title} className="gap-4">
    {people.map((person) => { const image = personImage(person); return <div key={`${person.Name}-${person.Role}`} className="w-[120px] shrink-0 text-center">
      <div className="relative mx-auto h-24 w-24 overflow-hidden rounded-full bg-white/5 ring-1 ring-white/10">{image && <BlurHashImage image={image} alt={person.Name} className="h-full w-full object-cover brightness-90" />}</div>
      <p className="mt-2 truncate text-xs font-medium text-white/70">{person.Name}</p><p className="truncate text-xs text-white/30">{person.Role ?? person.Type}</p>
    </div>; })}
  </HorizontalScroller></section>;
}

function SimilarSection({ items }: { items: JellyfinItem[] }) {
  const { t } = useI18n();
  const title = t("moreLikeThis");
  return <section><h2 className="mb-4 text-xs font-semibold uppercase tracking-[.13em] text-white/50">{title}</h2><HorizontalScroller title={title} className="pb-2">
    {items.map((similar) => <PosterCard key={similar.Id} item={similar} />)}
  </HorizontalScroller></section>;
}

function updateUserData(item: JellyfinItem, patch: NonNullable<JellyfinItem["UserData"]>) {
  return { ...item, UserData: { ...item.UserData, ...patch } };
}
