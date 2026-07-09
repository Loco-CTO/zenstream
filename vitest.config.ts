import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { parse } from "yaml";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "yaml",
      transform(source, id) {
        if (!/\.ya?ml$/.test(id)) return;
        return `export default ${JSON.stringify(parse(source))};`;
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
