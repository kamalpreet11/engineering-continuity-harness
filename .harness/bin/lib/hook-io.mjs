// Shared input helpers for the hook scripts. Reading stdin and resolving the
// git branch are the same across every agent. Output (block/allow) lives in
// emit.mjs because it differs per tool.

import { execFileSync } from "node:child_process";

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
