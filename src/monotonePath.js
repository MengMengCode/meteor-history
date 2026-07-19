function endpointTangent(hereWidth, nextWidth, hereSlope, nextSlope) {
  let tangent = ((2 * hereWidth + nextWidth) * hereSlope - hereWidth * nextSlope) / (hereWidth + nextWidth);
  if (tangent * hereSlope <= 0) return 0;
  if (hereSlope * nextSlope < 0 && Math.abs(tangent) > Math.abs(3 * hereSlope)) tangent = 3 * hereSlope;
  return tangent;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// A PCHIP-style monotone curve. Weighted harmonic tangents prevent sparse
// time intervals from sending Bezier control points outside the chart.
export function monotonePath(points) {
  if (points.length < 2) return points.length ? `M ${points[0].x} ${points[0].y}` : '';

  const widths = points.slice(0, -1).map((point, index) => Math.max(Number.EPSILON, points[index + 1].x - point.x));
  const slopes = widths.map((width, index) => (points[index + 1].y - points[index].y) / width);
  const tangents = Array(points.length).fill(0);

  if (points.length === 2) {
    tangents[0] = slopes[0];
    tangents[1] = slopes[0];
  } else {
    tangents[0] = endpointTangent(widths[0], widths[1], slopes[0], slopes[1]);
    tangents[tangents.length - 1] = endpointTangent(
      widths.at(-1),
      widths.at(-2),
      slopes.at(-1),
      slopes.at(-2),
    );

    for (let index = 1; index < points.length - 1; index += 1) {
      const before = slopes[index - 1];
      const after = slopes[index];
      if (before * after <= 0) continue;
      const beforeWidth = widths[index - 1];
      const afterWidth = widths[index];
      const beforeWeight = 2 * afterWidth + beforeWidth;
      const afterWeight = afterWidth + 2 * beforeWidth;
      tangents[index] = (beforeWeight + afterWeight) / (beforeWeight / before + afterWeight / after);
    }
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const width = widths[index];
    const minY = Math.min(current.y, next.y);
    const maxY = Math.max(current.y, next.y);
    const firstControlY = clamp(current.y + tangents[index] * width / 3, minY, maxY);
    const secondControlY = clamp(next.y - tangents[index + 1] * width / 3, minY, maxY);
    path += ` C ${current.x + width / 3} ${firstControlY}, ${next.x - width / 3} ${secondControlY}, ${next.x} ${next.y}`;
  }
  return path;
}
