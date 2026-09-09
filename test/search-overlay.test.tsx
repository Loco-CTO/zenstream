import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchOverlay } from "@/components/layout/search-overlay";
import * as mediaApi from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const session = { token: "token", userId: "user-1", username: "Alex" };

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

function item(id: string, name: string, type: MediaItem["Type"] = "Movie") {
	return { Id: id, Name: name, Type: type } satisfies MediaItem;
}

function renderOverlay() {
	return render(<SearchOverlay session={session} onClose={() => undefined} />);
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
	router.push.mockReset();
});

describe("SearchOverlay", () => {
	it("debounces autocomplete while still searching one-character queries", async () => {
		vi.useFakeTimers();
		const search = vi.spyOn(mediaApi, "getSearchItems").mockResolvedValue([]);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(249);
		});
		expect(search).not.toHaveBeenCalled();

		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(search).toHaveBeenCalledTimes(1);
		expect(search.mock.calls[0]?.[1]).toBe("a");

		fireEvent.change(input, { target: { value: "ab" } });
		fireEvent.change(input, { target: { value: "abc" } });
		await act(async () => {
			await vi.advanceTimersByTimeAsync(249);
		});
		expect(search).toHaveBeenCalledTimes(1);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(search).toHaveBeenCalledTimes(2);

		expect(search.mock.calls[1]?.[1]).toBe("abc");
	});

	it("keeps the latest completed results visible while the next query loads", async () => {
		const first = deferred<MediaItem[]>();
		const second = deferred<MediaItem[]>();
		const search = vi
			.spyOn(mediaApi, "getSearchItems")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		first.resolve([item("one", "Alpha")]);
		await screen.findByText("Alpha");
		expect(screen.queryByText("Search results · a")).not.toBeInTheDocument();

		fireEvent.change(input, { target: { value: "ab" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.queryByRole("status")).not.toBeInTheDocument();

		second.resolve([item("two", "About Time")]);
		await screen.findByText("About Time");
		expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
	});

	it("does not let an older response overwrite the newer query", async () => {
		const first = deferred<MediaItem[]>();
		const second = deferred<MediaItem[]>();
		const search = vi
			.spyOn(mediaApi, "getSearchItems")
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		fireEvent.change(input, { target: { value: "ab" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

		second.resolve([item("two", "About Time")]);
		await screen.findByText("About Time");
		first.resolve([item("one", "Alpha")]);

		await waitFor(() => {
			expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
		});
	});

	it("clears results and does not search when the input is emptied", async () => {
		const search = vi
			.spyOn(mediaApi, "getSearchItems")
			.mockResolvedValue([item("one", "Alpha")]);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await screen.findByText("Alpha");
		fireEvent.change(input, { target: { value: "" } });

		await waitFor(() =>
			expect(screen.queryByText("Alpha")).not.toBeInTheDocument(),
		);
		expect(search).toHaveBeenCalledTimes(1);
	});

	it("retains the last successful results when the next request fails", async () => {
		vi
			.spyOn(mediaApi, "getSearchItems")
			.mockResolvedValueOnce([item("one", "Alpha")])
			.mockRejectedValueOnce(new Error("search failed"));
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await screen.findByText("Alpha");
		fireEvent.change(input, { target: { value: "ab" } });

		await waitFor(() =>
			expect(
				screen.getByText("Could not search your library"),
			).toBeInTheDocument(),
		);
		expect(screen.getByText("Alpha")).toBeInTheDocument();
		expect(screen.queryByText("Search results · a")).not.toBeInTheDocument();
	});

	it("labels music suggestions by type and uses square artwork", async () => {
		vi
			.spyOn(mediaApi, "getSearchItems")
			.mockResolvedValue([
				item("artist", "No Signal Love", "MusicArtist"),
				item("album", "No Signal Love", "MusicAlbum"),
				item("track", "No Signal Love", "Audio"),
			]);
		renderOverlay();
		fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
			target: { value: "no signal love" },
		});

		expect(await screen.findAllByText("Artist")).toHaveLength(1);
		expect(screen.getByText("Album")).toBeInTheDocument();
		expect(screen.getByText("Track")).toBeInTheDocument();
		expect(screen.queryByText("Movie")).not.toBeInTheDocument();

		const artistResult = screen.getAllByRole("button", {
			name: /No Signal LoveArtist/,
		})[0]!;
		expect(artistResult.querySelector(".w-12")).toBeInTheDocument();
		expect(artistResult.querySelector(".w-9")).not.toBeInTheDocument();
	});

	it("routes music suggestions to their music detail views", async () => {
		vi
			.spyOn(mediaApi, "getSearchItems")
			.mockResolvedValue([
				item("artist", "The Artist", "MusicArtist"),
				item("album", "The Album", "MusicAlbum"),
				{ ...item("track", "The Track", "Audio"), AlbumId: "album" },
			]);
		renderOverlay();
		fireEvent.change(screen.getByRole("textbox", { name: "Search" }), {
			target: { value: "the" },
		});

		const artistButton = (await screen.findByText("The Artist")).closest(
			"button",
		);
		const albumButton = screen.getByText("The Album").closest("button");
		const trackButton = screen.getByText("The Track").closest("button");
		fireEvent.click(artistButton!);
		fireEvent.click(albumButton!);
		fireEvent.click(trackButton!);

		expect(router.push).toHaveBeenNthCalledWith(1, "/artist/artist");
		expect(router.push).toHaveBeenNthCalledWith(2, "/album/album");
		expect(router.push).toHaveBeenNthCalledWith(3, "/album/album?trackId=track");
	});
});
