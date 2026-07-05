#!/usr/bin/env node
// Claude Code SessionStart hook. Two jobs:
//  1. Inject the harness rules into context at the start of every session and
//     after a compaction, so they are never lost.
//  2. Self-heal: if another tool (or a hand edit) stripped the harness wiring
//     out of .claude/settings.json or the commit-msg hook, quietly put it back.
//     This is what makes "no one can break my harness" true — the next session
//     restores anything a foreign installer removed.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { readInput, repoRoot } from "../../lib/hook-io.mjs";
import {
  readJsonSafe, writeJson, mergeJsonConfig, resolveHooksDir, installHookBlock,
  COMMIT_HOOK_BLOCK, HOOK_START, HOOK_END,
} from "../../lib/merge.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const harnessRoot = resolve(here, "..", "..", "..");
const rulesPath = resolve(harnessRoot, "rules", "RULES.md");
const claudeContribPath = resolve(harnessRoot, "integrations", "claude", "settings.json");

await readInput(); // drain stdin

const projectDir = process.env.CLAUDE_PROJECT_DIR || repoRoot(process.cwd());

// Is a hook whose command mentions `needle` already present anywhere in the
// settings hooks tree? Handles both the flat and nested hook shapes.
function hookPresent(data, needle) {
  const hooks = data && data.hooks;
  if (!hooks || typeof hooks !== "object") return false;
  for (const arr of Object.values(hooks)) {
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (entry && typeof entry.command === "string" && entry.command.includes(needle)) return true;
      if (entry && Array.isArray(entry.hooks)) {
        for (const h of entry.hooks) {
          if (h && typeof h.command === "string" && h.command.includes(needle)) return true;
        }
      }
    }
  }
  return false;
}

// Restore anything missing. Returns a list of human-readable repair notes.
function selfHeal() {
  const notes = [];

  // .claude/settings.json — the guard, the SessionStart injector, and the index
  // rebuild must all be wired. If any is gone, merge the payload back in. The
  // merge preserves every user and foreign entry, so this only adds what is
  // missing. A corrupt settings.json is left alone (never wiped).
  try {
    const settingsPath = join(projectDir, ".claude", "settings.json");
    const { data, error } = readJsonSafe(settingsPath);
    if (!error && data) {
      const intact = hookPresent(data, ".harness/bin/hooks/claude/guard.mjs")
        && hookPresent(data, ".harness/bin/hooks/claude/session-context.mjs")
        && hookPresent(data, ".harness/bin/hooks/rebuild-index.mjs");
      if (!intact) {
        const contribution = JSON.parse(readFileSync(claudeContribPath, "utf8"));
        const { data: merged } = mergeJsonConfig(data, contribution);
        writeJson(settingsPath, merged);
        notes.push("restored missing harness hooks in .claude/settings.json");
      }
    }
  } catch { /* self-heal is best-effort; never break the session */ }

  // The commit-msg check in the active hooks dir.
  try {
    const hooksDir = resolveHooksDir(projectDir);
    if (hooksDir) {
      const p = join(hooksDir, "commit-msg");
      const present = existsSync(p) && readFileSync(p, "utf8").includes(HOOK_START);
      if (!present) {
        installHookBlock(hooksDir, "commit-msg", COMMIT_HOOK_BLOCK, HOOK_START, HOOK_END);
        notes.push("restored the commit-msg hook");
      }
    }
  } catch { /* best-effort */ }

  return notes;
}

let rules = "";
try {
  rules = readFileSync(rulesPath, "utf8");
} catch {
  process.exit(0);
}

const repairs = selfHeal();

let context = `This project is governed by the Engineering Continuity Harness. Follow these rules. Detailed instructions live in .harness/instructions/.\n\n${rules}`;
if (repairs.length) {
  context += `\n\nHarness self-heal: ${repairs.join("; ")}. Restart the agent so the restored hooks load.`;
}

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
}));
