// === FILE: Chadmaxxing/js/recommendations.js ===
// Generate contextual recommendation cards from metric scores

export function generateRecommendations(metrics, scores) {
  const cards = [];

  // Symmetry
  if (scores.categoryScores.symmetry < 60) {
    cards.push({
      category: 'Symmetry',
      icon: '⚖️',
      title: 'Symmetry Awareness',
      text: 'Some facial asymmetry is completely normal — almost no one is perfectly symmetric. If asymmetry bothers you, hairstyle adjustments or facial exercises may help create a more balanced appearance.',
      priority: 1
    });
  } else if (scores.categoryScores.symmetry >= 80) {
    cards.push({
      category: 'Symmetry',
      icon: '⚖️',
      title: 'Strong Symmetry',
      text: 'Your facial symmetry is above average. This is one of the most consistently studied markers of facial harmony across cultures.',
      priority: 3
    });
  }

  // Proportions — thirds
  const thirds = metrics.thirds;
  if (thirds.lower > 38) {
    cards.push({
      category: 'Proportions',
      icon: '📐',
      title: 'Lower Third Emphasis',
      text: 'Your lower facial third is proportionally longer. This is common and can give a strong, defined appearance. Grooming choices like facial hair can adjust perceived proportions.',
      priority: 2
    });
  } else if (thirds.upper > 38) {
    cards.push({
      category: 'Proportions',
      icon: '📐',
      title: 'Upper Third Emphasis',
      text: 'Your upper face area appears proportionally larger. Note: this measurement uses the detected face contour, not the true hairline. Hairstyle can significantly affect this perception.',
      priority: 2
    });
  } else if (thirds.score >= 80) {
    cards.push({
      category: 'Proportions',
      icon: '📐',
      title: 'Balanced Proportions',
      text: 'Your facial thirds are well-balanced, close to the classical ideal of equal thirds. This contributes to a harmonious overall appearance.',
      priority: 3
    });
  }

  // Eye metrics
  const eye = metrics.eyeMetrics;
  if (eye.canthalTilt > 2) {
    cards.push({
      category: 'Eyes',
      icon: '👁️',
      title: 'Positive Canthal Tilt',
      text: 'Your eyes have a slight upward tilt at the outer corners. This is often associated with a youthful, alert appearance.',
      priority: 3
    });
  } else if (eye.canthalTilt < -3) {
    cards.push({
      category: 'Eyes',
      icon: '👁️',
      title: 'Downward Canthal Tilt',
      text: 'Your eyes tilt slightly downward at the outer corners. This can give a gentle, approachable look. Eyebrow grooming can subtly adjust the perceived tilt.',
      priority: 2
    });
  }

  if (eye.spacingRatio > 1.15) {
    cards.push({
      category: 'Eyes',
      icon: '👁️',
      title: 'Wide-Set Eyes',
      text: 'Your eyes are spaced wider than the classical "one eye width apart" standard. This can be complemented with certain eyebrow shapes and hairstyles.',
      priority: 2
    });
  } else if (eye.spacingRatio < 0.85) {
    cards.push({
      category: 'Eyes',
      icon: '👁️',
      title: 'Close-Set Eyes',
      text: 'Your eyes are closer together than average. Eyebrow grooming (slightly wider gap) and hairstyle choices can balance this visually.',
      priority: 2
    });
  }

  // Nose
  const nose = metrics.noseMetrics;
  if (nose.noseToFaceRatio > 0.30) {
    cards.push({
      category: 'Nose',
      icon: '👃',
      title: 'Nose Width',
      text: 'Your nose is proportionally wider relative to your face width. This is a natural variation influenced by ethnicity and genetics.',
      priority: 2
    });
  }

  // Mouth
  const mouth = metrics.mouthMetrics;
  if (mouth.mouthToNoseRatio >= 1.3 && mouth.mouthToNoseRatio <= 1.7) {
    cards.push({
      category: 'Mouth',
      icon: '👄',
      title: 'Balanced Mouth-to-Nose Ratio',
      text: 'Your mouth width relates well to your nose width, falling within the commonly cited ideal range.',
      priority: 3
    });
  }

  // Jawline
  const jaw = metrics.jawMetrics;
  if (jaw.bigonialBizygomatic > 0.88) {
    cards.push({
      category: 'Jawline',
      icon: '🦴',
      title: 'Strong Jaw Structure',
      text: 'Your jaw width is close to your cheekbone width, giving a strong, defined lower face. This is a prominent feature in many beauty standards.',
      priority: 3
    });
  } else if (jaw.bigonialBizygomatic < 0.72) {
    cards.push({
      category: 'Jawline',
      icon: '🦴',
      title: 'Tapered Jaw',
      text: 'Your jaw tapers noticeably from your cheekbones, creating a V-shaped face. This is considered attractive in many East Asian beauty standards.',
      priority: 2
    });
  }

  // Face shape
  const shape = metrics.faceShape;
  cards.push({
    category: 'Face Shape',
    icon: '🔷',
    title: `${shape.shape} Face Shape`,
    text: `Your face shape is classified as ${shape.shape} (${shape.confidence}% confidence). Every face shape has its own strengths — ${getShapeTip(shape.shape)}`,
    priority: 2
  });

  // Overall harmony
  if (scores.harmony >= 80) {
    cards.push({
      category: 'Overall',
      icon: '✨',
      title: 'High Facial Harmony',
      text: 'Your facial proportions show strong alignment with classical harmony standards. Remember, these are geometric measurements — real attractiveness is far more complex and multidimensional.',
      priority: 3
    });
  }

  // Sort: high priority first
  cards.sort((a, b) => b.priority - a.priority);

  return cards;
}

function getShapeTip(shape) {
  const tips = {
    Oval: 'oval faces are versatile with most hairstyles and accessories.',
    Round: 'angular hairstyles and frames can add definition. Round faces often age well.',
    Square: 'your strong angles are a standout feature. Softer hairstyles create nice contrast.',
    Heart: 'chin-length styles and side-swept bangs complement the wider forehead.',
    Oblong: 'layered hairstyles and wider frames help balance the length.',
    Diamond: 'your prominent cheekbones are a natural highlight. Styles that add width at forehead and chin balance nicely.'
  };
  return tips[shape] || 'every shape has unique qualities to highlight.';
}
