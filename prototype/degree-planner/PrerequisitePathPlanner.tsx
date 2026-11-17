import React, { useState } from 'react';
import { AlertTriangle, ArrowRight, Check } from 'react-feather';

import { Button } from 'components/ui/button';

import {
  canPlace,
  courses as defaultCourses,
  isWorkTermCourse,
  Plan,
  PlannerCourse,
  prerequisiteSuggestions,
  termDate,
} from './plannerData';
import {
  initialPrerequisiteSelections,
  missingPrerequisiteRows,
  selectedPrerequisiteTree,
} from './prerequisiteChoices';
import PrerequisiteChoiceTree from './PrerequisiteChoiceTree';

interface Props {
  course: PlannerCourse;
  catalog?: PlannerCourse[];
  target: string;
  plan: Plan;
  terms: string[];
  onApply: (plan: Plan) => void;
  onAddAnyway: () => void;
}

const field =
  'box-border w-full rounded-lg border border-solid border-light3 bg-white px-sm py-sm font-inter text-xs text-dark1 focus:border-primary';

const PrerequisitePathPlanner = ({
  course,
  catalog = defaultCourses,
  target,
  plan,
  terms,
  onApply,
  onAddAnyway,
}: Props) => {
  const [selections, setSelections] = useState(() =>
    initialPrerequisiteSelections(catalog, plan, terms, target),
  );
  const [overrides, setOverrides] = useState<Plan>({});
  const tree = selectedPrerequisiteTree(course, catalog, selections);
  const selectedCourse = tree.catalog.find((item) => item.code === course.code);
  const option =
    tree.unresolved.length || !selectedCourse
      ? undefined
      : prerequisiteSuggestions(
          selectedCourse,
          target,
          plan,
          terms,
          tree.catalog,
        )[0];
  const draft: Plan = {};
  option?.missing.forEach((code) => {
    const dependency = catalog.find((item) => item.code === code);
    if (!dependency) return;
    const earlier = terms.find(
      (term, index) =>
        index < terms.indexOf(target) &&
        (!term.startsWith('WT') || isWorkTermCourse(dependency)) &&
        !canPlace(dependency, term, { ...plan, ...draft }, terms) &&
        (option.requirements[code] ?? []).every(
          (parent) =>
            terms.indexOf(draft[parent] ?? plan[parent]) >= 0 &&
            terms.indexOf(draft[parent] ?? plan[parent]) < index,
        ),
    );
    draft[code] = overrides[code] ?? option.plan?.[code] ?? earlier ?? '';
  });
  const assignedDraft = Object.fromEntries(
    Object.entries(draft).filter(([, term]) => Boolean(term)),
  );
  const combined = { ...plan, ...assignedDraft, [course.code]: target };
  const invalid = option?.missing.some((code) => {
    const dependency = catalog.find((item) => item.code === code);
    return (
      !dependency ||
      !draft[code] ||
      Boolean(canPlace(dependency, draft[code], combined, terms))
    );
  });
  const targetIssue = canPlace(course, target, combined, terms);
  const draftFillsTarget =
    targetIssue === 'This term is full.' &&
    !canPlace(course, target, plan, terms);
  const unassigned = option?.missing.some((code) => !draft[code]);
  const timing = option
    ? Object.entries(option.requirements).flatMap(([dependent, parents]) =>
        parents
          .filter(
            (parent) =>
              Boolean(combined[parent]) &&
              Boolean(combined[dependent]) &&
              terms.indexOf(combined[parent]) >=
                terms.indexOf(combined[dependent]),
          )
          .map(
            (parent) => `${parent} needs an earlier term than ${dependent}.`,
          ),
      )
    : [];
  return (
    <div>
      <div className="mt-lg grid grid-cols-2 gap-lg tabletDown:grid-cols-1">
        <section className="min-w-0" aria-labelledby="choose-path-heading">
          <h3 id="choose-path-heading" className="m-0 text-sm font-semibold">
            <span className="mr-sm text-primary">1</span>Choose prerequisites
          </h3>
          <p className="mb-sm mt-sm text-xs leading-relaxed text-dark2">
            Choose at each “or” branch. Already-planned prerequisites are
            hidden.
          </p>
          <PrerequisiteChoiceTree
            tree={{
              ...tree,
              rows: missingPrerequisiteRows(tree, plan, terms, target),
            }}
            plan={plan}
            selections={selections}
            onChoose={(key, value) =>
              setSelections((current) => ({ ...current, [key]: value }))
            }
          />
        </section>
        <section
          className="min-w-0 rounded-lg bg-light1 p-md"
          aria-labelledby="assign-terms-heading"
        >
          <h3 id="assign-terms-heading" className="m-0 text-sm font-semibold">
            <span className="mr-sm text-primary">2</span>Place the prerequisites
          </h3>
          {!option ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-sm text-center text-dark2">
              <ArrowRight size={24} className="text-dark3" />
              <p className="m-0 text-sm">Choose the remaining alternatives.</p>
              <p className="m-0 text-xs">
                We’ll suggest terms. You can change them.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-md mt-sm text-xs leading-relaxed text-dark2">
                {option.missing.length} courses to add or move. Suggested terms
                are editable.
              </p>
              {option.codes.filter((code) => !option.missing.includes(code))
                .length > 0 && (
                <p className="mb-md flex items-center gap-xs text-xs text-primaryDark">
                  <Check size={14} />
                  {
                    option.codes.filter(
                      (code) => !option.missing.includes(code),
                    ).length
                  }{' '}
                  prerequisites already planned
                </p>
              )}
              <div className="grid gap-sm">
                {option.missing.map((code) => {
                  const dependency = catalog.find((item) => item.code === code);
                  if (!dependency) return null;
                  return (
                    <div
                      key={code}
                      className="rounded-lg border border-solid border-light3 bg-white p-sm"
                    >
                      <div className="mb-sm flex items-center justify-between gap-sm">
                        <label
                          htmlFor={`placement-${code}`}
                          className="text-sm font-semibold text-primary"
                        >
                          {code}
                        </label>
                        <span className="text-xs text-dark3">
                          {plan[code]
                            ? `Move from ${plan[code]}`
                            : 'Add course'}
                        </span>
                      </div>
                      <select
                        id={`placement-${code}`}
                        className={field}
                        value={draft[code] ?? ''}
                        onChange={(event) =>
                          setOverrides({
                            ...overrides,
                            [code]: event.target.value,
                          })
                        }
                      >
                        <option value="" disabled>
                          Choose a term
                        </option>
                        {terms.map((term, index) => {
                          const reason = canPlace(
                            dependency,
                            term,
                            combined,
                            terms,
                          );
                          return (
                            <option
                              key={term}
                              value={term}
                              disabled={Boolean(reason)}
                            >
                              {term} · {termDate(index)}
                              {reason ? ` — ${reason}` : ''}
                            </option>
                          );
                        })}
                      </select>
                      <p className="mb-0 mt-xs text-xs text-dark3">
                        Offering unknown
                        {dependency.fixedTerm
                          ? ` · Assigned to ${dependency.fixedTerm}`
                          : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
              {timing.length > 0 && (
                <div className="mt-md rounded-lg bg-accent/10 p-sm text-xs leading-relaxed text-dark2">
                  <div className="flex items-center gap-xs font-semibold">
                    <AlertTriangle size={14} className="text-courses" />
                    Timing to review
                  </div>
                  {timing.map((message) => (
                    <p key={message} className="mb-0 mt-xs">
                      {message}
                    </p>
                  ))}
                  <p className="mb-0 mt-sm">
                    You can still add this plan and adjust it later.
                  </p>
                </div>
              )}
              {targetIssue && (
                <p className="mt-sm text-xs text-darkRed">
                  {draftFillsTarget
                    ? `These prerequisite placements would fill ${target}. Move a prerequisite or choose a different destination term.`
                    : `${targetIssue} Choose a different destination term or free up space.`}
                </p>
              )}
              {invalid && (
                <p className="mt-sm text-xs text-darkRed">
                  {unassigned
                    ? 'Choose a term for each missing prerequisite. No earlier term could be suggested for the unassigned courses.'
                    : 'Choose terms with available space that match the fixed-term rules.'}
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <div className="mt-lg grid grid-cols-2 gap-sm mobileDown:grid-cols-1 border-t border-solid border-light3 pt-md">
        <Button
          variant="subtle"
          onClick={onAddAnyway}
          disabled={Boolean(canPlace(course, target, plan, terms))}
        >
          Add course anyway
        </Button>
        <Button
          variant="filter"
          disabled={
            !option ||
            invalid ||
            Boolean(canPlace(course, target, combined, terms))
          }
          onClick={() => onApply(combined)}
        >
          Add prerequisites and course
        </Button>
      </div>
    </div>
  );
};

export default PrerequisitePathPlanner;
