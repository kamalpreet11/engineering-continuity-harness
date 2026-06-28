// Per-tool decision output. Each function takes a { decision, reason } from the
// shared rules and prints the tool's documented response, then exits. decision is
// "deny" (block the action) or "ask" (prompt the user first). Claude is verified;
// the others follow the documented schemas and are marked untested in their adapters.

// Claude Code: PreToolUse permissionDecision ("deny" | "ask"). Verified.
export function decideClaude({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Codex CLI: same PreToolUse schema as Claude (permissionDecision, not the legacy
// {decision:"block"}). Untested.
export function decideCodex({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Cursor: hook returns { permission: "deny" | "ask", ... }. Untested.
export function decideCursor({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    permission: decision,
    agent_message: reason,
    user_message: reason,
  }));
  process.exit(0);
}

// Antigravity: Decide hook returns a decision on stdout. A "deny" also exits 2,
// which is documented to hard-block; "ask" exits 0 so the prompt can show. The
// schema is the least-verifiable of the four, so emit a superset. Untested.
export function decideAntigravity({ decision, reason }) {
  process.stdout.write(JSON.stringify({ permission: decision, decision, reason }));
  if (decision === "deny") {
    process.stderr.write(reason + "\n");
    process.exit(2);
  }
  process.exit(0);
}

export function pass() {
  process.exit(0);
}
