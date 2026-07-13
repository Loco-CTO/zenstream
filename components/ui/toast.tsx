"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type ToastVariant = "success" | "error";
type Toast = { id: number; message: string; variant: ToastVariant };
type ToastContextValue = {
	success: (message: string) => void;
	error: (message: string) => void;
	dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_DURATION = 5_000;

export function ToastProvider({ children }: { children: ReactNode }) {
	const { t } = useI18n();
	const [toasts, setToasts] = useState<Toast[]>([]);
	const nextId = useRef(0);
	const timers = useRef(new Map<number, number>());

	const dismiss = useCallback((id: number) => {
		const timer = timers.current.get(id);
		if (timer) window.clearTimeout(timer);
		timers.current.delete(id);
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);
	const add = useCallback(
		(message: string, variant: ToastVariant) => {
			const id = nextId.current++;
			setToasts((current) => [...current, { id, message, variant }]);
			timers.current.set(
				id,
				window.setTimeout(() => dismiss(id), TOAST_DURATION),
			);
		},
		[dismiss],
	);

	useEffect(
		() => () => {
			for (const timer of timers.current.values()) window.clearTimeout(timer);
			timers.current.clear();
		},
		[],
	);

	const value = useMemo(
		() => ({
			success: (message: string) => add(message, "success"),
			error: (message: string) => add(message, "error"),
			dismiss,
		}),
		[add, dismiss],
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div
				className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[400] flex max-h-[calc(100dvh-6rem)] w-auto flex-col gap-2 overflow-y-auto sm:bottom-4 sm:left-auto sm:right-4 sm:max-h-none sm:w-[min(24rem,calc(100vw-2rem))]"
				aria-live="polite"
				aria-atomic="false"
			>
				{toasts.map((toast) => (
					<div
						key={toast.id}
						role={toast.variant === "error" ? "alert" : "status"}
						className="pointer-events-auto flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white shadow-2xl shadow-black/40 backdrop-blur-xl"
					>
						{toast.variant === "success" ? (
							<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
						) : (
							<CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
						)}
						<p className="min-w-0 flex-1">{toast.message}</p>
						<button
							type="button"
							onClick={() => dismiss(toast.id)}
							aria-label={t("toastDismiss")}
							className="-mr-1 -mt-1 rounded p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const context = useContext(ToastContext);
	if (!context)
		throw new Error("useToast must be used within a ToastProvider.");
	return context;
}
