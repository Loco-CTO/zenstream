import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlaylistDetailPage } from "@/components/pages/playlist-detail-page";
import type { Playlist } from "@/lib/playlists";
import type { AuthSession } from "@/lib/session";

const player = vi.hoisted(() => ({
	currentTrack: null,
	isPlaying: false,
	playAlbum: vi.fn(),
}));
const api = vi.hoisted(() => ({ fetchPlaylist: vi.fn(), move: vi.fn() }));
const drag = vi.hoisted(() => ({
	onReorder: null as null | ((from: number, to: number) => void),
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

vi.mock("@/components/audio/audio-player-provider", () => ({
	useAudioPlayer: () => player,
}));

vi.mock("@/components/audio/use-audio-row-reorder", () => ({
	useAudioRowReorder: (
		_count: number,
		onReorder: (from: number, to: number) => void,
	) => {
		drag.onReorder = onReorder;
		return { onPointerDown: vi.fn(), onClickCapture: vi.fn() };
	},
}));

vi.mock("@/lib/playlists", () => ({
	fetchPlaylist: api.fetchPlaylist,
	deletePlaylist: vi.fn(),
	fetchSharedPlaylist: vi.fn(),
	removePlaylistEntry: vi.fn(),
	movePlaylistEntry: api.move,
	updatePlaylist: vi.fn(),
}));

vi.mock("@/lib/media-api", async () => ({
	...(await vi.importActual<typeof import("@/lib/media-api")>(
		"@/lib/media-api",
	)),
	seriesPosterImage: () => null,
}));

vi.mock("@/components/ui/blurhash-image", () => ({
	BlurHashImage: () => null,
	MediaPlaceholder: () => <div />,
}));

vi.mock("@/components/status/error-panel", () => ({
	ErrorPanel: ({ message }: { message: string }) => <p>{message}</p>,
}));

vi.mock("@/lib/i18n", () => ({
	useI18n: () => ({
		t: (key: string, values?: { count?: number; name?: string }) => {
			if (values?.count != null) return `${key}:${values.count}`;
			if (values?.name != null) return `${key}:${values.name}`;
			return key;
		},
	}),
}));

const session: AuthSession = {
	token: "token",
	userId: "user-1",
	username: "Alex",
};
const tracks = [
	{ Id: "track-1", Name: "Track One", Type: "Audio" },
	{ Id: "track-2", Name: "Track Two", Type: "Audio" },
];
const detail: Playlist = {
	id: "playlist-1",
	name: "Road Mix",
	description: null,
	isPrivate: true,
	itemCount: tracks.length,
	artworkItems: [],
	createdAt: "",
	updatedAt: "",
	isOwner: true,
	items: tracks.map((item, index) => ({
		entryId: `entry-${index + 1}`,
		position: index,
		addedAt: "2026-09-01T12:00:00Z",
		item,
	})),
};

describe("playlist detail playback", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		player.currentTrack = null;
		player.isPlaying = false;
		drag.onReorder = null;
		api.fetchPlaylist.mockResolvedValue(detail);
	});

	it("plays the playlist queue and preserves the selected start track", async () => {
		render(<PlaylistDetailPage session={session} playlistId={detail.id} />);
		const playAll = await screen.findByRole("button", { name: "playAll" });
		fireEvent.click(playAll);

		const syntheticPlaylist = {
			Id: detail.id,
			Name: detail.name,
			Type: "MusicAlbum",
		};
		await waitFor(() =>
			expect(player.playAlbum).toHaveBeenLastCalledWith(
				syntheticPlaylist,
				tracks,
				undefined,
				undefined,
				false,
			),
		);

		fireEvent.click(screen.getByRole("button", { name: "play Track Two" }));
		await waitFor(() =>
			expect(player.playAlbum).toHaveBeenLastCalledWith(
				syntheticPlaylist,
				tracks,
				"track-2",
				undefined,
				true,
			),
		);
		expect(api.fetchPlaylist).toHaveBeenCalledWith(session, detail.id, 1);
		expect(api.fetchPlaylist).toHaveBeenCalledWith(session, detail.id);
	});

	it("loads the next 20 rows at the scroll boundary and fetches the full queue for playback", async () => {
		let onIntersect: IntersectionObserverCallback | null = null;
		const observe = vi.fn();
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: IntersectionObserverCallback) {
					onIntersect = callback;
				}
				observe(target: Element) {
					observe(target);
				}
				disconnect() {}
			},
		);
		const all = Array.from({ length: 21 }, (_, index) => ({
			entryId: `entry-${index}`,
			position: index,
			addedAt: "",
			item: { Id: `track-${index}`, Name: `Track ${index}`, Type: "Audio" },
		}));
		const first = {
			...detail,
			itemCount: 21,
			items: all.slice(0, 20),
			page: 1,
			pageSize: 20,
			hasMore: true,
		};
		api.fetchPlaylist.mockImplementation(
			async (_session: AuthSession, _id: string, page?: number) =>
				page === 1
					? first
					: page === 2
						? { ...first, items: all.slice(20), page: 2, hasMore: false }
						: { ...first, items: all, hasMore: false },
		);
		render(<PlaylistDetailPage session={session} playlistId={detail.id} />);
		await screen.findByRole("button", { name: "play Track 19" });
		expect(
			screen.queryByRole("button", { name: "play Track 20" }),
		).not.toBeInTheDocument();
		await waitFor(() => expect(observe).toHaveBeenCalled());
		await act(async () => {
			onIntersect?.(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			);
		});
		await screen.findByRole("button", { name: "play Track 20" });
		fireEvent.click(screen.getByRole("button", { name: "playAll" }));
		await waitFor(() =>
			expect(player.playAlbum).toHaveBeenCalledWith(
				expect.anything(),
				all.map((entry) => entry.item),
				undefined,
				undefined,
				false,
			),
		);
		vi.unstubAllGlobals();
	});

	it("retries a failed page without discarding the loaded rows", async () => {
		let onIntersect: IntersectionObserverCallback = () => {};
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: IntersectionObserverCallback) {
					onIntersect = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		let pageAttempts = 0;
		const first = {
			...detail,
			page: 1,
			pageSize: 20,
			hasMore: true,
			itemCount: 21,
		};
		api.fetchPlaylist.mockImplementation(
			async (_session: AuthSession, _id: string, page?: number) => {
				if (page !== 2) return first;
				pageAttempts++;
				if (pageAttempts === 1) throw new Error("Temporary failure");
				return {
					...first,
					page: 2,
					hasMore: false,
					items: [
						{
							entryId: "entry-21",
							position: 20,
							addedAt: "",
							item: { Id: "track-21", Name: "Track Twenty One", Type: "Audio" },
						},
					],
				};
			},
		);
		render(<PlaylistDetailPage session={session} playlistId={detail.id} />);
		await screen.findByRole("button", { name: "play Track One" });
		await act(async () =>
			onIntersect(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			),
		);
		const retry = await screen.findByRole("button", { name: "retry" });
		expect(
			screen.getByRole("button", { name: "play Track One" }),
		).toBeInTheDocument();
		fireEvent.click(retry);
		await screen.findByRole("button", { name: "play Track Twenty One" });
		vi.unstubAllGlobals();
	});

	it("moves an entry across loaded pages using an adjacent entry anchor", async () => {
		let onIntersect: IntersectionObserverCallback = () => {};
		vi.stubGlobal(
			"IntersectionObserver",
			class {
				constructor(callback: IntersectionObserverCallback) {
					onIntersect = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		const all = Array.from({ length: 21 }, (_, index) => ({
			entryId: `entry-${index}`,
			position: index,
			addedAt: "",
			item: { Id: `track-${index}`, Name: `Track ${index}`, Type: "Audio" },
		}));
		let moved = false;
		api.fetchPlaylist.mockImplementation(
			async (_session: AuthSession, _id: string, page?: number) => {
				const ordered = moved ? [...all.slice(1), all[0]] : all;
				return {
					...detail,
					updatedAt: moved ? "revision-2" : "revision-1",
					itemCount: 21,
					items: page === 2 ? ordered.slice(20) : ordered.slice(0, 20),
					page: page ?? 1,
					pageSize: 20,
					hasMore: page !== 2,
				};
			},
		);
		api.move.mockImplementation(async () => {
			moved = true;
			return { ...detail, updatedAt: "revision-2", items: [] };
		});
		render(<PlaylistDetailPage session={session} playlistId={detail.id} />);
		await screen.findByRole("button", { name: "play Track 19" });
		await act(async () =>
			onIntersect(
				[{ isIntersecting: true } as IntersectionObserverEntry],
				{} as IntersectionObserver,
			),
		);
		await screen.findByRole("button", { name: "play Track 20" });
		act(() => drag.onReorder?.(0, 20));
		await waitFor(() =>
			expect(api.move).toHaveBeenCalledWith(session, detail.id, "entry-0", {
				afterEntryId: "entry-20",
			}),
		);
		vi.unstubAllGlobals();
	});
});
