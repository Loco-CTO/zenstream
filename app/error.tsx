"use client";

import { ErrorPage } from "@/components/status/error-page";

export default function Error() {
  return (
    <ErrorPage
      titleKey="unexpectedErrorTitle"
      messageKey="unexpectedErrorMessage"
    />
  );
}
