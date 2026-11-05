import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  BookOpen,
  Clock,
  Calendar,
  Award,
  CheckCircle2,
  Copy,
  Check,
  Sparkles,
  Link as LinkIcon,
  Gamepad2,
  Users,
  QrCode,
  Presentation,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  HomeworkAssignment,
  generateHomeworkPin,
  saveHomeworkAssignment,
  convertSlideDeckToHomeworkObject,
  normalizeGameQuestionsForHomework,
} from '../utils/homeworkService';
import { useAuth } from '../contexts/AuthContext';

export const PRODUCTION_HOMEWORK_BASE_URL = 'https://hamsterenglish.online';

export function getHomeworkShareUrl(pinCode: string): string {
  if (
    typeof window !== 'undefined' &&
    window.location.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('127.0.0.1')
  ) {
    return `${window.location.origin}/?hwPin=${pinCode}`;
  }
  return `${PRODUCTION_HOMEWORK_BASE_URL}/?hwPin=${pinCode}`;
}

const AVAILABLE_GAME_MODES = [
  { id: 'study-mode', name: 'Study Mode', emoji: '📚' },
  { id: 'roller-coaster-quiz', name: 'Roller Coaster Quiz', emoji: '🎢' },
  { id: 'hamster-paintball', name: 'Hamster Paintball (3D Park Arena)', emoji: '🎯' },
  { id: 'bubble-pop', name: 'Bubble Pop', emoji: '🫧' },
  { id: 'slap-and-chop', name: 'Slap & Chop', emoji: '🥋' },
  { id: 'shark-attack', name: 'Shark Attack', emoji: '🦈' },
  { id: 'sumo', name: 'Sumo Showdown', emoji: '🤼' },
  { id: 'mystery-box', name: 'Mystery Box', emoji: '🎁' },
  { id: 'flashcards-match', name: 'Flashcards Match', emoji: '🃏' },
  { id: 'yoga-quiz', name: 'Yoga Quiz & 3D Chase', emoji: '🧘' },
];

const CLASS_LEVEL_OPTIONS = [
  'General',
  'Starters',
  'Movers',
  'Flyers',
  'KET',
  'PET',
  'IELTS',
  'Global Success 6',
  'Global Success 7',
  'Global Success 8',
  'Global Success 9',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'Grade 11',
  'Grade 12',
];

interface CreateHomeworkModalProps {
  isOpen: boolean;
  game: any;
  onClose: () => void;
  onCreated?: (assignment: HomeworkAssignment) => void;
  onNavigateToHomework?: () => void;
}

export function CreateHomeworkModal({
  isOpen,
  game,
  onClose,
  onCreated,
  onNavigateToHomework,
}: CreateHomeworkModalProps) {
  const { user } = useAuth();
  // Normalize game or slide deck
  const normalizedGame = useMemo(() => {
    if (!game) return null;
    if (game.isSlideDeck || (Array.isArray(game.slides) && !Array.isArray(game.questions))) {
      return convertSlideDeckToHomeworkObject(game);
    }
    return game;
  }, [game]);

  const rawQuestions = useMemo(() => {
    if (!normalizedGame) return [];
    const qList =
      normalizedGame.customQuestions ||
      normalizedGame.questions ||
      normalizedGame.items ||
      normalizedGame.cards ||
      [];
    const titleForNorm =
      normalizedGame.topic ||
      normalizedGame.name ||
      normalizedGame.title ||
      'Homework Assignment';
    return normalizeGameQuestionsForHomework(
      Array.isArray(qList) ? qList : [],
      titleForNorm
    );
  }, [normalizedGame]);

  const questionsCount = rawQuestions.length;
  const isSlideHomework = Boolean(normalizedGame?.isSlideDeck || Array.isArray(normalizedGame?.slides));

  // All React hooks MUST be declared unconditionally before early return
  const [title, setTitle] = useState('Homework Assignment');
  const [targetClass, setTargetClass] = useState('Starters');
  const [gameType, setGameType] = useState('study-mode');
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [passingScore, setPassingScore] = useState<number>(80);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 86400000 * 5);
    return d.toISOString().split('T')[0];
  });
  const [instructions, setInstructions] = useState(
    'Complete the Study Mode review, answer all questions, and achieve the passing score before the deadline!'
  );
  const [pinCode, setPinCode] = useState(() => generateHomeworkPin());
  const [isCopied, setIsCopied] = useState(false);
  const [createdAssignment, setCreatedAssignment] = useState<HomeworkAssignment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync modal fields whenever a new game or slide deck is opened
  useEffect(() => {
    if (!isOpen || !normalizedGame) return;
    const initTitle =
      normalizedGame.topic ||
      normalizedGame.name ||
      normalizedGame.title ||
      'Homework Assignment';
    const initClass =
      normalizedGame.classLevel ||
      normalizedGame.curriculum ||
      normalizedGame.cambridgeLevel ||
      normalizedGame.schoolGrade ||
      normalizedGame.gradeLevel ||
      'Starters';

    // Always default preset to Study Mode ('study-mode') instead of Yoga ('yoga-quiz')
    const rawMode = String(normalizedGame.gameType || '').trim();
    const validNonYogaMode =
      rawMode &&
      rawMode !== 'yoga-quiz' &&
      rawMode !== 'interactive-slides' &&
      AVAILABLE_GAME_MODES.some((m) => m.id === rawMode)
        ? 'study-mode'
        : 'study-mode';

    setTitle(initTitle);
    setTargetClass(CLASS_LEVEL_OPTIONS.includes(initClass) ? initClass : 'Starters');
    setGameType(validNonYogaMode);
    setPinCode(generateHomeworkPin());
    setCreatedAssignment(null);
    setIsCopied(false);
    setInstructions(
      normalizedGame.isSlideDeck || Array.isArray(normalizedGame.slides)
        ? 'Use Study Mode to review the lesson slides & notes, then answer all questions to log your verified proof of work!'
        : `Study and answer all ${rawQuestions.length || ''} questions on "${initTitle}" to achieve the passing score before the deadline!`
    );
  }, [isOpen, normalizedGame, rawQuestions.length]);

  if (!isOpen || !normalizedGame) return null;

  const handleCopyLink = () => {
    const targetPin = createdAssignment?.pinCode || pinCode;
    const shareUrl = getHomeworkShareUrl(targetPin);
    navigator.clipboard?.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      const normalizedQs = normalizeGameQuestionsForHomework(rawQuestions, title.trim());
      const newAssignment: HomeworkAssignment = {
        id: `hw-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        ...(user?.uid ? { userId: user.uid, createdByUid: user.uid } : {}),
        ...(user?.email ? { createdByEmail: user.email } : {}),
        gameId: normalizedGame.id || Date.now(),
        gameTitle: title.trim(),
        gameType: gameType || 'study-mode',
        classLevel: targetClass,
        topic: normalizedGame.topic || title.trim(),
        dueDate,
        durationMinutes,
        passingScore,
        maxAttempts,
        targetClass,
        instructions: instructions.trim(),
        pinCode,
        questions: normalizedQs,
        ...(normalizedGame.slideDeckId ? { slideDeckId: normalizedGame.slideDeckId } : {}),
        ...(Array.isArray(normalizedGame.slides) ? { slides: normalizedGame.slides } : {}),
        createdAt: Date.now(),
        status: 'active',
        submissionsCount: 0,
      };

      const saved = await saveHomeworkAssignment(newAssignment, user?.uid);
      setCreatedAssignment(saved);
      onCreated?.(saved);
    } catch (e) {
      console.error('Failed to create homework assignment', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-50 via-white to-indigo-50 dark:from-slate-850 dark:via-slate-900 dark:to-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple dark:text-purple-300 flex items-center justify-center">
              {isSlideHomework ? <Presentation size={20} /> : <BookOpen size={20} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {createdAssignment
                  ? 'Homework Created Successfully!'
                  : isSlideHomework
                  ? 'Send Slide Deck as Homework'
                  : 'Create Homework Assignment'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {createdAssignment
                  ? 'Share the PIN or QR code with your students on hamsterenglish.online'
                  : `Assign "${normalizedGame.topic || normalizedGame.name}" (${questionsCount} Qs) to students`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 flex items-center justify-center transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-left text-sm text-slate-700 dark:text-slate-200">
          {createdAssignment ? (
            /* Success confirmation screen with Share Details */
            <div className="space-y-5 text-center py-2">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Assignment is Live on hamsterenglish.online!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Students can scan the QR code below, click the direct link, or go to{' '}
                  <strong className="text-brand-purple">hamsterenglish.online</strong> and enter PIN{' '}
                  <strong className="font-mono">{createdAssignment.pinCode}</strong>.
                </p>
              </div>

              {/* PIN Code Box */}
              <div className="bg-slate-50 dark:bg-slate-850 p-5 rounded-3xl border-2 border-dashed border-brand-purple/40 max-w-md mx-auto text-center space-y-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Student Assignment PIN Code
                </span>
                <div className="text-4xl font-mono font-black tracking-widest text-brand-purple dark:text-purple-300">
                  {createdAssignment.pinCode}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Due: {createdAssignment.dueDate} · Time limit:{' '}
                  {createdAssignment.durationMinutes > 0
                    ? `${createdAssignment.durationMinutes} mins`
                    : 'No limit'}{' '}
                  · Target: {createdAssignment.passingScore}%
                </p>
              </div>

              {/* Scannable QR Code */}
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-sm mx-auto flex flex-col items-center gap-3 shadow-sm">
                <div className="p-3.5 bg-white rounded-2xl border-2 border-purple-100 shadow-inner inline-flex">
                  <QRCodeSVG
                    value={getHomeworkShareUrl(createdAssignment.pinCode)}
                    size={160}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
                    <QrCode size={15} className="text-brand-purple" />
                    Scan with Phone or Tablet Camera
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Direct link: hamsterenglish.online/?hwPin={createdAssignment.pinCode}
                  </p>
                </div>
              </div>

              {/* Direct Link Box */}
              <div className="flex items-center gap-2 max-w-md mx-auto bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
                <LinkIcon size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  readOnly
                  value={getHomeworkShareUrl(createdAssignment.pinCode)}
                  className="bg-transparent border-none text-xs text-slate-700 dark:text-slate-300 w-full outline-none font-mono"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-xl bg-brand-purple text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-brand-purple/90 shrink-0"
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Creation Form */
            <>
              {/* Assignment Title */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Assignment Name / Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Cambridge Starters Speaking Homework"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 transition"
                />
              </div>

              {/* Target Class & Game Engine */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} />
                    <span>Class / Course Level</span>
                  </label>
                  <select
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple"
                  >
                    {CLASS_LEVEL_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Gamepad2 size={14} />
                    <span>Homework Format / Mode</span>
                  </label>
                  <select
                    value={gameType}
                    onChange={(e) => setGameType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple"
                  >
                    {AVAILABLE_GAME_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.emoji} {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Duration Limit, Passing Score & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Duration Limit */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>Duration Limit</span>
                  </label>
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple"
                  >
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={20}>20 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={0}>No Limit (Practice)</option>
                  </select>
                </div>

                {/* Passing Score */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Award size={14} />
                    <span>Passing Target</span>
                  </label>
                  <select
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple"
                  >
                    <option value={60}>60% or higher</option>
                    <option value={70}>70% or higher</option>
                    <option value={80}>80% or higher</option>
                    <option value={90}>90% or higher</option>
                    <option value={100}>100% (Mastery)</option>
                  </select>
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} />
                    <span>Due Date</span>
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold outline-none focus:border-brand-purple"
                  />
                </div>
              </div>

              {/* Max Attempts & Instructions */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                  Teacher Instructions for Students
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-medium outline-none focus:border-brand-purple resize-none"
                />
              </div>

              {/* Analytics & Verification Proof Preview Notice */}
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex items-start gap-2.5 text-xs text-indigo-800 dark:text-indigo-300">
                <Sparkles size={16} className="shrink-0 mt-0.5 text-indigo-500" />
                <p>
                  <span className="font-bold">Verified Proof of Work Tracking:</span> When students complete this{' '}
                  {isSlideHomework ? 'slide deck & review quiz' : 'assignment'}, their total time spent, final score %, accuracy, and question-by-question answer audit will automatically be logged in your{' '}
                  <strong>Homework Analytics</strong> ledger.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between gap-3">
          {createdAssignment ? (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 cursor-pointer"
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopied ? 'Link Copied!' : 'Copy Student Link'}</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onNavigateToHomework?.();
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-brand-purple text-white font-bold text-xs hover:bg-brand-purple/90 flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <BookOpen size={14} />
                  <span>Go to Homework Hub</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleCreate}
                disabled={isSubmitting || !title.trim()}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-brand-purple to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <BookOpen size={15} />
                <span>{isSubmitting ? 'Creating Assignment...' : 'Create & Assign Homework'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
