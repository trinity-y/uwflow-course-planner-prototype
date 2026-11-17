# Degree planner prototypes

Both prototypes live here and run without a backend.

| Directory | Prototype | Runtime |
| --- | --- | --- |
| `original/` | Original roadmap, planner, and wishlist | Node.js 20+, no installation |
| `degree-planner/` | React course palette, term preview, wishlist, calendar rules, minors and specializations | Existing `frontend/` Bun dependencies |
| `comparison.html` | Side-by-side view of both prototypes | Emitted by the frontend build |

From the repository root, use two terminals:

```sh
make prototype-planner     # http://localhost:3000/degree-planner
make prototype-original    # http://localhost:5173
```

Compare them at http://localhost:3000/planner-comparison.html. If frontend
dependencies are missing, run `make frontend-install` first.

```sh
make prototype-check       # frontend lint, types and tests; original model tests
make frontend-build        # production assets, including the comparison page
```

The React prototype reuses UWFlow components, generated GraphQL types and the
frontend build tools. Its source and tests are in `degree-planner/`; the app
contains only its route, lazy import, and shared CSS integration. Do not install
a second set of React dependencies here.

See [the React prototype guide](degree-planner/README.md) for calendar sources
and planning behavior, or [the original guide](original/README.md).
