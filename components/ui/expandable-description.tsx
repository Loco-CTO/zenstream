"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function ExpandableDescription({
	description,
	className = "",
}: {
	description: string;
	className?: string;
}) {
	const { t } = useI18n();
	const descriptionId = useId();
	const textRef = useRef<HTMLParagraphElement>(null);
	const [expandedDescription, setExpandedDescription] = useState<string | null>(
		null,
	);
	const [overflow, setOverflow] = useState({
		description,
		hasMore: false,
	});
	const expanded = expandedDescription === description;
	const hasMore = overflow.description === description && overflow.hasMore;

	const measureOverflow = useCallback(() => {
		const element = textRef.current;
		if (!element || expanded) return;
		setOverflow({
			description,
			hasMore: element.scrollHeight > element.clientHeight + 1,
		});
	}, [description, expanded]);

	useEffect(() => {
		if (expanded) return;
		const element = textRef.current;
		if (!element) return;

		measureOverflow();
		window.addEventListener("resize", measureOverflow);
		if (typeof ResizeObserver === "undefined") {
			return () => window.removeEventListener("resize", measureOverflow);
		}
		const observer = new ResizeObserver(measureOverflow);
		observer.observe(element);
		return () => {
			window.removeEventListener("resize", measureOverflow);
			observer.disconnect();
		};
	}, [description, expanded, measureOverflow]);

	return (
		<div className={className}>
			<p
				id={descriptionId}
				ref={textRef}
				className={expanded ? undefined : "line-clamp-3"}
			>
				{description}
			</p>
			{hasMore && (
				<button
					type="button"
					aria-controls={descriptionId}
					aria-expanded={expanded}
					onClick={() =>
						setExpandedDescription((current) =>
							current === description ? null : description,
						)
					}
					className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-white/60 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
				>
					{t(expanded ? "showLess" : "showMore")}
					<ChevronDown
						aria-hidden="true"
						className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
					/>
				</button>
			)}
		</div>
	);
}
