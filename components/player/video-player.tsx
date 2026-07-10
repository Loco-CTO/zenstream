"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Maximize, Pause, Play, Settings, Volume2, VolumeX } from "lucide-react";
import {
	getPlaybackInfo,
	getPlaybackMarkers,
	playbackStreams,
	playbackUrl,
	reportPlayback,
	subtitleUrl,
	trickplayPreview,
	type JellyfinItem,
	type PlaybackMarker,
} from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";
import { Dropdown } from "@/components/ui/dropdown";

type Props = { item: JellyfinItem; session: AuthSession; onClose: () => void };
const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({ item, session, onClose }: Props) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [url, setUrl] = useState<string>();
	const [info, setInfo] = useState<ReturnType<typeof playbackStreams>>();
	const [markers, setMarkers] = useState<{ intro?: PlaybackMarker; outro?: PlaybackMarker } | null>(null);
	const [settings, setSettings] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [muted, setMuted] = useState(false);
	const [speed, setSpeed] = useState("1");
	const [quality, setQuality] = useState("0");
	const [audio, setAudio] = useState("");
	const [subtitle, setSubtitle] = useState("");
	const [offset, setOffset] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState("");
	const [timelinePreview, setTimelinePreview] = useState<ReturnType<typeof trickplayPreview> & { time: number; left: number }>();
	const [previewUnavailable, setPreviewUnavailable] = useState(false);

	useEffect(() => {
		let active = true;
		Promise.all([getPlaybackInfo(session, item.Id), getPlaybackMarkers(session, item.Id)])
			.then(([playback, markerData]) => {
				if (!active) return;
				const parsed = playbackStreams(playback);
				setInfo(parsed);
				setUrl(playbackUrl(session, item.Id, parsed.source, 0));
				setMarkers(markerData);
				const initialAudio = parsed.audio.find((track) => track.IsDefault) ?? parsed.audio[0];
				if (initialAudio?.Index != null) setAudio(String(initialAudio.Index));
			})
			.catch(() => active && setError("Playback could not be loaded."));
		return () => { active = false; };
	}, [item.Id, session]);

	useEffect(() => {
		const video = videoRef.current;
		if (!video || !url) return;
		video.load();
		const position = item.UserData?.PlaybackPositionTicks ? item.UserData.PlaybackPositionTicks / 10_000_000 : 0;
		const onMetadata = () => { if (position > 0 && position < video.duration - 5) video.currentTime = position; void video.play().catch(() => undefined); };
		video.addEventListener("loadedmetadata", onMetadata, { once: true });
		return () => video.removeEventListener("loadedmetadata", onMetadata);
	}, [url, item.UserData?.PlaybackPositionTicks]);

	useEffect(() => {
		const timer = window.setInterval(() => {
			const video = videoRef.current;
			if (video && video.currentTime > 0) void reportPlayback(session, item.Id, video.currentTime, video.paused).catch(() => undefined);
		}, 10_000);
		return () => window.clearInterval(timer);
	}, [item.Id, session]);

	function togglePlay() { const video = videoRef.current; if (!video) return; if (video.paused) void video.play(); else video.pause(); }
	function seek(delta: number) { const video = videoRef.current; if (video) video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + delta)); }
	function chooseQuality(value: string) { setQuality(value); setUrl(playbackUrl(session, item.Id, info?.source, Number(value))); }
	function skip(marker?: PlaybackMarker) { if (marker && videoRef.current) videoRef.current.currentTime = marker.end; }
	function previewTimeline(event: React.PointerEvent<HTMLInputElement>) {
		if (!duration) return;
		const rect = event.currentTarget.getBoundingClientRect();
		const left = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
		const time = left * duration;
		const preview = trickplayPreview(session, item.Id, info?.source, time);
		if (preview) {
			setPreviewUnavailable(false);
			setTimelinePreview({ time, left, ...preview });
		} else {
			setTimelinePreview(undefined);
			setPreviewUnavailable(Boolean(info));
		}
	}

	return <div className="fixed inset-0 z-[200] bg-black text-white" onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === " ") { event.preventDefault(); togglePlay(); } if (event.key === "ArrowLeft") seek(-10); if (event.key === "ArrowRight") seek(10); }} tabIndex={0}>
		<video ref={videoRef} src={url} className="h-full w-full object-contain" onClick={togglePlay} muted={muted} onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)} onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setError("This media could not be played.")}>
			{subtitle && info?.source && <track kind="subtitles" src={subtitleUrl(session, item.Id, info.source, Number(subtitle))} default />}
		</video>
		<div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/85" />
		<div className="absolute left-5 top-5 flex items-start gap-3 md:left-10 md:top-8"><button aria-label="Close player" className="pointer-events-auto rounded-full bg-black/30 p-2 text-white/70 hover:text-white" onClick={onClose}><ArrowLeft /></button><div><p className="text-xs uppercase tracking-[.2em] text-white/55">{item.Type === "Episode" ? `${item.SeriesName ?? "Series"} · S${item.ParentIndexNumber ?? 0}:E${item.IndexNumber ?? 0}` : item.Name}</p>{item.Type === "Episode" && <h1 className="mt-1 text-lg font-semibold">{item.Name}</h1>}</div></div>
		{error && <p role="alert" className="absolute left-1/2 top-1/2 -translate-x-1/2 rounded bg-black/70 px-4 py-3 text-sm text-red-200">{error}</p>}
		<div className="absolute bottom-5 left-5 right-5 md:bottom-8 md:left-10 md:right-10">
			<div className="mb-3 flex gap-2">{markers?.intro && currentTime >= markers.intro.start && currentTime < markers.intro.end && <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/25" onClick={() => skip(markers.intro)}>Skip intro</button>}{markers?.outro && currentTime >= markers.outro.start && currentTime >= markers.outro.start && currentTime < markers.outro.end && <button className="rounded-full bg-white/15 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/25" onClick={() => skip(markers.outro)}>Skip outro</button>}</div>
			<div className="relative">
				<div className="pointer-events-none absolute inset-x-0 top-1 h-1 overflow-hidden rounded bg-white/15">{markers?.intro && duration > 0 && <span className="absolute h-full bg-violet-400/80" style={{ left: `${markers.intro.start / duration * 100}%`, width: `${(markers.intro.end - markers.intro.start) / duration * 100}%` }} />}{markers?.outro && duration > 0 && <span className="absolute h-full bg-violet-400/80" style={{ left: `${markers.outro.start / duration * 100}%`, width: `${(markers.outro.end - markers.outro.start) / duration * 100}%` }} />}</div>
				<input aria-label="Seek" type="range" min="0" max={duration} step="0.1" value={currentTime} className="relative mb-3 h-1 w-full accent-violet-400" onPointerMove={previewTimeline} onPointerLeave={() => { setTimelinePreview(undefined); setPreviewUnavailable(false); }} onPointerDown={previewTimeline} onChange={(event) => { if (videoRef.current) videoRef.current.currentTime = Number(event.target.value); }} />
				{timelinePreview && <TrickplayBubble preview={timelinePreview} onError={() => { setTimelinePreview(undefined); setPreviewUnavailable(true); }} />}
				{previewUnavailable && <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 rounded bg-black/90 px-3 py-2 text-xs text-white/65">Preview unavailable</div>}
			</div>
			<div className="flex items-center gap-3"><button aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}>{playing ? <Pause /> : <Play />}</button><button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)}>{muted ? <VolumeX /> : <Volume2 />}</button><span className="flex-1" /><button aria-label="Settings" onClick={() => setSettings(!settings)}><Settings /></button><button aria-label="Fullscreen" onClick={() => void document.documentElement.requestFullscreen?.()}><Maximize /></button></div>
			{settings && <div className="absolute bottom-12 right-0 grid min-w-64 gap-3 rounded-xl border border-white/10 bg-black/90 p-4 text-xs shadow-2xl">
				<Setting label="Quality"><Dropdown aria-label="Quality" value={quality} options={(info?.qualities ?? [0]).map((value) => ({ value: String(value), label: value ? `${Math.round(value / 1_000_000)} Mbps` : "Auto" }))} onChange={chooseQuality} /></Setting>
				<Setting label="Speed"><Dropdown aria-label="Speed" value={speed} options={speeds.map((value) => ({ value: String(value), label: `${value}x` }))} onChange={(value) => { setSpeed(value); if (videoRef.current) videoRef.current.playbackRate = Number(value); }} /></Setting>
				{(info?.audio.length ?? 0) > 1 && <Setting label="Audio"><Dropdown aria-label="Audio" value={audio} options={info!.audio.map((track) => ({ value: String(track.Index), label: track.DisplayTitle ?? track.Language ?? "Audio" }))} onChange={setAudio} /></Setting>}
				{(info?.subtitles.length ?? 0) > 0 && <Setting label="Subtitles"><Dropdown aria-label="Subtitles" value={subtitle} options={[{ value: "", label: "Off" }, ...info!.subtitles.map((track) => ({ value: String(track.Index), label: track.DisplayTitle ?? track.Language ?? "Subtitle" }))]} onChange={setSubtitle} /></Setting>}
				<Setting label={`Subtitle offset ${offset > 0 ? "+" : ""}${offset.toFixed(1)}s`}><input aria-label="Subtitle offset" type="range" min="-5" max="5" step="0.1" value={offset} onChange={(event) => setOffset(Number(event.target.value))} className="accent-violet-400" /></Setting>
			</div>}
		</div>
	</div>;
}

function Setting({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex items-center justify-between gap-4 text-white/60"><span>{label}</span>{children}</label>; }

function formatTime(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function TrickplayBubble({ preview, onError }: { preview: NonNullable<ReturnType<typeof trickplayPreview>> & { time: number; left: number }; onError: () => void }) {
	const scale = Math.min(1, 180 / preview.width, 110 / preview.height);
	return <div className="pointer-events-none absolute bottom-8 -translate-x-1/2 overflow-hidden rounded-md border border-white/20 bg-black shadow-2xl" style={{ left: `${preview.left * 100}%`, width: preview.width * scale }}>
		<div className="relative overflow-hidden" style={{ height: preview.height * scale }}><img src={preview.url} alt="Timeline preview" onError={onError} className="absolute left-0 top-0 max-w-none" style={{ width: preview.width * preview.columns * scale, height: preview.height * preview.rows * scale, transform: `translate(${-preview.cellX * preview.width * scale}px, ${-preview.cellY * preview.height * scale}px)` }} /></div>
		<span className="block px-2 py-1 text-center text-xs text-white/80">{formatTime(preview.time)}</span>
	</div>;
}
