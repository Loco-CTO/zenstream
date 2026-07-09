import type { ButtonHTMLAttributes } from "react";

const primaryActionClasses =
	"flex h-11 min-w-28 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold tracking-normal text-black shadow-lg shadow-black/30 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60";

export function PrimaryActionButton({
	className = "",
	...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
	return (
		<button
			{...props}
			className={`${primaryActionClasses} ${className}`.trim()}
		/>
	);
}
