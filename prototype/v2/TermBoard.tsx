import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Coffee,
  PlusCircle,
  X,
} from 'react-feather';

import { Button } from './components/button';
import ActionButton from './ActionButton';
import {
  courses as defaultCourses,
  Plan,
  PlannerCourse,
  termCapacity,
  termDate,
} from './plannerData';

interface Props {
  terms: string[];
  catalog?: PlannerCourse[];
  capacities?: Record<string, number>;
  plan: Plan;
  selectedTerm: string;
  issues: PlannerCourse[];
  onSelect: (term: string) => void;
  onAdd: (term: string) => void;
  onRemove: (code: string) => void;
}

const TermBoard = ({
  terms,
  catalog = defaultCourses,
  capacities,
  plan,
  selectedTerm,
  issues,
  onSelect,
  onAdd,
  onRemove,
}: Props) => {
  const [allTerms, setAllTerms] = useState(false);
  const [showWork, setShowWork] = useState(true);
  const board = useRef<HTMLDivElement>(null);
  const activeCard = useRef<HTMLElement>(null);
  const visibleTerms = terms.filter(
    (term) => showWork || !term.startsWith('WT'),
  );
  const selectedIndex = Math.max(0, visibleTerms.indexOf(selectedTerm));
  const start = selectedIndex;
  const visibleCount = 4;
  const displayed = allTerms
    ? visibleTerms
    : visibleTerms.slice(start, start + visibleCount);

  useEffect(() => {
    if (selectedTerm.startsWith('WT')) setShowWork(true);
  }, [selectedTerm]);

  useEffect(() => {
    if (board.current) {
      board.current.scrollLeft = allTerms
        ? activeCard.current?.offsetLeft ?? 0
        : 0;
    }
  }, [allTerms, selectedTerm]);

  return (
    <div className="mt-lg min-w-0">
      <nav
        aria-label="Quick term navigation"
        className="mb-md flex gap-xs overflow-x-auto pb-sm"
      >
        {terms.map((term, termIndex) => (
          <ActionButton
            type="button"
            key={term}
            label={`Jump to ${term}`}
            aria-pressed={selectedTerm === term}
            onClick={() => onSelect(term)}
            className={`flex min-w-[52px] flex-1 flex-col items-center gap-xs rounded-lg px-sm py-sm text-xs ${
              selectedTerm === term
                ? 'bg-primary text-white'
                : 'bg-light1 text-dark2 hover:bg-light2'
            }`}
          >
            <span className="font-semibold">
              {term.startsWith('OFF') ? 'OFF' : term}
            </span>
            <span className="opacity-70">
              {termDate(termIndex).split(' ')[0].slice(0, 1)} ’
              {termDate(termIndex).slice(-2)}
            </span>
          </ActionButton>
        ))}
      </nav>
      <div className="mb-md flex flex-wrap items-center justify-between gap-md">
        <div className="flex flex-wrap gap-md text-xs text-dark2">
          <label className="flex cursor-pointer items-center gap-xs">
            <input
              type="checkbox"
              checked={showWork}
              onChange={(event) => {
                setShowWork(event.target.checked);
                if (!event.target.checked && selectedTerm.startsWith('WT'))
                  onSelect(
                    terms.find((term) => !term.startsWith('WT')) ?? terms[0],
                  );
              }}
            />
            Show work terms
          </label>
          <label className="flex cursor-pointer items-center gap-xs">
            <input
              type="checkbox"
              checked={allTerms}
              onChange={(event) => setAllTerms(event.target.checked)}
            />
            All terms
          </label>
        </div>
        {!allTerms && (
          <div className="flex items-center gap-sm">
            <Button
              variant="subtle"
              size="icon"
              aria-label="Previous terms"
              disabled={start === 0}
              onClick={() => onSelect(visibleTerms[Math.max(0, start - 1)])}
            >
              <ArrowLeft size={16} />
            </Button>
            <span className="text-xs text-dark2">
              {start + 1}–{Math.min(start + visibleCount, visibleTerms.length)}{' '}
              of {visibleTerms.length}
            </span>
            <Button
              variant="subtle"
              size="icon"
              aria-label="Next terms"
              disabled={start >= visibleTerms.length - 1}
              onClick={() => onSelect(visibleTerms[start + 1])}
            >
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </div>
      <p className="mb-md text-xs leading-relaxed text-dark2">
        Compare terms side by side. Select a term to plan into it, or add a
        course directly below.
      </p>
      <div
        ref={board}
        className="relative flex items-stretch gap-md overflow-x-auto pb-md"
        aria-label="Degree term board"
        tabIndex={0}
      >
        {displayed.map((term) => {
          const termCourses = catalog.filter(
            (course) => plan[course.code] === term,
          );
          const work = term.startsWith('WT');
          const off = term.startsWith('OFF');
          const capacity = termCapacity(term, capacities);
          const active = term === selectedTerm;
          return (
            <section
              key={term}
              ref={active ? activeCard : undefined}
              aria-label={`${term} · ${termDate(terms.indexOf(term))}`}
              className={`flex min-w-[180px] flex-1 flex-col overflow-hidden rounded-lg border border-solid ${
                active ? 'border-primary' : 'border-light3'
              } ${off ? 'bg-light1' : 'bg-white'}`}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(term)}
                className={`flex w-full items-start justify-between gap-sm p-md text-left ${
                  work ? 'bg-accent/10' : off ? 'bg-light2' : 'bg-lecture/30'
                }`}
              >
                <span>
                  <span className="block text-lg font-semibold text-dark1">
                    {work
                      ? `Work term ${term.slice(2)}`
                      : off
                      ? 'Term off'
                      : term}
                  </span>
                  <span className="mt-xs block text-xs text-dark2">
                    {termDate(terms.indexOf(term))}
                  </span>
                </span>
                {work ? (
                  <Briefcase size={17} className="mt-xs text-courses" />
                ) : off ? (
                  <Coffee size={17} className="mt-xs text-dark3" />
                ) : (
                  <span
                    className={`rounded-full px-sm py-xs text-xs ${
                      active ? 'bg-primary text-white' : 'bg-white text-dark2'
                    }`}
                  >
                    {termCourses.length}/{capacity}
                  </span>
                )}
              </button>
              <div className="flex min-h-[300px] flex-1 flex-col p-sm">
                {termCourses.map((course) => (
                  <div
                    key={course.code}
                    className="mb-sm rounded-lg border border-solid border-light3 bg-white p-sm"
                  >
                    <div className="flex items-center justify-between gap-xs">
                      <span className="text-sm font-semibold text-primary">
                        {course.code}
                      </span>
                      <ActionButton
                        type="button"
                        label={`Remove ${course.code}`}
                        onClick={() => onRemove(course.code)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-transparent text-dark3 hover:bg-light1 hover:text-dark1"
                      >
                        <X size={14} />
                      </ActionButton>
                    </div>
                    <p className="mb-sm mt-xs text-xs leading-relaxed text-dark1">
                      {course.title}
                    </p>
                    {course.listedInCalendar === false && (
                      <p className="mb-sm mt-xs text-xs text-darkRed">
                        Not listed in selected calendar
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-xs">
                      <span className="text-xs text-dark3">
                        {course.units ?? 0.5} credits
                      </span>
                      {issues.some((issue) => issue.code === course.code) && (
                        <span className="flex items-center gap-xs text-xs text-dark2">
                          <AlertTriangle
                            size={13}
                            className="shrink-0 text-courses"
                          />
                          Missing prerequisites
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {!termCourses.length && (
                  <div className="flex flex-1 items-center justify-center px-sm py-lg text-center text-xs leading-relaxed text-dark3">
                    {off
                      ? 'Room to recharge.'
                      : work
                      ? 'Work, learn, explore. Up to 2 courses.'
                      : 'A fresh term, ready for your plans.'}
                  </div>
                )}
                {!off && (
                  <ActionButton
                    type="button"
                    label={`Add a course to ${term}`}
                    disabled={termCourses.length >= capacity}
                    onClick={() => onAdd(term)}
                    className="mt-auto flex w-full items-center justify-center gap-xs rounded-lg border border-dashed border-primary/40 bg-white py-md text-xs text-primary hover:bg-light1 disabled:opacity-50"
                  >
                    <PlusCircle size={15} />
                    Add course
                  </ActionButton>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {allTerms && (
        <p className="mb-0 mt-xs text-xs text-dark3">
          Scroll horizontally to explore your full degree.
        </p>
      )}
    </div>
  );
};

export default TermBoard;
