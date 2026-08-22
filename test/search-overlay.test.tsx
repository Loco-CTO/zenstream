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

afterEach(() => vi.restoreAllMocks());

describe("SearchOverlay", () => {
	it("searches immediately for every non-empty query, including one character", async () => {
		const search = vi.spyOn(mediaApi, "getSearchItems").mockResolvedValue([]);
		renderOverlay();
		const input = screen.getByRole("textbox", { name: "Search" });

		fireEvent.change(input, { target: { value: "a" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
		fireEvent.change(input, { target: { value: "ab" } });
		await waitFor(() => expect(search).toHaveBeenCalledTimes(2));

		expect(search.mock.calls[0]?.[1]).toBe("a");
		expect(search.mock.calls[1]?.[1]).toBe("ab");
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
