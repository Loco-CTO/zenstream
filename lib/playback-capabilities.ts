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

export type HevcPlaybackPath = "direct-mp4" | "mse-fmp4" | "native-hls" | "hlsjs-mse";
export type HevcCodecVariant = "hvc1-sdr" | "hvc1-main10" | "hev1" | "hdr10" | "dolby-vision";
export type HevcProbe = {
	path: HevcPlaybackPath;
	variant: HevcCodecVariant;
	mime: string;
	url: string;
	width: number;
	height: number;
	bitrate: number;
	framerate: number;
};

export type HevcCapabilityResolverOptions = {
	video?: HTMLVideoElement;
	mediaSource?: MediaSourceTypeChecker;
	probes?: HevcProbe[];
	probe?: (probe: HevcProbe, video: HTMLVideoElement) => Promise<RenderedVideoFrameValidation>;
};

const HEVC_PROBE_BASE = "/playback-probes/hevc";
export const HEVC_PROBES: HevcProbe[] = [
	["direct-mp4", "hvc1-sdr", "mp4", 1920, 1080, 8_000_000, 30],
	["mse-fmp4", "hvc1-sdr", "fmp4", 1920, 1080, 8_000_000, 30],
	["native-hls", "hvc1-sdr", "m3u8", 1920, 1080, 8_000_000, 30],
	["hlsjs-mse", "hvc1-sdr", "m3u8", 1920, 1080, 8_000_000, 30],
	["direct-mp4", "hvc1-main10", "mp4", 3840, 2160, 18_000_000, 60],
	["direct-mp4", "hev1", "mp4", 1920, 1080, 8_000_000, 30],
	["direct-mp4", "hdr10", "mp4", 3840, 2160, 25_000_000, 60],
	["direct-mp4", "dolby-vision", "mp4", 3840, 2160, 25_000_000, 60],
].map(([path, variant, extension, width, height, bitrate, framerate]) => ({
	path: path as HevcPlaybackPath,
	variant: variant as HevcCodecVariant,
	mime: extension === "m3u8"
		? 'application/vnd.apple.mpegurl; codecs="hvc1.1.6.L120.B0, mp4a.40.2"'
		: `video/mp4; codecs="${variant === "hvc1-main10" ? "hvc1.2.4.L120.B0" : variant === "hev1" ? "hev1.1.6.L120.B0" : variant === "hdr10" ? "hvc1.2.4.L120.B0" : variant === "dolby-vision" ? "dvh1.05.06" : "hvc1.1.6.L120.B0"}, mp4a.40.2"`,
	url: `${HEVC_PROBE_BASE}/${path}-${variant}.${extension}`,
	width: width as number,
	height: height as number,
	bitrate: bitrate as number,
	framerate: framerate as number,
}));

const hevcCapabilityCache = new Map<string, RenderedVideoFrameValidation["status"]>();
export function clearHevcCapabilityCache() { hevcCapabilityCache.clear(); }

export type RenderedVideoFrameValidation = {
	status: "supported" | "unsupported" | "unknown";
	framesPresented?: number;
	pixelsSampled?: boolean;
	reason?: string;
};

type VideoFrameCallbackMetadataLike = {
	mediaTime?: number;
	presentedFrames?: number;
};

type VideoFrameValidationVideo = Pick<
	HTMLVideoElement,
	"currentTime" | "paused" | "readyState" | "videoHeight" | "videoWidth"
> & {
	requestVideoFrameCallback?: (
		callback: (now: number, metadata: VideoFrameCallbackMetadataLike) => void,
	) => number;
	cancelVideoFrameCallback?: (handle: number) => void;
	getVideoPlaybackQuality?: () => { totalVideoFrames?: number };
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
			// `smooth` is a performance hint, not a compatibility result. A
			// browser may report a high-resolution stream as non-smooth while it
			// still decodes and plays it correctly.
			status: result.supported ? "supported" : "unsupported",
			supported: result.supported,
			smooth: result.smooth,
			powerEfficient: result.powerEfficient,
			reason: result.supported ? undefined : "not-supported",
			configuration,
		};
	} catch {
		return { status: "unknown", reason: "media-capabilities-error", configuration };
	}
}

function sampleRenderedVideoPixels(
	video: VideoFrameValidationVideo,
	canvas: HTMLCanvasElement,
): boolean | undefined {
	if (
		typeof document === "undefined" ||
		video.videoWidth <= 0 ||
		video.videoHeight <= 0
	)
		return undefined;
	let context: CanvasRenderingContext2D | null;
	try {
		context = canvas.getContext("2d", { willReadFrequently: true });
	} catch {
		return undefined;
	}
	if (!context) return undefined;
	canvas.width = 32;
	canvas.height = 18;
	try {
		context.drawImage(video as CanvasImageSource, 0, 0, 32, 18);
		const pixels = context.getImageData(0, 0, 32, 18).data;
		let visiblePixels = 0;
		for (let index = 0; index < pixels.length; index += 4) {
			const brightestChannel = Math.max(
				pixels[index] ?? 0,
				pixels[index + 1] ?? 0,
				pixels[index + 2] ?? 0,
			);
			if (brightestChannel > 16) visiblePixels += 1;
		}
		// A single bright compression/noise pixel should not count as a frame.
		return visiblePixels >= pixels.length / 4 * 0.02;
	} catch {
		// Cross-origin media without CORS, protected media, and some embedded
		// browsers make canvas pixel reads unavailable. The frame callback is
		// still a valid decoded-frame signal in that case.
		return undefined;
	}
}

function fallbackRenderedVideoValidation(
	video: VideoFrameValidationVideo,
): RenderedVideoFrameValidation {
	const quality = video.getVideoPlaybackQuality?.();
	if (quality?.totalVideoFrames && quality.totalVideoFrames > 0)
		return {
			status: "supported",
			framesPresented: quality.totalVideoFrames,
			reason: "playback-quality-frames",
		};
	if (video.readyState >= 3 && !video.paused && video.currentTime > 0)
		return { status: "supported", reason: "playback-time-advanced" };
	return { status: "unknown", reason: "frame-api-unavailable" };
}

function validateWithAnimationFrames(
	video: VideoFrameValidationVideo,
	canvas: HTMLCanvasElement,
	options: { maxObservationMs: number; requiredBlackFrames: number },
): Promise<RenderedVideoFrameValidation> | undefined {
	if (typeof requestAnimationFrame !== "function") return undefined;
	return new Promise((resolve) => {
		let settled = false;
		let animationFrame: number | undefined;
		let frameCount = 0;
		let blackFrameCount = 0;
		let firstMediaTime: number | undefined;
		let pixelsSampled = false;
		const finish = (result: RenderedVideoFrameValidation) => {
			if (settled) return;
			settled = true;
			if (animationFrame != null) cancelAnimationFrame(animationFrame);
			resolve({ ...result, framesPresented: frameCount, pixelsSampled });
		};
		const timeout = setTimeout(
			() => finish({ status: "unknown", reason: "frame-observation-timeout" }),
			options.maxObservationMs,
		);
		const observe = () => {
			if (settled) return;
			frameCount += 1;
			const mediaTime = video.currentTime;
			if (firstMediaTime == null) firstMediaTime = mediaTime;
			const pixels = sampleRenderedVideoPixels(video, canvas);
			if (pixels == null) {
				clearTimeout(timeout);
				finish(fallbackRenderedVideoValidation(video));
				return;
			}
			pixelsSampled = true;
			if (pixels) {
				clearTimeout(timeout);
				finish({ status: "supported", reason: "visible-video-frame" });
				return;
			}
			blackFrameCount += 1;
			if (
				blackFrameCount >= options.requiredBlackFrames &&
				mediaTime - (firstMediaTime ?? mediaTime) >= 0.2
			) {
				clearTimeout(timeout);
				finish({ status: "unsupported", reason: "decoded-frames-are-black" });
				return;
			}
			animationFrame = requestAnimationFrame(observe);
		};
		animationFrame = requestAnimationFrame(observe);
	});
}

export function validateRenderedVideoFrame(
	video: VideoFrameValidationVideo,
	options: { maxObservationMs?: number; requiredBlackFrames?: number } = {},
): Promise<RenderedVideoFrameValidation> {
	const requestVideoFrameCallback = video.requestVideoFrameCallback;
	const maxObservationMs = options.maxObservationMs ?? 1500;
	const requiredBlackFrames = options.requiredBlackFrames ?? 6;
	const canvas =
		typeof document === "undefined" ? undefined : document.createElement("canvas");
	if (typeof requestVideoFrameCallback !== "function") {
		const animationFrameValidation = canvas
			? validateWithAnimationFrames(video, canvas, {
					maxObservationMs,
					requiredBlackFrames,
				})
			: undefined;
		return animationFrameValidation ?? Promise.resolve(fallbackRenderedVideoValidation(video));
	}

	return new Promise((resolve) => {
		let settled = false;
		let handle: number | undefined;
		let frameCount = 0;
		let blackFrameCount = 0;
		let firstMediaTime: number | undefined;
		let lastMediaTime: number | undefined;
		let pixelsSampled = false;
		const finish = (result: RenderedVideoFrameValidation) => {
			if (settled) return;
			settled = true;
			if (handle != null) video.cancelVideoFrameCallback?.(handle);
			resolve({ ...result, framesPresented: frameCount, pixelsSampled });
		};
		const timeout = setTimeout(
			() => finish({ status: "unknown", reason: "frame-observation-timeout" }),
			maxObservationMs,
		);
		const observe = (now: number, metadata: VideoFrameCallbackMetadataLike) => {
			void now;
			if (settled) return;
			frameCount += 1;
			const mediaTime = Number.isFinite(metadata.mediaTime)
				? metadata.mediaTime
				: video.currentTime;
			if (firstMediaTime == null) firstMediaTime = mediaTime;
			lastMediaTime = mediaTime;
			if (!canvas) {
				clearTimeout(timeout);
				finish({ status: "supported", reason: "video-frame-presented" });
				return;
			}
			const pixels = sampleRenderedVideoPixels(video, canvas);
			if (pixels == null) {
				clearTimeout(timeout);
				finish({ status: "supported", reason: "video-frame-presented" });
				return;
			}
			pixelsSampled = true;
			if (pixels) {
				clearTimeout(timeout);
				finish({ status: "supported", reason: "visible-video-frame" });
				return;
			}
			blackFrameCount += 1;
			const mediaTimeAdvanced =
				lastMediaTime != null && firstMediaTime != null
					? lastMediaTime - firstMediaTime >= 0.2
					: false;
			if (blackFrameCount >= requiredBlackFrames && mediaTimeAdvanced) {
				clearTimeout(timeout);
				finish({ status: "unsupported", reason: "decoded-frames-are-black" });
				return;
			}
			try {
				handle = requestVideoFrameCallback(observe);
			} catch {
				clearTimeout(timeout);
				finish({ status: "unknown", reason: "frame-callback-error" });
			}
		};
		try {
			handle = requestVideoFrameCallback(observe);
		} catch {
			clearTimeout(timeout);
			finish({ status: "unknown", reason: "frame-callback-error" });
		}
	});
}

async function runHevcProbe(probe: HevcProbe, video: HTMLVideoElement) {
	video.crossOrigin = "anonymous";
	video.muted = true;
	video.playsInline = true;
	video.src = probe.url;
	video.load();
	try { await video.play(); } catch { return { status: "unknown" as const, reason: "probe-play-failed" }; }
	return validateRenderedVideoFrame(video, { maxObservationMs: 2500, requiredBlackFrames: 4 });
}

export async function qualifyHevc(
	probe: HevcProbe,
	options: HevcCapabilityResolverOptions = {},
): Promise<RenderedVideoFrameValidation> {
	const video = options.video ?? (typeof document === "undefined" ? undefined : document.createElement("video"));
	if (!video) return { status: "unknown", reason: "video-api-unavailable" };
	try {
		if (!video.canPlayType(probe.mime)) return { status: "unsupported", reason: "can-play-type-unsupported" };
	} catch { return { status: "unknown", reason: "can-play-type-error" }; }
	if (options.mediaSource && !options.mediaSource.isTypeSupported(probe.mime))
		return { status: "unsupported", reason: "media-source-codec-unsupported" };
	if (typeof navigator !== "undefined" && navigator.mediaCapabilities?.decodingInfo) {
		try {
			const result = await navigator.mediaCapabilities.decodingInfo({
				type: probe.path === "mse-fmp4" || probe.path === "hlsjs-mse" ? "media-source" : "file",
				video: { contentType: probe.mime, width: probe.width, height: probe.height, bitrate: probe.bitrate, framerate: probe.framerate },
			});
			if (!result.supported) return { status: "unsupported", reason: "not-supported" };
		} catch { /* The real probe remains authoritative. */ }
	}
	return (options.probe ?? runHevcProbe)(probe, video);
}

export async function resolveHevcCapabilities(
	options: HevcCapabilityResolverOptions = {},
): Promise<Set<HevcPlaybackPath>> {
	const supported = new Set<HevcPlaybackPath>();
	const probes = options.probes ?? HEVC_PROBES;
	await Promise.all(probes.map(async (probe) => {
		const key = `${probe.path}:${probe.variant}:${probe.width}x${probe.height}@${probe.framerate}`;
		let status = hevcCapabilityCache.get(key);
		if (!status) {
			status = (await qualifyHevc(probe, options)).status;
			if (status !== "unknown") hevcCapabilityCache.set(key, status);
		}
		if (status === "supported") supported.add(probe.path);
	}));
	return supported;
}

export function browserPlaybackCapabilities(
	video?: Pick<HTMLVideoElement, "canPlayType">,
	options: { hevcPaths?: ReadonlySet<HevcPlaybackPath> } = {},
): BrowserPlaybackCapabilities {
	const probe =
		video ??
		(typeof document === "undefined"
			? { canPlayType: () => "" }
			: document.createElement("video"));
	const supportedVideo = VIDEO_CAPABILITIES.filter((candidate) =>
		supportsMimeType(probe, candidate.mimes),
	).filter((candidate) => candidate.codec !== "hevc" || Boolean(options.hevcPaths?.size));
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
