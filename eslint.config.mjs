import { createRequire } from "node:module";
import { FlatCompat } from "@eslint/eslintrc";
import reactHooks from "eslint-plugin-react-hooks";

const require = createRequire(import.meta.url);
const nextVitals = require("eslint-config-next/core-web-vitals");
const nextTypescript = require("eslint-config-next/typescript");
const compat = new FlatCompat();

const normalizeNextConfig = (nextConfig) =>
	Array.isArray(nextConfig) ? nextConfig : compat.config(nextConfig);

const isLegacyNextConfig = !Array.isArray(nextVitals);

const config = [
	{
		ignores: [
			".next/**",
			"node_modules/**",
			"coverage/**",
			"design/**",
			"next-env.d.ts",
		],
	},
	...normalizeNextConfig(nextVitals),
	...normalizeNextConfig(nextTypescript),
	...(isLegacyNextConfig
		? [
				{
					plugins: {
						"react-hooks": reactHooks,
					},
				},
			]
		: []),
	{
		rules: {
			"@next/next/no-img-element": "off",
		},
	},
];

export default config;
