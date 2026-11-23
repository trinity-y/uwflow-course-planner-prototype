# Software Engineering course planner prototype

Run from the repository root with Node.js 20 or newer. No installation is needed.

```sh
node prototype/webflow-style/server.mjs
```

Open [the local planner](http://127.0.0.1:5173). Set `PORT` to use a different port.
The browser stores changes locally. **Reset sample plan** restores the original schedule.
**Start blank** clears scheduled courses and restores the calendar term targets.

The sample starts in Fall 2023 and follows the study and co-op sequence in
[Waterloo’s 2023–24 Software Engineering calendar](https://academic-calendar-archive.uwaterloo.ca/undergraduate-studies/2023-2024/page/ENG-Software-Engineering.html).
Each term has an editable course target. Initial study targets include the
calendar’s elective and communication course slots. Targets count courses.
The schedule header opens a degree report with per-rule status and progress.
Expand a category in the sidebar to browse and drag courses for incomplete
requirements, including communication, elective groups, PD, and co-op.
Expand **Eligible courses** within a rule to browse its choices. Use a course
code to open its planner and the star to save it under **Favorites**.
[The JSON rules](degree-requirements.json) contain calendar links and the
course, elective, and work-term requirements. The checker uses archived course
IDs to count a cross-listed course once and requires both courses in a listed
science lecture/lab pair. Distinct electives fill overlapping category slots
without counting a course twice. Schedule a `COOP` card in a co-op term to
include it in the plan. Grades, work-term evaluations, and approved exceptions
appear as separate checks.
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
prototype does not evaluate grades, standing, enrollment restrictions, or term offerings.

Any static HTTP server can serve this directory. The bundled catalog, planner,
and prerequisite graphs work with no upstream service. Use
`PLANNER_OFFLINE=1 node prototype/webflow-style/server.mjs` to try that mode locally.
