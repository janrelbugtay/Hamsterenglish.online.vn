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
import noiseControlCardImg from '../assets/images/noise_control_card_1795022921714.jpg';

type SleepState =
  | 'DEEP_SLEEP'
  | 'LIGHT_SLEEP'
  | 'DISTURBED'
  | 'ALMOST_AWAKE'
  | 'AWAKE'
  | 'RECOVERING';

type NoiseControlMode = 'sleeping' | 'cage' | 'bubbles';

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
    body: ['#e6b88a', '#8c4a1c', '#451a03'],
    head: ['#d49b6a', '#78350f', '#3b1506'],
    swatch: '#92400e',
  },
  {
    id: 'panda',
    name: 'Panda Oreo',
    body: ['#a1a1aa', '#3f3f46', '#18181b'],
    head: ['#71717a', '#27272a', '#09090b'],
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

const CAGE_QUIET_APPEAR_SECONDS = 10;

interface CageSlot {
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
  accessory?: 'bow' | 'pacifier' | 'tuft';
  walkRangeX?: number;
  walkSpeed?: number;
  level?: 'floor' | 'loft' | 'roof';
}

interface CageWalkerState {
  x: number;
  y: number;
  dir: 1 | -1;
  phase: number;
  pauseSec: number;
  isWalking: boolean;
}

// 10 cozy walking patrol slots for Adult Hamsters (1..10) inside the deluxe multi-level terrarium cage
const CAGE_ADULT_SLOTS: CageSlot[] = [
  { x: 465, y: 386, scale: 0.39, walkRangeX: 95, walkSpeed: 42, level: 'floor' },
  { x: 585, y: 392, scale: 0.38, flip: true, walkRangeX: 85, walkSpeed: 38, level: 'floor' },
  { x: 342, y: 390, scale: 0.37, walkRangeX: 82, walkSpeed: 40, level: 'floor' },
  { x: 182, y: 388, scale: 0.37, walkRangeX: 68, walkSpeed: 36, level: 'floor' },
  { x: 882, y: 388, scale: 0.37, flip: true, walkRangeX: 58, walkSpeed: 37, level: 'floor' },
  { x: 742, y: 366, scale: 0.34, flip: true, walkRangeX: 64, walkSpeed: 35, level: 'floor' },
  { x: 235, y: 218, scale: 0.33, walkRangeX: 78, walkSpeed: 39, level: 'loft' },
  { x: 472, y: 218, scale: 0.32, flip: true, walkRangeX: 88, walkSpeed: 41, level: 'loft' },
  { x: 746, y: 194, scale: 0.31, flip: true, walkRangeX: 58, walkSpeed: 33, level: 'roof' },
  { x: 918, y: 334, scale: 0.34, flip: true, walkRangeX: 46, walkSpeed: 34, level: 'floor' },
];

// 10 cozy walking patrol slots for Baby Hamsters (11..20) inside the deluxe multi-level terrarium cage
const CAGE_BABY_SLOTS: CageSlot[] = [
  { x: 412, y: 422, scale: 0.25, accessory: 'bow', walkRangeX: 76, walkSpeed: 48, level: 'floor' },
  { x: 518, y: 424, scale: 0.25, flip: true, accessory: 'pacifier', walkRangeX: 72, walkSpeed: 46, level: 'floor' },
  { x: 622, y: 420, scale: 0.24, accessory: 'tuft', walkRangeX: 66, walkSpeed: 50, level: 'floor' },
  { x: 246, y: 420, scale: 0.25, accessory: 'pacifier', walkRangeX: 68, walkSpeed: 44, level: 'floor' },
  { x: 136, y: 418, scale: 0.24, flip: true, accessory: 'bow', walkRangeX: 52, walkSpeed: 42, level: 'floor' },
  { x: 838, y: 422, scale: 0.25, flip: true, accessory: 'tuft', walkRangeX: 62, walkSpeed: 49, level: 'floor' },
  { x: 918, y: 416, scale: 0.24, accessory: 'bow', walkRangeX: 46, walkSpeed: 45, level: 'floor' },
  { x: 322, y: 426, scale: 0.23, flip: true, accessory: 'tuft', walkRangeX: 64, walkSpeed: 52, level: 'floor' },
  { x: 562, y: 226, scale: 0.23, accessory: 'pacifier', walkRangeX: 54, walkSpeed: 44, level: 'loft' },
  { x: 358, y: 226, scale: 0.24, flip: true, accessory: 'bow', walkRangeX: 58, walkSpeed: 47, level: 'loft' },
];

const ALL_CAGE_SLOTS: CageSlot[] = [...CAGE_ADULT_SLOTS, ...CAGE_BABY_SLOTS];

function createInitialCageWalkers(): CageWalkerState[] {
  return ALL_CAGE_SLOTS.map((slot, idx) => ({
    x: slot.x + (((idx * 29) % 5) - 2) * 8,
    y: slot.y,
    dir: slot.flip ? 1 : -1,
    phase: idx * 1.15,
    pauseSec: 0,
    isWalking: true,
  }));
}

interface LeavingHamsterState {
  slotIndex: number;
  isBaby: boolean;
  coatIndex: number;
  startedAt: number;
}

type HamsterBallSizeTier = 'large' | 'medium' | 'small' | 'tiny';

type HamsterBallPose =
  | 'smile'
  | 'wave'
  | 'seed'
  | 'strawberry'
  | 'eating'
  | 'sleeping'
  | 'surprised'
  | 'laughing'
  | 'standing'
  | 'leaf'
  | 'viewer'
  | 'tilted';

interface HamsterBallRimColor {
  id: string;
  name: string;
  rimLight: string;
  rimMid: string;
  rimDark: string;
  edgeTint: string;
  innerGlow: string;
}

const HAMSTER_BALL_RIMS: HamsterBallRimColor[] = [
  {
    id: 'bubblegum',
    name: 'Bubblegum Pink',
    rimLight: '#ff99cc',
    rimMid: '#ff4da6',
    rimDark: '#c61a6f',
    edgeTint: 'rgba(255, 77, 166, 0.24)',
    innerGlow: 'rgba(255, 182, 219, 0.36)',
  },
  {
    id: 'orange',
    name: 'Bright Orange',
    rimLight: '#ffb870',
    rimMid: '#ff7b24',
    rimDark: '#c74d00',
    edgeTint: 'rgba(255, 123, 36, 0.24)',
    innerGlow: 'rgba(255, 200, 150, 0.36)',
  },
  {
    id: 'golden',
    name: 'Golden Yellow',
    rimLight: '#fff085',
    rimMid: '#ffcc00',
    rimDark: '#c79300',
    edgeTint: 'rgba(255, 204, 0, 0.25)',
    innerGlow: 'rgba(255, 243, 168, 0.38)',
  },
  {
    id: 'skyblue',
    name: 'Sky Blue',
    rimLight: '#8ae0ff',
    rimMid: '#1cb0f6',
    rimDark: '#0077b3',
    edgeTint: 'rgba(28, 176, 246, 0.24)',
    innerGlow: 'rgba(179, 236, 255, 0.36)',
  },
  {
    id: 'lavender',
    name: 'Lavender Purple',
    rimLight: '#d8b4fe',
    rimMid: '#a855f7',
    rimDark: '#6b21a8',
    edgeTint: 'rgba(168, 85, 247, 0.24)',
    innerGlow: 'rgba(226, 200, 255, 0.36)',
  },
  {
    id: 'mint',
    name: 'Mint Green',
    rimLight: '#86efac',
    rimMid: '#22c55e',
    rimDark: '#15803d',
    edgeTint: 'rgba(34, 197, 94, 0.24)',
    innerGlow: 'rgba(187, 247, 208, 0.36)',
  },
  {
    id: 'coral',
    name: 'Coral Red',
    rimLight: '#ff9e9e',
    rimMid: '#ff4b4b',
    rimDark: '#b91c1c',
    edgeTint: 'rgba(255, 75, 75, 0.24)',
    innerGlow: 'rgba(255, 190, 190, 0.36)',
  },
  {
    id: 'turquoise',
    name: 'Turquoise',
    rimLight: '#67e8f9',
    rimMid: '#06b6d4',
    rimDark: '#0e7490',
    edgeTint: 'rgba(6, 182, 212, 0.24)',
    innerGlow: 'rgba(178, 245, 255, 0.36)',
  },
];

interface HamsterBallFurStyle {
  id: string;
  name: string;
  furLight: string;
  furMid: string;
  furDark: string;
  belly: string;
  stroke: string;
}

const HAMSTER_BALL_FURS: HamsterBallFurStyle[] = [
  {
    id: 'golden_cream',
    name: 'Golden Brown & Cream',
    furLight: '#fbd38d',
    furMid: '#dd842c',
    furDark: '#9c4221',
    belly: '#fffaf0',
    stroke: '#6b2710',
  },
  {
    id: 'orange_white',
    name: 'Orange & White',
    furLight: '#fed7aa',
    furMid: '#fb923c',
    furDark: '#c2410c',
    belly: '#ffffff',
    stroke: '#7c2d12',
  },
  {
    id: 'white_gray',
    name: 'White & Light Gray',
    furLight: '#ffffff',
    furMid: '#e2e8f0',
    furDark: '#94a3b8',
    belly: '#ffffff',
    stroke: '#64748b',
  },
  {
    id: 'caramel_beige',
    name: 'Caramel & Beige',
    furLight: '#f5deb3',
    furMid: '#c68b59',
    furDark: '#8b5a2b',
    belly: '#fff8e7',
    stroke: '#5c3a1a',
  },
  {
    id: 'chocolate_cream',
    name: 'Chocolate Brown & Cream',
    furLight: '#d6b28e',
    furMid: '#8c4a1c',
    furDark: '#451a03',
    belly: '#fef3c7',
    stroke: '#3b1506',
  },
  {
    id: 'soft_gray_white',
    name: 'Soft Gray & White',
    furLight: '#f1f5f9',
    furMid: '#a1a1aa',
    furDark: '#52525b',
    belly: '#ffffff',
    stroke: '#3f3f46',
  },
  {
    id: 'pale_golden',
    name: 'Pale Golden Yellow',
    furLight: '#fef9c3',
    furMid: '#eab308',
    furDark: '#a16207',
    belly: '#fffef2',
    stroke: '#713f12',
  },
];

interface HamsterBallSpec {
  id: number;
  homeX: number;
  homeY: number;
  r: number;
  tier: HamsterBallSizeTier;
  zLayer: number;
  rimIdx: number;
  furIdx: number;
  pose: HamsterBallPose;
  flip?: boolean;
}

// 44 Adorable 3D Hamsters in Transparent Hamster Balls
// Concentrated in the bottom 60-65% of the 1200x540 canvas (y: 235..485), leaving the top 35% open when quiet!
// Size distribution: 8 Large (18%), 16 Medium (36%), 12 Small (27%), 8 Tiny (18%)
const HAMSTER_BALL_SPECS: HamsterBallSpec[] = [
  // LARGE SPHERES (8 balls — across the main upper edge of the collection, visually prominent)
  { id: 1, homeX: 118, homeY: 286, r: 54, tier: 'large', zLayer: 2, rimIdx: 0, furIdx: 1, pose: 'wave' },
  { id: 2, homeX: 222, homeY: 274, r: 58, tier: 'large', zLayer: 1, rimIdx: 1, furIdx: 0, pose: 'laughing' },
  { id: 3, homeX: 432, homeY: 256, r: 64, tier: 'large', zLayer: 2, rimIdx: 6, furIdx: 0, pose: 'viewer' },
  { id: 4, homeX: 602, homeY: 288, r: 58, tier: 'large', zLayer: 2, rimIdx: 3, furIdx: 1, pose: 'wave', flip: true },
  { id: 5, homeX: 748, homeY: 266, r: 60, tier: 'large', zLayer: 1, rimIdx: 0, furIdx: 6, pose: 'strawberry' },
  { id: 6, homeX: 922, homeY: 422, r: 56, tier: 'large', zLayer: 3, rimIdx: 0, furIdx: 0, pose: 'strawberry' },
  { id: 7, homeX: 1095, homeY: 325, r: 58, tier: 'large', zLayer: 2, rimIdx: 4, furIdx: 6, pose: 'laughing', flip: true },
  { id: 8, homeX: 422, homeY: 434, r: 54, tier: 'large', zLayer: 3, rimIdx: 1, furIdx: 3, pose: 'smile' },

  // MEDIUM SPHERES (16 balls — filling spaces between the large spheres)
  { id: 9, homeX: 68, homeY: 344, r: 44, tier: 'medium', zLayer: 2, rimIdx: 4, furIdx: 3, pose: 'smile' },
  { id: 10, homeX: 46, homeY: 416, r: 46, tier: 'medium', zLayer: 3, rimIdx: 3, furIdx: 0, pose: 'leaf' },
  { id: 11, homeX: 154, homeY: 368, r: 46, tier: 'medium', zLayer: 3, rimIdx: 5, furIdx: 0, pose: 'leaf' },
  { id: 12, homeX: 282, homeY: 356, r: 48, tier: 'medium', zLayer: 2, rimIdx: 4, furIdx: 2, pose: 'standing' },
  { id: 13, homeX: 348, homeY: 294, r: 46, tier: 'medium', zLayer: 1, rimIdx: 2, furIdx: 6, pose: 'eating' },
  { id: 14, homeX: 238, homeY: 430, r: 46, tier: 'medium', zLayer: 3, rimIdx: 5, furIdx: 0, pose: 'seed' },
  { id: 15, homeX: 356, homeY: 446, r: 44, tier: 'medium', zLayer: 3, rimIdx: 0, furIdx: 1, pose: 'wave' },
  { id: 16, homeX: 516, homeY: 332, r: 46, tier: 'medium', zLayer: 2, rimIdx: 0, furIdx: 3, pose: 'tilted' },
  { id: 17, homeX: 598, homeY: 396, r: 45, tier: 'medium', zLayer: 3, rimIdx: 4, furIdx: 4, pose: 'laughing' },
  { id: 18, homeX: 682, homeY: 352, r: 46, tier: 'medium', zLayer: 2, rimIdx: 2, furIdx: 5, pose: 'standing', flip: true },
  { id: 19, homeX: 770, homeY: 374, r: 44, tier: 'medium', zLayer: 3, rimIdx: 3, furIdx: 2, pose: 'smile' },
  { id: 20, homeX: 838, homeY: 320, r: 48, tier: 'medium', zLayer: 2, rimIdx: 3, furIdx: 4, pose: 'viewer' },
  { id: 21, homeX: 846, homeY: 442, r: 45, tier: 'medium', zLayer: 3, rimIdx: 5, furIdx: 3, pose: 'seed' },
  { id: 22, homeX: 938, homeY: 296, r: 46, tier: 'medium', zLayer: 1, rimIdx: 7, furIdx: 1, pose: 'standing' },
  { id: 23, homeX: 1002, homeY: 446, r: 43, tier: 'medium', zLayer: 3, rimIdx: 6, furIdx: 1, pose: 'sleeping' },
  { id: 24, homeX: 1156, homeY: 444, r: 45, tier: 'medium', zLayer: 3, rimIdx: 2, furIdx: 6, pose: 'smile' },

  // SMALL SPHERES (12 balls — filling gaps between medium spheres)
  { id: 25, homeX: 85, homeY: 460, r: 32, tier: 'small', zLayer: 4, rimIdx: 2, furIdx: 6, pose: 'laughing' },
  { id: 26, homeX: 126, homeY: 432, r: 30, tier: 'small', zLayer: 2, rimIdx: 5, furIdx: 3, pose: 'smile' },
  { id: 27, homeX: 176, homeY: 442, r: 29, tier: 'small', zLayer: 2, rimIdx: 0, furIdx: 1, pose: 'surprised' },
  { id: 28, homeX: 292, homeY: 454, r: 33, tier: 'small', zLayer: 4, rimIdx: 1, furIdx: 0, pose: 'laughing' },
  { id: 29, homeX: 344, homeY: 382, r: 33, tier: 'small', zLayer: 2, rimIdx: 4, furIdx: 2, pose: 'tilted' },
  { id: 30, homeX: 404, homeY: 348, r: 33, tier: 'small', zLayer: 1, rimIdx: 7, furIdx: 5, pose: 'smile' },
  { id: 31, homeX: 462, homeY: 374, r: 29, tier: 'small', zLayer: 2, rimIdx: 2, furIdx: 0, pose: 'viewer' },
  { id: 32, homeX: 492, homeY: 454, r: 32, tier: 'small', zLayer: 4, rimIdx: 5, furIdx: 0, pose: 'leaf' },
  { id: 33, homeX: 540, homeY: 436, r: 31, tier: 'small', zLayer: 3, rimIdx: 1, furIdx: 1, pose: 'laughing' },
  { id: 34, homeX: 642, homeY: 454, r: 32, tier: 'small', zLayer: 4, rimIdx: 3, furIdx: 2, pose: 'strawberry' },
  { id: 35, homeX: 698, homeY: 454, r: 31, tier: 'small', zLayer: 4, rimIdx: 1, furIdx: 6, pose: 'sleeping' },
  { id: 36, homeX: 896, homeY: 368, r: 32, tier: 'small', zLayer: 2, rimIdx: 4, furIdx: 3, pose: 'smile' },

  // TINY SPHERES (8 balls — dense decorative arrangement along the bottom and between larger spheres)
  { id: 37, homeX: 24, homeY: 468, r: 21, tier: 'tiny', zLayer: 4, rimIdx: 6, furIdx: 1, pose: 'smile' },
  { id: 38, homeX: 144, homeY: 468, r: 22, tier: 'tiny', zLayer: 4, rimIdx: 4, furIdx: 3, pose: 'viewer' },
  { id: 39, homeX: 204, homeY: 398, r: 20, tier: 'tiny', zLayer: 3, rimIdx: 2, furIdx: 6, pose: 'smile' },
  { id: 40, homeX: 504, homeY: 406, r: 21, tier: 'tiny', zLayer: 3, rimIdx: 4, furIdx: 2, pose: 'surprised' },
  { id: 41, homeX: 562, homeY: 468, r: 20, tier: 'tiny', zLayer: 4, rimIdx: 0, furIdx: 1, pose: 'smile' },
  { id: 42, homeX: 742, homeY: 436, r: 24, tier: 'tiny', zLayer: 3, rimIdx: 2, furIdx: 6, pose: 'eating' },
  { id: 43, homeX: 974, homeY: 374, r: 24, tier: 'tiny', zLayer: 2, rimIdx: 3, furIdx: 2, pose: 'viewer' },
  { id: 44, homeX: 1072, homeY: 458, r: 23, tier: 'tiny', zLayer: 4, rimIdx: 5, furIdx: 0, pose: 'leaf' },
];

interface HamsterBallPhysicsState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  restY: number;
  driftAngle: number;
  freeBounceUntil: number;
  squash: number;
}

function createInitialHamsterBallsState(): HamsterBallPhysicsState[] {
  return HAMSTER_BALL_SPECS.map((s) => ({
    id: s.id,
    x: s.homeX,
    y: s.homeY,
    vx: 0,
    vy: 0,
    rot: 0,
    vRot: 0,
    restY: s.homeY,
    driftAngle: (s.id * 1.37) % (Math.PI * 2),
    freeBounceUntil: 0,
    squash: 0,
  }));
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
  const [timerEndPhase, setTimerEndPhase] = useState<'idle' | 'awake_10s' | 'eating'>('idle');
  const [wakeSoundSecondsLeft, setWakeSoundSecondsLeft] = useState(0);

  // Game Mode: Sleeping Hamster (original) vs Hamster Cage vs Hamster Bubbles (44 3D Hamster Balls collection)
  const [gameMode, setGameMode] = useState<NoiseControlMode>('sleeping');
  const [cageCount, setCageCount] = useState<number>(3);
  const [cageQuietSeconds, setCageQuietSeconds] = useState<number>(0);
  const [leavingHamster, setLeavingHamster] = useState<LeavingHamsterState | null>(null);
  const [justArrivedSlot, setJustArrivedSlot] = useState<number | null>(null);
  const [cageWalkersState, setCageWalkersState] = useState<CageWalkerState[]>(() =>
    createInitialCageWalkers()
  );
  const [hamsterBallsState, setHamsterBallsState] = useState<HamsterBallPhysicsState[]>(() =>
    createInitialHamsterBallsState()
  );
  const [bubblesFlyingCount, setBubblesFlyingCount] = useState<number>(0);

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
  const timerEndPhaseRef = useRef<'idle' | 'awake_10s' | 'eating'>('idle');
  const timerSequenceTimersRef = useRef<number[]>([]);
  const lastStateChangeRef = useRef(0);
  const recoveryHoldFramesRef = useRef(0);
  const lastWarningSoundRef = useRef(0);
  const muteMicUntilRef = useRef(0);
  const particleIdRef = useRef(1);
  const starPointsRef = useRef(3.0);
  const quietMinuteAccumRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());

  // Hamster Cage & Hamster Bubbles mutable refs for real-time noise / quiet tracking
  const gameModeRef = useRef<NoiseControlMode>('sleeping');
  const cageCountRef = useRef<number>(3);
  const cageQuietSecRef = useRef<number>(0);
  const cageNoiseAccumRef = useRef<number>(0);
  const cageLeaveCooldownUntilRef = useRef<number>(0);
  const leavingHamsterRef = useRef<LeavingHamsterState | null>(null);
  const leavingTimeoutRef = useRef<number | null>(null);
  const arriveTimeoutRef = useRef<number | null>(null);
  const cageWalkersRef = useRef<CageWalkerState[]>(createInitialCageWalkers());
  const hamsterBallsPhysicsRef = useRef<HamsterBallPhysicsState[]>(
    createInitialHamsterBallsState()
  );
  const bubbleGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const bubbleShadowRefs = useRef<(SVGEllipseElement | null)[]>([]);
  const bubblesFlyingCountRef = useRef<number>(0);
  const bubbleExcitedUntilRef = useRef<number>(0);
  const smoothedBubbleDriveRef = useRef<number>(0);

  gameModeRef.current = gameMode;

  const stateSnapshotRef = useRef({
    hasStarted,
    isMicMuted,
    sensitivityValue,
    noiseAlert,
    timerMode,
    isTimerPaused,
    gameMode,
    coatIndex,
  });
  stateSnapshotRef.current = {
    hasStarted,
    isMicMuted,
    sensitivityValue,
    noiseAlert,
    timerMode,
    isTimerPaused,
    gameMode,
    coatIndex,
  };

  const currentTheme = HABITAT_THEMES[themeIndex];
  const currentCoat = COAT_STYLES[coatIndex];
  const currentThreshold = getThresholdsForSensitivity(sensitivityValue);
  const activeUi = STATE_UI[sleepState];

  const sendYouTubePlayCommands = useCallback(() => {
    const win = musicIframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(
        JSON.stringify({ event: 'listening', id: activeMusicTrack ?? 1, channel: 'widget' }),
        '*'
      );
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
        '*'
      );
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [100] }),
        '*'
      );
      win.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
        '*'
      );
    } catch {
      // ignore cross-origin postMessage errors
    }
  }, [activeMusicTrack]);

  // YouTube IFrame API handshake: ensure unMute + setVolume(100) + playVideo fire when YT player finishes initializing
  useEffect(() => {
    if (!hasStarted || activeMusicTrack === null) return;

    const retryDelays = [150, 400, 850, 1500, 2500];
    const timers = retryDelays.map((delay) =>
      window.setTimeout(() => {
        sendYouTubePlayCommands();
      }, delay)
    );

    const onMessage = (e: MessageEvent) => {
      if (!e.origin || !e.origin.includes('youtube')) return;
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (
          data?.event === 'onReady' ||
          data?.event === 'initialDelivery' ||
          (data?.event === 'infoDelivery' &&
            (data?.info?.playerState === -1 || data?.info?.playerState === 5))
        ) {
          sendYouTubePlayCommands();
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('message', onMessage);
    };
  }, [hasStarted, activeMusicTrack, sendYouTubePlayCommands]);

  const clearTimerEndSequence = useCallback(() => {
    timerSequenceTimersRef.current.forEach((id) => {
      window.clearTimeout(id);
      window.clearInterval(id);
    });
    timerSequenceTimersRef.current = [];
    timerEndPhaseRef.current = 'idle';
    setTimerEndPhase('idle');
    setWakeSoundSecondsLeft(0);
  }, []);

  // Clean up audio & animation frame on unmount
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      timerSequenceTimersRef.current.forEach((id) => {
        window.clearTimeout(id);
        window.clearInterval(id);
      });
      if (leavingTimeoutRef.current) window.clearTimeout(leavingTimeoutRef.current);
      if (arriveTimeoutRef.current) window.clearTimeout(arriveTimeoutRef.current);
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
      type: 'warning' | 'awake' | 'star' | 'pet' | 'eat',
      overrideMode?: NoiseAlertMode,
      forceLoop = false
    ) => {
      // Always respect the user's selected Noise Alert mode across all game modes
      const mode = overrideMode ?? stateSnapshotRef.current.noiseAlert;
      if (mode === 'none' && type === 'warning') return;
      if (mode === 'none' && type === 'awake') return;

      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
          audioCtxRef.current = new Ctx();
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = Math.max(0, ctx.currentTime) + 0.01;

        if ((type === 'warning' || type === 'awake') && !forceLoop) {
          if (now - lastWarningSoundRef.current < 0.75) return;
        }
        if (type === 'warning' || type === 'awake') {
          lastWarningSoundRef.current = now;
        }

        // Master boost + brickwall limiter delivers loud, commanding classroom alerts with zero clipping
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(
          type === 'star' || type === 'pet' || type === 'eat' ? 1.15 : 1.75,
          now
        );

        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-2, now);
        limiter.knee.setValueAtTime(4, now);
        limiter.ratio.setValueAtTime(14, now);
        limiter.attack.setValueAtTime(0.002, now);
        limiter.release.setValueAtTime(0.08, now);

        masterGain.connect(limiter);
        limiter.connect(ctx.destination);

        // Full alert-duration duck window (720ms for warning/awake, 320ms for short SFX)
        // prevents speaker output from feeding back into the microphone and self-triggering!
        const duckDurationMs = type === 'warning' || type === 'awake' ? 720 : 320;
        muteMicUntilRef.current = Math.max(
          muteMicUntilRef.current,
          performance.now() + duckDurationMs
        );

        if (type === 'eat') {
          // Cute crispy seed crunch + happy hamster nibble squeak
          [0, 0.11, 0.22].forEach((offset, idx) => {
            const crunchDur = 0.065;
            const bufSize = Math.floor(ctx.sampleRate * crunchDur);
            const crunchBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
            const data = crunchBuf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) {
              data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
            }
            const noise = ctx.createBufferSource();
            noise.buffer = crunchBuf;

            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(1900 + idx * 320, now + offset);
            bp.Q.setValueAtTime(2.4, now + offset);

            const nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0.55, now + offset);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + offset + crunchDur);

            noise.connect(bp);
            bp.connect(nGain);
            nGain.connect(masterGain);
            noise.start(now + offset);
            noise.stop(now + offset + crunchDur + 0.01);

            // Little happy nibble tone
            const nibbleOsc = ctx.createOscillator();
            const nibbleGain = ctx.createGain();
            nibbleOsc.type = 'triangle';
            nibbleOsc.frequency.setValueAtTime(1150 + idx * 180, now + offset);
            nibbleOsc.frequency.exponentialRampToValueAtTime(1480 + idx * 140, now + offset + 0.055);
            nibbleGain.gain.setValueAtTime(0.22, now + offset);
            nibbleGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.06);
            nibbleOsc.connect(nibbleGain);
            nibbleGain.connect(masterGain);
            nibbleOsc.start(now + offset);
            nibbleOsc.stop(now + offset + 0.065);
          });
          return;
        }

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
          // Expressive, cute hamster squeak-chatter using layered triangle + sine carriers
          const chirps =
            type === 'warning'
              ? [
                  { start: 0, f1: 1240, f2: 1780, dur: 0.14 },
                  { start: 0.16, f1: 1560, f2: 1120, dur: 0.16 },
                ]
              : [
                  { start: 0, f1: 1360, f2: 1940, dur: 0.12 },
                  { start: 0.14, f1: 1580, f2: 2080, dur: 0.12 },
                  { start: 0.28, f1: 1760, f2: 1140, dur: 0.18 },
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
          // Natural dual-formant vocal "SHHHH!" (palatal-alveolar fricative resonance + sibilant stream)
          const duration = type === 'awake' ? 0.58 : 0.48;
          const bufferSize = Math.floor(ctx.sampleRate * duration);
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          let b0 = 0;
          let b1 = 0;
          let b2 = 0;
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.997 * b0 + white * 0.032;
            b1 = 0.985 * b1 + white * 0.045;
            b2 = 0.95 * b2 + white * 0.068;
            output[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.22) * 3.1));
          }

          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          // Formant 1: Palatal-alveolar "SH" cavity (~2050 Hz -> 1850 Hz)
          const formant1 = ctx.createBiquadFilter();
          formant1.type = 'bandpass';
          formant1.frequency.setValueAtTime(2080, now);
          formant1.frequency.linearRampToValueAtTime(1840, now + duration);
          formant1.Q.setValueAtTime(2.1, now);

          // Formant 2: Upper sibilant breath (~3250 Hz)
          const formant2 = ctx.createBiquadFilter();
          formant2.type = 'bandpass';
          formant2.frequency.setValueAtTime(3280, now);
          formant2.frequency.linearRampToValueAtTime(2950, now + duration);
          formant2.Q.setValueAtTime(2.4, now);

          const f1Gain = ctx.createGain();
          f1Gain.gain.setValueAtTime(0.75, now);
          const f2Gain = ctx.createGain();
          f2Gain.gain.setValueAtTime(0.45, now);

          const envGain = ctx.createGain();
          const peak = type === 'awake' ? 1.15 : 0.96;
          envGain.gain.setValueAtTime(0.001, now);
          envGain.gain.linearRampToValueAtTime(peak, now + 0.055);
          envGain.gain.setValueAtTime(peak * 0.86, now + duration * 0.62);
          envGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

          noise.connect(formant1);
          noise.connect(formant2);
          formant1.connect(f1Gain);
          formant2.connect(f2Gain);
          f1Gain.connect(envGain);
          f2Gain.connect(envGain);
          envGain.connect(masterGain);

          noise.start(now);
          noise.stop(now + duration + 0.02);
        }
      } catch {
        // Ignore browser audio restrictions
      }
    },
    []
  );

  // Continuous Noise Alert Loop while Noisy (with clean listening window between alerts so speaker never self-triggers)
  useEffect(() => {
    if (!hasStarted || isMicMuted || noiseAlert === 'none') return;
    if (timerEndPhase !== 'idle') return;
    const isAlertState =
      sleepState === 'DISTURBED' ||
      sleepState === 'ALMOST_AWAKE' ||
      sleepState === 'AWAKE' ||
      (gameMode === 'bubbles' && sleepState === 'LIGHT_SLEEP');
    if (!isAlertState) {
      return;
    }

    const soundType: 'warning' | 'awake' = sleepState === 'AWAKE' ? 'awake' : 'warning';
    const intervalMs =
      sleepState === 'AWAKE' ? 1350 : sleepState === 'ALMOST_AWAKE' ? 1600 : 1850;

    const id = window.setInterval(() => {
      if (
        stateSnapshotRef.current.isMicMuted ||
        stateSnapshotRef.current.noiseAlert === 'none' ||
        timerEndPhaseRef.current !== 'idle'
      ) {
        return;
      }
      playAlertSound(soundType, undefined, true);
    }, intervalMs);

    return () => clearInterval(id);
  }, [hasStarted, sleepState, isMicMuted, noiseAlert, gameMode, timerEndPhase, playAlertSound]);

  const applySleepState = useCallback(
    (next: SleepState) => {
      if (sleepStateRef.current === next) return;
      const prev = sleepStateRef.current;
      sleepStateRef.current = next;
      lastStateChangeRef.current = performance.now();
      setSleepState(next);

      if (
        next === 'DISTURBED' ||
        next === 'ALMOST_AWAKE' ||
        (stateSnapshotRef.current.gameMode === 'bubbles' &&
          next === 'LIGHT_SLEEP' &&
          prev === 'DEEP_SLEEP')
      ) {
        playAlertSound('warning');
      } else if (next === 'AWAKE' && prev !== 'AWAKE') {
        playAlertSound('awake');
      }
    },
    [playAlertSound]
  );

  // Triggered when the countdown timer reaches 0:
  // 1) Wake up & make sounds for 10 seconds
  // 2) Eat the food from the bowl (~4.5 seconds)
  // 3) Fall back asleep peacefully
  const startTimerOverSequence = useCallback(() => {
    clearTimerEndSequence();

    // Phase 1: Wake up and make hamster sounds for 10 seconds
    timerEndPhaseRef.current = 'awake_10s';
    setTimerEndPhase('awake_10s');
    setWakeSoundSecondsLeft(10);

    sleepStateRef.current = 'AWAKE';
    lastStateChangeRef.current = performance.now();
    setSleepState('AWAKE');

    const getWakeMode = (): NoiseAlertMode =>
      stateSnapshotRef.current.noiseAlert === 'none'
        ? 'hamster'
        : stateSnapshotRef.current.noiseAlert;

    playAlertSound('awake', getWakeMode(), true);
    spawnParticle('star', '⏰ 🐹', 1.65);

    const soundLoopId = window.setInterval(() => {
      if (timerEndPhaseRef.current !== 'awake_10s') return;
      playAlertSound('awake', getWakeMode(), true);
      const notes = ['🎵 🐹', '🎶 🔔', '⏰ ✨', '🐹 💬'];
      spawnParticle('star', notes[Math.floor(Math.random() * notes.length)], 1.45);
    }, 680);

    const countdownTickId = window.setInterval(() => {
      setWakeSoundSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    // Phase 2: After 10 seconds, eat the food
    const toEatTimeoutId = window.setTimeout(() => {
      window.clearInterval(soundLoopId);
      window.clearInterval(countdownTickId);

      timerEndPhaseRef.current = 'eating';
      setTimerEndPhase('eating');
      setWakeSoundSecondsLeft(0);

      // Switch out of startled AWAKE posture so the eating animation renders cleanly
      sleepStateRef.current = 'RECOVERING';
      lastStateChangeRef.current = performance.now();
      setSleepState('RECOVERING');

      playAlertSound('eat');
      spawnParticle('heart', '🌻 😋', 1.6);

      const eatLoopId = window.setInterval(() => {
        if (timerEndPhaseRef.current !== 'eating') return;
        playAlertSound('eat');
        const treats = ['🌻 😋', '🥕 ✨', '🥜 💛', '😋 💕'];
        spawnParticle('heart', treats[Math.floor(Math.random() * treats.length)], 1.5);
      }, 650);
      timerSequenceTimersRef.current.push(eatLoopId);

      // Phase 3: After eating the food (~4.5 seconds), return to sleep
      const toSleepTimeoutId = window.setTimeout(() => {
        window.clearInterval(eatLoopId);
        timerEndPhaseRef.current = 'idle';
        setTimerEndPhase('idle');
        setTimerFinished(false);
        sustainedRef.current = 8;
        recoveryHoldFramesRef.current = 0;
        sleepStateRef.current = 'DEEP_SLEEP';
        lastStateChangeRef.current = performance.now();
        setSleepState('DEEP_SLEEP');
        setSustainedEnergy(8);
        spawnParticle('z', 'Zzz 😴', 1.65);
      }, 4500);

      timerSequenceTimersRef.current.push(toSleepTimeoutId);
    }, 10000);

    timerSequenceTimersRef.current.push(soundLoopId, countdownTickId, toEatTimeoutId);
  }, [clearTimerEndSequence, playAlertSound, spawnParticle]);

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
        const isDuckedForSpeakerAlert = nowPerf < muteMicUntilRef.current;
        if (snap.isMicMuted || isDuckedForSpeakerAlert) {
          // While our own speaker alert is playing, ignore mic input so speaker audio never self-triggers!
          rawInput = 0;
        } else {
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
        }

        // Responsive attack (detects voices accurately in ~200ms) & smooth calm-down release
        const attackRate = 0.13;
        const releaseRate = snap.isMicMuted ? 0.12 : isDuckedForSpeakerAlert ? 0.025 : 0.055;

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

        // When the timer-over sequence is active (10s wake sound phase or eating phase),
        // lock the hamster state to the sequence so quiet room audio doesn't cancel it early.
        if (timerEndPhaseRef.current === 'awake_10s') {
          if (curState !== 'AWAKE') {
            sleepStateRef.current = 'AWAKE';
            setSleepState('AWAKE');
          }
        } else if (timerEndPhaseRef.current === 'eating') {
          if (curState === 'AWAKE') {
            sleepStateRef.current = 'RECOVERING';
            setSleepState('RECOVERING');
          }
        } else if (curState === 'AWAKE') {
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

        // Live Star Portion Draining (Sleeping Mode), Angry Hamster Leaving (Cage Mode), OR Flying Hamster Bubbles (Bubbles Mode)
        const activeState = sleepStateRef.current;
        const isNoisyNow =
          !snap.isMicMuted &&
          timerEndPhaseRef.current === 'idle' &&
          (activeState === 'DISTURBED' || activeState === 'ALMOST_AWAKE' || activeState === 'AWAKE');

        if (isNoisyNow) {
          if (snap.gameMode === 'sleeping') {
            const drainPerSec =
              activeState === 'AWAKE' ? 0.28 : activeState === 'ALMOST_AWAKE' ? 0.17 : 0.085;
            starPointsRef.current = Math.max(0, starPointsRef.current - drainPerSec * dtSec);
          } else if (snap.gameMode === 'cage') {
            // Reset 20s quiet streak while noisy
            if (cageQuietSecRef.current > 0) {
              cageQuietSecRef.current = 0;
              setCageQuietSeconds(0);
            }
            if (
              cageCountRef.current > 0 &&
              !leavingHamsterRef.current &&
              nowPerf >= cageLeaveCooldownUntilRef.current
            ) {
              const noiseSpeed =
                activeState === 'AWAKE' ? 1.35 : activeState === 'ALMOST_AWAKE' ? 0.9 : 0.5;
              cageNoiseAccumRef.current += noiseSpeed * dtSec;
              if (cageNoiseAccumRef.current >= 1.0) {
                cageNoiseAccumRef.current = 0;
                const slotIndex = cageCountRef.current - 1;
                const isBaby = slotIndex >= 10;
                const coatIdx = (snap.coatIndex + slotIndex) % COAT_STYLES.length;
                const leavingInfo: LeavingHamsterState = {
                  slotIndex,
                  isBaby,
                  coatIndex: coatIdx,
                  startedAt: nowPerf,
                };
                cageCountRef.current = Math.max(0, cageCountRef.current - 1);
                setCageCount(cageCountRef.current);
                leavingHamsterRef.current = leavingInfo;
                setLeavingHamster(leavingInfo);
                cageLeaveCooldownUntilRef.current = nowPerf + 1450;

                playAlertSound('awake');
                spawnParticle('star', isBaby ? '💢 🍼' : '💢 😡', 1.55);

                if (leavingTimeoutRef.current) window.clearTimeout(leavingTimeoutRef.current);
                leavingTimeoutRef.current = window.setTimeout(() => {
                  leavingHamsterRef.current = null;
                  setLeavingHamster(null);
                }, 1150);
              }
            }
          }
        } else if (snap.gameMode === 'cage' && cageNoiseAccumRef.current > 0) {
          cageNoiseAccumRef.current = Math.max(0, cageNoiseAccumRef.current - 0.65 * dtSec);
        }

        // 60fps Hamster Cage Walking Patrol Physics:
        // Hamsters walk back & forth across their floor, wooden mezzanine loft, and roof decks with animated stepping feet!
        if (snap.gameMode === 'cage') {
          const walkers = cageWalkersRef.current;
          for (let i = 0; i < ALL_CAGE_SLOTS.length; i++) {
            const w = walkers[i];
            const slot = ALL_CAGE_SLOTS[i];
            if (!w || !slot) continue;

            if (isNoisyNow) {
              w.isWalking = false;
            } else {
              if (w.pauseSec > 0) {
                w.pauseSec = Math.max(0, w.pauseSec - dtSec);
                w.isWalking = false;
              } else {
                w.isWalking = true;
                const speed = slot.walkSpeed ?? 38;
                const range = slot.walkRangeX ?? 72;
                w.x += w.dir * speed * dtSec;
                w.phase += speed * 0.24 * dtSec;
                const minX = slot.x - range;
                const maxX = slot.x + range;
                if (w.x <= minX) {
                  w.x = minX;
                  w.dir = 1;
                  w.pauseSec = 0.55 + ((i * 37) % 9) * 0.08;
                  w.isWalking = false;
                } else if (w.x >= maxX) {
                  w.x = maxX;
                  w.dir = -1;
                  w.pauseSec = 0.55 + ((i * 53) % 9) * 0.08;
                  w.isWalking = false;
                }
                w.y = slot.y;
              }
            }
          }

          if (frameCounter % 2 === 0) {
            setCageWalkersState(walkers.map((item) => ({ ...item })));
          }
        }

        // 60fps Direct-DOM Hardware-Accelerated Hamster Bubbles Physics:
        // - Super-bouncy arcade trampoline rebounds off floor, ceiling & walls with squash-and-stretch
        // - Smooth hold hysteresis so speech syllable gaps never cause launch/brake twitching
        // - Same-zLayer soft elastic mid-air collisions (zero multi-body pile jitter)
        // - Critically damped home settling with soft floor bounces when quiet returns
        if (snap.gameMode === 'bubbles') {
          const balls = hamsterBallsPhysicsRef.current;
          const liveAudio =
            snap.isMicMuted || timerEndPhaseRef.current !== 'idle'
              ? 0
              : Math.max(energy, rawInput * 0.9);
          // Only trigger noise-driven bouncing when sound crosses light sleep / disturbed threshold
          const quietCeiling = Math.max(14, t.light * 0.92);

          let targetDrive = 0;
          if (liveAudio > quietCeiling) {
            if (liveAudio < t.disturbed) {
              const ratio = (liveAudio - quietCeiling) / Math.max(6, t.disturbed - quietCeiling);
              targetDrive = 0.45 + ratio * 0.45;
            } else if (liveAudio < t.awake) {
              const ratio = (liveAudio - t.disturbed) / Math.max(8, t.awake - t.disturbed);
              targetDrive = 0.9 + ratio * 0.55;
            } else {
              const ratio = Math.min(1.4, (liveAudio - t.awake) / Math.max(10, 92 - t.awake));
              targetDrive = 1.45 + ratio * 0.65;
            }
            // Hold active bounce state across syllable pauses (1.15s) to prevent rapid brake/launch twitching
            bubbleExcitedUntilRef.current = Math.max(
              bubbleExcitedUntilRef.current,
              nowPerf + 1150
            );
          }

          const isRoomExcited = nowPerf < bubbleExcitedUntilRef.current;
          const effectiveTargetDrive = isRoomExcited ? Math.max(0.55, targetDrive) : 0;
          const driveBlend = Math.min(1, (effectiveTargetDrive > smoothedBubbleDriveRef.current ? 10 : 3.2) * dtSec);
          smoothedBubbleDriveRef.current +=
            (effectiveTargetDrive - smoothedBubbleDriveRef.current) * driveBlend;
          const activeDrive = isRoomExcited ? Math.max(0.48, smoothedBubbleDriveRef.current) : 0;

          let movingCount = 0;
          const bouncingFlags = new Uint8Array(balls.length);

          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            const spec = HAMSTER_BALL_SPECS[i];
            const minX = spec.r + 14;
            const maxX = 1200 - spec.r - 14;
            const minY = spec.r + 16;
            const maxY = 494 - spec.r;
            const floorBounceY = Math.min(maxY, spec.homeY);

            const isFreeBouncing = nowPerf < (b.freeBounceUntil || 0);
            const isBouncing = isRoomExcited || isFreeBouncing;
            bouncingFlags[i] = isBouncing ? 1 : 0;

            // Recover squash-and-stretch smoothly toward 0
            b.squash = (b.squash || 0) * Math.pow(0.0008, dtSec);
            if (Math.abs(b.squash) < 0.002) b.squash = 0;

            if (isBouncing) {
              const drive = isFreeBouncing ? Math.max(0.95, activeDrive) : activeDrive;
              const speedScale = 0.86 + ((i * 19) % 9) * 0.04;

              // If starting from near-rest, launch upward immediately with a bouncy pop!
              const curSpeed = Math.hypot(b.vx, b.vy);
              if (curSpeed < 65 && b.y >= spec.homeY - 24) {
                const dirSign = (i % 2 === 0 ? 1 : -1) * (0.75 + ((i * 13) % 7) * 0.09);
                b.vx = dirSign * (210 + drive * 185) * speedScale;
                b.vy = -(440 + ((i * 41) % 210) + drive * 250) * speedScale;
                b.squash = -0.14;
              }

              // Bouncy arcade gravity pulls bubbles in high, graceful parabolic arcs
              const gravity = (580 + drive * 180) * speedScale;
              b.vy += gravity * dtSec;

              // Keep lively horizontal velocity so bubbles bounce all across the stage
              const minHoriz = (135 + drive * 150) * speedScale;
              if (Math.abs(b.vx) < minHoriz) {
                const hSign = b.vx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(b.vx);
                b.vx += (hSign * minHoriz - b.vx) * Math.min(1, 4.0 * dtSec);
              }

              // Gentle air-current swirl in mid-air
              const airSwirl = Math.sin(nowPerf * 0.0025 + i * 1.63) * 85 * drive;
              b.vx += airSwirl * dtSec;

              // Cap maximum velocity smoothly
              const maxVel = 620 + drive * 420;
              const newSpeed = Math.hypot(b.vx, b.vy);
              if (newSpeed > maxVel) {
                const s = maxVel / newSpeed;
                b.vx *= s;
                b.vy *= s;
              }

              b.x += b.vx * dtSec;
              b.y += b.vy * dtSec;

              // Super-bouncy trampoline floor rebound!
              if (b.y >= floorBounceY) {
                b.y = floorBounceY;
                const minBounceVy = (430 + ((i * 31) % 210) + drive * 260) * speedScale;
                b.vy = -Math.max(minBounceVy, Math.abs(b.vy) * 0.95);
                b.vx += Math.sin(nowPerf * 0.005 + i * 2.1) * 42;
                b.squash = 0.16;
              } else if (b.y <= minY) {
                // High-elasticity ceiling bounce
                b.y = minY;
                b.vy = Math.max(180, Math.abs(b.vy) * 0.93);
                b.squash = -0.13;
              }

              // High-elasticity left & right wall bounces
              if (b.x <= minX) {
                b.x = minX;
                b.vx = Math.max(160, Math.abs(b.vx) * 0.95);
                b.squash = -0.14;
              } else if (b.x >= maxX) {
                b.x = maxX;
                b.vx = -Math.max(160, Math.abs(b.vx) * 0.95);
                b.squash = -0.14;
              }

              // Playful rotation synced to horizontal bounce
              b.vRot += (b.vx * 0.09 - b.rot * 2.4) * dtSec;
              b.vRot *= Math.pow(0.28, dtSec);
              b.rot = Math.max(-26, Math.min(26, b.rot + b.vRot * dtSec));

              movingCount += 1;
            } else {
              // Quiet Settling Mode: fall with gravity, bounce softly on homeY, and glide smoothly to homeX/homeY
              const distToHome = Math.hypot(spec.homeX - b.x, spec.homeY - b.y);
              const curSpeed = Math.hypot(b.vx, b.vy);

              if (distToHome <= 1.0 && curSpeed <= 10 && Math.abs(b.rot) <= 0.4) {
                // Locked cleanly at home position — 0 twitching!
                b.x = spec.homeX;
                b.y = spec.homeY;
                b.vx = 0;
                b.vy = 0;
                b.rot = 0;
                b.vRot = 0;
                b.squash = 0;
              } else {
                const dx = spec.homeX - b.x;
                const dy = spec.homeY - b.y;

                // Smooth horizontal spring-glide toward homeX
                b.vx += dx * 10.5 * dtSec;
                b.vx *= Math.pow(0.025, dtSec);

                if (b.y < spec.homeY - 3) {
                  // Falling toward homeY with gravity so landing feels bouncy and natural
                  b.vy += 620 * dtSec;
                  b.vy *= Math.pow(0.45, dtSec);
                } else {
                  b.vy += dy * 12.0 * dtSec;
                  b.vy *= Math.pow(0.02, dtSec);
                }

                b.x += b.vx * dtSec;
                b.y += b.vy * dtSec;

                // Soft elastic landing bounce when touching homeY from above
                if (b.y >= spec.homeY && b.vy > 75) {
                  b.y = spec.homeY;
                  b.vy = -b.vy * 0.46;
                  b.squash = Math.min(0.13, Math.abs(b.vy) / 1400);
                } else if (b.y > spec.homeY && Math.abs(b.vy) <= 75) {
                  b.y += (spec.homeY - b.y) * Math.min(1, 14 * dtSec);
                }

                b.x = Math.max(minX, Math.min(maxX, b.x));
                b.y = Math.max(minY, Math.min(maxY, b.y));

                b.rot *= Math.pow(0.015, dtSec);
                b.vRot *= Math.pow(0.015, dtSec);

                if (distToHome > 6 || curSpeed > 28) {
                  movingCount += 1;
                }
              }
            }
          }

          // Same-zLayer Elastic Mid-Air Sphere-to-Sphere Bounces (Only for actively bouncing balls!)
          // Restricting to same zLayer (~11 balls per depth plane) + soft positional separation (0.32)
          // gives crisp mid-air ball bounces with ZERO dense-pile twitching!
          for (let i = 0; i < balls.length; i++) {
            if (!bouncingFlags[i]) continue;
            const b1 = balls[i];
            const spec1 = HAMSTER_BALL_SPECS[i];
            const r1 = spec1.r;
            for (let j = i + 1; j < balls.length; j++) {
              if (!bouncingFlags[j]) continue;
              const spec2 = HAMSTER_BALL_SPECS[j];
              if (spec1.zLayer !== spec2.zLayer) continue;

              const b2 = balls[j];
              const r2 = spec2.r;
              const dx = b2.x - b1.x;
              const dy = b2.y - b1.y;
              const distSq = dx * dx + dy * dy;
              const minSep = (r1 + r2) * 0.92;

              if (distSq < minSep * minSep) {
                const dist = Math.sqrt(Math.max(0.01, distSq));
                const nx = dx / dist;
                const ny = dy / dist;
                const overlap = minSep - dist;

                // Soft spring positional separation (0.32 factor prevents multi-body teleport jitter)
                const totalR = r1 + r2;
                const w1 = (r2 / totalR) * 0.32;
                const w2 = (r1 / totalR) * 0.32;
                b1.x -= nx * overlap * w1;
                b1.y -= ny * overlap * w1;
                b2.x += nx * overlap * w2;
                b2.y += ny * overlap * w2;

                const rvx = b2.vx - b1.vx;
                const rvy = b2.vy - b1.vy;
                const velAlongNormal = rvx * nx + rvy * ny;
                if (velAlongNormal < 0) {
                  const restitution = 0.94;
                  const impulse = -(1 + restitution) * velAlongNormal * 0.5;
                  b1.vx -= impulse * nx;
                  b1.vy -= impulse * ny;
                  b2.vx += impulse * nx;
                  b2.vy += impulse * ny;
                  b1.squash = 0.11;
                  b2.squash = 0.11;
                }
              }
            }
          }

          // Direct 60fps DOM Transform Updates with Squash-and-Stretch
          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            const spec = HAMSTER_BALL_SPECS[i];
            const groupEl = bubbleGroupRefs.current[i];
            if (groupEl) {
              const sq = b.squash || 0;
              if (Math.abs(sq) > 0.003) {
                const sx = (1 + sq).toFixed(3);
                const sy = (1 - sq * 0.85).toFixed(3);
                groupEl.setAttribute(
                  'transform',
                  `translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(1)}) scale(${sx}, ${sy})`
                );
              } else {
                groupEl.setAttribute(
                  'transform',
                  `translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)}) rotate(${b.rot.toFixed(1)})`
                );
              }
            }
            const shadowEl = bubbleShadowRefs.current[i];
            if (shadowEl) {
              const baseRestY = spec.homeY;
              const lift = Math.max(0, baseRestY - b.y);
              const shadowScale = Math.max(0.25, 1 - lift / 340);
              const shadowY = Math.min(504, Math.max(b.y, baseRestY) + spec.r * 0.92);
              shadowEl.setAttribute('cx', b.x.toFixed(1));
              shadowEl.setAttribute('cy', shadowY.toFixed(1));
              shadowEl.setAttribute('rx', (spec.r * 0.95 * shadowScale).toFixed(1));
              shadowEl.setAttribute('ry', (spec.r * 0.24 * shadowScale).toFixed(1));
              shadowEl.setAttribute('opacity', shadowScale.toFixed(2));
            }
          }

          // Only trigger React state update when calm/flying state transitions
          const wasFlying = bubblesFlyingCountRef.current > 0;
          const isFlying = movingCount > 0;
          if (wasFlying !== isFlying) {
            bubblesFlyingCountRef.current = movingCount;
            setBubblesFlyingCount(movingCount);
            setHamsterBallsState(balls.map((item) => ({ ...item })));
          } else {
            bubblesFlyingCountRef.current = movingCount;
          }
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
  }, [hasStarted, applySleepState, playAlertSound, spawnParticle]);

  // 1-second Quiet Clock / Countdown Timer & Mode Quiet Rewards (1-Min Star OR 20s Hamster Cage Appear)
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
            startTimerOverSequence();
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });

      const isQuietNow =
        !snap.isMicMuted &&
        timerEndPhaseRef.current === 'idle' &&
        (st === 'DEEP_SLEEP' || st === 'LIGHT_SLEEP' || st === 'RECOVERING');

      if (snap.gameMode === 'sleeping') {
        // Accumulate quiet seconds when calm; add +1 star every 60 quiet seconds!
        if (isQuietNow) {
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
      } else if (snap.gameMode === 'cage') {
        // Every 10 quiet seconds, 1 new hamster appears (1..10 adults, 11..20 baby hamsters) and starts walking!
        if (isQuietNow && !leavingHamsterRef.current) {
          if (cageCountRef.current < 20) {
            cageQuietSecRef.current += 1;
            if (cageQuietSecRef.current >= CAGE_QUIET_APPEAR_SECONDS) {
              cageQuietSecRef.current = 0;
              setCageQuietSeconds(0);
              const arrivedSlot = cageCountRef.current;
              const nextCount = Math.min(20, cageCountRef.current + 1);
              cageCountRef.current = nextCount;
              setCageCount(nextCount);
              if (cageWalkersRef.current[arrivedSlot]) {
                const slotDef = ALL_CAGE_SLOTS[arrivedSlot];
                cageWalkersRef.current[arrivedSlot].x = slotDef ? slotDef.x : cageWalkersRef.current[arrivedSlot].x;
                cageWalkersRef.current[arrivedSlot].pauseSec = 0;
                cageWalkersRef.current[arrivedSlot].isWalking = true;
              }
              setJustArrivedSlot(arrivedSlot);
              if (arriveTimeoutRef.current) window.clearTimeout(arriveTimeoutRef.current);
              arriveTimeoutRef.current = window.setTimeout(() => {
                setJustArrivedSlot(null);
              }, 1150);

              playAlertSound('star');
              spawnParticle(
                'star',
                nextCount > 10 ? '+1 🍼 Baby!' : '+1 🐹',
                1.6
              );
            } else {
              setCageQuietSeconds(cageQuietSecRef.current);
            }
          } else if (cageQuietSecRef.current !== 0) {
            cageQuietSecRef.current = 0;
            setCageQuietSeconds(0);
          }
        } else if (st === 'DISTURBED' || st === 'ALMOST_AWAKE' || st === 'AWAKE') {
          cageQuietSecRef.current = 0;
          setCageQuietSeconds(0);
        }
      }
    }, 1000);

    return () => clearInterval(id);
  }, [hasStarted, playAlertSound, spawnParticle, startTimerOverSequence]);

  // Floating Zzz generator while sleeping peacefully (Sleeping Hamster mode)
  useEffect(() => {
    if (!hasStarted || gameMode !== 'sleeping') return;
    const id = window.setInterval(() => {
      if (timerEndPhaseRef.current !== 'idle') return;
      const st = sleepStateRef.current;
      if (st === 'DEEP_SLEEP' || st === 'LIGHT_SLEEP' || st === 'RECOVERING') {
        const sizeRem =
          st === 'DEEP_SLEEP' ? 1.35 + Math.random() * 0.85 : 1.0 + Math.random() * 0.4;
        spawnParticle('z', 'Z', sizeRem);
      }
    }, 950);
    return () => clearInterval(id);
  }, [hasStarted, gameMode, spawnParticle]);

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

  const resetHamsterBallsPositions = useCallback(() => {
    const resetList = createInitialHamsterBallsState();
    hamsterBallsPhysicsRef.current = resetList;
    bubblesFlyingCountRef.current = 0;
    bubbleExcitedUntilRef.current = 0;
    smoothedBubbleDriveRef.current = 0;
    setHamsterBallsState(resetList);
    setBubblesFlyingCount(0);
  }, []);

  const handleClickHamsterBubble = useCallback(
    (ballId: number) => {
      if (!hasStarted) return;
      const nowPerf = performance.now();
      const balls = hamsterBallsPhysicsRef.current;
      const target = balls.find((b) => b.id === ballId);
      if (target) {
        target.vy = -560 - Math.random() * 140;
        target.vx = (Math.random() - 0.5) * 440;
        target.vRot = (Math.random() - 0.5) * 180;
        target.freeBounceUntil = nowPerf + 4500;
        target.squash = -0.16;

        // Also give nearby bubbles a joyful sympathetic bounce!
        for (let i = 0; i < balls.length; i++) {
          const other = balls[i];
          if (other.id === ballId) continue;
          const dist = Math.hypot(other.x - target.x, other.y - target.y);
          if (dist < 175) {
            const pushDir = other.x >= target.x ? 1 : -1;
            other.vy = -420 - Math.random() * 160;
            other.vx = pushDir * (160 + Math.random() * 180);
            other.freeBounceUntil = Math.max(other.freeBounceUntil || 0, nowPerf + 3200);
            other.squash = -0.12;
          }
        }

        bubblesFlyingCountRef.current = Math.max(1, bubblesFlyingCountRef.current);
        setBubblesFlyingCount(bubblesFlyingCountRef.current);
      }
      playAlertSound('pet');
      spawnParticle('heart', '🫧 💖', 1.5);
    },
    [hasStarted, playAlertSound, spawnParticle]
  );

  const handleStartWithMic = async () => {
    setMicError(null);
    setIsConnectingMic(true);
    try {
      await connectMicrophoneStream();
      clearTimerEndSequence();
      sustainedRef.current = 8;
      sleepStateRef.current = 'DEEP_SLEEP';
      lastStateChangeRef.current = performance.now();
      starPointsRef.current = 3.0;
      quietMinuteAccumRef.current = 0;
      cageCountRef.current = 3;
      cageQuietSecRef.current = 0;
      cageNoiseAccumRef.current = 0;
      cageLeaveCooldownUntilRef.current = 0;
      leavingHamsterRef.current = null;
      setLeavingHamster(null);
      setJustArrivedSlot(null);
      setCageCount(3);
      setCageQuietSeconds(0);
      resetHamsterBallsPositions();
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
    clearTimerEndSequence();
    sustainedRef.current = 8;
    sleepStateRef.current = 'DEEP_SLEEP';
    lastStateChangeRef.current = performance.now();
    starPointsRef.current = 3.0;
    quietMinuteAccumRef.current = 0;
    cageCountRef.current = 3;
    cageQuietSecRef.current = 0;
    cageNoiseAccumRef.current = 0;
    cageLeaveCooldownUntilRef.current = 0;
    leavingHamsterRef.current = null;
    if (leavingTimeoutRef.current) window.clearTimeout(leavingTimeoutRef.current);
    if (arriveTimeoutRef.current) window.clearTimeout(arriveTimeoutRef.current);
    setLeavingHamster(null);
    setJustArrivedSlot(null);
    setCageCount(3);
    setCageQuietSeconds(0);
    resetHamsterBallsPositions();
    setSleepState('DEEP_SLEEP');
    setSustainedEnergy(8);
    setStarPoints(3.0);
    setStarSlots(3);
    setTimerFinished(false);
    setIsTimerPaused(false);
    setTimerSeconds(timerMode === 'countdown' ? countdownDuration : 0);
  };

  const handleSwitchGameMode = (mode: NoiseControlMode) => {
    if (mode === gameMode) return;
    setGameMode(mode);
    gameModeRef.current = mode;
    cageQuietSecRef.current = 0;
    cageNoiseAccumRef.current = 0;
    setCageQuietSeconds(0);
    if (mode === 'cage' && cageCountRef.current === 0 && !leavingHamsterRef.current) {
      cageCountRef.current = 3;
      setCageCount(3);
    }
    if (mode === 'bubbles') {
      resetHamsterBallsPositions();
    }
  };

  const syncEditFieldsFromSeconds = (baseSeconds: number) => {
    const safe = Math.max(0, baseSeconds);
    setEditHours(Math.min(23, Math.floor(safe / 3600)));
    setEditMinutes(Math.floor((safe % 3600) / 60));
    setEditSeconds(safe % 60);
  };

  const handleApplyEditedTimer = () => {
    clearTimerEndSequence();
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
    clearTimerEndSequence();
    setTimerMode('up');
    setTimerSeconds(0);
    setTimerFinished(false);
    setIsTimerPaused(false);
    setIsTimerMenuOpen(false);
  };

  const handleSelectTimerOption = (openEditor = true) => {
    clearTimerEndSequence();
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

  const ensureAudioContextReady = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  const handleMusicButtonClick = (trackId: number) => {
    ensureAudioContextReady();
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
    ensureAudioContextReady();
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
    if (timerEndPhaseRef.current !== 'idle') return;
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
        @keyframes shChewCheeks {
          0%, 100% { transform: scale(1, 1) translateY(0); }
          50% { transform: scale(1.06, 0.95) translateY(-2px); }
        }
        @keyframes shTreatNibble {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-5px) rotate(5deg); }
        }
        @keyframes shMouthMunch {
          0%, 100% { transform: scaleY(0.55); }
          50% { transform: scaleY(1.25); }
        }
        .sh-enclosure-shake { animation: shEnclosureShake 0.45s infinite; }
        .sh-body-calm { transform-origin: 500px 410px; animation: shBreatheCalm 4.2s ease-in-out infinite; }
        .sh-body-fast { transform-origin: 500px 410px; animation: shBreatheFast 1.4s ease-in-out infinite; }
        .sh-chew-cheeks { transform-origin: 485px 380px; animation: shChewCheeks 0.28s ease-in-out infinite; }
        .sh-treat-nibble { transform-origin: 482px 392px; animation: shTreatNibble 0.28s ease-in-out infinite; }
        .sh-mouth-munch { transform-origin: 472px 382px; animation: shMouthMunch 0.28s ease-in-out infinite; }
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
        @keyframes shHamsterLeave {
          0% { transform: translate(0px, 0px) scale(1) rotate(0deg); opacity: 1; }
          22% { transform: translate(12px, -16px) scale(1.08) rotate(-6deg); opacity: 1; }
          55% { transform: translate(70px, -10px) scale(1.02) rotate(8deg); opacity: 0.95; }
          100% { transform: translate(165px, -34px) scale(0.7) rotate(14deg); opacity: 0; }
        }
        @keyframes shHamsterArrive {
          0% { transform: scale(0.2) translateY(20px); opacity: 0; }
          65% { transform: scale(1.16) translateY(-10px); opacity: 1; }
          100% { transform: scale(1) translateY(0px); opacity: 1; }
        }
        @keyframes shCageBob {
          0%, 100% { transform: translateY(0px) scale(1, 1); }
          50% { transform: translateY(-4px) scale(1.02, 0.98); }
        }
        @keyframes shAngryShake {
          0%, 100% { transform: translateX(0px); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .sh-star-drain { animation: shStarDrainShake 0.45s ease-in-out infinite; }
        .sh-hamster-leave { animation: shHamsterLeave 1.15s ease-in forwards; }
        .sh-hamster-arrive { animation: shHamsterArrive 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .sh-cage-bob { animation: shCageBob 2.6s ease-in-out infinite; }
        .sh-angry-shake { animation: shAngryShake 0.18s linear infinite; }
      `}</style>

      {/* CLEAN TOP HEADER: Left navigation, Mode & Themes | Center Time & Stars / Cage HUD */}
      {hasStarted && (
        <header className="relative z-40 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-6 pt-3 pb-2 shrink-0">
          {/* Left Navigation, Game Mode Switcher, Theme & Coat Color */}
          <div className="flex items-center flex-wrap gap-2 justify-self-start">
            <button
              type="button"
              onClick={() => onViewChange('home')}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs sm:text-sm font-bold text-white/90 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* In-Game Mode Switcher: Sleeping Hamster | Hamster Cage | Hamster Bubbles */}
            <div
              className="inline-flex items-center gap-1 bg-black/35 border border-white/15 rounded-xl p-1 shrink-0"
              role="group"
              aria-label="Noise Control Mode"
            >
              <button
                type="button"
                onClick={() => handleSwitchGameMode('sleeping')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  gameMode === 'sleeping'
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'text-purple-200/75 hover:text-white'
                }`}
              >
                Sleeping Hamster
              </button>
              <button
                type="button"
                onClick={() => handleSwitchGameMode('cage')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  gameMode === 'cage'
                    ? 'bg-amber-400 text-purple-950 shadow-sm'
                    : 'text-purple-200/75 hover:text-white'
                }`}
              >
                Hamster Cage
              </button>
              <button
                type="button"
                onClick={() => handleSwitchGameMode('bubbles')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap shrink-0 ${
                  gameMode === 'bubbles'
                    ? 'bg-pink-400 text-purple-950 shadow-sm'
                    : 'text-purple-200/75 hover:text-white'
                }`}
              >
                Hamster Bubbles
              </button>
            </div>

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
              <span className="hidden xl:inline">{currentTheme.name}</span>
              <Palette size={14} className="xl:hidden" />
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
              <span className="hidden 2xl:inline">{currentCoat.name}</span>
              <Palette size={14} className="2xl:hidden" />
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

          {/* CENTER HUD: Bigger Stopwatch/Editable Timer + Mode Progress (Stars OR Hamster Cage OR Hamster Bubbles) */}
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
                    {timerMode === 'countdown' && timerEndPhase === 'awake_10s'
                      ? `Woke Up! (${wakeSoundSecondsLeft}s)`
                      : timerMode === 'countdown' && timerEndPhase === 'eating'
                      ? 'Eating Food 🌻'
                      : timerMode === 'countdown' && timerFinished
                      ? 'Timer Done!'
                      : 'Timer'}
                  </button>
                </div>
                <span
                  className={`${
                    (timerMode === 'countdown' && countdownDuration >= 3600) || timerSeconds >= 3600
                      ? 'text-3xl sm:text-4xl md:text-[2.7rem]'
                      : 'text-4xl sm:text-5xl md:text-[3.35rem]'
                  } font-black font-mono tabular-nums leading-none ${
                    timerEndPhase === 'awake_10s'
                      ? 'text-amber-300 animate-pulse'
                      : timerEndPhase === 'eating'
                      ? 'text-emerald-300'
                      : timerFinished
                      ? 'text-emerald-300 animate-pulse'
                      : 'text-white'
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
                  title={
                    gameMode === 'cage'
                      ? 'Reset Time & Cage (3 Hamsters)'
                      : gameMode === 'bubbles'
                      ? 'Reset Time & Hamster Bubbles'
                      : 'Reset Time & Stars'
                  }
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

            {gameMode === 'sleeping' ? (
              /* Bigger Individual Stars (Default 3, No Numeric Count, Live Portion Draining when Noisy) */
              <div
                className="flex items-center gap-2.5 sm:gap-3"
                title="Quiet for 1 minute adds a star. Noise drains the active star live!"
              >
                {Array.from({ length: starSlots }).map((_, idx) => {
                  const fill = Math.max(0, Math.min(1, starPoints - idx));
                  const isNoisyNow =
                    !isMicMuted &&
                    timerEndPhase === 'idle' &&
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
            ) : gameMode === 'cage' ? (
              /* Hamster Cage Counter & 20s Quiet Progress HUD */
              <div className="flex flex-col gap-1.5 min-w-[205px]">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-lg">🐹</span>
                    <span className="text-sm sm:text-base font-black text-white tabular-nums">
                      {Math.min(10, cageCount)}/10
                    </span>
                    <span className="text-[11px] font-bold text-purple-200/75 uppercase">
                      Adults
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-base">🍼</span>
                    <span
                      className={`text-sm sm:text-base font-black tabular-nums ${
                        cageCount > 10 ? 'text-pink-300' : 'text-purple-200/55'
                      }`}
                    >
                      {Math.max(0, cageCount - 10)}/10
                    </span>
                    <span className="text-[11px] font-bold text-pink-200/80 uppercase">
                      Babies
                    </span>
                  </div>
                </div>

                {/* 10-Second Quiet Progress Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2.5 bg-black/45 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-[width] duration-300"
                      style={{
                        width:
                          cageCount >= 20
                            ? '100%'
                            : `${Math.min(100, (cageQuietSeconds / CAGE_QUIET_APPEAR_SECONDS) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums font-extrabold text-emerald-300 whitespace-nowrap">
                    {cageCount >= 20
                      ? 'MAX 20/20'
                      : `Quiet ${cageQuietSeconds}/${CAGE_QUIET_APPEAR_SECONDS}s`}
                  </span>
                </div>
              </div>
            ) : (
              /* Hamster Bubbles Counter & Live Calm/Flying Status HUD */
              <div className="flex flex-col gap-1.5 min-w-[215px]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <span className="text-lg">🫧</span>
                    <span className="text-sm sm:text-base font-black text-white tabular-nums">
                      {HAMSTER_BALL_SPECS.length}
                    </span>
                    <span className="text-[11px] font-bold text-pink-200/90 uppercase">
                      Hamster Balls
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap ${
                      bubblesFlyingCount > 0 ||
                      sleepState === 'DISTURBED' ||
                      sleepState === 'ALMOST_AWAKE' ||
                      sleepState === 'AWAKE'
                        ? 'bg-rose-500/35 text-rose-200 border border-rose-300/50 animate-pulse'
                        : 'bg-emerald-500/30 text-emerald-200 border border-emerald-300/40'
                    }`}
                  >
                    {bubblesFlyingCount > 0 ||
                    sleepState === 'DISTURBED' ||
                    sleepState === 'ALMOST_AWAKE' ||
                    sleepState === 'AWAKE'
                      ? '🤫 Shhh! Flying!'
                      : '✨ Quiet in Place'}
                  </span>
                </div>
                <div className="text-[11px] font-bold text-pink-100/80 whitespace-nowrap">
                  {bubblesFlyingCount > 0 ||
                  sleepState === 'DISTURBED' ||
                  sleepState === 'ALMOST_AWAKE' ||
                  sleepState === 'AWAKE'
                    ? 'Be quiet so the hamster bubbles settle down!'
                    : 'Quiet classroom keeps all bubbles settled!'}
                </div>
              </div>
            )}

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
          {/* LIVING 3D GLASS HAMSTER HABITAT OR 3D HAMSTER BUBBLES COLLECTION */}
          <main className="flex-1 relative flex items-center justify-center min-h-[260px] pt-2">
            {gameMode === 'bubbles' ? (
              <div
                className={`relative w-full h-full max-h-[580px] rounded-[2.25rem] border-[5px] transition-all duration-300 flex items-center justify-center overflow-hidden ${
                  sleepState === 'AWAKE'
                    ? 'border-rose-400 shadow-[0_24px_65px_rgba(244,63,94,0.35),0_0_75px_rgba(244,63,94,0.45)] sh-enclosure-shake'
                    : sleepState === 'ALMOST_AWAKE' || sleepState === 'DISTURBED'
                    ? 'border-amber-300 shadow-[0_24px_65px_rgba(251,191,36,0.3),0_0_60px_rgba(251,191,36,0.35)]'
                    : 'border-pink-200/90 shadow-[0_24px_65px_rgba(131,24,67,0.28),0_0_45px_rgba(249,168,212,0.35)]'
                }`}
                style={{
                  background:
                    'linear-gradient(180deg, #F7C9D7 0%, #FCE0E5 56%, #FFF0F0 86%, #FCE4EC 100%)',
                }}
              >
                {/* Floating Zzz / Hearts / Stars Particles */}
                <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
                  {particles.map((p) => (
                    <div
                      key={p.id}
                      className="sh-particle absolute bottom-[34%] font-black text-rose-600 drop-shadow-[0_2px_10px_rgba(255,255,255,0.95)]"
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

                {/* Live Shh! Flying Status Banner when Noisy */}
                {hasStarted &&
                  (sleepState === 'DISTURBED' ||
                    sleepState === 'ALMOST_AWAKE' ||
                    sleepState === 'AWAKE') && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                      <div className="px-5 py-2.5 rounded-2xl bg-rose-500/95 border-2 border-white shadow-[0_12px_30px_rgba(225,29,72,0.4)] text-white text-xs sm:text-sm font-black tracking-wide flex items-center gap-2 animate-bounce whitespace-nowrap">
                        <span className="text-lg">🤫</span>
                        <span>SHHH! Too noisy! Be quiet so the Hamster Bubbles stay in place!</span>
                      </div>
                    </div>
                  )}

                {/* 4K-Style Wide 3D Hamster Balls Collection SVG */}
                <svg
                  viewBox="0 0 1200 540"
                  preserveAspectRatio="xMidYMid slice"
                  className="w-full h-full select-none"
                >
                  <defs>
                    {/* Light Pastel Pink Studio Backdrop Gradient (#F7C9D7 -> #FCE0E5 -> #FFF0F0) */}
                    <linearGradient id="hbPastelPinkBg" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#F7C9D7" />
                      <stop offset="55%" stopColor="#FCE0E5" />
                      <stop offset="88%" stopColor="#FFF0F0" />
                      <stop offset="100%" stopColor="#F9D5E0" />
                    </linearGradient>

                    {/* Soft Studio Ground Plane Gradient */}
                    <linearGradient id="hbGroundPlane" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFF0F0" stopOpacity="0" />
                      <stop offset="35%" stopColor="#FADCE4" stopOpacity="0.65" />
                      <stop offset="100%" stopColor="#F2B8C8" stopOpacity="0.92" />
                    </linearGradient>

                    {/* Soft Contact Shadow Gradient under each Sphere */}
                    <radialGradient id="hbContactShadow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#88294A" stopOpacity="0.42" />
                      <stop offset="55%" stopColor="#B54D70" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#F7C9D7" stopOpacity="0" />
                    </radialGradient>

                    {/* Cozy Golden Bedding Cushion Inside Bottom of Each Sphere */}
                    <linearGradient id="hbInnerBedding" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FDE68A" />
                      <stop offset="55%" stopColor="#F59E0B" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>

                    {/* 3D Pink Heart Nose Gradient */}
                    <radialGradient id="hbPinkNose" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor="#fbcfe8" />
                      <stop offset="55%" stopColor="#f472b6" />
                      <stop offset="100%" stopColor="#be185d" />
                    </radialGradient>

                    {/* 8 Colorful Transparent Sphere Rim Gradients & Inner Glass Tints */}
                    {HAMSTER_BALL_RIMS.map((rim, rIdx) => (
                      <React.Fragment key={`hb-rim-def-${rim.id}`}>
                        <linearGradient
                          id={`hbRimOuterGrad-${rIdx}`}
                          x1="15%"
                          y1="10%"
                          x2="85%"
                          y2="90%"
                        >
                          <stop offset="0%" stopColor={rim.rimLight} />
                          <stop offset="48%" stopColor={rim.rimMid} />
                          <stop offset="100%" stopColor={rim.rimDark} />
                        </linearGradient>
                        <radialGradient
                          id={`hbSphereGlassGrad-${rIdx}`}
                          cx="36%"
                          cy="32%"
                          r="68%"
                        >
                          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.02" />
                          <stop offset="68%" stopColor={rim.rimLight} stopOpacity="0.08" />
                          <stop offset="88%" stopColor={rim.rimMid} stopOpacity="0.24" />
                          <stop offset="100%" stopColor={rim.rimDark} stopOpacity="0.42" />
                        </radialGradient>
                      </React.Fragment>
                    ))}

                    {/* 7 Hamster Fur Combination Gradients */}
                    {HAMSTER_BALL_FURS.map((fur, fIdx) => (
                      <radialGradient
                        key={`hb-fur-def-${fur.id}`}
                        id={`hbFurGrad-${fIdx}`}
                        cx="42%"
                        cy="28%"
                        r="70%"
                      >
                        <stop offset="0%" stopColor={fur.furLight} />
                        <stop offset="55%" stopColor={fur.furMid} />
                        <stop offset="100%" stopColor={fur.furDark} />
                      </radialGradient>
                    ))}

                    {/* ClipPath for unit sphere (r = 100) */}
                    <clipPath id="hbUnitSphereClip">
                      <circle cx="0" cy="0" r="93" />
                    </clipPath>
                  </defs>

                  {/* 1. Light Pastel Pink Studio Background & Ground Plane */}
                  <rect width="1200" height="540" fill="url(#hbPastelPinkBg)" />
                  <ellipse
                    cx="600"
                    cy="210"
                    rx="560"
                    ry="190"
                    fill="#ffffff"
                    opacity="0.28"
                  />
                  <rect x="0" y="458" width="1200" height="82" fill="url(#hbGroundPlane)" />

                  {/* 2. Soft Contact Shadows on the Ground Plane beneath all 44 Hamster Balls */}
                  <g>
                    {HAMSTER_BALL_SPECS.map((spec, idx) => {
                      const bState =
                        hamsterBallsPhysicsRef.current[idx] ||
                        hamsterBallsState[idx] || {
                          x: spec.homeX,
                          y: spec.homeY,
                          restY: spec.homeY,
                        };
                      const baseRestY = spec.homeY;
                      const lift = Math.max(0, baseRestY - bState.y);
                      const shadowScale = Math.max(0.25, 1 - lift / 340);
                      const shadowY = Math.min(504, Math.max(bState.y, baseRestY) + spec.r * 0.92);
                      return (
                        <ellipse
                          key={`hb-shadow-${spec.id}`}
                          ref={(el) => {
                            bubbleShadowRefs.current[idx] = el;
                          }}
                          cx={bState.x}
                          cy={shadowY}
                          rx={spec.r * 0.95 * shadowScale}
                          ry={spec.r * 0.24 * shadowScale}
                          fill="url(#hbContactShadow)"
                          opacity={shadowScale}
                        />
                      );
                    })}
                  </g>

                  {/* 3. Layered Collection of 44 Transparent 3D Hamster Balls (Sorted Back-to-Front by zLayer) */}
                  <g>
                    {[...HAMSTER_BALL_SPECS]
                      .map((spec, idx) => ({
                        spec,
                        idx,
                        bState:
                          hamsterBallsPhysicsRef.current[idx] ||
                          hamsterBallsState[idx] || {
                            id: spec.id,
                            x: spec.homeX,
                            y: spec.homeY,
                            vx: 0,
                            vy: 0,
                            rot: 0,
                            vRot: 0,
                            restY: spec.homeY,
                            driftAngle: 0,
                            freeBounceUntil: 0,
                            squash: 0,
                          },
                      }))
                      .sort((a, b) => a.spec.zLayer - b.spec.zLayer)
                      .map(({ spec, idx, bState }) => {
                        const rim = HAMSTER_BALL_RIMS[spec.rimIdx % HAMSTER_BALL_RIMS.length];
                        const resolvedFurIdx =
                          (spec.furIdx + coatIndex) % HAMSTER_BALL_FURS.length;
                        const fur = HAMSTER_BALL_FURS[resolvedFurIdx];
                        const scale = spec.r / 100;
                        const flipX = spec.flip ? -1 : 1;
                        const isFlyingNow =
                          bubblesFlyingCount > 0 ||
                          sleepState === 'DISTURBED' ||
                          sleepState === 'ALMOST_AWAKE' ||
                          sleepState === 'AWAKE';
                        const activePose: HamsterBallPose = isFlyingNow
                          ? spec.id % 2 === 0
                            ? 'surprised'
                            : 'wave'
                          : spec.pose;
                        const sq = bState.squash || 0;
                        const transformStr =
                          Math.abs(sq) > 0.003
                            ? `translate(${bState.x.toFixed(1)}, ${bState.y.toFixed(1)}) rotate(${bState.rot.toFixed(1)}) scale(${(1 + sq).toFixed(3)}, ${(1 - sq * 0.85).toFixed(3)})`
                            : `translate(${bState.x.toFixed(1)}, ${bState.y.toFixed(1)}) rotate(${bState.rot.toFixed(1)})`;

                        return (
                          <g
                            key={`hamster-ball-${spec.id}`}
                            ref={(el) => {
                              bubbleGroupRefs.current[idx] = el;
                            }}
                            transform={transformStr}
                            onClick={() => handleClickHamsterBubble(spec.id)}
                            className="cursor-pointer"
                          >
                            <title>
                              {`${rim.name} Hamster Ball #${spec.id} (${fur.name}) — Click to bounce!`}
                            </title>
                            <g
                              className={!isFlyingNow ? 'sh-cage-bob' : undefined}
                              style={
                                !isFlyingNow
                                  ? { animationDelay: `${(spec.id % 9) * 0.25}s` }
                                  : undefined
                              }
                            >
                              <g transform={`scale(${scale})`}>
                                {/* Back Transparent Sphere Fill */}
                                <circle
                                  cx="0"
                                  cy="0"
                                  r="95"
                                  fill="rgba(255, 255, 255, 0.22)"
                                />

                                {/* Subtle Back Ventilation Holes */}
                                <g fill="rgba(255,255,255,0.42)" stroke={rim.rimMid} strokeWidth="1.2" opacity="0.55">
                                  <circle cx="-54" cy="-54" r="4.2" />
                                  <circle cx="54" cy="-54" r="4.2" />
                                  <circle cx="-68" cy="0" r="4.2" />
                                  <circle cx="68" cy="0" r="4.2" />
                                  <circle cx="0" cy="-72" r="4.2" />
                                </g>

                                {/* Interior Clipped Group: Golden Bedding Cushion + 3D Adorable Hamster */}
                                <g clipPath="url(#hbUnitSphereClip)">
                                  {/* Cozy Golden-Cream Bedding at Bottom of Sphere */}
                                  <path
                                    d="M -94 56 Q -45 42 0 46 Q 45 42 94 56 L 94 100 L -94 100 Z"
                                    fill="url(#hbInnerBedding)"
                                    opacity="0.92"
                                  />
                                  <ellipse
                                    cx="0"
                                    cy="55"
                                    rx="76"
                                    ry="14"
                                    fill="#FEF3C7"
                                    opacity="0.78"
                                  />

                                  {/* 3D HAMSTER CHARACTER INSIDE SPHERE */}
                                  <g
                                    transform={`translate(0, ${
                                      activePose === 'standing' ? 4 : 10
                                    }) scale(${flipX}, 1) rotate(${
                                      activePose === 'tilted' ? 8 : 0
                                    })`}
                                  >
                                    {/* Soft Contact Shadow on Bedding */}
                                    <ellipse
                                      cx="0"
                                      cy="52"
                                      rx="54"
                                      ry="12"
                                      fill="rgba(120, 53, 15, 0.35)"
                                    />

                                    {/* Tiny Rounded Ears */}
                                    <g transform="translate(-38, -50) rotate(-18)">
                                      <ellipse
                                        cx="0"
                                        cy="0"
                                        rx="17"
                                        ry="18"
                                        fill={`url(#hbFurGrad-${resolvedFurIdx})`}
                                        stroke={fur.stroke}
                                        strokeWidth="3.2"
                                      />
                                      <ellipse cx="1" cy="2" rx="10.5" ry="11" fill="#f48fb1" />
                                    </g>
                                    <g transform="translate(38, -50) rotate(18)">
                                      <ellipse
                                        cx="0"
                                        cy="0"
                                        rx="17"
                                        ry="18"
                                        fill={`url(#hbFurGrad-${resolvedFurIdx})`}
                                        stroke={fur.stroke}
                                        strokeWidth="3.2"
                                      />
                                      <ellipse cx="-1" cy="2" rx="10.5" ry="11" fill="#f48fb1" />
                                    </g>

                                    {/* Short Little Hind Paws */}
                                    <ellipse
                                      cx="-34"
                                      cy="50"
                                      rx="14"
                                      ry="8.5"
                                      fill="#fda4af"
                                      stroke="#9f1239"
                                      strokeWidth="2.4"
                                    />
                                    <ellipse
                                      cx="34"
                                      cy="50"
                                      rx="14"
                                      ry="8.5"
                                      fill="#fda4af"
                                      stroke="#9f1239"
                                      strokeWidth="2.4"
                                    />

                                    {/* Round Chubby Body & Oversized Head with Puffy Cheeks */}
                                    <path
                                      d="M -52 -18 C -56 -46, -34 -64, 0 -64 C 34 -64, 56 -46, 52 -18 C 66 -4, 68 24, 56 44 C 46 58, 24 60, 0 60 C -24 60, -46 58, -56 44 C -68 24, -66 -4, -52 -18 Z"
                                      fill={`url(#hbFurGrad-${resolvedFurIdx})`}
                                      stroke={fur.stroke}
                                      strokeWidth="3.4"
                                      strokeLinejoin="round"
                                    />

                                    {/* Soft Fluffy Belly & Puffy Cheek Pouches */}
                                    <path
                                      d="M -54 8 C -58 -6, -40 -15, -22 -9 C -9 -4, 9 -4, 22 -9 C 40 -15, 58 -6, 54 8 C 58 30, 44 56, 0 57 C -44 56, -58 30, -54 8 Z"
                                      fill={fur.belly}
                                    />
                                    <circle
                                      cx="-38"
                                      cy="4"
                                      r={activePose === 'eating' ? 19 : 16}
                                      fill={fur.belly}
                                    />
                                    <circle
                                      cx="38"
                                      cy="4"
                                      r={activePose === 'eating' ? 19 : 16}
                                      fill={fur.belly}
                                    />

                                    {/* Soft Pink Blush on Cheeks */}
                                    <ellipse
                                      cx="-38"
                                      cy="4"
                                      rx="12.5"
                                      ry="7.5"
                                      fill="#fda4af"
                                      opacity="0.85"
                                    />
                                    <ellipse
                                      cx="38"
                                      cy="4"
                                      rx="12.5"
                                      ry="7.5"
                                      fill="#fda4af"
                                      opacity="0.85"
                                    />

                                    {/* Large Expressive Glossy Eyes (or Closed Sleeping Eyes) */}
                                    {activePose === 'sleeping' ? (
                                      <g
                                        fill="none"
                                        stroke="#230d04"
                                        strokeWidth="3.8"
                                        strokeLinecap="round"
                                      >
                                        <path d="M -32 -14 Q -22 -4 -12 -14" />
                                        <path d="M 12 -14 Q 22 -4 32 -14" />
                                      </g>
                                    ) : (
                                      <g>
                                        <circle
                                          cx="-22"
                                          cy="-14"
                                          r={activePose === 'viewer' ? 11.2 : 9.8}
                                          fill="#1f0d05"
                                        />
                                        <circle cx="-25.5" cy="-17.5" r="3.8" fill="#ffffff" />
                                        <circle cx="-18.5" cy="-10.5" r="1.8" fill="#ffffff" />

                                        <circle
                                          cx="22"
                                          cy="-14"
                                          r={activePose === 'viewer' ? 11.2 : 9.8}
                                          fill="#1f0d05"
                                        />
                                        <circle cx="18.5" cy="-17.5" r="3.8" fill="#ffffff" />
                                        <circle cx="25.5" cy="-10.5" r="1.8" fill="#ffffff" />
                                      </g>
                                    )}

                                    {/* Small Pink Nose */}
                                    <path
                                      d="M -6 -3 C -6 -7, 6 -7, 6 -3 C 6 1, 2.5 4.5, 0 4.5 C -2.5 4.5, -6 1, -6 -3 Z"
                                      fill="url(#hbPinkNose)"
                                    />

                                    {/* Expressive Mouth by Pose */}
                                    {activePose === 'surprised' ? (
                                      <circle
                                        cx="0"
                                        cy="11"
                                        r="6.2"
                                        fill="#9f1239"
                                        stroke="#451a03"
                                        strokeWidth="2.4"
                                      />
                                    ) : activePose === 'laughing' ? (
                                      <g>
                                        <path
                                          d="M -11 6 Q 0 23 11 6 Z"
                                          fill="#fb7185"
                                          stroke="#881337"
                                          strokeWidth="2.2"
                                        />
                                        <rect
                                          x="-3"
                                          y="6"
                                          width="6"
                                          height="3.6"
                                          rx="1"
                                          fill="#ffffff"
                                        />
                                      </g>
                                    ) : (
                                      <g>
                                        <path
                                          d="M -8 7 Q 0 17 8 7 Z"
                                          fill="#fb7185"
                                          stroke="#881337"
                                          strokeWidth="2"
                                        />
                                        <path
                                          d="M -11 6 Q -5.5 12 0 4.5 Q 5.5 12 11 6"
                                          fill="none"
                                          stroke="#451a03"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                        />
                                      </g>
                                    )}

                                    {/* Character Poses & Held Items (Wave, Seed, Strawberry, Leaf, Cozy Paws) */}
                                    {activePose === 'wave' ? (
                                      <g>
                                        <ellipse
                                          cx="-20"
                                          cy="26"
                                          rx="10"
                                          ry="12"
                                          transform="rotate(18 -20 26)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.4"
                                        />
                                        <ellipse
                                          cx="36"
                                          cy="4"
                                          rx="10.5"
                                          ry="13"
                                          transform="rotate(-38 36 4)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.4"
                                        />
                                      </g>
                                    ) : activePose === 'seed' || activePose === 'eating' ? (
                                      <g>
                                        <path
                                          d="M 0 14 C 9 15, 11 29, 0 38 C -11 29, -9 15, 0 14 Z"
                                          fill="#27272a"
                                          stroke="#fef08a"
                                          strokeWidth="2.2"
                                        />
                                        <line
                                          x1="0"
                                          y1="17"
                                          x2="0"
                                          y2="34"
                                          stroke="#fef08a"
                                          strokeWidth="1.8"
                                        />
                                        <ellipse
                                          cx="-15"
                                          cy="27"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(24 -15 27)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                        <ellipse
                                          cx="15"
                                          cy="27"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(-24 15 27)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                      </g>
                                    ) : activePose === 'strawberry' ? (
                                      <g>
                                        <path
                                          d="M 0 15 C 12 15, 14 29, 0 39 C -14 29, -12 15, 0 15 Z"
                                          fill="#ef4444"
                                          stroke="#991b1b"
                                          strokeWidth="2.2"
                                        />
                                        <path
                                          d="M -6 15 Q 0 10 6 15 Q 0 18 -6 15 Z"
                                          fill="#22c55e"
                                          stroke="#15803d"
                                          strokeWidth="1.5"
                                        />
                                        <circle cx="-3" cy="24" r="1.2" fill="#fef08a" />
                                        <circle cx="3" cy="25" r="1.2" fill="#fef08a" />
                                        <circle cx="0" cy="30" r="1.2" fill="#fef08a" />
                                        <ellipse
                                          cx="-16"
                                          cy="27"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(22 -16 27)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                        <ellipse
                                          cx="16"
                                          cy="27"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(-22 16 27)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                      </g>
                                    ) : activePose === 'leaf' ? (
                                      <g>
                                        <path
                                          d="M -2 34 Q 0 20 12 14 Q 16 26 2 32 Z"
                                          fill="#22c55e"
                                          stroke="#15803d"
                                          strokeWidth="2"
                                        />
                                        <path
                                          d="M 2 34 Q 0 20 -12 14 Q -16 26 -2 32 Z"
                                          fill="#4ade80"
                                          stroke="#15803d"
                                          strokeWidth="2"
                                        />
                                        <ellipse
                                          cx="-15"
                                          cy="28"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(22 -15 28)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                        <ellipse
                                          cx="15"
                                          cy="28"
                                          rx="9.5"
                                          ry="11.5"
                                          transform="rotate(-22 15 28)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                      </g>
                                    ) : (
                                      <g>
                                        <ellipse
                                          cx="-18"
                                          cy="28"
                                          rx="10"
                                          ry="12"
                                          transform="rotate(18 -18 28)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                        <ellipse
                                          cx="18"
                                          cy="28"
                                          rx="10"
                                          ry="12"
                                          transform="rotate(-18 18 28)"
                                          fill="#fda4af"
                                          stroke="#9f1239"
                                          strokeWidth="2.3"
                                        />
                                      </g>
                                    )}
                                  </g>
                                </g>

                                {/* 4. FOREGROUND TRANSPARENT GLOSSY SPHERE RIM, SEAMS & REFLECTIONS */}
                                {/* Translucent Colored Edge Refraction */}
                                <circle
                                  cx="0"
                                  cy="0"
                                  r="93"
                                  fill={`url(#hbSphereGlassGrad-${spec.rimIdx % HAMSTER_BALL_RIMS.length})`}
                                  pointerEvents="none"
                                />

                                {/* Colorful Circular Outer Rim */}
                                <circle
                                  cx="0"
                                  cy="0"
                                  r="94"
                                  fill="none"
                                  stroke={`url(#hbRimOuterGrad-${spec.rimIdx % HAMSTER_BALL_RIMS.length})`}
                                  strokeWidth="12"
                                />
                                {/* Inner Tinted Seam Ring */}
                                <circle
                                  cx="0"
                                  cy="0"
                                  r="87.5"
                                  fill="none"
                                  stroke={rim.rimLight}
                                  strokeWidth="2.2"
                                  opacity="0.82"
                                />
                                {/* Outer Rim Crisp Edge */}
                                <circle
                                  cx="0"
                                  cy="0"
                                  r="99.5"
                                  fill="none"
                                  stroke={rim.rimDark}
                                  strokeWidth="1.6"
                                  opacity="0.65"
                                />

                                {/* Detailed Circular Seam Latches (Top, Bottom, Left, Right) */}
                                <rect
                                  x="-99"
                                  y="-8"
                                  width="10"
                                  height="16"
                                  rx="4"
                                  fill={rim.rimMid}
                                  stroke={rim.rimDark}
                                  strokeWidth="1.8"
                                />
                                <rect
                                  x="89"
                                  y="-8"
                                  width="10"
                                  height="16"
                                  rx="4"
                                  fill={rim.rimMid}
                                  stroke={rim.rimDark}
                                  strokeWidth="1.8"
                                />
                                <rect
                                  x="-8"
                                  y="-99"
                                  width="16"
                                  height="8"
                                  rx="3.5"
                                  fill={rim.rimLight}
                                  stroke={rim.rimDark}
                                  strokeWidth="1.5"
                                />

                                {/* Glossy Plastic Studio Reflections & Specular Highlights */}
                                <path
                                  d="M -66 -46 A 78 78 0 0 1 28 -74"
                                  fill="none"
                                  stroke="rgba(255, 255, 255, 0.82)"
                                  strokeWidth="8.5"
                                  strokeLinecap="round"
                                />
                                <circle
                                  cx="-58"
                                  cy="-26"
                                  r="5.5"
                                  fill="rgba(255, 255, 255, 0.85)"
                                />
                                <path
                                  d="M -44 68 A 80 80 0 0 0 58 54"
                                  fill="none"
                                  stroke="rgba(255, 255, 255, 0.45)"
                                  strokeWidth="4.5"
                                  strokeLinecap="round"
                                />
                              </g>
                            </g>
                          </g>
                        );
                      })}
                  </g>
                </svg>
              </div>
            ) : (
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

                {/* Timer Over Status Banner inside Habitat */}
                {timerEndPhase !== 'idle' && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    <div
                      className={`px-4 py-2 rounded-2xl border backdrop-blur-md shadow-xl flex items-center gap-2 text-xs sm:text-sm font-black tracking-wide ${
                        timerEndPhase === 'awake_10s'
                          ? 'bg-amber-500/90 border-amber-200 text-purple-950 animate-bounce'
                          : 'bg-emerald-500/90 border-emerald-200 text-emerald-950'
                      }`}
                    >
                      {timerEndPhase === 'awake_10s' ? (
                        <>
                          <span>⏰ Time&apos;s Up! Hamster is awake &amp; squeaking ({wakeSoundSecondsLeft}s)</span>
                        </>
                      ) : (
                        <>
                          <span>🌻 Yum! Eating a snack before going back to sleep...</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Hamster Cage Mode Empty / Status Banner */}
                {hasStarted && gameMode === 'cage' && timerEndPhase === 'idle' && cageCount === 0 && !leavingHamster && (
                  <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                    <div className="px-5 py-2.5 rounded-2xl bg-rose-500/85 border border-rose-200/70 backdrop-blur-md shadow-xl text-white text-xs sm:text-sm font-black tracking-wide whitespace-nowrap">
                      😡 Cage Empty! Stay quiet for {CAGE_QUIET_APPEAR_SECONDS}s to bring a hamster back ({cageQuietSeconds}/{CAGE_QUIET_APPEAR_SECONDS}s)
                    </div>
                  </div>
                )}

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
                    {COAT_STYLES.map((cStyle, cIdx) => (
                      <React.Fragment key={`coat-defs-${cStyle.id}`}>
                        <radialGradient id={`shCoatBodyGrad-${cIdx}`} cx="42%" cy="28%" r="68%">
                          <stop offset="0%" stopColor={cStyle.body[0]} />
                          <stop offset="52%" stopColor={cStyle.body[1]} />
                          <stop offset="100%" stopColor={cStyle.body[2]} />
                        </radialGradient>
                        <radialGradient id={`shCoatHeadGrad-${cIdx}`} cx="45%" cy="35%" r="65%">
                          <stop offset="0%" stopColor={cStyle.head[0]} />
                          <stop offset="62%" stopColor={cStyle.head[1]} />
                          <stop offset="100%" stopColor={cStyle.head[2]} />
                        </radialGradient>
                      </React.Fragment>
                    ))}
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
                        sleepState === 'AWAKE' || (gameMode === 'cage' && cageCount > 0)
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

                  {/* LIVING CHARACTER LAYER: Original Sleeping Hamster OR Deluxe Multi-Level Walking Hamster Cage (10 Adults + 10 Babies) */}
                  {gameMode === 'cage' ? (
                    <g filter="url(#shSoftShadow)">
                      {/* DELUXE MULTI-LEVEL HAMSTER CAGE PLAYGROUND ARCHITECTURE */}
                      <g>
                        {/* 1. Curved Transparent Acrylic Play Tunnel Tube (Upper Mid-Background) */}
                        <g opacity="0.92">
                          {/* Outer Clear Tube Body */}
                          <path
                            d="M 355 232 C 355 128, 615 128, 615 232"
                            fill="none"
                            stroke="rgba(186, 230, 253, 0.24)"
                            strokeWidth="44"
                            strokeLinecap="round"
                          />
                          <path
                            d="M 355 232 C 355 128, 615 128, 615 232"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.42)"
                            strokeWidth="44"
                            strokeLinecap="round"
                            strokeDasharray="2 42"
                          />
                          {/* Glossy Top Highlight along Curved Tube */}
                          <path
                            d="M 366 224 C 366 140, 604 140, 604 224"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.55)"
                            strokeWidth="7"
                            strokeLinecap="round"
                          />
                          {/* Colorful Habitrail Connector Rings along the Tunnel */}
                          {[
                            { x: 355, y: 224, rot: -6, col: '#38bdf8', dark: '#0284c7' },
                            { x: 398, y: 170, rot: -48, col: '#f472b6', dark: '#db2777' },
                            { x: 485, y: 148, rot: 0, col: '#34d399', dark: '#059669' },
                            { x: 572, y: 170, rot: 48, col: '#fbbf24', dark: '#d97706' },
                            { x: 615, y: 224, rot: 6, col: '#a78bfa', dark: '#7c3aed' },
                          ].map((ring, rIdx) => (
                            <g
                              key={`tube-ring-${rIdx}`}
                              transform={`translate(${ring.x}, ${ring.y}) rotate(${ring.rot})`}
                            >
                              <rect
                                x="-7"
                                y="-25"
                                width="14"
                                height="50"
                                rx="6"
                                fill={ring.col}
                                stroke={ring.dark}
                                strokeWidth="2.5"
                              />
                              <rect
                                x="-3"
                                y="-20"
                                width="4"
                                height="14"
                                rx="2"
                                fill="rgba(255,255,255,0.65)"
                              />
                            </g>
                          ))}
                        </g>

                        {/* 2. Cedar Wood Support Pillars for Upper Mezzanine Loft */}
                        <rect
                          x="156"
                          y="246"
                          width="16"
                          height="168"
                          rx="5"
                          fill="url(#shWoodHouse)"
                          stroke={currentTheme.woodHouse[2]}
                          strokeWidth="2.5"
                        />
                        <rect
                          x="582"
                          y="246"
                          width="16"
                          height="168"
                          rx="5"
                          fill="url(#shWoodHouse)"
                          stroke={currentTheme.woodHouse[2]}
                          strokeWidth="2.5"
                        />

                        {/* 3. Slanted Wooden Climbing Ramp with Grippy Ladder Rungs (Floor to Loft) */}
                        <g>
                          <polygon
                            points="365,248 402,248 474,404 434,404"
                            fill="url(#shWoodHouse)"
                            stroke={currentTheme.woodHouse[2]}
                            strokeWidth="3"
                            strokeLinejoin="round"
                          />
                          {[0.16, 0.32, 0.48, 0.64, 0.8].map((t, rungIdx) => {
                            const rx1 = 368 + (436 - 368) * t;
                            const rx2 = 399 + (471 - 399) * t;
                            const ry = 248 + (404 - 248) * t;
                            return (
                              <line
                                key={`ramp-rung-${rungIdx}`}
                                x1={rx1}
                                y1={ry}
                                x2={rx2}
                                y2={ry}
                                stroke={currentTheme.woodRoof[0]}
                                strokeWidth="4.5"
                                strokeLinecap="round"
                              />
                            );
                          })}
                        </g>

                        {/* 4. Elevated Cedar Mezzanine Loft & Suspension Bridge Deck (x: 135..632, y: 238..254) */}
                        <g>
                          {/* Back Guard Rail Rope & Mini Log Posts */}
                          <path
                            d="M 148 214 Q 255 224 365 214 Q 485 224 612 214"
                            fill="none"
                            stroke="#fde68a"
                            strokeWidth="3.5"
                            strokeDasharray="6 3"
                          />
                          {[148, 220, 292, 365, 445, 528, 612].map((postX, pIdx) => (
                            <g key={`loft-post-${pIdx}`}>
                              <rect
                                x={postX - 5}
                                y="208"
                                width="10"
                                height="34"
                                rx="4"
                                fill="url(#shWoodRoof)"
                                stroke={currentTheme.woodRoof[2]}
                                strokeWidth="2"
                              />
                              <circle
                                cx={postX}
                                cy="208"
                                r="4.5"
                                fill="#fbbf24"
                                stroke={currentTheme.woodRoof[2]}
                                strokeWidth="1.5"
                              />
                            </g>
                          ))}

                          {/* Main Upper Wooden Deck Plank */}
                          <rect
                            x="132"
                            y="238"
                            width="502"
                            height="16"
                            rx="8"
                            fill="url(#shWoodRoof)"
                            stroke={currentTheme.woodRoof[2]}
                            strokeWidth="3"
                          />
                          {/* Wood Plank Divider Notches */}
                          {[190, 250, 310, 370, 430, 490, 550, 600].map((notchX) => (
                            <line
                              key={`plank-notch-${notchX}`}
                              x1={notchX}
                              y1="240"
                              x2={notchX}
                              y2="252"
                              stroke={currentTheme.woodRoof[2]}
                              strokeWidth="2"
                              opacity="0.55"
                            />
                          ))}
                          {/* Soft top highlight on loft deck */}
                          <line
                            x1="142"
                            y1="242"
                            x2="622"
                            y2="242"
                            stroke="rgba(255,255,255,0.35)"
                            strokeWidth="2.2"
                            strokeLinecap="round"
                          />
                        </g>

                        {/* 5. Hanging Wooden Chew Ring & Golden Bell Toy (Upper Left) */}
                        <g transform="translate(168, 18)">
                          <line
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="68"
                            stroke="#fcd34d"
                            strokeWidth="3.5"
                            strokeDasharray="5 4"
                          />
                          <circle
                            cx="0"
                            cy="86"
                            r="18"
                            fill="none"
                            stroke="#f472b6"
                            strokeWidth="7"
                          />
                          <circle
                            cx="0"
                            cy="86"
                            r="18"
                            fill="none"
                            stroke="#fbcfe8"
                            strokeWidth="2"
                          />
                          <circle
                            cx="0"
                            cy="78"
                            r="6.5"
                            fill="#fbbf24"
                            stroke="#92400e"
                            strokeWidth="2"
                          />
                        </g>

                        {/* 6. Cage Floor Enrichment: Wooden Seesaw, Pastel ABC Chew Cubes & Fresh Clover Sprouts */}
                        {/* Cute Wooden Seesaw / Teeter-Totter (Left-Center Floor) */}
                        <g transform="translate(242, 432)">
                          <polygon
                            points="-18,12 0,-12 18,12"
                            fill="#38bdf8"
                            stroke="#0369a1"
                            strokeWidth="2.8"
                            strokeLinejoin="round"
                          />
                          <g transform="rotate(-7)">
                            <rect
                              x="-62"
                              y="-15"
                              width="124"
                              height="10"
                              rx="5"
                              fill="#f472b6"
                              stroke="#9d174d"
                              strokeWidth="2.5"
                            />
                            <line
                              x1="-52"
                              y1="-12"
                              x2="52"
                              y2="-12"
                              stroke="rgba(255,255,255,0.45)"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </g>
                        </g>

                        {/* Pastel Wooden Chew Blocks (Center-Right Floor) */}
                        <g transform="translate(525, 424)">
                          <rect
                            x="0"
                            y="0"
                            width="24"
                            height="24"
                            rx="5"
                            fill="#a78bfa"
                            stroke="#5b21b6"
                            strokeWidth="2.5"
                          />
                          <text
                            x="12"
                            y="17"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="13"
                            fontWeight="900"
                          >
                            A
                          </text>
                          <rect
                            x="22"
                            y="4"
                            width="22"
                            height="22"
                            rx="5"
                            transform="rotate(10 33 15)"
                            fill="#34d399"
                            stroke="#065f46"
                            strokeWidth="2.5"
                          />
                          <text
                            x="33"
                            y="19"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="12"
                            fontWeight="900"
                          >
                            ★
                          </text>
                        </g>

                        {/* Mini Clover & Daisy Patch (Right Courtyard) */}
                        <g transform="translate(822, 432)">
                          <ellipse cx="0" cy="6" rx="28" ry="8" fill="#15803d" opacity="0.55" />
                          <circle cx="-12" cy="1" r="6" fill="#4ade80" />
                          <circle cx="-4" cy="-2" r="7" fill="#22c55e" />
                          <circle cx="6" cy="1" r="6" fill="#4ade80" />
                          <circle cx="15" cy="2" r="5" fill="#22c55e" />
                          <circle cx="-6" cy="-2" r="3.5" fill="#fef08a" stroke="#ffffff" strokeWidth="2" />
                          <circle cx="10" cy="0" r="3" fill="#fbcfe8" stroke="#ffffff" strokeWidth="1.8" />
                        </g>
                      </g>

                      {(() => {
                        const renderMiniHamster = (
                          slotIdx: number,
                          slot: CageSlot,
                          isBaby: boolean,
                          coatIdx: number,
                          isLeavingAngry: boolean,
                          isArriving: boolean
                        ) => {
                          const resolvedCoatIdx = coatIdx % COAT_STYLES.length;
                          const coat = COAT_STYLES[resolvedCoatIdx];
                          const bodyGradUrl = `url(#shCoatBodyGrad-${resolvedCoatIdx})`;
                          const headGradUrl = `url(#shCoatHeadGrad-${resolvedCoatIdx})`;
                          const isNoisyCage =
                            !isLeavingAngry &&
                            (isDisturbedFace || isAlmostAwakeFace || sleepState === 'AWAKE');
                          const walker = cageWalkersState[slotIdx];
                          const isWalkingNow =
                            !isLeavingAngry && !isNoisyCage && (walker ? walker.isWalking : true);
                          const posX = !isLeavingAngry && walker ? walker.x : slot.x;
                          const basePosY = !isLeavingAngry && walker ? walker.y : slot.y;
                          const stepPhase = walker ? walker.phase : slotIdx * 1.1;
                          const stepSin = isWalkingNow ? Math.sin(stepPhase) : 0;
                          const stepCos = isWalkingNow ? Math.cos(stepPhase) : 0;
                          const walkBounceY = isWalkingNow ? Math.abs(stepSin) * 5.2 : 0;
                          const walkWaddleDeg = isWalkingNow ? stepSin * 3.6 : 0;
                          const flipX =
                            !isLeavingAngry && walker
                              ? walker.dir === 1
                                ? -1
                                : 1
                              : slot.flip
                              ? -1
                              : 1;
                          const strokeCol =
                            coat.id === 'pearl'
                              ? '#64748b'
                              : coat.id === 'panda'
                              ? '#18181b'
                              : '#5c1f08';
                          const holdsSunflowerSeed = !isBaby && !isLeavingAngry && !isNoisyCage && slotIdx % 3 === 1;
                          const holdsMiniCarrot = !isBaby && !isLeavingAngry && !isNoisyCage && slotIdx % 4 === 2;
                          const leftFootLift = isWalkingNow ? Math.max(0, stepSin) * 15 : 0;
                          const rightFootLift = isWalkingNow ? Math.max(0, -stepSin) * 15 : 0;
                          const leftFootRot = -10 + stepSin * 18;
                          const rightFootRot = 10 - stepSin * 18;
                          const pawSwingY = isWalkingNow ? stepCos * 5.5 : 0;

                          return (
                            <g
                              key={`cage-hamster-${slotIdx}-${isLeavingAngry ? 'leave' : 'stay'}`}
                              transform={`translate(${posX.toFixed(1)}, ${(basePosY - walkBounceY).toFixed(1)})`}
                              onClick={isLeavingAngry ? undefined : handlePetHamster}
                              className={isLeavingAngry ? 'pointer-events-none' : 'cursor-pointer'}
                            >
                              <title>
                                {isBaby
                                  ? `Baby Hamster #${slotIdx - 9} (Walking around! Click to pet!)`
                                  : `Hamster #${slotIdx + 1} (Walking around! Click to pet!)`}
                              </title>
                              <g
                                className={
                                  isLeavingAngry
                                    ? 'sh-hamster-leave'
                                    : isArriving
                                    ? 'sh-hamster-arrive'
                                    : !isWalkingNow
                                    ? 'sh-cage-bob'
                                    : undefined
                                }
                                style={
                                  !isLeavingAngry && !isArriving && !isWalkingNow
                                    ? { animationDelay: `${(slotIdx % 7) * 0.28}s` }
                                    : undefined
                                }
                              >
                                <g
                                  transform={`rotate(${walkWaddleDeg.toFixed(2)}) scale(${slot.scale * flipX}, ${slot.scale})`}
                                  className={isLeavingAngry ? 'sh-angry-shake' : undefined}
                                >
                                  {/* Soft Ground Shadow */}
                                  <ellipse
                                    cx="0"
                                    cy={92 + walkBounceY * 1.4}
                                    rx={92 - walkBounceY * 1.2}
                                    ry="20"
                                    fill="rgba(16, 6, 38, 0.52)"
                                  />

                                  {/* Little Round Tail Peeking & Wagging Behind */}
                                  <circle
                                    cx="78"
                                    cy={54 + stepCos * 4}
                                    r="14"
                                    fill="#fbcfe8"
                                    stroke={strokeCol}
                                    strokeWidth="4"
                                  />

                                  {/* Detailed Plush Hamster Ears with Inner Ear Crease */}
                                  <g transform={`translate(-58, -68) rotate(${-18 + stepSin * 4})`}>
                                    <ellipse
                                      cx="0"
                                      cy="0"
                                      rx={isBaby ? 28 : 26}
                                      ry={isBaby ? 30 : 28}
                                      fill={headGradUrl}
                                      stroke={strokeCol}
                                      strokeWidth="4.8"
                                    />
                                    <ellipse cx="2" cy="3" rx={isBaby ? 18 : 16.5} ry={isBaby ? 19 : 17.5} fill="#f48fb1" />
                                    <path
                                      d="M -7 2 Q 2 -10 10 3"
                                      fill="none"
                                      stroke="#fbcfe8"
                                      strokeWidth="3.2"
                                      strokeLinecap="round"
                                      opacity="0.75"
                                    />
                                  </g>
                                  <g transform={`translate(58, -68) rotate(${18 + stepSin * 4})`}>
                                    <ellipse
                                      cx="0"
                                      cy="0"
                                      rx={isBaby ? 28 : 26}
                                      ry={isBaby ? 30 : 28}
                                      fill={headGradUrl}
                                      stroke={strokeCol}
                                      strokeWidth="4.8"
                                    />
                                    <ellipse cx="-2" cy="3" rx={isBaby ? 18 : 16.5} ry={isBaby ? 19 : 17.5} fill="#f48fb1" />
                                    <path
                                      d="M -10 3 Q -2 -10 7 2"
                                      fill="none"
                                      stroke="#fbcfe8"
                                      strokeWidth="3.2"
                                      strokeLinecap="round"
                                      opacity="0.75"
                                    />
                                  </g>

                                  {/* Animated Walking Chubby Hind Feet at Bottom */}
                                  <g transform={`translate(-52, ${(82 - leftFootLift).toFixed(1)}) rotate(${leftFootRot.toFixed(1)})`}>
                                    <ellipse
                                      cx="0"
                                      cy="0"
                                      rx="22"
                                      ry="13"
                                      fill="#fda4af"
                                      stroke="#881337"
                                      strokeWidth="3.6"
                                    />
                                    <circle cx="-8" cy="-2" r="3.2" fill="#f43f5e" opacity="0.7" />
                                    <circle cx="0" cy="-4" r="3.2" fill="#f43f5e" opacity="0.7" />
                                    <circle cx="8" cy="-2" r="3.2" fill="#f43f5e" opacity="0.7" />
                                  </g>
                                  <g transform={`translate(52, ${(82 - rightFootLift).toFixed(1)}) rotate(${rightFootRot.toFixed(1)})`}>
                                    <ellipse
                                      cx="0"
                                      cy="0"
                                      rx="22"
                                      ry="13"
                                      fill="#fda4af"
                                      stroke="#881337"
                                      strokeWidth="3.6"
                                    />
                                    <circle cx="-8" cy="-2" r="3.2" fill="#f43f5e" opacity="0.7" />
                                    <circle cx="0" cy="-4" r="3.2" fill="#f43f5e" opacity="0.7" />
                                    <circle cx="8" cy="-2" r="3.2" fill="#f43f5e" opacity="0.7" />
                                  </g>

                                  {/* Organic Pear-Shaped Chubby Hamster Silhouette with Puffed Cheek Pouches */}
                                  <path
                                    d="M -78 -24 C -84 -62, -52 -90, 0 -90 C 52 -90, 84 -62, 78 -24 C 98 -6, 102 34, 88 64 C 74 88, 38 92, 0 92 C -38 92, -74 88, -88 64 C -102 34, -98 -6, -78 -24 Z"
                                    fill={bodyGradUrl}
                                    stroke={strokeCol}
                                    strokeWidth="5"
                                    strokeLinejoin="round"
                                  />

                                  {/* Forehead Cap / Blaze Fur Marking */}
                                  <path
                                    d="M -66 -40 C -58 -76, -30 -88, 0 -88 C 30 -88, 58 -76, 66 -40 C 44 -50, 22 -42, 0 -24 C -22 -42, -44 -50, -66 -40 Z"
                                    fill={headGradUrl}
                                    opacity="0.88"
                                  />

                                  {/* Cute Fluffy Head Tuft */}
                                  <path
                                    d="M -14 -88 Q -4 -105 4 -90 Q 15 -103 18 -87"
                                    fill={coat.head[0]}
                                    stroke={strokeCol}
                                    strokeWidth="4.2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />

                                  {/* Soft Cream Cheek Pouches & Snowy Belly Contour */}
                                  <path
                                    d="M -82 14 C -88 -8, -62 -20, -34 -12 C -14 -6, 14 -6, 34 -12 C 62 -20, 88 -8, 82 14 C 90 46, 68 86, 0 88 C -68 86, -90 46, -82 14 Z"
                                    fill="url(#shCheekGrad)"
                                  />

                                  {/* Extra Puffy Snack Pouches on Both Sides */}
                                  <circle cx="-56" cy="8" r="24" fill="url(#shCheekGrad)" />
                                  <circle cx="56" cy="8" r="24" fill="url(#shCheekGrad)" />

                                  {/* Top Soft Specular Fur Highlight */}
                                  <ellipse
                                    cx="-20"
                                    cy="-62"
                                    rx="26"
                                    ry="12"
                                    transform="rotate(-12 -20 -62)"
                                    fill="#ffffff"
                                    opacity="0.28"
                                  />

                                  {/* Baby Hamster Cute Head Accessories (Slots 11..20) */}
                                  {isBaby && slot.accessory === 'bow' && (
                                    <g transform="translate(0, -88)">
                                      <polygon
                                        points="-26,-12 0,0 -26,12"
                                        fill="#f472b6"
                                        stroke="#9d174d"
                                        strokeWidth="3.5"
                                        strokeLinejoin="round"
                                      />
                                      <polygon
                                        points="26,-12 0,0 26,12"
                                        fill="#f472b6"
                                        stroke="#9d174d"
                                        strokeWidth="3.5"
                                        strokeLinejoin="round"
                                      />
                                      <circle cx="0" cy="0" r="8.5" fill="#fbcfe8" stroke="#9d174d" strokeWidth="3" />
                                    </g>
                                  )}
                                  {isBaby && slot.accessory === 'tuft' && (
                                    <g transform="translate(0, -90)">
                                      <polygon
                                        points="0,-24 7,-9 23,-6 11,6 14,22 0,14 -14,22 -11,6 -23,-6 -7,-9"
                                        fill="#fbbf24"
                                        stroke="#92400e"
                                        strokeWidth="3"
                                        strokeLinejoin="round"
                                      />
                                    </g>
                                  )}

                                  {/* Rosy Cheeks + Kawaii Blush Slash Marks (//) */}
                                  <g>
                                    <ellipse
                                      cx="-55"
                                      cy="6"
                                      rx="19"
                                      ry="11.5"
                                      transform="rotate(-8 -55 6)"
                                      fill={isLeavingAngry ? '#f43f5e' : '#fda4af'}
                                      opacity={isLeavingAngry ? 0.92 : 0.82}
                                    />
                                    <line
                                      x1="-61"
                                      y1="10"
                                      x2="-55"
                                      y2="2"
                                      stroke="#e11d48"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      opacity="0.65"
                                    />
                                    <line
                                      x1="-53"
                                      y1="11"
                                      x2="-47"
                                      y2="3"
                                      stroke="#e11d48"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      opacity="0.65"
                                    />

                                    <ellipse
                                      cx="55"
                                      cy="6"
                                      rx="19"
                                      ry="11.5"
                                      transform="rotate(8 55 6)"
                                      fill={isLeavingAngry ? '#f43f5e' : '#fda4af'}
                                      opacity={isLeavingAngry ? 0.92 : 0.82}
                                    />
                                    <line
                                      x1="47"
                                      y1="10"
                                      x2="53"
                                      y2="2"
                                      stroke="#e11d48"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      opacity="0.65"
                                    />
                                    <line
                                      x1="55"
                                      y1="11"
                                      x2="61"
                                      y2="3"
                                      stroke="#e11d48"
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      opacity="0.65"
                                    />
                                  </g>

                                  {/* Soft Curved Whiskers */}
                                  <g stroke="#78350f" strokeWidth="2.6" strokeLinecap="round" opacity="0.58">
                                    <path d="M -72 2 Q -88 -3 -104 -8" fill="none" />
                                    <path d="M -72 12 Q -88 14 -104 18" fill="none" />
                                    <path d="M 72 2 Q 88 -3 104 -8" fill="none" />
                                    <path d="M 72 12 Q 88 14 104 18" fill="none" />
                                  </g>

                                  {/* FACIAL EXPRESSIONS */}
                                  {isLeavingAngry ? (
                                    /* ANGRY FACE BEFORE LEAVING */
                                    <g>
                                      {/* Furrowed Angry Eyebrows */}
                                      <path
                                        d="M -54 -40 L -16 -22"
                                        stroke="#450a0a"
                                        strokeWidth="8.5"
                                        strokeLinecap="round"
                                      />
                                      <path
                                        d="M 54 -40 L 16 -22"
                                        stroke="#450a0a"
                                        strokeWidth="8.5"
                                        strokeLinecap="round"
                                      />
                                      {/* Glaring Glossy Eyes */}
                                      <circle cx="-33" cy="-18" r="13" fill="#1c0a00" />
                                      <circle cx="-37" cy="-22" r="4.5" fill="#ffffff" />
                                      <circle cx="-28" cy="-13" r="2" fill="#fda4af" />
                                      <circle cx="33" cy="-18" r="13" fill="#1c0a00" />
                                      <circle cx="29" cy="-22" r="4.5" fill="#ffffff" />
                                      <circle cx="38" cy="-13" r="2" fill="#fda4af" />
                                      {/* 3D Pink Heart Nose */}
                                      <path
                                        d="M -8 -4 C -8 -9, 8 -9, 8 -4 C 8 1, 3 5, 0 5 C -3 5, -8 1, -8 -4 Z"
                                        fill="url(#shPinkNose)"
                                      />
                                      {/* Grumpy Open Scowling Mouth with Little Hamster Teeth */}
                                      <path
                                        d="M -18 22 C -14 6, 14 6, 18 22 C 10 26, -10 26, -18 22 Z"
                                        fill="#7f1d1d"
                                        stroke="#450a0a"
                                        strokeWidth="3.8"
                                        strokeLinejoin="round"
                                      />
                                      <rect x="-5" y="10" width="10" height="6" rx="1.5" fill="#ffffff" />
                                      {/* Comic Anger Vein Mark 💢 */}
                                      <g transform="translate(58, -88) scale(1.3)">
                                        <path
                                          d="M -14 -4 Q -4 -4 -4 -14 M 14 -4 Q 4 -4 4 -14 M -14 14 Q -4 14 -4 4 M 14 14 Q 4 14 4 4"
                                          fill="none"
                                          stroke="#ef4444"
                                          strokeWidth="5.5"
                                          strokeLinecap="round"
                                        />
                                      </g>
                                    </g>
                                  ) : isNoisyCage ? (
                                    /* NERVOUS / WORRIED FACE WHEN NOISY */
                                    <g>
                                      <line
                                        x1="-48"
                                        y1="-36"
                                        x2="-20"
                                        y2="-27"
                                        stroke={strokeCol}
                                        strokeWidth="5.5"
                                        strokeLinecap="round"
                                      />
                                      <line
                                        x1="48"
                                        y1="-36"
                                        x2="20"
                                        y2="-27"
                                        stroke={strokeCol}
                                        strokeWidth="5.5"
                                        strokeLinecap="round"
                                      />
                                      <circle cx="-33" cy="-16" r="13.5" fill="#230d04" />
                                      <circle cx="-38" cy="-21" r="4.8" fill="#ffffff" />
                                      <circle cx="-28" cy="-11" r="2.2" fill="#ffffff" opacity="0.85" />
                                      <circle cx="33" cy="-16" r="13.5" fill="#230d04" />
                                      <circle cx="28" cy="-21" r="4.8" fill="#ffffff" />
                                      <circle cx="38" cy="-11" r="2.2" fill="#ffffff" opacity="0.85" />
                                      <path
                                        d="M -8 -3 C -8 -8, 8 -8, 8 -3 C 8 2, 3 6, 0 6 C -3 6, -8 2, -8 -3 Z"
                                        fill="url(#shPinkNose)"
                                      />
                                      <ellipse
                                        cx="0"
                                        cy="17"
                                        rx="9.5"
                                        ry="7.5"
                                        fill="#7f1d1d"
                                        stroke="#451a03"
                                        strokeWidth="3.5"
                                      />
                                      <rect x="-4.5" y="10" width="9" height="5" rx="1.5" fill="#ffffff" />
                                      {/* Sweatdrop */}
                                      <path
                                        d="M 64 -48 C 58 -34, 56 -24, 64 -22 C 72 -24, 70 -34, 64 -48 Z"
                                        fill="#7dd3fc"
                                        stroke="#e0f2fe"
                                        strokeWidth="2.2"
                                      />
                                    </g>
                                  ) : (
                                    /* CUTE KAWAII HAPPY CALM FACE */
                                    <g>
                                      {/* Subtle Cute Brow Dots */}
                                      <ellipse cx="-28" cy="-38" rx="6" ry="3.5" fill={coat.body[0]} opacity="0.85" />
                                      <ellipse cx="28" cy="-38" rx="6" ry="3.5" fill={coat.body[0]} opacity="0.85" />

                                      {/* Glossy Kawaii Left Eye */}
                                      <circle cx="-33" cy="-18" r={isBaby ? 15 : 13.8} fill="#230d04" />
                                      <path
                                        d="M -42 -12 A 11 11 0 0 0 -24 -12"
                                        fill="none"
                                        stroke="#92400e"
                                        strokeWidth="3.2"
                                        strokeLinecap="round"
                                        opacity="0.75"
                                      />
                                      <circle cx="-38" cy="-23" r={isBaby ? 5.6 : 5} fill="#ffffff" />
                                      <circle cx="-27" cy="-13" r="2.4" fill="#ffffff" opacity="0.9" />

                                      {/* Glossy Kawaii Right Eye */}
                                      <circle cx="33" cy="-18" r={isBaby ? 15 : 13.8} fill="#230d04" />
                                      <path
                                        d="M 24 -12 A 11 11 0 0 0 42 -12"
                                        fill="none"
                                        stroke="#92400e"
                                        strokeWidth="3.2"
                                        strokeLinecap="round"
                                        opacity="0.75"
                                      />
                                      <circle cx="28" cy="-23" r={isBaby ? 5.6 : 5} fill="#ffffff" />
                                      <circle cx="39" cy="-13" r="2.4" fill="#ffffff" opacity="0.9" />

                                      {/* 3D Heart-Shaped Pink Nose */}
                                      <path
                                        d="M -8.5 -3 C -8.5 -8.5, 8.5 -8.5, 8.5 -3 C 8.5 2.5, 3.5 6.5, 0 6.5 C -3.5 6.5, -8.5 2.5, -8.5 -3 Z"
                                        fill="url(#shPinkNose)"
                                      />

                                      {isBaby && slot.accessory === 'pacifier' ? (
                                        <g transform="translate(0, 14)">
                                          <ellipse cx="0" cy="0" rx="15" ry="12" fill="#7dd3fc" stroke="#0284c7" strokeWidth="3.5" />
                                          <circle cx="0" cy="-1" r="6" fill="#38bdf8" stroke="#0284c7" strokeWidth="2.5" />
                                          <path
                                            d="M -7 3 A 7 7 0 0 0 7 3"
                                            fill="none"
                                            stroke="#ffffff"
                                            strokeWidth="3.2"
                                            strokeLinecap="round"
                                          />
                                        </g>
                                      ) : (
                                        <g>
                                          {/* Cute Pink Mouth + Tiny Hamster Tooth + ω Cat-Smile */}
                                          <path
                                            d="M -11 11 Q 0 24 11 11 Z"
                                            fill="#fb7185"
                                            stroke="#881337"
                                            strokeWidth="2.5"
                                            strokeLinejoin="round"
                                          />
                                          <rect x="-3.5" y="10" width="7" height="4.5" rx="1.2" fill="#ffffff" />
                                          <path
                                            d="M -16 9 Q -8 17 0 6.5 Q 8 17 16 9"
                                            fill="none"
                                            stroke="#451a03"
                                            strokeWidth="4.4"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </g>
                                      )}
                                    </g>
                                  )}

                                  {/* Cute Front Paws + Optional Treats */}
                                  {isLeavingAngry ? (
                                    /* Raised Angry Paws */
                                    <g>
                                      <g transform="translate(-44, 24) rotate(-28)">
                                        <ellipse cx="0" cy="0" rx="15" ry="18" fill="#fda4af" stroke="#881337" strokeWidth="3.5" />
                                        <path d="M -5 -10 L -5 -3 M 0 -11 L 0 -3 M 5 -10 L 5 -3" stroke="#9f1239" strokeWidth="2.4" strokeLinecap="round" />
                                      </g>
                                      <g transform="translate(44, 24) rotate(28)">
                                        <ellipse cx="0" cy="0" rx="15" ry="18" fill="#fda4af" stroke="#881337" strokeWidth="3.5" />
                                        <path d="M -5 -10 L -5 -3 M 0 -11 L 0 -3 M 5 -10 L 5 -3" stroke="#9f1239" strokeWidth="2.4" strokeLinecap="round" />
                                      </g>
                                    </g>
                                  ) : holdsSunflowerSeed ? (
                                    /* Holding a Striped Sunflower Seed */
                                    <g>
                                      <g transform="translate(0, 38)">
                                        <path
                                          d="M 0 -16 C 12 -14, 15 4, 0 16 C -15 4, -12 -14, 0 -16 Z"
                                          fill="#27272a"
                                          stroke="#fef08a"
                                          strokeWidth="2.8"
                                        />
                                        <line x1="0" y1="-12" x2="0" y2="12" stroke="#fef08a" strokeWidth="2.2" strokeLinecap="round" />
                                      </g>
                                      <g transform="translate(-22, 42) rotate(25)">
                                        <ellipse cx="0" cy="0" rx="14" ry="17" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -4 -9 L -4 -2 M 0 -10 L 0 -2 M 4 -9 L 4 -2" stroke="#9f1239" strokeWidth="2.2" strokeLinecap="round" />
                                      </g>
                                      <g transform="translate(22, 42) rotate(-25)">
                                        <ellipse cx="0" cy="0" rx="14" ry="17" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -4 -9 L -4 -2 M 0 -10 L 0 -2 M 4 -9 L 4 -2" stroke="#9f1239" strokeWidth="2.2" strokeLinecap="round" />
                                      </g>
                                    </g>
                                  ) : holdsMiniCarrot ? (
                                    /* Holding a Crunchy Mini Carrot */
                                    <g>
                                      <g transform="translate(0, 38) rotate(-14)">
                                        <path d="M 8 -14 C 14 -22, 20 -18, 12 -10" fill="none" stroke="#22c55e" strokeWidth="4.5" strokeLinecap="round" />
                                        <path
                                          d="M -16 4 L 10 -12 C 16 -8, 16 4, 8 8 L -14 10 Z"
                                          fill="#f97316"
                                          stroke="#c2410c"
                                          strokeWidth="3"
                                          strokeLinejoin="round"
                                        />
                                      </g>
                                      <g transform="translate(-22, 44) rotate(22)">
                                        <ellipse cx="0" cy="0" rx="14" ry="17" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -4 -9 L -4 -2 M 0 -10 L 0 -2 M 4 -9 L 4 -2" stroke="#9f1239" strokeWidth="2.2" strokeLinecap="round" />
                                      </g>
                                      <g transform="translate(22, 44) rotate(-22)">
                                        <ellipse cx="0" cy="0" rx="14" ry="17" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -4 -9 L -4 -2 M 0 -10 L 0 -2 M 4 -9 L 4 -2" stroke="#9f1239" strokeWidth="2.2" strokeLinecap="round" />
                                      </g>
                                    </g>
                                  ) : (
                                    /* Cozy Swinging Front Paws on Chest */
                                    <g>
                                      <g transform={`translate(-26, ${(44 + pawSwingY).toFixed(1)}) rotate(${(18 + stepSin * 10).toFixed(1)})`}>
                                        <ellipse cx="0" cy="0" rx="15" ry="18" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -5 -10 L -5 -3 M 0 -11 L 0 -3 M 5 -10 L 5 -3" stroke="#9f1239" strokeWidth="2.3" strokeLinecap="round" />
                                      </g>
                                      <g transform={`translate(26, ${(44 - pawSwingY).toFixed(1)}) rotate(${(-18 + stepSin * 10).toFixed(1)})`}>
                                        <ellipse cx="0" cy="0" rx="15" ry="18" fill="#fda4af" stroke="#881337" strokeWidth="3.4" />
                                        <path d="M -5 -10 L -5 -3 M 0 -11 L 0 -3 M 5 -10 L 5 -3" stroke="#9f1239" strokeWidth="2.3" strokeLinecap="round" />
                                      </g>
                                    </g>
                                  )}
                                </g>
                              </g>
                            </g>
                          );
                        };

                        const adultsCount = Math.min(10, cageCount);
                        const babiesCount = Math.max(0, cageCount - 10);

                        return (
                          <g>
                            {CAGE_ADULT_SLOTS.slice(0, adultsCount).map((slot, idx) =>
                              renderMiniHamster(
                                idx,
                                slot,
                                false,
                                coatIndex + idx,
                                false,
                                justArrivedSlot === idx
                              )
                            )}
                            {CAGE_BABY_SLOTS.slice(0, babiesCount).map((slot, bIdx) => {
                              const slotIdx = 10 + bIdx;
                              return renderMiniHamster(
                                slotIdx,
                                slot,
                                true,
                                coatIndex + slotIdx,
                                false,
                                justArrivedSlot === slotIdx
                              );
                            })}
                            {leavingHamster && (() => {
                              const slot = leavingHamster.isBaby
                                ? CAGE_BABY_SLOTS[leavingHamster.slotIndex - 10] || CAGE_BABY_SLOTS[0]
                                : CAGE_ADULT_SLOTS[leavingHamster.slotIndex] || CAGE_ADULT_SLOTS[0];
                              return renderMiniHamster(
                                leavingHamster.slotIndex,
                                slot,
                                leavingHamster.isBaby,
                                leavingHamster.coatIndex,
                                true,
                                false
                              );
                            })()}
                          </g>
                        );
                      })()}
                    </g>
                  ) : (
                  /* ORIGINAL LIVING SLEEPING HAMSTER CHARACTER (Click to Pet / Soothe) */
                  <g
                    onClick={handlePetHamster}
                    className={`${
                      isDisturbedFace || isAlmostAwakeFace ? 'sh-body-fast' : 'sh-body-calm'
                    } cursor-pointer`}
                    filter="url(#shFurShadow)"
                  >
                    <title>Click to gently pet & soothe the hamster!</title>
                    <ellipse cx="496" cy="438" rx="155" ry="30" fill="rgba(16, 6, 38, 0.7)" />

                    {timerEndPhase === 'eating' ? (
                      /* HAPPY EATING FOOD POSTURE (after 10s timer wake-up, before sleeping again) */
                      <g transform="translate(22, 0)">
                        <g className="sh-ear">
                          <circle cx="386" cy="292" r="34" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="388" cy="295" r="21" fill="#f48fb1" />
                        </g>
                        <g>
                          <circle cx="536" cy="272" r="33" fill="url(#shFurHeadGrad)" stroke="#6b2710" strokeWidth="4" />
                          <circle cx="534" cy="275" r="20" fill="#f48fb1" />
                        </g>

                        {/* Body & Chubby Chewing Cheeks */}
                        <path
                          d="M 342 430 C 330 342, 382 268, 468 265 C 555 262, 622 325, 628 422 C 610 448, 370 450, 342 430 Z"
                          fill="url(#shFurGrad)"
                          stroke="#6b2710"
                          strokeWidth="4"
                          strokeLinejoin="round"
                        />
                        <g className="sh-chew-cheeks">
                          <path
                            d="M 350 426 C 338 368, 384 334, 435 344 C 455 346, 476 346, 498 340 C 552 326, 602 356, 594 420 C 566 448, 382 450, 350 426 Z"
                            fill="url(#shCheekGrad)"
                          />
                          {/* Extra Puffy Snack Pouches */}
                          <circle cx="395" cy="392" r="28" fill="url(#shCheekGrad)" />
                          <circle cx="548" cy="376" r="27" fill="url(#shCheekGrad)" />
                          <ellipse cx="398" cy="392" rx="23" ry="13" transform="rotate(-8 398 392)" fill="#fda4af" opacity="0.86" />
                          <ellipse cx="546" cy="374" rx="22" ry="12.5" transform="rotate(-8 546 374)" fill="#fda4af" opacity="0.86" />
                        </g>

                        {/* Pushed-Up Bear Sleep Mask on Forehead */}
                        <g transform="translate(0, -28) rotate(-3 465 295)">
                          <path d="M 348 370 Q 356 335 376 318" fill="none" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
                          <path d="M 554 308 Q 582 325 598 354" fill="none" stroke="#facc15" strokeWidth="9" strokeLinecap="round" />
                          <circle cx="404" cy="276" r="15" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <circle cx="512" cy="264" r="15" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.5" />
                          <path d="M 372 324 C 362 288, 408 262, 462 258 C 516 254, 560 274, 558 308 C 556 328, 524 328, 496 318 C 474 310, 456 314, 434 328 C 408 344, 378 344, 372 324 Z" fill="url(#shSleepMaskGrad)" stroke="#713f12" strokeWidth="3.8" strokeLinejoin="round" />
                          <circle cx="442" cy="292" r="4" fill="#451a03" />
                          <circle cx="486" cy="286" r="4" fill="#451a03" />
                          <ellipse cx="464" cy="291" rx="4.5" ry="3" fill="#451a03" />
                        </g>

                        {/* Happy Crescent Eating Eyes (^ ^) */}
                        <path d="M 408 356 Q 426 338 444 354" fill="none" stroke="#3b1106" strokeWidth="5.5" strokeLinecap="round" />
                        <path d="M 494 344 Q 512 326 530 342" fill="none" stroke="#3b1106" strokeWidth="5.5" strokeLinecap="round" />

                        {/* Nose & Munching Mouth */}
                        <path d="M 462 362 C 462 356, 480 355, 480 361 C 480 367, 474 372, 471 372 C 468 372, 462 368, 462 362 Z" fill="url(#shPinkNose)" />
                        <g className="sh-mouth-munch">
                          <ellipse cx="474" cy="384" rx="13" ry="10" fill="#7f1d1d" stroke="#451a03" strokeWidth="3.2" />
                          <rect x="469" y="375" width="9" height="6" rx="1.5" fill="#ffffff" />
                        </g>

                        {/* Tasty Treat (Crunchy Carrot + Sunflower Seed) Held in Both Paws */}
                        <g className="sh-treat-nibble">
                          {/* Leafy green carrot top */}
                          <path d="M 505 376 C 516 364, 526 368, 514 382" fill="none" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" />
                          <path d="M 508 380 C 522 374, 526 382, 512 386" fill="none" stroke="#16a34a" strokeWidth="4.5" strokeLinecap="round" />
                          {/* Crunchy carrot & seed */}
                          <path d="M 468 386 L 510 374 C 516 378, 514 392, 506 394 L 468 394 Z" fill="#f97316" stroke="#c2410c" strokeWidth="3" strokeLinejoin="round" />
                          <ellipse cx="468" cy="390" rx="10" ry="7" transform="rotate(-15 468 390)" fill="#27272a" stroke="#fef08a" strokeWidth="2" />
                          {/* Little flying crumbs */}
                          <circle cx="452" cy="378" r="2.8" fill="#fbbf24" />
                          <circle cx="496" cy="368" r="2.4" fill="#f97316" />
                          <circle cx="460" cy="402" r="2.2" fill="#fde047" />

                          {/* Both Paws Holding the Food */}
                          <g transform="translate(446, 398) rotate(24)">
                            <ellipse cx="0" cy="0" rx="16" ry="20" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                            <path d="M -5 -11 L -5 -3 M 0 -13 L 0 -3 M 5 -11 L 5 -3" stroke="#9f1239" strokeWidth="2.3" strokeLinecap="round" />
                          </g>
                          <g transform="translate(502, 394) rotate(-24)">
                            <ellipse cx="0" cy="0" rx="16" ry="20" fill="#fda4af" stroke="#881337" strokeWidth="3.2" />
                            <path d="M -5 -11 L -5 -3 M 0 -13 L 0 -3 M 5 -11 L 5 -3" stroke="#9f1239" strokeWidth="2.3" strokeLinecap="round" />
                          </g>
                        </g>
                      </g>
                    ) : sleepState !== 'AWAKE' ? (
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
                  )}

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
                    <g
                      transform={timerEndPhase === 'eating' ? 'translate(650, 408)' : 'translate(686, 408)'}
                      filter="url(#shSoftShadow)"
                      className="transition-transform duration-500"
                    >
                      <ellipse cx="60" cy="60" rx="68" ry="15" fill="rgba(0,0,0,0.38)" />
                      <path d="M 12 22 L 108 22 L 120 55 Q 60 70 0 55 Z" fill={currentTheme.bowlBody} stroke={currentTheme.bowlStroke} strokeWidth="3" strokeLinejoin="round" />
                      <path d="M 16 32 L 10 50" stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeLinecap="round" />
                      <ellipse cx="60" cy="22" rx="48" ry="13" fill="#47301f" stroke={currentTheme.bowlRim} strokeWidth="4" />
                      <g
                        style={{
                          transformOrigin: '60px 22px',
                          transform: timerEndPhase === 'eating' ? 'scale(0.55)' : 'scale(1)',
                          opacity: timerEndPhase === 'eating' ? 0.55 : 1,
                          transition: 'transform 3.8s ease-out, opacity 3.8s ease-out',
                        }}
                      >
                        <circle cx="38" cy="22" r="5.5" fill="#f59e0b" />
                        <circle cx="52" cy="19" r="6.5" fill="#d97706" />
                        <circle cx="72" cy="21" r="5.5" fill="#fbbf24" />
                        <circle cx="85" cy="23" r="5" fill="#d97706" />
                        <circle cx="46" cy="25" r="5.5" fill="#22c55e" />
                        <circle cx="64" cy="24" r="6" fill="#f97316" stroke="#fdba74" strokeWidth="1.5" />
                        <ellipse cx="56" cy="21" rx="5" ry="3" transform="rotate(-18 56 21)" fill="#27272a" stroke="#e4e4e7" strokeWidth="1" />
                      </g>
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
            )}
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

          <div className="bg-[#23144a]/95 border border-purple-300/25 rounded-[2rem] p-7 sm:p-8 max-w-lg w-full text-center shadow-[0_30px_80px_rgba(0,0,0,0.7)] relative overflow-hidden">
            <div className="w-44 aspect-[4/3] mx-auto mb-5 rounded-2xl overflow-hidden border-2 border-purple-300/40 shadow-xl">
              <img
                src={noiseControlCardImg}
                alt="Noise Control"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>

            <h1 className="text-3xl font-black text-white tracking-tight mb-5">
              Noise Control
            </h1>

            {/* Choose Game Mode Before Starting */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-5">
              <button
                type="button"
                onClick={() => handleSwitchGameMode('sleeping')}
                className={`py-3 px-2.5 rounded-2xl border text-center transition cursor-pointer ${
                  gameMode === 'sleeping'
                    ? 'bg-purple-500/35 border-purple-300 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-purple-200/75 hover:bg-white/10'
                }`}
              >
                <div className="text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>😴</span>
                  <span>Sleeping Hamster</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchGameMode('cage')}
                className={`py-3 px-2.5 rounded-2xl border text-center transition cursor-pointer ${
                  gameMode === 'cage'
                    ? 'bg-amber-400/25 border-amber-300 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-purple-200/75 hover:bg-white/10'
                }`}
              >
                <div className="text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>🐹</span>
                  <span>Hamster Cage</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleSwitchGameMode('bubbles')}
                className={`py-3 px-2.5 rounded-2xl border text-center transition cursor-pointer ${
                  gameMode === 'bubbles'
                    ? 'bg-pink-400/35 border-pink-300 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-purple-200/75 hover:bg-white/10'
                }`}
              >
                <div className="text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 whitespace-nowrap">
                  <span>🫧</span>
                  <span>Hamster Bubbles</span>
                </div>
              </button>
            </div>

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
        const originParam =
          typeof window !== 'undefined' && window.location?.origin
            ? `&origin=${encodeURIComponent(window.location.origin)}`
            : '';
        const embedUrl = `https://www.youtube.com/embed/${track.videoId}?enablejsapi=1&autoplay=1&loop=1&playlist=${track.videoId}${startParam}${originParam}&controls=0&disablekb=1&fs=0&playsinline=1`;
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
              opacity: 0.002,
              zIndex: 10,
            }}
          >
            <iframe
              key={track.id}
              ref={musicIframeRef}
              title={`Noise Control Music ${track.label}`}
              width="320"
              height="240"
              src={embedUrl}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              style={{ border: 0 }}
              onLoad={sendYouTubePlayCommands}
            />
          </div>
        );
      })()}
    </div>
  );
}
