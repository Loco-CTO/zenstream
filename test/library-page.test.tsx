import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "@/components/pages/library-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import * as jellyfin from "@/lib/media-api";

const session = { token: "token", userId: "user", username: "Alex" };
const clientWidthDescriptor = Object.getOwnPropertyDescriptor(
	HTMLElement.prototype,
	"clientWidth",
);

describe("LibraryPage", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
		const storage = new Map<string, string>();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				clear: () => storage.clear(),
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		});
		Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
		Object.defineProperty(HTMLElement.prototype, "clientWidth", {
			configurable: true,
			get: () => 800,
		});
		vi.stubGlobal(
			"ResizeObserver",
			class {
				observe() {}
				disconnect() {}
			},
		);
		vi.spyOn(jellyfin, "getLibraryViews").mockResolvedValue([
			{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
			{ Id: "movies", Name: "Movies", CollectionType: "movies" },
			{ Id: "collections", Name: "Collections", CollectionType: "boxsets" },
		]);
	});

	afterEach(() => {
		cleanup();
		if (clientWidthDescriptor) {
			Object.defineProperty(
				HTMLElement.prototype,
				"clientWidth",
				clientWidthDescriptor,
			);
		} else {
			delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
		}
		Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
		vi.unstubAllGlobals();
	});

	it("keeps sorting preferences separate for each library", async () => {
		const getLibraryItems = vi
			.spyOn(jellyfin, "getLibraryItems")
			.mockResolvedValue({
				items: makeItems(4),
				totalRecordCount: 4,
			});
		renderLibrary();

		expect(
			await screen.findByRole("heading", { name: "Shows" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Collections" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
		fireEvent.click(screen.getByRole("option", { name: "Date added" }));
		fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));

		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenLastCalledWith(
				session,
				expect.objectContaining({
					parentId: "shows",
					sortBy: "added",
					sortOrder: "Ascending",
				}),
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "Movies" }));
		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenLastCalledWith(
				session,
				expect.objectContaining({
					parentId: "movies",
					collectionType: "movies",
				}),
			),
		);
		fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
		fireEvent.click(screen.getByRole("option", { name: "Runtime" }));
		fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));

		fireEvent.click(screen.getByRole("button", { name: "Shows" }));
		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenLastCalledWith(
				session,
				expect.objectContaining({
					parentId: "shows",
					sortBy: "added",
					sortOrder: "Ascending",
				}),
			),
		);
		expect(window.localStorage.getItem("zenstream:user:sort:library:shows")).toBe(
			JSON.stringify({ sortBy: "added", sortOrder: "Ascending" }),
		);
		expect(
			window.localStorage.getItem("zenstream:user:sort:library:movies"),
		).toBe(JSON.stringify({ sortBy: "runtime", sortOrder: "Ascending" }));
	});

	it("keeps rendered cards bounded and appends the next page near the end", async () => {
		const getLibraryItems = vi
			.spyOn(jellyfin, "getLibraryItems")
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 })
			.mockResolvedValueOnce({
				items: makeItems(40, 40),
				totalRecordCount: 80,
			});
		renderLibrary();

		await screen.findByText("Title 0");
		expect(screen.getAllByRole("article").length).toBeLessThan(40);

		Object.defineProperty(window, "scrollY", {
			configurable: true,
			value: 13000,
		});
		await act(async () => {
			fireEvent.scroll(window);
			await new Promise((resolve) => requestAnimationFrame(resolve));
		});

		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenCalledWith(
				session,
				expect.objectContaining({ startIndex: 40 }),
			),
		);
		expect(
			getLibraryItems.mock.calls.filter(
				([, options]) => options.startIndex === 40,
			),
		).toHaveLength(1);
		expect(await screen.findByText("Title 79")).toBeInTheDocument();
		expect(screen.getAllByRole("article").length).toBeLessThan(40);
		expect(screen.getByTestId("virtual-media-grid").style.height).not.toBe("");
	});

	it("uses two columns for narrow mobile library grids", async () => {
		Object.defineProperty(HTMLElement.prototype, "clientWidth", {
			configurable: true,
			get: () => 320,
		});
		vi.spyOn(jellyfin, "getLibraryItems").mockResolvedValue({
			items: makeItems(4),
			totalRecordCount: 4,
		});
		renderLibrary();

		await screen.findByText("Title 0");
		await waitFor(() =>
			expect(screen.getAllByTestId("virtual-grid-row")[0]).toHaveStyle({
				gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
			}),
		);
	});

	it("supports sorting series by the date their latest episode was added", async () => {
		const getLibraryItems = vi
			.spyOn(jellyfin, "getLibraryItems")
			.mockResolvedValue({
				items: makeItems(1),
				totalRecordCount: 1,
			});
		renderLibrary();

		expect(
			await screen.findByRole("heading", { name: "Shows" }),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));
		fireEvent.click(screen.getByRole("option", { name: "Last added" }));

		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenLastCalledWith(
				session,
				expect.objectContaining({ sortBy: "lastAdded" }),
			),
		);
	});

	it("shows the unwatched episode count or a checkmark on series cards", async () => {
		vi.spyOn(jellyfin, "getLibraryItems").mockResolvedValue({
			items: [
				{ ...makeItems(1)[0], UserData: { UnplayedItemCount: 3 } },
				{
					Id: "watched",
					Name: "Watched series",
					Type: "Series",
					UserData: { UnplayedItemCount: 0 },
				},
				{
					Id: "movie",
					Name: "Movie",
					Type: "Movie",
					UserData: { UnplayedItemCount: 3 },
				},
			],
			totalRecordCount: 3,
		});
		renderLibrary();

		expect(await screen.findByLabelText("3 unwatched")).toBeInTheDocument();
		expect(screen.getByLabelText("All episodes watched")).toBeInTheDocument();
		expect(screen.queryByLabelText("Movie")).not.toBeInTheDocument();
	});

	it("ignores a failed request from the previous library after switching tabs", async () => {
		let rejectShows!: (error: Error) => void;
		const getLibraryItems = vi
			.spyOn(jellyfin, "getLibraryItems")
			.mockImplementation((_session, options) =>
				options.parentId === "shows"
					? new Promise((_resolve, reject) => {
							rejectShows = reject;
						})
					: Promise.resolve({
							items: makeItems(1),
							totalRecordCount: 1,
						}),
			);
		renderLibrary();

		await screen.findByRole("heading", { name: "Shows" });
		fireEvent.click(screen.getByRole("button", { name: "Movies" }));
		rejectShows(new Error("stale request failed"));

		await screen.findByText("Title 0");
		expect(
			screen.queryByText("Could not load this library"),
		).not.toBeInTheDocument();
		expect(getLibraryItems).toHaveBeenCalledWith(
			session,
			expect.objectContaining({ parentId: "movies" }),
		);
	});
});

function renderLibrary() {
	return render(
		<ProgressProvider>
			<I18nProvider locale="en">
				<LibraryPage session={session} />
			</I18nProvider>
		</ProgressProvider>,
	);
}

function makeItems(count: number, offset = 0): jellyfin.MediaItem[] {
	return Array.from({ length: count }, (_, index) => ({
		Id: `item-${offset + index}`,
		Name: `Title ${offset + index}`,
		Type: "Series",
		ProductionYear: 2024,
		ImageTags: { Primary: "poster" },
	}));
}
