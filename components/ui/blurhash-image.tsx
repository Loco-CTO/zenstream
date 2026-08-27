"use client";

import { decode } from "blurhash";
import { Clapperboard } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { ComponentPropsWithoutRef } from "react";
import type { MediaImage } from "@/lib/media-api";

type BlurHashImageProps = Omit<
	ComponentPropsWithoutRef<typeof Image>,
	"src" | "alt" | "unoptimized"
> & {
	image: MediaImage;
	alt: string;
	fill?: boolean;
};

const PLACEHOLDER_SIZE = 16;
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
	...props
}: BlurHashImageProps) {
	const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
	const [failedSrc, setFailedSrc] = useState<string | null>(null);
	const loaded = loadedSrc === image.src;
	const failed = failedSrc === image.src;
	const resolvedWidth = width ?? image.width;
	const resolvedHeight = height ?? image.height;
	const placeholder = useMemo(
		() => blurHashToDataUrl(image.blurHash),
		[image.blurHash],
	);

	return (
		<>
			{placeholder && (
				<div
					aria-hidden="true"
					className={`pointer-events-none absolute inset-0 h-full w-full scale-105 bg-cover bg-center [clip-path:inset(0)] blur-xl transition-opacity duration-300 ${
						loaded ? "opacity-0" : "opacity-100"
					}`}
					style={{ backgroundImage: `url("${placeholder}")` }}
				/>
			)}
			{failed ? (
				<MediaPlaceholder />
			) : (
				<Image
					{...props}
					unoptimized
					src={image.src}
					alt={alt}
					fill={fill}
					{...(fill
						? {}
						: {
								width: resolvedWidth ?? 1,
								height: resolvedHeight ?? 1,
							})}
					sizes={sizes ?? (fill ? "100vw" : undefined)}
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

function blurHashToDataUrl(blurHash?: string | null) {
	if (!blurHash) return null;
	if (blurHashDataUrlCache.has(blurHash)) {
		return blurHashDataUrlCache.get(blurHash) ?? null;
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
		blurHashDataUrlCache.set(blurHash, url);
		return url;
	} catch {
		blurHashDataUrlCache.set(blurHash, null);
		return null;
	}
}
