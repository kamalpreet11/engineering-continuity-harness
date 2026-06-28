# Command policy

Shell commands are sorted into three tiers. The agent never has to think about
this — the hooks apply it on every command, for every agent.

- **allow** — read-only and everyday work (ls, cat, grep, git status, builds, tests). Runs with no prompt.
- **ask** — anything that changes state and is recoverable: file moves and deletes, commits, pushes, merges, rebases, package installs and publishes, container/cluster/infra changes, downloads, permission changes. The user is asked first.
- **deny** — catastrophic and irreversible: `rm -rf`, `sudo rm`, `git reset --hard`, `git clean -fd`, force pushes, `dd`, `mkfs`, `find -delete`. Blocked outright.

## Where it lives

One classifier, `.harness/bin/lib/commands.mjs`, decides the tier. Every agent's
PreToolUse guard calls it, so the policy is identical across Claude, Cursor, Codex,
and Antigravity. Claude and Codex also carry a declarative mirror of the lists in
their own settings; Cursor and Antigravity have no native deny tier, so the hook is
the only thing enforcing it for them.

The classifier judges each part of a compound command on its own and matches the
real command being run, not a word that merely appears in an argument: `rm -rf x`
is denied, but `echo "rm -rf x"` is a harmless print.

## What it is and is not

This stops accidents and keeps a cooperative agent inside the lines. It is **not** a
hard security boundary — a determined path (a script that deletes files itself, an
exotic wrapper) can still get around a shell deny-list. For a real boundary, run the
agent in its sandbox.

## Tuning

The tiers are plain lists in `.harness/bin/lib/commands.mjs` (and, for Claude, in
`.claude/settings.json`). Move a command between tiers by editing those lists. If a
safe command is asking too often, add it to allow; if something risky should pause,
add it to ask or deny.
