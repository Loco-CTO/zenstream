import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { clearMediaClientSession } from "@/lib/media-api";
import { clearPreferenceCache } from "@/lib/preferences";
import { clearStoredSubtitleStyle } from "@/lib/subtitle-preferences";

afterEach(() => {
	clearMediaClientSession();
	clearPreferenceCache();
	clearStoredSubtitleStyle();
});

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
	usePathname: () => "/",
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/image", () => ({
	__esModule: true,
	default: (props: any) => {
		const { src, alt, ...rest } = props;
		const resolvedSrc =
			typeof src === "string"
				? src
				: src && typeof src === "object"
					? src.src
					: "";
		return <img {...rest} src={resolvedSrc} alt={alt ?? ""} />;
	},
}));

Object.defineProperty(window, "matchMedia", {
	configurable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: true,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});
