// Centralized, resilient MediaPipe Hands singleton manager shared across Bubble Pop & Yoga Quiz.
// Prevents Emscripten WASM collisions, handles multi-CDN script loading, guards unready 0x0 video frames,
// falls back to offscreen 2D canvas frame upload on GPU/WebGL quirks, and auto-recovers on WASM errors.

export interface SharedHandsOptions {
  maxNumHands?: number;
  modelComplexity?: 0 | 1;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
}

const PINNED_HANDS_VERSION = '0.4.1675469240';
const HANDS_CDN_BASES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${PINNED_HANDS_VERSION}`,
  `https://unpkg.com/@mediapipe/hands@${PINNED_HANDS_VERSION}`,
];

let activeCdnBase = HANDS_CDN_BASES[0];
let scriptLoadPromise: Promise<void> | null = null;
let sharedHandsInstance: any = null;
let sharedHandsInitPromise: Promise<any> | null = null;
let lastAppliedOptionsKey = '';

let activeSessionToken = 0;
let activeResultsListener: ((results: any) => void) | null = null;

// Serialized frame lock & self-healing recovery counters
let isSendingFrame = false;
let consecutiveSendErrors = 0;
let useCanvasUploadFallback = false;
let forceLiteModel = false;
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

function loadScriptTag(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('Document unavailable'));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error(`Timed out loading ${src}`));
    }, 12000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function ensureHandsScriptLoaded(): Promise<void> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (!win) throw new Error('Browser window unavailable');
  if (typeof win.Hands === 'function') return;

  if (scriptLoadPromise) {
    await scriptLoadPromise;
    if (typeof win.Hands === 'function') return;
    scriptLoadPromise = null;
  }

  scriptLoadPromise = (async () => {
    // First wait briefly in case the index.html <script> tag is still finishing load
    for (let i = 0; i < 20; i++) {
      if (typeof win.Hands === 'function') return;
      await new Promise(r => setTimeout(r, 120));
    }

    // Otherwise dynamically load from pinned CDN fallbacks
    let lastErr: unknown = null;
    for (const base of HANDS_CDN_BASES) {
      try {
        await loadScriptTag(`${base}/hands.js`);
        if (typeof win.Hands === 'function') {
          activeCdnBase = base;
          return;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    throw lastErr instanceof Error
      ? lastErr
      : new Error('Unable to load Hand Detection AI library. Please check your internet connection.');
  })();

  try {
    await scriptLoadPromise;
  } catch (err) {
    scriptLoadPromise = null;
    throw err;
  }
}

async function createOrGetHandsInstance(initialOptions?: SharedHandsOptions): Promise<any> {
  if (sharedHandsInstance) {
    return sharedHandsInstance;
  }
  if (sharedHandsInitPromise) {
    return sharedHandsInitPromise;
  }

  sharedHandsInitPromise = (async () => {
    await ensureHandsScriptLoaded();
    const win = window as any;
    const hands = new win.Hands({
      locateFile: (file: string) => `${activeCdnBase}/${file}`,
    });

    const opts: Required<SharedHandsOptions> = {
      maxNumHands: initialOptions?.maxNumHands ?? 4,
      modelComplexity: forceLiteModel ? 0 : (initialOptions?.modelComplexity ?? 1),
      minDetectionConfidence: initialOptions?.minDetectionConfidence ?? 0.45,
      minTrackingConfidence: initialOptions?.minTrackingConfidence ?? 0.45,
    };

    hands.setOptions(opts);
    lastAppliedOptionsKey = JSON.stringify(opts);

    hands.onResults((results: any) => {
      if (activeResultsListener) {
        try {
          activeResultsListener(results);
        } catch (cbErr) {
          console.warn('Hand results listener error:', cbErr);
        }
      }
    });

    if (typeof hands.initialize === 'function') {
      await Promise.race([
        Promise.resolve(hands.initialize()).catch(() => undefined),
        new Promise(resolve => setTimeout(resolve, 6000)),
      ]);
    }

    sharedHandsInstance = hands;
    consecutiveSendErrors = 0;
    return hands;
  })();

  try {
    return await sharedHandsInitPromise;
  } catch (err) {
    sharedHandsInitPromise = null;
    throw err;
  }
}

export function prewarmSharedHands(options?: SharedHandsOptions): Promise<any> {
  return createOrGetHandsInstance(options).catch(() => null);
}

/**
 * Acquire exclusive ownership of the shared MediaPipe Hands tracker for a game view.
 * Returns a sessionToken used for safe frame submission and clean release.
 */
export async function acquireSharedHands(
  options: SharedHandsOptions,
  onResults: (results: any) => void
): Promise<{ sessionToken: number; hands: any }> {
  const sessionToken = ++activeSessionToken;
  activeResultsListener = onResults;

  const hands = await createOrGetHandsInstance(options);

  // If another caller superseded us while we were awaiting initialization, do not clobber them
  if (sessionToken !== activeSessionToken) {
    return { sessionToken, hands };
  }

  const normalized: Required<SharedHandsOptions> = {
    maxNumHands: options.maxNumHands ?? 4,
    modelComplexity: forceLiteModel ? 0 : (options.modelComplexity ?? 1),
    minDetectionConfidence: options.minDetectionConfidence ?? 0.45,
    minTrackingConfidence: options.minTrackingConfidence ?? 0.45,
  };
  const nextKey = JSON.stringify(normalized);

  if (nextKey !== lastAppliedOptionsKey) {
    try {
      hands.setOptions(normalized);
      lastAppliedOptionsKey = nextKey;
    } catch (err) {
      console.warn('MediaPipe setOptions notice:', err);
    }
  }

  activeResultsListener = onResults;
  return { sessionToken, hands };
}

/**
 * Detach a view's results listener without destroying the underlying WASM graph.
 */
export function releaseSharedHands(sessionToken: number): void {
  if (sessionToken === activeSessionToken) {
    activeResultsListener = null;
    activeSessionToken++;
  }
}

/**
 * Safely wait for an HTMLVideoElement to have valid non-zero dimensions without deadlocking
 * if metadata has already loaded.
 */
export async function waitForVideoReady(videoEl: HTMLVideoElement, timeoutMs = 2500): Promise<void> {
  if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
    return;
  }
  await new Promise<void>(resolve => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      videoEl.removeEventListener('loadedmetadata', onCheck);
      videoEl.removeEventListener('loadeddata', onCheck);
      videoEl.removeEventListener('canplay', onCheck);
      resolve();
    };
    const onCheck = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        done();
      }
    };
    const timer = window.setTimeout(done, timeoutMs);
    videoEl.addEventListener('loadedmetadata', onCheck);
    videoEl.addEventListener('loadeddata', onCheck);
    videoEl.addEventListener('canplay', onCheck);
    onCheck();
  });
}

function getCanvasImageFromVideo(videoEl: HTMLVideoElement): HTMLCanvasElement | null {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;
  const targetW = Math.min(640, vw);
  const targetH = Math.max(1, Math.round((vh / vw) * targetW));
  if (!offscreenCanvas) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: false });
  }
  if (!offscreenCanvas || !offscreenCtx) return null;
  if (offscreenCanvas.width !== targetW || offscreenCanvas.height !== targetH) {
    offscreenCanvas.width = targetW;
    offscreenCanvas.height = targetH;
  }
  offscreenCtx.drawImage(videoEl, 0, 0, targetW, targetH);
  return offscreenCanvas;
}

/**
 * Send one video frame to the shared MediaPipe Hands singleton safely.
 * Serializes frames, skips 0x0/unready video frames, falls back to 2D canvas upload on WebGL errors,
 * and self-heals by rebuilding with the lite model if WASM throws repeated errors.
 */
export async function sendHandsFrameSafe(
  videoEl: HTMLVideoElement | null,
  sessionToken: number,
  optionsForRecovery?: SharedHandsOptions
): Promise<boolean> {
  if (sessionToken !== activeSessionToken) return false;
  if (!sharedHandsInstance || isSendingFrame) return false;
  if (
    !videoEl ||
    videoEl.readyState < 2 ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0 ||
    videoEl.paused ||
    videoEl.ended
  ) {
    return false;
  }

  isSendingFrame = true;
  try {
    let imageSource: HTMLVideoElement | HTMLCanvasElement = videoEl;
    if (useCanvasUploadFallback) {
      const canvasImg = getCanvasImageFromVideo(videoEl);
      if (canvasImg) imageSource = canvasImg;
    }

    await sharedHandsInstance.send({ image: imageSource });
    consecutiveSendErrors = 0;
    return true;
  } catch (err) {
    consecutiveSendErrors++;

    // First failure: switch to 2D offscreen canvas upload to bypass browser WebGL HTMLVideoElement quirks
    if (!useCanvasUploadFallback && consecutiveSendErrors >= 1) {
      useCanvasUploadFallback = true;
      try {
        const canvasImg = getCanvasImageFromVideo(videoEl);
        if (canvasImg && sharedHandsInstance && sessionToken === activeSessionToken) {
          await sharedHandsInstance.send({ image: canvasImg });
          consecutiveSendErrors = 0;
          return true;
        }
      } catch {
        // Proceed to recovery counter below
      }
    }

    // Repeated failures: rebuild MediaPipe Hands with ultra-compatible lite model (modelComplexity: 0)
    if (consecutiveSendErrors >= 4) {
      console.warn('Recovering MediaPipe Hands after frame errors:', err);
      const broken = sharedHandsInstance;
      sharedHandsInstance = null;
      sharedHandsInitPromise = null;
      lastAppliedOptionsKey = '';
      consecutiveSendErrors = 0;
      forceLiteModel = true;
      try {
        broken?.close?.();
      } catch {
        // ignore close errors on corrupted instance
      }
      try {
        if (sessionToken === activeSessionToken) {
          await createOrGetHandsInstance({
            ...optionsForRecovery,
            modelComplexity: 0,
          });
        }
      } catch {
        // Will retry cleanly on next acquisition
      }
    }
    return false;
  } finally {
    isSendingFrame = false;
  }
}
