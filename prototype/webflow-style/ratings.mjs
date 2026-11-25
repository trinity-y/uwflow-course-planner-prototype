import snapshot from './elective-ratings.json' with { type: 'json' };
import { seasons, termLabel, termOrder } from './calendar.mjs';

export const ratings = snapshot.courses;
export const offeringHistory = snapshot.offeringHistory;
const coverageStart = termOrder(offeringHistory.from);
const coverageEnd = termOrder(offeringHistory.publishedThrough);
const observedEnd = termOrder(offeringHistory.observedThrough);

// Waterloo timetable IDs encode the year since 1900 and the term's starting month.
function calendarTerm(id) {
  const season = seasons[(id % 10 - 1) / 4];
  return `${1900 + Math.floor(id / 10)}-${season.toLowerCase()}`;
}

export const offerings = new Map(Object.entries(ratings).map(([code, data]) => {
  const terms = data.offeredTerms.map(calendarTerm);
  const history = terms.filter((term) => termOrder(term) <= observedEnd);
  const upcoming = terms.slice(history.length);
  const year = history.at(-1).slice(0, 4);
  const expected = seasons.filter((season) => history.includes(`${year}-${season.toLowerCase()}`));
  return [code, { history, upcoming, listed: new Set(terms), year, expected }];
}));

export function offeringStatus(code, term) {
  const course = offerings.get(code);
  if (!course || !term) return 'unknown';
  if (course.listed.has(term)) return 'listed';
  const order = termOrder(term);
  if (order === undefined || order < coverageStart) return 'unknown';
  if (order <= coverageEnd) return 'unlisted';
  return course.expected.some((season) => season.toLowerCase() === term.slice(5)) ? 'projected' : 'off-season';
}

export function allowsOffering(code, term) {
  const status = offeringStatus(code, term);
  return status !== 'unlisted' && status !== 'off-season';
}

export function offeringWarning(code, term) {
  const status = offeringStatus(code, term);
  if (status === 'unlisted') return `No section is listed for ${termLabel(term)}.`;
  if (status === 'off-season') {
    const { year, expected } = offerings.get(code);
    return `${termLabel(term)} is outside the projected seasons (${expected.join(', ')}, based on ${year}).`;
  }
  return '';
}

export function byRatings(a, b) {
  return (ratings[b]?.filled_count ?? 0) - (ratings[a]?.filled_count ?? 0)
    || (ratings[b]?.liked ?? 0) - (ratings[a]?.liked ?? 0);
}

export function ratingLabel(code) {
  const rating = ratings[code];
  if (!rating?.filled_count) return '';
  const liked = rating.liked == null ? '' : ` · ${Math.round(100 * rating.liked)}% liked`;
  return `${rating.filled_count} ratings${liked}`;
}
