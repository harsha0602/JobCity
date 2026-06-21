# AGENTS.md

## Multi-Agent Development Rules

### Core Rule

Multiple agents may work on JobCity, but every agent must preserve the current working app.

No agent may make broad, unrelated changes while doing a scoped task.

Every change must be small, reviewable, testable, and reversible.

### Role Categories

Agents should classify their task before making changes.

Use these categories:

- Feature work: user-facing product behavior, UI, 3D interactions, job search flows, saved jobs, applications, visual improvements, bug fixes.
- Migration work: database migration, repository abstraction, Postgres, Alembic, Vite, TypeScript migration, auth architecture, compatibility layers.
- Infrastructure work: CI/CD, GitHub Actions, deployment, Docker, environment configuration, branch protection, preview/staging/production workflows.
- Testing work: unit tests, integration tests, E2E tests, fixtures, mocks, coverage, test reliability.
- Documentation work: README, AGENTS.md, migration docs, runbooks, architecture docs, PR checklists.
- Review work: code review, security review, design review, migration review, PR readiness checks, regression risk analysis.

An agent may work across categories only when explicitly required by the task. Otherwise, keep scope narrow.

### Non-Regression Rule

The current app must remain working after every change.

Agents must preserve:

- existing frontend behavior
- existing backend route behavior
- existing API response shapes
- existing 3D city rendering behavior
- existing ingest behavior
- existing deployment assumptions
- existing environment variable behavior unless explicitly migrating it

If a change intentionally modifies behavior, the PR must explain:

- what changed
- why it changed
- what compatibility is preserved
- how it was tested
- how to roll back

### Migration Safety Rule

Stack migration must be done through expand-and-contract steps.

Do not perform a big-bang rewrite.

Until the migration is complete:

- Mongo-backed behavior must continue working.
- New Postgres code must be added behind compatibility layers.
- Existing APIs must keep working.
- Existing frontend behavior must keep working.
- Existing deployment must remain available.
- New build/test infrastructure must not break current development flow.

Migration-owned areas include:

- repository/database abstraction
- SQLAlchemy models
- Alembic migrations
- Postgres session/connection code
- Mongo-to-Postgres parity tests
- Vite/build tooling
- TypeScript migration scaffolding
- auth architecture
- CI/CD workflows
- Docker/deployment workflows

Agents doing feature work should avoid changing migration-owned areas unless required.

Agents doing migration work should avoid changing feature behavior unless required.

### Shared File Rule

Some files may be touched by many agents. Treat them carefully.

Shared files include:

- AGENTS.md
- README.md
- package/dependency files
- environment example files
- Docker files
- GitHub Actions workflows
- app entry points
- API client files
- backend route files
- shared types/schemas
- major 3D scene files

Before editing shared files, agents must:

1. inspect the current file
2. understand recent changes if available
3. keep edits minimal
4. avoid reformatting unrelated sections
5. preserve existing instructions
6. document the reason for the edit

### Compatibility Layer Rule

Prefer adapters and compatibility layers over disruptive rewrites.

Examples:

- Add a repository interface instead of rewriting routes directly.
- Add a typed API wrapper instead of changing every component.
- Add Postgres next to Mongo before switching reads.
- Add Vite support carefully before removing CRA/Craco.
- Add auth abstractions before replacing auth behavior.
- Add tests before refactoring high-risk code.

### Testing Rule

Every meaningful change should include validation.

Use the smallest useful test set first, then broader checks when risk is higher.

Recommended checks:

- backend unit tests
- backend integration tests
- frontend unit tests
- frontend build
- lint/typecheck
- Docker build when Docker files change
- E2E tests when user flows change
- migration tests when database schema changes
- API parity tests when storage backends change

If tests cannot be run, the final response or PR summary must say why.

### gstack Usage

Use gstack when available for repo-aware execution and validation.

Agents should use gstack for:

- inspecting repo status
- checking the active branch
- reviewing current diffs
- running project commands
- running tests
- running build checks
- validating Docker or local startup
- preparing clean PR-ready changes
- confirming unrelated files were not changed

Before finishing, agents should summarize:

- files changed
- commands run
- tests/checks passed
- tests/checks not run
- known risks
- whether shared or migration-owned files were touched

### Superpowers Usage

Use superpowers when available for high-risk or architecture-heavy work.

Agents should use superpowers for:

- database schema design
- migration strategy
- auth/security decisions
- CI/CD design
- Vite/TypeScript migration strategy
- resolving merge conflicts
- diagnosing complex CI failures
- performance-sensitive 3D/frontend changes
- large refactors
- cross-cutting changes touching many files

Use both gstack and superpowers when a task needs both repo execution and deeper architectural reasoning.

### Branching Guidelines

Use clear branch names:

- feature/<short-description>
- fix/<short-description>
- migration/<short-description>
- infra/<short-description>
- test/<short-description>
- docs/<short-description>

Keep branches focused.

Do not combine unrelated feature, migration, infrastructure, testing, documentation, and formatting work in one branch.

### PR Summary Requirements

Every PR should include:

- task category
- what changed
- why it changed
- files changed
- tests/checks run
- tests/checks not run
- compatibility impact
- rollback plan
- known risks
- whether shared files were touched
- whether migration-owned files were touched

### Do Not Do

Agents must not:

- perform broad rewrites without explicit instruction
- remove working Mongo behavior before Postgres parity is proven
- remove compatibility layers without approval
- change deployment workflows as part of unrelated work
- change package/dependency files unnecessarily
- commit secrets
- hardcode production URLs or credentials
- reformat entire files unnecessarily
- delete existing docs or rules without preserving useful content
- bundle feature work with migration work unless explicitly required
