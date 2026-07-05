# Engineering Continuity Harness

This folder is the **engine**. It keeps coding agents (Claude, Cursor, Codex, and others) working in a disciplined, predictable way, and it keeps a project's history and knowledge readable by humans over time.

There are two halves to the system:

- **`.harness/`** — the engine. Rules, instructions, templates, tooling, and hooks. This is the same in every project and ships with the installer. You do not put project knowledge here.
- **`docs/`** — the output. The project's own plans, concepts, decisions, and specs. This is yours. The engine writes and protects it, but never ships it.

Per-agent folders like `.claude/` are thin pointers. They hold nothing but a link back into this engine and the hook wiring.

## What the engine gives you

1. **Plans before work.** Every change starts as a plan that captures intent. Once a plan is resolved it locks forever, so history can't be quietly rewritten.
2. **Documents that stay current.** Concepts, decisions, and specs describe how things are *now*. No "we used to do it this way" narration.
3. **Agents that can't drift.** Hooks block the rule violations instead of trusting the agent to remember.

## Where to look

- `rules/RULES.md` — the short list of rules every agent must follow. Read this first.
- `instructions/` — the detailed how-to for planning, knowledge docs, git, and writing style.
- `templates/` — the HTML shells for new plans, concepts, decisions, and specs.
- `bin/` — the Node tooling: the index generator and the hook scripts.

## Installing into another project

```
cd your-project
npx continuity-harness init claude        # add the engine, wire an agent, create docs/
npx continuity-harness update             # later: refresh the engine, keep your docs
npx continuity-harness uninstall claude   # remove the wiring, keep the engine and docs
```

Name one or more agents on `init`: `claude`, `cursor`, `codex`, `antigravity`.
`update` re-wires the agents you recorded at install time; `uninstall` takes the
same agent names (or all of them if you name none).

The harness is a guest in every file it touches. It **merges** its wiring into
your agent's own config rather than handing you a sidecar to stitch by hand:

- `.claude/settings.json` (and the Cursor/Codex/Antigravity equivalents) — the
  harness adds only its own hooks and permission tiers and leaves everything else,
  including hooks another tool (say, graphify) installed, exactly as it found them.
  A config file that is not valid JSON is backed up to `*.bak` and skipped, never
  overwritten.
- `CLAUDE.md` / `AGENTS.md` — a single marked block, replaced in place on update.
- The git `commit-msg` check goes into whatever hooks directory git already uses
  (honoring an existing `core.hooksPath` from Husky, graphify, or your own setup),
  appended alongside any hook already there. The harness no longer takes over
  `core.hooksPath`.

`update` is idempotent: anything already applied is reported as `unchanged` and
left untouched. If another tool ever strips the harness wiring out, the next
session restores it automatically (the SessionStart hook self-heals).

Git config is per-clone, so run `update` once in each fresh clone to wire its
hooks.
