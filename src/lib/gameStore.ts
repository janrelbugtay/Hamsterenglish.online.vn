export interface StoredGame {
  id: string;
  name: string;
  title?: string;
  topic?: string;
  className?: string;
  folderId?: string;
  gameType: string;
  originalGameType?: string;
  customQuestions: any[];
  userId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export function getSavedFolders(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [
    { id: 'folder-grammar', name: 'Grammar Sets' },
    { id: 'folder-vocab', name: 'Vocabulary' },
    { id: 'folder-phonics', name: 'Phonics & Reading' },
    { id: 'folder-speaking', name: 'Speaking & Conversation' },
    { id: 'folder-exam', name: 'Exam Prep (KET / Starters)' },
    { id: 'folder-warmup', name: 'Classroom Warm-Ups' },
  ];
}

export function saveFoldersList(folders: { id: string; name: string }[]) {
  try {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  } catch (e) {}
}

export interface UnifiedFolderItem {
  id: string;
  name: string;
  parentId?: string | null;
  userId?: string;
  createdAt?: any;
}

/**
 * Merges folders from Firestore, cached user folders, custom setup folders, and default saved folders,
 * deduplicating by both ID and case-insensitive name (preferring real Firestore/user folders first).
 */
export function mergeAllFolders(
  ...sources: Array<Array<{ id: string; name: string; parentId?: string | null; [key: string]: any }> | undefined | null>
): UnifiedFolderItem[] {
  const result: UnifiedFolderItem[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  const addList = (list?: Array<any> | null) => {
    if (!Array.isArray(list)) return;
    for (const item of list) {
      if (!item || !item.id || !item.name) continue;
      const cleanId = String(item.id).trim();
      const cleanName = String(item.name).trim();
      if (!cleanId || !cleanName) continue;
      const nameKey = `${item.parentId || 'root'}::${cleanName.toLowerCase()}`;
      if (seenIds.has(cleanId) || seenNames.has(nameKey)) continue;
      seenIds.add(cleanId);
      seenNames.add(nameKey);
      result.push({
        ...item,
        id: cleanId,
        name: cleanName,
        parentId: item.parentId || null,
      });
    }
  };

  // 1. Explicit passed sources (e.g. Firestore folders from caller)
  for (const src of sources) {
    addList(src);
  }

  // 2. Cached user folders from GamesLibrary
  try {
    const cachedUser = localStorage.getItem('hamster_cached_user_folders');
    if (cachedUser) addList(JSON.parse(cachedUser));
  } catch {}

  // 3. Custom setup folders created in Game Setup
  try {
    const customSetup = localStorage.getItem('esl_custom_setup_folders');
    if (customSetup) addList(JSON.parse(customSetup));
  } catch {}

  // 4. Saved folders / default preset curriculum folders
  addList(getSavedFolders());

  return result;
}

/**
 * Fetches all folders from Firestore `gameFolders` (both user-specific and all accessible folders),
 * syncs them to localStorage cache, and merges with local/preset folders.
 */
export async function fetchAllAvailableFolders(
  db: any,
  userId?: string | null
): Promise<UnifiedFolderItem[]> {
  const firestoreFolders: UnifiedFolderItem[] = [];
  if (db) {
    try {
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      if (userId) {
        try {
          const userSnap = await getDocs(
            query(collection(db, 'gameFolders'), where('userId', '==', userId))
          );
          userSnap.docs.forEach((d) => {
            const data = d.data() as any;
            if (data?.name) {
              firestoreFolders.push({
                id: d.id,
                name: data.name,
                parentId: data.parentId || null,
                userId: data.userId,
                createdAt: data.createdAt,
              });
            }
          });
        } catch {}
      }

      // Also fetch any other accessible gameFolders in the collection so shared/existing folders are never missing
      try {
        const allSnap = await getDocs(collection(db, 'gameFolders'));
        allSnap.docs.forEach((d) => {
          const data = d.data() as any;
          if (data?.name && !firestoreFolders.some((f) => f.id === d.id)) {
            if (!userId || !data.userId || data.userId === userId) {
              firestoreFolders.push({
                id: d.id,
                name: data.name,
                parentId: data.parentId || null,
                userId: data.userId,
                createdAt: data.createdAt,
              });
            }
          }
        });
      } catch {}

      if (firestoreFolders.length > 0) {
        try {
          localStorage.setItem('hamster_cached_user_folders', JSON.stringify(firestoreFolders));
        } catch {}
      }
    } catch {}
  }

  return mergeAllFolders(firestoreFolders);
}

/**
 * Creates a new folder in Firestore `gameFolders` (if possible) AND saves it to local caches,
 * returning the created folder object with its real ID.
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

  if (db) {
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const docRef = await addDoc(collection(db, 'gameFolders'), {
        name: cleanName,
        parentId: parentId || null,
        userId: userId || 'teacher-studio-user',
        createdAt,
      });
      folderId = docRef.id;
    } catch {}
  }

  const newFolder: UnifiedFolderItem = {
    id: folderId,
    name: cleanName,
    parentId: parentId || null,
    userId: userId || 'teacher-studio-user',
    createdAt,
  };

  try {
    const cachedRaw = localStorage.getItem('hamster_cached_user_folders');
    const cachedList = cachedRaw ? JSON.parse(cachedRaw) : [];
    const nextCached = mergeAllFolders([newFolder], Array.isArray(cachedList) ? cachedList : []);
    localStorage.setItem('hamster_cached_user_folders', JSON.stringify(nextCached));
  } catch {}

  try {
    const customRaw = localStorage.getItem('esl_custom_setup_folders');
    const customList = customRaw ? JSON.parse(customRaw) : [];
    const nextCustom = Array.isArray(customList) ? [...customList, newFolder] : [newFolder];
    localStorage.setItem('esl_custom_setup_folders', JSON.stringify(nextCustom));
  } catch {}

  try {
    const savedList = getSavedFolders();
    if (!savedList.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      saveFoldersList([...savedList, { id: newFolder.id, name: newFolder.name }]);
    }
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('hamster-folders-updated', { detail: newFolder }));
  }

  return newFolder;
}

