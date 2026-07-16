export interface Point {
  x: number;
  y: number;
}

/** Pearson correlation coefficient r for paired samples. Null when undefined (n<3 or zero variance). */
export function pearsonR(points: Point[]): number | null {
  const n = points.length;
  if (n < 3) return null;

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;
  for (const p of points) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  if (varX === 0 || varY === 0) return null;
  return cov / Math.sqrt(varX * varY);
}

/** Least-squares line y = slope·x + intercept. Null when undefined. */
export function linearRegression(
  points: Point[]
): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;

  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  let cov = 0;
  let varX = 0;
  for (const p of points) {
    cov += (p.x - meanX) * (p.y - meanY);
    varX += (p.x - meanX) ** 2;
  }
  if (varX === 0) return null;

  const slope = cov / varX;
  return { slope, intercept: meanY - slope * meanX };
}

/** Human reading of r, for the stat caption. */
export function describeR(r: number): string {
  const abs = Math.abs(r);
  const strength =
    abs >= 0.7 ? "strong" : abs >= 0.4 ? "moderate" : abs >= 0.2 ? "weak" : "negligible";
  const direction = r >= 0 ? "positive" : "negative";
  return `${strength} ${direction} correlation`;
}
