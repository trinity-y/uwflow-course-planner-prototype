# Degree planner UI prototype

Requires Node.js 20+; no package installation or backend needed.

```sh
cd ~/Desktop/vscode/uni/uwflow-course-planner-prototype/prototype
npm start
```

Open http://localhost:5173. Use `PORT=5174 npm start` if the port is occupied.
Run `npm test` for scheduling logic checks.

- Roadmap: study-term prerequisite graph, course details, elective slots and graduation progress.
- Planner: all four-month terms including work, exchange and breaks; drag/drop, keyboard move controls, load limits, extra terms, generation and validation.
- Wishlist: add/search/remove courses, filters, drag or arrow priority ordering, and scheduling.
- Header: program, stream, calendar and start-year configuration.
- Completed courses: manual history entry and independent completed-credit accounting.
- Save plan: localStorage; history and edits also save automatically in this browser.

Course rules, requirement totals, program sequences and offerings are illustrative. SE and CE share the sample catalog. The prototype does not import transcripts, query UWFlow, check every graduation rule or optimize globally. Generation is a priority-ordered greedy heuristic and retains existing placements. External course links open UWFlow. This app is isolated from the existing React/backend application.

View controls:
- Planner's Show work terms toggle only changes visibility, not course placement.
- All terms switches Roadmap and Planner from paginated views to a horizontally scrollable degree timeline.
- Click the program subtitle or profile button to set start and expected end terms/years. The default timeline contains 15 four-month terms (approximately five years).
- Course details, requirements and legend collapse independently; course details appear first.
- Wishlist search filters saved courses by code or name, together with the existing filters.

Additional controls:
- Click empty page space to deselect a course. Course actions and dialogs remain usable while selected.
- Hide details panel expands the term board; Show details panel restores it.
- Every displayed term has Add course; work terms also have Add PD. Pickers search the hardcoded sample catalog.
- Completed history includes search and per-course completion terms, including pre-degree terms. Dated prerequisites must precede the dependent course.
- Planner course borders are neutral; prerequisite routes use rounded curves around cards.
