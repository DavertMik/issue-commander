// Assemble the publishable `dist/` from a `output: "standalone"` build.
//
// `next build` emits `.next/standalone` (server.js + traced node_modules), but it
// deliberately does NOT copy `public` or `.next/static` — those must be placed next
// to server.js so the minimal server can serve them. This does that copy, producing
// a self-contained `dist/` that runs with plain `node dist/server.js` (no Next install).
import { rmSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const standalone = join(root, ".next", "standalone");
const dist = join(root, "dist");

if (!existsSync(standalone)) {
  console.error(
    "No .next/standalone found. Run `next build` with output:'standalone' first.",
  );
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
cpSync(standalone, dist, { recursive: true });
cpSync(join(root, "public"), join(dist, "public"), { recursive: true });
cpSync(join(root, ".next", "static"), join(dist, ".next", "static"), {
  recursive: true,
});

console.log("dist/ assembled — run it with: node dist/server.js");
