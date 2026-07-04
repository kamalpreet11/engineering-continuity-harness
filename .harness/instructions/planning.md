# Planning

Every task starts here. No project code changes before there is a plan.

The Claude integration starts every session in plan mode (`permissions.defaultMode: "plan"`). Your plan-mode draft is scratch and stays out of `docs/plans`. The durable plan is the `PLAN-<name>.html` file you create below — that is the one the index tracks and the one that locks. Convert your draft into that file.

## Making a plan

1. Start in plan mode. Understand the request and the code around it.
2. Copy `.harness/templates/PLAN.template.html` to `docs/plans/PLAN-<semantic-name>.html`.
   - The name is short and meaningful, kebab-case. Example: `PLAN-social-login.html`.
3. Fill the frontmatter (the `<!--HARNESS ... -->` block at the very top):
   - `type: plan`
   - `name:` the semantic name, no `PLAN-` prefix and no `.html`.
   - `created:` today's date, `YYYY-MM-DD`.
   - `state: created`
   - `description:` one plain sentence on what this plan does.
   - `keywords:` pipe-separated search terms. Think about how someone would later search for this. Example: `auth | social | federated | google | facebook`.
   - `branch: plan/<name>` the branch this work happens on.
4. Write the plan body in the HTML. Plain English. Cover the context (why), the approach, the files touched, and how to verify.
5. Open the branch: `git checkout -b plan/<name>`.

The visible status badge and the dates line in the body are **generated**, not hand-authored. They live between `<!-- harness:status:start -->` / `<!-- harness:status:end -->` and `<!-- harness:dates:start -->` / `<!-- harness:dates:end -->` markers, and `build-index.mjs` rewrites them from the frontmatter on every rebuild. Never edit them by hand and never remove the markers. Set the state and dates in the frontmatter; the rendered page follows.

## States

A plan is always in exactly one state.

- `created` — live work in progress. The only editable state.
- `implemented` — the work is done, verified, and rebased to main. Add `implemented: <date>`.
- `abandoned` — the work is dropped. Add `abandoned: <date>` and `abandoned_reason: <plain english>`.
- `superseded` — a newer plan replaces this one. Add `superseded: <date>` and `superseded_by: PLAN-<name>`.

## Resolving a plan

Setting the state to implemented, abandoned, or superseded is the **last edit you may make** to that file. After that the hook locks it.

- The transition edit itself is allowed because the file on disk is still `created` at that moment.
- Make the state flip **and its companion date field atomic** — change `state:` and add the matching date (`implemented:` / `abandoned:` / `superseded:`) and any required field (`abandoned_reason:`, `superseded_by:`) in the **same single edit**. Once the state on disk is no longer `created`, the file is locked and no follow-up frontmatter edit is possible.
- You do not touch the body badge or dates line — they regenerate from the frontmatter you just set.
- Once resolved, never touch it again. To revisit, open a new plan.

## The indexes

You never write `docs/index.html` or `docs/plans/index.html` by hand. When a plan changes, the rebuild hook runs `.harness/bin/build-index.mjs` and regenerates both. If you ever need to rebuild manually:

```
node .harness/bin/build-index.mjs
```
