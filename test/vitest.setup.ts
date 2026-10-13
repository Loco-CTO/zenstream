import "@testing-library/jest-dom/vitest";
import { createElement, type ImgHTMLAttributes } from "react";
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
	default: (props: {
		src?: unknown;
		alt?: string;
		loader?: (params: { src: string; width: number }) => string;
		unoptimized?: boolean;
		fill?: boolean;
		quality?: number;
		[key: string]: unknown;
	}) => {
		const { src, alt, loader, unoptimized, ...rest } = props;
		delete rest.fill;
		delete rest.quality;
		const resolvedSrc =
			typeof src === "string"
				? src
				: src &&
					  typeof src === "object" &&
					  "src" in src &&
					  typeof src.src === "string"
					? src.src
					: "";
		const widths = [128, 256, 384];
		const resolvedSrcSet =
			loader && !unoptimized
				? widths
						.map((width) => `${loader({ src: resolvedSrc, width })} ${width}w`)
						.join(", ")
				: undefined;
		const displaySrc =
			loader && !unoptimized
				? loader({ src: resolvedSrc, width: widths[widths.length - 1] })
				: resolvedSrc;
		return createElement("img", {
			...rest,
			src: displaySrc,
			srcSet: resolvedSrcSet,
			alt: alt ?? "",
		} as ImgHTMLAttributes<HTMLImageElement>);
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
