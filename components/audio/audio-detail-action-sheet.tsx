"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { BlurHashImage, MediaPlaceholder } from "@/components/ui/blurhash-image";
import { useI18n } from "@/lib/i18n";
import { seriesPosterImage, type MediaItem } from "@/lib/media-api";

export function AudioDetailActionSheet({
	item,
	subtitle,
	children,
	onClose,
}: {
	item: MediaItem;
	subtitle?: string;
	children: ReactNode;
	onClose: () => void;
}) {
	const { t } = useI18n();
	const image = seriesPosterImage(item);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [onClose]);

	if (typeof document === "undefined") return null;
	return createPortal(
		<div className="fixed inset-0 z-[110] flex items-end justify-center">
			<button
				type="button"
				aria-label={t("close")}
				onClick={onClose}
				className="absolute inset-0 bg-black/55 backdrop-blur-sm"
			/>
			<section
				role="dialog"
				aria-modal="true"
				aria-label={t("showMore")}
				className="relative flex max-h-[82dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#202023]/95 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl"
			>
				<div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-3 [padding-bottom:max(2rem,env(safe-area-inset-bottom))]">
					<div aria-hidden="true" className="mx-auto mb-6 h-1.5 w-14 rounded-full bg-white/35" />
					<header className="mb-5 flex min-w-0 items-center gap-4">
						<div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/[0.06]">
							{image ? (
								<BlurHashImage image={image} alt="" sizes="64px" className="h-full w-full object-cover" />
							) : (
								<MediaPlaceholder />
							)}
						</div>
						<div className="min-w-0">
							<h2 className="truncate text-lg font-bold">{item.Name}</h2>
							{subtitle && <p className="mt-1 truncate text-sm text-white/50">{subtitle}</p>}
						</div>
					</header>
					<div className="space-y-1">{children}</div>
				</div>
			</section>
		</div>,
		document.body,
	);
}

export function AudioDetailSheetAction({
	icon,
	children,
	onClick,
	className = "",
}: {
	icon: ReactNode;
	children: ReactNode;
	onClick?: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex min-h-14 w-full items-center gap-4 rounded-xl px-3 text-left text-base text-white/85 transition hover:bg-white/[0.07] active:bg-white/[0.11] ${className}`}
		>
			<span className="flex h-9 w-9 shrink-0 items-center justify-center text-white/75">{icon}</span>
			<span className="min-w-0 flex-1 truncate">{children}</span>
		</button>
	);
}
