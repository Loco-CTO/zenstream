import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { io } from "socket.io-client";
import { SyncplayProvider, useSyncplay, type SyncplayGroup } from "@/lib/syncplay";
import { ToastProvider } from "@/components/ui/toast";
import { I18nProvider } from "@/lib/i18n";

class TestSocket {
	static latest: TestSocket | null = null;
	static openAutomatically = true;
	private handlers = new Map<string, (message?: unknown) => void>();
	connect = vi.fn();
	disconnect = vi.fn();
	constructor() {
		TestSocket.latest = this;
	}
	on(event: string, handler: (message?: unknown) => void) {
		this.handlers.set(event, handler);
		if (event === "connect" && TestSocket.openAutomatically) queueMicrotask(() => handler());
		return this;
	}
	receive(event: string, message?: unknown) { this.handlers.get(event)?.(message); }
}
vi.mock("socket.io-client", () => ({ io: vi.fn(() => new TestSocket()) }));


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
	members: [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" }],
});

function Controls() {
	const syncplay = useSyncplay();
	return <>
		<button onClick={() => void syncplay.join("group")}>Join</button>
		<button onClick={() => void syncplay.leave()}>Leave</button>
		<button onClick={() => void syncplay.refresh()}>Refresh</button>
		<button onClick={() => void syncplay.command({ action: "play", itemId: "movie", position: 0, playing: true })}>Play</button>
		<span data-testid="active-group">{syncplay.active?.id ?? "none"}</span>
		<span data-testid="active-revision">{syncplay.active?.revision ?? "none"}</span>
	</>;
}

function GroupCount() {
	return <span data-testid="group-count">{useSyncplay().groups.length}</span>;
}

const session = { token: "token", userId: "user", username: "Alex" };
function SyncplayTestProvider({ children }: { children: ReactNode }) {
	return <I18nProvider locale="en"><ToastProvider><SyncplayProvider session={session}>{children}</SyncplayProvider></ToastProvider></I18nProvider>;
}

describe("SyncplayProvider", () => {
	it("normalizes a trailing slash in the public Socket.IO origin", () => {
		const originalOrigin = process.env.NEXT_PUBLIC_ZSO_URL;
		process.env.NEXT_PUBLIC_ZSO_URL = "https://zso.amai.space/";
		const socketFactory = vi.mocked(io);
		const initialCalls = socketFactory.mock.calls.length;
		const view = render(<SyncplayTestProvider><GroupCount /></SyncplayTestProvider>);
		expect(socketFactory.mock.calls[initialCalls]?.[0]).toBe("https://zso.amai.space/syncplay");
		view.unmount();
		if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_ZSO_URL;
		else process.env.NEXT_PUBLIC_ZSO_URL = originalOrigin;
	});

	it("disconnects the Socket.IO client when the provider unmounts", () => {
		TestSocket.openAutomatically = false;
		const view = render(<SyncplayTestProvider><GroupCount /></SyncplayTestProvider>);
		const socket = TestSocket.latest;
		view.unmount();
		expect(socket?.disconnect).toHaveBeenCalled();
		TestSocket.openAutomatically = true;
	});

	it("loads visible groups even when the WebSocket never opens", async () => {
		TestSocket.openAutomatically = false;
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ groups: [{ ...group(1), hostUserId: "alex", members: [{ userId: "alex", username: "Alex", viewing: false, loading: false, role: "host" }] }] })),
		);
		render(<SyncplayTestProvider><GroupCount /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByTestId("group-count")).toHaveTextContent("1"));
		TestSocket.openAutomatically = true;
	});

	it("refreshes the revision and retries a stale playback command once", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [{ ...group(1), members: [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" }] }] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(joinedGroup(1)));
			if (url.endsWith("/groups/group/command")) {
				const revision = JSON.parse(String(init?.body)).expectedRevision;
				return revision === 1
					? new Response(JSON.stringify({ message: "Playback state is out of date." }), { status: 409 })
					: new Response(JSON.stringify(joinedGroup(3)));
			}
			if (url.endsWith("/groups/group")) return new Response(JSON.stringify(joinedGroup(2)));
			throw new Error(`Unexpected request: ${url}`);
		});

		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/syncplay/groups/group/join", expect.any(Object)));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() => {
			const commands = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/groups/group/command"));
			expect(commands).toHaveLength(2);
			expect(JSON.parse(String(commands[0][1]?.body)).expectedRevision).toBe(1);
			expect(JSON.parse(String(commands[1][1]?.body)).expectedRevision).toBe(2);
		});
	});

	it("restores a group the user already belongs to after the provider remounts", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ groups: [{ ...group(1), members: [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" }] }] })),
		);
		function ActiveGroup() {
			const syncplay = useSyncplay();
			return <span>{syncplay.active?.id ?? "none"}</span>;
		}
		render(<SyncplayTestProvider><ActiveGroup /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByText("group")).toBeInTheDocument());
		expect(fetchMock).toHaveBeenCalledWith("/api/syncplay/groups", expect.any(Object));
	});

	it("applies a newer group state sent by the WebSocket", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ groups: [{ ...group(1), members: [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" }] }] })),
		);
		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByTestId("active-revision")).toHaveTextContent("1"));
		act(() => TestSocket.latest?.receive("syncplay:group", { group: { ...group(2), members: [{ userId: "user", username: "Alex", viewing: true, loading: false, role: "host" }] } }));
		await waitFor(() => expect(screen.getByTestId("active-revision")).toHaveTextContent("2"));
	});

	it("keeps another user's broadcast discoverable without joining it", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ groups: [] })),
		);
		render(<SyncplayTestProvider><Controls /><GroupCount /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("none"));
		act(() => TestSocket.latest?.receive("syncplay:group", {
			group: {
				...group(1),
				hostUserId: "alex",
				members: [{ userId: "alex", username: "Alex", viewing: false, loading: false, role: "host" }],
			},
		}));
		await waitFor(() => expect(screen.getByTestId("group-count")).toHaveTextContent("1"));
		expect(screen.getByTestId("active-group")).toHaveTextContent("none");
	});

	it("clears a stale group when leaving it is rejected because membership changed", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(joinedGroup(1)));
			if (url.endsWith("/groups/group") && init?.method === "DELETE")
				return new Response(JSON.stringify({ message: "Join this group first." }), { status: 403 });
			throw new Error(`Unexpected request: ${url}`);
		});

		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("group"));
		fireEvent.click(screen.getByRole("button", { name: "Leave" }));
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("none"));
	});

	it("keeps the latest state when readiness changes make the retry stale too", async () => {
		const latest = { ...group(3), members: [{ userId: "user", username: "Alex", viewing: true, loading: false, role: "host" as const }] };
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [latest] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(latest));
			if (url.endsWith("/groups/group/command"))
				return new Response(JSON.stringify({ message: "Playback state is out of date." }), { status: 409 });
			if (url.endsWith("/groups/group")) return new Response(JSON.stringify(latest));
			throw new Error(`Unexpected request: ${url}`);
		});

		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("group"));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/groups/group/command"))).toHaveLength(2));
	});

	it("announces remote member changes after the initial group state", async () => {
		let members: SyncplayGroup["members"] = [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" }];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			if (String(input).endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [{ ...group(1), members }] }));
			throw new Error(`Unexpected request: ${String(input)}`);
		});
		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("group"));
		members = [...members, { userId: "sam", username: "Sam", viewing: false, loading: false, role: "viewer" }];
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(screen.getByText("Sam joined the group.")).toBeInTheDocument());
		members = members.filter((member) => member.userId !== "sam");
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(screen.getByText("Sam left the group.")).toBeInTheDocument());
	});

	it("announces the resolved media title when Syncplay switches titles", async () => {
		const waiting = { ...group(1), itemId: null, members: [{ userId: "user", username: "Alex", viewing: false, loading: false, role: "host" as const }] };
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ groups: [waiting] }));
			if (url.endsWith("/groups/group/command")) return new Response(JSON.stringify({ ...waiting, itemId: "movie" }));
			if (url.endsWith("/Items/movie")) return new Response(JSON.stringify({ Id: "movie", Name: "Movie Name" }));
			throw new Error(`Unexpected request: ${url}`);
		});
		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("group"));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));
		await waitFor(() => expect(screen.getByText("Now playing Movie Name.")).toBeInTheDocument());
	});

	it("does not let a stale poll overwrite newer playback state", async () => {
		const newer = { ...group(3), members: [{ userId: "user", username: "Alex", viewing: true, loading: false, role: "host" as const }] };
		const stale = { ...newer, revision: 1, playing: false, resumeWhenReady: true };
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET")) return new Response(JSON.stringify({ groups: [stale] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(newer));
			throw new Error(`Unexpected request: ${url}`);
		});
		render(<SyncplayTestProvider><Controls /></SyncplayTestProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(screen.getByTestId("active-revision")).toHaveTextContent("3"));
		fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
		await waitFor(() => expect(screen.getByTestId("active-revision")).toHaveTextContent("3"));
	});
});
