import { describe, expect, it } from "vitest";
import {
	browserDeviceId,
	browserDeviceMetadata,
	browserDeviceProfile,
} from "@/lib/browser-device-profile";

describe("browser playback capabilities", () => {
	it("advertises HEVC only when the browser reports a supported HEVC codec", () => {
		const unsupported = browserDeviceProfile({
			canPlayType: (mime) => (/avc1|audio\/mp4/.test(mime) ? "probably" : ""),
		});
		const supported = browserDeviceProfile({
			canPlayType: (mime) =>
				/hvc1|hev1|avc1|audio\/mp4/.test(mime) ? "probably" : "",
		});

		const unsupportedVideo = unsupported.directPlayProfiles.find(
			(entry) => entry.Type === "Video" && entry.Container === "mp4,m4v",
		);
		const supportedVideo = supported.directPlayProfiles.find(
			(entry) => entry.Type === "Video" && entry.Container === "mp4,m4v",
		);

		expect(unsupportedVideo?.VideoCodec).toBe("h264");
		expect(supportedVideo?.VideoCodec).toBe("hevc,h264");
	});

	it("does not advertise raw MPEG-TS as direct byte-range playback", () => {
		const profile = browserDeviceProfile({ canPlayType: () => "probably" });

		expect(
			profile.directPlayProfiles.some((entry) =>
				entry.Container.split(",").some((container) => container === "ts"),
			),
		).toBe(false);
	});

	it("advertises native MKV when the browser reports MKV support", () => {
		const profile = browserDeviceProfile({ canPlayType: () => "probably" });

		expect(
			profile.directPlayProfiles.some((entry) => entry.Container === "mkv"),
		).toBe(true);
		expect(profile.maxAudioChannels).toBe(6);
	});

	it("uses the audio element to advertise supported music containers", () => {
		const profile = browserDeviceProfile(
			{ canPlayType: () => "" },
			{
				canPlayType: (mime) =>
					/^(audio\/mpeg|audio\/mp4|audio\/aac|audio\/flac|audio\/ogg|audio\/wav|audio\/aiff)/.test(
						mime,
					)
						? "probably"
						: "",
			},
		);

		expect(
			profile.directPlayProfiles
				.filter((entry) => entry.Type === "Audio")
				.map((entry) => entry.Container),
		).toEqual(
			expect.arrayContaining([
				"mp3",
				"m4a,mp4",
				"aac,adts",
				"flac",
				"ogg,oga,opus",
				"wav",
				"aiff,aif",
			]),
		);
	});

	it("accepts the browser's bare FLAC MIME response", () => {
		const profile = browserDeviceProfile(
			{ canPlayType: () => "" },
			{
				canPlayType: (mime) => (mime === "audio/flac" ? "probably" : ""),
			},
		);

		expect(profile.directPlayProfiles).toContainEqual({
			Type: "Audio",
			Container: "flac",
			AudioCodec: "flac",
		});
	});

	it("persists one device identity for the browser login and player", () => {
		const storage = new Map<string, string>();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		});
		const first = browserDeviceMetadata();
		const second = browserDeviceMetadata();

		expect(first.deviceId).toBe(second.deviceId);
		expect(first.deviceId).toBe(browserDeviceId());
		expect(first.deviceType).toBe("browser");
		expect(first.clientName).toBe("ZenStream Web");
		expect(first.clientVersion).toBeTruthy();
	});
});
