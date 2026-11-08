import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Eye,
  ClipboardList,
  Info,
  Globe,
  Settings,
  Sliders,
  HelpCircle
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
  AnswerContentMode,
  parseOptionContent,
  formatOptionContent
} from '../utils/mediaAndPresets';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  addDoc,
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

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

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

// Normalize questions across all game schemas (Bubble Pop, Mystery Box, Homework, Custom Sets)
function normalizePaintballQuestions(rawList: any): Question[] {
  if (!Array.isArray(rawList)) return [];
  const normalized: Question[] = [];

  rawList.forEach((raw, idx) => {
    if (!raw || typeof raw !== 'object') return;

    // Extract question text & any embedded image URL (`text ||| imageUrl`)
    const rawQuestionStr = String(
      raw.text ?? raw.question ?? raw.prompt ?? raw.title ?? ''
    ).trim();
    const parsedQ = parseOptionContent(rawQuestionStr);
    const cleanText = parsedQ.text.trim();
    const cleanImage =
      (typeof raw.image === 'string' && raw.image.trim()) ||
      (typeof raw.imageUrl === 'string' && raw.imageUrl.trim()) ||
      (typeof raw.mediaUrl === 'string' && raw.mediaUrl.trim()) ||
      parsedQ.imageUrl ||
      undefined;

    // Extract options from `options` or `answers` or `choices`
    let rawOptions: any[] = [];
    if (Array.isArray(raw.options)) {
      rawOptions = raw.options;
    } else if (Array.isArray(raw.answers)) {
      rawOptions = raw.answers;
    } else if (Array.isArray(raw.choices)) {
      rawOptions = raw.choices;
    }

    let inferredCorrectIdx = -1;
    const cleanOptions: string[] = rawOptions
      .map((opt: any, oIdx: number) => {
        if (typeof opt === 'string') return opt.trim();
        if (opt && typeof opt === 'object') {
          if (opt.isCorrect || opt.correct) inferredCorrectIdx = oIdx;
          const t = String(opt.text ?? opt.label ?? opt.value ?? '').trim();
          const img = String(opt.image ?? opt.imageUrl ?? '').trim();
          return img ? formatOptionContent(t, img) : t;
        }
        return String(opt ?? '').trim();
      })
      .filter((o: string) => o.length > 0);

    // Skip completely empty placeholder questions
    if (!cleanText && !cleanImage && cleanOptions.length < 2) {
      return;
    }

    const finalOptions =
      cleanOptions.length >= 2
        ? cleanOptions
        : ['Option A', 'Option B', 'Option C', 'Option D'];

    // Resolve correct answer index from `answerIndex`, `correct`, `correctIndex`, or `correctAnswer`
    let ansIdx = inferredCorrectIdx;
    const candidateIdx =
      raw.answerIndex ?? raw.correct ?? raw.correctIndex ?? raw.correctOption;

    if (typeof candidateIdx === 'number' && !Number.isNaN(candidateIdx)) {
      ansIdx = candidateIdx;
    } else if (typeof candidateIdx === 'string' && candidateIdx.trim() !== '') {
      const num = Number(candidateIdx.trim());
      if (!Number.isNaN(num)) {
        ansIdx = num;
      } else {
        const letterIdx = OPTION_LETTERS.indexOf(candidateIdx.trim().toUpperCase());
        if (letterIdx !== -1) ansIdx = letterIdx;
      }
    }

    if (
      (ansIdx < 0 || ansIdx >= finalOptions.length) &&
      typeof (raw.correctAnswer ?? raw.answer) === 'string'
    ) {
      const targetStr = String(raw.correctAnswer ?? raw.answer).trim().toLowerCase();
      const letterIdx = OPTION_LETTERS.indexOf(targetStr.toUpperCase());
      if (letterIdx !== -1 && letterIdx < finalOptions.length) {
        ansIdx = letterIdx;
      } else {
        const foundOptIdx = finalOptions.findIndex(o => {
          const p = parseOptionContent(o);
          return (
            o.trim().toLowerCase() === targetStr ||
            p.text.trim().toLowerCase() === targetStr
          );
        });
        if (foundOptIdx !== -1) ansIdx = foundOptIdx;
      }
    }

    if (ansIdx < 0 || ansIdx >= finalOptions.length) {
      ansIdx = 0;
    }

    normalized.push({
      id: raw.id ?? idx + 1,
      text: cleanText || (cleanImage ? 'Look at the picture and choose the correct answer:' : `Question ${idx + 1}`),
      options: finalOptions,
      answerIndex: ansIdx,
      ...(cleanImage ? { image: cleanImage } : {})
    });
  });

  return normalized;
}

// =============================================================
// HAMSTER PAINTBALL CHARACTERS (12 FULL-BODY ILLUSTRATED & 3D CHARACTERS)
// =============================================================
interface HamsterSkin {
  id: string;
  name: string;
  roleTitle: string;
  furColor: number;
  furHex: string;
  earInnerHex: string;
  bellyColor: number;
  bellyHex: string;
  visorColor: number;
  visorHex: string;
  strapColor: number;
  vestColor: number;
  vestHex: string;
  paintColor: number;
  paintHex: string;
  badgeBg: string;
  headgear:
    | 'Bandana'
    | 'Helmet'
    | 'SpecOps'
    | 'Crown'
    | 'Cyber'
    | 'Blossom'
    | 'Flame'
    | 'Astro'
    | 'Samurai'
    | 'Headphones'
    | 'Cowboy'
    | 'Viking';
}

const HAMSTER_SKINS: HamsterSkin[] = [
  {
    id: 'amber',
    name: 'Captain Hammy',
    roleTitle: 'Golden Ranger',
    furColor: 0xd97706,
    furHex: '#d97706',
    earInnerHex: '#fda4af',
    bellyColor: 0xfef3c7,
    bellyHex: '#fef3c7',
    visorColor: 0xec4899,
    visorHex: '#ec4899',
    strapColor: 0xbe185d,
    vestColor: 0x1e293b,
    vestHex: '#1e293b',
    paintColor: 0xa3e635,
    paintHex: '#a3e635',
    badgeBg: '#f59e0b',
    headgear: 'Bandana'
  },
  {
    id: 'teal',
    name: 'Mint Striker',
    roleTitle: 'Speed Sprinter',
    furColor: 0x0d9488,
    furHex: '#0d9488',
    earInnerHex: '#99f6e4',
    bellyColor: 0xccfbf1,
    bellyHex: '#ccfbf1',
    visorColor: 0xf97316,
    visorHex: '#f97316',
    strapColor: 0xc2410c,
    vestColor: 0x0f172a,
    vestHex: '#0f172a',
    paintColor: 0x22d3ee,
    paintHex: '#22d3ee',
    badgeBg: '#14b8a6',
    headgear: 'Helmet'
  },
  {
    id: 'cocoa',
    name: 'Shadow Paws',
    roleTitle: 'Stealth Scout',
    furColor: 0x78350f,
    furHex: '#78350f',
    earInnerHex: '#fdba74',
    bellyColor: 0xfde68a,
    bellyHex: '#fde68a',
    visorColor: 0x06b6d4,
    visorHex: '#06b6d4',
    strapColor: 0x0369a1,
    vestColor: 0x18181b,
    vestHex: '#18181b',
    paintColor: 0xf43f5e,
    paintHex: '#f43f5e',
    badgeBg: '#92400e',
    headgear: 'SpecOps'
  },
  {
    id: 'snow',
    name: 'Arctic Frost',
    roleTitle: 'Ice Defender',
    furColor: 0xcbd5e1,
    furHex: '#cbd5e1',
    earInnerHex: '#f9a8d4',
    bellyColor: 0xffffff,
    bellyHex: '#ffffff',
    visorColor: 0x84cc16,
    visorHex: '#84cc16',
    strapColor: 0x4d7c0f,
    vestColor: 0x334155,
    vestHex: '#334155',
    paintColor: 0xa855f7,
    paintHex: '#a855f7',
    badgeBg: '#64748b',
    headgear: 'Crown'
  },
  {
    id: 'violet',
    name: 'Neon Viper',
    roleTitle: 'Cyber Blaster',
    furColor: 0x7c3aed,
    furHex: '#7c3aed',
    earInnerHex: '#ddd6fe',
    bellyColor: 0xede9fe,
    bellyHex: '#ede9fe',
    visorColor: 0xfacc15,
    visorHex: '#facc15',
    strapColor: 0xa16207,
    vestColor: 0x1e1b4b,
    vestHex: '#1e1b4b',
    paintColor: 0xfacc15,
    paintHex: '#facc15',
    badgeBg: '#7c3aed',
    headgear: 'Cyber'
  },
  {
    id: 'sakura',
    name: 'Sakura Splat',
    roleTitle: 'Paint Artist',
    furColor: 0xec4899,
    furHex: '#ec4899',
    earInnerHex: '#fbcfe8',
    bellyColor: 0xfce7f3,
    bellyHex: '#fce7f3',
    visorColor: 0x38bdf8,
    visorHex: '#38bdf8',
    strapColor: 0x0284c7,
    vestColor: 0x3b0764,
    vestHex: '#3b0764',
    paintColor: 0xf472b6,
    paintHex: '#f472b6',
    badgeBg: '#db2777',
    headgear: 'Blossom'
  },
  {
    id: 'blaze',
    name: 'Blaze Inferno',
    roleTitle: 'Pyro Striker',
    furColor: 0xea580c,
    furHex: '#ea580c',
    earInnerHex: '#fed7aa',
    bellyColor: 0xffedd5,
    bellyHex: '#ffedd5',
    visorColor: 0xfef08a,
    visorHex: '#fef08a',
    strapColor: 0x9a3412,
    vestColor: 0x450a0a,
    vestHex: '#450a0a',
    paintColor: 0xf97316,
    paintHex: '#f97316',
    badgeBg: '#ea580c',
    headgear: 'Flame'
  },
  {
    id: 'astro',
    name: 'Astro Nibbles',
    roleTitle: 'Galaxy Ranger',
    furColor: 0x2563eb,
    furHex: '#2563eb',
    earInnerHex: '#bfdbfe',
    bellyColor: 0xeff6ff,
    bellyHex: '#eff6ff',
    visorColor: 0x22d3ee,
    visorHex: '#22d3ee',
    strapColor: 0x1e40af,
    vestColor: 0x0f172a,
    vestHex: '#0f172a',
    paintColor: 0x38bdf8,
    paintHex: '#38bdf8',
    badgeBg: '#2563eb',
    headgear: 'Astro'
  },
  {
    id: 'samurai',
    name: 'Shogun Whiskers',
    roleTitle: 'Samurai Duelist',
    furColor: 0x334155,
    furHex: '#334155',
    earInnerHex: '#fda4af',
    bellyColor: 0xe2e8f0,
    bellyHex: '#e2e8f0',
    visorColor: 0xef4444,
    visorHex: '#ef4444',
    strapColor: 0x991b1b,
    vestColor: 0x09090b,
    vestHex: '#09090b',
    paintColor: 0xef4444,
    paintHex: '#ef4444',
    badgeBg: '#dc2626',
    headgear: 'Samurai'
  },
  {
    id: 'dj',
    name: 'DJ Cheeks',
    roleTitle: 'Bass Dropper',
    furColor: 0x65a30d,
    furHex: '#65a30d',
    earInnerHex: '#d9f99d',
    bellyColor: 0xf7fee7,
    bellyHex: '#f7fee7',
    visorColor: 0xe879f9,
    visorHex: '#e879f9',
    strapColor: 0x86198f,
    vestColor: 0x1e1b4b,
    vestHex: '#1e1b4b',
    paintColor: 0xa3e635,
    paintHex: '#a3e635',
    badgeBg: '#65a30d',
    headgear: 'Headphones'
  },
  {
    id: 'sheriff',
    name: 'Sheriff Peanut',
    roleTitle: 'Wild West Ace',
    furColor: 0xb45309,
    furHex: '#b45309',
    earInnerHex: '#fde68a',
    bellyColor: 0xfef9c3,
    bellyHex: '#fef9c3',
    visorColor: 0x38bdf8,
    visorHex: '#38bdf8',
    strapColor: 0x78350f,
    vestColor: 0x422006,
    vestHex: '#422006',
    paintColor: 0xfacc15,
    paintHex: '#facc15',
    badgeBg: '#d97706',
    headgear: 'Cowboy'
  },
  {
    id: 'viking',
    name: 'Viking Chonk',
    roleTitle: 'Nordic Berserker',
    furColor: 0x9a3412,
    furHex: '#9a3412',
    earInnerHex: '#fed7aa',
    bellyColor: 0xffedd5,
    bellyHex: '#ffedd5',
    visorColor: 0x10b981,
    visorHex: '#10b981',
    strapColor: 0x065f46,
    vestColor: 0x1c1917,
    vestHex: '#1c1917',
    paintColor: 0x10b981,
    paintHex: '#10b981',
    badgeBg: '#059669',
    headgear: 'Viking'
  }
];

function HamsterCharacterAvatar({
  skin,
  size = 64,
  team = 'solo'
}: {
  skin: HamsterSkin;
  size?: number;
  team?: TeamId;
}) {
  const uid = `h3d-${skin.id}-${team || 'solo'}`;
  const isRedTeam = team === 'red';
  const isBlueTeam = team === 'blue';
  const hasTeamBand = isRedTeam || isBlueTeam;
  const teamBandHex = isRedTeam ? '#ef4444' : isBlueTeam ? '#2563eb' : skin.paintHex;
  const teamBandHiHex = isRedTeam ? '#fca5a5' : isBlueTeam ? '#93c5fd' : '#ffffff';
  const teamBandDarkHex = isRedTeam ? '#7f1d1d' : isBlueTeam ? '#1e3a8a' : '#0f172a';
  const activePaintHex = hasTeamBand ? teamBandHex : skin.paintHex;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 110 116"
      className="overflow-visible select-none shrink-0 drop-shadow-[0_6px_10px_rgba(15,23,42,0.32)]"
    >
      <defs>
        {/* 3D Spherical Fur Lighting Gradient */}
        <radialGradient id={`${uid}-fur`} cx="34%" cy="26%" r="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.62" />
          <stop offset="22%" stopColor={skin.furHex} />
          <stop offset="72%" stopColor={skin.furHex} />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.88" />
        </radialGradient>

        {/* 3D Ear & Sneaker Rim Shadow Gradient */}
        <radialGradient id={`${uid}-ear`} cx="30%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="30%" stopColor={skin.furHex} />
          <stop offset="100%" stopColor="#090d16" />
        </radialGradient>

        {/* 3D Inner Ear & Blush Gradient */}
        <radialGradient id={`${uid}-inner`} cx="36%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="35%" stopColor={skin.earInnerHex} />
          <stop offset="100%" stopColor="#be123c" stopOpacity="0.85" />
        </radialGradient>

        {/* 3D Belly Plush Sphere Gradient */}
        <radialGradient id={`${uid}-belly`} cx="36%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor={skin.bellyHex} />
          <stop offset="100%" stopColor={skin.furHex} />
        </radialGradient>

        {/* 3D Molded Tactical Chest Armor Gradient */}
        <linearGradient id={`${uid}-vest`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="40%" stopColor={skin.vestHex} />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* 3D Team Headband Cylindrical Gradient */}
        <linearGradient id={`${uid}-band`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={teamBandHiHex} />
          <stop offset="32%" stopColor={teamBandHex} />
          <stop offset="78%" stopColor={teamBandHex} />
          <stop offset="100%" stopColor={teamBandDarkHex} />
        </linearGradient>

        {/* 3D Curved Glass Visor Gradient */}
        <linearGradient id={`${uid}-visor`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.92" />
          <stop offset="22%" stopColor={skin.visorHex} />
          <stop offset="75%" stopColor={skin.visorHex} />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        {/* 3D Blaster Metallic Receiver Gradient */}
        <linearGradient id={`${uid}-gun`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={teamBandHiHex} />
          <stop offset="35%" stopColor={hasTeamBand ? teamBandHex : '#0284c7'} />
          <stop offset="100%" stopColor="#090d16" />
        </linearGradient>

        {/* 3D Paint Hopper Sphere Gradient */}
        <radialGradient id={`${uid}-pod`} cx="34%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="32%" stopColor={activePaintHex} />
          <stop offset="100%" stopColor="#020617" />
        </radialGradient>
      </defs>

      {/* 3D Ground Pedestal Glow & Ambient Occlusion Drop Shadow */}
      <ellipse cx="55" cy="105" rx="35" ry="7.5" fill="rgba(2,6,23,0.34)" />
      <ellipse
        cx="55"
        cy="104"
        rx="29"
        ry="5"
        fill={hasTeamBand ? teamBandHex : skin.badgeBg}
        opacity="0.42"
      />

      {/* 3D Flowing Team Headband Knot & Tails Behind Head */}
      <g>
        <path
          d="M 81 26 C 95 19, 104 26, 106 35 C 98 38, 89 34, 81 30 Z"
          fill={`url(#${uid}-band)`}
        />
        <path
          d="M 80 31 C 93 32, 100 41, 100 49 C 91 48, 85 40, 79 34 Z"
          fill={`url(#${uid}-band)`}
        />
        <circle cx="83" cy="29" r="5.5" fill={`url(#${uid}-band)`} />
      </g>

      {/* 3D Sculpted Round Hamster Ears */}
      <g>
        <circle cx="28" cy="21" r="13" fill={`url(#${uid}-ear)`} />
        <circle cx="28" cy="21" r="7.5" fill={`url(#${uid}-inner)`} />
        <ellipse cx="25.5" cy="17.5" rx="3.2" ry="2" fill="#ffffff" opacity="0.52" />

        <circle cx="82" cy="21" r="13" fill={`url(#${uid}-ear)`} />
        <circle cx="82" cy="21" r="7.5" fill={`url(#${uid}-inner)`} />
        <ellipse cx="79.5" cy="17.5" rx="3.2" ry="2" fill="#ffffff" opacity="0.52" />
      </g>

      {/* 3D Volumetric Sneakers / Paws at Base */}
      <g>
        <ellipse cx="39" cy="98" rx="12" ry="7" fill="#0f172a" />
        <ellipse cx="39" cy="96.5" rx="10.5" ry="5.5" fill={`url(#${uid}-ear)`} />
        <ellipse cx="36.5" cy="95" rx="4.5" ry="2" fill="#ffffff" opacity="0.5" />

        <ellipse cx="71" cy="98" rx="12" ry="7" fill="#0f172a" />
        <ellipse cx="71" cy="96.5" rx="10.5" ry="5.5" fill={`url(#${uid}-ear)`} />
        <ellipse cx="68.5" cy="95" rx="4.5" ry="2" fill="#ffffff" opacity="0.5" />
      </g>

      {/* 3D Sculpted Plump Hamster Torso */}
      <path
        d="M 25 62 C 21 46, 32 39, 55 39 C 78 39, 89 46, 85 62 C 89 83, 78 96, 55 96 C 32 96, 21 83, 25 62 Z"
        fill={`url(#${uid}-fur)`}
      />

      {/* 3D Plush Cream Belly */}
      <ellipse cx="55" cy="74" rx="21" ry="16.5" fill={`url(#${uid}-belly)`} />

      {/* 3D Shoulder Armor Pauldrons */}
      <ellipse cx="26" cy="65" rx="8.5" ry="6.5" fill={`url(#${uid}-vest)`} />
      <ellipse cx="84" cy="65" rx="8.5" ry="6.5" fill={`url(#${uid}-vest)`} />

      {/* 3D Tactical Paintball Chest Vest */}
      <path
        d="M 31 58 Q 55 63 79 58 L 75 91 Q 55 96 35 91 Z"
        fill={`url(#${uid}-vest)`}
      />
      {/* 3D Team Ribbons & Glowing Chest Reactor Core */}
      <path d="M 35 60 L 43 61 L 41 89 L 35 87 Z" fill={`url(#${uid}-band)`} opacity="0.92" />
      <path d="M 75 60 L 67 61 L 69 89 L 75 87 Z" fill={`url(#${uid}-band)`} opacity="0.92" />
      <rect x="46.5" y="66.5" width="17" height="12.5" rx="4" fill="#020617" />
      <rect x="48.5" y="68.5" width="13" height="8.5" rx="2.8" fill={`url(#${uid}-visor)`} />
      <ellipse cx="52.5" cy="71" rx="3.2" ry="1.4" fill="#ffffff" opacity="0.8" />

      {/* 3D Belt Canisters (Health Can on Left Hip, Defence Can on Right Hip) */}
      <g transform="translate(25, 76) rotate(-8)">
        <rect x="0" y="0" width="8.5" height="12.5" rx="3" fill="#059669" />
        <rect x="1.2" y="1" width="3" height="10" rx="1.2" fill="#6ee7b7" opacity="0.7" />
        <rect x="1.8" y="-2" width="5" height="2.4" rx="1" fill="#f8fafc" />
      </g>
      <g transform="translate(76, 76) rotate(8)">
        <rect x="0" y="0" width="8.5" height="12.5" rx="3" fill="#0284c7" />
        <rect x="1.2" y="1" width="3" height="10" rx="1.2" fill="#7dd3fc" opacity="0.7" />
        <rect x="1.8" y="-2" width="5" height="2.4" rx="1" fill="#f8fafc" />
      </g>

      {/* 3D Spherical Hamster Head & Sculpted Chubby Cheeks */}
      <ellipse cx="55" cy="41" rx="32" ry="26" fill={`url(#${uid}-fur)`} />
      <circle cx="27" cy="47" r="12" fill={`url(#${uid}-fur)`} />
      <circle cx="83" cy="47" r="12" fill={`url(#${uid}-fur)`} />

      {/* 3D Plush Muzzle & Soft Cheek Glow */}
      <ellipse cx="55" cy="50" rx="21" ry="13" fill={`url(#${uid}-belly)`} />
      <ellipse cx="30" cy="50" rx="6" ry="3.8" fill="#fb7185" opacity="0.78" />
      <ellipse cx="80" cy="50" rx="6" ry="3.8" fill="#fb7185" opacity="0.78" />
      {/* 3D Forehead Specular Highlight */}
      <ellipse cx="44" cy="22" rx="13" ry="5" fill="#ffffff" opacity="0.38" />

      {/* 3D Character Headgear */}
      {skin.headgear === 'Helmet' && (
        <path d="M 25 27 C 27 10, 83 10, 85 27 Z" fill={`url(#${uid}-vest)`} />
      )}
      {skin.headgear === 'SpecOps' && (
        <g>
          <path d="M 26 26 C 30 12, 80 12, 84 26 Z" fill="#090d16" />
          <circle cx="43" cy="18" r="4" fill="#22c55e" />
          <circle cx="42" cy="17" r="1.4" fill="#ffffff" />
          <circle cx="67" cy="18" r="4" fill="#22c55e" />
          <circle cx="66" cy="17" r="1.4" fill="#ffffff" />
        </g>
      )}
      {skin.headgear === 'Crown' && (
        <polygon points="36,19 43,5 55,14 67,5 74,19" fill="#facc15" />
      )}
      {skin.headgear === 'Cyber' && (
        <g>
          <polygon points="34,19 55,6 76,19" fill="#facc15" />
          <circle cx="55" cy="14" r="3.5" fill="#7c3aed" />
        </g>
      )}
      {skin.headgear === 'Blossom' && (
        <g>
          <circle cx="37" cy="15" r="6.2" fill="#f472b6" />
          <circle cx="37" cy="15" r="2.6" fill="#fef08a" />
          <circle cx="73" cy="15" r="6.2" fill="#f472b6" />
          <circle cx="73" cy="15" r="2.6" fill="#fef08a" />
        </g>
      )}
      {skin.headgear === 'Flame' && (
        <g>
          <polygon points="39,20 48,4 55,14 62,2 71,20" fill="#f97316" />
          <polygon points="46,19 55,7 64,19" fill="#fef08a" />
        </g>
      )}
      {skin.headgear === 'Astro' && (
        <g>
          <line x1="55" y1="16" x2="55" y2="4" stroke="#94a3b8" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="55" cy="4.5" r="5" fill={`url(#${uid}-visor)`} />
          <circle cx="53.5" cy="3" r="1.8" fill="#ffffff" />
        </g>
      )}
      {skin.headgear === 'Samurai' && (
        <g>
          <polygon points="55,18 35,3 46,19" fill="#facc15" />
          <polygon points="55,18 75,3 64,19" fill="#facc15" />
        </g>
      )}
      {skin.headgear === 'Headphones' && (
        <g>
          <path d="M 20 35 C 20 9, 90 9, 90 35" fill="none" stroke="#a3e635" strokeWidth="4.5" strokeLinecap="round" />
          <rect x="14" y="27" width="9.5" height="17" rx="4.5" fill="#ec4899" />
          <rect x="86.5" y="27" width="9.5" height="17" rx="4.5" fill="#ec4899" />
        </g>
      )}
      {skin.headgear === 'Cowboy' && (
        <g>
          <ellipse cx="55" cy="18" rx="33" ry="5.8" fill="#78350f" />
          <path d="M 36 18 C 38 5, 49 7, 55 10 C 61 7, 72 5, 74 18 Z" fill="#b45309" />
          <circle cx="55" cy="14" r="3" fill="#facc15" />
        </g>
      )}
      {skin.headgear === 'Viking' && (
        <g>
          <path d="M 32 21 C 23 7, 15 9, 19 3 C 27 3, 34 11, 38 17 Z" fill="#fef3c7" />
          <path d="M 78 21 C 87 7, 95 9, 91 3 C 83 3, 76 11, 72 17 Z" fill="#fef3c7" />
        </g>
      )}

      {/* 3D Wrap-Around Team Headband (Always visible, bright Red for Red Team, bright Blue for Blue Team) */}
      <g>
        <path
          d="M 23 30 Q 55 21 87 30 L 86 21 Q 55 12 24 21 Z"
          fill={`url(#${uid}-band)`}
        />
        <rect x="46.5" y="19.5" width="17" height="7" rx="3.5" fill="#f8fafc" />
        <rect x="48.5" y="21" width="13" height="4" rx="2" fill={teamBandHex} />
      </g>

      {/* 3D Curved Pro Paintball Visor & 3D Glossy Eyes */}
      <rect x="25" y="29" width="60" height="18.5" rx="9.2" fill="#020617" />
      <rect x="27" y="30.5" width="56" height="15.5" rx="7.8" fill={`url(#${uid}-visor)`} />
      {/* 3D Eyes with Dual Specular Catchlights */}
      <circle cx="42" cy="38.5" r="4.5" fill="#020617" opacity="0.86" />
      <circle cx="40.5" cy="36.8" r="1.9" fill="#ffffff" />
      <circle cx="43.5" cy="39.8" r="0.9" fill="#ffffff" opacity="0.8" />
      <circle cx="68" cy="38.5" r="4.5" fill="#020617" opacity="0.86" />
      <circle cx="66.5" cy="36.8" r="1.9" fill="#ffffff" />
      <circle cx="69.5" cy="39.8" r="0.9" fill="#ffffff" opacity="0.8" />
      {/* 3D Curved Lens Glint */}
      <path
        d="M 32 33.5 Q 55 31 77 33.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.82"
      />

      {/* 3D Sculpted Pink Nose, Smile & Cute Tooth */}
      <ellipse cx="55" cy="49.5" rx="4.5" ry="3.2" fill="#f43f5e" />
      <ellipse cx="53.6" cy="48.5" rx="1.6" ry="1" fill="#ffffff" opacity="0.8" />
      <path
        d="M 49 54.5 Q 55 59 61 54.5"
        fill="none"
        stroke="#1e293b"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <rect x="52.8" y="55.8" width="4.4" height="4.2" rx="1.2" fill="#ffffff" />

      {/* 3D Left Paw */}
      <ellipse cx="26" cy="72" rx="8.5" ry="7.2" fill={`url(#${uid}-fur)`} />
      <ellipse cx="24" cy="70" rx="3.2" ry="1.8" fill="#ffffff" opacity="0.45" />

      {/* 3D Pro Paintball Marker Held Across Chest */}
      <g transform="rotate(-9 62 72)">
        {/* Pressurized Tank */}
        <rect x="46" y="75" width="15" height="6.8" rx="3.4" fill="#0f172a" />
        {/* 3D Spherical Paint Hopper */}
        <ellipse cx="62" cy="59.5" rx="10.5" ry="7" fill={`url(#${uid}-pod)`} />
        <ellipse cx="59" cy="57.5" rx="4.2" ry="1.8" fill="#ffffff" opacity="0.72" />
        {/* 3D Marker Receiver Body */}
        <rect x="50" y="65.5" width="33" height="10.5" rx="5" fill={`url(#${uid}-gun)`} />
        <rect x="54" y="67.2" width="21" height="2.6" rx="1.3" fill="#ffffff" opacity="0.5" />
        {/* Carbon Barrel & Muzzle */}
        <rect x="79" y="67.5" width="14" height="6.5" rx="3" fill="#1e293b" />
        <circle cx="93" cy="70.8" r="3.8" fill={activePaintHex} />
        <circle cx="91.8" cy="69.6" r="1.4" fill="#ffffff" opacity="0.85" />
      </g>

      {/* 3D Right Paw Gripping Marker */}
      <ellipse cx="83" cy="74" rx="8.5" ry="7.2" fill={`url(#${uid}-fur)`} />
      <ellipse cx="81" cy="72" rx="3.2" ry="1.8" fill="#ffffff" opacity="0.45" />
    </svg>
  );
}

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
    colorHex: '#ef4444',
    colorNum: 0xef4444,
    bgClass: 'bg-red-500/25 text-red-300',
    borderClass: 'border-red-500'
  },
  blue: {
    label: 'Blue Squad',
    colorHex: '#2563eb',
    colorNum: 0x2563eb,
    bgClass: 'bg-blue-500/25 text-blue-300',
    borderClass: 'border-blue-500'
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
// PROCEDURAL WEB AUDIO SOUND ENGINE (MULTI-LAYERED SYNTHESIS)
// =============================================================
class PaintballAudioEngine {
  ctx: AudioContext | null = null;
  noiseBuffer: AudioBuffer | null = null;
  enabled: boolean = true;
  musicEnabled: boolean = true;
  shouldPlayMusic: boolean = false;
  isMusicPlaying: boolean = false;
  isFrenzyTempo: boolean = false;
  musicTimer: number | null = null;
  musicStep: number = 0;
  lastFootstepTime: number = 0;

  // YouTube Soundtrack Integration (https://www.youtube.com/watch?v=Kghe1Ek96tE)
  ytPlayer: any = null;
  ytReady: boolean = false;
  ytPlaying: boolean = false;
  ytInitializing: boolean = false;
  readonly ytVideoId: string = 'Kghe1Ek96tE';

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 0.4, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    this.ensureYouTubePlayer();
    if (this.ytReady && this.ytPlayer) {
      try {
        if (this.shouldPlayMusic && this.enabled && this.musicEnabled) {
          if (typeof this.ytPlayer.unMute === 'function') this.ytPlayer.unMute();
          if (typeof this.ytPlayer.setVolume === 'function') this.ytPlayer.setVolume(85);
          if (!this.ytPlaying && typeof this.ytPlayer.playVideo === 'function') {
            this.ytPlayer.playVideo();
          }
        } else {
          if (typeof this.ytPlayer.pauseVideo === 'function') {
            this.ytPlayer.pauseVideo();
          }
        }
      } catch {}
    }
    if (this.shouldPlayMusic && this.enabled && this.musicEnabled && !this.isMusicPlaying) {
      this.startMusicLoopInternal();
    }
  }

  ensureYouTubePlayer() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this.ytPlayer || this.ytInitializing) return;
    this.ytInitializing = true;

    const mountPlayer = () => {
      const win = window as any;
      if (!win.YT || !win.YT.Player) {
        this.ytInitializing = false;
        return;
      }
      let hostEl = document.getElementById('pb-yt-bgm-host');
      if (!hostEl) {
        hostEl = document.createElement('div');
        hostEl.id = 'pb-yt-bgm-host';
        hostEl.style.position = 'fixed';
        hostEl.style.width = '1px';
        hostEl.style.height = '1px';
        hostEl.style.bottom = '0px';
        hostEl.style.left = '0px';
        hostEl.style.opacity = '0.001';
        hostEl.style.pointerEvents = 'none';
        hostEl.style.zIndex = '-1';
        const innerEl = document.createElement('div');
        innerEl.id = 'pb-yt-bgm-iframe';
        hostEl.appendChild(innerEl);
        document.body.appendChild(hostEl);
      }

      try {
        this.ytPlayer = new win.YT.Player('pb-yt-bgm-iframe', {
          width: '64',
          height: '64',
          videoId: this.ytVideoId,
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            loop: 1,
            playlist: this.ytVideoId,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
             origin: window.location.origin
          },
          events: {
            onReady: (ev: any) => {
              this.ytReady = true;
              this.ytInitializing = false;
              try {
                ev.target.setVolume(85);
                if (this.shouldPlayMusic && this.enabled && this.musicEnabled) {
                  ev.target.unMute();
                  ev.target.playVideo();
                } else {
                  ev.target.pauseVideo();
                }
              } catch {}
            },
            onStateChange: (ev: any) => {
              // YT.PlayerState.PLAYING === 1, ENDED === 0
              if (ev.data === 1) {
                this.ytPlaying = true;
                if (!this.shouldPlayMusic || !this.enabled || !this.musicEnabled) {
                  try {
                    ev.target.pauseVideo();
                  } catch {}
                  this.ytPlaying = false;
                }
              } else if (ev.data === 0) {
                // Loop seamlessly
                if (this.shouldPlayMusic && this.enabled && this.musicEnabled) {
                  try {
                    ev.target.seekTo(0);
                    ev.target.playVideo();
                  } catch {}
                } else {
                  this.ytPlaying = false;
                }
              } else {
                this.ytPlaying = false;
              }
            },
            onError: () => {
              this.ytPlaying = false;
              this.ytInitializing = false;
            }
          }
        });
      } catch {
        this.ytInitializing = false;
      }
    };

    const win = window as any;
    if (win.YT && win.YT.Player) {
      mountPlayer();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]'
      );
      const prevCallback = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') {
          try {
            prevCallback();
          } catch {}
        }
        mountPlayer();
      };
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      }
    }
  }

  // Pneumatic CO2 Paintball Marker Pop + Mechanical Bolt Click
  playMarkerShot() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Sub-bass pneumatic pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.09);
    gain.gain.setValueAtTime(0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    // 2. Crisp CO2 air burst
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(1.8, now);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.07);
    }
  }

  // Juicy Wet Paintball Splat
  playSplat() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Liquid bubble pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.13);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.145);

    // 2. Wet paint splash noise
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.12);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.125);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.13);
    }
  }

  // Metallic Canister Pickup Chime (when collecting a Health Can or Defence Can in the arena)
  playCanPickup() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      g.gain.setValueAtTime(0.22, now + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.055 + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.17);
    });
  }

  // Rising Pressurized Fizz / Charge Tick while Long-Pressing a Health or Defence Can
  playCanHoldTick(progress: number, type: 'health' | 'shield') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type === 'health' ? 'sine' : 'triangle';
    const baseFreq = type === 'health' ? 340 : 400;
    osc.frequency.setValueAtTime(baseFreq + progress * 560, now);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Can Pop-Tab Open + Fizzy Restore Fanfare when Long-Press Finishes (100%)
  playCanUseComplete(type: 'health' | 'shield') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Crisp metallic pull-tab pop
    const tabOsc = this.ctx.createOscillator();
    const tabGain = this.ctx.createGain();
    tabOsc.type = 'square';
    tabOsc.frequency.setValueAtTime(1350, now);
    tabOsc.frequency.exponentialRampToValueAtTime(2400, now + 0.035);
    tabGain.gain.setValueAtTime(0.16, now);
    tabGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    tabOsc.connect(tabGain);
    tabGain.connect(this.ctx.destination);
    tabOsc.start(now);
    tabOsc.stop(now + 0.045);

    // 2. Harmonic restore arpeggio
    const notes =
      type === 'health'
        ? [523.25, 659.25, 783.99, 1046.5]
        : [440, 659.25, 880, 1318.5];
    notes.forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type === 'health' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.04 + i * 0.055);
      g.gain.setValueAtTime(0.24, now + 0.04 + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.04 + i * 0.055 + 0.24);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + 0.04 + i * 0.055);
      osc.stop(now + 0.04 + i * 0.055 + 0.26);
    });
  }

  // Subtle Turf Footstep Thump
  playFootstep() {
    if (!this.enabled) return;
    const nowMs = performance.now();
    if (nowMs - this.lastFootstepTime < 240) return;
    this.lastFootstepTime = nowMs;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.045);
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // Armor / Shield Hit Impact
  playDamageHit() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.14);
    g.gain.setValueAtTime(0.26, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playPowerup() {
    this.playCanUseComplete('health');
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

  // Countdown Timer Tick (Crisp clock tick, urgent double-beep in final 10s)
  playTimerTick(isUrgent: boolean = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = isUrgent ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 987.77 : 660, now);
    osc.frequency.exponentialRampToValueAtTime(isUrgent ? 1318.5 : 440, now + 0.065);
    g.gain.setValueAtTime(isUrgent ? 0.18 : 0.1, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Ascending Points Combo Chime
  playScoreCombo(streak: number = 1) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const baseFreq = 523.25 * Math.min(1.6, 1 + streak * 0.08);
    [baseFreq, baseFreq * 1.25, baseFreq * 1.5].forEach((freq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      g.gain.setValueAtTime(0.18, now + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.18);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.2);
    });
  }

  // Upbeat Paintball Battle Soundtrack (YouTube Kghe1Ek96tE + Synth Fallback)
  setFrenzyTempo(frenzy: boolean) {
    if (this.isFrenzyTempo === frenzy) return;
    this.isFrenzyTempo = frenzy;
    if (this.ytReady && this.ytPlayer && typeof this.ytPlayer.setPlaybackRate === 'function') {
      try {
        this.ytPlayer.setPlaybackRate(frenzy ? 1.15 : 1.0);
      } catch {}
    }
    if (this.isMusicPlaying) {
      this.stopMusicLoopInternal();
      this.startMusicLoopInternal();
    }
  }

  startMusic() {
    this.shouldPlayMusic = true;
    if (!this.enabled || !this.musicEnabled) return;
    this.init();
    if (this.ytReady && this.ytPlayer) {
      try {
        if (typeof this.ytPlayer.unMute === 'function') this.ytPlayer.unMute();
        if (typeof this.ytPlayer.setVolume === 'function') this.ytPlayer.setVolume(85);
        if (typeof this.ytPlayer.playVideo === 'function') this.ytPlayer.playVideo();
      } catch {}
    }
    if (!this.isMusicPlaying) {
      this.startMusicLoopInternal();
    }
  }

  stopMusic() {
    this.shouldPlayMusic = false;
    this.stopMusicLoopInternal();
    if (this.ytReady && this.ytPlayer && typeof this.ytPlayer.pauseVideo === 'function') {
      try {
        this.ytPlayer.pauseVideo();
      } catch {}
    }
    this.ytPlaying = false;
  }

  private stopMusicLoopInternal() {
    if (this.musicTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.isMusicPlaying = false;
  }

  private startMusicLoopInternal() {
    if (typeof window === 'undefined') return;
    this.stopMusicLoopInternal();
    if (!this.enabled || !this.musicEnabled || !this.shouldPlayMusic) return;
    this.isMusicPlaying = true;
    const stepMs = this.isFrenzyTempo ? 105 : 120;
    this.musicTimer = window.setInterval(() => {
      this.playMusicStep();
    }, stepMs);
  }

  private playMusicStep() {
    if (!this.enabled || !this.musicEnabled || !this.shouldPlayMusic) {
      this.stopMusicLoopInternal();
      return;
    }
    // When YouTube track https://www.youtube.com/watch?v=Kghe1Ek96tE is actively streaming,
    // let the YouTube track play cleanly without overlapping synth notes!
    if (this.ytPlaying) {
      return;
    }
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return;
    }

    const now = this.ctx.currentTime;
    const step = this.musicStep % 32;
    this.musicStep = (this.musicStep + 1) % 32;

    // 1. Punchy Synth Bassline
    const bassProgression = [
      110.0, 0, 110.0, 110.0, 0, 110.0, 130.81, 146.83,
      87.31, 0, 87.31, 87.31, 0, 87.31, 110.0, 130.81,
      130.81, 0, 130.81, 130.81, 0, 130.81, 146.83, 164.81,
      98.0, 0, 98.0, 98.0, 110.0, 0, 123.47, 98.0
    ];
    const bassFreq = bassProgression[step];
    if (bassFreq > 0) {
      const bOsc = this.ctx.createOscillator();
      const bFilter = this.ctx.createBiquadFilter();
      const bGain = this.ctx.createGain();
      bOsc.type = 'sawtooth';
      bOsc.frequency.setValueAtTime(bassFreq, now);
      bFilter.type = 'lowpass';
      bFilter.frequency.setValueAtTime(480, now);
      bFilter.frequency.exponentialRampToValueAtTime(160, now + 0.1);
      bGain.gain.setValueAtTime(0.052, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      bOsc.connect(bFilter);
      bFilter.connect(bGain);
      bGain.connect(this.ctx.destination);
      bOsc.start(now);
      bOsc.stop(now + 0.115);
    }

    // 2. Heroic Arcade Lead Melody Hook
    const leadMelody = [
      440.0, 0, 523.25, 659.25, 587.33, 0, 523.25, 440.0,
      349.23, 0, 440.0, 523.25, 659.25, 0, 587.33, 523.25,
      523.25, 0, 659.25, 783.99, 659.25, 0, 587.33, 523.25,
      392.0, 440.0, 493.88, 0, 587.33, 523.25, 493.88, 392.0
    ];
    const leadFreq = leadMelody[step];
    if (leadFreq > 0) {
      const lOsc = this.ctx.createOscillator();
      const lGain = this.ctx.createGain();
      lOsc.type = 'triangle';
      const pitchMult = this.isFrenzyTempo ? 1.12246 : 1.0;
      lOsc.frequency.setValueAtTime(leadFreq * pitchMult, now);
      lGain.gain.setValueAtTime(0.045, now);
      lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      lOsc.connect(lGain);
      lGain.connect(this.ctx.destination);
      lOsc.start(now);
      lOsc.stop(now + 0.145);
    }

    // 3. Kick Drum on beats 0, 4, 8, 12...
    if (step % 4 === 0) {
      const kOsc = this.ctx.createOscillator();
      const kGain = this.ctx.createGain();
      kOsc.type = 'sine';
      kOsc.frequency.setValueAtTime(125, now);
      kOsc.frequency.exponentialRampToValueAtTime(36, now + 0.085);
      kGain.gain.setValueAtTime(0.075, now);
      kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      kOsc.connect(kGain);
      kGain.connect(this.ctx.destination);
      kOsc.start(now);
      kOsc.stop(now + 0.095);
    }

    // 4. Snare / Hi-Hat Groove
    if (this.noiseBuffer && (step % 4 === 2 || step % 2 === 1)) {
      const isSnare = step % 4 === 2;
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = this.noiseBuffer;
      const nFilt = this.ctx.createBiquadFilter();
      nFilt.type = isSnare ? 'bandpass' : 'highpass';
      nFilt.frequency.setValueAtTime(isSnare ? 1600 : 5200, now);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(isSnare ? 0.032 : 0.014, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (isSnare ? 0.07 : 0.03));
      nSrc.connect(nFilt);
      nFilt.connect(nGain);
      nGain.connect(this.ctx.destination);
      nSrc.start(now);
      nSrc.stop(now + (isSnare ? 0.075 : 0.035));
    }
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
  hitsLanded?: number;
  bestStreak?: number;
  immuneUntil?: number;
  questionsAnswered: number;
  updatedAt: number;
  kicked?: boolean;
  lastShot?: {
    shotId: string;
    x: number;
    z: number;
    angle: number;
    paintColor: number;
  };
  lastHit?: {
    hitId: string;
    targetId: string;
    damage: number;
    attackerName: string;
    attackerId: string;
  };
  lastKo?: {
    koId: string;
    attackerId: string;
    victimName: string;
  };
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
  // 1. QUIZ / CURRICULUM STATE & INITIAL SCREEN ROUTING
  // -------------------------------------------------------------
  const hasLoadedQuestions = Boolean(
    initialGame &&
      normalizePaintballQuestions(
        Array.isArray(initialGame.customQuestions) && initialGame.customQuestions.length > 0
          ? initialGame.customQuestions
          : initialGame.questions
      ).length > 0
  );

  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame && !initialSetup.current.isJoiningStudent) {
      const rawList =
        Array.isArray(initialGame.customQuestions) && initialGame.customQuestions.length > 0
          ? initialGame.customQuestions
          : Array.isArray(initialGame.questions) && initialGame.questions.length > 0
          ? initialGame.questions
          : [];
      const normalizedQs = normalizePaintballQuestions(rawList);
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions:
          normalizedQs.length > 0
            ? normalizedQs
            : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }],
        folderId: initialGame.folderId || ''
      };
    }
    if (initialSetup.current.isJoiningStudent) {
      return {
        id: `paintball-${Date.now()}`,
        title: 'Hamster Paintball Park',
        topic: 'English Vocabulary & Grammar',
        classLevel: 'All Levels',
        questions: DEFAULT_TRIVIA,
        folderId: ''
      };
    }
    return {
      id: Date.now(),
      title: '',
      folderId: '',
      topic: '',
      classLevel: '',
      questions: [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
    };
  });

  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  useEffect(() => {
    const fetchFolders = async () => {
      if (!user) return;
      try {
        const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
        const foldersSnap = await getDocs(qFolders);
        const list: { id: string; name: string }[] = [];
        foldersSnap.forEach(d => list.push({ id: d.id, ...(d.data() as { name: string }) }));
        setFolders(list);
      } catch {}
    };
    fetchFolders();
  }, [user]);

  // -------------------------------------------------------------
  // 2. ROLE, LOBBY SETTINGS & PLAYER STATE
  // -------------------------------------------------------------
  // Teacher Jan is the non-playing Host by default unless joining via QR/room code
  const [role, setRole] = useState<'host' | 'player'>(
    initialSetup.current.isJoiningStudent ? 'player' : 'host'
  );
  const [screen, setScreen] = useState<'join' | 'lobby' | 'game' | 'results' | 'editor'>(() => {
    if (initialSetup.current.isJoiningStudent) return 'join';
    if (initialGame && !initialGame.editMode && hasLoadedQuestions) return 'lobby';
    return 'editor';
  });

  // Sync when initialGame prop updates (e.g., when launched from "Or Play This Set in Another Game Mode" or My Games)
  useEffect(() => {
    if (!initialGame) return;
    if (initialGame.roomCode && String(initialGame.roomCode).trim()) {
      const codeClean = String(initialGame.roomCode).trim().slice(0, 6);
      setRoomCode(codeClean);
      if (initialGame.playerName) {
        setPlayerName(String(initialGame.playerName).slice(0, 16));
      }
      setRole('player');
      setScreen('join');
      return;
    }
    const rawList =
      Array.isArray(initialGame.customQuestions) && initialGame.customQuestions.length > 0
        ? initialGame.customQuestions
        : Array.isArray(initialGame.questions) && initialGame.questions.length > 0
        ? initialGame.questions
        : [];
    const normalizedQs = normalizePaintballQuestions(rawList);

    setActiveQuiz({
      id: initialGame.id || Date.now(),
      title: initialGame.name || initialGame.title || initialGame.topic || 'Hamster Paintball',
      folderId: initialGame.folderId || '',
      topic: initialGame.topic || initialGame.name || '',
      classLevel: initialGame.className || initialGame.classLevel || '',
      questions:
        normalizedQs.length > 0
          ? normalizedQs
          : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
    });
    setTriviaDeckIndex(0);

    if (!initialGame.editMode && normalizedQs.length > 0) {
      setRole('host');
      setScreen('lobby');
    } else {
      setScreen('editor');
    }
  }, [initialGame]);

  const saveQuiz = async (
    updatedQuiz: Quiz,
    afterSaveDestination: 'lobby' | 'games' = 'lobby'
  ) => {
    setActiveQuiz(updatedQuiz);

    if (user) {
      try {
        const isPublicBool = Boolean(updatedQuiz.isPublic);
        const now = new Date().toISOString();

        const isOwnExistingGame = Boolean(
          initialGame?.id &&
            !String(initialGame.id).startsWith('sample-') &&
            !String(initialGame.id).startsWith('paintball-') &&
            (!initialGame.userId || initialGame.userId === user.uid)
        );

        const gameToSave = JSON.parse(
          JSON.stringify({
            name: updatedQuiz.title || updatedQuiz.topic || 'Hamster Paintball Game',
            title: updatedQuiz.title || updatedQuiz.topic || 'Hamster Paintball Game',
            folderId: updatedQuiz.folderId || '',
            topic: updatedQuiz.topic || '',
            className: updatedQuiz.classLevel || '',
            gameType: 'hamster-paintball',
            customQuestions: updatedQuiz.questions,
            userId: user.uid,
            creatorName: user.displayName || user.email?.split('@')[0] || 'Teacher',
            creatorEmail: user.email || '',
            updatedAt: now,
            publishedAt: isPublicBool ? now : initialGame?.publishedAt || null,
            createdAt: isOwnExistingGame && initialGame?.createdAt ? initialGame.createdAt : now,
            isPublic: isPublicBool
          })
        );

        if (isOwnExistingGame) {
          try {
            await updateDoc(doc(db, 'mysteryBoxGames', String(initialGame.id)), gameToSave);
          } catch (err: any) {
            if (err?.code === 'not-found') {
              await addDoc(collection(db, 'mysteryBoxGames'), gameToSave);
            } else {
              throw err;
            }
          }
        } else {
          await addDoc(collection(db, 'mysteryBoxGames'), gameToSave);
        }
      } catch (e) {
        console.warn('Could not save paintball quiz to mysteryBoxGames:', e);
      }
    }

    if (afterSaveDestination === 'games') {
      onViewChange('games');
    } else {
      setRole('host');
      setScreen('lobby');
    }
  };

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
  const [musicEnabled, setMusicEnabled] = useState<boolean>(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false);

  // Teacher Configurable Match Settings (Synced via Firestore)
  const [matchMode, setMatchMode] = useState<'solo' | 'teams'>('teams');
  const [matchStatus, setMatchStatus] = useState<'lobby' | 'playing' | 'results'>('lobby');
  const [isLobbyMinimized, setIsLobbyMinimized] = useState<boolean>(false);
  const [configuredDurationSec, setConfiguredDurationSec] = useState<number>(180); // 3 mins default
  const [ballsPerQuestion, setBallsPerQuestion] = useState<number>(10); // 10 balls per question

  // Live Match Clock, Pause State & Events
  const [matchSeconds, setMatchSeconds] = useState<number>(180);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [liveEvents, setLiveEvents] = useState<LiveFeedEvent[]>([
    {
      id: 'init-1',
      text: '👑 Teacher Jan opened the Paintball Park Lobby! Scan QR or enter code to join!',
      color: '#a3e635',
      timestamp: Date.now()
    }
  ]);

  // Host Camera Target (when Host clicks Play, Host takes the view of the player: Focus 1 Player or Auto Shuffle)
  const [hostCameraMode, setHostCameraMode] = useState<'overview' | 'track_one' | 'auto_track'>('auto_track');
  const [hostFollowIndex, setHostFollowIndex] = useState<number>(0);

  // Helper: Calculate Top Middle (Red Squad) or Bottom Middle (Blue Squad) Square Spawn Position
  const getTeamSpawnPosition = (team: TeamId, mode: 'solo' | 'teams', slotIndex?: number) => {
    const resolvedTeam: 'red' | 'blue' =
      mode === 'teams'
        ? team === 'blue'
          ? 'blue'
          : 'red'
        : Math.random() < 0.5
        ? 'red'
        : 'blue';
    // Top Middle Square Spawn Center (Red): (0, -26), Bottom Middle Square Spawn Center (Blue): (0, 26)
    const baseX = 0;
    const baseZ = resolvedTeam === 'red' ? -26 : 26;
    let jitterX: number;
    let jitterZ: number;
    if (typeof slotIndex === 'number') {
      const col = slotIndex % 4;
      const row = Math.floor(slotIndex / 4) % 2;
      jitterX = (col - 1.5) * 3.0;
      jitterZ = (row - 0.5) * 2.2;
    } else {
      jitterX = Number(((Math.random() - 0.5) * 9.0).toFixed(2));
      jitterZ = Number(((Math.random() - 0.5) * 3.8).toFixed(2));
    }
    const rotY = resolvedTeam === 'red' ? 0 : Math.PI;
    return {
      x: Number((baseX + jitterX).toFixed(2)),
      z: Number((baseZ + jitterZ).toFixed(2)),
      rotY
    };
  };

  // Student Combat Vitals, 10-Second Respawn Immunity, Match Start Spawn Hold, Ammo, Collectible Cans & Upgraded Points System
  // Players start with 0 paintballs in match and MUST answer questions to earn paintball ammunition!
  const RESPAWN_IMMUNITY_MS = 10000; // 10 seconds immunity after respawn (cannot be hit!)
  const MATCH_START_SPAWN_HOLD_MS = 6000; // 6 seconds at match start where Red stays in Red Spawn & Blue stays in Blue Spawn!
  const [hp, setHp] = useState<number>(100);
  const [maxHp] = useState<number>(100);
  const [shield, setShield] = useState<number>(100);
  const [maxShield] = useState<number>(100);
  const [immuneUntil, setImmuneUntil] = useState<number>(0);
  const [immunitySecondsLeft, setImmunitySecondsLeft] = useState<number>(0);
  const [spawnHoldUntil, setSpawnHoldUntil] = useState<number>(0);
  const [spawnHoldSecondsLeft, setSpawnHoldSecondsLeft] = useState<number>(0);
  const lastStartedAtRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const [ammo, setAmmo] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [kos, setKos] = useState<number>(0);
  const [koStreak, setKoStreak] = useState<number>(0);
  const [hitsLanded, setHitsLanded] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [questionsAnswered, setQuestionsAnswered] = useState<number>(0);
  const [koBannerText, setKoBannerText] = useState<string | null>(null);
  const [pickupBannerText, setPickupBannerText] = useState<string | null>(null);
  const [scorePopups, setScorePopups] = useState<
    Array<{ id: string; points: number; label: string; color: string }>
  >([]);

  // Helper to award points with floating HUD popup & streak tracking
  const awardPoints = (points: number, label: string, color: string = '#facc15') => {
    if (points <= 0) return;
    setScore(s => s + points);
    const popupId = `pts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setScorePopups(prev => [...prev.slice(-4), { id: popupId, points, label, color }]);
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== popupId));
    }, 1850);
  };

  // Collectible Health Cans & Defence Cans (Players pick up cans around the arena and LONG-PRESS to use them!)
  const [healthCans, setHealthCans] = useState<number>(1);
  const [shieldCans, setShieldCans] = useState<number>(1);
  const [nearbyArenaCan, setNearbyArenaCan] = useState<{ id: string; type: 'health' | 'shield' } | null>(null);
  const [holdingCanType, setHoldingCanType] = useState<'health' | 'shield' | null>(null);
  const [canHoldProgress, setCanHoldProgress] = useState<number>(0); // 0 to 100
  const canHoldIntervalRef = useRef<number | null>(null);
  const holdingCanTypeRef = useRef<'health' | 'shield' | null>(null);

  // Connected Players in Room (Excluding Non-Playing Host Teacher Jan)
  const [roomPlayers, setRoomPlayers] = useState<PlayerNetworkState[]>([]);
  const seenNetworkEventsRef = useRef<Set<string>>(new Set());
  const hasJoinedRoomRef = useRef<boolean>(false);

  // Trivia Question State + 15-Second Per-Question Countdown Timer
  const QUESTION_TIME_LIMIT_SEC = 15;
  const [triviaStreak, setTriviaStreak] = useState<number>(0);
  const [triviaDeckIndex, setTriviaDeckIndex] = useState<number>(0);
  const [triviaFeedback, setTriviaFeedback] = useState<string | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [questionTimeLeft, setQuestionTimeLeft] = useState<number>(QUESTION_TIME_LIMIT_SEC);

  // Mobile Touch Virtual Joystick State & Look Sensitivity Settings
  const [joystickVec, setJoystickVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [lookSensitivity, setLookSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.0;
    const saved = parseFloat(localStorage.getItem('pb_look_sensitivity') || '1.0');
    return Number.isFinite(saved) ? Math.max(0.2, Math.min(2.5, saved)) : 1.0;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_look_sensitivity', String(lookSensitivity));
    }
  }, [lookSensitivity]);

  // Unique Client Session ID
  const clientIdRef = useRef<string>(`pb_${Math.random().toString(36).slice(2, 10)}`);

  // Live Scannable Join URL (strictly uses production domain www.hamsterenglish.online)
  const liveJoinUrl = `https://www.hamsterenglish.online/?game=hamster-paintball&room=${roomCode}`;

  const liveDisplayHost = 'www.hamsterenglish.online';

  // Effective questions list (normalized across all schemas; falls back to DEFAULT_TRIVIA if blank)
  const effectiveQuestions = React.useMemo(() => {
    const valid = normalizePaintballQuestions(activeQuiz.questions);
    return valid.length > 0 ? valid : DEFAULT_TRIVIA;
  }, [activeQuiz.questions]);

  // Enforce: Answer questions ONLY during the active game (`matchStatus === 'playing'`)
  useEffect(() => {
    if (matchStatus !== 'playing') {
      setIsQuestionModalOpen(false);
      setTriviaFeedback(null);
      setSelectedOptionIdx(null);
    }
  }, [matchStatus]);

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
    camYaw: number;
    camPitch: number;
    vx: number;
    vz: number;
    walkPhase: number;
    keys: Record<string, boolean>;
    joyX: number;
    joyZ: number;
    mouseDown: boolean;
    mouseScreenX: number;
    mouseScreenY: number;
    lastMouseX: number;
    lastMouseY: number;
    mouseInitialized: boolean;
    lookTouchId: number | null;
    lookTouchLastX: number;
    lookTouchLastY: number;
    lookTouchStartX: number;
    lookTouchStartY: number;
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
    teacherJanNpc?: THREE.Group;
    waterMesh?: THREE.Mesh;
    aimReticle?: THREE.Group;
    aimLaserLine?: THREE.Line;
    shootButtonHeld?: boolean;
    broadcastChannel?: BroadcastChannel;
  } | null>(null);

  useEffect(() => {
    sfx.enabled = soundEnabled;
    sfx.musicEnabled = musicEnabled;
    const shouldPlay =
      soundEnabled && musicEnabled && (screen === 'game' || screen === 'lobby');
    if (shouldPlay) {
      sfx.startMusic();
    } else {
      sfx.stopMusic();
    }
  }, [soundEnabled, musicEnabled, screen]);

  useEffect(() => {
    sfx.setFrenzyTempo(matchStatus === 'playing' && matchSeconds <= 30 && matchSeconds > 0);
  }, [matchStatus, matchSeconds]);

  // Unlock Web Audio Context & start background music on first user gesture
  useEffect(() => {
    const unlockAudio = () => {
      sfx.init();
    };
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      sfx.stopMusic();
    };
  }, []);

  // Keep latest state snapshot for network & physics loop
  const stateSnapRef = useRef({
    role,
    playerName,
    selectedSkinIdx,
    myTeam,
    hp,
    shield,
    immuneUntil,
    spawnHoldUntil,
    score,
    kos,
    koStreak,
    hitsLanded,
    bestStreak,
    questionsAnswered,
    ammo,
    healthCans,
    shieldCans,
    holdingCanType,
    screen,
    matchMode,
    matchStatus,
    matchSeconds,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex,
    roomPlayers,
    lookSensitivity
  });

  useEffect(() => {
    stateSnapRef.current = {
      role,
      playerName,
      selectedSkinIdx,
      myTeam,
      hp,
      shield,
      immuneUntil,
      spawnHoldUntil,
      score,
      kos,
      koStreak,
      hitsLanded,
      bestStreak,
      questionsAnswered,
      ammo,
      healthCans,
      shieldCans,
      holdingCanType,
      screen,
      matchMode,
      matchStatus,
      matchSeconds,
      ballsPerQuestion,
      hostCameraMode,
      hostFollowIndex,
      roomPlayers,
      lookSensitivity
    };
  }, [
    role,
    playerName,
    selectedSkinIdx,
    myTeam,
    hp,
    shield,
    immuneUntil,
    spawnHoldUntil,
    score,
    kos,
    koStreak,
    hitsLanded,
    bestStreak,
    questionsAnswered,
    ammo,
    healthCans,
    shieldCans,
    holdingCanType,
    screen,
    matchMode,
    matchStatus,
    matchSeconds,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex,
    roomPlayers,
    lookSensitivity
  ]);

  // 10-Second Respawn Immunity Countdown Ticker
  useEffect(() => {
    if (immuneUntil <= Date.now()) {
      setImmunitySecondsLeft(0);
      return;
    }
    const updateImmunity = () => {
      const remMs = immuneUntil - Date.now();
      if (remMs <= 0) {
        setImmunitySecondsLeft(0);
      } else {
        setImmunitySecondsLeft(Math.ceil(remMs / 1000));
      }
    };
    updateImmunity();
    const interval = setInterval(updateImmunity, 200);
    return () => clearInterval(interval);
  }, [immuneUntil]);

  // Match Start Spawn Hold Ticker (Red Team stays first in Red Spawn, Blue Team stays first in Blue Spawn!)
  useEffect(() => {
    if (spawnHoldUntil <= Date.now()) {
      setSpawnHoldSecondsLeft(0);
      return;
    }
    const updateHold = () => {
      const remMs = spawnHoldUntil - Date.now();
      if (remMs <= 0) {
        setSpawnHoldSecondsLeft(0);
      } else {
        setSpawnHoldSecondsLeft(Math.ceil(remMs / 1000));
      }
    };
    updateHold();
    const interval = setInterval(updateHold, 200);
    return () => clearInterval(interval);
  }, [spawnHoldUntil]);

  // Long-Press Handler to Use Health Can (+45 HP) or Defence Can (+50 Shield)
  const stopCanLongPress = () => {
    if (canHoldIntervalRef.current) {
      window.clearInterval(canHoldIntervalRef.current);
      canHoldIntervalRef.current = null;
    }
    holdingCanTypeRef.current = null;
    setHoldingCanType(null);
    setCanHoldProgress(0);
  };

  const startCanLongPress = (type: 'health' | 'shield') => {
    if (role !== 'player' || screen !== 'game') return;
    if (holdingCanTypeRef.current === type) return;

    const snap = stateSnapRef.current;
    const hasCanInBelt = type === 'health' ? snap.healthCans > 0 : snap.shieldCans > 0;
    const hasNearbyCan = nearbyArenaCan?.type === type;

    if (!hasCanInBelt && !hasNearbyCan) {
      sfx.playWrong();
      setPickupBannerText(
        type === 'health'
          ? '🧪 NO HEALTH CANS! COLLECT A GREEN CAN IN THE ARENA!'
          : '🛡️ NO DEFENCE CANS! COLLECT A BLUE CAN IN THE ARENA!'
      );
      setTimeout(() => setPickupBannerText(null), 1800);
      return;
    }

    stopCanLongPress();
    holdingCanTypeRef.current = type;
    setHoldingCanType(type);
    setCanHoldProgress(6);
    sfx.playCanHoldTick(0.05, type);

    const startTime = performance.now();
    const holdDurationMs = 1150; // 1.15s long press to drink/charge can
    let lastTickStep = 0;

    canHoldIntervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / holdDurationMs) * 100));
      setCanHoldProgress(pct);

      const step = Math.floor(pct / 18);
      if (step > lastTickStep && pct < 100) {
        lastTickStep = step;
        sfx.playCanHoldTick(pct / 100, type);
      }

      // Spawn rising 3D energy sparkles on the hamster while holding
      const g = gameRef.current;
      if (g) {
        const sparkColor = type === 'health' ? 0x4ade80 : 0x38bdf8;
        const pMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 8, 8),
          new THREE.MeshBasicMaterial({ color: sparkColor })
        );
        const ang = Math.random() * Math.PI * 2;
        pMesh.position.set(
          g.x + Math.cos(ang) * 0.85,
          0.5 + Math.random() * 1.1,
          g.z + Math.sin(ang) * 0.85
        );
        g.scene.add(pMesh);
        g.particles.push({
          mesh: pMesh,
          vx: Math.cos(ang) * 0.8,
          vy: 3.8 + Math.random() * 2.2,
          vz: Math.sin(ang) * 0.8,
          life: 0,
          maxLife: 0.35
        });
      }

      if (pct >= 100) {
        stopCanLongPress();
        sfx.playCanUseComplete(type);

        // Consume nearby arena can first if standing right on it, otherwise consume from belt
        const gNow = gameRef.current;
        let consumedArenaCan = false;
        if (gNow) {
          for (const pu of gNow.powerups) {
            if (pu.active && pu.type === type && Math.hypot(gNow.x - pu.x, gNow.z - pu.z) < 2.8) {
              pu.active = false;
              pu.mesh.visible = false;
              pu.respawnAt = performance.now() + 11000;
              consumedArenaCan = true;
              break;
            }
          }
          // Burst celebratory 3D healing/shield aura particles
          const burstColor = type === 'health' ? 0x22c55e : 0x06b6d4;
          spawnPaintSplatEffect(
            gNow.scene,
            gNow.splatDecals,
            gNow.particles,
            gNow.x,
            1.4,
            gNow.z,
            burstColor
          );
        }

        if (type === 'health') {
          if (!consumedArenaCan) {
            setHealthCans(c => Math.max(0, c - 1));
          }
          setHp(h => Math.min(100, h + 45));
          if (stateSnapRef.current.matchStatus === 'playing') {
            awardPoints(10, '🧪 HEALTH CAN BONUS', '#4ade80');
            setPickupBannerText('🧪 HEALTH CAN USED! +45 HP & +10 PTS!');
          } else {
            setPickupBannerText('🧪 HEALTH CAN USED! +45 HP RESTORED!');
          }
        } else {
          if (!consumedArenaCan) {
            setShieldCans(c => Math.max(0, c - 1));
          }
          setShield(s => Math.min(100, s + 50));
          if (stateSnapRef.current.matchStatus === 'playing') {
            awardPoints(10, '🛡️ DEFENCE CAN BONUS', '#38bdf8');
            setPickupBannerText('🛡️ DEFENCE CAN USED! +50 SHIELD & +10 PTS!');
          } else {
            setPickupBannerText('🛡️ DEFENCE CAN USED! +50 SHIELD CHARGED!');
          }
        }
        setTimeout(() => setPickupBannerText(null), 2200);
      }
    }, 45);
  };

  useEffect(() => {
    return () => {
      if (canHoldIntervalRef.current) {
        window.clearInterval(canHoldIntervalRef.current);
      }
    };
  }, []);

  // Auto-shuffle Host's player view every 4.5 seconds when in 'auto_track' mode
  useEffect(() => {
    if (role !== 'host' || screen !== 'game' || hostCameraMode !== 'auto_track') return;
    if (roomPlayers.length <= 1) return;
    const interval = setInterval(() => {
      setHostFollowIndex(prev => (prev + 1) % Math.max(1, roomPlayers.length));
    }, 4500);
    return () => clearInterval(interval);
  }, [role, screen, hostCameraMode, roomPlayers.length]);

  // Ensure students (`role === 'player'`) NEVER get stuck on the Host's `lobby` overlay
  useEffect(() => {
    if (role === 'player' && screen === 'lobby') {
      setScreen('game');
    }
  }, [role, screen]);

  // Match Countdown Timer (Only ticks down once Host clicks START GAME -> matchStatus === 'playing' and !isTimerPaused)
  useEffect(() => {
    if (screen !== 'game' || isTimerPaused) return;
    if (role === 'player' && matchStatus !== 'playing') return;
    const timer = setInterval(() => {
      setMatchSeconds(prev => {
        if (prev <= 1) {
          sfx.playKO();
          setMatchStatus('results');
          setScreen('results');
          return 0;
        }
        const nextSec = prev - 1;
        if (nextSec <= 10) {
          sfx.playTimerTick(true);
        } else if (nextSec === 30 || nextSec === 60) {
          sfx.playTimerTick(false);
        }
        return nextSec;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, role, matchStatus, isTimerPaused]);

  // 15-Second Per-Question Countdown Timer inside Question Modal
  useEffect(() => {
    if (!isQuestionModalOpen || matchStatus !== 'playing' || triviaFeedback !== null) {
      return;
    }
    setQuestionTimeLeft(QUESTION_TIME_LIMIT_SEC);
    const qInterval = setInterval(() => {
      setQuestionTimeLeft(prev => {
        if (prev <= 1) {
          sfx.playWrong();
          setTriviaStreak(0);
          setSelectedOptionIdx(-1);
          setTriviaFeedback('⏰ TIME UP! Moving to next question...');
          setTimeout(() => {
            setTriviaFeedback(null);
            setSelectedOptionIdx(null);
            setTriviaDeckIndex(i => i + 1);
          }, 950);
          return 0;
        }
        if (prev <= 5) {
          sfx.playTimerTick(false);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(qInterval);
  }, [isQuestionModalOpen, matchStatus, triviaDeckIndex, triviaFeedback]);

  // Helper to get cross-device public room doc & player collection refs
  // Uses `ttt_rooms/pb_room_${code}` + Server-Authoritative `/api/paintball/room/:code`
  const normalizeCode = (code: string) => code.trim().toUpperCase();
  const getRoomDocRef = (code: string) =>
    doc(db, 'ttt_rooms', `pb_room_${normalizeCode(code)}`);
  const getPlayersColRef = (code: string) =>
    collection(db, 'ttt_rooms', `pb_room_${normalizeCode(code)}`, 'actions');
  const getPlayerDocRef = (code: string, pId: string) =>
    doc(db, 'ttt_rooms', `pb_room_${normalizeCode(code)}`, 'actions', `player_${pId}`);

  const ackHostOverrideAtRef = useRef<number>(0);
  const lastNetActionRef = useRef<{
    lastShot?: PlayerNetworkState['lastShot'];
    lastHit?: PlayerNetworkState['lastHit'];
    lastKo?: PlayerNetworkState['lastKo'];
  }>({});

  const syncPaintballRoomApi = async (
    code: string,
    roomPatch: Record<string, any>,
    playersPatch?: Array<Record<string, any>>
  ) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    try {
      const res = await fetch(`/api/paintball/room/${encodeURIComponent(clean)}/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomPatch, players: playersPatch })
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  };

  const syncPaintballPlayerApi = async (
    code: string,
    playerPayload: Record<string, any>,
    options?: { isHostAction?: boolean; latestEvent?: LiveFeedEvent }
  ) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    try {
      const res = await fetch(`/api/paintball/room/${encodeURIComponent(clean)}/player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: playerPayload,
          isHostAction: Boolean(options?.isHostAction),
          ackHostOverrideAt: ackHostOverrideAtRef.current,
          latestEvent: options?.latestEvent
        })
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  };

  const deletePaintballPlayerApi = async (code: string, playerId: string) => {
    const clean = normalizeCode(code);
    if (!clean || !playerId) return;
    try {
      await fetch(
        `/api/paintball/room/${encodeURIComponent(clean)}/player/${encodeURIComponent(playerId)}`,
        { method: 'DELETE' }
      );
    } catch {}
  };

  // Helper: Trigger Student Match Start Sequence (Brings player into the game, places Red in Top-Middle Red Spawn & Blue in Bottom-Middle Blue Spawn, and locks spawn first!)
  const triggerStudentMatchStart = (
    durationSec: number,
    activeMode: 'solo' | 'teams',
    startedAtTs: number,
    isPaused: boolean = false,
    incomingBallsPerQuestion?: number
  ) => {
    lastStartedAtRef.current = startedAtTs;
    sfx.playKO();
    sfx.startMusic();
    if (typeof incomingBallsPerQuestion === 'number' && incomingBallsPerQuestion > 0) {
      setBallsPerQuestion(incomingBallsPerQuestion);
      stateSnapRef.current.ballsPerQuestion = incomingBallsPerQuestion;
    }

    const cleanName =
      stateSnapRef.current.playerName.trim() &&
      stateSnapRef.current.playerName.trim() !== 'Teacher Jan'
        ? stateSnapRef.current.playerName.trim()
        : `Hamster${Math.floor(10 + Math.random() * 89)}`;
    if (cleanName !== stateSnapRef.current.playerName) {
      setPlayerName(cleanName);
      stateSnapRef.current.playerName = cleanName;
    }

    hasJoinedRoomRef.current = true;
    setMatchStatus('playing');
    setIsTimerPaused(isPaused);
    setMatchSeconds(durationSec || 180);
    setHp(100);
    setShield(100);
    setAmmo(0);
    setScore(0);
    setKos(0);
    setKoStreak(0);
    setHitsLanded(0);
    setBestStreak(0);
    setIsQuestionModalOpen(false);

    // Place Red Team in Top-Middle Red Square Spawn (0, -26) and Blue Team in Bottom-Middle Blue Square Spawn (0, 26)
    const effectiveTeam: TeamId =
      activeMode === 'solo'
        ? 'solo'
        : stateSnapRef.current.myTeam === 'blue'
        ? 'blue'
        : 'red';
    const sp = getTeamSpawnPosition(effectiveTeam, activeMode);
    if (gameRef.current) {
      gameRef.current.x = sp.x;
      gameRef.current.z = sp.z;
      gameRef.current.rotY = sp.rotY;
      gameRef.current.camYaw = sp.rotY;
      gameRef.current.camPitch = 0.32;
      gameRef.current.vx = 0;
      gameRef.current.vz = 0;
      gameRef.current.localHamster.position.set(sp.x, 0, sp.z);
      gameRef.current.localHamster.rotation.y = sp.rotY;
    }

    // Hold Red in Red Spawn and Blue in Blue Spawn first when match starts!
    const holdUntil = Date.now() + MATCH_START_SPAWN_HOLD_MS;
    stateSnapRef.current.spawnHoldUntil = holdUntil;
    setSpawnHoldUntil(holdUntil);
    setSpawnHoldSecondsLeft(Math.ceil(MATCH_START_SPAWN_HOLD_MS / 1000));

    // Ensure student is inside the active 3D game screen immediately!
    setScreen('game');

    // Immediately broadcast student's spawn position to Server API, Firestore & BroadcastChannel so all players see each other in spawn!
    const startPayload: PlayerNetworkState = {
      id: clientIdRef.current,
      name: cleanName,
      role: 'player',
      team: effectiveTeam,
      skinIdx: stateSnapRef.current.selectedSkinIdx,
      x: sp.x,
      z: sp.z,
      rotY: sp.rotY,
      hp: 100,
      shield: 100,
      immuneUntil: 0,
      score: 0,
      kos: 0,
      hitsLanded: 0,
      bestStreak: 0,
      questionsAnswered: stateSnapRef.current.questionsAnswered,
      kicked: false,
      updatedAt: Date.now()
    };

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({
          type: 'player_update',
          id: clientIdRef.current,
          payload: startPayload
        });
      } catch {}
    }

    if (roomCode) {
      syncPaintballPlayerApi(roomCode, startPayload);
      setDoc(
        getPlayerDocRef(roomCode, clientIdRef.current),
        {
          ...startPayload,
          lastSeen: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {});
    }

    const teamLabel =
      effectiveTeam === 'blue' ? 'BOTTOM-MIDDLE BLUE SPAWN' : 'TOP-MIDDLE RED SPAWN';
    const activeRewardBalls =
      incomingBallsPerQuestion || stateSnapRef.current.ballsPerQuestion || ballsPerQuestion || 10;
    setPickupBannerText(
      `🚀 GAME STARTED! STAY FIRST IN ${teamLabel} & ANSWER QUESTIONS TO GAIN +${activeRewardBalls} BALLS!`
    );
    setTimeout(() => setPickupBannerText(null), 4000);
  };

  // -------------------------------------------------------------
  // 4. REAL-TIME MULTIPLAYER SYNC (SERVER API + FIRESTORE + BROADCAST CHANNEL)
  // -------------------------------------------------------------
  useEffect(() => {
    const cleanCode = normalizeCode(roomCode);
    if (!cleanCode) return;

    const roomDocRef = getRoomDocRef(cleanCode);

    // Unified Room State Processor (used by both Server API & Firestore)
    const processRoomData = (data: Record<string, any> | undefined | null) => {
      if (!data) return;
      if (stateSnapRef.current.role === 'player') {
        if (Array.isArray(data?.questions) && data.questions.length > 0) {
          const normRoomQs = normalizePaintballQuestions(data.questions);
          if (normRoomQs.length > 0) {
            setActiveQuiz(prev => ({
              ...prev,
              title: data.quizTitle || prev.title || 'Hamster Paintball',
              topic: data.topic || prev.topic || '',
              classLevel: data.classLevel || prev.classLevel || '',
              questions: normRoomQs
            }));
          }
        }
        if (data?.matchMode) setMatchMode(data.matchMode);
        if (typeof data?.ballsPerQuestion === 'number' && data.ballsPerQuestion > 0) {
          setBallsPerQuestion(data.ballsPerQuestion);
          stateSnapRef.current.ballsPerQuestion = data.ballsPerQuestion;
        }
        if (
          typeof data?.configuredDurationSec === 'number' &&
          stateSnapRef.current.matchStatus === 'lobby'
        ) {
          setConfiguredDurationSec(data.configuredDurationSec);
          setMatchSeconds(data.configuredDurationSec);
        }
        if (typeof data?.isTimerPaused === 'boolean') {
          setIsTimerPaused(data.isTimerPaused);
        }
        if (typeof data?.timerSyncSeconds === 'number' && data?.timerSyncedAt) {
          const elapsed = Math.max(0, Math.floor((Date.now() - data.timerSyncedAt) / 1000));
          const nextSec = data.isTimerPaused
            ? data.timerSyncSeconds
            : Math.max(0, data.timerSyncSeconds - elapsed);
          setMatchSeconds(nextSec);
        }
        if (data?.matchStatus === 'playing') {
          const incomingStartTs =
            typeof data.startedAt === 'number' && data.startedAt > 1000
              ? data.startedAt
              : lastStartedAtRef.current || 1;
          const isNewMatchStart =
            stateSnapRef.current.matchStatus !== 'playing' ||
            (typeof data.startedAt === 'number' &&
              data.startedAt > 1000 &&
              data.startedAt > lastStartedAtRef.current);
          if (isNewMatchStart) {
            triggerStudentMatchStart(
              data.configuredDurationSec || 180,
              data.matchMode || stateSnapRef.current.matchMode,
              incomingStartTs,
              Boolean(data.isTimerPaused),
              typeof data.ballsPerQuestion === 'number' ? data.ballsPerQuestion : undefined
            );
          } else if (stateSnapRef.current.screen !== 'game') {
            setScreen('game');
          }
        } else if (data?.matchStatus === 'results' && stateSnapRef.current.screen === 'game') {
          setMatchStatus('results');
          setScreen('results');
        } else if (data?.matchStatus === 'lobby') {
          setMatchStatus('lobby');
          if (stateSnapRef.current.screen === 'results') {
            setScreen('game');
          }
        }
      }
      if (data?.latestEvent && data.latestEvent.id) {
        setLiveEvents(prev => {
          if (prev.some(e => e.id === data.latestEvent.id)) return prev;
          return [data.latestEvent, ...prev].slice(0, 12);
        });
      }
    };

    // Unified Players Roster Processor (used by both Server API & Firestore)
    const processPlayersList = (rawList: Array<Record<string, any>>) => {
      const now = Date.now();
      const activePlayers: PlayerNetworkState[] = [];
      const seenIds = new Set<string>();

      rawList.forEach(data => {
        if (!data) return;
        const playerId = String(data.id || '').replace(/^player_/, '');
        if (!playerId) return;

        // Check if Host kicked/deleted this local player
        if (playerId === clientIdRef.current && data.kicked) {
          hasJoinedRoomRef.current = false;
          deletePaintballPlayerApi(cleanCode, clientIdRef.current);
          deleteDoc(getPlayerDocRef(cleanCode, clientIdRef.current)).catch(() => {});
          setScreen('join');
          return;
        }

        if (data.role === 'player' && !data.kicked) {
          const defaultZ = data.team === 'blue' ? 26 : -26;
          const pState: PlayerNetworkState = {
            id: playerId,
            name: data.name || 'Student',
            role: 'player',
            team: data.team || 'red',
            skinIdx: typeof data.skinIdx === 'number' ? data.skinIdx : 0,
            x: typeof data.x === 'number' ? data.x : 0,
            z: typeof data.z === 'number' ? data.z : defaultZ,
            rotY: typeof data.rotY === 'number' ? data.rotY : data.team === 'blue' ? Math.PI : 0,
            hp: typeof data.hp === 'number' ? data.hp : 100,
            shield: typeof data.shield === 'number' ? data.shield : 100,
            score: typeof data.score === 'number' ? data.score : 0,
            kos: typeof data.kos === 'number' ? data.kos : 0,
            hitsLanded: typeof data.hitsLanded === 'number' ? data.hitsLanded : 0,
            bestStreak: typeof data.bestStreak === 'number' ? data.bestStreak : 0,
            immuneUntil: typeof data.immuneUntil === 'number' ? data.immuneUntil : 0,
            questionsAnswered:
              typeof data.questionsAnswered === 'number' ? data.questionsAnswered : 0,
            updatedAt: data.updatedAt || now
          };
          activePlayers.push(pState);
          seenIds.add(playerId);

          // If this is my own player document:
          // 1) Check if Host just clicked START GAME (`matchStartResetAt`) so we immediately spawn in our Team Spawn Area
          // 2) Check if Host explicitly switched our team (`hostOverrideAt`)
          if (playerId === clientIdRef.current) {
            if (
              typeof data.matchStartResetAt === 'number' &&
              data.matchStartResetAt > 1000 &&
              data.matchStartResetAt > lastStartedAtRef.current
            ) {
              if (data.team === 'red' || data.team === 'blue') {
                setMyTeam(data.team);
                stateSnapRef.current.myTeam = data.team;
              }
              triggerStudentMatchStart(
                configuredDurationSec || 180,
                stateSnapRef.current.matchMode,
                data.matchStartResetAt,
                false,
                stateSnapRef.current.ballsPerQuestion
              );
            }

            const isNewHostTeamOverride =
              typeof data.hostOverrideAt === 'number' &&
              data.hostOverrideAt > ackHostOverrideAtRef.current;
            if (isNewHostTeamOverride) {
              ackHostOverrideAtRef.current = data.hostOverrideAt;
              if (
                (data.team === 'red' || data.team === 'blue') &&
                data.team !== stateSnapRef.current.myTeam
              ) {
                setMyTeam(data.team);
                stateSnapRef.current.myTeam = data.team;
                if (gameRef.current) {
                  const sp = getTeamSpawnPosition(data.team, stateSnapRef.current.matchMode);
                  gameRef.current.x = sp.x;
                  gameRef.current.z = sp.z;
                  gameRef.current.rotY = sp.rotY;
                  gameRef.current.camYaw = sp.rotY;
                  gameRef.current.camPitch = 0.28;
                }
                setPickupBannerText(
                  `👑 HOST MOVED YOU TO ${TEAM_CONFIG[data.team as TeamId]?.label.toUpperCase() || String(data.team).toUpperCase()} SPAWN!`
                );
                setTimeout(() => setPickupBannerText(null), 2400);
              }
            }
          }

          if (playerId !== clientIdRef.current) {
            upsertRemotePlayer(pState);

            // Process cross-device network shots
            if (
              data.lastShot?.shotId &&
              !seenNetworkEventsRef.current.has(data.lastShot.shotId)
            ) {
              seenNetworkEventsRef.current.add(data.lastShot.shotId);
              spawnNetworkProjectile(
                playerId,
                pState.name,
                pState.team,
                data.lastShot.x,
                data.lastShot.z,
                data.lastShot.angle,
                data.lastShot.paintColor
              );
            }

            // Process cross-device hits targeting this local student player
            if (
              data.lastHit?.hitId &&
              data.lastHit.targetId === clientIdRef.current &&
              !seenNetworkEventsRef.current.has(data.lastHit.hitId) &&
              stateSnapRef.current.role === 'player'
            ) {
              seenNetworkEventsRef.current.add(data.lastHit.hitId);
              applyIncomingDamage(
                data.lastHit.damage,
                data.lastHit.attackerName,
                data.lastHit.attackerId
              );
            }

            // Process cross-device KO rewards for this local student player
            if (
              data.lastKo?.koId &&
              data.lastKo.attackerId === clientIdRef.current &&
              !seenNetworkEventsRef.current.has(data.lastKo.koId)
            ) {
              seenNetworkEventsRef.current.add(data.lastKo.koId);
              const nextKoStreak = stateSnapRef.current.koStreak + 1;
              const isFrenzy = stateSnapRef.current.matchSeconds <= 30;
              const baseKoPts = isFrenzy ? 90 : 60;
              const streakBonusPts = nextKoStreak >= 3 ? 50 : nextKoStreak === 2 ? 25 : 0;
              const totalKoPts = baseKoPts + streakBonusPts;
              setKos(k => k + 1);
              setKoStreak(nextKoStreak);
              setBestStreak(b => Math.max(b, nextKoStreak));
              awardPoints(
                totalKoPts,
                nextKoStreak >= 2
                  ? `💥 ${nextKoStreak}x MULTI-SPLAT!`
                  : isFrenzy
                  ? '🔥 FRENZY SPLAT!'
                  : '💥 SPLAT KO!',
                '#f43f5e'
              );
              setKoBannerText(
                `SPLATTERED ${(data.lastKo.victimName || 'OPPONENT').toUpperCase()}! (+${totalKoPts} PTS${
                  nextKoStreak >= 2 ? ` • ${nextKoStreak}x STREAK!` : ''
                })`
              );
              sfx.playKO();
              setTimeout(() => setKoBannerText(null), 2600);
            }
          }
        }
      });

      // Clean up disconnected or deleted 3D meshes
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
    };

    // If Host (Teacher Jan), publish room configuration & custom quiz questions to Server API + Firestore
    if (role === 'host') {
      const hostStatus =
        screen === 'game' ? 'playing' : screen === 'results' ? 'results' : 'lobby';
      const roomConfigPayload = {
        roomCode: cleanCode,
        website: 'www.hamsterenglish.online',
        joinUrl: `https://www.hamsterenglish.online/?game=hamster-paintball&room=${cleanCode}`,
        hostName: 'Teacher Jan',
        quizTitle: activeQuiz.title || activeQuiz.topic || 'Hamster Paintball',
        topic: activeQuiz.topic || '',
        classLevel: activeQuiz.classLevel || '',
        questions: effectiveQuestions,
        matchMode,
        matchStatus: hostStatus,
        configuredDurationSec,
        ballsPerQuestion,
        ...(hostStatus === 'playing' && lastStartedAtRef.current > 1000
          ? { startedAt: lastStartedAtRef.current }
          : {}),
        updatedAt: Date.now()
      };
      syncPaintballRoomApi(cleanCode, roomConfigPayload).then(resData => {
        if (resData?.players) processPlayersList(resData.players);
      });
      setDoc(roomDocRef, roomConfigPayload, { merge: true }).catch(() => {});
    }

    // Listen to room settings via Firestore (when quota available)
    const unsubRoom = onSnapshot(
      roomDocRef,
      snap => {
        if (!snap.exists()) return;
        processRoomData(snap.data());
      },
      () => {}
    );

    // BroadcastChannel for instant local cross-tab multiplayer
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(`hamster_paintball_net_${cleanCode}`);
      broadcastChannelRef.current = bc;
      if (gameRef.current) {
        gameRef.current.broadcastChannel = bc;
      }
      bc.onmessage = ev => {
        const msg = ev.data;
        if (!msg || msg.id === clientIdRef.current) return;
        if (msg.type === 'player_update') {
          const pState = msg.payload as PlayerNetworkState;
          if (pState.role === 'player' && !pState.kicked) {
            upsertRemotePlayer(pState);
            setRoomPlayers(prev => {
              const idx = prev.findIndex(p => p.id === pState.id);
              if (idx === -1) return [...prev, pState];
              const copy = [...prev];
              copy[idx] = { ...copy[idx], ...pState };
              return copy;
            });
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
            const nextKoStreak = stateSnapRef.current.koStreak + 1;
            const isFrenzy = stateSnapRef.current.matchSeconds <= 30;
            const baseKoPts = isFrenzy ? 90 : 60;
            const streakBonusPts = nextKoStreak >= 3 ? 50 : nextKoStreak === 2 ? 25 : 0;
            const totalKoPts = baseKoPts + streakBonusPts;
            setKos(k => k + 1);
            setKoStreak(nextKoStreak);
            setBestStreak(b => Math.max(b, nextKoStreak));
            awardPoints(
              totalKoPts,
              nextKoStreak >= 2
                ? `💥 ${nextKoStreak}x MULTI-SPLAT!`
                : isFrenzy
                ? '🔥 FRENZY SPLAT!'
                : '💥 SPLAT KO!',
              '#f43f5e'
            );
            setKoBannerText(
              `SPLATTERED ${msg.victimName.toUpperCase()}! (+${totalKoPts} PTS${
                nextKoStreak >= 2 ? ` • ${nextKoStreak}x STREAK!` : ''
              })`
            );
            sfx.playKO();
            setTimeout(() => setKoBannerText(null), 2600);
          }
        } else if (msg.type === 'kick_player') {
          if (msg.targetId === clientIdRef.current && stateSnapRef.current.role === 'player') {
            hasJoinedRoomRef.current = false;
            setScreen('join');
          }
        } else if (msg.type === 'live_event' && msg.event) {
          setLiveEvents(prev => {
            if (prev.some(e => e.id === msg.event.id)) return prev;
            return [msg.event, ...prev].slice(0, 12);
          });
        } else if (msg.type === 'timer_control') {
          if (typeof msg.matchSeconds === 'number') {
            setMatchSeconds(msg.matchSeconds);
          }
          if (typeof msg.isTimerPaused === 'boolean') {
            setIsTimerPaused(msg.isTimerPaused);
          }
        } else if (msg.type === 'balls_config') {
          if (typeof msg.ballsPerQuestion === 'number' && msg.ballsPerQuestion > 0) {
            setBallsPerQuestion(msg.ballsPerQuestion);
            stateSnapRef.current.ballsPerQuestion = msg.ballsPerQuestion;
          }
        } else if (msg.type === 'match_start' && stateSnapRef.current.role === 'player') {
          if (typeof msg.ballsPerQuestion === 'number' && msg.ballsPerQuestion > 0) {
            setBallsPerQuestion(msg.ballsPerQuestion);
            stateSnapRef.current.ballsPerQuestion = msg.ballsPerQuestion;
          }
          if (Array.isArray(msg.questions) && msg.questions.length > 0) {
            const normQs = normalizePaintballQuestions(msg.questions);
            if (normQs.length > 0) {
              setActiveQuiz(prev => ({
                ...prev,
                title: msg.quizTitle || prev.title,
                topic: msg.topic || prev.topic,
                classLevel: msg.classLevel || prev.classLevel,
                questions: normQs
              }));
            }
          }
          const incomingStartTs =
            typeof msg.startedAt === 'number' ? msg.startedAt : Date.now();
          if (incomingStartTs !== lastStartedAtRef.current) {
            triggerStudentMatchStart(
              msg.durationSec || 180,
              msg.matchMode || stateSnapRef.current.matchMode,
              incomingStartTs,
              false,
              typeof msg.ballsPerQuestion === 'number' ? msg.ballsPerQuestion : undefined
            );
          }
        } else if (msg.type === 'match_end' && stateSnapRef.current.role === 'player') {
          setMatchStatus('results');
          setScreen('results');
        }
      };
    } catch {}

    // Listen to all joined players in Firestore `ttt_rooms/pb_room_${cleanCode}/actions`
    const playersCol = getPlayersColRef(cleanCode);
    const unsubPlayers = onSnapshot(
      playersCol,
      snap => {
        const list = snap.docs.map(d => ({
          ...(d.data() as Record<string, any>),
          id: (d.data() as any).id || d.id.replace(/^player_/, '')
        }));
        if (list.length > 0) {
          processPlayersList(list);
        }
      },
      () => {}
    );

    // Real-Time Server Polling & Heartbeat Sync (300ms interval — works 100% reliably across all devices!)
    const syncInterval = setInterval(async () => {
      const g = gameRef.current;
      const snapState = stateSnapRef.current;

      if (snapState.role === 'host') {
        try {
          const res = await fetch(`/api/paintball/room/${encodeURIComponent(cleanCode)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.room) processRoomData(data.room);
            if (Array.isArray(data?.players)) processPlayersList(data.players);
          }
        } catch {}
        return;
      }

      // If Student is still on the Join character selection screen, poll room state so questions/mode are ready
      if (snapState.screen === 'join') {
        try {
          const res = await fetch(`/api/paintball/room/${encodeURIComponent(cleanCode)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.room) processRoomData(data.room);
          }
        } catch {}
        return;
      }

      hasJoinedRoomRef.current = true;
      const defaultZ = snapState.myTeam === 'blue' ? 26 : -26;
      const payload: PlayerNetworkState = {
        id: clientIdRef.current,
        name: snapState.playerName || 'Student',
        role: 'player',
        team: snapState.matchMode === 'solo' ? 'solo' : snapState.myTeam,
        skinIdx: snapState.selectedSkinIdx,
        x: g ? Number(g.x.toFixed(2)) : 0,
        z: g ? Number(g.z.toFixed(2)) : defaultZ,
        rotY: g ? Number(g.rotY.toFixed(2)) : snapState.myTeam === 'blue' ? Math.PI : 0,
        hp: snapState.hp,
        shield: snapState.shield,
        immuneUntil: snapState.immuneUntil,
        score: snapState.score,
        kos: snapState.kos,
        hitsLanded: snapState.hitsLanded,
        bestStreak: snapState.bestStreak,
        questionsAnswered: snapState.questionsAnswered,
        lastShot: lastNetActionRef.current.lastShot,
        lastHit: lastNetActionRef.current.lastHit,
        lastKo: lastNetActionRef.current.lastKo,
        updatedAt: Date.now()
      };

      if (bc) {
        try {
          bc.postMessage({ type: 'player_update', id: clientIdRef.current, payload });
        } catch {}
      }

      const apiRes = await syncPaintballPlayerApi(cleanCode, payload);
      if (apiRes) {
        if (apiRes.room) processRoomData(apiRes.room);
        if (Array.isArray(apiRes.players)) processPlayersList(apiRes.players);
      }

      const playerRef = getPlayerDocRef(cleanCode, clientIdRef.current);
      setDoc(
        playerRef,
        {
          ...payload,
          lastSeen: serverTimestamp()
        },
        { merge: true }
      ).catch(() => {});
    }, 300);

    return () => {
      unsubRoom();
      unsubPlayers();
      clearInterval(syncInterval);
      if (bc) bc.close();
      if (broadcastChannelRef.current === bc) {
        broadcastChannelRef.current = null;
      }
    };
  }, [
    roomCode,
    role,
    screen,
    activeQuiz.title,
    activeQuiz.topic,
    activeQuiz.classLevel,
    effectiveQuestions,
    matchMode,
    configuredDurationSec,
    ballsPerQuestion
  ]);

  // Apply incoming paintball damage to local student player (Respects 10-Second Respawn Immunity!)
  const applyIncomingDamage = (damage: number, attackerName: string, attackerId: string) => {
    // 10-SECOND RESPAWN IMMUNITY: Player CANNOT be hit within 10 seconds after respawning!
    if (Date.now() < stateSnapRef.current.immuneUntil) {
      return;
    }

    sfx.playSplat();
    setShield(prevShield => {
      if (prevShield >= damage) {
        return prevShield - damage;
      }
      const rem = damage - prevShield;
      setHp(prevHp => {
        const nextHp = prevHp - rem;
        if (nextHp <= 0) {
          // Eliminated! Grant 10-Second Respawn Immunity & Respawn inside player's Team Square Spawn!
          const newImmuneUntil = Date.now() + RESPAWN_IMMUNITY_MS;
          stateSnapRef.current.immuneUntil = newImmuneUntil;
          setImmuneUntil(newImmuneUntil);
          setImmunitySecondsLeft(10);
          setKoStreak(0);
          const sp = getTeamSpawnPosition(
            stateSnapRef.current.myTeam,
            stateSnapRef.current.matchMode
          );
          if (gameRef.current) {
            gameRef.current.x = sp.x;
            gameRef.current.z = sp.z;
            gameRef.current.rotY = sp.rotY;
            gameRef.current.camYaw = sp.rotY;
            gameRef.current.camPitch = 0.32;
          }
          setShield(100);
          const spawnSide =
            stateSnapRef.current.matchMode === 'teams'
              ? stateSnapRef.current.myTeam === 'blue'
                ? 'BOTTOM-MIDDLE BLUE SPAWN'
                : 'TOP-MIDDLE RED SPAWN'
              : 'SQUARE SPAWN';
          setKoBannerText(
            `SPLATTERED BY ${attackerName.toUpperCase()}! RESPAWNED AT ${spawnSide} (10s IMMUNITY)!`
          );
          setTimeout(() => setKoBannerText(null), 2800);

          const koId = `ko-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const koObj = {
            koId,
            attackerId,
            victimName: stateSnapRef.current.playerName
          };
          lastNetActionRef.current.lastKo = koObj;

          // Notify attacker of KO via BroadcastChannel, Server API & Firestore
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
          const evText = `💥 ${attackerName} splattered ${stateSnapRef.current.playerName} (+60 PTS)!`;
          const koEvent: LiveFeedEvent = {
            id: koId,
            text: evText,
            color: '#f43f5e',
            timestamp: Date.now()
          };
          pushLiveEvent(evText, '#f43f5e');

          if (roomCode) {
            syncPaintballPlayerApi(
              roomCode,
              {
                id: clientIdRef.current,
                x: sp.x,
                z: sp.z,
                rotY: sp.rotY,
                hp: 100,
                shield: 100,
                immuneUntil: newImmuneUntil,
                lastKo: koObj
              },
              { latestEvent: koEvent }
            );
            setDoc(
              getPlayerDocRef(roomCode, clientIdRef.current),
              {
                x: sp.x,
                z: sp.z,
                rotY: sp.rotY,
                hp: 100,
                shield: 100,
                immuneUntil: newImmuneUntil,
                lastKo: koObj
              },
              { merge: true }
            ).catch(() => {});
            setDoc(
              getRoomDocRef(roomCode),
              { latestEvent: koEvent },
              { merge: true }
            ).catch(() => {});
          }

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
      // Ignore stale out-of-order network packets so remote players never jump backward
      if (
        entry.data.updatedAt &&
        rState.updatedAt &&
        rState.updatedAt < entry.data.updatedAt &&
        Math.hypot(rState.x - entry.mesh.position.x, rState.z - entry.mesh.position.z) < 15
      ) {
        return;
      }
      // Rebuild 3D hamster (including Red/Blue Team Headband, gun & name badge) if team, name, or skin changed
      if (
        entry.data.team !== rState.team ||
        entry.data.name !== rState.name ||
        entry.data.skinIdx !== rState.skinIdx
      ) {
        g.scene.remove(entry.mesh);
        const mesh = buildHighDefHamster(rState.skinIdx, label, false, rState.team);
        mesh.position.set(rState.x, 0, rState.z);
        mesh.rotation.y = rState.rotY;
        g.scene.add(mesh);
        entry.mesh = mesh;
      } else if (
        Math.hypot(rState.x - entry.mesh.position.x, rState.z - entry.mesh.position.z) > 14
      ) {
        // Snap immediately when player teleports to Red/Blue Square Spawn at match start or respawn!
        entry.mesh.position.set(rState.x, 0, rState.z);
        entry.mesh.rotation.y = rState.rotY;
      }
      entry.data = rState;
    }
  };

  // Resolve Strict Team Paint Color: Red Team ALWAYS fires Red Paint (0xef4444), Blue Team ALWAYS fires Blue Paint (0x2563eb)
  const resolveTeamPaintColor = (
    team: TeamId | undefined,
    fallbackColor?: number,
    skinIdx: number = 0
  ): number => {
    if (team === 'red') return 0xef4444;
    if (team === 'blue') return 0x2563eb;
    if (team && team !== 'solo' && TEAM_CONFIG[team]) return TEAM_CONFIG[team].colorNum;
    if (typeof fallbackColor === 'number' && fallbackColor > 0) return fallbackColor;
    const skin = HAMSTER_SKINS[skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
    return skin.paintColor;
  };

  // Build a High-Visibility 3D Paintball Projectile with Aerodynamic Streak Tail
  const createPaintballProjectileMesh = (paintColor: number): THREE.Group => {
    const projGroup = new THREE.Group();

    const coreBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.29, 16, 16),
      new THREE.MeshPhysicalMaterial({
        color: paintColor,
        emissive: paintColor,
        emissiveIntensity: 0.48,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        roughness: 0.06,
        metalness: 0.1
      })
    );
    coreBall.castShadow = true;
    projGroup.add(coreBall);

    // Bright Team-Colored Outer Energy Halo around the Paintball
    const glowShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 12, 12),
      new THREE.MeshBasicMaterial({
        color: paintColor,
        transparent: true,
        opacity: 0.38
      })
    );
    projGroup.add(glowShell);

    // Aerodynamic Paint Streak Tail Behind the Ball
    const streakTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 1.35, 12),
      new THREE.MeshBasicMaterial({
        color: paintColor,
        transparent: true,
        opacity: 0.78
      })
    );
    streakTail.rotation.x = -Math.PI / 2;
    streakTail.position.z = -0.7;
    projGroup.add(streakTail);

    return projGroup;
  };

  // Spawn 3D Muzzle CO2 Gas & Paint Mist Burst at the Exact Gun Barrel Nozzle
  const spawnGunMuzzleBlastEffect = (
    scene: THREE.Scene,
    particles: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      life: number;
      maxLife: number;
    }>,
    muzzlePos: THREE.Vector3,
    shotAngle: number,
    paintColor: number
  ) => {
    const gasMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.9
    });
    const paintMistMat = new THREE.MeshBasicMaterial({
      color: paintColor,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < 7; i++) {
      const isPaintDrop = i % 2 === 0;
      const pMesh = new THREE.Mesh(
        new THREE.SphereGeometry(isPaintDrop ? 0.095 : 0.12, 8, 8),
        isPaintDrop ? paintMistMat : gasMat
      );
      pMesh.position.copy(muzzlePos);
      scene.add(pMesh);

      const spread = (Math.random() - 0.5) * 0.38;
      const speed = 10 + Math.random() * 14;
      particles.push({
        mesh: pMesh,
        vx: Math.sin(shotAngle + spread) * speed,
        vy: 1.2 + (Math.random() - 0.3) * 3.5,
        vz: Math.cos(shotAngle + spread) * speed,
        life: 0,
        maxLife: 0.16 + Math.random() * 0.1
      });
    }
  };

  // Spawn Network Paintball Shot Directly from the Remote Shooter's 3D Gun Barrel Muzzle!
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

    const muzzlePos = new THREE.Vector3(
      startX + Math.sin(angle) * 1.65,
      1.32,
      startZ + Math.cos(angle) * 1.65
    );

    // Extract exact 3D world position of the remote shooter's gun barrel tip (`muzzleTip`)
    const shooterEntry = g.remotePlayers.get(ownerId);
    const effectiveTeam: TeamId =
      ownerTeam && ownerTeam !== 'solo'
        ? ownerTeam
        : shooterEntry?.data?.team || 'solo';

    // Enforce: Red Team fires Red Paint (0xef4444) and Blue Team fires Blue Paint (0x2563eb)!
    const resolvedPaintColor = resolveTeamPaintColor(
      effectiveTeam,
      paintColor,
      shooterEntry?.data?.skinIdx || 0
    );

    if (shooterEntry && shooterEntry.mesh) {
      shooterEntry.mesh.rotation.y = angle;
      const ud = shooterEntry.mesh.userData;
      if (ud) {
        if (ud.markerGroup) {
          ud.markerGroup.position.z = 0.55;
          ud.markerGroup.rotation.x = 0;
        }
        shooterEntry.mesh.updateMatrixWorld(true);
        if (ud.muzzleTip) {
          ud.muzzleTip.getWorldPosition(muzzlePos);
        }
        ud.recoil = 1.0;
      }
    }

    const ball = createPaintballProjectileMesh(resolvedPaintColor);
    ball.position.copy(muzzlePos);
    ball.rotation.y = angle;
    g.scene.add(ball);

    spawnGunMuzzleBlastEffect(g.scene, g.particles, muzzlePos, angle, resolvedPaintColor);

    g.projectiles.push({
      ownerId,
      ownerName,
      ownerTeam: effectiveTeam,
      mesh: ball,
      vx: Math.sin(angle) * 40,
      vy: 1.65,
      vz: Math.cos(angle) * 40,
      gravity: 9.2,
      damage: 28,
      color: resolvedPaintColor
    });
  };

  // =============================================================
  // 5. HIGH-DEFINITION 3D HAMSTER & POWER-UP CRATE BUILDERS
  // =============================================================
  const furTextureCacheRef = useRef<Map<string, THREE.CanvasTexture>>(new Map());
  const maskGrillTexRef = useRef<THREE.CanvasTexture | null>(null);

  function createFurTexture(baseHex: string): THREE.CanvasTexture {
    const cached = furTextureCacheRef.current.get(baseHex);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 650; i++) {
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
    furTextureCacheRef.current.set(baseHex, tex);
    return tex;
  }

  function createMaskGrillTexture(): THREE.CanvasTexture {
    if (maskGrillTexRef.current) return maskGrillTexRef.current;
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
    maskGrillTexRef.current = tex;
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

    const isRed = !isHostReferee && team === 'red';
    const isBlue = !isHostReferee && team === 'blue';

    const borderHex = isHostReferee
      ? '#facc15'
      : isRed
      ? '#ef4444'
      : isBlue
      ? '#3b82f6'
      : team !== 'solo'
      ? TEAM_CONFIG[team].colorHex
      : skin.paintHex;

    const bgHex = isHostReferee
      ? 'rgba(15, 23, 42, 0.92)'
      : isRed
      ? 'rgba(127, 29, 29, 0.92)'
      : isBlue
      ? 'rgba(30, 58, 138, 0.92)'
      : 'rgba(15, 23, 42, 0.88)';

    ctx.fillStyle = bgHex;
    ctx.beginPath();
    ctx.roundRect(18, 18, 476, 92, 46);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = borderHex;
    ctx.stroke();

    // Left Team Pill Tag (RED or BLUE) for instant team identification
    if (isRed || isBlue) {
      ctx.fillStyle = isRed ? '#ef4444' : '#2563eb';
      ctx.beginPath();
      ctx.roundRect(30, 30, 118, 68, 34);
      ctx.fill();

      ctx.font = '900 26px "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isRed ? 'RED' : 'BLUE', 89, 64);

      const cleanCallsign = name.replace(/^\[(RED|BLUE)\]\s*/i, '').toUpperCase();
      ctx.font = '900 30px "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(cleanCallsign.slice(0, 14), 312, 64);
    } else {
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
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.3, 0.58, 1);
    sprite.position.set(0, 2.72, 0);
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

    // 1. Articulated 3D Legs, Knee Pads & High-Top Sneakers
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.44, 0.4, 0);
    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.44, 0.4, 0);

    const buildFoot = () => {
      const fg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.22, 12, 16), furMat);
      thigh.castShadow = true;
      fg.add(thigh);

      const kneePad = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.45 })
      );
      kneePad.scale.set(1.0, 0.85, 0.65);
      kneePad.position.set(0, -0.05, 0.18);
      fg.add(kneePad);

      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.24, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.32, metalness: 0.35 })
      );
      shoe.position.set(0, -0.23, 0.13);
      shoe.castShadow = true;
      fg.add(shoe);

      const toeCap = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25 })
      );
      toeCap.scale.set(0.98, 0.58, 0.85);
      toeCap.position.set(0, -0.24, 0.36);
      fg.add(toeCap);

      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.43, 0.07, 0.66),
        new THREE.MeshStandardMaterial({
          color: teamColorNum,
          emissive: teamColorNum,
          emissiveIntensity: 0.3
        })
      );
      sole.position.set(0, -0.33, 0.13);
      fg.add(sole);
      return fg;
    };
    leftLeg.add(buildFoot());
    rightLeg.add(buildFoot());
    root.add(leftLeg, rightLeg);

    // 2. Plump Sculpted 3D Torso, Belly & Fluffy Tail
    const bodyGroup = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.92, 28, 24), furMat);
    torso.scale.set(1.05, 1.04, 0.98);
    torso.position.y = 0.94;
    torso.castShadow = true;
    torso.receiveShadow = true;
    bodyGroup.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.76, 24, 20), bellyMat);
    belly.scale.set(0.88, 0.92, 0.48);
    belly.position.set(0, 0.9, 0.66);
    bodyGroup.add(belly);

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), bellyMat);
    tail.position.set(0, 0.64, -0.94);
    tail.castShadow = true;
    bodyGroup.add(tail);

    // 3. Tactical 3D Paintball Chest Vest, Shoulder Pauldrons & Rear 4-Pod Harness Pack
    const vestShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.89, 0.96, 0.74, 28, 1, true),
      vestMat
    );
    vestShell.position.y = 0.97;
    vestShell.castShadow = true;
    bodyGroup.add(vestShell);

    // 3D Shoulder Armor Pauldrons with Team Trim
    [-1, 1].forEach(side => {
      const pauldronGroup = new THREE.Group();
      pauldronGroup.position.set(side * 0.86, 1.28, 0.06);
      pauldronGroup.rotation.z = -side * 0.32;

      const pauldronShell = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
        vestMat
      );
      pauldronShell.scale.set(1.0, 0.85, 1.15);
      pauldronShell.castShadow = true;
      pauldronGroup.add(pauldronShell);

      const pauldronStripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.14, 0.48),
        new THREE.MeshStandardMaterial({
          color: teamColorNum,
          emissive: teamColorNum,
          emissiveIntensity: 0.35,
          roughness: 0.25
        })
      );
      pauldronStripe.position.set(0, 0.18, 0);
      pauldronGroup.add(pauldronStripe);
      bodyGroup.add(pauldronGroup);
    });

    // 3D Back X-Harness Straps & Chest Armor Plate
    [-1, 1].forEach(side => {
      const backStrap = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.68, 0.08),
        new THREE.MeshStandardMaterial({
          color: teamColorNum,
          emissive: teamColorNum,
          emissiveIntensity: 0.22,
          roughness: 0.4
        })
      );
      backStrap.position.set(0, 1.06, -0.88);
      backStrap.rotation.z = side * 0.52;
      bodyGroup.add(backStrap);
    });

    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.48, 0.24), strapMat);
    chestPlate.position.set(0, 1.0, 0.84);
    bodyGroup.add(chestPlate);

    const podPackGroup = new THREE.Group();
    podPackGroup.position.set(0, 0.95, -0.88);
    const packBelt = new THREE.Mesh(
      new THREE.BoxGeometry(0.94, 0.46, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.45, metalness: 0.3 })
    );
    podPackGroup.add(packBelt);

    const podColors =
      team === 'red' || team === 'blue'
        ? [teamColorNum, teamColorNum, teamColorNum, teamColorNum]
        : [0xa3e635, 0xec4899, 0x22d3ee, 0xfacc15];
    for (let p = 0; p < 4; p++) {
      const px = -0.3 + p * 0.2;
      const podTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.088, 0.088, 0.6, 14),
        new THREE.MeshPhysicalMaterial({
          color: podColors[p],
          emissive: podColors[p],
          emissiveIntensity: team === 'red' || team === 'blue' ? 0.28 : 0.1,
          transmission: 0.35,
          transparent: true,
          opacity: 0.94,
          clearcoat: 1.0,
          roughness: 0.1
        })
      );
      podTube.position.set(px, 0.04, -0.11);
      podPackGroup.add(podTube);

      const podCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.098, 0.098, 0.085, 14),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
      );
      podCap.position.set(px, 0.35, -0.11);
      podPackGroup.add(podCap);
    }
    bodyGroup.add(podPackGroup);

    // 4. Sculpted 3D Head, Chubby Cheeks, Prominent 3D Ears & Snout
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.74, 0.04);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.77, 30, 26), furMat);
    headSphere.scale.set(1.06, 0.97, 1.0);
    headSphere.castShadow = true;
    headGroup.add(headSphere);

    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 18), bellyMat);
    leftCheek.scale.set(1.12, 0.86, 0.96);
    leftCheek.position.set(-0.53, -0.14, 0.35);
    const rightCheek = leftCheek.clone();
    rightCheek.position.set(0.53, -0.14, 0.35);
    headGroup.add(leftCheek, rightCheek);

    const buildEar = (side: number) => {
      const earG = new THREE.Group();
      earG.position.set(side * 0.6, 0.6, -0.04);
      earG.rotation.z = -side * 0.36;
      earG.rotation.y = side * 0.24;

      const outerEar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.15, 22), furMat);
      outerEar.rotation.x = Math.PI / 2;
      outerEar.castShadow = true;
      earG.add(outerEar);

      const earRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.055, 12, 22), furMat);
      earRim.position.z = 0.02;
      earG.add(earRim);

      const innerEar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 20), pinkMat);
      innerEar.rotation.x = Math.PI / 2;
      innerEar.position.z = 0.025;
      earG.add(innerEar);
      return earG;
    };
    const leftEar = buildEar(-1);
    const rightEar = buildEar(1);
    headGroup.add(leftEar, rightEar);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 14), bellyMat);
    snout.scale.set(1.12, 0.82, 0.92);
    snout.position.set(0, -0.1, 0.73);
    headGroup.add(snout);

    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 14, 14),
      new THREE.MeshPhysicalMaterial({ color: 0xf43f5e, clearcoat: 1.0, roughness: 0.12 })
    );
    nose.position.set(0, -0.04, 0.93);
    headGroup.add(nose);

    // Cute 3D Buck Tooth & Whiskers
    const buckTooth = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.12, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    buckTooth.position.set(0, -0.2, 0.88);
    headGroup.add(buckTooth);

    const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
    [-1, 1].forEach(side => {
      [-0.04, 0.04].forEach((wy, wi) => {
        const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), whiskerMat);
        whisker.rotation.z = (Math.PI / 2) + side * (wi === 0 ? 0.12 : -0.12);
        whisker.position.set(side * 0.68, -0.12 + wy, 0.56);
        headGroup.add(whisker);
      });
    });

    // Character-Specific 3D Headgear (Positioned cleanly above the Team Headband so the Red/Blue Headband is ALWAYS 100% visible!)
    const headgearGroup = new THREE.Group();
    if (skin.headgear === 'Bandana') {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(0.77, 0.78, 0.16, 28),
        new THREE.MeshStandardMaterial({ color: teamColorNum, roughness: 0.45 })
      );
      band.position.set(0, 0.42, 0);
      headgearGroup.add(band);
    } else if (skin.headgear === 'Helmet') {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.79, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.36),
        new THREE.MeshPhysicalMaterial({ color: 0x0f172a, clearcoat: 1.0, roughness: 0.15 })
      );
      dome.position.y = 0.24;
      headgearGroup.add(dome);
      const crest = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.14, 0.85),
        new THREE.MeshStandardMaterial({ color: teamColorNum, emissive: teamColorNum, emissiveIntensity: 0.45 })
      );
      crest.position.set(0, 0.88, 0.05);
      headgearGroup.add(crest);
    } else if (skin.headgear === 'SpecOps') {
      const mount = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.16, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7, roughness: 0.3 })
      );
      mount.position.set(0, 0.62, 0.56);
      headgearGroup.add(mount);
      [-0.17, 0.17].forEach(ox => {
        const nvg = new THREE.Mesh(
          new THREE.CylinderGeometry(0.09, 0.09, 0.26, 14),
          new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.75 })
        );
        nvg.rotation.x = Math.PI / 2;
        nvg.position.set(ox, 0.62, 0.68);
        headgearGroup.add(nvg);
      });
    } else if (skin.headgear === 'Crown') {
      const crownBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.4, 0.26, 16),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.15, clearcoat: 1.0 })
      );
      crownBase.position.set(0, 0.84, 0.05);
      headgearGroup.add(crownBase);
    } else if (skin.headgear === 'Cyber') {
      const cyberFin = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.62, 4),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.35 })
      );
      cyberFin.position.set(0, 0.94, 0.12);
      headgearGroup.add(cyberFin);
    } else if (skin.headgear === 'Blossom') {
      [-0.42, 0.42].forEach(bx => {
        const flower = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.18, 0),
          new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.4 })
        );
        flower.position.set(bx, 0.76, 0.22);
        headgearGroup.add(flower);
      });
    } else if (skin.headgear === 'Flame') {
      [-0.22, 0, 0.22].forEach((fx, fi) => {
        const flameCone = new THREE.Mesh(
          new THREE.ConeGeometry(fi === 1 ? 0.22 : 0.16, fi === 1 ? 0.62 : 0.45, 8),
          new THREE.MeshStandardMaterial({
            color: fi === 1 ? 0xfef08a : 0xf97316,
            emissive: 0xf97316,
            emissiveIntensity: 0.55
          })
        );
        flameCone.position.set(fx, 0.88, 0.08);
        headgearGroup.add(flameCone);
      });
    } else if (skin.headgear === 'Astro') {
      const stalk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.45, 10),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 })
      );
      stalk.position.set(0, 0.88, 0.05);
      headgearGroup.add(stalk);
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 14, 14),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.85
        })
      );
      orb.position.set(0, 1.12, 0.05);
      headgearGroup.add(orb);
    } else if (skin.headgear === 'Samurai') {
      const kabutoCrest = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.06, 10, 20, Math.PI),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.15 })
      );
      kabutoCrest.rotation.z = Math.PI;
      kabutoCrest.position.set(0, 0.96, 0.42);
      headgearGroup.add(kabutoCrest);
    } else if (skin.headgear === 'Headphones') {
      const arcBand = new THREE.Mesh(
        new THREE.TorusGeometry(0.78, 0.065, 12, 24, Math.PI),
        new THREE.MeshStandardMaterial({
          color: 0xa3e635,
          emissive: 0xa3e635,
          emissiveIntensity: 0.3
        })
      );
      arcBand.position.set(0, 0.12, 0);
      headgearGroup.add(arcBand);
      [-0.78, 0.78].forEach(hx => {
        const cup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.24, 0.24, 0.18, 16),
          new THREE.MeshPhysicalMaterial({ color: 0xec4899, clearcoat: 1.0, roughness: 0.15 })
        );
        cup.rotation.z = Math.PI / 2;
        cup.position.set(hx, 0.08, 0.05);
        headgearGroup.add(cup);
      });
    } else if (skin.headgear === 'Cowboy') {
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(1.02, 1.02, 0.07, 24),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
      );
      brim.position.set(0, 0.72, 0.02);
      headgearGroup.add(brim);
      const hatTop = new THREE.Mesh(
        new THREE.CylinderGeometry(0.46, 0.56, 0.36, 20),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 })
      );
      hatTop.position.set(0, 0.92, 0.02);
      headgearGroup.add(hatTop);
    } else if (skin.headgear === 'Viking') {
      const helm = new THREE.Mesh(
        new THREE.SphereGeometry(0.77, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.35),
        new THREE.MeshStandardMaterial({ color: 0x57534e, metalness: 0.7, roughness: 0.35 })
      );
      helm.position.y = 0.25;
      headgearGroup.add(helm);
      [-1, 1].forEach(side => {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.14, 0.55, 12),
          new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3 })
        );
        horn.position.set(side * 0.76, 0.74, 0.1);
        horn.rotation.z = -side * 0.55;
        headgearGroup.add(horn);
      });
    }
    headGroup.add(headgearGroup);

    // 5. Pro Paintball Mask, High-Visibility Team Headband & Iridescent Thermal Goggles
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

    // PROMINENT 3D TEAM IDENTIFICATION HEADBAND (Red Headband on Red Team, Blue Headband on Blue Team!)
    const headbandColorNum =
      isHostReferee
        ? 0xfacc15
        : team === 'red'
        ? 0xef4444
        : team === 'blue'
        ? 0x2563eb
        : teamColorNum;

    const headbandMat = new THREE.MeshStandardMaterial({
      color: headbandColorNum,
      emissive: headbandColorNum,
      emissiveIntensity: 0.34,
      roughness: 0.35,
      metalness: 0.1
    });

    // Main Forehead Cloth Band (Radius 0.825 so it wraps outside the 0.805 head fur radius all the way around!)
    const headband = new THREE.Mesh(
      new THREE.CylinderGeometry(0.822, 0.828, 0.23, 32),
      headbandMat
    );
    headband.position.set(0, 0.43, 0.02);
    maskGroup.add(headband);

    // Crisp White Top & Bottom Contrast Trim Rings on the Headband so Red/Blue pops on any fur color
    const trimMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    [0.32, 0.54].forEach(ty => {
      const trimRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.826, 0.02, 10, 32),
        trimMat
      );
      trimRing.rotation.x = Math.PI / 2;
      trimRing.position.set(0, ty, 0.02);
      maskGroup.add(trimRing);
    });

    // Front Forehead Team Plate Emblem on the Headband
    const frontEmblemPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.19, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    frontEmblemPlate.position.set(0, 0.43, 0.82);
    maskGroup.add(frontEmblemPlate);

    const frontEmblemCore = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.11, 0.095),
      headbandMat
    );
    frontEmblemCore.position.set(0, 0.43, 0.825);
    maskGroup.add(frontEmblemCore);

    // Back Tied Headband Knot & Two Flowing Bandana Tails
    const headbandKnot = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 16),
      headbandMat
    );
    headbandKnot.position.set(0, 0.43, -0.84);
    maskGroup.add(headbandKnot);

    [-1, 1].forEach(side => {
      const tailRibbon = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.52, 0.06),
        headbandMat
      );
      tailRibbon.position.set(side * 0.19, 0.22, -0.94);
      tailRibbon.rotation.z = side * 0.44;
      tailRibbon.rotation.x = 0.36;
      maskGroup.add(tailRibbon);
    });

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

    // Expressive 3D Eyebrows & Glowing Eye Catchlights on Visor
    [-1, 1].forEach(side => {
      const brow = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.065, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 })
      );
      brow.position.set(side * 0.26, 0.34, 0.8);
      brow.rotation.z = -side * 0.14;
      maskGroup.add(brow);

      const eyeHighlight = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      eyeHighlight.position.set(side * 0.24, 0.17, 0.88);
      maskGroup.add(eyeHighlight);
    });

    headGroup.add(maskGroup);
    bodyGroup.add(headGroup);

    // Hip-Holstered Mini Health Can (Left Hip) & Defence Can (Right Hip) on Tactical Belt
    const hipHealthCan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x22c55e, clearcoat: 1.0, roughness: 0.15 })
    );
    hipHealthCan.position.set(-0.88, 0.78, 0.18);
    hipHealthCan.rotation.z = 0.22;
    bodyGroup.add(hipHealthCan);

    const hipShieldCan = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x06b6d4, clearcoat: 1.0, roughness: 0.15 })
    );
    hipShieldCan.position.set(0.88, 0.78, -0.15);
    hipShieldCan.rotation.z = -0.22;
    bodyGroup.add(hipShieldCan);

    // 6. Articulated 3D Arms, Paws, Held Canister & Pro Mechanical Paintball Marker Gun
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.8, 1.18, 0.34);
    const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.4, 12, 16), furMat);
    leftArm.rotation.x = Math.PI / 2.8;
    leftArm.rotation.z = -0.28;
    leftArm.castShadow = true;
    leftArmGroup.add(leftArm);

    const leftPaw = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), bellyMat);
    leftPaw.position.set(0.12, -0.12, 0.26);
    leftArmGroup.add(leftPaw);

    // 3D Canister in Left Paw (Visible when player Long-Presses Health/Defence Can!)
    const heldCanMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.38, 14),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x22c55e,
        emissiveIntensity: 0.45,
        roughness: 0.2
      })
    );
    heldCanMesh.position.set(0.15, 0.18, 0.32);
    heldCanMesh.visible = false;
    leftArmGroup.add(heldCanMesh);
    bodyGroup.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.78, 1.18, 0.42);
    const rightArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.4, 12, 16), furMat);
    rightArm.rotation.x = Math.PI / 2.3;
    rightArm.castShadow = true;
    rightArmGroup.add(rightArm);

    const rightPaw = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 14), bellyMat);
    rightPaw.position.set(0.02, -0.06, 0.28);
    rightArmGroup.add(rightPaw);
    bodyGroup.add(rightArmGroup);

    const markerGroup = new THREE.Group();
    markerGroup.position.set(0.82, 1.24, 0.55);
    // Subtle inward toe-in so the gun barrel naturally converges on the forward crosshair line
    markerGroup.rotation.y = -0.055;

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

    // Reciprocating Mechanical Bolt on Top-Rear of Receiver (Slams back & forth on every shot!)
    const boltMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.068, 0.068, 0.44, 14),
      chromeMat
    );
    boltMesh.rotation.x = Math.PI / 2;
    boltMesh.position.set(0, 0.15, -0.22);
    markerGroup.add(boltMesh);

    // Chambered Paintball visible travelling down the Barrel Breach when firing
    const chamberBallMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 12),
      new THREE.MeshBasicMaterial({ color: teamColorNum })
    );
    chamberBallMesh.position.set(0, 0.05, 0.25);
    chamberBallMesh.visible = false;
    markerGroup.add(chamberBallMesh);

    const barrelBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.08, 0.65, 16),
      carbonMat
    );
    barrelBack.rotation.x = Math.PI / 2;
    barrelBack.position.set(0, 0.05, 0.72);
    markerGroup.add(barrelBack);

    const barrelTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.064, 0.07, 0.68, 16),
      anodizedMat
    );
    barrelTip.rotation.x = Math.PI / 2;
    barrelTip.position.set(0, 0.05, 1.3);
    markerGroup.add(barrelTip);

    // Ported Muzzle Brake & Hollow Dark Barrel Bore at the Tip of the Gun
    const muzzleBrake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.082, 0.072, 0.18, 16),
      chromeMat
    );
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.05, 1.64);
    markerGroup.add(muzzleBrake);

    const barrelBore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.052, 0.06, 14),
      new THREE.MeshBasicMaterial({ color: 0x020617 })
    );
    barrelBore.rotation.x = Math.PI / 2;
    barrelBore.position.set(0, 0.05, 1.71);
    markerGroup.add(barrelBore);

    // Exact 3D Muzzle Spawn Point at the Front Opening of the Gun Barrel!
    const muzzleTip = new THREE.Object3D();
    muzzleTip.position.set(0, 0.05, 1.75);
    markerGroup.add(muzzleTip);

    // Multi-Part 3D Muzzle Blast & Gas Ring at the Gun Barrel Tip (Flashes when bullet exits!)
    const muzzleFlash = new THREE.Group();
    muzzleFlash.position.set(0, 0.05, 1.76);
    muzzleFlash.visible = false;

    const flashCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.95
      })
    );
    muzzleFlash.add(flashCore);

    const flashCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.19, 0.58, 12),
      new THREE.MeshBasicMaterial({
        color: teamColorNum,
        transparent: true,
        opacity: 0.85
      })
    );
    flashCone.rotation.x = Math.PI / 2;
    flashCone.position.z = 0.28;
    muzzleFlash.add(flashCone);

    const flashRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.24, 0.035, 8, 18),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9
      })
    );
    flashRing.position.z = 0.08;
    muzzleFlash.add(flashRing);

    markerGroup.add(muzzleFlash);

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
        opacity: 0.68,
        roughness: 0.12,
        clearcoat: 1.0
      })
    );
    hopperShell.scale.set(0.92, 0.82, 1.38);
    hopperGroup.add(hopperShell);

    // Visible 3D Paintballs inside the Translucent Hopper that Agitate & Feed into the Gun when Shooting!
    const hopperBallsGroup = new THREE.Group();
    const hopperBallOffsets = [
      [-0.08, -0.04, -0.1],
      [0.08, -0.03, -0.08],
      [0, -0.02, 0.1],
      [-0.09, 0.04, 0.06],
      [0.09, 0.05, 0.08],
      [0, 0.06, -0.04]
    ];
    hopperBallOffsets.forEach(([bx, by, bz], bi) => {
      const hbColor =
        team === 'red' || team === 'blue'
          ? teamColorNum
          : bi % 2 === 0
          ? teamColorNum
          : skin.paintColor;
      const hb = new THREE.Mesh(
        new THREE.SphereGeometry(0.072, 10, 10),
        new THREE.MeshPhysicalMaterial({
          color: hbColor,
          emissive: hbColor,
          emissiveIntensity: 0.28,
          clearcoat: 1.0,
          roughness: 0.1
        })
      );
      hb.position.set(bx, by, bz);
      hopperBallsGroup.add(hb);
    });
    hopperGroup.add(hopperBallsGroup);

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

    // 6b. 3D Team Identification Ground Ring under the Hamster's Feet (Red Ring for Red Team, Blue Ring for Blue Team)
    if (!isHostReferee && (team === 'red' || team === 'blue')) {
      const teamGroundRing = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1.18, 32),
        new THREE.MeshBasicMaterial({
          color: teamColorNum,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88
        })
      );
      teamGroundRing.rotation.x = -Math.PI / 2;
      teamGroundRing.position.y = 0.05;
      root.add(teamGroundRing);
    }

    // 7. 3D Ground Aura Ring when Long-Pressing a Health/Defence Can
    const canAuraRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.35, 32),
      new THREE.MeshBasicMaterial({
        color: 0x4ade80,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    canAuraRing.rotation.x = -Math.PI / 2;
    canAuraRing.position.y = 0.08;
    canAuraRing.visible = false;
    root.add(canAuraRing);

    // 7b. 3D 10-Second Respawn Immunity Forcefield Shield (Visible when player has active 10s Respawn Immunity!)
    const immunityShieldGroup = new THREE.Group();
    const immunityBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.52, 24, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xfacc15,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.28,
        roughness: 0.1,
        clearcoat: 1.0,
        depthWrite: false
      })
    );
    immunityBubble.position.y = 1.25;
    immunityShieldGroup.add(immunityBubble);

    const immunityHalo = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.055, 12, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9
      })
    );
    immunityHalo.rotation.x = Math.PI / 2;
    immunityHalo.position.y = 0.22;
    immunityShieldGroup.add(immunityHalo);

    immunityShieldGroup.visible = false;
    root.add(immunityShieldGroup);

    // 8. Floating 3D Callsign Tag
    const nameSprite = createPlayerNameSprite(callsign, skin, isHostReferee, team);
    root.add(nameSprite);

    root.userData = {
      leftLeg,
      rightLeg,
      leftEar,
      rightEar,
      tail,
      leftArmGroup,
      rightArmGroup,
      heldCanMesh,
      canAuraRing,
      immunityShieldGroup,
      bodyGroup,
      headGroup,
      markerGroup,
      boltMesh,
      chamberBallMesh,
      hopperBallsGroup,
      muzzleTip,
      muzzleFlash,
      nameSprite,
      recoil: 0,
      skinIdx,
      callsign
    };

    return root;
  }

  // Build 3D Pressurized Health Cans & Defence Cans Around the Arena
  function buildPowerupCrate(type: 'health' | 'shield'): THREE.Group {
    const g = new THREE.Group();
    const isHealth = type === 'health';
    const mainColor = isHealth ? 0x10b981 : 0x06b6d4;
    const glowColor = isHealth ? 0x4ade80 : 0x38bdf8;
    const primaryHex = isHealth ? '#10b981' : '#06b6d4';
    const badgeLabel = isHealth ? 'HEALTH CAN' : 'DEFENCE CAN';
    const subLabel = isHealth ? '+45 HP' : '+50 SHIELD';

    // 1. Glowing Base Pad & Outer Ring on Turf
    const basePad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.95, 0.08, 28),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.5
      })
    );
    basePad.position.y = 0.04;
    g.add(basePad);

    const baseRing = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.22, 32),
      new THREE.MeshBasicMaterial({
        color: glowColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    baseRing.rotation.x = -Math.PI / 2;
    baseRing.position.y = 0.05;
    g.add(baseRing);

    // 2. Floating Rotating 3D Pressurized Energy Canister
    const floater = new THREE.Group();
    floater.position.y = 1.15;

    // Procedural Wrap-Around Canister Label Texture
    const lc = document.createElement('canvas');
    lc.width = 256;
    lc.height = 256;
    const lctx = lc.getContext('2d')!;
    lctx.fillStyle = primaryHex;
    lctx.fillRect(0, 0, 256, 256);

    lctx.fillStyle = '#0f172a';
    lctx.fillRect(0, 26, 256, 40);
    lctx.fillRect(0, 190, 256, 40);

    lctx.fillStyle = '#ffffff';
    lctx.font = '900 26px "Inter", system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.textBaseline = 'middle';
    lctx.fillText(badgeLabel, 128, 108);
    lctx.fillStyle = '#fef08a';
    lctx.font = '900 30px "Inter", system-ui, sans-serif';
    lctx.fillText(subLabel, 128, 148);

    const canTex = new THREE.CanvasTexture(lc);
    canTex.colorSpace = THREE.SRGBColorSpace;

    const chromeRimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.92,
      roughness: 0.14
    });

    // Main Cylindrical Can Body
    const canBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 1.12, 28),
      new THREE.MeshPhysicalMaterial({
        map: canTex,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        roughness: 0.18,
        metalness: 0.25
      })
    );
    canBody.castShadow = true;
    floater.add(canBody);

    // Bottom & Top Metallic Beveled Rims
    const bottomRim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.45, 0.1, 28),
      chromeRimMat
    );
    bottomRim.position.y = -0.56;
    floater.add(bottomRim);

    const topShoulder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.48, 0.14, 28),
      chromeRimMat
    );
    topShoulder.position.y = 0.58;
    floater.add(topShoulder);

    // Top Pull-Tab & Drinking Nozzle
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.2, 0.12, 18),
      new THREE.MeshStandardMaterial({
        color: mainColor,
        emissive: mainColor,
        emissiveIntensity: 0.5
      })
    );
    topCap.position.y = 0.7;
    floater.add(topCap);

    // Orbiting Energy Halo Ring around the Can
    const haloRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.045, 12, 28),
      new THREE.MeshBasicMaterial({ color: glowColor })
    );
    haloRing.rotation.x = Math.PI / 3;
    floater.add(haloRing);

    g.add(floater);

    // 3. Floating 3D Label Badge Above the Can
    const bc = document.createElement('canvas');
    bc.width = 256;
    bc.height = 64;
    const bctx = bc.getContext('2d')!;
    bctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    bctx.beginPath();
    bctx.roundRect(8, 6, 240, 52, 26);
    bctx.fill();
    bctx.lineWidth = 4;
    bctx.strokeStyle = primaryHex;
    bctx.stroke();
    bctx.fillStyle = '#ffffff';
    bctx.font = '900 22px "Inter", system-ui, sans-serif';
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(`${isHealth ? '🧪' : '🛡️'} ${badgeLabel}`, 128, 32);

    const badgeTex = new THREE.CanvasTexture(bc);
    badgeTex.colorSpace = THREE.SRGBColorSpace;
    const badgeSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: false })
    );
    badgeSprite.scale.set(2.2, 0.55, 1);
    badgeSprite.position.set(0, 2.25, 0);
    g.add(badgeSprite);

    g.userData = { floater, baseRing, haloRing };
    return g;
  }

  const animateHamsterRig = (
    hamsterGroup: THREE.Group,
    isMoving: boolean,
    walkPhase: number,
    dt: number,
    holdingCanType: 'health' | 'shield' | null = null,
    playStepAudio: boolean = false
  ): number => {
    const ud = hamsterGroup.userData;
    if (!ud) return walkPhase;
    let nextPhase = walkPhase;

    if (isMoving) {
      nextPhase += dt * 15.8;
      if (playStepAudio) {
        sfx.playFootstep();
      }
      if (ud.leftLeg) {
        ud.leftLeg.rotation.x = Math.sin(nextPhase) * 0.78;
        ud.leftLeg.position.y = 0.38 + Math.max(0, Math.sin(nextPhase)) * 0.13;
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x = -Math.sin(nextPhase) * 0.78;
        ud.rightLeg.position.y = 0.38 + Math.max(0, -Math.sin(nextPhase)) * 0.13;
      }
      if (ud.bodyGroup) {
        ud.bodyGroup.position.y = Math.abs(Math.sin(nextPhase * 2)) * 0.14;
        ud.bodyGroup.rotation.z = Math.sin(nextPhase) * 0.075;
        ud.bodyGroup.rotation.x = 0.08; // Athletic forward sprint lean
      }
      if (ud.headGroup) {
        ud.headGroup.rotation.z = -Math.sin(nextPhase) * 0.04;
        ud.headGroup.position.y = 1.72 + Math.abs(Math.cos(nextPhase * 2)) * 0.04;
      }
      if (ud.leftEar) ud.leftEar.rotation.z = 0.38 + Math.sin(nextPhase * 2) * 0.16;
      if (ud.rightEar) ud.rightEar.rotation.z = -0.38 - Math.sin(nextPhase * 2) * 0.16;
      if (ud.tail) ud.tail.rotation.y = Math.sin(nextPhase * 2.5) * 0.42;
      if (ud.hopperBallsGroup) {
        ud.hopperBallsGroup.position.y = Math.abs(Math.sin(nextPhase * 2)) * 0.03;
      }
    } else {
      nextPhase += dt * 2.8;
      if (ud.leftLeg) {
        ud.leftLeg.rotation.x *= 0.84;
        ud.leftLeg.position.y = 0.38;
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x *= 0.84;
        ud.rightLeg.position.y = 0.38;
      }
      if (ud.bodyGroup) {
        ud.bodyGroup.position.y = Math.sin(nextPhase) * 0.035;
        ud.bodyGroup.rotation.z *= 0.84;
        ud.bodyGroup.rotation.x *= 0.84;
      }
      if (ud.headGroup) {
        ud.headGroup.rotation.z = Math.sin(nextPhase * 0.5) * 0.02;
        ud.headGroup.position.y = 1.72 + Math.sin(nextPhase) * 0.015;
      }
      if (ud.leftEar) ud.leftEar.rotation.z = 0.38 + Math.sin(nextPhase) * 0.04;
      if (ud.rightEar) ud.rightEar.rotation.z = -0.38 - Math.sin(nextPhase) * 0.04;
    }

    // Mechanical Gun Shot Recoil, Reciprocating Bolt, Chambered Bullet & Muzzle Blast Animation
    const runSwayY = isMoving ? Math.sin(nextPhase) * 0.035 : Math.sin(nextPhase) * 0.01;
    if (typeof ud.recoil === 'number' && ud.recoil > 0.01) {
      ud.recoil = Math.max(0, ud.recoil - dt * 6.8);
      if (ud.markerGroup) {
        ud.markerGroup.position.z = 0.55 - ud.recoil * 0.28;
        ud.markerGroup.position.y = 1.24 + runSwayY + ud.recoil * 0.05;
        ud.markerGroup.rotation.x = -ud.recoil * 0.22;
      }
      if (ud.rightArmGroup) {
        ud.rightArmGroup.position.z = 0.42 - ud.recoil * 0.2;
        ud.rightArmGroup.rotation.x = -ud.recoil * 0.18;
      }
      if (ud.boltMesh) {
        // Mechanical bolt slams backward & cycles forward
        ud.boltMesh.position.z = -0.22 - Math.sin(ud.recoil * Math.PI) * 0.32;
      }
      if (ud.chamberBallMesh) {
        // Show paintball travelling down the barrel from hopper to muzzle!
        ud.chamberBallMesh.visible = ud.recoil > 0.25;
        ud.chamberBallMesh.position.z = 0.25 + (1 - ud.recoil) * 1.45;
      }
      if (ud.hopperBallsGroup) {
        ud.hopperBallsGroup.rotation.y += dt * 18;
        ud.hopperBallsGroup.position.y = Math.sin(ud.recoil * Math.PI * 2) * 0.055;
      }
      if (ud.muzzleFlash) {
        ud.muzzleFlash.visible = ud.recoil > 0.48;
        const flashScale = 0.75 + ud.recoil * 0.85;
        ud.muzzleFlash.scale.setScalar(flashScale);
        ud.muzzleFlash.rotation.z += dt * 25;
      }
    } else {
      if (ud.markerGroup) {
        ud.markerGroup.position.z = 0.55;
        ud.markerGroup.position.y = 1.24 + runSwayY;
        ud.markerGroup.rotation.x = 0;
      }
      if (ud.rightArmGroup) {
        ud.rightArmGroup.position.z = 0.42;
        ud.rightArmGroup.rotation.x = 0;
      }
      if (ud.boltMesh) {
        ud.boltMesh.position.z = -0.22;
      }
      if (ud.chamberBallMesh) {
        ud.chamberBallMesh.visible = false;
      }
      if (ud.muzzleFlash) {
        ud.muzzleFlash.visible = false;
      }
    }

    // Long-Press Can Drinking / Charging 3D Pose & Aura Ring
    if (ud.leftArmGroup && ud.heldCanMesh && ud.canAuraRing) {
      if (holdingCanType) {
        const canColor = holdingCanType === 'health' ? 0x22c55e : 0x06b6d4;
        ud.heldCanMesh.visible = true;
        (ud.heldCanMesh.material as THREE.MeshStandardMaterial).color.setHex(canColor);
        (ud.heldCanMesh.material as THREE.MeshStandardMaterial).emissive.setHex(canColor);
        ud.leftArmGroup.rotation.x = -0.85 + Math.sin(nextPhase * 4) * 0.12;
        ud.leftArmGroup.rotation.y = 0.45;
        ud.canAuraRing.visible = true;
        (ud.canAuraRing.material as THREE.MeshBasicMaterial).color.setHex(canColor);
        const pulseScale = 1.0 + Math.sin(nextPhase * 5) * 0.15;
        ud.canAuraRing.scale.setScalar(pulseScale);
      } else {
        ud.heldCanMesh.visible = false;
        ud.leftArmGroup.rotation.x = 0;
        ud.leftArmGroup.rotation.y = 0;
        ud.canAuraRing.visible = false;
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

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(
      48,
      initW / Math.max(1, initH),
      0.1,
      400
    );
    camera.position.set(0, 32, 32);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(initW, initH);

    const gl = renderer.getContext();
    const debugBasic = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = debugBasic ? gl.getParameter(debugBasic.UNMASKED_RENDERER_WEBGL) : '';
    const isSoftwareGl = /SwiftShader|Software|llvmpipe|Microsoft Basic Render/i.test(rendererStr);

    renderer.setPixelRatio(isSoftwareGl ? 1.0 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    (scene as any).environmentIntensity = 0.44;
    pmremGenerator.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4d7c0f, 0.92);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.25);
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

    // Pro Astro-Turf & Top-Middle (Red) / Bottom-Middle (Blue) Square Spawn Markings
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

      for (let i = 0; i < 14000; i++) {
        const gx = Math.random() * c.width;
        const gy = Math.random() * c.height;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,40,10,0.08)';
        ctx.fillRect(gx, gy, 2, 4);
      }

      // Wide Accessible Park Walkways (North-South & East-West Lanes from Top-Middle & Bottom-Middle Spawns)
      ctx.fillStyle = 'rgba(194, 178, 128, 0.72)';
      ctx.fillRect(60, 472, 904, 80);
      ctx.fillRect(472, 80, 80, 864);

      ctx.save();
      ctx.strokeStyle = 'rgba(194, 178, 128, 0.52)';
      ctx.lineWidth = 48;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(512, 322);
      ctx.lineTo(256, 512);
      ctx.lineTo(512, 702);
      ctx.lineTo(768, 512);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Tournament Boundary Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 8;
      ctx.strokeRect(72, 88, 880, 848);

      // 50-Yard Horizontal Midfield Line (Separating Top Red Half & Bottom Blue Half)
      ctx.save();
      ctx.setLineDash([24, 16]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(72, 512);
      ctx.lineTo(952, 512);
      ctx.stroke();
      ctx.restore();

      // Center Circle
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.88)';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(512, 512, 96, 0, Math.PI * 2);
      ctx.stroke();

      // TOP MIDDLE SQUARE SPAWN AREA (RED SQUAD: centered at world x = 0, z = -26 -> canvas x = 512, y = 322)
      ctx.fillStyle = 'rgba(244, 63, 94, 0.52)';
      ctx.beginPath();
      ctx.roundRect(443, 277, 138, 90, 20);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#fda4af';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RED SPAWN', 512, 329);

      // BOTTOM MIDDLE SQUARE SPAWN AREA (BLUE SQUAD: centered at world x = 0, z = +26 -> canvas x = 512, y = 702)
      ctx.fillStyle = 'rgba(37, 99, 235, 0.52)';
      ctx.beginPath();
      ctx.roundRect(443, 657, 138, 90, 20);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#7dd3fc';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BLUE SPAWN', 512, 709);

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

    // =========================================================
    // 3D TOP MIDDLE (RED) & BOTTOM MIDDLE (BLUE) SQUARE SPAWN BASES (ONLY SQUARE SPAWN — NO CIRCLE PAD!)
    // =========================================================
    const createTeamCornerSpawnBase = (
      x: number,
      z: number,
      teamColorHex: number,
      bannerLabel: string,
      primaryHexStr: string
    ) => {
      const spawnGroup = new THREE.Group();
      spawnGroup.position.set(x, 0, z);

      // 3D Square Spawn Perimeter Frame on Turf (Matches the Square Spawn on the turf; NO circular pad!)
      const borderMat = new THREE.MeshStandardMaterial({
        color: teamColorHex,
        emissive: teamColorHex,
        emissiveIntensity: 0.25,
        roughness: 0.3,
        metalness: 0.2
      });
      const halfW = 9.4;
      const halfD = 6.2;
      const barThick = 0.38;
      const barH = 0.14;

      const northBar = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2 + barThick, barH, barThick),
        borderMat
      );
      northBar.position.set(0, barH / 2, -halfD);
      spawnGroup.add(northBar);

      const southBar = new THREE.Mesh(
        new THREE.BoxGeometry(halfW * 2 + barThick, barH, barThick),
        borderMat
      );
      southBar.position.set(0, barH / 2, halfD);
      spawnGroup.add(southBar);

      const westBar = new THREE.Mesh(
        new THREE.BoxGeometry(barThick, barH, halfD * 2),
        borderMat
      );
      westBar.position.set(-halfW, barH / 2, 0);
      spawnGroup.add(westBar);

      const eastBar = new THREE.Mesh(
        new THREE.BoxGeometry(barThick, barH, halfD * 2),
        borderMat
      );
      eastBar.position.set(halfW, barH / 2, 0);
      spawnGroup.add(eastBar);

      // Ground-level Spawn Zone Floor Sign (Never blocks camera behind Red or Blue Spawn!)
      const bc = document.createElement('canvas');
      bc.width = 512;
      bc.height = 128;
      const bctx = bc.getContext('2d')!;
      bctx.fillStyle = '#0f172a';
      bctx.fillRect(0, 0, 512, 128);
      bctx.strokeStyle = primaryHexStr;
      bctx.lineWidth = 10;
      bctx.strokeRect(5, 5, 502, 118);
      bctx.fillStyle = '#ffffff';
      bctx.font = '900 42px "Inter", system-ui, sans-serif';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText(bannerLabel, 256, 64);
      const bannerTex = new THREE.CanvasTexture(bc);
      bannerTex.colorSpace = THREE.SRGBColorSpace;

      const groundPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 1.8),
        new THREE.MeshBasicMaterial({ map: bannerTex })
      );
      groundPlaque.rotation.x = -Math.PI / 2;
      groundPlaque.position.set(0, 0.04, z < 0 ? -halfD + 1.2 : halfD - 1.2);
      if (z < 0) {
        groundPlaque.rotation.z = Math.PI;
      }
      spawnGroup.add(groundPlaque);

      scene.add(spawnGroup);
    };

    // Top Middle Square Spawn Area (Red Squad: x = 0, z = -26) & Bottom Middle Square Spawn Area (Blue Squad: x = 0, z = +26)
    createTeamCornerSpawnBase(0, -26, 0xf43f5e, 'RED SQUAD SPAWN', '#f43f5e');
    createTeamCornerSpawnBase(0, 26, 0x2563eb, 'BLUE SQUAD SPAWN', '#38bdf8');

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

    // Bunker Builders (with accessible collision radii so walkways never trap players)
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
      const body = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4.6, 3), mat);
      body.position.y = 2.3;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const cap = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.3, 16, 28),
        new THREE.MeshPhysicalMaterial({ color: c3, clearcoat: 1.0, roughness: 0.15 })
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 3.95;
      g.add(cap);

      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.0, h: 4.6 });
    };

    const createCan = (x: number, z: number, c1: string, c2: string, c3: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, c3, 'PRO CAN'));
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 2.05, 4.4, 28), mat);
      cyl.position.y = 2.2;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      g.add(cyl);

      const topRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.85, 0.22, 14, 32),
        new THREE.MeshPhysicalMaterial({ color: c2, clearcoat: 1.0, roughness: 0.15 })
      );
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 4.35;
      g.add(topRing);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.0, h: 4.5 });
    };

    const createBrick = (x: number, z: number, rot: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#facc15', 'WALL'));
      for (let i = 0; i < 3; i++) {
        const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 4.2, 16, 24), mat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.68 + i * 1.1;
        tube.castShadow = true;
        tube.receiveShadow = true;
        g.add(tube);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.3, h: 3.5 });
    };

    const createCenterXBunker = (x: number, z: number) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(
        createProBunkerTexture('#1e1b4b', '#ec4899', '#a3e635', 'X-BALL 50')
      );
      const leg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.88, 4.8, 16, 24), mat);
      leg1.position.y = 2.6;
      leg1.rotation.z = Math.PI / 4;
      leg1.castShadow = true;
      leg1.receiveShadow = true;
      g.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.88, 4.8, 16, 24), mat);
      leg2.position.y = 2.6;
      leg2.rotation.z = -Math.PI / 4;
      leg2.castShadow = true;
      leg2.receiveShadow = true;
      g.add(leg2);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.6, h: 4.9 });
    };

    const createTireStack = (x: number, z: number) => {
      const g = new THREE.Group();
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
      const offsets = [
        [-0.85, 0],
        [0.85, 0],
        [0, 0.85]
      ];
      offsets.forEach(([ox, oz], idx) => {
        for (let level = 0; level < (idx === 2 ? 4 : 3); level++) {
          const tire = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.32, 12, 20), tireMat);
          tire.rotation.x = Math.PI / 2;
          tire.position.set(ox, 0.32 + level * 0.6, oz);
          tire.castShadow = true;
          g.add(tire);
        }
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.1, 16), rimMat);
        cap.position.set(ox, (idx === 2 ? 4 : 3) * 0.6, oz);
        g.add(cap);
      });
      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 1.85, h: 2.6 });
    };

    const createAztecaTempleBunker = (x: number, z: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#facc15', 'MAYA'));
      for (let step = 0; step < 3; step++) {
        const w = 4.2 - step * 1.0;
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, 1.25, w * 0.65), mat);
        box.position.y = 0.62 + step * 1.2;
        box.castShadow = true;
        box.receiveShadow = true;
        g.add(box);
      }
      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.2, h: 3.9 });
    };

    // =========================================================
    // SYMMETRICAL, OPEN & ACCESSIBLE SPEEDBALL ARENA LAYOUT
    // Clear, wide sightlines from Top-Middle Red Spawn (0, -26) & Bottom-Middle Blue Spawn (0, +26)
    // =========================================================
    createCenterXBunker(0, 0);

    // Symmetrical Mid-Field Doritos (Top Red Half & Bottom Blue Half)
    createDorito(-15, -8, '#e11d48', '#facc15', '#ffffff', 0.35);
    createDorito(15, -8, '#0284c7', '#facc15', '#38bdf8', -0.35);
    createDorito(-15, 10, '#e11d48', '#84cc16', '#f472b6', -0.35);
    createDorito(15, 10, '#0284c7', '#84cc16', '#38bdf8', 0.35);

    // Symmetrical Wing Cans (Wide open outer lanes)
    createCan(-28, -2, '#eab308', '#1e293b', '#fef08a');
    createCan(28, -2, '#eab308', '#1e293b', '#fef08a');
    createCan(-26, 16, '#9333ea', '#a3e635', '#e9d5ff');
    createCan(26, 16, '#0d9488', '#facc15', '#ffffff');

    // Symmetrical Tactical Walls & Maya Bunkers
    createBrick(-12, -16, 0.18, '#e11d48', '#f8fafc');
    createBrick(12, -16, -0.18, '#2563eb', '#a3e635');
    createAztecaTempleBunker(-22, 4, '#059669', '#facc15');
    createAztecaTempleBunker(22, 4, '#dc2626', '#facc15');

    // Symmetrical Low Tire Stacks (Great cover while shooting over)
    createTireStack(-11, 13);
    createTireStack(11, 13);

    // =========================================================
    // 12 3D HEALTH CANS & DEFENCE CANS AROUND THE ARENA
    // Players collect them around the arena and LONG-PRESS to use them!
    // =========================================================
    const powerupConfigs: Array<{ type: 'health' | 'shield'; x: number; z: number }> = [
      { type: 'health', x: -24, z: -13 },
      { type: 'health', x: 24, z: -13 },
      { type: 'shield', x: -9, z: -9 },
      { type: 'shield', x: 9, z: -9 },
      { type: 'health', x: -18, z: 18 },
      { type: 'health', x: 18, z: 18 },
      { type: 'shield', x: -16, z: -20 },
      { type: 'shield', x: 16, z: 20 },
      { type: 'health', x: -32, z: 6 },
      { type: 'shield', x: 32, z: 6 },
      { type: 'shield', x: -14, z: 2 },
      { type: 'health', x: 14, z: 2 }
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

    // Arena Perimeter Truss Towers (Keeping Top-Middle & Bottom-Middle Spawn Centers Clear!)
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.25
    });
    const bannerColors = [0xa3e635, 0xec4899, 0x38bdf8, 0xfacc15];
    [
      [-46, -34],
      [-23, -34],
      [23, -34],
      [46, -34],
      [-46, 34],
      [-23, 34],
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

    // Perimeter Trees (Placed strictly along outer boundary so they NEVER block Top-Middle or Bottom-Middle Spawns!)
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
    };

    [
      [-50, -36, 1.25],
      [50, -36, 1.25],
      [-48, 26, 1.2],
      [48, 26, 1.3],
      [-18, -36, 1.15],
      [18, -36, 1.15],
      [-48, 2, 1.2],
      [48, 2, 1.2]
    ].forEach(([tx, tz, sc]) => createTree(tx, tz, sc));

    // =========================================================
    // 1 CHARACTER "TEACHER JAN" IN THE PARK DURING LOBBY ONLY!
    // When Start Game is clicked (`matchStatus === 'playing'`), Teacher Jan does NOT join!
    // =========================================================
    const teacherJanNpc = buildHighDefHamster(0, 'Teacher Jan', true, 'solo');
    teacherJanNpc.position.set(0, 0.32, -10.5);
    scene.add(teacherJanNpc);

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

    const initialSpawn = getTeamSpawnPosition(
      stateSnapRef.current.myTeam,
      stateSnapRef.current.matchMode
    );
    const startX = isHostRole ? 0 : initialSpawn.x;
    const startZ = isHostRole ? 14.0 : initialSpawn.z;
    localHamster.position.set(startX, 0, startZ);
    scene.add(localHamster);

    // 3D Tactical Ground Aim Reticle & Laser Sight Line from Gun Barrel Muzzle!
    const aimColorNum =
      stateSnapRef.current.matchMode === 'teams' && stateSnapRef.current.myTeam !== 'solo'
        ? TEAM_CONFIG[stateSnapRef.current.myTeam].colorNum
        : HAMSTER_SKINS[selectedSkinIdx % HAMSTER_SKINS.length].paintColor;

    const aimReticle = new THREE.Group();
    const reticleOuter = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: aimColorNum,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      })
    );
    reticleOuter.rotation.x = -Math.PI / 2;
    aimReticle.add(reticleOuter);

    const reticleCenter = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 16),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      })
    );
    reticleCenter.rotation.x = -Math.PI / 2;
    reticleCenter.position.y = 0.01;
    aimReticle.add(reticleCenter);
    aimReticle.position.set(startX, 0.06, startZ + 6);
    aimReticle.visible = !isHostRole;
    scene.add(aimReticle);

    const laserGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(startX, 1.3, startZ),
      new THREE.Vector3(startX, 0.12, startZ + 6)
    ]);
    const aimLaserLine = new THREE.Line(
      laserGeom,
      new THREE.LineBasicMaterial({
        color: aimColorNum,
        transparent: true,
        opacity: 0.42
      })
    );
    aimLaserLine.visible = !isHostRole;
    scene.add(aimLaserLine);

    const initYaw = isHostRole ? Math.PI : initialSpawn.rotY;
    gameRef.current = {
      scene,
      camera,
      renderer,
      localHamster,
      teacherJanNpc,
      aimReticle,
      aimLaserLine,
      shootButtonHeld: false,
      x: startX,
      z: startZ,
      rotY: initYaw,
      camYaw: initYaw,
      camPitch: 0.26,
      vx: 0,
      vz: 0,
      walkPhase: 0,
      keys: {},
      joyX: 0,
      joyZ: 0,
      mouseDown: false,
      mouseScreenX: window.innerWidth / 2,
      mouseScreenY: window.innerHeight / 2,
      lastMouseX: window.innerWidth / 2,
      lastMouseY: window.innerHeight / 2,
      mouseInitialized: false,
      lookTouchId: null,
      lookTouchLastX: 0,
      lookTouchLastY: 0,
      lookTouchStartX: 0,
      lookTouchStartY: 0,
      aimWorldX: startX + Math.sin(initYaw) * 10,
      aimWorldZ: startZ + Math.cos(initYaw) * 10,
      lastShotTime: 0,
      hostCamX: 0,
      hostCamZ: 4,
      obstacles,
      powerups,
      projectiles: [],
      splatDecals: [],
      particles: [],
      remotePlayers: new Map(),
      broadcastChannel: broadcastChannelRef.current || undefined
    };

    // Re-populate any already-connected remote players into the freshly created scene
    stateSnapRef.current.roomPlayers.forEach(rp => {
      if (rp.id !== clientIdRef.current && rp.role === 'player' && !rp.kicked) {
        upsertRemotePlayer(rp);
      }
    });

    // Keyboard, Mouse Free-Look & Mobile Right-Side Touch-Drag Free-Look Listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      const k = e.key.toLowerCase();
      gameRef.current.keys[k] = true;

      // Enforce: Answer questions ONLY during the active game (`matchStatus === 'playing'`)
      if (
        k === 'q' &&
        stateSnapRef.current.role === 'player' &&
        stateSnapRef.current.screen === 'game' &&
        stateSnapRef.current.matchStatus === 'playing'
      ) {
        setIsQuestionModalOpen(prev => !prev);
      }

      // Keyboard Long-Press Shortcuts for Health Can ('1' or 'h') & Defence Can ('2', 'f', or 'e')
      if (
        !e.repeat &&
        stateSnapRef.current.role === 'player' &&
        stateSnapRef.current.screen === 'game'
      ) {
        if (k === '1' || k === 'h') {
          startCanLongPress('health');
        } else if (k === '2' || k === 'f' || k === 'e') {
          startCanLongPress('shield');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      const k = e.key.toLowerCase();
      gameRef.current.keys[k] = false;
      if (k === '1' || k === 'h' || k === '2' || k === 'f' || k === 'e') {
        stopCanLongPress();
      }
    };

    // Track recent touch activity so mobile browsers' synthetic mousemove events never cause sudden camera rotation
    let lastTouchEventTime = 0;

    // Laptop Mouse Movement Changes Camera View, Character View & Aiming Reticle
    const handleMouseMove = (e: MouseEvent) => {
      const g = gameRef.current;
      if (!g) return;
      // Ignore synthetic mouse events fired by mobile browsers right after touch interactions
      if (performance.now() - lastTouchEventTime < 1000) {
        g.lastMouseX = e.clientX;
        g.lastMouseY = e.clientY;
        return;
      }
      g.mouseScreenX = e.clientX;
      g.mouseScreenY = e.clientY;

      const rawDx =
        typeof e.movementX === 'number' && document.pointerLockElement
          ? e.movementX
          : g.mouseInitialized
          ? e.clientX - g.lastMouseX
          : 0;
      const rawDy =
        typeof e.movementY === 'number' && document.pointerLockElement
          ? e.movementY
          : g.mouseInitialized
          ? e.clientY - g.lastMouseY
          : 0;

      g.lastMouseX = e.clientX;
      g.lastMouseY = e.clientY;
      g.mouseInitialized = true;

      // Guard against sudden large cursor jumps when mouse re-enters window or closes a modal
      if (Math.abs(rawDx) > 85 || Math.abs(rawDy) > 85) {
        return;
      }

      const isControllingCharacter =
        (stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') ||
        (stateSnapRef.current.role === 'host' && stateSnapRef.current.screen === 'lobby');

      if (isControllingCharacter) {
        const target = e.target as HTMLElement | null;
        const isOverUiPanel =
          target &&
          target.closest('button, input, select, textarea, .host-lobby-interactive-panel');
        if (!isOverUiPanel) {
          const sens = stateSnapRef.current.lookSensitivity || 1.0;
          g.camYaw -= rawDx * 0.0044 * sens;
          g.camPitch = THREE.MathUtils.clamp(g.camPitch + rawDy * 0.0028 * sens, 0.12, 0.68);
        }
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouchEventTime < 1000) return;
      if (e.button !== 0 || !gameRef.current) return;
      const target = e.target as HTMLElement;
      if (target && target.tagName !== 'CANVAS' && !target.classList.contains('cursor-crosshair')) {
        return;
      }
      gameRef.current.mouseDown = true;
      gameRef.current.lastMouseX = e.clientX;
      gameRef.current.lastMouseY = e.clientY;
      gameRef.current.mouseInitialized = true;
      if (
        (stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') ||
        (stateSnapRef.current.role === 'host' && stateSnapRef.current.screen === 'lobby')
      ) {
        fireShot();
      }
    };

    const handleMouseUp = () => {
      if (!gameRef.current) return;
      gameRef.current.mouseDown = false;
    };

    // Mobile / Tablet Touch-Drag / Free Look on the Right Side of the Screen
    // Swiping or dragging anywhere on the right side of the screen rotates camera, character view, and aiming reticle!
    const handleWindowTouchStart = (e: TouchEvent) => {
      lastTouchEventTime = performance.now();
      const g = gameRef.current;
      const canControlTouchLook =
        (stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') ||
        (stateSnapRef.current.role === 'host' && stateSnapRef.current.screen === 'lobby');
      if (!g || !canControlTouchLook) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('button, input, select, textarea, a, .host-lobby-interactive-panel')
      ) {
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystickTouchIdRef.current) continue;
        // Right side of the screen (or any canvas touch outside the bottom-left joystick zone)
        const isBottomLeftJoystickZone =
          t.clientX < window.innerWidth * 0.35 && t.clientY > window.innerHeight * 0.55;
        if (!isBottomLeftJoystickZone && g.lookTouchId === null) {
          g.lookTouchId = t.identifier;
          g.lookTouchStartX = t.clientX;
          g.lookTouchStartY = t.clientY;
          g.lookTouchLastX = t.clientX;
          g.lookTouchLastY = t.clientY;
          g.mouseScreenX = t.clientX;
          g.mouseScreenY = t.clientY;
          break;
        }
      }
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      lastTouchEventTime = performance.now();
      const g = gameRef.current;
      if (!g || g.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === g.lookTouchId) {
          const dx = t.clientX - g.lookTouchLastX;
          const dy = t.clientY - g.lookTouchLastY;
          g.lookTouchLastX = t.clientX;
          g.lookTouchLastY = t.clientY;
          g.mouseScreenX = t.clientX;
          g.mouseScreenY = t.clientY;
          // Ignore sudden multi-touch coordinate jumps
          if (Math.abs(dx) > 85 || Math.abs(dy) > 85) {
            break;
          }
          const sens = stateSnapRef.current.lookSensitivity || 1.0;
          g.camYaw -= dx * 0.0065 * sens;
          g.camPitch = THREE.MathUtils.clamp(g.camPitch + dy * 0.0042 * sens, 0.12, 0.68);
          break;
        }
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      const g = gameRef.current;
      if (!g || g.lookTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === g.lookTouchId) {
          const dragDist = Math.hypot(
            t.clientX - g.lookTouchStartX,
            t.clientY - g.lookTouchStartY
          );
          g.lookTouchId = null;
          // Quick tap without dragging on the arena canvas fires a paintball
          const target = e.target as HTMLElement | null;
          const isCanvasTap =
            !target ||
            target.tagName === 'CANVAS' ||
            target.classList.contains('cursor-crosshair');
          if (
            dragDist < 12 &&
            isCanvasTap &&
            ((stateSnapRef.current.role === 'player' && stateSnapRef.current.screen === 'game') ||
              (stateSnapRef.current.role === 'host' && stateSnapRef.current.screen === 'lobby'))
          ) {
            fireShot();
          }
          break;
        }
      }
    };

    const handleResize = () => {
      if (!gameRef.current || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      gameRef.current.camera.aspect = aspect;
      // Dynamically adapt FOV to span the arena widely on Mobile & Tablet in both Portrait & Landscape
      if (aspect < 1.0) {
        gameRef.current.camera.fov = THREE.MathUtils.clamp(50 / Math.pow(aspect, 0.42), 54, 72);
      } else if (w < 1200) {
        gameRef.current.camera.fov = 52;
      } else {
        gameRef.current.camera.fov = 48;
      }
      gameRef.current.camera.updateProjectionMatrix();
      gameRef.current.renderer.setSize(w, h);
    };
    handleResize();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchstart', handleWindowTouchStart, { passive: true });
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    // =========================================================
    // MAIN 60FPS ANIMATION LOOP (3D FREE-LOOK CAMERA & RELATIVE MOVEMENT)
    // =========================================================
    let lastTime = performance.now();

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const g = gameRef.current;
      if (!g) return;
      const snapState = stateSnapRef.current;

      // Teacher Jan NPC is visible to students in the Lobby; Host directly controls their own 3D Host Hamster (`localHamster`) in the Lobby!
      if (g.teacherJanNpc) {
        const showTeacherJanInLobby =
          snapState.matchStatus === 'lobby' && snapState.role !== 'host';
        g.teacherJanNpc.visible = showTeacherJanInLobby;
        if (showTeacherJanInLobby) {
          g.teacherJanNpc.position.set(0, 0.32, -10.5);
          g.teacherJanNpc.rotation.y = Math.sin(now * 0.0012) * 0.4;
          animateHamsterRig(g.teacherJanNpc, false, now * 0.002, dt);
        }
      }

      // Animate 3D Health Cans & Defence Cans Around the Arena
      g.powerups.forEach(pu => {
        if (!pu.active && now >= pu.respawnAt) {
          pu.active = true;
          pu.mesh.visible = true;
        }
        if (pu.active && pu.mesh.userData.floater) {
          pu.mesh.userData.floater.rotation.y += dt * 2.4;
          pu.mesh.userData.floater.position.y = 1.12 + Math.sin(now * 0.0045 + pu.x) * 0.16;
          if (pu.mesh.userData.haloRing) {
            pu.mesh.userData.haloRing.rotation.z += dt * 3.2;
          }
        }
      });

      // Keyboard WASD / Arrow Keys + Mobile Virtual Touch Joystick input
      let rawX = g.joyX;
      let rawZ = g.joyZ;
      if (g.keys['w'] || g.keys['arrowup']) rawZ -= 1;
      if (g.keys['s'] || g.keys['arrowdown']) rawZ += 1;
      if (g.keys['a'] || g.keys['arrowleft']) rawX -= 1;
      if (g.keys['d'] || g.keys['arrowright']) rawX += 1;

      const isMoving = Math.hypot(rawX, rawZ) > 0.05;
      if (isMoving) {
        const len = Math.hypot(rawX, rawZ);
        if (len > 1) {
          rawX /= len;
          rawZ /= len;
        }
      }

      // Host controls their 3D character (`Teacher Jan`) freely in the Lobby, and switches to spectator/player-follow camera when the game starts!
      if (snapState.role === 'host' && snapState.screen === 'game') {
        // ---------------------------------------------------
        // HOST TAKES THE CLOSER PLAYER VIEW WHEN CLICKING PLAY
        // Supports Focus on 1 Player ('track_one'), Auto Shuffle ('auto_track'), or Overview
        // ---------------------------------------------------
        g.localHamster.visible = false;
        if (g.aimReticle) g.aimReticle.visible = false;
        if (g.aimLaserLine) g.aimLaserLine.visible = false;

        if (
          snapState.hostCameraMode === 'track_one' ||
          snapState.hostCameraMode === 'auto_track'
        ) {
          const remotes = Array.from(g.remotePlayers.values());
          if (remotes.length > 0) {
            const orderedPlayers = snapState.roomPlayers;
            const targetState =
              orderedPlayers.length > 0
                ? orderedPlayers[snapState.hostFollowIndex % orderedPlayers.length]
                : null;
            const matchedEntry =
              (targetState ? g.remotePlayers.get(targetState.id) : undefined) ||
              remotes[snapState.hostFollowIndex % remotes.length];

            // Show name tags on other players, but hide on the directly followed player so it never blocks the camera!
            remotes.forEach(rp => {
              if (rp.mesh.userData?.nameSprite) {
                rp.mesh.userData.nameSprite.visible = rp !== matchedEntry;
              }
            });

            const tx = matchedEntry.mesh.position.x;
            const tz = matchedEntry.mesh.position.z;
            const tYaw = matchedEntry.mesh.rotation.y || 0;
            const camAspect = camera.aspect || 1.5;
            const portraitOffset =
              camAspect < 1.0 ? Math.min(4.2, (1.0 - camAspect) * 8) : camAspect < 1.4 ? 1.0 : 0;
            // Clear, unobstructed third-person view behind the followed player
            const followDist = 7.4 + portraitOffset * 0.45;
            const followHeight = 4.6 + portraitOffset * 0.35;
            const desiredCamX = THREE.MathUtils.clamp(
              tx - Math.sin(tYaw) * followDist,
              -44,
              44
            );
            const desiredCamZ = THREE.MathUtils.clamp(
              tz - Math.cos(tYaw) * followDist,
              -34,
              34
            );
            const lookX = tx + Math.sin(tYaw) * 11.0;
            const lookZ = tz + Math.cos(tYaw) * 11.0;
            g.hostCamX += (tx - g.hostCamX) * 8 * dt;
            g.hostCamZ += (tz - g.hostCamZ) * 8 * dt;
            camera.position.x += (desiredCamX - camera.position.x) * 8 * dt;
            camera.position.y += (followHeight - camera.position.y) * 8 * dt;
            camera.position.z += (desiredCamZ - camera.position.z) * 8 * dt;
            camera.lookAt(lookX, 1.45, lookZ);
          } else {
            // Bright central arena view when waiting for students
            camera.position.x += (0 - camera.position.x) * 5 * dt;
            camera.position.y += (16.0 - camera.position.y) * 5 * dt;
            camera.position.z += (22.0 - camera.position.z) * 5 * dt;
            camera.lookAt(0, 1.2, 0);
          }
        } else {
          // Ensure all remote player name tags are visible in Overview mode
          g.remotePlayers.forEach(rp => {
            if (rp.mesh.userData?.nameSprite) {
              rp.mesh.userData.nameSprite.visible = true;
            }
          });
          // Host Overview Camera (can pan smoothly with WASD/Arrow keys)
          if (isMoving) {
            g.hostCamX = Math.max(-36, Math.min(36, g.hostCamX + rawX * 24 * dt));
            g.hostCamZ = Math.max(-28, Math.min(28, g.hostCamZ + rawZ * 24 * dt));
          }
          const camAspect = camera.aspect || 1.5;
          const portraitZoomOut = camAspect < 1.0 ? Math.min(10, (1.0 - camAspect) * 18) : 0;
          const targetY = 30 + portraitZoomOut;
          const targetZ = g.hostCamZ + 26 + portraitZoomOut * 0.8;
          camera.position.x += (g.hostCamX - camera.position.x) * 5 * dt;
          camera.position.y += (targetY - camera.position.y) * 5 * dt;
          camera.position.z += (targetZ - camera.position.z) * 5 * dt;
          camera.lookAt(g.hostCamX, 1.2, g.hostCamZ - 2);
        }
      } else {
        // ---------------------------------------------------
        // INTERACTIVE 3D CHARACTER MOVEMENT (STUDENT OR HOST IN LOBBY):
        // CAMERA-RELATIVE MOVEMENT (UP/DOWN/LEFT/RIGHT), MOUSE LOOK & TOUCH FREE LOOK
        // ---------------------------------------------------
        g.localHamster.visible = true;
        const speed = 15.0;

        // Move Up/Down/Left/Right relative to the camera's current facing angle (`g.camYaw`)
        const forwardInput = -rawZ; // Up / W = +1 (forward), Down / S = -1 (backward)
        const rightInput = rawX; // Right / D = +1 (strafe right), Left / A = -1 (strafe left)
        const fwdX = Math.sin(g.camYaw);
        const fwdZ = Math.cos(g.camYaw);
        const rightX = -Math.cos(g.camYaw);
        const rightZ = Math.sin(g.camYaw);

        const moveWorldX = fwdX * forwardInput + rightX * rightInput;
        const moveWorldZ = fwdZ * forwardInput + rightZ * rightInput;

        g.vx = moveWorldX * speed;
        g.vz = moveWorldZ * speed;

        g.x = Math.max(-43, Math.min(43, g.x + g.vx * dt));
        g.z = Math.max(-33, Math.min(33, g.z + g.vz * dt));

        // ENFORCE: When Host starts the game, Red Team players MUST stay first in the Top-Middle Red Square Spawn (0, -26)
        // and Blue Team players MUST stay first in the Bottom-Middle Blue Square Spawn (0, +26) during the opening Spawn Hold!
        if (snapState.matchStatus === 'playing' && Date.now() < snapState.spawnHoldUntil) {
          const isBluePlayer = snapState.myTeam === 'blue';
          const minSpawnX = -8.5;
          const maxSpawnX = 8.5;
          const minSpawnZ = isBluePlayer ? 20.8 : -31.2;
          const maxSpawnZ = isBluePlayer ? 31.2 : -20.8;
          g.x = Math.max(minSpawnX, Math.min(maxSpawnX, g.x));
          g.z = Math.max(minSpawnZ, Math.min(maxSpawnZ, g.z));
        }

        // Accessible Smooth Obstacle Collisions
        g.obstacles.forEach(obs => {
          const dx = g.x - obs.x;
          const dz = g.z - obs.z;
          const d = Math.hypot(dx, dz);
          const minDist = obs.r + 0.85;
          if (d < minDist && d > 0.001) {
            const push = minDist - d;
            g.x += (dx / d) * push;
            g.z += (dz / d) * push;
          }
        });

        // Collectible Health Cans & Defence Cans Around the Arena
        let closestCan: { id: string; type: 'health' | 'shield' } | null = null;
        g.powerups.forEach(pu => {
          if (!pu.active) return;
          const dist = Math.hypot(g.x - pu.x, g.z - pu.z);
          if (dist < 2.6 && !closestCan) {
            closestCan = { id: pu.id, type: pu.type };
          }
          if (dist < 1.95) {
            if (pu.type === 'health' && snapState.healthCans < 3) {
              pu.active = false;
              pu.mesh.visible = false;
              pu.respawnAt = now + 11000;
              sfx.playCanPickup();
              setHealthCans(c => Math.min(3, c + 1));
              setPickupBannerText('🧪 COLLECTED HEALTH CAN! LONG-PRESS CAN BUTTON TO USE!');
              setTimeout(() => setPickupBannerText(null), 2200);
            } else if (pu.type === 'shield' && snapState.shieldCans < 3) {
              pu.active = false;
              pu.mesh.visible = false;
              pu.respawnAt = now + 11000;
              sfx.playCanPickup();
              setShieldCans(c => Math.min(3, c + 1));
              setPickupBannerText('🛡️ COLLECTED DEFENCE CAN! LONG-PRESS CAN BUTTON TO USE!');
              setTimeout(() => setPickupBannerText(null), 2200);
            }
          }
        });
        setNearbyArenaCan(prev =>
          prev?.id === closestCan?.id && prev?.type === closestCan?.type ? prev : closestCan
        );

        // ORBITING 3D THIRD-PERSON CAMERA BEHIND THE HAMSTER (`camYaw` & `camPitch`)
        const camAspect = camera.aspect || 1.5;
        const portraitOffset =
          camAspect < 1.0 ? Math.min(4.2, (1.0 - camAspect) * 8) : camAspect < 1.4 ? 1.0 : 0;
        const camDist = 8.2 + portraitOffset * 0.5;
        const camHeight = 3.2 + g.camPitch * 9.5 + portraitOffset * 0.4;
        const targetCamX = g.x - Math.sin(g.camYaw) * camDist;
        const targetCamY = camHeight;
        const targetCamZ = g.z - Math.cos(g.camYaw) * camDist;
        camera.position.x += (targetCamX - camera.position.x) * 12 * dt;
        camera.position.y += (targetCamY - camera.position.y) * 12 * dt;
        camera.position.z += (targetCamZ - camera.position.z) * 12 * dt;

        const aimDistance = Math.max(5.5, 14.5 - g.camPitch * 11.5);
        g.aimWorldX = g.x + Math.sin(g.camYaw) * aimDistance;
        g.aimWorldZ = g.z + Math.cos(g.camYaw) * aimDistance;
        camera.lookAt(g.aimWorldX, 1.45, g.aimWorldZ);
        camera.updateMatrixWorld();

        // Rotate character view & aiming reticle with camera free-look yaw
        g.rotY = g.camYaw;
        g.localHamster.position.set(g.x, 0, g.z);
        g.localHamster.rotation.y = g.rotY;

        // Converge the 3D Gun Barrel (`markerGroup`) toward the Aim Target so bullets clearly exit along the barrel!
        const ud = g.localHamster.userData;
        if (ud && ud.nameSprite) {
          // Show name badge on Host character in Lobby, hide on Student's own local character so it never blocks crosshair
          ud.nameSprite.visible = snapState.role === 'host';
        }
        if (ud && ud.markerGroup) {
          const aimDist = Math.max(3.2, Math.hypot(g.aimWorldX - g.x, g.aimWorldZ - g.z));
          ud.markerGroup.rotation.y = -Math.atan2(0.82, aimDist);
        }

        g.walkPhase = animateHamsterRig(
          g.localHamster,
          isMoving,
          g.walkPhase,
          dt,
          snapState.holdingCanType,
          true
        );

        // Update 3D 10-Second Respawn Immunity Shield on Local Hamster
        if (ud && ud.immunityShieldGroup) {
          const isLocalImmune = Date.now() < snapState.immuneUntil;
          ud.immunityShieldGroup.visible = isLocalImmune;
          if (isLocalImmune) {
            ud.immunityShieldGroup.rotation.y += dt * 3.2;
          }
        }

        // Update 3D Ground Aim Reticle & Laser Sight Line from Gun Barrel Muzzle (`muzzleTip`)
        if (g.aimReticle && g.aimLaserLine && ud?.muzzleTip) {
          const showAim =
            snapState.screen === 'game' ||
            (snapState.role === 'host' && snapState.screen === 'lobby');
          g.aimReticle.visible = showAim;
          g.aimLaserLine.visible = showAim;
          if (showAim) {
            g.aimReticle.position.set(g.aimWorldX, 0.06, g.aimWorldZ);
            g.aimReticle.rotation.y += dt * 2.5;
            g.localHamster.updateMatrixWorld(true);
            const muzzleWorld = new THREE.Vector3();
            ud.muzzleTip.getWorldPosition(muzzleWorld);
            const posAttr = g.aimLaserLine.geometry.getAttribute(
              'position'
            ) as THREE.BufferAttribute;
            if (posAttr) {
              posAttr.setXYZ(0, muzzleWorld.x, muzzleWorld.y, muzzleWorld.z);
              posAttr.setXYZ(1, g.aimWorldX, 0.12, g.aimWorldZ);
              posAttr.needsUpdate = true;
            }
          }
        }

        // Continuous Rapid Semi-Auto Firing while holding Mouse, Shoot Button, or Spacebar
        if (
          (snapState.screen === 'game' ||
            (snapState.role === 'host' && snapState.screen === 'lobby')) &&
          (g.mouseDown || g.shootButtonHeld || g.keys[' '])
        ) {
          fireShot();
        }
      }

      // Update Projectiles & Collisions (Orient bullet + tail streak along flight vector!)
      for (let i = g.projectiles.length - 1; i >= 0; i--) {
        const p = g.projectiles[i];
        p.vy -= p.gravity * dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.y = Math.atan2(p.vx, p.vz);

        // Emit subtle trailing paint micro-droplets behind flying paintballs
        if (Math.random() < 0.42) {
          const trailDrop = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 6, 6),
            new THREE.MeshBasicMaterial({ color: p.color })
          );
          trailDrop.position.copy(p.mesh.position);
          scene.add(trailDrop);
          g.particles.push({
            mesh: trailDrop,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            vz: (Math.random() - 0.5) * 1.2,
            life: 0,
            maxLife: 0.14
          });
        }

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
            // Friendly fire check in Teams mode during active match
            if (
              snapState.matchStatus === 'playing' &&
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
              // Check if target player has active 10-Second Respawn Immunity!
              if (
                typeof entry.data.immuneUntil === 'number' &&
                Date.now() < entry.data.immuneUntil
              ) {
                sfx.playDamageHit();
                const remSec = Math.max(1, Math.ceil((entry.data.immuneUntil - Date.now()) / 1000));
                setPickupBannerText(
                  `🛡️ ${entry.data.name.toUpperCase()} HAS RESPAWN IMMUNITY (${remSec}s LEFT)!`
                );
                setTimeout(() => setPickupBannerText(null), 1500);
                return;
              }
              sfx.playSplat();
              spawnPaintSplatEffect(scene, g.splatDecals, g.particles, rx, 1.2, rz, p.color);
              // Only award score & apply damage during the active game ('playing')
              if (snapState.matchStatus === 'playing') {
                const hitPts = 20 + Math.min(15, snapState.koStreak * 5);
                setHitsLanded(h => h + 1);
                awardPoints(hitPts, `🎯 PAINT HIT!`, '#38bdf8');
                const hitId = `hit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
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
                if (roomCode) {
                  const lastHitObj = {
                    hitId,
                    targetId: entry.data.id,
                    attackerId: clientIdRef.current,
                    attackerName: snapState.playerName,
                    damage: p.damage
                  };
                  lastNetActionRef.current.lastHit = lastHitObj;
                  const hitPayload = {
                    id: clientIdRef.current,
                    lastHit: lastHitObj
                  };
                  syncPaintballPlayerApi(roomCode, hitPayload);
                  setDoc(
                    getPlayerDocRef(roomCode, clientIdRef.current),
                    { lastHit: lastHitObj },
                    { merge: true }
                  ).catch(() => {});
                }
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
            snapState.matchStatus === 'playing' &&
            snapState.matchMode === 'teams' &&
            p.ownerTeam === snapState.myTeam &&
            p.ownerTeam !== 'solo';
          if (
            !isFriendly &&
            Math.hypot(p.mesh.position.x - g.x, p.mesh.position.z - g.z) < 1.35
          ) {
            hit = true;
            // Enforce 10-Second Respawn Immunity: Local player CANNOT be hit within 10s of respawning!
            if (Date.now() < snapState.immuneUntil) {
              sfx.playDamageHit();
            } else {
              spawnPaintSplatEffect(scene, g.splatDecals, g.particles, g.x, 1.1, g.z, p.color);
              if (snapState.matchStatus === 'playing') {
                applyIncomingDamage(p.damage, p.ownerName || 'Opponent', p.ownerId);
              }
            }
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

      // Guarantee All Remote Players in `roomPlayers` are Always Visible in the 3D Arena!
      snapState.roomPlayers.forEach(rp => {
        if (rp.id !== clientIdRef.current && rp.role === 'player' && !rp.kicked) {
          if (!g.remotePlayers.has(rp.id)) {
            upsertRemotePlayer(rp);
          }
        }
      });

      // Smoothly Interpolate Remote Student Players & Update their 3D Respawn Immunity Shield
      g.remotePlayers.forEach(entry => {
        const dx = entry.data.x - entry.mesh.position.x;
        const dz = entry.data.z - entry.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        entry.mesh.position.x += dx * Math.min(1, dt * 10);
        entry.mesh.position.z += dz * Math.min(1, dt * 10);
        entry.mesh.rotation.y = entry.data.rotY;
        const rUd = entry.mesh.userData;
        if (rUd && rUd.immunityShieldGroup) {
          const isRemoteImmune =
            typeof entry.data.immuneUntil === 'number' && Date.now() < entry.data.immuneUntil;
          rUd.immunityShieldGroup.visible = isRemoteImmune;
          if (isRemoteImmune) {
            rUd.immunityShieldGroup.rotation.y += dt * 3.2;
          }
        }
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
      window.removeEventListener('touchstart', handleWindowTouchStart);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, []);

  // Keep Local Student Hamster's 3D Name Tag, Team Headband & Aim Laser synced when team, skin, role, or screen changes
  useEffect(() => {
    // Do not rebuild 60-mesh 3D hamster on every keystroke while typing name in the Join modal!
    if (screen === 'join') return;
    const g = gameRef.current;
    if (!g) return;
    const isHostRole = role === 'host';
    const activeTeam: TeamId =
      matchMode === 'solo' ? 'solo' : myTeam === 'blue' ? 'blue' : 'red';
    const localLabel = isHostRole
      ? 'Teacher Jan'
      : activeTeam !== 'solo'
      ? `[${activeTeam.toUpperCase()}] ${playerName || 'Student'}`
      : playerName || 'Student';
    g.scene.remove(g.localHamster);
    const updatedHamster = buildHighDefHamster(
      selectedSkinIdx,
      localLabel,
      isHostRole,
      activeTeam
    );
    updatedHamster.position.set(g.x, 0, g.z);
    updatedHamster.rotation.y = g.rotY;
    updatedHamster.visible = !(isHostRole && screen === 'game');
    g.scene.add(updatedHamster);
    g.localHamster = updatedHamster;

    const aimColorNum = resolveTeamPaintColor(activeTeam, undefined, selectedSkinIdx);
    if (g.aimReticle) {
      g.aimReticle.visible = !isHostRole || screen === 'lobby';
      const outerMesh = g.aimReticle.children[0] as THREE.Mesh;
      if (outerMesh && outerMesh.material) {
        (outerMesh.material as THREE.MeshBasicMaterial).color.setHex(aimColorNum);
      }
    }
    if (g.aimLaserLine) {
      g.aimLaserLine.visible = !isHostRole || screen === 'lobby';
      (g.aimLaserLine.material as THREE.LineBasicMaterial).color.setHex(aimColorNum);
    }
  }, [selectedSkinIdx, myTeam, matchMode, role, screen]);

  // -------------------------------------------------------------
  // 7. FIRE PAINTBALL DIRECTLY OUT OF THE 3D GUN BARREL MUZZLE & EARN AMMO VIA QUESTIONS
  // -------------------------------------------------------------
  const fireShot = () => {
    const g = gameRef.current;
    const snap = stateSnapRef.current;
    if (!g || snap.role !== 'player' || snap.screen !== 'game') return;
    const now = performance.now();
    if (now - g.lastShotTime < 185) return;

    const isPlayingMatch = snap.matchStatus === 'playing';

    // During the Lobby ('lobby'), players can shoot freely!
    // During the active Game ('playing'), players must answer questions to gain paintballs.
    if (isPlayingMatch) {
      if (snap.ammo <= 0) {
        g.shootButtonHeld = false;
        g.mouseDown = false;
        setIsQuestionModalOpen(true);
        return;
      }
      setAmmo(a => Math.max(0, a - 1));
    }

    g.lastShotTime = now;
    sfx.playMarkerShot();

    // Enforce: Red Team ALWAYS fires Red Paint (0xef4444) and Blue Team ALWAYS fires Blue Paint (0x2563eb)!
    const activeTeam: TeamId =
      snap.matchMode === 'solo'
        ? 'solo'
        : snap.myTeam === 'blue'
        ? 'blue'
        : 'red';
    const teamPaint = resolveTeamPaintColor(activeTeam, undefined, snap.selectedSkinIdx);

    // 1. Face the Hamster toward the Aim Target & Align Gun Barrel
    const dx = g.aimWorldX - g.x;
    const dz = g.aimWorldZ - g.z;
    const aimDist = Math.hypot(dx, dz);
    const bodyAngle = aimDist > 0.25 ? Math.atan2(dx, dz) : g.rotY;
    g.rotY = bodyAngle;
    g.localHamster.position.set(g.x, 0, g.z);
    g.localHamster.rotation.y = bodyAngle;

    // 2. Compute Exact 3D World Position of the Gun Barrel Tip (`muzzleTip`) BEFORE applying kickback!
    const muzzleWorldPos = new THREE.Vector3(
      g.x + Math.sin(bodyAngle) * 1.65,
      1.32,
      g.z + Math.cos(bodyAngle) * 1.65
    );
    const ud = g.localHamster.userData;
    if (ud) {
      if (ud.markerGroup) {
        ud.markerGroup.position.z = 0.55;
        ud.markerGroup.rotation.x = 0;
        ud.markerGroup.rotation.y = -Math.atan2(0.82, Math.max(3.2, aimDist));
      }
      g.localHamster.updateMatrixWorld(true);
      if (ud.muzzleTip) {
        ud.muzzleTip.getWorldPosition(muzzleWorldPos);
      }
      // Trigger mechanical bolt cycle, chambered ball feed & 3D muzzle flash!
      ud.recoil = 1.0;
    }

    // 3. Calculate Exact Trajectory from the Gun Barrel Tip (`muzzleWorldPos`) to Target Crosshair!
    const shotAngle =
      aimDist > 2.4
        ? Math.atan2(g.aimWorldX - muzzleWorldPos.x, g.aimWorldZ - muzzleWorldPos.z)
        : bodyAngle;

    // 4. Spawn 3D Paintball Projectile + Aerodynamic Streak directly out of the Gun Barrel Nozzle!
    const ball = createPaintballProjectileMesh(teamPaint);
    ball.position.copy(muzzleWorldPos);
    ball.rotation.y = shotAngle;
    g.scene.add(ball);

    // 5. Spawn 3D Pressurized CO2 Gas & Paint Mist Burst at the Gun Barrel Nozzle!
    spawnGunMuzzleBlastEffect(g.scene, g.particles, muzzleWorldPos, shotAngle, teamPaint);

    g.projectiles.push({
      ownerId: clientIdRef.current,
      ownerName: snap.playerName || 'Student',
      ownerTeam: activeTeam,
      mesh: ball,
      vx: Math.sin(shotAngle) * 40,
      vy: 1.65,
      vz: Math.cos(shotAngle) * 40,
      gravity: 9.2,
      damage: 28,
      color: teamPaint
    });

    if (g.broadcastChannel) {
      try {
        g.broadcastChannel.postMessage({
          type: 'fire_shot',
          id: clientIdRef.current,
          ownerId: clientIdRef.current,
          ownerName: snap.playerName || 'Student',
          ownerTeam: activeTeam,
          x: g.x,
          z: g.z,
          angle: shotAngle,
          paintColor: teamPaint
        });
      } catch {}
    }

    if (roomCode) {
      const shotId = `shot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const lastShotObj = {
        shotId,
        x: Number(g.x.toFixed(2)),
        z: Number(g.z.toFixed(2)),
        angle: Number(shotAngle.toFixed(2)),
        paintColor: teamPaint
      };
      lastNetActionRef.current.lastShot = lastShotObj;
      syncPaintballPlayerApi(roomCode, {
        id: clientIdRef.current,
        lastShot: lastShotObj
      });
      setDoc(
        getPlayerDocRef(roomCode, clientIdRef.current),
        { lastShot: lastShotObj },
        { merge: true }
      ).catch(() => {});
    }
  };

  // Teacher Host Action: Auto-Group / Shuffle Joined Players into Red & Blue Teams (and place at Top-Middle & Bottom-Middle Spawn Bases)
  const handleShuffleTeams = async () => {
    sfx.playCorrect();
    const teamCycle: TeamId[] = ['red', 'blue'];
    const shuffled = [...roomPlayers].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      const assigned = teamCycle[i % teamCycle.length];
      const sp = getTeamSpawnPosition(assigned, 'teams', Math.floor(i / 2));
      const updatePatch = {
        team: assigned,
        x: sp.x,
        z: sp.z,
        rotY: sp.rotY,
        updatedAt: Date.now()
      };
      syncPaintballPlayerApi(
        roomCode,
        { id: shuffled[i].id, ...updatePatch },
        { isHostAction: true }
      );
      const pRef = getPlayerDocRef(roomCode, shuffled[i].id);
      setDoc(pRef, updatePatch, { merge: true }).catch(() => {});
    }
    pushLiveEvent('🔀 Host grouped & shuffled players into Top Middle (Red) & Bottom Middle (Blue) Spawns!', '#38bdf8');
  };

  // Teacher Host Action: Move a specific student to Red or Blue Team (and teleport to team's Top/Bottom Middle Spawn Area)
  const handleMovePlayerTeam = (player: PlayerNetworkState, targetTeam?: TeamId) => {
    sfx.playCorrect();
    const nextTeam: TeamId =
      targetTeam || (player.team === 'red' ? 'blue' : 'red');
    const sp = getTeamSpawnPosition(nextTeam, 'teams');
    const updatePatch = {
      team: nextTeam,
      x: sp.x,
      z: sp.z,
      rotY: sp.rotY,
      updatedAt: Date.now()
    };
    syncPaintballPlayerApi(
      roomCode,
      { id: player.id, ...updatePatch },
      { isHostAction: true }
    );
    const pRef = getPlayerDocRef(roomCode, player.id);
    setDoc(pRef, updatePatch, { merge: true }).catch(() => {});
    pushLiveEvent(
      `⇄ Host moved ${player.name} to ${TEAM_CONFIG[nextTeam].label} (${nextTeam === 'red' ? 'Top Middle' : 'Bottom Middle'} Spawn)!`,
      nextTeam === 'red' ? '#f43f5e' : '#38bdf8'
    );
  };

  // Teacher Host Action: Delete / Remove a specific student from the Lobby & 3D Park
  const handleDeletePlayer = (player: PlayerNetworkState) => {
    sfx.playWrong();
    syncPaintballPlayerApi(
      roomCode,
      { id: player.id, kicked: true, updatedAt: Date.now() },
      { isHostAction: true }
    );
    setTimeout(() => {
      deletePaintballPlayerApi(roomCode, player.id);
    }, 600);
    const pRef = getPlayerDocRef(roomCode, player.id);
    // Mark kicked so the student's client immediately returns to Join screen, then delete doc
    setDoc(pRef, { kicked: true, updatedAt: Date.now() }, { merge: true })
      .then(() => {
        setTimeout(() => {
          deleteDoc(pRef).catch(() => {});
        }, 600);
      })
      .catch(() => {
        deleteDoc(pRef).catch(() => {});
      });

    if (gameRef.current?.broadcastChannel) {
      try {
        gameRef.current.broadcastChannel.postMessage({
          type: 'kick_player',
          id: clientIdRef.current,
          targetId: player.id
        });
      } catch {}
    }

    // Immediately remove from local Host UI & 3D scene
    setRoomPlayers(prev => prev.filter(p => p.id !== player.id));
    if (gameRef.current?.remotePlayers.has(player.id)) {
      const entry = gameRef.current.remotePlayers.get(player.id);
      if (entry) gameRef.current.scene.remove(entry.mesh);
      gameRef.current.remotePlayers.delete(player.id);
    }
    pushLiveEvent(`🗑️ Host removed ${player.name} from the lobby.`, '#f43f5e');
  };

  // Teacher Host Action: Start Match & Place All Red Players in Top-Middle Red Spawn and Blue Players in Bottom-Middle Blue Spawn
  const handleStartMultiplayerMatch = () => {
    const startTs = Date.now();
    lastStartedAtRef.current = startTs;
    sfx.playKO();
    sfx.startMusic();
    setMatchStatus('playing');
    setIsTimerPaused(false);
    setMatchSeconds(configuredDurationSec);
    setHostCameraMode('auto_track');
    setHostFollowIndex(0);
    setScreen('game');

    // Place ALL joined players into their Top-Middle Red Square Spawn (0, -26) or Bottom-Middle Blue Square Spawn (0, +26) first!
    let redSlot = 0;
    let blueSlot = 0;
    const updatedPlayers: PlayerNetworkState[] = roomPlayers.map(p => {
      const assignedTeam: TeamId =
        matchMode === 'solo'
          ? 'solo'
          : p.team === 'blue'
          ? 'blue'
          : 'red';
      const slot = assignedTeam === 'blue' ? blueSlot++ : redSlot++;
      const sp = getTeamSpawnPosition(assignedTeam, matchMode, slot);
      const nextP: PlayerNetworkState = {
        ...p,
        team: assignedTeam,
        x: sp.x,
        z: sp.z,
        rotY: sp.rotY,
        hp: 100,
        shield: 100,
        score: 0,
        kos: 0,
        hitsLanded: 0,
        bestStreak: 0,
        immuneUntil: 0,
        updatedAt: startTs
      };
      if (roomCode) {
        const playerResetPatch = {
          team: assignedTeam,
          x: sp.x,
          z: sp.z,
          rotY: sp.rotY,
          hp: 100,
          shield: 100,
          score: 0,
          kos: 0,
          hitsLanded: 0,
          bestStreak: 0,
          immuneUntil: 0,
          matchStartResetAt: startTs,
          updatedAt: startTs
        };
        syncPaintballPlayerApi(
          roomCode,
          { id: p.id, ...playerResetPatch },
          { isHostAction: true }
        );
        setDoc(
          getPlayerDocRef(roomCode, p.id),
          playerResetPatch,
          { merge: true }
        ).catch(() => {});
      }
      upsertRemotePlayer(nextP);
      return nextP;
    });
    if (updatedPlayers.length > 0) {
      setRoomPlayers(updatedPlayers);
    }

    const startEv: LiveFeedEvent = {
      id: `start-${startTs}`,
      text: `🚀 Match Started! Red Team in Top-Middle Spawn & Blue Team in Bottom-Middle Spawn (${ballsPerQuestion} Balls/Question)!`,
      color: '#a3e635',
      timestamp: startTs
    };
    setLiveEvents(prev => [startEv, ...prev]);

    const bcChannel = broadcastChannelRef.current || gameRef.current?.broadcastChannel;
    if (bcChannel) {
      try {
        bcChannel.postMessage({
          type: 'match_start',
          id: clientIdRef.current,
          startedAt: startTs,
          matchMode,
          durationSec: configuredDurationSec,
          ballsPerQuestion,
          quizTitle: activeQuiz.title || activeQuiz.topic || 'Hamster Paintball',
          topic: activeQuiz.topic || '',
          classLevel: activeQuiz.classLevel || '',
          questions: effectiveQuestions
        });
      } catch {}
    }

    if (roomCode) {
      const startRoomPayload = {
        matchStatus: 'playing',
        matchMode,
        configuredDurationSec,
        ballsPerQuestion,
        isTimerPaused: false,
        timerSyncSeconds: configuredDurationSec,
        timerSyncedAt: startTs,
        quizTitle: activeQuiz.title || activeQuiz.topic || 'Hamster Paintball',
        topic: activeQuiz.topic || '',
        classLevel: activeQuiz.classLevel || '',
        questions: effectiveQuestions,
        startedAt: startTs,
        latestEvent: startEv
      };
      syncPaintballRoomApi(roomCode, startRoomPayload);
      setDoc(
        getRoomDocRef(roomCode),
        startRoomPayload,
        { merge: true }
      ).catch(() => {});
    }
  };

  // Teacher Host Action: Update Balls Per Question (Lobby & Live Game) & Sync Immediately
  const handleHostUpdateBallsPerQuestion = (nextCount: number) => {
    const clamped = Math.max(1, Math.min(50, Math.round(nextCount)));
    sfx.playCorrect();
    setBallsPerQuestion(clamped);
    stateSnapRef.current.ballsPerQuestion = clamped;

    const bcChannel = broadcastChannelRef.current || gameRef.current?.broadcastChannel;
    if (bcChannel) {
      try {
        bcChannel.postMessage({
          type: 'balls_config',
          id: clientIdRef.current,
          ballsPerQuestion: clamped
        });
      } catch {}
    }

    if (roomCode) {
      const patch = {
        ballsPerQuestion: clamped,
        updatedAt: Date.now()
      };
      syncPaintballRoomApi(roomCode, patch);
      setDoc(
        getRoomDocRef(roomCode),
        patch,
        { merge: true }
      ).catch(() => {});
    }
  };

  // Teacher Host Live Timer Controls: Add +30 Seconds or Pause/Resume Match Timer
  const handleHostAddTime = (extraSeconds: number = 30) => {
    sfx.playCorrect();
    setMatchSeconds(prev => {
      const next = prev + extraSeconds;
      if (gameRef.current?.broadcastChannel) {
        try {
          gameRef.current.broadcastChannel.postMessage({
            type: 'timer_control',
            id: clientIdRef.current,
            matchSeconds: next,
            isTimerPaused
          });
        } catch {}
      }
      if (roomCode) {
        const timerPatch = {
          timerSyncSeconds: next,
          timerSyncedAt: Date.now(),
          isTimerPaused
        };
        syncPaintballRoomApi(roomCode, timerPatch);
        setDoc(
          getRoomDocRef(roomCode),
          timerPatch,
          { merge: true }
        ).catch(() => {});
      }
      return next;
    });
    pushLiveEvent(`⏱️ Host added +${extraSeconds}s to the Match Timer!`, '#38bdf8');
  };

  const handleHostTogglePauseTimer = () => {
    sfx.playTimerTick(false);
    setIsTimerPaused(prev => {
      const nextPaused = !prev;
      if (gameRef.current?.broadcastChannel) {
        try {
          gameRef.current.broadcastChannel.postMessage({
            type: 'timer_control',
            id: clientIdRef.current,
            matchSeconds,
            isTimerPaused: nextPaused
          });
        } catch {}
      }
      if (roomCode) {
        const timerPatch = {
          timerSyncSeconds: matchSeconds,
          timerSyncedAt: Date.now(),
          isTimerPaused: nextPaused
        };
        syncPaintballRoomApi(roomCode, timerPatch);
        setDoc(
          getRoomDocRef(roomCode),
          timerPatch,
          { merge: true }
        ).catch(() => {});
      }
      pushLiveEvent(
        nextPaused ? '⏸️ Host paused the Match Timer.' : '▶️ Host resumed the Match Timer!',
        '#facc15'
      );
      return nextPaused;
    });
  };

  // Teacher Host Action: End Match & Show Final Standings
  const handleEndMatch = () => {
    sfx.playKO();
    setMatchStatus('results');
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
      const endPatch = { matchStatus: 'results', endedAt: Date.now() };
      syncPaintballRoomApi(roomCode, endPatch);
      setDoc(
        getRoomDocRef(roomCode),
        endPatch,
        { merge: true }
      ).catch(() => {});
    }
  };

  // Trivia Answer Handler (Upgraded Points System: Base +15 PTS + Streak Multiplier Bonus + Fast-Answer Speed Bonus!)
  const handleTriviaAnswer = (optIdx: number) => {
    if (triviaFeedback !== null) return;
    const qList = effectiveQuestions;
    const currentQ = qList[triviaDeckIndex % qList.length];
    if (!currentQ) return;

    setSelectedOptionIdx(optIdx);
    const correctIdx =
      typeof currentQ.answerIndex === 'number' && !Number.isNaN(currentQ.answerIndex)
        ? currentQ.answerIndex
        : 0;

    if (Number(optIdx) === Number(correctIdx)) {
      const nextStreak = triviaStreak + 1;
      const basePts = 15;
      const streakBonusPts = Math.min(25, triviaStreak * 5);
      const speedBonusPts = questionTimeLeft >= 10 ? 10 : questionTimeLeft >= 5 ? 5 : 0;
      const totalEarnedPts = basePts + streakBonusPts + speedBonusPts;
      const earnedBalls = stateSnapRef.current.ballsPerQuestion || ballsPerQuestion || 10;

      sfx.playScoreCombo(nextStreak);
      setTriviaStreak(nextStreak);
      setBestStreak(b => Math.max(b, nextStreak));
      setAmmo(a => a + earnedBalls);
      setQuestionsAnswered(q => q + 1);
      awardPoints(
        totalEarnedPts,
        speedBonusPts > 0
          ? `⚡ FAST +${totalEarnedPts} PTS (${nextStreak}x)`
          : `✅ +${totalEarnedPts} PTS (${nextStreak}x)`,
        '#a3e635'
      );

      const bonusBreakdown: string[] = [`+${basePts} Base`];
      if (streakBonusPts > 0) bonusBreakdown.push(`+${streakBonusPts} Streak (${nextStreak}x)`);
      if (speedBonusPts > 0) bonusBreakdown.push(`+${speedBonusPts} Speed Bonus`);

      setTriviaFeedback(
        `✅ CORRECT! +${earnedBalls} Paintballs & +${totalEarnedPts} PTS (${bonusBreakdown.join(' • ')})!`
      );

      const evText = `🎯 ${playerName} answered in ${QUESTION_TIME_LIMIT_SEC - questionTimeLeft}s (+${earnedBalls} Balls & +${totalEarnedPts} PTS • ${nextStreak}x Streak)!`;
      pushLiveEvent(evText, '#a3e635');
      if (roomCode) {
        setDoc(
          getRoomDocRef(roomCode),
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
      }

      setTimeout(() => {
        setTriviaFeedback(null);
        setSelectedOptionIdx(null);
        setTriviaDeckIndex(i => i + 1);
      }, 750);
    } else {
      sfx.playWrong();
      setTriviaStreak(0);
      const rightOptParsed = parseOptionContent(currentQ.options[correctIdx] || '');
      const rightLabel = rightOptParsed.text || OPTION_LETTERS[correctIdx] || ' Option';
      setTriviaFeedback(
        `❌ Incorrect! Streak reset. Correct answer: ${OPTION_LETTERS[correctIdx]}. ${rightLabel}`
      );
      setTimeout(() => {
        setTriviaFeedback(null);
        setSelectedOptionIdx(null);
        setTriviaDeckIndex(i => i + 1);
      }, 1100);
    }
  };

  const currentTriviaQ = effectiveQuestions[triviaDeckIndex % effectiveQuestions.length];

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
    <div
      id="paintball-game-container"
      className="fixed inset-0 z-[60] w-full h-full max-w-full max-h-full xl:relative xl:inset-auto xl:z-auto xl:w-full xl:h-full flex-1 min-h-0 bg-slate-900 overflow-hidden font-sans select-none text-slate-100 touch-manipulation"
    >
      {/* 3D WebGL Canvas Layer (Supports Laptop Mouse Free-Look & Mobile Right-Side Touch-Drag Free-Look) */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 w-full h-full z-0 cursor-crosshair touch-none"
      />

      {/* -------------------------------------------------------------
          TOP ARCADE NAVIGATION HEADER (SINGLE-LINE NON-OVERLAPPING ON MOBILE & TABLET)
         ------------------------------------------------------------- */}
      <div className="absolute top-1.5 sm:top-2 inset-x-2 sm:inset-x-3 z-30 flex items-center justify-between pointer-events-none gap-1.5 flex-nowrap">
        <button
          onClick={() => {
            if (role === 'player' && roomCode) {
              hasJoinedRoomRef.current = false;
              deletePaintballPlayerApi(roomCode, clientIdRef.current);
              deleteDoc(getPlayerDocRef(roomCode, clientIdRef.current)).catch(() => {});
            }
            onViewChange('games');
          }}
          className="pointer-events-auto shrink-0 flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-extrabold text-[11px] sm:text-xs border border-white/20 shadow-xl transition active:scale-95 cursor-pointer"
        >
          <ArrowLeft size={14} className="text-lime-400" />
          <span>Back</span>
        </button>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 flex-nowrap justify-end min-w-0">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="shrink-0 px-2.5 sm:px-3 h-8 sm:h-9 rounded-xl sm:rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white border border-white/20 flex items-center gap-1.5 transition shadow-lg cursor-pointer text-[11px] sm:text-xs font-black"
            title="Game Settings & Look Sensitivity"
          >
            <Settings size={14} className="text-cyan-400" />
            <span>Settings</span>
          </button>

          <FullscreenButton
            targetId="paintball-game-container"
            showLabel
            className="shrink-0 bg-slate-900/95 hover:bg-slate-800 text-white border border-lime-400/40 shadow-lg text-[11px] sm:text-xs px-2.5 sm:px-3 py-1.5"
          />
        </div>
      </div>

      {/* -------------------------------------------------------------
          GAME SETTINGS MODAL (LOOK SENSITIVITY & AUDIO CONTROLS)
         ------------------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-cyan-400/50 rounded-3xl shadow-2xl w-full max-w-md p-5 text-white relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-cyan-400" />
                <h2 className="font-black text-lg tracking-tight">GAME SETTINGS</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Look Sensitivity Slider & Presets */}
            <div className="bg-slate-800/90 rounded-2xl p-4 border border-white/10 mb-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300">
                  Look Sensitivity (Mouse &amp; Touch-Drag)
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 font-mono font-black text-xs text-cyan-200">
                  {Math.round(lookSensitivity * 100)}%
                </span>
              </div>

              <input
                type="range"
                min={0.2}
                max={2.5}
                step={0.05}
                value={lookSensitivity}
                onChange={e => setLookSensitivity(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-950 rounded-lg"
              />

              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {[
                  { label: 'Low', val: 0.6 },
                  { label: 'Normal', val: 1.0 },
                  { label: 'High', val: 1.5 },
                  { label: 'Ultra', val: 2.0 }
                ].map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setLookSensitivity(preset.val)}
                    className={`py-1.5 rounded-xl font-black text-xs border transition cursor-pointer ${
                      Math.abs(lookSensitivity - preset.val) < 0.06
                        ? 'bg-cyan-400 text-slate-950 border-white shadow'
                        : 'bg-slate-900/90 text-slate-300 border-white/10 hover:bg-slate-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-slate-400 mt-2.5 leading-snug">
                • <b>Laptop:</b> Move with <b>W/A/S/D</b> or <b>Arrow Keys</b>; move mouse to rotate view &amp; aim.
                <br />• <b>Mobile / Tablet:</b> Swipe or drag on the <b>right side of the screen</b> to free-look.
              </p>
            </div>

            {/* Audio Quick Toggles */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => setMusicEnabled(!musicEnabled)}
                className={`py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-2 cursor-pointer transition ${
                  musicEnabled
                    ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200'
                    : 'bg-slate-800 border-white/10 text-slate-400'
                }`}
              >
                <span>{musicEnabled ? '🎵 Music: ON' : '🔇 Music: OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`py-2.5 px-3 rounded-xl font-black text-xs border flex items-center justify-center gap-2 cursor-pointer transition ${
                  soundEnabled
                    ? 'bg-lime-600/30 border-lime-400 text-lime-200'
                    : 'bg-slate-800 border-white/10 text-slate-400'
                }`}
              >
                <span>{soundEnabled ? '🔊 SFX: ON' : '🔈 SFX: OFF'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-sm shadow-lg transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 1: QUIZ EDITOR (EXACT BUBBLE POP GAME SETUP DESIGN)
         ------------------------------------------------------------- */}
      {screen === 'editor' && (
        <div className="absolute inset-0 z-50 w-full h-full overflow-y-auto bg-[#f4f7f9] pt-14 pb-10">
          <QuizEditor
            quiz={activeQuiz}
            folders={folders}
            onSave={q => saveQuiz(q, 'lobby')}
            onPlayLobby={q => saveQuiz(q, 'lobby')}
            onCancel={() => {
              if (!initialGame?.customQuestions && activeQuiz.questions.length === 0) {
                onViewChange('games');
              } else {
                setScreen('lobby');
              }
            }}
          />
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 2: MINIMALIST STUDENT LOBBY (3D CHARACTERS & COMPACT JOIN)
         ------------------------------------------------------------- */}
      {screen === 'join' && (
        <div className="absolute inset-0 z-40 w-full h-full bg-slate-900/35 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 pt-12 pb-3 overflow-y-auto">
          <div className="bg-white/95 rounded-3xl shadow-2xl w-full max-w-[520px] max-h-[86dvh] overflow-y-auto p-4 sm:p-5 flex flex-col items-center border border-slate-200 relative text-slate-900 my-auto">
            <h1 className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 mb-3">
              HAMSTER PAINTBALL
            </h1>

            {/* 3D CHARACTER GRID (MINIMALIST — 3D RENDER + NAME ONLY) */}
            <div className="w-full bg-slate-100/90 rounded-2xl p-2 mb-3 border border-slate-200/80">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[220px] sm:max-h-[250px] overflow-y-auto pr-0.5">
                {HAMSTER_SKINS.map((skin, idx) => {
                  const isSelected = idx === selectedSkinIdx;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => {
                        setSelectedSkinIdx(idx);
                        sfx.playCorrect();
                      }}
                      className={`p-1.5 rounded-2xl border-2 flex flex-col items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/90 shadow-md scale-[1.02]'
                          : 'border-transparent bg-white hover:bg-slate-50'
                      }`}
                    >
                      <HamsterCharacterAvatar
                        skin={skin}
                        size={54}
                        team={matchMode === 'teams' ? myTeam : 'solo'}
                      />
                      <span className="mt-0.5 font-extrabold text-[10px] text-slate-800 leading-tight text-center truncate w-full">
                        {skin.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minimalist Name & Room Code Row (16px text-base prevents mobile browser zoom!) */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
              <input
                type="text"
                maxLength={16}
                value={playerName === 'Teacher Jan' ? '' : playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Name"
                className="sm:col-span-2 h-11 px-3.5 text-center sm:text-left text-base font-extrabold text-slate-800 bg-white border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600 transition"
              />
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={e =>
                  setRoomCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6))
                }
                placeholder="Code"
                className="h-11 px-2 text-center font-mono text-base sm:text-lg font-black tracking-widest text-slate-900 bg-slate-50 border-2 border-slate-300 rounded-xl focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Minimalist Team Toggle */}
            <div className="w-full grid grid-cols-2 gap-2 mb-3">
              {(['red', 'blue'] as TeamId[]).map(tId => (
                <button
                  key={tId}
                  type="button"
                  onClick={() => setMyTeam(tId)}
                  className={`py-2 px-3 rounded-xl font-black text-xs uppercase border-2 transition cursor-pointer ${
                    myTeam === tId
                      ? tId === 'red'
                        ? 'bg-rose-600 text-white border-rose-700 shadow'
                        : 'bg-sky-600 text-white border-sky-700 shadow'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {tId === 'red' ? 'Red Team' : 'Blue Team'}
                </button>
              ))}
            </div>

            {/* Join Button */}
            <button
              type="button"
              onClick={() => {
                const cleanCode = roomCode.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
                if (!cleanCode) return;
                // Blur active input & reset scroll so mobile Safari/Chrome never stays zoomed in
                if (document.activeElement instanceof HTMLElement) {
                  document.activeElement.blur();
                }
                window.scrollTo(0, 0);

                const cleanName =
                  playerName.trim() && playerName.trim() !== 'Teacher Jan'
                    ? playerName.trim()
                    : `Hamster${Math.floor(10 + Math.random() * 89)}`;
                setRoomCode(cleanCode);
                setPlayerName(cleanName);
                setRole('player');
                setIsQuestionModalOpen(false);
                hasJoinedRoomRef.current = true;
                sfx.playCorrect();

                // Spawn student in their team's Top Middle (Red) or Bottom Middle (Blue) Square Spawn Area!
                const g = gameRef.current;
                const sp = getTeamSpawnPosition(myTeam, matchMode);
                if (g) {
                  g.x = sp.x;
                  g.z = sp.z;
                  g.rotY = sp.rotY;
                  g.camYaw = sp.rotY;
                  g.camPitch = 0.28;
                }

                // Transition IMMEDIATELY (0ms delay) into the 3D Park Lobby while network sync runs in background!
                setMatchStatus('lobby');
                setScreen('game');

                // Immediately register this player in both the Server API & Firestore so the Host sees them in the Live Park Lobby!
                const initialPayload: PlayerNetworkState = {
                  id: clientIdRef.current,
                  name: cleanName,
                  role: 'player',
                  team: matchMode === 'solo' ? 'solo' : myTeam,
                  skinIdx: selectedSkinIdx,
                  x: sp.x,
                  z: sp.z,
                  rotY: sp.rotY,
                  hp: 100,
                  shield: 100,
                  score,
                  kos,
                  questionsAnswered,
                  kicked: false,
                  updatedAt: Date.now()
                };

                syncPaintballPlayerApi(cleanCode, initialPayload);

                setDoc(
                  getPlayerDocRef(cleanCode, clientIdRef.current),
                  {
                    ...initialPayload,
                    lastSeen: serverTimestamp()
                  },
                  { merge: true }
                ).catch(() => {});

                // Fetch room state & normalized custom questions in background (Server API first, Firestore fallback)
                (async () => {
                  let loadedFromApi = false;
                  try {
                    const res = await fetch(`/api/paintball/room/${encodeURIComponent(cleanCode)}`);
                    if (res.ok) {
                      const json = await res.json();
                      const data = json?.room;
                      if (data) {
                        loadedFromApi = true;
                        if (Array.isArray(data.questions) && data.questions.length > 0) {
                          const normQs = normalizePaintballQuestions(data.questions);
                          if (normQs.length > 0) {
                            setActiveQuiz(prev => ({
                              ...prev,
                              title: data.quizTitle || prev.title,
                              topic: data.topic || prev.topic,
                              classLevel: data.classLevel || prev.classLevel,
                              questions: normQs
                            }));
                            setTriviaDeckIndex(0);
                          }
                        }
                        if (typeof data.ballsPerQuestion === 'number' && data.ballsPerQuestion > 0) {
                          setBallsPerQuestion(data.ballsPerQuestion);
                          stateSnapRef.current.ballsPerQuestion = data.ballsPerQuestion;
                        }
                        if (data.matchMode) {
                          setMatchMode(data.matchMode);
                        }
                        if (data.matchStatus === 'playing') {
                          triggerStudentMatchStart(
                            data.configuredDurationSec || 180,
                            data.matchMode || matchMode,
                            typeof data.startedAt === 'number' ? data.startedAt : Date.now(),
                            Boolean(data.isTimerPaused),
                            typeof data.ballsPerQuestion === 'number'
                              ? data.ballsPerQuestion
                              : undefined
                          );
                        }
                      }
                      if (Array.isArray(json?.players)) {
                        const validRemote = (json.players as PlayerNetworkState[]).filter(
                          p => p && p.id && p.role === 'player' && !p.kicked
                        );
                        setRoomPlayers(validRemote);
                        validRemote.forEach(p => {
                          if (p.id !== clientIdRef.current) {
                            upsertRemotePlayer(p);
                          }
                        });
                      }
                    }
                  } catch {}

                  if (!loadedFromApi) {
                    try {
                      const snap = await getDoc(getRoomDocRef(cleanCode));
                      if (snap.exists()) {
                        const data = snap.data();
                        if (Array.isArray(data.questions) && data.questions.length > 0) {
                          const normQs = normalizePaintballQuestions(data.questions);
                          if (normQs.length > 0) {
                            setActiveQuiz(prev => ({
                              ...prev,
                              title: data.quizTitle || prev.title,
                              topic: data.topic || prev.topic,
                              classLevel: data.classLevel || prev.classLevel,
                              questions: normQs
                            }));
                            setTriviaDeckIndex(0);
                          }
                        }
                        if (typeof data.ballsPerQuestion === 'number' && data.ballsPerQuestion > 0) {
                          setBallsPerQuestion(data.ballsPerQuestion);
                          stateSnapRef.current.ballsPerQuestion = data.ballsPerQuestion;
                        }
                        if (data.matchMode) {
                          setMatchMode(data.matchMode);
                        }
                        if (data.matchStatus === 'playing') {
                          triggerStudentMatchStart(
                            data.configuredDurationSec || 180,
                            data.matchMode || matchMode,
                            typeof data.startedAt === 'number' ? data.startedAt : Date.now(),
                            Boolean(data.isTimerPaused),
                            typeof data.ballsPerQuestion === 'number'
                              ? data.ballsPerQuestion
                              : undefined
                          );
                        }
                      }
                    } catch {}
                  }
                })();
              }}
              className="w-full py-3 bg-[#160269] hover:bg-[#220699] active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-xl shadow-lg transition flex items-center justify-center gap-2 border-b-4 border-[#0c013d] cursor-pointer"
            >
              <Play size={16} fill="currentColor" />
              <span>Join Lobby</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 3: SIMPLE & INTERACTIVE HOST LIVE 3D PARK LOBBY HUD
          Host character moves freely in the 3D Park while students join via BIG QR Code!
         ------------------------------------------------------------- */}
      {screen === 'lobby' && role === 'host' && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-2.5 sm:p-4 pt-12 pb-3 pointer-events-none overflow-y-auto">
          {/* Top / Side Split HUD leaving the center of the 3D Park open so the Host 3D Character can walk around interactively */}
          <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-between gap-3 sm:gap-4 my-auto lg:my-0">
            {/* LEFT PANEL: Simple Room Code, Quick Match Controls, Live Players & Start Game */}
            <div className="host-lobby-interactive-panel pointer-events-auto w-full max-w-md bg-[#1b1130]/92 backdrop-blur-md p-3.5 sm:p-4 rounded-3xl shadow-2xl border-2 border-lime-400/50 space-y-3">
              {/* Room Code + Quick Copy / New Code */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-lime-300">
                    www.hamsterenglish.online • Room Code
                  </div>
                  <div
                    onClick={handleCopyRoomCode}
                    className="mt-1 bg-slate-950 border-2 border-lime-400/80 px-3.5 py-1.5 rounded-2xl text-white font-black text-3xl sm:text-4xl tracking-[0.18em] leading-none cursor-pointer hover:text-lime-300 transition select-all font-mono inline-block"
                    title="Click to Copy Room Code"
                  >
                    {roomCode}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyJoinLink}
                    className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition cursor-pointer"
                  >
                    {copiedType === 'link' ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copiedType === 'link' ? 'Copied Link!' : 'Copy Link'}</span>
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleCopyRoomCode}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      {copiedType === 'code' ? (
                        <Check size={11} className="text-lime-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                      <span>{copiedType === 'code' ? 'Copied' : 'Code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateNewRoomCode}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCw size={11} />
                      <span>New</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Compact 1-Block Match Settings: Mode, Timer, Balls/Q */}
              <div className="bg-slate-900/90 p-2.5 rounded-2xl border border-white/10 space-y-2">
                {/* Mode & Balls/Q Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="grid grid-cols-2 gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => setMatchMode('teams')}
                      className={`py-1.5 px-2 rounded-xl font-black text-[11px] transition cursor-pointer ${
                        matchMode === 'teams'
                          ? 'bg-indigo-600 text-white border border-indigo-400 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      👥 Teams
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatchMode('solo')}
                      className={`py-1.5 px-2 rounded-xl font-black text-[11px] transition cursor-pointer ${
                        matchMode === 'solo'
                          ? 'bg-lime-500 text-slate-950 border border-lime-300 shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🐹 Solo
                    </button>
                  </div>

                  {/* Balls per Question Stepper */}
                  <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-xl border border-lime-400/40 shrink-0">
                    <span className="text-[10px] font-black text-slate-300 uppercase mr-0.5">
                      Balls/Q
                    </span>
                    <button
                      type="button"
                      onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion - 1)}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-xs font-mono font-black text-lime-300 px-1">
                      +{ballsPerQuestion}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion + 1)}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Timer Pills */}
                <div className="grid grid-cols-6 gap-1">
                  {[
                    { label: '1m', sec: 60 },
                    { label: '2m', sec: 120 },
                    { label: '3m', sec: 180 },
                    { label: '5m', sec: 300 },
                    { label: '8m', sec: 480 },
                    { label: '10m', sec: 600 }
                  ].map(t => (
                    <button
                      key={t.sec}
                      type="button"
                      onClick={() => {
                        setConfiguredDurationSec(t.sec);
                        setMatchSeconds(t.sec);
                      }}
                      className={`py-1 rounded-lg font-black text-[11px] transition cursor-pointer ${
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

              {/* Joined Players Roster */}
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-black text-white mb-1.5">
                  <span>
                    Players ({roomPlayers.length})
                    {matchMode === 'teams' && (
                      <span className="ml-1.5 text-[11px] font-bold text-slate-400">
                        Red {teamTotals.red.count} • Blue {teamTotals.blue.count}
                      </span>
                    )}
                  </span>
                  {roomPlayers.length > 0 && matchMode === 'teams' && (
                    <button
                      type="button"
                      onClick={handleShuffleTeams}
                      className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Shuffle size={11} /> Shuffle
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {roomPlayers.length === 0 ? (
                    <div className="p-2.5 rounded-xl bg-slate-900/70 border border-dashed border-white/20 text-[11px] text-slate-300 font-semibold text-center">
                      Waiting for players to scan QR or enter{' '}
                      <strong className="text-lime-300 font-mono">{roomCode}</strong>
                    </div>
                  ) : (
                    roomPlayers.map(p => {
                      const tCfg =
                        matchMode === 'teams' ? TEAM_CONFIG[p.team || 'red'] : TEAM_CONFIG.solo;
                      const charSkin =
                        HAMSTER_SKINS[p.skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
                      const nextTeam: TeamId = p.team === 'red' ? 'blue' : 'red';
                      return (
                        <div
                          key={p.id}
                          className={`p-2 rounded-xl bg-slate-900/95 border ${tCfg.borderClass} flex items-center justify-between gap-2`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <HamsterCharacterAvatar
                              skin={charSkin}
                              size={30}
                              team={matchMode === 'teams' ? p.team || 'red' : 'solo'}
                            />
                            <div className="min-w-0">
                              <div className="font-black text-xs text-white truncate">
                                {p.name}
                              </div>
                              <span
                                className={`inline-block px-1.5 py-0.2 rounded font-black text-[9px] uppercase ${tCfg.bgClass}`}
                              >
                                {tCfg.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {matchMode === 'teams' && (
                              <button
                                type="button"
                                onClick={() => handleMovePlayerTeam(p, nextTeam)}
                                className={`px-2 py-1 rounded-lg font-black text-[10px] border transition cursor-pointer ${
                                  nextTeam === 'blue'
                                    ? 'bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border-sky-400/40'
                                    : 'bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 border-rose-400/40'
                                }`}
                              >
                                → {nextTeam === 'blue' ? 'Blue' : 'Red'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeletePlayer(p)}
                              className="p-1 rounded-lg bg-rose-600/25 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 transition cursor-pointer"
                              title={`Remove ${p.name}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Prominent Start Game Button */}
              <button
                type="button"
                onClick={handleStartMultiplayerMatch}
                className="w-full bg-gradient-to-r from-lime-500 to-emerald-600 hover:from-lime-400 hover:to-emerald-500 active:scale-95 text-slate-950 font-black text-sm py-3 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 border-b-4 border-emerald-800 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>START GAME</span>
              </button>
            </div>

            {/* RIGHT PANEL: BIGGER, UNOBSTRUCTED SCANNABLE QR CODE (Zero overlapping icons!) */}
            <div
              onClick={() => setIsQrModalOpen(true)}
              className="host-lobby-interactive-panel pointer-events-auto bg-white p-4 sm:p-5 rounded-3xl shadow-2xl border-4 border-lime-400 flex flex-col items-center cursor-pointer hover:scale-[1.02] transition shrink-0"
              title="Click to enlarge QR Code"
            >
              <QRCodeSVG
                value={liveJoinUrl}
                size={236}
                level="M"
                includeMargin={false}
                bgColor="#ffffff"
                fgColor="#0f172a"
              />
              <span className="mt-2.5 text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1">
                <QrCode size={15} className="text-indigo-600" /> SCAN TO JOIN LOBBY
              </span>
              <span className="text-xs font-extrabold text-indigo-600">
                www.hamsterenglish.online
              </span>
            </div>
          </div>

          {/* Bottom Interactive Hint: Host Character Can Move Around the 3D Park */}
          <div className="mx-auto mt-2 px-4 py-1.5 rounded-full bg-slate-950/85 border border-lime-400/50 text-[11px] sm:text-xs font-black text-lime-300 shadow-lg">
            🐹 Move Host Character in 3D Park: WASD / Arrow Keys • Mouse to Look &amp; Click to Shoot
          </div>

          {/* Enlarged Classroom QR Modal */}
          {isQrModalOpen && (
            <div className="pointer-events-auto absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-lime-400 flex flex-col items-center text-center relative">
                <button
                  onClick={() => setIsQrModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
                <span className="px-3 py-0.5 rounded-full bg-lime-100 text-lime-800 font-black text-xs uppercase mb-1">
                  WWW.HAMSTERENGLISH.ONLINE
                </span>
                <h3 className="font-black text-2xl text-slate-900">
                  ROOM CODE: <span className="font-mono text-indigo-700">{roomCode}</span>
                </h3>
                <div className="my-4 p-4 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
                  <QRCodeSVG
                    value={liveJoinUrl}
                    size={240}
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
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 4: IN-GAME 3D PARK HUD (STUDENT ROAM/PLAY HUD VS. HOST BROADCAST HUD)
         ------------------------------------------------------------- */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between px-2.5 sm:px-4 pt-12 sm:pt-14 pb-2.5 sm:pb-4 overflow-hidden">
          {/* TOP HUD BAR: NON-OVERLAPPING RESPONSIVE 3-COLUMN LAYOUT FOR MOBILE & TABLET (PORTRAIT & LANDSCAPE) */}
          <div className="w-full flex items-start justify-between gap-1.5 sm:gap-2 flex-nowrap">
            {role === 'player' ? (
              /* STUDENT TOP-LEFT: SCORE, STREAK MULTIPLIER + COMPACT HEALTH & SHIELD BARS */
              <div className="relative pointer-events-auto shrink-0 bg-slate-900/92 rounded-xl p-1.5 sm:p-2 w-[118px] min-[390px]:w-[132px] sm:w-48 md:w-56 border-l-3 border-l-lime-400 border border-white/15 shadow-lg">
                {/* SCORE & TEAM ON TOP ROW */}
                <div className="flex items-center justify-between gap-1 pb-1 mb-1 border-b border-white/10">
                  <div className="flex items-center gap-1 min-w-0">
                    {matchMode === 'teams' && (
                      <span
                        className={`px-1 py-0.2 rounded font-black text-[7px] sm:text-[8px] uppercase text-white shrink-0 ${
                          myTeam === 'blue' ? 'bg-blue-600' : 'bg-red-600'
                        }`}
                      >
                        {myTeam === 'blue' ? 'BLUE' : 'RED'}
                      </span>
                    )}
                    <span className="font-black text-white text-[9px] sm:text-xs truncate">
                      {playerName.toUpperCase()}
                    </span>
                  </div>
                  <div className="shrink-0 bg-amber-400/15 border border-amber-400/40 px-1 sm:px-1.5 py-0.2 rounded-md text-right">
                    <span className="text-[9px] sm:text-xs font-black text-amber-300">
                      ⭐{score}
                    </span>
                  </div>
                </div>

                {/* COMPACT HEALTH & SHIELD BARS */}
                <div className="space-y-0.5 sm:space-y-1">
                  <div>
                    <div className="flex items-center justify-between text-[7px] sm:text-[9px] font-black text-lime-300 leading-none mb-0.5">
                      <span className="flex items-center gap-0.5">
                        <Heart size={8} className="text-rose-400 fill-rose-400" /> HP
                      </span>
                      <span>
                        {hp}/{maxHp}
                      </span>
                    </div>
                    <div className="w-full h-1 sm:h-1.5 bg-slate-950 rounded-full overflow-hidden border border-lime-500/40">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[7px] sm:text-[9px] font-black text-cyan-300 leading-none mb-0.5">
                      <span className="flex items-center gap-0.5">
                        <Shield size={8} className="text-cyan-400 fill-cyan-400" /> SHD
                      </span>
                      <span>
                        {shield}/{maxShield}
                      </span>
                    </div>
                    <div className="w-full h-1 sm:h-1.5 bg-slate-950 rounded-full overflow-hidden border border-cyan-500/40">
                      <div
                        className="h-full bg-gradient-to-r from-sky-500 to-cyan-300 rounded-full transition-all duration-200"
                        style={{ width: `${Math.max(0, (shield / maxShield) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* FLOATING +PTS POPUP BADGES */}
                {scorePopups.length > 0 && (
                  <div className="pointer-events-none absolute -bottom-5 left-0 right-0 flex flex-wrap items-center gap-1">
                    {scorePopups.slice(-1).map(pop => (
                      <span
                        key={pop.id}
                        className="px-1.5 py-0.5 rounded-full bg-slate-950/95 border border-amber-400 text-[8px] sm:text-[10px] font-black shadow-lg animate-bounce truncate"
                        style={{ color: pop.color }}
                      >
                        +{pop.points} PTS • {pop.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* HOST TOP-LEFT: CURRENT PLAYER VIEW INDICATOR + LIVE FEED */
              <div className="pointer-events-auto shrink-0 bg-slate-900/90 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 w-40 sm:w-64 md:w-72 border-l-4 border-l-lime-400 border border-white/15 shadow-2xl flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <Radio size={12} className="text-lime-400 animate-pulse shrink-0" />
                    <span className="font-black text-[9px] sm:text-xs uppercase tracking-wider text-lime-300 truncate">
                      {hostCameraMode === 'overview'
                        ? 'ARENA OVERVIEW'
                        : hostCameraMode === 'auto_track'
                        ? 'AUTO SHUFFLE VIEW'
                        : 'FOCUS 1 PLAYER'}
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 shrink-0">
                    {roomPlayers.length > 0 && hostCameraMode !== 'overview'
                      ? `🎥 ${roomPlayers[hostFollowIndex % roomPlayers.length]?.name}`
                      : `${roomPlayers.length}P`}
                  </span>
                </div>
                {liveEvents[0] && (
                  <div
                    className="hidden sm:block px-2 py-0.5 rounded-lg bg-slate-950/85 border border-white/10 text-[10px] font-bold truncate"
                    style={{ color: liveEvents[0].color }}
                  >
                    {liveEvents[0].text}
                  </div>
                )}
              </div>
            )}

            {/* CENTER: UPGRADED MATCH COUNTDOWN TIMER + BALLS/Q INDICATOR & HOST CONTROLS */}
            <div className="pointer-events-auto flex flex-col items-center mx-auto shrink-0">
              <div
                className={`bg-slate-900/95 px-2 sm:px-3 py-1 rounded-xl flex flex-col items-center gap-0.5 sm:gap-1 border shadow-lg transition ${
                  matchStatus === 'playing' && matchSeconds <= 30
                    ? 'border-rose-500 ring-2 ring-rose-500/40'
                    : matchStatus === 'playing' && matchSeconds <= 60
                    ? 'border-amber-400/70'
                    : 'border-white/15'
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="hidden sm:flex text-[10px] sm:text-xs font-mono font-black text-lime-300 items-center gap-1">
                    <QrCode size={11} /> {roomCode}
                  </span>

                  {role === 'player' && matchStatus === 'lobby' ? (
                    <span className="px-2 py-0.5 rounded-full bg-lime-400/20 border border-lime-400/50 text-lime-300 font-black text-[9px] sm:text-[11px] whitespace-nowrap">
                      🟢 LOBBY ({roomCode})
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <div
                        className={`flex items-center gap-1 font-mono font-black text-[11px] sm:text-sm px-1.5 sm:px-2 py-0.5 rounded-lg border ${
                          isTimerPaused
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : matchSeconds <= 30
                            ? 'bg-rose-600/30 border-rose-400 text-rose-300 animate-pulse'
                            : matchSeconds <= 60
                            ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                            : 'bg-slate-950/90 border-white/15 text-white'
                        }`}
                      >
                        <Clock
                          size={12}
                          className={
                            matchSeconds <= 30
                              ? 'text-rose-400'
                              : matchSeconds <= 60
                              ? 'text-amber-300'
                              : 'text-lime-400'
                          }
                        />
                        <span>
                          {Math.floor(matchSeconds / 60)}:
                          {(matchSeconds % 60).toString().padStart(2, '0')}
                        </span>
                        {isTimerPaused && (
                          <span className="text-[8px] font-sans uppercase text-amber-300 ml-0.5">
                            PAUSED
                          </span>
                        )}
                      </div>

                      {/* Host Live Timer & Balls/Question Controls */}
                      {role === 'host' && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleHostTogglePauseTimer}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] font-black text-amber-300 border border-white/15 cursor-pointer"
                            title={isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                          >
                            {isTimerPaused ? '▶' : '⏸'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHostAddTime(30)}
                            className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-[9px] font-black text-cyan-300 border border-cyan-400/40 cursor-pointer"
                            title="Add +30 Seconds to Match Timer"
                          >
                            +30s
                          </button>
                          <div
                            className="hidden md:flex items-center gap-0.5 bg-lime-400/15 border border-lime-400/40 px-1.5 py-0.5 rounded text-[9px] font-black text-lime-300"
                            title="Adjust Paintballs Awarded Per Correct Question"
                          >
                            <button
                              type="button"
                              onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion - 1)}
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              -
                            </button>
                            <span>+{ballsPerQuestion}🟢/Q</span>
                            <button
                              type="button"
                              onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion + 1)}
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Match Timer Progress Bar */}
                {(role === 'host' || matchStatus === 'playing') && (
                  <div className="w-full min-w-[84px] sm:min-w-[145px] flex flex-col gap-0.5">
                    <div className="w-full h-1 sm:h-1.5 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          matchSeconds <= 30
                            ? 'bg-gradient-to-r from-rose-600 to-amber-400'
                            : matchSeconds <= 60
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-300'
                            : 'bg-gradient-to-r from-emerald-500 to-lime-400'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(0, (matchSeconds / Math.max(1, configuredDurationSec)) * 100)
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TOP-RIGHT: HOST PLAYER-VIEW CONTROLS & COMPACT STUDENT ACTIONS */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 shrink-0">
              {role === 'host' && (
                <>
                  <button
                    onClick={() => {
                      setIsLobbyMinimized(false);
                      setScreen('lobby');
                    }}
                    className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl bg-emerald-600/95 hover:bg-emerald-500 text-white font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer"
                  >
                    <Users size={12} />
                    <span>Lobby ({roomPlayers.length})</span>
                  </button>

                  {/* 1. Focus on 1 Player (Click again to switch to next player) */}
                  <button
                    onClick={() => {
                      if (hostCameraMode !== 'track_one') {
                        setHostCameraMode('track_one');
                      } else if (roomPlayers.length > 0) {
                        setHostFollowIndex(i => (i + 1) % roomPlayers.length);
                      }
                    }}
                    className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer ${
                      hostCameraMode === 'track_one'
                        ? 'bg-cyan-400 text-slate-950 border-2 border-white'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-white/15'
                    }`}
                    title="Focus on 1 Player (Click again to switch player)"
                  >
                    <Crosshair size={12} />
                    <span className="hidden md:inline">
                      {hostCameraMode === 'track_one' && roomPlayers.length > 0
                        ? `Focus: ${roomPlayers[hostFollowIndex % roomPlayers.length]?.name} ⏭`
                        : 'Focus 1 Player'}
                    </span>
                    <span className="md:hidden">Focus</span>
                  </button>

                  {/* 2. Auto Shuffle Players' Views */}
                  <button
                    onClick={() => setHostCameraMode('auto_track')}
                    className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer ${
                      hostCameraMode === 'auto_track'
                        ? 'bg-lime-400 text-slate-950 border-2 border-white'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-lime-300 border border-white/15'
                    }`}
                    title="Auto Shuffle between players' views every 4.5 seconds"
                  >
                    <RotateCw size={12} />
                    <span className="hidden md:inline">Auto Shuffle</span>
                    <span className="md:hidden">Shuffle</span>
                  </button>

                  {/* 3. Arena Overview */}
                  <button
                    onClick={() => setHostCameraMode('overview')}
                    className={`h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer ${
                      hostCameraMode === 'overview'
                        ? 'bg-indigo-600 text-white border border-indigo-300'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-white/15'
                    }`}
                  >
                    <Eye size={12} />
                    <span className="hidden lg:inline">Overview</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer"
              >
                <Trophy size={12} />
                <span className="hidden sm:inline">Scores</span>
              </button>

              {role === 'host' ? (
                <button
                  onClick={handleEndMatch}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] sm:text-xs flex items-center gap-1 transition shadow cursor-pointer"
                >
                  <span>End</span>
                </button>
              ) : (
                <button
                  onClick={() => setScreen('join')}
                  className="h-7 sm:h-8 px-2 sm:px-2.5 rounded-xl bg-slate-800/95 hover:bg-slate-700 text-white font-bold text-[10px] sm:text-xs border border-white/20 flex items-center gap-1 transition cursor-pointer"
                  title="Change Character"
                >
                  <span>🐹</span>
                  <span className="hidden md:inline">Character</span>
                </button>
              )}
            </div>
          </div>

          {/* CENTER ALERTS: MATCH START SPAWN HOLD, 10s RESPAWN IMMUNITY, KO, OR PICKUP */}
          <div className="self-center flex flex-col items-center gap-1 max-w-[90vw]">
            {role === 'player' && matchStatus === 'playing' && spawnHoldSecondsLeft > 0 && (
              <div
                className={`bg-slate-900/95 border-2 px-3 py-1 rounded-xl text-center shadow-2xl ${
                  myTeam === 'blue' ? 'border-blue-500' : 'border-red-500'
                }`}
              >
                <div
                  className={`text-[10px] sm:text-xs font-black uppercase flex items-center justify-center gap-1 ${
                    myTeam === 'blue' ? 'text-blue-300' : 'text-red-300'
                  }`}
                >
                  <span>
                    🚩 {myTeam === 'blue' ? 'BLUE' : 'RED'} SPAWN ({spawnHoldSecondsLeft}s) • TAP QUESTIONS FOR +{ballsPerQuestion} BALLS!
                  </span>
                </div>
              </div>
            )}
            {role === 'player' && immunitySecondsLeft > 0 && (
              <div className="bg-slate-900/95 border-2 border-amber-400 px-3 py-1 rounded-xl text-center shadow-2xl">
                <div className="text-[10px] sm:text-xs font-black uppercase text-amber-300 flex items-center justify-center gap-1">
                  <Shield size={12} className="text-amber-400 fill-amber-400" />
                  <span>
                    RESPAWN IMMUNITY: {immunitySecondsLeft}s • CANNOT BE HIT!
                  </span>
                </div>
              </div>
            )}
            {koBannerText && (
              <div className="bg-slate-900/95 border-2 border-pink-500 px-3.5 py-1 rounded-xl text-center shadow-2xl animate-bounce">
                <div className="text-[11px] sm:text-sm font-black text-pink-400 uppercase">
                  {koBannerText}
                </div>
              </div>
            )}
            {pickupBannerText && (
              <div className="bg-slate-900/95 border-2 border-lime-400 px-3 py-1 rounded-xl text-center shadow-xl">
                <div className="text-[10px] sm:text-xs font-black text-lime-300 uppercase">
                  {pickupBannerText}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ROW: NON-OVERLAPPING MOBILE PORTRAIT & LANDSCAPE CONTROLS
              LEFT = MOVE JOYSTICK, CENTER = QUESTIONS ICON BUTTON, RIGHT = SHOOT BUTTON */}
          {role === 'player' ? (
            <div className="w-full flex items-end justify-between gap-2 sm:gap-4 pb-1 sm:pb-1.5 px-1 sm:px-2 flex-nowrap">
              {/* LEFT SIDE: VIRTUAL TOUCH MOVEMENT JOYSTICK */}
              <div className="flex flex-col items-center shrink-0">
                <span className="mb-0.5 text-[8px] sm:text-[9px] font-black uppercase text-lime-300 tracking-wider drop-shadow">
                  MOVE
                </span>
                <div
                  onTouchStart={handleJoystickStart}
                  onTouchMove={handleJoystickMove}
                  onTouchEnd={handleJoystickEnd}
                  onTouchCancel={handleJoystickEnd}
                  className="pointer-events-auto w-14 h-14 min-[390px]:w-16 min-[390px]:h-16 sm:w-20 sm:h-20 rounded-full bg-slate-900/85 border-2 border-lime-400/70 flex items-center justify-center relative touch-none shadow-xl select-none"
                >
                  <div
                    className="w-6 h-6 min-[390px]:w-7 min-[390px]:h-7 sm:w-9 sm:h-9 rounded-full bg-lime-400 border-2 border-white shadow-md transition-transform duration-75"
                    style={{
                      transform: `translate(${joystickVec.x * 16}px, ${joystickVec.y * 16}px)`
                    }}
                  />
                </div>
              </div>

              {/* CENTER DOCK: QUESTIONS ICON BUTTON (REPLACES HP/SHD & FREE SHOOT LOBBY) */}
              <div className="pointer-events-auto flex items-center justify-center min-w-0 shrink">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(true)}
                  className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-2xl font-black text-xs sm:text-sm shadow-2xl border-2 transition flex items-center gap-2 cursor-pointer active:scale-95 ${
                    ammo === 0 && matchStatus === 'playing'
                      ? 'bg-gradient-to-r from-amber-400 to-lime-400 text-slate-950 border-white animate-pulse'
                      : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-300/80'
                  }`}
                  title="Open Full-Screen Questions"
                >
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      ammo === 0 && matchStatus === 'playing'
                        ? 'bg-slate-950/15 text-slate-950'
                        : 'bg-white/20 text-amber-300'
                    }`}
                  >
                    <HelpCircle size={18} />
                  </div>
                  <div className="text-left leading-tight">
                    <div className="text-[10px] sm:text-xs font-black uppercase tracking-wide whitespace-nowrap">
                      Questions
                    </div>
                    <div
                      className={`text-[9px] sm:text-[10px] font-bold whitespace-nowrap ${
                        ammo === 0 && matchStatus === 'playing'
                          ? 'text-slate-900'
                          : 'text-lime-300'
                      }`}
                    >
                      +{ballsPerQuestion} Balls • 🟢 {ammo}
                    </div>
                  </div>
                </button>
              </div>

              {/* RIGHT SIDE: SHOOT BUTTON */}
              <div className="flex flex-col items-center shrink-0">
                <span className="mb-0.5 text-[8px] sm:text-[9px] font-black uppercase text-rose-300 tracking-wider drop-shadow">
                  SHOOT
                </span>
                <button
                  type="button"
                  onMouseDown={() => {
                    if (gameRef.current) gameRef.current.shootButtonHeld = true;
                    fireShot();
                  }}
                  onMouseUp={() => {
                    if (gameRef.current) gameRef.current.shootButtonHeld = false;
                  }}
                  onMouseLeave={() => {
                    if (gameRef.current) gameRef.current.shootButtonHeld = false;
                  }}
                  onTouchStart={e => {
                    e.preventDefault();
                    if (gameRef.current) gameRef.current.shootButtonHeld = true;
                    fireShot();
                  }}
                  onTouchEnd={() => {
                    if (gameRef.current) gameRef.current.shootButtonHeld = false;
                  }}
                  onTouchCancel={() => {
                    if (gameRef.current) gameRef.current.shootButtonHeld = false;
                  }}
                  onContextMenu={e => e.preventDefault()}
                  className="pointer-events-auto w-14 h-14 min-[390px]:w-16 min-[390px]:h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 active:scale-95 border-3 border-white/90 shadow-xl flex flex-col items-center justify-center text-white font-black text-[9px] sm:text-xs cursor-pointer select-none touch-none"
                >
                  <Crosshair size={18} />
                  <span className="mt-0.5">SHOOT</span>
                </button>
              </div>
            </div>
          ) : (
            /* HOST BOTTOM LIVE PLAYER VIEW SELECTOR STRIP (Click any player to Focus on 1 Player, or click Auto Shuffle) */
            <div className="pointer-events-auto w-full max-w-4xl mx-auto bg-slate-900/92 p-2.5 sm:p-3 rounded-2xl border border-white/15 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black text-cyan-300 mb-2">
                <div className="flex items-center gap-2">
                  <span>🎥 PLAYER VIEW ({roomPlayers.length} Players)</span>
                  {roomPlayers.length > 0 && hostCameraMode !== 'overview' && (
                    <span className="px-2 py-0.5 rounded-full bg-lime-400/20 border border-lime-400/50 text-lime-300 text-[10px]">
                      Watching: {roomPlayers[hostFollowIndex % roomPlayers.length]?.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setHostCameraMode('track_one')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                      hostCameraMode === 'track_one'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-800 text-cyan-300 hover:bg-slate-700'
                    }`}
                  >
                    🎯 Focus 1 Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setHostCameraMode('auto_track')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition ${
                      hostCameraMode === 'auto_track'
                        ? 'bg-lime-400 text-slate-950'
                        : 'bg-slate-800 text-lime-300 hover:bg-slate-700'
                    }`}
                  >
                    🔀 Auto Shuffle
                  </button>
                </div>
              </div>
              {roomPlayers.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-1.5">
                  No students have joined yet. Click &quot;Lobby&quot; at the top right to show the QR code popup!
                </div>
              ) : (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {roomPlayers.map((rp, i) => {
                    const tCfg =
                      matchMode === 'teams' ? TEAM_CONFIG[rp.team || 'red'] : TEAM_CONFIG.solo;
                    const isWatched =
                      hostCameraMode !== 'overview' &&
                      roomPlayers.length > 0 &&
                      hostFollowIndex % roomPlayers.length === i;
                    return (
                      <div
                        key={rp.id}
                        onClick={() => {
                          setHostCameraMode('track_one');
                          setHostFollowIndex(i);
                        }}
                        className={`shrink-0 px-3 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                          isWatched
                            ? 'bg-cyan-950/90 border-cyan-300 ring-2 ring-cyan-400/60'
                            : `bg-slate-950 ${tCfg.borderClass} hover:bg-slate-800`
                        }`}
                      >
                        <HamsterCharacterAvatar
                          skin={HAMSTER_SKINS[rp.skinIdx] || HAMSTER_SKINS[0]}
                          size={24}
                          team={matchMode === 'teams' ? rp.team || 'red' : 'solo'}
                        />
                        <div>
                          <div className="font-black text-xs text-white flex items-center gap-1">
                            <span>{rp.name}</span>
                            {isWatched && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-black">
                                VIEWING
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-bold text-lime-300">
                            ⭐ {rp.score} PTS • {rp.kos} KOs
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
        <div className="absolute inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 overflow-y-auto">
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
                  <div className="text-right">
                    <div className="text-lime-300 font-black">
                      ⭐ {rp.score} PTS • {rp.kos} Splats
                    </div>
                    <div className="text-[10px] text-slate-400">
                      🎯 {rp.hitsLanded || 0} Hits • 📚 {rp.questionsAnswered || 0} Qs • 🔥 Best{' '}
                      {rp.bestStreak || 0}x
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setMatchStatus('lobby');
                if (role === 'host') {
                  setScreen('lobby');
                  if (roomCode) {
                    setDoc(
                      getRoomDocRef(roomCode),
                      { matchStatus: 'lobby' },
                      { merge: true }
                    ).catch(() => {});
                  }
                } else {
                  setScreen('game');
                }
              }}
              className="w-full py-3 bg-lime-400 hover:bg-lime-300 text-slate-950 font-black text-sm rounded-xl shadow-lg cursor-pointer"
            >
              {role === 'host' ? 'Return to Host Park Lobby' : 'Roam 3D Park Lobby'}
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          FULL-SCREEN QUESTION VIEW (COVERS ENTIRE SCREEN IN PORTRAIT & LANDSCAPE)
         ------------------------------------------------------------- */}
      {isQuestionModalOpen && currentTriviaQ && (
        <div className="fixed inset-0 z-50 w-full h-full bg-slate-950 text-white flex flex-col justify-between overflow-y-auto">
          {/* Top Full-Screen Header */}
          <div className="bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-800 text-white px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 shrink-0 border-b border-white/15">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-lime-300 shrink-0" />
                <h3 className="font-black text-sm sm:text-xl leading-none truncate">
                  ANSWER FOR +{ballsPerQuestion} PAINTBALLS
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-indigo-100 mt-1 truncate">
                Correct = <strong className="text-lime-300">+{ballsPerQuestion} Balls</strong> +{' '}
                <strong className="text-amber-300">+15 PTS</strong> +{' '}
                <strong className="text-cyan-300">Streak ({triviaStreak}x)</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* 15s Per-Question Countdown Badge */}
              <div
                className={`px-2.5 py-1.5 rounded-xl font-mono font-black text-xs sm:text-sm flex items-center gap-1 border ${
                  questionTimeLeft <= 5
                    ? 'bg-rose-600 text-white border-rose-300 animate-pulse'
                    : questionTimeLeft >= 10
                    ? 'bg-emerald-500 text-slate-950 border-lime-200'
                    : 'bg-amber-400 text-slate-950 border-amber-200'
                }`}
              >
                <Clock size={14} />
                <span>{questionTimeLeft}s</span>
              </div>

              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-lime-400 hover:bg-lime-300 text-slate-950 rounded-xl font-black text-xs sm:text-sm shadow-lg cursor-pointer flex items-center gap-1"
              >
                <span>🎯 Arena ({ammo})</span>
              </button>
            </div>
          </div>

          {/* 15-Second Question Timer Bar */}
          <div className="w-full h-2 bg-slate-800 shrink-0 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                questionTimeLeft <= 5
                  ? 'bg-rose-500'
                  : questionTimeLeft >= 10
                  ? 'bg-emerald-400'
                  : 'bg-amber-400'
              }`}
              style={{
                width: `${Math.max(0, (questionTimeLeft / QUESTION_TIME_LIMIT_SEC) * 100)}%`
              }}
            />
          </div>

          {/* Full-Screen Question Body & Answer Grid */}
          {(() => {
            const parsedQuestion = parseOptionContent(currentTriviaQ.text || '');
            const displayQText = parsedQuestion.text || currentTriviaQ.text;
            const displayQImage = currentTriviaQ.image || parsedQuestion.imageUrl;
            const correctIdx =
              typeof currentTriviaQ.answerIndex === 'number' ? currentTriviaQ.answerIndex : 0;
            const liveSpeedBonus = questionTimeLeft >= 10 ? 10 : questionTimeLeft >= 5 ? 5 : 0;

            return (
              <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col justify-between gap-4 overflow-y-auto">
                {/* Question Counter & Ammo Status Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 font-black text-xs sm:text-sm uppercase px-3 py-1 rounded-full">
                    QUESTION {(triviaDeckIndex % effectiveQuestions.length) + 1} OF{' '}
                    {effectiveQuestions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    {liveSpeedBonus > 0 && (
                      <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 font-black text-xs sm:text-sm">
                        ⚡ Speed +{liveSpeedBonus} PTS
                      </span>
                    )}
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-xs sm:text-sm font-black text-lime-300">
                      🟢 Paintballs: {ammo}
                    </span>
                  </div>
                </div>

                {/* Question Prompt & Optional Image */}
                <div className="bg-slate-900/95 border-2 border-white/15 rounded-3xl p-4 sm:p-6 flex flex-col items-center justify-center text-center shadow-xl my-auto">
                  {displayQImage && (
                    <div className="mb-3 rounded-2xl overflow-hidden border border-white/15 bg-slate-950 max-h-44 sm:max-h-56 flex items-center justify-center">
                      <img
                        src={displayQImage}
                        alt={displayQText || 'Question'}
                        referrerPolicy="no-referrer"
                        className="max-h-44 sm:max-h-56 w-auto object-contain"
                      />
                    </div>
                  )}
                  <h2 className="font-black text-xl sm:text-3xl md:text-4xl text-white leading-snug">
                    {displayQText}
                  </h2>
                </div>

                {/* Large Full-Screen Responsive Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-auto">
                  {currentTriviaQ.options.map((opt, idx) => {
                    const parsed = parseOptionContent(opt);
                    const isAnswered = selectedOptionIdx !== null;
                    const isThisSelected = selectedOptionIdx === idx;
                    const isThisCorrect = idx === correctIdx;

                    let btnClasses =
                      'bg-slate-900 hover:bg-indigo-950 border-white/20 hover:border-indigo-400 text-white';
                    if (isAnswered) {
                      if (isThisCorrect) {
                        btnClasses = 'bg-emerald-600 border-lime-300 text-white shadow-xl scale-[1.01]';
                      } else if (isThisSelected) {
                        btnClasses = 'bg-rose-600 border-rose-300 text-white';
                      } else {
                        btnClasses = 'bg-slate-900/50 border-white/10 text-slate-500 opacity-70';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswered}
                        onClick={() => handleTriviaAnswer(idx)}
                        className={`p-4 sm:p-5 rounded-2xl border-2 font-black text-base sm:text-xl text-left transition shadow-lg cursor-pointer active:scale-95 flex items-center gap-3.5 ${btnClasses}`}
                      >
                        <span
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-sm sm:text-lg shrink-0 ${
                            isAnswered && (isThisCorrect || isThisSelected)
                              ? 'bg-white/20 text-white'
                              : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {OPTION_LETTERS[idx]}
                        </span>
                        {parsed.imageUrl && (
                          <img
                            src={parsed.imageUrl}
                            alt={parsed.text || 'Option'}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-white/20 shrink-0 bg-white"
                          />
                        )}
                        <span className="flex-1 leading-snug">{parsed.text || opt}</span>
                      </button>
                    );
                  })}
                </div>

                {triviaFeedback && (
                  <div
                    className={`p-3.5 text-white font-black text-center text-sm sm:text-base rounded-2xl shadow-xl ${
                      selectedOptionIdx === correctIdx ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {triviaFeedback}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* -------------------------------------------------------------
          LIVE SCOREBOARD MODAL (TEAM & INDIVIDUAL + POINTS SYSTEM BREAKDOWN)
         ------------------------------------------------------------- */}
      {isLeaderboardOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-cyan-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto">
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

            {/* Points System Legend */}
            <div className="grid grid-cols-4 gap-1.5 text-center bg-slate-950/90 p-2 rounded-2xl border border-white/10">
              <div className="p-1.5 rounded-xl bg-lime-500/10 border border-lime-400/30">
                <div className="text-[9px] font-black text-lime-300 uppercase">Question</div>
                <div className="text-xs font-black text-white">+15–50 PTS</div>
                <div className="text-[8px] text-slate-400">Speed + Streak</div>
              </div>
              <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-400/30">
                <div className="text-[9px] font-black text-cyan-300 uppercase">Paint Hit</div>
                <div className="text-xs font-black text-white">+20 PTS</div>
                <div className="text-[8px] text-slate-400">+5x Combo</div>
              </div>
              <div className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-400/30">
                <div className="text-[9px] font-black text-rose-300 uppercase">KO Splat</div>
                <div className="text-xs font-black text-white">+60 PTS</div>
                <div className="text-[8px] text-slate-400">+90s Frenzy</div>
              </div>
              <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-400/30">
                <div className="text-[9px] font-black text-amber-300 uppercase">Use Can</div>
                <div className="text-xs font-black text-white">+10 PTS</div>
                <div className="text-[8px] text-slate-400">HP / Shield</div>
              </div>
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
                    <div className="text-right">
                      <div className="text-lime-300 font-black">
                        ⭐ {rp.score} PTS · {rp.kos} Splats
                      </div>
                      <div className="text-[10px] text-slate-400">
                        🎯 {rp.hitsLanded || 0} Hits · 📚 {rp.questionsAnswered || 0} Qs · 🔥{' '}
                        {rp.bestStreak || 0}x
                      </div>
                    </div>
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
// QUIZ EDITOR COMPONENT — EXACT BUBBLE POP GAME SETUP DESIGN
// =============================================================
function QuizEditor({
  quiz,
  onSave,
  onPlayLobby,
  onCancel,
  folders = []
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onPlayLobby?: (q: Quiz) => void;
  onCancel: () => void;
  folders?: { id: string; name: string }[];
}) {
  const [topic, setTopic] = useState(quiz.topic || '');
  const [classLevel, setClassLevel] = useState(quiz.classLevel || '');
  const [folderId, setFolderId] = useState(quiz.folderId || '');
  const [contentMode, setContentMode] = useState<AnswerContentMode>('words');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState(false);

  const [questions, setQuestions] = useState<Question[]>(() => {
    const norm = normalizePaintballQuestions(quiz.questions);
    if (norm.length > 0) {
      return norm.map((q, idx) => ({
        ...q,
        id: q.id || idx + 1,
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ['', '', '', ''],
        answerIndex: typeof q.answerIndex === 'number' ? q.answerIndex : 0
      }));
    }
    return [{ id: 1, text: '', options: ['', '', '', ''], answerIndex: 0 }];
  });

  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkVideoOpen, setIsBulkVideoOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [parseFeedback, setParseFeedback] = useState<{ msg: string; isErr: boolean } | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [activeGiphyInput, setActiveGiphyInput] = useState<{
    qIdx: number;
    oIdx?: number;
    initialQuery?: string;
  } | null>(null);

  const handleApplyModeToAll = async (newMode: AnswerContentMode) => {
    setContentMode(newMode);
    if (newMode !== 'words') setAutoPhotosEnabled(true);
    const updated = await convertQuestionsContentMode(questions, newMode);
    setQuestions(updated as Question[]);
  };

  const handleLoadStarterQuestions = (
    newQs: { id: number; text: string; options: string[]; answerIndex: number }[],
    topicName: string
  ) => {
    setTopic(prev => prev || topicName);
    setClassLevel(prev => prev || 'Starters / Grade 2');
    setQuestions(newQs);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: questions.length + 1, text: '', options: ['', '', '', ''], answerIndex: 0 }
    ]);
  };

  const duplicateQuestion = (index: number) => {
    const qToDup = questions[index];
    const newQ: Question = {
      ...qToDup,
      id: questions.length + 1,
      options: [...qToDup.options]
    };
    const next = [...questions];
    next.splice(index + 1, 0, newQ);
    setQuestions(next.map((q, i) => ({ ...q, id: i + 1 })));
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) return;
    const next = questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, id: i + 1 }));
    setQuestions(next);
  };

  const updateQuestionText = (index: number, text: string) => {
    const next = [...questions];
    next[index] = { ...next[index], text };
    setQuestions(next);
  };

  const updateQuestionImage = (index: number, image: string) => {
    const next = [...questions];
    next[index] = { ...next[index], image };
    setQuestions(next);
  };

  const updateOption = (qIndex: number, oIndex: number, val: string) => {
    const next = [...questions];
    const nextOpts = [...next[qIndex].options];
    nextOpts[oIndex] = val;
    next[qIndex] = { ...next[qIndex], options: nextOpts };
    setQuestions(next);
  };

  const setCorrectAnswer = (qIndex: number, oIndex: number) => {
    const next = [...questions];
    next[qIndex] = { ...next[qIndex], answerIndex: oIndex };
    setQuestions(next);
  };

  const addOption = (qIndex: number) => {
    const next = [...questions];
    if (next[qIndex].options.length >= 6) return;
    next[qIndex] = { ...next[qIndex], options: [...next[qIndex].options, ''] };
    setQuestions(next);
  };

  const removeOption = (qIndex: number) => {
    const next = [...questions];
    if (next[qIndex].options.length <= 2) return;
    const nextOpts = next[qIndex].options.slice(0, -1);
    const nextAns =
      next[qIndex].answerIndex >= nextOpts.length ? 0 : next[qIndex].answerIndex;
    next[qIndex] = { ...next[qIndex], options: nextOpts, answerIndex: nextAns };
    setQuestions(next);
  };

  const handleBulkParse = async (overrideText?: string) => {
    const textToParse = overrideText !== undefined ? overrideText : bulkText;
    if (!textToParse.trim()) {
      setParseFeedback({ msg: 'Please paste some text first!', isErr: true });
      return;
    }

    const parsed = parsePastedQuiz(textToParse);
    if (parsed.length === 0) {
      setParseFeedback({
        msg: 'Could not detect any valid questions with options. Check the format!',
        isErr: true
      });
      return;
    }

    const isDefaultEmpty =
      questions.length === 1 &&
      !questions[0].text.trim() &&
      questions[0].options.every(o => !o.trim());
    const combined = isDefaultEmpty ? parsed : [...questions, ...parsed];
    const reindexed = combined.map((q, idx) => ({ ...q, id: idx + 1 }));

    const converted = await convertQuestionsContentMode(reindexed, contentMode);

    setQuestions(converted as Question[]);
    setBulkText('');
    setParseFeedback(null);
    setIsBulkModalOpen(false);
  };

  const buildSanitizedQuiz = (isPublic?: boolean): Quiz => {
    const validQuestions = questions
      .filter(q => q.text.trim() || q.image || q.options.some(o => o.trim()))
      .map((q, idx) => ({
        ...q,
        id: idx + 1,
        text: q.text.trim() || `Question ${idx + 1}`,
        options: q.options.map((o, oIdx) => o.trim() || `Option ${oIdx + 1}`)
      }));

    const finalQuestions =
      validQuestions.length > 0
        ? validQuestions
        : DEFAULT_TRIVIA.map((q, idx) => ({ ...q, id: idx + 1 }));

    return {
      ...quiz,
      title: topic.trim() || quiz.title || 'Hamster Paintball Quiz',
      topic: topic.trim() || 'General Knowledge',
      classLevel: classLevel.trim() || 'All Levels',
      folderId,
      questions: finalQuestions,
      isPublic: Boolean(isPublic)
    };
  };

  const handleSaveClick = () => {
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    setShowPublishModal(false);
    onSave(buildSanitizedQuiz(isPublic));
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-3xl shadow-xl border border-slate-100 text-slate-800">
      {/* Header matching Bubble Pop GAME SETUP */}
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h2
          className="text-3xl font-black tracking-tight text-slate-900 uppercase"
          style={{ fontFamily: "'Fredoka', sans-serif" }}
        >
          GAME SETUP
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          {onPlayLobby && (
            <button
              type="button"
              onClick={() => onPlayLobby(buildSanitizedQuiz(false))}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer"
            >
              <QrCode size={18} /> Open QR &amp; Code Lobby
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveClick}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Save size={18} /> Save Quiz
          </button>
        </div>
      </div>

      {/* Curriculum & Option Content Mode Header */}
      <SetupCurriculumHeader
        topic={topic}
        setTopic={setTopic}
        classLevel={classLevel}
        setClassLevel={setClassLevel}
        contentMode={contentMode}
        setContentMode={setContentMode}
        onApplyModeToAll={handleApplyModeToAll}
        autoPhotosEnabled={autoPhotosEnabled}
        setAutoPhotosEnabled={setAutoPhotosEnabled}
        folderId={folderId}
        setFolderId={setFolderId}
        folders={folders}
        onLoadStarterQuestions={handleLoadStarterQuestions}
      />

      {/* Questions Header Bar with Bulk Paste & How to Bulk Paste */}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        <div className="flex flex-wrap justify-between items-center gap-2 bg-blue-50 p-4 rounded-2xl border border-blue-100">
          <h3 className="text-sm font-black uppercase tracking-wider text-blue-900">
            Questions ({questions.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-sm transition flex items-center gap-2 cursor-pointer"
            >
              <ClipboardList size={16} /> Bulk Paste
            </button>
            <button
              type="button"
              onClick={() => setIsBulkVideoOpen(true)}
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-sm shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              title="Watch how to bulk paste questions"
            >
              <Play size={14} className="fill-current" /> How to Bulk Paste
            </button>
          </div>
        </div>

        {/* Question Cards (Exact Bubble Pop Row Layout) */}
        {questions.map((q, qIndex) => (
          <div
            key={qIndex}
            className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm relative group"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={() => duplicateQuestion(qIndex)}
                className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                title="Duplicate Question"
              >
                <Copy size={18} />
              </button>
              <button
                type="button"
                onClick={() => removeQuestion(qIndex)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
                title="Delete Question"
              >
                <Trash2 size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 pr-16">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center shrink-0">
                {qIndex + 1}
              </span>
              <div className="flex-1">
                <SmartQuestionInput
                  value={q.text}
                  imageUrl={q.image}
                  onChange={val => updateQuestionText(qIndex, val)}
                  onChangeImage={url => updateQuestionImage(qIndex, url)}
                  onOpenMediaPicker={initialQuery =>
                    setActiveGiphyInput({ qIdx: qIndex, initialQuery })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-11 mb-3">
              {q.options.map((opt, oIndex) => (
                <div key={oIndex} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${qIndex}`}
                    checked={q.answerIndex === oIndex}
                    onChange={() => setCorrectAnswer(qIndex, oIndex)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <SmartOptionInput
                    value={opt}
                    isCorrect={q.answerIndex === oIndex}
                    placeholder={`Option ${oIndex + 1}`}
                    contentMode={contentMode}
                    autoPhotosEnabled={autoPhotosEnabled}
                    onChange={val => updateOption(qIndex, oIndex, val)}
                    onOpenMediaPicker={initialQuery =>
                      setActiveGiphyInput({ qIdx: qIndex, oIdx: oIndex, initialQuery })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="pl-11 flex gap-2">
              {q.options.length < 6 && (
                <button
                  type="button"
                  onClick={() => addOption(qIndex)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  + Option
                </button>
              )}
              {q.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeOption(qIndex)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  - Option
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Another Question Button */}
      <button
        type="button"
        onClick={addQuestion}
        className="mt-6 w-full py-4 border-2 border-dashed border-slate-300 hover:border-blue-500 text-slate-500 hover:text-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 transition cursor-pointer"
      >
        <Plus size={20} /> Add Another Question
      </button>

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={!!activeGiphyInput}
        initialQuery={activeGiphyInput?.initialQuery}
        onClose={() => setActiveGiphyInput(null)}
        onSelect={url => {
          if (!activeGiphyInput) return;
          if (activeGiphyInput.oIdx === undefined) {
            updateQuestionImage(activeGiphyInput.qIdx, url);
          } else {
            const currentOpt = questions[activeGiphyInput.qIdx].options[activeGiphyInput.oIdx];
            const { text } = parseOptionContent(currentOpt);
            updateOption(
              activeGiphyInput.qIdx,
              activeGiphyInput.oIdx,
              formatOptionContent(text, url)
            );
          }
          setActiveGiphyInput(null);
        }}
      />

      {/* Publish Game Modal */}
      {showPublishModal &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in fade-in zoom-in duration-200">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Publish Game?</h3>
              <p className="text-slate-500 mb-8 font-medium">
                Would you like to share this Hamster Paintball set with other teachers in the Community Library, or keep it private in your My Games library?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => confirmSave(true)}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 transition cursor-pointer"
                >
                  Publish to Community &amp; Open Lobby
                </button>
                <button
                  type="button"
                  onClick={() => confirmSave(false)}
                  className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition cursor-pointer"
                >
                  Keep Private (My Games Only) &amp; Open Lobby
                </button>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 font-bold text-sm mt-2 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Bulk Paste Modal */}
      {isBulkModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2 text-blue-600">
                  <ClipboardList size={24} />
                  <h3 className="text-xl font-black text-slate-800">
                    Bulk Paste &amp; Auto-Divide
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkVideoOpen(true)}
                    className="px-3 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Play size={14} className="fill-current" /> Watch Video Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsBulkModalOpen(false);
                      setParseFeedback(null);
                    }}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl text-sm flex gap-3 items-start border border-blue-100">
                  <Info className="shrink-0 mt-0.5 text-blue-600" size={18} />
                  <div className="space-y-1">
                    <p className="font-bold">How to format your text:</p>
                    <p>
                      Paste a list of questions. Put each question on a new line, followed by its options (A, B, C, D).
                    </p>
                    <p>
                      Mark the correct answer with an asterisk <strong>*</strong>, <strong>(correct)</strong>, or add an <strong>Answer: B</strong> line at the bottom!
                    </p>
                  </div>
                </div>

                <textarea
                  value={bulkText}
                  onChange={e => {
                    setBulkText(e.target.value);
                    setParseFeedback(null);
                  }}
                  placeholder={`1. What is the capital of France?\nA) London\nB) Paris *\nC) Berlin\n\n2. Which planet is known as the Red Planet?\nA) Venus\nB) Mars\nC) Jupiter\nAnswer: B`}
                  className="w-full h-64 p-4 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none font-mono text-sm leading-relaxed"
                />

                {parseFeedback && (
                  <div
                    className={`p-3 rounded-xl text-sm font-bold text-center ${
                      parseFeedback.isErr
                        ? 'bg-red-50 text-red-600'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {parseFeedback.msg}
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkModalOpen(false);
                    setParseFeedback(null);
                  }}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkParse()}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-600/20 transition cursor-pointer"
                >
                  Auto-Divide &amp; Import
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <BulkPasteVideoModal
        isOpen={isBulkVideoOpen}
        onClose={() => setIsBulkVideoOpen(false)}
        onOpenBulkPasteWithSample={sampleText => {
          setBulkText(sampleText);
          setParseFeedback(null);
          setIsBulkModalOpen(true);
        }}
      />
    </div>
  );
}

// =============================================================
// BULK PASTE PARSER (SHARED WITH BUBBLE POP)
// =============================================================
function parsePastedQuiz(rawText: string): Question[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const globalAnswers: Record<number, string> = {};
  const contentLines: string[] = [];
  let inAnswerKey = false;

  const ansKeyHeaderRegex = /^(?:answer\s*key|answers|correct\s*answers)\s*:?\s*$/i;
  const ansKeyPairRegex = /(?:^|\s|,|;)(\d+)\s*(?:[\.\)\-\:]|\s)\s*([a-fA-F])(?=$|\s|,|;|\.)/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ansKeyHeaderRegex.test(line)) {
      inAnswerKey = true;
      continue;
    }

    if (inAnswerKey) {
      let match;
      let foundAny = false;
      ansKeyPairRegex.lastIndex = 0;
      while ((match = ansKeyPairRegex.exec(line)) !== null) {
        globalAnswers[parseInt(match[1], 10)] = match[2].toUpperCase();
        foundAny = true;
      }
      if (foundAny) continue;
    }

    contentLines.push(line);
  }

  let blocks: string[][] = [];
  const hasNumberedQuestions = contentLines.some(l =>
    /^(?:Q(?:uestion)?\s*\d+|\d+)[\.\)\-\:]\s+/i.test(l)
  );

  if (hasNumberedQuestions) {
    let currentBlock: string[] = [];
    for (const line of contentLines) {
      const isNewQ = /^(?:Q(?:uestion)?\s*\d+|\d+)[\.\)\-\:]\s+/i.test(line);
      if (isNewQ && currentBlock.length > 0) {
        blocks.push(currentBlock);
        currentBlock = [line];
      } else {
        currentBlock.push(line);
      }
    }
    if (currentBlock.length > 0) blocks.push(currentBlock);
  } else {
    blocks = rawText
      .split(/\n\s*\n/)
      .map(b =>
        b
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(Boolean)
      )
      .filter(b => b.length > 0);
  }

  const parsedQuestions: Question[] = [];

  blocks.forEach((block, idx) => {
    const qNumMatch = block[0].match(/^(?:Q(?:uestion)?\s*(\d+)|(\d+))[\.\)\-\:]\s+/i);
    const qNum = qNumMatch ? parseInt(qNumMatch[1] || qNumMatch[2], 10) : idx + 1;

    let questionText = '';
    let rawOptions: { text: string; isCorrect: boolean; letter?: string }[] = [];
    let explicitAnsLetter = globalAnswers[qNum] || '';
    let explicitAnsText = '';

    const inlineAnsRegex =
      /^(?:ans(?:wer)?|correct(?:\s*answer)?)\s*[\:\-\=]?\s*(?:([a-fA-F])(?![a-zA-Z])[\.\)]?\s*)?(.*)$/i;
    const optPrefixRegex = /^(?:[\-\•\*\+]|\(?([a-fA-F])[\.\)\-\:]|\(?(\d+)[\.\)\-\:])\s*(.*)$/;

    for (let i = 0; i < block.length; i++) {
      const line = block[i];

      const ansMatch = line.match(inlineAnsRegex);
      if (ansMatch && i > 0) {
        if (ansMatch[1]) explicitAnsLetter = ansMatch[1].toUpperCase();
        if (ansMatch[2]) explicitAnsText = ansMatch[2].trim();
        continue;
      }

      const inlineOptRegex = /(?:^|\s+)(?:\(?([a-fA-F])[\.\)\:]\s+)([^\n]+?)(?=(?:\s+\(?[a-fA-F][\.\)\:]\s+)|$)/g;
      const inlineMatches = [...line.matchAll(inlineOptRegex)];

      if (inlineMatches.length >= 2) {
        if (i === 0) {
          const firstMatchIndex = line.indexOf(inlineMatches[0][0]);
          if (firstMatchIndex > 0) {
            questionText = line
              .slice(0, firstMatchIndex)
              .replace(/^(?:Q(?:uestion)?\s*\d+|\d+)[\.\)\-\:]\s*/i, '')
              .trim();
          }
        }
        inlineMatches.forEach(m => {
          rawOptions.push({ letter: m[1].toUpperCase(), text: m[2].trim(), isCorrect: false });
        });
        continue;
      }

      if (i === 0 && !questionText) {
        questionText = line.replace(/^(?:Q(?:uestion)?\s*\d+|\d+)[\.\)\-\:]\s*/i, '').trim();
        continue;
      }

      const optMatch = line.match(optPrefixRegex);
      if (optMatch) {
        const letter = optMatch[1] ? optMatch[1].toUpperCase() : undefined;
        rawOptions.push({ letter, text: optMatch[3].trim(), isCorrect: false });
      } else if (rawOptions.length === 0 && questionText && !line.match(/^[a-fA-F][\.\)]/)) {
        rawOptions.push({ text: line, isCorrect: false });
      } else {
        rawOptions.push({ text: line, isCorrect: false });
      }
    }

    let answerIndex = -1;
    const cleanOptions: string[] = [];

    rawOptions.forEach((opt, oIdx) => {
      let text = opt.text;
      let isCorrect = false;

      if (
        /(\*+|\(correct\)|\[correct\]|\bcorrect\b|✅|✓|✔)$/i.test(text) ||
        /^(\*+|✅|✓|✔)\s*/.test(text)
      ) {
        isCorrect = true;
        text = text
          .replace(/(\*+|\(correct\)|\[correct\]|\bcorrect\b|✅|✓|✔)$/i, '')
          .replace(/^(\*+|✅|✓|✔)\s*/, '')
          .trim();
      }

      const currentLetter = opt.letter || String.fromCharCode(65 + oIdx);
      if (explicitAnsLetter && currentLetter === explicitAnsLetter) {
        isCorrect = true;
      }
      if (
        explicitAnsText &&
        text.toLowerCase() === explicitAnsText.replace(/^[\(\[\*]+|[\)\]\*]+$/g, '').toLowerCase()
      ) {
        isCorrect = true;
      }

      if (isCorrect && answerIndex === -1) {
        answerIndex = oIdx;
      }
      cleanOptions.push(text);
    });

    if (questionText && cleanOptions.length >= 2) {
      parsedQuestions.push({
        id: parsedQuestions.length + 1,
        text: questionText,
        options: cleanOptions.slice(0, 6),
        answerIndex: answerIndex !== -1 && answerIndex < 6 ? answerIndex : 0
      });
    }
  });

  return parsedQuestions;
}

export { HamsterPaintball };
