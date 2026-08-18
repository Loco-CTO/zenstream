import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeAvatar, uploadAvatar } from "@/lib/profile";
import { authenticatedFetch } from "@/lib/authenticated-request";

vi.mock("@/lib/authenticated-request", () => ({
	authenticatedFetch: vi.fn(),
}));

const session = { token: "token", userId: "user-1", username: "Alex" };

describe("profile avatar API", () => {
	beforeEach(() => vi.mocked(authenticatedFetch).mockReset());

	it("uploads raw bytes with pixel crop parameters", async () => {
		vi.mocked(authenticatedFetch).mockResolvedValue(
			new Response(JSON.stringify({ avatarVersion: "version-2" }), {
				status: 200,
			}),
		);
		const file = new File(["avatar"], "avatar.png", { type: "image/png" });
		const crop = { cropX: 12.5, cropY: 24.5, cropSize: 80, rotation: 90 };

		await expect(uploadAvatar(session, file, crop)).resolves.toEqual({
			avatarVersion: "version-2",
		});
		const [, path, options] = vi.mocked(authenticatedFetch).mock.calls[0];
		const params = new URLSearchParams(path.split("?")[1]);
		expect(path).toContain("/api/account/avatar?");
		expect(params.get("cropX")).toBe("12.5");
		expect(params.get("cropY")).toBe("24.5");
		expect(params.get("cropSize")).toBe("80");
		expect(params.get("rotation")).toBe("90");
		expect(options).toMatchObject({
			method: "POST",
			body: file,
			headers: { "Content-Type": "image/png" },
		});
	});

	it("removes the current avatar through the authenticated account route", async () => {
		vi
			.mocked(authenticatedFetch)
			.mockResolvedValue(
				new Response(JSON.stringify({ avatarVersion: null }), { status: 200 }),
			);

		await expect(removeAvatar(session)).resolves.toEqual({ avatarVersion: null });
		expect(vi.mocked(authenticatedFetch)).toHaveBeenCalledWith(
			session,
			"/api/account/avatar",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
