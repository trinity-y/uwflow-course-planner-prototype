# React degree planner prototype

Follow the [general guide](../../styleguide/general.md),
[frontend instructions](../../frontend/AGENTS.md),
[React guide](../../styleguide/frontend/react.md), and
[design system guide](../../styleguide/frontend/design-system.md).

This folder uses the existing frontend dependencies and tooling. Run checks
from the repository root with `make prototype-check` and `make frontend-build`.
Run `bun run lint-nofix` from `frontend/` before committing. Keep the prototype
source, colocated tests, and calendar fixtures together here; production code
stays in `frontend/src/`. Never edit generated GraphQL output by hand.
