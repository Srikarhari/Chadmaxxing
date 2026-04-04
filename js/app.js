// === FILE: Chadmaxxing/js/app.js ===
// Entry point: router, screen manager, init sequence

import { loadFaceMesh, detectFace, getLoadError, isLoaded } from './mediapipe-loader.js';
import { toPixelCoords, checkHeadPose } from './landmarks.js';
import { computeAllMetrics } from './metrics.js';
import { computeScores } from './scoring.js';
import { generateRecommendations } from './recommendations.js';
import { saveScan, getAllScans, deleteScan, getScanCount } from './storage.js';
import { loadImageFromFile, initLiveCamera, captureFrame, stopCamera, isCameraActive, createThumbnail } from './camera.js';
import {
  showScreen, showLoading, showError, updateModelStatus,
  setupCaptureScreen, showCameraPreview, hideCameraPreview,
  renderResults, setupCriticalMode, renderHistory,
  setupA2HS, setupNavigation, updateHistoryBadge
} from './ui.js';

let currentImage = null;
let rawLandmarks = null;

// ── Init ─────────────────────────────────────────────────────────

async function init() {
  showScreen('screen-capture');

  // Setup UI handlers
  setupCaptureScreen(handleFileSelected, handleCameraCapture);
  setupCriticalMode();
  setupA2HS();
  setupNavigation({
    'screen-capture': goToCapture,
    'screen-history': goToHistory
  });

  // Setup error retry
  const retryBtn = document.getElementById('error-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      showScreen('screen-capture');
      initMediaPipe();
    });
  }

  // Setup scan-again button
  const scanAgainBtn = document.getElementById('scan-again-btn');
  if (scanAgainBtn) {
    scanAgainBtn.addEventListener('click', goToCapture);
  }

  // Setup history nav
  const historyBtn = document.getElementById('history-btn');
  if (historyBtn) {
    historyBtn.addEventListener('click', goToHistory);
  }

  // Setup back buttons
  document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.back || 'screen-capture';
      showScreen(target);
    });
  });

  // Register service worker
  registerSW();

  // Update history badge
  try {
    const count = await getScanCount();
    updateHistoryBadge(count);
  } catch (e) {
    // IndexedDB might not be available
  }

  // Load MediaPipe
  initMediaPipe();

  // Try live camera as enhancement
  initCamera();
}

async function initMediaPipe() {
  updateModelStatus('Loading face detection...', false);

  const fm = await loadFaceMesh((step) => {
    updateModelStatus(step, false);
  });

  if (!fm) {
    const err = getLoadError();
    updateModelStatus('Failed to load — tap to retry', false);
    const statusEl = document.getElementById('model-status');
    if (statusEl) {
      statusEl.style.cursor = 'pointer';
      statusEl.onclick = () => {
        statusEl.onclick = null;
        statusEl.style.cursor = '';
        initMediaPipe();
      };
    }
    console.error('MediaPipe failed:', err);
    return;
  }

  updateModelStatus('Ready', true);
}

async function initCamera() {
  const video = document.getElementById('camera-video');
  if (!video) return;

  const result = await initLiveCamera(video);
  if (result) {
    showCameraPreview(video);
  }
}

// ── Handlers ─────────────────────────────────────────────────────

async function handleFileSelected(file) {
  try {
    const img = await loadImageFromFile(file);
    currentImage = img;
    await analyzeImage(img);
  } catch (err) {
    showError('Image Error', err.message, false);
  }
}

async function handleCameraCapture() {
  const video = document.getElementById('camera-video');
  if (!isCameraActive() || !video) {
    // Fallback: trigger file input
    const fi = document.getElementById('file-input-direct') || document.getElementById('file-input');
    if (fi) fi.click();
    return;
  }

  try {
    const img = await captureFrame(video);
    currentImage = img;
    await analyzeImage(img);
  } catch (err) {
    showError('Capture Error', err.message, false);
  }
}

async function analyzeImage(img) {
  if (!isLoaded()) {
    showError('Not Ready', 'Face detection model is still loading. Please wait and try again.', true);
    return;
  }

  try {
    showLoading('Detecting face...', 20);

    const landmarks = await detectFace(img);
    if (!landmarks) {
      showError('No Face Detected', 'Could not find a face in this image. Please try again with a clear, front-facing photo.', false);
      return;
    }

    rawLandmarks = landmarks;
    showLoading('Checking head position...', 40);

    // Convert to pixel coords for metric computation
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const pixelLandmarks = toPixelCoords(landmarks, w, h);

    // Check head pose — never blocks, warning only
    const pose = checkHeadPose(pixelLandmarks);
    const poseWarning = pose.warning || (pose.ok ? null : pose.message);

    showLoading('Computing facial metrics...', 60);

    // Compute all metrics
    const metrics = computeAllMetrics(pixelLandmarks);

    showLoading('Calculating scores...', 80);

    // Score
    const scores = computeScores(metrics);

    // Recommendations
    const recommendations = generateRecommendations(metrics, scores);

    showLoading('Rendering results...', 95);

    // Render results (uses raw normalized landmarks for canvas overlay)
    renderResults(img, landmarks, metrics, scores, recommendations, poseWarning);

    // Save to history
    try {
      const thumbnail = createThumbnail(img);
      await saveScan({
        thumbnail,
        scores,
        faceShape: metrics.faceShape.shape,
        date: new Date().toISOString()
      });
      const count = await getScanCount();
      updateHistoryBadge(count);
    } catch (e) {
      console.warn('Failed to save scan:', e);
    }

  } catch (err) {
    console.error('Analysis error:', err);
    showError('Analysis Error', err.message || 'An unexpected error occurred during analysis.', false);
  }
}

// ── Navigation ───────────────────────────────────────────────────

function goToCapture() {
  showScreen('screen-capture');
  // Reset critical mode toggle
  const toggle = document.getElementById('critical-mode-toggle');
  if (toggle) toggle.checked = false;
  const panel = document.getElementById('critical-mode-panel');
  if (panel) panel.classList.remove('open');
}

async function goToHistory() {
  try {
    const scans = await getAllScans();
    const onDelete = async (id) => {
      await deleteScan(id);
      const updated = await getAllScans();
      renderHistory(updated, onDelete);
      const count = await getScanCount();
      updateHistoryBadge(count);
    };
    renderHistory(scans, onDelete);
  } catch (e) {
    showError('History Error', 'Could not load scan history.', false);
  }
}

// ── Service Worker Registration ──────────────────────────────────

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered:', reg.scope);
    }).catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}

// ── Boot ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
