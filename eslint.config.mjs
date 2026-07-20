import { FlatCompat } from "@eslint/eslintrc";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTypescript from "eslint-config-next/typescript.js";

const compat = new FlatCompat();

const config = [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "design/**"],
  },
  ...compat.config(nextVitals),
  ...compat.config(nextTypescript),
  {
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
