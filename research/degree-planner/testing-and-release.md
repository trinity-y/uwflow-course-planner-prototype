# Scenarios, release plan, and tests

[Study overview](README.md) · [Evidence](research.md) · [Experience](experience.md) · [Data and coverage](data-and-coverage.md)

## Three exercises I ran

These are small exhaustive checks of product assumptions. I enumerated the permitted combinations against the stated rules. They exercise what a correct explanation should say. No participant used a prototype, and no production rule engine or Waterloo student record was involved.

### 1. Losing a favourite course can leave graduation intact

**Setup.** One 0.5-unit opening remains in winter and one in fall. Spring is a protected work term. The student needs one Foundation and one Capstone. Methods or Stories can fill Foundation in winter. Studio or Seminar can fill Capstone in fall. Studio requires Methods in an earlier term. Seminar has no such prerequisite. These are fictional courses. The two terms, offerings, capacities, requirements and prerequisites are fixed for this exercise.

| Student’s decision | Valid winter/fall pairs | What Flow should say |
| --- | --- | --- |
| Leave both terms open | 3 · Methods/Studio, Methods/Seminar, Stories/Seminar | Both foundations work. Methods preserves an extra capstone option. |
| Keep Studio in fall | 1 · Methods/Studio | Methods is the winter decision needed to keep Studio on this timetable. |
| Keep Stories in winter | 1 · Stories/Seminar | Seminar still completes the remaining requirements by fall. |
| Keep Stories and Studio | 0 | The conflict is between two choices and one prerequisite. Offer changing winter to Methods or fall to Seminar. Never silently relax either protected choice. |
| Keep both and request a prerequisite waiver | 0 under the ordinary rules | Show the pending request and the alternative outcome if granted. |
| Keep both and model a granted Studio entry waiver | 1 · Stories/Studio under that decision | Stories supplies Foundation. The waiver permits entry to Studio and awards no Methods credit. |
| Studio’s offering is cancelled | 2 · Methods/Seminar, Stories/Seminar | A route to the degree remains through Seminar. Keep the student’s intended Studio visible if they still want it. |
| Studio is cancelled and the student insists on it | 0 within this horizon | “No route to Studio in these terms.” A future offering beyond this horizon is unknown. |

**What changed in my design.** The alert should name the thing at risk. “Studio would close” is materially different from “You would graduate late.” The student who values Stories gets a valid plan. The student who values Studio gets an actionable deadline. A generic warning or a single automatic “best plan” would give one of them the wrong impression.

### 2. Adding a course can change where an earlier course belongs

**Setup.** Waterloo English explicitly says ENGL 485 can fill Romantic to Modern **or** Special Topics within the major. I paired that real example with a hypothetical second earned course eligible only for Romantic to Modern. Each course can be used once between these two groups. [English advising FAQ](https://uwaterloo.ca/english/faq-undergrad)

| Available evidence | Enumeration result | What Flow should show |
| --- | --- | --- |
| ENGL 485 alone | Two legal assignments, one requirement satisfied in either case. | Show the current use and the other possible use. Neither view should display two earned courses. |
| ENGL 485 plus the hypothetical single-use course | Only one assignment fills both groups. The second course fills Romantic to Modern and ENGL 485 fills Special Topics. | Reallocate automatically if the previous allocation was only Flow’s choice. Explain exactly what moved. If the student had explicitly pinned an allocation for a scenario, show the trade-off and offer to release it. |

This matters because a student can enter two perfectly acceptable courses and still see an artificial deficiency if the checker greedily fills the first eligible box. A ReqCheck user reported a similar pattern with overlapping CS groups. The exact Waterloo English example and the public bug report are independent reasons to keep this case in the release suite. [ReqCheck user report](https://www.reddit.com/r/uwaterloo/comments/1kgajfh/check_which_degree_requirements_you_are_missing/)

### 3. Knowing where there is room can be as valuable as knowing what is missing

**Setup.** A fictional student has four remaining 0.5-unit places and needs one course for the major and one for the minor. Joint Seminar is eligible for either. Methods is eligible only for the major, Policy only for the minor. Three other distinct courses represent the student’s own interests. Assume all six are otherwise eligible, offered, and compatible. I enumerated every four-course selection and every allowed assignment of the two requirements.

| Condition | Most interest courses that fit | Example meeting both requirements and earning exactly 2.0 units |
| --- | --- | --- |
| The program expressly allows Joint Seminar to serve both requirements | 3 | Joint Seminar and all three interest courses. |
| The student would prefer to skip Joint Seminar | 2 | Methods, Policy, and two interest courses. |
| Joint Seminar may serve only one of the two requirements | 2 | Joint Seminar for the major, Policy for the minor, and two interest courses. |

A student who asks **“Do I have room to take this just because I want to?”** deserves an affirmative explanation when the evidence permits one. The answer here is “Two places either way. Choosing the shared seminar makes room for a third.” For a real degree, publish such a number only within a named scope covering total units, legal overlap, level, residency, load and term constraints as applicable. Otherwise show the consequence of adding one named course. This idea came from an Arts student asking what double-counting buys them in practice. [Arts breadth and elective room discussion](https://www.reddit.com/r/uwaterloo/comments/159rgwd/double_counting_courses/)

## Walkthroughs the prototype must survive

These are desk walkthroughs with expected behaviour, ready to turn into acceptance fixtures or student tasks.

| Starting situation | Action | Expected behaviour or failure signal |
| --- | --- | --- |
| First-year Public Health student, no history added | Start with a sourced sequence and leave both first-term electives open. | Named core and choices appear. The student can identify the first actual decision and distinguish the plan from enrolment. No earned progress appears on the basis of a template. |
| Third-year student arrives with a spreadsheet | Paste six courses, leave one unplaced, and move another without suggestions. | Preserve the entered work, flag ambiguous codes individually, and recompute only affected checks in view. Repeated attempts stay distinguishable from accidental duplicate imports. |
| A student adds a minor to an existing plan | Preview the minor, including overlap with the major, then discard. | Show new work, any redistributed courses, remaining unique units, and unreviewed combined rules. The saved plan is unchanged after discard. An infeasible credential combination is identified at selection when known. |
| Student fails a prerequisite and plans a retake | Record the failed attempt, then add its retake after the intended dependent course. | Keep both attempts. The earned record and the current projection explain the missing sequence. A retake elsewhere in the plan cannot retroactively qualify the earlier course. |
| Exchange student with a pending course assessment | Compare a generic credit outcome with a named equivalent, then record the eventual award. | Show which outcomes fill breadth, unique units, and a named requisite separately. Replacing the pending course with awarded credit cannot create a second copy of the units. |
| A department grants permission to enter a course | Apply it to the approved term, then move the course to another term. | Term-specific permission ceases to resolve that check in the other term. The record of the original permission remains. |
| Student adds a leave or lowers a term load | Move next winter’s courses into later terms and protect the new maximum load. | The saved work survives. The planner explains immediate conflicts and possible repair options. A student can compare a later finish without a judgement about being behind. |
| A cohort rule or course identity changes | Reopen an older plan after a new calendar edition and a course rename. | Preserve its applicable edition and historical attempt. Expose any applicable correction separately. No duplicated credit and no unexplained switch to the newest rules. |
| A screen-reader user explores prerequisites on a phone | Find the missing prerequisite and move the course to a later term without dragging. | The list exposes AND/OR relationships, term, state, action and result in reading order. Changes announce the affected item and can be undone. |

## MVP, pilot, and public promise

| Stage | What students can actually do | What advances it |
| --- | --- | --- |
| **First prototype** | Start from a course or a requirement. Add, move, shortlist, reserve a slot, and inspect the linked progress change. Use one sequence-heavy example and one elective-heavy example. | Students using their usual planning style can make a correct decision faster or with fewer errors than using their current checklist or sheet. Include a task for which their current method might win. |
| **Usable pilot** | Save or export a manual plan, bulk-enter previous courses, inspect core progress for explicit program/year combinations, and find courses for one opening. Include a sourced starter sequence where one is available and an advisor summary that omits grades by default. | At least one reviewed program and edition from **each of Waterloo’s six faculties**. Include a major/minor combination, a transfer, a reduced load, and a missing-data case. Display each program’s coverage before import. |
| **Campus-wide release** | Students can plan manually across faculties. Every program/cohort advertised for degree progress has at least one meaningful reviewed core group and named coverage gaps. Published sequences and direct checks can guide choices without a full-degree solver. | Maintain an explicit inventory of the intended undergraduate scope and public support matrix. If the promise is “every undergraduate can check a core requirement,” coverage of every in-scope degree/cohort is the gate. One example per faculty only establishes a pilot. |
| **Later assistance** | Work backwards to a desired course, offer small repairs, save alternatives, and optionally draft remaining terms under protected constraints. Later, consider consented community shortlists. | Evidence that the feature improves a real decision over manual checking. Long-range generation waits until hard constraints, partial acceptance, offering uncertainty and credible no-solution explanations work. |

I would favour entry-point integration, transparent credit allocation, and a fast manual workflow over a chatbot, a campus-wide popularity ranking, or a detailed section-level timetable in the first release. A weekly timetable becomes valuable close to enrolment. The degree planner’s distinctive job is to help people choose which courses belong in that timetable and when.

## Test the value with people

**Round one.** Recruit 12 students, aiming for two per faculty and a mix of first-year and upper-year students. Across the group include someone with a combined credential, a return or transfer, an exchange or Laurier course, someone with a reduced load, a student who enjoys spreadsheets, and someone who normally decides one term at a time. Include mobile and keyboard or screen-reader users. Conduct a separate review with three advisors or program staff from structurally different programs. This is a proposed qualitative sample.

1. **Begin with their own last decision.** “Show me how you planned your last course selection. What did you check twice? Where did you leave yourself a note?” Let them use a blank or anonymized record. Capture artifacts and decisions with consent. Ask what makes their current method worth keeping.
2. **Counterbalance two comparable tasks.** Give each student an equivalent decision once with their usual method and once with a low-fidelity planner. Alternate the order and task variants. One task starts from a desired course, the other from a missing requirement. Measure correct answers, time to first useful answer, and where they seek outside help.
3. **Test the labels by asking for a prediction.** Show an earned course, a future course, an open slot and a pending transfer. Ask which requirements would be complete *today*, which could be covered *by fall*, and what depends on a decision. A person who likes the screen but misreads the answer has found a design failure.
4. **Break their plan.** A course disappears or a protected term changes. Ask them to retain a favourite, compare the alternatives and recover the original plan. Observe whether they can explain what changed and perform all of it manually. Repeat once with suggestions to see whether assistance adds value.
5. **Give an advisor the handoff cold.** Ask them to identify the exact question, governing calendar, student-reported facts and missing evidence from the summary. Ask what they would have to reconstruct before advising. If it creates more work than the student’s current email or sheet, revise it.
6. **Follow up at the next real course-selection window.** Did the plan survive a change? Did the student use it to choose or check a course? Which claims did they independently confirm? Students who return only once a term can be successful users.

**Proposed decision gates.** Use the 12 sessions to find and fix failures before any larger study. Target at least 10 of 12 correctly distinguishing earned from planned and independently completing the add/move/explain task. Investigate every false conclusion about satisfying a graduation requirement. A confirmed false “met” on a reviewed launch case blocks that rule from public coverage until fixed. Look separately at manual-only users, upper-year onboarding, and faculties with less data. Aggregate success can hide an unusable experience for one group.

**After launch.** Measure successful term decisions in task studies, plan reuse at the next relevant selection period, and discrepancy reports per reviewed requirement group. Track how many supported students get a source-backed answer, which assumptions remain unresolved, and how often an accepted proposal breaks a protected choice. Count manual sessions as successful when they reach the same decision. A high share of users accepting the first suggestion could mean convenience, misplaced trust, or a lack of visible alternatives.

## Decisions for the team

| Decision | My starting position | What would change it |
| --- | --- | --- |
| Which first screen deserves the most design effort? | Return students to the object they were working on. After a record import, show outstanding requirements. After a course-page entry, show that course’s fit. | Usability tests show the same inexpensive landing consistently beats the contextual versions across both tasks. |
| What counts as a good default? | A dated faculty sequence where available, protected constraints respected, genuine choices left open. Give flexible programs an outline plus concrete suggestions on request. | Students starting from a blank slate consistently prefer named elective examples and can tell that those examples are replaceable. |
| Where should partial coverage stop? | Claim only the reviewed rule results. Show unknowns at the point of decision. Publish a degree-level completion conclusion only when coverage and evidence support the full scope. | Advisor review identifies a narrower, equally understandable status that still helps students act. |
| Is automatic transcript intake essential at launch? | Bulk paste and manual correction are essential for upper-year adoption. Make a polished transcript parser a priority if this route still costs students several minutes before first value. | Timed onboarding shows returning students can reliably get a verified useful answer with less input, or transcript formats consistently defeat the fallback. |
| Are full-plan alternatives necessary? | Start with an undoable change preview and a saved primary plan. Keep named alternatives for consequential branches such as an exchange term or a new minor. | Students repeatedly duplicate plans outside Flow because a transient preview cannot hold a real decision across days. |
| What deserves advisor time? | Unresolved personal interpretations and disputed high-impact rules. A clear student-controlled summary should suffice for handoff. | Advisors explicitly want a shared workflow, and the team can staff corrections, access controls and ownership over time. |

The first experiment I would commission is simple. Give a student one attractive fall course, two valid winter choices, and a protected co-op term. Ask **“What would you choose, what are you giving up, and what can you still decide later?”** That one task tests whether visualization, progress tracking, and automation actually work together.
