"use client";

import {
	ChevronLeft,
	ChevronRight,
	Info,
	Play,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	heroImage,
	getHeroTrailer,
	titleLogoImage,
	type HeroTrailer,
	type MediaItem,
} from "@/lib/media-api";
import { runtimeLabel } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import type { AuthSession } from "@/lib/session";
import { PrimaryActionButton } from "@/components/ui/primary-action-button";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import { useSyncplayPlayback } from "@/lib/syncplay-playback";

const SLIDE_INTERVAL_MS = 7000;
const TRAILER_DELAY_MS = 0;
const DRAG_THRESHOLD_PX = 48;
type SlideDirection = "next" | "previous";
type TrailerState = {
	itemId: string;
	generation: number;
	value: HeroTrailer;
};
type SlideLifecycle = {
	itemId: string;
	generation: number;
	startedAt: number;
	advanceRequested: boolean;
	pendingAdvance: boolean;
};

export function Hero({
	items,
	session,
}: {
	items: MediaItem[];
	session: AuthSession;
}) {
	const { locale, t } = useI18n();
	const { canStartPlayback, startPlayback } = useSyncplayPlayback(session);
	const slides = useMemo(() => items.filter(hasVisualImage), [items]);
	const [activeItemId, setActiveItemId] = useState<string | null>(
		() => slides[0]?.Id ?? items[0]?.Id ?? null,
	);
	const [slideDirection, setSlideDirection] = useState<SlideDirection>("next");
	const [isDragging, setIsDragging] = useState(false);
	const [trailerState, setTrailerState] = useState<TrailerState | null>(null);
	const [isTrailerMuted, setIsTrailerMuted] = useState(true);
	const [canPlayTrailers, setCanPlayTrailers] = useState(false);
	const [titleLogoFailedSrc, setTitleLogoFailedSrc] = useState<string | null>(
		null,
	);
	const dragStartX = useRef<number | null>(null);
	const dragHandled = useRef(false);
	const fallbackTimer = useRef<number | null>(null);
	const slidesRef = useRef(slides);
	const activeItemIdRef = useRef(activeItemId);
	const activeItemRef = useRef<MediaItem | null>(null);
	const lifecycleGeneration = useRef(0);
	const lifecycleRef = useRef<SlideLifecycle | null>(null);
	const canNavigateSlides = slides.length > 1;
	const effectiveActiveItemId =
		activeItemId && slides.some((slide) => slide.Id === activeItemId)
			? activeItemId
			: (slides[0]?.Id ?? items[0]?.Id ?? null);
	const indexedActiveSlide = slides.findIndex(
		(slide) => slide.Id === effectiveActiveItemId,
	);
	const visibleIndex = indexedActiveSlide >= 0 ? indexedActiveSlide : 0;
	const item = slides[visibleIndex] ?? items[0] ?? null;
	const trailer = trailerState?.itemId === item?.Id ? trailerState.value : null;
	const trailerGeneration =
		trailerState?.itemId === item?.Id ? trailerState.generation : null;

	useEffect(() => {
		slidesRef.current = slides;
		activeItemIdRef.current = item?.Id ?? null;
		activeItemRef.current = item;
	}, [item, slides]);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
		const updateTrailerSupport = () => setCanPlayTrailers(mediaQuery.matches);

		updateTrailerSupport();
		mediaQuery.addEventListener("change", updateTrailerSupport);
		return () => mediaQuery.removeEventListener("change", updateTrailerSupport);
	}, []);

	const showSlide = useCallback(
		(index: number, direction: SlideDirection) => {
			if (!canNavigateSlides) return;
			const nextItem = slides[(index + slides.length) % slides.length];
			if (!nextItem || nextItem.Id === activeItemIdRef.current) return;
			activeItemIdRef.current = nextItem.Id;
			setTrailerState(null);
			setIsTrailerMuted(true);
			setSlideDirection(direction);
			setActiveItemId(nextItem.Id);
		},
		[canNavigateSlides, slides],
	);

	const goToPreviousSlide = useCallback(() => {
		showSlide(visibleIndex - 1, "previous");
	}, [showSlide, visibleIndex]);

	const goToNextSlide = useCallback(() => {
		showSlide(visibleIndex + 1, "next");
	}, [showSlide, visibleIndex]);

	const advanceToNextSlide = useCallback(() => {
		const currentSlides = slidesRef.current;
		if (currentSlides.length <= 1) return false;
		const currentIndex = Math.max(
			0,
			currentSlides.findIndex((slide) => slide.Id === activeItemIdRef.current),
		);
		const nextItem = currentSlides[(currentIndex + 1) % currentSlides.length];
		activeItemIdRef.current = nextItem.Id;
		setTrailerState(null);
		setIsTrailerMuted(true);
		setSlideDirection("next");
		setActiveItemId(nextItem.Id);
		return true;
	}, []);

	const requestAdvance = useCallback(
		(itemId: string, generation: number) => {
			const lifecycle = lifecycleRef.current;
			if (
				!lifecycle ||
				lifecycle.itemId !== itemId ||
				lifecycle.generation !== generation ||
				lifecycle.advanceRequested ||
				activeItemIdRef.current !== itemId
			) {
				return;
			}
			if (slidesRef.current.length <= 1) {
				lifecycle.pendingAdvance = true;
				return;
			}
			lifecycle.advanceRequested = true;
			lifecycle.pendingAdvance = false;
			advanceToNextSlide();
		},
		[advanceToNextSlide],
	);

	const scheduleAdvance = useCallback(
		(itemId: string, generation: number, delayMs: number) => {
			if (fallbackTimer.current !== null) {
				window.clearTimeout(fallbackTimer.current);
			}
			fallbackTimer.current = window.setTimeout(() => {
				fallbackTimer.current = null;
				requestAdvance(itemId, generation);
			}, delayMs);
		},
		[requestAdvance],
	);

	useEffect(() => {
		if (!effectiveActiveItemId) return undefined;
		const lifecycleItem = activeItemRef.current;
		if (!lifecycleItem || lifecycleItem.Id !== effectiveActiveItemId)
			return undefined;

		let cancelled = false;
		const generation = ++lifecycleGeneration.current;
		const startedAt = Date.now();
		lifecycleRef.current = {
			itemId: effectiveActiveItemId,
			generation,
			startedAt,
			advanceRequested: false,
			pendingAdvance: false,
		};
		setTrailerState(null);
		setIsTrailerMuted(true);
		if (!canPlayTrailers) {
			scheduleAdvance(effectiveActiveItemId, generation, SLIDE_INTERVAL_MS);
			return () => {
				cancelled = true;
				if (fallbackTimer.current !== null) {
					window.clearTimeout(fallbackTimer.current);
					fallbackTimer.current = null;
				}
			};
		}
		const hasListedTrailer = (lifecycleItem.RemoteTrailers?.length ?? 0) > 0;
		if (!hasListedTrailer) {
			scheduleAdvance(effectiveActiveItemId, generation, SLIDE_INTERVAL_MS);
		}

		const trailerDelay = window.setTimeout(() => {
			void getHeroTrailer(session, lifecycleItem)
				.then((nextTrailer: HeroTrailer | null) => {
					if (
						cancelled ||
						lifecycleRef.current?.generation !== generation ||
						activeItemIdRef.current !== effectiveActiveItemId
					) {
						return;
					}
					if (nextTrailer) {
						setTrailerState({
							itemId: effectiveActiveItemId,
							generation,
							value: nextTrailer,
						});
						return;
					}
					scheduleAdvance(
						effectiveActiveItemId,
						generation,
						Math.max(0, SLIDE_INTERVAL_MS - (Date.now() - startedAt)),
					);
				})
				.catch(() => {
					if (!cancelled) {
						scheduleAdvance(
							effectiveActiveItemId,
							generation,
							Math.max(0, SLIDE_INTERVAL_MS - (Date.now() - startedAt)),
						);
					}
				});
		}, TRAILER_DELAY_MS);

		return () => {
			cancelled = true;
			window.clearTimeout(trailerDelay);
			if (fallbackTimer.current !== null) {
				window.clearTimeout(fallbackTimer.current);
				fallbackTimer.current = null;
			}
		};
	}, [canPlayTrailers, effectiveActiveItemId, scheduleAdvance, session]);

	useEffect(() => {
		const lifecycle = lifecycleRef.current;
		if (slides.length > 1 && lifecycle?.pendingAdvance) {
			requestAdvance(lifecycle.itemId, lifecycle.generation);
		}
	}, [requestAdvance, slides.length]);

	const handleTrailerFailure = useCallback(
		(itemId: string, generation: number) => {
			if (
				lifecycleRef.current?.generation !== generation ||
				activeItemIdRef.current !== itemId
			) {
				return;
			}
			setTrailerState(null);
			const startedAt = lifecycleRef.current.startedAt;
			scheduleAdvance(
				itemId,
				generation,
				Math.max(0, SLIDE_INTERVAL_MS - (Date.now() - startedAt)),
			);
		},
		[scheduleAdvance],
	);

	const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
		if (!canNavigateSlides || isInteractiveTarget(event.target)) return;

		dragStartX.current = event.clientX;
		dragHandled.current = false;
		setIsDragging(true);
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
		if (dragStartX.current === null || dragHandled.current) return;

		const deltaX = event.clientX - dragStartX.current;
		if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) return;

		dragHandled.current = true;
		if (deltaX > 0) {
			goToPreviousSlide();
		} else {
			goToNextSlide();
		}
	};

	const handlePointerEnd = () => {
		dragStartX.current = null;
		dragHandled.current = false;
		setIsDragging(false);
	};

	const image = item ? heroImage(item) : null;
	const titleLogo = item ? titleLogoImage(item) : null;
	const titleLogoFailed = titleLogo?.src === titleLogoFailedSrc;

	if (!item) {
		return (
			<section className="relative flex h-[min(72svh,640px)] items-end overflow-hidden bg-neutral-950 px-5 pb-16 md:h-[85svh] md:px-14 md:pb-20">
				<div>
					<p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/35">
						ZenStream
					</p>
					<h1 className="text-5xl font-black text-white">{t("emptyLibrary")}</h1>
					<p className="mt-5 max-w-sm text-sm leading-6 text-white/45">
						{t("emptyLibraryHint")}
					</p>
				</div>
			</section>
		);
	}

	const activeSlideKey = `${item.Id}-${visibleIndex}`;
	const meta = [
		item.ProductionYear,
		item.Type,
		item.OfficialRating,
		runtimeLabel(item, locale),
	].filter(Boolean);

	return (
		<section
			aria-label={t("featuredTitle")}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerEnd}
			onPointerCancel={handlePointerEnd}
			className={`group/hero relative h-[min(72svh,640px)] w-full touch-pan-y select-none overflow-hidden md:h-[85svh] ${
				canNavigateSlides ? (isDragging ? "cursor-grabbing" : "cursor-grab") : ""
			}`}
		>
			{slides.length > 0 ? (
				slides.map((slide, index) => {
					const slideImage = heroImage(slide);
					const isActive = index === visibleIndex;

					// Keep the carousel's item list, but only mount the active backdrop.
					// Mobile browsers can otherwise retain many large GPU image layers
					// after fast navigation and render the hero as black or partially tiled.
					return isActive && slideImage ? (
						<BlurHashImage
							key={slide.Id}
							image={slideImage}
							alt=""
							aria-hidden="true"
							draggable={false}
							loading={isActive ? "eager" : "lazy"}
							fetchPriority={isActive ? "high" : "low"}
							className={`absolute inset-0 h-full w-full object-cover object-center brightness-[0.55] transition-[opacity,transform,filter] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform] ${
								isActive
									? "hero-backdrop-active opacity-100 blur-0"
									: "scale-[1.035] opacity-0 blur-sm"
							}`}
						/>
					) : null;
				})
			) : image ? (
				<BlurHashImage
					image={image}
					alt=""
					draggable={false}
					loading="eager"
					fetchPriority="high"
					className="absolute inset-0 h-full w-full object-cover object-center brightness-[0.55]"
				/>
			) : null}
			{canPlayTrailers &&
				trailer &&
				(trailer.kind === "youtube" ? (
					<YouTubeTrailer
						key={`${item.Id}-youtube`}
						trailer={trailer}
						title={`${item.Name} trailer`}
						muted={isTrailerMuted}
						onEnded={() => {
							if (trailerGeneration !== null) {
								requestAdvance(item.Id, trailerGeneration);
							}
						}}
						onError={() => {
							if (trailerGeneration !== null) {
								handleTrailerFailure(item.Id, trailerGeneration);
							}
						}}
					/>
				) : (
					<video
						key={`${item.Id}-local`}
						src={trailer.url}
						autoPlay
						muted={isTrailerMuted}
						playsInline
						onLoadedMetadata={(event) => {
							for (const track of Array.from(event.currentTarget.textTracks)) {
								track.mode = "disabled";
							}
						}}
						onEnded={() => {
							if (trailerGeneration !== null) {
								requestAdvance(item.Id, trailerGeneration);
							}
						}}
						onError={() => {
							if (trailerGeneration !== null) {
								handleTrailerFailure(item.Id, trailerGeneration);
							}
						}}
						className="pointer-events-none absolute inset-0 h-full w-full scale-[1.45] object-cover"
					/>
				))}
			<div className="absolute inset-0 bg-[linear-gradient(105deg,var(--c-hero-side)_0%,var(--c-hero-side-mid)_30%,rgba(0,0,0,0.02)_55%,transparent_100%)]" />
			<div className="absolute inset-0 bg-[linear-gradient(to_top,var(--c-hero-bottom)_0%,var(--c-hero-btm-mid)_22%,transparent_50%)]" />
			{canPlayTrailers && trailer && (
				<button
					type="button"
					aria-label={isTrailerMuted ? t("unmuteTrailer") : t("muteTrailer")}
					onClick={() => setIsTrailerMuted((muted) => !muted)}
					className="absolute bottom-14 right-6 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white/75 backdrop-blur transition hover:bg-black/75 hover:text-white md:right-10"
				>
					{isTrailerMuted ? (
						<VolumeX className="h-4 w-4" />
					) : (
						<Volume2 className="h-4 w-4" />
					)}
				</button>
			)}
			{canNavigateSlides && (
				<>
					<button
						type="button"
						aria-label={t("previousSlide")}
						onClick={goToPreviousSlide}
						className="absolute left-4 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/50 text-white/65 opacity-0 backdrop-blur transition hover:bg-white/10 hover:text-white group-hover/hero:opacity-100 md:flex"
					>
						<ChevronLeft className="h-4 w-4" />
					</button>
					<button
						type="button"
						aria-label={t("nextSlide")}
						onClick={goToNextSlide}
						className="absolute right-4 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/12 bg-black/50 text-white/65 opacity-0 backdrop-blur transition hover:bg-white/10 hover:text-white group-hover/hero:opacity-100 md:flex"
					>
						<ChevronRight className="h-4 w-4" />
					</button>
				</>
			)}
			<div className="absolute inset-0 flex flex-col justify-end px-5 pb-16 md:px-14 md:pb-20">
				<div
					key={activeSlideKey}
					data-slide-direction={slideDirection}
					className="hero-slide-content max-w-lg"
				>
					{titleLogo && !titleLogoFailed ? (
						<h1 className="relative mb-5">
							<img
								src={titleLogo.src}
								alt={item.Name}
								draggable={false}
								onError={() => setTitleLogoFailedSrc(titleLogo.src)}
								className="max-h-[300px] max-w-full object-contain object-left"
							/>
						</h1>
					) : (
						<h1 className="mb-5 line-clamp-3 max-w-2xl text-[clamp(1.5rem,5vw,3rem)] font-black leading-[0.95] tracking-normal text-white [overflow-wrap:anywhere] md:text-4xl lg:text-5xl">
							{item.Name}
						</h1>
					)}
					<div className="mb-4 flex items-center gap-2 overflow-x-auto">
						{meta.map((value, index) => (
							<span
								key={`${value}-${index}`}
								className={`whitespace-nowrap text-xs ${index === 0 ? "font-semibold text-white/80" : "text-white/35"}`}
							>
								{index > 0 && <span className="mr-2 text-white/15">・</span>}
								{value}
							</span>
						))}
					</div>
					{item.Overview && (
						<p className="mb-8 max-w-sm text-sm font-light leading-6 tracking-wide text-white/45 line-clamp-3">
							{item.Overview}
						</p>
					)}

					<div className="flex items-center gap-3">
						<PrimaryActionButton
							onClick={() => void startPlayback(item).catch(() => undefined)}
							disabled={!canStartPlayback}
						>
							<Play className="h-4 w-4 fill-black text-black" />
							{t("play")}
						</PrimaryActionButton>
						<button
							onClick={() => window.location.assign(`/show/${item.Id}`)}
							className="flex h-11 min-w-24 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-5 text-sm font-medium tracking-normal text-white/70 backdrop-blur-xl transition hover:bg-white/10 hover:text-white"
						>
							<Info className="h-4 w-4" />
							{t("info")}
						</button>
					</div>
				</div>
			</div>
			{canNavigateSlides && (
				<div className="absolute bottom-7 right-6 flex max-w-[calc(100%-3rem)] items-center gap-1.5 md:right-10">
					{slides.map((slide, index) => (
						<button
							key={slide.Id}
							type="button"
							aria-label={t("showSlide", {
								count: index + 1,
								title: slide.Name,
							})}
							aria-current={index === visibleIndex ? "true" : undefined}
							onClick={() =>
								showSlide(index, index >= visibleIndex ? "next" : "previous")
							}
							className={`h-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
								index === visibleIndex
									? "w-5 bg-violet-300/90"
									: "w-2 bg-white/20 hover:bg-white/40"
							}`}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function YouTubeTrailer({
	trailer,
	title,
	muted,
	onEnded,
	onError,
}: {
	trailer: Extract<HeroTrailer, { kind: "youtube" }>;
	title: string;
	muted: boolean;
	onEnded: () => void;
	onError: () => void;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const hasPlayed = useRef(false);
	const hasEnded = useRef(false);
	const hasFailed = useRef(false);
	const failOnce = useCallback(() => {
		if (hasFailed.current || hasEnded.current) return;
		hasFailed.current = true;
		onError();
	}, [onError]);

	const sendCommand = useCallback((func: string) => {
		iframeRef.current?.contentWindow?.postMessage(
			JSON.stringify({ event: "command", func, args: [] }),
			"https://www.youtube.com",
		);
	}, []);

	const subscribeToEvent = useCallback((eventName: string) => {
		iframeRef.current?.contentWindow?.postMessage(
			JSON.stringify({
				event: "command",
				func: "addEventListener",
				args: [eventName],
			}),
			"https://www.youtube.com",
		);
	}, []);

	useEffect(() => {
		sendCommand(muted ? "mute" : "unMute");
	}, [muted, sendCommand]);

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			if (
				event.origin !== "https://www.youtube.com" ||
				event.source !== iframeRef.current?.contentWindow
			) {
				return;
			}

			try {
				const data =
					typeof event.data === "string" ? JSON.parse(event.data) : event.data;
				if (data?.event === "onReady") {
					subscribeToEvent("onStateChange");
					subscribeToEvent("onError");
					sendCommand("playVideo");
					sendCommand(muted ? "mute" : "unMute");
				}
				if (data?.event === "onStateChange") {
					if (data.info === 1) hasPlayed.current = true;
					if (data.info === 0 && hasPlayed.current && !hasEnded.current) {
						hasEnded.current = true;
						onEnded();
					}
				}
				if (data?.event === "onError") failOnce();
			} catch {
				// Ignore unrelated iframe messages.
			}
		};

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [failOnce, muted, onEnded, sendCommand, subscribeToEvent]);

	const params = new URLSearchParams({
		autoplay: "1",
		mute: "1",
		controls: "0",
		cc_load_policy: "0",
		enablejsapi: "1",
		playsinline: "1",
		rel: "0",
		modestbranding: "1",
		origin: typeof window === "undefined" ? "" : window.location.origin,
	});

	return (
		<iframe
			ref={iframeRef}
			src={`${trailer.url}?${params}`}
			title={title}
			allow="autoplay; encrypted-media; picture-in-picture"
			referrerPolicy="strict-origin-when-cross-origin"
			onLoad={() => {
				iframeRef.current?.contentWindow?.postMessage(
					JSON.stringify({ event: "listening", id: trailer.videoId }),
					"https://www.youtube.com",
				);
			}}
			onError={failOnce}
			className="pointer-events-none absolute inset-0 h-full w-full scale-[1.45] border-0"
		/>
	);
}

function isInteractiveTarget(target: EventTarget) {
	return target instanceof Element && Boolean(target.closest("a, button"));
}

function hasVisualImage(item: MediaItem) {
	return Boolean(item.BackdropImageTags?.length);
}
