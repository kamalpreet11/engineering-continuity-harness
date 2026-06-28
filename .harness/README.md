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
npx continuity-harness init      # add the engine, create docs/
npx continuity-harness update    # later: refresh the engine, keep your docs
```
