import React, { useState, useEffect } from 'react';
import { Gamepad2, Plus, Users, Library, ArrowRight, Share2, Edit2, Play, Trash2, FolderPlus, FolderOpen, MoreVertical, X, Sparkles, Star, Flame, Eye, Lock, Globe, GlobeLock, Copy, Folder, MoreHorizontal, Gift } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { ViewState } from '../types';
import { GameThumbnail } from '../components/GameThumbnail';
import { GameModeModal, detectOriginalGameMode, PLAYABLE_GAME_OPTIONS } from '../components/GameModeModal';

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
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [gameToDelete, setGameToDelete] = useState<string | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [gameToMove, setGameToMove] = useState<string | null>(null);
  const [interchangeableGameModal, setInterchangeableGameModal] = useState<any | null>(null);

  const isInterchangeableGame = (game: any) => {
    if (!game) return false;
    const gameType = typeof game === 'string' ? game : (game.gameType || '');
    const normalized = gameType.toLowerCase().trim().replace(/[-_ ]+/g, '');
    
    // Bubble Island: ONLY in multiple-choice game mode!
    // If created in word sentence or anagram mode, do NOT include in Choose How to Play mode.
    if (['bubbleisland', 'bubblesentencepro'].includes(normalized)) {
      if (typeof game === 'object') {
        const mode = game.mode || '';
        // If explicitly word or anagram, NEVER interchangeable
        if (mode === 'word' || mode === 'anagram') {
          return false;
        }
        // If explicitly multiple-choice, it IS interchangeable
        if (mode === 'multiple-choice') {
          return true;
        }
        // Fallback for legacy games where mode might not be set:
        // Only treat as multiple-choice if it has NO customSentences and has multiple-choice questions
        const hasSentences = Array.isArray(game.customSentences) && game.customSentences.length > 0;
        const questions = game.customQuestions || game.questions;
        const hasMcqQuestions = Array.isArray(questions) && questions.some((q: any) => q && Array.isArray(q.options) && q.options.length >= 2);
        return !hasSentences && Boolean(hasMcqQuestions);
      }
      return false;
    }

    // Check direct gameType for other multiple-choice / adaptable quiz games
    if (['bubblepop', 'sumo', 'sumotags', 'yoga', 'yogaquiz', 'mysterybox', 'tictactoe', 'flashcardsmatch', 'hamsterpopquiz', 'familyfeud'].includes(normalized)) {
      return true;
    }

    // Check title/topic/name if game object is provided
    if (typeof game === 'object') {
      const title = (game.name || game.title || game.topic || '').toLowerCase();
      if (title.includes('bubble pop') || title.includes('sumo') || title.includes('yoga') || title.includes('mystery box') || title.includes('family feud')) {
        return true;
      }
      // If it has multiple-choice questions (options array) and isn't another distinct game format
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
  
  const allGameTemplates = [
    { id: "squid-game-picker", title: "NAME PICKER", icon: "/images/name-picker-card.png", color: "bg-rose-100 text-rose-600" },
    { id: "neon-chain", title: "Neon Chain", icon: "https://drive.google.com/thumbnail?id=1kovfYZSlp6X8HTqQ9OF_gSpf3wgJgNYG&sz=w1000", color: "bg-cyan-100 text-cyan-600" },
    { id: "mystery-box", title: "Mystery Box", icon: "https://drive.google.com/thumbnail?id=1ugM0rhtk40XdbSDrdDJja5QpLNkWebQn&sz=w1000", color: "bg-orange-100 text-orange-600" },
    
    { id: "bubble-pop", title: "Bubble Pop", icon: "https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000", color: "bg-blue-100 text-blue-600" },
    { id: "flashcards-match", title: "Flashcards Match", icon: "https://drive.google.com/thumbnail?id=1UtaZtVX0onrqj3VorxedOxy1iVXdFAHk&sz=w1000", color: "bg-indigo-100 text-indigo-600" },
    { id: "bubble-sentence-pro", title: "Bubble Island", icon: "https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000", color: "bg-sky-100 text-sky-600" },
    { id: "yoga-quiz", title: "Yoga Quiz", icon: "https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000", color: "bg-emerald-100 text-emerald-600" },
    { id: "family-feud", title: "Family Feud", icon: "https://drive.google.com/thumbnail?id=1DDWdERo9zS6SEbpXA7J8FSh__1CNqxZN&sz=w1000", color: "bg-yellow-100 text-yellow-600" },
    { id: "sumo", title: "Sumo Tags", icon: "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000", color: "bg-red-100 text-red-600" },
    { id: "letter-lock", title: "Letter Lock", icon: "https://images.unsplash.com/photo-1555448248-2571daf6344b?q=80&w=1000&auto=format&fit=crop", color: "bg-sky-100 text-sky-600" },
    { id: "hamster-pop-quiz", title: "Hamster Pop Quiz", icon: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1000&auto=format&fit=crop", color: "bg-yellow-100 text-yellow-600" },
    { id: "student-race", title: "Name Picker", icon: "https://images.unsplash.com/photo-1541604193435-22287d32c2c2?q=80&w=1000&auto=format&fit=crop", color: "bg-indigo-100 text-indigo-600" },
    
    { id: "tic-tac-toe", title: "Tic Tac Toe Battle", icon: "https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1000&auto=format&fit=crop", color: "bg-gray-100 text-gray-800" },
    { id: "phonemic-master", title: "Phonemic Master", icon: "https://images.unsplash.com/photo-1546410531-bf4caa381ce6?q=80&w=1000&auto=format&fit=crop", color: "bg-emerald-100 text-emerald-600" },
  ];

  const gameTemplates = allGameTemplates.filter(g => isAdmin || publishedGames[g.id] !== false);

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
      // --- Migration Script for Yoga Quizzes ---
      const savedYogaQuizzes = localStorage.getItem('yogaQuizzes');
      if (savedYogaQuizzes && user) {
        try {
          const parsedQuizzes = JSON.parse(savedYogaQuizzes);
          for (const q of parsedQuizzes) {
            // Only migrate if it has been edited (meaning it is not the default hardcoded one, or at least give it a chance)
            // But actually we can just migrate all of them.
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
          console.log('Successfully migrated yogaQuizzes to Firebase');
        } catch (err) {
          console.error('Failed to migrate yoga quizzes', err);
        }
      }
      // -----------------------------------------

      const qGames = query(
        collection(db, "mysteryBoxGames"),
        where("userId", "==", user!.uid),
      );
      const qFolders = query(
        collection(db, "gameFolders"),
        where("userId", "==", user!.uid),
      );
      
      const [gamesSnap, foldersSnap] = await Promise.all([
        getDocs(qGames),
        getDocs(qFolders)
      ]);

      const userGames: any[] = [];
      gamesSnap.forEach((doc) => {
        userGames.push({ id: doc.id, ...doc.data() });
      });

      const userFolders: any[] = [];
      foldersSnap.forEach((doc) => {
        userFolders.push({ id: doc.id, ...doc.data() });
      });

      setGames(userGames);
      setFolders(userFolders);
    } catch (error) {
      console.error("Error fetching library:", error);
    } finally {
      setLoading(false);
    }
  };


  const confirmDelete = async (gameId: string) => {
    try {
      await deleteDoc(doc(db, "mysteryBoxGames", gameId));
      setGames(games.filter(g => g.id !== gameId));
      setGameToDelete(null);
    } catch (error) {
      console.error("Error deleting game:", error);
      alert("Failed to delete game");
    }
  };

  const confirmDeleteFolder = async (folderId: string) => {
    try {
      const folderToDeleteObj = folders.find(f => f.id === folderId);
      const parentId = folderToDeleteObj?.parentId || null;

      await deleteDoc(doc(db, "gameFolders", folderId));
      
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

      setFolders(folders.map(f => f.parentId === folderId ? { ...f, parentId } : f).filter(f => f.id !== folderId));
      setGames(games.map(g => g.folderId === folderId ? { ...g, folderId: parentId } : g));
      setFolderToDelete(null);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(parentId);
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Failed to delete folder");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const newFolder = {
        name: newFolderName,
        userId: user!.uid,
        parentId: selectedFolderId || null,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, "gameFolders"), newFolder);
      setFolders([...folders, { id: docRef.id, ...newFolder }]);
      setShowNewFolderModal(false);
      setNewFolderName("");
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Failed to create folder");
    }
  };

  const handleMoveGame = async (folderId: string | null, dragGameId?: string) => {
    const targetGameId = dragGameId || gameToMove;
    if (!targetGameId) return;
    try {
       const gameRef = doc(db, "mysteryBoxGames", targetGameId);
       await updateDoc(gameRef, { folderId });
       setGames(games.map(g => g.id === targetGameId ? { ...g, folderId } : g));
       setGameToMove(null);
    } catch (error) {
       console.error("Error moving game:", error);
       alert("Failed to move game");
    }
  };

  const handleMoveFolder = async (targetFolderId: string | null, dragFolderId: string) => {
    if (targetFolderId === dragFolderId) return;
    
    // Prevent cyclical movement (moving a folder into its own subfolder)
    let current = targetFolderId;
    while (current) {
        if (current === dragFolderId) return; // Cycle detected
        const parent = folders.find(f => f.id === current);
        current = parent?.parentId || null;
    }

    try {
       const folderRef = doc(db, "gameFolders", dragFolderId);
       await updateDoc(folderRef, { parentId: targetFolderId });
       setFolders(folders.map(f => f.id === dragFolderId ? { ...f, parentId: targetFolderId } : f));
    } catch (error) {
       console.error("Error moving folder:", error);
       alert("Failed to move folder");
    }
  };

  const handleTogglePublic = async (game: any) => {
    try {
      const gameRef = doc(db, "mysteryBoxGames", game.id);
      await updateDoc(gameRef, { isPublic: !game.isPublic });
      setGames(games.map(g => g.id === game.id ? { ...g, isPublic: !game.isPublic } : g));
    } catch (error) {
      console.error("Error toggling public status:", error);
      alert("Failed to update status");
    }
  };

  const handleDelete = (id: string) => {
    setGameToDelete(id);
  };

  const handleDuplicateGame = async (game: any) => {
    try {
       const newGame = { ...game, name: `${game.name || game.topic} (Copy)`, createdAt: new Date().toISOString() };
       delete newGame.id;
       const docRef = await addDoc(collection(db, "mysteryBoxGames"), newGame);
       setGames([...games, { id: docRef.id, ...newGame }]);
    } catch (error) {
       console.error("Error duplicating game:", error);
       alert("Failed to duplicate game");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-purple"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500 dark:text-slate-400 font-bold text-lg bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-sm border-2 border-slate-100 dark:border-slate-700">
          Please sign in to view your saved games.
        </p>
      </div>
    );
  }

  const baseFilteredGames = selectedFolderId 
    ? games.filter(g => g.folderId === selectedFolderId)
    : games.filter(g => !g.folderId);

  const filteredGames = baseFilteredGames.filter(g => isAdmin || publishedGames[g.gameType || "mystery-box"] !== false);

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

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 flex flex-col gap-8">
      {/* Main Content */}
      <div className="flex-1">
        <div 
          className="flex justify-between items-center mb-8 bg-white dark:bg-slate-800 p-6 rounded-[24px] shadow-sm border-2 border-slate-100 dark:border-slate-700 flex-wrap gap-4"
          onDragOver={(e) => {
            if (!selectedFolderId) return; // Only accept drops if we are inside a folder
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
          <div className="flex items-center gap-4">
            {selectedFolderId && (
              <button 
                onClick={() => {
                  const currentFolder = folders.find(f => f.id === selectedFolderId);
                  setSelectedFolderId(currentFolder?.parentId || null);
                }}
                className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-200 transition-colors shrink-0"
              >
                <X className="w-6 h-6 text-slate-600 dark:text-slate-400" />
              </button>
            )}
            <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
              <FolderOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-slate-200">
                {selectedFolderId ? folders.find(f => f.id === selectedFolderId)?.name || "Folder" : "My Games Folder"}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                {selectedFolderId ? `${filteredGames.length} ${filteredGames.length === 1 ? 'game' : 'games'}` : "Manage your custom vocabulary games"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition"
            >
              <FolderPlus className="w-5 h-5" />
              <span className="hidden sm:inline">New Folder</span>
            </button>
            <button
              onClick={() => setShowNewGameModal(true)}
              className="flex items-center gap-2 px-5 py-3 bg-brand-purple text-white font-bold rounded-xl shadow-[0_4px_0_#4c1d95] active:translate-y-[4px] active:shadow-none hover:bg-purple-700 transition"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">New Game</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {folders.filter(f => (f.parentId || null) === (selectedFolderId || null)).map((folder) => (
            <div
              key={folder.id}
              onClick={() => setSelectedFolderId(folder.id)}
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
              className="group bg-white dark:bg-slate-800 rounded-[24px] p-6 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-slate-100 dark:border-slate-700 cursor-pointer flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="w-14 h-14 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <FolderOpen size={28} />
                </div>
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button 
                    onClick={() => setOpenMenuId(openMenuId === folder.id ? null : folder.id)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {openMenuId === folder.id && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 z-50">
                      <button 
                        onClick={() => {
                          setFolderToDelete(folder.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-semibold flex items-center gap-2"
                      >
                        <Trash2 size={16} /> Delete Folder
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-800 dark:text-slate-200 mb-1">{folder.name}</h3>
                <p className="text-slate-500 text-sm font-medium">Folder</p>
              </div>
            </div>
          ))}

          {filteredGames.map((game) => (
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
              className={`group bg-white dark:bg-slate-800 rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-slate-100 dark:border-slate-700 flex flex-col relative cursor-pointer ${openMenuId === game.id ? 'z-50' : 'z-10'}`}
            >
              <div className="p-5 flex flex-col h-full relative z-10 bg-white dark:bg-slate-800 rounded-[24px]">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 pr-2">
                    <h3 className="font-black text-lg text-slate-800 dark:text-slate-200 line-clamp-2">
                      {game.topic || game.name || game.title || "No Topic"}
                    </h3>
                  </div>
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 shadow-sm border-2 border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center font-bold text-4xl group-hover:scale-[1.10] transition-transform shrink-0 z-20 relative overflow-hidden">
                    <GameThumbnail gameType={game.gameType} info={gameTemplates.find(t => t.id === game.gameType) || {}} game={game} compact={true} />
                  </div>
                </div>

                <div className="space-y-1.5 mb-4 p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-slate-100 dark:border-slate-700 mt-auto">
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-black text-slate-400 uppercase text-xs w-14">
                      Game
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {gameTemplates.find(t => t.id === game.gameType)?.title || PLAYABLE_GAME_OPTIONS.find(o => o.id === detectOriginalGameMode(game))?.title || "Mystery Box"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-black text-slate-400 uppercase text-xs w-14">
                      Class
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {game.className || game.classLevel || "General"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-black text-slate-400 uppercase text-xs w-14">
                      Items
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {game.customQuestions?.length ?? game.questions?.length ?? game.sentences?.length ?? 0}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto pt-2 relative z-20">
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
                    className="flex-1 bg-green-500 text-white hover:bg-green-600 font-black py-2.5 px-4 rounded-xl shadow-[0_3px_0_#166534] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" /> Play
                  </button>

                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); if (openMenuId === game.id) {
                          setOpenMenuId(null);
                          setGameToMove(null);
                        } else {
                          setOpenMenuId(game.id);
                        }
                      }}
                      className={`w-11 h-11 font-bold rounded-xl transition-colors flex items-center justify-center shadow-sm shrink-0 ${openMenuId === game.id ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200' : 'bg-slate-100 text-slate-600 dark:text-slate-400 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                      title="More Options"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </button>
                    
                    {openMenuId === game.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => { setOpenMenuId(null); setGameToMove(null); }}></div>
                        <div className="absolute bottom-14 right-0 w-56 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 shadow-xl rounded-2xl overflow-hidden z-40 flex flex-col animate-in fade-in slide-in-from-bottom-2">
                          {gameToMove === game.id ? (
                            <>
                              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Move to...</span>
                                <button onClick={(e) => { e.stopPropagation(); setGameToMove(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                              </div>
                              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleMoveGame(null); setOpenMenuId(null); }}
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2"
                                 >
                                    <Gamepad2 className="w-4 h-4 text-slate-400" />
                                    All Games
                                 </button>
                                 {folderTree.map(({folder: f, depth}) => (
                                    <button
                                       key={f.id}
                                       onClick={(e) => { e.stopPropagation(); handleMoveGame(f.id); setOpenMenuId(null); }}
                                       className="w-full text-left py-3 hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-900/50 text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700"
                                       style={{ paddingLeft: `${1 + depth * 1.5}rem`, paddingRight: '1rem' }}
                                    >
                                       <Folder className="w-4 h-4 text-slate-400 shrink-0" />
                                       <span className="truncate">{f.name}</span>
                                    </button>
                                 ))}
                              </div>
                            </>
                          ) : (
                            <div className="py-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); onViewChange((game.gameType as any) || "mystery-box", { ...game, editMode: true }); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-blue-500" />
                                Edit Game
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setGameToMove(game.id); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                              >
                                <FolderOpen className="w-4 h-4 text-brand-purple" />
                                Move to Folder...
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleTogglePublic(game); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                              >
                                {game.isPublic ? (
                                  <><GlobeLock className="w-4 h-4 text-amber-500" /> Unpublish Game</>
                                ) : (
                                  <><Globe className="w-4 h-4 text-amber-500" /> Publish to Community</>
                                )}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDuplicateGame(game); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                              >
                                <Copy className="w-4 h-4 text-indigo-500" />
                                Duplicate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rawQuestions = game.customQuestions || game.questions || [];
                                  const sanitized = (Array.isArray(rawQuestions) ? rawQuestions : []).slice(0, 30);
                                  onViewChange("mystery-box", {
                                    ...game,
                                    title: `${game.topic || game.name || 'Game'}`,
                                    topic: `${game.topic || game.name || 'Game'}`,
                                    gameType: 'mystery-box',
                                    customQuestions: sanitized,
                                    questions: sanitized,
                                    editMode: false,
                                  });
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-3 transition-colors"
                              >
                                <Gift className="w-4 h-4 text-amber-500" />
                                Play in Mystery Box (1-30)
                              </button>
                              <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(game.id); setOpenMenuId(null); }}
                                className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-3 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Game
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
          ))}

          {folders.filter(f => (f.parentId || null) === (selectedFolderId || null)).length === 0 && filteredGames.length === 0 && (
            <div className="col-span-full py-16 px-6 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-purple-50 dark:bg-purple-900/20 text-brand-purple rounded-3xl flex items-center justify-center mb-4 shadow-sm">
                <Gamepad2 size={36} />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
                {selectedFolderId ? "This Folder is Empty" : "No Saved Games Yet"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-6 leading-relaxed">
                {selectedFolderId
                  ? "Move games into this folder or create a new game inside it."
                  : "Start creating your personalized games like Bubble Pop, Sumo, Mystery Box, and more!"}
              </p>
              <button
                onClick={() => setShowNewGameModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-brand-purple hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg transition-all cursor-pointer"
              >
                <Plus size={20} />
                <span>Create a Game</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Game Template Modal */}
      {showNewGameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative border-4 border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setShowNewGameModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">
              Select Game Template
            </h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
              Choose a game type to start building your custom lesson.
            </p>
            <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {gameTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    setShowNewGameModal(false);
                    onViewChange(template.id as ViewState);
                  }}
                  className="flex flex-col items-center p-0 rounded-[40px] border-[6px] border-white bg-white dark:bg-slate-800 shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:-translate-y-2 ring-1 ring-slate-100 transition-all duration-300 text-center group overflow-hidden aspect-[1000/791] relative cursor-pointer"
                >
                  <GameThumbnail gameType={template.id} info={template} />
                  <div className="absolute inset-0 bg-brand-purple/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-16 h-16 bg-white dark:bg-slate-800/90 backdrop-blur-sm rounded-full flex items-center justify-center text-brand-purple shadow-lg transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 delay-75">
                      <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {gameToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border-4 border-slate-100 dark:border-slate-700 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">Delete Game?</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
              Are you sure you want to delete this game? This action cannot be undone.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setGameToDelete(null)}
                className="px-6 py-3 bg-slate-100 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(gameToDelete)}
                className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_4px_0_#991b1b] active:translate-y-[4px] active:shadow-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border-4 border-slate-100 dark:border-slate-700 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">Delete Folder?</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">
              Are you sure you want to delete this folder? Your games inside will be moved to 'All Games'.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setFolderToDelete(null)}
                className="px-6 py-3 bg-slate-100 text-slate-600 dark:text-slate-400 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDeleteFolder(folderToDelete)}
                className="px-6 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-[0_4px_0_#991b1b] active:translate-y-[4px] active:shadow-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative border-4 border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setShowNewFolderModal(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">New Folder</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-6">Create a folder to organize your games.</p>
            
            <input 
              type="text" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Unit 5 Review"
              className="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-xl mb-6 font-bold text-slate-700 focus:outline-none focus:border-brand-purple"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="w-full py-4 bg-brand-purple text-white font-bold text-lg rounded-xl shadow-[0_4px_0_#4c1d95] active:translate-y-[4px] active:shadow-none hover:bg-purple-700 transition disabled:opacity-50 disabled:active:translate-y-0 disabled:active:shadow-[0_4px_0_#4c1d95]"
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
        onClose={() => setInterchangeableGameModal(null)}
        onSelectMode={(mode, adaptedData) => {
          setInterchangeableGameModal(null);
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
};
