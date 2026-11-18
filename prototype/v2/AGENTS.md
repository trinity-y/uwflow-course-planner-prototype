# Standalone React degree planner prototype

Follow the [general guide](../../styleguide/general.md),
[React guide](../../styleguide/frontend/react.md), and
[design system guide](../../styleguide/frontend/design-system.md).

This package owns its dependencies, build, styles, tests and API snapshots.
Do not import files or resolve packages from `frontend/`. Run `bun run check`
and `bun run build` here, or `make prototype-check` and `make prototype-build`
from the repository root. Keep source, tests and calendar fixtures together.
The types in `api/types.ts` are an unmodified subset of generated UWFlow types;
update their snapshot from generated output, rather than editing fields by hand.
