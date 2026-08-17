"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { MediaItem } from "@/lib/media-api";
import { useEffect, useRef, useState } from "react";
import {
	PosterCard,
	StackedPosterCard,
	WideCard,
} from "@/components/home/media-card";
import { stackNewlyAdded } from "@/lib/media";
import { useI18n } from "@/lib/i18n";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";
import type { AuthSession } from "@/lib/session";

export function MediaRow({
	title,
	items,
	variant,
	stackEpisodes = false,
	session,
	viewAllHref,
}: {
	title: string;
	items: MediaItem[];
	variant: "wide" | "poster";
	stackEpisodes?: boolean;
	session?: AuthSession;
	viewAllHref?: string;
}) {
	const { t } = useI18n();

	if (items.length === 0) {
		return null;
	}

	return (
		<DeferredRow>
			<section className="group select-none px-4 py-4 sm:px-6 sm:py-5 md:px-10">
				<div className="mb-4 flex items-center justify-between">
					<h2 className="text-xs font-semibold uppercase tracking-[0.13em] text-white/50">
						{title}
					</h2>
					{viewAllHref ? (
						<Link
							href={viewAllHref}
							className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-white/25 transition hover:text-white/70"
						>
							{t("all")} <ChevronRight className="h-3 w-3" />
						</Link>
					) : null}
				</div>
				<HorizontalScroller title={title}>
					{stackEpisodes
						? stackNewlyAdded(items).map((stack) => (
								<StackedPosterCard
									key={stack.key}
									items={stack.items}
									session={session}
								/>
							))
						: items.map((item) =>
								variant === "wide" ? (
									<WideCard key={item.Id} item={item} session={session} />
								) : (
									<PosterCard key={item.Id} item={item} session={session} />
								),
							)}
				</HorizontalScroller>
			</section>
		</DeferredRow>
	);
}

function DeferredRow({ children }: { children: React.ReactNode }) {
	const host = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(
		() => typeof IntersectionObserver === "undefined",
	);

	useEffect(() => {
		if (visible || !host.current || typeof IntersectionObserver === "undefined")
			return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "600px 0px" },
		);
		observer.observe(host.current);
		return () => observer.disconnect();
	}, [visible]);

	return (
		<div
			ref={host}
			className="min-h-24"
			style={{ contentVisibility: visible ? "visible" : "auto" }}
		>
			{visible ? children : null}
		</div>
	);
}
