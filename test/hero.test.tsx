import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/home/hero";
import {
	PlaybackBehaviorPreferencesProvider,
	playbackBehaviorStorageKey,
	usePlaybackBehaviorPreferences,
} from "@/components/playback-behavior-preferences-provider";
import * as mediaApi from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

const session = { token: "token", userId: "user", username: "Alex" };
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function installLocalStorage() {
	const storage = new Map<string, string>();
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		value: {
			getItem: (key: string) => storage.get(key) ?? null,
			setItem: (key: string, value: string) => storage.set(key, value),
			removeItem: (key: string) => storage.delete(key),
			clear: () => storage.clear(),
		},
	});
}

beforeEach(() => {
	installLocalStorage();
	window.localStorage.removeItem(playbackBehaviorStorageKey(session.userId));
});

afterEach(() => {
	window.localStorage.removeItem(playbackBehaviorStorageKey(session.userId));
	vi.useRealTimers();
	vi.restoreAllMocks();
});

function HeroPreferenceHarness({ items }: { items: MediaItem[] }) {
	const { useHeroTrailer, setUseHeroTrailer } = usePlaybackBehaviorPreferences();
	return (
		<>
			<button
				type="button"
				role="switch"
				aria-label="Use trailers in hero"
				aria-checked={useHeroTrailer}
				onClick={() => setUseHeroTrailer(!useHeroTrailer)}
			/>
			<Hero items={items} session={session} />
		</>
	);
}

describe("Hero", () => {
	it("constrains long titles so they cannot overrun the hero", () => {
		const item: MediaItem = {
			Id: "long-title",
			Name: "隣の美少女が、昔男の子と思って一緒に遊んだ幼馴染だった件",
			Overview: "A long overview for the selected item.",
			ImageTags: {
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		const heading = screen.getByRole("heading", { level: 1, name: item.Name });

		expect(heading).toHaveClass("line-clamp-3");
		expect(heading).toHaveClass("[overflow-wrap:anywhere]");
		expect(heading).toHaveClass("text-[clamp(1.5rem,5vw,3rem)]");
		expect(heading).toHaveClass("md:text-4xl");
		expect(heading).toHaveClass("lg:text-5xl");
	});

	it("sizes the featured section to about three quarters of the viewport", () => {
		const item: MediaItem = {
			Id: "featured",
			Name: "Featured Title",
			ImageTags: {
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		expect(
			screen
				.getByRole("heading", { level: 1, name: item.Name })
				.closest("section"),
		).toHaveClass("h-[min(72svh,640px)]", "md:h-[85svh]");
	});

	it("uses readable mixed-case typography for hero action buttons", () => {
		const item: MediaItem = {
			Id: "featured",
			Name: "Featured Title",
			ImageTags: {
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		const playButton = screen.getByRole("button", { name: "Play" });
		const infoButton = screen.getByRole("button", { name: "Info" });

		expect(playButton).toHaveClass("text-sm");
		expect(playButton).toHaveClass("font-semibold");
		expect(playButton).toHaveClass("tracking-normal");
		expect(playButton).not.toHaveClass("uppercase");
		expect(infoButton).toHaveClass("text-sm");
		expect(infoButton).toHaveClass("font-medium");
		expect(infoButton).toHaveClass("tracking-normal");
		expect(infoButton).not.toHaveClass("uppercase");
	});

	it("routes the featured title to the native player URL when Play is clicked", async () => {
		const item = heroItem("featured", "Featured Title");

		render(<Hero items={[item]} session={session} />);

		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() =>
			expect(router.push).toHaveBeenCalledWith("/play/featured"),
		);
	});

	it("uses the Logo image in place of the visual title when present", () => {
		const item: MediaItem = {
			Id: "featured",
			Name: "Featured Title",
			ImageTags: {
				Logo: "/api/catalog/items/featured/images/Logo?language=en&v=logo-tag",
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		const heading = screen.getByRole("heading", { level: 1, name: item.Name });
		const titleImage = screen.getByRole("img", { name: item.Name });

		expect(heading).not.toHaveClass("text-4xl");
		expect(decodeURIComponent(titleImage.getAttribute("src") ?? "")).toContain(
			"/api/catalog/items/featured/images/Logo?language=en&v=logo-tag",
		);
		expect(titleImage).toHaveClass("max-h-[300px]");
	});

	it("switches featured slides with hover-revealed arrow controls", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		render(<Hero items={[first, second]} session={session} />);

		fireEvent.click(
			screen.getByRole("button", { name: /show next featured slide/i }),
		);
		expect(
			screen.getByRole("heading", { level: 1, name: second.Name }),
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("button", { name: /show previous featured slide/i }),
		);
		expect(
			screen.getByRole("heading", { level: 1, name: first.Name }),
		).toBeInTheDocument();
	});

	it("mounts only the active slideshow layer for mobile rendering stability", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		const { container } = render(
			<Hero items={[first, second]} session={session} />,
		);

		const hero = screen.getByRole("region", { name: /featured title/i });
		const backgrounds = container.querySelectorAll("img[aria-hidden='true']");
		expect(backgrounds).toHaveLength(1);
		expect(backgrounds[0]).toHaveClass("opacity-100");
		expect(backgrounds[0]).toHaveClass("hero-backdrop-active");
		expect(hero.querySelector(".hero-slide-content")).toHaveAttribute(
			"data-slide-direction",
			"next",
		);

		fireEvent.click(
			screen.getByRole("button", { name: /show next featured slide/i }),
		);

		expect(container.querySelectorAll("img[aria-hidden='true']")).toHaveLength(1);
		expect(container.querySelector("img[aria-hidden='true']")).toHaveClass(
			"opacity-100",
		);
		expect(hero.querySelector(".hero-slide-content")).toHaveAttribute(
			"data-slide-direction",
			"next",
		);
	});

	it("switches featured slides when dragged with a pointer", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		render(<Hero items={[first, second]} session={session} />);

		const hero = screen.getByRole("region", { name: /featured title/i });
		fireEvent.pointerDown(hero, { clientX: 180, pointerId: 1 });
		fireEvent.pointerMove(hero, { clientX: 80, pointerId: 1 });
		fireEvent.pointerUp(hero, { pointerId: 1 });

		expect(
			screen.getByRole("heading", { level: 1, name: second.Name }),
		).toBeInTheDocument();

		fireEvent.pointerDown(hero, { clientX: 80, pointerId: 2 });
		fireEvent.pointerMove(hero, { clientX: 180, pointerId: 2 });
		fireEvent.pointerUp(hero, { pointerId: 2 });

		expect(
			screen.getByRole("heading", { level: 1, name: first.Name }),
		).toBeInTheDocument();
	});

	it("uses drag cursor states and prevents selecting featured content", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		const { container } = render(
			<Hero items={[first, second]} session={session} />,
		);

		const hero = screen.getByRole("region", { name: /featured title/i });
		expect(hero).toHaveClass("select-none");
		expect(hero).toHaveClass("cursor-grab");
		expect(container.querySelector("img[aria-hidden='true']")).toHaveAttribute(
			"draggable",
			"false",
		);

		fireEvent.pointerDown(hero, { clientX: 180, pointerId: 1 });
		expect(hero).toHaveClass("cursor-grabbing");

		fireEvent.pointerUp(hero, { pointerId: 1 });
		expect(hero).toHaveClass("cursor-grab");
	});

	it("keeps image-only slides for seven seconds", () => {
		vi.useFakeTimers();
		const first = heroItem("timer-first", "Timer First");
		const second = heroItem("timer-second", "Timer Second");

		render(<Hero items={[first, second]} session={session} />);

		act(() => vi.advanceTimersByTime(6999));
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1));
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("cycles three no-trailer slides in order without skipping", () => {
		vi.useFakeTimers();
		const first = heroItem("cycle-first", "Cycle First");
		const second = heroItem("cycle-second", "Cycle Second");
		const third = heroItem("cycle-third", "Cycle Third");

		render(<Hero items={[first, second, third]} session={session} />);

		act(() => vi.advanceTimersByTime(7000));
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();

		act(() => vi.advanceTimersByTime(7000));
		expect(screen.getByRole("heading", { name: third.Name })).toBeInTheDocument();

		act(() => vi.advanceTimersByTime(7000));
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("uses the backdrop and skips trailer lookup when disabled", async () => {
		vi.useFakeTimers();
		window.localStorage.setItem(
			playbackBehaviorStorageKey(session.userId),
			JSON.stringify({
				autoplayNextEpisode: true,
				autoplayBrowse: true,
				useHeroTrailer: false,
			}),
		);
		const getHeroTrailer = vi.spyOn(mediaApi, "getHeroTrailer");
		const first = {
			...heroItem("backdrop-first", "Backdrop First"),
			RemoteTrailers: [{ Url: "https://youtu.be/backdrop-trailer" }],
		};
		const second = heroItem("backdrop-second", "Backdrop Second");
		const { container } = render(
			<PlaybackBehaviorPreferencesProvider userId={session.userId}>
				<Hero items={[first, second]} session={session} />
			</PlaybackBehaviorPreferencesProvider>,
		);

		await act(async () => {
			await Promise.resolve();
		});

		expect(getHeroTrailer).not.toHaveBeenCalled();
		expect(screen.queryByTitle("Backdrop First trailer")).not.toBeInTheDocument();
		expect(container.querySelector("img[aria-hidden='true']")).toHaveClass(
			"hero-backdrop-active",
		);

		act(() => vi.advanceTimersByTime(7000));
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
	});

	it("removes an active trailer and returns to timed slides when disabled", async () => {
		vi.useFakeTimers();
		const first = {
			...heroItem("toggle-first", "Toggle First"),
			RemoteTrailers: [{ Url: "https://youtu.be/toggle-trailer" }],
		};
		const second = heroItem("toggle-second", "Toggle Second");
		render(
			<PlaybackBehaviorPreferencesProvider userId={session.userId}>
				<HeroPreferenceHarness items={[first, second]} />
			</PlaybackBehaviorPreferencesProvider>,
		);

		await act(async () => {
			vi.advanceTimersByTime(1);
			await Promise.resolve();
		});
		expect(screen.getByTitle("Toggle First trailer")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("switch", { name: "Use trailers in hero" }));
		expect(screen.queryByTitle("Toggle First trailer")).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /unmute trailer/i }),
		).not.toBeInTheDocument();

		act(() => vi.advanceTimersByTime(6999));
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1));
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
	});

	it("starts a muted YouTube trailer after 800ms and advances when it ends", async () => {
		vi.useFakeTimers();
		const first = {
			...heroItem("trailer-first", "Trailer First"),
			RemoteTrailers: [{ Url: "https://youtu.be/trailer-video" }],
		};
		const second = heroItem("trailer-second", "Trailer Second");

		render(<Hero items={[first, second]} session={session} />);

		await act(async () => {
			vi.advanceTimersByTime(800);
			await Promise.resolve();
		});

		const iframe = screen.getByTitle(
			"Trailer First trailer",
		) as HTMLIFrameElement;
		expect(iframe).toHaveAttribute("src", expect.stringContaining("mute=1"));
		expect(iframe).toHaveAttribute(
			"src",
			expect.stringContaining("cc_load_policy=0"),
		);
		expect(iframe).toHaveClass("scale-[1.45]");
		const audioButton = screen.getByRole("button", { name: /unmute trailer/i });
		fireEvent.click(audioButton);
		expect(
			screen.getByRole("button", { name: /mute trailer/i }),
		).toBeInTheDocument();

		const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
		fireEvent.load(iframe);
		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onReady" }),
				}),
			);
		});
		expect(postMessage).toHaveBeenCalledWith(
			JSON.stringify({ event: "listening", id: "trailer-video" }),
			"https://www.youtube.com",
		);

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 0 }),
				}),
			);
		});
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 1 }),
				}),
			);
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 0 }),
				}),
			);
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 0 }),
				}),
			);
		});
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("does not let an ended trailer skip the next slide", async () => {
		vi.useFakeTimers();
		const first = {
			...heroItem("single-advance-first", "Single Advance First"),
			RemoteTrailers: [{ Url: "https://youtu.be/single-advance-video" }],
		};
		const second = heroItem("single-advance-second", "Single Advance Second");
		const third = heroItem("single-advance-third", "Single Advance Third");

		render(<Hero items={[first, second, third]} session={session} />);

		await act(async () => {
			vi.advanceTimersByTime(800);
			await Promise.resolve();
		});
		const iframe = screen.getByTitle(
			"Single Advance First trailer",
		) as HTMLIFrameElement;

		act(() => {
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 1 }),
				}),
			);
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 0 }),
				}),
			);
			window.dispatchEvent(
				new MessageEvent("message", {
					origin: "https://www.youtube.com",
					source: iframe.contentWindow,
					data: JSON.stringify({ event: "onStateChange", info: 0 }),
				}),
			);
		});

		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(6999));
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1));
		expect(screen.getByRole("heading", { name: third.Name })).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("queues a finished trailer until the progressive hero list can advance", async () => {
		vi.useFakeTimers();
		const first = {
			...heroItem("progressive-first", "Progressive First"),
			RemoteTrailers: [{ Url: "https://youtu.be/progressive-video" }],
		};
		const second = heroItem("progressive-second", "Progressive Second");
		const { rerender } = render(<Hero items={[first]} session={session} />);

		await act(async () => {
			vi.advanceTimersByTime(800);
			await Promise.resolve();
		});
		const iframe = screen.getByTitle(
			"Progressive First trailer",
		) as HTMLIFrameElement;

		act(() => {
			for (const info of [1, 0, 0]) {
				window.dispatchEvent(
					new MessageEvent("message", {
						origin: "https://www.youtube.com",
						source: iframe.contentWindow,
						data: JSON.stringify({ event: "onStateChange", info }),
					}),
				);
			}
		});
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();

		rerender(<Hero items={[first, second]} session={session} />);
		expect(
			screen.getByRole("heading", { name: second.Name }),
		).toBeInTheDocument();
		vi.useRealTimers();
	});

	it("keeps the active trailer bound to its item across a list reorder", async () => {
		vi.useFakeTimers();
		const first = {
			...heroItem("reorder-first", "Reorder First"),
			RemoteTrailers: [{ Url: "https://youtu.be/reorder-video" }],
		};
		const second = heroItem("reorder-second", "Reorder Second");
		const third = heroItem("reorder-third", "Reorder Third");
		const { rerender } = render(
			<Hero items={[first, second, third]} session={session} />,
		);

		await act(async () => {
			vi.advanceTimersByTime(800);
			await Promise.resolve();
		});
		const iframe = screen.getByTitle("Reorder First trailer");

		rerender(<Hero items={[second, first, third]} session={session} />);
		expect(screen.getByTitle("Reorder First trailer")).toBe(iframe);
		expect(screen.getByRole("heading", { name: first.Name })).toBeInTheDocument();

		act(() => {
			for (const info of [1, 0]) {
				window.dispatchEvent(
					new MessageEvent("message", {
						origin: "https://www.youtube.com",
						source: (iframe as HTMLIFrameElement).contentWindow,
						data: JSON.stringify({ event: "onStateChange", info }),
					}),
				);
			}
		});
		expect(screen.getByRole("heading", { name: third.Name })).toBeInTheDocument();
		vi.useRealTimers();
	});
});

function heroItem(id: string, name: string): MediaItem {
	return {
		Id: id,
		Name: name,
		Overview: "Overview",
		ImageTags: {
			Primary: `/api/catalog/items/${id}/images/Primary?language=en&v=primary-tag`,
		},
		BackdropImageTags: [
			`/api/catalog/items/${id}/images/Backdrop?language=en&v=backdrop-tag`,
		],
		LocalTrailerCount: 0,
		RemoteTrailers: [],
	};
}
