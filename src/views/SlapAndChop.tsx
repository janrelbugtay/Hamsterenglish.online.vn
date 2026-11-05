import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { ArrowLeft, Edit3, Trash2, Plus, Sparkles, BookOpen, Save, X, Play, Folder, Image as ImageIcon, ClipboardList, Copy, Volume2, VolumeX, RotateCcw, Check, Info } from "lucide-react";
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
  const [showHeadgear, setShowHeadgear] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [soundFx, setSoundFx] = useState<boolean>(true);
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [textSize, setTextSize] = useState<number>(1.15); // 0.9 = Small, 1.0 = Normal, 1.2 = Large, 1.4 = Extra Large
  const [movementStyle, setMovementStyle] = useState<'calm' | 'normal' | 'zigzag' | 'hover'>('normal');
  const [playingTime, setPlayingTime] = useState<number>(120); // Playing time in seconds (up to 300s = 5 minutes)
  const [selectedTheme, setSelectedTheme] = useState<string>("theme-sky");

  // In-Game Live HUD States
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [activeRoundMode, setActiveRoundMode] = useState<'mosquito' | 'chop'>('mosquito');
  const [hudScores, setHudScores] = useState<[number, number]>([0, 0]);
  const [hudStreaks, setHudStreaks] = useState<[number, number]>([1, 1]);
  const [hudScorePops, setHudScorePops] = useState<[string | null, string | null]>([null, null]);
  const [hudFrozen, setHudFrozen] = useState<[boolean, boolean]>([false, false]);
  const [hudHandsDetected, setHudHandsDetected] = useState<[[boolean, boolean], [boolean, boolean]]>([[false, false], [false, false]]);
  const [timerPct, setTimerPct] = useState<number>(100);
  const [hudTimeLeft, setHudTimeLeft] = useState<number>(120);
  const [nextQCountdown, setNextQCountdown] = useState<number | null>(null);
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
  const nextQTimerRef = useRef<number | null>(null);
  const lastHudSecRef = useRef<number>(playingTime);
  const lastHudHandsRef = useRef<string>('0000');
  const onHandsResultsRef = useRef<((results: any) => void) | null>(null);
  const onFaceResultsRef = useRef<((results: any) => void) | null>(null);

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
    lastFrameTime: performance.now()
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

  const playSoundEffect = (type: 'slap' | 'slash' | 'correct' | 'wrong' | 'whoosh' | 'freeze' | 'victory' | 'countdown' | 'launch') => {
    if (!soundFxRef.current) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (type === 'slap') {
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
      hits: 0,
      correctHits: 0,
      wrongHits: 0,
      frozenTimer: 0,
      theme: isP2 ? {
        hatMain: '#f43f5e',
        hatDark: '#9f1239',
        hatLight: '#fda4af',
        outline: '#4c0519',
        plume: '#881337',
        band: '#f59e0b',
        buckle: '#fde047',
        badgeRing: '#fda4af',
        gloveMain: '#fb7185',
        gloveLight: '#ffe4e6',
        gloveDark: '#be123c',
        gloveRim: '#fff1f2',
        swordColor: '#f43f5e',
        swordCore: '#fff7ed',
        maskTrim: '#fda4af'
      } : {
        hatMain: '#8b5cf6',
        hatDark: '#4c1d95',
        hatLight: '#ddd6fe',
        outline: '#2e1065',
        plume: '#4c1d95',
        band: '#0ea5e9',
        buckle: '#fde047',
        badgeRing: '#93c5fd',
        gloveMain: '#a855f7',
        gloveLight: '#f3e8ff',
        gloveDark: '#6b21a8',
        gloveRim: '#faf5ff',
        swordColor: '#0284c7',
        swordCore: '#f0f9ff',
        maskTrim: '#7dd3fc'
      },
      homeX: baseX,
      headX: baseX,
      headY: 0.36,
      headScale: 1.08,
      headTilt: 0,
      headDetected: false,
      lastHeadTime: 0,
      handX: baseX,
      handY: 0.58,
      prevHandX: baseX,
      prevHandY: 0.58,
      handScale: 1.35,
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
      lastPointerTime: 0,
      lastDualHandTime: 0,
      dualHandsArmed: false,
      clapArmed: false,
      peakArmedSep: 0,
      lastArmedTime: 0,
      lastClosingVel: 0,
      lastTwoHandSepDist: 1,
      lastSeparatedHandsTime: 0,
      lastSlapSelectTime: 0,
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
        speed: 0,
        angle: -0.18,
        knifeAngle: -0.45,
        scale: 1.35,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        lastSeenTime: 0,
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
        speed: 0,
        angle: 0.18,
        knifeAngle: -2.69,
        scale: 1.35,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        lastSeenTime: 0,
        landmarks: null as any[] | null,
        trail: [] as { x: number; y: number; life: number }[]
      }
    };
  };

  // Compute dynamic 3D hand scale & finger openness from 21 MediaPipe landmarks
  // Tracks real hand size so moving hands closer to the camera scales gloves & knives up, and further away scales them down!
  const analyzeHandGeometry = (landmarks: any[]) => {
    const wrist = landmarks[0];
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
    const coreSize = palmLength * 0.64 + palmWidth * 0.52;

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const bboxDiag = Math.hypot(maxX - minX, maxY - minY);
    const thumbPinkySpan = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);

    // Responsive 3D depth scaling based on real hand size in camera frame
    const rawScale = (coreSize * 7.2) + (bboxDiag * 1.55) + (thumbPinkySpan * 0.65);
    const scale = Math.max(0.55, Math.min(2.25, rawScale));

    const avgTipDist = (
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)
    ) / 4;
    const openness = Math.max(0.35, Math.min(1.35, avgTipDist / Math.max(0.04, palmLength * 1.75)));

    return { scale, openness, palmLength };
  };

  // MediaPipe Hands Results Handler (1:1 object-cover projection, dynamic hand size & movement tracking, two-glove clap detection)
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
    const HAND_GRACE_MS = 450;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      eng.players.forEach(p => {
        if (now - (p.leftHand.lastSeenTime || 0) > HAND_GRACE_MS) {
          p.leftHand.detected = false;
        }
        if (now - (p.rightHand.lastSeenTime || 0) > HAND_GRACE_MS) {
          p.rightHand.detected = false;
        }
        if (!p.leftHand.detected || !p.rightHand.detected) {
          p.isClapping = false;
          p.clapTimer = 0;
        }
        if (now - (p.lastHandTime || 0) > 550) {
          p.hasDetectedHands = false;
          p.dualHandsArmed = false;
          p.isClapping = false;
        }
      });
      return;
    }

    const allDetectedHands: any[] = [];

    results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
      if (!landmarks || landmarks.length < 21) return;
      const wrist = landmarks[0];
      const indexMcp = landmarks[5];
      const middleMcp = landmarks[9];
      const ringMcp = landmarks[13];
      const pinkyMcp = landmarks[17];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];

      // Center tracked position on the middle of the full hand (wrist to fingertips) so the glove covers the entire hand
      const palmMirroredX = 1.0 - (
        wrist.x * 0.24 +
        middleMcp.x * 0.28 +
        indexMcp.x * 0.14 +
        ringMcp.x * 0.10 +
        pinkyMcp.x * 0.06 +
        middleTip.x * 0.18
      );
      const palmNormY =
        wrist.y * 0.24 +
        middleMcp.y * 0.28 +
        indexMcp.y * 0.14 +
        ringMcp.y * 0.10 +
        pinkyMcp.y * 0.06 +
        middleTip.y * 0.18;
      const rawX = toCanvasNormX(palmMirroredX);
      const rawY = toCanvasNormY(palmNormY);
      const rawWristX = toCanvasNormX(1.0 - wrist.x);
      const rawWristY = toCanvasNormY(wrist.y);

      const aimX = toCanvasNormX(1.0 - ((indexTip.x + middleTip.x) * 0.5));
      const aimY = toCanvasNormY((indexTip.y + middleTip.y) * 0.5);
      const dx = aimX - rawWristX;
      const dy = aimY - rawWristY;
      const gloveAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const pointingAngle = Math.atan2(dy, dx);

      const { scale, openness } = analyzeHandGeometry(landmarks);

      const mirroredLandmarks = landmarks.map((lm: any) => ({
        x: toCanvasNormX(1.0 - lm.x),
        y: toCanvasNormY(lm.y),
        z: lm.z || 0
      }));

      // Compute normalized bounding box of all 21 landmarks on the canvas
      let minLmX = 1, maxLmX = 0, minLmY = 1, maxLmY = 0;
      mirroredLandmarks.forEach((lm: any) => {
        if (lm.x < minLmX) minLmX = lm.x;
        if (lm.x > maxLmX) maxLmX = lm.x;
        if (lm.y < minLmY) minLmY = lm.y;
        if (lm.y > maxLmY) maxLmY = lm.y;
      });

      const handedness = results.multiHandedness?.[handIndex]?.label || '';
      const confidence = results.multiHandedness?.[handIndex]?.score ?? 0.8;
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
          clampedX: Math.max(0.025, Math.min(0.975, h.rawX)),
          clampedY: Math.max(0.03, Math.min(0.97, h.rawY))
        });
      });
    } else {
      allDetectedHands.forEach(h => {
        const pIdx = h.rawX < 0.5 ? 0 : 1;
        rawPlayerHands[pIdx].push(h);
      });
      // If 2 hands are detected in 2P mode and got split across x = 0.5, check if they belong to the same player clapping!
      if (rawPlayerHands[0].length === 1 && rawPlayerHands[1].length === 1) {
        const h0 = rawPlayerHands[0][0];
        const h1 = rawPlayerHands[1][0];
        const pairSpan = Math.hypot(h1.rawX - h0.rawX, h1.rawY - h0.rawY);
        const verticalDiff = Math.abs(h1.rawY - h0.rawY);
        const midX = (h0.rawX + h1.rawX) * 0.5;
        const p0OnlyActive = Boolean(eng.players[0]?.headDetected && !eng.players[1]?.headDetected);
        const p1OnlyActive = Boolean(eng.players[1]?.headDetected && !eng.players[0]?.headDetected);
        const isOppositeHandedness = Boolean(h0.handedness && h1.handedness && h0.handedness !== h1.handedness);
        // Merge to the same player if only 1 player is in front of camera, or if it's a Left+Right pair within reach
        if (
          p0OnlyActive ||
          p1OnlyActive ||
          pairSpan < 0.56 ||
          (isOppositeHandedness && pairSpan < 0.68 && verticalDiff < 0.35)
        ) {
          let targetPlayer = midX < 0.5 ? 0 : 1;
          if (p0OnlyActive) targetPlayer = 0;
          else if (p1OnlyActive) targetPlayer = 1;
          else if (eng.players[0]?.headDetected && eng.players[1]?.headDetected) {
            const dHead0 = Math.abs(midX - (eng.players[0].headX || 0.25));
            const dHead1 = Math.abs(midX - (eng.players[1].headX || 0.75));
            targetPlayer = dHead0 <= dHead1 ? 0 : 1;
          }
          if (targetPlayer === 0) {
            rawPlayerHands[0].push(rawPlayerHands[1].pop()!);
          } else {
            rawPlayerHands[1].push(rawPlayerHands[0].pop()!);
          }
        }
      }
      [0, 1].forEach(pIdx => {
        rawPlayerHands[pIdx] = rawPlayerHands[pIdx].map(h => {
          const clampedX = pIdx === 0
            ? Math.min(0.492, Math.max(0.025, h.rawX))
            : Math.max(0.508, Math.min(0.975, h.rawX));
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

      const rawHands = rawPlayerHands[pIdx] || [];
      const lh = player.leftHand;
      const rh = player.rightHand;

      // 1. Strictly deduplicate ghost skeletons on the same physical hand
      // (MediaPipe can emit 2 overlapping skeletons on 1 hand with centerDist ~ 0.03-0.065)
      const dedupedHands: any[] = [];
      rawHands
        .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
        .forEach(candidate => {
          const isDuplicateOnSameHand = dedupedHands.some(existing => {
            const centerDist = Math.hypot(candidate.clampedX - existing.clampedX, candidate.clampedY - existing.clampedY);
            const wristDist = Math.hypot(candidate.rawWristX - existing.rawWristX, candidate.rawWristY - existing.rawWristY);
            const sameHandedness = Boolean(candidate.handedness && existing.handedness && candidate.handedness === existing.handedness);
            if (centerDist < 0.062 || wristDist < 0.062) return true;
            if (sameHandedness && (centerDist < 0.095 || wristDist < 0.095)) return true;
            return false;
          });
          if (!isDuplicateOnSameHand) {
            dedupedHands.push(candidate);
          }
        });

      // Keep at most the 2 largest (foreground player) hands so background bystanders never trigger claps
      const handsForPlayer = dedupedHands
        .sort((a, b) => (b.scale || 1) - (a.scale || 1))
        .slice(0, 2);

      if (handsForPlayer.length === 0) {
        if (now - (lh.lastSeenTime || 0) > HAND_GRACE_MS) lh.detected = false;
        if (now - (rh.lastSeenTime || 0) > HAND_GRACE_MS) rh.detected = false;
        if (!lh.detected || !rh.detected) {
          player.isClapping = false;
          player.clapTimer = 0;
        }
        if (now - (player.lastHandTime || 0) > 350) {
          player.hasDetectedHands = false;
          player.dualHandsArmed = false;
          player.clapArmed = false;
          player.peakArmedSep = 0;
          player.isClapping = false;
        }
        return;
      }

      player.hasDetectedHands = true;
      player.lastHandTime = now;

      // Sort left-to-right on screen so left-side hand is leftHand and right-side is rightHand
      handsForPlayer.sort((a, b) => a.clampedX - b.clampedX);

      let fastestHand = handsForPlayer[0];

      if (handsForPlayer.length >= 2) {
        let leftData = handsForPlayer[0];
        let rightData = handsForPlayer[handsForPlayer.length - 1];

        // Prevent vertical clap hand-swap jitter when both hands are at nearly the same X coordinate
        if (lh.detected && rh.detected && Math.abs(rightData.clampedX - leftData.clampedX) < 0.085) {
          const dDirect = Math.hypot(leftData.clampedX - lh.x, leftData.clampedY - lh.y) + Math.hypot(rightData.clampedX - rh.x, rightData.clampedY - rh.y);
          const dSwapped = Math.hypot(rightData.clampedX - lh.x, rightData.clampedY - lh.y) + Math.hypot(leftData.clampedX - rh.x, leftData.clampedY - rh.y);
          if (dSwapped < dDirect) {
            const tmp = leftData;
            leftData = rightData;
            rightData = tmp;
          }
        }

        const sepDist = Math.hypot(rightData.clampedX - leftData.clampedX, rightData.clampedY - leftData.clampedY);
        const wristSep = Math.hypot(rightData.rawWristX - leftData.rawWristX, rightData.rawWristY - leftData.rawWristY);
        const vertDiff = Math.abs(rightData.clampedY - leftData.clampedY);

        // Compute minimum distance between ANY landmarks of Left Hand and Right Hand
        let minLandmarkDist = sepDist;
        if (leftData.landmarks && rightData.landmarks) {
          for (let i = 0; i < leftData.landmarks.length; i++) {
            const lmL = leftData.landmarks[i];
            if (!lmL) continue;
            for (let j = 0; j < rightData.landmarks.length; j++) {
              const lmR = rightData.landmarks[j];
              if (!lmR) continue;
              const dLm = Math.hypot(lmR.x - lmL.x, lmR.y - lmL.y);
              if (dLm < minLandmarkDist) minLandmarkDist = dLm;
            }
          }
        }

        // Update Left Hand
        lh.prevX = lh.detected ? lh.x : leftData.clampedX;
        lh.prevY = lh.detected ? lh.y : leftData.clampedY;
        lh.x = lh.detected ? (lh.x + (leftData.clampedX - lh.x) * 0.88) : leftData.clampedX;
        lh.y = lh.detected ? (lh.y + (leftData.clampedY - lh.y) * 0.88) : leftData.clampedY;
        lh.vx = lh.x - lh.prevX;
        lh.vy = lh.y - lh.prevY;
        lh.speed = Math.hypot(lh.vx, lh.vy);
        lh.angle = leftData.gloveAngle;
        lh.knifeAngle = leftData.pointingAngle;
        lh.scale = lh.detected ? (lh.scale + (leftData.scale - lh.scale) * 0.55) : leftData.scale;
        lh.openness = leftData.openness;
        lh.landmarks = leftData.landmarks;
        lh.detected = true;
        lh.lastSeenTime = now;
        lh.trail.push({ x: lh.x, y: lh.y, life: 1.0 });
        if (lh.trail.length > 16) lh.trail.shift();

        // Update Right Hand
        rh.prevX = rh.detected ? rh.x : rightData.clampedX;
        rh.prevY = rh.detected ? rh.y : rightData.clampedY;
        rh.x = rh.detected ? (rh.x + (rightData.clampedX - rh.x) * 0.88) : rightData.clampedX;
        rh.y = rh.detected ? (rh.y + (rightData.clampedY - rh.y) * 0.88) : rightData.clampedY;
        rh.vx = rh.x - rh.prevX;
        rh.vy = rh.y - rh.prevY;
        rh.speed = Math.hypot(rh.vx, rh.vy);
        rh.angle = rightData.gloveAngle;
        rh.knifeAngle = rightData.pointingAngle;
        rh.scale = rh.detected ? (rh.scale + (rightData.scale - rh.scale) * 0.55) : rightData.scale;
        rh.openness = rightData.openness;
        rh.landmarks = rightData.landmarks;
        rh.detected = true;
        rh.lastSeenTime = now;
        rh.trail.push({ x: rh.x, y: rh.y, life: 1.0 });
        if (rh.trail.length > 16) rh.trail.shift();

        const prevSep = Math.hypot(rh.prevX - lh.prevX, rh.prevY - lh.prevY);
        const closingVel = Math.max(0, prevSep - sepDist);

        // =========================================================================
        // STATE MACHINE STEP 1: ARM CLAP ONLY WHEN TWO HANDS ARE CLEARLY SEPARATED
        // =========================================================================
        if (sepDist >= 0.13 && wristSep >= 0.095 && vertDiff <= 0.24) {
          player.clapArmed = true;
          player.lastArmedTime = now;
          player.peakArmedSep = Math.max(player.peakArmedSep || 0, sepDist);
          player.lastSeparatedHandsTime = now;
        }

        player.dualHandsArmed = true;
        player.lastTrueTwoHandsTime = now;
        player.lastTwoHandSepDist = sepDist;
        player.lastClosingVel = closingVel;

        // =========================================================================
        // STATE MACHINE STEP 2: TRIGGER CLAP ONLY WHEN ARMED HANDS CONVERGE & MEET
        // (Fixed normalized screen thresholds — never inflated by handScale!)
        // =========================================================================
        const isArmedRecently = Boolean(player.clapArmed && (now - (player.lastArmedTime || 0) < 1200));
        const hasConvergedFromOpen = Boolean(
          closingVel >= 0.006 ||
          sepDist <= (player.peakArmedSep || 0.16) * 0.62
        );
        const handsPhysicallyTouching = Boolean(
          vertDiff <= 0.12 &&
          (sepDist <= 0.082 || (minLandmarkDist <= 0.032 && sepDist <= 0.104))
        );

        if (isArmedRecently && hasConvergedFromOpen && handsPhysicallyTouching) {
          player.isClapping = true;
          player.clapTimer = 0.22;
          player.clapArmed = false; // Disarm so holding hands together never re-triggers!
          player.peakArmedSep = 0;
          player.slapAnim = 1.0;
          lh.slapAnim = 1.0;
          rh.slapAnim = 1.0;
          player.clapMidX = (lh.x + rh.x) * 0.5;
          player.clapMidY = (lh.y + rh.y) * 0.5;
        } else if (!player.clapTimer || player.clapTimer <= 0) {
          player.isClapping = false;
        }

        fastestHand = rh.speed >= lh.speed
          ? { ...rightData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y }
          : { ...leftData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y };
      } else {
        // ONLY 1 HAND RETURNED BY MEDIAPIPE IN THIS FRAME:
        // Only bridge a clap if 2 armed hands were ALREADY closing fast at close range (<140ms ago)
        // and converged right onto their previous midpoint!
        const hData = handsForPlayer[0];
        const prevMidX = (lh.x + rh.x) * 0.5;
        const prevMidY = (lh.y + rh.y) * 0.5;
        const distToPrevMid = Math.hypot(hData.clampedX - prevMidX, hData.clampedY - prevMidY);
        const distToLeft = Math.hypot(hData.clampedX - lh.x, hData.clampedY - lh.y);
        const distToRight = Math.hypot(hData.clampedX - rh.x, hData.clampedY - rh.y);

        const justClappedFromTwoHands = Boolean(
          player.clapArmed &&
          (now - (player.lastTrueTwoHandsTime || 0) < 140) &&
          (player.lastTwoHandSepDist || 1) <= 0.125 &&
          (player.lastClosingVel || 0) >= 0.010 &&
          distToPrevMid <= 0.058
        );

        if (justClappedFromTwoHands) {
          player.clapArmed = false;
          player.peakArmedSep = 0;
          lh.prevX = lh.x;
          lh.prevY = lh.y;
          rh.prevX = rh.x;
          rh.prevY = rh.y;
          lh.x = hData.clampedX - 0.015;
          lh.y = hData.clampedY;
          rh.x = hData.clampedX + 0.015;
          rh.y = hData.clampedY;
          lh.vx = lh.x - lh.prevX;
          lh.vy = lh.y - lh.prevY;
          rh.vx = rh.x - rh.prevX;
          rh.vy = rh.y - rh.prevY;
          lh.speed = Math.hypot(lh.vx, lh.vy);
          rh.speed = Math.hypot(rh.vx, rh.vy);
          lh.scale = hData.scale;
          rh.scale = hData.scale;
          lh.openness = hData.openness;
          rh.openness = hData.openness;
          lh.landmarks = hData.landmarks;
          rh.landmarks = hData.landmarks;
          lh.detected = true;
          rh.detected = true;
          lh.slapAnim = 1.0;
          rh.slapAnim = 1.0;

          player.isClapping = true;
          player.clapTimer = 0.22;
          player.slapAnim = 1.0;
          player.swordLunge = 1.0;
          player.clapMidX = hData.clampedX;
          player.clapMidY = hData.clampedY;
          fastestHand = { ...hData, speed: Math.max(0.06, lh.speed, rh.speed), vx: lh.vx, vy: lh.vy, x: hData.clampedX, y: hData.clampedY };
        } else {
          // Strictly 1 physical hand is raised: only 1 glove is active, and NO clap can trigger!
          player.dualHandsArmed = false;
          player.clapArmed = false;
          player.peakArmedSep = 0;
          player.isClapping = false;
          player.clapTimer = 0;

          const courtCenter = is2P ? (pIdx === 0 ? 0.25 : 0.75) : 0.50;
          // MediaPipe 'Right' label on raw unmirrored video corresponds to the user's Left hand on mirrored screen
          let isLeftHand = hData.handedness ? (hData.handedness === 'Right') : (hData.clampedX < courtCenter);
          if (lh.detected && !rh.detected && distToLeft < 0.30) {
            isLeftHand = true;
          } else if (rh.detected && !lh.detected && distToRight < 0.30) {
            isLeftHand = false;
          }

          if (isLeftHand) {
            lh.prevX = lh.detected ? lh.x : hData.clampedX;
            lh.prevY = lh.detected ? lh.y : hData.clampedY;
            lh.x = lh.detected ? (lh.x + (hData.clampedX - lh.x) * 0.88) : hData.clampedX;
            lh.y = lh.detected ? (lh.y + (hData.clampedY - lh.y) * 0.88) : hData.clampedY;
            lh.vx = lh.x - lh.prevX;
            lh.vy = lh.y - lh.prevY;
            lh.speed = Math.hypot(lh.vx, lh.vy);
            lh.angle = hData.gloveAngle;
            lh.knifeAngle = hData.pointingAngle;
            lh.scale = lh.detected ? (lh.scale + (hData.scale - lh.scale) * 0.55) : hData.scale;
            lh.openness = hData.openness;
            lh.landmarks = hData.landmarks;
            lh.detected = true;
            lh.lastSeenTime = now;
            lh.trail.push({ x: lh.x, y: lh.y, life: 1.0 });
            if (lh.trail.length > 16) lh.trail.shift();

            // Keep rightHand scale synced with leftHand so the second glove matches size!
            rh.scale = lh.scale;
            if (now - (rh.lastSeenTime || 0) > HAND_GRACE_MS) {
              rh.detected = false;
              rh.landmarks = null;
            }
            rh.vx = 0;
            rh.vy = 0;
            rh.speed = 0;
            fastestHand = { ...hData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y };
          } else {
            rh.prevX = rh.detected ? rh.x : hData.clampedX;
            rh.prevY = rh.detected ? rh.y : hData.clampedY;
            rh.x = rh.detected ? (rh.x + (hData.clampedX - rh.x) * 0.88) : hData.clampedX;
            rh.y = rh.detected ? (rh.y + (hData.clampedY - rh.y) * 0.88) : hData.clampedY;
            rh.vx = rh.x - rh.prevX;
            rh.vy = rh.y - rh.prevY;
            rh.speed = Math.hypot(rh.vx, rh.vy);
            rh.angle = hData.gloveAngle;
            rh.knifeAngle = hData.pointingAngle;
            rh.scale = rh.detected ? (rh.scale + (hData.scale - rh.scale) * 0.55) : hData.scale;
            rh.openness = hData.openness;
            rh.landmarks = hData.landmarks;
            rh.detected = true;
            rh.lastSeenTime = now;
            rh.trail.push({ x: rh.x, y: rh.y, life: 1.0 });
            if (rh.trail.length > 16) rh.trail.shift();

            // Keep leftHand scale synced with rightHand so the second glove matches size!
            lh.scale = rh.scale;
            if (now - (lh.lastSeenTime || 0) > HAND_GRACE_MS) {
              lh.detected = false;
              lh.landmarks = null;
            }
            lh.vx = 0;
            lh.vy = 0;
            lh.speed = 0;
            fastestHand = { ...hData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y };
          }
        }
      }

      player.handScale = player.handScale + (fastestHand.scale - player.handScale) * 0.5;
      updatePlayerArm(pIdx, fastestHand.x ?? fastestHand.clampedX, fastestHand.y ?? fastestHand.clampedY, fastestHand.pointingAngle, fastestHand.scale);

      // Gentle kinematic head guidance only when visual head tracker hasn't locked recently
      if (now - (player.lastHeadTime || 0) > 650) {
        let targetHeadX = player.homeX;
        if (lh.detected && rh.detected) {
          targetHeadX = (lh.x + rh.x) * 0.5;
        } else if (lh.detected) {
          targetHeadX = lh.x + 0.20;
        } else if (rh.detected) {
          targetHeadX = rh.x - 0.20;
        }
        if (is2P) {
          targetHeadX = pIdx === 0
            ? Math.min(0.41, Math.max(0.09, targetHeadX))
            : Math.max(0.59, Math.min(0.91, targetHeadX));
        } else {
          targetHeadX = Math.max(0.18, Math.min(0.82, targetHeadX));
        }
        player.headX += (targetHeadX - player.headX) * 0.14;
        player.headY += (0.36 - player.headY) * 0.10;
      }
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
        faceCenterNormY = noseTip ? (eyeMidY * 0.50 + noseTip.y * 0.50) : eyeMidY;
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
      const clampedY = Math.max(0.24, Math.min(0.56, canvasY));

      const faceCanvasWidthRatio = (rawW * drawW) / cw;
      const targetScale = Math.max(0.92, Math.min(1.55, faceCanvasWidthRatio * 4.5));

      player.headX += (clampedX - player.headX) * 0.55;
      player.headY += (clampedY - player.headY) * 0.55;
      player.headScale += (targetScale - player.headScale) * 0.42;
      player.headTilt = (player.headTilt || 0) + (headTilt - (player.headTilt || 0)) * 0.45;
      player.headDetected = true;
      player.lastHeadTime = now;
    });
  };

  onFaceResultsRef.current = onFaceDetectionResults;

  // High-Precision Head Tracker (Browser FaceDetector + Dual-Mode Front-Lit & Backlit Portrait Silhouette Tracker)
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
            const rawCenterY = (box.y + box.height * 0.48) / vh;
            const canvasX = toCanvasNormX(rawMirroredX);
            const canvasY = toCanvasNormY(rawCenterY);
            const faceCanvasWidthRatio = ((box.width / vw) * drawW) / cw;

            const pIdx = is2P ? (canvasX < 0.5 ? 0 : 1) : 0;
            const player = eng.players[pIdx];
            if (!player) return;

            if (is2P && canvasX > 0.45 && canvasX < 0.55) return;

            const clampedX = is2P
              ? (pIdx === 0 ? Math.min(0.41, Math.max(0.08, canvasX)) : Math.max(0.59, Math.min(0.92, canvasX)))
              : Math.max(0.12, Math.min(0.88, canvasX));
            const targetY = Math.max(0.24, Math.min(0.54, canvasY));
            const targetScale = Math.max(0.95, Math.min(1.55, faceCanvasWidthRatio * 4.6));

            player.headX += (clampedX - player.headX) * 0.52;
            player.headY += (targetY - player.headY) * 0.52;
            player.headScale += (targetScale - player.headScale) * 0.40;
            player.headDetected = true;
            player.lastHeadTime = now;
          });
          return;
        }
      } catch (e) {}
    }

    // 2. Dual-Mode Portrait Head Tracker on 1:1 Object-Cover Aligned Canvas
    //    Accurately tracks the head in BOTH front-lit rooms AND strongly backlit rooms (silhouette mode)!
    try {
      if (!headTrackCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 96;
        c.height = 54;
        headTrackCanvasRef.current = c;
      }
      const hc = headTrackCanvasRef.current;
      const hctx = hc.getContext('2d', { willReadFrequently: true });
      if (!hctx) return;

      const W = hc.width;
      const H = hc.height;

      // Project video into WxH using the exact same object-cover crop as the main canvas!
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

      const scanZone = (pIdx: number, minXNorm: number, maxXNorm: number) => {
        const player = eng.players[pIdx];
        if (!player) return;

        const startX = Math.floor(minXNorm * W);
        const endX = Math.floor(maxXNorm * W);
        const startY = Math.floor(0.16 * H);
        const endY = Math.floor(0.56 * H);

        const lh = player.leftHand;
        const rh = player.rightHand;

        // Helper to reject pixels belonging to raised hands/arms so hands never pull the headgear
        const isNearTrackedHand = (nx: number, ny: number) => {
          for (const hand of [lh, rh]) {
            if (!hand || !hand.detected) continue;
            if (Math.hypot(nx - hand.x, ny - hand.y) < 0.14) return true;
            if (hand.landmarks && hand.landmarks.length >= 21) {
              const wrist = hand.landmarks[0];
              const midTip = hand.landmarks[12];
              if (wrist && Math.hypot(nx - wrist.x, ny - wrist.y) < 0.12) return true;
              if (midTip && Math.hypot(nx - midTip.x, ny - midTip.y) < 0.12) return true;
              // Also mask forearm directly below wrist
              if (wrist && Math.abs(nx - wrist.x) < 0.10 && ny >= wrist.y && ny <= wrist.y + 0.18) return true;
            }
          }
          return false;
        };

        // Pass 1: Measure average background brightness in the upper zone (outside hands)
        let bgLumaSum = 0;
        let bgCount = 0;
        for (let y = startY; y < Math.floor(0.44 * H); y += 2) {
          for (let x = startX; x < endX; x += 2) {
            const nx = x / W;
            const ny = y / H;
            if (isNearTrackedHand(nx, ny)) continue;
            const idx = (y * W + x) * 4;
            const luma = img[idx] * 0.299 + img[idx + 1] * 0.587 + img[idx + 2] * 0.114;
            bgLumaSum += luma;
            bgCount++;
          }
        }
        const avgZoneLuma = bgCount > 0 ? bgLumaSum / bgCount : 120;

        // Kinematic X prior from body/hands so we prefer the central head column over side clutter
        let priorX = player.headDetected ? player.headX : player.homeX;
        if (lh?.detected && rh?.detected) {
          priorX = (lh.x + rh.x) * 0.5;
        } else if (lh?.detected && !rh?.detected) {
          priorX = Math.min(maxXNorm - 0.10, lh.x + 0.21);
        } else if (rh?.detected && !lh?.detected) {
          priorX = Math.max(minXNorm + 0.10, rh.x - 0.21);
        }

        let sumX = 0;
        let sumY = 0;
        let minHeadX = endX;
        let maxHeadX = startX;
        let totalWeight = 0;

        for (let y = startY; y < endY; y++) {
          const ny = y / H;
          // Bell-curve vertical weight centered around natural face height (ny = 0.35)
          const vertPrior = Math.max(0.25, 1.0 - Math.abs(ny - 0.35) * 2.4);

          for (let x = startX; x < endX; x++) {
            const nx = x / W;
            if (isNearTrackedHand(nx, ny)) continue;

            const idx = (y * W + x) * 4;
            const r = img[idx];
            const g = img[idx + 1];
            const b = img[idx + 2];
            const luma = r * 0.299 + g * 0.587 + b * 0.114;
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);

            // A) Front-lit or shadowed warm skin tone (excludes bright orange shirts where r - b > 115)
            const isWarmSkin = (
              r >= 42 && g >= 28 && b >= 20 &&
              r > g && g >= b - 3 &&
              (r - g) >= 5 && (r - g) <= 75 &&
              (r - b) >= 8 && (r - b) <= 115 &&
              (maxC - minC) >= 10 &&
              luma < 225
            );

            // B) Backlit head silhouette / dark hair & face core against a bright room/window
            const isBacklitHead = (
              avgZoneLuma > 135 &&
              luma >= 14 &&
              luma < avgZoneLuma * 0.64 &&
              Math.abs(nx - priorX) < 0.22
            );

            if (isWarmSkin || isBacklitHead) {
              const horizPrior = Math.max(0.25, 1.0 - Math.abs(nx - priorX) * 1.9);
              const pixelScore = (isWarmSkin ? 1.35 : 1.0) * vertPrior * horizPrior;
              sumX += nx * pixelScore;
              sumY += ny * pixelScore;
              totalWeight += pixelScore;
              if (x < minHeadX) minHeadX = x;
              if (x > maxHeadX) maxHeadX = x;
            }
          }
        }

        if (totalWeight > 12) {
          const cx = sumX / totalWeight;
          const cy = sumY / totalWeight;
          const spanX = Math.max(0.14, Math.min(0.34, (maxHeadX - minHeadX) / W));

          const clampedX = is2P
            ? (pIdx === 0 ? Math.min(0.41, Math.max(0.09, cx)) : Math.max(0.59, Math.min(0.91, cx)))
            : Math.max(0.14, Math.min(0.86, cx));
          const clampedY = Math.max(0.28, Math.min(0.48, cy));
          const targetScale = Math.max(0.95, Math.min(1.42, spanX * 4.2));

          player.headX += (clampedX - player.headX) * 0.42;
          player.headY += (clampedY - player.headY) * 0.42;
          player.headScale += (targetScale - player.headScale) * 0.28;
          player.headDetected = true;
          player.lastHeadTime = now;
        }
      };

      if (is2P) {
        scanZone(0, 0.04, 0.46);
        scanZone(1, 0.54, 0.96);
      } else {
        scanZone(0, 0.12, 0.88);
      }
    } catch (e) {}
  };

  // Setup camera & initialize MediaPipe Hands & Head Tracking (Always acquire live camera stream first!)
  const setupCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera API not supported; playing in 3D AR Virtual Mode!");
      return;
    }
    try {
      const win = window as any;
      cameraLoopActiveRef.current = false;

      // 1. Always acquire or reuse the live webcam stream FIRST so camera never goes missing!
      let stream = videoRef.current?.srcObject as MediaStream | null;
      const hasLiveTrack = stream && stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);

      if (!hasLiveTrack) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
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

      // 2. Initialize Native Browser FaceDetector if supported (zero WASM conflict with MediaPipe Hands)
      if ('FaceDetector' in win && !faceDetectorRef.current) {
        try {
          faceDetectorRef.current = new win.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        } catch (e) {
          faceDetectorRef.current = null;
        }
      }

      // 3. Initialize or reuse MediaPipe Hands (balanced confidence to detect both hands even in backlit rooms)
      const ensureHandsInitialized = () => {
        if (!handsRef.current && win.Hands) {
          try {
            const hands = new win.Hands({
              locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            hands.setOptions({
              maxNumHands: 4,
              modelComplexity: 1,
              minDetectionConfidence: 0.45,
              minTrackingConfidence: 0.42
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
        }
      };

      ensureHandsInitialized();

      // 4. Start 60fps Camera & Hand/Head Tracking Loop
      cameraLoopActiveRef.current = true;
      cameraProcessingRef.current = false;
      let lastFrameTime = 0;
      let frameCount = 0;
      const TARGET_INTERVAL_MS = 22;

      const sendCameraFrames = async (time: number) => {
        if (!cameraLoopActiveRef.current || !videoRef.current) return;
        if (videoRef.current.paused && videoRef.current.srcObject) {
          videoRef.current.play().catch(() => {});
        }
        if (
          videoRef.current.readyState >= 2 &&
          !cameraProcessingRef.current &&
          time - lastFrameTime >= TARGET_INTERVAL_MS
        ) {
          cameraProcessingRef.current = true;
          lastFrameTime = time;
          frameCount++;
          try {
            if (frameCount % 2 === 0) {
              await trackHeadsFromVideoFrame(videoRef.current);
            }
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

  // Switch between Slap Mode, Chop Mode, and Combo Mix immediately (works in both Setup and Live Game)
  const changeCombatMode = (nextMode: 'mosquito' | 'chop' | 'combo') => {
    setGameMode(nextMode);
    gameModeRef.current = nextMode;

    const currentIdx = engineRef.current.qIndex || 0;
    const targetRoundMode: 'mosquito' | 'chop' =
      nextMode === 'combo'
        ? (currentIdx % 2 === 0 ? 'mosquito' : 'chop')
        : nextMode;

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

    const chosenMode = gameModeRef.current || gameMode;
    const roundM: 'mosquito' | 'chop' = chosenMode === 'combo' ? 'mosquito' : chosenMode;
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
    setTimerPct(100);
    setHudTimeLeft(initialPlaySeconds);
    lastHudSecRef.current = initialPlaySeconds;
    setScreen('loading');

    try {
      await setupCamera();
    } catch (e) {}

    setTimeout(() => {
      setScreen('game');
      const liveRoundMode = gameModeRef.current === 'combo' ? 'mosquito' : gameModeRef.current;
      engineRef.current.roundMode = liveRoundMode;
      engineRef.current.resolved = false;
      setActiveRoundMode(liveRoundMode);
      activeRoundModeRef.current = liveRoundMode;
      spawnRoundTargets(0, liveRoundMode);
      if (activeQuestions[0]) {
        speakText(activeQuestions[0].text);
      }
    }, 380);
  };

  // Clear 3-second inter-question countdown timer
  const clearNextQuestionTimer = () => {
    if (nextQTimerRef.current) {
      window.clearInterval(nextQTimerRef.current);
      nextQTimerRef.current = null;
    }
    setNextQCountdown(null);
  };

  // 3-Second Countdown Timer before the next question appears
  const startNextQuestionCountdown = () => {
    clearNextQuestionTimer();
    stopMosquitoBuzz();
    // Clear remaining options from the arena so players see the 3-second countdown clearly
    engineRef.current.targets = [];

    let remaining = 3;
    setNextQCountdown(remaining);
    playSoundEffect('countdown');

    nextQTimerRef.current = window.setInterval(() => {
      if (!engineRef.current.isActive) {
        clearNextQuestionTimer();
        return;
      }
      // Pause countdown if Settings Modal is open
      if (showSettingsModalRef.current) return;

      remaining -= 1;
      if (remaining > 0) {
        setNextQCountdown(remaining);
        playSoundEffect('countdown');
      } else {
        clearNextQuestionTimer();
        if (!engineRef.current.isActive) return;
        if (engineRef.current.timer <= 0) {
          finishGame();
          return;
        }
        const totalQs = engineRef.current.questions.length;
        if (totalQs === 0) {
          finishGame();
          return;
        }
        const nextIdx = (engineRef.current.qIndex + 1) % totalQs;
        engineRef.current.qIndex = nextIdx;
        engineRef.current.resolved = false;
        setCurrentQIndex(nextIdx);
        const curModeSetting = gameModeRef.current || gameMode;
        const nextRoundMode: 'mosquito' | 'chop' =
          curModeSetting === 'combo'
            ? (nextIdx % 2 === 0 ? 'mosquito' : 'chop')
            : curModeSetting;
        engineRef.current.roundMode = nextRoundMode;
        setActiveRoundMode(nextRoundMode);
        activeRoundModeRef.current = nextRoundMode;
        spawnRoundTargets(nextIdx, nextRoundMode);
        if (engineRef.current.questions[nextIdx]) {
          speakText(engineRef.current.questions[nextIdx].text);
        }
      }
    }, 1000);
  };

  // Target spawning:
  // - In Mosquito Mode: Mosquitoes spawn in the arena and actively fly around!
  // - In Chop Mode: Fruits launch FROM BELOW the bottom of the screen and rise UPWARD in an arc!
  const spawnRoundTargets = (qIdx: number, mode: 'mosquito' | 'chop') => {
    const qObj = engineRef.current.questions[qIdx];
    if (!qObj) return;

    // CRITICAL FIX: Always reset resolved = false when spawning a new round so Q2+ can be slapped/sliced!
    engineRef.current.resolved = false;

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
        // 1 Player CHOP MODE: 4 distinct horizontal lanes launching UPWARD from below the bottom of the screen!
        const laneXs = [width * 0.20, width * 0.40, width * 0.60, width * 0.80];
        opts.forEach((optText, i) => {
          const homeX = laneXs[i % laneXs.length];
          const startX = homeX + (Math.random() - 0.5) * 20;
          const startY = height + 40 + (i % 2) * 34;
          const upVy = -(9.8 + (i % 2) * 0.85) * Math.sqrt(curSpd);
          const sideVx = (Math.random() - 0.5) * 1.1 * curSpd;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'all',
            homeX,
            x: startX,
            y: startY,
            vx: sideVx,
            vy: upVy,
            gravity: 0.135 * curSpd,
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
        // 1 Player MOSQUITO MODE: 4 distinct quadrant zones with active flying velocities around the arena!
        const quadrantAnchors = [
          { x: width * 0.26, y: height * 0.38 }, // A (Top Left)
          { x: width * 0.74, y: height * 0.38 }, // B (Top Right)
          { x: width * 0.26, y: height * 0.68 }, // C (Bottom Left)
          { x: width * 0.74, y: height * 0.68 }, // D (Bottom Right)
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

        opts.forEach((optText, i) => {
          const homeX = p1Lanes[i % p1Lanes.length];
          const startY = height + 40 + (i % 2) * 36;
          const upVy = -(9.7 + (i % 2) * 0.85) * Math.sqrt(curSpd);

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p1',
            homeX,
            x: homeX + (Math.random() - 0.5) * 12,
            y: startY,
            vx: (Math.random() - 0.5) * 0.9 * curSpd,
            vy: upVy,
            gravity: 0.135 * curSpd,
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
          const upVy = -(9.7 + (i % 2) * 0.85) * Math.sqrt(curSpd);

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p2',
            homeX,
            x: homeX + (Math.random() - 0.5) * 12,
            y: startY,
            vx: (Math.random() - 0.5) * 0.9 * curSpd,
            vy: upVy,
            gravity: 0.135 * curSpd,
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
        const p1Quadrants = [
          { x: width * 0.15, y: height * 0.38 }, // A
          { x: width * 0.36, y: height * 0.38 }, // B
          { x: width * 0.15, y: height * 0.68 }, // C
          { x: width * 0.36, y: height * 0.68 }, // D
        ];

        const p2Quadrants = [
          { x: width * 0.64, y: height * 0.38 }, // A
          { x: width * 0.85, y: height * 0.38 }, // B
          { x: width * 0.64, y: height * 0.68 }, // C
          { x: width * 0.85, y: height * 0.68 }, // D
        ];

        opts.forEach((optText, i) => {
          const anchor = p1Quadrants[i % p1Quadrants.length];
          const colX = anchor.x + (Math.random() - 0.5) * 20;
          const rowY = anchor.y + (Math.random() - 0.5) * 18;
          const angle = (i * Math.PI * 0.5) + 0.35 + (Math.random() - 0.5) * 0.5;
          const baseSpeed = 2.0 * curSpd;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
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

    engineRef.current.targets = targets;
  };

  // Handle interaction hit (Mosquito Slap or Hand-Blade Fruit Slice)
  // Pointing System: +5 Points if Correct, -5 Points & FROZEN if Wrong!
  const handleTargetHit = (playerIdx: number, target: any, sliceAngle: number = -0.35) => {
    if (engineRef.current.resolved || !target.alive || target.frozen) return;
    const eng = engineRef.current;
    const p = eng.players[playerIdx];
    if (!p) return;

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
      color: target.isCorrect ? (target.color?.main || '#10b981') : '#38bdf8',
      life: 1.0,
      radius: eng.roundMode === 'chop' ? 128 : 96,
      isChop: eng.roundMode === 'chop'
    });

    if (target.isCorrect) {
      eng.resolved = true;
      target.alive = false;
      eng.screenShake = 14;
      stopMosquitoBuzz();

      p.hits++;
      p.correctHits = (p.correctHits || 0) + 1;
      const addedPoints = 5;
      p.score += addedPoints;
      p.streak = Math.min(10, p.streak + 1);
      p.frozenTimer = 0;

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('correct'), 85);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudFrozen([false, false]);
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = `+5 PTS! 🎉`;
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1300);

      // Juicy Particle Bursts
      spawnBurstParticles(target.x, target.y, target.color.main, 42);
      spawnBurstParticles(target.x, target.y, '#ffffff', 18);
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

      const teamPrefix = eng.numPlayers === 2 ? `${playerIdx === 0 ? p1Name : p2Name}: ` : '';
      spawnFloatingText(
        target.x,
        target.y - 24,
        `${teamPrefix}${eng.roundMode === 'chop' ? '🖐️✨ SLICED!' : '👏 SLAPPED!'} +5 PTS`,
        '#10b981'
      );

      // Start the 3-second countdown timer before the next question appears
      startNextQuestionCountdown();

    } else {
      // WRONG WORD HIT -> -5 POINTS & FREEZE THAT OPTION IN 3D ICE!
      p.streak = 1;
      p.wrongHits = (p.wrongHits || 0) + 1;
      p.score -= 5;
      p.frozenTimer = 0.55; // Brief visual frost flash — never locks player from slapping/slicing remaining options
      eng.screenShake = 9;

      // Freeze the incorrect word in a 3D Ice Block!
      target.frozen = true;
      target.frozenTimer = 4.8;
      target.vx = 0;
      target.vy = 0;
      target.cooldown = 120;

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('freeze'), 55);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudFrozen([eng.players[0].frozenTimer > 0, eng.players[1].frozenTimer > 0]);
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = `-5 PTS! ❄️`;
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1300);

      spawnFloatingText(target.x, target.y - 24, `❄️ FROZEN! -5 PTS`, '#0284c7');
      spawnBurstParticles(target.x, target.y, '#38bdf8', 24);
      spawnBurstParticles(target.x, target.y, '#e0f2fe', 16);
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

  // Helper: Shortest distance from a segment [v, w] to the full Mosquito/Fruit + 3D Option Card bounding box!
  const distToTargetOrOptionCard = (
    t: any,
    v: { x: number; y: number },
    w: { x: number; y: number }
  ) => {
    const halfCardW = Math.max(84, (t.cardW || 195) * 0.56);
    const minX = t.x - halfCardW;
    const maxX = t.x + halfCardW;
    const minY = t.y - 52;
    const maxY = t.y + 94;

    // Sample points along segment [v, w] against the combined target + option card box
    let minDist = 99999;
    const steps = 5;
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
  // - In Mosquito Slap Mode: ONLY triggers when the player's TWO GLOVES / HANDS MEET (clap together) over a mosquito!
  //   Moving a single hand or keeping two hands separated will NEVER accidentally trigger a mosquito selection!
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
    if (!p) return;

    const now = performance.now();
    const pointerActive = !p.hasDetectedHands && (now - (p.lastPointerTime || 0) < 2500);

    const showLeft = p.hasDetectedHands ? Boolean(p.leftHand?.detected) : pointerActive;
    const showRight = p.hasDetectedHands ? Boolean(p.rightHand?.detected) : pointerActive;
    if (!showLeft && !showRight) return;

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
    // MOSQUITO SLAP MODE: SELECTION TRIGGERS ONLY WHEN TWO GLOVES / HANDS MEET!
    // =========================================================================
    if (eng.roundMode === 'mosquito') {
      const isTwoGlovesMeeting = Boolean(p.isClapping || (p.clapTimer && p.clapTimer > 0));

      // Do NOT select any mosquito unless the two gloves/hands actually clapped together!
      if (!isTwoGlovesMeeting) return;

      // Debounce so a single clap only triggers one selection
      if (now - (p.lastSlapSelectTime || 0) < 420) return;

      const clapX = (p.clapMidX !== undefined)
        ? p.clapMidX * cw
        : (lx + rx) * 0.5;
      const clapY = (p.clapMidY !== undefined)
        ? p.clapMidY * ch
        : (ly + ry) * 0.5;

      let bestTarget: any = null;
      let bestDist = 99999;

      for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
        const t = eng.targets[tIdx];
        if (!t.alive || t.frozen || t.cooldown > 0) continue;
        if (eng.numPlayers === 2) {
          if (pIdx === 0 && t.team === 'p2') continue;
          if (pIdx === 1 && t.team === 'p1') continue;
        }

        // Measure distance strictly from the meeting point of the two clapped gloves to the mosquito / option card
        const dClap = distToTargetOrOptionCard(
          t,
          { x: clapX, y: clapY - 38 },
          { x: clapX, y: clapY + 24 }
        );

        const slapHitRadius = (t.radius || 56) + 46;
        if (dClap <= slapHitRadius && dClap < bestDist) {
          bestDist = dClap;
          bestTarget = t;
        }
      }

      if (bestTarget) {
        p.lastSlapSelectTime = now;
        p.isClapping = false;
        p.clapTimer = 0;
        p.clapArmed = false;
        p.peakArmedSep = 0;
        p.slapAnim = 1.0;
        p.swordLunge = 1.0;
        if (p.leftHand) p.leftHand.slapAnim = 1.0;
        if (p.rightHand) p.rightHand.slapAnim = 1.0;
        handleTargetHit(pIdx, bestTarget, 0);
      }
      return;
    }

    // =========================================================================
    // CHOP MODE: SLICING RISING FRUITS
    // =========================================================================
    const leftMovePx = Math.hypot(lx - prevLx, ly - prevLy);
    const rightMovePx = Math.hypot(rx - prevRx, ry - prevRy);
    const isMouseClick = Boolean(p.clapTimer && p.clapTimer > 0);

    for (let tIdx = 0; tIdx < eng.targets.length; tIdx++) {
      if (eng.resolved) break;
      const t = eng.targets[tIdx];
      if (!t.alive || t.frozen || t.cooldown > 0) continue;
      if (eng.numPlayers === 2) {
        if (pIdx === 0 && t.team === 'p2') continue;
        if (pIdx === 1 && t.team === 'p1') continue;
      }

      const hitRadiusL = t.radius + 64 * leftScale;
      const hitRadiusR = t.radius + 64 * rightScale;

      let dLeft = showLeft ? distToTargetOrOptionCard(t, { x: prevLx, y: prevLy }, { x: lx, y: ly }) : 99999;
      for (let k = 0; k < leftPts.length; k++) {
        const dPt = distToTargetOrOptionCard(t, leftPts[k], leftPts[k]);
        if (dPt < dLeft) dLeft = dPt;
      }

      let dRight = showRight ? distToTargetOrOptionCard(t, { x: prevRx, y: prevRy }, { x: rx, y: ry }) : 99999;
      for (let k = 0; k < rightPts.length; k++) {
        const dPt = distToTargetOrOptionCard(t, rightPts[k], rightPts[k]);
        if (dPt < dRight) dRight = dPt;
      }

      const leftHit = showLeft && dLeft < hitRadiusL && (isMouseClick || leftMovePx > 2.2);
      const rightHit = showRight && dRight < hitRadiusR && (isMouseClick || rightMovePx > 2.2);

      if (leftHit || rightHit) {
        const sliceAng = leftHit
          ? (leftMovePx > 2 ? Math.atan2(ly - prevLy, lx - prevLx) : -0.42)
          : (rightMovePx > 2 ? Math.atan2(ry - prevRy, rx - prevRx) : -2.72);
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

    const p = eng.players[playerIdx];
    if (p && !p.hasDetectedHands) {
      p.lastPointerTime = performance.now();
      const isPressed = (e.buttons & 1) === 1 || (p.clapTimer && p.clapTimer > 0);
      const spread = isPressed ? 0.008 : 0.056;
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

    // Bring Left and Right Gloves/Knives together to clap/chop at the click point!
    p.lastPointerTime = performance.now();
    p.clapTimer = 0.28;
    p.isClapping = true;
    p.slapAnim = 1.0;
    p.swordLunge = 1.0;
    p.leftHand.slapAnim = 1.0;
    p.rightHand.slapAnim = 1.0;
    p.clapMidX = clampedX;
    p.clapMidY = rawY;

    p.leftHand.prevX = p.leftHand.x;
    p.leftHand.prevY = p.leftHand.y;
    p.rightHand.prevX = p.rightHand.x;
    p.rightHand.prevY = p.rightHand.y;
    p.leftHand.x = clampedX - 0.008;
    p.leftHand.y = rawY;
    p.rightHand.x = clampedX + 0.008;
    p.rightHand.y = rawY;

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
          setTimerPct((eng.timer / Math.max(1, eng.maxTimer)) * 100);
          const ceilSec = Math.ceil(eng.timer);
          if (ceilSec !== lastHudSecRef.current) {
            lastHudSecRef.current = ceilSec;
            setHudTimeLeft(ceilSec);
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

        // 1. Draw Live Camera Feed with exact object-cover aspect ratio so hand tracking is 1:1 aligned
        ctx.clearRect(-20, -20, cw + 40, ch + 40);
        const hasCameraStream = Boolean(videoRef.current && videoRef.current.srcObject);
        if (hasCameraStream && videoRef.current) {
          if (videoRef.current.readyState >= 2) {
            const vw = videoRef.current.videoWidth || 640;
            const vh = videoRef.current.videoHeight || 480;
            const coverScale = Math.max(cw / vw, ch / vh);
            const drawW = vw * coverScale;
            const drawH = vh * coverScale;
            const offsetX = (cw - drawW) / 2;
            const offsetY = (ch - drawH) / 2;

            ctx.save();
            ctx.translate(cw, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, offsetX, offsetY, drawW, drawH);
            ctx.restore();
          }
        } else {
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

          // Core bright dashed boundary line
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 3.5;
          ctx.setLineDash([16, 10]);
          ctx.beginPath();
          ctx.moveTo(cx, 0);
          ctx.lineTo(cx, ch);
          ctx.stroke();
          ctx.setLineDash([]);

          // Light 3D Court Zone Badges at bottom of the divider
          const bW = 144;
          const bH = 30;
          const badgeY = ch - 68;
          // Player 1 Zone Pill (Left - Bright White & Purple)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.strokeStyle = '#8b5cf6';
          ctx.lineWidth = 3;
          roundRect(ctx, cx - bW - 14, badgeY, bW, bH, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#5b21b6';
          ctx.font = '900 12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🟣 P1 COURT ZONE', cx - bW / 2 - 14, badgeY + bH / 2);

          // Player 2 Zone Pill (Right - Bright White & Rose)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 3;
          roundRect(ctx, cx + 14, badgeY, bW, bH, 12);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#be123c';
          ctx.font = '900 12px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🔴 P2 COURT ZONE', cx + bW / 2 + 14, badgeY + bH / 2);

          ctx.restore();
        }

        // 2. Draw Player Headgear (Mosquito Net Headgear covering user's face in Slap Mode; Chef Hat in Chop Mode)
        if (showHeadgear) {
          eng.players.forEach((p, idx) => {
            if (idx === 1 && eng.numPlayers === 1) return;
            if (eng.roundMode === 'mosquito') {
              drawPurpleMosquitoNetHat(ctx, p, cw, ch);
            } else {
              draw3DChefHat(ctx, p, cw, ch);
            }
          });
        }

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
        const mvStyle = movementStyleRef.current;
        const moveMult = mvStyle === 'hover' ? 0.45 : mvStyle === 'calm' ? 0.78 : mvStyle === 'zigzag' ? 1.32 : 1.05;
        const padTop = 152;
        const padBottom = 88;
        const is2P = eng.numPlayers === 2;
        const curSpd = speedRef.current || 1.0;

        eng.targets.forEach(t => {
          if (t.cooldown > 0) t.cooldown--;
          if (!t.alive) return;

          if (t.frozenTimer > 0) {
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
                t.y = ch + 46;
                t.x = (t.homeX || t.x) + (Math.random() - 0.5) * 24;
                t.vy = -(9.6 + Math.random() * 1.15) * Math.sqrt(curSpd);
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

            if (t.y < padTop + 24) { t.y = padTop + 24; t.vy = Math.abs(t.vy); }
            if (t.y > ch - padBottom - 18) { t.y = ch - padBottom - 18; t.vy = -Math.abs(t.vy); }
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

        // Draw all active targets
        eng.targets.forEach(t => {
          if (!t.alive) return;
          let isTargeted = false;
          const targetedBy: [boolean, boolean] = [false, false];

          eng.players.forEach((p, pIdx) => {
            if (pIdx === 1 && eng.numPlayers === 1) return;
            if (eng.numPlayers === 2 && ((pIdx === 0 && t.team === 'p2') || (pIdx === 1 && t.team === 'p1'))) return;
            if (p.frozenTimer > 0) return;

            const pointerActive = !p.hasDetectedHands && (now - (p.lastPointerTime || 0) < 2500);
            const showL = p.hasDetectedHands ? Boolean(p.leftHand?.detected) : pointerActive;
            const showR = p.hasDetectedHands ? Boolean(p.rightHand?.detected) : pointerActive;
            const lScale = Math.max(0.65, p.leftHand?.scale || p.handScale || 1.0);
            const rScale = Math.max(0.65, p.rightHand?.scale || p.handScale || 1.0);

            const lx = (p.leftHand?.x ?? (p.handX - 0.056)) * cw;
            const ly = (p.leftHand?.y ?? p.handY) * ch;
            const rx = (p.rightHand?.x ?? (p.handX + 0.056)) * cw;
            const ry = (p.rightHand?.y ?? p.handY) * ch;
            const midX = (lx + rx) * 0.5;
            const midY = (ly + ry) * 0.5;

            const dL = showL ? distToTargetOrOptionCard(t, { x: lx, y: ly - 58 * lScale }, { x: lx, y: ly + 38 * lScale }) : 9999;
            const dR = showR ? distToTargetOrOptionCard(t, { x: rx, y: ry - 58 * rScale }, { x: rx, y: ry + 38 * rScale }) : 9999;
            const dMid = (showL && showR) ? distToTargetOrOptionCard(t, { x: midX, y: midY - 35 }, { x: midX, y: midY + 25 }) : 9999;
            const dSpan = (showL && showR) ? distToTargetOrOptionCard(t, { x: lx, y: ly - 18 }, { x: rx, y: ry - 18 }) : 9999;

            if (dL < 110 || dR < 110 || dMid < 135 || dSpan < 100) {
              isTargeted = true;
              targetedBy[pIdx] = true;
            }
          });

          t.isTargeted = isTargeted;
          t.targetedBy = targetedBy;
          t.slapCharge = 0;

          if (eng.roundMode === 'mosquito') {
            drawMosquitoTarget(ctx, t, now);
          } else {
            drawFruitTarget(ctx, t, now);
          }
        });

        // Sync Live Left/Right Hand Sensor Indicators to HUD without extra re-renders
        const p0L = Boolean(eng.players[0]?.leftHand?.detected);
        const p0R = Boolean(eng.players[0]?.rightHand?.detected);
        const p1L = Boolean(eng.players[1]?.leftHand?.detected);
        const p1R = Boolean(eng.players[1]?.rightHand?.detected);
        const handsSig = `${p0L ? 1 : 0}${p0R ? 1 : 0}${p1L ? 1 : 0}${p1R ? 1 : 0}`;
        if (handsSig !== lastHudHandsRef.current) {
          lastHudHandsRef.current = handsSig;
          setHudHandsDetected([[p0L, p0R], [p1L, p1R]]);
        }

        // 5. Draw Tracked 3D Slap Gloves (in Mosquito Mode) & 3D Chopping Knives (in Chop Mode)
        eng.players.forEach((p, idx) => {
          if (idx === 1 && eng.numPlayers === 1) return;
          p.slapAnim = Math.max(0, p.slapAnim - dt * 3.8);
          p.swordLunge = Math.max(0, p.swordLunge - dt * 3.2);
          if (p.leftHand) p.leftHand.slapAnim = Math.max(0, (p.leftHand.slapAnim || 0) - dt * 3.8);
          if (p.rightHand) p.rightHand.slapAnim = Math.max(0, (p.rightHand.slapAnim || 0) - dt * 3.8);
          if (p.frozenTimer > 0) {
            p.frozenTimer = Math.max(0, p.frozenTimer - dt);
            if (p.frozenTimer === 0) {
              setHudFrozen([
                (eng.players[0]?.frozenTimer || 0) > 0,
                (eng.players[1]?.frozenTimer || 0) > 0
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
          const showLeft = p.hasDetectedHands ? Boolean(p.leftHand?.detected) : pointerActive;
          const showRight = p.hasDetectedHands ? Boolean(p.rightHand?.detected) : pointerActive;

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

          const lx = (p.leftHand?.x ?? readyLx) * cw;
          const ly = (p.leftHand?.y ?? readyY) * ch + (showLeft ? 0 : Math.sin(now * 0.004) * 5);
          const rx = (p.rightHand?.x ?? readyRx) * cw;
          const ry = (p.rightHand?.y ?? readyY) * ch + (showRight ? 0 : Math.cos(now * 0.004) * 5);

          // Share scale & reference landmarks between hands so if only 1 hand is raised, the second glove matches its size!
          const sharedScale = showLeft && showRight
            ? Math.max(p.leftHand?.scale || 1.35, p.rightHand?.scale || 1.35)
            : showLeft
              ? (p.leftHand?.scale || 1.35)
              : showRight
                ? (p.rightHand?.scale || 1.35)
                : 1.35;
          const leftRefLandmarks = showLeft ? p.leftHand?.landmarks : (showRight ? p.rightHand?.landmarks : undefined);
          const rightRefLandmarks = showRight ? p.rightHand?.landmarks : (showLeft ? p.leftHand?.landmarks : undefined);

          const isTouching = Boolean(p.isClapping || (p.clapTimer && p.clapTimer > 0));

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
            // ALWAYS Draw BOTH Left & Right 3D Cartoon Slap Gloves so neither glove is ever missing!
            drawSingleCartoonGlove(
              ctx,
              lx,
              ly,
              showLeft ? (p.leftHand?.angle ?? -0.18) : -0.16,
              showLeft ? (p.leftHand?.scale || sharedScale) : sharedScale,
              false,
              p.theme,
              Math.max(p.slapAnim || 0, p.leftHand?.slapAnim || 0),
              showLeft ? (p.leftHand?.openness || 1.0) : 1.0,
              p.frozenTimer > 0,
              leftRefLandmarks || undefined,
              cw,
              ch
            );

            drawSingleCartoonGlove(
              ctx,
              rx,
              ry,
              showRight ? (p.rightHand?.angle ?? 0.18) : 0.16,
              showRight ? (p.rightHand?.scale || sharedScale) : sharedScale,
              true,
              p.theme,
              Math.max(p.slapAnim || 0, p.rightHand?.slapAnim || 0),
              showRight ? (p.rightHand?.openness || 1.0) : 1.0,
              p.frozenTimer > 0,
              rightRefLandmarks || undefined,
              cw,
              ch
            );

            // When the two gloves clap together, draw a bright golden "CLAP!" shockwave ring at the meeting point
            if (isTouching) {
              const cx = ((p.clapMidX ?? ((lx + rx) * 0.5 / cw))) * cw;
              const cy = ((p.clapMidY ?? ((ly + ry) * 0.5 / ch))) * ch;
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

          // Continuous per-frame collision check
          if (!showSettingsModalRef.current && (showLeft || showRight)) {
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

        // 7. Floating 3D Feedback Texts
        for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
          const ft = eng.floatingTexts[i];
          ft.y -= 1.8;
          ft.life -= dt * 0.92;
          if (ft.life <= 0) {
            eng.floatingTexts.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = ft.life;
          const popScale = 1 + Math.sin((1 - ft.life) * Math.PI) * 0.22;
          ctx.translate(ft.x, ft.y);
          ctx.scale(popScale, popScale);
          ctx.font = '900 24px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0,0,0,0.75)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 4;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 6;
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

  // Mosquito Net Headgear Covering the User's Face (Centered on Face Center `(headX, headY)` so Visor Covers Eyes/Nose/Mouth!)
  const drawPurpleMosquitoNetHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.88, Math.min(1.52, cw / 900)) * (p.headScale || 1.08);

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);
    // Shift local coordinates up by 74 units so (0, 0) is the center of the player's face inside the visor!
    ctx.translate(0, -74);

    // 1. FULL-FACE FROSTED WHITE MOSQUITO NET VISOR (Matches Reference Photo: Clean Translucent White Cylinder Over Face)
    const veilTopY = -24;
    const veilBottomY = 178;
    const veilTopHalfW = 132;
    const veilBotHalfW = 122;

    // Translucent Frosted White Screen Body with Side Highlights
    const veilGrad = ctx.createLinearGradient(-veilTopHalfW, 0, veilTopHalfW, 0);
    veilGrad.addColorStop(0, 'rgba(255, 255, 255, 0.56)');
    veilGrad.addColorStop(0.14, 'rgba(255, 255, 255, 0.34)');
    veilGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
    veilGrad.addColorStop(0.86, 'rgba(255, 255, 255, 0.34)');
    veilGrad.addColorStop(1, 'rgba(255, 255, 255, 0.56)');

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
    for (let x = -120; x <= 120; x += 22) {
      ctx.moveTo(x, veilTopY - 6);
      ctx.lineTo(x * 0.94, veilBottomY + 18);
    }
    for (let y = veilTopY + 14; y <= veilBottomY + 10; y += 22) {
      ctx.moveTo(-132, y);
      ctx.quadraticCurveTo(0, y + 8, 132, y);
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
    ctx.moveTo(-152, -24);
    ctx.quadraticCurveTo(0, -68, 152, -24);
    ctx.quadraticCurveTo(158, -12, 136, -14);
    ctx.quadraticCurveTo(0, -44, -136, -14);
    ctx.quadraticCurveTo(-158, -12, -152, -24);
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

  // 3D Volumetric Puffy Chef's Hat (Toque Blanche) for Chop Mode — sits cleanly on top of the player's forehead!
  const draw3DChefHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.75, Math.min(1.45, cw / 950)) * (p.headScale || 1.0);
    const th = p.theme;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);
    ctx.translate(0, -64);

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

  // Sleek Cartoon Side-Profile Slap Glove (Matches Reference Image `/public/assets/aistudio/image_b9f250b0.png` 1:1 & Scales to Cover Real Hand!)
  // Features: Gathered upright fingers with 3 rounded tips, 2 dark interior finger crease lines,
  // vibrant purple body with outer highlight & inner shadow, and a puffy horizontal wrist cuff roll!
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
    const mainColor = isFrozen ? '#38bdf8' : (th?.isP2 ? '#fb7185' : '#6842ff');
    const highlightColor = isFrozen ? '#bae6fd' : (th?.isP2 ? '#fda4af' : '#8c6eff');
    const shadowColor = isFrozen ? '#0284c7' : (th?.isP2 ? '#e11d48' : '#4e28d4');
    const outlineColor = isFrozen ? '#0c4a6e' : '#230b42';

    // Keep glove upright in natural inward-tilted clap pose (matching reference photo)
    const defaultTilt = isRightHand ? -0.20 : 0.20;
    let normalizedTilt = defaultTilt;
    if (Number.isFinite(angle)) {
      const wrapped = Math.atan2(Math.sin(angle), Math.cos(angle));
      normalizedTilt = defaultTilt + Math.max(-0.30, Math.min(0.30, wrapped * 0.25));
    }

    // Dynamically size the cartoon glove to cover the player's real hand on screen!
    // Local glove height is ~132 units (y = -68 to +65).
    const minResponsiveScale = Math.max(1.75, (cw / 920) * 1.95);
    let computedScale = Math.max(minResponsiveScale, minResponsiveScale * (0.85 + (scale - 1.0) * 0.45));

    if (landmarks && landmarks.length >= 21) {
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        if (!lm) continue;
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }
      const bboxW = (maxX - minX) * cw;
      const bboxH = (maxY - minY) * ch;
      const wrist = landmarks[0];
      const midTip = landmarks[12];
      const wristToTipPx = (wrist && midTip)
        ? Math.hypot((midTip.x - wrist.x) * cw, (midTip.y - wrist.y) * ch)
        : bboxH;
      const realHandPx = Math.max(wristToTipPx * 1.24, Math.hypot(bboxW, bboxH) * 0.92);
      computedScale = Math.max(minResponsiveScale, Math.min(3.35, realHandPx / 120));
    }

    const finalScale = computedScale * (1 + slapBoost * 0.14);

    ctx.save();
    ctx.translate(gx + offsetDx, gy + offsetDy);
    ctx.rotate(normalizedTilt);
    // In local space, Left Glove has outer back on left (-X) and inner palm facing right (+X);
    // Right Glove mirrors horizontally so its inner palm faces left (-X) toward the clap center!
    ctx.scale(isRightHand ? -finalScale : finalScale, finalScale);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // -------------------------------------------------------------------------
    // 1. MAIN ELONGATED CARTOON GLOVE SILHOUETTE (3 Gathered Fingers + Palm)
    // -------------------------------------------------------------------------
    const traceGloveBody = () => {
      ctx.beginPath();
      // Start at bottom-left of wrist above the cuff
      ctx.moveTo(-24, 52);
      // Outer left edge curving up to the outer finger
      ctx.bezierCurveTo(-28, 24, -31, -6, -28, -38);
      // Outer finger rounded dome tip
      ctx.bezierCurveTo(-27, -53, -15, -55, -13, -42);
      // Middle finger (tallest) rounded dome tip
      ctx.bezierCurveTo(-13, -67, 3, -69, 5, -50);
      // Inner finger rounded dome tip
      ctx.bezierCurveTo(7, -61, 21, -57, 21, -40);
      // Inner palm edge curving down to bottom-right of wrist
      ctx.bezierCurveTo(23, -10, 27, 22, 22, 52);
      ctx.closePath();
    };

    // Soft drop shadow behind glove
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.34)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    traceGloveBody();
    ctx.fillStyle = mainColor;
    ctx.fill();
    ctx.restore();

    // Clip inside the glove body to paint cartoon cel-shaded highlight & inner shadow
    ctx.save();
    traceGloveBody();
    ctx.clip();

    // Lighter purple highlight strip along the outer finger & back of hand
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.moveTo(-30, 48);
    ctx.bezierCurveTo(-30, 12, -30, -20, -26, -54);
    ctx.lineTo(-12, -54);
    ctx.bezierCurveTo(-15, -15, -15, 18, -13, 48);
    ctx.closePath();
    ctx.fill();

    // Deeper purple cel-shading along the inner palm edge & lower wrist
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(9, -58);
    ctx.bezierCurveTo(16, -14, 18, 20, 12, 44);
    ctx.lineTo(-26, 46);
    ctx.lineTo(-26, 56);
    ctx.lineTo(28, 56);
    ctx.lineTo(28, -58);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bold Dark-Purple Cartoon Outline around Glove Body
    traceGloveBody();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 4.8;
    ctx.stroke();

    // -------------------------------------------------------------------------
    // 2. TWO INTERIOR FINGER SEPARATION CREASE LINES (Matching Reference Image)
    // -------------------------------------------------------------------------
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    // Crease 1: Between outer finger and middle finger
    ctx.moveTo(-13, -43);
    ctx.quadraticCurveTo(-10, -20, -8, -2);
    // Crease 2: Between middle finger and inner finger
    ctx.moveTo(5, -50);
    ctx.quadraticCurveTo(6, -24, 8, -4);
    ctx.stroke();

    // -------------------------------------------------------------------------
    // 3. PUFFY HORIZONTAL WRIST CUFF ROLL AT BOTTOM OF GLOVE
    // -------------------------------------------------------------------------
    const traceWristCuff = () => {
      ctx.beginPath();
      ctx.moveTo(-29, 47);
      ctx.quadraticCurveTo(0, 44, 27, 47);
      ctx.bezierCurveTo(36, 48, 36, 65, 26, 66);
      ctx.quadraticCurveTo(0, 68, -28, 66);
      ctx.bezierCurveTo(-38, 65, -38, 48, -29, 47);
      ctx.closePath();
    };

    traceWristCuff();
    ctx.fillStyle = mainColor;
    ctx.fill();

    // Cel-Shaded Bottom/Right Shadow inside Wrist Cuff
    ctx.save();
    traceWristCuff();
    ctx.clip();
    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(-36, 57);
    ctx.quadraticCurveTo(0, 61, 34, 52);
    ctx.lineTo(36, 70);
    ctx.lineTo(-36, 70);
    ctx.closePath();
    ctx.fill();

    // Top highlight on left of cuff
    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.ellipse(-14, 52, 12, 3.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bold Dark-Purple Cartoon Outline around Wrist Cuff
    traceWristCuff();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 4.8;
    ctx.stroke();

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
    const s = Math.max(0.68, Math.min(1.65, scale * (1 + chopBoost * 0.18)));
    ctx.scale(s, isRightHand ? -s : s);

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
    ctx.fillText('❄️ FROZEN (-5)', 0, iceTop);

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
    const tScale = (textSizeRef.current || 1.15) * 1.12;
    const fontPx = Math.round(16 * tScale);
    const badgeSize = Math.round(38 * Math.max(0.95, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(38 * Math.max(0.95, tScale * 0.94)) : 0;
    const cardH = Math.round(50 * Math.max(0.95, tScale * 0.94));
    const maxCardW = is2P ? Math.round(200 * Math.min(1.15, tScale)) : Math.round(290 * tScale);
    const minCardW = is2P ? Math.round(145 * Math.min(1.15, tScale)) : Math.round(185 * tScale);
    const cardW = Math.max(
      minCardW,
      Math.min(
        maxCardW,
        cleanWord.length * (fontPx * 0.55) + badgeSize + thumbSize + (hasLoadedImg ? 36 : 28)
      )
    );
    t.cardW = cardW;
    t.cardH = cardH;
    const cardY = 34;

    ctx.save();
    // 3D Bottom Extrusion Lip in Vibrant Option Color (No green dashed lines around mosquitoes!)
    ctx.fillStyle = t.frozen ? '#0284c7' : (t.color.dark || '#0284c7');
    roundRect(ctx, -cardW / 2, cardY + 6, cardW, cardH, 16);
    ctx.fill();

    // Main Capsule Body: Crisp Bright White & Sky-Blue 3D Card
    ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    const pillGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    pillGrad.addColorStop(0, t.frozen ? '#e0f2fe' : '#ffffff');
    pillGrad.addColorStop(1, t.frozen ? '#bae6fd' : '#f0f9ff');
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = t.frozen ? '#0284c7' : t.color.main;
    ctx.lineWidth = 3.8;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    // Glossy Top Bevel Highlight along Option Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    roundRect(ctx, -cardW / 2 + 8, cardY + 3, cardW - 16, 9, 5);
    ctx.fill();
    ctx.restore();

    // 3D Extruded Option Letter Badge (A, B, C, D)
    const badgeY = cardY + (cardH - badgeSize) / 2;
    const badgeGrad = ctx.createLinearGradient(0, badgeY, 0, badgeY + badgeSize);
    badgeGrad.addColorStop(0, t.frozen ? '#7dd3fc' : t.color.light);
    badgeGrad.addColorStop(0.35, t.frozen ? '#0284c7' : t.color.main);
    badgeGrad.addColorStop(1, t.frozen ? '#0369a1' : t.color.dark);
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, -cardW / 2 + 6, badgeY, badgeSize, badgeSize, 11);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(21 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 6 + badgeSize / 2, cardY + cardH / 2);

    let textStartX = -cardW / 2 + badgeSize + 14;
    if (hasLoadedImg && optImgEl) {
      try {
        ctx.drawImage(optImgEl, textStartX, cardY + (cardH - thumbSize) / 2, thumbSize, thumbSize);
        textStartX += thumbSize + 8;
      } catch {
        // ignore draw error
      }
    }

    // High-Contrast Dark Slate Option Answer Text on Bright White Capsule
    if (cleanWord) {
      ctx.fillStyle = t.frozen ? '#0369a1' : '#0f172a';
      ctx.font = `800 ${fontPx}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxChars = is2P ? 13 : 22;
      const displayStr = cleanWord.length > maxChars ? cleanWord.slice(0, maxChars - 1) + '…' : cleanWord;
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2);
    }

    // ---------------------------------------------
    // 2. Volumetric 3D Cartoon Mosquito with Biting Player Animation
    // ---------------------------------------------
    const biteIntensity = t.frozen ? 0 : (t.biteIntensity || 0);
    const jabCycle = biteIntensity > 0 ? Math.abs(Math.sin(time * 0.042 + t.wobblePhase)) : 0;
    const jabX = -jabCycle * 12 * biteIntensity;
    const jabY = jabCycle * 6 * biteIntensity;

    // If targeted between the player's hands, show a subtle "CLAP TO SLAP" target ring
    if (t.isTargeted && !t.frozen) {
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.arc(0, -4, 44 + Math.sin(time * 0.02) * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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
    const tScale = (textSizeRef.current || 1.15) * 1.12;
    const fontPx = Math.round(16 * tScale);
    const badgeSize = Math.round(38 * Math.max(0.95, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(38 * Math.max(0.95, tScale * 0.94)) : 0;
    const cardH = Math.round(50 * Math.max(0.95, tScale * 0.94));
    const maxCardW = is2P ? Math.round(200 * Math.min(1.15, tScale)) : Math.round(290 * tScale);
    const minCardW = is2P ? Math.round(145 * Math.min(1.15, tScale)) : Math.round(185 * tScale);
    const cardW = Math.max(
      minCardW,
      Math.min(
        maxCardW,
        cleanWord.length * (fontPx * 0.55) + badgeSize + thumbSize + (hasLoadedImg ? 36 : 28)
      )
    );
    t.cardW = cardW;
    t.cardH = cardH;
    const cardY = r * 0.45;

    ctx.fillStyle = t.frozen ? '#0284c7' : t.color.dark;
    roundRect(ctx, -cardW / 2, cardY + 4, cardW, cardH, 14);
    ctx.fill();

    ctx.fillStyle = t.frozen ? '#e0f2fe' : '#ffffff';
    ctx.strokeStyle = t.frozen ? '#0284c7' : t.color.main;
    ctx.lineWidth = 3.6;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 14);
    ctx.fill();
    ctx.stroke();

    const badgeY = cardY + (cardH - badgeSize) / 2;
    ctx.fillStyle = t.frozen ? '#0284c7' : t.color.main;
    roundRect(ctx, -cardW / 2 + 5, badgeY, badgeSize, badgeSize, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(20 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 5 + badgeSize / 2, cardY + cardH / 2);

    let textStartX = -cardW / 2 + badgeSize + 13;
    if (hasLoadedImg && optImgEl) {
      try {
        ctx.drawImage(optImgEl, textStartX, cardY + (cardH - thumbSize) / 2, thumbSize, thumbSize);
        textStartX += thumbSize + 8;
      } catch {
        // ignore draw error
      }
    }

    if (cleanWord) {
      ctx.fillStyle = t.frozen ? '#0369a1' : '#0f172a';
      ctx.font = `800 ${fontPx}px Inter, sans-serif`;
      ctx.textAlign = 'left';
      const maxChars = is2P ? 13 : 22;
      const displayStr = cleanWord.length > maxChars ? cleanWord.slice(0, maxChars - 1) + '…' : cleanWord;
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2);
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

      {/* Screen 2: Bright Light 3D Arcade Game Setup */}
      {screen === 'setup' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-4 sm:p-8 overflow-y-auto custom-scrollbar bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50">
          {/* Ambient Sunny 3D Clouds & Glow */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
            <div className="absolute -top-24 left-1/4 w-96 h-96 bg-white/75 rounded-full blur-3xl" />
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-200/50 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[42rem] h-72 bg-emerald-200/45 rounded-full blur-3xl" />
          </div>

          {/* Top Navigation Header with Bright 3D Tactile Buttons */}
          <div className="w-full max-w-6xl flex items-center justify-between mb-4 z-20 flex-wrap gap-2">
            <button
              onClick={() => onViewChange('games')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-800 font-extrabold shadow-md active:translate-y-0.5 transition-all cursor-pointer"
            >
              <ArrowLeft size={18} className="text-sky-600" />
              <span>Back to Games</span>
            </button>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 border-t border-amber-200 border-b-4 border-b-amber-600 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>⚙️ Settings</span>
              </button>
              <button
                onClick={() => setShowModeModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 border-t border-sky-200 border-b-4 border-b-sky-700 text-white font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <span>🎮 Switch Game</span>
              </button>
              <button
                onClick={() => setScreen('editor')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-800 font-extrabold shadow-md active:translate-y-0.5 transition-all cursor-pointer"
              >
                <Edit3 size={18} className="text-sky-600" />
                <span>Edit Quiz</span>
              </button>
              <FullscreenButton targetId="slap-and-chop-container" className="bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-800" />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-6xl my-auto">
            {/* 3D Sunny Hero Title Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/90 text-sky-700 border-2 border-sky-300 text-xs font-black uppercase tracking-widest mb-2 shadow-sm">
                <span>🦟 3D Motion AR Camera Arena 🍉🖐️✨</span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-sky-900 drop-shadow-[0_4px_0_rgba(255,255,255,1)] tracking-tight">
                SLAP &amp; CHOP 3D
              </h2>
              <p className="text-slate-700 font-bold text-sm sm:text-base mt-1.5">
                Slap Flying Mosquitoes • Slice Rising Fruits with Your Tracked 3D Hands! (+5 Correct / -5 &amp; Freeze if Wrong)
              </p>
            </div>

            {/* Main Light 3D Setup Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
              
              {/* Left 8 Columns: Bright 3D White Card for Player Selector + Combat Mode */}
              <div className="lg:col-span-8 bg-white/95 backdrop-blur-xl rounded-[2.2rem] border-2 border-sky-200 border-b-[10px] border-b-sky-300 p-6 sm:p-8 shadow-xl flex flex-col justify-between">
                
                {/* 3D Extruded 1 Player vs 2 Players Cards */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-xs font-black uppercase tracking-widest text-sky-700">
                      Select Arena Players
                    </span>
                    <span className="text-xs font-extrabold text-slate-600">
                      {numPlayers === 2 ? '⚡ Split-Court 1v1 Battle (Dual A-B-C-D)' : '🎯 Full-Court Solo Challenge'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 1 PLAYER 3D LIGHT CARD */}
                    <button
                      type="button"
                      onClick={() => setNumPlayers(1)}
                      className={`group relative overflow-hidden rounded-3xl p-5 text-left transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                        numPlayers === 1
                          ? 'bg-gradient-to-b from-sky-400 via-sky-500 to-blue-600 border-t-2 border-sky-200 border-x border-sky-400 border-b-[8px] border-b-blue-800 shadow-[0_12px_28px_rgba(14,165,233,0.35)] -translate-y-1 text-white'
                          : 'bg-gradient-to-b from-sky-50 to-slate-100 border-2 border-sky-200 border-b-[8px] border-b-sky-300 hover:from-white hover:to-sky-50 text-slate-800'
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-x-3 top-1.5 h-6 rounded-full bg-gradient-to-b from-white/40 to-transparent" />

                      <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 border-t border-white/60 border-b-4 shadow-md transition-transform group-hover:scale-105 ${
                        numPlayers === 1
                          ? 'bg-gradient-to-br from-amber-300 via-sky-300 to-blue-600 border-b-blue-900'
                          : 'bg-white border-b-sky-300'
                      }`}>
                        <span>🧤</span>
                        <span className="absolute -bottom-1.5 -right-1.5 text-lg">✨</span>
                      </div>

                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xl sm:text-2xl font-black tracking-tight ${numPlayers === 1 ? 'text-white' : 'text-slate-900'}`}>
                            1 Player
                          </span>
                          {numPlayers === 1 && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-white text-blue-700 shadow">
                              Active
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-bold mt-0.5 ${numPlayers === 1 ? 'text-sky-100' : 'text-slate-600'}`}>
                          Solo Full-Camera 3D Arena
                        </span>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg ${
                            numPlayers === 1 ? 'bg-white/25 text-white' : 'bg-sky-100 text-sky-800'
                          }`}>
                            👏 3D Gloves &amp; Hand Slice!
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* 2 PLAYERS 3D LIGHT CARD */}
                    <button
                      type="button"
                      onClick={() => setNumPlayers(2)}
                      className={`group relative overflow-hidden rounded-3xl p-5 text-left transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                        numPlayers === 2
                          ? 'bg-gradient-to-b from-rose-400 via-pink-500 to-rose-600 border-t-2 border-rose-200 border-x border-rose-400 border-b-[8px] border-b-rose-800 shadow-[0_12px_28px_rgba(244,63,94,0.35)] -translate-y-1 text-white'
                          : 'bg-gradient-to-b from-sky-50 to-slate-100 border-2 border-sky-200 border-b-[8px] border-b-sky-300 hover:from-white hover:to-sky-50 text-slate-800'
                      }`}
                    >
                      <div className="pointer-events-none absolute inset-x-3 top-1.5 h-6 rounded-full bg-gradient-to-b from-white/40 to-transparent" />

                      <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shrink-0 border-t border-white/60 border-b-4 shadow-md transition-transform group-hover:scale-105 ${
                        numPlayers === 2
                          ? 'bg-gradient-to-br from-amber-200 via-rose-400 to-pink-700 border-b-rose-900'
                          : 'bg-white border-b-sky-300'
                      }`}>
                        <span>🟣⚡🔴</span>
                        <span className="absolute -bottom-1.5 -right-1.5 text-lg">🍉</span>
                      </div>

                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xl sm:text-2xl font-black tracking-tight ${numPlayers === 2 ? 'text-white' : 'text-slate-900'}`}>
                            2 Players
                          </span>
                          {numPlayers === 2 && (
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-white text-rose-700 shadow">
                              1v1 Split
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-bold mt-0.5 ${numPlayers === 2 ? 'text-rose-100' : 'text-slate-600'}`}>
                          Split-Camera Court Boundary
                        </span>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg ${
                            numPlayers === 2 ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-800'
                          }`}>
                            Both Teams Get A•B•C•D
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Light 3D Player Name Inputs */}
                <div className={`grid gap-3 mb-6 ${numPlayers === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                  <div className="flex items-center gap-3 bg-sky-50 p-2.5 rounded-2xl border-2 border-sky-200 border-b-4 border-b-sky-300 shadow-inner">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-purple-500 to-indigo-600 border-b-2 border-indigo-900 text-white flex items-center justify-center font-black text-base shadow shrink-0">
                      P1
                    </div>
                    <input
                      type="text"
                      value={p1Name}
                      onChange={e => setP1Name(e.target.value)}
                      className="flex-1 bg-transparent text-slate-900 font-extrabold placeholder-slate-400 outline-none text-base px-2"
                      placeholder="Player 1 Name"
                    />
                    <span className="text-xs font-extrabold text-purple-700 px-2.5 py-1 rounded-lg bg-purple-100">
                      {numPlayers === 2 ? 'Left Court' : 'Full Court'}
                    </span>
                  </div>

                  {numPlayers === 2 && (
                    <div className="flex items-center gap-3 bg-rose-50 p-2.5 rounded-2xl border-2 border-rose-200 border-b-4 border-b-rose-300 shadow-inner animate-in fade-in duration-200">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-rose-500 to-pink-600 border-b-2 border-rose-900 text-white flex items-center justify-center font-black text-base shadow shrink-0">
                        P2
                      </div>
                      <input
                        type="text"
                        value={p2Name}
                        onChange={e => setP2Name(e.target.value)}
                        className="flex-1 bg-transparent text-slate-900 font-extrabold placeholder-slate-400 outline-none text-base px-2"
                        placeholder="Player 2 Name"
                      />
                      <span className="text-xs font-extrabold text-rose-700 px-2.5 py-1 rounded-lg bg-rose-100">
                        Right Court
                      </span>
                    </div>
                  )}
                </div>

                {/* 3D Tactile Game Mode Cards (Slap, Chop, Mix) */}
                <div className="mb-6">
                  <span className="block text-xs font-black uppercase tracking-widest text-sky-700 mb-2.5 px-1">
                    Choose 3D Combat Mode
                  </span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      {
                        id: 'mosquito' as const,
                        title: 'Mosquito Slap',
                        sub: 'Flying Mosquitoes + Hand Slap',
                        icon: '🦟',
                        activeClass: 'from-purple-500 to-indigo-600 border-purple-300 border-b-indigo-900 text-white shadow-lg'
                      },
                      {
                        id: 'chop' as const,
                        title: 'Fruit Slice',
                        sub: 'Rising Fruits + Hand Slice',
                        icon: '🍉✨',
                        activeClass: 'from-amber-400 to-orange-500 border-amber-200 border-b-orange-800 text-white shadow-lg'
                      },
                      {
                        id: 'combo' as const,
                        title: 'Combo Mix',
                        sub: 'Alternates Every Round',
                        icon: '🔥',
                        activeClass: 'from-emerald-400 to-teal-600 border-emerald-200 border-b-teal-900 text-white shadow-lg'
                      }
                    ].map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => changeCombatMode(m.id)}
                        className={`relative rounded-2xl p-3.5 flex flex-col items-center text-center transition-all cursor-pointer border-2 border-b-[6px] ${
                          gameMode === m.id
                            ? `bg-gradient-to-b ${m.activeClass} -translate-y-0.5`
                            : 'bg-sky-50 border-sky-200 border-b-sky-300 hover:bg-white text-slate-800'
                        }`}
                      >
                        <span className="text-3xl mb-1 drop-shadow">{m.icon}</span>
                        <span className="font-black text-sm sm:text-base leading-tight">{m.title}</span>
                        <span className={`text-[11px] font-bold mt-0.5 ${gameMode === m.id ? 'text-white/90' : 'text-slate-500'}`}>{m.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Summary of Settings + Open Settings Button */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-6 bg-sky-50 p-3.5 rounded-2xl border-2 border-sky-200">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold text-slate-700">
                    <span className="px-2.5 py-1 rounded-xl bg-white border border-sky-200">
                      🎵 Music: {musicEnabled ? 'ON' : 'OFF'}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-white border border-sky-200">
                      🗣️ Voice: {voiceEnabled ? 'ON' : 'OFF'}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-white border border-sky-200">
                      ⚡ Speed: {speed === 0.6 ? 'Slow' : speed === 1 ? 'Normal' : speed === 1.4 ? 'Fast' : 'Turbo'}
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-white border border-sky-200">
                      🎯 Scoring: +5 / -5 (❄️ Freeze)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettingsModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs border-b-2 border-amber-600 shadow cursor-pointer"
                  >
                    ⚙️ Customize Settings
                  </button>
                </div>

                {/* Giant 3D Arcade START GAME Button */}
                <button
                  type="button"
                  onClick={() => startGame(numPlayers)}
                  className="relative w-full py-4.5 bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-black text-2xl sm:text-3xl rounded-2xl border-t-2 border-emerald-200 border-b-[8px] border-b-emerald-800 shadow-[0_14px_30px_rgba(16,185,129,0.35)] active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-3 tracking-wide"
                >
                  <Play size={28} fill="currentColor" className="drop-shadow" />
                  <span className="drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
                    START {numPlayers === 2 ? '2-PLAYER BATTLE' : '3D ARENA'}
                  </span>
                </button>
              </div>

              {/* Right 4 Columns: Bright 3D AR Gear Showcase + Study Mode Card */}
              <div className="lg:col-span-4 flex flex-col gap-6 justify-between">
                
                {/* 3D AR Equipment & Rules Info Card */}
                <div className="flex-1 rounded-[2.2rem] bg-white/95 backdrop-blur-xl border-2 border-sky-200 border-b-[10px] border-b-sky-300 shadow-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 border border-sky-300 text-sky-700 text-[11px] font-black uppercase tracking-wider mb-3">
                      <span>👏 Dual-Hand Tracking &amp; Freeze Rules</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                      How to Play 3D
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed mb-4">
                      Use your hands to slap flying mosquitoes or slice rising fruits! Correct hits award <strong className="text-emerald-600">+5 pts</strong>; wrong hits deduct <strong className="text-rose-600">-5 pts</strong> and freeze the word in ice!
                    </p>
                  </div>

                  <div className="space-y-3 my-auto">
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-purple-50 border-2 border-purple-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 border-b-4 border-indigo-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🦟
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Mosquito Slap Mode</div>
                        <div className="text-[11px] font-semibold text-slate-600">Mosquitoes fly around the arena! Slap them directly with your real hand on camera!</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-amber-50 border-2 border-amber-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 border-b-4 border-orange-800 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🍉
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Rising Fruit Hand-Slice</div>
                        <div className="text-[11px] font-semibold text-slate-600">Fruits launch from below and rise up! Swipe your tracked hands across to slice!</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-sky-50 border-2 border-sky-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 border-b-4 border-blue-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🎯
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">+5 Correct / -5 Wrong</div>
                        <div className="text-[11px] font-semibold text-slate-600">Switch Mode, Camera, Music, Voice &amp; Speed anytime inside ⚙️ Settings</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between text-xs text-slate-600 font-extrabold">
                    <span>Loaded Questions:</span>
                    <span className="px-3 py-0.5 rounded-full bg-sky-100 text-sky-800 font-black">
                      {activeQuiz.questions.length} Rounds
                    </span>
                  </div>
                </div>

                {/* 3D Extruded Study Mode Button Card (Bright Sunny Style) */}
                <button
                  type="button"
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="group relative w-full rounded-[2rem] bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 border-t-2 border-white border-b-[8px] border-b-orange-600 shadow-xl active:translate-y-1 transition-all duration-200 cursor-pointer flex items-center p-6 gap-5 text-left"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white border-b-4 border-amber-600 flex items-center justify-center text-4xl transform group-hover:scale-110 group-hover:rotate-6 transition duration-300 shadow-md shrink-0">
                    📖
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-900">
                      Interactive Flashcards &amp; Quiz Review
                    </span>
                    <h3 className="text-2xl font-black text-slate-900">
                      Study Mode
                    </h3>
                    <p className="text-slate-800 font-bold text-xs mt-0.5">
                      Practice all {activeQuiz.questions.length} questions with voice &amp; instant check!
                    </p>
                  </div>
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
            {gameMode === 'chop' ? '🍉' : '🦟'}
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Preparing Sunny 3D Arena...</h2>
          <p className="text-slate-600 font-bold text-sm max-w-sm">Calibrating 21-Point 3D Hand Tracking &amp; Live Camera Sensors!</p>
        </div>
      )}

      {/* Screen 4: Live 3D AR Motion Game Arena (Full-Screen Live Camera + Bigger Immersive Player Point Cards + Mode & Camera Inside Settings) */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-10 w-full h-full overflow-hidden select-none">
          
          {/* BRIGHT LIGHT 3D FLOATING TOP HUD (Permanent Fixed-Position Scoreboards at Left & Right + Jumbo Center Timer & Settings) */}
          <div className="absolute top-0 left-0 right-0 z-40 w-full px-3 sm:px-6 pt-3 pb-2 pointer-events-none">
            <div className="max-w-[1600px] mx-auto flex flex-col gap-3 pointer-events-auto">
              
              {/* Row 1: PERMANENT-POSITION 3-COLUMN HUD (P1 Pinned Left | Big Timer & Settings Center | P2 Pinned Right — Never Wraps or Shifts!) */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 w-full">
                
                {/* PLAYER 1 PERMANENT JUMBO 3D SCOREBOARD CARD (Pinned Top-Left, Fixed Width & Height) */}
                <div className={`relative flex items-center justify-between gap-3 w-[235px] sm:w-[310px] md:w-[340px] h-[86px] sm:h-[98px] px-4 sm:px-5 rounded-3xl backdrop-blur-md border-2 border-b-[7px] shadow-2xl shrink-0 ${
                  hudFrozen[0]
                    ? 'bg-gradient-to-b from-sky-100 to-sky-200 border-sky-400 border-b-sky-600 ring-4 ring-sky-300/60'
                    : 'bg-gradient-to-b from-white via-purple-50/85 to-indigo-50/95 border-purple-300 border-b-purple-600'
                }`}>
                  {/* Floating Frozen Pill so it NEVER changes scoreboard width */}
                  {hudFrozen[0] && (
                    <span className="absolute -top-3 left-5 text-[11px] sm:text-xs px-3 py-0.5 rounded-full bg-sky-500 text-white font-black border-2 border-white shadow-md animate-pulse z-20">
                      ❄️ FROZEN
                    </span>
                  )}

                  <div className="flex items-center gap-3 min-w-0">
                    {/* 3D Team Avatar Badge */}
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-t border-white/80 border-b-4 shadow-md shrink-0 ${
                      hudFrozen[0]
                        ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-b-blue-900 text-white'
                        : 'bg-gradient-to-br from-purple-500 to-indigo-600 border-b-indigo-900 text-white'
                    }`}>
                      {hudFrozen[0] ? '❄️' : activeRoundMode === 'mosquito' ? '🦟' : '🍉'}
                    </div>

                    {/* Player Name & Streak */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-base font-black uppercase tracking-wider text-purple-950 truncate max-w-[100px] sm:max-w-[130px]">
                          {p1Name || "Player 1"}
                        </span>
                        <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black shadow-xs shrink-0">
                          🔥 x{hudStreaks[0]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Permanent Jumbo Score Number */}
                  <div className="flex flex-col items-end justify-center shrink-0 pl-2">
                    <span className={`font-black text-3xl sm:text-5xl tracking-tight font-mono leading-none tabular-nums ${
                      hudScores[0] < 0 ? 'text-rose-600' : 'text-slate-900'
                    }`}>
                      {hudScores[0]}
                    </span>
                    <span className="text-[10px] sm:text-xs font-black uppercase text-purple-700 tracking-widest mt-0.5">
                      POINTS
                    </span>
                  </div>

                  {/* Animated +5 / -5 Floating Score Popup */}
                  {hudScorePops[0] && (
                    <span className={`absolute -bottom-6 right-4 text-lg sm:text-2xl font-black text-white px-4 py-1 rounded-2xl border-2 border-white shadow-xl animate-bounce z-50 ${
                      hudScorePops[0].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}>
                      {hudScorePops[0]}
                    </span>
                  )}
                </div>

                {/* CENTER CONTROLS (Bigger Round Badge + Bigger Live Timer + Bigger Settings Button + Fullscreen) */}
                <div className="flex items-center justify-center gap-2 sm:gap-3 flex-nowrap">
                  <div className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl bg-white/95 border-2 border-sky-300 border-b-[5px] border-b-sky-600 text-sm sm:text-lg font-black text-sky-950 shadow-lg flex items-center gap-2 shrink-0">
                    <span className="text-base sm:text-xl">{activeRoundMode === 'mosquito' ? '🦟 Slap' : '🍉✨ Slice'}</span>
                    <span className="text-sky-400">•</span>
                    <span>Q{currentQIndex + 1} / {activeQuiz.questions.length}</span>
                  </div>

                  {/* Bigger Live Playing Time Countdown Badge */}
                  <div className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl border-2 border-b-[5px] text-base sm:text-2xl font-black font-mono shadow-lg flex items-center gap-2 transition-colors shrink-0 tabular-nums ${
                    hudTimeLeft <= 15
                      ? 'bg-rose-500 border-rose-300 border-b-rose-800 text-white animate-pulse'
                      : 'bg-white/95 border-emerald-300 border-b-emerald-600 text-emerald-950'
                  }`}>
                    <span className="text-lg sm:text-2xl">⏱️</span>
                    <span>{formatPlayTime(hudTimeLeft)}</span>
                  </div>

                  {/* Bigger Settings Button */}
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 border-t-2 border-white border-b-[5px] border-b-amber-700 text-sm sm:text-lg font-black text-slate-900 transition shadow-xl cursor-pointer flex items-center gap-2 active:translate-y-0.5 shrink-0"
                  >
                    <span className="text-lg sm:text-xl">⚙️</span>
                    <span>Settings</span>
                  </button>

                  <FullscreenButton targetId="slap-and-chop-container" className="bg-white/95 hover:bg-sky-50 border-2 border-sky-300 border-b-[5px] border-b-sky-600 text-slate-800 !py-2.5 sm:!py-3 !px-4 shadow-lg shrink-0" />
                </div>

                {/* PLAYER 2 PERMANENT JUMBO 3D SCOREBOARD CARD (Pinned Top-Right, Fixed Width & Height) */}
                {numPlayers === 2 ? (
                  <div className={`relative flex items-center justify-between gap-3 w-[235px] sm:w-[310px] md:w-[340px] h-[86px] sm:h-[98px] px-4 sm:px-5 rounded-3xl backdrop-blur-md border-2 border-b-[7px] shadow-2xl shrink-0 ${
                    hudFrozen[1]
                      ? 'bg-gradient-to-b from-sky-100 to-sky-200 border-sky-400 border-b-sky-600 ring-4 ring-sky-300/60'
                      : 'bg-gradient-to-b from-white via-rose-50/85 to-pink-50/95 border-rose-300 border-b-rose-600'
                  }`}>
                    {/* Floating Frozen Pill so it NEVER changes scoreboard width */}
                    {hudFrozen[1] && (
                      <span className="absolute -top-3 right-5 text-[11px] sm:text-xs px-3 py-0.5 rounded-full bg-sky-500 text-white font-black border-2 border-white shadow-md animate-pulse z-20">
                        ❄️ FROZEN
                      </span>
                    )}

                    {/* Permanent Jumbo Score Number */}
                    <div className="flex flex-col items-start justify-center shrink-0 pr-2">
                      <span className={`font-black text-3xl sm:text-5xl tracking-tight font-mono leading-none tabular-nums ${
                        hudScores[1] < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {hudScores[1]}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black uppercase text-rose-700 tracking-widest mt-0.5">
                        POINTS
                      </span>
                    </div>

                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-end text-right min-w-0">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black shadow-xs shrink-0">
                            🔥 x{hudStreaks[1]}
                          </span>
                          <span className="text-xs sm:text-base font-black uppercase tracking-wider text-rose-950 truncate max-w-[100px] sm:max-w-[130px]">
                            {p2Name || "Player 2"}
                          </span>
                        </div>
                      </div>

                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-t border-white/80 border-b-4 shadow-md shrink-0 ${
                        hudFrozen[1]
                          ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-b-blue-900 text-white'
                          : 'bg-gradient-to-br from-rose-500 to-pink-600 border-b-rose-900 text-white'
                      }`}>
                        {hudFrozen[1] ? '❄️' : activeRoundMode === 'mosquito' ? '🦟' : '🍉'}
                      </div>
                    </div>

                    {hudScorePops[1] && (
                      <span className={`absolute -bottom-6 left-4 text-lg sm:text-2xl font-black text-white px-4 py-1 rounded-2xl border-2 border-white shadow-xl animate-bounce z-50 ${
                        hudScorePops[1].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}>
                        {hudScorePops[1]}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="w-[235px] sm:w-[310px] md:w-[340px] shrink-0 hidden lg:block" />
                )}
              </div>

              {/* Row 2: JUMBO, HIGH-CONTRAST 3D QUESTION BANNER */}
              <div className="relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl px-6 py-4 sm:px-8 sm:py-5 text-center shadow-[0_16px_40px_rgba(14,165,233,0.28)] border-2 border-sky-300 border-b-[8px] border-b-sky-600 max-w-5xl mx-auto w-full flex items-center justify-between gap-4">
                {/* Sunny Progress Timer Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-2.5 bg-sky-100">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-100"
                    style={{ width: `${timerPct}%` }}
                  />
                </div>

                <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-sky-100 border-2 border-sky-300 items-center justify-center text-2xl sm:text-3xl font-black text-sky-700 shrink-0 shadow-inner">
                  Q{currentQIndex + 1}
                </div>

                {(() => {
                  const qParsed = parseOptionContent(currentQ?.text || '');
                  const qImg = currentQ?.image || qParsed.imageUrl;
                  const qTextDisplay = nextQCountdown !== null
                    ? `⏳ Next Question Appears in ${nextQCountdown}s...`
                    : (qParsed.text || currentQ?.text || "Loading question...");
                  return (
                    <div className="flex-1 flex items-center justify-center gap-4 min-w-0">
                      {qImg && nextQCountdown === null && (
                        <img
                          src={qImg}
                          alt="Question"
                          className="h-14 sm:h-20 w-auto max-w-[140px] rounded-2xl object-contain bg-sky-50 border-2 border-sky-300 p-1 shrink-0 shadow-sm"
                        />
                      )}
                      <p
                        className="font-black text-slate-900 tracking-tight leading-snug break-words drop-shadow-xs"
                        style={{ fontSize: `${Math.round(30 * textSize)}px` }}
                      >
                        {qTextDisplay}
                      </p>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={() => currentQ?.text && speakText(currentQ.text)}
                  title="Read Question Aloud"
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-sky-100 hover:bg-sky-200 border-2 border-sky-300 flex items-center justify-center text-2xl shrink-0 cursor-pointer transition shadow-xs"
                >
                  🔊
                </button>
              </div>

            </div>
          </div>

          {/* 3-SECOND COUNTDOWN OVERLAY BEFORE NEXT QUESTION APPEARS */}
          {nextQCountdown !== null && (
            <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
              <div className="px-10 py-7 rounded-[2.5rem] bg-white/95 backdrop-blur-xl border-4 border-sky-300 border-b-[10px] border-b-sky-600 shadow-[0_24px_60px_rgba(14,165,233,0.35)] flex flex-col items-center gap-2 animate-bounce">
                <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-sky-700 bg-sky-100 px-4 py-1 rounded-full border border-sky-200">
                  ⏳ Get Ready! Next Question In
                </span>
                <span className="text-6xl sm:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-sky-500 via-indigo-600 to-purple-700 font-mono leading-none drop-shadow-sm">
                  {nextQCountdown}
                </span>
                <span className="text-xs font-extrabold text-slate-500">
                  Seconds
                </span>
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

            {/* Bottom Light 3D Instruction Pill */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-6 py-2.5 rounded-full bg-white/95 backdrop-blur-md border-2 border-sky-300 border-b-4 border-b-sky-500 text-xs sm:text-base font-black text-slate-800 whitespace-nowrap shadow-lg">
              {activeRoundMode === 'mosquito'
                ? '🦟🧤 Bring both gloves together (CLAP!) over a mosquito to slap it! (+5 Correct / -5 & Freeze if Wrong)'
                : '🍉🔪 Slice the rising fruits with your tracked hands! (+5 Correct / -5 & Freeze if Wrong)'}
            </div>
          </div>
        </div>
      )}

      {/* 3D LIGHT SETTINGS MODAL (Contains Combat Mode, Camera, Music, Voice, Text Size, Speed & Movements) */}
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
                  <p className="text-xs font-bold text-slate-500">Mode, Camera, Music, Voice, Text Size, Speed &amp; Movements</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 0. Combat Mode & Camera Controls (Moved from Top HUD into Settings!) */}
            <div className="p-4 rounded-2xl bg-amber-50/90 border-2 border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-slate-900">🎮 3D Combat Mode</span>
                <span className="text-xs font-extrabold text-amber-800">
                  {gameMode === 'mosquito' ? 'Mosquito Slap 🦟' : gameMode === 'chop' ? 'Fruit Hand-Slice 🍉✨' : 'Combo Mix 🔥'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mosquito' as const, label: '🦟 Slap Mode', desc: 'Flying Mosquitoes' },
                  { id: 'chop' as const, label: '🍉 Slice Mode', desc: 'Rising Fruits + Hands' },
                  { id: 'combo' as const, label: '🔥 Combo Mix', desc: 'Alternates Rounds' }
                ].map(cm => (
                  <button
                    key={cm.id}
                    type="button"
                    onClick={() => changeCombatMode(cm.id)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-black border-b-4 transition cursor-pointer flex flex-col items-center gap-0.5 ${
                      gameMode === cm.id
                        ? 'bg-gradient-to-b from-amber-400 to-orange-500 border-orange-800 text-white shadow'
                        : 'bg-white border-amber-200 text-slate-700 hover:bg-amber-100/60'
                    }`}
                  >
                    <span>{cm.label}</span>
                    <span className={`text-[10px] font-bold ${gameMode === cm.id ? 'text-white/90' : 'text-slate-400'}`}>{cm.desc}</span>
                  </button>
                ))}
              </div>

              {/* Camera Tracking Toggle Inside Settings */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-200/80">
                <div>
                  <div className="text-sm font-black text-slate-900">📷 AR Camera Feed &amp; Hand Tracking</div>
                  <div className="text-[11px] font-bold text-slate-500">
                    {cameraActive ? 'Live Webcam Tracking Active' : 'Virtual Meadow Arena (Mouse / Touch)'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (cameraActive) stopCamera();
                    else setupCamera();
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                    cameraActive
                      ? 'bg-emerald-500 border-emerald-800 text-white'
                      : 'bg-sky-500 border-sky-800 text-white'
                  }`}
                >
                  {cameraActive ? '📷 Camera: ON' : '🌤️ Virtual Arena'}
                </button>
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
        const p1 = engineRef.current.players[0] || { score: 0, correctHits: 0, wrongHits: 0, hits: 0 };
        const p2 = engineRef.current.players[1] || { score: 0, correctHits: 0, wrongHits: 0, hits: 0 };
        const p1TotalAttempts = (p1.correctHits || 0) + (p1.wrongHits || 0);
        const p2TotalAttempts = (p2.correctHits || 0) + (p2.wrongHits || 0);
        const p1Acc = p1TotalAttempts > 0 ? Math.round(((p1.correctHits || 0) / p1TotalAttempts) * 100) : 100;
        const p2Acc = p2TotalAttempts > 0 ? Math.round(((p2.correctHits || 0) / p2TotalAttempts) * 100) : 100;

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
                  Scoring Rules: <span className="text-emerald-600 font-black">+5 Points</span> per Correct Hit • <span className="text-rose-600 font-black">-5 Points</span> per Wrong Hit
                </p>
              </div>

              {/* 3D Championship Podium Score Cards */}
              <div className={`grid gap-4 ${numPlayers === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'}`}>
                {/* Player 1 Podium Card */}
                <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                  isP1Winner || isTie
                    ? 'bg-gradient-to-b from-purple-50 to-white border-purple-400 border-b-purple-600 shadow-lg'
                    : 'bg-white border-slate-200 border-b-slate-300 opacity-90'
                }`}>
                  {(isP1Winner || isTie) && (
                    <span className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
                      {isTie ? '🥇 Co-Champion' : '👑 Winner'}
                    </span>
                  )}
                  <div className="text-sm font-black uppercase tracking-wider text-purple-700 mt-1">
                    {p1Name || "Player 1"}
                  </div>
                  <div className="text-5xl font-black text-slate-900 font-mono my-2">
                    {p1.score} <span className="text-base font-black text-purple-600">PTS</span>
                  </div>
                  <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-purple-100 text-xs font-extrabold">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 text-emerald-700">
                      <div className="text-sm font-black">+{ (p1.correctHits || 0) * 5 }</div>
                      <div className="text-[10px]">✓ {p1.correctHits || 0} Correct</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-xl py-1.5 text-rose-700">
                      <div className="text-sm font-black">-{ (p1.wrongHits || 0) * 5 }</div>
                      <div className="text-[10px]">❄️ {p1.wrongHits || 0} Wrong</div>
                    </div>
                    <div className="bg-sky-50 border border-sky-200 rounded-xl py-1.5 text-sky-800">
                      <div className="text-sm font-black">{p1Acc}%</div>
                      <div className="text-[10px]">🎯 Accuracy</div>
                    </div>
                  </div>
                </div>

                {/* Player 2 Podium Card (If 2 Players) */}
                {numPlayers === 2 && (
                  <div className={`relative rounded-3xl p-5 border-2 border-b-[8px] transition-all flex flex-col items-center ${
                    isP2Winner || isTie
                      ? 'bg-gradient-to-b from-rose-50 to-white border-rose-400 border-b-rose-600 shadow-lg'
                      : 'bg-white border-slate-200 border-b-slate-300 opacity-90'
                  }`}>
                    {(isP2Winner || isTie) && (
                      <span className="absolute -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
                        {isTie ? '🥇 Co-Champion' : '👑 Winner'}
                      </span>
                    )}
                    <div className="text-sm font-black uppercase tracking-wider text-rose-700 mt-1">
                      {p2Name || "Player 2"}
                    </div>
                    <div className="text-5xl font-black text-slate-900 font-mono my-2">
                      {p2.score} <span className="text-base font-black text-rose-600">PTS</span>
                    </div>
                    <div className="w-full grid grid-cols-3 gap-2 pt-3 border-t border-rose-100 text-xs font-extrabold">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl py-1.5 text-emerald-700">
                        <div className="text-sm font-black">+{(p2.correctHits || 0) * 5}</div>
                        <div className="text-[10px]">✓ {p2.correctHits || 0} Correct</div>
                      </div>
                      <div className="bg-rose-50 border border-rose-200 rounded-xl py-1.5 text-rose-700">
                        <div className="text-sm font-black">-{(p2.wrongHits || 0) * 5}</div>
                        <div className="text-[10px]">❄️ {p2.wrongHits || 0} Wrong</div>
                      </div>
                      <div className="bg-sky-50 border border-sky-200 rounded-xl py-1.5 text-sky-800">
                        <div className="text-sm font-black">{p2Acc}%</div>
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
  const [contentMode, setContentMode] = useState<OptionContentMode>("both");
  const [autoRecommendPhoto, setAutoRecommendPhoto] = useState<boolean>(true);
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
