// === FILE: Chadmaxxing/js/landmarks.js ===
// Landmark extraction, normalization, head pose estimation, and index maps

import { dist, angleDeg, midpoint } from './utils.js';

// ── Named landmark indices for MediaPipe Face Mesh (478 points) ──

export const LM = {
  // Midline
  FOREHEAD_TOP: 10,       // Top of detected face contour (NOT true hairline)
  NASION: 168,             // Between eyebrows / glabella
  NOSE_BRIDGE_MID: 1,
  NOSE_TIP: 4,
  SUBNASALE: 2,            // Base of nose columella
  CHIN: 152,               // Menton / chin bottom

  // Eyes — outer and inner corners
  LEFT_EYE_OUTER: 33,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  RIGHT_EYE_OUTER: 263,

  // Eye lids (for palpebral fissure height)
  LEFT_EYE_TOP: 159,
  LEFT_EYE_BOTTOM: 145,
  RIGHT_EYE_TOP: 386,
  RIGHT_EYE_BOTTOM: 374,

  // Iris centers (refined landmarks 468-477)
  LEFT_IRIS_CENTER: 468,
  RIGHT_IRIS_CENTER: 473,

  // Eyebrows
  LEFT_BROW_INNER: 107,
  LEFT_BROW_OUTER: 70,
  LEFT_BROW_PEAK: 105,
  RIGHT_BROW_INNER: 336,
  RIGHT_BROW_OUTER: 300,
  RIGHT_BROW_PEAK: 334,

  // Nose
  LEFT_NOSTRIL: 48,
  RIGHT_NOSTRIL: 278,
  NOSE_BRIDGE_LEFT: 122,
  NOSE_BRIDGE_RIGHT: 351,

  // Mouth
  MOUTH_LEFT: 61,
  MOUTH_RIGHT: 291,
  UPPER_LIP_TOP: 0,
  UPPER_LIP_BOTTOM: 13,
  LOWER_LIP_TOP: 14,
  LOWER_LIP_BOTTOM: 17,
  CUPID_BOW_LEFT: 37,
  CUPID_BOW_RIGHT: 267,

  // Face contour / oval
  LEFT_CHEEKBONE: 234,
  RIGHT_CHEEKBONE: 454,
  LEFT_JAW_ANGLE: 172,
  RIGHT_JAW_ANGLE: 397,
  LEFT_JAW_MID: 132,
  RIGHT_JAW_MID: 361,

  // Forehead width approximation
  LEFT_FOREHEAD: 21,
  RIGHT_FOREHEAD: 251,

  // Lower jaw near chin
  LEFT_LOWER_JAW: 150,
  RIGHT_LOWER_JAW: 379
};

// Bilateral pairs for symmetry
export const BILATERAL_PAIRS = [
  { name: 'Eye outer',    left: LM.LEFT_EYE_OUTER,   right: LM.RIGHT_EYE_OUTER },
  { name: 'Eye inner',    left: LM.LEFT_EYE_INNER,   right: LM.RIGHT_EYE_INNER },
  { name: 'Brow inner',   left: LM.LEFT_BROW_INNER,  right: LM.RIGHT_BROW_INNER },
  { name: 'Brow outer',   left: LM.LEFT_BROW_OUTER,  right: LM.RIGHT_BROW_OUTER },
  { name: 'Brow peak',    left: LM.LEFT_BROW_PEAK,   right: LM.RIGHT_BROW_PEAK },
  { name: 'Cheekbone',    left: LM.LEFT_CHEEKBONE,    right: LM.RIGHT_CHEEKBONE },
  { name: 'Nostril',      left: LM.LEFT_NOSTRIL,      right: LM.RIGHT_NOSTRIL },
  { name: 'Mouth corner', left: LM.MOUTH_LEFT,        right: LM.MOUTH_RIGHT },
  { name: 'Jaw angle',    left: LM.LEFT_JAW_ANGLE,    right: LM.RIGHT_JAW_ANGLE },
  { name: 'Jaw mid',      left: LM.LEFT_JAW_MID,      right: LM.RIGHT_JAW_MID }
];

// Face oval indices for shape analysis
export const FACE_OVAL_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

/**
 * Convert raw MediaPipe landmarks (normalized 0-1) to pixel coordinates.
 * @param {Array} rawLandmarks - Array of {x, y, z} normalized landmarks
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Array} Landmarks in pixel coordinates
 */
export function toPixelCoords(rawLandmarks, width, height) {
  return rawLandmarks.map(p => ({
    x: p.x * width,
    y: p.y * height,
    z: p.z * width  // z is relative to width in MediaPipe
  }));
}

/**
 * Get a specific landmark point from the array.
 */
export function pt(landmarks, index) {
  return landmarks[index];
}

/**
 * Estimate head pose (yaw, pitch, roll) from landmark positions.
 * Uses nose tip, chin, and eye corners for estimation.
 * Returns angles in degrees.
 */
export function estimateHeadPose(landmarks) {
  const noseTip = pt(landmarks, LM.NOSE_TIP);
  const chin = pt(landmarks, LM.CHIN);
  const leftEye = pt(landmarks, LM.LEFT_EYE_OUTER);
  const rightEye = pt(landmarks, LM.RIGHT_EYE_OUTER);
  const nasion = pt(landmarks, LM.NASION);
  const foreheadTop = pt(landmarks, LM.FOREHEAD_TOP);

  // Yaw: horizontal asymmetry of nose tip relative to eye midpoint
  const eyeMid = midpoint(leftEye, rightEye);
  const eyeWidth = dist(leftEye, rightEye);
  const noseOffsetX = (noseTip.x - eyeMid.x) / (eyeWidth || 1);
  const yaw = noseOffsetX * 90; // rough degrees

  // Pitch: vertical ratio of nose-to-chin vs forehead-to-nose
  const foreheadToNose = dist(foreheadTop, noseTip);
  const noseToChin = dist(noseTip, chin);
  const pitchRatio = foreheadToNose / (noseToChin || 1);
  const pitch = (pitchRatio - 1.0) * 30; // rough degrees, positive = looking up

  // Roll: angle of eye line relative to horizontal
  const roll = angleDeg(rightEye, leftEye);

  return { yaw, pitch, roll };
}

/**
 * Check if head pose is acceptable for analysis.
 * Returns { ok: boolean, warning: string|null, message: string }
 * Only blocks on extreme rotation where landmarks are unreliable.
 * Moderate tilt produces a soft warning but allows analysis.
 */
export function checkHeadPose(landmarks) {
  const pose = estimateHeadPose(landmarks);

  // Hard block only for truly extreme poses where landmarks are unusable
  if (Math.abs(pose.yaw) > 60) {
    return { ok: false, warning: null, message: 'Face is turned too far to the side. Please face the camera.' };
  }
  if (Math.abs(pose.pitch) > 50) {
    return { ok: false, warning: null, message: 'Face is tilted too far up or down. Please look toward the camera.' };
  }
  if (Math.abs(pose.roll) > 45) {
    return { ok: false, warning: null, message: 'Face is rotated too far. Please straighten your head.' };
  }

  // Soft warning for moderate tilt — analysis proceeds normally
  if (Math.abs(pose.yaw) > 25 || Math.abs(pose.pitch) > 20 || Math.abs(pose.roll) > 18) {
    return { ok: true, warning: 'For best accuracy, try to keep your head more centered and level.', message: 'Acceptable position.' };
  }

  return { ok: true, warning: null, message: 'Good head position.' };
}

/**
 * Compute the midline axis from facial landmarks.
 * Returns two points defining the vertical symmetry axis.
 */
export function getMidlineAxis(landmarks) {
  const top = pt(landmarks, LM.NASION);
  const bottom = pt(landmarks, LM.CHIN);
  return { top, bottom };
}

/**
 * Compute IPD (inter-pupillary distance).
 * Uses iris centers if available, falls back to eye midpoints.
 */
export function getIPD(landmarks) {
  const leftIris = pt(landmarks, LM.LEFT_IRIS_CENTER);
  const rightIris = pt(landmarks, LM.RIGHT_IRIS_CENTER);

  if (leftIris && rightIris && leftIris.x !== undefined) {
    return dist(leftIris, rightIris);
  }

  // Fallback: midpoint of each eye
  const leftMid = midpoint(
    pt(landmarks, LM.LEFT_EYE_OUTER),
    pt(landmarks, LM.LEFT_EYE_INNER)
  );
  const rightMid = midpoint(
    pt(landmarks, LM.RIGHT_EYE_OUTER),
    pt(landmarks, LM.RIGHT_EYE_INNER)
  );
  return dist(leftMid, rightMid);
}
