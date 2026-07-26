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
   - `knowledge:` the concepts, decisions, and specs this work will produce, as pipe-separated paths under `docs/`. Example: `concepts/auth-flow.html | decisions/token-storage.html`. At creation time this is your best guess — correct it before you resolve the plan.
4. Write the plan body in the HTML. Plain English. Cover the context (why), the approach, the files touched, and how to verify.
5. Open the branch: `git checkout -b plan/<name>`.

The visible status badge and the dates line in the body are **generated**, not hand-authored. They live between `<!-- harness:status:start -->` / `<!-- harness:status:end -->` and `<!-- harness:dates:start -->` / `<!-- harness:dates:end -->` markers, and `build-index.mjs` rewrites them from the frontmatter on every rebuild. Never edit them by hand and never remove the markers. Set the state and dates in the frontmatter; the rendered page follows.

## States

A plan is always in exactly one state.

- `created` — live work in progress. The only editable state.
- `implemented` — the work is done, verified, and rebased to main. Add `implemented: <date>`, and `knowledge:` must account for what the work taught the project.
- `abandoned` — the work is dropped. Add `abandoned: <date>` and `abandoned_reason: <plain english>`.
- `superseded` — a newer plan replaces this one. Add `superseded: <date>` and `superseded_by: PLAN-<name>`.

## Resolving a plan

Setting the state to implemented, abandoned, or superseded is the **last edit you may make** to that file. After that the hook locks it.

- The transition edit itself is allowed because the file on disk is still `created` at that moment.
- Make the state flip **and everything the resolution needs atomic** — change `state:`, add the matching date (`implemented:` / `abandoned:` / `superseded:`), and set every required field in the **same single edit**. Once the state on disk is no longer `created`, the file is locked and no follow-up frontmatter edit is possible. The hook checks the settings block the file is *about to* have, so an incomplete resolution is refused rather than half-applied.
- You do not touch the body badge or dates line — they regenerate from the frontmatter you just set.
- Once resolved, never touch it again. To revisit, open a new plan.

### What each resolution must carry

| Resolving to | Required |
| --- | --- |
| `implemented` | `implemented: YYYY-MM-DD` and a `knowledge:` accounting |
| `abandoned` | `abandoned: YYYY-MM-DD` and `abandoned_reason:` |
| `superseded` | `superseded: YYYY-MM-DD` and `superseded_by: PLAN-<name>` |

### The knowledge accounting

Before marking a plan implemented, work out what the project learned from it. `.harness/instructions/knowledge.md` has the three questions that decide whether the work owes a concept, a decision, or a spec.

- Write the documents **first**, then resolve the plan. The hook checks that every path in `knowledge:` exists under `docs/`, so resolving before the document is written is refused.
- Entries are paths relative to `docs/`, separated by `|`, and each one must be a `concepts/`, `decisions/`, or `specs/` file:
  ```
  knowledge: concepts/auth-flow.html | decisions/token-storage.html
  ```
- When the work genuinely produced none, say so and say why:
  ```
  knowledge: none
  knowledge_reason: dependency version bump only, no behavior or pattern changed
  ```
  `none` without a `knowledge_reason:` is refused. If you cannot write that one sentence honestly, the work owes a document.

## The indexes

You never write `docs/index.html` or `docs/plans/index.html` by hand. When a plan changes, the rebuild hook runs `.harness/bin/build-index.mjs` and regenerates both. If you ever need to rebuild manually:

```
node .harness/bin/build-index.mjs
```
