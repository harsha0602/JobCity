# Migration Coordination

Codex migration work and Claude feature work should proceed in parallel without overwriting each other.

## Ownership

- Codex owns stack migration, CI/CD, database migration, auth architecture, build tooling migration, and compatibility layers.
- Claude owns product features, UI behavior, application flows, bug fixes, and visual/user-facing improvements.

## Default Workflow

1. Inspect branch, status, recent commits, and relevant files before editing.
2. Identify whether the change touches migration-owned or feature-owned files.
3. Prefer additive adapters, wrappers, and compatibility layers over rewrites.
4. Preserve current Mongo-backed behavior and public API response shapes.
5. Run the tests and checks relevant to the files changed.

## Conflict Handling

If a migration change must touch feature-owned files, document:

- which files overlap
- why the migration needs those files
- what current behavior must be preserved
- what tests or checks prove preservation

If a feature change must touch migration-owned files, keep the edit narrow and document the same overlap in the PR.

## PR Expectations

Every migration PR should include:

- branch name
- files changed
- commands run
- tests passed
- known failures
- whether the app still starts
- whether public API behavior changed
- whether Claude feature work was touched
- the compatibility guarantee protecting the current app
