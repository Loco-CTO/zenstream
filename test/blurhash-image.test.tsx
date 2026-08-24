import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlurHashImage } from "@/components/ui/blurhash-image";
import { toMediaItem, type CatalogItem } from "@/lib/catalog";

describe("BlurHashImage", () => {
	it("renders a decoded blurhash placeholder behind the image", () => {
		const { container } = render(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/poster.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);

		expect(screen.getByRole("img", { name: "Poster" })).toHaveAttribute(
			"src",
			expect.stringContaining("poster.jpg"),
		);
		expect(
			(container.querySelector("div[aria-hidden='true']") as HTMLElement).style
				.backgroundImage,
		).toContain("data:image/svg+xml");
		expect(container.querySelector("div[aria-hidden='true']")).not.toHaveClass(
			"hero-backdrop-active",
		);
	});

	it("clips the placeholder to the artwork bounds", () => {
		const { container } = render(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/missing-poster.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Missing poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);

		const placeholder = container.querySelector("div[aria-hidden='true']");
		expect(placeholder).toHaveClass("[clip-path:inset(0)]");
		expect(placeholder).toHaveClass("opacity-100");
	});

	it("keeps the placeholder visible until the source succeeds", async () => {
		const { container } = render(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/poster.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);

		const placeholder = container.querySelector("div[aria-hidden='true']");
		const image = screen.getByRole("img", { name: "Poster" });
		expect(placeholder).toHaveClass("opacity-100");

		fireEvent.load(image);
		await waitFor(() => expect(placeholder).toHaveClass("opacity-0"));
	});

	it("reports failures and replaces broken artwork with a clipped placeholder", () => {
		const onError = vi.fn();
		const { container } = render(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/missing-poster.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Missing poster"
					className="h-full w-full object-cover"
					onError={onError}
				/>
			</div>,
		);

		fireEvent.error(screen.getByRole("img", { name: "Missing poster" }));
		expect(onError).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("img", { name: "Missing poster" })).toBeNull();
		expect(container.querySelector("div[aria-hidden='true']")).toBeTruthy();
	});

	it("shows the new source's placeholder after an artwork source changes", () => {
		const { container, rerender } = render(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/poster-a.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);
		fireEvent.load(screen.getByRole("img", { name: "Poster" }));

		rerender(
			<div className="relative">
				<BlurHashImage
					image={{
						src: "/poster-b.jpg",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					}}
					alt="Poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);
		expect(container.querySelector("div[aria-hidden='true']")).toHaveClass(
			"opacity-100",
		);
	});

	it("maps canonical artwork hashes to the client image model", () => {
		const item = toMediaItem({
			id: "movie",
			libraryId: "library",
			type: "movie",
			name: "Movie",
			metadata: {
				images: {
					Primary: {
						url: "/api/catalog/items/movie/images/Primary?language=en",
						blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
					},
				},
			},
		} satisfies CatalogItem);

		expect(item.ImageBlurHashes?.Primary).toEqual({
			"/api/catalog/items/movie/images/Primary?language=en":
				"LEHV6nWB2yk8pyo0adR*.7kCMdnj",
		});
	});
});
