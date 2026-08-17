"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { registerWithInvite, validateInvite } from "@/lib/media-api";
import { setAuthCookies } from "@/lib/session";
import { useI18n } from "@/lib/i18n";

export default function RegisterPage() {
	const router = useRouter();
	const { t } = useI18n();
	const usernameRef = useRef<HTMLInputElement>(null);
	const inviteRef = useRef("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
		"checking",
	);
	const [message, setMessage] = useState("");
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		const token = new URLSearchParams(window.location.search).get("invite") || "";
		inviteRef.current = token;
		void (
			token
				? validateInvite(token)
				: Promise.reject(
						new Error("This registration link is missing its invite token."),
					)
		)
			.then(() => {
				setStatus("ready");
				window.requestAnimationFrame(() => usernameRef.current?.focus());
			})
			.catch(() => {
				setMessage("This invite is invalid, expired, or has no uses remaining.");
				setStatus("invalid");
			});
	}, []);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (status !== "ready" || submitting) return;
		if (password !== confirmPassword) {
			setMessage(t("passwordsDoNotMatch"));
			return;
		}
		setSubmitting(true);
		setMessage("");
		try {
			const response = await registerWithInvite(
				inviteRef.current,
				username,
				password,
			);
			const user = response.user;
			if (!user?.id || !user.username) throw new Error("Registration failed.");
			setAuthCookies({ token: "", userId: user.id, username: user.username });
			router.replace("/");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Registration failed.");
			setSubmitting(false);
		}
	}

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
					Create an account
				</h1>
				<p className="mt-2 text-sm leading-6 text-white/40">
					Your invitation grants access to the libraries selected by the
					administrator.
				</p>
				{status === "ready" ? (
					<>
						<label className="mt-7 block text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
							Username
						</label>
						<input
							ref={usernameRef}
							value={username}
							onChange={(event) => setUsername(event.target.value)}
							className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-violet-400/70"
							autoComplete="username"
							required
						/>
						<label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
							Password
						</label>
						<input
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							type="password"
							className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-violet-400/70"
							autoComplete="new-password"
							minLength={8}
							required
						/>
						<label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
							{t("confirmPassword")}
						</label>
						<input
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							type="password"
							className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm text-white outline-none transition focus:border-violet-400/70"
							autoComplete="new-password"
							minLength={8}
							required
						/>
					</>
				) : (
					<p className="mt-7 text-sm text-white/60">
						{status === "checking" ? "Checking your invite…" : message}
					</p>
				)}
				{message && status === "ready" && (
					<p role="alert" className="mt-4 text-sm text-red-300">
						{message}
					</p>
				)}
				{status === "ready" && (
					<button
						type="submit"
						disabled={submitting}
						className="mt-6 flex h-11 w-full items-center justify-center rounded-md bg-white text-xs font-bold uppercase tracking-[0.12em] text-black shadow-lg shadow-black/30 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{submitting ? "Creating account…" : "Create account"}
					</button>
				)}
			</form>
		</main>
	);
}
