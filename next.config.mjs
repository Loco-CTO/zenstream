import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

export function buildContentSecurityPolicy(orchestratorUrl) {
	const configuredOrchestrator = orchestratorUrl
		? new URL(orchestratorUrl)
		: null;
	const configuredOrchestratorOrigin = configuredOrchestrator?.origin;
	const configuredOrchestratorSocketOrigin = configuredOrchestrator
		? `${configuredOrchestrator.protocol === "https:" ? "wss:" : "ws:"}//${configuredOrchestrator.host}`
		: null;
	const orchestratorSources = configuredOrchestratorOrigin
		? ` ${configuredOrchestratorOrigin}`
		: "";
	const orchestratorConnectSources = configuredOrchestratorSocketOrigin
		? `${orchestratorSources} ${configuredOrchestratorSocketOrigin}`
		: orchestratorSources;

	return `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:${orchestratorSources}; media-src 'self' blob: https:${orchestratorSources}; connect-src 'self' https: wss:${orchestratorConnectSources}; frame-src https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`;
}

const contentSecurityPolicy = buildContentSecurityPolicy(
	process.env.NEXT_PUBLIC_ZSO_URL,
);

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	output: "standalone",
	turbopack: {
		root: appRoot,
		rules: {
			"*.yaml": {
				loaders: ["yaml-loader"],
				as: "*.js",
			},
		},
	},
	webpack(config) {
		config.resolve.alias = {
			...(config.resolve.alias ?? {}),
			"@": appRoot,
		};
		config.module.rules.push({
			test: /\.ya?ml$/i,
			use: "yaml-loader",
		});
		return config;
	},
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{
						key: "Content-Security-Policy",
						value: contentSecurityPolicy,
					},
					{ key: "Referrer-Policy", value: "no-referrer" },
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{
						key: "Strict-Transport-Security",
						value: "max-age=31536000; includeSubDomains",
					},
				],
			},
			{
				source: "/sw.js",
				headers: [
					{
						key: "Cache-Control",
						value: "no-cache, no-store, must-revalidate",
					},
				],
			},
		];
	},
};

export default nextConfig;
