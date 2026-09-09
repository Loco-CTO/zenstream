import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchOverlay } from "@/components/layout/search-overlay";
import * as mediaApi from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

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

function item(id: string, name: string): MediaItem {
	return { Id: id, Name: name, Type: "Movie" };
}

function renderOverlay() {
	return render(<SearchOverlay session={session} onClose={() => undefined} />);
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("SearchOverlay", () => {
	it("starts a one-character search immediately", async () => {
		const search = vi.spyOn(mediaApi, "getSearchItems").mockResolvedValue([]);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		expect(search).toHaveBeenCalledTimes(1);
		expect(search.mock.calls[0]?.[1]).toBe("a");
	});

	it("queues only the newest query while an active request is canceled", async () => {
		const first = deferred<MediaItem[]>();
		const second = deferred<MediaItem[]>();
		let firstSignal: AbortSignal | undefined;
		const search = vi
			.spyOn(mediaApi, "getSearchItems")
			.mockImplementationOnce((_session, _query, options) => {
				firstSignal = options?.signal;
				return first.promise;
			})
			.mockImplementationOnce(() => second.promise);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		fireEvent.change(input, { target: { value: "ab" } });
		fireEvent.change(input, { target: { value: "abc" } });
		expect(firstSignal?.aborted).toBe(true);
		expect(search).toHaveBeenCalledTimes(1);

		first.reject(new DOMException("Aborted", "AbortError"));
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));
		expect(search.mock.calls[1]?.[1]).toBe("abc");
		expect(screen.queryByText("Could not search your library")).not.toBeInTheDocument();

		second.resolve([item("two", "About Time")]);
		await screen.findByText("About Time");
	});

	it("clears queued searches when the input is emptied", async () => {
		const first = deferred<MediaItem[]>();
		let firstSignal: AbortSignal | undefined;
		const search = vi
			.spyOn(mediaApi, "getSearchItems")
			.mockImplementationOnce((_session, _query, options) => {
				firstSignal = options?.signal;
				return first.promise;
			});
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		fireEvent.change(input, { target: { value: "ab" } });
		fireEvent.change(input, { target: { value: "" } });

		expect(firstSignal?.aborted).toBe(true);
		first.resolve([item("one", "Alpha")]);
		await waitFor(() =>
			expect(screen.queryByText("Alpha")).not.toBeInTheDocument(),
		);
		expect(search).toHaveBeenCalledTimes(1);
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
		fireEvent.change(input, { target: { value: "abc" } });
		first.resolve([item("one", "Alpha")]);
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

		second.resolve([item("two", "About Time")]);
		await screen.findByText("About Time");

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
		const search = vi
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
});
