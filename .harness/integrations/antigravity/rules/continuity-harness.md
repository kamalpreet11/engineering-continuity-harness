# Engineering Continuity Harness

This project is governed by the Engineering Continuity Harness. The engine is in `.harness/`.

Before doing anything, read `.harness/rules/RULES.md` and follow it.

The short version:

- Plan before you work. Plans live in `docs/plans/` as `PLAN-<name>.html`. No project code changes without an active plan on a matching `plan/<name>` branch.
- Resolved plans (implemented, abandoned, superseded) are locked forever. Open a new plan to revisit.
- Concepts, decisions, and specs in `docs/` describe the present only. No history.
- Never commit on main. Branch per plan. Rebase to main, tag releases.
- Plain English everywhere. No AI fluff. No commit attributions.

Detailed instructions: `.harness/instructions/`. Hooks in `.agents/hooks.json` enforce the hard rules. Do not work around them.
