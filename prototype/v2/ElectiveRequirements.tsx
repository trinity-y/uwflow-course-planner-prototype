import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'react-feather';

import { AcademicCalendar } from './academicCalendars';
import CourseGraph from './CourseGraph';
import { electiveProgress, electiveRules } from './electiveRules';
import { Plan, PlannerCourse } from './plannerData';

interface Props {
  calendar: AcademicCalendar;
  catalog: PlannerCourse[];
  plan: Plan;
  query: string;
  wishlist: string[];
  onChoose: (course: PlannerCourse) => void;
  onAdd: (course: PlannerCourse) => void;
  onToggleWishlist: (code: string) => void;
}

const ElectiveRequirements = ({
  calendar,
  catalog,
  plan,
  query,
  wishlist,
  onChoose,
  onAdd,
  onToggleWishlist,
}: Props) => {
  const [expanded, setExpanded] = useState<string[]>([]);
  const { rules, allocation } = electiveProgress(calendar, catalog, plan);
  const officialRules = electiveRules(calendar);
  const categories = Array.from(new Set(rules.map((rule) => rule.category)));
  const normalized = query.toLowerCase().replace(/\s/g, '');
  return (
    <div aria-label="Elective requirements">
      {categories.map((category) => {
        const categoryRules = rules.filter(
          (rule) => rule.category === category,
        );
        const total = categoryRules.reduce((sum, rule) => sum + rule.count, 0);
        const planned = categoryRules.reduce(
          (sum, rule) => sum + allocation[rule.id].length,
          0,
        );
        const options = categoryRules.map((rule) => ({
          rule,
          courses: catalog.filter(
            (course) =>
              rule.courses.includes(course.code) &&
              !plan[course.code] &&
              `${course.code}${course.title}`
                .toLowerCase()
                .replace(/\s/g, '')
                .includes(normalized),
          ),
        }));
        if (normalized && !options.some((option) => option.courses.length))
          return null;
        const open = expanded.includes(category) || Boolean(normalized);
        return (
          <section
            key={category}
            className="border-b border-solid border-light2 py-sm"
          >
            <button
              type="button"
              aria-expanded={open}
              onClick={() =>
                setExpanded(
                  open
                    ? expanded.filter((item) => item !== category)
                    : [...expanded, category],
                )
              }
              className="flex w-full items-center gap-sm bg-transparent py-sm text-left text-sm font-semibold text-dark1"
            >
              {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              {category}
              <span className="ml-auto shrink-0 rounded-full bg-light1 px-sm py-xs text-xs font-regular text-dark2">
                {planned}/{total} planned
              </span>
            </button>
            {open &&
              options.map(({ rule, courses }) => {
                const official = officialRules.find(
                  (item) => item.id === rule.id,
                );
                const complete = allocation[rule.id].length >= rule.count;
                return (
                  <div key={rule.id} className="pb-sm">
                    {categoryRules.length > 1 && (
                      <p className="mb-sm mt-md flex justify-between text-xs font-semibold text-dark2">
                        <span>{rule.label}</span>
                        <span>
                          {allocation[rule.id].length}/{rule.count} planned
                        </span>
                      </p>
                    )}
                    {rule.note && (
                      <p className="my-sm text-xs leading-relaxed text-dark2">
                        {rule.note}
                      </p>
                    )}
                    {allocation[rule.id].map((code) => (
                      <p key={code} className="my-xs text-xs text-primary">
                        {code} · {plan[code]}
                      </p>
                    ))}
                    {!complete && (
                      <>
                        <CourseGraph
                          seeds={courses}
                          catalog={catalog}
                          plan={plan}
                          onChoose={onChoose}
                          onAdd={onAdd}
                          wishlist={wishlist}
                          onToggleWishlist={onToggleWishlist}
                        />
                        {official && rule.id !== 'unrestricted' && (
                          <p className="my-sm text-xs text-dark2">
                            {rule.courses.length} of {official.courses.length}{' '}
                            listed courses available in this prototype.
                          </p>
                        )}
                      </>
                    )}
                    <a
                      href={rule.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-xs text-xs text-primary"
                    >
                      Calendar requirements <ExternalLink size={12} />
                    </a>
                  </div>
                );
              })}
          </section>
        );
      })}
    </div>
  );
};

export default ElectiveRequirements;
