import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaRow } from "@/components/home/media-row";
import type { MediaItem } from "@/lib/media-api";

const items = [
	{ Id: "item-1", Name: "First title", Type: "Movie" },
	{ Id: "item-2", Name: "Second title", Type: "Movie" },
] as MediaItem[];

function renderRow() {
	render(<MediaRow title="Popular" items={items} variant="wide" />);
	const scroller = screen
		.getByText("First title")
		.closest("article")?.parentElement;
	if (!scroller) throw new Error("Media scroller was not rendered");

	scroller.setPointerCapture = vi.fn();
	scroller.releasePointerCapture = vi.fn();
	scroller.scrollBy = vi.fn();
	Object.defineProperty(scroller, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperties(scroller, {
		clientWidth: { configurable: true, value: 500 },
		scrollWidth: { configurable: true, value: 1000 },
	});
	fireEvent.scroll(scroller);
	return scroller;
}

function pointerEvent(type: string, properties: Record<string, unknown>) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.assign(event, properties);
	return event;
}

describe("MediaRow scrolling", () => {
	it("only shows navigation buttons when more content exists in that direction", async () => {
		const scroller = renderRow();

		await waitFor(() => {
			expect(
				screen.queryByRole("button", { name: "Scroll Popular left" }),
			).not.toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Scroll Popular right" }),
			).toBeInTheDocument();
		});

		scroller.scrollLeft = 250;
		fireEvent.scroll(scroller);
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Scroll Popular left" }),
			).toBeInTheDocument();
			expect(
				screen.getByRole("button", { name: "Scroll Popular right" }),
			).toBeInTheDocument();
		});

		scroller.scrollLeft = 500;
		fireEvent.scroll(scroller);
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Scroll Popular left" }),
			).toBeInTheDocument();
			expect(
				screen.queryByRole("button", { name: "Scroll Popular right" }),
			).not.toBeInTheDocument();
		});

		scroller.scrollLeft = 3;
		fireEvent.scroll(scroller);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Scroll Popular left" }),
			).not.toBeInTheDocument(),
		);

		scroller.scrollLeft = 497;
		fireEvent.scroll(scroller);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Scroll Popular right" }),
			).not.toBeInTheDocument(),
		);
	});

	it("uses native smooth scrolling from the navigation buttons without intercepting wheel input", async () => {
		const scroller = renderRow();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Scroll Popular right" }),
			).toBeInTheDocument(),
		);

		fireEvent.click(screen.getByRole("button", { name: "Scroll Popular right" }));
		expect(scroller.scrollTo).toHaveBeenCalledWith({
			left: 360,
			behavior: "smooth",
		});

		const wheel = new WheelEvent("wheel", {
			bubbles: true,
			cancelable: true,
			deltaY: 120,
		});
		scroller.dispatchEvent(wheel);
		expect(wheel.defaultPrevented).toBe(false);
		expect(scroller.scrollBy).not.toHaveBeenCalled();
	});

	it("uses native smooth scrolling with the keyboard arrow keys", async () => {
		const scroller = renderRow();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Scroll Popular right" }),
			).toBeInTheDocument(),
		);

		fireEvent.keyDown(scroller, { key: "ArrowRight" });
		expect(scroller.scrollTo).toHaveBeenLastCalledWith({
			left: 360,
			behavior: "smooth",
		});

		fireEvent.keyDown(scroller, { key: "ArrowLeft" });
		expect(scroller.scrollTo).toHaveBeenLastCalledWith({
			left: 0,
			behavior: "smooth",
		});
	});

	it("cancels pending drag movement when an arrow key takes over", async () => {
		const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame");
		const scroller = renderRow();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "Scroll Popular right" }),
			).toBeInTheDocument(),
		);
		scroller.scrollLeft = 100;
		const cardLink = screen.getByRole("link", { name: /First title/ });

		fireEvent(
			cardLink,
			pointerEvent("pointerdown", {
				button: 0,
				clientX: 200,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);
		fireEvent(
			scroller,
			pointerEvent("pointermove", {
				clientX: 150,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);
		fireEvent.keyDown(scroller, { key: "ArrowRight" });

		expect(cancelAnimationFrame).toHaveBeenCalled();
		expect(scroller.scrollTo).toHaveBeenCalledWith({
			left: 460,
			behavior: "smooth",
		});

		cancelAnimationFrame.mockRestore();
	});

	it("eases pointer dragging and prevents the click after a drag", () => {
		const animationFrames: FrameRequestCallback[] = [];
		const requestAnimationFrame = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				animationFrames.push(callback);
				return animationFrames.length;
			});
		const scroller = renderRow();
		act(() => {
			while (animationFrames.length) animationFrames.shift()?.(0);
		});
		scroller.scrollLeft = 100;
		const cardLink = screen.getByRole("link", { name: /First title/ });

		expect(cardLink).toHaveAttribute("draggable", "false");

		fireEvent(
			cardLink,
			pointerEvent("pointerdown", {
				button: 0,
				clientX: 200,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);
		fireEvent(
			scroller,
			pointerEvent("pointermove", {
				clientX: 150,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);

		expect(scroller.scrollLeft).toBe(100);
		act(() => animationFrames.shift()?.(0));
		expect(scroller.scrollLeft).toBe(114);
		expect(scroller.setPointerCapture).toHaveBeenCalledWith(7);

		fireEvent(
			scroller,
			pointerEvent("pointerup", { pointerId: 7, pointerType: "mouse" }),
		);
		expect(scroller.releasePointerCapture).toHaveBeenCalledWith(7);

		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		screen.getByText("First title").dispatchEvent(click);
		expect(click.defaultPrevented).toBe(true);

		requestAnimationFrame.mockRestore();
	});

	it("does not capture a card click when the pointer has not dragged", () => {
		const scroller = renderRow();
		const cardLink = screen.getByRole("link", { name: /First title/ });

		fireEvent(
			cardLink,
			pointerEvent("pointerdown", {
				button: 0,
				clientX: 200,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);
		fireEvent(
			cardLink,
			pointerEvent("pointerup", {
				clientX: 200,
				pointerId: 7,
				pointerType: "mouse",
			}),
		);
		let preventedByScroller = false;
		cardLink.addEventListener(
			"click",
			(event) => {
				preventedByScroller = event.defaultPrevented;
				event.preventDefault();
			},
			{ once: true },
		);
		const click = new MouseEvent("click", { bubbles: true, cancelable: true });
		cardLink.dispatchEvent(click);

		expect(scroller.setPointerCapture).not.toHaveBeenCalled();
		expect(preventedByScroller).toBe(false);
		expect(cardLink).toHaveAttribute("href", "/show/item-1");
	});

	it("prevents media from starting a native browser drag", () => {
		renderRow();
		const mediaLink = screen.getByRole("link", { name: /First title/ });
		const dragStart = new Event("dragstart", {
			bubbles: true,
			cancelable: true,
		});

		mediaLink.dispatchEvent(dragStart);

		expect(dragStart.defaultPrevented).toBe(true);
	});
});
