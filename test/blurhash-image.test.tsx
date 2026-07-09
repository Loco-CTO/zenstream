import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlurHashImage } from "@/components/ui/blurhash-image";

describe("BlurHashImage", () => {
	it("renders a decoded blurhash placeholder behind the image", () => {
		const { container } = render(
			<div className="relative">
				<BlurHashImage
					image={{ src: "/poster.jpg", blurHash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj" }}
					alt="Poster"
					className="h-full w-full object-cover"
				/>
			</div>,
		);

		expect(screen.getByRole("img", { name: "Poster" })).toHaveAttribute(
			"src",
			"/poster.jpg",
		);
		expect(container.querySelector("img[aria-hidden='true']")).toHaveAttribute(
			"src",
			expect.stringMatching(/^data:image\/svg\+xml,/),
		);
	});
});
