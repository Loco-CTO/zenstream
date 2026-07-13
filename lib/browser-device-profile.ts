export type BrowserPlaybackProfile = {
	Type: "Video";
	Container: string;
	VideoCodec: string;
	AudioCodec: string;
};

export type BrowserDeviceProfile = {
	directPlayProfiles: BrowserPlaybackProfile[];
	transcodingProfiles: BrowserPlaybackProfile[];
};

type VideoElementLike = Pick<HTMLVideoElement, "canPlayType">;

function supports(video: VideoElementLike, mime: string) {
	try {
		return Boolean(video.canPlayType(mime).replace(/no/, ""));
	} catch {
		return false;
	}
}

function isIos() {
	if (typeof navigator === "undefined") return false;
	return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
		(navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function shouldUseHlsJs() {
	if (typeof window === "undefined") return false;
	// This follows Jellyfin Web's default: use native HLS on iOS, and MSE/hls.js
	// on capable Chromium and Android paths.
	return !isIos() && window.MediaSource != null;
}

export function browserDeviceProfile(
	video: VideoElementLike = typeof document === "undefined"
		? { canPlayType: () => "" }
		: document.createElement("video"),
): BrowserDeviceProfile {
	const mp4Video = [
		...(supports(video, 'video/mp4; codecs="hvc1.1.L120"') ||
			supports(video, 'video/mp4; codecs="hev1.1.L120"') ? ["hevc"] : []),
		...(supports(video, 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"') ? ["h264"] : []),
		...(supports(video, 'video/mp4; codecs="av01.0.08M.08"') ? ["av1"] : []),
	];
	const webmVideo = [
		...(supports(video, 'video/webm; codecs="vp09.00.10.08"') ? ["vp9"] : []),
		...(supports(video, 'video/webm; codecs="vp8"') ? ["vp8"] : []),
	];
	const aac = supports(video, 'audio/mp4; codecs="mp4a.40.2"');
	const webmAudio = [
		...(supports(video, 'audio/webm; codecs="opus"') ? ["opus"] : []),
		...(supports(video, 'audio/webm; codecs="vorbis"') ? ["vorbis"] : []),
	];
	const hls = supports(video, "application/x-mpegURL") ||
		supports(video, "application/vnd.apple.mpegURL") || shouldUseHlsJs();
	const directPlayProfiles: BrowserPlaybackProfile[] = [];
	if (mp4Video.length && aac) directPlayProfiles.push({
		Type: "Video", Container: "mp4,m4v", VideoCodec: mp4Video.join(","), AudioCodec: "aac",
	});
	if (webmVideo.length && webmAudio.length) directPlayProfiles.push({
		Type: "Video", Container: "webm", VideoCodec: webmVideo.join(","), AudioCodec: webmAudio.join(","),
	});
	const hlsVideo = mp4Video.filter((codec) => codec === "h264" || codec === "hevc");
	if (hls && aac && hlsVideo.length) directPlayProfiles.push({
		Type: "Video", Container: "ts", VideoCodec: hlsVideo.join(","), AudioCodec: "aac",
	});

	return {
		directPlayProfiles,
		// Always keep this conservative profile. It is the one used after a real
		// native-media or hls.js failure, independent of any direct-play result.
		transcodingProfiles: [{
			Type: "Video", Container: "ts", VideoCodec: "h264", AudioCodec: "aac",
		}],
	};
}
