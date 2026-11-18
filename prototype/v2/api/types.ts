// Snapshot of the UWFlow generated operation types used by this prototype.
// Copied without modification; see README.md for provenance.

type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };

export type CourseInfoFragment = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  aliases: Array<{ code: string }>;
  profs_teaching: Array<{
    prof: {
      id: number;
      code: string;
      name: string;
      rating: { liked: any; comment_count: any } | null;
    } | null;
  }>;
};

export type CourseScheduleFragment = {
  id: number;
  sections: Array<{
    id: number;
    enrollment_capacity: number;
    enrollment_total: number;
    class_number: number;
    section_name: string;
    term_id: number;
    updated_at: any;
    meetings: Array<{
      days: Array<string>;
      start_date: any;
      end_date: any;
      start_seconds: number | null;
      end_seconds: number | null;
      location: string | null;
      is_closed: boolean;
      is_cancelled: boolean;
      is_tba: boolean;
      prof: { id: number; code: string; name: string } | null;
    }>;
    exams: Array<{
      date: any;
      day: string | null;
      end_seconds: number | null;
      is_tba: boolean;
      location: string | null;
      section_id: number;
      start_seconds: number | null;
    }>;
  }>;
};

export type CourseRequirementsFragment = {
  id: number;
  antireqs: string | null;
  prereqs: string | null;
  coreqs: string | null;
  postrequisites: Array<{
    postrequisite: { id: number; code: string; name: string } | null;
  }>;
};

export type CourseRatingFragment = {
  id: number;
  rating: {
    liked: any;
    easy: any;
    useful: any;
    filled_count: any;
    comment_count: any;
  } | null;
};

export type CourseReviewDistributionFragment = {
  id: number;
  course_useful_buckets: Array<{ value: any; count: any }>;
  course_easy_buckets: Array<{ value: any; count: any }>;
};

export type ReviewInfoFragment = {
  id: number;
  created_at: any;
  updated_at: any;
  public: boolean;
  liked: any;
  course_comment: string | null;
  course_easy: any;
  course_useful: any;
  prof_engaging: any;
  prof_comment: string | null;
  prof_clear: any;
  course_id: number | null;
  prof_id: number | null;
  author: {
    full_name: string | null;
    picture_url: string | null;
    program: string | null;
  } | null;
  course: {
    id: number;
    code: string;
    name: string;
    profs_teaching: Array<{ prof: { id: number; name: string } | null }>;
    rating: { liked: any } | null;
  } | null;
  prof: {
    id: number;
    name: string;
    code: string;
    picture_url: string | null;
    rating: { liked: any } | null;
  } | null;
};

export type ReviewVoteCountsFragment = {
  id: number;
  course_review_rating: { upvote_count: any } | null;
  prof_review_rating: { upvote_count: any } | null;
};

export type GetCourseQueryVariables = Exact<{
  code?: string | null | undefined;
}>;

export type GetCourseQuery = {
  course: Array<
    CourseInfoFragment &
      CourseScheduleFragment &
      CourseRequirementsFragment &
      CourseRatingFragment &
      CourseReviewDistributionFragment
  >;
  course_alias: Array<{
    course: CourseInfoFragment &
      CourseScheduleFragment &
      CourseRequirementsFragment &
      CourseRatingFragment &
      CourseReviewDistributionFragment;
  }>;
};

export type CourseReviewsQueryVariables = Exact<{
  id?: number | null | undefined;
}>;

export type CourseReviewsQuery = {
  review: Array<ReviewInfoFragment & ReviewVoteCountsFragment>;
};
