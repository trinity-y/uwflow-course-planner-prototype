import snapshot from './elective-ratings.json' with { type: 'json' };

export const ratings = snapshot.courses;

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
