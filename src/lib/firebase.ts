import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  Firestore
} from 'firebase/firestore';

// Silence internal Firestore WebChannel stream console.error spam on daily quota backoff
try {
  setLogLevel('silent');
} catch {}

// Protect browser localStorage from QuotaExceededError which can crash Firestore's AsyncQueue
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    // 1. Purge stale Firestore WebStorage multi-tab synchronization keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('firestore_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    });

    // 2. Wrap Storage.prototype so QuotaExceededError evicts non-essential caches instead of crashing or losing writes
    const nativeGetItem = Storage.prototype.getItem;
    const nativeSetItem = Storage.prototype.setItem;
    const nativeRemoveItem = Storage.prototype.removeItem;
    const memoryFallback = new Map<string, string>();
    Storage.prototype.getItem = function (key: string) {
      const nativeVal = nativeGetItem.call(this, key);
      if (nativeVal !== null) return nativeVal;
      return memoryFallback.has(key) ? memoryFallback.get(key)! : null;
    };
    Storage.prototype.removeItem = function (key: string) {
      memoryFallback.delete(key);
      nativeRemoveItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      try {
        nativeSetItem.call(this, key, value);
        memoryFallback.delete(key);
      } catch (err: any) {
        if (
          err &&
          (err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.code === 22 ||
            err.code === 1014)
        ) {
          try {
            // Evict large shared/transient caches first while protecting active user class rosters
            const evictPatterns = [
              'firestore_',
              'hamster_cached_admin_games',
              'hamster_cached_public_games',
              'hamster_cached_activities',
              'platform_cache_',
              'yogaClassicPoses_',
              'yogaCameraHandPoses_',
              'hamster_cached_user_games',
              'hamster_esl_saved_games_v1',
              'squid_hamster_class_dollars_v13',
            ];
            for (const pattern of evictPatterns) {
              const toEvict: string[] = [];
              for (let i = 0; i < this.length; i++) {
                const k = this.key(i);
                if (
                  k &&
                  k !== key &&
                  !k.startsWith('squid_hamster_class_dollars_v14') &&
                  !k.startsWith('squid_class_meta_v1_') &&
                  k.startsWith(pattern)
                ) {
                  toEvict.push(k);
                }
              }
              toEvict.forEach((k) => {
                try {
                  nativeRemoveItem.call(this, k);
                } catch {}
              });
              try {
                nativeSetItem.call(this, key, value);
                memoryFallback.delete(key);
                return;
              } catch {}
            }
            memoryFallback.set(key, String(value));
            return;
          } catch {
            memoryFallback.set(key, String(value));
            return;
          }
        }
        throw err;
      }
    };
  } catch {}
}

const firebaseConfig = {
  projectId: "plucky-aegis-408915",
  appId: "1:564796706827:web:392d7514feecfd627f770e",
  apiKey: "AIzaSyDZHL0cknHt3W6gkIUQD0f2L-w8ZPBqTRw",
  authDomain: "plucky-aegis-408915.firebaseapp.com",
  storageBucket: "plucky-aegis-408915.firebasestorage.app",
  messagingSenderId: "564796706827",
  measurementId: ""
};

const DATABASE_ID = "ai-studio-eslgamestudioai-3eb6c438-fab4-4cca-9a82-b91a4aede8f0";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let db: Firestore;
try {
  db = initializeFirestore(
    app,
    {
      localCache: memoryLocalCache(),
      ignoreUndefinedProperties: true,
    },
    DATABASE_ID
  );
} catch (e) {
  db = getFirestore(app, DATABASE_ID);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

const facebookProvider = new FacebookAuthProvider();

const FIRESTORE_QUOTA_KEY = 'hamster_firestore_quota_exhausted_v2';
const FIRESTORE_QUOTA_TTL_MS = 2 * 60 * 1000;
let firestoreQuotaExhausted = false;
let firestoreQuotaTrippedAt = 0;
let firestoreQuotaTrippedDay = '';
let firestoreQuotaLogged = false;
let serverQuotaCheckPromise: Promise<boolean> | null = null;
const firestoreQuotaListeners = new Set<(exhausted: boolean) => void>();

if (typeof window !== 'undefined') {
  try {
    window.localStorage?.removeItem('hamster_firestore_quota_exhausted_v1');
    window.sessionStorage?.removeItem('hamster_firestore_quota_exhausted_v1');
  } catch {}
}

function getPacificDayKey(nowMs: number = Date.now()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(nowMs));
  } catch {
    return new Date(nowMs).toISOString().slice(0, 10);
  }
}

export function isFirestoreQuotaError(error: unknown): boolean {
  if (!error) return false;
  const code = String((error as any)?.code || '').toLowerCase();
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('free daily write units') ||
    msg.includes('free daily')
  );
}

function readPersistedQuotaFlag(now: number, todayPt: string): number | null {
  if (typeof window === 'undefined') return null;
  const storages: Storage[] = [];
  try {
    if (window.sessionStorage) storages.push(window.sessionStorage);
  } catch {}
  try {
    if (window.localStorage) storages.push(window.localStorage);
  } catch {}

  for (const store of storages) {
    try {
      const raw = store.getItem(FIRESTORE_QUOTA_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        (parsed.ptDay === todayPt || parsed.day === todayPt) &&
        typeof parsed.at === 'number' &&
        now - parsed.at < FIRESTORE_QUOTA_TTL_MS
      ) {
        return parsed.at;
      }
      store.removeItem(FIRESTORE_QUOTA_KEY);
    } catch {}
  }
  return null;
}

export function isFirestoreQuotaExhausted(): boolean {
  const now = Date.now();
  const todayPt = getPacificDayKey(now);

  if (firestoreQuotaExhausted) {
    if (firestoreQuotaTrippedDay !== todayPt || now - firestoreQuotaTrippedAt > FIRESTORE_QUOTA_TTL_MS) {
      firestoreQuotaExhausted = false;
      firestoreQuotaTrippedAt = 0;
      firestoreQuotaTrippedDay = '';
      firestoreQuotaLogged = false;
    } else {
      return true;
    }
  }

  const persistedAt = readPersistedQuotaFlag(now, todayPt);
  if (persistedAt !== null) {
    firestoreQuotaExhausted = true;
    firestoreQuotaTrippedAt = persistedAt;
    firestoreQuotaTrippedDay = todayPt;
    return true;
  }

  return false;
}

export async function ensureServerQuotaChecked(): Promise<boolean> {
  if (isFirestoreQuotaExhausted()) return true;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
  if (serverQuotaCheckPromise) return serverQuotaCheckPromise;

  serverQuotaCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 450);
      const resp = await fetch('/api/firestore-quota-status', {
        method: 'GET',
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      if (!resp.ok) return false;
      const data = await resp.json();
      if (data && data.exhausted) {
        const at = typeof data.exhaustedAt === 'number' ? data.exhaustedAt : Date.now();
        const todayPt = getPacificDayKey(at);
        firestoreQuotaExhausted = true;
        firestoreQuotaTrippedAt = at;
        firestoreQuotaTrippedDay = todayPt;
        const serialized = JSON.stringify({ at, day: todayPt, ptDay: todayPt });
        try { window.sessionStorage?.setItem(FIRESTORE_QUOTA_KEY, serialized); } catch {}
        try { window.localStorage?.setItem(FIRESTORE_QUOTA_KEY, serialized); } catch {}
        return true;
      }
    } catch {}
    return false;
  })();

  return serverQuotaCheckPromise;
}

// Kick off lightweight cross-tab server quota check immediately on module load
if (typeof window !== 'undefined') {
  ensureServerQuotaChecked().catch(() => {});
}

export function markFirestoreQuotaExhausted(error?: unknown): void {
  const now = Date.now();
  const todayPt = getPacificDayKey(now);
  const wasExhausted = firestoreQuotaExhausted;
  firestoreQuotaExhausted = true;
  firestoreQuotaTrippedAt = now;
  firestoreQuotaTrippedDay = todayPt;

  const serialized = JSON.stringify({ at: now, day: todayPt, ptDay: todayPt });
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage?.setItem(FIRESTORE_QUOTA_KEY, serialized);
    } catch {}
    try {
      window.localStorage?.setItem(FIRESTORE_QUOTA_KEY, serialized);
    } catch {}
    try {
      fetch('/api/firestore-quota-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exhausted: true }),
      }).catch(() => {});
    } catch {}
  }

  if (!firestoreQuotaLogged) {
    firestoreQuotaLogged = true;
    const detail = error instanceof Error ? error.message : error ? String(error) : '';
    console.warn(
      'Firestore database daily quota limit reached — pausing cloud writes temporarily and using server/local sync instead.',
      detail
    );
  }

  if (!wasExhausted) {
    firestoreQuotaListeners.forEach((cb) => {
      try {
        cb(true);
      } catch {}
    });
  }
}

export function onFirestoreQuotaChange(listener: (exhausted: boolean) => void): () => void {
  firestoreQuotaListeners.add(listener);
  return () => {
    firestoreQuotaListeners.delete(listener);
  };
}

export async function safeFirestoreWrite<T = void>(
  op: () => Promise<T>
): Promise<{ ok: boolean; result?: T; quotaExhausted: boolean; error?: unknown }> {
  if (await ensureServerQuotaChecked()) {
    return { ok: false, quotaExhausted: true };
  }
  try {
    const result = await op();
    return { ok: true, result, quotaExhausted: false };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      markFirestoreQuotaExhausted(err);
      return { ok: false, quotaExhausted: true, error: err };
    }
    return { ok: false, quotaExhausted: false, error: err };
  }
}

export { auth, db, googleProvider, facebookProvider };
