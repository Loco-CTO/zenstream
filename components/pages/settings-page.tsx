"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, LogOut } from "lucide-react";
import { useI18n, type Locale } from "@/lib/i18n";
import { Dropdown } from "@/components/ui/dropdown";
import { AvatarEditModal } from "@/components/account/avatar-edit-modal";
import { ChangePasswordModal } from "@/components/account/change-password-modal";
import { ClearWatchHistoryModal } from "@/components/account/clear-watch-history-modal";
import { UserAvatar } from "@/components/account/user-avatar";
import { useSubtitlePreferences } from "@/components/subtitle-preferences-provider";
import { usePlaybackBehaviorPreferences } from "@/components/playback-behavior-preferences-provider";
import {
	SUBTITLE_FONT_STACKS,
	subtitleOuterShadow,
} from "@/lib/subtitle-preferences";
import { fetchOrchestratorVersion, zenstreamVersion } from "@/lib/version";
import type { AuthSession } from "@/lib/session";
import type {
	MetadataLanguagePreference,
	PlaybackPreference,
} from "@/lib/preferences";

type SettingsPageProps = {
	displayName: string;
	userId: string;
	session?: AuthSession;
	avatarVersion?: string | null;
	onAvatarVersionChange?: (avatarVersion: string | null) => void;
	locale: Locale;
	onLocaleChange: (locale: Locale) => Promise<void>;
	metadataLanguages?: string[];
	metadataLanguage?: MetadataLanguagePreference;
	onMetadataLanguageChange?: (language: string | null) => Promise<void>;
	playbackPreference?: PlaybackPreference;
	onPlaybackPreferenceChange?: (
		field: "audioLanguage" | "subtitleLanguage",
		value: string | null,
	) => Promise<void>;
	onPlaybackPreferenceLoad?: () => void;
	watchHistoryEnabled?: boolean;
	onWatchHistoryChange?: (enabled: boolean) => Promise<void>;
	onClearWatchHistory?: () => Promise<void>;
	onPasswordChanged?: () => void;
	onLogout: () => void;
};

type SettingsSectionName =
	| "root"
	| "account"
	| "appearance"
	| "playback"
	| "subtitles"
	| "privacy"
	| "versions";

export function SettingsPage({
	displayName,
	userId,
	session,
	avatarVersion = null,
	onAvatarVersionChange = () => undefined,
	locale,
	onLocaleChange,
	metadataLanguages = ["en"],
	metadataLanguage = { mode: "auto", language: "en" },
	onMetadataLanguageChange = async () => undefined,
	playbackPreference = {
		audioLanguage: null,
		subtitleLanguage: null,
		audioLanguages: [],
		subtitleLanguages: [],
	},
	onPlaybackPreferenceChange = async () => undefined,
	onPlaybackPreferenceLoad = () => undefined,
	watchHistoryEnabled = true,
	onWatchHistoryChange = async () => undefined,
	onClearWatchHistory = async () => undefined,
	onPasswordChanged = () => undefined,
	onLogout,
}: SettingsPageProps) {
	const router = useRouter();
	const { t } = useI18n();
	const {
		style,
		update: updateSubtitleStyle,
		error: subtitleError,
	} = useSubtitlePreferences();
	const {
		autoplayNextEpisode,
		autoplayBrowse,
		setAutoplayNextEpisode,
		setAutoplayBrowse,
	} = usePlaybackBehaviorPreferences();
	const [localeError, setLocaleError] = useState(false);
	const [metadataLanguageError, setMetadataLanguageError] = useState(false);
	const [watchHistoryError, setWatchHistoryError] = useState(false);
	const [subtitlePreview, setSubtitlePreview] = useState(false);
	const [section, setSection] = useState<SettingsSectionName>("root");
	const [avatarModalOpen, setAvatarModalOpen] = useState(false);
	const [passwordModalOpen, setPasswordModalOpen] = useState(false);
	const [clearHistoryModalOpen, setClearHistoryModalOpen] = useState(false);
	const [orchestratorVersion, setOrchestratorVersion] = useState<string | null>(
		null,
	);
	const playbackPreferenceRef = useRef(playbackPreference);

	useEffect(() => {
		playbackPreferenceRef.current = playbackPreference;
	}, [playbackPreference]);

	useEffect(() => {
		void fetchOrchestratorVersion().then(setOrchestratorVersion);
	}, []);

	const changeLocale = async (nextLocale: Locale) => {
		setLocaleError(false);
		try {
			await onLocaleChange(nextLocale);
		} catch {
			setLocaleError(true);
		}
	};

	const changeMetadataLanguage = async (value: string) => {
		setMetadataLanguageError(false);
		try {
			await onMetadataLanguageChange(value === "auto" ? null : value);
		} catch {
			setMetadataLanguageError(true);
		}
	};

	const changePlaybackPreference = async (
		field: "audioLanguage" | "subtitleLanguage",
		value: string,
	) => {
		const nextValue =
			value === "auto"
				? null
				: value === "off" && field === "subtitleLanguage"
					? "off"
					: value;
		playbackPreferenceRef.current = {
			...playbackPreferenceRef.current,
			[field]: nextValue,
		};
		try {
			await onPlaybackPreferenceChange(field, nextValue);
		} catch {
			// The parent restores the last confirmed value and can surface its own error.
		}
	};

	const changeWatchHistory = async (enabled: boolean) => {
		setWatchHistoryError(false);
		try {
			await onWatchHistoryChange(enabled);
		} catch {
			setWatchHistoryError(true);
		}
	};

	const openSection = (nextSection: Exclude<SettingsSectionName, "root">) => {
		setSection(nextSection);
		if (nextSection === "playback") onPlaybackPreferenceLoad();
	};

	const goBack = () => {
		if (section !== "root") {
			setSection("root");
			return;
		}
		if (window.history.length > 1) {
			router.back();
			return;
		}
		router.push("/");
	};

	const avatarSession =
		session ??
		({ token: "", userId, username: displayName } satisfies AuthSession);

	return (
		<>
			<main className="min-h-screen bg-background pb-12 text-foreground">
				<header className="sticky top-0 z-40 flex items-center gap-3 border-b border-white/5 bg-[var(--c-nav-from)] px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-xl sm:gap-4 sm:px-6 md:px-14 md:py-4">
					<button
						type="button"
						onClick={goBack}
						aria-label={t("back")}
						className="flex h-8 w-8 items-center justify-center rounded-full text-white/40 transition hover:bg-white/8 hover:text-white"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<h1 className="text-lg font-bold tracking-tight text-white">
						{section === "root"
							? t("settings")
							: section === "account"
								? t("account")
								: section === "appearance"
									? t("appearance")
									: section === "playback"
										? t("playback")
										: section === "subtitles"
											? t("subtitles")
											: section === "privacy"
												? t("privacyData")
												: t("versions")}
					</h1>
				</header>

				<div className="space-y-7 px-4 py-6 sm:px-6 sm:py-8 md:px-14">
					{section === "root" && (
						<SettingsIndex
							displayName={displayName}
							userId={userId}
							avatarVersion={avatarVersion}
							onOpenSection={openSection}
							onLogout={onLogout}
						/>
					)}

					{section === "account" && (
						<SettingsSection title={t("account")}>
							<div className="flex items-center gap-4 border-b border-white/5 px-4 py-4">
								<UserAvatar
									displayName={displayName}
									userId={userId}
									avatarVersion={avatarVersion}
								/>
								<p className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
									{displayName}
								</p>
								<button
									type="button"
									onClick={() => setAvatarModalOpen(true)}
									className="text-xs font-medium text-violet-400 transition hover:text-violet-300"
								>
									{t("edit")}
								</button>
							</div>
							<SettingsRow
								label={t("changePassword")}
								border={false}
								onClick={() => setPasswordModalOpen(true)}
								right={<ChevronRight className="h-4 w-4 text-white/20" />}
							/>
						</SettingsSection>
					)}

					{section === "appearance" && (
						<SettingsSection title={t("appearance")}>
							<SettingsRow
								label={t("language")}
								sub={t("languageDescription")}
								border={false}
								right={
									<Dropdown
										aria-label={t("language")}
										value={locale}
										onChange={(value) => void changeLocale(value as Locale)}
										options={[
											{ value: "en", label: t("english") },
											{ value: "ja", label: t("japanese") },
										]}
									/>
								}
							/>
							{localeError && (
								<p
									role="alert"
									className="border-t border-white/5 px-4 py-3 text-xs text-red-300"
								>
									{t("localeSaveFailed")}
								</p>
							)}
							<SettingsRow
								label={t("preferredMetadataLanguage")}
								sub={t("preferredMetadataLanguageDescription")}
								border={false}
								right={
									<Dropdown
										aria-label={t("preferredMetadataLanguage")}
										value={
											metadataLanguage.mode === "auto" ? "auto" : metadataLanguage.language
										}
										onChange={(value) => void changeMetadataLanguage(value)}
										options={[
											{ value: "auto", label: t("metadataLanguageAutomatic") },
											...metadataLanguages.map((value) => ({
												value,
												label:
													new Intl.DisplayNames([locale], { type: "language" }).of(value) ??
													value,
											})),
										]}
									/>
								}
							/>
							{metadataLanguageError && (
								<p
									role="alert"
									className="border-t border-white/5 px-4 py-3 text-xs text-red-300"
								>
									{t("metadataLanguageSaveFailed")}
								</p>
							)}
						</SettingsSection>
					)}

					{section === "playback" && (
						<SettingsSection title={t("playback")}>
							<SettingsRow
								label={t("audioLanguage")}
								right={
									<SettingsSelect
										label={t("audioLanguage")}
										value={playbackPreference.audioLanguage ?? "auto"}
										options={[
											["auto", t("languageAutomatic")],
											...playbackPreference.audioLanguages.map(
												(option) => [option.value, option.label] as [string, string],
											),
										]}
										onChange={(value) =>
											void changePlaybackPreference("audioLanguage", value)
										}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleLanguage")}
								right={
									<SettingsSelect
										label={t("subtitleLanguage")}
										value={playbackPreference.subtitleLanguage ?? "auto"}
										options={[
											["auto", t("languageAutomatic")],
											...playbackPreference.subtitleLanguages.map(
												(option) => [option.value, option.label] as [string, string],
											),
											["off", t("off")],
										]}
										onChange={(value) =>
											void changePlaybackPreference("subtitleLanguage", value)
										}
									/>
								}
							/>
							<SettingsRow
								label={t("autoplayNextEpisode")}
								right={
									<Toggle
										label={t("autoplayNextEpisode")}
										checked={autoplayNextEpisode}
										onChange={setAutoplayNextEpisode}
									/>
								}
							/>
							<SettingsRow
								label={t("autoplayBrowse")}
								sub={t("autoplayBrowseDescription")}
								border={false}
								right={
									<Toggle
										label={t("autoplayBrowse")}
										checked={autoplayBrowse}
										onChange={setAutoplayBrowse}
									/>
								}
							/>
						</SettingsSection>
					)}

					{section === "subtitles" && (
						<SettingsSection title={t("subtitles")}>
							<SettingsRow
								label={t("subtitleRenderer")}
								right={
									<SettingsSelect
										label={t("subtitleRenderer")}
										value={style.renderer}
										options={[
											["native", t("subtitleRendererNative")],
											["overlay", t("subtitleRendererOverlay")],
										]}
										onChange={(value) =>
											void updateSubtitleStyle({
												renderer: value as typeof style.renderer,
											})
										}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleFont")}
								right={
									<SettingsSelect
										label={t("subtitleFont")}
										value={style.fontFamily}
										options={[
											["sans", "Noto Sans"],
											["serif", "Serif"],
											["mono", "Monospace"],
										]}
										onChange={(value) =>
											void updateSubtitleStyle({
												fontFamily: value as typeof style.fontFamily,
											})
										}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleBold")}
								right={
									<Toggle
										label={t("subtitleBold")}
										checked={style.bold}
										onChange={(value) => void updateSubtitleStyle({ bold: value })}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitlePreview")}
								border={false}
								right={
									<Toggle
										label={t("subtitlePreview")}
										checked={subtitlePreview}
										onChange={setSubtitlePreview}
									/>
								}
							/>
							{subtitlePreview && (
								<div className="border-t border-white/5 bg-black/30 px-4 py-8 text-center">
									<span
										className="inline-block max-w-full"
										style={{
											color: style.fontColor,
											backgroundColor: hexToRgba(
												style.backgroundColor,
												style.backgroundOpacity,
											),
											fontFamily: SUBTITLE_FONT_STACKS[style.fontFamily],
											fontSize: `clamp(16px, ${style.textScale / 20}vh, 72px)`,
											fontWeight: style.bold ? 700 : 400,
											lineHeight: 1.15,
											padding: style.backgroundOpacity ? "0.08em 0.2em" : undefined,
											textShadow: subtitleOuterShadow(style.borderSize, style.borderColor),
										}}
									>
										{t("subtitlePreviewText")}
									</span>
								</div>
							)}
							<SettingsRow
								label={t("subtitleTextSize")}
								right={
									<RangeControl
										label={t("subtitleTextSize")}
										min={50}
										max={200}
										value={style.textScale}
										suffix="%"
										onChange={(value) => void updateSubtitleStyle({ textScale: value })}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleFontColor")}
								right={
									<ColorControl
										label={t("subtitleFontColor")}
										value={style.fontColor}
										onChange={(value) => void updateSubtitleStyle({ fontColor: value })}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleBorderSize")}
								right={
									<RangeControl
										label={t("subtitleBorderSize")}
										min={0}
										max={8}
										step={1}
										value={style.borderSize}
										suffix="px"
										onChange={(value) => void updateSubtitleStyle({ borderSize: value })}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleBorderColor")}
								right={
									<ColorControl
										label={t("subtitleBorderColor")}
										value={style.borderColor}
										onChange={(value) => void updateSubtitleStyle({ borderColor: value })}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleBackgroundColor")}
								right={
									<ColorControl
										label={t("subtitleBackgroundColor")}
										value={style.backgroundColor}
										onChange={(value) =>
											void updateSubtitleStyle({ backgroundColor: value })
										}
									/>
								}
							/>
							<SettingsRow
								label={t("subtitleBackgroundOpacity")}
								right={
									<RangeControl
										label={t("subtitleBackgroundOpacity")}
										min={0}
										max={100}
										value={style.backgroundOpacity}
										suffix="%"
										onChange={(value) =>
											void updateSubtitleStyle({ backgroundOpacity: value })
										}
									/>
								}
							/>
							{subtitleError && (
								<p
									role="alert"
									className="border-t border-white/5 px-4 py-3 text-xs text-red-300"
								>
									{t("subtitleSaveFailed")}
								</p>
							)}
						</SettingsSection>
					)}

					{section === "privacy" && (
						<SettingsSection title={t("privacyData")}>
							<SettingsRow
								label={t("watchHistory")}
								sub={t("watchHistoryDescription")}
								right={
									<Toggle
										label={t("watchHistory")}
										checked={watchHistoryEnabled}
										onChange={(value) => void changeWatchHistory(value)}
									/>
								}
							/>
							{watchHistoryError && (
								<p
									role="alert"
									className="border-b border-white/5 px-4 pb-3 text-xs text-red-300"
								>
									{t("watchHistorySaveFailed")}
								</p>
							)}
							<SettingsRow
								label={t("clearWatchHistory")}
								border={false}
								right={
									<button
										type="button"
										onClick={() => setClearHistoryModalOpen(true)}
										className="text-xs font-medium text-red-400/70 transition hover:text-red-400"
									>
										{t("clear")}
									</button>
								}
							/>
						</SettingsSection>
					)}

					{section === "versions" && (
						<SettingsSection title={t("versions")}>
							<SettingsRow
								label={t("zenstreamVersion")}
								right={
									<span className="text-xs text-white/45">{zenstreamVersion}</span>
								}
							/>
							<SettingsRow
								label={t("orchestratorVersion")}
								border={false}
								right={
									<span className="text-xs text-white/45">
										{orchestratorVersion ?? t("versionUnavailable")}
									</span>
								}
							/>
						</SettingsSection>
					)}
				</div>
			</main>
			{avatarModalOpen && (
				<AvatarEditModal
					session={avatarSession}
					displayName={displayName}
					userId={userId}
					avatarVersion={avatarVersion}
					onClose={() => setAvatarModalOpen(false)}
					onSaved={(nextAvatarVersion) => {
						onAvatarVersionChange(nextAvatarVersion);
						setAvatarModalOpen(false);
					}}
				/>
			)}
			{passwordModalOpen && (
				<ChangePasswordModal
					session={avatarSession}
					onClose={() => setPasswordModalOpen(false)}
					onContinueToLogin={onPasswordChanged}
				/>
			)}
			{clearHistoryModalOpen && (
				<ClearWatchHistoryModal
					onClose={() => setClearHistoryModalOpen(false)}
					onConfirm={onClearWatchHistory}
				/>
			)}
		</>
	);
}

function SettingsSection({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section aria-label={title}>
			<p className="mb-3 px-1 text-xs uppercase tracking-[0.14em] text-white/25">
				{title}
			</p>
			<div className="overflow-visible rounded-xl border border-white/6 bg-white/[0.025]">
				{children}
			</div>
		</section>
	);
}

function SettingsIndex({
	displayName,
	userId,
	avatarVersion,
	onOpenSection,
	onLogout,
}: {
	displayName: string;
	userId: string;
	avatarVersion?: string | null;
	onOpenSection: (section: Exclude<SettingsSectionName, "root">) => void;
	onLogout: () => void;
}) {
	const { t } = useI18n();

	return (
		<div className="space-y-4">
			<nav
				aria-label={t("settings")}
				className="overflow-hidden rounded-xl border border-white/6 bg-white/[0.025]"
			>
				<SettingsMenuItem
					label={t("account")}
					sub={displayName}
					leading={
						<UserAvatar
							displayName={displayName}
							userId={userId}
							avatarVersion={avatarVersion}
						/>
					}
					onClick={() => onOpenSection("account")}
				/>
				<SettingsMenuItem
					label={t("appearance")}
					onClick={() => onOpenSection("appearance")}
				/>
				<SettingsMenuItem
					label={t("playback")}
					onClick={() => onOpenSection("playback")}
				/>
				<SettingsMenuItem
					label={t("subtitles")}
					onClick={() => onOpenSection("subtitles")}
				/>
				<SettingsMenuItem
					label={t("privacyData")}
					onClick={() => onOpenSection("privacy")}
				/>
				<SettingsMenuItem
					label={t("versions")}
					border={false}
					onClick={() => onOpenSection("versions")}
				/>
			</nav>
			<button
				type="button"
				onClick={onLogout}
				className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-400/[0.04] px-4 py-3 text-sm font-medium text-red-300 transition hover:bg-red-400/[0.1] hover:text-red-200"
			>
				<LogOut className="h-4 w-4" />
				{t("logout")}
			</button>
		</div>
	);
}

function SettingsMenuItem({
	label,
	sub,
	leading,
	border = true,
	onClick,
}: {
	label: string;
	sub?: string;
	leading?: React.ReactNode;
	border?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] ${border ? "border-b border-white/5" : ""}`}
		>
			{leading}
			<div className="min-w-0 flex-1">
				<p className="text-sm font-medium text-white/85">{label}</p>
				{sub && <p className="mt-0.5 truncate text-xs text-white/35">{sub}</p>}
			</div>
			<ChevronRight className="h-4 w-4 shrink-0 text-white/25" />
		</button>
	);
}

function SettingsRow({
	label,
	sub,
	right,
	border = true,
	onClick,
}: {
	label: string;
	sub?: string;
	right: React.ReactNode;
	border?: boolean;
	onClick?: () => void;
}) {
	const content = (
		<>
			<div className="min-w-0 flex-1">
				<p className="text-sm text-white/80">{label}</p>
				{sub && <p className="mt-0.5 text-xs leading-5 text-white/30">{sub}</p>}
			</div>
			<div className="shrink-0">{right}</div>
		</>
	);
	const className = `flex w-full flex-wrap items-start gap-3 px-4 py-4 text-left ${border ? "border-b border-white/5" : ""}`;

	return onClick ? (
		<button
			type="button"
			onClick={onClick}
			className={`${className} transition hover:bg-white/[0.04]`}
		>
			{content}
		</button>
	) : (
		<div className={className}>{content}</div>
	);
}

function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-label={label}
			aria-checked={checked}
			onClick={() => onChange(!checked)}
			className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-violet-500" : "bg-white/10"}`}
		>
			<span
				className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`}
			/>
		</button>
	);
}

function SettingsSelect({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: Array<[string, string]>;
	onChange: (value: string) => void;
}) {
	return (
		<Dropdown
			aria-label={label}
			value={value}
			onChange={onChange}
			options={options.map(([optionValue, optionLabel]) => ({
				value: optionValue,
				label: optionLabel,
			}))}
			className="w-36 max-w-[calc(100vw-3rem)] min-w-0"
		/>
	);
}

function RangeControl({
	label,
	min,
	max,
	step = 1,
	value,
	suffix,
	onChange,
}: {
	label: string;
	min: number;
	max: number;
	step?: number;
	value: number;
	suffix: string;
	onChange: (value: number) => void;
}) {
	const [draft, setDraft] = useState(value);
	// The remote value can change after an optimistic save or rollback.
	useEffect(() => {
		setDraft(value);
	}, [value]);
	const clamp = (next: number) =>
		Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));
	const commit = () => {
		const next = clamp(draft);
		setDraft(next);
		if (next !== value) onChange(next);
	};
	return (
		<div className="flex items-center gap-2">
			<input
				aria-label={label}
				type="number"
				min={min}
				max={max}
				step={step}
				value={draft}
				onChange={(event) => setDraft(Number(event.target.value))}
				onBlur={commit}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						commit();
						event.currentTarget.blur();
					}
				}}
				className="w-12 rounded border border-white/10 bg-white/5 px-1.5 py-1 text-right text-xs text-white/70 outline-none focus:border-violet-400 sm:w-14"
			/>
			<span className="w-5 text-xs text-white/40">{suffix}</span>
			<input
				aria-label={`${label} slider`}
				type="range"
				min={min}
				max={max}
				step={step}
				value={draft}
				onChange={(event) => setDraft(Number(event.target.value))}
				onPointerUp={commit}
				onKeyUp={(event) => {
					if (
						["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(
							event.key,
						)
					)
						commit();
				}}
				className="w-20 accent-violet-400 sm:w-28"
			/>
		</div>
	);
}

function ColorControl({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<ColorPickerPosition>("below");
	const controlRef = useRef<HTMLDivElement>(null);
	const squareRef = useRef<HTMLDivElement>(null);
	const hueRef = useRef<HTMLDivElement>(null);
	const labelId = useId();
	const [draftHsv, setDraftHsv] = useState(() => hexToHsv(value));
	const draftHsvRef = useRef(draftHsv);
	const lastHueRef = useRef(draftHsv.h);
	const activePickerRef = useRef<"square" | "hue" | null>(null);
	const [hexDraft, setHexDraft] = useState(() => value.toUpperCase());
	const [copied, setCopied] = useState(false);
	const vividColor = hsvToHex({ h: draftHsv.h, s: 1, v: 1 });

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

	const updateDraftHsv = (next: Hsv) => {
		const color = hsvToHex(next);
		draftHsvRef.current = next;
		lastHueRef.current = next.h;
		setDraftHsv(next);
		setHexDraft(color.toUpperCase());
	};

	const commitDraftColor = (next = draftHsvRef.current) =>
		onChange(hsvToHex(next));

	const updateSquare = (event: React.PointerEvent<HTMLDivElement>) => {
		const rect = squareRef.current?.getBoundingClientRect();
		if (!rect) return;
		const current = draftHsvRef.current;
		updateDraftHsv({
			h: current.h,
			s: clamp((event.clientX - rect.left) / rect.width),
			v: 1 - clamp((event.clientY - rect.top) / rect.height),
		});
	};

	const updateHue = (event: React.PointerEvent<HTMLDivElement>) => {
		const rect = hueRef.current?.getBoundingClientRect();
		if (!rect) return;
		const current = draftHsvRef.current;
		updateDraftHsv({
			h: clamp((event.clientX - rect.left) / rect.width) * 360,
			s: current.s,
			v: current.v,
		});
	};

	const startDrag = (
		picker: "square" | "hue",
		event: React.PointerEvent<HTMLDivElement>,
		update: (event: React.PointerEvent<HTMLDivElement>) => void,
	) => {
		event.preventDefault();
		activePickerRef.current = picker;
		event.currentTarget.setPointerCapture(event.pointerId);
		update(event);
	};

	const finishDrag = (picker: "square" | "hue") => {
		if (activePickerRef.current !== picker) return;
		activePickerRef.current = null;
		commitDraftColor();
	};

	const openPicker = () => {
		const rect = controlRef.current?.getBoundingClientRect();
		if (!rect) return;
		const below = window.innerHeight - rect.bottom;
		const above = rect.top;
		setPosition(
			below >= COLOR_PICKER_HEIGHT
				? "below"
				: above >= COLOR_PICKER_HEIGHT
					? "above"
					: "center",
		);
	};

	return (
		<div ref={controlRef} className="relative shrink-0">
			<span id={labelId} className="sr-only">
				{label}
			</span>
			<button
				type="button"
				aria-labelledby={labelId}
				aria-haspopup="dialog"
				aria-expanded={open}
				onClick={() => {
					if (open) {
						setOpen(false);
					} else {
						const fromValue = hexToHsv(value);
						const next =
							fromValue.s > 0.02 ? fromValue : { ...fromValue, h: lastHueRef.current };
						draftHsvRef.current = next;
						lastHueRef.current = next.h;
						setDraftHsv(next);
						setHexDraft(value.toUpperCase());
						openPicker();
						setOpen(true);
					}
				}}
				className="flex h-8 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] p-1.5 shadow-sm transition hover:border-violet-300/60 hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-400/70"
			>
				<span
					aria-hidden="true"
					className="h-full w-full rounded-[4px] ring-1 ring-inset ring-black/25"
					style={{ backgroundColor: value }}
				/>
			</button>
			{open && (
				<div
					role="dialog"
					aria-labelledby={labelId}
					className={`z-30 w-64 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-black/35 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl ${
						position === "center"
							? "fixed inset-x-3 top-1/2 max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto"
							: position === "above"
								? "absolute bottom-full right-0 mb-2"
								: "absolute right-0 top-full mt-2"
					}`}
				>
					<div className="mb-3 flex items-center gap-2 border-b border-white/[0.075] pb-2">
						<span
							aria-hidden="true"
							className="h-8 w-8 shrink-0 rounded-md border border-white/15"
							style={{ backgroundColor: value }}
						/>
						<div className="min-w-0">
							<p className="font-mono text-sm font-semibold text-white/90">
								{value.toUpperCase()}
							</p>
						</div>
					</div>
					<div
						ref={squareRef}
						className="relative mb-3 h-24 cursor-crosshair touch-none overflow-hidden rounded-lg"
						style={{
							background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${vividColor})`,
						}}
						onPointerDown={(event) => {
							startDrag("square", event, updateSquare);
						}}
						onPointerMove={(event) => {
							if (activePickerRef.current === "square") updateSquare(event);
						}}
						onPointerUp={() => finishDrag("square")}
						onPointerCancel={() => {
							activePickerRef.current = null;
						}}
					>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
							style={{
								left: `${draftHsv.s * 100}%`,
								top: `${(1 - draftHsv.v) * 100}%`,
							}}
						/>
					</div>
					<div
						ref={hueRef}
						className="relative mb-3 h-3 cursor-pointer touch-none rounded-full"
						style={{
							background:
								"linear-gradient(to right, #ff3b30, #ffcc00, #34c759, #00c7be, #007aff, #af52de, #ff2d55, #ff3b30)",
						}}
						onPointerDown={(event) => {
							startDrag("hue", event, updateHue);
						}}
						onPointerMove={(event) => {
							if (activePickerRef.current === "hue") updateHue(event);
						}}
						onPointerUp={() => finishDrag("hue")}
						onPointerCancel={() => {
							activePickerRef.current = null;
						}}
					>
						<span
							aria-hidden="true"
							className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
							style={{
								left: `${(draftHsv.h / 360) * 100}%`,
								backgroundColor: value,
							}}
						/>
					</div>
					<div className="flex items-center gap-2">
						<input
							aria-label={`${label} hex`}
							value={hexDraft}
							onBlur={() => {
								if (hexToRgb(hexDraft)) commitDraftColor();
								else setHexDraft(value.toUpperCase());
							}}
							onChange={(event) => {
								setHexDraft(event.target.value.toUpperCase());
								const parsed = hexToRgb(event.target.value);
								if (parsed) {
									updateDraftHsv(
										preserveHueForNeutral(rgbToHsv(parsed), draftHsvRef.current.h),
									);
								}
							}}
							onKeyDown={(event) => {
								if (event.key !== "Enter") return;
								event.currentTarget.blur();
							}}
							spellCheck={false}
							maxLength={7}
							className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 font-mono text-sm uppercase tracking-wide text-white/80 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/30"
						/>
						<button
							type="button"
							aria-label="Copy color"
							title={copied ? "Copied" : "Copy color"}
							onClick={async () => {
								await navigator.clipboard?.writeText(value.toUpperCase());
								setCopied(true);
								window.setTimeout(() => setCopied(false), 900);
							}}
							className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 text-white/55 transition hover:border-white/25 hover:bg-white/[0.055] hover:text-white focus:outline-none focus:ring-2 focus:ring-violet-400/70"
						>
							<Copy className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

type Hsv = { h: number; s: number; v: number };
type Rgb = { r: number; g: number; b: number };
type ColorPickerPosition = "above" | "below" | "center";

const COLOR_PICKER_HEIGHT = 240;

function clamp(value: number) {
	return Math.min(1, Math.max(0, value));
}

function hexToRgb(value: string): Rgb | null {
	const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
	if (!match) return null;
	const hex = match[1];
	return {
		r: Number.parseInt(hex.slice(0, 2), 16),
		g: Number.parseInt(hex.slice(2, 4), 16),
		b: Number.parseInt(hex.slice(4, 6), 16),
	};
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
	const red = r / 255;
	const green = g / 255;
	const blue = b / 255;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	const delta = max - min;
	let h = 0;
	if (delta) {
		if (max === red) h = 60 * (((green - blue) / delta) % 6);
		else if (max === green) h = 60 * ((blue - red) / delta + 2);
		else h = 60 * ((red - green) / delta + 4);
	}
	return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
}

function hexToHsv(value: string): Hsv {
	return rgbToHsv(hexToRgb(value) ?? { r: 0, g: 0, b: 0 });
}

function preserveHueForNeutral(next: Hsv, currentHue: number): Hsv {
	return next.s > 0.02 ? next : { ...next, h: currentHue };
}

function hsvToHex({ h, s, v }: Hsv) {
	const chroma = v * s;
	const segment = (((h % 360) + 360) % 360) / 60;
	const offset = chroma * (1 - Math.abs((segment % 2) - 1));
	const [red, green, blue] =
		segment < 1
			? [chroma, offset, 0]
			: segment < 2
				? [offset, chroma, 0]
				: segment < 3
					? [0, chroma, offset]
					: segment < 4
						? [0, offset, chroma]
						: segment < 5
							? [offset, 0, chroma]
							: [chroma, 0, offset];
	const base = v - chroma;
	return `#${[red, green, blue]
		.map((component) =>
			Math.round((component + base) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

function hexToRgba(hex: string, opacity: number) {
	const value = hex.slice(1);
	const red = Number.parseInt(value.slice(0, 2), 16);
	const green = Number.parseInt(value.slice(2, 4), 16);
	const blue = Number.parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}
