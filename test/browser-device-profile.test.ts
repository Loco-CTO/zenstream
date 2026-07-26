import { describe, expect, it } from "vitest";
import { browserDeviceProfile } from "@/lib/browser-device-profile";

describe("browser playback capabilities", () => {
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
});
