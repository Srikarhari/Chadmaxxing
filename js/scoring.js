// === FILE: Chadmaxxing/js/scoring.js ===
// Weighted scoring engine with Critical Mode breakdown

import { gaussianScore, rangeScore, weightedAverage, clamp } from './utils.js';

// ── Category definitions with weights ────────────────────────────

export const CATEGORIES = {
  symmetry: {
    name: 'Symmetry',
    weight: 0.25,
    description: 'Bilateral balance of facial features',
    type: 'reliable'
  },
  proportions: {
    name: 'Proportions',
    weight: 0.25,
    description: 'Facial thirds and fifths balance',
    type: 'reliable'
  },
  featureRatios: {
    name: 'Feature Ratios',
    weight: 0.20,
    description: 'Eye spacing, nose width, mouth width relative to face',
    type: 'reliable'
  },
  faceShape: {
    name: 'Face Shape',
    weight: 0.15,
    description: 'Face shape classification and harmony (heuristic)',
    type: 'heuristic'
  },
  angularFeatures: {
    name: 'Angular Features',
    weight: 0.15,
    description: 'Canthal tilt, jaw angle, chin (heuristic interpretation)',
    type: 'heuristic'
  }
};

// ── Score individual metrics ─────────────────────────────────────

function scoreSymmetry(metrics) {
  return metrics.symmetry.score;
}

function scoreProportions(metrics) {
  const thirdsScore = metrics.thirds.score;
  const fifthsScore = metrics.fifths.score;
  return weightedAverage([
    { value: thirdsScore, weight: 0.6 },
    { value: fifthsScore, weight: 0.4 }
  ]);
}

function scoreFeatureRatios(metrics) {
  const eye = metrics.eyeMetrics;
  const nose = metrics.noseMetrics;
  const mouth = metrics.mouthMetrics;
  const face = metrics.faceRatio;

  // Eye spacing ratio: ideal ~1.0
  const eyeSpacingScore = gaussianScore(eye.spacingRatio, 1.0, 0.15);

  // Nose-to-face ratio: ideal ~0.25
  const noseRatioScore = gaussianScore(nose.noseToFaceRatio, 0.25, 0.04);

  // Mouth-to-nose ratio: ideal ~1.5
  const mouthNoseScore = gaussianScore(mouth.mouthToNoseRatio, 1.5, 0.25);

  // Lip ratio: ideal ~0.5 (1:2 upper:lower)
  const lipScore = gaussianScore(mouth.lipRatio, 0.5, 0.15);

  // Face length/width ratio: ideal 1.3-1.4
  const faceRatioScore = rangeScore(face.ratio, 1.3, 1.4, 0.15);

  return weightedAverage([
    { value: eyeSpacingScore, weight: 0.25 },
    { value: noseRatioScore, weight: 0.20 },
    { value: mouthNoseScore, weight: 0.20 },
    { value: lipScore, weight: 0.15 },
    { value: faceRatioScore, weight: 0.20 }
  ]);
}

function scoreFaceShape(metrics) {
  // Oval is conventionally considered the most "harmonious" shape
  // But we score based on confidence in classification and ratio consistency
  const shape = metrics.faceShape;
  const confidence = shape.confidence;

  // Higher confidence = face clearly fits a category = more defined structure
  const clarityScore = clamp(confidence * 1.2, 0, 100);

  // Bonus for oval (conventional preference, acknowledge as heuristic)
  const ovalBonus = shape.shape === 'Oval' ? 10 : 0;

  return clamp(clarityScore + ovalBonus, 0, 100);
}

function scoreAngularFeatures(metrics) {
  const eye = metrics.eyeMetrics;
  const jaw = metrics.jawMetrics;

  // Canthal tilt: ideal +4 to +8 degrees (heuristic preference)
  const canthalScore = rangeScore(eye.canthalTilt, 4, 8, 4);

  // Gonial angle: ideal 120-130 degrees (heuristic, approximate from landmarks)
  const gonialScore = rangeScore(jaw.gonialAngle, 120, 130, 10);

  // Bigonial-bizygomatic: moderate range preferred (~0.75-0.85)
  const jawRatioScore = rangeScore(jaw.bigonialBizygomatic, 0.75, 0.85, 0.08);

  return weightedAverage([
    { value: canthalScore, weight: 0.35 },
    { value: gonialScore, weight: 0.35 },
    { value: jawRatioScore, weight: 0.30 }
  ]);
}

// ── Compute all scores ───────────────────────────────────────────

export function computeScores(metrics) {
  const categoryScores = {
    symmetry: Math.round(scoreSymmetry(metrics)),
    proportions: Math.round(scoreProportions(metrics)),
    featureRatios: Math.round(scoreFeatureRatios(metrics)),
    faceShape: Math.round(scoreFaceShape(metrics)),
    angularFeatures: Math.round(scoreAngularFeatures(metrics))
  };

  // Harmony score: weighted average
  const harmony = Math.round(weightedAverage([
    { value: categoryScores.symmetry, weight: CATEGORIES.symmetry.weight },
    { value: categoryScores.proportions, weight: CATEGORIES.proportions.weight },
    { value: categoryScores.featureRatios, weight: CATEGORIES.featureRatios.weight },
    { value: categoryScores.faceShape, weight: CATEGORIES.faceShape.weight },
    { value: categoryScores.angularFeatures, weight: CATEGORIES.angularFeatures.weight }
  ]));

  return { categoryScores, harmony };
}

// ── Critical Mode: detailed weight breakdown ─────────────────────

export function getCriticalBreakdown(metrics, scores) {
  const eye = metrics.eyeMetrics;
  const nose = metrics.noseMetrics;
  const mouth = metrics.mouthMetrics;
  const face = metrics.faceRatio;
  const jaw = metrics.jawMetrics;

  return {
    categories: Object.entries(CATEGORIES).map(([key, cat]) => ({
      key,
      name: cat.name,
      weight: cat.weight,
      weightPct: Math.round(cat.weight * 100) + '%',
      score: scores.categoryScores[key],
      type: cat.type,
      contribution: Math.round(scores.categoryScores[key] * cat.weight)
    })),
    subMetrics: [
      { name: 'Eye Spacing Ratio', value: eye.spacingRatio, ideal: '1.0', unit: '', type: 'reliable' },
      { name: 'Nose-to-Face Ratio', value: nose.noseToFaceRatio, ideal: '0.25', unit: '', type: 'reliable' },
      { name: 'Mouth-to-Nose Ratio', value: mouth.mouthToNoseRatio, ideal: '1.5', unit: '', type: 'reliable' },
      { name: 'Lip Ratio (upper/lower)', value: mouth.lipRatio, ideal: '0.5', unit: '', type: 'reliable' },
      { name: 'Face Length/Width', value: face.ratio, ideal: '1.3–1.4', unit: '', type: 'reliable' },
      { name: 'Canthal Tilt', value: eye.canthalTilt, ideal: '+4° to +8°', unit: '°', type: 'heuristic' },
      { name: 'Gonial Angle', value: jaw.gonialAngle, ideal: '120°–130°', unit: '°', type: 'heuristic' },
      { name: 'Jaw-to-Face Ratio', value: jaw.bigonialBizygomatic, ideal: '0.75–0.85', unit: '', type: 'heuristic' },
      { name: 'Facial Thirds (upper)', value: metrics.thirds.upper + '%', ideal: '33.3%', unit: '', type: 'reliable' },
      { name: 'Facial Thirds (middle)', value: metrics.thirds.middle + '%', ideal: '33.3%', unit: '', type: 'reliable' },
      { name: 'Facial Thirds (lower)', value: metrics.thirds.lower + '%', ideal: '33.3%', unit: '', type: 'reliable' }
    ],
    totalHarmony: scores.harmony,
    disclaimer: 'Scores reflect geometric ratios compared to published population averages. They are not a scientific measure of attractiveness. Metrics marked "heuristic" are approximate and culturally influenced.'
  };
}

// ── Label helpers ────────────────────────────────────────────────

export function harmonyLabel(score) {
  if (score >= 85) return 'Excellent Harmony';
  if (score >= 70) return 'Good Harmony';
  if (score >= 55) return 'Moderate Harmony';
  if (score >= 40) return 'Below Average';
  return 'Low Harmony';
}

export function scoreColor(score) {
  if (score >= 80) return '#4ade80'; // green
  if (score >= 60) return '#22d3ee'; // teal
  if (score >= 40) return '#facc15'; // yellow
  return '#fb923c';                  // orange
}
