import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Edit3,
  Play,
  RotateCw,
  Shield,
  Zap,
  Crosshair,
  Trophy,
  Users,
  Bomb,
  Tent,
  Video,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Plus,
  Trash2,
  Save,
  X,
  Clock,
  LogIn,
  Heart,
  Shuffle,
  Award,
  Radio,
  Eye
} from 'lucide-react';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { GameModeModal } from '../components/GameModeModal';
import {
  SetupCurriculumHeader,
  SmartOptionInput,
  SmartQuestionInput,
  convertQuestionsContentMode
} from '../components/SetupSmartControls';
import {
  OptionContentMode,
  parseOptionContent,
  formatOptionContent
} from '../utils/mediaAndPresets';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';

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

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

// =============================================================
// DEFAULT ESL PAINTBALL TRIVIA QUESTIONS
// =============================================================
const DEFAULT_TRIVIA: Question[] = [
  {
    id: 'pb-1',
    text: 'Choose the correct past tense of "go":',
    options: ['Goed', 'Went', 'Gone', 'Going'],
    answerIndex: 1
  },
  {
    id: 'pb-2',
    text: 'Which word is an adjective?',
    options: ['Quickly', 'Run', 'Brilliant', 'Tomorrow'],
    answerIndex: 2
  },
  {
    id: 'pb-3',
    text: 'What is the opposite of "ancient"?',
    options: ['Modern', 'Heavy', 'Silent', 'Careful'],
    answerIndex: 0
  },
  {
    id: 'pb-4',
    text: 'Complete the sentence: "She ___ playing paintball right now."',
    options: ['are', 'were', 'is', 'be'],
    answerIndex: 2
  },
  {
    id: 'pb-5',
    text: 'Which word is a synonym for "brave"?',
    options: ['Timid', 'Courageous', 'Angry', 'Hungry'],
    answerIndex: 1
  },
  {
    id: 'pb-6',
    text: 'Identify the plural form of "child":',
    options: ['Childs', 'Childrens', 'Children', 'Childes'],
    answerIndex: 2
  },
  {
    id: 'pb-7',
    text: 'Complete: "If it rains tomorrow, we ___ inside."',
    options: ['will stay', 'stayed', 'staying', 'would stayed'],
    answerIndex: 0
  },
  {
    id: 'pb-8',
    text: 'Which word has the same meaning as "enormous"?',
    options: ['Tiny', 'Gigantic', 'Fragile', 'Polite'],
    answerIndex: 1
  }
];

// =============================================================
// PRO HAMSTER SKINS (5 COLORWAYS)
// =============================================================
interface HamsterSkin {
  id: string;
  name: string;
  furColor: number;
  furHex: string;
  bellyColor: number;
  visorColor: number;
  strapColor: number;
  vestColor: number;
  paintColor: number;
  paintHex: string;
  badgeBg: string;
}

const HAMSTER_SKINS: HamsterSkin[] = [
  {
    id: 'amber',
    name: 'Golden Commando',
    furColor: 0xd97706,
    furHex: '#d97706',
    bellyColor: 0xfef3c7,
    visorColor: 0xec4899,
    strapColor: 0xbe185d,
    vestColor: 0x1e293b,
    paintColor: 0xa3e635,
    paintHex: '#a3e635',
    badgeBg: '#d97706'
  },
  {
    id: 'teal',
    name: 'Mint Striker',
    furColor: 0x0d9488,
    furHex: '#0d9488',
    bellyColor: 0xccfbf1,
    visorColor: 0xf97316,
    strapColor: 0xc2410c,
    vestColor: 0x0f172a,
    paintColor: 0x22d3ee,
    paintHex: '#22d3ee',
    badgeBg: '#0d9488'
  },
  {
    id: 'cocoa',
    name: 'Cocoa Spec-Ops',
    furColor: 0x451a03,
    furHex: '#451a03',
    bellyColor: 0xfde68a,
    visorColor: 0x06b6d4,
    strapColor: 0x0369a1,
    vestColor: 0x18181b,
    paintColor: 0xf43f5e,
    paintHex: '#f43f5e',
    badgeBg: '#451a03'
  },
  {
    id: 'snow',
    name: 'Arctic Phantom',
    furColor: 0xf1f5f9,
    furHex: '#f1f5f9',
    bellyColor: 0xffffff,
    visorColor: 0x84cc16,
    strapColor: 0x4d7c0f,
    vestColor: 0x334155,
    paintColor: 0xa855f7,
    paintHex: '#a855f7',
    badgeBg: '#e2e8f0'
  },
  {
    id: 'violet',
    name: 'Neon Viper',
    furColor: 0x7c3aed,
    furHex: '#7c3aed',
    bellyColor: 0xede9fe,
    visorColor: 0xfacc15,
    strapColor: 0xa16207,
    vestColor: 0x1e1b4b,
    paintColor: 0xfacc15,
    paintHex: '#facc15',
    badgeBg: '#7c3aed'
  }
];

export type TeamId = 'solo' | 'red' | 'blue' | 'green' | 'gold';

const TEAM_CONFIG: Record<
  TeamId,
  { label: string; colorHex: string; colorNum: number; bgClass: string; borderClass: string }
> = {
  solo: {
    label: 'Solo FFA',
    colorHex: '#a3e635',
    colorNum: 0xa3e635,
    bgClass: 'bg-lime-500/20 text-lime-300',
    borderClass: 'border-lime-400'
  },
  red: {
    label: 'Red Squad',
    colorHex: '#f43f5e',
    colorNum: 0xf43f5e,
    bgClass: 'bg-rose-500/25 text-rose-300',
    borderClass: 'border-rose-500'
  },
  blue: {
    label: 'Blue Squad',
    colorHex: '#38bdf8',
    colorNum: 0x38bdf8,
    bgClass: 'bg-sky-500/25 text-sky-300',
    borderClass: 'border-sky-400'
  },
  green: {
    label: 'Emerald Squad',
    colorHex: '#10b981',
    colorNum: 0x10b981,
    bgClass: 'bg-emerald-500/25 text-emerald-300',
    borderClass: 'border-emerald-400'
  },
  gold: {
    label: 'Gold Squad',
    colorHex: '#facc15',
    colorNum: 0xfacc15,
    bgClass: 'bg-amber-500/25 text-amber-300',
    borderClass: 'border-amber-400'
  }
};

// =============================================================
// PROCEDURAL WEB AUDIO SOUND ENGINE
// =============================================================
class PaintballAudioEngine {
  ctx: AudioContext | null = null;
  enabled: boolean = true;

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playMarkerShot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(290, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.085);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playSplat() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  playPowerup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 660, 880].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      g.gain.setValueAtTime(0.2, now + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.18);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.2);
    });
  }

  playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      g.gain.setValueAtTime(0.18, now + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.22);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.24);
    });
  }

  playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [220, 165].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      g.gain.setValueAtTime(0.2, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.22);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.24);
    });
  }

  playKO() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      g.gain.setValueAtTime(0.25, now + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.3);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.32);
    });
  }
}

const sfx = new PaintballAudioEngine();

// =============================================================
// MULTIPLAYER DATA INTERFACES
// =============================================================
interface PlayerNetworkState {
  id: string;
  name: string;
  role: 'host' | 'player';
  team: TeamId;
  skinIdx: number;
  x: number;
  z: number;
  rotY: number;
  hp: number;
  shield: number;
  score: number;
  kos: number;
  questionsAnswered: number;
  updatedAt: number;
}

interface LiveFeedEvent {
  id: string;
  text: string;
  color: string;
  timestamp: number;
}

interface PowerupNode {
  id: string;
  type: 'health' | 'shield';
  x: number;
  z: number;
  active: boolean;
  respawnAt: number;
  mesh: THREE.Group;
}

// =============================================================
// MAIN COMPONENT: HAMSTER PAINTBALL ARENA
// =============================================================
export default function HamsterPaintball({
  onViewChange,
  initialGame
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  // Detect if user arrived via QR code / student room code link
  const getInitialRoomSetup = (): { code: string; isJoiningStudent: boolean } => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room') || params.get('paintballRoom') || params.get('joinCode');
      const roleParam = params.get('role');
      if (urlRoom && /^\d{4,8}$/.test(urlRoom.trim())) {
        return {
          code: urlRoom.trim().slice(0, 6),
          isJoiningStudent: roleParam !== 'host'
        };
      }
    }
    if (initialGame?.roomCode && String(initialGame.roomCode).trim()) {
      return {
        code: String(initialGame.roomCode).trim().slice(0, 6),
        isJoiningStudent: true
      };
    }
    const savedCode =
      typeof window !== 'undefined' ? sessionStorage.getItem('hamster_pb_room_code') : null;
    if (savedCode && /^\d{6}$/.test(savedCode)) {
      return { code: savedCode, isJoiningStudent: false };
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hamster_pb_room_code', generated);
    }
    return { code: generated, isJoiningStudent: false };
  };

  const initialSetup = useRef(getInitialRoomSetup());

  // -------------------------------------------------------------
  // 1. QUIZ / CURRICULUM STATE
  // -------------------------------------------------------------
  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    const customQs =
      initialGame?.customQuestions && initialGame.customQuestions.length > 0
        ? initialGame.customQuestions
        : DEFAULT_TRIVIA;
    return {
      id: initialGame?.id || `paintball-${Date.now()}`,
      title: initialGame?.name || initialGame?.title || 'Hamster Paintball Park',
      topic: initialGame?.topic || 'English Vocabulary & Grammar',
      classLevel: initialGame?.className || initialGame?.classLevel || 'All Levels',
      questions: customQs,
      folderId: initialGame?.folderId || ''
    };
  });

  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  useEffect(() => {
    const fetchFolders = async () => {
      if (!user) return;
      try {
        const snap = await getDocs(collection(db, 'folders'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...(d.data() as { name: string; userId?: string }) }))
          .filter(f => !f.userId || f.userId === user.uid);
        setFolders(list);
      } catch {}
    };
    fetchFolders();
  }, [user]);

  const saveQuiz = async (updatedQuiz: Quiz) => {
    setActiveQuiz(updatedQuiz);
    setScreen('lobby');
    if (user && !user.isAnonymous) {
      try {
        await setDoc(
          doc(db, 'quizzes', String(updatedQuiz.id)),
          {
            ...updatedQuiz,
            userId: user.uid,
            gameType: 'hamster-paintball',
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Could not save paintball quiz:', e);
      }
    }
  };

  // -------------------------------------------------------------
  // 2. ROLE, LOBBY SETTINGS & PLAYER STATE
  // -------------------------------------------------------------
  // Teacher Jan is the non-playing Host by default unless joining via QR/room code
  const [role, setRole] = useState<'host' | 'player'>(
    initialSetup.current.isJoiningStudent ? 'player' : 'host'
  );
  const [screen, setScreen] = useState<'join' | 'lobby' | 'game' | 'results' | 'editor'>(
    initialSetup.current.isJoiningStudent ? 'join' : 'lobby'
  );

  const [playerName, setPlayerName] = useState<string>(() => {
    if (initialSetup.current.isJoiningStudent) {
      if (initialGame?.playerName) return String(initialGame.playerName).slice(0, 16);
      return '';
    }
    return 'Teacher Jan';
  });

  const [selectedSkinIdx, setSelectedSkinIdx] = useState<number>(0);
  const [myTeam, setMyTeam] = useState<TeamId>('red');
  const [roomCode, setRoomCode] = useState<string>(initialSetup.current.code);
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isJoiningRoomModal, setIsJoiningRoomModal] = useState<boolean>(false);
  const [copiedType, setCopiedType] = useState<'link' | 'code' | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);

  // Teacher Configurable Match Settings (Synced via Firestore)
  const [matchMode, setMatchMode] = useState<'solo' | 'teams'>('teams');
  const [configuredDurationSec, setConfiguredDurationSec] = useState<number>(180); // 3 mins default
  const [ballsPerQuestion, setBallsPerQuestion] = useState<number>(10); // 10 balls per question

  // Live Match Clock & Events
  const [matchSeconds, setMatchSeconds] = useState<number>(180);
  const [liveEvents, setLiveEvents] = useState<LiveFeedEvent[]>([
    {
      id: 'init-1',
      text: '👑 Teacher Jan opened the Paintball Park Lobby! Scan QR or enter code to join!',
      color: '#a3e635',
      timestamp: Date.now()
    }
  ]);

  // Host Camera Target (when Teacher Jan watches the live match happenings)
  const [hostCameraMode, setHostCameraMode] = useState<'overview' | 'follow'>('overview');
  const [hostFollowIndex, setHostFollowIndex] = useState<number>(0);

  // Student Combat Vitals, Ammo & Score
  // Players start with 0 paintballs and MUST answer questions to earn paintball ammunition!
  const [hp, setHp] = useState<number>(100);
  const [maxHp] = useState<number>(100);
  const [shield, setShield] = useState<number>(100);
  const [maxShield] = useState<number>(100);
  const [ammo, setAmmo] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [kos, setKos] = useState<number>(0);
  const [questionsAnswered, setQuestionsAnswered] = useState<number>(0);
  const [koBannerText, setKoBannerText] = useState<string | null>(null);
  const [pickupBannerText, setPickupBannerText] = useState<string | null>(null);

  // Connected Players in Room (Excluding Non-Playing Host Teacher Jan)
  const [roomPlayers, setRoomPlayers] = useState<PlayerNetworkState[]>([]);

  // Trivia Question State
  const [triviaStreak, setTriviaStreak] = useState<number>(0);
  const [triviaDeckIndex, setTriviaDeckIndex] = useState<number>(0);
  const [triviaFeedback, setTriviaFeedback] = useState<string | null>(null);

  // Mobile Touch Virtual Joystick State
  const [joystickVec, setJoystickVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Unique Client Session ID
  const clientIdRef = useRef<string>(`pb_${Math.random().toString(36).slice(2, 10)}`);

  // Live Scannable Join URL (strictly uses production domain hamsterenglish.online, never dev server)
  const liveJoinUrl = `https://hamsterenglish.online/?game=hamster-paintball&room=${roomCode}`;

  const liveDisplayHost = 'hamsterenglish.online';

  // Keep roomCode in sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !roomCode) return;
    sessionStorage.setItem('hamster_pb_room_code', roomCode);
  }, [roomCode]);

  const pushLiveEvent = (text: string, color: string = '#a3e635') => {
    const newEv: LiveFeedEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      color,
      timestamp: Date.now()
    };
    setLiveEvents(prev => [newEv, ...prev].slice(0, 12));
    if (gameRef.current?.broadcastChannel) {
      try {
        gameRef.current.broadcastChannel.postMessage({
          type: 'live_event',
          event: newEv
        });
      } catch {}
    }
  };

  const handleCopyJoinLink = () => {
    navigator.clipboard.writeText(liveJoinUrl);
    setCopiedType('link');
    sfx.playCorrect();
    setTimeout(() => setCopiedType(null), 2200);
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedType('code');
    sfx.playCorrect();
    setTimeout(() => setCopiedType(null), 2200);
  };

  const handleGenerateNewRoomCode = () => {
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    setRoomCode(newCode);
    sfx.playCorrect();
  };

  // -------------------------------------------------------------
  // 3. THREE.JS SCENE & GAMEPLAY REFS
  // -------------------------------------------------------------
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const gameRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    localHamster: THREE.Group;
    x: number;
    z: number;
    rotY: number;
    vx: number;
    vz: number;
    walkPhase: number;
    keys: Record<string, boolean>;
    joyX: number;
    joyZ: number;
    mouseDown: boolean;
    mouseScreenX: number;
    mouseScreenY: number;
    aimWorldX: number;
    aimWorldZ: number;
    lastShotTime: number;
    hostCamX: number;
    hostCamZ: number;
    obstacles: Array<{ x: number; z: number; r: number; h: number }>;
    powerups: PowerupNode[];
    projectiles: Array<{
      ownerId: string;
      ownerName: string;
      ownerTeam: TeamId;
      mesh: THREE.Object3D;
      vx: number;
      vy: number;
      vz: number;
      gravity: number;
      damage: number;
      color: number;
    }>;
    splatDecals: THREE.Object3D[];
    particles: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
    }>;
    remotePlayers: Map<
      string,
      {
        data: PlayerNetworkState;
        mesh: THREE.Group;
        walkPhase: number;
      }
    >;
    waterMesh?: THREE.Mesh;
    broadcastChannel?: BroadcastChannel;
  } | null>(null);

  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Keep latest state snapshot for network & physics loop
  const stateSnapRef = useRef({
    role,
    playerName,
    selectedSkinIdx,
    myTeam,
    hp,
    shield,
    score,
    kos,
    questionsAnswered,
    ammo,
    screen,
    matchMode,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex
  });

  useEffect(() => {
    stateSnapRef.current = {
      role,
      playerName,
      selectedSkinIdx,
      myTeam,
      hp,
      shield,
      score,
      kos,
      questionsAnswered,
      ammo,
      screen,
      matchMode,
      ballsPerQuestion,
      hostCameraMode,
      hostFollowIndex
    };
  }, [
    role,
    playerName,
    selectedSkinIdx,
    myTeam,
    hp,
    shield,
    score,
    kos,
    questionsAnswered,
    ammo,
    screen,
    matchMode,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex
  ]);

  // Match Countdown Timer
  useEffect(() => {
    if (screen !== 'game') return;
    const timer = setInterval(() => {
      setMatchSeconds(prev => {
        if (prev <= 1) {
          setScreen('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  // -------------------------------------------------------------
  // 4. REAL-TIME MULTIPLAYER SYNC (FIRESTORE + BROADCAST CHANNEL)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!roomCode) return;

    const roomDocRef = doc(db, 'paintball_rooms', roomCode);

    // If Host (Teacher Jan), publish room configuration
    if (role === 'host') {
      setDoc(
        roomDocRef,
        {
          roomCode,
          hostName: 'Teacher Jan',
          quizTitle: activeQuiz.title,
          matchMode,
          configuredDurationSec,
          ballsPerQuestion,
          updatedAt: Date.now()
        },
        { merge: true }
      ).catch(() => {});
    }

    // Listen to room settings & match status
    const unsubRoom = onSnapshot(
      roomDocRef,
      snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (role === 'player') {
          if (data?.matchMode) setMatchMode(data.matchMode);
          if (typeof data?.ballsPerQuestion === 'number') {
            setBallsPerQuestion(data.ballsPerQuestion);
          }
          if (typeof data?.configuredDurationSec === 'number' && stateSnapRef.current.screen === 'lobby') {
            setConfiguredDurationSec(data.configuredDurationSec);
            setMatchSeconds(data.configuredDurationSec);
          }
          if (data?.matchStatus === 'playing' && stateSnapRef.current.screen === 'lobby') {
            sfx.playKO();
            setMatchSeconds(data.configuredDurationSec || 180);
            setScreen('game');
          } else if (data?.matchStatus === 'results' && stateSnapRef.current.screen === 'game') {
            setScreen('results');
          } else if (data?.matchStatus === 'lobby' && stateSnapRef.current.screen !== 'lobby' && stateSnapRef.current.screen !== 'join') {
            setScreen('lobby');
          }
        }
        if (data?.latestEvent && data.latestEvent.id) {
          setLiveEvents(prev => {
            if (prev.some(e => e.id === data.latestEvent.id)) return prev;
            return [data.latestEvent, ...prev].slice(0, 12);
          });
        }
      },
      () => {}
    );

    // BroadcastChannel for instant local cross-tab multiplayer
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`hamster_paintball_net_${roomCode}`);
      if (gameRef.current) {
        gameRef.current.broadcastChannel = bc;
      }
      bc.onmessage = ev => {
        const msg = ev.data;
        if (!msg || msg.id === clientIdRef.current) return;
        if (msg.type === 'player_update') {
          const pState = msg.payload as PlayerNetworkState;
          if (pState.role === 'player') {
            upsertRemotePlayer(pState);
          }
        } else if (msg.type === 'fire_shot' && gameRef.current) {
          spawnNetworkProjectile(
            msg.ownerId,
            msg.ownerName,
            msg.ownerTeam,
            msg.x,
            msg.z,
            msg.angle,
            msg.paintColor
          );
        } else if (msg.type === 'hit_player') {
          if (msg.targetId === clientIdRef.current && stateSnapRef.current.role === 'player') {
            applyIncomingDamage(msg.damage, msg.attackerName, msg.attackerId);
          }
        } else if (msg.type === 'award_ko') {
          if (msg.attackerId === clientIdRef.current) {
            setKos(k => k + 1);
            setScore(s => s + 50);
            setKoBannerText(`SPLATTERED ${msg.victimName.toUpperCase()}! (+50 PTS)`);
            sfx.playKO();
            setTimeout(() => setKoBannerText(null), 2600);
          }
        } else if (msg.type === 'live_event' && msg.event) {
          setLiveEvents(prev => {
            if (prev.some(e => e.id === msg.event.id)) return prev;
            return [msg.event, ...prev].slice(0, 12);
          });
        } else if (msg.type === 'match_start' && stateSnapRef.current.role === 'player') {
          sfx.playKO();
          setMatchSeconds(msg.durationSec || 180);
          setScreen('game');
        } else if (msg.type === 'match_end' && stateSnapRef.current.role === 'player') {
          setScreen('results');
        }
      };
    } catch {}

    // Listen to all joined players in `rooms_${roomCode}_players`
    const playersCol = collection(db, `rooms_${roomCode}_players`);
    const unsubPlayers = onSnapshot(
      playersCol,
      snap => {
        const now = Date.now();
        const activePlayers: PlayerNetworkState[] = [];
        const seenIds = new Set<string>();

        snap.docs.forEach(d => {
          const data = d.data() as PlayerNetworkState;
          // Keep players active within last 60 seconds
          if (data.role === 'player' && now - (data.updatedAt || 0) < 60000) {
            const pState: PlayerNetworkState = {
              id: d.id,
              name: data.name || 'Student',
              role: 'player',
              team: data.team || 'red',
              skinIdx: typeof data.skinIdx === 'number' ? data.skinIdx : 0,
              x: typeof data.x === 'number' ? data.x : 0,
              z: typeof data.z === 'number' ? data.z : 10,
              rotY: typeof data.rotY === 'number' ? data.rotY : 0,
              hp: typeof data.hp === 'number' ? data.hp : 100,
              shield: typeof data.shield === 'number' ? data.shield : 100,
              score: typeof data.score === 'number' ? data.score : 0,
              kos: typeof data.kos === 'number' ? data.kos : 0,
              questionsAnswered: typeof data.questionsAnswered === 'number' ? data.questionsAnswered : 0,
              updatedAt: data.updatedAt || now
            };
            activePlayers.push(pState);
            seenIds.add(d.id);

            // If this is my own player document and the teacher changed my team in the lobby, sync it
            if (d.id === clientIdRef.current && data.team && data.team !== stateSnapRef.current.myTeam) {
              setMyTeam(data.team);
            }

            if (d.id !== clientIdRef.current) {
              upsertRemotePlayer(pState);
            }
          }
        });

        // Clean up disconnected 3D meshes
        if (gameRef.current) {
          gameRef.current.remotePlayers.forEach((val, key) => {
            if (!seenIds.has(key)) {
              gameRef.current?.scene.remove(val.mesh);
              gameRef.current?.remotePlayers.delete(key);
            }
          });
        }

        // Sort by score descending
        activePlayers.sort((a, b) => b.score - a.score);
        setRoomPlayers(activePlayers);
      },
      () => {}
    );

    // Periodic heartbeat sync for joined student players
    const syncInterval = setInterval(() => {
      const g = gameRef.current;
      const snapState = stateSnapRef.current;
      // Only joined students ('player' role who have entered the lobby/game) write to the player list!
      // Teacher Jan ('host') is non-playing and does NOT join as a combat player.
      if (snapState.role !== 'player' || snapState.screen === 'join') return;

      const payload: PlayerNetworkState = {
        id: clientIdRef.current,
        name: snapState.playerName || 'Student',
        role: 'player',
        team: snapState.matchMode === 'solo' ? 'solo' : snapState.myTeam,
        skinIdx: snapState.selectedSkinIdx,
        x: g ? Number(g.x.toFixed(2)) : 0,
        z: g ? Number(g.z.toFixed(2)) : 12,
        rotY: g ? Number(g.rotY.toFixed(2)) : 0,
        hp: snapState.hp,
        shield: snapState.shield,
        score: snapState.score,
        kos: snapState.kos,
        questionsAnswered: snapState.questionsAnswered,
        updatedAt: Date.now()
      };

      if (bc) {
        try {
          bc.postMessage({ type: 'player_update', id: clientIdRef.current, payload });
        } catch {}
      }

      const playerRef = doc(db, `rooms_${roomCode}_players`, clientIdRef.current);
      setDoc(playerRef, {
        ...payload,
        lastSeen: serverTimestamp()
      }).catch(() => {});
    }, 450);

    return () => {
      unsubRoom();
      unsubPlayers();
      clearInterval(syncInterval);
      if (bc) bc.close();
    };
  }, [roomCode, role, activeQuiz.title, matchMode, configuredDurationSec, ballsPerQuestion]);

  // Apply incoming paintball damage to local student player
  const applyIncomingDamage = (damage: number, attackerName: string, attackerId: string) => {
    sfx.playSplat();
    setShield(prevShield => {
      if (prevShield >= damage) {
        return prevShield - damage;
      }
      const rem = damage - prevShield;
      setHp(prevHp => {
        const nextHp = prevHp - rem;
        if (nextHp <= 0) {
          // Eliminated! Respawn at safe perimeter spot with full HP & Defence
          if (gameRef.current) {
            const angle = Math.random() * Math.PI * 2;
            gameRef.current.x = Math.cos(angle) * 28;
            gameRef.current.z = Math.sin(angle) * 20;
          }
          setShield(100);
          setKoBannerText(`SPLATTERED BY ${attackerName.toUpperCase()}! RESPAWNING...`);
          setTimeout(() => setKoBannerText(null), 2500);

          // Notify attacker of KO (+50 PTS)
          if (gameRef.current?.broadcastChannel) {
            try {
              gameRef.current.broadcastChannel.postMessage({
                type: 'award_ko',
                id: clientIdRef.current,
                attackerId,
                victimName: stateSnapRef.current.playerName
              });
            } catch {}
          }
          const evText = `💥 ${attackerName} splattered ${stateSnapRef.current.playerName} (+50 PTS)!`;
          pushLiveEvent(evText, '#f43f5e');
          setDoc(
            doc(db, 'paintball_rooms', roomCode),
            {
              latestEvent: {
                id: `ko-${Date.now()}`,
                text: evText,
                color: '#f43f5e',
                timestamp: Date.now()
              }
            },
            { merge: true }
          ).catch(() => {});

          return 100;
        }
        return nextHp;
      });
      return 0;
    });
  };

  // Upsert Remote Student Player 3D Hamster
  const upsertRemotePlayer = (rState: PlayerNetworkState) => {
    const g = gameRef.current;
    if (!g) return;
    let entry = g.remotePlayers.get(rState.id);
    const label =
      rState.team && rState.team !== 'solo'
        ? `[${rState.team.toUpperCase()}] ${rState.name}`
        : rState.name;

    if (!entry) {
      const mesh = buildHighDefHamster(rState.skinIdx, label, false, rState.team);
      mesh.position.set(rState.x, 0, rState.z);
      mesh.rotation.y = rState.rotY;
      g.scene.add(mesh);
      entry = { data: rState, mesh, walkPhase: 0 };
      g.remotePlayers.set(rState.id, entry);
    } else {
      // Rebuild name badge if team changed
      if (entry.data.team !== rState.team || entry.data.name !== rState.name) {
        g.scene.remove(entry.mesh);
        const mesh = buildHighDefHamster(rState.skinIdx, label, false, rState.team);
        mesh.position.set(rState.x, 0, rState.z);
        mesh.rotation.y = rState.rotY;
        g.scene.add(mesh);
        entry.mesh = mesh;
      }
      entry.data = rState;
    }
  };

  // Spawn Network Paintball Shot
  const spawnNetworkProjectile = (
    ownerId: string,
    ownerName: string,
    ownerTeam: TeamId,
    startX: number,
    startZ: number,
    angle: number,
    paintColor: number
  ) => {
    const g = gameRef.current;
    if (!g) return;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: paintColor,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        roughness: 0.1,
        metalness: 0.15
      })
    );
    ball.castShadow = true;
    ball.position.set(startX + Math.sin(angle) * 1.4, 1.55, startZ + Math.cos(angle) * 1.4);
    g.scene.add(ball);

    g.projectiles.push({
      ownerId,
      ownerName,
      ownerTeam,
      mesh: ball,
      vx: Math.sin(angle) * 36,
      vy: 2.0,
      vz: Math.cos(angle) * 36,
      gravity: 9.8,
      damage: 28,
      color: paintColor
    });
  };

  // =============================================================
  // 5. HIGH-DEFINITION 3D HAMSTER & POWER-UP CRATE BUILDERS
  // =============================================================
  function createFurTexture(baseHex: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const len = 4 + Math.random() * 7;
      ctx.strokeStyle =
        i % 2 === 0 ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.13)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 2.5, y + len);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }

  function createMaskGrillTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 256, 128);

    ctx.fillStyle = '#27272a';
    for (let y = 0; y < 128; y += 6) {
      for (let x = 0; x < 256; x += 6) {
        if ((x + y) % 12 === 0) ctx.fillRect(x, y, 3, 3);
      }
    }

    ctx.fillStyle = '#09090b';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 8; col++) {
        const sx = 28 + col * 26;
        const sy = 32 + row * 24;
        ctx.beginPath();
        ctx.roundRect(sx, sy, 16, 10, 4);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createPlayerNameSprite(
    name: string,
    skin: HamsterSkin,
    isHostReferee: boolean,
    team: TeamId = 'solo'
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    const borderHex = isHostReferee
      ? '#facc15'
      : team !== 'solo'
      ? TEAM_CONFIG[team].colorHex
      : skin.paintHex;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(24, 20, 464, 88, 44);
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = borderHex;
    ctx.stroke();

    ctx.fillStyle = borderHex;
    ctx.beginPath();
    ctx.arc(72, 64, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = '900 30px "Inter", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = isHostReferee ? '👑 TEACHER JAN [HOST]' : name.toUpperCase();
    ctx.fillText(label.slice(0, 20), 270, 64);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(3.4, 0.85, 1);
    sprite.position.set(0, 3.1, 0);
    return sprite;
  }

  function buildHighDefHamster(
    skinIdx: number,
    callsign: string,
    isHostReferee: boolean = false,
    team: TeamId = 'solo'
  ): THREE.Group {
    const skin = HAMSTER_SKINS[skinIdx % HAMSTER_SKINS.length];
    const teamColorNum =
      isHostReferee
        ? 0xfacc15
        : team !== 'solo'
        ? TEAM_CONFIG[team].colorNum
        : skin.paintColor;

    const root = new THREE.Group();

    const furTex = createFurTexture(skin.furHex);
    const furMat = new THREE.MeshStandardMaterial({
      color: skin.furColor,
      map: furTex,
      roughness: 0.72,
      metalness: 0.04
    });
    const bellyMat = new THREE.MeshStandardMaterial({
      color: skin.bellyColor,
      roughness: 0.8,
      metalness: 0.02
    });
    const pinkMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.5,
      metalness: 0.05
    });
    const vestMat = new THREE.MeshStandardMaterial({
      color: isHostReferee ? 0x1e1b4b : skin.vestColor,
      roughness: 0.45,
      metalness: 0.25
    });
    const strapMat = new THREE.MeshStandardMaterial({
      color: teamColorNum,
      roughness: 0.4,
      metalness: 0.2
    });
    const visorMat = new THREE.MeshPhysicalMaterial({
      color: isHostReferee ? 0xfacc15 : skin.visorColor,
      metalness: 0.92,
      roughness: 0.06,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 1.0
    });

    // 1. Articulated Legs & Cleats
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.42, 0.38, 0);
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.42, 0.38, 0);

    const buildFoot = () => {
      const fg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), furMat);
      thigh.scale.set(0.95, 1.1, 1.05);
      fg.add(thigh);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.22, 0.58),
        new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.35, metalness: 0.3 })
      );
      shoe.position.set(0, -0.22, 0.12);
      shoe.castShadow = true;
      fg.add(shoe);

      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.41, 0.06, 0.62),
        new THREE.MeshStandardMaterial({
          color: teamColorNum,
          emissive: teamColorNum,
          emissiveIntensity: 0.25
        })
      );
      sole.position.set(0, -0.32, 0.12);
      fg.add(sole);
      return fg;
    };
    leftLeg.add(buildFoot());
    rightLeg.add(buildFoot());
    root.add(leftLeg, rightLeg);

    // 2. Plump Sculpted Torso & Belly
    const bodyGroup = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 24), furMat);
    torso.scale.set(1.04, 1.02, 0.98);
    torso.position.y = 0.92;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.76, 24, 20), bellyMat);
    belly.scale.set(0.88, 0.92, 0.45);
    belly.position.set(0, 0.88, 0.66);
    bodyGroup.add(belly);

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 14), bellyMat);
    tail.position.set(0, 0.65, -0.92);
    bodyGroup.add(tail);

    // 3. Tactical Paintball Chest Vest & Rear 4-Pod Harness Pack
    const vestShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.95, 0.72, 24, 1, true),
      vestMat
    );
    vestShell.position.y = 0.96;
    vestShell.castShadow = true;
    bodyGroup.add(vestShell);

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 0.22), strapMat);
    chestPlate.position.set(0, 1.0, 0.83);
    bodyGroup.add(chestPlate);

    const podPackGroup = new THREE.Group();
    podPackGroup.position.set(0, 0.95, -0.88);
    const packBelt = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.44, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 })
    );
    podPackGroup.add(packBelt);

    const podColors = [0xa3e635, 0xec4899, 0x22d3ee, 0xfacc15];
    for (let p = 0; p < 4; p++) {
      const px = -0.3 + p * 0.2;
      const podTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.58, 12),
        new THREE.MeshPhysicalMaterial({
          color: podColors[p],
          transmission: 0.35,
          transparent: true,
          opacity: 0.9,
          clearcoat: 1.0,
          roughness: 0.1
        })
      );
      podTube.position.set(px, 0.04, -0.1);
      podPackGroup.add(podTube);

      const podCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.095, 0.095, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      podCap.position.set(px, 0.34, -0.1);
      podPackGroup.add(podCap);
    }
    bodyGroup.add(podPackGroup);

    // 4. Sculpted Head, Chubby Cheeks, Ears & Snout
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.72, 0.04);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.76, 28, 24), furMat);
    headSphere.scale.set(1.06, 0.96, 1.0);
    headSphere.castShadow = true;
    headGroup.add(headSphere);

    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 18), bellyMat);
    leftCheek.scale.set(1.1, 0.85, 0.95);
    leftCheek.position.set(-0.52, -0.14, 0.34);
    const rightCheek = leftCheek.clone();
    rightCheek.position.set(0.52, -0.14, 0.34);
    headGroup.add(leftCheek, rightCheek);

    const buildEar = (side: number) => {
      const earG = new THREE.Group();
      earG.position.set(side * 0.58, 0.58, -0.05);
      earG.rotation.z = -side * 0.38;
      earG.rotation.y = side * 0.25;

      const outerEar = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.12, 20), furMat);
      outerEar.rotation.x = Math.PI / 2;
      outerEar.castShadow = true;
      earG.add(outerEar);

      const innerEar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.13, 18), pinkMat);
      innerEar.rotation.x = Math.PI / 2;
      innerEar.position.z = 0.02;
      earG.add(innerEar);
      return earG;
    };
    headGroup.add(buildEar(-1), buildEar(1));

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), bellyMat);
    snout.scale.set(1.1, 0.8, 0.9);
    snout.position.set(0, -0.1, 0.72);
    headGroup.add(snout);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, clearcoat: 1.0, roughness: 0.15 })
    );
    nose.position.set(0, -0.04, 0.92);
    headGroup.add(nose);

    // 5. Pro Paintball Mask & Iridescent Thermal Goggles
    const maskGroup = new THREE.Group();
    const maskGrillMat = new THREE.MeshStandardMaterial({
      map: createMaskGrillTexture(),
      roughness: 0.4,
      metalness: 0.35
    });

    const faceGuard = new THREE.Mesh(
      new THREE.CylinderGeometry(0.79, 0.68, 0.44, 24, 1, false, -Math.PI * 0.38, Math.PI * 0.76),
      maskGrillMat
    );
    faceGuard.position.set(0, -0.16, 0.08);
    maskGroup.add(faceGuard);

    const goggleStrap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.785, 0.785, 0.24, 28),
      strapMat
    );
    goggleStrap.position.set(0, 0.14, 0);
    maskGroup.add(goggleStrap);

    const headband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.77, 0.14, 28),
      new THREE.MeshStandardMaterial({ color: teamColorNum, roughness: 0.5 })
    );
    headband.position.set(0, 0.38, 0);
    maskGroup.add(headband);

    const visorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.12, 0.44, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3, metalness: 0.5 })
    );
    visorFrame.position.set(0, 0.15, 0.58);
    maskGroup.add(visorFrame);

    const visorLens = new THREE.Mesh(
      new THREE.SphereGeometry(0.64, 28, 20, 0, Math.PI, Math.PI * 0.32, Math.PI * 0.36),
      visorMat
    );
    visorLens.rotation.y = -Math.PI / 2;
    visorLens.scale.set(0.95, 0.85, 1.18);
    visorLens.position.set(0, 0.15, 0.24);
    maskGroup.add(visorLens);

    headGroup.add(maskGroup);
    bodyGroup.add(headGroup);

    // 6. Articulated Arms & Marker Gun
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 12, 16), furMat);
    leftArm.position.set(-0.78, 1.18, 0.35);
    leftArm.rotation.x = Math.PI / 3;
    leftArm.rotation.z = -0.25;
    leftArm.castShadow = true;
    bodyGroup.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.38, 12, 16), furMat);
    rightArm.position.set(0.76, 1.18, 0.42);
    rightArm.rotation.x = Math.PI / 2.4;
    rightArm.castShadow = true;
    bodyGroup.add(rightArm);

    const markerGroup = new THREE.Group();
    markerGroup.position.set(0.82, 1.24, 0.55);

    const anodizedMat = new THREE.MeshPhysicalMaterial({
      color: teamColorNum,
      metalness: 0.88,
      roughness: 0.16,
      clearcoat: 0.8
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.65,
      roughness: 0.28
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.08
    });

    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.95), anodizedMat);
    receiver.castShadow = true;
    markerGroup.add(receiver);

    const barrelBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.075, 0.65, 16),
      carbonMat
    );
    barrelBack.rotation.x = Math.PI / 2;
    barrelBack.position.set(0, 0.05, 0.72);
    markerGroup.add(barrelBack);

    const barrelTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.065, 0.65, 16),
      anodizedMat
    );
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.05, 1.28);
    markerGroup.add(barrelTip);

    const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.2), carbonMat);
    pistolGrip.position.set(0, -0.24, -0.15);
    pistolGrip.rotation.x = -0.22;
    markerGroup.add(pistolGrip);

    const foreGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.34, 14), carbonMat);
    foreGrip.position.set(0, -0.22, 0.28);
    markerGroup.add(foreGrip);

    const hpaTankGroup = new THREE.Group();
    hpaTankGroup.position.set(0, -0.36, -0.52);
    const hpaBottle = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.36, 14, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0x0f172a,
        metalness: 0.4,
        roughness: 0.2,
        clearcoat: 1.0
      })
    );
    hpaBottle.rotation.x = Math.PI / 2;
    hpaTankGroup.add(hpaBottle);

    const regulatorNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.18, 14),
      chromeMat
    );
    regulatorNeck.rotation.x = Math.PI / 2;
    regulatorNeck.position.z = 0.28;
    hpaTankGroup.add(regulatorNeck);
    markerGroup.add(hpaTankGroup);

    const hopperGroup = new THREE.Group();
    hopperGroup.position.set(0, 0.42, 0.02);
    const hopperShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.72,
        roughness: 0.12,
        clearcoat: 1.0
      })
    );
    hopperShell.scale.set(0.92, 0.82, 1.38);
    hopperGroup.add(hopperShell);

    const speedFeed = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.03, 10, 20),
      new THREE.MeshStandardMaterial({ color: teamColorNum, roughness: 0.2 })
    );
    speedFeed.rotation.x = Math.PI / 2;
    speedFeed.position.y = 0.21;
    hopperGroup.add(speedFeed);

    markerGroup.add(hopperGroup);
    bodyGroup.add(markerGroup);
    root.add(bodyGroup);

    // 7. Floating 3D Callsign Tag
    const nameSprite = createPlayerNameSprite(callsign, skin, isHostReferee, team);
    root.add(nameSprite);

    root.userData = {
      leftLeg,
      rightLeg,
      bodyGroup,
      headGroup,
      markerGroup,
      skinIdx,
      callsign
    };

    return root;
  }

  // Build 3D Collectible Health & Defence/Shield Powerup Crates
  function buildPowerupCrate(type: 'health' | 'shield'): THREE.Group {
    const g = new THREE.Group();
    const isHealth = type === 'health';
    const mainColor = isHealth ? 0x22c55e : 0x06b6d4;
    const glowColor = isHealth ? 0x4ade80 : 0x38bdf8;

    // Glowing Base Ring on Turf
    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 1.05, 24),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75
      })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.04;
    g.add(baseRing);

    // Floating Rotating 3D Core
    const floater = new THREE.Group();
    floater.position.y = 1.05;

    if (isHealth) {
      // 3D Medkit Box + White/Green Cross
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.72, 0.95),
        new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          clearcoat: 1.0,
          roughness: 0.15
        })
      );
      box.castShadow = true;
      floater.add(box);

      const crossMat = new THREE.MeshStandardMaterial({
        color: mainColor,
        emissive: mainColor,
        emissiveIntensity: 0.45
      });
      const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.76, 1.0), crossMat);
      const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.24, 1.0), crossMat);
      floater.add(vBar, hBar);
    } else {
      // 3D Octahedron Defence Shield Crystal + Energy Torus
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62, 0),
        new THREE.MeshPhysicalMaterial({
          color: mainColor,
          emissive: mainColor,
          emissiveIntensity: 0.35,
          metalness: 0.4,
          roughness: 0.1,
          clearcoat: 1.0
        })
      );
      crystal.castShadow = true;
      floater.add(crystal);

      const shieldRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.75, 0.06, 12, 24),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: glowColor,
          emissiveIntensity: 0.6
        })
      );
      floater.add(shieldRing);
    }

    g.add(floater);
    g.userData = { floater, baseRing };
    return g;
  }

  const animateHamsterRig = (
    hamsterGroup: THREE.Group,
    isMoving: boolean,
    walkPhase: number,
    dt: number
  ): number => {
    const ud = hamsterGroup.userData;
    if (!ud) return walkPhase;
    let nextPhase = walkPhase;
    if (isMoving) {
      nextPhase += dt * 15;
      if (ud.leftLeg) ud.leftLeg.rotation.x = Math.sin(nextPhase) * 0.65;
      if (ud.rightLeg) ud.rightLeg.rotation.x = -Math.sin(nextPhase) * 0.65;
      if (ud.bodyGroup) {
        ud.bodyGroup.position.y = Math.abs(Math.sin(nextPhase * 2)) * 0.1;
        ud.bodyGroup.rotation.z = Math.sin(nextPhase) * 0.05;
      }
    } else {
      nextPhase += dt * 2.5;
      if (ud.leftLeg) ud.leftLeg.rotation.x *= 0.85;
      if (ud.rightLeg) ud.rightLeg.rotation.x *= 0.85;
      if (ud.bodyGroup) {
        ud.bodyGroup.position.y = Math.sin(nextPhase) * 0.025;
        ud.bodyGroup.rotation.z *= 0.85;
      }
    }
    return nextPhase;
  };

  const spawnPaintSplatEffect = (
    scene: THREE.Scene,
    splatDecals: THREE.Object3D[],
    particles: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
    }>,
    x: number,
    y: number,
    z: number,
    colorHex: number
  ) => {
    if (y <= 1.2) {
      const splatGroup = new THREE.Group();
      splatGroup.position.set(x, 0.03, z);
      splatGroup.rotation.y = Math.random() * Math.PI * 2;

      const splatMat = new THREE.MeshPhysicalMaterial({
        color: colorHex,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        roughness: 0.08,
        metalness: 0.1,
        polygonOffset: true,
        polygonOffsetFactor: -2
      });

      const mainRadius = 0.72 + Math.random() * 0.35;
      const centerDisc = new THREE.Mesh(new THREE.CircleGeometry(mainRadius, 18), splatMat);
      centerDisc.rotation.x = -Math.PI / 2;
      splatGroup.add(centerDisc);

      for (let d = 0; d < 4; d++) {
        const ang = (d / 4) * Math.PI * 2 + Math.random() * 0.4;
        const dist = mainRadius * (0.85 + Math.random() * 0.6);
        const dropR = mainRadius * (0.18 + Math.random() * 0.2);
        const drop = new THREE.Mesh(new THREE.CircleGeometry(dropR, 10), splatMat);
        drop.rotation.x = -Math.PI / 2;
        drop.position.set(Math.cos(ang) * dist, 0.005, Math.sin(ang) * dist);
        splatGroup.add(drop);
      }

      scene.add(splatGroup);
      splatDecals.push(splatGroup);
      if (splatDecals.length > 65) {
        const oldest = splatDecals.shift();
        if (oldest) scene.remove(oldest);
      }
    }

    const partMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      clearcoat: 1.0,
      roughness: 0.1
    });
    for (let i = 0; i < 8; i++) {
      const pMesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), partMat);
      pMesh.position.set(x, Math.max(0.25, y), z);
      scene.add(pMesh);
      const theta = Math.random() * Math.PI * 2;
      particles.push({
        mesh: pMesh,
        vx: Math.cos(theta) * (2 + Math.random() * 7),
        vy: 3 + Math.random() * 5,
        vz: Math.sin(theta) * (2 + Math.random() * 7),
        life: 0,
        maxLife: 0.42 + Math.random() * 0.2
      });
    }
  };

  // -------------------------------------------------------------
  // 6. INITIALIZE THREE.JS PRO PAINTBALL ARENA (WITH EXTRA COVER & POWERUPS)
  // -------------------------------------------------------------
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc);
    scene.fog = new THREE.FogExp2(0xbae6fd, 0.005);

    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);

    const gl = renderer.getContext();
    const debugBasic = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugBasic ? gl.getParameter(debugBasic.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /SwiftShader|Software|llvmpipe|Microsoft Basic Render/i.test(rendererStr);

    renderer.setPixelRatio(isSoftwareGl ? 1.0 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x3f6212, 0.88);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.55);
    sunLight.position.set(36, 65, 28);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 160;
    const d = 60;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Pro Astro-Turf & Tournament Boundary Markings
    const createProArenaTurfTexture = () => {
      const c = document.createElement('canvas');
      c.width = 1024;
      c.height = 1024;
      const ctx = c.getContext('2d')!;

      const stripeCount = 16;
      const stripeW = c.width / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#4d9c2d' : '#5cb338';
        ctx.fillRect(i * stripeW, 0, stripeW, c.height);
      }

      for (let i = 0; i < 16000; i++) {
        const gx = Math.random() * c.width;
        const gy = Math.random() * c.height;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,40,10,0.08)';
        ctx.fillRect(gx, gy, 2, 4);
      }

      // Park Walkways
      ctx.fillStyle = '#c2b280';
      ctx.fillRect(0, 468, 1024, 88);
      ctx.fillRect(468, 0, 88, 1024);

      // Tournament Boundary Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 8;
      ctx.strokeRect(86, 100, 852, 824);

      // 50-Yard Center Line
      ctx.save();
      ctx.setLineDash([24, 16]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(512, 100);
      ctx.lineTo(512, 924);
      ctx.stroke();
      ctx.restore();

      // Center Circle
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(512, 512, 92, 0, Math.PI * 2);
      ctx.stroke();

      // Team Start Boxes
      ctx.fillStyle = 'rgba(244, 63, 94, 0.38)';
      ctx.fillRect(86, 442, 50, 140);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
      ctx.fillRect(888, 442, 50, 140);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    const groundMat = new THREE.MeshStandardMaterial({
      map: createProArenaTurfTexture(),
      roughness: 0.84,
      metalness: 0.04
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const obstacles: Array<{ x: number; z: number; r: number; h: number }> = [];

    // Inflatable PVC Bunker Bump & Color Textures
    const createRibbedBumpTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d')!;
      for (let y = 0; y < 256; y++) {
        const rib = Math.sin((y / 32) * Math.PI);
        const val = Math.floor(128 + rib * 110);
        ctx.fillStyle = `rgb(${val},${val},${val})`;
        ctx.fillRect(0, y, 256, 1);
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      return tex;
    };
    const bunkerBumpTex = createRibbedBumpTexture();

    const createProBunkerTexture = (
      primary: string,
      secondary: string,
      accent: string,
      badgeText: string = 'PRO X'
    ) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 512;
      const ctx = c.getContext('2d')!;

      ctx.fillStyle = primary;
      ctx.fillRect(0, 0, 512, 512);

      ctx.fillStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(0, 110);
      ctx.lineTo(256, 250);
      ctx.lineTo(512, 110);
      ctx.lineTo(512, 220);
      ctx.lineTo(256, 360);
      ctx.lineTo(0, 220);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = accent;
      ctx.fillRect(0, 390, 512, 46);
      ctx.fillRect(232, 0, 48, 512);

      for (let y = 0; y < 512; y += 64) {
        const grad = ctx.createLinearGradient(0, y, 0, y + 64);
        grad.addColorStop(0, 'rgba(0,0,0,0.28)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.18)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(0,0,0,0.32)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, 512, 64);
      }

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.roundRect(146, 196, 220, 96, 18);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.font = '900 36px "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, 256, 244);

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    const makeInflatableMat = (tex: THREE.CanvasTexture) =>
      new THREE.MeshPhysicalMaterial({
        map: tex,
        bumpMap: bunkerBumpTex,
        bumpScale: 0.04,
        roughness: 0.18,
        metalness: 0.08,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        reflectivity: 0.9
      });

    // Bunker Builders
    const createDorito = (
      x: number,
      z: number,
      c1: string,
      c2: string,
      c3: string,
      rot = 0
    ) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, c3, 'DORITO'));
      const body = new THREE.Mesh(new THREE.ConeGeometry(2.85, 4.9, 3), mat);
      body.position.y = 2.45;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const cap = new THREE.Mesh(
        new THREE.TorusGeometry(1.15, 0.34, 16, 28),
        new THREE.MeshPhysicalMaterial({ color: c3, clearcoat: 1.0, roughness: 0.15 })
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 4.15;
      g.add(cap);

      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.35, h: 4.8 });
    };

    const createCan = (x: number, z: number, c1: string, c2: string, c3: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, c3, 'PRO CAN'));
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.25, 4.6, 28), mat);
      cyl.position.y = 2.3;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      g.add(cyl);

      const topRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.25, 14, 32),
        new THREE.MeshPhysicalMaterial({ color: c2, clearcoat: 1.0, roughness: 0.15 })
      );
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 4.55;
      g.add(topRing);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.35, h: 4.7 });
    };

    const createBrick = (x: number, z: number, rot: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#facc15', 'WALL'));
      for (let i = 0; i < 3; i++) {
        const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 4.6, 16, 24), mat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.72 + i * 1.15;
        tube.castShadow = true;
        tube.receiveShadow = true;
        g.add(tube);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.8, h: 3.6 });
    };

    const createCenterXBunker = (x: number, z: number) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(
        createProBunkerTexture('#1e1b4b', '#ec4899', '#a3e635', 'X-BALL 50')
      );
      const leg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 5.2, 16, 24), mat);
      leg1.position.y = 2.8;
      leg1.rotation.z = Math.PI / 4;
      leg1.castShadow = true;
      leg1.receiveShadow = true;
      g.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.95, 5.2, 16, 24), mat);
      leg2.position.y = 2.8;
      leg2.rotation.z = -Math.PI / 4;
      leg2.castShadow = true;
      leg2.receiveShadow = true;
      g.add(leg2);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 3.1, h: 5.2 });
    };

    const createSnakeBeam = (x: number, z: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#ffffff', 'SNAKE'));
      const beam = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 5.5, 14, 20), mat);
      beam.rotation.x = Math.PI / 2;
      beam.position.y = 0.75;
      beam.castShadow = true;
      beam.receiveShadow = true;
      g.add(beam);

      const post = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.15, 2.6, 20), mat);
      post.position.set(0, 1.3, 0);
      post.castShadow = true;
      g.add(post);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.4, h: 2.6 });
    };

    // NEW EXTRA HIDING SPOTS: Wooden Fort Bunkers, L-Shaped Tactical Shields & Tire Stacks
    const createWoodenFortBunker = (x: number, z: number, rot = 0) => {
      const g = new THREE.Group();
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.78 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });

      const frontWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 0.55), woodMat);
      frontWall.position.set(0, 1.6, 1.2);
      frontWall.castShadow = true;
      frontWall.receiveShadow = true;
      g.add(frontWall);

      const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.8, 3.2), woodMat);
      sideWallL.position.set(-2.35, 1.4, -0.1);
      sideWallL.castShadow = true;
      g.add(sideWallL);

      const sideWallR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.8, 3.2), woodMat);
      sideWallR.position.set(2.35, 1.4, -0.1);
      sideWallR.castShadow = true;
      g.add(sideWallR);

      const roofBeam = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 1.6), trimMat);
      roofBeam.position.set(0, 3.3, 0.8);
      g.add(roofBeam);

      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.9, h: 3.4 });
    };

    const createTireStack = (x: number, z: number) => {
      const g = new THREE.Group();
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      const offsets = [
        [-0.9, 0],
        [0.9, 0],
        [0, 0.9]
      ];
      offsets.forEach(([ox, oz], idx) => {
        for (let level = 0; level < (idx === 2 ? 4 : 3); level++) {
          const tire = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.34, 12, 20), tireMat);
          tire.rotation.x = Math.PI / 2;
          tire.position.set(ox, 0.34 + level * 0.64, oz);
          tire.castShadow = true;
          g.add(tire);
        }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), rimMat);
        cap.position.set(ox, (idx === 2 ? 4 : 3) * 0.64, oz);
        g.add(cap);
      });
      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.1, h: 2.8 });
    };

    const createAztecaTempleBunker = (x: number, z: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#facc15', 'MAYA'));
      for (let step = 0; step < 3; step++) {
        const w = 4.6 - step * 1.1;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, w * 0.65), mat);
        box.position.y = 0.68 + step * 1.3;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.6, h: 4.1 });
    };

    // Place Dense Pro Speedball & Woodsball Hiding Spots Across Entire Arena
    createCenterXBunker(-4, -2);
    createDorito(-13, 7, '#1d4ed8', '#eab308', '#38bdf8', 0.4);
    createDorito(-11, -15, '#1d4ed8', '#facc15', '#ffffff', -0.3);
    createDorito(18, 11, '#be185d', '#84cc16', '#f472b6', 0.9);
    createDorito(14, -21, '#0284c7', '#facc15', '#38bdf8', -0.5);
    createDorito(-24, -20, '#7c3aed', '#a3e635', '#ffffff', 0.2);

    createCan(-20, -4, '#eab308', '#1e293b', '#fef08a');
    createCan(16, 18, '#db2777', '#f8fafc', '#f472b6');
    createCan(-26, 15, '#9333ea', '#a3e635', '#e9d5ff');
    createCan(28, 12, '#0d9488', '#facc15', '#ffffff');

    createBrick(-19, 14, 0.25, '#0d9488', '#f8fafc');
    createBrick(7, 21, 0.05, '#7c3aed', '#facc15');
    createBrick(-6, 22, -0.15, '#e11d48', '#f8fafc');
    createBrick(2, -23, 0.1, '#2563eb', '#a3e635');

    createSnakeBeam(-32, -12, '#ea580c', '#facc15');
    createSnakeBeam(-32, 3, '#ea580c', '#facc15');
    createSnakeBeam(-32, 16, '#ea580c', '#facc15');

    // Extra Woodland Fort Bunkers, Maya Temples & Tire Barricades
    createWoodenFortBunker(-34, -22, 0.6);
    createWoodenFortBunker(32, 22, -2.4);
    createWoodenFortBunker(0, 12, Math.PI);
    createAztecaTempleBunker(-18, -22, '#059669', '#facc15');
    createAztecaTempleBunker(24, 3, '#dc2626', '#facc15');
    createTireStack(-9, 16);
    createTireStack(11, 4);
    createTireStack(-15, -9);
    createTireStack(15, -15);

    // =========================================================
    // COLLECTIBLE HEALTH & DEFENCE SHIELD POWER-UP CRATES
    // =========================================================
    const powerupConfigs: Array<{ type: 'health' | 'shield'; x: number; z: number }> = [
      { type: 'health', x: -16, z: 2 },
      { type: 'shield', x: -2, z: -14 },
      { type: 'health', x: 14, z: 14 },
      { type: 'shield', x: -24, z: -10 },
      { type: 'health', x: 22, z: -20 },
      { type: 'shield', x: 4, z: 24 },
      { type: 'health', x: -28, z: 22 },
      { type: 'shield', x: 32, z: 8 }
    ];

    const powerups: PowerupNode[] = powerupConfigs.map((cfg, idx) => {
      const mesh = buildPowerupCrate(cfg.type);
      mesh.position.set(cfg.x, 0, cfg.z);
      scene.add(mesh);
      return {
        id: `pu-${idx}`,
        type: cfg.type,
        x: cfg.x,
        z: cfg.z,
        active: true,
        respawnAt: 0,
        mesh
      };
    });

    // Arena Perimeter Truss Towers
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.25
    });
    const bannerColors = [0xa3e635, 0xec4899, 0x38bdf8, 0xfacc15];
    [
      [-46, -34],
      [-23, -34],
      [0, -34],
      [23, -34],
      [46, -34],
      [-46, 34],
      [-23, 34],
      [0, 34],
      [23, 34],
      [46, 34],
      [-46, -17],
      [-46, 0],
      [-46, 17],
      [46, -17],
      [46, 0],
      [46, 17]
    ].forEach(([px, pz], idx) => {
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.7, 9.5, 0.7), trussMat);
      tower.position.set(px, 4.75, pz);
      tower.castShadow = true;
      scene.add(tower);

      const flag = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.9, 0.12),
        new THREE.MeshStandardMaterial({
          color: bannerColors[idx % bannerColors.length],
          emissive: bannerColors[idx % bannerColors.length],
          emissiveIntensity: 0.2
        })
      );
      flag.position.set(px + 0.8, 9.0, pz);
      scene.add(flag);
    });

    // Central Woodland Gazebo Pavilion
    const gazebo = new THREE.Group();
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65 });
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.7, 0.75, 8), deckMat);
    deck.position.y = 0.38;
    deck.receiveShadow = true;
    gazebo.add(deck);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const px = Math.cos(a) * 6.9;
      const pz = Math.sin(a) * 6.9;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 5.8, 14), pillarMat);
      pillar.position.set(px, 3.2, pz);
      pillar.castShadow = true;
      gazebo.add(pillar);
      obstacles.push({ x: 5 + px, z: -8 + pz, r: 0.58, h: 5.8 });
    }

    const roofMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e3a8a,
      roughness: 0.35,
      clearcoat: 0.6
    });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.6, 5.2, 8), roofMat);
    roof.position.y = 8.4;
    roof.castShadow = true;
    gazebo.add(roof);

    gazebo.position.set(5, 0, -8);
    scene.add(gazebo);

    // Shimmering Hydroplane Pond
    const pondGroup = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(13.6, 14.2, 0.42, 36),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75 })
    );
    rim.position.y = 0.16;
    rim.receiveShadow = true;
    pondGroup.add(rim);

    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x06b6d4,
      roughness: 0.06,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transmission: 0.25
    });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(12.9, 12.9, 0.46, 36), waterMat);
    water.position.y = 0.2;
    pondGroup.add(water);

    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 });
    [
      [-3, 4],
      [4, -5],
      [-5, -3],
      [2, 6]
    ].forEach(([lx, lz]) => {
      const lily = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.08, 18), lilyMat);
      lily.position.set(lx, 0.45, lz);
      pondGroup.add(lily);
    });

    pondGroup.position.set(27, 0, -9);
    scene.add(pondGroup);

    // Perimeter Trees
    const createTree = (x: number, z: number, scale = 1) => {
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45 * scale, 0.68 * scale, 3.4 * scale, 12),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 })
      );
      trunk.position.y = 1.7 * scale;
      trunk.castShadow = true;
      tg.add(trunk);

      const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
      const l1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.3 * scale, 1), leavesMat);
      l1.position.y = 4.3 * scale;
      l1.castShadow = true;
      tg.add(l1);

      const l2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.7 * scale, 1), leavesMat);
      l2.position.set(0.8 * scale, 5.6 * scale, 0.4 * scale);
      l2.castShadow = true;
      tg.add(l2);

      tg.position.set(x, 0, z);
      scene.add(tg);
      obstacles.push({ x, z, r: 0.9 * scale, h: 6 * scale });
    };

    [
      [-38, -26, 1.3],
      [-36, 24, 1.2],
      [38, 25, 1.4],
      [36, -26, 1.15],
      [-16, -28, 1.25],
      [16, -28, 1.1],
      [-40, 2, 1.35]
    ].forEach(([tx, tz, sc]) => createTree(tx, tz, sc));

    // =========================================================
    // BUILD ONLY 1 CHARACTER IN LOBBY BY DEFAULT:
    // - If Host (Teacher Jan): Build Teacher Jan's Host Referee Hamster at the Gazebo (5, 0.75, -8)
    // - If Student Player: Build the local Student Hamster at the Start Gate (-4, 0, 8)
    // NO EXTRA AI BOTS ARE SPAWNED!
    // =========================================================
    const isHostRole = stateSnapRef.current.role === 'host';
    const localLabel = isHostRole
      ? 'Teacher Jan'
      : stateSnapRef.current.matchMode === 'teams'
      ? `[${stateSnapRef.current.myTeam.toUpperCase()}] ${stateSnapRef.current.playerName || 'Student'}`
      : stateSnapRef.current.playerName || 'Student';

    const localHamster = buildHighDefHamster(
      selectedSkinIdx,
      localLabel,
      isHostRole,
      stateSnapRef.current.myTeam
    );

    const startX = isHostRole ? 5 : -6;
    const startZ = isHostRole ? -5.5 : 8;
    localHamster.position.set(startX, isHostRole ? 0.75 : 0, startZ);
    scene.add(localHamster);

    gameRef.current = {
      scene,
      camera,
      renderer,
      localHamster,
      x: startX,
      z: startZ,
      rotY: 0,
      vx: 0,
      vz: 0,
      walkPhase: 0,
      keys: {},
      joyX: 0,
      joyZ: 0,
      mouseDown: false,
      mouseScreenX: window.innerWidth / 2,
      mouseScreenY: window.innerHeight / 2,
      aimWorldX: 0,
      aimWorldZ: 15,
      lastShotTime: 0,
      hostCamX: 0,
      hostCamZ: 8,
      obstacles,
      powerups,
      projectiles: [],
      splatDecals: [],
      particles: [],
      remotePlayers: new Map(),
      waterMesh: water
    };

    // Keyboard & Mouse Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      const k = e.key.toLowerCase();
      gameRef.current.keys[k] = true;

      if (k === 'q' && stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') {
        setIsQuestionModalOpen(prev => !prev);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      gameRef.current.keys[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gameRef.current) return;
      gameRef.current.mouseScreenX = e.clientX;
      gameRef.current.mouseScreenY = e.clientY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !gameRef.current) return;
      const target = e.target as HTMLElement;
      if (target && target.tagName !== 'CANVAS' && !target.classList.contains('cursor-crosshair')) {
        return;
      }
      gameRef.current.mouseDown = true;
      if (stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') {
        fireShot();
      }
    };

    const handleMouseUp = () => {
      if (!gameRef.current) return;
      gameRef.current.mouseDown = false;
    };

    const handleResize = () => {
      if (!gameRef.current) return;
      gameRef.current.camera.aspect = window.innerWidth / window.innerHeight;
      gameRef.current.camera.updateProjectionMatrix();
      gameRef.current.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    // =========================================================
    // MAIN 60FPS ANIMATION LOOP (STABLE CAMERA — NO SPIN FEEDBACK LOOP!)
    // =========================================================
    let lastTime = performance.now();
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2);
    const hitPt = new THREE.Vector3();

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const g = gameRef.current;
      if (!g) return;
      const snapState = stateSnapRef.current;

      // Water ripple animation
      if (g.waterMesh) {
        g.waterMesh.position.y = 0.2 + Math.sin(now * 0.003) * 0.03;
      }

      // Animate Floating Powerup Crates (Health & Defence Shield)
      g.powerups.forEach(pu => {
        if (!pu.active && now >= pu.respawnAt) {
          pu.active = true;
          pu.mesh.visible = true;
        }
        if (pu.active && pu.mesh.userData.floater) {
          pu.mesh.userData.floater.rotation.y += dt * 2.2;
          pu.mesh.userData.floater.position.y = 1.05 + Math.sin(now * 0.004 + pu.x) * 0.18;
        }
      });

      // Keyboard WASD + Mobile Virtual Touch Joystick input
      let moveX = g.joyX;
      let moveZ = g.joyZ;
      if (g.keys['w'] || g.keys['arrowup']) moveZ -= 1;
      if (g.keys['s'] || g.keys['arrowdown']) moveZ += 1;
      if (g.keys['a'] || g.keys['arrowleft']) moveX -= 1;
      if (g.keys['d'] || g.keys['arrowright']) moveX += 1;

      const isMoving = Math.hypot(moveX, moveZ) > 0.05;
      if (isMoving) {
        const len = Math.hypot(moveX, moveZ);
        if (len > 1) {
          moveX /= len;
          moveZ /= len;
        }
      }

      if (snapState.role === 'host') {
        // ---------------------------------------------------
        // TEACHER JAN (HOST) CAMERA & REFEREE DISPLAY
        // ---------------------------------------------------
        g.localHamster.position.set(5, 0.75, -5.5);
        g.localHamster.rotation.y = Math.sin(now * 0.001) * 0.35;
        g.walkPhase = animateHamsterRig(g.localHamster, false, g.walkPhase, dt);

        if (snapState.screen === 'game' && snapState.hostCameraMode === 'follow') {
          const remotes = Array.from(g.remotePlayers.values());
          if (remotes.length > 0) {
            const targetPlayer = remotes[snapState.hostFollowIndex % remotes.length];
            const tx = targetPlayer.mesh.position.x;
            const tz = targetPlayer.mesh.position.z;
            g.hostCamX += (tx - g.hostCamX) * 6 * dt;
            g.hostCamZ += (tz - g.hostCamZ) * 6 * dt;
            camera.position.x += (g.hostCamX - camera.position.x) * 6 * dt;
            camera.position.y += (24 - camera.position.y) * 6 * dt;
            camera.position.z += (g.hostCamZ + 20 - camera.position.z) * 6 * dt;
            camera.lookAt(g.hostCamX, 1.2, g.hostCamZ);
          } else {
            camera.position.x += (0 - camera.position.x) * 4 * dt;
            camera.position.y += (38 - camera.position.y) * 4 * dt;
            camera.position.z += (34 - camera.position.z) * 4 * dt;
            camera.lookAt(0, 1.0, 0);
          }
        } else {
          // Host Overview Camera (can pan smoothly with WASD/Arrow keys during match)
          if (isMoving && snapState.screen === 'game') {
            g.hostCamX = Math.max(-35, Math.min(35, g.hostCamX + moveX * 22 * dt));
            g.hostCamZ = Math.max(-25, Math.min(25, g.hostCamZ + moveZ * 22 * dt));
          }
          const targetY = snapState.screen === 'game' ? 38 : 28;
          const targetZ = snapState.screen === 'game' ? g.hostCamZ + 32 : 24;
          camera.position.x += (g.hostCamX - camera.position.x) * 5 * dt;
          camera.position.y += (targetY - camera.position.y) * 5 * dt;
          camera.position.z += (targetZ - camera.position.z) * 5 * dt;
          camera.lookAt(g.hostCamX, 1.2, g.hostCamZ - 2);
        }
      } else {
        // ---------------------------------------------------
        // STUDENT PLAYER MOVEMENT, STABLE CAMERA & AIMING
        // ---------------------------------------------------
        const distToPond = Math.hypot(g.x - 27, g.z - -9);
        const inPondBoost = distToPond < 12.6 ? 1.32 : 1.0;
        const speed = 14.0 * inPondBoost;

        g.vx = moveX * speed;
        g.vz = moveZ * speed;

        g.x = Math.max(-44, Math.min(44, g.x + g.vx * dt));
        g.z = Math.max(-32, Math.min(32, g.z + g.vz * dt));

        // Obstacle Collisions
        g.obstacles.forEach(obs => {
          const dx = g.x - obs.x;
          const dz = g.z - obs.z;
          const d = Math.hypot(dx, dz);
          const minDist = obs.r + 1.05;
          if (d < minDist && d > 0.001) {
            const push = minDist - d;
            g.x += (dx / d) * push;
            g.z += (dz / d) * push;
          }
        });

        // Collectible Health & Defence Shield Powerup Pickups
        g.powerups.forEach(pu => {
          if (!pu.active) return;
          if (Math.hypot(g.x - pu.x, g.z - pu.z) < 1.85) {
            pu.active = false;
            pu.mesh.visible = false;
            pu.respawnAt = now + 12000; // Respawn in 12 seconds
            sfx.playPowerup();
            if (pu.type === 'health') {
              setHp(h => Math.min(100, h + 35));
              setPickupBannerText('❤️ +35 HEALTH RESTORED!');
            } else {
              setShield(s => Math.min(100, s + 40));
              setPickupBannerText('🛡️ +40 DEFENCE SHIELD CHARGED!');
            }
            setTimeout(() => setPickupBannerText(null), 2000);
          }
        });

        // STABLE FOLLOW CAMERA (Decoupled from mouse rotation so screen NEVER spins uncontrollably!)
        const targetCamX = g.x;
        const targetCamY = 23.5;
        const targetCamZ = g.z + 19.5;
        camera.position.x += (targetCamX - camera.position.x) * 8 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 8 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 8 * dt;
        camera.lookAt(g.x, 1.2, g.z - 1.5);

        // Update camera matrix BEFORE raycasting mouse aim so hitPt is 100% deterministic
        camera.updateMatrixWorld();

        if (isMoving && !g.mouseDown && Math.hypot(g.joyX, g.joyZ) > 0.1) {
          // On mobile touch joystick, face movement direction unless tapping to shoot
          g.rotY = Math.atan2(moveX, moveZ);
          g.aimWorldX = g.x + Math.sin(g.rotY) * 12;
          g.aimWorldZ = g.z + Math.cos(g.rotY) * 12;
        } else {
          const ndcX = (g.mouseScreenX / window.innerWidth) * 2 - 1;
          const ndcY = -(g.mouseScreenY / window.innerHeight) * 2 + 1;
          raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
          if (raycaster.ray.intersectPlane(groundPlane, hitPt)) {
            g.aimWorldX = hitPt.x;
            g.aimWorldZ = hitPt.z;
            if (Math.hypot(hitPt.x - g.x, hitPt.z - g.z) > 0.3) {
              g.rotY = Math.atan2(hitPt.x - g.x, hitPt.z - g.z);
            }
          }
        }

        g.localHamster.position.set(g.x, 0, g.z);
        g.localHamster.rotation.y = g.rotY;
        g.walkPhase = animateHamsterRig(g.localHamster, isMoving, g.walkPhase, dt);
      }

      // Update Projectiles & Collisions
      for (let i = g.projectiles.length - 1; i >= 0; i--) {
        const p = g.projectiles[i];
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        let hit = false;

        // Obstacle / Bunker Collisions
        for (const obs of g.obstacles) {
          if (
            p.mesh.position.y <= obs.h &&
            Math.hypot(p.mesh.position.x - obs.x, p.mesh.position.z - obs.z) < obs.r + 0.25
          ) {
            hit = true;
            sfx.playSplat();
            spawnPaintSplatEffect(
              scene,
              g.splatDecals,
              g.particles,
              p.mesh.position.x,
              p.mesh.position.y,
              p.mesh.position.z,
              p.color
            );
            break;
          }
        }

        // Check Hits on Remote Players (when shot by local player)
        if (!hit && p.ownerId === clientIdRef.current) {
          g.remotePlayers.forEach(entry => {
            if (hit) return;
            // Friendly fire check in Teams mode
            if (
              snapState.matchMode === 'teams' &&
              entry.data.team === snapState.myTeam &&
              entry.data.team !== 'solo'
            ) {
              return;
            }
            const rx = entry.mesh.position.x;
            const rz = entry.mesh.position.z;
            if (Math.hypot(p.mesh.position.x - rx, p.mesh.position.z - rz) < 1.4) {
              hit = true;
              sfx.playSplat();
              spawnPaintSplatEffect(scene, g.splatDecals, g.particles, rx, 1.2, rz, p.color);
              // Award +15 Hit Points
              setScore(s => s + 15);
              if (g.broadcastChannel) {
                try {
                  g.broadcastChannel.postMessage({
                    type: 'hit_player',
                    id: clientIdRef.current,
                    targetId: entry.data.id,
                    attackerId: clientIdRef.current,
                    attackerName: snapState.playerName,
                    damage: p.damage
                  });
                } catch {}
              }
            }
          });
        }

        // Check Hits on Local Student Player (when shot by remote player)
        if (
          !hit &&
          p.ownerId !== clientIdRef.current &&
          snapState.role === 'player' &&
          snapState.screen === 'game'
        ) {
          const isFriendly =
            snapState.matchMode === 'teams' &&
            p.ownerTeam === snapState.myTeam &&
            p.ownerTeam !== 'solo';
          if (
            !isFriendly &&
            Math.hypot(p.mesh.position.x - g.x, p.mesh.position.z - g.z) < 1.35
          ) {
            hit = true;
            spawnPaintSplatEffect(scene, g.splatDecals, g.particles, g.x, 1.1, g.z, p.color);
            applyIncomingDamage(p.damage, p.ownerName || 'Opponent', p.ownerId);
          }
        }

        // Ground Turf Impact
        if (!hit && p.mesh.position.y <= 0.15) {
          hit = true;
          sfx.playSplat();
          spawnPaintSplatEffect(
            scene,
            g.splatDecals,
            g.particles,
            p.mesh.position.x,
            0.05,
            p.mesh.position.z,
            p.color
          );
        }

        if (hit || p.mesh.position.y < -1) {
          scene.remove(p.mesh);
          g.projectiles.splice(i, 1);
        }
      }

      // Update Paint Burst Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const pt = g.particles[i];
        pt.life += dt;
        pt.vy -= 18 * dt;
        pt.mesh.position.x += pt.vx * dt;
        pt.mesh.position.y += pt.vy * dt;
        pt.mesh.position.z += pt.vz * dt;
        const scale = Math.max(0.01, 1 - pt.life / pt.maxLife);
        pt.mesh.scale.setScalar(scale);
        if (pt.life >= pt.maxLife || pt.mesh.position.y < 0) {
          scene.remove(pt.mesh);
          g.particles.splice(i, 1);
        }
      }

      // Smoothly Interpolate Remote Student Players
      g.remotePlayers.forEach(entry => {
        const dx = entry.data.x - entry.mesh.position.x;
        const dz = entry.data.z - entry.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        entry.mesh.position.x += dx * Math.min(1, dt * 10);
        entry.mesh.position.z += dz * Math.min(1, dt * 10);
        entry.mesh.rotation.y = entry.data.rotY;
        entry.walkPhase = animateHamsterRig(entry.mesh, dist > 0.08, entry.walkPhase, dt);
      });

      renderer.render(scene, camera);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      pmremGenerator.dispose();
      renderer.dispose();
    };
  }, [selectedSkinIdx, role, myTeam]);

  // -------------------------------------------------------------
  // 7. FIRE PAINTBALL & EARN AMMO VIA QUESTIONS
  // -------------------------------------------------------------
  const fireShot = () => {
    const g = gameRef.current;
    if (!g || role !== 'player') return;
    const now = performance.now();
    if (now - g.lastShotTime < 190) return;

    // Players MUST answer questions to earn paintball ammunition!
    if (ammo <= 0) {
      setIsQuestionModalOpen(true);
      return;
    }

    g.lastShotTime = now;
    setAmmo(a => Math.max(0, a - 1));
    sfx.playMarkerShot();

    const teamPaint =
      matchMode === 'teams' && myTeam !== 'solo'
        ? TEAM_CONFIG[myTeam].colorNum
        : HAMSTER_SKINS[selectedSkinIdx].paintColor;

    const dx = g.aimWorldX - g.x;
    const dz = g.aimWorldZ - g.z;
    const angle = Math.hypot(dx, dz) > 0.2 ? Math.atan2(dx, dz) : g.rotY;

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: teamPaint,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        roughness: 0.08,
        metalness: 0.15
      })
    );
    ball.castShadow = true;
    ball.position.set(g.x + Math.sin(angle) * 1.4, 1.55, g.z + Math.cos(angle) * 1.4);
    g.scene.add(ball);

    g.projectiles.push({
      ownerId: clientIdRef.current,
      ownerName: playerName || 'Student',
      ownerTeam: matchMode === 'teams' ? myTeam : 'solo',
      mesh: ball,
      vx: Math.sin(angle) * 36,
      vy: 2.0,
      vz: Math.cos(angle) * 36,
      gravity: 9.8,
      damage: 28,
      color: teamPaint
    });

    if (g.broadcastChannel) {
      try {
        g.broadcastChannel.postMessage({
          type: 'fire_shot',
          id: clientIdRef.current,
          ownerId: clientIdRef.current,
          ownerName: playerName || 'Student',
          ownerTeam: matchMode === 'teams' ? myTeam : 'solo',
          x: g.x,
          z: g.z,
          angle,
          paintColor: teamPaint
        });
      } catch {}
    }
  };

  // Teacher Host Action: Auto-Assign / Shuffle Joined Players into Red & Blue Teams
  const handleShuffleTeams = async () => {
    sfx.playCorrect();
    const teamCycle: TeamId[] = ['red', 'blue'];
    const shuffled = [...roomPlayers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      const assigned = teamCycle[i % teamCycle.length];
      const pRef = doc(db, `rooms_${roomCode}_players`, shuffled[i].id);
      updateDoc(pRef, { team: assigned }).catch(() => {});
    }
    pushLiveEvent('🔀 Teacher Jan shuffled players into Red & Blue Squads!', '#38bdf8');
  };

  // Teacher Host Action: Cycle a specific student's team in the lobby
  const handleCyclePlayerTeam = (player: PlayerNetworkState) => {
    const order: TeamId[] = ['red', 'blue', 'green', 'gold'];
    const nextIdx = (order.indexOf(player.team) + 1) % order.length;
    const nextTeam = order[nextIdx];
    const pRef = doc(db, `rooms_${roomCode}_players`, player.id);
    updateDoc(pRef, { team: nextTeam }).catch(() => {});
  };

  // Teacher Host Action: Start Match & Open Live Broadcast View
  const handleStartMultiplayerMatch = () => {
    sfx.playKO();
    setMatchSeconds(configuredDurationSec);
    setScreen('game');
    const startEv: LiveFeedEvent = {
      id: `start-${Date.now()}`,
      text: `🚀 Match Started! (${matchMode === 'teams' ? 'Team Battle' : 'Solo Free-For-All'} • ${ballsPerQuestion} Balls/Question)`,
      color: '#a3e635',
      timestamp: Date.now()
    };
    setLiveEvents(prev => [startEv, ...prev]);

    if (gameRef.current?.broadcastChannel) {
      try {
        gameRef.current.broadcastChannel.postMessage({
          type: 'match_start',
          id: clientIdRef.current,
          durationSec: configuredDurationSec
        });
      } catch {}
    }

    if (roomCode) {
      setDoc(
        doc(db, 'paintball_rooms', roomCode),
        {
          matchStatus: 'playing',
          matchMode,
          configuredDurationSec,
          ballsPerQuestion,
          startedAt: Date.now(),
          latestEvent: startEv
        },
        { merge: true }
      ).catch(() => {});
    }
  };

  // Teacher Host Action: End Match & Show Final Standings
  const handleEndMatch = () => {
    sfx.playKO();
    setScreen('results');
    if (gameRef.current?.broadcastChannel) {
      try {
        gameRef.current.broadcastChannel.postMessage({
          type: 'match_end',
          id: clientIdRef.current
        });
      } catch {}
    }
    if (roomCode) {
      setDoc(
        doc(db, 'paintball_rooms', roomCode),
        { matchStatus: 'results', endedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }
  };

  // Trivia Answer Handler (Players earn `ballsPerQuestion` Paintballs + 10 Score Points!)
  const handleTriviaAnswer = (optIdx: number) => {
    const qList = activeQuiz.questions.length > 0 ? activeQuiz.questions : DEFAULT_TRIVIA;
    const currentQ = qList[triviaDeckIndex % qList.length];
    if (!currentQ) return;

    if (optIdx === currentQ.answerIndex) {
      sfx.playCorrect();
      setTriviaStreak(s => s + 1);
      setAmmo(a => a + ballsPerQuestion);
      setScore(s => s + 10);
      setQuestionsAnswered(q => q + 1);
      setTriviaFeedback(
        `CORRECT! +${ballsPerQuestion} Paintballs Loaded & +10 Score Points!`
      );

      const evText = `🎯 ${playerName} answered correctly (+${ballsPerQuestion} Paintballs & +10 PTS)!`;
      pushLiveEvent(evText, '#a3e635');
      setDoc(
        doc(db, 'paintball_rooms', roomCode),
        {
          latestEvent: {
            id: `ans-${Date.now()}`,
            text: evText,
            color: '#a3e635',
            timestamp: Date.now()
          }
        },
        { merge: true }
      ).catch(() => {});

      setTimeout(() => {
        setTriviaFeedback(null);
        setTriviaDeckIndex(i => i + 1);
      }, 650);
    } else {
      sfx.playWrong();
      setTriviaStreak(0);
      setTriviaFeedback('Incorrect! Try the next question to earn paintballs!');
      setTimeout(() => {
        setTriviaFeedback(null);
        setTriviaDeckIndex(i => i + 1);
      }, 850);
    }
  };

  const currentTriviaQ = (
    activeQuiz.questions.length > 0 ? activeQuiz.questions : DEFAULT_TRIVIA
  )[
    triviaDeckIndex %
      (activeQuiz.questions.length > 0 ? activeQuiz.questions.length : DEFAULT_TRIVIA.length)
  ];

  // Compute Team Scores from `roomPlayers`
  const teamTotals = React.useMemo(() => {
    const totals: Record<TeamId, { score: number; kos: number; count: number }> = {
      solo: { score: 0, kos: 0, count: 0 },
      red: { score: 0, kos: 0, count: 0 },
      blue: { score: 0, kos: 0, count: 0 },
      green: { score: 0, kos: 0, count: 0 },
      gold: { score: 0, kos: 0, count: 0 }
    };
    roomPlayers.forEach(p => {
      const t = p.team || 'red';
      if (totals[t]) {
        totals[t].score += p.score || 0;
        totals[t].kos += p.kos || 0;
        totals[t].count += 1;
      }
    });
    return totals;
  }, [roomPlayers]);

  // Mobile Touch Joystick Handlers
  const handleJoystickStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchIdRef.current !== null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    joystickTouchIdRef.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joystickOriginRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    updateJoystickFromTouch(touch.clientX, touch.clientY);
  };

  const handleJoystickMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchIdRef.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === joystickTouchIdRef.current) {
        updateJoystickFromTouch(t.clientX, t.clientY);
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchIdRef.current) {
        joystickTouchIdRef.current = null;
        setJoystickVec({ x: 0, y: 0 });
        if (gameRef.current) {
          gameRef.current.joyX = 0;
          gameRef.current.joyZ = 0;
        }
        break;
      }
    }
  };

  const updateJoystickFromTouch = (clientX: number, clientY: number) => {
    const maxRadius = 42;
    const dx = clientX - joystickOriginRef.current.x;
    const dy = clientY - joystickOriginRef.current.y;
    const dist = Math.min(maxRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const nx = (Math.cos(angle) * dist) / maxRadius;
    const ny = (Math.sin(angle) * dist) / maxRadius;
    setJoystickVec({ x: nx, y: ny });
    if (gameRef.current) {
      gameRef.current.joyX = nx;
      gameRef.current.joyZ = ny;
    }
  };

  // =============================================================
  // RENDER INTERFACE
  // =============================================================
  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-x-hidden overflow-y-auto touch-pan-y font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Layer */}
      <div
        ref={canvasContainerRef}
        onTouchStart={e => {
          if (role !== 'player' || screen !== 'game') return;
          const touch = e.touches[0];
          if (touch && gameRef.current) {
            gameRef.current.mouseScreenX = touch.clientX;
            gameRef.current.mouseScreenY = touch.clientY;
            fireShot();
          }
        }}
        className="fixed inset-0 w-full h-full z-0 cursor-crosshair"
      />

      {/* -------------------------------------------------------------
          TOP ARCADE NAVIGATION HEADER
         ------------------------------------------------------------- */}
      <div className="fixed top-2.5 inset-x-3 z-30 flex items-center justify-between pointer-events-none gap-2">
        <button
          onClick={() => {
            if (role === 'player' && roomCode) {
              deleteDoc(doc(db, `rooms_${roomCode}_players`, clientIdRef.current)).catch(() => {});
            }
            onViewChange('games');
          }}
          className="pointer-events-auto flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-extrabold text-xs sm:text-sm border border-white/20 shadow-xl transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={16} className="text-lime-400" />
          <span>Back</span>
        </button>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
          {role === 'host' && (
            <button
              onClick={() => setScreen('editor')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-indigo-600/95 hover:bg-indigo-500 text-white font-bold text-xs border border-indigo-400/30 shadow-lg transition cursor-pointer"
            >
              <Edit3 size={14} />
              <span className="hidden sm:inline">Edit Questions</span>
              <span>({activeQuiz.questions.length})</span>
            </button>
          )}

          {role === 'host' && (
            <button
              onClick={() => setShowModeModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-sky-600/95 hover:bg-sky-500 text-white font-bold text-xs border border-sky-400/30 shadow-lg transition cursor-pointer"
            >
              <span>🎮 Switch Game</span>
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-9 h-9 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white border border-white/20 flex items-center justify-center transition shadow-lg cursor-pointer"
          >
            {soundEnabled ? (
              <Volume2 size={16} className="text-lime-400" />
            ) : (
              <VolumeX size={16} className="text-rose-400" />
            )}
          </button>

          <FullscreenButton className="bg-slate-900/90 hover:bg-slate-800 text-white border border-white/20 shadow-lg" />
        </div>
      </div>

      {/* -------------------------------------------------------------
          SCREEN 1: QUIZ EDITOR
         ------------------------------------------------------------- */}
      {screen === 'editor' && (
        <div className="relative z-50 w-full min-h-screen">
          <QuizEditor
            quiz={activeQuiz}
            folders={folders}
            onSave={saveQuiz}
            onCancel={() => setScreen('lobby')}
          />
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 2: STUDENT JOIN MODAL (WHEN SCANNING QR OR ENTERING CODE)
         ------------------------------------------------------------- */}
      {screen === 'join' && (
        <div className="relative z-40 min-h-screen w-full bg-slate-950/85 flex items-center justify-center p-4 py-16 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[440px] p-6 sm:p-7 flex flex-col items-center border-2 border-slate-200 relative overflow-hidden text-slate-900 my-auto">
            <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-lime-400 via-pink-500 to-cyan-400" />

            <div className="text-center mb-4 mt-1">
              <div className="inline-flex items-center gap-1.5 bg-lime-100 text-lime-800 font-black text-[11px] px-3 py-0.5 rounded-full mb-1 border border-lime-300">
                <Tent size={13} className="text-emerald-600" /> JOIN TEACHER JAN&apos;S LOBBY
              </div>
              <h1 className="font-black text-3xl sm:text-4xl tracking-tight text-slate-900 leading-none">
                HAMSTER PAINTBALL
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Enter your Student Name &amp; Room Code to join the Park!
              </p>
            </div>

            {/* Skin Selector */}
            <div className="w-full bg-slate-100 rounded-2xl p-3 mb-3.5 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Choose Hamster Rig</span>
                <span className="text-indigo-900 font-extrabold">
                  {HAMSTER_SKINS[selectedSkinIdx].name}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {HAMSTER_SKINS.map((skin, idx) => (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => setSelectedSkinIdx(idx)}
                    className={`h-11 rounded-xl border-2 flex flex-col items-center justify-center transition cursor-pointer ${
                      idx === selectedSkinIdx
                        ? 'border-indigo-700 bg-indigo-50 scale-105 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-full border-2 border-black/30 shadow-xs flex items-center justify-center"
                      style={{ background: skin.badgeBg }}
                    >
                      <span
                        className="w-3 h-1.5 rounded-full"
                        style={{
                          background: '#' + skin.visorColor.toString(16).padStart(6, '0')
                        }}
                      />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Student Name Input */}
            <div className="w-full mb-3">
              <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
                Student Callsign (Your Name)
              </label>
              <input
                type="text"
                maxLength={16}
                value={playerName === 'Teacher Jan' ? '' : playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                className="w-full h-11 px-4 text-center text-base font-extrabold text-slate-800 bg-white border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 transition"
              />
            </div>

            {/* Choose Initial Squad Preference */}
            <div className="w-full mb-3">
              <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
                Select Squad Color
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['red', 'blue'] as TeamId[]).map(tId => (
                  <button
                    key={tId}
                    type="button"
                    onClick={() => setMyTeam(tId)}
                    className={`py-2 px-3 rounded-xl font-black text-xs uppercase border-2 transition cursor-pointer ${
                      myTeam === tId
                        ? tId === 'red'
                          ? 'bg-rose-600 text-white border-rose-800 shadow'
                          : 'bg-sky-600 text-white border-sky-800 shadow'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {TEAM_CONFIG[tId].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Room Code Input */}
            <div className="w-full mb-4">
              <label className="block text-[11px] font-extrabold uppercase text-slate-500 mb-1">
                6-Digit Park Room Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={e =>
                  setRoomCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 6))
                }
                className="w-full h-11 px-3 text-center font-mono text-xl font-black tracking-widest text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-700"
              />
            </div>

            {/* Join Lobby as Student Button */}
            <button
              type="button"
              onClick={() => {
                const cleanName =
                  playerName.trim() && playerName.trim() !== 'Teacher Jan'
                    ? playerName.trim()
                    : `Student${Math.floor(10 + Math.random() * 89)}`;
                setPlayerName(cleanName);
                setRole('player');
                setAmmo(0); // Players start with 0 ammo and earn paintballs by answering questions!
                sfx.playCorrect();
                setScreen('lobby');
              }}
              className="w-full py-3.5 bg-[#160269] hover:bg-[#220699] active:scale-[0.99] text-white font-black text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2 border-b-4 border-[#0c013d] cursor-pointer"
            >
              <Crosshair size={18} />
              <span>Join Lobby as Player</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRole('host');
                setPlayerName('Teacher Jan');
                setScreen('lobby');
              }}
              className="mt-3 text-xs font-bold text-slate-500 hover:text-indigo-700 underline cursor-pointer"
            >
              Return to Teacher Jan Host View
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 3: PRE-GAME LOBBY (HOST TEACHER JAN + JOINED STUDENTS)
         ------------------------------------------------------------- */}
      {screen === 'lobby' && (
        <div className="relative z-30 min-h-screen w-full flex flex-col justify-between p-3 sm:p-5 pt-14 pb-6 overflow-y-auto pointer-events-auto">
          {/* Top Lobby Card: QR Code + Room Code + Teacher Settings */}
          <div className="w-full max-w-5xl mx-auto bg-[#1e1336]/95 p-4 sm:p-6 rounded-3xl shadow-2xl border border-white/20 space-y-4">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Instructions & 6-Digit Room Code */}
              <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left">
                <div className="text-white text-xs sm:text-sm font-semibold tracking-wide flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-lime-400 text-slate-950 font-black text-xs uppercase">
                    LIVE PARK LOBBY
                  </span>
                  <span>
                    Scan QR or go to{' '}
                    <strong className="underline decoration-pink-400 text-lime-300">
                      {liveDisplayHost}
                    </strong>{' '}
                    &amp; enter code:
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                  <div
                    onClick={handleCopyRoomCode}
                    className="text-white font-black text-5xl sm:text-7xl tracking-widest leading-none cursor-pointer hover:text-lime-300 transition select-all drop-shadow-md font-mono"
                    title="Click to Copy Room Code"
                  >
                    {roomCode}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyJoinLink}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
                    >
                      {copiedType === 'link' ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedType === 'link' ? 'Join Link Copied!' : 'Copy Join Link'}</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleCopyRoomCode}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                      >
                        {copiedType === 'code' ? (
                          <Check size={12} className="text-lime-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                        <span>{copiedType === 'code' ? 'Copied!' : 'Copy Code'}</span>
                      </button>

                      {role === 'host' && (
                        <button
                          type="button"
                          onClick={handleGenerateNewRoomCode}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                        >
                          <RotateCw size={12} />
                          <span>New Code</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setScreen('join')}
                        className="px-2.5 py-1 rounded-lg bg-lime-400/20 hover:bg-lime-400/30 border border-lime-400/40 text-lime-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                      >
                        <LogIn size={12} />
                        <span>
                          {role === 'host' ? 'Join by Code (Student Mode)' : 'Edit My Rig / Code'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Scannable QR Code */}
              <div
                onClick={() => setIsQrModalOpen(true)}
                className="bg-white p-2.5 rounded-2xl shadow-xl border-2 border-lime-400 flex flex-col items-center cursor-pointer hover:scale-105 transition shrink-0"
                title="Click to enlarge QR Code"
              >
                <QRCodeSVG
                  value={liveJoinUrl}
                  size={104}
                  level="M"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
                <span className="mt-1 text-[10px] font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                  <QrCode size={11} className="text-indigo-600" /> SCAN TO JOIN
                </span>
              </div>
            </div>

            {/* TEACHER HOST CONFIGURATION BAR (Teams/Solo, Timer, Balls per Question) */}
            {role === 'host' ? (
              <div className="pt-3 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Group into Teams or Solo */}
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/10 flex flex-col justify-between gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      1. Grouping Mode
                    </span>
                    {matchMode === 'teams' && roomPlayers.length > 0 && (
                      <button
                        type="button"
                        onClick={handleShuffleTeams}
                        className="text-[10px] font-bold text-amber-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Shuffle size={11} /> Shuffle Teams
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setMatchMode('teams')}
                      className={`py-1.5 rounded-xl font-black text-xs transition cursor-pointer ${
                        matchMode === 'teams'
                          ? 'bg-indigo-600 text-white border border-indigo-400 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      👥 Teams (Red vs Blue)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchMode('solo')}
                      className={`py-1.5 rounded-xl font-black text-xs transition cursor-pointer ${
                        matchMode === 'solo'
                          ? 'bg-lime-500 text-slate-950 border border-lime-300 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🐹 Solo (Individual)
                    </button>
                  </div>
                </div>

                {/* 2. Match Timer Duration */}
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/10 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-pink-300">
                    2. Match Timer
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: '2m', sec: 120 },
                      { label: '3m', sec: 180 },
                      { label: '5m', sec: 300 },
                      { label: '8m', sec: 480 }
                    ].map(t => (
                      <button
                        key={t.sec}
                        type="button"
                        onClick={() => {
                          setConfiguredDurationSec(t.sec);
                          setMatchSeconds(t.sec);
                        }}
                        className={`py-1.5 rounded-xl font-black text-xs transition cursor-pointer ${
                          configuredDurationSec === t.sec
                            ? 'bg-pink-600 text-white border border-pink-400 shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Paintballs Earned Per Question */}
                <div className="bg-slate-900/80 p-3 rounded-2xl border border-white/10 flex flex-col justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-lime-300">
                    3. Balls Per Question
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 10, 15, 25].map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setBallsPerQuestion(count)}
                        className={`py-1.5 rounded-xl font-black text-xs transition cursor-pointer ${
                          ballsPerQuestion === count
                            ? 'bg-lime-400 text-slate-950 border border-white shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        +{count} 🟢
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-purple-200">
                <div>
                  Joined as <strong className="text-lime-300">{playerName}</strong> •{' '}
                  <span className="uppercase font-bold text-cyan-300">
                    {matchMode === 'teams' ? TEAM_CONFIG[myTeam].label : 'Solo Mode'}
                  </span>
                </div>
                <div>
                  Answer questions in-game to earn{' '}
                  <strong className="text-amber-300">+{ballsPerQuestion} Paintballs</strong> per
                  correct answer!
                </div>
              </div>
            )}

            {/* LOBBY ROSTER: Teacher Jan (Non-Playing Host) + Joined Students */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                <span>
                  Lobby Roster: 1 Host (Non-Playing) • {roomPlayers.length} Joined Player
                  {roomPlayers.length === 1 ? '' : 's'}
                </span>
                {role === 'host' && matchMode === 'teams' && roomPlayers.length > 0 && (
                  <span className="text-[11px] text-amber-300">
                    Tip: Click any student card to switch their team!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {/* Non-Playing Host Card: Teacher Jan */}
                <div className="p-2.5 rounded-2xl bg-amber-500/15 border-2 border-amber-400/50 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-sm">
                      👑
                    </div>
                    <div>
                      <div className="font-black text-xs text-white">Teacher Jan</div>
                      <div className="text-[10px] font-bold text-amber-300">
                        Arena Host (Non-Playing)
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 font-black text-[10px]">
                    HOST
                  </span>
                </div>

                {/* Joined Student Players (Must scan QR or enter code to appear here) */}
                {roomPlayers.length === 0 ? (
                  <div className="sm:col-span-1 md:col-span-2 p-3 rounded-2xl bg-slate-900/60 border border-dashed border-white/20 flex items-center justify-center text-xs text-slate-400 font-semibold">
                    Waiting for students to scan the QR code or enter code {roomCode} to join...
                  </div>
                ) : (
                  roomPlayers.map(p => {
                    const tCfg =
                      matchMode === 'teams' ? TEAM_CONFIG[p.team || 'red'] : TEAM_CONFIG.solo;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (role === 'host' && matchMode === 'teams') {
                            handleCyclePlayerTeam(p);
                          }
                        }}
                        className={`p-2.5 rounded-2xl bg-slate-900/85 border-2 ${tCfg.borderClass} flex items-center justify-between ${
                          role === 'host' && matchMode === 'teams'
                            ? 'cursor-pointer hover:scale-[1.02] transition'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm border border-white/40"
                            style={{
                              background:
                                HAMSTER_SKINS[p.skinIdx % HAMSTER_SKINS.length].badgeBg
                            }}
                          >
                            🐹
                          </div>
                          <div>
                            <div className="font-black text-xs text-white">{p.name}</div>
                            <div className="text-[10px] font-bold text-slate-400">
                              Ready in Park
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${tCfg.bgClass}`}
                        >
                          {tCfg.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Enlarged Classroom QR Modal */}
          {isQrModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-lime-400 flex flex-col items-center text-center relative">
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
                <span className="px-3 py-0.5 rounded-full bg-lime-100 text-lime-800 font-black text-xs uppercase mb-1">
                  SCAN WITH PHONE OR TABLET
                </span>
                <h3 className="font-black text-2xl text-slate-900">
                  ROOM CODE: <span className="font-mono text-indigo-700">{roomCode}</span>
                </h3>
                <div className="my-4 p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
                  <QRCodeSVG
                    value={liveJoinUrl}
                    size={220}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <p className="text-xs font-bold text-slate-500 break-all px-2 mb-4">
                  {liveJoinUrl}
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={handleCopyJoinLink}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl shadow flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={14} />
                    <span>{copiedType === 'link' ? 'Copied Link!' : 'Copy Direct Link'}</span>
                  </button>
                  <button
                    onClick={() => setIsQrModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Lobby Launch Bar */}
          <div className="w-full max-w-3xl mx-auto bg-[#1e1336]/95 py-3.5 px-5 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-white/20 shadow-2xl mt-4">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold text-white">
              <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping shrink-0" />
              <Users size={16} className="text-cyan-300 shrink-0" />
              <span>
                {roomPlayers.length === 0
                  ? '1 Host (Teacher Jan) in Park • Scan QR to Join'
                  : `${roomPlayers.length} Student Player${roomPlayers.length > 1 ? 's' : ''} Joined + Teacher Jan (Host)`}
              </span>
            </div>

            {role === 'host' ? (
              <button
                type="button"
                onClick={handleStartMultiplayerMatch}
                className="w-full sm:w-auto bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 active:scale-95 text-slate-950 font-black text-sm px-6 py-2.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 border-b-4 border-emerald-800 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>START PARK PAINTBALL MATCH!</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-indigo-600/40 border border-indigo-400/40 text-xs font-bold text-indigo-200">
                  Waiting for Teacher Jan to start...
                </span>
                <button
                  type="button"
                  onClick={() => {
                    sfx.playKO();
                    setMatchSeconds(configuredDurationSec);
                    setScreen('game');
                  }}
                  className="px-4 py-2 rounded-xl bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-xs shadow cursor-pointer"
                >
                  Enter Arena Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 4: IN-GAME HUD (TEACHER HOST BROADCAST VIEW VS. STUDENT PLAYER HUD)
          (Bottom-right radar map completely removed as requested!)
         ------------------------------------------------------------- */}
      {screen === 'game' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 pt-14">
          {/* TOP ROW:
              - For Student Player: Prominent HEALTH & DEFENCE (SHIELD) Bars on Top-Left!
              - For Host (Teacher Jan): Live Arena Broadcast Badge + Team/Solo Scoreboard! */}
          <div className="w-full flex flex-wrap items-start justify-between gap-2">
            {role === 'player' ? (
              /* STUDENT TOP-LEFT: HEALTH & DEFENCE BARS + SCORE */
              <div className="pointer-events-auto bg-slate-900/92 rounded-2xl p-3 w-64 sm:w-76 border-l-4 border-l-lime-400 border border-white/15 shadow-2xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-xl border border-white/80 flex items-center justify-center font-bold text-xs"
                      style={{ background: HAMSTER_SKINS[selectedSkinIdx].badgeBg }}
                    >
                      🐹
                    </div>
                    <div>
                      <div className="font-black text-white text-xs sm:text-sm leading-tight">
                        {playerName.toUpperCase()}
                      </div>
                      <div className="text-[10px] font-bold text-cyan-300 uppercase">
                        {matchMode === 'teams' ? TEAM_CONFIG[myTeam].label : 'Solo Competitor'}
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-950 px-2.5 py-1 rounded-xl border border-white/10 text-right">
                    <div className="text-xs font-black text-amber-300">{score} PTS</div>
                    <div className="text-[9px] font-bold text-pink-400">{kos} Splats</div>
                  </div>
                </div>

                {/* HEALTH BAR (TOP-LEFT) */}
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[11px] font-black text-lime-300 mb-0.5">
                    <span className="flex items-center gap-1">
                      <Heart size={12} className="text-rose-400 fill-rose-400" /> HEALTH (HP)
                    </span>
                    <span>
                      {hp} / {maxHp}
                    </span>
                  </div>
                  <div className="w-full h-3.5 bg-slate-950 rounded-full p-0.5 border border-lime-500/40">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* DEFENCE / SHIELD BAR (TOP-LEFT) */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-black text-cyan-300 mb-0.5">
                    <span className="flex items-center gap-1">
                      <Shield size={12} className="text-cyan-400 fill-cyan-400" /> DEFENCE (SHIELD)
                    </span>
                    <span>
                      {shield} / {maxShield}
                    </span>
                  </div>
                  <div className="w-full h-3.5 bg-slate-950 rounded-full p-0.5 border border-cyan-500/40">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(0, (shield / maxShield) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* TEACHER JAN HOST TOP-LEFT: LIVE IN-GAME HAPPENINGS TICKER */
              <div className="pointer-events-auto bg-slate-900/92 rounded-2xl p-3.5 w-72 sm:w-88 border-l-4 border-l-amber-400 border border-white/15 shadow-2xl max-h-56 flex flex-col">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Radio size={16} className="text-rose-400 animate-pulse" />
                    <span className="font-black text-xs uppercase tracking-wider text-amber-300">
                      LIVE ARENA HAPPENINGS
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    Host: Teacher Jan
                  </span>
                </div>
                <div className="space-y-1.5 overflow-y-auto pr-1 text-xs">
                  {liveEvents.map(ev => (
                    <div
                      key={ev.id}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 font-bold leading-snug"
                      style={{ color: ev.color }}
                    >
                      {ev.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CENTER: MATCH CLOCK + TEAM SCOREBOARD BANNER */}
            <div className="pointer-events-auto flex flex-col items-center gap-2 mx-auto">
              <div className="bg-slate-900/92 px-4 py-2 rounded-2xl flex items-center gap-3 border border-white/15 shadow-xl">
                <button
                  onClick={() => setIsQrModalOpen(true)}
                  className="text-xs font-mono font-black text-lime-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <QrCode size={13} /> CODE: {roomCode}
                </button>
                <div className="flex items-center gap-1.5 text-white font-mono font-black text-base">
                  <Clock size={16} className="text-pink-400" />
                  <span>
                    {Math.floor(matchSeconds / 60)}:
                    {(matchSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Team Scoreboard Bar when in Team Mode */}
              {matchMode === 'teams' && (
                <div className="flex items-center gap-2 bg-slate-900/92 px-3.5 py-1.5 rounded-2xl border border-white/15 shadow-lg text-xs font-black">
                  <div className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span>RED: {teamTotals.red.score} PTS</span>
                    <span className="text-[10px] text-slate-400">({teamTotals.red.kos} KOs)</span>
                  </div>
                  <span className="text-slate-500">VS</span>
                  <div className="flex items-center gap-1.5 text-sky-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span>BLUE: {teamTotals.blue.score} PTS</span>
                    <span className="text-[10px] text-slate-400">({teamTotals.blue.kos} KOs)</span>
                  </div>
                </div>
              )}
            </div>

            {/* TOP-RIGHT: CAMERA & SCOREBOARD CONTROLS */}
            <div className="pointer-events-auto flex items-center gap-2">
              {role === 'host' && (
                <button
                  onClick={() => {
                    if (hostCameraMode === 'overview') {
                      setHostCameraMode('follow');
                    } else if (
                      roomPlayers.length > 1 &&
                      hostFollowIndex < roomPlayers.length - 1
                    ) {
                      setHostFollowIndex(i => i + 1);
                    } else {
                      setHostFollowIndex(0);
                      setHostCameraMode('overview');
                    }
                  }}
                  className="h-9 px-3 rounded-xl bg-indigo-600/95 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
                >
                  <Eye size={14} className="text-cyan-300" />
                  <span>
                    {hostCameraMode === 'overview'
                      ? 'Cam: Arena Overview'
                      : `Following: ${roomPlayers[hostFollowIndex % Math.max(1, roomPlayers.length)]?.name || 'Arena'}`}
                  </span>
                </button>
              )}

              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
              >
                <Trophy size={14} />
                <span>Scores</span>
              </button>

              {role === 'host' ? (
                <button
                  onClick={handleEndMatch}
                  className="h-9 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1 transition shadow cursor-pointer"
                >
                  <span>End Match</span>
                </button>
              ) : (
                <button
                  onClick={() => setScreen('lobby')}
                  className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition cursor-pointer"
                  title="Return to Lobby"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* CENTER ALERTS: KO OR HEALTH/DEFENCE PICKUP BANNER */}
          <div className="self-center flex flex-col items-center gap-2">
            {koBannerText && (
              <div className="bg-slate-900/95 border-2 border-pink-500 px-5 py-2 rounded-2xl text-center shadow-2xl animate-bounce">
                <div className="text-sm sm:text-lg font-black text-pink-400 uppercase">
                  {koBannerText}
                </div>
              </div>
            )}
            {pickupBannerText && (
              <div className="bg-slate-900/95 border-2 border-lime-400 px-4 py-1.5 rounded-2xl text-center shadow-xl">
                <div className="text-xs sm:text-sm font-black text-lime-300 uppercase">
                  {pickupBannerText}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ROW:
              - For Student Player: Mobile Touch Joystick (Left) + Ammo & Answer Question Button (Center) + Shoot Button (Right)
              - For Host (Teacher Jan): Live Standings Strip across the bottom */}
          {role === 'player' ? (
            <div className="w-full flex items-end justify-between gap-2 pb-1">
              {/* Mobile Touch Joystick (Left) */}
              <div
                onTouchStart={handleJoystickStart}
                onTouchMove={handleJoystickMove}
                onTouchEnd={handleJoystickEnd}
                onTouchCancel={handleJoystickEnd}
                className="pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900/75 border-2 border-white/25 flex items-center justify-center relative touch-none shadow-xl"
              >
                <div
                  className="w-11 h-11 rounded-full bg-lime-400/90 border-2 border-white shadow-md transition-transform duration-75"
                  style={{
                    transform: `translate(${joystickVec.x * 28}px, ${joystickVec.y * 28}px)`
                  }}
                />
                <span className="absolute -top-5 text-[9px] font-black uppercase text-white/80 tracking-wider">
                  MOVE
                </span>
              </div>

              {/* Center Ammo Hopper & Answer Question for Ammunition Button */}
              <div className="pointer-events-auto bg-slate-900/92 rounded-2xl p-3 flex flex-col sm:flex-row items-center gap-3 border border-white/15 shadow-2xl">
                <div className="text-center sm:text-left">
                  <div className="text-[10px] font-black text-pink-400 uppercase">
                    PAINTBALL AMMO
                  </div>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white">
                    {ammo} <span className="text-xs text-slate-400 font-sans">BALLS</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(true)}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-lg transition flex items-center gap-2 cursor-pointer ${
                    ammo === 0
                      ? 'bg-gradient-to-r from-amber-400 to-lime-400 text-slate-950 animate-pulse border-2 border-white'
                      : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white'
                  }`}
                >
                  <Zap size={16} className={ammo === 0 ? 'text-slate-950' : 'text-amber-300'} />
                  <span>
                    {ammo === 0
                      ? `Answer Question (+${ballsPerQuestion} Balls!)`
                      : `Get +${ballsPerQuestion} Balls (Q)`}
                  </span>
                </button>
              </div>

              {/* Right Fire Button (Thumb-Friendly for Mobile & Tablet) */}
              <button
                type="button"
                onClick={fireShot}
                className="pointer-events-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 active:scale-95 border-4 border-white/80 shadow-2xl flex flex-col items-center justify-center text-white font-black text-xs cursor-pointer"
              >
                <Crosshair size={24} />
                <span className="mt-0.5">SHOOT</span>
              </button>
            </div>
          ) : (
            /* HOST BOTTOM LIVE LEADERBOARD STRIP */
            <div className="pointer-events-auto w-full max-w-4xl mx-auto bg-slate-900/92 p-3 rounded-2xl border border-white/15 shadow-2xl">
              <div className="flex items-center justify-between text-xs font-black text-cyan-300 mb-2">
                <span>🏆 LIVE PLAYER &amp; TEAM STANDINGS ({roomPlayers.length} Players)</span>
                <span className="text-[11px] text-slate-400">
                  Use WASD / Arrows to pan camera or click &quot;Cam&quot; to follow players
                </span>
              </div>
              {roomPlayers.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-2">
                  No students have joined the match yet. Click &quot;CODE: {roomCode}&quot; at the top to display the QR code!
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {roomPlayers.map((rp, i) => {
                    const tCfg =
                      matchMode === 'teams' ? TEAM_CONFIG[rp.team || 'red'] : TEAM_CONFIG.solo;
                    return (
                      <div
                        key={rp.id}
                        onClick={() => {
                          setHostCameraMode('follow');
                          setHostFollowIndex(i);
                        }}
                        className={`shrink-0 px-3 py-2 rounded-xl bg-slate-950 border ${tCfg.borderClass} flex items-center gap-2.5 cursor-pointer hover:bg-slate-800 transition`}
                      >
                        <span className="font-black text-xs text-amber-300">#{i + 1}</span>
                        <div>
                          <div className="font-black text-xs text-white">{rp.name}</div>
                          <div className="text-[10px] font-bold text-lime-300">
                            {rp.score} PTS • {rp.kos} Splats
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 5: FINAL RESULTS & TEAM/SOLO PODIUM MODAL
         ------------------------------------------------------------- */}
      {screen === 'results' && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-lime-400 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-auto text-center">
            <Award size={48} className="text-amber-400 mx-auto" />
            <div>
              <span className="px-3 py-0.5 rounded-full bg-lime-400/20 text-lime-300 font-black text-xs uppercase">
                MATCH COMPLETE
              </span>
              <h2 className="text-3xl font-black text-white mt-1">
                FINAL PAINTBALL STANDINGS
              </h2>
            </div>

            {matchMode === 'teams' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-rose-500/20 border-2 border-rose-500">
                  <div className="text-xs font-black text-rose-300 uppercase">RED SQUAD</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {teamTotals.red.score} PTS
                  </div>
                  <div className="text-[11px] font-bold text-rose-200">
                    {teamTotals.red.kos} Total Splats
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-sky-500/20 border-2 border-sky-400">
                  <div className="text-xs font-black text-sky-300 uppercase">BLUE SQUAD</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {teamTotals.blue.score} PTS
                  </div>
                  <div className="text-[11px] font-bold text-sky-200">
                    {teamTotals.blue.kos} Total Splats
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto text-left">
              {roomPlayers.map((rp, i) => (
                <div
                  key={rp.id}
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-xl border border-white/10 text-xs font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-white">{rp.name}</span>
                    {matchMode === 'teams' && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                          TEAM_CONFIG[rp.team || 'red'].bgClass
                        }`}
                      >
                        {TEAM_CONFIG[rp.team || 'red'].label}
                      </span>
                    )}
                  </div>
                  <span className="text-lime-300">
                    {rp.score} PTS • {rp.kos} Splats
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setScreen('lobby');
                if (role === 'host' && roomCode) {
                  setDoc(
                    doc(db, 'paintball_rooms', roomCode),
                    { matchStatus: 'lobby' },
                    { merge: true }
                  ).catch(() => {});
                }
              }}
              className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm rounded-xl shadow-lg cursor-pointer"
            >
              Return to Park Lobby
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          QUESTION DECK MODAL (PLAYERS ANSWER TO GET PAINTBALL AMMO!)
         ------------------------------------------------------------- */}
      {isQuestionModalOpen && currentTriviaQ && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border-4 border-indigo-600 text-slate-900 my-auto">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-base sm:text-lg leading-none">
                  ANSWER TO EARN PAINTBALL AMMO!
                </h3>
                <p className="text-xs text-indigo-100 mt-1">
                  Correct Answer ={' '}
                  <strong className="text-lime-300">+{ballsPerQuestion} Paintballs</strong> &amp;{' '}
                  <strong className="text-amber-300">+10 Score PTS</strong> (Streak: {triviaStreak}
                  x)
                </p>
              </div>
              <button
                onClick={() => setIsQuestionModalOpen(false)}
                className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-block bg-indigo-100 text-indigo-800 font-extrabold text-[11px] uppercase px-2.5 py-0.5 rounded-full">
                  AMMO RELOAD QUESTION
                </span>
                <span className="text-xs font-black text-emerald-700">
                  Current Ammo: {ammo} Balls
                </span>
              </div>
              <h2 className="font-extrabold text-lg sm:text-2xl text-slate-800 mb-4">
                {currentTriviaQ.text}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentTriviaQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTriviaAnswer(idx)}
                    className="p-3.5 rounded-xl border-b-4 font-extrabold text-sm text-left transition shadow bg-slate-100 hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 text-slate-800 cursor-pointer active:scale-95"
                  >
                    <span className="font-bold text-indigo-600 mr-2">
                      {OPTION_LETTERS[idx]}.
                    </span>
                    {parseOptionContent(opt).text || opt}
                  </button>
                ))}
              </div>

              {triviaFeedback && (
                <div className="mt-4 p-3 bg-emerald-600 text-white font-black text-center text-xs sm:text-sm rounded-xl">
                  {triviaFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          LIVE SCOREBOARD MODAL (TEAM & INDIVIDUAL)
         ------------------------------------------------------------- */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-400" size={20} />
                <h3 className="font-black text-base text-white">
                  {matchMode === 'teams' ? 'TEAM & PLAYER SCOREBOARD' : 'SOLO SCOREBOARD'}
                </h3>
              </div>
              <button
                onClick={() => setIsLeaderboardOpen(false)}
                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            {matchMode === 'teams' && (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/50 text-center">
                  <div className="text-[10px] font-black text-rose-300 uppercase">RED SQUAD</div>
                  <div className="text-xl font-black text-white">{teamTotals.red.score} PTS</div>
                  <div className="text-[10px] text-rose-200">{teamTotals.red.kos} Splats</div>
                </div>
                <div className="p-3 rounded-2xl bg-sky-500/20 border border-sky-400/50 text-center">
                  <div className="text-[10px] font-black text-sky-300 uppercase">BLUE SQUAD</div>
                  <div className="text-xl font-black text-white">{teamTotals.blue.score} PTS</div>
                  <div className="text-[10px] text-sky-200">{teamTotals.blue.kos} Splats</div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {roomPlayers.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">
                  No students have joined yet. Scan the QR code or enter code {roomCode}!
                </div>
              ) : (
                roomPlayers.map((rp, idx) => (
                  <div
                    key={rp.id}
                    className="flex items-center justify-between p-2.5 bg-slate-800/90 border border-white/10 rounded-xl text-xs font-bold text-white"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-300">{idx + 1}.</span>
                      <span>{rp.name}</span>
                      {matchMode === 'teams' && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                            TEAM_CONFIG[rp.team || 'red'].bgClass
                          }`}
                        >
                          {TEAM_CONFIG[rp.team || 'red'].label}
                        </span>
                      )}
                    </div>
                    <span className="text-lime-300">
                      {rp.score} PTS · {rp.kos} Splats
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Switch Game Mode Modal */}
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
            onViewChange(
              mode as ViewState,
              adaptedData || {
                ...initialGame,
                name: activeQuiz.title,
                topic: activeQuiz.topic,
                className: activeQuiz.classLevel,
                customQuestions: activeQuiz.questions
              }
            );
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// QUIZ EDITOR COMPONENT (Allows Teacher to Author Questions)
// =============================================================
function QuizEditor({
  quiz,
  folders,
  onSave,
  onCancel
}: {
  quiz: Quiz;
  folders: { id: string; name: string }[];
  onSave: (q: Quiz) => void;
  onCancel: () => void;
}) {
  const [topic, setTopic] = useState(quiz.topic || '');
  const [classLevel, setClassLevel] = useState(quiz.classLevel || '');
  const [folderId, setFolderId] = useState(quiz.folderId || '');
  const [contentMode, setContentMode] = useState<OptionContentMode>('both');
  const [questions, setQuestions] = useState<Question[]>(
    quiz.questions && quiz.questions.length > 0
      ? quiz.questions
      : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
  );

  const [activeGiphyInput, setActiveGiphyInput] = useState<{
    qId: number | string;
    optIndex: number | 'question';
    initialQuery?: string;
  } | null>(null);

  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const handleContentModeChange = (nextMode: OptionContentMode) => {
    setContentMode(nextMode);
    convertQuestionsContentMode(questions, nextMode, updated => {
      setQuestions(updated);
      setToastMsg(`✨ Converted options to ${nextMode}!`);
      setTimeout(() => setToastMsg(''), 2500);
    });
  };

  const handleAddQuestion = () => {
    setQuestions(prev => [
      ...prev,
      { id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }
    ]);
  };

  const handleDeleteQuestion = (id: number | string) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleSave = () => {
    const validQuestions = questions.filter(
      q => q.text.trim() || q.options.some(o => o.trim())
    );
    onSave({
      ...quiz,
      topic,
      classLevel,
      folderId,
      questions: validQuestions.length > 0 ? validQuestions : questions
    });
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-50 p-4 sm:p-8 overflow-y-auto custom-scrollbar text-slate-900">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="p-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold transition shadow-sm cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Paintball Question Editor
              </h1>
              <p className="text-xs font-semibold text-slate-500">
                Edit questions used for earning paintball ammunition during matches
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkPasteModal(true)}
              className="px-4 py-2.5 rounded-xl bg-white border-2 border-indigo-200 text-indigo-700 font-black text-sm hover:bg-indigo-50 transition shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Sparkles size={16} />
              <span>Bulk Paste AI Questions</span>
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm transition shadow-md border-b-4 border-emerald-700 active:translate-y-0.5 flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} />
              <span>Save &amp; Play</span>
            </button>
          </div>
        </div>

        {toastMsg && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-bold text-center text-sm">
            {toastMsg}
          </div>
        )}

        <SetupCurriculumHeader
          topic={topic}
          setTopic={setTopic}
          classLevel={classLevel}
          setClassLevel={setClassLevel}
          folderId={folderId}
          setFolderId={setFolderId}
          folders={folders}
          contentMode={contentMode}
          setContentMode={handleContentModeChange}
        />

        <div className="space-y-4">
          {questions.map((q, qIndex) => (
            <div
              key={q.id}
              className="p-5 rounded-2xl bg-white border-2 border-slate-200 border-b-4 border-b-slate-300 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-lg bg-sky-100 text-sky-800 text-xs font-black uppercase">
                  Question {qIndex + 1}
                </span>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  disabled={questions.length <= 1}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-30 transition cursor-pointer"
                  title="Delete Question"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <SmartQuestionInput
                value={q.text}
                imageUrl={q.image}
                onChange={val => {
                  setQuestions(prev => {
                    const copy = [...prev];
                    copy[qIndex] = { ...copy[qIndex], text: val };
                    return copy;
                  });
                }}
                onChangeImage={img => {
                  setQuestions(prev => {
                    const copy = [...prev];
                    copy[qIndex] = { ...copy[qIndex], image: img || undefined };
                    return copy;
                  });
                }}
                onOpenMediaPicker={() => {
                  setActiveGiphyInput({
                    qId: q.id,
                    optIndex: 'question',
                    initialQuery: q.text
                  });
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {q.options.map((opt, oIdx) => {
                  const isCorrect = q.answerIndex === oIdx;
                  return (
                    <div
                      key={oIdx}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        isCorrect
                          ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setQuestions(prev => {
                            const copy = [...prev];
                            copy[qIndex] = { ...copy[qIndex], answerIndex: oIdx };
                            return copy;
                          });
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0 cursor-pointer ${
                          isCorrect
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                        title="Mark as Correct Answer"
                      >
                        {OPTION_LETTERS[oIdx]}
                      </button>

                      <div className="flex-1">
                        <SmartOptionInput
                          value={opt}
                          onChange={val => {
                            setQuestions(prev => {
                              const copy = [...prev];
                              const newOpts = [...copy[qIndex].options];
                              newOpts[oIdx] = val;
                              copy[qIndex] = { ...copy[qIndex], options: newOpts };
                              return copy;
                            });
                          }}
                          onOpenMediaPicker={() => {
                            setActiveGiphyInput({
                              qId: q.id,
                              optIndex: oIdx,
                              initialQuery: opt
                            });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddQuestion}
          className="w-full py-4 rounded-2xl bg-white hover:bg-sky-50 border-2 border-dashed border-sky-300 text-sky-700 font-black text-base flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
        >
          <Plus size={20} />
          <span>Add New Question</span>
        </button>

        {activeGiphyInput && (
          <MediaPickerModal
            isOpen={true}
            onClose={() => setActiveGiphyInput(null)}
            initialQuery={activeGiphyInput.initialQuery || ''}
            onSelect={url => {
              const { qId, optIndex } = activeGiphyInput;
              setQuestions(prev => {
                const copy = [...prev];
                const qIdx = copy.findIndex(item => item.id === qId);
                if (qIdx !== -1) {
                  if (optIndex === 'question') {
                    copy[qIdx] = { ...copy[qIdx], image: url };
                  } else {
                    const newOpts = [...copy[qIdx].options];
                    const cur = parseOptionContent(newOpts[optIndex]);
                    newOpts[optIndex] = formatOptionContent(cur.text, url);
                    copy[qIdx] = { ...copy[qIdx], options: newOpts };
                  }
                }
                return copy;
              });
              setActiveGiphyInput(null);
            }}
          />
        )}

        {showBulkPasteModal && (
          <BulkPasteVideoModal
            isOpen={showBulkPasteModal}
            onClose={() => setShowBulkPasteModal(false)}
            onOpenBulkPasteWithSample={sampleText => {
              const lines = sampleText
                .split(/\r?\n/)
                .filter(l => l.trim().length > 0);
              const imported: Question[] = [];
              let curQ: Partial<Question> | null = null;
              lines.forEach(line => {
                const trimmed = line.trim();
                const qMatch = trimmed.match(/^\d+[\.\)]\s*(.*)/);
                const optMatch = trimmed.match(/^([A-Da-d])[\.\)]\s*(.*)/);
                const ansMatch = trimmed.match(/^Answer:\s*([A-Da-d])/i);
                if (qMatch) {
                  if (curQ && curQ.text) {
                    imported.push({
                      id: Date.now() + Math.random(),
                      text: curQ.text,
                      options:
                        curQ.options && curQ.options.length >= 2
                          ? curQ.options
                          : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                      answerIndex: curQ.answerIndex || 0
                    });
                  }
                  curQ = { text: qMatch[1], options: [], answerIndex: 0 };
                } else if (optMatch && curQ) {
                  if (!curQ.options) curQ.options = [];
                  curQ.options.push(optMatch[2]);
                } else if (ansMatch && curQ) {
                  curQ.answerIndex =
                    ansMatch[1].toUpperCase().charCodeAt(0) - 65;
                }
              });
              if (curQ && curQ.text) {
                imported.push({
                  id: Date.now() + Math.random(),
                  text: curQ.text,
                  options:
                    curQ.options && curQ.options.length >= 2
                      ? curQ.options
                      : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                  answerIndex: curQ.answerIndex || 0
                });
              }
              if (imported.length > 0) {
                setQuestions(imported);
                setToastMsg(`🎉 Imported ${imported.length} questions from AI paste!`);
                setTimeout(() => setToastMsg(''), 3000);
              }
              setShowBulkPasteModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
}

export { HamsterPaintball };
