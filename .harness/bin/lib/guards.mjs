// The harness rules, as tool-agnostic logic. Each function takes a normalized
// action and returns { reason } when the action must be blocked, or null when
// it is allowed. Per-tool hook adapters parse their own payloads, call these,
// and emit their own deny format. One place to change a rule, every tool follows.

import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { readFrontmatter } from "./frontmatter.mjs";
import { currentBranch } from "./hook-io.mjs";

// Agent integration folders. Editing these (and the engine) is governance, not
// project work, so it never requires an active plan.
const AGENT_DIRS = [".harness/", ".claude/", ".cursor/", ".codex/", ".agents/"];

// Path relative to the project root, with forward slashes.
export function toRel(filePath, cwd) {
  const abs = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  return { abs, rel: relative(cwd, abs).split("\\").join("/") };
}

function hasActivePlan(cwd, branch) {
  const plansDir = join(cwd, "docs", "plans");
  if (!existsSync(plansDir)) return false;
  for (const file of readdirSync(plansDir)) {
    if (!/^PLAN-.+\.html$/.test(file)) continue;
    const fm = readFrontmatter(join(plansDir, file)) || {};
    if ((fm.state || "").trim() === "created" && (fm.branch || "").trim() === branch) {
      return true;
    }
  }
  return false;
}

// Rule check for a file edit/write. filePath may be relative or absolute.
export function checkEdit(filePath, cwd) {
  if (!filePath) return null;
  const { abs, rel } = toRel(filePath, cwd);
  if (rel.startsWith("..")) return null; // outside the project

  const isPlanFile = /^docs\/plans\/PLAN-[^/]+\.html$/.test(rel);
  const isGeneratedIndex = rel === "docs/index.html" || rel === "docs/plans/index.html";
  const isDocs = rel.startsWith("docs/");
  const isAgentOrEngine = AGENT_DIRS.some((d) => rel.startsWith(d));

  // Generated pages are off limits.
  if (isGeneratedIndex) {
    return { reason: "docs/index.html and docs/plans/index.html are generated. Do not edit them by hand. Change a doc and the index rebuilds itself." };
  }

  // A resolved plan is locked forever; a created plan (incl. resolving it) is fine.
  if (isPlanFile && existsSync(abs)) {
    const state = ((readFrontmatter(abs) || {}).state || "").trim();
    if (state && state !== "created") {
      return { reason: `This plan is ${state} and is locked forever. To revisit it, open a new plan instead of editing this one.` };
    }
    return null;
  }

  // New plans, knowledge docs, and the engine/agent config are all allowed.
  if (isPlanFile || isDocs || isAgentOrEngine) return null;

  // Project code requires an active plan on the current branch.
  if (!hasActivePlan(cwd, currentBranch(cwd))) {
    return { reason: "No active plan for this branch. Start in plan mode: create a PLAN in docs/plans with state 'created' and a matching branch, then do the work. See .harness/instructions/planning.md." };
  }
  return null;
}

// Rule check for a shell command. Blocks commit/merge while on main.
export function checkShell(command, cwd) {
  if (!command) return null;
  const branch = currentBranch(cwd);
  if (branch !== "main" && branch !== "master") return null;

  const hasGit = (verb) => new RegExp(`(^|[\\s;&|])git\\s+(?:-[^\\s]+\\s+)*${verb}\\b`).test(command);

  if (hasGit("commit")) {
    return { reason: "No commits on main. Open a branch mapped to your plan: git checkout -b plan/<name>. Work lands on main later by rebase. See .harness/instructions/git.md." };
  }
  if (hasGit("merge")) {
    return { reason: "Do not merge into main. Bring work to main with rebase, not merge: git checkout main && git rebase plan/<name>. See .harness/instructions/git.md." };
  }
  return null;
}
