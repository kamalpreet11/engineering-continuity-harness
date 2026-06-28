// Classify a shell command into one of three tiers, tool-agnostic:
//   - "deny"  catastrophic and irreversible (rm -rf, force-push, dd, ...). Blocked.
//   - "ask"   state-mutating but recoverable (commits, installs, file moves). Prompt first.
//   - null    everything else (reads, builds, navigation). Runs freely.
//
// This is the engine behind the harness command policy. Claude and Codex also get
// a declarative mirror of it in their settings, but Cursor and Antigravity have no
// native deny tier, so this classifier (run from their PreToolUse hooks) is what
// actually enforces the policy for them.
//
// How it stays precise: a compound command is split on shell separators and each
// piece is judged on its own (most restrictive wins). Each piece is normalized
// (leading env assignments and wrappers like sudo/timeout stripped) and shell
// runners (`bash -c "..."`, `xargs ...`) are unwrapped and re-classified, so the
// real command being executed is what gets matched -- not a word that merely
// appears inside an argument. `echo "rm -rf x"` is a read; `rm -rf x` is not.
//
// Honest scope: deny-listing shell commands is a strong guard against accidents and
// a cooperative agent, NOT a hard security boundary. A determined path (a script
// that calls unlink() itself, an exotic wrapper) can still get around it.

// Shell separators that start a fresh command. Each segment is judged on its own.
const SEPARATORS = /&&|\|\||;|\|&|\||\n|&/;

// ---------- normalization ----------

// Strip leading env assignments and benign/elevation wrappers so the segment
// begins with the actual command being run.
function normalize(seg) {
  let s = seg.trim();
  s = s.replace(/^([A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S+)\s+)+/, "");
  let prev;
  do {
    prev = s;
    s = s.replace(/^(sudo|command|builtin|nice|nohup|time|env|stdbuf\s+-\S+|timeout\s+-?\S+|ionice\s+-\S+)\s+/i, "");
  } while (s !== prev);
  return s.trim();
}

function stripQuotes(s) {
  const t = s.trim();
  const dq = t.match(/^"([^"]*)"/);
  if (dq) return dq[1];
  const sq = t.match(/^'([^']*)'/);
  if (sq) return sq[1];
  return t;
}

// If the segment is a shell runner, return the inner command it executes.
function unwrapInner(seg) {
  let m = seg.match(/^(?:ba|z|da)?sh\s+-[a-z]*c[a-z]*\s+(.+)$/i);
  if (m) return stripQuotes(m[1]);
  m = seg.match(/^xargs\s+(?:-\S+\s+)*(.+)$/i);
  if (m) return m[1];
  return null;
}

// ---------- catastrophic (deny) ----------

// rm carrying both a recursive and a force flag, in any spelling or order.
function isCatastrophicRm(seg) {
  const m = seg.match(/^rm\b([^|;&<>\n]*)/i);
  if (!m) return false;
  const args = m[1];
  const recursive = /(^|\s)-[a-z]*r/i.test(args) || /--recursive\b/i.test(args);
  const force = /(^|\s)-[a-z]*f/i.test(args) || /--force\b/i.test(args);
  return recursive && force;
}

// git clean that will actually delete (-f together with -d and/or -x).
function isDestructiveGitClean(seg) {
  const m = seg.match(/^git\s+clean\b([^|;&<>\n]*)/i);
  if (!m) return false;
  const args = m[1];
  const force = /(^|\s)-[a-z]*f/i.test(args) || /--force\b/i.test(args);
  const dirsOrIgnored = /(^|\s)-[a-z]*[dx]/i.test(args) || /--(directories|exclude)\b/i.test(args);
  return force && dirsOrIgnored;
}

// git push that rewrites remote history: --force or -f, but NOT --force-with-lease.
function isForcePush(seg) {
  const m = seg.match(/^git\s+push\b([^|;&<>\n]*)/i);
  if (!m) return false;
  const args = m[1];
  if (/--force-with-lease\b/i.test(args)) return false;
  return /--force\b/i.test(args) || /(^|\s)-[a-z]*f\b/i.test(args);
}

const DENY = [
  { test: isCatastrophicRm, reason: "rm with -r and -f deletes a directory tree irreversibly. Delete specific paths, or move them aside instead." },
  { test: isForcePush, reason: "A force push rewrites remote history and can erase others' commits. Use --force-with-lease, or push normally." },
  { test: isDestructiveGitClean, reason: "git clean -f -d permanently deletes untracked files and directories. Review them first; stash or move what you want to keep." },
  { re: /^git\s+reset\s+--hard\b/i, reason: "git reset --hard discards uncommitted work with no recovery. Commit or stash first." },
  { re: /^dd\s+(if|of|bs)=/i, reason: "dd writes raw blocks and can destroy a disk or file. Run it yourself if you mean to." },
  { re: /^mke?2?fs\b/i, reason: "mkfs formats a filesystem and erases everything on it. Run it yourself if you mean to." },
  { re: /^find\b[^|;&\n]*-delete\b/i, reason: "find -delete removes every match with no confirmation. List the matches first, then delete deliberately." },
  { re: /^find\b[^|;&\n]*-exec\s+rm\b/i, reason: "find -exec rm removes every match with no confirmation. List the matches first, then delete deliberately." },
];

// ---------- state-mutating (ask) ----------

const ASK = [
  { re: /^rmdir\b/i, reason: "Removing a directory." },
  { re: /^rm\b/i, reason: "Deleting files." },
  { re: /^mv\b/i, reason: "Moving or overwriting files." },
  { re: /^git\s+(commit|push|merge|rebase|reset|checkout|switch|tag|stash|cherry-pick|revert|pull|rm|mv|am|apply)\b/i, reason: "This git command changes branch state, history, or tracked files." },
  { re: /^git\s+branch\s+-d/i, reason: "Deleting a branch." },
  { re: /^(npm|pnpm|yarn|bun)\s+(install|i|ci|add|remove|rm|uninstall|un|publish|update|upgrade|link|unlink)\b/i, reason: "This changes installed packages or publishes one." },
  { re: /^pip3?\s+(install|uninstall)\b/i, reason: "Changing installed Python packages." },
  { re: /^brew\s+(install|uninstall|remove|upgrade)\b/i, reason: "Changing installed Homebrew packages." },
  { re: /^gem\s+(install|uninstall)\b/i, reason: "Changing installed Ruby gems." },
  { re: /^cargo\s+(install|add|remove|publish)\b/i, reason: "Changing Cargo packages or publishing a crate." },
  { re: /^go\s+(install|get)\b/i, reason: "Changing Go modules or binaries." },
  { re: /^(apt|apt-get|dnf|yum|pacman|apk)\s+(install|remove|purge|upgrade)\b/i, reason: "Changing system packages." },
  { re: /^docker(-compose)?\s+(run|rm|rmi|build|push|exec|stop|kill|start|restart|compose|up|down|prune)\b/i, reason: "This Docker command changes containers or images." },
  { re: /^kubectl\s+(apply|delete|create|edit|replace|scale|rollout|drain|cordon|patch)\b/i, reason: "This kubectl command changes cluster state." },
  { re: /^helm\s+(install|upgrade|uninstall|delete|rollback)\b/i, reason: "This Helm command changes a release." },
  { re: /^terraform\s+(apply|destroy|import)\b/i, reason: "This Terraform command changes real infrastructure." },
  { re: /^curl\b[^|;&\n]*-X\s*(POST|PUT|DELETE|PATCH)\b/i, reason: "Sending a mutating HTTP request." },
  { re: /^curl\b[^|;&\n]*(--data|-d)\b/i, reason: "Sending data in an HTTP request." },
  { re: /^wget\b/i, reason: "Downloading a file." },
  { re: /^scp\b/i, reason: "Copying files over the network." },
  { re: /^rsync\b/i, reason: "Syncing files, which can overwrite or delete." },
  { re: /^chmod\b/i, reason: "Changing file permissions." },
  { re: /^chown\b/i, reason: "Changing file ownership." },
  { re: /^(kill|pkill|killall)\b/i, reason: "Killing a process." },
];

const RANK = { deny: 2, ask: 1 };
const moreSevere = (a, b) => (!a ? b : !b ? a : (RANK[b.decision] > RANK[a.decision] ? b : a));

function classifySegment(raw) {
  const seg = normalize(raw);
  if (!seg) return null;

  const inner = unwrapInner(seg);
  if (inner) {
    const d = classifyCommand(inner);
    if (d) return d;
  }
  for (const rule of DENY) {
    const hit = rule.test ? rule.test(seg) : rule.re.test(seg);
    if (hit) return { decision: "deny", reason: rule.reason };
  }
  for (const rule of ASK) {
    if (rule.re.test(seg)) return { decision: "ask", reason: rule.reason };
  }
  return null;
}

// Returns { decision: "deny" | "ask", reason } when the command should be gated,
// or null when it may run freely.
export function classifyCommand(command) {
  const text = (command || "").trim();
  if (!text) return null;

  let worst = null;
  for (const segment of text.split(SEPARATORS)) {
    worst = moreSevere(worst, classifySegment(segment));
    if (worst && worst.decision === "deny") return worst;
  }
  return worst;
}
