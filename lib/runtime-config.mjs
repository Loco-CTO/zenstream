const DEFAULT_ORCHESTRATOR_URL = "http://127.0.0.1:9090";

export function normalizeOrchestratorUrl(value) {
	let parsed;
	try {
		parsed = new URL(value);
	} catch {
		throw new Error(
			"ZENSTREAM_ORCHESTRATOR_URL must be an absolute HTTP(S) URL.",
		);
	}

	if (
		!["http:", "https:"].includes(parsed.protocol) ||
		parsed.username ||
		parsed.password ||
		parsed.search ||
		parsed.hash
	) {
		throw new Error(
			"ZENSTREAM_ORCHESTRATOR_URL must use HTTP(S) and cannot include credentials, a query, or a fragment.",
		);
	}

	return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function configuredOrchestratorUrl(environment = process.env) {
	return normalizeOrchestratorUrl(
		environment.ZENSTREAM_ORCHESTRATOR_URL ??
			environment.NEXT_PUBLIC_ZSO_URL ??
			DEFAULT_ORCHESTRATOR_URL,
	);
}

export function buildContentSecurityPolicy(
	orchestratorUrl,
	isDevelopment = false,
) {
	const configured = normalizeOrchestratorUrl(orchestratorUrl);
	const url = new URL(configured);
	const socketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
	const socketOrigin = `${socketProtocol}//${url.host}`;
	const developmentScriptSources = isDevelopment ? " 'unsafe-eval'" : "";

	return [
		"default-src 'self'",
		"base-uri 'self'",
		"object-src 'none'",
		"frame-ancestors 'none'",
		"form-action 'self'",
		`img-src 'self' data: blob: ${url.origin}`,
		`media-src 'self' blob: ${url.origin}`,
		`connect-src 'self' ${url.origin} ${socketOrigin}`,
		"frame-src https://www.youtube.com https://www.youtube-nocookie.com",
		"style-src 'self' 'unsafe-inline'",
		`script-src 'self' 'unsafe-inline'${developmentScriptSources}`,
	].join("; ");
}

export function buildRuntimeConfigScript(orchestratorUrl) {
	const value = normalizeOrchestratorUrl(orchestratorUrl);
	return `window.__ZENSTREAM_RUNTIME_CONFIG__ = Object.freeze({ orchestratorUrl: ${JSON.stringify(value)} });\n`;
}
