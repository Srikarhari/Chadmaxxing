// === FILE: Chadmaxxing/js/metrics.js ===
// All facial metric computations in one file

import { dist, angleDeg, angleAtVertex, midpoint, stdDev, clamp } from './utils.js';
import { LM, BILATERAL_PAIRS, pt, getMidlineAxis, getIPD } from './landmarks.js';

// ── Symmetry ─────────────────────────────────────────────────────

export function computeSymmetry(landmarks) {
  const midline = getMidlineAxis(landmarks);
  const ipd = getIPD(landmarks);
  if (ipd < 1) return { score: 0, pairs: [], label: 'Unable to compute' };

  // Midline direction vector
  const mx = midline.bottom.x - midline.top.x;
  const my = midline.bottom.y - midline.top.y;
  const mLen = Math.sqrt(mx * mx + my * my) || 1;
  const nx = -my / mLen; // normal to midline (perpendicular)
  const ny = mx / mLen;

  const pairResults = [];
  let totalDev = 0;

  for (const pair of BILATERAL_PAIRS) {
    const L = pt(landmarks, pair.left);
    const R = pt(landmarks, pair.right);

    // Distance from each point to the midline (signed, via normal projection)
    const lProj = (L.x - midline.top.x) * nx + (L.y - midline.top.y) * ny;
    const rProj = (R.x - midline.top.x) * nx + (R.y - midline.top.y) * ny;

    // Perfect symmetry: |lProj| == |rProj| (opposite signs)
    const deviation = Math.abs(Math.abs(lProj) - Math.abs(rProj)) / ipd;
    const pairScore = clamp(100 - deviation * 500, 0, 100);

    pairResults.push({ name: pair.name, score: pairScore, deviation });
    totalDev += deviation;
  }

  const avgScore = pairResults.reduce((s, p) => s + p.score, 0) / pairResults.length;

  let label;
  if (avgScore >= 85) label = 'Excellent symmetry';
  else if (avgScore >= 70) label = 'Good symmetry';
  else if (avgScore >= 55) label = 'Moderate symmetry';
  else label = 'Notable asymmetry';

  return { score: Math.round(avgScore), pairs: pairResults, label };
}

// ── Facial Thirds (Proportions) ──────────────────────────────────

export function computeThirds(landmarks) {
  // NOTE: Upper third uses top of detected face contour (landmark 10),
  // NOT the true hairline, which is not detectable from landmarks alone.
  const foreheadTop = pt(landmarks, LM.FOREHEAD_TOP);
  const nasion = pt(landmarks, LM.NASION);
  const subnasale = pt(landmarks, LM.SUBNASALE);
  const chin = pt(landmarks, LM.CHIN);

  const upper = dist(foreheadTop, nasion);
  const middle = dist(nasion, subnasale);
  const lower = dist(subnasale, chin);
  const total = upper + middle + lower;

  if (total < 1) return { score: 0, upper: 0, middle: 0, lower: 0, label: 'Unable to compute' };

  const upperPct = (upper / total) * 100;
  const middlePct = (middle / total) * 100;
  const lowerPct = (lower / total) * 100;

  // Ideal is 33.3% each. Score based on total deviation.
  const totalDeviation = Math.abs(upperPct - 33.3) + Math.abs(middlePct - 33.3) + Math.abs(lowerPct - 33.3);
  // Max possible deviation is ~133 (one third = 100%, others = 0%)
  // Reasonable range: 0-30 deviation
  const score = clamp(100 - totalDeviation * 3, 0, 100);

  let label;
  if (score >= 85) label = 'Well-balanced facial thirds';
  else if (score >= 65) label = 'Slightly uneven proportions';
  else label = 'Uneven facial thirds';

  return {
    score: Math.round(score),
    upper: Math.round(upperPct * 10) / 10,
    middle: Math.round(middlePct * 10) / 10,
    lower: Math.round(lowerPct * 10) / 10,
    label,
    note: 'Upper third approximated from detected face contour, not true hairline.'
  };
}

// ── Facial Fifths (Horizontal Proportions) ───────────────────────

export function computeFifths(landmarks) {
  const leftFace = pt(landmarks, LM.LEFT_CHEEKBONE);
  const leftEyeOuter = pt(landmarks, LM.LEFT_EYE_OUTER);
  const leftEyeInner = pt(landmarks, LM.LEFT_EYE_INNER);
  const rightEyeInner = pt(landmarks, LM.RIGHT_EYE_INNER);
  const rightEyeOuter = pt(landmarks, LM.RIGHT_EYE_OUTER);
  const rightFace = pt(landmarks, LM.RIGHT_CHEEKBONE);

  const fifths = [
    dist(leftFace, leftEyeOuter),
    dist(leftEyeOuter, leftEyeInner),
    dist(leftEyeInner, rightEyeInner),
    dist(rightEyeInner, rightEyeOuter),
    dist(rightEyeOuter, rightFace)
  ];

  const sd = stdDev(fifths);
  const mean = fifths.reduce((a, b) => a + b, 0) / fifths.length;
  const cv = mean > 0 ? sd / mean : 1; // coefficient of variation

  // CV of 0 = perfect, CV > 0.3 = very uneven
  const score = clamp(100 - cv * 300, 0, 100);

  return { score: Math.round(score), fifths: fifths.map(f => Math.round(f * 10) / 10) };
}

// ── Face Shape Classification ────────────────────────────────────

export function computeFaceShape(landmarks) {
  const faceLength = dist(pt(landmarks, LM.FOREHEAD_TOP), pt(landmarks, LM.CHIN));
  const faceWidth = dist(pt(landmarks, LM.LEFT_CHEEKBONE), pt(landmarks, LM.RIGHT_CHEEKBONE));
  const jawWidth = dist(pt(landmarks, LM.LEFT_JAW_ANGLE), pt(landmarks, LM.RIGHT_JAW_ANGLE));
  const foreheadWidth = dist(pt(landmarks, LM.LEFT_FOREHEAD), pt(landmarks, LM.RIGHT_FOREHEAD));

  if (faceWidth < 1) {
    return { shape: 'Unknown', confidence: 0, ratios: {}, label: 'Unable to compute' };
  }

  const lengthToWidth = faceLength / faceWidth;
  const jawToFace = jawWidth / faceWidth;
  const foreheadToJaw = foreheadWidth / (jawWidth || 1);

  const shapes = [
    { name: 'Oval',    score: scoreOval(lengthToWidth, jawToFace, foreheadToJaw) },
    { name: 'Round',   score: scoreRound(lengthToWidth, jawToFace, foreheadToJaw) },
    { name: 'Square',  score: scoreSquare(lengthToWidth, jawToFace, foreheadToJaw) },
    { name: 'Heart',   score: scoreHeart(lengthToWidth, jawToFace, foreheadToJaw) },
    { name: 'Oblong',  score: scoreOblong(lengthToWidth, jawToFace, foreheadToJaw) },
    { name: 'Diamond', score: scoreDiamond(lengthToWidth, jawToFace, foreheadToJaw) }
  ];

  shapes.sort((a, b) => b.score - a.score);
  const best = shapes[0];
  const totalScore = shapes.reduce((s, sh) => s + sh.score, 0) || 1;
  const confidence = Math.round((best.score / totalScore) * 100);

  return {
    shape: best.name,
    confidence,
    allShapes: shapes,
    ratios: {
      lengthToWidth: Math.round(lengthToWidth * 100) / 100,
      jawToFace: Math.round(jawToFace * 100) / 100,
      foreheadToJaw: Math.round(foreheadToJaw * 100) / 100
    },
    label: `${best.name} (${confidence}% confidence)`
  };
}

// Shape scoring helpers — higher = better match
function scoreOval(lw, jf, fj) {
  let s = 0;
  if (lw >= 1.15 && lw <= 1.35) s += 40; else s += Math.max(0, 40 - Math.abs(lw - 1.25) * 80);
  if (jf >= 0.70 && jf <= 0.85) s += 30; else s += Math.max(0, 30 - Math.abs(jf - 0.775) * 100);
  if (fj >= 1.0) s += 30; else s += Math.max(0, 30 - (1.0 - fj) * 100);
  return Math.max(0, s);
}
function scoreRound(lw, jf, fj) {
  let s = 0;
  if (lw < 1.15) s += 40; else s += Math.max(0, 40 - (lw - 1.15) * 80);
  if (jf > 0.80) s += 30; else s += Math.max(0, 30 - (0.80 - jf) * 100);
  if (fj >= 0.90 && fj <= 1.10) s += 30; else s += Math.max(0, 30 - Math.abs(fj - 1.0) * 100);
  return Math.max(0, s);
}
function scoreSquare(lw, jf, fj) {
  let s = 0;
  if (lw < 1.15) s += 35; else s += Math.max(0, 35 - (lw - 1.15) * 80);
  if (jf > 0.85) s += 35; else s += Math.max(0, 35 - (0.85 - jf) * 100);
  if (fj >= 0.90 && fj <= 1.10) s += 30; else s += Math.max(0, 30 - Math.abs(fj - 1.0) * 100);
  return Math.max(0, s);
}
function scoreHeart(lw, jf, fj) {
  let s = 0;
  if (lw >= 1.10 && lw <= 1.35) s += 30; else s += Math.max(0, 30 - Math.abs(lw - 1.225) * 60);
  if (jf < 0.75) s += 35; else s += Math.max(0, 35 - (jf - 0.75) * 100);
  if (fj > 1.15) s += 35; else s += Math.max(0, 35 - (1.15 - fj) * 100);
  return Math.max(0, s);
}
function scoreOblong(lw, jf, fj) {
  let s = 0;
  if (lw > 1.35) s += 50; else s += Math.max(0, 50 - (1.35 - lw) * 100);
  if (jf >= 0.65 && jf <= 0.80) s += 25; else s += Math.max(0, 25 - Math.abs(jf - 0.725) * 80);
  s += 25; // forehead/jaw ratio less discriminative for oblong
  return Math.max(0, s);
}
function scoreDiamond(lw, jf, fj) {
  let s = 0;
  if (lw >= 1.15 && lw <= 1.35) s += 30; else s += Math.max(0, 30 - Math.abs(lw - 1.25) * 60);
  if (jf < 0.75) s += 35; else s += Math.max(0, 35 - (jf - 0.75) * 100);
  if (fj < 0.90) s += 35; else s += Math.max(0, 35 - (fj - 0.90) * 100);
  return Math.max(0, s);
}

// ── Eye Metrics ──────────────────────────────────────────────────

export function computeEyeMetrics(landmarks) {
  const ipd = getIPD(landmarks);

  // Canthal tilt
  const leftTilt = angleDeg(
    pt(landmarks, LM.LEFT_EYE_INNER),
    pt(landmarks, LM.LEFT_EYE_OUTER)
  );
  const rightTilt = -angleDeg(
    pt(landmarks, LM.RIGHT_EYE_INNER),
    pt(landmarks, LM.RIGHT_EYE_OUTER)
  );
  const avgCanthalTilt = (leftTilt + rightTilt) / 2;

  // Palpebral fissure (eye opening)
  const leftWidth = dist(pt(landmarks, LM.LEFT_EYE_OUTER), pt(landmarks, LM.LEFT_EYE_INNER));
  const leftHeight = dist(pt(landmarks, LM.LEFT_EYE_TOP), pt(landmarks, LM.LEFT_EYE_BOTTOM));
  const rightWidth = dist(pt(landmarks, LM.RIGHT_EYE_OUTER), pt(landmarks, LM.RIGHT_EYE_INNER));
  const rightHeight = dist(pt(landmarks, LM.RIGHT_EYE_TOP), pt(landmarks, LM.RIGHT_EYE_BOTTOM));

  const avgEyeWidth = (leftWidth + rightWidth) / 2;
  const avgEyeHeight = (leftHeight + rightHeight) / 2;
  const eyeWHR = avgEyeWidth / (avgEyeHeight || 1);

  // Eye spacing ratio: inter-canthal / eye width
  const interCanthal = dist(pt(landmarks, LM.LEFT_EYE_INNER), pt(landmarks, LM.RIGHT_EYE_INNER));
  const spacingRatio = interCanthal / (avgEyeWidth || 1);

  return {
    canthalTilt: Math.round(avgCanthalTilt * 10) / 10,
    canthalTiltLabel: avgCanthalTilt > 2 ? 'Positive (upward)' :
                      avgCanthalTilt < -2 ? 'Negative (downward)' : 'Neutral',
    eyeWHR: Math.round(eyeWHR * 100) / 100,
    spacingRatio: Math.round(spacingRatio * 100) / 100,
    spacingLabel: spacingRatio > 1.1 ? 'Wide-set' :
                  spacingRatio < 0.9 ? 'Close-set' : 'Average spacing',
    ipd: Math.round(ipd * 10) / 10
  };
}

// ── Nose Metrics ─────────────────────────────────────────────────

export function computeNoseMetrics(landmarks) {
  const noseWidth = dist(pt(landmarks, LM.LEFT_NOSTRIL), pt(landmarks, LM.RIGHT_NOSTRIL));
  const noseLength = dist(pt(landmarks, LM.NASION), pt(landmarks, LM.NOSE_TIP));
  const faceWidth = dist(pt(landmarks, LM.LEFT_CHEEKBONE), pt(landmarks, LM.RIGHT_CHEEKBONE));

  const noseToFaceRatio = faceWidth > 0 ? noseWidth / faceWidth : 0;
  const nasalIndex = noseLength > 0 ? (noseWidth / noseLength) * 100 : 0;

  return {
    noseWidth: Math.round(noseWidth * 10) / 10,
    noseLength: Math.round(noseLength * 10) / 10,
    noseToFaceRatio: Math.round(noseToFaceRatio * 1000) / 1000,
    nasalIndex: Math.round(nasalIndex * 10) / 10,
    nasalLabel: nasalIndex < 70 ? 'Leptorrhine (narrow)' :
                nasalIndex > 85 ? 'Platyrrhine (wide)' : 'Mesorrhine (medium)'
  };
}

// ── Mouth Metrics ────────────────────────────────────────────────

export function computeMouthMetrics(landmarks) {
  const mouthWidth = dist(pt(landmarks, LM.MOUTH_LEFT), pt(landmarks, LM.MOUTH_RIGHT));
  const upperLipHeight = dist(pt(landmarks, LM.UPPER_LIP_TOP), pt(landmarks, LM.UPPER_LIP_BOTTOM));
  const lowerLipHeight = dist(pt(landmarks, LM.LOWER_LIP_TOP), pt(landmarks, LM.LOWER_LIP_BOTTOM));
  const noseWidth = dist(pt(landmarks, LM.LEFT_NOSTRIL), pt(landmarks, LM.RIGHT_NOSTRIL));

  const lipRatio = lowerLipHeight > 0 ? upperLipHeight / lowerLipHeight : 0;
  const mouthToNoseRatio = noseWidth > 0 ? mouthWidth / noseWidth : 0;

  return {
    mouthWidth: Math.round(mouthWidth * 10) / 10,
    upperLipHeight: Math.round(upperLipHeight * 10) / 10,
    lowerLipHeight: Math.round(lowerLipHeight * 10) / 10,
    lipRatio: Math.round(lipRatio * 100) / 100,
    lipLabel: lipRatio >= 0.4 && lipRatio <= 0.6 ? 'Balanced lip ratio' :
              lipRatio < 0.4 ? 'Thinner upper lip' : 'Fuller upper lip',
    mouthToNoseRatio: Math.round(mouthToNoseRatio * 100) / 100,
    mouthNoseLabel: mouthToNoseRatio >= 1.3 && mouthToNoseRatio <= 1.7 ? 'Ideal range' :
                    mouthToNoseRatio < 1.3 ? 'Narrow relative to nose' : 'Wide relative to nose'
  };
}

// ── Jawline / Cheekbone / Chin Metrics ───────────────────────────

export function computeJawMetrics(landmarks) {
  const jawWidth = dist(pt(landmarks, LM.LEFT_JAW_ANGLE), pt(landmarks, LM.RIGHT_JAW_ANGLE));
  const faceWidth = dist(pt(landmarks, LM.LEFT_CHEEKBONE), pt(landmarks, LM.RIGHT_CHEEKBONE));
  const bigonialBizygomatic = faceWidth > 0 ? jawWidth / faceWidth : 0;

  // Gonial angle approximation (heuristic — sensitive to landmark noise)
  const leftGonial = angleAtVertex(
    pt(landmarks, LM.LEFT_JAW_MID),
    pt(landmarks, LM.LEFT_JAW_ANGLE),
    pt(landmarks, LM.LEFT_LOWER_JAW)
  );
  const rightGonial = angleAtVertex(
    pt(landmarks, LM.RIGHT_JAW_MID),
    pt(landmarks, LM.RIGHT_JAW_ANGLE),
    pt(landmarks, LM.RIGHT_LOWER_JAW)
  );
  const avgGonial = (leftGonial + rightGonial) / 2;

  // Chin projection: horizontal offset of chin tip from subnasale vertical
  const chin = pt(landmarks, LM.CHIN);
  const subnasale = pt(landmarks, LM.SUBNASALE);
  const chinProjection = chin.x - subnasale.x;

  // Cheekbone prominence
  const cheekboneProminence = jawWidth > 0 ? faceWidth / jawWidth : 1;

  return {
    jawWidth: Math.round(jawWidth * 10) / 10,
    bigonialBizygomatic: Math.round(bigonialBizygomatic * 100) / 100,
    jawLabel: bigonialBizygomatic > 0.90 ? 'Square jaw' :
              bigonialBizygomatic < 0.75 ? 'Tapered jaw' : 'Moderate jaw',
    gonialAngle: Math.round(avgGonial * 10) / 10,
    gonialLabel: `${Math.round(avgGonial)}° (heuristic — approximate from landmarks)`,
    chinProjection: Math.round(chinProjection * 10) / 10,
    cheekboneProminence: Math.round(cheekboneProminence * 100) / 100,
    cheekboneLabel: cheekboneProminence > 1.35 ? 'Prominent cheekbones' :
                    cheekboneProminence < 1.10 ? 'Subtle cheekbones' : 'Moderate cheekbones'
  };
}

// ── Face Width/Height Ratio ──────────────────────────────────────

export function computeFaceRatio(landmarks) {
  const faceLength = dist(pt(landmarks, LM.FOREHEAD_TOP), pt(landmarks, LM.CHIN));
  const faceWidth = dist(pt(landmarks, LM.LEFT_CHEEKBONE), pt(landmarks, LM.RIGHT_CHEEKBONE));
  const ratio = faceWidth > 0 ? faceLength / faceWidth : 0;

  return {
    faceLength: Math.round(faceLength * 10) / 10,
    faceWidth: Math.round(faceWidth * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    label: ratio >= 1.3 && ratio <= 1.4 ? 'Ideal oval range' :
           ratio < 1.1 ? 'Very wide' :
           ratio > 1.5 ? 'Very elongated' : 'Within normal range'
  };
}

// ── Run All Metrics ──────────────────────────────────────────────

export function computeAllMetrics(landmarks) {
  return {
    symmetry: computeSymmetry(landmarks),
    thirds: computeThirds(landmarks),
    fifths: computeFifths(landmarks),
    faceShape: computeFaceShape(landmarks),
    eyeMetrics: computeEyeMetrics(landmarks),
    noseMetrics: computeNoseMetrics(landmarks),
    mouthMetrics: computeMouthMetrics(landmarks),
    jawMetrics: computeJawMetrics(landmarks),
    faceRatio: computeFaceRatio(landmarks)
  };
}
