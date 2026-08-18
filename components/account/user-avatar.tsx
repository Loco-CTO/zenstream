"use client";

import { useState } from "react";
import { userImageUrl, userInitial } from "@/lib/media-api";

export function UserAvatar({
	displayName,
	userId,
	avatarVersion,
	containerClassName = "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/8 ring-1 ring-white/12",
	imageClassName = "h-full w-full object-cover",
	fallbackClassName = "text-base font-semibold text-white/80",
}: {
	displayName: string;
	userId: string;
	avatarVersion?: string | null;
	containerClassName?: string;
	imageClassName?: string;
	fallbackClassName?: string;
}) {
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const imageUrl = userImageUrl(userId, avatarVersion);
	const failed = imageUrl !== null && failedUrl === imageUrl;

	return (
		<div className={containerClassName}>
			{!imageUrl || failed ? (
				<span data-testid="default-user-initial" className={fallbackClassName}>
					{userInitial(displayName)}
				</span>
			) : (
				<img
					src={imageUrl}
					alt=""
					className={imageClassName}
					onError={() => setFailedUrl(imageUrl)}
				/>
			)}
		</div>
	);
}
