import type { AuthResponse } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

export function sessionFromAuth(response: AuthResponse): AuthSession {
	const token = response.token;
	const userId = response.user?.id;
	const username = response.user?.username ?? "ZenStream";

	if (!userId) {
		throw new Error("Server did not return a complete login response.");
	}

	const session: AuthSession = { token: token ?? "", userId, username };
	if (response.user && "avatarVersion" in response.user)
		session.avatarVersion = response.user.avatarVersion ?? null;
	return session;
}
