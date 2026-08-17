import type { AuthResponse } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

export function sessionFromAuth(response: AuthResponse): AuthSession {
	const token = response.token;
	const userId = response.user?.id;
	const username = response.user?.username ?? "ZenStream";

	if (!userId) {
		throw new Error("Server did not return a complete login response.");
	}

	return { token: token ?? "", userId, username };
}
