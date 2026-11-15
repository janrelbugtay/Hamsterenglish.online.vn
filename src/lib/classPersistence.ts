import {
  auth,
  db,
  isFirestoreQuotaError,
  isFirestoreQuotaExhausted,
  markFirestoreQuotaExhausted,
  safeFirestoreWrite,
} from './firebase';
import { doc, getDoc, getDocFromServer, setDoc } from 'firebase/firestore';

export const ACTIVE_CLASS_STORAGE_KEY = 'squid_hamster_class_dollars_v14';
export const CLASS_META_STORAGE_PREFIX = 'squid_class_meta_v1_';
export const BIN_CLASSES_STORAGE_KEY = 'squid_hamster_class_bin_v1';
export const BIN_STUDENTS_STORAGE_KEY = 'squid_hamster_student_bin_v1';

const IDB_NAME = 'hamster_class_rewards_db_v1';
const IDB_STORE = 'class_snapshots';
const IDB_VERSION = 1;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isQuotaExceededError(error: unknown): boolean {
  return isFirestoreQuotaError(error);
}

export function isPermissionDeniedError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
  const code = String((error as any)?.code || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission_denied')
  );
}

let connectionValidated = false;
export async function validateFirestoreConnectionOnce(): Promise<void> {
  if (connectionValidated || typeof window === 'undefined') return;
  connectionValidated = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export interface PersistedClassSnapshot<TClass = any, TReward = any, TDeletedStudent = any> {
  userId?: string;
  email?: string;
  classes: TClass[];
  customRewards?: TReward[];
  deletedClasses?: TClass[];
  deletedStudents?: TDeletedStudent[];
  updatedAt: number;
  intentionalEmptyReset?: boolean;
}

function openClassIDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const database = req.result;
        if (!database.objectStoreNames.contains(IDB_STORE)) {
          database.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function writeClassSnapshotToIDB(
  uid: string | null | undefined,
  snapshot: PersistedClassSnapshot
): Promise<void> {
  const idb = await openClassIDB();
  if (!idb) return;
  const keys = uid ? [`user_${uid}`, '__latest_active__'] : ['__latest_active__'];
  await Promise.all(
    keys.map(
      (key) =>
        new Promise<void>((resolve) => {
          try {
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put({ ...snapshot, key });
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
          } catch {
            resolve();
          }
        })
    )
  );
}

export async function readClassSnapshotFromIDB(
  uid?: string | null
): Promise<PersistedClassSnapshot | null> {
  const idb = await openClassIDB();
  if (!idb) return null;

  const readKey = (key: string) =>
    new Promise<PersistedClassSnapshot | null>((resolve) => {
      try {
        const tx = idb.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

  if (uid) {
    const userSnap = await readKey(`user_${uid}`);
    if (userSnap && Array.isArray(userSnap.classes) && userSnap.classes.length > 0) {
      return userSnap;
    }
    const latest = await readKey('__latest_active__');
    if (latest && (!latest.userId || latest.userId === uid)) {
      return latest;
    }
    return userSnap;
  }

  return readKey('__latest_active__');
}

export function getScopedClassStorageKey(uid?: string | null): string {
  return uid ? `${ACTIVE_CLASS_STORAGE_KEY}_${uid}` : ACTIVE_CLASS_STORAGE_KEY;
}

export function getLocalClassUpdatedAt(uid?: string | null): number {
  if (typeof window === 'undefined') return 0;
  try {
    const scoped = uid ? localStorage.getItem(`${CLASS_META_STORAGE_PREFIX}${uid}`) : null;
    const globalMeta = localStorage.getItem(`${CLASS_META_STORAGE_PREFIX}global`);
    const raw = scoped || globalMeta;
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Number(parsed?.updatedAt) || 0;
  } catch {
    return 0;
  }
}

export function getLocalIntentionalEmpty(uid?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const scoped = uid ? localStorage.getItem(`${CLASS_META_STORAGE_PREFIX}${uid}`) : null;
    const globalMeta = localStorage.getItem(`${CLASS_META_STORAGE_PREFIX}global`);
    const raw = scoped || globalMeta;
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.intentionalEmptyReset);
  } catch {
    return false;
  }
}

export function saveClassesToLocalStorage<TClass = any>(
  classes: TClass[],
  uid?: string | null,
  updatedAt: number = Date.now(),
  intentionalEmptyReset = false
): void {
  if (typeof window === 'undefined') return;
  const serialized = JSON.stringify(classes);
  const meta = JSON.stringify({ updatedAt, intentionalEmptyReset, count: classes.length });
  try {
    localStorage.setItem(ACTIVE_CLASS_STORAGE_KEY, serialized);
    localStorage.setItem(`${CLASS_META_STORAGE_PREFIX}global`, meta);
    if (uid) {
      localStorage.setItem(getScopedClassStorageKey(uid), serialized);
      localStorage.setItem(`${CLASS_META_STORAGE_PREFIX}${uid}`, meta);
    }
  } catch (e) {
    console.warn('LocalStorage write warning (IndexedDB & Server still active):', e);
  }
}

export function scanAllLocalClassBackups<TClass = any>(
  uid?: string | null,
  isMockPredicate?: (list: TClass[]) => boolean
): { classes: TClass[]; updatedAt: number; sourceKey: string } | null {
  if (typeof window === 'undefined') return null;

  const candidateKeys: string[] = [];
  if (uid) {
    candidateKeys.push(getScopedClassStorageKey(uid));
    candidateKeys.push(`squid_user_classes_${uid}`);
  }
  candidateKeys.push(
    ACTIVE_CLASS_STORAGE_KEY,
    'squid_hamster_class_dollars_v13',
    'squid_user_classes',
    'squid_hamster_class_dollars_v12',
    'squid_hamster_class_dollars_v11',
    'squid_hamster_class_dollars_v10',
    'squid_hamster_class_dollars_v9',
    'squid_hamster_class_dollars_v8',
    'squid_hamster_class_dollars'
  );

  // Also scan any dynamic per-user v14 keys if uid wasn't known at creation time
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('squid_hamster_class_dollars_v14_') && !candidateKeys.includes(k)) {
        if (!uid || k.endsWith(uid)) {
          candidateKeys.push(k);
        }
      }
    }
  } catch {}

  const updatedAt = getLocalClassUpdatedAt(uid);

  for (const key of candidateKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (isMockPredicate && isMockPredicate(parsed)) continue;
        return { classes: parsed, updatedAt, sourceKey: key };
      }
    } catch {}
  }

  return null;
}

export async function pushClassSnapshotToServerReliable(
  uid: string,
  payload: {
    email?: string | null;
    classes?: any[];
    customRewards?: any[];
    deletedClasses?: any[];
    deletedStudents?: any[];
    updatedAt?: number;
    intentionalEmptyReset?: boolean;
    replaceCustomRewards?: boolean;
  }
): Promise<boolean> {
  if (!uid) return false;
  const bodyStr = JSON.stringify({
    userId: uid,
    email: payload.email || undefined,
    ...payload,
    updatedAt: payload.updatedAt || Date.now(),
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/class-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      });
      if (res.ok) return true;
    } catch {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
  return false;
}

export async function fetchClassSnapshotFromServer(
  uid: string,
  email?: string | null
): Promise<PersistedClassSnapshot | null> {
  if (!uid) return null;
  try {
    const params = new URLSearchParams({ userId: uid });
    if (email) params.set('email', email);
    const res = await fetch(`/api/class-data?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || typeof data !== 'object') return null;
    return {
      userId: uid,
      email: email || undefined,
      classes: Array.isArray(data.classes) ? data.classes : [],
      customRewards: Array.isArray(data.customRewards) ? data.customRewards : [],
      deletedClasses: Array.isArray(data.deletedClasses) ? data.deletedClasses : [],
      deletedStudents: Array.isArray(data.deletedStudents) ? data.deletedStudents : [],
      updatedAt: Number(data.updatedAt) || 0,
      intentionalEmptyReset: Boolean(data.intentionalEmptyReset),
    };
  } catch {
    return null;
  }
}

export async function fetchClassSnapshotFromFirestore(
  uid: string,
  timeoutMs = 3500
): Promise<{
  snapshot: PersistedClassSnapshot | null;
  quotaExceeded: boolean;
  errorMessage?: string;
}> {
  if (!uid) return { snapshot: null, quotaExceeded: false };

  let quotaExceeded = false;
  let errorMessage: string | undefined;

  const timedGet = (pathSegments: [string, ...string[]]) =>
    new Promise<any>((resolve) => {
      let settled = false;
      const fullPath = pathSegments.join('/');
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, timeoutMs);

      getDoc(doc(db, ...pathSegments))
        .then((snap) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(snap);
          }
        })
        .catch((err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            if (isPermissionDeniedError(err)) {
              try {
                handleFirestoreError(err, OperationType.GET, fullPath);
              } catch (structuredErr: any) {
                errorMessage = structuredErr?.message;
              }
            } else if (isQuotaExceededError(err)) {
              quotaExceeded = true;
              markFirestoreQuotaExhausted(err);
              errorMessage = err instanceof Error ? err.message : String(err);
            }
            resolve(null);
          }
        });
    });

  const [primarySnap, backupSnap] = await Promise.all([
    timedGet(['userClassData', uid]),
    timedGet(['users', uid, 'classesData', 'current']),
  ]);

  const extract = (snap: any): PersistedClassSnapshot | null => {
    if (!snap || typeof snap.exists !== 'function' || !snap.exists()) return null;
    const d = snap.data();
    if (!d || !Array.isArray(d.classes)) return null;
    return {
      userId: uid,
      classes: d.classes,
      deletedClasses: Array.isArray(d.deletedClasses) ? d.deletedClasses : undefined,
      deletedStudents: Array.isArray(d.deletedStudents) ? d.deletedStudents : undefined,
      updatedAt: Number(d.updatedAt) || 0,
      intentionalEmptyReset: Boolean(d.intentionalEmptyReset),
    };
  };

  const p = extract(primarySnap);
  const b = extract(backupSnap);

  if (p && b) {
    if ((p.classes.length > 0 && b.classes.length === 0) && !b.intentionalEmptyReset) {
      return { snapshot: p, quotaExceeded, errorMessage };
    }
    if ((b.classes.length > 0 && p.classes.length === 0) && !p.intentionalEmptyReset) {
      return { snapshot: b, quotaExceeded, errorMessage };
    }
    return {
      snapshot: (p.updatedAt || 0) >= (b.updatedAt || 0) ? p : b,
      quotaExceeded,
      errorMessage,
    };
  }

  return { snapshot: p || b, quotaExceeded, errorMessage };
}

export async function syncClassSnapshotToFirestore(
  uid: string,
  payload: {
    classes: any[];
    deletedClasses?: any[];
    deletedStudents?: any[];
    updatedAt: number;
    intentionalEmptyReset?: boolean;
  }
): Promise<{ ok: boolean; quotaExceeded: boolean }> {
  if (!uid) return { ok: false, quotaExceeded: false };
  if (isFirestoreQuotaExhausted()) {
    return { ok: false, quotaExceeded: true };
  }
  let quotaExceeded = false;

  const writeOne = async (pathSegments: [string, ...string[]]) => {
    if (isFirestoreQuotaExhausted()) {
      quotaExceeded = true;
      return false;
    }
    const fullPath = pathSegments.join('/');
    const res = await safeFirestoreWrite(() =>
      setDoc(doc(db, ...pathSegments), payload, { merge: true })
    );
    if (res.ok) return true;
    if (res.quotaExhausted) {
      quotaExceeded = true;
      return false;
    }
    if (res.error && isPermissionDeniedError(res.error)) {
      try {
        handleFirestoreError(res.error, OperationType.WRITE, fullPath);
      } catch {}
    }
    return false;
  };

  const ok1 = await writeOne(['userClassData', uid]);
  const ok2 = quotaExceeded ? false : await writeOne(['users', uid, 'classesData', 'current']);

  return { ok: ok1 || ok2, quotaExceeded };
}

/**
 * Chooses the most authoritative class list across LocalStorage, IndexedDB, Server, and Firestore
 * so newer edits are never overwritten by stale snapshots and empty initial mounts never wipe classes.
 */
export function pickBestClassSnapshot<TClass extends { id: string }>(
  candidates: Array<{
    source: string;
    snapshot: PersistedClassSnapshot<TClass> | null | undefined;
  }>,
  isMockPredicate?: (list: TClass[]) => boolean
): { source: string; snapshot: PersistedClassSnapshot<TClass> } | null {
  const valid = candidates
    .filter((c): c is { source: string; snapshot: PersistedClassSnapshot<TClass> } => {
      if (!c.snapshot || !Array.isArray(c.snapshot.classes)) return false;
      if (c.snapshot.classes.length > 0 && isMockPredicate?.(c.snapshot.classes)) return false;
      return c.snapshot.classes.length > 0 || Boolean(c.snapshot.intentionalEmptyReset);
    });

  if (valid.length === 0) return null;

  const nonEmpty = valid.filter((v) => v.snapshot.classes.length > 0);
  const emptyResets = valid.filter(
    (v) => v.snapshot.classes.length === 0 && v.snapshot.intentionalEmptyReset
  );

  // Only honor an empty reset if its timestamp is strictly newer than every non-empty backup
  if (emptyResets.length > 0 && nonEmpty.length > 0) {
    const newestEmpty = Math.max(...emptyResets.map((e) => e.snapshot.updatedAt || 0));
    const newestNonEmpty = Math.max(...nonEmpty.map((n) => n.snapshot.updatedAt || 0));
    if (newestEmpty > newestNonEmpty && newestNonEmpty > 0) {
      return emptyResets.sort((a, b) => (b.snapshot.updatedAt || 0) - (a.snapshot.updatedAt || 0))[0];
    }
  }

  const pool = nonEmpty.length > 0 ? nonEmpty : valid;
  pool.sort((a, b) => {
    const timeDiff = (b.snapshot.updatedAt || 0) - (a.snapshot.updatedAt || 0);
    if (Math.abs(timeDiff) > 1000) return timeDiff;
    // Tie-breaker: prefer snapshot with more classes or more total students
    if (b.snapshot.classes.length !== a.snapshot.classes.length) {
      return b.snapshot.classes.length - a.snapshot.classes.length;
    }
    const studentsA = a.snapshot.classes.reduce(
      (sum, cls: any) => sum + (Array.isArray(cls.students) ? cls.students.length : 0),
      0
    );
    const studentsB = b.snapshot.classes.reduce(
      (sum, cls: any) => sum + (Array.isArray(cls.students) ? cls.students.length : 0),
      0
    );
    return studentsB - studentsA;
  });

  return pool[0];
}
