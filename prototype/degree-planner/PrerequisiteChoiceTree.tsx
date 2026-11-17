import React from 'react';
import { Check } from 'react-feather';

import { Plan } from './plannerData';
import {
  choiceKey,
  prerequisiteChoices,
  PrerequisiteSelections,
  selectedPrerequisiteTree,
} from './prerequisiteChoices';

interface Props {
  tree: ReturnType<typeof selectedPrerequisiteTree>;
  plan: Plan;
  selections: PrerequisiteSelections;
  onChoose: (key: string, value: number) => void;
}

const PrerequisiteChoiceTree = ({
  tree,
  plan,
  selections,
  onChoose,
}: Props) => (
  <div className="mt-md grid gap-sm" aria-label="Prerequisite choices">
    {tree.rows.map(({ course, depth, requiredBy }) => {
      const choices = prerequisiteChoices(course);
      return (
        <div
          key={course.code}
          style={{ marginLeft: Math.min(depth, 3) * 12 }}
          className={`rounded-lg border border-solid p-sm ${
            depth
              ? 'border-light3 border-l-2'
              : 'border-primary/40 bg-lecture/20'
          }`}
          aria-label={`${course.code} prerequisite node`}
        >
          <div className="flex flex-wrap items-center gap-sm">
            <strong className="text-sm text-primary">{course.code}</strong>
            {plan[course.code] && (
              <span className="flex items-center gap-xs text-xs text-primaryDark">
                <Check size={12} />
                {plan[course.code]}
              </span>
            )}
          </div>
          <p className="mb-0 mt-xs text-xs text-dark2">{course.title}</p>
          {requiredBy.length > 0 && (
            <p className="mb-0 mt-xs text-xs text-dark3">
              For {requiredBy.join(' and ')}
            </p>
          )}
          {choices.groups.map((group, index) => {
            const key = choiceKey(course.code, index);
            return (
              <fieldset key={key} className="m-0 mt-sm min-w-0 border-0 p-0">
                <legend className="mb-xs text-xs font-semibold text-dark2">
                  Choose one
                  {choices.groups.length > 1
                    ? ` · ${index + 1} of ${choices.groups.length}`
                    : ''}
                </legend>
                <div className="flex flex-wrap items-center gap-xs">
                  {group.map((option, optionIndex) => (
                    <React.Fragment key={option.join('|')}>
                      {optionIndex > 0 && (
                        <span className="text-xs text-dark3">or</span>
                      )}
                      <label
                        className={`flex cursor-pointer items-center gap-xs rounded border border-solid px-sm py-xs text-xs hover:bg-lecture/30 ${
                          selections[key] === optionIndex
                            ? 'border-primary bg-lecture/30 text-primary'
                            : 'border-light3 bg-white text-dark2'
                        }`}
                      >
                        <input
                          type="radio"
                          name={key}
                          aria-label={`Choose ${option.join(' and ')} for ${
                            course.code
                          }`}
                          checked={selections[key] === optionIndex}
                          onChange={() => onChoose(key, optionIndex)}
                        />
                        {option.join(' and ')}
                      </label>
                    </React.Fragment>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      );
    })}
  </div>
);

export default PrerequisiteChoiceTree;
