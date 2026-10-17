import React, { useState } from 'react';
import { X, Play, Sparkles, Users, Gamepad2, Layers, CheckCircle2 } from 'lucide-react';
import { ViewState } from '../types';

export type PlayableGameMode =
  | 'bubble-pop'
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
}

interface GameOptionConfig {
  id: PlayableGameMode;
  title: string;
  shortAction: string;
  tagline: string;
  description: string;
  players: string;
  category: 'battle' | 'camera' | 'board' | 'cards';
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

export const PLAYABLE_GAME_OPTIONS: GameOptionConfig[] = [
  {
    id: 'bubble-pop',
    title: 'Bubble Pop',
    shortAction: 'Play in Bubble Pop',
    tagline: 'Motion Camera & Bubble Popping',
    description: 'Use your hand on camera or mouse to pop floating answer bubbles before time runs out.',
    players: '1–2 Players · Camera / Mouse',
    category: 'camera',
    emoji: '🫧',
    image: '/images/bubble-pop.png',
    fallbackImage: 'https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000',
    gradient: 'from-blue-500 via-sky-500 to-cyan-500',
    cardBg: 'bg-blue-50/70 dark:bg-blue-950/25 hover:bg-blue-100/80 dark:hover:bg-blue-900/35',
    cardBorder: 'border-blue-200 dark:border-blue-800/70',
    btnBg: 'bg-blue-600 hover:bg-blue-700',
    btnShadow: 'shadow-[0_4px_0_#1e3a8a]',
    accentText: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'shark-attack',
    title: 'Shark Attack',
    shortAction: 'Play in Shark Attack',
    tagline: 'Staircase Showdown vs Megalodon',
    description: '2-player or vs AI battle on twin staircases! Wrong answers make you climb closer to the shark jaws!',
    players: '1–2 Players · WASD vs Arrows / AI',
    category: 'battle',
    emoji: '🦈',
    image: 'https://images.unsplash.com/photo-1560275619-4662e36fa65c?q=80&w=1000&auto=format&fit=crop',
    gradient: 'from-cyan-500 via-blue-600 to-slate-900',
    cardBg: 'bg-cyan-50/70 dark:bg-cyan-950/25 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/35',
    cardBorder: 'border-cyan-200 dark:border-cyan-800/70',
    btnBg: 'bg-cyan-600 hover:bg-cyan-700',
    btnShadow: 'shadow-[0_4px_0_#0e7490]',
    accentText: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    id: 'sumo',
    title: 'Sumo Showdown',
    shortAction: 'Play in Sumo',
    tagline: '2-Team Dohyo Ring Tug-of-War',
    description: 'Choose your sumo fighters and push your rival out of the circular ring by answering fast.',
    players: '2 Teams · Split or Single Q',
    category: 'battle',
    emoji: '🤼',
    image: '/images/sumo.png',
    fallbackImage: 'https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000',
    gradient: 'from-rose-500 via-red-500 to-amber-500',
    cardBg: 'bg-rose-50/70 dark:bg-rose-950/25 hover:bg-rose-100/80 dark:hover:bg-rose-900/35',
    cardBorder: 'border-rose-200 dark:border-rose-800/70',
    btnBg: 'bg-rose-600 hover:bg-rose-700',
    btnShadow: 'shadow-[0_4px_0_#881337]',
    accentText: 'text-rose-600 dark:text-rose-400',
  },
  {
    id: 'mystery-box',
    title: 'Mystery Box',
    shortAction: 'Play in Mystery Box',
    tagline: 'Numbered Boxes (1–30) & Surprises',
    description: 'Pick numbered boxes, answer questions, and decide whether to keep or gift the mystery reward!',
    players: '2–8 Teams · Classroom Game Show',
    category: 'board',
    emoji: '🎁',
    image: 'https://drive.google.com/thumbnail?id=1ugM0rhtk40XdbSDrdDJja5QpLNkWebQn&sz=w1000',
    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
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
    category: 'camera',
    emoji: '🧘‍♀️',
    image: 'https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-600',
    cardBg: 'bg-emerald-50/70 dark:bg-emerald-950/25 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/35',
    cardBorder: 'border-emerald-200 dark:border-emerald-800/70',
    btnBg: 'bg-emerald-600 hover:bg-emerald-700',
    btnShadow: 'shadow-[0_4px_0_#065f46]',
    accentText: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'bubble-sentence-pro',
    title: 'Bubble Island',
    shortAction: 'Play in Bubble Island',
    tagline: 'Floating Island A, B, C, D Quiz',
    description: 'Pop floating A, B, C, D island bubbles in a sunny sky & ocean arcade environment.',
    players: '1 Player / Class · Arcade Quiz',
    category: 'camera',
    emoji: '🏝️',
    image: 'https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000',
    gradient: 'from-sky-400 via-blue-500 to-indigo-600',
    cardBg: 'bg-sky-50/70 dark:bg-sky-950/25 hover:bg-sky-100/80 dark:hover:bg-sky-900/35',
    cardBorder: 'border-sky-200 dark:border-sky-800/70',
    btnBg: 'bg-sky-500 hover:bg-sky-600',
    btnShadow: 'shadow-[0_4px_0_#0369a1]',
    accentText: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'tic-tac-toe',
    title: 'Tic-Tac-Toe Battle',
    shortAction: 'Play in Tic-Tac-Toe',
    tagline: '3×3 Tactical Grid & Steal Phase',
    description: 'Team X vs Team O! Answer questions to claim grid squares, block opponents, or steal turns.',
    players: '2 Teams · Local or Live Room',
    category: 'battle',
    emoji: '⚔️',
    image: 'https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1000&auto=format&fit=crop',
    gradient: 'from-indigo-500 via-purple-600 to-pink-500',
    cardBg: 'bg-indigo-50/70 dark:bg-indigo-950/25 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/35',
    cardBorder: 'border-indigo-200 dark:border-indigo-800/70',
    btnBg: 'bg-indigo-600 hover:bg-indigo-700',
    btnShadow: 'shadow-[0_4px_0_#3730a3]',
    accentText: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'flashcards-match',
    title: 'Flashcards & Match',
    shortAction: 'Play in Flash Match',
    tagline: '3D Flip Cards & Timed Pair Grid',
    description: 'Study questions as 3D flip flashcards or race the timer to match questions with answers!',
    players: 'Solo / Class · Memory & Review',
    category: 'cards',
    emoji: '🎴',
    image: 'https://drive.google.com/thumbnail?id=1UtaZtVX0onrqj3VorxedOxy1iVXdFAHk&sz=w1000',
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-600',
    cardBg: 'bg-purple-50/70 dark:bg-purple-950/25 hover:bg-purple-100/80 dark:hover:bg-purple-900/35',
    cardBorder: 'border-purple-200 dark:border-purple-800/70',
    btnBg: 'bg-purple-600 hover:bg-purple-700',
    btnShadow: 'shadow-[0_4px_0_#581c87]',
    accentText: 'text-purple-600 dark:text-purple-400',
  },
  {
    id: 'family-feud',
    title: 'Family Feud',
    shortAction: 'Play in Family Feud',
    tagline: 'Survey Flip Board & Strike Buzzer',
    description: 'Flip the numbered survey board slots, guess top answers, and avoid the triple red X strike!',
    players: '2 Teams · TV Game Show',
    category: 'board',
    emoji: '🔔',
    image: 'https://drive.google.com/thumbnail?id=1DDWdERo9zS6SEbpXA7J8FSh__1CNqxZN&sz=w1000',
    gradient: 'from-yellow-400 via-amber-500 to-orange-600',
    cardBg: 'bg-yellow-50/70 dark:bg-yellow-950/25 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/35',
    cardBorder: 'border-yellow-300 dark:border-yellow-800/70',
    btnBg: 'bg-orange-500 hover:bg-orange-600',
    btnShadow: 'shadow-[0_4px_0_#9a3412]',
    accentText: 'text-orange-600 dark:text-orange-400',
  },
  {
    id: 'hamster-pop-quiz',
    title: 'Hamster Pop Quiz',
    shortAction: 'Play in Hamster Pop',
    tagline: 'Sunny Video & Pop-Up Checkpoints',
    description: 'Turn your question set into interactive sunny pop-up quizzes alongside a video adventure!',
    players: '1 Player / Class · Video Quiz',
    category: 'cards',
    emoji: '🐹',
    image: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?q=80&w=1000&auto=format&fit=crop',
    gradient: 'from-cyan-400 via-sky-500 to-yellow-400',
    cardBg: 'bg-cyan-50/70 dark:bg-cyan-950/25 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/35',
    cardBorder: 'border-cyan-200 dark:border-cyan-800/70',
    btnBg: 'bg-cyan-600 hover:bg-cyan-700',
    btnShadow: 'shadow-[0_4px_0_#155e75]',
    accentText: 'text-cyan-600 dark:text-cyan-400',
  },
];

export function detectOriginalGameMode(gameData: any): PlayableGameMode {
  if (!gameData) return 'bubble-pop';
  const rawType = (gameData.originalGameType || gameData.gameType || '').toString().toLowerCase().trim();
  const normalized = rawType.replace(/[-_ ]+/g, '');

  if (normalized === 'bubblepop') return 'bubble-pop';
  if (normalized === 'sharkattack' || normalized === 'sharkstairs') return 'shark-attack';
  if (normalized === 'sumo' || normalized === 'sumotags' || normalized === 'sumoshowdown') return 'sumo';
  if (normalized === 'yoga' || normalized === 'yogaquiz') return 'yoga-quiz';
  if (normalized === 'mysterybox') return 'mystery-box';
  if (normalized === 'bubbleisland' || normalized === 'bubblesentencepro') return 'bubble-sentence-pro';
  if (normalized === 'tictactoe' || normalized === 'tictactoebattle') return 'tic-tac-toe';
  if (normalized === 'flashcardsmatch' || normalized === 'flashmatch') return 'flashcards-match';
  if (normalized === 'familyfeud') return 'family-feud';
  if (normalized === 'hamsterpopquiz' || normalized === 'hamsterpop') return 'hamster-pop-quiz';

  // Fallback check on title/name if gameType was generic
  const title = (gameData.name || gameData.title || gameData.topic || '').toLowerCase();
  if (title.includes('bubble pop')) return 'bubble-pop';
  if (title.includes('shark')) return 'shark-attack';
  if (title.includes('sumo')) return 'sumo';
  if (title.includes('yoga')) return 'yoga-quiz';
  if (title.includes('bubble island')) return 'bubble-sentence-pro';
  if (title.includes('tic tac toe') || title.includes('tic-tac-toe')) return 'tic-tac-toe';
  if (title.includes('flashcard')) return 'flashcards-match';
  if (title.includes('family feud')) return 'family-feud';
  if (title.includes('hamster')) return 'hamster-pop-quiz';

  return 'mystery-box';
}

export function GameModeModal({
  isOpen,
  onClose,
  gameData,
  onSelectMode,
}: GameModeSelectionModalProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'battle' | 'camera' | 'board' | 'cards'>('all');

  if (!isOpen || !gameData) return null;

  const gameTitle = gameData.topic || gameData.name || gameData.title || 'Custom Quiz';
  const classLabel = gameData.className || gameData.classLevel || 'All Levels';
  const rawQuestionsList = gameData.customQuestions || gameData.questions || gameData.sentences || [];
  const questionCount = Array.isArray(rawQuestionsList) && rawQuestionsList.length > 0 ? rawQuestionsList.length : 5;

  const originalModeId = detectOriginalGameMode(gameData);
  const originalOption = PLAYABLE_GAME_OPTIONS.find((opt) => opt.id === originalModeId) || PLAYABLE_GAME_OPTIONS[0];

  // Prioritize the original game first, followed by all other game options
  const otherOptions = PLAYABLE_GAME_OPTIONS.filter((opt) => opt.id !== originalOption.id);
  const filteredOtherOptions =
    activeFilter === 'all'
      ? otherOptions
      : otherOptions.filter((opt) => opt.category === activeFilter);

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

      // Build Family Feud compatible answers array so Family Feud also works with any MCQ set
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

    // Also prepare Flashcard / Match pairs for FlashcardsMatch view
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[36px] w-full max-w-6xl shadow-2xl relative border-2 border-slate-200/80 dark:border-slate-700/80 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-50/60 dark:bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-brand-purple dark:text-purple-400 mb-1">
              <Gamepad2 className="w-4 h-4" />
              <span>Choose How to Play</span>
              <span aria-hidden="true">·</span>
              <span>{PLAYABLE_GAME_OPTIONS.length} Game Modes Ready</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {gameTitle}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-semibold mt-1">
              <span>Created in {originalOption.title}</span>
              <span aria-hidden="true">·</span>
              <span>{questionCount} {questionCount === 1 ? 'Question' : 'Questions'}</span>
              <span aria-hidden="true">·</span>
              <span>Class: {classLabel}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="absolute top-5 right-5 sm:static w-10 h-10 bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar space-y-7">
          {/* 1. PRIORITIZED ORIGINAL GAME HERO CARD */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Prioritized Mode — Made for {originalOption.title}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Best Match for This Set
              </span>
            </div>

            <div
              onClick={() => handlePlayInterchangeable(originalOption.id)}
              className={`group relative rounded-3xl p-5 sm:p-6 border-2 ${originalOption.cardBorder} ${originalOption.cardBg} transition-all duration-200 hover:shadow-xl cursor-pointer flex flex-col md:flex-row items-center gap-5 sm:gap-6`}
            >
              {/* Featured Thumbnail */}
              <div
                className={`relative w-full md:w-64 aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br ${originalOption.gradient} shadow-md shrink-0 flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-300`}
              >
                <img
                  src={originalOption.image}
                  alt={originalOption.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover absolute inset-0 z-10"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (originalOption.fallbackImage && target.src !== originalOption.fallbackImage) {
                      target.src = originalOption.fallbackImage;
                    } else {
                      target.style.display = 'none';
                    }
                  }}
                />
                <div className="text-center z-0 p-4">
                  <span className="text-6xl drop-shadow-md block">{originalOption.emoji}</span>
                </div>
              </div>

              {/* Featured Details */}
              <div className="flex-1 text-center md:text-left">
                <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Original Game Mode · {originalOption.players}
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-1.5">
                  {originalOption.title}
                </h3>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 font-medium max-w-2xl leading-relaxed">
                  {originalOption.description}
                </p>
              </div>

              {/* Primary Play Action */}
              <div className="w-full md:w-auto shrink-0 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayInterchangeable(originalOption.id);
                  }}
                  className={`w-full md:w-auto px-7 py-4 ${originalOption.btnBg} text-white font-black text-base sm:text-lg rounded-2xl ${originalOption.btnShadow} active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-2.5 cursor-pointer`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>{originalOption.shortAction}</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. PLAY WITH OTHER GAME OPTIONS SECTION */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  Or Play This Set in Another Game Mode
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Your {questionCount} questions automatically adapt to any of these {otherOptions.length} classroom games:
                </p>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
                {[
                  { id: 'all', label: `All (${otherOptions.length})` },
                  { id: 'battle', label: 'Team Battles' },
                  { id: 'camera', label: 'Active & Arcade' },
                  { id: 'board', label: 'Game Shows' },
                  { id: 'cards', label: 'Cards & Video' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      activeFilter === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid of Other Game Modes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredOtherOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handlePlayInterchangeable(option.id)}
                  className={`group relative flex flex-col ${option.cardBg} border-2 ${option.cardBorder} rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-left`}
                >
                  <div
                    className={`relative w-full aspect-[16/10] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br ${option.gradient} shadow-sm flex items-center justify-center group-hover:scale-[1.02] transition-transform duration-300`}
                  >
                    <img
                      src={option.image}
                      alt={option.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover absolute inset-0 z-10"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (option.fallbackImage && target.src !== option.fallbackImage) {
                          target.src = option.fallbackImage;
                        } else {
                          target.style.display = 'none';
                        }
                      }}
                    />
                    <div className="text-center z-0 p-3">
                      <span className="text-5xl drop-shadow-md block">{option.emoji}</span>
                    </div>
                  </div>

                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">
                    {option.players}
                  </div>
                  <h4 className="font-black text-lg text-slate-900 dark:text-white mb-1">
                    {option.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 flex-1 leading-relaxed">
                    {option.description}
                  </p>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayInterchangeable(option.id);
                    }}
                    className={`w-full py-2.5 px-3 ${option.btnBg} text-white font-black text-xs sm:text-sm rounded-xl ${option.btnShadow} active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{option.shortAction}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
