import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { UnifiedGameSetup } from "../components/UnifiedGameSetup";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { parseOptionContent, formatOptionContent, AnswerContentMode, getInstantCartoonPng } from "../utils/mediaAndPresets";
import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, ClipboardList, Info, Settings, Copy, Flag, Volume2, VolumeX, Shuffle, Check, Trophy, Timer, RotateCcw, Users, User } from "lucide-react";
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { drawCharacterHand, HandCharacterType, toPx, distPx } from "../utils/superheroHands";
import { drawAnimatedNose, NoseStyle } from "../utils/animatedNose";

type GameScreen = 'intro' | 'lobby' | 'editor' | 'setup' | 'loading' | 'game' | 'results' | 'study';

interface PlayerData {
  level: number;
  xp: number;
  xpNext: number;
  coins: number;
}

interface StatsData {
  gamesPlayed: number;
  bubblesPopped: number;
}

interface Question {
  id: number | string;
  text: string;
  image?: string;
  options: string[];
  answerIndex: number;
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
  id: Date.now(),
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0
});

const DEFAULT_BUBBLE_QUESTIONS: Question[] = [];

const HAND_TRACKER_OPTIONS: Array<{ id: HandCharacterType; name: string; icon: string; color: string }> = [
  { id: 'spiderman', name: 'Spider-Man', icon: '🕷️', color: 'from-red-500 to-blue-600' },
  { id: 'thanos', name: 'Thanos Gauntlet', icon: '🧤', color: 'from-amber-500 to-yellow-600' },
  { id: 'witch', name: 'Wicked Witch', icon: '🧙‍♀️', color: 'from-emerald-500 to-purple-700' },
  { id: 'hulk', name: 'Incredible Hulk', icon: '💪', color: 'from-green-600 to-emerald-500' },
  { id: 'ironman', name: 'Iron Man', icon: '🤖', color: 'from-red-600 to-amber-500' },
  { id: 'frost', name: 'Frost Mage', icon: '❄️', color: 'from-cyan-500 to-blue-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Mecha', icon: '⚡', color: 'from-fuchsia-500 to-cyan-500' },
];

const NOSE_TRACKER_OPTIONS: Array<{ id: NoseStyle; name: string; icon: string; color: string }> = [
  { id: 'real', name: 'Real Nose', icon: '👃', color: 'from-amber-400 to-rose-400' },
  { id: 'clown', name: 'Clown Nose', icon: '🔴', color: 'from-red-500 to-rose-600' },
  { id: 'rudolph', name: 'Rudolph', icon: '🦌', color: 'from-red-600 to-amber-500' },
  { id: 'pig', name: 'Pig Snout', icon: '🐷', color: 'from-pink-400 to-rose-400' },
  { id: 'cat', name: 'Cat Whiskers', icon: '🐱', color: 'from-slate-700 to-slate-900' },
  { id: 'pinocchio', name: 'Pinocchio', icon: '🤥', color: 'from-amber-600 to-yellow-700' },
];

export function BubblePop({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<GameScreen>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor');
  const screenHistoryRef = useRef<GameScreen[]>([]);
  const screenRef = useRef<GameScreen>(screen);
  screenRef.current = screen;

  const navigateScreen = (next: GameScreen) => {
    if (screenRef.current !== next) {
      screenHistoryRef.current.push(screenRef.current);
    }
    setScreen(next);
  };

  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(doc => f.push({ id: doc.id, ...doc.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);
  const [playerData, setPlayerData] = useState<PlayerData>({
    level: 12, xp: 2430, xpNext: 3000, coins: 150
  });

  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }]
    };
  });

  useEffect(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_QUESTION()]);

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Bubble Pop",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
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
      alert("You must be logged in to save games.");
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

      const gameToSave = JSON.parse(JSON.stringify({
        name: quiz.title || quiz.topic || "Bubble Pop Game",
        title: quiz.title || quiz.topic || "Bubble Pop Game",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "bubble-pop",
        customQuestions: quiz.questions,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || "Teacher",
        creatorEmail: user.email || "",
        updatedAt: now,
        publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
        createdAt: (isOwnExistingGame && initialGame?.createdAt) ? initialGame.createdAt : now,
        isPublic: isPublicBool,
      }));

      if (isOwnExistingGame) {
        try {
          await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
        } catch (err: any) {
          if (err?.code === 'not-found') {
            await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
          } else {
            throw err;
          }
        }
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
      }
      onViewChange("games");
    } catch (error: any) {
      console.error("Error saving game:", error);
      alert("Failed to save game: " + (error?.message || String(error)));
      onViewChange("games");
    }
  };

  const [statsData, setStatsData] = useState<StatsData>({
    gamesPlayed: 0, bubblesPopped: 0
  });
  
  const [numPlayers, setNumPlayers] = useState(1);
  const [scores, setScores] = useState([0, 0]);
  const [frozenTeams, setFrozenTeams] = useState([false, false]);
  const [questionText, setQuestionText] = useState("Loading...");
  const [questionImage, setQuestionImage] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const [combo, setCombo] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [accuracy, setAccuracy] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [resultsTitle, setResultsTitle] = useState("Good Try!");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const cameraRef = useRef<any>(null);
  const handsRef = useRef<any>(null);
  const faceMeshRef = useRef<any>(null);
  const detectedHandsRef = useRef<any[]>([]);
  const detectedFacesRef = useRef<any[]>([]);
  const lastNosePopTimeRef = useRef(0);

  // Tracker mode & customization state
  const [trackerMode, setTrackerMode] = useState<'finger' | 'hand' | 'nose'>(() => {
    try {
      const saved = localStorage.getItem('bubbleTrackerMode_v1');
      if (saved === 'finger' || saved === 'hand' || saved === 'nose') return saved;
    } catch (e) {}
    return 'finger';
  });
  const [handCharacter, setHandCharacter] = useState<HandCharacterType>(() => {
    try {
      const saved = localStorage.getItem('bubbleHandCharacter_v1');
      if (saved) return saved as HandCharacterType;
    } catch (e) {}
    return 'spiderman';
  });
  const [noseStyle, setNoseStyle] = useState<NoseStyle>(() => {
    try {
      const saved = localStorage.getItem('bubbleNoseStyle_v1');
      if (saved) return saved as NoseStyle;
    } catch (e) {}
    return 'real';
  });
  const [showTrackerModal, setShowTrackerModal] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('bubbleTrackerMode_v1', trackerMode); } catch (e) {}
  }, [trackerMode]);
  useEffect(() => {
    try { localStorage.setItem('bubbleHandCharacter_v1', handCharacter); } catch (e) {}
  }, [handCharacter]);
  useEffect(() => {
    try { localStorage.setItem('bubbleNoseStyle_v1', noseStyle); } catch (e) {}
  }, [noseStyle]);

  const trackerModeRef = useRef(trackerMode);
  trackerModeRef.current = trackerMode;
  const handCharacterRef = useRef(handCharacter);
  handCharacterRef.current = handCharacter;
  const noseStyleRef = useRef(noseStyle);
  noseStyleRef.current = noseStyle;

  const [cameraError, setCameraError] = useState("");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [p1Name, setP1Name] = useState("Team 1");
  const [p2Name, setP2Name] = useState("Team 2");
  const [speed, setSpeed] = useState(1);
  const [gameDurationMinutes, setGameDurationMinutes] = useState(3);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(180);
  const [teamStats, setTeamStats] = useState<Array<{ correctPops: number; wrongPops: number; streak: number; maxCombo: number }>>([
    { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 },
    { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 }
  ]);
  const [showInGameSettings, setShowInGameSettings] = useState(false);
  const handleSetSpeed = (val: number) => { setSpeed(val); gameState.current.speed = val; };
  const handleSetBubbleSize = (val: number) => { setBubbleSize(val); gameState.current.size = val; };
  const handleSetTwistEnabled = (val: boolean) => { setTwistEnabled(val); gameState.current.twist = val; };
  const handleSetTimerMinutes = (mins: number) => {
    const clamped = Math.max(1, Math.min(10, mins));
    setGameDurationMinutes(clamped);
    setTimeLeftSeconds(clamped * 60);
    timeLeftSecondsRef.current = clamped * 60;
  };
  const [bubbleSize, setBubbleSize] = useState(1);
  const [twistEnabled, setTwistEnabled] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('theme-sky');
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [studyScore, setStudyScore] = useState(0);
  const [studyStreak, setStudyStreak] = useState(0);
  const [studyAnswers, setStudyAnswers] = useState<Record<number, boolean>>({});
  const handleSetVoiceEnabled = (val: boolean) => { setVoiceEnabled(val); gameState.current.voice = val; };
  
  const timeLeftSecondsRef = useRef(180);
  const matchTimerRef = useRef<any>(null);
  const formatTimeMMSS = (sec: number) => {
    const safeSec = Math.max(0, Math.floor(sec));
    const m = Math.floor(safeSec / 60);
    const s = safeSec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Game engine state refs
  const gameState = useRef({
    isActive: false,
    numPlayers: 1,
    scores: [0, 0],
    frozenTeams: [false, false],
    currentQuestionIndex: 0,
    combo: 0,
    maxCombo: 0,
    correctPops: 0,
    wrongPops: 0,
    playerStats: [
      { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 },
      { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 }
    ],
    questionStartTime: 0,
    questions: [] as Question[],
    speed: 1,
    size: 1,
    twist: false,
    voice: true
  });
  
  const questionTimerRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Graphics state
  const graphicsState = useRef({
    bubbles: [] as any[],
    particles: [] as any[],
    shockwaves: [] as any[],
    floatingTexts: [] as any[],
    ambientParticles: [] as any[],
    isQuestionActive: false
  });
  
  const pointerColors = [
    { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' }, 
    { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' }  
  ];

  const pointers = useRef([
    { x: -100, y: -100, targetX: -100, targetY: -100, detected: false, history: [] as any[], color: pointerColors[0] },
    { x: -100, y: -100, targetX: -100, targetY: -100, detected: false, history: [] as any[], color: pointerColors[1] }
  ]);

  useEffect(() => {
    const saved = localStorage.getItem('bubbleAcademySave');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.player) setPlayerData(parsed.player);
            if (parsed.stats) setStatsData(parsed.stats);
        } catch (e) {}
    }
    
    return () => {
      gameState.current.isActive = false;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      if (cameraRef.current && cameraRef.current.stop) {
          cameraRef.current.stop();
      }
      if (handsRef.current && handsRef.current.close) {
          try { handsRef.current.close(); } catch(e) {}
      }
      if (faceMeshRef.current && faceMeshRef.current.close) {
          try { faceMeshRef.current.close(); } catch(e) {}
      }
    };
  }, []);

  const saveGame = (p: PlayerData, s: StatsData) => {
    localStorage.setItem('bubbleAcademySave', JSON.stringify({ player: p, stats: s }));
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'pop' | 'win' | 'lose' | 'correct' | 'wrong' | 'bubble-click' | 'whoosh' | 'fanfare') => {
    try {
      initAudio();
      if (!audioCtxRef.current) return;
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const comboMultiplier = Math.min(gameState.current.combo || 0, 10);
      const pitchShift = 1 + (comboMultiplier * 0.1); 
      
      if (type === 'pop') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 * pitchShift, now);
        osc.frequency.exponentialRampToValueAtTime(100 * pitchShift, now + 0.1);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.15);
      } else if (type === 'bubble-click') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(640, now);
        osc.frequency.exponentialRampToValueAtTime(1280, now + 0.05);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
        osc.start(now); osc.stop(now + 0.08);
      } else if (type === 'correct') {
        // Cheerful sparkling bubble chime
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.type = 'triangle';
          const t = now + idx * 0.065;
          osc.frequency.setValueAtTime(freq, t);
          gainNode.gain.setValueAtTime(0.28, t);
          gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.start(t);
          osc.stop(t + 0.25);
        });
      } else if (type === 'wrong') {
        // Cute comic bloop wobble
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(160, now + 0.14);
        osc.frequency.linearRampToValueAtTime(120, now + 0.28);
        gainNode.gain.setValueAtTime(0.32, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.32);
      } else if (type === 'whoosh') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(840, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'win' || type === 'fanfare') {
        const freqs = [440, 554.37, 659.25, 880];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.type = 'square';
          const t = now + i * 0.08;
          osc.frequency.setValueAtTime(f, t);
          gainNode.gain.setValueAtTime(0.18, t);
          gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.28);
          osc.start(t);
          osc.stop(t + 0.32);
        });
      } else if (type === 'lose') {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.3);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.35);
      }
    } catch {}
  };

  const speakText = (text: string, force = false) => {
    if (!gameState.current.voice && !force) return;
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const cleanedText = text.replace(/_+/g, "blank");
        const utterance = new SpeechSynthesisUtterance(cleanedText);
        
        const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(cleanedText);
        if (isVietnamese) {
          utterance.lang = 'vi-VN';
        } else {
          utterance.lang = 'en-US';
          const voices = window.speechSynthesis.getVoices();
          const femaleVoices = voices.filter(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Samantha') || 
            v.name.includes('Victoria') ||
            v.name.includes('Karen') ||
            v.name.includes('Tessa') ||
            (v.name.includes('Female') && v.lang.startsWith('en')) ||
            (v.name.includes('Zira') && v.lang.startsWith('en'))
          );
          if (femaleVoices.length > 0) {
            utterance.voice = femaleVoices[0];
          }
        }
        
        utterance.rate = 0.95; 
        utterance.pitch = 1.1; 
        window.speechSynthesis.speak(utterance);
      } catch {}
    }
  };

  const startGameMode = async (players: number) => {
    setNumPlayers(players);
    gameState.current.numPlayers = players;
    initAudio();
    
    setScreen('loading');
    
    if (!videoRef.current?.srcObject && !isCameraActive) {
       try {
           await setupCamera();
       } catch (err) {
           console.warn("Camera could not start; continuing with mouse/touch mode:", err);
       }
    }
    
    continueStartGame(players);
  };

  const continueStartGame = (players: number = numPlayers) => {
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    }
    if (matchTimerRef.current) {
        clearInterval(matchTimerRef.current);
        matchTimerRef.current = null;
    }

    const initialPlayerStats = [
      { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 },
      { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 }
    ];

    gameState.current = {
        isActive: true,
        numPlayers: players,
        scores: [0, 0],
        frozenTeams: [false, false],
        currentQuestionIndex: 0,
        combo: 0,
        maxCombo: 0,
        correctPops: 0,
        wrongPops: 0,
        playerStats: initialPlayerStats,
        questionStartTime: 0,
        questions: activeQuiz ? [...activeQuiz.questions].sort(() => 0.5 - Math.random()) : [],
        speed: speed,
        size: bubbleSize,
        twist: twistEnabled,
        voice: voiceEnabled
    };

    // Clean reset for pointers
    pointers.current.forEach(p => {
        p.x = -100;
        p.y = -100;
        p.targetX = -100;
        p.targetY = -100;
        p.detected = false;
        p.history = [];
    });
    
    setScores([0, 0]);
    setTeamStats(initialPlayerStats);
    setCurrentQuestionIndex(0);
    setCombo(0);
    setShowCombo(false);

    const totalSecs = Math.max(1, Math.min(10, gameDurationMinutes)) * 60;
    setTimeLeftSeconds(totalSecs);
    timeLeftSecondsRef.current = totalSecs;

    matchTimerRef.current = setInterval(() => {
      if (!gameState.current.isActive) {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
        return;
      }
      timeLeftSecondsRef.current -= 1;
      setTimeLeftSeconds(timeLeftSecondsRef.current);
      if (timeLeftSecondsRef.current <= 0) {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
        showResults();
      }
    }, 1000);

    setScreen('game');
    
    setTimeout(() => {
        runGameEngine();
        startQuestion();
    }, 100);
  };

  class Bubble {
      index: number; text: string; isCorrect: boolean; color: string;
      radius: number; scale: number; targetScale: number;
      x: number; y: number; baseVy: number; vy: number; vx: number;
      time: number; popped: boolean; state: string; width: number; height: number;
      imageElement?: HTMLImageElement;
      playerId?: number;

      constructor(index: number, text: string, isCorrect: boolean, totalOptions: number, w: number, h: number, playerId?: number) {
          this.playerId = playerId;
          this.index = index; this.text = text; this.isCorrect = isCorrect;
          const bubbleColors = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
          this.color = bubbleColors[index % bubbleColors.length];
          this.width = w; this.height = h;
          
          this.radius = Math.min(w, h) * 0.09 * (gameState.current.size || 1); 
          this.scale = 0; 
          this.targetScale = 1;
          
          let usableW = w;
          let xOffset = 0;
          if (playerId === 0) { usableW = w / 2; xOffset = 0; }
          else if (playerId === 1) { usableW = w / 2; xOffset = w / 2; }
          
          const sectionWidth = usableW / totalOptions;
          this.x = xOffset + (sectionWidth * index) + (sectionWidth / 2) + ((Math.random() - 0.5) * sectionWidth * 0.4); 
          this.y = -this.radius - (Math.random() * 200); 
          this.baseVy = (1.5 + Math.random()) * (gameState.current.speed || 1);
          this.vy = this.baseVy;
          this.vx = (Math.random() - 0.5) * 1.5 * (gameState.current.speed || 1); 
          this.time = Math.random() * 100;
          this.popped = false;
          this.state = 'normal';

          const parsedOpt = parseOptionContent(this.text);
          this.text = parsedOpt.text || '';
          if (parsedOpt.imageUrl) {
              this.imageElement = new Image();
              this.imageElement.onload = () => { (this.imageElement as any).isLoaded = true; };
              this.imageElement.src = parsedOpt.imageUrl;
          }
      }
      update() {
          if (this.popped) return;
          this.time += 0.05 * (gameState.current.speed || 1);
          this.scale += (this.targetScale - this.scale) * 0.15;
          
          if (gameState.current.twist) {
              this.vx = Math.sin(this.time * 2) * 5 * (gameState.current.speed || 1);
              this.x += this.vx;
          } else {
              this.x += this.vx + Math.sin(this.time) * 1.5 * (gameState.current.speed || 1);
          }
          
          this.y += this.vy + Math.cos(this.time * 0.5) * 0.5 * (gameState.current.speed || 1);
          if (this.y > this.height + this.radius) {
              this.y = -this.radius;
              let usableW = this.width;
              let xOffset = 0;
              if (this.playerId === 0) { usableW = this.width / 2; xOffset = 0; }
              else if (this.playerId === 1) { usableW = this.width / 2; xOffset = this.width / 2; }
              this.x = xOffset + (usableW * 0.15) + (Math.random() * usableW * 0.7);
          }
          
          let minX = this.radius;
          let maxX = this.width - this.radius;
          if (this.playerId === 0) maxX = (this.width / 2) - this.radius;
          if (this.playerId === 1) minX = (this.width / 2) + this.radius;
          
          if (this.x < minX || this.x > maxX) {
              this.vx *= -1;
              if (this.x < minX) this.x = minX;
              if (this.x > maxX) this.x = maxX;
          }
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.popped) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          const wobble = 1 + Math.sin(this.time * 2) * 0.03;
          let finalScale = this.scale * wobble;
          if(this.state === 'shaking') finalScale += (Math.random() - 0.5) * 0.1;
          ctx.scale(finalScale, 1/finalScale);
          if (gameState.current.twist) {
              ctx.rotate(this.time * 2 * (gameState.current.speed || 1));
          }

          const grad = ctx.createRadialGradient(-this.radius*0.3, -this.radius*0.3, this.radius*0.1, 0, 0, this.radius);
          grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
          grad.addColorStop(0.2, this.color);
          grad.addColorStop(0.8, this.color + 'aa');
          grad.addColorStop(1, 'rgba(255, 255, 255, 0.2)');

          ctx.beginPath();
          ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
          
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.shadowColor = this.color;
          ctx.shadowBlur = 15;
          ctx.stroke();
          ctx.shadowBlur = 0; 

          ctx.beginPath();
          ctx.arc(-this.radius*0.3, -this.radius*0.3, this.radius*0.4, Math.PI, Math.PI*1.5);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = this.radius * 0.15;
          ctx.lineCap = 'round';
          ctx.stroke();

          if (this.imageElement && (this.imageElement as any).isLoaded) {
              ctx.save();
              ctx.beginPath();
              ctx.arc(0, 0, this.radius * 0.82, 0, Math.PI * 2);
              ctx.clip();
              if (this.text) {
                  const imgSize = this.radius * 1.15;
                  ctx.drawImage(this.imageElement, -imgSize / 2, -this.radius * 0.72, imgSize, imgSize);
              } else {
                  const imgSize = this.radius * 1.55;
                  ctx.drawImage(this.imageElement, -imgSize / 2, -imgSize / 2, imgSize, imgSize);
              }
              ctx.restore();

              if (this.text) {
                  ctx.fillStyle = '#ffffff';
                  const fontSize = Math.max(12, this.text.length > 6 ? this.radius * 0.28 : this.radius * 0.34);
                  ctx.font = `900 ${fontSize}px 'Fredoka', sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.lineWidth = 4;
                  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
                  ctx.strokeText(this.text, 0, this.radius * 0.56);
                  ctx.fillText(this.text, 0, this.radius * 0.56);
              }
          } else if (this.text) {
              ctx.fillStyle = '#ffffff';
              const fontSize = this.text.length > 4 ? this.radius * 0.40 : this.radius * 0.55;
              ctx.font = `900 ${fontSize}px 'Fredoka', sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = 'rgba(0,0,0,0.6)';
              ctx.shadowBlur = 4;
              ctx.fillText(this.text, 0, this.radius * 0.05);
          }
          ctx.restore();
      }
      checkCollision(px: number, py: number, pIndex?: number) {
          if (this.popped || this.scale < 0.8) return false;
          if (this.playerId !== undefined && pIndex !== undefined && this.playerId !== pIndex) return false;
          const dx = this.x - px;
          const dy = this.y - py;
          return (dx*dx + dy*dy) < (this.radius * this.radius);
      }
  }

  class Particle {
      x: number; y: number; color: string; isSparkle: boolean;
      vx: number; vy: number; life: number; size: number;
      constructor(x: number, y: number, color: string, isSparkle = false) {
          this.x = x; this.y = y; this.color = color; this.isSparkle = isSparkle;
          const speed = isSparkle ? 20 : 12;
          this.vx = (Math.random() - 0.5) * speed;
          this.vy = (Math.random() - 0.5) * speed;
          this.life = 1.0;
          this.size = isSparkle ? Math.random() * 4 + 2 : Math.random() * 8 + 4;
      }
      update() {
          this.x += this.vx; this.y += this.vy;
          this.vy += 0.4; this.life -= 0.03;
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = this.life;
          if (this.isSparkle) {
              ctx.fillStyle = '#ffffff';
              // Removed shadowBlur to fix heavy lag during multi-explosions
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
              ctx.fill();
          } else {
              ctx.fillStyle = this.color;
              ctx.beginPath();
              ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
              ctx.fill();
          }
          ctx.restore();
      }
  }

  class Shockwave {
      x: number; y: number; color: string; radius: number; life: number;
      constructor(x: number, y: number, color: string) {
          this.x = x; this.y = y; this.color = color;
          this.radius = 10; this.life = 1.0;
      }
      update() { this.radius += 8; this.life -= 0.05; }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = this.life;
          ctx.beginPath();
          ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
          ctx.lineWidth = 4;
          ctx.strokeStyle = this.color;
          ctx.stroke();
          ctx.restore();
      }
  }

  class FloatingText {
      x: number; y: number; text: string; color: string; life: number; vy: number; vx: number; size: number;
      targetX?: number; targetY?: number; delay: number;
      
      constructor(x: number, y: number, text: string, color: string, isCombo = false, targetX?: number, targetY?: number) {
          this.x = x; this.y = y; this.text = text; this.color = color;
          this.life = 1.5; // Longer life
          this.size = isCombo ? 100 : 40;
          this.targetX = targetX;
          this.targetY = targetY;
          this.delay = 45; // wait ~0.75s floating up before moving to target
          this.vx = 0;
          this.vy = -1.5; // Float up slowly initially
      }
      update() { 
          if (this.targetX !== undefined && this.targetY !== undefined) {
              if (this.delay > 0) {
                  this.delay--;
                  this.y += this.vy;
              } else {
                  const dx = this.targetX - this.x;
                  const dy = this.targetY - this.y;
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist > 15) {
                      this.vx = (dx / dist) * 25;
                      this.vy = (dy / dist) * 25;
                      this.x += this.vx;
                      this.y += this.vy;
                  }
              }
          } else {
              this.y += this.vy;
          }
          this.life -= 0.015; 
      }
      draw(ctx: CanvasRenderingContext2D) {
          if (this.life <= 0) return;
          ctx.save();
          ctx.globalAlpha = Math.min(1, this.life); // Cap at 1
          ctx.font = `900 ${this.size}px 'Fredoka', sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 6; ctx.strokeStyle = '#000000';
          ctx.strokeText(this.text, this.x, this.y);
          ctx.fillStyle = this.color;
          ctx.fillText(this.text, this.x, this.y);
          ctx.restore();
      }
  }

  const createExplosion = (x: number, y: number, color: string, isPrimary = true) => {
      graphicsState.current.shockwaves.push(new Shockwave(x, y, color));
      const pCount = isPrimary ? 12 : 5;
      const sCount = isPrimary ? 8 : 3;
      for (let i=0; i<pCount; i++) graphicsState.current.particles.push(new Particle(x, y, color, false)); 
      for (let i=0; i<sCount; i++) graphicsState.current.particles.push(new Particle(x, y, color, true));  
  };

  const startQuestion = () => {
    if (gameState.current.currentQuestionIndex >= gameState.current.questions.length) {
        showResults();
        return;
    }
    const q = gameState.current.questions[gameState.current.currentQuestionIndex];
    const parsedQ = parseOptionContent(q.text || '');
    const qImg = parsedQ.imageUrl || q.image || null;
    const qDisplayText = parsedQ.text || (qImg ? '' : q.text);
    setQuestionText(qDisplayText);
    setQuestionImage(qImg);
    if (qDisplayText) {
      speakText(qDisplayText);
    }
    
    gameState.current.frozenTeams = [false, false];
    setFrozenTeams([false, false]);
    
    graphicsState.current.bubbles = []; 
    graphicsState.current.floatingTexts = [];
    graphicsState.current.isQuestionActive = false;
    
    let timeLeft = 3; 
    setCountdown(timeLeft);
    
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    
    questionTimerRef.current = setInterval(() => {
        if (!gameState.current.isActive) {
            clearInterval(questionTimerRef.current);
            return;
        }
        timeLeft--;
        if (timeLeft > 0) {
            setCountdown(timeLeft);
            playSound('pop'); 
        } else {
            clearInterval(questionTimerRef.current);
            setCountdown(null);
            
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;

            const rawOptions = Array.isArray(q.options) ? q.options : [];
            let validOpts = rawOptions.filter((opt: any) => typeof opt === 'string' && opt.trim() !== "");
            if (validOpts.length < 2) validOpts = ["Yes", "No"];
            const correctOptText = rawOptions[q.answerIndex] !== undefined ? rawOptions[q.answerIndex] : validOpts[0];

            validOpts.forEach((optText, i) => {
                const isCorrect = optText === correctOptText;
                if (gameState.current.numPlayers === 2) {
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h, 0));
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h, 1));
                } else {
                    graphicsState.current.bubbles.push(new Bubble(i, optText, isCorrect, validOpts.length, w, h));
                }
            });
            
            graphicsState.current.isQuestionActive = true;
            gameState.current.questionStartTime = Date.now(); 
        }
    }, 1000);
  };

  const handlePop = (bubble: any, playerIndex: number) => {
    if (!graphicsState.current.isQuestionActive || bubble.popped || bubble.state === 'shaking') return;
    const pIdx = playerIndex === 1 ? 1 : 0;
    if (gameState.current.frozenTeams[pIdx]) return;
    
    bubble.state = 'shaking'; 
    
    setTimeout(() => {
        bubble.popped = true;
        createExplosion(bubble.x, bubble.y, bubble.color);
        
        if (bubble.isCorrect) {
            playSound('win');
            setStatsData(prev => ({...prev, bubblesPopped: prev.bubblesPopped + 1}));
            gameState.current.correctPops++;
            gameState.current.combo++;
            
            if(gameState.current.combo > gameState.current.maxCombo) {
                gameState.current.maxCombo = gameState.current.combo;
            }

            const pStat = gameState.current.playerStats[pIdx];
            if (pStat) {
                pStat.correctPops += 1;
                pStat.streak += 1;
                if (pStat.streak > pStat.maxCombo) {
                    pStat.maxCombo = pStat.streak;
                }
            }
            setTeamStats([...gameState.current.playerStats.map(s => ({ ...s }))]);
            
            let points = 5;
            gameState.current.scores[pIdx] += points;
            
            const w = containerRef.current?.clientWidth || 800;
            const targetX = pIdx === 0 ? 100 : w - 100;
            graphicsState.current.floatingTexts.push(new FloatingText(bubble.x, bubble.y, `+5`, '#4ade80', true, targetX, 80));
            
            if(gameState.current.combo > 1) {
                setCombo(gameState.current.combo);
                setShowCombo(true);
            }
            
            setScores([...gameState.current.scores]);
            graphicsState.current.isQuestionActive = false;
            
            graphicsState.current.bubbles.forEach(b => {
                if (!b.popped) {
                    setTimeout(() => {
                        b.popped = true;
                        createExplosion(b.x, b.y, b.color, false);
                        playSound('pop');
                    }, Math.random() * 300);
                }
            });

            setQuestionText(`Amazing! ${pIdx === 0 ? p1Name : p2Name} +5 PTS!`);
            setQuestionImage(null);
            speakText("Correct!");
            
            setTimeout(() => {
                if (!gameState.current.isActive) return;
                gameState.current.currentQuestionIndex++;
                setCurrentQuestionIndex(gameState.current.currentQuestionIndex);
                setShowCombo(false);
                
                if (gameState.current.currentQuestionIndex >= gameState.current.questions.length) {
                    showResults();
                } else {
                    startQuestion();
                }
            }, 2000);

        } else {
            playSound('lose');
            gameState.current.wrongPops++;
            gameState.current.combo = 0; 
            setShowCombo(false);

            const pStat = gameState.current.playerStats[pIdx];
            if (pStat) {
                pStat.wrongPops += 1;
                pStat.streak = 0;
            }
            setTeamStats([...gameState.current.playerStats.map(s => ({ ...s }))]);

            const penalty = 5;
            gameState.current.scores[pIdx] = Math.max(0, gameState.current.scores[pIdx] - penalty);
            setScores([...gameState.current.scores]);
            
            const w = containerRef.current?.clientWidth || 800;
            const targetX = pIdx === 0 ? 100 : w - 100;
            graphicsState.current.floatingTexts.push(new FloatingText(bubble.x, bubble.y, `-5`, '#ef4444', true, targetX, 80));
            
            if (gameState.current.numPlayers === 2) {
                const otherTeamIndex = pIdx === 0 ? 1 : 0;
                if (gameState.current.frozenTeams[otherTeamIndex]) {
                    // Unfreeze both since both got it wrong
                    gameState.current.frozenTeams = [false, false];
                    setFrozenTeams([false, false]);
                } else {
                    // Freeze the team that got it wrong
                    const newFrozen = [...gameState.current.frozenTeams];
                    newFrozen[pIdx] = true;
                    gameState.current.frozenTeams = newFrozen;
                    setFrozenTeams(newFrozen);
                }
            }
            
            if (canvasRef.current) {
                canvasRef.current.classList.add('shake');
                setTimeout(() => canvasRef.current?.classList.remove('shake'), 400);
            }
        }
    }, 100);
  };

  const showResults = () => {
    gameState.current.isActive = false;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
    }
    
    const total = gameState.current.correctPops + gameState.current.wrongPops;
    const acc = total === 0 ? 0 : Math.round((gameState.current.correctPops / total) * 100);
    const totalScore = gameState.current.scores[0] + gameState.current.scores[1];
    
    const xp = totalScore + (gameState.current.maxCombo * 20);
    const coins = Math.floor(xp / 10);
    
    let newLevel = playerData.level;
    let newXp = playerData.xp + xp;
    let newXpNext = playerData.xpNext;

    if(newXp >= newXpNext) {
        newLevel++;
        newXp -= newXpNext;
        newXpNext = Math.floor(newXpNext * 1.5);
    }

    const newPlayerData = {
        ...playerData,
        level: newLevel,
        xp: newXp,
        xpNext: newXpNext,
        coins: playerData.coins + coins
    };

    const newStatsData = {
        ...statsData,
        gamesPlayed: statsData.gamesPlayed + 1
    };

    setPlayerData(newPlayerData);
    setStatsData(newStatsData);
    saveGame(newPlayerData, newStatsData);

    setScores([...gameState.current.scores]);
    setTeamStats([...gameState.current.playerStats.map(s => ({ ...s }))]);
    setAccuracy(acc);
    setXpEarned(xp);
    setCoinsEarned(coins);
    
    let title = "Good Try!";
    if (gameState.current.numPlayers === 1) {
        if (acc >= 90) title = `${p1Name || 'Team 1'} — Perfect Round!`;
        else if (acc >= 70) title = `${p1Name || 'Team 1'} — Excellent!`;
        else if (gameState.current.scores[0] > 0) title = `${p1Name || 'Team 1'} — Great Effort!`;
        else title = `${p1Name || 'Team 1'} — Good Try!`;
    } else {
        if (gameState.current.scores[0] > gameState.current.scores[1]) {
            title = `${p1Name || 'Team 1'} Wins!`;
        } else if (gameState.current.scores[1] > gameState.current.scores[0]) {
            title = `${p2Name || 'Team 2'} Wins!`;
        } else {
            title = "It's a Tie!";
        }
    }
    setResultsTitle(title);
    
    playSound('win');
    setScreen('results');
  };

  const runGameEngine = () => {
    if (!gameState.current.isActive) return;
    
    animationRef.current = requestAnimationFrame(runGameEngine);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    if (gameState.current.numPlayers === 2) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([15, 15]);
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.stroke();
        ctx.restore();
    }

    // Video rendering handled by DOM element underneath the canvas now.
    
    

    graphicsState.current.bubbles.forEach(b => { b.update(); b.draw(ctx); });
    
    ctx.globalCompositeOperation = 'lighter'; 
    graphicsState.current.particles = graphicsState.current.particles.filter(p => p.life > 0);
    graphicsState.current.particles.forEach(p => { p.update(); p.draw(ctx); });
    
    graphicsState.current.shockwaves = graphicsState.current.shockwaves.filter(s => s.life > 0);
    graphicsState.current.shockwaves.forEach(s => { s.update(); s.draw(ctx); });
    ctx.globalCompositeOperation = 'source-over'; 

    graphicsState.current.floatingTexts = graphicsState.current.floatingTexts.filter(ft => ft.life > 0);
    graphicsState.current.floatingTexts.forEach(ft => { ft.update(); ft.draw(ctx); });

    // Ambient background particles
    if (Math.random() < 0.2) {
        graphicsState.current.ambientParticles.push({
            x: Math.random() * width,
            y: height + 20,
            vy: -1 - Math.random() * 2,
            size: Math.random() * 4 + 1,
            alpha: Math.random() * 0.5 + 0.1
        });
    }
    
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    graphicsState.current.ambientParticles = graphicsState.current.ambientParticles.filter(p => p.y > -20);
    graphicsState.current.ambientParticles.forEach(p => {
        p.y += p.vy;
        p.x += Math.sin(p.y * 0.01) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;
    const currentMode = trackerModeRef.current;
    const currentHandChar = handCharacterRef.current;
    const currentNoseStyle = noseStyleRef.current;

    // 1. FINGER TRACKER MODE: Keep magical glowing ball and starlight cursor
    if (currentMode === 'finger') {
      pointers.current.forEach((pointer, pIndex) => {
        if (gameState.current.numPlayers === 1) {
            pointer.color = pIndex === 0 
                ? { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' } 
                : { main: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)' };
        } else {
            pointer.color = pIndex === 0 
                ? { main: '#3b82f6', glow: 'rgba(59, 130, 246, 0.6)' } 
                : { main: '#ef4444', glow: 'rgba(239, 68, 68, 0.6)' };
        }

        if (pointer.detected) {
            if (pointer.x === -100) { 
                pointer.x = pointer.targetX; 
                pointer.y = pointer.targetY; 
                pointer.history = [{ x: pointer.x, y: pointer.y }];
            } else {
                const dx = pointer.targetX - pointer.x;
                const dy = pointer.targetY - pointer.y;
                const dist = Math.hypot(dx, dy);

                if (dist > 1.5) {
                    let alpha = 0.45;
                    if (dist < 12) alpha = 0.22;
                    else if (dist > 70) alpha = 0.65;

                    const maxStep = 110;
                    let stepX = dx * alpha;
                    let stepY = dy * alpha;
                    const stepDist = Math.hypot(stepX, stepY);
                    if (stepDist > maxStep) {
                        stepX = (stepX / stepDist) * maxStep;
                        stepY = (stepY / stepDist) * maxStep;
                    }

                    pointer.x += stepX;
                    pointer.y += stepY;
                }
            }
            
            if (gameState.current.numPlayers === 2) {
                if (pIndex === 0) {
                    pointer.x = Math.min(pointer.x, (width / 2) - 10);
                } else if (pIndex === 1) {
                    pointer.x = Math.max(pointer.x, (width / 2) + 10);
                }
            }
            
            pointer.history.push({x: pointer.x, y: pointer.y});
            if (pointer.history.length > 15) pointer.history.shift();

            if (graphicsState.current.isQuestionActive) {
                let poppedThisFrame = false;
                const effectivePlayerIndex = gameState.current.numPlayers === 1 ? 0 : pIndex;
                graphicsState.current.bubbles.forEach(b => {
                    if (poppedThisFrame || b.popped) return;
                    
                    const prevPoint = pointer.history.length > 3 ? pointer.history[pointer.history.length - 3] : null;
                    const isContinuousSwipe = prevPoint && Math.hypot(pointer.x - prevPoint.x, pointer.y - prevPoint.y) < 120;
                    
                    const isHitting = b.checkCollision(pointer.x, pointer.y, effectivePlayerIndex) ||
                                      (isContinuousSwipe && b.checkCollision(prevPoint.x, prevPoint.y, effectivePlayerIndex));
                                      
                    if (isHitting) { 
                        handlePop(b, effectivePlayerIndex); 
                        poppedThisFrame = true; 
                    }
                });
            }
        } else if (pointer.history.length > 0) {
            pointer.history.shift(); 
            if (pointer.history.length === 0) {
                pointer.x = -100; pointer.y = -100;
            }
        }

        // Draw Magical Ball / Star Trail
        if (pointer.history.length > 1) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.beginPath();
            ctx.moveTo(pointer.history[0].x, pointer.history[0].y);
            for (let i = 1; i < pointer.history.length; i++) {
                ctx.lineTo(pointer.history[i].x, pointer.history[i].y);
            }
            ctx.strokeStyle = pointer.color.glow;
            ctx.lineWidth = 30;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            
            ctx.strokeStyle = pointer.color.main;
            ctx.lineWidth = 10;
            ctx.stroke();
            ctx.restore();
            
            const tip = pointer.history[pointer.history.length - 1];
            ctx.save();
            ctx.translate(tip.x, tip.y);
            
            const pulse = 1 + Math.sin(Date.now() * 0.01) * 0.2;
            
            ctx.rotate(Date.now() * 0.003);
            ctx.scale(pulse, pulse);
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = pointer.color.main;
            ctx.shadowBlur = 25;
            
            // Intricate magic star ball cursor
            ctx.beginPath();
            ctx.moveTo(0, -25); ctx.quadraticCurveTo(6, -6, 25, 0);
            ctx.quadraticCurveTo(6, 6, 0, 25); ctx.quadraticCurveTo(-6, 6, -25, 0);
            ctx.quadraticCurveTo(-6, -6, 0, -25);
            ctx.fill();
            
            // Inner core
            ctx.fillStyle = pointer.color.main;
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
        }
      });
    }

    // 2. HAND TRACKER MODE: Stylized Character Hands (Spider-Man, Thanos, Witch, Hulk, etc.)
    else if (currentMode === 'hand') {
      const hands = detectedHandsRef.current;
      
      if (hands.length > 0) {
        hands.forEach((hand) => {
          if (!hand || hand.length < 21) return;
          const palmPx = toPx(hand[9] || hand[0], width, height, vW, vH);
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : (palmPx.x < width / 2 ? 0 : 1);

          // Multi-point strike collision (palm center + all 5 fingertips)
          const strikePoints = [
            toPx(hand[9], width, height, vW, vH),   // Palm center
            toPx(hand[4], width, height, vW, vH),   // Thumb tip
            toPx(hand[8], width, height, vW, vH),   // Index tip
            toPx(hand[12], width, height, vW, vH),  // Middle tip
            toPx(hand[16], width, height, vW, vH),  // Ring tip
            toPx(hand[20], width, height, vW, vH),  // Pinky tip
          ];

          if (graphicsState.current.isQuestionActive) {
            let poppedThisHand = false;
            graphicsState.current.bubbles.forEach(b => {
              if (poppedThisHand || b.popped) return;
              for (const pt of strikePoints) {
                if (b.checkCollision(pt.x, pt.y, effectivePlayer)) {
                  handlePop(b, effectivePlayer);
                  poppedThisHand = true;
                  break;
                }
              }
            });
          }

          // Draw chosen Character Hand directly onto the canvas with real isotropic projection
          drawCharacterHand(
            ctx,
            hand,
            currentHandChar,
            width,
            height,
            false,
            0,
            performance.now(),
            vW,
            vH
          );
        });
      } else {
        // Fallback for mouse / touch when no camera hand is detected: render full 3D character hand at pointer
        const nowTime = performance.now();
        pointers.current.forEach((pointer, pIndex) => {
          if (!pointer.detected || pointer.x < 0 || pointer.y < 0) return;
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : pIndex;
          const demoHand = buildDemoHandLandmarks(pointer.x, pointer.y, width, height, nowTime);
          const strikePoints = [9, 4, 8, 12, 16, 20].map((idx) =>
            toPx(demoHand[idx], width, height, width, height)
          );
          if (graphicsState.current.isQuestionActive) {
            let poppedThisHand = false;
            graphicsState.current.bubbles.forEach((b) => {
              if (poppedThisHand || b.popped) return;
              for (const pt of strikePoints) {
                if (b.checkCollision(pt.x, pt.y, effectivePlayer)) {
                  handlePop(b, effectivePlayer);
                  poppedThisHand = true;
                  break;
                }
              }
            });
          }
          drawCharacterHand(
            ctx,
            demoHand,
            currentHandChar,
            width,
            height,
            false,
            0,
            nowTime,
            width,
            height
          );
        });
      }
    }

    // 3. NOSE TRACKER MODE: Real Animated Sniffing Nose & Whimsical Styles
    else if (currentMode === 'nose') {
      const faces = detectedFacesRef.current;

      if (faces.length > 0) {
        faces.forEach((face) => {
          if (!face || face.length < 5) return;
          const tip = face[1];
          if (!tip) return;
          const tipPx = toPx(tip, width, height, vW, vH);
          const bridgePx = face[168] ? toPx(face[168], width, height, vW, vH) : undefined;

          // Dynamically compute nose size from eye distance
          let noseSize = 38;
          if (face[33] && face[263]) {
            const eye1 = toPx(face[33], width, height, vW, vH);
            const eye2 = toPx(face[263], width, height, vW, vH);
            const eyeDist = Math.hypot(eye2.x - eye1.x, eye2.y - eye1.y);
            noseSize = Math.max(22, Math.min(65, eyeDist * 0.38));
          }

          let angle = 0;
          if (bridgePx) {
            angle = Math.atan2(tipPx.x - bridgePx.x, tipPx.y - bridgePx.y);
          }

          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : (tipPx.x < width / 2 ? 0 : 1);

          // Nose Bubble Collision Check
          if (graphicsState.current.isQuestionActive) {
            let poppedThisFace = false;
            graphicsState.current.bubbles.forEach(b => {
              if (poppedThisFace || b.popped) return;
              const dx = b.x - tipPx.x;
              const dy = b.y - tipPx.y;
              const hitRadius = b.radius + (noseSize * 0.7);
              if (dx * dx + dy * dy < hitRadius * hitRadius) {
                if (b.playerId === undefined || b.playerId === effectivePlayer) {
                  lastNosePopTimeRef.current = Date.now();
                  handlePop(b, effectivePlayer);
                  poppedThisFace = true;
                }
              }
            });
          }

          const isPopping = (Date.now() - lastNosePopTimeRef.current) < 350;

          // Render Real Animated Nose directly over player's nose
          drawAnimatedNose({
            ctx,
            noseTip: tipPx,
            noseBridge: bridgePx,
            noseSize,
            angle,
            style: currentNoseStyle,
            isPopping,
            time: performance.now()
          });
        });
      } else {
        // Fallback for mouse / preview when no camera face is detected
        pointers.current.forEach((pointer, pIndex) => {
          if (!pointer.detected) return;
          const effectivePlayer = gameState.current.numPlayers === 1 ? 0 : pIndex;
          if (graphicsState.current.isQuestionActive) {
            graphicsState.current.bubbles.forEach(b => {
              if (!b.popped && b.checkCollision(pointer.x, pointer.y, effectivePlayer)) {
                lastNosePopTimeRef.current = Date.now();
                handlePop(b, effectivePlayer);
              }
            });
          }
          const isPopping = (Date.now() - lastNosePopTimeRef.current) < 350;
          drawAnimatedNose({
            ctx,
            noseTip: { x: pointer.x, y: pointer.y },
            noseSize: 38,
            angle: 0,
            style: currentNoseStyle,
            isPopping,
            time: performance.now()
          });
        });
      }
    }
  };

  const onHandsResults = (results: any) => {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        detectedHandsRef.current = [];
        if (gameState.current.isActive) {
            pointers.current.forEach(p => p.detected = false);
        }
        return;
    }

    // Mirror horizontal coordinates to match CSS object-cover mirrored video
    detectedHandsRef.current = results.multiHandLandmarks.map((hand: any[]) =>
        hand.map((lm: any) => ({
            x: 1.0 - lm.x,
            y: lm.y,
            z: lm.z
        }))
    );

    if (!gameState.current.isActive) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;

    pointers.current.forEach(p => p.detected = false);

    // Extract index finger tips for finger tracker
    const detected: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < detectedHandsRef.current.length; i++) {
        const landmarks = detectedHandsRef.current[i];
        if (!landmarks || landmarks.length < 9) continue;
        const tip = landmarks[8];
        if (!tip || isNaN(tip.x) || isNaN(tip.y)) continue;
        const pt = toPx(tip, width, height, vW, vH);
        detected.push(pt);
    }

    if (detected.length === 0) return;

    if (gameState.current.numPlayers === 1) {
        if (detected.length === 1) {
            const hand = detected[0];
            const p0 = pointers.current[0];
            const p1 = pointers.current[1];
            const d0 = p0.x !== -100 ? Math.hypot(hand.x - p0.x, hand.y - p0.y) : Infinity;
            const d1 = p1.x !== -100 ? Math.hypot(hand.x - p1.x, hand.y - p1.y) : Infinity;
            if (d1 < d0 && d1 < 220) {
                p1.targetX = hand.x; p1.targetY = hand.y; p1.detected = true;
            } else {
                p0.targetX = hand.x; p0.targetY = hand.y; p0.detected = true;
            }
        } else {
            detected.sort((a, b) => a.x - b.x);
            pointers.current[0].targetX = detected[0].x;
            pointers.current[0].targetY = detected[0].y;
            pointers.current[0].detected = true;
            pointers.current[1].targetX = detected[1].x;
            pointers.current[1].targetY = detected[1].y;
            pointers.current[1].detected = true;
        }
    } else {
        const leftHands = detected.filter(h => h.x < width / 2);
        const rightHands = detected.filter(h => h.x >= width / 2);
        if (leftHands.length > 0) {
            pointers.current[0].targetX = Math.min(leftHands[0].x, (width / 2) - 12);
            pointers.current[0].targetY = leftHands[0].y;
            pointers.current[0].detected = true;
        }
        if (rightHands.length > 0) {
            pointers.current[1].targetX = Math.max(rightHands[0].x, (width / 2) + 12);
            pointers.current[1].targetY = rightHands[0].y;
            pointers.current[1].detected = true;
        }
    }
  };

  const onFaceResults = (results: any) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        detectedFacesRef.current = [];
        if (gameState.current.isActive) {
            pointers.current.forEach(p => p.detected = false);
        }
        return;
    }

    // Mirror face landmarks to match mirrored video
    detectedFacesRef.current = results.multiFaceLandmarks.map((face: any[]) =>
        face.map((lm: any) => ({
            x: 1.0 - lm.x,
            y: lm.y,
            z: lm.z
        }))
    );

    if (!gameState.current.isActive) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const vW = videoRef.current?.videoWidth || 640;
    const vH = videoRef.current?.videoHeight || 480;

    pointers.current.forEach(p => p.detected = false);

    const detected: Array<{ x: number; y: number }> = [];
    detectedFacesRef.current.forEach(face => {
        if (!face || face.length < 5) return;
        const tip = face[1];
        if (!tip || isNaN(tip.x) || isNaN(tip.y)) return;
        const pt = toPx(tip, width, height, vW, vH);
        detected.push(pt);
    });

    if (detected.length === 0) return;

    if (gameState.current.numPlayers === 1) {
        pointers.current[0].targetX = detected[0].x;
        pointers.current[0].targetY = detected[0].y;
        pointers.current[0].detected = true;
    } else {
        const leftFaces = detected.filter(f => f.x < width / 2);
        const rightFaces = detected.filter(f => f.x >= width / 2);
        if (leftFaces.length > 0) {
            pointers.current[0].targetX = Math.min(leftFaces[0].x, (width / 2) - 12);
            pointers.current[0].targetY = leftFaces[0].y;
            pointers.current[0].detected = true;
        }
        if (rightFaces.length > 0) {
            pointers.current[1].targetX = Math.max(rightFaces[0].x, (width / 2) + 12);
            pointers.current[1].targetY = rightFaces[0].y;
            pointers.current[1].detected = true;
        }
    }
  };

  const setupCamera = async () => {
    try {
        setCameraError("");
        const win = window as any;

        // Safely stop any previous camera stream or MediaPipe instances
        if (cameraRef.current && cameraRef.current.stop) {
            cameraRef.current.stop();
            cameraRef.current = null;
        }
        if (handsRef.current && handsRef.current.close) {
            try { handsRef.current.close(); } catch(e) {}
            handsRef.current = null;
        }
        if (faceMeshRef.current && faceMeshRef.current.close) {
            try { faceMeshRef.current.close(); } catch(e) {}
            faceMeshRef.current = null;
        }

        // Initialize MediaPipe Hands
        if (win.Hands) {
            const hands = new win.Hands({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            hands.setOptions({ 
                maxNumHands: 2, 
                modelComplexity: 1, 
                minDetectionConfidence: 0.6, 
                minTrackingConfidence: 0.6 
            });
            hands.onResults(onHandsResults);
            handsRef.current = hands;
        }

        // Initialize MediaPipe FaceMesh
        if (win.FaceMesh) {
            const faceMesh = new win.FaceMesh({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
            });
            faceMesh.setOptions({
                maxNumFaces: 2,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            faceMesh.onResults(onFaceResults);
            faceMeshRef.current = faceMesh;
        }
        
        if (videoRef.current) {
            let stream: MediaStream | null = null;
            if (navigator?.mediaDevices?.getUserMedia) {
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ 
                        video: { 
                            facingMode: 'user',
                            width: { ideal: 640 },
                            height: { ideal: 480 },
                            frameRate: { ideal: 30 }
                        } 
                    });
                } catch (prefErr: any) {
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: 'user' }
                        });
                    } catch (fallback1Err: any) {
                        try {
                            stream = await navigator.mediaDevices.getUserMedia({
                                video: true
                            });
                        } catch (finalErr: any) {
                            console.warn("Webcam not detected or access denied:", finalErr?.name || finalErr?.message);
                            setCameraError("Webcam not detected on this device. Mouse and touch pointer mode are enabled automatically!");
                            setIsCameraActive(false);
                            return;
                        }
                    }
                }
            } else {
                setCameraError("Camera API not supported in this browser. Mouse/touch pointer mode is active.");
                setIsCameraActive(false);
                return;
            }

            if (!stream) {
                setIsCameraActive(false);
                return;
            }

            videoRef.current.srcObject = stream;
            
            await new Promise((resolve) => {
                if (videoRef.current) {
                    videoRef.current.onloadedmetadata = () => resolve(null);
                } else {
                    resolve(null);
                }
            });
            
            try {
                await videoRef.current.play();
            } catch (playErr) {
                // Autoplay will proceed on user gesture
            }
            
            let active = true;
            let isProcessing = false;
            let lastFrameTime = 0;
            let animId: number | null = null;
            const TARGET_INTERVAL_MS = 20; // ~50 FPS low-latency hand & face tracking

            const sendFrames = async (time: number) => {
                if (!active || !videoRef.current) return;
                
                if (
                    videoRef.current.readyState >= 2 && 
                    !isProcessing && 
                    (time - lastFrameTime >= TARGET_INTERVAL_MS)
                ) {
                    isProcessing = true;
                    lastFrameTime = time;
                    try {
                        const currentMode = trackerModeRef.current;
                        if (currentMode === 'nose') {
                            if (faceMeshRef.current) {
                                await faceMeshRef.current.send({ image: videoRef.current });
                            }
                        } else {
                            if (handsRef.current) {
                                await handsRef.current.send({ image: videoRef.current });
                            }
                        }
                    } catch (err) {
                        // ignore dropped frames
                    } finally {
                        isProcessing = false;
                    }
                }
                if (active) {
                    animId = requestAnimationFrame(sendFrames);
                }
            };
            animId = requestAnimationFrame(sendFrames);
            
            cameraRef.current = {
                stop: () => {
                    active = false;
                    if (animId) cancelAnimationFrame(animId);
                    stream.getTracks().forEach(t => t.stop());
                    if (videoRef.current) videoRef.current.srcObject = null;
                }
            };
            
            setIsCameraActive(true);
            setCameraError("");
        }
    } catch (e: any) {
        console.warn("Camera setup notice:", e?.message || e);
        setCameraError("Camera unavailable. Mouse and touch controls are ready!");
        setIsCameraActive(false);
    }
  };

  
  const stopCameraCleanly = () => {
    if (cameraRef.current && cameraRef.current.stop) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setIsCameraActive(false);
    if (handsRef.current && handsRef.current.close) {
      try { handsRef.current.close(); } catch (e) {}
      handsRef.current = null;
    }
    if (faceMeshRef.current && faceMeshRef.current.close) {
      try { faceMeshRef.current.close(); } catch (e) {}
      faceMeshRef.current = null;
    }
  };

  // 1-Step-Back handler: never cancels the whole app, always steps 1 screen back
  const handleStepBack = (): boolean => {
    const cur = screenRef.current;

    if (cur === 'game' || cur === 'loading' || cur === 'results' || cur === 'study') {
      gameState.current.isActive = false;
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      setScreen('setup');
      return true;
    }

    if (cur === 'editor') {
      const hasValidQs = Boolean(
        activeQuiz?.questions?.some((q) => (q.text && q.text.trim()) || q.image)
      );
      if (screenHistoryRef.current.includes('setup') || hasValidQs) {
        setScreen('setup');
        return true;
      }
      stopCameraCleanly();
      onViewChange('home', { __stepBack: true });
      return true;
    }

    if (cur === 'setup') {
      const prevScreen = screenHistoryRef.current.pop();
      if (prevScreen === 'editor') {
        setScreen('editor');
        return true;
      }
      stopCameraCleanly();
      onViewChange('home', { __stepBack: true });
      return true;
    }

    stopCameraCleanly();
    onViewChange('home', { __stepBack: true });
    return true;
  };

  const handleStepBackRef = useRef(handleStepBack);
  handleStepBackRef.current = handleStepBack;

  useEffect(() => {
    (window as any).__activeViewStepBack = () => handleStepBackRef.current();
    return () => {
      delete (window as any).__activeViewStepBack;
    };
  }, []);

  // Automatically retrieve camera when entering Setup screen
  useEffect(() => {
    if (screen === 'setup' && (!isCameraActive || !videoRef.current?.srcObject)) {
      setupCamera().catch((e) => console.warn("Initial camera setup notice:", e?.message || e));
    }
  }, [screen]);

  useEffect(() => {
    if (canvasRef.current && screen === 'game') {
        const handleMouseMove = (e: MouseEvent) => {
            if (!gameState.current.isActive) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const width = rect.width;
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            
            if (gameState.current.numPlayers === 1) {
                pointers.current[0].x = mx; pointers.current[0].y = my; pointers.current[0].detected = true; pointers.current[0].targetX = mx; pointers.current[0].targetY = my;
            } else {
                const isLeft = mx < width / 2;
                pointers.current[isLeft ? 0 : 1].x = mx; pointers.current[isLeft ? 0 : 1].y = my;
                pointers.current[isLeft ? 0 : 1].detected = true; pointers.current[isLeft ? 0 : 1].targetX = mx; pointers.current[isLeft ? 0 : 1].targetY = my;
            }
        };

        const handleTouch = (e: TouchEvent) => {
            if (!gameState.current.isActive || !e.touches.length) return;
            const rect = canvasRef.current!.getBoundingClientRect();
            const width = rect.width;
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                const tx = touch.clientX - rect.left;
                const ty = touch.clientY - rect.top;
                if (gameState.current.numPlayers === 1) {
                    pointers.current[0].x = tx; pointers.current[0].y = ty; pointers.current[0].detected = true; pointers.current[0].targetX = tx; pointers.current[0].targetY = ty;
                } else {
                    const isLeft = tx < width / 2;
                    pointers.current[isLeft ? 0 : 1].x = tx; pointers.current[isLeft ? 0 : 1].y = ty;
                    pointers.current[isLeft ? 0 : 1].detected = true; pointers.current[isLeft ? 0 : 1].targetX = tx; pointers.current[isLeft ? 0 : 1].targetY = ty;
                }
            }
        };

        const canvas = canvasRef.current;
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('touchstart', handleTouch, { passive: true });
        canvas.addEventListener('touchmove', handleTouch, { passive: true });
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('touchstart', handleTouch);
            canvas.removeEventListener('touchmove', handleTouch);
        };
    }
  }, [screen]);

  useEffect(() => {
    if (screen !== 'study' || !activeQuiz) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight' || (e.code === 'Space' && studySelectedOption !== null)) {
            if (studyIndex < activeQuiz.questions.length - 1) {
                playSound('whoosh');
                setStudyIndex(prev => prev + 1);
                setStudySelectedOption(null);
            } else {
                playSound('fanfare');
                setScreen('setup');
                setStudyIndex(0);
                setStudySelectedOption(null);
            }
        } else if (e.key === 'ArrowLeft') {
            if (studyIndex > 0) {
                playSound('whoosh');
                setStudyIndex(prev => prev - 1);
                setStudySelectedOption(null);
            }
        } else if (['1', '2', '3', '4', 'a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key)) {
            const keyMap: Record<string, number> = {
                '1': 0, 'a': 0, 'A': 0,
                '2': 1, 'b': 1, 'B': 1,
                '3': 2, 'c': 2, 'C': 2,
                '4': 3, 'd': 3, 'D': 3,
            };
            const optIdx = keyMap[e.key];
            const currentQ = activeQuiz.questions[studyIndex];
            if (optIdx !== undefined && currentQ && optIdx < currentQ.options.length && studySelectedOption === null) {
                setStudySelectedOption(optIdx);
                const isHit = optIdx === currentQ.answerIndex;
                setStudyAnswers(prev => ({ ...prev, [studyIndex]: isHit }));
                if (isHit) {
                    playSound('correct');
                    setStudyScore(prev => prev + 5);
                    setStudyStreak(prev => prev + 1);
                } else {
                    playSound('wrong');
                    setStudyStreak(0);
                }
            }
        } else if (e.key.toLowerCase() === 'r') {
            const currentQ = activeQuiz.questions[studyIndex];
            if (currentQ) {
                const parsed = parseOptionContent(currentQ.text || '');
                speakText(parsed.text || currentQ.text, true);
            }
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, studyIndex, activeQuiz]);

  return (
    <div id="game-container" className="w-full min-h-full flex-1 bg-slate-50 dark:bg-[#0f172a] text-slate-900 dark:text-white flex flex-col font-['Fredoka',sans-serif] overflow-hidden relative selection:bg-cyan-500/30 rounded-xl" ref={containerRef}>
      
      {/* In-Game HUD Top Bar (Only rendered during active gameplay — no duplicate Back/Fullscreen/Mode buttons on Setup/Editor/Study) */}
      {screen === 'game' && (
        <>
          <div className="absolute top-4 left-4 z-[60] flex items-center gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => handleStepBack()}
              className="h-11 px-4 flex items-center gap-2 rounded-2xl transition-all backdrop-blur-md border-2 border-white/40 dark:border-white/20 text-slate-900 dark:text-white bg-white/90 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-800 font-black text-sm shadow-lg cursor-pointer active:scale-95"
              title="Go 1 Step Back to Setup"
            >
              <ArrowLeft size={18} className="text-sky-600 dark:text-sky-400" />
              <span>Back</span>
            </button>
          </div>

          <div className="absolute top-4 right-4 z-[70] flex items-center gap-2 pointer-events-auto">
            {/* Live Countdown Timer Pill */}
            <div
              className={`h-11 px-4 flex items-center gap-2 rounded-2xl backdrop-blur-md border-2 shadow-lg font-black text-sm sm:text-base tabular-nums transition-colors ${
                timeLeftSeconds <= 15
                  ? 'bg-red-500/90 border-red-300 text-white animate-pulse'
                  : 'bg-white/90 dark:bg-slate-900/85 border-white/40 dark:border-white/20 text-slate-800 dark:text-white'
              }`}
              title="Match Countdown Timer"
            >
              <Timer size={18} className={timeLeftSeconds <= 15 ? 'text-white' : 'text-blue-500 dark:text-cyan-400'} />
              <span>{formatTimeMMSS(timeLeftSeconds)}</span>
            </div>

            {/* In-Game Tracker Selector Button */}
            <button
              type="button"
              onClick={() => setShowTrackerModal(true)}
              className="h-11 px-3.5 sm:px-4 flex items-center gap-2 rounded-2xl bg-white/90 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md border-2 border-white/40 dark:border-white/20 text-slate-800 dark:text-white transition-all shadow-lg active:scale-95 cursor-pointer font-bold"
              title="Choose Your AR Tracker"
            >
              <span className="text-lg">
                {trackerMode === 'finger' && '☝️'}
                {trackerMode === 'hand' && (
                  HAND_TRACKER_OPTIONS.find(h => h.id === handCharacter)?.icon || '🖐️'
                )}
                {trackerMode === 'nose' && (
                  NOSE_TRACKER_OPTIONS.find(n => n.id === noseStyle)?.icon || '👃'
                )}
              </span>
              <span className="hidden sm:inline text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                {trackerMode === 'finger' && 'Finger Ball'}
                {trackerMode === 'hand' && (
                  HAND_TRACKER_OPTIONS.find(h => h.id === handCharacter)?.name || 'Hand'
                )}
                {trackerMode === 'nose' && (
                  NOSE_TRACKER_OPTIONS.find(n => n.id === noseStyle)?.name || 'Nose'
                )}
              </span>
            </button>

            {/* End Game & View Results Button */}
            <button
              type="button"
              onClick={() => {
                setShowInGameSettings(false);
                showResults();
              }}
              className="h-11 px-3.5 sm:px-4 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm border-2 border-amber-200 shadow-lg transition-all active:scale-95 cursor-pointer"
              title="End Game & View Results"
            >
              <Trophy size={17} className="text-slate-950 shrink-0" />
              <span className="hidden md:inline uppercase tracking-wider">Finish</span>
            </button>

            {/* Settings Icon Button */}
            <button
              type="button"
              onClick={() => setShowInGameSettings(!showInGameSettings)}
              className="w-11 h-11 flex justify-center items-center rounded-2xl bg-white/90 dark:bg-slate-900/85 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md border-2 border-white/40 dark:border-white/20 text-slate-800 dark:text-white transition-all shadow-lg active:scale-95 cursor-pointer"
              title="In-Game Settings"
            >
              <Settings size={19} />
            </button>

            <FullscreenButton targetId="game-container" className="h-11 rounded-2xl bg-white/90 dark:bg-slate-900/85 text-slate-900 dark:text-white border-2 border-white/40" />
          </div>
        </>
      )}

      {screen === 'study' && activeQuiz && (
        <div 
          className="absolute inset-0 z-[100] flex flex-col bg-gradient-to-br from-[#061026] via-[#0b1b3d] to-[#040b1a] text-white overflow-hidden select-none font-['Fredoka',sans-serif]" 
          id="study-container"
        >
          {/* Animated Ambient Undersea Glow & Floating Bubble Highlights */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/25 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/25 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-[120px]" />
            {[15, 32, 50, 68, 85].map((pct, idx) => (
              <div
                key={idx}
                className="absolute rounded-full border border-cyan-400/35 bg-cyan-400/10 backdrop-blur-[1px]"
                style={{
                  left: `${pct}%`,
                  bottom: `${-20 + (idx * 18)}px`,
                  width: `${26 + (idx % 3) * 16}px`,
                  height: `${26 + (idx % 3) * 16}px`,
                  animation: `bounce ${4 + idx}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>

          {/* Top Navigation Header: Back, Stepper, Read Aloud, and Fullscreen */}
          <div className="w-full relative z-20 flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10 bg-slate-950/40 backdrop-blur-md shrink-0">
            {/* Left: Back Button */}
            <button 
              type="button"
              onClick={() => {
                playSound('whoosh');
                setScreen('setup');
                setStudyIndex(0);
                setStudySelectedOption(null);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl shadow-sm text-white font-black text-sm sm:text-base transition cursor-pointer hover:scale-105 active:scale-95"
            >
              <ArrowLeft size={20} className="text-cyan-400" />
              <span>Back to Setup</span>
            </button>

            {/* Center: Question Stepper Pills */}
            <div className="flex items-center gap-2 max-w-[50vw] sm:max-w-[45vw] overflow-x-auto py-1 px-1 custom-scrollbar">
              <span className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-black text-xs sm:text-sm shrink-0">
                <span>🫧 Question</span>
                <span className="text-white">{studyIndex + 1}/{activeQuiz.questions.length}</span>
              </span>

              <div className="flex items-center gap-1.5">
                {activeQuiz.questions.map((_, idx) => {
                  const isCurrent = idx === studyIndex;
                  const isAnswered = studyAnswers[idx] !== undefined;
                  const wasCorrect = studyAnswers[idx] === true;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        playSound('bubble-click');
                        setStudyIndex(idx);
                        setStudySelectedOption(null);
                      }}
                      className={`min-w-[2.25rem] h-9 px-2 rounded-xl font-black text-xs sm:text-sm border transition cursor-pointer shrink-0 flex items-center justify-center gap-1 ${
                        isCurrent
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-500 border-amber-300 text-slate-950 scale-110 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                          : isAnswered
                          ? wasCorrect
                            ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 hover:bg-emerald-500/40'
                            : 'bg-rose-500/30 border-rose-400 text-rose-300 hover:bg-rose-500/40'
                          : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20 hover:text-white'
                      }`}
                      title={`Go to Question ${idx + 1}`}
                    >
                      <span>{idx + 1}</span>
                      {isAnswered && (
                        <span className="text-[10px]">{wasCorrect ? '✓' : '•'}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: Read Aloud + Fullscreen Button */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playSound('bubble-click');
                  const currentStudyQ = activeQuiz.questions[studyIndex];
                  const qParsed = parseOptionContent(currentStudyQ?.text || '');
                  speakText(qParsed.text || currentStudyQ?.text, true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-200 text-xs sm:text-sm font-black cursor-pointer transition active:scale-95 shadow-md shadow-cyan-950/30"
                title="Read question aloud (R)"
              >
                <span>🔊 Read Aloud</span>
              </button>

              <FullscreenButton 
                targetId="study-container" 
                showLabel={true}
                className="px-4 sm:px-5 py-2.5 rounded-2xl !bg-white hover:!bg-slate-100 border-2 border-slate-300 border-b-4 border-b-slate-400 !text-black font-black text-xs sm:text-sm transition cursor-pointer shadow-md active:translate-y-0.5 flex items-center gap-2"
              />
            </div>
          </div>

          {/* Main Question & 2x2 Square Options Content */}
          <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 w-full max-w-5xl mx-auto overflow-y-auto custom-scrollbar relative z-10">
            {activeQuiz.questions.length > 0 ? (
              <>
                {(() => {
                  const currentStudyQ = activeQuiz.questions[studyIndex];
                  const parsedStudyQ = parseOptionContent(currentStudyQ?.text || '');
                  const studyQImg = parsedStudyQ.imageUrl || currentStudyQ?.image || null;
                  const qDisplayText = parsedStudyQ.text || currentStudyQ?.text;

                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto min-h-[140px] sm:min-h-[180px]">
                      {studyQImg && (
                        <div className="w-36 h-36 sm:w-48 sm:h-48 rounded-3xl bg-white/95 p-3 shadow-2xl border-4 border-cyan-400/50 flex items-center justify-center overflow-hidden mb-4">
                          <img 
                            src={studyQImg} 
                            alt={qDisplayText || 'Question Media'} 
                            className="w-full h-full object-contain rounded-2xl" 
                          />
                        </div>
                      )}
                      {qDisplayText && (
                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight text-center max-w-4xl break-words drop-shadow-lg">
                          {qDisplayText}
                        </h1>
                      )}
                    </div>
                  );
                })()}

                {/* Options - SQUARE 2x2 ABCD GRID LAYOUT (Never a single straight line; zero overlapping) */}
                {(() => {
                  const currentStudyQ = activeQuiz.questions[studyIndex];
                  return (
                    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                      {currentStudyQ?.options.map((opt, i) => {
                        if (!opt || opt.trim() === '') return null;
                        const isSelected = studySelectedOption === i;
                        const isCorrect = i === currentStudyQ.answerIndex;
                        const showAsCorrect = studySelectedOption !== null && isCorrect;
                        const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;
                        const parsed = parseOptionContent(opt);
                        const letter = ['A', 'B', 'C', 'D'][i] || `${i + 1}`;

                        let btnBorder = 'border-white/20 hover:border-cyan-400 bg-white/10 hover:bg-white/20 text-white shadow-lg hover:shadow-cyan-500/20 hover:scale-[1.02]';
                        if (studySelectedOption !== null) {
                          if (showAsCorrect) {
                            btnBorder = 'bg-emerald-500/90 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.55)] scale-[1.02] ring-4 ring-emerald-300/40 z-10';
                          } else if (showAsIncorrect) {
                            btnBorder = 'bg-rose-500/90 border-rose-300 text-white shadow-[0_0_25px_rgba(244,63,94,0.45)] ring-2 ring-rose-400/40 animate-pulse';
                          } else {
                            btnBorder = 'bg-white/5 border-white/10 text-white/35 opacity-40 cursor-not-allowed';
                          }
                        }

                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              if (studySelectedOption === null) {
                                setStudySelectedOption(i);
                                const isHit = i === currentStudyQ.answerIndex;
                                setStudyAnswers(prev => ({ ...prev, [studyIndex]: isHit }));
                                if (isHit) {
                                  playSound('correct');
                                  setStudyScore(prev => prev + 5);
                                  setStudyStreak(prev => prev + 1);
                                } else {
                                  playSound('wrong');
                                  setStudyStreak(0);
                                }
                              }
                            }}
                            disabled={studySelectedOption !== null}
                            className={`relative p-5 sm:p-6 md:p-7 rounded-3xl border-3 border-b-[6px] sm:border-b-[8px] text-left font-black transition-all cursor-pointer min-h-[90px] sm:min-h-[110px] md:min-h-[120px] flex items-center gap-4 active:translate-y-1 ${btnBorder}`}
                          >
                            <span className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black shrink-0 shadow-md ${
                              showAsCorrect
                                ? 'bg-emerald-400 text-slate-950 font-black'
                                : showAsIncorrect
                                ? 'bg-rose-400 text-slate-950 font-black'
                                : 'bg-cyan-500/25 border-2 border-cyan-400/50 text-cyan-200'
                            }`}>
                              {letter}
                            </span>

                            <div className="flex-1 flex items-center gap-3.5 min-w-0 overflow-hidden">
                              {parsed.imageUrl && (
                                <img
                                  src={parsed.imageUrl}
                                  alt={parsed.text || `Option ${letter}`}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-contain bg-white/95 p-2 border-2 border-cyan-400/40 shrink-0 shadow-md"
                                />
                              )}
                              {parsed.text ? (
                                <span className="text-xl sm:text-2xl md:text-3xl font-black text-white break-words leading-snug line-clamp-3">
                                  {parsed.text}
                                </span>
                              ) : !parsed.imageUrl ? (
                                <span className="text-xl sm:text-2xl md:text-3xl font-black text-white break-words leading-snug line-clamp-3">
                                  {opt}
                                </span>
                              ) : null}
                            </div>

                            {showAsCorrect && (
                              <span className="text-xs sm:text-sm md:text-base font-black px-3.5 py-1.5 rounded-xl bg-emerald-400 text-slate-950 shrink-0 shadow-md animate-bounce">
                                ✓ +5 PTS
                              </span>
                            )}
                            {showAsIncorrect && (
                              <span className="text-xs sm:text-sm md:text-base font-black px-3.5 py-1.5 rounded-xl bg-rose-400 text-slate-950 shrink-0 shadow-md">
                                ✗ INCORRECT
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Feedback Banner & Navigation Controls */}
                {(() => {
                  const currentStudyQ = activeQuiz.questions[studyIndex];
                  return (
                    <div className="w-full max-w-4xl mx-auto mt-6 flex flex-col items-center gap-4">
                      {studySelectedOption !== null && (() => {
                        const isCorrect = studySelectedOption === currentStudyQ.answerIndex;
                        const correctOptRaw = currentStudyQ.options[currentStudyQ.answerIndex] || '';
                        const correctParsed = parseOptionContent(correctOptRaw);
                        const correctLetter = ['A', 'B', 'C', 'D'][currentStudyQ.answerIndex] || 'A';

                        return (
                          <div className={`w-full p-4 sm:p-5 rounded-3xl border-2 text-center font-black animate-in fade-in duration-200 flex items-center justify-center flex-wrap gap-3 shadow-xl ${
                            isCorrect
                              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-emerald-500/20'
                              : 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-rose-500/20'
                          }`}>
                            {isCorrect ? (
                              <span className="text-lg sm:text-2xl">
                                🎉 Bubble-tastic! Option {correctLetter}{correctParsed.text ? `: "${correctParsed.text}"` : ''} is the correct answer (+5 points)!
                              </span>
                            ) : (
                              <span className="text-lg sm:text-2xl">
                                💧 Nice try! Option {correctLetter}{correctParsed.text ? `: "${correctParsed.text}"` : ''} is the correct answer!
                              </span>
                            )}
                          </div>
                        );
                      })()}

                      <div className="w-full flex items-center justify-between gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (studyIndex > 0) {
                              playSound('whoosh');
                              setStudyIndex(studyIndex - 1);
                              setStudySelectedOption(null);
                            }
                          }}
                          disabled={studyIndex === 0}
                          className="px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed border border-white/20 text-white font-black text-sm sm:text-base transition cursor-pointer"
                        >
                          ← Previous
                        </button>

                        <div className="flex items-center gap-3">
                          {studyScore > 0 && (
                            <span className="text-xs sm:text-sm font-black px-4 py-2 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                              ⭐ {studyScore} PTS {studyStreak > 1 ? `· 🔥 ${studyStreak} Streak!` : ''}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (studyIndex < activeQuiz.questions.length - 1) {
                              playSound('whoosh');
                              setStudyIndex(studyIndex + 1);
                              setStudySelectedOption(null);
                            } else {
                              playSound('fanfare');
                              setScreen('setup');
                              setStudyIndex(0);
                              setStudySelectedOption(null);
                            }
                          }}
                          className={`px-8 sm:px-10 py-3 sm:py-3.5 bg-gradient-to-r from-cyan-400 via-sky-500 to-blue-600 hover:from-cyan-300 hover:to-blue-500 text-slate-950 font-black text-base sm:text-lg rounded-2xl shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all transform hover:scale-105 active:scale-95 cursor-pointer ${
                            studySelectedOption === null ? 'opacity-85' : 'animate-pulse'
                          }`}
                        >
                          {studyIndex < activeQuiz.questions.length - 1 ? 'Next Question →' : 'Finish Study 🏆'}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-slate-400 text-2xl font-bold">No questions in this quiz!</div>
            )}
          </div>
        </div>
      )}

      {screen === 'game' && showInGameSettings && (
          <div className="absolute right-4 top-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-2 border-blue-500 rounded-3xl p-6 shadow-2xl w-80 sm:w-96 pointer-events-auto z-[80]">
              <div className="flex justify-between items-center mb-5">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Settings size={20} className="text-blue-500" />
                    <span>Game Settings</span>
                  </h3>
                  <button onClick={() => setShowInGameSettings(false)} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition-colors cursor-pointer">
                      <X size={16} />
                  </button>
              </div>
              <div className="flex flex-col gap-5">
                  {/* Timer 1-10 Minutes Slider */}
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold bg-slate-100/80 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1.5 text-sm font-black">
                            <Timer size={16} className="text-blue-500" />
                            <span>Timer</span>
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500 text-white text-xs font-black">
                            {gameDurationMinutes} {gameDurationMinutes === 1 ? 'Minute' : 'Minutes'}
                          </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={gameDurationMinutes}
                        onChange={(e) => handleSetTimerMinutes(Number(e.target.value))}
                        className="w-full h-2 bg-slate-300 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5">
                        <span>1m</span>
                        <span>3m</span>
                        <span>5m</span>
                        <span>8m</span>
                        <span>10m</span>
                      </div>
                  </div>

                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                      <div className="flex justify-between items-center">
                          <span>Bubble Speed</span>
                          <div className="flex gap-1.5">
                                <button onClick={() => handleSetSpeed(0.25)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${speed === 0.25 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Slow</button>
                                <button onClick={() => handleSetSpeed(1)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${speed === 1 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Normal</button>
                                <button onClick={() => handleSetSpeed(2.5)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${speed === 2.5 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Fast</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                      <div className="flex justify-between items-center">
                          <span>Bubble Size</span>
                          <div className="flex gap-1.5">
                                <button onClick={() => handleSetBubbleSize(0.5)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${bubbleSize === 0.5 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Small</button>
                                <button onClick={() => handleSetBubbleSize(1)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${bubbleSize === 1 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Normal</button>
                                <button onClick={() => handleSetBubbleSize(2)} className={`px-3 py-1 rounded-full text-xs font-black transition-colors cursor-pointer ${bubbleSize === 2 ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}>Big</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                        <div className="flex justify-between items-center">
                            <span>Twist Mode</span>
                            <button onClick={() => handleSetTwistEnabled(!twistEnabled)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${twistEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${twistEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                  </div>
                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold">
                        <div className="flex justify-between items-center">
                            <span>Voice Narration</span>
                            <button onClick={() => handleSetVoiceEnabled(!voiceEnabled)} className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${voiceEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${voiceEnabled ? 'left-7' : 'left-1'}`}></div>
                            </button>
                        </div>
                  </div>

                  <div className="flex flex-col gap-2 text-slate-800 dark:text-white font-bold pt-2 border-t border-slate-200 dark:border-slate-800">
                      <span>Tracker Mode</span>
                      <button 
                        onClick={() => {
                          setShowInGameSettings(false);
                          setShowTrackerModal(true);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-sm shadow-md flex items-center justify-between cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <span className="flex items-center gap-2">
                          <span>{trackerMode === 'finger' ? '☝️' : trackerMode === 'hand' ? '🖐️' : '👃'}</span>
                          <span className="capitalize">{trackerMode} Tracker</span>
                        </span>
                        <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-bold">Change</span>
                      </button>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => {
                          setShowInGameSettings(false);
                          showResults();
                        }}
                        className="w-full py-2.5 px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 dark:text-red-400 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <Flag size={16} />
                        End Game & View Results
                      </button>
                  </div>
              </div>
          </div>
      )}

      {screen === 'game' && (
        <div className="absolute bottom-4 right-4 z-[50] flex flex-col items-end pointer-events-none">
            <div className="bg-white/85 dark:bg-black/65 backdrop-blur-md rounded-2xl px-5 py-2.5 shadow-lg border border-slate-200 dark:border-white/20">
                <div className="text-slate-500 dark:text-slate-400 font-bold text-xs tracking-widest uppercase mb-0.5">Question</div>
                <div className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white flex items-baseline gap-1">
                    <span>{currentQuestionIndex + 1}</span>
                    <span className="text-lg text-slate-400 dark:text-slate-500">/{gameState.current.questions.length}</span>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .glass-panel {
            background: rgba(255, 255, 255, 0.7);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
        }
        .dark .glass-panel {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .btn-primary {
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            transition: all 0.2s;
        }
        .btn-primary:hover {
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 10px 25px rgba(139, 92, 246, 0.5);
        }
        .loading-bar-container {
            width: 300px; height: 20px; background: rgba(0,0,0,0.3);
            border-radius: 10px; overflow: hidden; border: 2px solid rgba(255,255,255,0.2);
        }
        .loading-bar-fill {
            height: 100%; background: linear-gradient(90deg, #4ade80, #3b82f6);
            transition: width 0.1s linear;
        }
        @keyframes popIn {
            0% { transform: scale(0); opacity: 0; }
            80% { transform: scale(1.2); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-pop { animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
            10%, 90% { transform: translate3d(-10px, 0, 0); }
            20%, 80% { transform: translate3d(15px, 0, 0); }
            30%, 50%, 70% { transform: translate3d(-20px, 0, 0); }
            40%, 60% { transform: translate3d(20px, 0, 0); }
        }
      `}</style>
      
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover z-0 scale-x-[-1]" autoPlay playsInline muted></video>

      {/* Screen: Intro */}
      {screen === 'intro' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900">
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] tracking-wider">
                BUBBLE ACADEMY
            </h1>
            <p className="mt-4 text-xl text-slate-400">Loading Magic Engines...</p>
        </div>
      )}

      {/* Screen: Editor */}
      {screen === 'editor' && activeQuiz && (
        <QuizEditor 
          quiz={activeQuiz} 
          onSave={saveQuiz} 
          onCancel={() => handleStepBack()} 
          onPreviewPlay={(updatedQuiz) => {
            setActiveQuiz(updatedQuiz);
            navigateScreen('setup');
          }}
          folders={folders}
        />
      )}

      {/* Screen: Unified Minimalist 3D Setup */}
      {screen === 'setup' && activeQuiz && (
        <UnifiedGameSetup
          title="BUBBLE POP 3D"
          containerId="game-container"
          questionCount={activeQuiz.questions.length}
          onBack={() => handleStepBack()}
          onOpenGameSwitcher={() => setShowModeModal(true)}
          onOpenQuizEditor={() => navigateScreen('editor')}
          playerModeOptions={[
            { id: 1, label: '1 PLAYER', icon: '🫧' },
            { id: 2, label: '2 PLAYERS', icon: '🔵⚡🔴' }
          ]}
          selectedPlayerMode={numPlayers}
          onSelectPlayerMode={(val: number) => setNumPlayers(val)}
          playerNames={
            numPlayers === 2
              ? [
                  { id: 'p1', badge: 'P1', value: p1Name, placeholder: 'PLAYER 1', onChange: setP1Name, colorScheme: 'blue' },
                  { id: 'p2', badge: 'P2', value: p2Name, placeholder: 'PLAYER 2', onChange: setP2Name, colorScheme: 'red' }
                ]
              : [
                  { id: 'p1', badge: 'P1', value: p1Name, placeholder: 'PLAYER 1', onChange: setP1Name, colorScheme: 'blue' }
                ]
          }
          timerTitle="Timer (Minutes)"
          timerValue={gameDurationMinutes * 60}
          timerLabelDisplay={`${gameDurationMinutes} ${gameDurationMinutes === 1 ? 'Minute' : 'Minutes'}`}
          timerOptions={[
            { label: '1 Minute', sec: 60 },
            { label: '2 Minutes', sec: 120 },
            { label: '3 Minutes', sec: 180 },
            { label: '5 Minutes', sec: 300 },
            { label: '10 Minutes', sec: 600 }
          ]}
          onTimerChange={(sec) => handleSetTimerMinutes(Math.max(1, Math.round(sec / 60)))}
          startLabel={`START ${numPlayers === 2 ? '2P BATTLE' : 'ARENA'}`}
          onStart={() => startGameMode(numPlayers)}
          onStudy={() => navigateScreen('study')}
        >
          {/* 1. AR TRACKER MODE, LIVE CAMERA RETRIEVAL & CHARACTER */}
          <div className="p-4 rounded-3xl bg-sky-50/95 border-2 border-sky-200 border-b-4 border-b-sky-300 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-sky-950">
                  🎯 AR TRACKER &amp; CAMERA
                </span>
                <button
                  type="button"
                  onClick={() => setupCamera()}
                  className={`px-3 py-1 rounded-xl text-xs font-black border transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
                    isCameraActive
                      ? 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-900'
                      : 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white animate-pulse'
                  }`}
                  title="Retrieve or reconnect your webcam for AR tracking"
                >
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-500' : 'bg-amber-300'}`} />
                  <span>{isCameraActive ? '📷 Camera Active (Refresh)' : '📷 Retrieve Camera'}</span>
                </button>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-sky-200">
                {([
                  { id: 'finger' as const, label: '☝️ FINGER' },
                  { id: 'hand' as const, label: '🖐️ HAND' },
                  { id: 'nose' as const, label: '👃 NOSE' }
                ]).map(tr => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      setTrackerMode(tr.id);
                      detectedHandsRef.current = [];
                      detectedFacesRef.current = [];
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      trackerMode === tr.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-700 hover:bg-sky-50'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Camera & Interactive AR Tracker Preview Box */}
            <TrackerLivePreview
              videoRef={videoRef}
              isCameraActive={isCameraActive}
              trackerMode={trackerMode}
              handCharacter={handCharacter}
              noseStyle={noseStyle}
              detectedHandsRef={detectedHandsRef}
              detectedFacesRef={detectedFacesRef}
              onPopSound={() => playSound('pop')}
              onRetryCamera={() => setupCamera()}
            />

            {trackerMode === 'hand' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {HAND_TRACKER_OPTIONS.map((c) => {
                  const isSel = handCharacter === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setHandCharacter(c.id)}
                      className={`p-2.5 rounded-2xl border-2 border-b-4 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isSel
                          ? 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-300 border-b-blue-950 text-white -translate-y-0.5 shadow-md'
                          : 'bg-white hover:bg-sky-50 border-sky-200 border-b-sky-300 text-slate-900'
                      }`}
                    >
                      <span className="text-lg">{c.icon}</span>
                      <span className="text-xs font-black uppercase truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {trackerMode === 'nose' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                {NOSE_TRACKER_OPTIONS.map((n) => {
                  const isSel = noseStyle === n.id;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setNoseStyle(n.id)}
                      className={`p-2.5 rounded-2xl border-2 border-b-4 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isSel
                          ? 'bg-gradient-to-b from-pink-500 to-rose-600 border-pink-300 border-b-rose-900 text-white -translate-y-0.5 shadow-md'
                          : 'bg-white hover:bg-sky-50 border-sky-200 border-b-sky-300 text-slate-900'
                      }`}
                    >
                      <span className="text-lg">{n.icon}</span>
                      <span className="text-xs font-black uppercase truncate">{n.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. SPEED, BUBBLE SIZE & ARENA THEME ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="p-4 rounded-3xl bg-purple-50/90 border-2 border-purple-200 border-b-4 border-b-purple-300 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-purple-950">
                  ⚡ SPEED &amp; SIZE
                </span>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-purple-200">
                  {[
                    { label: 'SMALL', val: 0.5 },
                    { label: 'NORMAL', val: 1 },
                    { label: 'BIG', val: 2 }
                  ].map(bs => (
                    <button
                      key={bs.label}
                      type="button"
                      onClick={() => handleSetBubbleSize(bs.val)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        bubbleSize === bs.val ? 'bg-purple-600 text-white' : 'text-slate-700 hover:bg-purple-50'
                      }`}
                    >
                      {bs.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'SLOW', val: 0.25 },
                  { label: 'NORMAL', val: 1 },
                  { label: 'FAST', val: 2.5 }
                ].map(sp => (
                  <button
                    key={sp.label}
                    type="button"
                    onClick={() => handleSetSpeed(sp.val)}
                    className={`py-2.5 rounded-2xl font-black text-xs sm:text-sm border-2 border-b-[5px] transition cursor-pointer ${
                      speed === sp.val
                        ? 'bg-gradient-to-b from-purple-500 to-indigo-600 border-purple-300 border-b-indigo-950 text-white shadow-sm -translate-y-0.5'
                        : 'bg-white hover:bg-purple-50 border-purple-200 border-b-purple-300 text-slate-900'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-amber-50/90 border-2 border-amber-200 border-b-4 border-b-amber-300 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-950">
                  🌈 THEME
                </span>
                <button
                  type="button"
                  onClick={() => handleSetVoiceEnabled(!voiceEnabled)}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition cursor-pointer ${
                    voiceEnabled ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 border border-amber-200'
                  }`}
                >
                  {voiceEnabled ? '🔊 VOICE ON' : '🔇 VOICE OFF'}
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { id: 'theme-sky', name: 'SKY', icon: '☁️' },
                  { id: 'theme-ocean', name: 'OCEAN', icon: '🌊' },
                  { id: 'theme-space', name: 'SPACE', icon: '🚀' },
                  { id: 'theme-jungle', name: 'JUNGLE', icon: '🌴' },
                  { id: 'theme-sunset', name: 'SUNSET', icon: '🌅' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTheme(t.id)}
                    className={`py-2 px-1 rounded-2xl font-black text-[11px] border-2 border-b-[5px] transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      selectedTheme === t.id
                        ? 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-200 border-b-amber-700 text-slate-950 -translate-y-0.5'
                        : 'bg-white hover:bg-amber-50 border-amber-200 border-b-amber-300 text-slate-800'
                    }`}
                  >
                    <span className="text-base">{t.icon}</span>
                    <span>{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </UnifiedGameSetup>
      )}

      {/* Screen: Loading */}
      {screen === 'loading' && (
        <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-[spin_120s_linear_infinite]"></div>
            <div className="text-6xl mb-8 animate-bounce z-10">🫧</div>
            <h2 className="text-3xl font-bold mb-2 z-10 text-slate-800 dark:text-white">Loading Camera & AI...</h2>
            {cameraError ? (
                <div className="flex flex-col items-center z-10 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl max-w-lg text-center">
                    <p className="text-red-500 font-bold mb-2 text-xl">Camera Error</p>
                    <p className="text-red-400 mb-6">{cameraError}</p>
                    <div className="flex gap-4">
                        <button onClick={() => {
                            if (cameraRef.current && cameraRef.current.stop) { cameraRef.current.stop(); setIsCameraActive(false); }
                            setScreen('setup');
                        }} className="px-6 py-3 bg-slate-800 text-white rounded-full font-bold hover:bg-slate-700 transition-colors">
                            Back to Setup
                        </button>
                        <button onClick={() => continueStartGame(numPlayers)} className="px-6 py-3 bg-blue-500 text-white rounded-full font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30">
                            Play with Mouse Instead
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <p className="text-slate-400 mb-8 z-10">Please grant camera permissions.</p>
                    <div className="loading-bar-container z-10">
                        <div className="loading-bar-fill animate-[pulse_2s_infinite]" style={{ width: '100%' }}></div>
                    </div>
                </>
            )}
        </div>
      )}

      {/* Screen: Game */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 flex flex-col">
            {!isCameraActive && <div className={`absolute inset-0 -z-10 pointer-events-none transition-colors duration-1000 ${
    selectedTheme === "theme-ocean" ? "bg-gradient-to-b from-sky-600 to-cyan-600 dark:from-sky-800 dark:to-cyan-900" :
    selectedTheme === "theme-space" ? "bg-gradient-to-b from-slate-900 to-indigo-950" :
    selectedTheme === "theme-jungle" ? "bg-gradient-to-b from-green-600 to-emerald-400 dark:from-green-900 dark:to-emerald-800" :
    selectedTheme === "theme-sunset" ? "bg-gradient-to-b from-orange-400 to-yellow-300 dark:from-orange-800 dark:to-yellow-700" :
    "bg-[radial-gradient(circle_at_50%_100%,#dbeafe,#f8fafc)] dark:bg-[radial-gradient(circle_at_50%_100%,#1e3a8a,#0f172a)]"
}`}></div>}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10"></canvas>
            
            {/* Frozen Overlays */}
            {frozenTeams[0] && (
                <div className="absolute top-0 left-0 w-1/2 h-full bg-cyan-400/20 backdrop-blur-[2px] border-r-4 border-cyan-300/50 flex flex-col items-center justify-center pointer-events-none z-[15]">
                    <span className="text-6xl md:text-8xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">❄️</span>
                    <span className="font-black text-white text-3xl md:text-5xl uppercase tracking-widest mt-4 drop-shadow-md">FROZEN</span>
                </div>
            )}
            {frozenTeams[1] && (
                <div className="absolute top-0 right-0 w-1/2 h-full bg-cyan-400/20 backdrop-blur-[2px] border-l-4 border-cyan-300/50 flex flex-col items-center justify-center pointer-events-none z-[15]">
                    <span className="text-6xl md:text-8xl animate-bounce drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]">❄️</span>
                    <span className="font-black text-white text-3xl md:text-5xl uppercase tracking-widest mt-4 drop-shadow-md">FROZEN</span>
                </div>
            )}

            <div className="absolute inset-0 flex flex-col justify-between p-6 pointer-events-none z-20 pt-20">
                <div className="flex justify-center items-start w-full gap-4 relative">
                    <div className="absolute left-1/2 -translate-x-1/2 top-0 pointer-events-auto">
                        {countdown !== null && (
                            <div className="glass-panel bg-blue-100/90 dark:bg-blue-900/80 rounded-full px-8 py-3 border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                                <span className="text-2xl font-bold text-blue-200">Bubbles in <span className="text-slate-800 dark:text-white text-3xl font-black">{countdown}</span>...</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Removed duplicate Exit button (top-left Back button handles 1-step-back to Setup) */}

                {/* Bottom HUD: Improved Player 1 Scoreboard, Question Prompt, Player 2 Scoreboard */}
                <div className="flex justify-center items-end w-full gap-2 sm:gap-3 md:gap-4 pointer-events-none mt-auto px-2 sm:px-12 lg:px-20 relative z-30">
                    {/* Player 1 Scoreboard */}
                    <div className={`bg-white/90 dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 min-w-[88px] sm:min-w-[125px] md:min-w-[160px] border-2 border-blue-400/60 dark:border-blue-500/50 flex flex-col items-center shadow-2xl backdrop-blur-md pointer-events-auto shrink-0 mb-2 transition-transform hover:scale-105 relative overflow-hidden ${frozenTeams[0] ? 'opacity-70 grayscale border-cyan-400' : ''}`}>
                        {frozenTeams[0] && <div className="absolute inset-0 bg-cyan-400/20 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none"><span className="text-4xl absolute opacity-50">❄️</span></div>}
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow">P1</span>
                            <div className="px-2.5 py-0.5 rounded-full bg-blue-500 text-[10px] sm:text-xs md:text-sm font-black text-white shadow-inner uppercase tracking-wider truncate max-w-[90px] sm:max-w-[110px]">
                                {numPlayers === 2 && scores[0] > scores[1] ? '👑 ' : ''}{p1Name || 'Team 1'}
                            </div>
                        </div>
                        <div className="text-2xl sm:text-4xl md:text-5xl font-black text-blue-600 dark:text-blue-400 drop-shadow-sm tabular-nums tracking-tighter leading-none my-0.5">
                            {scores[0]}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black">
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">✓ {teamStats[0]?.correctPops || 0}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400">✗ {teamStats[0]?.wrongPops || 0}</span>
                        </div>
                    </div>

                    <div className="glass-panel bg-white/90 dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl w-full max-w-4xl p-2.5 sm:p-4 md:p-6 text-center border-t-4 border-indigo-500 shadow-2xl relative overflow-hidden backdrop-blur-xl mb-2 pointer-events-auto flex-1">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5">
                            {questionImage && (
                                <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl bg-white/95 dark:bg-slate-800/95 p-1.5 shadow-lg border-2 border-indigo-400/50 flex items-center justify-center shrink-0 overflow-hidden">
                                    <img
                                        src={questionImage}
                                        alt={questionText || "Question Media"}
                                        className="w-full h-full object-contain rounded-xl"
                                    />
                                </div>
                            )}
                            {questionText && (
                                <h1 className="text-base sm:text-xl md:text-3xl font-black text-slate-800 dark:text-white leading-snug sm:leading-relaxed drop-shadow-md">
                                    {questionText}
                                </h1>
                            )}
                        </div>
                        
                        {showCombo && (
                            <div key={`combo-${combo}`} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-center animate-pop">
                                <div className="text-[8px] sm:text-[10px] md:text-xs font-bold text-yellow-400 uppercase tracking-widest">Combo</div>
                                <div className="text-base sm:text-xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-orange-500">x{combo}</div>
                            </div>
                        )}
                    </div>
                    
                    {numPlayers === 2 ? (
                        <div className={`bg-white/90 dark:bg-slate-900/90 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 min-w-[88px] sm:min-w-[125px] md:min-w-[160px] border-2 border-rose-400/60 dark:border-rose-500/50 flex flex-col items-center shadow-2xl backdrop-blur-md pointer-events-auto shrink-0 mb-2 transition-transform hover:scale-105 relative overflow-hidden ${frozenTeams[1] ? 'opacity-70 grayscale border-cyan-400' : ''}`}>
                            {frozenTeams[1] && <div className="absolute inset-0 bg-cyan-400/20 backdrop-blur-[2px] z-10 flex items-center justify-center pointer-events-none"><span className="text-4xl absolute opacity-50">❄️</span></div>}
                            <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-rose-600 text-white text-[10px] sm:text-xs font-black flex items-center justify-center shadow">P2</span>
                                <div className="px-2.5 py-0.5 rounded-full bg-rose-500 text-[10px] sm:text-xs md:text-sm font-black text-white shadow-inner uppercase tracking-wider truncate max-w-[90px] sm:max-w-[110px]">
                                    {scores[1] > scores[0] ? '👑 ' : ''}{p2Name || 'Team 2'}
                                </div>
                            </div>
                            <div className="text-2xl sm:text-4xl md:text-5xl font-black text-rose-500 dark:text-rose-400 drop-shadow-sm tabular-nums tracking-tighter leading-none my-0.5">
                                {scores[1]}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-black">
                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">✓ {teamStats[1]?.correctPops || 0}</span>
                                <span className="px-1.5 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400">✗ {teamStats[1]?.wrongPops || 0}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="hidden sm:block min-w-[100px] md:min-w-[140px] shrink-0"></div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Screen: Results (Real Winner & Team Stats Breakdown) */}
      {screen === 'results' && (() => {
        const p1Stat = teamStats[0] || { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 };
        const p2Stat = teamStats[1] || { correctPops: 0, wrongPops: 0, streak: 0, maxCombo: 0 };
        const p1Total = p1Stat.correctPops + p1Stat.wrongPops;
        const p2Total = p2Stat.correctPops + p2Stat.wrongPops;
        const p1Acc = p1Total > 0 ? Math.round((p1Stat.correctPops / p1Total) * 100) : accuracy;
        const p2Acc = p2Total > 0 ? Math.round((p2Stat.correctPops / p2Total) * 100) : 0;

        const isP1Win = numPlayers === 1 || scores[0] > scores[1];
        const isP2Win = numPlayers === 2 && scores[1] > scores[0];
        const isTie = numPlayers === 2 && scores[0] === scores[1];

        const winnerBannerText = numPlayers === 2
          ? isP1Win
            ? `👑 ${p1Name || 'Team 1'} Wins!`
            : isP2Win
            ? `👑 ${p2Name || 'Team 2'} Wins!`
            : `⚡ It's a Tie!`
          : resultsTitle;

        const winnerSubtext = numPlayers === 2
          ? isP1Win
            ? `${p1Name || 'Team 1'} won by +${scores[0] - scores[1]} points (${scores[0]} vs ${scores[1]} PTS)!`
            : isP2Win
            ? `${p2Name || 'Team 2'} won by +${scores[1] - scores[0]} points (${scores[1]} vs ${scores[0]} PTS)!`
            : `Both ${p1Name || 'Team 1'} and ${p2Name || 'Team 2'} finished with ${scores[0]} points!`
          : `${p1Name || 'Team 1'} finished with ${scores[0]} points and ${p1Acc}% accuracy!`;

        return (
          <div className="absolute inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center p-4 overflow-y-auto">
            <div className="rounded-[2.5rem] p-6 sm:p-8 max-w-2xl w-full text-center relative z-10 bg-gradient-to-b from-amber-50 via-white to-sky-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-900 shadow-[0_24px_60px_rgba(0,0,0,0.35)] border-4 border-amber-300 dark:border-amber-500/60 border-b-[10px] border-b-amber-500 text-slate-900 dark:text-white space-y-6 animate-in fade-in zoom-in-95 duration-200">
              
              {/* Top Trophy & Real Winner Announcement */}
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 border-t-2 border-white border-b-4 border-b-amber-700 flex items-center justify-center text-5xl shadow-xl animate-bounce mb-3">
                  🏆
                </div>
                <span className="px-4 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-400/40 text-amber-800 dark:text-amber-300 text-xs font-black uppercase tracking-widest">
                  {numPlayers === 2 ? 'Official Match Result' : 'Solo Arena Result'}
                </span>
                <h2 className={`text-3xl sm:text-5xl font-black uppercase tracking-tight mt-2 drop-shadow-sm ${
                  numPlayers === 2 && !isTie
                    ? isP1Win
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-500'
                }`}>
                  {winnerBannerText}
                </h2>
                <p className="text-sm sm:text-base font-bold text-slate-600 dark:text-slate-300 mt-1">
                  {winnerSubtext}
                </p>

                {/* Stars for 1 Player */}
                {numPlayers === 1 && (
                  <div className="flex justify-center gap-2.5 mt-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        viewBox="0 0 24 24"
                        className={`w-10 h-10 sm:w-12 sm:h-12 transition-all duration-500 transform ${
                          p1Acc >= (star * 20 - 10) ? 'scale-100 opacity-100' : 'scale-75 opacity-30 grayscale'
                        }`}
                      >
                        <path
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                          fill={p1Acc >= (star * 20 - 10) ? "#facc15" : "#64748b"}
                          stroke={p1Acc >= (star * 20 - 10) ? "#ca8a04" : "#475569"}
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Result Podium Cards */}
              <div className={`grid gap-4 ${numPlayers === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
                {/* Player 1 Result Card */}
                <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                  isP1Win || isTie
                    ? 'bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/50 dark:to-slate-800 border-blue-400 border-b-blue-600 shadow-xl scale-[1.02]'
                    : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 border-b-slate-300 opacity-85'
                }`}>
                  {(isP1Win || isTie) && (
                    <span className="px-3.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow mb-2">
                      {isTie ? '🤝 Tie — Co-Winner' : '👑 Winner'}
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">P1</span>
                    <span className="text-base font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      {p1Name || 'Team 1'}
                    </span>
                  </div>
                  <div className="text-5xl sm:text-6xl font-black text-blue-600 dark:text-blue-400 tabular-nums my-2">
                    {scores[0]} <span className="text-base font-black">PTS</span>
                  </div>
                  <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-blue-100 dark:border-slate-700 text-xs font-black">
                    <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl py-2 text-emerald-700 dark:text-emerald-300">
                      <div className="text-sm font-black">+{p1Stat.correctPops * 5}</div>
                      <div className="text-[10px]">✓ {p1Stat.correctPops} Correct</div>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl py-2 text-rose-700 dark:text-rose-300">
                      <div className="text-sm font-black">-{p1Stat.wrongPops * 5}</div>
                      <div className="text-[10px]">✗ {p1Stat.wrongPops} Wrong</div>
                    </div>
                    <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl py-2 text-sky-700 dark:text-sky-300">
                      <div className="text-sm font-black">{p1Acc}%</div>
                      <div className="text-[10px]">🎯 Accuracy</div>
                    </div>
                  </div>
                </div>

                {/* Player 2 Result Card (When 2 Players) */}
                {numPlayers === 2 && (
                  <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                    isP2Win || isTie
                      ? 'bg-gradient-to-b from-rose-50 to-white dark:from-rose-950/50 dark:to-slate-800 border-rose-400 border-b-rose-600 shadow-xl scale-[1.02]'
                      : 'bg-white dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 border-b-slate-300 opacity-85'
                  }`}>
                    {(isP2Win || isTie) && (
                      <span className="px-3.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow mb-2">
                        {isTie ? '🤝 Tie — Co-Winner' : '👑 Winner'}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-black flex items-center justify-center">P2</span>
                      <span className="text-base font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                        {p2Name || 'Team 2'}
                      </span>
                    </div>
                    <div className="text-5xl sm:text-6xl font-black text-rose-600 dark:text-rose-400 tabular-nums my-2">
                      {scores[1]} <span className="text-base font-black">PTS</span>
                    </div>
                    <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-rose-100 dark:border-slate-700 text-xs font-black">
                      <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl py-2 text-emerald-700 dark:text-emerald-300">
                        <div className="text-sm font-black">+{p2Stat.correctPops * 5}</div>
                        <div className="text-[10px]">✓ {p2Stat.correctPops} Correct</div>
                      </div>
                      <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl py-2 text-rose-700 dark:text-rose-300">
                        <div className="text-sm font-black">-{p2Stat.wrongPops * 5}</div>
                        <div className="text-[10px]">✗ {p2Stat.wrongPops} Wrong</div>
                      </div>
                      <div className="bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-xl py-2 text-sky-700 dark:text-sky-300">
                        <div className="text-sm font-black">{p2Acc}%</div>
                        <div className="text-[10px]">🎯 Accuracy</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <button
                  onClick={() => setScreen('setup')}
                  className="px-6 py-4 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-2xl font-black text-base transition-colors cursor-pointer text-slate-800 dark:text-white shadow-md"
                >
                  Back to Setup
                </button>
                <button
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="px-6 py-4 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl font-black text-base transition-colors cursor-pointer shadow-md"
                >
                  📖 Study Mode
                </button>
                <button
                  onClick={() => startGameMode(numPlayers)}
                  className="flex-1 px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-2xl font-black text-lg text-white cursor-pointer shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  <span>Play Again</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3-Mode Selection Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: activeQuiz?.id,
          name: activeQuiz?.title,
          topic: activeQuiz?.topic,
          className: activeQuiz?.classLevel,
          gameType: 'bubble-pop',
          customQuestions: activeQuiz?.questions || []
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          gameState.current.isActive = false;
          if (cameraRef.current && cameraRef.current.stop) { cameraRef.current.stop(); setIsCameraActive(false); }
          setIsCameraActive(false);
          if (handsRef.current && handsRef.current.close) handsRef.current.close();
          onViewChange(mode as ViewState, adaptedData);
        }}
      />

      {/* Tracker Mode Selection Modal */}
      {showTrackerModal && typeof document !== 'undefined' && createPortal(
        <TrackerModal
          isOpen={showTrackerModal}
          onClose={() => setShowTrackerModal(false)}
          trackerMode={trackerMode}
          onSelectMode={(mode) => {
            setTrackerMode(mode);
            pointers.current.forEach(p => {
              p.x = -100; p.y = -100;
              p.targetX = -100; p.targetY = -100;
              p.detected = false;
              p.history = [];
            });
            detectedHandsRef.current = [];
            detectedFacesRef.current = [];
          }}
          handCharacter={handCharacter}
          onSelectHand={setHandCharacter}
          noseStyle={noseStyle}
          onSelectNose={setNoseStyle}
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          detectedHandsRef={detectedHandsRef}
          detectedFacesRef={detectedFacesRef}
          onPopSound={() => playSound('pop')}
          onRetryCamera={() => setupCamera()}
        />,
        document.body
      )}
    </div>
  );
}


function QuizEditor({
  quiz,
  onSave,
  onCancel,
  onPreviewPlay,
  folders
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onCancel: () => void;
  onPreviewPlay?: (q: Quiz) => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(quiz.questions);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number | 'question', query?: string } | null>(null);
  const [contentMode, setContentMode] = useState<AnswerContentMode>('words');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState<boolean>(false);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(`Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`);
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg("Please enter or paste at least one item.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const newItems: Question[] = parsed.map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || "",
      options: item.options || ["", ""],
      answerIndex: item.answerIndex || 0,
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }

    setToastMsg(`✨ Added ${parsed.length} questions!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsedItems = parsePastedQuiz(pastedText);
    
    // If it's just a single question with no options and it matches exactly, let normal paste handle it
    if (parsedItems.length === 1 && parsedItems[0].text === pastedText && parsedItems[0].options?.every(o => !o)) {
       return;
    }

    if (parsedItems.length > 0) {
      e.preventDefault();
      
      const newItems: Question[] = parsedItems.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || "",
        options: item.options || ["", ""],
        answerIndex: item.answerIndex || 0,
      }));

      setQuestions(prev => {
        const updated = [...prev];
        const current = updated[index];

        if (current && !current.text.trim()) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated;
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} questions!`);
      setTimeout(() => setToastMsg(""), 3500);

      setTimeout(() => {
        const targetIdx = index + parsedItems.length - (questions[index]?.text.trim() ? 0 : 1);
        const targetInput = document.getElementById(`question-input-${targetIdx}`);
        targetInput?.focus();
      }, 80);
    }
  };


  const addQuestion = () => {
    setQuestions((prev) => [...prev, { id: Date.now() + Math.random(), text: '', options: ['', ''], answerIndex: 0 }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId) {
          const newOptions = [...q.options];
          newOptions[optIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const addOption = (qId: number | string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId && q.options.length < 6) {
          return { ...q, options: [...q.options, ''] };
        }
        return q;
      })
    );
  };

  const removeOption = (qId: number | string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === qId && q.options.length > 2) {
          const newOptions = [...q.options];
          newOptions.pop();
          const newAnswerIndex = q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
          return { ...q, options: newOptions, answerIndex: newAnswerIndex };
        }
        return q;
      })
    );
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
    setQuestions(prev => {
      const newQuestions = [...prev];
      const qToCopy = prev[index];
      const duplicatedQ = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options]
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        addQuestion();
        setTimeout(() => {
          const nextInput = document.getElementById(`question-input-${index + 1}`);
          nextInput?.focus();
        }, 50);
      } else {
        const nextInput = document.getElementById(`question-input-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const sanitizeQuestionsForSave = () => {
    return questions
      .filter((q) => (q.text && q.text.trim()) || q.image || q.options.some((o) => o && o.trim()))
      .map((q) => {
        const parsedQ = parseOptionContent(q.text || '');
        const cleanQText = parsedQ.text || '';
        const cleanQImg = q.image || parsedQ.imageUrl || undefined;
        const formattedOptions = q.options.map((rawOpt) => {
          const parsedOpt = parseOptionContent(rawOpt);
          const optImg = parsedOpt.imageUrl || (contentMode !== 'words' ? getInstantCartoonPng(parsedOpt.text) : null);
          if (contentMode === 'photos_gifs') {
            return optImg || parsedOpt.text || rawOpt;
          }
          if (optImg) {
            return parsedOpt.text
              ? formatOptionContent(parsedOpt.text, optImg, 'both')
              : optImg;
          }
          return parsedOpt.text || rawOpt;
        });
        return {
          ...q,
          text: cleanQText,
          image: cleanQImg,
          options: formattedOptions,
        };
      });
  };

  const handleSave = () => {
    const validQuestions = sanitizeQuestionsForSave();
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const generatedTitle = topic || quiz.title || "Bubble Pop Game";
    const validQuestions = sanitizeQuestionsForSave();
    onSave({
      ...quiz,
      title: generatedTitle,
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  const handlePreviewPlay = () => {
    const validQuestions = sanitizeQuestionsForSave();
    if (validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question before playing.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    if (onPreviewPlay) {
      onPreviewPlay({
        ...quiz,
        title: topic || quiz.title || "Bubble Pop Game",
        folderId,
        topic,
        classLevel,
        questions: validQuestions
      });
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
        <div className="bg-white dark:bg-slate-800/80 p-6 sm:p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-black text-sm transition-colors cursor-pointer border border-slate-300 dark:border-slate-600"
                    title="Go 1 Step Back"
                  >
                    <ArrowLeft size={18} />
                    <span>Back</span>
                  </button>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                    BUBBLE POP SETUP
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg shadow-blue-500/30 cursor-pointer text-sm sm:text-base"
                    >
                      <Save size={18} />
                      <span>Save Quiz</span>
                    </button>
                    <FullscreenButton targetId="game-container" className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600" />
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
                onApplyModeToAll={async (mode) => {
                  const updated = await convertQuestionsContentMode(questions, mode);
                  setQuestions(updated);
                  setToastMsg(
                    mode === 'words'
                      ? '🔤 Switched all options to Text Only!'
                      : mode === 'photos_gifs'
                      ? '🖼️ Switched all options to Pictures Only!'
                      : '✨ Switched all options to Words + Pictures!'
                  );
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                onLoadStarterQuestions={(newQs, topicName) => {
                  setQuestions(newQs);
                  setToastMsg(`✨ Loaded ${newQs.length} "${topicName}" questions with Cartoon PNGs!`);
                  setTimeout(() => setToastMsg(''), 3500);
                }}
            />
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
          {/* Bulk Paste Action Bar */}
          <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
              Questions ({questions.length})
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
              <button
                type="button"
                onClick={() => setShowVideoGuide(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer border border-purple-400/30"
                title="Watch Video Tutorial: How to Bulk Paste with AI"
              >
                <div className="w-5 h-5 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                  <Play size={11} className="ml-0.5 fill-current" />
                </div>
                <span>How to Bulk Paste</span>
              </button>
            </div>
          </div>
          {questions.map((q, index) => (
            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
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
                <div className="w-8 h-8 mt-2 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                  {index + 1}
                </div>
                <SmartQuestionInput
                  id={`question-input-${index}`}
                  value={q.text}
                  imageUrl={q.image}
                  onChange={(newVal) => updateQuestion(q.id, 'text', newVal)}
                  onChangeImage={(newImg) => updateQuestion(q.id, 'image', newImg || undefined)}
                  onOpenMediaPicker={(initialQ) =>
                    setActiveGiphyInput({ qId: q.id, optIndex: 'question', query: initialQ })
                  }
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  placeholder="Type your question here..."
                  autoPhotosEnabled={autoPhotosEnabled}
                />
              </div>

              <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, optIndex) => (
                  <SmartOptionInput
                    key={optIndex}
                    value={opt}
                    optionIndex={optIndex}
                    onChange={(val) => updateOption(q.id, optIndex, val)}
                    onOpenMediaPicker={(initialQ) =>
                      setActiveGiphyInput({ qId: q.id, optIndex, query: initialQ })
                    }
                    placeholder={`Option ${optIndex + 1}`}
                    isCorrect={q.answerIndex === optIndex}
                    onSelectCorrect={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                    radioName={`answer-${q.id}`}
                    contentMode={contentMode}
                    autoPhotosEnabled={autoPhotosEnabled}
                  />
                ))}
              </div>
              <div className="ml-12 mt-3 flex gap-2">
                  <button onClick={() => addOption(q.id)} disabled={q.options.length >= 6} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer font-bold">+ Option</button>
                  <button onClick={() => removeOption(q.id)} disabled={q.options.length <= 2} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer font-bold">- Option</button>
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
              setQuestions((prev) =>
                prev.map((qItem) =>
                  qItem.id === activeGiphyInput.qId
                    ? { ...qItem, text: questionTextToKeep, image: url }
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

      {/* Clean Bulk Paste Modal */}
      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold shrink-0">
                  <ClipboardList size={20} />
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                  Bulk Paste
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyAiPrompt}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedPromptInModal ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copiedPromptInModal ? "Copied!" : "Copy AI Prompt"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Play size={12} className="fill-current" />
                  <span>How to Bulk Paste</span>
                </button>
                <button 
                  type="button"
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <textarea 
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B"}
              className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
            />

            {bulkText.trim() && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Info size={16} className="text-cyan-500 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Found <span className="font-bold text-slate-800 dark:text-white">{parsePastedQuiz(bulkText).length}</span> questions.
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
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={18} />
                + Add
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Paste Video Explanation Modal */}
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

interface TrackerLivePreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  trackerMode: 'finger' | 'hand' | 'nose';
  handCharacter: HandCharacterType;
  noseStyle: NoseStyle;
  detectedHandsRef: React.MutableRefObject<any[]>;
  detectedFacesRef: React.MutableRefObject<any[]>;
  onPopSound: () => void;
  onRetryCamera?: () => void;
}

function buildDemoHandLandmarks(cxPx: number, cyPx: number, w: number, h: number, time: number) {
  const unit = Math.max(26, Math.min(w, h) * 0.22);
  const pulse = Math.sin(time * 0.004) * (unit * 0.04);

  const toNorm = (dx: number, dy: number) => ({
    x: (cxPx + dx) / Math.max(1, w),
    y: (cyPx + dy) / Math.max(1, h),
    z: 0,
  });

  return [
    toNorm(0, unit * 0.95),                        // 0: Wrist
    toNorm(-unit * 0.36, unit * 0.68),             // 1: Thumb CMC
    toNorm(-unit * 0.62, unit * 0.34),             // 2: Thumb MCP
    toNorm(-unit * 0.82, -unit * 0.02),            // 3: Thumb IP
    toNorm(-unit * 0.96 - pulse, -unit * 0.34),    // 4: Thumb Tip
    toNorm(-unit * 0.38, -unit * 0.04),            // 5: Index MCP
    toNorm(-unit * 0.44, -unit * 0.46),            // 6: Index PIP
    toNorm(-unit * 0.48, -unit * 0.82),            // 7: Index DIP
    toNorm(-unit * 0.51, -unit * 1.12 - pulse),    // 8: Index Tip
    toNorm(-unit * 0.04, -unit * 0.10),            // 9: Middle MCP (Palm reference)
    toNorm(-unit * 0.05, -unit * 0.56),            // 10: Middle PIP
    toNorm(-unit * 0.06, -unit * 0.94),            // 11: Middle DIP
    toNorm(-unit * 0.06, -unit * 1.26 - pulse),    // 12: Middle Tip
    toNorm(unit * 0.28, -unit * 0.04),             // 13: Ring MCP
    toNorm(unit * 0.33, -unit * 0.46),             // 14: Ring PIP
    toNorm(unit * 0.37, -unit * 0.80),             // 15: Ring DIP
    toNorm(unit * 0.40, -unit * 1.08 - pulse),     // 16: Ring Tip
    toNorm(unit * 0.56, unit * 0.12),              // 17: Pinky MCP
    toNorm(unit * 0.66, -unit * 0.24),             // 18: Pinky PIP
    toNorm(unit * 0.73, -unit * 0.54),             // 19: Pinky DIP
    toNorm(unit * 0.79 + pulse, -unit * 0.80),     // 20: Pinky Tip
  ];
}

function TrackerLivePreview({
  videoRef,
  isCameraActive,
  trackerMode,
  handCharacter,
  noseStyle,
  detectedHandsRef,
  detectedFacesRef,
  onPopSound,
  onRetryCamera,
}: TrackerLivePreviewProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [poppedCount, setPoppedCount] = useState(0);
  const mousePosRef = useRef<{ x: number; y: number; active: boolean }>({ x: -100, y: -100, active: false });
  const fingerTrailRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastPopTimeRef = useRef<number>(0);

  const testBubbleRef = useRef<{
    x: number;
    y: number;
    radius: number;
    color: string;
    respawnAt: number;
    particles: Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number }>;
    ripples: Array<{ x: number; y: number; r: number; color: string; life: number }>;
  }>({
    x: 110,
    y: 75,
    radius: 24,
    color: '#38bdf8',
    respawnAt: 0,
    particles: [],
    ripples: [],
  });

  const onPopSoundRef = useRef(onPopSound);
  onPopSoundRef.current = onPopSound;

  useEffect(() => {
    let animId: number | null = null;
    const colors = ['#38bdf8', '#f43f5e', '#a855f7', '#22c55e', '#f59e0b'];

    const renderLoop = (time: number) => {
      animId = requestAnimationFrame(renderLoop);
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.clientWidth || 360;
      const h = canvas.clientHeight || 160;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw Mirrored Live Camera Video (or Interactive Stage Fallback)
      const vid = videoRef.current;
      const hasLiveVideo = Boolean(vid && vid.readyState >= 2 && vid.videoWidth > 0);
      const vW = hasLiveVideo && vid ? vid.videoWidth : w;
      const vH = hasLiveVideo && vid ? vid.videoHeight : h;

      if (hasLiveVideo && vid) {
        const scale = Math.max(w / vW, h / vH);
        const drawW = vW * scale;
        const drawH = vH * scale;
        const offsetX = (w - drawW) / 2;
        const offsetY = (h - drawH) / 2;

        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(vid, offsetX, offsetY, drawW, drawH);
        ctx.restore();

        // Subtle vignette so tracker & practice bubble pop visually
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(15, 23, 42, 0.35)');
        grad.addColorStop(0.5, 'rgba(15, 23, 42, 0.05)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.45)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      } else {
        const bgGrad = ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 28) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 28) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        }
      }

      // 2. Collect Active Strike Points & Render the Selected Tracker
      const strikePoints: Array<{ x: number; y: number }> = [];
      const now = Date.now();

      if (trackerMode === 'finger') {
        const hands = detectedHandsRef.current;
        let tipPt: { x: number; y: number } | null = null;

        if (hands && hands.length > 0 && hands[0] && hands[0][8]) {
          tipPt = toPx(hands[0][8], w, h, vW, vH);
        } else if (mousePosRef.current.active) {
          tipPt = { x: mousePosRef.current.x, y: mousePosRef.current.y };
        } else {
          // Gentle figure-8 demo motion when idle so user sees Finger Ball
          tipPt = {
            x: w * 0.62 + Math.cos(time * 0.0025) * (w * 0.18),
            y: h * 0.54 + Math.sin(time * 0.005) * (h * 0.18),
          };
        }

        if (tipPt) {
          strikePoints.push(tipPt);
          fingerTrailRef.current.push({ x: tipPt.x, y: tipPt.y });
          if (fingerTrailRef.current.length > 12) fingerTrailRef.current.shift();
        }

        if (fingerTrailRef.current.length > 1) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          ctx.moveTo(fingerTrailRef.current[0].x, fingerTrailRef.current[0].y);
          for (let i = 1; i < fingerTrailRef.current.length; i++) {
            ctx.lineTo(fingerTrailRef.current[i].x, fingerTrailRef.current[i].y);
          }
          ctx.strokeStyle = 'rgba(59, 130, 246, 0.55)';
          ctx.lineWidth = 22;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke();

          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 8;
          ctx.stroke();
          ctx.restore();

          const head = fingerTrailRef.current[fingerTrailRef.current.length - 1];
          ctx.save();
          ctx.translate(head.x, head.y);
          const pulse = 1 + Math.sin(time * 0.01) * 0.16;
          ctx.rotate(time * 0.003);
          ctx.scale(pulse, pulse);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.moveTo(0, -18); ctx.quadraticCurveTo(4, -4, 18, 0);
          ctx.quadraticCurveTo(4, 4, 0, 18); ctx.quadraticCurveTo(-4, 4, -18, 0);
          ctx.quadraticCurveTo(-4, -4, 0, -18);
          ctx.fill();
          ctx.fillStyle = '#3b82f6';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (trackerMode === 'hand') {
        const hands = detectedHandsRef.current;
        if (hands && hands.length > 0) {
          hands.forEach((hand) => {
            if (!hand || hand.length < 21) return;
            [9, 4, 8, 12, 16, 20].forEach((idx) => {
              if (hand[idx]) strikePoints.push(toPx(hand[idx], w, h, vW, vH));
            });
            drawCharacterHand(ctx, hand, handCharacter, w, h, false, 0, time, vW, vH);
          });
        } else {
          const cx = mousePosRef.current.active
            ? mousePosRef.current.x
            : w * 0.56 + Math.sin(time * 0.0022) * 20;
          const cy = mousePosRef.current.active
            ? mousePosRef.current.y
            : h * 0.58 + Math.cos(time * 0.003) * 8;
          const demoHand = buildDemoHandLandmarks(cx, cy, w, h, time);
          [9, 4, 8, 12, 16, 20].forEach((idx) => {
            strikePoints.push(toPx(demoHand[idx], w, h, w, h));
          });
          drawCharacterHand(ctx, demoHand, handCharacter, w, h, false, 0, time, w, h);
        }
      } else if (trackerMode === 'nose') {
        const faces = detectedFacesRef.current;
        const isPopping = now - lastPopTimeRef.current < 350;
        if (faces && faces.length > 0) {
          faces.forEach((face) => {
            if (!face || face.length < 5 || !face[1]) return;
            const tipPx = toPx(face[1], w, h, vW, vH);
            const bridgePx = face[168] ? toPx(face[168], w, h, vW, vH) : undefined;
            let noseSize = 30;
            if (face[33] && face[263]) {
              const e1 = toPx(face[33], w, h, vW, vH);
              const e2 = toPx(face[263], w, h, vW, vH);
              noseSize = Math.max(20, Math.min(48, Math.hypot(e2.x - e1.x, e2.y - e1.y) * 0.42));
            }
            const angle = bridgePx ? Math.atan2(tipPx.x - bridgePx.x, tipPx.y - bridgePx.y) : 0;
            strikePoints.push(tipPx);
            drawAnimatedNose({
              ctx,
              noseTip: tipPx,
              noseBridge: bridgePx,
              noseSize,
              angle,
              style: noseStyle,
              isPopping,
              time,
            });
          });
        } else {
          const nx = mousePosRef.current.active
            ? mousePosRef.current.x
            : w * 0.64 + Math.sin(time * 0.0025) * 20;
          const ny = mousePosRef.current.active
            ? mousePosRef.current.y
            : h * 0.54 + Math.cos(time * 0.0035) * 10;
          strikePoints.push({ x: nx, y: ny });
          drawAnimatedNose({
            ctx,
            noseTip: { x: nx, y: ny },
            noseSize: 32,
            angle: 0,
            style: noseStyle,
            isPopping,
            time,
          });
        }
      }

      // 3. Interactive Practice Bubble ("POP ME!")
      const tb = testBubbleRef.current;
      // Clamp bubble inside current canvas bounds
      tb.x = Math.max(36, Math.min(w - 36, tb.x));
      tb.y = Math.max(36, Math.min(h - 36, tb.y));

      if (now >= tb.respawnAt) {
        const bobY = tb.y + Math.sin(time * 0.0045) * 5;

        // Check collision with any tracker strike point
        for (const pt of strikePoints) {
          if (Math.hypot(pt.x - tb.x, pt.y - bobY) < tb.radius + 16) {
            lastPopTimeRef.current = now;
            tb.respawnAt = now + 500;
            tb.ripples.push({ x: tb.x, y: bobY, r: tb.radius * 0.6, color: tb.color, life: 1 });
            for (let i = 0; i < 14; i++) {
              const ang = (Math.PI * 2 * i) / 14;
              const spd = 2 + Math.random() * 3.5;
              tb.particles.push({
                x: tb.x,
                y: bobY,
                vx: Math.cos(ang) * spd,
                vy: Math.sin(ang) * spd,
                color: tb.color,
                life: 1,
              });
            }
            // Pick next spot away from current spot
            tb.x = 45 + Math.random() * Math.max(60, w - 90);
            tb.y = 42 + Math.random() * Math.max(40, h - 84);
            tb.color = colors[Math.floor(Math.random() * colors.length)];
            setPoppedCount((c) => c + 1);
            onPopSoundRef.current();
            break;
          }
        }

        // Draw practice bubble if still unpopped
        if (now >= tb.respawnAt) {
          ctx.save();
          ctx.translate(tb.x, bobY);

          const bGrad = ctx.createRadialGradient(-tb.radius * 0.3, -tb.radius * 0.3, 2, 0, 0, tb.radius);
          bGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
          bGrad.addColorStop(0.35, tb.color);
          bGrad.addColorStop(1, 'rgba(15,23,42,0.75)');

          ctx.beginPath();
          ctx.arc(0, 0, tb.radius, 0, Math.PI * 2);
          ctx.fillStyle = bGrad;
          ctx.shadowColor = tb.color;
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.stroke();

          // Gloss highlight
          ctx.beginPath();
          ctx.arc(-tb.radius * 0.32, -tb.radius * 0.32, tb.radius * 0.24, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fill();

          ctx.font = '900 10px Fredoka, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText('POP ME!', 0, 1);
          ctx.restore();
        }
      }

      // 4. Draw Pop Particles & Ripples
      tb.ripples = tb.ripples.filter((r) => r.life > 0.04);
      tb.ripples.forEach((r) => {
        r.r += 2.6;
        r.life *= 0.86;
        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = r.life;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      });

      tb.particles = tb.particles.filter((p) => p.life > 0.04);
      tb.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life *= 0.88;
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    animId = requestAnimationFrame(renderLoop);
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [trackerMode, handCharacter, noseStyle, isCameraActive]);

  const activeTrackerLabel =
    trackerMode === 'finger'
      ? '☝️ Finger Ball'
      : trackerMode === 'hand'
      ? `${HAND_TRACKER_OPTIONS.find((h) => h.id === handCharacter)?.icon || '🖐️'} ${
          HAND_TRACKER_OPTIONS.find((h) => h.id === handCharacter)?.name || 'Hand'
        }`
      : `${NOSE_TRACKER_OPTIONS.find((n) => n.id === noseStyle)?.icon || '👃'} ${
          NOSE_TRACKER_OPTIONS.find((n) => n.id === noseStyle)?.name || 'Nose'
        }`;

  return (
    <div className="relative w-full h-40 sm:h-44 rounded-2xl overflow-hidden border-2 border-cyan-300/80 bg-slate-950 shadow-[0_8px_25px_rgba(0,0,0,0.45)] select-none shrink-0">
      <canvas
        ref={previewCanvasRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          mousePosRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            active: true,
          };
        }}
        onMouseLeave={() => {
          mousePosRef.current.active = false;
        }}
        onTouchMove={(e) => {
          if (!e.touches.length) return;
          const rect = e.currentTarget.getBoundingClientRect();
          mousePosRef.current = {
            x: e.touches[0].clientX - rect.left,
            y: e.touches[0].clientY - rect.top,
            active: true,
          };
        }}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Top Overlay Bar: Live Camera Status + Active Tracker Name */}
      <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
        <div className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-white/30 flex items-center gap-1.5 shadow">
          <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <span className="text-[11px] font-black uppercase tracking-wider text-white">
            {isCameraActive ? 'Try Tracker Camera' : 'Try Tracker Preview'}
          </span>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-cyan-400/50 text-white text-[11px] font-black shadow flex items-center gap-1.5">
          <span>{activeTrackerLabel}</span>
          {poppedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black">
              🫧 {poppedCount}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Helper Bar */}
      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
        <span className="px-2.5 py-0.5 rounded-full bg-slate-950/75 text-white/95 text-[11px] font-bold border border-white/20">
          {trackerMode === 'nose'
            ? '👃 Move your nose (or cursor) to pop the bubble!'
            : '✋ Show your hand (or move cursor) to pop the bubble!'}
        </span>

        {!isCameraActive && onRetryCamera && (
          <button
            type="button"
            onClick={onRetryCamera}
            className="pointer-events-auto px-2.5 py-1 rounded-full bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-black border border-white/50 shadow cursor-pointer"
          >
            📷 Enable Camera
          </button>
        )}
      </div>
    </div>
  );
}

interface TrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackerMode: 'finger' | 'hand' | 'nose';
  onSelectMode: (mode: 'finger' | 'hand' | 'nose') => void;
  handCharacter: HandCharacterType;
  onSelectHand: (char: HandCharacterType) => void;
  noseStyle: NoseStyle;
  onSelectNose: (style: NoseStyle) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isCameraActive: boolean;
  detectedHandsRef: React.MutableRefObject<any[]>;
  detectedFacesRef: React.MutableRefObject<any[]>;
  onPopSound: () => void;
  onRetryCamera?: () => void;
}

function TrackerModal({
  isOpen,
  onClose,
  trackerMode,
  onSelectMode,
  handCharacter,
  onSelectHand,
  noseStyle,
  onSelectNose,
  videoRef,
  isCameraActive,
  detectedHandsRef,
  detectedFacesRef,
  onPopSound,
  onRetryCamera,
}: TrackerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div 
        className="bg-slate-900 text-white rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col gap-4 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border-2 border-white/30 max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg border border-white/40">
              {trackerMode === 'finger' && '☝️'}
              {trackerMode === 'hand' && '🖐️'}
              {trackerMode === 'nose' && '👃'}
            </div>
            <h3 className="text-2xl font-black text-white">
              Choose Your Tracker
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 text-white/80 hover:text-white hover:bg-slate-700 border border-white/20 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-white/20">
          <button
            onClick={() => onSelectMode('finger')}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs sm:text-sm cursor-pointer border ${
              trackerMode === 'finger'
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-white shadow-lg scale-[1.02]'
                : 'bg-slate-800 text-white hover:bg-slate-700 border-white/15'
            }`}
          >
            <span className="text-xl">☝️</span>
            <span>Finger Ball</span>
          </button>
          <button
            onClick={() => onSelectMode('hand')}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs sm:text-sm cursor-pointer border ${
              trackerMode === 'hand'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white border-white shadow-lg scale-[1.02]'
                : 'bg-slate-800 text-white hover:bg-slate-700 border-white/15'
            }`}
          >
            <span className="text-xl">🖐️</span>
            <span>Hand Tracker</span>
          </button>
          <button
            onClick={() => onSelectMode('nose')}
            className={`py-2.5 px-2 rounded-xl flex items-center justify-center gap-2 transition-all font-black text-xs sm:text-sm cursor-pointer border ${
              trackerMode === 'nose'
                ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white border-white shadow-lg scale-[1.02]'
                : 'bg-slate-800 text-white hover:bg-slate-700 border-white/15'
            }`}
          >
            <span className="text-xl">👃</span>
            <span>Nose Tracker</span>
          </button>
        </div>

        {/* Small Live Try-It Camera Inside Modal */}
        <TrackerLivePreview
          videoRef={videoRef}
          isCameraActive={isCameraActive}
          trackerMode={trackerMode}
          handCharacter={handCharacter}
          noseStyle={noseStyle}
          detectedHandsRef={detectedHandsRef}
          detectedFacesRef={detectedFacesRef}
          onPopSound={onPopSound}
          onRetryCamera={onRetryCamera}
        />

        {/* Tab 1: Finger Mode Content (Icon & Name Only) */}
        {trackerMode === 'finger' && (
          <div className="p-4 rounded-2xl bg-white text-slate-950 border-2 border-amber-400 flex items-center justify-center gap-3.5 animate-in fade-in duration-200 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center text-3xl shadow-md">
              ☝️
            </div>
            <h4 className="text-lg font-black text-slate-950">
              Finger Ball
            </h4>
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black">
              ✓
            </span>
          </div>
        )}

        {/* Tab 2: Hand Mode Character Grid (Icons & Words Only — High Contrast) */}
        {trackerMode === 'hand' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-200">
            {HAND_TRACKER_OPTIONS.map((c) => {
              const isSelected = handCharacter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectHand(c.id)}
                  className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-white text-slate-950 border-amber-400 shadow-lg scale-[1.02]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-white/25'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${c.color} text-white flex items-center justify-center text-xl shadow-md shrink-0 border border-white/30`}>
                    {c.icon}
                  </div>
                  <span className={`font-black text-xs sm:text-sm leading-tight flex-1 text-left ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                    {c.name}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab 3: Nose Mode Style Grid (Icons & Words Only — High Contrast) */}
        {trackerMode === 'nose' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-200">
            {NOSE_TRACKER_OPTIONS.map((n) => {
              const isSelected = noseStyle === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => onSelectNose(n.id)}
                  className={`p-3 rounded-2xl border-2 flex items-center gap-2.5 transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-white text-slate-950 border-pink-400 shadow-lg scale-[1.02]'
                      : 'bg-slate-800 hover:bg-slate-700 text-white border-white/25'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${n.color} text-white flex items-center justify-center text-xl shadow-md shrink-0 border border-white/30`}>
                    {n.icon}
                  </div>
                  <span className={`font-black text-xs sm:text-sm leading-tight flex-1 text-left ${isSelected ? 'text-slate-950' : 'text-white'}`}>
                    {n.name}
                  </span>
                  {isSelected && (
                    <span className="w-5 h-5 rounded-full bg-pink-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer / Done */}
        <div className="flex justify-end pt-2 border-t border-white/15">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3 rounded-2xl font-black text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 border border-white/50 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer text-base"
          >
            Apply & Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// --- ROBUST PARSER HELPER ---
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  // 1. TSV / Excel paste check
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 2) {
        // Skip header row if present
        const p0Lower = parts[0].toLowerCase();
        if (p0Lower.includes('question') && (parts[1].toLowerCase().includes('option') || parts[1].toLowerCase().includes('answer'))) {
          return;
        }

        let qText = parts[0];
        let opts = ["", "", "", ""];
        let ansRaw = "";

        if (/^\d+$/.test(parts[0]) && parts.length >= 6) {
          // Format: ID \t Question \t Opt1 \t Opt2 \t Opt3 \t Opt4 \t Answer
          qText = parts[1];
          opts = [parts[2] || "", parts[3] || "", parts[4] || "", parts[5] || ""];
          ansRaw = parts[6] || "";
        } else {
          opts = [parts[1] || "", parts[2] || "", parts[3] || "", parts[4] || ""];
          ansRaw = parts[5] || "";
        }

        let ansIdx = 0;
        const letterMatch = ansRaw.match(/^[A-Da-d]$/);
        const numMatch = ansRaw.match(/^[1-4]$/);
        if (letterMatch) {
          ansIdx = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
        } else if (numMatch) {
          ansIdx = parseInt(numMatch[0]) - 1;
        } else if (ansRaw) {
          const found = opts.findIndex(o => o && o.toLowerCase() === ansRaw.toLowerCase());
          if (found >= 0) ansIdx = found;
        }

        items.push({
          text: qText,
          options: opts,
          answerIndex: Math.max(0, Math.min(3, ansIdx))
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
      return items;
    }
  }

  // 2. Multi-line / Standard Text Parsing
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;

  const isQuestionStart = (line: string) => {
    return /^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);
  };

  const getQuestionText = (line: string) => {
    const m = line.match(/^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
    return m ? m[1].trim() : line;
  };

  const isAnswerLine = (line: string) => {
    return /^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i.test(line);
  };

  const extractAnswerIndex = (line: string, opts: string[] = ["", "", "", ""]) => {
    const m = line.match(/^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i);
    if (!m) return -1;
    const raw = m[1].trim();

    const letter = raw.match(/[\(\[]?([A-Da-d])[\)\]\.\:]?/);
    if (letter) {
      return letter[1].toUpperCase().charCodeAt(0) - 65;
    }
    const num = raw.match(/^[1-4]$/);
    if (num) {
      return parseInt(num[0]) - 1;
    }
    const found = opts.findIndex(o => o && (o.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(o.toLowerCase())));
    if (found >= 0) return found;

    return 0;
  };

  const isOptionLine = (line: string) => {
    if (/^(?:[\(\[]?[A-Da-d][\)\]\.\:\-]|[\(\[][A-Da-d][\)\]])\s*(.*)/.test(line)) {
      return true;
    }
    if (/^(?:[\(\[][1-4][\)\]]|[1-4]\))\s*(.*)/.test(line)) {
      return true;
    }
    return false;
  };

  const extractOption = (line: string) => {
    const mLetter = line.match(/^(?:[\(\[]?([A-Da-d])[\)\]\.\:\-]|[\(\[]([A-Da-d])[\)\]])\s*(.*)/);
    if (mLetter) {
      const char = (mLetter[1] || mLetter[2]).toUpperCase();
      const idx = char.charCodeAt(0) - 65;
      return { index: idx, text: mLetter[3].trim() };
    }
    const mNum = line.match(/^(?:[\(\[]([1-4])[\)\]]|([1-4])\))\s*(.*)/);
    if (mNum) {
      const num = parseInt(mNum[1] || mNum[2]) - 1;
      return { index: num, text: mNum[3].trim() };
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isAnswerLine(line)) {
      if (currentQ) {
        const ans = extractAnswerIndex(line, currentQ.options);
        if (ans >= 0) currentQ.answerIndex = ans;
      }
      continue;
    }

    if (isOptionLine(line)) {
      const opt = extractOption(line);
      if (opt) {
        if (!currentQ) {
          currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
          items.push(currentQ);
        }
        if (opt.index >= 0 && opt.index < 4) {
          currentQ.options![opt.index] = opt.text;
        } else {
          const emptyIdx = currentQ.options!.findIndex(o => o === "");
          if (emptyIdx !== -1) currentQ.options![emptyIdx] = opt.text;
        }
      }
      continue;
    }

    if (isQuestionStart(line)) {
      const qText = getQuestionText(line);
      currentQ = { text: qText, options: ["", "", "", ""], answerIndex: 0 };
      items.push(currentQ);
      continue;
    }

    if (currentQ && currentQ.options && currentQ.options.every(o => o === "")) {
      currentQ.text += " " + line;
    } else {
      currentQ = { text: line, options: ["", "", "", ""], answerIndex: 0 };
      items.push(currentQ);
    }
  }

  items.forEach(q => {
    if (q.options) {
      while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
        q.options.pop();
      }
    }
  });

  return items;
}
