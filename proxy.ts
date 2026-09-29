import { NextResponse, type NextRequest } from "next/server";
import {
	buildContentSecurityPolicy,
	buildRuntimeConfigScript,
	configuredOrchestratorUrl,
} from "./lib/runtime-config.mjs";

export function proxy(request: NextRequest) {
	const orchestratorUrl = configuredOrchestratorUrl();

	if (request.nextUrl.pathname === "/runtime-config.js") {
		return new Response(buildRuntimeConfigScript(orchestratorUrl), {
			headers: {
				"Cache-Control": "no-store, no-cache, must-revalidate",
				"Content-Type": "application/javascript; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
			},
		});
	}

	const response = NextResponse.next();
	response.headers.set(
		"Content-Security-Policy",
		buildContentSecurityPolicy(
			orchestratorUrl,
			process.env.NODE_ENV === "development",
		),
	);
	return response;
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
