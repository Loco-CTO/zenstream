"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getSearchItems, posterImage, type MediaItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { BlurHashImage } from "@/components/ui/blurhash-image";

export function SearchOverlay({
	session,
	onClose,
}: {
	session: AuthSession;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
	const [resultQuery, setResultQuery] = useState("");
	const [error, setError] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const requestVersionRef = useRef(0);

	const handleQueryChange = (value: string) => {
		setQuery(value);
		setSuggestions([]);
		setResultQuery("");
		setError(false);
	};

	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	useEffect(() => {
		const value = query.trim();
		const requestVersion = ++requestVersionRef.current;
		if (!value) return;
		const controller = new AbortController();
		getSearchItems(session, value, { limit: 8, signal: controller.signal })
			.then((results) => {
				if (
					controller.signal.aborted ||
					requestVersionRef.current !== requestVersion
				)
					return;
				setSuggestions(results);
				setResultQuery(value);
				setError(false);
			})
			.catch(() => {
				if (
					!controller.signal.aborted &&
					requestVersionRef.current === requestVersion
				)
					setError(true);
			})
			.finally(() => undefined);
		return () => {
			controller.abort();
		};
	}, [query, session]);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		if (!query.trim()) return;
		onClose();
		router.push(`/search?q=${encodeURIComponent(query.trim())}`);
	};
	const select = (item: MediaItem) => {
		onClose();
		router.push(`/show/${item.Id}`);
	};
	return (
		<div
			className="fixed inset-0 z-[100] flex flex-col items-center bg-black/80 px-4 pt-24 backdrop-blur-xl"
			onClick={onClose}
		>
			<div
				className="w-full max-w-xl"
				onClick={(event) => event.stopPropagation()}
			>
				<form onSubmit={submit} className="relative">
					<div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-5 py-3.5 backdrop-blur-xl focus-within:border-violet-400/40">
						<Search className="h-[18px] w-[18px] shrink-0 text-white/40" />
						<input
							ref={inputRef}
							value={query}
							onChange={(event) => handleQueryChange(event.target.value)}
							placeholder={t("searchPlaceholder")}
							className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
							aria-label={t("search")}
						/>
						<button
							type="button"
							aria-label={t("close")}
							onClick={onClose}
							className="text-xs uppercase tracking-wider text-white/35 transition hover:text-white/70"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
					{(error || resultQuery) && (
						<div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/25 p-1 shadow-2xl backdrop-blur-xl">
							{error && (
								<p className="px-4 py-3 text-xs text-red-200/70">
									{t("searchLoadFailed")}
								</p>
							)}
							{!error && suggestions.length === 0 && resultQuery && (
								<p className="px-4 py-3 text-xs text-white/45">
									{t("noSearchResults")}
								</p>
							)}
							{suggestions.map((item) => (
								<button
									type="button"
									key={item.Id}
									onClick={() => select(item)}
									className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-white/[0.06]"
								>
									<div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-white/5">
										{(() => {
											const image = posterImage(item);
											return image ? (
												<BlurHashImage
													image={image}
													alt=""
													className="h-full w-full object-cover"
												/>
											) : null;
										})()}
									</div>
									<span className="min-w-0">
										<span className="block truncate text-sm text-white/80">
											{item.Name}
										</span>
										<span className="block text-xs text-white/35">
											{item.Type === "Series" ? t("series") : t("movie")}
											{item.ProductionYear ? ` · ${item.ProductionYear}` : ""}
										</span>
									</span>
								</button>
							))}
						</div>
					)}
				</form>
			</div>
		</div>
	);
}
