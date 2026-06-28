#!/usr/bin/env node
// Post-action hook, shared by every agent. When any doc under docs/ changes,
// rebuild the master hub and the plan navigator so they stay current.
// Wired as Claude PostToolUse, Codex PostToolUse, Cursor afterFileEdit,
// Antigravity PostToolCall. Payload field names vary, so we probe several.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { readInput } from "../lib/hook-io.mjs";
import { pickFilePath, pickCwd } from "../lib/payload.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const builder = resolve(here, "..", "build-index.mjs");

const input = await readInput();
const cwd = pickCwd(input);
const filePath = pickFilePath(input);
if (!filePath) process.exit(0);

const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
const rel = relative(cwd, abs).split("\\").join("/");

// Only react to docs that feed the indexes, and never to the indexes themselves.
const isDoc = rel.startsWith("docs/") && rel.endsWith(".html");
const isIndex = rel === "docs/index.html" || rel === "docs/plans/index.html";
if (!isDoc || isIndex) process.exit(0);

try {
  execFileSync("node", [builder], { cwd, stdio: "ignore" });
} catch {
  // A failed rebuild should never break the agent's flow.
}
process.exit(0);
