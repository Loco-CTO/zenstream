type AudioPlayingIndicatorProps = {
	ariaLabel?: string;
	className?: string;
};

const BAR_HEIGHTS = [0.6, 1, 0.75];

export function AudioPlayingIndicator({
	ariaLabel,
	className = "h-4 w-4",
}: AudioPlayingIndicatorProps) {
	return (
		<span
			aria-label={ariaLabel}
			className={`inline-flex items-end justify-center gap-[2px] ${className}`}
		>
			{BAR_HEIGHTS.map((height, bar) => (
				<span
					key={bar}
					className="w-[3px] rounded-full bg-white"
					style={{
						height: `${height * 100}%`,
						animation: `pulse ${0.6 + bar * 0.15}s ease-in-out infinite alternate`,
					}}
				/>
			))}
		</span>
	);
}
