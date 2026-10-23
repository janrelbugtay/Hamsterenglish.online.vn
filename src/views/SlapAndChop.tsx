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

type GameScreen = 'editor' | 'setup' | 'loading' | 'game' | 'results' | 'study';

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
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
  const [selectedTheme, setSelectedTheme] = useState<string>("theme-sky");

  // In-Game Live HUD States
  const [currentQIndex, setCurrentQIndex] = useState<number>(0);
  const [activeRoundMode, setActiveRoundMode] = useState<'mosquito' | 'chop'>('mosquito');
  const [hudScores, setHudScores] = useState<[number, number]>([0, 0]);
  const [hudStreaks, setHudStreaks] = useState<[number, number]>([1, 1]);
  const [hudScorePops, setHudScorePops] = useState<[string | null, string | null]>([null, null]);
  const [timerPct, setTimerPct] = useState<number>(100);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
  const faceDetectorRef = useRef<any>(null);
  const headTrackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const mosquitoBuzzRef = useRef<{ osc1: OscillatorNode; osc2: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null>(null);
  const bgMusicTimerRef = useRef<number | null>(null);
  const textSizeRef = useRef<number>(textSize);
  const movementStyleRef = useRef<'calm' | 'normal' | 'zigzag' | 'hover'>(movementStyle);
  const speedRef = useRef<number>(speed);

  useEffect(() => {
    textSizeRef.current = textSize;
  }, [textSize]);

  useEffect(() => {
    movementStyleRef.current = movementStyle;
  }, [movementStyle]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

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

  const playSoundEffect = (type: 'slap' | 'slash' | 'correct' | 'wrong' | 'whoosh') => {
    if (!soundFx) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'slap') {
      // Layer 1: Crisp leather glove whip-crack transient (bandpass white noise burst)
      const bufferSize = Math.floor(ctx.sampleRate * 0.065);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.009));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(2200, now);
      bpFilter.Q.setValueAtTime(1.2, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.95, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

      noise.connect(bpFilter);
      bpFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);

      // Layer 2: Deep punchy palm-smack bass thump
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime(340, now);
      thudOsc.frequency.exponentialRampToValueAtTime(42, now + 0.11);

      thudGain.gain.setValueAtTime(0.95, now);
      thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);

      thudOsc.connect(thudGain);
      thudGain.connect(ctx.destination);
      thudOsc.start(now);
      thudOsc.stop(now + 0.12);

      // Layer 3: High electric bug-swatter snap + splat pop
      const popOsc = ctx.createOscillator();
      const popGain = ctx.createGain();
      popOsc.type = 'sine';
      popOsc.frequency.setValueAtTime(980, now);
      popOsc.frequency.exponentialRampToValueAtTime(140, now + 0.065);

      popGain.gain.setValueAtTime(0.55, now);
      popGain.gain.exponentialRampToValueAtTime(0.01, now + 0.065);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);
      popOsc.start(now);
      popOsc.stop(now + 0.07);

    } else if (type === 'slash') {
      // Layer 1: Metallic sword blade ring + air slice whoosh
      const bufferSize = Math.floor(ctx.sampleRate * 0.14);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.7;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(3400, now + 0.12);
      filter.Q.setValueAtTime(2.5, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.75, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      // Layer 2: Steel blade shimmer + juicy fruit cleave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1650, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.16);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);

    } else if (type === 'whoosh') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

    } else if (type === 'correct') {
      // Bright arcade victory chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const startT = now + idx * 0.065;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.28, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.34);
      });
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.linearRampToValueAtTime(105, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  };

  // Realistic human-like TTS narration
  const speakText = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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
      // Natural conversational cadence & warm pitch
      utterance.rate = 0.96;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

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
      headY: 0.20,
      headScale: 1.0,
      headTilt: 0,
      headDetected: false,
      lastHeadTime: 0,
      handX: baseX,
      handY: 0.62,
      prevHandX: baseX,
      prevHandY: 0.62,
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
      lastDualHandTime: 0,
      clapTimer: 0,
      isClapping: false,
      clapMidX: baseX,
      clapMidY: 0.62,
      leftHand: {
        x: baseX - 0.065,
        y: 0.62,
        prevX: baseX - 0.065,
        prevY: 0.62,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: -0.18,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        landmarks: null as any[] | null
      },
      rightHand: {
        x: baseX + 0.065,
        y: 0.62,
        prevX: baseX + 0.065,
        prevY: 0.62,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: 0.18,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        landmarks: null as any[] | null
      }
    };
  };

  // Compute dynamic 3D hand scale & finger openness from 21 MediaPipe landmarks
  const analyzeHandGeometry = (landmarks: any[]) => {
    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const pinkyMcp = landmarks[17];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];

    // 1. Palm core size (invariant to finger curling so fist vs open hand still measures distance to camera!)
    const palmLength = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
    const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
    const coreSize = palmLength * 0.62 + palmWidth * 0.48;

    // 2. Full bounding box span of all 21 landmarks
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const bboxDiag = Math.hypot(maxX - minX, maxY - minY);

    // Combine core palm size + bbox diagonal for smooth, dramatic depth scaling (0.62x far -> 1.95x close)
    const rawScale = (coreSize * 6.8) + (bboxDiag * 1.45);
    const scale = Math.max(0.62, Math.min(1.95, rawScale));

    // 3. Finger openness ratio (dist from wrist to fingertips vs palm length)
    const avgTipDist = (
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)
    ) / 4;
    const openness = Math.max(0.35, Math.min(1.3, avgTipDist / Math.max(0.04, palmLength * 1.75)));

    return { scale, openness, palmLength };
  };

  // MediaPipe Hands Results Handler (High-precision 60fps hand & weapon tracking)
  const onHandsResults = (results: any) => {
    const eng = engineRef.current;
    if (!eng) return;
    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const now = performance.now();
    const is2P = eng.numPlayers === 2;

    // Reset per-frame detection flags
    eng.players.forEach(p => {
      p.leftHand.detected = false;
      p.rightHand.detected = false;
    });

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      eng.players.forEach(p => {
        if (now - (p.lastHandTime || 0) > 450) {
          p.hasDetectedHands = false;
        }
      });
      return;
    }

    // Group detected hands by player court side
    const playerHands: { [key: number]: any[] } = { 0: [], 1: [] };

    results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
      if (!landmarks || landmarks.length < 21) return;
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];

      // Center of the palm/glove in mirrored camera coordinates
      const rawX = 1.0 - (middleMcp.x * 0.7 + wrist.x * 0.3);
      const rawY = middleMcp.y * 0.7 + wrist.y * 0.3;
      const rawWristX = 1.0 - wrist.x;
      const rawWristY = wrist.y;

      // Assign to Player 1 (Left Court < 0.5) or Player 2 (Right Court >= 0.5)
      let pIdx = 0;
      if (is2P) {
        pIdx = rawX < 0.5 ? 0 : 1;
      }

      // Enforce strict 2-player court boundary line
      let clampedX = rawX;
      if (is2P) {
        clampedX = pIdx === 0
          ? Math.min(0.465, Math.max(0.04, rawX))
          : Math.max(0.535, Math.min(0.96, rawX));
      } else {
        clampedX = Math.max(0.04, Math.min(0.96, rawX));
      }
      const clampedY = Math.max(0.05, Math.min(0.95, rawY));

      // Hand orientation angle (wrist -> middle/index finger direction)
      const aimX = 1.0 - ((indexTip.x + middleTip.x) * 0.5);
      const aimY = (indexTip.y + middleTip.y) * 0.5;
      const dx = aimX - rawWristX;
      const dy = aimY - rawWristY;
      const gloveAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const pointingAngle = Math.atan2(dy, dx);

      // Dynamic size based on how close/large the hand is to the camera
      const { scale, openness } = analyzeHandGeometry(landmarks);

      // Mirrored landmarks for 3D articulated finger rendering
      const mirroredLandmarks = landmarks.map((lm: any) => ({
        x: 1.0 - lm.x,
        y: lm.y,
        z: lm.z || 0
      }));

      const handedness = results.multiHandedness?.[handIndex]?.label || '';
      playerHands[pIdx].push({
        clampedX,
        clampedY,
        rawX,
        rawY,
        gloveAngle,
        pointingAngle,
        scale,
        openness,
        handedness,
        landmarks: mirroredLandmarks
      });
    });

    // Update each player's hands, weapons, and biomechanical head cues
    [0, 1].forEach(pIdx => {
      if (pIdx === 1 && !is2P) return;
      const player = eng.players[pIdx];
      if (!player) return;

      const handsForPlayer = playerHands[pIdx];
      if (!handsForPlayer || handsForPlayer.length === 0) {
        if (now - (player.lastHandTime || 0) > 450) {
          player.hasDetectedHands = false;
        }
        return;
      }

      player.hasDetectedHands = true;
      player.lastHandTime = now;

      // Sort left-to-right on screen so when 2 hands are visible, left-side hand is leftHand and right-side is rightHand
      handsForPlayer.sort((a, b) => a.clampedX - b.clampedX);

      let fastestHand = handsForPlayer[0];

      if (handsForPlayer.length >= 2) {
        // 2 real hands detected for this player!
        player.lastDualHandTime = now;
        const leftData = handsForPlayer[0];
        const rightData = handsForPlayer[handsForPlayer.length - 1];

        // Update Left Hand
        const lh = player.leftHand;
        lh.prevX = lh.detected ? lh.x : leftData.clampedX;
        lh.prevY = lh.detected ? lh.y : leftData.clampedY;
        lh.x = lh.x + (leftData.clampedX - lh.x) * 0.75;
        lh.y = lh.y + (leftData.clampedY - lh.y) * 0.75;
        lh.vx = lh.x - lh.prevX;
        lh.vy = lh.y - lh.prevY;
        lh.speed = Math.hypot(lh.vx, lh.vy);
        lh.angle = leftData.gloveAngle;
        lh.scale = lh.scale + (leftData.scale - lh.scale) * 0.45;
        lh.openness = leftData.openness;
        lh.landmarks = leftData.landmarks;
        lh.detected = true;

        // Update Right Hand
        const rh = player.rightHand;
        rh.prevX = rh.detected ? rh.x : rightData.clampedX;
        rh.prevY = rh.detected ? rh.y : rightData.clampedY;
        rh.x = rh.x + (rightData.clampedX - rh.x) * 0.75;
        rh.y = rh.y + (rightData.clampedY - rh.y) * 0.75;
        rh.vx = rh.x - rh.prevX;
        rh.vy = rh.y - rh.prevY;
        rh.speed = Math.hypot(rh.vx, rh.vy);
        rh.angle = rightData.gloveAngle;
        rh.scale = rh.scale + (rightData.scale - rh.scale) * 0.45;
        rh.openness = rightData.openness;
        rh.landmarks = rightData.landmarks;
        rh.detected = true;

        fastestHand = rh.speed >= lh.speed
          ? { ...rightData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y }
          : { ...leftData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y };
      } else {
        // 1 hand detected in frame:
        // If 2 hands were just detected (< 520ms ago) and merged into 1 detection because the player clapped them together,
        // bring both gloves together at the clap point!
        const hData = handsForPlayer[0];
        const mergedClap = (now - (player.lastDualHandTime || 0) < 520) &&
          Math.hypot(player.leftHand.x - player.rightHand.x, player.leftHand.y - player.rightHand.y) < 0.22;

        const rh = player.rightHand;
        const lh = player.leftHand;

        rh.prevX = rh.x;
        rh.prevY = rh.y;
        lh.prevX = lh.x;
        lh.prevY = lh.y;

        const moveSpd = Math.hypot(hData.clampedX - rh.x, hData.clampedY - rh.y);
        // If merged clap or rapid swat/pinch, bring the two gloves together so they touch; otherwise keep companion glove slightly apart
        const isRapidClap = mergedClap || moveSpd > 0.026 || hData.openness < 0.65;
        const halfSpread = isRapidClap ? 0.012 : 0.068;

        lh.x = lh.x + ((hData.clampedX - halfSpread) - lh.x) * 0.72;
        lh.y = lh.y + (hData.clampedY - lh.y) * 0.72;
        lh.vx = lh.x - lh.prevX;
        lh.vy = lh.y - lh.prevY;
        lh.speed = Math.hypot(lh.vx, lh.vy);
        lh.angle = -0.22 + (isRapidClap ? 0.22 : 0);
        lh.scale = lh.scale + (hData.scale - lh.scale) * 0.45;
        lh.openness = hData.openness;
        lh.detected = true;

        rh.x = rh.x + ((hData.clampedX + halfSpread) - rh.x) * 0.72;
        rh.y = rh.y + (hData.clampedY - rh.y) * 0.72;
        rh.vx = rh.x - rh.prevX;
        rh.vy = rh.y - rh.prevY;
        rh.speed = Math.hypot(rh.vx, rh.vy);
        rh.angle = 0.22 - (isRapidClap ? 0.22 : 0);
        rh.scale = rh.scale + (hData.scale - rh.scale) * 0.45;
        rh.openness = hData.openness;
        rh.detected = true;

        fastestHand = { ...hData, speed: Math.max(lh.speed, rh.speed), vx: rh.vx, vy: rh.vy, x: hData.clampedX, y: hData.clampedY };
      }

      // Check weapon collision:
      // - In Mosquito mode: ONLY hits a mosquito when Left Glove and Right Glove touch each other!
      // - In Chop mode: slashes fruits with the 3D fencing sword!
      checkHandWeaponCollision(
        pIdx,
        fastestHand.x ?? fastestHand.clampedX,
        fastestHand.y ?? fastestHand.clampedY,
        player.prevHandX,
        player.prevHandY,
        fastestHand.vx || 0,
        fastestHand.vy || 0,
        fastestHand.speed || 0,
        fastestHand.pointingAngle,
        fastestHand.scale,
        cw,
        ch
      );

      // Update primary arm state for sword & trail rendering
      player.handScale = player.handScale + (fastestHand.scale - player.handScale) * 0.45;
      updatePlayerArm(pIdx, fastestHand.x ?? fastestHand.clampedX, fastestHand.y ?? fastestHand.clampedY, fastestHand.pointingAngle, fastestHand.scale);

      // Biomechanical Head Assistance: if optical face detector hasn't updated in the last 180ms,
      // infer head X and depth scale smoothly from the player's tracked hand(s)
      if (now - (player.lastHeadTime || 0) > 180) {
        const avgHandX = handsForPlayer.reduce((acc, h) => acc + h.clampedX, 0) / handsForPlayer.length;
        const minHandY = Math.min(...handsForPlayer.map(h => h.clampedY));
        const maxHandScale = Math.max(...handsForPlayer.map(h => h.scale));

        let targetHeadX = avgHandX;
        if (is2P) {
          targetHeadX = pIdx === 0
            ? Math.min(0.41, Math.max(0.09, targetHeadX))
            : Math.max(0.59, Math.min(0.91, targetHeadX));
        } else {
          targetHeadX = Math.max(0.12, Math.min(0.88, targetHeadX));
        }
        const targetHeadY = Math.max(0.12, Math.min(0.32, minHandY - 0.28));

        player.headX += (targetHeadX - player.headX) * 0.18;
        player.headY += (targetHeadY - player.headY) * 0.15;
        player.headScale += (Math.max(0.75, Math.min(1.45, maxHandScale * 0.92)) - player.headScale) * 0.2;
      }
    });
  };

  // Zero-Collision Head Tracker (Uses native FaceDetector API when available + fast skin/silhouette upper-body centroid)
  const trackHeadsFromVideoFrame = async (video: HTMLVideoElement) => {
    const eng = engineRef.current;
    if (!eng || !video || video.readyState < 2) return;
    const now = performance.now();
    const is2P = eng.numPlayers === 2;

    // 1. Try native Chromium FaceDetector if supported (runs on GPU/OS without touching MediaPipe WASM)
    if (faceDetectorRef.current) {
      try {
        const faces = await faceDetectorRef.current.detect(video);
        if (faces && faces.length > 0) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          faces.forEach((f: any) => {
            const box = f.boundingBox;
            if (!box) return;
            // Mirrored normalized coordinates
            const centerX = 1.0 - ((box.x + box.width * 0.5) / vw);
            const topY = box.y / vh;
            const relWidth = box.width / vw;

            const pIdx = is2P ? (centerX < 0.5 ? 0 : 1) : 0;
            const player = eng.players[pIdx];
            if (!player) return;

            // Strict deadband away from 0.5 center divider so 1 person in the middle never duplicates hats
            if (is2P && centerX > 0.45 && centerX < 0.55) return;

            const clampedX = is2P
              ? (pIdx === 0 ? Math.min(0.41, Math.max(0.08, centerX)) : Math.max(0.59, Math.min(0.92, centerX)))
              : Math.max(0.10, Math.min(0.90, centerX));

            const targetY = Math.max(0.08, Math.min(0.42, topY + (box.height / vh) * 0.12));
            const targetScale = Math.max(0.72, Math.min(1.55, relWidth * 5.2));

            player.headX += (clampedX - player.headX) * 0.45;
            player.headY += (targetY - player.headY) * 0.45;
            player.headScale += (targetScale - player.headScale) * 0.35;
            player.headDetected = true;
            player.lastHeadTime = now;
          });
          return;
        }
      } catch (e) {
        // Fallback to fast canvas skin-tone/head-top tracker below
      }
    }

    // 2. Fast Offscreen Canvas Upper-Body / Face Skin-Tone Centroid Tracker (Zero WASM collision)
    try {
      if (!headTrackCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = 80;
        c.height = 45;
        headTrackCanvasRef.current = c;
      }
      const hc = headTrackCanvasRef.current;
      const hctx = hc.getContext('2d', { willReadFrequently: true });
      if (!hctx) return;

      const W = hc.width;
      const H = hc.height;
      // Draw mirrored frame
      hctx.save();
      hctx.translate(W, 0);
      hctx.scale(-1, 1);
      hctx.drawImage(video, 0, 0, W, H);
      hctx.restore();

      const img = hctx.getImageData(0, 0, W, H).data;

      const scanZone = (pIdx: number, minXNorm: number, maxXNorm: number) => {
        const player = eng.players[pIdx];
        if (!player) return;

        const startX = Math.floor(minXNorm * W);
        const endX = Math.floor(maxXNorm * W);
        const startY = Math.floor(0.05 * H);
        const endY = Math.floor(0.62 * H);

        let sumX = 0;
        let sumY = 0;
        let minSkinY = endY;
        let minSkinX = endX;
        let maxSkinX = startX;
        let count = 0;

        // If player has detected hands, exclude pixels right around their hands so hands don't pull the hat
        const lh = player.leftHand;
        const rh = player.rightHand;

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const nx = x / W;
            const ny = y / H;
            if (lh?.detected && Math.hypot(nx - lh.x, ny - lh.y) < 0.11) continue;
            if (rh?.detected && Math.hypot(nx - rh.x, ny - rh.y) < 0.11) continue;

            const idx = (y * W + x) * 4;
            const r = img[idx];
            const g = img[idx + 1];
            const b = img[idx + 2];

            // Broad multi-tone skin chrominance test (YCbCr / RGB ratio)
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const isSkin = (
              r > 65 && g > 35 && b > 20 &&
              r > g && r > b &&
              (maxC - minC) > 15 &&
              Math.abs(r - g) > 10
            );

            if (isSkin) {
              // Weight upper pixels more strongly (face/forehead is higher than neck/arms)
              const weight = (1.0 - ny) * 2.0;
              sumX += nx * weight;
              sumY += ny * weight;
              count += weight;
              if (y < minSkinY) minSkinY = y;
              if (x < minSkinX) minSkinX = x;
              if (x > maxSkinX) maxSkinX = x;
            }
          }
        }

        if (count > 14) {
          const cx = sumX / count;
          const cy = sumY / count;
          const foreheadY = Math.max(0.08, Math.min(0.42, (minSkinY / H) * 0.45 + cy * 0.55 - 0.04));
          const spanX = (maxSkinX - minSkinX) / W;

          // Combine with hand depth scale if hands are visible
          const faceScale = Math.max(0.75, Math.min(1.48, spanX * 3.8));
          const combinedScale = player.hasDetectedHands
            ? faceScale * 0.55 + player.handScale * 0.45
            : faceScale;

          const clampedX = is2P
            ? (pIdx === 0 ? Math.min(0.41, Math.max(0.09, cx)) : Math.max(0.59, Math.min(0.91, cx)))
            : Math.max(0.10, Math.min(0.90, cx));

          player.headX += (clampedX - player.headX) * 0.32;
          player.headY += (foreheadY - player.headY) * 0.32;
          player.headScale += (combinedScale - player.headScale) * 0.25;
          player.headDetected = true;
          player.lastHeadTime = now;
        } else if (!player.hasDetectedHands && now - (player.lastHeadTime || 0) > 900) {
          // Smoothly drift back to home center if nobody is in this player's court zone
          player.headX += (player.homeX - player.headX) * 0.08;
          player.headY += (0.20 - player.headY) * 0.08;
          player.headScale += (1.0 - player.headScale) * 0.08;
        }
      };

      if (is2P) {
        scanZone(0, 0.04, 0.44);
        scanZone(1, 0.56, 0.96);
      } else {
        scanZone(0, 0.08, 0.92);
      }
    } catch (e) {}
  };

  // Setup camera & initialize MediaPipe Hands (without FaceMesh WASM conflict!)
  const setupCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera API not supported; playing in 3D AR Virtual Mode!");
      return;
    }
    try {
      const win = window as any;

      cameraLoopActiveRef.current = false;
      if (handsRef.current && handsRef.current.close) {
        try { handsRef.current.close(); } catch (e) {}
        handsRef.current = null;
      }

      // Initialize native FaceDetector if available in browser
      if ('FaceDetector' in win && !faceDetectorRef.current) {
        try {
          faceDetectorRef.current = new win.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        } catch (e) {
          faceDetectorRef.current = null;
        }
      }

      // Initialize MediaPipe Hands with fast modelComplexity: 0 (same proven config as YogaQuiz/BubblePop)
      if (win.Hands) {
        const hands = new win.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        hands.setOptions({
          maxNumHands: 4,
          modelComplexity: 0,
          minDetectionConfidence: 0.38,
          minTrackingConfidence: 0.38
        });
        hands.onResults(onHandsResults);
        handsRef.current = hands;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);

        cameraLoopActiveRef.current = true;
        let lastFrameTime = 0;
        let frameCount = 0;
        const TARGET_INTERVAL_MS = 22; // ~45 FPS low-latency hand & head tracking

        const sendCameraFrames = async (time: number) => {
          if (!cameraLoopActiveRef.current || !videoRef.current) return;
          if (
            videoRef.current.readyState >= 2 &&
            !cameraProcessingRef.current &&
            time - lastFrameTime >= TARGET_INTERVAL_MS
          ) {
            cameraProcessingRef.current = true;
            lastFrameTime = time;
            frameCount++;
            try {
              if (handsRef.current) {
                await handsRef.current.send({ image: videoRef.current });
              }
              if (frameCount % 2 === 0) {
                await trackHeadsFromVideoFrame(videoRef.current);
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
      }
    } catch (err: any) {
      console.warn("Camera could not start:", err);
      setCameraActive(false);
      setCameraError("Camera permission denied. Using 3D Virtual AR + Mouse/Touch!");
    }
  };

  const stopCamera = () => {
    cameraLoopActiveRef.current = false;
    stopMosquitoBuzz();
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (handsRef.current && handsRef.current.close) {
      try { handsRef.current.close(); } catch (e) {}
      handsRef.current = null;
    }
    setCameraActive(false);
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

    const roundM = gameMode === 'combo' ? 'mosquito' : gameMode;
    const p1 = createPlayerEngine(0, p1Name || "Player 1", false, playersCount);
    const p2 = createPlayerEngine(1, p2Name || "Player 2", true, playersCount);

    if (playersCount === 2) {
      p1.homeX = 0.25;
      p1.headX = 0.25;
      p1.headY = 0.20;
      p1.handX = 0.25;
      p1.leftHand.x = 0.17;
      p1.rightHand.x = 0.33;

      p2.homeX = 0.75;
      p2.headX = 0.75;
      p2.headY = 0.20;
      p2.handX = 0.75;
      p2.leftHand.x = 0.67;
      p2.rightHand.x = 0.83;
    } else {
      p1.homeX = 0.50;
      p1.headX = 0.50;
      p1.headY = 0.20;
      p1.handX = 0.50;
    }

    // Set engine active BEFORE starting camera so the very first camera frame is processed!
    engineRef.current = {
      isActive: true,
      questions: activeQuestions,
      qIndex: 0,
      timer: 18,
      maxTimer: 18,
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
    setHudScores([0, 0]);
    setHudStreaks([1, 1]);
    setTimerPct(100);
    setScreen('loading');

    try {
      await setupCamera();
    } catch (e) {}

    setTimeout(() => {
      setScreen('game');
      spawnRoundTargets(0, roundM);
      if (activeQuestions[0]) {
        speakText(activeQuestions[0].text);
      }
    }, 380);
  };

  // Target spawning with Dual-Team ABCD options in 2-Player mode
  const spawnRoundTargets = (qIdx: number, mode: 'mosquito' | 'chop') => {
    const qObj = engineRef.current.questions[qIdx];
    if (!qObj) return;

    const width = containerRef.current?.clientWidth || 960;
    const height = containerRef.current?.clientHeight || 540;
    const opts = qObj.options || ["", "", "", ""];
    const targets: any[] = [];
    const is2P = engineRef.current.numPlayers === 2;

    if (mode === 'mosquito') {
      startMosquitoBuzz();

      if (!is2P) {
        opts.forEach((optText, i) => {
          const colX = (i % 2 === 0) ? width * (0.20 + Math.random() * 0.14) : width * (0.66 + Math.random() * 0.14);
          const rowY = (i < 2) ? height * (0.30 + Math.random() * 0.12) : height * (0.62 + Math.random() * 0.12);
          const angle = Math.random() * Math.PI * 2;
          const baseSpeed = (2.1 + Math.random() * 1.1) * speed;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'all',
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            radius: 58,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });
      } else {
        // 2 Players: Team 1 (Left Court) & Team 2 (Right Court) each get A, B, C, D
        opts.forEach((optText, i) => {
          const colX = width * (0.11 + (i % 2) * 0.21 + Math.random() * 0.04);
          const rowY = height * (0.30 + Math.floor(i / 2) * 0.34 + Math.random() * 0.05);
          const angle = Math.random() * Math.PI * 2;
          const baseSpeed = (1.9 + Math.random() * 1.0) * speed;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p1',
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            wobblePhase: Math.random() * 10,
            wingPhase: Math.random() * 10,
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });

        opts.forEach((optText, i) => {
          const colX = width * (0.59 + (i % 2) * 0.21 + Math.random() * 0.04);
          const rowY = height * (0.30 + Math.floor(i / 2) * 0.34 + Math.random() * 0.05);
          const angle = Math.random() * Math.PI * 2;
          const baseSpeed = (1.9 + Math.random() * 1.0) * speed;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p2',
            x: colX,
            y: rowY,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            wobblePhase: Math.random() * 10 + 5,
            wingPhase: Math.random() * 10 + 5,
            radius: 54,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });
      }
    } else {
      stopMosquitoBuzz();

      if (!is2P) {
        opts.forEach((optText, i) => {
          const launchX = width * (0.18 + (i / Math.max(1, opts.length - 1)) * 0.64);
          const vy = -(10.2 + Math.random() * 2.4) * Math.sqrt(speed);
          const vx = (Math.random() - 0.5) * 2.8 * speed;

          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'all',
            x: launchX,
            y: height + 40 + i * 18,
            vx,
            vy,
            gravity: 0.20,
            radius: 56,
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.07,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });
      } else {
        opts.forEach((optText, i) => {
          const launchX = width * (0.11 + (i / Math.max(1, opts.length - 1)) * 0.28);
          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p1',
            x: launchX,
            y: height + 40 + i * 16,
            vx: (Math.random() - 0.5) * 2.0 * speed,
            vy: -(10.0 + Math.random() * 2.2) * Math.sqrt(speed),
            gravity: 0.20,
            radius: 52,
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.07,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });

        opts.forEach((optText, i) => {
          const launchX = width * (0.60 + (i / Math.max(1, opts.length - 1)) * 0.28);
          targets.push({
            optionIndex: i,
            letter: OPTION_LETTERS[i] || '?',
            text: optText || `Option ${i + 1}`,
            isCorrect: i === qObj.answerIndex,
            team: 'p2',
            x: launchX,
            y: height + 40 + i * 16,
            vx: (Math.random() - 0.5) * 2.0 * speed,
            vy: -(10.0 + Math.random() * 2.2) * Math.sqrt(speed),
            gravity: 0.20,
            radius: 52,
            rotation: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.07,
            color: OPTION_COLORS[i % OPTION_COLORS.length],
            alive: true,
            cooldown: 0
          });
        });
      }
    }

    engineRef.current.targets = targets;
    engineRef.current.timer = 18;
    engineRef.current.resolved = false;
  };

  // Launch fresh fruit wave in chop chop if all fell
  const launchFruitWave = () => {
    const qObj = engineRef.current.questions[engineRef.current.qIndex];
    if (!qObj) return;
    const width = containerRef.current?.clientWidth || 960;
    const height = containerRef.current?.clientHeight || 540;
    const is2P = engineRef.current.numPlayers === 2;

    engineRef.current.targets.forEach((t, i) => {
      if (!t.alive) return;
      if (!is2P) {
        t.x = width * (0.18 + (i / Math.max(1, engineRef.current.targets.length - 1)) * 0.64);
      } else {
        if (t.team === 'p1') {
          t.x = width * (0.11 + (t.optionIndex / 3) * 0.28);
        } else {
          t.x = width * (0.60 + (t.optionIndex / 3) * 0.28);
        }
      }
      t.y = height + 40 + (t.optionIndex % 4) * 16;
      t.vy = -(10.0 + Math.random() * 2.2) * Math.sqrt(speed);
      t.vx = (Math.random() - 0.5) * 2.4 * speed;
    });
  };

  // Handle interaction hit (slap or slash)
  const handleTargetHit = (playerIdx: number, target: any) => {
    if (engineRef.current.resolved || !target.alive) return;
    const eng = engineRef.current;
    const p = eng.players[playerIdx];
    if (!p) return;

    // Enforce Court Team Lock: Player 1 cannot hit Player 2's targets and vice versa
    if (eng.numPlayers === 2) {
      if (playerIdx === 0 && target.team === 'p2') return;
      if (playerIdx === 1 && target.team === 'p1') return;
    }

    // Add impact shockwave ring & screen shake
    eng.shockwaves.push({
      x: target.x,
      y: target.y,
      radius: 16,
      maxRadius: target.isCorrect ? 130 : 75,
      color: target.isCorrect ? '#4ade80' : '#f87171',
      alpha: 1.0
    });

    if (target.isCorrect) {
      eng.resolved = true;
      target.alive = false;
      eng.screenShake = 12;
      stopMosquitoBuzz();

      p.hits++;
      const addedPoints = 100 * p.streak;
      p.score += addedPoints;
      p.streak = Math.min(10, p.streak + 1);

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('correct'), 85);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = `+${addedPoints}!`;
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1200);

      // Juicy Particle Bursts
      spawnBurstParticles(target.x, target.y, target.color.main, 36);
      spawnBurstParticles(target.x, target.y, '#ffffff', 12);
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
      spawnFloatingText(target.x, target.y - 24, `${teamPrefix}💥 SMASH! +${addedPoints}`, '#4ade80');

      setTimeout(() => {
        if (!engineRef.current.isActive) return;
        const nextIdx = engineRef.current.qIndex + 1;
        if (nextIdx >= engineRef.current.questions.length) {
          finishGame();
        } else {
          engineRef.current.qIndex = nextIdx;
          setCurrentQIndex(nextIdx);
          const nextRoundMode = gameMode === 'combo' ? (nextIdx % 2 === 0 ? 'mosquito' : 'chop') : gameMode;
          engineRef.current.roundMode = nextRoundMode;
          setActiveRoundMode(nextRoundMode);
          spawnRoundTargets(nextIdx, nextRoundMode);
          if (engineRef.current.questions[nextIdx]) {
            speakText(engineRef.current.questions[nextIdx].text);
          }
        }
      }, 1500);

    } else {
      p.streak = 1;
      eng.screenShake = 6;
      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('wrong'), 60);
      target.cooldown = 36;
      // Knockback bounce on wrong target
      target.vx = -target.vx * 1.25;
      target.vy = -Math.abs(target.vy) - 2.5;
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      spawnFloatingText(target.x, target.y - 18, `❌ OOPS! Try Again`, '#f87171');
      spawnBurstParticles(target.x, target.y, '#94a3b8', 16);
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
        vx: (target.vx || 0) + side * (4.2 + Math.random() * 1.8),
        vy: -5.0 - Math.random() * 2.2,
        rotation: target.rotation || 0,
        rotSpeed: side * 0.16,
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
    stopMosquitoBuzz();
    engineRef.current.isActive = false;
    setScreen('results');
  };

  // Unified collision check:
  // - In Mosquito Slap Mode: ONLY hits a mosquito when the player's Left Glove and Right Glove touch each other!
  // - In Chop Mode: slashes fruits with the 3D Fencing Sword!
  const checkHandWeaponCollision = (
    pIdx: number,
    normX: number,
    normY: number,
    prevNormX: number,
    prevNormY: number,
    vx: number,
    vy: number,
    handSpeed: number,
    pointingAngle: number | undefined,
    handScale: number,
    cw: number,
    ch: number
  ) => {
    const eng = engineRef.current;
    if (!eng || eng.resolved) return;
    const p = eng.players[pIdx];
    if (!p) return;

    const hx = normX * cw;
    const hy = normY * ch;
    const prevHx = prevNormX * cw;
    const prevHy = prevNormY * ch;

    if (eng.roundMode === 'chop') {
      // Responsive Sword Angle: blend wrist->finger pointing angle with slash motion vector
      let bladeAngle = p.swordAngle;
      if (handSpeed > 0.008) {
        const velAngle = Math.atan2(vy * ch, vx * cw);
        bladeAngle = pointingAngle !== undefined
          ? Math.atan2(
              Math.sin(velAngle) * 0.65 + Math.sin(pointingAngle) * 0.35,
              Math.cos(velAngle) * 0.65 + Math.cos(pointingAngle) * 0.35
            )
          : velAngle;
      } else if (pointingAngle !== undefined) {
        bladeAngle = pointingAngle;
      }
      p.swordAngle = bladeAngle;
      if (handSpeed > 0.006) {
        p.swordLunge = Math.min(1.0, p.swordLunge + handSpeed * 9);
      }

      const bladeLen = Math.max(250, cw * 0.29) * Math.max(0.85, Math.min(1.35, handScale));
      const tipX = hx + Math.cos(bladeAngle) * bladeLen;
      const tipY = hy + Math.sin(bladeAngle) * bladeLen;
      const midX = hx + Math.cos(bladeAngle) * (bladeLen * 0.55);
      const midY = hy + Math.sin(bladeAngle) * (bladeLen * 0.55);

      // Check both blade segment AND hand-path segment so fast slashes never skip over a fruit
      eng.targets.forEach(t => {
        if (!t.alive || t.cooldown > 0) return;
        if (eng.numPlayers === 2) {
          if (pIdx === 0 && t.team === 'p2') return;
          if (pIdx === 1 && t.team === 'p1') return;
        }
        const distBlade = distToSegment({ x: t.x, y: t.y }, { x: hx, y: hy }, { x: tipX, y: tipY });
        const distSweep = distToSegment({ x: t.x, y: t.y }, { x: prevHx, y: prevHy }, { x: midX, y: midY });
        const hitRadius = t.radius + 32 * Math.max(0.9, handScale * 0.85);
        if (distBlade < hitRadius || distSweep < hitRadius) {
          p.swordLunge = 1.0;
          handleTargetHit(pIdx, t);
        }
      });
    } else {
      // Mosquito Slap Mode: ONLY hit the mosquito when Left Glove and Right Glove touch each other!
      const lx = (p.leftHand?.x ?? (normX - 0.06)) * cw;
      const ly = (p.leftHand?.y ?? normY) * ch;
      const rx = (p.rightHand?.x ?? (normX + 0.06)) * cw;
      const ry = (p.rightHand?.y ?? normY) * ch;

      const avgScale = Math.max(0.85, ((p.leftHand?.scale || 1.0) + (p.rightHand?.scale || 1.0)) * 0.5);
      const gloveDist = Math.hypot(rx - lx, ry - ly);
      const touchThreshold = 112 * avgScale;

      if (gloveDist <= touchThreshold || (p.clapTimer && p.clapTimer > 0)) {
        // The two gloves are touching each other!
        p.isClapping = true;
        p.slapAnim = 1.0;
        const clapX = (lx + rx) * 0.5;
        const clapY = (ly + ry) * 0.5;
        p.clapMidX = clapX / cw;
        p.clapMidY = clapY / ch;

        const prevClapX = (((p.leftHand?.prevX ?? p.leftHand?.x ?? normX) + (p.rightHand?.prevX ?? p.rightHand?.x ?? normX)) * 0.5) * cw;
        const prevClapY = (((p.leftHand?.prevY ?? p.leftHand?.y ?? normY) + (p.rightHand?.prevY ?? p.rightHand?.y ?? normY)) * 0.5) * ch;

        const hitRadiusBonus = 52 * avgScale;
        eng.targets.forEach(t => {
          if (!t.alive || t.cooldown > 0) return;
          if (eng.numPlayers === 2) {
            if (pIdx === 0 && t.team === 'p2') return;
            if (pIdx === 1 && t.team === 'p1') return;
          }
          const d = distToSegment({ x: t.x, y: t.y }, { x: prevClapX, y: prevClapY }, { x: clapX, y: clapY });
          if (d < t.radius + hitRadiusBonus) {
            handleTargetHit(pIdx, t);
          }
        });
      } else {
        p.isClapping = false;
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
      // Keep the two virtual gloves apart while moving the mouse/finger unless actively pressing down to clap!
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

    // Bring Left Glove and Right Glove together to physically touch/clap at the click point!
    p.clapTimer = 0.28;
    p.isClapping = true;
    p.slapAnim = 1.0;
    p.swordLunge = 1.0;
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

    if (p.speed > 0.0025) {
      const moveAngle = Math.atan2(p.vy * ch, p.vx * cw);
      if (pointingAngle !== undefined) {
        p.swordAngle = Math.atan2(
          Math.sin(moveAngle) * 0.6 + Math.sin(pointingAngle) * 0.4,
          Math.cos(moveAngle) * 0.6 + Math.cos(pointingAngle) * 0.4
        );
      } else {
        p.swordAngle = moveAngle;
      }
      p.swordLunge = Math.min(1.0, p.swordLunge + p.speed * 8);
    } else if (pointingAngle !== undefined) {
      p.swordAngle = pointingAngle;
    }

    const bladeLen = Math.max(250, cw * 0.29) * Math.max(0.85, Math.min(1.35, handScale || p.handScale || 1.0));
    const hx = p.handX * cw;
    const hy = p.handY * ch;
    const tipX = hx + Math.cos(p.swordAngle) * bladeLen;
    const tipY = hy + Math.sin(p.swordAngle) * bladeLen;

    p.trail.push({ x: p.handX, y: p.handY, tipX: tipX / cw, tipY: tipY / ch, life: 1.0 });
    if (p.trail.length > 22) p.trail.shift();

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

        // Timer Update (Pause timer when Settings Modal is open)
        if (!eng.resolved && !showSettingsModal) {
          eng.timer = Math.max(0, eng.timer - dt);
          setTimerPct((eng.timer / eng.maxTimer) * 100);
          if (eng.timer <= 0) {
            eng.resolved = true;
            const qObj = eng.questions[eng.qIndex];
            const correctLetter = qObj ? OPTION_LETTERS[qObj.answerIndex] : '';
            spawnFloatingText(cw / 2, ch / 2, `⏰ TIME UP! Correct was ${correctLetter}`, '#f59e0b');
            playSoundEffect('wrong');
            setTimeout(() => {
              if (!eng.isActive) return;
              const nIdx = eng.qIndex + 1;
              if (nIdx >= eng.questions.length) {
                finishGame();
              } else {
                eng.qIndex = nIdx;
                setCurrentQIndex(nIdx);
                const nextMode = gameMode === 'combo' ? (nIdx % 2 === 0 ? 'mosquito' : 'chop') : gameMode;
                eng.roundMode = nextMode;
                setActiveRoundMode(nextMode);
                spawnRoundTargets(nIdx, nextMode);
                if (eng.questions[nIdx]) speakText(eng.questions[nIdx].text);
              }
            }, 1400);
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

        // 1. Draw Bright Light 3D Arena or Clean Camera Feed (No dark vignette!)
        ctx.clearRect(-20, -20, cw + 40, ch + 40);
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.save();
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, cw, ch);
          ctx.restore();
        } else {
          // Sunny Light 3D Sky & Meadow Arena when camera is off (No dark colors!)
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

        // 2. Draw Mode-Specific 3D Headgear (Tracked to Player Head & Dynamic Head Scale)
        if (showHeadgear) {
          eng.players.forEach((p, idx) => {
            if (idx === 1 && eng.numPlayers === 1) return;
            if (eng.roundMode === 'mosquito') {
              drawPurpleMosquitoNetHat(ctx, p, cw, ch);
            } else {
              draw3DFencingMask(ctx, p, cw, ch);
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

        // 4. Update & Draw Targets with Strict Court Separation + Adjustable Movement Style & Speed
        const mvStyle = movementStyleRef.current;
        const moveMult = mvStyle === 'hover' ? 0.14 : mvStyle === 'calm' ? 0.55 : mvStyle === 'zigzag' ? 1.25 : 1.0;

        let aliveFruitCount = 0;
        eng.targets.forEach(t => {
          if (t.cooldown > 0) t.cooldown--;
          if (!t.alive) return;

          if (eng.roundMode === 'mosquito') {
            if (!showSettingsModal) {
              if (mvStyle === 'zigzag') {
                t.x += t.vx * moveMult + Math.sin(now * 0.014 + t.wobblePhase) * 3.4;
                t.y += t.vy * moveMult + Math.cos(now * 0.016 + t.wobblePhase) * 2.8;
              } else if (mvStyle === 'hover') {
                t.x += Math.sin(now * 0.003 + t.wobblePhase) * 0.45;
                t.y += Math.cos(now * 0.004 + t.wobblePhase) * 0.55;
              } else {
                t.x += t.vx * moveMult + Math.sin(now * 0.006 + t.wobblePhase) * 1.15 * moveMult;
                t.y += t.vy * moveMult + Math.cos(now * 0.007 + t.wobblePhase) * 1.15 * moveMult;
              }
            }

            const padTop = 148;
            const padBottom = 92;

            if (t.team === 'p1') {
              if (t.x < 85) { t.x = 85; t.vx = Math.abs(t.vx); }
              if (t.x > (cw / 2) - 85) { t.x = (cw / 2) - 85; t.vx = -Math.abs(t.vx); }
            } else if (t.team === 'p2') {
              if (t.x < (cw / 2) + 85) { t.x = (cw / 2) + 85; t.vx = Math.abs(t.vx); }
              if (t.x > cw - 85) { t.x = cw - 85; t.vx = -Math.abs(t.vx); }
            } else {
              if (t.x < 95) { t.x = 95; t.vx = Math.abs(t.vx); }
              if (t.x > cw - 95) { t.x = cw - 95; t.vx = -Math.abs(t.vx); }
            }

            if (t.y < padTop) { t.y = padTop; t.vy = Math.abs(t.vy); }
            if (t.y > ch - padBottom) { t.y = ch - padBottom; t.vy = -Math.abs(t.vy); }

            drawMosquitoTarget(ctx, t, now);
          } else {
            if (!showSettingsModal) {
              t.x += t.vx * moveMult;
              t.y += t.vy * (mvStyle === 'calm' ? 0.8 : 1.0);
              t.vy += t.gravity * (mvStyle === 'calm' ? 0.72 : 1.0);
              t.rotation += t.rotSpeed * moveMult;
            }

            if (t.team === 'p1') {
              if (t.x < 75) { t.x = 75; t.vx = Math.abs(t.vx); }
              if (t.x > (cw / 2) - 75) { t.x = (cw / 2) - 75; t.vx = -Math.abs(t.vx); }
            } else if (t.team === 'p2') {
              if (t.x < (cw / 2) + 75) { t.x = (cw / 2) + 75; t.vx = Math.abs(t.vx); }
              if (t.x > cw - 75) { t.x = cw - 75; t.vx = -Math.abs(t.vx); }
            } else {
              if (t.x < 85) { t.x = 85; t.vx = Math.abs(t.vx); }
              if (t.x > cw - 85) { t.x = cw - 85; t.vx = -Math.abs(t.vx); }
            }

            if (t.y < ch + 120) {
              aliveFruitCount++;
            }
            drawFruitTarget(ctx, t);
          }
        });

        if (eng.roundMode === 'chop' && !eng.resolved && aliveFruitCount === 0) {
          launchFruitWave();
        }

        // 5. Draw Weapons (Unified 3D Connected Gloves with Clap-to-Hit Indicator, or 3D Fencing Swords)
        eng.players.forEach((p, idx) => {
          if (idx === 1 && eng.numPlayers === 1) return;
          p.slapAnim = Math.max(0, p.slapAnim - dt * 3.8);
          p.swordLunge = Math.max(0, p.swordLunge - dt * 3.2);
          if (p.clapTimer > 0) {
            p.clapTimer = Math.max(0, p.clapTimer - dt);
            if (p.clapTimer === 0 && !p.hasDetectedHands) {
              p.isClapping = false;
              // Gently separate virtual gloves after a mouse/touch clap finishes
              p.leftHand.x = p.handX - 0.056;
              p.rightHand.x = p.handX + 0.056;
            }
          }

          for (let t = p.trail.length - 1; t >= 0; t--) {
            p.trail[t].life -= dt * 3.6;
            if (p.trail[t].life <= 0) p.trail.splice(t, 1);
          }

          if (eng.roundMode === 'mosquito') {
            const baseScale = Math.max(0.88, Math.min(1.28, cw / 960));

            const lx = (p.leftHand?.x ?? (p.handX - 0.056)) * cw;
            const ly = (p.leftHand?.y ?? p.handY) * ch;
            const rx = (p.rightHand?.x ?? (p.handX + 0.056)) * cw;
            const ry = (p.rightHand?.y ?? p.handY) * ch;

            const leftScale = baseScale * (p.leftHand?.scale || p.handScale || 1.0);
            const rightScale = baseScale * (p.rightHand?.scale || p.handScale || 1.0);
            const gloveDist = Math.hypot(rx - lx, ry - ly);
            const isTouching = gloveDist <= 112 * ((leftScale + rightScale) * 0.5) || p.isClapping;

            // Draw Left 3D Connected Glove
            drawSingleCartoonGlove(
              ctx,
              lx,
              ly,
              p.hasDetectedHands ? (p.leftHand?.angle || -0.18) : (-0.20 + p.slapAnim * 0.25),
              leftScale,
              false,
              p.theme,
              isTouching ? Math.max(0.4, p.slapAnim) : 0,
              p.leftHand?.openness ?? 1.0
            );

            // Draw Right 3D Connected Glove
            drawSingleCartoonGlove(
              ctx,
              rx,
              ry,
              p.hasDetectedHands ? (p.rightHand?.angle || 0.18) : (0.20 - p.slapAnim * 0.25),
              rightScale,
              true,
              p.theme,
              isTouching ? Math.max(0.4, p.slapAnim) : 0,
              p.rightHand?.openness ?? 1.0
            );

            // Visual 3D CLAP Burst when Left & Right Gloves touch each other!
            if (isTouching) {
              const midX = (lx + rx) * 0.5;
              const midY = (ly + ry) * 0.5;
              ctx.save();
              ctx.translate(midX, midY);
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(0, 0, 28 + p.slapAnim * 22, 0, Math.PI * 2);
              ctx.stroke();

              // Starburst rays on clap contact
              for (let r = 0; r < 8; r++) {
                const a = (r / 8) * Math.PI * 2 + now * 0.005;
                ctx.beginPath();
                ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
                ctx.lineTo(Math.cos(a) * (36 + p.slapAnim * 18), Math.sin(a) * (36 + p.slapAnim * 18));
                ctx.stroke();
              }
              ctx.restore();
            }
          } else {
            draw3DFencingSwordAndTrail(ctx, p, cw, ch, now);
          }
        });

        // 6. Shockwaves, Sliced Halves & Particles
        for (let i = eng.shockwaves.length - 1; i >= 0; i--) {
          const sw = eng.shockwaves[i];
          sw.radius += (sw.maxRadius - sw.radius) * 0.22;
          sw.alpha -= dt * 2.2;
          if (sw.alpha <= 0) {
            eng.shockwaves.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, sw.alpha);
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 5 * sw.alpha;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.stroke();
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
      alert("Please log in to save your game!");
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
      onViewChange("games");
    } catch (e: any) {
      console.error("Save error:", e);
      alert("Error saving game. Please try again.");
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

  const drawPurpleMosquitoNetHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.72, Math.min(1.42, cw / 960)) * (p.headScale || 1.0);
    const th = p.theme;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);

    // 1. Subtle 3D Translucent Explorer Mesh Veil (Draped cleanly to the sides so the player's eyes & face are 100% clear)
    const veilTopY = -34;
    const veilBottomY = 48;
    const veilTopHalfW = 122;
    const veilBotHalfW = 112;

    const veilGrad = ctx.createLinearGradient(-veilTopHalfW, 0, veilTopHalfW, 0);
    veilGrad.addColorStop(0, 'rgba(255, 255, 255, 0.32)');
    veilGrad.addColorStop(0.22, 'rgba(241, 245, 249, 0.08)');
    veilGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.03)');
    veilGrad.addColorStop(0.78, 'rgba(241, 245, 249, 0.08)');
    veilGrad.addColorStop(1, 'rgba(255, 255, 255, 0.32)');

    ctx.fillStyle = veilGrad;
    ctx.beginPath();
    ctx.moveTo(-veilTopHalfW, veilTopY);
    ctx.lineTo(-veilBotHalfW, veilBottomY);
    ctx.quadraticCurveTo(0, veilBottomY + 16, veilBotHalfW, veilBottomY);
    ctx.lineTo(veilTopHalfW, veilTopY);
    ctx.quadraticCurveTo(0, veilTopY - 14, -veilTopHalfW, veilTopY);
    ctx.closePath();
    ctx.fill();

    // Fine 3D Hex/Diamond Netting Grid (stronger at edges, nearly invisible in center over eyes)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -105; x <= 105; x += 18) {
      if (Math.abs(x) < 42) continue; // Keep eye window crystal clear!
      ctx.moveTo(x, veilTopY);
      ctx.lineTo(x * 0.94, veilBottomY + 4);
    }
    for (let y = veilTopY + 14; y <= veilBottomY; y += 16) {
      ctx.moveTo(-110, y);
      ctx.lineTo(-42, y + 2);
      ctx.moveTo(42, y + 2);
      ctx.lineTo(110, y);
    }
    ctx.stroke();
    ctx.restore();

    // 2. 3D Shadow under Hat Brim
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;

    // 3. Volumetric 3D Safari/Pith Crown Dome
    const domeGrad = ctx.createRadialGradient(-26, -104, 8, 0, -78, 98);
    domeGrad.addColorStop(0, '#ffffff');
    domeGrad.addColorStop(0.18, th.hatLight);
    domeGrad.addColorStop(0.58, th.hatMain);
    domeGrad.addColorStop(1, th.hatDark);

    ctx.fillStyle = domeGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-80, -54);
    ctx.bezierCurveTo(-84, -134, 84, -134, 80, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Crown 3D Ribbed Seams & Top Button
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-36, -58);
    ctx.quadraticCurveTo(-28, -110, 0, -116);
    ctx.quadraticCurveTo(28, -110, 36, -58);
    ctx.stroke();

    // Top 3D Vent Knob
    const knobGrad = ctx.createRadialGradient(-3, -120, 1, 0, -118, 12);
    knobGrad.addColorStop(0, '#fde047');
    knobGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = knobGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, -116, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 4. 3D Ribbon Band + Extruded Gold Buckle
    const bandGrad = ctx.createLinearGradient(-80, -70, 80, -56);
    bandGrad.addColorStop(0, th.hatDark);
    bandGrad.addColorStop(0.5, th.band);
    bandGrad.addColorStop(1, th.hatDark);
    ctx.fillStyle = bandGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-80, -72);
    ctx.quadraticCurveTo(0, -86, 80, -72);
    ctx.lineTo(83, -54);
    ctx.quadraticCurveTo(0, -68, -83, -54);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3D Gold Buckle on Hatband
    const buckleGrad = ctx.createLinearGradient(-16, -78, 16, -56);
    buckleGrad.addColorStop(0, '#fef08a');
    buckleGrad.addColorStop(0.5, '#f59e0b');
    buckleGrad.addColorStop(1, '#92400e');
    ctx.fillStyle = buckleGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -18, -77, 36, 18, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = th.band;
    roundRect(ctx, -10, -73, 20, 10, 3);
    ctx.fill();

    // 5. Wide Sculpted 3D Upper Brim
    const brimGrad = ctx.createLinearGradient(-138, -62, 138, -22);
    brimGrad.addColorStop(0, th.hatLight);
    brimGrad.addColorStop(0.5, th.hatMain);
    brimGrad.addColorStop(1, th.hatDark);
    ctx.fillStyle = brimGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-138, -34);
    ctx.quadraticCurveTo(0, -76, 138, -34);
    ctx.quadraticCurveTo(144, -22, 126, -23);
    ctx.quadraticCurveTo(0, -52, -126, -23);
    ctx.quadraticCurveTo(-144, -22, -138, -34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Specular Rim Highlight on Dome
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.ellipse(-28, -92, 22, 9, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const draw3DFencingMask = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.72, Math.min(1.42, cw / 950)) * (p.headScale || 1.0);
    const th = p.theme;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt || 0);
    ctx.scale(baseScale, baseScale);

    // 1. Broad Padded 3D White/Silver Fencing Bib (Gorget) below chin
    const bibGrad = ctx.createRadialGradient(0, 78, 10, 0, 88, 120);
    bibGrad.addColorStop(0, '#ffffff');
    bibGrad.addColorStop(0.5, '#e2e8f0');
    bibGrad.addColorStop(0.85, '#94a3b8');
    bibGrad.addColorStop(1, '#475569');

    ctx.fillStyle = bibGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-70, 6);
    ctx.bezierCurveTo(-74, 38, -102, 54, -98, 88);
    ctx.bezierCurveTo(-96, 134, 96, 134, 98, 88);
    ctx.bezierCurveTo(102, 54, 74, 38, 70, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. 3D Chrome Outer Helmet Frame (Trimmed in Player Team Color)
    const bezelGrad = ctx.createLinearGradient(-85, -115, 85, 80);
    bezelGrad.addColorStop(0, '#ffffff');
    bezelGrad.addColorStop(0.3, th.maskTrim || '#cbd5e1');
    bezelGrad.addColorStop(0.65, th.hatMain);
    bezelGrad.addColorStop(1, '#1e293b');

    ctx.fillStyle = bezelGrad;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -118);
    ctx.bezierCurveTo(88, -118, 88, 10, 0, 74);
    ctx.bezierCurveTo(-88, 10, -88, -118, 0, -118);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. See-Through 3D Curved Wire-Mesh Visor (Translucent so player's real face & eyes are clearly visible!)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -108);
    ctx.bezierCurveTo(76, -108, 76, 4, 0, 62);
    ctx.bezierCurveTo(-76, 4, -76, -108, 0, -108);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
    ctx.fill();
    ctx.clip();

    // 3D Steel Mesh Grid
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.38)';
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 7.5, -112);
      ctx.quadraticCurveTo(i * 8.8, -22, i * 6.5, 66);
      ctx.stroke();
    }
    for (let j = -12; j <= 8; j++) {
      ctx.beginPath();
      ctx.moveTo(-82, j * 8.5);
      ctx.quadraticCurveTo(0, j * 8.5 + j * 1.2, 82, j * 8.5);
      ctx.stroke();
    }

    // Diagonal 3D Chrome Visor Glint
    const visorGlint = ctx.createLinearGradient(-65, -95, 45, 25);
    visorGlint.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
    visorGlint.addColorStop(0.25, 'rgba(255, 255, 255, 0.08)');
    visorGlint.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = visorGlint;
    ctx.fillRect(-85, -115, 170, 190);
    ctx.restore();

    // 4. Center 3D Metallic Crest Ridge
    ctx.fillStyle = th.buckle || '#fbbf24';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    roundRect(ctx, -7, -124, 14, 24, 5);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  // Unified, Connected 3D Cartoon Slap Glove (Seamless connected fingers, thumb, palm pad & wrist cuff)
  const drawSingleCartoonGlove = (
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    angle: number,
    scale: number,
    isRightHand: boolean,
    th: any,
    slapBoost: number,
    openness: number = 1.0
  ) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle);
    const s = Math.max(0.58, Math.min(2.2, scale * (1 + slapBoost * 0.22)));
    ctx.scale(isRightHand ? s : -s, s);

    // 1. Concentric 3D Clap Shockwave Rings when gloves touch
    if (slapBoost > 0.06) {
      ctx.save();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4.5;
      ctx.globalAlpha = slapBoost * 0.85;
      ctx.beginPath();
      ctx.arc(0, -14, 48 + (1 - slapBoost) * 38, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = slapBoost * 0.7;
      ctx.beginPath();
      ctx.arc(0, -14, 32 + (1 - slapBoost) * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const fingerExtend = Math.max(0.76, Math.min(1.18, openness));
    const fingers = [
      { x: -20, y: -28 * fingerExtend, rx: 11.5, ry: 24 * fingerExtend, rot: -0.15 }, // Index
      { x: -6.5, y: -34 * fingerExtend, rx: 12,   ry: 27 * fingerExtend, rot: -0.04 }, // Middle
      { x: 7.5,  y: -31 * fingerExtend, rx: 11.5, ry: 25 * fingerExtend, rot: 0.06 },  // Ring
      { x: 20,   y: -22 * fingerExtend, rx: 10.5, ry: 21 * fingerExtend, rot: 0.18 }   // Pinky
    ];

    // 2. Unified Outer Silhouette Outline & 3D Drop Shadow (So fingers and palm connect as one seamless 3D glove!)
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.38)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = isRightHand ? 4 : -4;
    ctx.shadowOffsetY = 8;

    // Pass A: Draw thick outer outline behind all connected parts
    ctx.fillStyle = th.outline || '#3b0764';
    ctx.strokeStyle = th.outline || '#3b0764';
    ctx.lineWidth = 8.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Thumb outer stroke
    ctx.save();
    ctx.translate(-29, 0);
    ctx.rotate(-0.52 - (openness - 1) * 0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 22, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4 Fingers outer stroke
    fingers.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.beginPath();
      ctx.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    // Palm outer stroke
    ctx.beginPath();
    ctx.moveTo(-31, -18);
    ctx.bezierCurveTo(-37, 12, -31, 36, -22, 44);
    ctx.lineTo(22, 44);
    ctx.bezierCurveTo(32, 36, 35, 12, 29, -16);
    ctx.quadraticCurveTo(0, -30, -31, -18);
    ctx.closePath();
    ctx.stroke();
    ctx.restore(); // End drop shadow

    // Pass B: Fill 3D Volumetric Thumb, Fingers, and Connected Palm (Overlapping seamlessly with NO dark internal ovals!)
    // Thumb 3D Fill
    ctx.save();
    ctx.translate(-29, 0);
    ctx.rotate(-0.52 - (openness - 1) * 0.2);
    const thumbGrad = ctx.createRadialGradient(-4, -8, 2, 0, 0, 24);
    thumbGrad.addColorStop(0, '#ffffff');
    thumbGrad.addColorStop(0.28, th.gloveLight);
    thumbGrad.addColorStop(0.7, th.gloveMain);
    thumbGrad.addColorStop(1, th.gloveDark);
    ctx.fillStyle = thumbGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Thumb Specular Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(-3.5, -9, 4.5, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4 Connected Fingers 3D Fill
    fingers.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      const fGrad = ctx.createRadialGradient(-3, -f.ry * 0.45, 2, 0, 0, f.ry * 1.15);
      fGrad.addColorStop(0, '#ffffff');
      fGrad.addColorStop(0.25, th.gloveLight);
      fGrad.addColorStop(0.68, th.gloveMain);
      fGrad.addColorStop(1, th.gloveDark);
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, f.rx, f.ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fingertip 3D Specular Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
      ctx.beginPath();
      ctx.ellipse(-2.5, -f.ry * 0.48, f.rx * 0.38, f.ry * 0.22, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Subtle 3D Finger Crease Dividers between fingers (only at upper web, blending into palm)
    ctx.strokeStyle = th.gloveDark;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    [-13.5, 0.5, 14].forEach(wx => {
      ctx.beginPath();
      ctx.moveTo(wx, -34 * fingerExtend);
      ctx.lineTo(wx, -16);
      ctx.stroke();
    });

    // Seamless 3D Puffy Palm Cushion (Blends smoothly over finger bases)
    const palmGrad = ctx.createRadialGradient(-10, -12, 6, 0, 6, 48);
    palmGrad.addColorStop(0, '#ffffff');
    palmGrad.addColorStop(0.22, th.gloveLight);
    palmGrad.addColorStop(0.62, th.gloveMain);
    palmGrad.addColorStop(1, th.gloveDark);

    ctx.fillStyle = palmGrad;
    ctx.beginPath();
    ctx.moveTo(-31, -18);
    ctx.bezierCurveTo(-37, 12, -31, 36, -22, 44);
    ctx.lineTo(22, 44);
    ctx.bezierCurveTo(32, 36, 35, 12, 29, -16);
    ctx.quadraticCurveTo(0, -30, -31, -18);
    ctx.closePath();
    ctx.fill();

    // Soft 3D Swatting Target Pad in Center of Palm
    const padGrad = ctx.createRadialGradient(-3, 4, 2, 0, 6, 22);
    padGrad.addColorStop(0, '#ffffff');
    padGrad.addColorStop(0.55, th.gloveLight);
    padGrad.addColorStop(1, th.gloveMain);
    ctx.fillStyle = padGrad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 7, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3D Ribbed White & Gold Wrist Cuff
    const cuffGrad = ctx.createLinearGradient(-26, 36, 26, 62);
    cuffGrad.addColorStop(0, '#ffffff');
    cuffGrad.addColorStop(0.45, '#f1f5f9');
    cuffGrad.addColorStop(0.85, th.gloveLight);
    cuffGrad.addColorStop(1, th.hatMain);

    ctx.fillStyle = cuffGrad;
    ctx.strokeStyle = th.outline || '#3b0764';
    ctx.lineWidth = 4;
    roundRect(ctx, -25, 36, 50, 22, 11);
    ctx.fill();
    ctx.stroke();

    // Gold 3D Star/Button Badge on Wrist Cuff
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = th.outline || '#3b0764';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 47, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const draw3DFencingSwordAndTrail = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number, now: number) => {
    const hx = p.handX * cw;
    const hy = p.handY * ch;
    const dynamicScale = Math.max(0.82, Math.min(1.45, p.handScale || 1.0));
    const baseLen = Math.max(255, Math.min(360, cw * 0.29)) * dynamicScale;
    const bladeLen = baseLen * (1 + (p.swordLunge || 0) * 0.24);

    // 1. Volumetric 3D Glowing Slash Ribbon Trail
    if (p.trail && p.trail.length > 2) {
      ctx.save();
      for (let i = 1; i < p.trail.length; i++) {
        const pt0 = p.trail[i - 1];
        const pt1 = p.trail[i];
        const x0 = (pt0.tipX ?? pt0.x) * cw;
        const y0 = (pt0.tipY ?? pt0.y) * ch;
        const x1 = (pt1.tipX ?? pt1.x) * cw;
        const y1 = (pt1.tipY ?? pt1.y) * ch;

        ctx.strokeStyle = p.theme.swordColor;
        ctx.globalAlpha = pt1.life * 0.52;
        ctx.lineWidth = pt1.life * 28 * dynamicScale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = pt1.life * 0.92;
        ctx.lineWidth = pt1.life * 7 * dynamicScale;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. 3D Fencing Saber & Gloved Hand Grip
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.swordAngle);
    ctx.scale(dynamicScale, dynamicScale);

    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    // Gold & Chrome Knuckle-Bow Guard Loop
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(10, 30);
    ctx.bezierCurveTo(-18, 52, -70, 38, -80, 6);
    ctx.stroke();

    // Ribbed 3D Leather Grip + Tracked Mini Glove Fist
    const gripGrad = ctx.createLinearGradient(-76, -9, -12, 9);
    gripGrad.addColorStop(0, '#475569');
    gripGrad.addColorStop(0.5, '#1e293b');
    gripGrad.addColorStop(1, '#334155');
    ctx.fillStyle = gripGrad;
    roundRect(ctx, -76, -8.5, 64, 17, 5);
    ctx.fill();

    // 3D Gloved Knuckles gripping the hilt
    const fistGrad = ctx.createRadialGradient(-38, -6, 2, -38, 0, 22);
    fistGrad.addColorStop(0, p.theme.gloveLight);
    fistGrad.addColorStop(0.6, p.theme.gloveMain);
    fistGrad.addColorStop(1, p.theme.gloveDark);
    ctx.fillStyle = fistGrad;
    ctx.strokeStyle = p.theme.outline;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -56, -13, 38, 26, 10);
    ctx.fill();
    ctx.stroke();

    // 3D Gold Pommel Counterweight
    const pommelGrad = ctx.createRadialGradient(-84, -3, 1, -82, 0, 12);
    pommelGrad.addColorStop(0, '#fef08a');
    pommelGrad.addColorStop(0.6, '#f59e0b');
    pommelGrad.addColorStop(1, '#78350f');
    ctx.fillStyle = pommelGrad;
    ctx.beginPath();
    ctx.arc(-82, 0, 10.5, 0, Math.PI * 2);
    ctx.fill();

    // Dual-Bevel 3D Steel & Plasma Blade
    const scaledBlade = bladeLen / dynamicScale;
    const upperGrad = ctx.createLinearGradient(12, 0, scaledBlade, 0);
    upperGrad.addColorStop(0, '#ffffff');
    upperGrad.addColorStop(0.55, '#f8fafc');
    upperGrad.addColorStop(1, p.theme.swordColor);
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.moveTo(12, -7.5);
    ctx.lineTo(scaledBlade - 18, -2.5);
    ctx.lineTo(scaledBlade, 0);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();

    const lowerGrad = ctx.createLinearGradient(12, 0, scaledBlade, 0);
    lowerGrad.addColorStop(0, '#64748b');
    lowerGrad.addColorStop(0.6, '#cbd5e1');
    lowerGrad.addColorStop(1, '#f1f5f9');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(scaledBlade, 0);
    ctx.lineTo(scaledBlade - 18, 2.5);
    ctx.lineTo(12, 7.5);
    ctx.closePath();
    ctx.fill();

    // 3D Chrome Bell Guard (Cup Hilt)
    const bellGrad = ctx.createRadialGradient(4, -12, 3, 2, 0, 36);
    bellGrad.addColorStop(0, '#ffffff');
    bellGrad.addColorStop(0.35, p.theme.maskTrim || '#e2e8f0');
    bellGrad.addColorStop(0.75, p.theme.hatMain);
    bellGrad.addColorStop(1, '#334155');
    ctx.fillStyle = bellGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, -32);
    ctx.bezierCurveTo(-20, -30, -20, 30, 15, 32);
    ctx.quadraticCurveTo(22, 0, 15, -32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Star-Glint at Blade Tip
    const glintPulse = 0.8 + Math.sin(now * 0.016) * 0.28;
    ctx.save();
    ctx.translate(scaledBlade, 0);
    ctx.scale(glintPulse, glintPulse);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2.5, -3.5, 16, 0);
      ctx.quadraticCurveTo(2.5, 3.5, 0, 0);
    }
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  // True 3D Volumetric Mosquito + Bright Light 3D Extruded Answer Capsule (Scaled by textSize)
  const drawMosquitoTarget = (ctx: CanvasRenderingContext2D, t: any, time: number) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    const facingLeft = t.vx < 0;
    const bobY = Math.sin(time * 0.012 + t.wobblePhase) * 6;
    ctx.translate(0, bobY);

    // ---------------------------------------------
    // 1. Bright Light-Colored 3D Extruded Option Capsule Below Mosquito
    // ---------------------------------------------
    const tScale = textSizeRef.current || 1.15;
    const fontPx = Math.round(15.5 * tScale);
    const badgeSize = Math.round(38 * Math.max(0.92, tScale * 0.94));
    const cardH = Math.round(48 * Math.max(0.92, tScale * 0.94));
    const cardW = Math.max(Math.round(195 * tScale * 0.9), Math.min(Math.round(320 * tScale), t.text.length * (fontPx * 0.62) + badgeSize + 36));
    const cardY = 34;

    ctx.save();
    // 3D Bottom Extrusion Lip in Vibrant Option Color
    ctx.fillStyle = t.color.dark || '#0284c7';
    roundRect(ctx, -cardW / 2, cardY + 5, cardW, cardH, 16);
    ctx.fill();

    // Main Capsule Body: Crisp Bright White & Sky-Blue 3D Card (No Dark Colors!)
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    const pillGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    pillGrad.addColorStop(0, '#ffffff');
    pillGrad.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = t.color.main;
    ctx.lineWidth = 3.5;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 3D Extruded Option Letter Badge (A, B, C, D)
    const badgeY = cardY + (cardH - badgeSize) / 2;
    const badgeGrad = ctx.createLinearGradient(0, badgeY, 0, badgeY + badgeSize);
    badgeGrad.addColorStop(0, t.color.light);
    badgeGrad.addColorStop(0.35, t.color.main);
    badgeGrad.addColorStop(1, t.color.dark);
    ctx.fillStyle = badgeGrad;
    roundRect(ctx, -cardW / 2 + 6, badgeY, badgeSize, badgeSize, 11);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(21 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 6 + badgeSize / 2, cardY + cardH / 2);

    // High-Contrast Dark Slate Option Answer Text on Bright White Capsule
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${fontPx}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const maxChars = 24;
    const displayStr = t.text.length > maxChars ? t.text.slice(0, maxChars - 1) + '…' : t.text;
    ctx.fillText(displayStr, -cardW / 2 + badgeSize + 14, cardY + cardH / 2);

    // ---------------------------------------------
    // 2. Volumetric 3D Cartoon Mosquito (Friendly Bright 3D Colors)
    // ---------------------------------------------
    ctx.save();
    if (!facingLeft) ctx.scale(-1, 1);

    const wingFlap = Math.sin(time * 0.15 + t.wingPhase) * 0.72;

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

    // 6 Articulated 3D Insect Legs
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let legIdx = 0; legIdx < 3; legIdx++) {
      const legOffset = legIdx * 10 - 6;
      const legWiggle = Math.sin(time * 0.022 + legIdx * 1.6) * 4.5;
      ctx.beginPath();
      ctx.moveTo(legOffset, 5);
      ctx.lineTo(legOffset + 7, 17 + legWiggle);
      ctx.lineTo(legOffset + 15, 28 + legWiggle * 0.5);
      ctx.stroke();
    }

    // 3D Segmented Abdomen with Vibrant Option-Colored Stripes
    ctx.save();
    ctx.translate(26, 2);
    ctx.rotate(0.22);
    const abdGrad = ctx.createRadialGradient(-6, -6, 3, 0, 0, 28);
    abdGrad.addColorStop(0, '#94a3b8');
    abdGrad.addColorStop(0.55, '#475569');
    abdGrad.addColorStop(1, '#334155');
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
    stripeGrad.addColorStop(0, t.color.light);
    stripeGrad.addColorStop(0.5, t.color.main);
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

    // 3D Metallic Needle Proboscis
    const needleGrad = ctx.createLinearGradient(-26, -4, -62, -1);
    needleGrad.addColorStop(0, '#64748b');
    needleGrad.addColorStop(0.6, '#f8fafc');
    needleGrad.addColorStop(1, '#ef4444');
    ctx.strokeStyle = needleGrad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-26, -4);
    ctx.lineTo(-60, -1);
    ctx.stroke();

    // Glowing 3D Compound Ruby Eyes
    const eyeGrad = ctx.createRadialGradient(-23, -9, 1, -21, -7, 7);
    eyeGrad.addColorStop(0, '#fca5a5');
    eyeGrad.addColorStop(0.45, '#ef4444');
    eyeGrad.addColorStop(1, '#991b1b');
    ctx.fillStyle = eyeGrad;
    ctx.beginPath();
    ctx.arc(-21, -7.5, 6.2, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.restore();
  };

  // True 3D Volumetric Fruit + Bright Light 3D Option Capsule (Scaled by textSize)
  const drawFruitTarget = (ctx: CanvasRenderingContext2D, t: any) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    // 1. 3D Spherical Fruit Body
    ctx.save();
    ctx.rotate(t.rotation);
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
    ctx.fillStyle = t.color.dark;
    ctx.strokeStyle = t.color.rim;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner Juicy 3D Spherical Flesh
    const fleshGrad = ctx.createRadialGradient(-r * 0.32, -r * 0.32, r * 0.08, 0, 0, r * 0.92);
    fleshGrad.addColorStop(0, '#ffffff');
    fleshGrad.addColorStop(0.22, t.color.light);
    fleshGrad.addColorStop(0.62, t.color.main);
    fleshGrad.addColorStop(1, t.color.dark);
    ctx.fillStyle = fleshGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.fill();

    // Glossy 3D Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Bright Light-Colored 3D Extruded Option Pill
    const tScale = textSizeRef.current || 1.15;
    const fontPx = Math.round(14 * tScale);
    const badgeSize = Math.round(34 * Math.max(0.92, tScale * 0.94));
    const cardH = Math.round(42 * Math.max(0.92, tScale * 0.94));
    const cardW = Math.max(Math.round(165 * tScale * 0.9), Math.min(Math.round(280 * tScale), t.text.length * (fontPx * 0.62) + badgeSize + 30));
    const cardY = r * 0.45;

    ctx.fillStyle = t.color.dark;
    roundRect(ctx, -cardW / 2, cardY + 4, cardW, cardH, 13);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = t.color.main;
    ctx.lineWidth = 3;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 13);
    ctx.fill();
    ctx.stroke();

    const badgeY = cardY + (cardH - badgeSize) / 2;
    ctx.fillStyle = t.color.main;
    roundRect(ctx, -cardW / 2 + 5, badgeY, badgeSize, badgeSize, 9);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `900 ${Math.round(18 * tScale * 0.94)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 5 + badgeSize / 2, cardY + cardH / 2);

    ctx.fillStyle = '#0f172a';
    ctx.font = `800 ${fontPx}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    const displayStr = t.text.length > 22 ? t.text.slice(0, 20) + '…' : t.text;
    ctx.fillText(displayStr, -cardW / 2 + badgeSize + 12, cardY + cardH / 2);

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
      {/* Hidden camera video element */}
      <video ref={videoRef} className="hidden" autoPlay playsInline muted />

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
                <span>🦟 3D Motion AR Camera Arena 🤺</span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-sky-900 drop-shadow-[0_4px_0_rgba(255,255,255,1)] tracking-tight">
                SLAP &amp; CHOP 3D
              </h2>
              <p className="text-slate-700 font-bold text-sm sm:text-base mt-1.5">
                Clap Both 3D Gloves Together to Slap Mosquitoes • Slash 3D Swords to Chop Fruits!
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
                        <span>🤠</span>
                        <span className="absolute -bottom-1.5 -right-1.5 text-lg">🧤</span>
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
                            👏 Clap 2 Gloves to Hit!
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
                        <span className="absolute -bottom-1.5 -right-1.5 text-lg">🤺</span>
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
                        sub: 'Clap 2 Gloves Together!',
                        icon: '🦟',
                        activeClass: 'from-purple-500 to-indigo-600 border-purple-300 border-b-indigo-900 text-white shadow-lg'
                      },
                      {
                        id: 'chop' as const,
                        title: 'Fruit Chop',
                        sub: '3D Saber + Mask',
                        icon: '🤺',
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
                        onClick={() => setGameMode(m.id)}
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
                      🪖 Headgear: {showHeadgear ? 'ON' : 'OFF'}
                    </span>
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
                      🦋 Move: {movementStyle.toUpperCase()}
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
                
                {/* 3D AR Equipment & Clap-to-Hit Info Card */}
                <div className="flex-1 rounded-[2.2rem] bg-white/95 backdrop-blur-xl border-2 border-sky-200 border-b-[10px] border-b-sky-300 shadow-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100 border border-sky-300 text-sky-700 text-[11px] font-black uppercase tracking-wider mb-3">
                      <span>👏 Clap-to-Hit &amp; Depth Tracking</span>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                      How to Play 3D
                    </h3>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed mb-4">
                      Bring both of your 3D gloves together to CLAP mosquitoes, or swing your 3D saber to slice flying fruits!
                    </p>
                  </div>

                  <div className="space-y-3 my-auto">
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-purple-50 border-2 border-purple-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 border-b-4 border-indigo-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🧤
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Touch Gloves to Slap!</div>
                        <div className="text-[11px] font-semibold text-slate-600">Mosquitoes are hit only when your Left &amp; Right gloves touch each other</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-amber-50 border-2 border-amber-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 border-b-4 border-orange-800 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🤺
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">3D Saber &amp; See-Through Mask</div>
                        <div className="text-[11px] font-semibold text-slate-600">Tracks your hand &amp; head size dynamically</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-sky-50 border-2 border-sky-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 border-b-4 border-blue-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        ⚙️
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Full Settings Control</div>
                        <div className="text-[11px] font-semibold text-slate-600">Adjust Text Size, Speed, Movements, Music, Voice &amp; Headgear anytime</div>
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
                  onClick={() => setScreen('study')}
                  className="group relative w-full rounded-[2rem] bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 border-t-2 border-white border-b-[8px] border-b-orange-600 shadow-xl active:translate-y-1 transition-all duration-200 cursor-pointer flex items-center p-6 gap-5 text-left"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white border-b-4 border-amber-600 flex items-center justify-center text-4xl transform group-hover:scale-110 group-hover:rotate-6 transition duration-300 shadow-md shrink-0">
                    📖
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-900">
                      Warm Up Before Battle
                    </span>
                    <h3 className="text-2xl font-black text-slate-900">
                      Study Mode
                    </h3>
                    <p className="text-slate-800 font-bold text-xs mt-0.5">
                      Review all {activeQuiz.questions.length} questions &amp; answers!
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
            🦟
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Preparing Sunny 3D Arena...</h2>
          <p className="text-slate-600 font-bold text-sm max-w-sm">Calibrating 3D Gloves, Net Hat, Fencing Mask &amp; Camera Sensors!</p>
        </div>
      )}

      {/* Screen 4: Live 3D AR Motion Game Arena (Light Theme HUD + Big Question Banner without Redundant ABCD Options) */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 flex flex-col w-full h-full overflow-hidden select-none">
          
          {/* BRIGHT LIGHT 3D FLOATING TOP HUD */}
          <div className="relative z-40 w-full px-3 sm:px-6 pt-3 pb-2 pointer-events-auto">
            <div className="max-w-6xl mx-auto flex flex-col gap-2.5">
              
              {/* Row 1: Light 3D Player Score Pills + Center Controls with Settings Button */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                
                {/* Player 1 Pill (Bright White & Purple 3D Card) */}
                <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-purple-300 border-b-4 border-b-purple-500 shadow-md">
                  <span className="text-xl">🧤</span>
                  <span className="text-xs font-black uppercase tracking-wider text-purple-700">{p1Name || "Player 1"}</span>
                  <span className="font-black text-base sm:text-lg text-slate-900 font-mono">{hudScores[0]} pts</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black">
                    🔥 x{hudStreaks[0]}
                  </span>
                  {hudScorePops[0] && (
                    <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm sm:text-base font-black text-white bg-emerald-500 px-3 py-0.5 rounded-full border-2 border-white shadow-lg animate-bounce">
                      {hudScorePops[0]}
                    </span>
                  )}
                </div>

                {/* Center Controls (Light 3D Pills + ⚙️ Settings Button) */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="px-3.5 py-1.5 rounded-2xl bg-white/95 border-2 border-sky-300 border-b-4 border-b-sky-400 text-xs font-black text-sky-800 shadow-sm">
                    Round {currentQIndex + 1} / {activeQuiz.questions.length}
                  </span>

                  <button
                    onClick={() => {
                      const nextM = activeRoundMode === 'mosquito' ? 'chop' : 'mosquito';
                      setActiveRoundMode(nextM);
                      engineRef.current.roundMode = nextM;
                      spawnRoundTargets(currentQIndex, nextM);
                    }}
                    className="px-3.5 py-1.5 rounded-2xl bg-white/95 hover:bg-sky-50 border-2 border-purple-300 border-b-4 border-b-purple-400 text-xs font-black text-purple-800 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>{activeRoundMode === 'mosquito' ? '🦟 SLAP MODE' : '🤺 CHOP MODE'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (cameraActive) stopCamera();
                      else setupCamera();
                    }}
                    className="px-3.5 py-1.5 rounded-2xl bg-white/95 hover:bg-sky-50 border-2 border-sky-300 border-b-4 border-b-sky-400 text-xs font-black text-sky-800 transition cursor-pointer shadow-sm"
                  >
                    {cameraActive ? '📷 Cam: ON' : '📷 Cam: Virtual'}
                  </button>

                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="px-4 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 border-t border-amber-200 border-b-4 border-b-amber-600 text-xs font-black text-slate-900 transition shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚙️ Settings</span>
                  </button>

                  <FullscreenButton targetId="slap-and-chop-container" className="bg-white/95 hover:bg-sky-50 border-2 border-sky-300 border-b-4 border-b-sky-400 text-slate-800 !py-1.5 !px-3" />
                </div>

                {/* Player 2 Pill (if 2P - Bright White & Rose 3D Card) */}
                {numPlayers === 2 && (
                  <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border-2 border-rose-300 border-b-4 border-b-rose-500 shadow-md">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black">
                      🔥 x{hudStreaks[1]}
                    </span>
                    <span className="font-black text-base sm:text-lg text-slate-900 font-mono">{hudScores[1]} pts</span>
                    <span className="text-xs font-black uppercase tracking-wider text-rose-700">{p2Name || "Player 2"}</span>
                    <span className="text-xl">🧤</span>
                    {hudScorePops[1] && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm sm:text-base font-black text-white bg-emerald-500 px-3 py-0.5 rounded-full border-2 border-white shadow-lg animate-bounce">
                        {hudScorePops[1]}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: BIGGER, BRIGHT LIGHT 3D QUESTION BANNER (Redundant A/B/C/D options below question removed!) */}
              <div className="relative overflow-hidden rounded-3xl bg-white/95 backdrop-blur-xl px-6 py-4 sm:py-5 text-center shadow-[0_12px_32px_rgba(14,165,233,0.22)] border-2 border-sky-300 border-b-[7px] border-b-sky-500 max-w-5xl mx-auto w-full flex items-center justify-between gap-4">
                {/* Sunny Progress Timer Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-sky-100">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-sky-400 to-amber-400 transition-all duration-100"
                    style={{ width: `${timerPct}%` }}
                  />
                </div>

                <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-sky-100 border-2 border-sky-300 items-center justify-center text-2xl font-black text-sky-700 shrink-0">
                  Q{currentQIndex + 1}
                </div>

                <p
                  className="flex-1 font-black text-slate-900 tracking-tight leading-snug"
                  style={{ fontSize: `${Math.round(24 * textSize)}px` }}
                >
                  {currentQ?.text || "Loading question..."}
                </p>

                <button
                  type="button"
                  onClick={() => currentQ?.text && speakText(currentQ.text)}
                  title="Read Question Aloud"
                  className="w-11 h-11 rounded-2xl bg-sky-100 hover:bg-sky-200 border-2 border-sky-300 flex items-center justify-center text-xl shrink-0 cursor-pointer transition"
                >
                  🔊
                </button>
              </div>

            </div>
          </div>

          {/* High-Resolution 3D Canvas */}
          <div className="relative flex-1 w-full h-full overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerMove={handlePointerMove}
              onPointerDown={handlePointerDown}
              className="w-full h-full block touch-none cursor-crosshair"
            />

            {/* Bottom Light 3D Instruction Pill */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-white/95 backdrop-blur-md border-2 border-sky-300 border-b-4 border-b-sky-500 text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap shadow-lg">
              {activeRoundMode === 'mosquito'
                ? '👏 Bring your Left & Right 3D Gloves together to TOUCH & SLAP the right mosquito!'
                : '🤺 Slash your 3D Fencing Sword across the right fruit to CHOP it!'}
            </div>
          </div>
        </div>
      )}

      {/* 3D LIGHT SETTINGS MODAL (Accessible anytime from Game HUD or Setup Screen) */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-sky-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-[2.2rem] p-6 sm:p-8 border-2 border-sky-200 border-b-[10px] border-b-sky-400 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-slate-900 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-sky-100 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-2xl">
                  ⚙️
                </span>
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Game Settings</h3>
                  <p className="text-xs font-bold text-slate-500">Customize Headgear, Music, Voice, Text Size, Speed &amp; Movements</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 1. Headgear, Music, Sound FX & Voice Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Headgear */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <div>
                  <div className="text-sm font-black text-slate-900">🪖 3D Headgear</div>
                  <div className="text-[11px] font-bold text-slate-500">Net Hat &amp; Fencing Mask</div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHeadgear(!showHeadgear)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-black border-b-4 transition cursor-pointer ${
                    showHeadgear
                      ? 'bg-purple-600 border-purple-900 text-white'
                      : 'bg-slate-200 border-slate-400 text-slate-600'
                  }`}
                >
                  {showHeadgear ? 'ON' : 'OFF'}
                </button>
              </div>

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
                  <div className="text-sm font-black text-slate-900">🔊 Slap &amp; Buzz FX</div>
                  <div className="text-[11px] font-bold text-slate-500">Mosquito &amp; Sword Audio</div>
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

      {/* Screen 5: Bright Light Results Victory Screen */}
      {screen === 'results' && (
        <div className="fixed inset-0 z-50 bg-sky-900/35 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-[2.2rem] p-6 sm:p-8 text-center border-2 border-sky-200 border-b-[10px] border-b-sky-400 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 text-slate-900">
            <div className="text-6xl animate-bounce">🏆</div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-sky-600">Arena Complete!</span>
              <h2 className="text-3xl font-black text-slate-900 mt-1">
                {numPlayers === 2
                  ? (engineRef.current.players[0].score > engineRef.current.players[1].score
                      ? `${p1Name} Wins!`
                      : engineRef.current.players[1].score > engineRef.current.players[0].score
                      ? `${p2Name} Wins!`
                      : 'Epic Tie Game!')
                  : `${p1Name} Scored ${engineRef.current.players[0].score} pts!`}
              </h2>
              <p className="text-sm font-semibold text-slate-600 mt-1">
                Mosquitoes clapped &amp; fruits sliced like a true 3D champion!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-sky-50 p-4 rounded-2xl border-2 border-sky-200">
              <div className="p-3 rounded-xl bg-white border-2 border-purple-200 text-center shadow-sm">
                <div className="text-xs font-black text-purple-700 uppercase">{p1Name || "Player 1"}</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">{engineRef.current.players[0]?.score || 0}</div>
                <div className="text-[11px] font-bold text-slate-500 mt-0.5">{engineRef.current.players[0]?.hits || 0} Hits</div>
              </div>
              <div className={`p-3 rounded-xl text-center bg-white shadow-sm ${numPlayers === 2 ? 'border-2 border-rose-200' : 'border-2 border-sky-200'}`}>
                <div className="text-xs font-black text-rose-600 uppercase">{numPlayers === 2 ? (p2Name || "Player 2") : "Questions"}</div>
                <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                  {numPlayers === 2 ? engineRef.current.players[1]?.score || 0 : activeQuiz.questions.length}
                </div>
                <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                  {numPlayers === 2 ? `${engineRef.current.players[1]?.hits || 0} Hits` : 'Total Completed'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => startGame(numPlayers)}
                className="flex-1 py-3 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 border-b-4 border-emerald-700 text-white font-black transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
              <button
                onClick={() => setScreen('setup')}
                className="flex-1 py-3 px-5 rounded-2xl bg-sky-100 hover:bg-sky-200 text-sky-900 border-b-4 border-sky-300 font-black transition cursor-pointer"
              >
                Game Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 6: Bright Light Study Mode */}
      {screen === 'study' && (
        <div className="absolute inset-0 z-40 bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50 overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
          <div className="w-full max-w-3xl flex items-center justify-between mb-8">
            <button
              onClick={() => setScreen('setup')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-800 font-black transition cursor-pointer shadow-sm"
            >
              <ArrowLeft size={18} className="text-sky-600" />
              <span>Back to Setup</span>
            </button>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>📖 Study Mode</span>
            </h2>
            <button
              onClick={() => startGame(numPlayers)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 border-b-4 border-emerald-700 text-white font-black transition cursor-pointer shadow-md"
            >
              <Play size={18} fill="currentColor" />
              <span>Start Game</span>
            </button>
          </div>

          <div className="w-full max-w-3xl flex flex-col gap-4">
            {activeQuiz.questions.map((q, idx) => (
              <div key={q.id || idx} className="bg-white border-2 border-sky-200 border-b-6 border-b-sky-300 rounded-3xl p-5 shadow-md flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-xl bg-sky-100 border border-sky-300 text-sky-700 font-black flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-lg font-black text-slate-900 flex-1">{q.text}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-11">
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-3 rounded-2xl text-sm font-extrabold flex items-center gap-2.5 ${
                        oIdx === q.answerIndex
                          ? 'bg-emerald-100 text-emerald-900 border-2 border-emerald-400'
                          : 'bg-sky-50 text-slate-700 border-2 border-sky-200'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        oIdx === q.answerIndex ? 'bg-emerald-500 text-white' : 'bg-white border border-sky-300 text-sky-800'
                      }`}>
                        {OPTION_LETTERS[oIdx]}
                      </span>
                      <span>{opt}</span>
                      {oIdx === q.answerIndex && <span className="ml-auto text-xs font-black text-emerald-700">✓ CORRECT</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const [questions, setQuestions] = useState<Question[]>(
    quiz.questions && quiz.questions.length > 0
      ? quiz.questions
      : [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }]
  );

  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string; optIndex: number } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        {/* Exact Bubble Pop Glass Container */}
        <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
          <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer"
                >
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
            {/* Bulk Paste Action Bar with How to Bulk Paste Video Guide Button */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                QUESTIONS ({questions.length})
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

            {/* Questions List */}
            {questions.map((q, index) => (
              <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
                <button
                  type="button"
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
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
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer"
                      />
                      {opt.startsWith('data:image') || opt.startsWith('http') ? (
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 pr-3">
                          <img src={opt} alt="Option" className="w-8 h-8 rounded object-cover" />
                          <span className="text-xs text-slate-400 flex-1 truncate">Image/GIF</span>
                          <button
                            type="button"
                            onClick={() => updateOption(q.id, optIndex, '')}
                            className="text-red-400 hover:text-red-300 cursor-pointer p-1"
                          >
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
                            className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${
                              q.answerIndex === optIndex
                                ? 'border-blue-500/50 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            } rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium`}
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
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 6}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer"
                  >
                    + Option
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(q.id)}
                    disabled={q.options.length <= 2}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer"
                  >
                    - Option
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
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
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">
              Would you like to publish this game to the Community so other teachers can use it?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
              >
                Yes, Publish (Public)
              </button>
              <button
                type="button"
                onClick={() => confirmSave(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
              >
                No, Keep Private
              </button>
              <button
                type="button"
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

      {/* Bulk Paste Modal with Mystery Box 3-Step Guide & Prompt Copy */}
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
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                    Bulk Paste &amp; Auto-Divide
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paste multiple questions, numbered lists with options &amp; answer (e.g. Answer: B), or tabular TSV data.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Watch Video Tutorial"
                >
                  <Play size={13} className="fill-current text-purple-500" />
                  <span>Video Guide</span>
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

            {/* Step-by-step instructions with Video walkthrough & prompt copy */}
            <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Play size={14} className="ml-0.5 fill-current" />
                  </div>
                  <div>
                    <span className="font-black text-sm text-slate-800 dark:text-white block">
                      How to Bulk Paste: 3 Simple Steps
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-purple-600 dark:text-purple-400">1. Prompt AI</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Ask ChatGPT/Claude for multiple-choice questions with answers.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="mt-1 px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedPromptInModal ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    <span>{copiedPromptInModal ? "Copied Prompt!" : "Copy AI Prompt"}</span>
                  </button>
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-blue-600 dark:text-blue-400">2. Copy Output</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Highlight all questions generated by the AI and copy to clipboard.
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">Ctrl+C or ⌘+C</span>
                </div>

                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex flex-col justify-between gap-1.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">3. Paste &amp; Click + Add</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Paste below. Questions, options &amp; answers are auto-divided!
                  </p>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Ready in 1 click!</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Paste Text Below (Supports multi-line Q&amp;A format or Excel copy)
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
                type="button"
                onClick={() => handleApplyBulkPaste('replace')}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                Replace All
              </button>
              <button
                type="button"
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
