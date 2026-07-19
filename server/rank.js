// Rank model used by anuraghazra/github-readme-stats (MIT), kept compatible so
// the generated profile card has the same S through C grading semantics.
function exponentialCdf(value) {
  return 1 - 2 ** -value;
}

function logNormalCdf(value) {
  return value / (1 + value);
}

export function calculateRank({ commits, prs, issues, reviews, stars, followers, allCommits = false }) {
  const weights = { commits: 2, prs: 3, issues: 1, reviews: 1, stars: 4, followers: 1 };
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const rank = 1 - (
    weights.commits * exponentialCdf(commits / (allCommits ? 1000 : 250))
    + weights.prs * exponentialCdf(prs / 50)
    + weights.issues * exponentialCdf(issues / 25)
    + weights.reviews * exponentialCdf(reviews / 2)
    + weights.stars * logNormalCdf(stars / 50)
    + weights.followers * logNormalCdf(followers / 10)
  ) / totalWeight;
  const percentile = Math.max(0, Math.min(100, rank * 100));
  const thresholds = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const levels = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
  return { level: levels[thresholds.findIndex((threshold) => percentile <= threshold)] || 'C', percentile };
}
