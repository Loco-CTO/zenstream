import { zenstreamVersion } from "@/lib/version";

export type BrowserPlaybackProfile = {
	Type: "Video";
	Container: string;
	VideoCodec: string;
	AudioCodec: string;
};

export type BrowserDeviceProfile = {
	directPlayProfiles: BrowserPlaybackProfile[];
	transcodingProfiles: BrowserPlaybackProfile[];
	maxAudioChannels: number;
	subtitleProfiles: Array<{
		Format: string;
		Method: "External";
		DeliveryMethod: "External";
	}>;
};

export type BrowserDeviceMetadata = {
	deviceId: string;
	deviceType: "browser";
	browser: string;
	operatingSystem: string;
	deviceName: string;
	clientName: "ZenStream Web";
	clientVersion: string;
};

const DEVICE_ID_KEY = "zenstream.device-id";

function browserName(userAgent: string) {
	if (/Edg\//i.test(userAgent)) return "Edge";
	if (/OPR\//i.test(userAgent)) return "Opera";
	if (/Firefox\//i.test(userAgent)) return "Firefox";
	if (/Chrome\//i.test(userAgent)) return "Chrome";
	if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent))
		return "Safari";
	return "Unknown browser";
}

function operatingSystem(userAgent: string) {
	if (/Windows NT/i.test(userAgent)) return "Windows";
	if (/Android/i.test(userAgent)) return "Android";
	if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
	if (/Mac OS X/i.test(userAgent)) return "macOS";
	if (/Linux/i.test(userAgent)) return "Linux";
	return "Unknown OS";
}

export function browserDeviceId() {
	if (typeof window === "undefined") return "browser-server";
	try {
		const existing = window.localStorage.getItem(DEVICE_ID_KEY);
		if (existing) return existing;
		const generated =
			typeof window.crypto?.randomUUID === "function"
				? window.crypto.randomUUID()
				: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
		window.localStorage.setItem(DEVICE_ID_KEY, generated);
		return generated;
	} catch {
		return "browser-ephemeral";
	}
}

export function browserDeviceMetadata(): BrowserDeviceMetadata {
	const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
	const browser = browserName(userAgent);
	const os = operatingSystem(userAgent);
	return {
		deviceId: browserDeviceId(),
		deviceType: "browser",
		browser,
		operatingSystem: os,
		deviceName: `${browser} on ${os}`,
		clientName: "ZenStream Web",
		clientVersion: zenstreamVersion,
	};
}

type VideoElementLike = Pick<HTMLVideoElement, "canPlayType">;

function supports(video: VideoElementLike, mime: string) {
	try {
		return Boolean(video.canPlayType(mime).replace(/no/, ""));
	} catch {
		return false;
	}
}

function supportsVideoAudio(video: VideoElementLike, audioCodec: string) {
	return (
		supports(video, `video/mp4; codecs="avc1.640029, ${audioCodec}"`) ||
		supports(video, `video/mp4; codecs="avc1.640029, mp4a.${audioCodec}"`)
	);
}

function isIos() {
	if (typeof navigator === "undefined") return false;
	return (
		/iPad|iPhone|iPod/i.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

function isWindowsChromium() {
	if (typeof navigator === "undefined") return false;
	const userAgent = navigator.userAgent;
	return (
		/Windows NT/i.test(userAgent) &&
		/(?:Chrome|Chromium|Edg)\//i.test(userAgent) &&
		!/Firefox|OPR\//i.test(userAgent)
	);
}

export function shouldUseHlsJs() {
	if (typeof window === "undefined") return false;
	// Use platform HLS on iOS and MSE/hls.js where the browser supports it.
	// on capable Chromium and Android paths.
	return !isIos() && window.MediaSource != null;
}

export function browserDeviceProfile(
	video: VideoElementLike = typeof document === "undefined"
		? { canPlayType: () => "" }
		: document.createElement("video"),
): BrowserDeviceProfile {
	const mp4Video = [
		...(supports(video, 'video/mp4; codecs="hvc1"') ||
		supports(video, 'video/mp4; codecs="hvc1.1.L120"') ||
		supports(video, 'video/mp4; codecs="hvc1.1.0.L120"') ||
		supports(video, 'video/mp4; codecs="hev1"') ||
		supports(video, 'video/mp4; codecs="hev1.1.L120"') ||
		supports(video, 'video/mp4; codecs="hev1.1.0.L120"')
			? ["hevc"]
			: []),
		...(supports(video, 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
			? ["h264"]
			: []),
		...(supports(video, 'video/mp4; codecs="av01.0.08M.08"') ? ["av1"] : []),
	];
	const webmVideo = [
		...(supports(video, 'video/webm; codecs="vp09.00.10.08"') ? ["vp9"] : []),
		...(supports(video, 'video/webm; codecs="vp8"') ? ["vp8"] : []),
	];
	const aac = supports(video, 'audio/mp4; codecs="mp4a.40.2"');
	const mp4Audio = [
		...(aac && supportsVideoAudio(video, "40.2") ? ["aac"] : []),
		...(supportsVideoAudio(video, "69") || supportsVideoAudio(video, "mp3")
			? ["mp3"]
			: []),
		...(supportsVideoAudio(video, "opus") ? ["opus"] : []),
		...(supportsVideoAudio(video, "vorbis") ? ["vorbis"] : []),
		...(supportsVideoAudio(video, "flac") ? ["flac"] : []),
		...(supportsVideoAudio(video, "ac-3") ? ["ac3"] : []),
		...(supportsVideoAudio(video, "ec-3") ? ["eac3"] : []),
	];
	const canPlayMkv =
		supports(video, "video/x-matroska") ||
		supports(video, "video/mkv") ||
		// Chromium on Windows can decode MKV/HEVC through the platform media
		// stack while returning an empty result for the generic Matroska MIME.
		// This is the same narrowly-scoped fallback Jellyfin uses for this case;
		// an actual media error still has the normal single fallback path.
		isWindowsChromium();
	const webmAudio = [
		...(supports(video, 'audio/webm; codecs="opus"') ? ["opus"] : []),
		...(supports(video, 'audio/webm; codecs="vorbis"') ? ["vorbis"] : []),
	];
	const directPlayProfiles: BrowserPlaybackProfile[] = [];
	if (mp4Video.length && mp4Audio.length)
		directPlayProfiles.push({
			Type: "Video",
			Container: "mp4,m4v",
			VideoCodec: mp4Video.join(","),
			AudioCodec: mp4Audio.join(","),
		});
	if (canPlayMkv && mp4Video.length && mp4Audio.length)
		directPlayProfiles.push({
			Type: "Video",
			Container: "mkv",
			VideoCodec: mp4Video.join(","),
			AudioCodec: mp4Audio.join(","),
		});
	if (mp4Video.includes("h264") && mp4Audio.length)
		directPlayProfiles.push({
			Type: "Video",
			Container: "mov",
			VideoCodec: "h264",
			AudioCodec: mp4Audio.join(","),
		});
	if (webmVideo.length && webmAudio.length)
		directPlayProfiles.push({
			Type: "Video",
			Container: "webm",
			VideoCodec: webmVideo.join(","),
			AudioCodec: webmAudio.join(","),
		});
	return {
		directPlayProfiles,
		// Modern desktop browsers can decode and downmix multichannel AAC/Opus
		// without requiring an audio conversion. Keep this aligned with Jellyfin's
		// browser profile instead of forcing every 5.1 source through FFmpeg.
		maxAudioChannels: 6,
		// Subtitles are fetched as VTT by the custom overlay. Explicitly telling
		// Delivering them externally prevents a transcoded HLS source
		// from burning the same cue into the video as well.
		subtitleProfiles: [
			{
				Format: "vtt",
				Method: "External",
				DeliveryMethod: "External",
			},
		],
		// Always keep this conservative profile. It is the one used after a real
		// native-media or hls.js failure, independent of any direct-play result.
		transcodingProfiles: [
			{
				Type: "Video",
				Container: "ts",
				VideoCodec: "h264",
				AudioCodec: "aac",
			},
		],
	};
}
