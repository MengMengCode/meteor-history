import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyHistory, summarize } from '../server/history.js';
import { normalizeSvgOptions, renderHistorySvg } from '../server/svg.js';
import { formatServerDateTime } from '../server/time.js';
import { monotonePath } from '../src/monotonePath.js';

test('buildDailyHistory groups stars by day and keeps cumulative totals', () => {
  const points = buildDailyHistory([
    { starred_at: '2024-02-02T10:00:00Z' },
    { starred_at: '2024-02-02T12:00:00Z' },
    { starred_at: '2024-02-03T12:00:00Z' },
  ], '2024-02-01T00:00:00Z', 3);
  assert.deepEqual(points.slice(0, 3), [
    { date: '2024-02-01', count: 0 },
    { date: '2024-02-02', count: 2 },
    { date: '2024-02-03', count: 3 },
  ]);
  assert.equal(points.at(-1).count, 3);
});

test('summarize returns current total', () => {
  assert.equal(summarize([{ date: '2020-01-01', count: 2 }, { date: new Date().toISOString().slice(0, 10), count: 9 }]).current, 9);
});

test('monotone chart curve stays within bounds when time intervals are uneven', () => {
  const path = monotonePath([
    { x: 104, y: 530 },
    { x: 106.55, y: 272 },
    { x: 109.1, y: 203.2 },
    { x: 435.4, y: 186 },
    { x: 476.19, y: 168.8 },
    { x: 524.63, y: 151.6 },
    { x: 958, y: 151.6 },
  ]);
  const coordinates = [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const yCoordinates = coordinates.filter((_, index) => index % 2 === 1);

  assert.ok(yCoordinates.every((value) => value >= 151.6 && value <= 530));
});

test('SVG renderer escapes repository names and supports dark mode', () => {
  const svg = renderHistorySvg({
    fullName: 'owner/<unsafe>',
    fetchedAt: '2026-07-19T00:00:00Z',
    summary: { current: 2 },
    points: [{ date: '2026-07-18', count: 1 }, { date: '2026-07-19', count: 2 }],
  }, { theme: 'dark', showDots: 'true' });
  assert.match(svg, /owner\/&lt;unsafe&gt;/);
  assert.match(svg, /fill="#0d1117"/);
  assert.match(svg, /font-family:xkcd/);
  assert.ok(svg.includes(`Updated ${formatServerDateTime('2026-07-19T00:00:00Z')}`));
  assert.match(svg, /class="dots"[^>]*>[\s\S]*r="4"/);
  assert.match(svg, />meteor-history\.com<\/text>/);
  assert.doesNotMatch(svg, /owner\/<unsafe>/);
});

test('SVG renderer supports safe Shields-style chart options', () => {
  const svg = renderHistorySvg({
    fullName: 'owner/repo',
    fetchedAt: '2026-07-19T00:00:00Z',
    summary: { current: 2 },
    points: [{ date: '2026-07-18', count: 1 }, { date: '2026-07-19', count: 2 }],
  }, {
    style: 'clean',
    color: '00ff99',
    background: '112233',
    textColor: 'abcdef',
    title: 'Ignored title',
    label: 'Ignored label',
    showDots: 'false',
    lineWidth: '7',
    width: '1200',
    height: '500',
  });

  assert.match(svg, /width="1200" height="500"/);
  assert.match(svg, /fill="#112233"/);
  assert.match(svg, /stroke="#00ff99" stroke-width="7"/);
  assert.match(svg, />Star History<\/text>/);
  assert.match(svg, />owner\/repo<\/text>/);
  assert.doesNotMatch(svg, /Ignored title|Ignored label/);
  assert.match(svg, />meteor-history\.com<\/text>/);
  assert.doesNotMatch(svg, /id="xkcdify"/);
  assert.doesNotMatch(svg, /class="dots"/);
});

test('SVG chart presets render distinct styles and hide point markers by default', () => {
  const history = {
    fullName: 'owner/repo',
    fetchedAt: '2026-07-19T00:00:00Z',
    summary: { current: 2 },
    points: [{ date: '2026-07-18', count: 1 }, { date: '2026-07-19', count: 2 }],
  };

  for (const style of ['xkcd', 'clean', 'minimal', 'bold', 'neon']) {
    assert.match(renderHistorySvg(history, { style }), new RegExp(`data-style="${style}"`));
  }

  assert.doesNotMatch(renderHistorySvg(history), /class="dots"/);
  assert.match(renderHistorySvg(history, { style: 'minimal' }), /stroke-opacity="0.55"/);
  assert.match(renderHistorySvg(history, { style: 'bold' }), /stroke-width="5" stroke-linecap="round"/);
  assert.match(renderHistorySvg(history, { style: 'neon' }), /id="neon-glow"/);
  assert.match(renderHistorySvg(history, { style: 'neon' }), /filter="url\(#neon-glow\)"/);
});

test('SVG auto theme follows the viewer color scheme', () => {
  const svg = renderHistorySvg({
    fullName: 'owner/repo',
    fetchedAt: '2026-07-19T00:00:00Z',
    summary: { current: 2 },
    points: [{ date: '2026-07-18', count: 1 }, { date: '2026-07-19', count: 2 }],
  }, { theme: 'auto' });

  assert.match(svg, /data-theme="auto"/);
  assert.match(svg, /@media\(prefers-color-scheme:dark\)/);
  assert.match(svg, /\.chart-background\{fill:#0d1117\}/);
  assert.match(svg, /\.chart-series\{stroke:#ff6b6b\}/);
});

test('SVG option normalization rejects unsafe values and limits dimensions', () => {
  const options = normalizeSvgOptions({
    color: 'red" onload="alert(1)',
    background: 'url(javascript:alert(1))',
    width: '99999',
    height: '-1',
    lineWidth: '100',
  });

  assert.equal(options.line, '#dd4528');
  assert.equal(options.background, '#ffffff');
  assert.equal(options.width, 1400);
  assert.equal(options.height, 400);
  assert.equal(options.lineWidth, 8);
  assert.equal(options.style, 'xkcd');
  assert.equal(options.showDots, false);
});
