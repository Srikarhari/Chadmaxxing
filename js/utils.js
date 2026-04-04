// === FILE: Chadmaxxing/js/utils.js ===
// Math primitives and helpers used across the app

export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist3D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2
  };
}

export function angleDeg(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export function angleAtVertex(a, vertex, b) {
  const v1 = { x: a.x - vertex.x, y: a.y - vertex.y };
  const v2 = { x: b.x - vertex.x, y: b.y - vertex.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const cross = v1.x * v2.y - v1.y * v2.x;
  return Math.abs(Math.atan2(cross, dot) * (180 / Math.PI));
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function normalize(val, min, max) {
  if (max === min) return 0;
  return (val - min) / (max - min);
}

export function gaussianScore(value, ideal, sigma) {
  const dev = value - ideal;
  return 100 * Math.exp(-(dev * dev) / (2 * sigma * sigma));
}

export function rangeScore(value, idealMin, idealMax, sigma) {
  if (value >= idealMin && value <= idealMax) return 100;
  const dev = value < idealMin ? idealMin - value : value - idealMax;
  return 100 * Math.exp(-(dev * dev) / (2 * sigma * sigma));
}

export function weightedAverage(items) {
  let totalWeight = 0;
  let totalValue = 0;
  for (const { value, weight } of items) {
    totalValue += value * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? totalValue / totalWeight : 0;
}

export function stdDev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) * (v - mean));
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / values.length);
}

export function roundTo(val, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round(val * f) / f;
}
