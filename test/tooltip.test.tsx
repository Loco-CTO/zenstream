import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateTooltipPosition, Tooltip } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";

describe("global tooltip", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

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

	it("localizes known player labels for the active locale", () => {
		render(
			<I18nProvider locale="ja">
				<Tooltip />
				<button aria-label="Skip back 10 seconds">
					<svg aria-hidden="true" />
				</button>
			</I18nProvider>,
		);
		const button = screen.getByRole("button", {
			name: "Skip back 10 seconds",
		});

		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => vi.advanceTimersByTime(16));
		expect(screen.getByRole("tooltip")).toHaveTextContent("10秒戻る");
	});

	it("migrates titles from inserted icon buttons and tracks active label changes", async () => {
		render(
			<>
				<Tooltip />
				<div data-testid="tooltip-host" />
			</>,
		);
		const host = screen.getByTestId("tooltip-host");
		host.setAttribute("aria-label", "ignored container label");
		const button = document.createElement("button");
		button.title = "Play";
		button.appendChild(document.createElement("svg"));
		host.appendChild(button);

		await act(async () => {
			await Promise.resolve();
		});
		expect(button).not.toHaveAttribute("title");
		expect(button).toHaveAttribute("aria-label", "Play");
		expect(button).toHaveAttribute("data-tooltip", "Play");

		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => vi.advanceTimersByTime(16));
		expect(screen.getByRole("tooltip")).toHaveTextContent("Play");

		button.title = "Pause";
		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.getByRole("tooltip")).toHaveTextContent("Pause");

		button.removeAttribute("data-tooltip");
		button.removeAttribute("aria-label");
		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

		button.remove();
		await act(async () => {
			await Promise.resolve();
		});
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
	});

	it("ignores unlabeled buttons and clears blank native titles", async () => {
		render(
			<>
				<Tooltip />
				<button data-testid="plain-button">Save</button>
				<button data-testid="blank-title" title=" ">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const blankTitleButton = screen.getByTestId("blank-title");
		await act(async () => {
			await Promise.resolve();
		});
		expect(blankTitleButton).not.toHaveAttribute("title");
		expect(blankTitleButton).not.toHaveAttribute("data-tooltip");

		fireEvent.pointerOver(screen.getByTestId("plain-button"), {
			pointerType: "mouse",
		});
		act(() => vi.advanceTimersByTime(350));
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
	});

	it("keeps a tooltip steady while the pointer moves within its button", () => {
		render(
			<>
				<Tooltip />
				<button aria-label="Play">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const button = screen.getByRole("button", { name: "Play" });
		const icon = button.querySelector("svg");
		if (!icon)
			throw new Error("expected the icon-only button to contain an icon");

		fireEvent.pointerOver(icon, {
			pointerType: "mouse",
			relatedTarget: button,
		});
		act(() => vi.advanceTimersByTime(350));
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => vi.advanceTimersByTime(16));
		const tooltip = screen.getByRole("tooltip");
		fireEvent.pointerOut(button, { relatedTarget: icon });
		expect(tooltip).toBeInTheDocument();

		fireEvent.pointerOut(button, { relatedTarget: document.body });
		expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
	});

	it("uses timeout frames and cancels a pending fallback update", () => {
		vi.stubGlobal("requestAnimationFrame", undefined);
		vi.stubGlobal("cancelAnimationFrame", undefined);
		const clearTimeout = vi.spyOn(window, "clearTimeout");
		const view = render(
			<>
				<Tooltip />
				<button aria-label="Play">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const button = screen.getByRole("button", { name: "Play" });
		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => fireEvent.scroll(window));
		expect(clearTimeout).toHaveBeenCalledTimes(1);
		view.unmount();
		expect(clearTimeout).toHaveBeenCalledTimes(3);
	});

	it("cancels queued animation-frame updates when rescheduled and unmounted", () => {
		let nextFrame = 0;
		const pendingFrames = new Map<number, FrameRequestCallback>();
		const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			const frame = ++nextFrame;
			pendingFrames.set(frame, callback);
			return frame;
		});
		const cancelAnimationFrame = vi.fn((frame: number) => {
			pendingFrames.delete(frame);
		});
		vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
		vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);
		const view = render(
			<>
				<Tooltip />
				<button aria-label="Play">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const button = screen.getByRole("button", { name: "Play" });
		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		act(() => fireEvent.scroll(window));
		expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
		expect(cancelAnimationFrame).toHaveBeenCalledWith(1);

		view.unmount();
		expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
	});

	it("hides a tooltip when its anchor is outside the viewport", () => {
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn((callback: FrameRequestCallback) => {
				callback(0);
				return 1;
			}),
		);
		render(
			<>
				<Tooltip />
				<button aria-label="Play">
					<svg aria-hidden="true" />
				</button>
			</>,
		);
		const button = screen.getByRole("button", { name: "Play" });
		vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
			x: 20,
			y: -40,
			width: 20,
			height: 20,
			left: 20,
			top: -40,
			right: 40,
			bottom: -20,
			toJSON: () => ({}),
		});

		fireEvent.pointerOver(button, { pointerType: "mouse" });
		act(() => vi.advanceTimersByTime(350));
		const tooltip = document.querySelector('[role="tooltip"]');
		if (!tooltip)
			throw new Error("expected the hidden tooltip to remain mounted");
		expect(tooltip).toHaveStyle({ visibility: "hidden" });
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
