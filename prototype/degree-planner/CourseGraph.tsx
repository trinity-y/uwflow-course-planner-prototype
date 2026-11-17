import React, { useState } from 'react';
import { Check, Heart, PlusCircle } from 'react-feather';

import theme from 'constants/GlobalTheme';

import ActionButton from './ActionButton';
import {
  graphDependencies,
  paletteEdgeOnRoute,
  unplannedPaletteGraph,
} from './paletteGraph';
import {
  courses as defaultCourses,
  Plan,
  PlannerCourse,
  prerequisiteLabel,
  prerequisiteRoutes,
} from './plannerData';
import { traceCoursePath } from './prerequisiteGraph';

interface Props {
  seeds: PlannerCourse[];
  catalog?: PlannerCourse[];
  plan: Plan;
  onChoose: (course: PlannerCourse) => void;
  onAdd?: (course: PlannerCourse) => void;
  wishlist?: string[];
  onToggleWishlist?: (code: string) => void;
}

const CourseGraph = ({
  seeds,
  catalog = defaultCourses,
  plan,
  onChoose,
  onAdd,
  wishlist = [],
  onToggleWishlist,
}: Props) => {
  const [focused, setFocused] = useState<string | null>(null);
  const { nodes, edges, height } = unplannedPaletteGraph(seeds, catalog, plan);
  const activeCourse = focused;
  const selectedCourse = catalog.find((course) => course.code === activeCourse);
  const allRoutes = selectedCourse
    ? prerequisiteRoutes(selectedCourse, catalog).map((route, colorIndex) => ({
        ...route,
        colorIndex,
      }))
    : [];
  const routes = allRoutes;
  const path = traceCoursePath(
    edges.map((edge) => ({
      from: edge.from.course.code,
      to: edge.to.course.code,
      alternative: edge.alternative,
    })),
    focused,
  );
  const routeColor = (index: number) =>
    [theme.primary, theme.courses, theme.professors][index] ??
    `hsl(${(index * 137.5) % 360}, 65%, 42%)`;
  const connectionPath = (edge: (typeof edges)[number], offset = 0) => {
    const parentLane = nodes
      .filter((node) => node.x === edge.from.x)
      .findIndex((node) => node.course.code === edge.from.course.code);
    const rail = edge.from.x - 18 + (parentLane % 3) * 5 + offset;
    const y1 = edge.from.y + edge.from.height / 2 + offset;
    const y2 = edge.to.y + edge.to.height / 2 + offset;
    return `M ${edge.from.x} ${y1} H ${rail + 4} Q ${rail} ${y1} ${rail} ${
      y1 + 4
    } V ${y2 - 4} Q ${rail} ${y2} ${rail + 4} ${y2} H ${edge.to.x}`;
  };
  const parents = Array.from(
    new Set(edges.map((edge) => edge.from.course.code)),
  );
  if (!nodes.length)
    return (
      <p className="p-sm text-sm text-dark2">
        No matching courses in this group.
      </p>
    );
  return (
    <div className="py-sm" aria-label="Course prerequisite tree">
      <div className="relative w-full" style={{ height }}>
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          aria-hidden="true"
        >
          {edges
            .filter(
              (edge) =>
                !path.connections.has(
                  `${edge.from.course.code}→${edge.to.course.code}`,
                ),
            )
            .map((edge) => (
              <path
                key={`${edge.from.course.code}-${edge.to.course.code}`}
                d={connectionPath(edge)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={edge.alternative ? '4 3' : undefined}
                className={activeCourse ? 'text-light3' : 'text-dark3'}
              />
            ))}
          {routes.flatMap((route, index) =>
            [false, true].map((alternative) => {
              const matching = edges.filter(
                (edge) =>
                  edge.alternative === alternative &&
                  paletteEdgeOnRoute(
                    edge.from.course.code,
                    edge.to.course.code,
                    route.connections,
                    plan,
                  ),
              );
              if (!matching.length) return null;
              const offset =
                (route.colorIndex - (allRoutes.length - 1) / 2) * 4;
              return (
                <path
                  key={`${index}-${alternative}`}
                  d={matching
                    .map((edge) => connectionPath(edge, offset))
                    .join(' ')}
                  fill="none"
                  stroke={routeColor(route.colorIndex)}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={alternative ? '6 4' : undefined}
                />
              );
            }),
          )}
        </svg>
        {nodes.map(({ course, x, y, height: rowHeight }) => (
          <div
            key={course.code}
            onMouseEnter={() => setFocused(course.code)}
            onMouseLeave={() => setFocused(null)}
            onFocus={() => setFocused(course.code)}
            onBlur={() => setFocused(null)}
            title={`${course.title}. ${
              graphDependencies(course).length
                ? `Requires ${prerequisiteLabel(course)}`
                : 'No prerequisites'
            }`}
            style={{
              left: x,
              top: y,
              width: `calc(100% - ${x}px)`,
              height: rowHeight,
            }}
            className={`absolute flex items-center gap-0 rounded-lg border-solid px-sm py-xs text-left transition-colors focus-visible:outline-primary ${
              activeCourse && path.courses.has(course.code)
                ? 'bg-lecture/30'
                : 'bg-white'
            } ${
              course.required
                ? 'border-2 border-primary/60 hover:bg-lecture/20'
                : 'border border-light3 hover:bg-light1'
            }`}
          >
            <button
              type="button"
              onClick={() => onChoose(course)}
              aria-label={`${course.code}: ${
                course.required
                  ? 'Required course'
                  : parents.includes(course.code)
                  ? 'Prerequisite only'
                  : 'Elective'
              }. ${course.title}. ${
                graphDependencies(course).length
                  ? `Requires ${prerequisiteLabel(course)}.`
                  : 'No prerequisites.'
              } ${
                plan[course.code]
                  ? `Planned in ${plan[course.code]}`
                  : onAdd
                  ? 'View course details'
                  : 'Add to plan'
              }`}
              className="flex min-w-0 flex-1 items-center gap-sm bg-transparent p-0 text-left focus-visible:outline-primary"
            >
              <span
                className={`shrink-0 rounded border-solid px-xs py-xs text-sm font-semibold ${
                  course.required
                    ? 'border border-primary text-primary'
                    : 'text-dark2'
                }`}
              >
                {course.code}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-xs leading-relaxed text-dark1`}
                >
                  {course.title}
                </span>
              </span>
            </button>
            {onToggleWishlist && (
              <ActionButton
                type="button"
                label={`${wishlist.includes(course.code) ? 'Remove' : 'Add'} ${
                  course.code
                } ${wishlist.includes(course.code) ? 'from' : 'to'} wishlist`}
                aria-pressed={wishlist.includes(course.code)}
                onClick={() => onToggleWishlist(course.code)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded bg-transparent hover:bg-lecture/30 focus-visible:outline-primary ${
                  wishlist.includes(course.code)
                    ? 'text-primary'
                    : 'text-dark3 hover:text-primary'
                }`}
              >
                <Heart
                  size={15}
                  fill={
                    wishlist.includes(course.code) ? 'currentColor' : 'none'
                  }
                />
              </ActionButton>
            )}
            {onAdd ? (
              <ActionButton
                type="button"
                label={
                  plan[course.code]
                    ? `Go to ${course.code} in ${plan[course.code]}`
                    : `Add ${course.code} to plan`
                }
                onClick={() => onAdd(course)}
                className="flex h-7 w-12 shrink-0 items-center justify-center gap-xs rounded bg-transparent px-xs text-xs text-primary hover:bg-lecture/30 focus-visible:outline-primary"
              >
                {plan[course.code] ? (
                  <>
                    <Check size={12} />
                    {plan[course.code]}
                  </>
                ) : (
                  <PlusCircle size={16} />
                )}
              </ActionButton>
            ) : plan[course.code] ? (
              <span className="flex shrink-0 items-center gap-xs text-xs text-primaryDark">
                <Check size={12} />
                {plan[course.code]}
              </span>
            ) : (
              <PlusCircle size={14} className="shrink-0 text-primary" />
            )}
          </div>
        ))}
      </div>
      <div
        className="mt-sm flex h-10 items-center gap-sm overflow-x-auto"
        aria-label="Prerequisite path colours"
      >
        {routes.some((route) =>
          edges.some((edge) =>
            paletteEdgeOnRoute(
              edge.from.course.code,
              edge.to.course.code,
              route.connections,
              plan,
            ),
          ),
        ) ? (
          routes.map((route) => (
            <span
              key={route.colorIndex}
              className="flex shrink-0 items-center gap-xs whitespace-nowrap text-xs text-dark2"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: routeColor(route.colorIndex) }}
              />
              Path {route.colorIndex + 1}
              {route.label ? ` · ${route.label}` : ''}
            </span>
          ))
        ) : (
          <span className="text-xs leading-relaxed text-dark3">
            Hover over a course to see its prerequisites
          </span>
        )}
      </div>
    </div>
  );
};

export default CourseGraph;
