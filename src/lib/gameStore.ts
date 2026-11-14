export interface StoredGame {
  id: string;
  name: string;
  title?: string;
  topic?: string;
  className?: string;
  classLevel?: string;
  folderId?: string;
  gameType: string;
  originalGameType?: string;
  customQuestions: any[];
  cards?: any[];
  cardSides?: 1 | 2;
  contentMode?: string;
  theme?: string;
  questions?: any[];
  userId?: string;
  creatorName?: string;
  creatorEmail?: string;
  isPublic?: boolean;
  publishedAt?: any;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

const LOCAL_GAMES_KEY = 'hamster_esl_saved_games_v1';
const LOCAL_FOLDERS_KEY = 'hamster_esl_saved_folders_v1';

const DEFAULT_SAMPLE_GAMES: StoredGame[] = [
  {
    id: 'sample-bubble-pop-1',
    name: 'Present Simple & Question Tags',
    topic: 'Present Simple & Question Tags',
    className: 'Grade 4 · A2',
    gameType: 'bubble-pop',
    originalGameType: 'bubble-pop',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customQuestions: [
      { id: 1, text: "She ____ to school every morning.", options: ["goes", "go", "going", "gone"], answerIndex: 0 },
      { id: 2, text: "He is happy today, ____?", options: ["isn't he?", "is he?", "aren't they?", "doesn't he?"], answerIndex: 0 },
      { id: 3, text: "They are playing football, ____?", options: ["aren't they?", "are they?", "isn't he?", "don't they?"], answerIndex: 0 },
      { id: 4, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."], answerIndex: 0 },
      { id: 5, text: "What is the past tense of 'eat'?", options: ["Ate", "Eated", "Eating", "Eats"], answerIndex: 0 },
    ],
  },
  {
    id: 'sample-yoga-1',
    name: 'Action Verbs & Standing Poses',
    topic: 'Action Verbs & Grammar',
    className: 'Starters · All Levels',
    gameType: 'yoga-quiz',
    originalGameType: 'yoga-quiz',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customQuestions: [
      { id: 1, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."], answerIndex: 0 },
      { id: 2, text: "What is the past tense of 'eat'?", options: ["Ate", "Eated", "Eating", "Eats"], answerIndex: 0 },
      { id: 3, text: "Which of these is a fruit?", options: ["Apple", "Carrot", "Potato", "Broccoli"], answerIndex: 0 },
      { id: 4, text: "They ____ to school by bus every day.", options: ["go", "goes", "gone", "going"], answerIndex: 0 },
      { id: 5, text: "Choose the opposite of 'Difficult':", options: ["Easy", "Hard", "Tough", "Heavy"], answerIndex: 0 },
    ],
  },
  {
    id: 'sample-sumo-1',
    name: 'Sumo Question Tags Showdown',
    topic: 'Question Tags',
    className: 'KET · Grade 5',
    gameType: 'sumo',
    originalGameType: 'sumo',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customQuestions: [
      { id: 1, text: "You can swim well, ____?", options: ["can't you?", "can you?", "don't you?", "aren't you?"], answerIndex: 0 },
      { id: 2, text: "Tom likes chocolate, ____?", options: ["doesn't he?", "does he?", "isn't he?", "don't he?"], answerIndex: 0 },
      { id: 3, text: "It isn't raining now, ____?", options: ["is it?", "isn't it?", "does it?", "was it?"], answerIndex: 0 },
      { id: 4, text: "We have finished our homework, ____?", options: ["haven't we?", "have we?", "don't we?", "aren't we?"], answerIndex: 0 },
    ],
  },
  {
    id: 'sample-mystery-1',
    name: 'Mystery Box Classroom Trivia',
    topic: 'Vocabulary & General English',
    className: 'Movers · Flyers',
    gameType: 'mystery-box',
    originalGameType: 'mystery-box',
    isPublic: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customQuestions: [
      { id: 1, text: "Which animal is the largest mammal in the ocean?", options: ["Blue Whale", "Great White Shark", "Dolphin", "Octopus"], answerIndex: 0 },
      { id: 2, text: "How many continents are there on Earth?", options: ["7", "5", "6", "8"], answerIndex: 0 },
      { id: 3, text: "What is the comparative form of 'good'?", options: ["better", "gooder", "more good", "best"], answerIndex: 0 },
      { id: 4, text: "Yesterday, we ____ a great movie.", options: ["watched", "watch", "watching", "watches"], answerIndex: 0 },
    ],
  },
];

export function getSavedGames(): StoredGame[] {
  try {
    const raw = localStorage.getItem(LOCAL_GAMES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(DEFAULT_SAMPLE_GAMES));
      return DEFAULT_SAMPLE_GAMES;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {}
  return DEFAULT_SAMPLE_GAMES;
}

export function saveGameRecord(game: Partial<StoredGame> & { id?: string | number }): StoredGame {
  const existing = getSavedGames();
  const idStr = game.id ? String(game.id) : `game-${Date.now()}`;
  const idx = existing.findIndex(g => String(g.id) === idStr);

  const now = new Date().toISOString();
  const record: StoredGame = {
    ...game,
    id: idStr,
    name: game.name || game.title || game.topic || 'Untitled Quiz',
    title: game.title || game.name || game.topic || 'Untitled Quiz',
    topic: game.topic || game.name || '',
    className: game.className || '',
    folderId: game.folderId || '',
    gameType: game.gameType || 'bubble-pop',
    originalGameType: game.originalGameType || game.gameType || 'bubble-pop',
    customQuestions: game.customQuestions || [],
    userId: game.userId || 'teacher-studio-user',
    isPublic: game.isPublic ?? true,
    createdAt: idx >= 0 ? existing[idx].createdAt : now,
    updatedAt: now,
  };

  if (idx >= 0) {
    existing[idx] = record;
  } else {
    existing.unshift(record);
  }

  try {
    localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(existing));
  } catch (e) {}
  return record;
}

export function deleteGameRecord(id: string | number) {
  const existing = getSavedGames().filter(g => String(g.id) !== String(id));
  try {
    localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(existing));
  } catch (e) {}
}

export const PRESET_FOLDER_IDS = new Set([
  'folder-grammar',
  'folder-vocab',
  'folder-phonics',
  'folder-speaking',
  'folder-exam',
  'folder-warmup',
]);

const DELETED_FOLDERS_KEY_PREFIX = 'hamster_deleted_folders_v1_';

export function getUserFoldersCacheKey(userId?: string | null): string {
  return userId ? `hamster_cached_user_folders_u_${userId}` : 'hamster_cached_user_folders';
}

export function getDeletedFolderIds(userId?: string | null): Set<string> {
  const result = new Set<string>();
  try {
    if (userId) {
      const raw = localStorage.getItem(`${DELETED_FOLDERS_KEY_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) parsed.forEach((id) => result.add(String(id)));
      }
    }
  } catch {}
  return result;
}

export function markFolderDeleted(folderId: string, userId?: string | null): void {
  const cleanId = String(folderId || '').trim();
  if (!cleanId) return;
  try {
    if (userId) {
      const set = getDeletedFolderIds(userId);
      set.add(cleanId);
      localStorage.setItem(`${DELETED_FOLDERS_KEY_PREFIX}${userId}`, JSON.stringify(Array.from(set)));
    }
  } catch {}
  fetch('/api/platform-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedFolderIds: [cleanId] }),
  }).catch(() => {});
}

export function getSavedFolders(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((f: any) => f && f.id && !PRESET_FOLDER_IDS.has(String(f.id)));
      }
    }
  } catch (e) {}
  return [];
}

export function saveFoldersList(folders: { id: string; name: string }[]) {
  try {
    const cleaned = (folders || []).filter((f) => f && f.id && !PRESET_FOLDER_IDS.has(String(f.id)));
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(cleaned));
  } catch (e) {}
}

export interface UnifiedFolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  userId?: string;
  createdAt?: any;
  updatedAt?: any;
  inferred?: boolean;
}

function withTimeoutPromise<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);
    promise
      .then((val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      })
      .catch(() => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      });
  });
}

/**
 * Merges folders from explicit sources and local user caches,
 * deduplicating by both ID and case-insensitive (parentId, name),
 * never injecting uncreated preset folders or folders owned by another user.
 */
export function mergeUserFolders(
  userId: string | null | undefined,
  ...sources: Array<Array<{ id: string; name: string; parentId?: string | null; [key: string]: any }> | undefined | null>
): UnifiedFolderItem[] {
  const result: UnifiedFolderItem[] = [];
  const indexById = new Map<string, number>();
  const indexByName = new Map<string, number>();
  const deletedIds = getDeletedFolderIds(userId);

  const addList = (list?: Array<any> | null, enforceUserMatch = false) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !item.id || !item.name) continue;
      const cleanId = String(item.id).trim();
      const cleanName = String(item.name).trim();
      if (!cleanId || !cleanName) continue;
      if (PRESET_FOLDER_IDS.has(cleanId) || deletedIds.has(cleanId)) continue;

      if (userId && item.userId && String(item.userId) !== String(userId)) continue;
      if (enforceUserMatch && userId && !item.userId) {
        // Legacy unscoped item: only include if we don't have a scoped conflict, stamp with userId
      }

      const nameKey = `${item.parentId || 'root'}::${cleanName.toLowerCase()}`;
      const existingIdx = indexById.get(cleanId) ?? indexByName.get(nameKey);
      const normalized: UnifiedFolderItem = {
        ...item,
        id: cleanId,
        name: cleanName,
        parentId: item.parentId || null,
        userId: item.userId || userId || undefined,
      };

      if (existingIdx !== undefined) {
        const prev = result[existingIdx];
        // Prefer non-inferred real folders over inferred placeholders
        if (prev.inferred && !normalized.inferred) {
          result[existingIdx] = normalized;
          indexById.set(cleanId, existingIdx);
          indexByName.set(nameKey, existingIdx);
        }
        continue;
      }

      const idx = result.length;
      result.push(normalized);
      indexById.set(cleanId, idx);
      indexByName.set(nameKey, idx);
    }
  };

  // 1. Explicit passed sources (e.g. Firestore & server cache folders from caller)
  for (const src of sources) {
    addList(src, false);
  }

  // 2. Scoped user folder cache
  if (userId) {
    try {
      const scopedRaw = localStorage.getItem(getUserFoldersCacheKey(userId));
      if (scopedRaw) addList(JSON.parse(scopedRaw), true);
    } catch {}
  }

  // 3. Fallback legacy cached user folders (strictly filtered by userId)
  try {
    const cachedUser = localStorage.getItem('hamster_cached_user_folders');
    if (cachedUser) addList(JSON.parse(cachedUser), true);
  } catch {}

  // 4. Custom setup folders created in Game Setup (strictly filtered by userId)
  try {
    const customSetup = localStorage.getItem('esl_custom_setup_folders');
    if (customSetup) addList(JSON.parse(customSetup), true);
  } catch {}

  return result;
}

export function mergeAllFolders(
  ...sources: Array<Array<{ id: string; name: string; parentId?: string | null; [key: string]: any }> | undefined | null>
): UnifiedFolderItem[] {
  let detectedUserId: string | undefined;
  for (const src of sources) {
    if (Array.isArray(src)) {
      const match = src.find((item) => item?.userId);
      if (match?.userId) {
        detectedUserId = String(match.userId);
        break;
      }
    }
  }
  return mergeUserFolders(detectedUserId, ...sources);
}

/**
 * Fetches folders owned ONLY by `userId` from Firestore `gameFolders` + `/api/platform-cache`,
 * syncs them to user-scoped localStorage cache, and merges cleanly without preset folders.
 */
export async function fetchAllAvailableFolders(
  db: any,
  userId?: string | null
): Promise<UnifiedFolderItem[]> {
  if (!userId) {
    return [];
  }

  const deletedIds = getDeletedFolderIds(userId);
  const firestoreFolders: UnifiedFolderItem[] = [];
  const serverFolders: UnifiedFolderItem[] = [];

  const serverPromise = fetch('/api/platform-cache')
    .then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.deletedFolderIds)) {
        const mergedDel = getDeletedFolderIds(userId);
        data.deletedFolderIds.forEach((id: any) => mergedDel.add(String(id)));
        try {
          localStorage.setItem(`${DELETED_FOLDERS_KEY_PREFIX}${userId}`, JSON.stringify(Array.from(mergedDel)));
        } catch {}
      }
      if (Array.isArray(data?.folders)) {
        data.folders.forEach((f: any) => {
          if (!f || !f.id || !f.name) return;
          if (f.userId && String(f.userId) !== String(userId)) return;
          if (PRESET_FOLDER_IDS.has(String(f.id)) || deletedIds.has(String(f.id))) return;
          serverFolders.push({
            id: String(f.id),
            name: String(f.name),
            parentId: f.parentId || null,
            userId: f.userId || userId,
            createdAt: f.createdAt,
            updatedAt: f.updatedAt,
            inferred: Boolean(f.inferred),
          });
        });
      }
    })
    .catch(() => {});

  const firestorePromise = (async () => {
    if (!db) return;
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const userSnap = await withTimeoutPromise(
        getDocs(query(collection(db, 'gameFolders'), where('userId', '==', userId))),
        3000,
        null as any
      );
      if (userSnap && typeof userSnap.forEach === 'function') {
        userSnap.forEach((d: any) => {
          const data = d.data() as any;
          if (data?.name && !deletedIds.has(d.id) && !PRESET_FOLDER_IDS.has(d.id)) {
            firestoreFolders.push({
              id: d.id,
              name: data.name,
              parentId: data.parentId || null,
              userId: data.userId || userId,
              createdAt: data.createdAt,
            });
          }
        });
      }
    } catch {}
  })();

  await Promise.all([serverPromise, firestorePromise]);

  const merged = mergeUserFolders(userId, firestoreFolders, serverFolders);
  try {
    localStorage.setItem(getUserFoldersCacheKey(userId), JSON.stringify(merged));
    localStorage.setItem('hamster_cached_user_folders', JSON.stringify(merged));
  } catch {}

  const realFolders = merged.filter((f) => !f.inferred);
  if (realFolders.length > 0) {
    fetch('/api/platform-cache', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders: realFolders }),
    }).catch(() => {});
  }

  return merged;
}

/**
 * Creates a new folder in Firestore `gameFolders` (with timeout fallback),
 * backend `/api/platform-cache`, and scoped local caches.
 */
export async function createUnifiedFolder(
  db: any,
  userId: string | null | undefined,
  name: string,
  parentId: string | null = null
): Promise<UnifiedFolderItem> {
  const cleanName = name.trim();
  let folderId = `folder-${Date.now()}`;
  const createdAt = new Date().toISOString();

  if (db && userId) {
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const docRef = await withTimeoutPromise(
        addDoc(collection(db, 'gameFolders'), {
          name: cleanName,
          parentId: parentId || null,
          userId,
          createdAt,
        }),
        3000,
        null as any
      );
      if (docRef?.id) {
        folderId = docRef.id;
      }
    } catch {}
  }

  const newFolder: UnifiedFolderItem = {
    id: folderId,
    name: cleanName,
    parentId: parentId || null,
    userId: userId || 'teacher-studio-user',
    createdAt,
    updatedAt: createdAt,
  };

  try {
    const nextList = mergeUserFolders(userId, [newFolder]);
    if (userId) {
      localStorage.setItem(getUserFoldersCacheKey(userId), JSON.stringify(nextList));
    }
    localStorage.setItem('hamster_cached_user_folders', JSON.stringify(nextList));
  } catch {}

  try {
    const customRaw = localStorage.getItem('esl_custom_setup_folders');
    const customList = customRaw ? JSON.parse(customRaw) : [];
    const nextCustom = Array.isArray(customList)
      ? [...customList.filter((f: any) => f && (!userId || !f.userId || f.userId === userId)), newFolder]
      : [newFolder];
    localStorage.setItem('esl_custom_setup_folders', JSON.stringify(nextCustom));
  } catch {}

  fetch('/api/platform-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folders: [newFolder] }),
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hamster-folders-updated', { detail: newFolder }));
  }

  return newFolder;
}

