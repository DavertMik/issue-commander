#!/usr/bin/env node
"use strict";

// Launcher for `npx issue-commander`. Serves the prebuilt Next.js app (the published
// package ships a built `.next`); if run from source without a build, it builds first.
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function next(args) {
  const bin = require.resolve("next/dist/bin/next");
  return spawnSync(process.execPath, [bin, ...args], { cwd: root, stdio: "inherit", env: process.env });
}

if (!process.env.GITHUB_ORG) {
  console.error("\n  issue-commander needs the GitHub organization it should manage.\n");
  console.error("  Usage:   GITHUB_ORG=<your-org> npx issue-commander\n");
  console.error("  It reads a token from the GitHub CLI, so first run:  gh auth login");
  console.error("  (or set GITHUB_TOKEN / GH_TOKEN).\n");
  process.exit(1);
}

// Build only when running from source without an existing build (published builds ship `.next`).
if (!existsSync(path.join(root, ".next", "BUILD_ID"))) {
  console.log("  Building Issue Commander (first run)…");
  const built = next(["build"]);
  if (built.status) process.exit(built.status);
}

const port = process.env.PORT || "3000";
console.log(`\n  Issue Commander → http://localhost:${port}   (org: @${process.env.GITHUB_ORG})\n`);
const server = next(["start", "--port", String(port)]);
process.exit(server.status || 0);
