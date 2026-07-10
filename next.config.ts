import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
  async rewrites() {
    const orchestrator = process.env.ZSO_URL?.replace(/\/+$/, "");
    const websocket = process.env.ZSO_WEBSOCKET_URL?.replace(/\/+$/, "") ?? orchestrator?.replace(/:\d+$/, ":9091");
    return {
      beforeFiles: orchestrator
        ? [{ source: "/api/syncplay/ws/:path*", destination: `${websocket}/:path*` }]
        : [],
    };
  },
};

export default nextConfig;
