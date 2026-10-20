import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateTooltipPosition, Tooltip } from "@/components/ui/tooltip";

describe("global tooltip", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("shows the localized accessible label on hover only and replaces title", async () => {
		render(
			<>
				<Tooltip />
				<button title="お気に入りに追加" aria-label="お気に入りに追加">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const button = screen.getByRole("button", { name: "お気に入りに追加" });

		await act(async () => {
			await Promise.resolve();
		});
		expect(button).not.toHaveAttribute("title");
		expect(button).toHaveAttribute("data-tooltip", "お気に入りに追加");

		fireEvent.focus(button);
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
		fireEvent.pointerOver(button, { pointerType: "touch" });
		act(() => vi.advanceTimersByTime(350));
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => vi.advanceTimersByTime(16));
		expect(screen.getByRole("tooltip")).toHaveTextContent("お気に入りに追加");

		fireEvent.pointerOut(button, { relatedTarget: document.body });
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
	});

	it("flips below near the top and keeps the tooltip inside viewport edges", () => {
		const position = calculateTooltipPosition(
			{ left: 360, top: 4, width: 24, height: 32 },
			{ width: 100, height: 40 },
			{ width: 400, height: 600 },
		);

		expect(position.side).toBe("bottom");
		expect(position.left).toBeGreaterThanOrEqual(8);
		expect(position.left + 100).toBeLessThanOrEqual(392);
		expect(position.top).toBeGreaterThanOrEqual(8);
		expect(position.top + 40).toBeLessThanOrEqual(592);
	});
});
