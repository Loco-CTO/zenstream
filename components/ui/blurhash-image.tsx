"use client";

import { decode } from "blurhash";
import { Clapperboard } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { ComponentPropsWithoutRef, CSSProperties } from "react";
import { artworkVariantUrl, type MediaImage } from "@/lib/media-api";

type BlurHashImageProps = Omit<
	ComponentPropsWithoutRef<typeof Image>,
	"src" | "alt" | "unoptimized"
> & {
	image: MediaImage;
	alt: string;
	fill?: boolean;
	useArtworkVariants?: boolean;
};

const PLACEHOLDER_SIZE = 16;
const MAX_BLUR_HASH_CACHE_ENTRIES = 128;
const blurHashDataUrlCache = new Map<string, string | null>();

export function BlurHashImage({
	image,
	className,
	onLoad,
	onError,
	alt,
	fill = true,
	width,
	height,
	sizes,
	useArtworkVariants = false,
	...props
}: BlurHashImageProps) {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const loaded = loadedSrc === image.src;
	const failed = failedSrc === image.src;
	const resolvedWidth = width ?? image.width;
	const resolvedHeight = height ?? image.height;
	const resolvedSizes = sizes ?? (fill ? "100vw" : undefined);
	const placeholder = loaded ? null : blurHashToDataUrl(image.blurHash);
	const variants = useMemo(() => {
		if (!useArtworkVariants) return null;
		const small = artworkVariantUrl(image.src, 160);
		const medium = artworkVariantUrl(image.src, 320);
		return small === medium ? null : { small, medium };
	}, [image.src, useArtworkVariants]);
	const artwork = (
		<Image
			{...props}
			unoptimized
			src={variants?.medium ?? image.src}
			alt={alt}
			fill={fill}
			{...(fill
				? {}
				: {
						width: resolvedWidth ?? 1,
						height: resolvedHeight ?? 1,
					})}
			sizes={resolvedSizes}
			loading={props.loading ?? "lazy"}
			decoding={props.decoding ?? "async"}
			fetchPriority={props.fetchPriority ?? "low"}
			className={className}
			onError={(event) => {
				setFailedSrc(image.src);
				onError?.(event);
			}}
			onLoad={(event) => {
				setLoadedSrc(image.src);
				onLoad?.(event);
			}}
		/>
	);

	return (
		<>
			{image.blurHash && (
				<div
					aria-hidden="true"
					className={`pointer-events-none absolute inset-0 h-full w-full scale-105 bg-cover bg-center [clip-path:inset(0)] blur-xl transition-opacity duration-150 ${
						loaded ? "opacity-0" : "opacity-100"
					}`}
					style={
						placeholder
							? ({
									"--blurhash-image": `url("${placeholder}")`,
									backgroundImage: "var(--blurhash-image)",
								} as CSSProperties)
							: undefined
					}
				/>
			)}
			{failed ? (
				<MediaPlaceholder />
			) : variants ? (
				<picture className={fill ? "absolute inset-0" : undefined}>
					<source
						srcSet={`${variants.small} 160w, ${variants.medium} 320w`}
						sizes={resolvedSizes ?? `${resolvedWidth ?? 320}px`}
					/>
					{artwork}
				</picture>
			) : (
				artwork
			)}
		</>
	);
}

export function MediaPlaceholder() {
	return (
		<div
			aria-hidden="true"
			className="absolute inset-0 flex items-center justify-center bg-white/[0.035] text-white/20"
		>
			<Clapperboard className="h-10 w-10 stroke-[1.5]" />
		</div>
	);
}

export function BlurHashGlow({
	image,
	className = "",
}: {
	image: Pick<MediaImage, "src" | "blurHash">;
	className?: string;
}) {
	const placeholder = useMemo(
		() => blurHashToDataUrl(image.blurHash),
		[image.blurHash],
	);
	return (
		<div
			aria-hidden="true"
			className={`pointer-events-none absolute inset-[-28%] scale-110 bg-cover bg-center opacity-45 blur-3xl ${className}`}
			style={{
				backgroundImage: `url("${placeholder ?? image.src}")`,
			}}
		/>
	);
}

function blurHashToDataUrl(blurHash?: string | null) {
	if (!blurHash) return null;
	if (blurHashDataUrlCache.has(blurHash)) {
		const cached = blurHashDataUrlCache.get(blurHash) ?? null;
		blurHashDataUrlCache.delete(blurHash);
		blurHashDataUrlCache.set(blurHash, cached);
		return cached;
	}

	try {
		const pixels = decode(blurHash, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
		let rects = "";
		for (let y = 0; y < PLACEHOLDER_SIZE; y += 1) {
			for (let x = 0; x < PLACEHOLDER_SIZE; x += 1) {
				const index = 4 * (y * PLACEHOLDER_SIZE + x);
				rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="rgb(${pixels[index]},${pixels[index + 1]},${pixels[index + 2]})"/>`;
			}
		}
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PLACEHOLDER_SIZE} ${PLACEHOLDER_SIZE}" shape-rendering="crispEdges">${rects}</svg>`;
		const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
		cacheBlurHashDataUrl(blurHash, url);
		return url;
	} catch {
		cacheBlurHashDataUrl(blurHash, null);
		return null;
	}
}

function cacheBlurHashDataUrl(blurHash: string, url: string | null) {
	blurHashDataUrlCache.set(blurHash, url);
	while (blurHashDataUrlCache.size > MAX_BLUR_HASH_CACHE_ENTRIES) {
		const oldestBlurHash = blurHashDataUrlCache.keys().next().value;
		if (oldestBlurHash === undefined) return;
		blurHashDataUrlCache.delete(oldestBlurHash);
	}
}
