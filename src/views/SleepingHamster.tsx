import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Palette,
  AlertCircle,
  CheckCircle2,
  Check,
  RotateCcw,
  Timer,
  Play,
  Pause,
  Music,
  Square,
  X,
} from 'lucide-react';
import { ViewState } from '../types';

type SleepState =
  | 'DEEP_SLEEP'
  | 'LIGHT_SLEEP'
  | 'DISTURBED'
  | 'ALMOST_AWAKE'
  | 'AWAKE'
  | 'RECOVERING';

type NoiseAlertMode = 'hamster' | 'beep' | 'shush' | 'none';

type HabitatThemeId = 'midnight' | 'sakura' | 'forest' | 'sunrise' | 'ocean';

interface CoatStyle {
  id: string;
  name: string;
  body: [string, string, string];
  head: [string, string, string];
  swatch: string;
}

interface HabitatTheme {
  id: HabitatThemeId;
  name: string;
  swatch: string;
  pageBg: string;
  panelBg: string;
  tankBg: string;
  capGradient: string;
  rimTopGradient: string;
  rimBottomGradient: string;
  windowSky: [string, string];
  windowFrame: string;
  windowMullion: string;
  wheelColors: [string, string, string, string]; // [light, mid, dark, hub]
  bottleAccent: string;
  bottleCap: string;
  woodHouse: [string, string, string];
  woodRoof: [string, string, string];
  bowlBody: string;
  bowlRim: string;
  bowlStroke: string;
  beddingBack: string;
  beddingMid: string;
  beddingGrad: [string, string, string];
  puffColors: [string, string, string];
  fairyColor: string;
  fairyGlow: string;
  dustColor: string;
}

const HABITAT_THEMES: HabitatTheme[] = [
  {
    id: 'midnight',
    name: 'Midnight Starlight',
    swatch: '#7c3aed',
    pageBg: 'from-[#281658] via-[#150c30] to-[#0a051a]',
    panelBg: 'bg-[#23144a]/90',
    tankBg: '#160d32',
    capGradient: 'linear-gradient(180deg, #7c3aed 0%, #4c1d95 100%)',
    rimTopGradient: 'linear-gradient(180deg, #b794f4 0%, #7c3aed 45%, #4c1d95 100%)',
    rimBottomGradient: 'linear-gradient(180deg, #7c3aed 0%, #5b21b6 55%, #3b0764 100%)',
    windowSky: ['#070416', '#1e1042'],
    windowFrame: '#4c3285',
    windowMullion: '#311d61',
    wheelColors: ['#b794f4', '#805ad5', '#3b2370', '#c4b5fd'],
    bottleAccent: '#7c3aed',
    bottleCap: '#5b21b6',
    woodHouse: ['#e8c396', '#c7955d', '#946534'],
    woodRoof: ['#d4a068', '#a8733e', '#6e471f'],
    bowlBody: '#84a955',
    bowlRim: '#a3c572',
    bowlStroke: '#536e2e',
    beddingBack: '#b9a3ca',
    beddingMid: '#d9c9e2',
    beddingGrad: ['#fdf7f2', '#e8d8e6', '#ad94be'],
    puffColors: ['#fffaf7', '#efe2f5', '#fef3c7'],
    fairyColor: '#fde68a',
    fairyGlow: 'rgba(253, 224, 71, 0.7)',
    dustColor: 'rgba(216, 180, 254, 0.85)',
  },
  {
    id: 'sakura',
    name: 'Cozy Sakura',
    swatch: '#ec4899',
    pageBg: 'from-[#42183a] via-[#260e24] to-[#130612]',
    panelBg: 'bg-[#381430]/90',
    tankBg: '#240f22',
    capGradient: 'linear-gradient(180deg, #db2777 0%, #831843 100%)',
    rimTopGradient: 'linear-gradient(180deg, #f9a8d4 0%, #db2777 45%, #831843 100%)',
    rimBottomGradient: 'linear-gradient(180deg, #db2777 0%, #9d174d 55%, #500724 100%)',
    windowSky: ['#1b0a1c', '#4a193f'],
    windowFrame: '#831843',
    windowMullion: '#500724',
    wheelColors: ['#f9a8d4', '#ec4899', '#831843', '#fbcfe8'],
    bottleAccent: '#db2777',
    bottleCap: '#9d174d',
    woodHouse: ['#f3d5c0', '#d8a48f', '#a66e5c'],
    woodRoof: ['#e5989b', '#b56576', '#6d3544'],
    bowlBody: '#f472b6',
    bowlRim: '#fbcfe8',
    bowlStroke: '#9d174d',
    beddingBack: '#d9b4c8',
    beddingMid: '#f2d9e6',
    beddingGrad: ['#fff5f8', '#f5d7e5', '#be8aa5'],
    puffColors: ['#fff8fa', '#fce7f3', '#fef3c7'],
    fairyColor: '#fbcfe8',
    fairyGlow: 'rgba(244, 114, 182, 0.7)',
    dustColor: 'rgba(249, 168, 212, 0.85)',
  },
  {
    id: 'forest',
    name: 'Enchanted Forest',
    swatch: '#10b981',
    pageBg: 'from-[#10382e] via-[#09211b] to-[#04110e]',
    panelBg: 'bg-[#0e2d24]/90',
    tankBg: '#0b221c',
    capGradient: 'linear-gradient(180deg, #059669 0%, #064e3b 100%)',
    rimTopGradient: 'linear-gradient(180deg, #6ee7b7 0%, #059669 45%, #064e3b 100%)',
    rimBottomGradient: 'linear-gradient(180deg, #059669 0%, #047857 55%, #022c22 100%)',
    windowSky: ['#03120e', '#0f3629'],
    windowFrame: '#166534',
    windowMullion: '#14532d',
    wheelColors: ['#6ee7b7', '#10b981', '#064e3b', '#a7f3d0'],
    bottleAccent: '#0d9488',
    bottleCap: '#115e59',
    woodHouse: ['#e3cca8', '#ba9665', '#7d5f37'],
    woodRoof: ['#65a30d', '#3f6212', '#263d0b'],
    bowlBody: '#d97706',
    bowlRim: '#fbbf24',
    bowlStroke: '#78350f',
    beddingBack: '#a7c4b5',
    beddingMid: '#d2e5db',
    beddingGrad: ['#f7fbf8', '#d9ebe0', '#8bb09c'],
    puffColors: ['#f8fcf9', '#dcfce7', '#fef9c3'],
    fairyColor: '#bef264',
    fairyGlow: 'rgba(190, 242, 100, 0.72)',
    dustColor: 'rgba(167, 243, 208, 0.85)',
  },
  {
    id: 'sunrise',
    name: 'Golden Sunrise',
    swatch: '#f59e0b',
    pageBg: 'from-[#422118] via-[#281311] to-[#140908]',
    panelBg: 'bg-[#361b15]/90',
    tankBg: '#231312',
    capGradient: 'linear-gradient(180deg, #d97706 0%, #78350f 100%)',
    rimTopGradient: 'linear-gradient(180deg, #fcd34d 0%, #d97706 45%, #78350f 100%)',
    rimBottomGradient: 'linear-gradient(180deg, #d97706 0%, #b45309 55%, #451a03 100%)',
    windowSky: ['#3b1c2a', '#d97706'],
    windowFrame: '#92400e',
    windowMullion: '#78350f',
    wheelColors: ['#fcd34d', '#f59e0b', '#78350f', '#fef08a'],
    bottleAccent: '#ea580c',
    bottleCap: '#9a3412',
    woodHouse: ['#f5d0a9', '#d49a6a', '#9c6238'],
    woodRoof: ['#ea580c', '#c2410c', '#7c2d12'],
    bowlBody: '#0ea5e9',
    bowlRim: '#7dd3fc',
    bowlStroke: '#0369a1',
    beddingBack: '#dfbfa9',
    beddingMid: '#f4dfd0',
    beddingGrad: ['#fffaf5', '#f6e1d2', '#c89e86'],
    puffColors: ['#fffaf3', '#fef3c7', '#ffedd5'],
    fairyColor: '#fde047',
    fairyGlow: 'rgba(251, 191, 36, 0.75)',
    dustColor: 'rgba(253, 230, 138, 0.85)',
  },
  {
    id: 'ocean',
    name: 'Ocean Dreamland',
    swatch: '#0ea5e9',
    pageBg: 'from-[#0e2d4d] via-[#091c33] to-[#040d1a]',
    panelBg: 'bg-[#0e243d]/90',
    tankBg: '#091b30',
    capGradient: 'linear-gradient(180deg, #0284c7 0%, #075985 100%)',
    rimTopGradient: 'linear-gradient(180deg, #7dd3fc 0%, #0284c7 45%, #075985 100%)',
    rimBottomGradient: 'linear-gradient(180deg, #0284c7 0%, #0369a1 55%, #082f49 100%)',
    windowSky: ['#031326', '#0c4a6e'],
    windowFrame: '#0369a1',
    windowMullion: '#075985',
    wheelColors: ['#7dd3fc', '#0ea5e9', '#0c4a6e', '#bae6fd'],
    bottleAccent: '#0284c7',
    bottleCap: '#075985',
    woodHouse: ['#e2d9c8', '#b8ad99', '#7d7362'],
    woodRoof: ['#38bdf8', '#0284c7', '#075985'],
    bowlBody: '#fb7185',
    bowlRim: '#fecdd3',
    bowlStroke: '#9f1239',
    beddingBack: '#9ec4d8',
    beddingMid: '#cce4f0',
    beddingGrad: ['#f5fbff', '#d6ebf7', '#86aec7'],
    puffColors: ['#f8fcff', '#e0f2fe', '#fef9c3'],
    fairyColor: '#a5f3fc',
    fairyGlow: 'rgba(103, 232, 249, 0.72)',
    dustColor: 'rgba(186, 230, 253, 0.85)',
  },
];

const COAT_STYLES: CoatStyle[] = [
  {
    id: 'golden',
    name: 'Golden Syrian',
    body: ['#fbd38d', '#dd842c', '#9c4221'],
    head: ['#f6ad55', '#c06c22', '#8c4215'],
    swatch: '#f59e0b',
  },
  {
    id: 'cream',
    name: 'Cream Caramel',
    body: ['#fef3c7', '#eab308', '#a16207'],
    head: ['#fde68a', '#d97706', '#92400e'],
    swatch: '#fde047',
  },
  {
    id: 'pearl',
    name: 'Winter Pearl',
    body: ['#ffffff', '#e2e8f0', '#94a3b8'],
    head: ['#f8fafc', '#cbd5e1', '#64748b'],
    swatch: '#e2e8f0',
  },
  {
    id: 'cocoa',
    name: 'Cocoa Bear',
    body: ['#d6bcfa', '#78350f', '#451a03'],
    head: ['#a78bfa', '#78350f', '#3f1d0b'],
    swatch: '#92400e',
  },
  {
    id: 'panda',
    name: 'Panda Oreo',
    body: ['#71717a', '#3f3f46', '#18181b'],
    head: ['#52525b', '#27272a', '#09090b'],
    swatch: '#3f3f46',
  },
  {
    id: 'peach',
    name: 'Peach Apricot',
    body: ['#fed7aa', '#fb923c', '#c2410c'],
    head: ['#fdba74', '#f97316', '#9a3412'],
    swatch: '#fb923c',
  },
];

const NOISE_ALERT_OPTIONS: { id: NoiseAlertMode; label: string }[] = [
  { id: 'hamster', label: 'Hamster Voice' },
  { id: 'beep', label: 'Beep' },
  { id: 'shush', label: 'Shush' },
  { id: 'none', label: 'No sound' },
];

const MUSIC_TRACKS: readonly { id: number; label: string; videoId: string; startSeconds?: number }[] = [
  { id: 1, label: '1', videoId: 'GqQ6YOlmYIY' },
  { id: 2, label: '2', videoId: 'FmB2hClhl_k' },
  { id: 3, label: '3', videoId: 'dQi-ofZmrPw', startSeconds: 641 },
];

const STATE_UI: Record<
  SleepState,
  {
    enclosureBorder: string;
    barClass: string;
    glowColor: string;
  }
> = {
  DEEP_SLEEP: {
    enclosureBorder:
      'border-emerald-400/45 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_50px_rgba(74,222,128,0.18)]',
    barClass: 'from-emerald-400 to-green-500',
    glowColor: '#4ade80',
  },
  LIGHT_SLEEP: {
    enclosureBorder:
      'border-sky-400/50 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_50px_rgba(96,165,250,0.22)]',
    barClass: 'from-sky-400 to-blue-500',
    glowColor: '#60a5fa',
  },
  DISTURBED: {
    enclosureBorder:
      'border-amber-400/75 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_60px_rgba(251,191,36,0.3)]',
    barClass: 'from-amber-400 to-yellow-500',
    glowColor: '#fbbf24',
  },
  ALMOST_AWAKE: {
    enclosureBorder:
      'border-orange-500/85 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_70px_rgba(249,115,22,0.4)] sh-enclosure-shake',
    barClass: 'from-orange-500 to-red-500',
    glowColor: '#f97316',
  },
  AWAKE: {
    enclosureBorder:
      'border-rose-500/90 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_85px_rgba(248,113,113,0.52)]',
    barClass: 'from-red-500 to-rose-600',
    glowColor: '#f87171',
  },
  RECOVERING: {
    enclosureBorder:
      'border-purple-400/65 shadow-[0_24px_65px_rgba(0,0,0,0.68),0_0_55px_rgba(167,139,250,0.28)]',
    barClass: 'from-purple-400 to-indigo-400',
    glowColor: '#a881ff',
  },
};

function getThresholdsForSensitivity(sensitivityValue: number) {
  const s = Math.max(0, Math.min(100, sensitivityValue)) / 100;
  // s = 0 -> very relaxed, s = 0.5 -> normal (default), s = 1 -> highly sensitive
  if (s <= 0.5) {
    const t = s / 0.5;
    return {
      light: Math.round(55 + (35 - 55) * t),
      disturbed: Math.round(74 + (54 - 74) * t),
      almost: Math.round(86 + (72 - 86) * t),
      awake: Math.round(95 + (86 - 95) * t),
    };
  }
  const t = (s - 0.5) / 0.5;
  return {
    light: Math.round(35 + (18 - 35) * t),
    disturbed: Math.round(54 + (30 - 54) * t),
    almost: Math.round(72 + (46 - 72) * t),
    awake: Math.round(86 + (64 - 86) * t),
  };
}

function getSensitivityLabel(val: number): string {
  if (val < 30) return 'Low';
  if (val <= 65) return 'Normal';
  return 'High';
}

interface FloatingParticle {
  id: number;
  kind: 'z' | 'heart' | 'star';
  text: string;
  leftPct: number;
  sizeRem: number;
  durationSec: number;
}

const AMBIENT_DUST_MOTES = [
  { left: '14%', top: '24%', size: 5, delay: '0s', dur: '5.5s' },
  { left: '24%', top: '52%', size: 4, delay: '1.1s', dur: '6.2s' },
  { left: '36%', top: '18%', size: 6, delay: '2.3s', dur: '5.8s' },
  { left: '48%', top: '28%', size: 4, delay: '0.6s', dur: '6.8s' },
  { left: '61%', top: '22%', size: 5, delay: '1.9s', dur: '5.2s' },
  { left: '74%', top: '42%', size: 6, delay: '3.1s', dur: '6.5s' },
  { left: '84%', top: '26%', size: 4, delay: '0.9s', dur: '5.9s' },
  { left: '19%', top: '70%', size: 5, delay: '2.7s', dur: '6.1s' },
  { left: '79%', top: '66%', size: 4, delay: '1.5s', dur: '5.4s' },
];

function formatTime(totalSeconds: number, forceHours = false): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (forceHours || h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s
      .toString()
      .padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function SleepingHamster({
  onViewChange,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Session & Microphone UI state
  const [hasStarted, setHasStarted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isConnectingMic, setIsConnectingMic] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Right-Hand Controls, Theme & Coat Color
  const [sensitivityValue, setSensitivityValue] = useState(50);
  const [noiseAlert, setNoiseAlert] = useState<NoiseAlertMode>('hamster');
  const [themeIndex, setThemeIndex] = useState(0);
  const [coatIndex, setCoatIndex] = useState(0);

  const [activeMusicTrack, setActiveMusicTrack] = useState<number | null>(null);
  const [pendingMusicTrack, setPendingMusicTrack] = useState<number | null>(null);
  const musicIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Live Status, Timers & Individual Stars (Default 3 stars)
  const [sleepState, setSleepState] = useState<SleepState>('DEEP_SLEEP');
  const [sustainedEnergy, setSustainedEnergy] = useState(8);
  const [rawLevel, setRawLevel] = useState(0);
  const [estimatedDb, setEstimatedDb] = useState(28);
  const [timerMode, setTimerMode] = useState<'up' | 'countdown'>('up');
  const [countdownDuration, setCountdownDuration] = useState(300);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(5);
  const [editSeconds, setEditSeconds] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [isTimerMenuOpen, setIsTimerMenuOpen] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);

  const [starPoints, setStarPoints] = useState(3.0);
  const [starSlots, setStarSlots] = useState(3);

  // Visual Particles & Spectrum
  const [particles, setParticles] = useState<FloatingParticle[]>([]);
  const [freqBars, setFreqBars] = useState<number[]>(() => Array(14).fill(14));

  // Mutable refs for 60fps audio processing loop
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timeDomainBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);
  const freqDomainBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const sustainedRef = useRef(8);
  const sleepStateRef = useRef<SleepState>('DEEP_SLEEP');
  const lastStateChangeRef = useRef(0);
  const recoveryHoldFramesRef = useRef(0);
  const lastWarningSoundRef = useRef(0);
  const muteMicUntilRef = useRef(0);
  const particleIdRef = useRef(1);
  const starPointsRef = useRef(3.0);
  const quietMinuteAccumRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  const stateSnapshotRef = useRef({
    hasStarted,
    isMicMuted,
    sensitivityValue,
    noiseAlert,
    timerMode,
    isTimerPaused,
  });
  stateSnapshotRef.current = {
    hasStarted,
    isMicMuted,
    sensitivityValue,
    noiseAlert,
    timerMode,
    isTimerPaused,
  };

  const currentTheme = HABITAT_THEMES[themeIndex];
  const currentCoat = COAT_STYLES[coatIndex];
  const currentThreshold = getThresholdsForSensitivity(sensitivityValue);
  const activeUi = STATE_UI[sleepState];

  // Clean up audio & animation frame on unmount
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const spawnParticle = useCallback(
    (kind: FloatingParticle['kind'], text: string, sizeRem = 1.4) => {
      const id = particleIdRef.current++;
      const durationSec = kind === 'z' ? 3.2 : 1.7;
      const leftPct = kind === 'z' ? 44 + Math.random() * 14 : 38 + Math.random() * 24;
      setParticles((prev) => [
        ...prev.slice(-14),
        { id, kind, text, leftPct, sizeRem, durationSec },
      ]);
      window.setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== id));
      }, durationSec * 1000);
    },
    []
  );

  // Strong, Loud, Clear Classroom Sound Effects: Hamster Voice (default), Beep, Shush, or No sound
  const playAlertSound = useCallback(
    (
      type: 'warning' | 'awake' | 'star' | 'pet',
      overrideMode?: NoiseAlertMode,
      forceLoop = false
    ) => {
      const mode = overrideMode ?? stateSnapshotRef.current.noiseAlert;
      if (mode === 'none') return;

      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = audioCtxRef.current || new Ctx();
        if (!audioCtxRef.current) audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});

        const now = ctx.currentTime;

        if ((type === 'warning' || type === 'awake') && !forceLoop) {
          if (now - lastWarningSoundRef.current < 0.55) return;
        }
        if (type === 'warning' || type === 'awake') {
          lastWarningSoundRef.current = now;
        }

        // Master boost + brickwall limiter delivers loud, commanding classroom alerts with zero clipping
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(type === 'star' || type === 'pet' ? 1.1 : 1.75, now);

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-2, now);
        limiter.knee.setValueAtTime(4, now);
        limiter.ratio.setValueAtTime(14, now);
        limiter.attack.setValueAtTime(0.002, now);
        limiter.release.setValueAtTime(0.08, now);

        masterGain.connect(limiter);
        limiter.connect(ctx.destination);

        // Brief duck window (260ms) so speaker burst never blocks listening for silence
        muteMicUntilRef.current = performance.now() + 260;

        if (type === 'star') {
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.08);
            gain.gain.setValueAtTime(0.24, now + idx * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.38);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now + idx * 0.08);
            osc.stop(now + idx * 0.08 + 0.4);
          });
          return;
        }

        if (type === 'pet') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(860, now);
          osc.frequency.exponentialRampToValueAtTime(1220, now + 0.14);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now);
          osc.stop(now + 0.24);
          return;
        }

        // Loud, Strong Classroom Noise Alert Effects
        if (mode === 'hamster') {
          // Bold, expressive hamster squeak/chirp using layered triangle + sine carriers
          const chirps =
            type === 'warning'
              ? [
                  { start: 0, f1: 1280, f2: 1760, dur: 0.15 },
                  { start: 0.17, f1: 1520, f2: 1080, dur: 0.17 },
                ]
              : [
                  { start: 0, f1: 1380, f2: 1920, dur: 0.13 },
                  { start: 0.14, f1: 1560, f2: 2040, dur: 0.13 },
                  { start: 0.28, f1: 1740, f2: 1120, dur: 0.19 },
                ];

          chirps.forEach((chirp) => {
            const osc = ctx.createOscillator();
            const harmOsc = ctx.createOscillator();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            const gain = ctx.createGain();
            const harmGain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(chirp.f1, now + chirp.start);
            osc.frequency.exponentialRampToValueAtTime(
              chirp.f2,
              now + chirp.start + chirp.dur
            );

            harmOsc.type = 'sine';
            harmOsc.frequency.setValueAtTime(chirp.f1 * 1.5, now + chirp.start);
            harmOsc.frequency.exponentialRampToValueAtTime(
              chirp.f2 * 1.5,
              now + chirp.start + chirp.dur
            );

            lfo.type = 'sine';
            lfo.frequency.setValueAtTime(28, now + chirp.start);
            lfoGain.gain.setValueAtTime(34, now + chirp.start);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            const peak = type === 'awake' ? 0.78 : 0.66;
            gain.gain.setValueAtTime(0.001, now + chirp.start);
            gain.gain.linearRampToValueAtTime(peak, now + chirp.start + 0.015);
            gain.gain.exponentialRampToValueAtTime(
              0.001,
              now + chirp.start + chirp.dur
            );

            harmGain.gain.setValueAtTime(0.001, now + chirp.start);
            harmGain.gain.linearRampToValueAtTime(peak * 0.4, now + chirp.start + 0.015);
            harmGain.gain.exponentialRampToValueAtTime(
              0.001,
              now + chirp.start + chirp.dur
            );

            osc.connect(gain);
            harmOsc.connect(harmGain);
            gain.connect(masterGain);
            harmGain.connect(masterGain);

            osc.start(now + chirp.start);
            harmOsc.start(now + chirp.start);
            lfo.start(now + chirp.start);
            osc.stop(now + chirp.start + chirp.dur + 0.02);
            harmOsc.stop(now + chirp.start + chirp.dur + 0.02);
            lfo.stop(now + chirp.start + chirp.dur + 0.02);
          });
        } else if (mode === 'beep') {
          // Strong, attention-grabbing double/triple classroom alert chime
          const notes = type === 'awake' ? [880, 1046.5, 1318.5] : [783.99, 987.77];
          notes.forEach((freq, idx) => {
            const t0 = now + idx * 0.14;
            const osc = ctx.createOscillator();
            const harmonic = ctx.createOscillator();
            const gain = ctx.createGain();
            const harmGain = ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t0);
            harmonic.type = 'sine';
            harmonic.frequency.setValueAtTime(freq * 2, t0);

            const peak = type === 'awake' ? 0.76 : 0.64;
            gain.gain.setValueAtTime(0.001, t0);
            gain.gain.linearRampToValueAtTime(peak, t0 + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.32);

            harmGain.gain.setValueAtTime(0.001, t0);
            harmGain.gain.linearRampToValueAtTime(peak * 0.35, t0 + 0.01);
            harmGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

            osc.connect(gain);
            harmonic.connect(harmGain);
            gain.connect(masterGain);
            harmGain.connect(masterGain);

            osc.start(t0);
            harmonic.start(t0);
            osc.stop(t0 + 0.34);
            harmonic.stop(t0 + 0.24);
          });
        } else if (mode === 'shush') {
          // Powerful, full-bodied vocal "SHHHH!" with strong mid-band energy (zero harsh hiss)
          const duration = type === 'awake' ? 0.62 : 0.52;
          const bufferSize = Math.floor(ctx.sampleRate * duration);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let b0 = 0;
          let b1 = 0;
          let b2 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + white * 0.036;
            b1 = 0.985 * b1 + white * 0.042;
            b2 = 0.95 * b2 + white * 0.064;
            output[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.16) * 3.4));
          }

          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const highpass = ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.value = 550;

          const formant = ctx.createBiquadFilter();
          formant.type = 'bandpass';
          formant.frequency.value = 1750;
          formant.Q.value = 1.15;

          const bodyBoost = ctx.createBiquadFilter();
          bodyBoost.type = 'peaking';
          bodyBoost.frequency.value = 1600;
          bodyBoost.gain.value = 7;

          const gain = ctx.createGain();
          const peak = type === 'awake' ? 1.15 : 0.95;
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(peak, now + 0.05);
          gain.gain.setValueAtTime(peak * 0.88, now + duration * 0.65);
          gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          noise.connect(highpass);
          highpass.connect(formant);
          formant.connect(bodyBoost);
          bodyBoost.connect(gain);
          gain.connect(masterGain);

          noise.start(now);
          noise.stop(now + duration + 0.02);
        }
      } catch {
        // Ignore browser audio restrictions
      }
    },
    []
  );

  // Continuous Noise Alert Loop while Disturbed / Almost Awake / Awake
  useEffect(() => {
    if (!hasStarted || isMicMuted || noiseAlert === 'none') return;
    if (sleepState !== 'DISTURBED' && sleepState !== 'ALMOST_AWAKE' && sleepState !== 'AWAKE') {
      return;
    }

    const soundType: 'warning' | 'awake' = sleepState === 'AWAKE' ? 'awake' : 'warning';
    const intervalMs =
      sleepState === 'AWAKE' ? 620 : sleepState === 'ALMOST_AWAKE' ? 740 : 900;

    const id = window.setInterval(() => {
      if (stateSnapshotRef.current.isMicMuted || stateSnapshotRef.current.noiseAlert === 'none') {
        return;
      }
      playAlertSound(soundType, undefined, true);
    }, intervalMs);

    return () => clearInterval(id);
  }, [hasStarted, sleepState, isMicMuted, noiseAlert, playAlertSound]);

  const applySleepState = useCallback(
    (next: SleepState) => {
      if (sleepStateRef.current === next) return;
      const prev = sleepStateRef.current;
      sleepStateRef.current = next;
      lastStateChangeRef.current = performance.now();
      setSleepState(next);

      if (next === 'DISTURBED' || next === 'ALMOST_AWAKE') {
        playAlertSound('warning');
      } else if (next === 'AWAKE' && prev !== 'AWAKE') {
        playAlertSound('awake');
      }
    },
    [playAlertSound]
  );

  // Main 60fps Live Microphone Audio Processing Loop (with hysteresis to prevent face glitching)
  useEffect(() => {
    if (!hasStarted) return;

    let frameCounter = 0;
    lastFrameTimeRef.current = performance.now();

    const tick = () => {
      const nowPerf = performance.now();
      const dtSec = Math.min(0.1, Math.max(0.001, (nowPerf - lastFrameTimeRef.current) / 1000));
      lastFrameTimeRef.current = nowPerf;

      const snap = stateSnapshotRef.current;
      const t = getThresholdsForSensitivity(snap.sensitivityValue);

      if (analyserRef.current) {
        const analyser = analyserRef.current;
        const fftLen = analyser.fftSize;
        if (!timeDomainBufRef.current || timeDomainBufRef.current.length !== fftLen) {
          timeDomainBufRef.current = new Float32Array(new ArrayBuffer(fftLen * 4));
        }
        const binCount = analyser.frequencyBinCount;
        if (!freqDomainBufRef.current || freqDomainBufRef.current.length !== binCount) {
          freqDomainBufRef.current = new Uint8Array(new ArrayBuffer(binCount));
        }

        const timeData = timeDomainBufRef.current;
        const freqData = freqDomainBufRef.current;
        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);

        let rawInput = 0;
        if (snap.isMicMuted) {
          rawInput = 0;
        } else if (nowPerf >= muteMicUntilRef.current) {
          // True logarithmic dBFS calculation over speech-band filtered audio (120Hz–4000Hz)
          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const sample = timeData[i];
            sumSq += sample * sample;
          }
          const rms = Math.sqrt(sumSq / timeData.length);
          const dbfs = 20 * Math.log10(Math.max(rms, 1e-5));
          // Map quiet (-60 dBFS) -> 0 and loud speech/clap (-12 dBFS) -> 100 accurately
          rawInput = Math.max(0, Math.min(100, ((dbfs + 60) / 48) * 100));
        } else {
          rawInput = sustainedRef.current * 0.96;
        }

        // Responsive attack (detects voices accurately in ~200ms) & smooth calm-down release
        const attackRate = 0.13;
        const releaseRate = snap.isMicMuted ? 0.12 : 0.055;

        let energy = sustainedRef.current;
        if (rawInput > energy) {
          energy += (rawInput - energy) * attackRate;
        } else {
          energy -= (energy - rawInput) * releaseRate;
        }
        energy = Math.max(3, Math.min(100, energy));
        sustainedRef.current = energy;

        // Hysteresis & hold window to prevent rapid state flickering / face glitching
        const curState = sleepStateRef.current;
        const elapsedSinceChange = nowPerf - lastStateChangeRef.current;
        const awakeHoldFrames = 65;
        const holdWindowMs = 950;

        if (curState === 'AWAKE') {
          if (energy < t.disturbed - 6) {
            recoveryHoldFramesRef.current += 1;
            if (recoveryHoldFramesRef.current > awakeHoldFrames) {
              recoveryHoldFramesRef.current = 0;
              applySleepState('RECOVERING');
            }
          } else {
            recoveryHoldFramesRef.current = 0;
          }
        } else {
          let nextState: SleepState = curState;

          // Escalation
          if (energy >= t.awake) {
            nextState = 'AWAKE';
          } else if (energy >= t.almost && curState !== 'ALMOST_AWAKE') {
            nextState = 'ALMOST_AWAKE';
          } else if (
            energy >= t.disturbed &&
            (curState === 'DEEP_SLEEP' || curState === 'LIGHT_SLEEP' || curState === 'RECOVERING')
          ) {
            nextState = 'DISTURBED';
          } else if (energy >= t.light && curState === 'DEEP_SLEEP') {
            nextState = 'LIGHT_SLEEP';
          } else {
            // De-escalation
            const holdOk = elapsedSinceChange > holdWindowMs;
            if (curState === 'ALMOST_AWAKE' && holdOk && energy < t.almost - 6) {
              nextState = energy >= t.disturbed - 5 ? 'DISTURBED' : 'RECOVERING';
            } else if (curState === 'DISTURBED' && holdOk && energy < t.disturbed - 6) {
              nextState = 'RECOVERING';
            } else if (curState === 'RECOVERING' && elapsedSinceChange > holdWindowMs + 150) {
              nextState = energy >= t.light ? 'LIGHT_SLEEP' : 'DEEP_SLEEP';
            } else if (curState === 'LIGHT_SLEEP' && holdOk && energy < t.light - 5) {
              nextState = 'DEEP_SLEEP';
            }
          }

          if (nextState !== curState) {
            applySleepState(nextState);
          }
        }

        // Live Star Portion Draining when noisy (DISTURBED / ALMOST_AWAKE / AWAKE)
        const activeState = sleepStateRef.current;
        if (
          !snap.isMicMuted &&
          (activeState === 'DISTURBED' || activeState === 'ALMOST_AWAKE' || activeState === 'AWAKE')
        ) {
          const drainPerSec =
            activeState === 'AWAKE' ? 0.28 : activeState === 'ALMOST_AWAKE' ? 0.17 : 0.085;
          starPointsRef.current = Math.max(0, starPointsRef.current - drainPerSec * dtSec);
        }

        // Throttle React UI updates cleanly (~20fps for meter, live star drain & spectrum)
        frameCounter += 1;
        if (frameCounter % 3 === 0) {
          setSustainedEnergy(energy);
          setRawLevel(rawInput);
          setStarPoints(starPointsRef.current);
          setEstimatedDb(snap.isMicMuted ? 0 : Math.round(30 + energy * 0.65));
          const bars = snap.isMicMuted
            ? Array(14).fill(12)
            : Array.from({ length: 14 }, (_, i) => {
                const val = freqData[i * 2 + 2] || 0;
                return Math.max(14, Math.min(100, Math.round((val / 190) * 100)));
              });
          setFreqBars(bars);
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [hasStarted, applySleepState]);

  // 1-second Quiet Clock / Countdown Timer & 1-Minute Quiet Star Additions
  useEffect(() => {
    if (!hasStarted) return;

    const id = window.setInterval(() => {
      const snap = stateSnapshotRef.current;
      const st = sleepStateRef.current;
      if (snap.isTimerPaused) return;

      // Advance Stopwatch or Edited Countdown Timer continuously unless manually paused
      setTimerSeconds((prev) => {
        if (snap.timerMode === 'countdown') {
          if (prev <= 0) return 0;
          if (prev === 1) {
            setTimerFinished(true);
            playAlertSound('star');
            spawnParticle('star', '🎉 ⭐', 1.55);
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });

      // Accumulate quiet seconds when calm; add +1 star every 60 quiet seconds!
      if (!snap.isMicMuted && (st === 'DEEP_SLEEP' || st === 'LIGHT_SLEEP' || st === 'RECOVERING')) {
        quietMinuteAccumRef.current += 1;
        if (quietMinuteAccumRef.current >= 60) {
          quietMinuteAccumRef.current = 0;
          const nextStars = Math.min(6, Math.round((starPointsRef.current + 1) * 100) / 100);
          if (nextStars > starPointsRef.current) {
            starPointsRef.current = nextStars;
            setStarPoints(nextStars);
            setStarSlots((slots) => Math.max(slots, Math.ceil(nextStars)));
            playAlertSound('star');
            spawnParticle('star', '+1 ⭐', 1.5);
          }
        }
      } else if (st === 'AWAKE') {
        quietMinuteAccumRef.current = 0;
      }
    }, 1000);

    return () => clearInterval(id);
  }, [hasStarted, playAlertSound, spawnParticle]);

  // Floating Zzz generator while sleeping peacefully
  useEffect(() => {
    if (!hasStarted) return;
    const id = window.setInterval(() => {
      const st = sleepStateRef.current;
      if (st === 'DEEP_SLEEP' || st === 'LIGHT_SLEEP' || st === 'RECOVERING') {
        const sizeRem =
          st === 'DEEP_SLEEP' ? 1.35 + Math.random() * 0.85 : 1.0 + Math.random() * 0.4;
        spawnParticle('z', 'Z', sizeRem);
      }
    }, 950);
    return () => clearInterval(id);
  }, [hasStarted, spawnParticle]);

  const connectMicrophoneStream = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    mediaStreamRef.current = stream;

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new Ctx();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.55;

    // Speech-band filtering (120Hz–4000Hz) removes sub-bass desk thumps and high-freq mic hiss
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 120;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4000;

    const source = ctx.createMediaStreamSource(stream);
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(analyser);

    analyserRef.current = analyser;
  };

  const handleStartWithMic = async () => {
    setMicError(null);
    setIsConnectingMic(true);
    try {
      await connectMicrophoneStream();
      sustainedRef.current = 8;
      sleepStateRef.current = 'DEEP_SLEEP';
      lastStateChangeRef.current = performance.now();
      starPointsRef.current = 3.0;
      quietMinuteAccumRef.current = 0;
      setSleepState('DEEP_SLEEP');
      setSustainedEnergy(8);
      setTimerMode('up');
      setTimerSeconds(0);
      setIsTimerPaused(false);
      setTimerFinished(false);
      setStarPoints(3.0);
      setStarSlots(3);
      setIsMicMuted(false);
      setHasStarted(true);
    } catch (err: any) {
      const msg =
        err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError'
          ? 'Microphone permission was blocked. Please allow microphone access in your browser bar and click Try Again.'
          : err?.name === 'NotFoundError'
          ? 'No microphone was detected. Please connect or enable a microphone and try again.'
          : 'Could not connect to your microphone. Please check browser audio permissions and try again.';
      setMicError(msg);
    } finally {
      setIsConnectingMic(false);
    }
  };

  const handleResetTimerAndStars = () => {
    sustainedRef.current = 8;
    sleepStateRef.current = 'DEEP_SLEEP';
    lastStateChangeRef.current = performance.now();
    starPointsRef.current = 3.0;
    quietMinuteAccumRef.current = 0;
    setSleepState('DEEP_SLEEP');
    setSustainedEnergy(8);
    setStarPoints(3.0);
    setStarSlots(3);
    setTimerFinished(false);
    setIsTimerPaused(false);
    setTimerSeconds(timerMode === 'countdown' ? countdownDuration : 0);
  };

  const syncEditFieldsFromSeconds = (baseSeconds: number) => {
    const safe = Math.max(0, baseSeconds);
    setEditHours(Math.min(23, Math.floor(safe / 3600)));
    setEditMinutes(Math.floor((safe % 3600) / 60));
    setEditSeconds(safe % 60);
  };

  const handleApplyEditedTimer = () => {
    const hrs = Math.max(0, Math.min(23, Number.isFinite(editHours) ? editHours : 0));
    const mins = Math.max(0, Math.min(59, Number.isFinite(editMinutes) ? editMinutes : 0));
    const secs = Math.max(0, Math.min(59, Number.isFinite(editSeconds) ? editSeconds : 0));
    const total = Math.max(1, hrs * 3600 + mins * 60 + secs);
    setTimerMode('countdown');
    setCountdownDuration(total);
    setTimerSeconds(total);
    setTimerFinished(false);
    setIsTimerPaused(false);
    setIsTimerMenuOpen(false);
  };

  const handleSwitchStopwatch = () => {
    setTimerMode('up');
    setTimerSeconds(0);
    setTimerFinished(false);
    setIsTimerPaused(false);
    setIsTimerMenuOpen(false);
  };

  const handleSelectTimerOption = (openEditor = true) => {
    const base = timerMode === 'countdown' ? timerSeconds : countdownDuration;
    syncEditFieldsFromSeconds(base);
    setTimerMode('countdown');
    setTimerSeconds(countdownDuration);
    setTimerFinished(false);
    setIsTimerPaused(false);
    if (openEditor) {
      setIsTimerMenuOpen(true);
    }
  };

  const setMicMutedState = (muted: boolean) => {
    setIsMicMuted(muted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  };

  const toggleMicMute = () => {
    setMicMutedState(!isMicMuted);
  };

  const handleSelectNoiseAlert = (mode: NoiseAlertMode) => {
    setNoiseAlert(mode);
    if (mode !== 'none') {
      playAlertSound('warning', mode, true);
    }
  };

  const handleMusicButtonClick = (trackId: number) => {
    if (activeMusicTrack === trackId) {
      setActiveMusicTrack(null);
      return;
    }
    if (!isMicMuted) {
      setPendingMusicTrack(trackId);
      return;
    }
    setActiveMusicTrack(trackId);
  };

  const handleConfirmMusicMicChoice = (turnOffMic: boolean) => {
    if (pendingMusicTrack === null) return;
    if (turnOffMic) {
      setMicMutedState(true);
    }
    setActiveMusicTrack(pendingMusicTrack);
    setPendingMusicTrack(null);
  };

  const handlePetHamster = () => {
    if (!hasStarted) return;
    spawnParticle('heart', '💖', 1.55);
    playAlertSound('pet');
    if (sleepStateRef.current === 'AWAKE') {
      sustainedRef.current = 8;
      recoveryHoldFramesRef.current = 0;
      setSustainedEnergy(8);
      applySleepState('RECOVERING');
      window.setTimeout(() => {
        if (sustainedRef.current < 24) {
          applySleepState('DEEP_SLEEP');
        }
      }, 1500);
    } else if (sustainedRef.current > 12) {
      sustainedRef.current = Math.max(8, sustainedRef.current - 16);
      setSustainedEnergy(sustainedRef.current);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const isDisturbedFace = sleepState === 'DISTURBED';
  const isAlmostAwakeFace = sleepState === 'ALMOST_AWAKE';
  const isCalmFace =
    sleepState === 'DEEP_SLEEP' || sleepState === 'LIGHT_SLEEP' || sleepState === 'RECOVERING';

  return (
    <div
      ref={containerRef}
      className={`w-full h-full min-h-[calc(100vh-4.5rem)] flex flex-col bg-gradient-to-b ${currentTheme.pageBg} text-[#e2d9f3] relative overflow-hidden select-none transition-colors duration-500`}
    >
      <style>{`
        @keyframes shEnclosureShake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-2px); }
          75% { transform: translateX(2px); }
        }
        @keyframes shBreatheCalm {
          0%, 100% { transform: scale(1, 1) translateY(0); }
          50% { transform: scale(1.03, 0.975) translateY(2px); }
        }
        @keyframes shBreatheFast {
          0%, 100% { transform: scale(1, 1) translateY(0); }
          50% { transform: scale(1.04, 0.96) translateY(2px); }
        }
        @keyframes shEarTwitch {
          0%, 88%, 100% { transform: rotate(0deg); }
          92% { transform: rotate(-14deg); }
          96% { transform: rotate(8deg); }
        }
        @keyframes shStarCalm {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes shStarNoisy {
          0%, 100% { transform: rotate(-18deg); }
          50% { transform: rotate(18deg); }
        }
        @keyframes shWheelRock {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(12deg); }
          70% { transform: rotate(-8deg); }
        }
        @keyframes shWheelSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes shWaterBubble {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          20% { opacity: 0.85; }
          90% { opacity: 0.85; }
          100% { transform: translateY(-95px) scale(1.25); opacity: 0; }
        }
        @keyframes shSnotBubble {
          0%, 100% { transform: scale(0.72) rotate(-3deg); opacity: 0.82; }
          50% { transform: scale(1.18) rotate(4deg); opacity: 0.96; }
        }
        @keyframes shShockPulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.14) rotate(3deg); }
        }
        @keyframes shFloatParticle {
          0% { transform: translateY(0) translateX(0) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(-105px) translateX(10px) scale(1.3); opacity: 0; }
        }
        @keyframes shDustFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.25; }
          50% { transform: translateY(-14px) translateX(8px); opacity: 0.7; }
        }
        @keyframes shSoundWavePulse {
          0% { transform: scale(0.85); opacity: 0.7; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes shFairyGlow {
          0%, 100% { opacity: 0.7; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.12); }
        }
        .sh-enclosure-shake { animation: shEnclosureShake 0.45s infinite; }
        .sh-body-calm { transform-origin: 500px 410px; animation: shBreatheCalm 4.2s ease-in-out infinite; }
        .sh-body-fast { transform-origin: 500px 410px; animation: shBreatheFast 1.4s ease-in-out infinite; }
        .sh-ear { transform-origin: 435px 285px; animation: shEarTwitch 4.5s infinite; }
        .sh-star-calm { transform-origin: 690px 40px; animation: shStarCalm 5s ease-in-out infinite; }
        .sh-star-noisy { transform-origin: 690px 40px; animation: shStarNoisy 1.1s ease-in-out infinite; }
        .sh-wheel-static { transform-origin: 295px 255px; }
        .sh-wheel-rock { transform-origin: 295px 255px; animation: shWheelRock 1.8s ease-in-out infinite; }
        .sh-wheel-spin { transform-origin: 295px 255px; animation: shWheelSpin 1.3s linear infinite; }
        .sh-water-bubble { animation: shWaterBubble 4.5s ease-in infinite; }
        .sh-snot-bubble { transform-origin: 486px 382px; animation: shSnotBubble 4.2s ease-in-out infinite; }
        .sh-shock-sparks { transform-origin: 555px 195px; animation: shShockPulse 0.45s ease-in-out infinite; }
        .sh-particle { animation: shFloatParticle ease-out forwards; }
        .sh-dust { animation: shDustFloat ease-in-out infinite; }
        .sh-wave-pulse { transform-origin: 495px 345px; animation: shSoundWavePulse 1.4s ease-out infinite; }
        .sh-fairy-bulb { animation: shFairyGlow 3.2s ease-in-out infinite; }
        @keyframes shStarDrainShake {
          0%, 100% { transform: scale(1) rotate(0deg); }
          25% { transform: scale(1.09) rotate(-6deg); }
          75% { transform: scale(1.06) rotate(6deg); }
        }
        .sh-star-drain { animation: shStarDrainShake 0.45s ease-in-out infinite; }
      `}</style>

      {/* CLEAN TOP HEADER: Left navigation & Themes/Options | Center Time & Individual Stars */}
      {hasStarted && (
        <header className="relative z-40 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-6 pt-3 pb-2 shrink-0">
          {/* Left Navigation, Theme & Coat Color Click Triggers */}
          <div className="flex items-center gap-2 justify-self-start">
            <button
              type="button"
              onClick={() => onViewChange('home')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-bold text-white/90 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            <button
              type="button"
              onClick={() => setThemeIndex((i) => (i + 1) % HABITAT_THEMES.length)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-bold text-white/95 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Click to switch Habitat Theme"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/65 shrink-0"
                style={{ backgroundColor: currentTheme.swatch }}
              />
              <span className="hidden md:inline">{currentTheme.name}</span>
              <Palette size={14} className="md:hidden" />
            </button>

            <button
              type="button"
              onClick={() => setCoatIndex((i) => (i + 1) % COAT_STYLES.length)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-bold text-amber-200 transition cursor-pointer whitespace-nowrap shrink-0"
              title="Click to switch Hamster Coat Color"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-white/60 shrink-0"
                style={{ backgroundColor: currentCoat.swatch }}
              />
              <span className="hidden xl:inline">{currentCoat.name}</span>
              <Palette size={14} className="xl:hidden" />
            </button>

            <button
              type="button"
              onClick={toggleFullScreen}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white/90 transition cursor-pointer shrink-0"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>

          {/* CENTER HUD: Bigger Stopwatch/Editable Timer + Bigger Individual Stars */}
          <div className={`relative justify-self-center ${currentTheme.panelBg} backdrop-blur-md border border-white/15 px-6 sm:px-7 py-3.5 rounded-3xl flex flex-wrap sm:flex-nowrap items-center justify-center gap-6 sm:gap-7 shadow-2xl`}>
            {/* Time + Mode Options (Stopwatch / Timer), Pause, Reset & Edit Timer Controls */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <div className="inline-flex items-center gap-1 bg-black/35 border border-white/10 rounded-lg p-0.5 mb-1.5 w-fit">
                  <button
                    type="button"
                    onClick={handleSwitchStopwatch}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer ${
                      timerMode === 'up'
                        ? 'bg-purple-500 text-white shadow-sm'
                        : 'text-purple-300/75 hover:text-white'
                    }`}
                  >
                    Stopwatch
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTimerOption(true)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider transition cursor-pointer ${
                      timerMode === 'countdown'
                        ? 'bg-amber-400 text-purple-950 shadow-sm'
                        : 'text-purple-300/75 hover:text-white'
                    }`}
                  >
                    {timerMode === 'countdown' && timerFinished ? 'Timer Done!' : 'Timer'}
                  </button>
                </div>
                <span
                  className={`${
                    (timerMode === 'countdown' && countdownDuration >= 3600) || timerSeconds >= 3600
                      ? 'text-3xl sm:text-4xl md:text-[2.7rem]'
                      : 'text-4xl sm:text-5xl md:text-[3.35rem]'
                  } font-black font-mono tabular-nums leading-none ${
                    timerFinished ? 'text-emerald-300 animate-pulse' : 'text-white'
                  }`}
                >
                  {formatTime(
                    timerSeconds,
                    timerMode === 'countdown' && countdownDuration >= 3600
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsTimerPaused((p) => !p)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-purple-100 transition cursor-pointer"
                  title={isTimerPaused ? 'Resume' : 'Pause'}
                >
                  {isTimerPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button
                  type="button"
                  onClick={handleResetTimerAndStars}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-purple-100 transition cursor-pointer"
                  title="Reset Time & Stars"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isTimerMenuOpen) {
                      const base = timerMode === 'countdown' ? timerSeconds : countdownDuration;
                      syncEditFieldsFromSeconds(base);
                    }
                    setIsTimerMenuOpen((o) => !o);
                  }}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    isTimerMenuOpen || timerMode === 'countdown'
                      ? 'bg-purple-500/35 border-purple-300/60 text-white'
                      : 'bg-white/10 hover:bg-white/20 border-white/10 text-purple-100'
                  }`}
                  title="Stopwatch / Timer Options"
                >
                  <Timer size={16} />
                </button>
              </div>
            </div>

            <div className="hidden sm:block h-12 w-px bg-white/15" />

            {/* Bigger Individual Stars (Default 3, No Numeric Count, Live Portion Draining when Noisy) */}
            <div
              className="flex items-center gap-2.5 sm:gap-3"
              title="Quiet for 1 minute adds a star. Noise drains the active star live!"
            >
              {Array.from({ length: starSlots }).map((_, idx) => {
                const fill = Math.max(0, Math.min(1, starPoints - idx));
                const isNoisyNow =
                  !isMicMuted &&
                  (sleepState === 'DISTURBED' ||
                    sleepState === 'ALMOST_AWAKE' ||
                    sleepState === 'AWAKE');
                const isActiveDrain =
                  isNoisyNow &&
                  fill > 0 &&
                  idx === Math.max(0, Math.ceil(starPoints) - 1);

                return (
                  <div
                    key={idx}
                    className={`relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center transition-transform duration-200 ${
                      isActiveDrain ? 'sh-star-drain' : ''
                    }`}
                  >
                    {isActiveDrain && (
                      <span className="absolute -top-2.5 right-0 text-xs font-black text-rose-400 animate-bounce pointer-events-none">
                        −
                      </span>
                    )}
                    <svg viewBox="0 0 24 24" className="w-full h-full overflow-visible">
                      <defs>
                        <clipPath id={`shStarFillClip-${idx}`}>
                          <rect
                            x="0"
                            y={24 * (1 - fill)}
                            width="24"
                            height={24 * fill}
                          />
                        </clipPath>
                      </defs>
                      {/* Empty / Drained Star Base */}
                      <path
                        d="M12 2.2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.1l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.2z"
                        fill="rgba(255,255,255,0.08)"
                        stroke={isActiveDrain ? 'rgba(251,113,133,0.75)' : 'rgba(251,191,36,0.35)'}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                      {/* Live Golden Portion Fill */}
                      {fill > 0 && (
                        <path
                          d="M12 2.2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.1l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2.2z"
                          fill={isActiveDrain ? '#fb923c' : '#fbbf24'}
                          stroke={isActiveDrain ? '#fecdd3' : '#fef08a'}
                          strokeWidth="1.4"
                          strokeLinejoin="round"
                          clipPath={`url(#shStarFillClip-${idx})`}
                          style={{
                            filter: isActiveDrain
                              ? 'drop-shadow(0 0 8px rgba(251,113,133,0.7))'
                              : 'drop-shadow(0 0 7px rgba(251,191,36,0.55))',
                          }}
                        />
                      )}
                    </svg>
                  </div>
                );
              })}
            </div>

            {/* Stopwatch / Editable Custom Timer Popover */}
            {isTimerMenuOpen && (
              <div className="absolute top-full mt-2.5 left-1/2 -translate-x-1/2 w-80 bg-[#1d113d]/98 border border-purple-300/30 rounded-2xl p-4 shadow-2xl z-50 text-left">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300 mb-2">
                  Clock Mode
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3.5">
                  <button
                    type="button"
                    onClick={handleSwitchStopwatch}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      timerMode === 'up'
                        ? 'bg-purple-500/45 text-white border border-purple-300/60'
                        : 'bg-white/5 text-purple-200 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <span>Stopwatch</span>
                    {timerMode === 'up' && <Check size={14} className="text-amber-300 shrink-0" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTimerOption(false)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                      timerMode === 'countdown'
                        ? 'bg-purple-500/45 text-white border border-purple-300/60'
                        : 'bg-white/5 text-purple-200 hover:bg-white/10 border border-white/10'
                    }`}
                  >
                    <span>Timer</span>
                    {timerMode === 'countdown' && (
                      <Check size={14} className="text-amber-300 shrink-0" />
                    )}
                  </button>
                </div>

                <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300 mb-2">
                  Set Timer Duration
                </div>
                <div className="flex items-center justify-center gap-1.5 mb-3.5">
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-bold text-purple-300/80 mb-1">
                      HR
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={editHours}
                      onChange={(e) =>
                        setEditHours(Math.max(0, Math.min(23, Number(e.target.value) || 0)))
                      }
                      aria-label="Timer hours"
                      className="w-16 text-center bg-black/40 border border-white/20 rounded-xl py-2 text-lg font-black font-mono text-white outline-none focus:border-purple-400"
                    />
                  </div>
                  <span className="text-2xl font-black text-purple-300 mt-4">:</span>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-bold text-purple-300/80 mb-1">
                      MIN
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={editMinutes}
                      onChange={(e) =>
                        setEditMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                      }
                      aria-label="Timer minutes"
                      className="w-16 text-center bg-black/40 border border-white/20 rounded-xl py-2 text-lg font-black font-mono text-white outline-none focus:border-purple-400"
                    />
                  </div>
                  <span className="text-2xl font-black text-purple-300 mt-4">:</span>
                  <div className="flex flex-col items-center">
                    <label className="text-[10px] font-bold text-purple-300/80 mb-1">
                      SEC
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={editSeconds}
                      onChange={(e) =>
                        setEditSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))
                      }
                      aria-label="Timer seconds"
                      className="w-16 text-center bg-black/40 border border-white/20 rounded-xl py-2 text-lg font-black font-mono text-white outline-none focus:border-purple-400"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleApplyEditedTimer}
                  className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-purple-950 font-black text-xs transition cursor-pointer"
                >
                  Start Timer
                </button>
              </div>
            )}
          </div>

          <div className="hidden md:block justify-self-end" />
        </header>
      )}

      {/* MAIN TWO-ZONE CLASSROOM WORKSPACE: Left Stage + Bottom Bar | Right Control Panel */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 px-4 md:px-6 pb-4 pt-1 min-h-0">
        {/* LEFT/CENTER STAGE + NOISE MONITOR BAR */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 gap-3">
          {/* LIVING 3D GLASS HAMSTER HABITAT */}
          <main className="flex-1 relative flex items-center justify-center min-h-[260px] pt-2">

            <div
              className={`relative w-full h-full max-h-[580px] rounded-[2.25rem] border-[5px] transition-all duration-300 flex items-center justify-center overflow-visible ${activeUi.enclosureBorder}`}
              style={{ backgroundColor: currentTheme.tankBg }}
            >
              {/* Top & Bottom Beveled Terrarium Rims */}
              <div
                className="absolute -top-5 left-[22%] right-[22%] h-3 rounded-t-xl border-t-2 border-white/35 z-20"
                style={{ background: currentTheme.capGradient }}
              />
              <div
                className="absolute -top-3 left-[1.5%] right-[1.5%] h-5 rounded-t-2xl rounded-b-md shadow-lg border-t border-white/30 z-20"
                style={{ background: currentTheme.rimTopGradient }}
              />
              <div
                className="absolute -bottom-3 left-[0.5%] right-[0.5%] h-7 rounded-b-3xl rounded-t-xl shadow-2xl border-b border-black/40 z-20"
                style={{ background: currentTheme.rimBottomGradient }}
              />

              {/* Glass Pillars */}
              <div className="absolute top-3 bottom-4 left-1.5 w-4 bg-gradient-to-r from-white/20 via-white/5 to-transparent border-r border-white/15 z-20 pointer-events-none" />
              <div className="absolute top-3 bottom-4 right-1.5 w-4 bg-gradient-to-l from-white/20 via-white/5 to-transparent border-l border-white/15 z-20 pointer-events-none" />

              {/* Inner Clipping Container */}
              <div
                className="relative w-full h-full overflow-hidden rounded-[2rem] flex items-center justify-center transition-colors duration-500"
                style={{ backgroundColor: currentTheme.tankBg }}
              >
                {/* Soft Ambient Fireflies / Dream Motes */}
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                  {AMBIENT_DUST_MOTES.map((m, idx) => (
                    <div
                      key={idx}
                      className="sh-dust absolute rounded-full"
                      style={{
                        left: m.left,
                        top: m.top,
                        width: `${m.size}px`,
                        height: `${m.size}px`,
                        animationDelay: m.delay,
                        animationDuration: m.dur,
                        backgroundColor: currentTheme.dustColor,
                        boxShadow: `0 0 12px ${currentTheme.dustColor}`,
                      }}
                    />
                  ))}
                </div>

                {/* Floating Zzz / Hearts / Stars */}
                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                  {particles.map((p) => (
                    <div
                      key={p.id}
                      className="sh-particle absolute bottom-[34%] font-black text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.85)]"
                      style={{
                        left: `${p.leftPct}%`,
                        fontSize: `${p.sizeRem}rem`,
                        animationDuration: `${p.durationSec}s`,
                      }}
                    >
                      {p.text}
                    </div>
                  ))}
                </div>

                {/* Interactive SVG Habitat & Character */}
                <svg
                  viewBox="0 0 1000 540"
                  preserveAspectRatio="xMidYMid meet"
                  className="w-full h-full select-none"
                >
                  <defs>
                    <filter id="shSoftShadow" x="-15%" y="-15%" width="130%" height="135%">
                      <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#090314" floodOpacity="0.55" />
                    </filter>
                    <filter id="shFurShadow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#0d051a" floodOpacity="0.65" />
                    </filter>
                    <filter id="shWarmLamp" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="24" />
                    </filter>

                    <radialGradient id="shAmbientGlow" cx="50%" cy="56%" r="65%">
                      <stop offset="0%" stopColor={activeUi.glowColor} stopOpacity="0.24" />
                      <stop offset="100%" stopColor={currentTheme.tankBg} stopOpacity="0" />
                    </radialGradient>

                    <linearGradient id="shWindowSkyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.windowSky[0]} />
                      <stop offset="100%" stopColor={currentTheme.windowSky[1]} />
                    </linearGradient>

                    <radialGradient id="shFurGrad" cx="42%" cy="30%" r="68%">
                      <stop offset="0%" stopColor={currentCoat.body[0]} />
                      <stop offset="50%" stopColor={currentCoat.body[1]} />
                      <stop offset="100%" stopColor={currentCoat.body[2]} />
                    </radialGradient>
                    <radialGradient id="shFurHeadGrad" cx="45%" cy="35%" r="65%">
                      <stop offset="0%" stopColor={currentCoat.head[0]} />
                      <stop offset="65%" stopColor={currentCoat.head[1]} />
                      <stop offset="100%" stopColor={currentCoat.head[2]} />
                    </radialGradient>
                    <radialGradient id="shCheekGrad" cx="45%" cy="40%" r="60%">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="75%" stopColor="#fdf2e9" />
                      <stop offset="100%" stopColor="#e8cfc1" />
                    </radialGradient>
                    <radialGradient id="shPinkNose" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor="#fbcfe8" />
                      <stop offset="55%" stopColor="#f472b6" />
                      <stop offset="100%" stopColor="#be185d" />
                    </radialGradient>
                    <linearGradient id="shSleepMaskGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#fef08a" />
                      <stop offset="55%" stopColor="#facc15" />
                      <stop offset="100%" stopColor="#ca8a04" />
                    </linearGradient>
                    <radialGradient id="shSnotBubbleGrad" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="rgba(255, 255, 255, 0.92)" />
                      <stop offset="45%" stopColor="rgba(147, 197, 253, 0.65)" />
                      <stop offset="85%" stopColor="rgba(59, 130, 246, 0.45)" />
                      <stop offset="100%" stopColor="rgba(191, 219, 254, 0.8)" />
                    </radialGradient>

                    <linearGradient id="shWoodHouse" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.woodHouse[0]} />
                      <stop offset="55%" stopColor={currentTheme.woodHouse[1]} />
                      <stop offset="100%" stopColor={currentTheme.woodHouse[2]} />
                    </linearGradient>
                    <linearGradient id="shWoodRoof" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.woodRoof[0]} />
                      <stop offset="50%" stopColor={currentTheme.woodRoof[1]} />
                      <stop offset="100%" stopColor={currentTheme.woodRoof[2]} />
                    </linearGradient>
                    <linearGradient id="shWheelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.wheelColors[0]} />
                      <stop offset="50%" stopColor={currentTheme.wheelColors[1]} />
                      <stop offset="100%" stopColor={currentTheme.wheelColors[2]} />
                    </linearGradient>
                    <linearGradient id="shWheelDrum" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.wheelColors[2]} />
                      <stop offset="50%" stopColor={currentTheme.wheelColors[1]} />
                      <stop offset="100%" stopColor={currentTheme.wheelColors[2]} />
                    </linearGradient>
                    <linearGradient id="shGlassBottle" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="rgba(255,255,255,0.45)" />
                      <stop offset="28%" stopColor="rgba(255,255,255,0.12)" />
                      <stop offset="75%" stopColor="rgba(255,255,255,0.14)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0.38)" />
                    </linearGradient>
                    <linearGradient id="shBeddingBase" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={currentTheme.beddingGrad[0]} />
                      <stop offset="48%" stopColor={currentTheme.beddingGrad[1]} />
                      <stop offset="100%" stopColor={currentTheme.beddingGrad[2]} />
                    </linearGradient>
                    <radialGradient id="shPuff0" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor={currentTheme.puffColors[0]} />
                      <stop offset="70%" stopColor={currentTheme.beddingGrad[1]} />
                      <stop offset="100%" stopColor={currentTheme.beddingGrad[2]} stopOpacity="0.9" />
                    </radialGradient>
                    <radialGradient id="shPuff1" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor={currentTheme.puffColors[1]} />
                      <stop offset="72%" stopColor={currentTheme.beddingMid} />
                      <stop offset="100%" stopColor={currentTheme.beddingGrad[2]} stopOpacity="0.88" />
                    </radialGradient>
                    <radialGradient id="shPuff2" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor={currentTheme.puffColors[2]} />
                      <stop offset="72%" stopColor={currentTheme.beddingGrad[1]} />
                      <stop offset="100%" stopColor={currentTheme.beddingGrad[2]} stopOpacity="0.88" />
                    </radialGradient>
                    <radialGradient id="shHouseWarmth" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.48" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                    </radialGradient>
                    <clipPath id="shWindowClip">
                      <rect x="365" y="20" width="270" height="172" rx="22" />
                    </clipPath>
                  </defs>

                  <rect width="1000" height="540" fill="url(#shAmbientGlow)" />
                  <circle cx="920" cy="195" r="170" fill={currentTheme.fairyColor} opacity="0.09" filter="url(#shWarmLamp)" />

                  {/* Theme-Specific Scenic Window */}
                  <g opacity="0.82">
                    <rect x="365" y="20" width="270" height="172" rx="22" fill="url(#shWindowSkyGrad)" />
                    <g clipPath="url(#shWindowClip)">
                      {currentTheme.id === 'midnight' && (
                        <g>
                          <circle cx="578" cy="68" r="24" fill="#fef08a" />
                          <circle cx="567" cy="60" r="22" fill={currentTheme.windowSky[0]} />
                          <circle cx="410" cy="52" r="2.6" fill="#fff" />
                          <circle cx="465" cy="44" r="2" fill="#fde68a" />
                          <circle cx="435" cy="136" r="2.8" fill="#e9d5ff" />
                          <circle cx="545" cy="145" r="2.2" fill="#fff" />
                          <circle cx="605" cy="126" r="2" fill="#fde68a" />
                        </g>
                      )}
                      {currentTheme.id === 'sakura' && (
                        <g>
                          <circle cx="568" cy="76" r="26" fill="#fbcfe8" opacity="0.85" />
                          <path d="M 360 155 Q 430 120 510 148 T 640 135 L 640 198 L 360 198 Z" fill="#3a1030" opacity="0.65" />
                          <ellipse cx="418" cy="62" rx="7" ry="4" transform="rotate(-25 418 62)" fill="#f9a8d4" />
                          <ellipse cx="474" cy="90" rx="6" ry="3.5" transform="rotate(20 474 90)" fill="#fbcfe8" />
                          <ellipse cx="520" cy="52" rx="6" ry="3.5" transform="rotate(-15 520 52)" fill="#f472b6" />
                          <ellipse cx="445" cy="140" rx="7" ry="4" transform="rotate(35 445 140)" fill="#f9a8d4" />
                        </g>
                      )}
                      {currentTheme.id === 'forest' && (
                        <g>
                          <circle cx="578" cy="66" r="21" fill="#ecfccb" opacity="0.88" />
                          <polygon points="390,192 422,102 454,192" fill="#052e16" />
                          <polygon points="440,192 478,86 516,192" fill="#064e3b" />
                          <polygon points="518,192 554,114 590,192" fill="#052e16" />
                          <circle cx="425" cy="72" r="3" fill="#bef264" />
                          <circle cx="515" cy="62" r="2.5" fill="#fde047" />
                          <circle cx="545" cy="122" r="3" fill="#bef264" />
                        </g>
                      )}
                      {currentTheme.id === 'sunrise' && (
                        <g>
                          <circle cx="500" cy="148" r="44" fill="#fde047" opacity="0.78" />
                          <g fill="#fff7ed" opacity="0.72">
                            <circle cx="415" cy="68" r="18" />
                            <circle cx="436" cy="64" r="22" />
                            <circle cx="458" cy="70" r="16" />
                            <circle cx="556" cy="84" r="15" />
                            <circle cx="575" cy="80" r="19" />
                            <circle cx="596" cy="86" r="14" />
                          </g>
                        </g>
                      )}
                      {currentTheme.id === 'ocean' && (
                        <g>
                          <circle cx="575" cy="65" r="22" fill="#e0f2fe" opacity="0.88" />
                          <path d="M 360 146 Q 425 130 495 146 T 640 140 L 640 198 L 360 198 Z" fill="#075985" opacity="0.75" />
                          <circle cx="420" cy="82" r="5" fill="none" stroke="#bae6fd" strokeWidth="2" opacity="0.75" />
                          <circle cx="468" cy="114" r="3.5" fill="none" stroke="#bae6fd" strokeWidth="1.8" opacity="0.65" />
                          <circle cx="534" cy="125" r="4.5" fill="none" stroke="#bae6fd" strokeWidth="1.8" opacity="0.7" />
                        </g>
                      )}
                      {/* Diagonal glass shine */}
                      <polygon points="392,20 435,20 375,192 365,192" fill="rgba(255,255,255,0.06)" />
                    </g>
                    <rect x="365" y="20" width="270" height="172" rx="22" fill="none" stroke={currentTheme.windowFrame} strokeWidth="6" />
                    <line x1="500" y1="20" x2="500" y2="192" stroke={currentTheme.windowMullion} strokeWidth="4.5" />
                    <line x1="365" y1="106" x2="635" y2="106" stroke={currentTheme.windowMullion} strokeWidth="4.5" />
                  </g>

                  {/* Edge-to-Edge Background Bedding Hills (zero vertical edge cutoffs!) */}
                  <path
                    d="M -15 398 Q 165 344 345 380 T 680 368 T 1015 394 L 1015 545 L -15 545 Z"
                    fill={currentTheme.beddingBack}
                    opacity="0.72"
                  />
                  <path
                    d="M -15 415 Q 220 372 430 398 T 830 384 T 1015 410 L 1015 545 L -15 545 Z"
                    fill={currentTheme.beddingMid}
                    opacity="0.86"
                  />

                  {/* Exercise Wheel */}
                  <g transform="translate(8, 6)" filter="url(#shSoftShadow)">
                    <path d="M 222 426 L 295 255 L 368 426" fill="none" stroke={currentTheme.wheelColors[2]} strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="198" y="416" width="194" height="18" rx="9" fill={currentTheme.wheelColors[1]} stroke={currentTheme.wheelColors[0]} strokeWidth="2" />
                    <g
                      className={
                        sleepState === 'AWAKE'
                          ? 'sh-wheel-spin'
                          : isDisturbedFace || isAlmostAwakeFace
                          ? 'sh-wheel-rock'
                          : 'sh-wheel-static'
                      }
                    >
                      <ellipse cx="307" cy="255" rx="114" ry="118" fill="url(#shWheelDrum)" />
                      <circle cx="295" cy="255" r="118" fill="#090314" opacity="0.45" />
                      <g stroke={currentTheme.wheelColors[0]} strokeWidth="3.5" opacity="0.55">
                        <line x1="295" y1="138" x2="295" y2="372" />
                        <line x1="178" y1="255" x2="412" y2="255" />
                        <line x1="212" y1="172" x2="378" y2="338" />
                        <line x1="378" y1="172" x2="212" y2="338" />
                        <line x1="250" y1="147" x2="340" y2="363" />
                        <line x1="187" y1="210" x2="403" y2="300" />
                        <line x1="187" y1="300" x2="403" y2="210" />
                        <line x1="340" y1="147" x2="250" y2="363" />
                      </g>
                      <circle cx="295" cy="255" r="115" fill="none" stroke={currentTheme.wheelColors[2]} strokeWidth="20" />
                      <circle cx="295" cy="255" r="115" fill="none" stroke="url(#shWheelGrad)" strokeWidth="13" />
                      <path d="M 205 182 A 115 115 0 0 1 380 178" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="4" strokeLinecap="round" />
                      <circle cx="295" cy="255" r="26" fill={currentTheme.wheelColors[1]} stroke={currentTheme.wheelColors[2]} strokeWidth="5" />
                      <circle cx="295" cy="255" r="15" fill={currentTheme.wheelColors[3]} />
                      <circle cx="291" cy="251" r="5" fill="#ffffff" opacity="0.85" />
                    </g>
                  </g>

                  {/* Water Bottle */}
                  <g transform="translate(52, 112)" filter="url(#shSoftShadow)">
                    <path d="M 42 185 L 76 226" stroke="#94a3b8" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 42 183 L 75 224" stroke="#f1f5f9" strokeWidth="4" strokeLinecap="round" />
                    <circle cx="80" cy="230" r="6" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
                    <path d="M 80 236 C 77 242 76 247 80 248 C 84 247 83 242 80 236 Z" fill="#7dd3fc" opacity="0.9" />
                    <rect x="8" y="0" width="60" height="170" rx="28" fill="url(#shGlassBottle)" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" />
                    <rect x="12" y="38" width="52" height="125" rx="22" fill="rgba(56, 189, 248, 0.36)" />
                    <ellipse cx="38" cy="38" rx="26" ry="7" fill="rgba(186, 230, 253, 0.72)" />
                    <circle cx="32" cy="145" r="4" fill="rgba(255,255,255,0.75)" className="sh-water-bubble" />
                    <g stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round">
                      <line x1="52" y1="55" x2="60" y2="55" />
                      <line x1="52" y1="80" x2="60" y2="80" />
                      <line x1="52" y1="105" x2="60" y2="105" />
                      <line x1="52" y1="130" x2="60" y2="130" />
                    </g>
                    <rect x="16" y="12" width="7" height="135" rx="3.5" fill="rgba(255,255,255,0.45)" />
                    <rect x="4" y="96" width="68" height="18" rx="7" fill={currentTheme.bottleAccent} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                    <rect x="-8" y="99" width="16" height="12" rx="4" fill={currentTheme.bottleCap} />
                    <rect x="14" y="152" width="48" height="34" rx="9" fill={currentTheme.bottleCap} stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  </g>

                  {/* Cozy Wooden Cabin + Porch Lantern */}
                  <g transform="translate(620, 198)" filter="url(#shSoftShadow)">
                    <ellipse cx="140" cy="222" rx="145" ry="22" fill="rgba(0,0,0,0.45)" />
                    <polygon points="242,88 272,72 262,198 235,215" fill={currentTheme.woodHouse[2]} stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinejoin="round" />
                    <path d="M 25 88 L 242 88 L 235 215 L 35 215 Z" fill="url(#shWoodHouse)" stroke={currentTheme.woodHouse[2]} strokeWidth="3" strokeLinejoin="round" />
                    <line x1="30" y1="120" x2="239" y2="120" stroke={currentTheme.woodHouse[2]} strokeWidth="2" opacity="0.45" />
                    <line x1="32" y1="152" x2="238" y2="152" stroke={currentTheme.woodHouse[2]} strokeWidth="2" opacity="0.45" />
                    <line x1="34" y1="184" x2="236" y2="184" stroke={currentTheme.woodHouse[2]} strokeWidth="2" opacity="0.45" />
                    <path d="M 82 215 L 82 142 A 44 42 0 0 1 170 142 L 170 215 Z" fill="#241208" stroke={currentTheme.woodHouse[2]} strokeWidth="4" />
                    <path d="M 204 128 C 204 123 197 118 193 123 C 189 128 204 138 204 138 C 204 138 219 128 215 123 C 211 118 204 123 204 128 Z" fill="#3b1d0c" stroke={currentTheme.woodHouse[2]} strokeWidth="2" />
                    <circle
                      cx="126"
                      cy="178"
                      r="64"
                      fill="url(#shHouseWarmth)"
                      opacity={
                        sleepState === 'DEEP_SLEEP' || sleepState === 'RECOVERING'
                          ? 0.95
                          : sleepState === 'LIGHT_SLEEP'
                          ? 0.6
                          : isDisturbedFace
                          ? 0.35
                          : isAlmostAwakeFace
                          ? 0.15
                          : 0
                      }
                    />
                    <polygon points="215,20 250,12 286,76 260,95" fill={currentTheme.woodRoof[2]} stroke="rgba(0,0,0,0.35)" strokeWidth="2.5" strokeLinejoin="round" />
                    <path d="M 8 95 L 54 20 L 218 20 L 260 95 Z" fill="url(#shWoodRoof)" stroke={currentTheme.woodRoof[2]} strokeWidth="3.5" strokeLinejoin="round" />
                    <line x1="32" y1="58" x2="238" y2="58" stroke={currentTheme.woodRoof[2]} strokeWidth="2" opacity="0.45" />
                    <line x1="45" y1="38" x2="226" y2="38" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
                    {/* Warm Hanging Porch Lantern */}
                    <g transform="translate(52, 95)">
                      <line x1="0" y1="0" x2="0" y2="14" stroke="#451a03" strokeWidth="2.5" />
                      <circle cx="0" cy="24" r="18" fill={currentTheme.fairyGlow} opacity="0.55" />
                      <rect x="-7" y="14" width="14" height="18" rx="4" fill="#fef08a" stroke="#78350f" strokeWidth="2" />
                    </g>
                  </g>

                  {/* Hanging Plush Star Toy */}
                  <g
                    className={
                      isDisturbedFace || isAlmostAwakeFace || sleepState === 'AWAKE'
                        ? 'sh-star-noisy'
                        : 'sh-star-calm'
                    }
                  >
                    <circle cx="690" cy="14" r="7" fill="none" stroke="#fbbf24" strokeWidth="4" />
                    <line x1="690" y1="20" x2="690" y2="122" stroke="#fcd34d" strokeWidth="4.5" strokeDasharray="7 5" strokeLinecap="round" />
                    <g transform="translate(690, 148)">
                      <polygon
                        points="0,-38 12,-13 39,-8 20,12 24,38 0,25 -24,38 -20,12 -39,-8 -12,-13"
                        fill="#fbbf24"
                        stroke="#fef08a"
                        strokeWidth="3.5"
                        strokeLinejoin="round"
                      />
                      <ellipse cx="-12" cy="3" rx="4" ry="2.5" fill="#f97316" opacity="0.55" />
                      <ellipse cx="12" cy="3" rx="4" ry="2.5" fill="#f97316" opacity="0.55" />
                      <circle cx="-8" cy="-3" r="2.8" fill="#451a03" />
                      <circle cx="8" cy="-3" r="2.8" fill="#451a03" />
                      <path d="M -4 5 Q 0 9 4 5" fill="none" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />
                    </g>
                  </g>

                  {/* Soft Shaded Mid-ground Bedding Puffs (edge-to-edge cozy nest) */}
                  <g filter="url(#shSoftShadow)">
                    <circle cx="38" cy="434" r="42" fill="url(#shPuff1)" />
                    <circle cx="110" cy="428" r="42" fill="url(#shPuff0)" />
                    <circle cx="182" cy="422" r="46" fill="url(#shPuff1)" />
                    <circle cx="255" cy="435" r="40" fill="url(#shPuff2)" />
                    <circle cx="335" cy="425" r="46" fill="url(#shPuff0)" />
                    <circle cx="405" cy="434" r="36" fill="url(#shPuff1)" />
                    <circle cx="622" cy="430" r="42" fill="url(#shPuff0)" />
                    <circle cx="705" cy="434" r="40" fill="url(#shPuff1)" />
                    <circle cx="795" cy="424" r="46" fill="url(#shPuff2)" />
                    <circle cx="885" cy="434" r="42" fill="url(#shPuff0)" />
                    <circle cx="965" cy="430" r="44" fill="url(#shPuff1)" />
                  </g>

                  {/* Sound Wave Disturbance Ripples around Hamster when Noisy */}
                  {(isDisturbedFace || isAlmostAwakeFace) && (
                    <circle
                      cx="495"
                      cy="345"
                      r="155"
                      fill="none"
                      stroke={isAlmostAwakeFace ? '#fb923c' : '#fbbf24'}
                      strokeWidth="4"
                      strokeDasharray="12 10"
                      className="sh-wave-pulse"
                    />
                  )}

                  {/* LIVING HAMSTER CHARACTER (Click to Pet / Soothe) */}
                  <g
                    onClick={handlePetHamster}
                    className={`${
                      isDisturbedFace || isAlmostAwakeFace ? 'sh-body-fast' : 'sh-body-calm'
                    } cursor-pointer`}
                    filter="url(#shFurShadow)"
                  >
                    <title>Click to gently pet & soothe the hamster!</title>
                    <ellipse cx="496" cy="438" rx="155" ry="30" fill="rgba(16, 6, 38, 0.7)" />

                    {sleepState !== 'AWAKE' ? (
                      /* SLEEPING / DISTURBED / ALMOST AWAKE POSTURE */
                      <g>
                        <g className="sh-ear">
                          <circle cx="386" cy="292" r="34" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="388" cy="295" r="21" fill="#f48fb1" />
                          <path d="M 375 292 Q 388 278 398 294" fill="none" stroke="#f8bbd0" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
                        </g>
                        <g>
                          <circle cx="536" cy="272" r="33" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="534" cy="275" r="20" fill="#f48fb1" />
                          <path d="M 523 272 Q 535 260 544 275" fill="none" stroke="#f8bbd0" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
                        </g>

                        {/* Body & Cheek Fur */}
                        <path
                          d="M 342 430 C 330 342, 382 268, 468 265 C 555 262, 622 325, 628 422 C 610 448, 370 450, 342 430 Z"
                          fill="url(#shFurGrad)"
                          stroke="#6b2710"
                          strokeWidth="4"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M 355 426 C 344 372, 388 338, 435 344 C 455 346, 476 346, 498 340 C 546 328, 594 358, 588 418 C 562 446, 385 448, 355 426 Z"
                          fill="url(#shCheekGrad)"
                        />

                        {/* Soft Cute Whiskers */}
                        <g stroke="#9a6b52" strokeWidth="2.4" strokeLinecap="round" opacity="0.55">
                          <line x1="366" y1="382" x2="340" y2="378" />
                          <line x1="368" y1="393" x2="342" y2="397" />
                          <line x1="576" y1="364" x2="602" y2="358" />
                          <line x1="576" y1="375" x2="603" y2="378" />
                        </g>

                        {/* Bear Sleep Mask (lifts cleanly when Disturbed / Almost Awake) */}
                        <g
                          transform={
                            isDisturbedFace
                              ? 'translate(0, -14) rotate(-2 465 295)'
                              : isAlmostAwakeFace
                              ? 'translate(0, -24) rotate(-4 465 295)'
                              : undefined
                          }
                        >
                          <path d="M 348 370 Q 356 335 376 318" fill="none" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
                          <path d="M 348 370 Q 356 335 376 318" fill="none" stroke="#713f12" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
                          <path d="M 554 308 Q 582 325 598 354" fill="none" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
                          <circle cx="404" cy="276" r="15" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <circle cx="512" cy="264" r="15" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <path d="M 372 324 C 362 288, 408 262, 462 258 C 516 254, 560 274, 558 308 C 556 328, 524 328, 496 318 C 474 310, 456 314, 434 328 C 408 344, 378 344, 372 324 Z" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.8" strokeLinejoin="round" />
                          <path d="M 392 292 Q 455 266 528 278" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="4.5" strokeLinecap="round" />
                          <circle cx="442" cy="292" r="4" fill="#451a03" />
                          <circle cx="486" cy="286" r="4" fill="#451a03" />
                          <ellipse cx="464" cy="291" rx="4.5" ry="3" fill="#451a03" />
                          <path d="M 456 297 Q 460 302 464 295 Q 469 301 473 295" fill="none" stroke="#451a03" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                        </g>

                        {/* Rosy Cheeks */}
                        <g>
                          <ellipse cx="398" cy="392" rx="22" ry="12" transform="rotate(-8 398 392)" fill="#fda4af" opacity="0.78" />
                          <line x1="391" y1="396" x2="397" y2="387" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <line x1="400" y1="397" x2="406" y2="388" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <ellipse cx="546" cy="374" rx="21" ry="11.5" transform="rotate(-8 546 374)" fill="#fda4af" opacity="0.78" />
                          <line x1="539" y1="378" x2="545" y2="369" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <line x1="548" y1="379" x2="554" y2="370" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                        </g>

                        {/* EYES BY STATE */}
                        {isCalmFace && (
                          <g>
                            <path d="M 408 358 Q 427 372 444 354" fill="none" stroke="#3b1106" strokeWidth="5.5" strokeLinecap="round" />
                            <path d="M 492 346 Q 511 360 528 342" fill="none" stroke="#3b1106" strokeWidth="5.5" strokeLinecap="round" />
                          </g>
                        )}

                        {isDisturbedFace && (
                          <g>
                            <line x1="404" y1="330" x2="444" y2="342" stroke="#5c1f08" strokeWidth="5.5" strokeLinecap="round" />
                            <line x1="534" y1="316" x2="494" y2="334" stroke="#5c1f08" strokeWidth="5.5" strokeLinecap="round" />
                            <path
                              d="M 410 347 L 439 356 L 412 367"
                              fill="none"
                              stroke="#3b1106"
                              strokeWidth="5.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="513" cy="347" r="14" fill="#2d1206" />
                            <circle cx="508" cy="341" r="5" fill="#ffffff" />
                            <circle cx="518" cy="352" r="2.2" fill="#ffffff" opacity="0.85" />
                            <path
                              d="M 556 320 C 550 331, 548 339, 556 341 C 564 339, 562 331, 556 320 Z"
                              fill="#7dd3fc"
                              stroke="#e0f2fe"
                              strokeWidth="1.5"
                            />
                          </g>
                        )}

                        {isAlmostAwakeFace && (
                          <g>
                            <circle cx="426" cy="356" r="14.5" fill="#2d1206" />
                            <circle cx="421" cy="350" r="5.2" fill="#ffffff" />
                            <circle cx="431" cy="361" r="2.2" fill="#ffffff" />
                            <circle cx="510" cy="346" r="14.5" fill="#2d1206" />
                            <circle cx="505" cy="340" r="5.2" fill="#ffffff" />
                            <circle cx="515" cy="351" r="2.2" fill="#ffffff" />
                            <line x1="406" y1="326" x2="444" y2="338" stroke="#5c1f08" strokeWidth="5.5" strokeLinecap="round" />
                            <line x1="532" y1="312" x2="494" y2="328" stroke="#5c1f08" strokeWidth="5.5" strokeLinecap="round" />
                          </g>
                        )}

                        {/* Nose & Mouth */}
                        <path d="M 462 365 C 462 359, 480 358, 480 364 C 480 370, 474 375, 471 375 C 468 375, 462 371, 462 365 Z" fill="url(#shPinkNose)" />
                        {isDisturbedFace ? (
                          <path
                            d="M 448 392 Q 459 382 471 390 Q 483 398 494 386"
                            fill="none"
                            stroke="#451a03"
                            strokeWidth="4.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : isAlmostAwakeFace ? (
                          <ellipse cx="472" cy="389" rx="11" ry="8" fill="#7f1d1d" stroke="#451a03" strokeWidth="3.5" />
                        ) : (
                          <path d="M 455 382 Q 464 391 471 375 Q 479 389 488 379" fill="none" stroke="#451a03" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
                        )}

                        {/* Sleep Bubble during Deep / Light Sleep */}
                        {(sleepState === 'DEEP_SLEEP' || sleepState === 'LIGHT_SLEEP') && (
                          <g className="sh-snot-bubble">
                            <path d="M 486 382 C 502 364, 544 352, 550 380 C 556 406, 516 420, 496 394 Z" fill="url(#shSnotBubbleGrad)" stroke="rgba(147, 197, 253, 0.85)" strokeWidth="2.2" />
                            <ellipse cx="528" cy="371" rx="8" ry="5" transform="rotate(-20 528 371)" fill="#ffffff" opacity="0.85" />
                            <circle cx="538" cy="384" r="3" fill="#ffffff" opacity="0.65" />
                          </g>
                        )}

                        {/* Paws */}
                        {isDisturbedFace ? (
                          <g>
                            <g transform="translate(362, 342) rotate(-22)">
                              <ellipse cx="0" cy="0" rx="18" ry="22" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                              <path d="M -6 -13 L -6 -4 M 0 -15 L 0 -4 M 6 -13 L 6 -4" stroke="#9f1239" strokeWidth="2.4" strokeLinecap="round" />
                            </g>
                            <g transform="translate(572, 326) rotate(22)">
                              <ellipse cx="0" cy="0" rx="18" ry="22" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                              <path d="M -6 -13 L -6 -4 M 0 -15 L 0 -4 M 6 -13 L 6 -4" stroke="#9f1239" strokeWidth="2.4" strokeLinecap="round" />
                            </g>
                          </g>
                        ) : (
                          <g>
                            <g transform="translate(425, 424) rotate(-10)">
                              <path d="M -22 12 C -24 -10, 24 -10, 22 12 Z" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                              <path d="M -7 -5 L -7 4 M 2 -6 L 2 4 M 11 -4 L 11 4" stroke="#9f1239" strokeWidth="2.6" strokeLinecap="round" />
                            </g>
                            <g transform="translate(518, 416) rotate(-12)">
                              <path d="M -22 12 C -24 -10, 24 -10, 22 12 Z" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                              <path d="M -7 -5 L -7 4 M 2 -6 L 2 4 M 11 -4 L 11 4" stroke="#9f1239" strokeWidth="2.6" strokeLinecap="round" />
                            </g>
                          </g>
                        )}
                      </g>
                    ) : (
                      /* STARTLED AWAKE POSTURE */
                      <g>
                        <g className="sh-shock-sparks">
                          <polygon points="534,195 524,132 548,130 546,194" fill="#facc15" stroke="#713f12" strokeWidth="3.5" strokeLinejoin="round" />
                          <polygon points="558,205 588,146 610,160 568,214" fill="#facc15" stroke="#713f12" strokeWidth="3.5" strokeLinejoin="round" />
                          <polygon points="572,226 618,204 625,224 576,238" fill="#facc15" stroke="#713f12" strokeWidth="3.5" strokeLinejoin="round" />
                          <line x1="388" y1="218" x2="365" y2="195" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                          <line x1="408" y1="208" x2="398" y2="176" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
                        </g>

                        <g>
                          <circle cx="382" cy="264" r="36" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="385" cy="267" r="23" fill="#f48fb1" />
                          <circle cx="534" cy="236" r="34" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="532" cy="240" r="21" fill="#f48fb1" />
                        </g>

                        <path d="M 352 435 C 344 330, 385 235, 472 232 C 556 230, 608 310, 604 432 Z" fill="url(#shFurGrad)" stroke="#6b2710" strokeWidth="4" strokeLinejoin="round" />
                        <path d="M 380 432 C 372 352, 405 312, 456 315 C 485 316, 505 308, 535 304 C 584 298, 604 350, 588 430 Z" fill="url(#shCheekGrad)" />

                        {/* Pushed-Up Bear Sleep Mask on Forehead */}
                        <g>
                          <path d="M 355 348 Q 375 295 402 268" fill="none" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
                          <path d="M 355 348 Q 375 295 402 268" fill="none" stroke="#713f12" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
                          <circle cx="424" cy="226" r="14" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <circle cx="516" cy="218" r="14" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <path d="M 398 268 C 392 234, 430 212, 478 210 C 525 208, 562 228, 558 256 C 555 272, 526 266, 502 258 C 480 252, 460 256, 440 268 C 418 280, 402 282, 398 268 Z" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.8" strokeLinejoin="round" />
                          <path d="M 416 240 Q 475 218 534 232" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="4" strokeLinecap="round" />
                          <circle cx="458" cy="236" r="3.8" fill="#451a03" />
                          <circle cx="496" cy="232" r="3.8" fill="#451a03" />
                          <ellipse cx="477" cy="236" rx="4" ry="2.6" fill="#451a03" />
                          <path d="M 470 241 Q 474 246 477 240 Q 481 245 485 240" fill="none" stroke="#451a03" strokeWidth="2.5" strokeLinecap="round" />
                        </g>

                        {/* Cheeks */}
                        <g>
                          <ellipse cx="424" cy="348" rx="22" ry="12" transform="rotate(-10 424 348)" fill="#fda4af" opacity="0.82" />
                          <line x1="417" y1="352" x2="423" y2="343" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <line x1="426" y1="353" x2="432" y2="344" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <ellipse cx="562" cy="332" rx="20" ry="11" transform="rotate(-10 562 332)" fill="#fda4af" opacity="0.82" />
                          <line x1="555" y1="336" x2="561" y2="327" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                          <line x1="564" y1="337" x2="570" y2="328" stroke="#f43f5e" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
                        </g>

                        {/* Startled Eyes & Shocked Mouth */}
                        <line x1="432" y1="286" x2="466" y2="298" stroke="#5c1f08" strokeWidth="5" strokeLinecap="round" />
                        <line x1="538" y1="270" x2="510" y2="288" stroke="#5c1f08" strokeWidth="5" strokeLinecap="round" />
                        <circle cx="456" cy="316" r="16.5" fill="#2d1206" />
                        <circle cx="450" cy="309" r="6" fill="#ffffff" />
                        <circle cx="462" cy="322" r="2.5" fill="#ffffff" opacity="0.85" />
                        <circle cx="534" cy="304" r="16" fill="#2d1206" />
                        <circle cx="528" cy="297" r="5.8" fill="#ffffff" />
                        <circle cx="540" cy="310" r="2.5" fill="#ffffff" opacity="0.85" />

                        <path d="M 488 316 C 488 311, 504 310, 504 315 C 504 320, 498 325, 496 325 C 493 325, 488 321, 488 316 Z" fill="url(#shPinkNose)" />
                        <path d="M 496 325 L 496 332" stroke="#5c1f08" strokeWidth="3.5" strokeLinecap="round" />
                        <path d="M 476 376 C 474 344, 486 330, 498 330 C 512 330, 526 346, 526 372 C 512 368, 490 370, 476 376 Z" fill="#7f1d1d" stroke="#450a0a" strokeWidth="3.8" strokeLinejoin="round" />
                        <path d="M 479 374 C 485 356, 512 354, 523 370 C 510 368, 492 370, 479 374 Z" fill="#fb7185" />

                        <g transform="translate(448, 398) rotate(-18)">
                          <path d="M -20 35 L -16 -6 C -16 -22, 16 -22, 16 -6 L 20 35 Z" fill="url(#shCheekGrad)" stroke="#6b2710" strokeWidth="3.5" />
                          <ellipse cx="0" cy="-6" rx="15" ry="13" fill="#fda4af" />
                          <path d="M -6 -16 L -6 -7 M 2 -17 L 2 -7 M 9 -15 L 9 -6" stroke="#9f1239" strokeWidth="2.5" strokeLinecap="round" />
                        </g>
                        <g transform="translate(536, 395) rotate(-12)">
                          <path d="M -19 35 L -15 -6 C -15 -22, 15 -22, 15 -6 L 19 35 Z" fill="url(#shCheekGrad)" stroke="#6b2710" strokeWidth="3.5" />
                          <ellipse cx="0" cy="-6" rx="14" ry="12.5" fill="#fda4af" />
                          <path d="M -6 -15 L -6 -6 M 2 -16 L 2 -6 M 9 -14 L 9 -5" stroke="#9f1239" strokeWidth="2.5" strokeLinecap="round" />
                        </g>
                      </g>
                    )}
                  </g>

                  {/* Edge-to-Edge Foreground Bedding Puffs & Ceramic Food Bowl */}
                  <g>
                    <path
                      d="M -15 446 Q 140 412 280 442 T 540 438 T 810 440 T 1015 444 L 1015 550 L -15 550 Z"
                      fill="url(#shBeddingBase)"
                    />
                    <g opacity="0.96">
                      <circle cx="24" cy="462" r="28" fill="url(#shPuff1)" />
                      <circle cx="82" cy="458" r="28" fill="url(#shPuff0)" />
                      <circle cx="132" cy="468" r="30" fill="url(#shPuff1)" />
                      <circle cx="176" cy="456" r="24" fill="url(#shPuff2)" />
                      <circle cx="222" cy="454" r="28" fill="url(#shPuff0)" />
                      <circle cx="290" cy="465" r="31" fill="url(#shPuff1)" />
                      <circle cx="348" cy="456" r="25" fill="url(#shPuff0)" />
                      <circle cx="392" cy="448" r="24" fill="url(#shPuff2)" />
                      <circle cx="434" cy="458" r="26" fill="url(#shPuff0)" />
                      <circle cx="562" cy="454" r="28" fill="url(#shPuff0)" />
                      <circle cx="614" cy="462" r="26" fill="url(#shPuff1)" />
                      <circle cx="660" cy="454" r="24" fill="url(#shPuff2)" />
                      <circle cx="865" cy="460" r="30" fill="url(#shPuff0)" />
                      <circle cx="922" cy="452" r="28" fill="url(#shPuff1)" />
                      <circle cx="978" cy="460" r="28" fill="url(#shPuff0)" />
                    </g>

                    {/* Ceramic Food Bowl */}
                    <g transform="translate(686, 408)" filter="url(#shSoftShadow)">
                      <ellipse cx="60" cy="60" rx="68" ry="15" fill="rgba(0,0,0,0.38)" />
                      <path d="M 12 22 L 108 22 L 120 55 Q 60 70 0 55 Z" fill={currentTheme.bowlBody} stroke={currentTheme.bowlStroke} strokeWidth="3" strokeLinejoin="round" />
                      <path d="M 16 32 L 10 50" stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
                      <ellipse cx="60" cy="22" rx="48" ry="13" fill="#47301f" stroke={currentTheme.bowlRim} strokeWidth="4" />
                      <circle cx="38" cy="22" r="5.5" fill="#f59e0b" />
                      <circle cx="52" cy="19" r="6.5" fill="#d97706" />
                      <circle cx="72" cy="21" r="5.5" fill="#fbbf24" />
                      <circle cx="85" cy="23" r="5" fill="#d97706" />
                      <circle cx="46" cy="25" r="5.5" fill="#22c55e" />
                      <circle cx="64" cy="24" r="6" fill="#f97316" stroke="#fdba74" strokeWidth="1.5" />
                      <ellipse cx="56" cy="21" rx="5" ry="3" transform="rotate(-18 56 21)" fill="#27272a" stroke="#e4e4e7" strokeWidth="1" />
                      <path d="M 60 45 C 60 41 54 37 51 41 C 48 45 60 53 60 53 C 60 53 72 45 69 41 C 66 37 60 41 60 45 Z" fill="#fbcfe8" opacity="0.9" />
                    </g>
                  </g>

                  {/* Draped Warm Fairy String Lights */}
                  <g pointerEvents="none">
                    <path
                      d="M -10 12 Q 165 56 335 22 T 675 26 T 1010 12"
                      fill="none"
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth="2.2"
                    />
                    {[
                      { x: 92, y: 31, delay: '0s' },
                      { x: 196, y: 38, delay: '0.7s' },
                      { x: 300, y: 27, delay: '1.3s' },
                      { x: 432, y: 12, delay: '0.4s' },
                      { x: 565, y: 15, delay: '1.1s' },
                      { x: 705, y: 29, delay: '0.2s' },
                      { x: 825, y: 36, delay: '0.9s' },
                      { x: 928, y: 26, delay: '1.5s' },
                    ].map((bulb, i) => (
                      <g key={i} className="sh-fairy-bulb" style={{ animationDelay: bulb.delay }}>
                        <circle cx={bulb.x} cy={bulb.y + 8} r="14" fill={currentTheme.fairyGlow} opacity="0.4" />
                        <circle cx={bulb.x} cy={bulb.y + 7} r="5.5" fill={currentTheme.fairyColor} />
                        <circle cx={bulb.x - 1.5} cy={bulb.y + 5.5} r="1.8" fill="#ffffff" opacity="0.85" />
                      </g>
                    ))}
                  </g>

                  {/* Curved Glass Reflections */}
                  <polygon points="75,0 155,0 65,540 0,540" fill="rgba(255,255,255,0.038)" />
                  <polygon points="195,0 222,0 132,540 105,540" fill="rgba(255,255,255,0.025)" />
                  <polygon points="885,0 925,0 855,540 815,540" fill="rgba(255,255,255,0.02)" />
                </svg>
              </div>
            </div>
          </main>

          {/* CLEAN BOTTOM NOISE MONITOR BAR */}
          {hasStarted && (
            <footer className="relative z-30 shrink-0">
              <div className={`${currentTheme.panelBg} backdrop-blur-xl border border-white/15 rounded-3xl px-4 sm:px-5 py-3.5 shadow-2xl transition-colors duration-500`}>
                <div className="flex items-center justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="bg-black/40 border border-white/10 px-3 py-1 rounded-full flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isMicMuted ? 'bg-rose-400' : 'bg-emerald-400'
                        }`}
                      />
                      <span className="font-mono tabular-nums font-extrabold text-xs text-white">
                        {isMicMuted ? 'Muted' : `${estimatedDb} dB`}
                      </span>
                    </div>

                    {/* 14-Bar Live Voice Spectrum */}
                    <div className="hidden sm:flex items-end gap-1 h-5 px-2.5 py-0.5 bg-black/35 rounded-lg border border-white/5">
                      {freqBars.map((h, idx) => (
                        <div
                          key={idx}
                          className="w-1 bg-white/75 rounded-full transition-all duration-75"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Horizontal Noise Progress Bar */}
                <div className="relative">
                  <div className="h-5 w-full bg-black/50 rounded-full overflow-hidden border border-white/10 relative p-0.5">
                    <div
                      className="absolute inset-y-0 w-0.5 bg-yellow-400/65 z-20 transition-[left] duration-150"
                      style={{ left: `${currentThreshold.disturbed}%` }}
                    />
                    <div
                      className="absolute inset-y-0 w-0.5 bg-red-500/80 z-20 transition-[left] duration-150"
                      style={{ left: `${currentThreshold.awake}%` }}
                    />
                    <div
                      className="absolute inset-y-1 w-1.5 bg-white/85 rounded-full z-30 shadow-[0_0_8px_#fff] transition-[left] duration-75"
                      style={{ left: `${Math.min(98, Math.max(2, rawLevel))}%` }}
                    />
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${activeUi.barClass} relative z-10 transition-[width] duration-75`}
                      style={{ width: `${sustainedEnergy}%` }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/25 rounded-t-full" />
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] font-extrabold tracking-widest uppercase mt-1 px-1">
                    <span className="text-emerald-400">Quiet</span>
                    <span className="text-amber-300">Disturbed</span>
                    <span className="text-rose-400">Awake!</span>
                  </div>
                </div>
              </div>
            </footer>
          )}
        </div>

        {/* RIGHT-HAND SIDE CONTROL RAIL: Microphone Mute, Sensitivity Slider, Noise Alert, Music */}
        {hasStarted && (
          <aside className={`relative z-30 w-full lg:w-64 shrink-0 ${currentTheme.panelBg} backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-2xl flex flex-row flex-wrap lg:flex-nowrap lg:flex-col items-center justify-between lg:justify-evenly gap-3 overflow-y-auto transition-colors duration-500`}>
            {/* 1. MICROPHONE MUTE / UNMUTE */}
            <div className="flex flex-col items-center text-center gap-2 w-auto lg:w-full">
              <span className="text-xs font-extrabold uppercase tracking-widest text-purple-200/90">
                Microphone
              </span>
              <button
                type="button"
                onClick={toggleMicMute}
                aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center gap-1 border-2 transition-all cursor-pointer active:scale-95 ${
                  isMicMuted
                    ? 'bg-rose-500/20 border-rose-400/60 text-rose-200 hover:bg-rose-500/30 shadow-[0_0_24px_rgba(244,63,94,0.2)]'
                    : 'bg-purple-500/20 border-purple-300/45 text-white hover:bg-purple-500/30 shadow-[0_0_24px_rgba(168,85,247,0.22)]'
                }`}
              >
                {isMicMuted ? <MicOff size={28} strokeWidth={2} /> : <Mic size={28} strokeWidth={2} />}
              </button>
              <span
                className={`text-xs font-bold ${
                  isMicMuted ? 'text-rose-300' : 'text-emerald-300'
                }`}
              >
                {isMicMuted ? 'Muted (Tap to unmute)' : 'Listening (Tap to mute)'}
              </span>
            </div>

            <div className="hidden lg:block w-full h-px bg-white/10" />

            {/* 2. SENSITIVITY SLIDER */}
            <div className="flex flex-col items-center text-center gap-2 flex-1 lg:flex-none lg:w-full min-w-[160px] max-w-[220px]">
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-extrabold uppercase tracking-widest text-purple-200/90">
                  Sensitivity
                </span>
                <span className="text-xs font-mono tabular-nums font-bold text-amber-300">
                  {getSensitivityLabel(sensitivityValue)} · {sensitivityValue}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={sensitivityValue}
                onChange={(e) => setSensitivityValue(Number(e.target.value))}
                aria-label="Microphone sensitivity"
                className="w-full h-2 bg-black/45 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between w-full text-[10px] font-bold uppercase tracking-wider text-purple-300/70">
                <span>Low</span>
                <span>Normal</span>
                <span>High</span>
              </div>
            </div>

            <div className="hidden lg:block w-full h-px bg-white/10" />

            {/* 3. NOISE ALERT */}
            <div className="flex flex-col items-center text-center gap-1.5 w-auto lg:w-full">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-purple-200/80" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-purple-200/90">
                  Noise Alert
                </span>
              </div>
              <div className="flex flex-col gap-1 w-full">
                {NOISE_ALERT_OPTIONS.map((opt) => {
                  const isActive = noiseAlert === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectNoiseAlert(opt.id)}
                      className={`w-full px-3.5 py-1.5 rounded-xl text-sm font-bold flex items-center justify-between transition cursor-pointer ${
                        isActive
                          ? 'bg-purple-500/35 text-white border border-purple-300/50 shadow-sm'
                          : 'text-purple-200/65 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isActive && <Check size={15} className="text-amber-300 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:block w-full h-px bg-white/10" />

            {/* 4. MUSIC (LOOPING BACKGROUND TRACKS 1, 2, 3) */}
            <div className="flex flex-col items-center text-center gap-2 w-full sm:w-auto lg:w-full">
              <div className="flex items-center gap-1.5">
                <Music size={14} className="text-purple-200/85" />
                <span className="text-xs font-extrabold uppercase tracking-widest text-purple-200/90">
                  Music
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 w-full min-w-[168px]">
                {MUSIC_TRACKS.map((track) => {
                  const isPlaying = activeMusicTrack === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => handleMusicButtonClick(track.id)}
                      aria-label={`Play music ${track.label}`}
                      aria-pressed={isPlaying}
                      className={`h-11 rounded-xl font-black text-base flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                        isPlaying
                          ? 'bg-purple-500/45 text-white border-amber-300/75 shadow-[0_0_18px_rgba(168,85,247,0.4)]'
                          : 'bg-white/5 text-purple-100/80 border-white/10 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      {isPlaying && <Music size={13} className="text-amber-300 animate-pulse" />}
                      <span>{track.label}</span>
                    </button>
                  );
                })}
              </div>
              {activeMusicTrack !== null && (
                <button
                  type="button"
                  onClick={() => setActiveMusicTrack(null)}
                  className="w-full py-1.5 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Square size={11} className="fill-current" />
                  <span>Stop Music {activeMusicTrack}</span>
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* START OVERLAY — Centered cleanly over the softly blurred live hamster habitat */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f0724]/70 backdrop-blur-md p-4">
          <button
            type="button"
            onClick={() => onViewChange('home')}
            className="absolute top-5 left-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-sm transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Studio</span>
          </button>

          <div className="bg-[#23144a]/95 border border-purple-300/25 rounded-[2rem] p-7 sm:p-8 max-w-md w-full text-center shadow-[0_30px_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
            <div className="w-44 aspect-[4/3] mx-auto mb-5 rounded-2xl overflow-hidden border-2 border-purple-300/40 shadow-xl">
              <img
                src="/images/sleeping-hamster-card.jpg?v=1"
                alt="Sleeping Hamster"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <h1 className="text-3xl font-black text-white tracking-tight mb-2">
              Sleeping Hamster
            </h1>
            <p className="text-sm text-purple-200/85 font-medium mb-6 leading-relaxed">
              Keep your classroom calm and quiet so the little hamster stays fast asleep!
            </p>

            {micError && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-500/20 border border-rose-400/45 text-rose-100 text-xs font-bold flex items-start gap-2 text-left">
                <AlertCircle size={16} className="text-rose-300 shrink-0 mt-0.5" />
                <span>{micError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isConnectingMic}
              onClick={handleStartWithMic}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-base rounded-2xl shadow-[0_5px_0_#4c1d95] active:translate-y-[3px] active:shadow-[0_2px_0_#4c1d95] transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
            >
              <Mic size={20} />
              <span>
                {isConnectingMic
                  ? 'Connecting Microphone...'
                  : micError
                  ? 'Try Microphone Again'
                  : 'Start Listening'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* MICROPHONE CONFIRMATION MODAL WHEN CLICKING MUSIC */}
      {hasStarted && pendingMusicTrack !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 backdrop-blur-sm p-4"
          onClick={() => setPendingMusicTrack(null)}
        >
          <div
            className="w-full max-w-sm bg-[#23144a] border border-purple-300/30 rounded-3xl p-6 shadow-[0_24px_60px_rgba(0,0,0,0.7)] text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPendingMusicTrack(null)}
              aria-label="Cancel"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-purple-200 flex items-center justify-center transition cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/25 border border-purple-300/40 text-amber-300 flex items-center justify-center mx-auto mb-3.5">
              <Music size={24} />
            </div>

            <h2 className="text-xl font-black text-white mb-2">
              Turn off the microphone?
            </h2>
            <p className="text-xs text-purple-200/80 font-medium mb-5 leading-relaxed">
              Playing Music {pendingMusicTrack} from your speakers may trigger the classroom noise sensor.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleConfirmMusicMicChoice(true)}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-black text-sm shadow-md transition cursor-pointer active:scale-95"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleConfirmMusicMicChoice(false)}
                className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-sm transition cursor-pointer active:scale-95"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIDDEN NON-ZERO LOOPING YOUTUBE AUDIO PLAYER (PREVENTS CHROME THROTTLING) */}
      {hasStarted && activeMusicTrack !== null && (() => {
        const track = MUSIC_TRACKS.find((t) => t.id === activeMusicTrack);
        if (!track) return null;
        const startParam = track.startSeconds ? `&start=${track.startSeconds}` : '';
        const embedUrl = `https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${track.videoId}${startParam}&controls=0&disablekb=1&fs=0&playsinline=1`;
        return (
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              bottom: 0,
              right: 0,
              width: 320,
              height: 240,
              pointerEvents: 'none',
              opacity: 0.001,
              zIndex: -999,
            }}
          >
            <iframe
              key={track.id}
              ref={musicIframeRef}
              title={`Sleeping Hamster Music ${track.label}`}
              width="320"
              height="240"
              src={embedUrl}
              allow="autoplay; encrypted-media"
              style={{ border: 0 }}
              onLoad={() => {
                try {
                  musicIframeRef.current?.contentWindow?.postMessage(
                    JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                    '*'
                  );
                } catch {
                  // ignore cross-origin postMessage errors
                }
              }}
            />
          </div>
        );
      })()}
    </div>
  );
}
