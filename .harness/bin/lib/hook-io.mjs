// Shared input helpers for the hook scripts. Reading stdin and resolving the
// git branch are the same across every agent. Output (block/allow) lives in
// emit.mjs because it differs per tool.

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

// Read all of stdin and parse it as JSON. Returns {} if anything goes wrong,
// so a malformed payload never crashes a hook (which would block the agent).
export function readInput() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    process.stdin.on("error", () => resolve({}));
  });
}

// Current git branch in a directory, or "" if not a repo / detached HEAD.
// symbolic-ref works even before the first commit, unlike rev-parse HEAD.
export function currentBranch(cwd) {
  try {
    return execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

// Repo root for a directory. The hook payload cwd follows the agent's shell, so
// it may be a subdirectory (e.g. a monorepo package). Anchoring rule checks to
// the true root keeps them correct wherever the agent is standing.
//
// We use --show-cdup (the relative path up to the root) and resolve it against
// cwd, rather than --show-toplevel, so the root stays in the same path space as
// cwd. --show-toplevel canonicalizes symlinks (e.g. /tmp -> /private/tmp on
// macOS); mixing that with an agent-supplied path that isn't canonicalized would
// make the file look like it sits outside the repo. Falls back to the given cwd
// when git can't answer (not a repo), matching currentBranch.
export function repoRoot(cwd) {
  try {
    const cdup = execFileSync("git", ["rev-parse", "--show-cdup"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return resolve(cwd, cdup || ".");
  } catch {
    return cwd;
  }
}
