import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { GameModeModal } from '../components/GameModeModal';
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from '../components/SetupSmartControls';
import { parseOptionContent, formatOptionContent, AnswerContentMode } from '../utils/mediaAndPresets';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Sparkles,
  Save,
  X,
  Play,
  Image as ImageIcon,
  ClipboardList,
  Info,
  Settings,
  Copy,
  Flag,
  Volume2,
  VolumeX,
  Shuffle,
  Check,
  Smartphone,
  Camera,
  Gauge,
  Trophy,
  RotateCcw,
  Edit3,
  Users,
  User,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

type GameScreen = 'editor' | 'setup' | 'study' | 'game' | 'results';

export interface Question {
  id: number | string;
  text: string;
  image?: string;
  options: [string, string] | string[];
  answerIndex: number; // 0 or 1
}

interface Quiz {
  id: number | string;
  title?: string;
  subject?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  thumbnail?: string;
  isFavorite?: boolean;
  isPublic?: boolean;
}

const BLANK_QUESTION = (): Question => ({
  id: Date.now() + Math.random(),
  text: '',
  options: ['', ''],
  answerIndex: 0,
});

const SAMPLE_COASTER_QUESTIONS: Question[] = [
  { id: 101, text: 'She ___ to the theme park every summer.', options: ['goes', 'go'], answerIndex: 0 },
  { id: 102, text: 'Which force pulls the roller coaster down steep hills?', options: ['Gravity', 'Magnetism'], answerIndex: 0 },
  { id: 103, text: 'What is the past tense of "ride"?', options: ['Rode', 'Rided'], answerIndex: 0 },
  { id: 104, text: '7 × 8 = ?', options: ['56', '54'], answerIndex: 0 },
  { id: 105, text: 'Choose the correct spelling:', options: ['Necessary', 'Neccessary'], answerIndex: 0 },
  { id: 106, text: 'Which planet is known as the Red Planet?', options: ['Mars', 'Venus'], answerIndex: 0 },
  { id: 107, text: 'Antonym of "ANCIENT"?', options: ['Modern', 'Historic'], answerIndex: 0 },
  { id: 108, text: 'They ___ riding the roller coaster right now!', options: ['are', 'is'], answerIndex: 0 },
];

function normalizeToTwoOptions(rawQuestions: any[]): Question[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return [BLANK_QUESTION()];
  }
  return rawQuestions.map((q: any, idx: number) => {
    const rawOpts = Array.isArray(q.options) ? q.options : ['', ''];
    const origAnswerIdx = typeof q.answerIndex === 'number' ? q.answerIndex : (typeof q.correct === 'number' ? q.correct : 0);
    const correctOpt = rawOpts[origAnswerIdx] ?? rawOpts[0] ?? '';
    let secondOpt = rawOpts.find((_: any, i: number) => i !== origAnswerIdx && typeof _ === 'string' && _.trim() !== '');
    if (secondOpt === undefined) {
      secondOpt = rawOpts[origAnswerIdx === 0 ? 1 : 0] ?? '';
    }
    const keepOrder = origAnswerIdx === 1;
    return {
      id: q.id || Date.now() + idx + Math.random(),
      text: q.text || q.question || '',
      options: keepOrder ? [secondOpt, correctOpt] : [correctOpt, secondOpt],
      answerIndex: keepOrder ? 1 : 0,
    };
  });
}

export function RollerCoasterQuiz({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame &&
      ((initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
        (initialGame.questions && initialGame.questions.length > 0))
  );

  const [screen, setScreen] = useState<GameScreen>(
    initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor'
  );
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  // Setup & Ride Configuration State
  const [riderName, setRiderName] = useState('Captain Hammy');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1); // 0.7 = Slow, 1 = Normal, 1.45 = Fast
  const [timerMinutes, setTimerMinutes] = useState<number>(3); // 1 to 10 minutes countdown timer
  const [initialLives, setInitialLives] = useState<number>(3); // 1 to 5 heart lives for revive
  const [parkTheme, setParkTheme] = useState<'sunny' | 'sunset' | 'neon'>('sunny');
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [cameraLeanEnabled, setCameraLeanEnabled] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'group' | 'solo'>('group');
  const [studyIndex, setStudyIndex] = useState<number>(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame) {
      const qList =
        initialGame.customQuestions && initialGame.customQuestions.length > 0
          ? normalizeToTwoOptions(initialGame.customQuestions)
          : initialGame.questions && initialGame.questions.length > 0
          ? normalizeToTwoOptions(initialGame.questions)
          : [BLANK_QUESTION()];

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || 'Roller Coaster Quiz',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.classLevel || initialGame.className || '',
        questions: qList,
      };
    }
    return {
      id: Date.now(),
      title: 'Roller Coaster Quiz',
      folderId: '',
      topic: '',
      classLevel: '',
      questions: [BLANK_QUESTION()],
    };
  });

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const foldersSnap = await getDocs(qFolders);
          const f: any[] = [];
          foldersSnap.forEach((d) => f.push({ id: d.id, ...d.data() }));
          setFolders(f);
        } catch (err) {
          console.warn('Could not load folders:', err);
        }
      };
      fetchFolders();
    }
  }, [user]);

  useEffect(() => {
    if (initialGame) {
      const qList =
        initialGame.customQuestions && initialGame.customQuestions.length > 0
          ? normalizeToTwoOptions(initialGame.customQuestions)
          : initialGame.questions && initialGame.questions.length > 0
          ? normalizeToTwoOptions(initialGame.questions)
          : [BLANK_QUESTION()];

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || 'Roller Coaster Quiz',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions: qList,
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    }
  }, [initialGame]);

  const saveQuiz = async (quiz: Quiz) => {
    if (!user) {
      setActiveQuiz(quiz);
      setScreen('setup');
      return;
    }

    try {
      const isPublicBool = Boolean(quiz.isPublic);
      const now = new Date().toISOString();

      const isOwnExistingGame = Boolean(
        initialGame?.id &&
          !String(initialGame.id).startsWith('sample-') &&
          (!initialGame.userId || initialGame.userId === user.uid)
      );

      const normalizedQuestions = normalizeToTwoOptions(quiz.questions);

      const gameToSave = JSON.parse(
        JSON.stringify({
          name: quiz.title || quiz.topic || 'Roller Coaster Quiz',
          title: quiz.title || quiz.topic || 'Roller Coaster Quiz',
          folderId: quiz.folderId || '',
          topic: quiz.topic || '',
          className: quiz.classLevel || '',
          gameType: 'roller-coaster-quiz',
          customQuestions: normalizedQuestions,
          userId: user.uid,
          creatorName: user.displayName || user.email?.split('@')[0] || 'Teacher',
          creatorEmail: user.email || '',
          updatedAt: now,
          publishedAt: isPublicBool ? now : initialGame?.publishedAt || null,
          createdAt: isOwnExistingGame && initialGame?.createdAt ? initialGame.createdAt : now,
          isPublic: isPublicBool,
        })
      );

      if (isOwnExistingGame) {
        try {
          await updateDoc(doc(db, 'mysteryBoxGames', initialGame.id), gameToSave);
        } catch (err: any) {
          if (err?.code === 'not-found') {
            await addDoc(collection(db, 'mysteryBoxGames'), gameToSave);
          } else {
            throw err;
          }
        }
      } else {
        await addDoc(collection(db, 'mysteryBoxGames'), gameToSave);
      }
      onViewChange('games');
    } catch (error: any) {
      console.error('Error saving game:', error);
      onViewChange('games');
    }
  };

  // Study mode keyboard navigation
  useEffect(() => {
    if (screen !== 'study' || !activeQuiz) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (studyIndex < activeQuiz.questions.length - 1) {
          setStudyIndex((prev) => prev + 1);
          setStudySelectedOption(null);
        } else {
          setScreen('setup');
          setStudyIndex(0);
          setStudySelectedOption(null);
        }
      } else if (e.key === 'ArrowLeft') {
        if (studyIndex > 0) {
          setStudyIndex((prev) => prev - 1);
          setStudySelectedOption(null);
        } else {
          setScreen('setup');
          setStudyIndex(0);
          setStudySelectedOption(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, studyIndex, activeQuiz]);

  const getPlayableQuestions = (): Question[] => {
    const valid = (activeQuiz?.questions || []).filter(
      (q) => q.text && q.text.trim() !== '' && q.options.some((o) => o && o.trim() !== '')
    );
    if (valid.length > 0) {
      return normalizeToTwoOptions(valid);
    }
    return SAMPLE_COASTER_QUESTIONS;
  };

  return (
    <div
      id="coaster-game-container"
      className="w-full min-h-full flex-1 bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white flex flex-col font-['Fredoka',sans-serif] overflow-hidden relative selection:bg-amber-500/30 rounded-xl"
    >
      {/* Top Left Navigation Controls (Editor & Setup Screens) */}
      {screen !== 'game' && screen !== 'study' && (
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-3">
          <button
            onClick={() => onViewChange('home')}
            className="flex items-center gap-2 p-2.5 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/60 dark:bg-black/30 hover:bg-slate-300/60 dark:hover:bg-black/60 border-slate-300/60 dark:border-white/20 cursor-pointer shadow-md"
            title="Back to Home"
          >
            <ArrowLeft size={22} />
          </button>

          <button
            onClick={() => setShowModeModal(true)}
            className="px-3.5 py-2 rounded-full bg-slate-900/70 hover:bg-slate-900/90 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Play this lesson in Bubble Pop, Yoga Quiz, or Sumo"
          >
            <Shuffle size={14} className="text-amber-400" />
            <span>Switch Mode</span>
          </button>
        </div>
      )}

      {screen !== 'game' && screen !== 'study' && (
        <div className="absolute top-4 right-4 z-[70] flex gap-3 pointer-events-auto">
          <FullscreenButton targetId="coaster-game-container" className="" />
        </div>
      )}

      {/* SCREEN 1: EDITOR (Identical workflow to BubblePop, strictly limited to 2 Options) */}
      {screen === 'editor' && activeQuiz && (
        <CoasterQuizEditor
          quiz={activeQuiz}
          onSave={saveQuiz}
          onPlayNow={(updatedQuiz) => {
            setActiveQuiz(updatedQuiz);
            setScreen('setup');
          }}
          onCancel={() => onViewChange('games')}
          folders={folders}
        />
      )}

      {/* SCREEN 2: SETUP (Pre-Game Setup with Timer 1-10m Slider, Lives, Difficulty Slow-to-Fast, Voice On/Off & Webcam Steering) */}
      {screen === 'setup' && (
        <div
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-6 sm:p-8 overflow-y-auto backdrop-blur-sm transition-colors duration-700 ${
            parkTheme === 'sunset'
              ? 'bg-gradient-to-b from-orange-500/90 via-rose-500/90 to-indigo-900/95'
              : parkTheme === 'neon'
              ? 'bg-gradient-to-b from-slate-950/95 via-indigo-950/95 to-fuchsia-950/95'
              : 'bg-gradient-to-b from-sky-500/90 via-blue-500/90 to-indigo-800/90 dark:from-sky-900/95 dark:to-slate-950/95'
          }`}
        >
          {/* Floating Theme Park Clouds & Stars Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-12 left-12 w-40 h-40 bg-amber-300/25 rounded-full blur-3xl"></div>
            <div className="absolute bottom-16 right-16 w-56 h-56 bg-rose-400/20 rounded-full blur-3xl"></div>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-6xl my-auto py-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs sm:text-sm font-black uppercase tracking-widest mb-3 shadow-lg">
              <span>🎢 3D Theme Park Challenge · 2-Track Split Edition</span>
            </div>
            <h2
              className="text-4xl sm:text-6xl md:text-7xl font-black mb-8 text-white drop-shadow-[0_6px_0_rgba(15,23,42,0.7)] text-center tracking-tight"
              style={{ WebkitTextStroke: '1.5px #0f172a' }}
            >
              ROLLER COASTER QUIZ
            </h2>

            <div className="flex flex-col xl:flex-row gap-6 w-full justify-center items-stretch relative z-10">
              {/* Left Setup Card */}
              <div className="flex-1 bg-white/15 dark:bg-slate-900/60 backdrop-blur-xl rounded-[2rem] border border-white/25 p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-white/15">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-3xl shadow-lg border-2 border-white/40">
                        🐹
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white">
                          {activeQuiz.topic || activeQuiz.title || 'Theme Park Coaster Run'}
                        </h3>
                        <p className="text-xs sm:text-sm text-sky-100/80 font-semibold">
                          {getPlayableQuestions().length} Track Junctions · 2 Options per Gate (Left vs. Right)
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setScreen('editor')}
                      className="px-4 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-white/25 transition-all cursor-pointer shrink-0"
                    >
                      <Edit3 size={15} />
                      <span>Edit Questions</span>
                    </button>
                  </div>

                  {/* Rider Name */}
                  <div className="mb-4">
                    <label className="text-xs font-black uppercase tracking-wider text-sky-100 block mb-2">
                      Coaster Pilot Name
                    </label>
                    <div className="flex gap-3 items-center">
                      <div className="w-11 h-11 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                        🎢
                      </div>
                      <input
                        type="text"
                        value={riderName}
                        onChange={(e) => setRiderName(e.target.value)}
                        className="flex-1 bg-black/25 text-white font-bold placeholder-white/50 border border-white/25 rounded-2xl px-4 py-2.5 outline-none focus:border-amber-400 transition-colors text-base"
                        placeholder="Enter Pilot or Team Name"
                      />
                    </div>
                  </div>

                  {/* Ride Settings Box */}
                  <div className="bg-black/25 p-4 sm:p-5 rounded-2xl border border-white/15 flex flex-col gap-4 mb-6">
                    {/* 1. Countdown Timer Slider (1 to 10 Minutes) */}
                    <div className="text-white pb-3 border-b border-white/10">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold flex items-center gap-2 text-sm sm:text-base">
                          <span>⏱️</span> Ride Timer (1 – 10 Minutes)
                        </span>
                        <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow">
                          {timerMinutes} {timerMinutes === 1 ? 'Minute' : 'Minutes'} ({timerMinutes}:00)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-white/75">1m</span>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          step={1}
                          value={timerMinutes}
                          onChange={(e) => setTimerMinutes(Number(e.target.value))}
                          className="w-full h-2.5 bg-white/25 rounded-lg appearance-none cursor-pointer accent-amber-400"
                        />
                        <span className="text-xs font-black text-white/75">10m</span>
                      </div>
                    </div>

                    {/* 2. Player Lives (Heart Revives before Game Over) */}
                    <div className="flex flex-wrap justify-between items-center gap-2 text-white pb-3 border-b border-white/10">
                      <div>
                        <span className="font-bold flex items-center gap-2 text-sm sm:text-base">
                          <span>❤️</span> Player Lives (Revives)
                        </span>
                        <span className="text-[11px] text-white/70 block">
                          Revive on crash until lives reach 0 (Game Over)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((lv) => (
                          <button
                            key={lv}
                            onClick={() => setInitialLives(lv)}
                            className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1 ${
                              initialLives === lv
                                ? 'bg-rose-500 text-white border-2 border-white shadow-[0_0_15px_rgba(244,63,94,0.65)] scale-105'
                                : 'bg-white/15 text-white hover:bg-white/25 border border-transparent'
                            }`}
                          >
                            <span>❤️</span>
                            <span>{lv}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Difficulty Level (Slow to Fast) */}
                    <div className="flex flex-wrap justify-between items-center gap-2 text-white pb-3 border-b border-white/10">
                      <span className="font-bold flex items-center gap-2 text-sm sm:text-base">
                        <Gauge size={18} className="text-amber-400" /> Difficulty (Slow to Fast)
                      </span>
                      <div className="flex gap-2">
                        {[
                          { label: 'Slow', val: 0.7 },
                          { label: 'Normal', val: 1 },
                          { label: 'Fast', val: 1.45 },
                        ].map((s) => (
                          <button
                            key={s.label}
                            onClick={() => setSpeedMultiplier(s.val)}
                            className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer ${
                              speedMultiplier === s.val
                                ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-105'
                                : 'bg-white/15 text-white hover:bg-white/25'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 4. Voice Question Reader (Voice On / Voice Off) */}
                    <div className="flex flex-wrap justify-between items-center gap-2 text-white pb-3 border-b border-white/10">
                      <span className="font-bold text-sm sm:text-base">Voice Question Reader</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setVoiceEnabled(true)}
                          className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            voiceEnabled
                              ? 'bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(52,211,153,0.6)] scale-105'
                              : 'bg-white/15 text-white hover:bg-white/25'
                          }`}
                        >
                          <Volume2 size={15} />
                          <span>Voice On</span>
                        </button>
                        <button
                          onClick={() => setVoiceEnabled(false)}
                          className={`px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                            !voiceEnabled
                              ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.6)] scale-105'
                              : 'bg-white/15 text-white hover:bg-white/25'
                          }`}
                        >
                          <VolumeX size={15} />
                          <span>Voice Off</span>
                        </button>
                      </div>
                    </div>

                    {/* 5. Optional Webcam Head-Tilt Steering */}
                    <div className="text-white space-y-2">
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-bold text-sm sm:text-base block">Webcam Head-Tilt Steering</span>
                          <span className="text-[11px] text-white/70">
                            Shows live camera above hamster &amp; steers when you lean Left/Right
                          </span>
                        </div>
                        <button
                          onClick={() => setCameraLeanEnabled(!cameraLeanEnabled)}
                          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                            cameraLeanEnabled ? 'bg-sky-400' : 'bg-white/30'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                              cameraLeanEnabled ? 'left-7' : 'left-1'
                            }`}
                          />
                        </button>
                      </div>

                      {cameraLeanEnabled && (
                        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-amber-300">
                            Tracking Mode:
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCameraMode('group')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                cameraMode === 'group'
                                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.5)] scale-105'
                                  : 'bg-white/15 text-white hover:bg-white/25'
                              }`}
                            >
                              <Users size={13} />
                              <span>Group Line Mode (3+ in Line)</span>
                            </button>
                            <button
                              onClick={() => setCameraMode('solo')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                cameraMode === 'solo'
                                  ? 'bg-sky-400 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.5)] scale-105'
                                  : 'bg-white/15 text-white hover:bg-white/25'
                              }`}
                            >
                              <User size={13} />
                              <span>Solo Pilot</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setScreen('game')}
                  className="w-full py-4 sm:py-5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black text-xl sm:text-2xl rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-3"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>START COASTER RIDE!</span>
                </button>
              </div>

              {/* Right Column: Park Time-of-Day Theme & Study Mode */}
              <div className="w-full xl:w-96 flex flex-col gap-6">
                <div className="w-full rounded-[2rem] bg-white/15 dark:bg-slate-900/60 backdrop-blur-xl border border-white/25 shadow-2xl p-6 flex flex-col justify-center flex-1">
                  <h3 className="text-xl sm:text-2xl font-black text-white mb-4 text-center drop-shadow-md">
                    Theme Park Atmosphere
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: 'sunny', name: 'Sunny Theme Park', desc: 'Bright blue skies, wildflowers & Ferris wheel', icon: '☀️' },
                      { id: 'sunset', name: 'Golden Sunset Carnival', desc: 'Warm golden hour glow & festival lights', icon: '🌅' },
                      { id: 'neon', name: 'Starlight Neon Park', desc: 'Cyber night coaster with glowing neon rails', icon: '🎡' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setParkTheme(t.id as any)}
                        className={`p-3.5 rounded-2xl flex items-center gap-3.5 transition-all text-left cursor-pointer border-2 ${
                          parkTheme === t.id
                            ? 'bg-white text-slate-900 border-amber-400 scale-[1.02] shadow-xl'
                            : 'bg-white/15 text-white border-transparent hover:bg-white/25'
                        }`}
                      >
                        <span className="text-3xl">{t.icon}</span>
                        <div>
                          <div className="font-black text-sm sm:text-base">{t.name}</div>
                          <div className={`text-xs ${parkTheme === t.id ? 'text-slate-600' : 'text-white/75'}`}>
                            {t.desc}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="group relative w-full h-40 rounded-[2rem] bg-white/15 dark:bg-slate-900/60 backdrop-blur-xl border border-white/25 shadow-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:bg-white/25 cursor-pointer flex items-center justify-center p-6 gap-5"
                >
                  <div className="text-6xl transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300 drop-shadow-xl">
                    📖
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <h3 className="text-2xl sm:text-3xl font-black text-white mb-1 drop-shadow-md">
                      Study Mode
                    </h3>
                    <p className="text-sky-100 font-medium text-xs sm:text-sm">
                      Review all {getPlayableQuestions().length} 2-choice questions before riding!
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8 relative z-10">
              <button
                onClick={() => onViewChange('games')}
                className="px-7 py-3.5 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-base sm:text-lg font-bold text-white border border-white/35 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <ArrowLeft size={20} /> Back to My Games
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: STUDY FLASHCARDS (2-Option Preview) */}
      {screen === 'study' && (
        <div
          className="absolute inset-0 z-[100] flex flex-col bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white overflow-hidden"
          id="coaster-study-container"
        >
          <div className="absolute top-4 left-4 z-20">
            <button
              onClick={() => {
                setScreen('setup');
                setStudyIndex(0);
                setStudySelectedOption(null);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full shadow-sm text-white font-bold transition-all cursor-pointer"
            >
              <ArrowLeft size={22} /> Back to Setup
            </button>
          </div>
          <div className="absolute top-4 right-4 z-20">
            <FullscreenButton targetId="coaster-study-container" />
          </div>

          {(() => {
            const studyQuestions = getPlayableQuestions();
            const currQ = studyQuestions[studyIndex] || studyQuestions[0];
            return (
              <>
                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-amber-300 font-extrabold text-lg bg-white/10 border border-white/20 px-6 py-2 rounded-full z-10 backdrop-blur-md">
                  Gate {studyIndex + 1} / {studyQuestions.length}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 w-full max-w-4xl mx-auto">
                  {(() => {
                    const parsedStudyQ = parseOptionContent(currQ?.text || '');
                    const studyQImg = parsedStudyQ.imageUrl || currQ?.image || null;
                    return (
                      <div className="flex flex-col items-center justify-center gap-4 mb-10">
                        {studyQImg && (
                          <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white/95 p-3 shadow-2xl border-4 border-amber-400/50 flex items-center justify-center overflow-hidden">
                            <img src={studyQImg} alt={parsedStudyQ.text || 'Question Media'} className="w-full h-full object-contain rounded-2xl" />
                          </div>
                        )}
                        {parsedStudyQ.text && (
                          <h1 className="text-3xl sm:text-5xl font-black text-white text-center drop-shadow-lg">
                            {parsedStudyQ.text}
                          </h1>
                        )}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl">
                    {currQ?.options.slice(0, 2).map((opt, i) => {
                      const isSelected = studySelectedOption === i;
                      const isCorrect = i === currQ.answerIndex;
                      const showAsCorrect = studySelectedOption !== null && isCorrect;
                      const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;

                      return (
                        <button
                          key={i}
                          onClick={() => {
                            if (studySelectedOption === null) setStudySelectedOption(i);
                          }}
                          disabled={studySelectedOption !== null}
                          className={`relative p-6 sm:p-8 rounded-[2rem] text-2xl sm:text-3xl font-bold transition-all duration-300 border-2 cursor-pointer ${
                            showAsCorrect
                              ? 'bg-emerald-500 border-emerald-300 text-white shadow-[0_0_40px_rgba(16,185,129,0.5)] scale-105'
                              : showAsIncorrect
                              ? 'bg-rose-500 border-rose-300 text-white opacity-90 scale-95'
                              : 'bg-white/10 text-white hover:bg-white/20 border-white/20 hover:border-amber-400'
                          }`}
                        >
                          <div className="text-xs uppercase tracking-widest opacity-75 mb-2">
                            {i === 0 ? '◀ Option A' : 'Option B ▶'}
                          </div>
                          <div className="flex items-center justify-center gap-3">
                            {(() => {
                              const parsed = parseOptionContent(opt);
                              return (
                                <>
                                  {parsed.imageUrl && (
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white p-2 shadow-xl flex items-center justify-center shrink-0 border-2 border-white/60">
                                      <img
                                        src={parsed.imageUrl}
                                        alt={parsed.text || 'Option'}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                  )}
                                  {parsed.text && <span>{parsed.text}</span>}
                                </>
                              );
                            })()}
                            {showAsCorrect && <span>✅</span>}
                            {showAsIncorrect && <span>❌</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {studySelectedOption !== null && (
                    <button
                      onClick={() => {
                        if (studyIndex < studyQuestions.length - 1) {
                          setStudyIndex(studyIndex + 1);
                          setStudySelectedOption(null);
                        } else {
                          setScreen('setup');
                          setStudyIndex(0);
                          setStudySelectedOption(null);
                        }
                      }}
                      className="mt-10 px-10 py-4 bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xl rounded-full shadow-xl hover:scale-105 transition-transform cursor-pointer"
                    >
                      {studyIndex < studyQuestions.length - 1 ? 'Next Gate →' : 'Finish Review'}
                    </button>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* SCREEN 4: 3D ROLLER COASTER GAMEPLAY VIEWPORT */}
      {screen === 'game' && (
        <Coaster3DGameplay
          questions={getPlayableQuestions()}
          riderName={riderName}
          speedMultiplier={speedMultiplier}
          onChangeSpeedMultiplier={setSpeedMultiplier}
          timerMinutes={timerMinutes}
          onChangeTimerMinutes={setTimerMinutes}
          initialLives={initialLives}
          parkTheme={parkTheme}
          voiceEnabled={voiceEnabled}
          onChangeVoiceEnabled={setVoiceEnabled}
          cameraLeanEnabled={cameraLeanEnabled}
          onChangeCameraLeanEnabled={setCameraLeanEnabled}
          cameraMode={cameraMode}
          onChangeCameraMode={setCameraMode}
          onExitToSetup={() => setScreen('setup')}
          onEditQuestions={() => setScreen('editor')}
        />
      )}

      {/* Mode Switcher Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: activeQuiz?.id,
          name: activeQuiz?.title,
          topic: activeQuiz?.topic,
          className: activeQuiz?.classLevel,
          gameType: 'roller-coaster-quiz',
          customQuestions: getPlayableQuestions(),
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}

type PowerUpType = 'magnet' | 'slow' | 'boost' | 'double' | 'shield';

/********************************************************************
 * ULTRA-HIGH-GRAPHICS 3D ROLLER COASTER GAMEPLAY ENGINE
 ********************************************************************/
function Coaster3DGameplay({
  questions,
  riderName,
  speedMultiplier,
  onChangeSpeedMultiplier,
  timerMinutes,
  onChangeTimerMinutes,
  initialLives,
  parkTheme,
  voiceEnabled,
  onChangeVoiceEnabled,
  cameraLeanEnabled,
  onChangeCameraLeanEnabled,
  cameraMode = 'group',
  onChangeCameraMode,
  onExitToSetup,
  onEditQuestions,
}: {
  questions: Question[];
  riderName: string;
  speedMultiplier: number;
  onChangeSpeedMultiplier: (v: number) => void;
  timerMinutes: number;
  onChangeTimerMinutes: (v: number) => void;
  initialLives: number;
  parkTheme: 'sunny' | 'sunset' | 'neon';
  voiceEnabled: boolean;
  onChangeVoiceEnabled: (v: boolean) => void;
  cameraLeanEnabled: boolean;
  onChangeCameraLeanEnabled: (v: boolean) => void;
  cameraMode?: 'group' | 'solo';
  onChangeCameraMode?: (v: 'group' | 'solo') => void;
  onExitToSetup: () => void;
  onEditQuestions: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const bumperRef = useRef<HTMLDivElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);

  // HUD State: Big Coins Counter, Countdown Timer, Player Lives (Hearts), Gate Progress & Power-Ups
  const [coinsCount, setCoinsCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(timerMinutes * 60);
  const [livesLeft, setLivesLeft] = useState(initialLives);
  const [gateSecondsLeft, setGateSecondsLeft] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [currentGateIdx, setCurrentGateIdx] = useState(0);
  const [countdownNum, setCountdownNum] = useState<number | null>(4);
  const [activePrompt, setActivePrompt] = useState<{
    index: number;
    total: number;
    question: string;
    leftText: string;
    rightText: string;
    correctSide: -1 | 1;
  } | null>(null);
  const [timerPct, setTimerPct] = useState(100);
  const [steeringChoice, setSteeringChoice] = useState<-1 | 0 | 1>(0);
  const [smoothSteerPct, setSmoothSteerPct] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);

  // Group Line & Multi-Person Motion Tracking State
  const [activeCameraMode, setActiveCameraMode] = useState<'group' | 'solo'>(cameraMode || 'group');
  const cameraModeRef = useRef<'group' | 'solo'>(cameraMode || 'group');
  const [detectedPeopleCount, setDetectedPeopleCount] = useState<number>(0);
  const [personMarkers, setPersonMarkers] = useState<
    Array<{ x: number; y: number; lean: number; id: number }>
  >([]);
  const [groupLeanStatus, setGroupLeanStatus] = useState<string>('');
  const [showEndNowConfirm, setShowEndNowConfirm] = useState(false);

  useEffect(() => {
    if (cameraMode) {
      setActiveCameraMode(cameraMode);
      cameraModeRef.current = cameraMode;
    }
  }, [cameraMode]);

  // In-Game Settings & Tablet Auto-Lean State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [textSize, setTextSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('lg');
  const [tabletMode, setTabletMode] = useState<boolean>(true);
  const [tiltSensitivity, setTiltSensitivity] = useState<number>(1.0);
  const [tiltAngleDeg, setTiltAngleDeg] = useState<number>(0);
  const [tiltStatus, setTiltStatus] = useState('Tablet Auto-Tilt Ready');

  // Active Power-Up Timers & Floating Coin Popups
  const [activePowerUps, setActivePowerUps] = useState<{
    magnet: number;
    slow: number;
    boost: number;
    double: number;
    shield: boolean;
  }>({
    magnet: 0,
    slow: 0,
    boost: 0,
    double: 0,
    shield: false,
  });

  const [floatingPopups, setFloatingPopups] = useState<
    { id: number; text: string; color: string; sub?: string }[]
  >([]);

  const pushScorePopup = (text: string, color = 'text-amber-300', sub?: string) => {
    const id = Date.now() + Math.random();
    setFloatingPopups((prev) => [...prev.slice(-4), { id, text, color, sub }]);
    setTimeout(() => {
      setFloatingPopups((prev) => prev.filter((p) => p.id !== id));
    }, 1150);
  };

  // Modals for Derailment / Revive / Game Over or Victory
  const [crashModal, setCrashModal] = useState<{
    title: string;
    reason: string;
    question: string;
    wrongAnswer: string;
    correctAnswer: string;
    gateNumber: number;
    totalGates: number;
    wasTimeout: boolean;
    livesRemaining: number;
    isGameOver: boolean;
    isTimeUp?: boolean;
  } | null>(null);
  const [victoryModal, setVictoryModal] = useState<{
    maxStreak: number;
    coins: number;
    timeSec: number;
    livesRemaining: number;
    gatesCleared?: number;
    totalGates?: number;
    endedEarly?: boolean;
  } | null>(null);
  const dangerVignetteRef = useRef<boolean>(false);
  const [dangerVignette, setDangerVignette] = useState(false);

  // Mutable Refs for 60FPS loop access
  const steeringRef = useRef<-1 | 0 | 1>(0);
  const smoothSteerRef = useRef<number>(0);
  const isMutedRef = useRef<boolean>(false);
  const musicEnabledRef = useRef<boolean>(true);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const speedMultRef = useRef<number>(speedMultiplier);
  const timerMinutesRef = useRef<number>(timerMinutes);
  const pausedRef = useRef<boolean>(false);
  const tabletModeRef = useRef<boolean>(true);
  const tiltSensitivityRef = useRef<number>(1.0);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);
  useEffect(() => {
    speedMultRef.current = speedMultiplier;
  }, [speedMultiplier]);
  useEffect(() => {
    timerMinutesRef.current = timerMinutes;
  }, [timerMinutes]);
  useEffect(() => {
    pausedRef.current = showSettingsModal;
  }, [showSettingsModal]);
  useEffect(() => {
    tabletModeRef.current = tabletMode;
  }, [tabletMode]);
  useEffect(() => {
    tiltSensitivityRef.current = tiltSensitivity;
  }, [tiltSensitivity]);
  useEffect(() => {
    musicEnabledRef.current = musicEnabled;
  }, [musicEnabled]);

  const actionsRef = useRef<{
    retryCheckpoint: () => void;
    restartFullRide: () => void;
    selectSteer: (dir: -1 | 1) => void;
    endRideNow: () => void;
  }>({
    retryCheckpoint: () => {},
    restartFullRide: () => {},
    selectSteer: () => {},
    endRideNow: () => {},
  });

  // Web Audio Synthesizer Engine (Ride Music + Coaster Roar + Coin Chimes + Power-Up SFX)
  const audioRef = useRef<{
    ctx: AudioContext | null;
    rollingGain: GainNode | null;
    rollingFilter: BiquadFilterNode | null;
    windGain: GainNode | null;
    lastClackTime: number;
    lastMusicNoteTime: number;
    musicStep: number;
    coinCombo: number;
    lastCoinTime: number;
  }>({
    ctx: null,
    rollingGain: null,
    rollingFilter: null,
    windGain: null,
    lastClackTime: 0,
    lastMusicNoteTime: 0,
    musicStep: 0,
    coinCombo: 0,
    lastCoinTime: 0,
  });

  const ensureAudio = () => {
    if (isMutedRef.current) return;
    if (!audioRef.current.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioRef.current.ctx = ctx;

      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.04 * white) / 1.04;
        lastOut = output[i];
        output[i] *= 2.5;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const rollingFilter = ctx.createBiquadFilter();
      rollingFilter.type = 'bandpass';
      rollingFilter.frequency.value = 140;
      rollingFilter.Q.value = 1.8;

      const rollingGain = ctx.createGain();
      rollingGain.gain.value = 0.001;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'highpass';
      windFilter.frequency.value = 650;
      const windGain = ctx.createGain();
      windGain.gain.value = 0.001;

      whiteNoise.connect(rollingFilter);
      rollingFilter.connect(rollingGain);
      rollingGain.connect(ctx.destination);

      whiteNoise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);

      whiteNoise.start(0);
      audioRef.current.rollingFilter = rollingFilter;
      audioRef.current.rollingGain = rollingGain;
      audioRef.current.windGain = windGain;
    }
    if (audioRef.current.ctx && audioRef.current.ctx.state === 'suspended') {
      audioRef.current.ctx.resume();
    }
  };

  const updateContinuousCoasterSound = (normSpeed: number, isActiveRiding: boolean, bankingAmount: number) => {
    const { ctx, rollingGain, rollingFilter, windGain } = audioRef.current;
    if (!ctx || !rollingGain || !rollingFilter || !windGain) return;
    if (isMutedRef.current || !isActiveRiding || pausedRef.current) {
      rollingGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      windGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
      return;
    }
    const clamped = Math.max(0.2, Math.min(2.4, normSpeed));
    rollingFilter.frequency.setTargetAtTime(110 + clamped * 165 + Math.abs(bankingAmount) * 90, ctx.currentTime, 0.06);
    rollingGain.gain.setTargetAtTime(Math.min(0.14, 0.032 * clamped), ctx.currentTime, 0.06);
    windGain.gain.setTargetAtTime(Math.min(0.085, Math.max(0, (clamped - 0.7) * 0.06)), ctx.currentTime, 0.08);
  };

  const playTone = (
    freq: number,
    type: OscillatorType = 'sine',
    duration = 0.18,
    gainVal = 0.18,
    slideTo: number | null = null
  ) => {
    if (isMutedRef.current) return;
    ensureAudio();
    const ctx = audioRef.current.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  };

  // Upbeat Theme Park Coaster Ride Music Sequencer (Melody + Bassline + Percussion)
  const updateRideMusic = (nowMs: number, isActiveRiding: boolean, tempoScale = 1.0) => {
    if (isMutedRef.current || !musicEnabledRef.current || !isActiveRiding || pausedRef.current) return;
    ensureAudio();
    const ctx = audioRef.current.ctx;
    if (!ctx) return;

    const stepInterval = Math.max(115, Math.min(240, 165 / Math.max(0.65, tempoScale)));
    if (nowMs - audioRef.current.lastMusicNoteTime < stepInterval) return;
    audioRef.current.lastMusicNoteTime = nowMs;

    const step = audioRef.current.musicStep % 32;
    audioRef.current.musicStep += 1;

    // Joyful Theme Park Coaster Lead Melody (C Major / G Mixolydian arcade adventure)
    const melodyNotes = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33,
      523.25, 659.25, 783.99, 1046.5, 987.77, 783.99, 880.0, 783.99,
      698.46, 880.0, 1046.5, 880.0, 783.99, 659.25, 587.33, 523.25,
      587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5, 783.99,
    ];
    const bassNotes = [
      130.81, 196.0, 130.81, 196.0, 146.83, 220.0, 146.83, 220.0,
      130.81, 196.0, 164.81, 246.94, 196.0, 146.83, 196.0, 246.94,
      174.61, 220.0, 174.61, 261.63, 130.81, 196.0, 130.81, 196.0,
      146.83, 196.0, 146.83, 196.0, 196.0, 220.0, 246.94, 261.63,
    ];

    const leadFreq = melodyNotes[step];
    const bassFreq = bassNotes[step];

    if (leadFreq) {
      playTone(leadFreq, 'triangle', 0.13, 0.055);
      if (step % 4 === 0) {
        playTone(leadFreq * 1.5, 'sine', 0.09, 0.025);
      }
    }
    if (bassFreq && step % 2 === 0) {
      playTone(bassFreq, 'sawtooth', 0.14, 0.04, bassFreq * 0.98);
    }
    // Crisp arcade hi-hat / snare pulse on off-beats
    if (step % 4 === 2) {
      playTone(1200, 'square', 0.025, 0.015, 400);
    }
  };

  // Multi-pitched Coin Collection Sound Effect with Rising Combo Pitch!
  const playCoinCollectSound = () => {
    if (isMutedRef.current) return;
    const now = performance.now();
    if (now - audioRef.current.lastCoinTime < 1400) {
      audioRef.current.coinCombo = Math.min(10, audioRef.current.coinCombo + 1);
    } else {
      audioRef.current.coinCombo = 0;
    }
    audioRef.current.lastCoinTime = now;

    const comboMult = 1 + audioRef.current.coinCombo * 0.045;
    // Classic crisp B5 -> E6 golden coin chime + sparkle overtone
    playTone(987.77 * comboMult, 'sine', 0.08, 0.2);
    setTimeout(() => {
      playTone(1318.51 * comboMult, 'sine', 0.24, 0.24);
      playTone(2637.02 * comboMult, 'triangle', 0.14, 0.09);
    }, 65);
  };

  // Distinct Sound Effects for Each Power-Up Type!
  const playCrossTrackCollectSound = () => {
    if (isMutedRef.current) return;
    ensureAudio();
    playTone(659.25, 'triangle', 0.12, 0.22, 987.77);
    setTimeout(() => playTone(1318.51, 'sine', 0.2, 0.26, 1760), 55);
    setTimeout(() => playTone(1975.53, 'triangle', 0.16, 0.22), 110);
  };

  const playPowerUpSound = (type: PowerUpType) => {
    if (isMutedRef.current) return;
    ensureAudio();
    if (type === 'magnet') {
      playTone(330, 'sawtooth', 0.12, 0.2, 660);
      setTimeout(() => playTone(660, 'triangle', 0.18, 0.22, 990), 80);
      setTimeout(() => playTone(1320, 'sine', 0.3, 0.26, 1760), 160);
    } else if (type === 'slow') {
      playTone(880, 'sine', 0.2, 0.22, 440);
      setTimeout(() => playTone(587.33, 'triangle', 0.32, 0.22, 293.66), 110);
    } else if (type === 'boost') {
      playTone(180, 'sawtooth', 0.22, 0.28, 720);
      setTimeout(() => playTone(440, 'sawtooth', 0.25, 0.26, 1320), 70);
      setTimeout(() => playTone(880, 'triangle', 0.35, 0.28, 2093.0), 150);
    } else if (type === 'double') {
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, idx) => {
        setTimeout(() => playTone(f, 'triangle', 0.12, 0.22), idx * 50);
      });
    } else if (type === 'shield') {
      playTone(440, 'sine', 0.18, 0.22, 880);
      setTimeout(() => playTone(880, 'triangle', 0.35, 0.26, 1318.51), 100);
    }
  };

  const playChainClack = (intervalMs = 125) => {
    if (isMutedRef.current || pausedRef.current) return;
    const now = performance.now();
    if (now - audioRef.current.lastClackTime < intervalMs) return;
    audioRef.current.lastClackTime = now;
    playTone(220, 'triangle', 0.04, 0.075, 95);
    setTimeout(() => playTone(340, 'square', 0.025, 0.04, 180), 18);
  };

  const playRailSwitchClick = (dir: -1 | 1) => {
    playTone(dir < 0 ? 440 : 554.37, 'triangle', 0.09, 0.14, dir < 0 ? 520 : 659.25);
    playTone(140, 'sawtooth', 0.05, 0.08, 90);
  };

  const playCorrectFanfare = (currentStreak: number) => {
    const pitchBoost = 1 + Math.min(currentStreak, 6) * 0.05;
    playTone(523.25 * pitchBoost, 'triangle', 0.14, 0.22);
    setTimeout(() => playTone(659.25 * pitchBoost, 'triangle', 0.14, 0.22), 85);
    setTimeout(() => playTone(783.99 * pitchBoost, 'triangle', 0.18, 0.24), 170);
    setTimeout(() => playTone(1046.5 * pitchBoost, 'sine', 0.32, 0.26), 255);
  };

  const playDerailmentAlarmAndCrash = () => {
    if (isMutedRef.current) return;
    ensureAudio();
    playTone(310, 'sawtooth', 0.22, 0.22, 220);
    setTimeout(() => playTone(680, 'sawtooth', 1.05, 0.2, 115), 180);
    setTimeout(() => playTone(85, 'square', 0.5, 0.3, 32), 720);
  };

  const speakQuestion = (text: string) => {
    if (!voiceEnabledRef.current || isMutedRef.current) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.replace(/_+/g, 'blank'));
        u.rate = 1.02;
        u.pitch = 1.1;
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }
  };

  // Webcam Head-Tilt Steering (Placed directly above the hamster's head when enabled!)
  useEffect(() => {
    if (!cameraLeanEnabled) {
      setCameraActive(false);
      return;
    }
    let active = true;
    let stream: MediaStream | null = null;
    let faceMesh: any = null;
    let animId: number | null = null;

    const initHeadTiltCamera = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
          });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
          } catch {
            return;
          }
        }
        if (!active || !stream || !webcamVideoRef.current) return;
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play().catch(() => {});
        setCameraActive(true);

        const win = window as any;
        if (win.FaceMesh) {
          faceMesh = new win.FaceMesh({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
          });
          faceMesh.setOptions({
            maxNumFaces: 6, // Detect up to 6 people standing in line / group!
            refineLandmarks: false,
            minDetectionConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
          faceMesh.onResults((results: any) => {
            if (!active) return;
            const faces = results?.multiFaceLandmarks;
            if (!faces || faces.length === 0) {
              setDetectedPeopleCount(0);
              setPersonMarkers([]);
              setGroupLeanStatus('');
              return;
            }

            const faceCount = faces.length;
            setDetectedPeopleCount(faceCount);

            // Calculate lean metric for each person in line
            const markers: Array<{ x: number; y: number; lean: number; id: number }> = [];
            const tilts: number[] = [];

            for (let i = 0; i < faceCount; i++) {
              const face = faces[i];
              const nose = face[1];
              const topHead = face[10];
              const chin = face[152];
              const leftEye = face[33];
              const rightEye = face[263];

              // Mirrored horizontal coordinates (0 = left, 1 = right of viewer's screen)
              const mxNose = nose ? 1.0 - nose.x : 0.5;
              const mxTop = topHead ? 1.0 - topHead.x : mxNose;
              const mxChin = chin ? 1.0 - chin.x : mxNose;

              // 1. Head Roll/Tilt angle (when leaning left on screen, top of head is left of chin)
              const headTilt = (mxTop - mxChin) * 4.6;

              // 2. Eye tilt angle (eye line slope)
              const eyeSlope = leftEye && rightEye ? (rightEye.y - leftEye.y) * 3.8 : 0;

              // 3. Body horizontal shift relative to center
              const lateralPos = (mxNose - 0.5) * 2.6;

              // Combined person tilt: positive = right, negative = left
              const combinedLean = Math.max(-1, Math.min(1, headTilt * 0.65 + eyeSlope * 0.2 + lateralPos * 0.35));
              tilts.push(combinedLean);

              markers.push({
                x: mxNose,
                y: nose ? nose.y : 0.5,
                lean: combinedLean,
                id: i + 1,
              });
            }

            setPersonMarkers(markers);

            // Group Consensus vs Solo mode:
            // Example: 3 people standing in line, when lean left all of them should lean
            let consensusSteer = 0;
            const isGroup = cameraModeRef.current === 'group';

            if (!isGroup || faceCount === 1) {
              // Solo Pilot mode: track the primary person
              consensusSteer = tilts[0];
              setGroupLeanStatus(
                tilts[0] < -0.2 ? 'LEANING LEFT ◀' : tilts[0] > 0.2 ? 'LEANING RIGHT ▶' : 'CENTERED'
              );
            } else {
              // Group mode with 2, 3 or more people standing in line
              const avgTilt = tilts.reduce((a, b) => a + b, 0) / tilts.length;
              const leaningLeftCount = tilts.filter((t) => t < -0.16).length;
              const leaningRightCount = tilts.filter((t) => t > 0.16).length;
              const majorityNeeded = Math.ceil(faceCount / 2);

              if (leaningLeftCount === faceCount) {
                // ALL of them are leaning left! Strong group consensus steer!
                consensusSteer = Math.min(-0.35, avgTilt * 1.35);
                setGroupLeanStatus(`🔥 ALL ${faceCount} LEANING LEFT! ◀`);
              } else if (leaningRightCount === faceCount) {
                // ALL of them are leaning right! Strong group consensus steer!
                consensusSteer = Math.max(0.35, avgTilt * 1.35);
                setGroupLeanStatus(`🔥 ALL ${faceCount} LEANING RIGHT! ▶`);
              } else if (leaningLeftCount >= majorityNeeded && leaningLeftCount > leaningRightCount) {
                // Majority leaning left
                consensusSteer = Math.min(-0.25, avgTilt);
                setGroupLeanStatus(`◀ ${leaningLeftCount}/${faceCount} LEANING LEFT`);
              } else if (leaningRightCount >= majorityNeeded && leaningRightCount > leaningLeftCount) {
                // Majority leaning right
                consensusSteer = Math.max(0.25, avgTilt);
                setGroupLeanStatus(`▶ ${leaningRightCount}/${faceCount} LEANING RIGHT`);
              } else {
                consensusSteer = avgTilt;
                setGroupLeanStatus(`👥 ${faceCount} RIDERS IN LINE`);
              }
            }

            const clamped = Math.max(-1, Math.min(1, consensusSteer));
            smoothSteerRef.current = clamped;
            setSmoothSteerPct(50 + clamped * 38);

            if (clamped < -0.22 && steeringRef.current !== -1) {
              actionsRef.current.selectSteer(-1);
            } else if (clamped > 0.22 && steeringRef.current !== 1) {
              actionsRef.current.selectSteer(1);
            }
          });

          let lastSend = 0;
          const loopFrames = async (t: number) => {
            if (!active) return;
            if (webcamVideoRef.current && webcamVideoRef.current.readyState >= 2 && t - lastSend > 50) {
              lastSend = t;
              try {
                await faceMesh.send({ image: webcamVideoRef.current });
              } catch {}
            }
            if (active) animId = requestAnimationFrame(loopFrames);
          };
          animId = requestAnimationFrame(loopFrames);
        } else {
          // Lightweight 2D Canvas Multi-Zone Motion Tracker when FaceMesh isn't globally loaded
          const trackCanvas = document.createElement('canvas');
          trackCanvas.width = 64;
          trackCanvas.height = 48;
          const tCtx = trackCanvas.getContext('2d', { willReadFrequently: true });
          let prevFrame: Uint8ClampedArray | null = null;
          let lastSample = 0;

          const loopCanvasTracker = (t: number) => {
            if (!active) return;
            if (webcamVideoRef.current && webcamVideoRef.current.readyState >= 2 && tCtx && t - lastSample > 70) {
              lastSample = t;
              tCtx.drawImage(webcamVideoRef.current, 0, 0, 64, 48);
              const imgData = tCtx.getImageData(0, 0, 64, 48).data;
              if (prevFrame) {
                let weightedX = 0;
                let totalWeight = 0;
                let leftWeight = 0;
                let rightWeight = 0;

                for (let y = 6; y < 42; y++) {
                  for (let x = 4; x < 60; x++) {
                    const idx = (y * 64 + x) * 4;
                    const diff =
                      Math.abs(imgData[idx] - prevFrame[idx]) +
                      Math.abs(imgData[idx + 1] - prevFrame[idx + 1]) +
                      Math.abs(imgData[idx + 2] - prevFrame[idx + 2]);
                    if (diff > 40) {
                      const mirroredX = 1.0 - x / 64;
                      weightedX += mirroredX * diff;
                      totalWeight += diff;

                      if (mirroredX < 0.38) leftWeight += diff;
                      else if (mirroredX > 0.62) rightWeight += diff;
                    }
                  }
                }

                if (totalWeight > 2800) {
                  const avgX = weightedX / totalWeight;
                  const isGroup = cameraModeRef.current === 'group';
                  let offset = (avgX - 0.5) * 3.0;

                  if (isGroup && leftWeight > rightWeight * 1.8 && leftWeight > 1200) {
                    offset = -0.38;
                    setGroupLeanStatus('🔥 GROUP LEAN LEFT! ◀');
                  } else if (isGroup && rightWeight > leftWeight * 1.8 && rightWeight > 1200) {
                    offset = 0.38;
                    setGroupLeanStatus('🔥 GROUP LEAN RIGHT! ▶');
                  } else {
                    setGroupLeanStatus(avgX < 0.44 ? 'LEANING LEFT ◀' : avgX > 0.56 ? 'LEANING RIGHT ▶' : 'MOTION TRACKING');
                  }

                  const clamped = Math.max(-1, Math.min(1, offset));
                  smoothSteerRef.current = clamped;
                  setSmoothSteerPct(50 + clamped * 38);
                  if (clamped < -0.22 && steeringRef.current !== -1) {
                    actionsRef.current.selectSteer(-1);
                  } else if (clamped > 0.22 && steeringRef.current !== 1) {
                    actionsRef.current.selectSteer(1);
                  }
                }
              }
              prevFrame = new Uint8ClampedArray(imgData);
            }
            if (active) animId = requestAnimationFrame(loopCanvasTracker);
          };
          animId = requestAnimationFrame(loopCanvasTracker);
        }
      } catch {
        setCameraActive(false);
      }
    };

    initHeadTiltCamera();

    return () => {
      active = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (faceMesh && faceMesh.close) {
        try {
          faceMesh.close();
        } catch {}
      }
      setCameraActive(false);
    };
  }, [cameraLeanEnabled]);

  // Main Three.js Scene & Physics Effect
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Renderer & PBR Environment
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const gl = renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /SwiftShader|llvmpipe|Software/i.test(rendererStr);

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = parkTheme === 'neon' ? 1.2 : 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const fogColor = parkTheme === 'neon' ? 0x090d24 : parkTheme === 'sunset' ? 0xfb923c : 0x7dd3fc;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor, 0.00078);

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 1300);
    scene.add(camera);

    // 2. High-Resolution Sky Dome + Volumetric 3D Clouds + Hot Air Balloons
    const buildSkyAndClouds = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 512);

      if (parkTheme === 'neon') {
        grad.addColorStop(0, '#020617');
        grad.addColorStop(0.35, '#1e1b4b');
        grad.addColorStop(0.65, '#3b0764');
        grad.addColorStop(1, '#0f172a');
      } else if (parkTheme === 'sunset') {
        grad.addColorStop(0, '#1e1b4b');
        grad.addColorStop(0.28, '#7c2d12');
        grad.addColorStop(0.55, '#f97316');
        grad.addColorStop(0.8, '#fde047');
        grad.addColorStop(1, '#fed7aa');
      } else {
        grad.addColorStop(0, '#1d4ed8');
        grad.addColorStop(0.32, '#2563eb');
        grad.addColorStop(0.58, '#60a5fa');
        grad.addColorStop(0.82, '#bae6fd');
        grad.addColorStop(1, '#e0f2fe');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 512);

      if (parkTheme === 'neon') {
        // Starfield
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = i % 5 === 0 ? '#38bdf8' : '#ffffff';
          ctx.fillRect(Math.random() * 1024, Math.random() * 320, 2, 2);
        }
      } else {
        for (let i = 0; i < 65; i++) {
          const x = Math.random() * 1024;
          const y = 35 + Math.random() * 210;
          const w = 65 + Math.random() * 150;
          const h = 16 + Math.random() * 32;
          const cGrad = ctx.createRadialGradient(x, y, 4, x, y, w);
          cGrad.addColorStop(0, parkTheme === 'sunset' ? 'rgba(254,215,170,0.8)' : 'rgba(255,255,255,0.88)');
          cGrad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = cGrad;
          ctx.beginPath();
          ctx.ellipse(x, y, w, h, -0.1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const skyTex = new THREE.CanvasTexture(canvas);
      skyTex.colorSpace = THREE.SRGBColorSpace;
      const skyMesh = new THREE.Mesh(
        new THREE.SphereGeometry(820, 32, 24),
        new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false })
      );
      scene.add(skyMesh);

      // Volumetric 3D Cloud Clusters
      const cloudMat = new THREE.MeshStandardMaterial({
        color: parkTheme === 'sunset' ? 0xfed7aa : parkTheme === 'neon' ? 0x312e81 : 0xffffff,
        roughness: 0.9,
        fog: false,
      });
      for (let c = 0; c < 18; c++) {
        const cg = new THREE.Group();
        cg.position.set((Math.random() - 0.5) * 440, 68 + Math.random() * 55, -30 - Math.random() * 420);
        for (let p = 0; p < 4; p++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(6.5 + Math.random() * 5, 12, 12), cloudMat);
          puff.position.set((p - 1.5) * 6.2, (Math.random() - 0.5) * 2.5, (Math.random() - 0.5) * 3);
          puff.scale.set(1.45, 0.78, 1);
          cg.add(puff);
        }
        scene.add(cg);
      }

      // Floating Theme Park Hot Air Balloons
      const balloonColors = [0xf43f5e, 0xf59e0b, 0x06b6d4, 0xa855f7];
      for (let b = 0; b < 5; b++) {
        const bg = new THREE.Group();
        bg.position.set((b % 2 === 0 ? -1 : 1) * (45 + b * 18), 52 + (b % 3) * 14, -85 - b * 65);
        const envMat = new THREE.MeshPhysicalMaterial({
          color: balloonColors[b % balloonColors.length],
          roughness: 0.35,
          clearcoat: 0.6,
        });
        const envelope = new THREE.Mesh(new THREE.SphereGeometry(5.5, 16, 16), envMat);
        envelope.scale.set(1, 1.28, 1);
        bg.add(envelope);

        const basket = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.8, 2.2),
          new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 })
        );
        basket.position.y = -8.2;
        bg.add(basket);
        scene.add(bg);
      }
    };
    buildSkyAndClouds();

    // 3. Lighting Setup
    const hemiLight = new THREE.HemisphereLight(
      parkTheme === 'neon' ? 0x818cf8 : 0xe0f2fe,
      parkTheme === 'neon' ? 0x0f172a : 0x3f6212,
      parkTheme === 'neon' ? 0.65 : 0.85
    );
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(
      parkTheme === 'sunset' ? 0xfdba74 : parkTheme === 'neon' ? 0xc084fc : 0xfffbeb,
      parkTheme === 'neon' ? 0.95 : 1.45
    );
    sunLight.position.set(85, 145, -60);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 360;
      const d = 120;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
    }
    scene.add(sunLight);

    // 4. Procedural Park Terrain + Reflective Lake Water
    const buildGroundAndLake = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = parkTheme === 'neon' ? '#0f172a' : '#365314';
      ctx.fillRect(0, 0, 512, 512);

      for (let i = 0; i < 6500; i++) {
        ctx.fillStyle =
          parkTheme === 'neon'
            ? i % 3 === 0
              ? '#1e293b'
              : '#1e1b4b'
            : i % 3 === 0
            ? '#4d7c0f'
            : i % 2 === 0
            ? '#3f6212'
            : '#65a30d';
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 6);
      }
      for (let i = 0; i < 180; i++) {
        ctx.fillStyle = parkTheme === 'neon' ? '#38bdf8' : '#facc15';
        ctx.beginPath();
        ctx.arc(Math.random() * 512, Math.random() * 512, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(75, 75);
      tex.colorSpace = THREE.SRGBColorSpace;

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(1400, 1400),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Shimmering Theme Park Lake under the Coaster
      const lakeMat = new THREE.MeshPhysicalMaterial({
        color: parkTheme === 'neon' ? 0x0284c7 : 0x0ea5e9,
        metalness: 0.15,
        roughness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.8,
      });
      const lake = new THREE.Mesh(new THREE.CircleGeometry(75, 48), lakeMat);
      lake.rotation.x = -Math.PI / 2;
      lake.position.set(-28, 0.08, -110);
      scene.add(lake);
    };
    buildGroundAndLake();

    // 5. Theme Park Landmarks: Giant Neon Ferris Wheel & Striped Carousel
    let ferrisWheelRotor: THREE.Group | null = null;
    let carouselRotor: THREE.Group | null = null;

    const createTrussSupportPillar = (x: number, h: number, z: number) => {
      const group = new THREE.Group();
      const safeH = Math.max(1.2, h);
      group.position.set(x, 0, z);
      const redSteel = new THREE.MeshPhysicalMaterial({
        color: 0xc2410c,
        roughness: 0.35,
        metalness: 0.65,
        clearcoat: 0.4,
      });
      const darkCapMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.5, metalness: 0.5 });

      const postOffsets = [
        [-0.68, -0.68],
        [0.68, -0.68],
        [-0.68, 0.68],
        [0.68, 0.68],
      ];
      postOffsets.forEach(([px, pz]) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, safeH, 8), redSteel);
        post.position.set(px, safeH / 2, pz);
        group.add(post);
      });

      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.38, 1.75), darkCapMat);
      cap.position.y = Math.max(0.5, safeH - 0.18);
      group.add(cap);
      return group;
    };

    const buildLandmarks = () => {
      // Ferris Wheel
      const fwGroup = new THREE.Group();
      fwGroup.position.set(32, 0, -150);
      fwGroup.rotation.y = -0.28;

      const radius = 40;
      const supportMat = new THREE.MeshPhysicalMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.28 });
      const neonPinkMat = new THREE.MeshStandardMaterial({
        color: 0xf472b6,
        emissive: 0xec4899,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const rimMat = new THREE.MeshStandardMaterial({
        color: 0xfbcfe8,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.5,
      });

      const legGeo = new THREE.CylinderGeometry(0.95, 1.45, 54, 12);
      [
        { x: -14, z: -5, rz: -0.26 },
        { x: 14, z: -5, rz: 0.26 },
        { x: -14, z: 5, rz: -0.26 },
        { x: 14, z: 5, rz: 0.26 },
      ].forEach((cfg) => {
        const leg = new THREE.Mesh(legGeo, supportMat);
        leg.position.set(cfg.x * 0.5, 24, cfg.z);
        leg.rotation.z = cfg.rz;
        fwGroup.add(leg);
      });

      ferrisWheelRotor = new THREE.Group();
      ferrisWheelRotor.position.set(0, 46, 0);
      fwGroup.add(ferrisWheelRotor);

      [-3.4, 3.4].forEach((zOff) => {
        const outerRim = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.6, 12, 48), rimMat);
        outerRim.position.z = zOff;
        ferrisWheelRotor!.add(outerRim);

        const innerRim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.42, 10, 48), neonPinkMat);
        innerRim.position.z = zOff;
        ferrisWheelRotor!.add(innerRim);
      });

      const numCabins = 20;
      const cabinColors = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0xa855f7, 0xec4899];
      for (let i = 0; i < numCabins; i++) {
        const angle = (i / numCabins) * Math.PI * 2;
        if (i < numCabins / 2) {
          const spokeGeo = new THREE.CylinderGeometry(0.24, 0.24, radius * 2, 8);
          [-3.4, 3.4].forEach((zOff) => {
            const spoke = new THREE.Mesh(spokeGeo, neonPinkMat);
            spoke.rotation.z = angle;
            spoke.position.z = zOff;
            ferrisWheelRotor!.add(spoke);
          });
        }
        const cabinMat = new THREE.MeshPhysicalMaterial({
          color: cabinColors[i % cabinColors.length],
          roughness: 0.2,
          metalness: 0.3,
          clearcoat: 0.9,
        });
        const cabin = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), cabinMat);
        cabin.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
        cabin.scale.set(1.15, 0.88, 1.3);
        ferrisWheelRotor.add(cabin);
      }

      const axle = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 9.5, 16), neonPinkMat);
      axle.rotation.x = Math.PI / 2;
      ferrisWheelRotor.add(axle);
      scene.add(fwGroup);

      // Striped Circus Carousel
      const cGroup = new THREE.Group();
      cGroup.position.set(19, 0, -54);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(7.8, 8.5, 1.2, 28),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 })
      );
      base.position.y = 0.6;
      cGroup.add(base);

      carouselRotor = new THREE.Group();
      carouselRotor.position.y = 1.2;
      cGroup.add(carouselRotor);

      const cCanvas = document.createElement('canvas');
      cCanvas.width = 512;
      cCanvas.height = 256;
      const cCtx = cCanvas.getContext('2d')!;
      const stripes = 16;
      for (let i = 0; i < stripes; i++) {
        cCtx.fillStyle = i % 2 === 0 ? '#facc15' : '#6b21a8';
        cCtx.fillRect((i * 512) / stripes, 0, 512 / stripes + 1, 256);
      }
      const roofTex = new THREE.CanvasTexture(cCanvas);
      roofTex.colorSpace = THREE.SRGBColorSpace;
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(7.5, 6.4, 32),
        new THREE.MeshPhysicalMaterial({ map: roofTex, roughness: 0.35, clearcoat: 0.5 })
      );
      roof.position.y = 7.6;
      carouselRotor.add(roof);

      const centerPole = new THREE.Mesh(
        new THREE.CylinderGeometry(1.15, 1.15, 6, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 })
      );
      centerPole.position.y = 3;
      carouselRotor.add(centerPole);

      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 5.4, 8),
          new THREE.MeshPhysicalMaterial({ color: 0xfde047, metalness: 0.85, roughness: 0.15 })
        );
        pole.position.set(Math.cos(a) * 5.4, 2.7, Math.sin(a) * 5.4);
        carouselRotor.add(pole);
      }
      scene.add(cGroup);

      // Trees & Distant Skyline
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const foliageColors = [0x15803d, 0x166534, 0x14532d, 0x4d7c0f];
      for (let i = 0; i < 85; i++) {
        const tx = (Math.random() - 0.5) * 280;
        const tz = -Math.random() * 380 + 30;
        if (Math.abs(tx) < 14) continue;
        const tree = new THREE.Group();
        tree.position.set(tx, 0, tz);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.7, 4.5, 7), trunkMat);
        trunk.position.y = 2.25;
        tree.add(trunk);
        const fMat = new THREE.MeshStandardMaterial({
          color: foliageColors[i % foliageColors.length],
          roughness: 0.8,
        });
        for (let c = 0; c < 3; c++) {
          const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6 - c * 0.45, 1), fMat);
          puff.position.set((Math.random() - 0.5) * 1.2, 5.2 + c * 1.6, (Math.random() - 0.5) * 1.2);
          tree.add(puff);
        }
        const s = 0.85 + Math.random() * 0.75;
        tree.scale.set(s, s, s);
        scene.add(tree);
      }
    };
    buildLandmarks();

    // 6. Cute 3D Hamster Mascot Pilot Hood Mounted to Camera!
    // Renders at the bottom-center of the player's view so the player rides WITH the cute hamster!
    const buildHamsterCoasterHood = () => {
      const carHoodGroup = new THREE.Group();
      // Positioned low in front of camera so the track ahead is 100% clear
      carHoodGroup.position.set(0, -1.08, -1.85);
      camera.add(carHoodGroup);

      // Glossy Red Metallic Coaster Nose Cone with Gold Trim
      const carPaintMat = new THREE.MeshPhysicalMaterial({
        color: 0xdc2626,
        metalness: 0.65,
        roughness: 0.18,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
      });
      const goldTrimMat = new THREE.MeshPhysicalMaterial({
        color: 0xfbbf24,
        metalness: 0.85,
        roughness: 0.2,
      });
      const grabBarMat = new THREE.MeshPhysicalMaterial({
        color: 0xe2e8f0,
        metalness: 0.9,
        roughness: 0.12,
      });

      const hoodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 0.75, 24, 1, false, 0, Math.PI), carPaintMat);
      hoodMesh.rotation.y = -Math.PI / 2;
      hoodMesh.rotation.z = 0.15;
      hoodMesh.scale.set(1.1, 0.7, 1.35);
      hoodMesh.position.set(0, -0.28, -0.2);
      carHoodGroup.add(hoodMesh);

      const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.95), goldTrimMat);
      goldStripe.position.set(0, -0.02, -0.35);
      carHoodGroup.add(goldStripe);

      // Chrome Lap / Grab Bar
      const barTop = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.35, 12), grabBarMat);
      barTop.rotation.z = Math.PI / 2;
      barTop.position.set(0, 0.12, 0.15);
      carHoodGroup.add(barTop);

      // Cute 3D Golden Hamster Co-Pilot sitting on the front hood!
      const hamsterGroup = new THREE.Group();
      hamsterGroup.position.set(0, 0.14, -0.25);
      carHoodGroup.add(hamsterGroup);

      const furOrangeMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.75 });
      const furCreamMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 });
      const earPinkMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.6 });
      const goggleFrameMat = new THREE.MeshPhysicalMaterial({ color: 0x451a03, metalness: 0.6, roughness: 0.3 });
      const goggleLensMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        metalness: 0.9,
        roughness: 0.1,
        clearcoat: 1,
      });

      // Chubby body/head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 20), furOrangeMat);
      head.scale.set(1.12, 0.98, 1.0);
      hamsterGroup.add(head);

      // White tummy/cheeks
      const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), furCreamMat);
      cheekL.position.set(-0.16, -0.05, -0.12);
      const cheekR = cheekL.clone();
      cheekR.position.set(0.16, -0.05, -0.12);
      hamsterGroup.add(cheekL, cheekR);

      // Cute Round Ears
      const earGeo = new THREE.SphereGeometry(0.095, 12, 12);
      const earL = new THREE.Mesh(earGeo, furOrangeMat);
      earL.scale.set(1, 1, 0.45);
      earL.position.set(-0.2, 0.21, 0);
      const earInnerL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), earPinkMat);
      earInnerL.position.set(0, 0, -0.03);
      earL.add(earInnerL);

      const earR = earL.clone();
      earR.position.set(0.2, 0.21, 0);
      hamsterGroup.add(earL, earR);

      // Aviator Goggles on forehead
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.022, 8, 24), goggleFrameMat);
      strap.rotation.x = Math.PI / 2 - 0.25;
      strap.position.y = 0.08;
      hamsterGroup.add(strap);

      [-0.095, 0.095].forEach((gx) => {
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.05, 14), goggleLensMat);
        lens.rotation.x = Math.PI / 2;
        lens.position.set(gx, 0.13, -0.22);
        hamsterGroup.add(lens);
      });

      // Excited Paws that wave in the wind!
      const pawGeo = new THREE.SphereGeometry(0.075, 12, 12);
      const leftPaw = new THREE.Mesh(pawGeo, furCreamMat);
      leftPaw.position.set(-0.27, 0.08, -0.1);
      const rightPaw = new THREE.Mesh(pawGeo, furCreamMat);
      rightPaw.position.set(0.27, 0.08, -0.1);
      hamsterGroup.add(leftPaw, rightPaw);

      return { carHoodGroup, hamsterGroup, leftPaw, rightPaw };
    };
    const { carHoodGroup, hamsterGroup, leftPaw, rightPaw } = buildHamsterCoasterHood();

    // 7. Dynamic Branching Coaster Track Builder with PBR Steel & Wooden Ties
    const trackMeshGroup = new THREE.Group();
    scene.add(trackMeshGroup);

    const RAIL_SPACING = 1.22;
    const railMaterial = new THREE.MeshPhysicalMaterial({
      color: parkTheme === 'neon' ? 0x06b6d4 : 0xef4444,
      emissive: parkTheme === 'neon' ? 0x0284c7 : 0x000000,
      emissiveIntensity: parkTheme === 'neon' ? 0.45 : 0,
      roughness: 0.18,
      metalness: 0.85,
      clearcoat: 0.85,
    });
    const spineMaterial = new THREE.MeshPhysicalMaterial({
      color: parkTheme === 'neon' ? 0x3b82f6 : 0xb91c1c,
      roughness: 0.28,
      metalness: 0.75,
    });

    // Procedural Wood Grain Texture for Crossties
    const createWoodTieMaterial = () => {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#78350f';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect(0, Math.random() * 64, 128, 2);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0.1 });
    };
    const tieMaterial = createWoodTieMaterial();

    const buildDetailedTrackSegment = (
      curve: THREE.CatmullRomCurve3,
      steps: number,
      includePillars = true,
      skipZones: THREE.Vector3[] = []
    ) => {
      const segGroup = new THREE.Group();
      const leftRailPts: THREE.Vector3[] = [];
      const rightRailPts: THREE.Vector3[] = [];
      const spinePts: THREE.Vector3[] = [];

      const tieGeo = new THREE.BoxGeometry(RAIL_SPACING + 0.3, 0.095, 0.25);

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = curve.getPointAt(t);
        const tan = curve.getTangentAt(t).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tan, up).normalize();

        leftRailPts.push(pt.clone().addScaledVector(side, -RAIL_SPACING * 0.5));
        rightRailPts.push(pt.clone().addScaledVector(side, RAIL_SPACING * 0.5));
        spinePts.push(pt.clone().add(new THREE.Vector3(0, -0.25, 0)));

        if (i % 2 === 0) {
          const tie = new THREE.Mesh(tieGeo, tieMaterial);
          tie.position.copy(pt).add(new THREE.Vector3(0, -0.06, 0));
          tie.lookAt(pt.clone().add(tan));
          segGroup.add(tie);
        }

        if (includePillars && i > 0 && i % 24 === 0 && pt.y > 2.8) {
          const nearFork = skipZones.some((fz) => fz.distanceTo(pt) < 9.5);
          if (!nearFork) {
            const pillar = createTrussSupportPillar(pt.x, pt.y - 0.62, pt.z);
            segGroup.add(pillar);
          }
        }
      }

      const leftCurve = new THREE.CatmullRomCurve3(leftRailPts);
      const rightCurve = new THREE.CatmullRomCurve3(rightRailPts);
      const spineCurve = new THREE.CatmullRomCurve3(spinePts);

      segGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(leftCurve, steps, 0.115, 10, false), railMaterial),
        new THREE.Mesh(new THREE.TubeGeometry(rightCurve, steps, 0.115, 10, false), railMaterial),
        new THREE.Mesh(new THREE.TubeGeometry(spineCurve, steps, 0.19, 10, false), spineMaterial)
      );

      return segGroup;
    };

    const createAnswerSignTexture = (rawText: string, bgColor: string, accentColor: string, label: string) => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 512;
      const ctx = c.getContext('2d')!;
      const parsed = parseOptionContent(rawText);

      const drawSign = (loadedImg?: HTMLImageElement) => {
        ctx.clearRect(0, 0, 1024, 512);
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, bgColor);
        grad.addColorStop(1, accentColor);
        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(16, 16, 992, 480, 50);
        } else {
          ctx.rect(16, 16, 992, 480);
        }
        ctx.fill();
        ctx.lineWidth = 18;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '900 52px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, 512, 85);

        const cleanStr = String(parsed.text || '').slice(0, 20);

        if (loadedImg && cleanStr) {
          // Large picture + clear text side by side
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(50, 120, 340, 340, 36);
          else ctx.rect(50, 120, 340, 340);
          ctx.fill();
          ctx.drawImage(loadedImg, 65, 135, 310, 310);

          ctx.fillStyle = '#ffffff';
          const fontSize = cleanStr.length > 10 ? 68 : 88;
          ctx.font = `900 ${fontSize}px Fredoka, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(cleanStr, 690, 315);
        } else if (loadedImg) {
          // Giant centered picture
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(332, 115, 360, 360, 40);
          else ctx.rect(332, 115, 360, 360);
          ctx.fill();
          ctx.drawImage(loadedImg, 352, 135, 320, 320);
        } else {
          // Large text only
          ctx.fillStyle = '#ffffff';
          const displayLabel = cleanStr || ' Picture ';
          const fontSize = displayLabel.length > 11 ? 84 : 108;
          ctx.font = `900 ${fontSize}px Fredoka, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(displayLabel, 512, 325);
        }
      };

      drawSign();
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;

      if (parsed.imageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          drawSign(img);
          tex.needsUpdate = true;
        };
        img.src = parsed.imageUrl;
      }

      return tex;
    };

    const create3DGateArch = (
      position: THREE.Vector3,
      gateInfo: { leftText: string; rightText: string }
    ) => {
      const archGroup = new THREE.Group();
      archGroup.position.copy(position);

      const pillarMat = new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.2,
        clearcoat: 0.6,
      });
      const neonRingMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
      });

      const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 7.8, 12), pillarMat);
      leftPost.position.set(-4.9, 2.7, 0);
      const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 7.8, 12), pillarMat);
      rightPost.position.set(4.9, 2.7, 0);

      const topBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 10.2, 12), neonRingMat);
      topBeam.rotation.z = Math.PI / 2;
      topBeam.position.set(0, 6.4, 0);

      archGroup.add(leftPost, rightPost, topBeam);

      const signTexL = createAnswerSignTexture(gateInfo.leftText, '#0284c7', '#1e3a8a', '◀ LEFT TRACK');
      const signL = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 2.3),
        new THREE.MeshBasicMaterial({ map: signTexL, side: THREE.DoubleSide })
      );
      signL.position.set(-2.45, 4.4, 0);
      archGroup.add(signL);

      const signTexR = createAnswerSignTexture(gateInfo.rightText, '#e11d48', '#881337', 'RIGHT TRACK ▶');
      const signR = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 2.3),
        new THREE.MeshBasicMaterial({ map: signTexR, side: THREE.DoubleSide })
      );
      signR.position.set(2.45, 4.4, 0);
      archGroup.add(signR);

      return archGroup;
    };

    // Twin Mystery Coaster Arches placed identically on both Left and Right branches past the split
    const createBranchPortalRing = (pos: THREE.Vector3, isLeft: boolean) => {
      const ringGroup = new THREE.Group();
      ringGroup.position.copy(pos);
      const ringMat = new THREE.MeshStandardMaterial({
        color: isLeft ? 0x38bdf8 : 0xf43f5e,
        emissive: isLeft ? 0x0284c7 : 0xe11d48,
        emissiveIntensity: 0.75,
        roughness: 0.2,
      });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.16, 12, 28, Math.PI), ringMat);
      torus.position.y = 0.2;
      ringGroup.add(torus);
      return ringGroup;
    };

    // 7B. 3D Spinning Golden Coins & Special Power-Ups on the Rails
    const collectiblesGroup = new THREE.Group();
    scene.add(collectiblesGroup);

    interface CoinItem {
      mesh: THREE.Group;
      worldPos: THREE.Vector3;
      collected: boolean;
      laneOffset: number;
      isBranchCoin?: boolean;
      branchSide?: number;
      gateIndex?: number;
    }

    interface PowerUpItem {
      mesh: THREE.Group;
      worldPos: THREE.Vector3;
      type: PowerUpType;
      collected: boolean;
    }

    let coinItems: CoinItem[] = [];
    let powerUpItems: PowerUpItem[] = [];

    const coinGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      metalness: 0.9,
      roughness: 0.15,
      clearcoat: 1.0,
    });
    const coinInnerMat = new THREE.MeshPhysicalMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.45,
      metalness: 0.95,
      roughness: 0.1,
    });

    const create3DCoinMesh = () => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.12, 20), coinGoldMat);
      body.rotation.x = Math.PI / 2;
      g.add(body);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.055, 8, 20), coinInnerMat);
      g.add(rim);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), coinInnerMat);
      core.scale.set(1, 1, 0.45);
      g.add(core);
      return g;
    };

    const createPowerUpBadgeTexture = (emoji: string, label: string, hexColor: string) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 120);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.35, hexColor);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(128, 128, 116, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = '95px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 128, 110);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 32px Fredoka, sans-serif';
      ctx.fillText(label, 128, 192);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    };

    const powerUpConfigs: Record<PowerUpType, { emoji: string; label: string; color: number; hex: string }> = {
      magnet: { emoji: '🧲', label: 'MAGNET', color: 0xef4444, hex: '#ef4444' },
      slow: { emoji: '⏳', label: 'SLOW-MO', color: 0x06b6d4, hex: '#06b6d4' },
      boost: { emoji: '🚀', label: 'BOOST', color: 0xf97316, hex: '#f97316' },
      double: { emoji: '⚡', label: '2X PTS', color: 0xa855f7, hex: '#a855f7' },
      shield: { emoji: '🛡️', label: 'SHIELD', color: 0x10b981, hex: '#10b981' },
    };

    const create3DPowerUpMesh = (type: PowerUpType) => {
      const cfg = powerUpConfigs[type];
      const g = new THREE.Group();

      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.08, 12, 28),
        new THREE.MeshStandardMaterial({
          color: cfg.color,
          emissive: cfg.color,
          emissiveIntensity: 0.9,
          roughness: 0.15,
        })
      );
      g.add(outerRing);

      const tex = createPowerUpBadgeTexture(cfg.emoji, cfg.label, cfg.hex);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.68, 24),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      g.add(disc);
      return g;
    };

    // Builds the dramatic 3D Collapsed Trap Track (kept hidden until the player actually enters the wrong branch!)
    const buildBrokenTrapBranchMesh = (
      forkPt: THREE.Vector3,
      midPt: THREE.Vector3,
      endPt: THREE.Vector3,
      wrongSide: number
    ) => {
      const trapGroup = new THREE.Group();
      trapGroup.visible = false; // Hidden until player crosses the gate onto the wrong track!

      // 1. Intact spur up to the cliff break point
      const breakPt = midPt.clone().lerp(endPt, 0.42);
      const spurCurve = new THREE.CatmullRomCurve3([forkPt.clone(), midPt.clone(), breakPt.clone()]);
      const spurMesh = buildDetailedTrackSegment(spurCurve, 22, false, [forkPt]);
      trapGroup.add(spurMesh);

      const tan = spurCurve.getTangentAt(1).normalize();
      const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

      // 2. Jagged Snapped & Twisted Steel Rails jutting off the cliff edge!
      const snappedRailMat = new THREE.MeshPhysicalMaterial({
        color: 0xdc2626,
        emissive: 0x991b1b,
        emissiveIntensity: 0.35,
        metalness: 0.85,
        roughness: 0.25,
      });
      const moltenTipMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf97316,
        emissiveIntensity: 1.4,
      });

      [-1, 1].forEach((railDir) => {
        const railStart = breakPt.clone().addScaledVector(side, railDir * RAIL_SPACING * 0.5);
        const bentMid = railStart
          .clone()
          .addScaledVector(tan, 1.4)
          .add(new THREE.Vector3(railDir * 0.38, railDir === wrongSide ? 0.55 : -0.42, 0));
        const jaggedTip = bentMid
          .clone()
          .addScaledVector(tan, 1.3)
          .add(new THREE.Vector3(railDir * 0.65, railDir === wrongSide ? 0.95 : -0.85, 0));

        const twistedCurve = new THREE.CatmullRomCurve3([railStart, bentMid, jaggedTip]);
        const twistedTube = new THREE.Mesh(
          new THREE.TubeGeometry(twistedCurve, 10, 0.115, 8, false),
          snappedRailMat
        );
        trapGroup.add(twistedTube);

        // Glowing hot snapped steel tip
        const sparkCap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), moltenTipMat);
        sparkCap.position.copy(jaggedTip);
        trapGroup.add(sparkCap);
      });

      // 3. Splintered & Crooked Wooden Crossties dangling at the gap
      const tieGeo = new THREE.BoxGeometry(RAIL_SPACING + 0.35, 0.1, 0.26);
      for (let k = 0; k < 4; k++) {
        const tie = new THREE.Mesh(tieGeo, tieMaterial);
        const tiePos = breakPt
          .clone()
          .addScaledVector(tan, 0.45 + k * 0.62)
          .add(new THREE.Vector3((k % 2 === 0 ? -1 : 1) * 0.18, -0.08 - k * 0.22, 0));
        tie.position.copy(tiePos);
        tie.lookAt(tiePos.clone().add(tan));
        tie.rotation.z += (k % 2 === 0 ? 0.32 : -0.38) * (1 + k * 0.25);
        tie.rotation.x += 0.25 * k;
        trapGroup.add(tie);
      }

      // 4. 3D Hazard Sawhorse Barricade & Red Emergency Warning Beacons at the Cliff Edge
      const hazardCanvas = document.createElement('canvas');
      hazardCanvas.width = 512;
      hazardCanvas.height = 128;
      const hCtx = hazardCanvas.getContext('2d')!;
      hCtx.fillStyle = '#facc15';
      hCtx.fillRect(0, 0, 512, 128);
      hCtx.fillStyle = '#0f172a';
      for (let s = -128; s < 512; s += 64) {
        hCtx.beginPath();
        hCtx.moveTo(s, 0);
        hCtx.lineTo(s + 32, 0);
        hCtx.lineTo(s + 96, 128);
        hCtx.lineTo(s + 64, 128);
        hCtx.closePath();
        hCtx.fill();
      }
      hCtx.fillStyle = '#dc2626';
      hCtx.fillRect(86, 22, 340, 84);
      hCtx.strokeStyle = '#ffffff';
      hCtx.lineWidth = 6;
      hCtx.strokeRect(86, 22, 340, 84);
      hCtx.fillStyle = '#ffffff';
      hCtx.font = '900 38px Fredoka, sans-serif';
      hCtx.textAlign = 'center';
      hCtx.fillText('⚠️ BROKEN TRACK!', 256, 76);

      const hazardTex = new THREE.CanvasTexture(hazardCanvas);
      hazardTex.colorSpace = THREE.SRGBColorSpace;
      const barrierBoard = new THREE.Mesh(
        new THREE.BoxGeometry(2.7, 0.68, 0.16),
        new THREE.MeshBasicMaterial({ map: hazardTex })
      );
      barrierBoard.position.copy(breakPt).add(new THREE.Vector3(0, 0.68, 0));
      barrierBoard.lookAt(breakPt.clone().add(tan).add(new THREE.Vector3(0, 0.68, 0)));
      trapGroup.add(barrierBoard);

      const beaconMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xff0000,
        emissiveIntensity: 1.8,
      });
      [-1.15, 1.15].forEach((bx) => {
        const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), beaconMat);
        beacon.position
          .copy(breakPt)
          .addScaledVector(side, bx)
          .add(new THREE.Vector3(0, 1.12, 0));
        trapGroup.add(beacon);
      });

      return trapGroup;
    };

    interface GateCheckpoint {
      index: number;
      question: string;
      correctAnswer: string;
      wrongAnswer: string;
      leftText: string;
      rightText: string;
      correctSide: -1 | 1;
      forkWorldPos: THREE.Vector3;
      wrongCurve: THREE.CatmullRomCurve3;
      decoyMesh: THREE.Group;
      trapBreakGroup: THREE.Group;
      forkT: number;
      promptStartT: number;
      resolved: boolean;
      promptShown: boolean;
    }

    let mainCurve: THREE.CatmullRomCurve3;
    let wrongBranchCurve: THREE.CatmullRomCurve3 | null = null;
    let gateCheckpoints: GateCheckpoint[] = [];

    const buildCourseFromQuestions = () => {
      while (trackMeshGroup.children.length > 0) {
        trackMeshGroup.remove(trackMeshGroup.children[0]);
      }
      while (collectiblesGroup.children.length > 0) {
        collectiblesGroup.remove(collectiblesGroup.children[0]);
      }
      gateCheckpoints = [];
      coinItems = [];
      powerUpItems = [];

      const pts: THREE.Vector3[] = [];
      const forkPositions: THREE.Vector3[] = [];
      let curX = 0;
      let curY = 13.8;
      let curZ = -22;

      // Initial Lift Hill Climb
      pts.push(new THREE.Vector3(0, 3.8, 28));
      pts.push(new THREE.Vector3(0, 6.2, 12));
      pts.push(new THREE.Vector3(0, 10.5, -6));
      pts.push(new THREE.Vector3(0, 13.8, -22));

      const deck = questions.length > 0 ? questions : SAMPLE_COASTER_QUESTIONS;
      const powerUpOrder: PowerUpType[] = ['magnet', 'slow', 'boost', 'double', 'shield'];

      for (let g = 0; g < deck.length; g++) {
        const qItem = deck[g];
        const correctAns = qItem.options[qItem.answerIndex] || qItem.options[0] || 'Correct';
        const wrongAns =
          qItem.options[qItem.answerIndex === 0 ? 1 : 0] || qItem.options[1] || 'Wrong';

        const correctSide: -1 | 1 = Math.random() < 0.5 ? -1 : 1;
        const leftText = correctSide === -1 ? correctAns : wrongAns;
        const rightText = correctSide === 1 ? correctAns : wrongAns;

        const approachZ = curZ - 19;
        const approachPt = new THREE.Vector3(curX, curY, approachZ);
        pts.push(approachPt);

        const forkZ = approachZ - 15;
        const forkPt = new THREE.Vector3(curX, curY - 1.2, forkZ);
        pts.push(forkPt);
        forkPositions.push(forkPt.clone());

        const branchX = curX + correctSide * 6.8;
        const peakOrDipY = g % 2 === 0 ? Math.max(5.5, curY - 4.8) : Math.min(19, curY + 4.8);
        const postForkZ = forkZ - 21;
        const intactPt = new THREE.Vector3(branchX, peakOrDipY, postForkZ);
        pts.push(intactPt);

        // SYMMETRIC DECOY WRONG BRANCH:
        // Matches the exact same elevation (peakOrDipY), lateral spread, support pillars, and continues far ahead
        // so it is 100% indistinguishable from the correct branch before the player passes the gate!
        const wrongSide = -correctSide;
        const wrongBranchX = curX + wrongSide * 6.8;
        const nextDecoyY = (g + 1) % 2 === 0 ? Math.max(5.5, peakOrDipY - 4.5) : Math.min(19, peakOrDipY + 4.5);

        const wrongMidPt = new THREE.Vector3(
          curX + wrongSide * 3.4,
          (curY - 1.2 + peakOrDipY) * 0.5,
          forkZ - 10.5
        );
        const wrongEndPt = new THREE.Vector3(wrongBranchX, peakOrDipY, postForkZ);

        // Short curve used for riding along the wrong branch right before derailing off the snapped rails
        const wrongRidePts = [forkPt.clone(), wrongMidPt.clone(), wrongEndPt.clone()];
        const wrongCurve = new THREE.CatmullRomCurve3(wrongRidePts);

        // Visual decoy track continues far ahead (forkZ - 64) with pillars so it never looks short or broken before answering!
        const visualDecoyPts = [
          forkPt.clone(),
          wrongMidPt.clone(),
          wrongEndPt.clone(),
          new THREE.Vector3(wrongBranchX, peakOrDipY, postForkZ - 19),
          new THREE.Vector3(wrongBranchX + wrongSide * 2.5, nextDecoyY, postForkZ - 42),
        ];
        const visualDecoyCurve = new THREE.CatmullRomCurve3(visualDecoyPts);
        const decoyMesh = buildDetailedTrackSegment(visualDecoyCurve, 65, true, [forkPt]);
        trackMeshGroup.add(decoyMesh);

        // Dramatic 3D Broken Trap Track (revealed dynamically the instant the player steers onto the wrong track!)
        const trapBreakGroup = buildBrokenTrapBranchMesh(forkPt, wrongMidPt, wrongEndPt, wrongSide);
        trackMeshGroup.add(trapBreakGroup);

        // Add Twin Mystery Portal Rings on BOTH Left and Right branches at forkZ - 10.5
        const midBranchY = (curY - 1.2 + peakOrDipY) * 0.5;
        const leftPortalPos = new THREE.Vector3(curX - 3.4, midBranchY, forkZ - 10.5);
        const rightPortalPos = new THREE.Vector3(curX + 3.4, midBranchY, forkZ - 10.5);
        trackMeshGroup.add(createBranchPortalRing(leftPortalPos, true));
        trackMeshGroup.add(createBranchPortalRing(rightPortalPos, false));

        // Place symmetric coins on BOTH Left and Right branches so coins never give away the answer!
        // When Super Magnet is active, all coins from BOTH the active and opposite tracks are pulled dynamically into the cart!
        [-1, 1].forEach((sideDir) => {
          for (let cStep = 1; cStep <= 5; cStep++) {
            const frac = cStep * 0.165;
            const cPos = new THREE.Vector3(
              curX + sideDir * (6.8 * frac),
              THREE.MathUtils.lerp(curY - 1.2, peakOrDipY, frac) + 1.1,
              THREE.MathUtils.lerp(forkZ, postForkZ, frac)
            );
            const cMesh = create3DCoinMesh();
            cMesh.position.copy(cPos);
            collectiblesGroup.add(cMesh);
            coinItems.push({
              mesh: cMesh,
              worldPos: cPos,
              collected: false,
              laneOffset: 0,
              isBranchCoin: true,
              branchSide: sideDir,
              gateIndex: g,
            });
          }
        });

        gateCheckpoints.push({
          index: g,
          question: qItem.text,
          correctAnswer: correctAns,
          wrongAnswer: wrongAns,
          leftText,
          rightText,
          correctSide,
          forkWorldPos: forkPt.clone(),
          wrongCurve,
          decoyMesh,
          trapBreakGroup,
          forkT: 0,
          promptStartT: 0,
          resolved: false,
          promptShown: false,
        });

        curX = branchX;
        curY = peakOrDipY;
        curZ = postForkZ;
      }

      pts.push(new THREE.Vector3(curX, curY + 3.2, curZ - 25));
      pts.push(new THREE.Vector3(curX, curY, curZ - 52));

      mainCurve = new THREE.CatmullRomCurve3(pts);
      const totalCurveSteps = Math.max(320, deck.length * 45);
      const mainTrackMesh = buildDetailedTrackSegment(mainCurve, totalCurveSteps, true, forkPositions);
      trackMeshGroup.add(mainTrackMesh);

      const totalSamples = 700;
      gateCheckpoints.forEach((gate) => {
        let bestT = 0;
        let bestDist = Infinity;
        for (let s = 0; s <= totalSamples; s++) {
          const t = s / totalSamples;
          const p = mainCurve.getPointAt(t);
          const dist = p.distanceTo(gate.forkWorldPos);
          if (dist < bestDist) {
            bestDist = dist;
            bestT = t;
          }
        }
        gate.forkT = bestT;
        gate.promptStartT = Math.max(0.02, bestT - 0.6 / Math.max(6, deck.length));

        const arch = create3DGateArch(gate.forkWorldPos, gate);
        trackMeshGroup.add(arch);
      });

      // Spawn 3D Golden Coins & Frequent Special Power-Ups along the main coaster approaches
      const numApproachSamples = deck.length * 16;
      for (let s = 3; s < numApproachSamples; s++) {
        const t = s / (numApproachSamples + 2);
        // Skip spawning right on top of a fork arch
        const nearAnyFork = gateCheckpoints.some((g) => Math.abs(t - g.forkT) < 0.022);
        if (nearAnyFork) continue;

        const pt = mainCurve.getPointAt(t);
        const tan = mainCurve.getTangentAt(t).normalize();
        const side = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();

        // Every 6th slot spawns a Special Power-Up Orb (Magnet, Boost, Slow, 2X, Shield)!
        if (s % 6 === 0) {
          const pType = powerUpOrder[Math.floor(s / 6) % powerUpOrder.length];
          const lane = (s % 12 === 0 ? -1 : 1) * 0.45;
          const pPos = pt.clone().addScaledVector(side, lane).add(new THREE.Vector3(0, 1.35, 0));
          const pMesh = create3DPowerUpMesh(pType);
          pMesh.position.copy(pPos);
          collectiblesGroup.add(pMesh);
          powerUpItems.push({ mesh: pMesh, worldPos: pPos, type: pType, collected: false });
        } else {
          // Spawn a gleaming 3D Gold Coin!
          const waveLane = Math.sin(s * 0.7) * 0.55;
          const cPos = pt.clone().addScaledVector(side, waveLane).add(new THREE.Vector3(0, 1.12, 0));
          const cMesh = create3DCoinMesh();
          cMesh.position.copy(cPos);
          collectiblesGroup.add(cMesh);
          coinItems.push({ mesh: cMesh, worldPos: cPos, collected: false, laneOffset: waveLane });
        }
      }
    };

    // 8. Celebration Sparkles, Fireworks & Speed Lines
    const particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
    const spawnCelebrationSparks = (origin: THREE.Vector3, count = 36) => {
      const colors = [0xfacc15, 0x38bdf8, 0x4ade80, 0xf43f5e, 0xa855f7, 0xffffff];
      for (let i = 0; i < count; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: colors[i % colors.length] });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), mat);
        mesh.position.copy(origin).add(new THREE.Vector3(0, 1.2, -2.0));
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 16,
          5 + Math.random() * 11,
          (Math.random() - 0.5) * 14
        );
        scene.add(mesh);
        particles.push({ mesh, vel, life: 1.15 });
      }
    };

    // 3D Wind Speed Streaks around Camera
    const speedLinesGroup = new THREE.Group();
    camera.add(speedLinesGroup);
    const speedLineMeshes: THREE.Mesh[] = [];
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
    });
    for (let i = 0; i < 24; i++) {
      const lineMesh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.8), streakMat);
      const angle = (i / 24) * Math.PI * 2;
      const rad = 2.2 + Math.random() * 1.8;
      lineMesh.position.set(Math.cos(angle) * rad, Math.sin(angle) * rad, -3 - Math.random() * 6);
      speedLinesGroup.add(lineMesh);
      speedLineMeshes.push(lineMesh);
    }

    // 9. Game Loop State Variables
    let ridePhase: 'COUNTDOWN' | 'RIDING' | 'WRONG_BRANCH' | 'FALLING' | 'CRASHED' | 'VICTORY' = 'COUNTDOWN';
    let countdownTimer = 4.0;
    let lastCountdownInt = 5;
    let trackProgressT = 0.0;
    let wrongBranchT = 0.0;
    let activeGateIdx = 0;
    let localCoins = 0;
    let localLives = initialLives;
    let localStreak = 0;
    let maxStreak = 0;
    let rideTimeSec = 0;
    let lastTimerUiUpdate = 0;

    // Active Power-Up state inside 60fps loop
    let magnetTimer = 0;
    let slowTimer = 0;
    let boostTimer = 0;
    let doubleTimer = 0;
    let hasShield = false;
    let lastPowerUpUiSync = 0;

    const fallPosition = new THREE.Vector3();
    const fallVelocity = new THREE.Vector3();
    let fallTimer = 0;

    let lastBoostThrustSec = -1;
    let lastClockTickSec = -1;

    // 1. 3D High-Tech Electromagnetic Field & Horseshoe Hood Badge (Magnet)
    const magnetFieldGroup = new THREE.Group();
    magnetFieldGroup.position.set(0, 0.08, -0.25);
    carHoodGroup.add(magnetFieldGroup);

    const magnetRingMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const magnetAura = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.065, 12, 36), magnetRingMat);
    magnetAura.rotation.x = Math.PI / 2;
    magnetFieldGroup.add(magnetAura);

    const magnetWaveRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const magnetWaveRing = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.045, 12, 32), magnetWaveRingMat);
    magnetFieldGroup.add(magnetWaveRing);

    const hoodMagnetBadgeMat = new THREE.MeshPhysicalMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.2,
      transparent: true,
      opacity: 0.0,
    });
    const hoodMagnetBadge = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.055, 8, 18, Math.PI),
      hoodMagnetBadgeMat
    );
    hoodMagnetBadge.rotation.x = -Math.PI / 2;
    hoodMagnetBadge.position.set(0, 0.1, -0.58);
    magnetFieldGroup.add(hoodMagnetBadge);

    // 2. 3D Dual Rocket Booster Thruster Nacelles & Animated Plasma Flames (Turbo Boost)
    const thrusterGroup = new THREE.Group();
    carHoodGroup.add(thrusterGroup);

    const thrusterNozzleMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.2,
      clearcoat: 1.0,
    });
    const thrusterFlameOuterMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.0,
    });
    const thrusterFlameInnerMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.0,
    });

    const flameMeshes: THREE.Mesh[] = [];
    [-0.58, 0.58].forEach((tx) => {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.3, 16), thrusterNozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(tx, -0.22, 0.28);
      thrusterGroup.add(nozzle);

      // Outer orange flame cone pointing back towards camera / rear
      const outerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 14), thrusterFlameOuterMat);
      outerFlame.rotation.x = -Math.PI / 2;
      outerFlame.position.set(tx, -0.22, 0.72);
      thrusterGroup.add(outerFlame);
      flameMeshes.push(outerFlame);

      // Inner cyan plasma cone
      const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.55, 12), thrusterFlameInnerMat);
      innerFlame.rotation.x = -Math.PI / 2;
      innerFlame.position.set(tx, -0.22, 0.6);
      thrusterGroup.add(innerFlame);
      flameMeshes.push(innerFlame);
    });

    // 3. 3D Shield Bubble with Rotating Orbital Rings (Shield)
    const shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 20, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.0,
        roughness: 0.1,
        clearcoat: 1.0,
      })
    );
    shieldBubble.position.set(0, 0.12, -0.2);
    carHoodGroup.add(shieldBubble);

    const shieldOrbitalRingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.0,
    });
    const shieldOrbitalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.78, 0.04, 12, 32),
      shieldOrbitalRingMat
    );
    shieldBubble.add(shieldOrbitalRing);

    const positionCameraOnCurve = (curve: THREE.CatmullRomCurve3, t: number, extraRoll = 0) => {
      const clampedT = Math.max(0, Math.min(0.999, t));
      const pos = curve.getPointAt(clampedT);
      const tangent = curve.getTangentAt(clampedT).normalize();

      const eyePos = pos.clone().add(new THREE.Vector3(0, 1.48, 0));
      camera.position.copy(eyePos);

      const lookTarget = eyePos
        .clone()
        .add(tangent.clone().multiplyScalar(12))
        .add(new THREE.Vector3(0, -0.82, 0));
      camera.lookAt(lookTarget);

      // Banking roll
      camera.rotateZ(-extraRoll * 0.24);

      // Animate Cute Hamster Co-Pilot leaning & waving paws!
      hamsterGroup.rotation.z = -extraRoll * 0.38;
      hamsterGroup.rotation.y = -extraRoll * 0.25;
      const pawWave = Math.sin(performance.now() * 0.014) * 0.12;
      leftPaw.position.y = 0.11 + pawWave + (tangent.y < -0.1 ? 0.08 : 0);
      rightPaw.position.y = 0.11 - pawWave + (tangent.y < -0.1 ? 0.08 : 0);
      carHoodGroup.rotation.z = -extraRoll * 0.08;

      if (bumperRef.current) {
        bumperRef.current.style.transform = `rotate(${-extraRoll * 3.5}deg) translateY(6px)`;
      }
    };

    const syncPowerUpsToUI = () => {
      setActivePowerUps({
        magnet: Math.ceil(magnetTimer),
        slow: Math.ceil(slowTimer),
        boost: Math.ceil(boostTimer),
        double: Math.ceil(doubleTimer),
        shield: hasShield,
      });
    };

    const startCountdown = () => {
      ridePhase = 'COUNTDOWN';
      countdownTimer = 4.0;
      lastCountdownInt = 5;
      setCountdownNum(4);
      setActivePrompt(null);
      setGateSecondsLeft(null);
      setDangerVignette(false);
      setCrashModal(null);
      setVictoryModal(null);
    };

    const spawnTrapShatterSparks = (origin: THREE.Vector3) => {
      const fireColors = [0xef4444, 0xf97316, 0xfacc15, 0x78350f, 0xffffff];
      for (let i = 0; i < 44; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: fireColors[i % fireColors.length] });
        const isWoodSplinter = i % 4 === 0;
        const geo = isWoodSplinter
          ? new THREE.BoxGeometry(0.45, 0.12, 0.16)
          : new THREE.BoxGeometry(0.24, 0.24, 0.24);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(origin).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0.6, -1.0));
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 19,
          4 + Math.random() * 13,
          -4 + (Math.random() - 0.5) * 15
        );
        scene.add(mesh);
        particles.push({ mesh, vel, life: 1.25 });
      }
    };

    const triggerRetryCheckpoint = () => {
      if (localLives <= 0) return;
      setCrashModal(null);
      setDangerVignette(false);
      const gate = gateCheckpoints[activeGateIdx];
      if (gate) {
        gate.resolved = false;
        gate.promptShown = false;
        gate.decoyMesh.visible = true;
        gate.trapBreakGroup.visible = false;
        trackProgressT = Math.max(0.01, gate.promptStartT - 0.018);
      } else {
        trackProgressT = 0;
      }
      steeringRef.current = 0;
      smoothSteerRef.current = 0;
      setSteeringChoice(0);
      setSmoothSteerPct(50);
      ridePhase = 'RIDING';
    };

    const triggerFullRestart = () => {
      localCoins = 0;
      localLives = initialLives;
      localStreak = 0;
      maxStreak = 0;
      rideTimeSec = 0;
      magnetTimer = 0;
      slowTimer = 0;
      boostTimer = 0;
      doubleTimer = 0;
      hasShield = false;
      activeGateIdx = 0;
      trackProgressT = 0;
      steeringRef.current = 0;
      smoothSteerRef.current = 0;
      setCoinsCount(0);
      setLivesLeft(initialLives);
      setRemainingSeconds(timerMinutesRef.current * 60);
      setGateSecondsLeft(null);
      setStreak(0);
      setCurrentGateIdx(0);
      setSteeringChoice(0);
      setSmoothSteerPct(50);
      syncPowerUpsToUI();
      buildCourseFromQuestions();
      startCountdown();
    };

    const selectSteer = (dir: -1 | 1) => {
      ensureAudio();
      steeringRef.current = dir;
      smoothSteerRef.current = dir;
      setSteeringChoice(dir);
      setSmoothSteerPct(50 + dir * 38);
      playRailSwitchClick(dir);
    };

    const triggerEndRideNow = () => {
      ridePhase = 'VICTORY';
      updateContinuousCoasterSound(0, false, 0);
      playCorrectFanfare(4);
      spawnCelebrationSparks(camera.position, 55);
      setActivePrompt(null);
      setGateSecondsLeft(null);
      setVictoryModal({
        maxStreak,
        coins: localCoins,
        timeSec: Math.round(rideTimeSec),
        livesRemaining: localLives,
        gatesCleared: activeGateIdx,
        totalGates: gateCheckpoints.length || questions.length,
        endedEarly: true,
      });
    };

    actionsRef.current = {
      retryCheckpoint: triggerRetryCheckpoint,
      restartFullRide: triggerFullRestart,
      selectSteer,
      endRideNow: triggerEndRideNow,
    };

    // Initialize course & countdown
    buildCourseFromQuestions();
    startCountdown();

    // Keyboard & Resize Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        selectSteer(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        selectSteer(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const onResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || window.innerWidth;
      const h = mountRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 10. Main 60FPS Animation Loop
    let animFrameId: number;
    let prevTime = performance.now();

    const animate = (now: number) => {
      animFrameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;

      if (pausedRef.current) {
        updateContinuousCoasterSound(0, false, 0);
        renderer.render(scene, camera);
        return;
      }

      if (ferrisWheelRotor) ferrisWheelRotor.rotation.z += 0.16 * dt;
      if (carouselRotor) carouselRotor.rotation.y += 0.48 * dt;

      // Spin 3D Coins & Power-Ups
      coinItems.forEach((c) => {
        if (!c.collected) {
          c.mesh.rotation.y += 3.4 * dt;
        }
      });
      powerUpItems.forEach((p, idx) => {
        if (!p.collected) {
          p.mesh.rotation.y += 2.2 * dt;
          p.mesh.position.y = p.worldPos.y + Math.sin(now * 0.004 + idx) * 0.18;
        }
      });

      // Update Visual Auras & Thruster Flames on Coaster Hood
      const isMagnetActive = magnetTimer > 0;
      const isBoostActive = boostTimer > 0;
      const isSlowActive = slowTimer > 0;
      const isDoubleActive = doubleTimer > 0;

      // 1. Magnet Electromagnetic Field Animation
      magnetRingMat.opacity = isMagnetActive ? 0.78 + Math.sin(now * 0.018) * 0.22 : 0;
      magnetAura.scale.setScalar(1 + Math.sin(now * 0.015) * 0.22);
      magnetAura.rotation.z += 2.8 * dt;

      magnetWaveRingMat.opacity = isMagnetActive ? 0.58 + Math.cos(now * 0.02) * 0.28 : 0;
      magnetWaveRing.scale.setScalar(0.95 + Math.cos(now * 0.018) * 0.2);
      magnetWaveRing.rotation.y += 3.6 * dt;
      magnetWaveRing.rotation.x = Math.PI / 2 + Math.sin(now * 0.012) * 0.35;

      hoodMagnetBadgeMat.opacity = isMagnetActive ? 1.0 : 0.0;
      hoodMagnetBadgeMat.emissiveIntensity = isMagnetActive ? 1.6 + Math.sin(now * 0.022) * 0.8 : 0;

      // 2. Turbo Boost Rocket Thruster Plumes & Ember Sparks
      thrusterFlameOuterMat.opacity = isBoostActive ? 0.88 + Math.random() * 0.12 : 0;
      thrusterFlameInnerMat.opacity = isBoostActive ? 0.95 : 0;
      flameMeshes.forEach((flame, idx) => {
        if (isBoostActive) {
          const jitter = Math.sin(now * 0.05 + idx * 1.5) * 0.22;
          flame.scale.set(1 + Math.random() * 0.18, 1 + Math.random() * 0.18, 1.9 + jitter + Math.random() * 0.45);
        }
      });

      if (isBoostActive && Math.random() < 0.38) {
        [-0.58, 0.58].forEach((tx) => {
          const sparkMat = new THREE.MeshBasicMaterial({ color: Math.random() < 0.6 ? 0xf97316 : 0xfacc15 });
          const spark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), sparkMat);
          spark.position.copy(camera.position).add(new THREE.Vector3(tx, -0.28, 0.5));
          const vel = new THREE.Vector3((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, 26 + Math.random() * 14);
          scene.add(spark);
          particles.push({ mesh: spark, vel, life: 0.35 });
        });
      }

      // 3. Shield Bubble & Rotating Energy Rings
      (shieldBubble.material as THREE.MeshPhysicalMaterial).opacity =
        hasShield ? 0.38 + Math.sin(now * 0.008) * 0.12 : 0;
      shieldOrbitalRing.rotation.y += 2.2 * dt;
      shieldOrbitalRing.rotation.x += 1.6 * dt;
      shieldOrbitalRingMat.opacity = hasShield ? 0.68 + Math.sin(now * 0.015) * 0.25 : 0;

      // 4. Double Points Coin Glow
      coinGoldMat.emissiveIntensity = isDoubleActive ? 0.9 + Math.sin(now * 0.015) * 0.4 : 0.35;
      coinGoldMat.emissive.setHex(isDoubleActive ? 0xc084fc : 0xd97706);

      // 5. Dynamic Camera FOV (Warp Speed Sensation)
      const targetFov = isBoostActive ? 82 : isSlowActive ? 62 : 68;
      if (Math.abs(camera.fov - targetFov) > 0.08) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 9 * dt);
        camera.updateProjectionMatrix();
      }

      // Update Confetti / Sparks
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vel.y -= 18 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += 5 * dt;
        p.mesh.rotation.y += 5 * dt;
        if (p.life <= 0) {
          scene.remove(p.mesh);
          p.mesh.geometry.dispose();
          (p.mesh.material as THREE.Material).dispose();
          particles.splice(i, 1);
        }
      }

      // Compute Effective Speed Multiplier (Difficulty + Slow-Mo + Turbo Boost)
      const activeDiffMult = speedMultRef.current;
      const powerSpeedMod = isBoostActive ? 1.85 : isSlowActive ? 0.58 : 1.0;
      const effectiveSpeedMult = activeDiffMult * powerSpeedMod;
      const baseSpeedT = (0.21 / Math.max(6, questions.length)) * effectiveSpeedMult;

      // Animate 3D Speed Streaks
      streakMat.color.setHex(isBoostActive ? 0xfba524 : isSlowActive ? 0x38bdf8 : 0xffffff);
      streakMat.opacity = isBoostActive ? 0.85 : isSlowActive ? 0.45 : 0.35;
      speedLineMeshes.forEach((line) => {
        line.position.z += (isBoostActive ? 55 : 28) * effectiveSpeedMult * dt;
        if (line.position.z > 0.5) {
          line.position.z = -8 - Math.random() * 4;
        }
      });

      if (ridePhase === 'COUNTDOWN') {
        trackProgressT = Math.min(0.04, trackProgressT + 0.006 * dt);
        positionCameraOnCurve(mainCurve, trackProgressT, smoothSteerRef.current);
        playChainClack(140);
        updateContinuousCoasterSound(0.3, false, 0);

        countdownTimer -= dt;
        const ceilInt = Math.ceil(countdownTimer);
        if (ceilInt !== lastCountdownInt && ceilInt >= 1) {
          lastCountdownInt = ceilInt;
          setCountdownNum(ceilInt);
          playTone(440 + (4 - ceilInt) * 65, 'sine', 0.12, 0.18);
        }

        if (countdownTimer <= 0) {
          playTone(880, 'triangle', 0.32, 0.26);
          setCountdownNum(null);
          ridePhase = 'RIDING';
        }
      } else if (ridePhase === 'RIDING') {
        // 1. Countdown Timer (1 to 10 minutes configured in Setup) & Power-Up Timers
        rideTimeSec += dt;
        if (magnetTimer > 0) magnetTimer = Math.max(0, magnetTimer - dt);
        if (slowTimer > 0) slowTimer = Math.max(0, slowTimer - dt);
        if (boostTimer > 0) boostTimer = Math.max(0, boostTimer - dt);
        if (doubleTimer > 0) doubleTimer = Math.max(0, doubleTimer - dt);

        if (isBoostActive && Math.floor(rideTimeSec * 3.5) !== lastBoostThrustSec) {
          lastBoostThrustSec = Math.floor(rideTimeSec * 3.5);
          if (!isMutedRef.current) {
            playTone(190 + Math.random() * 40, 'sawtooth', 0.08, 0.12, 360);
          }
        }
        if (isSlowActive && Math.floor(rideTimeSec * 2.2) !== lastClockTickSec) {
          lastClockTickSec = Math.floor(rideTimeSec * 2.2);
          if (!isMutedRef.current) {
            playTone(784, 'triangle', 0.03, 0.06);
          }
        }

        const totalAllowedSec = timerMinutesRef.current * 60;
        const remSec = Math.max(0, Math.ceil(totalAllowedSec - rideTimeSec));

        if (now - lastTimerUiUpdate > 120) {
          lastTimerUiUpdate = now;
          setRemainingSeconds(remSec);
        }
        if (now - lastPowerUpUiSync > 250) {
          lastPowerUpUiSync = now;
          syncPowerUpsToUI();
        }

        // Check if Ride Countdown Timer hit 00:00 -> GAME OVER!
        if (remSec <= 0) {
          setRemainingSeconds(0);
          ridePhase = 'CRASHED';
          setActivePrompt(null);
          setGateSecondsLeft(null);
          updateContinuousCoasterSound(0, false, 0);
          playDerailmentAlarmAndCrash();
          const gate = gateCheckpoints[activeGateIdx];
          setCrashModal({
            title: "⏰ TIME'S UP! GAME OVER!",
            reason: `Your ${timerMinutesRef.current}-minute coaster timer ran out before reaching the finish line!`,
            question: gate?.question || 'Course Timer Expired',
            wrongAnswer: 'Ran Out of Time (00:00)',
            correctAnswer: gate?.correctAnswer || 'Complete all gates before the timer ends!',
            gateNumber: (gate?.index ?? activeGateIdx) + 1,
            totalGates: gateCheckpoints.length || questions.length,
            wasTimeout: true,
            livesRemaining: 0,
            isGameOver: true,
            isTimeUp: true,
          });
          renderer.render(scene, camera);
          return;
        }

        const tangent = mainCurve.getTangentAt(Math.min(0.99, trackProgressT));
        const slopeFactor = 1.0 - tangent.y * 0.48;
        const currentSpeed = baseSpeedT * Math.max(0.65, slopeFactor);

        if (tangent.y > 0.12) {
          playChainClack(120);
        }
        updateContinuousCoasterSound(slopeFactor * effectiveSpeedMult, true, smoothSteerRef.current);
        updateRideMusic(now, true, effectiveSpeedMult);

        trackProgressT += currentSpeed * dt;
        positionCameraOnCurve(mainCurve, trackProgressT, smoothSteerRef.current);

        const coinMultiplier = doubleTimer > 0 ? 2 : 1;

        // 2. Check 3D Coin Pickups & Cross-Track Magnet Pull
        // Uses the real camera/cockpit position so it reaches across twin branches and hills seamlessly
        const cartTarget = camera.position.clone().addScaledVector(tangent, 1.1).add(new THREE.Vector3(0, -0.22, 0));
        const magnetRadius = isMagnetActive ? 65.0 : 3.1;
        const currentSteerSide = steeringRef.current;

        for (let i = 0; i < coinItems.length; i++) {
          const c = coinItems[i];
          if (c.collected) continue;

          const toCart = cartTarget.clone().sub(c.mesh.position);
          const dist = toCart.length();

          if (isMagnetActive && dist < magnetRadius) {
            toCart.normalize();
            // Pull coin swiftly towards the coaster cart so coins on the other track catch up effortlessly!
            const pullSpeed = Math.max(48, 72 - dist * 0.32) * (isBoostActive ? 1.35 : 1.0);
            c.mesh.position.addScaledVector(toCart, pullSpeed * dt);
            
            // Graceful magnetic arch lift over tracks & cross gaps
            c.mesh.position.y += Math.sin(Math.min(Math.PI, (1 - dist / magnetRadius) * Math.PI)) * 0.28;
            
            // Frenetic magnetic spin
            c.mesh.rotation.y += 26 * dt;
            c.mesh.rotation.x += 16 * dt;
            c.mesh.scale.setScalar(1.28);

            // Subtle electromagnetic spark tether between coin and cart
            if (Math.random() < 0.22) {
              const sparkMat = new THREE.MeshBasicMaterial({
                color: c.isBranchCoin && c.branchSide !== currentSteerSide ? 0xf43f5e : 0xfacc15,
              });
              const spark = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), sparkMat);
              spark.position.copy(c.mesh.position).add(
                new THREE.Vector3(
                  (Math.random() - 0.5) * 0.4,
                  (Math.random() - 0.5) * 0.4,
                  (Math.random() - 0.5) * 0.4
                )
              );
              const vel = toCart.clone().multiplyScalar(16 + Math.random() * 8);
              scene.add(spark);
              particles.push({ mesh: spark, vel, life: 0.35 });
            }
          }

          // Collection threshold: generous when magnet is active so high-velocity cross-track coins are always captured!
          const pickupThreshold = isMagnetActive ? 5.2 : 2.85;
          if (dist < pickupThreshold) {
            c.collected = true;
            c.mesh.visible = false;

            const isOtherTrack = Boolean(
              c.isBranchCoin &&
              c.branchSide !== undefined &&
              currentSteerSide !== 0 &&
              c.branchSide !== currentSteerSide
            );

            const baseGain = isOtherTrack ? 2 : 1;
            const addedCoins = baseGain * coinMultiplier;
            localCoins += addedCoins;
            setCoinsCount(localCoins);

            if (isOtherTrack) {
              playCrossTrackCollectSound();
              spawnCelebrationSparks(c.mesh.position, 16);
              pushScorePopup(`🧲 OTHER TRACK COIN +${addedCoins} 🪙`, 'text-rose-300', 'Cross-Track Magnetic Pull!');
            } else {
              playCoinCollectSound();
              spawnCelebrationSparks(c.mesh.position, 10);
              pushScorePopup(`+${addedCoins} 🪙`, 'text-amber-300', doubleTimer > 0 ? '2X COINS!' : undefined);
            }
          }
        }

        // 3. Check 3D Special Power-Up Pickups
        for (let i = 0; i < powerUpItems.length; i++) {
          const p = powerUpItems[i];
          if (p.collected) continue;

          const toCart = cartTarget.clone().sub(p.mesh.position);
          const dist = toCart.length();
          if (isMagnetActive && dist < 24.0 && dist > 2.0) {
            toCart.normalize();
            p.mesh.position.addScaledVector(toCart, 25 * dt);
          }

          if (dist < (isMagnetActive ? 5.8 : 3.2)) {
            p.collected = true;
            p.mesh.visible = false;
            const bonusCoins = 3 * coinMultiplier;
            localCoins += bonusCoins;
            setCoinsCount(localCoins);
            playPowerUpSound(p.type);
            spawnCelebrationSparks(p.mesh.position, 28);

            if (p.type === 'magnet') {
              magnetTimer = 11.0;
              pushScorePopup('🧲 SUPER MAGNET ACTIVE!', 'text-rose-300', `Pulls all coins from BOTH tracks! +${bonusCoins} 🪙`);
            } else if (p.type === 'slow') {
              slowTimer = 9.0;
              pushScorePopup('⏳ SLOW-MO MATRIX!', 'text-cyan-300', `Time Dilation +${bonusCoins} 🪙`);
            } else if (p.type === 'boost') {
              boostTimer = 7.0;
              pushScorePopup('🚀 HYPER TURBO BOOST!', 'text-orange-300', `Warp Speed & Auto-Pilot +${bonusCoins} 🪙`);
            } else if (p.type === 'double') {
              doubleTimer = 14.0;
              pushScorePopup('⚡ 2X COINS ACTIVE!', 'text-purple-300', `Double Value for 14s!`);
            } else if (p.type === 'shield') {
              hasShield = true;
              pushScorePopup('🛡️ SAFETY FORCE SHIELD!', 'text-emerald-300', `Invulnerable to 1 wrong turn!`);
            }
            syncPowerUpsToUI();
          }
        }

        // 4. Question Gate Approach & Fork Resolution
        const gate = gateCheckpoints[activeGateIdx];
        if (gate && !gate.resolved) {
          if (!gate.promptShown && trackProgressT >= gate.promptStartT) {
            gate.promptShown = true;
            steeringRef.current = 0;
            smoothSteerRef.current = 0;
            setSteeringChoice(0);
            setSmoothSteerPct(50);
            setCurrentGateIdx(gate.index);
            setActivePrompt({
              index: gate.index,
              total: gateCheckpoints.length,
              question: gate.question,
              leftText: gate.leftText,
              rightText: gate.rightText,
              correctSide: gate.correctSide,
            });
            speakQuestion(gate.question);
          }

          if (gate.promptShown) {
            const totalWindow = Math.max(0.001, gate.forkT - gate.promptStartT);
            const remaining = Math.max(0, Math.min(1, (gate.forkT - trackProgressT) / totalWindow));
            setTimerPct(remaining * 100);
            const approxSecLeft = Math.max(0, (gate.forkT - trackProgressT) / Math.max(0.001, currentSpeed));
            setGateSecondsLeft(Number(approxSecLeft.toFixed(1)));

            // If Turbo Boost is active near the fork and player hasn't locked correct side, auto-pilot!
            if (boostTimer > 0 && remaining < 0.48 && steeringRef.current !== gate.correctSide) {
              steeringRef.current = gate.correctSide;
              smoothSteerRef.current = gate.correctSide;
              setSteeringChoice(gate.correctSide);
              setSmoothSteerPct(50 + gate.correctSide * 38);
              pushScorePopup('🚀 BOOST AUTO-PILOT!', 'text-amber-300', `Locked onto ${gate.correctAnswer}!`);
            }
          }

          if (trackProgressT >= gate.forkT) {
            gate.resolved = true;
            setActivePrompt(null);
            setGateSecondsLeft(null);

            if (steeringRef.current === gate.correctSide || boostTimer > 0) {
              // CORRECT RAIL OR TURBO OVERDRIVE!
              if (steeringRef.current !== gate.correctSide) {
                steeringRef.current = gate.correctSide;
                smoothSteerRef.current = gate.correctSide;
                setSteeringChoice(gate.correctSide);
                setSmoothSteerPct(50 + gate.correctSide * 38);
              }
              localStreak += 1;
              maxStreak = Math.max(maxStreak, localStreak);
              const gateCoins = (5 + (boostTimer > 0 ? 5 : 0)) * coinMultiplier;
              localCoins += gateCoins;
              setCoinsCount(localCoins);
              setStreak(localStreak);
              playCorrectFanfare(localStreak);
              spawnCelebrationSparks(camera.position, 40);
              pushScorePopup(
                `+${gateCoins} 🪙 GATE CLEAR!`,
                'text-emerald-300',
                boostTimer > 0 ? '🚀 TURBO OVERDRIVE BONUS!' : `${localStreak}x Streak 🔥`
              );
              activeGateIdx++;
            } else if (hasShield) {
              // SHIELD SAVES PLAYER FROM WRONG TRACK!
              hasShield = false;
              syncPowerUpsToUI();
              steeringRef.current = gate.correctSide;
              smoothSteerRef.current = gate.correctSide;
              setSteeringChoice(gate.correctSide);
              setSmoothSteerPct(50 + gate.correctSide * 38);
              playPowerUpSound('shield');
              spawnCelebrationSparks(camera.position, 32);
              pushScorePopup('🛡️ SHIELD SAVED YOU!', 'text-emerald-300', `Auto-Switched to ${gate.correctAnswer}!`);
              activeGateIdx++;
            } else {
              // WRONG RAIL — Dynamically reveal the 3D broken trap track ahead as the coaster enters the wrong branch!
              localStreak = 0;
              setStreak(0);
              gate.decoyMesh.visible = false;
              gate.trapBreakGroup.visible = true;
              ridePhase = 'WRONG_BRANCH';
              wrongBranchCurve = gate.wrongCurve;
              wrongBranchT = 0.0;
              setDangerVignette(true);
              playTone(220, 'sawtooth', 0.35, 0.24, 130);
            }
          }
        }

        if (trackProgressT >= 0.975) {
          ridePhase = 'VICTORY';
          updateContinuousCoasterSound(0, false, 0);
          playCorrectFanfare(5);
          spawnCelebrationSparks(camera.position, 55);
          setVictoryModal({
            maxStreak,
            coins: localCoins,
            timeSec: Math.round(rideTimeSec),
            livesRemaining: localLives,
          });
        }
      } else if (ridePhase === 'WRONG_BRANCH' && wrongBranchCurve) {
        wrongBranchT += 1.05 * dt;
        const shakeRoll = smoothSteerRef.current + Math.sin(now * 0.055) * 0.35;
        positionCameraOnCurve(wrongBranchCurve, Math.min(0.75, wrongBranchT), shakeRoll);

        if (wrongBranchT >= 0.72) {
          ridePhase = 'FALLING';
          fallTimer = 0;
          const endPt = wrongBranchCurve.getPointAt(0.72).add(new THREE.Vector3(0, 1.38, 0));
          const endTan = wrongBranchCurve.getTangentAt(0.72).normalize();
          fallPosition.copy(endPt);
          fallVelocity.copy(endTan).multiplyScalar(22);
          spawnTrapShatterSparks(endPt);
          updateContinuousCoasterSound(0, false, 0);
          playDerailmentAlarmAndCrash();
        }
      } else if (ridePhase === 'FALLING') {
        fallTimer += dt;
        fallVelocity.y -= 34 * dt;
        fallPosition.addScaledVector(fallVelocity, dt);

        camera.position.copy(fallPosition);
        camera.rotation.x -= 1.45 * dt;
        camera.rotation.z += (steeringRef.current || 1) * 1.85 * dt;

        if (fallPosition.y <= 1.8 || fallTimer > 1.55) {
          ridePhase = 'CRASHED';
          localLives = Math.max(0, localLives - 1);
          setLivesLeft(localLives);
          const isOutOfLives = localLives <= 0;

          const gate = gateCheckpoints[activeGateIdx];
          const wasTimeout = steeringRef.current === 0;
          setCrashModal({
            title: isOutOfLives
              ? '💔 OUT OF LIVES! GAME OVER!'
              : wasTimeout
              ? 'TIME RAN OUT! TRACK SPLIT MISSED!'
              : 'WRONG TRACK! YOU FELL!',
            reason: isOutOfLives
              ? 'You lost all your hearts! Start a new ride to try again.'
              : wasTimeout
              ? "You didn't lean or steer Left/Right before reaching the track junction!"
              : 'Your coaster smashed through the hazard barrier onto the snapped trap rail!',
            question: gate?.question || '',
            wrongAnswer: wasTimeout ? 'No Track Selected (Center)' : gate?.wrongAnswer || 'Wrong Track',
            correctAnswer: gate?.correctAnswer || '',
            gateNumber: (gate?.index ?? activeGateIdx) + 1,
            totalGates: gateCheckpoints.length || questions.length,
            wasTimeout,
            livesRemaining: localLives,
            isGameOver: isOutOfLives,
          });
        }
      }

      renderer.render(scene, camera);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      updateContinuousCoasterSound(0, false, 0);
      if (audioRef.current.ctx) {
        try {
          audioRef.current.ctx.close();
        } catch {}
        audioRef.current.ctx = null;
      }
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [questions, parkTheme, initialLives]);

  // Auto-Detect Tablet Tilt (Lean Left / Lean Right) Support
  const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (!tabletModeRef.current) return;
    // Detect screen orientation angle so Portrait, Landscape-Left, and Landscape-Right all auto-detect accurately
    const screenAngle =
      typeof window.screen?.orientation?.angle === 'number'
        ? window.screen.orientation.angle
        : typeof (window as any).orientation === 'number'
        ? (window as any).orientation
        : window.innerWidth > window.innerHeight
        ? 90
        : 0;

    let rawTilt: number | null = null;
    if (screenAngle === 90) {
      rawTilt = event.beta;
    } else if (screenAngle === -90 || screenAngle === 270) {
      rawTilt = event.beta !== null ? -event.beta : null;
    } else {
      rawTilt = event.gamma;
    }

    if (rawTilt === null || rawTilt === undefined) return;
    const deg = Math.round(rawTilt);
    setTiltAngleDeg(deg);

    const divisor = Math.max(8, 17 / Math.max(0.5, tiltSensitivityRef.current));
    const normalized = Math.max(-1, Math.min(1, rawTilt / divisor));
    smoothSteerRef.current = normalized;
    setSmoothSteerPct(50 + normalized * 38);

    // Auto-select Left (-1) or Right (+1) when tablet is leaned!
    const threshold = 0.24;
    if (normalized < -threshold && steeringRef.current !== -1) {
      actionsRef.current.selectSteer(-1);
      setTiltStatus('◀ Leaning Left');
    } else if (normalized > threshold && steeringRef.current !== 1) {
      actionsRef.current.selectSteer(1);
      setTiltStatus('Leaning Right ▶');
    } else if (Math.abs(normalized) <= threshold * 0.6) {
      setTiltStatus('Tablet Auto-Tilt Active ✓');
    }
  };

  const requestTabletTilt = async () => {
    ensureAudio();
    setTabletMode(true);
    tabletModeRef.current = true;
    try {
      const DevOrient = DeviceOrientationEvent as any;
      if (typeof DevOrient !== 'undefined' && typeof DevOrient.requestPermission === 'function') {
        const res = await DevOrient.requestPermission();
        if (res === 'granted') {
          window.addEventListener('deviceorientation', handleDeviceOrientation, true);
          setTiltStatus('Tablet Auto-Tilt Active ✓');
        } else {
          setTiltStatus('Touch Mode Active');
        }
      } else if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
        setTiltStatus('Tablet Auto-Tilt Active ✓');
      } else {
        setTiltStatus('Touch / Keys Active');
      }
    } catch {
      setTiltStatus('Touch / Keys Active');
    }
  };

  useEffect(() => {
    // Automatically attach DeviceOrientation listener on Android/Chrome/Tablet devices that don't require iOS prompt
    const DevOrient = typeof DeviceOrientationEvent !== 'undefined' ? (DeviceOrientationEvent as any) : null;
    if (DevOrient && typeof DevOrient.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', handleDeviceOrientation, true);
    }
    return () => {
      window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
    };
  }, []);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden select-none bg-slate-950">
      <style>{`
        .coaster-title-stroke {
          color: #ffffff;
          text-shadow:
            0 4px 0 #0f172a,
            -2px -2px 0 #0f172a,
            2px -2px 0 #0f172a,
            -2px 2px 0 #0f172a,
            2px 2px 0 #0f172a,
            0 12px 28px rgba(0,0,0,0.7);
        }
        .coaster-countdown-num {
          color: #fbbf24;
          text-shadow:
            0 6px 0 #78350f,
            -3px -3px 0 #78350f,
            3px -3px 0 #78350f,
            -3px 3px 0 #78350f,
            3px 3px 0 #78350f,
            0 15px 35px rgba(0,0,0,0.8);
        }
        .coaster-touch-wheel {
          border: 3.5px dashed rgba(255, 255, 255, 0.7);
          box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.1), 0 0 25px rgba(0, 0, 0, 0.45);
          transition: all 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(3px);
        }
        .coaster-touch-wheel.active-left {
          border-color: #38bdf8;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.38) 0%, rgba(56, 189, 248, 0.06) 70%);
          transform: scale(1.08);
          box-shadow: 0 0 40px rgba(56, 189, 248, 0.7), inset 0 0 25px rgba(56, 189, 248, 0.35);
        }
        .coaster-touch-wheel.active-right {
          border-color: #f43f5e;
          background: radial-gradient(circle, rgba(244, 63, 94, 0.38) 0%, rgba(244, 63, 94, 0.06) 70%);
          transform: scale(1.08);
          box-shadow: 0 0 40px rgba(244, 63, 94, 0.7), inset 0 0 25px rgba(244, 63, 94, 0.35);
        }
      `}</style>

      {/* 3D WebGL Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Red Danger Vignette on Wrong Track */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${
          dangerVignette ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          background: 'radial-gradient(circle, transparent 38%, rgba(220, 38, 38, 0.78) 100%)',
        }}
      />

      {/* Turbo Boost Screen Speed Warp Vignette & Banner */}
      {activePowerUps.boost > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 border-4 border-orange-500/40 shadow-[inset_0_0_80px_rgba(249,115,22,0.38)]">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 backdrop-blur-md border border-yellow-200/80 px-4 py-1.5 rounded-full text-slate-950 font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-bounce">
            <span>🚀</span>
            <span className="tracking-wide">HYPER TURBO BOOST ENGAGED</span>
            <span className="bg-slate-950/20 px-2 py-0.5 rounded-full text-[11px] font-mono text-white font-bold">Auto-Pilot Active</span>
          </div>
        </div>
      )}

      {/* Super Magnet Screen Aura & Cross-Track Banner */}
      {activePowerUps.magnet > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 border-4 border-rose-500/35 shadow-[inset_0_0_75px_rgba(244,63,94,0.32)]">
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-700 via-pink-600 to-rose-700 backdrop-blur-md border border-rose-300/80 px-4 py-1.5 rounded-full text-white font-black text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-pulse">
            <span>🧲</span>
            <span className="tracking-wide">SUPER MAGNET ACTIVE</span>
            <span className="bg-black/30 px-2 py-0.5 rounded-full text-[11px] font-medium text-pink-200">Attracting Coins from ALL Tracks</span>
          </div>
        </div>
      )}

      {/* Slow-Mo Matrix Vignette */}
      {activePowerUps.slow > 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 border-4 border-cyan-500/30 shadow-[inset_0_0_65px_rgba(6,182,212,0.25)]" />
      )}

      {/* Top HUD Bar (Big Coins Counter, Hearts Lives Indicator, Countdown Timer & Gate Progress — No LIVE PTS or km/h) */}
      <header className="absolute top-0 left-0 right-0 z-40 flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-5 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <button
            onClick={onExitToSetup}
            className="bg-slate-900/90 hover:bg-slate-800 backdrop-blur-md border border-white/25 text-white rounded-2xl px-3 py-2 flex items-center gap-1.5 text-xs sm:text-sm font-bold shadow-xl cursor-pointer transition active:scale-95"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Setup</span>
          </button>

          {/* Big Coins, Hearts Lives Indicator, Countdown Timer & Gate Progress Pill */}
          <div className="bg-slate-900/92 backdrop-blur-md border border-white/25 rounded-2xl px-4 py-2 flex items-center gap-3 sm:gap-4 shadow-2xl">
            {/* BIGGER Coins Counter (Only Coins shown, no LIVE PTS) */}
            <div className="flex items-center gap-2" title="Coins Collected on Rails">
              <span className="text-2xl sm:text-3xl drop-shadow-[0_2px_8px_rgba(250,204,21,0.65)] animate-pulse">
                🪙
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase font-black tracking-widest text-yellow-300/90">
                  COINS
                </span>
                <span className="text-yellow-300 text-xl sm:text-3xl font-black tracking-tight tabular-nums drop-shadow">
                  {coinsCount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="h-8 w-px bg-white/15" />

            {/* Hearts Lives Indicator */}
            <div className="flex flex-col leading-none" title="Player Lives Remaining">
              <span className="text-[9px] uppercase font-extrabold tracking-wider text-rose-300/90 mb-0.5">
                LIVES
              </span>
              <div className="flex items-center gap-0.5 sm:gap-1">
                {Array.from({ length: initialLives }).map((_, i) => (
                  <span
                    key={i}
                    className={`text-base sm:text-xl transition-transform duration-300 ${
                      i < livesLeft ? 'scale-100 drop-shadow-[0_0_8px_rgba(244,63,94,0.65)]' : 'opacity-35 scale-90 grayscale'
                    }`}
                  >
                    {i < livesLeft ? '❤️' : '🖤'}
                  </span>
                ))}
              </div>
            </div>

            <div className="h-8 w-px bg-white/15" />

            {/* Countdown Ride Timer (Configured 1 to 10 Minutes in Setup) */}
            <div className="flex items-center gap-1.5" title="Countdown Ride Timer">
              <span className="text-sky-400 text-base sm:text-lg">⏱️</span>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] uppercase font-extrabold tracking-wider text-sky-300/80">
                  TIMER
                </span>
                <span
                  className={`text-sm sm:text-xl font-black tabular-nums ${
                    remainingSeconds <= 20 ? 'text-rose-400 animate-pulse' : 'text-white'
                  }`}
                >
                  {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                  {String(remainingSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {streak > 1 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black">
                🔥 {streak}x
              </span>
            )}

            <div className="hidden sm:block h-8 w-px bg-white/15" />
            <div className="hidden sm:block text-xs sm:text-sm font-bold text-slate-300">
              Gate <span className="text-white font-black">{currentGateIdx + 1}/{questions.length}</span>
            </div>
          </div>

          {/* Active Power-Up Status Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activePowerUps.magnet > 0 && (
              <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 border border-rose-300 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-rose-900/40 animate-pulse">
                <span>🧲</span>
                <span className="hidden sm:inline tracking-wider">MAGNET</span>
                <span className="bg-black/35 px-1.5 py-0.5 rounded-md font-mono text-[11px]">{activePowerUps.magnet}s</span>
              </div>
            )}
            {activePowerUps.boost > 0 && (
              <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 border border-yellow-200 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-orange-900/40 animate-bounce">
                <span>🚀</span>
                <span className="hidden sm:inline tracking-wider">BOOST</span>
                <span className="bg-slate-950/25 px-1.5 py-0.5 rounded-md font-mono text-[11px] text-white">{activePowerUps.boost}s</span>
              </div>
            )}
            {activePowerUps.slow > 0 && (
              <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 border border-cyan-300 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-cyan-900/40 animate-pulse">
                <span>⏳</span>
                <span className="hidden sm:inline tracking-wider">SLOW-MO</span>
                <span className="bg-black/35 px-1.5 py-0.5 rounded-md font-mono text-[11px]">{activePowerUps.slow}s</span>
              </div>
            )}
            {activePowerUps.double > 0 && (
              <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 border border-purple-300 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-purple-900/40 animate-pulse">
                <span>⚡</span>
                <span className="hidden sm:inline tracking-wider">2X COINS</span>
                <span className="bg-black/35 px-1.5 py-0.5 rounded-md font-mono text-[11px]">{activePowerUps.double}s</span>
              </div>
            )}
            {activePowerUps.shield && (
              <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-300 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/40">
                <span>🛡️</span>
                <span className="tracking-wider">SHIELD</span>
              </div>
            )}
          </div>
        </div>

        {/* Right HUD Controls: Tablet Tilt, Questions, Prominent In-Game Settings & Full Screen Buttons */}
        <div className="flex items-center gap-2 pointer-events-auto ml-auto">
          <button
            onClick={requestTabletTilt}
            className={`active:scale-95 backdrop-blur-md border text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 transition cursor-pointer ${
              tabletMode
                ? 'bg-indigo-600/90 hover:bg-indigo-500 border-indigo-300/50'
                : 'bg-slate-900/90 hover:bg-slate-800 border-white/20'
            }`}
            title="Auto-detect when tablet leans Left or Right"
          >
            <Smartphone size={15} />
            <span className="hidden lg:inline">{tiltStatus}</span>
          </button>

          <button
            onClick={onEditQuestions}
            className="bg-slate-900/90 hover:bg-slate-800 active:scale-95 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-bold px-3 py-2 rounded-2xl shadow-lg flex items-center gap-1.5 transition cursor-pointer"
            title="Edit Questions"
          >
            <Edit3 size={15} className="text-amber-400" />
            <span className="hidden md:inline">Questions</span>
          </button>

          {/* End Now Flag Button */}
          <button
            onClick={() => setShowEndNowConfirm(true)}
            className="bg-gradient-to-r from-emerald-600/90 to-teal-700/90 hover:from-emerald-500 hover:to-teal-600 active:scale-95 text-white border border-emerald-400/50 text-xs sm:text-sm font-black px-3.5 py-2 rounded-2xl shadow-[0_0_15px_rgba(16,185,129,0.35)] flex items-center gap-1.5 transition cursor-pointer"
            title="End Ride Now (Finish and view final score)"
          >
            <Flag size={15} className="text-emerald-300 fill-emerald-300/30" />
            <span>End Now</span>
          </button>

          {/* Prominent In-Game Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="bg-gradient-to-r from-amber-500/95 to-orange-500/95 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 border-2 border-amber-200/80 text-xs sm:text-sm font-black px-3.5 py-2 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.45)] flex items-center gap-1.5 transition cursor-pointer"
            title="Open In-Game Settings (Difficulty Slow to Fast, Voice On/Off, Text Size, Tablet Mode)"
          >
            <Settings size={17} className="text-slate-950" />
            <span>Settings</span>
          </button>

          {/* Prominent In-Game Full Screen Mode Button */}
          <FullscreenButton targetId="coaster-game-container" showLabel />
        </div>
      </header>

      {/* Floating Coin & Power-Up Popups */}
      <div className="absolute top-20 right-5 z-30 flex flex-col items-end gap-1.5 pointer-events-none">
        {floatingPopups.map((p) => (
          <div
            key={p.id}
            className="bg-slate-950/85 backdrop-blur-md border border-white/20 rounded-2xl px-3.5 py-1.5 shadow-xl animate-bounce flex flex-col items-end"
          >
            <span className={`font-black text-base sm:text-lg ${p.color}`}>{p.text}</span>
            {p.sub && <span className="text-[10px] font-bold text-white/85">{p.sub}</span>}
          </div>
        ))}
      </div>

      {/* 4 - 3 - 2 - 1 Countdown Overlay */}
      {countdownNum !== null && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none pb-20">
          <div className="px-4 py-1 rounded-full bg-slate-900/70 border border-white/20 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest mb-2">
            Pilot: {riderName} 🐹 · Collect 🪙 Coins &amp; Keep Your ❤️ Lives!
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-wider uppercase coaster-title-stroke text-center px-4">
            GET READY
          </h1>
          <div className="text-7xl sm:text-9xl font-black coaster-countdown-num mt-2 animate-bounce">
            {countdownNum}
          </div>
        </div>
      )}

      {/* Active Question Gate HUD Card (Strictly 2 Options: Left Track vs. Right Track) */}
      <div
        className={`absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 z-20 w-[96%] max-w-4xl lg:max-w-5xl pointer-events-none transition-all duration-300 ${
          activePrompt ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <div className="w-full bg-slate-950/90 h-3.5 rounded-t-2xl overflow-hidden border-x border-t border-white/25 p-0.5 flex items-center">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500 rounded-full transition-all duration-75"
            style={{ width: `${timerPct}%` }}
          />
        </div>

        <div className="bg-slate-900/92 backdrop-blur-xl border-x border-b border-white/25 rounded-b-[2rem] px-4 py-3.5 sm:px-8 sm:py-5 shadow-2xl text-center">
          {/* Top Header: Track Split Indicator & Timer */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/20 border border-amber-400/40 px-3.5 py-1 rounded-full shadow-sm">
              ⚡ Twin Track Split — Tap, Key, or Lean!
            </span>
            {gateSecondsLeft !== null && (
              <span
                className={`px-3 py-1 rounded-full text-xs sm:text-sm font-black tabular-nums border shadow-sm ${
                  gateSecondsLeft <= 2.0
                    ? 'bg-rose-500/30 border-rose-400 text-rose-300 animate-pulse'
                    : 'bg-sky-500/25 border-sky-400/50 text-sky-200'
                }`}
              >
                ⏱️ {gateSecondsLeft.toFixed(1)}s
              </span>
            )}
          </div>

          {/* Question Prompt: Text & Image (BIGGER and bolder) */}
          {(() => {
            const parsedPromptQ = parseOptionContent(activePrompt?.question || '');
            return (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 my-2 sm:my-3">
                {parsedPromptQ.imageUrl && (
                  <img
                    src={parsedPromptQ.imageUrl}
                    alt={parsedPromptQ.text || 'Question Media'}
                    className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-3xl bg-white/95 p-2 object-contain shrink-0 shadow-2xl border-3 border-amber-400"
                  />
                )}
                {parsedPromptQ.text && (
                  <h2
                    className={`font-black text-white tracking-wide drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] text-center ${
                      textSize === 'sm'
                        ? 'text-xl sm:text-3xl'
                        : textSize === 'md'
                        ? 'text-2xl sm:text-4xl md:text-5xl'
                        : textSize === 'xl'
                        ? 'text-4xl sm:text-5xl md:text-6xl leading-tight'
                        : 'text-3xl sm:text-4xl md:text-5xl'
                    }`}
                  >
                    {parsedPromptQ.text}
                  </h2>
                )}
              </div>
            );
          })()}

          {/* 2 Track Options (Optimized & Much Bigger when Pictures are Options) */}
          {(() => {
            const parsedL = parseOptionContent(activePrompt?.leftText || '');
            const parsedR = parseOptionContent(activePrompt?.rightText || '');
            const hasPictures = Boolean(parsedL.imageUrl || parsedR.imageUrl);

            return (
              <div className="grid grid-cols-2 gap-3 sm:gap-6 mt-3 sm:mt-4 pointer-events-auto items-stretch">
                {/* Left Track Option Button */}
                <button
                  onClick={() => actionsRef.current.selectSteer(-1)}
                  className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500/95 via-blue-600/95 to-blue-800/95 border-3 transition-all duration-200 cursor-pointer shadow-2xl flex flex-col justify-between ${
                    hasPictures ? 'p-3.5 sm:p-5 min-h-[160px] sm:min-h-[220px] md:min-h-[260px]' : 'p-4 sm:p-6 min-h-[90px] sm:min-h-[120px]'
                  } ${
                    steeringChoice === -1
                      ? 'border-white scale-[1.04] -translate-y-1.5 shadow-[0_0_35px_rgba(56,189,248,0.85)] ring-4 ring-sky-300/60'
                      : 'border-sky-300/60 hover:scale-[1.02] hover:border-sky-200'
                  }`}
                >
                  {/* Top Bar inside Left Option: Arrow, Track Label, and Locked Badge */}
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-9 h-9 sm:w-12 sm:h-12 rounded-2xl bg-black/45 border-2 border-white/30 flex items-center justify-center text-white text-lg sm:text-2xl font-black shrink-0 shadow-md">
                        ◀
                      </span>
                      <span className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-sky-100 drop-shadow">
                        Left Track
                      </span>
                    </div>
                    {steeringChoice === -1 && (
                      <span className="text-[10px] sm:text-xs font-black uppercase bg-white text-blue-950 px-2.5 py-1 rounded-full shadow-lg border border-sky-200 animate-pulse">
                        LOCKED 🔒
                      </span>
                    )}
                  </div>

                  {/* Center Body: Big Picture or Prominent Text */}
                  {hasPictures ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 my-auto w-full">
                      {parsedL.imageUrl && (
                        <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl sm:rounded-3xl bg-white p-2 sm:p-3 shadow-xl border-2 sm:border-3 border-white/80 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                          <img
                            src={parsedL.imageUrl}
                            alt={parsedL.text || 'Left option'}
                            className="w-full h-full object-contain filter drop-shadow-md"
                          />
                        </div>
                      )}
                      {parsedL.text && (
                        <div
                          className={`font-black text-white text-center sm:text-left drop-shadow-md break-words ${
                            textSize === 'sm'
                              ? 'text-base sm:text-xl'
                              : textSize === 'md'
                              ? 'text-lg sm:text-2xl md:text-3xl'
                              : textSize === 'xl'
                              ? 'text-2xl sm:text-3xl md:text-4xl'
                              : 'text-xl sm:text-2xl md:text-3xl'
                          }`}
                        >
                          {parsedL.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="my-auto w-full text-center">
                      <div
                        className={`font-black text-white drop-shadow-md ${
                          textSize === 'sm'
                            ? 'text-lg sm:text-2xl'
                            : textSize === 'md'
                            ? 'text-xl sm:text-3xl'
                            : textSize === 'xl'
                            ? 'text-2xl sm:text-4xl md:text-5xl'
                            : 'text-xl sm:text-3xl md:text-4xl'
                        }`}
                      >
                        {parsedL.text || 'Left Option'}
                      </div>
                    </div>
                  )}
                </button>

                {/* Right Track Option Button */}
                <button
                  onClick={() => actionsRef.current.selectSteer(1)}
                  className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500/95 via-red-600/95 to-red-800/95 border-3 transition-all duration-200 cursor-pointer shadow-2xl flex flex-col justify-between ${
                    hasPictures ? 'p-3.5 sm:p-5 min-h-[160px] sm:min-h-[220px] md:min-h-[260px]' : 'p-4 sm:p-6 min-h-[90px] sm:min-h-[120px]'
                  } ${
                    steeringChoice === 1
                      ? 'border-white scale-[1.04] -translate-y-1.5 shadow-[0_0_35px_rgba(244,63,94,0.85)] ring-4 ring-rose-300/60'
                      : 'border-rose-300/60 hover:scale-[1.02] hover:border-rose-200'
                  }`}
                >
                  {/* Top Bar inside Right Option: Track Label, Locked Badge, and Arrow */}
                  <div className="flex items-center justify-between w-full mb-2">
                    {steeringChoice === 1 ? (
                      <span className="text-[10px] sm:text-xs font-black uppercase bg-white text-rose-950 px-2.5 py-1 rounded-full shadow-lg border border-rose-200 animate-pulse">
                        LOCKED 🔒
                      </span>
                    ) : (
                      <div />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-rose-100 drop-shadow">
                        Right Track
                      </span>
                      <span className="w-9 h-9 sm:w-12 sm:h-12 rounded-2xl bg-black/45 border-2 border-white/30 flex items-center justify-center text-white text-lg sm:text-2xl font-black shrink-0 shadow-md">
                        ▶
                      </span>
                    </div>
                  </div>

                  {/* Center Body: Big Picture or Prominent Text */}
                  {hasPictures ? (
                    <div className="flex flex-col sm:flex-row-reverse items-center justify-center gap-3 sm:gap-4 my-auto w-full">
                      {parsedR.imageUrl && (
                        <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl sm:rounded-3xl bg-white p-2 sm:p-3 shadow-xl border-2 sm:border-3 border-white/80 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                          <img
                            src={parsedR.imageUrl}
                            alt={parsedR.text || 'Right option'}
                            className="w-full h-full object-contain filter drop-shadow-md"
                          />
                        </div>
                      )}
                      {parsedR.text && (
                        <div
                          className={`font-black text-white text-center sm:text-right drop-shadow-md break-words ${
                            textSize === 'sm'
                              ? 'text-base sm:text-xl'
                              : textSize === 'md'
                              ? 'text-lg sm:text-2xl md:text-3xl'
                              : textSize === 'xl'
                              ? 'text-2xl sm:text-3xl md:text-4xl'
                              : 'text-xl sm:text-2xl md:text-3xl'
                          }`}
                        >
                          {parsedR.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="my-auto w-full text-center">
                      <div
                        className={`font-black text-white drop-shadow-md ${
                          textSize === 'sm'
                            ? 'text-lg sm:text-2xl'
                            : textSize === 'md'
                            ? 'text-xl sm:text-3xl'
                            : textSize === 'xl'
                            ? 'text-2xl sm:text-4xl md:text-5xl'
                            : 'text-xl sm:text-3xl md:text-4xl'
                        }`}
                      >
                        {parsedR.text || 'Right Option'}
                      </div>
                    </div>
                  )}
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Low-Profile Coaster Bumper Bar at Bottom */}
      <div
        ref={bumperRef}
        className="absolute bottom-0 left-0 right-0 h-16 sm:h-20 z-10 pointer-events-none transition-transform duration-100 overflow-hidden"
        style={{
          background: 'linear-gradient(to bottom, rgba(24,24,27,0.86) 0%, rgba(9,9,11,0.98) 100%)',
          borderTop: '4px solid #dc2626',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.65)',
        }}
      >
        <div className="w-full h-1.5 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="mx-auto mt-2.5 w-44 sm:w-60 h-2.5 rounded-full bg-zinc-800 border border-zinc-600/50 shadow-inner" />
      </div>

      {/* Webcam Camera Feed Above the Hamster's Head (Replaces the removed L-R sign when Webcam Head-Tilt Steering is ON!) */}
      <div
        className={`absolute bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none transition-all duration-300 ${
          cameraLeanEnabled
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-75 pointer-events-none'
        }`}
      >
        <div
          className={`relative rounded-2xl overflow-hidden border-2 shadow-2xl bg-slate-950/90 ${
            steeringChoice === -1
              ? 'border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.8)]'
              : steeringChoice === 1
              ? 'border-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.8)]'
              : 'border-amber-400/90 shadow-[0_0_20px_rgba(251,191,36,0.45)]'
          }`}
        >
          <video
            ref={webcamVideoRef}
            className="w-36 h-26 sm:w-48 sm:h-34 object-cover scale-x-[-1] block"
            autoPlay
            playsInline
            muted
          />

          {/* Center Guide Line */}
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-white/30 -translate-x-1/2 pointer-events-none" />

          {/* Live Detected People Tracking Reticles */}
          {personMarkers.map((p) => (
            <div
              key={p.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 px-1 py-0.5 rounded-md text-[8px] font-black pointer-events-none border transition-all duration-75 flex items-center gap-0.5 shadow-md ${
                p.lean < -0.16
                  ? 'bg-sky-500/85 border-sky-300 text-white shadow-[0_0_8px_rgba(56,189,248,0.8)]'
                  : p.lean > 0.16
                  ? 'bg-rose-500/85 border-rose-300 text-white shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-black/70 border-white/40 text-amber-300'
              }`}
              style={{
                left: `${Math.max(10, Math.min(90, p.x * 100))}%`,
                top: `${Math.max(12, Math.min(78, p.y * 100))}%`,
              }}
            >
              <span>{p.lean < -0.16 ? '◀' : ''}</span>
              <span>P{p.id}</span>
              <span>{p.lean > 0.16 ? '▶' : ''}</span>
            </div>
          ))}

          {/* Top Status Banner (Group Consensus Banner) */}
          {groupLeanStatus && (
            <div className="absolute top-1 inset-x-1 text-center py-0.5 px-1 rounded-md bg-slate-950/85 backdrop-blur-sm border border-amber-400/40 text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-amber-300 truncate pointer-events-none">
              {groupLeanStatus}
            </div>
          )}

          {/* Bottom Bar: Steer Indicators & Quick Mode Toggle */}
          <div className="absolute bottom-1 inset-x-1 flex items-center justify-between px-1.5 py-0.5 rounded-lg bg-slate-950/85 backdrop-blur-sm text-[9px] font-black uppercase tracking-wider text-white">
            <span className={steeringChoice === -1 ? 'text-sky-300 font-extrabold' : 'text-white/50'}>◀ L</span>
            <button
              onClick={() => {
                const next = activeCameraMode === 'group' ? 'solo' : 'group';
                setActiveCameraMode(next);
                cameraModeRef.current = next;
                onChangeCameraMode?.(next);
              }}
              className="pointer-events-auto px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-amber-300 flex items-center gap-1 transition cursor-pointer"
              title="Click to switch between Group Mode (3+ people in line) and Solo Pilot"
            >
              {activeCameraMode === 'group' ? (
                <>
                  <Users size={11} className="text-amber-400" />
                  <span>GROUP ({detectedPeopleCount > 0 ? detectedPeopleCount : '3+'})</span>
                </>
              ) : (
                <>
                  <User size={11} className="text-sky-300" />
                  <span>SOLO</span>
                </>
              )}
            </button>
            <span className={steeringChoice === 1 ? 'text-rose-300 font-extrabold' : 'text-white/50'}>R ▶</span>
          </div>
        </div>
      </div>

      {/* Dashed Circular Touch Steering Wheels on Bottom Left & Right */}
      <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 z-20 flex items-center justify-between px-5 sm:px-14 md:px-24 pointer-events-none">
        <button
          onPointerDown={() => actionsRef.current.selectSteer(-1)}
          className={`coaster-touch-wheel pointer-events-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center text-white/95 active:scale-95 cursor-pointer group ${
            steeringChoice === -1 ? 'active-left' : ''
          }`}
        >
          <span className="text-2xl sm:text-3xl group-hover:text-sky-300 transition">◀</span>
          <span className="text-xs sm:text-sm font-black tracking-wider uppercase mt-1">
            LEAN LEFT
          </span>
        </button>

        <button
          onPointerDown={() => actionsRef.current.selectSteer(1)}
          className={`coaster-touch-wheel pointer-events-auto w-28 h-28 sm:w-36 sm:h-36 rounded-full flex flex-col items-center justify-center text-white/95 active:scale-95 cursor-pointer group ${
            steeringChoice === 1 ? 'active-right' : ''
          }`}
        >
          <span className="text-2xl sm:text-3xl group-hover:text-rose-300 transition">▶</span>
          <span className="text-xs sm:text-sm font-black tracking-wider uppercase mt-1">
            LEAN RIGHT
          </span>
        </button>
      </div>

      {/* Bottom Right Sound Mute Toggle */}
      <button
        onClick={() => {
          const next = !isMuted;
          setIsMuted(next);
          isMutedRef.current = next;
        }}
        className="absolute bottom-4 right-5 z-30 w-11 h-11 rounded-full bg-slate-950/85 hover:bg-slate-900 border border-white/20 text-white flex items-center justify-center shadow-xl transition active:scale-90 cursor-pointer"
        title="Toggle Coaster Sound & Ride Music"
      >
        {isMuted ? <VolumeX size={20} className="text-rose-400" /> : <Volume2 size={20} />}
      </button>

      {/* IN-GAME SETTINGS MODAL (Difficulty Slow to Fast, Voice On/Off, Text Size, Ride Timer, Webcam Camera, Tablet Mode) */}
      {showSettingsModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-amber-400/50 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-white/15">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-wide">In-Game Settings</h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Ride is paused while adjusting settings
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FullscreenButton targetId="coaster-game-container" showLabel />
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-5">
              {/* 1. Difficulty Level (Slow to Fast) */}
              <div className="bg-slate-800/75 border border-white/10 rounded-2xl p-4">
                <label className="text-xs font-black uppercase tracking-wider text-amber-300 block mb-2.5">
                  1. Difficulty Level (Slow to Fast)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: '🐢 Slow', val: 0.7, desc: 'Relaxed pace' },
                    { label: '🎢 Normal', val: 1.0, desc: 'Balanced speed' },
                    { label: '🚀 Fast', val: 1.45, desc: 'High-speed thrill!' },
                  ].map((d) => (
                    <button
                      key={d.label}
                      onClick={() => onChangeSpeedMultiplier(d.val)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        speedMultiplier === d.val
                          ? 'bg-amber-400 text-slate-950 border-white font-black shadow-lg scale-[1.02]'
                          : 'bg-slate-900/70 text-white border-white/10 hover:bg-slate-900'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-black">{d.label}</div>
                      <div
                        className={`text-[10px] mt-0.5 ${
                          speedMultiplier === d.val ? 'text-slate-800 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {d.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Voice Question Reader (Explicit Voice On / Voice Off) */}
              <div className="bg-slate-800/75 border border-white/10 rounded-2xl p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-sm font-black text-white">2. Voice Question Reader</div>
                    <div className="text-xs text-slate-400">Reads each question aloud at track splits</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onChangeVoiceEnabled(true)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border ${
                        voiceEnabled
                          ? 'bg-emerald-400 text-slate-950 border-white shadow-md scale-105'
                          : 'bg-slate-900/70 text-white/75 border-white/15 hover:bg-slate-900'
                      }`}
                    >
                      🔊 Voice On
                    </button>
                    <button
                      onClick={() => onChangeVoiceEnabled(false)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer border ${
                        !voiceEnabled
                          ? 'bg-rose-500 text-white border-white shadow-md scale-105'
                          : 'bg-slate-900/70 text-white/75 border-white/15 hover:bg-slate-900'
                      }`}
                    >
                      🔇 Voice Off
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div>
                    <div className="text-sm font-black text-white">Theme Park Ride Music</div>
                    <div className="text-xs text-slate-400">Upbeat coaster background music during ride</div>
                  </div>
                  <button
                    onClick={() => setMusicEnabled(!musicEnabled)}
                    className={`w-13 h-7 rounded-full transition-colors relative cursor-pointer ${
                      musicEnabled ? 'bg-amber-400' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
                        musicEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* 3. Question & Answer Text Size */}
              <div className="bg-slate-800/75 border border-white/10 rounded-2xl p-4">
                <label className="text-xs font-black uppercase tracking-wider text-sky-300 block mb-2.5">
                  3. Question &amp; Answer Text Size
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'sm', label: 'Small' },
                    { id: 'md', label: 'Medium' },
                    { id: 'lg', label: 'Large' },
                    { id: 'xl', label: 'Extra Large' },
                  ].map((sz) => (
                    <button
                      key={sz.id}
                      onClick={() => setTextSize(sz.id as any)}
                      className={`py-2.5 px-2 rounded-xl border text-xs sm:text-sm font-black transition cursor-pointer ${
                        textSize === sz.id
                          ? 'bg-sky-400 text-slate-950 border-white shadow-lg scale-[1.03]'
                          : 'bg-slate-900/70 text-white border-white/10 hover:bg-slate-900'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Ride Timer Slider (1 to 10 Minutes) & Webcam Head-Tilt Camera Toggle */}
              <div className="bg-slate-800/75 border border-white/10 rounded-2xl p-4 space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                      4. Ride Timer (1 to 10 Minutes)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs">
                      {timerMinutes} {timerMinutes === 1 ? 'Min' : 'Mins'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={timerMinutes}
                    onChange={(e) => onChangeTimerMinutes(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <div>
                    <div className="text-sm font-black text-white">Webcam Head-Tilt Steering</div>
                    <div className="text-xs text-slate-400">
                      Shows camera above hamster&apos;s head &amp; steers when you lean Left/Right
                    </div>
                  </div>
                  <button
                    onClick={() => onChangeCameraLeanEnabled(!cameraLeanEnabled)}
                    className={`w-13 h-7 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      cameraLeanEnabled ? 'bg-sky-400' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
                        cameraLeanEnabled ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {cameraLeanEnabled && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-amber-300">Tracking Mode:</div>
                      <div className="text-[11px] text-slate-400">Detect 1 rider or group in line</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          setActiveCameraMode('group');
                          cameraModeRef.current = 'group';
                          onChangeCameraMode?.('group');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                          activeCameraMode === 'group'
                            ? 'bg-amber-400 text-slate-950 shadow-md scale-105'
                            : 'bg-slate-700/80 text-white hover:bg-slate-700'
                        }`}
                      >
                        <Users size={12} />
                        <span>Group Line (3+)</span>
                      </button>
                      <button
                        onClick={() => {
                          setActiveCameraMode('solo');
                          cameraModeRef.current = 'solo';
                          onChangeCameraMode?.('solo');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                          activeCameraMode === 'solo'
                            ? 'bg-sky-400 text-slate-950 shadow-md scale-105'
                            : 'bg-slate-700/80 text-white hover:bg-slate-700'
                        }`}
                      >
                        <User size={12} />
                        <span>Solo</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 5. Tablet Mode (Auto-Detect Lean Left & Lean Right) */}
              <div className="bg-indigo-950/60 border border-indigo-400/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone size={18} className="text-indigo-300" />
                    <div>
                      <div className="text-sm font-black text-white">
                        Tablet Mode (Auto-Detect Lean Left / Right)
                      </div>
                      <div className="text-xs text-indigo-200/80">
                        Automatically steers when tablet is leaned Left or Right
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !tabletMode;
                      setTabletMode(next);
                      tabletModeRef.current = next;
                      if (next) requestTabletTilt();
                    }}
                    className={`w-13 h-7 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      tabletMode ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all ${
                        tabletMode ? 'left-7' : 'left-1'
                      }`}
                    />
                  </button>
                </div>

                {tabletMode && (
                  <div className="pt-2 border-t border-indigo-400/20 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-200 font-bold">Tilt Sensitivity:</span>
                      <div className="flex gap-1.5">
                        {[
                          { label: 'Gentle', val: 0.75 },
                          { label: 'Normal', val: 1.0 },
                          { label: 'High', val: 1.4 },
                        ].map((s) => (
                          <button
                            key={s.label}
                            onClick={() => setTiltSensitivity(s.val)}
                            className={`px-2.5 py-1 rounded-lg font-black cursor-pointer ${
                              tiltSensitivity === s.val
                                ? 'bg-indigo-400 text-slate-950'
                                : 'bg-slate-900/70 text-indigo-200'
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-slate-950/70 rounded-xl px-3 py-2 text-xs">
                      <span className="text-slate-300 font-semibold">
                        Live Sensor:{' '}
                        <strong className="text-white">
                          {tiltAngleDeg < -4
                            ? `◀ Leaning Left (${tiltAngleDeg}°)`
                            : tiltAngleDeg > 4
                            ? `Leaning Right (+${tiltAngleDeg}°) ▶`
                            : `Centered (${tiltAngleDeg}°)`}
                        </strong>
                      </span>
                      <button
                        onClick={requestTabletTilt}
                        className="px-2.5 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold cursor-pointer"
                      >
                        Calibrate / Activate
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full mt-6 py-3.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-lg rounded-2xl shadow-xl transition active:scale-95 cursor-pointer"
            >
              Resume Coaster Ride 🎢
            </button>
          </div>
        </div>
      )}

      {/* WRONG TRACK / REVIVE / GAME OVER MODAL */}
      {crashModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
          <div className="relative bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-rose-500/80 rounded-[2rem] max-w-lg w-full overflow-hidden shadow-[0_0_60px_rgba(244,63,94,0.4)] my-auto">
            {/* Caution Stripe Top Hazard Banner */}
            <div
              className="h-3 w-full"
              style={{
                background:
                  'repeating-linear-gradient(135deg, #facc15 0px, #facc15 14px, #0f172a 14px, #0f172a 28px)',
              }}
            />

            {/* Top Bar inside Modal: Gate Badge + Quick Settings & Full Screen */}
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs font-black uppercase tracking-wider">
                {crashModal.isGameOver
                  ? `💔 GAME OVER · Gate ${crashModal.gateNumber}/${crashModal.totalGates}`
                  : `⚠️ Coaster Derailed · Gate ${crashModal.gateNumber}/${crashModal.totalGates}`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1.5 cursor-pointer transition"
                  title="Open In-Game Settings"
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </button>
                <FullscreenButton targetId="coaster-game-container" />
              </div>
            </div>

            <div className="p-5 sm:p-7 pt-3 text-center">
              {/* Custom Illustrated 3D-Style Coaster Broken Rail & Hamster Vector Scene */}
              <div className="relative w-36 h-28 mx-auto mb-3 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-to-tr from-rose-600/35 via-orange-500/25 to-amber-400/20 rounded-full blur-xl animate-pulse" />
                <svg viewBox="0 0 200 140" className="w-full h-full relative z-10 overflow-visible drop-shadow-xl">
                  <path
                    d="M 10 115 Q 55 82 95 74"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 14 123 Q 58 90 98 82"
                    fill="none"
                    stroke="#991b1b"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <path d="M 95 74 L 112 62 L 106 78 L 120 71" fill="none" stroke="#facc15" strokeWidth="3.5" />
                  <line x1="28" y1="98" x2="36" y2="116" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
                  <line x1="55" y1="82" x2="63" y2="100" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
                  <line x1="82" y1="72" x2="90" y2="90" stroke="#78350f" strokeWidth="5" strokeLinecap="round" />
                  <g transform="translate(122, 48) rotate(28)">
                    <circle cx="0" cy="-14" r="14" fill="#f59e0b" />
                    <circle cx="-10" cy="-24" r="5" fill="#f59e0b" />
                    <circle cx="10" cy="-24" r="5" fill="#f59e0b" />
                    <circle cx="-6" cy="-12" r="4.5" fill="#ffffff" />
                    <circle cx="6" cy="-12" r="4.5" fill="#ffffff" />
                    <circle cx="-6" cy="-12" r="2" fill="#0f172a" />
                    <circle cx="6" cy="-12" r="2" fill="#0f172a" />
                    <ellipse cx="0" cy="-6" rx="4" ry="3" fill="#fda4af" />
                    <rect x="-24" y="-4" width="48" height="22" rx="9" fill="#dc2626" stroke="#fbbf24" strokeWidth="3" />
                    <circle cx="-14" cy="20" r="5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                    <circle cx="14" cy="20" r="5" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                  </g>
                  <polygon
                    points="105,42 110,52 121,50 113,59 118,69 107,64 98,71 100,60 91,54 102,51"
                    fill="#facc15"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-wide coaster-title-stroke">
                {crashModal.title}
              </h2>
              <p className="text-rose-200/90 text-xs sm:text-sm font-semibold mt-1.5">
                {crashModal.reason}
              </p>

              {/* Hearts Lives Remaining Banner */}
              <div className="mt-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl bg-slate-950/90 border border-rose-500/40">
                <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                  Lives Remaining:
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: initialLives }).map((_, i) => (
                    <span key={i} className="text-lg">
                      {i < crashModal.livesRemaining ? '❤️' : '🖤'}
                    </span>
                  ))}
                </div>
              </div>

              {/* Question & Side-by-Side Track Answer Breakdown */}
              <div className="mt-4 bg-slate-950/80 border border-white/15 rounded-2xl p-4 text-left space-y-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                    Question Prompt
                  </div>
                  <div className="text-white font-bold text-sm sm:text-base mt-0.5 leading-snug">
                    &ldquo;{crashModal.question}&rdquo;
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
                  <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-2.5 flex items-start gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-rose-500/30 border border-rose-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ❌
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-rose-300">
                        {crashModal.wasTimeout ? 'Missed Split' : 'Trap Track Chosen'}
                      </div>
                      <div className="text-white font-black text-sm truncate">
                        {crashModal.wrongAnswer}
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-950/60 border border-emerald-400/60 rounded-xl p-2.5 flex items-start gap-2.5 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                    <span className="w-6 h-6 rounded-lg bg-emerald-500/30 border border-emerald-400 flex items-center justify-center text-xs shrink-0 mt-0.5">
                      ✅
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                        Correct Safe Track
                      </div>
                      <div className="text-white font-black text-sm truncate">
                        {crashModal.correctAnswer}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Ride Stats Strip (Coins & Time Remaining — No LIVE PTS) */}
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <div className="bg-slate-800/70 border border-yellow-400/30 rounded-xl py-2.5 px-3">
                  <div className="text-[10px] font-extrabold uppercase text-yellow-300">Coins Collected</div>
                  <div className="text-lg sm:text-xl font-black text-yellow-300">🪙 {coinsCount}</div>
                </div>
                <div className="bg-slate-800/70 border border-sky-400/30 rounded-xl py-2.5 px-3">
                  <div className="text-[10px] font-extrabold uppercase text-sky-300">Time Remaining</div>
                  <div className="text-lg sm:text-xl font-black text-white">
                    ⏱️ {String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:
                    {String(remainingSeconds % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Revive if lives > 0, or Game Over Full Restart */}
              <div className="flex flex-col sm:flex-row gap-2.5 mt-5">
                {!crashModal.isGameOver && crashModal.livesRemaining > 0 ? (
                  <>
                    <button
                      onClick={() => actionsRef.current.retryCheckpoint()}
                      className="flex-1 bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500 hover:from-emerald-300 hover:to-orange-400 text-slate-950 font-black text-base sm:text-lg py-3.5 px-5 rounded-2xl shadow-[0_8px_25px_rgba(245,158,11,0.45)] transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>
                        ❤️ Revive at Gate #{crashModal.gateNumber} ({crashModal.livesRemaining}{' '}
                        {crashModal.livesRemaining === 1 ? 'Life' : 'Lives'} Left)
                      </span>
                    </button>
                    <button
                      onClick={() => actionsRef.current.restartFullRide()}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-3.5 px-5 rounded-2xl border border-white/15 transition active:scale-95 cursor-pointer"
                    >
                      Full Restart
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => actionsRef.current.restartFullRide()}
                      className="flex-1 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-400 hover:from-rose-400 hover:to-amber-300 text-slate-950 font-black text-base sm:text-lg py-3.5 px-5 rounded-2xl shadow-[0_8px_25px_rgba(244,63,94,0.45)] transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <span>🔄 Game Over — Play Again!</span>
                    </button>
                    <button
                      onClick={onExitToSetup}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-3.5 px-5 rounded-2xl border border-white/15 transition active:scale-95 cursor-pointer"
                    >
                      Back to Setup
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End Now Confirmation Modal */}
      {showEndNowConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border-2 border-emerald-400/80 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-3 text-3xl">
              🏁
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">End Coaster Ride?</h3>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 mb-5">
              Finish the ride now and view your current coins, gate progress, and stats!
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setShowEndNowConfirm(false);
                  actionsRef.current.endRideNow();
                }}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Flag size={16} />
                <span>Finish Ride 🏁</span>
              </button>
              <button
                onClick={() => setShowEndNowConfirm(false)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm rounded-xl border border-white/15 transition cursor-pointer"
              >
                Keep Riding
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Victory / Ride Summary Modal */}
      {victoryModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-amber-400/75 rounded-3xl max-w-md w-full p-6 sm:p-8 text-center shadow-2xl my-auto">
            <div className="w-20 h-20 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mx-auto mb-4 text-4xl">
              {victoryModal.endedEarly ? '🏁🐹' : '🏆🐹'}
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-wide">
              {victoryModal.endedEarly ? 'RIDE SUMMARY!' : 'RIDE CONQUERED!'}
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mt-2">
              {victoryModal.endedEarly ? (
                <>
                  Great ride, <span className="text-amber-300 font-bold">{riderName}</span>! Here is your final coaster scorecard:
                </>
              ) : (
                <>
                  Awesome reflexes, <span className="text-amber-300 font-bold">{riderName}</span>! You navigated every coaster junction!
                </>
              )}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
              <div className="bg-slate-800/90 border border-yellow-400/40 rounded-2xl p-2.5">
                <div className="text-[10px] uppercase font-bold tracking-widest text-yellow-300">
                  Total Coins
                </div>
                <div className="text-xl sm:text-2xl font-black text-yellow-300 mt-1">
                  🪙 {victoryModal.coins}
                </div>
              </div>
              <div className="bg-slate-800/90 border border-emerald-400/40 rounded-2xl p-2.5">
                <div className="text-[10px] uppercase font-bold tracking-widest text-emerald-300">
                  Gates Cleared
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  🏁 {victoryModal.gatesCleared ?? questions.length}/{victoryModal.totalGates ?? questions.length}
                </div>
              </div>
              <div className="bg-slate-800/90 border border-rose-400/40 rounded-2xl p-2.5">
                <div className="text-[10px] uppercase font-bold tracking-widest text-rose-300">
                  Lives Left
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  ❤️ {victoryModal.livesRemaining}/{initialLives}
                </div>
              </div>
              <div className="bg-slate-800/90 border border-sky-400/30 rounded-2xl p-2.5">
                <div className="text-[10px] uppercase font-bold tracking-widest text-sky-400">
                  Ride Time
                </div>
                <div className="text-xl sm:text-2xl font-black text-white mt-1">
                  {victoryModal.timeSec}s
                </div>
              </div>
            </div>
            {victoryModal.maxStreak > 1 && (
              <div className="mt-3 py-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 text-xs font-black inline-flex items-center gap-1.5">
                <span>🔥 Best Combo Streak: {victoryModal.maxStreak} in a row!</span>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              <button
                onClick={() => actionsRef.current.restartFullRide()}
                className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-lg py-3.5 px-6 rounded-2xl shadow-xl transition active:scale-95 cursor-pointer"
              >
                Ride Again! 🎢
              </button>
              <button
                onClick={onExitToSetup}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm py-3.5 px-5 rounded-2xl border border-white/15 transition active:scale-95 cursor-pointer"
              >
                Back to Setup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/********************************************************************
 * COASTER QUIZ EDITOR (Matches BubblePop GAME SETUP, Strictly 2 Options)
 ********************************************************************/
function CoasterQuizEditor({
  quiz,
  onSave,
  onPlayNow,
  onCancel,
  folders,
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onPlayNow: (q: Quiz) => void;
  onCancel: () => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || '');
  const [topic, setTopic] = useState(quiz.topic || '');
  const [classLevel, setClassLevel] = useState(quiz.classLevel || '');
  const [questions, setQuestions] = useState<Question[]>(() => normalizeToTwoOptions(quiz.questions));
  const [errorMsg, setErrorMsg] = useState('');
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string; optIndex: number | 'question'; query?: string } | null>(null);
  const [contentMode, setContentMode] = useState<AnswerContentMode>('both');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState<boolean>(true);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(
      `Create 20 multiple-choice questions on the topic of ${topic || 'English Grammar'}. Each question must have exactly 2 options (A and B) and include the correct answer.`
    );
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parseTwoOptionQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg('Please enter or paste at least one question.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const newItems: Question[] = parsed.map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || '',
      options: [item.options?.[0] || '', item.options?.[1] || ''],
      answerIndex: item.answerIndex === 1 ? 1 : 0,
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions((prev) => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }

    setToastMsg(`✨ Added ${parsed.length} 2-option coaster questions!`);
    setTimeout(() => setToastMsg(''), 3500);
    setShowBulkPasteModal(false);
    setBulkText('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parseTwoOptionQuiz(pastedText);
    if (
      parsedItems.length === 1 &&
      parsedItems[0].text === pastedText &&
      parsedItems[0].options?.every((o) => !o)
    ) {
      return;
    }

    if (parsedItems.length > 0) {
      e.preventDefault();
      const newItems: Question[] = parsedItems.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || '',
        options: [item.options?.[0] || '', item.options?.[1] || ''],
        answerIndex: item.answerIndex === 1 ? 1 : 0,
      }));

      setQuestions((prev) => {
        const updated = [...prev];
        const current = updated[index];
        if (current && !current.text.trim()) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated;
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} 2-option questions!`);
      setTimeout(() => setToastMsg(''), 3500);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now() + Math.random(), text: '', options: ['', ''], answerIndex: 0 }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    if (optIndex > 1) return; // Strictly 2 options
    setQuestions(
      questions.map((q) => {
        if (q.id === qId) {
          const newOptions = [q.options[0] || '', q.options[1] || ''];
          newOptions[optIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const removeQuestion = (id: number | string) => {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== id) : prev));
  };

  const duplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const qToCopy = prev[index];
      next.splice(index + 1, 0, {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [qToCopy.options[0] || '', qToCopy.options[1] || ''],
      });
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        addQuestion();
        setTimeout(() => {
          document.getElementById(`coaster-question-input-${index + 1}`)?.focus();
        }, 50);
      } else {
        document.getElementById(`coaster-question-input-${index + 1}`)?.focus();
      }
    }
  };

  const handleSave = () => {
    const validQuestions = questions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      setErrorMsg('Please add at least one question before saving.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const handleQuickPlay = () => {
    const validQuestions = questions.filter((q) => q.text.trim());
    const finalQuestions = validQuestions.length > 0 ? validQuestions : SAMPLE_COASTER_QUESTIONS;
    onPlayNow({
      ...quiz,
      title: topic || quiz.title || 'Roller Coaster Quiz',
      folderId,
      topic: topic || 'Roller Coaster Quiz',
      classLevel,
      questions: normalizeToTwoOptions(finalQuestions),
    });
  };

  const confirmSave = (isPublic: boolean) => {
    const validQuestions = questions.filter((q) => q.text.trim());
    onSave({
      ...quiz,
      title: topic || 'Roller Coaster Quiz',
      folderId,
      topic,
      classLevel,
      questions: normalizeToTwoOptions(validQuestions),
      isPublic,
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-4xl bg-white/80 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8 mt-8">
          {/* Header matching BubblePop */}
          <div className="bg-white dark:bg-slate-800/80 p-6 sm:p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🎢</span>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                    GAME SETUP
                  </h2>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Roller Coaster Quiz · 2 Options per Track Split (Left vs. Right)
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5 items-center">
                <button
                  onClick={onCancel}
                  className="px-4 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickPlay}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black transition-all shadow-lg shadow-amber-500/25 cursor-pointer text-sm"
                >
                  <Play size={17} className="fill-current" /> Play Ride
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer text-sm"
                >
                  <Save size={18} /> Save Quiz
                </button>
              </div>
            </div>

            <SetupCurriculumHeader
              topic={topic}
              setTopic={setTopic}
              classLevel={classLevel}
              setClassLevel={setClassLevel}
              folderId={folderId}
              setFolderId={setFolderId}
              folders={folders}
              contentMode={contentMode}
              setContentMode={setContentMode}
              autoPhotosEnabled={autoPhotosEnabled}
              setAutoPhotosEnabled={setAutoPhotosEnabled}
              maxOptionsPerQuestion={2}
              onApplyModeToAll={async (mode) => {
                const updated = await convertQuestionsContentMode(questions, mode);
                setQuestions(updated);
                setToastMsg(
                  mode === 'words'
                    ? '🔤 Switched all options to Words Only!'
                    : mode === 'photos_gifs'
                    ? '🖼️ Switched all options to Cartoon PNGs / GIFs!'
                    : '✨ Switched all options to Words + Cartoon PNGs!'
                );
                setTimeout(() => setToastMsg(''), 3000);
              }}
              onLoadStarterQuestions={(newQs, topicName) => {
                setQuestions(newQs);
                setToastMsg(`🎢 Loaded ${newQs.length} 2-choice "${topicName}" questions with Cartoon PNGs!`);
                setTimeout(() => setToastMsg(''), 3500);
              }}
            />
          </div>

          {errorMsg && (
            <div className="bg-red-500/20 text-red-500 dark:text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
              {errorMsg}
            </div>
          )}

          {toastMsg && (
            <div className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-cyan-500/30 flex items-center justify-center gap-2 shadow-sm">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
            {/* Bulk Paste Action Bar matching BubblePop */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                  Questions ({questions.length}) · Strictly 2 Options
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuestions(SAMPLE_COASTER_QUESTIONS);
                    setTopic('Theme Park Challenge');
                    setToastMsg('🎢 Loaded 8 sample Roller Coaster questions!');
                    setTimeout(() => setToastMsg(''), 3000);
                  }}
                  className="text-xs font-bold px-3 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition cursor-pointer"
                >
                  Load Sample Deck
                </button>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2.5 cursor-pointer"
                >
                  <ClipboardList size={20} />
                  <span>Bulk Paste</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer border border-purple-400/30"
                >
                  <div className="w-5 h-5 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                    <Play size={11} className="ml-0.5 fill-current" />
                  </div>
                  <span>How to Bulk Paste</span>
                </button>
              </div>
            </div>

            {/* Questions List — Strictly 2 Options per Question */}
            {questions.map((q, index) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group"
              >
                <button
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => removeQuestion(q.id)}
                  title="Delete Question"
                  className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex gap-4 mb-4 items-start">
                  <div className="w-8 h-8 mt-2 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                    {index + 1}
                  </div>
                  <SmartQuestionInput
                    id={`coaster-question-input-${index}`}
                    value={q.text}
                    imageUrl={q.image}
                    onChange={(newVal) => updateQuestion(q.id, 'text', newVal)}
                    onChangeImage={(newImg) => updateQuestion(q.id, 'image', newImg || undefined)}
                    onOpenMediaPicker={(initialQ) =>
                      setActiveGiphyInput({ qId: q.id, optIndex: 'question', query: initialQ })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={(e) => handlePaste(e, index)}
                    placeholder="Type your question here (or click Add Media for picture/GIF question)..."
                    autoPhotosEnabled={autoPhotosEnabled}
                  />
                </div>

                {/* Strictly 2 Options Grid (Option 1 & Option 2) */}
                <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[0, 1].map((optIndex) => {
                    const opt = q.options[optIndex] || '';
                    const isCorrect = q.answerIndex === optIndex;
                    return (
                      <div key={optIndex} className="flex items-start gap-2">
                        <input
                          type="radio"
                          name={`coaster-answer-${q.id}`}
                          checked={isCorrect}
                          onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                          className="w-4 h-4 mt-3 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
                          title="Mark as Correct Track Answer"
                        />
                        <SmartOptionInput
                          value={opt}
                          onChange={(val) => updateOption(q.id, optIndex, val)}
                          onOpenMediaPicker={(initialQ) =>
                            setActiveGiphyInput({ qId: q.id, optIndex, query: initialQ })
                          }
                          placeholder={
                            isCorrect
                              ? `Option ${optIndex + 1} (✓ Correct Track, e.g. apple)`
                              : `Option ${optIndex + 1} (✗ Trap Track, e.g. banana)`
                          }
                          isCorrect={isCorrect}
                          contentMode={contentMode}
                          autoPhotosEnabled={autoPhotosEnabled}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="ml-12 mt-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">
                  Select the radio circle next to the correct answer. Left/Right tracks are automatically randomized during the ride!
                </div>
              </div>
            ))}

            <button
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={20} /> Add Another Question
            </button>
          </div>
        </div>
      </div>

      <MediaPickerModal
        isOpen={activeGiphyInput !== null}
        initialQuery={activeGiphyInput?.query || ''}
        onClose={() => setActiveGiphyInput(null)}
        onSelect={(url) => {
          if (activeGiphyInput) {
            const targetQ = questions.find((item) => item.id === activeGiphyInput.qId);
            if (activeGiphyInput.optIndex === 'question') {
              const rawExistingQ = targetQ?.text || '';
              const parsedExistingQ = parseOptionContent(rawExistingQ);
              const questionTextToKeep = parsedExistingQ.text;
              const finalQuestionVal = questionTextToKeep
                ? formatOptionContent(questionTextToKeep, url, 'both')
                : url;
              setQuestions((prev) =>
                prev.map((qItem) =>
                  qItem.id === activeGiphyInput.qId
                    ? { ...qItem, text: finalQuestionVal, image: url }
                    : qItem
                )
              );
            } else {
              const optIdx = activeGiphyInput.optIndex;
              const rawExisting = targetQ?.options[optIdx] || '';
              const parsedExisting = parseOptionContent(rawExisting);
              const wordToKeep = parsedExisting.text || activeGiphyInput.query || '';
              const finalVal =
                contentMode === 'photos_gifs' || !wordToKeep
                  ? url
                  : formatOptionContent(wordToKeep, url, 'both');
              updateOption(activeGiphyInput.qId, optIdx, finalVal);
            }
            setActiveGiphyInput(null);
          }
        }}
      />

      {/* Publish Confirmation Modal */}
      {showPublishModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
              <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">
                Would you like to publish this Roller Coaster Quiz to the Community so other teachers can use it?
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => confirmSave(true)}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] transition-transform cursor-pointer text-lg"
                >
                  Yes, Publish (Public)
                </button>
                <button
                  onClick={() => confirmSave(false)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
                >
                  No, Keep Private
                </button>
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="w-full py-2 mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Bulk Paste Modal */}
      {showBulkPasteModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste (2-Option Coaster Mode)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paste numbered questions with 2 options (or 4 options — we automatically keep the correct answer + 1 wrong distractor!).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkPasteModal(false);
                    setBulkText('');
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-black text-slate-800 dark:text-white block mb-0.5">
                    Generate 2-Choice Questions with AI
                  </span>
                  Copy our ready-made prompt for ChatGPT/Claude to create 2-option questions instantly.
                </div>
                <button
                  type="button"
                  onClick={handleCopyAiPrompt}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedPromptInModal ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedPromptInModal ? 'Copied!' : 'Copy AI Prompt'}</span>
                </button>
              </div>

              <textarea
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={
                  'Example:\n1. She ___ to school every day.\na) goes\nb) go\nAnswer: A\n\n2. 7 × 8 = ?\na) 56\nb) 54\nAnswer: A'
                }
                className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
              />

              {bulkText.trim() && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Info size={16} className="text-cyan-500" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found{' '}
                    <span className="font-bold text-slate-800 dark:text-white">
                      {parseTwoOptionQuiz(bulkText).length}
                    </span>{' '}
                    questions (automatically formatted to 2 options).
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => handleApplyBulkPaste('replace')}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  Replace All
                </button>
                <button
                  onClick={() => handleApplyBulkPaste('append')}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>+ Add Questions</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <BulkPasteVideoModal
        isOpen={showVideoGuide}
        onClose={() => setShowVideoGuide(false)}
        onOpenBulkPasteWithSample={(sample) => {
          setBulkText(sample);
          setShowBulkPasteModal(true);
        }}
      />
    </div>
  );
}

// Helper to parse pasted text and strictly normalize each question to 2 options
function parseTwoOptionQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rawItems: { text: string; options: string[]; answerIndex: number }[] = [];
  let currentQ: { text: string; options: string[]; answerIndex: number } | null = null;

  const isQuestionStart = (line: string) => /^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);
  const getQuestionText = (line: string) => {
    const m = line.match(/^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
    return m ? m[1].trim() : line;
  };
  const isAnswerLine = (line: string) =>
    /^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i.test(line);
  const extractAnswerIndex = (line: string, opts: string[]) => {
    const m = line.match(/^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i);
    if (!m) return 0;
    const raw = m[1].trim();
    const letter = raw.match(/[\(\[]?([A-Da-d])[\)\]\.\:]?/);
    if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
    const num = raw.match(/^[1-4]$/);
    if (num) return parseInt(num[0], 10) - 1;
    const found = opts.findIndex((o) => o && o.toLowerCase() === raw.toLowerCase());
    return found >= 0 ? found : 0;
  };
  const extractOption = (line: string) => {
    const mLetter = line.match(/^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]|[\(\[]([A-Da-d])[\)\]])\s*(.*)/);
    if (mLetter) {
      const char = (mLetter[1] || mLetter[2]).toUpperCase();
      return { index: char.charCodeAt(0) - 65, text: mLetter[3].trim() };
    }
    const mNum = line.match(/^(?:[\(\[]([1-4])[\)\]]|([1-4])\))\s*(.*)/);
    if (mNum) {
      const num = parseInt(mNum[1] || mNum[2], 10) - 1;
      return { index: num, text: mNum[3].trim() };
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isAnswerLine(line)) {
      if (currentQ) {
        currentQ.answerIndex = Math.max(0, extractAnswerIndex(line, currentQ.options));
      }
      continue;
    }
    const opt = extractOption(line);
    if (opt) {
      if (!currentQ) {
        currentQ = { text: 'Question', options: [], answerIndex: 0 };
        rawItems.push(currentQ);
      }
      currentQ.options[opt.index] = opt.text;
      continue;
    }
    if (isQuestionStart(line)) {
      currentQ = { text: getQuestionText(line), options: [], answerIndex: 0 };
      rawItems.push(currentQ);
      continue;
    }
    if (currentQ && currentQ.options.length === 0) {
      currentQ.text += ' ' + line;
    } else {
      currentQ = { text: line, options: [], answerIndex: 0 };
      rawItems.push(currentQ);
    }
  }

  return normalizeToTwoOptions(rawItems);
}

export default RollerCoasterQuiz;
