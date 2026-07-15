"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import { playbackStreams, type DetailData } from "@/lib/jellyfin";
import { getPlaybackInfo } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { useSyncplay } from "@/lib/syncplay";

export function PlayerPage({ initialData, session }: { initialData: DetailData; session: AuthSession }) {
	const router = useRouter();
	const { active, setWatchingTogether } = useSyncplay();
	const [item, setItem] = useState(initialData.item);
	const [streams, setStreams] = useState<ReturnType<typeof playbackStreams>>();
	const [streamsItemId, setStreamsItemId] = useState<string>();
	const [selected, setSelected] = useState<{ audio?: number; subtitle?: number }>({});

	useEffect(() => {
		let active = true;
		void getPlaybackInfo(session, item.Id, { subtitleStreamIndex: -1 }).then((playback) => {
			if (!active) return;
			const parsed = playbackStreams(playback);
			setStreams(parsed);
			setStreamsItemId(item.Id);
			setSelected({
				audio: Number(parsed.audio.find((track) => track.IsDefault)?.Index ?? parsed.audio[0]?.Index),
				subtitle: Number(parsed.subtitles.find((track) => track.IsDefault)?.Index ?? parsed.subtitles[0]?.Index),
			});
		}).catch(() => undefined);
		return () => { active = false; };
	}, [item.Id, session]);

	return <VideoPlayer
		item={item}
		session={session}
		initialAudioStreamIndex={selected.audio}
		initialSubtitleStreamIndex={selected.subtitle}
		// VideoPlayer treats initialStreams as authoritative. Ignore the previous
		// item's result until playback info for this item has arrived.
		initialStreams={streamsItemId === item.Id ? streams : undefined}
		onClose={() => {
			if (active) void setWatchingTogether(false).catch(() => undefined);
			router.back();
		}}
		onNext={(next) => { setItem(next); router.replace(`/play/${encodeURIComponent(next.Id)}`); }}
		onPlayedChange={() => undefined}
	/>;
}
