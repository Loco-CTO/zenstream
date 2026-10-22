"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SyncplayPlaybackFollower } from "@/components/syncplay/playback-follower";
import { fetchPlayData } from "@/lib/media-api";
import { PlayerPage } from "@/components/pages/player-page";
import { MiniPlayerFrame } from "@/components/player/mini-player-frame";
import { exitFullscreenSafely } from "@/components/player/video-player";
import { usePlaybackBehaviorPreferences } from "@/components/playback-behavior-preferences-provider";
import { getLastNonPlayerPath } from "@/lib/player-navigation";
import type { DetailData } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

export function VideoPlaybackHost({
	playId,
	data,
	ready,
	search,
	session,
	fullscreenHostRef,
	watchHistoryEnabled,
	watchHistoryLoaded,
}: {
	playId: string | null;
	data: DetailData | null;
	ready: boolean;
	search: string;
	session: AuthSession;
	fullscreenHostRef: { current: HTMLDivElement | null };
	watchHistoryEnabled: boolean;
	watchHistoryLoaded: boolean;
}) {
	const router = useRouter();
	const { continueVideoInMiniPlayer } = usePlaybackBehaviorPreferences();
	const [playback, setPlayback] = useState<{
		data: DetailData;
		search: string;
	} | null>(null);
	const [closedRoute, setClosedRoute] = useState<string | null>(null);
	if (!playId && closedRoute) setClosedRoute(null);
	if (
		playId &&
		playId !== closedRoute &&
		ready &&
		data?.item.Id === playId &&
		playback?.data.item.Id !== playId
	)
		setPlayback({ data, search });
	if (!playId && !continueVideoInMiniPlayer && playback) setPlayback(null);
	const minimized = !playId;
	const requests = useRef({ generation: 0 });
	const followItem = useCallback(
		(itemId: string) => {
			const request = ++requests.current.generation;
			void fetchPlayData(session, itemId)
				.then((data) => {
					if (request === requests.current.generation)
						setPlayback({ data, search: "" });
				})
				.catch(() => undefined);
		},
		[session],
	);
	useEffect(() => {
		if (minimized && document.fullscreenElement) exitFullscreenSafely();
		const pending = requests.current;
		return () => {
			pending.generation++;
		};
	}, [minimized]);
	const follower = (
		<SyncplayPlaybackFollower
			viewingItemId={playback?.data.item.Id}
			onFollowItem={minimized && playback ? followItem : undefined}
		/>
	);

	if (!playback && (!playId || playId === closedRoute)) return follower;

	return (
		<>
			{follower}
			<MiniPlayerFrame
				minimized={minimized}
				title={playback?.data.item.Name ?? ""}
			>
				<div
					ref={fullscreenHostRef}
					data-testid="player-fullscreen-host"
					className="absolute inset-0"
				>
					{playback && (
						<PlayerPage
							key={playback.data.item.Id}
							initialData={playback.data}
							session={session}
							fullscreenHostRef={fullscreenHostRef}
							watchHistoryEnabled={watchHistoryEnabled}
							watchHistoryLoaded={watchHistoryLoaded}
							initialSearch={playback.search}
							minimized={minimized}
							onNextItem={
								minimized
									? followItem
									: (itemId) => router.replace(`/play/${encodeURIComponent(itemId)}`)
							}
							onBack={() => {
								if (document.fullscreenElement) exitFullscreenSafely();
								router.replace(getLastNonPlayerPath());
							}}
							onExpand={() =>
								router.push(
									`/play/${encodeURIComponent(playback.data.item.Id)}${playback.search}`,
								)
							}
							onDismiss={() => {
								requests.current.generation++;
								setPlayback(null);
								setClosedRoute(playId);
								if (playId) router.replace(getLastNonPlayerPath());
							}}
						/>
					)}
					{(!playback || (playId && playback.data.item.Id !== playId)) && (
						<div
							data-testid="player-route-loading"
							role="status"
							aria-label="Loading"
							className="absolute inset-0 z-50 flex items-center justify-center bg-black"
						>
							<span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
						</div>
					)}
				</div>
			</MiniPlayerFrame>
		</>
	);
}
