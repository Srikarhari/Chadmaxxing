// === FILE: Chadmaxxing/js/ui.js ===
// All UI rendering: screens, gauges, canvas overlay, history, Critical Mode

import { CATEGORIES, scoreColor, harmonyLabel, getCriticalBreakdown } from './scoring.js';
import { LM, FACE_OVAL_INDICES, BILATERAL_PAIRS, pt } from './landmarks.js';

// ── Screen Management ────────────────────────────────────────────

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
  });
  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// ── Capture Screen ───────────────────────────────────────────────

export function setupCaptureScreen(onFileSelected, onCameraCapture) {
  const fileInputDirect = document.getElementById('file-input-direct');
  const fileInput = document.getElementById('file-input');
  const captureBtn = document.getElementById('capture-btn');

  // Primary path: file input with capture="user" (opens native camera on iPad)
  if (fileInputDirect) {
    fileInputDirect.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        onFileSelected(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Hidden fallback: if file-input somehow gets triggered, still handle it
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        onFileSelected(e.target.files[0]);
        e.target.value = '';
      }
    });
  }

  // Live camera capture button (only visible when getUserMedia is active)
  if (captureBtn) {
    captureBtn.addEventListener('click', () => {
      onCameraCapture();
    });
  }
}

export function showCameraPreview(videoEl) {
  const placeholder = document.getElementById('camera-placeholder');
  if (placeholder) placeholder.style.display = 'none';
  if (videoEl) videoEl.style.display = 'block';
  const captureBtn = document.getElementById('capture-btn');
  if (captureBtn) captureBtn.style.display = 'block';
}

export function hideCameraPreview() {
  const video = document.getElementById('camera-video');
  if (video) video.style.display = 'none';
  const captureBtn = document.getElementById('capture-btn');
  if (captureBtn) captureBtn.style.display = 'none';
}

// ── Loading Screen ───────────────────────────────────────────────

export function showLoading(step, progress) {
  showScreen('screen-loading');
  const stepEl = document.getElementById('loading-step');
  const barEl = document.getElementById('loading-bar-fill');
  if (stepEl) stepEl.textContent = step;
  if (barEl) barEl.style.width = progress + '%';
}

export function showError(title, message, showRetry) {
  showScreen('screen-error');
  const titleEl = document.getElementById('error-title');
  const msgEl = document.getElementById('error-message');
  const retryBtn = document.getElementById('error-retry');
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (retryBtn) retryBtn.style.display = showRetry ? 'block' : 'none';
}

// ── Status bar for MediaPipe loading ─────────────────────────────

export function updateModelStatus(text, isReady) {
  const el = document.getElementById('model-status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('ready', isReady);
  el.classList.toggle('loading', !isReady);
}

// ── Results Screen ───────────────────────────────────────────────

export function renderResults(img, landmarks, metrics, scores, recommendations, poseWarning) {
  showScreen('screen-results');

  // Show pose warning banner if present (non-blocking)
  const warningEl = document.getElementById('pose-warning');
  if (warningEl) {
    if (poseWarning) {
      warningEl.textContent = poseWarning;
      warningEl.style.display = 'block';
    } else {
      warningEl.style.display = 'none';
    }
  }

  // Draw captured image with landmark overlay
  renderCanvasOverlay(img, landmarks);

  // Harmony score gauge
  renderHarmonyGauge(scores.harmony);

  // Face shape label
  const shapeEl = document.getElementById('face-shape-label');
  if (shapeEl) {
    shapeEl.textContent = metrics.faceShape.label;
  }

  // Category sub-scores
  renderCategoryGauges(scores.categoryScores);

  // Quick insights
  renderInsights(metrics, scores);

  // Recommendation cards
  renderRecommendations(recommendations);

  // Store data for Critical Mode
  window.__chadmaxxingData = { metrics, scores };
}

// ── Canvas Overlay (landmarks on face) ───────────────────────────

function renderCanvasOverlay(img, landmarks) {
  const canvas = document.getElementById('result-canvas');
  if (!canvas) return;

  const maxW = canvas.parentElement.clientWidth || 400;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.min(maxW / iw, 1);

  canvas.width = Math.round(iw * scale);
  canvas.height = Math.round(ih * scale);

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (!landmarks || landmarks.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  // Draw face oval
  ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < FACE_OVAL_INDICES.length; i++) {
    const p = landmarks[FACE_OVAL_INDICES[i]];
    const x = p.x * w;
    const y = p.y * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw all landmark dots (subtle)
  ctx.fillStyle = 'rgba(34, 211, 238, 0.25)';
  for (let i = 0; i < Math.min(landmarks.length, 468); i++) {
    const p = landmarks[i];
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Highlight key landmarks
  const keyPoints = [
    LM.FOREHEAD_TOP, LM.NASION, LM.NOSE_TIP, LM.SUBNASALE, LM.CHIN,
    LM.LEFT_EYE_OUTER, LM.LEFT_EYE_INNER, LM.RIGHT_EYE_INNER, LM.RIGHT_EYE_OUTER,
    LM.LEFT_NOSTRIL, LM.RIGHT_NOSTRIL, LM.MOUTH_LEFT, LM.MOUTH_RIGHT,
    LM.LEFT_CHEEKBONE, LM.RIGHT_CHEEKBONE, LM.LEFT_JAW_ANGLE, LM.RIGHT_JAW_ANGLE
  ];

  ctx.fillStyle = 'rgba(74, 222, 128, 0.8)';
  for (const idx of keyPoints) {
    const p = landmarks[idx];
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw midline
  const nasion = landmarks[LM.NASION];
  const chin = landmarks[LM.CHIN];
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(nasion.x * w, nasion.y * h);
  ctx.lineTo(chin.x * w, chin.y * h);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw facial thirds lines
  const subnasale = landmarks[LM.SUBNASALE];
  const foreheadTop = landmarks[LM.FOREHEAD_TOP];
  ctx.strokeStyle = 'rgba(251, 146, 60, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (const p of [foreheadTop, nasion, subnasale, chin]) {
    ctx.beginPath();
    ctx.moveTo(w * 0.15, p.y * h);
    ctx.lineTo(w * 0.85, p.y * h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

// ── Harmony Gauge (large radial) ─────────────────────────────────

function renderHarmonyGauge(score) {
  const container = document.getElementById('harmony-gauge');
  if (!container) return;

  const color = scoreColor(score);
  const label = harmonyLabel(score);

  container.innerHTML = `
    <svg viewBox="0 0 120 120" class="gauge-svg gauge-large">
      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="8"/>
      <circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${2 * Math.PI * 52}"
        stroke-dashoffset="${2 * Math.PI * 52 * (1 - score / 100)}"
        stroke-linecap="round" transform="rotate(-90 60 60)"
        class="gauge-arc"/>
      <text x="60" y="55" text-anchor="middle" fill="${color}" class="gauge-score-text">${score}</text>
      <text x="60" y="72" text-anchor="middle" fill="rgba(255,255,255,0.6)" class="gauge-label-text">/ 100</text>
    </svg>
    <div class="gauge-title" style="color:${color}">${label}</div>
  `;
}

// ── Category Sub-Score Gauges ────────────────────────────────────

function renderCategoryGauges(categoryScores) {
  const grid = document.getElementById('category-gauges');
  if (!grid) return;

  grid.innerHTML = '';

  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const score = categoryScores[key];
    const color = scoreColor(score);

    const card = document.createElement('div');
    card.className = 'gauge-card';
    card.innerHTML = `
      <svg viewBox="0 0 80 80" class="gauge-svg gauge-small">
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="5"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="${color}" stroke-width="5"
          stroke-dasharray="${2 * Math.PI * 34}"
          stroke-dashoffset="${2 * Math.PI * 34 * (1 - score / 100)}"
          stroke-linecap="round" transform="rotate(-90 40 40)"
          class="gauge-arc"/>
        <text x="40" y="44" text-anchor="middle" fill="${color}" class="gauge-small-score">${score}</text>
      </svg>
      <div class="gauge-card-label">${cat.name}</div>
      <div class="gauge-card-type ${cat.type}">${cat.type}</div>
    `;
    grid.appendChild(card);
  }
}

// ── Quick Insights ───────────────────────────────────────────────

function renderInsights(metrics, scores) {
  const el = document.getElementById('insights-list');
  if (!el) return;

  const insights = [];

  // Symmetry
  insights.push(metrics.symmetry.label);

  // Thirds
  insights.push(`Facial thirds: ${metrics.thirds.upper}% / ${metrics.thirds.middle}% / ${metrics.thirds.lower}%`);

  // Face shape
  insights.push(`Face shape: ${metrics.faceShape.shape} (${metrics.faceShape.confidence}%)`);

  // Eye spacing
  insights.push(`Eye spacing: ${metrics.eyeMetrics.spacingLabel} (ratio: ${metrics.eyeMetrics.spacingRatio})`);

  // Canthal tilt
  insights.push(`Canthal tilt: ${metrics.eyeMetrics.canthalTilt}° — ${metrics.eyeMetrics.canthalTiltLabel}`);

  // Nose
  insights.push(`Nose-to-face ratio: ${metrics.noseMetrics.noseToFaceRatio}`);

  // Mouth
  insights.push(`Mouth-to-nose ratio: ${metrics.mouthMetrics.mouthToNoseRatio} (${metrics.mouthMetrics.mouthNoseLabel})`);

  // Jaw
  insights.push(`Jaw: ${metrics.jawMetrics.jawLabel} — ${metrics.jawMetrics.cheekboneLabel}`);

  el.innerHTML = insights.map(t => `<li>${t}</li>`).join('');
}

// ── Recommendation Cards ─────────────────────────────────────────

function renderRecommendations(cards) {
  const container = document.getElementById('recommendations');
  if (!container) return;

  if (!cards || cards.length === 0) {
    container.innerHTML = '<p class="muted">No specific recommendations at this time.</p>';
    return;
  }

  container.innerHTML = cards.map(card => `
    <div class="rec-card priority-${card.priority}">
      <div class="rec-header">
        <span class="rec-icon">${card.icon}</span>
        <span class="rec-title">${card.title}</span>
        <span class="rec-category">${card.category}</span>
      </div>
      <p class="rec-text">${card.text}</p>
    </div>
  `).join('');
}

// ── Critical Mode Panel ──────────────────────────────────────────

export function setupCriticalMode() {
  const toggle = document.getElementById('critical-mode-toggle');
  const panel = document.getElementById('critical-mode-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('change', () => {
    panel.classList.toggle('open', toggle.checked);
    if (toggle.checked && window.__chadmaxxingData) {
      renderCriticalPanel(window.__chadmaxxingData.metrics, window.__chadmaxxingData.scores);
    }
  });
}

function renderCriticalPanel(metrics, scores) {
  const panel = document.getElementById('critical-mode-content');
  if (!panel) return;

  const breakdown = getCriticalBreakdown(metrics, scores);

  let html = '<h3>Score Weight Breakdown</h3>';
  html += '<table class="critical-table"><thead><tr><th>Category</th><th>Weight</th><th>Score</th><th>Contribution</th><th>Type</th></tr></thead><tbody>';
  for (const cat of breakdown.categories) {
    html += `<tr>
      <td>${cat.name}</td>
      <td>${cat.weightPct}</td>
      <td style="color:${scoreColor(cat.score)}">${cat.score}</td>
      <td>${cat.contribution}</td>
      <td><span class="type-badge ${cat.type}">${cat.type}</span></td>
    </tr>`;
  }
  html += `</tbody><tfoot><tr><td><strong>Harmony</strong></td><td>100%</td><td colspan="2" style="color:${scoreColor(breakdown.totalHarmony)}"><strong>${breakdown.totalHarmony}</strong></td><td></td></tr></tfoot></table>`;

  html += '<h3>Raw Metrics vs Ideals</h3>';
  html += '<table class="critical-table"><thead><tr><th>Metric</th><th>Your Value</th><th>Ideal</th><th>Type</th></tr></thead><tbody>';
  for (const m of breakdown.subMetrics) {
    html += `<tr>
      <td>${m.name}</td>
      <td>${m.value}${m.unit}</td>
      <td>${m.ideal}</td>
      <td><span class="type-badge ${m.type}">${m.type}</span></td>
    </tr>`;
  }
  html += '</tbody></table>';

  html += `<p class="critical-disclaimer">${breakdown.disclaimer}</p>`;

  panel.innerHTML = html;
}

// ── History Screen ───────────────────────────────────────────────

export function renderHistory(scans, onDelete) {
  showScreen('screen-history');
  const grid = document.getElementById('history-grid');
  if (!grid) return;

  if (!scans || scans.length === 0) {
    grid.innerHTML = '<p class="muted centered">No scans yet. Analyze a photo to get started.</p>';
    return;
  }

  grid.innerHTML = scans.map(scan => `
    <div class="history-card" data-id="${scan.id}">
      <img src="${scan.thumbnail}" alt="Scan" class="history-thumb"/>
      <div class="history-info">
        <div class="history-score" style="color:${scoreColor(scan.harmony)}">${scan.harmony}</div>
        <div class="history-shape">${scan.faceShape || ''}</div>
        <div class="history-date">${formatDate(scan.date)}</div>
      </div>
      <button class="history-delete" data-id="${scan.id}" title="Delete scan">&times;</button>
    </div>
  `).join('');

  // Attach delete handlers
  grid.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (confirm('Delete this scan?')) onDelete(id);
    });
  });
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── Add to Home Screen Instructions ──────────────────────────────

export function setupA2HS() {
  const btn = document.getElementById('a2hs-btn');
  const modal = document.getElementById('a2hs-modal');
  const closeBtn = document.getElementById('a2hs-close');

  if (!btn || !modal) return;

  // Hide if already in standalone mode
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  if (isStandalone) {
    btn.style.display = 'none';
    return;
  }

  btn.addEventListener('click', () => {
    modal.classList.add('open');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('open');
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });
}

// ── Navigation Buttons ───────────────────────────────────────────

export function setupNavigation(handlers) {
  // Back to capture from results
  const backBtns = document.querySelectorAll('[data-nav]');
  backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (handlers[target]) {
        handlers[target]();
      } else {
        showScreen(target);
      }
    });
  });
}

// ── History count badge ──────────────────────────────────────────

export function updateHistoryBadge(count) {
  const badge = document.getElementById('history-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}
