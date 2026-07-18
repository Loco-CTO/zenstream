"use client";

import { Check } from "lucide-react";

export function Checkbox({
	checked,
	onChange,
	label,
}: {
	checked: boolean;
	onChange: (checked: boolean) => void;
	label: string;
}) {
	return (
		<label className="group flex cursor-pointer items-center gap-2.5 text-xs text-white/60 transition hover:text-white/80">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="peer sr-only"
			/>
			<span className="flex h-4 w-4 items-center justify-center rounded border border-white/25 bg-white/[0.04] text-transparent transition group-hover:border-white/45 peer-checked:border-violet-300 peer-checked:bg-violet-300 peer-checked:text-black peer-focus-visible:ring-2 peer-focus-visible:ring-violet-300/50">
				<Check className="h-3 w-3" strokeWidth={3} />
			</span>
			{label}
		</label>
	);
}
