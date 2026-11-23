# Alex’s course planner mockup

This is the feature record for the Software Engineering course planner on `alex-mockup-1`. The mockup is a standalone page for trying an academic schedule for a student entering Waterloo in Fall 2023. See the [prototype README](prototype/webflow-style/README.md) to run it and the [degree rules](prototype/webflow-style/degree-requirements.json) for the modeled calendar data and source links.

## Schedule and course discovery

- Show Winter, Spring, and Fall as columns, with one row per calendar year. Use **Start year** and **End year** to choose the visible years. Keep courses and notes outside that range in the saved plan.
- Label academic terms by study level and show co-op terms alongside them. Click the title area on any term to give it a custom title, such as a company name. Use imported company names as the initial titles in Alex’s plan.
- Let users search by course code or name and drag cards from the sidebar into terms. Scheduled courses can move between terms unless their outcome locks them in place.
- Give each term an editable class target and show remaining capacity as **Empty slots**. Seed study-term targets from the calendar curriculum. Co-op terms and the two trailing open terms start at zero and use a grey striped background. Existing co-op and PD records stay on the board outside the class count.
- Click the plus in an empty slot to add a note card with a title and optional details, such as an exchange placeholder. Notes use a slot in terms with a positive target. Zero-target terms also accept notes. Click a note to edit or remove it. Keep notes outside degree validation.
- Offer **Start blank** to clear scheduled courses, recorded outcomes, and note cards. Provide a way to restore the sample schedule or the imported personal schedule.
- Organize the sidebar in this order: **Degree requirements**, **Missing prerequisites**, **Favorites**, and **Find courses**. The recommendation tabs from the early sketch were left out of the design.
- Show a general course catalog under **Find courses** and remove courses from those results once they are scheduled. Apply required-course and elective categories in the degree views.
- Put a star alongside the course code in the schedule, catalog, prerequisite views, and degree choices. Keep the star inside the course chip where there is one. Give favorites their own sidebar collection for inspection and scheduling. Use CS 448 as the sample favorite.

## Missing prerequisites and the course graph

- Show a warning on a scheduled course when its modeled prerequisites need attention. Explain what is missing or which course needs an earlier term in the warning’s hover or focus text.
- Group the sidebar’s missing prerequisites by the course that needs them. Display a named course as a direct requirement and alternatives as a choice such as **Choose 1 of 3**. Show outstanding choices and let users drag them into the schedule.
- Keep the sidebar one prerequisite level deep for each scheduled course. If adding a course creates its own missing prerequisites, create a bucket for that course. Hide the entire sidebar section when there are zero buckets.
- Open a modal graph from an individual course. Use the iPad sketch as a reference for showing earlier foundations, direct prerequisite options, and the goal course. Make it clear which courses are already in the plan and which need scheduling or an earlier term. CS 488 is the reference example for a course with several branches. Representative prerequisite paths are enough for the mockup.
- Draw explicit slots for a selected course’s distinct requirements. Put **One of**, **Two of**, or the applicable requirement count at the slot where its options come together. Clicking a course reveals its own slots. Clicking a slot highlights the courses that can fill it. Hovering an option emphasizes that course and its set while dimming unrelated nodes and lines.
- Put a term picker under each course in the graph, including the goal course. Use it to schedule, move, or remove an editable course directly. Course outcome locks apply here too.
- On the academic schedule, highlight a hovered course and any of its direct prerequisites that are already on the board. Dim unrelated cards and signal when a prerequisite is scheduled too late.

## Degree requirements and progress

- Use Waterloo’s archived 2024–25 Software Engineering calendar to model fixed courses, course lists, elective counts and academic term rules in JSON. ECE 106 is an optional natural science choice. The report covers academic requirements only, with co-op and PD left outside degree validation. Keep the rule source available in the report. [Waterloo’s 2024–25 calendar](https://uwaterloo.ca/academic-calendar/undergraduate-studies/catalog/archive/2024-2025#/programs/H1zle10Cs3)
- Use the sticky **Academic schedule** header to show the fraction and percentage of modeled rules met and whether the plan passes. Keep prerequisite warnings visible in the header when present.
- Open a report from that summary. Each rule shows **Met** or **Incomplete**, plus a horizontal progress bar where a rule has multiple slots. Show per-term counts where distribution across terms matters.
- In the sidebar, show incomplete degree categories, their remaining progress, and uncounted course choices. Include communication, technical and science electives, and complementary studies alongside the core curriculum. Let users browse, star, and schedule outstanding choices. Remove each category once it is met and hide the whole section once all rules are met. Keep counted courses and surplus choices in the full report.
- Open **Course details** by default in the report. Show assigned courses in green under **Counted**, extra scheduled choices under **Additional eligible**, and outstanding fixed courses under **Missing**. Keep the full eligible pool available to browse and star. Show surplus choices even when the rule is already met.
- Give each rule a switch in the full report. A rule set to **Off** stays visible there for re-enabling and drops out of the validation percentage and outstanding sidebar. Save switches with the plan. Include a fictional **Demo rule · CS 100** that starts on so users can try turning it off.
- Reserve distinct courses for distinct elective category slots. Count cross-listed equivalents as one choice and a listed lecture–lab pair as one science choice when both are in the plan. Account for term placement when deciding which courses count.

### Calendar rules tracked

| Rule | What the planner checks |
| --- | --- |
| Core Software Engineering courses | Schedule all 38 fixed courses, including all seven seminars. |
| User interfaces or human-computer interaction | Choose CS 349, CS 449, or MSE 343. |
| Undergraduate communication | Schedule one approved course before 3A. |
| Advanced technical elective, CS list | Choose one course from the CS list in 3A or later. |
| Advanced technical elective, ECE list | Choose one course from the ECE list in 3A or later. |
| Additional advanced technical elective | Choose a separate course from the CS, ECE, or extended list in 3A or later. |
| Natural science, mechanics | Choose ECE 105, PHYS 115, or PHYS 121. |
| Additional natural science electives | Choose three distinct options from the science lists in addition to mechanics. A listed lecture and lab together count as one choice. |
| Technology and society, List A | Choose one course from List A. |
| Humanities and social sciences, List C | Choose a separate course from List C. |
| Sustainability | Choose one listed course. It can also count toward another elective rule. |
| Total academic electives | Schedule 12 distinct electives. Ten fill category requirements and two are additional eligible 0.50-unit courses. |
| First- and second-year electives | Schedule at least one elective each in 1B and 2A. |
| Fourth-year elective distribution | Schedule at least two electives in 4A and three in 4B. |
| Total academic units | Plan 21.50 units, excluding PD and co-op. |

Keep the communication grade minimum of 60%, academic standing, and approved exceptions available for manual confirmation. Course offerings and complex enrolment conditions also require manual review.

## Drill-through between courses and rules

- In course details and the scheduled course’s **⋯** menu, show the rules it counts toward, rules for which it is an additional eligible choice, and rules that list it as an option. Link each title to the matching rule in the report.
- Show scheduled courses that use or list this course as a direct prerequisite wherever the graph has that information. Link those courses back to their schedule cards.
- In degree requirements, click a scheduled course code to scroll to its term, highlight its card, and focus the course so its details are ready to open. MATH 117 from the core rule is the reference example. An unscheduled course code opens scheduling controls.

## Personal plan and course outcomes

- Provide a **Load Alex’s plan** button in the sample planner. It opens a personal version seeded from the supplied course-plan workbook, including study and co-op placements, the actual term sequence, and noted favorites. Preserve conflicting elective ideas as favorites where the workbook does not give a clear placement.
- Include every fixed course and seminar in Alex’s plan using Alex’s existing term sequence. Add missing seminars and the required PD courses as planned and preserve recorded outcomes. Put PD 19 and PD 20 in the first two work terms, followed by PD 10 and PD 11 in subsequent work terms. [Waterloo Engineering’s PD guidance](https://uwaterloo.ca/engineering/undergraduate-students/co-op-experience/professional-development)
- Treat green workbook cells as passed and other scheduled entries as planned unless an outcome is known. Show **Planned**, **Enrolled**, **Passed**, and **Failed** in the course card’s **⋯** menu so the plan can distinguish actual enrollment from proposed courses.
- Pin passed and failed courses to their recorded term. A user can explicitly change a result to **Planned** to make it editable. Failed courses cannot satisfy prerequisites or degree rules.
- Keep personal edits and favorites in their own browser storage. Restore the imported schedule from the local profile when requested. Store the workbook-derived profile locally outside Git.

## Prototype data and scope

- Start with a sample schedule and a bundled calendar catalog so the mockup can be used locally. Live search and prerequisite lookup from UW Flow were requested where practical. The sample planner uses the public backend when available and falls back to local data. The personal planner uses the local catalog.
- Use curated prerequisite paths for examples such as CS 488. Straightforward course-only prerequisite expressions can produce live graph slots and warnings. Leave more complex text available for manual review.
- The original goal was a simple, mostly static prototype for trying the interaction. Mock data and placeholders are acceptable for exploratory features. Scheduling, prerequisite warnings, the graph’s term pickers, degree validation, and course drill-through are all interactive in this version.

## Keeping this record current

Add new requests and clarifications under the feature they affect, with an example or acceptance detail if one was given. When a later request changes the design, update the current behavior and record the earlier decision where it helps explain the change. Keep personal course histories and grades in the local profile.

Commit and push verified prototype updates to `origin/alex-mockup-1` as the work progresses. Keep the local personal profile outside Git.
