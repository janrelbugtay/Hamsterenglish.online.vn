import React, { useEffect, useState, useMemo } from "react";
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ViewState } from "../types";
import { GameThumbnail } from "../components/GameThumbnail";
import { 
  Gamepad2, 
  Play, 
  Search, 
  Users, 
  Filter, 
  Sparkles, 
  RefreshCw, 
  UserCheck, 
  Flame, 
  GraduationCap, 
  ArrowUpDown, 
  X,
  Award
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";

export type CambridgeType = 'Starters' | 'Movers' | 'Flyers' | 'KET' | 'PET' | 'IELTS';
export type GradeType = 
  | 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' 
  | 'Grade 5' | 'Grade 6' | 'Grade 7' | 'Grade 8' 
  | 'Grade 9' | 'Grade 10' | 'Grade 11' | 'Grade 12';

export const CAMBRIDGE_COURSES: { id: CambridgeType; label: string; badgeClass: string }[] = [
  { id: 'Starters', label: 'Starters', badgeClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700' },
  { id: 'Movers', label: 'Movers', badgeClass: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 border-sky-300 dark:border-sky-700' },
  { id: 'Flyers', label: 'Flyers', badgeClass: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700' },
  { id: 'KET', label: 'KET', badgeClass: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-300 dark:border-purple-700' },
  { id: 'PET', label: 'PET', badgeClass: 'bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300 border-pink-300 dark:border-pink-700' },
  { id: 'IELTS', label: 'IELTS', badgeClass: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-300 dark:border-rose-700' },
];

export const ALL_GRADES: GradeType[] = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
  'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8',
  'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'
];

export type SortMode = 
  | 'latest'
  | 'grade-asc'
  | 'cambridge-asc'
  | 'questions-desc'
  | 'title-asc'
  | 'oldest';

/**
 * Accurately extracts school grade number (1 to 12) from game metadata.
 * NOTE: Lesson units (e.g. "Unit 2") are lessons, NOT grades.
 */
export function extractGradeNumber(game: any): number | null {
  if (!game) return null;
  const classText = `${game.classLevel || ''} ${game.className || ''}`.trim();
  const titleText = `${game.topic || ''} ${game.name || ''} ${game.title || ''}`.trim();

  // 1. Direct match on classLevel / className: e.g. "Grade 9", "Gr 9", "9", "Class 9", "Lớp 9"
  if (/^0?([1-9]|1[0-2])$/.test(classText)) {
    return parseInt(classText, 10);
  }

  const classGradeMatch = classText.match(/\b(?:grade|gr\.?|class|lớp|lop|g)\s*0?([1-9]|1[0-2])\b/i);
  if (classGradeMatch) {
    return parseInt(classGradeMatch[1], 10);
  }

  // 2. Explicit Grade in title/topic: e.g. "Grade 9", "Gr 9", "Class 9", "Lớp 9"
  const titleGradeMatch = titleText.match(/\b(?:grade|gr\.?|class|lớp|lop)\s*0?([1-9]|1[0-2])\b/i);
  if (titleGradeMatch) {
    return parseInt(titleGradeMatch[1], 10);
  }

  // 3. Curriculum textbook series + Grade number in title:
  // e.g. "Global Success 9 Unit 2" -> Grade 9! (Never matches Unit 2 as a grade)
  const curriculumMatch = titleText.match(
    /\b(?:global\s*success|gs|tiếng\s*anh|english|smart\s*start|smart\s*world|family\s*and\s*friends|friends\s*plus|i-?learn(?:\s*smart\s*(?:start|world))?|explore\s*(?:english|our\s*world)?|bright)\s*0?([1-9]|1[0-2])\b/i
  );
  if (curriculumMatch) {
    return parseInt(curriculumMatch[1], 10);
  }

  return null;
}

/**
 * Extracts Cambridge course (Starters, Movers, Flyers, KET, PET, IELTS).
 */
export function extractCambridgeCourse(game: any): CambridgeType | null {
  if (!game) return null;
  const classText = `${game.classLevel || ''} ${game.className || ''}`.toLowerCase();
  const titleText = `${game.topic || ''} ${game.name || ''} ${game.title || ''}`.toLowerCase();
  const combined = `${classText} ${titleText}`;

  if (/\bielts\b/i.test(combined)) return 'IELTS';
  if (/\b(?:pet\b|b1\s*preliminary\b|preliminary\s*english)/i.test(combined)) return 'PET';
  if (/\b(?:ket\b|a2\s*key\b|key\s*english)/i.test(combined)) return 'KET';
  if (/\b(?:flyers?|yle\s*flyers?|a2\s*flyers?)\b/i.test(combined)) return 'Flyers';
  if (/\b(?:movers?|yle\s*movers?|a1\s*movers?)\b/i.test(combined)) return 'Movers';
  if (/\b(?:starters?|yle\s*starters?|pre-?a1)\b/i.test(combined)) return 'Starters';

  return null;
}

export function matchGameGrade(game: any, gradeNumber: number): boolean {
  return extractGradeNumber(game) === gradeNumber;
}

export function matchGameCambridge(game: any, course: CambridgeType): boolean {
  return extractCambridgeCourse(game) === course;
}

export function getGameCambridgeRank(game: any): number {
  const course = extractCambridgeCourse(game);
  if (course === 'Starters') return 1;
  if (course === 'Movers') return 2;
  if (course === 'Flyers') return 3;
  if (course === 'KET') return 4;
  if (course === 'PET') return 5;
  if (course === 'IELTS') return 6;
  return 999;
}

export function getGameQuestionCount(game: any): number {
  return (
    game.customQuestions?.length ||
    game.questions?.length ||
    game.customSentences?.length ||
    game.sentences?.length ||
    0
  );
}

export function getGameDisplayBadge(game: any) {
  const raw = (game.classLevel || game.className || '').trim();

  // 1. Check Cambridge course
  const cambridge = extractCambridgeCourse(game);
  if (cambridge) {
    const info = CAMBRIDGE_COURSES.find(c => c.id === cambridge);
    return {
      label: cambridge,
      badgeClass: info?.badgeClass || 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
      type: 'cambridge' as const,
    };
  }

  // 2. Check Grade 1 to 12
  const gradeNum = extractGradeNumber(game);
  if (gradeNum !== null && gradeNum >= 1 && gradeNum <= 12) {
    return {
      label: `Grade ${gradeNum}`,
      badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700',
      type: 'grade' as const,
    };
  }

  // 3. Fallback to raw non-empty classLevel
  if (raw) {
    return {
      label: raw,
      badgeClass: 'bg-brand-yellow/20 text-yellow-800 dark:text-yellow-500 border-yellow-300/40',
      type: 'other' as const,
    };
  }

  return null;
}

export function PublicDashboard({
  onViewChange,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
}) {
  const { user } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [pageVisits, setPageVisits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortMode>('latest');
  const [onlyMyGames, setOnlyMyGames] = useState(false);
  const [modeModalGame, setModeModalGame] = useState<any | null>(null);

  const getTime = (val: any) => {
    if (!val) return 0;
    if (val.toMillis) return val.toMillis();
    if (val.seconds) return val.seconds * 1000;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = new Date(val).getTime();
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const getGameTime = (g: any) => {
    return getTime(g.publishedAt) || getTime(g.updatedAt) || getTime(g.createdAt) || 0;
  };

  // Helper to fetch and merge all public games
  const fetchAllPublicGames = async () => {
    try {
      const gamesMap = new Map<string, any>();

      // 1. Primary query: boolean isPublic == true
      try {
        const qBool = query(
          collection(db, "mysteryBoxGames"),
          where("isPublic", "==", true)
        );
        const boolSnap = await getDocs(qBool);
        boolSnap.forEach((doc) => {
          gamesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.warn("Public games boolean query notice:", e);
      }

      // 2. Secondary query: string isPublic == "true"
      try {
        const qStr = query(
          collection(db, "mysteryBoxGames"),
          where("isPublic", "==", "true")
        );
        const strSnap = await getDocs(qStr);
        strSnap.forEach((doc) => {
          gamesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });
      } catch (e) {
        // String query fallback
      }

      // 3. User's own published games guarantee
      if (user && user.uid) {
        try {
          const qUser = query(
            collection(db, "mysteryBoxGames"),
            where("userId", "==", user.uid)
          );
          const userSnap = await getDocs(qUser);
          userSnap.forEach((doc) => {
            const data = doc.data();
            const isPub = data.isPublic === true || data.isPublic === 'true' || String(data.isPublic).toLowerCase() === 'true';
            if (isPub) {
              gamesMap.set(doc.id, { id: doc.id, ...data });
            }
          });
        } catch (e) {
          console.warn("User own games fetch notice:", e);
        }
      }

      const combined = Array.from(gamesMap.values());
      setGames(combined);
    } catch (error) {
      console.error("Error fetching public games:", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Setup real-time listener for public games
  useEffect(() => {
    setLoading(true);
    fetchAllPublicGames();

    let unsubscribe: (() => void) | null = null;
    try {
      const qLive = query(
        collection(db, "mysteryBoxGames"),
        where("isPublic", "==", true)
      );
      unsubscribe = onSnapshot(qLive, (snapshot) => {
        setGames((prev) => {
          const map = new Map<string, any>();
          prev.forEach((g) => map.set(g.id, g));
          snapshot.forEach((doc) => {
            map.set(doc.id, { id: doc.id, ...doc.data() });
          });
          return Array.from(map.values());
        });
        setLoading(false);
      }, (err) => {
        console.warn("Realtime listener notice:", err);
      });
    } catch (e) {
      console.warn("Failed to attach snapshot listener:", e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  // Listen to platform users count
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setPageVisits(docSnap.data().pageVisits || 0);
      }
    }, (err) => {
      console.warn("Public dashboard pageVisits listener notice:", err);
    });
    return () => unsub();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const snap = await getDoc(doc(db, 'settings', 'general'));
      if (snap.exists()) {
        setPageVisits(snap.data().pageVisits || 0);
      }
    } catch (e) {
      console.warn("Error refreshing users count:", e);
    }
    fetchAllPublicGames();
  };

  const allGameTemplates = [
    { id: "mystery-box", title: "Mystery Box", color: "text-orange-600", icon: "/images/mystery-box-card.jpg" },
    { id: "bubble-pop", title: "Bubble Pop", color: "text-blue-600", icon: "https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000" },
    { id: "roller-coaster-quiz", title: "Roller Coaster Quiz", color: "text-amber-600", icon: "/images/roller-coaster-quiz-card.jpg" },
    { id: "slap-and-chop", title: "Slap & Chop", color: "text-purple-600", icon: "/images/slap-and-chop-card.jpg" },
    { id: "shark-attack", title: "Shark Attack", color: "text-cyan-600", icon: "/images/shark-attack-card.jpg" },
    { id: "flashcards-match", title: "Flashcards Match", color: "text-indigo-600", icon: "https://drive.google.com/thumbnail?id=1UtaZtVX0onrqj3VorxedOxy1iVXdFAHk&sz=w1000" },
    { id: "bubble-sentence-pro", title: "Bubble Island", color: "text-sky-600", icon: "https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000" },
    { id: "yoga-quiz", title: "Yoga Quiz", color: "text-emerald-600", icon: "https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000" },
    { id: "family-feud", title: "Family Feud", color: "text-yellow-600", icon: "https://drive.google.com/thumbnail?id=1DDWdERo9zS6SEbpXA7J8FSh__1CNqxZN&sz=w1000" },
    { id: "sumo", title: "Sumo", color: "text-red-600", icon: "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000" },
    { id: "hamster-pop-quiz", title: "Hamster Pop", color: "text-pink-600", icon: "https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1000&auto=format&fit=crop" },
    { id: "student-race", title: "Student Race", color: "text-violet-600", icon: "https://images.unsplash.com/photo-1541604193435-22287d32c2c2?q=80&w=1000&auto=format&fit=crop" },
    { id: "letter-lock", title: "Letter Lock", color: "text-blue-600", icon: "https://images.unsplash.com/photo-1555448248-2571daf6344b?q=80&w=1000&auto=format&fit=crop" },
    { id: "squid-game-picker", title: "Name Picker", color: "text-rose-600", icon: "/images/name-picker-card.jpg" },
    { id: "neon-chain", title: "Neon Chain", color: "text-cyan-600", icon: "https://drive.google.com/thumbnail?id=1kovfYZSlp6X8HTqQ9OF_gSpf3wgJgNYG&sz=w1000" },
    { id: "tic-tac-toe", title: "Tic Tac Toe Battle", color: "text-gray-800", icon: "https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1000&auto=format&fit=crop" },
    { id: "phonemic-master", title: "Phonemic Master", color: "text-emerald-600", icon: "https://images.unsplash.com/photo-1546410531-bf4caa381ce6?q=80&w=1000&auto=format&fit=crop" }
  ];

  const normalizeGameType = (type: string | undefined): string => {
    if (!type) return "unknown";
    const clean = type.toLowerCase().trim().replace(/[-_ ]+/g, "");
    if (clean === "bubblepop") return "bubble-pop";
    if (clean === "mysterybox") return "mystery-box";
    if (clean === "sharkattack") return "shark-attack";
    if (clean === "sumo" || clean === "sumotags") return "sumo";
    if (clean === "yoga" || clean === "yogaquiz") return "yoga-quiz";
    if (clean === "bubbleisland" || clean === "bubblesentencepro") return "bubble-sentence-pro";
    if (clean === "familyfeud") return "family-feud";
    if (clean === "flashcardsmatch") return "flashcards-match";
    if (clean === "hamsterpopquiz") return "hamster-pop-quiz";
    if (clean === "studentrace") return "student-race";
    if (clean === "squidgamepicker") return "squid-game-picker";
    if (clean === "tictactoe") return "tic-tac-toe";
    return type;
  };

  const isInterchangeableGame = (game: any) => {
    if (!game) return false;
    const gameType = typeof game === 'string' ? game : (game.gameType || '');
    const normalized = gameType.toLowerCase().trim().replace(/[-_ ]+/g, '');
    
    // Bubble Island: ONLY in multiple-choice game mode!
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

    if (['bubblepop', 'sharkattack', 'sumo', 'sumotags', 'yoga', 'yogaquiz', 'mysterybox', 'tictactoe', 'flashcardsmatch', 'hamsterpopquiz', 'familyfeud'].includes(normalized)) {
      return true;
    }

    if (typeof game === 'object') {
      const title = (game.topic || game.name || game.title || '').toLowerCase();
      if (title.includes('bubble pop') || title.includes('shark') || title.includes('sumo') || title.includes('yoga') || title.includes('mystery box') || title.includes('family feud')) {
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

  const getTemplateInfo = (templateId: string) => {
    const normalized = normalizeGameType(templateId);
    return allGameTemplates.find(t => t.id === templateId || t.id === normalized) || { title: "Custom Game", color: "text-slate-600", icon: "" };
  };

  // Available game types for select dropdown
  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    games.forEach((g) => {
      if (g.gameType) types.add(normalizeGameType(g.gameType));
    });
    return Array.from(types);
  }, [games]);

  const myGamesCount = useMemo(() => {
    if (!user) return 0;
    return games.filter((g) => g.userId === user.uid).length;
  }, [games, user]);

  // Filtered games
  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const titleStr = (game.topic || game.name || game.title || "").toLowerCase();
      const creatorStr = (game.creatorName || "").toLowerCase();
      const classStr = (game.className || game.classLevel || "").toLowerCase();
      const q = searchTerm.toLowerCase().trim();

      const matchesSearch = !q || titleStr.includes(q) || creatorStr.includes(q) || classStr.includes(q);
      const matchesType = filterType === "all" || normalizeGameType(game.gameType) === normalizeGameType(filterType);
      const matchesMyGames = !onlyMyGames || (user && game.userId === user.uid);

      let matchesLevel = true;
      if (selectedLevel !== 'all') {
        if (selectedLevel.startsWith('Grade ')) {
          const gradeNum = parseInt(selectedLevel.replace('Grade ', ''), 10);
          matchesLevel = matchGameGrade(game, gradeNum);
        } else {
          matchesLevel = matchGameCambridge(game, selectedLevel as CambridgeType);
        }
      }

      return matchesSearch && matchesType && matchesMyGames && matchesLevel;
    });
  }, [games, searchTerm, filterType, onlyMyGames, selectedLevel, user]);

  // Sorted games
  const sortedGames = useMemo(() => {
    const list = [...filteredGames];

    switch (sortBy) {
      case 'latest':
        return list.sort((a, b) => getGameTime(b) - getGameTime(a));

      case 'grade-asc':
        return list.sort((a, b) => {
          const ga = extractGradeNumber(a) ?? 999;
          const gb = extractGradeNumber(b) ?? 999;
          if (ga !== gb) return ga - gb;
          const ca = getGameCambridgeRank(a);
          const cb = getGameCambridgeRank(b);
          if (ca !== cb) return ca - cb;
          return getGameTime(b) - getGameTime(a);
        });

      case 'cambridge-asc':
        return list.sort((a, b) => {
          const ca = getGameCambridgeRank(a);
          const cb = getGameCambridgeRank(b);
          if (ca !== cb) return ca - cb;
          const ga = extractGradeNumber(a) ?? 999;
          const gb = extractGradeNumber(b) ?? 999;
          if (ga !== gb) return ga - gb;
          return getGameTime(b) - getGameTime(a);
        });

      case 'questions-desc':
        return list.sort((a, b) => {
          const qa = getGameQuestionCount(a);
          const qb = getGameQuestionCount(b);
          if (qa !== qb) return qb - qa;
          return getGameTime(b) - getGameTime(a);
        });

      case 'title-asc':
        return list.sort((a, b) => {
          const ta = (a.topic || a.name || a.title || "").toLowerCase();
          const tb = (b.topic || b.name || b.title || "").toLowerCase();
          return ta.localeCompare(tb);
        });

      case 'oldest':
        return list.sort((a, b) => getGameTime(a) - getGameTime(b));

      default:
        return list.sort((a, b) => getGameTime(b) - getGameTime(a));
    }
  }, [filteredGames, sortBy]);

  // Freshly published (within last 48 hours)?
  const isRecentGame = (game: any) => {
    const time = getGameTime(game);
    if (!time) return false;
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
    return time > fortyEightHoursAgo;
  };

  const hasActiveFilters = Boolean(searchTerm || filterType !== 'all' || selectedLevel !== 'all' || onlyMyGames);

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setSelectedLevel("all");
    setOnlyMyGames(false);
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 flex flex-col gap-8">
      {/* Header Banner */}
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
              Discover, play, and share educational games created by teachers from around the world.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Users Stat */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                 <Users size={24} className="text-white" />
               </div>
               <div>
                 <div className="text-3xl font-black">{pageVisits.toLocaleString()}</div>
                 <div className="text-indigo-100 text-sm font-semibold uppercase tracking-wider">Users</div>
               </div>
            </div>

            {/* Public Games Stat */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
               <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                 <Gamepad2 size={24} className="text-white" />
               </div>
               <div>
                 <div className="text-3xl font-black">{games.length}</div>
                 <div className="text-indigo-100 text-sm font-semibold uppercase tracking-wider">Public Games</div>
               </div>
            </div>

            <button
              onClick={handleManualRefresh}
              title="Refresh Community Hub"
              disabled={isRefreshing}
              className="w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Sort Control Center */}
      <div className="flex flex-col gap-4 bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
        {/* Row 1: Search & Dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="relative md:col-span-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search topics, game titles, class levels, or creators..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 focus:border-brand-purple transition-all font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="relative md:col-span-3">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 appearance-none font-semibold text-slate-700 dark:text-slate-200 cursor-pointer text-sm"
            >
              <option value="all">All Game Types</option>
              {availableTypes.map(type => {
                const info = getTemplateInfo(type);
                return <option key={type} value={type}>{info.title}</option>;
              })}
            </select>
          </div>

          <div className="relative md:col-span-3">
            <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={17} />
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="w-full pl-10 pr-8 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-purple/50 appearance-none font-semibold text-slate-700 dark:text-slate-200 cursor-pointer text-sm"
            >
              <option value="all">All Grades & Courses</option>
              <optgroup label="Cambridge Courses">
                {CAMBRIDGE_COURSES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="School Grades">
                {ALL_GRADES.map(g => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Row 2: Sort Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-xs uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <ArrowUpDown size={13} /> Sort:
            </span>
            
            {/* Latest Published */}
            <button
              onClick={() => setSortBy('latest')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs md:text-sm shadow-sm ${
                sortBy === 'latest'
                  ? 'bg-brand-purple text-white shadow-purple-500/25 ring-2 ring-brand-purple/30'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Flame size={15} className={sortBy === 'latest' ? 'text-amber-300 fill-amber-300' : 'text-slate-400'} />
              <span>Latest Published</span>
            </button>

            {/* Sort by Grade 1 to 12 */}
            <button
              onClick={() => setSortBy('grade-asc')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs md:text-sm shadow-sm ${
                sortBy === 'grade-asc'
                  ? 'bg-amber-600 text-white shadow-amber-500/25 ring-2 ring-amber-500/30'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <GraduationCap size={15} className={sortBy === 'grade-asc' ? 'text-amber-200' : 'text-slate-400'} />
              <span>Grade 1 → 12</span>
            </button>

            {/* Sort by Cambridge Course */}
            <button
              onClick={() => setSortBy('cambridge-asc')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs md:text-sm shadow-sm ${
                sortBy === 'cambridge-asc'
                  ? 'bg-indigo-600 text-white shadow-indigo-500/25 ring-2 ring-indigo-500/30'
                  : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <Award size={15} className={sortBy === 'cambridge-asc' ? 'text-indigo-200' : 'text-slate-400'} />
              <span>Cambridge (Starters → IELTS)</span>
            </button>

            {/* Additional sorting options dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="pl-2.5 pr-6 py-1.5 bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl font-semibold text-xs text-slate-700 dark:text-slate-200 cursor-pointer appearance-none outline-none border border-slate-200/50 dark:border-slate-600"
              >
                <option value="latest">Sort: Latest Published</option>
                <option value="grade-asc">Sort: Grade (1 to 12)</option>
                <option value="cambridge-asc">Sort: Cambridge (Starters to IELTS)</option>
                <option value="questions-desc">Sort: Most Questions</option>
                <option value="title-asc">Sort: Title (A - Z)</option>
                <option value="oldest">Sort: Oldest Published</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer"
              >
                <X size={14} />
                <span>Reset Filters</span>
              </button>
            )}

            {user && (
              <button
                onClick={() => setOnlyMyGames(!onlyMyGames)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs md:text-sm ${
                  onlyMyGames
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                    : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-100'
                }`}
              >
                <UserCheck size={15} />
                <span>My Published Games ({myGamesCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Quick Filter Pills - Cambridge & School Grades without numbers */}
        <div className="flex flex-col gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          {/* Cambridge Course Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 shrink-0 flex items-center gap-1 min-w-[76px]">
              <Award size={13} /> Cambridge:
            </span>
            <button
              onClick={() => setSelectedLevel('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                selectedLevel === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {CAMBRIDGE_COURSES.map((c) => {
              const isSelected = selectedLevel === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedLevel(isSelected ? 'all' : c.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* School Grade Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0 flex items-center gap-1 min-w-[76px]">
              <GraduationCap size={13} /> Grades:
            </span>
            {ALL_GRADES.map((grade) => {
              const isSelected = selectedLevel === grade;
              return (
                <button
                  key={grade}
                  onClick={() => setSelectedLevel(isSelected ? 'all' : grade)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                  }`}
                >
                  {grade}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results Header Info */}
      <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-1 font-semibold">
        <div>
          Showing <span className="font-bold text-slate-800 dark:text-slate-100">{sortedGames.length}</span> {sortedGames.length === 1 ? 'game' : 'games'}
          {selectedLevel !== 'all' && (
            <span> in <span className="text-brand-purple font-bold">{selectedLevel}</span></span>
          )}
          {filterType !== 'all' && (
            <span> · {getTemplateInfo(filterType).title}</span>
          )}
        </div>
        <div className="text-slate-400">
          Sorted by: <span className="text-slate-700 dark:text-slate-200 font-bold capitalize">
            {sortBy === 'latest' ? 'Latest Published' :
             sortBy === 'grade-asc' ? 'Grade (1 to 12)' :
             sortBy === 'cambridge-asc' ? 'Cambridge (Starters to IELTS)' :
             sortBy === 'questions-desc' ? 'Most Questions' :
             sortBy === 'title-asc' ? 'Title (A - Z)' : 'Oldest'}
          </span>
        </div>
      </div>

      {/* Games Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-brand-purple"></div>
          <p className="mt-4 text-slate-500 font-semibold">Loading community games...</p>
        </div>
      ) : sortedGames.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-[28px] p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-2">No games found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            {onlyMyGames 
              ? "You haven't published any games to the Community yet. Go to 'My Games' and toggle 'Publish to Community' to share your work!"
              : selectedLevel !== 'all'
              ? `No games found matching ${selectedLevel}. Try switching to another grade, Cambridge course, or clear filters.`
              : "Try adjusting your search terms or filters to find what you're looking for."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-6 py-2.5 bg-brand-purple text-white font-bold rounded-xl hover:bg-purple-700 transition cursor-pointer"
            >
              Show All Community Games
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedGames.map((game) => {
            const info = getTemplateInfo(game.gameType);
            const isMultiModeCompatible = isInterchangeableGame(game);
            const isOwner = Boolean(user && game.userId === user.uid);
            const isFresh = isRecentGame(game);
            const badge = getGameDisplayBadge(game);

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
                   <GameThumbnail gameType={game.gameType} info={info} game={game} />

                   {/* Badges Overlay */}
                   <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-20">
                     {isOwner && (
                       <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-500 text-white shadow-md flex items-center gap-1">
                         <Sparkles size={11} /> Your Game
                       </span>
                     )}
                     {isFresh && !isOwner && (
                       <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md flex items-center gap-1">
                         <Flame size={11} /> New
                       </span>
                     )}
                   </div>

                   {/* Play overlay */}
                   <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-30">
                     <div className="w-16 h-16 bg-brand-purple text-white rounded-full flex items-center justify-center transform scale-50 group-hover:scale-100 transition-transform duration-300 shadow-xl">
                       <Play className="ml-1" size={28} />
                     </div>
                   </div>
                </div>

                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-bold text-base sm:text-lg text-slate-800 dark:text-slate-100 line-clamp-1" title={game.topic || game.name || game.title}>
                        {game.topic || game.name || game.title || "Untitled Game"}
                      </h3>
                      {badge && (
                        <span 
                          className={`px-2 py-0.5 rounded-md text-xs font-bold whitespace-nowrap shrink-0 border ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                      <span>{info.title}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {(game.customQuestions?.length || game.questions?.length || game.customSentences?.length || game.sentences?.length || 10)}{" "}
                        {game.gameType === 'bubble-sentence-pro' && (game.customSentences?.length || game.sentences?.length) ? 'Sentences' : 'Questions'}
                      </span>
                      {game.creatorName && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">by {game.creatorName}</span>
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

      {/* Game Mode Selection Modal */}
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
