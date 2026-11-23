import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  BookOpen,
  Presentation,
  Share2,
  ClipboardCheck,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  CheckCircle2,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MessageSquareText,
  Gamepad2,
  Sparkles,
  Check,
  HelpCircle,
} from 'lucide-react';
import {
  GameModeModal,
  PlayableGameMode,
  PLAYABLE_GAME_OPTIONS,
  detectOriginalGameMode,
} from './GameModeModal';
import { CreateHomeworkModal } from './CreateHomeworkModal';
import { GameThumbnail } from './GameThumbnail';
import { isInterchangeableGame } from '../utils/gameTabLauncher';

export interface GamePreviewHubProps {
  gameData: any;
  publishedGames?: Record<string, boolean>;
  onLaunchMode: (mode: string, adaptedGameData: any) => void;
}

interface NormalizedPreviewQuestion {
  id: string | number;
  index: number;
  prompt: string;
  image: string;
  answerText: string;
  answerImage: string;
  options: string[];
  optionImages: string[];
  answerIndex: number;
  points: number;
  explanation?: string;
}

function splitEmbeddedMedia(rawVal: any): { text: string; media: string } {
  if (!rawVal || typeof rawVal !== 'string') return { text: '', media: '' };
  const trimmed = rawVal.trim();
  if (trimmed.includes('|||')) {
    const parts = trimmed
      .split('|||')
      .map((p) => p.trim())
      .filter(Boolean);
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

function deriveNumericGameCode(rawId: any, title: string): string {
  const source = `${String(rawId || '')}_${title || 'game'}`;
  const digitsOnly = String(rawId || '').replace(/\D/g, '');
  if (digitsOnly.length >= 6) {
    return digitsOnly.slice(-6);
  }
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash) % 900000;
  return String(100000 + positive);
}

export function normalizePreviewQuestions(gameData: any): NormalizedPreviewQuestion[] {
  if (!gameData) return [];

  const rawList =
    (Array.isArray(gameData.customQuestions) && gameData.customQuestions.length > 0
      ? gameData.customQuestions
      : null) ||
    (Array.isArray(gameData.questions) && gameData.questions.length > 0
      ? gameData.questions
      : null) ||
    (Array.isArray(gameData.cards) && gameData.cards.length > 0 ? gameData.cards : null) ||
    (Array.isArray(gameData.customSentences) && gameData.customSentences.length > 0
      ? gameData.customSentences
      : null) ||
    (Array.isArray(gameData.sentences) && gameData.sentences.length > 0
      ? gameData.sentences
      : null) ||
    (Array.isArray(gameData.items) && gameData.items.length > 0 ? gameData.items : null) ||
    [];

  return rawList.map((item: any, idx: number) => {
    const rawPrompt =
      item?.text ??
      item?.question ??
      item?.frontText ??
      item?.front ??
      item?.sentence ??
      item?.word ??
      `Question ${idx + 1}`;
    const parsedPrompt = splitEmbeddedMedia(String(rawPrompt));

    const promptImage =
      item?.image ||
      item?.imageUrl ||
      item?.frontMedia ||
      item?.mediaUrl ||
      parsedPrompt.media ||
      '';

    let options: string[] = [];
    let optionImages: string[] = Array.isArray(item?.optionImages)
      ? item.optionImages.map((img: any) => (typeof img === 'string' ? img : ''))
      : [];

    if (Array.isArray(item?.options) && item.options.length > 0) {
      item.options.forEach((opt: any, optIdx: number) => {
        const rawOpt = typeof opt === 'string' ? opt : opt?.text || '';
        const parsedOpt = splitEmbeddedMedia(rawOpt);
        options.push(parsedOpt.text || (parsedOpt.media ? `Option ${optIdx + 1}` : ''));
        if (parsedOpt.media && !optionImages[optIdx]) {
          optionImages[optIdx] = parsedOpt.media;
        }
      });
    } else if (Array.isArray(item?.answers) && item.answers.length > 0) {
      item.answers.forEach((ans: any, ansIdx: number) => {
        const rawAns = typeof ans === 'string' ? ans : ans?.text || '';
        const parsedAns = splitEmbeddedMedia(rawAns);
        if (parsedAns.text || parsedAns.media) {
          options.push(parsedAns.text || `Answer ${ansIdx + 1}`);
        }
      });
    }

    const foundCorrectObjIdx = Array.isArray(item?.options)
      ? item.options.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect))
      : -1;

    let answerIndex =
      typeof item?.answerIndex === 'number'
        ? item.answerIndex
        : typeof item?.correctIndex === 'number'
        ? item.correctIndex
        : typeof item?.correct === 'number'
        ? item.correct
        : foundCorrectObjIdx >= 0
        ? foundCorrectObjIdx
        : 0;

    if (answerIndex < 0 || (options.length > 0 && answerIndex >= options.length)) {
      answerIndex = 0;
    }

    const rawBack =
      item?.backText ??
      item?.back ??
      item?.answer ??
      (options.length > 0 ? options[answerIndex] : '');
    const parsedBack = splitEmbeddedMedia(String(rawBack || ''));

    const answerImage =
      item?.backMedia ||
      parsedBack.media ||
      (optionImages[answerIndex] ? optionImages[answerIndex] : '') ||
      '';

    const answerText =
      parsedBack.text ||
      (options.length > 0 ? options[answerIndex] : '') ||
      (typeof item?.answer === 'string' ? item.answer : '') ||
      'Answer';

    if (options.length === 0 && answerText) {
      options = [answerText];
      answerIndex = 0;
    }

    const rawPoints =
      typeof item?.points === 'number'
        ? item.points
        : typeof item?.xp === 'number'
        ? item.xp
        : Array.isArray(item?.answers) && typeof item.answers[0]?.points === 'number'
        ? item.answers[0].points
        : 15;

    return {
      id: item?.id ?? idx + 1,
      index: idx,
      prompt: parsedPrompt.text || (promptImage ? `Question ${idx + 1}` : String(rawPrompt)),
      image: promptImage,
      answerText,
      answerImage,
      options,
      optionImages,
      answerIndex,
      points: rawPoints || 15,
      explanation: item?.explanation || '',
    };
  });
}

export function adaptGamePayloadForTargetMode(
  gameData: any,
  targetType: PlayableGameMode | string,
  originalModeId: PlayableGameMode
): any {
  const gameTitle = gameData?.topic || gameData?.name || gameData?.title || 'Custom Quiz';
  const normalizedPreview = normalizePreviewQuestions(gameData);

  const normalizedQuestions = normalizedPreview.map((nq, idx) => {
    const opts = nq.options.length >= 2 ? nq.options : [nq.answerText || 'Yes', 'No'];
    const ansIdx = nq.answerIndex >= 0 && nq.answerIndex < opts.length ? nq.answerIndex : 0;

    const feudAnswers = [
      { text: opts[ansIdx], points: 50, aliases: [opts[ansIdx].toLowerCase()] },
      ...opts
        .filter((_, i) => i !== ansIdx)
        .map((optText, i) => ({
          text: optText,
          points: Math.max(10, 30 - i * 10),
          aliases: [optText.toLowerCase()],
        })),
    ];

    return {
      id: nq.id || idx + 1,
      text: nq.prompt,
      question: nq.prompt,
      options: opts,
      answerIndex: ansIdx,
      correct: ansIdx,
      answers: feudAnswers,
      ...(nq.explanation ? { explanation: nq.explanation } : {}),
      ...(nq.optionImages.length > 0 ? { optionImages: nq.optionImages } : {}),
      ...(nq.image ? { image: nq.image, imageUrl: nq.image } : {}),
    };
  });

  const flashcardPairs = normalizedPreview.map((nq, idx) => ({
    id: nq.id || idx + 1,
    front: nq.prompt || nq.image,
    back: nq.answerText || nq.answerImage || 'Answer',
    frontText: nq.prompt,
    backText: nq.answerText,
    frontMedia: nq.image,
    backMedia: nq.answerImage,
  }));

  return {
    ...gameData,
    id: gameData?.id || Date.now(),
    topic: gameTitle,
    name: gameTitle,
    title: gameTitle,
    className: gameData?.className || gameData?.classLevel || '',
    classLevel: gameData?.classLevel || gameData?.className || '',
    originalGameType: originalModeId,
    gameType: targetType,
    mode: targetType === 'bubble-sentence-pro' ? 'multiple-choice' : gameData?.mode || 'word',
    customQuestions: normalizedQuestions,
    questions: normalizedQuestions,
    customSentences: normalizedQuestions,
    sentences: normalizedQuestions,
    cards: flashcardPairs,
    editMode: false,
  };
}

export function GamePreviewHub({
  gameData,
  publishedGames = {},
  onLaunchMode,
}: GamePreviewHubProps) {
  const [viewFormat, setViewFormat] = useState<'prompt-only' | 'multiple-choice'>('prompt-only');
  const [showAllAnswers, setShowAllAnswers] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string | number>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [speakingId, setSpeakingId] = useState<string | number | null>(null);
  const [isModeSelectorOpen, setIsModeSelectorOpen] = useState(false);
  const [isHomeworkModalOpen, setIsHomeworkModalOpen] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState<number | null>(null);
  const [slideshowAnswerShown, setSlideshowAnswerShown] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const originalModeId = useMemo(() => detectOriginalGameMode(gameData), [gameData]);
  const originalModeOption = useMemo(
    () =>
      PLAYABLE_GAME_OPTIONS.find((opt) => opt.id === originalModeId) || PLAYABLE_GAME_OPTIONS[0],
    [originalModeId]
  );

  const gameTitle = gameData?.topic || gameData?.name || gameData?.title || 'Untitled Game';
  const classLevel = gameData?.className || gameData?.classLevel || 'General';
  const creatorLabel =
    gameData?.creatorName ||
    (gameData?.creatorEmail ? String(gameData.creatorEmail).split('@')[0] : 'Teacher');
  const gameCode = useMemo(
    () => deriveNumericGameCode(gameData?.id, gameTitle),
    [gameData?.id, gameTitle]
  );

  const questions = useMemo(() => normalizePreviewQuestions(gameData), [gameData]);

  const filteredQuestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return questions;
    return questions.filter(
      (item) =>
        item.prompt.toLowerCase().includes(q) ||
        item.answerText.toLowerCase().includes(q) ||
        item.options.some((opt) => opt.toLowerCase().includes(q))
    );
  }, [questions, searchQuery]);

  // Cancel any speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Keyboard shortcuts when Slideshow presenter is open
  useEffect(() => {
    if (slideshowIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSlideshowIndex(null);
        setSlideshowAnswerShown(false);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSlideshowAnswerShown(false);
        setSlideshowIndex((prev) =>
          prev === null ? null : (prev + 1) % Math.max(1, questions.length)
        );
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSlideshowAnswerShown(false);
        setSlideshowIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + Math.max(1, questions.length)) % Math.max(1, questions.length)
        );
      } else if (e.key === ' ') {
        e.preventDefault();
        setSlideshowAnswerShown((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slideshowIndex, questions.length]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  const handleToggleCardReveal = (id: string | number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAllAnswers = () => {
    if (showAllAnswers) {
      setShowAllAnswers(false);
      setRevealedIds(new Set());
    } else {
      setShowAllAnswers(true);
    }
  };

  const handleSpeakQuestion = (
    e: React.MouseEvent,
    item: NormalizedPreviewQuestion,
    isRevealed: boolean
  ) => {
    e.stopPropagation();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      showToast('Speech synthesis is not supported in this browser.');
      return;
    }

    if (speakingId === item.id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const textToRead = isRevealed
      ? `${item.prompt}. Answer: ${item.answerText}`
      : item.prompt;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    setSpeakingId(item.id);
    window.speechSynthesis.speak(utterance);
  };

  const handleClickPlay = () => {
    if (isInterchangeableGame(gameData)) {
      setIsModeSelectorOpen(true);
    } else {
      const mode = gameData?.gameType || 'mystery-box';
      onLaunchMode(mode, { ...gameData, gameType: mode, editMode: false });
    }
  };

  const handleClickStudy = () => {
    const adapted = adaptGamePayloadForTargetMode(
      gameData,
      'flashcards-match',
      originalModeId
    );
    onLaunchMode('flashcards-match', adapted);
  };

  const handleClickSlideshow = () => {
    if (questions.length === 0) {
      showToast('No questions available for slideshow.');
      return;
    }
    setSlideshowAnswerShown(false);
    setSlideshowIndex(0);
  };

  const handleClickShare = async () => {
    try {
      const url = new URL(window.location.href);
      if (gameData?.id) {
        url.searchParams.set('playGame', String(gameData.id));
      }
      const shareUrl = url.toString();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast(`Game link & Code #${gameCode} copied to clipboard!`);
      } else {
        showToast(`Game Code: #${gameCode}`);
      }
    } catch {
      showToast(`Game Code: #${gameCode}`);
    }
  };

  const activeSlide =
    slideshowIndex !== null && questions[slideshowIndex] ? questions[slideshowIndex] : null;

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[130] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-xl border border-slate-700/80 dark:border-slate-200 text-sm font-extrabold flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check size={16} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Game Mode Selector Modal */}
      <GameModeModal
        isOpen={isModeSelectorOpen}
        onClose={() => setIsModeSelectorOpen(false)}
        gameData={gameData}
        publishedGames={publishedGames}
        onSelectMode={(mode, adaptedData) => {
          setIsModeSelectorOpen(false);
          onLaunchMode(mode, adaptedData);
        }}
      />

      {/* Create Homework Modal */}
      <CreateHomeworkModal
        isOpen={isHomeworkModalOpen}
        game={gameData}
        onClose={() => setIsHomeworkModalOpen(false)}
        onCreated={(assignment) => {
          showToast(`Homework assigned! Student PIN: ${assignment.pinCode}`);
        }}
      />

      {/* Full-Screen Interactive Smartboard Slideshow Presenter */}
      {activeSlide && (
        <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-xl text-white flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-150">
          {/* Slideshow Top Bar */}
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-3 py-1.5 rounded-xl bg-slate-800 text-emerald-400 font-black text-sm tabular-nums shrink-0">
                Slide {(slideshowIndex ?? 0) + 1} / {questions.length}
              </span>
              <h3
                className="font-extrabold text-base sm:text-lg text-slate-200 truncate"
                data-no-translate
              >
                {gameTitle}
              </h3>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={(e) => handleSpeakQuestion(e, activeSlide, slideshowAnswerShown)}
                className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer ${
                  speakingId === activeSlide.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <Volume2 size={16} />
                <span>Read Aloud</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSlideshowIndex(null);
                  setSlideshowAnswerShown(false);
                }}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
                title="Exit Slideshow (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Slideshow Stage */}
          <div className="max-w-5xl w-full mx-auto flex-1 flex flex-col items-center justify-center gap-6 py-6 overflow-y-auto">
            {activeSlide.image && (
              <div className="w-full max-w-2xl max-h-[44vh] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
                <img
                  src={activeSlide.image}
                  alt={activeSlide.prompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-full max-h-[44vh] object-contain"
                />
              </div>
            )}

            <h2
              className="text-2xl sm:text-4xl lg:text-5xl font-black text-center leading-tight tracking-tight text-white max-w-4xl"
              data-no-translate
            >
              {activeSlide.prompt}
            </h2>

            {viewFormat === 'multiple-choice' && activeSlide.options.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-3xl mt-2">
                {activeSlide.options.map((opt, oIdx) => {
                  const isCorrect = oIdx === activeSlide.answerIndex;
                  const letter = String.fromCharCode(65 + oIdx);
                  return (
                    <div
                      key={oIdx}
                      className={`px-5 py-3.5 rounded-2xl border-2 font-extrabold text-base sm:text-lg flex items-center gap-3 transition-all ${
                        slideshowAnswerShown && isCorrect
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg'
                          : 'bg-slate-900/90 border-slate-800 text-slate-200'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                          slideshowAnswerShown && isCorrect
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="truncate" data-no-translate>
                        {opt}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Answer Reveal Banner */}
            <div className="mt-2">
              {slideshowAnswerShown ? (
                <div
                  onClick={() => setSlideshowAnswerShown(false)}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-200 font-black text-lg sm:text-2xl flex items-center gap-3 cursor-pointer shadow-lg"
                >
                  <CheckCircle2 size={24} className="text-emerald-400 shrink-0" />
                  <span data-no-translate>{activeSlide.answerText}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSlideshowAnswerShown(true)}
                  className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-extrabold text-base sm:text-lg flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Eye size={20} className="text-emerald-400" />
                  <span>Reveal Answer (Space)</span>
                </button>
              )}
            </div>
          </div>

          {/* Slideshow Bottom Navigation */}
          <div className="max-w-6xl w-full mx-auto flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSlideshowAnswerShown(false);
                setSlideshowIndex((prev) =>
                  prev === null
                    ? null
                    : (prev - 1 + Math.max(1, questions.length)) %
                      Math.max(1, questions.length)
                );
              }}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <ChevronLeft size={18} />
              <span>Previous</span>
            </button>

            <span className="text-xs sm:text-sm font-semibold text-slate-400 hidden sm:inline">
              Use ← / → arrow keys to navigate · Space to reveal answer
            </span>

            <button
              type="button"
              onClick={() => {
                setSlideshowAnswerShown(false);
                setSlideshowIndex((prev) =>
                  prev === null ? null : (prev + 1) % Math.max(1, questions.length)
                );
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Next</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STICKY TOP COMMAND DECK */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
          {/* Tier 1: Game Identity + Primary Classroom Actions */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Thumbnail + Title + Clean Unboxed Metadata */}
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                <GameThumbnail
                  gameType={gameData?.gameType || originalModeId}
                  info={{
                    title: originalModeOption?.title || 'Game',
                    icon: originalModeOption?.image || '/images/mystery-box-card.jpg?v=3',
                  }}
                  game={gameData}
                  compact={true}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">
                  <Gamepad2 size={14} className="shrink-0" />
                  <span>Game Preview</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Code #{gameCode}</span>
                </div>

                <h1
                  className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate"
                  data-no-translate
                >
                  {gameTitle}
                </h1>

                {/* Clean Unboxed Metadata with Typographic Separators */}
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1 flex-wrap tabular-nums">
                  <span className="text-slate-700 dark:text-slate-200 font-bold" data-no-translate>
                    {classLevel}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {questions.length} {questions.length === 1 ? 'Question' : 'Questions'}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Built for{' '}
                    <strong className="text-slate-700 dark:text-slate-200" data-no-translate>
                      {originalModeOption?.title || 'Mystery Box'}
                    </strong>
                  </span>
                  {creatorLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>By {creatorLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Primary Classroom Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
              <button
                type="button"
                onClick={handleClickPlay}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:translate-y-0.5 text-white font-black text-sm sm:text-base shadow-[0_4px_0_#065f46] hover:shadow-[0_4px_0_#047857] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Play size={18} className="fill-current shrink-0" />
                <span>Play</span>
              </button>

              <button
                type="button"
                onClick={handleClickStudy}
                className="px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 active:translate-y-0.5 text-white font-extrabold text-sm shadow-[0_4px_0_#0369a1] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                title="Open in 3D Flashcards & Match Study Mode"
              >
                <BookOpen size={17} className="shrink-0" />
                <span>Study</span>
              </button>

              <button
                type="button"
                onClick={handleClickSlideshow}
                className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 text-white font-extrabold text-sm shadow-[0_4px_0_#3730a3] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                title="Present full-screen smartboard slideshow"
              >
                <Presentation size={17} className="shrink-0" />
                <span>Slideshow</span>
              </button>

              <button
                type="button"
                onClick={() => setIsHomeworkModalOpen(true)}
                className="px-4 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:translate-y-0.5 text-slate-950 font-extrabold text-sm shadow-[0_4px_0_#b45309] transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                title="Assign as student homework with 6-digit PIN"
              >
                <ClipboardCheck size={17} className="shrink-0" />
                <span>Homework</span>
              </button>

              <button
                type="button"
                onClick={handleClickShare}
                className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                title="Copy game link and code"
              >
                <Share2 size={16} className="shrink-0" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Tier 2: View Switcher (Question Only vs Multiple Choice) + Global Show/Hide Answers + Quick Search */}
          <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Segmented View Format Switcher */}
              <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewFormat('prompt-only')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    viewFormat === 'prompt-only'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <MessageSquareText size={15} />
                  <span>Question Only</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewFormat('multiple-choice')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    viewFormat === 'multiple-choice'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ListChecks size={15} />
                  <span>Multiple Choice</span>
                </button>
              </div>

              {/* Global Show / Hide Answers Toggle */}
              <button
                type="button"
                onClick={handleToggleAllAnswers}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold border flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  showAllAnswers
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                }`}
              >
                {showAllAnswers ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>{showAllAnswers ? 'Hide All Answers' : 'Show All Answers'}</span>
              </button>

              {!showAllAnswers && revealedIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setRevealedIds(new Set())}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline cursor-pointer whitespace-nowrap"
                >
                  Hide {revealedIds.size} revealed
                </button>
              )}
            </div>

            {/* Quick Question Filter Search */}
            <div className="relative w-full sm:w-64 md:w-72">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions or answers..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* INTERACTIVE QUESTION GRID */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1">
        {filteredQuestions.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-12 text-center max-w-lg mx-auto my-8 shadow-xs">
            <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">
              {searchQuery ? 'No matching questions found' : 'No questions in this game yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {searchQuery
                ? 'Try clearing your search filter or click Play to launch the game.'
                : 'Click Play above to open the game mode selector.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredQuestions.map((item) => {
              const isRevealed = showAllAnswers || revealedIds.has(item.id);
              const isSpeaking = speakingId === item.id;

              return (
                <article
                  key={item.id}
                  onClick={() => handleToggleCardReveal(item.id)}
                  className={`group bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 flex flex-col overflow-hidden cursor-pointer select-none ${
                    isRevealed
                      ? 'border-emerald-300 dark:border-emerald-700/80 shadow-md'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.05)] hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  {/* Card Top Bar: Question Number + Points + Audio TTS Button */}
                  <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40">
                    <div className="flex items-center gap-2 text-xs font-extrabold tabular-nums">
                      <span className="text-slate-900 dark:text-white">
                        #{String(item.index + 1).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <Sparkles size={12} className="shrink-0" />
                        <span>{item.points} pts</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleSpeakQuestion(e, item, isRevealed)}
                      title={isSpeaking ? 'Stop reading' : 'Read question aloud'}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                        isSpeaking
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
                      }`}
                    >
                      {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
                    </button>
                  </div>

                  {/* Question Media / GIF Preview (if present) */}
                  {item.image && (
                    <div className="w-full aspect-[4/3] bg-slate-100 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 overflow-hidden relative flex items-center justify-center">
                      <img
                        src={item.image}
                        alt={item.prompt}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    </div>
                  )}

                  {/* Question Prompt + Optional Multiple Choice List */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <h3
                        className="font-extrabold text-base sm:text-[17px] text-slate-900 dark:text-white leading-snug"
                        data-no-translate
                      >
                        {item.prompt}
                      </h3>

                      {viewFormat === 'multiple-choice' && item.options.length > 1 && (
                        <div className="space-y-1.5 pt-1">
                          {item.options.map((opt, oIdx) => {
                            const isCorrect = oIdx === item.answerIndex;
                            const letter = String.fromCharCode(65 + oIdx);
                            return (
                              <div
                                key={oIdx}
                                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2.5 border transition-colors ${
                                  isRevealed && isCorrect
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/70 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md text-[11px] font-black flex items-center justify-center shrink-0 ${
                                    isRevealed && isCorrect
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="truncate" data-no-translate>
                                  {opt}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Click-to-Reveal Answer Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {isRevealed ? (
                        <div className="flex flex-col gap-2">
                          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-start gap-2">
                            <CheckCircle2
                              size={16}
                              className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="block text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                Correct Answer
                              </span>
                              <p
                                className="text-sm font-black text-emerald-950 dark:text-emerald-100 break-words"
                                data-no-translate
                              >
                                {item.answerText}
                              </p>
                            </div>
                          </div>

                          {item.answerImage && item.answerImage !== item.image && (
                            <div className="w-full h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-emerald-200/70 dark:border-emerald-800/60">
                              <img
                                src={item.answerImage}
                                alt={item.answerText}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors py-1">
                          <span className="flex items-center gap-1.5">
                            <Eye size={14} />
                            <span>Click card to reveal answer</span>
                          </span>
                          <span className="text-[11px] font-semibold opacity-75">Reveal</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
