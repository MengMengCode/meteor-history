export function shouldStartBootstrap(cachedRepositories, syncState) {
  return !cachedRepositories && (!syncState || syncState.phase === 'waiting-for-scheduled-sync');
}
