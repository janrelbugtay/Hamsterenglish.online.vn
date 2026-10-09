import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { GameModeModal } from "../components/GameModeModal";
import { 
  ArrowLeft, Edit3, Trash2, Plus, Sparkles, Save, X, Play, 
  Image as ImageIcon, ClipboardList, Info, Copy, 
  Volume2, VolumeX, Eye, Check, RefreshCw, Trophy, Gift, ArrowRightLeft, Star, AlertTriangle, CloudRain, Skull, Percent, Bomb, Shuffle,
  Users, User, Minus
} from "lucide-react";
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

type GameScreen = 'editor' | 'setup' | 'game' | 'study';

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  optionImages?: (string | null)[];
}

interface Quiz {
  id: number | string;
  title?: string;
  subject?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

interface Outcome {
  id: string;
  text: string;
  color: string;
  requiresTarget?: string;
  action: (t: Team[], idx: number, target?: number) => Team[];
}

interface Team {
  id: number;
  name: string;
  score: number;
  color?: string;
  icon?: string;
  bg?: string;
  border?: string;
  ring?: string;
}

const DEFAULT_TEAM_CONFIGS = [
  { id: 0, defaultName: "Team 1", color: "blue", bg: "bg-blue-500", border: "border-blue-400", light: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", ring: "ring-blue-400", icon: "🦁" },
  { id: 1, defaultName: "Team 2", color: "red", bg: "bg-red-500", border: "border-red-400", light: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300", ring: "ring-red-400", icon: "🐉" },
  { id: 2, defaultName: "Team 3", color: "emerald", bg: "bg-emerald-500", border: "border-emerald-400", light: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", ring: "ring-emerald-400", icon: "🦅" },
  { id: 3, defaultName: "Team 4", color: "amber", bg: "bg-amber-500", border: "border-amber-400", light: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", ring: "ring-amber-400", icon: "⚡" },
  { id: 4, defaultName: "Team 5", color: "purple", bg: "bg-purple-500", border: "border-purple-400", light: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300", ring: "ring-purple-400", icon: "🔮" },
  { id: 5, defaultName: "Team 6", color: "pink", bg: "bg-pink-500", border: "border-pink-400", light: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300", ring: "ring-pink-400", icon: "🦄" },
  { id: 6, defaultName: "Team 7", color: "teal", bg: "bg-teal-500", border: "border-teal-400", light: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", ring: "ring-teal-400", icon: "🌊" },
  { id: 7, defaultName: "Team 8", color: "orange", bg: "bg-orange-500", border: "border-orange-400", light: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", ring: "ring-orange-400", icon: "🔥" },
];

const BLANK_MYSTERY_QUESTION: Question = {
  id: 1,
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0,
  optionImages: [null, null, null, null],
};

export function MysteryBox({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );

  // When mystery box is clicked, the GAME SETUP ('editor') screen appears.
  // Only when an existing game with questions is launched to play (!editMode && hasLoadedQuestions), start in 'setup'.
  const [screen, setScreen] = useState<GameScreen>(
    initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor'
  );
  const [showModeModal, setShowModeModal] = useState(false);

  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(d => f.push({ id: d.id, ...d.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);

  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame) {
      const raw = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_MYSTERY_QUESTION]);

      // Capped to at most 30 questions
      const sanitized = raw.slice(0, 30).map((q: any, i: number) => ({
        id: q.id || (i + 1),
        text: q.text || q.question || "",
        options: q.options && q.options.length >= 2 ? q.options : ["", "", "", ""],
        answerIndex: q.answerIndex !== undefined ? q.answerIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
        optionImages: q.optionImages || [null, null, null, null],
      }));

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: sanitized.length > 0 ? sanitized : [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
    };
  });

  useEffect(() => {
    if (initialGame) {
      const raw = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_MYSTERY_QUESTION]);

      const sanitized = raw.slice(0, 30).map((q: any, i: number) => ({
        id: q.id || (i + 1),
        text: q.text || q.question || "",
        options: q.options && q.options.length >= 2 ? q.options : ["", "", "", ""],
        answerIndex: q.answerIndex !== undefined ? q.answerIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
        optionImages: q.optionImages || [null, null, null, null],
      }));

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: sanitized.length > 0 ? sanitized : [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    } else {
      setActiveQuiz({
        id: Date.now(),
        title: "",
        folderId: "",
        topic: "",
        classLevel: "",
        questions: [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      });
      setScreen('editor');
    }
  }, [initialGame]);

  const saveQuiz = async (quiz: Quiz) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    onViewChange("games");

    try {
      // Limit strictly to 30 questions
      const sanitizedQuestions = quiz.questions.slice(0, 30);

      const gameToSave = JSON.parse(JSON.stringify({
        name: quiz.topic || quiz.title || "Mystery Box",
        className: quiz.classLevel || "",
        topic: quiz.topic || "",
        folderId: quiz.folderId || "",
        gameType: "mystery-box",
        theme: selectedTheme,
        difficulty: difficulty,
        setupTeamCount: numPlayers,
        customQuestions: sanitizedQuestions,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        isPublic: quiz.isPublic ?? false,
      }));

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };

  // --- GAME SETUP & PLAY STATE ---
  const [numPlayers, setNumPlayers] = useState(() => initialGame?.setupTeamCount || 2);
  const [playerNames, setPlayerNames] = useState<string[]>([
    "Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"
  ]);
  const [difficulty, setDifficulty] = useState<'normal' | 'medium' | 'difficult'>('normal');
  const [selectedTheme, setSelectedTheme] = useState('theme-royal');
  const [isMuted, setIsMuted] = useState(false);

  // In-Game state
  const [teams, setTeams] = useState<Team[]>([
    { id: 0, name: "Team 1", score: 0 }
  ]);
  const [currentTeamIdx, setCurrentTeamIdx] = useState(0);
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [selectedBoxAnimation, setSelectedBoxAnimation] = useState<number | null>(null);

  // Active question modal
  const [activeBoxNum, setActiveBoxNum] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [modalStep, setModalStep] = useState<'question' | 'correct_transition' | 'incorrect_transition' | 'decision' | 'give_away_selection' | 'target_selection' | 'reveal'>('question');
  const [currentOutcome, setCurrentOutcome] = useState<any>(null);
  const [targetTeamIdx, setTargetTeamIdx] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<'win' | 'lose' | null>(null);

  // Study Mode state (Interactive Full-Screen)
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [studyHistory, setStudyHistory] = useState<Record<number, { selected: number; isCorrect: boolean }>>({});

  // Audio synthesizer
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSound = (type: string) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.05);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'hover') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, now);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (type === 'box_open') {
        // Magical upward arpeggio + whoosh
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.06);
          gain.gain.setValueAtTime(0.1, now + i * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.06);
          osc.stop(now + i * 0.06 + 0.25);
        });
      } else if (type === 'correct') {
        // Bright dual bell chime
        [523.25, 783.99].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.1);
          gain.gain.setValueAtTime(0.15, now + i * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.1);
          osc.stop(now + i * 0.1 + 0.4);
        });
      } else if (type === 'incorrect') {
        // Low descending retro buzzer
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.35);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'suspense') {
        // Dramatic rising tension sweep
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.75);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.75);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.75);
      } else if (type === 'win') {
        // Triumphant 4-note brassy fanfare
        [440, 554.37, 659.25, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          gain.gain.setValueAtTime(0.15, now + idx * 0.1);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.5);
        });
      } else if (type === 'lose') {
        // Descending minor slide with low bass
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.55);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'bomb') {
        // Deep sub-bass explosion impact with noise
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.6);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);

        // Filtered noise burst
        try {
          const bufferSize = ctx.sampleRate * 0.4;
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800, now);
          filter.frequency.exponentialRampToValueAtTime(100, now + 0.4);
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.18, now);
          noiseGain.gain.linearRampToValueAtTime(0.001, now + 0.4);
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(now);
          noise.stop(now + 0.4);
        } catch (err) {
          // fallback
        }
      } else if (type === 'steal_swap') {
        // Sci-fi warp whoosh
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.2);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.45);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch (e) {
      // Audio fallback
    }
  };

  // Start Playing
  const handleStartGame = () => {
    playSound('click');
    const configuredTeams: Team[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const cfg = DEFAULT_TEAM_CONFIGS[i % DEFAULT_TEAM_CONFIGS.length];
      const rawName = playerNames[i]?.trim();
      const fallbackName = numPlayers === 1 ? "Player 1" : cfg.defaultName;
      configuredTeams.push({
        id: i,
        name: rawName || fallbackName,
        score: 0,
        color: cfg.color,
        icon: cfg.icon,
        bg: cfg.bg,
        border: cfg.border,
        ring: cfg.ring
      });
    }
    setTeams(configuredTeams);
    setCurrentTeamIdx(0);
    setOpenedBoxes([]);
    setActiveBoxNum(null);
    setCelebration(null);
    setSelectedBoxAnimation(null);
    setScreen('game');
  };

  // Interactive Study Mode Handlers
  const handleOpenStudy = () => {
    playSound('click');
    setStudyIndex(0);
    setStudySelectedOption(null);
    setStudyHistory({});
    setScreen('study');
  };

  const handleStudyOptionClick = (optionIdx: number) => {
    const currentQ = activeQuiz.questions[studyIndex];
    if (!currentQ || studySelectedOption !== null) return;
    const isCorrect = optionIdx === currentQ.answerIndex;
    setStudySelectedOption(optionIdx);
    playSound(isCorrect ? 'correct' : 'incorrect');
    setStudyHistory(prev => ({
      ...prev,
      [studyIndex]: { selected: optionIdx, isCorrect }
    }));
  };

  const handleStudyNext = () => {
    playSound('click');
    if (studyIndex < activeQuiz.questions.length - 1) {
      const nextIdx = studyIndex + 1;
      setStudyIndex(nextIdx);
      setStudySelectedOption(studyHistory[nextIdx]?.selected ?? null);
    } else {
      setScreen('setup');
    }
  };

  const handleStudyPrev = () => {
    playSound('click');
    if (studyIndex > 0) {
      const prevIdx = studyIndex - 1;
      setStudyIndex(prevIdx);
      setStudySelectedOption(studyHistory[prevIdx]?.selected ?? null);
    }
  };

  const handleStudyRetry = () => {
    playSound('click');
    setStudySelectedOption(null);
    setStudyHistory(prev => {
      const copy = { ...prev };
      delete copy[studyIndex];
      return copy;
    });
  };

  const studyTotalAnswered = Object.keys(studyHistory).length;
  const studyCorrectCount = Object.values(studyHistory).filter(h => h.isCorrect).length;
  const studyAccuracy = studyTotalAnswered > 0 ? Math.round((studyCorrectCount / studyTotalAnswered) * 100) : 0;

  // Box Click Handler
  const handleBoxClick = (num: number) => {
    if (openedBoxes.includes(num)) return;
    if (selectedBoxAnimation !== null) return;

    playSound('box_open');
    setSelectedBoxAnimation(num);

    setTimeout(() => {
      playSound('suspense');
      setActiveBoxNum(num);
      setIsAnswerRevealed(false);
      setSelectedOptionIndex(null);
      setCurrentOutcome(null);
      setModalStep('question');
      setTargetTeamIdx(null);
      setSelectedBoxAnimation(null);
    }, 750);
  };

  const handleOptionSelect = (idx: number) => {
    if (!isAnswerRevealed) {
      playSound('click');
      setSelectedOptionIndex(idx);
    }
  };

  const handleRevealAnswer = () => {
    playSound('suspense');
    setIsAnswerRevealed(true);
  };

  const handleIncorrect = () => {
    playSound('incorrect');
    setModalStep('incorrect_transition');
    setTimeout(() => {
      if (activeBoxNum !== null && !openedBoxes.includes(activeBoxNum)) {
        setOpenedBoxes(prev => [...prev, activeBoxNum]);
      }
      setActiveBoxNum(null);
      if (teams.length > 1) {
        setCurrentTeamIdx((currentTeamIdx + 1) % teams.length);
      }
    }, 1300);
  };

  const handleCorrect = () => {
    playSound('correct');
    setModalStep('correct_transition');
    setTimeout(() => {
      if (teams.length > 1) {
        setModalStep('decision');
      } else {
        handleExecuteDecision(0);
      }
    }, 1300);
  };

  const getOutcomesList = (): Outcome[] => {
    const normal: Outcome[] = [
      { id: "add100", text: "+100 points", color: "bg-teal-500", action: (t: Team[], idx: number) => { t[idx].score += 100; return t; } },
      { id: "add200", text: "+200 points", color: "bg-green-500", action: (t: Team[], idx: number) => { t[idx].score += 200; return t; } },
      { id: "add300", text: "+300 points", color: "bg-emerald-500", action: (t: Team[], idx: number) => { t[idx].score += 300; return t; } },
      { id: "sub50", text: "-50 points", color: "bg-red-400", action: (t: Team[], idx: number) => { t[idx].score -= 50; return t; } },
      { id: "sub100", text: "-100 points", color: "bg-red-500", action: (t: Team[], idx: number) => { t[idx].score -= 100; return t; } },
      { id: "add50", text: "+50 points", color: "bg-cyan-500", action: (t: Team[], idx: number) => { t[idx].score += 50; return t; } },
    ];
    const medium: Outcome[] = [
      ...normal,
      { id: "add500", text: "+500 points", color: "bg-green-600", action: (t: Team[], idx: number) => { t[idx].score += 500; return t; } },
      { id: "sub200", text: "-200 points", color: "bg-rose-600", action: (t: Team[], idx: number) => { t[idx].score -= 200; return t; } },
      { id: "swap_team", text: "Swap Points", color: "bg-purple-500", requiresTarget: "swap", action: (t: Team[], idx: number, target?: number) => {
        if (target !== undefined) {
          const temp = t[idx].score;
          t[idx].score = t[target].score;
          t[target].score = temp;
        }
        return t;
      }},
      { id: "steal_100", text: "Steal 100", color: "bg-indigo-500", requiresTarget: "steal", action: (t: Team[], idx: number, target?: number) => {
        if (target !== undefined) {
          if (t[target].score >= 100) {
            t[target].score -= 100;
            t[idx].score += 100;
          } else {
            t[idx].score += Math.max(0, t[target].score);
            t[target].score = 0;
          }
        }
        return t;
      }},
    ];
    const difficult: Outcome[] = [
      ...medium,
      { id: "sub500", text: "-500 points", color: "bg-red-700", action: (t: Team[], idx: number) => { t[idx].score -= 500; return t; } },
      { id: "minus_all_team", text: "Bomb All Teams -100", color: "bg-slate-800", action: (t: Team[]) => { t.forEach(item => item.score -= 100); return t; } },
      { id: "minus_10_percent", text: "-10% Points", color: "bg-orange-500", action: (t: Team[], idx: number) => { t[idx].score -= Math.floor(Math.max(0, t[idx].score) * 0.10); return t; } },
    ];

    if (difficulty === 'normal') return normal;
    if (difficulty === 'medium') return medium;
    return difficult;
  };

  const handleExecuteDecision = (targetIdx: number) => {
    setTargetTeamIdx(targetIdx);
    const outcomes = getOutcomesList();
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    setCurrentOutcome(outcome);

    const isPositive = !outcome.id.startsWith("sub") && !outcome.id.startsWith("minus");
    if (outcome.id.includes("bomb") || outcome.id.startsWith("sub500")) {
      playSound('bomb');
    } else if (outcome.id.startsWith("swap") || outcome.id.startsWith("steal")) {
      playSound('steal_swap');
    } else {
      playSound(isPositive ? 'win' : 'lose');
    }
    setCelebration(isPositive ? 'win' : 'lose');
    setTimeout(() => setCelebration(null), 3000);

    if (outcome.requiresTarget && teams.length > 1) {
      setModalStep('target_selection');
    } else {
      setTeams(prev => {
        const updated = [...prev];
        return outcome.action(updated, targetIdx);
      });
      if (activeBoxNum !== null && !openedBoxes.includes(activeBoxNum)) {
        setOpenedBoxes(prev => [...prev, activeBoxNum]);
      }
      setModalStep('reveal');
    }
  };

  const handleTargetSelection = (targetIdx: number) => {
    if (currentOutcome && targetTeamIdx !== null) {
      setTeams(prev => {
        const updated = [...prev];
        return currentOutcome.action(updated, targetTeamIdx, targetIdx);
      });
    }
    if (activeBoxNum !== null && !openedBoxes.includes(activeBoxNum)) {
      setOpenedBoxes(prev => [...prev, activeBoxNum]);
    }
    setModalStep('reveal');
  };

  const handleCloseReveal = () => {
    setActiveBoxNum(null);
    if (teams.length > 1) {
      setCurrentTeamIdx((currentTeamIdx + 1) % teams.length);
    }
  };

  const isGameOver = openedBoxes.length >= activeQuiz.questions.length && activeBoxNum === null && screen === 'game';

  // --- THEME ATTRIBUTES ---
  const getThemeSetupBg = () => {
    if (selectedTheme === 'theme-ocean') return 'from-sky-600/90 to-cyan-600/90 dark:from-sky-800/90 dark:to-cyan-900/90';
    if (selectedTheme === 'theme-space') return 'from-slate-900/90 to-indigo-950/90';
    if (selectedTheme === 'theme-jungle') return 'from-green-600/90 to-emerald-400/90 dark:from-green-900/90 dark:to-emerald-800/90';
    if (selectedTheme === 'theme-sunset') return 'from-orange-400/90 to-yellow-300/90 dark:from-orange-800/90 dark:to-yellow-700/90';
    if (selectedTheme === 'theme-royal') return 'from-purple-900/90 to-indigo-950/90';
    return 'from-sky-400/90 to-blue-200/90 dark:from-sky-900/90 dark:to-blue-950/90';
  };

  const getThemeGameBg = () => {
    if (selectedTheme === 'theme-ocean') return 'bg-gradient-to-b from-sky-900 via-cyan-950 to-slate-950';
    if (selectedTheme === 'theme-space') return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black';
    if (selectedTheme === 'theme-jungle') return 'bg-gradient-to-br from-green-950 via-emerald-900 to-green-950';
    if (selectedTheme === 'theme-sunset') return 'bg-gradient-to-b from-amber-950 via-orange-950 to-slate-950';
    if (selectedTheme === 'theme-royal') return 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950';
    return 'bg-gradient-to-b from-sky-900 via-blue-950 to-slate-950';
  };

  const getThemeBoxClass = () => {
    if (selectedTheme === 'theme-ocean') return 'bg-gradient-to-br from-cyan-500 to-blue-600 border-cyan-200';
    if (selectedTheme === 'theme-space') return 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-300';
    if (selectedTheme === 'theme-jungle') return 'bg-gradient-to-br from-emerald-500 to-green-600 border-green-300';
    if (selectedTheme === 'theme-sunset') return 'bg-gradient-to-br from-amber-500 to-orange-600 border-yellow-200';
    if (selectedTheme === 'theme-royal') return 'bg-gradient-to-br from-purple-500 via-indigo-500 to-pink-600 border-amber-300';
    return 'bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 border-amber-200';
  };

  return (
    <div id="game-container" className="w-full h-full min-h-screen relative overflow-hidden select-none">
      {/* 1. QUIZ EDITOR SCREEN (GAME SETUP, CAPPED AT 30 QUESTIONS) */}
      {screen === 'editor' && (
        <QuizEditor
          quiz={activeQuiz}
          onSave={saveQuiz}
          onCancel={() => onViewChange('games')}
          folders={folders}
        />
      )}

      {/* 2. SETUP SCREEN (EXACT BUBBLE POP SETUP SCREEN DESIGN) */}
      {screen === 'setup' && (
        <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-6 md:p-8 overflow-y-auto backdrop-blur-sm transition-colors duration-1000 bg-gradient-to-b ${getThemeSetupBg()}`}>
          {/* Immersive Background Elements from Bubble Pop */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
            <div className="absolute top-10 left-10 w-32 h-32 bg-white/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-20 w-48 h-48 bg-blue-300/30 rounded-full blur-3xl"></div>
            {/* Clouds */}
            <div className="absolute top-20 left-[10%] opacity-80 animate-float" style={{ animationDelay: '0s' }}>
              <div className="w-24 h-8 bg-white rounded-full absolute top-4 left-4"></div>
              <div className="w-16 h-16 bg-white rounded-full absolute top-0 left-8"></div>
              <div className="w-12 h-12 bg-white rounded-full absolute top-2 left-2"></div>
            </div>
            <div className="absolute top-40 right-[15%] opacity-60 animate-float" style={{ animationDelay: '2s' }}>
              <div className="w-32 h-10 bg-white rounded-full absolute top-6 left-6"></div>
              <div className="w-20 h-20 bg-white rounded-full absolute top-0 left-10"></div>
            </div>
            {/* Floating Bubbles */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div 
                key={i} 
                className="absolute rounded-full border border-white/40 bg-gradient-to-tr from-white/10 to-white/30 backdrop-blur-[2px] shadow-[inset_0_0_10px_rgba(255,255,255,0.5)] animate-float-up"
                style={{
                  width: `${Math.random() * 40 + 20}px`,
                  height: `${Math.random() * 40 + 20}px`,
                  left: `${Math.random() * 100}%`,
                  bottom: `-${Math.random() * 20 + 10}%`,
                  animationDuration: `${Math.random() * 10 + 10}s`,
                  animationDelay: `${Math.random() * 5}s`
                }}
              >
                <div className="absolute top-[15%] left-[20%] w-1/4 h-1/4 bg-white/60 rounded-full blur-[1px]"></div>
              </div>
            ))}
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-7xl my-auto py-6">
            <h2 className="text-6xl sm:text-7xl font-black mb-12 text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-100 drop-shadow-[0_4px_4px_rgba(0,0,0,0.1)] text-center tracking-tight" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.5)' }}>
              Mystery Box
            </h2>

            <div className="flex flex-col xl:flex-row gap-6 w-full justify-center items-stretch relative z-10">
              {/* Left / Main Card: Players & Settings */}
              <div className="flex-1 w-full max-w-2xl bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-[2rem] border border-white/20 p-6 sm:p-8 shadow-2xl flex flex-col items-center">
                {/* Solo vs Teams Mode Toggle */}
                <div className="flex gap-4 mb-6 w-full justify-center">
                  <button
                    onClick={() => {
                      playSound('click');
                      setNumPlayers(1);
                    }}
                    className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border border-white/20 transition-all duration-300 cursor-pointer ${numPlayers === 1 ? 'bg-blue-500/40 border-blue-400 scale-[1.02] shadow-[0_0_25px_rgba(59,130,246,0.4)]' : 'bg-black/20 hover:bg-white/10'}`}
                  >
                    <User className="w-7 h-7 text-white" />
                    <span className="text-white font-black text-xl">Solo (1 Player)</span>
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      setNumPlayers(prev => prev === 1 ? 2 : prev);
                    }}
                    className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl border border-white/20 transition-all duration-300 cursor-pointer ${numPlayers > 1 ? 'bg-gradient-to-r from-red-500/40 to-purple-500/40 border-amber-400 scale-[1.02] shadow-[0_0_25px_rgba(239,68,68,0.4)]' : 'bg-black/20 hover:bg-white/10'}`}
                  >
                    <Users className="w-7 h-7 text-white" />
                    <span className="text-white font-black text-xl">Teams ({Math.max(2, numPlayers)})</span>
                  </button>
                </div>

                {/* Team Count Selector & Presets (when Teams selected) */}
                {numPlayers > 1 && (
                  <div className="w-full mb-6 bg-black/20 p-4 rounded-2xl border border-white/20 flex flex-col gap-3">
                    <div className="flex justify-between items-center text-white">
                      <span className="font-extrabold text-sm uppercase tracking-wider text-amber-300">Teams Count:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            playSound('click');
                            setNumPlayers(Math.max(2, numPlayers - 1));
                          }}
                          disabled={numPlayers <= 2}
                          className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white font-bold flex items-center justify-center transition-all cursor-pointer"
                          title="Decrease teams"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-black text-xl text-white px-2">{numPlayers} Teams</span>
                        <button
                          onClick={() => {
                            playSound('click');
                            setNumPlayers(Math.min(8, numPlayers + 1));
                          }}
                          disabled={numPlayers >= 8}
                          className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 disabled:opacity-30 text-white font-bold flex items-center justify-center transition-all cursor-pointer"
                          title="Increase teams"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                    {/* Quick Count Presets 2 to 8 */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {[2, 3, 4, 5, 6, 7, 8].map(count => (
                        <button
                          key={count}
                          onClick={() => {
                            playSound('click');
                            setNumPlayers(count);
                          }}
                          className={`py-2 rounded-xl font-black text-sm transition-all cursor-pointer ${numPlayers === count ? 'bg-amber-400 text-slate-900 shadow-md scale-105' : 'bg-white/15 text-white hover:bg-white/25'}`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Editable Team Names List */}
                <div className="w-full flex flex-col gap-3 max-h-56 overflow-y-auto pr-1 mb-6 custom-scrollbar">
                  {Array.from({ length: numPlayers }).map((_, i) => {
                    const cfg = DEFAULT_TEAM_CONFIGS[i % DEFAULT_TEAM_CONFIGS.length];
                    return (
                      <div key={i} className="flex gap-3 items-center bg-black/20 p-2.5 rounded-2xl border border-white/15">
                        <div className={`w-11 h-11 rounded-xl ${cfg.bg} text-white flex items-center justify-center font-black text-lg shadow-md shrink-0`}>
                          {cfg.icon || (i + 1)}
                        </div>
                        <input 
                          type="text" 
                          value={playerNames[i] ?? ""} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setPlayerNames(prev => {
                              const updated = [...prev];
                              updated[i] = val;
                              return updated;
                            });
                          }} 
                          className="flex-1 bg-transparent text-white font-bold placeholder-white/50 border-none outline-none text-base px-2" 
                          placeholder={numPlayers === 1 ? "Player 1 Name" : `Team ${i + 1} Name`} 
                        />
                        {numPlayers > 2 && (
                          <button
                            onClick={() => {
                              playSound('click');
                              setPlayerNames(prev => prev.filter((_, idx) => idx !== i));
                              setNumPlayers(prev => Math.max(2, prev - 1));
                            }}
                            className="p-2 text-white/50 hover:text-red-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                            title="Remove team"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {numPlayers < 8 && (
                  <button
                    onClick={() => {
                      playSound('click');
                      setNumPlayers(prev => Math.min(8, prev + 1));
                    }}
                    className="mb-6 flex items-center justify-center gap-2 py-2 px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm border border-white/20 transition-all cursor-pointer hover:scale-105 active:scale-95"
                  >
                    <Plus size={16} /> Add Team ({numPlayers + 1})
                  </button>
                )}

                <div className="w-full max-w-md flex flex-col gap-4 mb-8">
                  <div className="bg-black/20 p-4 rounded-2xl border border-white/20 flex flex-col gap-4">
                    <div className="flex justify-between items-center text-white">
                      <span className="font-bold">Difficulty</span>
                      <div className="flex gap-2">
                        <button onClick={() => setDifficulty('normal')} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors cursor-pointer ${difficulty === 'normal' ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Normal</button>
                        <button onClick={() => setDifficulty('medium')} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors cursor-pointer ${difficulty === 'medium' ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Medium</button>
                        <button onClick={() => setDifficulty('difficult')} className={`px-3 py-1 rounded-full text-sm font-bold transition-colors cursor-pointer ${difficulty === 'difficult' ? 'bg-blue-500' : 'bg-white/20 hover:bg-white/30'}`}>Difficult</button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-white">
                      <span className="font-bold">Sound Effects</span>
                      <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${!isMuted ? 'bg-blue-500' : 'bg-white/30'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${!isMuted ? 'left-7' : 'left-1'}`}></div>
                      </button>
                    </div>
                    <div className="flex justify-between items-center text-white text-sm border-t border-white/10 pt-3">
                      <span className="font-bold">Boxes (1 to 30)</span>
                      <span className="bg-white/20 px-3 py-1 rounded-full font-bold">{activeQuiz.questions.length} Questions</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleStartGame}
                  className="px-12 py-5 bg-gradient-to-r from-blue-500 via-sky-400 to-amber-400 text-white font-black text-2xl rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] hover:scale-105 active:scale-95 transition-all w-full max-w-md cursor-pointer tracking-wide"
                >
                  START GAME
                </button>
              </div>

              {/* Right Column Card: Theme & Study Mode */}
              <div className="w-full xl:w-96 flex flex-col gap-6">
                <div className="w-full rounded-[2rem] bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-2xl p-6 flex flex-col justify-center flex-1">
                  <h3 className="text-2xl font-black text-white mb-4 text-center drop-shadow-md">Choose Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'theme-sky', name: 'Sky', icon: '☁️' },
                      { id: 'theme-ocean', name: 'Ocean', icon: '🌊' },
                      { id: 'theme-space', name: 'Space', icon: '🚀' },
                      { id: 'theme-jungle', name: 'Jungle', icon: '🌴' },
                      { id: 'theme-sunset', name: 'Sunset', icon: '🌅' },
                      { id: 'theme-royal', name: 'Royal', icon: '👑' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTheme(t.id)}
                        className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm font-bold text-sm cursor-pointer ${selectedTheme === t.id ? 'bg-white text-blue-600 border-2 border-blue-400 scale-105' : 'bg-white/20 text-white border-2 border-transparent hover:bg-white/30'}`}
                      >
                        <span className="text-2xl">{t.icon}</span>
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleOpenStudy}
                  className="group relative w-full h-48 rounded-[2rem] bg-white/10 dark:bg-black/20 backdrop-blur-md border border-white/20 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-1 cursor-pointer flex items-center justify-center p-6 gap-6"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 dark:to-black/20 pointer-events-none"></div>
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-400/30 rounded-full blur-2xl group-hover:bg-purple-400/50 transition-colors"></div>
                  <div className="relative z-10 text-7xl transform group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500 drop-shadow-xl">
                    📖
                  </div>
                  <div className="flex flex-col items-start relative z-10 text-left">
                    <h3 className="text-3xl font-black text-white mb-1 drop-shadow-md">Study Mode</h3>
                    <p className="text-purple-100 font-medium text-sm">Interactive Quiz & Review!</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 relative z-10 mt-8">
              <button 
                onClick={() => onViewChange('games')} 
                className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <ArrowLeft size={24} /> Back to Games
              </button>
              <button 
                onClick={() => setScreen('editor')} 
                className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Edit3 size={24} /> Edit Questions (1-30)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. FULL SCREEN INTERACTIVE STUDY MODE */}
      {screen === 'study' && (
        <div 
          id="study-fullscreen-container"
          className={`fixed inset-0 z-50 flex flex-col ${getThemeGameBg()} text-white select-none overflow-hidden`}
        >
          {/* Animated Ambient Background Elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>

          {/* Top Progress Bar */}
          <div className="w-full h-2 bg-white/10 relative z-20">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${((studyIndex + 1) / Math.max(1, activeQuiz.questions.length)) * 100}%` }}
            />
          </div>

          {/* Full Screen Header */}
          <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/10 flex justify-between items-center z-20 relative shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setScreen('setup')} 
                className="flex items-center gap-2 px-5 py-2.5 bg-white/15 hover:bg-white/25 rounded-2xl font-bold text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Setup
              </button>
              <div className="bg-amber-400/20 border border-amber-400/40 px-4 py-2 rounded-2xl text-amber-300 font-extrabold text-sm hidden sm:flex items-center gap-2">
                📖 Study Mode
              </div>
            </div>

            {/* Question Counter Pill */}
            <div className="bg-white/15 px-6 py-2 rounded-full border border-white/20 font-black text-lg text-white shadow-md">
              Question <span className="text-amber-300 font-black text-xl">{studyIndex + 1}</span> of {activeQuiz.questions.length}
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-3">
              {/* Accuracy / Score */}
              <div className="hidden md:flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 px-4 py-2 rounded-2xl text-emerald-300 font-bold text-sm">
                Score: <span className="font-black text-white">{studyCorrectCount}/{studyTotalAnswered}</span> ({studyAccuracy}%)
              </div>
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-2xl transition-colors cursor-pointer"
                title="Toggle Sound"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <FullscreenButton targetId="study-fullscreen-container" />
            </div>
          </header>

          {/* Main Question & Interactive Options Section (Full Viewport) */}
          <main className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 max-w-5xl mx-auto w-full z-10 overflow-y-auto custom-scrollbar">
            {activeQuiz.questions.length > 0 ? (
              <div className="w-full flex flex-col items-center my-auto">
                {/* Question Badge */}
                <div className="mb-4">
                  <span className="px-5 py-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-slate-900 font-black text-sm uppercase tracking-widest shadow-lg">
                    Question {studyIndex + 1}
                  </span>
                </div>

                {/* Big Question Text */}
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white text-center leading-tight mb-10 max-w-4xl drop-shadow-md break-words">
                  {activeQuiz.questions[studyIndex]?.text}
                </h2>

                {/* Options Grid (A, B, C, D) Clickable & Answer Checked */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-4xl mb-8">
                  {activeQuiz.questions[studyIndex]?.options.map((opt, i) => {
                    if (!opt || opt.trim() === '') return null;
                    const letter = ['A', 'B', 'C', 'D'][i] || (i + 1);
                    const isSelected = studySelectedOption === i;
                    const isCorrectAnswer = i === activeQuiz.questions[studyIndex].answerIndex;
                    const hasAnswered = studySelectedOption !== null;

                    let btnStyle = "bg-white/10 hover:bg-white/20 border-white/20 text-white hover:scale-[1.02] shadow-lg hover:border-amber-400";

                    if (hasAnswered) {
                      if (isCorrectAnswer) {
                        btnStyle = "bg-emerald-500 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.6)] scale-[1.03] z-10";
                      } else if (isSelected && !isCorrectAnswer) {
                        btnStyle = "bg-rose-500 border-rose-300 text-white shadow-[0_0_25px_rgba(244,63,94,0.5)] scale-[0.98]";
                      } else {
                        btnStyle = "bg-white/5 border-white/10 text-white/40 opacity-40 cursor-not-allowed";
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleStudyOptionClick(i)}
                        disabled={hasAnswered}
                        className={`p-6 sm:p-7 rounded-[2rem] text-xl sm:text-2xl font-bold border-4 transition-all duration-300 flex items-center justify-between text-left gap-4 cursor-pointer active:scale-95 ${btnStyle}`}
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${hasAnswered && isCorrectAnswer ? 'bg-white text-emerald-600' : hasAnswered && isSelected && !isCorrectAnswer ? 'bg-white text-rose-600' : 'bg-white/20 text-white'}`}>
                            {letter}
                          </span>
                          <span className="flex-1 break-words">{opt}</span>
                        </div>
                        {hasAnswered && isCorrectAnswer && (
                          <div className="flex items-center gap-1.5 bg-white text-emerald-600 px-3 py-1.5 rounded-full font-black text-sm shrink-0 animate-bounce">
                            <Check size={18} strokeWidth={3} /> CORRECT
                          </div>
                        )}
                        {hasAnswered && isSelected && !isCorrectAnswer && (
                          <div className="flex items-center gap-1.5 bg-white text-rose-600 px-3 py-1.5 rounded-full font-black text-sm shrink-0">
                            <X size={18} strokeWidth={3} /> INCORRECT
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Feedback & Action Bar */}
                {studySelectedOption !== null && (
                  <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 animate-pop-in">
                    <div className="flex items-center gap-3">
                      {studySelectedOption === activeQuiz.questions[studyIndex]?.answerIndex ? (
                        <div className="flex items-center gap-2 text-emerald-300 font-black text-lg">
                          <span className="text-2xl">🎉</span> Correct! Great job!
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-rose-300 font-bold text-base sm:text-lg">
                          <span className="text-2xl">💡</span> Correct Answer: <span className="font-black text-emerald-300 underline">{activeQuiz.questions[studyIndex]?.options[activeQuiz.questions[studyIndex]?.answerIndex]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {studySelectedOption !== activeQuiz.questions[studyIndex]?.answerIndex && (
                        <button
                          onClick={handleStudyRetry}
                          className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center gap-2"
                        >
                          <RefreshCw size={18} /> Retry
                        </button>
                      )}
                      <button
                        onClick={handleStudyNext}
                        className="px-8 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 rounded-xl font-black text-lg shadow-lg transition-all cursor-pointer flex items-center gap-2 hover:scale-105 active:scale-95"
                      >
                        {studyIndex < activeQuiz.questions.length - 1 ? 'Next Question →' : 'Finish Study 🏆'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 font-bold text-2xl">No questions found in this quiz!</div>
            )}
          </main>

          {/* Full Screen Bottom Navigation & Question Jumper */}
          <footer className="px-6 py-4 bg-white/5 backdrop-blur-md border-t border-white/10 flex justify-between items-center z-20 relative shrink-0">
            <button
              onClick={handleStudyPrev}
              disabled={studyIndex === 0}
              className="px-6 py-3 bg-white/15 hover:bg-white/25 disabled:opacity-20 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center gap-2 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {/* Question Quick Jump Dots */}
            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60vw] py-1 px-2 custom-scrollbar">
              {activeQuiz.questions.map((_, dotIdx) => {
                const historyItem = studyHistory[dotIdx];
                let dotClass = "bg-white/20 text-white/60";
                if (dotIdx === studyIndex) {
                  dotClass = "bg-amber-400 text-slate-900 scale-110 font-black shadow-md";
                } else if (historyItem) {
                  dotClass = historyItem.isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
                }

                return (
                  <button
                    key={dotIdx}
                    onClick={() => {
                      setStudyIndex(dotIdx);
                      setStudySelectedOption(studyHistory[dotIdx]?.selected ?? null);
                    }}
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer hover:scale-110 shrink-0 ${dotClass}`}
                  >
                    {dotIdx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleStudyNext}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-slate-900 rounded-xl font-black transition-all cursor-pointer flex items-center gap-2 shadow-md hover:scale-105 active:scale-95"
            >
              {studyIndex < activeQuiz.questions.length - 1 ? 'Next →' : 'Finish 🏆'}
            </button>
          </footer>
        </div>
      )}

      {/* 4. MAIN GAMEPLAY SCREEN (NUMBERED MYSTERY BOXES FROM 1 TO 30) */}
      {screen === 'game' && (
        <div className={`min-h-screen ${getThemeGameBg()} pb-16 ${celebration === 'lose' ? 'animate-shake' : ''}`}>
          {/* Confetti Explosion Visual Effect */}
          {celebration === 'win' && (
            <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
              {Array.from({ length: 45 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-sm animate-confetti-fall"
                  style={{
                    left: `${(i * 2.3) % 100}%`,
                    top: `-20px`,
                    backgroundColor: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444'][i % 6],
                    animationDuration: `${2 + (i % 3) * 0.7}s`,
                    animationDelay: `${(i % 10) * 0.12}s`,
                    transform: `rotate(${i * 35}deg)`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Bomb / Negative Impact Visual Effect */}
          {celebration === 'lose' && (
            <div className="fixed inset-0 pointer-events-none z-50 bg-red-600/20 animate-pulse border-8 border-red-500/50"></div>
          )}

          <header className="p-4 sm:p-6 bg-white/10 backdrop-blur-md shadow-lg border-b border-white/10 flex flex-col xl:flex-row justify-between items-center gap-4 z-10 relative">
            <div className="flex items-center gap-3">
              <button onClick={() => setScreen('setup')} className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-2xl transition-colors cursor-pointer" title="Return to Setup">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="bg-amber-400 p-2.5 rounded-2xl shadow-lg shadow-amber-400/40">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-sm">Mystery Box</h1>
            </div>

            {/* Teams Header Scoreboard */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 bg-white/5 p-2 rounded-2xl border border-white/10 flex-wrap max-w-4xl">
              {teams.map((t, idx) => {
                const isCurrent = currentTeamIdx === idx;
                const cfg = DEFAULT_TEAM_CONFIGS[idx % DEFAULT_TEAM_CONFIGS.length];
                return (
                  <div 
                    key={t.id}
                    className={`px-3 sm:px-5 py-2 rounded-2xl border-2 sm:border-4 transition-all duration-300 min-w-[95px] sm:min-w-[130px] text-center relative ${
                      isCurrent 
                        ? 'border-amber-400 bg-white text-slate-900 scale-105 shadow-[0_0_30px_rgba(251,191,36,0.6)] z-10' 
                        : 'border-transparent bg-white/10 text-white'
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm tracking-wider">
                        TURN
                      </span>
                    )}
                    <div className="flex items-center justify-center gap-1.5 mb-0.5">
                      <span className="text-base sm:text-lg">{t.icon || cfg.icon || '🦁'}</span>
                      <p className={`text-xs sm:text-sm font-black uppercase truncate max-w-[85px] sm:max-w-[110px] ${isCurrent ? 'text-amber-600' : 'text-white/80'}`}>
                        {t.name}
                      </p>
                    </div>
                    <p className={`text-2xl sm:text-3xl font-black drop-shadow-sm ${isCurrent ? 'text-slate-900' : 'text-white'}`}>
                      {t.score > 0 ? `+${t.score}` : t.score}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setTeams(teams.map(t => ({ ...t, score: 0 }))); setOpenedBoxes([]); }} className="p-3 bg-white/10 text-white hover:bg-red-500 rounded-xl transition-colors cursor-pointer" title="Reset Scores">
                <RefreshCw className="w-5 h-5" />
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className="p-3 bg-white/10 text-white hover:bg-white/20 rounded-xl transition-colors cursor-pointer" title="Toggle Sound">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <FullscreenButton targetId="game-container" />
              <button
                onClick={() => setShowModeModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title="Switch to Bubble Pop, Sumo, or Yoga Quiz"
              >
                <Shuffle size={14} className="text-amber-400" />
                <span className="hidden sm:inline">Switch Mode</span>
              </button>
              <button onClick={() => setScreen('setup')} className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-200 rounded-xl font-bold transition-all cursor-pointer shadow-md">
                Setup
              </button>
            </div>
          </header>

          <main className="max-w-7xl mx-auto px-4 mt-8">
            <div className="text-center mb-8">
              <div className="inline-block bg-white/15 backdrop-blur-md border border-white/20 rounded-full py-2 px-6 shadow-xl transform transition-all hover:scale-105">
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-3">
                  <span className={`px-5 py-1.5 rounded-full text-white font-black shadow-md ${DEFAULT_TEAM_CONFIGS[currentTeamIdx % DEFAULT_TEAM_CONFIGS.length].bg}`}>
                    {teams[currentTeamIdx]?.name.toUpperCase()} TURN
                  </span>
                  Pick a Mystery Box! (1 - {activeQuiz.questions.length})
                </h2>
              </div>
            </div>

            {/* MYSTERY BOXES GRID (1 TO 30) */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 sm:gap-4 justify-center mx-auto max-w-6xl">
              {activeQuiz.questions.map((q, idx) => {
                const boxNum = idx + 1; // 1 to 30
                const isOpened = openedBoxes.includes(boxNum);
                const isAnimating = selectedBoxAnimation === boxNum;
                const otherAnimating = selectedBoxAnimation !== null && selectedBoxAnimation !== boxNum;

                let boxClass = "";
                if (isOpened) {
                  boxClass = "bg-white/30 text-slate-400/40 cursor-not-allowed border-2 border-white/40 shadow-inner scale-95";
                } else if (isAnimating) {
                  boxClass = `${getThemeBoxClass()} text-white border-4 scale-[1.4] z-50 shadow-[0_0_80px_rgba(255,255,255,0.9)] opacity-100 rotate-[360deg]`;
                } else if (otherAnimating) {
                  boxClass = `${getThemeBoxClass()} text-white opacity-20 blur-sm scale-90 border-4`;
                } else {
                  boxClass = `${getThemeBoxClass()} animate-box-glow text-white hover:-translate-y-2 hover:shadow-2xl border-4 active:scale-95`;
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleBoxClick(boxNum)}
                    disabled={isOpened || selectedBoxAnimation !== null}
                    className={`relative overflow-hidden group aspect-square rounded-[1.8rem] sm:rounded-[2.2rem] flex flex-col items-center justify-center text-3xl sm:text-4xl md:text-5xl font-black shadow-xl transition-all duration-500 cursor-pointer ${boxClass}`}
                  >
                    {!isOpened && (
                      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                    )}
                    {/* DISPLAY NUMBER 1 TO 30 */}
                    <span className={`z-10 font-black text-4xl sm:text-5xl md:text-6xl tracking-tight ${!isOpened ? 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]' : 'relative text-slate-400/50 drop-shadow-none'}`}>
                      {boxNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </main>

          {/* ACTIVE BOX QUESTION MODAL & POPUPS (REDESIGNED WITH SIGNATURE FLOATING BADGES & ANIMATIONS) */}
          {activeBoxNum !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
              {/* 1. QUESTION POPUP */}
              {modalStep === 'question' && (
                <div className="bg-white border-[6px] border-amber-400 rounded-[3rem] p-6 sm:p-10 max-w-5xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  {/* Floating Number Badge */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl font-black shadow-xl border-[6px] border-white">
                      {activeBoxNum}
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-xl font-black text-orange-500 uppercase tracking-widest mb-4">QUESTION {activeBoxNum}</p>
                    <div className="bg-slate-50 rounded-[2.5rem] p-8 sm:p-12 mb-6 shadow-inner border border-slate-200">
                      <h3 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-800 leading-tight">
                        {activeQuiz.questions[activeBoxNum - 1]?.text}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-8 max-w-5xl mx-auto">
                        {activeQuiz.questions[activeBoxNum - 1]?.options.map((opt, i) => {
                          const letter = ['A', 'B', 'C', 'D'][i] || (i + 1);
                          let optStyle = "bg-white border-slate-200 text-slate-700";
                          if (!isAnswerRevealed) {
                            if (selectedOptionIndex === i) {
                              optStyle = "bg-orange-100 border-orange-500 text-orange-900 shadow-lg scale-[1.02]";
                            } else {
                              optStyle += " hover:border-orange-300 hover:bg-orange-50/50 cursor-pointer";
                            }
                          } else {
                            if (activeQuiz.questions[activeBoxNum - 1]?.answerIndex === i) {
                              optStyle = "bg-green-100 border-green-500 text-green-800 scale-[1.03] shadow-2xl z-10 font-black";
                            } else if (selectedOptionIndex === i) {
                              optStyle = "bg-red-100 border-red-500 text-red-700 opacity-90";
                            } else {
                              optStyle = "bg-white border-slate-200 text-slate-400 opacity-40";
                            }
                          }
                          return (
                            <button
                              key={i}
                              onClick={() => handleOptionSelect(i)}
                              disabled={isAnswerRevealed}
                              className={`p-5 sm:p-6 rounded-3xl text-xl sm:text-3xl font-bold border-[4px] transition-all flex items-center justify-between text-left w-full gap-3 ${optStyle}`}
                            >
                              <div className="flex items-center flex-1">
                                <span className="mr-3 opacity-50 shrink-0 font-black">{letter}.</span>
                                <span className="flex-1 break-words">{opt}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {!isAnswerRevealed ? (
                      <button onClick={handleRevealAnswer} className="mx-auto flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-3xl font-black text-2xl shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
                        <Eye className="w-7 h-7" /> Reveal Answer
                      </button>
                    ) : (
                      <div className="flex flex-col sm:flex-row justify-center gap-4 animate-pop-in">
                        <button onClick={handleIncorrect} className="flex-1 max-w-[280px] mx-auto sm:mx-0 flex items-center justify-center gap-3 px-8 py-5 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-[4px] border-slate-200 hover:border-red-300 rounded-3xl font-black text-2xl transition-all cursor-pointer">
                          <X className="w-8 h-8 text-red-500" /> INCORRECT
                        </button>
                        <button onClick={handleCorrect} className="flex-1 max-w-[280px] mx-auto sm:mx-0 flex items-center justify-center gap-3 px-8 py-5 bg-green-500 hover:bg-green-600 text-white rounded-3xl font-black text-2xl shadow-xl transition-all hover:-translate-y-1 cursor-pointer">
                          <Check className="w-8 h-8" /> CORRECT
                        </button>
                      </div>
                    )}
                  </div>

                  <button onClick={() => setActiveBoxNum(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer" title="Close">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* 2. CORRECT TRANSITION POPUP */}
              {modalStep === 'correct_transition' && (
                <div className="bg-white border-[6px] border-emerald-400 rounded-[3rem] p-10 sm:p-14 max-w-lg w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-emerald-400 to-green-600 text-white w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-[6px] border-white animate-bounce">
                      <Check className="w-14 h-14 stroke-[3]" />
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col items-center">
                    <h3 className="text-5xl sm:text-6xl font-black text-emerald-600 uppercase tracking-widest mb-3">CORRECT!</h3>
                    <p className="text-xl font-bold text-slate-600">Great job! Opening the Mystery Box...</p>
                  </div>
                </div>
              )}

              {/* 3. INCORRECT TRANSITION POPUP */}
              {modalStep === 'incorrect_transition' && (
                <div className="bg-white border-[6px] border-rose-400 rounded-[3rem] p-10 sm:p-14 max-w-lg w-full shadow-2xl relative my-auto animate-shake text-center">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-rose-400 to-red-600 text-white w-24 h-24 rounded-full flex items-center justify-center shadow-xl border-[6px] border-white">
                      <X className="w-14 h-14 stroke-[3]" />
                    </div>
                  </div>
                  <div className="mt-8 flex flex-col items-center">
                    <h3 className="text-5xl sm:text-6xl font-black text-rose-600 uppercase tracking-widest mb-3">INCORRECT</h3>
                    <p className="text-xl font-bold text-slate-600">Moving to the next team's turn...</p>
                  </div>
                </div>
              )}

              {/* 4. DECISION POPUP (KEEP OR GIVE) */}
              {modalStep === 'decision' && (
                <div className="bg-white border-[6px] border-amber-400 rounded-[3rem] p-8 sm:p-12 max-w-3xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  {/* Floating Mystery Box Badge */}
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl border-[6px] border-white animate-bounce">
                      📦
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-xl font-black text-orange-500 uppercase tracking-widest mb-2">DECISION TIME!</p>
                    <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3">
                      {teams[currentTeamIdx]?.name} Answered Correctly! 🎉
                    </h3>
                    <p className="text-lg sm:text-xl font-semibold text-slate-600 mb-8 max-w-xl mx-auto">
                      Do you want to <span className="font-black text-orange-500">KEEP</span> the mystery box, or <span className="font-black text-purple-600">GIVE</span> it away?
                    </p>

                    <div className="flex flex-col sm:flex-row justify-center gap-6">
                      <button 
                        onClick={() => handleExecuteDecision(currentTeamIdx)} 
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-8 bg-gradient-to-br from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 text-orange-600 border-[4px] border-orange-400 rounded-[2.5rem] transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                      >
                        <span className="text-6xl">📦</span>
                        <span className="font-black text-3xl">KEEP IT</span>
                        <span className="text-sm font-bold bg-orange-500 text-white px-4 py-1 rounded-full">
                          Applies to {teams[currentTeamIdx]?.name}
                        </span>
                      </button>

                      <button 
                        onClick={() => {
                          if (teams.length === 2) {
                            handleExecuteDecision((currentTeamIdx + 1) % teams.length);
                          } else {
                            setModalStep('give_away_selection');
                          }
                        }} 
                        className="flex-1 flex flex-col items-center justify-center gap-3 p-8 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-600 border-[4px] border-purple-400 rounded-[2.5rem] transition-all cursor-pointer shadow-lg hover:scale-105 active:scale-95"
                      >
                        <span className="text-6xl">🔄</span>
                        <span className="font-black text-3xl">GIVE IT AWAY</span>
                        <span className="text-sm font-bold bg-purple-600 text-white px-4 py-1 rounded-full">
                          {teams.length === 2 ? `Give to ${teams[(currentTeamIdx + 1) % teams.length]?.name}` : "Pass to Another Team"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <button onClick={() => setActiveBoxNum(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* 5. PASS THE BOX POPUP (WHEN 3+ TEAMS AND GIVE IT AWAY SELECTED) */}
              {modalStep === 'give_away_selection' && (
                <div className="bg-white border-[6px] border-purple-400 rounded-[3rem] p-8 sm:p-12 max-w-3xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl border-[6px] border-white animate-bounce">
                      🔄
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-xl font-black text-purple-600 uppercase tracking-widest mb-2">PASS THE BOX!</p>
                    <h3 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2">Who receives the Mystery Box?</h3>
                    <p className="text-lg font-bold text-slate-600 mb-8">
                      {teams[currentTeamIdx]?.name} chose to give it away! Pick a recipient team:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {teams.map((t, idx) => {
                        if (idx === currentTeamIdx) return null;
                        const cfg = DEFAULT_TEAM_CONFIGS[idx % DEFAULT_TEAM_CONFIGS.length];
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleExecuteDecision(idx)}
                            className="p-5 rounded-2xl border-4 border-slate-200 hover:border-purple-500 bg-slate-50 hover:bg-purple-50 flex flex-col items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md"
                          >
                            <span className="text-4xl">{t.icon || cfg.icon || '🦁'}</span>
                            <span className="font-black text-xl text-slate-800">{t.name}</span>
                            <span className="text-sm font-bold bg-white px-3 py-1 rounded-full text-slate-600 border border-slate-200">
                              Score: {t.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => setModalStep('decision')} className="absolute top-5 left-5 text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold text-sm cursor-pointer">
                    <ArrowLeft size={18} /> Back
                  </button>
                  <button onClick={() => setActiveBoxNum(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* 6. TARGET SELECTION POPUP (FOR STEAL / SWAP) */}
              {modalStep === 'target_selection' && currentOutcome && (
                <div className="bg-white border-[6px] border-indigo-400 rounded-[3rem] p-8 sm:p-12 max-w-3xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl border-[6px] border-white animate-bounce">
                      🎯
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-xl font-black text-indigo-600 uppercase tracking-widest mb-4">TARGET SELECTION</p>
                    <div className={`mb-6 mx-auto w-full max-w-md ${currentOutcome.color} rounded-3xl p-6 shadow-xl flex flex-col items-center gap-2 border-[6px] border-white text-white`}>
                      <h3 className="text-3xl sm:text-4xl font-black text-center">{currentOutcome.text}</h3>
                    </div>
                    <p className="text-xl font-black text-slate-800 mb-6">Choose which team to target:</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {teams.map((t, idx) => {
                        if (idx === targetTeamIdx) return null;
                        const cfg = DEFAULT_TEAM_CONFIGS[idx % DEFAULT_TEAM_CONFIGS.length];
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleTargetSelection(idx)}
                            className="p-5 rounded-2xl border-4 border-slate-200 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50 flex flex-col items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-md"
                          >
                            <span className="text-4xl">{t.icon || cfg.icon || '🦁'}</span>
                            <span className="font-black text-xl text-slate-800">{t.name}</span>
                            <span className="text-sm font-bold bg-white px-3 py-1 rounded-full text-slate-600 border border-slate-200">
                              Score: {t.score}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button onClick={() => setActiveBoxNum(null)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}

              {/* 7. REVEAL OUTCOME POPUP */}
              {modalStep === 'reveal' && currentOutcome && (
                <div className="bg-white border-[6px] border-amber-400 rounded-[3rem] p-8 sm:p-12 max-w-2xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <div className="bg-gradient-to-br from-amber-400 to-yellow-500 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl border-[6px] border-white animate-bounce">
                      ✨
                    </div>
                  </div>

                  <div className="mt-8">
                    <p className="text-xl font-black text-orange-500 uppercase tracking-widest mb-3">MYSTERY BOX UNBOXED!</p>
                    <div className={`my-6 mx-auto w-full max-w-md ${currentOutcome.color} rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-3 border-[6px] border-white text-white animate-bounce`}>
                      <h3 className="text-4xl sm:text-5xl font-black text-center">{currentOutcome.text}</h3>
                    </div>
                    <p className="text-xl font-bold text-slate-700 mb-8 flex items-center justify-center gap-2">
                      Applied to: 
                      <span className="px-5 py-2 rounded-2xl text-white font-black bg-gradient-to-r from-orange-500 to-amber-500 shadow-md text-xl">
                        {teams[targetTeamIdx || 0]?.name}
                      </span>
                    </p>
                    <button 
                      onClick={handleCloseReveal} 
                      className="px-12 py-5 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white rounded-2xl font-black text-2xl transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95"
                    >
                      Continue to Next Turn →
                    </button>
                  </div>

                  <button onClick={handleCloseReveal} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* GAME OVER MODAL (REDESIGNED WITH PODIUM LEADERBOARD & MEDALS) */}
          {isGameOver && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
              <div className="bg-white border-[6px] border-amber-400 rounded-[3rem] p-8 sm:p-12 max-w-3xl w-full shadow-2xl relative my-auto animate-pop-in text-center">
                {/* Floating Trophy Badge */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-br from-amber-400 to-yellow-500 text-white w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-xl border-[6px] border-white animate-bounce">
                    🏆
                  </div>
                </div>

                <div className="mt-8">
                  <p className="text-xl font-black text-amber-500 uppercase tracking-widest mb-2">GAME OVER!</p>
                  <h2 className="text-4xl sm:text-6xl font-black text-slate-900 uppercase mb-3">
                    {teams.length === 1 
                      ? 'Congratulations!' 
                      : `👑 ${[...teams].sort((a,b) => b.score - a.score)[0]?.name} WINS!`
                    }
                  </h2>
                  <p className="text-lg font-bold text-slate-500 mb-8">All {activeQuiz.questions.length} Mystery Boxes opened!</p>

                  {/* Leaderboard Rankings */}
                  <div className="w-full flex flex-col gap-3 mb-8 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                    {[...teams].sort((a,b) => b.score - a.score).map((t, rank) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const medal = medals[rank] || `#${rank + 1}`;
                      const isWinner = rank === 0;
                      return (
                        <div 
                          key={t.id}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                            isWinner 
                              ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-md font-black' 
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-3xl">{medal}</span>
                            <span className="text-2xl font-black">{t.name}</span>
                          </div>
                          <div className="text-2xl font-black text-amber-600">
                            {t.score > 0 ? `+${t.score}` : t.score} pts
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <button 
                      onClick={() => { 
                        setTeams(teams.map(t => ({ ...t, score: 0 }))); 
                        setOpenedBoxes([]); 
                      }} 
                      className="flex-1 py-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-2xl rounded-2xl shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      Play Again 🔄
                    </button>
                    <button 
                      onClick={() => setScreen('setup')} 
                      className="flex-1 py-5 bg-slate-900 hover:bg-slate-800 text-white font-black text-2xl rounded-2xl shadow-xl transition-all cursor-pointer hover:scale-105 active:scale-95"
                    >
                      Game Setup ⚙️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Switch Game Mode Modal */}
      <GameModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        gameData={{
          ...activeQuiz,
          customQuestions: activeQuiz.questions,
          questions: activeQuiz.questions,
        }}
        onSelectMode={(mode, data) => {
          setShowModeModal(false);
          onViewChange(mode as ViewState, data);
        }}
      />
    </div>
  );
}

// ==========================================
// QUIZ EDITOR COMPONENT (EXACT COPY FROM BUBBLE POP, CAPPED AT 30 QUESTIONS)
// ==========================================

function QuizEditor({
  quiz,
  onSave,
  onCancel,
  folders
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onCancel: () => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(() => (quiz.questions && quiz.questions.length > 0 ? quiz.questions.slice(0, 30) : [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0, optionImages: [null, null, null, null] }]));
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number } | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg("Please enter or paste at least one item.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const newItems: Question[] = parsed.slice(0, 30).map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || "",
      options: item.options || ["", "", "", ""],
      answerIndex: item.answerIndex || 0,
      optionImages: [null, null, null, null],
    }));

    if (action === 'replace') {
      setQuestions(newItems.slice(0, 30));
    } else {
      setQuestions(prev => {
        const combined = [...prev, ...newItems].slice(0, 30);
        return combined;
      });
    }

    setToastMsg(`✨ Added ${parsed.length} questions (capped at 30 max)!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parsePastedQuiz(pastedText);
    if (parsedItems.length === 1 && parsedItems[0].text === pastedText && parsedItems[0].options?.every(o => !o)) {
      return;
    }

    if (parsedItems.length > 0) {
      e.preventDefault();
      const newItems: Question[] = parsedItems.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || "",
        options: item.options || ["", "", "", ""],
        answerIndex: item.answerIndex || 0,
        optionImages: [null, null, null, null],
      }));

      setQuestions(prev => {
        const updated = [...prev];
        const current = updated[index];
        if (current && !current.text.trim()) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated.slice(0, 30);
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} questions! (Limit: 30)`);
      setTimeout(() => setToastMsg(""), 3500);
    }
  };

  const addQuestion = () => {
    if (questions.length >= 30) {
      setErrorMsg("Maximum limit of 30 questions reached!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setQuestions([...questions, { id: Date.now() + Math.random(), text: '', options: ['', '', '', ''], answerIndex: 0, optionImages: [null, null, null, null] }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length < 6) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const newOptions = [...q.options];
        newOptions.pop();
        const newAnswerIndex = q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
        return { ...q, options: newOptions, answerIndex: newAnswerIndex };
      }
      return q;
    }));
  };

  const removeQuestion = (id: number | string) => {
    setQuestions(prev => {
      if (prev.length > 1) {
        return prev.filter(q => q.id !== id);
      }
      return prev;
    });
  };

  const duplicateQuestion = (index: number) => {
    if (questions.length >= 30) {
      setErrorMsg("Maximum limit of 30 questions reached!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setQuestions(prev => {
      const newQuestions = [...prev];
      const qToCopy = prev[index];
      const duplicatedQ = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options]
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions.slice(0, 30);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        if (questions.length < 30) {
          addQuestion();
          setTimeout(() => {
            const nextInput = document.getElementById(`question-input-${index + 1}`);
            nextInput?.focus();
          }, 50);
        } else {
          setErrorMsg("Maximum limit of 30 questions reached!");
          setTimeout(() => setErrorMsg(""), 3000);
        }
      } else {
        const nextInput = document.getElementById(`question-input-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleSave = () => {
    const validQuestions = questions.filter(q => q.text.trim());
    if (validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const validQuestions = questions.filter(q => q.text.trim()).slice(0, 30);
    onSave({
      ...quiz,
      title: topic || "Mystery Box",
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        {/* CARD CONTAINER EXACTLY MATCHING USER SCREENSHOT */}
        <div className="w-full max-w-4xl bg-white dark:bg-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8 border border-slate-100 dark:border-slate-700">
          <div className="p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
              <div className="flex gap-3 items-center">
                <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                  Cancel
                </button>
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
                  <Save size={18} /> Save Quiz
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">TOPIC</label>
                <input 
                  type="text" 
                  placeholder="e.g. Present Simple" 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">CLASS LEVEL</label>
                <input 
                  type="text" 
                  placeholder="e.g. KET, Starters" 
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">FOLDER</label>
                <select 
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors"
                >
                  <option value="">No Folder (Root)</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
              {errorMsg}
            </div>
          )}

          {toastMsg && (
            <div className="bg-cyan-500/20 text-cyan-500 dark:text-cyan-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-sm">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
            {/* Action Bar */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                QUESTIONS ({questions.length} / 30)
              </span>
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2.5 cursor-pointer"
                >
                  <ClipboardList size={22} className="stroke-[2.5]" />
                  <span>Bulk Paste</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            {questions.map((q, index) => (
              <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
                <button 
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  disabled={questions.length >= 30}
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10 disabled:opacity-30"
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
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                    {index + 1}
                  </div>
                  <input 
                    id={`question-input-${index}`}
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={(e) => handlePaste(e, index)}
                    placeholder="Type your question here..."
                    className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name={`answer-${q.id}`} 
                        checked={q.answerIndex === optIndex}
                        onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                      />
                      {opt.startsWith('data:image') || opt.startsWith('http') ? (
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 pr-3">
                          <img src={opt} alt="Option" className="w-8 h-8 rounded object-cover" />
                          <span className="text-xs text-slate-400 flex-1 truncate">Image/GIF</span>
                          <button onClick={() => updateOption(q.id, optIndex, '')} className="text-red-400 hover:text-red-300 cursor-pointer p-1">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center gap-2">
                          <input 
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(q.id, optIndex, e.target.value)}
                            placeholder={`Option ${optIndex + 1}`}
                            className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${q.answerIndex === optIndex ? 'border-blue-500/50 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'} rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium`}
                          />
                          <button 
                            type="button"
                            onClick={() => setActiveGiphyInput({ qId: q.id, optIndex })}
                            className="bg-purple-500/20 text-purple-400 p-2 rounded-lg hover:bg-purple-500 hover:text-white transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                            title="Search Giphy"
                          >
                            <ImageIcon size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="ml-12 mt-3 flex gap-2">
                  <button onClick={() => addOption(q.id)} disabled={q.options.length >= 6} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">+ Option</button>
                  <button onClick={() => removeOption(q.id)} disabled={q.options.length <= 2} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">- Option</button>
                </div>
              </div>
            ))}

            <button 
              onClick={addQuestion}
              disabled={questions.length >= 30}
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={20} /> {questions.length >= 30 ? 'Maximum 30 Questions Reached' : 'Add Another Question'}
            </button>
          </div>
        </div>
      </div>

      <MediaPickerModal 
        isOpen={activeGiphyInput !== null}
        onClose={() => setActiveGiphyInput(null)}
        onSelect={(url) => {
          if (activeGiphyInput) {
            updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, url);
            setActiveGiphyInput(null);
          }
        }}
      />

      {showPublishModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this game to the Community so other teachers can use it?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
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

      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste & Auto-Divide
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paste multiple questions, numbered lists with options & answer (e.g. Answer: B), or tabular TSV data. (Max 30)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Paste Text Below (Supports multi-line Q&A format or Excel copy)
              </label>
              <textarea 
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
                className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
              />
            </div>

            {bulkText.trim() && (
              <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-cyan-500 mt-0.5"><Info size={16} /></div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Found <span className="font-bold text-slate-800 dark:text-white">{parsePastedQuiz(bulkText).length}</span> items. 
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                onClick={() => handleApplyBulkPaste('replace')}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Replace All
              </button>
              <button 
                onClick={() => handleApplyBulkPaste('append')}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
              >
                Append to End (Up to 30)
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

// --- PARSER HELPER ---
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];
  
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length > 0) {
        items.push({
          text: parts[0],
          options: [
            parts[1] || "",
            parts[2] || "",
            parts[3] || "",
            parts[4] || ""
          ],
          answerIndex: 0
        });
      }
    });
    if (items.length > 0) {
      items.forEach(q => {
        if (q.options) {
          while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
            q.options.pop();
          }
        }
      });
      return items.slice(0, 30);
    }
  }
  
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;
  const optionRegex = /^([a-eA-E1-4])[\.\)\:\-]\s+(.*)/;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    const ansMatch = line.match(/^answer\s*[:=]?\s*([a-eA-E1-4])/i);
    if (ansMatch) {
      if (currentQ) {
        const val = ansMatch[1].toUpperCase();
        if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
        else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
      }
      continue;
    }

    let inlineAnswerMatch = line.match(/\banswer\s*[:=]?\s*([a-eA-E1-4])\b/i);
    if (inlineAnswerMatch) {
      const val = inlineAnswerMatch[1].toUpperCase();
      let inlineAnswerIndex = -1;
      if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
      else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
      if (currentQ && inlineAnswerIndex >= 0) currentQ.answerIndex = inlineAnswerIndex;
      line = line.replace(inlineAnswerMatch[0], '').trim();
    }
    
    if (line === '') continue;
    
    const optMatch = line.match(optionRegex);
    if (optMatch) {
      if (!currentQ) {
        currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
        items.push(currentQ);
      }
      
      const optText = optMatch[2].trim();
      const prefix = optMatch[1].toUpperCase();
      let expectedIndex = -1;
      if (/[A-E]/.test(prefix)) expectedIndex = prefix.charCodeAt(0) - 65;
      else if (/[1-4]/.test(prefix)) expectedIndex = parseInt(prefix) - 1;
      
      if (expectedIndex >= 0 && expectedIndex < 4 && currentQ.options) {
        currentQ.options[expectedIndex] = optText;
      }
    } else {
      const qMatch = line.match(/^\d+[\.\)\:\-]\s+(.*)/);
      const qText = qMatch ? qMatch[1].trim() : line;
      currentQ = { text: qText, options: ["", "", "", ""], answerIndex: 0 };
      items.push(currentQ);
    }
  }
  
  return items.slice(0, 30);
}
