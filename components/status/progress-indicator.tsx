"use client";

import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
} from "react";

type ProgressContextValue = {
	start: () => () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: React.ReactNode }) {
	const tasks = useRef(new Set<symbol>());
	const [active, setActive] = useState(false);

	const start = useCallback(() => {
		const task = Symbol("progress-task");
		tasks.current.add(task);
		setActive(true);

		return () => {
			tasks.current.delete(task);
			setActive(tasks.current.size > 0);
		};
	}, []);

	return (
		<ProgressContext.Provider value={{ start }}>
			<div
				role="progressbar"
				aria-label="Loading"
				aria-valuetext={active ? "Loading" : "Idle"}
				className={`fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden transition-opacity duration-200 ${
					active ? "opacity-100" : "pointer-events-none opacity-0"
				}`}
			>
				<div className="zenstream-progress h-full w-2/5 bg-gradient-to-r from-violet-600 via-violet-300 to-white shadow-[0_0_10px_rgba(167,139,250,0.8)]" />
			</div>
			{children}
		</ProgressContext.Provider>
	);
}

export function useProgress() {
	const progress = useContext(ProgressContext);

	if (!progress) {
		throw new Error("useProgress must be used within ProgressProvider");
	}

	return progress;
}
