# Software Engineering course planner prototype

Run from the repository root with Node.js 20 or newer. No installation is needed.

```sh
node prototype/webflow-style/server.mjs
```

Open [the local planner](http://127.0.0.1:5173). Set `PORT` to use a different port.
The browser stores changes locally. **Reset sample plan** restores the original schedule.

The sample starts in Fall 2023 and follows the study and co-op sequence in
[Waterloo’s 2023–24 Software Engineering calendar](https://academic-calendar-archive.uwaterloo.ca/undergraduate-studies/2023-2024/page/ENG-Software-Engineering.html).
Each term has an editable course target. Initial study targets include the
calendar’s elective and communication course slots. Targets count courses.
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
