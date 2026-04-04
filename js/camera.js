// === FILE: Chadmaxxing/js/camera.js ===
// Camera capture: file input (primary) + getUserMedia (enhancement)

let videoStream = null;
let videoElement = null;

/**
 * Load an image from a File object (from <input type="file">).
 * Returns an HTMLImageElement ready for analysis.
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Try to initialize getUserMedia for live camera preview.
 * Returns { video, stream } or null if not available.
 * This is an ENHANCEMENT — the app works without it.
 */
export async function initLiveCamera(videoEl) {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    videoEl.srcObject = stream;
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('autoplay', '');
    videoEl.muted = true;

    await new Promise((resolve) => {
      videoEl.onloadedmetadata = resolve;
    });
    await videoEl.play();

    videoStream = stream;
    videoElement = videoEl;
    return { video: videoEl, stream };
  } catch (err) {
    console.warn('Live camera not available:', err.message);
    return null;
  }
}

/**
 * Capture a still frame from the live video stream.
 * Returns an HTMLImageElement.
 */
export function captureFrame(videoEl) {
  return new Promise((resolve, reject) => {
    if (!videoEl || videoEl.readyState < 2) {
      reject(new Error('Video not ready'));
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoEl.videoWidth;
    canvas.height = videoEl.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);

    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to capture frame'));
    img.src = canvas.toDataURL('image/jpeg', 0.92);
  });
}

/**
 * Stop the live camera stream.
 */
export function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  if (videoElement) {
    videoElement.srcObject = null;
    videoElement = null;
  }
}

/**
 * Check if live camera is currently active.
 */
export function isCameraActive() {
  return videoStream !== null;
}

/**
 * Compress an image to a small JPEG thumbnail for storage.
 * Returns a data URL string.
 */
export function createThumbnail(img, maxSize = 200) {
  const canvas = document.createElement('canvas');
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;

  if (w > h) {
    if (w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
  } else {
    if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
  }

  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}
