#!/usr/bin/env node
// continuity-harness installer.
//   init <agent...>     scaffold the engine + docs/ and wire one or more agents
//   update [<agent...>] refresh the engine; re-wire the given agents (or the
//                       ones recorded at install time). docs/ is never touched.
//
// Agents: claude (verified) | cursor | codex | antigravity (the last three are
// wired from documented hook schemas and are untested — verify on first use).

import {
  existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, cpSync, copyFileSync, chmodSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, extname, basename } from "node:path";

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

// ---------- file helpers ----------

// Copy, but never clobber an existing file the user may own: write a *.harness
// copy beside it and ask them to merge.
function copyOrPark(src, dest, mergeNote) {
  if (existsSync(dest)) {
    if (readFileSync(dest, "utf8") === readFileSync(src, "utf8")) return; // already current
    const ext = extname(dest);
    const parked = join(dirname(dest), basename(dest, ext) + ".harness" + ext);
    copyFileSync(src, parked);
    warn(`${rel(dest)} exists. Wrote ${rel(parked)} instead — ${mergeNote}`);
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
}

// Overwrite a harness-owned file (a uniquely named rule file we control).
function copyOwned(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

// Append our marked section to a shared instructions file (CLAUDE.md / AGENTS.md), once.
function appendSection(sectionFile, dest) {
  const section = readFileSync(sectionFile, "utf8");
  if (existsSync(dest)) {
    if (readFileSync(dest, "utf8").includes("continuity-harness:start")) return; // already there
    appendFileSync(dest, "\n" + section);
  } else {
    writeFileSync(dest, section);
  }
}

const rel = (p) => p.replace(target + "/", "");

// ---------- per-agent integrators ----------

const integrators = {
  claude(t) {
    // Root CLAUDE.md is auto-loaded by Claude Code at launch. Append our marked
    // block so it merges cleanly with any CLAUDE.md the user already has.
    appendSection(join(integrations, "_shared", "instructions-block.md"), join(t, "CLAUDE.md"));
    copyOrPark(join(integrations, "claude", "settings.json"), join(t, ".claude", "settings.json"), 'merge its "hooks" block into your settings.json.');
  },
  cursor(t) {
    copyOwned(join(integrations, "cursor", "rules", "continuity-harness.mdc"), join(t, ".cursor", "rules", "continuity-harness.mdc"));
    copyOrPark(join(integrations, "cursor", "hooks.json"), join(t, ".cursor", "hooks.json"), 'merge its "hooks" block into your hooks.json.');
  },
  codex(t) {
    appendSection(join(integrations, "_shared", "instructions-block.md"), join(t, "AGENTS.md"));
    copyOrPark(join(integrations, "codex", "hooks.json"), join(t, ".codex", "hooks.json"), 'merge its "hooks" block into your hooks.json.');
  },
  antigravity(t) {
    copyOwned(join(integrations, "antigravity", "rules", "continuity-harness.md"), join(t, ".agents", "rules", "continuity-harness.md"));
    appendSection(join(integrations, "_shared", "instructions-block.md"), join(t, "AGENTS.md"));
    copyOrPark(join(integrations, "antigravity", "hooks.json"), join(t, ".agents", "hooks.json"), 'merge its "hooks" block into your hooks.json.');
  },
};

// ---------- engine + docs ----------

function copyEngine() {
  cpSync(join(pkgRoot, ".harness"), join(target, ".harness"), { recursive: true, force: true });
}

function gitConfigGet(key, cwd) {
  try {
    return execFileSync("git", ["config", "--local", "--get", key], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// Point git at our versioned hook so every commit (any agent, or a human) is
// checked against Conventional Commits. Agent-agnostic, so it lives here, not
// in a per-agent integrator.
function wireGitHooks(t) {
  if (!existsSync(join(t, ".git"))) {
    warn("not a git repo yet — run `git init`, then `continuity-harness update` to wire the commit-msg hook.");
    return;
  }
  try { chmodSync(join(t, ".harness", "githooks", "commit-msg"), 0o755); } catch {}
  const current = gitConfigGet("core.hooksPath", t);
  if (current && current !== ".harness/githooks") {
    warn(`core.hooksPath is already "${current}". Left as-is — call .harness/githooks/commit-msg from your hook to keep the commit check.`);
    return;
  }
  try {
    execFileSync("git", ["config", "--local", "core.hooksPath", ".harness/githooks"], { cwd: t, stdio: "ignore" });
    log("  commit-msg hook wired — commits must follow Conventional Commits");
  } catch {
    warn("could not set core.hooksPath. Run: git config core.hooksPath .harness/githooks");
  }
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

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === "init") init(rest);
else if (cmd === "update") update(rest);
else {
  log("continuity-harness");
  log("");
  log("Usage:");
  log(`  continuity-harness init <agent...>     scaffold engine + docs, wire agents`);
  log(`  continuity-harness update [<agent...>] refresh engine, keep docs`);
  log("");
  log(`Agents: ${AGENTS.join(" | ")}`);
  log("  claude is verified. cursor, codex, antigravity are wired from docs and untested.");
  process.exit(cmd ? 1 : 0);
}
