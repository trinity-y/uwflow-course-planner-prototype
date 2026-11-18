# V2 — Course palette and degree previewer

Run `make prototype-install`, then `make prototype-v2` from the repository
root and open http://localhost:3000/degree-planner.

This is a standalone Vite/React package. From this directory you can also run:

```sh
bun install --frozen-lockfile
bun run start
bun run check
bun run build
# Serve the production build, including the comparison page:
bun run preview
```

No dependencies or source files from `frontend/` are required. The local UI
primitives and Tailwind tokens were copied from UWFlow. `api/queries.ts` and
its fragments snapshot the anonymous UWFlow course/review operations;
`api/types.ts` preserves their generated types from commit `d3f687f` unchanged.
This retains the existing backend response shape for a future API connection.
The current Apollo sample client serves local fixtures and makes no API calls.
Refresh these snapshots from UWFlow if its GraphQL contract changes.

No backend is required. The page uses local sample courses and React state;
refreshing the page starts with all named core courses placed in the selected
calendar’s recommended terms. Core alternatives, PD courses and electives
remain open for selection.

- Expand requirement groups and click a course to choose its term.
- Click a planned course to jump to its term; remove it in the previewer.
- Search the sample catalog from the header or “Add a course”.
- Switch between the published Stream 8X and Stream 8Y sequences.
- Auto-fill places named core/PD courses and representative required choices.
- Compare four consecutive terms starting at the selected term; arrows move one term at a time.
- Enable All terms for a horizontally scrolling degree board. Show work terms
  controls visibility without removing planned courses.
- Each term has its own Add Course action and prerequisite indicators.

The default curriculum uses the official **2025–2026** Software Engineering
calendar (Fall 2025 sample plan), retrieved November 17, 2026. The selector also
supports 2024–2025 and 2026–2027, described below:
https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog/archive/2025-2026#/programs/H1zle10Cs3

`softwareEngineeringCalendar.json` preserves the official public calendar API
response and the course records used by this seed. It contains the complete
term-by-term requirements, elective lists, prerequisites, antirequisites,
corequisites, grade/standing restrictions, and source URL. Calendar text in the
course modal comes from these records. Ratings and reviews remain fictional;
new courses are unreviewed. All fictional future offerings have been removed:
an empty schedule means availability is unknown.

`courseRequirements.json` provides the planner projection: 67 courses, the
published Stream 8X/8Y sequences, 1A/1B core example placements, course units,
recommended terms, four required choice groups, and degree requirement counts.
The program requires 21.50 units, 12 electives (two CSEs, three natural science,
four technical, one communication, two unrestricted), a sustainability course
that may overlap another elective, five PD courses, and five credited work terms.
Technical electives require one List 1, one List 2, and two more from Lists 1–3.
Communication needs 60% before 3A. Lab pair rules and full elective membership
remain in the source snapshot.

The graph projects course-only paths through the SE curriculum and selected
alternatives; it is not an exhaustive equivalency or eligibility engine. It does
not check grades, standing, antirequisites, corequisites, or elective allocation.
Full original prerequisite text is shown in course details. For example CS 247
requires CS 241 or CS 241E, not CS 246 or CS 251. CS 246 and CS 247 are
antirequisites. CS 350 is an optional catalog course; SE 350 is the core course.
Some non-SE and enriched prerequisite routes are outside the graph projection.
The archived SE 490 course record still requires SE 390 although SE 390 is not
in that program's term table; it is preserved as a prerequisite, not invented as
an additional unconditional degree requirement.

Recommended terms guide generation but do not block manual placement. Academic
display slots accommodate the published cohort loads (including seminars), not
an asserted university registration limit. Work terms retain two slots.
PD courses can only be placed in work terms. The shared placement guard applies
to manual additions, prerequisite term selectors, wishlist generation, and
prerequisite auto-add; automatic PD placement searches earlier work terms.
Generation selects an existing required-choice option when present, otherwise
uses a representative default; electives still require manual selection.
Progress counts individually named core and PD courses only, not a degree audit.
Existing algorithm/UI tests use the explicitly fictional fixture in
`__fixtures__/illustrativeRequirements.json`; `softwareEngineeringSeed.test.ts`
checks the real curriculum separately.

The course palette keeps vertically stacked, indented rows. Connector paths
follow actual prerequisite relationships, with one shared parent node. Required
courses keep blue styling even when they are also prerequisites. Neutral cards show optional choices and other catalog courses. Hover or keyboard-focus a course to highlight its full prerequisite
chain, without highlighting downstream courses. Search retains the ancestors of matching courses.

The palette starts from unplanned required courses and unsatisfied required
choice groups. Planned course nodes are hidden, including planned ancestors of
remaining requirements. Missing ancestors behind hidden courses stay visible,
and connectors bridge the hidden nodes without changing the underlying rules.
A planned choice satisfies its whole choice group. Search matches both remaining requirements and their
ancestors; the general Add Course search still searches the entire seed catalog.
There are no per-course collapse controls. The popup uses the choice tree described below.

## Requirements data and tree layout

`courseRequirements.json` is the editable planner data source. It includes program
metadata, groups, courses, initial placements, and sequences. A course has no
coordinates. Its `required` flag controls degree styling; prerequisite links come
from `prerequisiteOptions`. For example:

```json
"prerequisiteOptions": [["CS 246", "CS 251"], ["CS 240", "CS 251"]]
```

This means `(CS 246 and CS 251) or (CS 240 and CS 251)`. An empty array means no
prerequisites. Each referenced code must exist in the catalog. Keep the graph
acyclic. `plannerData.ts` imports the JSON and adapts it for the scheduling UI;
do not maintain a second prerequisite list in the JSON.

The tree pipeline has three independent parts:

- `prerequisiteGraph.ts`: builds nodes and actual edges, includes ancestors,
  shares parent nodes, and rejects missing references, duplicate codes, and cycles.
  It has no React, catalog import, or coordinate dependencies.
- `orderPrerequisiteGraph`: selects `depth` (shallowest first, ties in JSON catalog order) or
  `branches` (current default: follow a branch as far as possible
  while keeping every parent before its children). Add future strategies here.
- `paletteGraph.ts`: maps the ordered nodes to coordinates. Change
  `defaultPaletteLayout` or pass options for `stacking`, `rowHeight`, `rowGap`,
  `indent`, and `gutter`. Shared edges reference those same positioned nodes.
  `CourseGraph.tsx` renders the result and owns interaction styling.

For example, `paletteGraph(seeds, courses, { stacking: 'branches', indent: 16 })`
changes stacking and indentation without changing requirements or JSX.

Hovering or focusing a course colours each complete prerequisite alternative
separately. Shared connections use parallel strokes; a numbered legend
shows route membership without changing degree styling. Routes come from the
recursive prerequisite expansion over the remaining display graph, including
nested choices and courses required together. Planned courses stop a branch;
satisfied alternatives and their unused ancestors do not appear in hover
colours or labels. Full rules remain available for scheduling warnings and
course details. Downstream courses stay unhighlighted.

The prerequisite popup uses course-local choices instead of a numbered list of
complete paths. `prerequisiteChoices.ts` factors independent alternatives from
the JSON's AND/OR options, retaining coupled alternatives as course bundles.
For SE 350, ECE 222 is mandatory, while CS 240/CS 240E and CS 247/CS 246 are
two separate choices. Choosing a course reveals its own prerequisite choices.
Planned alternatives that precede the dependent are preselected. A shared
prerequisite has one node, labelled with all its visible dependents. Already-planned
prerequisite nodes are hidden when they precede their dependents. Their rules
remain in validation, so missing ancestors still appear. Planned nodes stay
visible if they need rescheduling or contain an unresolved choice. Hidden
intermediate nodes do not leave gaps in the tree indentation.

Scheduling uses only the selected branches. Once every reachable choice is
resolved, prerequisites needing addition or movement appear in dependency order
with editable suggested terms. When no earlier term can be suggested, the
course stays unassigned with a Choose a term placeholder; it is not silently
placed into the destination. Capacity warnings distinguish draft prerequisite
placements from the saved plan. Switching branches removes stale placements;
overrides for shared courses are preserved. Changes remain a draft until Add
prerequisites and course applies them. Add course anyway is always available
subject to capacity and fixed-term rules. Timing conflicts warn rather than
block. Offering availability remains unknown in this seed.

## Course details without a backend

Click a palette course to open details; use its circled plus to plan directly.
Planned-term buttons jump to the term. Prerequisite choices use their own radio controls.

`sampleCourseResponses.json` contains complete anonymous `GetCourseQuery` and
`CourseReviewsQuery` result objects, keyed by normalized course code and course
ID respectively. `sampleCourseClient.ts` checks them against the generated
operation types and serves the existing `GET_COURSE` and `COURSE_REVIEWS`
documents through an isolated Apollo link. It never falls back to a real server
or writes to the app's main Apollo cache. No schema or generated files changed.

All descriptions, ratings, reviews, IDs, and author names in these fixtures are
synthetic. The popup labels them as sample data. Aggregate ratings use the same
0–1 scale as Hasura; individual easy/useful scores use 0–4. Empty schedules,
nullable relationships, no-review courses, and absent courses retain query
response shapes. These are query fixtures, not SQL seed files or an assertion
that the local schema/metadata has been deployed.

To connect the modal later, remove its sample ApolloProvider/client wrapper so
`CourseDetails` uses the app's existing Apollo provider. The queries, variables,
generated types, and rendering remain the same. Remove the sample label when
using live data. Review voting and authenticated features are outside this
read-only popup; it currently uses the same anonymous queries as the course page.

Palette hearts toggle a separate wishlist using `useWishlist.ts`. Filled hearts
mean saved; activating a heart does not open details or place the course in a
term. The prototype persists course codes in browser localStorage under
`uwflow-degree-planner-wishlist-v1`, separate from the original prototype.
Wishlist changes are local to this browser, not synchronized to a UWFlow account.
The Wishlist tab at `/degree-planner?view=wishlist` shows the saved order.
Drag rows or use their up/down controls; ordering persists across reloads.

Generate schedule processes the wishlist in priority order, then optionally
processes remaining required courses. It tries academic terms for ordinary courses and work terms for PD courses and adds a complete feasible prerequisite option before each course. It
reuses existing placements, prefers options with fewer missing prerequisites,
and never moves an existing course. A failed option makes no partial changes.
Generation applies the result immediately and lists newly placed and unplaced
courses, with links to their terms. This is a greedy prototype scheduler, not a
global optimizer; offering availability remains unknown in the sample catalog.

Wishlist search matches course codes (with or without spaces) and names across
the full sample catalog, not just saved courses. Search-result hearts toggle
saved status without scheduling a course. Planned wishlist rows have no
right-arrow action; generated term summaries still link to the planner. Icon
actions use UWFlow’s existing tooltip component for hover and keyboard focus.

Wishlist rows show a compact checkmark and planned term, plus prerequisite
checks for both planned and unplanned courses. Any complete alternative path
satisfies the check; missing ancestors and courses scheduled too late warn.
Future offering labels use scheduled `sections[].term_id` values, deduplicated
and filtered after the current term. Cancelled sections are excluded. Empty schedules mean unknown, not that a course is unavailable.
The seed contains no future sections and generation does not enforce offerings.

Prerequisite expansion removes equivalent paths and paths that add courses or
ordering restrictions without providing another way to qualify. It compares
transitive ordering constraints, not just course sets: different feasible
orderings of the same courses remain separate. Path labels include nested OR
choices so these alternatives are distinguishable in the tree and picker.

## Minors and specializations

The Minors & specializations control previews, adds, and removes five plans from
the official 2025–2026 calendar: the Software Engineering AI, Business,
Computational Fine Art, and Human-Computer Interaction specializations, and the
Combinatorics and Optimization minor. Selection persists in browser localStorage
under `uwflow-degree-planner-enhancements-v1`. It does not declare a plan with
the university. Removing a plan keeps all scheduled and wishlisted courses.

`enhancementRequirements.json` stores the editable plan rules, source links,
counting restrictions, and 153 additional course records. Together with the base
seed, the catalog now contains 220 courses. `enhancementCalendar.json` preserves
the original program and additional course records from Waterloo's public
calendar API. New course descriptions and full eligibility text are official;
ratings remain absent and offering availability unknown. Course-only graph
projections prefer SE core equivalents; they are not exhaustive eligibility
checks. Grades, standing, approval, and general credential-combination policies
still require calendar/advisor review.

Each enhancement has separate planning progress. A maximum matching allocates
courses once within a plan, treats cross-listed/capped groups as one counting
unit, and enforces AI faculty minimums and Business upper-year minimums. A
course may count toward the base degree and multiple selected enhancements;
there is still only one calendar placement. Existing math courses immediately
count toward the CO minor. This is planned coverage, not a graduation audit.

The active curriculum is derived without mutating the seed catalog. It adds
mandatory courses and unsatisfied choice lists to the palette, and passes the
same catalog through course graphs, prerequisite planning, wishlist generation,
and the term board. Auto-fill includes selected enhancement choices, preferring
existing degree courses and routes requiring fewer additional prerequisites.
The scheduler remains greedy and reports courses that cannot fit. Backend
queries and response formats are unchanged.


## Academic calendar selection

The banner's Academic calendar selector loads independently sourced 2024–2025,
2025–2026, or 2026–2027 rules. `academicCalendars.ts` selects the course catalog,
core/choice requirements, cohort-load display slots, co-op sequence options,
calendar links, and the five enhancement rule sets together. Selection persists
under `uwflow-degree-planner-calendar-v1`. Calendar policy year is separate from
the sample entry year: changing policy does not shift term dates or remove
scheduled or wishlisted courses. If the existing co-op sequence is absent from
the selected year, it is retained and labelled existing schedule until the user
explicitly chooses another sequence.

`calendar2024.json` and `calendar2026.json` are the planner projections;
`calendar2024Source.json` and `calendar2026Source.json` preserve the original
public calendar API program and course records. The 2025 snapshot remains in
the existing requirement/enhancement source files. Examples of real differences:
2024 has four natural-science and three technical electives, includes SE 390
as a named core course, and has different recommended terms and sequences;
2025 has three natural-science and four technical electives; 2026 requires four
PD courses rather than five. Business requires eight courses in the 2024
calendar and seven in the later calendars.

Courses absent from a selected snapshot remain available for existing plans and
wishlists, flagged not listed rather than silently discarded or counted as a
new requirement. Course detail query fixtures are overlaid with the selected
calendar's official title, description and eligibility text using the same
GraphQL response contract. Grades, standing, recognition of historical credits,
and permission to follow another calendar still require university review.


The palette follows the selected calendar's elective categories: CSE List A and
List C, Natural Science, Technical Electives, the Undergraduate Communication
Requirement, and two unrestricted 0.5-unit electives. `electiveRequirements.json`
snapshots the eligible course codes and list minimums from each SE program's
course lists and the linked Engineering CSE lists (retrieved November 18, 2026).
Category counts allocate a planned course once across these elective buckets;
named core courses and selected core alternatives do not count again as electives.
Only course records available in the sample catalog are selectable; each category
shows its sample coverage and links to the full calendar list. COMMST 223 is a
selectable communication option. Counts track planning, not earned grades,
lecture/lab completion, or an official graduation audit. The overall progress
bar continues to count named core/PD courses. Core alternatives appear under
Core courses rather than a separate Required choices heading.


Core alternative groups use a descriptive `label` from the requirement JSON,
such as Mechanics or Human-computer interaction. Their optional `term` appears
as secondary recommended scheduling guidance. Groups without a term render the
same way, so the choice UI does not depend on an engineering cohort sequence.
