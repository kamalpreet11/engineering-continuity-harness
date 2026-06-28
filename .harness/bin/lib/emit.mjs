// Per-tool block/allow output. Every supported agent honors exit code 2 as a
// hard block; most also read a JSON decision on stdout. Each function prints the
// tool's documented JSON and exits. Claude is verified; the others follow the
// documented schemas and are marked untested in their adapters.

// Claude Code: PreToolUse permissionDecision. Verified.
export function denyClaude(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Codex CLI: same PreToolUse schema as Claude (must use permissionDecision, not
// the legacy {decision:"block"} which only injects a prompt). Untested.
export function denyCodex(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Cursor: hook returns { permission: "deny", ... }. Untested.
export function denyCursor(reason) {
  process.stdout.write(JSON.stringify({
    permission: "deny",
    agent_message: reason,
    user_message: reason,
  }));
  process.exit(0);
}

// Antigravity: Decide hook returns a decision; exit code 2 also blocks. Schema
// not fully verifiable from rendered docs, so emit a superset and exit 2. Untested.
export function denyAntigravity(reason) {
  process.stdout.write(JSON.stringify({ permission: "deny", decision: "deny", reason }));
  process.stderr.write(reason + "\n");
  process.exit(2);
}

export function pass() {
  process.exit(0);
}
