const LAUNCH_KEY_PREFIX = 'hamster_tab_launch_';
const LATEST_LAUNCH_KEY = 'hamster_tab_launch_latest';
const LAUNCH_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isInterchangeableGame(game: any): boolean {
  if (!game) return false;
  const gameType = typeof game === 'string' ? game : (game.gameType || '');
  const normalized = gameType.toLowerCase().trim().replace(/[-_ ]+/g, '');

  if (['bubbleisland', 'bubblesentencepro'].includes(normalized)) {
    if (typeof game === 'object') {
      const mode = game.mode || '';
      if (mode === 'word' || mode === 'anagram') {
        return false;
      }
      if (mode === 'multiple-choice') {
        return true;
      }
      const hasSentences = Array.isArray(game.customSentences) && game.customSentences.length > 0;
      const questions = game.customQuestions || game.questions;
      const hasMcqQuestions =
        Array.isArray(questions) &&
        questions.some((q: any) => q && Array.isArray(q.options) && q.options.length >= 2);
      return !hasSentences && Boolean(hasMcqQuestions);
    }
    return false;
  }

  if (
    [
      'bubblepop',
      'rollercoasterquiz',
      'hamsterpaintball',
      'slapandchop',
      'sharkattack',
      'sumo',
      'sumotags',
      'yoga',
      'yogaquiz',
      'mysterybox',
      'tictactoe',
      'flashcardsmatch',
      'hamsterpopquiz',
      'familyfeud',
    ].includes(normalized)
  ) {
    return true;
  }

  if (typeof game === 'object') {
    const title = (game.name || game.title || game.topic || '').toLowerCase();
    if (
      title.includes('paintball') ||
      title.includes('bubble pop') ||
      title.includes('slap and chop') ||
      title.includes('slap & chop') ||
      title.includes('shark') ||
      title.includes('sumo') ||
      title.includes('yoga') ||
      title.includes('mystery box') ||
      title.includes('family feud')
    ) {
      return true;
    }
    const questions = game.customQuestions || game.questions;
    if (Array.isArray(questions) && questions.length > 0) {
      const hasOptions = questions.some(
        (q: any) =>
          q &&
          ((Array.isArray(q.options) && q.options.length >= 2) ||
            (Array.isArray(q.answers) && q.answers.length >= 1))
      );
      const distinctOtherTypes = [
        'squidgamepicker',
        'neonchain',
        'bubbleisland',
        'bubblesentencepro',
        'letterlock',
        'phonemicmaster',
        'studentrace',
      ];
      if (hasOptions && !distinctOtherTypes.includes(normalized)) {
        return true;
      }
    }
  }

  return false;
}

function cleanupOldLaunchKeys() {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LAUNCH_KEY_PREFIX) && k !== LATEST_LAUNCH_KEY) {
        try {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (!parsed?.savedAt || now - parsed.savedAt > LAUNCH_TTL_MS) {
              keysToRemove.push(k);
            }
          }
        } catch {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

export function hasTabLaunchUrlParams(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get('playGame') || params.get('launchKey'));
  } catch {
    return false;
  }
}

export function openGameInNewTab(game: any, targetMode?: string): void {
  if (typeof window === 'undefined' || !game) return;

  cleanupOldLaunchKeys();

  const resolvedMode = targetMode || game.gameType || 'mystery-box';
  const gameToLaunch = {
    ...game,
    gameType: resolvedMode,
    editMode: false,
  };

  const gameId = String(gameToLaunch.id || Date.now());
  const launchKey = `${LAUNCH_KEY_PREFIX}${gameId}_${Date.now()}`;
  const payload = JSON.stringify({
    game: gameToLaunch,
    mode: resolvedMode,
    savedAt: Date.now(),
  });

  try {
    localStorage.setItem(launchKey, payload);
    localStorage.setItem(LATEST_LAUNCH_KEY, payload);
  } catch {
    try {
      localStorage.setItem(LATEST_LAUNCH_KEY, payload);
    } catch {}
  }

  // Also sync to backend endpoint so that a new top-level browser tab opened from
  // a cross-site iframe (where browser storage partitioning isolates localStorage)
  // immediately receives the full game payload.
  try {
    const serverBody = JSON.stringify({ launchKey, game: gameToLaunch });
    let beaconSent = false;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([serverBody], { type: 'application/json' });
      beaconSent = navigator.sendBeacon('/api/platform-cache/tab-launch', blob);
    }
    if (!beaconSent) {
      fetch('/api/platform-cache/tab-launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serverBody,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}

  const url = new URL(window.location.href);
  url.searchParams.set('playGame', gameId);
  if (targetMode) {
    url.searchParams.set('playMode', targetMode);
  } else {
    url.searchParams.delete('playMode');
  }
  url.searchParams.set('launchKey', launchKey);

  const link = document.createElement('a');
  link.href = url.toString();
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

let cachedLaunchResolutionPromise: Promise<{
  game: any;
  mode: string;
  isMultiMode: boolean;
} | null> | null = null;

function findGameInLocalStorage(playGameId: string | null, launchKey: string | null): {
  game: any;
  mode: string | null;
} {
  let loadedGame: any = null;
  let loadedMode: string | null = null;

  try {
    if (launchKey) {
      const raw = localStorage.getItem(launchKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        loadedGame = parsed?.game || parsed;
        if (parsed?.mode) loadedMode = parsed.mode;
      }
    }

    if (!loadedGame) {
      const rawLatest = localStorage.getItem(LATEST_LAUNCH_KEY);
      if (rawLatest) {
        const parsed = JSON.parse(rawLatest);
        const candidate = parsed?.game || parsed;
        if (candidate && (!playGameId || String(candidate.id) === String(playGameId))) {
          loadedGame = candidate;
          if (parsed?.mode) loadedMode = parsed.mode;
        }
      }
    }

    if (!loadedGame && playGameId) {
      const rawCachedGames = localStorage.getItem('hamster_cached_user_games');
      if (rawCachedGames) {
        const parsedList = JSON.parse(rawCachedGames);
        if (Array.isArray(parsedList)) {
          const found = parsedList.find((g: any) => String(g?.id) === String(playGameId));
          if (found) loadedGame = found;
        }
      }
    }

    if (!loadedGame && playGameId) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('user_games_cache_')) {
          try {
            const rawCache = localStorage.getItem(k);
            if (rawCache) {
              const parsedCache = JSON.parse(rawCache);
              const list = Array.isArray(parsedCache?.games)
                ? parsedCache.games
                : Array.isArray(parsedCache)
                ? parsedCache
                : [];
              const found = list.find((g: any) => String(g?.id) === String(playGameId));
              if (found) {
                loadedGame = found;
                break;
              }
            }
          } catch {}
        }
      }
    }
  } catch {}

  return { game: loadedGame, mode: loadedMode };
}

export function resolveLaunchedGameFromUrl(): Promise<{
  game: any;
  mode: string;
  isMultiMode: boolean;
} | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (cachedLaunchResolutionPromise) return cachedLaunchResolutionPromise;

  const params = new URLSearchParams(window.location.search);
  const playGameId = params.get('playGame');
  const playModeParam = params.get('playMode');
  const launchKey = params.get('launchKey');

  if (!playGameId && !launchKey) {
    return Promise.resolve(null);
  }

  cachedLaunchResolutionPromise = (async () => {
    try {
      const localFound = findGameInLocalStorage(playGameId, launchKey);
      let loadedGame = localFound.game;
      let loadedMode = playModeParam || localFound.mode;

      // Fallback to server tab-launch endpoint (essential when localStorage is partitioned
      // between the cross-site preview iframe and a newly opened top-level browser tab)
      if (!loadedGame) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const q = new URLSearchParams();
            if (playGameId) q.set('playGame', playGameId);
            if (launchKey) q.set('launchKey', launchKey);
            const resp = await fetch(`/api/platform-cache/tab-launch?${q.toString()}`);
            if (resp.ok) {
              const data = await resp.json();
              if (data?.game) {
                loadedGame = data.game;
                break;
              }
            }
          } catch {}
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 150));
          }
        }
      }

      // Fallback to Firestore if game is opened or refreshed directly via ?playGame=<id>
      if (!loadedGame && playGameId) {
        try {
          const [{ doc, getDoc }, { db }] = await Promise.all([
            import('firebase/firestore'),
            import('../lib/firebase'),
          ]);
          for (const coll of ['games', 'public_games']) {
            const snap = await getDoc(doc(db, coll, playGameId));
            if (snap.exists()) {
              loadedGame = { id: snap.id, ...snap.data() };
              break;
            }
          }
        } catch {}
      }

      if (loadedGame) {
        try {
          localStorage.setItem(
            LATEST_LAUNCH_KEY,
            JSON.stringify({
              game: loadedGame,
              mode: loadedMode || loadedGame.gameType || 'mystery-box',
              savedAt: Date.now(),
            })
          );
        } catch {}
      }

      // Clean transient launchKey param while keeping playGame in URL so refreshing or sharing works
      try {
        const currentParams = new URLSearchParams(window.location.search);
        currentParams.delete('playMode');
        currentParams.delete('launchKey');
        const cleanQuery = currentParams.toString();
        const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${
          window.location.hash || ''
        }`;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch {}

      if (!loadedGame) return null;

      const finalMode = loadedMode || loadedGame.gameType || 'mystery-box';
      const normalizedGame = {
        ...loadedGame,
        gameType: finalMode,
        editMode: false,
      };

      const isMultiMode = !playModeParam && isInterchangeableGame(normalizedGame);

      return {
        game: normalizedGame,
        mode: finalMode,
        isMultiMode,
      };
    } catch {
      return null;
    }
  })();

  return cachedLaunchResolutionPromise;
}
