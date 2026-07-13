import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "@/components/home/hero";
import type { JellyfinItem } from "@/lib/jellyfin";

const session = { token: "token", userId: "user", username: "Alex" };
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

describe("Hero", () => {
	it("constrains long titles so they cannot overrun the hero", () => {
		const item: JellyfinItem = {
			Id: "long-title",
			Name: "隣な美少女が、昔男子と思って一緒に遊んだ幼馴染だった件",
			Overview: "A long overview for the selected item.",
			ImageTags: {
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		const heading = screen.getByRole("heading", { level: 1, name: item.Name });

		expect(heading).toHaveClass("line-clamp-3");
		expect(heading).toHaveClass("[overflow-wrap:anywhere]");
		expect(heading).toHaveClass("text-[clamp(2rem,9vw,4rem)]");
		expect(heading).toHaveClass("md:text-6xl");
		expect(heading).toHaveClass("lg:text-7xl");
	});

	it("sizes the featured section to about three quarters of the viewport", () => {
		const item: JellyfinItem = {
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
		const item: JellyfinItem = {
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

	it("routes the featured title to the native player URL when Play is clicked", () => {
		const item = heroItem("featured", "Featured Title");

		render(<Hero items={[item]} session={session} />);

		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		expect(router.push).toHaveBeenCalledWith("/play/featured");
	});

	it("uses the Logo image in place of the visual title when present", () => {
		const item: JellyfinItem = {
			Id: "featured",
			Name: "Featured Title",
			ImageTags: {
				Logo: "logo-tag",
				Primary: "primary-tag",
			},
		};

		render(<Hero items={[item]} session={session} />);

		const heading = screen.getByRole("heading", { level: 1, name: item.Name });
		const titleImage = screen.getByRole("img", { name: item.Name });

		expect(heading).not.toHaveClass("text-4xl");
		expect(titleImage).toHaveAttribute("src", expect.stringContaining("/Images/Logo?"));
		expect(titleImage).toHaveClass("max-h-28");
	});

	it("switches featured slides with hover-revealed arrow controls", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		render(<Hero items={[first, second]} session={session} />);

		fireEvent.click(screen.getByRole("button", { name: /show next featured slide/i }));
		expect(screen.getByRole("heading", { level: 1, name: second.Name })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /show previous featured slide/i }));
		expect(screen.getByRole("heading", { level: 1, name: first.Name })).toBeInTheDocument();
	});

	it("mounts only the active slideshow layer for mobile rendering stability", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		const { container } = render(<Hero items={[first, second]} session={session} />);

		const hero = screen.getByRole("region", { name: /featured title/i });
		const backgrounds = container.querySelectorAll("img[aria-hidden='true']");
		expect(backgrounds).toHaveLength(1);
		expect(backgrounds[0]).toHaveClass("opacity-100");
		expect(backgrounds[0]).toHaveClass("hero-backdrop-active");
		expect(hero.querySelector(".hero-slide-content")).toHaveAttribute(
			"data-slide-direction",
			"next",
		);

		fireEvent.click(screen.getByRole("button", { name: /show next featured slide/i }));

		expect(container.querySelectorAll("img[aria-hidden='true']")).toHaveLength(1);
		expect(container.querySelector("img[aria-hidden='true']")).toHaveClass("opacity-100");
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

		expect(screen.getByRole("heading", { level: 1, name: second.Name })).toBeInTheDocument();

		fireEvent.pointerDown(hero, { clientX: 80, pointerId: 2 });
		fireEvent.pointerMove(hero, { clientX: 180, pointerId: 2 });
		fireEvent.pointerUp(hero, { pointerId: 2 });

		expect(screen.getByRole("heading", { level: 1, name: first.Name })).toBeInTheDocument();
	});

	it("uses drag cursor states and prevents selecting featured content", () => {
		const first = heroItem("first", "First Feature");
		const second = heroItem("second", "Second Feature");

		const { container } = render(<Hero items={[first, second]} session={session} />);

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
		expect(screen.getByRole("heading", { name: second.Name })).toBeInTheDocument();
		vi.useRealTimers();
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

		const iframe = screen.getByTitle("Trailer First trailer") as HTMLIFrameElement;
		expect(iframe).toHaveAttribute("src", expect.stringContaining("mute=1"));
		expect(iframe).toHaveAttribute("src", expect.stringContaining("cc_load_policy=0"));
  expect(iframe).toHaveClass("scale-[1.45]");
		const audioButton = screen.getByRole("button", { name: /unmute trailer/i });
		fireEvent.click(audioButton);
		expect(screen.getByRole("button", { name: /mute trailer/i })).toBeInTheDocument();

		const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage");
		fireEvent.load(iframe);
		expect(postMessage).toHaveBeenCalledWith(
			JSON.stringify({
				event: "command",
				func: "addEventListener",
				args: ["onStateChange"],
			}),
			"https://www.youtube.com",
		);

		act(() => {
			window.dispatchEvent(new MessageEvent("message", {
				origin: "https://www.youtube.com",
				source: iframe.contentWindow,
				data: JSON.stringify({
					event: "infoDelivery",
					info: { playerState: 0 },
				}),
			}));
		});
		expect(screen.getByRole("heading", { name: second.Name })).toBeInTheDocument();
		vi.useRealTimers();
	});
});

function heroItem(id: string, name: string): JellyfinItem {
	return {
		Id: id,
		Name: name,
		Overview: "Overview",
		ImageTags: {
			Primary: "primary-tag",
		},
		BackdropImageTags: ["backdrop-tag"],
		LocalTrailerCount: 0,
	};
}
