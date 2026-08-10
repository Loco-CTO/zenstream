import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));
const configuredOrchestratorOrigin = process.env.NEXT_PUBLIC_ZSO_URL
	? new URL(process.env.NEXT_PUBLIC_ZSO_URL).origin
	: "";

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
						value: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https: ${configuredOrchestratorOrigin}; media-src 'self' blob: https: ${configuredOrchestratorOrigin}; connect-src 'self' https: wss: ${configuredOrchestratorOrigin}; frame-src https://www.youtube.com https://www.youtube-nocookie.com; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'`,
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
