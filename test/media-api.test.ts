import { afterEach, describe, expect, it, vi } from "vitest";
import { changeAccountPassword } from "@/lib/media-api";

const session = { token: "bearer-token", userId: "user-1", username: "Alex" };

afterEach(() => {
	vi.restoreAllMocks();
});

describe("changeAccountPassword", () => {
	it("posts the authenticated password payload and accepts 204", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 204 }));

		await changeAccountPassword(
			session,
			"current-password",
			"new-password",
			"new-password",
		);

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/api/account/password"),
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				headers: expect.objectContaining({
					Accept: "application/json",
					Authorization: "Bearer bearer-token",
					"Content-Type": "application/json",
				}),
				body: JSON.stringify({
					currentPassword: "current-password",
					newPassword: "new-password",
					confirmNewPassword: "new-password",
				}),
			}),
		);
	});
});
