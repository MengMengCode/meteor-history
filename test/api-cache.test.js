import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';

test('repository and history API routes only read JSON cache data', async (t) => {
  const repository = { owner: 'owner', repo: 'repo', fullName: 'owner/repo' };
  const history = { ...repository, fetchedAt: '2026-07-19T00:00:00Z', points: [], summary: { current: 0 } };
  const cache = {
    entries: async () => [history],
    getRepositories: async () => ({ fetchedAt: history.fetchedAt, profile: { login: 'owner', bio: 'Actual GitHub bio' }, repositories: [repository] }),
    get: async () => ({ ...history, stale: false }),
  };
  const sync = { snapshot: () => ({ running: false }) };
  const config = {
    token: 'configured',
    cacheTtlMs: 360 * 60_000,
    refreshIntervalMs: 360 * 60_000,
    publicBaseUrl: '',
    distDir: 'missing-dist-for-api-test',
  };
  const { app } = createApp({ config, cache, sync });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const repositories = await fetch(`${baseUrl}/api/repositories`).then((response) => response.json());
  const cachedHistory = await fetch(`${baseUrl}/api/history/owner/repo`).then((response) => response.json());

  assert.deepEqual(repositories.repositories, [repository]);
  assert.equal(repositories.profile.bio, 'Actual GitHub bio');
  assert.equal(cachedHistory.source, 'json-cache');
  assert.equal(cachedHistory.fullName, 'owner/repo');
  assert.equal(typeof cachedHistory.serverTimeZone, 'string');
  assert.match(cachedHistory.updatedAtLabel, /2026/);
});

test('history API reports pending when the scheduler has not written JSON yet', async (t) => {
  const { app } = createApp({
    config: { token: 'configured', cacheTtlMs: 1, refreshIntervalMs: 1, publicBaseUrl: '', distDir: 'missing' },
    cache: { entries: async () => [], getRepositories: async () => ({ repositories: [{ owner: 'owner', repo: 'repo' }] }), get: async () => null },
    sync: { snapshot: () => ({ running: true }) },
  });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/history/owner/repo`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.code, 'HISTORY_PENDING');
});
