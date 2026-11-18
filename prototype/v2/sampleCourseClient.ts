import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
} from '@apollo/client';

import { CourseReviewsQuery, GetCourseQuery } from './api/types';
import { PlannerCourse } from './plannerData';
import fixture from './sampleCourseResponses.json';

// Actual anonymous query result types: fixture fields drift only if typecheck fails.
export const sampleCourseDetails: Record<string, GetCourseQuery> =
  fixture.courseDetails;
export const sampleCourseReviews: Record<string, CourseReviewsQuery> =
  fixture.courseReviews;

export const createSampleCourseClient = (catalog?: PlannerCourse[]) =>
  new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: { course: { fields: { rating: { merge: true } } } },
    }),
    link: new ApolloLink(
      (operation) =>
        new Observable((observer) => {
          if (operation.operationName === 'getCourse') {
            const code = String(operation.variables.code ?? '')
              .replace(/\s/g, '')
              .toLowerCase();
            const response = sampleCourseDetails[code];
            const metadata = catalog?.find(
              (course) => course.code.replace(/\s/g, '').toLowerCase() === code,
            );
            observer.next({
              data:
                response && metadata
                  ? {
                      ...response,
                      course: response.course.map((course) => ({
                        ...course,
                        name: metadata.title,
                        description:
                          metadata.description !== undefined
                            ? metadata.description
                            : course.description,
                        prereqs:
                          metadata.prerequisiteText !== undefined
                            ? metadata.prerequisiteText || null
                            : course.prereqs,
                        antireqs:
                          metadata.antirequisiteText !== undefined
                            ? metadata.antirequisiteText || null
                            : course.antireqs,
                        coreqs:
                          metadata.corequisiteText !== undefined
                            ? metadata.corequisiteText || null
                            : course.coreqs,
                      })),
                    }
                  : response ?? { course: [], course_alias: [] },
            });
          } else if (operation.operationName === 'courseReviews') {
            observer.next({
              data: sampleCourseReviews[String(operation.variables.id)] ?? {
                review: [],
              },
            });
          } else {
            observer.error(
              new Error(
                `Unsupported sample operation: ${operation.operationName}`,
              ),
            );
            return;
          }
          observer.complete();
        }),
    ),
  });
