import { act, render, waitFor } from "@testing-library/react";
import { createRequire } from "node:module";
import { afterEach, expect, it, vi } from "vitest";
import { useEffect } from "react";
import {
	SyncplayProvider,
	useSyncplay,
	type SyncplayGroup,
} from "@/lib/syncplay";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/toast";

const labUrl = process.env.SYNCPLAY_LIVE_URL;
type Lab = {
	groups: SyncplayGroup[];
	attempts: Record<string, number>;
	phase: string;
};
let controls: ReturnType<typeof useSyncplay>;
function MountedPlayerProbe() {
	const syncplay = useSyncplay();
	const { active, presence, recoveryEpoch } = syncplay;
	useEffect(() => {
		controls = syncplay;
	}, [syncplay]);
	useEffect(() => {
		if (active?.itemId) void presence(true, false);
	}, [
		active?.id,
		active?.itemId,
		active?.mediaGeneration,
		active?.timelineRevision,
		presence,
		recoveryEpoch,
	]);
	return <video data-testid="mounted-media" />;
}
afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

it.skipIf(!labUrl)(
	"recovers the mounted web provider and Android manager in their original room",
	async () => {
		const require = createRequire(import.meta.url);
		const jsdomRequire = createRequire(require.resolve("jsdom"));
		vi.stubGlobal("WebSocket", jsdomRequire("ws"));
		vi.stubEnv("NEXT_PUBLIC_ZSO_URL", labUrl!);
		async function state(): Promise<Lab> {
			return (await fetch(`${labUrl}/__test/state`)).json();
		}
		async function phase(value: string) {
			await fetch(`${labUrl}/__test/phase/${value}`, { method: "POST" });
		}
		const view = render(
			<I18nProvider locale="en">
				<ToastProvider>
					<SyncplayProvider
						session={{ token: "lab-web", userId: "lab-web", username: "Web" }}
					>
						<MountedPlayerProbe />
					</SyncplayProvider>
				</ToastProvider>
			</I18nProvider>,
		);
		try {
			await act(async () => {
				const existing = (await state()).groups[0];
				if (existing) await controls.join(existing.id);
				else await controls.create();
			});
			await waitFor(
				async () => expect((await state()).groups[0]?.members).toHaveLength(2),
				{ timeout: 60_000 },
			);
			await act(async () => {
				await controls.refresh();
			});
			const originalId = controls.active!.id;
			const originalHost = controls.active!.hostUserId;
			const video = view.getByTestId("mounted-media");
			await act(async () => {
				await controls.command({
					action: "media",
					itemId: "lab-movie",
					position: 0,
					playing: true,
				});
			});
			await waitFor(
				async () => expect((await state()).groups[0]?.playing).toBe(true),
				{ timeout: 15_000 },
			);
			await fetch(`${labUrl}/__test/disrupt`, { method: "POST" });
			await waitFor(
				async () => {
					const current = await state();
					expect(current.attempts["lab-web:snapshot"]).toBeGreaterThan(2);
					expect(current.attempts["lab-mobile:snapshot"]).toBeGreaterThan(2);
					expect(
						current.groups[0]?.members.every(
							(member) => member.viewing && !member.loading,
						),
					).toBe(true);
					expect(current.groups[0]?.playing).toBe(true);
				},
				{ timeout: 25_000 },
			);
			expect(controls.active?.id).toBe(originalId);
			expect(controls.active?.hostUserId).toBe(originalHost);
			expect(view.getByTestId("mounted-media")).toBe(video);
			await phase("background");
			await waitFor(
				async () =>
					expect((await state()).groups[0]?.pauseReason).toBe("background"),
				{ timeout: 10_000 },
			);
			await waitFor(async () =>
				expect(
					(await state()).groups[0]?.members.every(
						(member) => member.viewing && !member.loading,
					),
				).toBe(true),
			);
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect((await state()).groups[0]?.playing).toBe(false);
			await act(async () => {
				await controls.command({ action: "play", position: 0, playing: true });
			});
			await waitFor(async () =>
				expect((await state()).groups[0]?.playing).toBe(true),
			);
			await act(async () => {
				await controls.command({ action: "pause", position: 0, playing: false });
			});
			await new Promise((resolve) => setTimeout(resolve, 500));
			expect((await state()).groups[0]?.playing).toBe(false);
			await act(async () => {
				await controls.command({ action: "play", position: 0, playing: true });
			});
			await phase("done");
		} finally {
			view.unmount();
		}
	},
	100_000,
);
