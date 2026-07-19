export function buildDailyHistory(stars, createdAt, totalCount = stars.length) {
  const daily = new Map();
  const ordered = stars
    .map((star) => new Date(star.starred_at))
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => a - b);

  for (let i = 0; i < ordered.length; i += 1) {
    daily.set(ordered[i].toISOString().slice(0, 10), i + 1);
  }

  const points = [];
  if (createdAt) points.push({ date: new Date(createdAt).toISOString().slice(0, 10), count: 0 });
  for (const [date, count] of daily) {
    if (points.at(-1)?.date === date) points[points.length - 1] = { date, count };
    else points.push({ date, count });
  }

  const today = new Date().toISOString().slice(0, 10);
  const finalCount = Math.max(totalCount, ordered.length);
  if (points.at(-1)?.date === today) points[points.length - 1].count = finalCount;
  else points.push({ date: today, count: finalCount });
  return points;
}

export function summarize(points) {
  const current = points.at(-1)?.count || 0;
  const now = Date.now();
  const countSince = (days) => {
    const cutoff = now - days * 86_400_000;
    let previous = 0;
    for (const point of points) {
      if (new Date(point.date).getTime() <= cutoff) previous = point.count;
      else break;
    }
    return current - previous;
  };
  return { current, last30Days: countSince(30), last365Days: countSince(365) };
}
