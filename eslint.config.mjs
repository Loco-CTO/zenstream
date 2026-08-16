import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const compat = new FlatCompat();

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
	...compat.config(nextVitals),
	...compat.config(nextTypescript),
	{
		plugins: {
			"react-hooks": reactHooks,
		},
	},
	{
		rules: {
			"@next/next/no-img-element": "off",
		},
	},
];

export default config;
