import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesPage } from "@/components/pages/favorites-page";
import type { MediaItem } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

const actions = vi.hoisted(() => ({
	favorites: vi.fn(),
	watchlist: vi.fn(),
	playlists: vi.fn(),
	start: vi.fn(() => vi.fn()),
	setSort: vi.fn(),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: {
		href: string;
		children: ReactNode;
	}) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/lib/media-api", async () => ({
	...(await vi.importActual<typeof import("@/lib/media-api")>(
		"@/lib/media-api",
	)),
	getFavoriteItems: actions.favorites,
	seriesPosterImage: () => null,
	savedPlaybackPositionSeconds: () => 0,
	setFavorite: vi.fn(),
	setFollowing: vi.fn(),
}));

vi.mock("@/lib/playlists", () => ({
	fetchWatchlist: actions.watchlist,
	fetchPlaylists: actions.playlists,
}));

vi.mock("@/components/status/progress-indicator", () => ({
	useProgress: () => ({ start: actions.start }),
}));

vi.mock("@/lib/sort-preferences", () => ({
	useSortPreference: () => [
		{ sortBy: "SortName", sortOrder: "Ascending" },
		actions.setSort,
	],
}));

vi.mock("@/components/ui/dropdown", () => ({
	Dropdown: () => <div />,
}));

vi.mock("@/components/audio/playlist-picker", () => ({
	CreatePlaylistDialog: () => null,
}));

vi.mock("@/components/home/media-card", () => ({
	SquareAudioCard: () => null,
	WideCard: () => null,
	PosterCard: () => null,
}));

vi.mock("@/components/ui/horizontal-scroller", () => ({
	HorizontalScroller: ({ children }: { children: ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => <div />,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string, values?: { count?: number }) =>
			values?.count == null ? key : `${key}:${values.count}`,
	}),
}));

const session: AuthSession = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};

function mediaItem(id: string, type: string, name = id): MediaItem {
	return { Id: id, Type: type, Name: name };
}

describe("My Lists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		actions.start.mockReturnValue(vi.fn());
		actions.favorites.mockResolvedValue([]);
		actions.watchlist.mockResolvedValue([]);
		actions.playlists.mockResolvedValue([]);
	});

	it("shows Watchlist, Favorites, and Playlists tabs and keeps favorites reachable", async () => {
		render(<FavoritesPage session={session} />);

		for (const tab of ["watchlist", "favorites", "playlists"]) {
			expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
		}
		await screen.findByText("watchlistEmpty");

		fireEvent.click(screen.getByRole("tab", { name: "favorites" }));
		await screen.findByText("noFavorites");

		fireEvent.click(screen.getByRole("tab", { name: "playlists" }));
		await screen.findByText("newPlaylist");
	});

	it("routes followed series to its series detail view", async () => {
		actions.watchlist.mockResolvedValueOnce([
			mediaItem("series-1", "Series", "Followed Series"),
		]);
		render(<FavoritesPage session={session} />);

		await waitFor(() =>
			expect(
				screen.getByRole("link", { name: "Followed Series" }),
			).toHaveAttribute("href", "/show/series-1"),
		);
	});

	it("renders playlist cards with track count and privacy state", async () => {
		actions.playlists.mockResolvedValueOnce([
			{
				id: "playlist-1",
				name: "Road Trip",
				description: null,
				isPrivate: true,
				itemCount: 4,
				artworkItems: [],
			},
		]);
		render(<FavoritesPage session={session} initialTab="playlists" />);

		expect(
			await screen.findByRole("link", { name: /Road Trip/ }),
		).toHaveAttribute("href", "/playlist/playlist-1");
		expect(
			screen.getByText("playlistTrackCount:4 · privatePlaylist"),
		).toBeInTheDocument();
	});
});
