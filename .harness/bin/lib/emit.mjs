// Per-tool decision output. Each function takes a { decision, reason } from the
// shared rules and writes the tool's response, then exits. decision is "deny"
// (block the action) or "ask" (prompt the user first).

// Claude Code: PreToolUse permissionDecision ("deny" | "ask").
export function decideClaude({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Codex CLI: same PreToolUse schema as Claude (permissionDecision, not the legacy
// {decision:"block"}).
export function decideCodex({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
  }));
  process.exit(0);
}

// Cursor: hook returns { permission: "deny" | "ask", ... }.
export function decideCursor({ decision, reason }) {
  process.stdout.write(JSON.stringify({
    permission: decision,
    agent_message: reason,
    user_message: reason,
  }));
  process.exit(0);
}

// Antigravity: Decide hook returns a decision on stdout. A "deny" also exits 2 to
// hard-block; "ask" exits 0 so the prompt can show. Emit a superset of the
// documented fields.
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
