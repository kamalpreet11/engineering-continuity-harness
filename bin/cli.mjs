#!/usr/bin/env node
// continuity-harness installer.
//   init <agent...>       scaffold the engine + docs/ and wire one or more agents
//   update [<agent...>]   refresh the engine; re-wire the given agents (or the
//                         ones recorded at install time). docs/ is never touched.
//   uninstall [<agent...>] remove the harness wiring from the given agents (or all
//                         recorded ones). Leaves the engine and docs/ in place.
//
// The harness is a guest in every file it touches: it merges its own hooks,
// permissions, and instruction blocks in beside whatever the user (and other
// tools like graphify) already have, and it can strip only its own entries back
// out. It never parks a sidecar for the developer to merge by hand, and it never
// hijacks git's hooks path.
//
// Agents: claude (verified) | cursor | codex | antigravity (the last three are
// wired from documented hook schemas and are untested — verify on first use).

import {
  existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, copyFileSync, chmodSync, unlinkSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileAtomic } from "../.harness/bin/lib/fs-atomic.mjs";
import {
  readJsonSafe, writeJson, backupFile, mergeJsonConfig, mergeMarkerSection,
  stripMarkerSection, stripHarnessHooks, removeStrings, resolveHooksDir,
  installHookBlock, removeHookBlock, gitConfigGet,
  INSTR_START, INSTR_END, HOOK_START, HOOK_END, COMMIT_HOOK_BLOCK,
} from "../.harness/bin/lib/merge.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, "..");
const target = process.cwd();
const integrations = join(pkgRoot, ".harness", "integrations");

const AGENTS = ["claude", "cursor", "codex", "antigravity"];
const UNTESTED = new Set(["cursor", "codex", "antigravity"]);
const DOC_DIRS = ["plans", "concepts", "decisions", "specs"];
const MANIFEST = join(target, ".continuity-harness.json");

const log = (m) => console.log(m);
const warn = (m) => console.log("  ! " + m);
const rel = (p) => p.replace(target + "/", "");

// ---------- file helpers ----------

// Overwrite a harness-owned file (a uniquely named rule file we control).
function copyOwned(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

// Merge a JSON payload into an agent's config, preserving everything already
// there. If the target is not valid JSON, back it up and skip — never wipe it.
function mergeJsonInto(src, dest) {
  const contribution = JSON.parse(readFileSync(src, "utf8"));
  const { data, existed, error } = readJsonSafe(dest);
  if (error) {
    const bak = backupFile(dest);
    warn(`${rel(dest)} is not valid JSON. Backed it up to ${rel(bak)} and skipped it — fix it and re-run. (${error.message})`);
    return;
  }
  const { data: merged, warnings } = mergeJsonConfig(data, contribution);
  for (const w of warnings) warn(`${rel(dest)}: ${w}`);
  // Skip the write when the merge changes nothing, so `update` is a quiet no-op
  // on a file that is already patched.
  if (existed && JSON.stringify(data) === JSON.stringify(merged)) {
    log(`  unchanged ${rel(dest)}`);
    return;
  }
  writeJson(dest, merged);
  log(`  ${existed ? "merged into" : "created"} ${rel(dest)}`);
}

// Merge our marked instruction block into a shared file (CLAUDE.md / AGENTS.md).
// Replaces the block in place on update, so instruction edits propagate.
function mergeSectionInto(sectionFile, dest) {
  const section = readFileSync(sectionFile, "utf8");
  const existing = existsSync(dest) ? readFileSync(dest, "utf8") : "";
  const next = mergeMarkerSection(existing, section, INSTR_START, INSTR_END);
  if (next === existing) {
    log(`  unchanged ${rel(dest)}`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileAtomic(dest, next);
  log(`  ${existing ? "updated" : "created"} ${rel(dest)}`);
}

// ---------- uninstall helpers ----------

function unmergeJsonFrom(src, dest) {
  if (!existsSync(dest)) return;
  const contribution = JSON.parse(readFileSync(src, "utf8"));
  const { data, error } = readJsonSafe(dest);
  if (error) { warn(`${rel(dest)} is not valid JSON; left it alone.`); return; }
  const next = stripHarnessHooks(data);
  if (contribution.permissions && next.permissions) {
    for (const tier of ["allow", "ask", "deny"]) {
      if (Array.isArray(contribution.permissions[tier]) && Array.isArray(next.permissions[tier])) {
        next.permissions[tier] = removeStrings(next.permissions[tier], contribution.permissions[tier]);
      }
    }
  }
  writeJson(dest, next);
  log(`  cleaned ${rel(dest)}`);
}

// Strip our instruction block. If the file is left empty (it was only ours),
// remove it. AGENTS.md is shared by codex and antigravity; re-run `update` for a
// remaining agent to restore the block if you uninstall the other.
function unmergeSectionFrom(dest) {
  if (!existsSync(dest)) return;
  const existing = readFileSync(dest, "utf8");
  if (!existing.includes(INSTR_START)) return;
  const next = stripMarkerSection(existing, INSTR_START, INSTR_END);
  if (next.trim() === "") unlinkSync(dest);
  else if (next !== existing) writeFileAtomic(dest, next);
  log(`  cleaned ${rel(dest)}`);
}

function removeOwned(dest) {
  try { if (existsSync(dest)) unlinkSync(dest); } catch { /* best effort */ }
}

// ---------- per-agent integrators ----------

const integrators = {
  claude(t) {
    mergeSectionInto(join(integrations, "_shared", "instructions-block.md"), join(t, "CLAUDE.md"));
    mergeJsonInto(join(integrations, "claude", "settings.json"), join(t, ".claude", "settings.json"));
  },
  cursor(t) {
    copyOwned(join(integrations, "cursor", "rules", "continuity-harness.mdc"), join(t, ".cursor", "rules", "continuity-harness.mdc"));
    mergeJsonInto(join(integrations, "cursor", "hooks.json"), join(t, ".cursor", "hooks.json"));
  },
  codex(t) {
    mergeSectionInto(join(integrations, "_shared", "instructions-block.md"), join(t, "AGENTS.md"));
    mergeJsonInto(join(integrations, "codex", "hooks.json"), join(t, ".codex", "hooks.json"));
  },
  antigravity(t) {
    copyOwned(join(integrations, "antigravity", "rules", "continuity-harness.md"), join(t, ".agents", "rules", "continuity-harness.md"));
    mergeSectionInto(join(integrations, "_shared", "instructions-block.md"), join(t, "AGENTS.md"));
    mergeJsonInto(join(integrations, "antigravity", "hooks.json"), join(t, ".agents", "hooks.json"));
  },
};

const uninstallers = {
  claude(t) {
    unmergeSectionFrom(join(t, "CLAUDE.md"));
    unmergeJsonFrom(join(integrations, "claude", "settings.json"), join(t, ".claude", "settings.json"));
  },
  cursor(t) {
    removeOwned(join(t, ".cursor", "rules", "continuity-harness.mdc"));
    unmergeJsonFrom(join(integrations, "cursor", "hooks.json"), join(t, ".cursor", "hooks.json"));
  },
  codex(t) {
    unmergeSectionFrom(join(t, "AGENTS.md"));
    unmergeJsonFrom(join(integrations, "codex", "hooks.json"), join(t, ".codex", "hooks.json"));
  },
  antigravity(t) {
    removeOwned(join(t, ".agents", "rules", "continuity-harness.md"));
    unmergeSectionFrom(join(t, "AGENTS.md"));
    unmergeJsonFrom(join(integrations, "antigravity", "hooks.json"), join(t, ".agents", "hooks.json"));
  },
};

// ---------- engine + docs + git ----------

function copyEngine() {
  cpSync(join(pkgRoot, ".harness"), join(target, ".harness"), { recursive: true, force: true });
}

// Wire git as a guest: marker-append the commit-msg check into whatever hooks
// dir git actually uses (honoring an existing core.hooksPath from Husky, graphify,
// etc.), so it coexists with any hook already there and never shadows .git/hooks.
function wireGitHooks(t) {
  if (!existsSync(join(t, ".git"))) {
    warn("not a git repo yet — run `git init`, then `continuity-harness update` to wire the commit-msg hook.");
    return;
  }
  try { chmodSync(join(t, ".harness", "githooks", "commit-msg.mjs"), 0o755); } catch { /* best effort */ }
  const hooksDir = resolveHooksDir(t);
  if (!hooksDir) { warn("could not resolve the git hooks directory; commit-msg hook not wired."); return; }
  const status = installHookBlock(hooksDir, "commit-msg", COMMIT_HOOK_BLOCK, HOOK_START, HOOK_END);
  if (status === "present") log("  commit-msg hook already wired");
  else log(`  commit-msg hook ${status} in ${rel(join(hooksDir, "commit-msg"))} — commits must follow Conventional Commits`);
  if (gitConfigGet("core.hooksPath", t) === ".harness/githooks") {
    warn("core.hooksPath is set to .harness/githooks by an older harness install. The commit-msg hook now lives in the active hooks dir; unset the legacy config with: git config --unset core.hooksPath");
  }
}

function unwireGitHooks(t) {
  if (!existsSync(join(t, ".git"))) return;
  const hooksDir = resolveHooksDir(t);
  if (!hooksDir) return;
  const status = removeHookBlock(hooksDir, "commit-msg", HOOK_START, HOOK_END);
  if (status !== "absent") log(`  commit-msg hook ${status}`);
}

function createDocsDirs() {
  for (const d of DOC_DIRS) {
    const full = join(target, "docs", d);
    mkdirSync(full, { recursive: true });
    const keep = join(full, ".gitkeep");
    if (!existsSync(keep)) writeFileSync(keep, "");
  }
}

function buildIndexes() {
  try {
    execFileSync("node", [join(target, ".harness", "bin", "build-index.mjs")], { cwd: target, stdio: "inherit" });
  } catch {
    log("Could not build the index pages automatically. Run: node .harness/bin/build-index.mjs");
  }
}

function readManifest() {
  if (!existsSync(MANIFEST)) return { agents: [] };
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8"));
  } catch {
    return { agents: [] };
  }
}

function writeManifest(agents) {
  writeFileSync(MANIFEST, JSON.stringify({ agents: [...new Set(agents)].sort() }, null, 2) + "\n");
}

function wire(agents) {
  for (const a of agents) {
    log(`  wiring ${a}${UNTESTED.has(a) ? " (untested — verify on first use)" : ""}`);
    integrators[a](target);
  }
}

// ---------- commands ----------

function parseAgents(args) {
  const bad = args.filter((a) => !AGENTS.includes(a));
  if (bad.length) {
    log(`Unknown agent(s): ${bad.join(", ")}. Supported: ${AGENTS.join(", ")}.`);
    process.exit(1);
  }
  return args;
}

function init(args) {
  const agents = parseAgents(args);
  if (agents.length === 0) {
    log(`Tell init which agent(s) to wire: ${AGENTS.join(" | ")}`);
    log("Example: continuity-harness init claude");
    process.exit(1);
  }
  if (existsSync(join(target, ".harness"))) {
    log("This project already has a .harness/. Run `continuity-harness update` to refresh it.");
    process.exit(1);
  }
  copyEngine();
  createDocsDirs();
  wire(agents);
  wireGitHooks(target);
  writeManifest(agents);
  buildIndexes();
  log("");
  log(`Harness installed for: ${agents.join(", ")}.`);
  log("  .harness/  the engine        docs/  your knowledge");
  log("Open docs/index.html to browse. Restart your agent so its hooks load.");
}

function update(args) {
  if (!existsSync(join(target, ".harness"))) {
    log("No .harness/ here yet. Run `continuity-harness init <agent>` first.");
    process.exit(1);
  }
  let agents = parseAgents(args);
  if (agents.length === 0) {
    agents = readManifest().agents;
    if (agents.length === 0) log("No agents recorded; refreshing the engine only.");
  }
  copyEngine();
  wireGitHooks(target);
  if (agents.length) {
    wire(agents);
    writeManifest([...readManifest().agents, ...agents]);
  }
  buildIndexes();
  log("Engine updated. Your docs/ were left untouched.");
}

function uninstall(args) {
  if (!existsSync(join(target, ".harness"))) {
    log("No .harness/ here. Nothing to uninstall.");
    process.exit(1);
  }
  let agents = parseAgents(args);
  if (agents.length === 0) {
    agents = readManifest().agents;
    if (agents.length === 0) {
      log("No agents recorded to uninstall. Name one explicitly, e.g. `continuity-harness uninstall claude`.");
      process.exit(1);
    }
  }
  for (const a of agents) {
    log(`  removing ${a}`);
    uninstallers[a](target);
  }
  unwireGitHooks(target);
  writeManifest(readManifest().agents.filter((a) => !agents.includes(a)));
  log("");
  log(`Removed harness wiring for: ${agents.join(", ")}.`);
  log("The engine (.harness/) and your docs/ are untouched. Delete them by hand if you want them gone.");
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "init") init(rest);
else if (cmd === "update") update(rest);
else if (cmd === "uninstall") uninstall(rest);
else {
  log("continuity-harness");
  log("");
  log("Usage:");
  log(`  continuity-harness init <agent...>      scaffold engine + docs, wire agents`);
  log(`  continuity-harness update [<agent...>]  refresh engine, keep docs`);
  log(`  continuity-harness uninstall [<agent...>] remove harness wiring, keep engine + docs`);
  log("");
  log(`Agents: ${AGENTS.join(" | ")}`);
  log("  claude is verified. cursor, codex, antigravity are wired from docs and untested.");
  process.exit(cmd ? 1 : 0);
}
