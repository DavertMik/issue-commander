#!/usr/bin/env node
"use strict";

// Launcher for `npx issue-commander`. Serves the self-contained standalone build:
// the published package ships `dist/` (Next's `output: "standalone"` server + traced
// runtime deps), booted with plain `node dist/server.js` — no Next install needed.
// If run from source without a `dist/`, it builds one first.
//
// Configuration resolves from CLI flags, then IC_-prefixed env vars, then legacy env vars.
// Flags are normalized into IC_* env vars that the server reads at runtime.
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

// Parse `--key=value` and `--key value` (and bare `--flag`). Unknown keys are ignored.
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h") {
      out.help = "true";
      continue;
    }
    if (!arg.startsWith("--")) continue;
    let key = arg.slice(2);
    let value;
    const eq = key.indexOf("=");
    if (eq >= 0) {
      value = key.slice(eq + 1);
      key = key.slice(0, eq);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      value = argv[++i];
    } else {
      value = "true";
    }
    out[key] = value;
  }
  return out;
}

function printHelp() {
  console.log(`
  Issue Commander — a two-pane manager for GitHub issues and pull requests

  Usage:
    npx issue-commander --org <org> [options]

  Options:
    --org <org>          GitHub organization to manage
                         (env: IC_GITHUB_ORG, or legacy GITHUB_ORG)
    --repo <name>        Default repository — pre-fills new issues and picks the Status board
                         (env: IC_DEFAULT_REPO)
    --milestone <title>  Default org-wide milestone            (env: IC_DEFAULT_MILESTONE)
    --project <number>   Default Projects V2 number            (env: IC_DEFAULT_PROJECT)
    --port <port>        Port to serve on (default 7367)        (env: PORT)
    -h, --help           Show this help

  Auth: the server reads a token from \`gh auth token\` (run \`gh auth login\` once),
  falling back to GITHUB_TOKEN / GH_TOKEN.
`);
}

// From source (no dist/), produce one: `next build` then assemble via pack-dist.
function buildDist() {
  const nextBin = require.resolve("next/dist/bin/next");
  const built = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, stdio: "inherit", env: process.env });
  if (built.status) process.exit(built.status);
  const packed = spawnSync(process.execPath, [path.join(root, "scripts", "pack-dist.mjs")], { cwd: root, stdio: "inherit", env: process.env });
  if (packed.status) process.exit(packed.status);
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  printHelp();
  process.exit(0);
}

// Org: --org > IC_GITHUB_ORG > GITHUB_ORG.
const org = String(args.org || process.env.IC_GITHUB_ORG || process.env.GITHUB_ORG || "").trim();
if (!org) {
  console.error("\n  issue-commander needs the GitHub organization it should manage.\n");
  console.error("  Usage:   npx issue-commander --org <your-org>");
  console.error("           IC_GITHUB_ORG=<your-org> npx issue-commander\n");
  console.error("  It reads a token from the GitHub CLI, so first run:  gh auth login");
  console.error("  (or set GITHUB_TOKEN / GH_TOKEN).  See --help for all options.\n");
  process.exit(1);
}

// Normalize flags into the IC_* env vars the server reads at runtime.
process.env.IC_GITHUB_ORG = org;
if (args.repo) process.env.IC_DEFAULT_REPO = String(args.repo);
if (args.milestone) process.env.IC_DEFAULT_MILESTONE = String(args.milestone);
if (args.project) process.env.IC_DEFAULT_PROJECT = String(args.project);
const port = String(args.port || process.env.PORT || "7367");
process.env.PORT = port;

// The published package ships `dist/`; from source, build it on first run.
const distServer = path.join(root, "dist", "server.js");
if (!existsSync(distServer)) {
  console.log("  Building Issue Commander (first run)…");
  buildDist();
}

console.log(`\n  Issue Commander → http://localhost:${port}   (org: @${org})\n`);
// Boot the standalone server directly. It reads PORT/HOSTNAME from the env; cwd is
// the dist dir so it resolves its bundled `public` and `.next/static` relative to server.js.
const server = spawnSync(process.execPath, [distServer], {
  cwd: path.join(root, "dist"),
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
});
process.exit(server.status || 0);
