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

    // 2. Wrap Storage.prototype.setItem so QuotaExceededError evicts non-essential caches instead of crashing
    const nativeSetItem = Storage.prototype.setItem;
    const memoryFallback = new Map<string, string>();
    Storage.prototype.setItem = function (key: string, value: string) {
      try {
        nativeSetItem.call(this, key, value);
      } catch (err: any) {
        if (
          err &&
          (err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.code === 22 ||
            err.code === 1014)
        ) {
          try {
            // Evict large transient cache entries to free space
            const evictPatterns = [
              'firestore_',
              'hamster_cached_user_games',
              'platform_cache_',
              'squid_hamster_class_dollars_v13',
              'yogaClassicPoses_',
              'yogaCameraHandPoses_',
            ];
            const toEvict: string[] = [];
            for (let i = 0; i < this.length; i++) {
              const k = this.key(i);
              if (k && k !== key && evictPatterns.some((p) => k.startsWith(p))) {
                toEvict.push(k);
              }
            }
            toEvict.forEach((k) => {
              try {
                this.removeItem(k);
              } catch {}
            });
            nativeSetItem.call(this, key, value);
            return;
          } catch {
            // Store in memory fallback rather than throwing an unhandled exception
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


