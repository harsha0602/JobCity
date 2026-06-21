# Migration PR Checklist

Use this checklist for every Codex migration PR.

## Scope

- [ ] Scope is one migration step only.
- [ ] Change is small, reviewable, and independently revertible.
- [ ] Existing app behavior is preserved.
- [ ] Public API behavior is unchanged, or a compatibility adapter preserves existing frontend behavior.
- [ ] Mongo-backed behavior remains available until Postgres parity is proven and removal is explicitly in scope.

## Agent Tooling

- [ ] Did this task require gstack?
- [ ] Did this task require superpowers?
- [ ] Which commands/checks were run through gstack?
- [ ] What architectural/risk decisions were made using superpowers?
- [ ] If either tool was unavailable, the PR explains the fallback validation used.

## Non-Disruption

- [ ] Current branch and worktree status were inspected before edits.
- [ ] Recent commits or active PRs were considered where available.
- [ ] Did this PR touch files likely affected by Claude's feature work?
- [ ] If yes, the PR explains why the migration had to touch those files.
- [ ] The PR names the behavior that must be preserved.
- [ ] The PR names the tests or checks proving that behavior was preserved.

## Validation

- [ ] Existing app still starts, or startup is not relevant and the PR explains why.
- [ ] Existing backend tests pass, or backend tests were not relevant and the PR explains why.
- [ ] Existing frontend tests pass, or frontend tests were not relevant and the PR explains why.
- [ ] New tests were added where relevant.
- [ ] Lint/typecheck/build checks pass where relevant.
- [ ] Docker or Compose validation passed where relevant.
- [ ] README, environment, workflow, or setup docs were updated where relevant.
- [ ] No secrets were committed.
- [ ] No production-only environment assumptions were introduced.

## Required PR Summary

Every migration PR must answer:

- Branch name:
- Files changed:
- Commands run:
- Tests passed:
- Known failures, if any:
- Does the app still start?
- Did any public API behavior change?
- Did this task require gstack?
- Did this task require superpowers?
- Which commands/checks were run through gstack?
- What architectural/risk decisions were made using superpowers?
- Did this PR touch files likely affected by Claude's feature work?
- What compatibility guarantee protects the current app?
