import React, { useState, useEffect, useMemo } from 'react';
import { X, Wrench, Camera, Gamepad2, Users, LayoutGrid } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { GameCategoryId } from '../types';

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
    tagline: 'Sunny Video & Pop-Up Checkpoints',
    description: 'Turn your question set into interactive sunny pop-up quizzes alongside a video adventure!',
    players: '1 Player / Class · Video Quiz',
    category: 'classroom-tools',
    emoji: '🎬',
    image: '/images/video-quiz-card-v3.jpg?v=3',
    fallbackImage: '/images/hamster-pop-quiz-card.jpg?v=3',
    gradient: 'from-cyan-400 via-sky-500 to-yellow-400',
    cardBg: 'bg-cyan-50/70 dark:bg-cyan-950/25 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/35',
    cardBorder: 'border-cyan-200 dark:border-cyan-800/70',
    btnBg: 'bg-cyan-600 hover:bg-cyan-700',
    btnShadow: 'shadow-[0_4px_0_#155e75]',
    accentText: 'text-cyan-600 dark:text-cyan-400',
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
  if (!gameData) return 'bubble-pop';
  const rawType = (gameData.originalGameType || gameData.gameType || '').toString().toLowerCase().trim();
  const normalized = rawType.replace(/[-_ ]+/g, '');

  if (normalized === 'bubblepop') return 'bubble-pop';
  if (normalized === 'rollercoasterquiz' || normalized === 'coasterquiz') return 'roller-coaster-quiz';
  if (normalized === 'hamsterpaintball' || normalized === 'paintball') return 'hamster-paintball';
  if (normalized === 'slapandchop' || normalized === 'slapchop') return 'slap-and-chop';
  if (normalized === 'sharkattack' || normalized === 'sharkstairs') return 'shark-attack';
  if (normalized === 'sumo' || normalized === 'sumotags' || normalized === 'sumoshowdown') return 'sumo';
  if (normalized === 'yoga' || normalized === 'yogaquiz') return 'yoga-quiz';
  if (normalized === 'mysterybox') return 'mystery-box';
  if (normalized === 'bubbleisland' || normalized === 'bubblesentencepro') return 'bubble-sentence-pro';
  if (normalized === 'tictactoe' || normalized === 'tictactoebattle') return 'tic-tac-toe';
  if (normalized === 'flashcardsmatch' || normalized === 'flashmatch') return 'flashcards-match';
  if (normalized === 'familyfeud') return 'family-feud';
  if (normalized === 'hamsterpopquiz' || normalized === 'hamsterpop') return 'hamster-pop-quiz';

  const title = (gameData.name || gameData.title || gameData.topic || '').toLowerCase();
  if (title.includes('bubble pop')) return 'bubble-pop';
  if (title.includes('roller coaster') || title.includes('coaster')) return 'roller-coaster-quiz';
  if (title.includes('paintball') || title.includes('speedball')) return 'hamster-paintball';
  if (title.includes('slap') || title.includes('chop')) return 'slap-and-chop';
  if (title.includes('shark')) return 'shark-attack';
  if (title.includes('sumo')) return 'sumo';
  if (title.includes('yoga')) return 'yoga-quiz';
  if (title.includes('bubble island')) return 'bubble-sentence-pro';
  if (title.includes('tic tac toe') || title.includes('tic-tac-toe')) return 'tic-tac-toe';
  if (title.includes('flashcard')) return 'flashcards-match';
  if (title.includes('family feud')) return 'family-feud';
  if (title.includes('hamster pop') || title.includes('hamster')) return 'hamster-pop-quiz';

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

export function GameModeModal({
  isOpen,
  onClose,
  gameData,
  onSelectMode,
  publishedGames: propPublishedGames,
}: GameModeSelectionModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | GameCategoryId>('all');

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

  const publishedOptions = useMemo(() => {
    return PLAYABLE_GAME_OPTIONS.filter((opt) => isGameModePublished(opt.id, livePublishedGames));
  }, [livePublishedGames]);

  if (!isOpen || !gameData) return null;

  const gameTitle = gameData.topic || gameData.name || gameData.title || 'Custom Quiz';
  const originalModeId = detectOriginalGameMode(gameData);

  const visibleSections = GAME_CATEGORY_SECTIONS.map((section) => ({
    ...section,
    games: publishedOptions.filter((g) => g.category === section.id),
  })).filter(
    (section) =>
      section.games.length > 0 &&
      (selectedCategory === 'all' || selectedCategory === section.id)
  );

  const countByCategory = (catId: GameCategoryId) =>
    publishedOptions.filter((g) => g.category === catId).length;

  const handlePlayInterchangeable = (targetType: PlayableGameMode) => {
    const rawQuestions = gameData.customQuestions || gameData.questions || [];

    const normalizedQuestions = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q: any, idx: number) => {
      const text = q.text || q.question || `Question ${idx + 1}`;
      let options = Array.isArray(q.options)
        ? q.options.filter((o: any) => typeof o === 'string' && o.trim() !== '')
        : Array.isArray(q.answers)
        ? q.answers.filter((a: any) => a && typeof a.text === 'string' && a.text.trim() !== '').map((a: any) => a.text)
        : [];

      let answerIndex =
        typeof q.answerIndex === 'number'
          ? q.answerIndex
          : typeof q.correctIndex === 'number'
          ? q.correctIndex
          : typeof q.correct === 'number'
          ? q.correct
          : 0;

      if (options.length < 2) {
        options = ['Yes', 'No'];
        answerIndex = 0;
      }

      if (answerIndex < 0 || answerIndex >= options.length) {
        answerIndex = 0;
      }

      const feudAnswers = Array.isArray(q.answers) && q.answers.some((a: any) => a?.text)
        ? q.answers
        : [
            { text: options[answerIndex], points: 50, aliases: [options[answerIndex].toLowerCase()] },
            ...options
              .filter((_: string, i: number) => i !== answerIndex)
              .map((optText: string, i: number) => ({
                text: optText,
                points: Math.max(10, 30 - i * 10),
                aliases: [optText.toLowerCase()],
              })),
          ];

      return {
        id: q.id || idx + 1,
        text,
        question: text,
        options,
        answerIndex,
        correct: answerIndex,
        answers: feudAnswers,
        ...(Array.isArray(q.optionImages) ? { optionImages: q.optionImages } : {}),
        ...(q.image || q.imageUrl ? { image: q.image || q.imageUrl, imageUrl: q.image || q.imageUrl } : {}),
      };
    });

    const fallbackQuestions = [
      {
        id: 1,
        text: "Which sentence is grammatically correct?",
        question: "Which sentence is grammatically correct?",
        options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."],
        answerIndex: 0,
        correct: 0,
        answers: [
          { text: "She doesn't like apples.", points: 50 },
          { text: "She don't like apples.", points: 25 },
          { text: "She not like apples.", points: 15 },
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
        answers: [
          { text: 'go', points: 50 },
          { text: 'goes', points: 25 },
          { text: 'gone', points: 15 },
          { text: 'going', points: 10 },
        ],
      },
      {
        id: 5,
        text: "Choose the opposite of 'Difficult':",
        question: "Choose the opposite of 'Difficult':",
        options: ['Easy', 'Hard', 'Tough', 'Heavy'],
        answerIndex: 0,
        correct: 0,
        answers: [
          { text: 'Easy', points: 50 },
          { text: 'Hard', points: 25 },
          { text: 'Tough', points: 15 },
          { text: 'Heavy', points: 10 },
        ],
      },
    ];

    const finalQuestions = (normalizedQuestions.length > 0 ? normalizedQuestions : fallbackQuestions).slice(0, 30);

    const flashcardPairs = finalQuestions.map((q: any, idx: number) => ({
      id: q.id || idx + 1,
      front: q.text,
      back: q.options[q.answerIndex] || q.options[0] || 'Answer',
    }));

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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-5xl shadow-2xl relative border border-slate-200/80 dark:border-slate-800 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header + Classification Filter Tabs */}
        <div className="px-6 sm:px-8 py-4 flex flex-col gap-3.5 shrink-0 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {gameTitle}
            </h2>

            <button
              onClick={onClose}
              className="w-10 h-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Classification Tabs matching Home Studio */}
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/70 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid size={15} />
                <span>All Games</span>
                <span className="text-xs opacity-75 tabular-nums">({publishedOptions.length})</span>
              </button>

              {GAME_CATEGORY_SECTIONS.map((cat) => {
                const Icon = cat.icon;
                const count = countByCategory(cat.id);
                if (count === 0) return null;
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'text-current' : cat.accentText} />
                    <span>{cat.title}</span>
                    <span className="text-xs opacity-75 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Divided by Classification Sections with Pure 3D Game Image Cards */}
        <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex flex-col gap-10">
          {visibleSections.map((section) => {
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
                  {section.games.map((option) => (
                    <div
                      key={option.id}
                      onClick={() => handlePlayInterchangeable(option.id)}
                      className="w-full relative aspect-[4/3] bg-transparent rounded-[2.25rem] overflow-hidden shadow-[0_22px_44px_-12px_rgba(15,23,42,0.36),0_10px_20px_-8px_rgba(15,23,42,0.22)] group hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_32px_60px_-12px_rgba(15,23,42,0.45)] active:translate-y-0.5 transition-all duration-300 cursor-pointer select-none"
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
                        className="w-full h-full object-cover scale-[1.01] group-hover:scale-[1.06] transition-transform duration-300"
                      />
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
  );
}
