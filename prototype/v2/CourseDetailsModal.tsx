import React, { useState } from 'react';
import {
  ExternalLink,
  MessageSquare,
  PlusCircle,
  ThumbsUp,
  X,
} from 'react-feather';
import Modal from 'react-modal';
import { ApolloProvider, useQuery } from '@apollo/client';

import { COURSE_REVIEWS, GET_COURSE } from './api/queries';
import {
  CourseReviewsQuery,
  CourseReviewsQueryVariables,
  GetCourseQuery,
  GetCourseQueryVariables,
} from './api/types';
import { Button } from './components/button';
import { formatCourseCode, getCoursePageRoute } from './lib/courseFormatting';
import { PlannerCourse } from './plannerData';
import { createSampleCourseClient } from './sampleCourseClient';

interface Props {
  code: string;
  catalog?: PlannerCourse[];
  plannedTerm?: string;
  onClose: () => void;
  onPlan: () => void;
}

const CourseDetails = ({
  code,
  catalog,
  plannedTerm,
  onClose,
  onPlan,
}: Props) => {
  const metadata = catalog?.find((course) => course.code === code);
  const { data, loading, error, refetch } = useQuery<
    GetCourseQuery,
    GetCourseQueryVariables
  >(GET_COURSE, { variables: { code: code.replace(/\s/g, '').toLowerCase() } });
  const course = data?.course[0] ?? data?.course_alias[0]?.course;
  const reviews = useQuery<CourseReviewsQuery, CourseReviewsQueryVariables>(
    COURSE_REVIEWS,
    { variables: { id: course?.id }, skip: !course },
  );
  const [sort, setSort] = useState('recent');
  const rows = [...(reviews.data?.review ?? [])]
    .filter((review) => review.course_comment)
    .sort((a, b) =>
      sort === 'helpful'
        ? Number(b.course_review_rating?.upvote_count ?? 0) -
          Number(a.course_review_rating?.upvote_count ?? 0)
        : String(b.created_at).localeCompare(String(a.created_at)),
    );
  const metrics = [
    { label: 'Liked', value: course?.rating?.liked },
    { label: 'Easy', value: course?.rating?.easy },
    { label: 'Useful', value: course?.rating?.useful },
  ];
  return (
    <>
      <header className="flex shrink-0 items-start justify-between gap-md border-b border-solid border-light3 p-lg mobileDown:p-md">
        <div>
          <span className="mb-sm inline-block rounded-full bg-accent/20 px-sm py-xs text-xs text-dark2">
            Sample ratings
            {metadata?.calendarYear
              ? ` · ${metadata.calendarYear} calendar`
              : ''}
          </span>
          {metadata?.listedInCalendar === false && (
            <p className="mb-sm mt-0 text-xs text-dark2">
              Not listed in the selected calendar. Showing the last available
              course record.
            </p>
          )}
          <h2 className="m-0 text-2xl font-semibold text-primary">
            {formatCourseCode(code)}
          </h2>
          {course && (
            <p className="mb-0 mt-sm text-lg text-dark1">{course.name}</p>
          )}
        </div>
        <Button
          variant="subtle"
          size="icon"
          aria-label="Close course details"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-lg mobileDown:p-md">
        {loading ? (
          <p role="status" className="text-sm text-dark2">
            Loading course details…
          </p>
        ) : error ? (
          <div role="alert">
            <p className="text-sm">Couldn’t load this course.</p>
            <Button variant="subtle" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : !course ? (
          <p className="text-sm text-dark2">Course details aren’t available.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-sm">
              {metrics.map((metric) => {
                const value =
                  metric.value === null || metric.value === undefined
                    ? null
                    : Number(metric.value);
                return (
                  <div
                    key={metric.label}
                    className="rounded-lg bg-light1 p-md text-center"
                  >
                    <span className="block text-2xl font-semibold text-primary">
                      {value === null ? '—' : `${Math.round(value * 100)}%`}
                    </span>
                    <span className="mt-xs block text-xs text-dark2">
                      {metric.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="my-md flex items-center gap-sm text-xs text-dark2">
              <ThumbsUp size={14} />
              {course.rating?.filled_count ?? 0} ratings
              <MessageSquare size={14} className="ml-sm" />
              {course.rating?.comment_count ?? 0} reviews
            </p>
            <p className="my-lg text-sm leading-relaxed text-dark2">
              {course.description ?? 'No description available.'}
            </p>
            <div className="rounded-lg border border-solid border-light3 p-md text-sm leading-relaxed">
              <p className="m-0">
                <strong>Prerequisites</strong>
                <span className="mt-xs block text-dark2">
                  {course.prereqs ?? 'None listed'}
                </span>
              </p>
              {course.antireqs && (
                <p className="mb-0 mt-md">
                  <strong>Antirequisites</strong>
                  <span className="mt-xs block text-dark2">
                    {course.antireqs}
                  </span>
                </p>
              )}
              {course.coreqs && (
                <p className="mb-0 mt-md">
                  <strong>Corequisites</strong>
                  <span className="mt-xs block text-dark2">
                    {course.coreqs}
                  </span>
                </p>
              )}
            </div>
            <div className="mb-md mt-lg flex flex-wrap items-center justify-between gap-sm">
              <h3 className="m-0 text-md font-semibold">Course reviews</h3>
              <select
                aria-label="Sort course reviews"
                className="rounded border border-solid border-light3 bg-white px-sm py-xs text-xs text-dark2"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">Most recent</option>
                <option value="helpful">Most helpful</option>
              </select>
            </div>
            {reviews.loading ? (
              <p role="status" className="text-sm text-dark2">
                Loading reviews…
              </p>
            ) : reviews.error ? (
              <p role="alert" className="text-sm text-dark2">
                Reviews couldn’t be loaded.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-md text-sm text-dark2">No reviews yet.</p>
            ) : (
              rows.map((review) => (
                <article
                  key={review.id}
                  className="mb-md rounded-lg border border-solid border-light3 p-md"
                >
                  <div className="flex items-center justify-between gap-sm text-xs text-dark2">
                    <span className="font-semibold">
                      {review.public
                        ? review.author?.full_name ?? 'Anonymous'
                        : 'Anonymous'}
                    </span>
                    <span>
                      {new Date(String(review.created_at)).toLocaleDateString(
                        'en-CA',
                        { year: 'numeric', month: 'short' },
                      )}
                    </span>
                  </div>
                  <p className="my-md text-sm leading-relaxed text-dark1">
                    {review.course_comment}
                  </p>
                  <span className="flex items-center gap-xs text-xs text-dark3">
                    <ThumbsUp size={12} />
                    {review.course_review_rating?.upvote_count ?? 0} helpful
                  </span>
                </article>
              ))
            )}
          </>
        )}
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-md border-t border-solid border-light3 bg-white p-md">
        <a
          href={`https://uwflow.com${getCoursePageRoute(
            code.replace(/\s/g, '').toLowerCase(),
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-xs text-sm text-primary no-underline"
        >
          Full UWFlow page
          <ExternalLink size={14} />
        </a>
        <Button variant="filter" onClick={onPlan}>
          <PlusCircle size={16} />
          {plannedTerm ? `Go to ${plannedTerm}` : 'Add to plan'}
        </Button>
      </footer>
    </>
  );
};

const CourseDetailsModal = (props: Props) => {
  const [client] = useState(() => createSampleCourseClient(props.catalog));
  return (
    <Modal
      isOpen
      onRequestClose={props.onClose}
      contentLabel={`${props.code} course details`}
      className="degree-planner-dialog absolute left-1/2 top-1/2 flex max-h-[85vh] w-[calc(100%_-_32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white font-inter text-dark1 shadow-dropdown outline-none"
      overlayClassName="fixed inset-0 z-modal bg-primaryExtraDark/60"
    >
      <ApolloProvider client={client}>
        <CourseDetails {...props} />
      </ApolloProvider>
    </Modal>
  );
};

export default CourseDetailsModal;
