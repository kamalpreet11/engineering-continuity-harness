#!/usr/bin/env node
// Claude Code SessionStart hook. Inject the harness rules into context at the
// start of every session and after a compaction, so they are never lost.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readInput } from "../../lib/hook-io.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const rulesPath = resolve(here, "..", "..", "..", "rules", "RULES.md");

await readInput(); // drain stdin

let rules = "";
try {
  rules = readFileSync(rulesPath, "utf8");
} catch {
  process.exit(0);
}

const context = `This project is governed by the Engineering Continuity Harness. Follow these rules. Detailed instructions live in .harness/instructions/.\n\n${rules}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
}));
