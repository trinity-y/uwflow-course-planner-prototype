# Degree planner prototypes

Both prototypes run independently of the UWFlow frontend and backend.

| Directory | Prototype | Runtime |
| --- | --- | --- |
| `v1/` | V1: roadmap, planner, and wishlist | Node.js 20+, no installation |
| `v2/` | V2: React course palette, term preview, wishlist, calendar rules, minors and specializations | Bun and its own dependencies |

From the repository root, use two terminals:

```sh
make prototype-install    # one-time installation for the React prototype
make prototype-v2         # http://localhost:3000/degree-planner
make prototype-v1         # http://localhost:5173, in a second terminal
```

Compare them at http://localhost:3000/planner-comparison.html. The comparison
page lives in `v2/public/` and is served by the React prototype.

```sh
make prototype-check      # React lint, types and tests; V1 model tests
make prototype-build      # production assets in v2/dist/
```

The React prototype has its own package manifest, lockfile, Vite build, tests,
styles and API snapshots. It can be copied outside this repository and run with
`bun install --frozen-lockfile` and `bun run start`. No files or installed
packages from `frontend/` are needed.

See [the V2 guide](v2/README.md) for calendar sources
and planning behavior, or [the V1 guide](v1/README.md).
