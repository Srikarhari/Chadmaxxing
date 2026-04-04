// === FILE: Chadmaxxing/js/mediapipe-loader.js ===
// Load MediaPipe Face Mesh from CDN with graceful failure handling

const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh';

let faceMeshInstance = null;
let loadError = null;
let loadPromise = null;

function injectScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });
}

export function getLoadError() {
  return loadError;
}

export function isLoaded() {
  return faceMeshInstance !== null;
}

export async function loadFaceMesh(onProgress) {
  if (faceMeshInstance) return faceMeshInstance;
  if (loadPromise) return loadPromise;

  loadPromise = _doLoad(onProgress);
  return loadPromise;
}

async function _doLoad(onProgress) {
  try {
    if (onProgress) onProgress('Loading MediaPipe Face Mesh library...');

    await injectScript(`${FACE_MESH_CDN}/face_mesh.js`);

    if (typeof window.FaceMesh === 'undefined') {
      throw new Error('FaceMesh class not found after script load');
    }

    if (onProgress) onProgress('Initializing face detection model...');

    const fm = new window.FaceMesh({
      locateFile: (file) => `${FACE_MESH_CDN}/${file}`
    });

    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Warm up the model with a tiny canvas
    await new Promise((resolve, reject) => {
      const warmupCanvas = document.createElement('canvas');
      warmupCanvas.width = 64;
      warmupCanvas.height = 64;
      const ctx = warmupCanvas.getContext('2d');
      ctx.fillStyle = '#888';
      ctx.fillRect(0, 0, 64, 64);

      fm.onResults(() => resolve());
      fm.send({ image: warmupCanvas }).catch(reject);
    });

    if (onProgress) onProgress('Face detection ready');

    faceMeshInstance = fm;
    loadError = null;
    return fm;
  } catch (err) {
    loadError = err.message || 'Unknown error loading MediaPipe';
    faceMeshInstance = null;
    loadPromise = null;
    console.error('MediaPipe load failed:', err);
    return null;
  }
}

export async function detectFace(imageElement) {
  if (!faceMeshInstance) {
    throw new Error('MediaPipe Face Mesh not loaded. Call loadFaceMesh() first.');
  }

  return new Promise((resolve, reject) => {
    let resolved = false;

    faceMeshInstance.onResults((results) => {
      if (resolved) return;
      resolved = true;

      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        resolve(null);
        return;
      }

      resolve(results.multiFaceLandmarks[0]);
    });

    // Send the image
    const canvas = document.createElement('canvas');
    const w = imageElement.naturalWidth || imageElement.videoWidth || imageElement.width;
    const h = imageElement.naturalHeight || imageElement.videoHeight || imageElement.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, w, h);

    faceMeshInstance.send({ image: canvas }).catch((err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    // Timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Face detection timed out'));
      }
    }, 15000);
  });
}
