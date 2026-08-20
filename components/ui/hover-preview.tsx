"use client";
/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useRef, useState } from "react";
import { getPlaybackInfo, playbackUrl } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";
import { usePlaybackBehaviorPreferences } from "@/components/playback-behavior-preferences-provider";

const HOVER_DELAY = 100;
const PREVIEW_START_MIN = 0.4;
const PREVIEW_START_MAX = 0.6;
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
	const { autoplayBrowse } = usePlaybackBehaviorPreferences();

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
			!autoplayBrowse ||
			!session ||
			!window.matchMedia("(pointer: fine) and (hover: hover)").matches
		)
			return;
		window.clearTimeout(timerRef.current);
		timerRef.current = window.setTimeout(async () => {
			if (!autoplayBrowse) return;
			activePreview?.stop();
			activePreview = { stop };
			const controller = new AbortController();
			requestRef.current = controller;
			try {
				const info = await getPlaybackInfo(session, itemId, {
					directPlayOnly: true,
				});
				if (controller.signal.aborted) return;
				const source = info.source;
				if (
					!source ||
					source.mode !== "direct" ||
					source.SupportsDirectPlay === false
				)
					return;
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
				const startPlayback = async () => {
					video.src = playbackUrl(source);
					video.load();
					video.addEventListener(
						"loadedmetadata",
						() => {
							if (Number.isFinite(startTimeTicks))
								video.currentTime = startTimeTicks / 10_000_000;
						},
						{ once: true },
					);
					await video.play();
				};
				await startPlayback();
				if (!controller.signal.aborted) setActive(true);
			} catch {
				stop();
			}
		}, HOVER_DELAY);
	}, [autoplayBrowse, itemId, runtimeTicks, session, stop]);

	useEffect(() => {
		if (!autoplayBrowse) {
			// Disabling the preference must synchronously release any active media.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			stop();
		}
	}, [autoplayBrowse, stop]);

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
