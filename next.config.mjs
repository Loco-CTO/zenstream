import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

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
