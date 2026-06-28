<!-- continuity-harness:start -->
## Engineering Continuity Harness

This project is governed by the Engineering Continuity Harness. The engine is in `.harness/`.

Before doing anything, read `.harness/rules/RULES.md` and follow it. This is automatic, not optional — you plan before you work, you keep docs current, and you never touch main.

The short version:

- Plan before you work. Plans live in `docs/plans/` as `PLAN-<name>.html`. No project code changes without an active plan on a matching `plan/<name>` branch.
- Resolved plans (implemented, abandoned, superseded) are locked forever. Open a new plan to revisit.
- Concepts, decisions, and specs in `docs/` describe the present only. No history, no changelog narration.
- Never commit on main. Branch per plan. Rebase to main, tag releases.
- Plain English everywhere. No AI fluff. No commit attributions.
- Shell commands are tiered: reads run, writes ask, destructive ones are blocked.

Detailed instructions are in `.harness/instructions/` (planning, knowledge, git, writing-style, commands). Hooks enforce the hard rules — do not work around them.
<!-- continuity-harness:end -->
