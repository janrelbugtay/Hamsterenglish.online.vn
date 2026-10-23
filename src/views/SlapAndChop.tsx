import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { ArrowLeft, Edit3, Trash2, Plus, Sparkles, BookOpen, Save, X, Play, Folder, Image as ImageIcon, ClipboardList, Copy, Volume2, VolumeX, RotateCcw } from "lucide-react";
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

const DEFAULT_SLAP_CHOP_QUESTIONS: Question[] = [
  {
    id: 1,
    text: "Which mosquito gender bites humans to get protein for eggs?",
    options: ["Female Mosquitoes", "Male Mosquitoes", "Baby Larvae", "King Mosquitoes"],
    answerIndex: 0
  },
  {
    id: 2,
    text: "What protective gear drapes mesh over your hat to keep bugs away?",
    options: ["Scuba Diving Mask", "Mosquito Net Headgear", "Ski Goggles", "Bicycle Helmet"],
    answerIndex: 1
  },
  {
    id: 3,
    text: "In Chop Chop Fencing mode, what protective steel mesh headgear do you wear?",
    options: ["A Straw Sunhat", "A 3D Fencing Mask", "A Chef Hat", "Swimming Cap"],
    answerIndex: 1
  },
  {
    id: 4,
    text: "Which fruit is famous for being green on the outside and bright red inside?",
    options: ["Lemon", "Watermelon", "Blueberry", "Coconut"],
    answerIndex: 1
  },
  {
    id: 5,
    text: "What gas do humans exhale that attracts mosquitoes from far away?",
    options: ["Helium", "Carbon Dioxide (CO2)", "Pure Neon", "Argon"],
    answerIndex: 1
  },
  {
    id: 6,
    text: "Quick Slap! What is 8 × 7?",
    options: ["54", "56", "64", "48"],
    answerIndex: 1
  },
  {
    id: 7,
    text: "Which planet in our solar system is known as the Red Planet?",
    options: ["Venus", "Jupiter", "Mars", "Saturn"],
    answerIndex: 2
  },
  {
    id: 8,
    text: "Which natural predator loves eating hundreds of mosquitoes every night?",
    options: ["Bats & Dragonflies", "Koalas", "Pandas", "Sloths"],
    answerIndex: 0
  }
];

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

  // Setup options (matching Bubble Pop layout)
  const [numPlayers, setNumPlayers] = useState<number>(1);
  const [p1Name, setP1Name] = useState<string>("Player 1");
  const [p2Name, setP2Name] = useState<string>("Player 2");
  const [speed, setSpeed] = useState<number>(1); // 0.5 = slow, 1 = normal, 2 = fast
  const [gameMode, setGameMode] = useState<'mosquito' | 'chop' | 'combo'>('mosquito'); // Mosquito Slap, Chop Chop, Mix
  const [showHeadgear, setShowHeadgear] = useState<boolean>(true);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [soundFx, setSoundFx] = useState<boolean>(true);
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
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : DEFAULT_SLAP_CHOP_QUESTIONS);
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Slap and Chop",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList
      };
    }
    return {
      id: Date.now(),
      title: "Slap and Chop Game",
      folderId: "",
      topic: "Science & Fun",
      classLevel: "All Levels",
      questions: DEFAULT_SLAP_CHOP_QUESTIONS
    };
  });

  // DOM Refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

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
    swordSparks: any[];
    floatingTexts: any[];
    players: any[];
    lastFrameTime: number;
  }>({
    isActive: false,
    questions: DEFAULT_SLAP_CHOP_QUESTIONS,
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
    swordSparks: [],
    floatingTexts: [],
    players: [],
    lastFrameTime: performance.now()
  });

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

  const playSoundEffect = (type: 'slap' | 'slash' | 'correct' | 'wrong') => {
    if (!soundFx) return;
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type === 'slap') {
      // Noise burst slap
      const bufferSize = ctx.sampleRate * 0.1;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } else if (type === 'slash') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'correct') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.09);
      osc.frequency.setValueAtTime(783.99, now + 0.18);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'wrong') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.25);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }
  };

  const speakText = (text: string) => {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/_+/g, "blank"));
      utterance.rate = 1.0;
      utterance.pitch = 1.1;
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  // Helper to initialize players
  const createPlayerEngine = (id: number, name: string, isP2: boolean) => {
    const baseX = isP2 ? 0.74 : 0.48;
    return {
      id,
      name,
      isP2,
      score: 0,
      streak: 1,
      hits: 0,
      theme: isP2 ? {
        hatMain: '#dc2626',
        hatDark: '#991b1b',
        hatLight: '#f87171',
        outline: '#3b0714',
        plume: '#450a0a',
        band: '#4a1d24',
        buckle: '#fbbf24',
        badgeRing: '#93c5fd',
        gloveMain: '#e11d48',
        gloveLight: '#fb7185',
        gloveDark: '#9f1239',
        swordColor: '#ff7b00',
        maskTrim: '#fca5a5'
      } : {
        hatMain: '#5c38e0',
        hatDark: '#4123b2',
        hatLight: '#8364ff',
        outline: '#1f1042',
        plume: '#252159',
        band: '#522c3c',
        buckle: '#f59e0b',
        badgeRing: '#82aaff',
        gloveMain: '#6842ef',
        gloveLight: '#8b6bff',
        gloveDark: '#4825c2',
        swordColor: '#00f0ff',
        maskTrim: '#cbd5e1'
      },
      headX: baseX,
      headY: 0.38,
      headScale: 1.0,
      headTilt: 0,
      handX: baseX,
      handY: 0.65,
      prevHandX: baseX,
      prevHandY: 0.65,
      vx: 0,
      vy: 0,
      speed: 0,
      slapAnim: 0,
      swordAngle: -0.65,
      swordAngVel: 0,
      swordLunge: 0,
      trail: [] as { x: number; y: number; tipX: number; tipY: number; life: number }[],
      leftHand: { x: baseX - 0.1, y: 0.65, angle: -0.18, scale: 1.0 },
      rightHand: { x: baseX + 0.08, y: 0.58, angle: -0.32, scale: 1.0 }
    };
  };

  // Setup camera
  const setupCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Camera API not supported; playing in 3D AR Virtual Mode!");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        setCameraError(null);
      }
    } catch (err: any) {
      console.warn("Camera could not start:", err);
      setCameraActive(false);
      setCameraError("Camera permission denied. Using 3D Virtual AR + Mouse/Touch!");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const s = videoRef.current.srcObject as MediaStream;
      s.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  // Start game mode
  const startGame = async (playersCount: number) => {
    initAudio();
    setNumPlayers(playersCount);
    setScreen('loading');

    // Attempt camera
    try {
      await setupCamera();
    } catch (e) {}

    // Init engine
    const activeQuestions = (activeQuiz.questions && activeQuiz.questions.length > 0)
      ? activeQuiz.questions
      : DEFAULT_SLAP_CHOP_QUESTIONS;

    const roundM = gameMode === 'combo' ? 'mosquito' : gameMode;
    const p1 = createPlayerEngine(0, p1Name || "Player 1", false);
    const p2 = createPlayerEngine(1, p2Name || "Player 2", true);

    if (playersCount === 2) {
      p1.headX = 0.28;
      p1.handX = 0.28;
      p1.leftHand.x = 0.20;
      p1.rightHand.x = 0.35;
      p2.headX = 0.72;
      p2.handX = 0.72;
      p2.leftHand.x = 0.65;
      p2.rightHand.x = 0.79;
    } else {
      p1.headX = 0.50;
      p1.handX = 0.50;
    }

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
      swordSparks: [],
      floatingTexts: [],
      players: [p1, p2],
      lastFrameTime: performance.now()
    };

    setCurrentQIndex(0);
    setActiveRoundMode(roundM);
    setHudScores([0, 0]);
    setHudStreaks([1, 1]);
    setTimerPct(100);

    setTimeout(() => {
      setScreen('game');
      spawnRoundTargets(0, roundM);
      if (activeQuestions[0]) {
        speakText(activeQuestions[0].text);
      }
    }, 450);
  };

  // Target spawning
  const spawnRoundTargets = (qIdx: number, mode: 'mosquito' | 'chop') => {
    const qObj = engineRef.current.questions[qIdx];
    if (!qObj) return;

    const width = containerRef.current?.clientWidth || 960;
    const height = containerRef.current?.clientHeight || 540;
    const opts = qObj.options || ["", "", "", ""];
    const targets: any[] = [];

    if (mode === 'mosquito') {
      // 4 Buzzing Mosquitoes in quadrants
      opts.forEach((optText, i) => {
        const colX = (i % 2 === 0) ? width * (0.2 + Math.random() * 0.15) : width * (0.65 + Math.random() * 0.15);
        const rowY = (i < 2) ? height * (0.28 + Math.random() * 0.12) : height * (0.62 + Math.random() * 0.12);
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = (2.2 + Math.random() * 1.2) * speed;

        targets.push({
          optionIndex: i,
          letter: OPTION_LETTERS[i] || '?',
          text: optText || `Option ${i + 1}`,
          isCorrect: i === qObj.answerIndex,
          x: colX,
          y: rowY,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          wobblePhase: Math.random() * 10,
          wingPhase: Math.random() * 10,
          radius: 36,
          color: OPTION_COLORS[i % OPTION_COLORS.length],
          alive: true,
          cooldown: 0
        });
      });
    } else {
      // Chop Chop: Flying fruits along parabolas
      opts.forEach((optText, i) => {
        const launchX = width * (0.18 + (i / Math.max(1, opts.length - 1)) * 0.64);
        const vy = -(9.5 + Math.random() * 2.8) * Math.sqrt(speed);
        const vx = (Math.random() - 0.5) * 3.2 * speed;

        targets.push({
          optionIndex: i,
          letter: OPTION_LETTERS[i] || '?',
          text: optText || `Option ${i + 1}`,
          isCorrect: i === qObj.answerIndex,
          x: launchX,
          y: height + 50 + i * 22,
          vx,
          vy,
          gravity: 0.22,
          radius: 46,
          rotation: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.08,
          color: OPTION_COLORS[i % OPTION_COLORS.length],
          alive: true,
          cooldown: 0
        });
      });
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

    engineRef.current.targets.forEach((t, i) => {
      if (!t.alive) return;
      t.x = width * (0.18 + (i / Math.max(1, engineRef.current.targets.length - 1)) * 0.64);
      t.y = height + 45 + Math.random() * 30;
      t.vy = -(9.5 + Math.random() * 2.5) * Math.sqrt(speed);
      t.vx = (Math.random() - 0.5) * 3.0 * speed;
    });
  };

  // Handle interaction hit (slap or slash)
  const handleTargetHit = (playerIdx: number, target: any) => {
    if (engineRef.current.resolved || !target.alive) return;
    const eng = engineRef.current;
    const p = eng.players[playerIdx];
    if (!p) return;

    if (target.isCorrect) {
      eng.resolved = true;
      target.alive = false;
      p.hits++;
      const addedPoints = 100 * p.streak;
      p.score += addedPoints;
      p.streak = Math.min(10, p.streak + 1);

      // Trigger dynamic Live HUD score animation
      playSoundEffect(eng.roundMode === 'chop' ? 'slash' : 'slap');
      setTimeout(() => playSoundEffect('correct'), 80);

      // Score pill live popup
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

      // Particle Bursts
      spawnBurstParticles(target.x, target.y, target.color.main, 24);
      if (eng.roundMode === 'chop') {
        spawnSlicedFruitHalves(target);
      } else {
        eng.splats.push({ x: target.x, y: target.y, color: target.color.main, alpha: 1.0 });
      }

      spawnFloatingText(target.x, target.y - 20, `🎯 CORRECT! +${addedPoints}`, '#4ade80');

      // Next Question after delay
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
      // Wrong answer hit
      p.streak = 1;
      playSoundEffect('wrong');
      target.cooldown = 40;
      setHudStreaks([eng.players[0].streak, eng.players[1].streak]);
      spawnFloatingText(target.x, target.y - 15, `❌ OOPS! Try Again`, '#f87171');
      spawnBurstParticles(target.x, target.y, '#94a3b8', 12);
    }
  };

  const spawnBurstParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 8.5;
      engineRef.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.8,
        size: 4 + Math.random() * 6,
        color,
        life: 1.0
      });
    }
  };

  const spawnSlicedFruitHalves = (target: any) => {
    for (let side = -1; side <= 1; side += 2) {
      engineRef.current.slicedHalves.push({
        x: target.x + side * 14,
        y: target.y,
        vx: (target.vx || 0) + side * (3.8 + Math.random() * 1.6),
        vy: -4.5 - Math.random() * 2,
        rotation: target.rotation || 0,
        rotSpeed: side * 0.15,
        radius: target.radius || 40,
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
    engineRef.current.isActive = false;
    setScreen('results');
  };

  // Pointer / Mouse / Touch interaction for canvas
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'game' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const eng = engineRef.current;
    if (eng.numPlayers === 1) {
      updatePlayerArm(0, x, y);
    } else {
      const playerIdx = x < 0.5 ? 0 : 1;
      updatePlayerArm(playerIdx, x, y);
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (screen !== 'game' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const eng = engineRef.current;
    const playerIdx = eng.numPlayers === 1 ? 0 : (x < 0.5 ? 0 : 1);
    const p = eng.players[playerIdx];
    if (!p) return;

    p.slapAnim = 1.0;
    p.swordLunge = 1.0;

    const px = x * canvasRef.current.width;
    const py = y * canvasRef.current.height;

    // Check hit against targets
    eng.targets.forEach(t => {
      if (!t.alive || t.cooldown > 0) return;
      const d = Math.hypot(t.x - px, t.y - py);
      if (d < t.radius + 30) {
        handleTargetHit(playerIdx, t);
      }
    });
  };

  const updatePlayerArm = (pIdx: number, normX: number, normY: number) => {
    const p = engineRef.current.players[pIdx];
    if (!p) return;

    p.prevHandX = p.handX;
    p.prevHandY = p.handY;
    p.handX = normX;
    p.handY = normY;
    p.vx = p.handX - p.prevHandX;
    p.vy = p.handY - p.prevHandY;
    p.speed = Math.hypot(p.vx, p.vy);

    // Dynamic sword rotation
    if (p.speed > 0.003) {
      p.swordAngle = Math.atan2(p.vy, p.vx);
      p.swordLunge = Math.min(1.0, p.swordLunge + p.speed * 8);
    }

    // Add trail
    const cw = containerRef.current?.clientWidth || 960;
    const ch = containerRef.current?.clientHeight || 540;
    const bladeLen = Math.max(240, cw * 0.28);
    const hx = p.handX * cw;
    const hy = p.handY * ch;
    const tipX = hx + Math.cos(p.swordAngle) * bladeLen;
    const tipY = hy + Math.sin(p.swordAngle) * bladeLen;

    p.trail.push({ x: p.handX, y: p.handY, tipX: tipX / cw, tipY: tipY / ch, life: 1.0 });
    if (p.trail.length > 20) p.trail.shift();

    // Check sword blade collision in Chop Chop
    if (engineRef.current.roundMode === 'chop' && !engineRef.current.resolved && p.speed > 0.005) {
      engineRef.current.targets.forEach(t => {
        if (!t.alive || t.cooldown > 0) return;
        const dist = distToSegment({ x: t.x, y: t.y }, { x: hx, y: hy }, { x: tipX, y: tipY });
        if (dist < t.radius + 18) {
          handleTargetHit(pIdx, t);
        }
      });
    }

    // Check slap in Mosquito mode
    if (engineRef.current.roundMode === 'mosquito' && !engineRef.current.resolved && p.speed > 0.016) {
      p.slapAnim = 1.0;
      engineRef.current.targets.forEach(t => {
        if (!t.alive || t.cooldown > 0) return;
        const d = Math.hypot(t.x - hx, t.y - hy);
        if (d < t.radius + 28) {
          handleTargetHit(pIdx, t);
        }
      });
    }
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

        // Timer Update
        if (!eng.resolved) {
          eng.timer = Math.max(0, eng.timer - dt);
          setTimerPct((eng.timer / eng.maxTimer) * 100);
          if (eng.timer <= 0) {
            eng.resolved = true;
            const qObj = eng.questions[eng.qIndex];
            const correctLetter = qObj ? OPTION_LETTERS[qObj.answerIndex] : '';
            spawnFloatingText(cw / 2, ch / 2, `⏰ TIME UP! Correct was ${correctLetter}`, '#fbbf24');
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

        // 1. Draw Background
        ctx.clearRect(0, 0, cw, ch);
        if (videoRef.current && videoRef.current.readyState >= 2) {
          ctx.save();
          ctx.translate(cw, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0, cw, ch);
          ctx.restore();
          // Subtle soft vignette
          const vig = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * 0.35, cw * 0.5, ch * 0.5, cw * 0.85);
          vig.addColorStop(0, 'rgba(0,0,0,0)');
          vig.addColorStop(1, 'rgba(2, 6, 23, 0.42)');
          ctx.fillStyle = vig;
          ctx.fillRect(0, 0, cw, ch);
        } else {
          // Dynamic studio background
          const grad = ctx.createRadialGradient(cw * 0.5, ch * 0.4, 40, cw * 0.5, ch * 0.5, Math.max(cw, ch) * 0.85);
          if (eng.roundMode === 'mosquito') {
            grad.addColorStop(0, '#2e1065');
            grad.addColorStop(0.55, '#1e1b4b');
            grad.addColorStop(1, '#090d16');
          } else {
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(0.55, '#0f172a');
            grad.addColorStop(1, '#020617');
          }
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, cw, ch);
        }

        // Split screen divider for 2P
        if (eng.numPlayers === 2) {
          ctx.save();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(cw / 2, 0);
          ctx.lineTo(cw / 2, ch);
          ctx.stroke();
          ctx.restore();
        }

        // 2. Draw Mode-Specific 3D Headgear
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

        // 3. Draw Splats
        for (let i = eng.splats.length - 1; i >= 0; i--) {
          const s = eng.splats[i];
          s.alpha -= dt * 0.45;
          if (s.alpha <= 0) {
            eng.splats.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = s.alpha;
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 36, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 4. Draw Weapons (Gloves or Fencing Sword)
        eng.players.forEach((p, idx) => {
          if (idx === 1 && eng.numPlayers === 1) return;
          p.slapAnim = Math.max(0, p.slapAnim - dt * 3.8);
          p.swordLunge = Math.max(0, p.swordLunge - dt * 3.2);

          for (let t = p.trail.length - 1; t >= 0; t--) {
            p.trail[t].life -= dt * 3.5;
            if (p.trail[t].life <= 0) p.trail.splice(t, 1);
          }

          if (eng.roundMode === 'mosquito') {
            const baseScale = Math.max(0.78, Math.min(1.18, cw / 980));
            drawSingleCartoonGlove(ctx, (p.handX - 0.05) * cw, p.handY * ch, -0.15 + p.slapAnim * 0.22, baseScale, false, p.theme, p.slapAnim);
            drawSingleCartoonGlove(ctx, (p.handX + 0.05) * cw, (p.handY - 0.02) * ch, -0.32 - p.slapAnim * 0.22, baseScale, true, p.theme, p.slapAnim);
          } else {
            draw3DFencingSwordAndTrail(ctx, p, cw, ch, now);
          }
        });

        // 5. Update & Draw Targets
        let aliveFruitCount = 0;
        eng.targets.forEach(t => {
          if (t.cooldown > 0) t.cooldown--;
          if (!t.alive) return;

          if (eng.roundMode === 'mosquito') {
            t.x += t.vx + Math.sin(now * 0.006 + t.wobblePhase) * 1.1;
            t.y += t.vy + Math.cos(now * 0.007 + t.wobblePhase) * 1.1;

            const padX = 85;
            const padTop = 130; // Leave room for top docked question
            const padBottom = 80;
            if (t.x < padX) { t.x = padX; t.vx = Math.abs(t.vx); }
            if (t.x > cw - padX) { t.x = cw - padX; t.vx = -Math.abs(t.vx); }
            if (t.y < padTop) { t.y = padTop; t.vy = Math.abs(t.vy); }
            if (t.y > ch - padBottom) { t.y = ch - padBottom; t.vy = -Math.abs(t.vy); }

            drawMosquitoTarget(ctx, t, now);
          } else {
            t.x += t.vx;
            t.y += t.vy;
            t.vy += t.gravity;
            t.rotation += t.rotSpeed;

            if (t.x < 80) { t.x = 80; t.vx = Math.abs(t.vx); }
            if (t.x > cw - 80) { t.x = cw - 80; t.vx = -Math.abs(t.vx); }

            if (t.y < ch + 120) {
              aliveFruitCount++;
            }
            drawFruitTarget(ctx, t);
          }
        });

        if (eng.roundMode === 'chop' && !eng.resolved && aliveFruitCount === 0) {
          launchFruitWave();
        }

        // 6. Sliced Halves & Particles
        for (let i = eng.slicedHalves.length - 1; i >= 0; i--) {
          const h = eng.slicedHalves[i];
          h.x += h.vx;
          h.y += h.vy;
          h.vy += 0.28;
          h.rotation += h.rotSpeed;
          h.alpha -= dt * 0.7;
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
          pt.vy += 0.2;
          pt.life -= dt * 1.4;
          if (pt.life <= 0) {
            eng.particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = pt.life;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 7. Floating Feedback Texts
        for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
          const ft = eng.floatingTexts[i];
          ft.y -= 1.6;
          ft.life -= dt * 0.95;
          if (ft.life <= 0) {
            eng.floatingTexts.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = ft.life;
          ctx.font = 'bold 22px Fredoka, sans-serif';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 4;
          ctx.strokeText(ft.text, ft.x, ft.y);
          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }
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
  // RENDERING HELPERS FOR 3D AR CANVAS
  // -------------------------------------------------------------
  const drawPurpleMosquitoNetHat = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.75, Math.min(1.25, cw / 960)) * p.headScale;
    const th = p.theme;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt);
    ctx.scale(baseScale, baseScale);

    const veilTopY = -46;
    const veilBottomY = 96;
    const veilTopHalfW = 120;
    const veilBotHalfW = 112;

    // 3D Translucent White Veil
    const veilGrad = ctx.createLinearGradient(-veilTopHalfW, 0, veilTopHalfW, 0);
    veilGrad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    veilGrad.addColorStop(0.2, 'rgba(241, 245, 249, 0.25)');
    veilGrad.addColorStop(0.5, 'rgba(248, 250, 252, 0.18)');
    veilGrad.addColorStop(0.8, 'rgba(241, 245, 249, 0.28)');
    veilGrad.addColorStop(1, 'rgba(255, 255, 255, 0.52)');

    ctx.fillStyle = veilGrad;
    ctx.beginPath();
    ctx.moveTo(-veilTopHalfW, veilTopY);
    ctx.lineTo(-veilBotHalfW, veilBottomY);
    ctx.quadraticCurveTo(0, veilBottomY + 28, veilBotHalfW, veilBottomY);
    ctx.lineTo(veilTopHalfW, veilTopY);
    ctx.quadraticCurveTo(0, veilTopY - 18, -veilTopHalfW, veilTopY);
    ctx.closePath();
    ctx.fill();

    // Mesh Grid Lines
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -100; x <= 100; x += 14) {
      ctx.moveTo(x, veilTopY);
      ctx.lineTo(x * 0.94, veilBottomY + 8);
    }
    for (let y = veilTopY + 12; y <= veilBottomY; y += 12) {
      ctx.moveTo(-110, y);
      ctx.lineTo(110, y + 4);
    }
    ctx.stroke();
    ctx.restore();

    // Rolled Bottom Rim
    ctx.fillStyle = th.hatMain;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-veilBotHalfW - 6, veilBottomY - 4);
    ctx.quadraticCurveTo(0, veilBottomY + 26, veilBotHalfW + 6, veilBottomY - 4);
    ctx.quadraticCurveTo(veilBotHalfW + 10, veilBottomY + 10, veilBotHalfW - 2, veilBottomY + 14);
    ctx.quadraticCurveTo(0, veilBottomY + 42, -veilBotHalfW + 2, veilBottomY + 14);
    ctx.quadraticCurveTo(-veilBotHalfW - 10, veilBottomY + 10, -veilBotHalfW - 6, veilBottomY - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hat Dome
    const domeGrad = ctx.createRadialGradient(-22, -110, 10, 0, -90, 95);
    domeGrad.addColorStop(0, th.hatLight);
    domeGrad.addColorStop(0.55, th.hatMain);
    domeGrad.addColorStop(1, th.hatDark);
    ctx.fillStyle = domeGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-78, -66);
    ctx.bezierCurveTo(-82, -138, 82, -138, 78, -66);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Hatband + Gold Buckle
    ctx.fillStyle = th.band;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-78, -82);
    ctx.quadraticCurveTo(0, -94, 78, -82);
    ctx.lineTo(81, -64);
    ctx.quadraticCurveTo(0, -76, -81, -64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = th.buckle;
    ctx.fillRect(32, -84, 32, 16);

    // Wide Upper Brim
    ctx.fillStyle = th.hatMain;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-136, -42);
    ctx.quadraticCurveTo(0, -82, 136, -42);
    ctx.quadraticCurveTo(142, -32, 126, -32);
    ctx.quadraticCurveTo(0, -60, -126, -32);
    ctx.quadraticCurveTo(-142, -32, -136, -42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  };

  const draw3DFencingMask = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number) => {
    const hx = p.headX * cw;
    const hy = p.headY * ch;
    const baseScale = Math.max(0.76, Math.min(1.28, cw / 950)) * p.headScale;

    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.headTilt);
    ctx.scale(baseScale, baseScale);

    // 1. Broad Padded White/Silver Fencing Bib (Gorget)
    const bibGrad = ctx.createRadialGradient(0, 88, 12, 0, 95, 130);
    bibGrad.addColorStop(0, '#f8fafc');
    bibGrad.addColorStop(0.45, '#e2e8f0');
    bibGrad.addColorStop(0.78, '#94a3b8');
    bibGrad.addColorStop(1, '#64748b');

    ctx.fillStyle = bibGrad;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-74, -6);
    ctx.bezierCurveTo(-76, 35, -108, 52, -106, 92);
    ctx.bezierCurveTo(-104, 146, 104, 146, 106, 92);
    ctx.bezierCurveTo(108, 52, 76, 35, 74, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. Metallic Outer Bezel
    const bezelGrad = ctx.createLinearGradient(-85, -110, 85, 85);
    bezelGrad.addColorStop(0, '#f1f5f9');
    bezelGrad.addColorStop(0.35, '#94a3b8');
    bezelGrad.addColorStop(0.7, '#475569');
    bezelGrad.addColorStop(1, '#cbd5e1');

    ctx.fillStyle = bezelGrad;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -122);
    ctx.bezierCurveTo(92, -122, 92, 12, 0, 82);
    ctx.bezierCurveTo(-92, 12, -92, -122, 0, -122);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Curved Wire-Mesh Visor
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -114);
    ctx.bezierCurveTo(82, -114, 82, 4, 0, 68);
    ctx.bezierCurveTo(-82, 4, -82, -114, 0, -114);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fill();
    ctx.clip();

    // Steel mesh grid
    ctx.lineWidth = 1.1;
    for (let i = -12; i <= 12; i++) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.beginPath();
      ctx.moveTo(i * 6.8, -118);
      ctx.quadraticCurveTo(i * 8.2, -22, i * 6.2, 72);
      ctx.stroke();
    }
    for (let j = -14; j <= 10; j++) {
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.beginPath();
      ctx.moveTo(-88, j * 7.6);
      ctx.quadraticCurveTo(0, j * 7.6 + j * 1.2, 88, j * 7.6);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  };

  const drawSingleCartoonGlove = (
    ctx: CanvasRenderingContext2D,
    gx: number,
    gy: number,
    angle: number,
    scale: number,
    isRightHand: boolean,
    th: any,
    slapBoost: number
  ) => {
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(angle);
    const s = scale * (1 + slapBoost * 0.22);
    ctx.scale(isRightHand ? s : -s, s);

    if (slapBoost > 0.08) {
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 4;
      ctx.globalAlpha = slapBoost;
      ctx.beginPath();
      ctx.arc(0, -25, 45 + (1 - slapBoost) * 35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const gloveGrad = ctx.createLinearGradient(-26, -60, 26, 65);
    gloveGrad.addColorStop(0, th.gloveLight);
    gloveGrad.addColorStop(0.5, th.gloveMain);
    gloveGrad.addColorStop(1, th.gloveDark);

    ctx.fillStyle = gloveGrad;
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 4.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-24, 68);
    ctx.quadraticCurveTo(-30, 62, -23, 54);
    ctx.quadraticCurveTo(-24, 15, -24, -44);
    ctx.bezierCurveTo(-24, -64, -10, -66, -9, -48);
    ctx.bezierCurveTo(-9, -68, 6, -68, 6, -46);
    ctx.bezierCurveTo(6, -62, 19, -58, 19, -38);
    ctx.quadraticCurveTo(22, -8, 25, 18);
    ctx.quadraticCurveTo(24, 42, 23, 54);
    ctx.quadraticCurveTo(30, 62, 24, 68);
    ctx.quadraticCurveTo(0, 74, -24, 68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Finger seams
    ctx.strokeStyle = th.outline;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-9, -48);
    ctx.lineTo(-7, -6);
    ctx.moveTo(6, -46);
    ctx.lineTo(7, -4);
    ctx.moveTo(11, -14);
    ctx.quadraticCurveTo(2, 8, 14, 26);
    ctx.stroke();

    ctx.restore();
  };

  const draw3DFencingSwordAndTrail = (ctx: CanvasRenderingContext2D, p: any, cw: number, ch: number, now: number) => {
    const hx = p.handX * cw;
    const hy = p.handY * ch;
    const baseLen = Math.max(255, Math.min(350, cw * 0.29));
    const bladeLen = baseLen * (1 + (p.swordLunge || 0) * 0.22);

    // 1. Trail
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
        ctx.globalAlpha = pt1.life * 0.45;
        ctx.lineWidth = pt1.life * 24;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = pt1.life * 0.9;
        ctx.lineWidth = pt1.life * 6;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 2. Sword
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(p.swordAngle);

    // Knuckle-bow loop
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(6, 28);
    ctx.bezierCurveTo(-18, 48, -68, 36, -78, 6);
    ctx.stroke();

    // Grip
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(-74, -7.5, 62, 15);

    // Pommel
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(-80, 0, 9.5, 0, Math.PI * 2);
    ctx.fill();

    // Blade
    const upperGrad = ctx.createLinearGradient(12, 0, bladeLen, 0);
    upperGrad.addColorStop(0, '#e2e8f0');
    upperGrad.addColorStop(0.5, '#ffffff');
    upperGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = upperGrad;
    ctx.beginPath();
    ctx.moveTo(12, -6.5);
    ctx.lineTo(bladeLen - 16, -2.2);
    ctx.lineTo(bladeLen, 0);
    ctx.lineTo(12, 0);
    ctx.closePath();
    ctx.fill();

    const lowerGrad = ctx.createLinearGradient(12, 0, bladeLen, 0);
    lowerGrad.addColorStop(0, '#475569');
    lowerGrad.addColorStop(0.6, '#94a3b8');
    lowerGrad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = lowerGrad;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(bladeLen, 0);
    ctx.lineTo(bladeLen - 16, 2.2);
    ctx.lineTo(12, 6.5);
    ctx.closePath();
    ctx.fill();

    // Bell Guard (Cup Hilt)
    const bellGrad = ctx.createRadialGradient(4, -10, 3, 2, 0, 34);
    bellGrad.addColorStop(0, '#ffffff');
    bellGrad.addColorStop(0.4, '#e2e8f0');
    bellGrad.addColorStop(0.8, '#64748b');
    ctx.fillStyle = bellGrad;
    ctx.beginPath();
    ctx.moveTo(14, -30);
    ctx.bezierCurveTo(-18, -28, -18, 28, 14, 30);
    ctx.quadraticCurveTo(20, 0, 14, -30);
    ctx.closePath();
    ctx.fill();

    // Star-Glint at Tip
    const glintPulse = 0.75 + Math.sin(now * 0.015) * 0.25;
    ctx.save();
    ctx.translate(bladeLen, 0);
    ctx.scale(glintPulse, glintPulse);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(2, -3, 14, 0);
      ctx.quadraticCurveTo(2, 3, 0, 0);
    }
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  const drawMosquitoTarget = (ctx: CanvasRenderingContext2D, t: any, time: number) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    const facingLeft = t.vx < 0;
    const bobY = Math.sin(time * 0.012 + t.wobblePhase) * 5;
    ctx.translate(0, bobY);

    // Option Pill below Mosquito
    const cardW = Math.max(140, Math.min(210, t.text.length * 8.0 + 52));
    const cardH = 38;
    const cardY = 24;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = t.color.main;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -cardW / 2, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t.color.main;
    roundRect(ctx, -cardW / 2 + 4, cardY + 4, 30, 30, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 19, cardY + 19);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    const displayStr = t.text.length > 20 ? t.text.slice(0, 18) + '…' : t.text;
    ctx.fillText(displayStr, -cardW / 2 + 40, cardY + 19);

    // Mosquito body
    ctx.save();
    if (!facingLeft) ctx.scale(-1, 1);

    const wingFlap = Math.sin(time * 0.095 + t.wingPhase) * 0.55;
    ctx.fillStyle = 'rgba(186, 230, 253, 0.75)';
    ctx.save();
    ctx.translate(4, -12);
    ctx.rotate(wingFlap - 0.3);
    ctx.beginPath();
    ctx.ellipse(10, -14, 22, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Abdomen
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(18, 2, 18, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = t.color.main;
    for (let s = 8; s <= 24; s += 7) {
      ctx.fillRect(s, -5, 3.5, 14);
    }

    // Head
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, -2, 11, 0, Math.PI * 2);
    ctx.arc(-14, -4, 9, 0, Math.PI * 2);
    ctx.fill();

    // Proboscis
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-22, -4);
    ctx.lineTo(-44, -1);
    ctx.stroke();

    // Red glowing eye
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(-18, -7, 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
  };

  const drawFruitTarget = (ctx: CanvasRenderingContext2D, t: any) => {
    ctx.save();
    ctx.translate(t.x, t.y);

    // Fruit body
    ctx.save();
    ctx.rotate(t.rotation);
    const r = (t.radius || 42) * 0.8;

    // Rind
    ctx.fillStyle = t.color.dark;
    ctx.strokeStyle = t.color.rim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Flesh
    const fleshGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.08, 0, 0, r * 0.88);
    fleshGrad.addColorStop(0, t.color.light);
    fleshGrad.addColorStop(0.45, t.color.main);
    fleshGrad.addColorStop(1, t.color.dark);
    ctx.fillStyle = fleshGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
    ctx.fill();

    // Specular
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.25, r * 0.14, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Option Pill
    const cardW = Math.max(140, Math.min(215, t.text.length * 8.2 + 52));
    const cardH = 38;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = t.color.light;
    ctx.lineWidth = 2.5;
    roundRect(ctx, -cardW / 2, -cardH / 2, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = t.color.main;
    roundRect(ctx, -cardW / 2 + 4, -cardH / 2 + 4, 30, 30, 8);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.letter, -cardW / 2 + 19, 0);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.textAlign = 'left';
    const displayStr = t.text.length > 20 ? t.text.slice(0, 18) + '…' : t.text;
    ctx.fillText(displayStr, -cardW / 2 + 40, 0);

    ctx.restore();
  };

  const drawSlicedHalf = (ctx: CanvasRenderingContext2D, h: any) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, h.alpha);
    ctx.translate(h.x, h.y);
    ctx.rotate(h.rotation);

    ctx.fillStyle = h.color.dark;
    ctx.strokeStyle = h.color.rim || '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, h.radius * 0.78, 0, Math.PI, h.side > 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = h.color.main;
    ctx.beginPath();
    ctx.arc(0, 0, h.radius * 0.66, 0, Math.PI, h.side > 0);
    ctx.closePath();
    ctx.fill();
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
    <div id="slap-and-chop-container" ref={containerRef} className="relative w-full h-full min-h-screen bg-slate-950 overflow-hidden font-sans select-none text-white">
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

      {/* Screen 2: Game Setup (Exact Bubble Pop match) */}
      {screen === 'setup' && (
        <div className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar backdrop-blur-md transition-colors duration-700 ${
          selectedTheme === "theme-ocean"
            ? "bg-gradient-to-b from-sky-600/90 to-cyan-600/90 dark:from-sky-800/90 dark:to-cyan-900/90"
            : selectedTheme === "theme-space"
            ? "bg-gradient-to-b from-slate-900/95 to-indigo-950/95"
            : selectedTheme === "theme-jungle"
            ? "bg-gradient-to-b from-green-600/90 to-emerald-500/90 dark:from-green-900/90 dark:to-emerald-800/90"
            : selectedTheme === "theme-sunset"
            ? "bg-gradient-to-b from-orange-500/90 to-yellow-400/90 dark:from-orange-800/90 dark:to-yellow-700/90"
            : "bg-gradient-to-b from-sky-400/90 to-blue-300/90 dark:from-sky-900/90 dark:to-blue-950/90"
        }`}>
          {/* Top navigation header */}
          <div className="w-full max-w-7xl flex items-center justify-between mb-6 z-20">
            <button
              onClick={() => onViewChange('games')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold transition cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span>Back to Games</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModeModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold transition cursor-pointer"
              >
                <span>🎮 Switch Game</span>
              </button>
              <button
                onClick={() => setScreen('editor')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold transition cursor-pointer"
              >
                <Edit3 size={18} />
                <span>Edit Quiz</span>
              </button>
              <FullscreenButton targetId="slap-and-chop-container" className="bg-white/10 hover:bg-white/20 border-white/20 text-white" />
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full">
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-bold uppercase tracking-widest mb-2">
                🦟 3D Motion AR Arena 🤺
              </div>
              <h2 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-blue-100 drop-shadow-lg tracking-tight">
                Slap &amp; Chop
              </h2>
              <p className="text-white/80 font-medium text-sm mt-1">
                Slap Buzzing Mosquitoes &amp; Chop Juicy Fruits with 3D Motion Headgear!
              </p>
            </div>

            {/* Main setup layout: Left column options + Right column theme & study */}
            <div className="flex flex-col xl:flex-row gap-6 w-full max-w-7xl justify-center items-stretch relative z-10">
              
              {/* Left Main Card: Player counts, names, speed, headgear, game mode, start */}
              <div className="flex-1 w-full max-w-2xl bg-white/15 dark:bg-black/30 backdrop-blur-xl rounded-[2rem] border border-white/25 p-6 sm:p-8 shadow-2xl flex flex-col items-center">
                
                {/* 1 Player vs 2 Player buttons */}
                <div className="flex gap-4 mb-6 w-full justify-center">
                  <button
                    onClick={() => setNumPlayers(1)}
                    className={`flex-1 flex flex-col items-center gap-2.5 p-5 rounded-3xl border transition-all duration-300 cursor-pointer ${
                      numPlayers === 1
                        ? 'bg-blue-500/40 border-blue-400 scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.4)]'
                        : 'bg-black/20 border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-4xl bg-blue-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg">👤</div>
                    <span className="text-white font-black text-xl">1 Player</span>
                  </button>
                  <button
                    onClick={() => setNumPlayers(2)}
                    className={`flex-1 flex flex-col items-center gap-2.5 p-5 rounded-3xl border transition-all duration-300 cursor-pointer ${
                      numPlayers === 2
                        ? 'bg-rose-500/40 border-rose-400 scale-[1.02] shadow-[0_0_30px_rgba(239,68,68,0.4)]'
                        : 'bg-black/20 border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-4xl bg-rose-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg">👥</div>
                    <span className="text-white font-black text-xl">2 Players</span>
                  </button>
                </div>

                {/* Player Names Input */}
                <div className="w-full flex flex-col gap-3 mb-6">
                  <div className="flex gap-3 items-center">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">1</div>
                    <input
                      type="text"
                      value={p1Name}
                      onChange={e => setP1Name(e.target.value)}
                      className="flex-1 bg-black/25 text-white font-bold placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-white/60 transition text-base"
                      placeholder="Player 1 Name"
                    />
                  </div>
                  {numPlayers === 2 && (
                    <div className="flex gap-3 items-center animate-in fade-in duration-200">
                      <div className="w-11 h-11 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">2</div>
                      <input
                        type="text"
                        value={p2Name}
                        onChange={e => setP2Name(e.target.value)}
                        className="flex-1 bg-black/25 text-white font-bold placeholder-white/40 border border-white/20 rounded-2xl px-4 py-3 outline-none focus:border-white/60 transition text-base"
                        placeholder="Player 2 Name"
                      />
                    </div>
                  )}
                </div>

                {/* Options Box */}
                <div className="w-full bg-black/25 p-4 rounded-2xl border border-white/20 flex flex-col gap-3.5 mb-6 text-sm">
                  
                  {/* Game Mode */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-white">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>🎯 Game Mode</span>
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
                      <button
                        onClick={() => setGameMode('mosquito')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          gameMode === 'mosquito' ? 'bg-purple-600 text-white shadow-md' : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                      >
                        🦟 Slap
                      </button>
                      <button
                        onClick={() => setGameMode('chop')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          gameMode === 'chop' ? 'bg-orange-600 text-white shadow-md' : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                      >
                        🤺 Chop
                      </button>
                      <button
                        onClick={() => setGameMode('combo')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          gameMode === 'combo' ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/15 hover:bg-white/25 text-white'
                        }`}
                      >
                        🔥 Mix
                      </button>
                    </div>
                  </div>

                  {/* Speed */}
                  <div className="flex justify-between items-center text-white">
                    <span className="font-bold">⚡ Motion Speed</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setSpeed(0.6)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                          speed === 0.6 ? 'bg-blue-500 text-white' : 'bg-white/15 hover:bg-white/25'
                        }`}
                      >
                        Slow
                      </button>
                      <button
                        onClick={() => setSpeed(1)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                          speed === 1 ? 'bg-blue-500 text-white' : 'bg-white/15 hover:bg-white/25'
                        }`}
                      >
                        Normal
                      </button>
                      <button
                        onClick={() => setSpeed(1.6)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                          speed === 1.6 ? 'bg-blue-500 text-white' : 'bg-white/15 hover:bg-white/25'
                        }`}
                      >
                        Fast
                      </button>
                    </div>
                  </div>

                  {/* 3D AR Headgear Toggle */}
                  <div className="flex justify-between items-center text-white">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>🪖 3D AR Headgear</span>
                      <span className="text-[10px] text-white/70 bg-white/10 px-2 py-0.5 rounded-full">
                        {gameMode === 'mosquito' ? 'Net Hat' : gameMode === 'chop' ? 'Fencing Mask' : 'Auto'}
                      </span>
                    </span>
                    <button
                      onClick={() => setShowHeadgear(!showHeadgear)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${showHeadgear ? 'bg-purple-500' : 'bg-white/30'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${showHeadgear ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Voice Narration */}
                  <div className="flex justify-between items-center text-white">
                    <span className="font-bold">🗣️ Voice Narration</span>
                    <button
                      onClick={() => setVoiceEnabled(!voiceEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${voiceEnabled ? 'bg-blue-500' : 'bg-white/30'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${voiceEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Sound FX */}
                  <div className="flex justify-between items-center text-white">
                    <span className="font-bold">🔊 Sound Effects</span>
                    <button
                      onClick={() => setSoundFx(!soundFx)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${soundFx ? 'bg-blue-500' : 'bg-white/30'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${soundFx ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>

                {/* Big Start Button */}
                <button
                  onClick={() => startGame(numPlayers)}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-black text-2xl rounded-2xl shadow-[0_0_35px_rgba(99,102,241,0.5)] hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-3"
                >
                  <Play size={24} fill="currentColor" />
                  <span>START GAME</span>
                </button>
              </div>

              {/* Right Column: Themes & Study Mode */}
              <div className="w-full xl:w-96 flex flex-col gap-6">
                
                {/* Choose Theme Card */}
                <div className="w-full rounded-[2rem] bg-white/15 dark:bg-black/30 backdrop-blur-xl border border-white/25 shadow-2xl p-6 flex flex-col justify-center">
                  <h3 className="text-2xl font-black text-white mb-4 text-center drop-shadow-md">Choose Theme</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'theme-sky', name: 'Sky', icon: '☁️' },
                      { id: 'theme-ocean', name: 'Ocean', icon: '🌊' },
                      { id: 'theme-space', name: 'Space', icon: '🚀' },
                      { id: 'theme-jungle', name: 'Jungle', icon: '🌴' },
                      { id: 'theme-sunset', name: 'Sunset', icon: '🌅' }
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTheme(t.id)}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all font-bold text-sm cursor-pointer ${
                          selectedTheme === t.id
                            ? 'bg-white text-blue-600 border-2 border-blue-400 scale-105 shadow-lg'
                            : 'bg-white/20 text-white hover:bg-white/30 border border-white/20'
                        }`}
                      >
                        <span className="text-2xl">{t.icon}</span>
                        <span>{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Study Mode Card */}
                <button
                  onClick={() => setScreen('study')}
                  className="group relative w-full h-44 rounded-[2rem] bg-white/15 dark:bg-black/30 backdrop-blur-xl border border-white/25 shadow-2xl overflow-hidden transition-all duration-300 hover:scale-105 hover:bg-white/25 cursor-pointer flex items-center justify-center p-6 gap-5 text-left"
                >
                  <div className="text-6xl transform group-hover:scale-110 group-hover:rotate-12 transition duration-300 drop-shadow-xl">
                    📖
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-2xl font-black text-white mb-0.5 drop-shadow-md">Study Mode</h3>
                    <p className="text-purple-100 font-medium text-sm">Review Questions!</p>
                  </div>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Screen 3: Loading Screen */}
      {screen === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 animate-spin flex items-center justify-center text-3xl mb-6 shadow-[0_0_40px_rgba(168,85,247,0.6)]">
            🦟
          </div>
          <h2 className="text-3xl font-black text-white mb-2">Preparing 3D Arena...</h2>
          <p className="text-slate-400 text-sm max-w-sm">Calibrating AR 3D Net Hat, Fencing Mask &amp; Motion Sensors!</p>
        </div>
      )}

      {/* Screen 4: Live 3D AR Motion Game Arena */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 flex flex-col w-full h-full overflow-hidden select-none">
          
          {/* MINIMALIST FLOATING TOP HUD */}
          <div className="relative z-40 w-full px-3 sm:px-6 pt-3 pb-2 pointer-events-auto">
            <div className="max-w-6xl mx-auto flex flex-col gap-2">
              
              {/* Row 1: Player Score Pills with Live Dynamic Adding Animations + Center Controls */}
              <div className="flex items-center justify-between gap-2">
                
                {/* Player 1 Pill with live adding score burst */}
                <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 shadow-xl">
                  <span className="text-lg">🧤</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400">{p1Name || "Player 1"}</span>
                  <span className="font-black text-base sm:text-lg text-white font-mono">{hudScores[0]} pts</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-bold">
                    🔥 x{hudStreaks[0]}
                  </span>
                  {/* Live score addition popup */}
                  {hudScorePops[0] && (
                    <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-sm sm:text-base font-black text-emerald-400 bg-black/80 px-2 py-0.5 rounded-full border border-emerald-400/50 animate-bounce">
                      {hudScorePops[0]}
                    </span>
                  )}
                </div>

                {/* Minimalist Center Controls */}
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-xs font-bold text-sky-300">
                    Q {currentQIndex + 1} / {activeQuiz.questions.length}
                  </span>

                  <button
                    onClick={() => {
                      const nextM = activeRoundMode === 'mosquito' ? 'chop' : 'mosquito';
                      setActiveRoundMode(nextM);
                      engineRef.current.roundMode = nextM;
                      spawnRoundTargets(currentQIndex, nextM);
                    }}
                    className="px-3.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800/80 backdrop-blur-md border border-white/20 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{activeRoundMode === 'mosquito' ? '🦟 SLAP' : '🤺 CHOP'}</span>
                  </button>

                  <button
                    onClick={() => {
                      if (cameraActive) stopCamera();
                      else setupCamera();
                    }}
                    className="px-3 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-sky-300 transition cursor-pointer"
                  >
                    {cameraActive ? '📷 Cam: HD ON' : '📷 Cam: Virtual'}
                  </button>

                  <button
                    onClick={() => setShowHeadgear(!showHeadgear)}
                    className="px-3 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800/80 backdrop-blur-md border border-white/20 text-xs font-semibold text-purple-200 transition cursor-pointer"
                  >
                    {showHeadgear ? '🪖 Headgear: ON' : '🪖 Headgear: OFF'}
                  </button>

                  <button
                    onClick={() => {
                      engineRef.current.isActive = false;
                      setScreen('setup');
                    }}
                    className="px-3 py-1 rounded-full bg-blue-600/80 hover:bg-blue-500 backdrop-blur-md border border-blue-400/40 text-xs font-bold text-white transition shadow cursor-pointer"
                  >
                    ⚙️ Setup
                  </button>

                  <FullscreenButton targetId="slap-and-chop-container" className="bg-slate-900/80 hover:bg-slate-800/80 border-white/20 text-white !py-1 !px-2.5" />
                </div>

                {/* Player 2 Pill (if 2P) */}
                {numPlayers === 2 && (
                  <div className="relative flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 shadow-xl">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-bold">
                      🔥 x{hudStreaks[1]}
                    </span>
                    <span className="font-black text-base sm:text-lg text-white font-mono">{hudScores[1]} pts</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-400">{p2Name || "Player 2"}</span>
                    <span className="text-lg">🧤</span>
                    {hudScorePops[1] && (
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-sm sm:text-base font-black text-emerald-400 bg-black/80 px-2 py-0.5 rounded-full border border-emerald-400/50 animate-bounce">
                        {hudScorePops[1]}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: High-Contrast Floating Question Banner Docked at TOP (per user instruction) */}
              <div className="relative overflow-hidden rounded-2xl bg-slate-900/85 backdrop-blur-xl px-4 py-2.5 text-center shadow-2xl border border-white/25 max-w-4xl mx-auto w-full">
                {/* Timer Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 via-emerald-400 to-rose-500 transition-all duration-100"
                    style={{ width: `${timerPct}%` }}
                  />
                </div>

                <p className="font-bold text-base sm:text-lg md:text-xl text-white tracking-wide drop-shadow">
                  {currentQ?.text || "Loading question..."}
                </p>

                {/* Minimalist Option Pills in Question Banner */}
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-left">
                  {currentQ?.options?.map((opt, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/10 border border-white/15 text-xs text-white/90 truncate"
                    >
                      <span className="w-5 h-5 rounded-full bg-blue-500/40 text-blue-300 font-black flex items-center justify-center text-[10px] shrink-0">
                        {OPTION_LETTERS[i]}
                      </span>
                      <span className="truncate font-medium">{opt}</span>
                    </div>
                  ))}
                </div>
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

            {/* Bottom Hint Pill */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-xs text-slate-200 whitespace-nowrap shadow-xl">
              {activeRoundMode === 'mosquito'
                ? '🦟 Clap your Purple Gloves or click/touch to SLAP the right mosquito!'
                : '🤺 Slash your Fencing Sword or swipe/drag to CHOP the right fruit!'}
            </div>
          </div>
        </div>
      )}

      {/* Screen 5: Results Victory Screen */}
      {screen === 'results' && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900/90 max-w-md w-full rounded-3xl p-6 sm:p-8 text-center border border-white/20 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-6xl animate-bounce">🏆</div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400">Arena Complete!</span>
              <h2 className="text-3xl font-black text-white mt-1">
                {numPlayers === 2
                  ? (engineRef.current.players[0].score > engineRef.current.players[1].score
                      ? `${p1Name} Wins!`
                      : engineRef.current.players[1].score > engineRef.current.players[0].score
                      ? `${p2Name} Wins!`
                      : 'Epic Tie Game!')
                  : `${p1Name} Scored ${engineRef.current.players[0].score} pts!`}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Mosquitoes slapped &amp; fruits sliced like a true AR champion!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-800/80 p-4 rounded-2xl border border-white/10">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-400/30 text-center">
                <div className="text-xs font-bold text-sky-300 uppercase">{p1Name || "Player 1"}</div>
                <div className="text-2xl font-black text-white mt-1 font-mono">{engineRef.current.players[0]?.score || 0}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{engineRef.current.players[0]?.hits || 0} Hits</div>
              </div>
              <div className={`p-3 rounded-xl text-center ${numPlayers === 2 ? 'bg-rose-500/10 border border-rose-400/30' : 'bg-slate-700/30 opacity-60'}`}>
                <div className="text-xs font-bold text-rose-300 uppercase">{numPlayers === 2 ? (p2Name || "Player 2") : "Questions"}</div>
                <div className="text-2xl font-black text-white mt-1 font-mono">
                  {numPlayers === 2 ? engineRef.current.players[1]?.score || 0 : activeQuiz.questions.length}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {numPlayers === 2 ? `${engineRef.current.players[1]?.hits || 0} Hits` : 'Total Completed'}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={() => startGame(numPlayers)}
                className="flex-1 py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </button>
              <button
                onClick={() => setScreen('setup')}
                className="flex-1 py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white border border-white/15 font-bold transition cursor-pointer"
              >
                Game Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 6: Study Mode */}
      {screen === 'study' && (
        <div className="absolute inset-0 z-40 bg-slate-900 overflow-y-auto p-4 sm:p-8 flex flex-col items-center">
          <div className="w-full max-w-3xl flex items-center justify-between mb-8">
            <button
              onClick={() => setScreen('setup')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
            >
              <ArrowLeft size={18} />
              <span>Back to Setup</span>
            </button>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <span>📖 Study Mode</span>
            </h2>
            <button
              onClick={() => startGame(numPlayers)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition cursor-pointer"
            >
              <Play size={18} fill="currentColor" />
              <span>Start Game</span>
            </button>
          </div>

          <div className="w-full max-w-3xl flex flex-col gap-4">
            {activeQuiz.questions.map((q, idx) => (
              <div key={q.id || idx} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <p className="text-base font-bold text-white flex-1">{q.text}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-11">
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`p-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                        oIdx === q.answerIndex
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-900/50 text-slate-300 border border-slate-700/50'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-black/30 flex items-center justify-center text-xs font-bold">
                        {OPTION_LETTERS[oIdx]}
                      </span>
                      <span>{opt}</span>
                      {oIdx === q.answerIndex && <span className="ml-auto text-xs font-black">✓ CORRECT</span>}
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
// QUIZ EDITOR COMPONENT (Matching Bubble Pop Editor with Bulk Paste)
// -------------------------------------------------------------
function QuizEditor({
  quiz,
  folders,
  onSave,
  onCancel,
  onPlayDirect
}: {
  quiz: Quiz;
  folders: { id: string; name: string }[];
  onSave: (q: Quiz) => void;
  onCancel: () => void;
  onPlayDirect: () => void;
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
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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

  const deleteQuestion = (id: number | string) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleBulkImport = () => {
    if (!bulkText.trim()) return;
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length > 0) {
      const newItems: Question[] = parsed.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || "",
        options: item.options || ["", "", "", ""],
        answerIndex: item.answerIndex || 0
      }));
      setQuestions(prev => [...prev.filter(q => q.text.trim()), ...newItems]);
      setShowBulkPasteModal(false);
      setBulkText("");
      setToastMsg(`✨ Automatically imported & divided ${newItems.length} questions!`);
      setTimeout(() => setToastMsg(""), 3500);
    }
  };

  const handleSave = () => {
    const valid = questions.filter(q => q.text.trim());
    if (valid.length === 0) {
      setErrorMsg("Please add at least 1 question with text!");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    onSave({
      ...quiz,
      title: "Slap and Chop Game",
      topic,
      classLevel,
      folderId,
      questions: valid,
      isPublic: false
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-900 overflow-y-auto custom-scrollbar p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl bg-slate-800/90 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col mb-10">
        
        {/* Editor Header */}
        <div className="p-6 sm:p-8 bg-slate-800 border-b border-purple-500/40 flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-xs font-bold uppercase tracking-wider mb-1">
                🦟 Slap and Chop 🤺
              </div>
              <h2 className="text-3xl font-black text-white">QUIZ EDITOR</h2>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-slate-300 font-bold hover:bg-slate-700 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-600 text-white font-bold text-sm shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardList size={16} />
                <span>Bulk Paste</span>
              </button>
              <button
                onClick={onPlayDirect}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>Play Setup</span>
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={16} />
                <span>Save Game</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topic</label>
              <input
                type="text"
                placeholder="e.g. Science &amp; Nature"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-purple-500 outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Class Level</label>
              <input
                type="text"
                placeholder="e.g. Grade 4, Starters"
                value={classLevel}
                onChange={e => setClassLevel(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-purple-500 outline-none transition"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Folder</label>
              <select
                value={folderId}
                onChange={e => setFolderId(e.target.value)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus:border-purple-500 outline-none transition cursor-pointer"
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
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-center font-bold text-sm animate-pulse">
            {errorMsg}
          </div>
        )}
        {toastMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center font-bold text-sm">
            {toastMsg}
          </div>
        )}

        {/* Questions List */}
        <div className="p-6 sm:p-8 flex flex-col gap-6">
          {questions.map((q, index) => (
            <div key={q.id} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-700/80 flex flex-col gap-4 relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold flex items-center justify-center text-sm">
                    {index + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Question #{index + 1}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => duplicateQuestion(index)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                    title="Duplicate Question"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="p-2 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/20 transition cursor-pointer"
                    title="Delete Question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={q.text}
                onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                placeholder="Type your question here..."
                className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium focus:border-purple-500 outline-none transition"
              />

              {/* Options Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {q.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${q.id}`}
                      checked={q.answerIndex === oIdx}
                      onChange={() => updateQuestion(q.id, 'answerIndex', oIdx)}
                      className="w-4 h-4 accent-purple-500 cursor-pointer shrink-0"
                      title="Select as correct answer"
                    />
                    <div className="flex-1 flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5">
                      <input
                        type="text"
                        value={opt}
                        onChange={e => updateOption(q.id, oIdx, e.target.value)}
                        placeholder={`Option ${oIdx + 1}`}
                        className="w-full bg-transparent text-sm text-white outline-none"
                      />
                      <button
                        onClick={() => setActiveGiphyInput({ qId: q.id, optIndex: oIdx })}
                        className="p-1 text-purple-400 hover:text-purple-300 cursor-pointer shrink-0"
                        title="Add image"
                      >
                        <ImageIcon size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => addOption(q.id)}
                  disabled={q.options.length >= 6}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  + Option
                </button>
                <button
                  onClick={() => removeOption(q.id)}
                  disabled={q.options.length <= 2}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
                >
                  - Option
                </button>
                <span className="text-xs text-slate-400 ml-2">Click radio dot to set correct answer</span>
              </div>
            </div>
          ))}

          <button
            onClick={addQuestion}
            className="w-full py-4 border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-2xl text-slate-400 hover:text-purple-300 font-bold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={20} />
            <span>Add Another Question</span>
          </button>
        </div>
      </div>

      {/* Media Picker Modal */}
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

      {/* Bulk Paste Modal with auto divide */}
      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">Bulk Paste &amp; Auto-Divide</h3>
                  <p className="text-xs text-slate-400">Paste multiple Q&amp;A lines, Excel rows, or pipe-delimited text.</p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkPasteModal(false)}
                className="w-8 h-8 rounded-full bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder={"Example 1:\n1. Which insect buzzes?\na) Mosquito\nb) Turtle\nc) Snail\nd) Crab\nAnswer: A\n\nExample 2 (Pipe format):\nWhat is 8 x 7? | 54 | 56 | 64 | 48 | 2"}
              className="w-full text-sm font-medium bg-slate-900 border border-slate-700 outline-none text-white p-4 rounded-2xl focus:border-purple-500 transition custom-scrollbar font-mono"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setBulkText(
                    "What is 9 x 6? | 48 | 54 | 56 | 63 | 2\n" +
                    "Which insect buzzes and bites? | Mosquito | Turtle | Snail | Crab | 1\n" +
                    "In Chop Chop fencing, what mask is worn? | Fencing Mask | Sunhat | Beret | Helmet | 1"
                  );
                }}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Load Sample
              </button>
              <button
                onClick={handleBulkImport}
                className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>+ Add to Game</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Robust text parser for bulk paste
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  // Pipe delimited format
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

  // TSV / Tab format
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const parts = line.split('\t').map(s => s.trim());
      if (parts.length >= 2) {
        const qText = parts[0];
        const opts = parts.slice(1);
        items.push({
          text: qText,
          options: opts.length >= 2 ? opts : ["Option 1", "Option 2"],
          answerIndex: 0
        });
      }
    });
    if (items.length > 0) return items;
  }

  // Standard multi-line Q&A
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isQStart = /^(?:question\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);

    if (isQStart || (currentQ && currentQ.options && currentQ.options.length >= 2 && !/^[a-d1-4][\.\)]/i.test(line) && !/^(?:ans|key)/i.test(line))) {
      if (currentQ && currentQ.text && currentQ.options && currentQ.options.length >= 2) {
        items.push(currentQ);
      }
      const match = line.match(/^(?:question\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
      currentQ = {
        text: match ? match[1].trim() : line,
        options: [],
        answerIndex: 0
      };
      continue;
    }

    if (/^(?:ans|correct)/i.test(line)) {
      if (currentQ) {
        const match = line.match(/([a-d1-4])/i);
        if (match) {
          const char = match[1].toUpperCase();
          if (/[A-D]/.test(char)) currentQ.answerIndex = char.charCodeAt(0) - 65;
          else currentQ.answerIndex = parseInt(char, 10) - 1;
        }
      }
      continue;
    }

    const optMatch = line.match(/^(?:[\(\[]?[A-Da-d1-4][\)\]\.\:\-]?)\s*(.*)/);
    if (optMatch && currentQ) {
      currentQ.options = currentQ.options || [];
      currentQ.options.push(optMatch[1].trim());
    }
  }

  if (currentQ && currentQ.text && currentQ.options && currentQ.options.length >= 2) {
    items.push(currentQ);
  }

  return items;
}
