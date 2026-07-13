"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/player/video-player";
import { playbackStreams, type DetailData } from "@/lib/jellyfin";
import { getPlaybackInfo } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";

export function PlayerPage({ initialData, session }: { initialData: DetailData; session: AuthSession }) {
	const router = useRouter();
	const [item, setItem] = useState(initialData.item);
	const [streams, setStreams] = useState<ReturnType<typeof playbackStreams>>();
	const [selected, setSelected] = useState<{ audio?: number; subtitle?: number }>({});

	useEffect(() => {
		let active = true;
		void getPlaybackInfo(session, item.Id, { subtitleStreamIndex: -1 }).then((playback) => {
			if (!active) return;
			const parsed = playbackStreams(playback);
			setStreams(parsed);
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
		initialStreams={streams}
		onClose={() => router.back()}
		onNext={(next) => { setItem(next); router.replace(`/play/${encodeURIComponent(next.Id)}`); }}
		onPlayedChange={() => undefined}
	/>;
}
