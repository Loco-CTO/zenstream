import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionPage } from "@/components/pages/collection-page";
import { I18nProvider } from "@/lib/i18n";
import type { DetailData, MediaItem } from "@/lib/media-api";

const router = vi.hoisted(() => ({
	back: vi.fn(),
	push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => router,
}));

const session = { token: "token", userId: "user", username: "Alex" };

describe("CollectionPage", () => {
	beforeEach(() => {
		router.back.mockClear();
		router.push.mockClear();
		window.history.replaceState(null, "", "/collection/collection");
	});

	afterEach(() => {
		cleanup();
	});

	it("uses the shared poster layout and browser-history back button", () => {
		window.history.pushState(null, "", "/library");
		window.history.pushState(null, "", "/collection/collection");
		const { container } = renderCollection();

		fireEvent.click(screen.getByRole("button", { name: "Back" }));
		expect(router.back).toHaveBeenCalledOnce();
		expect(router.push).not.toHaveBeenCalled();
		const header = screen
			.getByRole("heading", { name: "Collection" })
			.closest("header");
		expect(header).not.toHaveClass("border-b");
		expect(
			screen.getByRole("heading", { name: "Collection" }).parentElement,
		).toHaveClass("mt-3");

		const grid = container.querySelector(".grid");
		expect(grid).toHaveClass(
			"grid-cols-[repeat(auto-fill,minmax(132px,1fr))]",
			"sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
			"[&>article]:w-full",
		);
		expect(screen.getByRole("article")).toHaveClass("group/card", "md:w-[200px]");
		expect(
			screen.getByRole("button", { name: "Play Series One" }),
		).toBeInTheDocument();
	});
});

function renderCollection() {
	const item: MediaItem = {
		Id: "series-1",
		Name: "Series One",
		Type: "Series",
		ProductionYear: 2026,
	};
	const initialData: DetailData = {
		item: { Id: "collection", Name: "Collection", Type: "BoxSet" },
		seasons: [],
		episodes: [],
		similar: [],
		collectionItems: [item],
	};
	return render(
		<I18nProvider locale="en">
			<CollectionPage initialData={initialData} session={session} />
		</I18nProvider>,
	);
}
