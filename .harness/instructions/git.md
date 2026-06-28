# Git, branches, and releases

## Branches

- Never work on main. The hook blocks commits there.
- Every plan gets a branch named `plan/<plan-name>`. One plan, one branch.
- Open it when you start the plan: `git checkout -b plan/<name>`.

## Commits

- Do not nag the user to commit. When a unit of work is done and verified, remind them to review the changes and commit when they are ready.
- Use **Conventional Commits**. Subject: `<type>: summary` or `<type>(scope): summary`.
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- Subject under 72 characters, imperative, plain English. Add a body for context when useful.
- Zero AI fluff. Zero attributions. No "Co-Authored-By" line, no "Generated with", no emoji padding.
- The git commit-msg hook (`.harness/githooks/commit-msg`) blocks anything that does not match.

Good:
```
feat: add social login with google and facebook
```
```
fix(auth): refresh the provider token on callback

The token expired before the redirect completed, so the first
call after login failed. Refresh it in the callback handler.
```

Bad:
```
implemented comprehensive OAuth2 authentication solution 🚀

Co-Authored-By: ...
```

## Bringing work to main

When the plan's work is verified:

1. Rebase onto main, do not merge:
   ```
   git checkout main
   git rebase plan/<name>
   ```
2. Mark the plan `implemented` (add `implemented: <date>`). This is the plan's final edit.
3. Ask the user: **is this a meaningful release?**
   - If no, stop. The work is on main, tagged by nothing.
   - If yes, tag it with a semver bump. The commit types suggest the level:
     - `major` — a `!` or `BREAKING CHANGE` footer in the work.
     - `minor` — `feat` commits, backward compatible.
     - `patch` — `fix` and the rest.
   - Confirm the level with the user before tagging.
   ```
   git tag v<major>.<minor>.<patch>
   ```

The rebase and tag are real, irreversible actions. Do them only after the user confirms.
