import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Wrench,
  Camera,
  Gamepad2,
  Users,
  LayoutGrid,
  Play,
  BookOpen,
  Presentation,
  Share2,
  Volume2,
  Eye,
  EyeOff,
  ListChecks,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  Search,
  Award,
  Layers,
  ArrowLeft,
  RefreshCw,
  VolumeX,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GameCategoryId } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { CreateHomeworkModal } from './CreateHomeworkModal';

const mosquitoSlapCardImg = '/images/mosquito-slap-card.jpg?v=3';
const hamsterPaintballCardImg = '/images/hamster-paintball-card.jpg?v=3';

export type PlayableGameMode =
  | 'bubble-pop'
  | 'roller-coaster-quiz'
  | 'hamster-paintball'
  | 'slap-and-chop'
  | 'shark-attack'
  | 'yoga-quiz'
  | 'sumo'
  | 'bubble-sentence-pro'
  | 'mystery-box'
  | 'tic-tac-toe'
  | 'flashcards-match'
  | 'hamster-pop-quiz'
  | 'family-feud';

export interface GameModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameData: any;
  onSelectMode: (mode: PlayableGameMode, adaptedGameData: any) => void;
  publishedGames?: Record<string, boolean>;
  fullTabPage?: boolean;
}

interface GameOptionConfig {
  id: PlayableGameMode;
  title: string;
  shortAction: string;
  tagline: string;
  description: string;
  players: string;
  category: GameCategoryId;
  emoji: string;
  image: string;
  fallbackImage?: string;
  gradient: string;
  cardBg: string;
  cardBorder: string;
  btnBg: string;
  btnShadow: string;
  accentText: string;
}

const GAME_CATEGORY_SECTIONS: {
  id: GameCategoryId;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentText: string;
}[] = [
  {
    id: 'classroom-tools',
    title: 'Classroom Tools',
    icon: Wrench,
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'ar-camera',
    title: 'AR Camera Games',
    icon: Camera,
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'board-trivia',
    title: 'Board Trivia & Team Games',
    icon: Gamepad2,
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'multiplayer-games',
    title: 'Multiplayer Games',
    icon: Users,
    accentText: 'text-purple-600 dark:text-purple-400',
  },
];

export const PLAYABLE_GAME_OPTIONS: GameOptionConfig[] = [
  // 1. Classroom Tools
  {
    id: 'flashcards-match',
    title: 'Flashcards & Match',
    shortAction: 'Play in Flash Match',
    tagline: '3D Flip Cards & Timed Pair Grid',
    description: 'Study questions as 3D flip flashcards or race the timer to match questions with answers!',
    players: 'Solo / Class · Memory & Review',
    category: 'classroom-tools',
    emoji: '🎴',
    image: '/images/flashcards-card-v3.jpg?v=3',
    fallbackImage: '/images/flashcards-card.jpg?v=3',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-600',
    cardBg: 'bg-purple-50/70 dark:bg-purple-950/25 hover:bg-purple-100/80 dark:hover:bg-purple-900/35',
    cardBorder: 'border-purple-200 dark:border-purple-800/70',
    btnBg: 'bg-purple-600 hover:bg-purple-700',
    btnShadow: 'shadow-[0_4px_0_#581c87]',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'hamster-pop-quiz',
    title: 'Video Quiz',
    shortAction: 'Play in Video Quiz',
    tagline: 'Interactive Video Checkpoints',
    description: 'Play any video with live timestamped pop-up quiz checkpoints.',
    players: '1 Player / Class · Video Quiz',
    category: 'classroom-tools',
    emoji: '🎬',
    image: '/images/video-quiz-card-v3.jpg?v=3',
    fallbackImage: '/images/hamster-pop-quiz-card.jpg?v=3',
    gradient: 'from-amber-400 via-pink-500 to-purple-600',
    cardBg: 'bg-purple-50/70 dark:bg-purple-950/25 hover:bg-purple-100/80 dark:hover:bg-purple-900/35',
    cardBorder: 'border-purple-200 dark:border-purple-800/70',
    btnBg: 'bg-amber-500 hover:bg-amber-600',
    btnShadow: 'shadow-[0_4px_0_#b45309]',
    accentText: 'text-amber-600 dark:text-amber-400',
  },

  // 2. AR Camera Games
  {
    id: 'slap-and-chop',
    title: 'Mosquito Slap',
    shortAction: 'Play in Mosquito Slap',
    tagline: '3D Two-Glove Mosquito Slap AR',
    description: 'Track both hands on camera and clap your 3D gloves together over buzzing mosquitoes to slap the right answer!',
    players: '1–2 Players · Camera / Mouse',
    category: 'ar-camera',
    emoji: '🦟',
    image: mosquitoSlapCardImg,
    gradient: 'from-purple-600 via-indigo-600 to-sky-500',
    cardBg: 'bg-purple-50/70 dark:bg-purple-950/25 hover:bg-purple-100/80 dark:hover:bg-purple-900/35',
    cardBorder: 'border-purple-200 dark:border-purple-800/70',
    btnBg: 'bg-purple-600 hover:bg-purple-700',
    btnShadow: 'shadow-[0_4px_0_#581c87]',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'bubble-pop',
    title: 'Bubble Pop',
    shortAction: 'Play in Bubble Pop',
    tagline: 'Motion Camera & Bubble Popping',
    description: 'Use your hand on camera or mouse to pop floating answer bubbles before time runs out.',
    players: '1–2 Players · Camera / Mouse',
    category: 'ar-camera',
    emoji: '🫧',
    image: '/images/bubble-pop-card.jpg?v=3',
    fallbackImage: '/images/bubble-pop-card.jpg',
    gradient: 'from-blue-500 via-sky-500 to-cyan-500',
    cardBg: 'bg-blue-50/70 dark:bg-blue-950/25 hover:bg-blue-100/80 dark:hover:bg-blue-900/35',
    cardBorder: 'border-blue-200 dark:border-blue-800/70',
    btnBg: 'bg-blue-600 hover:bg-blue-700',
    btnShadow: 'shadow-[0_4px_0_#1e3a8a]',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'roller-coaster-quiz',
    title: 'Roller Coaster Quiz',
    shortAction: 'Play in Coaster Quiz',
    tagline: '3D Theme Park 2-Track Split',
    description: 'Ride a 3D roller coaster with Captain Hammy! Lean, tap, or tilt Left/Right before each track split!',
    players: '1 Player / Class · Tilt / Touch / Keys',
    category: 'ar-camera',
    emoji: '🎢',
    image: '/images/roller-coaster-quiz-card.jpg?v=3',
    gradient: 'from-red-500 via-orange-500 to-amber-500',
    cardBg: 'bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100/80 dark:hover:bg-amber-900/35',
    cardBorder: 'border-amber-200 dark:border-amber-800/70',
    btnBg: 'bg-amber-500 hover:bg-amber-600',
    btnShadow: 'shadow-[0_4px_0_#b45309]',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'yoga-quiz',
    title: 'Yoga Quiz',
    shortAction: 'Play in Yoga',
    tagline: 'Mindful Poses & Sumo Ring Balance',
    description: 'Match answers with fun physical yoga poses while battling in the outdoor park sumo ring.',
    players: 'Whole Class · Active Movement',
    category: 'ar-camera',
    emoji: '🧘‍♀️',
    image: '/images/yoga-quiz-card.jpg?v=3',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/35',
    cardBorder: 'border-emerald-200 dark:border-emerald-800/70',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700',
    btnShadow: 'shadow-[0_4px_0_#065f46]',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },

  // 3. Board Trivia & Team Games
  {
    id: 'mystery-box',
    title: 'Mystery Box',
    shortAction: 'Play in Mystery Box',
    tagline: 'Numbered Boxes (1–30) & Surprises',
    description: 'Pick numbered boxes, answer questions, and decide whether to keep or gift the mystery reward!',
    players: '2–8 Teams · Classroom Game Show',
    category: 'board-trivia',
    emoji: '🎁',
    image: '/images/mystery-box-card.jpg?v=3',
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
    cardBg: 'bg-amber-50/70 dark:bg-amber-950/25 hover:bg-amber-100/80 dark:hover:bg-amber-900/35',
    cardBorder: 'border-amber-200 dark:border-amber-800/70',
    btnBg: 'bg-amber-500 hover:bg-amber-600',
    btnShadow: 'shadow-[0_4px_0_#b45309]',
    accentText: 'text-amber-600 dark:text-amber-400',
  },
  {
    id: 'bubble-sentence-pro',
    title: 'Bubble Island',
    shortAction: 'Play in Bubble Island',
    tagline: 'Floating Island A, B, C, D Quiz',
    description: 'Pop floating A, B, C, D island bubbles in a sunny sky & ocean arcade environment.',
    players: '1 Player / Class · Arcade Quiz',
    category: 'board-trivia',
    emoji: '🏝️',
    image: '/images/bubble-island-card.jpg?v=3',
    gradient: 'from-sky-400 via-blue-500 to-indigo-600',
    cardBg: 'bg-sky-50/70 dark:bg-sky-950/25 hover:bg-sky-100/80 dark:hover:bg-sky-900/35',
    cardBorder: 'border-sky-200 dark:border-sky-800/70',
    btnBg: 'bg-sky-500 hover:bg-sky-600',
    btnShadow: 'shadow-[0_4px_0_#0369a1]',
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'shark-attack',
    title: 'Shark Attack',
    shortAction: 'Play in Shark Attack',
    tagline: 'Staircase Showdown vs Megalodon',
    description: '2-player or vs AI battle on twin staircases! Wrong answers make you climb closer to the shark jaws!',
    players: '1–2 Players · WASD vs Arrows / AI',
    category: 'board-trivia',
    emoji: '🦈',
    image: '/images/shark-attack-card.jpg?v=3',
    gradient: 'from-cyan-500 via-blue-600 to-slate-900',
    cardBg: 'bg-cyan-50/70 dark:bg-cyan-950/25 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/35',
    cardBorder: 'border-cyan-200 dark:border-cyan-800/70',
    btnBg: 'bg-cyan-600 hover:bg-cyan-700',
    btnShadow: 'shadow-[0_4px_0_#0e7490]',
    accentText: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'family-feud',
    title: 'Family Feud',
    shortAction: 'Play in Family Feud',
    tagline: 'Survey Flip Board & Strike Buzzer',
    description: 'Flip the numbered survey board slots, guess top answers, and avoid the triple red X strike!',
    players: '2 Teams · TV Game Show',
    category: 'board-trivia',
    emoji: '🔔',
    image: '/images/family-feud-card.jpg?v=3',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    cardBg: 'bg-yellow-50/70 dark:bg-yellow-950/25 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/35',
    cardBorder: 'border-yellow-300 dark:border-yellow-800/70',
    btnBg: 'bg-orange-500 hover:bg-orange-600',
    btnShadow: 'shadow-[0_4px_0_#9a3412]',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'sumo',
    title: 'Sumo Showdown',
    shortAction: 'Play in Sumo',
    tagline: '2-Team Dohyo Ring Tug-of-War',
    description: 'Choose your sumo fighters and push your rival out of the circular ring by answering fast.',
    players: '2 Teams · Split or Single Q',
    category: 'board-trivia',
    emoji: '🤼',
    image: '/images/sumo-tags-card.jpg?v=3',
    fallbackImage: '/images/sumo-tags-card.jpg',
    gradient: 'from-rose-500 via-red-500 to-amber-500',
    cardBg: 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/80 dark:hover:bg-rose-900/35',
    cardBorder: 'border-rose-200 dark:border-rose-800/70',
    btnBg: 'bg-rose-600 hover:bg-rose-700',
    btnShadow: 'shadow-[0_4px_0_#881337]',
    accentText: 'text-rose-600 dark:text-rose-400',
  },

  // 4. Multiplayer Games
  {
    id: 'hamster-paintball',
    title: 'Hamster Paintball',
    shortAction: 'Play in Paintball',
    tagline: '3D Multiplayer Lobby (QR & Room Code)',
    description: 'Generates a live Room Code & QR on www.hamsterenglish.online! Students join the lobby and battle in 3D speedball.',
    players: 'Multiplayer · QR & Code Lobby',
    category: 'multiplayer-games',
    emoji: '🐹🎯',
    image: hamsterPaintballCardImg,
    fallbackImage: '/images/hamster-paintball-card.jpg',
    gradient: 'from-lime-500 via-emerald-600 to-slate-900',
    cardBg: 'bg-lime-50/70 dark:bg-lime-950/25 hover:bg-lime-100/80 dark:hover:bg-lime-900/35',
    cardBorder: 'border-lime-300 dark:border-lime-700/70',
    btnBg: 'bg-lime-600 hover:bg-lime-700',
    btnShadow: 'shadow-[0_4px_0_#3f6212]',
    accentText: 'text-lime-600 dark:text-lime-400',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe Battle',
    shortAction: 'Play in Tic-Tac-Toe',
    tagline: '3×3 Tactical Grid & Steal Phase',
    description: 'Team X vs Team O! Answer questions to claim grid squares, block opponents, or steal turns.',
    players: '2 Teams · Local or Live Room',
    category: 'multiplayer-games',
    emoji: '⚔️',
    image: '/images/tic-tac-toe-card.jpg?v=3',
    gradient: 'from-indigo-500 via-purple-600 to-pink-500',
    cardBg: 'bg-indigo-50/70 dark:bg-indigo-950/25 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/35',
    cardBorder: 'border-indigo-200 dark:border-indigo-800/70',
    btnBg: 'bg-indigo-600 hover:bg-indigo-700',
    btnShadow: 'shadow-[0_4px_0_#3730a3]',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
];

export function detectOriginalGameMode(gameData: any): PlayableGameMode {
  if (!gameData) return 'mystery-box';

  const candidates = [gameData.gameType, gameData.originalGameType].filter(Boolean);
  for (const rawCandidate of candidates) {
    const normalized = String(rawCandidate).toLowerCase().trim().replace(/[-_ ]+/g, '');
    if (normalized === 'bubblepop') return 'bubble-pop';
    if (normalized === 'rollercoasterquiz' || normalized === 'coasterquiz') return 'roller-coaster-quiz';
    if (normalized === 'hamsterpaintball' || normalized === 'paintball') return 'hamster-paintball';
    if (normalized === 'slapandchop' || normalized === 'slapchop' || normalized === 'mosquitoslap') return 'slap-and-chop';
    if (normalized === 'sharkattack' || normalized === 'sharkstairs') return 'shark-attack';
    if (normalized === 'sumo' || normalized === 'sumotags' || normalized === 'sumoshowdown') return 'sumo';
    if (normalized === 'yoga' || normalized === 'yogaquiz') return 'yoga-quiz';
    if (normalized === 'mysterybox') return 'mystery-box';
    if (normalized === 'bubbleisland' || normalized === 'bubblesentencepro') return 'bubble-sentence-pro';
    if (normalized === 'tictactoe' || normalized === 'tictactoebattle') return 'tic-tac-toe';
    if (normalized === 'flashcardsmatch' || normalized === 'flashmatch' || normalized === 'flashcards') return 'flashcards-match';
    if (normalized === 'familyfeud') return 'family-feud';
    if (normalized === 'hamsterpopquiz' || normalized === 'hamsterpop' || normalized === 'videoquiz') return 'hamster-pop-quiz';
  }

  if (gameData.videoUrl) return 'hamster-pop-quiz';
  if (Array.isArray(gameData.cards) && gameData.cards.length > 0 && !gameData.customQuestions?.length) {
    return 'flashcards-match';
  }

  const title = (gameData.name || gameData.title || gameData.topic || '').toLowerCase();
  if (title.includes('bubble pop')) return 'bubble-pop';
  if (title.includes('roller coaster') || title.includes('coaster')) return 'roller-coaster-quiz';
  if (title.includes('paintball') || title.includes('speedball')) return 'hamster-paintball';
  if (title.includes('slap') || title.includes('chop') || title.includes('mosquito')) return 'slap-and-chop';
  if (title.includes('shark')) return 'shark-attack';
  if (title.includes('sumo')) return 'sumo';
  if (title.includes('yoga')) return 'yoga-quiz';
  if (title.includes('bubble island')) return 'bubble-sentence-pro';
  if (title.includes('tic tac toe') || title.includes('tic-tac-toe')) return 'tic-tac-toe';
  if (title.includes('flashcard')) return 'flashcards-match';
  if (title.includes('family feud')) return 'family-feud';
  if (title.includes('video quiz') || title.includes('hamster pop')) return 'hamster-pop-quiz';

  return 'mystery-box';
}

export function isGameModePublished(
  modeId: PlayableGameMode,
  publishedMap: Record<string, boolean>
): boolean {
  if (modeId === 'hamster-paintball') return true;
  if (!publishedMap || Object.keys(publishedMap).length === 0) return true;
  if (publishedMap[modeId] === false) return false;
  if (modeId === 'sumo' && (publishedMap['sumo-tags'] === false || publishedMap['sumo-showdown'] === false)) {
    return false;
  }
  if (modeId === 'bubble-sentence-pro' && (publishedMap['bubble-island'] === false || publishedMap['bubblesentencepro'] === false)) {
    return false;
  }
  if (modeId === 'tic-tac-toe' && (publishedMap['tic-tac-toe-battle'] === false || publishedMap['tictactoe'] === false)) {
    return false;
  }
  if (modeId === 'yoga-quiz' && (publishedMap['yoga'] === false || publishedMap['yogaquiz'] === false)) {
    return false;
  }
  if (modeId === 'slap-and-chop' && (publishedMap['slap-chop'] === false || publishedMap['slapandchop'] === false)) {
    return false;
  }
  if (modeId === 'roller-coaster-quiz' && (publishedMap['coasterquiz'] === false || publishedMap['rollercoasterquiz'] === false)) {
    return false;
  }
  if (modeId === 'flashcards-match' && (publishedMap['flashmatch'] === false || publishedMap['flashcardsmatch'] === false)) {
    return false;
  }
  if (modeId === 'hamster-pop-quiz' && (publishedMap['hamsterpop'] === false || publishedMap['hamsterpopquiz'] === false)) {
    return false;
  }

  return true;
}

/**
 * Splits items into balanced full-width rows so every single row stretches
 * edge-to-edge across 100% of the screen width with ZERO empty blank slots.
 */
function splitIntoBalancedRows<T>(items: T[], maxCols: number = 5): T[][] {
  const n = items.length;
  if (n === 0) return [];
  if (n <= maxCols) {
    if (n === 4) {
      return [items.slice(0, 2), items.slice(2, 4)];
    }
    return [items];
  }

  const numRows = Math.ceil(n / maxCols);
  const basePerRow = Math.floor(n / numRows);
  const extra = n % numRows;

  const rows: T[][] = [];
  let cursor = 0;
  for (let r = 0; r < numRows; r++) {
    const count = basePerRow + (r < extra ? 1 : 0);
    rows.push(items.slice(cursor, cursor + count));
    cursor += count;
  }
  return rows;
}

function getDeterministicGameCode(rawId: any, title: string): string {
  const str = `${String(rawId || '')}_${title}`;
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash) % 900000 + 100000;
  return String(num);
}

function splitEmbeddedMediaValue(rawVal: any): { text: string; media: string } {
  if (!rawVal || typeof rawVal !== 'string') return { text: '', media: '' };
  const trimmed = rawVal.trim();
  if (trimmed.includes('|||')) {
    const parts = trimmed.split('|||').map((p) => p.trim()).filter(Boolean);
    let textPart = '';
    let mediaPart = '';
    for (const p of parts) {
      if (
        p.startsWith('http://') ||
        p.startsWith('https://') ||
        p.startsWith('data:image') ||
        p.startsWith('/assets/') ||
        p.startsWith('/images/')
      ) {
        mediaPart = p;
      } else if (!textPart) {
        textPart = p;
      }
    }
    return { text: textPart, media: mediaPart };
  }
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/images/')
  ) {
    return { text: '', media: trimmed };
  }
  return { text: trimmed, media: '' };
}

export function GameModeModal({
  isOpen,
  onClose,
  gameData,
  onSelectMode,
  publishedGames: propPublishedGames,
  fullTabPage = false,
}: GameModeSelectionModalProps) {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<'all' | GameCategoryId>('all');
  const [activeHubView, setActiveHubView] = useState<'modes' | 'questions'>('modes');
  const [questionDisplayFormat, setQuestionDisplayFormat] = useState<'prompt-only' | 'multiple-choice'>('prompt-only');
  const [showAllAnswers, setShowAllAnswers] = useState<boolean>(false);
  const [revealedCardIds, setRevealedCardIds] = useState<Record<string, boolean>>({});
  const [speakingCardId, setSpeakingCardId] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState<string>('');
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [slideshowAnswerRevealed, setSlideshowAnswerRevealed] = useState<boolean>(false);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState<boolean>(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Interactive Study Mode state (matching game setup Study screen)
  const [isStudyModeOpen, setIsStudyModeOpen] = useState<boolean>(false);
  const [studyIndex, setStudyIndex] = useState<number>(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [studyHistory, setStudyHistory] = useState<Record<number, { selected: number; isCorrect: boolean }>>({});
  const [isStudyMuted, setIsStudyMuted] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory('all');
      setActiveHubView('modes');
      setShowAllAnswers(false);
      setRevealedCardIds({});
      setSlideshowIndex(null);
      setQuestionSearch('');
      setIsStudyModeOpen(false);
      setStudyIndex(0);
      setStudySelectedOption(null);
      setStudyHistory({});
    }
  }, [isOpen, gameData]);

  const [livePublishedGames, setLivePublishedGames] = useState<Record<string, boolean>>(() => {
    if (propPublishedGames && Object.keys(propPublishedGames).length > 0) {
      return propPublishedGames;
    }
    try {
      const cached = localStorage.getItem('publishedGamesV2');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    if (propPublishedGames && Object.keys(propPublishedGames).length > 0) {
      setLivePublishedGames(propPublishedGames);
    }
  }, [propPublishedGames]);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'general'),
      (snap) => {
        if (snap.exists()) {
          const pub = snap.data().publishedGamesV2 || {};
          setLivePublishedGames(pub);
          try {
            localStorage.setItem('publishedGamesV2', JSON.stringify(pub));
          } catch (e) {}
        }
      },
      (err) => {
        console.warn('GameModeModal settings listener notice:', err?.message || err);
      }
    );

    const handleSync = (e: any) => {
      if (e.detail) {
        setLivePublishedGames(e.detail);
      } else {
        try {
          const cached = localStorage.getItem('publishedGamesV2');
          if (cached) setLivePublishedGames(JSON.parse(cached));
        } catch (err) {}
      }
    };

    window.addEventListener('publishedGamesChanged', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      unsub();
      window.removeEventListener('publishedGamesChanged', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const originalModeId = useMemo(() => detectOriginalGameMode(gameData), [gameData]);

  const publishedOptions = useMemo(() => {
    return PLAYABLE_GAME_OPTIONS.filter(
      (opt) => opt.id === originalModeId || isGameModePublished(opt.id, livePublishedGames)
    );
  }, [livePublishedGames, originalModeId]);

  const normalizedQuestions = useMemo(() => {
    if (!gameData) return [];
    const rawQuestions =
      (Array.isArray(gameData.customQuestions) && gameData.customQuestions.length > 0
        ? gameData.customQuestions
        : Array.isArray(gameData.questions) && gameData.questions.length > 0
        ? gameData.questions
        : Array.isArray(gameData.cards) && gameData.cards.length > 0
        ? gameData.cards.map((c: any, idx: number) => ({
            id: c.id || idx + 1,
            text: c.frontText || c.front || `Card ${idx + 1}`,
            options: [c.backText || c.back || 'Answer', 'Option B', 'Option C', 'Option D'],
            answerIndex: 0,
            image: c.frontMedia || c.image || '',
          }))
        : []) || [];

    const mapped = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q: any, idx: number) => {
      const rawPrompt = q.text || q.question || q.frontText || q.front || `Question ${idx + 1}`;
      const parsedPrompt = splitEmbeddedMediaValue(rawPrompt);
      const text = parsedPrompt.text || `Question ${idx + 1}`;

      let options = Array.isArray(q.options)
        ? q.options
            .map((o: any) => (typeof o === 'string' ? o : o?.text || ''))
            .filter((s: string) => s.trim() !== '')
        : Array.isArray(q.answers)
        ? q.answers
            .filter((a: any) => a && typeof a.text === 'string' && a.text.trim() !== '')
            .map((a: any) => a.text)
        : [];

      const foundCorrectObjIdx = Array.isArray(q.options)
        ? q.options.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect))
        : -1;

      let answerIndex =
        typeof q.answerIndex === 'number'
          ? q.answerIndex
          : typeof q.correctIndex === 'number'
          ? q.correctIndex
          : typeof q.correct === 'number'
          ? q.correct
          : foundCorrectObjIdx >= 0
          ? foundCorrectObjIdx
          : 0;

      if (options.length < 2) {
        options = ['Yes', 'No'];
        answerIndex = 0;
      }

      if (answerIndex < 0 || answerIndex >= options.length) {
        answerIndex = 0;
      }

      const cleanOptions = options.map((opt: string) => {
        const parsedOpt = splitEmbeddedMediaValue(opt);
        return parsedOpt.text || opt;
      });

      const feudAnswers =
        Array.isArray(q.answers) && q.answers.some((a: any) => a?.text)
          ? q.answers
          : [
              { text: cleanOptions[answerIndex], points: 50, aliases: [cleanOptions[answerIndex].toLowerCase()] },
              ...cleanOptions
                .filter((_: string, i: number) => i !== answerIndex)
                .map((optText: string, i: number) => ({
                  text: optText,
                  points: Math.max(10, 30 - i * 10),
                  aliases: [optText.toLowerCase()],
                })),
            ];

      const image =
        q.image ||
        q.imageUrl ||
        q.mediaUrl ||
        q.gifUrl ||
        parsedPrompt.media ||
        (Array.isArray(q.optionImages) ? q.optionImages[answerIndex] || q.optionImages[0] || '' : '');

      return {
        id: q.id || idx + 1,
        text,
        question: text,
        options: cleanOptions,
        answerIndex,
        correct: answerIndex,
        correctAnswerText: cleanOptions[answerIndex] || cleanOptions[0] || '',
        points: Number(q.points || q.xp || 15),
        answers: feudAnswers,
        image,
        imageUrl: image,
        ...(typeof q.timeTrigger === 'number' ? { timeTrigger: q.timeTrigger } : {}),
        ...(q.type ? { type: q.type } : {}),
        ...(q.xp ? { xp: q.xp } : {}),
        ...(q.explanation ? { explanation: q.explanation } : {}),
        ...(q.word ? { word: q.word } : {}),
        ...(q.pronunciation ? { pronunciation: q.pronunciation } : {}),
        ...(Array.isArray(q.optionImages) ? { optionImages: q.optionImages } : {}),
      };
    });

    if (mapped.length > 0) return mapped;

    return [
      {
        id: 1,
        text: 'Which sentence is grammatically correct?',
        question: 'Which sentence is grammatically correct?',
        options: [
          "She doesn't like apples.",
          "She don't like apples.",
          'She not like apples.',
          "She isn't like apples.",
        ],
        answerIndex: 0,
        correct: 0,
        correctAnswerText: "She doesn't like apples.",
        points: 15,
        image: '',
        imageUrl: '',
        answers: [
          { text: "She doesn't like apples.", points: 50 },
          { text: "She don't like apples.", points: 25 },
          { text: 'She not like apples.', points: 15 },
          { text: "She isn't like apples.", points: 10 },
        ],
      },
      {
        id: 2,
        text: "What is the past tense of 'eat'?",
        question: "What is the past tense of 'eat'?",
        options: ['Ate', 'Eated', 'Eating', 'Eats'],
        answerIndex: 0,
        correct: 0,
        correctAnswerText: 'Ate',
        points: 15,
        image: '',
        imageUrl: '',
        answers: [
          { text: 'Ate', points: 50 },
          { text: 'Eated', points: 25 },
          { text: 'Eating', points: 15 },
          { text: 'Eats', points: 10 },
        ],
      },
      {
        id: 3,
        text: 'Which of these is a fruit?',
        question: 'Which of these is a fruit?',
        options: ['Apple', 'Carrot', 'Potato', 'Broccoli'],
        answerIndex: 0,
        correct: 0,
        correctAnswerText: 'Apple',
        points: 15,
        image: '',
        imageUrl: '',
        answers: [
          { text: 'Apple', points: 50 },
          { text: 'Carrot', points: 25 },
          { text: 'Potato', points: 15 },
          { text: 'Broccoli', points: 10 },
        ],
      },
      {
        id: 4,
        text: 'They ____ to school by bus every day.',
        question: 'They ____ to school by bus every day.',
        options: ['go', 'goes', 'gone', 'going'],
        answerIndex: 0,
        correct: 0,
        correctAnswerText: 'go',
        points: 15,
        image: '',
        imageUrl: '',
        answers: [
          { text: 'go', points: 50 },
          { text: 'goes', points: 25 },
          { text: 'gone', points: 15 },
          { text: 'going', points: 10 },
        ],
      },
    ];
  }, [gameData]);

  // Keyboard navigation for full-screen Slideshow Presenter
  useEffect(() => {
    if (slideshowIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSlideshowIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSlideshowAnswerRevealed(false);
        setSlideshowIndex((prev) =>
          prev === null ? null : (prev + 1) % Math.max(1, normalizedQuestions.length)
        );
      } else if (e.key === 'ArrowLeft') {
        setSlideshowAnswerRevealed(false);
        setSlideshowIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + Math.max(1, normalizedQuestions.length)) %
              Math.max(1, normalizedQuestions.length)
        );
      } else if (e.key === ' ') {
        e.preventDefault();
        setSlideshowAnswerRevealed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [slideshowIndex, normalizedQuestions.length]);

  if (!isOpen || !gameData) return null;

  const hasCustomTitle = Boolean(gameData.topic || gameData.name || gameData.title);
  const gameTitle = gameData.topic || gameData.name || gameData.title || 'Custom Quiz';
  const classLevel = gameData.className || gameData.classLevel || 'General';
  const gameCode = getDeterministicGameCode(gameData.id, gameTitle);

  const originalGameOption =
    publishedOptions.find((opt) => opt.id === originalModeId) ||
    PLAYABLE_GAME_OPTIONS.find((opt) => opt.id === originalModeId) ||
    publishedOptions[0];

  const orderedCategorySections = [...GAME_CATEGORY_SECTIONS].sort((a, b) => {
    if (a.id === originalGameOption?.category) return -1;
    if (b.id === originalGameOption?.category) return 1;
    return 0;
  });

  // Build unified list of game options with the Built-For game placed #1 first
  const orderedGameOptions = (() => {
    const categoryOrder = new Map<GameCategoryId, number>();
    orderedCategorySections.forEach((sec, idx) => categoryOrder.set(sec.id, idx));

    const filtered =
      selectedCategory === 'all'
        ? publishedOptions
        : publishedOptions.filter((g) => g.category === selectedCategory);

    return [...filtered].sort((a, b) => {
      if (a.id === originalModeId) return -1;
      if (b.id === originalModeId) return 1;
      const catA = categoryOrder.get(a.category) ?? 99;
      const catB = categoryOrder.get(b.category) ?? 99;
      return catA - catB;
    });
  })();

  const balancedGameRows = splitIntoBalancedRows(
    orderedGameOptions,
    orderedGameOptions.length >= 9 ? 5 : orderedGameOptions.length >= 6 ? 4 : 3
  );

  const countByCategory = (catId: GameCategoryId) =>
    publishedOptions.filter((g) => g.category === catId).length;

  const getCategoryTitle = (catId: GameCategoryId) => {
    const found = GAME_CATEGORY_SECTIONS.find((c) => c.id === catId);
    return found ? t(`home.cat.${catId}`, found.title) : '';
  };

  const speakQuestionAloud = (q: any, includeAnswer: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cardKey = String(q.id);
      if (speakingCardId === cardKey) {
        setSpeakingCardId(null);
        return;
      }
      const speechText = includeAnswer
        ? `${q.text}. Answer: ${q.correctAnswerText}`
        : q.text;
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'en-US';
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingCardId(null);
      utterance.onerror = () => setSpeakingCardId(null);
      setSpeakingCardId(cardKey);
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeakingCardId(null);
    }
  };

  const handleShareGame = () => {
    try {
      const url = new URL(window.location.origin + window.location.pathname);
      if (gameData.id) {
        url.searchParams.set('playGame', String(gameData.id));
      }
      const shareStr = url.toString();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareStr);
      }
      setShareToast(`Copied link & Game Code (${gameCode})!`);
      setTimeout(() => setShareToast(null), 3200);
    } catch {
      setShareToast(`Game Code: ${gameCode}`);
      setTimeout(() => setShareToast(null), 3200);
    }
  };

  const handlePlayInterchangeable = (targetType: PlayableGameMode) => {
    const finalQuestions: any[] = normalizedQuestions;

    const existingCards =
      Array.isArray(gameData.cards) && gameData.cards.length > 0 ? gameData.cards : null;

    const flashcardPairs = existingCards
      ? existingCards.map((c: any, idx: number) => {
          const q: any = finalQuestions[idx];
          const parsedFront = splitEmbeddedMediaValue(c?.frontText ?? c?.front ?? c?.text ?? q?.text ?? '');
          const rawAnsOpt = q ? q.options?.[q.answerIndex] || q.options?.[0] || '' : '';
          const parsedBack = splitEmbeddedMediaValue(c?.backText ?? c?.back ?? c?.answer ?? '');
          const parsedQBack = splitEmbeddedMediaValue(rawAnsOpt);

          const frontMedia = c?.frontMedia || c?.image || parsedFront.media || q?.image || '';
          const backMedia =
            c?.backMedia ||
            parsedBack.media ||
            parsedQBack.media ||
            (q && Array.isArray(q.optionImages)
              ? q.optionImages[q.answerIndex] || q.optionImages[0] || ''
              : '');

          const frontText = parsedFront.text;
          let backText = parsedBack.text || (!backMedia ? parsedQBack.text : '');
          if (
            backMedia &&
            backText &&
            frontText &&
            backText.trim().toLowerCase() === frontText.trim().toLowerCase()
          ) {
            backText = '';
          }

          return {
            ...c,
            id: c?.id || q?.id || idx + 1,
            front: frontText || frontMedia,
            back: backText || backMedia || 'Answer',
            frontText,
            backText,
            frontMedia,
            backMedia,
          };
        })
      : finalQuestions.map((q: any, idx: number) => {
          const parsedFront = splitEmbeddedMediaValue(q.text || '');
          const rawAnsOpt = q.options?.[q.answerIndex] || q.options?.[0] || '';
          const parsedBack = splitEmbeddedMediaValue(rawAnsOpt);
          const frontMedia = parsedFront.media || q.image || q.imageUrl || '';
          const backMedia =
            parsedBack.media ||
            (Array.isArray(q.optionImages)
              ? q.optionImages[q.answerIndex] || q.optionImages[0] || ''
              : '');
          const frontText = parsedFront.text || q.text || '';
          let backText = parsedBack.text;
          if (
            backMedia &&
            backText &&
            frontText &&
            backText.trim().toLowerCase() === frontText.trim().toLowerCase()
          ) {
            backText = '';
          }
          return {
            id: q.id || idx + 1,
            front: frontText,
            back: backText || backMedia || 'Answer',
            frontText,
            backText,
            frontMedia,
            backMedia,
          };
        });

    const adaptedGame = {
      ...gameData,
      id: gameData.id || Date.now(),
      topic: gameTitle,
      name: gameTitle,
      title: gameTitle,
      className: gameData.className || gameData.classLevel || '',
      classLevel: gameData.classLevel || gameData.className || '',
      originalGameType: originalModeId,
      gameType: targetType,
      mode: targetType === 'bubble-sentence-pro' ? 'multiple-choice' : gameData.mode || 'word',
      customQuestions: finalQuestions,
      questions: finalQuestions,
      customSentences: finalQuestions,
      sentences: finalQuestions,
      cards: flashcardPairs,
      editMode: false,
    };

    onSelectMode(targetType, adaptedGame);
    onClose();
  };

  const filteredQuestions = normalizedQuestions.filter((q) => {
    if (!questionSearch.trim()) return true;
    const term = questionSearch.trim().toLowerCase();
    return (
      q.text.toLowerCase().includes(term) ||
      q.options.some((opt: string) => opt.toLowerCase().includes(term))
    );
  });

  const balancedQuestionRows = splitIntoBalancedRows(
    filteredQuestions,
    filteredQuestions.length >= 8 ? 4 : filteredQuestions.length >= 3 ? 3 : Math.max(1, filteredQuestions.length)
  );

  const renderGameCard = (option: GameOptionConfig, isPrimaryBuiltFor: boolean = false) => (
    <div
      key={option.id}
      onClick={() => handlePlayInterchangeable(option.id)}
      className={`w-full aspect-[3/2] relative rounded-[28px] overflow-hidden group hover:-translate-y-1.5 hover:scale-[1.01] active:translate-y-0.5 transition-all duration-200 cursor-pointer select-none ${
        isPrimaryBuiltFor
          ? 'ring-4 ring-emerald-500 shadow-[0_18px_40px_-10px_rgba(16,185,129,0.45)]'
          : 'ring-1 ring-slate-200/80 dark:ring-slate-800 shadow-[0_14px_32px_-10px_rgba(15,23,42,0.28)] hover:shadow-[0_24px_48px_-12px_rgba(15,23,42,0.42)]'
      }`}
    >
      <img
        src={option.image}
        alt={option.title}
        referrerPolicy="no-referrer"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          if (option.fallbackImage && target.src !== option.fallbackImage) {
            target.src = option.fallbackImage;
          } else if (option.id === 'hamster-paintball') {
            target.src = '/images/hamster-paintball-card.png';
          }
        }}
        className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
      />

      {/* Bottom Subtle Info Bar on Hover */}
      <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-black text-sm sm:text-base leading-tight truncate" data-no-translate="true">
            {option.title}
          </p>
          <p className="text-white/80 text-xs font-semibold truncate">{option.players}</p>
        </div>
        <div className="w-10 h-10 bg-emerald-500 text-white rounded-full shadow-lg flex items-center justify-center shrink-0">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-8px_16px_rgba(15,23,42,0.22)]" />
    </div>
  );

  const renderQuestionPreviewCard = (q: any, index: number) => {
    const cardKey = String(q.id || index);
    const isRevealed = showAllAnswers || Boolean(revealedCardIds[cardKey]);
    const isSpeaking = speakingCardId === cardKey;

    return (
      <div
        key={cardKey}
        onClick={() =>
          setRevealedCardIds((prev) => ({
            ...prev,
            [cardKey]: !isRevealed,
          }))
        }
        className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden cursor-pointer select-none shadow-xs hover:shadow-lg ${
          isRevealed
            ? 'border-emerald-400/90 dark:border-emerald-500/70 ring-2 ring-emerald-500/20'
            : 'border-slate-200/90 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500/60'
        }`}
      >
        {/* Visual Media Stage or Rich Typography Stage (never blank) */}
        {q.image ? (
          <div className="relative w-full aspect-[16/10] bg-slate-900 overflow-hidden border-b border-slate-100 dark:border-slate-800">
            <img
              src={q.image}
              alt={q.text}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-md text-white text-xs font-black tabular-nums">
              #{String(index + 1).padStart(2, '0')}
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => speakQuestionAloud(q, isRevealed, e)}
                title="Read question aloud"
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer shadow-md ${
                  isSpeaking
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-white/90 hover:bg-white text-slate-800'
                }`}
              >
                <Volume2 size={17} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 pt-3.5 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
            <div className="flex items-center gap-2 text-xs font-black text-slate-500 dark:text-slate-400 tabular-nums">
              <span className="text-indigo-600 dark:text-indigo-400">
                #{String(index + 1).padStart(2, '0')}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Award size={13} />
                {q.points} pts
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => speakQuestionAloud(q, isRevealed, e)}
              title="Read question aloud"
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                isSpeaking
                  ? 'bg-emerald-600 text-white animate-pulse'
                  : 'bg-slate-200/70 dark:bg-slate-700/70 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Volume2 size={15} />
            </button>
          </div>
        )}

        {/* Question Prompt & Optional Multiple Choice List */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <h4
              className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug"
              data-no-translate="true"
            >
              {q.text}
            </h4>

            {questionDisplayFormat === 'multiple-choice' && Array.isArray(q.options) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {q.options.map((optText: string, optIdx: number) => {
                  const isCorrectOpt = optIdx === q.answerIndex;
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <div
                      key={optIdx}
                      className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 border transition-colors ${
                        isRevealed && isCorrectOpt
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${
                          isRevealed && isCorrectOpt
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="truncate" data-no-translate="true">
                        {optText}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Click-to-Reveal Answer Footer */}
          <div
            className={`pt-3 border-t flex items-center justify-between gap-2 text-xs font-extrabold transition-colors ${
              isRevealed
                ? 'border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            {isRevealed ? (
              <div className="flex items-center gap-2 min-w-0">
                <Check size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate" data-no-translate="true">
                  {q.correctAnswerText}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Eye size={14} className="shrink-0" />
                <span>Click card to reveal answer</span>
              </div>
            )}

            <span className="text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
              ✓ {q.points}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const activeSlideQuestion =
    slideshowIndex !== null ? normalizedQuestions[slideshowIndex] || null : null;

  return (
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
      {/* Toast Notification for Share Link & Game Code */}
      {shareToast && (
        <div className="fixed bottom-6 right-6 z-[130] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-xl font-extrabold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3">
          <Check size={16} className="text-emerald-400 dark:text-emerald-600" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Assign Homework Modal */}
      {isHomeworkModalOpen && (
        <CreateHomeworkModal
          isOpen={isHomeworkModalOpen}
          game={gameData}
          onClose={() => setIsHomeworkModalOpen(false)}
        />
      )}

      {/* Full-Screen Interactive Smartboard Slideshow Presenter */}
      {slideshowIndex !== null && activeSlideQuestion && (
        <div className="fixed inset-0 z-[120] bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3.5 py-1.5 rounded-xl bg-white/10 font-black text-sm tabular-nums">
                Slide {slideshowIndex + 1} / {normalizedQuestions.length}
              </span>
              <span className="text-slate-400 font-bold text-sm truncate" data-no-translate="true">
                {gameTitle}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => speakQuestionAloud(activeSlideQuestion, slideshowAnswerRevealed)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <Volume2 size={18} />
                <span>Read Aloud</span>
              </button>
              <button
                type="button"
                onClick={() => setSlideshowIndex(null)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-extrabold text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <X size={18} />
                <span>Exit Slideshow</span>
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full gap-6 my-4 overflow-y-auto">
            {activeSlideQuestion.image && (
              <img
                src={activeSlideQuestion.image}
                alt={activeSlideQuestion.text}
                referrerPolicy="no-referrer"
                className="max-h-[42vh] w-auto rounded-3xl object-contain shadow-2xl border border-white/15"
              />
            )}
            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-center leading-tight"
              data-no-translate="true"
            >
              {activeSlideQuestion.text}
            </h2>

            {questionDisplayFormat === 'multiple-choice' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl">
                {activeSlideQuestion.options.map((optText: string, idx: number) => {
                  const isCorrect = idx === activeSlideQuestion.answerIndex;
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border-2 text-lg font-extrabold flex items-center gap-3 ${
                        slideshowAnswerRevealed && isCorrect
                          ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                          : 'bg-white/5 border-white/15 text-white'
                      }`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-black">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span data-no-translate="true">{optText}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {slideshowAnswerRevealed && (
              <div className="px-6 py-4 rounded-2xl bg-emerald-600 text-white font-black text-xl sm:text-2xl shadow-xl flex items-center gap-3 animate-in fade-in zoom-in-95">
                <Check size={26} />
                <span data-no-translate="true">{activeSlideQuestion.correctAnswerText}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => {
                setSlideshowAnswerRevealed(false);
                setSlideshowIndex(
                  (slideshowIndex - 1 + normalizedQuestions.length) % normalizedQuestions.length
                );
              }}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <ChevronLeft size={18} />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setSlideshowAnswerRevealed((prev) => !prev)}
              className="px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-black text-base shadow-lg cursor-pointer"
            >
              {slideshowAnswerRevealed ? 'Hide Answer' : 'Reveal Answer (Space)'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSlideshowAnswerRevealed(false);
                setSlideshowIndex((slideshowIndex + 1) % normalizedQuestions.length);
              }}
              className="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 font-extrabold text-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Full-Screen Interactive Study Mode (Identical to Game Setup Study Screen) */}
      {isStudyModeOpen && (
        <div className="fixed inset-0 z-[125] flex flex-col bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950 text-white select-none overflow-hidden">
          {(() => {
            const studyTotalAnswered = Object.keys(studyHistory).length;
            const studyCorrectCount = Object.values(studyHistory).filter((h) => h.isCorrect).length;
            const studyAccuracy =
              studyTotalAnswered > 0 ? Math.round((studyCorrectCount / studyTotalAnswered) * 100) : 0;
            const currentStudyQ = normalizedQuestions[studyIndex];

            const handleStudyOptionClick = (optIdx: number) => {
              if (studySelectedOption !== null || !currentStudyQ) return;
              setStudySelectedOption(optIdx);
              const isCorrect = optIdx === currentStudyQ.answerIndex;
              setStudyHistory((prev) => ({
                ...prev,
                [studyIndex]: { selected: optIdx, isCorrect },
              }));
            };

            const handleStudyRetry = () => {
              setStudySelectedOption(null);
              setStudyHistory((prev) => {
                const next = { ...prev };
                delete next[studyIndex];
                return next;
              });
            };

            const handleStudyNext = () => {
              if (studyIndex < normalizedQuestions.length - 1) {
                const nextIdx = studyIndex + 1;
                setStudyIndex(nextIdx);
                setStudySelectedOption(studyHistory[nextIdx]?.selected ?? null);
              } else {
                setIsStudyModeOpen(false);
              }
            };

            const handleStudyPrev = () => {
              if (studyIndex > 0) {
                const prevIdx = studyIndex - 1;
                setStudyIndex(prevIdx);
                setStudySelectedOption(studyHistory[prevIdx]?.selected ?? null);
              }
            };

            return (
              <>
                <div className="w-full h-2 bg-white/10 relative z-20">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${((studyIndex + 1) / Math.max(1, normalizedQuestions.length)) * 100}%`,
                    }}
                  />
                </div>

                <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/10 flex justify-between items-center z-20 relative shrink-0">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsStudyModeOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl font-bold text-white transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-5 h-5" /> Back
                    </button>
                    <span className="text-amber-300 font-extrabold text-sm hidden sm:inline">
                      📖 Study Mode
                    </span>
                  </div>

                  <div className="font-black text-lg text-white">
                    Question <span className="text-amber-300 font-black text-xl">{studyIndex + 1}</span> /{' '}
                    {normalizedQuestions.length}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      Score:{' '}
                      <span className="font-black text-white">
                        {studyCorrectCount}/{studyTotalAnswered}
                      </span>{' '}
                      ({studyAccuracy}%)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMuted = !isStudyMuted;
                        setIsStudyMuted(nextMuted);
                        if (!nextMuted && currentStudyQ) {
                          speakQuestionAloud(currentStudyQ, studySelectedOption !== null);
                        } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                        }
                      }}
                      className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
                      title="Toggle Audio"
                    >
                      {isStudyMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                  </div>
                </header>

                <main className="flex-1 flex flex-col justify-center items-center p-6 md:p-10 max-w-5xl mx-auto w-full z-10 overflow-y-auto custom-scrollbar">
                  {currentStudyQ ? (
                    <div className="w-full flex flex-col items-center my-auto">
                      <span className="text-amber-400 font-black text-sm uppercase tracking-widest mb-3">
                        Question {studyIndex + 1}
                      </span>

                      <div className="w-full flex flex-col items-center mb-8 max-w-4xl">
                        {currentStudyQ.image && (
                          <div className="mb-4 max-h-56 sm:max-h-72 w-full flex items-center justify-center">
                            <img
                              src={currentStudyQ.image}
                              alt={currentStudyQ.text || `Question ${studyIndex + 1}`}
                              referrerPolicy="no-referrer"
                              className="max-h-52 sm:max-h-64 max-w-full rounded-2xl object-contain shadow-lg bg-white/10 p-2 border border-white/20"
                            />
                          </div>
                        )}
                        {currentStudyQ.text && (
                          <h2
                            className="text-2xl sm:text-4xl lg:text-5xl font-black text-white text-center leading-tight break-words"
                            data-no-translate="true"
                          >
                            {currentStudyQ.text}
                          </h2>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-8">
                        {currentStudyQ.options.map((opt: string, i: number) => {
                          if (!opt || opt.trim() === '') return null;
                          const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i] || i + 1;
                          const isSelected = studySelectedOption === i;
                          const isCorrectAnswer = i === currentStudyQ.answerIndex;
                          const hasAnswered = studySelectedOption !== null;

                          let btnStyle =
                            'bg-white/10 hover:bg-white/20 border-white/20 text-white hover:border-amber-400';

                          if (hasAnswered) {
                            if (isCorrectAnswer) {
                              btnStyle =
                                'bg-emerald-500 border-emerald-300 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-[1.02] z-10';
                            } else if (isSelected && !isCorrectAnswer) {
                              btnStyle = 'bg-rose-500 border-rose-300 text-white';
                            } else {
                              btnStyle = 'bg-white/5 border-white/10 text-white/40 opacity-40';
                            }
                          }

                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleStudyOptionClick(i)}
                              disabled={hasAnswered}
                              className={`p-5 sm:p-6 rounded-2xl text-lg sm:text-2xl font-bold border-2 transition-all duration-300 flex items-center justify-between text-left gap-4 cursor-pointer ${btnStyle}`}
                            >
                              <div className="flex items-center gap-3.5 flex-1">
                                <span
                                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                                    hasAnswered && isCorrectAnswer
                                      ? 'bg-white text-emerald-600'
                                      : hasAnswered && isSelected && !isCorrectAnswer
                                      ? 'bg-white text-rose-600'
                                      : 'bg-white/15 text-white'
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="flex-1 break-words" data-no-translate="true">
                                  {opt}
                                </span>
                              </div>
                              {hasAnswered && isCorrectAnswer && (
                                <span className="flex items-center gap-1 bg-white text-emerald-600 px-3 py-1 rounded-xl font-black text-xs shrink-0">
                                  <Check size={16} strokeWidth={3} /> CORRECT
                                </span>
                              )}
                              {hasAnswered && isSelected && !isCorrectAnswer && (
                                <span className="flex items-center gap-1 bg-white text-rose-600 px-3 py-1 rounded-xl font-black text-xs shrink-0">
                                  <X size={16} strokeWidth={3} /> WRONG
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {studySelectedOption !== null && (
                        <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
                          <div>
                            {studySelectedOption === currentStudyQ.answerIndex ? (
                              <div className="text-emerald-300 font-black text-lg">
                                🎉 Spot On! Correct Answer!
                              </div>
                            ) : (
                              <div className="text-rose-200 font-bold text-base">
                                Correct Answer:{' '}
                                <span
                                  className="font-black text-emerald-300 underline"
                                  data-no-translate="true"
                                >
                                  {currentStudyQ.options[currentStudyQ.answerIndex]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {studySelectedOption !== currentStudyQ.answerIndex && (
                              <button
                                type="button"
                                onClick={handleStudyRetry}
                                className="px-5 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center gap-2"
                              >
                                <RefreshCw size={16} /> Retry
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={handleStudyNext}
                              className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-base shadow-lg transition-all cursor-pointer"
                            >
                              {studyIndex < normalizedQuestions.length - 1
                                ? 'Next Question →'
                                : 'Finish Study 🏆'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-slate-400 font-bold text-2xl">
                      No questions found in this quiz!
                    </div>
                  )}
                </main>

                <footer className="px-6 py-3.5 bg-white/5 backdrop-blur-md border-t border-white/10 flex justify-between items-center z-20 relative shrink-0">
                  <button
                    type="button"
                    onClick={handleStudyPrev}
                    disabled={studyIndex === 0}
                    className="px-5 py-2.5 bg-white/15 hover:bg-white/25 disabled:opacity-20 rounded-xl font-bold text-white transition-all cursor-pointer"
                  >
                    ← Previous
                  </button>

                  <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60vw] py-1 px-2 custom-scrollbar">
                    {normalizedQuestions.map((_, dotIdx) => {
                      const historyItem = studyHistory[dotIdx];
                      let dotClass = 'bg-white/15 text-white/60';
                      if (dotIdx === studyIndex) {
                        dotClass = 'bg-amber-400 text-slate-900 scale-110 font-black';
                      } else if (historyItem) {
                        dotClass = historyItem.isCorrect
                          ? 'bg-emerald-500 text-white'
                          : 'bg-rose-500 text-white';
                      }
                      return (
                        <button
                          key={dotIdx}
                          type="button"
                          onClick={() => {
                            setStudyIndex(dotIdx);
                            setStudySelectedOption(studyHistory[dotIdx]?.selected ?? null);
                          }}
                          className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0 ${dotClass}`}
                        >
                          {dotIdx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleStudyNext}
                    className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black transition-all cursor-pointer"
                  >
                    {studyIndex < normalizedQuestions.length - 1 ? 'Next →' : 'Finish 🏆'}
                  </button>
                </footer>
              </>
            );
          })()}
        </div>
      )}

      {/* Simplified Top Action Bar: Big Question Preview & Study Buttons Only */}
      <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-5 sm:px-8 lg:px-12 py-4 shrink-0 flex flex-col gap-3 shadow-2xs">
        <div className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-end gap-3.5">
          {activeHubView === 'questions' && (
            <button
              type="button"
              onClick={() => setActiveHubView('modes')}
              className="mr-auto px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base sm:text-lg flex items-center gap-2.5 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft size={20} />
              <span>Back to Games</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              setActiveHubView((prev) => (prev === 'questions' ? 'modes' : 'questions'))
            }
            className={`px-6 sm:px-8 py-3.5 rounded-2xl font-black text-base sm:text-lg flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-md ${
              activeHubView === 'questions'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Layers size={20} />
            <span>Question Preview ({normalizedQuestions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStudyIndex(0);
              setStudySelectedOption(null);
              setStudyHistory({});
              setIsStudyModeOpen(true);
            }}
            className="px-6 sm:px-8 py-3.5 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:brightness-105 text-slate-950 font-black text-base sm:text-lg flex items-center gap-2.5 border-2 border-amber-200 shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <BookOpen size={20} />
            <span>Study</span>
          </button>

          {!fullTabPage && (
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Question Interactive Controls (Only shown when inside Question Preview) */}
        {activeHubView === 'questions' && (
          <div className="max-w-7xl w-full mx-auto flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Segmented Switcher: Question Only vs Multiple Choice */}
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setQuestionDisplayFormat('prompt-only')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    questionDisplayFormat === 'prompt-only'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <HelpCircle size={15} />
                  <span>Question Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionDisplayFormat('multiple-choice')}
                  className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    questionDisplayFormat === 'multiple-choice'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  <ListChecks size={15} />
                  <span>Multiple Choice</span>
                </button>
              </div>

              {/* Global Show / Hide All Answers Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !showAllAnswers;
                  setShowAllAnswers(next);
                  if (!next) setRevealedCardIds({});
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                  showAllAnswers
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                }`}
              >
                {showAllAnswers ? <EyeOff size={15} /> : <Eye size={15} />}
                <span>{showAllAnswers ? 'Hide All Answers' : 'Show All Answers'}</span>
              </button>
            </div>

            {/* Quick Question Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-bold text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Full-Screen Stage: Occupies 100% of Remaining Viewport Width & Height with Zero Blank Holes */}
      {activeHubView === 'modes' ? (
        <div className="flex-1 w-full h-full px-5 sm:px-8 lg:px-12 py-6 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto flex flex-col gap-8">
            {/* 1. Built For This Game Highlight Section */}
            {selectedCategory === 'all' && originalGameOption && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2.5">
                  <Gamepad2 size={22} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {t('modal.builtForGame')} ·{' '}
                    <span data-no-translate="true">{originalGameOption.title}</span>
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {renderGameCard(originalGameOption, true)}
                </div>
              </div>
            )}

            {/* 2. Categorized Playable Game Sections */}
            {orderedCategorySections.map((cat) => {
              if (selectedCategory !== 'all' && selectedCategory !== cat.id) return null;
              const gamesInCategory = publishedOptions.filter((opt) => {
                if (opt.category !== cat.id) return false;
                if (selectedCategory === 'all' && originalGameOption && opt.id === originalGameOption.id) {
                  return false;
                }
                return true;
              });
              if (gamesInCategory.length === 0) return null;
              const CatIcon = cat.icon;

              return (
                <div key={cat.id} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2.5">
                    <CatIcon size={22} className={`${cat.accentText} shrink-0`} />
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      {t(`home.cat.${cat.id}`, cat.title)}
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {gamesInCategory.map((option) =>
                      renderGameCard(option, option.id === originalModeId)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Full-Screen Interactive Question Preview Grid (Baamboozle-inspired but full-bleed & balanced) */
        <div className="flex-1 w-full p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          {balancedQuestionRows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className={`w-full grid gap-5 ${
                row.length === 1
                  ? 'grid-cols-1'
                  : row.length === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : row.length === 3
                  ? 'grid-cols-1 md:grid-cols-3'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              }`}
            >
              {row.map((q) => {
                const idx = normalizedQuestions.findIndex((nq) => nq.id === q.id);
                return renderQuestionPreviewCard(q, idx >= 0 ? idx : 0);
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
