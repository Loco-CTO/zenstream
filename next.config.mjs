import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentSecurityPolicy } from "./lib/runtime-config.mjs";

export { buildContentSecurityPolicy };

const appRoot = dirname(fileURLToPath(import.meta.url));

const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
	.split(",")
	.map((value) => value.trim())
	.filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
	output: "standalone",
	images: { minimumCacheTTL: 300, unoptimized: true },
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
