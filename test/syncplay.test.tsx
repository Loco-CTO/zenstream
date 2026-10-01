import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
	SyncplayProvider,
	syncplayPresenceReportIsCurrent,
	useSyncplay,
	type SyncplayGroup,
} from "@/lib/syncplay";
import type { SyncplayPresenceDelivery } from "@/lib/syncplay-presence";
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
					socketTicketGate.requests += 1;
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
	requests: 0,
}));

class TestSocket {
	static latest: TestSocket | null = null;
	static instances: TestSocket[] = [];
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
		TestSocket.instances.push(this);
		if (TestSocket.openAutomatically)
			queueMicrotask(() => {
				if (this.readyState !== TestSocket.CONNECTING) return;
				this.readyState = TestSocket.OPEN;
				this.onopen?.();
			});
	}
	drop(reason = "network") {
		this.readyState = TestSocket.CLOSED;
		this.onclose?.({ reason });
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
			viewing: true,
			loading: false,
			role: "host",
		},
	],
});

function Controls({
	onCommandSettled,
}: {
	onCommandSettled?: (status: "resolved" | "rejected") => void;
} = {}) {
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
				onClick={() => {
					const request = syncplay.command({
						action: "play",
						itemId: "movie",
						position: 0,
						playing: true,
					});
					if (onCommandSettled)
						void request.then(
							() => onCommandSettled("resolved"),
							() => onCommandSettled("rejected"),
						);
				}}
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

function PresenceControl({
	onPresence,
}: {
	onPresence?: (promise: Promise<SyncplayPresenceDelivery>) => void;
}) {
	const syncplay = useSyncplay();
	return (
		<button
			onClick={() => {
				const promise = syncplay.presence(true, false);
				onPresence?.(promise);
			}}
		>
			Presence
		</button>
	);
}

const session = { token: "token", userId: "user", username: "Alex" };
const contractFixtureRoot = process.env.ZENSTREAM_API_FIXTURE_ROOT;
const syncplayWireFixtures = contractFixtureRoot
	? (JSON.parse(
			readFileSync(path.join(contractFixtureRoot, "syncplay.json"), "utf8"),
		) as {
			messages: Array<{
				name: string;
				direction: "client-to-server" | "server-to-client";
				payload: Record<string, unknown>;
			}>;
		})
	: null;

function SyncplayTestProvider({ children }: { children: ReactNode }) {
	return (
		<I18nProvider locale="en">
			<ToastProvider>
				<SyncplayProvider session={session}>{children}</SyncplayProvider>
			</ToastProvider>
		</I18nProvider>
	);
}

describe("syncplayPresenceReportIsCurrent", () => {
	const active = {
		...joinedGroup(4),
		itemId: "episode-2",
		mediaGeneration: 3,
		timelineRevision: 8,
	};
	const report = {
		groupId: active.id,
		itemId: active.itemId,
		generation: active.mediaGeneration,
		timelineRevision: active.timelineRevision,
	};

	it("accepts a report for the active group timeline", () => {
		expect(syncplayPresenceReportIsCurrent(report, active)).toBe(true);
	});

	it.each([
		["group", { groupId: "other-group" }],
		["item", { itemId: "episode-1" }],
		["generation", { generation: 2 }],
		["timeline", { timelineRevision: 7 }],
	])("rejects a stale %s report", (_label, change) => {
		expect(
			syncplayPresenceReportIsCurrent({ ...report, ...change }, active),
		).toBe(false);
	});
});

describe("SyncplayProvider", () => {
	it("adopts a changed timeline without acknowledging readiness for the old timeline", async () => {
		TestSocket.openAutomatically = false;
		const initial = { ...joinedGroup(1), timelineRevision: 1 };
		const changed = { ...joinedGroup(2), timelineRevision: 2 };
		vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(
				async (input) =>
					new Response(
						JSON.stringify(
							String(input).endsWith("/presence") ? changed : { groups: [initial] },
						),
					),
			);
		let delivery: Promise<SyncplayPresenceDelivery> | undefined;
		const view = render(
			<SyncplayTestProvider>
				<Controls />
				<PresenceControl
					onPresence={(value) => {
						delivery = value;
					}}
				/>
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("1"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("2"),
		);
		expect(await delivery).toBe("superseded");
		view.unmount();
	});
	it("cancels readiness when leaving and cannot restore membership from late responses", async () => {
		TestSocket.openAutomatically = false;
		let reads = 0;
		let resolveSnapshot!: (response: Response) => void;
		let resolvePresence!: (response: Response) => void;
		let resolveLeave!: (response: Response) => void;
		const snapshot = new Promise<Response>((resolve) => {
			resolveSnapshot = resolve;
		});
		const presence = new Promise<Response>((resolve) => {
			resolvePresence = resolve;
		});
		const leave = new Promise<Response>((resolve) => {
			resolveLeave = resolve;
		});
		let presenceSignal: AbortSignal | null | undefined;
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/join"))
				return new Response(JSON.stringify(joinedGroup(102)));
			if (url.endsWith("/presence")) {
				presenceSignal = init?.signal;
				return presence;
			}
			if (init?.method === "DELETE") return leave;
			reads += 1;
			if (reads === 2) return snapshot;
			return new Response(
				JSON.stringify({ groups: [reads === 1 ? joinedGroup(1) : group(3)] }),
			);
		});
		let delivery: Promise<SyncplayPresenceDelivery> | undefined;
		const view = render(
			<SyncplayTestProvider>
				<Controls />
				<GroupCount />
				<PresenceControl
					onPresence={(value) => {
						delivery = value;
					}}
				/>
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(presenceSignal).toBeDefined());
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(reads).toBe(2));
		fireEvent.click(screen.getByRole("button", { name: "Leave" }));
		expect(await delivery).toBe("superseded");
		expect(presenceSignal?.aborted).toBe(true);
		await act(async () => {
			resolveLeave(new Response(null, { status: 204 }));
		});
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);
		await act(async () => {
			resolveSnapshot(new Response(JSON.stringify({ groups: [joinedGroup(99)] })));
			resolvePresence(new Response(JSON.stringify(joinedGroup(100))));
			TestSocket.latest?.receive("group", { group: joinedGroup(101) });
		});
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
		// Leaving still permits discovering the room and explicitly joining it again.
		expect(screen.getByTestId("group-count")).toHaveTextContent("1");
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-revision")).toHaveTextContent("102"),
		);
		view.unmount();
	});
	it("cannot restore a removed member from a late socket frame", async () => {
		TestSocket.openAutomatically = false;
		let removed = false;
		vi.spyOn(globalThis, "fetch").mockImplementation(
			async () =>
				new Response(
					JSON.stringify({
						groups: [removed ? { ...joinedGroup(2), members: [] } : joinedGroup(1)],
					}),
				),
		);
		const view = render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		removed = true;
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);
		act(() => TestSocket.latest?.receive("group", { group: joinedGroup(99) }));
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
		view.unmount();
	});
	it("invalidates a pending snapshot when the account changes", async () => {
		TestSocket.openAutomatically = false;
		let release!: (response: Response) => void;
		const oldSnapshot = new Promise<Response>((resolve) => {
			release = resolve;
		});
		vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
			const authorization = (init?.headers as Record<string, string>)
				?.Authorization;
			return authorization === "Bearer old"
				? oldSnapshot
				: new Response('{"groups":[]}');
		});
		const tree = (token: string, userId: string) => (
			<I18nProvider locale="en">
				<ToastProvider>
					<SyncplayProvider session={{ token, userId, username: "Alex" }}>
						<Controls />
					</SyncplayProvider>
				</ToastProvider>
			</I18nProvider>
		);
		const view = render(tree("old", "user"));
		view.rerender(tree("new", "another-user"));
		await act(async () => {
			release(new Response(JSON.stringify({ groups: [joinedGroup(99)] })));
		});
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
		view.unmount();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		TestSocket.openAutomatically = true;
		TestSocket.latest = null;
		TestSocket.instances = [];
		socketTicketGate.response = null;
		socketTicketGate.requested = false;
		socketTicketGate.requests = 0;
	});
	it("retries a failed reconnect snapshot on the same socket and room", async () => {
		const room = { ...joinedGroup(1), timelineRevision: 1 };
		let failRead = false;
		let reads = 0;
		let reports = 0;
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			if (String(input).endsWith("/presence")) {
				reports += 1;
				return new Response(JSON.stringify(room));
			}
			reads += 1;
			if (failRead) {
				failRead = false;
				return new Response("{}", { status: 503 });
			}
			return new Response(JSON.stringify({ groups: [room] }));
		});
		const view = render(
			<SyncplayTestProvider>
				<PresenceControl />
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		await new Promise((resolve) => setTimeout(resolve, 50));
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(reports).toBe(1));
		failRead = true;
		const before = reads;
		act(() => TestSocket.latest?.drop());
		await waitFor(() => expect(reports).toBe(2), { timeout: 3_000 });
		expect(reads).toBeGreaterThanOrEqual(before + 2);
		expect(TestSocket.instances).toHaveLength(2);
		expect(screen.getByTestId("active-group")).toHaveTextContent("group");
		view.unmount();
	});
	it("retains a failed ready report with its operation and sequence until acknowledged", async () => {
		TestSocket.openAutomatically = false;
		const room = joinedGroup(1);
		const bodies: Array<Record<string, unknown>> = [];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			if (String(input).endsWith("/presence")) {
				bodies.push(JSON.parse(String(init?.body)));
				if (bodies.length === 1) throw new TypeError("Response lost");
				return new Response(JSON.stringify(room));
			}
			return new Response(JSON.stringify({ groups: [room] }));
		});
		let completion: Promise<SyncplayPresenceDelivery> | undefined;
		const view = render(
			<SyncplayTestProvider>
				<PresenceControl
					onPresence={(value) => {
						completion = value;
					}}
				/>
				<Controls />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(bodies).toHaveLength(2), { timeout: 3_000 });
		expect(await completion).toBe("acknowledged");
		expect(bodies[0]).toEqual(bodies[1]);
		view.unmount();
	});
	it("bounds stalled ticket and socket opening attempts", async () => {
		vi.useFakeTimers();
		TestSocket.openAutomatically = false;
		socketTicketGate.response = new Promise<Response>(() => undefined);
		vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response('{"groups":[]}'));
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		expect(socketTicketGate.requests).toBe(1);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(8_000);
		});
		socketTicketGate.response = null;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(500);
		});
		expect(TestSocket.instances).toHaveLength(1);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(10_000);
		});
		expect(TestSocket.instances[0].close).toHaveBeenCalled();
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1_000);
		});
		expect(TestSocket.instances).toHaveLength(2);
		view.unmount();
	});
	it("expires a stalled HTTP response body and retries without discarding membership", async () => {
		vi.useFakeTimers();
		TestSocket.openAutomatically = false;
		let reads = 0;
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
			if (++reads === 1) {
				const response = new Response("{}");
				vi
					.spyOn(response, "json")
					.mockImplementation(() => new Promise(() => undefined));
				return response;
			}
			return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
		});
		const view = render(
			<SyncplayTestProvider>
				<Controls />
			</SyncplayTestProvider>,
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(8_501);
		});
		expect(reads).toBe(2);
		expect(screen.getByTestId("active-group")).toHaveTextContent("group");
		view.unmount();
	});
	it("reconnects after 90 seconds without a valid clock reply and ignores late socket frames", async () => {
		vi.useFakeTimers();
		vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async () => new Response('{"groups":[]}'));
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await act(async () => {
			await vi.advanceTimersByTimeAsync(1);
		});
		const old = TestSocket.latest!;
		await act(async () => {
			await vi.advanceTimersByTimeAsync(90_500);
		});
		expect(old.close).toHaveBeenCalled();
		expect(TestSocket.instances).toHaveLength(2);
		act(() => old.receive("group", { group: joinedGroup(99) }));
		expect(screen.getByTestId("group-count")).toHaveTextContent("0");
		view.unmount();
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

	it.skipIf(!syncplayWireFixtures)(
		"parses the shared Syncplay wire-message fixtures",
		async () => {
			vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
				if (String(input).endsWith("/api/syncplay/groups"))
					return new Response(JSON.stringify({ groups: [] }));
				throw new Error(`Unexpected request: ${String(input)}`);
			});
			render(
				<SyncplayTestProvider>
					<Controls />
					<GroupCount />
				</SyncplayTestProvider>,
			);
			await waitFor(() =>
				expect(TestSocket.latest?.readyState).toBe(TestSocket.OPEN),
			);

			const message = (name: string) =>
				syncplayWireFixtures?.messages.find((fixture) => fixture.name === name)
					?.payload;
			act(() =>
				TestSocket.latest?.receive("syncplay:groups", message("initial-groups")),
			);
			await waitFor(() =>
				expect(screen.getByTestId("group-count")).toHaveTextContent("1"),
			);

			act(() =>
				TestSocket.latest?.receive("syncplay:group", message("group-update")),
			);
			await waitFor(() =>
				expect(screen.getByTestId("group-count")).toHaveTextContent("1"),
			);

			act(() =>
				TestSocket.latest?.receive("syncplay:group-ended", message("group-ended")),
			);
			await waitFor(() =>
				expect(screen.getByTestId("group-count")).toHaveTextContent("0"),
			);

			act(() => {
				TestSocket.latest?.receive(
					"syncplay:participant-replaced",
					message("participant-replaced"),
				);
				TestSocket.latest?.receive("clock", message("clock-response"));
			});
			expect(TestSocket.latest?.readyState).toBe(TestSocket.OPEN);
		},
	);

	it("retries a failed socket ticket and reconnects automatically", async () => {
		let releaseTicket!: (response: Response) => void;
		socketTicketGate.response = new Promise<Response>((resolve) => {
			releaseTicket = resolve;
		});
		vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(JSON.stringify({ groups: [] })));

		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(socketTicketGate.requested).toBe(true));
		releaseTicket(
			new Response(JSON.stringify({ message: "temporary failure" }), {
				status: 503,
			}),
		);
		socketTicketGate.response = null;

		await waitFor(
			() => expect(socketTicketGate.requests).toBeGreaterThanOrEqual(2),
			{ timeout: 3_000 },
		);
		await waitFor(() => expect(TestSocket.instances).toHaveLength(1), {
			timeout: 3_000,
		});
		view.unmount();
	});

	it("refreshes the snapshot and replays presence after a socket drop", async () => {
		const initial = joinedGroup(1);
		const refreshed = { ...joinedGroup(2), timelineRevision: 1 };
		let groupReads = 0;
		const presenceBodies: Array<Record<string, unknown>> = [];
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET")) {
					groupReads += 1;
					return new Response(
						JSON.stringify({ groups: [groupReads === 1 ? initial : refreshed] }),
					);
				}
				if (url.endsWith("/groups/group/presence")) {
					presenceBodies.push(
						JSON.parse(String(init?.body)) as Record<string, unknown>,
					);
					return new Response(JSON.stringify(refreshed));
				}
				throw new Error(`Unexpected request: ${url}`);
			});

		const view = render(
			<SyncplayTestProvider>
				<PresenceControl />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(screen.getByText("Presence")).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(presenceBodies.length).toBeGreaterThanOrEqual(1));
		await new Promise((resolve) => setTimeout(resolve, 50));
		const initialPresenceCount = presenceBodies.length;
		const firstSocket = TestSocket.latest;
		const readsBeforeReconnect = groupReads;

		act(() => firstSocket?.drop());
		await waitFor(() => expect(TestSocket.instances).toHaveLength(2), {
			timeout: 3_000,
		});
		await waitFor(
			() => expect(groupReads).toBeGreaterThan(readsBeforeReconnect),
			{ timeout: 3_000 },
		);
		await waitFor(
			() => expect(presenceBodies.length).toBeGreaterThan(initialPresenceCount),
			{
				timeout: 3_000,
			},
		);
		expect(presenceBodies[initialPresenceCount].presenceSequence).toBeGreaterThan(
			presenceBodies[initialPresenceCount - 1].presenceSequence as number,
		);
		expect(
			fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/groups")),
		).toHaveLength(groupReads);
		view.unmount();
	});

	it("cancels a scheduled reconnect when the provider unmounts", async () => {
		const view = render(
			<SyncplayTestProvider>
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(TestSocket.latest).not.toBeNull());
		const socketCount = TestSocket.instances.length;
		act(() => TestSocket.latest?.drop());
		view.unmount();
		await new Promise((resolve) => setTimeout(resolve, 650));
		expect(TestSocket.instances).toHaveLength(socketCount);
	});

	it("restores the presence sequence across provider remounts", async () => {
		TestSocket.openAutomatically = false;
		const presenceBodies: Array<Record<string, unknown>> = [];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
			if (url.endsWith("/groups/group/presence")) {
				presenceBodies.push(
					JSON.parse(String(init?.body)) as Record<string, unknown>,
				);
				return new Response(JSON.stringify(joinedGroup(1)));
			}
			throw new Error(`Unexpected request: ${url}`);
		});

		const firstView = render(
			<SyncplayTestProvider>
				<PresenceControl />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(screen.getByText("Presence")).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(presenceBodies.length).toBeGreaterThanOrEqual(1));
		await new Promise((resolve) => setTimeout(resolve, 50));
		const firstSequence = presenceBodies.at(-1)!.presenceSequence as number;
		const initialPresenceCount = presenceBodies.length;
		firstView.unmount();

		const secondView = render(
			<SyncplayTestProvider>
				<PresenceControl />
			</SyncplayTestProvider>,
		);
		await waitFor(() => expect(screen.getByText("Presence")).toBeInTheDocument());
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() =>
			expect(presenceBodies.length).toBeGreaterThan(initialPresenceCount),
		);
		expect(presenceBodies[initialPresenceCount].presenceSequence).toBeGreaterThan(
			firstSequence,
		);
		secondView.unmount();
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

	it.each([404, 410])(
		"silently clears a stale group after a terminal playback response (%s)",
		async (status) => {
			TestSocket.openAutomatically = false;
			const fetchMock = vi
				.spyOn(globalThis, "fetch")
				.mockImplementation(async (input, init) => {
					const url = String(input);
					if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
						return new Response(JSON.stringify({ groups: [] }));
					if (url.endsWith("/groups/group/join"))
						return new Response(JSON.stringify(joinedGroup(1)));
					if (url.endsWith("/groups/group/command"))
						return new Response(JSON.stringify({ message: "Group ended." }), {
							status,
						});
					throw new Error(`Unexpected request: ${url}`);
				});

			render(
				<SyncplayTestProvider>
					<Controls />
					<GroupCount />
				</SyncplayTestProvider>,
			);
			fireEvent.click(screen.getByRole("button", { name: "Join" }));
			await waitFor(() =>
				expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
			);
			fireEvent.click(screen.getByRole("button", { name: "Play" }));

			await waitFor(() =>
				expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
			);
			expect(screen.getByTestId("group-count")).toHaveTextContent("0");
			expect(
				fetchMock.mock.calls.filter(([url]) =>
					String(url).endsWith("/groups/group/command"),
				),
			).toHaveLength(1);
			expect(
				screen.queryByText("Could not update Syncplay playback."),
			).not.toBeInTheDocument();

			act(() =>
				TestSocket.latest?.receive("syncplay:group", {
					group: joinedGroup(2),
				}),
			);
			await waitFor(() => {
				expect(screen.getByTestId("active-group")).toHaveTextContent("none");
				expect(screen.getByTestId("group-count")).toHaveTextContent("0");
			});
		},
	);

	it("keeps a delayed refresh from restoring a tombstoned group", async () => {
		TestSocket.openAutomatically = false;
		let groupRefreshes = 0;
		let resolveRefresh!: (response: Response) => void;
		const delayedRefresh = new Promise<Response>((resolve) => {
			resolveRefresh = resolve;
		});
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET")) {
				groupRefreshes += 1;
				return groupRefreshes === 1
					? new Response(JSON.stringify({ groups: [] }))
					: delayedRefresh;
			}
			if (url.endsWith("/groups/group/join"))
				return new Response(JSON.stringify(joinedGroup(1)));
			if (url.endsWith("/groups/group/command"))
				return new Response(JSON.stringify({ message: "Group ended." }), {
					status: 404,
				});
			throw new Error(`Unexpected request: ${url}`);
		});

		render(
			<SyncplayTestProvider>
				<Controls />
				<GroupCount />
			</SyncplayTestProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(groupRefreshes).toBe(2));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);

		resolveRefresh(new Response(JSON.stringify({ groups: [joinedGroup(2)] })));
		await waitFor(() => {
			expect(screen.getByTestId("active-group")).toHaveTextContent("none");
			expect(screen.getByTestId("group-count")).toHaveTextContent("0");
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

	it("drops a queued presence report after the active timeline is superseded", async () => {
		TestSocket.openAutomatically = false;
		const initial = {
			...joinedGroup(4),
			itemId: "episode-1",
			mediaGeneration: 1,
			timelineRevision: 7,
		};
		const superseded = {
			...initial,
			revision: 5,
			itemId: "episode-2",
			mediaGeneration: 2,
			timelineRevision: 8,
		};
		let releaseFirstPresence: ((response: Response) => void) | undefined;
		const firstPresence = new Promise<Response>((resolve) => {
			releaseFirstPresence = resolve;
		});
		const presenceBodies: unknown[] = [];
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [initial] }));
				if (url.endsWith("/groups/group/presence")) {
					presenceBodies.push(JSON.parse(String(init?.body)));
					if (presenceBodies.length === 1) return firstPresence;
					return new Response(JSON.stringify(superseded));
				}
				throw new Error(`Unexpected request: ${url}`);
			});
		let completion: Promise<SyncplayPresenceDelivery> | undefined;

		render(
			<SyncplayTestProvider>
				<PresenceControl onPresence={(promise) => (completion = promise)} />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(
				fetchMock.mock.calls.some(
					([url, init]) =>
						String(url).endsWith("/groups") &&
						(!init?.method || init.method === "GET"),
				),
			).toBe(true),
		);
		await waitFor(() => expect(TestSocket.latest).not.toBeNull());

		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() => expect(presenceBodies).toHaveLength(1));
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		act(() =>
			TestSocket.latest?.receive("syncplay:group", { group: superseded }),
		);
		releaseFirstPresence?.(new Response(JSON.stringify(initial)));
		await completion;

		expect(presenceBodies).toHaveLength(1);
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
		act(() => TestSocket.latest?.receive("syncplay:group", { group: enabled }));
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

	it("silently clears the group after a terminal presence response", async () => {
		TestSocket.openAutomatically = false;
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (input, init) => {
				const url = String(input);
				if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
					return new Response(JSON.stringify({ groups: [joinedGroup(1)] }));
				if (url.endsWith("/groups/group/presence"))
					return new Response(JSON.stringify({ message: "Group ended." }), {
						status: 410,
					});
				throw new Error(`Unexpected request: ${url}`);
			});

		render(
			<SyncplayTestProvider>
				<Controls />
				<PresenceControl />
				<GroupCount />
			</SyncplayTestProvider>,
		);
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("group"),
		);
		fireEvent.click(screen.getByRole("button", { name: "Presence" }));
		await waitFor(() =>
			expect(screen.getByTestId("active-group")).toHaveTextContent("none"),
		);
		expect(screen.getByTestId("group-count")).toHaveTextContent("0");
		expect(
			fetchMock.mock.calls.filter(([url]) =>
				String(url).endsWith("/groups/group/presence"),
			),
		).toHaveLength(1);
		expect(
			screen.queryByText("Could not update Syncplay readiness."),
		).not.toBeInTheDocument();
	});

	it("rejects when readiness changes make the retry stale too", async () => {
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

		const commandSettled = vi.fn();
		render(
			<SyncplayTestProvider>
				<Controls onCommandSettled={commandSettled} />
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
		await waitFor(() => expect(commandSettled).toHaveBeenCalledWith("rejected"));
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

	it("shows one fallback notification for a duplicate media state", async () => {
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
		const playing = {
			...waiting,
			itemId: "movie",
			mediaGeneration: 1,
			revision: 2,
		};
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [waiting] }));
			if (url.endsWith("/groups/group/command"))
				return new Response(JSON.stringify(playing));
			if (url.endsWith("/api/catalog/items/movie"))
				return new Response(JSON.stringify({ message: "not found" }), {
					status: 404,
				});
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
			expect(screen.getAllByText("Syncplay started playback.")).toHaveLength(1),
		);
		act(() => TestSocket.latest?.receive("syncplay:group", { group: playing }));
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(screen.getAllByText("Syncplay started playback.")).toHaveLength(1);
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
