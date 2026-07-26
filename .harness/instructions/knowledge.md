# Knowledge documents

Three kinds of knowledge live in `docs/`, all as HTML files with the same `<!--HARNESS ... -->` frontmatter.

- **concepts/** — how the project works. Navigation, persistence, auth flow, caching, and so on.
- **decisions/** — architecture decisions the user commits to. Strict choices, not suggestions.
- **specs/** — patterns the project follows. Themes, color guides, semantics, data flow (MVVM, MVI), naming.

These are not optional paperwork. They are the reason the project stays understandable after the session that built it is gone. They get written **as the work happens**, and a plan cannot be marked implemented until it accounts for them.

## When each one is owed

Before you resolve a plan, look back over what the work actually did and ask these three questions.

**Did the work add or change how a part of the system works, in a way someone would need explained?** That is a **concept**. A new flow, a lifecycle, a subsystem's job, how two pieces talk to each other. If a newcomer would have to read the code to understand the shape of it, the concept is missing.

**Did the work choose between real alternatives, in a way that constrains what comes later?** That is a **decision**. A library, a storage engine, a protocol, a structure, a boundary. A useful tell: if your plan's Approach section explains why you did not do it the other way, you made a decision — write it down as one.

**Did the work establish a pattern that other code must now follow?** That is a **spec**. Naming, theme tokens, layering, data flow, error shape, file layout. Anything where the next contributor should copy what you did rather than invent their own.

If the answer to all three is no — a typo, a dependency bump, a bug fixed inside a pattern that already exists and needs no explanation — then nothing is owed. Say so on the plan with `knowledge: none` and a `knowledge_reason:`. Be honest either way: the hook checks that you accounted for the knowledge, but only you can tell whether the account is true.

One plan can produce several documents, or update existing ones. Updating counts — if the work changed how something already documented behaves, the fix is to rewrite that document, and it belongs in the plan's `knowledge:` list.

## The one rule that matters most: be current

Every one of these documents describes how things are **right now**. Nothing else.

- No history. No "we started with X and moved to Y". No debugging narration.
- If something changes, you rewrite the document so it reflects the new reality. The old reality is simply gone from the page.
- This is the opposite of a changelog. The git history is the changelog. The document is the present.

## Creating a concept or spec

1. Copy the matching template from `.harness/templates/`.
2. Save it in `docs/concepts/` or `docs/specs/` with a short kebab-case name. Example: `docs/concepts/navigation.html`.
3. Fill the frontmatter: `type`, `name`, `created`, `description`, `keywords`.
4. Write the body in plain English.

## Decisions and changing your mind

A decision is a commitment. When the user changes a decision:

1. Do **not** edit the old decision. Create a **new** decision file as the current state.
2. In the new file, set `supersedes: <old-decision-name>` and write the current decision plainly.
3. In frontmatter, you must include `tech_debt: pending | cleared`.
4. **Ask the user how they want the tech debt handled.** Their answer sets the tag:
   - `pending` — the old approach still exists in the code and needs cleanup later.
   - `cleared` — the old approach is fully removed; no debt remains.
5. The old decision file stays as it was. The hook locks it the moment a newer decision names it in `supersedes:`, same as a resolved plan. Nothing can edit it again.

## Frontmatter fields by type

- All: `type`, `name`, `created`, `description`, `keywords`.
- Decisions add: `tech_debt: pending | cleared`, and `supersedes:` / `superseded_by:` when relevant.

## Naming these documents on a plan

The plan that produced a document lists it in the plan's `knowledge:` field, as a path under `docs/` — `concepts/navigation.html`, `decisions/state-store.html`, `specs/naming.html` — with `|` between entries. The document has to exist before the plan can be resolved, so write it first. `.harness/instructions/planning.md` covers the mechanics.
