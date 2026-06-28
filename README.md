# Engineering Continuity Harness

A coding-agent-agnostic harness that keeps agents like Claude, Cursor, Codex, and Antigravity disciplined, and keeps a project's history and knowledge readable by humans over time.

You install it once and then work normally. The agent plans before it codes, documents as it goes, and stays off main — automatically, because hooks enforce the rules rather than relying on the agent to remember. You are not meant to run harness commands or follow a checklist; that is the agent's job.

It solves three problems:

1. **No memory of why.** Every change starts as a plan that captures intent. Once a plan is resolved it locks forever, so the history of decisions can't be quietly rewritten.
2. **Docs that rot.** Concepts, decisions, and specs describe how things are *now*. No "we used to do it this way" narration piling up.
3. **Agents that drift.** Hooks block the rule violations instead of trusting the agent to remember.

## How it's structured

Two halves, kept physically separate:

- **`.harness/`** — the engine. Rules, instructions, templates, tooling, and the per-agent integrations. The same in every project. You don't put project knowledge here.
- **`docs/`** — the output. Your project's plans, concepts, decisions, and specs, as readable HTML. The engine writes and protects it.

Each agent also gets a thin integration folder (`.claude/`, `.cursor/`, `.codex/`, `.agents/`) plus an instructions file. These hold a pointer back into `.harness/` and the hook wiring, nothing else.

```
.harness/           the engine
  rules/RULES.md    the critical rules every agent must follow
  instructions/     planning, knowledge, git, writing-style
  templates/        HTML shells for new docs
  bin/              the index generator, shared guard logic, and per-tool hooks
  integrations/     the per-agent pointer + hook files the installer copies
docs/               your knowledge (generated + authored)
  index.html        master hub: browse everything, with search
  plans/            PLAN-<name>.html + the plan navigator
  concepts/         how the project works (current state only)
  decisions/        committed architecture decisions
  specs/            patterns the project follows
```

## What it enforces

The rules are one shared library. Each agent's hooks call into it, so every tool enforces the same thing:

- **Plan first.** No project code changes without an active plan on a matching `plan/<name>` branch.
- **Plans lock once resolved.** A plan marked implemented, abandoned, or superseded can never be edited again.
- **Indexes are generated.** `docs/index.html` and `docs/plans/index.html` rebuild themselves and can't be hand-edited.
- **Never work on main.** No commits or merges on the main branch. Work lands on main by rebase, then a release tag.

The full list is in [`.harness/rules/RULES.md`](.harness/rules/RULES.md).

## Supported agents

`init` takes one or more agents. Each one gets its native instructions file and its native blocking hooks.

| Agent | Instructions file | Hooks config | Status |
|---|---|---|---|
| `claude` | `CLAUDE.md` (auto-loaded at the project root) | `.claude/settings.json` | **Verified** |
| `cursor` | `.cursor/rules/continuity-harness.mdc` | `.cursor/hooks.json` | Wired from docs, **untested** |
| `codex` | `AGENTS.md` | `.codex/hooks.json` | Wired from docs, **untested** |
| `antigravity` | `.agents/rules/continuity-harness.md` + `AGENTS.md` | `.agents/hooks.json` | Wired from docs, **untested** |

**Be honest with yourself about "untested."** Claude is the only agent these hooks have actually run against. The other three are built to each tool's documented hook schema, but those schemas weren't all verifiable (some docs are JavaScript-rendered). The shared *rule logic* is the same verified code; only each tool's payload parsing and deny format are unproven. The hook scripts say so at the top, and the installer prints it. Confirm the block actually fires the first time you use one — and if a payload field is named differently than the docs claimed, the fix is a one-line change in `.harness/bin/lib/payload.mjs`.

## Requirements

- **Node 18+** — already present if you run any of these agents.
- **git** — the harness is branch- and history-aware.

## Install locally (no npm account needed)

There is no published npm package yet. Until there is, install straight from this local clone.

### 1. Get this repo

```
git clone https://github.com/SkylonTech/engineering-continuity-harness.git
```

### 2. (Optional) put the command on your PATH

`npm link` uses a local symlink — no account, no publish:

```
cd engineering-continuity-harness
npm link
```

Now `continuity-harness` works anywhere. Without this step, replace `continuity-harness` below with `node /path/to/engineering-continuity-harness/bin/cli.mjs`.

### 3. Install into your project

From your project root, name the agent(s) you use:

```
cd /path/to/your-project
continuity-harness init claude
```

Wire several at once if you switch tools:

```
continuity-harness init claude cursor codex
```

This copies `.harness/` into your project, creates the empty `docs/` directories, writes each named agent's instructions file and hooks config, records what it installed in `.continuity-harness.json`, and builds the starter index pages. It refuses to overwrite a file you already own — if you already have a `CLAUDE.md`, `AGENTS.md`, or a hooks config, it writes a `*.harness` copy beside it and asks you to merge the `hooks` block.

### 4. Restart the agent in your project

Hooks load when a session starts. Open a fresh session so the rules get injected and the guards become active.

**That is the last setup step.** From here you do not run harness commands and you do not babysit the agent. You just talk to it normally.

## Update the engine later

Refresh the engine and re-apply your agents' wiring without touching your docs:

```
continuity-harness update          # re-wires whatever you installed before
continuity-harness update cursor   # also add a new agent later
```

`update` re-copies only `.harness/` and the agent integration files. Your `docs/` — plans, concepts, decisions, specs — are never touched. Unchanged config files are left alone; only genuinely new wiring is parked for you to merge.

## Day-to-day use

You give the agent a task in plain language, like normal. The harness makes the agent do the rest on its own:

- It writes a plan to `docs/plans/PLAN-<name>.html` and opens a `plan/<name>` branch **before** writing code — and if it tries to skip that, the hook blocks the edit until a plan exists.
- It keeps `docs/` current as it works. The index pages rebuild themselves.
- It stays off main. Commits and merges on main are blocked outright.
- When work is done it marks the plan `implemented`, rebases onto main, and asks you whether to tag a release.

**Your only manual steps:**

- **Review and commit.** The agent does not auto-commit by design — it stops and asks you to review, so a human always sees the change before it lands.
- **Decide releases.** When the agent asks "is this a release?", you answer and pick the version bump.
- **Browse** by opening `docs/index.html` whenever you want to see how the project evolved.

That is the whole point: you make the decisions, the agent does the bookkeeping. Details for the curious are in [`.harness/instructions/`](.harness/instructions).

## Once npm is set up (later)

Publishing this repo as a package enables the one-line install for anyone:

```
npx continuity-harness init claude
npx continuity-harness update
```

It also works straight from GitHub without a publish, once this repo is pushed:

```
npx github:SkylonTech/engineering-continuity-harness init claude
```
