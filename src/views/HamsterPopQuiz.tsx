import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
const Player: any = ReactPlayer;
import {
  Play, Pause, Video, Settings,
  CheckCircle, XCircle, Sparkles, Volume2, VolumeX,
  Plus, Trash2, Check, Loader2, Folder, FolderPlus,
  ArrowRight, ArrowLeft, RotateCcw, SkipForward, SkipBack,
  Edit3, Zap, Upload, Globe, Lock, Award, AlertCircle, FileVideo, X,
  BarChart3, Clock, Target, Flame, Trophy, Eye, HelpCircle
} from 'lucide-react';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { persistUserGameToCloudAndCache } from "../utils/platformCache";
import {
  mergeUserFolders,
  fetchAllAvailableFolders,
  createUnifiedFolder,
  UnifiedFolderItem,
} from "../lib/gameStore";

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  .vq-display { font-family: 'Outfit', sans-serif; }
  .vq-body { font-family: 'Plus Jakarta Sans', sans-serif; }
  .vq-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }

  @keyframes vqPopIn {
    0% { transform: scale(0.96) translateY(8px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes vqFadeUp {
    0% { transform: translateY(12px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes vqConfetti {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(540deg); opacity: 0; }
  }

  .animate-vq-pop { animation: vqPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-vq-fade { animation: vqFadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  .vq-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .vq-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.35); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245, 158, 11, 0.6); }
`;

const CEFR_LEVELS = ['Pre-A1', 'A1 Starters', 'A2 Movers', 'B1 Preliminary', 'B2 First', 'C1 Advanced'];
const QUESTION_TYPES = ['Multiple Choice', 'True or False', 'Vocabulary Meaning', 'Grammar Choice'];
const QUIZ_COUNTS = [
  { count: 3, label: '3 Checkpoints', freq: 'Every 5 Minutes' },
  { count: 4, label: '4 Checkpoints', freq: 'Smart Timing' },
  { count: 6, label: '6 Checkpoints', freq: 'Every 2 Minutes' },
];

export interface QuizAnswerRecord {
  isCorrect: boolean;
  selectedIndex: number;
  responseTimeSec: number;
  earnedXp: number;
}

// Synthesized Web Audio FX
class VideoQuizAudio {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playCorrect() {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  playWrong() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(155, now + 0.22);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }
}

const vqAudio = new VideoQuizAudio();

const formatSeconds = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
};

const isDirectVideoSource = (url: string) => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
};

const getMasteryGrade = (accuracy: number, answeredCount: number) => {
  if (answeredCount === 0) return { grade: '—', label: 'Ready to Play', color: 'text-slate-400', bg: 'bg-white/5 border-white/10' };
  if (accuracy >= 95) return { grade: 'S', label: 'Mastery Star', color: 'text-amber-300', bg: 'bg-amber-400/15 border-amber-400/40' };
  if (accuracy >= 85) return { grade: 'A+', label: 'Excellent', color: 'text-emerald-300', bg: 'bg-emerald-400/15 border-emerald-400/40' };
  if (accuracy >= 75) return { grade: 'A', label: 'Great Job', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30' };
  if (accuracy >= 60) return { grade: 'B', label: 'Good Effort', color: 'text-sky-300', bg: 'bg-sky-400/15 border-sky-400/30' };
  return { grade: 'C', label: 'Keep Practicing', color: 'text-rose-300', bg: 'bg-rose-500/15 border-rose-500/30' };
};

const generateDynamicQuestions = (config: any) => {
  const topic = (config?.topic || "English Video Lesson").trim();
  const level = config?.level || "A2 Movers";
  const types = Array.isArray(config?.selectedTypes) && config.selectedTypes.length > 0
    ? config.selectedTypes
    : ['Multiple Choice'];
  const count = config?.count || 4;

  const baseTimings = count === 3 ? [15, 40, 70] : count === 6 ? [12, 26, 42, 58, 74, 90] : [14, 34, 56, 78];

  return baseTimings.map((time, index) => {
    const qType = types[index % types.length];
    const questionObj: any = {
      id: index + 1,
      timeTrigger: time,
      type: qType,
      xp: 100,
    };

    if (qType === 'Multiple Choice') {
      questionObj.question = `What is the main focus of this scene about ${topic}?`;
      questionObj.options = [
        { text: `Key details and actions related to ${topic.toLowerCase()}.`, isCorrect: true },
        { text: `An unrelated topic not shown in the clip.`, isCorrect: false },
        { text: `A silent title card with no action.`, isCorrect: false },
        { text: `The ending credits of the video.`, isCorrect: false },
      ];
      questionObj.explanation = `This segment highlights core details about ${topic}.`;
    } else if (qType === 'Vocabulary Meaning') {
      const words = topic.split(/\s+/).filter((w: string) => w.replace(/[^a-zA-Z]/g, '').length > 2);
      const focusWord = (words[words.length - 1] || 'DISCOVERY').replace(/[^a-zA-Z]/g, '').toUpperCase();
      questionObj.word = focusWord;
      questionObj.pronunciation = `/${focusWord.toLowerCase()}/`;
      questionObj.question = `What does "${focusWord}" mean in this context?`;
      questionObj.options = [
        { text: `An important concept connected to ${topic.toLowerCase()}.`, isCorrect: true },
        { text: `Something completely opposite to the scene.`, isCorrect: false },
        { text: `A type of musical instrument.`, isCorrect: false },
        { text: `A measurement of distance.`, isCorrect: false },
      ];
      questionObj.explanation = `"${focusWord}" is a key ${level} vocabulary term for ${topic}.`;
      questionObj.xp = 150;
    } else if (qType === 'Grammar Choice') {
      questionObj.question = `Which sentence uses correct ${level} grammar?`;
      questionObj.options = [
        { text: `They are watching a video about ${topic.toLowerCase()}.`, isCorrect: true },
        { text: `They is watching a video about ${topic.toLowerCase()}.`, isCorrect: false },
        { text: `They watches a video about ${topic.toLowerCase()}.`, isCorrect: false },
        { text: `They watching a video about ${topic.toLowerCase()}.`, isCorrect: false },
      ];
      questionObj.explanation = `Use "are + verb-ing" with plural subjects in the present continuous tense.`;
    } else {
      questionObj.type = 'True or False';
      questionObj.question = `True or False: This part of the video focuses on ${topic}.`;
      questionObj.options = [
        { text: `True`, isCorrect: true },
        { text: `False`, isCorrect: false },
      ];
      questionObj.explanation = `The scene directly connects to ${topic}.`;
    }

    return questionObj;
  });
};

export function HamsterPopQuiz({ onViewChange, initialGame }: { onViewChange: (view: ViewState) => void; initialGame?: any; }) {
  const { user } = useAuth();
  const [savedGameRecord, setSavedGameRecord] = useState<any>(initialGame || null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  // When a saved game is opened to play (not via explicit edit icon) or after saving in session, lock into clean Play Mode
  const [isLockedPlayMode, setIsLockedPlayMode] = useState<boolean>(
    Boolean(initialGame && !initialGame.editMode)
  );

  const buildQuestionsFromInitialGame = useCallback((game: any) => {
    const raw = game?.customQuestions || game?.questions || [];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const total = raw.length;
    return raw.map((q: any, idx: number) => {
      const text = q.text || q.question || `Question ${idx + 1}`;
      const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['True', 'False'];
      const foundCorrect = opts.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect));
      const ansIdx = typeof q.answerIndex === 'number' ? q.answerIndex : (foundCorrect >= 0 ? foundCorrect : 0);
      return {
        id: q.id || idx + 1,
        timeTrigger: typeof q.timeTrigger === 'number' ? q.timeTrigger : Math.round(((idx + 1) / (total + 1)) * 90) + 5,
        type: q.type || 'Multiple Choice',
        xp: q.xp || 100,
        question: text,
        options: opts.map((o: any, oIdx: number) => ({
          text: typeof o === 'string' ? o : o?.text || `Option ${oIdx + 1}`,
          isCorrect: oIdx === ansIdx,
        })),
        explanation: q.explanation || `Correct answer: ${typeof opts[ansIdx] === 'string' ? opts[ansIdx] : opts[ansIdx]?.text || ''}`,
        ...(q.word ? { word: q.word } : {}),
        ...(q.pronunciation ? { pronunciation: q.pronunciation } : {}),
      };
    });
  }, []);

  const initialMappedQuestions = buildQuestionsFromInitialGame(initialGame);
  const hasInitialVideo = Boolean(initialGame?.videoUrl);
  const [currentView, setCurrentView] = useState<'setup' | 'player'>(
    initialMappedQuestions && hasInitialVideo ? 'player' : 'setup'
  );
  const [questions, setQuestions] = useState<any[]>(initialMappedQuestions || []);
  const [lessonConfig, setLessonConfig] = useState<any>(
    initialGame
      ? {
          topic: initialGame.topic || initialGame.name || initialGame.title || '',
          level: initialGame.classLevel || initialGame.className || 'A2 Movers',
          className: initialGame.className || '',
          folderId: initialGame.folderId || '',
          folder: initialGame.folderName || '',
          isPublic: initialGame.isPublic ?? true,
        }
      : {
          topic: '',
          level: 'A2 Movers',
          className: '',
          folderId: '',
          folder: '',
          isPublic: true,
        }
  );

  const [videoUrl, setVideoUrl] = useState<string>(initialGame?.videoUrl || '');
  const [localVideoName, setLocalVideoName] = useState<string>('');
  const localBlobUrlRef = useRef<string | null>(null);

  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [wordsLearned, setWordsLearned] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    return () => {
      if (localBlobUrlRef.current) {
        URL.revokeObjectURL(localBlobUrlRef.current);
        localBlobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setSavedGameRecord(initialGame || null);
    setIsLockedPlayMode(Boolean(initialGame && !initialGame.editMode));
    if (initialGame?.videoUrl) {
      setVideoUrl(initialGame.videoUrl);
      setLocalVideoName('');
    }
    const mapped = buildQuestionsFromInitialGame(initialGame);
    if (mapped) {
      setQuestions(mapped);
      setLessonConfig({
        topic: initialGame.topic || initialGame.name || initialGame.title || 'Video Quiz',
        level: initialGame.classLevel || initialGame.className || 'A2 Movers',
        className: initialGame.className || '',
        folderId: initialGame.folderId || '',
        folder: initialGame.folderName || '',
        isPublic: initialGame.isPublic ?? true,
      });
      if (initialGame?.videoUrl) {
        setCurrentView('player');
      }
    }
  }, [initialGame, buildQuestionsFromInitialGame]);

  const handleSelectLocalVideoFile = (file: File) => {
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }
    const blobUrl = URL.createObjectURL(file);
    localBlobUrlRef.current = blobUrl;
    setVideoUrl(blobUrl);
    setLocalVideoName(file.name);
    setSetupError('');

    const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (cleanFileName && !lessonConfig?.topic) {
      setLessonConfig((prev: any) => ({ ...prev, topic: cleanFileName }));
    }
  };

  const handleClearVideoSource = () => {
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }
    setVideoUrl('');
    setLocalVideoName('');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    vqAudio.muted = next;
  };

  const normalizeVideoUrl = (rawUrl: string) => {
    let finalUrl = (rawUrl || '').trim();
    if (!finalUrl) return '';
    if (finalUrl.startsWith('blob:') || finalUrl.startsWith('data:')) return finalUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    if (finalUrl.includes('youtube.com/shorts/')) {
      finalUrl = finalUrl.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
    }
    return finalUrl;
  };

  const handleSaveVideoQuiz = async (saveOverrides?: {
    title?: string;
    className?: string;
    folderId?: string;
    folderName?: string;
    isPublic?: boolean;
    videoUrlOverride?: string;
  }): Promise<{ ok: boolean; message: string }> => {
    if (savingRef.current) return { ok: false, message: 'Already saving...' };
    savingRef.current = true;
    setIsSaving(true);
    try {
      const existing = savedGameRecord || initialGame;
      const resolvedTitle =
        saveOverrides?.title?.trim() ||
        lessonConfig?.topic?.trim() ||
        existing?.topic ||
        existing?.name ||
        existing?.title ||
        'Video Quiz';
      const resolvedClass =
        saveOverrides?.className !== undefined
          ? saveOverrides.className.trim()
          : lessonConfig?.className ||
            lessonConfig?.level ||
            existing?.classLevel ||
            existing?.className ||
            '';

      let resolvedFolderId =
        saveOverrides?.folderId !== undefined
          ? saveOverrides.folderId
          : lessonConfig?.folderId || existing?.folderId || '';
      let resolvedFolderName =
        saveOverrides?.folderName !== undefined
          ? saveOverrides.folderName
          : lessonConfig?.folder || existing?.folderName || '';

      if (!resolvedFolderId && resolvedFolderName && user?.uid) {
        try {
          const userFolders = mergeUserFolders(user.uid);
          const match = userFolders.find(
            (f) => f.name.toLowerCase().trim() === String(resolvedFolderName).toLowerCase().trim()
          );
          if (match) {
            resolvedFolderId = match.id;
            resolvedFolderName = match.name;
          }
        } catch {}
      }

      const resolvedIsPublic =
        saveOverrides?.isPublic !== undefined
          ? saveOverrides.isPublic
          : lessonConfig?.isPublic !== undefined
          ? Boolean(lessonConfig.isPublic)
          : existing?.isPublic !== undefined
          ? Boolean(existing.isPublic)
          : true;

      const rawTargetUrl = saveOverrides?.videoUrlOverride || videoUrl || existing?.videoUrl || '';
      const persistedVideoUrl = rawTargetUrl.startsWith('blob:') ? '' : normalizeVideoUrl(rawTargetUrl);

      const normalizedQuestions = (questions || []).map((q: any, idx: number) => {
        const rawOpts = Array.isArray(q.options) ? q.options : [];
        const optionTexts = rawOpts.map((o: any, oIdx: number) =>
          typeof o === 'string' ? o : o?.text || `Option ${oIdx + 1}`
        );
        const foundAnsIdx = rawOpts.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect));
        const answerIndex = foundAnsIdx >= 0 ? foundAnsIdx : (typeof q.answerIndex === 'number' ? q.answerIndex : 0);
        return {
          id: q.id || idx + 1,
          text: q.question || q.text || `Question ${idx + 1}`,
          options: optionTexts.length >= 2 ? optionTexts : ['True', 'False'],
          answerIndex,
          timeTrigger:
            typeof q.timeTrigger === 'number'
              ? q.timeTrigger
              : Math.round(((idx + 1) / ((questions?.length || 1) + 1)) * 90) + 5,
          type: q.type || 'Multiple Choice',
          xp: q.xp || 100,
          explanation: q.explanation || '',
          ...(q.word ? { word: q.word } : {}),
          ...(q.pronunciation ? { pronunciation: q.pronunciation } : {}),
        };
      });

      const updatedConfig = {
        ...lessonConfig,
        topic: resolvedTitle,
        className: resolvedClass,
        folderId: resolvedFolderId,
        folder: resolvedFolderName,
        isPublic: resolvedIsPublic,
      };
      setLessonConfig(updatedConfig);
      if (saveOverrides?.videoUrlOverride && !saveOverrides.videoUrlOverride.startsWith('blob:')) {
        setVideoUrl(persistedVideoUrl);
        setLocalVideoName('');
      }

      const gameToSave = {
        name: resolvedTitle,
        title: resolvedTitle,
        topic: resolvedTitle,
        className: resolvedClass,
        classLevel: resolvedClass,
        folderId: resolvedFolderId,
        ...(resolvedFolderName ? { folderName: resolvedFolderName } : {}),
        gameType: 'hamster-pop-quiz',
        videoUrl: persistedVideoUrl,
        lessonConfig: updatedConfig,
        customQuestions: normalizedQuestions,
        isPublic: resolvedIsPublic,
      };

      const result = await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: existing,
      });
      setSavedGameRecord(result.savedGame);
      // Once saved, enter clean Play Mode without Edit Questions or Checkpoint lists
      setIsLockedPlayMode(true);
      return {
        ok: true,
        message: result.cloudSynced
          ? 'Saved to My Games & Cloud'
          : 'Saved to My Games',
      };
    } catch (err) {
      console.error('Error saving Video Quiz:', err);
      return { ok: false, message: 'Failed to save quiz.' };
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleStartLesson = async (config: any) => {
    const cleanUrl = normalizeVideoUrl(config.videoUrl || videoUrl);
    if (!cleanUrl) {
      setSetupError('Please paste a video URL or upload a local video file first.');
      return;
    }
    setSetupError('');
    setVideoUrl(cleanUrl);
    setLessonConfig(config);
    setIsLockedPlayMode(false);
    setIsGenerating(true);

    try {
      const res = await fetch('/api/generate-hamster-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topic || 'Video Lesson',
          level: config.level || 'A2 Movers',
          types: config.selectedTypes,
          freq: config.frequency,
          videoUrl: cleanUrl.startsWith('blob:') ? localVideoName : cleanUrl,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.questions) && data.questions.length > 0) {
        const desiredCount = config.count || 4;
        const base = data.questions;
        const finalQs =
          base.length >= desiredCount
            ? base.slice(0, desiredCount)
            : [...base, ...generateDynamicQuestions(config).slice(base.length, desiredCount)].map((q, i) => ({
                ...q,
                id: i + 1,
              }));
        setQuestions(finalQs);
      } else {
        setQuestions(generateDynamicQuestions(config));
      }
    } catch (e) {
      console.error(e);
      setQuestions(generateDynamicQuestions(config));
    } finally {
      setIsGenerating(false);
      setCurrentView('player');
    }
  };

  return (
    <div
      id="game-container"
      className="w-full min-h-full flex-1 text-slate-100 vq-body overflow-y-auto overflow-x-hidden bg-[#0B0914] relative selection:bg-amber-400 selection:text-slate-950 flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 12%, rgba(245, 158, 11, 0.11), transparent 38%), radial-gradient(circle at 82% 18%, rgba(236, 72, 153, 0.11), transparent 42%), radial-gradient(circle at 50% 90%, rgba(139, 92, 246, 0.13), transparent 50%)',
      }}
    >
      <style>{customStyles}</style>

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0E0B1A]/95 border-b border-white/10 px-3 sm:px-5 h-14 flex items-center justify-between gap-3 shrink-0">
        {/* Zone 1: Back + Fullscreen + Brand */}
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <button
            onClick={() => onViewChange("games")}
            title="Back to Games"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <FullscreenButton targetId="game-container" />
          <div className="flex items-center gap-2 text-left ml-0.5 min-w-0">
            <img
              src="/images/video-quiz-card-v3.jpg?v=3"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_3b5337e9.png';
              }}
              alt="Video Quiz"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-amber-400/40 shadow-sm shrink-0"
            />
            <span className="vq-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              Video <span className="text-amber-400">Quiz</span>
            </span>
            {currentView === 'player' && (lessonConfig?.topic || localVideoName) && (
              <>
                <span aria-hidden="true" className="text-white/20 hidden md:inline">·</span>
                <span className="hidden md:inline text-xs font-bold text-slate-300 truncate max-w-[260px]">
                  {lessonConfig?.topic || localVideoName}
                </span>
                {lessonConfig?.level && (
                  <span className="hidden lg:inline px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 text-[11px] font-bold whitespace-nowrap">
                    {lessonConfig.level}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Zone 2: Mode Switcher (Only visible when creating/editing an unsaved quiz) */}
        {!isLockedPlayMode && (
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setCurrentView('setup')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'setup'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Setup
            </button>
            <button
              onClick={() => {
                if (!videoUrl.trim()) {
                  setSetupError('Please paste a video URL or upload a local video file first.');
                  setCurrentView('setup');
                  return;
                }
                if (questions.length === 0) {
                  setQuestions(generateDynamicQuestions(lessonConfig));
                }
                setCurrentView('player');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'player'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Player {questions.length > 0 ? `(${questions.length})` : ''}
            </button>
          </div>
        )}

        {/* Zone 3: Live Score & Audio Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 vq-mono">
            <span className="text-amber-400 font-extrabold">{xp} XP</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span className="text-rose-400 font-extrabold flex items-center gap-1">
              <Flame size={13} className="text-rose-400" />
              {streak}
            </span>
          </div>
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </header>

      {/* Main Workspace — Full-Screen in Player View */}
      <main
        className={`flex-1 w-full mx-auto flex flex-col ${
          currentView === 'player'
            ? 'max-w-[1920px] px-2 sm:px-4 py-2'
            : 'max-w-[1280px] px-4 sm:px-6 py-6'
        }`}
      >
        {currentView === 'setup' ? (
          <SetupStudioView
            videoUrl={videoUrl}
            setVideoUrl={(val: string) => {
              setVideoUrl(val);
              if (setupError) setSetupError('');
            }}
            localVideoName={localVideoName}
            onSelectLocalFile={handleSelectLocalVideoFile}
            onClearVideo={handleClearVideoSource}
            initialConfig={lessonConfig}
            setupError={setupError}
            setSetupError={setSetupError}
            onStartLesson={handleStartLesson}
            onOpenManual={(cfg: any) => {
              const cleanUrl = normalizeVideoUrl(cfg.videoUrl || videoUrl);
              if (!cleanUrl) {
                setSetupError('Please paste a video URL or upload a local video file first.');
                return;
              }
              setSetupError('');
              setVideoUrl(cleanUrl);
              setLessonConfig(cfg);
              setIsLockedPlayMode(false);
              if (questions.length === 0) {
                setQuestions(generateDynamicQuestions(cfg));
              }
              setCurrentView('player');
            }}
            isGenerating={isGenerating}
          />
        ) : (
          <PlayerView
            user={user}
            config={lessonConfig}
            questions={questions}
            setQuestions={setQuestions}
            xp={xp}
            setXp={setXp}
            streak={streak}
            setStreak={(valOrFn: any) => {
              setStreak((prev) => {
                const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
                if (next > bestStreak) setBestStreak(next);
                return next;
              });
            }}
            bestStreak={bestStreak}
            wordsLearned={wordsLearned}
            setWordsLearned={setWordsLearned}
            videoUrl={videoUrl}
            localVideoName={localVideoName}
            onSaveQuiz={handleSaveVideoQuiz}
            isSaving={isSaving}
            isPlayOnlyMode={isLockedPlayMode}
            initialOpenEditor={Boolean(initialGame?.editMode && !isLockedPlayMode)}
            onBackToSetup={() => setCurrentView('setup')}
          />
        )}
      </main>
    </div>
  );
}

function SetupStudioView({
  videoUrl,
  setVideoUrl,
  localVideoName,
  onSelectLocalFile,
  onClearVideo,
  initialConfig,
  setupError,
  setSetupError,
  onStartLesson,
  onOpenManual,
  isGenerating,
}: any) {
  const isBlobUrl = Boolean(videoUrl && videoUrl.startsWith('blob:'));
  const [urlInput, setUrlInput] = useState(isBlobUrl ? '' : videoUrl || '');
  const [topic, setTopic] = useState(initialConfig?.topic || '');
  const [level, setLevel] = useState(initialConfig?.level || 'A2 Movers');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialConfig?.selectedTypes || ['Multiple Choice', 'Vocabulary Meaning', 'Grammar Choice']
  );
  const [quizCount, setQuizCount] = useState<number>(4);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setUrlInput('');
    } else if (!videoUrl.startsWith('blob:')) {
      setUrlInput(videoUrl);
    }
  }, [videoUrl]);

  useEffect(() => {
    if (initialConfig?.topic && !topic) {
      setTopic(initialConfig.topic);
    }
  }, [initialConfig?.topic]);

  // Auto-detect YouTube title via oEmbed when user pastes a YouTube link
  useEffect(() => {
    const trimmed = (urlInput || '').trim();
    if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(normalized)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.title) {
          setTopic((prev: string) => prev.trim() || String(data.title).slice(0, 65));
        }
      } catch {}
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [urlInput]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1
          ? prev.filter((t) => t !== type)
          : prev
        : [...prev, type]
    );
  };

  const activeVideoSource = isBlobUrl ? videoUrl : urlInput.trim();

  const buildPayload = () => {
    const matchedFreq = QUIZ_COUNTS.find((c) => c.count === quizCount)?.freq || 'Smart Timing';
    const fallbackTopic = localVideoName
      ? localVideoName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ')
      : 'Video Lesson';
    return {
      ...initialConfig,
      videoUrl: activeVideoSource,
      topic: topic.trim() || fallbackTopic,
      level,
      selectedTypes,
      count: quizCount,
      frequency: matchedFreq,
    };
  };

  return (
    <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full animate-vq-fade">
      <div className="bg-[#161229] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl">
        {/* Compact Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-white/10">
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 border-2 border-amber-400/50 shadow-lg bg-[#0B0914]">
            <img
              src="/images/video-quiz-card-v3.jpg?v=3"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_3b5337e9.png';
              }}
              alt="Video Quiz Mascot"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="vq-display text-2xl sm:text-4xl font-black text-white tracking-tight mb-1">
              Interactive <span className="text-amber-400">Video Quiz</span>
            </h1>
            <p className="text-sm text-slate-400 max-w-xl">
              Paste a YouTube or video URL, or upload a video file from your computer to create live checkpoint questions below the video.
            </p>
          </div>
        </div>

        {/* Main Setup Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-6">
          {/* Left Column: Video Source (URL or Local File) & Topic */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300">
                  Video Source (URL or Local File)
                </label>
                {activeVideoSource && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      onClearVideo();
                    }}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X size={13} /> Clear Video
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onSelectLocalFile(file);
                  }
                  e.target.value = '';
                }}
              />

              {isBlobUrl ? (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                      <FileVideo size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-emerald-300 truncate">
                        {localVideoName || 'Uploaded Video File'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Local video ready for playback
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1 flex items-center">
                    <Video size={17} className="absolute left-3.5 text-amber-400 pointer-events-none" />
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="Paste YouTube or MP4 video URL..."
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setVideoUrl(e.target.value);
                        if (setupError) setSetupError('');
                      }}
                      className={`w-full pl-10 pr-4 py-3.5 rounded-xl bg-[#0E0B1A] border focus:outline-none text-sm font-medium text-white placeholder:text-slate-500 transition-colors ${
                        setupError
                          ? 'border-rose-500 focus:border-rose-400'
                          : 'border-white/15 focus:border-amber-400'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Upload size={15} className="text-amber-400" />
                    Upload Video
                  </button>
                </div>
              )}

              {setupError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Quiz Title / Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ocean Wildlife & Habitats"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-semibold text-white placeholder:text-slate-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  Checkpoints
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#0E0B1A] border border-white/15">
                  {QUIZ_COUNTS.map((item) => (
                    <button
                      key={item.count}
                      type="button"
                      onClick={() => setQuizCount(item.count)}
                      className={`py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                        quizCount === item.count
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {item.count} Qs
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Level Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                English Level
              </label>
              <div className="flex flex-wrap gap-2">
                {CEFR_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer border ${
                      level === l
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                        : 'bg-[#0E0B1A] text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Question Types & Launch Actions */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Question Formats
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {QUESTION_TYPES.map((type) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`p-3.5 rounded-xl border text-left transition-colors flex items-center gap-2.5 cursor-pointer ${
                        active
                          ? 'bg-pink-500/15 border-pink-400/60 text-white'
                          : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          active ? 'bg-pink-500 text-white' : 'bg-white/10'
                        }`}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs font-bold truncate">{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Source Readiness Card */}
            <div className="bg-[#0E0B1A] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-200 truncate">
                  {activeVideoSource
                    ? isBlobUrl
                      ? `File: ${localVideoName}`
                      : 'Video Link Ready'
                    : 'No Video Selected Yet'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {activeVideoSource
                    ? `${quizCount} checkpoints · ${level}`
                    : 'Paste a URL or upload an MP4 file to begin'}
                </div>
              </div>
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${
                  activeVideoSource
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-white/5 text-slate-400'
                }`}
              >
                {activeVideoSource ? 'Ready' : 'Waiting'}
              </span>
            </div>

            {/* Launch Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  if (!activeVideoSource) {
                    setSetupError('Please paste a video URL or upload a local video file first.');
                    urlInputRef.current?.focus();
                    return;
                  }
                  onStartLesson(buildPayload());
                }}
                className="flex-1 py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate & Play
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  if (!activeVideoSource) {
                    setSetupError('Please paste a video URL or upload a local video file first.');
                    urlInputRef.current?.focus();
                    return;
                  }
                  onOpenManual(buildPayload());
                }}
                className="py-3.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Edit3 size={15} />
                Open Editor
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerView({
  user,
  config,
  questions,
  setQuestions,
  xp,
  setXp,
  streak,
  setStreak,
  bestStreak,
  wordsLearned,
  setWordsLearned,
  videoUrl,
  localVideoName,
  onSaveQuiz,
  isSaving,
  isPlayOnlyMode,
  initialOpenEditor,
  onBackToSetup,
}: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [reviewingQuiz, setReviewingQuiz] = useState<any>(null);
  const [isReplayingClip, setIsReplayingClip] = useState(false);
  const [resultsMap, setResultsMap] = useState<Record<number, QuizAnswerRecord>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEditModal, setShowEditModal] = useState(Boolean(initialOpenEditor));
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const videoRef = useRef<any>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const questionDockRef = useRef<HTMLDivElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(120);
  const [currentTime, setCurrentTime] = useState(0);

  const useNativeVideo = isDirectVideoSource(videoUrl);

  // Sync play/pause with native video element when using direct/blob video
  useEffect(() => {
    if (!useNativeVideo || !nativeVideoRef.current) return;
    if (isPlaying && (!activeQuiz || isReplayingClip)) {
      nativeVideoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      nativeVideoRef.current.pause();
    }
  }, [isPlaying, activeQuiz, isReplayingClip, useNativeVideo, videoUrl]);

  const sortedQuestions = [...questions].sort((a, b) => a.timeTrigger - b.timeTrigger);
  const answeredRecords = Object.values(resultsMap);
  const answeredIds = Object.keys(resultsMap).map(Number);
  const correctCount = answeredRecords.filter((r) => r.isCorrect).length;
  const missedCount = answeredRecords.filter((r) => !r.isCorrect).length;
  const accuracyPct = answeredIds.length > 0 ? Math.round((correctCount / answeredIds.length) * 100) : 0;
  const avgResponseTimeSec =
    answeredRecords.length > 0
      ? Number(
          (
            answeredRecords.reduce((acc, r) => acc + (r.responseTimeSec || 0), 0) /
            answeredRecords.length
          ).toFixed(1)
        )
      : 0;
  const fastestResponseSec =
    answeredRecords.length > 0
      ? Math.min(...answeredRecords.map((r) => r.responseTimeSec || 99))
      : 0;

  const seekVideoTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(videoDuration || 120, seconds));
    setCurrentTime(clamped);
    setProgress((clamped / (videoDuration || 120)) * 100);
    if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.currentTime = clamped;
    } else if (videoRef.current) {
      if (typeof videoRef.current.seekTo === 'function') {
        videoRef.current.seekTo(clamped, 'seconds');
      } else if ('currentTime' in videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    }
  };

  const triggerQuizNow = (quiz: any) => {
    setIsReplayingClip(false);
    setIsPlaying(false);
    setReviewingQuiz(null);
    seekVideoTo(quiz.timeTrigger);
    setActiveQuiz(quiz);
    vqAudio.playPop();
  };

  const handleReplayQuestionScene = () => {
    if (!activeQuiz) return;
    const startClipSec = Math.max(0, activeQuiz.timeTrigger - 5);
    seekVideoTo(startClipSec);
    setIsReplayingClip(true);
    setIsPlaying(true);
  };

  const evaluateTimeTrigger = (currentSeconds: number) => {
    setCurrentTime(currentSeconds);
    const duration = videoDuration || 120;
    setProgress((currentSeconds / duration) * 100);

    // If replaying the 5-second scene for the active question below, pause again when reaching its checkpoint
    if (isReplayingClip && activeQuiz) {
      if (currentSeconds >= activeQuiz.timeTrigger) {
        setIsReplayingClip(false);
        setIsPlaying(false);
        seekVideoTo(activeQuiz.timeTrigger);
      }
      return;
    }

    const triggeredQuiz = questions.find(
      (q: any) =>
        resultsMap[q.id] === undefined &&
        Math.abs(q.timeTrigger - currentSeconds) < 0.65
    );

    if (triggeredQuiz && isPlaying && !activeQuiz) {
      triggerQuizNow(triggeredQuiz);
    }
  };

  const handleTimeUpdate = (e: any) => {
    const currentSeconds = e?.currentTarget?.currentTime || e?.target?.currentTime || 0;
    evaluateTimeTrigger(currentSeconds);
  };

  const handleQuizComplete = (result: {
    isCorrect: boolean;
    selectedIndex: number;
    responseTimeSec: number;
  }) => {
    if (!activeQuiz) return;
    const earnedXp = result.isCorrect ? (activeQuiz.xp || 100) + streak * 10 : 0;

    if (result.isCorrect) {
      setXp((prev: number) => prev + earnedXp);
      setStreak((prev: number) => prev + 1);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2600);
      if (activeQuiz.type === 'Vocabulary Meaning') {
        setWordsLearned((prev: number) => prev + 1);
      }
    } else {
      setStreak(0);
    }

    const updatedResults: Record<number, QuizAnswerRecord> = {
      ...resultsMap,
      [activeQuiz.id]: {
        isCorrect: result.isCorrect,
        selectedIndex: result.selectedIndex,
        responseTimeSec: result.responseTimeSec,
        earnedXp,
      },
    };
    setResultsMap(updatedResults);
    setActiveQuiz(null);
    setIsReplayingClip(false);

    const allAnswered = sortedQuestions.every((q: any) => updatedResults[q.id] !== undefined);
    if (allAnswered && sortedQuestions.length > 0) {
      setIsPlaying(false);
      vqAudio.playFanfare();
      setTimeout(() => {
        setShowSummaryModal(true);
      }, 350);
    } else {
      setTimeout(() => {
        setIsPlaying(true);
      }, 250);
    }
  };

  const handleResetQuiz = () => {
    setResultsMap({});
    setActiveQuiz(null);
    setReviewingQuiz(null);
    setIsReplayingClip(false);
    setShowSummaryModal(false);
    setXp(0);
    setStreak(0);
    setWordsLearned(0);
    seekVideoTo(0);
    setIsPlaying(false);
  };

  const handleAddQuestionAtCurrentTime = () => {
    const nextId = questions.reduce((max: number, q: any) => Math.max(max, q.id || 0), 0) + 1;
    const triggerSec = Math.max(2, Math.round(currentTime || 10));
    const newQ = {
      id: nextId,
      timeTrigger: triggerSec,
      type: 'Multiple Choice',
      xp: 100,
      question: `What happens at ${formatSeconds(triggerSec)}?`,
      options: [
        { text: 'Correct answer', isCorrect: true },
        { text: 'Option B', isCorrect: false },
        { text: 'Option C', isCorrect: false },
        { text: 'Option D', isCorrect: false },
      ],
      explanation: 'Key detail from this moment in the video.',
    };
    const updated = [...questions, newQ].sort((a, b) => a.timeTrigger - b.timeTrigger);
    setQuestions(updated);
    setShowEditModal(true);
  };

  const nextUnanswered = sortedQuestions.find((q: any) => resultsMap[q.id] === undefined);
  const mastery = getMasteryGrade(accuracyPct, answeredIds.length);

  // Compute Category Analytics Breakdown
  const categoryStats = QUESTION_TYPES.map((type) => {
    const typeQuestions = sortedQuestions.filter((q) => q.type === type);
    if (typeQuestions.length === 0) return null;
    const answeredOfType = typeQuestions.filter((q) => resultsMap[q.id] !== undefined);
    const correctOfType = answeredOfType.filter((q) => resultsMap[q.id]?.isCorrect);
    const pct =
      answeredOfType.length > 0
        ? Math.round((correctOfType.length / answeredOfType.length) * 100)
        : null;
    return {
      type,
      total: typeQuestions.length,
      answered: answeredOfType.length,
      correct: correctOfType.length,
      pct,
    };
  }).filter(Boolean) as Array<{
    type: string;
    total: number;
    answered: number;
    correct: number;
    pct: number | null;
  }>;

  return (
    <div className="flex-1 w-full flex flex-col gap-3 pb-4 animate-vq-fade">
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-2xl flex items-center gap-2 animate-vq-pop">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {!isPlayOnlyMode && showEditModal && (
        <EditQuestionsModal
          questions={sortedQuestions}
          setQuestions={setQuestions}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveQuizModal
          user={user}
          config={config}
          videoUrl={videoUrl}
          localVideoName={localVideoName}
          isSaving={isSaving}
          onClose={() => setShowSaveModal(false)}
          onConfirmSave={async (saveData: any) => {
            const res = await onSaveQuiz(saveData);
            if (res?.ok) {
              setShowSaveModal(false);
            }
            setToastMessage(res?.message || 'Quiz Saved');
            setTimeout(() => setToastMessage(''), 3000);
          }}
        />
      )}

      {showSummaryModal && (
        <ResultsSummaryModal
          topic={config?.topic || 'Video Quiz'}
          questions={sortedQuestions}
          resultsMap={resultsMap}
          xp={xp}
          bestStreak={bestStreak}
          wordsLearned={wordsLearned}
          avgResponseTimeSec={avgResponseTimeSec}
          categoryStats={categoryStats}
          isPlayOnlyMode={isPlayOnlyMode}
          onReplay={handleResetQuiz}
          onSeekToQuestion={(q: any) => {
            setShowSummaryModal(false);
            setActiveQuiz(null);
            setIsPlaying(false);
            seekVideoTo(q.timeTrigger);
            if (resultsMap[q.id] !== undefined) {
              setReviewingQuiz(q);
            }
          }}
          onOpenSave={() => {
            setShowSummaryModal(false);
            setShowSaveModal(true);
          }}
          onClose={() => setShowSummaryModal(false)}
        />
      )}

      {/* TOP ZONE: FULL-SCREEN CINEMA VIDEO STAGE */}
      <div className="w-full flex flex-col bg-[#141026] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Compact Cinema Stage Control Header */}
        <div className="px-4 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5 bg-[#0F0C1D]">
          {/* Left: Title + Live Status Badge */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="vq-display font-extrabold text-white text-sm sm:text-base truncate">
              {config?.topic || localVideoName || 'Video Quiz'}
            </span>
            {activeQuiz ? (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wide flex items-center gap-1 animate-pulse shrink-0">
                <Zap size={12} fill="currentColor" />
                Question Active Below
              </span>
            ) : (
              <span className="text-xs font-semibold text-amber-400 whitespace-nowrap">
                {config?.level || 'All Levels'}
              </span>
            )}
          </div>

          {/* Center: Compact Non-Spoiler Question Status Pills */}
          <div className="hidden lg:flex items-center gap-1.5">
            {sortedQuestions.map((q: any, idx: number) => {
              const rec = resultsMap[q.id];
              const isAct = activeQuiz?.id === q.id;
              const isRev = reviewingQuiz?.id === q.id;

              let pillStyle = 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/25';
              if (isAct || isRev) {
                pillStyle = 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm scale-105';
              } else if (rec?.isCorrect === true) {
                pillStyle = 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300';
              } else if (rec?.isCorrect === false) {
                pillStyle = 'bg-rose-500/20 border-rose-400/50 text-rose-300';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    if (rec !== undefined) {
                      setIsPlaying(false);
                      seekVideoTo(q.timeTrigger);
                      setReviewingQuiz(q);
                    } else {
                      triggerQuizNow(q);
                    }
                  }}
                  title={
                    rec !== undefined
                      ? `Q${idx + 1} (${formatSeconds(q.timeTrigger)}) · Click to review`
                      : `Checkpoint ${idx + 1} at ${formatSeconds(q.timeTrigger)}`
                  }
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold vq-mono flex items-center gap-1 transition-all cursor-pointer ${pillStyle}`}
                >
                  <span>Q{idx + 1}</span>
                  {rec?.isCorrect === true && <Check size={11} strokeWidth={3} />}
                  {rec?.isCorrect === false && <X size={11} strokeWidth={3} />}
                  {rec === undefined && <span className="text-[10px] opacity-75">{formatSeconds(q.timeTrigger)}</span>}
                </button>
              );
            })}
          </div>

          {/* Right: Analytics, Reset, and Creator Actions (Hidden when saved & played) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSummaryModal(true)}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 hover:text-amber-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BarChart3 size={14} />
              <span>Analytics</span>
              {answeredIds.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 vq-mono text-[10px]">
                  {accuracyPct}%
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetQuiz}
              title="Reset Progress"
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {!isPlayOnlyMode && (
              <>
                <button
                  type="button"
                  onClick={onBackToSetup}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  Change Video
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings size={13} className="text-amber-400" />
                  <span>Edit Questions</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowSaveModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Folder size={13} />}
                  <span>{isSaving ? 'Saving...' : 'Save Quiz'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Full-Screen Cinema Video Viewport — NEVER dimmed or blocked when a question pops below! */}
        <div
          id="vq-video-stage"
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden transition-all duration-300 ${
            activeQuiz || reviewingQuiz
              ? 'h-[44vh] sm:h-[50vh] lg:h-[54vh] min-h-[260px]'
              : 'h-[60vh] sm:h-[68vh] lg:h-[72vh] min-h-[360px]'
          }`}
        >
          <div className="absolute inset-0 w-full h-full">
            {useNativeVideo ? (
              <video
                ref={nativeVideoRef}
                src={videoUrl}
                controls
                playsInline
                onTimeUpdate={(e) => evaluateTimeTrigger(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && Number.isFinite(dur)) setVideoDuration(dur);
                }}
                onPlay={() => (!activeQuiz || isReplayingClip) && setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  vqAudio.playFanfare();
                  setShowSummaryModal(true);
                }}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <Player
                ref={videoRef}
                src={videoUrl}
                width="100%"
                height="100%"
                playing={isPlaying && (!activeQuiz || isReplayingClip)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  setIsPlaying(false);
                  vqAudio.playFanfare();
                  setShowSummaryModal(true);
                }}
                onDurationChange={(e: any) => {
                  const duration = e?.currentTarget?.duration || e?.target?.duration || 120;
                  if (duration && Number.isFinite(duration)) setVideoDuration(duration);
                }}
                controls={true}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            )}
          </div>

          {/* Center Play Button Overlay (only when paused and no active question below) */}
          {!isPlaying && !activeQuiz && !reviewingQuiz && (
            <div
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 cursor-pointer group"
            >
              <button
                type="button"
                aria-label="Play video"
                className="w-20 h-20 rounded-full bg-amber-400 group-hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.55)] transition-transform duration-200 group-hover:scale-105 cursor-pointer"
              >
                <Play fill="currentColor" size={36} className="ml-1" />
              </button>
            </div>
          )}

          {/* Subtle Top-Right Scene Indicator when Question is Active Below (Does NOT cover video) */}
          {activeQuiz && (
            <div className="absolute top-3 right-3 z-10 pointer-events-none px-3 py-1.5 rounded-xl bg-black/75 border border-amber-400/50 text-amber-300 text-xs font-extrabold flex items-center gap-1.5 shadow-lg">
              <Eye size={14} />
              <span>
                {isReplayingClip
                  ? 'Replaying Scene...'
                  : `Scene Paused at ${formatSeconds(activeQuiz.timeTrigger)} — Answer Below`}
              </span>
            </div>
          )}

          {showConfetti && <Confetti />}
        </div>

        {/* Interactive Checkpoint Timeline & Transport Bar */}
        <div className="px-4 py-2.5 sm:px-5 bg-[#0F0C1D] border-t border-white/10 flex flex-col gap-2">
          {/* Scrubber Track with Clickable Checkpoint Pins */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seekVideoTo(ratio * (videoDuration || 120));
            }}
            className="relative h-2.5 bg-white/10 rounded-full cursor-pointer flex items-center group"
          >
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-pink-500 rounded-full transition-all duration-150"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />

            {sortedQuestions.map((q: any, idx: number) => {
              const leftPct = Math.min(98, Math.max(2, (q.timeTrigger / (videoDuration || 120)) * 100));
              const record = resultsMap[q.id];
              const isAct = activeQuiz?.id === q.id;
              const pinColor = isAct
                ? 'bg-amber-300 border-white text-slate-950 scale-125 ring-4 ring-amber-400/30'
                : record?.isCorrect === true
                ? 'bg-emerald-400 border-emerald-950 text-slate-950'
                : record?.isCorrect === false
                ? 'bg-rose-500 border-rose-950 text-white'
                : 'bg-amber-400 border-slate-950 text-slate-950';

              return (
                <button
                  key={q.id}
                  type="button"
                  title={`Checkpoint ${idx + 1} (${formatSeconds(q.timeTrigger)})`}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (record !== undefined) {
                      setIsPlaying(false);
                      seekVideoTo(q.timeTrigger);
                      setReviewingQuiz(q);
                    } else {
                      triggerQuizNow(q);
                    }
                  }}
                  style={{ left: `${leftPct}%` }}
                  className={`-translate-x-1/2 w-5 h-5 rounded-full border-2 text-[10px] font-black flex items-center justify-center shadow-md hover:scale-125 transition-transform z-10 cursor-pointer ${pinColor}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Transport Controls Row */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeQuiz && !isReplayingClip) {
                    handleReplayQuestionScene();
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                className="w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => seekVideoTo(currentTime - 5)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Back 5s"
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={() => seekVideoTo(currentTime + 5)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Forward 5s"
              >
                <SkipForward size={14} />
              </button>

              <span className="vq-mono text-xs font-bold text-slate-300 ml-1.5">
                {formatSeconds(currentTime)} <span className="text-slate-600">/</span> {formatSeconds(videoDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isPlayOnlyMode && (
                <button
                  type="button"
                  onClick={handleAddQuestionAtCurrentTime}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus size={13} className="text-amber-400" />
                  Add Q at {formatSeconds(currentTime)}
                </button>
              )}

              {activeQuiz ? (
                <button
                  type="button"
                  onClick={handleReplayQuestionScene}
                  className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  Replay Clip (-5s)
                </button>
              ) : nextUnanswered ? (
                <button
                  type="button"
                  onClick={() => triggerQuizNow(nextUnanswered)}
                  className="px-3.5 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Zap size={13} fill="currentColor" />
                  Next Question
                </button>
              ) : (
                answeredIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSummaryModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Award size={14} />
                    Full Analytics Report
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ZONE (DIRECTLY BELOW VIDEO): ACTIVE QUESTION DOCK OR LIVE QUESTIONS ANALYTICS */}
      <div ref={questionDockRef} className="w-full">
        {activeQuiz ? (
          <BelowVideoQuestionDock
            key={activeQuiz.id}
            quiz={activeQuiz}
            index={sortedQuestions.findIndex((q) => q.id === activeQuiz.id) + 1}
            total={sortedQuestions.length}
            isReplayingClip={isReplayingClip}
            onReplayScene={handleReplayQuestionScene}
            onComplete={handleQuizComplete}
            onSkip={() => {
              setActiveQuiz(null);
              setIsReplayingClip(false);
              setIsPlaying(true);
            }}
          />
        ) : reviewingQuiz ? (
          <BelowVideoReviewCard
            quiz={reviewingQuiz}
            index={sortedQuestions.findIndex((q) => q.id === reviewingQuiz.id) + 1}
            total={sortedQuestions.length}
            record={resultsMap[reviewingQuiz.id]}
            onReplayClip={() => {
              seekVideoTo(Math.max(0, reviewingQuiz.timeTrigger - 4));
              setIsPlaying(true);
            }}
            onCloseReview={() => {
              setReviewingQuiz(null);
            }}
          />
        ) : (
          <LiveQuestionsAnalyticsDeck
            sortedQuestions={sortedQuestions}
            resultsMap={resultsMap}
            xp={xp}
            streak={streak}
            bestStreak={bestStreak}
            wordsLearned={wordsLearned}
            accuracyPct={accuracyPct}
            correctCount={correctCount}
            missedCount={missedCount}
            avgResponseTimeSec={avgResponseTimeSec}
            fastestResponseSec={fastestResponseSec}
            mastery={mastery}
            categoryStats={categoryStats}
            onSelectAnsweredQuestion={(q: any) => {
              setIsPlaying(false);
              seekVideoTo(q.timeTrigger);
              setReviewingQuiz(q);
            }}
            onTriggerUpcomingQuestion={(q: any) => {
              triggerQuizNow(q);
            }}
            onOpenFullAnalytics={() => setShowSummaryModal(true)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Below-Video Interactive Question Dock
 * Keeps the video 100% visible above while showing the active question & answer choices below.
 */
function BelowVideoQuestionDock({
  quiz,
  index,
  total,
  isReplayingClip,
  onReplayScene,
  onComplete,
  onSkip,
}: any) {
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [finalTimeSec, setFinalTimeSec] = useState<number>(0);
  const startTimeRef = useRef<number>(performance.now());

  useEffect(() => {
    startTimeRef.current = performance.now();
    setElapsedSec(0);
    const interval = setInterval(() => {
      setElapsedSec(Number(((performance.now() - startTimeRef.current) / 1000).toFixed(1)));
    }, 100);
    return () => clearInterval(interval);
  }, [quiz.id]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (showExplanation) return;
      const timeTaken = Math.max(
        0.5,
        Number(((performance.now() - startTimeRef.current) / 1000).toFixed(1))
      );
      setFinalTimeSec(timeTaken);
      setSelected(idx);
      setShowExplanation(true);
      const isCorrect = Boolean(quiz.options?.[idx]?.isCorrect);
      if (isCorrect) vqAudio.playCorrect();
      else vqAudio.playWrong();
    },
    [showExplanation, quiz]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!showExplanation) {
        const key = e.key.toUpperCase();
        const numIdx = ['1', '2', '3', '4'].indexOf(key);
        const charIdx = ['A', 'B', 'C', 'D'].indexOf(key);
        const idx = numIdx >= 0 ? numIdx : charIdx;
        if (idx >= 0 && idx < (quiz.options?.length || 0)) {
          e.preventDefault();
          handleSelect(idx);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onComplete({
          isCorrect: Boolean(quiz.options?.[selected!]?.isCorrect),
          selectedIndex: selected ?? 0,
          responseTimeSec: finalTimeSec || elapsedSec || 2.0,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showExplanation, selected, finalTimeSec, elapsedSec, quiz, handleSelect, onComplete]);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const letters = ['A', 'B', 'C', 'D'];
  const optionCount = (quiz.options || []).length;

  return (
    <div className="w-full bg-[#161229] border-2 border-amber-400/50 rounded-2xl p-4 sm:p-5 shadow-[0_10px_40px_rgba(0,0,0,0.6)] animate-vq-pop text-white">
      {/* Top Bar: Question Badge + Timer + Replay Scene + Listen + Skip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black">
            Question {index} of {total}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 font-bold">
            {quiz.type}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-amber-300 vq-mono font-bold">
            @{formatSeconds(quiz.timeTrigger)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 vq-mono font-bold flex items-center gap-1">
            <Clock size={12} className="text-amber-400" />
            {showExplanation ? `${finalTimeSec}s` : `${elapsedSec.toFixed(1)}s`}
          </span>
          <span className="vq-mono font-extrabold text-amber-400 ml-1">
            +{quiz.xp || 100} XP
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReplayScene}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            {isReplayingClip ? 'Replaying above...' : 'Watch Scene Again (-5s)'}
          </button>

          <button
            type="button"
            onClick={() => speakText(quiz.word ? `${quiz.word}. ${quiz.question}` : quiz.question)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 size={13} className="text-amber-400" />
            Read Aloud
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold cursor-pointer"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Question Prompt & Optional Vocabulary Chip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <h2 className="vq-display text-base sm:text-xl font-extrabold text-white leading-snug">
          {quiz.question}
        </h2>

        {quiz.word && (
          <div className="px-3.5 py-2 rounded-xl bg-[#0E0B1A] border border-amber-400/30 flex items-center gap-3 shrink-0">
            <div>
              <span className="vq-display text-base font-black text-amber-400 tracking-wide">
                {quiz.word}
              </span>
              {quiz.pronunciation && (
                <span className="text-xs text-slate-400 ml-2 vq-mono">{quiz.pronunciation}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => speakText(quiz.word)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-amber-400 cursor-pointer"
              title="Pronounce word"
            >
              <Volume2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Answer Options Grid — Below the Video */}
      <div
        className={`grid gap-2.5 ${
          optionCount === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {(quiz.options || []).map((opt: any, idx: number) => {
          let btnStyle =
            'bg-[#0E0B1A] border-white/15 text-slate-100 hover:border-amber-400 hover:bg-white/5';
          let badgeStyle = 'bg-white/10 text-amber-300';

          if (showExplanation) {
            if (opt.isCorrect) {
              btnStyle = 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]';
              badgeStyle = 'bg-emerald-400 text-slate-950';
            } else if (selected === idx) {
              btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-200';
              badgeStyle = 'bg-rose-500 text-white';
            } else {
              btnStyle = 'bg-[#0E0B1A]/50 border-white/5 text-slate-500 opacity-60';
              badgeStyle = 'bg-white/5 text-slate-500';
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={showExplanation}
              onClick={() => handleSelect(idx)}
              className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
            >
              <span
                className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
              >
                {letters[idx] || idx + 1}
              </span>
              <span className="text-xs sm:text-sm font-bold leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Instant Answer Explanation & Continue Bar */}
      {showExplanation && (
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 animate-vq-fade">
          <div className="flex items-start gap-2.5 text-left">
            {quiz.options[selected!]?.isCorrect ? (
              <CheckCircle size={19} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={19} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              <span
                className={`font-extrabold mr-2 ${
                  quiz.options[selected!]?.isCorrect ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {quiz.options[selected!]?.isCorrect
                  ? `Correct! (+${quiz.xp || 100} XP in ${finalTimeSec}s)`
                  : `Not quite (${finalTimeSec}s).`}
              </span>
              <span className="text-slate-300">{quiz.explanation}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onComplete({
                isCorrect: Boolean(quiz.options[selected!]?.isCorrect),
                selectedIndex: selected ?? 0,
                responseTimeSec: finalTimeSec || 2.0,
              })
            }
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap shadow-lg"
          >
            Continue Video
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Below-Video Answered Question Review Card
 * Lets players or teachers inspect an already-answered question below the video while viewing the scene above.
 */
function BelowVideoReviewCard({
  quiz,
  index,
  total,
  record,
  onReplayClip,
  onCloseReview,
}: any) {
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="w-full bg-[#161229] border border-white/15 rounded-2xl p-4 sm:p-5 shadow-xl animate-vq-pop text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-2.5 py-1 rounded-lg font-extrabold ${
              record?.isCorrect
                ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-400/40'
            }`}
          >
            {record?.isCorrect ? '✓ Answered Correctly' : '✗ Missed Question'}
          </span>
          <span className="text-slate-300 font-bold">
            Question {index} of {total}
          </span>
          <span className="text-amber-400 vq-mono font-bold">@{formatSeconds(quiz.timeTrigger)}</span>
          {record?.responseTimeSec ? (
            <span className="text-slate-400 vq-mono">· {record.responseTimeSec}s</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReplayClip}
            className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={12} />
            Replay Scene
          </button>
          <button
            type="button"
            onClick={onCloseReview}
            className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
          >
            Back to Analytics
          </button>
        </div>
      </div>

      <h3 className="vq-display text-base sm:text-lg font-extrabold text-white mb-3">
        {quiz.question}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {(quiz.options || []).map((opt: any, idx: number) => {
          const isChosen = record?.selectedIndex === idx;
          const isRight = Boolean(opt.isCorrect);
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border text-xs font-bold flex items-start gap-2.5 ${
                isRight
                  ? 'bg-emerald-500/20 border-emerald-400 text-white'
                  : isChosen
                  ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : 'bg-[#0E0B1A] border-white/10 text-slate-400'
              }`}
            >
              <span
                className={`w-5 h-5 rounded text-[11px] font-black flex items-center justify-center shrink-0 ${
                  isRight
                    ? 'bg-emerald-400 text-slate-950'
                    : isChosen
                    ? 'bg-rose-500 text-white'
                    : 'bg-white/10 text-slate-400'
                }`}
              >
                {letters[idx] || idx + 1}
              </span>
              <span>{opt.text}</span>
            </div>
          );
        })}
      </div>

      {quiz.explanation && (
        <div className="mt-3 text-xs text-slate-300 bg-[#0E0B1A] p-3 rounded-xl border border-white/10">
          <span className="font-bold text-amber-400 mr-1.5">Explanation:</span>
          {quiz.explanation}
        </div>
      )}
    </div>
  );
}

/**
 * Live Questions Analytics Deck (Below the Video when no question is actively popping)
 * Shows rich real-time question analytics without spoiling upcoming unanswered questions.
 */
function LiveQuestionsAnalyticsDeck({
  sortedQuestions,
  resultsMap,
  xp,
  streak,
  bestStreak,
  wordsLearned,
  accuracyPct,
  correctCount,
  missedCount,
  avgResponseTimeSec,
  fastestResponseSec,
  mastery,
  categoryStats,
  onSelectAnsweredQuestion,
  onTriggerUpcomingQuestion,
  onOpenFullAnalytics,
}: any) {
  const total = sortedQuestions.length || 1;
  const answeredCount = correctCount + missedCount;
  const remainingCount = Math.max(0, sortedQuestions.length - answeredCount);

  return (
    <div className="w-full bg-[#141026] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col gap-4">
      {/* Top Row: Live Analytics KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Accuracy & Mastery Grade */}
        <div className="bg-[#0E0B1A] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Target size={13} className="text-emerald-400" />
              Accuracy Rate
            </div>
            <div className="vq-mono text-xl sm:text-2xl font-black text-white mt-0.5">
              {answeredCount > 0 ? `${accuracyPct}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-400">
              {correctCount} correct · {missedCount} missed
            </div>
          </div>
          <div className={`px-3 py-2 rounded-xl border text-center shrink-0 ${mastery.bg}`}>
            <div className={`vq-display text-lg font-black leading-none ${mastery.color}`}>
              {mastery.grade}
            </div>
            <div className="text-[10px] font-bold text-slate-300 mt-0.5">{mastery.label}</div>
          </div>
        </div>

        {/* KPI 2: Segmented Question Progress */}
        <div className="bg-[#0E0B1A] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>Question Progress</span>
            <span className="vq-mono text-white">
              {answeredCount} / {sortedQuestions.length}
            </span>
          </div>
          {/* Multi-segment bar */}
          <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden flex my-2">
            {correctCount > 0 && (
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${(correctCount / total) * 100}%` }}
                title={`${correctCount} Correct`}
              />
            )}
            {missedCount > 0 && (
              <div
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${(missedCount / total) * 100}%` }}
                title={`${missedCount} Missed`}
              />
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-emerald-400 font-semibold">{correctCount} Passed</span>
            <span>{remainingCount} Remaining</span>
          </div>
        </div>

        {/* KPI 3: Response Speed Analytics */}
        <div className="bg-[#0E0B1A] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Clock size={13} className="text-amber-400" />
              Response Speed
            </div>
            <div className="vq-mono text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
              {answeredCount > 0 ? `${avgResponseTimeSec}s` : '—'}
            </div>
            <div className="text-[11px] text-slate-400">
              {answeredCount > 0 ? `Fastest: ${fastestResponseSec}s` : 'Avg time per question'}
            </div>
          </div>
          {categoryStats.length > 0 && (
            <div className="hidden sm:flex flex-col gap-1 text-right">
              {categoryStats.slice(0, 2).map((cs) => (
                <div key={cs.type} className="text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">{cs.type.split(' ')[0]}:</span>{' '}
                  <span className="vq-mono font-bold text-amber-300">
                    {cs.pct !== null ? `${cs.pct}%` : `${cs.answered}/${cs.total}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KPI 4: Score XP & Streak Multiplier */}
        <div className="bg-[#0E0B1A] border border-white/10 rounded-xl p-3.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <Trophy size={13} className="text-pink-400" />
              Total Score & Streak
            </div>
            <div className="vq-mono text-xl sm:text-2xl font-black text-white mt-0.5">
              {xp} <span className="text-xs font-bold text-amber-400">XP</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Best Streak: <span className="text-rose-400 font-bold">{bestStreak}</span> · Vocab:{' '}
              <span className="text-emerald-400 font-bold">{wordsLearned}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenFullAnalytics}
            className="px-3 py-2 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-extrabold flex flex-col items-center justify-center shrink-0 cursor-pointer transition-colors"
          >
            <BarChart3 size={16} />
            <span className="text-[10px] mt-0.5">Report</span>
          </button>
        </div>
      </div>

      {/* Bottom Row: Question-by-Question Status Cards (Answered questions show review; Unanswered stay locked without spoilers!) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <BarChart3 size={14} className="text-amber-400" />
            Questions & Analytics Timeline (Questions pop here below the video as you watch)
          </span>
          {answeredCount > 0 && (
            <button
              type="button"
              onClick={onOpenFullAnalytics}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              View Full Breakdown →
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {sortedQuestions.map((q: any, idx: number) => {
            const rec: QuizAnswerRecord | undefined = resultsMap[q.id];
            const isAnswered = rec !== undefined;

            if (isAnswered) {
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onSelectAnsweredQuestion(q)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    rec.isCorrect
                      ? 'bg-emerald-500/10 border-emerald-400/40 hover:border-emerald-400'
                      : 'bg-rose-500/10 border-rose-400/40 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold text-white">Q{idx + 1}</span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded vq-mono ${
                        rec.isCorrect
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {rec.isCorrect ? `+${rec.earnedXp} XP` : 'Missed'}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-200 line-clamp-1">
                    {q.question}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 vq-mono">
                    <span>@{formatSeconds(q.timeTrigger)}</span>
                    <span>{rec.responseTimeSec}s</span>
                  </div>
                </button>
              );
            }

            // Unanswered Question Card — Locked (No question text spoiler!)
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onTriggerUpcomingQuestion(q)}
                title={`Jump to Question ${idx + 1} at ${formatSeconds(q.timeTrigger)}`}
                className="p-3 rounded-xl border border-white/10 bg-[#0E0B1A] hover:border-amber-400/40 text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 group"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold text-slate-300 group-hover:text-white">
                    Question {idx + 1}
                  </span>
                  <span className="text-[10px] font-bold vq-mono px-1.5 py-0.5 rounded bg-white/5 text-amber-400">
                    {formatSeconds(q.timeTrigger)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <HelpCircle size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate">{q.type}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-semibold group-hover:text-amber-300 transition-colors">
                  Unlocks at {formatSeconds(q.timeTrigger)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SaveQuizModal({
  user,
  config,
  videoUrl,
  localVideoName,
  isSaving,
  onClose,
  onConfirmSave,
}: any) {
  const isBlobUrl = Boolean(videoUrl && videoUrl.startsWith('blob:'));
  const [title, setTitle] = useState(config?.topic || localVideoName?.replace(/\.[^/.]+$/, '') || 'Video Quiz');
  const [className, setClassName] = useState(config?.className || config?.level || 'A2 Movers');
  const [folders, setFolders] = useState<UnifiedFolderItem[]>(() => mergeUserFolders(user?.uid));
  const [selectedFolderId, setSelectedFolderId] = useState<string>(config?.folderId || '');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderBusy, setCreatingFolderBusy] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(config?.isPublic ?? true);
  const [webUrlFallback, setWebUrlFallback] = useState(isBlobUrl ? '' : videoUrl || '');

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      fetchAllAvailableFolders(db, user.uid).then((list) => {
        if (active && Array.isArray(list)) {
          setFolders(list);
          if (!selectedFolderId && config?.folder) {
            const match = list.find(
              (f) => f.name.toLowerCase().trim() === String(config.folder).toLowerCase().trim()
            );
            if (match) setSelectedFolderId(match.id);
          }
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user?.uid, config?.folder]);

  const handleCreateNewFolder = async () => {
    const clean = newFolderName.trim();
    if (!clean || creatingFolderBusy) return;
    setCreatingFolderBusy(true);
    try {
      const created = await createUnifiedFolder(db, user?.uid, clean);
      const next = mergeUserFolders(user?.uid, [created], folders);
      setFolders(next);
      setSelectedFolderId(created.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } finally {
      setCreatingFolderBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedFolder = folders.find((f) => String(f.id) === String(selectedFolderId));
    onConfirmSave({
      title: title.trim() || 'Video Quiz',
      className: className.trim(),
      folderId: selectedFolderId,
      folderName: matchedFolder?.name || '',
      isPublic,
      videoUrlOverride: isBlobUrl && webUrlFallback.trim() ? webUrlFallback.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-vq-pop">
      <form
        onSubmit={handleSubmit}
        className="bg-[#161229] border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        <div className="px-6 py-4 bg-[#120E22] border-b border-white/10 flex justify-between items-center">
          <h2 className="vq-display text-lg font-extrabold text-white flex items-center gap-2">
            <Folder size={18} className="text-amber-400" />
            Save Video Quiz
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] vq-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Quiz Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Ocean Wildlife Video Quiz"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-semibold text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Class / Level
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Grade 4 · A2"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-semibold text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Folder</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus size={12} />
                  {isCreatingFolder ? 'Cancel' : 'New Folder'}
                </button>
              </div>

              {isCreatingFolder ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0E0B1A] border border-amber-400/50 text-xs font-semibold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={creatingFolderBusy || !newFolderName.trim()}
                    onClick={handleCreateNewFolder}
                    className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-semibold text-white"
                >
                  <option value="">No Folder (All Games)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isPublic
                    ? 'bg-amber-400/15 border-amber-400 text-white'
                    : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe size={16} className={isPublic ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Public Library</div>
                  <div className="text-[10px] text-slate-400 truncate">Shared with teachers</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  !isPublic
                    ? 'bg-pink-500/15 border-pink-400 text-white'
                    : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={16} className={!isPublic ? 'text-pink-400 shrink-0' : 'text-slate-500 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Private</div>
                  <div className="text-[10px] text-slate-400 truncate">Only in My Games</div>
                </div>
              </button>
            </div>
          </div>

          {isBlobUrl && (
            <div className="p-3.5 rounded-2xl bg-[#0E0B1A] border border-amber-400/30 space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>
                  You uploaded a local video file (<strong>{localVideoName}</strong>). Your checkpoints will be saved, or you can paste an online video URL below to link permanently:
                </span>
              </div>
              <input
                type="text"
                value={webUrlFallback}
                onChange={(e) => setWebUrlFallback(e.target.value)}
                placeholder="Optional: https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-lg bg-[#161229] border border-white/15 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#120E22] border-t border-white/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isSaving ? 'Saving...' : 'Save Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResultsSummaryModal({
  topic,
  questions,
  resultsMap,
  xp,
  bestStreak,
  wordsLearned,
  avgResponseTimeSec,
  categoryStats,
  isPlayOnlyMode,
  onReplay,
  onSeekToQuestion,
  onOpenSave,
  onClose,
}: any) {
  const total = questions.length || 1;
  const answeredCount = Object.keys(resultsMap).length;
  const correctCount = Object.values(resultsMap).filter((r: any) => r?.isCorrect).length;
  const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;
  const mastery = getMasteryGrade(accuracy, answeredCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-vq-pop">
      <div className="bg-[#161229] border border-white/15 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        {/* Header */}
        <div className="px-6 py-4 bg-[#120E22] border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`px-3.5 py-2 rounded-2xl border text-center ${mastery.bg}`}>
              <div className={`vq-display text-xl font-black leading-none ${mastery.color}`}>
                {mastery.grade}
              </div>
              <div className="text-[10px] font-bold text-slate-300 mt-0.5">{mastery.label}</div>
            </div>
            <div>
              <span className="text-xs font-bold text-amber-400">Questions Analytics & Performance Report</span>
              <h2 className="vq-display text-lg sm:text-2xl font-black text-white">
                {topic}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <XCircle size={22} />
          </button>
        </div>

        {/* Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 p-4 bg-[#0E0B1A] border-b border-white/10 text-center">
          <div className="p-3 rounded-2xl bg-[#161229] border border-white/10">
            <div className="vq-mono text-xl font-black text-emerald-400">
              {answeredCount > 0 ? `${accuracy}%` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">
              Accuracy ({correctCount}/{answeredCount || questions.length})
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-[#161229] border border-white/10">
            <div className="vq-mono text-xl font-black text-amber-400">
              {xp}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">Total XP</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#161229] border border-white/10">
            <div className="vq-mono text-xl font-black text-sky-400">
              {answeredCount > 0 ? `${avgResponseTimeSec}s` : '—'}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">Avg Response</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#161229] border border-white/10">
            <div className="vq-mono text-xl font-black text-rose-400">
              {bestStreak}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">Best Streak</div>
          </div>
          <div className="p-3 rounded-2xl bg-[#161229] border border-white/10 col-span-2 sm:col-span-1">
            <div className="vq-mono text-xl font-black text-pink-400">
              {answeredCount}/{questions.length}
            </div>
            <div className="text-[11px] text-slate-400 font-semibold">Completed</div>
          </div>
        </div>

        {/* Category Mastery Breakdown */}
        {Array.isArray(categoryStats) && categoryStats.length > 0 && (
          <div className="px-5 py-3 bg-[#120E22] border-b border-white/10 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Skill Breakdown:</span>
            {categoryStats.map((cs: any) => (
              <div
                key={cs.type}
                className="px-2.5 py-1 rounded-lg bg-[#161229] border border-white/10 text-xs flex items-center gap-2"
              >
                <span className="font-bold text-slate-200">{cs.type}</span>
                <span className="vq-mono font-extrabold text-amber-400">
                  {cs.pct !== null ? `${cs.pct}% (${cs.correct}/${cs.answered})` : `0/${cs.total}`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Question-by-Question Review List (Unanswered questions remain spoiler-free mid-game) */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 vq-scrollbar">
          {questions.map((q: any, idx: number) => {
            const rec: QuizAnswerRecord | undefined = resultsMap[q.id];
            const isAnswered = rec !== undefined;
            const correctOpt = (q.options || []).find((o: any) => o.isCorrect);
            const chosenOpt = isAnswered ? q.options?.[rec.selectedIndex] : null;

            if (!isAnswered) {
              return (
                <div
                  key={q.id}
                  className="p-3.5 rounded-2xl border border-white/10 bg-[#0E0B1A] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-400 font-bold">
                      Question {idx + 1}
                    </span>
                    <span className="text-slate-400">{q.type}</span>
                    <span className="text-slate-500">· Not answered yet</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSeekToQuestion(q)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-amber-300 vq-mono cursor-pointer"
                  >
                    Watch at {formatSeconds(q.timeTrigger)}
                  </button>
                </div>
              );
            }

            return (
              <div
                key={q.id}
                className={`p-4 rounded-2xl border ${
                  rec?.isCorrect === true
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-rose-500/10 border-rose-500/30'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-extrabold ${
                        rec?.isCorrect === true ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {rec?.isCorrect === true ? `✓ Correct (+${rec.earnedXp} XP)` : '✗ Missed'}
                    </span>
                    <span aria-hidden="true" className="text-white/20">·</span>
                    <span className="text-slate-300 font-bold">Q{idx + 1} ({q.type})</span>
                    <span aria-hidden="true" className="text-white/20">·</span>
                    <span className="text-slate-400 vq-mono">{rec.responseTimeSec}s response</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSeekToQuestion(q)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold text-amber-300 vq-mono cursor-pointer"
                  >
                    Inspect Scene @ {formatSeconds(q.timeTrigger)}
                  </button>
                </div>

                <p className="text-xs sm:text-sm font-bold text-white mb-2">
                  {q.question}
                </p>

                {rec?.isCorrect === false && chosenOpt && (
                  <div className="text-xs text-rose-300 mb-1">
                    Selected answer: <span className="font-semibold">{chosenOpt.text}</span>
                  </div>
                )}

                {correctOpt && (
                  <div className="text-xs text-emerald-300">
                    Correct answer: <span className="font-bold">{correctOpt.text}</span>
                  </div>
                )}

                {q.explanation && (
                  <div className="text-[11px] text-slate-400 mt-1.5">
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-[#120E22] border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={14} />
            Play Again
          </button>

          <div className="flex items-center gap-2.5">
            {!isPlayOnlyMode && (
              <button
                type="button"
                onClick={onOpenSave}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Folder size={14} />
                Save Quiz
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold cursor-pointer"
            >
              Back to Video
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditQuestionsModal({ questions, setQuestions, onClose }: any) {
  const [editedQuestions, setEditedQuestions] = useState<any[]>(() =>
    questions.map((q: any) => ({
      ...q,
      options: (q.options || []).map((o: any) => ({ ...o })),
    }))
  );

  const updateQuestionField = (id: number, field: string, value: any) => {
    setEditedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOptionText = (qId: number, optIdx: number, text: string) => {
    setEditedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = q.options.map((o: any, idx: number) =>
          idx === optIdx ? { ...o, text } : o
        );
        return { ...q, options: nextOpts };
      })
    );
  };

  const setCorrectOption = (qId: number, correctIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = q.options.map((o: any, idx: number) => ({
          ...o,
          isCorrect: idx === correctIdx,
        }));
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleDeleteQuestion = (id: number) => {
    if (editedQuestions.length <= 1) return;
    setEditedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddQuestion = () => {
    const nextId = editedQuestions.reduce((m, q) => Math.max(m, q.id || 0), 0) + 1;
    const lastTime = editedQuestions[editedQuestions.length - 1]?.timeTrigger || 15;
    setEditedQuestions((prev) => [
      ...prev,
      {
        id: nextId,
        timeTrigger: lastTime + 20,
        type: 'Multiple Choice',
        xp: 100,
        question: 'New checkpoint question?',
        options: [
          { text: 'Correct answer', isCorrect: true },
          { text: 'Wrong option 1', isCorrect: false },
          { text: 'Wrong option 2', isCorrect: false },
          { text: 'Wrong option 3', isCorrect: false },
        ],
        explanation: 'Explanation for the correct answer.',
      },
    ]);
  };

  const handleSave = () => {
    const sorted = [...editedQuestions].sort(
      (a, b) => Number(a.timeTrigger || 0) - Number(b.timeTrigger || 0)
    );
    setQuestions(sorted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-vq-pop">
      <div className="bg-[#161229] border border-white/15 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white">
        <div className="px-6 py-4 bg-[#120E22] border-b border-white/10 flex justify-between items-center">
          <h2 className="vq-display text-lg font-extrabold text-white flex items-center gap-2">
            <Settings size={18} className="text-amber-400" />
            Edit Video Questions ({editedQuestions.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Question
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-5 vq-scrollbar">
          {editedQuestions.map((q, index) => (
            <div
              key={q.id}
              className="bg-[#0E0B1A] p-4 rounded-2xl border border-white/10 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-400">
                  Question #{index + 1}
                </span>

                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-slate-400 font-semibold">
                    Time (sec):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={3600}
                    value={q.timeTrigger}
                    onChange={(e) =>
                      updateQuestionField(q.id, 'timeTrigger', Math.max(1, Number(e.target.value)))
                    }
                    className="w-20 px-2.5 py-1 rounded-lg bg-[#161229] border border-white/15 text-xs font-bold text-white vq-mono"
                  />

                  <select
                    value={q.type}
                    onChange={(e) => updateQuestionField(q.id, 'type', e.target.value)}
                    className="px-2.5 py-1 rounded-lg bg-[#161229] border border-white/15 text-xs font-semibold text-slate-200"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>

                  {editedQuestions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete question"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              <input
                type="text"
                value={q.question}
                onChange={(e) => updateQuestionField(q.id, 'question', e.target.value)}
                placeholder="Question prompt..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#161229] border border-white/15 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(q.options || []).map((opt: any, oIdx: number) => (
                  <div
                    key={oIdx}
                    className={`flex items-center gap-2 p-2 rounded-xl border ${
                      opt.isCorrect
                        ? 'bg-emerald-500/10 border-emerald-400/50'
                        : 'bg-[#161229] border-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCorrectOption(q.id, oIdx)}
                      title="Mark as correct answer"
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 cursor-pointer ${
                        opt.isCorrect
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={(e) => updateOptionText(q.id, oIdx, e.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-white focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-[#120E22] border-t border-white/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 cursor-pointer"
          >
            <Check size={15} />
            Save Questions
          </button>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: `${(i * 19) % 100}%`,
            top: `-16px`,
            backgroundColor: ['#f59e0b', '#ec4899', '#10b981', '#a855f7', '#fde047'][i % 5],
            animation: `vqConfetti ${1.4 + (i % 5) * 0.25}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            animationDelay: `${(i % 6) * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
