import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { ArrowLeft, Edit3, Trash2, Plus, Sparkles, BookOpen, Save, X, Play, Folder, Image as ImageIcon, ClipboardList, Copy, Volume2, VolumeX, RotateCcw, Check, Info, Flag, Timer } from "lucide-react";
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { logUserActivity } from "../utils/activityTracker";
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { OptionContentMode, parseOptionContent, formatOptionContent } from "../utils/mediaAndPresets";

const slapChopImgCache: Record<string, HTMLImageElement> = {};
function getCachedSlapChopImage(url: string): HTMLImageElement | null {
  if (!url) return null;
  if (!slapChopImgCache[url]) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    slapChopImgCache[url] = img;
  }
  return slapChopImgCache[url];
}

type GameScreen = 'editor' | 'setup' | 'loading' | 'game' | 'results' | 'study';

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  image?: string;
}

interface Quiz {
  id: number | string;
  title?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

const BLANK_QUESTION = (): Question => ({
  id: Date.now(),
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0
});

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const OPTION_COLORS = [
  { main: '#ff2a5f', light: '#ff9eb5', dark: '#7a001e', rim: '#4ade80', fruit: 'Watermelon' },
  { main: '#ff9f1c', light: '#ffe599', dark: '#7c2d12', rim: '#fde047', fruit: 'Mango' },
  { main: '#00d2ff', light: '#b8f2ff', dark: '#083344', rim: '#38bdf8', fruit: 'Blueberry' },
  { main: '#b5179e', light: '#f7aef8', dark: '#3b0764', rim: '#f43f5e', fruit: 'Dragonfruit' },
  { main: '#10b981', light: '#a7f3d0', dark: '#064e3b', rim: '#34d399', fruit: 'Kiwi' },
  { main: '#eab308', light: '#fef08a', dark: '#713f12', rim: '#facc15', fruit: 'Lemon' }
];

export function SlapAndChop({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void; initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );

  const [screen, setScreen] = useState<GameScreen>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor');
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  // Setup & Settings options
  const [numPlayers, setNumPlayers] = useState<number>(1);
  const [p1Name, setP1Name] = useState<string>("Player 1");
  const [p2Name, setP2Name] = useState<string>("Player 2");
  const [speed, setSpeed] = useState<number>(1); // 0.6 = slow, 1 = normal, 1.4 = fast, 1.8 = turbo
  const [gameMode, setGameMode] = useState<'mosquito' | 'chop' | 'combo'>('mosquito'); // Mosquito Slap, Chop Chop, Mix
  const [showHeadgear, setShowHeadgear] = useState<boolean>(false);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [soundFx, setSoundFx] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [textSize, setTextSize] = useState<number>(1.15); // 0.9 = Small, 1.0 = Normal, 1.2 = Large, 1.4 = Extra Large
  const [movementStyle, setMovementStyle] = useState<'calm' | 'normal' | 'zigzag' | 'hover'>('normal');
  const [playingTime, setPlayingTime] = useState<number>(120); // Playing time in seconds (up to 300s = 5 minutes)
  const [selectedTheme, setSelectedTheme] = useState<string>("theme-sky");
  const [gloveStyle, setGloveStyle] = useState<'slap' | 'boxing' | 'swatter' | 'cyber'>('slap');
  const [gloveSize, setGloveSize] = useState<number>(1.0); // 0.78 = Compact, 1.0 = Normal, 1.22 = Large
  const [slapMode, setSlapMode] = useState<'clap' | 'swat'>('clap');
  const [slapSensitivity, setSlapSensitivity] = useState<'easy' | 'balanced' | 'precise'>('balanced');
  const [answerMode, setAnswerMode] = useState<'single' | 'multiple'>('single');
  const [multiAnswerCount, setMultiAnswerCount] = useState<number>(3); // 1 - 10 answers per question in Multiple Answer Mode
  const [multiItems, setMultiItems] = useState<{
    bomb: boolean;
    x2: boolean;
    x3: boolean;
    gold: boolean;
    ice: boolean;
    zap: boolean;
  }>({
    bomb: true,
    x2: true,
    x3: true,
    gold: true,
    ice: true,
    zap: true
  });
  const [multiSpawnRate, setMultiSpawnRate] = useState<'normal' | 'frenzy' | 'chaos'>('frenzy');

  // In-Game Live HUD States
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [activeRoundMode, setActiveRoundMode] = useState<'mosquito' | 'chop'>('mosquito');
  const [hudScores, setHudScores] = useState<[number, number]>([0, 0]);
  const [hudStreaks, setHudStreaks] = useState<[number, number]>([1, 1]);
  const [hudScorePops, setHudScorePops] = useState<[string | null, string | null]>([null, null]);
  const [hudFrozen, setHudFrozen] = useState<[boolean, boolean]>([false, false]);
  const [hudHandsDetected, setHudHandsDetected] = useState<[[boolean, boolean], [boolean, boolean]]>([[false, false], [false, false]]);
  const [hudClapArmed, setHudClapArmed] = useState<[boolean, boolean]>([false, false]);
  const [hudMultiProgress, setHudMultiProgress] = useState<number>(0);
  const [hudActiveMults, setHudActiveMults] = useState<[number, number]>([1, 1]);
  const [hudSlowMo, setHudSlowMo] = useState<boolean>(false);
  const [timerPct, setTimerPct] = useState<number>(100);
  const [hudTimeLeft, setHudTimeLeft] = useState<number>(120);
  const [nextQCountdown, setNextQCountdown] = useState<number | null>(null);
  const [nextQProgressPct, setNextQProgressPct] = useState<number>(100);
  const [upcomingQNumber, setUpcomingQNumber] = useState<number>(1);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Interactive Study Mode States
  const [studyIndex, setStudyIndex] = useState<number>(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [studyViewMode, setStudyViewMode] = useState<'cards' | 'list'>('cards');

  // Active Quiz Object
  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : []);
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList.length > 0 ? qList : [BLANK_QUESTION()]
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [BLANK_QUESTION()]
    };
  });

  useEffect(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : []);

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList.length > 0 ? qList : [BLANK_QUESTION()]
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    }
  }, [initialGame]);

  // DOM & MediaPipe Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const cameraLoopActiveRef = useRef<boolean>(false);
  const cameraProcessingRef = useRef<boolean>(false);
  const handsRef = useRef<any>(null);
  const mpFaceDetectionRef = useRef<any>(null);
  const faceDetectorRef = useRef<any>(null);
  const headTrackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const mosquitoBuzzRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null>(null);
  const bgMusicTimerRef = useRef<number | null>(null);
  const textSizeRef = useRef<number>(textSize);
  const movementStyleRef = useRef<'calm' | 'normal' | 'zigzag' | 'hover'>(movementStyle);
  const speedRef = useRef<number>(speed);
  const gameModeRef = useRef<'mosquito' | 'chop' | 'combo'>(gameMode);
  const activeRoundModeRef = useRef<'mosquito' | 'chop'>(activeRoundMode);
  const soundFxRef = useRef<boolean>(soundFx);
  const voiceEnabledRef = useRef<boolean>(voiceEnabled);
  const showSettingsModalRef = useRef<boolean>(showSettingsModal);
  const playingTimeRef = useRef<number>(playingTime);
  const gloveStyleRef = useRef<'slap' | 'boxing' | 'swatter' | 'cyber'>(gloveStyle);
  const gloveSizeRef = useRef<number>(gloveSize);
  const slapModeRef = useRef<'clap' | 'swat'>(slapMode);
  const slapSensitivityRef = useRef<'easy' | 'balanced' | 'precise'>(slapSensitivity);
  const answerModeRef = useRef<'single' | 'multiple'>(answerMode);
  const multiAnswerCountRef = useRef<number>(multiAnswerCount);
  const multiItemsRef = useRef(multiItems);
  const multiSpawnRateRef = useRef<'normal' | 'frenzy' | 'chaos'>(multiSpawnRate);
  const lastHudMultsSigRef = useRef<string>('1-1-0');
  const nextQTimerRef = useRef<number | null>(null);
  const lastHudSecRef = useRef<number>(playingTime);
  const lastHudHandsRef = useRef<string>('0000');
  const lastHudArmedRef = useRef<string>('00');
  const cameraLastSendMsRef = useRef<number>(0);
  const onHandsResultsRef = useRef<((results: any) => void) | null>(null);
  const onFaceResultsRef = useRef<((results: any) => void) | null>(null);

  const toggleMultiItem = (key: keyof typeof multiItems) => {
    setMultiItems(prev => {
      const next = { ...prev, [key]: !prev[key] };
      multiItemsRef.current = next;
      return next;
    });
  };

  const formatPlayTime = (totalSec: number) => {
    const clamped = Math.max(0, Math.ceil(totalSec));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    playingTimeRef.current = playingTime;
  }, [playingTime]);

  useEffect(() => {
    gloveStyleRef.current = gloveStyle;
  }, [gloveStyle]);

  useEffect(() => {
    gloveSizeRef.current = gloveSize;
  }, [gloveSize]);

  useEffect(() => {
    slapModeRef.current = slapMode;
  }, [slapMode]);

  useEffect(() => {
    slapSensitivityRef.current = slapSensitivity;
  }, [slapSensitivity]);

  useEffect(() => {
    answerModeRef.current = answerMode;
  }, [answerMode]);

  useEffect(() => {
    multiAnswerCountRef.current = multiAnswerCount;
  }, [multiAnswerCount]);

  useEffect(() => {
    multiItemsRef.current = multiItems;
  }, [multiItems]);

  useEffect(() => {
    multiSpawnRateRef.current = multiSpawnRate;
  }, [multiSpawnRate]);

  useEffect(() => {
    if (handsRef.current) {
      try {
        handsRef.current.setOptions({
          maxNumHands: numPlayers === 2 ? 4 : 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.56,
          minTrackingConfidence: 0.50
        });
      } catch (e) {}
    }
  }, [numPlayers]);

  useEffect(() => {
    textSizeRef.current = textSize;
  }, [textSize]);

  useEffect(() => {
    movementStyleRef.current = movementStyle;
  }, [movementStyle]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    activeRoundModeRef.current = activeRoundMode;
  }, [activeRoundMode]);

  useEffect(() => {
    soundFxRef.current = soundFx;
  }, [soundFx]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    showSettingsModalRef.current = showSettingsModal;
  }, [showSettingsModal]);

  // Runtime engine states stored in ref for 60fps loop
  const engineRef = useRef<{
    isActive: boolean;
    questions: Question[];
    qIndex: number;
    timer: number;
    maxTimer: number;
    resolved: boolean;
    roundMode: 'mosquito' | 'chop';
    numPlayers: number;
    scores: [number, number];
    streaks: [number, number];
    correctHits: [number, number];
    targets: any[];
    slicedHalves: any[];
    splats: any[];
    particles: any[];
    shockwaves: any[];
    swordSparks: any[];
    floatingTexts: any[];
    players: any[];
    screenShake: number;
    lastFrameTime: number;
    roundHitsCollected?: number;
    roundHitsRequired?: number;
  }>({
    isActive: false,
    questions: [],
    qIndex: 0,
    timer: 18,
    maxTimer: 18,
    resolved: false,
    roundMode: 'mosquito',
    numPlayers: 1,
    scores: [0, 0],
    streaks: [1, 1],
    correctHits: [0, 0],
    targets: [],
    slicedHalves: [],
    splats: [],
    particles: [],
    shockwaves: [],
    swordSparks: [],
    floatingTexts: [],
    players: [],
    screenShake: 0,
    lastFrameTime: performance.now(),
    roundHitsCollected: 0,
    roundHitsRequired: 1
  });

  // Preload realistic browser TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const pickRealisticVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices || voices.length === 0) return;

      const enVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
      const pool = enVoices.length > 0 ? enVoices : voices;

      // Priority list of ultra-natural neural/premium voices across Chrome, Edge, Safari, and macOS/Windows
      const priorityMatchers = [
        (v: SpeechSynthesisVoice) => /Natural/i.test(v.name) && /Aria|Jenny|Guy|Sonia|Ryan/i.test(v.name),
        (v: SpeechSynthesisVoice) => /Natural|Online/i.test(v.name) && /en-US|en-GB/i.test(v.lang),
        (v: SpeechSynthesisVoice) => /Google US English/i.test(v.name),
        (v: SpeechSynthesisVoice) => /Google UK English Female/i.test(v.name),
        (v: SpeechSynthesisVoice) => /Samantha|Ava|Allison|Victoria|Karen|Moira|Daniel|Tessa/i.test(v.name),
        (v: SpeechSynthesisVoice) => /Premium|Enhanced|Neural/i.test(v.name),
        (v: SpeechSynthesisVoice) => /Google/i.test(v.name) && /en/i.test(v.lang),
        (v: SpeechSynthesisVoice) => v.default && /en/i.test(v.lang)
      ];

      for (const matcher of priorityMatchers) {
        const match = pool.find(matcher);
        if (match) {
          preferredVoiceRef.current = match;
          return;
        }
      }
      preferredVoiceRef.current = pool[0] || null;
    };

    pickRealisticVoice();
    window.speechSynthesis.onvoiceschanged = pickRealisticVoice;
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Load user folders
  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
          const snap = await getDocs(qFolders);
          const f: any[] = [];
          snap.forEach(d => f.push({ id: d.id, ...d.data() }));
          setFolders(f);
        } catch (e) {
          console.error("Error loading folders", e);
        }
      };
      fetchFolders();
    }
  }, [user]);

  // Audio helper
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  // Cheerful Sunny Arcade Background Music Loop (Web Audio API Marimba/Chime)
  const stopBgMusic = () => {
    if (bgMusicTimerRef.current) {
      window.clearInterval(bgMusicTimerRef.current);
      bgMusicTimerRef.current = null;
    }
  };

  const startBgMusic = () => {
    stopBgMusic();
    if (!musicEnabled || screen !== 'game') return;
    initAudio();
    const melody = [523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33];
    let step = 0;
    bgMusicTimerRef.current = window.setInterval(() => {
      if (!musicEnabled || !engineRef.current.isActive) return;
      const ctx = audioCtxRef.current;
      if (!ctx || ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const freq = melody[step % melody.length];
        step++;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.032, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
      } catch (e) {}
    }, 320);
  };

  useEffect(() => {
    if (screen === 'game' && musicEnabled) {
      startBgMusic();
    } else {
      stopBgMusic();
    }
    return () => stopBgMusic();
  }, [screen, musicEnabled]);

  // Continuous realistic spatial mosquito buzzing sound
  const startMosquitoBuzz = () => {
    if (!soundFx) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx || mosquitoBuzzRef.current) return;

    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const masterGain = ctx.createGain();

      // Dual sawtooth harmonics for realistic mosquito wing beat fundamental + overtone
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(590, now);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(1185, now);

      // Natural erratic Doppler pitch modulation (~7.5Hz flight weave)
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(7.5, now);
      lfoGain.gain.setValueAtTime(42, now);

      lfo.connect(lfoGain);
      lfoGain.connect(osc1.frequency);
      lfoGain.connect(osc2.frequency);

      // Nasal insect formants via high-Q bandpass filter
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1420, now);
      filter.Q.setValueAtTime(4.8, now);

      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.065, now + 0.35);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      lfo.start(now);

      mosquitoBuzzRef.current = { osc1, osc2, lfo, gain: masterGain };
    } catch (e) {
      console.warn("Could not start mosquito buzz:", e);
    }
  };

  const stopMosquitoBuzz = () => {
    const nodes = mosquitoBuzzRef.current;
    if (!nodes || !audioCtxRef.current) return;
    try {
      const now = audioCtxRef.current.currentTime;
      nodes.gain.gain.linearRampToValueAtTime(0.001, now + 0.12);
      setTimeout(() => {
        try {
          nodes.osc1.stop();
          nodes.osc2.stop();
          nodes.lfo.stop();
          nodes.osc1.disconnect();
          nodes.osc2.disconnect();
          nodes.lfo.disconnect();
          nodes.gain.disconnect();
        } catch (e) {}
        mosquitoBuzzRef.current = null;
      }, 140);
    } catch (e) {
      mosquitoBuzzRef.current = null;
    }
  };

  const playSoundEffect = (type: 'slap' | 'airclap' | 'slash' | 'correct' | 'wrong' | 'whoosh' | 'freeze' | 'victory' | 'countdown' | 'launch' | 'bomb' | 'powerup' | 'zap') => {
    if (!soundFxRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (type === 'airclap') {
      // Crisp, light dry palm clap pop so players get instant tactile feedback when testing their clap
      const bufferSize = Math.floor(ctx.sampleRate * 0.045);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.009));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1850, now);
      bp.Q.setValueAtTime(1.4, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.36, now);
      g.gain.exponentialRampToValueAtTime(0.005, now + 0.045);
      noise.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      noise.start(now);

      const pop = ctx.createOscillator();
      const popG = ctx.createGain();
      pop.type = 'triangle';
      pop.frequency.setValueAtTime(260, now);
      pop.frequency.exponentialRampToValueAtTime(95, now + 0.055);
      popG.gain.setValueAtTime(0.28, now);
      popG.gain.exponentialRampToValueAtTime(0.005, now + 0.055);
      pop.connect(popG);
      popG.connect(ctx.destination);
      pop.start(now);
      pop.stop(now + 0.06);
    } else if (type === 'slap') {
      // Layer 1: Crisp double-palm clap snap + high-frequency whip transient
      const bufferSize = Math.floor(ctx.sampleRate * 0.085);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const doublePulse = i < ctx.sampleRate * 0.015 ? 1.0 : Math.exp(-(i - ctx.sampleRate * 0.015) / (ctx.sampleRate * 0.012));
        data[i] = (Math.random() * 2 - 1) * doublePulse;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(2400, now);
      bpFilter.Q.setValueAtTime(1.1, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(1.0, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      noise.connect(bpFilter);
      bpFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // Layer 2: Deep punchy palm-smack bass thump
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(380, now);
      thudOsc.frequency.exponentialRampToValueAtTime(45, now + 0.13);

      thudGain.gain.setValueAtTime(1.0, now);
      thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.14);

      // Layer 3: Cartoon mosquito squish & electric zap pop
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(1250, now);
      popOsc.frequency.exponentialRampToValueAtTime(160, now + 0.09);

      popGain.gain.setValueAtTime(0.65, now);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start(now);
      popOsc.stop(now + 0.095);

    } else if (type === 'slash') {
      // Layer 1: Razor-sharp hand-blade air-cutting "SHING-SWOOSH"
      const bufferSize = Math.floor(ctx.sampleRate * 0.16);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.9;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(4600, now + 0.14);
      filter.Q.setValueAtTime(2.4, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.95, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      // Layer 2: Energy blade harmonic ring
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.16);
      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);

      // Layer 3: Juicy fruit-slice splash bubbles (3 rapid pitched water-drop pops)
      [0.03, 0.065, 0.10].forEach((delay, idx) => {
        const jOsc = ctx.createOscillator();
        const jGain = ctx.createGain();
        jOsc.type = 'sine';
        const baseF = 520 + idx * 240;
        jOsc.frequency.setValueAtTime(baseF, now + delay);
        jOsc.frequency.exponentialRampToValueAtTime(baseF * 1.9, now + delay + 0.045);
        jGain.gain.setValueAtTime(0.35, now + delay);
        jGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.05);
        jOsc.connect(jGain);
        jGain.connect(ctx.destination);
        jOsc.start(now + delay);
        jOsc.stop(now + delay + 0.055);
      });

    } else if (type === 'launch') {
      // Soft arcade fruit-launcher "THOOMP-WHOOSH" from below the screen
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.11);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);

    } else if (type === 'freeze') {
      // Crystalline 3D Ice Freeze Chime + Frost Shatter Crackle
      const iceNotes = [1760, 1479.98, 1174.66, 880];
      iceNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startT = now + idx * 0.04;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.28, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.30);
      });

    } else if (type === 'victory') {
      // Grand Championship Fanfare Chord Arpeggio
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.51];
      fanfare.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startT = now + idx * 0.085;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.34, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.44);
      });

    } else if (type === 'whoosh') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

    } else if (type === 'correct') {
      // Bright arcade victory chord arpeggio + high sparkle chime
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startT = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.32, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.34);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.36);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.25);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } else if (type === 'countdown') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    } else if (type === 'bomb') {
      // Deep 3D Bomb Explosion: Sub-bass boom + fiery blast rumble
      const bufferSize = Math.floor(ctx.sampleRate * 0.42);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(620, now);
      lp.frequency.exponentialRampToValueAtTime(65, now + 0.38);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.95, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.40);
      noise.connect(lp);
      lp.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      const boom = ctx.createOscillator();
      const bGain = ctx.createGain();
      boom.type = 'sawtooth';
      boom.frequency.setValueAtTime(150, now);
      boom.frequency.exponentialRampToValueAtTime(26, now + 0.36);
      bGain.gain.setValueAtTime(0.85, now);
      bGain.gain.exponentialRampToValueAtTime(0.005, now + 0.38);
      boom.connect(bGain);
      bGain.connect(ctx.destination);
      boom.start(now);
      boom.stop(now + 0.40);
    } else if (type === 'powerup') {
      // Euphoric Arcade Power-Up Collect Arpeggio (x2, x3, Gold)
      const pNotes = [587.33, 783.99, 987.77, 1174.66, 1567.98];
      pNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const st = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, st);
        gain.gain.setValueAtTime(0.32, st);
        gain.gain.exponentialRampToValueAtTime(0.001, st + 0.26);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(st);
        osc.stop(st + 0.28);
      });
    } else if (type === 'zap') {
      // High-Voltage Lightning Bolt Strike SFX
      const zOsc = ctx.createOscillator();
      const zGain = ctx.createGain();
      zOsc.type = 'sawtooth';
      zOsc.frequency.setValueAtTime(2200, now);
      zOsc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
      zGain.gain.setValueAtTime(0.55, now);
      zGain.gain.exponentialRampToValueAtTime(0.005, now + 0.24);
      zOsc.connect(zGain);
      zGain.connect(ctx.destination);
      zOsc.start(now);
      zOsc.stop(now + 0.25);
    }
  };

  // Realistic human-like TTS narration
  const speakText = (text: string) => {
    if (!voiceEnabledRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/_+/g, " blank ")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const voices = window.speechSynthesis.getVoices();
      if (!preferredVoiceRef.current && voices.length > 0) {
        const best = voices.find(v => /Natural|Online|Google US English|Samantha|Victoria|Karen/i.test(v.name) && /en/i.test(v.lang))
          || voices.find(v => /en/i.test(v.lang));
        if (best) preferredVoiceRef.current = best;
      }
      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current;
        utterance.lang = preferredVoiceRef.current.lang || 'en-US';
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = 0.96;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  // Keyboard navigation in Study Mode
  useEffect(() => {
    if (screen !== 'study') return;
    const validQs = (activeQuiz.questions || []).filter(q => q && q.text && q.text.trim());
    const total = validQs.length || activeQuiz.questions.length || 1;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setStudyIndex(prev => (prev + 1) % total);
        setStudySelectedOption(null);
      } else if (e.key === 'ArrowLeft') {
        setStudyIndex(prev => (prev - 1 + total) % total);
        setStudySelectedOption(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, activeQuiz.questions]);

  // Helper to initialize players
  const createPlayerEngine = (id: number, name: string, isP2: boolean, totalPlayers: number = numPlayers) => {
    const baseX = isP2 ? 0.75 : (totalPlayers === 2 ? 0.25 : 0.50);
    return {
      id,
      name,
      isP2,
      score: 0,
      streak: 1,
      bestStreak: 1,
      hits: 0,
      correctHits: 0,
      wrongHits: 0,
      frozenTimer: 0,
      sideFrozen: false,
      theme: isP2 ? {
        isP2: true,
        hatMain: '#ef4444',
        hatDark: '#991b1b',
        hatLight: '#fca5a5',
        outline: '#450a0a',
        plume: '#7f1d1d',
        band: '#f59e0b',
        buckle: '#fde047',
        badgeRing: '#fca5a5',
        gloveMain: '#ef4444',
        gloveLight: '#fee2e2',
        gloveDark: '#b91c1c',
        gloveRim: '#fef2f2',
        swordColor: '#ef4444',
        swordCore: '#fff7ed',
        maskTrim: '#fca5a5'
      } : {
        isP2: false,
        hatMain: '#2563eb',
        hatDark: '#1e3a8a',
        hatLight: '#93c5fd',
        outline: '#172554',
        plume: '#1e3a8a',
        band: '#f59e0b',
        buckle: '#fde047',
        badgeRing: '#93c5fd',
        gloveMain: '#3b82f6',
        gloveLight: '#dbeafe',
        gloveDark: '#1d4ed8',
        gloveRim: '#eff6ff',
        swordColor: '#2563eb',
        swordCore: '#f0f9ff',
        maskTrim: '#93c5fd'
      },
      homeX: baseX,
      headX: baseX,
      headY: 0.34,
      headScale: 1.0,
      headTilt: 0,
      headDetected: false,
      lastHeadTime: 0,
      handX: baseX,
      handY: 0.58,
      prevHandX: baseX,
      prevHandY: 0.58,
      handScale: 1.0,
      vx: 0,
      vy: 0,
      speed: 0,
      slapAnim: 0,
      swordAngle: -0.75,
      swordAngVel: 0,
      swordLunge: 0,
      trail: [] as { x: number; y: number; tipX: number; tipY: number; life: number }[],
      hasDetectedHands: false,
      lastHandTime: 0,
      lastHandsFrameMs: 0,
      lastPointerTime: 0,
      lastDualHandTime: 0,
      dualHandsArmed: false,
      clapArmed: false,
      sepFrames: 0,
      peakArmedSep: 0,
      peakArmedSepPx: 0,
      lastArmedTime: 0,
      lastClosingVel: 0,
      lastClosingSpeedPx: 0,
      lastTwoHandSepDist: 1,
      lastTwoHandSepDistPx: 9999,
      lastTrueTwoHandsTime: 0,
      lastSeparatedHandsTime: 0,
      lastSlapSelectTime: 0,
      lastClapImpulseMs: 0,
      needsReopenSinceMs: 0,
      clapImpulseId: 0,
      consumedClapId: 0,
      pendingClap: null as { id: number; x: number; y: number; prevX: number; prevY: number; time: number; isSwat?: boolean } | null,
      clapTimer: 0,
      isClapping: false,
      clapMidX: baseX,
      clapMidY: 0.58,
      leftHand: {
        x: baseX - 0.13,
        y: 0.58,
        prevX: baseX - 0.13,
        prevY: 0.58,
        vx: 0,
        vy: 0,
        vxPx: 0,
        vyPx: 0,
        speed: 0,
        speedPx: 0,
        angle: -0.18,
        knifeAngle: -0.45,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        lastSeenTime: 0,
        lastSwatMs: 0,
        landmarks: null as any[] | null,
        trail: [] as { x: number; y: number; life: number }[]
      },
      rightHand: {
        x: baseX + 0.13,
        y: 0.58,
        prevX: baseX + 0.13,
        prevY: 0.58,
        vx: 0,
        vy: 0,
        vxPx: 0,
        vyPx: 0,
        speed: 0,
        speedPx: 0,
        angle: 0.18,
        knifeAngle: -2.69,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        lastSeenTime: 0,
        lastSwatMs: 0,
        landmarks: null as any[] | null,
        trail: [] as { x: number; y: number; life: number }[]
      }
    };
  };

  // Compute dynamic 3D hand scale & finger openness from 21 MediaPipe landmarks
  // Tracks real hand size 1:1 across the full camera depth range (from far away to close-up)
  const analyzeHandGeometry = (landmarks: any[]) => {
    const wrist = landmarks[0];
    const thumbCmc = landmarks[1];
    const thumbTip = landmarks[4];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const pinkyMcp = landmarks[17];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    const palmLength = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
    const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
    const wristToMiddleTip = Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y);
    const thumbToPinkyBase = Math.hypot(thumbCmc.x - pinkyMcp.x, thumbCmc.y - pinkyMcp.y);

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const bboxDiag = Math.hypot(bboxW, bboxH);
    const thumbPinkySpan = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);

    // Compact, proportional 3D glove scaling so the glove fits the player's palm without blocking answer cards
    const effectiveSpan = Math.max(
      wristToMiddleTip,
      bboxH,
      bboxW * 1.05,
      palmLength * 1.65,
      palmWidth * 1.75,
      thumbToPinkyBase * 1.55,
      bboxDiag * 0.70
    );
    const sizeMult = gloveSizeRef.current || 1.0;
    const rawScale = (((effectiveSpan / 0.22) * 0.72) + thumbPinkySpan * 0.12) * sizeMult;
    const scale = Math.max(0.68 * sizeMult, Math.min(1.18 * sizeMult, rawScale));

    const avgTipDist = (
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)
    ) / 4;
    const openness = Math.max(0.35, Math.min(1.35, avgTipDist / Math.max(0.04, palmLength * 1.75)));

    return { scale, openness, palmLength, bboxW, bboxH };
  };

  // MediaPipe Hands Results Handler:
  // - 1:1 object-cover projection
  // - Multi-cue ghost-skeleton deduplication (eliminates single-hand twin-skeleton false claps)
  // - Velocity-aware One-Euro style smoothing + shortest-arc angle filtering
  // - True physical Clap Impulse State Machine with mandatory arming & re-open hysteresis
  const onHandsResults = (results: any) => {
    const eng = engineRef.current;
    if (!eng) return;
    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const vw = videoRef.current?.videoWidth || 640;
    const vh = videoRef.current?.videoHeight || 480;
    const coverScale = Math.max(cw / vw, ch / vh);
    const drawW = vw * coverScale;
    const drawH = vh * coverScale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;

    const toCanvasNormX = (mirroredNormX: number) => ((mirroredNormX * drawW + offsetX) / cw);
    const toCanvasNormY = (normY: number) => ((normY * drawH + offsetY) / ch);

    const now = performance.now();
    const is2P = eng.numPlayers === 2;
    const BASE_HAND_GRACE_MS = 200;

    const smoothAngle = (cur: number, target: number, alpha: number) => {
      if (!Number.isFinite(cur)) return target;
      if (!Number.isFinite(target)) return cur;
      const diff = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
      return cur + diff * alpha;
    };

    const getSensParams = (combinedGloveRadiusPx: number) => {
      const sens = slapSensitivityRef.current || 'balanced';
      const courtMult = is2P ? 0.74 : 0.90;
      if (sens === 'easy') {
        return {
          armDistPx: Math.max(68, combinedGloveRadiusPx * 1.08 * courtMult),
          touchDistPx: Math.max(76, combinedGloveRadiusPx * 1.12),
          minCloseDeltaPx: Math.max(18, 24 * courtMult),
          minInwardSpeedPx: 68,
          swatSpeedPx: 220
        };
      }
      if (sens === 'precise') {
        return {
          armDistPx: Math.max(96, combinedGloveRadiusPx * 1.35 * courtMult),
          touchDistPx: Math.max(62, combinedGloveRadiusPx * 0.90),
          minCloseDeltaPx: Math.max(30, 42 * courtMult),
          minInwardSpeedPx: 145,
          swatSpeedPx: 390
        };
      }
      return {
        armDistPx: Math.max(80, combinedGloveRadiusPx * 1.18 * courtMult),
        touchDistPx: Math.max(70, combinedGloveRadiusPx * 1.02),
        minCloseDeltaPx: Math.max(22, 30 * courtMult),
        minInwardSpeedPx: 95,
        swatSpeedPx: 295
      };
    };

    const triggerClapImpulse = (player: any, midNormX: number, midNormY: number, prevMidNormX: number, prevMidNormY: number, isSwat: boolean = false) => {
      const nextId = (player.clapImpulseId || 0) + 1;
      player.clapImpulseId = nextId;
      player.lastClapImpulseMs = now;
      player.pendingClap = {
        id: nextId,
        x: midNormX,
        y: midNormY,
        prevX: prevMidNormX,
        prevY: prevMidNormY,
        time: now,
        isSwat
      };
      player.isClapping = true;
      player.clapTimer = 0.22;
      player.clapArmed = false;
      player.sepFrames = 0;
      player.peakArmedSep = 0;
      player.peakArmedSepPx = 0;
      player.needsReopenSinceMs = now;
      player.slapAnim = 1.0;
      player.swordLunge = 1.0;
      player.clapMidX = midNormX;
      player.clapMidY = midNormY;
      if (player.leftHand) player.leftHand.slapAnim = 1.0;
      if (player.rightHand) player.rightHand.slapAnim = 1.0;

      // Spawn immediate visual shockwave ring at the clap point so every clap feels 100% responsive
      eng.shockwaves.push({
        x: midNormX * cw,
        y: midNormY * ch,
        radius: 18,
        maxRadius: isSwat ? 78 : 96,
        color: player.isP2 ? '#fb7185' : '#38bdf8',
        life: 1.0
      });
    };

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      eng.players.forEach(p => {
        if (!p) return;
        const graceMs = (now - (p.lastTrueTwoHandsTime || 0) < 1400 || (p.clapTimer && p.clapTimer > 0)) ? 850 : 380;
        if (now - (p.leftHand.lastSeenTime || 0) > graceMs) {
          p.leftHand.detected = false;
          p.leftHand.landmarks = null;
          p.leftHand.vx = 0;
          p.leftHand.vy = 0;
          p.leftHand.speed = 0;
          p.leftHand.speedPx = 0;
        }
        if (now - (p.rightHand.lastSeenTime || 0) > graceMs) {
          p.rightHand.detected = false;
          p.rightHand.landmarks = null;
          p.rightHand.vx = 0;
          p.rightHand.vy = 0;
          p.rightHand.speed = 0;
          p.rightHand.speedPx = 0;
        }
        if ((!p.leftHand.detected || !p.rightHand.detected) && (!p.clapTimer || p.clapTimer <= 0)) {
          p.isClapping = false;
        }
        if (now - (p.lastHandTime || 0) > 650) {
          p.hasDetectedHands = false;
          p.dualHandsArmed = false;
          p.clapArmed = false;
          p.sepFrames = 0;
          p.peakArmedSep = 0;
          p.peakArmedSepPx = 0;
          p.needsReopenSinceMs = 0;
          if (!p.clapTimer || p.clapTimer <= 0) {
            p.isClapping = false;
          }
        }
      });
      return;
    }

    const allDetectedHands: any[] = [];

    results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
      if (!landmarks || landmarks.length < 21) return;
      const handedness = results.multiHandedness?.[handIndex]?.label || '';
      const confidence = results.multiHandedness?.[handIndex]?.score ?? 0.8;
      if (confidence < 0.45) return;

      const wrist = landmarks[0];
      const indexMcp = landmarks[5];
      const middleMcp = landmarks[9];
      const ringMcp = landmarks[13];
      const pinkyMcp = landmarks[17];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];

      const mirroredLandmarks = landmarks.map((lm: any) => ({
        x: toCanvasNormX(1.0 - lm.x),
        y: toCanvasNormY(lm.y),
        z: lm.z || 0
      }));

      let minLmX = 1, maxLmX = 0, minLmY = 1, maxLmY = 0;
      mirroredLandmarks.forEach((lm: any) => {
        if (lm.x < minLmX) minLmX = lm.x;
        if (lm.x > maxLmX) maxLmX = lm.x;
        if (lm.y < minLmY) minLmY = lm.y;
        if (lm.y > maxLmY) maxLmY = lm.y;
      });

      // Reject tiny background artifacts (< 2.8% of frame) or full-frame glitches (> 68% of frame)
      const bboxSpan = Math.hypot(maxLmX - minLmX, maxLmY - minLmY);
      if (bboxSpan < 0.028 || bboxSpan > 0.72) return;

      const bboxCenterX = (minLmX + maxLmX) * 0.5;
      const bboxCenterY = (minLmY + maxLmY) * 0.5;

      const anatomicalMirroredX = 1.0 - (
        wrist.x * 0.16 +
        middleMcp.x * 0.28 +
        indexMcp.x * 0.15 +
        ringMcp.x * 0.13 +
        pinkyMcp.x * 0.08 +
        middleTip.x * 0.12 +
        ringTip.x * 0.08
      );
      const anatomicalNormY =
        wrist.y * 0.16 +
        middleMcp.y * 0.28 +
        indexMcp.y * 0.15 +
        ringMcp.y * 0.13 +
        pinkyMcp.y * 0.08 +
        middleTip.y * 0.12 +
        ringTip.y * 0.08;

      const rawX = toCanvasNormX(anatomicalMirroredX) * 0.68 + bboxCenterX * 0.32;
      const rawY = toCanvasNormY(anatomicalNormY) * 0.68 + bboxCenterY * 0.32;
      const rawWristX = toCanvasNormX(1.0 - wrist.x);
      const rawWristY = toCanvasNormY(wrist.y);

      const aimX = toCanvasNormX(1.0 - ((indexTip.x + middleTip.x + middleMcp.x) / 3));
      const aimY = toCanvasNormY((indexTip.y + middleTip.y + middleMcp.y) / 3);
      const dx = aimX - rawWristX;
      const dy = aimY - rawWristY;
      const gloveAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const pointingAngle = Math.atan2(dy, dx);

      const { scale, openness } = analyzeHandGeometry(landmarks);

      allDetectedHands.push({
        rawX,
        rawY,
        rawWristX,
        rawWristY,
        gloveAngle,
        pointingAngle,
        scale,
        openness,
        handedness,
        confidence,
        landmarks: mirroredLandmarks,
        bbox: { minX: minLmX, maxX: maxLmX, minY: minLmY, maxY: maxLmY }
      });
    });

    const rawPlayerHands: { [key: number]: any[] } = { 0: [], 1: [] };
    if (!is2P) {
      allDetectedHands.forEach(h => {
        rawPlayerHands[0].push({
          ...h,
          clampedX: Math.max(0.02, Math.min(0.98, h.rawX)),
          clampedY: Math.max(0.02, Math.min(0.98, h.rawY))
        });
      });
    } else {
      allDetectedHands.forEach(h => {
        let pIdx = h.rawX < 0.5 ? 0 : 1;
        // If a hand is near the center court divider (0.36..0.64), check if it belongs to a player whose tracked hand was right there
        if (h.rawX >= 0.36 && h.rawX <= 0.64) {
          const p0 = eng.players[0];
          const p1 = eng.players[1];
          const p0Active = p0 && (now - (p0.lastHandTime || 0) < 600);
          const p1Active = p1 && (now - (p1.lastHandTime || 0) < 600);
          if (p1Active && !p0Active && h.rawX >= 0.36) {
            pIdx = 1;
          } else if (p0Active && !p1Active && h.rawX <= 0.64) {
            pIdx = 0;
          }
        }
        rawPlayerHands[pIdx].push(h);
      });
      // Reunite a player's two hands if one hand straddled slightly across the 0.5 center divider during a clap!
      if (rawPlayerHands[0].length >= 1 && rawPlayerHands[1].length >= 1) {
        for (let i = rawPlayerHands[0].length - 1; i >= 0; i--) {
          const h0 = rawPlayerHands[0][i];
          if (h0.rawX < 0.35) continue;
          for (let j = rawPlayerHands[1].length - 1; j >= 0; j--) {
            const h1 = rawPlayerHands[1][j];
            if (h1.rawX > 0.65) continue;
            const pairSpan = Math.hypot(h1.rawX - h0.rawX, h1.rawY - h0.rawY);
            const verticalDiff = Math.abs(h1.rawY - h0.rawY);
            const midX = (h0.rawX + h1.rawX) * 0.5;
            if (pairSpan < 0.28 && verticalDiff < 0.22) {
              const targetPlayer = midX < 0.5 ? 0 : 1;
              if (targetPlayer === 0 && rawPlayerHands[0].length < 2) {
                rawPlayerHands[0].push(rawPlayerHands[1].splice(j, 1)[0]);
                break;
              } else if (targetPlayer === 1 && rawPlayerHands[1].length < 2) {
                rawPlayerHands[1].push(rawPlayerHands[0].splice(i, 1)[0]);
                break;
              }
            }
          }
        }
      }
      [0, 1].forEach(pIdx => {
        rawPlayerHands[pIdx] = rawPlayerHands[pIdx].map(h => {
          const clampedX = pIdx === 0
            ? Math.min(0.490, Math.max(0.025, h.rawX))
            : Math.max(0.510, Math.min(0.975, h.rawX));
          const clampedY = Math.max(0.03, Math.min(0.97, h.rawY));
          const shiftX = clampedX - h.rawX;
          const shiftY = clampedY - h.rawY;
          const shiftedLandmarks = h.landmarks
            ? h.landmarks.map((lm: any) => ({
                x: lm.x + shiftX,
                y: lm.y + shiftY,
                z: lm.z
              }))
            : h.landmarks;
          return {
            ...h,
            clampedX,
            clampedY,
            landmarks: shiftedLandmarks,
            bbox: h.bbox
              ? {
                  minX: h.bbox.minX + shiftX,
                  maxX: h.bbox.maxX + shiftX,
                  minY: h.bbox.minY + shiftY,
                  maxY: h.bbox.maxY + shiftY
                }
              : undefined
          };
        });
      });
    }

    [0, 1].forEach(pIdx => {
      if (pIdx === 1 && !is2P) return;
      const player = eng.players[pIdx];
      if (!player) return;

      const dtHandsSec = player.lastHandsFrameMs > 0
        ? Math.max(0.008, Math.min(0.12, (now - player.lastHandsFrameMs) / 1000))
        : (1 / 30);
      player.lastHandsFrameMs = now;

      const rawHands = rawPlayerHands[pIdx] || [];
      const lh = player.leftHand;
      const rh = player.rightHand;
      const hadTwoHandsRecently =
        (now - (player.lastTrueTwoHandsTime || 0) < 1600) ||
        (lh.detected && rh.detected);

      // 1. MULTI-CUE GHOST-TWIN DEDUPLICATION:
      // Only remove a second skeleton if it is literally an identical duplicate overlay on the exact same physical hand,
      // so two real hands coming close together to slap NEVER delete each other!
      const dedupedHands: any[] = [];
      rawHands
        .sort((a, b) => ((b.confidence || 0) * 0.68 + Math.min(1.2, b.scale || 1) * 0.32) - ((a.confidence || 0) * 0.68 + Math.min(1.2, a.scale || 1) * 0.32))
        .forEach(candidate => {
          const isGhostTwin = dedupedHands.some(existing => {
            const centerDist = Math.hypot(candidate.clampedX - existing.clampedX, candidate.clampedY - existing.clampedY);
            const wristDist = Math.hypot(candidate.rawWristX - existing.rawWristX, candidate.rawWristY - existing.rawWristY);
            const sameHandedness = candidate.handedness && existing.handedness && candidate.handedness === existing.handedness;

            let lmMeanDist = centerDist;
            if (candidate.landmarks?.length >= 21 && existing.landmarks?.length >= 21) {
              let sum = 0;
              const probeIds = [0, 4, 5, 8, 9, 12, 13, 16, 17, 20];
              for (let k = 0; k < probeIds.length; k++) {
                const id = probeIds[k];
                sum += Math.hypot(
                  candidate.landmarks[id].x - existing.landmarks[id].x,
                  candidate.landmarks[id].y - existing.landmarks[id].y
                );
              }
              lmMeanDist = sum / probeIds.length;
            }

            // Literal duplicate skeleton on the exact same palm
            if (lmMeanDist < 0.019 && wristDist < 0.022 && centerDist < 0.022) return true;
            // Same handedness label on virtually identical wrist/palm
            if (sameHandedness && lmMeanDist < 0.028 && wristDist < 0.030) return true;
            // Only when the player has NOT had 2 hands active recently, filter tight single-hand ghost twin
            if (!hadTwoHandsRecently && lmMeanDist < 0.032 && wristDist < 0.034 && centerDist < 0.032) {
              return true;
            }
            return false;
          });
          if (!isGhostTwin) {
            dedupedHands.push(candidate);
          }
        });

      const handsForPlayer = dedupedHands
        .sort((a, b) => (b.scale || 1) - (a.scale || 1))
        .slice(0, 2);

      const HAND_GRACE_MS = (hadTwoHandsRecently || (player.clapTimer && player.clapTimer > 0)) ? 950 : 480;

      if (handsForPlayer.length === 0) {
        if (now - (lh.lastSeenTime || 0) > HAND_GRACE_MS) {
          lh.detected = false;
          lh.landmarks = null;
          lh.vx = 0;
          lh.vy = 0;
          lh.speed = 0;
          lh.speedPx = 0;
        }
        if (now - (rh.lastSeenTime || 0) > HAND_GRACE_MS) {
          rh.detected = false;
          rh.landmarks = null;
          rh.vx = 0;
          rh.vy = 0;
          rh.speed = 0;
          rh.speedPx = 0;
        }
        if ((!lh.detected || !rh.detected) && (!player.clapTimer || player.clapTimer <= 0)) {
          player.isClapping = false;
          player.clapTimer = 0;
        }
        if (now - (player.lastHandTime || 0) > 650) {
          player.hasDetectedHands = false;
          player.dualHandsArmed = false;
          player.clapArmed = false;
          player.sepFrames = 0;
          player.peakArmedSep = 0;
          player.peakArmedSepPx = 0;
          player.needsReopenSinceMs = 0;
          if (!player.clapTimer || player.clapTimer <= 0) {
            player.isClapping = false;
          }
        }
        return;
      }

      player.hasDetectedHands = true;
      player.lastHandTime = now;

      // Adaptive velocity-aware hand state updater (rock-steady when hovering, instant 1:1 when swinging)
      const applySmoothedHand = (handSlot: any, data: any) => {
        const freshlyTracked = handSlot.detected && (now - (handSlot.lastSeenTime || 0) <= 150);
        const rawStep = freshlyTracked ? Math.hypot(data.clampedX - handSlot.x, data.clampedY - handSlot.y) : 999;

        if (!freshlyTracked || rawStep > 0.30) {
          // Fresh hand entry or jump recovery: snap cleanly with zero fake velocity spike
          handSlot.prevX = data.clampedX;
          handSlot.prevY = data.clampedY;
          handSlot.x = data.clampedX;
          handSlot.y = data.clampedY;
          handSlot.vx = 0;
          handSlot.vy = 0;
          handSlot.vxPx = 0;
          handSlot.vyPx = 0;
          handSlot.speed = 0;
          handSlot.speedPx = 0;
          handSlot.angle = data.gloveAngle;
          handSlot.knifeAngle = data.pointingAngle;
          handSlot.scale = data.scale;
        } else {
          // Adaptive One-Euro style filter: 0.42 when nearly still to kill webcam jitter, up to 0.90 during fast swings
          const posAlpha = Math.max(0.42, Math.min(0.92, 0.38 + rawStep * 14.0));
          const nextX = handSlot.x + (data.clampedX - handSlot.x) * posAlpha;
          const nextY = handSlot.y + (data.clampedY - handSlot.y) * posAlpha;
          handSlot.prevX = handSlot.x;
          handSlot.prevY = handSlot.y;
          handSlot.x = nextX;
          handSlot.y = nextY;

          const instVx = nextX - handSlot.prevX;
          const instVy = nextY - handSlot.prevY;
          handSlot.vx = instVx * 0.62 + (handSlot.vx || 0) * 0.38;
          handSlot.vy = instVy * 0.62 + (handSlot.vy || 0) * 0.38;
          handSlot.speed = Math.hypot(handSlot.vx, handSlot.vy);

          const instVxPx = ((nextX - handSlot.prevX) * cw) / dtHandsSec;
          const instVyPx = ((nextY - handSlot.prevY) * ch) / dtHandsSec;
          handSlot.vxPx = instVxPx * 0.60 + (handSlot.vxPx || 0) * 0.40;
          handSlot.vyPx = instVyPx * 0.60 + (handSlot.vyPx || 0) * 0.40;
          handSlot.speedPx = Math.hypot(handSlot.vxPx, handSlot.vyPx);

          handSlot.angle = smoothAngle(handSlot.angle, data.gloveAngle, 0.55);
          handSlot.knifeAngle = smoothAngle(handSlot.knifeAngle, data.pointingAngle, 0.62);
          handSlot.scale = handSlot.scale + (data.scale - handSlot.scale) * 0.45;
        }

        const shiftLmX = handSlot.x - data.clampedX;
        const shiftLmY = handSlot.y - data.clampedY;
        handSlot.openness = data.openness;
        handSlot.landmarks = data.landmarks
          ? data.landmarks.map((lm: any) => ({ x: lm.x + shiftLmX, y: lm.y + shiftLmY, z: lm.z }))
          : null;
        handSlot.detected = true;
        handSlot.lastSeenTime = now;
        handSlot.trail.push({ x: handSlot.x, y: handSlot.y, life: 1.0 });
        if (handSlot.trail.length > 7) handSlot.trail.shift();
      };

      handsForPlayer.sort((a, b) => a.clampedX - b.clampedX);
      let fastestHand = handsForPlayer[0];
      const userSizeMult = gloveSizeRef.current || 1.0;
      const isSwatMode = slapModeRef.current === 'swat';

      if (handsForPlayer.length >= 2) {
        let leftData = handsForPlayer[0];
        let rightData = handsForPlayer[handsForPlayer.length - 1];

        // Temporal bipartite matching so Left & Right gloves never flip slots during vertical or angled claps
        if (
          lh.detected &&
          rh.detected &&
          (now - (lh.lastSeenTime || 0) < 320) &&
          (now - (rh.lastSeenTime || 0) < 320)
        ) {
          const lhPredX = lh.x + (lh.vx || 0) * 0.35;
          const lhPredY = lh.y + (lh.vy || 0) * 0.35;
          const rhPredX = rh.x + (rh.vx || 0) * 0.35;
          const rhPredY = rh.y + (rh.vy || 0) * 0.35;
          const costDirect =
            Math.hypot(leftData.clampedX - lhPredX, leftData.clampedY - lhPredY) +
            Math.hypot(rightData.clampedX - rhPredX, rightData.clampedY - rhPredY);
          const costSwapped =
            Math.hypot(rightData.clampedX - lhPredX, rightData.clampedY - lhPredY) +
            Math.hypot(leftData.clampedX - rhPredX, leftData.clampedY - rhPredY) +
            0.024;
          if (costSwapped < costDirect) {
            const tmp = leftData;
            leftData = rightData;
            rightData = tmp;
          }
        }

        const prevMidNormX = (lh.x + rh.x) * 0.5;
        const prevMidNormY = (lh.y + rh.y) * 0.5;

        applySmoothedHand(lh, leftData);
        applySmoothedHand(rh, rightData);

        const sepDist = Math.hypot(rh.x - lh.x, rh.y - lh.y);
        const sepDistPx = Math.hypot((rh.x - lh.x) * cw, (rh.y - lh.y) * ch);

        let minLandmarkDistPx = sepDistPx;
        if (lh.landmarks && rh.landmarks) {
          const palmProbe = [0, 1, 4, 5, 8, 9, 12, 13, 16, 17, 20];
          for (let i = 0; i < palmProbe.length; i++) {
            const lmL = lh.landmarks[palmProbe[i]];
            if (!lmL) continue;
            for (let j = 0; j < palmProbe.length; j++) {
              const lmR = rh.landmarks[palmProbe[j]];
              if (!lmR) continue;
              const dLmPx = Math.hypot((lmR.x - lmL.x) * cw, (lmR.y - lmL.y) * ch);
              if (dLmPx < minLandmarkDistPx) minLandmarkDistPx = dLmPx;
            }
          }
        }

        // Compute TRUE radial inward closing speed (px/sec) along the inter-hand axis:
        // Positive ONLY when Left & Right hands move TOWARD each other; ~0 when both hands move sideways together!
        const axisDxPx = (rh.x - lh.x) * cw;
        const axisDyPx = (rh.y - lh.y) * ch;
        const axisLenPx = Math.max(1, Math.hypot(axisDxPx, axisDyPx));
        const unitX = axisDxPx / axisLenPx;
        const unitY = axisDyPx / axisLenPx;
        const relVelX = (lh.vxPx || 0) - (rh.vxPx || 0);
        const relVelY = (lh.vyPx || 0) - (rh.vyPx || 0);
        const radialInwardSpeedPx = Math.max(0, relVelX * unitX + relVelY * unitY);
        const prevSepPx = player.lastTwoHandSepDistPx < 9000 ? player.lastTwoHandSepDistPx : sepDistPx;
        const frameDropSpeedPx = Math.max(0, (prevSepPx - sepDistPx) / dtHandsSec);
        const closingSpeedPx = Math.max(radialInwardSpeedPx, frameDropSpeedPx * 0.85);

        const leftGloveRadiusPx = 46 * Math.max(0.75, Math.min(1.48, lh.scale)) * userSizeMult;
        const rightGloveRadiusPx = 46 * Math.max(0.75, Math.min(1.48, rh.scale)) * userSizeMult;
        const combinedGloveRadiusPx = leftGloveRadiusPx + rightGloveRadiusPx;
        const { armDistPx, touchDistPx, minCloseDeltaPx, minInwardSpeedPx, swatSpeedPx } = getSensParams(combinedGloveRadiusPx);

        player.dualHandsArmed = true;
        player.lastTrueTwoHandsTime = now;
        player.lastTwoHandSepDist = sepDist;
        player.lastTwoHandSepDistPx = sepDistPx;
        player.lastClosingVel = Math.max(0, sepDist);
        player.lastClosingSpeedPx = closingSpeedPx;

        // STEP 1: ARMING & RE-OPEN HYSTERESIS
        const canReArm = sepDistPx >= armDistPx || (sepDistPx >= touchDistPx * 1.15 && (now - (player.lastClapImpulseMs || 0) > 320));
        if (canReArm) {
          player.sepFrames = Math.min(10, (player.sepFrames || 0) + 1);
          player.lastSeparatedHandsTime = now;
          player.needsReopenSinceMs = 0;
          player.clapArmed = true;
          player.lastArmedTime = now;
          player.peakArmedSep = Math.max(player.peakArmedSep || 0, sepDist);
          player.peakArmedSepPx = Math.max(player.peakArmedSepPx || 0, sepDistPx);
          if (!player.clapTimer || player.clapTimer <= 0) {
            player.isClapping = false;
          }
        } else if (player.clapArmed) {
          player.peakArmedSepPx = Math.max(player.peakArmedSepPx || 0, sepDistPx);
        }

        // STEP 2: PHYSICAL CLAP IMPULSE DETECTION (Fires ONCE per real clap, then requires re-opening hands!)
        const closeDeltaPx = (player.peakArmedSepPx || 0) - sepDistPx;
        const cooldownReady = (now - (player.lastClapImpulseMs || 0)) >= 280;
        const isGloveContact =
          sepDistPx <= touchDistPx ||
          (minLandmarkDistPx <= 28 && sepDistPx <= touchDistPx * 1.22);
        const isDynamicCatch =
          closingSpeedPx >= minInwardSpeedPx * 1.85 &&
          sepDistPx <= touchDistPx * 1.24 &&
          closeDeltaPx >= minCloseDeltaPx;

        if (
          !isSwatMode &&
          player.clapArmed &&
          cooldownReady &&
          closeDeltaPx >= minCloseDeltaPx * 0.85 &&
          ((isGloveContact && closingSpeedPx >= minInwardSpeedPx * 0.80) ||
            (sepDistPx <= touchDistPx * 0.84 && closeDeltaPx >= minCloseDeltaPx) ||
            isDynamicCatch)
        ) {
          const midX = (lh.x + rh.x) * 0.5;
          const midY = (lh.y + rh.y) * 0.5;
          triggerClapImpulse(player, midX, midY, prevMidNormX, prevMidNormY, false);

          // Keep both gloves visibly side-by-side on impact so neither glove ever disappears
          if (Math.abs(rh.x - lh.x) < 0.022 && Math.abs(rh.y - lh.y) < 0.032) {
            lh.x = midX - 0.016;
            rh.x = midX + 0.016;
          }
        } else if (isSwatMode && cooldownReady) {
          // One-Hand Swat Mode with 2 hands visible: trigger on brisk swat motion from either hand
          if (lh.speedPx >= swatSpeedPx && now - (lh.lastSwatMs || 0) >= 340) {
            lh.lastSwatMs = now;
            triggerClapImpulse(player, lh.x, lh.y, lh.prevX, lh.prevY, true);
          } else if (rh.speedPx >= swatSpeedPx && now - (rh.lastSwatMs || 0) >= 340) {
            rh.lastSwatMs = now;
            triggerClapImpulse(player, rh.x, rh.y, rh.prevX, rh.prevY, true);
          }
        }

        const meanScale = (lh.scale + rh.scale) * 0.5;
        player.handScale = player.handScale + (meanScale - player.handScale) * 0.55;
        fastestHand = rh.speed >= lh.speed
          ? { ...rightData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y, scale: meanScale }
          : { ...leftData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y, scale: meanScale };
      } else {
        // ONLY 1 HAND RETURNED BY MEDIAPIPE IN THIS FRAME:
        // When slapping, one hand frequently occludes the other hand on camera!
        // We MUST keep both gloves visible when slapping or when 2 hands were recently tracked,
        // and fire the clap impulse whenever the visible hand meets the other hand's position!
        const hData = handsForPlayer[0];
        const prevMidX = (lh.x + rh.x) * 0.5;
        const prevMidY = (lh.y + rh.y) * 0.5;
        const distToPrevMidPx = Math.hypot((hData.clampedX - prevMidX) * cw, (hData.clampedY - prevMidY) * ch);
        const distToLeft = Math.hypot(hData.clampedX - lh.x, hData.clampedY - lh.y);
        const distToRight = Math.hypot(hData.clampedX - rh.x, hData.clampedY - rh.y);
        const distToLeftPx = Math.hypot((hData.clampedX - lh.x) * cw, (hData.clampedY - lh.y) * ch);
        const distToRightPx = Math.hypot((hData.clampedX - rh.x) * cw, (hData.clampedY - rh.y) * ch);
        const maxDistToEitherHandPx = Math.max(distToLeftPx, distToRightPx);

        const combinedRadiusPx = (
          46 * Math.max(0.75, lh.scale || 0.95) +
          46 * Math.max(0.75, rh.scale || 0.95)
        ) * userSizeMult;
        const { touchDistPx, swatSpeedPx } = getSensParams(combinedRadiusPx);

        const isSwatModeSingle = slapModeRef.current === 'swat';
        const recentTwoHands = (now - (player.lastTrueTwoHandsTime || 0) <= 950);

        // If 2 hands were tracked recently and the single visible hand is near the midpoint or the other hand,
        // MediaPipe merged the two palms into 1 silhouette during a clap/slap!
        const trueClapOcclusionMerge = Boolean(
          !isSwatModeSingle &&
          recentTwoHands &&
          (player.clapArmed || (player.lastTwoHandSepDistPx || 0) >= touchDistPx * 0.95) &&
          (now - (player.lastClapImpulseMs || 0) >= 280) &&
          (maxDistToEitherHandPx <= touchDistPx * 1.55 ||
            distToPrevMidPx <= Math.max(92, combinedRadiusPx * 1.12))
        );

        const sustainRecentMergedClap = Boolean(
          !isSwatModeSingle &&
          (player.isClapping || (player.clapTimer && player.clapTimer > 0) || (now - (player.lastClapImpulseMs || 0) <= 360)) &&
          distToPrevMidPx <= Math.max(115, combinedRadiusPx * 1.35)
        );

        if (trueClapOcclusionMerge || sustainRecentMergedClap) {
          // Keep BOTH gloves visible side-by-side at the slap impact point so one glove NEVER goes missing!
          const contactHalfGap = Math.max(0.016, Math.min(0.026, (combinedRadiusPx * 0.30) / cw));
          lh.prevX = lh.x;
          lh.prevY = lh.y;
          rh.prevX = rh.x;
          rh.prevY = rh.y;
          lh.x = hData.clampedX - contactHalfGap;
          lh.y = hData.clampedY;
          rh.x = hData.clampedX + contactHalfGap;
          rh.y = hData.clampedY;
          lh.vx = lh.x - lh.prevX;
          lh.vy = lh.y - lh.prevY;
          rh.vx = rh.x - rh.prevX;
          rh.vy = rh.y - rh.prevY;
          lh.speed = Math.hypot(lh.vx, lh.vy);
          rh.speed = Math.hypot(rh.vx, rh.vy);
          lh.angle = -0.14;
          rh.angle = 0.14;
          lh.scale = hData.scale;
          rh.scale = hData.scale;
          lh.openness = hData.openness;
          rh.openness = hData.openness;
          lh.landmarks = hData.landmarks;
          rh.landmarks = hData.landmarks;
          lh.detected = true;
          rh.detected = true;
          lh.lastSeenTime = now;
          rh.lastSeenTime = now;

          if (trueClapOcclusionMerge) {
            triggerClapImpulse(player, hData.clampedX, hData.clampedY, prevMidX, prevMidY, false);
          } else {
            player.clapMidX = hData.clampedX;
            player.clapMidY = hData.clampedY;
          }
          fastestHand = { ...hData, speed: Math.max(0.05, lh.speed, rh.speed), vx: lh.vx, vy: lh.vy, x: hData.clampedX, y: hData.clampedY };
        } else {
          // Single hand detected and separated from the other hand:
          // Update the matching hand AND keep the other hand alive during HAND_GRACE_MS (up to 950ms) so it never blinks out!
          if (!player.clapTimer || player.clapTimer <= 0) {
            player.isClapping = false;
          }
          if (now - (player.lastTrueTwoHandsTime || 0) > 950) {
            player.dualHandsArmed = false;
            player.clapArmed = false;
            player.sepFrames = 0;
            player.peakArmedSep = 0;
            player.peakArmedSepPx = 0;
            player.needsReopenSinceMs = 0;
          }

          const anchorCenter = player.headDetected ? player.headX : (is2P ? (pIdx === 0 ? 0.25 : 0.75) : 0.50);
          let isLeftHand = hData.handedness ? (hData.handedness === 'Right') : (hData.clampedX < anchorCenter);
          if (lh.detected && !rh.detected && distToLeft < 0.28) {
            isLeftHand = true;
          } else if (rh.detected && !lh.detected && distToRight < 0.28) {
            isLeftHand = false;
          } else if (lh.detected && rh.detected) {
            isLeftHand = distToLeft <= distToRight;
          }

          if (isLeftHand) {
            applySmoothedHand(lh, hData);
            if (isSwatModeSingle && lh.speedPx >= swatSpeedPx && now - (lh.lastSwatMs || 0) >= 340 && now - (player.lastClapImpulseMs || 0) >= 280) {
              lh.lastSwatMs = now;
              triggerClapImpulse(player, lh.x, lh.y, lh.prevX, lh.prevY, true);
            }
            if (now - (rh.lastSeenTime || 0) <= HAND_GRACE_MS) {
              // Keep right glove visible & gently coasting so it never suddenly vanishes during a swing!
              rh.detected = true;
              rh.vx *= 0.75;
              rh.vy *= 0.75;
            } else {
              rh.detected = false;
              rh.landmarks = null;
              rh.vx = 0;
              rh.vy = 0;
              rh.speed = 0;
              rh.speedPx = 0;
            }
            fastestHand = { ...hData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y, scale: lh.scale };
          } else {
            applySmoothedHand(rh, hData);
            if (isSwatModeSingle && rh.speedPx >= swatSpeedPx && now - (rh.lastSwatMs || 0) >= 340 && now - (player.lastClapImpulseMs || 0) >= 280) {
              rh.lastSwatMs = now;
              triggerClapImpulse(player, rh.x, rh.y, rh.prevX, rh.prevY, true);
            }
            if (now - (lh.lastSeenTime || 0) <= HAND_GRACE_MS) {
              // Keep left glove visible & gently coasting so it never suddenly vanishes during a swing!
              lh.detected = true;
              lh.vx *= 0.75;
              lh.vy *= 0.75;
            } else {
              lh.detected = false;
              lh.landmarks = null;
              lh.vx = 0;
              lh.vy = 0;
              lh.speed = 0;
              lh.speedPx = 0;
            }
            fastestHand = { ...hData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y, scale: rh.scale };
          }

          player.handScale = player.handScale + (fastestHand.scale - player.handScale) * 0.55;
        }
      }

      updatePlayerArm(pIdx, fastestHand.x ?? fastestHand.clampedX, fastestHand.y ?? fastestHand.clampedY, fastestHand.pointingAngle, player.handScale);
    });
  };

  // Always keep latest onHandsResults in ref so MediaPipe never calls a stale closure!
  onHandsResultsRef.current = onHandsResults;

  // MediaPipe FaceDetection Results Handler (Locks onto true face center, face width, and head tilt angle!)
  const onFaceDetectionResults = (results: any) => {
    const eng = engineRef.current;
    if (!eng || !results?.detections || results.detections.length === 0) return;

    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const vw = videoRef.current?.videoWidth || 640;
    const vh = videoRef.current?.videoHeight || 480;
    const coverScale = Math.max(cw / vw, ch / vh);
    const drawW = vw * coverScale;
    const drawH = vh * coverScale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;

    const toCanvasNormX = (mirroredNormX: number) => ((mirroredNormX * drawW + offsetX) / cw);
    const toCanvasNormY = (normY: number) => ((normY * drawH + offsetY) / ch);

    const now = performance.now();
    const is2P = eng.numPlayers === 2;

    const sortedDetections = [...results.detections].sort((a: any, b: any) => {
      const wa = a.boundingBox?.width || a.locationData?.relativeBoundingBox?.width || 0;
      const wb = b.boundingBox?.width || b.locationData?.relativeBoundingBox?.width || 0;
      return wb - wa;
    });

    const assignedPlayer: Record<number, boolean> = {};

    sortedDetections.forEach((det: any) => {
      const bb = det.boundingBox || det.locationData?.relativeBoundingBox;
      if (!bb) return;

      const rawCenterX = bb.xCenter !== undefined ? bb.xCenter : ((bb.xmin || 0) + (bb.width || 0) * 0.5);
      const rawCenterY = bb.yCenter !== undefined ? bb.yCenter : ((bb.ymin || 0) + (bb.height || 0) * 0.5);
      const rawW = bb.width || 0.22;

      const lms = det.landmarks || det.locationData?.relativeKeypoints || [];
      const rightEye = lms[0];
      const leftEye = lms[1];
      const noseTip = lms[2];

      let faceMirroredX = 1.0 - rawCenterX;
      let faceCenterNormY = rawCenterY;
      let headTilt = 0;

      if (rightEye && leftEye) {
        const rx = 1.0 - rightEye.x;
        const lx = 1.0 - leftEye.x;
        const ry = rightEye.y;
        const ly = leftEye.y;
        const eyeMidX = (rx + lx) * 0.5;
        const eyeMidY = (ry + ly) * 0.5;
        faceMirroredX = noseTip ? (eyeMidX * 0.55 + (1.0 - noseTip.x) * 0.45) : eyeMidX;
        faceCenterNormY = noseTip ? (eyeMidY * 0.48 + noseTip.y * 0.52) : eyeMidY;
        const dx = lx - rx;
        const dy = ly - ry;
        if (Math.abs(dx) > 0.01) {
          headTilt = Math.max(-0.36, Math.min(0.36, Math.atan2(dy, Math.abs(dx)) * (dx >= 0 ? 1 : -1)));
        }
      }

      const canvasX = toCanvasNormX(faceMirroredX);
      const canvasY = toCanvasNormY(faceCenterNormY);

      const pIdx = is2P ? (canvasX < 0.5 ? 0 : 1) : 0;
      if (assignedPlayer[pIdx]) return;
      const player = eng.players[pIdx];
      if (!player) return;

      if (is2P && canvasX > 0.46 && canvasX < 0.54) return;
      assignedPlayer[pIdx] = true;

      const clampedX = is2P
        ? (pIdx === 0 ? Math.min(0.42, Math.max(0.08, canvasX)) : Math.max(0.58, Math.min(0.92, canvasX)))
        : Math.max(0.10, Math.min(0.90, canvasX));
      const clampedY = Math.max(0.18, Math.min(0.72, canvasY));

      const faceCanvasWidthRatio = (rawW * drawW) / cw;
      const targetScale = Math.max(0.75, Math.min(2.35, faceCanvasWidthRatio * 5.2));

      player.headX += (clampedX - player.headX) * 0.65;
      player.headY += (clampedY - player.headY) * 0.65;
      player.headScale += (targetScale - player.headScale) * 0.50;
      player.headTilt = (player.headTilt || 0) + (headTilt - (player.headTilt || 0)) * 0.48;
      player.headDetected = true;
      player.lastHeadTime = now;
    });
  };

  onFaceResultsRef.current = onFaceDetectionResults;

  // High-Precision Player Head Tracker (Browser FaceDetector + 2D Multi-Scale Head-Oval vs. Surround Integral Detector)
  // Accurately tracks the player's actual head position (X, Y), head scale, and tilt in both front-lit and backlit rooms!
  const trackHeadsFromVideoFrame = async (video: HTMLVideoElement) => {
    const eng = engineRef.current;
    if (!eng || !video || video.readyState < 2) return;
    const now = performance.now();
    const is2P = eng.numPlayers === 2;

    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const coverScale = Math.max(cw / vw, ch / vh);
    const drawW = vw * coverScale;
    const drawH = vh * coverScale;
    const offsetX = (cw - drawW) / 2;
    const offsetY = (ch - drawH) / 2;

    const toCanvasNormX = (mirroredNormX: number) => ((mirroredNormX * drawW + offsetX) / cw);
    const toCanvasNormY = (normY: number) => ((normY * drawH + offsetY) / ch);

    // 1. Primary: Native Browser FaceDetector API (Hardware-accelerated, zero WASM conflict with MediaPipe Hands)
    if (faceDetectorRef.current) {
      try {
        const faces = await faceDetectorRef.current.detect(video);
        if (faces && faces.length > 0) {
          faces.forEach((f: any) => {
            const box = f.boundingBox;
            if (!box) return;
            const rawMirroredX = 1.0 - ((box.x + box.width * 0.5) / vw);
            const rawCenterY = (box.y + box.height * 0.50) / vh;
            const canvasX = toCanvasNormX(rawMirroredX);
            const canvasY = toCanvasNormY(rawCenterY);
            const faceCanvasWidthRatio = ((box.width / vw) * drawW) / cw;

            const pIdx = is2P ? (canvasX < 0.5 ? 0 : 1) : 0;
            const player = eng.players[pIdx];
            if (!player) return;

            if (is2P && canvasX > 0.45 && canvasX < 0.55) return;

            const clampedX = is2P
              ? (pIdx === 0 ? Math.min(0.43, Math.max(0.07, canvasX)) : Math.max(0.57, Math.min(0.93, canvasX)))
              : Math.max(0.08, Math.min(0.92, canvasX));
            const targetY = Math.max(0.18, Math.min(0.72, canvasY));
            const targetScale = Math.max(0.75, Math.min(2.35, faceCanvasWidthRatio * 5.2));

            player.headX += (clampedX - player.headX) * 0.65;
            player.headY += (targetY - player.headY) * 0.65;
            player.headScale += (targetScale - player.headScale) * 0.50;
            player.headDetected = true;
            player.lastHeadTime = now;
          });
          return;
        }
      } catch (e) {}
    }

    // 2. Multi-Scale 2D Head-Oval vs. Surround Integral Detector on 1:1 Object-Cover Aligned Canvas
    //    Finds the compact human head column (flanked by background on left, right, and top crown, with neck/shoulders below)
    try {
      if (!headTrackCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 120;
        c.height = 68;
        headTrackCanvasRef.current = c;
      }
      const hc = headTrackCanvasRef.current;
      if (hc.width !== 120 || hc.height !== 68) {
        hc.width = 120;
        hc.height = 68;
      }
      const hctx = hc.getContext('2d', { willReadFrequently: true });
      if (!hctx) return;

      const W = hc.width;
      const H = hc.height;

      const scaleToMiniX = W / cw;
      const scaleToMiniY = H / ch;
      hctx.clearRect(0, 0, W, H);
      hctx.save();
      hctx.translate(W, 0);
      hctx.scale(-1, 1);
      hctx.drawImage(
        video,
        offsetX * scaleToMiniX,
        offsetY * scaleToMiniY,
        drawW * scaleToMiniX,
        drawH * scaleToMiniY
      );
      hctx.restore();

      const img = hctx.getImageData(0, 0, W, H).data;

      // Build 2D Integral Images (Summed-Area Tables) for O(1) region queries
      const stride = W + 1;
      const nCells = (W + 1) * (H + 1);
      const satLuma = new Float32Array(nCells);
      const satSkin = new Float32Array(nCells);
      const satEdge = new Float32Array(nCells);
      const satHand = new Float32Array(nCells);
      const rawLuma = new Float32Array(W * H);

      const isPixelNearAnyHand = (nx: number, ny: number) => {
        for (let pi = 0; pi < eng.players.length; pi++) {
          if (pi === 1 && !is2P) continue;
          const pl = eng.players[pi];
          if (!pl) continue;
          for (const hand of [pl.leftHand, pl.rightHand]) {
            if (!hand || !hand.detected) continue;
            if (Math.hypot(nx - hand.x, ny - hand.y) < 0.11) return true;
            if (hand.landmarks && hand.landmarks.length >= 21) {
              const wrist = hand.landmarks[0];
              const midMcp = hand.landmarks[9];
              const midTip = hand.landmarks[12];
              if (wrist && Math.hypot(nx - wrist.x, ny - wrist.y) < 0.09) return true;
              if (midMcp && Math.hypot(nx - midMcp.x, ny - midMcp.y) < 0.09) return true;
              if (midTip && Math.hypot(nx - midTip.x, ny - midTip.y) < 0.09) return true;
              if (wrist && Math.abs(nx - wrist.x) < 0.08 && ny >= wrist.y && ny <= wrist.y + 0.15) return true;
            }
          }
        }
        return false;
      };

      for (let y = 0; y < H; y++) {
        const ny = y / H;
        let rowLuma = 0;
        let rowSkin = 0;
        let rowEdge = 0;
        let rowHand = 0;
        const prevRowOffset = y * stride;
        const curRowOffset = (y + 1) * stride;

        for (let x = 0; x < W; x++) {
          const nx = x / W;
          const idx = (y * W + x) * 4;
          const r = img[idx];
          const g = img[idx + 1];
          const b = img[idx + 2];
          const luma = r * 0.299 + g * 0.587 + b * 0.114;
          rawLuma[y * W + x] = luma;

          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const isSkin = (
            r >= 40 && g >= 24 && b >= 16 &&
            r > g && g >= b - 5 &&
            (r - g) >= 5 && (r - g) <= 82 &&
            (r - b) >= 8 && (r - b) <= 122 &&
            (maxC - minC) >= 10 &&
            luma < 232
          ) ? 1.0 : 0.0;

          // Facial horizontal & vertical edge energy (brows, eyes, nose, mouth, hairline)
          let edge = 0;
          if (y > 0 && x > 0) {
            const dyLuma = Math.abs(luma - rawLuma[(y - 1) * W + x]);
            const dxLuma = Math.abs(luma - rawLuma[y * W + (x - 1)]);
            edge = Math.min(45, dyLuma * 1.25 + dxLuma * 0.65);
          }

          const inHand = isPixelNearAnyHand(nx, ny) ? 1.0 : 0.0;

          rowLuma += luma;
          rowSkin += isSkin;
          rowEdge += edge;
          rowHand += inHand;

          satLuma[curRowOffset + x + 1] = satLuma[prevRowOffset + x + 1] + rowLuma;
          satSkin[curRowOffset + x + 1] = satSkin[prevRowOffset + x + 1] + rowSkin;
          satEdge[curRowOffset + x + 1] = satEdge[prevRowOffset + x + 1] + rowEdge;
          satHand[curRowOffset + x + 1] = satHand[prevRowOffset + x + 1] + rowHand;
        }
      }

      const boxAvg = (sat: Float32Array, x0: number, y0: number, x1: number, y1: number) => {
        const cx0 = Math.max(0, Math.min(W - 1, Math.round(x0)));
        const cy0 = Math.max(0, Math.min(H - 1, Math.round(y0)));
        const cx1 = Math.max(cx0 + 1, Math.min(W, Math.round(x1)));
        const cy1 = Math.max(cy0 + 1, Math.min(H, Math.round(y1)));
        const area = (cx1 - cx0) * (cy1 - cy0);
        if (area <= 0) return 0;
        const sum =
          sat[cy1 * stride + cx1] -
          sat[cy0 * stride + cx1] -
          sat[cy1 * stride + cx0] +
          sat[cy0 * stride + cx0];
        return sum / area;
      };

      const scanPlayerHead = (pIdx: number, minXNorm: number, maxXNorm: number) => {
        const player = eng.players[pIdx];
        if (!player) return;

        const minCx = Math.floor((minXNorm + 0.06) * W);
        const maxCx = Math.floor((maxXNorm - 0.06) * W);
        const minCy = Math.floor(0.15 * H);
        const maxCy = Math.floor(0.56 * H);

        const prevX = player.headDetected ? player.headX : player.homeX;
        const prevY = player.headDetected ? player.headY : 0.34;
        const hasRecentHead = player.headDetected && (now - (player.lastHeadTime || 0) < 1200);

        let bestScore = -1;
        let bestCx = prevX * W;
        let bestCy = prevY * H;
        let bestRx = 10;

        // Candidate head half-widths rx in mini-canvas pixels (W=120 -> rx=8..13 is 13%..22% of screen width)
        const candidateRadii = is2P ? [7, 9, 11] : [8, 10, 12, 14];

        for (let rIdx = 0; rIdx < candidateRadii.length; rIdx++) {
          const rx = candidateRadii[rIdx];
          const ry = Math.round(rx * 1.25);

          for (let cy = minCy; cy <= maxCy; cy += 2) {
            const ny = cy / H;
            for (let cx = minCx; cx <= maxCx; cx += 2) {
              const nx = cx / W;

              // Reject candidate if it overlaps a raised hand
              const handOverlap = boxAvg(satHand, cx - rx, cy - ry, cx + rx, cy + ry);
              if (handOverlap > 0.18) continue;

              // Head interior statistics
              const inLuma = boxAvg(satLuma, cx - rx, cy - ry, cx + rx, cy + ry);
              const inSkin = boxAvg(satSkin, cx - rx * 0.85, cy - ry * 0.75, cx + rx * 0.85, cy + ry * 0.85);
              const inEdge = boxAvg(satEdge, cx - rx * 0.85, cy - ry * 0.75, cx + rx * 0.85, cy + ry * 0.85);

              // Surrounding background boxes: Left of left ear, Right of right ear, and Top above crown
              const leftBgLuma = boxAvg(satLuma, cx - rx * 2.1, cy - ry * 0.8, cx - rx * 1.15, cy + ry * 0.8);
              const rightBgLuma = boxAvg(satLuma, cx + rx * 1.15, cy - ry * 0.8, cx + rx * 2.1, cy + ry * 0.8);
              const topBgLuma = boxAvg(satLuma, cx - rx * 0.9, cy - ry * 1.85, cx + rx * 0.9, cy - ry * 1.1);

              const leftBgSkin = boxAvg(satSkin, cx - rx * 2.1, cy - ry * 0.8, cx - rx * 1.15, cy + ry * 0.8);
              const rightBgSkin = boxAvg(satSkin, cx + rx * 1.15, cy - ry * 0.8, cx + rx * 2.1, cy + ry * 0.8);

              // Neck & upper chest below the head
              const neckTorsoLuma = boxAvg(satLuma, cx - rx * 1.35, cy + ry * 1.05, cx + rx * 1.35, cy + ry * 1.95);

              // Bilateral contrast: A true head contrasts with BOTH its left and right background!
              // (Wide torso or wall edges fail Math.min(leftDiff, rightDiff))
              const leftContrast = Math.abs(inLuma - leftBgLuma) + Math.max(0, inSkin - leftBgSkin) * 85;
              const rightContrast = Math.abs(inLuma - rightBgLuma) + Math.max(0, inSkin - rightBgSkin) * 85;
              const bilateralContrast = Math.min(leftContrast, rightContrast) * 1.35 + (leftContrast + rightContrast) * 0.25;
              if (bilateralContrast < 12) continue;

              // Crown contrast above the head
              const crownContrast = Math.abs(inLuma - topBgLuma) * 0.55;

              // Torso connection below head (head + torso belong to the player silhouette)
              const avgSurroundLuma = (leftBgLuma + rightBgLuma) * 0.5;
              const torsoPresence = Math.max(0, Math.abs(neckTorsoLuma - avgSurroundLuma) - Math.abs(inLuma - neckTorsoLuma) * 0.45) * 0.40;

              // Facial skin & internal eye/brow/mouth feature score
              const faceFeatureScore = inSkin * 52 + Math.min(26, inEdge * 1.15);

              // Smooth temporal continuity prior (never restricts full-court movement)
              const distFromPrev = Math.hypot(nx - prevX, ny - prevY);
              const continuityWeight = hasRecentHead
                ? Math.max(0.68, 1.18 - distFromPrev * 1.35)
                : Math.max(0.75, 1.05 - Math.abs(nx - player.homeX) * 0.5);

              // Natural vertical head zone prior (allows y from 0.15 to 0.56)
              const vertWeight = Math.max(0.72, 1.06 - Math.abs(ny - 0.32) * 0.85);

              const score = (bilateralContrast + crownContrast + torsoPresence + faceFeatureScore) * continuityWeight * vertWeight;
              if (score > bestScore) {
                bestScore = score;
                bestCx = cx;
                bestCy = cy;
                bestRx = rx;
              }
            }
          }
        }

        if (bestScore > 26) {
          // Refine centroid & estimate subtle head tilt inside the winning head oval
          const rx = bestRx;
          const ry = Math.round(rx * 1.25);
          const x0 = Math.max(1, Math.floor(bestCx - rx));
          const x1 = Math.min(W - 2, Math.ceil(bestCx + rx));
          const y0 = Math.max(1, Math.floor(bestCy - ry));
          const y1 = Math.min(H - 2, Math.ceil(bestCy + ry));
          const surroundLuma = (
            boxAvg(satLuma, bestCx - rx * 2.0, bestCy - ry * 0.7, bestCx - rx * 1.15, bestCy + ry * 0.7) +
            boxAvg(satLuma, bestCx + rx * 1.15, bestCy - ry * 0.7, bestCx + rx * 2.0, bestCy + ry * 0.7)
          ) * 0.5;

          let sumX = 0, sumY = 0, sumW = 0;
          let leftY = 0, leftW = 0, rightY = 0, rightW = 0;

          for (let y = y0; y <= y1; y++) {
            for (let x = x0; x <= x1; x++) {
              const dx = (x - bestCx) / rx;
              const dy = (y - bestCy) / ry;
              if (dx * dx + dy * dy > 1.05) continue;
              const luma = rawLuma[y * W + x];
              const w = Math.abs(luma - surroundLuma) + 8;
              sumX += x * w;
              sumY += y * w;
              sumW += w;
              if (dx < -0.15) { leftY += y * w; leftW += w; }
              else if (dx > 0.15) { rightY += y * w; rightW += w; }
            }
          }

          const refinedNormX = sumW > 0 ? (sumX / sumW) / W : (bestCx / W);
          const refinedNormY = sumW > 0 ? (sumY / sumW) / H : (bestCy / H);

          const clampedX = is2P
            ? (pIdx === 0 ? Math.min(0.43, Math.max(0.07, refinedNormX)) : Math.max(0.57, Math.min(0.93, refinedNormX)))
            : Math.max(0.08, Math.min(0.92, refinedNormX));
          const clampedY = Math.max(0.16, Math.min(0.58, refinedNormY));
          const headWidthRatio = (bestRx * 2) / W;
          const targetScale = Math.max(0.80, Math.min(1.26, headWidthRatio * 5.6));

          let targetTilt = 0;
          if (leftW > 0 && rightW > 0) {
            const dyTilt = (rightY / rightW - leftY / leftW) / Math.max(6, bestRx);
            targetTilt = Math.max(-0.28, Math.min(0.28, dyTilt * 0.65));
          }

          player.headX += (clampedX - player.headX) * 0.52;
          player.headY += (clampedY - player.headY) * 0.52;
          player.headScale += (targetScale - player.headScale) * 0.35;
          player.headTilt = (player.headTilt || 0) + (targetTilt - (player.headTilt || 0)) * 0.35;
          player.headDetected = true;
          player.lastHeadTime = now;
        }
      };

      if (is2P) {
        scanPlayerHead(0, 0.02, 0.48);
        scanPlayerHead(1, 0.52, 0.98);
      } else {
        scanPlayerHead(0, 0.04, 0.96);
      }
    } catch (e) {}
  };

  // Setup camera & initialize MediaPipe Hands with full 21-point accuracy & stall-recovery watchdog
  const setupCamera = async (overridePlayersCount?: number) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera API not supported; playing in 3D AR Virtual Mode!");
      return;
    }
    try {
      const win = window as any;
      cameraLoopActiveRef.current = false;
      const targetPlayers = overridePlayersCount ?? engineRef.current.numPlayers ?? numPlayers;

      // Dynamically ensure MediaPipe Hands script is loaded if CDN took extra time
      if (!win.Hands && typeof document !== 'undefined') {
        await new Promise<void>((resolve) => {
          const existingScript = document.querySelector('script[src*="@mediapipe/hands"]');
          if (existingScript && (win as any).Hands) {
            resolve();
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve();
          script.onerror = () => resolve();
          document.head.appendChild(script);
          setTimeout(resolve, 2200);
        });
      }

      // 1. Acquire or reuse the live webcam stream
      let stream = videoRef.current?.srcObject as MediaStream | null;
      const hasLiveTrack = stream && stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);

      if (!hasLiveTrack) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 }, facingMode: "user" },
            audio: false
          });
        } catch (constraintErr) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }
      }

      if (videoRef.current && stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {}
        setCameraActive(true);
        setCameraError(null);
      }

      // 2. Initialize or update MediaPipe Hands with modelComplexity: 1 (accurate 21-point model with minimal ghosting)
      const ensureHandsInitialized = () => {
        if (!handsRef.current && win.Hands) {
          try {
            const hands = new win.Hands({
              locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            hands.setOptions({
              maxNumHands: targetPlayers === 2 ? 4 : 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.56,
              minTrackingConfidence: 0.50
            });
            hands.onResults((res: any) => {
              if (onHandsResultsRef.current) {
                onHandsResultsRef.current(res);
              }
            });
            handsRef.current = hands;
          } catch (handsErr) {
            console.warn("MediaPipe Hands init warning:", handsErr);
          }
        } else if (handsRef.current) {
          try {
            handsRef.current.setOptions({
              maxNumHands: (engineRef.current.numPlayers || targetPlayers) === 2 ? 4 : 2,
              modelComplexity: 1,
              minDetectionConfidence: 0.56,
              minTrackingConfidence: 0.50
            });
          } catch (e) {}
        }
      };

      ensureHandsInitialized();

      // 3. Resilient 60fps Hand Tracking Loop with 900ms Watchdog so WASM can never stall hand detection
      cameraLoopActiveRef.current = true;
      cameraProcessingRef.current = false;
      cameraLastSendMsRef.current = 0;
      let lastVideoTime = -1;

      const sendCameraFrames = async () => {
        if (!cameraLoopActiveRef.current || !videoRef.current) return;
        if (videoRef.current.paused && videoRef.current.srcObject) {
          videoRef.current.play().catch(() => {});
        }
        const nowMs = performance.now();
        if (cameraProcessingRef.current && cameraLastSendMsRef.current > 0 && nowMs - cameraLastSendMsRef.current > 900) {
          cameraProcessingRef.current = false;
        }
        const curVideoTime = videoRef.current.currentTime;
        if (
          videoRef.current.readyState >= 2 &&
          !cameraProcessingRef.current &&
          curVideoTime !== lastVideoTime
        ) {
          cameraProcessingRef.current = true;
          cameraLastSendMsRef.current = nowMs;
          lastVideoTime = curVideoTime;
          try {
            ensureHandsInitialized();
            if (handsRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          } catch (e) {
            // Ignore dropped frame
          } finally {
            cameraProcessingRef.current = false;
          }
        }
        if (cameraLoopActiveRef.current) {
          requestAnimationFrame(sendCameraFrames);
        }
      };

      requestAnimationFrame(sendCameraFrames);
    } catch (err: any) {
      console.warn("Camera could not start:", err?.name || err?.message);
      setCameraActive(false);
      setCameraError(err?.name === 'NotAllowedError' ? "Camera permission denied. Using 3D Virtual AR + Mouse/Touch!" : "Camera not detected. Using 3D Virtual AR + Mouse/Touch!");
    }
  };

  const stopCamera = () => {
    cameraLoopActiveRef.current = false;
    cameraProcessingRef.current = false;
    stopMosquitoBuzz();
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Keep Mosquito Slap as the sole combat mode
  const changeCombatMode = (_nextMode: 'mosquito' | 'chop' | 'combo' = 'mosquito') => {
    setGameMode('mosquito');
    gameModeRef.current = 'mosquito';

    const currentIdx = engineRef.current.qIndex || 0;
    const targetRoundMode: 'mosquito' = 'mosquito';

    setActiveRoundMode(targetRoundMode);
    activeRoundModeRef.current = targetRoundMode;
    engineRef.current.roundMode = targetRoundMode;
    engineRef.current.resolved = false;

    if (engineRef.current.isActive) {
      spawnRoundTargets(currentIdx, targetRoundMode);
    }
  };

  // Start game mode
  const startGame = async (playersCount: number) => {
    initAudio();
    setNumPlayers(playersCount);

    const validQuestions = (activeQuiz.questions || []).filter(q => q && q.text && q.text.trim());
    if (validQuestions.length === 0) {
      setScreen('editor');
      return;
    }
    const activeQuestions = validQuestions;

    const roundM: 'mosquito' = 'mosquito';
    const p1 = createPlayerEngine(0, p1Name || "Player 1", false, playersCount);
    const p2 = createPlayerEngine(1, p2Name || "Player 2", true, playersCount);

    if (playersCount === 2) {
      p1.homeX = 0.25;
      p1.headX = 0.25;
      p1.headY = 0.36;
      p1.handX = 0.25;
      p1.leftHand.x = 0.15;
      p1.rightHand.x = 0.35;

      p2.homeX = 0.75;
      p2.headX = 0.75;
      p2.headY = 0.36;
      p2.handX = 0.75;
      p2.leftHand.x = 0.65;
      p2.rightHand.x = 0.85;
    } else {
      p1.homeX = 0.50;
      p1.headX = 0.50;
      p1.headY = 0.36;
      p1.handX = 0.50;
      p1.leftHand.x = 0.36;
      p1.rightHand.x = 0.64;
    }

    const initialPlaySeconds = playingTimeRef.current || playingTime || 120;
    if (nextQTimerRef.current) {
      window.clearInterval(nextQTimerRef.current);
      nextQTimerRef.current = null;
    }
    setNextQCountdown(null);

    engineRef.current = {
      isActive: true,
      questions: activeQuestions,
      qIndex: 0,
      timer: initialPlaySeconds,
      maxTimer: initialPlaySeconds,
      resolved: false,
      roundMode: roundM,
      numPlayers: playersCount,
      scores: [0, 0],
      streaks: [1, 1],
      correctHits: [0, 0],
      targets: [],
      slicedHalves: [],
      splats: [],
      particles: [],
      shockwaves: [],
      swordSparks: [],
      floatingTexts: [],
      players: [p1, p2],
      screenShake: 0,
      lastFrameTime: performance.now()
    };

    setCurrentQIndex(0);
    setActiveRoundMode(roundM);
    activeRoundModeRef.current = roundM;
    setHudScores([0, 0]);
    setHudStreaks([1, 1]);
    setHudFrozen([false, false]);
    setHudHandsDetected([[false, false], [false, false]]);
    setHudClapArmed([false, false]);
    lastHudHandsRef.current = '';
    lastHudArmedRef.current = '';
    setTimerPct(100);
    setHudTimeLeft(initialPlaySeconds);
    lastHudSecRef.current = initialPlaySeconds;
    setScreen('loading');

    try {
      await setupCamera(playersCount);
    } catch (e) {}

    setTimeout(() => {
      setScreen('game');
      const liveRoundMode: 'mosquito' = 'mosquito';
      engineRef.current.roundMode = liveRoundMode;
      engineRef.current.resolved = true;
      setActiveRoundMode(liveRoundMode);
      activeRoundModeRef.current = liveRoundMode;
      startNextQuestionCountdown(0);
    }, 380);
  };

  // Clear 3-second inter-question countdown timer
  const clearNextQuestionTimer = () => {
    if (nextQTimerRef.current) {
      window.clearInterval(nextQTimerRef.current);
      nextQTimerRef.current = null;
    }
    setNextQCountdown(null);
    setNextQProgressPct(100);
  };

  // 3-Second Countdown Timer before the next question appears
  const startNextQuestionCountdown = (overrideTargetIdx?: number) => {
    clearNextQuestionTimer();
    stopMosquitoBuzz();

    const totalQs = Math.max(1, engineRef.current.questions.length);
    const targetIdx = typeof overrideTargetIdx === 'number'
      ? overrideTargetIdx
      : (engineRef.current.qIndex + 1) % totalQs;

    engineRef.current.resolved = true;
    // Clear remaining options from the arena so players see the 3-second countdown clearly
    engineRef.current.targets = [];

    const TOTAL_MS = 3000;
    let remainingMs = TOTAL_MS;
    let lastSpokenSec = 3;

    setUpcomingQNumber(targetIdx + 1);
    setNextQCountdown(3);
    setNextQProgressPct(100);
    playSoundEffect('countdown');

    nextQTimerRef.current = window.setInterval(() => {
      if (!engineRef.current.isActive) {
        clearNextQuestionTimer();
        return;
      }
      // Pause countdown if Settings Modal is open
      if (showSettingsModalRef.current) return;

      remainingMs = Math.max(0, remainingMs - 100);
      const secLeft = Math.max(1, Math.ceil(remainingMs / 1000));
      setNextQProgressPct(Math.round((remainingMs / TOTAL_MS) * 100));

      if (remainingMs > 0) {
        if (secLeft !== lastSpokenSec) {
          lastSpokenSec = secLeft;
          setNextQCountdown(secLeft);
          playSoundEffect('countdown');
        }
      } else {
        clearNextQuestionTimer();
        if (!engineRef.current.isActive) return;
        if (engineRef.current.timer <= 0) {
          finishGame();
          return;
        }
        if (engineRef.current.questions.length === 0) {
          finishGame();
          return;
        }
        engineRef.current.qIndex = targetIdx;
        engineRef.current.resolved = false;
        setCurrentQIndex(targetIdx);
        const nextRoundMode: 'mosquito' = 'mosquito';
        engineRef.current.roundMode = nextRoundMode;
        setActiveRoundMode(nextRoundMode);
        activeRoundModeRef.current = nextRoundMode;
        spawnRoundTargets(targetIdx, nextRoundMode);
        if (engineRef.current.questions[targetIdx]) {
          speakText(engineRef.current.questions[targetIdx].text);
        }
      }
    }, 100);
  };

  // Helper: Pick a random power-up/hazard badge for an option card in Multiple Answer Mode
  const pickRandomMultiBadge = (isCorrectTarget: boolean): 'x2' | 'x3' | 'gold' | 'bomb' | null => {
    if (answerModeRef.current !== 'multiple') return null;
    const cfg = multiItemsRef.current;
    const rate = multiSpawnRateRef.current;
    const chance = rate === 'chaos' ? 0.62 : rate === 'frenzy' ? 0.42 : 0.25;
    if (Math.random() > chance) return null;

    if (isCorrectTarget) {
      const pool: ('x2' | 'x3' | 'gold')[] = [];
      if (cfg.x2) pool.push('x2', 'x2');
      if (cfg.x3) pool.push('x3');
      if (cfg.gold) pool.push('gold');
      if (pool.length === 0) return null;
      return pool[Math.floor(Math.random() * pool.length)];
    } else {
      if (cfg.bomb && Math.random() < 0.55) return 'bomb';
      return null;
    }
  };

  // Helper: Create an independent flying 3D Power-Up or Bomb Mosquito/Orb in Multiple Answer Mode
  const createSpecialArenaTarget = (
    specialType: 'bomb' | 'x2' | 'x3' | 'gold' | 'ice' | 'zap',
    team: 'all' | 'p1' | 'p2',
    cw: number,
    ch: number,
    curSpd: number
  ) => {
    const safeTopY = Math.max(135, Math.min(ch * 0.34, ch * 0.30));
    const safeBotY = Math.max(safeTopY + 115, Math.min(ch - 155, ch * 0.62));
    const minX = team === 'p1' ? cw * 0.14 : team === 'p2' ? cw * 0.62 : cw * 0.18;
    const maxX = team === 'p1' ? cw * 0.38 : team === 'p2' ? cw * 0.86 : cw * 0.82;
    const startX = minX + Math.random() * Math.max(40, maxX - minX);
    const startY = safeTopY + Math.random() * Math.max(40, safeBotY - safeTopY);
    const angle = Math.random() * Math.PI * 2;
    const spdMult = specialType === 'gold' ? 1.28 : specialType === 'bomb' ? 1.05 : 1.12;
    const baseSpeed = (team === 'all' ? 2.2 : 2.0) * curSpd * spdMult;

    const metaMap: Record<typeof specialType, { letter: string; text: string; color: { main: string; light: string; dark: string; rim: string } }> = {
      bomb: {
        letter: '💣',
        text: 'BOMB (-3)',
        color: { main: '#dc2626', light: '#fca5a5', dark: '#7f1d1d', rim: '#fecaca' }
      },
      x2: {
        letter: 'x2',
        text: 'DOUBLE PTS',
        color: { main: '#0284c7', light: '#7dd3fc', dark: '#0369a1', rim: '#e0f2fe' }
      },
      x3: {
        letter: 'x3',
        text: 'TRIPLE PTS',
        color: { main: '#9333ea', light: '#d8b4fe', dark: '#581c87', rim: '#f3e8ff' }
      },
      gold: {
        letter: '👑',
        text: 'GOLD (+5)',
        color: { main: '#d97706', light: '#fde047', dark: '#92400e', rim: '#fef9c3' }
      },
      ice: {
        letter: '❄️',
        text: '+5s & SLOW',
        color: { main: '#0891b2', light: '#67e8f9', dark: '#155e75', rim: '#cffafe' }
      },
      zap: {
        letter: '⚡',
        text: 'AUTO-ZAP',
        color: { main: '#4f46e5', light: '#a5b4fc', dark: '#312e81', rim: '#e0e7ff' }
      }
    };

    const meta = metaMap[specialType];
    return {
      optionIndex: 90 + Math.floor(Math.random() * 10),
      isSpecialItem: true,
      specialType,
      letter: meta.letter,
      text: meta.text,
      isCorrect: specialType !== 'bomb',
      team,
      homeX: startX,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * baseSpeed,
      vy: Math.sin(angle) * baseSpeed * 0.85,
      wobblePhase: Math.random() * 10,
      wingPhase: Math.random() * 10,
      rotation: 0,
      rotSpeed: 0,
      radius: 54,
      color: meta.color,
      alive: true,
      cooldown: 10,
      frozen: false,
      frozenTimer: 0,
      leftKnifeHitTime: 0,
      rightKnifeHitTime: 0
    };
  };

  // Pick a random enabled special item type from multiItemsRef
  const pickEnabledSpecialType = (): 'bomb' | 'x2' | 'x3' | 'gold' | 'ice' | 'zap' | null => {
    const cfg = multiItemsRef.current;
    const pool: ('bomb' | 'x2' | 'x3' | 'gold' | 'ice' | 'zap')[] = [];
    if (cfg.bomb) pool.push('bomb', 'bomb');
    if (cfg.x2) pool.push('x2', 'x2');
    if (cfg.x3) pool.push('x3');
    if (cfg.gold) pool.push('gold');
    if (cfg.ice) pool.push('ice');
    if (cfg.zap) pool.push('zap');
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  };

  // Target spawning:
  // - In Mosquito Mode: Mosquitoes spawn in the arena and actively fly around!
  // - In Chop Mode: Fruits launch FROM BELOW the bottom of the screen and rise UPWARD in an arc!
  const spawnRoundTargets = (qIdx: number, mode: 'mosquito' | 'chop') => {
    const qObj = engineRef.current.questions[qIdx];
    if (!qObj) return;

    // CRITICAL FIX: Always reset resolved = false and unfreeze both sides when spawning a new round!
    engineRef.current.resolved = false;
    (engineRef.current as any).roundHitsCollected = 0;
    (engineRef.current as any).roundHitsRequired = answerModeRef.current === 'multiple'
      ? Math.max(1, Math.min(10, multiAnswerCountRef.current || 3))
      : 1;
    setHudMultiProgress(0);

    engineRef.current.players.forEach(p => {
      if (p) {
        p.sideFrozen = false;
        p.frozenTimer = 0;
      }
    });
    setHudFrozen([false, false]);

    const width = containerRef.current?.clientWidth || 960;
    const height = containerRef.current?.clientHeight || 540;
    const opts = qObj.options || ["", "", "", ""];
    const targets: any[] = [];
    const is2P = engineRef.current.numPlayers === 2;
    const curSpd = speedRef.current || speed || 1.0;

    if (mode === 'mosquito') {
      startMosquitoBuzz();
    } else {
      stopMosquitoBuzz();
      playSoundEffect('launch');
    }

    if (!is2P) {
      if (mode === 'chop') {
        const laneXs = [width * 0.20, width * 0.40, width * 0.60, width * 0.80];
        const gBase = 0.135 * curSpd * Math.max(0.85, height / 600);
        opts.forEach((optText, i) => {
          const homeX = laneXs[i % laneXs.length];
          const startX = homeX + (Math.random() - 0.5) * 20;
          const startY = height + 40 + (i % 2) * 34;
          const peakY = Math.max(168, height * (0.26 + (i % 2) * 0.07));
          const riseDist = Math.max(240, startY - peakY);
          const upVy = -Math.sqrt(2 * gBase * riseDist);
          const sideVx = (Math.random() - 0.5) * 1.1 * curSpd;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: pickRandomMultiBadge(i === qObj.answerIndex),
            team: 'all',
            homeX,
            x: startX,
            y: startY,
            vx: sideVx,
            vy: upVy,
            gravity: gBase,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            rotation: Math.random() * Math.PI,
            rotSpeed: ((i % 2 === 0 ? 1 : -1) * (0.032 + Math.random() * 0.02)),
            radius: 58,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });
      } else {
        const safeTopY = Math.max(135, Math.min(height * 0.34, height * 0.30));
        const safeBotY = Math.max(safeTopY + 115, Math.min(height - 155, height * 0.62));
        const quadrantAnchors = [
          { x: width * 0.26, y: safeTopY }, // A (Top Left)
          { x: width * 0.74, y: safeTopY }, // B (Top Right)
          { x: width * 0.26, y: safeBotY }, // C (Bottom Left)
          { x: width * 0.74, y: safeBotY }, // D (Bottom Right)
        ];

        opts.forEach((optText, i) => {
          const anchor = quadrantAnchors[i % quadrantAnchors.length];
          const colX = anchor.x + (Math.random() - 0.5) * 32;
          const rowY = anchor.y + (Math.random() - 0.5) * 24;
          const angle = (i * Math.PI * 0.5) + 0.4 + (Math.random() - 0.5) * 0.6;
          const baseSpeed = 2.15 * curSpd;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: pickRandomMultiBadge(i === qObj.answerIndex),
            team: 'all',
            homeX: anchor.x,
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed * 0.85,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            rotation: 0,
            rotSpeed: 0,
            radius: 58,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });
      }
    } else {
      // 2 Players: Team 1 (Left Court) & Team 2 (Right Court)
      if (mode === 'chop') {
        const p1Lanes = [width * 0.11, width * 0.21, width * 0.30, width * 0.40];
        const p2Lanes = [width * 0.60, width * 0.70, width * 0.79, width * 0.89];
        const gBase = 0.135 * curSpd * Math.max(0.85, height / 600);

        opts.forEach((optText, i) => {
          const homeX = p1Lanes[i % p1Lanes.length];
          const startY = height + 40 + (i % 2) * 36;
          const peakY = Math.max(168, height * (0.26 + (i % 2) * 0.07));
          const riseDist = Math.max(240, startY - peakY);
          const upVy = -Math.sqrt(2 * gBase * riseDist);
          const sharedBadge = pickRandomMultiBadge(i === qObj.answerIndex);

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: sharedBadge,
            team: 'p1',
            homeX,
            x: homeX + (Math.random() - 0.5) * 12,
            y: startY,
            vx: (Math.random() - 0.5) * 0.9 * curSpd,
            vy: upVy,
            gravity: gBase,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            rotation: Math.random() * Math.PI,
            rotSpeed: ((i % 2 === 0 ? 1 : -1) * 0.035),
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });

        opts.forEach((optText, i) => {
          const homeX = p2Lanes[i % p2Lanes.length];
          const startY = height + 40 + (i % 2) * 36;
          const peakY = Math.max(168, height * (0.26 + (i % 2) * 0.07));
          const riseDist = Math.max(240, startY - peakY);
          const upVy = -Math.sqrt(2 * gBase * riseDist);

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: targets[i]?.powerBadge ?? null,
            team: 'p2',
            homeX,
            x: homeX + (Math.random() - 0.5) * 12,
            y: startY,
            vx: (Math.random() - 0.5) * 0.9 * curSpd,
            vy: upVy,
            gravity: gBase,
            wobblePhase: Math.random() * 10 + 5,
            wingPhase: Math.random() * 10 + 5,
            rotation: Math.random() * Math.PI,
            rotSpeed: ((i % 2 === 0 ? 1 : -1) * 0.035),
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });
      } else {
        const safeTopY = Math.max(135, Math.min(height * 0.34, height * 0.30));
        const safeBotY = Math.max(safeTopY + 115, Math.min(height - 155, height * 0.62));
        const p1Quadrants = [
          { x: width * 0.15, y: safeTopY }, // A
          { x: width * 0.36, y: safeTopY }, // B
          { x: width * 0.15, y: safeBotY }, // C
          { x: width * 0.36, y: safeBotY }, // D
        ];

        const p2Quadrants = [
          { x: width * 0.64, y: safeTopY }, // A
          { x: width * 0.85, y: safeTopY }, // B
          { x: width * 0.64, y: safeBotY }, // C
          { x: width * 0.85, y: safeBotY }, // D
        ];

        opts.forEach((optText, i) => {
          const anchor = p1Quadrants[i % p1Quadrants.length];
          const colX = anchor.x + (Math.random() - 0.5) * 20;
          const rowY = anchor.y + (Math.random() - 0.5) * 18;
          const angle = (i * Math.PI * 0.5) + 0.35 + (Math.random() - 0.5) * 0.5;
          const baseSpeed = 2.0 * curSpd;
          const sharedBadge = pickRandomMultiBadge(i === qObj.answerIndex);

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: sharedBadge,
            team: 'p1',
            homeX: anchor.x,
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed * 0.85,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            rotation: 0,
            rotSpeed: 0,
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });

        opts.forEach((optText, i) => {
          const anchor = p2Quadrants[i % p2Quadrants.length];
          const colX = anchor.x + (Math.random() - 0.5) * 20;
          const rowY = anchor.y + (Math.random() - 0.5) * 18;
          const angle = (i * Math.PI * 0.5) + 0.35 + (Math.random() - 0.5) * 0.5;
          const baseSpeed = 2.0 * curSpd;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            powerBadge: targets[i]?.powerBadge ?? null,
            team: 'p2',
            homeX: anchor.x,
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed * 0.85,
            wobblePhase: Math.random() * 10 + 5,
            wingPhase: Math.random() * 10 + 5,
            rotation: 0,
            rotSpeed: 0,
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0,
            frozen: false,
            frozenTimer: 0,
            leftKnifeHitTime: 0,
            rightKnifeHitTime: 0
          });
        });
      }
    }

    // In Multiple Answer Mode: Also spawn independent flying 3D Power-Up & Bomb targets!
    if (answerModeRef.current === 'multiple') {
      const rate = multiSpawnRateRef.current;
      const countPerCourt = rate === 'chaos' ? 3 : rate === 'frenzy' ? 2 : 1;
      for (let s = 0; s < countPerCourt; s++) {
        const sType = pickEnabledSpecialType();
        if (!sType) break;
        if (!is2P) {
          targets.push(createSpecialArenaTarget(sType, 'all', width, height, curSpd));
        } else {
          targets.push(createSpecialArenaTarget(sType, 'p1', width, height, curSpd));
          targets.push(createSpecialArenaTarget(sType, 'p2', width, height, curSpd));
        }
      }
    }

    engineRef.current.targets = targets;
  };

  // Handle interaction hit (Mosquito Slap or Hand-Blade Fruit Slice)
  const handleTargetHit = (playerIdx: number, target: any, sliceAngle: number = -0.35) => {
    if (engineRef.current.resolved || !target.alive || target.frozen) return;
    const eng = engineRef.current;
    const p = eng.players[playerIdx];
    if (!p || p.sideFrozen) return;

    // Enforce Court Team Lock: Player 1 cannot hit Player 2's targets and vice versa
    if (eng.numPlayers === 2) {
      if (playerIdx === 0 && target.team === 'p2') return;
      if (playerIdx === 1 && target.team === 'p1') return;
    }

    // Spawn 3D Crescent Slicing Slash Arc / Slap Impact Burst
    eng.swordSparks.push({
      x: target.x,
      y: target.y,
      angle: sliceAngle,
      color: target.specialType === 'bomb'
        ? '#ef4444'
        : target.isCorrect
        ? (target.color?.main || '#10b981')
        : '#38bdf8',
      life: 1.0,
      radius: eng.roundMode === 'chop' ? 128 : 96,
      isChop: eng.roundMode === 'chop'
    });

    const isMultiMode = answerModeRef.current === 'multiple';
    const requiredHits = isMultiMode ? Math.max(1, Math.min(10, multiAnswerCountRef.current || 3)) : 1;
    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const teamPrefix = eng.numPlayers === 2 ? `${playerIdx === 0 ? p1Name : p2Name}: ` : '';

    // =========================================================================
    // SPECIAL ARENA POWER-UPS & HAZARDS IN MULTIPLE ANSWER MODE
    // (💣 BOMB, ⚡ x2, 🔥 x3, 👑 GOLD, ❄️ ICE +5s, ⚡ AUTO-ZAP)
    // =========================================================================
    if (target.isSpecialItem) {
      const sType = target.specialType as 'bomb' | 'x2' | 'x3' | 'gold' | 'ice' | 'zap';
      target.alive = false;

      // Schedule a replacement special item after a short delay if round is still active
      setTimeout(() => {
        if (!eng.isActive || eng.resolved || answerModeRef.current !== 'multiple') return;
        const nextType = pickEnabledSpecialType();
        if (!nextType) return;
        const curSpdNow = speedRef.current || 1.0;
        eng.targets.push(createSpecialArenaTarget(nextType, target.team, cw, ch, curSpdNow));
      }, 1600);

      if (sType === 'bomb') {
        // 💣 BOMB DETONATION: -3 PTS + Massive Fiery Blast Shockwave + Screen Shake!
        p.streak = 1;
        p.wrongHits = (p.wrongHits || 0) + 1;
        p.score -= 3;
        eng.screenShake = 26;

        eng.shockwaves.push({
          x: target.x,
          y: target.y,
          radius: 28,
          maxRadius: 175,
          color: '#ef4444',
          secondaryColor: '#f97316',
          life: 1.0
        });

        playSoundEffect('slap');
        setTimeout(() => playSoundEffect('bomb'), 35);

        spawnBurstParticles(target.x, target.y, '#ef4444', 32);
        spawnBurstParticles(target.x, target.y, '#f97316', 24);
        spawnBurstParticles(target.x, target.y, '#fde047', 16);
        spawnBurstParticles(target.x, target.y, '#1e293b', 14);

        setHudScores([eng.players[0].score, eng.players[1].score]);
        setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
        setHudScorePops(prev => {
          const next = [...prev] as [string | null, string | null];
          next[playerIdx] = `💥 BOMB! -3 PTS`;
          return next;
        });
        setTimeout(() => setHudScorePops([null, null]), 1150);

        spawnFloatingText(target.x, target.y - 24, `${teamPrefix}💥 BOOM! -3 PTS`, '#ef4444');
        return;
      }

      if (sType === 'x2' || sType === 'x3') {
        const multVal = sType === 'x3' ? 3 : 2;
        const bonusPts = multVal;
        p.activeMult = Math.max(p.activeMult || 1, multVal);
        p.multTimer = sType === 'x3' ? 8.5 : 10.5;
        p.score += bonusPts;
        p.hits++;
        p.correctHits = (p.correctHits || 0) + 1;
        eng.screenShake = 14;

        setHudActiveMults([
          eng.players[0]?.activeMult || 1,
          eng.players[1]?.activeMult || 1
        ]);

        eng.shockwaves.push({
          x: target.x,
          y: target.y,
          radius: 26,
          maxRadius: 150,
          color: sType === 'x3' ? '#a855f7' : '#0ea5e9',
          secondaryColor: '#facc15',
          life: 1.0
        });

        playSoundEffect('slap');
        setTimeout(() => playSoundEffect('powerup'), 40);

        spawnBurstParticles(target.x, target.y, sType === 'x3' ? '#c084fc' : '#38bdf8', 32);
        spawnBurstParticles(target.x, target.y, '#facc15', 20);

        setHudScores([eng.players[0].score, eng.players[1].score]);
        setHudScorePops(prev => {
          const next = [...prev] as [string | null, string | null];
          next[playerIdx] = sType === 'x3' ? `🔥 x3 ACTIVE! +3 PTS` : `⚡ x2 ACTIVE! +2 PTS`;
          return next;
        });
        setTimeout(() => setHudScorePops([null, null]), 1200);

        (eng as any).scoreOrbs = (eng as any).scoreOrbs || [];
        (eng as any).scoreOrbs.push({
          startX: target.x,
          startY: target.y,
          x: target.x,
          y: target.y,
          targetX: eng.numPlayers === 2 ? (playerIdx === 0 ? cw * 0.42 : cw * 0.58) : cw * 0.46,
          targetY: 50,
          progress: 0,
          color: sType === 'x3' ? '#a855f7' : '#0ea5e9',
          points: `+${bonusPts}`,
          streak: p.streak
        });

        spawnFloatingText(
          target.x,
          target.y - 24,
          sType === 'x3' ? `${teamPrefix}🔥 x3 MULTIPLIER! (+3)` : `${teamPrefix}⚡ x2 MULTIPLIER! (+2)`,
          sType === 'x3' ? '#c084fc' : '#38bdf8'
        );
        return;
      }

      if (sType === 'gold') {
        const curMult = Math.max(1, p.activeMult || 1);
        const goldPts = 5 * curMult;
        p.score += goldPts;
        p.hits++;
        p.correctHits = (p.correctHits || 0) + 1;
        p.streak = Math.min(15, p.streak + 1);
        p.bestStreak = Math.max(p.bestStreak || 1, p.streak);
        eng.screenShake = 18;

        // Golden mosquito also counts as +1 progress toward the current question!
        const hitsNow = ((eng as any).roundHitsCollected || 0) + 1;
        (eng as any).roundHitsCollected = hitsNow;
        setHudMultiProgress(hitsNow);

        eng.shockwaves.push({
          x: target.x,
          y: target.y,
          radius: 30,
          maxRadius: 165,
          color: '#facc15',
          secondaryColor: '#ffffff',
          life: 1.0
        });

        playSoundEffect('slap');
        setTimeout(() => playSoundEffect('powerup'), 40);

        spawnBurstParticles(target.x, target.y, '#facc15', 42);
        spawnBurstParticles(target.x, target.y, '#fef08a', 24);

        setHudScores([eng.players[0].score, eng.players[1].score]);
        setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
        setHudScorePops(prev => {
          const next = [...prev] as [string | null, string | null];
          next[playerIdx] = `👑 GOLD! +${goldPts} PTS`;
          return next;
        });
        setTimeout(() => setHudScorePops([null, null]), 1200);

        (eng as any).scoreOrbs = (eng as any).scoreOrbs || [];
        (eng as any).scoreOrbs.push({
          startX: target.x,
          startY: target.y,
          x: target.x,
          y: target.y,
          targetX: eng.numPlayers === 2 ? (playerIdx === 0 ? cw * 0.42 : cw * 0.58) : cw * 0.46,
          targetY: 50,
          progress: 0,
          color: '#eab308',
          points: `+${goldPts}`,
          streak: p.streak
        });

        spawnFloatingText(target.x, target.y - 24, `${teamPrefix}👑 GOLDEN JACKPOT! +${goldPts} PTS`, '#facc15');

        if (hitsNow >= requiredHits) {
          eng.resolved = true;
          stopMosquitoBuzz();
          startNextQuestionCountdown();
        }
        return;
      }

      if (sType === 'ice') {
        // ❄️ ICE CLOCK: +5s Timer Bonus + 6s Slow-Motion on all mosquitoes + 1 PT!
        eng.timer = Math.min(eng.maxTimer + 30, eng.timer + 5);
        (eng as any).slowMoTimer = 6.0;
        setHudSlowMo(true);
        const ceilSec = Math.ceil(eng.timer);
        lastHudSecRef.current = ceilSec;
        setHudTimeLeft(ceilSec);

        const icePts = 1 * Math.max(1, p.activeMult || 1);
        p.score += icePts;
        p.hits++;
        p.correctHits = (p.correctHits || 0) + 1;

        eng.shockwaves.push({
          x: target.x,
          y: target.y,
          radius: 26,
          maxRadius: 155,
          color: '#06b6d4',
          secondaryColor: '#cffafe',
          life: 1.0
        });

        playSoundEffect('slap');
        setTimeout(() => playSoundEffect('freeze'), 40);

        spawnBurstParticles(target.x, target.y, '#22d3ee', 30);
        spawnBurstParticles(target.x, target.y, '#ffffff', 18);

        setHudScores([eng.players[0].score, eng.players[1].score]);
        setHudScorePops(prev => {
          const next = [...prev] as [string | null, string | null];
          next[playerIdx] = `❄️ +5s & SLOW-MO! (+${icePts})`;
          return next;
        });
        setTimeout(() => setHudScorePops([null, null]), 1200);

        spawnFloatingText(target.x, target.y - 24, `${teamPrefix}❄️ +5s TIME & SLOW-MO!`, '#22d3ee');
        return;
      }

      if (sType === 'zap') {
        // ⚡ AUTO-ZAP: Strikes the correct answer mosquito on this player's court with a 3D Sky Lightning Bolt!
        playSoundEffect('slap');
        setTimeout(() => playSoundEffect('zap'), 35);

        const myCourtCorrect = eng.targets.find(
          t => t.alive && !t.isSpecialItem && t.isCorrect && (eng.numPlayers === 1 || (playerIdx === 0 ? t.team === 'p1' : t.team === 'p2'))
        );

        if (myCourtCorrect) {
          (eng as any).lightningBolts = (eng as any).lightningBolts || [];
          (eng as any).lightningBolts.push({
            startX: target.x,
            startY: target.y,
            endX: myCourtCorrect.x,
            endY: myCourtCorrect.y,
            life: 1.0,
            color: '#facc15'
          });
          spawnFloatingText(target.x, target.y - 24, `${teamPrefix}⚡ LIGHTNING AUTO-ZAP!`, '#a855f7');
          myCourtCorrect.cooldown = 0;
          handleTargetHit(playerIdx, myCourtCorrect, 0);
        } else {
          const zapPts = 2 * Math.max(1, p.activeMult || 1);
          p.score += zapPts;
          setHudScores([eng.players[0].score, eng.players[1].score]);
          spawnFloatingText(target.x, target.y - 24, `${teamPrefix}⚡ ZAP BONUS +${zapPts}!`, '#a855f7');
        }
        return;
      }
    }

    if (target.isCorrect) {
      const hitsNow = ((eng as any).roundHitsCollected || 0) + 1;
      (eng as any).roundHitsCollected = hitsNow;
      setHudMultiProgress(hitsNow);

      // Check if this correct mosquito carried a bonus badge in Multiple Answer Mode
      const badge = isMultiMode ? (target.powerBadge as 'x2' | 'x3' | 'gold' | null) : null;
      if (badge === 'x2') {
        p.activeMult = Math.max(p.activeMult || 1, 2);
        p.multTimer = 10.0;
        setHudActiveMults([eng.players[0]?.activeMult || 1, eng.players[1]?.activeMult || 1]);
        setTimeout(() => playSoundEffect('powerup'), 55);
      } else if (badge === 'x3') {
        p.activeMult = 3;
        p.multTimer = 8.0;
        setHudActiveMults([eng.players[0]?.activeMult || 1, eng.players[1]?.activeMult || 1]);
        setTimeout(() => playSoundEffect('powerup'), 55);
      } else if (badge === 'gold') {
        setTimeout(() => playSoundEffect('powerup'), 55);
      }

      const activeMult = isMultiMode ? Math.max(1, p.activeMult || 1) : 1;
      const basePts = isMultiMode ? (badge === 'gold' ? 5 : 1) : 5;
      const addedPoints = basePts * activeMult;

      const roundCompleted = !isMultiMode || hitsNow >= requiredHits;
      if (roundCompleted) {
        eng.resolved = true;
        target.alive = false;
        stopMosquitoBuzz();
      } else {
        // In Multiple Answer Mode (when more hits are needed for this question):
        // Pop the slapped mosquito and immediately respawn a fresh correct mosquito at a new flight angle so players can keep slapping up to 1-10 times!
        target.cooldown = 15;
        const cwNow = containerRef.current?.clientWidth || 960;
        const chNow = containerRef.current?.clientHeight || 540;
        const curSpd = speedRef.current || 1.0;
        const safeTopY = Math.max(135, Math.min(chNow * 0.34, chNow * 0.30));
        const safeBotY = Math.max(safeTopY + 115, Math.min(chNow - 155, chNow * 0.62));
        const minX = eng.numPlayers === 2 ? (target.team === 'p2' ? cwNow * 0.60 : cwNow * 0.12) : cwNow * 0.18;
        const maxX = eng.numPlayers === 2 ? (target.team === 'p2' ? cwNow * 0.88 : cwNow * 0.40) : cwNow * 0.82;
        target.x = minX + Math.random() * Math.max(40, maxX - minX);
        target.y = safeTopY + Math.random() * Math.max(40, safeBotY - safeTopY);
        const newAng = Math.random() * Math.PI * 2;
        const baseSpd = (eng.numPlayers === 2 ? 2.0 : 2.15) * curSpd;
        target.vx = Math.cos(newAng) * baseSpd;
        target.vy = Math.sin(newAng) * baseSpd * 0.85;
        target.powerBadge = pickRandomMultiBadge(true);
      }

      eng.screenShake = 14;

      p.hits++;
      p.correctHits = (p.correctHits || 0) + 1;
      p.score += addedPoints;
      p.streak = Math.min(15, p.streak + 1);
      p.bestStreak = Math.max(p.bestStreak || 1, p.streak);
      eng.players.forEach(pl => {
        if (pl) {
          pl.frozenTimer = 0;
          pl.sideFrozen = false;
        }
      });

      eng.shockwaves.push({
        x: target.x,
        y: target.y,
        radius: 26,
        maxRadius: 138,
        color: badge === 'gold' ? '#facc15' : activeMult >= 3 ? '#a855f7' : activeMult === 2 ? '#0ea5e9' : '#10b981',
        secondaryColor: '#facc15',
        life: 1.0
      });

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('correct'), 85);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudFrozen([false, false]);
      const multTag = activeMult > 1 ? ` 🔥x${activeMult}` : '';
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = isMultiMode
          ? `+${addedPoints} PT${addedPoints > 1 ? 'S' : ''}${multTag} (${hitsNow}/${requiredHits})`
          : (p.streak >= 3 ? `+5 PTS! 🔥x${p.streak}` : `+5 PTS! 🎉`);
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1100);

      // Juicy Particle Bursts
      spawnBurstParticles(target.x, target.y, target.color.main, 36);
      spawnBurstParticles(target.x, target.y, '#ffffff', 14);
      spawnBurstParticles(target.x, target.y, '#facc15', 12);
      if (eng.roundMode === 'chop') {
        spawnSlicedFruitHalves(target);
      } else {
        eng.splats.push({
          x: target.x,
          y: target.y,
          color: target.color.main,
          alpha: 1.0,
          seed: Math.random() * 100
        });
      }

      spawnFloatingText(
        target.x,
        target.y - 24,
        isMultiMode
          ? `${teamPrefix}+${addedPoints} PT${addedPoints > 1 ? 'S' : ''}!${multTag} (${hitsNow}/${requiredHits})`
          : `${teamPrefix}+5 PTS!`,
        badge === 'gold' ? '#facc15' : '#10b981'
      );

      // Launch a glowing 3D Score Orb from the slapped mosquito straight into the Center Scoreboard!
      (eng as any).scoreOrbs = (eng as any).scoreOrbs || [];
      (eng as any).scoreOrbs.push({
        startX: target.x,
        startY: target.y,
        x: target.x,
        y: target.y,
        targetX: eng.numPlayers === 2 ? (playerIdx === 0 ? cw * 0.42 : cw * 0.58) : cw * 0.46,
        targetY: 50,
        progress: 0,
        color: playerIdx === 1 ? '#f43f5e' : '#3b82f6',
        points: `+${addedPoints}`,
        streak: p.streak
      });

      if (roundCompleted) {
        // Start the 3-second countdown timer before the next question appears
        startNextQuestionCountdown();
      }

    } else {
      // WRONG WORD HIT -> Check if it carried a 💣 BOMB hazard badge in Multiple Answer Mode!
      const isBombOption = isMultiMode && target.powerBadge === 'bomb';
      const penaltyPoints = isBombOption ? 3 : (isMultiMode ? 1 : 5);
      if (isBombOption) {
        target.powerBadge = null;
      }

      p.streak = 1;
      p.wrongHits = (p.wrongHits || 0) + 1;
      p.score -= penaltyPoints;
      eng.screenShake = isBombOption ? 24 : 9;

      eng.shockwaves.push({
        x: target.x,
        y: target.y,
        radius: 22,
        maxRadius: isBombOption ? 165 : 108,
        color: isBombOption ? '#ef4444' : '#38bdf8',
        secondaryColor: isBombOption ? '#f97316' : '#e0f2fe',
        life: 1.0
      });

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect(isBombOption ? 'bomb' : 'freeze'), 45);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = isBombOption
          ? `💥 BOMB! -3 PTS`
          : (isMultiMode ? `-1 PT ❄️` : `-5 PTS ❄️`);
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1100);

      spawnBurstParticles(target.x, target.y, isBombOption ? '#ef4444' : '#38bdf8', 28);
      spawnBurstParticles(target.x, target.y, isBombOption ? '#f97316' : '#e0f2fe', 18);

      if (!isMultiMode && eng.numPlayers === 2) {
        const otherIdx = playerIdx === 0 ? 1 : 0;
        const otherPlayer = eng.players[otherIdx];
        const myTeam = playerIdx === 0 ? 'p1' : 'p2';

        // Freeze this player's side and all mosquitoes on their court
        p.sideFrozen = true;
        p.frozenTimer = 9999;
        eng.targets.forEach(t => {
          if (t.team === myTeam && t.alive) {
            t.frozen = true;
            t.frozenTimer = 9999;
            t.vx = 0;
            t.vy = 0;
            t.cooldown = 30;
          }
        });

        setHudFrozen([
          Boolean(eng.players[0]?.sideFrozen),
          Boolean(eng.players[1]?.sideFrozen)
        ]);

        if (otherPlayer && otherPlayer.sideFrozen) {
          spawnFloatingText(
            target.x,
            target.y - 24,
            `❄️ BOTH WRONG! UNFREEZING...`,
            '#0284c7'
          );
          setTimeout(() => {
            if (!eng.isActive || eng.resolved) return;
            eng.players.forEach(pl => {
              if (pl) {
                pl.sideFrozen = false;
                pl.frozenTimer = 0;
              }
            });
            setHudFrozen([false, false]);
            const curSpd = speedRef.current || 1.0;
            eng.targets.forEach(t => {
              if (t.alive) {
                t.frozen = false;
                t.frozenTimer = 0;
                t.cooldown = 16;
                const restoreAng = (t.optionIndex || 0) * Math.PI * 0.5 + 0.4 + (Math.random() - 0.5) * 0.4;
                t.vx = Math.cos(restoreAng) * 1.95 * curSpd;
                t.vy = Math.sin(restoreAng) * 1.65 * curSpd;
              }
            });
          }, 900);
        } else {
          const otherName = otherIdx === 0 ? (p1Name || 'Player 1') : (p2Name || 'Player 2');
          spawnFloatingText(
            target.x,
            target.y - 24,
            `❄️ FROZEN (-5)! WAITING FOR ${otherName.toUpperCase()}`,
            '#0284c7'
          );
        }
      } else {
        // Freeze that incorrect option in 3D ice briefly
        p.frozenTimer = 0.45;
        target.frozen = true;
        target.frozenTimer = isMultiMode ? 2.0 : 4.8;
        target.vx = 0;
        target.vy = 0;
        target.cooldown = isMultiMode ? 50 : 120;
        setHudFrozen([eng.players[0].frozenTimer > 0, Boolean(eng.players[1] && eng.players[1].frozenTimer > 0)]);
        spawnFloatingText(
          target.x,
          target.y - 24,
          isBombOption ? `💥 BOMB! -3 PTS` : `❄️ -${penaltyPoints} ${penaltyPoints === 1 ? 'PT' : 'PTS'}`,
          isBombOption ? '#ef4444' : '#0284c7'
        );
      }
    }
  };

  const spawnBurstParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 9.5;
      engineRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 2.0,
        size: 4 + Math.random() * 7,
        color,
        life: 1.0
      });
    }
  };

  const spawnSlicedFruitHalves = (target: any) => {
    for (let side = -1; side <= 1; side += 2) {
      engineRef.current.slicedHalves.push({
        x: target.x + side * 16,
        y: target.y,
        vx: (target.vx || 0) + side * (4.5 + Math.random() * 2.0),
        vy: -5.4 - Math.random() * 2.4,
        rotation: target.rotation || 0,
        rotSpeed: side * 0.18,
        radius: target.radius || 48,
        side,
        color: target.color,
        alpha: 1.0
      });
    }
  };

  const spawnFloatingText = (x: number, y: number, text: string, color: string) => {
    engineRef.current.floatingTexts.push({ x, y, text, color, life: 1.0 });
  };

  const finishGame = () => {
    clearNextQuestionTimer();
    stopMosquitoBuzz();
    engineRef.current.isActive = false;
    setScreen('results');
    setTimeout(() => playSoundEffect('victory'), 120);
  };

  // Helper: Shortest distance from a segment [v, w] to the visual Mosquito/Fruit + 3D Option Card bounding box!
  const distToTargetOrOptionCard = (
    t: any,
    v: { x: number; y: number },
    w: { x: number; y: number }
  ) => {
    const halfCardW = Math.max(78, (t.cardW || 190) * 0.51);
    const minX = t.x - halfCardW;
    const maxX = t.x + halfCardW;
    const minY = t.y - 44;
    const maxY = t.y + 86;

    // Sample points along segment [v, w] against the combined target + option card box
    let minDist = 99999;
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const px = v.x + (w.x - v.x) * frac;
      const py = v.y + (w.y - v.y) * frac;
      const cx = Math.max(minX, Math.min(maxX, px));
      const cy = Math.max(minY, Math.min(maxY, py));
      const d = Math.hypot(px - cx, py - cy);
      if (d < minDist) minDist = d;
    }
    return minDist;
  };

  // Unified Hand-Tracked Collision Check:
  // - In Mosquito Slap Mode: Consumes ONE-SHOT Clap / Swat / Pointer impulses (`p.pendingClap`) at the pinpoint
  //   clap midpoint! Holding hands still, moving 1 hand in Clap mode, or translating separated hands NEVER misfires!
  // - In Chop Mode: Triggers when a tracked hand slices across a rising fruit!
  const checkHandWeaponCollision = (
    pIdx: number,
    normX: number,
    normY: number,
    prevNormX: number,
    prevNormY: number,
    _vx: number,
    _vy: number,
    _handSpeed: number,
    _pointingAngle: number | undefined,
    handScale: number,
    cw: number,
    ch: number
  ) => {
    const eng = engineRef.current;
    if (!eng || eng.resolved || showSettingsModalRef.current) return;
    const p = eng.players[pIdx];
    if (!p || p.sideFrozen) {
      if (p) p.pendingClap = null;
      return;
    }

    const now = performance.now();
    const handsStale = !p.hasDetectedHands || (now - (p.lastHandsFrameMs || 0) > 650);
    const pointerActive = handsStale && (now - (p.lastPointerTime || 0) < 2500);

    const showLeft = !handsStale ? Boolean(p.leftHand?.detected) : pointerActive;
    const showRight = !handsStale ? Boolean(p.rightHand?.detected) : pointerActive;
    const hasPendingImpulse = Boolean(p.pendingClap && p.pendingClap.id !== p.consumedClapId);
    if (!showLeft && !showRight && !hasPendingImpulse) {
      eng.targets.forEach(t => {
        if (eng.numPlayers === 1 || (pIdx === 0 && t.team === 'p1') || (pIdx === 1 && t.team === 'p2')) {
          t.isTargeted = false;
        }
      });
      return;
    }

    const lx = (p.leftHand?.x ?? (normX - 0.06)) * cw;
    const ly = (p.leftHand?.y ?? normY) * ch;
    const prevLx = (p.leftHand?.prevX ?? p.leftHand?.x ?? prevNormX) * cw;
    const prevLy = (p.leftHand?.prevY ?? p.leftHand?.y ?? prevNormY) * ch;

    const rx = (p.rightHand?.x ?? (normX + 0.06)) * cw;
    const ry = (p.rightHand?.y ?? normY) * ch;
    const prevRx = (p.rightHand?.prevX ?? p.rightHand?.x ?? prevNormX) * cw;
    const prevRy = (p.rightHand?.prevY ?? p.rightHand?.y ?? prevNormY) * ch;

    const leftScale = Math.max(0.65, p.leftHand?.scale || handScale || 1.0);
    const rightScale = Math.max(0.65, p.rightHand?.scale || handScale || 1.0);
    const avgScale = (leftScale + rightScale) * 0.5;
    const userSizeMult = gloveSizeRef.current || 1.0;

    // =========================================================================
    // MOSQUITO SLAP MODE: PINPOINT ONE-SHOT CLAP / SWAT IMPULSE CONSUMER
    // =========================================================================
    if (eng.roundMode === 'mosquito') {
      const currentSlapMode = slapModeRef.current;
      const sens = slapSensitivityRef.current;

      // 1. Live Target Lock Highlight (`t.isTargeted`) strictly at the active aim point
      let hoveredTarget: any = null;
      let hoveredDist = 99999;
      const lockRadius = (sens === 'easy' ? 62 : sens === 'precise' ? 40 : 52) * userSizeMult;

      if ((currentSlapMode === 'clap' && showLeft && showRight) || pointerActive) {
        const aimX = (lx + rx) * 0.5;
        const aimY = (ly + ry) * 0.5;
        for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
          const t = eng.targets[tIdx];
          if (!t.alive || t.frozen) continue;
          if (eng.numPlayers === 2) {
            if (pIdx === 0 && t.team === 'p2') continue;
            if (pIdx === 1 && t.team === 'p1') continue;
          }
          const dHover = distToTargetOrOptionCard(
            t,
            { x: aimX, y: aimY - 18 },
            { x: aimX, y: aimY + 18 }
          );
          if (dHover <= lockRadius && dHover < hoveredDist) {
            hoveredDist = dHover;
            hoveredTarget = t;
          }
        }
      } else if (currentSlapMode === 'swat' && (showLeft || showRight)) {
        for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
          const t = eng.targets[tIdx];
          if (!t.alive || t.frozen) continue;
          if (eng.numPlayers === 2) {
            if (pIdx === 0 && t.team === 'p2') continue;
            if (pIdx === 1 && t.team === 'p1') continue;
          }
          const dL = showLeft ? distToTargetOrOptionCard(t, { x: lx, y: ly - 16 }, { x: lx, y: ly + 16 }) : 99999;
          const dR = showRight ? distToTargetOrOptionCard(t, { x: rx, y: ry - 16 }, { x: rx, y: ry + 16 }) : 99999;
          const dHover = Math.min(dL, dR);
          if (dHover <= lockRadius && dHover < hoveredDist) {
            hoveredDist = dHover;
            hoveredTarget = t;
          }
        }
      }

      eng.targets.forEach(t => {
        if (eng.numPlayers === 1 || (pIdx === 0 && t.team === 'p1') || (pIdx === 1 && t.team === 'p2')) {
          t.isTargeted = (t === hoveredTarget);
        }
      });

      // 2. Expire stale unconsumed impulse (> 165ms old)
      if (p.pendingClap && (now - p.pendingClap.time > 165)) {
        p.pendingClap = null;
      }

      // 3. Consume ONLY a genuine one-shot Clap / Swat / Click impulse!
      const pending = p.pendingClap;
      if (!pending || pending.id === p.consumedClapId) return;

      // Mark consumed immediately so this clap can NEVER double-fire or drag onto another mosquito
      p.consumedClapId = pending.id;
      p.pendingClap = null;

      if (now - (p.lastSlapSelectTime || 0) < 230) return;

      const impX = pending.x * cw;
      const impY = pending.y * ch;
      const impPrevX = (pending.prevX ?? pending.x) * cw;
      const impPrevY = (pending.prevY ?? pending.y) * ch;

      const baseHitPad = sens === 'easy' ? 62 : sens === 'precise' ? 38 : 50;
      const slapHitRadius = baseHitPad * Math.max(0.88, Math.min(1.42, avgScale)) * userSizeMult;

      let bestTarget: any = null;
      let bestDist = 99999;

      for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
        const t = eng.targets[tIdx];
        if (!t.alive || t.frozen || t.cooldown > 0) continue;
        if (eng.numPlayers === 2) {
          if (pIdx === 0 && t.team === 'p2') continue;
          if (pIdx === 1 && t.team === 'p1') continue;
        }

        const dCore = distToTargetOrOptionCard(
          t,
          { x: impX, y: impY - 22 },
          { x: impX, y: impY + 22 }
        );
        const dSweep = distToTargetOrOptionCard(
          t,
          { x: impPrevX, y: impPrevY },
          { x: impX, y: impY }
        );
        const dClap = Math.min(dCore, dSweep);

        if (dClap <= slapHitRadius && dClap < bestDist) {
          bestDist = dClap;
          bestTarget = t;
        }
      }

      if (bestTarget) {
        p.lastSlapSelectTime = now;
        p.isClapping = true;
        p.clapTimer = 0.22;
        p.clapArmed = false;
        p.peakArmedSep = 0;
        p.clapMidX = pending.x;
        p.clapMidY = pending.y;
        p.slapAnim = 1.0;
        p.swordLunge = 1.0;
        if (p.leftHand) p.leftHand.slapAnim = 1.0;
        if (p.rightHand) p.rightHand.slapAnim = 1.0;
        handleTargetHit(pIdx, bestTarget, 0);
      } else {
        // Tactile dry-clap audio pop when clapping in empty air (zero false penalty!)
        playSoundEffect('airclap');
      }
      return;
    }

    const lLandmarks = p.leftHand?.landmarks;
    const rLandmarks = p.rightHand?.landmarks;
    const sampleIndices = [0, 4, 5, 8, 9, 12, 13, 16, 17, 20];

    const leftPts: { x: number; y: number }[] = [];
    if (showLeft) {
      leftPts.push({ x: lx, y: ly }, { x: lx, y: ly - 42 * leftScale });
      if (lLandmarks && lLandmarks.length >= 21) {
        sampleIndices.forEach(idx => {
          const lm = lLandmarks[idx];
          if (lm) leftPts.push({ x: lm.x * cw, y: lm.y * ch });
        });
      }
    }

    const rightPts: { x: number; y: number }[] = [];
    if (showRight) {
      rightPts.push({ x: rx, y: ry }, { x: rx, y: ry - 42 * rightScale });
      if (rLandmarks && rLandmarks.length >= 21) {
        sampleIndices.forEach(idx => {
          const lm = rLandmarks[idx];
          if (lm) rightPts.push({ x: lm.x * cw, y: lm.y * ch });
        });
      }
    }

    // =========================================================================
    // CHOP MODE: FULL 3D CLEAVER BLADE SEGMENT + HAND SLICING RISING FRUITS
    // =========================================================================
    const leftMovePx = Math.hypot(lx - prevLx, ly - prevLy);
    const rightMovePx = Math.hypot(rx - prevRx, ry - prevRy);
    const isMouseClick = Boolean(p.clapTimer && p.clapTimer > 0);

    const lAngle = p.leftHand?.knifeAngle ?? -0.45;
    const rAngle = p.rightHand?.knifeAngle ?? -2.69;
    const lBladeLen = 118 * Math.max(0.75, Math.min(1.25, leftScale * 0.92));
    const rBladeLen = 118 * Math.max(0.75, Math.min(1.25, rightScale * 0.92));
    const lTipX = lx + Math.cos(lAngle) * lBladeLen;
    const lTipY = ly + Math.sin(lAngle) * lBladeLen;
    const rTipX = rx + Math.cos(rAngle) * rBladeLen;
    const rTipY = ry + Math.sin(rAngle) * rBladeLen;

    for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
      if (eng.resolved) break;
      const t = eng.targets[tIdx];
      if (!t.alive || t.frozen || t.cooldown > 0) continue;
      if (eng.numPlayers === 2) {
        if (pIdx === 0 && t.team === 'p2') continue;
        if (pIdx === 1 && t.team === 'p1') continue;
      }

      const hitRadiusL = (t.radius || 56) + 48 * leftScale;
      const hitRadiusR = (t.radius || 56) + 48 * rightScale;

      let dLeft = showLeft
        ? Math.min(
            distToTargetOrOptionCard(t, { x: prevLx, y: prevLy }, { x: lx, y: ly }),
            distToTargetOrOptionCard(t, { x: lx, y: ly }, { x: lTipX, y: lTipY })
          )
        : 99999;
      for (let k = 0; k < leftPts.length; k++) {
        const dPt = distToTargetOrOptionCard(t, leftPts[k], leftPts[k]);
        if (dPt < dLeft) dLeft = dPt;
      }

      let dRight = showRight
        ? Math.min(
            distToTargetOrOptionCard(t, { x: prevRx, y: prevRy }, { x: rx, y: ry }),
            distToTargetOrOptionCard(t, { x: rx, y: ry }, { x: rTipX, y: rTipY })
          )
        : 99999;
      for (let k = 0; k < rightPts.length; k++) {
        const dPt = distToTargetOrOptionCard(t, rightPts[k], rightPts[k]);
        if (dPt < dRight) dRight = dPt;
      }

      const leftActiveMotion = isMouseClick || leftMovePx > 0.9 || (p.leftHand?.speed || 0) > 0.004 || Math.abs(t.vy || 0) > 2.5;
      const rightActiveMotion = isMouseClick || rightMovePx > 0.9 || (p.rightHand?.speed || 0) > 0.004 || Math.abs(t.vy || 0) > 2.5;

      const leftHit = showLeft && dLeft < hitRadiusL && leftActiveMotion;
      const rightHit = showRight && dRight < hitRadiusR && rightActiveMotion;

      if (leftHit || rightHit) {
        const sliceAng = leftHit
          ? (leftMovePx > 2 ? Math.atan2(ly - prevLy, lx - prevLx) : lAngle)
          : (rightMovePx > 2 ? Math.atan2(ry - prevRy, rx - prevRx) : rAngle);
        if (leftHit) {
          t.leftKnifeHitTime = now;
          p.leftHand.slapAnim = 1.0;
        }
        if (rightHit) {
          t.rightKnifeHitTime = now;
          p.rightHand.slapAnim = 1.0;
        }
        p.slapAnim = 1.0;
        p.swordLunge = 1.0;
        handleTargetHit(pIdx, t, sliceAng);
        break;
      }
    }
  };

  // Pointer / Mouse / Touch interaction for canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'game' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    const eng = engineRef.current;
    const playerIdx = eng.numPlayers === 1 ? 0 : (rawX < 0.5 ? 0 : 1);
    const clampedX = eng.numPlayers === 1
      ? Math.max(0.04, Math.min(0.96, rawX))
      : (playerIdx === 0 ? Math.min(0.465, Math.max(0.04, rawX)) : Math.max(0.535, Math.min(0.96, rawX)));

    const now = performance.now();
    const p = eng.players[playerIdx];
    const handsStale = !p?.hasDetectedHands || (now - (p?.lastHandsFrameMs || 0) > 650);
    if (p && handsStale) {
      p.hasDetectedHands = false;
      p.lastPointerTime = now;
      const isPressed = (e.buttons & 1) === 1 || (p.clapTimer && p.clapTimer > 0);
      const spread = isPressed ? 0.008 : 0.056;
      p.clapArmed = !isPressed;
      p.leftHand.prevX = p.leftHand.x;
      p.leftHand.prevY = p.leftHand.y;
      p.rightHand.prevX = p.rightHand.x;
      p.rightHand.prevY = p.rightHand.y;
      p.leftHand.x = clampedX - spread;
      p.leftHand.y = rawY;
      p.rightHand.x = clampedX + spread;
      p.rightHand.y = rawY;
      p.leftHand.vx = p.leftHand.x - p.leftHand.prevX;
      p.leftHand.vy = p.leftHand.y - p.leftHand.prevY;
      p.leftHand.speed = Math.hypot(p.leftHand.vx, p.leftHand.vy);
      p.rightHand.vx = p.rightHand.x - p.rightHand.prevX;
      p.rightHand.vy = p.rightHand.y - p.rightHand.prevY;
      p.rightHand.speed = Math.hypot(p.rightHand.vx, p.rightHand.vy);
      if (Math.abs(p.leftHand.vx) > 0.001 || Math.abs(p.leftHand.vy) > 0.001) {
        p.leftHand.knifeAngle = Math.atan2(p.leftHand.vy, p.leftHand.vx);
        p.rightHand.knifeAngle = Math.atan2(p.rightHand.vy, p.rightHand.vx);
      }
      p.leftHand.trail.push({ x: p.leftHand.x, y: p.leftHand.y, life: 1.0 });
      if (p.leftHand.trail.length > 14) p.leftHand.trail.shift();
      p.rightHand.trail.push({ x: p.rightHand.x, y: p.rightHand.y, life: 1.0 });
      if (p.rightHand.trail.length > 14) p.rightHand.trail.shift();
    }

    updatePlayerArm(playerIdx, clampedX, rawY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'game' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    const eng = engineRef.current;
    const playerIdx = eng.numPlayers === 1 ? 0 : (rawX < 0.5 ? 0 : 1);
    const p = eng.players[playerIdx];
    if (!p) return;

    const clampedX = eng.numPlayers === 2
      ? (playerIdx === 0 ? Math.min(0.465, Math.max(0.04, rawX)) : Math.max(0.535, Math.min(0.96, rawX)))
      : Math.max(0.04, Math.min(0.96, rawX));

    const now = performance.now();
    const handsStale = !p.hasDetectedHands || (now - (p.lastHandsFrameMs || 0) > 650);
    if (handsStale) {
      p.hasDetectedHands = false;
    }

    // Emit a crisp one-shot Clap Impulse at the click/tap point!
    const nextId = (p.clapImpulseId || 0) + 1;
    p.clapImpulseId = nextId;
    p.pendingClap = {
      id: nextId,
      x: clampedX,
      y: rawY,
      prevX: p.clapMidX || clampedX,
      prevY: p.clapMidY || rawY,
      time: now,
      isSwat: false
    };

    p.lastPointerTime = now;
    p.clapTimer = 0.22;
    p.isClapping = true;
    p.slapAnim = 1.0;
    p.swordLunge = 1.0;
    p.leftHand.slapAnim = 1.0;
    p.rightHand.slapAnim = 1.0;
    p.clapMidX = clampedX;
    p.clapMidY = rawY;

    if (handsStale) {
      p.leftHand.prevX = p.leftHand.x;
      p.leftHand.prevY = p.leftHand.y;
      p.rightHand.prevX = p.rightHand.x;
      p.rightHand.prevY = p.rightHand.y;
      p.leftHand.x = clampedX - 0.008;
      p.leftHand.y = rawY;
      p.rightHand.x = clampedX + 0.008;
      p.rightHand.y = rawY;
    }

    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    eng.shockwaves.push({
      x: clampedX * cw,
      y: rawY * ch,
      radius: 18,
      maxRadius: 88,
      color: playerIdx === 1 ? '#fb7185' : '#38bdf8',
      secondaryColor: '#facc15',
      life: 0.85
    });

    updatePlayerArm(playerIdx, clampedX, rawY);
  };

  const updatePlayerArm = (pIdx: number, normX: number, normY: number, pointingAngle?: number, handScale: number = 1.0) => {
    const p = engineRef.current.players[pIdx];
    if (!p) return;

    let clampedX = normX;
    if (engineRef.current.numPlayers === 2) {
      clampedX = pIdx === 0
        ? Math.min(0.465, Math.max(0.04, normX))
        : Math.max(0.535, Math.min(0.96, normX));
    }

    p.prevHandX = p.handX;
    p.prevHandY = p.handY;
    p.handX = clampedX;
    p.handY = normY;
    p.vx = p.handX - p.prevHandX;
    p.vy = p.handY - p.prevHandY;
    p.speed = Math.hypot(p.vx, p.vy);

    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;

    checkHandWeaponCollision(pIdx, p.handX, p.handY, p.prevHandX, p.prevHandY, p.vx, p.vy, p.speed, pointingAngle, handScale || p.handScale || 1.0, cw, ch);
  };

  const distToSegment = (p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // Main 60FPS Game Loop
  useEffect(() => {
    if (screen !== 'game') return;

    // Ensure the live camera stream is active whenever entering the game screen
    if (!videoRef.current?.srcObject) {
      setupCamera();
    } else if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
    }

    let isRunning = true;
    const loop = (now: number) => {
      if (!isRunning) return;
      const dt = Math.min(0.05, (now - engineRef.current.lastFrameTime) / 1000);
      engineRef.current.lastFrameTime = now;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      const container = containerRef.current;

      if (canvas && ctx && container) {
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }

        const eng = engineRef.current;

        // Playing Time Countdown Update (Paused when Settings Modal is open or during 3s inter-question countdown)
        if (!eng.resolved && !showSettingsModalRef.current && nextQTimerRef.current === null) {
          eng.timer = Math.max(0, eng.timer - dt);
          const ceilSec = Math.ceil(eng.timer);
          if (ceilSec !== lastHudSecRef.current) {
            lastHudSecRef.current = ceilSec;
            setHudTimeLeft(ceilSec);
            setTimerPct((eng.timer / Math.max(1, eng.maxTimer)) * 100);
          }
          if (eng.timer <= 0) {
            eng.resolved = true;
            clearNextQuestionTimer();
            spawnFloatingText(cw / 2, ch / 2, `⏰ PLAYING TIME UP!`, '#f59e0b');
            playSoundEffect('victory');
            setTimeout(() => {
              if (!eng.isActive) return;
              finishGame();
            }, 950);
          }
        }

        // Screen shake decay
        ctx.save();
        if (eng.screenShake > 0.2) {
          const sx = (Math.random() - 0.5) * eng.screenShake;
          const sy = (Math.random() - 0.5) * eng.screenShake;
          ctx.translate(sx, sy);
          eng.screenShake *= 0.86;
        } else {
          eng.screenShake = 0;
        }

        // 1. Clear overlay canvas (the hardware-accelerated mirrored <video> element in z-0 renders live camera directly with zero copy lag!)
        ctx.clearRect(-20, -20, cw + 40, ch + 40);
        const hasCameraStream = Boolean(videoRef.current && videoRef.current.srcObject && videoRef.current.readyState >= 2);
        if (!hasCameraStream) {
          // Sunny Light 3D Sky & Meadow Arena only when camera stream is not available
          const grad = ctx.createLinearGradient(0, 0, 0, ch);
          grad.addColorStop(0, '#bae6fd');   // Bright sky blue
          grad.addColorStop(0.55, '#e0f2fe'); // Soft cloud white-blue
          grad.addColorStop(0.85, '#fef9c3'); // Sunny meadow glow
          grad.addColorStop(1, '#dcfce7');    // Soft pastel mint-green
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);

          // Soft 3D Sunbeams & Perspective Grid in Light Colors
          ctx.save();
          ctx.strokeStyle = 'rgba(14, 165, 233, 0.14)';
          ctx.lineWidth = 1.5;
          for (let gx = 0; gx <= cw; gx += 90) {
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, ch);
            ctx.stroke();
          }
          for (let gy = 0; gy <= ch; gy += 90) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(cw, gy);
            ctx.stroke();
          }
          ctx.restore();
        }

        // Split screen camera boundary line for 2P (Player 1 cannot pass Player 2 line)
        if (eng.numPlayers === 2) {
          const cx = cw / 2;
          ctx.save();

          // Bright 3D Sky/Gold Divider Glow
          const barrierGrad = ctx.createLinearGradient(cx - 16, 0, cx + 16, 0);
          barrierGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          barrierGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.72)');
          barrierGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
          ctx.fillStyle = barrierGrad;
          ctx.fillRect(cx - 16, 0, 32, ch);

          // Core clean dashed boundary line
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.75)';
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, ch);
          ctx.stroke();
          ctx.setLineDash([]);

          // Draw Frozen Court Side Overlay & Waiting Banner if a player's side is frozen
          [0, 1].forEach(sideIdx => {
            const sidePlayer = eng.players[sideIdx];
            if (!sidePlayer || !sidePlayer.sideFrozen) return;
            const otherSidePlayer = eng.players[sideIdx === 0 ? 1 : 0];
            const bothFrozen = Boolean(eng.players[0]?.sideFrozen && eng.players[1]?.sideFrozen);
            const sideX = sideIdx === 0 ? 0 : cx;
            const sideW = cx;

            // Translucent icy frost glaze over frozen player's court
            const iceGrad = ctx.createLinearGradient(sideX, 0, sideX, ch);
            iceGrad.addColorStop(0, 'rgba(186, 230, 253, 0.28)');
            iceGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.22)');
            iceGrad.addColorStop(1, 'rgba(14, 165, 233, 0.32)');
            ctx.fillStyle = iceGrad;
            ctx.fillRect(sideX, 0, sideW, ch);

            // Icy border frame inside the frozen court
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            ctx.lineWidth = 5;
            ctx.strokeRect(sideX + 4, 4, sideW - 8, ch - 8);

            // 3D Ice Banner in the center-bottom of the frozen court
            const bannerW = Math.min(sideW - 28, 320);
            const bannerH = 64;
            const bx = sideX + (sideW - bannerW) / 2;
            const by = ch - 148;
            ctx.fillStyle = 'rgba(240, 249, 255, 0.96)';
            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 4;
            roundRect(ctx, bx, by, bannerW, bannerH, 18);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#0369a1';
            ctx.font = '900 15px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
              bothFrozen ? '❄️ BOTH INCORRECT! UNFREEZING...' : `❄️ ${(sidePlayer.name || `PLAYER ${sideIdx + 1}`).toUpperCase()} FROZEN!`,
              bx + bannerW / 2,
              by + 22
            );
            ctx.fillStyle = '#0284c7';
            ctx.font = '800 12px Fredoka, sans-serif';
            ctx.fillText(
              bothFrozen
                ? 'Get ready to choose again!'
                : `Waiting for ${otherSidePlayer?.name || (sideIdx === 0 ? 'Player 2' : 'Player 1')} to answer...`,
              bx + bannerW / 2,
              by + 44
            );
          });

          ctx.restore();
        }

        // 2. Headgear removed so player camera view & answer cards are completely unobstructed

        // 3. Draw 3D Splat Decals
        for (let i = eng.splats.length - 1; i >= 0; i--) {
          const s = eng.splats[i];
          s.alpha -= dt * 0.42;
          if (s.alpha <= 0) {
            eng.splats.splice(i, 1);
            continue;
          }
          draw3DSplat(ctx, s);
        }

        // 4. Update & Draw Targets:
        //    - In Mosquito Mode: Mosquitoes actively fly around the arena and periodically lunge in to BITE the player!
        //    - In Chop Mode: Fruits launch FROM BELOW the bottom of the screen and rise UPWARD in an arc!
        // Decay Slow-Mo & Player Multipliers in Multiple Answer Mode
        if ((eng as any).slowMoTimer > 0) {
          (eng as any).slowMoTimer = Math.max(0, ((eng as any).slowMoTimer || 0) - dt);
        }
        eng.players.forEach(pl => {
          if (pl && (pl.multTimer || 0) > 0) {
            pl.multTimer = Math.max(0, pl.multTimer - dt);
            if (pl.multTimer === 0) {
              pl.activeMult = 1;
            }
          }
        });
        const m0 = eng.players[0]?.activeMult || 1;
        const m1 = eng.players[1]?.activeMult || 1;
        const smNow = ((eng as any).slowMoTimer || 0) > 0 ? 1 : 0;
        const multsSig = `${m0}-${m1}-${smNow}`;
        if (multsSig !== lastHudMultsSigRef.current) {
          lastHudMultsSigRef.current = multsSig;
          setHudActiveMults([m0, m1]);
          setHudSlowMo(smNow === 1);
        }

        const slowMoFactor = smNow === 1 ? 0.48 : 1.0;
        const mvStyle = movementStyleRef.current;
        const moveMult = (mvStyle === 'hover' ? 0.45 : mvStyle === 'calm' ? 0.78 : mvStyle === 'zigzag' ? 1.32 : 1.05) * slowMoFactor;
        // Keep mosquitoes & answer capsules safely below the Minimalist Top Scoreboard and above the Bottom Question Bar!
        const padTop = Math.max(96, Math.min(124, ch * 0.15));
        const padBottom = Math.max(118, Math.min(148, ch * 0.20));
        const is2P = eng.numPlayers === 2;
        const curSpd = speedRef.current || 1.0;

        eng.targets.forEach(t => {
          if (t.cooldown > 0) t.cooldown--;
          if (!t.alive) return;

          const isTeamSideFrozen =
            eng.numPlayers === 2 &&
            ((t.team === 'p1' && eng.players[0]?.sideFrozen) ||
             (t.team === 'p2' && eng.players[1]?.sideFrozen));

          if (t.frozenTimer > 0 && !isTeamSideFrozen) {
            t.frozenTimer = Math.max(0, t.frozenTimer - dt);
            if (t.frozenTimer === 0 && t.frozen) {
              t.frozen = false;
              const restoreAng = (t.optionIndex || 0) * Math.PI * 0.5 + 0.4;
              t.vx = Math.cos(restoreAng) * 1.9 * curSpd;
              t.vy = eng.roundMode === 'chop' ? -8.5 * Math.sqrt(curSpd) : Math.sin(restoreAng) * 1.6 * curSpd;
            }
          }

          const halfW = (t.cardW || (is2P ? 165 : 210)) / 2 + 14;

          if (eng.roundMode === 'chop') {
            // CHOP MODE: Fruits come from below and rise UPWARD, then re-launch from below if unsliced!
            if (!t.frozen && !showSettingsModalRef.current) {
              const g = (t.gravity || (0.135 * curSpd)) * moveMult;
              t.x += t.vx * moveMult + Math.sin(now * 0.004 + t.wobblePhase) * 0.35;
              t.y += t.vy * moveMult;
              t.vy += g;
              t.rotation = (t.rotation || 0) + (t.rotSpeed || 0.03) * moveMult;

              // Keep peak inside the upper play zone below the question banner
              if (t.y < padTop + 32 && t.vy < 0) {
                t.y = padTop + 32;
                t.vy *= 0.35;
              }

              // Re-launch fruit upward from below the bottom of the screen when it falls back down!
              if (t.y > ch + 68 && t.vy > 0) {
                const gBase = t.gravity || (0.135 * curSpd * Math.max(0.85, ch / 600));
                t.y = ch + 46;
                t.x = (t.homeX || t.x) + (Math.random() - 0.5) * 24;
                const peakY = Math.max(168, ch * (0.26 + ((t.optionIndex || 0) % 2) * 0.07));
                const riseDist = Math.max(240, t.y - peakY);
                t.vy = -Math.sqrt(2 * gBase * riseDist);
                t.vx = (Math.random() - 0.5) * 1.1 * curSpd;
              }
            } else if (t.frozen) {
              // Keep frozen wrong fruit visible inside the arena
              t.y = Math.min(ch - padBottom - 24, Math.max(padTop + 36, t.y));
            }

            if (t.team === 'p1') {
              if (t.x < halfW + 10) { t.x = halfW + 10; t.vx = Math.abs(t.vx); }
              if (t.x > (cw / 2) - halfW - 10) { t.x = (cw / 2) - halfW - 10; t.vx = -Math.abs(t.vx); }
            } else if (t.team === 'p2') {
              if (t.x < (cw / 2) + halfW + 10) { t.x = (cw / 2) + halfW + 10; t.vx = Math.abs(t.vx); }
              if (t.x > cw - halfW - 10) { t.x = cw - halfW - 10; t.vx = -Math.abs(t.vx); }
            } else {
              if (t.x < halfW + 16) { t.x = halfW + 16; t.vx = Math.abs(t.vx); }
              if (t.x > cw - halfW - 16) { t.x = cw - halfW - 16; t.vx = -Math.abs(t.vx); }
            }
          } else {
            // MOSQUITO MODE: Mosquitoes actively fly around the court and periodically latch/hover to BITE the player!
            const biteWave = Math.sin(now * 0.0036 + t.wobblePhase * 1.9);
            const isBitingNow = !t.frozen && biteWave > 0.15;
            t.biteIntensity = isBitingNow ? Math.min(1, (biteWave - 0.15) / 0.55) : 0;

            const maxSpeed = 2.45 * curSpd;
            const minSpeed = 1.25 * curSpd;
            const currentVel = Math.hypot(t.vx, t.vy);
            if (currentVel > maxSpeed) {
              t.vx = (t.vx / currentVel) * maxSpeed;
              t.vy = (t.vy / currentVel) * maxSpeed;
            } else if (currentVel < minSpeed && !t.frozen) {
              const boostAng = Math.atan2(t.vy || 0.5, t.vx || 0.8);
              t.vx = Math.cos(boostAng) * minSpeed;
              t.vy = Math.sin(boostAng) * minSpeed;
            }

            if (!t.frozen && !showSettingsModalRef.current) {
              // Slow flight slightly while actively biting so it looks like the mosquito latched onto the player's visor/skin
              const biteFlightDamp = 1 - (t.biteIntensity || 0) * 0.62;
              const swoopX = Math.sin(now * 0.0055 + t.wobblePhase) * 1.85 + Math.cos(now * 0.011 + t.wingPhase) * 0.75;
              const swoopY = Math.cos(now * 0.0068 + t.wobblePhase) * 1.55 + Math.sin(now * 0.013 + t.wingPhase) * 0.65;
              t.x += (t.vx + swoopX) * moveMult * biteFlightDamp;
              t.y += (t.vy + swoopY) * moveMult * biteFlightDamp;
            }

            if (t.team === 'p1') {
              if (t.x < halfW + 10) { t.x = halfW + 10; t.vx = Math.abs(t.vx); }
              if (t.x > (cw / 2) - halfW - 10) { t.x = (cw / 2) - halfW - 10; t.vx = -Math.abs(t.vx); }
            } else if (t.team === 'p2') {
              if (t.x < (cw / 2) + halfW + 10) { t.x = (cw / 2) + halfW + 10; t.vx = Math.abs(t.vx); }
              if (t.x > cw - halfW - 10) { t.x = cw - halfW - 10; t.vx = -Math.abs(t.vx); }
            } else {
              if (t.x < halfW + 16) { t.x = halfW + 16; t.vx = Math.abs(t.vx); }
              if (t.x > cw - halfW - 16) { t.x = cw - halfW - 16; t.vx = -Math.abs(t.vx); }
            }

            const topLimit = padTop + 26;
            const botLimit = ch - padBottom - Math.max(28, (t.cardH || 50) * 0.65);
            if (t.y < topLimit) { t.y = topLimit; t.vy = Math.abs(t.vy); }
            if (t.y > botLimit) { t.y = botLimit; t.vy = -Math.abs(t.vy); }
          }
        });

        // 4b. Strict Anti-Overlap Physics: Options in the same court push apart so they NEVER overlap!
        for (let i = 0; i < eng.targets.length; i++) {
          const t1 = eng.targets[i];
          if (!t1.alive) continue;
          const w1 = t1.cardW || (is2P ? 165 : 210);
          const h1 = t1.cardH || 48;

          for (let j = i + 1; j < eng.targets.length; j++) {
            const t2 = eng.targets[j];
            if (!t2.alive) continue;
            if (t1.team !== t2.team) continue;

            const w2 = t2.cardW || (is2P ? 165 : 210);
            const h2 = t2.cardH || 48;

            const dx = t2.x - t1.x;
            const dy = t2.y - t1.y;

            const minSepX = (w1 + w2) * 0.5 + 22;
            const minSepY = (h1 + h2) * 0.5 + 44;

            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (absDx < minSepX && absDy < minSepY) {
              const penX = minSepX - absDx;
              const penY = minSepY - absDy;

              if (eng.roundMode === 'chop' || penX / minSepX < penY / minSepY) {
                const signX = dx >= 0 ? 1 : -1;
                const push = (penX * 0.5 + 2) * signX;
                if (!t1.frozen) { t1.x -= push; if (eng.roundMode !== 'chop') t1.vx = -signX * Math.max(0.8, Math.abs(t1.vx)); }
                if (!t2.frozen) { t2.x += push; if (eng.roundMode !== 'chop') t2.vx = signX * Math.max(0.8, Math.abs(t2.vx)); }
              } else {
                const signY = dy >= 0 ? 1 : -1;
                const push = (penY * 0.5 + 2) * signY;
                if (!t1.frozen) { t1.y -= push; t1.vy = -signY * Math.max(0.8, Math.abs(t1.vy)); }
                if (!t2.frozen) { t2.y += push; t2.vy = signY * Math.max(0.8, Math.abs(t2.vy)); }
              }
            }
          }
        }

        // Clear stale target locks if a player's hands/pointer are no longer visible
        eng.players.forEach((pl, pIdx) => {
          if (pIdx === 1 && eng.numPlayers === 1) return;
          const handsStale = !pl.hasDetectedHands || (now - (pl.lastHandsFrameMs || 0) > 650);
          const pointerActive = handsStale && (now - (pl.lastPointerTime || 0) < 2500);
          const anyVisible = !handsStale
            ? Boolean(pl.leftHand?.detected || pl.rightHand?.detected)
            : pointerActive;
          if (!anyVisible) {
            eng.targets.forEach(t => {
              if (eng.numPlayers === 1 || (pIdx === 0 && t.team === 'p1') || (pIdx === 1 && t.team === 'p2')) {
                t.isTargeted = false;
              }
            });
          }
        });

        // Draw all active targets
        eng.targets.forEach(t => {
          if (!t.alive) return;
          if (eng.roundMode === 'mosquito') {
            drawMosquitoTarget(ctx, t, now);
          } else {
            drawFruitTarget(ctx, t, now);
          }
        });

        // Sync Live Left/Right Hand Sensor + Clap Armed Indicators to HUD without extra re-renders
        const p0L = Boolean(eng.players[0]?.leftHand?.detected);
        const p0R = Boolean(eng.players[0]?.rightHand?.detected);
        const p1L = Boolean(eng.players[1]?.leftHand?.detected);
        const p1R = Boolean(eng.players[1]?.rightHand?.detected);
        const handsSig = `${p0L ? 1 : 0}${p0R ? 1 : 0}${p1L ? 1 : 0}${p1R ? 1 : 0}`;
        if (handsSig !== lastHudHandsRef.current) {
          lastHudHandsRef.current = handsSig;
          setHudHandsDetected([[p0L, p0R], [p1L, p1R]]);
        }

        const p0Arm = slapModeRef.current === 'swat'
          ? (p0L || p0R)
          : Boolean(eng.players[0]?.clapArmed && p0L && p0R);
        const p1Arm = slapModeRef.current === 'swat'
          ? (p1L || p1R)
          : Boolean(eng.players[1]?.clapArmed && p1L && p1R);
        const armedSig = `${p0Arm ? 1 : 0}${p1Arm ? 1 : 0}`;
        if (armedSig !== lastHudArmedRef.current) {
          lastHudArmedRef.current = armedSig;
          setHudClapArmed([p0Arm, p1Arm]);
        }

        // 5. Draw Tracked 3D Slap Gloves (in Mosquito Mode) & 3D Chopping Knives (in Chop Mode)
        eng.players.forEach((p, idx) => {
          if (idx === 1 && eng.numPlayers === 1) return;
          p.slapAnim = Math.max(0, p.slapAnim - dt * 3.8);
          p.swordLunge = Math.max(0, p.swordLunge - dt * 3.2);
          if (p.leftHand) p.leftHand.slapAnim = Math.max(0, (p.leftHand.slapAnim || 0) - dt * 3.8);
          if (p.rightHand) p.rightHand.slapAnim = Math.max(0, (p.rightHand.slapAnim || 0) - dt * 3.8);
          if (p.frozenTimer > 0 && !p.sideFrozen) {
            p.frozenTimer = Math.max(0, p.frozenTimer - dt);
            if (p.frozenTimer === 0) {
              setHudFrozen([
                Boolean((eng.players[0]?.frozenTimer || 0) > 0 || eng.players[0]?.sideFrozen),
                Boolean((eng.players[1]?.frozenTimer || 0) > 0 || eng.players[1]?.sideFrozen)
              ]);
            }
          }
          if (p.clapTimer > 0) {
            p.clapTimer = Math.max(0, p.clapTimer - dt);
            if (p.clapTimer === 0 && !p.hasDetectedHands) {
              p.isClapping = false;
              p.leftHand.x = p.handX - 0.068;
              p.rightHand.x = p.handX + 0.068;
            }
          }

          // Decay trails on player and both hands
          for (let t = p.trail.length - 1; t >= 0; t--) {
            p.trail[t].life -= dt * 3.6;
            if (p.trail[t].life <= 0) p.trail.splice(t, 1);
          }
          if (p.leftHand?.trail) {
            for (let t = p.leftHand.trail.length - 1; t >= 0; t--) {
              p.leftHand.trail[t].life -= dt * 4.2;
              if (p.leftHand.trail[t].life <= 0) p.leftHand.trail.splice(t, 1);
            }
          }
          if (p.rightHand?.trail) {
            for (let t = p.rightHand.trail.length - 1; t >= 0; t--) {
              p.rightHand.trail[t].life -= dt * 4.2;
              if (p.rightHand.trail[t].life <= 0) p.rightHand.trail.splice(t, 1);
            }
          }

          const pointerActive = !p.hasDetectedHands && (now - (p.lastPointerTime || 0) < 2500);
          const isTouching = Boolean(p.isClapping || (p.clapTimer && p.clapTimer > 0) || (p.slapAnim && p.slapAnim > 0.08));
          const hadBothRecently = p.hasDetectedHands && (now - (p.lastTrueTwoHandsTime || 0) < 950);

          // Never let one glove disappear during a slap or when both hands were active within the grace window!
          const showLeft = p.hasDetectedHands
            ? Boolean(p.leftHand?.detected || isTouching || hadBothRecently)
            : pointerActive;
          const showRight = p.hasDetectedHands
            ? Boolean(p.rightHand?.detected || isTouching || hadBothRecently)
            : pointerActive;

          // Smooth ready positions for Left & Right Gloves when a hand is resting outside the camera frame
          const minCourtX = eng.numPlayers === 2 ? (idx === 0 ? 0.07 : 0.55) : 0.10;
          const maxCourtX = eng.numPlayers === 2 ? (idx === 0 ? 0.45 : 0.93) : 0.90;
          const readyLx = Math.max(minCourtX, Math.min(maxCourtX, p.headX - 0.14));
          const readyRx = Math.max(minCourtX, Math.min(maxCourtX, p.headX + 0.14));
          const readyY = Math.min(0.80, Math.max(0.46, p.headY + 0.18));

          if (!showLeft && p.leftHand) {
            p.leftHand.x += (readyLx - p.leftHand.x) * 0.16;
            p.leftHand.y += (readyY - p.leftHand.y) * 0.16;
          }
          if (!showRight && p.rightHand) {
            p.rightHand.x += (readyRx - p.rightHand.x) * 0.16;
            p.rightHand.y += (readyY - p.rightHand.y) * 0.16;
          }

          let lx = (p.leftHand?.x ?? readyLx) * cw;
          let ly = (p.leftHand?.y ?? readyY) * ch;
          let rx = (p.rightHand?.x ?? readyRx) * cw;
          let ry = (p.rightHand?.y ?? readyY) * ch;

          // If slapping right now and one hand was occluded, bring both gloves smoothly together at the slap point!
          if (isTouching && p.clapMidX && p.clapMidY && (!p.leftHand?.detected || !p.rightHand?.detected)) {
            const slapCx = p.clapMidX * cw;
            const slapCy = p.clapMidY * ch;
            lx = slapCx - 18;
            ly = slapCy;
            rx = slapCx + 18;
            ry = slapCy;
          }

          // Draw AR Hand Tracking Reticles (in Chop Mode) & Motion Trails
          drawARHandTrackingOverlay(
            ctx,
            p,
            lx,
            ly,
            rx,
            ry,
            showLeft,
            showRight,
            isTouching,
            cw,
            ch,
            now
          );

          if (eng.roundMode === 'mosquito') {
            // ONLY draw a glove when that real hand is detected on camera (or pointer fallback is active)
            if (showLeft) {
              drawSingleCartoonGlove(
                ctx,
                lx,
                ly,
                p.leftHand?.angle ?? -0.18,
                p.leftHand?.scale || p.handScale || 1.15,
                false,
                p.theme,
                Math.max(p.slapAnim || 0, p.leftHand?.slapAnim || 0),
                p.leftHand?.openness || 1.0,
                p.frozenTimer > 0,
                p.leftHand?.landmarks || undefined,
                cw,
                ch
              );
            }

            if (showRight) {
              drawSingleCartoonGlove(
                ctx,
                rx,
                ry,
                p.rightHand?.angle ?? 0.18,
                p.rightHand?.scale || p.handScale || 1.15,
                true,
                p.theme,
                Math.max(p.slapAnim || 0, p.rightHand?.slapAnim || 0),
                p.rightHand?.openness || 1.0,
                p.frozenTimer > 0,
                p.rightHand?.landmarks || undefined,
                cw,
                ch
              );
            }

            // When the two gloves visually clap together, draw a bright golden "CLAP!" shockwave ring at the meeting point
            if (isTouching && showLeft && showRight) {
              const cx = (lx + rx) * 0.5;
              const cy = (ly + ry) * 0.5;
              ctx.save();
              ctx.translate(cx, cy);
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 4.5;
              ctx.beginPath();
              ctx.arc(0, 0, 38 + (1 - (p.slapAnim || 0.5)) * 28, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          } else {
            // CHOP MODE: Draw 3D Chopping Knives on active hands
            if (showLeft) {
              drawSingle3DChoppingKnife(
                ctx,
                lx,
                ly,
                p.leftHand?.knifeAngle ?? -0.45,
                p.leftHand?.scale || 1.0,
                false,
                p.theme,
                p.leftHand?.trail || [],
                cw,
                ch,
                now,
                p.leftHand?.slapAnim || 0,
                p.frozenTimer > 0
              );
            }
            if (showRight) {
              drawSingle3DChoppingKnife(
                ctx,
                rx,
                ry,
                p.rightHand?.knifeAngle ?? -2.69,
                p.rightHand?.scale || 1.0,
                true,
                p.theme,
                p.rightHand?.trail || [],
                cw,
                ch,
                now,
                p.rightHand?.slapAnim || 0,
                p.frozenTimer > 0
              );
            }
          }

          // Continuous per-frame collision & impulse check
          const handsStaleNow = !p.hasDetectedHands || (now - (p.lastHandsFrameMs || 0) > 650);
          const hasPending = Boolean(p.pendingClap && p.pendingClap.id !== p.consumedClapId);
          if (!showSettingsModalRef.current && (showLeft || showRight || hasPending || !handsStaleNow)) {
            const activeX = showLeft && showRight ? (lx + rx) * 0.5 : (showLeft ? lx : rx);
            const activeY = showLeft && showRight ? (ly + ry) * 0.5 : (showLeft ? ly : ry);
            checkHandWeaponCollision(
              idx,
              activeX / cw,
              activeY / ch,
              activeX / cw,
              activeY / ch,
              0,
              0,
              Math.max(p.leftHand?.speed || 0, p.rightHand?.speed || 0, 0.015),
              0,
              (p.leftHand?.scale || 1.0) * 0.5 + (p.rightHand?.scale || 1.0) * 0.5,
              cw,
              ch
            );
          }
        });

        // 5b. Render 3D Expanding Slap & Clap Shockwave Rings
        for (let i = eng.shockwaves.length - 1; i >= 0; i--) {
          const sw = eng.shockwaves[i];
          sw.life -= dt * 3.4;
          if (sw.life <= 0) {
            eng.shockwaves.splice(i, 1);
            continue;
          }
          const progress = 1 - Math.max(0, sw.life);
          const curR = (sw.radius || 22) + ((sw.maxRadius || 110) - (sw.radius || 22)) * (1 - Math.pow(1 - progress, 2.2));
          ctx.save();
          ctx.translate(sw.x, sw.y);
          ctx.globalAlpha = Math.max(0, sw.life * 0.92);
          ctx.strokeStyle = sw.color || '#facc15';
          ctx.lineWidth = Math.max(2, 7.5 * sw.life);
          ctx.beginPath();
          ctx.arc(0, 0, curR, 0, Math.PI * 2);
          ctx.stroke();

          if (sw.secondaryColor) {
            ctx.strokeStyle = sw.secondaryColor;
            ctx.lineWidth = Math.max(1.5, 4 * sw.life);
            ctx.beginPath();
            ctx.arc(0, 0, curR * 0.72, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 6. 3D Crescent Slicing Slash Arcs, Sliced Halves & Particles
        for (let i = eng.swordSparks.length - 1; i >= 0; i--) {
          const sp = eng.swordSparks[i];
          sp.life -= dt * 2.9;
          if (sp.life <= 0) {
            eng.swordSparks.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.translate(sp.x, sp.y);
          ctx.rotate(sp.angle || -0.35);
          const life = Math.max(0, sp.life);
          const slashLen = (sp.radius || 120) * (1.15 - life * 0.25);

          // Glowing outer slicing crescent arc
          ctx.globalAlpha = life;
          ctx.shadowColor = sp.color || '#38bdf8';
          ctx.shadowBlur = 18;
          ctx.fillStyle = sp.color || '#38bdf8';
          ctx.beginPath();
          ctx.moveTo(-slashLen, 0);
          ctx.quadraticCurveTo(0, -34 * life, slashLen, 0);
          ctx.quadraticCurveTo(0, -10 * life, -slashLen, 0);
          ctx.closePath();
          ctx.fill();

          // Razor-bright white inner slash core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(-slashLen * 0.86, 0);
          ctx.quadraticCurveTo(0, -18 * life, slashLen * 0.86, 0);
          ctx.quadraticCurveTo(0, -4 * life, -slashLen * 0.86, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        for (let i = eng.slicedHalves.length - 1; i >= 0; i--) {
          const h = eng.slicedHalves[i];
          h.x += h.vx;
          h.y += h.vy;
          h.vy += 0.28;
          h.rotation += h.rotSpeed;
          h.alpha -= dt * 0.68;
          if (h.alpha <= 0 || h.y > ch + 100) {
            eng.slicedHalves.splice(i, 1);
            continue;
          }
          drawSlicedHalf(ctx, h);
        }

        for (let i = eng.particles.length - 1; i >= 0; i--) {
          const pt = eng.particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vy += 0.22;
          pt.life -= dt * 1.4;
          if (pt.life <= 0) {
            eng.particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = pt.life;
          const pGrad = ctx.createRadialGradient(pt.x - pt.size * 0.25, pt.y - pt.size * 0.25, 1, pt.x, pt.y, pt.size);
          pGrad.addColorStop(0, '#ffffff');
          pGrad.addColorStop(0.4, pt.color);
          pGrad.addColorStop(1, pt.color);
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 6b. Flying 3D Score Orbs rocketing from slapped mosquitoes to the Center Scoreboard!
        const orbs = (eng as any).scoreOrbs as any[] | undefined;
        if (orbs && orbs.length > 0) {
          for (let i = orbs.length - 1; i >= 0; i--) {
            const orb = orbs[i];
            orb.progress += dt * 2.25;
            if (orb.progress >= 1) {
              spawnBurstParticles(orb.targetX, orb.targetY, '#facc15', 16);
              spawnBurstParticles(orb.targetX, orb.targetY, orb.color || '#10b981', 10);
              orbs.splice(i, 1);
              continue;
            }
            const t = orb.progress;
            const ease = 1 - Math.pow(1 - t, 2.4);
            const ctrlX = (orb.startX + orb.targetX) * 0.5;
            const ctrlY = Math.min(orb.startY, orb.targetY) - 90;
            const inv = 1 - ease;
            orb.x = inv * inv * orb.startX + 2 * inv * ease * ctrlX + ease * ease * orb.targetX;
            orb.y = inv * inv * orb.startY + 2 * inv * ease * ctrlY + ease * ease * orb.targetY;

            const scale = 1.0 + Math.sin(t * Math.PI) * 0.35;
            ctx.save();
            ctx.translate(orb.x, orb.y);
            ctx.scale(scale, scale);

            // Outer golden halo
            const halo = ctx.createRadialGradient(0, 0, 5, 0, 0, 42);
            halo.addColorStop(0, '#fef08a');
            halo.addColorStop(0.55, orb.color || '#10b981');
            halo.addColorStop(1, 'rgba(250, 204, 21, 0)');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(0, 0, 42, 0, Math.PI * 2);
            ctx.fill();

            // 3D Medallion Pill
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, 26, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.font = '900 22px Fredoka, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(orb.points || '+5', 0, 1);
            ctx.restore();
          }
        }

        // 6c. Render 3D Sky Lightning Bolts from ⚡ AUTO-ZAP Power-Up!
        const bolts = (eng as any).lightningBolts as any[] | undefined;
        if (bolts && bolts.length > 0) {
          for (let i = bolts.length - 1; i >= 0; i--) {
            const b = bolts[i];
            b.life -= dt * 3.2;
            if (b.life <= 0) {
              bolts.splice(i, 1);
              continue;
            }
            ctx.save();
            ctx.globalAlpha = Math.max(0, b.life);
            ctx.strokeStyle = b.color || '#facc15';
            ctx.lineWidth = 8 * b.life;
            ctx.shadowColor = '#a855f7';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.moveTo(b.startX, b.startY);
            const steps = 6;
            for (let s = 1; s < steps; s++) {
              const frac = s / steps;
              const jx = b.startX + (b.endX - b.startX) * frac + (Math.random() - 0.5) * 44;
              const jy = b.startY + (b.endY - b.startY) * frac + (Math.random() - 0.5) * 28;
              ctx.lineTo(jx, jy);
            }
            ctx.lineTo(b.endX, b.endY);
            ctx.stroke();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3 * b.life;
            ctx.stroke();
            ctx.restore();
          }
        }

        // 7. Bigger Floating 3D Feedback Texts
        for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
          const ft = eng.floatingTexts[i];
          ft.y -= 2.0;
          ft.life -= dt * 0.9;
          if (ft.life <= 0) {
            eng.floatingTexts.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = ft.life;
          const popScale = 1 + Math.sin((1 - ft.life) * Math.PI) * 0.28;
          ctx.translate(ft.x, ft.y);
          ctx.scale(popScale, popScale);
          ctx.font = '900 34px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 5;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 8;
          ctx.strokeText(ft.text, 0, 0);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, 0, 0);
          ctx.restore();
        }

        ctx.restore();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isRunning = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [screen, showHeadgear, gameMode, speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Save Quiz to Firebase
  const saveQuiz = async (quiz: Quiz) => {
    if (!user) {
      onViewChange("games");
      return;
    }
    try {
      const now = new Date().toISOString();
      const gameToSave = {
        name: quiz.title || quiz.topic || "Slap and Chop Game",
        title: quiz.title || quiz.topic || "Slap and Chop Game",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "slap-and-chop",
        customQuestions: quiz.questions,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || "Teacher",
        creatorEmail: user.email || "",
        updatedAt: now,
        isPublic: Boolean(quiz.isPublic)
      };

      if (initialGame?.id && !String(initialGame.id).startsWith('sample-')) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
      }

      logUserActivity({
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || 'User',
        userPhoto: user.photoURL || null,
        action: initialGame?.id ? 'edit_game' : 'create_game',
        title: `${initialGame?.id ? 'Updated' : 'Created'} Game: "${quiz.title || 'Slap & Chop'}"`,
        gameTitle: quiz.title || 'Slap & Chop',
        gameType: 'slap-and-chop',
        questionCount: quiz.questions?.length || 0,
        details: `Configured ${quiz.questions?.length || 0} questions for ${quiz.classLevel || 'all grades'}. Topic: ${quiz.topic || 'General'}.`
      });

      onViewChange("games");
    } catch (e: any) {
      console.error("Save error:", e);
    }
  };

  // -------------------------------------------------------------
  // HIGH-DEFINITION 3D RENDERING HELPERS FOR AR CANVAS
  // -------------------------------------------------------------
  const draw3DSplat = (ctx: CanvasRenderingContext2D, s: any) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, s.alpha);
    ctx.translate(s.x, s.y);

    // Core glossy splat blob
    const grad = ctx.createRadialGradient(-10, -10, 4, 0, 0, 48);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, s.color);
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;

    ctx.beginPath();
    const lobes = 9;
    for (let i = 0; i <= lobes * 2; i++) {
      const ang = (i / (lobes * 2)) * Math.PI * 2;
      const r = (i % 2 === 0 ? 44 : 24) + Math.sin(i * 3.1 + (s.seed || 0)) * 7;
      const px = Math.cos(ang) * r;
      const py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.quadraticCurveTo(Math.cos(ang - 0.15) * (r + 8), Math.sin(ang - 0.15) * (r + 8), px, py);
    }
    ctx.closePath();
    ctx.fill();

    // Outer 3D droplets
    ctx.fillStyle = s.color;
    for (let d = 0; d < 6; d++) {
      const a = d * 1.05 + (s.seed || 0);
      const dist = 48 + (d % 3) * 11;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, 4 + (d % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  // 3D AR Hand Tracking Reticles, Palm Skeleton Nodes & Magnetic Clap Tether
  const drawARHandTrackingOverlay = (
    ctx: CanvasRenderingContext2D,
    p: any,
    lx: number,
    ly: number,
    rx: number,
    ry: number,
    showLeft: boolean,
    showRight: boolean,
    isTouching: boolean,
    cw: number,
    ch: number,
    now: number
  ) => {
    ctx.save();
    const isChop = engineRef.current.roundMode === 'chop';

    // 1. Draw glowing motion ribbon trail for Slap Gloves
    if (!isChop) {
      [
        { show: showLeft, trail: p.leftHand?.trail, color: p.theme?.gloveMain || '#a855f7' },
        { show: showRight, trail: p.rightHand?.trail, color: p.theme?.gloveMain || '#a855f7' }
      ].forEach(({ show, trail, color }) => {
        if (!show || !trail || trail.length < 2) return;
        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          ctx.strokeStyle = color;
          ctx.globalAlpha = p1.life * 0.28;
          ctx.lineWidth = p1.life * 18;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x * cw, p0.y * ch);
          ctx.lineTo(p1.x * cw, p1.y * ch);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;

      // 1b. Live Pinpoint Clap Aim Reticle & Re-Open Hands Cue (Mosquito Slap Mode)
      const curMode = slapModeRef.current;
      if (curMode === 'clap' && showLeft && showRight) {
        const mx = (lx + rx) * 0.5;
        const my = (ly + ry) * 0.5;
        const handDist = Math.hypot(rx - lx, ry - ly);
        const isArmed = Boolean(p.clapArmed || !p.hasDetectedHands);
        const needsReopen = Boolean(
          p.hasDetectedHands &&
          !p.clapArmed &&
          !isTouching &&
          p.needsReopenSinceMs > 0 &&
          (now - p.needsReopenSinceMs > 460)
        );

        ctx.save();
        // Subtle magnetic guide line when hands are within clapping range
        if (handDist > 36 && handDist < 420) {
          ctx.strokeStyle = isArmed ? 'rgba(16, 185, 129, 0.45)' : 'rgba(251, 191, 36, 0.38)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([7, 7]);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Pinpoint Center Clap Aim Reticle
        ctx.translate(mx, my);
        const pulse = 1 + Math.sin(now * 0.012) * 0.08;
        ctx.strokeStyle = isTouching ? '#facc15' : (isArmed ? '#10b981' : '#94a3b8');
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 17 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Crisp white-bordered center dot
        ctx.fillStyle = isTouching ? '#facc15' : (isArmed ? '#10b981' : '#cbd5e1');
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Friendly "OPEN HANDS" hint if player holds hands together after clapping
        if (needsReopen) {
          const pillW = 128;
          const pillH = 26;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
          roundRect(ctx, -pillW / 2, -52, pillW, pillH, 13);
          ctx.fill();
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#fde047';
          ctx.font = '800 11px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↔ OPEN HANDS', 0, -39);
        }
        ctx.restore();
      } else if (curMode === 'swat' && p.hasDetectedHands) {
        [
          { show: showLeft, hx: lx, hy: ly },
          { show: showRight, hx: rx, hy: ry }
        ].forEach(({ show, hx, hy }) => {
          if (!show) return;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, 38, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        });
      }
    }

    // 2. Draw Subtle 3D AR Hand Sensor Halo (in Chop Mode only, so Slap Mode gloves stay clean like reference image)
    if (isChop && p.hasDetectedHands) {
      [
        { show: showLeft, hand: p.leftHand, hx: lx, hy: ly, label: 'L' },
        { show: showRight, hand: p.rightHand, hx: rx, hy: ry, label: 'R' }
      ].forEach(({ show, hand, hx, hy }) => {
        if (!show || !hand) return;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(now * 0.0025);
        ctx.strokeStyle = isTouching ? '#facc15' : 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (hand.landmarks && hand.landmarks.length >= 21) {
          const keyTipIndices = [4, 8, 12, 16, 20];
          ctx.fillStyle = isTouching ? '#fde047' : '#38bdf8';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          keyTipIndices.forEach(idx => {
            const lm = hand.landmarks[idx];
            if (!lm) return;
            const px = lm.x * cw;
            const py = lm.y * ch;
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          });
        }
      });
    }

    ctx.restore();
  };

  // Mosquito Net Headgear Covering the User's Face (Proportioned & Coupled to Tracked Head + Hand Size)
  const drawPurpleMosquitoNetHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const coupledScale = p.hasDetectedHands
      ? (p.headScale || 1.0) * 0.45 + (p.handScale || 1.0) * 0.55
      : (p.headScale || 1.0);
    const baseScale = Math.max(0.58, Math.min(2.15, (cw / 1280) * 0.88 * coupledScale));

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);
    // Align so the upper brim (-24) rests on the forehead above the eyebrows, and the veil (+192) drapes over the full face down to the chin
    ctx.translate(0, -14);

    // 1. FULL-FACE FROSTED WHITE MOSQUITO NET VISOR (Covers Forehead to Chin)
    const veilTopY = -24;
    const veilBottomY = 192;
    const veilTopHalfW = 138;
    const veilBotHalfW = 128;

    // Translucent Frosted White Screen Body with Side Highlights
    const veilGrad = ctx.createLinearGradient(-veilTopHalfW, 0, veilTopHalfW, 0);
    veilGrad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    veilGrad.addColorStop(0.14, 'rgba(255, 255, 255, 0.30)');
    veilGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
    veilGrad.addColorStop(0.86, 'rgba(255, 255, 255, 0.30)');
    veilGrad.addColorStop(1, 'rgba(255, 255, 255, 0.52)');

    ctx.fillStyle = veilGrad;
    ctx.beginPath();
    ctx.moveTo(-veilTopHalfW, veilTopY);
    ctx.lineTo(-veilBotHalfW, veilBottomY);
    ctx.quadraticCurveTo(0, veilBottomY + 22, veilBotHalfW, veilBottomY);
    ctx.lineTo(veilTopHalfW, veilTopY);
    ctx.quadraticCurveTo(0, veilTopY - 12, -veilTopHalfW, veilTopY);
    ctx.closePath();
    ctx.fill();

    // Subtle Fine Mosquito Mesh Texture inside Visor
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-veilTopHalfW, veilTopY);
    ctx.lineTo(-veilBotHalfW, veilBottomY);
    ctx.quadraticCurveTo(0, veilBottomY + 22, veilBotHalfW, veilBottomY);
    ctx.lineTo(veilTopHalfW, veilTopY);
    ctx.closePath();
    ctx.clip();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let x = -126; x <= 126; x += 22) {
      ctx.moveTo(x, veilTopY - 6);
      ctx.lineTo(x * 0.94, veilBottomY + 18);
    }
    for (let y = veilTopY + 14; y <= veilBottomY + 10; y += 22) {
      ctx.moveTo(-138, y);
      ctx.quadraticCurveTo(0, y + 8, 138, y);
    }
    ctx.stroke();
    ctx.restore();

    // Dark Purple Side Pillars of the Face Visor
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-veilTopHalfW + 2, veilTopY + 2);
    ctx.lineTo(-veilBotHalfW + 1, veilBottomY);
    ctx.moveTo(veilTopHalfW - 2, veilTopY + 2);
    ctx.lineTo(veilBotHalfW - 1, veilBottomY);
    ctx.stroke();

    // Thick Sculpted Purple Bottom Rim Bar Sealing the Bottom of the Face Visor
    const botRimGrad = ctx.createLinearGradient(-veilBotHalfW, veilBottomY - 6, veilBotHalfW, veilBottomY + 24);
    botRimGrad.addColorStop(0, p.isP2 ? '#fb7185' : '#8b6eff');
    botRimGrad.addColorStop(0.5, p.isP2 ? '#e11d48' : '#6538f5');
    botRimGrad.addColorStop(1, p.isP2 ? '#9f1239' : '#4318b8');
    ctx.fillStyle = botRimGrad;
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-veilBotHalfW - 6, veilBottomY - 6);
    ctx.quadraticCurveTo(0, veilBottomY + 16, veilBotHalfW + 6, veilBottomY - 6);
    ctx.quadraticCurveTo(veilBotHalfW + 9, veilBottomY + 9, veilBotHalfW - 1, veilBottomY + 13);
    ctx.quadraticCurveTo(0, veilBottomY + 34, -veilBotHalfW + 1, veilBottomY + 13);
    ctx.quadraticCurveTo(-veilBotHalfW - 9, veilBottomY + 9, -veilBotHalfW - 6, veilBottomY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Spiky Cartoon Side Plume / Tuft on Left of Helmet (matching reference photo)
    ctx.fillStyle = p.isP2 ? '#881337' : '#351c75';
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-72, -88);
    ctx.lineTo(-162, -78);
    ctx.lineTo(-138, -62);
    ctx.lineTo(-158, -46);
    ctx.lineTo(-124, -36);
    ctx.lineTo(-82, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Cartoon Safari / Beekeeper Helmet Crown Dome
    const domeGrad = ctx.createLinearGradient(-90, -130, 90, -44);
    domeGrad.addColorStop(0, p.isP2 ? '#fb7185' : '#7b52ff');
    domeGrad.addColorStop(0.55, p.isP2 ? '#e11d48' : '#5e35e8');
    domeGrad.addColorStop(1, p.isP2 ? '#9f1239' : '#3c1ca6');

    ctx.fillStyle = domeGrad;
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-104, -44);
    ctx.bezierCurveTo(-104, -138, 104, -138, 104, -44);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Bright Lavender Top Highlight Arc on Helmet Dome
    ctx.fillStyle = p.isP2 ? '#fda4af' : '#9b7bff';
    ctx.beginPath();
    ctx.ellipse(-10, -104, 46, 11, -0.06, 0, Math.PI * 2);
    ctx.fill();

    // 4. Brown & Gold Explorer Strap Band across Helmet Crown
    ctx.fillStyle = '#5c2d24';
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-100, -68);
    ctx.quadraticCurveTo(0, -82, 100, -68);
    ctx.lineTo(104, -46);
    ctx.quadraticCurveTo(0, -60, -104, -46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Gold Accent Segment on Right Side of Strap
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 4;
    roundRect(ctx, 20, -73, 44, 20, 4);
    ctx.fill();
    ctx.stroke();

    // 5. Wide Sculpted Upper Brim
    const brimGrad = ctx.createLinearGradient(-154, -52, 154, -16);
    brimGrad.addColorStop(0, p.isP2 ? '#fb7185' : '#8b6eff');
    brimGrad.addColorStop(0.5, p.isP2 ? '#e11d48' : '#6538f5');
    brimGrad.addColorStop(1, p.isP2 ? '#9f1239' : '#4318b8');
    ctx.fillStyle = brimGrad;
    ctx.strokeStyle = '#230b42';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(-156, -24);
    ctx.quadraticCurveTo(0, -68, 156, -24);
    ctx.quadraticCurveTo(162, -12, 140, -14);
    ctx.quadraticCurveTo(0, -44, -140, -14);
    ctx.quadraticCurveTo(-162, -12, -156, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6. Round Blue Badge with Dark Maroon Center on Front-Left of Helmet Band (matching reference photo)
    ctx.save();
    ctx.translate(-52, -68);
    ctx.fillStyle = '#7dd3fc';
    ctx.strokeStyle = '#4a151b';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 25, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#5c1916';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8.5, 11, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  // 3D Volumetric Puffy Chef's Hat (Toque Blanche) for Chop Mode — sits cleanly on top of the player's forehead & scales with hand/head size!
  const draw3DChefHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const coupledScale = p.hasDetectedHands
      ? (p.headScale || 1.0) * 0.48 + (p.handScale || 1.0) * 0.52
      : (p.headScale || 1.0);
    const baseScale = Math.max(0.62, Math.min(2.15, (cw / 1280) * 0.88 * coupledScale));
    const th = p.theme;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);
    ctx.translate(0, -8);

    ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;

    // 1. Puffy 3D Cloud-Like Chef Toque Top Lobes (Above forehead from y = -65 to y = -168)
    const puffCircles = [
      { x: -64, y: -102, r: 38 },
      { x: -34, y: -128, r: 44 },
      { x: 0,   y: -138, r: 48 },
      { x: 34,  y: -128, r: 44 },
      { x: 64,  y: -102, r: 38 },
    ];

    // Outer dark outline behind puffs for crisp 3D cartoon depth
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 7;
    puffCircles.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // Main Volumetric White & Cream 3D Puffs
    const puffGrad = ctx.createRadialGradient(-18, -145, 10, 0, -105, 115);
    puffGrad.addColorStop(0, '#ffffff');
    puffGrad.addColorStop(0.55, '#f8fafc');
    puffGrad.addColorStop(0.85, '#e2e8f0');
    puffGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = puffGrad;
    puffCircles.forEach(c => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r - 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Connecting Chef Crown Body between puffs and headband
    ctx.beginPath();
    ctx.moveTo(-78, -94);
    ctx.lineTo(-68, -48);
    ctx.quadraticCurveTo(0, -36, 68, -48);
    ctx.lineTo(78, -94);
    ctx.closePath();
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // 3D Vertical Pleat Folds on the Chef Toque
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    [-46, -24, 0, 24, 46].forEach(px => {
      ctx.beginPath();
      ctx.moveTo(px * 1.08, -116);
      ctx.quadraticCurveTo(px * 0.96, -82, px * 0.9, -54);
      ctx.stroke();
    });

    // Specular White Shine on Top Puff
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(-18, -152, 22, 10, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // 2. Snug 3D Chef Headband Rim with Team Color Accent Stripe
    const bandGrad = ctx.createLinearGradient(-74, -64, 74, -36);
    bandGrad.addColorStop(0, '#ffffff');
    bandGrad.addColorStop(0.5, '#f1f5f9');
    bandGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = bandGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;

    ctx.beginPath();
    ctx.moveTo(-72, -64);
    ctx.quadraticCurveTo(0, -78, 72, -64);
    ctx.lineTo(70, -38);
    ctx.quadraticCurveTo(0, -52, -70, -38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Team-Colored Chef Ribbon Stripe along Headband
    ctx.fillStyle = th.hatMain || '#8b5cf6';
    ctx.beginPath();
    ctx.moveTo(-71, -50);
    ctx.quadraticCurveTo(0, -64, 71, -50);
    ctx.lineTo(70, -41);
    ctx.quadraticCurveTo(0, -55, -70, -41);
    ctx.closePath();
    ctx.fill();

    // Gold 3D Chef Badge Emblem in Center of Headband
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -54, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.font = '900 11px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔪', 0, -54);

    ctx.restore();
  };

  // 3D Cartoon 5-Finger Open-Palm Slap Glove with Sculpted Wrist Band (Proportioned 1:1 to Fit Real Hand Size!)
  const drawSingleCartoonGlove = (
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    angle: number,
    scale: number,
    isRightHand: boolean,
    th: any,
    slapBoost: number,
    _openness: number = 1.0,
    isFrozen: boolean = false,
    landmarks?: { x: number; y: number; z?: number }[],
    cw: number = 960,
    ch: number = 540,
    offsetDx: number = 0,
    offsetDy: number = 0
  ) => {
    const isRedP2 = Boolean(th?.isP2);
    const mainColor = isFrozen ? '#38bdf8' : (isRedP2 ? '#ef4444' : '#2563eb');
    const midGradColor = isFrozen ? '#0ea5e9' : (isRedP2 ? '#dc2626' : '#1d4ed8');
    const highlightColor = isFrozen ? '#e0f2fe' : (isRedP2 ? '#fca5a5' : '#93c5fd');
    const shadowColor = isFrozen ? '#0369a1' : (isRedP2 ? '#991b1b' : '#1e3a8a');
    const padOuterColor = isFrozen ? '#bae6fd' : (isRedP2 ? '#fecaca' : '#bfdbfe');
    const padInnerColor = isFrozen ? '#ffffff' : (isRedP2 ? '#fef2f2' : '#eff6ff');
    const cuffStripeColor = isFrozen ? '#7dd3fc' : '#facc15';
    const outlineColor = isFrozen ? '#0c4a6e' : (isRedP2 ? '#450a0a' : '#172554');

    // Follow the player's real hand tilt angle smoothly
    const defaultTilt = isRightHand ? -0.10 : 0.10;
    let normalizedTilt = defaultTilt;
    if (Number.isFinite(angle)) {
      const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
      normalizedTilt = Math.max(-1.15, Math.min(1.15, wrapped * 0.82));
    }

    // Sleek, Proportional 3D Glove Sizing (local glove height is ~132 units from y = -76 to +56)
    // Uses precomputed hand scale directly for zero per-frame landmark loop overhead!
    const userSizeMult = gloveSizeRef.current || 1.0;
    const baseScreenScale = Math.max(0.75, Math.min(1.05, (cw / 1280) * 0.92));
    const computedScale = Math.max(0.62 * userSizeMult, Math.min(1.18 * userSizeMult, baseScreenScale * scale * userSizeMult));
    const anchorX = gx + offsetDx;
    const anchorY = gy + offsetDy;

    const finalScale = computedScale * (1 + slapBoost * 0.16);

    ctx.save();
    ctx.translate(anchorX, anchorY);
    ctx.rotate(normalizedTilt);
    ctx.scale(isRightHand ? -finalScale : finalScale, finalScale);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const activeStyle = gloveStyleRef.current || 'slap';

    // 3D Volumetric Gradient across the Glove / Gear
    const gloveGrad = ctx.createRadialGradient(-10, -24, 8, 0, 6, 82);
    gloveGrad.addColorStop(0, highlightColor);
    gloveGrad.addColorStop(0.32, mainColor);
    gloveGrad.addColorStop(0.78, midGradColor);
    gloveGrad.addColorStop(1, shadowColor);

    if (activeStyle === 'boxing') {
      // =====================================================================
      // OPTION 2: 3D PADDED BOXING MITT WITH THUMB LOCK & POWER TARGET PAD
      // =====================================================================
      ctx.beginPath();
      ctx.ellipse(-2, -1, 39, 43, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.fill();

      // Main sculpted padded boxing dome
      ctx.beginPath();
      ctx.moveTo(-34, 34);
      ctx.bezierCurveTo(-44, 10, -44, -36, -16, -50);
      ctx.bezierCurveTo(6, -58, 34, -46, 36, -16);
      ctx.bezierCurveTo(38, 8, 36, 26, 28, 36);
      ctx.closePath();
      ctx.fillStyle = gloveGrad;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.5;
      ctx.stroke();

      // Top knuckle ridge highlight
      ctx.fillStyle = highlightColor;
      ctx.beginPath();
      ctx.ellipse(-8, -36, 20, 7, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Side curved thumb lock bolster
      ctx.beginPath();
      ctx.ellipse(28, 2, 14, 22, 0.32, 0, Math.PI * 2);
      ctx.fillStyle = gloveGrad;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.2;
      ctx.stroke();

      // Center slap bullseye cushion on boxing mitt
      ctx.fillStyle = padOuterColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(-4, -4, 19, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = padInnerColor;
      ctx.beginPath();
      ctx.ellipse(-4, -4, 10, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wrist cuff with championship gold stripe
      ctx.beginPath();
      ctx.roundRect(-32, 32, 62, 24, 9);
      ctx.fillStyle = mainColor;
      ctx.fill();
      ctx.fillStyle = cuffStripeColor;
      ctx.fillRect(-30, 40, 58, 7);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.5;
      ctx.stroke();
    } else if (activeStyle === 'swatter') {
      // =====================================================================
      // OPTION 3: 3D ELECTRIC MOSQUITO SWATTER RACKET
      // =====================================================================
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.36)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 5;
      ctx.beginPath();
      ctx.ellipse(0, -14, 38, 44, 0, 0, Math.PI * 2);
      ctx.fillStyle = mainColor;
      ctx.fill();
      ctx.restore();

      // Contoured grip handle & neck
      ctx.beginPath();
      ctx.roundRect(-10, 24, 20, 38, 8);
      ctx.fillStyle = shadowColor;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.2;
      ctx.stroke();

      // Gold power grip ring
      ctx.fillStyle = cuffStripeColor;
      ctx.fillRect(-9, 36, 18, 6);

      // Outer aerodynamic racket frame
      ctx.beginPath();
      ctx.ellipse(0, -14, 38, 44, 0, 0, Math.PI * 2);
      ctx.fillStyle = gloveGrad;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.6;
      ctx.stroke();

      // Inner electrified mesh screen
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, -14, 29, 35, 0, 0, Math.PI * 2);
      ctx.fillStyle = padInnerColor;
      ctx.fill();
      ctx.clip();

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1.8;
      for (let gxLine = -28; gxLine <= 28; gxLine += 9) {
        ctx.beginPath();
        ctx.moveTo(gxLine, -52);
        ctx.lineTo(gxLine, 24);
        ctx.stroke();
      }
      for (let gyLine = -48; gyLine <= 20; gyLine += 9) {
        ctx.beginPath();
        ctx.moveTo(-32, gyLine);
        ctx.lineTo(32, gyLine);
        ctx.stroke();
      }
      ctx.restore();

      // Inner rim & central lightning emblem
      ctx.beginPath();
      ctx.ellipse(0, -14, 29, 35, 0, 0, Math.PI * 2);
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.4;
      ctx.stroke();

      ctx.fillStyle = cuffStripeColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(3, -28);
      ctx.lineTo(-8, -12);
      ctx.lineTo(1, -12);
      ctx.lineTo(-4, 4);
      ctx.lineTo(9, -14);
      ctx.lineTo(0, -14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (activeStyle === 'cyber') {
      // =====================================================================
      // OPTION 4: 3D NEON HOLOGRAM CYBER PALM SHIELD
      // =====================================================================
      ctx.save();
      ctx.shadowColor = highlightColor;
      ctx.shadowBlur = 16;

      // Outer glowing hexagonal energy shield
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3 - Math.PI / 2;
        const rx = Math.cos(ang) * 40;
        const ry = -4 + Math.sin(ang) * 44;
        if (i === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      }
      ctx.closePath();
      ctx.fillStyle = gloveGrad;
      ctx.globalAlpha = 0.88;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 4.2;
      ctx.stroke();

      // Inner hologram concentric target rings
      ctx.beginPath();
      ctx.arc(0, -4, 24, 0, Math.PI * 2);
      ctx.fillStyle = padOuterColor;
      ctx.fill();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, -4, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Tech wrist stabilizer cuff
      ctx.beginPath();
      ctx.roundRect(-26, 34, 52, 18, 7);
      ctx.fillStyle = shadowColor;
      ctx.fill();
      ctx.strokeStyle = highlightColor;
      ctx.lineWidth = 3.4;
      ctx.stroke();
      ctx.restore();
    } else {
      // =====================================================================
      // OPTION 1 (DEFAULT): 3D 5-FINGER CARTOON SLAP GLOVE WITH WRIST BAND
      // =====================================================================
      const drawCapsuleFinger = (
        baseX: number,
        baseY: number,
        tipX: number,
        tipY: number,
        radius: number,
        fillStyle: string | CanvasGradient,
        withOutline: boolean = true
      ) => {
        const dx = tipX - baseX;
        const dy = tipY - baseY;
        const len = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.arc(0, 0, radius, Math.PI * 0.5, Math.PI * 1.5);
        ctx.lineTo(len, -radius);
        ctx.arc(len, 0, radius, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        if (withOutline) {
          ctx.strokeStyle = outlineColor;
          ctx.lineWidth = 4.5;
          ctx.stroke();
        }
        ctx.restore();
      };

      // 5 Spread Fingers Definition (Pinky, Ring, Middle, Index + Outward Thumb)
      const fingers = [
        { bx: -25, by: -12, tx: -38, ty: -42, r: 9.5, padR: 5.2 },  // Pinky finger
        { bx: -10, by: -18, tx: -18, ty: -58, r: 10.5, padR: 5.8 }, // Ring finger
        { bx: 5,   by: -20, tx: 3,   ty: -65, r: 11.2, padR: 6.2 }, // Middle finger (tallest)
        { bx: 20,  by: -15, tx: 23,  ty: -55, r: 10.5, padR: 5.8 }, // Index finger
      ];
      const thumb = { bx: 22, by: 14, tx: 50, ty: -10, r: 11.5, padR: 6.4 };

      // 1. Crisp 3D offset drop shadow behind full 5-finger glove (zero shadowBlur stall)
      ctx.beginPath();
      ctx.ellipse(0, 14, 37, 34, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.26)';
      ctx.fill();

      // 2. Draw 4 spread fingers + thumb with 3D outlines
      fingers.forEach(f => {
        drawCapsuleFinger(f.bx, f.by, f.tx, f.ty, f.r, gloveGrad, true);
      });
      drawCapsuleFinger(thumb.bx, thumb.by, thumb.tx, thumb.ty, thumb.r, gloveGrad, true);

      // 3. Seamless contoured open palm body
      const tracePalmBody = () => {
        ctx.beginPath();
        ctx.moveTo(-31, 42);
        ctx.bezierCurveTo(-39, 24, -39, 2, -33, -15);
        ctx.quadraticCurveTo(-18, -26, 4, -26);
        ctx.quadraticCurveTo(24, -24, 30, -10);
        ctx.bezierCurveTo(36, 4, 38, 24, 29, 42);
        ctx.closePath();
      };

      tracePalmBody();
      ctx.fillStyle = gloveGrad;
      ctx.fill();

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(-33, -16);
      ctx.bezierCurveTo(-39, 2, -39, 24, -31, 42);
      ctx.moveTo(31, 22);
      ctx.bezierCurveTo(33, 30, 31, 37, 29, 42);
      ctx.stroke();

      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(22, -2);
      ctx.quadraticCurveTo(14, 12, 22, 26);
      ctx.stroke();

      // 4. Tactile 3D fingertip pads & palm slap target cushion
      fingers.forEach(f => {
        const padX = f.bx + (f.tx - f.bx) * 0.82;
        const padY = f.by + (f.ty - f.by) * 0.82;
        ctx.fillStyle = padOuterColor;
        ctx.beginPath();
        ctx.arc(padX, padY, f.padR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(padX - 1.5, padY - 1.8, f.padR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      });
      {
        const tPadX = thumb.bx + (thumb.tx - thumb.bx) * 0.78;
        const tPadY = thumb.by + (thumb.ty - thumb.by) * 0.78;
        ctx.fillStyle = padOuterColor;
        ctx.beginPath();
        ctx.arc(tPadX, tPadY, thumb.padR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.beginPath();
        ctx.arc(tPadX - 1.5, tPadY - 1.8, thumb.padR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.fillStyle = padOuterColor;
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(-1, 10, 21, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = padInnerColor;
      ctx.beginPath();
      ctx.ellipse(-1, 10, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? 6.5 : 2.8;
        const sx = -1 + Math.cos(ang) * r;
        const sy = 10 + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 5. Sculpted 3D athletic wrist band / cuff with gold stripe
      const traceWristCuff = () => {
        ctx.beginPath();
        ctx.moveTo(-34, 38);
        ctx.quadraticCurveTo(0, 34, 32, 38);
        ctx.bezierCurveTo(40, 39, 40, 58, 30, 60);
        ctx.quadraticCurveTo(0, 63, -32, 60);
        ctx.bezierCurveTo(-42, 58, -42, 39, -34, 38);
        ctx.closePath();
      };

      traceWristCuff();
      ctx.fillStyle = mainColor;
      ctx.fill();

      ctx.save();
      traceWristCuff();
      ctx.clip();

      ctx.fillStyle = shadowColor;
      ctx.beginPath();
      ctx.moveTo(-42, 50);
      ctx.quadraticCurveTo(0, 54, 40, 48);
      ctx.lineTo(42, 66);
      ctx.lineTo(-42, 66);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = cuffStripeColor;
      ctx.beginPath();
      ctx.moveTo(-40, 45);
      ctx.quadraticCurveTo(0, 42, 38, 45);
      ctx.lineTo(38, 51);
      ctx.quadraticCurveTo(0, 48, -40, 51);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = highlightColor;
      ctx.beginPath();
      ctx.ellipse(-16, 41, 12, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      traceWristCuff();
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 4.6;
      ctx.stroke();
    }

    ctx.restore();
  };

  // 3D Chef's Chopping Knife (Cleaver) for BOTH Left and Right Hands in Chop Mode
  const drawSingle3DChoppingKnife = (
    ctx: CanvasRenderingContext2D,
    kx: number,
    ky: number,
    angle: number,
    scale: number,
    isRightHand: boolean,
    th: any,
    trail: any[],
    cw: number,
    ch: number,
    now: number,
    chopBoost: number = 0,
    isFrozen: boolean = false
  ) => {
    // 1. Draw Glowing 3D Slash Ribbon Trail for this Knife
    if (trail && trail.length > 2) {
      ctx.save();
      for (let i = 1; i < trail.length; i++) {
        const pt0 = trail[i - 1];
        const pt1 = trail[i];
        const x0 = pt0.x * cw;
        const y0 = pt0.y * ch;
        const x1 = pt1.x * cw;
        const y1 = pt1.y * ch;

        ctx.strokeStyle = isFrozen ? '#38bdf8' : (th.swordColor || '#f59e0b');
        ctx.globalAlpha = pt1.life * 0.48;
        ctx.lineWidth = pt1.life * 22 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = pt1.life * 0.9;
        ctx.lineWidth = pt1.life * 6 * scale;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Draw 3D Stainless Steel Chef's Chopping Knife & Gloved Grip
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(angle);
    const s = Math.max(0.72, Math.min(1.28, scale * 0.92 * (1 + chopBoost * 0.16)));
    // Keep the razor cutting edge facing downward regardless of whether blade points left or right!
    const flipY = Math.cos(angle) < 0 ? -1 : 1;
    ctx.scale(s, s * flipY);

    ctx.shadowColor = 'rgba(15, 23, 42, 0.36)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    // Ergonomic 3D Wood/Polymer Handle with 3 Brass Rivets
    const handleGrad = ctx.createLinearGradient(-64, -14, -8, 14);
    handleGrad.addColorStop(0, '#78350f');
    handleGrad.addColorStop(0.5, '#451a03');
    handleGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = handleGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.5;
    roundRect(ctx, -64, -11, 56, 22, 8);
    ctx.fill();
    ctx.stroke();

    // 3 Brass Rivets on Handle
    ctx.fillStyle = '#facc15';
    [-50, -36, -22].forEach(rx => {
      ctx.beginPath();
      ctx.arc(rx, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Steel Bolster Collar
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    roundRect(ctx, -10, -16, 12, 32, 4);
    ctx.fill();
    ctx.stroke();

    // Broad 3D Chef's Chopping Cleaver Blade (Extending from x = 0 to x = 118)
    const bladeLen = 118;
    const bladeH = 48;
    const bladeGrad = ctx.createLinearGradient(0, -bladeH * 0.5, 0, bladeH * 0.5);
    if (isFrozen) {
      bladeGrad.addColorStop(0, '#e0f2fe');
      bladeGrad.addColorStop(0.5, '#7dd3fc');
      bladeGrad.addColorStop(0.82, '#38bdf8');
      bladeGrad.addColorStop(1, '#ffffff');
    } else {
      bladeGrad.addColorStop(0, '#94a3b8');
      bladeGrad.addColorStop(0.25, '#f8fafc');
      bladeGrad.addColorStop(0.75, '#e2e8f0');
      bladeGrad.addColorStop(1, '#ffffff');
    }

    ctx.fillStyle = bladeGrad;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(bladeLen - 8, -22);
    ctx.quadraticCurveTo(bladeLen + 4, -20, bladeLen, 16);
    ctx.quadraticCurveTo(bladeLen * 0.55, 28, 0, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Honed Razor-Sharp Bottom Cutting Edge Bevel
    const edgeGrad = ctx.createLinearGradient(0, 12, bladeLen, 22);
    edgeGrad.addColorStop(0, '#ffffff');
    edgeGrad.addColorStop(0.5, th.swordColor || '#38bdf8');
    edgeGrad.addColorStop(1, '#ffffff');
    ctx.strokeStyle = edgeGrad;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(2, 20);
    ctx.quadraticCurveTo(bladeLen * 0.55, 26, bladeLen - 1, 15);
    ctx.stroke();

    // Cleaver Hanging Hole near top corner of blade
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(bladeLen - 16, -10, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Diagonal Specular Steel Sheen across Cleaver Blade
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(24, -18);
    ctx.lineTo(44, -18);
    ctx.lineTo(28, 18);
    ctx.lineTo(10, 18);
    ctx.closePath();
    ctx.fill();

    // 3D Gloved Hand Fist Gripping the Knife Handle
    const fistGrad = ctx.createRadialGradient(-34, -4, 2, -34, 0, 22);
    fistGrad.addColorStop(0, isFrozen ? '#e0f2fe' : th.gloveLight);
    fistGrad.addColorStop(0.6, isFrozen ? '#38bdf8' : th.gloveMain);
    fistGrad.addColorStop(1, isFrozen ? '#0284c7' : th.gloveDark);
    ctx.fillStyle = fistGrad;
    ctx.strokeStyle = isFrozen ? '#0284c7' : th.outline;
    ctx.lineWidth = 3;
    roundRect(ctx, -50, -15, 34, 30, 11);
    ctx.fill();
    ctx.stroke();

    // Star Glint on Blade Corner
    const glintPulse = 0.75 + Math.sin(now * 0.015) * 0.25;
    ctx.save();
    ctx.translate(bladeLen - 2, 14);
    ctx.scale(glintPulse, glintPulse);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2, -3, 13, 0);
      ctx.quadraticCurveTo(2, 3, 0, 0);
    }
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  // 3D Translucent Ice Block Overlay drawn over Frozen Wrong Words/Options!
  const draw3DFrozenIceOverlay = (
    ctx: CanvasRenderingContext2D,
    cardW: number,
    cardY: number,
    cardH: number,
    topExtendY: number = -46
  ) => {
    ctx.save();
    const iceW = cardW + 18;
    const iceTop = topExtendY;
    const iceH = (cardY + cardH + 10) - iceTop;

    const iceGrad = ctx.createLinearGradient(-iceW / 2, iceTop, iceW / 2, iceTop + iceH);
    iceGrad.addColorStop(0, 'rgba(224, 242, 254, 0.72)');
    iceGrad.addColorStop(0.45, 'rgba(125, 211, 252, 0.58)');
    iceGrad.addColorStop(1, 'rgba(56, 189, 248, 0.76)');

    ctx.fillStyle = iceGrad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 3.5;
    roundRect(ctx, -iceW / 2, iceTop, iceW, iceH, 20);
    ctx.fill();
    ctx.stroke();

    // Diagonal 3D Ice Specular Glint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.moveTo(-iceW * 0.35, iceTop + 4);
    ctx.lineTo(-iceW * 0.12, iceTop + 4);
    ctx.lineTo(-iceW * 0.32, iceTop + iceH - 4);
    ctx.lineTo(-iceW * 0.45, iceTop + iceH - 4);
    ctx.closePath();
    ctx.fill();

    // Frosty Ice Cracks
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-24, iceTop + 14);
    ctx.lineTo(-6, iceTop + 28);
    ctx.lineTo(-16, iceTop + 42);
    ctx.moveTo(22, iceTop + 18);
    ctx.lineTo(8, iceTop + 34);
    ctx.lineTo(26, iceTop + 46);
    ctx.stroke();

    // "❄️ FROZEN (-5)" Pill Badge at Top of Ice Block
    const fBadgeW = 128;
    const fBadgeH = 24;
    ctx.fillStyle = '#0284c7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, -fBadgeW / 2, iceTop - 12, fBadgeW, fBadgeH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 12px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(answerModeRef.current === 'multiple' ? '❄️ FROZEN (-1)' : '❄️ FROZEN (-5)', 0, iceTop);

    ctx.restore();
  };

  // True 3D Volumetric Mosquito + Bright Light 3D Extruded Answer Capsule (Scaled by textSize + Freeze Support)
  const drawMosquitoTarget = (ctx: CanvasRenderingContext2D, t: any, time: number) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    const facingLeft = t.vx < 0;
    const bobY = t.frozen ? 0 : Math.sin(time * 0.012 + t.wobblePhase) * 6;
    ctx.translate(0, bobY);

    // ---------------------------------------------
    // 1. Bright Light-Colored 3D Extruded Option Capsule Below Mosquito
    // ---------------------------------------------
    const parsedOpt = parseOptionContent(t.text || "");
    const cleanWord = parsedOpt.text || (parsedOpt.imageUrl ? "" : t.text || "");
    const optImgEl = parsedOpt.imageUrl ? getCachedSlapChopImage(parsedOpt.imageUrl) : null;
    const hasLoadedImg = Boolean(optImgEl && optImgEl.complete && optImgEl.naturalWidth > 0);

    const is2P = engineRef.current.numPlayers === 2;
    const cw = containerRef.current?.clientWidth || 960;
    const tScale = (textSizeRef.current || 1.15) * 1.08;
    const baseFontPx = Math.round(16 * tScale);
    const badgeSize = Math.round(36 * Math.max(0.95, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(36 * Math.max(0.95, tScale * 0.94)) : 0;
    const cardH = Math.round(48 * Math.max(0.95, tScale * 0.94));
    const maxCardW = is2P
      ? Math.min(Math.round(cw * 0.44), Math.round(248 * Math.min(1.18, tScale)))
      : Math.min(Math.round(cw * 0.78), Math.round(340 * tScale));
    const minCardW = is2P ? Math.round(150 * Math.min(1.12, tScale)) : Math.round(190 * tScale);

    const maxChars = is2P ? 22 : 32;
    const displayStr = cleanWord.length > maxChars ? cleanWord.slice(0, maxChars - 1) + '…' : cleanWord;

    // Measure actual pixel width of option text so words like "accompany" or "discourage" NEVER clip the right edge!
    let fitFontPx = baseFontPx;
    ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
    let measuredTextW = displayStr ? ctx.measureText(displayStr).width : 0;
    const sideExtras = badgeSize + thumbSize + (hasLoadedImg ? 40 : 32);

    if (displayStr && measuredTextW + sideExtras > maxCardW) {
      const availTextW = Math.max(64, maxCardW - sideExtras);
      const shrinkRatio = availTextW / Math.max(1, measuredTextW);
      fitFontPx = Math.max(12, Math.floor(baseFontPx * shrinkRatio));
      ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
      measuredTextW = ctx.measureText(displayStr).width;
    }

    const cardW = Math.max(
      minCardW,
      Math.min(maxCardW, Math.ceil(measuredTextW + sideExtras))
    );
    t.cardW = cardW;
    t.cardH = cardH;
    const cardY = 34;

    ctx.save();
    const isLocked = Boolean(t.isTargeted && !t.frozen);
    // Soft ambient drop shadow under option capsule
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;

    // 3D Bottom Extrusion Lip in Vibrant Option Color
    ctx.fillStyle = t.frozen ? '#0284c7' : (isLocked ? '#d97706' : (t.color.dark || '#0284c7'));
    roundRect(ctx, -cardW / 2, cardY + 5, cardW, cardH, 15);
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Main Capsule Body: Crisp Bright White 3D Card (elevated warm gold highlight when locked!)
    const pillGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    pillGrad.addColorStop(0, t.frozen ? '#e0f2fe' : (isLocked ? '#fefce8' : '#ffffff'));
    pillGrad.addColorStop(1, t.frozen ? '#bae6fd' : (isLocked ? '#fef08a' : '#f8fafc'));
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = t.frozen ? '#0284c7' : (isLocked ? '#f59e0b' : t.color.main);
    ctx.lineWidth = isLocked ? 4.2 : 3.2;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 15);
    ctx.fill();
    ctx.stroke();

    // Glossy Top Bevel Highlight along Option Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    roundRect(ctx, -cardW / 2 + 8, cardY + 2.5, cardW - 16, 8, 4);
    ctx.fill();
    ctx.restore();

    // 3D Extruded Option Letter Badge (A, B, C, D)
    const badgeY = cardY + (cardH - badgeSize) / 2;
    const badgeGrad = ctx.createLinearGradient(0, badgeY, 0, badgeY + badgeSize);
    badgeGrad.addColorStop(0, t.frozen ? '#7dd3fc' : t.color.light);
    badgeGrad.addColorStop(0.35, t.frozen ? '#0284c7' : t.color.main);
    badgeGrad.addColorStop(1, t.frozen ? '#0369a1' : t.color.dark);
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, -cardW / 2 + 6, badgeY, badgeSize, badgeSize, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(19 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 6 + badgeSize / 2, cardY + cardH / 2 + 0.5);

    let textStartX = -cardW / 2 + badgeSize + 14;
    if (hasLoadedImg && optImgEl) {
      try {
        ctx.drawImage(optImgEl, textStartX, cardY + (cardH - thumbSize) / 2, thumbSize, thumbSize);
        textStartX += thumbSize + 8;
      } catch {
        // ignore draw error
      }
    }

    // High-Contrast Dark Slate Option Answer Text Perfectly Contained Inside Capsule
    if (displayStr) {
      ctx.fillStyle = t.frozen ? '#0369a1' : (t.specialType === 'bomb' ? '#991b1b' : '#0f172a');
      ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2 + 0.5);
    }

    // 1b. Draw 3D Power-Up / Bomb Corner Pill Badge on Regular Option Capsules in Multiple Answer Mode!
    if (t.powerBadge && !t.isSpecialItem && !t.frozen) {
      const pb = t.powerBadge as 'x2' | 'x3' | 'gold' | 'bomb';
      const pbMeta = pb === 'bomb'
        ? { label: '💣 -3', bg: '#dc2626', border: '#fecaca' }
        : pb === 'x3'
        ? { label: '🔥 x3', bg: '#9333ea', border: '#f3e8ff' }
        : pb === 'gold'
        ? { label: '👑 +5', bg: '#d97706', border: '#fef08a' }
        : { label: '⚡ x2', bg: '#0284c7', border: '#bae6fd' };

      ctx.save();
      const pw = 56;
      const ph = 22;
      const px = cardW / 2 - pw + 8;
      const py = cardY - 12;
      ctx.fillStyle = pbMeta.bg;
      ctx.strokeStyle = pbMeta.border;
      ctx.lineWidth = 2;
      roundRect(ctx, px, py, pw, ph, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pbMeta.label, px + pw / 2, py + ph / 2 + 0.5);
      ctx.restore();
    }

    // 1c. Special 3D Aura & Burning Bomb Fuse for Independent Power-Up / Hazard Mosquitoes!
    if (t.isSpecialItem && !t.frozen) {
      ctx.save();
      const pulseR = 38 + Math.sin(time * 0.018) * 5;
      if (t.specialType === 'bomb') {
        // Pulsing Red Danger Ring + Sizzling Bomb Fuse Spark above the mosquito!
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, -4, pulseR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Sizzling Fuse & Flickering Spark
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.quadraticCurveTo(8, -34, 18, -38);
        ctx.stroke();

        const sparkR = 5 + Math.sin(time * 0.05) * 2.5;
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(18, -38, sparkR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Radiant Power-Up Halo Ring (Gold / Cyan / Purple)
        ctx.strokeStyle = t.color?.light || '#fde047';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -4, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ---------------------------------------------
    // 2. Volumetric 3D Cartoon Mosquito with Biting Player Animation
    // ---------------------------------------------
    const biteIntensity = t.frozen ? 0 : (t.biteIntensity || 0);
    const jabCycle = biteIntensity > 0 ? Math.abs(Math.sin(time * 0.042 + t.wobblePhase)) : 0;
    const jabX = -jabCycle * 12 * biteIntensity;
    const jabY = jabCycle * 6 * biteIntensity;

    // If targeted at the clap/swat aim point, show a crisp target lock ring + action cue
    if (isLocked) {
      ctx.save();
      const ringR = 44 + Math.sin(time * 0.02) * 3.5;
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 5]);
      ctx.beginPath();
      ctx.arc(0, -4, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const cueLabel = slapModeRef.current === 'swat' ? 'SWAT!' : 'CLAP!';
      ctx.fillStyle = '#f59e0b';
      roundRect(ctx, -32, -ringR - 22, 64, 20, 10);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cueLabel, 0, -ringR - 12);
      ctx.restore();
    }

    ctx.save();
    if (!facingLeft) ctx.scale(-1, 1);

    // Tilt mosquito forward and jab as it bites the player!
    ctx.translate(jabX * 0.45, jabY * 0.45);
    ctx.rotate(-biteIntensity * 0.24);

    const wingFlap = t.frozen ? 0.15 : Math.sin(time * (biteIntensity > 0 ? 0.24 : 0.15) + t.wingPhase) * 0.78;

    // Back Iridescent 3D Wing
    ctx.save();
    ctx.translate(6, -16);
    ctx.rotate(wingFlap - 0.28);
    const backWingGrad = ctx.createRadialGradient(10, -14, 2, 14, -18, 34);
    backWingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    backWingGrad.addColorStop(0.5, 'rgba(186, 230, 253, 0.78)');
    backWingGrad.addColorStop(1, 'rgba(56, 189, 248, 0.35)');
    ctx.fillStyle = backWingGrad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(15, -18, 34, 13, 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 6 Articulated 3D Insect Legs (Gripping onto the player's visor/skin while biting)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let legIdx = 0; legIdx < 3; legIdx++) {
      const legOffset = legIdx * 10 - 6;
      const legWiggle = t.frozen ? 0 : Math.sin(time * 0.022 + legIdx * 1.6) * (biteIntensity > 0 ? 2.0 : 4.5);
      ctx.beginPath();
      ctx.moveTo(legOffset, 5);
      ctx.lineTo(legOffset + 7, 17 + legWiggle);
      ctx.lineTo(legOffset + 15, 28 + legWiggle * 0.5);
      ctx.stroke();
    }

    // 3D Segmented Abdomen (Swelling & Pulsing Crimson Red as it Bites the Player!)
    ctx.save();
    const abdSwell = 1 + biteIntensity * jabCycle * 0.18;
    ctx.translate(26, 2);
    ctx.rotate(0.22 + biteIntensity * 0.12);
    ctx.scale(abdSwell, abdSwell);
    const abdGrad = ctx.createRadialGradient(-6, -6, 3, 0, 0, 28);
    if (biteIntensity > 0.25) {
      abdGrad.addColorStop(0, '#fca5a5');
      abdGrad.addColorStop(0.5, '#ef4444');
      abdGrad.addColorStop(1, '#7f1d1d');
    } else {
      abdGrad.addColorStop(0, '#94a3b8');
      abdGrad.addColorStop(0.55, '#475569');
      abdGrad.addColorStop(1, '#334155');
    }
    ctx.fillStyle = abdGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Clip to abdomen for curved 3D colored stripes
    ctx.clip();
    const stripeGrad = ctx.createLinearGradient(0, -15, 0, 15);
    stripeGrad.addColorStop(0, biteIntensity > 0.4 ? '#fecaca' : t.color.light);
    stripeGrad.addColorStop(0.5, biteIntensity > 0.4 ? '#dc2626' : t.color.main);
    stripeGrad.addColorStop(1, t.color.dark);
    ctx.fillStyle = stripeGrad;
    for (let s = -16; s <= 16; s += 9) {
      ctx.beginPath();
      ctx.ellipse(s, 0, 3.5, 16, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    // Abdomen Specular Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-2, -7, 16, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3D Spherical Thorax (Middle Body)
    const thxGrad = ctx.createRadialGradient(-5, -8, 2, 0, -2, 18);
    thxGrad.addColorStop(0, '#94a3b8');
    thxGrad.addColorStop(0.5, '#475569');
    thxGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = thxGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -2, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Specular Highlight on Thorax
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.ellipse(-4, -8, 6.5, 3.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // 3D Head Sphere
    const headGrad = ctx.createRadialGradient(-21, -8, 2, -18, -4, 14);
    headGrad.addColorStop(0, '#64748b');
    headGrad.addColorStop(0.6, '#334155');
    headGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(-18, -4, 12.5, 0, Math.PI * 2);
    ctx.fill();

    // Feathery 3D Antennae
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-25, -12);
    ctx.quadraticCurveTo(-36, -24, -44, -20);
    ctx.moveTo(-22, -14);
    ctx.quadraticCurveTo(-30, -26, -38, -24);
    ctx.stroke();

    // 3D Metallic Needle Proboscis Jabbing & Biting the Player!
    const needleTipX = -62 + jabX * 0.7;
    const needleTipY = 2 + jabY * 0.8;
    const needleGrad = ctx.createLinearGradient(-26, -4, needleTipX, needleTipY);
    needleGrad.addColorStop(0, '#64748b');
    needleGrad.addColorStop(0.5, '#f8fafc');
    needleGrad.addColorStop(1, '#ef4444');
    ctx.strokeStyle = needleGrad;
    ctx.lineWidth = 3.2 + biteIntensity * 1.2;
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(needleTipX, needleTipY);
    ctx.stroke();

    // Biting Puncture Rings, Blood Suction Pulse & Bite Sparks at Needle Tip!
    if (biteIntensity > 0.15) {
      const rippleR = 6 + ((time * 0.04) % 14);
      ctx.save();
      ctx.strokeStyle = `rgba(239, 68, 68, ${Math.max(0.2, 0.85 * biteIntensity)})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(needleTipX, needleTipY, rippleR, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing red bite point & suction droplet moving up the proboscis
      const dropProgress = (time * 0.006) % 1;
      const dropX = needleTipX + (-26 - needleTipX) * dropProgress;
      const dropY = needleTipY + (-4 - needleTipY) * dropProgress;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(needleTipX, needleTipY, 4.2 * biteIntensity, 0, Math.PI * 2);
      ctx.arc(dropX, dropY, 3.2 * biteIntensity, 0, Math.PI * 2);
      ctx.fill();

      // Comic Bite Sparks around the puncture site
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      for (let sp = 0; sp < 4; sp++) {
        const a = sp * (Math.PI / 2) + time * 0.01;
        ctx.beginPath();
        ctx.moveTo(needleTipX + Math.cos(a) * 5, needleTipY + Math.sin(a) * 5);
        ctx.lineTo(needleTipX + Math.cos(a) * 11, needleTipY + Math.sin(a) * 11);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Glowing 3D Compound Ruby Eyes
    const eyeGrad = ctx.createRadialGradient(-23, -9, 1, -21, -7, 7);
    eyeGrad.addColorStop(0, '#fca5a5');
    eyeGrad.addColorStop(0.45, '#ef4444');
    eyeGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(-21, -7.5, 6.2, 0, Math.PI * 2);
    ctx.fill();

    // Fierce Biting Eyebrow Ridge when Biting
    if (biteIntensity > 0.2) {
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-28, -12);
      ctx.lineTo(-16, -9);
      ctx.stroke();
    }

    // Dual Eye Specular Glints
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-23, -9.5, 2.1, 0, Math.PI * 2);
    ctx.arc(-19.5, -6, 1.0, 0, Math.PI * 2);
    ctx.fill();

    // Front Iridescent 3D Wing (Layered over body with vein detail)
    ctx.save();
    ctx.translate(4, -14);
    ctx.rotate(-wingFlap + 0.16);
    const frontWingGrad = ctx.createRadialGradient(12, -14, 2, 16, -16, 36);
    frontWingGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    frontWingGrad.addColorStop(0.55, 'rgba(224, 242, 254, 0.82)');
    frontWingGrad.addColorStop(1, 'rgba(14, 165, 233, 0.35)');
    ctx.fillStyle = frontWingGrad;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(16, -16, 36, 14, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Wing Veins
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(36, -21);
    ctx.moveTo(14, -10);
    ctx.lineTo(28, -10);
    ctx.moveTo(18, -12);
    ctx.lineTo(24, -22);
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Floating Comic "💢 BITE!" Indicator when Mosquito is Actively Biting
    if (biteIntensity > 0.55 && !t.frozen) {
      ctx.save();
      ctx.font = '900 11px Fredoka, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      const biteLabelX = facingLeft ? -48 : 48;
      ctx.strokeText('💢 BITE!', biteLabelX, -22);
      ctx.fillText('💢 BITE!', biteLabelX, -22);
      ctx.restore();
    }

    // 3. If Wrong Option was Slapped, Encase Mosquito & Word in a 3D Ice Block!
    if (t.frozen) {
      draw3DFrozenIceOverlay(ctx, cardW, cardY, cardH, -44);
    }

    ctx.restore();
  };

  // True 3D Volumetric Fruit + Bright Light 3D Option Capsule (Scaled by textSize + Freeze & Dual-Knife Support)
  const drawFruitTarget = (ctx: CanvasRenderingContext2D, t: any, time: number = 0) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    // 1. 3D Spherical Fruit Body
    ctx.save();
    ctx.rotate(t.rotation || 0);
    const r = (t.radius || 52) * 0.86;

    ctx.shadowColor = 'rgba(15, 23, 42, 0.3)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;

    // 3D Stem & Leaf at Top
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -r + 2);
    ctx.quadraticCurveTo(4, -r - 12, 10, -r - 14);
    ctx.stroke();

    const leafGrad = ctx.createLinearGradient(0, -r - 14, 22, -r - 4);
    leafGrad.addColorStop(0, '#4ade80');
    leafGrad.addColorStop(1, '#15803d');
    ctx.fillStyle = leafGrad;
    ctx.beginPath();
    ctx.moveTo(2, -r - 6);
    ctx.quadraticCurveTo(16, -r - 18, 24, -r - 4);
    ctx.quadraticCurveTo(12, -r + 2, 2, -r - 6);
    ctx.fill();

    // Outer 3D Rind
    ctx.fillStyle = t.frozen ? '#0284c7' : t.color.dark;
    ctx.strokeStyle = t.frozen ? '#bae6fd' : t.color.rim;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner Juicy 3D Spherical Flesh
    const fleshGrad = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.08, 0, 0, r * 0.92);
    fleshGrad.addColorStop(0, '#ffffff');
    fleshGrad.addColorStop(0.22, t.frozen ? '#bae6fd' : t.color.light);
    fleshGrad.addColorStop(0.62, t.frozen ? '#38bdf8' : t.color.main);
    fleshGrad.addColorStop(1, t.frozen ? '#0369a1' : t.color.dark);
    ctx.fillStyle = fleshGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Inner White Pith Ring & Juicy Fruit Seeds/Segments Detail
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    if (!t.frozen) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      for (let sIdx = 0; sIdx < 5; sIdx++) {
        const sAng = (sIdx / 5) * Math.PI * 2 + 0.3;
        const sx = Math.cos(sAng) * (r * 0.42);
        const sy = Math.sin(sAng) * (r * 0.42);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 2.2, 4.0, sAng + Math.PI / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Glossy 3D Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Bright Light-Colored 3D Extruded Option Pill
    const parsedOpt = parseOptionContent(t.text || "");
    const cleanWord = parsedOpt.text || (parsedOpt.imageUrl ? "" : t.text || "");
    const optImgEl = parsedOpt.imageUrl ? getCachedSlapChopImage(parsedOpt.imageUrl) : null;
    const hasLoadedImg = Boolean(optImgEl && optImgEl.complete && optImgEl.naturalWidth > 0);

    const is2P = engineRef.current.numPlayers === 2;
    const cw = containerRef.current?.clientWidth || 960;
    const tScale = (textSizeRef.current || 1.15) * 1.08;
    const baseFontPx = Math.round(16 * tScale);
    const badgeSize = Math.round(36 * Math.max(0.95, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(36 * Math.max(0.95, tScale * 0.94)) : 0;
    const cardH = Math.round(48 * Math.max(0.95, tScale * 0.94));
    const maxCardW = is2P
      ? Math.min(Math.round(cw * 0.44), Math.round(248 * Math.min(1.18, tScale)))
      : Math.min(Math.round(cw * 0.78), Math.round(340 * tScale));
    const minCardW = is2P ? Math.round(150 * Math.min(1.12, tScale)) : Math.round(190 * tScale);

    const maxChars = is2P ? 22 : 32;
    const displayStr = cleanWord.length > maxChars ? cleanWord.slice(0, maxChars - 1) + '…' : cleanWord;

    let fitFontPx = baseFontPx;
    ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
    let measuredTextW = displayStr ? ctx.measureText(displayStr).width : 0;
    const sideExtras = badgeSize + thumbSize + (hasLoadedImg ? 40 : 32);

    if (displayStr && measuredTextW + sideExtras > maxCardW) {
      const availTextW = Math.max(64, maxCardW - sideExtras);
      const shrinkRatio = availTextW / Math.max(1, measuredTextW);
      fitFontPx = Math.max(12, Math.floor(baseFontPx * shrinkRatio));
      ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
      measuredTextW = ctx.measureText(displayStr).width;
    }

    const cardW = Math.max(
      minCardW,
      Math.min(maxCardW, Math.ceil(measuredTextW + sideExtras))
    );
    t.cardW = cardW;
    t.cardH = cardH;
    const cardY = r * 0.45;

    ctx.fillStyle = t.frozen ? '#0284c7' : t.color.dark;
    roundRect(ctx, -cardW / 2, cardY + 4, cardW, cardH, 14);
    ctx.fill();

    ctx.fillStyle = t.frozen ? '#e0f2fe' : '#ffffff';
    ctx.strokeStyle = t.frozen ? '#0284c7' : t.color.main;
    ctx.lineWidth = 3.2;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    const badgeY = cardY + (cardH - badgeSize) / 2;
    ctx.fillStyle = t.frozen ? '#0284c7' : t.color.main;
    roundRect(ctx, -cardW / 2 + 6, badgeY, badgeSize, badgeSize, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(19 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 6 + badgeSize / 2, cardY + cardH / 2 + 0.5);

    let textStartX = -cardW / 2 + badgeSize + 14;
    if (hasLoadedImg && optImgEl) {
      try {
        ctx.drawImage(optImgEl, textStartX, cardY + (cardH - thumbSize) / 2, thumbSize, thumbSize);
        textStartX += thumbSize + 8;
      } catch {
        // ignore draw error
      }
    }

    if (displayStr) {
      ctx.fillStyle = t.frozen ? '#0369a1' : '#0f172a';
      ctx.font = `800 ${fitFontPx}px "Plus Jakarta Sans", Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2 + 0.5);
    }

    // 3. If Wrong Option was Chopped, Encase Fruit & Word in a 3D Ice Block!
    if (t.frozen) {
      draw3DFrozenIceOverlay(ctx, cardW, cardY, cardH, -r - 12);
    }

    ctx.restore();
  };

  const drawSlicedHalf = (ctx: CanvasRenderingContext2D, h: any) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, h.alpha);
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotation);

    const r = (h.radius || 48) * 0.82;
    ctx.fillStyle = h.color.dark;
    ctx.strokeStyle = h.color.rim || '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI, h.side > 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const pulpGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 0.85);
    pulpGrad.addColorStop(0, h.color.light);
    pulpGrad.addColorStop(0.7, h.color.main);
    pulpGrad.addColorStop(1, h.color.dark);
    ctx.fillStyle = pulpGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.84, 0, Math.PI, h.side > 0);
    ctx.closePath();
    ctx.fill();

    // Fruit seeds inside sliced half
    ctx.fillStyle = '#0f172a';
    for (let s = -1; s <= 1; s++) {
      ctx.beginPath();
      ctx.ellipse(s * 10, (h.side > 0 ? -1 : 1) * 12, 2.2, 3.8, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  const currentQ = activeQuiz.questions[currentQIndex] || activeQuiz.questions[0];

  return (
    <div id="slap-and-chop-container" ref={containerRef} className="relative w-full h-full min-h-screen bg-sky-100 overflow-hidden font-sans select-none text-slate-900">
      {/* Live full-screen mirrored webcam video layer (kept rendered so browser never pauses video decoding) */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover -scale-x-100 pointer-events-none z-0 transition-opacity duration-200 ${
          screen === 'game' && cameraActive ? 'opacity-100' : 'opacity-0'
        }`}
        autoPlay
        playsInline
        muted
      />

      {/* Screen 1: Quiz Editor */}
      {screen === 'editor' && (
        <QuizEditor
          quiz={activeQuiz}
          folders={folders}
          onSave={saveQuiz}
          onCancel={() => onViewChange('games')}
          onPlayDirect={() => setScreen('setup')}
        />
      )}

      {/* Screen 2: Minimalist Immersive 3D Arcade Game Setup (Bold & Important Words Only) */}
      {screen === 'setup' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
          {/* Ambient 3D Glow */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div className="absolute -top-24 left-1/4 w-96 h-96 bg-white/80 rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-200/50 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[42rem] h-72 bg-emerald-200/45 rounded-full blur-3xl" />
          </div>

          {/* Top Navigation Bar */}
          <div className="w-full max-w-4xl flex items-center justify-between mb-3 z-20 flex-wrap gap-2">
            <button
              onClick={() => onViewChange('games')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={18} className="text-sky-600" />
              <span>BACK</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 border-t border-amber-200 border-b-4 border-b-amber-600 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>⚙️ SETTINGS</span>
              </button>
              <button
                onClick={() => setShowModeModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 border-t border-sky-200 border-b-4 border-b-sky-700 text-white font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>🎮 GAMES</span>
              </button>
              <button
                onClick={() => setScreen('editor')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Edit3 size={18} className="text-sky-600" />
                <span>QUIZ ({activeQuiz.questions.length})</span>
              </button>
              <FullscreenButton targetId="slap-and-chop-container" className="bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900" />
            </div>
          </div>

          {/* Centered Minimalist Immersive Setup Stage */}
          <div className="relative z-10 flex flex-col items-center w-full max-w-4xl my-auto">
            {/* Hero Title — Bold Only */}
            <h2 className="text-4xl sm:text-6xl font-black text-sky-950 drop-shadow-[0_4px_0_rgba(255,255,255,1)] tracking-tight text-center mb-5">
              MOSQUITO SLAP 3D
            </h2>

            {/* Main Immersive Minimalist Setup Card */}
            <div className="w-full bg-white/95 backdrop-blur-xl rounded-[2.4rem] border-2 border-sky-200 border-b-[10px] border-b-sky-300 p-5 sm:p-7 shadow-[0_20px_50px_rgba(14,165,233,0.2)] space-y-5">
              
              {/* 1. PLAYERS: 1 PLAYER vs 2 PLAYERS + BOLD NAME INPUTS */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => setNumPlayers(1)}
                    className={`group relative overflow-hidden rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-3.5 ${
                      numPlayers === 1
                        ? 'bg-gradient-to-b from-sky-400 via-blue-500 to-blue-600 border-t-2 border-sky-200 border-x border-sky-400 border-b-[7px] border-b-blue-800 shadow-[0_10px_24px_rgba(37,99,235,0.32)] -translate-y-0.5 text-white'
                        : 'bg-slate-50 border-2 border-sky-200 border-b-[7px] border-b-sky-300 hover:bg-white text-slate-900'
                    }`}
                  >
                    <span className="text-3xl sm:text-4xl">🧤</span>
                    <span className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                      1 PLAYER
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNumPlayers(2)}
                    className={`group relative overflow-hidden rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-3.5 ${
                      numPlayers === 2
                        ? 'bg-gradient-to-b from-red-500 via-rose-500 to-red-600 border-t-2 border-red-200 border-x border-red-400 border-b-[7px] border-b-red-900 shadow-[0_10px_24px_rgba(239,68,68,0.32)] -translate-y-0.5 text-white'
                        : 'bg-slate-50 border-2 border-sky-200 border-b-[7px] border-b-sky-300 hover:bg-white text-slate-900'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl">🔵⚡🔴</span>
                    <span className="text-xl sm:text-2xl font-black tracking-tight uppercase">
                      2 PLAYERS
                    </span>
                  </button>
                </div>

                {/* Minimalist Bold Player Name Inputs */}
                <div className={`grid gap-3 ${numPlayers === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="flex items-center gap-3 bg-blue-50/90 p-2.5 rounded-2xl border-2 border-blue-200 border-b-4 border-b-blue-400">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-blue-500 to-blue-700 border-b-2 border-blue-950 text-white flex items-center justify-center font-black text-base shadow shrink-0">
                      P1
                    </div>
                    <input
                      type="text"
                      value={p1Name}
                      onChange={e => setP1Name(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-slate-900 font-black placeholder-slate-400 outline-none text-lg px-1"
                      placeholder="PLAYER 1"
                    />
                  </div>

                  {numPlayers === 2 && (
                    <div className="flex items-center gap-3 bg-red-50/90 p-2.5 rounded-2xl border-2 border-red-200 border-b-4 border-b-red-400 animate-in fade-in duration-200">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-red-500 to-red-700 border-b-2 border-red-950 text-white flex items-center justify-center font-black text-base shadow shrink-0">
                        P2
                      </div>
                      <input
                        type="text"
                        value={p2Name}
                        onChange={e => setP2Name(e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-slate-900 font-black placeholder-slate-400 outline-none text-lg px-1"
                        placeholder="PLAYER 2"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 2. ANSWER MODE PATCH: SINGLE ANSWER (+5 / -5) vs MULTIPLE ANSWER (+1 / -1) + 1–10 SLIDER */}
              <div className="p-4 rounded-3xl bg-purple-50/90 border-2 border-purple-200 border-b-4 border-b-purple-300 space-y-3.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm sm:text-base font-black uppercase tracking-wider text-purple-950">
                    🎯 ANSWER MODE
                  </span>
                  <span className={`px-3 py-1 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wide ${
                    answerMode === 'multiple'
                      ? 'bg-purple-600 text-white'
                      : 'bg-sky-600 text-white'
                  }`}>
                    {answerMode === 'multiple' ? `+1 / -1 • ${multiAnswerCount} HITS` : '+5 / -5 • 1 HIT'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAnswerMode('single')}
                    className={`py-3.5 px-4 rounded-2xl font-black text-base sm:text-lg border-2 border-b-[5px] transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      answerMode === 'single'
                        ? 'bg-gradient-to-b from-sky-500 to-blue-600 border-sky-300 border-b-blue-900 text-white shadow-md -translate-y-0.5'
                        : 'bg-white hover:bg-purple-50 border-purple-200 border-b-purple-300 text-slate-900'
                    }`}
                  >
                    <span>SINGLE ANSWER</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      answerMode === 'single' ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-800'
                    }`}>
                      +5 / -5
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnswerMode('multiple')}
                    className={`py-3.5 px-4 rounded-2xl font-black text-base sm:text-lg border-2 border-b-[5px] transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      answerMode === 'multiple'
                        ? 'bg-gradient-to-b from-purple-500 to-indigo-600 border-purple-300 border-b-indigo-950 text-white shadow-md -translate-y-0.5'
                        : 'bg-white hover:bg-purple-50 border-purple-200 border-b-purple-300 text-slate-900'
                    }`}
                  >
                    <span>MULTIPLE ANSWER</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-black ${
                      answerMode === 'multiple' ? 'bg-white/25 text-white' : 'bg-purple-100 text-purple-800'
                    }`}>
                      +1 / -1
                    </span>
                  </button>
                </div>

                {/* 1–10 ANSWERS SLIDER + POWER-UPS & BOMBS (Shown in Multiple Answer Mode) */}
                {answerMode === 'multiple' && (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    {/* 1–10 Answers Slider */}
                    <div className="bg-white/95 rounded-2xl p-3.5 border-2 border-purple-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black uppercase tracking-wide text-purple-950">
                          ANSWERS PER QUESTION
                        </span>
                        <span className="px-3.5 py-1 rounded-xl bg-purple-600 text-white font-black text-base font-mono tabular-nums shadow-xs">
                          {multiAnswerCount}
                        </span>
                      </div>

                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={multiAnswerCount}
                        onChange={e => setMultiAnswerCount(Number(e.target.value))}
                        className="w-full h-3 bg-purple-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                      />

                      <div className="grid grid-cols-10 gap-1 pt-0.5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setMultiAnswerCount(num)}
                            className={`py-1.5 rounded-lg font-black text-xs sm:text-sm transition cursor-pointer ${
                              multiAnswerCount === num
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-purple-50 hover:bg-purple-100 text-purple-900'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* POWER-UPS & HAZARDS GRID — BOLD ONLY */}
                    <div className="bg-white/95 rounded-2xl p-3.5 border-2 border-purple-200 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-black uppercase tracking-wide text-purple-950">
                          ⚡ POWER-UPS &amp; BOMBS
                        </span>

                        {/* SPAWN RATE SELECTOR */}
                        <div className="flex items-center gap-1 bg-purple-50 p-1 rounded-xl border border-purple-200">
                          {([
                            { id: 'normal' as const, label: 'NORMAL' },
                            { id: 'frenzy' as const, label: 'FRENZY' },
                            { id: 'chaos' as const, label: 'CHAOS 🔥' }
                          ]).map(sr => (
                            <button
                              key={sr.id}
                              type="button"
                              onClick={() => setMultiSpawnRate(sr.id)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                                multiSpawnRate === sr.id
                                  ? 'bg-purple-600 text-white shadow-2xs'
                                  : 'text-purple-900 hover:bg-purple-100'
                              }`}
                            >
                              {sr.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {([
                          {
                            key: 'bomb' as const,
                            icon: '💣',
                            title: 'BOMBS',
                            tag: '-3 PTS',
                            activeCls: 'bg-gradient-to-b from-rose-500 to-red-600 border-rose-300 border-b-red-900 text-white shadow-sm -translate-y-0.5',
                            tagCls: 'bg-black/25 text-white'
                          },
                          {
                            key: 'x2' as const,
                            icon: '⚡',
                            title: 'x2 DOUBLE',
                            tag: '2X PTS',
                            activeCls: 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-200 border-b-amber-700 text-slate-950 shadow-sm -translate-y-0.5',
                            tagCls: 'bg-slate-950/15 text-slate-950'
                          },
                          {
                            key: 'x3' as const,
                            icon: '🔥',
                            title: 'x3 TRIPLE',
                            tag: '3X PTS',
                            activeCls: 'bg-gradient-to-b from-fuchsia-500 to-purple-600 border-fuchsia-300 border-b-purple-950 text-white shadow-sm -translate-y-0.5',
                            tagCls: 'bg-black/25 text-white'
                          },
                          {
                            key: 'gold' as const,
                            icon: '👑',
                            title: 'GOLD BUG',
                            tag: '+5 PTS',
                            activeCls: 'bg-gradient-to-b from-yellow-400 to-amber-500 border-yellow-200 border-b-amber-700 text-slate-950 shadow-sm -translate-y-0.5',
                            tagCls: 'bg-slate-950/15 text-slate-950'
                          },
                          {
                            key: 'ice' as const,
                            icon: '❄️',
                            title: 'ICE TIME',
                            tag: '+5S SLOW',
                            activeCls: 'bg-gradient-to-b from-sky-400 to-cyan-600 border-sky-200 border-b-cyan-900 text-white shadow-sm -translate-y-0.5',
                            tagCls: 'bg-black/25 text-white'
                          },
                          {
                            key: 'zap' as const,
                            icon: '⚡',
                            title: 'AUTO-ZAP',
                            tag: '1-HIT ZAP',
                            activeCls: 'bg-gradient-to-b from-indigo-500 to-violet-600 border-indigo-300 border-b-violet-950 text-white shadow-sm -translate-y-0.5',
                            tagCls: 'bg-black/25 text-white'
                          }
                        ]).map(item => {
                          const isOn = multiItems[item.key];
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => toggleMultiItem(item.key)}
                              className={`p-3 rounded-2xl border-2 border-b-[5px] transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                isOn
                                  ? item.activeCls
                                  : 'bg-slate-50 hover:bg-purple-50/60 border-slate-200 border-b-slate-300 text-slate-400'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-xl shrink-0">{item.icon}</span>
                                <span className="font-black text-xs sm:text-sm tracking-tight truncate">
                                  {item.title}
                                </span>
                              </div>
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                                isOn ? item.tagCls : 'bg-slate-200 text-slate-500'
                              }`}>
                                {isOn ? item.tag : 'OFF'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. 3D GLOVES & SIZE — BOLD ONLY */}
              <div className="p-4 rounded-3xl bg-sky-50/90 border-2 border-sky-200 border-b-4 border-b-sky-300 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm sm:text-base font-black uppercase tracking-wider text-sky-950">
                    🧤 3D GLOVES
                  </span>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-sky-200">
                    {[
                      { label: 'COMPACT', val: 0.78 },
                      { label: 'NORMAL', val: 1.0 },
                      { label: 'LARGE', val: 1.22 }
                    ].map(sz => (
                      <button
                        key={sz.label}
                        type="button"
                        onClick={() => setGloveSize(sz.val)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                          gloveSize === sz.val
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-700 hover:bg-sky-50'
                        }`}
                      >
                        {sz.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'slap' as const, icon: '🧤', title: '5-FINGER' },
                    { id: 'boxing' as const, icon: '🥊', title: 'BOXING' },
                    { id: 'swatter' as const, icon: '🏸', title: 'SWATTER' },
                    { id: 'cyber' as const, icon: '🖐️', title: 'CYBER' }
                  ].map(opt => {
                    const active = gloveStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGloveStyle(opt.id)}
                        className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2.5 border-2 border-b-[5px] ${
                          active
                            ? 'bg-gradient-to-b from-blue-500 to-blue-700 border-blue-300 border-b-blue-950 text-white -translate-y-0.5 shadow-md'
                            : 'bg-white hover:bg-sky-50 border-sky-200 border-b-sky-300 text-slate-900'
                        }`}
                      >
                        <span className="text-2xl">{opt.icon}</span>
                        <span className="text-sm sm:text-base font-black tracking-tight">{opt.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. TRIGGER & TIMER ROW — BOLD ONLY */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* TRIGGER MODE */}
                <div className="p-4 rounded-3xl bg-amber-50/90 border-2 border-amber-200 border-b-4 border-b-amber-300 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-black uppercase tracking-wider text-amber-950">
                      👏 TRIGGER
                    </span>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200">
                      {([
                        { id: 'easy' as const, label: 'EASY' },
                        { id: 'balanced' as const, label: 'NORMAL' },
                        { id: 'precise' as const, label: 'PRO' }
                      ]).map(sn => (
                        <button
                          key={sn.id}
                          type="button"
                          onClick={() => setSlapSensitivity(sn.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                            slapSensitivity === sn.id
                              ? 'bg-amber-500 text-white'
                              : 'text-slate-700 hover:bg-amber-50'
                          }`}
                        >
                          {sn.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSlapMode('clap')}
                      className={`py-3 px-3 rounded-2xl font-black text-sm sm:text-base border-2 border-b-[5px] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        slapMode === 'clap'
                          ? 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-200 border-b-amber-700 text-slate-950 shadow-sm -translate-y-0.5'
                          : 'bg-white hover:bg-amber-50 border-amber-200 border-b-amber-300 text-slate-900'
                      }`}
                    >
                      <span className="text-xl">👏</span>
                      <span>2-HAND CLAP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSlapMode('swat')}
                      className={`py-3 px-3 rounded-2xl font-black text-sm sm:text-base border-2 border-b-[5px] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        slapMode === 'swat'
                          ? 'bg-gradient-to-b from-amber-400 to-amber-500 border-amber-200 border-b-amber-700 text-slate-950 shadow-sm -translate-y-0.5'
                          : 'bg-white hover:bg-amber-50 border-amber-200 border-b-amber-300 text-slate-900'
                      }`}
                    >
                      <span className="text-xl">🖐️</span>
                      <span>1-HAND SWAT</span>
                    </button>
                  </div>
                </div>

                {/* MATCH TIMER */}
                <div className="p-4 rounded-3xl bg-emerald-50/90 border-2 border-emerald-200 border-b-4 border-b-emerald-300 space-y-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-950">
                      ⏱️ TIMER
                    </span>
                    <span className="px-3 py-0.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-black font-mono tabular-nums">
                      {formatPlayTime(playingTime)}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { label: '1M', sec: 60 },
                      { label: '2M', sec: 120 },
                      { label: '3M', sec: 180 },
                      { label: '4M', sec: 240 },
                      { label: '5M', sec: 300 }
                    ].map(tm => {
                      const isSel = playingTime === tm.sec;
                      return (
                        <button
                          key={tm.sec}
                          type="button"
                          onClick={() => {
                            setPlayingTime(tm.sec);
                            playingTimeRef.current = tm.sec;
                            setHudTimeLeft(tm.sec);
                            lastHudSecRef.current = tm.sec;
                          }}
                          className={`py-3 rounded-2xl font-black text-sm sm:text-base border-2 border-b-[5px] transition cursor-pointer ${
                            isSel
                              ? 'bg-emerald-500 border-emerald-300 border-b-emerald-800 text-white shadow-sm -translate-y-0.5'
                              : 'bg-white hover:bg-emerald-100/70 border-emerald-200 border-b-emerald-300 text-emerald-950'
                          }`}
                        >
                          {tm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 5. BOTTOM ACTION BAR: START GAME + STUDY MODE */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => startGame(numPlayers)}
                  className="sm:col-span-8 py-4.5 bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-black text-2xl sm:text-3xl rounded-2xl border-t-2 border-emerald-200 border-b-[8px] border-b-emerald-800 shadow-[0_14px_30px_rgba(16,185,129,0.35)] active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-3 tracking-wide uppercase"
                >
                  <Play size={28} fill="currentColor" className="drop-shadow" />
                  <span>START {numPlayers === 2 ? '2P BATTLE' : 'ARENA'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="sm:col-span-4 py-4.5 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-black text-xl sm:text-2xl rounded-2xl border-t-2 border-white border-b-[8px] border-b-orange-600 shadow-lg active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase"
                >
                  <span>📖</span>
                  <span>STUDY</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Bright Light Loading Screen */}
      {screen === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-sky-200 via-sky-100 to-white p-6 text-center">
          <div className="w-24 h-24 rounded-3xl bg-white border-4 border-sky-300 border-b-8 border-b-sky-500 animate-bounce flex items-center justify-center text-5xl mb-6 shadow-xl">
            🦟
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Preparing Mosquito Slap 3D Arena...</h2>
          <p className="text-slate-600 font-bold text-sm max-w-sm">Calibrating 21-Point 3D Hand Tracking &amp; Live Camera Sensors!</p>
        </div>
      )}

      {/* Screen 4: Live 3D AR Motion Game Arena (Full-Screen Live Camera + Bigger Immersive Player Point Cards) */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-10 w-full h-full overflow-hidden select-none">
          
          {/* MINIMALIST TOP HEADER:
              - LEFT: Back Arrow to Game Setup
              - MIDDLE: Only Player Name, Score & Center Timer
              - RIGHT: Settings & Game Controls */}
          <div className="absolute top-0 left-0 right-0 z-40 w-full px-3 sm:px-5 pt-2.5 pointer-events-none">
            <div className="max-w-[1640px] mx-auto grid grid-cols-[auto_1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-2 w-full pointer-events-auto">
              
              {/* LEFT: Back Arrow to Game Setup */}
              <div className="flex items-center justify-start">
                <button
                  type="button"
                  onClick={() => {
                    clearNextQuestionTimer();
                    stopMosquitoBuzz();
                    stopBgMusic();
                    engineRef.current.isActive = false;
                    setScreen('setup');
                  }}
                  title="Back to Game Setup"
                  className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-slate-200/90 text-xs sm:text-sm font-bold text-slate-800 transition shadow-sm cursor-pointer flex items-center gap-1.5 active:translate-y-0.5 shrink-0 whitespace-nowrap"
                >
                  <ArrowLeft size={16} className="shrink-0 text-slate-800" />
                  <span className="hidden sm:inline">Setup</span>
                </button>
              </div>

              {/* CENTER MINIMALIST SCOREBOARD & TIMER (BIGGER Player Name + BIGGER Score + Middle Timer) */}
              <div className="flex items-center justify-center">
                <div className="flex items-center bg-slate-950/90 backdrop-blur-xl p-1.5 sm:p-2 rounded-[1.35rem] border-2 border-white/20 shadow-[0_12px_36px_rgba(15,23,42,0.4)] gap-2">
                  
                  {/* PLAYER 1: Bigger Name, Multiplier Badge & Giant Score */}
                  <div className={`relative flex items-center justify-between gap-3.5 px-4 sm:px-6 h-12 sm:h-15 rounded-2xl transition-all duration-200 min-w-[155px] sm:min-w-[235px] ${
                    hudFrozen[0]
                      ? 'bg-sky-100 text-sky-900 ring-2 ring-sky-400'
                      : hudScorePops[0]
                      ? 'bg-blue-600 text-white scale-105 shadow-[0_0_24px_rgba(37,99,235,0.75)]'
                      : 'bg-white text-slate-900'
                  }`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3 h-3 rounded-full shrink-0 ${hudScorePops[0] ? 'bg-white' : 'bg-blue-600'}`} />
                      <span className={`text-sm sm:text-lg font-black uppercase tracking-wide truncate max-w-[90px] sm:max-w-[135px] ${
                        hudScorePops[0] ? 'text-white' : 'text-blue-700'
                      }`}>
                        {p1Name || "Player 1"}
                      </span>
                      {hudActiveMults[0] > 1 && (
                        <span className={`px-2 py-0.5 rounded-lg text-xs sm:text-sm font-black leading-none animate-pulse shrink-0 ${
                          hudActiveMults[0] >= 3
                            ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(192,38,211,0.85)]'
                            : 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.85)]'
                        }`}>
                          {hudActiveMults[0] >= 3 ? '🔥x3' : '⚡x2'}
                        </span>
                      )}
                    </div>
                    <span className={`font-black text-2xl sm:text-4xl font-mono leading-none tabular-nums tracking-tight ${
                      hudScorePops[0]
                        ? 'text-amber-300 scale-110'
                        : hudScores[0] < 0
                        ? 'text-rose-600'
                        : 'text-slate-900'
                    }`}>
                      {hudScores[0]}
                    </span>

                    {hudScorePops[0] && (
                      <div className={`absolute -bottom-8 right-1 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black text-white shadow-lg animate-bounce z-50 whitespace-nowrap border border-white/40 ${
                        hudScorePops[0].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}>
                        {hudScorePops[0]}
                      </div>
                    )}
                  </div>

                  {/* MIDDLE TIMER — BIGGER */}
                  <div className={`flex items-center justify-center gap-1.5 px-4 sm:px-6 h-12 sm:h-15 rounded-2xl font-mono font-black text-xl sm:text-3xl tabular-nums transition-all ${
                    hudSlowMo
                      ? 'bg-sky-400 text-slate-950 ring-2 ring-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.85)]'
                      : hudTimeLeft <= 15
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-amber-400 text-slate-950'
                  }`}>
                    {hudSlowMo && <span className="text-base sm:text-xl">❄️</span>}
                    <span>{formatPlayTime(hudTimeLeft)}</span>
                  </div>

                  {/* PLAYER 2: Giant Score, Multiplier Badge & Bigger Name (in 2P Mode) */}
                  {numPlayers === 2 && (
                    <div className={`relative flex items-center justify-between gap-3.5 px-4 sm:px-6 h-12 sm:h-15 rounded-2xl transition-all duration-200 min-w-[155px] sm:min-w-[235px] ${
                      hudFrozen[1]
                        ? 'bg-sky-100 text-sky-900 ring-2 ring-sky-400'
                        : hudScorePops[1]
                        ? 'bg-red-600 text-white scale-105 shadow-[0_0_24px_rgba(220,38,38,0.75)]'
                        : 'bg-white text-slate-900'
                    }`}>
                      <span className={`font-black text-2xl sm:text-4xl font-mono leading-none tabular-nums tracking-tight ${
                        hudScorePops[1]
                          ? 'text-amber-300 scale-110'
                          : hudScores[1] < 0
                          ? 'text-rose-600'
                          : 'text-slate-900'
                      }`}>
                        {hudScores[1]}
                      </span>
                      <div className="flex items-center justify-end gap-2 min-w-0">
                        {hudActiveMults[1] > 1 && (
                          <span className={`px-2 py-0.5 rounded-lg text-xs sm:text-sm font-black leading-none animate-pulse shrink-0 ${
                            hudActiveMults[1] >= 3
                              ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(192,38,211,0.85)]'
                              : 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.85)]'
                          }`}>
                            {hudActiveMults[1] >= 3 ? '🔥x3' : '⚡x2'}
                          </span>
                        )}
                        <span className={`text-sm sm:text-lg font-black uppercase tracking-wide truncate max-w-[90px] sm:max-w-[135px] text-right ${
                          hudScorePops[1] ? 'text-white' : 'text-red-600'
                        }`}>
                          {p2Name || "Player 2"}
                        </span>
                        <span className={`w-3 h-3 rounded-full shrink-0 ${hudScorePops[1] ? 'bg-white' : 'bg-red-600'}`} />
                      </div>

                      {hudScorePops[1] && (
                        <div className={`absolute -bottom-8 left-1 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black text-white shadow-lg animate-bounce z-50 whitespace-nowrap border border-white/40 ${
                          hudScorePops[1].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}>
                          {hudScorePops[1]}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* RIGHT: Settings & Game Controls */}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setSlapMode(slapMode === 'clap' ? 'swat' : 'clap')}
                  title="Switch between Two-Hand Clap and One-Hand Swat"
                  className="hidden xl:flex h-9 sm:h-10 px-3 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-slate-200/90 text-xs font-bold text-slate-800 shadow-sm cursor-pointer items-center gap-1.5 active:translate-y-0.5 whitespace-nowrap shrink-0"
                >
                  <span>{slapMode === 'clap' ? '👏 2-Hand Clap' : '🖐️ 1-Hand Swat'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoundFx(!soundFx)}
                  title="Toggle Sound FX"
                  className="hidden sm:flex h-9 sm:h-10 w-9 sm:w-10 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-slate-200/90 text-xs font-bold text-slate-800 shadow-sm cursor-pointer items-center justify-center active:translate-y-0.5 shrink-0"
                >
                  {soundFx ? <Volume2 size={16} className="text-slate-700" /> : <VolumeX size={16} className="text-slate-400" />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowSettingsModal(true)}
                  className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl bg-white/92 hover:bg-white backdrop-blur-md border border-slate-200/90 text-xs font-bold text-slate-800 transition shadow-sm cursor-pointer flex items-center gap-1.5 active:translate-y-0.5 shrink-0 whitespace-nowrap"
                >
                  <span>⚙️</span>
                  <span>Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => finishGame()}
                  title="End Game & View Results"
                  className="h-9 sm:h-10 px-3 sm:px-3.5 rounded-xl bg-rose-500/95 hover:bg-rose-500 text-xs font-bold text-white transition shadow-sm cursor-pointer flex items-center gap-1.5 active:translate-y-0.5 shrink-0 whitespace-nowrap"
                >
                  <Flag size={14} fill="currentColor" className="shrink-0" />
                  <span>End</span>
                </button>

                <FullscreenButton targetId="slap-and-chop-container" className="bg-white/92 hover:bg-white backdrop-blur-md border border-slate-200/90 text-slate-700 !h-9 sm:!h-10 !py-0 !px-2.5 !rounded-xl shadow-sm shrink-0 flex items-center justify-center" />
              </div>

            </div>
          </div>

          {/* 3-SECOND CIRCULAR COUNTDOWN TIMER OVERLAY BEFORE ANOTHER QUESTION APPEARS */}
          {nextQCountdown !== null && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center px-4">
              <div className="px-7 py-5 sm:px-9 sm:py-6 rounded-3xl bg-white/92 backdrop-blur-xl border border-slate-200/90 shadow-[0_20px_50px_rgba(15,23,42,0.22)] flex flex-col items-center gap-2 text-center max-w-xs w-full animate-in zoom-in-95 duration-150">
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Next Question In
                </div>
                <div className="text-5xl sm:text-6xl font-black text-sky-600 font-mono leading-none tabular-nums">
                  {nextQCountdown}
                </div>
                <div className="text-xs font-semibold text-slate-600">
                  Question {upcomingQNumber} of {activeQuiz.questions.length}
                </div>
              </div>
            </div>
          )}

          {/* High-Resolution Full-Screen 3D AR & Live Camera Canvas */}
          <div className="absolute inset-0 w-full h-full overflow-hidden z-10">
            <canvas
              ref={canvasRef}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              className="w-full h-full block touch-none cursor-crosshair"
            />
          </div>

          {/* BIGGER MINIMALIST BOTTOM QUESTION BAR */}
          <div className="absolute bottom-3.5 left-0 right-0 z-40 px-3 sm:px-6 pointer-events-none">
            <div className="max-w-5xl mx-auto w-full pointer-events-auto">
              <div className="relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl px-5 py-3.5 sm:px-8 sm:py-5 shadow-[0_14px_40px_rgba(15,23,42,0.28)] border-2 border-slate-200/95 flex items-center justify-between gap-4 sm:gap-5">
                {/* Progress Line along bottom edge */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-100">
                  <div
                    className="h-full bg-sky-500 transition-all duration-150"
                    style={{ width: `${nextQCountdown !== null ? nextQProgressPct : timerPct}%` }}
                  />
                </div>

                {/* Question Counter & Multi-Answer Hit Counter */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-xl bg-slate-100 text-sm sm:text-base font-black text-slate-700 tabular-nums whitespace-nowrap">
                    Q{currentQIndex + 1}<span className="text-slate-400 mx-0.5">/</span>{activeQuiz.questions.length}
                  </span>
                  {answerMode === 'multiple' && (
                    <span className="px-3 py-1 rounded-xl bg-purple-600 text-white text-xs sm:text-sm font-black tabular-nums whitespace-nowrap shadow-xs">
                      🎯 {hudMultiProgress}/{multiAnswerCount}
                    </span>
                  )}
                </div>

                {/* Bigger Question Text */}
                {(() => {
                  const qParsed = parseOptionContent(currentQ?.text || '');
                  const qImg = currentQ?.image || qParsed.imageUrl;
                  const qTextDisplay = nextQCountdown !== null
                    ? `Next question in ${nextQCountdown}s...`
                    : (qParsed.text || currentQ?.text || "Loading question...");
                  return (
                    <div className="flex-1 flex items-center justify-center gap-4 min-w-0 text-center">
                      {qImg && nextQCountdown === null && (
                        <img
                          src={qImg}
                          alt="Question"
                          referrerPolicy="no-referrer"
                          className="h-14 sm:h-16 w-auto max-w-[120px] rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 shrink-0"
                        />
                      )}
                      <p
                        className="font-extrabold text-slate-950 tracking-tight leading-snug break-words"
                        style={{ fontSize: `${Math.round(28 * textSize)}px`, textWrap: 'balance' } as React.CSSProperties}
                      >
                        {qTextDisplay}
                      </p>
                    </div>
                  );
                })()}

                {/* Audio Read-Aloud Button */}
                <button
                  type="button"
                  onClick={() => currentQ?.text && speakText(currentQ.text)}
                  title="Read Question Aloud"
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 cursor-pointer transition"
                >
                  <Volume2 size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3D LIGHT SETTINGS MODAL (Contains Camera, Trigger Calibration, Glove Options, Music, Voice, Text Size, Speed & Movements) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-sky-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-[2.2rem] p-6 sm:p-8 border-2 border-sky-200 border-b-[10px] border-b-sky-400 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 text-slate-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-sky-100 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-2xl">
                  ⚙️
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Game Settings</h3>
                  <p className="text-xs font-bold text-slate-500">Camera, Clap Trigger Calibration, 3D Gloves, Timer &amp; Speed</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 0. Camera Tracking Toggle Inside Settings */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-200 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">📷 AR Camera Feed &amp; Hand Tracking</div>
                  <div className="text-[11px] font-bold text-slate-500">
                    {cameraActive ? 'Live 21-Point Hand Tracking Active (🔵 P1 Blue / 🔴 P2 Red)' : 'Virtual Meadow Arena (Mouse / Touch)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) stopCamera();
                    else setupCamera(numPlayers);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black border-b-4 transition cursor-pointer whitespace-nowrap ${
                    cameraActive
                      ? 'bg-emerald-500 border-emerald-800 text-white'
                      : 'bg-sky-500 border-sky-800 text-white'
                  }`}
                >
                  {cameraActive ? '📷 Camera: ON' : '🌤️ Turn Camera ON'}
                </button>
              </div>
              {cameraError && (
                <div className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                  ⚠️ {cameraError} — Click/touch fallback is active!
                </div>
              )}
            </div>

            {/* 0.15 Answer Mode & 1-10 Multi-Answer Slider Inside Settings */}
            <div className="p-4 rounded-2xl bg-purple-50/90 border-2 border-purple-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-slate-900">🎯 Answer Mode &amp; Scoring</div>
                <span className="px-2.5 py-0.5 rounded-lg bg-purple-600 text-white text-xs font-black">
                  {answerMode === 'multiple' ? `+1 / -1 (${multiAnswerCount} Hits)` : '+5 / -5 (1 Hit)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAnswerMode('single')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs border-b-4 transition cursor-pointer flex items-center justify-between ${
                    answerMode === 'single'
                      ? 'bg-sky-600 border-sky-900 text-white shadow'
                      : 'bg-white border-purple-200 text-slate-800 hover:bg-purple-100/50'
                  }`}
                >
                  <span>Single Answer</span>
                  <span>+5 / -5</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAnswerMode('multiple')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs border-b-4 transition cursor-pointer flex items-center justify-between ${
                    answerMode === 'multiple'
                      ? 'bg-purple-600 border-purple-950 text-white shadow'
                      : 'bg-white border-purple-200 text-slate-800 hover:bg-purple-100/50'
                  }`}
                >
                  <span>Multiple Answer</span>
                  <span>+1 / -1</span>
                </button>
              </div>

              {answerMode === 'multiple' && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-black text-purple-950">
                      <span>Answers Per Question (1–10)</span>
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-600 text-white font-mono">{multiAnswerCount}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={1}
                      value={multiAnswerCount}
                      onChange={e => {
                        const val = Number(e.target.value);
                        setMultiAnswerCount(val);
                        multiAnswerCountRef.current = val;
                        if (engineRef.current.isActive) {
                          engineRef.current.roundHitsRequired = val;
                        }
                      }}
                      className="w-full h-2.5 bg-purple-200 rounded-full appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  {/* Power-Ups & Bombs Toggles inside Settings */}
                  <div className="space-y-2 pt-1 border-t border-purple-200/80">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase text-purple-950">⚡ Power-Ups &amp; Bombs</span>
                      <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-purple-200">
                        {([
                          { id: 'normal' as const, label: 'Normal' },
                          { id: 'frenzy' as const, label: 'Frenzy' },
                          { id: 'chaos' as const, label: 'Chaos 🔥' }
                        ]).map(sr => (
                          <button
                            key={sr.id}
                            type="button"
                            onClick={() => setMultiSpawnRate(sr.id)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black transition cursor-pointer ${
                              multiSpawnRate === sr.id
                                ? 'bg-purple-600 text-white'
                                : 'text-purple-800 hover:bg-purple-50'
                            }`}
                          >
                            {sr.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { key: 'bomb' as const, label: '💣 Bombs (-3)' },
                        { key: 'x2' as const, label: '⚡ x2 Double' },
                        { key: 'x3' as const, label: '🔥 x3 Triple' },
                        { key: 'gold' as const, label: '👑 Gold (+5)' },
                        { key: 'ice' as const, label: '❄️ Ice (+5s)' },
                        { key: 'zap' as const, label: '⚡ Auto-Zap' }
                      ]).map(it => {
                        const active = multiItems[it.key];
                        return (
                          <button
                            key={it.key}
                            type="button"
                            onClick={() => toggleMultiItem(it.key)}
                            className={`py-2 px-2 rounded-xl font-black text-[11px] border-b-4 transition cursor-pointer flex items-center justify-between gap-1 ${
                              active
                                ? 'bg-purple-600 border-purple-950 text-white shadow-2xs'
                                : 'bg-white border-purple-200 text-slate-400 hover:bg-purple-50'
                            }`}
                          >
                            <span className="truncate">{it.label}</span>
                            <span className="text-[9px] uppercase">{active ? 'ON' : 'OFF'}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 0.25 Hand Slap Trigger Mode & Sensitivity Calibration */}
            <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-900">👏 Slap Trigger Mode &amp; Sensitivity</div>
                  <div className="text-[11px] font-bold text-slate-500">Choose how hand gestures trigger a mosquito slap</div>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-emerald-200">
                  {([
                    { id: 'easy' as const, label: 'Easy' },
                    { id: 'balanced' as const, label: 'Balanced' },
                    { id: 'precise' as const, label: 'Precise' }
                  ]).map(sn => (
                    <button
                      key={sn.id}
                      type="button"
                      onClick={() => setSlapSensitivity(sn.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        slapSensitivity === sn.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-emerald-50'
                      }`}
                    >
                      {sn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSlapMode('clap')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs border-b-4 transition cursor-pointer flex items-center justify-center gap-2 ${
                    slapMode === 'clap'
                      ? 'bg-emerald-600 border-emerald-900 text-white shadow'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-100/50'
                  }`}
                >
                  <span>👏</span>
                  <span>Two-Hand Clap</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSlapMode('swat')}
                  className={`py-2.5 px-3 rounded-xl font-black text-xs border-b-4 transition cursor-pointer flex items-center justify-center gap-2 ${
                    slapMode === 'swat'
                      ? 'bg-emerald-600 border-emerald-900 text-white shadow'
                      : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-100/50'
                  }`}
                >
                  <span>🖐️</span>
                  <span>One-Hand Swat</span>
                </button>
              </div>
            </div>

            {/* 0.5 3D Glove Style & Size Selector Inside Settings */}
            <div className="p-4 rounded-2xl bg-blue-50/90 border-2 border-blue-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-slate-900">🧤 3D Glove Style &amp; Size</div>
                  <div className="text-[11px] font-bold text-slate-500">Customize glove design and scale on screen</div>
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-blue-200">
                  {[
                    { label: 'Compact', val: 0.78 },
                    { label: 'Normal', val: 1.0 },
                    { label: 'Large', val: 1.22 }
                  ].map(sz => (
                    <button
                      key={sz.label}
                      type="button"
                      onClick={() => setGloveSize(sz.val)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        gloveSize === sz.val ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-blue-50'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'slap' as const, icon: '🧤', title: '5-Finger' },
                  { id: 'boxing' as const, icon: '🥊', title: 'Boxing Mitt' },
                  { id: 'swatter' as const, icon: '🏸', title: 'Bug Swatter' },
                  { id: 'cyber' as const, icon: '🖐️', title: 'Cyber Palm' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGloveStyle(opt.id)}
                    className={`py-2 px-2.5 rounded-xl font-black text-xs border-b-4 transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      gloveStyle === opt.id
                        ? 'bg-blue-600 border-blue-900 text-white'
                        : 'bg-white border-blue-200 text-slate-700 hover:bg-blue-100/50'
                    }`}
                  >
                    <span>{opt.icon}</span>
                    <span>{opt.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 1. Music, Sound FX & Voice Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              {/* Background Music */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <div>
                  <div className="text-sm font-black text-slate-900">🎵 Background Music</div>
                  <div className="text-[11px] font-bold text-slate-500">Cheerful Arcade Melody</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                    musicEnabled
                      ? 'bg-emerald-500 border-emerald-800 text-white'
                      : 'bg-slate-200 border-slate-400 text-slate-600'
                  }`}
                >
                  {musicEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Voice Narration */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <div>
                  <div className="text-sm font-black text-slate-900">🗣️ Realistic Voice</div>
                  <div className="text-[11px] font-bold text-slate-500">Reads Questions Aloud</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setVoiceEnabled(!voiceEnabled)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                      voiceEnabled
                        ? 'bg-sky-500 border-sky-800 text-white'
                        : 'bg-slate-200 border-slate-400 text-slate-600'
                    }`}
                  >
                    {voiceEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* 3D Sound FX */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <div>
                  <div className="text-sm font-black text-slate-900">🔊 Slap &amp; Chop FX</div>
                  <div className="text-[11px] font-bold text-slate-500">Mosquito, Knife &amp; Freeze Audio</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !soundFx;
                    setSoundFx(next);
                    if (!next) stopMosquitoBuzz();
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                    soundFx
                      ? 'bg-amber-500 border-amber-800 text-white'
                      : 'bg-slate-200 border-slate-400 text-slate-600'
                  }`}
                >
                  {soundFx ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>

            {/* 1.5 Playing Time Timer Slider (Up to 5 Minutes / 300 Seconds) */}
            <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-black text-slate-900">⏱️ Playing Time Timer</span>
                  <p className="text-[11px] font-bold text-slate-500">Slide up to 5 minutes of total game playing time</p>
                </div>
                <span className="px-3.5 py-1 rounded-xl bg-emerald-500 text-white text-xs sm:text-sm font-black font-mono shadow-xs">
                  {formatPlayTime(playingTime)} ({Math.round((playingTime / 60) * 10) / 10}m)
                </span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="range"
                  min={30}
                  max={300}
                  step={15}
                  value={playingTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPlayingTime(val);
                    playingTimeRef.current = val;
                    setHudTimeLeft(val);
                    lastHudSecRef.current = val;
                    if (engineRef.current.isActive) {
                      engineRef.current.maxTimer = val;
                      engineRef.current.timer = val;
                      setTimerPct(100);
                    }
                  }}
                  className="w-full h-3 bg-emerald-200 rounded-full appearance-none cursor-pointer accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] font-black text-emerald-800 px-1">
                  <span>30s</span>
                  <span>1m</span>
                  <span>2m</span>
                  <span>3m</span>
                  <span>4m</span>
                  <span>5m (Max)</span>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                {[
                  { sec: 60, label: '1 Min' },
                  { sec: 120, label: '2 Min' },
                  { sec: 180, label: '3 Min' },
                  { sec: 240, label: '4 Min' },
                  { sec: 300, label: '5 Min' }
                ].map(preset => (
                  <button
                    key={preset.sec}
                    type="button"
                    onClick={() => {
                      setPlayingTime(preset.sec);
                      playingTimeRef.current = preset.sec;
                      setHudTimeLeft(preset.sec);
                      lastHudSecRef.current = preset.sec;
                      if (engineRef.current.isActive) {
                        engineRef.current.maxTimer = preset.sec;
                        engineRef.current.timer = preset.sec;
                        setTimerPct(100);
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                      playingTime === preset.sec
                        ? 'bg-emerald-500 border-emerald-800 text-white shadow'
                        : 'bg-white border-emerald-200 text-slate-700 hover:bg-emerald-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Text Size Adjuster */}
            <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">🔤 Question &amp; Answer Text Size</span>
                <span className="text-xs font-extrabold text-sky-700">
                  {textSize <= 0.95 ? 'Small' : textSize <= 1.05 ? 'Normal' : textSize <= 1.25 ? 'Large' : 'Extra Large'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 0.9, label: 'Small' },
                  { val: 1.0, label: 'Normal' },
                  { val: 1.2, label: 'Large' },
                  { val: 1.4, label: 'X-Large' }
                ].map(ts => (
                  <button
                    key={ts.label}
                    type="button"
                    onClick={() => setTextSize(ts.val)}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                      Math.abs(textSize - ts.val) < 0.06
                        ? 'bg-sky-500 border-sky-800 text-white shadow'
                        : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100'
                    }`}
                  >
                    {ts.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Target Speed Adjuster */}
            <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">⚡ Target Speed</span>
                <span className="text-xs font-extrabold text-amber-700">{speed}x Speed</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: 0.6, label: 'Slow' },
                  { val: 1.0, label: 'Normal' },
                  { val: 1.4, label: 'Fast' },
                  { val: 1.8, label: 'Turbo' }
                ].map(sp => (
                  <button
                    key={sp.label}
                    type="button"
                    onClick={() => setSpeed(sp.val)}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                      Math.abs(speed - sp.val) < 0.08
                        ? 'bg-amber-400 border-amber-700 text-slate-900 shadow'
                        : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Target Movements Pattern Adjuster */}
            <div className="p-4 rounded-2xl bg-sky-50 border-2 border-sky-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">🦋 Target Movements</span>
                <span className="text-xs font-extrabold text-purple-700 uppercase">{movementStyle}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'calm' as const, label: 'Calm Float' },
                  { id: 'normal' as const, label: 'Normal Flight' },
                  { id: 'zigzag' as const, label: 'Zig-Zag' },
                  { id: 'hover' as const, label: 'Gentle Hover' }
                ].map(mv => (
                  <button
                    key={mv.id}
                    type="button"
                    onClick={() => setMovementStyle(mv.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                      movementStyle === mv.id
                        ? 'bg-purple-600 border-purple-900 text-white shadow'
                        : 'bg-white border-sky-200 text-slate-700 hover:bg-sky-100'
                    }`}
                  >
                    {mv.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {screen === 'game' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    clearNextQuestionTimer();
                    stopMosquitoBuzz();
                    engineRef.current.isActive = false;
                    setScreen('setup');
                  }}
                  className="py-3 px-5 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-900 border-b-4 border-sky-300 font-black text-sm transition cursor-pointer"
                >
                  👥 Player &amp; Mode Setup
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-3 px-6 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white border-b-4 border-emerald-800 font-black text-base shadow-lg transition cursor-pointer"
              >
                ✓ Save &amp; {screen === 'game' ? 'Resume Game' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 5: Immersive 3D Championship Winner Announcement Modal */}
      {screen === 'results' && (() => {
        const p1 = engineRef.current.players[0] || { score: 0, correctHits: 0, wrongHits: 0, hits: 0, bestStreak: 1 };
        const p2 = engineRef.current.players[1] || { score: 0, correctHits: 0, wrongHits: 0, hits: 0, bestStreak: 1 };
        const p1TotalAttempts = (p1.correctHits || 0) + (p1.wrongHits || 0);
        const p2TotalAttempts = (p2.correctHits || 0) + (p2.wrongHits || 0);
        const p1Acc = p1TotalAttempts > 0 ? Math.round(((p1.correctHits || 0) / p1TotalAttempts) * 100) : 0;
        const p2Acc = p2TotalAttempts > 0 ? Math.round(((p2.correctHits || 0) / p2TotalAttempts) * 100) : 0;

        const isP1Winner = numPlayers === 1 || p1.score > p2.score;
        const isP2Winner = numPlayers === 2 && p2.score > p1.score;
        const isTie = numPlayers === 2 && p1.score === p2.score;

        const winnerHeadline = numPlayers === 2
          ? isP1Winner
            ? `👑 ${p1Name || 'Player 1'} Wins the Championship!`
            : isP2Winner
            ? `👑 ${p2Name || 'Player 2'} Wins the Championship!`
            : `⚡ Epic Championship Tie!`
          : `🏆 ${p1Name || 'Player 1'} Completed the Arena!`;

        return (
          <div className="fixed inset-0 z-50 bg-sky-900/45 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="relative bg-gradient-to-b from-amber-50 via-white to-sky-50 max-w-2xl w-full rounded-[2.6rem] p-6 sm:p-9 text-center border-4 border-amber-300 border-b-[12px] border-b-amber-500 shadow-[0_24px_60px_rgba(14,165,233,0.35)] space-y-6 animate-in fade-in zoom-in-95 duration-300 text-slate-900">
              
              {/* Top 3D Championship Ribbon & Trophy */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-b from-amber-300 via-yellow-400 to-amber-500 border-t-2 border-white border-b-8 border-b-amber-700 flex items-center justify-center text-6xl shadow-xl animate-bounce mb-3">
                  🏆
                </div>
                <span className="px-4 py-1 rounded-full bg-amber-100 border-2 border-amber-300 text-amber-800 text-xs font-black uppercase tracking-widest shadow-xs">
                  🌟 Official 3D Arena Winner Announcement 🌟
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-2 tracking-tight drop-shadow-[0_2px_0_rgba(255,255,255,1)]">
                  {winnerHeadline}
                </h2>
                <p className="text-sm font-bold text-slate-600 mt-1">
                  {answerMode === 'multiple' ? (
                    <>Multiple Answer Mode ({multiAnswerCount} Hits/Q): <span className="text-emerald-600 font-black">+1 Point</span> Correct • <span className="text-rose-600 font-black">-1 Point</span> Wrong</>
                  ) : (
                    <>Single Answer Mode: <span className="text-emerald-600 font-black">+5 Points</span> Correct • <span className="text-rose-600 font-black">-5 Points</span> Wrong</>
                  )}
                </p>
              </div>

              {/* 3D Championship Podium Score Cards */}
              <div className={`grid gap-4 ${numPlayers === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
                {/* Player 1 Podium Card (Blue Theme) */}
                <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                  isP1Winner || isTie
                    ? 'bg-gradient-to-b from-blue-50 to-white border-blue-400 border-b-blue-600 shadow-lg'
                    : 'bg-white border-slate-200 border-b-slate-300 opacity-90'
                }`}>
                  {(isP1Winner || isTie) && (
                    <span className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
                      {isTie ? '🥇 Co-Champion' : '👑 Winner'}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-black uppercase tracking-wider text-blue-700">
                      🔵 {p1Name || "Player 1"}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-black tabular-nums">
                      🔥 Best x{p1.bestStreak || 1}
                    </span>
                  </div>
                  <div className="text-5xl font-black text-slate-900 font-mono tabular-nums my-2">
                    {p1.score} <span className="text-base font-black text-blue-600">PTS</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3 border border-slate-200">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                      style={{ width: `${p1TotalAttempts > 0 ? p1Acc : 0}%` }}
                    />
                  </div>
                  <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-blue-100 text-xs font-extrabold tabular-nums">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 text-emerald-700">
                      <div className="text-sm font-black">+{(p1.correctHits || 0) * (answerMode === 'multiple' ? 1 : 5)}</div>
                      <div className="text-[10px]">✓ {p1.correctHits || 0} Correct</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl py-1.5 text-rose-700">
                      <div className="text-sm font-black">-{(p1.wrongHits || 0) * (answerMode === 'multiple' ? 1 : 5)}</div>
                      <div className="text-[10px]">❄️ {p1.wrongHits || 0} Wrong</div>
                    </div>
                    <div className="bg-sky-50 border border-sky-200 rounded-xl py-1.5 text-sky-800">
                      <div className="text-sm font-black">{p1TotalAttempts > 0 ? `${p1Acc}%` : '—'}</div>
                      <div className="text-[10px]">🎯 Accuracy</div>
                    </div>
                  </div>
                </div>

                {/* Player 2 Podium Card (If 2 Players - Red Theme) */}
                {numPlayers === 2 && (
                  <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                    isP2Winner || isTie
                      ? 'bg-gradient-to-b from-red-50 to-white border-red-400 border-b-red-600 shadow-lg'
                      : 'bg-white border-slate-200 border-b-slate-300 opacity-90'
                  }`}>
                    {(isP2Winner || isTie) && (
                      <span className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
                        {isTie ? '🥇 Co-Champion' : '👑 Winner'}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-black uppercase tracking-wider text-red-700">
                        🔴 {p2Name || "Player 2"}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 font-black tabular-nums">
                        🔥 Best x{p2.bestStreak || 1}
                      </span>
                    </div>
                    <div className="text-5xl font-black text-slate-900 font-mono tabular-nums my-2">
                      {p2.score} <span className="text-base font-black text-red-600">PTS</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mb-3 border border-slate-200">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
                        style={{ width: `${p2TotalAttempts > 0 ? p2Acc : 0}%` }}
                      />
                    </div>
                    <div className="w-full grid grid-cols-3 gap-2 pt-2 border-t border-red-100 text-xs font-extrabold tabular-nums">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 text-emerald-700">
                        <div className="text-sm font-black">+{(p2.correctHits || 0) * (answerMode === 'multiple' ? 1 : 5)}</div>
                        <div className="text-[10px]">✓ {p2.correctHits || 0} Correct</div>
                      </div>
                      <div className="bg-rose-50 border border-rose-200 rounded-xl py-1.5 text-rose-700">
                        <div className="text-sm font-black">-{(p2.wrongHits || 0) * (answerMode === 'multiple' ? 1 : 5)}</div>
                        <div className="text-[10px]">❄️ {p2.wrongHits || 0} Wrong</div>
                      </div>
                      <div className="bg-sky-50 border border-sky-200 rounded-xl py-1.5 text-sky-800">
                        <div className="text-sm font-black">{p2TotalAttempts > 0 ? `${p2Acc}%` : '—'}</div>
                        <div className="text-[10px]">🎯 Accuracy</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => startGame(numPlayers)}
                  className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 border-t border-emerald-200 border-b-[6px] border-b-emerald-800 text-white font-black text-lg transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
                >
                  <RotateCcw size={20} />
                  <span>Play Rematch</span>
                </button>
                <button
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="py-4 px-5 rounded-2xl bg-amber-300 hover:bg-amber-200 text-slate-900 border-b-[6px] border-amber-600 font-black text-base transition cursor-pointer"
                >
                  📖 Study Questions
                </button>
                <button
                  onClick={() => setScreen('setup')}
                  className="py-4 px-5 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-900 border-b-[6px] border-sky-300 font-black text-base transition cursor-pointer"
                >
                  ⚙️ Setup
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Screen 6: Interactive Bright Light 3D Study Mode (Flashcard Practice + Full Question List) */}
      {screen === 'study' && (() => {
        const totalQs = activeQuiz.questions.length;
        const safeStudyIdx = Math.min(Math.max(0, studyIndex), Math.max(0, totalQs - 1));
        const studyQ = activeQuiz.questions[safeStudyIdx] || activeQuiz.questions[0];

        return (
          <div className="absolute inset-0 z-40 bg-gradient-to-b from-sky-50 via-white to-sky-50 flex flex-col justify-between w-full h-full p-4 sm:p-6 md:p-8 overflow-y-auto select-none">
            {/* Top Navigation Header: Edge-to-Edge */}
            <div className="w-full flex items-center justify-between gap-4 pb-3 sm:pb-4 border-b-2 border-slate-200/80 shrink-0">
              <button
                type="button"
                onClick={() => setScreen('setup')}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border-2 border-slate-200 border-b-4 border-b-slate-300 text-slate-800 font-black text-sm sm:text-base transition cursor-pointer shadow-sm active:translate-y-0.5"
              >
                <ArrowLeft size={20} className="text-sky-600" />
                <span>Back to Setup</span>
              </button>

              {/* Center Stepper and Question Numbers */}
              <div className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-2xl bg-sky-100 border-2 border-sky-300 text-sky-900 text-sm sm:text-base font-black shadow-xs whitespace-nowrap">
                  Question {safeStudyIdx + 1} / {totalQs}
                </span>

                <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-sm lg:max-w-md xl:max-w-xl py-1 px-1 custom-scrollbar">
                  {activeQuiz.questions.map((qItem, idx) => (
                    <button
                      key={qItem.id || idx}
                      type="button"
                      onClick={() => {
                        setStudyIndex(idx);
                        setStudySelectedOption(null);
                      }}
                      className={`min-w-[2.5rem] h-10 px-2 rounded-xl font-black text-xs sm:text-sm border-b-4 transition cursor-pointer shrink-0 ${
                        idx === safeStudyIdx
                          ? 'bg-amber-400 border-amber-600 text-slate-900 scale-105 shadow-md ring-2 ring-amber-300/60'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-sky-50'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Controls: Read Aloud + Full Screen Toggle */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const qParsed = parseOptionContent(studyQ.text || '');
                    speakText(qParsed.text || studyQ.text);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-100 hover:bg-sky-200 border-2 border-sky-300 text-sky-800 text-xs sm:text-sm font-black cursor-pointer transition active:scale-95 shadow-sm"
                >
                  <span>🔊 Read Aloud</span>
                </button>

                <FullscreenButton
                  targetId="slap-and-chop-container"
                  showLabel={true}
                  className="px-5 py-2.5 rounded-2xl !bg-white hover:!bg-slate-100 border-2 border-slate-300 border-b-4 border-b-slate-400 !text-black font-black text-sm sm:text-base transition cursor-pointer shadow-sm active:translate-y-0.5 flex items-center gap-2"
                />
              </div>
            </div>

            {studyQ && (
              <div className="w-full flex-1 flex flex-col justify-between py-4 sm:py-6 gap-4 min-h-0">
                {/* Question Prompt - GIGANTIC Full Screen Typography & Media */}
                {(() => {
                  const qParsed = parseOptionContent(studyQ.text || '');
                  const qImg = studyQ.image || qParsed.imageUrl;
                  const qDisplayText = qParsed.text || studyQ.text;
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto min-h-[140px] sm:min-h-[180px]">
                      {qImg && (
                        <img
                          src={qImg}
                          alt="Question"
                          className="max-h-[30vh] sm:max-h-[38vh] md:max-h-[44vh] max-w-full rounded-3xl object-contain bg-white border-2 border-sky-200 p-4 shadow-lg mb-4"
                        />
                      )}
                      {qDisplayText && (
                        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-tight max-w-7xl">
                          {qDisplayText}
                        </h2>
                      )}
                    </div>
                  );
                })()}

                {/* Options - SQUARE 2x2 ABCD GRID LAYOUT (Never a single straight line; double width, zero overlapping!) */}
                <div className={`w-full max-w-5xl mx-auto grid gap-4 sm:gap-6 ${
                  studyQ.options.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2'
                }`}>
                  {studyQ.options.map((opt, oIdx) => {
                    const isPicked = studySelectedOption === oIdx;
                    const isCorrectAnswer = oIdx === studyQ.answerIndex;
                    const showResult = studySelectedOption !== null;

                    let btnStyle = 'bg-white hover:bg-sky-50 border-sky-200 border-b-sky-300 text-slate-800 shadow-md hover:shadow-lg';
                    if (showResult) {
                      if (isCorrectAnswer) {
                        btnStyle = 'bg-emerald-50 border-emerald-400 border-b-emerald-600 text-emerald-950 shadow-xl ring-4 ring-emerald-300/50 scale-[1.01]';
                      } else if (isPicked && !isCorrectAnswer) {
                        btnStyle = 'bg-rose-50 border-rose-400 border-b-rose-600 text-rose-950 shadow-md';
                      } else {
                        btnStyle = 'bg-slate-50 border-slate-200 border-b-slate-300 text-slate-400 opacity-60';
                      }
                    }

                    const parsedOpt = parseOptionContent(opt);

                    return (
                      <button
                        key={oIdx}
                        type="button"
                        onClick={() => {
                          setStudySelectedOption(oIdx);
                          if (oIdx === studyQ.answerIndex) {
                            playSoundEffect('correct');
                          } else {
                            playSoundEffect('freeze');
                          }
                        }}
                        className={`p-4 sm:p-5 md:p-6 rounded-3xl border-3 border-b-[6px] sm:border-b-[8px] text-left font-black transition-all cursor-pointer min-h-[90px] sm:min-h-[110px] md:min-h-[120px] flex items-center gap-3 sm:gap-4 active:translate-y-1 ${btnStyle}`}
                      >
                        <span className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center text-xl sm:text-2xl md:text-3xl font-black shrink-0 shadow-md ${
                          showResult && isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : showResult && isPicked && !isCorrectAnswer
                            ? 'bg-rose-500 text-white'
                            : 'bg-sky-100 border-2 border-sky-300 text-sky-800'
                        }`}>
                          {OPTION_LETTERS[oIdx]}
                        </span>

                        <div className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden">
                          {parsedOpt.imageUrl && (
                            <img
                              src={parsedOpt.imageUrl}
                              alt={parsedOpt.text || `Option ${OPTION_LETTERS[oIdx]}`}
                              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl object-contain bg-white p-2 border-2 border-sky-200 shrink-0 shadow-md"
                            />
                          )}
                          {parsedOpt.text ? (
                            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 break-words leading-snug line-clamp-3">
                              {parsedOpt.text}
                            </span>
                          ) : !parsedOpt.imageUrl ? (
                            <span className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 break-words leading-snug line-clamp-3">
                              {opt}
                            </span>
                          ) : null}
                        </div>

                        {showResult && isCorrectAnswer && (
                          <span className="text-xs sm:text-sm md:text-base font-black px-3.5 py-1.5 rounded-xl bg-emerald-500 text-white shrink-0 shadow-md">
                            ✓ +5 PTS
                          </span>
                        )}
                        {showResult && isPicked && !isCorrectAnswer && (
                          <span className="text-xs sm:text-sm md:text-base font-black px-3.5 py-1.5 rounded-xl bg-rose-500 text-white shrink-0 shadow-md">
                            ✗ -5 PTS
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Instant Practice Feedback Banner - No "Careful!", No "freezes"/"free" */}
                {studySelectedOption !== null && (() => {
                  const isCorrect = studySelectedOption === studyQ.answerIndex;
                  const correctOptRaw = studyQ.options[studyQ.answerIndex] || '';
                  const correctParsed = parseOptionContent(correctOptRaw);
                  const correctLetter = OPTION_LETTERS[studyQ.answerIndex];

                  return (
                    <div className={`w-full max-w-7xl mx-auto p-4 sm:p-5 rounded-3xl border-2 text-center font-black animate-in fade-in duration-150 flex items-center justify-center flex-wrap gap-3 shadow-md ${
                      isCorrect
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}>
                      {isCorrect ? (
                        <>
                          <span className="text-lg sm:text-2xl">
                            🎉 Awesome! Option {correctLetter}{correctParsed.text ? `: "${correctParsed.text}"` : ""} is the correct answer (+5 points)!
                          </span>
                          {correctParsed.imageUrl && (
                            <img
                              src={correctParsed.imageUrl}
                              alt="Correct answer"
                              className="w-12 h-12 rounded-xl object-contain bg-white border-2 border-emerald-300 p-1 shadow-sm inline-block"
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-lg sm:text-2xl">
                            Incorrect (-5 points). The correct answer is {correctLetter}{correctParsed.text ? `: "${correctParsed.text}"` : ""}.
                          </span>
                          {correctParsed.imageUrl && (
                            <img
                              src={correctParsed.imageUrl}
                              alt="Correct answer"
                              className="w-12 h-12 rounded-xl object-contain bg-white border-2 border-rose-300 p-1 shadow-sm inline-block"
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Bottom Navigation Bar: Edge-to-Edge and High Contrast */}
                <div className="w-full flex items-center justify-between gap-4 pt-3 sm:pt-4 border-t-2 border-slate-200/80 shrink-0 flex-wrap">
                  <button
                    type="button"
                    disabled={safeStudyIdx === 0}
                    onClick={() => {
                      setStudyIndex(Math.max(0, safeStudyIdx - 1));
                      setStudySelectedOption(null);
                    }}
                    className="px-8 py-4 rounded-2xl bg-sky-100 hover:bg-sky-200 disabled:opacity-40 text-sky-900 border-b-4 border-sky-300 font-black text-base sm:text-lg transition cursor-pointer active:translate-y-0.5 shadow-sm"
                  >
                    ← Previous Question
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudySelectedOption(studyQ.answerIndex)}
                    className="px-7 py-3.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 border-2 border-amber-300 font-black text-sm sm:text-base transition cursor-pointer active:scale-95 shadow-sm"
                  >
                    💡 Reveal Answer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (safeStudyIdx + 1 < totalQs) {
                        setStudyIndex(safeStudyIdx + 1);
                        setStudySelectedOption(null);
                      } else {
                        setScreen('setup');
                      }
                    }}
                    className="px-8 py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white border-b-4 border-sky-700 font-black text-base sm:text-lg transition cursor-pointer shadow-lg active:translate-y-0.5"
                  >
                    {safeStudyIdx + 1 < totalQs ? 'Next Question →' : '✓ Done (Back to Setup)'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Mode Switcher Modal */}
      {showModeModal && (
        <GameModeModal
          isOpen={showModeModal}
          onClose={() => setShowModeModal(false)}
          gameData={{
            name: activeQuiz.title,
            topic: activeQuiz.topic,
            className: activeQuiz.classLevel,
            customQuestions: activeQuiz.questions
          }}
          onSelectMode={(mode, adaptedData) => {
            setShowModeModal(false);
            onViewChange(mode as ViewState, adaptedData || {
              ...initialGame,
              name: activeQuiz.title,
              topic: activeQuiz.topic,
              className: activeQuiz.classLevel,
              customQuestions: activeQuiz.questions
            });
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// QUIZ EDITOR COMPONENT (EXACT MATCH TO BUBBLE POP GAME SETUP)
// -------------------------------------------------------------
function QuizEditor({
  quiz,
  folders,
  onSave,
  onCancel,
}: {
  quiz: Quiz;
  folders: { id: string; name: string }[];
  onSave: (q: Quiz) => void;
  onCancel: () => void;
  onPlayDirect?: () => void;
}) {
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [localFolders, setLocalFolders] = useState<{ id: string; name: string }[]>(folders || []);
  const [contentMode, setContentMode] = useState<OptionContentMode>("words");
  const [autoRecommendPhoto, setAutoRecommendPhoto] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>(
    quiz.questions && quiz.questions.length > 0
      ? quiz.questions
      : [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }]
  );

  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string; optIndex: number | 'question'; initialQuery?: string } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setLocalFolders(folders || []);
  }, [folders]);

  const handleContentModeChange = (nextMode: OptionContentMode) => {
    setContentMode(nextMode);
    convertQuestionsContentMode(questions, nextMode, (updated) => {
      setQuestions(updated);
      setToastMsg(
        nextMode === "words"
          ? "📝 Converted options to Words Only!"
          : nextMode === "photos_gifs"
          ? "🎨 Converted options to Cartoon PNGs & GIFs!"
          : "✨ Converted options to Both (Words + Cartoon PNGs)!"
      );
      setTimeout(() => setToastMsg(""), 3000);
    });
  };

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(`Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`);
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: Date.now() + Math.random(), text: "", options: ["", "", "", ""], answerIndex: 0 }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const nextOpts = [...q.options];
        nextOpts[optIndex] = value;
        return { ...q, options: nextOpts };
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length < 6) {
        return { ...q, options: [...q.options, ""] };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const nextOpts = [...q.options];
        nextOpts.pop();
        const nextAns = q.answerIndex >= nextOpts.length ? nextOpts.length - 1 : q.answerIndex;
        return { ...q, options: nextOpts, answerIndex: nextAns };
      }
      return q;
    }));
  };

  const duplicateQuestion = (index: number) => {
    setQuestions(prev => {
      const next = [...prev];
      const q = prev[index];
      next.splice(index + 1, 0, { ...q, id: Date.now() + Math.random(), options: [...q.options] });
      return next;
    });
  };

  const removeQuestion = (id: number | string) => {
    setQuestions(prev => {
      if (prev.length > 1) {
        return prev.filter(q => q.id !== id);
      }
      return prev;
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
    }
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg("Please enter or paste at least one question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const newItems: Question[] = parsed.map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || "",
      options: item.options || ["", "", "", ""],
      answerIndex: item.answerIndex || 0,
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions(prev => {
        const isOnlyInitialBlank = prev.length === 1 && !prev[0].text.trim() && prev[0].options.every(o => !o.trim());
        const base = isOnlyInitialBlank ? [] : prev;
        return [...base, ...newItems];
      });
    }

    setToastMsg(`✨ Added ${newItems.length} questions successfully!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
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
    const validQuestions = questions.filter(q => q.text.trim());
    onSave({
      ...quiz,
      title: topic || "Slap and Chop Game",
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-gradient-to-br from-sky-100 via-amber-50 to-emerald-100 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        {/* 3D Light Glass Container */}
        <div className="w-full max-w-4xl bg-white/95 rounded-3xl overflow-hidden flex flex-col shadow-2xl border-2 border-white mb-8">
          <div className="bg-white p-8 flex flex-col gap-6 border-b-2 border-sky-200">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-extrabold text-slate-800 tracking-wide">GAME SETUP</h2>
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-sky-500 text-white font-bold hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/30 cursor-pointer"
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
              folders={localFolders}
              onCreateFolder={(name) => {
                const newF = { id: `folder_${Date.now()}`, name };
                setLocalFolders((prev) => [...prev, newF]);
                setFolderId(newF.id);
              }}
              contentMode={contentMode}
              setContentMode={handleContentModeChange}
              autoRecommendPhoto={autoRecommendPhoto}
              setAutoRecommendPhoto={setAutoRecommendPhoto}
              onApplyStarterTopic={(starterQs) => {
                const formatted = starterQs.map((sq, i) => ({
                  id: Date.now() + i + Math.random(),
                  text: sq.text,
                  options: sq.options,
                  answerIndex: sq.answerIndex,
                }));
                setQuestions(formatted);
                convertQuestionsContentMode(formatted, contentMode, (updated) => {
                  setQuestions(updated);
                });
                setToastMsg(`✨ Loaded ${formatted.length} "${topic}" questions with auto Cartoon PNGs!`);
                setTimeout(() => setToastMsg(""), 3500);
              }}
            />
          </div>

          {errorMsg && (
            <div className="bg-red-50 text-red-600 p-3 mx-6 mt-6 rounded-lg font-bold text-center border border-red-200 animate-pulse">
              {errorMsg}
            </div>
          )}

          {toastMsg && (
            <div className="bg-sky-50 text-sky-700 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-sky-200 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-sm">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          <div className="p-6 flex flex-col gap-6 bg-sky-50/50">
            {/* Bulk Paste Action Bar with How to Bulk Paste Video Guide Button */}
            <div className="bg-sky-100/80 border border-sky-200 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="font-bold text-sm text-sky-900 uppercase tracking-wider">
                QUESTIONS ({questions.length})
              </span>
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-sky-500/25 flex items-center gap-2.5 cursor-pointer"
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

            {/* Questions List */}
            {questions.map((q, index) => (
              <div key={q.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative group">
                <button
                  type="button"
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-sky-500 hover:text-white border-2 border-white cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  title="Delete Question"
                  className="absolute -right-3 -top-3 w-8 h-8 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white cursor-pointer z-10"
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex gap-4 mb-4 items-start">
                  <div className="w-8 h-8 mt-2 rounded-full bg-sky-100 text-sky-600 font-bold flex items-center justify-center shrink-0 border border-sky-200">
                    {index + 1}
                  </div>
                  <SmartQuestionInput
                    id={`question-input-${index}`}
                    value={q.text}
                    imageUrl={q.image || parseOptionContent(q.text).imageUrl}
                    onChange={(newVal) => updateQuestion(q.id, 'text', newVal)}
                    onChangeImage={(newImg) => updateQuestion(q.id, 'image', newImg || undefined)}
                    onOpenMediaPicker={(initialQuery) => setActiveGiphyInput({ qId: q.id, optIndex: 'question', initialQuery: initialQuery || q.text })}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={(e) => handlePaste(e, index)}
                    placeholder="Type your question here (or click Add Media for picture/GIF)..."
                    autoPhotosEnabled={autoRecommendPhoto}
                  />
                </div>

                <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {q.options.map((opt, optIndex) => (
                    <SmartOptionInput
                      key={optIndex}
                      value={opt}
                      optionIndex={optIndex}
                      isCorrect={q.answerIndex === optIndex}
                      onSelectCorrect={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                      onChangeValue={(val) => updateOption(q.id, optIndex, val)}
                      onOpenMediaPicker={(initialQuery) => setActiveGiphyInput({ qId: q.id, optIndex, initialQuery })}
                      contentMode={contentMode}
                      autoRecommendPhoto={autoRecommendPhoto}
                      placeholder={`Option ${optIndex + 1} (e.g. apple)`}
                      radioName={`answer-${q.id}`}
                    />
                  ))}
                </div>

                <div className="ml-12 mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 6}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 cursor-pointer font-bold"
                  >
                    + Option
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(q.id)}
                    disabled={q.options.length <= 2}
                    className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 cursor-pointer font-bold"
                  >
                    - Option
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-sky-300 rounded-2xl text-sky-700 font-bold hover:bg-sky-50 hover:border-sky-400 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Plus size={20} /> Add Another Question
            </button>
          </div>
        </div>
      </div>

      <MediaPickerModal
        isOpen={activeGiphyInput !== null}
        onClose={() => setActiveGiphyInput(null)}
        initialQuery={activeGiphyInput?.initialQuery || ""}
        onSelect={(url) => {
          if (activeGiphyInput) {
            if (activeGiphyInput.optIndex === 'question') {
              updateQuestion(activeGiphyInput.qId, 'image', url);
            } else {
              const targetQ = questions.find((q) => q.id === activeGiphyInput.qId);
              const currentRaw = targetQ?.options[activeGiphyInput.optIndex] || "";
              const parsed = parseOptionContent(currentRaw);
              const nextVal = formatOptionContent(parsed.text, url, contentMode === "words" ? "both" : contentMode);
              updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, nextVal);
            }
            setActiveGiphyInput(null);
          }
        }}
      />

      {showPublishModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-sky-900/35 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl border-2 border-sky-100 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 mb-2">Publish Game?</h3>
            <p className="text-slate-600 mb-8 font-medium">
              Would you like to publish this game to the Community so other teachers can use it?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-sky-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
              >
                Yes, Publish (Public)
              </button>
              <button
                type="button"
                onClick={() => confirmSave(false)}
                className="w-full py-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer text-lg"
              >
                No, Keep Private
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="w-full py-2 mt-2 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Paste Modal with Mystery Box 3-Step Guide & Prompt Copy */}
      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-sky-900/40 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border-2 border-sky-100 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800">
                    Bulk Paste &amp; Auto-Divide
                  </h3>
                  <p className="text-xs text-slate-500">
                    Paste multiple questions, numbered lists with options &amp; answer (e.g. Answer: B), or tabular TSV data.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 border border-purple-200 text-purple-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Watch Video Tutorial"
                >
                  <Play size={13} className="fill-current text-purple-600" />
                  <span>Video Guide</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Step-by-step instructions with Video walkthrough & prompt copy */}
            <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-sky-50 border border-purple-200 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Play size={14} className="ml-0.5 fill-current" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-slate-800 block">
                      How to Bulk Paste: 3 Simple Steps
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Generate 20-30 questions with AI and auto-populate in seconds
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer text-xs shrink-0 self-start sm:self-auto"
                >
                  <Play size={12} className="fill-current" />
                  <span>Watch Video Guide</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-purple-600">1. Prompt AI</span>
                  <p className="text-[11px] text-slate-600">
                    Ask ChatGPT/Claude for multiple-choice questions with answers.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="mt-1 px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-700 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedPromptInModal ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    <span>{copiedPromptInModal ? "Copied Prompt!" : "Copy AI Prompt"}</span>
                  </button>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-sky-600">2. Copy Output</span>
                  <p className="text-[11px] text-slate-600">
                    Highlight all questions generated by the AI and copy to clipboard.
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+C or ⌘+C</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-emerald-600">3. Paste &amp; Click + Add</span>
                  <p className="text-[11px] text-slate-600">
                    Paste below. Questions, options &amp; answers are auto-divided!
                  </p>
                  <span className="text-[10px] text-emerald-600 font-bold">Ready in 1 click!</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Paste Text Below (Supports multi-line Q&amp;A format or Excel copy)
              </label>
              <textarea
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
                className="w-full text-sm font-medium bg-slate-50 border border-slate-300 outline-none text-slate-800 p-4 rounded-2xl focus:border-sky-500 transition-colors custom-scrollbar"
              />
            </div>

            {bulkText.trim() && (
              <div className="flex items-start gap-2 bg-sky-50 p-3 rounded-xl border border-sky-200">
                <div className="text-sky-500 mt-0.5"><Info size={16} /></div>
                <p className="text-sm text-slate-600">
                  Found <span className="font-bold text-slate-800">{parsePastedQuiz(bulkText).length}</span> items.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleApplyBulkPaste('replace')}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Replace All
              </button>
              <button
                type="button"
                onClick={() => handleApplyBulkPaste('append')}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-sky-500 hover:bg-sky-600 transition-colors shadow-lg shadow-sky-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={18} />
                + Add
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

// -------------------------------------------------------------
// TEXT PARSER FOR BULK PASTE
// -------------------------------------------------------------
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  // 1. Pipe-delimited: Q | Opt1 | Opt2 | Opt3 | Opt4 | Ans
  if (rawText.includes('|')) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split('|').map(s => s.trim());
      if (parts.length >= 3) {
        const qText = parts[0];
        const opts = parts.slice(1, parts.length - 1);
        const ansRaw = parts[parts.length - 1];
        let ansIdx = 0;
        const num = parseInt(ansRaw, 10);
        if (!isNaN(num) && num >= 1) ansIdx = num - 1;
        else if (/^[A-Fa-f]$/.test(ansRaw)) ansIdx = ansRaw.toUpperCase().charCodeAt(0) - 65;

        items.push({
          text: qText,
          options: opts.length >= 2 ? opts : ["Option 1", "Option 2"],
          answerIndex: Math.max(0, Math.min(opts.length - 1, ansIdx))
        });
      }
    });
    if (items.length > 0) return items;
  }

  // 2. Tab-separated data (Excel / TSV)
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split('\t').map(s => s.trim());
      if (parts.length >= 2) {
        let qText = parts[0];
        let opts: string[] = [];
        let ansRaw = "";

        if (/^\d+$/.test(parts[0]) && parts.length >= 3) {
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

  // 3. Multi-line / Standard Text Parsing
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;

  const isQuestionStart = (line: string) => /^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);
  const getQuestionText = (line: string) => {
    const m = line.match(/^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
    return m ? m[1].trim() : line;
  };
  const isAnswerLine = (line: string) => /^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i.test(line);

  const extractAnswerIndex = (line: string, opts: string[] = ["", "", "", ""]) => {
    const m = line.match(/^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i);
    if (!m) return -1;
    const raw = m[1].trim();

    const letter = raw.match(/[\(\[]?([A-Da-d])[\)\]\.\:]?/);
    if (letter) return letter[1].toUpperCase().charCodeAt(0) - 65;
    const num = raw.match(/^[1-4]$/);
    if (num) return parseInt(num[0]) - 1;
    const found = opts.findIndex(o => o && (o.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(o.toLowerCase())));
    if (found >= 0) return found;
    return 0;
  };

  const isOptionLine = (line: string) => {
    if (/^(?:[\(\[]?[A-Da-d][\)\]\.\:\-]|[\(\[][A-Da-d][\)\]])\s*(.*)/.test(line)) return true;
    if (/^(?:[\(\[][1-4][\)\]]|[1-4]\))\s*(.*)/.test(line)) return true;
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
    let line = lines[i];
    if (!line) continue;

    if (isAnswerLine(line)) {
      if (currentQ) {
        const ansIdx = extractAnswerIndex(line, currentQ.options || []);
        if (ansIdx >= 0) currentQ.answerIndex = ansIdx;
      }
      continue;
    }

    const inlineAnsMatch = line.match(/(?:\[|\(|\b)(?:ans(?:wer)?|correct)\s*[:=\-]?\s*([A-Da-d1-4])(?:\b|\)|\b)/i);
    let inlineAnswerIndex = -1;
    if (inlineAnsMatch) {
      const val = inlineAnsMatch[1].toUpperCase();
      if (/[A-D]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
      else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
      line = line.replace(inlineAnsMatch[0], "").trim();
    }
    if (!line) continue;

    if (isOptionLine(line)) {
      const opt = extractOption(line);
      if (opt && opt.index >= 0 && opt.index < 4) {
        if (!currentQ) {
          currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
          items.push(currentQ);
        }
        if (!currentQ.options) currentQ.options = ["", "", "", ""];
        currentQ.options[opt.index] = opt.text;
        if (inlineAnswerIndex >= 0) currentQ.answerIndex = inlineAnswerIndex;

        let rest = opt.text;
        const inlineOpts = [...rest.matchAll(/\s+([B-Db-d])[\.\)\:\-]\s+([^B-Db-d\.\)\:\-]+)/g)];
        if (inlineOpts.length > 0) {
          currentQ.options[opt.index] = rest.substring(0, inlineOpts[0].index).trim();
          inlineOpts.forEach(m => {
            const extraIdx = m[1].toUpperCase().charCodeAt(0) - 65;
            if (extraIdx < 4 && currentQ && currentQ.options) currentQ.options[extraIdx] = m[2].trim();
          });
        }
      }
      continue;
    }

    if (isQuestionStart(line)) {
      const qText = getQuestionText(line);
      currentQ = {
        text: qText,
        options: ["", "", "", ""],
        answerIndex: inlineAnswerIndex >= 0 ? inlineAnswerIndex : 0
      };
      items.push(currentQ);
      continue;
    }

    if (currentQ) {
      const hasOptions = currentQ.options?.some(o => Boolean(o));
      if (!hasOptions) {
        currentQ.text += " " + line;
      } else {
        currentQ = {
          text: line,
          options: ["", "", "", ""],
          answerIndex: inlineAnswerIndex >= 0 ? inlineAnswerIndex : 0
        };
        items.push(currentQ);
      }
    } else {
      currentQ = {
        text: line,
        options: ["", "", "", ""],
        answerIndex: inlineAnswerIndex >= 0 ? inlineAnswerIndex : 0
      };
      items.push(currentQ);
    }
  }

  return items;
}
