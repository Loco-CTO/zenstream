"use client";

import { useState } from "react";
import { useProgress } from "@/components/status/progress-indicator";
import { useI18n } from "@/lib/i18n";

export function LoginPage({
	onLogin,
}: {
	onLogin: (username: string, password: string) => Promise<void>;
}) {
	const { start } = useProgress();
	const { t } = useI18n();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const submit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setError(null);
		const finishProgress = start();
		try {
			await onLogin(username.trim(), password);
		} catch {
			setError(t("loginFailed"));
		} finally {
			finishProgress();
			setSubmitting(false);
		}
	};

	return (
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,0.18),transparent_36%),linear-gradient(180deg,#111,#080808_50%)]" />
			<form
				onSubmit={submit}
				className="relative w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-7"
			>
				<img
					src="/icon.png"
					alt="ZenStream"
					className="mb-7 h-12 w-12 object-contain"
				/>
				<h1 className="text-3xl font-black tracking-normal text-white">
					{t("welcome")}
				</h1>
				<p className="mt-2 text-sm leading-6 text-white/40">
					{t("loginDescription")}
				</p>
				<label
					htmlFor="login-username"
					className="mt-7 block text-xs font-semibold uppercase tracking-[0.14em] text-white/35"
				>
					{t("username")}
				</label>
				<input
					id="login-username"
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-violet-400/70"
					autoComplete="username"
					required
				/>
				<label
					htmlFor="login-password"
					className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-white/35"
				>
					{t("password")}
				</label>
				<input
					id="login-password"
					value={password}
					onChange={(event) => setPassword(event.target.value)}
					type="password"
					className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-violet-400/70"
					autoComplete="current-password"
					required
				/>
				{error && (
					<p role="alert" className="mt-4 text-sm text-red-300">
						{error}
					</p>
				)}
				<button
					type="submit"
					disabled={submitting}
					className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-white text-xs font-bold uppercase tracking-[0.12em] text-black shadow-lg shadow-black/30 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{t("login")}
				</button>
			</form>
		</main>
	);
}
