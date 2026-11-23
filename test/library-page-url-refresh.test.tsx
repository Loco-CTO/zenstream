import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPage } from "@/components/pages/library-page";
import { ProgressProvider } from "@/components/status/progress-indicator";
import { I18nProvider } from "@/lib/i18n";
import { getLibraryItems, getLibraryViews } from "@/lib/media-api";
import type { MediaItem } from "@/lib/media-api";

const navigationMock = vi.hoisted(() => ({ useWindowSearch: false }));

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
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

			constructor(private readonly callback: IntersectionObserverCallback) {
				trigger = () => {
					if (!this.active) return;
					this.callback(
						[{ isIntersecting: true } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver,
					);
				};
			}

			observe() {
				this.active = true;
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
