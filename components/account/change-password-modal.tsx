"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { changeAccountPassword } from "@/lib/media-api";
import type { AuthSession } from "@/lib/session";

type ChangePasswordModalProps = {
	session: AuthSession;
	onClose: () => void;
	onContinueToLogin: () => void;
};

export function ChangePasswordModal({
	session,
	onClose,
	onContinueToLogin,
}: ChangePasswordModalProps) {
	const { t } = useI18n();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmNewPassword, setConfirmNewPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (submitting) return;

		setError(null);
		if (newPassword.length < 8) {
			setError(t("passwordTooShort"));
			return;
		}
		if (newPassword !== confirmNewPassword) {
			setError(t("passwordsDoNotMatch"));
			return;
		}

		setSubmitting(true);
		try {
			await changeAccountPassword(
				session,
				currentPassword,
				newPassword,
				confirmNewPassword,
			);
			setSuccess(true);
		} catch {
			setError(t("passwordChangeFailed"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm sm:p-6">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="change-password-title"
				className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141414] p-5 shadow-2xl shadow-black/50 sm:p-7"
			>
				<div className="flex items-center justify-between gap-4">
					<h2 id="change-password-title" className="text-lg font-bold text-white">
						{success ? t("passwordChanged") : t("changePassword")}
					</h2>
					{!success && (
						<button
							type="button"
							onClick={onClose}
							disabled={submitting}
							aria-label={t("close")}
							className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition hover:bg-white/8 hover:text-white disabled:opacity-40"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{success ? (
					<div className="mt-5 space-y-5">
						<p className="text-sm leading-6 text-white/55">
							{t("passwordChangedDescription")}
						</p>
						<button
							type="button"
							onClick={onContinueToLogin}
							className="flex h-11 w-full items-center justify-center rounded-lg bg-violet-300 px-4 text-xs font-semibold text-black transition hover:bg-violet-200"
						>
							{t("continueToLogin")}
						</button>
					</div>
				) : (
					<form onSubmit={submit} className="mt-5 space-y-4" noValidate>
						<p className="text-sm leading-6 text-white/45">
							{t("passwordChangeDescription")}
						</p>
						<PasswordField
							label={t("currentPassword")}
							value={currentPassword}
							onChange={setCurrentPassword}
							autoComplete="current-password"
							disabled={submitting}
						/>
						<PasswordField
							label={t("newPassword")}
							value={newPassword}
							onChange={setNewPassword}
							autoComplete="new-password"
							disabled={submitting}
						/>
						<PasswordField
							label={t("confirmNewPassword")}
							value={confirmNewPassword}
							onChange={setConfirmNewPassword}
							autoComplete="new-password"
							disabled={submitting}
						/>
						{error && (
							<p role="alert" className="text-sm text-red-300">
								{error}
							</p>
						)}
						<div className="flex justify-end gap-2 pt-2">
							<button
								type="button"
								onClick={onClose}
								disabled={submitting}
								className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-medium text-white/55 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-40"
							>
								{t("cancel")}
							</button>
							<button
								type="submit"
								disabled={
									submitting ||
									!currentPassword ||
									!newPassword ||
									!confirmNewPassword
								}
								className="inline-flex min-w-28 items-center justify-center gap-2 rounded-lg bg-violet-300 px-4 py-2.5 text-xs font-semibold text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-45"
							>
								{submitting && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
								{t("save")}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

function PasswordField({
	label,
	value,
	onChange,
	autoComplete,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	autoComplete: "current-password" | "new-password";
	disabled: boolean;
}) {
	return (
		<label className="block text-xs font-semibold uppercase tracking-[0.14em] text-white/35">
			{label}
			<input
				value={value}
				onChange={(event) => onChange(event.target.value)}
				type="password"
				autoComplete={autoComplete}
				disabled={disabled}
				required
				className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white/[0.06] px-3 text-sm font-normal tracking-normal text-white outline-none transition focus:border-violet-400/70 disabled:opacity-50"
			/>
		</label>
	);
}
