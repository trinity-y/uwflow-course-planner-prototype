# Software Engineering course planner prototype

Run from the repository root with Node.js 20 or newer. No installation is needed.

```sh
node prototype/webflow-style/server.mjs
```

Open [the local planner](http://127.0.0.1:5173). Set `PORT` to use a different port.
Each calendar saves automatically in this browser's local storage. Reloading the
same address restores the active calendar, solve history, searches, open panels,
scroll position, and unfinished setup or term notes. A transcript review draft
stores the extracted terms and course outcomes. The browser releases the PDF
after reading it. **Reset sample plan** restores the original schedule.
**New calendar** opens setup. Choose a Waterloo unofficial undergraduate transcript
PDF or start with the Honours Software Engineering requirements. Confirm the
degree, years, current term, study sequence and course targets. Expand a recorded
term to inspect the courses and outcomes before creating the calendar. Setup
places missing fixed core courses in editable term slots once. **Expected**
identifies a required placement with no recorded course outcome. Existing
attempts keep their transcript term and status. An imported CS 241E keeps its
enriched course code and fulfills the CS 241 core and prerequisite requirements.
The browser reads PDFs with locally bundled
[PDF.js 5.6.205](https://www.npmjs.com/package/pdfjs-dist/v/5.6.205).
Transcript calendars use the bundled course catalog and stay in browser storage.

**Copy** creates an independent named calendar with its solve history. Use the
calendar selector to switch between copies.
Use a scheduled course’s **⋯** menu to record its status. Passed and failed
courses stay in their recorded term. Choose **Planned** to unlock a course for editing.

To enable **Load Alex’s plan** for a private profile, set
`PLANNER_PROFILE_FILE` to the absolute path of its JSON file when starting the
server. The `.local/` directory is ignored by Git. The personal page uses its
own browser storage and local catalog. Next to **Load Alex’s plan**, leave
**Load through** set to **All terms** or choose the last study term to include.
For example, **3A** imports the schedule through 3A. A new calendar also
preloads required courses in future study terms.
Each cutoff saves separately.

The sample uses the Fall 2023 timeline with the program rules from
[Waterloo’s 2024–25 Software Engineering calendar](https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog/archive/2024-2025#/programs/H1zle10Cs3).
Scroll horizontally through the term columns or jump to a year. Each term has
an editable class target. Empty zero-target and co-op terms are hidden by
default. Clear **Hide zero-target terms** to edit their targets. Terms with
academic courses above target stay visible with a warning. Drop an editable
course on the sidebar or between columns to remove it. Use
**Start year** and **End year** to choose the visible years. The saved plan keeps
courses and notes outside that range. Click a term title to edit it, or use the
plus in an empty slot to add a note card.
The schedule header opens a degree report with per-rule status and progress.
The badge on each academic term opens its calendar rules. Fixed courses count
in the listed term, with the calendar’s out-of-sequence exceptions.
Use a rule’s switch to remove it from the score and outstanding sidebar. The
fictional CS 100 rule provides an example to turn off.
Expand a category in the sidebar to browse and drag outstanding course choices.
Counted courses and additional eligible choices appear in the full degree report.
Expand **Eligible courses** within a rule to browse its choices. Use a course
code to open its planner and the star to save it under **Favorites**.
[The JSON rules](degree-requirements.json) contain calendar links and the
academic course and elective requirements. The checker uses archived course
IDs to count a cross-listed course once and requires both courses in a listed
science lecture/lab pair. Distinct electives fill overlapping category slots
without counting a course twice. Notes, co-op, and PD records stay on the schedule
outside degree validation. Grades and approved exceptions appear as separate checks.
CS 488 is a sample elective with a missing prerequisite. Try dropping CS 370 into an
earlier term to satisfy it, or drop CS 371 to see its own missing courses appear.
Click a course to open its graph. Every course in the graph has a term picker
for adding, moving, or unscheduling it directly. The board and prerequisite
buckets update as you edit. Branch labels show how many options a group needs.
Try FR 255 for a two-of-three example from the
[2023–24 French course catalog](https://ucalendar.uwaterloo.ca/2324/COURSE/course-FR.html).

The local server reads UW Flow’s public course index and retrieves prerequisite
text through read-only GraphQL. Sample graphs use curated course paths. For other
courses, straightforward course-only AND/OR expressions can produce warnings and
buckets. More complex text stays visible in the modal for manual review. The
prototype leaves grades, standing and enrollment restrictions for manual review.

Any static HTTP server can serve this directory. The bundled catalog, planner,
and prerequisite graphs work with no upstream service. Use
`PLANNER_OFFLINE=1 node prototype/webflow-style/server.mjs` to try that mode locally.

Turn on **Auto plan** in the solver panel to fill the remaining slots. A
**Must take** preference adds the course to **Schedule for Me**. Dragging a
course into that area sets the same preference. Published solves satisfy all
enabled rules, requests, modeled prerequisites and term limits. If the solver
cannot find a fit, it shows the unresolved constraints and tries other targets
separately. Suggested target changes require a complete solve with those limits.

Each term header has a solver lock. Past terms lock when the next Waterloo term
begins in January, May, or September. Completed transcript terms also start
locked. You can lock or unlock any term. Locking keeps its displayed courses and
target fixed across solves. Unlocking releases its automatic suggestions. You
can still correct a placement manually.

Use the seed controls to explore alternatives. Each history entry restores the
manual placements, preferences, limits and result of that solve. Solving from
an earlier entry adds a branch. Each moved course appears once in orange with
an arrow from its previous term to its new term.

Elective choices use a bundled snapshot of UW Flow aggregate ratings for 35
courses, retrieved in one limited query on November 25, 2026. Among otherwise
suitable courses, the solver prefers more ratings, then a higher liked score.
The snapshot includes ease, usefulness and comment counts. The browsing lists
use the same ordering. Courses outside the sample remain eligible. Expand **Enhanced courses**
at the bottom of the planner to browse the full list and open a course’s ratings and offering history.

**Course offerings** shows recorded terms for all 35 enhanced courses, combining
the [timetable archive](https://uwloo.ca/cs488/) with [UW Flow section listings](https://uwflow.com/course/cs488).
The November 25, 2026 snapshot covers Fall 2001 through the published Winter 2027
timetable. For terms within that window the solver requires a listed section.
For later terms it repeats the seasons recorded in the most recent calendar year
in which that course ran, through Fall 2026. Open the offering history from a
course or the solver panel to inspect the evidence. Manual placements outside
those terms show a warning. Recorded enrollments and results keep their terms.
Courses without offering data have no season restriction.

Run the planner tests from the repository root:

```sh
node --test prototype/webflow-style/*.test.mjs
```
