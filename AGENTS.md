# AGENTS.md

## Migration Guardrails

Migration agents must preserve the current working app while moving JobCity toward the target production stack.

Migration agents must use gstack for repo-aware execution and validation when available. Migration agents must use superpowers for architecture-heavy, high-risk, security-sensitive, database, CI/CD, auth, or conflict-resolution tasks. Do not perform large migration changes without first creating a small plan and preserving current app behavior.

Before making migration changes:

- Inspect the current branch, git status, recent commits, and relevant active work.
- Identify files likely owned by Claude feature work and avoid editing them unless the migration requires it.
- Keep changes small, reviewable, and independently revertible.
- Prefer compatibility layers, adapters, and additive scaffolding over rewrites.
- Do not remove Mongo-backed behavior until Postgres parity is proven and the migration phase explicitly allows removal.
- Do not change public API contracts unless a compatibility adapter preserves existing frontend behavior.
- Do not introduce secrets or production-only assumptions.
- Document setup, environment variable, workflow, or command changes in the same PR.

Before a migration PR is ready:

- Run backend tests when backend behavior, infrastructure, or shared contracts are touched.
- Run frontend tests when frontend behavior, build tooling, or shared contracts are touched.
- Run lint, typecheck, build, Docker, or Compose validation when those surfaces are touched.
- Confirm whether the app still starts, or document why startup was not relevant to a docs-only change.
- Include test output and known failures in the PR summary.
- Keep the final worktree limited to the migration scope.

Every migration PR must include a short validation summary:

- Branch name
- Files changed
- Commands run
- Tests passed
- Known failures, if any
- Whether the app still starts
- Whether any public API behavior changed

If a migration must touch files likely affected by Claude feature work, document:

- What file conflicts with feature work
- Why the migration needs to touch it
- What behavior must be preserved
- What tests prove it was preserved

## Claude Code Feature Development Rules

These rules apply to Claude Code and other feature-development agents. They mirror the Migration Guardrails above so feature work and migration work can proceed in parallel without colliding. See `docs/migration/coordination.md` for the shared coordination model.

### Role Boundary

- Claude Code is responsible for feature development, UI/product behavior, bug fixes, and user-facing improvements.
- Codex is responsible for stack migration, database migration, CI/CD, auth architecture, the Vite migration, the TypeScript migration strategy, and platform-level refactors.
- Claude Code must not perform broad stack migration work unless explicitly asked.

### Non-Regression Rule

The current app must remain working after every Claude Code change. Do not break existing functionality while adding new features. Claude Code must preserve:

- existing API response expectations
- existing route behavior
- existing frontend behavior
- current 3D city rendering behavior
- current ingest behavior
- current deployment assumptions

### Migration Awareness

Codex may introduce compatibility layers, repository interfaces, Postgres scaffolding, Vite scaffolding, new test infrastructure, and CI/CD changes. Claude Code must not remove or bypass those migration layers.

If a feature needs to touch migration-owned files, Claude Code must explain why and keep the change minimal. Migration-owned areas include:

- database abstraction/repository layers
- Alembic migrations
- SQLAlchemy models
- Postgres connection/session code
- CI/CD workflows
- Docker/deployment workflows
- AGENTS.md migration rules
- Vite/build tooling
- TypeScript migration scaffolding
- auth architecture

### Feature Work Guidelines

For feature PRs:

- keep changes focused
- avoid unrelated refactors
- avoid large file moves
- avoid formatting entire files unnecessarily
- preserve existing props and API shapes unless intentionally changing them
- add tests for new behavior where practical
- update docs when setup or behavior changes
- do not commit secrets
- do not hardcode production URLs or credentials

### Coordination With Codex

Before making changes, Claude Code should inspect:

- the current branch
- the current diff
- recent relevant files
- whether files look migration-owned
- whether the change overlaps with Codex migration work

If there is overlap, prefer one of these:

1. avoid the file
2. add a small adapter/wrapper
3. preserve both old and new behavior
4. document the conflict clearly

### gstack Usage

Use `gstack` when available for repo-aware execution and validation. Claude Code should use `gstack` for:

- checking repo status before work
- running frontend tests
- running backend tests when feature changes touch backend behavior
- running build checks
- validating Docker or local app startup when relevant
- producing a clean final diff
- confirming no unrelated files changed

Before finishing a feature task, Claude Code should summarize:

- branch/status
- files changed
- commands run
- tests passed or not run
- known risks
- whether Codex migration-owned files were touched

### Superpowers Usage

Use `superpowers` when available for high-risk reasoning. Claude Code should use `superpowers` for:

- feature changes touching many files
- complex 3D rendering changes
- performance-sensitive UI changes
- auth-related feature work
- API contract changes
- feature work that overlaps with Codex migration work
- resolving conflicts with Codex branches
- diagnosing non-obvious test or CI failures

Use both `gstack` and `superpowers` when the feature work is high-impact and needs both reasoning and repo validation.

### Feature PR Checklist

Every Claude feature PR should answer:

- What user-facing behavior changed?
- What files changed?
- Did this touch migration-owned code?
- Did this preserve current API behavior?
- Did this preserve current UI behavior?
- What tests were run?
- What could regress?
- How can this be rolled back?

### Do Not Do

Claude Code must not:

- replace Mongo with Postgres
- remove Mongo code
- migrate CRA to Vite
- rewrite auth
- rewrite CI/CD
- change deployment workflows
- delete Codex migration docs
- change AGENTS.md migration rules except to clarify coordination
- do large refactors bundled with feature work
- remove compatibility layers introduced by Codex
