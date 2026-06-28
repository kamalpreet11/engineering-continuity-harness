# Git, branches, and releases

## Branches

- Never work on main. The hook blocks commits there.
- Every plan gets a branch named `plan/<plan-name>`. One plan, one branch.
- Open it when you start the plan: `git checkout -b plan/<name>`.

## Commits

- Do not nag the user to commit. When a unit of work is done and verified, remind them to review the changes and commit when they are ready.
- Commit messages are short. One or two sentences, like a text message. Plain English.
- Zero AI fluff. Zero attributions. No "Co-authored-by" line, no tool credits, no emoji padding.

Good:
```
Add social login with Google and Facebook.
Wire the callback route and store the provider token.
```

Bad:
```
feat: implement comprehensive OAuth2 authentication solution 🚀

Co-authored-by: ...
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
   - If yes, tag it with a semver bump. Ask which level:
     - `major` — breaking change.
     - `minor` — new feature, backward compatible.
     - `patch` — fix or small change.
   ```
   git tag v<major>.<minor>.<patch>
   ```

The rebase and tag are real, irreversible actions. Do them only after the user confirms.
