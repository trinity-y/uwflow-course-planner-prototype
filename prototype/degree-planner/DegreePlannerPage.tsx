import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Map,
  PlusCircle,
  Search,
  X,
} from 'react-feather';
import { Helmet } from 'react-helmet';
import Modal from 'react-modal';
import { Link, useHistory, useLocation } from 'react-router-dom';

import { Button } from 'components/ui/button';

import { calendarCatalog, findAcademicCalendar } from './academicCalendars';
import AcademicCalendarSelector from './AcademicCalendarSelector';
import CourseDetailsModal from './CourseDetailsModal';
import CourseGraph from './CourseGraph';
import DegreeEnhancementPicker from './DegreeEnhancementPicker';
import { activeCurriculum } from './degreeEnhancements';
import { generateWishlistPlan } from './generateWishlistPlan';
import MagicWandIcon from './MagicWandIcon';
import {
  canPlace,
  initialPlan,
  Plan,
  PlannerCourse,
  prerequisiteIssues,
  prerequisiteLabel,
  prerequisiteSuggestions,
  termDate,
} from './plannerData';
import PrerequisitePathPlanner from './PrerequisitePathPlanner';
import {
  remainingPaletteSeeds,
  searchPaletteSeeds,
} from './remainingPaletteSeeds';
import TermBoard from './TermBoard';
import useAcademicCalendar from './useAcademicCalendar';
import useDegreeEnhancements from './useDegreeEnhancements';
import useWishlist from './useWishlist';
import WishlistPage from './WishlistPage';

const panel =
  'rounded-xl border border-solid border-light3 bg-white shadow-box';
const field =
  'box-border w-full rounded-lg border border-solid border-light3 bg-white px-md py-sm font-inter text-sm text-dark1 outline-none focus:border-primary focus:ring-2 focus:ring-lecture';

const DegreePlannerPage = () => {
  const { calendar, setCalendar } = useAcademicCalendar();
  const requirements = calendar.requirements;
  const baseGroups = requirements.groups;
  const calendarSequences = requirements.sequences;
  const { wishlist, toggleWishlist, moveWishlist } = useWishlist();
  const { selected: selectedEnhancements, toggle: toggleEnhancement } =
    useDegreeEnhancements();
  const history = useHistory();
  const location = useLocation();
  const isWishlist =
    new URLSearchParams(location.search).get('view') === 'wishlist';
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [sequence, setSequence] = useState(Object.keys(calendarSequences)[0]);
  const [preservedSequence, setPreservedSequence] = useState<{
    name: string;
    terms: string[];
  } | null>(null);
  const sequences = {
    ...calendarSequences,
    ...(preservedSequence
      ? { [preservedSequence.name]: preservedSequence.terms }
      : {}),
  };
  const [selectedTerm, setSelectedTerm] = useState('2A');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState([baseGroups[0]]);
  const [detailCourse, setDetailCourse] = useState<PlannerCourse | null>(null);
  const [picker, setPicker] = useState<PlannerCourse | null>(null);
  const [target, setTarget] = useState('2A');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(false);
  const baseCourses = useMemo(
    () => calendarCatalog(calendar, plan, wishlist),
    [calendar, plan, wishlist],
  );
  const curriculum = useMemo(
    () =>
      activeCurriculum(
        baseCourses,
        baseGroups,
        requirements.choiceRequirements,
        selectedEnhancements,
        plan,
        calendar.enhancements,
      ),
    [
      selectedEnhancements,
      plan,
      baseCourses,
      baseGroups,
      requirements.choiceRequirements,
      calendar.enhancements,
    ],
  );
  const courses = curriculum.courses;
  const groups = curriculum.groups;
  const choiceRequirements = curriculum.choices;
  const activeSequence = sequences[sequence]
    ? sequence
    : Object.keys(sequences)[0];
  const terms = sequences[activeSequence];
  const index = Math.max(0, terms.indexOf(selectedTerm));
  const current = terms[index];
  const required = baseCourses.filter((course) => course.required);
  const planned = required.filter((course) => plan[course.code]);
  const progress = Math.round((planned.length / required.length) * 100);
  const matches = courses.filter((course) =>
    `${course.code} ${course.title}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const remainingSeeds = remainingPaletteSeeds(
    courses,
    plan,
    choiceRequirements,
  );
  const paletteSeeds = searchPaletteSeeds(remainingSeeds, courses, query);
  const issues = prerequisiteIssues(plan, terms, courses);
  const suggestions = picker
    ? prerequisiteSuggestions(picker, target, plan, terms, courses)
    : [];
  const needsPrerequisites =
    suggestions.length > 0 &&
    suggestions.every((option) => option.missing.length > 0);
  const chooseCourse = (course: PlannerCourse) => {
    if (plan[course.code]) {
      setSelectedTerm(plan[course.code]);
      setNotice(`${course.code} is planned in ${plan[course.code]}.`);
      return;
    }
    setTarget(course.fixedTerm ?? course.recommendedTerm ?? current);
    setPicker(course);
  };
  const addCourse = () => {
    if (!picker || canPlace(picker, target, plan, terms)) return;
    setPlan({ ...plan, [picker.code]: target });
    setSelectedTerm(target);
    setNotice(`${picker.code} added to ${target}.`);
    setPicker(null);
    setSearchOpen(false);
  };
  const autoFill = () => {
    const result = generateWishlistPlan(
      [],
      plan,
      terms,
      true,
      courses,
      choiceRequirements,
    );
    setPlan(result.plan);
    setNotice(
      `${
        result.added.length
      } courses added. Elective choices still need review.${
        result.unplaced.length
          ? ` ${result.unplaced.length} could not fit.`
          : ''
      }`,
    );
  };
  return (
    <div
      className="degree-planner min-h-screen bg-light1 font-inter text-dark1"
      data-testid="degree-planner"
    >
      <Helmet>
        <title>Degree Planner · UW Flow</title>
      </Helmet>
      <header className="border-b border-solid border-light3 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-xl px-page py-md mobileDown:gap-md mobileDown:px-md">
          <Link
            to="/"
            className="whitespace-nowrap font-anderson text-2xl font-extrabold text-primaryExtraDark no-underline"
          >
            UW <span className="text-primary">Flow</span>
          </Link>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-md rounded-lg bg-light1 px-md py-sm text-left text-sm text-dark2"
          >
            <Search size={18} />
            <span className="mobileDown:hidden">Search the course catalog</span>
            <span className="hidden mobileDown:inline">Search courses</span>
          </button>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primaryExtraDark text-sm font-semibold text-white"
            aria-label="Demo student profile"
          >
            JD
          </span>
        </div>
      </header>
      <section className="relative overflow-hidden bg-primaryExtraDark text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-40 h-[360px] w-[360px] rounded-full border-[3px] border-solid border-courses"
        >
          <div className="m-xl h-[290px] w-[290px] rounded-full bg-accent" />
        </div>
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-16 h-[150px] w-[150px] rounded-full border-2 border-solid border-courses"
        />
        <div className="relative mx-auto max-w-screen-2xl px-page py-lg mobileDown:px-md">
          <div className="mb-sm flex items-center gap-sm text-xs text-lecture">
            <GitBranch size={14} /> YOUR PATH, YOUR POSSIBILITIES
          </div>
          <h1 className="m-0 font-anderson text-3xl font-extrabold">
            Degree Planner
          </h1>
          <p className="mb-0 mt-sm text-sm">{requirements.program}</p>
          <AcademicCalendarSelector
            value={calendar.id}
            sourceUrl={requirements.sourceUrl}
            onChange={(id) => {
              setCalendar(id);
              setPicker(null);
              setDetailCourse(null);
              setSearchOpen(false);
              setQuery('');
              const next = findAcademicCalendar(id);
              const nextSequence = next.requirements.sequences[activeSequence];
              setPreservedSequence(
                JSON.stringify(nextSequence) === JSON.stringify(terms)
                  ? null
                  : { name: activeSequence, terms },
              );
              const unlisted = Array.from(
                new Set([...Object.keys(plan), ...wishlist]),
              ).filter(
                (code) => !next.courses.some((course) => course.code === code),
              );
              setNotice(
                `Academic calendar updated. Scheduled courses and term dates are kept.${
                  unlisted.length
                    ? ` ${unlisted.length} saved courses are not listed in this calendar; review their requirements.`
                    : ''
                }`,
              );
            }}
          />
        </div>
      </section>
      <div className="border-b border-solid border-light3 bg-white px-page mobileDown:px-md">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-xl py-md">
          <Link
            to="/degree-planner"
            aria-current={!isWishlist ? 'page' : undefined}
            className={`border-b-2 border-solid pb-sm text-sm font-semibold no-underline ${
              !isWishlist
                ? 'border-primary text-primary'
                : 'border-transparent text-dark2'
            }`}
          >
            Degree Planner
          </Link>
          <Link
            to="/degree-planner?view=wishlist"
            aria-current={isWishlist ? 'page' : undefined}
            className={`flex items-center gap-sm border-b-2 border-solid pb-sm text-sm font-semibold no-underline ${
              isWishlist
                ? 'border-primary text-primary'
                : 'border-transparent text-dark2'
            }`}
          >
            Wishlist
            <span className="rounded-full bg-light1 px-sm py-xs text-xs">
              {wishlist.length}
            </span>
          </Link>
          <span className="ml-auto rounded-full bg-light1 px-md py-xs text-xs text-dark2 mobileDown:hidden">
            Interactive prototype
          </span>
        </div>
      </div>
      <main className="mx-auto max-w-screen-2xl px-page py-lg mobileDown:px-md">
        <DegreeEnhancementPicker
          selected={selectedEnhancements}
          plans={calendar.enhancements}
          plan={plan}
          onToggle={(id) => {
            toggleEnhancement(id);
            const enhancement = calendar.enhancements.find(
              (item) => item.id === id,
            );
            if (enhancement && !selectedEnhancements.includes(id)) {
              setExpanded((openGroups) =>
                Array.from(new Set([...openGroups, enhancement.title])),
              );
            }
            setNotice(
              selectedEnhancements.includes(id)
                ? 'Enhancement removed. Scheduled courses are kept.'
                : 'Enhancement added to your plan.',
            );
          }}
        />
        {isWishlist ? (
          <WishlistPage
            wishlist={wishlist}
            catalog={courses}
            choiceRequirements={choiceRequirements}
            plan={plan}
            terms={terms}
            onMove={(code, priorityIndex) => {
              moveWishlist(code, priorityIndex);
              setNotice(`${code} moved to priority ${priorityIndex + 1}.`);
            }}
            onToggleWishlist={toggleWishlist}
            onDetails={setDetailCourse}
            onAdd={chooseCourse}
            onApply={setPlan}
            onViewTerm={(term) => {
              setSelectedTerm(term);
              history.push('/degree-planner');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-lg desktop:grid-cols-[minmax(320px,0.65fr)_minmax(0,1.35fr)]">
            <section
              className={`${panel} flex flex-col p-lg mobileDown:p-md`}
              aria-labelledby="palette-title"
            >
              <div className="flex items-center gap-md">
                <span className="rounded-lg bg-lecture/30 p-sm text-primary">
                  <Map size={24} />
                </span>
                <div>
                  <h2
                    id="palette-title"
                    className="m-0 font-anderson text-xl font-extrabold"
                  >
                    Course Palette
                  </h2>
                </div>
              </div>
              <div className="relative mt-lg">
                <Search
                  size={18}
                  className="absolute left-3 top-3 text-dark3"
                />
                <input
                  aria-label="Search the course palette"
                  className={`${field} pl-10 py-3`}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a course by code or name…"
                />
              </div>
              <div className="mt-md flex-1">
                {!paletteSeeds.length && (
                  <p className="text-sm text-dark2">
                    {remainingSeeds.length
                      ? 'No matching remaining requirements.'
                      : 'All listed requirements are planned!'}
                  </p>
                )}
                {groups.map((group) => {
                  const groupCourses = paletteSeeds.filter(
                    (course) => course.group === group,
                  );
                  const groupChoices = choiceRequirements.filter((choice) =>
                    choice.courses.some((code) =>
                      groupCourses.some((course) => course.code === code),
                    ),
                  );
                  if (!groupCourses.length) return null;
                  const open = expanded.includes(group) || Boolean(query);
                  return (
                    <div
                      key={group}
                      className="border-b border-solid border-light2 py-sm"
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded(
                            expanded.includes(group)
                              ? expanded.filter((item) => item !== group)
                              : [...expanded, group],
                          )
                        }
                        className="flex w-full items-center gap-sm bg-transparent py-sm text-left text-sm font-semibold text-dark1"
                      >
                        {open ? (
                          <ChevronDown size={17} />
                        ) : (
                          <ChevronRight size={17} />
                        )}
                        {group}
                        <span className="ml-auto rounded-full bg-light1 px-sm py-xs text-xs font-regular text-dark2">
                          {groupChoices.length ? (
                            <>
                              {
                                groupChoices.filter(
                                  (choice) =>
                                    choice.courses.filter((code) => plan[code])
                                      .length >= choice.count,
                                ).length
                              }
                              /{groupChoices.length} choices planned
                            </>
                          ) : (
                            <>
                              {
                                courses.filter(
                                  (course) =>
                                    course.group === group && plan[course.code],
                                ).length
                              }
                              /
                              {
                                courses.filter(
                                  (course) => course.group === group,
                                ).length
                              }{' '}
                              planned
                            </>
                          )}
                        </span>
                      </button>
                      {open && (
                        <CourseGraph
                          seeds={groupCourses}
                          catalog={courses}
                          plan={plan}
                          onChoose={setDetailCourse}
                          onAdd={chooseCourse}
                          wishlist={wishlist}
                          onToggleWishlist={(code) => {
                            toggleWishlist(code);
                            setNotice(
                              `${code} ${
                                wishlist.includes(code)
                                  ? 'removed from'
                                  : 'added to'
                              } your wishlist.`,
                            );
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                variant="subtle"
                onClick={autoFill}
                className="mt-lg w-full gap-sm border border-solid border-primary/30 bg-lecture/30 text-primary"
              >
                <MagicWandIcon /> Auto-fill remaining requirements
              </Button>
              <div className="mt-md border-t border-solid border-light3 pt-md flex flex-wrap items-center gap-md text-xs text-dark2">
                <span className="flex items-center gap-xs">
                  <span className="h-3 w-3 rounded border-2 border-solid border-primary" />{' '}
                  Required course
                </span>
                <span className="flex items-center gap-xs">
                  <span className="h-3 w-3 rounded border border-solid border-light3 bg-white" />{' '}
                  Other course / choice
                </span>
                <span className="flex items-center gap-xs">
                  <span className="w-md border-t border-solid border-dark3" />
                  and
                </span>
                <span className="flex items-center gap-xs">
                  <span className="w-md border-t border-dashed border-dark3" />
                  or
                </span>
              </div>
              <p
                className="mb-0 mt-sm text-xs text-dark3"
                title={requirements.prerequisiteScope}
              >
                SE curriculum paths · Full eligibility rules in course details
              </p>
            </section>
            <section
              className={`${panel} flex flex-col p-lg mobileDown:p-md`}
              aria-labelledby="preview-title"
            >
              <div className="flex flex-wrap items-center gap-md">
                <span className="rounded-lg bg-lecture/30 p-sm text-primary">
                  <Calendar size={24} />
                </span>
                <div>
                  <h2
                    id="preview-title"
                    className="m-0 font-anderson text-xl font-extrabold"
                  >
                    Degree Previewer
                  </h2>
                </div>
              </div>
              <div className="mt-lg flex items-center justify-between gap-md">
                <label
                  htmlFor="sequence"
                  className="text-xs font-semibold text-dark2"
                >
                  CO-OP SEQUENCE
                </label>
                <select
                  id="sequence"
                  value={activeSequence}
                  className={`${field} w-auto`}
                  onChange={(event) => {
                    const nextSequence = event.target.value;
                    const nextTerms = sequences[nextSequence];
                    const nextPlan = Object.fromEntries(
                      Object.entries(plan).filter(([, term]) =>
                        nextTerms.includes(term),
                      ),
                    );
                    setPlan(nextPlan);
                    setSelectedTerm(
                      nextTerms.includes(current) ? current : '1A',
                    );
                    setSequence(nextSequence);
                    setPreservedSequence(null);
                    setNotice(
                      'Sequence updated. Academic courses keep their terms; courses from unavailable work terms return to the palette.',
                    );
                  }}
                >
                  {Object.keys(sequences).map((item) => (
                    <option key={item} value={item}>
                      {item}
                      {preservedSequence?.name === item
                        ? ' (existing schedule)'
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
              <TermBoard
                catalog={courses}
                capacities={requirements.academicTermCapacity}
                terms={terms}
                plan={plan}
                selectedTerm={current}
                issues={issues}
                onSelect={setSelectedTerm}
                onAdd={(term) => {
                  setSelectedTerm(term);
                  setQuery('');
                  setSearchOpen(true);
                }}
                onRemove={(code) => {
                  const next = { ...plan };
                  delete next[code];
                  setPlan(next);
                  setNotice(`${code} removed.`);
                }}
              />
              <div className="mt-auto pt-xl">
                <div className="border-t border-solid border-light3 pt-lg">
                  <div className="mb-md flex items-center justify-between">
                    <h3 className="m-0 text-sm font-semibold">
                      Requirements progress
                    </h3>
                    <span className="text-xl font-semibold">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Required courses planned"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2 overflow-hidden rounded-full bg-light2"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-md flex items-center justify-between">
                    <span className="text-xs text-dark2">
                      {planned.length} of {required.length} core / PD courses
                      planned
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetails(!details)}
                      className="flex items-center gap-xs bg-transparent text-xs font-semibold text-primary"
                    >
                      {details ? 'Hide details' : 'View details'}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                  {issues.length > 0 && (
                    <div
                      className="mt-md rounded-lg bg-accent/10 p-sm"
                      aria-label="Prerequisite warnings"
                    >
                      {issues.map((course) => (
                        <button
                          type="button"
                          key={course.code}
                          onClick={() => setSelectedTerm(plan[course.code])}
                          className="flex w-full items-start gap-sm bg-transparent py-xs text-left text-xs leading-relaxed text-dark2 hover:text-primary"
                        >
                          <AlertTriangle
                            size={14}
                            className="mt-xs shrink-0 text-courses"
                          />
                          <span>
                            <strong>{course.code}</strong> in{' '}
                            {plan[course.code]} (
                            {termDate(terms.indexOf(plan[course.code]))}) is
                            missing prerequisites.
                          </span>
                          <ArrowRight
                            size={14}
                            className="ml-auto mt-xs shrink-0"
                          />
                        </button>
                      ))}
                      <p className="mb-0 mt-xs text-xs text-dark2">
                        Your courses stay in the plan. You can fill the gaps
                        later.
                      </p>
                    </div>
                  )}
                  {details && (
                    <ul className="mt-md pl-md text-xs leading-loose text-dark2">
                      <li>
                        Progress counts named core / PD courses. Choices and
                        elective rules are listed in the calendar.
                      </li>
                      <li>
                        <a
                          href={requirements.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Full calendar requirements
                        </a>
                      </li>
                      {requirements.choiceRequirements.map((choice) => (
                        <li key={choice.id}>
                          {choice.term}: choose {choice.count} —{' '}
                          {choice.courses.join(' or ')}
                        </li>
                      ))}
                      {requirements.requirementSummary.map((summary) => (
                        <li key={summary}>{summary}</li>
                      ))}
                      {required
                        .filter((course) => !plan[course.code])
                        .map((course) => (
                          <li key={course.code}>
                            {course.code} — still to plan
                          </li>
                        ))}
                      {planned.length === required.length && (
                        <li>All named core / PD courses are in your plan.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
        <p
          role="status"
          className="my-md min-h-[20px] text-center text-sm text-primaryDark"
        >
          {notice}
        </p>
        <p className="text-center text-xs leading-relaxed text-dark2">
          Made for the journey, not just the destination.
          <br />
          <span className="text-dark3">
            {calendar.label} calendar · Plans stay in this session · Confirm
            requirements with your academic advisor
          </span>
        </p>
      </main>
      {detailCourse && (
        <CourseDetailsModal
          key={detailCourse.code}
          code={detailCourse.code}
          catalog={courses}
          plannedTerm={plan[detailCourse.code]}
          onClose={() => setDetailCourse(null)}
          onPlan={() => {
            const course = detailCourse;
            setDetailCourse(null);
            chooseCourse(course);
          }}
        />
      )}
      <Modal
        isOpen={Boolean(picker) || searchOpen}
        onRequestClose={() => {
          setPicker(null);
          setSearchOpen(false);
        }}
        contentLabel={picker ? `Plan ${picker.code}` : 'Find a course'}
        className={`degree-planner-dialog absolute left-1/2 top-1/2 max-h-[85vh] w-[calc(100%_-_32px)] ${
          picker && needsPrerequisites ? 'max-w-4xl' : 'max-w-lg'
        } -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl bg-white p-lg font-inter text-dark1 shadow-dropdown outline-none`}
        overlayClassName="fixed inset-0 z-modal bg-primaryExtraDark/60"
      >
        <div className="mb-lg flex items-center justify-between">
          <h2 className="m-0 text-xl font-semibold">
            {picker ? `Plan ${picker.code}` : 'Find your next course'}
          </h2>
          <Button
            variant="subtle"
            size="icon"
            aria-label="Close dialog"
            onClick={() => {
              setPicker(null);
              setSearchOpen(false);
            }}
          >
            <X size={18} />
          </Button>
        </div>
        {picker ? (
          <>
            <p className="text-sm text-dark2">{picker.title}</p>
            {picker.prerequisites.length > 0 && !needsPrerequisites && (
              <p className="my-md text-xs text-dark2">
                Prerequisites: {prerequisiteLabel(picker)}
              </p>
            )}
            <label
              className="mt-lg block text-sm font-semibold"
              htmlFor="target-term"
            >
              Choose a term
            </label>
            <select
              id="target-term"
              value={target}
              onChange={(event) => {
                setTarget(event.target.value);
              }}
              className={`${field} my-md`}
            >
              {terms.map((term, termIndex) => (
                <option
                  key={term}
                  value={term}
                  disabled={Boolean(canPlace(picker, term, plan, terms))}
                >
                  {term} · {termDate(termIndex)}
                  {canPlace(picker, term, plan, terms)
                    ? ` — ${canPlace(picker, term, plan, terms)}`
                    : ''}
                </option>
              ))}
            </select>
            {canPlace(picker, target, plan, terms) && (
              <p role="status" className="mb-md text-sm text-darkRed">
                {canPlace(picker, target, plan, terms)}
              </p>
            )}
            {needsPrerequisites ? (
              <>
                <div className="flex items-start gap-sm rounded-lg bg-accent/10 p-md">
                  <AlertTriangle size={18} className="shrink-0 text-courses" />
                  <div>
                    <p className="m-0 text-sm font-semibold">
                      You don’t have the prerequisites for this course
                    </p>
                    <p className="mb-0 mt-xs text-xs text-dark2">
                      If you want, you can auto-add the pre-requisites now.
                    </p>
                  </div>
                </div>
                <PrerequisitePathPlanner
                  key={picker.code}
                  course={picker}
                  catalog={courses}
                  target={target}
                  plan={plan}
                  terms={terms}
                  onAddAnyway={addCourse}
                  onApply={(next) => {
                    setPlan(next);
                    setSelectedTerm(target);
                    setNotice(
                      `${picker.code} and its selected prerequisites added to your plan.`,
                    );
                    setPicker(null);
                    setSearchOpen(false);
                  }}
                />
              </>
            ) : (
              <Button
                variant="filter"
                className="w-full"
                disabled={Boolean(canPlace(picker, target, plan, terms))}
                onClick={addCourse}
              >
                Add to {target}
                <PlusCircle size={16} />
              </Button>
            )}
          </>
        ) : (
          <>
            <input
              autoFocus
              aria-label="Search all sample courses"
              placeholder="Search by code or course name…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${field} mb-md`}
            />
            <p className="mb-md text-xs text-dark2">
              Search the sample course catalog · {matches.length} results
            </p>
            {matches.map((course) => (
              <button
                key={course.code}
                type="button"
                onClick={() => {
                  if (plan[course.code]) setSearchOpen(false);
                  chooseCourse(course);
                }}
                className="flex w-full items-center justify-between gap-md border-b border-solid border-light2 bg-white py-md text-left"
              >
                <span>
                  <span className="text-sm font-semibold text-primary">
                    {course.code}
                  </span>
                  <span className="mt-xs block text-xs text-dark2">
                    {course.title}
                  </span>
                </span>
                {plan[course.code] ? (
                  <span className="text-xs text-primary">
                    {plan[course.code]}
                  </span>
                ) : (
                  <PlusCircle size={16} />
                )}
              </button>
            ))}
            {matches.length === 0 && (
              <p className="py-lg text-sm text-dark2">
                No courses found. Try “CS” or “calculus”.
              </p>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default DegreePlannerPage;
