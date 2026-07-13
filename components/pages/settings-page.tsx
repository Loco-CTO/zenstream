"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, User } from "lucide-react";
import { userImageUrl } from "@/lib/jellyfin";
import { useI18n, type Locale } from "@/lib/i18n";
import { Dropdown } from "@/components/ui/dropdown";
import { useSubtitlePreferences } from "@/components/subtitle-preferences-provider";
import { SUBTITLE_FONT_STACKS, subtitleOuterShadow } from "@/lib/subtitle-preferences";

type SettingsPageProps = {
  displayName: string;
  userId: string;
  locale: Locale;
  onLocaleChange: (locale: Locale) => Promise<void>;
  onLogout: () => void;
};

export function SettingsPage({ displayName, userId, locale, onLocaleChange, onLogout }: SettingsPageProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { style, update: updateSubtitleStyle, error: subtitleError } = useSubtitlePreferences();
  const [localeError, setLocaleError] = useState(false);
  const [audioLanguage, setAudioLanguage] = useState("ja");
  const [subtitleLanguage, setSubtitleLanguage] = useState("en");
  const [autoplayNext, setAutoplayNext] = useState(true);
  const [autoplayBrowse, setAutoplayBrowse] = useState(true);
  const [newEpisodes, setNewEpisodes] = useState(true);
  const [newSeasons, setNewSeasons] = useState(true);
  const [reminders, setReminders] = useState(false);
  const [updates, setUpdates] = useState(false);
  const [watchHistory, setWatchHistory] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [subtitlePreview, setSubtitlePreview] = useState(false);

  const changeLocale = async (nextLocale: Locale) => {
    setLocaleError(false);
    try {
      await onLocaleChange(nextLocale);
    } catch {
      setLocaleError(true);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-background pb-12 text-foreground">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-[var(--c-nav-from)] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl sm:gap-4 sm:px-6 md:px-14 md:py-4">
        <button type="button" onClick={goBack} aria-label={t("back")} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white">{t("settings")}</h1>
      </header>

      <div className="space-y-7 px-4 py-6 sm:px-6 sm:py-8 md:px-14">
        <SettingsSection title={t("account")}>
          <div className="flex items-center gap-4 border-b border-white/5 px-4 py-4">
            <Avatar userId={userId} />
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{displayName}</p>
            <button className="text-xs font-medium text-violet-400 transition hover:text-violet-300">{t("edit")}</button>
          </div>
          <SettingsRow label={t("changePassword")} border={false} right={<ChevronRight className="h-4 w-4 text-white/20" />} />
        </SettingsSection>

        <SettingsSection title={t("appearance")}>
          <SettingsRow label={t("language")} sub={t("languageDescription")} border={false} right={
            <Dropdown
              aria-label={t("language")}
              value={locale}
              onChange={(value) => void changeLocale(value as Locale)}
              options={[{ value: "en", label: t("english") }, { value: "ja", label: t("japanese") }]}
            />
          } />
          {localeError && <p role="alert" className="border-t border-white/5 px-4 py-3 text-xs text-red-300">{t("localeSaveFailed")}</p>}
        </SettingsSection>

        <SettingsSection title={t("playback")}>
          <SettingsRow label={t("audioLanguage")} right={<SettingsSelect label={t("audioLanguage")} value={audioLanguage} options={[["ja", t("japanese")], ["en", t("english")], ["es", t("spanish")], ["fr", t("french")]]} onChange={setAudioLanguage} />} />
          <SettingsRow label={t("subtitleLanguage")} right={<SettingsSelect label={t("subtitleLanguage")} value={subtitleLanguage} options={[["en", t("english")], ["ja", t("japanese")], ["es", t("spanish")], ["fr", t("french")], ["off", t("off")]]} onChange={setSubtitleLanguage} />} />
          <SettingsRow label={t("subtitleFont")} right={<SettingsSelect label={t("subtitleFont")} value={style.fontFamily} options={[["sans", "Noto Sans"], ["serif", "Serif"], ["mono", "Monospace"]]} onChange={(value) => void updateSubtitleStyle({ fontFamily: value as typeof style.fontFamily })} />} />
          <SettingsRow label={t("subtitleBold")} right={<Toggle label={t("subtitleBold")} checked={style.bold} onChange={(value) => void updateSubtitleStyle({ bold: value })} />} />
          <SettingsRow label={t("subtitlePreview")} border={false} right={<Toggle label={t("subtitlePreview")} checked={subtitlePreview} onChange={setSubtitlePreview} />} />
          {subtitlePreview && <div className="border-t border-white/5 bg-black/30 px-4 py-8 text-center"><span className="inline-block max-w-full" style={{ color: style.fontColor, backgroundColor: hexToRgba(style.backgroundColor, style.backgroundOpacity), fontFamily: SUBTITLE_FONT_STACKS[style.fontFamily], fontSize: `clamp(16px, ${style.textScale / 20}vh, 72px)`, fontWeight: style.bold ? 700 : 400, lineHeight: 1.15, padding: style.backgroundOpacity ? "0.08em 0.2em" : undefined, textShadow: subtitleOuterShadow(style.borderSize, style.borderColor) }}>{t("subtitlePreviewText")}</span></div>}
          <SettingsRow label={t("subtitleTextSize")} right={<RangeControl label={t("subtitleTextSize")} min={50} max={200} value={style.textScale} suffix="%" onChange={(value) => void updateSubtitleStyle({ textScale: value })} />} />
          <SettingsRow label={t("subtitleFontColor")} right={<ColorControl label={t("subtitleFontColor")} value={style.fontColor} onChange={(value) => void updateSubtitleStyle({ fontColor: value })} />} />
          <SettingsRow label={t("subtitleBorderSize")} right={<RangeControl label={t("subtitleBorderSize")} min={0} max={8} step={1} value={style.borderSize} suffix="px" onChange={(value) => void updateSubtitleStyle({ borderSize: value })} />} />
          <SettingsRow label={t("subtitleBorderColor")} right={<ColorControl label={t("subtitleBorderColor")} value={style.borderColor} onChange={(value) => void updateSubtitleStyle({ borderColor: value })} />} />
          <SettingsRow label={t("subtitleBackgroundColor")} right={<ColorControl label={t("subtitleBackgroundColor")} value={style.backgroundColor} onChange={(value) => void updateSubtitleStyle({ backgroundColor: value })} />} />
          <SettingsRow label={t("subtitleBackgroundOpacity")} right={<RangeControl label={t("subtitleBackgroundOpacity")} min={0} max={100} value={style.backgroundOpacity} suffix="%" onChange={(value) => void updateSubtitleStyle({ backgroundOpacity: value })} />} />
          {subtitleError && <p role="alert" className="border-t border-white/5 px-4 py-3 text-xs text-red-300">{t("subtitleSaveFailed")}</p>}
          <SettingsRow label={t("autoplayNextEpisode")} right={<Toggle label={t("autoplayNextEpisode")} checked={autoplayNext} onChange={setAutoplayNext} />} />
          <SettingsRow label={t("autoplayBrowse")} sub={t("autoplayBrowseDescription")} border={false} right={<Toggle label={t("autoplayBrowse")} checked={autoplayBrowse} onChange={setAutoplayBrowse} />} />
        </SettingsSection>

        <SettingsSection title={t("notifications")}>
          <SettingsRow label={t("newEpisodes")} sub={t("newEpisodesDescription")} right={<Toggle label={t("newEpisodes")} checked={newEpisodes} onChange={setNewEpisodes} />} />
          <SettingsRow label={t("newSeasons")} right={<Toggle label={t("newSeasons")} checked={newSeasons} onChange={setNewSeasons} />} />
          <SettingsRow label={t("watchReminders")} sub={t("watchRemindersDescription")} right={<Toggle label={t("watchReminders")} checked={reminders} onChange={setReminders} />} />
          <SettingsRow label={t("appUpdates")} border={false} right={<Toggle label={t("appUpdates")} checked={updates} onChange={setUpdates} />} />
        </SettingsSection>

        <SettingsSection title={t("privacyData")}>
          <SettingsRow label={t("watchHistory")} sub={t("watchHistoryDescription")} right={<Toggle label={t("watchHistory")} checked={watchHistory} onChange={setWatchHistory} />} />
          <SettingsRow label={t("dataSaver")} sub={t("dataSaverDescription")} right={<Toggle label={t("dataSaver")} checked={dataSaver} onChange={setDataSaver} />} />
          <SettingsRow label={t("clearWatchHistory")} border={false} right={<button className="text-xs font-medium text-red-400/70 transition hover:text-red-400">{t("clear")}</button>} />
        </SettingsSection>

        <SettingsSection title={t("dangerZone")}>
          <SettingsRow label={t("logout")} border={false} right={
            <button onClick={onLogout} className="flex items-center gap-1.5 text-xs font-medium text-red-400/70 transition hover:text-red-400">
              <LogOut className="h-3.5 w-3.5" />{t("logout")}
            </button>
          } />
        </SettingsSection>
      </div>
    </main>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section aria-label={title}><p className="mb-3 px-1 text-xs uppercase tracking-[0.14em] text-white/25">{title}</p><div className="overflow-hidden rounded-xl border border-white/6 bg-white/[0.025]">{children}</div></section>;
}

function SettingsRow({ label, sub, right, border = true }: { label: string; sub?: string; right: React.ReactNode; border?: boolean }) {
  return <div className={`flex flex-wrap items-start gap-3 px-4 py-4 ${border ? "border-b border-white/5" : ""}`}><div className="min-w-0 flex-1"><p className="text-sm text-white/80">{label}</p>{sub && <p className="mt-0.5 text-xs leading-5 text-white/30">{sub}</p>}</div><div className="shrink-0">{right}</div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`} /></button>;
}

function SettingsSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <Dropdown aria-label={label} value={value} onChange={onChange} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} className="w-36 max-w-[calc(100vw-3rem)] min-w-0" />;
}

function RangeControl({ label, min, max, step = 1, value, suffix, onChange }: { label: string; min: number; max: number; step?: number; value: number; suffix: string; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(value);
  // The remote value can change after an optimistic save or rollback.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDraft(value); }, [value]);
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));
  const commit = () => {
    const next = clamp(draft);
    setDraft(next);
    if (next !== value) onChange(next);
  };
  return <div className="flex items-center gap-2"><input aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(Number(event.target.value))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} className="w-12 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-right text-xs text-white/70 outline-none focus:border-violet-400 sm:w-14" /><span className="w-5 text-xs text-white/40">{suffix}</span><input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(Number(event.target.value))} onPointerUp={commit} onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) commit(); }} className="w-20 accent-violet-400 sm:w-28" /></div>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const palette = ["#ffffff", "#d7dbe8", "#9ca3af", "#000000", "#ef4444", "#f59e0b", "#eab308", "#22c55e", "#14b8a6", "#38bdf8", "#818cf8", "#c084fc"];

  useEffect(() => {
    if (!open) return;
    const closeWhenOutside = (event: MouseEvent) => {
      if (!controlRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const setColor = (next: string) => {
    if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
  };

  return <div ref={controlRef} className="relative shrink-0"><span id={labelId} className="sr-only">{label}</span><button type="button" aria-labelledby={labelId} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-8 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5 shadow-sm transition hover:border-violet-300/60 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-400/70"><span aria-hidden="true" className="h-full w-full rounded-[4px] ring-1 ring-inset ring-black/25" style={{ backgroundColor: value }} /></button>{open && <div role="dialog" aria-labelledby={labelId} className="absolute right-0 top-full z-30 mt-2 w-52 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-black/25 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"><div className="mb-3 flex items-center gap-2 rounded-lg border border-white/8 bg-black/20 p-2"><span aria-hidden="true" className="h-7 w-7 shrink-0 rounded-md ring-1 ring-inset ring-white/10" style={{ backgroundColor: value }} /><input aria-labelledby={labelId} value={value.toUpperCase()} onChange={(event) => setColor(event.target.value)} spellCheck={false} maxLength={7} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase tracking-wide text-white/80 outline-none placeholder:text-white/25" /></div><div className="grid grid-cols-6 gap-2">{palette.map((color) => <button key={color} type="button" aria-label={color} aria-pressed={value.toLowerCase() === color} onClick={() => setColor(color)} className={`h-5 rounded-md ring-1 ring-inset transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-400 ${value.toLowerCase() === color ? "ring-white ring-offset-2 ring-offset-black" : "ring-white/15"}`} style={{ backgroundColor: color }} />)}</div></div>}</div>;
}

function hexToRgba(hex: string, opacity: number) {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}

function Avatar({ userId }: { userId: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8 ring-1 ring-white/12">{failed ? <User className="h-5 w-5 text-white/60" /> : <img src={userImageUrl(userId)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />}</div>;
}
