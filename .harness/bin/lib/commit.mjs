// Conventional Commits validation. Shared by the git commit-msg hook (and any
// agent that wants an early check). No other imports, so the git hook stays light.

export const COMMIT_TYPES = [
  "feat", "fix", "docs", "style", "refactor", "perf", "test", "build", "ci", "chore", "revert",
];

const SUBJECT_RE = new RegExp(`^(${COMMIT_TYPES.join("|")})(\\([^)]+\\))?(!)?: .+`);
// git's own auto-generated messages we should not reject
const BYPASS_RE = /^(merge |revert |fixup!|squash!|amend!)/i;

// Returns { reason } when the message breaks the rule, or null when it is fine.
export function checkCommitMessage(message) {
  const text = (message || "").trim();
  if (!text) return { reason: "Empty commit message." };

  const subject = text.split("\n")[0].trim();
  if (BYPASS_RE.test(subject)) return null;

  if (!SUBJECT_RE.test(subject)) {
    return { reason: `Commit subject must follow Conventional Commits: "<type>: summary" (types: ${COMMIT_TYPES.join(", ")}). Example: "feat: add social login". Got: "${subject}".` };
  }
  if (subject.length > 72) {
    return { reason: `Commit subject is ${subject.length} characters; keep it under 72 and move detail to the body.` };
  }
  if (/co-authored-by|generated with|🤖/i.test(text)) {
    return { reason: "Remove the attribution line (Co-Authored-By / Generated with ...). Commits carry no AI attribution." };
  }
  return null;
}
