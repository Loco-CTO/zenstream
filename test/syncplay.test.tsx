import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
	SyncplayProvider,
	useSyncplay,
	type SyncplayGroup,
} from "@/lib/syncplay";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";

vi.mock("@/lib/authenticated-request", async () => {
	const actual = await vi.importActual<
		typeof import("@/lib/authenticated-request")
	>("@/lib/authenticated-request");
	const authenticatedFetch = actual.authenticatedFetch;
	return {
		...actual,
		authenticatedFetch: vi.fn(
			async (...args: Parameters<typeof authenticatedFetch>) => {
				const [, path] = args;
				if (path === "/api/auth/socket-ticket") {
					socketTicketGate.requested = true;
					return (
						socketTicketGate.response ??
						new Response(JSON.stringify({ ticket: "socket-ticket" }))
					);
				}
				return authenticatedFetch(...args);
			},
		),
	};
});

const socketTicketGate = vi.hoisted(() => ({
	response: null as Promise<Response> | null,
	requested: false,
}));

class TestSocket {
	static latest: TestSocket | null = null;
	static openAutomatically = true;
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSED = 3;
	readonly url: string;
	readyState = TestSocket.CONNECTING;
	onopen: (() => void) | null = null;
	onclose: ((event: { reason: string }) => void) | null = null;
	onerror: (() => void) | null = null;
	onmessage: ((event: { data: string }) => void) | null = null;
	send = vi.fn();
	close = vi.fn(() => {
		this.readyState = TestSocket.CLOSED;
		this.onclose?.({ reason: "" });
	});
	constructor(url: string) {
		this.url = url;
		TestSocket.latest = this;
		if (TestSocket.openAutomatically)
			queueMicrotask(() => {
				this.readyState = TestSocket.OPEN;
				this.onopen?.();
			});
	}
	receive(event: string, message?: unknown) {
		const type = event.startsWith("syncplay:")
			? event.slice("syncplay:".length)
			: event;
		const payload =
			message && typeof message === "object"
				? (message as Record<string, unknown>)
				: {};
		this.onmessage?.({ data: JSON.stringify({ type, ...payload }) });
	}
}
vi.stubGlobal("WebSocket", TestSocket);

vi.mock("next/navigation", () => ({
	usePathname: () => "/show/movie",
	useRouter: () => ({ push: vi.fn() }),
}));

const group = (revision: number): SyncplayGroup => ({
	id: "group",
	name: "Alex's group",
	hostUserId: "user",
	hostName: "Alex",
	allowViewerControls: false,
	itemId: "movie",
	position: 0,
	playing: false,
	resumeWhenReady: false,
	revision,
	mediaGeneration: 0,
	updatedAt: 0,
	members: [],
});
const joinedGroup = (revision: number): SyncplayGroup => ({
	...group(revision),
	members: [
		{
			userId: "user",
			username: "Alex",
			viewing: false,
			loading: false,
			role: "host",
		},
	],
});

function Controls() {
	const syncplay = useSyncplay();
	return (
		<>
			<button onClick={() => void syncplay.join("group")}>Join</button>
			<button onClick={() => void syncplay.create()}>Create</button>
			<button onClick={() => void syncplay.join("other-group")}>Join other</button>
			<button onClick={() => void syncplay.leave()}>Leave</button>
			<button onClick={() => void syncplay.refresh()}>Refresh</button>
			<button onClick={() => void syncplay.setControls(true)}>
				Enable controls
			</button>
			<button
				onClick={() =>
					void syncplay.command({
						action: "play",
						itemId: "movie",
						position: 0,
						playing: true,
					})
				}
			>
				Play
			</button>
			<button
				onClick={() =>
					void syncplay.command({
						action: "media",
						itemId: "movie",
						position: 0,
						playing: true,
					})
				}
			>
				Start media
			</button>
			<button onClick={() => void syncplay.setWatchingTogether(false)}>
				Browse
			</button>
			<button
				onClick={() =>
					void syncplay.command({
						action: "seek",
						itemId: "movie",
						position: 10,
						playing: true,
					})
				}
			>
				Seek 10
			</button>
			<button
				onClick={() =>
					void syncplay.command({
						action: "seek",
						itemId: "movie",
						position: 20,
						playing: true,
					})
				}
			>
				Seek 20
			</button>
			<span data-testid="active-group">{syncplay.active?.id ?? "none"}</span>
			<span data-testid="active-revision">
				{syncplay.active?.revision ?? "none"}
			</span>
		</>
	);
}

function GroupCount() {
	return <span data-testid="group-count">{useSyncplay().groups.length}</span>;
}

function PresenceControl() {
	const syncplay = useSyncplay();
	return (
		<button onClick={() => void syncplay.presence(true, false)}>Presence</button>
	);
}

const session = { token: "token", userId: "user", username: "Alex" };
function SyncplayTestProvider({ children }: { children: ReactNode }) {
	return (
		<I18nProvider locale="en">
			<ToastProvider>
				<SyncplayProvider session={session}>{children}</SyncplayProvider>
			</ToastProvider>
		</I18nProvider>
	);
}

describe("SyncplayProvider", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		TestSocket.openAutomatically = true;
		TestSocket.latest = null;
		socketTicketGate.response = null;
		socketTicketGate.requested = false;
	});
	it("normalizes a trailing slash in the public WebSocket origin", async () => {
		const originalOrigin = process.env.NEXT_PUBLIC_ZSO_URL;
		process.env.NEXT_PUBLIC_ZSO_URL = "https://zso.domain.com/";
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		try {
			await waitFor(() =>
				expect(TestSocket.latest?.url).toMatch(
					/^ws:\/\/zso\.domain\.com\/api\/ws\/syncplay\?ticket=socket-ticket&participantId=/,
				),
			);
		} finally {
			view.unmount();
			if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_ZSO_URL;
			else process.env.NEXT_PUBLIC_ZSO_URL = originalOrigin;
		}
	});

	it("disconnects the WebSocket when the provider unmounts", async () => {
		TestSocket.openAutomatically = false;
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(TestSocket.latest).not.toBeNull());
		const socket = TestSocket.latest;
		view.unmount();
		expect(socket?.close).toHaveBeenCalled();
		TestSocket.openAutomatically = true;
	});

	it("does not create a socket after cleanup cancels a pending ticket", async () => {
		let resolveTicket!: (response: Response) => void;
		socketTicketGate.response = new Promise<Response>((resolve) => {
			resolveTicket = resolve;
		});
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(socketTicketGate.requested).toBe(true));
		view.unmount();
		resolveTicket(new Response(JSON.stringify({ ticket: "late-ticket" })));
		await act(async () => {
			await Promise.resolve();
			await Promise.resolve();
		});
		expect(TestSocket.latest).toBeNull();
	});

	it("loads visible groups even when the WebSocket never opens", async () => {
		TestSocket.openAutomatically = false;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					groups: [
						{
							...group(1),
							hostUserId: "alex",
							members: [
								{
									userId: "alex",
									username: "Alex",
									viewing: false,
									loading: false,
									role: "host",
								},
							],
						},
					],
				}),
			),
		);
		render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("group-count")).toHaveTextContent("1"),
		);
		TestSocket.openAutomatically = true;
	});

	it("does not activate a privacy-redacted HTTP lobby group", async () => {
		TestSocket.openAutomatically = false;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					groups: [
						{
							...group(1),
							hostUserId: null,
							itemId: null,
							members: [
								{
									role: "host",
									watchingTogether: true,
									viewing: false,
									loading: false,
								} as unknown as SyncplayGroup["members"][number],
							],
						},
					],
				}),
			),
		);
		render(
			<SyncplayTestProvider>
				<Controls />
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("group-count")).toHaveTextContent("1"),
		);
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
		TestSocket.openAutomatically = true;
	});

	it("refreshes the revision and retries a stale playback command once", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(
						JSON.stringify({
							groups: [
								{
									...group(1),
									members: [
										{
											userId: "user",
											username: "Alex",
											viewing: false,
											loading: false,
											role: "host",
										},
									],
								},
							],
						}),
					);
				if (url.endsWith("/groups/group/join"))
					return new Response(JSON.stringify(joinedGroup(1)));
				if (url.endsWith("/groups/group/command")) {
					const revision = JSON.parse(String(init?.body)).expectedRevision;
					return revision === 1
						? new Response(
								JSON.stringify({ message: "Playback state is out of date." }),
								{ status: 409 },
							)
						: new Response(JSON.stringify(joinedGroup(3)));
				}
				if (url.endsWith("/groups/group"))
					return new Response(JSON.stringify(joinedGroup(2)));
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining("/api/syncplay/groups/group/join"),
				expect.any(Object),
			),
		);
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() => {
			const commands = fetchMock.mock.calls.filter(([url]) =>
				String(url).endsWith("/groups/group/command"),
			);
			expect(commands).toHaveLength(2);
			expect(JSON.parse(String(commands[0][1]?.body)).expectedRevision).toBe(1);
			expect(JSON.parse(String(commands[1][1]?.body)).expectedRevision).toBe(2);
		});
	});

	it("restores a group the user already belongs to after the provider remounts", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					groups: [
						{
							...group(1),
							members: [
								{
									userId: "user",
									username: "Alex",
									viewing: false,
									loading: false,
									role: "host",
								},
							],
						},
					],
				}),
			),
		);
		function ActiveGroup() {
			const syncplay = useSyncplay();
			return <span>{syncplay.active?.id ?? "none"}</span>;
		}
		render(
			<SyncplayTestProvider>
				<ActiveGroup />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(screen.getByText("group")).toBeInTheDocument());
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/syncplay/groups"),
			expect.any(Object),
		);
	});

	it("blocks creating or joining another group while already active", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ groups: [{ ...joinedGroup(1) }] })),
			);
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Create" }));
		fireEvent.click(screen.getByRole("button", { name: "Join other" }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(
			fetchMock.mock.calls.filter(
				([url, init]) => String(url).includes("/groups") && init?.method === "POST",
			),
		).toHaveLength(0);
	});

	it("keeps only the latest queued seek", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
				if (url.endsWith("/groups/group/command"))
					return new Response(JSON.stringify(joinedGroup(2)));
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Seek 10" }));
		fireEvent.click(screen.getByRole("button", { name: "Seek 20" }));

		await waitFor(() => {
			const commands = fetchMock.mock.calls.filter(([url]) =>
				String(url).endsWith("/groups/group/command"),
			);
			expect(commands).toHaveLength(1);
			expect(JSON.parse(String(commands[0][1]?.body)).position).toBe(20);
		});
	});

	it("includes the active timeline revision in presence reports", async () => {
		const active = {
			...joinedGroup(4),
			timelineRevision: 7,
		};
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [active] }));
				if (url.endsWith("/groups/group/presence"))
					return new Response(JSON.stringify(active));
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<PresenceControl />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(screen.getByText("Presence")).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));

		await waitFor(() => {
			const request = fetchMock.mock.calls.find(
				([url, init]) =>
					String(url).endsWith("/groups/group/presence") && init?.method === "POST",
			);
			expect(request).toBeDefined();
			expect(JSON.parse(String(request?.[1]?.body)).timelineRevision).toBe(7);
		});
	});

	it("applies a newer group state sent by the WebSocket", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					groups: [
						{
							...group(1),
							members: [
								{
									userId: "user",
									username: "Alex",
									viewing: false,
									loading: false,
									role: "host",
								},
							],
						},
					],
				}),
			),
		);
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("1"),
		);
		act(() =>
			TestSocket.latest?.receive("syncplay:group", {
				group: {
					...group(2),
					members: [
						{
							userId: "user",
							username: "Alex",
							viewing: true,
							loading: false,
							role: "host",
						},
					],
				},
			}),
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("2"),
		);
	});

	it("announces one viewer-control change for an HTTP response and duplicate socket echo", async () => {
		const enabled = { ...joinedGroup(2), allowViewerControls: true };
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
				if (url.endsWith("/groups/group") && init?.method === "PATCH")
					return new Response(JSON.stringify(enabled));
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Enable controls" }));
		await waitFor(() =>
			expect(
				screen.getAllByText("Viewer controls were enabled for everyone."),
			).toHaveLength(1),
		);
		act(() =>
			TestSocket.latest?.receive("syncplay:group", { group: enabled }),
		);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(
			screen.getAllByText("Viewer controls were enabled for everyone."),
		).toHaveLength(1);
		expect(
			fetchMock.mock.calls.filter(
				([url, init]) =>
					String(url).endsWith("/groups/group") && init?.method === "PATCH",
			),
		).toHaveLength(1);
	});

	it("keeps another user's broadcast discoverable without joining it", async () => {
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ groups: [] })));
		render(
			<SyncplayTestProvider>
				<Controls />
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);
		act(() =>
			TestSocket.latest?.receive("syncplay:group", {
				group: {
					...group(1),
					hostUserId: "alex",
					members: [
						{
							role: "host",
							watchingTogether: true,
							viewing: false,
							loading: false,
						} as unknown as SyncplayGroup["members"][number],
					],
				},
			}),
		);
		await waitFor(() =>
			expect(screen.getByTestId("group-count")).toHaveTextContent("1"),
		);
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
	});

	it("clears a stale group when leaving it is rejected because membership changed", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [] }));
			if (url.endsWith("/groups/group/join"))
				return new Response(JSON.stringify(joinedGroup(1)));
			if (url.endsWith("/groups/group") && init?.method === "DELETE")
				return new Response(JSON.stringify({ message: "Join this group first." }), {
					status: 403,
				});
			throw new Error(`Unexpected request: ${url}`);
		});

		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Leave" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);
	});

	it("keeps the latest state when readiness changes make the retry stale too", async () => {
		const latest = {
			...group(3),
			members: [
				{
					userId: "user",
					username: "Alex",
					viewing: true,
					loading: false,
					role: "host" as const,
				},
			],
		};
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [latest] }));
				if (url.endsWith("/groups/group/join"))
					return new Response(JSON.stringify(latest));
				if (url.endsWith("/groups/group/command"))
					return new Response(
						JSON.stringify({ message: "Playback state is out of date." }),
						{ status: 409 },
					);
				if (url.endsWith("/groups/group"))
					return new Response(JSON.stringify(latest));
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() =>
			expect(
				fetchMock.mock.calls.filter(([url]) =>
					String(url).endsWith("/groups/group/command"),
				),
			).toHaveLength(2),
		);
	});

	it("announces remote member changes after the initial group state", async () => {
		let revision = 1;
		let members: SyncplayGroup["members"] = [
			{
				userId: "user",
				username: "Alex",
				viewing: false,
				loading: false,
				role: "host",
			},
		];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			if (
				String(input).endsWith("/groups") &&
				(!init?.method || init.method === "GET")
			)
				return new Response(
					JSON.stringify({ groups: [{ ...group(revision), members }] }),
				);
			throw new Error(`Unexpected request: ${String(input)}`);
		});
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		members = [
			...members,
			{
				userId: "sam",
				participantId: "participant-sam",
				username: "Sam",
				viewing: false,
				loading: false,
				role: "viewer",
			},
		];
		revision = 2;
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() =>
			expect(screen.getByText("Sam joined the group.")).toBeInTheDocument(),
		);
		members = members.filter((member) => member.userId !== "sam");
		revision = 3;
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() =>
			expect(screen.getByText("Sam left the group.")).toBeInTheDocument(),
		);
	});

	it("announces the resolved media title when Syncplay switches titles", async () => {
		const waiting = {
			...group(1),
			itemId: null,
			members: [
				{
					userId: "user",
					username: "Alex",
					viewing: false,
					loading: false,
					role: "host" as const,
				},
			],
		};
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [waiting] }));
			if (url.endsWith("/groups/group/command"))
				return new Response(
					JSON.stringify({
						...waiting,
						itemId: "movie",
						mediaGeneration: 1,
						revision: 2,
					}),
				);
			if (url.endsWith("/api/catalog/items/movie"))
				return new Response(
					JSON.stringify({
						id: "movie",
						libraryId: "movies",
						type: "movie",
						name: "Movie Name",
						metadata: { title: "Movie Name" },
					}),
				);
			throw new Error(`Unexpected request: ${url}`);
		});
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Start media" }));
		await waitFor(() =>
			expect(screen.getByText("Now playing Movie Name.")).toBeInTheDocument(),
		);
	});

	it("optimistically leaves playback while remaining in the group", async () => {
		const browsing = {
			...joinedGroup(2),
			members: [{ ...joinedGroup(2).members[0], watchingTogether: false }],
		};
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
				if (url.endsWith("/groups/group/participation"))
					return new Response(JSON.stringify(browsing));
				throw new Error(`Unexpected request: ${url}`);
			});
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Browse" }));
		await waitFor(() =>
			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining("/api/syncplay/groups/group/participation"),
				expect.objectContaining({ method: "POST" }),
			),
		);
		expect(screen.getByTestId("active-group")).toHaveTextContent("group");
	});

	it("does not let a stale poll overwrite newer playback state", async () => {
		const newer = {
			...group(3),
			members: [
				{
					userId: "user",
					username: "Alex",
					viewing: true,
					loading: false,
					role: "host" as const,
				},
			],
		};
		const stale = {
			...newer,
			revision: 1,
			playing: false,
			resumeWhenReady: true,
		};
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [stale] }));
			if (url.endsWith("/groups/group/join"))
				return new Response(JSON.stringify(newer));
			throw new Error(`Unexpected request: ${url}`);
		});
		render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("3"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("3"),
		);
	});
});
