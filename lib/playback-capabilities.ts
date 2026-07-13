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

export type PlaybackMediaMetadata = {
	container?: string;
	videoCodec?: string;
	audioCodec?: string;
	width?: number;
	height?: number;
	bitrate?: number;
	framerate?: number;
	audioBitrate?: number;
	audioChannels?: number;
	audioSamplerate?: number;
};

export type MediaCapabilityValidation = {
	status: "supported" | "unsupported" | "unknown";
	supported?: boolean;
	smooth?: boolean;
	powerEfficient?: boolean;
	reason?: string;
	configuration?: MediaDecodingConfiguration;
};

export type MediaSourceTypeChecker = {
	isTypeSupported: (contentType: string) => boolean;
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

export function playbackCodecMimeType(
	codec: string | undefined,
	container: string | undefined,
	kind: "audio" | "video",
) {
	if (!codec) return undefined;
	const normalized = codec.trim().toLowerCase();
	if (!normalized) return undefined;
	const codecString = normalized.includes(".")
		? normalized
		: kind === "video"
			? normalized === "h264" || normalized === "avc"
				? "avc1.42e01e"
				: normalized === "hevc" || normalized === "h265"
					? "hvc1.1.6.l93.b0"
					: normalized === "av1"
						? "av01.0.08m.08"
						: normalized === "vp9"
							? "vp09.00.10.08"
							: normalized === "vp8"
								? "vp8"
								: normalized
			: normalized === "aac"
				? "mp4a.40.2"
				: normalized;
	const type = kind === "video"
		? container?.toLowerCase().includes("webm")
			? "video/webm"
			: "video/mp4"
		: container?.toLowerCase().includes("webm")
			? "audio/webm"
			: "audio/mp4";
	return `${type}; codecs="${codecString}"`;
}

export function createMediaDecodingConfiguration(
	metadata: PlaybackMediaMetadata,
	type: "file" | "media-source",
): MediaDecodingConfiguration | null {
	const videoContentType = playbackCodecMimeType(
		metadata.videoCodec,
		metadata.container,
		"video",
	);
	const width = metadata.width;
	const height = metadata.height;
	const bitrate = metadata.bitrate;
	if (
		!videoContentType ||
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		!Number.isFinite(bitrate) ||
		width! <= 0 ||
		height! <= 0 ||
		bitrate! <= 0
	)
		return null;

	const configuration: MediaDecodingConfiguration = {
		type,
		video: {
			contentType: videoContentType,
			width: width!,
			height: height!,
			bitrate: bitrate!,
			framerate:
				Number.isFinite(metadata.framerate) && metadata.framerate! > 0
					? metadata.framerate!
					: 30,
		},
	};
	const audioContentType = playbackCodecMimeType(
		metadata.audioCodec,
		metadata.container,
		"audio",
	);
	if (audioContentType && Number.isFinite(metadata.audioBitrate)) {
		configuration.audio = {
			contentType: audioContentType,
			bitrate: metadata.audioBitrate!,
			...(Number.isFinite(metadata.audioChannels) && metadata.audioChannels! > 0
				? { channels: String(metadata.audioChannels) }
				: {}),
			...(Number.isFinite(metadata.audioSamplerate) && metadata.audioSamplerate! > 0
				? { samplerate: metadata.audioSamplerate! }
				: {}),
		};
	}
	return configuration;
}

export async function validateMediaDecoding(
	metadata: PlaybackMediaMetadata,
	options: {
		type: "file" | "media-source";
		mediaSource?: MediaSourceTypeChecker;
	},
): Promise<MediaCapabilityValidation> {
	const configuration = createMediaDecodingConfiguration(metadata, options.type);
	if (!configuration || !configuration.video)
		return { status: "unknown", reason: "incomplete-media-metadata" };

	const mediaSourceTypes = [
		configuration.video.contentType,
		configuration.audio?.contentType,
	].filter((value): value is string => Boolean(value));
	if (
		options.mediaSource &&
		mediaSourceTypes.some((contentType) => !options.mediaSource!.isTypeSupported(contentType))
	)
		return {
			status: "unsupported",
			reason: "media-source-codec-unsupported",
			configuration,
		};

	if (
		typeof navigator === "undefined" ||
		!navigator.mediaCapabilities ||
		typeof navigator.mediaCapabilities.decodingInfo !== "function"
	)
		return { status: "unknown", reason: "media-capabilities-unavailable", configuration };

	try {
		const result = await navigator.mediaCapabilities.decodingInfo(configuration);
		return {
			status: result.supported && result.smooth ? "supported" : "unsupported",
			supported: result.supported,
			smooth: result.smooth,
			powerEfficient: result.powerEfficient,
			reason: result.supported ? (result.smooth ? undefined : "not-smooth") : "not-supported",
			configuration,
		};
	} catch {
		return { status: "unknown", reason: "media-capabilities-error", configuration };
	}
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
