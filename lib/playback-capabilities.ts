export type BrowserPlaybackProfile = {
	Type: "Video";
	Container: string;
	VideoCodec: string;
	AudioCodec: string;
};

export type BrowserPlaybackCapabilities = {
	directPlayProfiles: BrowserPlaybackProfile[];
	transcodingVideoCodec: string;
	transcodingAudioCodec: string;
};

type VideoCapabilityProbe = {
	codec: string;
	container: "mp4" | "webm";
	mimes: string[];
};

type AudioCapabilityProbe = {
	codec: string;
	containers: Array<"mp4" | "webm">;
	mimes: string[];
};

	// The order is intentional: retain efficient source codecs when the browser
	// can play them. H.264 is selected separately below for broad HLS support.
const VIDEO_CAPABILITIES: VideoCapabilityProbe[] = [
	{
		codec: "hevc",
		container: "mp4",
		mimes: [
			'video/mp4; codecs="hvc1.1.6.L93.B0"',
			'video/mp4; codecs="hev1.1.6.L93.B0"',
		],
	},
	{
		codec: "av1",
		container: "mp4",
		mimes: ['video/mp4; codecs="av01.0.08M.08"'],
	},
	{
		codec: "h264",
		container: "mp4",
		mimes: [
			'video/mp4; codecs="avc1.42E01E"',
			'video/mp4; codecs="avc1.640028"',
		],
	},
	{
		codec: "vp9",
		container: "webm",
		mimes: ['video/webm; codecs="vp09.00.10.08"'],
	},
	{
		codec: "vp8",
		container: "webm",
		mimes: ['video/webm; codecs="vp8"'],
	},
];

const AUDIO_CAPABILITIES: AudioCapabilityProbe[] = [
	{
		codec: "aac",
		containers: ["mp4"],
		mimes: ['audio/mp4; codecs="mp4a.40.2"'],
	},
	{
		codec: "mp3",
		containers: ["mp4"],
		mimes: ["audio/mpeg"],
	},
	{
		codec: "opus",
		containers: ["webm"],
		mimes: ['audio/webm; codecs="opus"', 'audio/ogg; codecs="opus"'],
	},
	{
		codec: "vorbis",
		containers: ["webm"],
		mimes: ['audio/webm; codecs="vorbis"', 'audio/ogg; codecs="vorbis"'],
	},
	{
		codec: "flac",
		containers: ["mp4", "webm"],
		mimes: ['audio/mp4; codecs="flac"', 'audio/webm; codecs="flac"'],
	},
];

function supportsMimeType(video: Pick<HTMLVideoElement, "canPlayType">, mimes: string[]) {
	return mimes.some((mime) => {
		try {
			return video.canPlayType(mime) !== "";
		} catch {
			return false;
		}
	});
}

function profileContainer(container: "mp4" | "webm") {
	return container === "mp4" ? "mp4,m4v" : "webm";
}

export function browserPlaybackCapabilities(
	video?: Pick<HTMLVideoElement, "canPlayType">,
): BrowserPlaybackCapabilities {
	const probe =
		video ??
		(typeof document === "undefined"
			? { canPlayType: () => "" }
			: document.createElement("video"));
	const supportedVideo = VIDEO_CAPABILITIES.filter((candidate) =>
		supportsMimeType(probe, candidate.mimes),
	);
	const supportedAudio = AUDIO_CAPABILITIES.filter((candidate) =>
		supportsMimeType(probe, candidate.mimes),
	);

	const directPlayProfiles = (["mp4", "webm"] as const)
		.map((container) => {
			const videoCodecs = supportedVideo
				.filter((candidate) => candidate.container === container)
				.map((candidate) => candidate.codec);
			const audioCodecs = supportedAudio
				.filter((candidate) => candidate.containers.includes(container))
				.map((candidate) => candidate.codec);
			if (!videoCodecs.length || !audioCodecs.length) return null;
			return {
				Type: "Video" as const,
				Container: profileContainer(container),
				VideoCodec: videoCodecs.join(","),
				AudioCodec: audioCodecs.join(","),
			};
		})
		.filter((profile): profile is BrowserPlaybackProfile => Boolean(profile));

	const transcodingVideoCodec =
		supportedVideo.find((candidate) => candidate.codec === "h264")?.codec ??
		supportedVideo.find((candidate) => candidate.codec === "hevc")?.codec ??
		supportedVideo[0]?.codec ??
		// If the browser cannot expose a capability table (some embedded webviews
		// do this), H.264 is the safest server-side fallback.
		"h264";
	const transcodingAudioCodec =
		supportedAudio.find((candidate) => candidate.codec === "aac")?.codec ??
		supportedAudio[0]?.codec ??
		"aac";

	return {
		directPlayProfiles,
		transcodingVideoCodec,
		transcodingAudioCodec,
	};
}
