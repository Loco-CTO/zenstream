export type GenerateServiceWorkerOptions = {
	rootDir?: string;
};

export function generateServiceWorker(
	options?: GenerateServiceWorkerOptions,
): Promise<{ buildVersion: string; output: string }>;
