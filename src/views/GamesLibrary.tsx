import React, { useState, useEffect, useMemo } from 'react';
import {
  Gamepad2,
  Plus,
  Edit2,
  Play,
  Trash2,
  FolderPlus,
  FolderOpen,
  MoreVertical,
  X,
  Lock,
  Globe,
  GlobeLock,
  Copy,
  Folder,
  MoreHorizontal,
  BookOpen,
  Presentation,
  Search,
  ChevronRight,
  ArrowLeft,
  LayoutGrid,
  Wrench,
  Camera,
  Users,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { GameCategoryId, ViewState } from '../types';
import { GameThumbnail } from '../components/GameThumbnail';
import { GameModeModal, detectOriginalGameMode, PLAYABLE_GAME_OPTIONS } from '../components/GameModeModal';
import { CreateHomeworkModal } from '../components/CreateHomeworkModal';
import { logUserActivity } from '../utils/activityTracker';
import { getSavedGames, mergeAllFolders, createUnifiedFolder } from '../lib/gameStore';

const mosquitoSlapCardImg = '/images/mosquito-slap-card.jpg';
const hamsterPaintballCardImg = '/images/hamster-paintball-card.jpg';

const FOLDER_PALETTES = [
  {
    iconBg: 'bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/30',
    accentBar: 'bg-blue-500',
    hoverBorder: 'hover:border-blue-300 dark:hover:border-blue-500/60',
  },
  {
    iconBg: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-500/30',
    accentBar: 'bg-indigo-500',
    hoverBorder: 'hover:border-indigo-300 dark:hover:border-indigo-500/60',
  },
  {
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/30',
    accentBar: 'bg-emerald-500',
    hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-500/60',
  },
  {
    iconBg: 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/30',
    accentBar: 'bg-amber-500',
    hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-500/60',
  },
  {
    iconBg: 'bg-purple-50 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-200/80 dark:border-purple-500/30',
    accentBar: 'bg-purple-500',
    hoverBorder: 'hover:border-purple-300 dark:hover:border-purple-500/60',
  },
  {
    iconBg: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/30',
    accentBar: 'bg-rose-500',
    hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-500/60',
  },
  {
    iconBg: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-200/80 dark:border-cyan-500/30',
    accentBar: 'bg-cyan-500',
    hoverBorder: 'hover:border-cyan-300 dark:hover:border-cyan-500/60',
  },
  {
    iconBg: 'bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-200/80 dark:border-teal-500/30',
    accentBar: 'bg-teal-500',
    hoverBorder: 'hover:border-teal-300 dark:hover:border-teal-500/60',
  },
];

function getFolderPalette(name: string, index: number) {
  let hash = index;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return FOLDER_PALETTES[Math.abs(hash) % FOLDER_PALETTES.length];
}

export const GamesLibrary = ({ 
  onViewChange, 
  publishedGames = {},
  isAdmin = false
}: { 
  onViewChange: (view: ViewState, gameId?: any) => void;
  publishedGames?: Record<string, boolean>;
  isAdmin?: boolean;
}) => {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewGameModal, setShowNewGameModal] = useState(false);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<'all' | GameCategoryId>('all');
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToRename, setFolderToRename] = useState<any | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [gameToMove, setGameToMove] = useState<string | null>(null);
  const [interchangeableGameModal, setInterchangeableGameModal] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [gameForHomework, setGameForHomework] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [libraryFilterTab, setLibraryFilterTab] = useState<'all' | 'folders' | 'games' | 'published'>('all');

  const effectivePublishedGames = useMemo(() => {
    if (publishedGames && Object.keys(publishedGames).length > 0) {
      return publishedGames;
    }
    try {
      const cached = localStorage.getItem('publishedGamesV2');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return publishedGames || {};
  }, [publishedGames]);

  const isInterchangeableGame = (game: any) => {
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
        const hasMcqQuestions = Array.isArray(questions) && questions.some((q: any) => q && Array.isArray(q.options) && q.options.length >= 2);
        return !hasSentences && Boolean(hasMcqQuestions);
      }
      return false;
    }

    if (['bubblepop', 'rollercoasterquiz', 'hamsterpaintball', 'slapandchop', 'sharkattack', 'sumo', 'sumotags', 'yoga', 'yogaquiz', 'mysterybox', 'tictactoe', 'flashcardsmatch', 'hamsterpopquiz', 'familyfeud'].includes(normalized)) {
      return true;
    }

    if (typeof game === 'object') {
      const title = (game.name || game.title || game.topic || '').toLowerCase();
      if (title.includes('paintball') || title.includes('bubble pop') || title.includes('slap and chop') || title.includes('slap & chop') || title.includes('shark') || title.includes('sumo') || title.includes('yoga') || title.includes('mystery box') || title.includes('family feud')) {
        return true;
      }
      const questions = game.customQuestions || game.questions;
      if (Array.isArray(questions) && questions.length > 0) {
        const hasOptions = questions.some((q: any) => q && (Array.isArray(q.options) && q.options.length >= 2 || Array.isArray(q.answers) && q.answers.length >= 1));
        const distinctOtherTypes = [
          'squidgamepicker', 'neonchain', 'bubbleisland', 'bubblesentencepro',
          'letterlock', 'phonemicmaster', 'studentrace'
        ];
        if (hasOptions && !distinctOtherTypes.includes(normalized)) {
          return true;
        }
      }
    }

    return false;
  };
  
  const allGameTemplates: {
    id: string;
    title: string;
    icon: string;
    color: string;
    category: GameCategoryId;
  }[] = [
    // Classroom Tools
    { id: "squid-game-picker", title: "Name Picker", icon: "/images/name-picker-card-v3.png?v=3", color: "bg-rose-100 text-rose-600", category: "classroom-tools" },
    { id: "flashcards-match", title: "Flashcard", icon: "/images/flashcards-card-v3.jpg?v=3", color: "bg-indigo-100 text-indigo-600", category: "classroom-tools" },
    { id: "hamster-pop-quiz", title: "Video Quiz", icon: "/images/video-quiz-card-v3.jpg?v=3", color: "bg-yellow-100 text-yellow-600", category: "classroom-tools" },
    { id: "phonemic-master", title: "Phonemic Master", icon: "/images/phonemic-master-card-v3.jpg?v=3", color: "bg-emerald-100 text-emerald-600", category: "classroom-tools" },
    // AR Camera Games
    { id: "slap-and-chop", title: "Mosquito Slap", icon: mosquitoSlapCardImg, color: "bg-purple-100 text-purple-600", category: "ar-camera" },
    { id: "bubble-pop", title: "Bubble Pop", icon: "/images/bubble-pop-card.jpg?v=3", color: "bg-blue-100 text-blue-600", category: "ar-camera" },
    { id: "roller-coaster-quiz", title: "Roller Coaster Quiz", icon: "/images/roller-coaster-quiz-card.jpg?v=3", color: "bg-amber-100 text-amber-600", category: "ar-camera" },
    { id: "yoga-quiz", title: "Yoga Quiz", icon: "/images/yoga-quiz-card.jpg?v=3", color: "bg-emerald-100 text-emerald-600", category: "ar-camera" },
    // Board Trivia & Team Games
    { id: "mystery-box", title: "Mystery Box", icon: "/images/mystery-box-card.jpg?v=3", color: "bg-orange-100 text-orange-600", category: "board-trivia" },
    { id: "neon-chain", title: "Neon Chain", icon: "/images/neon-chain-card.jpg?v=3", color: "bg-cyan-100 text-cyan-600", category: "board-trivia" },
    { id: "bubble-sentence-pro", title: "Bubble Island", icon: "/images/bubble-island-card.jpg?v=3", color: "bg-sky-100 text-sky-600", category: "board-trivia" },
    { id: "shark-attack", title: "Shark Attack", icon: "/images/shark-attack-card.jpg?v=3", color: "bg-cyan-100 text-cyan-600", category: "board-trivia" },
    { id: "family-feud", title: "Family Feud", icon: "/images/family-feud-card.jpg?v=3", color: "bg-yellow-100 text-yellow-600", category: "board-trivia" },
    { id: "sumo", title: "Sumo Tags", icon: "/images/sumo-tags-card.jpg?v=3", color: "bg-red-100 text-red-600", category: "board-trivia" },
    // Multiplayer Games
    { id: "hamster-paintball", title: "Hamster Paintball", icon: hamsterPaintballCardImg, color: "bg-lime-100 text-lime-700", category: "multiplayer-games" },
    { id: "tic-tac-toe", title: "Tic Tac Toe Battle", icon: "/images/tic-tac-toe-card.jpg?v=3", color: "bg-gray-100 text-gray-800", category: "multiplayer-games" },
  ];

  const gameTemplates = allGameTemplates.filter(g => g.id === 'hamster-paintball' || isAdmin || effectivePublishedGames[g.id] !== false);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const savedYogaQuizzes = localStorage.getItem('yogaQuizzes');
      if (savedYogaQuizzes && user) {
        try {
          const parsedQuizzes = JSON.parse(savedYogaQuizzes);
          for (const q of parsedQuizzes) {
            if (q.title && q.questions && q.questions.length > 0) {
              await addDoc(collection(db, "mysteryBoxGames"), {
                name: q.title || "Yoga Quiz",
                folderId: "",
                topic: q.topic || "",
                className: q.classLevel || "",
                gameType: "yoga-quiz",
                customQuestions: q.questions,
                userId: user.uid,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                isPublic: false,
              });
            }
          }
          localStorage.removeItem('yogaQuizzes');
        } catch (err) {
          console.error('Failed to migrate yoga quizzes', err);
        }
      }

      const qGames = query(
        collection(db, "mysteryBoxGames"),
        where("userId", "==", user!.uid),
      );
      const qFolders = query(
        collection(db, "gameFolders"),
        where("userId", "==", user!.uid),
      );
      
      const [gamesSnap, foldersSnap] = await Promise.all([
        getDocs(qGames).catch((err) => {
          console.warn("Notice querying games from cloud (falling back to cache):", err?.message || err);
          return { forEach: () => {} } as any;
        }),
        getDocs(qFolders).catch((err) => {
          console.warn("Notice querying folders from cloud (falling back to cache):", err?.message || err);
          return { forEach: () => {} } as any;
        })
      ]);

      const userGames: any[] = [];
      gamesSnap.forEach((doc: any) => {
        userGames.push({ id: doc.id, ...doc.data() });
      });

      const userFolders: any[] = [];
      foldersSnap.forEach((doc: any) => {
        userFolders.push({ id: doc.id, ...doc.data() });
      });

      if (userGames.length > 0) {
        setGames(userGames);
        try { localStorage.setItem('hamster_cached_user_games', JSON.stringify(userGames)); } catch (e) {}
        fetch('/api/platform-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ games: userGames }),
        }).catch(() => {});
      } else {
        try {
          const cached = localStorage.getItem('hamster_cached_user_games');
          if (cached) {
            const parsed = JSON.parse(cached);
            setGames(parsed);
            fetch('/api/platform-cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ games: parsed }),
            }).catch(() => {});
          } else {
            setGames(getSavedGames());
          }
        } catch (e) {
          setGames(getSavedGames());
        }
      }

      const mergedFolders = mergeAllFolders(userFolders);
      setFolders(mergedFolders);
      try {
        localStorage.setItem('hamster_cached_user_folders', JSON.stringify(mergedFolders));
      } catch (e) {}
    } catch (error: any) {
      console.warn("Notice fetching library from cloud (using local cache):", error?.message || error);
      try {
        const cached = localStorage.getItem('hamster_cached_user_games');
        setGames(cached ? JSON.parse(cached) : getSavedGames());
        setFolders(mergeAllFolders());
      } catch (e) {
        setGames(getSavedGames());
        setFolders(mergeAllFolders());
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async (gameId: string) => {
    try {
      await deleteDoc(doc(db, "mysteryBoxGames", gameId)).catch(() => {});
      setGames(games.filter(g => g.id !== gameId));
      setGameToDelete(null);
      setToastMsg("Game deleted.");
      setTimeout(() => setToastMsg(null), 2500);
    } catch (error) {
      console.error("Error deleting game:", error);
    }
  };

  const confirmDeleteFolder = async (folderId: string) => {
    try {
      const folderToDeleteObj = folders.find(f => f.id === folderId);
      const parentId = folderToDeleteObj?.parentId || null;

      await deleteDoc(doc(db, "gameFolders", folderId)).catch(() => {});
      
      try {
        const batch = writeBatch(db);
        const gamesToUpdate = games.filter(g => g.folderId === folderId);
        gamesToUpdate.forEach(game => {
          const gameRef = doc(db, "mysteryBoxGames", game.id);
          batch.update(gameRef, { folderId: parentId });
        });

        const foldersToUpdate = folders.filter(f => f.parentId === folderId);
        foldersToUpdate.forEach(f => {
          const folderRef = doc(db, "gameFolders", f.id);
          batch.update(folderRef, { parentId });
        });

        await batch.commit();
      } catch (e) {}

      const nextFolders = folders.map(f => f.parentId === folderId ? { ...f, parentId } : f).filter(f => f.id !== folderId);
      setFolders(nextFolders);
      try { localStorage.setItem('hamster_cached_user_folders', JSON.stringify(nextFolders)); } catch (e) {}
      setGames(games.map(g => g.folderId === folderId ? { ...g, folderId: parentId } : g));
      setFolderToDelete(null);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(parentId);
      }
      setToastMsg("Folder deleted.");
      setTimeout(() => setToastMsg(null), 2500);
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const created = await createUnifiedFolder(
        db,
        user?.uid,
        newFolderName.trim(),
        selectedFolderId || null
      );
      setFolders((prev) => mergeAllFolders([created], prev));
      setShowNewFolderModal(false);
      setNewFolderName("");
      setToastMsg(`Folder "${created.name}" created.`);
      setTimeout(() => setToastMsg(null), 2500);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderToRename || !renameFolderInput.trim()) return;
    const trimmed = renameFolderInput.trim();
    try {
      await updateDoc(doc(db, "gameFolders", folderToRename.id), { name: trimmed }).catch(() => {});
      const updated = folders.map(f => f.id === folderToRename.id ? { ...f, name: trimmed } : f);
      setFolders(updated);
      try { localStorage.setItem('hamster_cached_user_folders', JSON.stringify(updated)); } catch (e) {}
      setFolderToRename(null);
      setRenameFolderInput('');
      setToastMsg(`Folder renamed to "${trimmed}".`);
      setTimeout(() => setToastMsg(null), 2500);
    } catch (error) {
      console.error("Error renaming folder:", error);
    }
  };

  const handleMoveGame = async (folderId: string | null, dragGameId?: string) => {
    const targetGameId = dragGameId || gameToMove;
    if (!targetGameId) return;
    try {
       const gameRef = doc(db, "mysteryBoxGames", targetGameId);
       await updateDoc(gameRef, { folderId }).catch(() => {});
       setGames(games.map(g => g.id === targetGameId ? { ...g, folderId } : g));
       setGameToMove(null);
       const destName = folderId ? (folders.find(f => f.id === folderId)?.name || 'Folder') : 'My Games Folder';
       setToastMsg(`Moved game to "${destName}".`);
       setTimeout(() => setToastMsg(null), 2500);
    } catch (error) {
       console.error("Error moving game:", error);
    }
  };

  const handleMoveFolder = async (targetFolderId: string | null, dragFolderId: string) => {
    if (targetFolderId === dragFolderId) return;
    
    let current = targetFolderId;
    while (current) {
        if (current === dragFolderId) return;
        const parent = folders.find(f => f.id === current);
        current = parent?.parentId || null;
    }

    try {
       const folderRef = doc(db, "gameFolders", dragFolderId);
       await updateDoc(folderRef, { parentId: targetFolderId }).catch(() => {});
       setFolders(folders.map(f => f.id === dragFolderId ? { ...f, parentId: targetFolderId } : f));
    } catch (error) {
       console.error("Error moving folder:", error);
    }
  };

  const handleTogglePublic = async (game: any) => {
    try {
      const currentPublic = game.isPublic === true || game.isPublic === 'true';
      const nextPublic = !currentPublic;
      const now = new Date().toISOString();
      const gameRef = doc(db, "mysteryBoxGames", game.id);
      
      const updateData: any = {
        isPublic: nextPublic,
        updatedAt: now,
      };
      
      if (nextPublic) {
        updateData.publishedAt = now;
        if (user) {
          updateData.creatorName = user.displayName || user.email?.split('@')[0] || "Teacher";
          updateData.creatorEmail = user.email || "";
        }
      }
      if (!game.createdAt) {
        updateData.createdAt = now;
      }

      await updateDoc(gameRef, updateData).catch(() => {});
      setGames(games.map(g => g.id === game.id ? { ...g, ...updateData } : g));
      setToastMsg(nextPublic ? `"${game.topic || game.name || game.title || 'Game'}" published to Community!` : `"${game.topic || game.name || game.title || 'Game'}" set to Private.`);
      setTimeout(() => setToastMsg(null), 3500);
    } catch (error) {
      console.error("Error toggling public status:", error);
    }
  };

  const handleDelete = (id: string) => {
    setGameToDelete(id);
  };

  const handleDuplicateGame = async (game: any) => {
    try {
      const now = new Date().toISOString();
      const newGame: any = {
        ...game,
        name: `${game.name || game.topic || game.title || 'Game'} (Copy)`,
        title: `${game.title || game.name || game.topic || 'Game'} (Copy)`,
        userId: user?.uid,
        isPublic: false,
        createdAt: now,
        updatedAt: now,
      };
      delete newGame.id;
      const docRef = await addDoc(collection(db, "mysteryBoxGames"), newGame);
      setGames([...games, { id: docRef.id, ...newGame }]);
      if (user) {
        logUserActivity({
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || 'User',
          userPhoto: user.photoURL || null,
          action: 'create_game',
          title: `Duplicated Game: "${newGame.name}"`,
          gameTitle: newGame.name,
          gameType: newGame.gameType,
          details: `Created copy of ${newGame.gameType || 'game'} in My Games.`
        });
      }
      setToastMsg("Game duplicated as private copy!");
      setTimeout(() => setToastMsg(null), 3000);
    } catch (error) {
      console.error("Error duplicating game:", error);
    }
  };

  const allAllowedGames = useMemo(
    () =>
      games.filter(
        g =>
          g.gameType === 'hamster-paintball' ||
          isAdmin ||
          effectivePublishedGames[g.gameType || 'mystery-box'] !== false
      ),
    [games, isAdmin, effectivePublishedGames]
  );

  // Helper to count games belonging to a specific folder
  const getFolderGames = (folder: any) => {
    if (!folder) return [];
    return allAllowedGames.filter(
      g =>
        g.folderId === folder.id ||
        (g.folderId &&
          String(g.folderId).toLowerCase().trim() === String(folder.name || '').toLowerCase().trim())
    );
  };

  const getFolderNameForGame = (game: any): string | null => {
    if (!game?.folderId) return null;
    const found = folders.find(
      f =>
        f.id === game.folderId ||
        String(f.name || '').toLowerCase().trim() === String(game.folderId).toLowerCase().trim()
    );
    return found ? found.name : String(game.folderId);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 flex flex-col gap-6">
        <div className="h-24 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse p-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-36 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 animate-pulse p-5"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-600 dark:text-slate-300 font-bold text-lg bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          Please sign in to view your saved games.
        </p>
      </div>
    );
  }

  const selectedFolderObj = selectedFolderId ? folders.find(f => f.id === selectedFolderId) : null;
  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Build breadcrumb path for selected folder
  const breadcrumbTrail: any[] = [];
  if (selectedFolderObj) {
    let curr: any = selectedFolderObj;
    const visited = new Set<string>();
    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      breadcrumbTrail.unshift(curr);
      curr = curr.parentId ? folders.find(f => f.id === curr.parentId) : null;
    }
  }

  const currentLevelFolders = folders.filter(f => (f.parentId || null) === (selectedFolderId || null));
  const displayedFolders = isSearching
    ? folders.filter(f => (f.name || '').toLowerCase().includes(normalizedQuery))
    : currentLevelFolders;

  const baseGamesPool =
    isSearching || libraryFilterTab === 'games' || libraryFilterTab === 'published'
      ? selectedFolderId
        ? getFolderGames(selectedFolderObj)
        : allAllowedGames
      : selectedFolderId
      ? getFolderGames(selectedFolderObj)
      : allAllowedGames.filter(g => !g.folderId);

  const displayedGames = baseGamesPool.filter(g => {
    if (libraryFilterTab === 'published' && !(g.isPublic === true || g.isPublic === 'true')) {
      return false;
    }
    if (!isSearching) return true;
    const title = (g.topic || g.name || g.title || '').toLowerCase();
    const cls = (g.className || g.classLevel || '').toLowerCase();
    const gType = (g.gameType || '').toLowerCase();
    const folderLabel = (getFolderNameForGame(g) || '').toLowerCase();
    return (
      title.includes(normalizedQuery) ||
      cls.includes(normalizedQuery) ||
      gType.includes(normalizedQuery) ||
      folderLabel.includes(normalizedQuery)
    );
  });

  const publishedCount = allAllowedGames.filter(g => g.isPublic === true || g.isPublic === 'true').length;

  const getFolderTree = (parentId: string | null = null, depth = 0): {folder: any, depth: number}[] => {
    const children = folders.filter(f => (f.parentId || null) === parentId);
    let result: {folder: any, depth: number}[] = [];
    for (const child of children) {
      result.push({folder: child, depth});
      result = result.concat(getFolderTree(child.id, depth + 1));
    }
    return result;
  };
  const folderTree = getFolderTree();

  const showFoldersSection = libraryFilterTab === 'all' || libraryFilterTab === 'folders';
  const showGamesSection = libraryFilterTab === 'all' || libraryFilterTab === 'games' || libraryFilterTab === 'published';

  const filteredModalTemplates =
    templateCategoryFilter === 'all'
      ? gameTemplates
      : gameTemplates.filter(t => t.category === templateCategoryFilter);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 text-sm font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Workspace Header Card */}
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-[0_1px_3px_rgba(15,23,42,0.05)] p-5 sm:p-6 flex flex-col gap-5"
        onDragOver={(e) => {
          if (!selectedFolderId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (!selectedFolderId) return;
          e.preventDefault();
          e.stopPropagation();
          const currentFolder = folders.find(f => f.id === selectedFolderId);
          const parentId = currentFolder?.parentId || null;

          const gameId = e.dataTransfer.getData('text/plain');
          if (gameId) handleMoveGame(parentId, gameId);

          const draggedFolderId = e.dataTransfer.getData('application/x-folder-id');
          if (draggedFolderId) handleMoveFolder(parentId, draggedFolderId);
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            {selectedFolderId ? (
              <button
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  setSelectedFolderId(currentFolder?.parentId || null);
                }}
                className="w-11 h-11 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
                title="Back to parent folder"
              >
                <ArrowLeft className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>
            ) : (
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/15 border border-blue-200/80 dark:border-blue-500/30 rounded-xl flex items-center justify-center shrink-0">
                <FolderOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            )}

            <div className="min-w-0">
              {/* Breadcrumb navigation when inside a folder */}
              {selectedFolderId && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-0.5 flex-wrap">
                  <button
                    onClick={() => setSelectedFolderId(null)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    My Games Folder
                  </button>
                  {breadcrumbTrail.map((crumb) => (
                    <React.Fragment key={crumb.id}>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <button
                        onClick={() => setSelectedFolderId(crumb.id)}
                        className={`truncate max-w-[180px] cursor-pointer ${
                          crumb.id === selectedFolderId
                            ? 'text-slate-900 dark:text-white font-bold'
                            : 'hover:text-indigo-600 dark:hover:text-indigo-400'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              )}

              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                {selectedFolderObj ? selectedFolderObj.name : 'My Games Folder'}
              </h1>

              {/* Clean unboxed metadata with typographic separators & tabular-nums */}
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex-wrap tabular-nums">
                {selectedFolderObj ? (
                  <>
                    <span>{displayedGames.length} {displayedGames.length === 1 ? 'game' : 'games'} in this folder</span>
                    {currentLevelFolders.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{currentLevelFolders.length} {currentLevelFolders.length === 1 ? 'subfolder' : 'subfolders'}</span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span>Manage your custom vocabulary games</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{folders.length} folders</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{allAllowedGames.length} saved games</span>
                    {publishedCount > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{publishedCount} public</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Primary Actions */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              onClick={() => onViewChange("my-slides")}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-bold text-sm rounded-xl border border-purple-200/90 dark:border-purple-800/70 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Open My Slides classroom presentations"
            >
              <Presentation className="w-4 h-4 shrink-0" />
              <span>My Slides</span>
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>New Folder</span>
            </button>
            <button
              onClick={() => setShowNewGameModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-purple hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-sm transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>New Game</span>
            </button>
          </div>
        </div>

        {/* Search & View Mode Filter Bar */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented View Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/70 dark:border-slate-700/70 overflow-x-auto">
            <button
              onClick={() => setLibraryFilterTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                libraryFilterTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setLibraryFilterTab('folders')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                libraryFilterTab === 'folders'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Folders ({currentLevelFolders.length})
            </button>
            <button
              onClick={() => setLibraryFilterTab('games')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                libraryFilterTab === 'games'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Saved Games ({selectedFolderId ? getFolderGames(selectedFolderObj).length : allAllowedGames.length})
            </button>
            <button
              onClick={() => setLibraryFilterTab('published')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                libraryFilterTab === 'published'
                  ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Published ({publishedCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search folders, games, topics..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col gap-8">
        {/* FOLDERS SECTION */}
        {showFoldersSection && displayedFolders.length > 0 && (
          <section className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                  {selectedFolderObj ? 'Subfolders' : 'Folders'}
                </h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  · {displayedFolders.length}
                </span>
              </div>
              {!selectedFolderObj && allAllowedGames.length > 0 && libraryFilterTab === 'all' && (
                <button
                  onClick={() => setLibraryFilterTab('games')}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>View all {allAllowedGames.length} saved games</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayedFolders.map((folder, idx) => {
                const palette = getFolderPalette(folder.name || '', idx);
                const folderGames = getFolderGames(folder);
                const childSubfolders = folders.filter(f => f.parentId === folder.id);
                const totalInside = folderGames.length;

                return (
                  <div
                    key={folder.id}
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      setSearchQuery('');
                      if (libraryFilterTab === 'folders') {
                        setLibraryFilterTab('all');
                      }
                    }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-folder-id', folder.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const gameId = e.dataTransfer.getData('text/plain');
                      if (gameId) {
                        handleMoveGame(folder.id, gameId);
                      }
                      const draggedFolderId = e.dataTransfer.getData('application/x-folder-id');
                      if (draggedFolderId) {
                        handleMoveFolder(folder.id, draggedFolderId);
                      }
                    }}
                    className={`group relative bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 ${palette.hoverBorder} shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:shadow-md transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[138px] ${
                      openMenuId === folder.id ? 'z-40' : 'z-10'
                    }`}
                  >
                    {/* Top Row: Folder Icon Badge + Action Menu */}
                    <div className="flex items-start justify-between gap-2 mb-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-150 group-hover:scale-105 ${palette.iconBg}`}
                      >
                        <FolderOpen className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Preview mini-thumbnails if folder has games */}
                        {folderGames.length > 0 && (
                          <div className="flex -space-x-2 mr-1">
                            {folderGames.slice(0, 3).map((g: any) => (
                              <div
                                key={g.id}
                                className="w-6 h-6 rounded-md border border-white dark:border-slate-800 shadow-2xs overflow-hidden relative bg-slate-100 shrink-0"
                              >
                                <GameThumbnail
                                  gameType={g.gameType}
                                  info={gameTemplates.find(t => t.id === g.gameType) || {}}
                                  game={g}
                                  compact={true}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="relative">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === folder.id ? null : folder.id)}
                            className="w-8 h-8 rounded-lg border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                            title="Folder options"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenuId === folder.id && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setOpenMenuId(null)}
                              />
                              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1.5 z-50">
                                <button
                                  onClick={() => {
                                    setFolderToRename(folder);
                                    setRenameFolderInput(folder.name || '');
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit2 size={14} className="text-indigo-500" />
                                  <span>Rename Folder</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setFolderToDelete(folder.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                  <span>Delete Folder</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Folder Name & Live Item Count */}
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {folder.name}
                      </h3>
                      <div className="flex items-center justify-between gap-2 mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                        <div className="flex items-center gap-1.5">
                          <span className={totalInside > 0 ? 'text-slate-700 dark:text-slate-300 font-semibold' : ''}>
                            {totalInside === 0
                              ? 'Empty folder'
                              : `${totalInside} ${totalInside === 1 ? 'game' : 'games'}`}
                          </span>
                          {childSubfolders.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{childSubfolders.length} {childSubfolders.length === 1 ? 'subfolder' : 'subfolders'}</span>
                            </>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* SAVED GAMES SECTION */}
        {showGamesSection && (
          <section className="flex flex-col gap-3.5">
            {(displayedGames.length > 0 || libraryFilterTab !== 'all' || selectedFolderId) && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
                    {libraryFilterTab === 'published'
                      ? 'Published Community Games'
                      : selectedFolderObj
                      ? `Games in ${selectedFolderObj.name}`
                      : libraryFilterTab === 'games' || isSearching
                      ? 'All Saved Games'
                      : 'Unfiled Games'}
                  </h2>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    · {displayedGames.length}
                  </span>
                </div>
              </div>
            )}

            {displayedGames.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {displayedGames.map((game) => {
                  const folderLabel = getFolderNameForGame(game);
                  const itemCount =
                    game.customQuestions?.length ??
                    game.questions?.length ??
                    game.customSentences?.length ??
                    game.sentences?.length ??
                    game.cards?.length ??
                    0;
                  const templateTitle =
                    gameTemplates.find(t => t.id === game.gameType)?.title ||
                    PLAYABLE_GAME_OPTIONS.find(o => o.id === detectOriginalGameMode(game))?.title ||
                    'Mystery Box';

                  return (
                    <div
                      key={game.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', game.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => {
                        if (isInterchangeableGame(game)) {
                          setInterchangeableGameModal(game);
                        } else {
                          onViewChange((game.gameType as any) || "mystery-box", game);
                        }
                      }}
                      className={`group bg-white dark:bg-slate-900 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:shadow-md transition-all duration-150 border border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/60 flex flex-col relative cursor-pointer ${
                        openMenuId === game.id ? 'z-50' : 'z-10'
                      }`}
                    >
                      <div className="p-5 flex flex-col h-full relative z-10 rounded-2xl">
                        {/* Card Top: Title + 3D Game Thumbnail */}
                        <div className="flex justify-between items-start gap-3 mb-3.5">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {game.topic || game.name || game.title || "Untitled Game"}
                            </h3>

                            {/* Clean Unboxed Status & Folder Metadata */}
                            <div className="flex items-center gap-1.5 mt-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 flex-wrap">
                              {game.isPublic ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                                  <Globe size={12} className="shrink-0" />
                                  <span>Public</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                                  <Lock size={12} className="shrink-0" />
                                  <span>Private</span>
                                </span>
                              )}

                              {folderLabel && !selectedFolderId && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold truncate max-w-[120px]">
                                    <Folder size={11} className="shrink-0" />
                                    <span className="truncate">{folderLabel}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl flex items-center justify-center font-bold group-hover:scale-105 transition-transform shrink-0 z-20 relative overflow-hidden shadow-2xs">
                            <GameThumbnail
                              gameType={game.gameType}
                              info={gameTemplates.find(t => t.id === game.gameType) || {}}
                              game={game}
                              compact={true}
                            />
                          </div>
                        </div>

                        {/* Structured Metadata Rows */}
                        <div className="space-y-1.5 mb-4 p-3 bg-slate-50/90 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-700/70 mt-auto text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">
                              Game Mode
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {templateTitle}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">
                              Class / Level
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                              {game.className || game.classLevel || "General"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 tabular-nums">
                            <span className="font-semibold text-slate-500 dark:text-slate-400">
                              Questions / Items
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {itemCount}
                            </span>
                          </div>
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center gap-2 pt-1 relative z-20">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isInterchangeableGame(game)) {
                                setInterchangeableGameModal(game);
                              } else {
                                onViewChange((game.gameType as any) || "mystery-box", game);
                              }
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2 px-3.5 rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-current shrink-0" />
                            <span>Play</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewChange((game.gameType as any) || "mystery-box", { ...game, editMode: true });
                            }}
                            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                            title="Edit Game"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (openMenuId === game.id) {
                                  setOpenMenuId(null);
                                  setGameToMove(null);
                                } else {
                                  setOpenMenuId(game.id);
                                }
                              }}
                              className={`w-9 h-9 font-bold rounded-xl border transition-colors flex items-center justify-center shrink-0 cursor-pointer ${
                                openMenuId === game.id
                                  ? 'bg-slate-200 border-slate-300 text-slate-900 dark:bg-slate-700 dark:border-slate-600 dark:text-white'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                              title="More Options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>

                            {openMenuId === game.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    setGameToMove(null);
                                  }}
                                />
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute bottom-11 right-0 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl overflow-hidden z-40 flex flex-col"
                                >
                                  {gameToMove === game.id ? (
                                    <>
                                      <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                          Move to Folder
                                        </span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setGameToMove(null);
                                          }}
                                          className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMoveGame(null);
                                            setOpenMenuId(null);
                                          }}
                                          className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                                        >
                                          <Gamepad2 className="w-4 h-4 text-slate-400" />
                                          <span>My Games Folder (Root)</span>
                                        </button>
                                        {folderTree.map(({ folder: f, depth }) => (
                                          <button
                                            key={f.id}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveGame(f.id);
                                              setOpenMenuId(null);
                                            }}
                                            className="w-full text-left py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/60 cursor-pointer"
                                            style={{ paddingLeft: `${0.875 + depth * 1.25}rem`, paddingRight: '0.875rem' }}
                                          >
                                            <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                            <span className="truncate">{f.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="py-1.5">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onViewChange((game.gameType as any) || "mystery-box", { ...game, editMode: true });
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <Edit2 className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Edit Game</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setGameToMove(game.id);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5 text-brand-purple" />
                                        <span>Move to Folder...</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTogglePublic(game);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        {game.isPublic ? (
                                          <>
                                            <GlobeLock className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Unpublish Game</span>
                                          </>
                                        ) : (
                                          <>
                                            <Globe className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Publish to Community</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDuplicateGame(game);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <Copy className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Duplicate</span>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setGameForHomework(game);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                        <span>Create Homework</span>
                                      </button>
                                      <div className="h-px bg-slate-200/80 dark:bg-slate-700 my-1" />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(game.id);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Delete Game</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Empty State */}
        {((showFoldersSection ? displayedFolders.length : 0) + (showGamesSection ? displayedGames.length : 0)) === 0 && (
          <div className="py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-center flex flex-col items-center justify-center shadow-2xs">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200/80 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-4">
              <Gamepad2 size={30} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">
              {isSearching
                ? `No matches for "${searchQuery}"`
                : selectedFolderObj
                ? `"${selectedFolderObj.name}" is Empty`
                : libraryFilterTab === 'published'
                ? 'No Published Games Yet'
                : 'No Saved Games Yet'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
              {isSearching
                ? 'Try searching for a different folder name, topic, or class level.'
                : selectedFolderObj
                ? 'Create a new custom game inside this folder or move existing games here from All Saved Games.'
                : 'Start creating custom vocabulary and grammar games for your classroom.'}
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              {isSearching ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <>
                  {selectedFolderObj && allAllowedGames.length > 0 && (
                    <button
                      onClick={() => {
                        setSelectedFolderId(null);
                        setLibraryFilterTab('games');
                      }}
                      className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      Browse All Saved Games
                    </button>
                  )}
                  <button
                    onClick={() => setShowNewGameModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-purple hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-sm transition cursor-pointer"
                  >
                    <Plus size={18} />
                    <span>Create a Game</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Game Template Modal */}
      {showNewGameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 sm:p-6"
          onClick={() => setShowNewGameModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-5xl shadow-2xl relative border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 sm:px-8 py-4 flex flex-col gap-3.5 shrink-0 border-b border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Select Game
                </h2>
                <button
                  onClick={() => setShowNewGameModal(false)}
                  className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Classification Filter Tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
                <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700">
                  {[
                    { id: 'all', title: 'All Games', icon: LayoutGrid, accentText: '', count: gameTemplates.length },
                    { id: 'classroom-tools', title: 'Classroom Tools', icon: Wrench, accentText: 'text-emerald-600 dark:text-emerald-400', count: gameTemplates.filter(t => t.category === 'classroom-tools').length },
                    { id: 'ar-camera', title: 'AR Camera Games', icon: Camera, accentText: 'text-sky-600 dark:text-sky-400', count: gameTemplates.filter(t => t.category === 'ar-camera').length },
                    { id: 'board-trivia', title: 'Board Trivia & Team Games', icon: Gamepad2, accentText: 'text-amber-600 dark:text-amber-400', count: gameTemplates.filter(t => t.category === 'board-trivia').length },
                    { id: 'multiplayer-games', title: 'Multiplayer Games', icon: Users, accentText: 'text-purple-600 dark:text-purple-400', count: gameTemplates.filter(t => t.category === 'multiplayer-games').length },
                  ].map((tab) => {
                    if (tab.id !== 'all' && tab.count === 0) return null;
                    const Icon = tab.icon;
                    const isActive = templateCategoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTemplateCategoryFilter(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon size={15} className={isActive ? 'text-current' : tab.accentText} />
                        <span>{tab.title}</span>
                        <span className="text-xs opacity-75 tabular-nums">({tab.count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex flex-col gap-10">
              {[
                { id: 'classroom-tools' as GameCategoryId, title: 'Classroom Tools', icon: Wrench, accentText: 'text-emerald-600 dark:text-emerald-400' },
                { id: 'ar-camera' as GameCategoryId, title: 'AR Camera Games', icon: Camera, accentText: 'text-sky-600 dark:text-sky-400' },
                { id: 'board-trivia' as GameCategoryId, title: 'Board Trivia & Team Games', icon: Gamepad2, accentText: 'text-amber-600 dark:text-amber-400' },
                { id: 'multiplayer-games' as GameCategoryId, title: 'Multiplayer Games', icon: Users, accentText: 'text-purple-600 dark:text-purple-400' },
              ]
                .map((section) => ({
                  ...section,
                  items: gameTemplates.filter((t) => t.category === section.id),
                }))
                .filter(
                  (section) =>
                    section.items.length > 0 &&
                    (templateCategoryFilter === 'all' || templateCategoryFilter === section.id)
                )
                .map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <div key={section.id} className="flex flex-col gap-4">
                      <div className="flex items-center gap-2.5">
                        <SectionIcon size={22} className={section.accentText} />
                        <h3 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                          {section.title}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {section.items.map((template) => (
                          <div
                            key={template.id}
                            onClick={() => {
                              setShowNewGameModal(false);
                              onViewChange(template.id as ViewState);
                            }}
                            className="w-full relative aspect-[4/3] bg-transparent rounded-[2.25rem] overflow-hidden shadow-[0_22px_44px_-12px_rgba(15,23,42,0.36),0_10px_20px_-8px_rgba(15,23,42,0.22)] group hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_32px_60px_-12px_rgba(15,23,42,0.45)] active:translate-y-0.5 transition-all duration-300 cursor-pointer select-none"
                          >
                            <GameThumbnail gameType={template.id} info={template} />
                            <div className="pointer-events-none absolute inset-0 rounded-[2.25rem] shadow-[inset_0_2px_4px_rgba(255,255,255,0.45),inset_0_-8px_16px_rgba(15,23,42,0.25)]" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/30 via-transparent to-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                              <div className="w-16 h-16 bg-white/95 backdrop-blur-md rounded-full shadow-[0_12px_28px_rgba(15,23,42,0.35)] flex items-center justify-center text-slate-950 transform scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200">
                                <svg className="w-8 h-8 ml-1 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {folderToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                setFolderToRename(null);
                setRenameFolderInput('');
              }}
              className="absolute top-4 right-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">
              Rename Folder
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">
              Enter a new name for "{folderToRename.name}".
            </p>
            <input
              type="text"
              value={renameFolderInput}
              onChange={(e) => setRenameFolderInput(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl mb-4 font-bold text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
            />
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={() => {
                  setFolderToRename(null);
                  setRenameFolderInput('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameFolder}
                disabled={!renameFolderInput.trim()}
                className="px-4 py-2 bg-brand-purple hover:bg-purple-700 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Game Confirmation Modal */}
      {gameToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">Delete Game?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-5">
              Are you sure you want to delete this game? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setGameToDelete(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(gameToDelete)}
                className="px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-3.5">
              <Trash2 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1.5">Delete Folder?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-5">
              Are you sure you want to delete this folder? Any games inside will be safely moved to My Games Folder.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteFolder(folderToDelete)}
                className="px-5 py-2.5 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
              >
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowNewFolderModal(false)}
              className="absolute top-4 right-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white mb-1">New Folder</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-4">
              Create a folder to organize your custom games by level or class.
            </p>
            
            <input 
              type="text" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Unit 5 Review"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl mb-4 font-bold text-sm text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="w-full py-2.5 bg-brand-purple hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer"
            >
              Create Folder
            </button>
          </div>
        </div>
      )}

      {/* Interchangeable Games Mode Selection Modal */}
      <GameModeModal
        isOpen={Boolean(interchangeableGameModal)}
        gameData={interchangeableGameModal}
        publishedGames={effectivePublishedGames}
        onClose={() => setInterchangeableGameModal(null)}
        onSelectMode={(mode, adaptedData) => {
          setInterchangeableGameModal(null);
          onViewChange(mode as ViewState, adaptedData);
        }}
      />

      {/* Create Homework Modal */}
      <CreateHomeworkModal
        isOpen={Boolean(gameForHomework)}
        game={gameForHomework}
        onClose={() => setGameForHomework(null)}
        onNavigateToHomework={() => {
          setGameForHomework(null);
          onViewChange("homework");
        }}
      />
    </div>
  );
};
