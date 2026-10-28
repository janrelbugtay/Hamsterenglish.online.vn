import React from 'react';
import { Gamepad2, Sparkles, HelpCircle, CheckCircle2, Gift, Trophy, Zap, Play } from 'lucide-react';

export interface GameThumbnailProps {
  gameType: string;
  info?: any;
  game?: any;
  compact?: boolean;
}

interface PaletteTheme {
  bgGradient: string;
  accentBg: string;
  accentText: string;
  border: string;
  pillBg: string;
  pillText: string;
  glow: string;
  skyGradient: string;
  islandColor: string;
}

const PALETTES: PaletteTheme[] = [
  {
    bgGradient: 'from-indigo-950 via-blue-900 to-cyan-800',
    accentBg: 'bg-cyan-400',
    accentText: 'text-cyan-300',
    border: 'border-cyan-400/40',
    pillBg: 'bg-cyan-500/20',
    pillText: 'text-cyan-100',
    glow: 'shadow-[0_0_20px_rgba(34,211,238,0.45)]',
    skyGradient: 'from-sky-400 via-cyan-300 to-teal-200',
    islandColor: 'from-amber-200 to-yellow-300',
  },
  {
    bgGradient: 'from-rose-950 via-fuchsia-900 to-orange-800',
    accentBg: 'bg-amber-400',
    accentText: 'text-amber-300',
    border: 'border-pink-400/40',
    pillBg: 'bg-rose-500/20',
    pillText: 'text-rose-100',
    glow: 'shadow-[0_0_20px_rgba(251,113,133,0.45)]',
    skyGradient: 'from-orange-300 via-rose-200 to-amber-100',
    islandColor: 'from-emerald-300 to-teal-400',
  },
  {
    bgGradient: 'from-emerald-950 via-teal-900 to-cyan-900',
    accentBg: 'bg-emerald-400',
    accentText: 'text-emerald-300',
    border: 'border-emerald-400/40',
    pillBg: 'bg-emerald-500/20',
    pillText: 'text-emerald-100',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.45)]',
    skyGradient: 'from-teal-400 via-emerald-200 to-lime-100',
    islandColor: 'from-amber-200 to-orange-200',
  },
  {
    bgGradient: 'from-violet-950 via-purple-900 to-indigo-900',
    accentBg: 'bg-violet-400',
    accentText: 'text-violet-300',
    border: 'border-violet-400/40',
    pillBg: 'bg-violet-500/20',
    pillText: 'text-violet-100',
    glow: 'shadow-[0_0_20px_rgba(167,139,250,0.45)]',
    skyGradient: 'from-indigo-300 via-purple-200 to-pink-200',
    islandColor: 'from-amber-200 to-yellow-300',
  },
  {
    bgGradient: 'from-amber-950 via-orange-900 to-red-900',
    accentBg: 'bg-yellow-400',
    accentText: 'text-yellow-300',
    border: 'border-amber-400/40',
    pillBg: 'bg-amber-500/20',
    pillText: 'text-amber-100',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.45)]',
    skyGradient: 'from-amber-300 via-yellow-200 to-sky-200',
    islandColor: 'from-lime-300 to-emerald-400',
  },
  {
    bgGradient: 'from-slate-950 via-blue-950 to-indigo-900',
    accentBg: 'bg-sky-400',
    accentText: 'text-sky-300',
    border: 'border-sky-400/40',
    pillBg: 'bg-sky-500/20',
    pillText: 'text-sky-100',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.45)]',
    skyGradient: 'from-blue-400 via-sky-300 to-indigo-100',
    islandColor: 'from-yellow-200 to-amber-300',
  },
];

const DEFAULT_BOILERPLATE_Q1 = "which sentence is grammatically correct?";

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

interface TopicProfile {
  emojis: [string, string, string, string];
  fallbackQuestion: string;
  fallbackOptions: string[];
  fallbackSentence: string;
  paletteIndex?: number;
}

function analyzeTopicProfile(rawTitle: string, combinedText: string): TopicProfile {
  const lower = `${rawTitle} ${combinedText}`.toLowerCase();

  if (/(job|career|occupation|work|doctor|nurse|teacher|chef|pilot|police|firefighter|farmer|dentist|vet|driver)/.test(lower)) {
    return {
      emojis: ['👨‍⚕️', '👩‍🏫', '👨‍🍳', '👩‍✈️'],
      fallbackQuestion: 'Who helps sick people in a hospital?',
      fallbackOptions: ['Doctor', 'Teacher', 'Chef', 'Pilot'],
      fallbackSentence: 'She is a doctor at the hospital',
      paletteIndex: 0,
    };
  }
  if (/(food|fruit|vegetable|drink|eat|breakfast|lunch|dinner|pizza|apple|banana|burger|milk|bread|cake|kitchen|kindergarten)/.test(lower)) {
    return {
      emojis: ['🍎', '🍕', '🍔', '🍓'],
      fallbackQuestion: 'Which one is a healthy sweet fruit?',
      fallbackOptions: ['Apple', 'Pizza', 'Burger', 'Milk'],
      fallbackSentence: 'I like eating red apples',
      paletteIndex: 1,
    };
  }
  if (/(moon festival|mid-autumn|autumn|lantern|mooncake|festival|holiday|christmas|halloween|new year|celebrat)/.test(lower)) {
    return {
      emojis: ['🥮', '🌕', '🏮', '🐇'],
      fallbackQuestion: 'What do families eat during the Moon Festival?',
      fallbackOptions: ['Mooncakes', 'Lanterns', 'Full Moon', 'Tea'],
      fallbackSentence: 'We eat sweet mooncakes under the moon',
      paletteIndex: 4,
    };
  }
  if (/(buy|sell|shop|market|store|money|price|cost|cheap|expensive|customer|pay|clothes)/.test(lower)) {
    return {
      emojis: ['🛍️', '🪙', '🏷️', '🏪'],
      fallbackQuestion: 'How much does this jacket cost?',
      fallbackOptions: ['Buying', 'Selling', '$20', 'On Sale'],
      fallbackSentence: 'How much is this new shirt',
      paletteIndex: 1,
    };
  }
  if (/(this is|these are|that is|those are|there is|there are|demonstrative|plural|singular)/.test(lower)) {
    return {
      emojis: ['👉', '👈', '📚', '✏️'],
      fallbackQuestion: '____ my favorite story books.',
      fallbackOptions: ['This is', 'These are', 'That is', 'Those are'],
      fallbackSentence: 'These are my new colorful pencils',
      paletteIndex: 4,
    };
  }
  if (/(conditional|if |would|will|unless|wish|tense|past|present|future|modal|passive|grammar)/.test(lower)) {
    return {
      emojis: ['🔀', '⚡', '🎯', '💡'],
      fallbackQuestion: 'If it rains tomorrow, we ____ stay inside.',
      fallbackOptions: ['will', 'would', 'had', 'can'],
      fallbackSentence: 'If you study hard you will succeed',
      paletteIndex: 3,
    };
  }
  if (/(cambridge|ket|pet|fce|ielts|movers|flyers|starters|exam|unit|test|grade)/.test(lower)) {
    return {
      emojis: ['🎓', '📘', '🏆', '✍️'],
      fallbackQuestion: 'Choose the best word to complete the sentence:',
      fallbackOptions: [' Option A', 'Option B', 'Option C', 'Option D'],
      fallbackSentence: 'She has lived here since last summer',
      paletteIndex: 3,
    };
  }
  if (/(animal|pet|zoo|dog|cat|lion|tiger|elephant|monkey|bird|fish|wild|farm|sea|ocean)/.test(lower)) {
    return {
      emojis: ['🦁', '🐼', '🐶', '🦊'],
      fallbackQuestion: 'Which animal is known as the King of the Jungle?',
      fallbackOptions: ['Lion', 'Panda', 'Dolphin', 'Rabbit'],
      fallbackSentence: 'The clever monkey climbs up the tree',
      paletteIndex: 2,
    };
  }
  if (/(sport|hobby|football|soccer|basketball|swim|run|play|music|dance|game)/.test(lower)) {
    return {
      emojis: ['⚽', '🏀', '🎸', '🏃'],
      fallbackQuestion: 'What sport do you play on a grass pitch?',
      fallbackOptions: ['Football', 'Swimming', 'Tennis', 'Running'],
      fallbackSentence: 'They play football after school every day',
      paletteIndex: 2,
    };
  }
  if (/(weather|season|sunny|rain|snow|wind|summer|winter|spring|time|clock|day|month)/.test(lower)) {
    return {
      emojis: ['🌤️', '🌧️', '❄️', '🌈'],
      fallbackQuestion: 'What is the weather like on a sunny summer day?',
      fallbackOptions: ['Sunny & Hot', 'Snowy', 'Rainy', 'Windy'],
      fallbackSentence: 'It is warm and sunny today',
      paletteIndex: 5,
    };
  }
  if (/(family|mother|father|sister|brother|body|head|hand|feeling|happy|sad|angry)/.test(lower)) {
    return {
      emojis: ['👨‍👩‍👧‍👦', '😊', '❤️', '🏠'],
      fallbackQuestion: 'How do you feel when you win a game?',
      fallbackOptions: ['Happy', 'Excited', 'Proud', 'Surprised'],
      fallbackSentence: 'My family loves spending time together',
      paletteIndex: 1,
    };
  }
  if (/(school|classroom|pencil|book|desk|read|write|vocab|word|spell|letter|phonics)/.test(lower)) {
    return {
      emojis: ['📖', '🔤', '✏️', '🌟'],
      fallbackQuestion: 'Choose the correct vocabulary word:',
      fallbackOptions: ['Notebook', 'Pencil', 'Backpack', 'Dictionary'],
      fallbackSentence: 'Open your book and read the story',
      paletteIndex: 0,
    };
  }

  return {
    emojis: ['🎯', '✨', '🌟', '🚀'],
    fallbackQuestion: `Question about ${rawTitle.replace(/[_-]+/g, ' ')}`,
    fallbackOptions: ['Choice A', 'Choice B', 'Choice C', 'Choice D'],
    fallbackSentence: `Let us practice ${rawTitle.replace(/[_-]+/g, ' ')}`,
  };
}

function extractGameContent(game: any, gameType: string, info: any) {
  const rawTitle = (game?.topic || game?.name || game?.title || info?.title || 'ESL Game').trim();
  const cleanTitle = rawTitle.replace(/_/g, ' ').trim();
  const classLevel = (game?.classLevel || game?.className || '').trim();

  const rawQuestions = Array.isArray(game?.customQuestions) && game.customQuestions.length > 0
    ? game.customQuestions
    : (Array.isArray(game?.questions) ? game.questions : []);

  const rawSentences = Array.isArray(game?.customSentences) && game.customSentences.length > 0
    ? game.customSentences
    : (Array.isArray(game?.sentences) ? game.sentences : []);

  const rawCards = Array.isArray(game?.cards) && game.cards.length > 0 ? game.cards : [];

  // Filter out blank questions or generic boilerplate if the game has a custom topic
  const validQuestions = rawQuestions.filter((q: any) => {
    const t = (q?.text || q?.question || '').trim();
    if (!t) return false;
    if (
      t.toLowerCase() === DEFAULT_BOILERPLATE_Q1 &&
      rawTitle.toLowerCase() !== 'grammar' &&
      rawTitle.toLowerCase() !== 'bubble pop' &&
      rawTitle.toLowerCase() !== 'custom quiz'
    ) {
      return false;
    }
    return true;
  });

  const validSentences = rawSentences.filter((s: any) => {
    const t = (s?.text || s?.question || '').trim();
    return t.length > 0 && t.toLowerCase() !== DEFAULT_BOILERPLATE_Q1;
  });

  // Collect all text for topic detection
  const sampleTextBlob = [
    cleanTitle,
    classLevel,
    ...validQuestions.slice(0, 4).map((q: any) => `${q.text || q.question || ''} ${(q.options || []).join(' ')}`),
    ...validSentences.slice(0, 4).map((s: any) => `${s.text || s.question || ''} ${(s.options || []).join(' ')}`),
  ].join(' ');

  const profile = analyzeTopicProfile(cleanTitle, sampleTextBlob);
  const seed = hashString(`${game?.id || ''}-${rawTitle}-${gameType}`);
  const paletteIdx = profile.paletteIndex !== undefined
    ? (profile.paletteIndex + (seed % 2)) % PALETTES.length
    : seed % PALETTES.length;
  const palette = PALETTES[paletteIdx];

  // Primary & secondary questions
  const firstQuestionObj = validQuestions[0] || validSentences[0] || null;
  const secondQuestionObj = validQuestions[1] || validSentences[1] || null;

  const firstQuestion = (firstQuestionObj?.text || firstQuestionObj?.question || '').trim() || profile.fallbackQuestion;
  const secondQuestion = (secondQuestionObj?.text || secondQuestionObj?.question || '').trim() || '';

  // Options extraction
  const extractedOptions: string[] = [];
  for (const q of [...validQuestions, ...validSentences]) {
    if (Array.isArray(q?.options)) {
      for (const opt of q.options) {
        if (typeof opt === 'string' && opt.trim() && !extractedOptions.includes(opt.trim())) {
          extractedOptions.push(opt.trim());
        }
      }
    }
    if (extractedOptions.length >= 6) break;
  }

  // Family Feud answers extraction
  const feudAnswers: { text: string; points: number }[] = [];
  if (validQuestions[0] && Array.isArray(validQuestions[0].answers)) {
    for (const ans of validQuestions[0].answers) {
      if (ans?.text && String(ans.text).trim()) {
        feudAnswers.push({ text: String(ans.text).trim(), points: Number(ans.points) || 10 });
      }
    }
  }

  // Sentence words extraction for Bubble Island / sentence games
  const firstSentenceText = (validSentences[0]?.text || validSentences[0]?.question || '').trim() ||
    (validQuestions[0]?.text && (!Array.isArray(validQuestions[0]?.options) || validQuestions[0]?.options.length === 0)
      ? validQuestions[0].text.trim()
      : '') ||
    profile.fallbackSentence;

  const sentenceWords = firstSentenceText
    .split(/\s+/)
    .map((w: string) => w.trim())
    .filter(Boolean);

  // If we still need options, derive from sentence words or topic fallback
  const options = extractedOptions.length >= 2
    ? extractedOptions.slice(0, 4)
    : (sentenceWords.length >= 3 && validQuestions.length === 0
        ? sentenceWords.slice(0, 4)
        : profile.fallbackOptions);

  const answerIndex = typeof firstQuestionObj?.answerIndex === 'number'
    ? firstQuestionObj.answerIndex
    : (typeof firstQuestionObj?.correctIndex === 'number' ? firstQuestionObj.correctIndex : 0);

  // Check if any question has an uploaded image
  let customImage: string | null = null;
  for (const q of [...validQuestions, ...validSentences]) {
    if (q?.image && typeof q.image === 'string' && q.image.trim()) {
      customImage = q.image.trim();
      break;
    }
    if (q?.imageUrl && typeof q.imageUrl === 'string' && q.imageUrl.trim()) {
      customImage = q.imageUrl.trim();
      break;
    }
    if (Array.isArray(q?.optionImages)) {
      const found = q.optionImages.find((img: any) => typeof img === 'string' && img.trim());
      if (found) {
        customImage = found.trim();
        break;
      }
    }
  }

  // Custom emoji from sentence if present
  const customSentenceEmoji = validSentences.find((s: any) => s?.emoji && s.emoji !== '✨')?.emoji;
  const emojis: [string, string, string, string] = customSentenceEmoji
    ? [customSentenceEmoji, profile.emojis[0], profile.emojis[1], profile.emojis[2]]
    : profile.emojis;

  const totalCount = Math.max(
    rawQuestions.length,
    rawSentences.length,
    rawCards.length,
    validQuestions.length,
    validSentences.length
  );

  const mode = game?.mode || (validSentences.length > 0 && extractedOptions.length === 0 ? 'word' : 'multiple-choice');

  return {
    cleanTitle,
    classLevel,
    firstQuestion,
    secondQuestion,
    firstSentenceText,
    sentenceWords,
    options,
    answerIndex: Math.min(Math.max(0, answerIndex), Math.max(0, options.length - 1)),
    feudAnswers,
    rawCards,
    customImage,
    emojis,
    palette,
    totalCount: totalCount > 0 ? totalCount : 10,
    mode,
    seed,
  };
}

export const GameThumbnail = ({ gameType, info = {}, game, compact = false }: GameThumbnailProps) => {
  const normalizedType = (gameType || game?.gameType || '').toLowerCase().trim();
  const content = extractGameContent(game, normalizedType, info);
  const {
    cleanTitle,
    firstQuestion,
    secondQuestion,
    firstSentenceText,
    sentenceWords,
    options,
    answerIndex,
    feudAnswers,
    customImage,
    emojis,
    palette,
    totalCount,
    mode,
  } = content;

  // Compact 64x64 mode for small icons in My Games folder list
  if (compact) {
    if (info?.icon && (normalizedType === 'roller-coaster-quiz' || normalizedType === 'slap-and-chop' || normalizedType === 'shark-attack' || normalizedType === 'squid-game-picker' || normalizedType === 'mystery-box')) {
      return (
        <img
          src={info.icon}
          referrerPolicy="no-referrer"
          alt={info?.title || cleanTitle}
          className="absolute inset-0 w-full h-full object-cover scale-110 pointer-events-none select-none"
        />
      );
    }
    return (
      <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${palette.bgGradient} flex flex-col items-center justify-center p-1 overflow-hidden pointer-events-none select-none`}>
        <span className="text-2xl leading-none drop-shadow-md">{emojis[0]}</span>
        <span className="text-[8px] font-black text-white/90 uppercase tracking-tighter truncate max-w-full mt-0.5 px-1 bg-black/30 rounded">
          {normalizedType === 'bubble-sentence-pro' ? 'Island' : normalizedType.replace(/-/g, ' ')}
        </span>
      </div>
    );
  }

  // Template card mode (no custom game object passed) for Roller Coaster Quiz, Slap & Chop, Shark Attack, Name Picker, and Mystery Box
  if (!game && info?.icon && (normalizedType === 'roller-coaster-quiz' || normalizedType === 'slap-and-chop' || normalizedType === 'shark-attack' || normalizedType === 'squid-game-picker' || normalizedType === 'mystery-box')) {
    return (
      <img
        src={info.icon}
        referrerPolicy="no-referrer"
        alt={info?.title || cleanTitle}
        className="absolute inset-0 w-full h-full object-cover scale-[1.12] group-hover:scale-[1.20] transition-transform duration-500"
      />
    );
  }

  // 1. BUBBLE ISLAND (bubble-sentence-pro)
  if (normalizedType === 'bubble-sentence-pro' || normalizedType === 'bubble-island') {
    const isMcq = mode === 'multiple-choice';
    const isAnagram = mode === 'anagram';
    const displayBubbles = isMcq
      ? options.slice(0, 4)
      : isAnagram
      ? firstSentenceText.replace(/\s+/g, '').slice(0, 6).toUpperCase().split('')
      : (sentenceWords.length > 0 ? sentenceWords.slice(0, 5) : ['It\'s', 'a', 'sunny', 'day']);

    const bubblePositions = [
      'top-[34%] left-[6%] -rotate-6',
      'top-[28%] left-[36%] rotate-3',
      'top-[35%] right-[6%] rotate-6',
      'top-[53%] left-[18%] rotate-2',
      'top-[52%] right-[16%] -rotate-3',
      'top-[44%] left-[44%] -rotate-2',
    ];

    return (
      <div className={`absolute inset-0 w-full h-full bg-gradient-to-b ${palette.skyGradient} overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none`}>
        {/* Sun & Tropical Clouds */}
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-yellow-300/90 rounded-full blur-[1px] shadow-[0_0_30px_rgba(253,224,71,0.9)]" />
        <div className="absolute top-[18%] -left-4 w-24 h-7 bg-white/65 rounded-full blur-[0.5px]" />
        <div className="absolute top-[36%] right-[8%] w-20 h-6 bg-white/55 rounded-full blur-[0.5px]" />

        {/* Top Bar: Mode & Real Count */}
        <div className="relative z-10 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 bg-white/85 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm border border-white">
            <span className="text-sm leading-none">{emojis[0]}</span>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-900">
              {isMcq ? 'Bubble Quiz' : isAnagram ? 'Word Anagram' : 'Bubble Island'}
            </span>
          </div>
          <div className="w-7 h-7 rounded-full border-2 border-emerald-500 bg-white flex items-center justify-center shadow-sm shrink-0">
            <span className="text-[10px] font-black text-emerald-700">{totalCount}</span>
          </div>
        </div>

        {/* If MCQ mode, show the real question prompt cloud */}
        {isMcq && (
          <div className="relative z-10 mx-auto w-full bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm border border-white/80 text-center">
            <p className="text-[11px] font-extrabold text-slate-800 line-clamp-1 leading-tight">
              {firstQuestion}
            </p>
          </div>
        )}

        {/* Floating Glossy Word Bubbles showing exact words/options from the game */}
        <div className="relative flex-1 my-1">
          {displayBubbles.map((word, idx) => (
            <div
              key={idx}
              className={`absolute ${bubblePositions[idx % bubblePositions.length]} px-2.5 py-1 bg-gradient-to-br from-white/95 via-white/85 to-sky-100/90 rounded-full shadow-[0_4px_12px_rgba(14,116,144,0.18),inset_0_2px_4px_rgba(255,255,255,1)] border border-white flex items-center justify-center`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white absolute top-1 left-2 opacity-90" />
              <span className="text-xs font-black text-sky-950 tracking-tight max-w-[110px] truncate">
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Sandy Island Wave & Sentence Tray at Bottom showing exact sentence */}
        <div className="relative z-10 w-full bg-white/75 backdrop-blur-md rounded-2xl p-2 border border-white/90 shadow-md">
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <span className="text-[9px] font-black uppercase tracking-wider text-sky-800/80 truncate">
              {cleanTitle}
            </span>
            <span className="text-xs leading-none">{emojis[1]}</span>
          </div>
          <div className="bg-sky-950/10 rounded-lg px-2 py-1 flex items-center gap-1 overflow-hidden">
            <span className="text-[11px] font-bold text-slate-800 truncate">
              "{isMcq ? (secondQuestion || firstQuestion) : firstSentenceText}"
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. BUBBLE POP (bubble-pop)
  if (normalizedType === 'bubble-pop') {
    const bubbleColors = [
      'from-blue-400 via-blue-500 to-indigo-600 border-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]',
      'from-pink-400 via-rose-500 to-purple-600 border-pink-300 shadow-[0_0_15px_rgba(244,63,94,0.5)]',
      'from-emerald-400 via-teal-500 to-cyan-600 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)]',
      'from-amber-400 via-orange-500 to-red-500 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]',
    ];

    return (
      <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${palette.bgGradient} overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none`}>
        {/* Ambient glowing orbs */}
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-blue-500/30 rounded-full blur-xl" />
        <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-purple-500/30 rounded-full blur-xl" />

        {/* Header Row */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
            <span className="text-sm leading-none">{emojis[0]}</span>
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Bubble Pop</span>
          </div>
          <span className="text-[10px] font-extrabold text-cyan-200 bg-black/30 px-2 py-0.5 rounded-full border border-cyan-400/30">
            {totalCount} Qs
          </span>
        </div>

        {/* Exact Question Banner */}
        <div className="relative z-10 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-2 shadow-lg flex items-center gap-2">
          {customImage ? (
            <img
              src={customImage}
              alt=""
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-lg object-cover border border-white/40 shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-base shrink-0">
              {emojis[1]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-cyan-300 truncate">
              {cleanTitle}
            </div>
            <p className="text-[11px] font-extrabold text-white line-clamp-2 leading-tight">
              {firstQuestion}
            </p>
          </div>
        </div>

        {/* Floating Answer Bubbles with exact options from the game */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5 pt-0.5">
          {options.slice(0, 4).map((opt, idx) => {
            const isCorrect = idx === answerIndex;
            return (
              <div
                key={idx}
                className={`relative px-2.5 py-1.5 rounded-full bg-gradient-to-br ${bubbleColors[idx % bubbleColors.length]} border flex items-center justify-between gap-1 overflow-hidden`}
              >
                <div className="w-2 h-1 bg-white/60 rounded-full absolute top-1 left-2.5 rotate-[-15deg]" />
                <span className="text-[11px] font-black text-white truncate drop-shadow-sm">
                  {opt}
                </span>
                {isCorrect && (
                  <span className="text-[10px] bg-white text-slate-900 font-black px-1 rounded-full leading-tight shrink-0">
                    🫧
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2A. SLAP & CHOP (slap-and-chop)
  if (normalizedType === 'slap-and-chop' || normalizedType === 'slapandchop') {
    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none">
        {/* Glow & Sword Slash Arc */}
        <div className="absolute -top-6 -left-6 w-28 h-28 bg-purple-500/25 rounded-full blur-xl" />
        <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-cyan-500/25 rounded-full blur-xl" />
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg viewBox="0 0 200 120" className="w-full h-full">
            <path d="M 20 100 Q 100 40 180 20" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </div>

        {/* Header Row */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
            <span className="text-sm leading-none">🦟</span>
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Slap &amp; Chop</span>
          </div>
          <span className="text-[10px] font-extrabold text-purple-300 bg-black/40 px-2 py-0.5 rounded-full border border-purple-400/30">
            {totalCount} Qs
          </span>
        </div>

        {/* Question Banner */}
        <div className="relative z-10 bg-white/15 backdrop-blur-md border border-white/25 rounded-xl p-2 shadow-lg flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-base shadow-sm shrink-0">
            🤺
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wider text-purple-300 truncate">
              {cleanTitle}
            </div>
            <p className="text-[11px] font-extrabold text-white line-clamp-2 leading-tight">
              {firstQuestion}
            </p>
          </div>
        </div>

        {/* Floating Answer Options */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5 pt-0.5">
          {options.slice(0, 4).map((opt, idx) => {
            const isCorrect = idx === answerIndex;
            return (
              <div
                key={idx}
                className={`relative px-2.5 py-1.5 rounded-full border flex items-center justify-between gap-1 overflow-hidden ${
                  isCorrect
                    ? 'bg-gradient-to-r from-emerald-600/80 to-teal-600/80 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                    : 'bg-slate-900/80 border-white/20'
                }`}
              >
                <span className="text-[11px] font-black text-white truncate drop-shadow-sm">
                  {opt}
                </span>
                <span className="text-[10px] bg-white/20 text-white font-black px-1.5 py-0.5 rounded-full leading-tight shrink-0">
                  {idx === 0 ? '🍉' : idx === 1 ? '🥭' : idx === 2 ? '🫐' : '✨'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2B. SHARK ATTACK (shark-attack)
  if (normalizedType === 'shark-attack' || normalizedType === 'sharkattack') {
    const leftOpt = options[0] || 'Option A';
    const rightOpt = options[1] || 'Option B';

    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-sky-300 via-cyan-200 to-blue-600 overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none">
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 border border-sky-500/40 px-2.5 py-0.5 rounded-full shadow-xs">
            <span className="text-xs leading-none">🐹</span>
            <span className="text-[10px] font-black text-sky-900 uppercase tracking-wider">Shark Lagoon</span>
          </div>
          <span className="text-[10px] font-black text-sky-950 bg-white/85 px-2 py-0.5 rounded-full border border-sky-500/30">
            {totalCount} Qs
          </span>
        </div>

        {/* Question Banner */}
        <div className="relative z-10 bg-white/95 border-2 border-sky-400 rounded-xl px-2.5 py-1.5 shadow-md">
          <div className="flex items-center justify-between gap-1 text-[9px] font-black text-sky-700 uppercase tracking-wider">
            <span className="truncate">{cleanTitle}</span>
            <span>🦈</span>
          </div>
          <p className="text-[11px] font-black text-slate-900 line-clamp-1 leading-snug">
            {firstQuestion}
          </p>
        </div>

        {/* Hamsters on Stairs & Center Shark */}
        <div className="relative z-10 flex items-center justify-between px-3 my-0.5">
          <div className="px-2 py-1 rounded-lg bg-[#0055fe] text-white text-[10px] font-black shadow border border-white/50 flex items-center gap-1">
            <span>🐹</span>
            <span>BLUE</span>
          </div>
          <div className="text-xl drop-shadow">🦈</div>
          <div className="px-2 py-1 rounded-lg bg-[#cc0000] text-white text-[10px] font-black shadow border border-white/50 flex items-center gap-1">
            <span>RED</span>
            <span>🐹</span>
          </div>
        </div>

        {/* Blue & Red Team Answer Key Preview */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5">
          <div className="bg-[#0055fe] rounded-lg p-1 border-b-2 border-[#0038b3] flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-blue-100 text-[#0055fe] font-black text-[9px] flex items-center justify-center shrink-0">
              W
            </span>
            <span className="text-[10px] font-black text-white truncate">{leftOpt}</span>
          </div>
          <div className="bg-[#cc0000] rounded-lg p-1 border-b-2 border-[#990000] flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-red-100 text-[#cc0000] font-black text-[9px] flex items-center justify-center shrink-0">
              ↑
            </span>
            <span className="text-[10px] font-black text-white truncate">{rightOpt}</span>
          </div>
        </div>
      </div>
    );
  }

  // 3. SUMO (sumo)
  if (normalizedType === 'sumo' || normalizedType === 'sumo-tags') {
    const leftOpt = options[0] || 'Option A';
    const rightOpt = options[1] || 'Option B';

    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-sky-300 via-emerald-200 to-green-500 overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none">
        {/* Sunny Park Sumo Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/85 border border-emerald-500/40 px-2.5 py-0.5 rounded-full shadow-xs">
            <span className="text-xs leading-none">🐹</span>
            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Sumo Park</span>
          </div>
          <span className="text-[10px] font-black text-emerald-950 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-500/30">
            {totalCount} Qs
          </span>
        </div>

        {/* Exact Question Scroll Banner */}
        <div className="relative z-10 bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 border-2 border-amber-500 rounded-xl px-2.5 py-1.5 shadow-md">
          <div className="flex items-center justify-between gap-1 text-[9px] font-black text-amber-900/70 uppercase tracking-wider">
            <span className="truncate">{cleanTitle}</span>
            <span>{emojis[0]}</span>
          </div>
          <p className="text-[11px] font-black text-stone-900 line-clamp-1 leading-snug">
            {firstQuestion}
          </p>
        </div>

        {/* Sumo Dohyo Ring in Center */}
        <div className="relative z-10 flex items-center justify-center my-0.5">
          <div className="w-[88%] h-14 rounded-full border-4 border-amber-400 bg-gradient-to-b from-orange-200 to-amber-300 shadow-[0_4px_15px_rgba(245,158,11,0.35),inset_0_2px_6px_rgba(120,53,15,0.35)] flex items-center justify-between px-3 relative">
            {/* Inner ring lines */}
            <div className="absolute inset-2 rounded-full border border-amber-700/25 pointer-events-none" />
            <div className="flex items-center gap-1 z-10">
              <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-sm">
                🐹
              </div>
              <span className="text-[10px] font-black text-blue-950 uppercase">Blue</span>
            </div>

            <div className="z-10 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black tracking-wider shadow-sm border border-yellow-300">
              VS ⚡
            </div>

            <div className="flex items-center gap-1 z-10">
              <span className="text-[10px] font-black text-red-950 uppercase">Red</span>
              <div className="w-7 h-7 rounded-full bg-red-600 border-2 border-white shadow-md flex items-center justify-center text-sm">
                🐹
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Team Option Clash Bars showing exact game options */}
        <div className="relative z-10 grid grid-cols-2 gap-2">
          <div className="bg-blue-600 border-b-2 border-blue-800 rounded-lg px-2 py-1 text-center shadow-sm">
            <span className="block text-[11px] font-black text-white truncate">{leftOpt}</span>
          </div>
          <div className="bg-red-600 border-b-2 border-red-800 rounded-lg px-2 py-1 text-center shadow-sm">
            <span className="block text-[11px] font-black text-white truncate">{rightOpt}</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. YOGA QUIZ (yoga-quiz)
  if (normalizedType === 'yoga-quiz' || normalizedType === 'yoga') {
    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-emerald-900 via-teal-800 to-slate-900 overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none">
        {/* Subtle background image blend if info.icon exists */}
        {info?.icon && (
          <img
            src={info.icon}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-25 mix-blend-luminosity scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-teal-950/55 to-emerald-950/40" />

        {/* Top Zen Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-emerald-400/20 backdrop-blur-md border border-emerald-300/40 px-2.5 py-1 rounded-full">
            <span className="text-sm leading-none">🧘</span>
            <span className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">Yoga Quiz</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/15">
            <span className="text-xs leading-none">{emojis[0]}</span>
            <span className="text-[10px] font-extrabold text-emerald-200">{totalCount} Qs</span>
          </div>
        </div>

        {/* Center Question Card with Exact Content */}
        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-lg border border-emerald-200/80">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 truncate">
              {cleanTitle}
            </span>
            <span className="text-xs leading-none">{emojis[1]}</span>
          </div>
          <p className="text-[11px] font-extrabold text-slate-800 line-clamp-2 leading-tight">
            {firstQuestion}
          </p>
        </div>

        {/* Bottom Options Row */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5">
          {options.slice(0, 4).map((opt, idx) => {
            const isCorrect = idx === answerIndex;
            return (
              <div
                key={idx}
                className={`px-2 py-1 rounded-lg border text-[10px] font-extrabold truncate flex items-center gap-1 ${
                  isCorrect
                    ? 'bg-emerald-500 text-white border-emerald-300 shadow-sm'
                    : 'bg-white/85 text-slate-800 border-white/60'
                }`}
              >
                <span className="opacity-75 font-black">{String.fromCharCode(65 + idx)}.</span>
                {typeof opt === 'string' && (opt.startsWith('http') || opt.startsWith('data:image')) ? (
                  <span className="inline-flex items-center gap-1 truncate">
                    <img src={opt} alt="" className="w-3.5 h-3.5 rounded object-cover inline shrink-0" />
                    <span>Picture</span>
                  </span>
                ) : (
                  <span className="truncate">{opt}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 5. MYSTERY BOX (mystery-box)
  if (normalizedType === 'mystery-box') {
    const boxColors = [
      'from-blue-500 to-blue-600 border-blue-300',
      'from-amber-400 to-orange-500 border-yellow-200 ring-2 ring-yellow-300/60',
      'from-emerald-500 to-teal-600 border-emerald-300',
      'from-rose-500 to-pink-600 border-rose-300',
    ];

    return (
      <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${palette.bgGradient} overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none`}>
        {/* Top Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 px-2.5 py-0.5 rounded-full">
            <span className="text-xs leading-none">🎁</span>
            <span className="text-[10px] font-black text-amber-200 uppercase tracking-wider">Mystery Box</span>
          </div>
          <span className="text-[10px] font-black text-amber-200 bg-black/35 px-2 py-0.5 rounded-full border border-amber-400/30">
            {totalCount} Boxes
          </span>
        </div>

        {/* Exact Question & Options Preview Card */}
        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-xl p-2 shadow-md border border-white/80">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 truncate">
              {cleanTitle}
            </span>
            <span className="text-xs leading-none">{emojis[0]}</span>
          </div>
          <p className="text-[11px] font-extrabold text-slate-900 line-clamp-1 leading-tight mb-1">
            {firstQuestion}
          </p>
          <div className="flex items-center gap-1 overflow-hidden">
            {options.slice(0, 3).map((opt, idx) => (
              <span
                key={idx}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded truncate ${
                  idx === answerIndex
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {opt}
              </span>
            ))}
          </div>
        </div>

        {/* 4 Interactive-style Mystery Boxes at Bottom */}
        <div className="relative z-10 grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((num, idx) => (
            <div
              key={num}
              className={`h-11 rounded-xl bg-gradient-to-b ${boxColors[idx]} border shadow-md flex flex-col items-center justify-center relative overflow-hidden`}
            >
              {idx === 1 ? (
                <>
                  <span className="text-[10px] leading-none">✨🎁</span>
                  <span className="text-[9px] font-black text-white drop-shadow">+500</span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-bold text-white/80 uppercase leading-none">Box</span>
                  <span className="text-sm font-black text-white leading-tight">{num}</span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. FAMILY FEUD (family-feud)
  if (normalizedType === 'family-feud') {
    const displayAnswers = feudAnswers.length > 0
      ? feudAnswers.slice(0, 4)
      : options.slice(0, 4).map((opt, idx) => ({ text: opt, points: [40, 25, 20, 15][idx] || 10 }));

    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-blue-950 via-indigo-950 to-slate-950 overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none border-4 border-amber-400/80">
        {/* Survey Header */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-sm">
            <span className="text-xs leading-none">🔔</span>
            <span className="text-[10px] font-black uppercase tracking-wider">Family Feud</span>
          </div>
          <span className="text-[10px] font-black text-amber-300">{emojis[0]} {totalCount} Rounds</span>
        </div>

        {/* Survey Question Prompt */}
        <div className="relative z-10 bg-blue-900/90 border border-amber-400/60 rounded-xl px-2.5 py-1.5 text-center shadow-inner">
          <p className="text-[11px] font-black text-white line-clamp-1">
            {firstQuestion}
          </p>
        </div>

        {/* 4 Survey Flip Slots with Exact Answers & Points */}
        <div className="relative z-10 grid grid-cols-2 gap-1.5">
          {displayAnswers.map((ans, idx) => (
            <div
              key={idx}
              className="bg-gradient-to-b from-blue-800 to-blue-950 border border-amber-400/70 rounded-lg px-2 py-1 flex items-center justify-between gap-1 shadow-sm"
            >
              <span className="text-[10px] font-black text-white truncate">
                {idx + 1}. {ans.text}
              </span>
              <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-1 rounded shrink-0">
                {ans.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 7. FLASHCARDS MATCH (flashcards-match)
  if (normalizedType === 'flashcards-match') {
    const cardItems = content.rawCards.length > 0
      ? content.rawCards.slice(0, 2).flatMap((c: any) => [c.front, c.back]).filter(Boolean)
      : options.slice(0, 4);

    return (
      <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${palette.bgGradient} overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none`}>
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/25">
            <span className="text-xs leading-none">🎴</span>
            <span className="text-[10px] font-black text-white uppercase tracking-wider">Flashcards</span>
          </div>
          <span className="text-[10px] font-black text-indigo-200 bg-black/30 px-2 py-0.5 rounded-full">
            {totalCount} Cards
          </span>
        </div>

        <div className="relative z-10 text-center">
          <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider block truncate">
            {cleanTitle}
          </span>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-2">
          {cardItems.slice(0, 4).map((item: string, idx: number) => (
            <div
              key={idx}
              className={`bg-white rounded-xl p-2 shadow-md border-2 ${
                idx < 2 ? 'border-emerald-400' : 'border-indigo-200'
              } flex items-center justify-between gap-1`}
            >
              <span className="text-[11px] font-black text-slate-800 truncate">{item}</span>
              <span className="text-xs shrink-0">{emojis[idx % emojis.length]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 8. HAMSTER POP QUIZ (hamster-pop-quiz)
  if (normalizedType === 'hamster-pop-quiz') {
    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-sky-400 via-cyan-300 to-amber-200 flex flex-col justify-between p-3 pointer-events-none select-none overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-white/90 px-2.5 py-0.5 rounded-full shadow-sm">
            <span className="text-sm leading-none">🐹</span>
            <span className="text-[10px] font-black text-sky-900 uppercase tracking-wider">Video Pop Quiz</span>
          </div>
          <span className="text-[10px] font-black text-sky-950 bg-white/75 px-2 py-0.5 rounded-full">
            {totalCount} Qs
          </span>
        </div>

        <div className="bg-white/95 rounded-2xl p-2.5 shadow-md border border-white">
          <div className="text-[9px] font-black text-sky-700 uppercase tracking-wider truncate mb-0.5">
            {cleanTitle}
          </div>
          <p className="text-[11px] font-extrabold text-slate-900 line-clamp-2 leading-tight">
            {firstQuestion}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {options.slice(0, 2).map((opt, idx) => (
            <div key={idx} className="bg-sky-900/90 text-white rounded-lg px-2 py-1 text-[10px] font-bold truncate text-center">
              {opt}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 9. TIC TAC TOE (tic-tac-toe)
  if (normalizedType === 'tic-tac-toe') {
    return (
      <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col justify-between p-3 pointer-events-none select-none overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-full">
            ❌⭕ Tic Tac Toe
          </span>
          <span className="text-[10px] font-bold text-slate-300 truncate max-w-[110px]">{cleanTitle}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 w-28 aspect-square mx-auto bg-slate-700 p-1 rounded-xl shadow-lg">
          <div className="bg-slate-800 rounded flex items-center justify-center text-blue-400 font-black text-base">X</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-rose-400 font-black text-base">O</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold truncate px-0.5">{options[0] || 'Q1'}</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-rose-400 font-black text-base">O</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-blue-400 font-black text-base">X</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold truncate px-0.5">{options[1] || 'Q2'}</div>
          <div className="bg-slate-800 rounded flex items-center justify-center text-[9px] text-slate-300 font-bold truncate px-0.5">{options[2] || 'Q3'}</div>
          <div className="bg-slate-800 rounded" />
          <div className="bg-slate-800 rounded flex items-center justify-center text-blue-400 font-black text-base">X</div>
        </div>
      </div>
    );
  }

  // 10. NEON CHAIN (neon-chain)
  if (normalizedType === 'neon-chain') {
    const w1 = (options[0] || 'SMART').toUpperCase();
    const w2 = (options[1] || `${w1.slice(-1)}EACHER`).toUpperCase();
    return (
      <div className="absolute inset-0 w-full h-full bg-slate-950 flex flex-col justify-between p-3 pointer-events-none select-none overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">⚡ Neon Chain</span>
          <span className="text-xs">{emojis[0]}</span>
        </div>
        <div className="flex flex-col items-center gap-1.5 my-auto">
          <div className="px-3 py-1 rounded-full border border-cyan-400 bg-cyan-950/90 text-xs text-cyan-300 font-black tracking-widest shadow-[0_0_12px_rgba(6,182,212,0.5)]">
            {w1}
          </div>
          <div className="w-0.5 h-2.5 bg-gradient-to-b from-cyan-400 to-fuchsia-400" />
          <div className="px-3 py-1 rounded-full border border-fuchsia-400 bg-fuchsia-950/90 text-xs text-fuchsia-300 font-black tracking-widest shadow-[0_0_12px_rgba(217,70,239,0.5)]">
            {w2}
          </div>
        </div>
        <div className="text-[10px] font-bold text-slate-400 text-center truncate">{cleanTitle}</div>
      </div>
    );
  }

  // 11. SQUID GAME PICKER (squid-game-picker)
  if (normalizedType === 'squid-game-picker') {
    const src = info?.imageUrl || info?.icon || '/images/name-picker-card.png';
    return (
      <img
        src={src}
        referrerPolicy="no-referrer"
        alt={info?.title || cleanTitle}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    );
  }

  // 12. GENERIC / OTHER GAME TYPES WITH REAL CONTENT PREVIEW
  return (
    <div className={`absolute inset-0 w-full h-full bg-gradient-to-br ${palette.bgGradient} overflow-hidden flex flex-col justify-between p-3 pointer-events-none select-none`}>
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/25">
          <span className="text-xs leading-none">{emojis[0]}</span>
          <span className="text-[10px] font-black text-white uppercase tracking-wider truncate max-w-[120px]">
            {info?.title || normalizedType.replace(/-/g, ' ') || 'ESL Game'}
          </span>
        </div>
        <span className="text-[10px] font-extrabold text-white/90 bg-black/30 px-2 py-0.5 rounded-full">
          {totalCount} Items
        </span>
      </div>

      <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-md">
        <div className="text-[9px] font-black uppercase tracking-wider text-indigo-700 truncate mb-0.5">
          {cleanTitle}
        </div>
        <p className="text-[11px] font-extrabold text-slate-900 line-clamp-2 leading-tight">
          {firstQuestion}
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-1.5">
        {options.slice(0, 4).map((opt, idx) => (
          <div
            key={idx}
            className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-lg px-2 py-1 text-[10px] font-bold text-white truncate text-center"
          >
            {opt}
          </div>
        ))}
      </div>
    </div>
  );
};
