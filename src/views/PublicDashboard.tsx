import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ViewState } from "../types";
import { GameThumbnail } from "../components/GameThumbnail";
import { Gamepad2, Play, Search, Users, Filter } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";

export function PublicDashboard({
  onViewChange,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
}) {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [modeModalGame, setModeModalGame] = useState<any | null>(null);

  useEffect(() => {
    const fetchPublicGames = async () => {
      try {
        const qGames = query(
          collection(db, "mysteryBoxGames"),
          where("isPublic", "==", true)
        );
        const gamesSnap = await getDocs(qGames);
        
        const publicGames: any[] = [];
        gamesSnap.forEach((doc) => {
          publicGames.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort by date first to get the newest
        publicGames.sort((a, b) => {
          const getTime = (val: any) => {
            if (!val) return 0;
            if (val.toMillis) return val.toMillis();
            if (val.seconds) return val.seconds * 1000;
            if (typeof val === 'number') return val;
            if (typeof val === 'string') return new Date(val).getTime();
            return 0;
          };
          return getTime(b.createdAt) - getTime(a.createdAt);
        });
        
        // Interleave by gameType to show variety at the top
        const grouped = publicGames.reduce((acc, game) => {
          const type = game.gameType || 'unknown';
          if (!acc[type]) acc[type] = [];
          acc[type].push(game);
          return acc;
        }, {} as Record<string, any[]>);
        
        const interleaved: any[] = [];
        let added = true;
        while (added) {
          added = false;
          for (const type in grouped) {
            if (grouped[type].length > 0) {
              interleaved.push(grouped[type].shift());
              added = true;
            }
          }
        }
        
        setGames(interleaved);
      } catch (error) {
        console.error("Error fetching public games:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPublicGames();
  }, [user]);

  const allGameTemplates = [
    { id: "mystery-box", title: "Mystery Box", color: "text-orange-600", icon: "https://drive.google.com/thumbnail?id=1ugM0rhtk40XdbSDrdDJja5QpLNkWebQn&sz=w1000" },
    
    { id: "bubble-pop", title: "Bubble Pop", color: "text-blue-600", icon: "https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000" },
    { id: "flashcards-match", title: "Flashcards Match", color: "text-indigo-600", icon: "https://drive.google.com/thumbnail?id=1UtaZtVX0onrqj3VorxedOxy1iVXdFAHk&sz=w1000" },
    { id: "bubble-sentence-pro", title: "Bubble Island", color: "text-sky-600", icon: "https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000" },
    { id: "yoga-quiz", title: "Yoga Quiz", color: "text-emerald-600", icon: "https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000" },
    { id: "family-feud", title: "Family Feud", color: "text-yellow-600", icon: "https://drive.google.com/thumbnail?id=1DDWdERo9zS6SEbpXA7J8FSh__1CNqxZN&sz=w1000" },
    { id: "sumo", title: "Sumo", color: "text-red-600", icon: "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000" },
    { id: "hamster-pop-quiz", title: "Hamster Pop", color: "text-pink-600", icon: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1000&auto=format&fit=crop" },
    { id: "student-race", title: "Student Race", color: "text-violet-600", icon: "https://images.unsplash.com/photo-1541604193435-22287d32c2c2?q=80&w=1000&auto=format&fit=crop" },
    { id: "letter-lock", title: "Letter Lock", color: "text-blue-600", icon: "https://images.unsplash.com/photo-1555448248-2571daf6344b?q=80&w=1000&auto=format&fit=crop" },
    
    { id: "tic-tac-toe", title: "Tic Tac Toe Battle", color: "text-gray-800", icon: "https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1000&auto=format&fit=crop" },
    { id: "phonemic-master", title: "Phonemic Master", color: "text-emerald-600", icon: "https://images.unsplash.com/photo-1546410531-bf4caa381ce6?q=80&w=1000&auto=format&fit=crop" }
  ];

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

    // Check direct gameType for other multiple-choice quiz games
    if (['bubblepop', 'sumo', 'sumotags', 'yoga', 'yogaquiz'].includes(normalized)) {
      return true;
    }

    // Check title/topic/name if game object is provided
    if (typeof game === 'object') {
      const title = (game.name || game.title || game.topic || '').toLowerCase();
      if (title.includes('bubble pop') || title.includes('sumo') || title.includes('yoga')) {
        return true;
      }
      // If it has multiple-choice questions (options array) and isn't another distinct game format
      const questions = game.customQuestions || game.questions;
      if (Array.isArray(questions) && questions.length > 0) {
        const hasOptions = questions.some((q: any) => q && Array.isArray(q.options) && q.options.length >= 2);
        const distinctOtherTypes = [
          'squidgamepicker', 'neonchain', 'bubbleisland', 'bubblesentencepro',
          'familyfeud', 'letterlock', 'tictactoe', 'phonemicmaster', 'studentrace', 'flashcardsmatch'
        ];
        if (hasOptions && !distinctOtherTypes.includes(normalized)) {
          return true;
        }
      }
    }

    return false;
  };

  const getTemplateInfo = (templateId: string) => {
    return allGameTemplates.find(t => t.id === templateId) || { title: "Unknown Game", color: "text-slate-600", icon: "" };
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = 
      (game.topic || game.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (game.creatorName || "").toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesType = filterType === "all" || game.gameType === filterType;
    
    return matchesSearch && matchesType;
  });

  const availableTypes = Array.from(new Set(games.map(g => g.gameType).filter(Boolean)));

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 flex flex-col gap-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-purple to-indigo-600 p-8 rounded-[32px] shadow-lg text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-yellow/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-3 flex items-center gap-3">
              <Users className="w-10 h-10 text-brand-yellow" />
              Community Hub
            </h1>
            <p className="text-indigo-100 text-lg max-w-2xl font-medium leading-relaxed">
              Discover and play amazing educational games created by teachers from around the world.
            </p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shrink-0">
             <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
               <Gamepad2 size={24} className="text-white" />
             </div>
             <div>
               <div className="text-3xl font-black">{games.length}</div>
               <div className="text-indigo-100 text-sm font-semibold uppercase tracking-wider">Public Games</div>
             </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search topics, titles, or creators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple transition-all font-medium"
          />
        </div>
        
        <div className="relative w-full md:w-64 shrink-0 flex items-center">
          <Filter className="absolute left-4 text-slate-400" size={18} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 appearance-none font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="all">All Game Types</option>
            {availableTypes.map(type => {
              const info = getTemplateInfo(type);
              return <option key={type} value={type}>{info.title}</option>
            })}
          </select>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-purple"></div>
          <p className="mt-4 text-slate-500 font-semibold">Loading community games...</p>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">No games found</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            Try adjusting your search terms or filters to find what you're looking for.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => {
            const info = getTemplateInfo(game.gameType);
            const isMultiModeCompatible = isInterchangeableGame(game);

            return (
              <div
                key={game.id}
                className="group bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-slate-100 dark:border-slate-700 flex flex-col cursor-pointer relative"
                onClick={() => {
                  if (isMultiModeCompatible) {
                    setModeModalGame(game);
                  } else {
                    onViewChange(game.gameType as ViewState, game);
                  }
                }}
              >
                <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden border-b-2 border-slate-100 dark:border-slate-700">
                   <div className="absolute inset-0 bg-gradient-to-br from-brand-purple/5 to-transparent z-10"></div>
                   <GameThumbnail gameType={game.gameType} info={info} />

                   {/* Play overlay */}
                   <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-30">
                     <div className="w-16 h-16 bg-brand-purple text-white rounded-full flex items-center justify-center transform scale-50 group-hover:scale-100 transition-transform duration-300 shadow-xl">
                       <Play className="ml-1" size={28} />
                     </div>
                   </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 line-clamp-1">
                      {game.topic || game.name || "Untitled Game"}
                    </h3>
                    {game.classLevel && (
                      <span className="px-2 py-1 bg-brand-yellow/20 text-yellow-800 dark:text-yellow-500 rounded-md text-xs font-bold whitespace-nowrap shrink-0">
                        {game.classLevel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3-Game Mode Selection Modal */}
      <GameModeModal 
        isOpen={Boolean(modeModalGame)}
        gameData={modeModalGame}
        onClose={() => setModeModalGame(null)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}
