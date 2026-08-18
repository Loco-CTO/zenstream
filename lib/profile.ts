import type { AuthSession } from "@/lib/session";
import { authenticatedFetch } from "@/lib/authenticated-request";

export const AVATAR_MAX_BYTES = 20 * 1024 * 1024;
export const AVATAR_ACCEPT = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/gif",
].join(",");

export type AvatarCropParams = {
	cropX: number;
	cropY: number;
	cropSize: number;
	rotation: number;
};

export type AvatarUpdate = {
	avatarVersion: string | null;
};

async function throwProfileError(response: Response, fallback: string): Promise<never> {
	const payload = (await response.json().catch(() => null)) as {
		detail?: unknown;
	} | null;
	throw new Error(
		typeof payload?.detail === "string" && payload.detail.trim()
			? payload.detail
			: fallback,
	);
}

export async function uploadAvatar(
	session: AuthSession,
	file: File,
	crop: AvatarCropParams,
): Promise<AvatarUpdate> {
	const params = new URLSearchParams({
		cropX: String(crop.cropX),
		cropY: String(crop.cropY),
		cropSize: String(crop.cropSize),
		rotation: String(crop.rotation),
	});
	const response = await authenticatedFetch(
		session,
		`/api/account/avatar?${params.toString()}`,
		{
			method: "POST",
			body: file,
			headers: {
				"Content-Type": file.type || "application/octet-stream",
			},
			cache: "no-store",
		},
	);
	if (!response.ok)
		return throwProfileError(response, "Avatar upload failed.");
	return (await response.json()) as AvatarUpdate;
}

export async function removeAvatar(session: AuthSession): Promise<AvatarUpdate> {
	const response = await authenticatedFetch(
		session,
		"/api/account/avatar",
		{ method: "DELETE", cache: "no-store" },
	);
	if (!response.ok)
		return throwProfileError(response, "Avatar removal failed.");
	return (await response.json()) as AvatarUpdate;
}
