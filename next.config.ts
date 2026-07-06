import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build: `next build` emits `.next/standalone` with a minimal
  // `server.js` and only the traced runtime deps. That folder (plus `public` and
  // `.next/static`, copied in by scripts/pack-dist.mjs) is what ships as `dist/`.
  output: "standalone",
  // There are other lockfiles higher up the tree; pin the tracing/workspace root
  // to this project so the standalone trace doesn't wander into a parent monorepo.
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  // Allow accessing the dev server (and its HMR endpoint) via these hosts.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.31.222"],
};

export default nextConfig;
