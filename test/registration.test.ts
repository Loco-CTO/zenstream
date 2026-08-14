import { afterEach, describe, expect, it, vi } from "vitest";
import { registerWithInvite, validateInvite } from "@/lib/media-api";

describe("public registration API", () => {
	afterEach(() => vi.restoreAllMocks());

	it("validates an invite through the public endpoint", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response('{"valid":true}', { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(validateInvite("token/value")).resolves.toBeUndefined();
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:9090/api/user/check_invite?invite=token%2Fvalue",
			expect.objectContaining({ credentials: "include" }),
		);
	});

	it("registers through JSON and exposes the created user", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response('{"user":{"id":"user-1","username":"alice"}}', {
					status: 201,
				}),
			);
		vi.stubGlobal("fetch", fetchMock);

		await expect(
			registerWithInvite("invite", " alice ", "password123"),
		).resolves.toEqual({
			user: { id: "user-1", username: "alice" },
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"http://localhost:9090/api/user/register",
			expect.objectContaining({
				method: "POST",
				credentials: "include",
				body: JSON.stringify({
					invite: "invite",
					username: "alice",
					password: "password123",
				}),
			}),
		);
	});
});
