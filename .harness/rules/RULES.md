# Critical rules

These rules are not optional. Hooks enforce the hard ones. Follow all of them.

## 1. Plan before you work

- Start every task in plan mode. Produce a plan before touching project code.
- Plans live in `docs/plans/` as `PLAN-<semantic-name>.html`.
- You may not edit project code unless an active plan exists for the branch you are on. (Hook-enforced.)

## 2. Plans lock once resolved

- A plan's state is one of: `created`, `implemented`, `abandoned`, `superseded`.
- `created` is the only editable state. The moment a plan becomes implemented, abandoned, or superseded, it is locked forever. (Hook-enforced.)
- To revisit a locked plan, open a new plan. Never reopen an old one.
- Resolving a plan is its last edit, so that edit carries everything the resolution needs. `implemented` needs a date. `abandoned` needs a date and a reason. `superseded` needs a date and a link to the plan that replaced it. (Hook-enforced.)

## 3. A finished plan accounts for what it taught the project

- A plan cannot be marked `implemented` until its `knowledge:` field names the concepts, decisions, and specs the work produced — paths under `docs/`, separated by `|`. (Hook-enforced: the files must exist.)
- If the work genuinely produced none, write `knowledge: none` and a `knowledge_reason:` saying why in one plain sentence. If you cannot write that sentence, the work owes a document.
- This is how the knowledge base gets built: as the software is written, not later. Before you resolve a plan, look back over the work and see what it explained, chose, or established. See `.harness/instructions/knowledge.md`.

## 4. The indexes are generated, never hand-written

- `docs/index.html` (the master hub) and `docs/plans/index.html` (the plan navigator) are built by the tooling.
- Never edit them by hand. (Hook-enforced.) Change a doc and the index rebuilds itself.

## 5. Documents are always current

- Concepts, decisions, and specs describe how things are now.
- Do not add history, changelogs, or "previously we did X" notes. If something changed, the document simply reflects the new reality.
- A decision that changes is replaced by a new decision file, back-linked to the old one. When you supersede a decision, ask the user how to handle the tech debt and tag it `pending` or `cleared`.
- Once a newer decision replaces it, the old decision is locked forever, same as a resolved plan. (Hook-enforced.)

## 6. Write in plain English

- Simple, direct English. No AI fluff. No song and dance. Say the thing.
- This applies to every document, plan, and commit message.

## 7. Never work on main

- All work happens on a branch named `plan/<plan-name>`. (Hook-enforced: no commits on main.)
- When work is verified, rebase onto main (never merge), then tag.
- Ask the user whether the work is a meaningful release. If yes, tag it with a semver bump (major, minor, or patch).

## 8. Commits follow Conventional Commits

- Subject line is `<type>: summary` or `<type>(scope): summary`. Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
- Keep the subject under 72 characters, imperative, plain English. Add a body for context when it helps.
- Zero AI fluff. Zero attributions. No "Co-Authored-By", no "Generated with", no tool credits. (Hook-enforced by the git commit-msg hook.)
- Do not nag the user to commit. When work is done, remind them to review and commit when ready.

## 9. Shell commands are tiered

- Read-only commands run freely. State-changing commands (deletes, moves, commits, pushes, installs, infra changes) prompt the user first. Catastrophic ones (`rm -rf`, force-push, `git reset --hard`, `dd`, ...) are blocked. (Hook-enforced for every agent; see `.harness/instructions/commands.md`.)
- This stops accidents, not a determined bypass. It is not a substitute for the agent's sandbox.
