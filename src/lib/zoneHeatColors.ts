/**
 * Smooth red (low score) → electric green (#00FF9D) for zone visualization.
 * `score` is expected roughly in [5, 10]; clamps for safety.
 */
export function zoneHeatRgba(score: number, min = 5, max = 10) {
  const t = Math.min(1, Math.max(0, (score - min) / (max - min)));
  const rLow = 239;
  const gLow = 68;
  const bLow = 68;
  const rHi = 0;
  const gHi = 255;
  const bHi = 157;
  const r = Math.round(rLow * (1 - t) + rHi * t);
  const g = Math.round(gLow * (1 - t) + gHi * t);
  const b = Math.round(bLow * (1 - t) + bHi * t);
  return {
    fill: `rgba(${r},${g},${b},0.22)`,
    stroke: `rgba(${r},${g},${b},0.92)`,
  };
}
