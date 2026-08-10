import { ErrorPage } from "@/components/status/error-page";

export default function NotFound() {
	return (
		<ErrorPage
			statusCode="404"
			titleKey="pageNotFoundTitle"
			messageKey="pageNotFoundMessage"
		/>
	);
}
