import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  Firestore
} from 'firebase/firestore';

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
            // Evict large shared/transient caches first before touching user-saved games
            const evictPatterns = [
              'firestore_',
              'hamster_cached_admin_games',
              'hamster_cached_public_games',
              'hamster_cached_activities',
              'platform_cache_',
              'yogaClassicPoses_',
              'yogaCameraHandPoses_',
              'squid_hamster_class_dollars_v13',
              'hamster_cached_user_games',
            ];
            for (const pattern of evictPatterns) {
              const toEvict: string[] = [];
              for (let i = 0; i < this.length; i++) {
                const k = this.key(i);
                if (k && k !== key && k.startsWith(pattern)) {
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

export { auth, db, googleProvider, facebookProvider };


