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
let lastSendStartTimestamp = 0;
let consecutiveSendErrors = 0;

// Detect macOS / Safari so we can avoid Continuity Camera hangs and WebKit HTMLVideoElement->WebGL texture stalls
const isMacOrIOS =
  typeof navigator !== 'undefined' &&
  (/Mac|iPod|iPhone|iPad/i.test(navigator.platform || '') ||
    /Macintosh|Mac OS X|iPhone|iPad/i.test(navigator.userAgent || ''));

const isSafariBrowser =
  typeof navigator !== 'undefined' &&
  /Safari/i.test(navigator.userAgent || '') &&
  !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS/i.test(navigator.userAgent || '');

// On Safari / macOS WebKit (or whenever WebGL prefers canvas upload), drawing the video frame onto an offscreen 2D canvas
// before passing to MediaPipe completely avoids WebKit's YUV hardware video-texture upload failure.
let useCanvasUploadFallback = isSafariBrowser;
let forceLiteModel = false;
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;

/**
 * macOS-Safe Webcam Stream Acquisition Helper
 * - Prioritizes the MacBook's built-in FaceTime HD Camera over wireless iPhone "Continuity Camera" / Desk View virtual cameras
 *   (unless the user explicitly selected a custom deviceId or no built-in camera exists).
 * - Uses progressively relaxed constraints (no rigid frameRate locks that fail on older Intel MacBooks)
 * - Explicitly sets videoEl.muted, playsInline, and autoplay, and verifies frames are actually advancing.
 */
export async function acquireMacSafeCameraStream(options?: {
  preferredWidth?: number;
  preferredHeight?: number;
  facingMode?: 'user' | 'environment';
  preferredDeviceId?: string;
}): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API is not supported in this browser.');
  }

  const width = options?.preferredWidth ?? 640;
  const height = options?.preferredHeight ?? 480;
  const facingMode = options?.facingMode ?? 'user';
  let targetDeviceId = options?.preferredDeviceId;

  // On macOS, inspect available videoinputs if permissions were already granted so we prefer the built-in FaceTime HD Camera
  // over sleeping wireless iPhone Continuity Cameras or virtual OBS/Zoom cameras that output black frames.
  if (!targetDeviceId && isMacOrIOS && typeof navigator.mediaDevices.enumerateDevices === 'function') {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
      const builtInMacCam = videoInputs.find((d) =>
        /FaceTime|Built-in|Internal|MacBook|iSight/i.test(d.label || '') &&
        !/Desk View|Continuity|Virtual|OBS/i.test(d.label || '')
      );
      if (builtInMacCam?.deviceId) {
        targetDeviceId = builtInMacCam.deviceId;
      }
    } catch {
      // enumerateDevices may fail before first permission grant; continue with standard constraints
    }
  }

  const constraintAttempts: MediaStreamConstraints[] = [];

  if (targetDeviceId) {
    constraintAttempts.push({
      video: {
        deviceId: { ideal: targetDeviceId },
        width: { ideal: width },
        height: { ideal: height },
      },
      audio: false,
    });
  }

  // Attempt 1: Ideal resolution + facingMode WITHOUT rigid frameRate (older MacBooks reject 60fps or strict 30fps)
  constraintAttempts.push({
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: width },
      height: { ideal: height },
    },
    audio: false,
  });

  // Attempt 2: Just facingMode
  constraintAttempts.push({
    video: {
      facingMode,
    },
    audio: false,
  });

  // Attempt 3: Bare video: true fallback (never fails with OverconstrainedError on any macOS hardware)
  constraintAttempts.push({
    video: true,
    audio: false,
  });

  let lastError: any = null;
  for (const constraints of constraintAttempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream && stream.getVideoTracks().length > 0) {
        // After permission is granted on macOS, check if macOS accidentally routed to "Desk View" or a virtual camera
        // when a real FaceTime / built-in camera is available
        const activeTrack = stream.getVideoTracks()[0];
        const trackLabel = activeTrack?.label || '';
        if (
          isMacOrIOS &&
          !options?.preferredDeviceId &&
          /Desk View|OBS Virtual|Zoom/i.test(trackLabel) &&
          typeof navigator.mediaDevices.enumerateDevices === 'function'
        ) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const builtIn = devices.find(
              (d) =>
                d.kind === 'videoinput' &&
                d.deviceId &&
                /FaceTime|Built-in|Internal|MacBook/i.test(d.label || '') &&
                !/Desk View/i.test(d.label || '')
            );
            if (builtIn?.deviceId) {
              const betterStream = await navigator.mediaDevices.getUserMedia({
                video: {
                  deviceId: { exact: builtIn.deviceId },
                  width: { ideal: width },
                  height: { ideal: height },
                },
                audio: false,
              });
              stream.getTracks().forEach((t) => t.stop());
              return betterStream;
            }
          } catch {
            // Keep the already working stream
          }
        }
        return stream;
      }
    } catch (err: any) {
      lastError = err;
      // If the user explicitly denied permission in the browser prompt or macOS System Settings, stop retrying
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        break;
      }
    }
  }

  throw lastError || new Error('Unable to access camera.');
}

/**
 * Format a clear, actionable camera error message tailored for macOS / MacBook users when applicable.
 */
export function formatMacFriendlyCameraError(err: any, fallbackModeText = 'Mouse and touch controls are active!'): string {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || /permission|denied/i.test(msg)) {
    if (isMacOrIOS) {
      return `Camera permission blocked. On MacBook: allow Camera in the browser address bar AND in macOS System Settings → Privacy & Security → Camera. (${fallbackModeText})`;
    }
    return `Camera permission denied. Please allow camera access in your browser address bar. (${fallbackModeText})`;
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return `Camera is currently in use by another app or tab. Close other camera tabs and click Retrieve Camera. (${fallbackModeText})`;
  }
  return `Camera unavailable. ${fallbackModeText}`;
}

/**
 * Lazy loader for @mediapipe/face_mesh so it is only loaded when a game specifically needs FaceMesh (e.g., RollerCoaster or BubblePop Nose mode),
 * preventing Emscripten global Module collisions with @mediapipe/hands on page startup.
 */
let faceMeshScriptPromise: Promise<any> | null = null;
export function ensureMediaPipeFaceMeshLoaded(): Promise<any> {
  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (!win) return Promise.resolve(null);
  if (typeof win.FaceMesh === 'function') return Promise.resolve(win.FaceMesh);
  if (faceMeshScriptPromise) return faceMeshScriptPromise;

  faceMeshScriptPromise = (async () => {
    const cdns = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
      'https://unpkg.com/@mediapipe/face_mesh/face_mesh.js',
    ];
    for (const url of cdns) {
      try {
        await loadScriptTag(url);
        if (typeof win.FaceMesh === 'function') {
          return win.FaceMesh;
        }
      } catch {
        // try next CDN
      }
    }
    faceMeshScriptPromise = null;
    return win.FaceMesh || null;
  })();

  return faceMeshScriptPromise;
}

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

    // On macOS Safari, default to modelComplexity 0 (lite model) for smoother 60fps Metal/WebGL execution
    const defaultComplexity = (forceLiteModel || isSafariBrowser) ? 0 : (initialOptions?.modelComplexity ?? 1);

    const opts: Required<SharedHandsOptions> = {
      maxNumHands: initialOptions?.maxNumHands ?? 4,
      modelComplexity: defaultComplexity,
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

export function prewarmSharedHands(_options?: SharedHandsOptions): Promise<any> {
  // Only pre-load the script tag on mount; defer WebGL context & WASM allocation until camera is actually acquired
  return ensureHandsScriptLoaded().catch(() => null);
}

// Circuit-breaker state to avoid 60fps WebGL re-creation loops on devices with restricted WebGL
let webglCircuitBrokenUntil = 0;
let rebuildAttemptsThisSession = 0;

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
  webglCircuitBrokenUntil = 0;
  rebuildAttemptsThisSession = 0;
  isSendingFrame = false;
  if (typeof window !== 'undefined') {
    (window as any).__mpWebGLContextUnavailable = false;
  }

  const hands = await createOrGetHandsInstance(options);

  // If another caller superseded us while we were awaiting initialization, do not clobber them
  if (sessionToken !== activeSessionToken) {
    return { sessionToken, hands };
  }

  const defaultComplexity = (forceLiteModel || isSafariBrowser) ? 0 : (options.modelComplexity ?? 1);
  const normalized: Required<SharedHandsOptions> = {
    maxNumHands: options.maxNumHands ?? 4,
    modelComplexity: defaultComplexity,
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
    isSendingFrame = false;
  }
}

/**
 * Safely attach a MediaStream to an HTMLVideoElement and wait for valid non-zero dimensions
 * and active playback on macOS Safari & Chrome.
 */
export async function waitForVideoReady(videoEl: HTMLVideoElement, timeoutMs = 3000): Promise<void> {
  videoEl.muted = true;
  videoEl.playsInline = true;
  videoEl.autoplay = true;
  videoEl.setAttribute('muted', '');
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');

  if (videoEl.paused && videoEl.srcObject) {
    try {
      await videoEl.play();
    } catch {
      // Autoplay will resume on next frame or interaction
    }
  }

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
      videoEl.removeEventListener('playing', onCheck);
      resolve();
    };
    const onCheck = () => {
      if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        if (videoEl.paused) {
          videoEl.play().catch(() => {});
        }
        done();
      }
    };
    const timer = window.setTimeout(done, timeoutMs);
    videoEl.addEventListener('loadedmetadata', onCheck);
    videoEl.addEventListener('loadeddata', onCheck);
    videoEl.addEventListener('canplay', onCheck);
    videoEl.addEventListener('playing', onCheck);
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
 * Serializes frames, auto-clears any >1200ms hung WASM send promise, skips 0x0/unready video frames,
 * uses 2D canvas upload on Safari/macOS WebGL quirks, and auto-recovers on WASM errors.
 */
export async function sendHandsFrameSafe(
  videoEl: HTMLVideoElement | null,
  sessionToken: number,
  optionsForRecovery?: SharedHandsOptions
): Promise<boolean> {
  if (sessionToken !== activeSessionToken) return false;
  if (!sharedHandsInstance) return false;

  // Watchdog: if a previous WASM frame send hung for >1200ms (e.g., during macOS resolution/tab switch), unlock
  const now = Date.now();
  if (isSendingFrame) {
    if (lastSendStartTimestamp > 0 && now - lastSendStartTimestamp > 1200) {
      isSendingFrame = false;
    } else {
      return false;
    }
  }

  if (now < webglCircuitBrokenUntil) return false;
  if (!videoEl) return false;

  if (videoEl.paused && videoEl.srcObject) {
    videoEl.play().catch(() => {});
  }

  if (
    videoEl.readyState < 2 ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0 ||
    videoEl.paused ||
    videoEl.ended
  ) {
    return false;
  }

  const win = typeof window !== 'undefined' ? (window as any) : null;
  if (win?.__mpPreferCanvasFrameUpload) {
    useCanvasUploadFallback = true;
  }

  isSendingFrame = true;
  lastSendStartTimestamp = now;
  try {
    let imageSource: HTMLVideoElement | HTMLCanvasElement = videoEl;
    if (useCanvasUploadFallback || isMacOrIOS) {
      const canvasImg = getCanvasImageFromVideo(videoEl);
      if (canvasImg) imageSource = canvasImg;
    }

    await Promise.race([
      sharedHandsInstance.send({ image: imageSource }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Hands frame send timeout')), 1100)),
    ]);

    consecutiveSendErrors = 0;
    return true;
  } catch (err: any) {
    consecutiveSendErrors++;
    useCanvasUploadFallback = true;

    // First failure: retry via 2D offscreen canvas upload to bypass browser HTMLVideoElement texture quirks
    if (consecutiveSendErrors === 1) {
      try {
        const canvasImg = getCanvasImageFromVideo(videoEl);
        if (canvasImg && sharedHandsInstance && sessionToken === activeSessionToken) {
          await Promise.race([
            sharedHandsInstance.send({ image: canvasImg }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Hands canvas retry timeout')), 1100)),
          ]);
          consecutiveSendErrors = 0;
          return true;
        }
      } catch {
        // Proceed to recovery counter below
      }
    }

    // Rebuild with lite model (modelComplexity: 0) if repeated frame errors occur
    if (consecutiveSendErrors >= 4 && rebuildAttemptsThisSession < 2) {
      rebuildAttemptsThisSession++;
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
        webglCircuitBrokenUntil = Date.now() + 4000;
      }
    } else if (consecutiveSendErrors >= 6) {
      webglCircuitBrokenUntil = Date.now() + 3000;
      consecutiveSendErrors = 0;
    }
    return false;
  } finally {
    isSendingFrame = false;
  }
}
