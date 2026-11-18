import { gql } from '@apollo/client';

import CourseFragment from './CourseFragment';
import ReviewFragment from './ReviewFragment';

export const GET_COURSE = gql`
  query getCourse($code: String) {
    course(where: { code: { _eq: $code } }) {
      ...CourseInfo
      ...CourseSchedule
      ...CourseRequirements
      ...CourseRating
      ...CourseReviewDistribution
    }
    course_alias(where: { code: { _eq: $code } }) {
      course {
        ...CourseInfo
        ...CourseSchedule
        ...CourseRequirements
        ...CourseRating
        ...CourseReviewDistribution
      }
    }
  }
  ${CourseFragment.courseInfo}
  ${CourseFragment.courseSchedule}
  ${CourseFragment.courseRequirements}
  ${CourseFragment.courseRating}
  ${CourseFragment.courseReviewDistribution}
`;

export const COURSE_REVIEWS = gql`
  query courseReviews($id: Int) {
    review(
      where: {
        course_id: { _eq: $id }
        _or: [
          { course_comment: { _is_null: false } }
          { prof_comment: { _is_null: false } }
        ]
      }
    ) {
      ...ReviewInfo
      ...ReviewVoteCounts
    }
  }
  ${ReviewFragment.reviewInfo}
  ${ReviewFragment.reviewVoteCounts}
`;
