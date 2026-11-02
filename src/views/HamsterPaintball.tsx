import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { GameModeModal } from '../components/GameModeModal';
import { 
  ArrowLeft, Edit3, Trash2, Plus, Sparkles, Save, X, Play, 
  Copy, Volume2, VolumeX, RotateCw, Check, 
  Crosshair, Shield, Zap, Trophy, Heart, Bomb, Tent, Store, 
  QrCode, Video, Compass, HelpCircle, Clock, Disc
} from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc, onSnapshot, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from '../components/SetupSmartControls';
import { OptionContentMode, parseOptionContent, formatOptionContent } from '../utils/mediaAndPresets';

// =============================================================
// TYPES & DATA STRUCTURES
// =============================================================
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

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const HAMSTER_SKINS = [
  { id: 'choco', name: 'Choco Commando (Teacher Jan)', furColor: 0x5c4033, bellyColor: 0xd8c3a5, earInner: 0xf4a298, visorColor: 0x22d3ee, vestColor: 0x1e293b, paintColor: 0xa3e635, badgeBg: '#5c4033' },
  { id: 'golden', name: 'Golden Speedballer', furColor: 0xe68a00, bellyColor: 0xfff3d1, earInner: 0xffb3ba, visorColor: 0xff2a85, vestColor: 0x0f172a, paintColor: 0xff2a85, badgeBg: '#e68a00' },
  { id: 'snowy', name: 'Arctic Ghost', furColor: 0xeef2f6, bellyColor: 0xffffff, earInner: 0xffccd5, visorColor: 0xa3e635, vestColor: 0x334155, paintColor: 0x22d3ee, badgeBg: '#cbd5e1' },
  { id: 'berry', name: 'Neon Viper Berry', furColor: 0x9d4edd, bellyColor: 0xf3d9fa, earInner: 0xff99c8, visorColor: 0xfbbf24, vestColor: 0x1e1b4b, paintColor: 0xfbbf24, badgeBg: '#9d4edd' },
  { id: 'mint', name: 'Emerald Ranger', furColor: 0x10b981, bellyColor: 0xd1fae5, earInner: 0xfda4af, visorColor: 0xff6b00, vestColor: 0x064e3b, paintColor: 0xff6b00, badgeBg: '#10b981' }
];

const PAINT_PALETTE = [
  0xa3e635, // Electric Lime
  0xff2a85, // Hot Magenta Pink
  0x22d3ee, // Neon Cyan
  0xff6b00, // Vivid Orange
  0xfbbf24, // Solar Yellow
  0xc084fc  // Ultraviolet Purple
];

const DEFAULT_TRIVIA: Question[] = [
  {
    id: 1,
    text: "What gives real paintballs their glossy shell that bursts on impact?",
    options: ["Non-toxic water-soluble gelatin capsule", "Hard solid plastic spheres", "Frozen colored ice cubes", "Rubber bouncy balls"],
    answerIndex: 0
  },
  {
    id: 2,
    text: "What are the colorful inflatable obstacles in a tournament Speedball park made of?",
    options: ["Heavy-duty glossy PVC vinyl fabric", "Paper mache & cardboard", "Solid painted concrete", "Cotton bedsheets"],
    answerIndex: 0
  },
  {
    id: 3,
    text: "Why do hamsters have such stretchy cheek pouches?",
    options: ["To carry seeds & extra paint pods!", "To float across duck ponds", "To whistle ultrasonic tunes", "To glow in the dark"],
    answerIndex: 0
  },
  {
    id: 4,
    text: "An electronic Hopper holds 16 paintballs. If you fire a 3-shot burst twice, how many remain?",
    options: ["10 Paintballs", "13 Paintballs", "8 Paintballs", "12 Paintballs"],
    answerIndex: 0
  },
  {
    id: 5,
    text: "What happens when your hamster skitters across the Shallow Park Pond on the east side?",
    options: ["Low-friction hydroplane speed boost!", "Your paintballs turn into frogs", "Gravity turns upside down", "The match ends immediately"],
    answerIndex: 0
  },
  {
    id: 6,
    text: "What is the most important piece of safety equipment worn on every hamster's face?",
    options: ["Thermal Anti-Fog Paintball Goggles", "A chef hat", "Sunglasses without lenses", "Wool mittens"],
    answerIndex: 0
  }
];

const BOT_PROFILES = [
  { name: 'AN', skinIdx: 2, skill: 0.88 },
  { name: 'SqueakShot', skinIdx: 1, skill: 0.82 },
  { name: 'BobaTrigger', skinIdx: 3, skill: 0.85 },
  { name: 'ViperPaws', skinIdx: 4, skill: 0.92 }
];

// Web Audio Sound FX Synthesizer
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playMarkerShot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.095);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playSplat() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.13);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playKO() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const now = this.ctx!.currentTime + idx * 0.055;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now);
      osc.stop(now + 0.22);
    });
  }

  public playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    [587.33, 880].forEach((freq, i) => {
      const now = this.ctx!.currentTime + i * 0.075;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    });
  }

  public playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(98, now + 0.25);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }
}

const sfx = new SoundFX();

// =============================================================
// HAMSTER PAINTBALL 3D MULTIPLAYER VIEW COMPONENT
// =============================================================
export default function HamsterPaintball({
  onViewChange,
  initialGame
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  // Active Quiz State
  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame && Array.isArray(initialGame.customQuestions) && initialGame.customQuestions.length > 0) {
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || 'Hamster Paintball Arena',
        topic: initialGame.topic || 'English Speedball',
        classLevel: initialGame.className || initialGame.classLevel || 'General',
        folderId: initialGame.folderId || '',
        questions: initialGame.customQuestions
      };
    }
    return {
      id: Date.now(),
      title: 'Hamster Paintball - 3D Tactical Park Arena',
      topic: 'Paintball & English Trivia',
      classLevel: 'All Grades',
      folderId: '',
      questions: DEFAULT_TRIVIA
    };
  });

  // Screen State: 'editor' | 'join' | 'lobby' | 'game'
  const [screen, setScreen] = useState<'editor' | 'join' | 'lobby' | 'game'>(() => {
    if (initialGame?.editMode) return 'editor';
    return 'join';
  });

  // Game Room & Player Identity
  const [roomCode, setRoomCode] = useState<string>('370741');
  const [playerName, setPlayerName] = useState<string>('Teacher Jan');
  const [selectedSkinIdx, setSelectedSkinIdx] = useState<number>(0);
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'overhead' | 'shoulder'>('overhead');
  const [matchSeconds, setMatchSeconds] = useState<number>(29 * 60 + 44);

  // In-Game Tactical HUD State
  const [hp, setHp] = useState<number>(100);
  const [maxHp] = useState<number>(100);
  const [shield, setShield] = useState<number>(100);
  const [maxShield, setMaxShield] = useState<number>(100);
  const [ammo, setAmmo] = useState<number>(16);
  const [maxAmmo, setMaxAmmo] = useState<number>(16);
  const [reserveAmmo, setReserveAmmo] = useState<number>(24);
  const [bombs, setBombs] = useState<number>(5);
  const [airBunkers, setAirBunkers] = useState<number>(2);
  const [seeds, setSeeds] = useState<number>(120);
  const [kos, setKos] = useState<number>(0);
  const [activeSlot, setActiveSlot] = useState<number>(0);
  const [inPond, setInPond] = useState<boolean>(false);
  const [koVictimName, setKoVictimName] = useState<string | null>(null);

  // Modals
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [showModeModal, setShowModeModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Trivia & Streaks
  const [triviaDeckIndex, setTriviaDeckIndex] = useState<number>(0);
  const [triviaStreak, setTriviaStreak] = useState<number>(0);
  const [triviaFeedback, setTriviaFeedback] = useState<string | null>(null);

  // Upgrades
  const [upgrades, setUpgrades] = useState([
    { id: 'maxAmmo', name: 'High-Cap Rotor Hopper', desc: '+8 Hopper Paintball capacity & instant reload', cost: 60, level: 0, maxLevel: 4 },
    { id: 'damage', name: 'Carbon Fiber Rifled Barrel', desc: '+25% Paintball Velocity & Splat Damage', cost: 75, level: 0, maxLevel: 4 },
    { id: 'speed', name: 'Turf-Cleat Hamster Paws', desc: '+15% Park Sprint & Pond Hydroplane Speed', cost: 65, level: 0, maxLevel: 3 },
    { id: 'shield', name: 'Thermal Pro Goggle Visor', desc: 'Restore Full Shield + Increase Max Shield by +25', cost: 50, level: 0, maxLevel: 5 }
  ]);

  // Killfeed
  const [killfeed, setKillfeed] = useState<{ id: string; killer: string; victim: string; color: number }[]>([]);

  // Multi-Tab & Firebase Sync
  const localTabIdRef = useRef<string>('tab_' + Math.random().toString(36).slice(2, 9));
  const parkChannelRef = useRef<BroadcastChannel | null>(null);
  const remotePlayersRef = useRef<Map<string, any>>(new Map());
  const [lobbyPlayerCount, setLobbyPlayerCount] = useState<number>(5);

  // Three.js Refs & Engine State
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    localHamster: THREE.Group;
    obstacles: { x: number; z: number; r: number; h?: number }[];
    splatTargets: THREE.Mesh[];
    projectiles: any[];
    particles: any[];
    splatDecals: THREE.Mesh[];
    powerupCrates: any[];
    bots: any[];
    remoteMeshes: Map<string, THREE.Group>;
    keys: Record<string, boolean>;
    x: number;
    z: number;
    vx: number;
    vz: number;
    rotY: number;
    aimWorldX: number;
    aimWorldZ: number;
    mouseScreenX: number;
    mouseScreenY: number;
    mouseDown: boolean;
    lastShotTime: number;
    damageMult: number;
    speedMult: number;
    hamsterBallActive: boolean;
    hamsterBallTimer: number;
    fountainWaterMesh?: THREE.Mesh;
  } | null>(null);

  const animFrameRef = useRef<number | null>(null);

  // Sync SFX state
  useEffect(() => {
    sfx.enabled = soundEnabled;
  }, [soundEnabled]);

  // Load Folders from Firebase
  useEffect(() => {
    if (!user) return;
    const fetchFolders = async () => {
      try {
        const q = query(collection(db, 'folders'), where('userId', '==', user.uid));
        const snap = await getDocs(q);
        setFolders(snap.docs.map(d => ({ id: d.id, name: d.data().name })));
      } catch (e) {
        console.warn('Folders fetch notice:', e);
      }
    };
    fetchFolders();
  }, [user]);

  // Save Quiz Handler
  const saveQuiz = async (updatedQuiz: Quiz) => {
    setActiveQuiz(updatedQuiz);
    setScreen('lobby');
    if (user && db) {
      try {
        if (typeof updatedQuiz.id === 'string' && !updatedQuiz.id.startsWith('temp_')) {
          await updateDoc(doc(db, 'quizzes', updatedQuiz.id), {
            title: updatedQuiz.title || 'Hamster Paintball',
            topic: updatedQuiz.topic,
            classLevel: updatedQuiz.classLevel,
            folderId: updatedQuiz.folderId || '',
            questions: updatedQuiz.questions,
            gameType: 'hamster-paintball',
            updatedAt: new Date()
          });
        } else {
          await addDoc(collection(db, 'quizzes'), {
            userId: user.uid,
            title: updatedQuiz.title || 'Hamster Paintball',
            topic: updatedQuiz.topic,
            classLevel: updatedQuiz.classLevel,
            folderId: updatedQuiz.folderId || '',
            questions: updatedQuiz.questions,
            gameType: 'hamster-paintball',
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (err) {
        console.warn('Quiz save notice:', err);
      }
    }
  };

  // BroadcastChannel Setup for Multi-Tab Instant Sync
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('hamster_paintball_park_sync');
    parkChannelRef.current = ch;

    ch.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.roomCode !== roomCode || msg.uid === localTabIdRef.current) return;
      if (msg.type === 'playerState') {
        remotePlayersRef.current.set(msg.uid, msg);
        setLobbyPlayerCount(1 + (gameRef.current?.bots.length || 4) + remotePlayersRef.current.size);
      }
    };

    return () => {
      ch.close();
    };
  }, [roomCode]);

  // Firestore Multiplayer Listener
  useEffect(() => {
    if (!db) return;
    try {
      const col = collection(db, 'artifacts', 'hamster-paintball-3d', 'public', 'data', `rooms_${roomCode}_players`);
      const unsub = onSnapshot(col, (snap) => {
        const now = Date.now();
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && docSnap.id !== (user ? user.uid : localTabIdRef.current)) {
            if (now - (data.updatedAt || 0) < 35000) {
              remotePlayersRef.current.set(docSnap.id, data);
            } else {
              remotePlayersRef.current.delete(docSnap.id);
            }
          }
        });
        setLobbyPlayerCount(1 + (gameRef.current?.bots.length || 4) + remotePlayersRef.current.size);
      }, (e) => console.warn('Room sync notice:', e));

      return () => unsub();
    } catch (e) {
      console.warn('Firestore room sync notice:', e);
    }
  }, [roomCode, user]);

  // Match Timer interval
  useEffect(() => {
    if (screen !== 'game') return;
    const t = setInterval(() => {
      setMatchSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  // =============================================================
  // PROCEDURAL 3D PARK GENERATION & THREE.JS ENGINE
  // =============================================================
  useEffect(() => {
    if (!canvasContainerRef.current) return;
    const container = canvasContainerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x9be2f8, 0.0055);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 260);
    camera.position.set(0, 32, 24);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Realistic Outdoor Lighting
    const hemiLight = new THREE.HemisphereLight(0xdff6ff, 0x3b6e28, 0.7);
    scene.add(hemiLight);

    const sun = new THREE.DirectionalLight(0xfff6e0, 1.15);
    sun.position.set(28, 52, 32);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 140;
    const d = 52;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    const obstacles: { x: number; z: number; r: number; h?: number }[] = [];
    const splatTargets: THREE.Mesh[] = [];

    // Mowed Turf Ground with Striped Texture
    const lawnCanvas = document.createElement('canvas');
    lawnCanvas.width = 512;
    lawnCanvas.height = 512;
    const lctx = lawnCanvas.getContext('2d');
    if (lctx) {
      lctx.fillStyle = '#3f8f29';
      lctx.fillRect(0, 0, 512, 512);
      lctx.fillStyle = '#479c2f';
      for (let x = 0; x < 512; x += 64) lctx.fillRect(x, 0, 32, 512);
      for (let i = 0; i < 3000; i++) {
        lctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
        lctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
      }
    }
    const lawnTex = new THREE.CanvasTexture(lawnCanvas);
    lawnTex.wrapS = THREE.RepeatWrapping;
    lawnTex.wrapT = THREE.RepeatWrapping;
    lawnTex.repeat.set(14, 14);

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 96),
      new THREE.MeshStandardMaterial({ map: lawnTex, roughness: 0.85, metalness: 0.02 })
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);
    splatTargets.push(groundMesh);

    // Stone / Gravel Central Walkway
    const mainPath = new THREE.Mesh(
      new THREE.PlaneGeometry(88, 5.2),
      new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.9 })
    );
    mainPath.rotation.x = -Math.PI / 2;
    mainPath.position.set(0, 0.015, 0);
    mainPath.receiveShadow = true;
    scene.add(mainPath);

    // Helper: PVC Bunker Material
    const createPVCMat = (colorHex: number, stripeHex: number = 0xffffff) => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = '#' + stripeHex.toString(16).padStart(6, '0');
        ctx.fillRect(0, 95, 256, 42);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 90, 256, 6);
        ctx.fillRect(0, 137, 256, 6);
      }
      const tex = new THREE.CanvasTexture(c);
      return new THREE.MeshPhysicalMaterial({
        map: tex,
        roughness: 0.16,
        metalness: 0.04,
        clearcoat: 0.92,
        clearcoatRoughness: 0.12
      });
    };

    // Helper: Dorito Bunker
    const createDorito = (x: number, z: number, c1: number, c2: number) => {
      const mat = createPVCMat(c1, c2);
      const grp = new THREE.Group();
      const prism = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.5, 3.6, 3), mat);
      prism.position.y = 1.8;
      prism.castShadow = true;
      prism.receiveShadow = true;
      grp.add(prism);
      splatTargets.push(prism);

      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 12), mat);
      cap.scale.set(1, 0.45, 1);
      cap.position.y = 3.5;
      grp.add(cap);

      grp.position.set(x, 0, z);
      scene.add(grp);
      obstacles.push({ x, z, r: 2.35, h: 3.8 });
    };

    // Helper: Cylinder Can Bunker
    const createCan = (x: number, z: number, c1: number, c2: number) => {
      const mat = createPVCMat(c1, c2);
      const grp = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.9, 3.8, 24), mat);
      cyl.position.y = 1.9;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      grp.add(cyl);
      splatTargets.push(cyl);

      grp.position.set(x, 0, z);
      scene.add(grp);
      obstacles.push({ x, z, r: 2.05, h: 4.0 });
    };

    // Helper: Brick Barricade
    const createBrick = (x: number, z: number, c1: number, c2: number, rotY: number = 0) => {
      const mat = createPVCMat(c1, c2);
      const grp = new THREE.Group();
      for (let r = 0; r < 3; r++) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 4.8, 16), mat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.62 + r * 0.98;
        tube.castShadow = true;
        tube.receiveShadow = true;
        grp.add(tube);
        splatTargets.push(tube);
      }
      grp.position.set(x, 0, z);
      grp.rotation.y = rotY;
      scene.add(grp);
      obstacles.push({ x, z, r: 2.4, h: 2.9 });
    };

    // Bunkers setup
    createDorito(-14, -7, 0x1d4ed8, 0xfbbf24);
    createDorito(-14, 9, 0x1d4ed8, 0xfbbf24);
    createDorito(11, -9, 0xe11d48, 0xa3e635);
    createDorito(11, 10, 0xe11d48, 0xa3e635);
    createCan(-24, 0, 0xfbbf24, 0x1e293b);
    createCan(-7, -15, 0x0284c7, 0xffffff);
    createCan(7, 16, 0xff2a85, 0xffffff);
    createBrick(-19, -15, 0x10b981, 0xffffff, 0.25);
    createBrick(-19, 16, 0x10b981, 0xffffff, -0.25);
    createBrick(0, -19, 0x8b5cf6, 0xfbbf24, 0);
    createBrick(0, 19, 0x8b5cf6, 0xfbbf24, 0);

    // Central Wooden Gazebo
    const gazeboBase = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.6, 0.35, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.75 })
    );
    gazeboBase.position.y = 0.175;
    gazeboBase.receiveShadow = true;
    scene.add(gazeboBase);
    splatTargets.push(gazeboBase);

    [-4.2, 4.2].forEach(px => {
      [-4.2, 4.2].forEach(pz => {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.36, 4.8, 12),
          new THREE.MeshStandardMaterial({ color: 0x8d5b34, roughness: 0.7 })
        );
        pillar.position.set(px, 2.4, pz);
        pillar.castShadow = true;
        scene.add(pillar);
        obstacles.push({ x: px, z: pz, r: 0.65, h: 4.8 });
      });
    });

    const gazeboRoof = new THREE.Mesh(
      new THREE.ConeGeometry(6.8, 2.6, 8),
      new THREE.MeshPhysicalMaterial({ color: 0x1e3a8a, roughness: 0.35, clearcoat: 0.5 })
    );
    gazeboRoof.position.y = 6.1;
    gazeboRoof.castShadow = true;
    scene.add(gazeboRoof);

    // East-Side Reflective Duck Pond
    const pondRim = new THREE.Mesh(
      new THREE.CylinderGeometry(12.2, 12.6, 0.16, 32),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 })
    );
    pondRim.scale.set(1.0, 1, 1.65);
    pondRim.position.set(26, 0.04, 0);
    pondRim.receiveShadow = true;
    scene.add(pondRim);

    const pondWater = new THREE.Mesh(
      new THREE.CylinderGeometry(11.4, 11.4, 0.18, 32),
      new THREE.MeshPhysicalMaterial({
        color: 0x06b6d4,
        emissive: 0x083344,
        emissiveIntensity: 0.15,
        roughness: 0.05,
        metalness: 0.1,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.88
      })
    );
    pondWater.scale.set(1.0, 1, 1.65);
    pondWater.position.set(26, 0.06, 0);
    pondWater.receiveShadow = true;
    scene.add(pondWater);
    splatTargets.push(pondWater);

    const fountainBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.8, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.8 })
    );
    fountainBase.position.set(26, 0.6, 0);
    scene.add(fountainBase);
    obstacles.push({ x: 26, z: 0, r: 1.8, h: 2.0 });

    const fountainWaterMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 2.8, 12),
      new THREE.MeshPhysicalMaterial({ color: 0xa5f3fc, transparent: true, opacity: 0.65, clearcoat: 1.0 })
    );
    fountainWaterMesh.position.set(26, 2.2, 0);
    scene.add(fountainWaterMesh);

    // Powerup Crates
    const powerupCrates: any[] = [];
    const crateTypes = [
      { type: 'seeds', color: 0xfbbf24, label: '+50 GOLDEN SEEDS!' },
      { type: 'paint', color: 0xff2a85, label: '+16 PAINT PODS!' },
      { type: 'shield', color: 0x22d3ee, label: '+60 GOGGLE SHIELD!' }
    ];
    for (let i = 0; i < 4; i++) {
      const chosen = crateTypes[i % crateTypes.length];
      const cx = -20 + Math.random() * 40;
      const cz = -15 + Math.random() * 30;
      const grp = new THREE.Group();
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.2, 1.2),
        new THREE.MeshPhysicalMaterial({ color: chosen.color, roughness: 0.2, clearcoat: 0.8 })
      );
      b.castShadow = true;
      grp.add(b);
      grp.position.set(cx, 1.2, cz);
      scene.add(grp);
      powerupCrates.push({ mesh: grp, x: cx, z: cz, ...chosen });
    }

    // 3. BUILD 3D HAMSTER CHARACTER BUILDER
    const buildHamster = (skinIdx: number) => {
      const skin = HAMSTER_SKINS[skinIdx % HAMSTER_SKINS.length];
      const root = new THREE.Group();

      const shadow = new THREE.Mesh(
        new THREE.CircleGeometry(1.3, 20),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 })
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      root.add(shadow);

      const bodyGroup = new THREE.Group();
      root.add(bodyGroup);

      const furMat = new THREE.MeshStandardMaterial({ color: skin.furColor, roughness: 0.82 });
      const bellyMat = new THREE.MeshStandardMaterial({ color: skin.bellyColor, roughness: 0.85 });
      const visorMat = new THREE.MeshPhysicalMaterial({ color: skin.visorColor, roughness: 0.08, clearcoat: 1.0 });

      // Torso & Head
      const lower = new THREE.Mesh(new THREE.SphereGeometry(1.08, 18, 16), furMat);
      lower.scale.set(1.08, 0.96, 1.02);
      lower.position.y = 1.15;
      lower.castShadow = true;
      bodyGroup.add(lower);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.92, 18, 16), furMat);
      head.scale.set(1.06, 0.95, 0.98);
      head.position.set(0, 1.92, 0.08);
      head.castShadow = true;
      bodyGroup.add(head);

      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.84, 14, 12), bellyMat);
      belly.scale.set(0.95, 1.05, 0.65);
      belly.position.set(0, 1.12, 0.62);
      bodyGroup.add(belly);

      // Goggles
      const goggleStrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.94, 0.94, 0.26, 18, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x111827 })
      );
      goggleStrap.position.set(0, 2.08, 0.06);
      bodyGroup.add(goggleStrap);

      const visorLens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.96, 0.96, 0.42, 18, 1, false, -Math.PI * 0.32, Math.PI * 0.64),
        visorMat
      );
      visorLens.position.set(0, 2.08, 0.09);
      bodyGroup.add(visorLens);

      // Marker Gun Model
      const markerGroup = new THREE.Group();
      const gunMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 1.15), gunMat);
      markerGroup.add(body);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 1.25, 12), gunMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.06, 1.05);
      markerGroup.add(barrel);

      // Translucent Hopper with colorful mini paintballs
      const hopper = new THREE.Mesh(
        new THREE.SphereGeometry(0.42, 14, 10),
        new THREE.MeshPhysicalMaterial({ color: 0x0f172a, transparent: true, opacity: 0.5, clearcoat: 1.0 })
      );
      hopper.scale.set(0.85, 0.78, 1.25);
      hopper.position.set(0, 0.52, 0.05);
      markerGroup.add(hopper);

      markerGroup.position.set(1.12, 1.48, 0.35);
      root.add(markerGroup);

      // Hamster Ball Shield bubble
      const ballShield = new THREE.Mesh(
        new THREE.SphereGeometry(1.85, 20, 16),
        new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35, clearcoat: 1.0 })
      );
      ballShield.position.y = 1.45;
      ballShield.visible = false;
      root.add(ballShield);

      root.userData = {
        bodyGroup,
        markerGroup,
        ballShield,
        walkPhase: Math.random() * 10
      };

      return root;
    };

    const localHamster = buildHamster(selectedSkinIdx);
    localHamster.position.set(-8, 0, 6);
    scene.add(localHamster);

    // AI Bots
    const bots: any[] = [];
    BOT_PROFILES.forEach((profile, idx) => {
      const bMesh = buildHamster(profile.skinIdx);
      const angle = (idx / 4) * Math.PI * 2 + 0.5;
      const bx = Math.cos(angle) * 20;
      const bz = Math.sin(angle) * 14;
      bMesh.position.set(bx, 0, bz);
      scene.add(bMesh);

      bots.push({
        name: profile.name,
        mesh: bMesh,
        x: bx,
        z: bz,
        vx: 0,
        vz: 0,
        hp: 100,
        shield: 100,
        targetX: bx,
        targetZ: bz,
        retargetTimer: 0,
        shootCooldown: 1.2 + Math.random()
      });
    });

    // Remote Players Meshes
    const remoteMeshes = new Map<string, THREE.Group>();

    // Engine State
    gameRef.current = {
      scene,
      camera,
      renderer,
      localHamster,
      obstacles,
      splatTargets,
      projectiles: [],
      particles: [],
      splatDecals: [],
      powerupCrates,
      bots,
      remoteMeshes,
      keys: {},
      x: -8,
      z: 6,
      vx: 0,
      vz: 0,
      rotY: 0,
      aimWorldX: 0,
      aimWorldZ: 0,
      mouseScreenX: width / 2,
      mouseScreenY: height / 2,
      mouseDown: false,
      lastShotTime: 0,
      damageMult: 1.0,
      speedMult: 1.0,
      hamsterBallActive: false,
      hamsterBallTimer: 0,
      fountainWaterMesh
    };

    // 4. Input Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
      if (gameRef.current) gameRef.current.keys[e.code] = true;
      if (e.code === 'KeyV') {
        setCameraMode(m => (m === 'overhead' ? 'shoulder' : 'overhead'));
      }
      if (e.code === 'Digit1') setActiveSlot(0);
      if (e.code === 'Digit2') setActiveSlot(1);
      if (e.code === 'Digit3') setActiveSlot(2);
      if (e.code === 'Digit4') deployBunker();
      if (e.code === 'Digit5') triggerHamsterBall();
      if (e.code === 'KeyQ') setIsQuestionModalOpen(true);
      if (e.code === 'KeyR') reloadHopper();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameRef.current) gameRef.current.keys[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (gameRef.current) {
        gameRef.current.mouseScreenX = e.clientX;
        gameRef.current.mouseScreenY = e.clientY;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && gameRef.current) {
        gameRef.current.mouseDown = true;
        fireShot();
      }
    };

    const handleMouseUp = () => {
      if (gameRef.current) gameRef.current.mouseDown = false;
    };

    const handleResize = () => {
      if (!canvasContainerRef.current) return;
      const w = canvasContainerRef.current.clientWidth || window.innerWidth;
      const h = canvasContainerRef.current.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    // 5. Main 3D Animation Loop
    let lastTime = performance.now();
    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const g = gameRef.current;
      if (!g) return;

      if (g.fountainWaterMesh) {
        g.fountainWaterMesh.rotation.y += dt * 3;
        g.fountainWaterMesh.scale.y = 0.9 + Math.sin(now * 0.008) * 0.15;
      }

      // Movement Input
      let mx = 0;
      let mz = 0;
      if (!isQuestionModalOpen && !isShopModalOpen && !isLeaderboardOpen) {
        if (g.keys['KeyW'] || g.keys['ArrowUp']) mz -= 1;
        if (g.keys['KeyS'] || g.keys['ArrowDown']) mz += 1;
        if (g.keys['KeyA'] || g.keys['ArrowLeft']) mx -= 1;
        if (g.keys['KeyD'] || g.keys['ArrowRight']) mx += 1;
      }
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        mx /= len;
        mz /= len;
      }

      // Pond check
      const pondDist = Math.hypot((g.x - 26) / 11.4, g.z / 18.5);
      const insidePond = pondDist <= 1.0;
      setInPond(insidePond);

      const spd = (insidePond ? 16.5 : 12.2) * g.speedMult * (g.hamsterBallActive ? 1.3 : 1.0);
      g.vx = mx * spd;
      g.vz = mz * spd;
      g.x += g.vx * dt;
      g.z += g.vz * dt;

      // Obstacle Collisions
      g.x = Math.max(-42, Math.min(42, g.x));
      g.z = Math.max(-29, Math.min(29, g.z));
      g.obstacles.forEach((obs) => {
        const dx = g.x - obs.x;
        const dz = g.z - obs.z;
        const d = Math.hypot(dx, dz);
        const minDist = obs.r + 1.1;
        if (d < minDist && d > 0.001) {
          const push = minDist - d;
          g.x += (dx / d) * push;
          g.z += (dz / d) * push;
        }
      });

      // Mouse Raycast for Aim
      const ndcX = (g.mouseScreenX / window.innerWidth) * 2 - 1;
      const ndcY = -(g.mouseScreenY / window.innerHeight) * 2 + 1;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1.2, 0), 0);
      const hitPt = new THREE.Vector3();
      if (ray.ray.intersectPlane(groundPlane, hitPt)) {
        g.aimWorldX = hitPt.x;
        g.aimWorldZ = hitPt.z;
        g.rotY = Math.atan2(hitPt.x - g.x, hitPt.z - g.z);
      }

      g.localHamster.position.set(g.x, 0, g.z);
      g.localHamster.rotation.y = g.rotY;

      // Camera Tracking
      if (cameraMode === 'shoulder') {
        const camDist = 11.5;
        const targetCamX = g.x - Math.sin(g.rotY) * camDist;
        const targetCamZ = g.z - Math.cos(g.rotY) * camDist;
        camera.position.x += (targetCamX - camera.position.x) * 9 * dt;
        camera.position.y += (8.8 - camera.position.y) * 9 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 9 * dt;
        camera.lookAt(g.x + Math.sin(g.rotY) * 8, 1.8, g.z + Math.cos(g.rotY) * 8);
      } else {
        camera.position.x += (g.x - camera.position.x) * 8 * dt;
        camera.position.y += (30 - camera.position.y) * 8 * dt;
        camera.position.z += (g.z + 22 - camera.position.z) * 8 * dt;
        camera.lookAt(g.x, 0.9, g.z - 1.5);
      }

      // Update Projectiles
      for (let i = g.projectiles.length - 1; i >= 0; i--) {
        const p = g.projectiles[i];
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;

        let hit = false;
        // Bot collision
        for (const bot of g.bots) {
          if (p.ownerId === 'local' && Math.hypot(p.mesh.position.x - bot.x, p.mesh.position.z - bot.z) < 1.4) {
            hit = true;
            sfx.playSplat();
            bot.hp -= p.damage;
            if (bot.hp <= 0) {
              setKos(k => k + 1);
              setSeeds(s => s + 45);
              setKoVictimName(bot.name);
              sfx.playKO();
              setTimeout(() => setKoVictimName(null), 2500);
              bot.hp = 100;
              bot.x = (Math.random() - 0.5) * 40;
              bot.z = (Math.random() - 0.5) * 30;
            }
            break;
          }
        }

        if (!hit && p.mesh.position.y <= 0.1) {
          hit = true;
        }

        if (hit || p.mesh.position.y < -1) {
          scene.remove(p.mesh);
          g.projectiles.splice(i, 1);
        }
      }

      // Update Bots
      g.bots.forEach(bot => {
        bot.retargetTimer -= dt;
        if (bot.retargetTimer <= 0) {
          bot.retargetTimer = 1.5 + Math.random() * 2;
          bot.targetX = g.x + (Math.random() - 0.5) * 20;
          bot.targetZ = g.z + (Math.random() - 0.5) * 20;
        }
        const bdx = bot.targetX - bot.x;
        const bdz = bot.targetZ - bot.z;
        const bdist = Math.hypot(bdx, bdz);
        if (bdist > 0.5) {
          bot.x += (bdx / bdist) * 8.5 * dt;
          bot.z += (bdz / bdist) * 8.5 * dt;
        }
        bot.mesh.position.set(bot.x, 0, bot.z);
        bot.mesh.rotation.y = Math.atan2(g.x - bot.x, g.z - bot.z);
      });

      // Render Radar
      renderRadar();

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
      renderer.dispose();
    };
  }, [selectedSkinIdx, cameraMode]);

  // Fire Paintball Function
  const fireShot = () => {
    const g = gameRef.current;
    if (!g || isSpectator) return;
    const now = performance.now();
    if (now - g.lastShotTime < 200) return;

    if (ammo <= 0) {
      if (reserveAmmo > 0) reloadHopper();
      else setIsQuestionModalOpen(true);
      return;
    }

    g.lastShotTime = now;
    setAmmo(a => a - 1);
    sfx.playMarkerShot();

    const skinPaint = HAMSTER_SKINS[selectedSkinIdx].paintColor;
    const dx = g.aimWorldX - g.x;
    const dz = g.aimWorldZ - g.z;
    const angle = Math.atan2(dx, dz);

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 12, 12),
      new THREE.MeshPhysicalMaterial({ color: skinPaint, clearcoat: 1.0, roughness: 0.1 })
    );
    ball.position.set(g.x + Math.sin(angle) * 1.3, 1.55, g.z + Math.cos(angle) * 1.3);
    g.scene.add(ball);

    g.projectiles.push({
      ownerId: 'local',
      mesh: ball,
      vx: Math.sin(angle) * 34,
      vy: 2.2,
      vz: Math.cos(angle) * 34,
      gravity: 9.8,
      damage: Math.round(85 * g.damageMult)
    });
  };

  // Deploy Bunker (Slot 4)
  const deployBunker = () => {
    const g = gameRef.current;
    if (!g || airBunkers <= 0) {
      setIsQuestionModalOpen(true);
      return;
    }
    setAirBunkers(b => b - 1);
    sfx.playCorrect();
    const bx = g.x + Math.sin(g.rotY) * 3.8;
    const bz = g.z + Math.cos(g.rotY) * 3.8;
    const mat = new THREE.MeshPhysicalMaterial({ color: HAMSTER_SKINS[selectedSkinIdx].paintColor, clearcoat: 0.9 });
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.8, 1.4), mat);
    bMesh.position.set(bx, 1.4, bz);
    bMesh.rotation.y = g.rotY;
    g.scene.add(bMesh);
    g.obstacles.push({ x: bx, z: bz, r: 2.4, h: 2.9 });
  };

  // Hamster Ball Shield (Slot 5)
  const triggerHamsterBall = () => {
    const g = gameRef.current;
    if (!g || g.hamsterBallActive) return;
    g.hamsterBallActive = true;
    g.hamsterBallTimer = 6.0;
    setShield(s => Math.min(maxShield, s + 45));
    setHp(h => Math.min(maxHp, h + 35));
    sfx.playCorrect();
    if (g.localHamster.userData.ballShield) {
      g.localHamster.userData.ballShield.visible = true;
    }
    setTimeout(() => {
      if (g) {
        g.hamsterBallActive = false;
        if (g.localHamster.userData.ballShield) g.localHamster.userData.ballShield.visible = false;
      }
    }, 6000);
  };

  // Reload Hopper
  const reloadHopper = () => {
    const needed = maxAmmo - ammo;
    if (needed <= 0) return;
    if (reserveAmmo > 0) {
      const transfer = Math.min(needed, reserveAmmo);
      setAmmo(a => a + transfer);
      setReserveAmmo(r => r - transfer);
      sfx.playCorrect();
    } else {
      setIsQuestionModalOpen(true);
    }
  };

  // Radar Minimap
  const renderRadar = () => {
    if (!radarCanvasRef.current || !gameRef.current) return;
    const c = radarCanvasRef.current;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = gameRef.current;

    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#0f291e';
    ctx.fillRect(0, 0, c.width, c.height);

    const toX = (wx: number) => c.width / 2 + (wx / 48) * (c.width / 2);
    const toZ = (wz: number) => c.height / 2 + (wz / 36) * (c.height / 2);

    // Obstacles
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    g.obstacles.forEach(o => {
      ctx.fillRect(toX(o.x) - 2, toZ(o.z) - 2, 4, 4);
    });

    // Bots
    ctx.fillStyle = '#ff2a85';
    g.bots.forEach(b => {
      ctx.beginPath();
      ctx.arc(toX(b.x), toZ(b.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Local Player
    ctx.fillStyle = '#a3e635';
    ctx.beginPath();
    ctx.arc(toX(g.x), toZ(g.z), 4.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // Trivia Answer Handler
  const handleTriviaAnswer = (optIdx: number) => {
    const qList = activeQuiz.questions.length > 0 ? activeQuiz.questions : DEFAULT_TRIVIA;
    const currentQ = qList[triviaDeckIndex % qList.length];
    if (!currentQ) return;

    if (optIdx === currentQ.answerIndex) {
      sfx.playCorrect();
      setTriviaStreak(s => s + 1);
      const bonusAmmo = 10;
      const bonusSeeds = 35;
      setAmmo(maxAmmo);
      setReserveAmmo(r => r + bonusAmmo);
      setBombs(b => Math.min(9, b + 1));
      setSeeds(s => s + bonusSeeds);
      setTriviaFeedback(`DIRECT HIT! +${bonusAmmo} Paintballs, +1 Paint Bomb & +${bonusSeeds} Seeds!`);
      setTimeout(() => {
        setTriviaFeedback(null);
        setTriviaDeckIndex(i => i + 1);
      }, 700);
    } else {
      sfx.playWrong();
      setTriviaStreak(0);
      setTriviaFeedback('Missed shot! Try the next question!');
      setTimeout(() => {
        setTriviaFeedback(null);
        setTriviaDeckIndex(i => i + 1);
      }, 850);
    }
  };

  const currentTriviaQ = (activeQuiz.questions.length > 0 ? activeQuiz.questions : DEFAULT_TRIVIA)[triviaDeckIndex % (activeQuiz.questions.length > 0 ? activeQuiz.questions.length : DEFAULT_TRIVIA.length)];

  // =============================================================
  // RENDER INTERFACE
  // =============================================================
  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-hidden font-sans select-none text-slate-100">
      {/* 3D WebGL Canvas Layer */}
      <div ref={canvasContainerRef} className="absolute inset-0 w-full h-full z-0 cursor-crosshair" />

      {/* -------------------------------------------------------------
          TOP ARCADE NAVIGATION HEADER (Back, Settings, Switch Game, Edit Quiz, Fullscreen)
         ------------------------------------------------------------- */}
      <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
        <button
          onClick={() => onViewChange('games')}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-white font-extrabold border border-white/20 shadow-xl backdrop-blur-md transition active:scale-95"
        >
          <ArrowLeft size={18} className="text-lime-400" />
          <span>Back to Games</span>
        </button>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setScreen('editor')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold text-xs border border-indigo-400/30 shadow-lg backdrop-blur-md transition"
          >
            <Edit3 size={15} />
            <span>Edit Questions ({activeQuiz.questions.length})</span>
          </button>

          <button
            onClick={() => setShowModeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-600/90 hover:bg-sky-500 text-white font-bold text-xs border border-sky-400/30 shadow-lg backdrop-blur-md transition"
          >
            <span>🎮 Switch Game</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="w-9 h-9 rounded-2xl bg-slate-900/85 hover:bg-slate-800 text-white border border-white/20 flex items-center justify-center transition shadow-lg backdrop-blur-md"
          >
            {soundEnabled ? <Volume2 size={16} className="text-lime-400" /> : <VolumeX size={16} className="text-rose-400" />}
          </button>

          <FullscreenButton className="bg-slate-900/85 hover:bg-slate-800 text-white border border-white/20 shadow-lg backdrop-blur-md" />
        </div>
      </div>

      {/* -------------------------------------------------------------
          SCREEN 1: QUIZ EDITOR
         ------------------------------------------------------------- */}
      {screen === 'editor' && (
        <div className="relative z-50 w-full h-full">
          <QuizEditor
            quiz={activeQuiz}
            folders={folders}
            onSave={saveQuiz}
            onCancel={() => setScreen('lobby')}
          />
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 2: JOIN / ENTRY MODAL (Matching User's HTML Specification)
         ------------------------------------------------------------- */}
      {screen === 'join' && (
        <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[460px] p-7 flex flex-col items-center border-2 border-slate-200 relative overflow-hidden text-slate-900">
            <div className="absolute top-0 inset-x-0 h-2.5 bg-gradient-to-r from-lime-400 via-pink-500 to-cyan-400" />

            <div className="text-center mb-4 mt-1">
              <div className="inline-flex items-center gap-1.5 bg-lime-100 text-lime-800 font-black text-[11px] px-3 py-0.5 rounded-full mb-1 border border-lime-300">
                <Tent size={13} className="text-emerald-600" /> OUTDOOR SPEEDBALL &amp; WOODSBALL PARK
              </div>
              <h1 className="font-black text-4xl sm:text-5xl tracking-tight text-slate-900 leading-none">
                HAMSTER PAINTBALL
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-1">
                3D PBR Glossy Paintballs • Tactical Hamster Gear • Real-Time Park Arena
              </p>
            </div>

            {/* Skin Selector */}
            <div className="w-full bg-slate-100 rounded-2xl p-3.5 mb-4 border border-slate-200">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                <span>Select Pro Hamster Rig</span>
                <span className="text-indigo-900 font-extrabold">{HAMSTER_SKINS[selectedSkinIdx].name}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {HAMSTER_SKINS.map((skin, idx) => (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => setSelectedSkinIdx(idx)}
                    className={`h-12 rounded-xl border-2 flex flex-col items-center justify-center transition cursor-pointer ${
                      idx === selectedSkinIdx ? 'border-indigo-700 bg-indigo-50 scale-105 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="w-6 h-6 rounded-full border-2 border-black/30 shadow-xs flex items-center justify-center" style={{ background: skin.badgeBg }}>
                      <span className="w-3 h-1.5 rounded-full" style={{ background: '#' + skin.visorColor.toString(16).padStart(6, '0') }} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Callsign Input */}
            <div className="w-full mb-3">
              <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Hamster Callsign</label>
              <input
                type="text"
                maxLength={16}
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Your Name"
                className="w-full h-12 px-4 text-center text-lg font-extrabold text-slate-800 bg-white border-2 border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-lime-500 transition"
              />
            </div>

            {/* Room Code */}
            <div className="w-full mb-4 flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400">PARK CODE</span>
                <input
                  type="text"
                  maxLength={6}
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  className="w-full h-11 pl-22 pr-3 text-center font-black tracking-widest text-slate-800 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-700"
                />
              </div>
              <button
                type="button"
                onClick={() => setRoomCode(String(Math.floor(100000 + Math.random() * 900000)))}
                className="px-3.5 h-11 bg-slate-200 hover:bg-slate-300 text-slate-800 font-extrabold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <RotateCw size={13} /> New Code
              </button>
            </div>

            {/* Launch to Lobby */}
            <button
              type="button"
              onClick={() => {
                sfx.playCorrect();
                setScreen('lobby');
              }}
              className="w-full h-13 py-3.5 bg-[#160269] hover:bg-[#220699] active:scale-[0.99] text-white font-black text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2 border-b-4 border-[#0c013d] cursor-pointer"
            >
              <Crosshair size={18} />
              <span>Enter Paintball Park</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 3: PRE-GAME LOBBY OVERLAY (Matching User's HTML Specification)
         ------------------------------------------------------------- */}
      {screen === 'lobby' && (
        <div className="absolute inset-0 z-40 flex flex-col justify-between pointer-events-none p-4">
          <div className="w-full max-w-4xl mx-auto bg-[#2e1f4d]/90 backdrop-blur-md py-4 px-6 rounded-3xl flex flex-col items-center justify-center pointer-events-auto shadow-2xl border border-white/15 text-center mt-12">
            <div className="text-white text-base sm:text-xl font-medium tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-lime-400 text-slate-950 font-black text-xs uppercase">LIVE PARK LOBBY</span>
              <span>Go to <strong className="underline decoration-pink-400">hamsterenglish.online</strong> and enter code</span>
            </div>

            <div
              onClick={() => setIsQrModalOpen(!isQrModalOpen)}
              className="text-white font-black text-6xl sm:text-8xl tracking-tight leading-none mt-2 cursor-pointer hover:scale-105 transition transform select-all drop-shadow-md font-mono"
              title="Click to toggle QR Code"
            >
              {roomCode}
            </div>

            {/* QR Modal Popup */}
            {isQrModalOpen && (
              <div className="mt-4 p-4 bg-white rounded-2xl shadow-2xl flex flex-col items-center gap-3 border-2 border-indigo-400">
                <div className="w-48 h-48 bg-slate-900 rounded-xl flex items-center justify-center p-3">
                  <div className="w-full h-full bg-white rounded-lg p-2 flex items-center justify-center text-slate-950 font-mono text-center font-bold text-xs">
                    [QR CODE: {roomCode}]
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://hamsterenglish.online/?hwPin=${roomCode}`);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1.5"
                >
                  <Copy size={13} /> Copy Join Link
                </button>
              </div>
            )}
          </div>

          <div className="w-full max-w-3xl mx-auto bg-[#2e1f4d]/90 backdrop-blur-md py-4 px-6 rounded-3xl flex flex-col items-center justify-center gap-3 pointer-events-auto border border-white/15">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <div className="bg-slate-800/90 border border-white/20 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-lime-400 animate-ping" />
                <span>Waiting for players... ({lobbyPlayerCount} Hamsters in Park)</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  sfx.playKO();
                  setScreen('game');
                }}
                className="bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 active:scale-95 text-slate-950 font-black text-sm px-7 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 border-b-4 border-emerald-800 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>START PARK PAINTBALL MATCH!</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-purple-200">
              <button
                type="button"
                onClick={() => setIsSpectator(!isSpectator)}
                className="bg-white/10 hover:bg-white/20 text-white/90 text-xs font-semibold px-4 py-1.5 rounded-lg transition"
              >
                {isSpectator ? 'Mode: Spectator (Click to Play)' : 'Mode: Active Player (Click to Spectate)'}
              </button>
              <span>Controls: WASD to Move, Mouse/Click to Aim &amp; Shoot, Q to Earn Pods, V to Switch Camera!</span>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 4: IN-GAME TACTICAL HUD
         ------------------------------------------------------------- */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between p-3 sm:p-5">
          {/* Top Row: Vitals (Left), Match Clock (Center), Control Bar (Right) */}
          <div className="w-full flex items-start justify-between gap-3">
            {/* Vitals Card */}
            <div className="pointer-events-auto bg-slate-900/85 backdrop-blur-md rounded-2xl p-3.5 w-68 sm:w-80 border-l-4 border-l-lime-400 border border-white/15 shadow-2xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-600 border border-white/80 flex items-center justify-center font-bold text-sm">
                    🐹
                  </div>
                  <div>
                    <div className="font-black text-white text-sm">{playerName.toUpperCase()}</div>
                    <div className="text-[10px] font-bold text-cyan-300">Pro Speedball Rig</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-white/10 text-xs font-bold">
                  <span className="text-pink-400">{kos} Splats</span>
                  <span className="text-slate-400">•</span>
                  <span className="text-amber-300">{seeds} Seeds</span>
                </div>
              </div>

              {/* Shield Bar */}
              <div className="mb-1.5">
                <div className="flex justify-between text-[10px] font-bold text-cyan-300 mb-0.5">
                  <span>GOGGLE SHIELD</span>
                  <span>{shield} / {maxShield}</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full p-0.5 border border-cyan-500/30">
                  <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${(shield / maxShield) * 100}%` }} />
                </div>
              </div>

              {/* Health Bar */}
              <div>
                <div className="flex justify-between text-[10px] font-bold text-lime-300 mb-0.5">
                  <span>HAMSTER HEALTH</span>
                  <span>{hp} / {maxHp}</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full p-0.5 border border-lime-500/30">
                  <div className="h-full bg-lime-400 rounded-full transition-all" style={{ width: `${(hp / maxHp) * 100}%` }} />
                </div>
              </div>

              {inPond && (
                <div className="text-[10px] font-black text-cyan-300 animate-pulse mt-1 text-center">
                  🌊 POND HYDROPLANE SPEED ACTIVE!
                </div>
              )}
            </div>

            {/* Match Clock & Room Code (Center) */}
            <div className="hidden lg:flex flex-col items-center gap-1 pointer-events-auto">
              <div className="bg-slate-900/85 backdrop-blur-md px-5 py-2 rounded-2xl flex items-center gap-4 border border-white/15 shadow-xl">
                <span className="font-black text-white text-base">HAMSTER PARK</span>
                <span className="text-xs font-mono font-bold text-lime-300">CODE: {roomCode}</span>
                <div className="flex items-center gap-1.5 text-white font-mono font-bold text-base">
                  <Clock size={16} className="text-pink-400" />
                  <span>{Math.floor(matchSeconds / 60)}:{(matchSeconds % 60).toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>

            {/* Top-Right Control Buttons */}
            <div className="pointer-events-auto flex items-center gap-2">
              <button
                onClick={() => setCameraMode(m => (m === 'overhead' ? 'shoulder' : 'overhead'))}
                className="h-9 px-3 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow"
                title="Switch Camera (Press V)"
              >
                <Video size={14} className="text-cyan-300" />
                <span>{cameraMode === 'overhead' ? 'Tactical' : 'Action 3D'}</span>
              </button>

              <button
                onClick={() => setIsShopModalOpen(true)}
                className="h-9 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow"
              >
                <Store size={14} />
                <span>Pro Shop</span>
              </button>

              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center justify-center transition"
              >
                <Trophy size={16} />
              </button>

              <button
                onClick={() => setScreen('lobby')}
                className="w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition"
                title="Return to Lobby"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Knockout Alert Banner */}
          {koVictimName && (
            <div className="self-center bg-slate-900/90 border-2 border-pink-500 px-6 py-2 rounded-2xl flex flex-col items-center shadow-2xl animate-bounce">
              <span className="text-[10px] font-black uppercase tracking-widest text-lime-300">DIRECT PAINTBALL ELIMINATION!</span>
              <span className="text-xl font-black text-pink-400 uppercase">SPLATTERED {koVictimName}</span>
            </div>
          )}

          {/* Bottom Row: Hopper Loader (Left), 5-Slot Tactical Loadout (Center), Radar (Right) */}
          <div className="w-full flex items-end justify-between gap-3">
            {/* Hopper Loader */}
            <div className="pointer-events-auto bg-slate-900/85 backdrop-blur-md rounded-2xl p-3 w-64 border-l-4 border-l-pink-500 border border-white/15 shadow-xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black text-pink-400 uppercase">PRO SPEEDBALL MARKER</div>
                  <div className="text-2xl font-black font-mono text-white">{ammo}/{maxAmmo} <span className="text-xs text-slate-400 font-sans">HOPPER</span></div>
                </div>
                <div className="bg-slate-950/80 px-2.5 py-1 rounded-xl text-right text-xs font-bold text-amber-300">
                  <div className="text-[9px] text-slate-400 uppercase">POD BAG</div>
                  <div>{reserveAmmo}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsQuestionModalOpen(true)}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 text-white font-black text-xs py-2 px-2.5 rounded-xl shadow transition flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1"><Zap size={13} className="text-amber-300" /> Earn Pods</span>
                  <span className="bg-black/30 px-1 rounded text-[10px]">Q</span>
                </button>
                <button
                  onClick={reloadHopper}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-extrabold text-xs py-2 px-2.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw size={13} />
                  <span>Reload</span>
                  <span className="bg-black/30 px-1 rounded text-[10px]">R</span>
                </button>
              </div>
            </div>

            {/* 5-Slot Tactical Loadout Dock */}
            <div className="pointer-events-auto mx-auto bg-slate-900/85 backdrop-blur-md p-2 rounded-2xl flex items-center gap-2 border border-white/15 shadow-2xl">
              {[
                { slot: 0, label: 'Speedball', icon: Crosshair, count: ammo, color: 'text-lime-400' },
                { slot: 1, label: 'Tri-Burst', icon: Zap, count: ammo, color: 'text-cyan-400' },
                { slot: 2, label: 'Paint Bomb', icon: Bomb, count: bombs, color: 'text-pink-400' },
                { slot: 3, label: 'Air Bunker', icon: Tent, count: airBunkers, color: 'text-amber-400' },
                { slot: 4, label: 'Ball Shield', icon: Shield, count: 'RDY', color: 'text-emerald-400' }
              ].map(item => {
                const Icon = item.icon;
                const isActive = activeSlot === item.slot;
                return (
                  <button
                    key={item.slot}
                    type="button"
                    onClick={() => {
                      setActiveSlot(item.slot);
                      if (item.slot === 3) deployBunker();
                      if (item.slot === 4) triggerHamsterBall();
                    }}
                    className={`w-16 h-14 rounded-xl flex flex-col items-center justify-center transition border cursor-pointer relative ${
                      isActive ? 'bg-indigo-600/60 border-lime-400 scale-105 shadow-lg' : 'bg-slate-800/80 border-white/10 hover:bg-slate-700'
                    }`}
                  >
                    <span className="absolute top-1 left-1.5 text-[9px] font-mono text-slate-400">{item.slot + 1}</span>
                    <Icon size={18} className={item.color} />
                    <span className="text-[9px] font-bold text-white mt-0.5">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Radar Minimap */}
            <div className="pointer-events-auto hidden sm:flex flex-col items-center bg-slate-900/85 backdrop-blur-md p-2 rounded-2xl border-r-4 border-r-cyan-400 border border-white/15 shadow-xl">
              <div className="text-[10px] font-bold text-cyan-300 mb-1 flex items-center gap-1">
                <Compass size={12} /> PARK RADAR
              </div>
              <canvas ref={radarCanvasRef} width={130} height={130} className="rounded-xl border border-white/10" />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          QUESTION DECK MODAL (EARN PAINT PODS & SEEDS)
         ------------------------------------------------------------- */}
      {isQuestionModalOpen && currentTriviaQ && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border-4 border-indigo-600 text-slate-900">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-lg leading-none">RELOAD PAINT PODS &amp; GOLDEN SEEDS</h3>
                <p className="text-xs text-indigo-100 mt-1">Answer Streak: <strong className="text-amber-300">{triviaStreak}x</strong> (+10 Paintballs, +1 Bomb &amp; +35 Seeds!)</p>
              </div>
              <button
                onClick={() => setIsQuestionModalOpen(false)}
                className="text-xs px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-bold"
              >
                Return (ESC)
              </button>
            </div>

            <div className="p-6">
              <span className="inline-block bg-indigo-100 text-indigo-800 font-extrabold text-[11px] uppercase px-2.5 py-0.5 rounded-full mb-2">
                ROUND QUESTION
              </span>
              <h2 className="font-extrabold text-xl sm:text-2xl text-slate-800 mb-5">
                {currentTriviaQ.text}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentTriviaQ.options.map((opt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleTriviaAnswer(idx)}
                    className="p-4 rounded-xl border-b-4 font-extrabold text-sm text-left transition shadow bg-slate-100 hover:bg-indigo-50 border-slate-300 hover:border-indigo-400 text-slate-800 cursor-pointer active:scale-95"
                  >
                    <span className="font-bold text-indigo-600 mr-2">{OPTION_LETTERS[idx]}.</span>
                    {parseOptionContent(opt).text || opt}
                  </button>
                ))}
              </div>

              {triviaFeedback && (
                <div className="mt-4 p-3 bg-emerald-600 text-white font-black text-center text-sm rounded-xl animate-fade-in">
                  {triviaFeedback}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          PRO SHOP UPGRADE MODAL
         ------------------------------------------------------------- */}
      {isShopModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Store className="text-amber-400" size={20} />
                <h3 className="font-black text-lg text-white">PRO PAINTBALL UPGRADE SHOP</h3>
              </div>
              <button
                onClick={() => setIsShopModalOpen(false)}
                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white"
              >
                Close
              </button>
            </div>

            <div className="text-right text-xs font-bold text-amber-300">
              Balance: {seeds} Golden Seeds
            </div>

            <div className="space-y-3">
              {upgrades.map((item, idx) => (
                <div key={item.id} className="bg-slate-800/80 p-3 rounded-2xl flex items-center justify-between border border-white/10">
                  <div>
                    <h4 className="font-bold text-sm text-white">{item.name}</h4>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                  <button
                    disabled={seeds < item.cost || item.level >= item.maxLevel}
                    onClick={() => {
                      if (seeds >= item.cost && item.level < item.maxLevel) {
                        setSeeds(s => s - item.cost);
                        setUpgrades(list => {
                          const copy = [...list];
                          copy[idx] = { ...copy[idx], level: copy[idx].level + 1, cost: Math.round(copy[idx].cost * 1.35) };
                          return copy;
                        });
                        if (item.id === 'maxAmmo') {
                          setMaxAmmo(m => m + 8);
                          setAmmo(a => a + 8);
                        } else if (item.id === 'damage') {
                          if (gameRef.current) gameRef.current.damageMult += 0.25;
                        } else if (item.id === 'speed') {
                          if (gameRef.current) gameRef.current.speedMult += 0.15;
                        } else if (item.id === 'shield') {
                          setMaxShield(s => s + 25);
                          setShield(s => s + 25);
                        }
                        sfx.playCorrect();
                      }
                    }}
                    className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
                  >
                    {item.level >= item.maxLevel ? 'MAX' : `${item.cost} Seeds`}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          LEADERBOARD MODAL
         ------------------------------------------------------------- */}
      {isLeaderboardOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-400" size={20} />
                <h3 className="font-black text-base text-white">SPEEDBALL STANDINGS</h3>
              </div>
              <button
                onClick={() => setIsLeaderboardOpen(false)}
                className="text-xs px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 bg-indigo-600/30 border border-lime-400/40 rounded-xl text-xs font-bold text-white">
                <span>1. {playerName} (You)</span>
                <span className="text-lime-300">{kos} Splats · {seeds} Seeds</span>
              </div>
              {gameRef.current?.bots.map((b: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-800 rounded-xl text-xs font-medium text-slate-200">
                  <span>{i + 2}. {b.name} [Bot]</span>
                  <span className="text-pink-400">{Math.floor(Math.random() * 3)} Splats</span>
                </div>
              ))}
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
    const validQuestions = questions.filter(q => q.text.trim() || q.options.some(o => o.trim()));
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
              <h1 className="text-2xl font-black text-slate-900">Paintball Question Editor</h1>
              <p className="text-xs font-semibold text-slate-500">Edit questions used for reloading paint pods and seeds during matches</p>
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
                  setActiveGiphyInput({ qId: q.id, optIndex: 'question', initialQuery: q.text });
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {q.options.map((opt, oIdx) => {
                  const isCorrect = q.answerIndex === oIdx;
                  return (
                    <div
                      key={oIdx}
                      className={`p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                        isCorrect ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200' : 'bg-slate-50 border-slate-200'
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
                          isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
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
                            setActiveGiphyInput({ qId: q.id, optIndex: oIdx, initialQuery: opt });
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
              const lines = sampleText.split(/\r?\n/).filter(l => l.trim().length > 0);
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
                      options: curQ.options && curQ.options.length >= 2 ? curQ.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
                      answerIndex: curQ.answerIndex || 0
                    });
                  }
                  curQ = { text: qMatch[1], options: [], answerIndex: 0 };
                } else if (optMatch && curQ) {
                  if (!curQ.options) curQ.options = [];
                  curQ.options.push(optMatch[2]);
                } else if (ansMatch && curQ) {
                  curQ.answerIndex = ansMatch[1].toUpperCase().charCodeAt(0) - 65;
                }
              });
              if (curQ && curQ.text) {
                imported.push({
                  id: Date.now() + Math.random(),
                  text: curQ.text,
                  options: curQ.options && curQ.options.length >= 2 ? curQ.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
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
