import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't pick a parent
  // lockfile (there are other lockfiles higher up the tree).
  turbopack: {
    root: __dirname,
  },
  // Allow accessing the dev server (and its HMR endpoint) via these hosts.
  allowedDevOrigins: ["127.0.0.1", "localhost", "192.168.31.222"],
};

export default nextConfig;
