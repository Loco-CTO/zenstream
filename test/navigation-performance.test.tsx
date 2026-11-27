import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
} from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNavigationPrefetch } from "@/components/layout/use-navigation-prefetch";
import { useRouteScrollRestoration } from "@/components/layout/use-route-scroll-restoration";

const router = vi.hoisted(() => ({ prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
	cleanup();
	window.history.replaceState(null, "", "/");
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	router.prefetch.mockReset();
});

describe("navigation prefetch", () => {
	it("waits for hover intent, cancels on leave, and warms keyboard-focused links", async () => {
		vi.useFakeTimers();
		const prefetch = vi.fn(() => Promise.resolve());
		function Cards() {
			useNavigationPrefetch(prefetch);
			return (
				<>
					<Link prefetch={false} data-prefetch-media href="/show/one">
						One
					</Link>
					<Link prefetch={false} data-prefetch-media href="/show/two">
						Two
					</Link>
				</>
			);
		}
		render(<Cards />);
		const one = screen.getByRole("link", { name: "One" });
		fireEvent.pointerOver(one);
		vi.advanceTimersByTime(60);
		fireEvent.pointerOut(one);
		vi.advanceTimersByTime(120);
		expect(prefetch).not.toHaveBeenCalled();
		fireEvent.focusIn(screen.getByRole("link", { name: "Two" }));
		fireEvent.pointerOut(one);
		await vi.advanceTimersByTimeAsync(120);
		expect(prefetch).toHaveBeenCalledTimes(1);
		expect(router.prefetch).toHaveBeenCalledWith("/show/two");
	});
});

describe("navigation scroll", () => {
	it("waits for a paginated history destination and yields to user input", () => {
		vi.useFakeTimers();
		let scrollY = 0;
		let height = 2600;
		let notifyResize = () => {};
		vi.stubGlobal(
			"ResizeObserver",
			class {
				constructor(callback: () => void) {
					notifyResize = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		vi.spyOn(window, "scrollY", "get").mockImplementation(() => scrollY);
		vi
			.spyOn(document.documentElement, "scrollHeight", "get")
			.mockImplementation(() => height);
		const scrollTo = vi
			.spyOn(window, "scrollTo")
			.mockImplementation((options: unknown) => {
				scrollY = (options as ScrollToOptions).top ?? 0;
			});
		const library = "/library?libraryId=shows";
		const detail = "/show/movie";
		window.history.replaceState(null, "", library);
		const { rerender } = renderHook(
			({ href }) => useRouteScrollRestoration(href, "viewer"),
			{ initialProps: { href: library } },
		);
		const libraryState = window.history.state;
		scrollY = 1400;
		window.dispatchEvent(new Event("scroll"));
		window.history.pushState(null, "", detail);
		rerender({ href: detail });
		expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });

		height = window.innerHeight + 500;
		window.history.replaceState(libraryState, "", library);
		rerender({ href: library });
		window.dispatchEvent(new PopStateEvent("popstate", { state: libraryState }));
		act(() => vi.advanceTimersToNextFrame());
		expect(scrollTo).toHaveBeenLastCalledWith({ top: 500, behavior: "instant" });
		height = window.innerHeight + 2000;
		notifyResize();
		act(() => vi.advanceTimersToNextFrame());
		expect(scrollTo).toHaveBeenLastCalledWith({ top: 1400, behavior: "instant" });

		window.history.pushState(null, "", detail);
		rerender({ href: detail });
		window.history.replaceState(libraryState, "", library);
		window.dispatchEvent(new PopStateEvent("popstate", { state: libraryState }));
		rerender({ href: library });
		scrollTo.mockClear();
		window.dispatchEvent(new WheelEvent("wheel"));
		act(() => vi.advanceTimersToNextFrame());
		expect(scrollTo).not.toHaveBeenCalled();
	});
});
