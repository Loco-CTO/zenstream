export {};

declare global {
	interface Window {
		__ZENSTREAM_RUNTIME_CONFIG__?: {
			orchestratorUrl: string;
		};
	}
}
