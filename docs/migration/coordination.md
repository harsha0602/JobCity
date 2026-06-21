# Migration Coordination

JobCity is being developed by multiple agents in parallel. No agent owns the whole repo.

All work should be classified before edits begin:

- Feature work: product behavior, UI, 3D interactions, job search flows, applications, saved jobs, visual improvements, and bug fixes.
- Migration work: database migration, repository abstraction, Postgres, Alembic, Vite, TypeScript, auth architecture, and compatibility layers.
- Infrastructure work: CI/CD, GitHub Actions, deployment, Docker, environment configuration, and release workflows.
- Testing work: unit tests, integration tests, E2E tests, fixtures, mocks, coverage, and test reliability.
- Documentation work: README files, AGENTS.md, migration docs, runbooks, architecture docs, and PR checklists.
- Review work: code review, security review, design review, migration review, and PR readiness checks.

## Coordination Rules

- Keep changes scoped and reversible.
- Preserve current app behavior.
- Preserve current API response shapes and frontend behavior unless the task explicitly changes them.
- Preserve Mongo-backed behavior until Postgres parity is proven.
- Use small expand-and-contract migration steps instead of big-bang rewrites.
- Add compatibility layers before switching storage, auth, build tooling, or API behavior.
- Feature work must avoid breaking migration scaffolding.
- Migration work must avoid breaking product behavior.
- Infrastructure work must avoid changing app behavior unless explicitly required.
- Testing work must not make the local development flow harder to use.
- Documentation work must not delete useful existing instructions.

## Shared Files

Shared files require extra caution because many agents may need to edit them.

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

Before editing shared files, inspect the current file, understand recent changes if available, keep the edit minimal, avoid unrelated formatting, and document the reason in the PR summary.

## Overlap Handling

When work crosses categories, document the overlap in the PR summary:

- which categories are involved
- which shared or migration-owned files changed
- why the overlap was required
- what behavior must be preserved
- what tests or checks prove it was preserved
- how to roll back if the change causes problems

## Tooling

Use gstack when available for repo-aware execution and validation:

- inspect repo status
- check the active branch
- review diffs
- run project commands
- run tests and builds
- validate Docker or local startup when relevant
- confirm unrelated files were not changed
- prepare PR-ready changes

Use superpowers when available for high-risk reasoning:

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

Use both tools when work needs both repo execution and deeper architectural reasoning.
