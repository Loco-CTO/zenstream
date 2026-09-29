export function normalizeOrchestratorUrl(value: string): string;
export function configuredOrchestratorUrl(
	environment?: Record<string, string | undefined>,
): string;
export function buildContentSecurityPolicy(
	orchestratorUrl: string,
	isDevelopment?: boolean,
): string;
export function buildRuntimeConfigScript(orchestratorUrl: string): string;
