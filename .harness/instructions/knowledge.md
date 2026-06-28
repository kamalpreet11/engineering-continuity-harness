# Knowledge documents

Three kinds of knowledge live in `docs/`, all as HTML files with the same `<!--HARNESS ... -->` frontmatter.

- **concepts/** — how the project works. Navigation, persistence, auth flow, caching, and so on.
- **decisions/** — architecture decisions the user commits to. Strict choices, not suggestions.
- **specs/** — patterns the project follows. Themes, color guides, semantics, data flow (MVVM, MVI), naming.

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
5. The old decision file stays as it was. It is locked the moment it is superseded, same as plans.

## Frontmatter fields by type

- All: `type`, `name`, `created`, `description`, `keywords`.
- Decisions add: `tech_debt: pending | cleared`, and `supersedes:` / `superseded_by:` when relevant.
