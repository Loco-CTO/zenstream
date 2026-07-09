import type { AuthResponse } from "@/lib/jellyfin";
import type { AuthSession } from "@/lib/session";

export function sessionFromAuth(response: AuthResponse): AuthSession {
	const token = response.AccessToken;
	const userId = response.User?.Id;
	const username = response.User?.Name ?? "ZenStream";

	if (!token || !userId) {
		throw new Error("Server did not return a complete login response.");
	}

	return { token, userId, username };
}
