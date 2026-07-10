"use client";
/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useRef, useState } from "react";
import { getPlaybackInfo, playbackUrl } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";

const HOVER_DELAY = 25;
const PREVIEW_START_MIN = 0.4;
const PREVIEW_START_MAX = 0.6;
const TRANSCODE_WIDTH = 320;
let activePreview: { stop: () => void } | null = null;

export function useHoverPreview(
	itemId: string,
	runtimeTicks: number | undefined,
	session: AuthSession | undefined,
) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const timerRef = useRef<number | undefined>(undefined);
	const requestRef = useRef<AbortController | undefined>(undefined);
	const [active, setActive] = useState(false);

	const stop = useCallback(() => {
		window.clearTimeout(timerRef.current);
		requestRef.current?.abort();
		requestRef.current = undefined;
		const video = videoRef.current;
		if (video) {
			video.pause();
			video.removeAttribute("src");
			video.load();
		}
		setActive(false);
	}, []);

	const start = useCallback(() => {
		if (
			!session ||
			!window.matchMedia("(pointer: fine) and (hover: hover)").matches
		)
			return;
		window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(async () => {
			activePreview?.stop();
			activePreview = { stop };
			const controller = new AbortController();
			requestRef.current = controller;
			try {
				const info = await getPlaybackInfo(session, itemId, {
					maxStreamingBitrate: 400_000,
				});
				if (controller.signal.aborted) return;
				const source = info.MediaSources?.[0];
				if (!source) return;
				const startFactor =
					PREVIEW_START_MIN +
					Math.random() * (PREVIEW_START_MAX - PREVIEW_START_MIN);
				const startTimeTicks = runtimeTicks
					? Math.max(
							0,
							Math.min(
								runtimeTicks * startFactor,
								Math.max(0, runtimeTicks - 5 * 10_000_000),
							),
						)
					: 0;
				const video = videoRef.current;
				if (!video) return;
				const startPlayback = async (bitrate?: number) => {
					video.src = playbackUrl(
						session,
						itemId,
						source,
						bitrate,
						startTimeTicks,
						TRANSCODE_WIDTH,
					);
					video.load();
					await video.play();
				};
				try {
					await startPlayback();
				} catch {
					await startPlayback(400_000);
				}
				if (!controller.signal.aborted) setActive(true);
			} catch {
				stop();
			}
		}, HOVER_DELAY);
	}, [itemId, runtimeTicks, session, stop]);

	useEffect(() => () => stop(), [stop]);
	return { videoRef, active, start, stop };
}

export function HoverPreviewVideo({
	preview,
}: {
	preview: ReturnType<typeof useHoverPreview>;
}) {
	return (
		<video
			ref={preview.videoRef}
			muted
			playsInline
			loop
			aria-hidden="true"
			onError={preview.stop}
			className={`pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover transition-opacity duration-200 ${preview.active ? "opacity-100" : "opacity-0"}`}
		/>
	);
}
