import React, { ComponentProps } from 'react';

import CourseGraph from './CourseGraph';
import { PlannerChoiceRequirement } from './degreeEnhancements';

interface Props extends ComponentProps<typeof CourseGraph> {
  choices: PlannerChoiceRequirement[];
}

const CoreCourseTree = ({ choices, seeds, ...props }: Props) => {
  const visibleChoices = choices.filter(
    (choice) =>
      choice.courses.filter((code) => props.plan[code]).length < choice.count &&
      seeds.some((course) => choice.courses.includes(course.code)),
  );
  const optionCodes = new Set(choices.flatMap((choice) => choice.courses));
  const namedCourses = seeds.filter((course) => !optionCodes.has(course.code));
  return (
    <>
      {namedCourses.length > 0 && (
        <CourseGraph {...props} seeds={namedCourses} />
      )}
      {visibleChoices.map((choice) => {
        const options = seeds.filter((course) =>
          choice.courses.includes(course.code),
        );
        return (
          <fieldset
            key={choice.id}
            className="mx-0 my-sm min-w-0 rounded-lg border border-solid border-light3 px-sm pb-sm pt-xs"
          >
            <legend className="px-xs text-xs font-semibold text-dark1">
              {choice.label ?? 'Course requirement'}
              <span className="font-regular text-dark2">
                {' · '}
                {choice.count === 1 ? 'Choose one' : `Choose ${choice.count}`}
              </span>
            </legend>
            {choice.term && (
              <p className="mb-sm mt-xs text-xs text-dark2">
                <span className="inline-block rounded-full bg-light1 px-sm py-xs">
                  {choice.term} recommended
                </span>
              </p>
            )}
            <CourseGraph {...props} seeds={options} />
          </fieldset>
        );
      })}
    </>
  );
};

export default CoreCourseTree;
