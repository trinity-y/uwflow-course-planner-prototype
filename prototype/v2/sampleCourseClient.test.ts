import { COURSE_REVIEWS, GET_COURSE } from './api/queries';
import { CourseReviewsQuery, GetCourseQuery } from './api/types';
import { findAcademicCalendar } from './academicCalendars';
import { courses } from './plannerData';
import {
  createSampleCourseClient,
  sampleCourseDetails,
  sampleCourseReviews,
} from './sampleCourseClient';

const originalMicrotask = Object.getOwnPropertyDescriptor(
  globalThis,
  'queueMicrotask',
);
beforeAll(() => {
  if (!originalMicrotask)
    Object.defineProperty(globalThis, 'queueMicrotask', {
      configurable: true,
      value: (callback: () => void) => Promise.resolve().then(callback),
    });
});
afterAll(() => {
  if (!originalMicrotask) Reflect.deleteProperty(globalThis, 'queueMicrotask');
});

test('serves the existing course and review documents through Apollo with their real variables', async () => {
  const client = createSampleCourseClient();
  try {
    const details = await client.query<GetCourseQuery>({
      query: GET_COURSE,
      variables: { code: 'cs246' },
    });
    const course = details.data.course[0];
    expect(course.name).toBe('Object-Oriented Software Development');
    expect(course.rating?.liked).toBe(0.5);
    expect(course.sections).toEqual([]);
    const reviews = await client.query<CourseReviewsQuery>({
      query: COURSE_REVIEWS,
      variables: { id: course.id },
    });
    expect(reviews.data.review).toHaveLength(2);
    expect(reviews.data.review[0].course_id).toBe(course.id);
    expect(reviews.data.review[0].course_review_rating?.upvote_count).toBe(5);
    expect(reviews.data.review[0].course_easy).toBe(1);
    const cached = client.readQuery<GetCourseQuery>({
      query: GET_COURSE,
      variables: { code: 'cs246' },
    });
    expect(cached?.course[0].rating?.useful).toBe(0.75);
  } finally {
    client.stop();
  }
});

test('every planner course has a typed response and reviews are linked to the same synthetic ID', () => {
  courses.forEach((course) => {
    const response =
      sampleCourseDetails[course.code.replace(/\s/g, '').toLowerCase()];
    expect(response.course).toHaveLength(1);
    const entry = response.course[0];
    expect(entry.id).toBeLessThan(0);
    const reviews = sampleCourseReviews[String(entry.id)].review;
    expect(entry.rating?.comment_count ?? 0).toBe(reviews.length);
    reviews.forEach((review) => {
      expect(review.course_id).toBe(entry.id);
      expect(review.course?.code).toBe(entry.code);
      expect(review.prof).toBeNull();
    });
  });
});

test('empty and unreviewed courses retain the backend null and array shapes', async () => {
  const client = createSampleCourseClient();
  try {
    const missing = await client.query<GetCourseQuery>({
      query: GET_COURSE,
      variables: { code: 'missing' },
    });
    expect(missing.data.course).toEqual([]);
    expect(missing.data.course_alias).toEqual([]);
    const empty = await client.query<GetCourseQuery>({
      query: GET_COURSE,
      variables: { code: 'cs145' },
    });
    expect(empty.data.course[0].rating).toBeNull();
    const reviews = await client.query<CourseReviewsQuery>({
      query: COURSE_REVIEWS,
      variables: { id: empty.data.course[0].id },
    });
    expect(reviews.data.review).toEqual([]);
  } finally {
    client.stop();
  }
});

test('course details use selected calendar text without changing the backend response contract', async () => {
  const calendar = findAcademicCalendar('2024-2025');
  const client = createSampleCourseClient(calendar.courses);
  try {
    const result = await client.query<GetCourseQuery>({
      query: GET_COURSE,
      variables: { code: 'se463' },
    });
    expect(result.data.course[0].name).toBe(
      'Software Requirements Specification and Analysis',
    );
    expect(result.data.course[0].prereqs).toBe(
      calendar.courses.find((course) => course.code === 'SE 463')
        ?.prerequisiteText,
    );
    expect(sampleCourseDetails.se463.course[0].name).toBe(
      'Software Project Management, Requirements, and Analysis',
    );
  } finally {
    client.stop();
  }
});
