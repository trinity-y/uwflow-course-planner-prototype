import { CourseScheduleFragment } from './api/types';
import { courses, initialPlan, Plan, sequences } from './plannerData';
import {
  futureCourseOfferings,
  hasWishlistPrerequisiteGap,
} from './wishlistCourseInfo';

jest.mock('./courseRequirements.json', () =>
  require('./__fixtures__/illustrativeRequirements.json'),
);

jest.mock('./enhancementRequirements.json', () => ({ courses: [], plans: [] }));

const sections: CourseScheduleFragment['sections'] = [1271, 1279].map(
  (term) => ({
    id: -term,
    enrollment_capacity: 60,
    enrollment_total: 0,
    class_number: term,
    section_name: 'LEC 001',
    term_id: term,
    updated_at: '2026-11-17T00:00:00Z',
    meetings: [],
    exams: [],
  }),
);

const course = (code: string) => {
  const found = courses.find((item) => item.code === code);
  if (!found) throw new Error('Missing course fixture');
  return found;
};

test('future offerings come from unique scheduled term IDs, not repeating seasonal guesses', () => {
  expect(futureCourseOfferings([...sections, ...sections], 1269)).toEqual([
    'Winter 2027',
    'Fall 2027',
  ]);
  expect(futureCourseOfferings(sections, 1271)).toEqual(['Fall 2027']);
  expect(futureCourseOfferings(sections, 1279)).toEqual([]);
  expect(futureCourseOfferings([], 1269)).toBeNull();
});

test('cancelled sections do not promise a future offering', () => {
  const section = sections[0];
  expect(
    futureCourseOfferings(
      [
        {
          ...section,
          meetings: [
            {
              days: [],
              start_date: null,
              end_date: null,
              start_seconds: null,
              end_seconds: null,
              location: null,
              prof: null,
              is_closed: false,
              is_cancelled: true,
              is_tba: true,
            },
          ],
        },
      ],
      1269,
    ),
  ).toEqual([]);
});

test('wishlist prerequisite warnings account for planned timing and alternative ancestors', () => {
  const terms = sequences['Stream 8'];
  expect(hasWishlistPrerequisiteGap(course('CS 247'), initialPlan, terms)).toBe(
    false,
  );
  expect(hasWishlistPrerequisiteGap(course('CS 350'), initialPlan, terms)).toBe(
    true,
  );
  expect(
    hasWishlistPrerequisiteGap(
      course('CS 247'),
      { ...initialPlan, 'CS 247': '2A' },
      terms,
    ),
  ).toBe(true);
  expect(
    hasWishlistPrerequisiteGap(
      course('CS 247'),
      { ...initialPlan, 'CS 247': '2B' },
      terms,
    ),
  ).toBe(false);
  const alternative: Plan = { ...initialPlan, 'CS 251': '2A' };
  delete alternative['CS 246'];
  expect(hasWishlistPrerequisiteGap(course('CS 247'), alternative, terms)).toBe(
    false,
  );
  delete alternative['CS 135'];
  expect(hasWishlistPrerequisiteGap(course('CS 247'), alternative, terms)).toBe(
    true,
  );
  expect(hasWishlistPrerequisiteGap(course('ECON 101'), {}, terms)).toBe(false);
});
