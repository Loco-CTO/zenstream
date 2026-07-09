"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, User } from "lucide-react";
import { userImageUrl } from "@/lib/jellyfin";
import { useI18n, type Locale } from "@/lib/i18n";
import { Dropdown } from "@/components/ui/dropdown";

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
      <header className="sticky top-0 z-40 flex items-center gap-4 border-b border-white/5 bg-[var(--c-nav-from)] px-6 py-4 backdrop-blur-xl md:px-14">
        <button type="button" onClick={goBack} aria-label={t("back")} className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-white">{t("settings")}</h1>
      </header>

      <div className="space-y-8 px-6 py-8 md:px-14">
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
  return <div className={`flex items-center gap-4 px-4 py-3.5 ${border ? "border-b border-white/5" : ""}`}><div className="min-w-0 flex-1"><p className="text-sm text-white/80">{label}</p>{sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}</div>{right}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-violet-500" : "bg-white/10"}`}><span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`} /></button>;
}

function SettingsSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <Dropdown aria-label={label} value={value} onChange={onChange} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} />;
}

function Avatar({ userId }: { userId: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8 ring-1 ring-white/12">{failed ? <User className="h-5 w-5 text-white/60" /> : <img src={userImageUrl(userId)} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />}</div>;
}
