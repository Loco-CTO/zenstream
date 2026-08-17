import { afterEach, describe, expect, it } from "vitest";
import {
	clearAuthCookies,
	getAuthSession,
	setAuthCookies,
} from "@/lib/session";

describe("auth cookies", () => {
	afterEach(() => {
		clearAuthCookies();
	});

	it("persists and reads the session", () => {
		setAuthCookies({ token: "token-1", userId: "user-1", username: "Alex" });

		expect(getAuthSession()).toEqual({
			token: "",
			userId: "user-1",
			username: "Alex",
		});
	});

	it("returns null when auth cookies are missing", () => {
		clearAuthCookies();

		expect(getAuthSession()).toBeNull();
	});
});
