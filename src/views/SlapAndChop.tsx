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
  const onHandsResultsRef = useRef<((results: any) => void) | null>(null);

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

  const playSoundEffect = (type: 'slap' | 'slash' | 'correct' | 'wrong' | 'whoosh' | 'freeze' | 'victory' | 'countdown') => {
    if (!soundFxRef.current) return;
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
      // Layer 1: Dual chef chopping knives metallic ring + crisp slice
      const bufferSize = Math.floor(ctx.sampleRate * 0.13);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.75;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(3800, now + 0.11);
      filter.Q.setValueAtTime(2.8, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.8, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.13);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);

      // Layer 2: Steel cleaver chime + juicy chop thud
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1850, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.15);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);

    } else if (type === 'freeze') {
      // Crystalline 3D Ice Freeze Chime + Frost Crackle
      const iceNotes = [1567.98, 1318.51, 1046.5, 783.99];
      iceNotes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const startT = now + idx * 0.045;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.24, startT);
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
        const startT = now + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.3, startT);
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
    } else if (type === 'countdown') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
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
        x: baseX - 0.068,
        y: 0.62,
        prevX: baseX - 0.068,
        prevY: 0.62,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: -0.18,
        knifeAngle: -0.45,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        landmarks: null as any[] | null,
        trail: [] as { x: number; y: number; life: number }[]
      },
      rightHand: {
        x: baseX + 0.068,
        y: 0.62,
        prevX: baseX + 0.068,
        prevY: 0.62,
        vx: 0,
        vy: 0,
        speed: 0,
        angle: 0.18,
        knifeAngle: -2.69,
        scale: 1.0,
        openness: 1.0,
        slapAnim: 0,
        detected: false,
        landmarks: null as any[] | null,
        trail: [] as { x: number; y: number; life: number }[]
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

    const palmLength = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
    const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
    const coreSize = palmLength * 0.62 + palmWidth * 0.48;

    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }
    const bboxDiag = Math.hypot(maxX - minX, maxY - minY);

    const rawScale = (coreSize * 6.8) + (bboxDiag * 1.45);
    const scale = Math.max(0.62, Math.min(1.95, rawScale));

    const avgTipDist = (
      Math.hypot(indexTip.x - wrist.x, indexTip.y - wrist.y) +
      Math.hypot(middleTip.x - wrist.x, middleTip.y - wrist.y) +
      Math.hypot(ringTip.x - wrist.x, ringTip.y - wrist.y) +
      Math.hypot(pinkyTip.x - wrist.x, pinkyTip.y - wrist.y)
    ) / 4;
    const openness = Math.max(0.35, Math.min(1.3, avgTipDist / Math.max(0.04, palmLength * 1.75)));

    return { scale, openness, palmLength };
  };

  // MediaPipe Hands Results Handler (High-precision 60fps hand & weapon tracking for both Slap Gloves & Chop Knives)
  const onHandsResults = (results: any) => {
    const eng = engineRef.current;
    if (!eng) return;
    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const now = performance.now();
    const is2P = eng.numPlayers === 2;

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

    const playerHands: { [key: number]: any[] } = { 0: [], 1: [] };

    results.multiHandLandmarks.forEach((landmarks: any[], handIndex: number) => {
      if (!landmarks || landmarks.length < 21) return;
      const wrist = landmarks[0];
      const middleMcp = landmarks[9];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];

      const rawX = 1.0 - (middleMcp.x * 0.65 + wrist.x * 0.35);
      const rawY = middleMcp.y * 0.65 + wrist.y * 0.35;
      const rawWristX = 1.0 - wrist.x;
      const rawWristY = wrist.y;

      let pIdx = 0;
      if (is2P) {
        pIdx = rawX < 0.5 ? 0 : 1;
      }

      let clampedX = rawX;
      if (is2P) {
        clampedX = pIdx === 0
          ? Math.min(0.465, Math.max(0.04, rawX))
          : Math.max(0.535, Math.min(0.96, rawX));
      } else {
        clampedX = Math.max(0.04, Math.min(0.96, rawX));
      }
      const clampedY = Math.max(0.05, Math.min(0.95, rawY));

      const aimX = 1.0 - ((indexTip.x + middleTip.x) * 0.5);
      const aimY = (indexTip.y + middleTip.y) * 0.5;
      const dx = aimX - rawWristX;
      const dy = aimY - rawWristY;
      const gloveAngle = Math.atan2(dy, dx) + Math.PI / 2;
      const pointingAngle = Math.atan2(dy, dx);

      const { scale, openness } = analyzeHandGeometry(landmarks);

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

      // Sort left-to-right on screen so left-side hand is leftHand and right-side is rightHand
      handsForPlayer.sort((a, b) => a.clampedX - b.clampedX);

      let fastestHand = handsForPlayer[0];

      if (handsForPlayer.length >= 2) {
        player.lastDualHandTime = now;
        const leftData = handsForPlayer[0];
        const rightData = handsForPlayer[handsForPlayer.length - 1];

        // Update Left Hand (Glove & Left Chopping Knife)
        const lh = player.leftHand;
        lh.prevX = lh.detected ? lh.x : leftData.clampedX;
        lh.prevY = lh.detected ? lh.y : leftData.clampedY;
        lh.x = lh.x + (leftData.clampedX - lh.x) * 0.80;
        lh.y = lh.y + (leftData.clampedY - lh.y) * 0.80;
        lh.vx = lh.x - lh.prevX;
        lh.vy = lh.y - lh.prevY;
        lh.speed = Math.hypot(lh.vx, lh.vy);
        lh.angle = leftData.gloveAngle;
        lh.knifeAngle = leftData.pointingAngle;
        lh.scale = lh.scale + (leftData.scale - lh.scale) * 0.48;
        lh.openness = leftData.openness;
        lh.landmarks = leftData.landmarks;
        lh.detected = true;
        lh.trail.push({ x: lh.x, y: lh.y, life: 1.0 });
        if (lh.trail.length > 14) lh.trail.shift();

        // Update Right Hand (Glove & Right Chopping Knife)
        const rh = player.rightHand;
        rh.prevX = rh.detected ? rh.x : rightData.clampedX;
        rh.prevY = rh.detected ? rh.y : rightData.clampedY;
        rh.x = rh.x + (rightData.clampedX - rh.x) * 0.80;
        rh.y = rh.y + (rightData.clampedY - rh.y) * 0.80;
        rh.vx = rh.x - rh.prevX;
        rh.vy = rh.y - rh.prevY;
        rh.speed = Math.hypot(rh.vx, rh.vy);
        rh.angle = rightData.gloveAngle;
        rh.knifeAngle = rightData.pointingAngle;
        rh.scale = rh.scale + (rightData.scale - rh.scale) * 0.48;
        rh.openness = rightData.openness;
        rh.landmarks = rightData.landmarks;
        rh.detected = true;
        rh.trail.push({ x: rh.x, y: rh.y, life: 1.0 });
        if (rh.trail.length > 14) rh.trail.shift();

        fastestHand = rh.speed >= lh.speed
          ? { ...rightData, speed: rh.speed, vx: rh.vx, vy: rh.vy, x: rh.x, y: rh.y }
          : { ...leftData, speed: lh.speed, vx: lh.vx, vy: lh.vy, x: lh.x, y: lh.y };
      } else {
        // 1 hand detected in frame: if 2 hands just merged (< 550ms ago) or rapid chop/slap motion, bring both hands together
        const hData = handsForPlayer[0];
        const mergedClap = (now - (player.lastDualHandTime || 0) < 550) &&
          Math.hypot(player.leftHand.x - player.rightHand.x, player.leftHand.y - player.rightHand.y) < 0.24;

        const rh = player.rightHand;
        const lh = player.leftHand;

        rh.prevX = rh.x;
        rh.prevY = rh.y;
        lh.prevX = lh.x;
        lh.prevY = lh.y;

        const moveSpd = Math.hypot(hData.clampedX - rh.x, hData.clampedY - rh.y);
        const isRapidStrike = mergedClap || moveSpd > 0.022 || hData.openness < 0.68;
        const halfSpread = isRapidStrike ? 0.012 : 0.066;

        lh.x = lh.x + ((hData.clampedX - halfSpread) - lh.x) * 0.76;
        lh.y = lh.y + (hData.clampedY - lh.y) * 0.76;
        lh.vx = lh.x - lh.prevX;
        lh.vy = lh.y - lh.prevY;
        lh.speed = Math.hypot(lh.vx, lh.vy);
        lh.angle = -0.22 + (isRapidStrike ? 0.22 : 0);
        lh.knifeAngle = -0.45 + (isRapidStrike ? 0.35 : 0);
        lh.scale = lh.scale + (hData.scale - lh.scale) * 0.45;
        lh.openness = hData.openness;
        lh.detected = true;
        lh.trail.push({ x: lh.x, y: lh.y, life: 1.0 });
        if (lh.trail.length > 14) lh.trail.shift();

        rh.x = rh.x + ((hData.clampedX + halfSpread) - rh.x) * 0.76;
        rh.y = rh.y + (hData.clampedY - rh.y) * 0.76;
        rh.vx = rh.x - rh.prevX;
        rh.vy = rh.y - rh.prevY;
        rh.speed = Math.hypot(rh.vx, rh.vy);
        rh.angle = 0.22 - (isRapidStrike ? 0.22 : 0);
        rh.knifeAngle = -2.69 - (isRapidStrike ? 0.35 : 0);
        rh.scale = rh.scale + (hData.scale - rh.scale) * 0.45;
        rh.openness = hData.openness;
        rh.detected = true;
        rh.trail.push({ x: rh.x, y: rh.y, life: 1.0 });
        if (rh.trail.length > 14) rh.trail.shift();

        fastestHand = { ...hData, speed: Math.max(lh.speed, rh.speed), vx: rh.vx, vy: rh.vy, x: hData.clampedX, y: hData.clampedY };
      }

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

      player.handScale = player.handScale + (fastestHand.scale - player.handScale) * 0.45;
      updatePlayerArm(pIdx, fastestHand.x ?? fastestHand.clampedX, fastestHand.y ?? fastestHand.clampedY, fastestHand.pointingAngle, fastestHand.scale);

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

  // Always keep latest onHandsResults in ref so MediaPipe never calls a stale closure!
  onHandsResultsRef.current = onHandsResults;

  // Zero-Collision Head Tracker
  const trackHeadsFromVideoFrame = async (video: HTMLVideoElement) => {
    const eng = engineRef.current;
    if (!eng || !video || video.readyState < 2) return;
    const now = performance.now();
    const is2P = eng.numPlayers === 2;

    if (faceDetectorRef.current) {
      try {
        const faces = await faceDetectorRef.current.detect(video);
        if (faces && faces.length > 0) {
          const vw = video.videoWidth || 640;
          const vh = video.videoHeight || 480;

          faces.forEach((f: any) => {
            const box = f.boundingBox;
            if (!box) return;
            const centerX = 1.0 - ((box.x + box.width * 0.5) / vw);
            const topY = box.y / vh;
            const relWidth = box.width / vw;

            const pIdx = is2P ? (centerX < 0.5 ? 0 : 1) : 0;
            const player = eng.players[pIdx];
            if (!player) return;

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
      } catch (e) {}
    }

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

            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            const isSkin = (
              r > 65 && g > 35 && b > 20 &&
              r > g && r > b &&
              (maxC - minC) > 15 &&
              Math.abs(r - g) > 10
            );

            if (isSkin) {
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

  // Setup camera & initialize MediaPipe Hands (Always acquire live camera stream first!)
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
          // Fallback to default video constraints if 1280x720 is not supported by the webcam
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
        } catch (playErr) {
          // Autoplay will resume on next frame
        }
        setCameraActive(true);
        setCameraError(null);
      }

      // 2. Initialize FaceDetector if available
      if ('FaceDetector' in win && !faceDetectorRef.current) {
        try {
          faceDetectorRef.current = new win.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
        } catch (e) {
          faceDetectorRef.current = null;
        }
      }

      // 3. Initialize or reuse MediaPipe Hands (Never call .close() on WASM singleton as it breaks subsequent runs)
      const ensureHandsInitialized = () => {
        if (!handsRef.current && win.Hands) {
          try {
            const hands = new win.Hands({
              locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
            });
            hands.setOptions({
              maxNumHands: 4,
              modelComplexity: 0,
              minDetectionConfidence: 0.36,
              minTrackingConfidence: 0.36
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
            ensureHandsInitialized();
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
      p1.leftHand.x = 0.42;
      p1.rightHand.x = 0.58;
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

  // Target spawning with Dual-Team ABCD options in 2-Player mode (Both Slap Mosquitoes & Chop Fruits float in arena bounds!)
  const spawnRoundTargets = (qIdx: number, mode: 'mosquito' | 'chop') => {
    const qObj = engineRef.current.questions[qIdx];
    if (!qObj) return;

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
    }

    if (!is2P) {
      opts.forEach((optText, i) => {
        const colX = (i % 2 === 0) ? width * (0.20 + Math.random() * 0.14) : width * (0.66 + Math.random() * 0.14);
        const rowY = (i < 2) ? height * (0.32 + Math.random() * 0.12) : height * (0.62 + Math.random() * 0.12);
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = (mode === 'chop' ? 1.85 : 2.1) * curSpd;

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
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.045,
          radius: mode === 'chop' ? 56 : 58,
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
      // 2 Players: Team 1 (Left Court) & Team 2 (Right Court) each get A, B, C, D
      opts.forEach((optText, i) => {
        const colX = width * (0.11 + (i % 2) * 0.21 + Math.random() * 0.04);
        const rowY = height * (0.32 + Math.floor(i / 2) * 0.32 + Math.random() * 0.05);
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = (mode === 'chop' ? 1.7 : 1.9) * curSpd;

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
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.045,
          radius: mode === 'chop' ? 52 : 54,
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
        const colX = width * (0.59 + (i % 2) * 0.21 + Math.random() * 0.04);
        const rowY = height * (0.32 + Math.floor(i / 2) * 0.32 + Math.random() * 0.05);
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = (mode === 'chop' ? 1.7 : 1.9) * curSpd;

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
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.045,
          radius: mode === 'chop' ? 52 : 54,
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

    engineRef.current.targets = targets;
    engineRef.current.resolved = false;
  };

  // Handle interaction hit (Slap or Dual-Knife Chop)
  // Pointing System: +5 Points if Correct, -5 Points & FROZEN if Wrong!
  const handleTargetHit = (playerIdx: number, target: any) => {
    if (engineRef.current.resolved || !target.alive || target.frozen) return;
    const eng = engineRef.current;
    const p = eng.players[playerIdx];
    if (!p || p.frozenTimer > 0) return;

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
      maxRadius: target.isCorrect ? 135 : 85,
      color: target.isCorrect ? '#10b981' : '#38bdf8',
      alpha: 1.0
    });

    if (target.isCorrect) {
      eng.resolved = true;
      target.alive = false;
      eng.screenShake = 12;
      stopMosquitoBuzz();

      p.hits++;
      p.correctHits = (p.correctHits || 0) + 1;
      const addedPoints = 5;
      p.score += addedPoints;
      p.streak = Math.min(10, p.streak + 1);

      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('correct'), 85);

      setHudScores([eng.players[0].score, eng.players[1].score]);
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      setHudScorePops(prev => {
        const next = [...prev] as [string | null, string | null];
        next[playerIdx] = `+5 PTS! 🎉`;
        return next;
      });
      setTimeout(() => {
        setHudScorePops([null, null]);
      }, 1300);

      // Juicy Particle Bursts
      spawnBurstParticles(target.x, target.y, target.color.main, 36);
      spawnBurstParticles(target.x, target.y, '#ffffff', 14);
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
        `${teamPrefix}${eng.roundMode === 'chop' ? '🔪 CHOPPED!' : '👏 SLAPPED!'} +5 PTS`,
        '#10b981'
      );

      // Start the 3-second countdown timer before the next question appears
      startNextQuestionCountdown();

    } else {
      // WRONG WORD HIT -> -5 POINTS & FREEZE IN 3D ICE!
      p.streak = 1;
      p.wrongHits = (p.wrongHits || 0) + 1;
      p.score -= 5;
      p.frozenTimer = 1.6;
      eng.screenShake = 8;

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
      spawnBurstParticles(target.x, target.y, '#38bdf8', 22);
      spawnBurstParticles(target.x, target.y, '#e0f2fe', 14);
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
    clearNextQuestionTimer();
    stopMosquitoBuzz();
    engineRef.current.isActive = false;
    setScreen('results');
    setTimeout(() => playSoundEffect('victory'), 120);
  };

  // Unified collision check:
  // - In Mosquito Slap Mode: ONLY hits a mosquito when the player's Left Glove and Right Glove touch each other!
  // - In Chop Mode: options are CHOPPED when hit by BOTH Left and Right Chopping Knives!
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
    if (!eng || eng.resolved || showSettingsModalRef.current) return;
    const p = eng.players[pIdx];
    if (!p || p.frozenTimer > 0) return;

    const lx = (p.leftHand?.x ?? (normX - 0.06)) * cw;
    const ly = (p.leftHand?.y ?? normY) * ch;
    const prevLx = (p.leftHand?.prevX ?? p.leftHand?.x ?? prevNormX) * cw;
    const prevLy = (p.leftHand?.prevY ?? p.leftHand?.y ?? prevNormY) * ch;

    const rx = (p.rightHand?.x ?? (normX + 0.06)) * cw;
    const ry = (p.rightHand?.y ?? normY) * ch;
    const prevRx = (p.rightHand?.prevX ?? p.rightHand?.x ?? prevNormX) * cw;
    const prevRy = (p.rightHand?.prevY ?? p.rightHand?.y ?? prevNormY) * ch;

    const leftScale = Math.max(0.85, p.leftHand?.scale || handScale || 1.0);
    const rightScale = Math.max(0.85, p.rightHand?.scale || handScale || 1.0);
    const avgScale = (leftScale + rightScale) * 0.5;
    const handDist = Math.hypot(rx - lx, ry - ly);

    if (eng.roundMode === 'chop') {
      // CHOP MODE: Dual Left & Right 3D Chopping Knives!
      // Calculate Left Knife Blade Tip & Right Knife Blade Tip
      const leftAng = p.leftHand?.knifeAngle ?? -0.45;
      const rightAng = p.rightHand?.knifeAngle ?? -2.69;
      const bladeLen = Math.max(115, cw * 0.13) * avgScale;

      const lTipX = lx + Math.cos(leftAng) * bladeLen;
      const lTipY = ly + Math.sin(leftAng) * bladeLen;
      const rTipX = rx + Math.cos(rightAng) * bladeLen;
      const rTipY = ry + Math.sin(rightAng) * bladeLen;

      const midX = (lx + rx) * 0.5;
      const midY = (ly + ry) * 0.5;
      const knivesTouching = handDist <= 135 * avgScale || (p.clapTimer && p.clapTimer > 0);
      const now = performance.now();

      eng.targets.forEach(t => {
        if (!t.alive || t.frozen || t.cooldown > 0) return;
        if (eng.numPlayers === 2) {
          if (pIdx === 0 && t.team === 'p2') return;
          if (pIdx === 1 && t.team === 'p1') return;
        }

        const hitRadius = t.radius + 42 * avgScale;
        const dLeftBlade = distToSegment({ x: t.x, y: t.y }, { x: lx, y: ly }, { x: lTipX, y: lTipY });
        const dLeftSweep = distToSegment({ x: t.x, y: t.y }, { x: prevLx, y: prevLy }, { x: lx, y: ly });
        const leftHit = dLeftBlade < hitRadius || dLeftSweep < hitRadius;

        const dRightBlade = distToSegment({ x: t.x, y: t.y }, { x: rx, y: ry }, { x: rTipX, y: rTipY });
        const dRightSweep = distToSegment({ x: t.x, y: t.y }, { x: prevRx, y: prevRy }, { x: rx, y: ry });
        const rightHit = dRightBlade < hitRadius || dRightSweep < hitRadius;

        if (leftHit) {
          t.leftKnifeHitTime = now;
          p.leftHand.slapAnim = 1.0;
        }
        if (rightHit) {
          t.rightKnifeHitTime = now;
          p.rightHand.slapAnim = 1.0;
        }

        const dMid = Math.hypot(t.x - midX, t.y - midY);
        const bothKnivesStruck =
          (now - (t.leftKnifeHitTime || 0) < 620 && now - (t.rightKnifeHitTime || 0) < 620) ||
          (knivesTouching && dMid < hitRadius + 24);

        if (bothKnivesStruck) {
          p.slapAnim = 1.0;
          p.swordLunge = 1.0;
          p.isClapping = true;
          handleTargetHit(pIdx, t);
        }
      });
    } else {
      // MOSQUITO SLAP MODE: ONLY hit the mosquito when Left Glove and Right Glove touch each other!
      const touchThreshold = 116 * avgScale;

      if (handDist <= touchThreshold || (p.clapTimer && p.clapTimer > 0)) {
        p.isClapping = true;
        p.slapAnim = 1.0;
        const clapX = (lx + rx) * 0.5;
        const clapY = (ly + ry) * 0.5;
        p.clapMidX = clapX / cw;
        p.clapMidY = clapY / ch;

        const prevClapX = (prevLx + prevRx) * 0.5;
        const prevClapY = (prevLy + prevRy) * 0.5;

        const hitRadiusBonus = 54 * avgScale;
        eng.targets.forEach(t => {
          if (!t.alive || t.frozen || t.cooldown > 0) return;
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

        // 1. Draw Live Camera Feed (or let the live <video> layer show through while warming up)
        ctx.clearRect(-20, -20, cw + 40, ch + 40);
        const hasCameraStream = Boolean(videoRef.current && videoRef.current.srcObject);
        if (hasCameraStream && videoRef.current) {
          if (videoRef.current.readyState >= 2) {
            ctx.save();
            ctx.translate(cw, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(videoRef.current, 0, 0, cw, ch);
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

        // 2. Draw Mode-Specific 3D Headgear (Mosquito Net Hat in Slap Mode, 3D Chef's Hat in Chop Mode!)
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

        // 4. Update & Draw Targets with Strict Court Separation + Freeze Support + Adjustable Movement Style & Speed
        const mvStyle = movementStyleRef.current;
        const moveMult = mvStyle === 'hover' ? 0.14 : mvStyle === 'calm' ? 0.55 : mvStyle === 'zigzag' ? 1.25 : 1.0;
        const padTop = 152;
        const padBottom = 92;

        eng.targets.forEach(t => {
          if (t.cooldown > 0) t.cooldown--;
          if (!t.alive) return;

          if (t.frozenTimer > 0) {
            t.frozenTimer = Math.max(0, t.frozenTimer - dt);
          }

          // Only move targets that are NOT frozen in ice!
          if (!t.frozen && !showSettingsModalRef.current) {
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
            if (eng.roundMode === 'chop') {
              t.rotation = (t.rotation || 0) + (t.rotSpeed || 0.02) * moveMult;
            }
          }

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

          if (eng.roundMode === 'mosquito') {
            drawMosquitoTarget(ctx, t, now);
          } else {
            drawFruitTarget(ctx, t, now);
          }
        });

        // 5. Draw Weapons (Unified 3D Connected Gloves in Slap Mode, or Dual Left & Right 3D Chopping Knives in Chop Mode!)
        eng.players.forEach((p, idx) => {
          if (idx === 1 && eng.numPlayers === 1) return;
          p.slapAnim = Math.max(0, p.slapAnim - dt * 3.8);
          p.swordLunge = Math.max(0, p.swordLunge - dt * 3.2);
          if (p.frozenTimer > 0) {
            p.frozenTimer = Math.max(0, p.frozenTimer - dt);
          }
          if (p.clapTimer > 0) {
            p.clapTimer = Math.max(0, p.clapTimer - dt);
            if (p.clapTimer === 0 && !p.hasDetectedHands) {
              p.isClapping = false;
              p.leftHand.x = p.handX - 0.056;
              p.rightHand.x = p.handX + 0.056;
            }
          }

          // Decay trails on player and both hands
          for (let t = p.trail.length - 1; t >= 0; t--) {
            p.trail[t].life -= dt * 3.6;
            if (p.trail[t].life <= 0) p.trail.splice(t, 1);
          }
          if (p.leftHand?.trail) {
            for (let t = p.leftHand.trail.length - 1; t >= 0; t--) {
              p.leftHand.trail[t].life -= dt * 4.0;
              if (p.leftHand.trail[t].life <= 0) p.leftHand.trail.splice(t, 1);
            }
          }
          if (p.rightHand?.trail) {
            for (let t = p.rightHand.trail.length - 1; t >= 0; t--) {
              p.rightHand.trail[t].life -= dt * 4.0;
              if (p.rightHand.trail[t].life <= 0) p.rightHand.trail.splice(t, 1);
            }
          }

          const baseScale = Math.max(0.88, Math.min(1.28, cw / 960));
          const lx = (p.leftHand?.x ?? (p.handX - 0.056)) * cw;
          const ly = (p.leftHand?.y ?? p.handY) * ch;
          const rx = (p.rightHand?.x ?? (p.handX + 0.056)) * cw;
          const ry = (p.rightHand?.y ?? p.handY) * ch;
          const leftScale = baseScale * (p.leftHand?.scale || p.handScale || 1.0);
          const rightScale = baseScale * (p.rightHand?.scale || p.handScale || 1.0);
          const handDist = Math.hypot(rx - lx, ry - ly);
          const isTouching = handDist <= 125 * ((leftScale + rightScale) * 0.5) || p.isClapping;

          if (eng.roundMode === 'mosquito') {
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
              p.leftHand?.openness ?? 1.0,
              p.frozenTimer > 0
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
              p.rightHand?.openness ?? 1.0,
              p.frozenTimer > 0
            );

            // Visual 3D CLAP Burst when Left & Right Gloves touch each other!
            if (isTouching && p.frozenTimer <= 0) {
              const midX = (lx + rx) * 0.5;
              const midY = (ly + ry) * 0.5;
              if (!showSettingsModalRef.current) {
                checkHandWeaponCollision(
                  idx,
                  midX / cw,
                  midY / ch,
                  midX / cw,
                  midY / ch,
                  0,
                  0,
                  0.05,
                  undefined,
                  (p.leftHand?.scale || 1.0) * 0.5 + (p.rightHand?.scale || 1.0) * 0.5,
                  cw,
                  ch
                );
              }
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
            // CHOP MODE: Draw BOTH Left & Right 3D Chopping Knives (Chef's Cleavers)
            const leftKnifeAngle = p.hasDetectedHands
              ? (p.leftHand?.knifeAngle ?? -0.35)
              : (-0.38 + p.slapAnim * 0.45);
            const rightKnifeAngle = p.hasDetectedHands
              ? (p.rightHand?.knifeAngle ?? (-Math.PI + 0.35))
              : (-Math.PI + 0.38 - p.slapAnim * 0.45);

            drawSingle3DChoppingKnife(
              ctx,
              lx,
              ly,
              leftKnifeAngle,
              leftScale,
              false,
              p.theme,
              p.leftHand?.trail || [],
              cw,
              ch,
              now,
              p.slapAnim,
              p.frozenTimer > 0
            );

            drawSingle3DChoppingKnife(
              ctx,
              rx,
              ry,
              rightKnifeAngle,
              rightScale,
              true,
              p.theme,
              p.rightHand?.trail || [],
              cw,
              ch,
              now,
              p.slapAnim,
              p.frozenTimer > 0
            );

            // Check dual-knife chop collision every frame when not frozen
            if (!showSettingsModalRef.current && p.frozenTimer <= 0) {
              const midX = (lx + rx) * 0.5;
              const midY = (ly + ry) * 0.5;
              checkHandWeaponCollision(
                idx,
                midX / cw,
                midY / ch,
                midX / cw,
                midY / ch,
                0,
                0,
                0.05,
                0,
                (p.leftHand?.scale || 1.0) * 0.5 + (p.rightHand?.scale || 1.0) * 0.5,
                cw,
                ch
              );
            }

            // Visual 3D Cross-Blade X-CHOP Spark when Left & Right Chopping Knives cross or chop together!
            if (isTouching && p.frozenTimer <= 0) {
              const midX = (lx + rx) * 0.5;
              const midY = (ly + ry) * 0.5;
              ctx.save();
              ctx.translate(midX, midY);
              ctx.strokeStyle = '#38bdf8';
              ctx.lineWidth = 5;
              ctx.lineCap = 'round';
              const slashR = 32 + p.slapAnim * 24;
              ctx.beginPath();
              ctx.moveTo(-slashR, -slashR * 0.7);
              ctx.lineTo(slashR, slashR * 0.7);
              ctx.moveTo(slashR, -slashR * 0.7);
              ctx.lineTo(-slashR, slashR * 0.7);
              ctx.stroke();

              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.arc(0, 0, 18 + p.slapAnim * 12, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
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
    openness: number = 1.0,
    isFrozen: boolean = false
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
    ctx.fillStyle = isFrozen ? '#0284c7' : (th.outline || '#3b0764');
    ctx.strokeStyle = isFrozen ? '#0284c7' : (th.outline || '#3b0764');
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

    const gLight = isFrozen ? '#e0f2fe' : th.gloveLight;
    const gMain = isFrozen ? '#38bdf8' : th.gloveMain;
    const gDark = isFrozen ? '#0369a1' : th.gloveDark;

    // Pass B: Fill 3D Volumetric Thumb, Fingers, and Connected Palm
    // Thumb 3D Fill
    ctx.save();
    ctx.translate(-29, 0);
    ctx.rotate(-0.52 - (openness - 1) * 0.2);
    const thumbGrad = ctx.createRadialGradient(-4, -8, 2, 0, 0, 24);
    thumbGrad.addColorStop(0, '#ffffff');
    thumbGrad.addColorStop(0.28, gLight);
    thumbGrad.addColorStop(0.7, gMain);
    thumbGrad.addColorStop(1, gDark);
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
      fGrad.addColorStop(0.25, gLight);
      fGrad.addColorStop(0.68, gMain);
      fGrad.addColorStop(1, gDark);
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

    // Subtle 3D Finger Crease Dividers between fingers
    ctx.strokeStyle = gDark;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    [-13.5, 0.5, 14].forEach(wx => {
      ctx.beginPath();
      ctx.moveTo(wx, -34 * fingerExtend);
      ctx.lineTo(wx, -16);
      ctx.stroke();
    });

    // Seamless 3D Puffy Palm Cushion
    const palmGrad = ctx.createRadialGradient(-10, -12, 6, 0, 6, 48);
    palmGrad.addColorStop(0, '#ffffff');
    palmGrad.addColorStop(0.22, gLight);
    palmGrad.addColorStop(0.62, gMain);
    palmGrad.addColorStop(1, gDark);

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
    padGrad.addColorStop(0.55, gLight);
    padGrad.addColorStop(1, gMain);
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
    cuffGrad.addColorStop(0.85, gLight);
    cuffGrad.addColorStop(1, isFrozen ? '#0284c7' : th.hatMain);

    ctx.fillStyle = cuffGrad;
    ctx.strokeStyle = isFrozen ? '#0284c7' : (th.outline || '#3b0764');
    ctx.lineWidth = 4;
    roundRect(ctx, -25, 36, 50, 22, 11);
    ctx.fill();
    ctx.stroke();

    // Gold 3D Star/Button Badge on Wrist Cuff
    ctx.fillStyle = isFrozen ? '#bae6fd' : '#facc15';
    ctx.strokeStyle = isFrozen ? '#0284c7' : (th.outline || '#3b0764');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 47, 6.5, 0, Math.PI * 2);
    ctx.fill();
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

    const tScale = textSizeRef.current || 1.15;
    const fontPx = Math.round(15.5 * tScale);
    const badgeSize = Math.round(38 * Math.max(0.92, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(38 * Math.max(0.92, tScale * 0.94)) : 0;
    const cardH = Math.round(48 * Math.max(0.92, tScale * 0.94));
    const cardW = Math.max(
      Math.round(195 * tScale * 0.9),
      Math.min(
        Math.round(340 * tScale),
        cleanWord.length * (fontPx * 0.62) + badgeSize + thumbSize + (hasLoadedImg ? 48 : 36)
      )
    );
    const cardY = 34;

    ctx.save();
    // 3D Bottom Extrusion Lip in Vibrant Option Color
    ctx.fillStyle = t.frozen ? '#0284c7' : (t.color.dark || '#0284c7');
    roundRect(ctx, -cardW / 2, cardY + 5, cardW, cardH, 16);
    ctx.fill();

    // Main Capsule Body: Crisp Bright White & Sky-Blue 3D Card (No Dark Colors!)
    ctx.shadowColor = 'rgba(15, 23, 42, 0.25)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 5;
    const pillGrad = ctx.createLinearGradient(0, cardY, 0, cardY + cardH);
    pillGrad.addColorStop(0, t.frozen ? '#e0f2fe' : '#ffffff');
    pillGrad.addColorStop(1, t.frozen ? '#bae6fd' : '#f0f9ff');
    ctx.fillStyle = pillGrad;
    ctx.strokeStyle = t.frozen ? '#0284c7' : t.color.main;
    ctx.lineWidth = 3.5;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();
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
      const maxChars = 22;
      const displayStr = cleanWord.length > maxChars ? cleanWord.slice(0, maxChars - 1) + '…' : cleanWord;
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2);
    }

    // ---------------------------------------------
    // 2. Volumetric 3D Cartoon Mosquito (Friendly Bright 3D Colors)
    // ---------------------------------------------
    ctx.save();
    if (!facingLeft) ctx.scale(-1, 1);

    const wingFlap = t.frozen ? 0.15 : Math.sin(time * 0.15 + t.wingPhase) * 0.72;

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
      const legWiggle = t.frozen ? 0 : Math.sin(time * 0.022 + legIdx * 1.6) * 4.5;
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

    // Glossy 3D Specular Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.32, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Bright Light-Colored 3D Extruded Option Pill
    const parsedOpt = parseOptionContent(t.text || "");
    const cleanWord = parsedOpt.text || (parsedOpt.imageUrl ? "" : t.text || "");
    const optImgEl = parsedOpt.imageUrl ? getCachedSlapChopImage(parsedOpt.imageUrl) : null;
    const hasLoadedImg = Boolean(optImgEl && optImgEl.complete && optImgEl.naturalWidth > 0);

    const tScale = textSizeRef.current || 1.15;
    const fontPx = Math.round(15 * tScale);
    const badgeSize = Math.round(36 * Math.max(0.92, tScale * 0.94));
    const thumbSize = hasLoadedImg ? Math.round(36 * Math.max(0.92, tScale * 0.94)) : 0;
    const cardH = Math.round(46 * Math.max(0.92, tScale * 0.94));
    const cardW = Math.max(
      Math.round(185 * tScale * 0.9),
      Math.min(
        Math.round(330 * tScale),
        cleanWord.length * (fontPx * 0.62) + badgeSize + thumbSize + (hasLoadedImg ? 46 : 34)
      )
    );
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
      const displayStr = cleanWord.length > 22 ? cleanWord.slice(0, 20) + '…' : cleanWord;
      ctx.fillText(displayStr, textStartX, cardY + cardH / 2);
    }

    // Show 1st Knife Slash Indicator if one knife hit recently and awaiting second knife!
    if (!t.frozen && time > 0) {
      const leftActive = time - (t.leftKnifeHitTime || 0) < 950;
      const rightActive = time - (t.rightKnifeHitTime || 0) < 950;
      if ((leftActive && !rightActive) || (!leftActive && rightActive)) {
        ctx.save();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-28, -22);
        ctx.lineTo(28, 18);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#854d0e';
        ctx.lineWidth = 2;
        roundRect(ctx, -78, -r - 28, 156, 22, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#713f12';
        ctx.font = '900 11px Fredoka, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔪 1/2 CHOP! USE BOTH KNIVES', 0, -r - 17);
        ctx.restore();
      }
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
                <span>🦟 3D Motion AR Camera Arena 👨‍🍳🔪</span>
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-sky-900 drop-shadow-[0_4px_0_rgba(255,255,255,1)] tracking-tight">
                SLAP &amp; CHOP 3D
              </h2>
              <p className="text-slate-700 font-bold text-sm sm:text-base mt-1.5">
                Clap 2 Gloves to Slap Mosquitoes • Chop Options with Left &amp; Right Chef Knives! (+5 Correct / -5 &amp; Freeze if Wrong)
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
                            👏 2 Gloves / 🔪 2 Knives!
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
                        <span className="absolute -bottom-1.5 -right-1.5 text-lg">🔪</span>
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
                        sub: 'Clap 2 Gloves + Net Hat',
                        icon: '🦟',
                        activeClass: 'from-purple-500 to-indigo-600 border-purple-300 border-b-indigo-900 text-white shadow-lg'
                      },
                      {
                        id: 'chop' as const,
                        title: 'Chef Fruit Chop',
                        sub: '2 Chopping Knives + Chef Hat',
                        icon: '👨‍🍳🔪',
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
                      Use both hands to slap mosquitoes or chop fruits! Correct hits award <strong className="text-emerald-600">+5 pts</strong>; wrong hits deduct <strong className="text-rose-600">-5 pts</strong> and freeze the word in ice!
                    </p>
                  </div>

                  <div className="space-y-3 my-auto">
                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-purple-50 border-2 border-purple-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 border-b-4 border-indigo-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🧤
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Mosquito Slap Mode</div>
                        <div className="text-[11px] font-semibold text-slate-600">Bring Left &amp; Right 3D Gloves together to slap! Wrong words freeze in 3D ice ❄️</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-amber-50 border-2 border-amber-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 border-b-4 border-orange-800 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🔪
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">Chef Hat &amp; 2 Chopping Knives</div>
                        <div className="text-[11px] font-semibold text-slate-600">Wear a 3D Chef's Hat &amp; chop options with BOTH Left &amp; Right Chopping Knives!</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-sky-50 border-2 border-sky-200">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 border-b-4 border-blue-900 flex items-center justify-center text-2xl shrink-0 shadow text-white">
                        🎯
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">+5 Correct / -5 Wrong</div>
                        <div className="text-[11px] font-semibold text-slate-600">Switch Mode, Camera, Headgear, Music &amp; Voice anytime inside ⚙️ Settings</div>
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
            {gameMode === 'chop' ? '👨‍🍳' : '🦟'}
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Preparing Sunny 3D Arena...</h2>
          <p className="text-slate-600 font-bold text-sm max-w-sm">Calibrating 3D Gloves, Chef's Hat, Dual Chopping Knives &amp; Camera Sensors!</p>
        </div>
      )}

      {/* Screen 4: Live 3D AR Motion Game Arena (Full-Screen Live Camera + Bigger Immersive Player Point Cards + Mode & Camera Inside Settings) */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-10 w-full h-full overflow-hidden select-none">
          
          {/* BRIGHT LIGHT 3D FLOATING TOP HUD (Floats over the full-screen live camera & AR canvas) */}
          <div className="absolute top-0 left-0 right-0 z-40 w-full px-3 sm:px-6 pt-3 pb-2 pointer-events-none">
            <div className="max-w-6xl mx-auto flex flex-col gap-2.5 pointer-events-auto">
              
              {/* Row 1: BIGGER, IMMERSIVE 3D PLAYER SCOREBOARD CARDS + Clean Center Controls (Settings & Fullscreen) */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                
                {/* PLAYER 1 JUMBO 3D SCOREBOARD CARD */}
                <div className={`relative flex items-center gap-3.5 px-5 py-2.5 sm:px-6 sm:py-3 rounded-3xl backdrop-blur-md border-2 border-b-[7px] shadow-xl transition-all duration-300 ${
                  hudFrozen[0]
                    ? 'bg-gradient-to-b from-sky-100 to-sky-200 border-sky-400 border-b-sky-600 ring-4 ring-sky-300/60'
                    : 'bg-gradient-to-b from-white via-purple-50/70 to-indigo-50/90 border-purple-300 border-b-purple-600'
                }`}>
                  {/* 3D Team Avatar Badge */}
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-t border-white/80 border-b-4 shadow-md shrink-0 ${
                    hudFrozen[0]
                      ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-b-blue-900 text-white'
                      : 'bg-gradient-to-br from-purple-500 to-indigo-600 border-b-indigo-900 text-white'
                  }`}>
                    {hudFrozen[0] ? '❄️' : activeRoundMode === 'mosquito' ? '🧤' : '🔪'}
                  </div>

                  {/* Player Name, Streak & Status */}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-purple-900">
                        {p1Name || "Player 1"}
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black shadow-xs">
                        🔥 x{hudStreaks[0]}
                      </span>
                      {hudFrozen[0] && (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500 text-white font-black animate-pulse">
                          ❄️ FROZEN
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className={`font-black text-2xl sm:text-4xl tracking-tight font-mono leading-none ${
                        hudScores[0] < 0 ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {hudScores[0]}
                      </span>
                      <span className="text-xs sm:text-sm font-black uppercase text-purple-700 tracking-wide">
                        PTS
                      </span>
                    </div>
                  </div>

                  {/* Animated +5 / -5 Floating Score Popup */}
                  {hudScorePops[0] && (
                    <span className={`absolute -bottom-6 right-4 text-base sm:text-xl font-black text-white px-3.5 py-1 rounded-2xl border-2 border-white shadow-xl animate-bounce z-50 ${
                      hudScorePops[0].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}>
                      {hudScorePops[0]}
                    </span>
                  )}
                </div>

                {/* Center Controls (Round Badge + Live Playing Time Pill + ⚙️ Settings Modal Trigger + Fullscreen) */}
                <div className="flex items-center gap-2.5 flex-wrap justify-center">
                  <div className="px-4 py-2 rounded-2xl bg-white/95 border-2 border-sky-300 border-b-4 border-b-sky-500 text-xs sm:text-sm font-black text-sky-900 shadow-md flex items-center gap-2">
                    <span>{activeRoundMode === 'mosquito' ? '🦟 Slap' : '👨‍🍳🔪 Chop'}</span>
                    <span className="text-sky-300">•</span>
                    <span>Q{currentQIndex + 1} / {activeQuiz.questions.length}</span>
                  </div>

                  {/* Live Playing Time Countdown Badge */}
                  <div className={`px-4 py-2 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black font-mono shadow-md flex items-center gap-1.5 transition-colors ${
                    hudTimeLeft <= 15
                      ? 'bg-rose-500 border-rose-300 border-b-rose-800 text-white animate-pulse'
                      : 'bg-white/95 border-emerald-300 border-b-emerald-600 text-emerald-900'
                  }`}>
                    <span>⏱️</span>
                    <span>{formatPlayTime(hudTimeLeft)}</span>
                  </div>

                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 hover:from-amber-200 hover:to-amber-400 border-t border-white border-b-4 border-b-amber-700 text-xs sm:text-sm font-black text-slate-900 transition shadow-lg cursor-pointer flex items-center gap-2 active:translate-y-0.5"
                  >
                    <span className="text-base">⚙️</span>
                    <span>Settings</span>
                  </button>

                  <FullscreenButton targetId="slap-and-chop-container" className="bg-white/95 hover:bg-sky-50 border-2 border-sky-300 border-b-4 border-b-sky-500 text-slate-800 !py-2 !px-3.5 shadow-md" />
                </div>

                {/* PLAYER 2 JUMBO 3D SCOREBOARD CARD (If 2 Players) */}
                {numPlayers === 2 && (
                  <div className={`relative flex items-center gap-3.5 px-5 py-2.5 sm:px-6 sm:py-3 rounded-3xl backdrop-blur-md border-2 border-b-[7px] shadow-xl transition-all duration-300 ${
                    hudFrozen[1]
                      ? 'bg-gradient-to-b from-sky-100 to-sky-200 border-sky-400 border-b-sky-600 ring-4 ring-sky-300/60'
                      : 'bg-gradient-to-b from-white via-rose-50/70 to-pink-50/90 border-rose-300 border-b-rose-600'
                  }`}>
                    <div className="flex flex-col text-right">
                      <div className="flex items-center justify-end gap-2">
                        {hudFrozen[1] && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-sky-500 text-white font-black animate-pulse">
                            ❄️ FROZEN
                          </span>
                        )}
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-black shadow-xs">
                          🔥 x{hudStreaks[1]}
                        </span>
                        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-900">
                          {p2Name || "Player 2"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-end gap-1.5 mt-0.5">
                        <span className={`font-black text-2xl sm:text-4xl tracking-tight font-mono leading-none ${
                          hudScores[1] < 0 ? 'text-rose-600' : 'text-slate-900'
                        }`}>
                          {hudScores[1]}
                        </span>
                        <span className="text-xs sm:text-sm font-black uppercase text-rose-700 tracking-wide">
                          PTS
                        </span>
                      </div>
                    </div>

                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl border-t border-white/80 border-b-4 shadow-md shrink-0 ${
                      hudFrozen[1]
                        ? 'bg-gradient-to-br from-sky-400 to-blue-600 border-b-blue-900 text-white'
                        : 'bg-gradient-to-br from-rose-500 to-pink-600 border-b-rose-900 text-white'
                    }`}>
                      {hudFrozen[1] ? '❄️' : activeRoundMode === 'mosquito' ? '🧤' : '🔪'}
                    </div>

                    {hudScorePops[1] && (
                      <span className={`absolute -bottom-6 left-4 text-base sm:text-xl font-black text-white px-3.5 py-1 rounded-2xl border-2 border-white shadow-xl animate-bounce z-50 ${
                        hudScorePops[1].includes('-') ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}>
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

                {(() => {
                  const qParsed = parseOptionContent(currentQ?.text || '');
                  const qImg = currentQ?.image || qParsed.imageUrl;
                  const qTextDisplay = nextQCountdown !== null
                    ? `⏳ Next Question Appears in ${nextQCountdown}s...`
                    : (qParsed.text || currentQ?.text || "Loading question...");
                  return (
                    <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
                      {qImg && nextQCountdown === null && (
                        <img
                          src={qImg}
                          alt="Question"
                          className="h-12 sm:h-16 w-auto max-w-[120px] rounded-xl object-contain bg-sky-50 border-2 border-sky-300 p-1 shrink-0 shadow-sm"
                        />
                      )}
                      <p
                        className="font-black text-slate-900 tracking-tight leading-snug break-words"
                        style={{ fontSize: `${Math.round(24 * textSize)}px` }}
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
                  className="w-11 h-11 rounded-2xl bg-sky-100 hover:bg-sky-200 border-2 border-sky-300 flex items-center justify-center text-xl shrink-0 cursor-pointer transition"
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
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-5 py-2 rounded-full bg-white/95 backdrop-blur-md border-2 border-sky-300 border-b-4 border-b-sky-500 text-xs sm:text-sm font-black text-slate-800 whitespace-nowrap shadow-lg">
              {activeRoundMode === 'mosquito'
                ? '👏 Clap Left & Right 3D Gloves together to SLAP! (+5 Correct / -5 & Freeze if Wrong)'
                : '👨‍🍳🔪 Chop the fruit with BOTH Left & Right Chopping Knives! (+5 Correct / -5 & Freeze if Wrong)'}
            </div>
          </div>
        </div>
      )}

      {/* 3D LIGHT SETTINGS MODAL (Contains Combat Mode, Camera, Headgear, Music, Voice, Text Size, Speed & Movements) */}
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
                  <p className="text-xs font-bold text-slate-500">Mode, Camera, Headgear, Music, Voice, Text Size, Speed &amp; Movements</p>
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
                  {gameMode === 'mosquito' ? 'Mosquito Slap 🦟' : gameMode === 'chop' ? 'Chef Fruit Chop 👨‍🍳🔪' : 'Combo Mix 🔥'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'mosquito' as const, label: '🦟 Slap Mode', desc: '2 Gloves + Net Hat' },
                  { id: 'chop' as const, label: '🔪 Chop Mode', desc: '2 Knives + Chef Hat' },
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

            {/* 1. Headgear, Music, Sound FX & Voice Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Headgear */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200">
                <div>
                  <div className="text-sm font-black text-slate-900">🪖 3D Headgear</div>
                  <div className="text-[11px] font-bold text-slate-500">Net Hat &amp; 3D Chef's Hat</div>
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
                    <span className=" -top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
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
                      <span className="-top-3.5 px-3 py-0.5 rounded-full bg-amber-400 border-2 border-white text-slate-900 text-[11px] font-black uppercase shadow">
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
                  className="px-5 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border-2 border-slate-200 border-b-4 border-b-slate-300 text-slate-800 font-black text-sm sm:text-base transition cursor-pointer shadow-sm active:translate-y-0.5 flex items-center gap-2"
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

                {/* Options - FULL SCREEN WIDE & MASSIVE */}
                <div className={`w-full max-w-7xl mx-auto grid gap-4 sm:gap-6 ${
                  studyQ.options.length === 2
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : studyQ.options.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
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
                        className={`p-5 sm:p-7 md:p-8 rounded-3xl border-3 border-b-[8px] sm:border-b-[10px] text-left font-black transition-all cursor-pointer min-h-[110px] sm:min-h-[140px] md:min-h-[160px] flex items-center gap-4 sm:gap-6 active:translate-y-1 ${btnStyle}`}
                      >
                        <span className={`w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-black shrink-0 shadow-md ${
                          showResult && isCorrectAnswer
                            ? 'bg-emerald-500 text-white'
                            : showResult && isPicked && !isCorrectAnswer
                            ? 'bg-rose-500 text-white'
                            : 'bg-sky-100 border-2 border-sky-300 text-sky-800'
                        }`}>
                          {OPTION_LETTERS[oIdx]}
                        </span>

                        <div className="flex-1 flex items-center gap-4 min-w-0">
                          {parsedOpt.imageUrl && (
                            <img
                              src={parsedOpt.imageUrl}
                              alt={parsedOpt.text || `Option ${OPTION_LETTERS[oIdx]}`}
                              className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl object-contain bg-white p-2 border-2 border-sky-200 shrink-0 shadow-md"
                            />
                          )}
                          {parsedOpt.text ? (
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 break-words leading-tight">
                              {parsedOpt.text}
                            </span>
                          ) : !parsedOpt.imageUrl ? (
                            <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 break-words leading-tight">
                              {opt}
                            </span>
                          ) : null}
                        </div>

                        {showResult && isCorrectAnswer && (
                          <span className="text-sm sm:text-base md:text-lg font-black px-4 py-2 rounded-2xl bg-emerald-500 text-white shrink-0 shadow-md">
                            ✓ +5 PTS
                          </span>
                        )}
                        {showResult && isPicked && !isCorrectAnswer && (
                          <span className="text-sm sm:text-base md:text-lg font-black px-4 py-2 rounded-2xl bg-rose-500 text-white shrink-0 shadow-md">
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
