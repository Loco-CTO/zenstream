"use client";

import { ErrorContent } from "@/components/status/error-page";
import { type TranslationKey, useI18n } from "@/lib/i18n";

export function ErrorPanel({
	title,
	titleKey,
	message,
	onRetry,
}: {
	title?: string;
	titleKey?: TranslationKey;
	message: string | null;
	onRetry: () => void;
}) {
	const { t } = useI18n();
	return (
		<ErrorContent
			title={title ?? t(titleKey ?? "libraryLoadFailed")}
			message={message}
			onRetry={onRetry}
		/>
	);
}
