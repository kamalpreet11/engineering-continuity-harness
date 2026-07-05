// Shared, fail-safe merge helpers for the installer, the uninstaller, and the
// SessionStart self-heal. The harness is a guest in every file it touches: it
// merges its own entries in beside whatever the user (and other tools like
// graphify) already put there, and it can strip only its own entries back out.
//
// Harness identity: an entry is "ours" when any command string in it points into
// .harness/bin/hooks/ or .harness/bin/lib/. That single rule makes every merge
// idempotent (re-running replaces our entries in place) and makes uninstall
// surgical (we remove our entries and leave everyone else's).

import {
  existsSync, readFileSync, mkdirSync, chmodSync, statSync, unlinkSync, copyFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, isAbsolute, resolve, relative } from "node:path";
import { writeFileAtomic } from "./fs-atomic.mjs";

const HARNESS_MARK = /\.harness\/bin\/(hooks|lib)\//;

// ---------- shared wiring vocabulary ----------
// One definition of the markers and the commit-msg block, imported by both the
// installer and the SessionStart self-heal so the two can never drift apart.

// Instruction-block markers (HTML comments, matching instructions-block.md).
export const INSTR_START = "<!-- continuity-harness:start -->";
export const INSTR_END = "<!-- continuity-harness:end -->";
// Git-hook markers (shell comments).
export const HOOK_START = "# continuity-harness:start";
export const HOOK_END = "# continuity-harness:end";

// The commit-msg check, dropped into whatever hooks dir git actually uses. The
// logic lives in the versioned .harness/githooks/commit-msg.mjs; this only calls
// it, so the check tracks the engine. Resolves the repo root at run time so it
// works from any hooks dir.
export const COMMIT_HOOK_BLOCK = `${HOOK_START}
# Validate the commit message against Conventional Commits (harness rule).
node "$(git rev-parse --show-toplevel)/.harness/githooks/commit-msg.mjs" "$1" || exit $?
${HOOK_END}`;

// ---------- JSON IO (safe) ----------

// Read and parse a JSON file. Returns { data, existed, error }. On a parse
// failure `data` is null and `error` is set — the caller backs up and warns
// rather than wiping. We deliberately do NOT fall back to {} on a broken file
// (the graphify footgun that silently drops a whole config on one bad byte).
export function readJsonSafe(path) {
  if (!existsSync(path)) return { data: {}, existed: false, error: null };
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    return { data: null, existed: true, error: err };
  }
  if (raw.trim() === "") return { data: {}, existed: true, error: null };
  try {
    return { data: JSON.parse(raw), existed: true, error: null };
  } catch (err) {
    return { data: null, existed: true, error: err };
  }
}

// Write a JSON file atomically, 2-space indented with a trailing newline (the
// house style, so a merge that changes nothing produces a byte-identical file).
export function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileAtomic(path, JSON.stringify(data, null, 2) + "\n");
}

// Copy a file aside before we touch it. Returns the backup path.
export function backupFile(path) {
  const bak = path + ".bak";
  copyFileSync(path, bak);
  return bak;
}

// ---------- identity ----------

function isHarnessCommand(s) {
  return typeof s === "string" && HARNESS_MARK.test(s);
}

// True for both hook shapes: a flat { command } (Cursor) and a nested
// { matcher, hooks: [{ type, command }] } (Claude / Codex / Antigravity).
export function entryIsHarness(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (isHarnessCommand(entry.command)) return true;
  if (Array.isArray(entry.hooks)) return entry.hooks.some((h) => h && isHarnessCommand(h.command));
  return false;
}

// ---------- array merges ----------

// Keep every entry that is not ours (user + other tools), then append the
// harness entries. Our entries always land at the end, so a re-run drops the
// old copies and re-appends identical ones — idempotent.
export function mergeHookArrays(existing, harness) {
  const kept = (Array.isArray(existing) ? existing : []).filter((e) => !entryIsHarness(e));
  return [...kept, ...(Array.isArray(harness) ? harness : [])];
}

function unionStrings(existing, additions) {
  const seen = new Set();
  const out = [];
  for (const v of [...(Array.isArray(existing) ? existing : []), ...additions]) {
    if (typeof v !== "string") { out.push(v); continue; }
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// Remove the given strings from an array (used by uninstall to pull the harness
// permission entries back out). Non-strings are left untouched.
export function removeStrings(existing, toRemove) {
  const drop = new Set(toRemove);
  return (Array.isArray(existing) ? existing : []).filter((v) => !(typeof v === "string" && drop.has(v)));
}

function isScalar(v) {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

// ---------- JSON config merge ----------

// Merge the harness contribution into an existing config object. Preserves every
// existing key and every foreign entry; only harness entries are replaced.
// Returns { data, warnings }.
export function mergeJsonConfig(existing, contribution) {
  const out = existing && typeof existing === "object" ? { ...existing } : {};
  const warnings = [];

  if (contribution.hooks && typeof contribution.hooks === "object") {
    const hooks = out.hooks && typeof out.hooks === "object" ? { ...out.hooks } : {};
    for (const [event, arr] of Object.entries(contribution.hooks)) {
      hooks[event] = mergeHookArrays(hooks[event], arr);
    }
    out.hooks = hooks;
  }

  if (contribution.permissions && typeof contribution.permissions === "object") {
    const cp = contribution.permissions;
    const op = out.permissions && typeof out.permissions === "object" ? { ...out.permissions } : {};
    for (const tier of ["allow", "ask", "deny"]) {
      if (Array.isArray(cp[tier])) op[tier] = unionStrings(op[tier], cp[tier]);
    }
    for (const [k, v] of Object.entries(cp)) {
      if (["allow", "ask", "deny"].includes(k)) continue;
      if (op[k] === undefined) op[k] = v;
      else if (isScalar(v) && isScalar(op[k]) && op[k] !== v) {
        warnings.push(`permissions.${k} is "${op[k]}"; harness prefers "${v}". Left as-is.`);
      }
    }
    out.permissions = op;
  }

  for (const [k, v] of Object.entries(contribution)) {
    if (k === "hooks" || k === "permissions") continue;
    if (out[k] === undefined) out[k] = v;
    else if (isScalar(v) && isScalar(out[k]) && out[k] !== v) {
      warnings.push(`${k} is "${out[k]}"; harness expects "${v}". Left as-is.`);
    }
  }

  return { data: out, warnings };
}

// Strip harness hook entries from a config object (uninstall). Empty event
// arrays are dropped so the file returns to its pre-harness shape.
export function stripHarnessHooks(data) {
  if (!data || typeof data !== "object" || !data.hooks) return data;
  const out = { ...data, hooks: { ...data.hooks } };
  for (const [event, arr] of Object.entries(out.hooks)) {
    const kept = (Array.isArray(arr) ? arr : []).filter((e) => !entryIsHarness(e));
    if (kept.length) out.hooks[event] = kept;
    else delete out.hooks[event];
  }
  if (Object.keys(out.hooks).length === 0) delete out.hooks;
  return out;
}

// ---------- marker sections (CLAUDE.md / AGENTS.md, and any text file) ----------

// Replace the marked block in place if it exists, else append it, else create
// the file with just the section. `section` includes its own start/end markers.
export function mergeMarkerSection(text, section, start, end) {
  const body = text || "";
  const s = body.indexOf(start);
  const e = body.indexOf(end);
  if (s !== -1 && e !== -1 && e > s) {
    return body.slice(0, s) + section.trim() + body.slice(e + end.length);
  }
  if (body.trim() === "") return section.trimStart();
  return body.replace(/\s*$/, "") + "\n\n" + section.trim() + "\n";
}

// Remove the marked block from a text file. Returns the cleaned text.
export function stripMarkerSection(text, start, end) {
  const body = text || "";
  const re = new RegExp(escapeRe(start) + "[\\s\\S]*?" + escapeRe(end) + "\\n?");
  return body.replace(re, "").replace(/\n{3,}/g, "\n\n").replace(/^\s+/, "").replace(/\s+$/, "\n");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------- git hooks ----------

export function gitConfigGet(key, cwd) {
  try {
    return execFileSync("git", ["config", "--local", "--get", key], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// The directory git actually runs hooks from. Honors an existing core.hooksPath
// (Husky, graphify, a user's own), but rejects a value that escapes the repo —
// a malicious hooksPath must not aim our writes outside the tree. Falls back to
// what `git rev-parse --git-path hooks` reports (worktree-safe), then to
// .git/hooks. Creates the directory. Returns an absolute path, or null if this
// is not a git repo.
export function resolveHooksDir(root) {
  const custom = gitConfigGet("core.hooksPath", root);
  if (custom) {
    const abs = isAbsolute(custom) ? custom : resolve(root, custom);
    const rel = relative(resolve(root), abs);
    if (!rel.startsWith("..") && !isAbsolute(rel)) {
      mkdirSync(abs, { recursive: true });
      return abs;
    }
    // escapes the repo: ignore it and fall through to the default.
  }
  try {
    const raw = execFileSync("git", ["-C", root, "rev-parse", "--git-path", "hooks"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (raw && !/[\n\r\0]/.test(raw)) {
      const d = resolve(root, raw);
      mkdirSync(d, { recursive: true });
      return d;
    }
  } catch {
    return null;
  }
  const d = resolve(root, ".git", "hooks");
  mkdirSync(d, { recursive: true });
  return d;
}

function ensureExec(path) {
  try {
    const mode = statSync(path).mode;
    chmodSync(path, mode | 0o111);
  } catch {
    try { chmodSync(path, 0o755); } catch { /* best effort */ }
  }
}

// Install a marked block into a hook file. Creates it with a shebang if absent,
// appends the block if the file exists without our marker, and no-ops if the
// marker is already there. Returns "created" | "appended" | "present".
export function installHookBlock(hooksDir, name, block, start, end) {
  const hookPath = join(hooksDir, name);
  const marked = block.trim();
  if (existsSync(hookPath)) {
    const content = readFileSync(hookPath, "utf8");
    if (content.includes(start)) return "present";
    writeFileAtomic(hookPath, content.replace(/\s*$/, "") + "\n\n" + marked + "\n");
    ensureExec(hookPath);
    return "appended";
  }
  writeFileAtomic(hookPath, "#!/bin/sh\n" + marked + "\n");
  ensureExec(hookPath);
  return "created";
}

// Remove our marked block from a hook file. Deletes the file if nothing but a
// shebang is left. Returns "removed" | "cleaned" | "absent".
export function removeHookBlock(hooksDir, name, start, end) {
  const hookPath = join(hooksDir, name);
  if (!existsSync(hookPath)) return "absent";
  const content = readFileSync(hookPath, "utf8");
  if (!content.includes(start)) return "absent";
  const re = new RegExp(escapeRe(start) + "[\\s\\S]*?" + escapeRe(end) + "\\n?");
  const stripped = content.replace(re, "").replace(/\n{3,}/g, "\n\n").trimEnd();
  if (stripped === "" || stripped === "#!/bin/sh" || stripped === "#!/bin/bash") {
    unlinkSync(hookPath);
    return "removed";
  }
  writeFileAtomic(hookPath, stripped + "\n");
  return "cleaned";
}
