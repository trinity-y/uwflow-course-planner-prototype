import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Heart,
  Menu,
  PlusCircle,
  Search,
  X,
} from 'react-feather';

import { Button } from './components/button';
import ActionButton from './ActionButton';
import { PlannerChoiceRequirement } from './degreeEnhancements';
import {
  generateWishlistPlan,
  WishlistGeneration,
} from './generateWishlistPlan';
import MagicWandIcon from './MagicWandIcon';
import {
  courses as defaultCourses,
  Plan,
  PlannerCourse,
  prerequisiteIssues,
  termDate,
} from './plannerData';
import { sampleCourseDetails } from './sampleCourseClient';
import {
  futureCourseOfferings,
  hasWishlistPrerequisiteGap,
} from './wishlistCourseInfo';

interface Props {
  wishlist: string[];
  catalog?: PlannerCourse[];
  choiceRequirements?: PlannerChoiceRequirement[];
  plan: Plan;
  terms: string[];
  onMove: (code: string, index: number) => void;
  onToggleWishlist: (code: string) => void;
  onDetails: (course: PlannerCourse) => void;
  onAdd: (course: PlannerCourse) => void;
  onApply: (plan: Plan) => void;
  onViewTerm: (term: string) => void;
}

const WishlistPage = ({
  wishlist,
  catalog = defaultCourses,
  choiceRequirements,
  plan,
  terms,
  onMove,
  onToggleWishlist,
  onDetails,
  onAdd,
  onApply,
  onViewTerm,
}: Props) => {
  const [search, setSearch] = useState('');
  const searchQuery = search.replace(/\s/g, '').toLowerCase();
  const matches = catalog.filter((course) =>
    `${course.code} ${course.title}`
      .replace(/\s/g, '')
      .toLowerCase()
      .includes(searchQuery),
  );
  const [includeRequired, setIncludeRequired] = useState(true);
  const [dragged, setDragged] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [result, setResult] = useState<WishlistGeneration | null>(null);
  const pending = wishlist.filter((code) => !plan[code]);
  const generate = () => {
    const generated = generateWishlistPlan(
      wishlist,
      plan,
      terms,
      includeRequired,
      catalog,
      choiceRequirements,
    );
    onApply(generated.plan);
    setResult(generated);
  };
  const issues = prerequisiteIssues(plan, terms, catalog);
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)] gap-lg tabletDown:grid-cols-1">
      <section
        className="min-w-0 rounded-xl border border-solid border-light3 bg-white p-lg mobileDown:p-md"
        aria-labelledby="wishlist-heading"
      >
        <div className="mb-lg flex items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <Heart size={22} className="text-primary" />
            <h2 id="wishlist-heading" className="m-0 text-xl font-semibold">
              Wishlist
            </h2>
            <span className="rounded-full bg-light1 px-sm py-xs text-xs text-dark2">
              {wishlist.length}
            </span>
          </div>
        </div>
        <div className="relative mb-lg">
          <Search size={17} className="absolute left-3 top-3 text-dark3" />
          <input
            aria-label="Search all courses for wishlist"
            placeholder="Search courses by code or name…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="box-border w-full rounded-lg border border-solid border-light3 bg-white py-3 pl-10 pr-10 font-inter text-sm text-dark1 focus:border-primary"
          />
          {search && (
            <ActionButton
              type="button"
              label="Clear course search"
              onClick={() => setSearch('')}
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-transparent text-dark2"
            >
              <X size={15} />
            </ActionButton>
          )}
        </div>
        {searchQuery && (
          <section
            aria-label="Course search results"
            className="mb-lg rounded-lg border border-solid border-light3"
          >
            <div className="border-b border-solid border-light3 bg-light1 px-md py-sm text-xs text-dark2">
              {matches.length} matches · Sample catalog
            </div>
            <div className="max-h-64 overflow-y-auto">
              {matches.map((course) => (
                <div
                  key={course.code}
                  className="flex items-center gap-sm border-b border-solid border-light2 px-md py-sm"
                >
                  <button
                    type="button"
                    onClick={() => onDetails(course)}
                    className="min-w-0 flex-1 bg-transparent text-left"
                  >
                    <span className="text-sm font-semibold text-primary">
                      {course.code}
                    </span>
                    <span className="mt-xs block truncate text-xs text-dark2">
                      {course.title}
                    </span>
                  </button>
                  <ActionButton
                    type="button"
                    label={`${
                      wishlist.includes(course.code) ? 'Remove' : 'Add'
                    } ${course.code} ${
                      wishlist.includes(course.code) ? 'from' : 'to'
                    } wishlist`}
                    aria-pressed={wishlist.includes(course.code)}
                    onClick={() => onToggleWishlist(course.code)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded bg-transparent hover:bg-light1 ${
                      wishlist.includes(course.code)
                        ? 'text-primary'
                        : 'text-dark3'
                    }`}
                  >
                    <Heart
                      size={17}
                      fill={
                        wishlist.includes(course.code) ? 'currentColor' : 'none'
                      }
                    />
                  </ActionButton>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="p-md text-sm text-dark2">
                  No matching courses. Try another code or name.
                </p>
              )}
            </div>
          </section>
        )}
        {wishlist.length === 0 ? (
          <div className="py-xl text-center text-dark2">
            <Heart size={32} className="mx-auto mb-md text-dark3" />
            <p className="text-sm">Your next possibilities start here.</p>
            <p className="mb-lg text-xs">
              Search above and heart a course to save it here.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-md text-xs text-dark2">
              Drag to reorder, or use the arrows. Higher courses get priority.
            </p>
            <ol
              className="m-0 grid min-w-0 grid-cols-1 list-none gap-sm p-0"
              aria-label="Wishlist priority order"
            >
              {wishlist.map((code, index) => {
                const course = catalog.find((item) => item.code === code);
                const offerings = futureCourseOfferings(
                  sampleCourseDetails[code.replace(/\s/g, '').toLowerCase()]
                    ?.course[0]?.sections,
                );
                return (
                  <li
                    key={code}
                    draggable
                    onDragStart={(event) => {
                      setDragged(code);
                      event.dataTransfer.setData('text/plain', code);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragged(null);
                      setDropTarget(null);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      setDropTarget(code);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const source =
                        dragged ?? event.dataTransfer.getData('text/plain');
                      if (wishlist.includes(source)) onMove(source, index);
                      setDragged(null);
                      setDropTarget(null);
                    }}
                    className={`flex w-full min-w-0 items-center gap-sm rounded-lg border border-solid p-md mobileDown:p-sm ${
                      dropTarget === code && dragged !== code
                        ? 'border-primary bg-lecture/20'
                        : 'border-light3 bg-white'
                    } ${dragged === code ? 'opacity-50' : ''}`}
                  >
                    <Menu
                      size={16}
                      className="shrink-0 cursor-grab text-dark3"
                      aria-hidden="true"
                    />
                    <span className="w-5 shrink-0 text-center text-xs text-dark3">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      disabled={!course}
                      onClick={() => course && onDetails(course)}
                      className="min-w-0 flex-1 bg-transparent p-0 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-sm">
                        <span className="text-sm font-semibold text-primary">
                          {code}
                        </span>
                        {plan[code] && (
                          <span
                            className="flex items-center gap-xs rounded bg-lecture/30 px-xs py-xs text-xs text-primaryDark"
                            aria-label={`Planned in ${plan[code]}`}
                          >
                            <Check size={12} />
                            {plan[code]}
                          </span>
                        )}
                      </span>
                      <span className="mt-xs block truncate text-xs text-dark2">
                        {course?.title ??
                          'Course unavailable in the sample catalog'}
                      </span>
                      <span className="mt-xs block text-xs leading-relaxed text-dark3">
                        {offerings === null
                          ? 'Offerings unknown'
                          : offerings.length
                          ? `Sample offerings: ${offerings.join(' · ')}`
                          : 'Future offerings not listed'}
                      </span>
                      {course &&
                        hasWishlistPrerequisiteGap(
                          course,
                          plan,
                          terms,
                          catalog,
                        ) && (
                          <span className="mt-sm flex items-center gap-xs text-xs text-dark2">
                            <AlertTriangle
                              size={13}
                              className="shrink-0 text-courses"
                            />
                            Missing prerequisites
                          </span>
                        )}
                    </button>
                    <div className="flex shrink-0 flex-col">
                      <ActionButton
                        type="button"
                        label={`Move ${code} up`}
                        disabled={index === 0}
                        onClick={() => onMove(code, index - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-dark2 hover:bg-light1 disabled:opacity-30"
                      >
                        <ArrowUp size={14} />
                      </ActionButton>
                      <ActionButton
                        type="button"
                        label={`Move ${code} down`}
                        disabled={index === wishlist.length - 1}
                        onClick={() => onMove(code, index + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-dark2 hover:bg-light1 disabled:opacity-30"
                      >
                        <ArrowDown size={14} />
                      </ActionButton>
                    </div>
                    <ActionButton
                      type="button"
                      label={`Remove ${code} from wishlist`}
                      onClick={() => onToggleWishlist(code)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-transparent text-primary hover:bg-light1"
                    >
                      <Heart size={16} fill="currentColor" />
                    </ActionButton>
                    {!plan[code] && (
                      <ActionButton
                        type="button"
                        label={`Plan ${code}`}
                        disabled={!course}
                        onClick={() => course && onAdd(course)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-transparent text-primary hover:bg-light1"
                      >
                        <PlusCircle size={16} />
                      </ActionButton>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
      <aside
        className="min-w-0 self-start rounded-xl border border-solid border-light3 bg-white p-lg mobileDown:p-md"
        aria-label="Generate from wishlist"
      >
        <h2 className="m-0 text-lg font-semibold">
          Make room for your wishlist
        </h2>
        <p className="mb-lg mt-sm text-sm leading-relaxed text-dark2">
          Generate a plan using your priority order. Existing placements stay
          put.
        </p>
        <div className="mb-sm flex justify-between gap-sm text-sm">
          <span className="text-dark2">Still to plan</span>
          <strong>{pending.length} courses</strong>
        </div>
        <p
          aria-label="Unscheduled wishlist courses"
          className="mb-lg mt-0 whitespace-pre-line text-xs leading-relaxed text-dark2"
        >
          {pending.length
            ? pending.join('\n')
            : wishlist.length
            ? 'All courses on your wishlist are planned!'
            : 'Your wishlist is empty.'}
        </p>
        <label className="mb-lg flex items-start gap-sm text-xs leading-relaxed text-dark2">
          <input
            type="checkbox"
            checked={includeRequired}
            onChange={(event) => setIncludeRequired(event.target.checked)}
            className="mt-xs"
          />
          Include remaining degree requirements
        </label>
        <Button
          variant="filter"
          className="w-full"
          disabled={!wishlist.length}
          onClick={generate}
        >
          <MagicWandIcon />
          Generate schedule
        </Button>
        <p className="mb-0 mt-sm text-xs leading-relaxed text-dark3">
          Prerequisites included · PD courses can use work terms
        </p>
        {result && (
          <div className="mt-lg border-t border-solid border-light3 pt-lg">
            <p
              role="status"
              className="mb-md mt-0 text-sm font-semibold text-primaryDark"
            >
              {result.added.length
                ? `${result.added.length} courses added to your plan`
                : 'No new courses added'}
            </p>
            <div className="grid gap-sm">
              {terms
                .filter((term) =>
                  result.added.some((code) => result.plan[code] === term),
                )
                .map((term) => (
                  <button
                    type="button"
                    key={term}
                    onClick={() => onViewTerm(term)}
                    className="rounded-lg bg-light1 p-sm text-left"
                  >
                    <span className="flex items-center justify-between text-xs font-semibold text-dark1">
                      {term} · {termDate(terms.indexOf(term))}
                      <ArrowRight size={13} />
                    </span>
                    <span className="mt-xs block text-xs text-dark2">
                      {result.added
                        .filter((code) => result.plan[code] === term)
                        .join(', ')}
                    </span>
                  </button>
                ))}
            </div>
            {result.unplaced.length > 0 && (
              <div className="mt-md rounded-lg bg-accent/10 p-sm">
                <p className="m-0 flex items-center gap-xs text-xs font-semibold">
                  <AlertTriangle size={14} className="text-courses" />
                  Couldn’t fit {result.unplaced.length} courses
                </p>
                {result.unplaced.map((item) => (
                  <p
                    key={item.code}
                    className="mb-0 mt-sm text-xs leading-relaxed text-dark2"
                  >
                    <strong>{item.code}</strong> · {item.reason}
                  </p>
                ))}
              </div>
            )}
            {issues.length > 0 && (
              <p className="mt-md text-xs leading-relaxed text-dark2">
                {issues.length} existing placements have prerequisites to
                review.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};

export default WishlistPage;
