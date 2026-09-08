import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpandableDescription } from "@/components/ui/expandable-description";

describe("ExpandableDescription", () => {
	it("keeps short descriptions without a toggle", async () => {
		render(<ExpandableDescription description="A short description." />);
		const text = screen.getByText("A short description.");
		Object.defineProperties(text, {
			clientHeight: { configurable: true, value: 72 },
			scrollHeight: { configurable: true, value: 72 },
		});
		window.dispatchEvent(new Event("resize"));

		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Show more" }),
			).not.toBeInTheDocument(),
		);
	});

	it("expands overflowing descriptions and can collapse them again", async () => {
		const description =
			"This description is long enough to continue past the two-line preview.";
		render(<ExpandableDescription description={description} />);
		const text = screen.getByText(description);
		Object.defineProperties(text, {
			clientHeight: { configurable: true, value: 72 },
			scrollHeight: { configurable: true, value: 96 },
		});
		window.dispatchEvent(new Event("resize"));

		const showMore = await screen.findByRole("button", { name: "Show more" });
		expect(showMore).toHaveAttribute("aria-expanded", "false");
		expect(showMore).toHaveAttribute("aria-controls");
		expect(text).toHaveClass("line-clamp-2");

		fireEvent.click(showMore);
		expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute(
			"aria-expanded",
			"true",
		);
		expect(text).not.toHaveClass("line-clamp-2");

		fireEvent.click(screen.getByRole("button", { name: "Show less" }));
		expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});
});
