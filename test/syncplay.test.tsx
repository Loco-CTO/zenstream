import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncplayProvider, useSyncplay, type SyncplayGroup } from "@/lib/syncplay";

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
	updatedAt: 0,
	members: [],
});

function Controls() {
	const syncplay = useSyncplay();
	return <>
		<button onClick={() => void syncplay.join("group")}>Join</button>
		<button onClick={() => void syncplay.leave()}>Leave</button>
		<button onClick={() => void syncplay.command({ action: "play", itemId: "movie", position: 0, playing: true })}>Play</button>
		<span data-testid="active-group">{syncplay.active?.id ?? "none"}</span>
	</>;
}

describe("SyncplayProvider", () => {
	it("refreshes the revision and retries a stale playback command once", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(group(1)));
			if (url.endsWith("/groups/group/command")) {
				const revision = JSON.parse(String(init?.body)).revision;
				return revision === 1
					? new Response(JSON.stringify({ message: "Playback state is out of date." }), { status: 409 })
					: new Response(JSON.stringify(group(3)));
			}
			if (url.endsWith("/groups/group")) return new Response(JSON.stringify(group(2)));
			throw new Error(`Unexpected request: ${url}`);
		});

		render(<SyncplayProvider userId="user"><Controls /></SyncplayProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/syncplay/groups/group/join", expect.any(Object)));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() => {
			const commands = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/groups/group/command"));
			expect(commands).toHaveLength(2);
			expect(JSON.parse(String(commands[0][1]?.body)).revision).toBe(1);
			expect(JSON.parse(String(commands[1][1]?.body)).revision).toBe(2);
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
		render(<SyncplayProvider userId="user"><ActiveGroup /></SyncplayProvider>);
		await waitFor(() => expect(screen.getByText("group")).toBeInTheDocument());
		expect(fetchMock).toHaveBeenCalledWith("/api/syncplay/groups", expect.any(Object));
	});

	it("clears a stale group when leaving it is rejected because membership changed", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			if (url.endsWith("/groups") && (!init?.method || init.method === "GET"))
				return new Response(JSON.stringify({ groups: [] }));
			if (url.endsWith("/groups/group/join")) return new Response(JSON.stringify(group(1)));
			if (url.endsWith("/groups/group") && init?.method === "DELETE")
				return new Response(JSON.stringify({ message: "Join this group first." }), { status: 403 });
			throw new Error(`Unexpected request: ${url}`);
		});

		render(<SyncplayProvider userId="user"><Controls /></SyncplayProvider>);
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

		render(<SyncplayProvider userId="user"><Controls /></SyncplayProvider>);
		fireEvent.click(screen.getByRole("button", { name: "Join" }));
		await waitFor(() => expect(screen.getByTestId("active-group")).toHaveTextContent("group"));
		fireEvent.click(screen.getByRole("button", { name: "Play" }));

		await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/groups/group/command"))).toHaveLength(2));
	});
});
