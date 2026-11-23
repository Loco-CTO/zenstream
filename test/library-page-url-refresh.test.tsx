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
import { getLibraryItems, getLibraryViews } from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

const navigationMock = vi.hoisted(() => ({
	useWindowSearch: false,
	useRouterReplace: false,
	routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		back: vi.fn(),
		replace: navigationMock.useRouterReplace
			? navigationMock.routerReplace
			: undefined,
	}),
	usePathname: () => "/",
	useSearchParams: () =>
		new URLSearchParams(
			navigationMock.useWindowSearch ? window.location.search : "",
		),
}));

vi.mock("@/lib/media-api", async (importOriginal) => {
	const mediaApi = await importOriginal<typeof import("@/lib/media-api")>();
	return {
		...mediaApi,
		getLibraryItems: vi.fn(),
		getLibraryViews: vi.fn(),
	};
});

const session = {
	token: "token",
	userId: "url-refresh-test-user",
	username: "Alex",
};

function libraryTree() {
	return (
		<ProgressProvider>
			<I18nProvider locale="en">
				<LibraryPage session={session} />
			</I18nProvider>
		</ProgressProvider>
	);
}

function makeItems(count: number, offset = 0): MediaItem[] {
	return Array.from({ length: count }, (_, index) => ({
		Id: `item-${offset + index}`,
		Name: `Title ${offset + index}`,
		Type: "Series",
		ProductionYear: 2024,
	}));
}

function installIntersectionObserver() {
	let trigger: (() => void) | null = null;
	vi.stubGlobal(
		"IntersectionObserver",
		class {
			private active = true;

			constructor(private readonly callback: IntersectionObserverCallback) {}

			observe(element: Element) {
				this.active = true;
				if (element.getAttribute("data-testid") !== "library-load-more-sentinel")
					return;
				trigger = () => {
					if (!this.active) return;
					this.callback(
						[{ isIntersecting: true } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver,
					);
				};
			}

			disconnect() {
				this.active = false;
			}
		},
	);
	return () => trigger?.();
}

describe("LibraryPage URL updates", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		navigationMock.useWindowSearch = false;
		navigationMock.useRouterReplace = false;
		window.history.replaceState(null, "", "/library");
		const storage = new Map<string, string>();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				clear: () => storage.clear(),
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		});
		vi.stubGlobal(
			"ResizeObserver",
			class {
				private readonly observedElements = new Set<Element>();

				observe(element: Element) {
					this.observedElements.add(element);
				}

				disconnect() {
					this.observedElements.clear();
				}
			},
		);
		vi
			.mocked(getLibraryViews)
			.mockImplementation(() =>
				Promise.resolve([
					{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
				]),
			);
		vi.mocked(getLibraryItems).mockImplementation((_session, options) => {
			const startIndex = options.startIndex ?? 0;
			return Promise.resolve({
				items: makeItems(40, startIndex),
				totalRecordCount: 80,
			});
		});
	});

	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it("shows an error when the initial library lookup fails", async () => {
		vi
			.mocked(getLibraryViews)
			.mockRejectedValueOnce(new Error("initial library lookup failed"));
		render(libraryTree());

		await screen.findByRole("button", { name: "Retry" });
		expect(getLibraryItems).not.toHaveBeenCalled();
		await act(async () => {
			screen.getByRole("button", { name: "Retry" }).click();
			await Promise.resolve();
		});
		await screen.findByText("Title 0");
		expect(getLibraryViews).toHaveBeenCalledTimes(2);
	});

	it("aborts a queued library lookup when the page unmounts", async () => {
		const view = render(libraryTree());

		await Promise.resolve();
		act(() => view.unmount());
		await act(async () => {
			await Promise.resolve();
		});

		expect(getLibraryViews).not.toHaveBeenCalled();
	});

	it("uses the router to replace the URL when it is available", async () => {
		navigationMock.useRouterReplace = true;
		render(libraryTree());

		await screen.findByText("Title 0");
		await waitFor(() =>
			expect(navigationMock.routerReplace).toHaveBeenCalledWith(
				expect.stringContaining("libraryId=shows"),
			),
		);
	});

	it("retries the initial page after the library loads but its first page fails", async () => {
		vi
			.mocked(getLibraryItems)
			.mockRejectedValueOnce(new Error("first page failed"))
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 });
		render(libraryTree());

		await screen.findByRole("button", { name: "Retry" });
		await act(async () => {
			screen.getByRole("button", { name: "Retry" }).click();
			await Promise.resolve();
		});
		await screen.findByText("Title 0");
		expect(
			vi
				.mocked(getLibraryItems)
				.mock.calls.filter(([, options]) => options.startIndex === 0).length,
		).toBeGreaterThanOrEqual(2);
	});

	it("shows a recoverable error when the first page is empty but reports items", async () => {
		vi.mocked(getLibraryItems).mockResolvedValueOnce({
			items: [],
			totalRecordCount: 40,
		});
		render(libraryTree());

		await screen.findByRole("button", { name: "Retry" });
		expect(getLibraryItems).toHaveBeenCalledWith(
			session,
			expect.objectContaining({ startIndex: 0 }),
		);
	});

	it("ignores a resolved first-page request after switching libraries", async () => {
		let resolveShows!: (page: {
			items: MediaItem[];
			totalRecordCount: number;
		}) => void;
		vi.mocked(getLibraryViews).mockResolvedValueOnce([
			{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
			{ Id: "movies", Name: "Movies", CollectionType: "movies" },
		]);
		vi.mocked(getLibraryItems).mockImplementation((_session, options) =>
			options.parentId === "shows"
				? new Promise((resolve) => {
						resolveShows = resolve;
					})
				: Promise.resolve({ items: makeItems(1, 200), totalRecordCount: 1 }),
		);
		render(libraryTree());

		await screen.findByRole("button", { name: "Movies" });
		await waitFor(() => expect(resolveShows).toBeTypeOf("function"));
		fireEvent.click(screen.getByRole("button", { name: "Movies" }));
		await screen.findByText("Title 200");

		await act(async () => {
			resolveShows({ items: makeItems(1, 100), totalRecordCount: 1 });
			await Promise.resolve();
		});
		expect(screen.queryByText("Title 100")).not.toBeInTheDocument();
	});

	it("cleans up a first-page refresh canceled before its request starts", async () => {
		const NativeAbortController = globalThis.AbortController;
		const controllers: AbortController[] = [];
		vi.stubGlobal(
			"AbortController",
			class extends NativeAbortController {
				constructor() {
					super();
					controllers.push(this);
				}
			},
		);
		vi.mocked(getLibraryItems).mockResolvedValue({
			items: makeItems(40),
			totalRecordCount: 80,
		});
		render(libraryTree());

		await screen.findByText("Title 0");
		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { libraryId: "shows", reason: "refresh" },
				}),
			);
			controllers.at(-1)?.abort();
			await Promise.resolve();
		});

		expect(getLibraryItems).toHaveBeenCalledTimes(1);
	});

	it("ignores a resolved next-page request after switching libraries", async () => {
		const triggerIntersection = installIntersectionObserver();
		let resolveNextPage!: (page: {
			items: MediaItem[];
			totalRecordCount: number;
		}) => void;
		vi.mocked(getLibraryViews).mockResolvedValueOnce([
			{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
			{ Id: "movies", Name: "Movies", CollectionType: "movies" },
		]);
		vi.mocked(getLibraryItems).mockImplementation((_session, options) => {
			if (options.parentId === "movies") {
				return Promise.resolve({
					items: makeItems(1, 200),
					totalRecordCount: 1,
				});
			}
			if (options.startIndex === 0) {
				return Promise.resolve({ items: makeItems(40), totalRecordCount: 80 });
			}
			return new Promise((resolve) => {
				resolveNextPage = resolve;
			});
		});
		render(libraryTree());

		await screen.findByText("Title 0");
		await screen.findByTestId("library-load-more-sentinel");
		await act(async () => {
			triggerIntersection();
			await Promise.resolve();
		});
		await waitFor(() => expect(resolveNextPage).toBeTypeOf("function"));
		fireEvent.click(screen.getByRole("button", { name: "Movies" }));
		await screen.findByText("Title 200");
		await act(async () => {
			resolveNextPage({ items: makeItems(40, 40), totalRecordCount: 80 });
			await Promise.resolve();
		});
		expect(screen.queryByText("Title 40")).not.toBeInTheDocument();
	});

	it("retries a failed refresh and preserves loaded items", async () => {
		vi
			.mocked(getLibraryItems)
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 })
			.mockRejectedValueOnce("refresh failed")
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 });
		render(libraryTree());

		await screen.findByText("Title 0");
		await act(async () => {
			window.dispatchEvent(
				new CustomEvent("zenstream:catalog-changed", {
					detail: { libraryId: "shows", reason: "refresh" },
				}),
			);
			await Promise.resolve();
		});
		await screen.findByRole("button", { name: "Retry" });
		expect(screen.getByText("Title 0")).toBeInTheDocument();
		await act(async () => {
			screen.getByRole("button", { name: "Retry" }).click();
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(
				vi
					.mocked(getLibraryItems)
					.mock.calls.filter(([, options]) => options.startIndex === 0).length,
			).toBeGreaterThanOrEqual(3),
		);
	});

	it("stops pagination when an empty page confirms there are no more items", async () => {
		const triggerIntersection = installIntersectionObserver();
		vi
			.mocked(getLibraryItems)
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 })
			.mockResolvedValueOnce({ items: [], totalRecordCount: 40 });
		render(libraryTree());

		await screen.findByText("Title 0");
		await screen.findByTestId("library-load-more-sentinel");
		await act(async () => {
			triggerIntersection();
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenCalledWith(
				session,
				expect.objectContaining({ startIndex: 40 }),
			),
		);
		await waitFor(() =>
			expect(
				screen.queryByRole("button", { name: "Retry" }),
			).not.toBeInTheDocument(),
		);
	});

	it("blocks a short page while more library items remain", async () => {
		const triggerIntersection = installIntersectionObserver();
		vi
			.mocked(getLibraryItems)
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 })
			.mockResolvedValueOnce({ items: makeItems(1, 40), totalRecordCount: 80 });
		render(libraryTree());

		await screen.findByText("Title 0");
		await screen.findByTestId("library-load-more-sentinel");
		await act(async () => {
			triggerIntersection();
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenCalledWith(
				session,
				expect.objectContaining({ startIndex: 40 }),
			),
		);
		await screen.findByRole("button", { name: "Retry" });
	});

	it("retries a rejected next-page request", async () => {
		const triggerIntersection = installIntersectionObserver();
		vi
			.mocked(getLibraryItems)
			.mockResolvedValueOnce({ items: makeItems(40), totalRecordCount: 80 })
			.mockRejectedValueOnce(new Error("next page failed"))
			.mockResolvedValueOnce({ items: makeItems(40, 40), totalRecordCount: 80 });
		render(libraryTree());

		await screen.findByText("Title 0");
		await screen.findByTestId("library-load-more-sentinel");
		await act(async () => {
			triggerIntersection();
			await Promise.resolve();
		});
		await screen.findByRole("button", { name: "Retry" });
		await act(async () => {
			screen.getByRole("button", { name: "Retry" }).click();
			await Promise.resolve();
		});
		await waitFor(() =>
			expect(
				vi
					.mocked(getLibraryItems)
					.mock.calls.filter(([, options]) => options.startIndex === 40).length,
			).toBeGreaterThanOrEqual(2),
		);
		await waitFor(() =>
			expect(screen.getByTestId("virtual-media-grid").style.height).toBe(
				"28800px",
			),
		);
	});

	it("continues pagination after search params update to the current library", async () => {
		const triggerIntersection = installIntersectionObserver();
		let rejectRefresh!: (error: Error) => void;
		vi
			.mocked(getLibraryViews)
			.mockResolvedValueOnce([
				{ Id: "shows", Name: "Shows", CollectionType: "tvshows" },
			])
			.mockImplementationOnce(
				() =>
					new Promise((_resolve, reject) => {
						rejectRefresh = reject;
					}),
			);
		const view = render(libraryTree());

		await screen.findByText("Title 0");
		await waitFor(() =>
			expect(window.location.search).toContain("libraryId=shows"),
		);

		navigationMock.useWindowSearch = true;
		act(() => view.rerender(libraryTree()));
		await waitFor(() => {
			expect(getLibraryViews).toHaveBeenCalledTimes(2);
			expect(rejectRefresh).toBeTypeOf("function");
		});
		await act(async () => {
			rejectRefresh(new Error("background library lookup failed"));
			await Promise.resolve();
		});
		expect(screen.getByText("Title 0")).toBeInTheDocument();
		await screen.findByTestId("library-load-more-sentinel");

		act(() => triggerIntersection());
		await waitFor(() =>
			expect(getLibraryItems).toHaveBeenCalledWith(
				session,
				expect.objectContaining({ startIndex: 40 }),
			),
		);
	});
});
