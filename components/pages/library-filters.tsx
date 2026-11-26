"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Funnel, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { CatalogFilterOptions, CatalogFilters } from "@/lib/media-api";

type LibraryFiltersProps = {
	options: CatalogFilterOptions;
	value: CatalogFilters;
	isMusicLibrary: boolean;
	onApply: (filters: CatalogFilters) => void;
	disabled?: boolean;
};

export function LibraryFilters({
	options,
	value,
	isMusicLibrary,
	onApply,
	disabled = false,
}: LibraryFiltersProps) {
	const { t } = useI18n();
	const panelId = useId();
	const rootRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<CatalogFilters>(value);
	const [genreSearch, setGenreSearch] = useState("");
	const [ratingSearch, setRatingSearch] = useState("");
	const activeCount =
		value.genres.length +
		value.officialRatings.length +
		(value.yearFrom !== null || value.yearTo !== null ? 1 : 0) +
		(value.watchState ? 1 : 0) +
		(value.favoritesOnly ? 1 : 0) +
		value.artists.length +
		value.albumArtists.length +
		value.albumTypes.length;
	const normalizedGenreSearch = genreSearch.trim().toLocaleLowerCase();
	const normalizedRatingSearch = ratingSearch.trim().toLocaleLowerCase();
	const filteredGenres = options.genres.filter((genre) =>
		genre.toLocaleLowerCase().includes(normalizedGenreSearch),
	);
	const filteredRatings = options.officialRatings.filter((rating) =>
		rating.toLocaleLowerCase().includes(normalizedRatingSearch),
	);

	useEffect(() => {
		if (!open) return;
		const closeOnOutsidePointer = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsidePointer);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [open]);

	function toggleFilter(
		field:
			"genres" | "officialRatings" | "artists" | "albumArtists" | "albumTypes",
		option: string,
	) {
		setDraft((current) => {
			const selected = current[field];
			return {
				...current,
				[field]: selected.includes(option)
					? selected.filter((value) => value !== option)
					: [...selected, option],
			};
		});
	}

	function apply(next: CatalogFilters) {
		const yearFrom = next.yearFrom;
		const yearTo = next.yearTo;
		onApply({
			genres: [...next.genres].sort((left, right) => left.localeCompare(right)),
			officialRatings: [...next.officialRatings].sort((left, right) =>
				left.localeCompare(right),
			),
			yearFrom:
				yearFrom !== null && yearTo !== null
					? Math.min(yearFrom, yearTo)
					: yearFrom,
			yearTo:
				yearFrom !== null && yearTo !== null ? Math.max(yearFrom, yearTo) : yearTo,
			watchState: next.watchState,
			favoritesOnly: next.favoritesOnly,
			artists: [...next.artists].sort((left, right) => left.localeCompare(right)),
			albumArtists: [...next.albumArtists].sort((left, right) =>
				left.localeCompare(right),
			),
			albumTypes: [...next.albumTypes].sort((left, right) =>
				left.localeCompare(right),
			),
		});
		setOpen(false);
	}

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-label={t("libraryFilters")}
				aria-expanded={open}
				aria-controls={panelId}
				disabled={disabled}
				onClick={() => {
					if (!open) {
						setDraft({
							genres: [...value.genres],
							officialRatings: [...value.officialRatings],
							yearFrom: value.yearFrom,
							yearTo: value.yearTo,
							watchState: value.watchState,
							favoritesOnly: value.favoritesOnly,
							artists: [...value.artists],
							albumArtists: [...value.albumArtists],
							albumTypes: [...value.albumTypes],
						});
						setGenreSearch("");
						setRatingSearch("");
					}
					setOpen((current) => !current);
				}}
				className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-40 ${
					open || activeCount > 0
						? "border-white/20 bg-white/[.08] text-white"
						: "border-white/10 bg-white/[0.035] text-white/45 hover:border-white/20 hover:text-white"
				}`}
			>
				<Funnel aria-hidden="true" className="h-4 w-4" />
				{activeCount > 0 && (
					<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black">
						{activeCount}
					</span>
				)}
			</button>

			{open && (
				<div
					id={panelId}
					role="dialog"
					aria-label={t("libraryFilters")}
					className="absolute right-0 z-50 mt-2 max-h-[min(70vh,34rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-[var(--c-glass-border)] bg-black/25 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl"
				>
					<section>
						<div className="mb-2 flex items-center justify-between gap-3">
							<h2 className="text-xs font-semibold uppercase tracking-wider text-white/65">
								{t("filterGenre")}
							</h2>
							<span className="text-[10px] text-white/35">{draft.genres.length}</span>
						</div>
						<label className="mb-2 flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 focus-within:border-white/25">
							<Search
								aria-hidden="true"
								className="h-3.5 w-3.5 shrink-0 text-white/40"
							/>
							<input
								aria-label={t("filterSearchGenres")}
								value={genreSearch}
								onChange={(event) => setGenreSearch(event.target.value)}
								placeholder={t("filterSearchGenres")}
								className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
							/>
						</label>
						<div className="max-h-44 overflow-y-auto rounded-md">
							{filteredGenres.length > 0 ? (
								filteredGenres.map((genre) => (
									<FilterOption
										key={genre}
										label={genre}
										selected={draft.genres.includes(genre)}
										onChange={() => toggleFilter("genres", genre)}
									/>
								))
							) : (
								<p className="px-2 py-3 text-xs text-white/40">
									{options.genres.length === 0
										? t("filterNoGenres")
										: t("filterNoOptionsMatch")}
								</p>
							)}
						</div>
					</section>

					<section className="mt-4 border-t border-white/10 pt-3">
						<h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">
							{t("filterYearRange")}
						</h2>
						<div className="grid grid-cols-2 gap-2">
							<label className="flex flex-col gap-1 text-[10px] text-white/45">
								{t("filterYearFrom")}
								<input
									type="number"
									min={1800}
									max={2200}
									value={draft.yearFrom ?? ""}
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											yearFrom: event.target.value ? Number(event.target.value) : null,
										}))
									}
									className="h-9 w-full rounded-md border border-white/10 bg-white/[0.035] px-2 text-xs text-white outline-none focus:border-white/25"
								/>
							</label>
							<label className="flex flex-col gap-1 text-[10px] text-white/45">
								{t("filterYearTo")}
								<input
									type="number"
									min={1800}
									max={2200}
									value={draft.yearTo ?? ""}
									onChange={(event) =>
										setDraft((current) => ({
											...current,
											yearTo: event.target.value ? Number(event.target.value) : null,
										}))
									}
									className="h-9 w-full rounded-md border border-white/10 bg-white/[0.035] px-2 text-xs text-white outline-none focus:border-white/25"
								/>
							</label>
						</div>
					</section>

					{!isMusicLibrary && (
						<section className="mt-4 border-t border-white/10 pt-3">
							<h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/65">
								{t("filterWatchState")}
							</h2>
							<div className="flex flex-wrap gap-2">
								{(
									[
										{ value: null, label: t("filterAny") },
										{ value: "watched", label: t("filterWatched") },
										{ value: "unwatched", label: t("filterUnwatched") },
									] as const
								).map((option) => (
									<button
										key={option.label}
										type="button"
										aria-pressed={draft.watchState === option.value}
										onClick={() =>
											setDraft((current) => ({
												...current,
												watchState: option.value,
											}))
										}
										className={`rounded-full border px-3 py-1.5 text-[11px] transition ${
											draft.watchState === option.value
												? "border-white/25 bg-white/[.08] text-white"
												: "border-white/10 text-white/55 hover:text-white"
										}`}
									>
										{option.label}
									</button>
								))}
							</div>
						</section>
					)}

					<section className="mt-4 border-t border-white/10 pt-3">
						<FilterOption
							label={t("filterFavoritesOnly")}
							selected={draft.favoritesOnly}
							onChange={() =>
								setDraft((current) => ({
									...current,
									favoritesOnly: !current.favoritesOnly,
								}))
							}
						/>
					</section>

					<section
						hidden={
							isMusicLibrary ||
							(options.officialRatings.length === 0 &&
								draft.officialRatings.length === 0)
						}
						className="mt-4 border-t border-white/10 pt-3"
					>
						<div className="mb-2 flex items-center justify-between gap-3">
							<h2 className="text-xs font-semibold uppercase tracking-wider text-white/65">
								{t("filterOfficialRating")}
							</h2>
							<span className="text-[10px] text-white/35">
								{draft.officialRatings.length}
							</span>
						</div>
						{options.officialRatings.length > 5 && (
							<label className="mb-2 flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 focus-within:border-white/25">
								<Search
									aria-hidden="true"
									className="h-3.5 w-3.5 shrink-0 text-white/40"
								/>
								<input
									aria-label={t("filterSearchRatings")}
									value={ratingSearch}
									onChange={(event) => setRatingSearch(event.target.value)}
									placeholder={t("filterSearchRatings")}
									className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
								/>
							</label>
						)}
						<div className="max-h-36 overflow-y-auto rounded-md">
							{filteredRatings.length > 0 ? (
								filteredRatings.map((rating) => (
									<FilterOption
										key={rating}
										label={rating}
										selected={draft.officialRatings.includes(rating)}
										onChange={() => toggleFilter("officialRatings", rating)}
									/>
								))
							) : (
								<p className="px-2 py-3 text-xs text-white/40">
									{options.officialRatings.length === 0
										? t("filterNoRatings")
										: t("filterNoOptionsMatch")}
								</p>
							)}
						</div>
					</section>

					{isMusicLibrary && (
						<>
							<MultiFilterSection
								title={t("filterArtist")}
								searchLabel={t("filterSearchArtists")}
								emptyLabel={t("filterNoArtists")}
								noOptionsMatchLabel={t("filterNoOptionsMatch")}
								options={options.artists}
								selected={draft.artists}
								onToggle={(artist) => toggleFilter("artists", artist)}
							/>
							<MultiFilterSection
								title={t("filterAlbumArtist")}
								searchLabel={t("filterSearchAlbumArtists")}
								emptyLabel={t("filterNoAlbumArtists")}
								noOptionsMatchLabel={t("filterNoOptionsMatch")}
								options={options.albumArtists}
								selected={draft.albumArtists}
								onToggle={(artist) => toggleFilter("albumArtists", artist)}
							/>
							<MultiFilterSection
								title={t("filterAlbumType")}
								searchLabel={t("filterSearchAlbumTypes")}
								emptyLabel={t("filterNoAlbumTypes")}
								noOptionsMatchLabel={t("filterNoOptionsMatch")}
								options={options.albumTypes}
								selected={draft.albumTypes}
								onToggle={(albumType) => toggleFilter("albumTypes", albumType)}
							/>
						</>
					)}

					<div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
						<button
							type="button"
							onClick={() => {
								const cleared: CatalogFilters = {
									genres: [],
									officialRatings: [],
									yearFrom: null,
									yearTo: null,
									watchState: null,
									favoritesOnly: false,
									artists: [],
									albumArtists: [],
									albumTypes: [],
								};
								setDraft(cleared);
								apply(cleared);
							}}
							className="rounded-md px-2 py-2 text-xs font-medium text-white/55 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
						>
							{t("clearFilters")}
						</button>
						<button
							type="button"
							onClick={() => apply(draft)}
							className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-black transition hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
						>
							{t("applyFilters")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function FilterOption({
	label,
	selected,
	onChange,
}: {
	label: string;
	selected: boolean;
	onChange: () => void;
}) {
	return (
		<label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-white/75 transition hover:bg-white/[0.06]">
			<input
				type="checkbox"
				checked={selected}
				onChange={onChange}
				className="peer sr-only"
			/>
			<span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-white/25 bg-white/[0.04] text-black peer-checked:border-white peer-checked:bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-white/60">
				{selected && <Check aria-hidden="true" className="h-3 w-3" />}
			</span>
			<span className="min-w-0 truncate">{label}</span>
		</label>
	);
}

function MultiFilterSection({
	title,
	searchLabel,
	emptyLabel,
	noOptionsMatchLabel,
	options,
	selected,
	onToggle,
}: {
	title: string;
	searchLabel: string;
	emptyLabel: string;
	noOptionsMatchLabel: string;
	options: string[];
	selected: string[];
	onToggle: (value: string) => void;
}) {
	const [search, setSearch] = useState("");
	const normalizedSearch = search.trim().toLocaleLowerCase();
	const visibleOptions = options.filter((option) =>
		option.toLocaleLowerCase().includes(normalizedSearch),
	);
	if (options.length === 0 && selected.length === 0) return null;

	return (
		<section className="mt-4 border-t border-white/10 pt-3">
			<div className="mb-2 flex items-center justify-between gap-3">
				<h2 className="text-xs font-semibold uppercase tracking-wider text-white/65">
					{title}
				</h2>
				<span className="text-[10px] text-white/35">{selected.length}</span>
			</div>
			<label className="mb-2 flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-2.5 focus-within:border-white/25">
				<Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-white/40" />
				<input
					aria-label={searchLabel}
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder={searchLabel}
					className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/35"
				/>
			</label>
			<div className="max-h-36 overflow-y-auto rounded-md">
				{visibleOptions.length > 0 ? (
					visibleOptions.map((option) => (
						<FilterOption
							key={option}
							label={option}
							selected={selected.includes(option)}
							onChange={() => onToggle(option)}
						/>
					))
				) : (
					<p className="px-2 py-3 text-xs text-white/40">
						{options.length === 0 ? emptyLabel : noOptionsMatchLabel}
					</p>
				)}
			</div>
		</section>
	);
}
