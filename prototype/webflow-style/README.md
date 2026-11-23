# Software Engineering course planner prototype

Run from the repository root with Node.js 20 or newer. No installation is needed.

```sh
node prototype/webflow-style/server.mjs
```

Open [the local planner](http://127.0.0.1:5173). Set `PORT` to use a different port.
The browser stores changes locally. **Reset sample plan** restores the original schedule.
**Start blank** clears scheduled courses and note cards and restores term targets.
Use a scheduled course’s **⋯** menu to record its status. Passed and failed
courses stay in their recorded term. Choose **Planned** to unlock a course for editing.

To enable **Load Alex’s plan** for a private profile, set
`PLANNER_PROFILE_FILE` to the absolute path of its JSON file when starting the
server. The `.local/` directory is ignored by Git. The personal page uses its
own browser storage and local catalog.

The sample uses the Fall 2023 timeline with the program rules from
[Waterloo’s 2024–25 Software Engineering calendar](https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog/archive/2024-2025#/programs/H1zle10Cs3).
Each term has an editable class target. Zero-target terms are striped. Use
**Start year** and **End year** to choose the visible years. The saved plan keeps
courses and notes outside that range. Click a term title to edit it, or use the
plus in an empty slot to add a note card.
The schedule header opens a degree report with per-rule status and progress.
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
prototype does not evaluate grades, standing, enrollment restrictions, or term offerings.

Any static HTTP server can serve this directory. The bundled catalog, planner,
and prerequisite graphs work with no upstream service. Use
`PLANNER_OFFLINE=1 node prototype/webflow-style/server.mjs` to try that mode locally.
