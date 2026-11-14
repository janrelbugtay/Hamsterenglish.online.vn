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
  HelpCircle,
  Flag
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
import { persistUserGameToCloudAndCache } from '../utils/platformCache';
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
  const uid = `h3d-${skin.id}-${team || 'solo'}-${size}`;
  const isRedTeam = team === 'red';
  const isBlueTeam = team === 'blue';
  const hasTeamBand = isRedTeam || isBlueTeam;
  const teamBandHex = isRedTeam ? '#ef4444' : isBlueTeam ? '#2563eb' : skin.paintHex;
  const teamBandHiHex = isRedTeam ? '#fecaca' : isBlueTeam ? '#bfdbfe' : '#ffffff';
  const teamBandDarkHex = isRedTeam ? '#b91c1c' : isBlueTeam ? '#1d4ed8' : skin.badgeBg;
  const activePaintHex = hasTeamBand ? teamBandHex : skin.paintHex;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 116 120"
      className="overflow-visible select-none shrink-0 drop-shadow-[0_6px_12px_rgba(15,23,42,0.22)]"
    >
      <defs>
        {/* Warm Plush 3D Fur Gradient (Vibrant, Never Muddy or Black!) */}
        <radialGradient id={`${uid}-fur`} cx="36%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="22%" stopColor={skin.furHex} />
          <stop offset="78%" stopColor={skin.furHex} />
          <stop offset="100%" stopColor={skin.badgeBg} stopOpacity="0.92" />
        </radialGradient>

        {/* Soft Sculpted Ear Gradient */}
        <radialGradient id={`${uid}-ear`} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="32%" stopColor={skin.furHex} />
          <stop offset="100%" stopColor={skin.badgeBg} />
        </radialGradient>

        {/* Warm Pink Inner Ear Gradient */}
        <radialGradient id={`${uid}-inner`} cx="38%" cy="34%" r="68%">
          <stop offset="0%" stopColor="#fff1f2" />
          <stop offset="45%" stopColor={skin.earInnerHex} />
          <stop offset="100%" stopColor="#f43f5e" />
        </radialGradient>

        {/* Cream Plush Belly & Muzzle Gradient */}
        <radialGradient id={`${uid}-belly`} cx="40%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="68%" stopColor={skin.bellyHex} />
          <stop offset="100%" stopColor={skin.furHex} stopOpacity="0.65" />
        </radialGradient>

        {/* Tactical Armor Vest Gradient */}
        <linearGradient id={`${uid}-vest`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#64748b" />
          <stop offset="45%" stopColor={skin.vestHex} />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Vibrant Team Bandana Gradient */}
        <linearGradient id={`${uid}-band`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={teamBandHiHex} />
          <stop offset="28%" stopColor={teamBandHex} />
          <stop offset="78%" stopColor={teamBandHex} />
          <stop offset="100%" stopColor={teamBandDarkHex} />
        </linearGradient>

        {/* Glossy Pro Paintball Visor Gradient */}
        <linearGradient id={`${uid}-visor`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.88" />
          <stop offset="22%" stopColor={skin.visorHex} />
          <stop offset="78%" stopColor={skin.visorHex} />
          <stop offset="100%" stopColor={teamBandDarkHex} />
        </linearGradient>

        {/* Blaster Metallic Receiver Gradient */}
        <linearGradient id={`${uid}-gun`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={teamBandHiHex} />
          <stop offset="35%" stopColor={hasTeamBand ? teamBandHex : '#0284c7'} />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Paint Hopper Sphere Gradient */}
        <radialGradient id={`${uid}-pod`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="34%" stopColor={activePaintHex} />
          <stop offset="100%" stopColor={teamBandDarkHex} />
        </radialGradient>
      </defs>

      {/* Soft Pedestal Shadow & Team Aura Ring */}
      <ellipse cx="58" cy="109" rx="38" ry="7.5" fill="rgba(15,23,42,0.18)" />
      <ellipse
        cx="58"
        cy="108"
        rx="32"
        ry="5.5"
        fill={hasTeamBand ? teamBandHex : skin.badgeBg}
        opacity="0.45"
      />

      {/* Flowing Team Bandana Tails Behind Head */}
      <g>
        <path
          d="M 85 28 C 99 20, 109 27, 111 37 C 102 40, 93 36, 85 32 Z"
          fill={`url(#${uid}-band)`}
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <path
          d="M 84 33 C 97 34, 105 43, 105 51 C 95 50, 89 42, 83 36 Z"
          fill={`url(#${uid}-band)`}
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <circle cx="87" cy="31" r="6" fill={`url(#${uid}-band)`} stroke="#ffffff" strokeWidth="1.8" />
      </g>

      {/* Sculpted Round Hamster Ears with Crisp White Sticker Rim */}
      <g>
        <circle cx="29" cy="22" r="14.5" fill={`url(#${uid}-ear)`} stroke="#ffffff" strokeWidth="2.8" />
        <circle cx="29" cy="22" r="8.5" fill={`url(#${uid}-inner)`} />
        <ellipse cx="26.5" cy="18.5" rx="3.5" ry="2.2" fill="#ffffff" opacity="0.65" />

        <circle cx="87" cy="22" r="14.5" fill={`url(#${uid}-ear)`} stroke="#ffffff" strokeWidth="2.8" />
        <circle cx="87" cy="22" r="8.5" fill={`url(#${uid}-inner)`} />
        <ellipse cx="84.5" cy="18.5" rx="3.5" ry="2.2" fill="#ffffff" opacity="0.65" />
      </g>

      {/* High-Top Arcade Sneakers at Base */}
      <g>
        <ellipse cx="41" cy="101" rx="13" ry="7.2" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
        <ellipse cx="41" cy="99.5" rx="11" ry="5.5" fill={activePaintHex} />
        <ellipse cx="38.5" cy="98" rx="5" ry="2.2" fill="#ffffff" opacity="0.7" />

        <ellipse cx="75" cy="101" rx="13" ry="7.2" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
        <ellipse cx="75" cy="99.5" rx="11" ry="5.5" fill={activePaintHex} />
        <ellipse cx="72.5" cy="98" rx="5" ry="2.2" fill="#ffffff" opacity="0.7" />
      </g>

      {/* Plump Hamster Torso */}
      <path
        d="M 26 64 C 21 47, 33 40, 58 40 C 83 40, 95 47, 90 64 C 94 86, 82 99, 58 99 C 34 99, 22 86, 26 64 Z"
        fill={`url(#${uid}-fur)`}
        stroke="#ffffff"
        strokeWidth="2.8"
      />

      {/* Plush Cream Belly */}
      <ellipse cx="58" cy="76" rx="22" ry="17" fill={`url(#${uid}-belly)`} />

      {/* Shoulder Armor Pauldrons */}
      <ellipse cx="27" cy="67" rx="9" ry="6.8" fill={`url(#${uid}-vest)`} stroke="#ffffff" strokeWidth="1.8" />
      <ellipse cx="89" cy="67" rx="9" ry="6.8" fill={`url(#${uid}-vest)`} stroke="#ffffff" strokeWidth="1.8" />

      {/* Tactical Paintball Chest Vest */}
      <path
        d="M 33 60 Q 58 65 83 60 L 79 94 Q 58 99 37 94 Z"
        fill={`url(#${uid}-vest)`}
        stroke="#ffffff"
        strokeWidth="2"
      />
      {/* Team Ribbons & Glowing Chest Core */}
      <path d="M 37 62 L 46 63 L 44 91 L 37 89 Z" fill={`url(#${uid}-band)`} />
      <path d="M 79 62 L 70 63 L 72 91 L 79 89 Z" fill={`url(#${uid}-band)`} />
      <rect x="49" y="68.5" width="18" height="13" rx="4.5" fill="#0f172a" stroke="#ffffff" strokeWidth="1.5" />
      <rect x="51" y="70.5" width="14" height="9" rx="3" fill={`url(#${uid}-visor)`} />
      <ellipse cx="55.5" cy="73" rx="3.5" ry="1.5" fill="#ffffff" opacity="0.88" />

      {/* Belt Canisters (Health Can on Left Hip, Shield Can on Right Hip) */}
      <g transform="translate(26, 78) rotate(-8)">
        <rect x="0" y="0" width="9" height="13" rx="3.2" fill="#10b981" stroke="#ffffff" strokeWidth="1.4" />
        <rect x="1.5" y="1.5" width="3" height="9.5" rx="1.2" fill="#a7f3d0" opacity="0.85" />
      </g>
      <g transform="translate(80, 78) rotate(8)">
        <rect x="0" y="0" width="9" height="13" rx="3.2" fill="#0ea5e9" stroke="#ffffff" strokeWidth="1.4" />
        <rect x="1.5" y="1.5" width="3" height="9.5" rx="1.2" fill="#bae6fd" opacity="0.85" />
      </g>

      {/* Big Chubby Hamster Head & Cheeks */}
      <ellipse
        cx="58"
        cy="42"
        rx="34"
        ry="27.5"
        fill={`url(#${uid}-fur)`}
        stroke="#ffffff"
        strokeWidth="2.8"
      />
      <circle cx="28" cy="48.5" r="13" fill={`url(#${uid}-fur)`} />
      <circle cx="88" cy="48.5" r="13" fill={`url(#${uid}-fur)`} />

      {/* Plush Muzzle & Rosy Cheek Blush */}
      <ellipse cx="58" cy="52" rx="22.5" ry="14" fill={`url(#${uid}-belly)`} />
      <ellipse cx="31" cy="51.5" rx="6.8" ry="4.2" fill="#fb7185" opacity="0.82" />
      <ellipse cx="85" cy="51.5" rx="6.8" ry="4.2" fill="#fb7185" opacity="0.82" />
      <ellipse cx="47" cy="23" rx="14" ry="5.2" fill="#ffffff" opacity="0.45" />

      {/* Distinct Character Headgear */}
      {skin.headgear === 'Helmet' && (
        <path
          d="M 26 28 C 28 9, 88 9, 90 28 Z"
          fill={`url(#${uid}-vest)`}
          stroke="#ffffff"
          strokeWidth="2"
        />
      )}
      {skin.headgear === 'SpecOps' && (
        <g>
          <path d="M 27 27 C 31 11, 85 11, 89 27 Z" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
          <circle cx="45" cy="18" r="4.8" fill="#22c55e" stroke="#ffffff" strokeWidth="1.4" />
          <circle cx="43.8" cy="16.8" r="1.6" fill="#ffffff" />
          <circle cx="71" cy="18" r="4.8" fill="#22c55e" stroke="#ffffff" strokeWidth="1.4" />
          <circle cx="69.8" cy="16.8" r="1.6" fill="#ffffff" />
        </g>
      )}
      {skin.headgear === 'Crown' && (
        <polygon
          points="37,20 45,4 58,14 71,4 79,20"
          fill="#facc15"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      )}
      {skin.headgear === 'Cyber' && (
        <g>
          <polygon
            points="35,20 58,5 81,20"
            fill="#facc15"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="58" cy="14" r="4" fill="#7c3aed" stroke="#ffffff" strokeWidth="1.2" />
        </g>
      )}
      {skin.headgear === 'Blossom' && (
        <g>
          <circle cx="39" cy="15" r="7" fill="#f472b6" stroke="#ffffff" strokeWidth="1.8" />
          <circle cx="39" cy="15" r="3" fill="#fef08a" />
          <circle cx="77" cy="15" r="7" fill="#f472b6" stroke="#ffffff" strokeWidth="1.8" />
          <circle cx="77" cy="15" r="3" fill="#fef08a" />
        </g>
      )}
      {skin.headgear === 'Flame' && (
        <g>
          <polygon
            points="41,21 50,3 58,14 66,2 75,21"
            fill="#f97316"
            stroke="#ffffff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <polygon points="48,20 58,7 68,20" fill="#fef08a" />
        </g>
      )}
      {skin.headgear === 'Astro' && (
        <g>
          <line x1="58" y1="17" x2="58" y2="4" stroke="#64748b" strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="58" cy="4.5" r="5.5" fill={`url(#${uid}-visor)`} stroke="#ffffff" strokeWidth="1.8" />
          <circle cx="56.5" cy="3" r="2" fill="#ffffff" />
        </g>
      )}
      {skin.headgear === 'Samurai' && (
        <g>
          <polygon points="58,19 36,3 48,20" fill="#facc15" stroke="#ffffff" strokeWidth="1.8" />
          <polygon points="58,19 80,3 68,20" fill="#facc15" stroke="#ffffff" strokeWidth="1.8" />
        </g>
      )}
      {skin.headgear === 'Headphones' && (
        <g>
          <path d="M 21 36 C 21 9, 95 9, 95 36" fill="none" stroke="#84cc16" strokeWidth="5" strokeLinecap="round" />
          <rect x="15" y="28" width="10.5" height="18" rx="5" fill="#ec4899" stroke="#ffffff" strokeWidth="1.8" />
          <rect x="90.5" y="28" width="10.5" height="18" rx="5" fill="#ec4899" stroke="#ffffff" strokeWidth="1.8" />
        </g>
      )}
      {skin.headgear === 'Cowboy' && (
        <g>
          <ellipse cx="58" cy="18.5" rx="35" ry="6.2" fill="#92400e" stroke="#ffffff" strokeWidth="1.8" />
          <path
            d="M 38 18.5 C 40 4, 52 7, 58 10 C 64 7, 76 4, 78 18.5 Z"
            fill="#d97706"
            stroke="#ffffff"
            strokeWidth="1.8"
          />
          <circle cx="58" cy="14.5" r="3.2" fill="#facc15" />
        </g>
      )}
      {skin.headgear === 'Viking' && (
        <g>
          <path
            d="M 34 22 C 24 7, 16 9, 20 2 C 29 2, 36 11, 40 18 Z"
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth="1.8"
          />
          <path
            d="M 82 22 C 92 7, 100 9, 96 2 C 87 2, 80 11, 76 18 Z"
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth="1.8"
          />
        </g>
      )}

      {/* Wrap-Around Team Headband */}
      <g>
        <path
          d="M 24 31.5 Q 58 22 92 31.5 L 91 22 Q 58 12.5 25 22 Z"
          fill={`url(#${uid}-band)`}
          stroke="#ffffff"
          strokeWidth="1.8"
        />
        <rect x="49" y="20" width="18" height="7.5" rx="3.8" fill="#ffffff" />
        <rect x="51" y="21.5" width="14" height="4.5" rx="2.2" fill={teamBandHex} />
      </g>

      {/* Pro Paintball Visor & Expressive Glossy Eyes */}
      <rect x="26" y="30" width="64" height="19.5" rx="9.8" fill="#1e293b" stroke="#ffffff" strokeWidth="2" />
      <rect x="28.5" y="32" width="59" height="15.5" rx="7.8" fill={`url(#${uid}-visor)`} />
      {/* Expressive Eyes with Triple Catchlights */}
      <circle cx="44" cy="39.8" r="5.2" fill="#0f172a" />
      <circle cx="42.2" cy="37.8" r="2.2" fill="#ffffff" />
      <circle cx="45.8" cy="41.2" r="1.1" fill="#ffffff" opacity="0.9" />
      <circle cx="72" cy="39.8" r="5.2" fill="#0f172a" />
      <circle cx="70.2" cy="37.8" r="2.2" fill="#ffffff" />
      <circle cx="73.8" cy="41.2" r="1.1" fill="#ffffff" opacity="0.9" />
      {/* Curved Lens Glint */}
      <path
        d="M 33 34.5 Q 58 31.5 82 34.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity="0.88"
      />

      {/* Cute Pink Nose, Confident Smile & Buck Tooth */}
      <ellipse cx="58" cy="51" rx="4.8" ry="3.4" fill="#f43f5e" />
      <ellipse cx="56.5" cy="50" rx="1.8" ry="1.1" fill="#ffffff" opacity="0.85" />
      <path
        d="M 51.5 56 Q 58 61 64.5 56"
        fill="none"
        stroke="#1e293b"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <rect x="55.6" y="57.4" width="4.8" height="4.4" rx="1.4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />

      {/* Left Paw */}
      <ellipse cx="27" cy="74" rx="9" ry="7.5" fill={`url(#${uid}-fur)`} stroke="#ffffff" strokeWidth="2" />
      <ellipse cx="25" cy="72" rx="3.5" ry="2" fill="#ffffff" opacity="0.55" />

      {/* Pro Paintball Marker Held Across Chest */}
      <g transform="rotate(-9 65 74)">
        <rect x="48" y="77" width="16" height="7" rx="3.5" fill="#1e293b" stroke="#ffffff" strokeWidth="1.2" />
        <ellipse cx="65" cy="61" rx="11" ry="7.4" fill={`url(#${uid}-pod)`} stroke="#ffffff" strokeWidth="1.8" />
        <ellipse cx="62" cy="59" rx="4.5" ry="2" fill="#ffffff" opacity="0.8" />
        <rect x="53" y="67" width="35" height="11" rx="5.5" fill={`url(#${uid}-gun)`} stroke="#ffffff" strokeWidth="1.8" />
        <rect x="57" y="69" width="22" height="2.8" rx="1.4" fill="#ffffff" opacity="0.6" />
        <rect x="84" y="69" width="14.5" height="7" rx="3.5" fill="#1e293b" stroke="#ffffff" strokeWidth="1.4" />
        <circle cx="98.5" cy="72.5" r="4.2" fill={activePaintHex} stroke="#ffffff" strokeWidth="1.4" />
        <circle cx="97.2" cy="71.2" r="1.5" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Right Paw Gripping Marker */}
      <ellipse cx="87" cy="76" rx="9" ry="7.5" fill={`url(#${uid}-fur)`} stroke="#ffffff" strokeWidth="2" />
      <ellipse cx="85" cy="74" rx="3.5" ry="2" fill="#ffffff" opacity="0.55" />
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
    colorHex: '#10b981',
    colorNum: 0xa3e635,
    bgClass: 'bg-emerald-100 text-emerald-800',
    borderClass: 'border-emerald-400'
  },
  red: {
    label: 'Red Squad',
    colorHex: '#ef4444',
    colorNum: 0xef4444,
    bgClass: 'bg-rose-100 text-rose-700',
    borderClass: 'border-rose-400'
  },
  blue: {
    label: 'Blue Squad',
    colorHex: '#2563eb',
    colorNum: 0x2563eb,
    bgClass: 'bg-sky-100 text-sky-700',
    borderClass: 'border-sky-400'
  },
  green: {
    label: 'Emerald Squad',
    colorHex: '#10b981',
    colorNum: 0x10b981,
    bgClass: 'bg-emerald-100 text-emerald-700',
    borderClass: 'border-emerald-400'
  },
  gold: {
    label: 'Gold Squad',
    colorHex: '#d97706',
    colorNum: 0xfacc15,
    bgClass: 'bg-amber-100 text-amber-800',
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

  // Subtle Sci-Fi Target Lock-On Chirp (throttled on reticle enemy lock)
  lastTargetLockAt: number = 0;
  playTargetLock() {
    if (!this.enabled) return;
    const perfNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (perfNow - this.lastTargetLockAt < 650) return;
    this.lastTargetLockAt = perfNow;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [1174.66, 1567.98].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.035);
      g.gain.setValueAtTime(0.085, now + idx * 0.035);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.075);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.035);
      osc.stop(now + idx * 0.035 + 0.08);
    });
  }

  // Crystalline Electric Shield Break Shatter
  playShieldBreak() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [987.77, 739.99, 554.37, 369.99].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.03);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + idx * 0.03 + 0.14);
      g.gain.setValueAtTime(0.14, now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.16);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + idx * 0.03);
      osc.stop(now + idx * 0.03 + 0.17);
    });
  }

  // Tactile Optical Camera View Switch Click-Whir
  playCameraSwitch() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.07);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Stadium Match Start Brass Horn Fanfare
  playMatchStartHorn() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [
      { f: 523.25, t: 0, d: 0.13 },
      { f: 659.25, t: 0.12, d: 0.13 },
      { f: 783.99, t: 0.24, d: 0.15 },
      { f: 1046.5, t: 0.38, d: 0.42 }
    ];
    notes.forEach(n => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now + n.t);
      osc.frequency.setValueAtTime(n.f, now + n.t);
      g.gain.setValueAtTime(0.16, now + n.t);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  }

  // Grand Championship Victory Fanfare
  playVictoryFanfare() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fanfare = [
      { f: 523.25, t: 0.0, d: 0.16 },
      { f: 659.25, t: 0.14, d: 0.16 },
      { f: 783.99, t: 0.28, d: 0.18 },
      { f: 1046.5, t: 0.46, d: 0.28 },
      { f: 783.99, t: 0.72, d: 0.16 },
      { f: 1046.5, t: 0.88, d: 0.55 },
      { f: 1318.51, t: 0.88, d: 0.55 }
    ];
    fanfare.forEach(n => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.f, now + n.t);
      g.gain.setValueAtTime(0.19, now + n.t);
      g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.03);
    });
  }

  // Athletic Spring Jump SFX
  playJump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(490, now + 0.13);
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Tactical Gear Crouch / Crawl Foley SFX
  playStanceChange(toStance: 'stand' | 'crouch' | 'crawl') {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    const startF = toStance === 'stand' ? 220 : toStance === 'crouch' ? 310 : 260;
    const endF = toStance === 'stand' ? 360 : toStance === 'crouch' ? 185 : 135;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.09);
    g.gain.setValueAtTime(0.11, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Crisp PUBG 2x Optic ADS Scope Click
  playScopeToggle(scopedIn: boolean) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(scopedIn ? 680 : 920, now);
    osc.frequency.exponentialRampToValueAtTime(scopedIn ? 1080 : 620, now + 0.065);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
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
// COMPACT ARENA CONSTANTS & MULTIPLAYER DATA INTERFACES
// =============================================================
const ARENA_HALF_W = 38;
const ARENA_HALF_D = 32;
const TEAM_SPAWN_Z = 24;
const HAMSTER_HERO_SCALE = 1.18;

const shortestAngleDelta = (fromRad: number, toRad: number): number => {
  let diff = (toRad - fromRad) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
};

interface CombatNetEvent {
  id: string;
  type: 'shot' | 'hit' | 'ko';
  ownerId: string;
  ownerName?: string;
  ownerTeam?: TeamId;
  x?: number;
  z?: number;
  angle?: number;
  paintColor?: number;
  targetId?: string;
  damage?: number;
  attackerId?: string;
  attackerName?: string;
  victimName?: string;
  ts: number;
}

interface PlayerNetworkState {
  id: string;
  name: string;
  role: 'host' | 'player';
  team: TeamId;
  skinIdx: number;
  x: number;
  y?: number;
  z: number;
  vx?: number;
  vz?: number;
  rotY: number;
  stance?: 'stand' | 'crouch' | 'crawl';
  hp: number;
  shield: number;
  score: number;
  kos: number;
  hitsLanded?: number;
  bestStreak?: number;
  immuneUntil?: number;
  immuneRemainingMs?: number;
  questionsAnswered: number;
  questionsCorrect?: number;
  questionsWrong?: number;
  seq?: number;
  matchEpoch?: number;
  lastStartedAt?: number;
  updatedAt: number;
  kicked?: boolean;
  recentEvents?: CombatNetEvent[];
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

  // Detect if user arrived via QR code / student room code link (supports both query string and hash)
  const getInitialRoomSetup = (): { code: string; isJoiningStudent: boolean } => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      let urlRoom = params.get('room') || params.get('paintballRoom') || params.get('joinCode');
      let roleParam = params.get('role');
      if (!urlRoom && window.location.hash) {
        const qPart = window.location.hash.includes('?')
          ? window.location.hash.split('?')[1]
          : window.location.hash.replace(/^#\/?/, '');
        const hashParams = new URLSearchParams(qPart);
        urlRoom =
          hashParams.get('room') ||
          hashParams.get('paintballRoom') ||
          hashParams.get('joinCode');
        if (!roleParam) roleParam = hashParams.get('role');
      }
      if (urlRoom && /^[0-9A-Za-z]{4,8}$/.test(urlRoom.trim())) {
        return {
          code: urlRoom.trim().toUpperCase().slice(0, 6),
          isJoiningStudent: roleParam !== 'host'
        };
      }
    }
    if (initialGame?.roomCode && String(initialGame.roomCode).trim()) {
      return {
        code: String(initialGame.roomCode).trim().toUpperCase().slice(0, 6),
        isJoiningStudent: true
      };
    }
    const savedCode =
      typeof window !== 'undefined' ? sessionStorage.getItem('hamster_pb_room_code') : null;
    if (savedCode && /^[0-9A-Za-z]{4,6}$/.test(savedCode)) {
      return { code: savedCode.toUpperCase(), isJoiningStudent: false };
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
      const codeClean = String(initialGame.roomCode).trim().toUpperCase().slice(0, 6);
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

  const savingQuizRef = useRef(false);
  const saveQuiz = async (
    updatedQuiz: Quiz,
    afterSaveDestination: 'lobby' | 'games' = 'lobby'
  ) => {
    setActiveQuiz(updatedQuiz);
    if (savingQuizRef.current) return;
    savingQuizRef.current = true;

    try {
      const isPublicBool = Boolean(updatedQuiz.isPublic);
      const now = new Date().toISOString();

      const gameToSave = JSON.parse(
        JSON.stringify({
          name: updatedQuiz.title || updatedQuiz.topic || 'Hamster Paintball Game',
          title: updatedQuiz.title || updatedQuiz.topic || 'Hamster Paintball Game',
          folderId: updatedQuiz.folderId || '',
          topic: updatedQuiz.topic || '',
          className: updatedQuiz.classLevel || '',
          gameType: 'hamster-paintball',
          customQuestions: updatedQuiz.questions,
          userId: user?.uid || 'local-user',
          creatorName: user?.displayName || user?.email?.split('@')[0] || 'Teacher',
          creatorEmail: user?.email || '',
          updatedAt: now,
          publishedAt: isPublicBool ? now : initialGame?.publishedAt || null,
          createdAt: initialGame?.createdAt || now,
          isPublic: isPublicBool
        })
      );

      await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: initialGame,
      });
    } catch (e) {
      console.warn('Could not save paintball quiz:', e);
    } finally {
      savingQuizRef.current = false;
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

  // Helper: Calculate Top Middle (Red Squad: 0, -24) or Bottom Middle (Blue Squad: 0, +24) Spawn Position in the Compact 76m x 64m Speedball Park
  const getTeamSpawnPosition = (team: TeamId, mode: 'solo' | 'teams', slotIndex?: number) => {
    const resolvedTeam: 'red' | 'blue' =
      mode === 'teams'
        ? team === 'blue'
          ? 'blue'
          : 'red'
        : Math.random() < 0.5
        ? 'red'
        : 'blue';
    const baseX = 0;
    const baseZ = resolvedTeam === 'red' ? -TEAM_SPAWN_Z : TEAM_SPAWN_Z;
    let jitterX: number;
    let jitterZ: number;
    if (typeof slotIndex === 'number') {
      const col = slotIndex % 4;
      const row = Math.floor(slotIndex / 4) % 2;
      jitterX = (col - 1.5) * 3.1;
      jitterZ = (row - 0.5) * 2.1;
    } else {
      jitterX = Number(((Math.random() - 0.5) * 9.0).toFixed(2));
      jitterZ = Number(((Math.random() - 0.5) * 3.2).toFixed(2));
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
  const [questionsCorrect, setQuestionsCorrect] = useState<number>(0);
  const [questionsWrong, setQuestionsWrong] = useState<number>(0);
  const [koBannerText, setKoBannerText] = useState<string | null>(null);
  const [pickupBannerText, setPickupBannerText] = useState<string | null>(null);
  const [scorePopups, setScorePopups] = useState<
    Array<{ id: string; points: number; label: string; color: string }>
  >([]);

  // Arcade Combat Feel: Reticle Hit Marker, 3D-Projected Floating Damage Numbers, Incoming Damage Vignette & Kill-Streak Callouts
  const [hitMarkerFlash, setHitMarkerFlash] = useState<{
    id: string;
    xPct: number;
    yPct: number;
    isShield: boolean;
  } | null>(null);
  const [floatingDamages, setFloatingDamages] = useState<
    Array<{
      id: string;
      damage: number;
      xPct: number;
      yPct: number;
      isShield: boolean;
      targetName: string;
    }>
  >([]);
  const [damageVignetteColor, setDamageVignetteColor] = useState<string | null>(null);
  const [killStreakCallout, setKillStreakCallout] = useState<{
    id: string;
    streak: number;
    title: string;
    subtitle: string;
    colorClass: string;
  } | null>(null);
  const [isEnemyTargeted, setIsEnemyTargeted] = useState<boolean>(false);
  const isEnemyTargetedRef = useRef<boolean>(false);

  // Project 3D world coordinate to 2D screen percentage for floating damage numbers & hit markers
  const projectWorldToScreenPct = (worldX: number, worldY: number, worldZ: number) => {
    const cam = gameRef.current?.camera;
    if (!cam) return { xPct: 50, yPct: 46 };
    const vec = new THREE.Vector3(worldX, worldY, worldZ);
    vec.project(cam);
    const xPct = Math.max(12, Math.min(88, (vec.x * 0.5 + 0.5) * 100));
    const yPct = Math.max(15, Math.min(82, (-vec.y * 0.5 + 0.5) * 100));
    return { xPct, yPct };
  };

  const spawnCombatHitFeedback = (
    worldX: number,
    worldY: number,
    worldZ: number,
    damage: number,
    isShield: boolean,
    targetName: string
  ) => {
    const { xPct, yPct } = projectWorldToScreenPct(worldX, worldY, worldZ);
    const jitterX = (Math.random() - 0.5) * 3.5;
    const hitId = `hm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    setHitMarkerFlash({ id: hitId, xPct, yPct, isShield });
    setTimeout(() => {
      setHitMarkerFlash(prev => (prev?.id === hitId ? null : prev));
    }, 210);

    setFloatingDamages(prev => [
      ...prev.slice(-5),
      {
        id: hitId,
        damage,
        xPct: xPct + jitterX,
        yPct,
        isShield,
        targetName
      }
    ]);
    setTimeout(() => {
      setFloatingDamages(prev => prev.filter(d => d.id !== hitId));
    }, 950);
  };

  const triggerKillStreakCallout = (streak: number, victimName: string) => {
    if (streak < 2) return;
    const calloutId = `ks-${Date.now()}`;
    let title = '🔥 DOUBLE SPLAT!';
    let colorClass = 'from-amber-500 via-orange-500 to-rose-500 border-amber-200';
    if (streak === 3) {
      title = '⚡ TRIPLE SPLAT!';
      colorClass = 'from-cyan-400 via-blue-500 to-indigo-600 border-cyan-200';
    } else if (streak === 4) {
      title = '💥 MEGA SPLAT!';
      colorClass = 'from-fuchsia-500 via-purple-600 to-pink-500 border-pink-200';
    } else if (streak >= 5) {
      title = '👑 UNSTOPPABLE!';
      colorClass = 'from-lime-400 via-emerald-500 to-teal-600 border-white';
    }
    setKillStreakCallout({
      id: calloutId,
      streak,
      title,
      subtitle: `${streak}x KILL STREAK • SPLATTERED ${victimName.toUpperCase()}!`,
      colorClass
    });
    setTimeout(() => {
      setKillStreakCallout(prev => (prev?.id === calloutId ? null : prev));
    }, 2600);
  };

  // Helper to compute per-player Question Accuracy (%), Correct count, and Wrong count
  const getPlayerQuestionStats = (p: {
    questionsCorrect?: number;
    questionsWrong?: number;
    questionsAnswered?: number;
  }) => {
    const correct =
      typeof p.questionsCorrect === 'number' ? p.questionsCorrect : p.questionsAnswered || 0;
    const wrong = typeof p.questionsWrong === 'number' ? p.questionsWrong : 0;
    const total = correct + wrong;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, wrong, total, accuracy };
  };

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

  // Mobile Touch Virtual Joystick + Separate Camera & Aim Settings + Camera View Presets
  const [joystickVec, setJoystickVec] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [cameraSensitivity, setCameraSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.0;
    const saved = parseFloat(
      localStorage.getItem('pb_camera_sensitivity') ||
        localStorage.getItem('pb_look_sensitivity') ||
        '1.0'
    );
    return Number.isFinite(saved) ? Math.max(0.2, Math.min(2.5, saved)) : 1.0;
  });

  const [aimSensitivity, setAimSensitivity] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.0;
    const saved = parseFloat(localStorage.getItem('pb_aim_sensitivity') || '1.0');
    return Number.isFinite(saved) ? Math.max(0.2, Math.min(2.5, saved)) : 1.0;
  });

  const [cameraViewPreset, setCameraViewPreset] = useState<
    'close' | 'balanced' | 'far' | 'tactical'
  >(() => {
    if (typeof window === 'undefined') return 'balanced';
    const saved = localStorage.getItem('pb_camera_view_preset');
    if (saved === 'close' || saved === 'balanced' || saved === 'far' || saved === 'tactical') {
      return saved;
    }
    return 'balanced';
  });

  const [aimControlMode, setAimControlMode] = useState<'shoulder' | 'separate'>(() => {
    if (typeof window === 'undefined') return 'shoulder';
    const saved = localStorage.getItem('pb_aim_control_mode');
    return saved === 'separate' ? 'separate' : 'shoulder';
  });

  const [aimReticlePct, setAimReticlePct] = useState<{ x: number; y: number }>({ x: 50, y: 46 });
  const aimReticlePctRef = useRef<{ x: number; y: number }>({ x: 50, y: 46 });

  // PUBG Stance ('stand' | 'crouch' | 'crawl'), ADS 2x Scope, Dynamic Crosshair Bloom & Auto Laptop/Touch HUD Detection
  const [playerStance, setPlayerStance] = useState<'stand' | 'crouch' | 'crawl'>('stand');
  const playerStanceRef = useRef<'stand' | 'crouch' | 'crawl'>('stand');
  const [isAdsScoped, setIsAdsScoped] = useState<boolean>(false);
  const isAdsScopedRef = useRef<boolean>(false);
  const [isAimLocked, setIsAimLocked] = useState<boolean>(false);
  const [crosshairSpreadPx, setCrosshairSpreadPx] = useState<number>(8);
  const crosshairSpreadRef = useRef<number>(8);

  const [controlLayoutMode, setControlLayoutMode] = useState<'auto' | 'laptop' | 'touch'>(() => {
    if (typeof window === 'undefined') return 'auto';
    const saved = localStorage.getItem('pb_control_layout_mode');
    if (saved === 'laptop' || saved === 'touch' || saved === 'auto') return saved;
    return 'auto';
  });

  const [detectedTouchDevice, setDetectedTouchDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(
      window.matchMedia?.('(pointer: coarse)').matches &&
        !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    );
  });

  const isTouchHudVisible =
    controlLayoutMode === 'touch' || (controlLayoutMode === 'auto' && detectedTouchDevice);

  useEffect(() => {
    playerStanceRef.current = playerStance;
  }, [playerStance]);

  useEffect(() => {
    isAdsScopedRef.current = isAdsScoped;
  }, [isAdsScoped]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_control_layout_mode', controlLayoutMode);
    }
  }, [controlLayoutMode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onPointerLockChange = () => {
      const locked = Boolean(document.pointerLockElement);
      if (!locked && gameRef.current && !gameRef.current.virtualMouseLock) {
        setIsAimLocked(false);
      } else if (locked) {
        setIsAimLocked(true);
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => document.removeEventListener('pointerlockchange', onPointerLockChange);
  }, []);

  const triggerPlayerJump = () => {
    const g = gameRef.current;
    if (!g) return;
    // PUBG behavior: if crawling/prone, pressing Jump stands up cleanly; if standing or crouching on ground, stands & jumps!
    if (playerStanceRef.current === 'crawl') {
      playerStanceRef.current = 'stand';
      setPlayerStance('stand');
      sfx.playStanceChange('stand');
      return;
    }
    if (playerStanceRef.current === 'crouch') {
      playerStanceRef.current = 'stand';
      setPlayerStance('stand');
    }
    if (g.y <= 0.08) {
      g.jumpVy = 9.6;
      g.y = Math.max(0.02, g.y);
      g.recoilBloom = Math.min(22, g.recoilBloom + 6);
      sfx.playJump();
    }
  };

  const togglePlayerStance = (target: 'crouch' | 'crawl') => {
    const g = gameRef.current;
    if (g && g.y > 0.25) return; // Cannot enter crouch/prone mid-air
    const nextStance: 'stand' | 'crouch' | 'crawl' =
      playerStanceRef.current === target ? 'stand' : target;
    playerStanceRef.current = nextStance;
    setPlayerStance(nextStance);
    sfx.playStanceChange(nextStance);
  };

  const toggleAdsScope = (forceState?: boolean) => {
    const next = typeof forceState === 'boolean' ? forceState : !isAdsScopedRef.current;
    if (next === isAdsScopedRef.current) return;
    isAdsScopedRef.current = next;
    setIsAdsScoped(next);
    sfx.playScopeToggle(next);
  };

  const lookSensitivity = cameraSensitivity;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_camera_sensitivity', String(cameraSensitivity));
      localStorage.setItem('pb_look_sensitivity', String(cameraSensitivity));
    }
  }, [cameraSensitivity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_aim_sensitivity', String(aimSensitivity));
    }
  }, [aimSensitivity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_camera_view_preset', cameraViewPreset);
    }
  }, [cameraViewPreset]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pb_aim_control_mode', aimControlMode);
    }
    if (aimControlMode === 'shoulder') {
      aimReticlePctRef.current = { x: 50, y: 46 };
      setAimReticlePct({ x: 50, y: 46 });
    }
  }, [aimControlMode]);

  const cycleCameraViewPreset = () => {
    const order: Array<'close' | 'balanced' | 'far' | 'tactical'> = [
      'close',
      'balanced',
      'far',
      'tactical'
    ];
    setCameraViewPreset(prev => {
      const next = order[(order.indexOf(prev) + 1) % order.length];
      return next;
    });
    sfx.playCameraSwitch();
  };

  // Persistent Client Session ID in sessionStorage so page refreshes reclaim the same hamster instead of spawning ghosts!
  const clientIdRef = useRef<string>(
    (() => {
      if (typeof window !== 'undefined') {
        const savedId = sessionStorage.getItem('hamster_pb_client_id');
        if (savedId && /^pb_[a-z0-9]{6,14}$/i.test(savedId)) {
          return savedId;
        }
        const fresh = `pb_${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem('hamster_pb_client_id', fresh);
        return fresh;
      }
      return `pb_${Math.random().toString(36).slice(2, 10)}`;
    })()
  );

  // Dual-Domain Join Routing: Supports both the active host URL (`window.location.origin`) and `https://www.hamsterenglish.online`
  const [joinDomainMode, setJoinDomainMode] = useState<'current' | 'hamsterenglish'>('current');
  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://www.hamsterenglish.online';
  const isCurrentOriginHamsterEnglish = /(^|:\/\/)(www\.)?hamsterenglish\.online$/i.test(
    currentOrigin.replace(/\/+$/, '')
  );
  const activeJoinBaseOrigin =
    joinDomainMode === 'hamsterenglish' && !isCurrentOriginHamsterEnglish
      ? 'https://www.hamsterenglish.online'
      : currentOrigin;
  const liveJoinUrl = `${activeJoinBaseOrigin}/?game=hamster-paintball&room=${roomCode}`;
  const liveDisplayHost = activeJoinBaseOrigin.replace(/^https?:\/\//, '');

  // Discovered Host API Origin (from Firestore room doc) so students on hamsterenglish.online can also hit the Host's CORS-enabled API directly!
  const hostApiOriginRef = useRef<string>('');

  // Server Clock Calibration (`serverNow - Date.now()`) so timers, immunity & spawn-hold never skew across phones/tablets!
  const serverTimeOffsetRef = useRef<number>(0);
  const calibrateServerClock = (serverNow: unknown) => {
    if (typeof serverNow === 'number' && Number.isFinite(serverNow) && serverNow > 1_600_000_000_000) {
      const sampleOffset = serverNow - Date.now();
      serverTimeOffsetRef.current =
        serverTimeOffsetRef.current === 0
          ? sampleOffset
          : Math.round(serverTimeOffsetRef.current * 0.7 + sampleOffset * 0.3);
    }
  };
  const getServerNow = () => Date.now() + serverTimeOffsetRef.current;

  // Bounded Combat Event Ring Buffer Queue (prevents dropped shots/hits/KOs when firing rapidly every 185ms!)
  const pendingCombatEventsRef = useRef<CombatNetEvent[]>([]);
  const recentCombatEventsRef = useRef<CombatNetEvent[]>([]);
  const processCombatEventsRef = useRef<(events?: CombatNetEvent[]) => void>(() => {});
  const queueCombatEvent = (ev: CombatNetEvent) => {
    seenNetworkEventsRef.current.add(ev.id);
    pendingCombatEventsRef.current.push(ev);
    if (pendingCombatEventsRef.current.length > 24) {
      pendingCombatEventsRef.current = pendingCombatEventsRef.current.slice(-24);
    }
    const cutoff = getServerNow() - 6000;
    recentCombatEventsRef.current = [
      ...recentCombatEventsRef.current.filter(item => item.ts >= cutoff),
      ev
    ].slice(-14);
  };

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

  // Keep roomCode in sessionStorage and reset merged players cache on room change
  useEffect(() => {
    if (typeof window === 'undefined' || !roomCode) return;
    sessionStorage.setItem('hamster_pb_room_code', roomCode);
    mergedPlayersMapRef.current.clear();
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
    y: number;
    jumpVy: number;
    z: number;
    rotY: number;
    camYaw: number;
    camPitch: number;
    camDistCurrent: number;
    camHeightCurrent: number;
    camShoulderCurrent: number;
    camKick: number;
    crouchLerp: number;
    crawlLerp: number;
    adsLerp: number;
    recoilBloom: number;
    shoulderSide: 1 | -1;
    virtualMouseLock: boolean;
    vx: number;
    vz: number;
    walkPhase: number;
    keys: Record<string, boolean>;
    joyX: number;
    joyZ: number;
    mouseDown: boolean;
    isCameraDragging: boolean;
    dragMovedPx: number;
    usingMouseAim: boolean;
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
    aimWorldY?: number;
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
    shockwaves: Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshBasicMaterial;
      life: number;
      maxLife: number;
      startScale: number;
      endScale: number;
    }>;
    remotePlayers: Map<
      string,
      {
        data: PlayerNetworkState;
        mesh: THREE.Group;
        walkPhase: number;
        lastLocalRecvAt?: number;
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

  // Celebratory Fanfares on Match Start & Winner Announcement
  const prevMatchStatusAudioRef = useRef<string>(matchStatus);
  useEffect(() => {
    if (prevMatchStatusAudioRef.current !== 'playing' && matchStatus === 'playing') {
      sfx.playMatchStartHorn();
    }
    prevMatchStatusAudioRef.current = matchStatus;
  }, [matchStatus]);

  useEffect(() => {
    if (screen === 'results') {
      sfx.playVictoryFanfare();
    }
  }, [screen]);

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

  const isAnyModalOpen =
    isQuestionModalOpen || isSettingsOpen || isQrModalOpen || isLeaderboardOpen;

  // Reset all movement, mouse, and touch inputs whenever any modal opens, screen changes, or focus blurs
  const resetAllActiveInputs = () => {
    joystickTouchIdRef.current = null;
    setJoystickVec({ x: 0, y: 0 });
    isAdsScopedRef.current = false;
    setIsAdsScoped(false);
    setIsAimLocked(false);
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      try {
        document.exitPointerLock();
      } catch {}
    }
    const g = gameRef.current;
    if (g) {
      g.keys = {};
      g.joyX = 0;
      g.joyZ = 0;
      g.vx = 0;
      g.vz = 0;
      g.mouseDown = false;
      g.isCameraDragging = false;
      g.virtualMouseLock = false;
      g.dragMovedPx = 0;
      g.shootButtonHeld = false;
      g.lookTouchId = null;
      g.mouseInitialized = false;
    }
  };

  useEffect(() => {
    if (isAnyModalOpen || screen !== 'game') {
      resetAllActiveInputs();
    }
  }, [isAnyModalOpen, screen, matchStatus]);

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
    questionsCorrect,
    questionsWrong,
    ammo,
    healthCans,
    shieldCans,
    holdingCanType,
    screen,
    matchMode,
    matchStatus,
    matchSeconds,
    isTimerPaused,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex,
    roomPlayers,
    lookSensitivity,
    cameraSensitivity,
    aimSensitivity,
    cameraViewPreset,
    aimControlMode,
    playerStance,
    isAdsScoped,
    isTouchHudVisible,
    isAnyModalOpen
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
      questionsCorrect,
      questionsWrong,
      ammo,
      healthCans,
      shieldCans,
      holdingCanType,
      screen,
      matchMode,
      matchStatus,
      matchSeconds,
      isTimerPaused,
      ballsPerQuestion,
      hostCameraMode,
      hostFollowIndex,
      roomPlayers,
      lookSensitivity,
      cameraSensitivity,
      aimSensitivity,
      cameraViewPreset,
      aimControlMode,
      playerStance,
      isAdsScoped,
      isTouchHudVisible,
      isAnyModalOpen
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
    questionsCorrect,
    questionsWrong,
    ammo,
    healthCans,
    shieldCans,
    holdingCanType,
    screen,
    matchMode,
    matchStatus,
    matchSeconds,
    isTimerPaused,
    ballsPerQuestion,
    hostCameraMode,
    hostFollowIndex,
    roomPlayers,
    lookSensitivity,
    cameraSensitivity,
    aimSensitivity,
    cameraViewPreset,
    aimControlMode,
    playerStance,
    isAdsScoped,
    isTouchHudVisible,
    isAnyModalOpen
  ]);

  // 10-Second Respawn Immunity Countdown Ticker (Server-clock calibrated)
  useEffect(() => {
    if (immuneUntil <= getServerNow()) {
      setImmunitySecondsLeft(0);
      return;
    }
    const updateImmunity = () => {
      const remMs = immuneUntil - getServerNow();
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

  // Match Start Spawn Hold Ticker (Server-clock calibrated)
  useEffect(() => {
    if (spawnHoldUntil <= getServerNow()) {
      setSpawnHoldSecondsLeft(0);
      return;
    }
    const updateHold = () => {
      const remMs = spawnHoldUntil - getServerNow();
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
          // Burst celebratory 3D healing/shield aura particles + expanding energy shockwaves
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
          spawnShockwaveRing(gNow.x, 0.22, gNow.z, burstColor, 0.7, 3.6, 0.48, true);
          spawnShockwaveRing(gNow.x, 1.35, gNow.z, 0xffffff, 0.5, 2.8, 0.36, true);
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

  const matchEndedEpochRef = useRef<number>(0);

  // Match Countdown Timer (Wall-clock anchored so background tab throttling never causes Host & Player timers to drift apart!)
  useEffect(() => {
    if (isTimerPaused || matchStatus !== 'playing') return;
    if (role === 'player' && screen !== 'game') return;
    let lastWallMs = Date.now();
    const timer = setInterval(() => {
      const nowMs = Date.now();
      const elapsedSec = Math.floor((nowMs - lastWallMs) / 1000);
      if (elapsedSec < 1) return;
      lastWallMs += elapsedSec * 1000;

      setMatchSeconds(prev => {
        if (prev <= elapsedSec) {
          matchEndedEpochRef.current = Math.max(
            matchEndedEpochRef.current,
            lastStartedAtRef.current || getServerNow()
          );
          sfx.playKO();
          setIsQuestionModalOpen(false);
          setMatchStatus('results');
          setScreen('results');
          if (stateSnapRef.current.role === 'host') {
            const bcChannel = broadcastChannelRef.current || gameRef.current?.broadcastChannel;
            if (bcChannel) {
              try {
                bcChannel.postMessage({
                  type: 'match_end',
                  id: clientIdRef.current
                });
              } catch {}
            }
            if (roomCode) {
              const endPatch = { matchStatus: 'results', endedAt: getServerNow() };
              syncPaintballRoomApi(roomCode, endPatch);
              setDoc(getRoomDocRef(roomCode), endPatch, { merge: true }).catch(() => {});
            }
          }
          return 0;
        }
        const nextSec = prev - elapsedSec;
        if (nextSec <= 10) {
          sfx.playTimerTick(true);
        } else if (nextSec === 30 || nextSec === 60) {
          sfx.playTimerTick(false);
        }
        return nextSec;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [screen, role, matchStatus, isTimerPaused, roomCode]);

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
          setQuestionsWrong(w => w + 1);
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

  // Strip undefined properties before calling Firestore setDoc (Firestore throws if any field is undefined!)
  const stripUndefinedFields = <T extends Record<string, any>>(obj: T): Record<string, any> => {
    const clean: Record<string, any> = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = val;
      }
    });
    return clean;
  };

  // Strictly monotonic timestamp-seeded sequence counter: NEVER resets to 0/1 on match start or page refresh!
  const playerSeqRef = useRef<number>(Date.now());
  const nextPlayerSeq = () => {
    playerSeqRef.current = Math.max(playerSeqRef.current + 1, Date.now());
    return playerSeqRef.current;
  };
  const ackHostOverrideAtRef = useRef<number>(0);
  const lastDamageAppliedAtRef = useRef<number>(0);
  const lastFirestoreSentSigRef = useRef<string>('');
  const lastFirestoreSentAtRef = useRef<number>(0);
  const mergedPlayersMapRef = useRef<
    Map<string, { state: PlayerNetworkState; lastSeenLocalAt: number }>
  >(new Map());
  const lastNetActionRef = useRef<{
    lastShot?: PlayerNetworkState['lastShot'];
    lastHit?: PlayerNetworkState['lastHit'];
    lastKo?: PlayerNetworkState['lastKo'];
  }>({});

  // Fast timeout-guarded fetch so an unreachable cross-origin host never stalls the sync loop
  const fetchWithTimeout = async (
    url: string,
    init?: RequestInit,
    timeoutMs: number = 1350
  ): Promise<Response> => {
    const controller = new AbortController();
    const timerId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timerId);
    }
  };

  // Resolve candidate API base origins: authoritative `hostApiOrigin` FIRST when cross-domain so all devices share one server memory, then local `/api/paintball`
  const getCandidateApiBases = (): string[] => {
    const bases: string[] = [];
    const discovered = hostApiOriginRef.current.trim().replace(/\/+$/, '');
    const normalizedLocal = currentOrigin.replace(/\/+$/, '');
    if (discovered && /^https?:\/\//i.test(discovered) && discovered !== normalizedLocal) {
      bases.push(discovered);
    }
    bases.push('');
    return bases;
  };

  const ingestApiSnapshotMeta = (json: any) => {
    if (!json || typeof json !== 'object') return;
    if (typeof json.serverNow === 'number') {
      calibrateServerClock(json.serverNow);
    }
    if (Array.isArray(json.events) && json.events.length > 0) {
      processCombatEventsRef.current(json.events);
    }
  };

  const syncPaintballRoomApi = async (
    code: string,
    roomPatch: Record<string, any>,
    playersPatch?: Array<Record<string, any>>
  ) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    let primaryResult: any = null;
    for (const base of getCandidateApiBases()) {
      try {
        const res = await fetchWithTimeout(
          `${base}/api/paintball/room/${encodeURIComponent(clean)}/room`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room: roomPatch, players: playersPatch })
          }
        );
        if (res.ok) {
          const json = await res.json();
          ingestApiSnapshotMeta(json);
          if (!primaryResult) primaryResult = json;
        }
      } catch {}
    }
    return primaryResult;
  };

  const syncPaintballPlayerApi = async (
    code: string,
    playerPayload: Record<string, any>,
    options?: { isHostAction?: boolean; latestEvent?: LiveFeedEvent }
  ) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    const snap = stateSnapRef.current;
    const roomStatePatch =
      snap.matchStatus === 'playing' && lastStartedAtRef.current > 1000
        ? {
            matchStatus: 'playing',
            matchMode: snap.matchMode,
            matchEpoch: lastStartedAtRef.current,
            startedAt: lastStartedAtRef.current,
            ballsPerQuestion: snap.ballsPerQuestion
          }
        : undefined;
    const queuedEvents = pendingCombatEventsRef.current.splice(0, 16);
    let primaryResult: any = null;
    for (const base of getCandidateApiBases()) {
      try {
        const res = await fetchWithTimeout(
          `${base}/api/paintball/room/${encodeURIComponent(clean)}/player`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              player: playerPayload,
              isHostAction: Boolean(options?.isHostAction),
              ackHostOverrideAt: ackHostOverrideAtRef.current,
              roomState: roomStatePatch,
              latestEvent: options?.latestEvent,
              events: queuedEvents,
              combatEvents: queuedEvents
            })
          }
        );
        if (res.ok) {
          const json = await res.json();
          ingestApiSnapshotMeta(json);
          if (!primaryResult) primaryResult = json;
          if (!json?.room?.isUninitialized) break;
        }
      } catch {}
    }
    return primaryResult;
  };

  const fetchPaintballRoomApi = async (code: string) => {
    const clean = normalizeCode(code);
    if (!clean) return null;
    let bestData: any = null;
    for (const base of getCandidateApiBases()) {
      try {
        const res = await fetchWithTimeout(
          `${base}/api/paintball/room/${encodeURIComponent(clean)}`
        );
        if (res.ok) {
          const json = await res.json();
          ingestApiSnapshotMeta(json);
          if (!bestData || (!json?.room?.isUninitialized && bestData?.room?.isUninitialized)) {
            bestData = json;
          }
          if (!json?.room?.isUninitialized) break;
        }
      } catch {}
    }
    return bestData;
  };

  const deletePaintballPlayerApi = async (code: string, playerId: string) => {
    const clean = normalizeCode(code);
    if (!clean || !playerId) return;
    for (const base of getCandidateApiBases()) {
      try {
        await fetchWithTimeout(
          `${base}/api/paintball/room/${encodeURIComponent(clean)}/player/${encodeURIComponent(
            playerId
          )}`,
          { method: 'DELETE' }
        );
      } catch {}
    }
  };

  // Immediate cross-device room + roster pull when a student joins or switches rooms
  const forceResyncCallbackRef = useRef<(code: string) => void>(() => {});
  const handleForceResyncRoom = (code: string) => {
    forceResyncCallbackRef.current(code);
  };

  // Send beacon leave on tab close so disconnected phones/tablets don't leave ghost hamsters in the arena
  useEffect(() => {
    const handleUnloadLeave = () => {
      const clean = normalizeCode(roomCode);
      if (!clean || stateSnapRef.current.role !== 'player' || !hasJoinedRoomRef.current) return;
      const pId = clientIdRef.current;
      for (const base of getCandidateApiBases()) {
        const url = `${base}/api/paintball/room/${encodeURIComponent(
          clean
        )}/player/${encodeURIComponent(pId)}/leave`;
        try {
          if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(url, '{}');
          } else {
            fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
          }
        } catch {}
      }
    };
    window.addEventListener('pagehide', handleUnloadLeave);
    window.addEventListener('beforeunload', handleUnloadLeave);
    return () => {
      window.removeEventListener('pagehide', handleUnloadLeave);
      window.removeEventListener('beforeunload', handleUnloadLeave);
    };
  }, [roomCode]);

  // Helper: Trigger Student Match Start Sequence (Places Red in Top-Middle Spawn (0, -24) & Blue in Bottom-Middle Spawn (0, +24))
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

    const nowServer = getServerNow();
    const baseDuration = durationSec || 180;
    const elapsedSinceStart =
      !isPaused && startedAtTs > 1000
        ? Math.max(0, Math.floor((nowServer - startedAtTs) / 1000))
        : 0;
    const syncedInitialSeconds =
      elapsedSinceStart < baseDuration ? Math.max(1, baseDuration - elapsedSinceStart) : baseDuration;

    hasJoinedRoomRef.current = true;
    setMatchStatus('playing');
    setIsTimerPaused(isPaused);
    setMatchSeconds(syncedInitialSeconds);
    setHp(100);
    setShield(100);
    setAmmo(0);
    setScore(0);
    setKos(0);
    setKoStreak(0);
    setHitsLanded(0);
    setBestStreak(0);
    setQuestionsAnswered(0);
    setQuestionsCorrect(0);
    setQuestionsWrong(0);
    stateSnapRef.current.score = 0;
    stateSnapRef.current.kos = 0;
    stateSnapRef.current.hitsLanded = 0;
    stateSnapRef.current.bestStreak = 0;
    stateSnapRef.current.questionsAnswered = 0;
    stateSnapRef.current.questionsCorrect = 0;
    stateSnapRef.current.questionsWrong = 0;
    setIsQuestionModalOpen(false);

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
      gameRef.current.camPitch = 0.22;
      gameRef.current.vx = 0;
      gameRef.current.vz = 0;
      gameRef.current.localHamster.position.set(sp.x, 0, sp.z);
      gameRef.current.localHamster.rotation.y = sp.rotY;
    }

    const remainingHoldMs =
      startedAtTs > 1000
        ? Math.max(0, startedAtTs + MATCH_START_SPAWN_HOLD_MS - nowServer)
        : MATCH_START_SPAWN_HOLD_MS;
    const holdUntil = remainingHoldMs > 0 ? nowServer + remainingHoldMs : 0;
    stateSnapRef.current.spawnHoldUntil = holdUntil;
    setSpawnHoldUntil(holdUntil);
    setSpawnHoldSecondsLeft(Math.ceil(remainingHoldMs / 1000));

    setScreen('game');

    const startPayload: PlayerNetworkState = {
      id: clientIdRef.current,
      name: cleanName,
      role: 'player',
      team: effectiveTeam,
      skinIdx: stateSnapRef.current.selectedSkinIdx,
      x: sp.x,
      z: sp.z,
      vx: 0,
      vz: 0,
      rotY: sp.rotY,
      hp: 100,
      shield: 100,
      immuneUntil: 0,
      immuneRemainingMs: 0,
      score: 0,
      kos: 0,
      hitsLanded: 0,
      bestStreak: 0,
      questionsAnswered: 0,
      questionsCorrect: 0,
      questionsWrong: 0,
      seq: nextPlayerSeq(),
      matchEpoch: startedAtTs,
      lastStartedAt: startedAtTs,
      kicked: false,
      updatedAt: nowServer
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
        stripUndefinedFields({
          ...startPayload,
          lastSeen: serverTimestamp()
        }),
        { merge: true }
      ).catch(() => {});
    }

    const teamLabel = effectiveTeam === 'blue' ? 'BLUE SPAWN' : 'RED SPAWN';
    const activeRewardBalls =
      incomingBallsPerQuestion || stateSnapRef.current.ballsPerQuestion || ballsPerQuestion || 10;
    setPickupBannerText(
      `🚀 MATCH STARTED! READY IN ${teamLabel} · CLICK "QUESTIONS" FOR +${activeRewardBalls} BALLS!`
    );
    setTimeout(() => setPickupBannerText(null), 3800);
  };

  // Host Room Configuration Publisher (separated from the real-time sync loop so editing settings never tears down sockets/intervals!)
  useEffect(() => {
    const cleanCode = normalizeCode(roomCode);
    if (!cleanCode || role !== 'host') return;
    const hostStatus =
      stateSnapRef.current.matchStatus === 'playing'
        ? 'playing'
        : screen === 'results' || stateSnapRef.current.matchStatus === 'results'
        ? 'results'
        : 'lobby';
    const nowServer = getServerNow();
    const roomConfigPayload = {
      roomCode: cleanCode,
      website: liveDisplayHost,
      joinUrl: liveJoinUrl,
      hostApiOrigin: currentOrigin,
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
        ? {
            matchEpoch: lastStartedAtRef.current,
            startedAt: lastStartedAtRef.current,
            timerSyncSeconds: stateSnapRef.current.matchSeconds,
            timerSyncedAt: nowServer,
            isTimerPaused: stateSnapRef.current.isTimerPaused
          }
        : {}),
      updatedAt: nowServer
    };
    syncPaintballRoomApi(cleanCode, roomConfigPayload);
    setDoc(getRoomDocRef(cleanCode), stripUndefinedFields(roomConfigPayload), {
      merge: true
    }).catch(() => {});
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
    ballsPerQuestion,
    liveJoinUrl,
    liveDisplayHost,
    currentOrigin
  ]);

  // -------------------------------------------------------------
  // 4. REAL-TIME MULTIPLAYER SYNC (SERVER API + FIRESTORE + BROADCAST CHANNEL)
  // Keyed strictly on [roomCode, role] so UI changes never interrupt cross-device sync!
  // -------------------------------------------------------------
  useEffect(() => {
    const cleanCode = normalizeCode(roomCode);
    if (!cleanCode) return;

    const roomDocRef = getRoomDocRef(cleanCode);
    const playersCol = getPlayersColRef(cleanCode);

    // Unified Room State Processor (used by both Server API & Firestore)
    const processRoomData = (data: Record<string, any> | undefined | null) => {
      if (!data) return;
      if (typeof data.hostApiOrigin === 'string' && /^https?:\/\//i.test(data.hostApiOrigin)) {
        hostApiOriginRef.current = data.hostApiOrigin;
      }
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
        if (!data?.isUninitialized && data?.matchMode) {
          setMatchMode(data.matchMode);
        }
        if (
          !data?.isUninitialized &&
          typeof data?.ballsPerQuestion === 'number' &&
          data.ballsPerQuestion > 0
        ) {
          setBallsPerQuestion(data.ballsPerQuestion);
          stateSnapRef.current.ballsPerQuestion = data.ballsPerQuestion;
        }
        if (
          !data?.isUninitialized &&
          typeof data?.configuredDurationSec === 'number' &&
          stateSnapRef.current.matchStatus === 'lobby'
        ) {
          setConfiguredDurationSec(data.configuredDurationSec);
          setMatchSeconds(data.configuredDurationSec);
        }
        if (typeof data?.isTimerPaused === 'boolean' && !data?.isUninitialized) {
          setIsTimerPaused(data.isTimerPaused);
        }
        const nowServer = getServerNow();
        if (
          data?.matchStatus === 'playing' &&
          stateSnapRef.current.matchStatus === 'playing' &&
          typeof data?.timerSyncSeconds === 'number' &&
          data?.timerSyncedAt
        ) {
          const elapsed = Math.max(0, Math.floor((nowServer - data.timerSyncedAt) / 1000));
          const nextSec = data.isTimerPaused
            ? data.timerSyncSeconds
            : Math.max(0, data.timerSyncSeconds - elapsed);
          setMatchSeconds(prev => (Math.abs(prev - nextSec) >= 1 ? nextSec : prev));
        } else if (
          data?.matchStatus === 'playing' &&
          stateSnapRef.current.matchStatus === 'playing' &&
          typeof data?.startedAt === 'number' &&
          data.startedAt > 1000 &&
          typeof data?.configuredDurationSec === 'number' &&
          !data?.isTimerPaused
        ) {
          const elapsedSinceStart = Math.max(
            0,
            Math.floor((nowServer - data.startedAt) / 1000)
          );
          const derivedRemaining = Math.max(0, data.configuredDurationSec - elapsedSinceStart);
          setMatchSeconds(prev =>
            Math.abs(prev - derivedRemaining) >= 1 ? derivedRemaining : prev
          );
        }
        if (data?.matchStatus === 'playing') {
          const incomingEpoch =
            typeof data.matchEpoch === 'number' && data.matchEpoch > 1000
              ? data.matchEpoch
              : typeof data.startedAt === 'number' && data.startedAt > 1000
              ? data.startedAt
              : lastStartedAtRef.current || nowServer;
          const isAlreadyEndedEpoch =
            matchEndedEpochRef.current > 1000 && incomingEpoch <= matchEndedEpochRef.current;
          const isNewMatchStart =
            !isAlreadyEndedEpoch &&
            (stateSnapRef.current.matchStatus === 'lobby' ||
              (incomingEpoch > 1000 && incomingEpoch > lastStartedAtRef.current));
          if (isNewMatchStart) {
            triggerStudentMatchStart(
              data.configuredDurationSec || 180,
              data.matchMode || stateSnapRef.current.matchMode,
              incomingEpoch,
              Boolean(data.isTimerPaused),
              typeof data.ballsPerQuestion === 'number' ? data.ballsPerQuestion : undefined
            );
          }
        } else if (data?.matchStatus === 'results') {
          matchEndedEpochRef.current = Math.max(
            matchEndedEpochRef.current,
            lastStartedAtRef.current || nowServer
          );
          if (stateSnapRef.current.screen === 'game') {
            setIsQuestionModalOpen(false);
            setMatchStatus('results');
            setScreen('results');
          }
        } else if (data?.matchStatus === 'lobby' && !data?.isUninitialized) {
          const canReturnToLobby =
            stateSnapRef.current.matchStatus !== 'playing' ||
            (typeof data.updatedAt === 'number' &&
              lastStartedAtRef.current > 0 &&
              data.updatedAt > lastStartedAtRef.current + 5000 &&
              !data.startedAt);
          if (canReturnToLobby) {
            setMatchStatus('lobby');
            if (stateSnapRef.current.screen === 'results') {
              setScreen('game');
            }
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

    // Unified Multi-Source Players Roster Processor (merges across Firestore, Server API & BroadcastChannel!)
    const processPlayersList = (rawList: Array<Record<string, any>>) => {
      const localNow = Date.now();
      const nowServer = getServerNow();

      rawList.forEach(data => {
        if (!data) return;
        const playerId = String(data.id || '').replace(/^player_/, '');
        if (!playerId) return;

        if (playerId === clientIdRef.current && data.kicked) {
          hasJoinedRoomRef.current = false;
          mergedPlayersMapRef.current.delete(playerId);
          deletePaintballPlayerApi(cleanCode, clientIdRef.current);
          deleteDoc(getPlayerDocRef(cleanCode, clientIdRef.current)).catch(() => {});
          setScreen('join');
          return;
        }

        if (data.kicked) {
          mergedPlayersMapRef.current.delete(playerId);
          if (gameRef.current?.remotePlayers.has(playerId)) {
            const rem = gameRef.current.remotePlayers.get(playerId);
            if (rem) gameRef.current.scene.remove(rem.mesh);
            gameRef.current.remotePlayers.delete(playerId);
          }
          return;
        }

        if (data.role === 'player' && !data.kicked) {
          const defaultZ = data.team === 'blue' ? TEAM_SPAWN_Z : -TEAM_SPAWN_Z;
          const incomingUpdatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : nowServer;
          const incomingSeq = typeof data.seq === 'number' ? data.seq : 0;
          const incomingStartedAt =
            typeof data.matchEpoch === 'number' && data.matchEpoch > 0
              ? data.matchEpoch
              : typeof data.lastStartedAt === 'number'
              ? data.lastStartedAt
              : typeof data.matchStartResetAt === 'number'
              ? data.matchStartResetAt
              : 0;

          // Resolve immunity clock skew across devices using `immuneRemainingMs` when present
          let resolvedImmuneUntil = 0;
          if (typeof data.immuneRemainingMs === 'number') {
            resolvedImmuneUntil =
              data.immuneRemainingMs > 0 ? nowServer + data.immuneRemainingMs : 0;
          } else if (typeof data.immuneUntil === 'number' && data.immuneUntil > 0) {
            resolvedImmuneUntil = data.immuneUntil;
          }

          // Clamp legacy coordinates inside the compact 76m x 64m arena
          const clampedX =
            typeof data.x === 'number'
              ? Math.max(-ARENA_HALF_W, Math.min(ARENA_HALF_W, data.x))
              : 0;
          const clampedZ =
            typeof data.z === 'number'
              ? Math.max(-ARENA_HALF_D, Math.min(ARENA_HALF_D, data.z))
              : defaultZ;

          const isLocalSelf =
            playerId === clientIdRef.current && stateSnapRef.current.role === 'player';
          const localSnap = stateSnapRef.current;
          const isSameOrCurrentEpoch =
            !incomingStartedAt || incomingStartedAt === lastStartedAtRef.current;

          const pState: PlayerNetworkState = {
            id: playerId,
            name: data.name || (isLocalSelf ? localSnap.playerName : 'Student') || 'Student',
            role: 'player',
            team: data.team || 'red',
            skinIdx: typeof data.skinIdx === 'number' ? data.skinIdx : 0,
            x: clampedX,
            z: clampedZ,
            vx: typeof data.vx === 'number' ? data.vx : 0,
            vz: typeof data.vz === 'number' ? data.vz : 0,
            rotY: typeof data.rotY === 'number' ? data.rotY : data.team === 'blue' ? Math.PI : 0,
            hp: typeof data.hp === 'number' ? data.hp : 100,
            shield: typeof data.shield === 'number' ? data.shield : 100,
            score:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(typeof data.score === 'number' ? data.score : 0, localSnap.score)
                : typeof data.score === 'number'
                ? data.score
                : 0,
            kos:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(typeof data.kos === 'number' ? data.kos : 0, localSnap.kos)
                : typeof data.kos === 'number'
                ? data.kos
                : 0,
            hitsLanded:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(
                    typeof data.hitsLanded === 'number' ? data.hitsLanded : 0,
                    localSnap.hitsLanded
                  )
                : typeof data.hitsLanded === 'number'
                ? data.hitsLanded
                : 0,
            bestStreak:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(
                    typeof data.bestStreak === 'number' ? data.bestStreak : 0,
                    localSnap.bestStreak
                  )
                : typeof data.bestStreak === 'number'
                ? data.bestStreak
                : 0,
            immuneUntil: resolvedImmuneUntil,
            questionsAnswered:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(
                    typeof data.questionsAnswered === 'number' ? data.questionsAnswered : 0,
                    localSnap.questionsAnswered
                  )
                : typeof data.questionsAnswered === 'number'
                ? data.questionsAnswered
                : 0,
            questionsCorrect:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(
                    typeof data.questionsCorrect === 'number'
                      ? data.questionsCorrect
                      : typeof data.questionsAnswered === 'number'
                      ? data.questionsAnswered
                      : 0,
                    localSnap.questionsCorrect
                  )
                : typeof data.questionsCorrect === 'number'
                ? data.questionsCorrect
                : typeof data.questionsAnswered === 'number'
                ? data.questionsAnswered
                : 0,
            questionsWrong:
              isLocalSelf && isSameOrCurrentEpoch
                ? Math.max(
                    typeof data.questionsWrong === 'number' ? data.questionsWrong : 0,
                    localSnap.questionsWrong
                  )
                : typeof data.questionsWrong === 'number'
                ? data.questionsWrong
                : 0,
            seq: incomingSeq,
            matchEpoch: incomingStartedAt,
            lastStartedAt: incomingStartedAt,
            updatedAt: incomingUpdatedAt
          };

          const existingEntry = mergedPlayersMapRef.current.get(playerId);
          let shouldUpdateState = true;
          if (existingEntry) {
            const prev = existingEntry.state;
            const prevSeq = prev.seq || 0;
            const prevStartedAt = prev.matchEpoch || prev.lastStartedAt || 0;
            const sincePrevSeenMs = localNow - existingEntry.lastSeenLocalAt;

            if (incomingStartedAt > 0 && prevStartedAt > 0 && incomingStartedAt < prevStartedAt) {
              shouldUpdateState = false;
            } else if (incomingStartedAt > prevStartedAt && incomingStartedAt > 1000) {
              shouldUpdateState = true;
            } else if (sincePrevSeenMs >= 1500) {
              // Never freeze remote player updates if their sequence restarted or drifted across sources!
              shouldUpdateState = true;
            } else if (
              incomingSeq > 0 &&
              prevSeq > 0 &&
              incomingStartedAt === prevStartedAt
            ) {
              shouldUpdateState = incomingSeq >= prevSeq;
            } else if (prevSeq > 0 && incomingSeq === 0) {
              shouldUpdateState = incomingUpdatedAt > (prev.updatedAt || 0) + 1200;
            } else {
              shouldUpdateState = incomingUpdatedAt >= (prev.updatedAt || 0);
            }
          }

          if (shouldUpdateState) {
            mergedPlayersMapRef.current.set(playerId, {
              state: pState,
              lastSeenLocalAt: localNow
            });
          }

          if (playerId === clientIdRef.current) {
            if (
              typeof data.matchStartResetAt === 'number' &&
              data.matchStartResetAt > 1000 &&
              data.matchStartResetAt > lastStartedAtRef.current &&
              data.matchStartResetAt > matchEndedEpochRef.current
            ) {
              if (data.team === 'red' || data.team === 'blue') {
                setMyTeam(data.team);
                stateSnapRef.current.myTeam = data.team;
              }
              if (typeof data.hostOverrideAt === 'number') {
                ackHostOverrideAtRef.current = Math.max(
                  ackHostOverrideAtRef.current,
                  data.hostOverrideAt
                );
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
                  gameRef.current.camPitch = 0.24;
                }
                setPickupBannerText(
                  `👑 HOST MOVED YOU TO ${TEAM_CONFIG[data.team as TeamId]?.label.toUpperCase() || String(data.team).toUpperCase()} SPAWN!`
                );
                setTimeout(() => setPickupBannerText(null), 2400);
              }
            }
          }

          if (playerId !== clientIdRef.current) {
            const latestState = mergedPlayersMapRef.current.get(playerId)?.state || pState;
            upsertRemotePlayer(latestState);

            // Process queued ring-buffer combat events from Firestore player docs (cross-domain fallback)
            if (Array.isArray(data.recentEvents) && data.recentEvents.length > 0) {
              processCombatEventsRef.current(data.recentEvents);
            }

            // Legacy single-slot compatibility (`lastShot`, `lastHit`, `lastKo`)
            if (
              data.lastShot?.shotId &&
              !seenNetworkEventsRef.current.has(data.lastShot.shotId)
            ) {
              seenNetworkEventsRef.current.add(data.lastShot.shotId);
              spawnNetworkProjectile(
                playerId,
                latestState.name,
                latestState.team,
                data.lastShot.x,
                data.lastShot.z,
                data.lastShot.angle,
                data.lastShot.paintColor
              );
            }

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

            if (
              data.lastKo?.koId &&
              data.lastKo.attackerId === clientIdRef.current &&
              !seenNetworkEventsRef.current.has(data.lastKo.koId)
            ) {
              processCombatEventsRef.current([
                {
                  id: data.lastKo.koId,
                  type: 'ko',
                  ownerId: playerId,
                  attackerId: data.lastKo.attackerId,
                  victimName: data.lastKo.victimName,
                  ts: nowServer
                }
              ]);
            }
          }
        }
      });

      // Prune stale disconnected players after 30s
      mergedPlayersMapRef.current.forEach((val, key) => {
        if (localNow - val.lastSeenLocalAt > 30000) {
          mergedPlayersMapRef.current.delete(key);
        }
      });

      if (gameRef.current) {
        gameRef.current.remotePlayers.forEach((val, key) => {
          if (!mergedPlayersMapRef.current.has(key)) {
            gameRef.current?.scene.remove(val.mesh);
            gameRef.current?.remotePlayers.delete(key);
          }
        });
      }

      const activePlayers = Array.from(mergedPlayersMapRef.current.values()).map(v => v.state);
      activePlayers.sort(
        (a, b) =>
          (b.score || 0) - (a.score || 0) ||
          (b.kos || 0) - (a.kos || 0) ||
          (b.questionsCorrect || b.questionsAnswered || 0) -
            (a.questionsCorrect || a.questionsAnswered || 0) ||
          a.id.localeCompare(b.id)
      );
      setRoomPlayers(activePlayers);
    };

    // Wire immediate force-resync helper for Join button & room code changes
    const runImmediateRoomPull = (targetCode: string) => {
      const targetClean = normalizeCode(targetCode);
      if (!targetClean) return;
      getDoc(getRoomDocRef(targetClean))
        .then(rSnap => {
          if (rSnap.exists()) processRoomData(rSnap.data());
        })
        .catch(() => {});
      getDocs(getPlayersColRef(targetClean))
        .then(pSnap => {
          const fsList = pSnap.docs.map(d => ({
            ...(d.data() as Record<string, any>),
            id: (d.data() as any).id || d.id.replace(/^player_/, '')
          }));
          if (fsList.length > 0) processPlayersList(fsList);
        })
        .catch(() => {});
      fetchPaintballRoomApi(targetClean).then(apiData => {
        if (apiData?.room) processRoomData(apiData.room);
        if (Array.isArray(apiData?.players)) processPlayersList(apiData.players);
      });
    };
    forceResyncCallbackRef.current = runImmediateRoomPull;
    runImmediateRoomPull(cleanCode);

    // Real-time Firestore room listener
    const unsubRoom = onSnapshot(
      roomDocRef,
      snap => {
        if (!snap.exists()) return;
        processRoomData(snap.data());
      },
      () => {}
    );

    // BroadcastChannel for zero-latency local cross-tab multiplayer
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
          if (pState && pState.role === 'player' && !pState.kicked) {
            processPlayersList([pState]);
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
            processCombatEventsRef.current([
              {
                id: msg.koId || `bc-ko-${Date.now()}`,
                type: 'ko',
                ownerId: msg.id,
                attackerId: msg.attackerId,
                victimName: msg.victimName,
                ts: getServerNow()
              }
            ]);
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
            typeof msg.startedAt === 'number' ? msg.startedAt : getServerNow();
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
          matchEndedEpochRef.current = Math.max(
            matchEndedEpochRef.current,
            lastStartedAtRef.current || getServerNow()
          );
          setIsQuestionModalOpen(false);
          setMatchStatus('results');
          setScreen('results');
        }
      };
    } catch {}

    // Real-time Firestore players subcollection listener
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

    // High-Responsiveness 140ms (~7Hz) Cross-Device Sync Loop with Timeout Guard (Zero Network Queue Lag!)
    let pollTickCount = 0;
    let isSyncInFlight = false;
    const syncInterval = setInterval(async () => {
      pollTickCount++;
      const g = gameRef.current;
      const snapState = stateSnapRef.current;

      // Every 12 ticks (~1.7s), refresh Firestore players & room doc as resilient multi-domain bridge
      if (pollTickCount % 12 === 0) {
        getDocs(playersCol)
          .then(snap => {
            const fsList = snap.docs.map(d => ({
              ...(d.data() as Record<string, any>),
              id: (d.data() as any).id || d.id.replace(/^player_/, '')
            }));
            if (fsList.length > 0) {
              processPlayersList(fsList);
            }
          })
          .catch(() => {});
        if (snapState.role === 'player' && pollTickCount % 16 === 0) {
          getDoc(roomDocRef)
            .then(rSnap => {
              if (rSnap.exists()) processRoomData(rSnap.data());
            })
            .catch(() => {});
        }
      }

      if (isSyncInFlight) return;
      isSyncInFlight = true;

      try {
        if (snapState.role === 'host') {
          if (snapState.matchStatus === 'playing' && pollTickCount % 7 === 0) {
            const nowServer = getServerNow();
            const liveTimerPatch = {
              matchStatus: 'playing',
              hostApiOrigin: currentOrigin,
              timerSyncSeconds: snapState.matchSeconds,
              timerSyncedAt: nowServer,
              isTimerPaused: snapState.isTimerPaused,
              ...(lastStartedAtRef.current > 1000
                ? { matchEpoch: lastStartedAtRef.current, startedAt: lastStartedAtRef.current }
                : {})
            };
            const resData = await syncPaintballRoomApi(cleanCode, liveTimerPatch);
            if (resData?.room) processRoomData(resData.room);
            if (Array.isArray(resData?.players)) processPlayersList(resData.players);
            setDoc(roomDocRef, liveTimerPatch, { merge: true }).catch(() => {});
          } else {
            const data = await fetchPaintballRoomApi(cleanCode);
            if (data?.room) processRoomData(data.room);
            if (Array.isArray(data?.players)) processPlayersList(data.players);
          }
          return;
        }

        // Student on Join customizer screen: poll room settings & roster every 4 ticks (~560ms)
        if (snapState.screen === 'join') {
          if (pollTickCount % 4 === 0) {
            const data = await fetchPaintballRoomApi(cleanCode);
            if (data?.room) processRoomData(data.room);
            if (Array.isArray(data?.players)) processPlayersList(data.players);
          }
          return;
        }

        hasJoinedRoomRef.current = true;
        const nowServer = getServerNow();
        const defaultZ = snapState.myTeam === 'blue' ? TEAM_SPAWN_Z : -TEAM_SPAWN_Z;
        const immuneRem = Math.max(0, snapState.immuneUntil - nowServer);
        const curX = g ? Number(g.x.toFixed(2)) : 0;
        const curY = g ? Number(g.y.toFixed(2)) : 0;
        const curZ = g ? Number(g.z.toFixed(2)) : defaultZ;
        const curVx = g ? Number(g.vx.toFixed(2)) : 0;
        const curVz = g ? Number(g.vz.toFixed(2)) : 0;
        const curRotY = g ? Number(g.rotY.toFixed(2)) : snapState.myTeam === 'blue' ? Math.PI : 0;

        const payload: PlayerNetworkState = {
          id: clientIdRef.current,
          name: snapState.playerName || 'Student',
          role: 'player',
          team: snapState.matchMode === 'solo' ? 'solo' : snapState.myTeam,
          skinIdx: snapState.selectedSkinIdx,
          x: curX,
          y: curY,
          z: curZ,
          vx: curVx,
          vz: curVz,
          rotY: curRotY,
          stance: snapState.playerStance,
          hp: snapState.hp,
          shield: snapState.shield,
          immuneUntil: snapState.immuneUntil,
          immuneRemainingMs: immuneRem,
          score: snapState.score,
          kos: snapState.kos,
          hitsLanded: snapState.hitsLanded,
          bestStreak: snapState.bestStreak,
          questionsAnswered: snapState.questionsAnswered,
          questionsCorrect: snapState.questionsCorrect,
          questionsWrong: snapState.questionsWrong,
          seq: nextPlayerSeq(),
          matchEpoch: lastStartedAtRef.current,
          lastStartedAt: lastStartedAtRef.current,
          recentEvents: recentCombatEventsRef.current,
          ...(lastNetActionRef.current.lastShot
            ? { lastShot: lastNetActionRef.current.lastShot }
            : {}),
          ...(lastNetActionRef.current.lastHit
            ? { lastHit: lastNetActionRef.current.lastHit }
            : {}),
          ...(lastNetActionRef.current.lastKo
            ? { lastKo: lastNetActionRef.current.lastKo }
            : {}),
          updatedAt: nowServer
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

        // Real-time Firestore multi-domain sync (~280ms when moving/rotating/acting, or 1.4s idle heartbeat)
        const stateSig = `${curX}|${curY}|${curZ}|${curRotY}|${snapState.playerStance}|${snapState.hp}|${snapState.shield}|${snapState.score}|${snapState.kos}|${snapState.myTeam}`;
        const localMs = Date.now();
        const hasStateChanged = stateSig !== lastFirestoreSentSigRef.current;
        if (
          (hasStateChanged && localMs - lastFirestoreSentAtRef.current >= 260) ||
          localMs - lastFirestoreSentAtRef.current >= 1400
        ) {
          lastFirestoreSentSigRef.current = stateSig;
          lastFirestoreSentAtRef.current = localMs;
          const playerRef = getPlayerDocRef(cleanCode, clientIdRef.current);
          setDoc(
            playerRef,
            stripUndefinedFields({
              ...payload,
              lastSeen: serverTimestamp()
            }),
            { merge: true }
          ).catch(() => {});
        }
      } finally {
        isSyncInFlight = false;
      }
    }, 140);

    return () => {
      unsubRoom();
      unsubPlayers();
      clearInterval(syncInterval);
      if (bc) bc.close();
      if (broadcastChannelRef.current === bc) {
        broadcastChannelRef.current = null;
      }
    };
  }, [roomCode, role]);

  // Apply incoming paintball damage to local student player (Respects 10-Second Respawn Immunity!)
  const applyIncomingDamage = (damage: number, attackerName: string, attackerId: string) => {
    const nowServer = getServerNow();
    if (nowServer < stateSnapRef.current.immuneUntil) {
      return;
    }
    const localMs = Date.now();
    if (localMs - lastDamageAppliedAtRef.current < 95) {
      return;
    }
    lastDamageAppliedAtRef.current = localMs;

    sfx.playSplat();
    const isShieldAbsorb = stateSnapRef.current.shield > 0;
    setDamageVignetteColor(isShieldAbsorb ? 'rgba(34, 211, 238, 0.42)' : 'rgba(244, 63, 94, 0.48)');
    setTimeout(() => setDamageVignetteColor(null), 420);

    setShield(prevShield => {
      if (prevShield >= damage) {
        const nextShd = prevShield - damage;
        if (prevShield > 0 && nextShd === 0) {
          sfx.playShieldBreak();
          if (gameRef.current) {
            spawnShockwaveRing(
              gameRef.current.x,
              1.35,
              gameRef.current.z,
              0x38bdf8,
              0.8,
              3.4,
              0.38,
              true
            );
          }
        }
        return nextShd;
      }
      if (prevShield > 0) {
        sfx.playShieldBreak();
        if (gameRef.current) {
          spawnShockwaveRing(
            gameRef.current.x,
            1.35,
            gameRef.current.z,
            0x38bdf8,
            0.8,
            3.4,
            0.38,
            true
          );
        }
      }
      const rem = damage - prevShield;
      setHp(prevHp => {
        const nextHp = prevHp - rem;
        if (nextHp <= 0) {
          const koServerTs = getServerNow();
          const newImmuneUntil = koServerTs + RESPAWN_IMMUNITY_MS;
          stateSnapRef.current.immuneUntil = newImmuneUntil;
          stateSnapRef.current.hp = 100;
          stateSnapRef.current.shield = 100;
          setImmuneUntil(newImmuneUntil);
          setImmunitySecondsLeft(10);
          setKoStreak(0);
          const sp = getTeamSpawnPosition(
            stateSnapRef.current.myTeam,
            stateSnapRef.current.matchMode
          );
          if (gameRef.current) {
            gameRef.current.x = sp.x;
            gameRef.current.y = 0;
            gameRef.current.jumpVy = 0;
            gameRef.current.z = sp.z;
            gameRef.current.vx = 0;
            gameRef.current.vz = 0;
            gameRef.current.rotY = sp.rotY;
            gameRef.current.camYaw = sp.rotY;
            gameRef.current.camPitch = 0.14;
            gameRef.current.localHamster.position.set(sp.x, 0, sp.z);
            gameRef.current.localHamster.rotation.y = sp.rotY;
          }
          playerStanceRef.current = 'stand';
          setPlayerStance('stand');
          isAdsScopedRef.current = false;
          setIsAdsScoped(false);
          setShield(100);
          const spawnSide =
            stateSnapRef.current.matchMode === 'teams'
              ? stateSnapRef.current.myTeam === 'blue'
                ? 'BLUE SPAWN'
                : 'RED SPAWN'
              : 'SPAWN BASE';
          setKoBannerText(
            `💥 SPLATTERED BY ${attackerName.toUpperCase()}! RESPAWNED AT ${spawnSide} WITH 10s BULLET IMMUNITY!`
          );
          setTimeout(() => setKoBannerText(null), 3200);
          setPickupBannerText('🛡️ 10-SECOND RESPAWN IMMUNITY ACTIVE — GLOWING FORCEFIELD PROTECTS YOU!');
          setTimeout(() => setPickupBannerText(null), 4200);

          const koId = `ko-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const koObj = {
            koId,
            attackerId,
            victimName: stateSnapRef.current.playerName
          };
          lastNetActionRef.current.lastKo = koObj;
          queueCombatEvent({
            id: koId,
            type: 'ko',
            ownerId: clientIdRef.current,
            attackerId,
            victimName: stateSnapRef.current.playerName || 'Opponent',
            ts: koServerTs
          });

          if (gameRef.current?.broadcastChannel) {
            try {
              gameRef.current.broadcastChannel.postMessage({
                type: 'award_ko',
                id: clientIdRef.current,
                koId,
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
            timestamp: koServerTs
          };
          pushLiveEvent(evText, '#f43f5e');

          if (roomCode) {
            const koSeq = nextPlayerSeq();
            syncPaintballPlayerApi(
              roomCode,
              {
                id: clientIdRef.current,
                x: sp.x,
                z: sp.z,
                vx: 0,
                vz: 0,
                rotY: sp.rotY,
                hp: 100,
                shield: 100,
                immuneUntil: newImmuneUntil,
                immuneRemainingMs: RESPAWN_IMMUNITY_MS,
                seq: koSeq,
                matchEpoch: lastStartedAtRef.current,
                lastStartedAt: lastStartedAtRef.current,
                lastKo: koObj,
                recentEvents: recentCombatEventsRef.current
              },
              { latestEvent: koEvent }
            );
            setDoc(
              getPlayerDocRef(roomCode, clientIdRef.current),
              stripUndefinedFields({
                x: sp.x,
                z: sp.z,
                vx: 0,
                vz: 0,
                rotY: sp.rotY,
                hp: 100,
                shield: 100,
                immuneUntil: newImmuneUntil,
                immuneRemainingMs: RESPAWN_IMMUNITY_MS,
                seq: koSeq,
                matchEpoch: lastStartedAtRef.current,
                lastStartedAt: lastStartedAtRef.current,
                lastKo: koObj,
                recentEvents: recentCombatEventsRef.current,
                updatedAt: koServerTs
              }),
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

  // Upsert Remote Student Player 3D Hamster (Zero-Freeze Monotonic & Epoch-Aware Reconciliation)
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
      entry = { data: rState, mesh, walkPhase: 0, lastLocalRecvAt: Date.now() };
      g.remotePlayers.set(rState.id, entry);
    } else {
      const localNow = Date.now();
      const incomingSeq = rState.seq || 0;
      const existingSeq = entry.data.seq || 0;
      const incomingStartedAt = rState.matchEpoch || rState.lastStartedAt || 0;
      const existingStartedAt = entry.data.matchEpoch || entry.data.lastStartedAt || 0;
      const sinceLastRecvMs = localNow - (entry.lastLocalRecvAt || 0);
      const isNewMatchEpoch = incomingStartedAt > existingStartedAt && incomingStartedAt > 1000;

      if (incomingStartedAt > 0 && existingStartedAt > 0 && incomingStartedAt < existingStartedAt) {
        return;
      }

      if (!isNewMatchEpoch && sinceLastRecvMs < 1500) {
        if (
          incomingSeq > 0 &&
          existingSeq > 0 &&
          incomingStartedAt === existingStartedAt &&
          incomingSeq < existingSeq
        ) {
          return;
        }
        if (
          existingSeq > 0 &&
          incomingSeq === 0 &&
          (!rState.updatedAt || rState.updatedAt <= (entry.data.updatedAt || 0) + 1200)
        ) {
          return;
        }
        if (
          incomingSeq === 0 &&
          existingSeq === 0 &&
          entry.data.updatedAt &&
          rState.updatedAt &&
          rState.updatedAt < entry.data.updatedAt
        ) {
          return;
        }
      }

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
        isNewMatchEpoch ||
        Math.hypot(rState.x - entry.mesh.position.x, rState.z - entry.mesh.position.z) > 9.5
      ) {
        // Snap immediately when player teleports to Red/Blue Spawn at match start or respawn!
        entry.mesh.position.set(rState.x, 0, rState.z);
        entry.mesh.rotation.y = rState.rotY;
      }

      const transformChanged =
        entry.data.x !== rState.x ||
        entry.data.z !== rState.z ||
        entry.data.rotY !== rState.rotY ||
        incomingSeq > existingSeq ||
        isNewMatchEpoch;
      if (transformChanged) {
        entry.lastLocalRecvAt = localNow;
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

  // Pre-allocated shared particle geometries & materials to eliminate per-frame GC stalls / lag
  const sharedTrailSphereGeom = React.useMemo(() => new THREE.SphereGeometry(0.065, 6, 6), []);
  const sharedSplatSphereGeom = React.useMemo(() => new THREE.SphereGeometry(0.11, 8, 8), []);
  const sharedMuzzleGasGeom = React.useMemo(() => new THREE.SphereGeometry(0.12, 8, 8), []);
  const sharedMuzzleDropGeom = React.useMemo(() => new THREE.SphereGeometry(0.095, 8, 8), []);
  const sharedMuzzleGasMat = React.useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.9
      }),
    []
  );

  const sharedShockwaveRingGeom = React.useMemo(
    () => new THREE.RingGeometry(0.62, 1.0, 28),
    []
  );

  // Spawn Expanding 3D Shockwave Ring VFX (for Muzzle Blasts, Paint Impacts, Shield Breaks & KOs)
  const spawnShockwaveRing = (
    x: number,
    y: number,
    z: number,
    colorHex: number,
    startScale: number = 0.35,
    endScale: number = 2.1,
    maxLife: number = 0.28,
    horizontal: boolean = true,
    facingYaw: number = 0
  ) => {
    const g = gameRef.current;
    if (!g || g.shockwaves.length >= 36) return;
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(sharedShockwaveRingGeom, mat);
    ring.position.set(x, y, z);
    if (horizontal) {
      ring.rotation.x = -Math.PI / 2;
    } else {
      ring.rotation.y = facingYaw;
    }
    ring.scale.setScalar(startScale);
    g.scene.add(ring);
    g.shockwaves.push({
      mesh: ring,
      mat,
      life: 0,
      maxLife,
      startScale,
      endScale
    });
  };

  // Spawn 3D Muzzle CO2 Gas, Luminous Flash Ring & Paint Mist Burst at the Exact Gun Barrel Nozzle
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
    spawnShockwaveRing(
      muzzlePos.x,
      muzzlePos.y,
      muzzlePos.z,
      paintColor,
      0.16,
      0.72,
      0.14,
      false,
      shotAngle
    );

    const paintMistMat = new THREE.MeshBasicMaterial({
      color: paintColor,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < 7; i++) {
      if (particles.length >= 150) break;
      const isPaintDrop = i % 2 === 0;
      const pMesh = new THREE.Mesh(
        isPaintDrop ? sharedMuzzleDropGeom : sharedMuzzleGasGeom,
        isPaintDrop ? paintMistMat : sharedMuzzleGasMat
      );
      pMesh.position.copy(muzzlePos);
      scene.add(pMesh);

      const spread = (Math.random() - 0.5) * 0.36;
      const speed = 11 + Math.random() * 15;
      particles.push({
        mesh: pMesh,
        vx: Math.sin(shotAngle + spread) * speed,
        vy: 1.0 + (Math.random() - 0.3) * 3.2,
        vz: Math.cos(shotAngle + spread) * speed,
        life: 0,
        maxLife: 0.16 + Math.random() * 0.09
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
      startX + Math.sin(angle) * (1.65 * HAMSTER_HERO_SCALE),
      1.32 * HAMSTER_HERO_SCALE,
      startZ + Math.cos(angle) * (1.65 * HAMSTER_HERO_SCALE)
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

  // Idempotent Combat Ring-Buffer Event Processor (delivers rapid shots, hits, and KOs across all devices!)
  const processCombatEvents = (events?: CombatNetEvent[]) => {
    if (!Array.isArray(events) || events.length === 0) return;
    // Prevent seenNetworkEventsRef from growing unbounded over long classroom sessions
    if (seenNetworkEventsRef.current.size > 1600) {
      const keep = Array.from(seenNetworkEventsRef.current).slice(-800);
      seenNetworkEventsRef.current = new Set(keep);
    }

    for (const ev of events) {
      if (!ev || !ev.id || seenNetworkEventsRef.current.has(ev.id)) continue;
      if (ev.ownerId === clientIdRef.current) {
        seenNetworkEventsRef.current.add(ev.id);
        continue;
      }
      seenNetworkEventsRef.current.add(ev.id);

      if (ev.type === 'shot' && typeof ev.x === 'number' && typeof ev.z === 'number') {
        spawnNetworkProjectile(
          ev.ownerId,
          ev.ownerName || 'Opponent',
          ev.ownerTeam || 'solo',
          ev.x,
          ev.z,
          typeof ev.angle === 'number' ? ev.angle : 0,
          typeof ev.paintColor === 'number' ? ev.paintColor : 0xef4444
        );
      } else if (
        ev.type === 'hit' &&
        ev.targetId === clientIdRef.current &&
        stateSnapRef.current.role === 'player'
      ) {
        applyIncomingDamage(
          typeof ev.damage === 'number' ? ev.damage : 28,
          ev.attackerName || ev.ownerName || 'Opponent',
          ev.attackerId || ev.ownerId
        );
      } else if (ev.type === 'ko' && ev.attackerId === clientIdRef.current) {
        const nextKoStreak = stateSnapRef.current.koStreak + 1;
        const isFrenzy = stateSnapRef.current.matchSeconds <= 30;
        const baseKoPts = isFrenzy ? 90 : 60;
        const streakBonusPts = nextKoStreak >= 3 ? 50 : nextKoStreak === 2 ? 25 : 0;
        const totalKoPts = baseKoPts + streakBonusPts;
        setKos(k => k + 1);
        setKoStreak(nextKoStreak);
        setBestStreak(b => Math.max(b, nextKoStreak));
        triggerKillStreakCallout(nextKoStreak, ev.victimName || 'Opponent');
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
          `SPLATTERED ${(ev.victimName || 'OPPONENT').toUpperCase()}! (+${totalKoPts} PTS${
            nextKoStreak >= 2 ? ` • ${nextKoStreak}x STREAK!` : ''
          })`
        );
        sfx.playKO();
        setTimeout(() => setKoBannerText(null), 2600);
      }
    }
  };
  processCombatEventsRef.current = processCombatEvents;

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

  function drawOverheadPlateCanvas(
    canvas: HTMLCanvasElement,
    name: string,
    skin: HamsterSkin,
    isHostReferee: boolean,
    team: TeamId = 'solo',
    hp: number = 100,
    shield: number = 100,
    isImmune: boolean = false
  ) {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isRed = !isHostReferee && team === 'red';
    const isBlue = !isHostReferee && team === 'blue';

    const borderHex = isHostReferee
      ? '#facc15'
      : isImmune
      ? '#facc15'
      : isRed
      ? '#ef4444'
      : isBlue
      ? '#2563eb'
      : team !== 'solo'
      ? TEAM_CONFIG[team].colorHex
      : skin.paintHex;

    // Bright clean arcade plate shell with crisp border
    ctx.fillStyle = isHostReferee ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.roundRect(14, 12, 484, isHostReferee ? 98 : 144, 34);
    ctx.fill();

    ctx.lineWidth = isImmune ? 10 : 8;
    ctx.strokeStyle = borderHex;
    ctx.stroke();

    if (isHostReferee) {
      ctx.font = '900 29px "Poppins", "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑 TEACHER JAN [HOST]', 256, 61);
      return;
    }

    // Top row: Team badge + Callsign (or IMMUNE badge)
    if (isRed || isBlue) {
      ctx.fillStyle = isImmune ? '#eab308' : isRed ? '#ef4444' : '#2563eb';
      ctx.beginPath();
      ctx.roundRect(28, 26, isImmune ? 156 : 114, 54, 24);
      ctx.fill();

      ctx.font = '900 22px "Poppins", "Inter", system-ui, sans-serif';
      ctx.fillStyle = isImmune ? '#0f172a' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isImmune ? '🛡️ IMMUNE' : isRed ? 'RED' : 'BLUE', isImmune ? 106 : 85, 53);

      const cleanCallsign = name.replace(/^\[(RED|BLUE)\]\s*/i, '').toUpperCase();
      ctx.font = '900 28px "Poppins", "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.fillText(cleanCallsign.slice(0, 12), isImmune ? 336 : 316, 54);
    } else {
      ctx.fillStyle = borderHex;
      ctx.beginPath();
      ctx.arc(58, 53, 15, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '900 28px "Poppins", "Inter", system-ui, sans-serif';
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        (isImmune ? `🛡️ ${name}` : name).toUpperCase().slice(0, 16),
        274,
        54
      );
    }

    // Bottom rows: Live Shield (Sky) + Live HP (Emerald) micro-bars
    const barX = 34;
    const barW = 444;
    const clampedShield = Math.max(0, Math.min(100, shield));
    const clampedHp = Math.max(0, Math.min(100, hp));

    // Shield track & fill
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(barX, 92, barW, 16, 8);
    ctx.fill();
    if (clampedShield > 0) {
      ctx.fillStyle = isImmune ? '#eab308' : '#0ea5e9';
      ctx.beginPath();
      ctx.roundRect(barX, 92, Math.max(14, (barW * clampedShield) / 100), 16, 8);
      ctx.fill();
    }

    // HP track & fill
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(barX, 116, barW, 22, 11);
    ctx.fill();
    if (clampedHp > 0) {
      ctx.fillStyle = isImmune ? '#facc15' : clampedHp > 35 ? '#10b981' : '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(barX, 116, Math.max(18, (barW * clampedHp) / 100), 22, 11);
      ctx.fill();
    }
  }

  function createPlayerNameSprite(
    name: string,
    skin: HamsterSkin,
    isHostReferee: boolean,
    team: TeamId = 'solo',
    hp: number = 100,
    shield: number = 100
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 168;
    drawOverheadPlateCanvas(canvas, name, skin, isHostReferee, team, hp, shield, false);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.38, 0.78, 1);
    sprite.position.set(0, 2.78, 0);
    sprite.userData = {
      canvas,
      tex,
      skin,
      isHostReferee,
      lastPlateKey: `${name}|${team}|${Math.round(hp / 2)}|${Math.round(shield / 2)}|0`
    };
    return sprite;
  }

  function updatePlayerOverheadPlate(
    sprite: THREE.Sprite | undefined,
    name: string,
    team: TeamId,
    hp: number,
    shield: number,
    isImmune: boolean = false
  ) {
    if (!sprite || !sprite.userData?.canvas || !sprite.userData?.tex) return;
    const nextKey = `${name}|${team}|${Math.round(hp / 2)}|${Math.round(shield / 2)}|${isImmune ? 1 : 0}`;
    if (sprite.userData.lastPlateKey === nextKey) return;
    sprite.userData.lastPlateKey = nextKey;
    drawOverheadPlateCanvas(
      sprite.userData.canvas as HTMLCanvasElement,
      name,
      (sprite.userData.skin as HamsterSkin) || HAMSTER_SKINS[0],
      Boolean(sprite.userData.isHostReferee),
      team,
      hp,
      shield,
      isImmune
    );
    (sprite.userData.tex as THREE.CanvasTexture).needsUpdate = true;
  }

  function buildHighDefHamster(
    skinIdx: number,
    callsign: string,
    isHostReferee: boolean = false,
    team: TeamId = 'solo',
    showNameTag: boolean = true
  ): THREE.Group {
    const skin = HAMSTER_SKINS[skinIdx % HAMSTER_SKINS.length];
    const teamColorNum =
      isHostReferee
        ? 0xfacc15
        : team !== 'solo'
        ? TEAM_CONFIG[team].colorNum
        : skin.paintColor;

    const root = new THREE.Group();
    root.scale.setScalar(HAMSTER_HERO_SCALE);

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

    // 7b. 3D 10-Second Respawn Immunity Forcefield Shield (Glowing Multi-Layered Energy Dome + Dual Orbital Rings!)
    const immunityShieldGroup = new THREE.Group();
    const immunityBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.68, 24, 18),
      new THREE.MeshPhysicalMaterial({
        color: 0xfacc15,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.38,
        roughness: 0.08,
        clearcoat: 1.0,
        depthWrite: false
      })
    );
    immunityBubble.position.y = 1.28;
    immunityShieldGroup.add(immunityBubble);

    const immunityInnerCore = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, 20, 16),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.22,
        depthWrite: false
      })
    );
    immunityInnerCore.position.y = 1.25;
    immunityShieldGroup.add(immunityInnerCore);

    const immunityRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.65, 0.075, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.95
      })
    );
    immunityRing1.position.y = 1.25;
    immunityRing1.rotation.x = Math.PI / 2.6;
    immunityShieldGroup.add(immunityRing1);

    const immunityRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.58, 0.065, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.92
      })
    );
    immunityRing2.position.y = 1.25;
    immunityRing2.rotation.x = -Math.PI / 2.6;
    immunityShieldGroup.add(immunityRing2);

    const immunityGroundHalo = new THREE.Mesh(
      new THREE.RingGeometry(1.25, 1.72, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92
      })
    );
    immunityGroundHalo.rotation.x = -Math.PI / 2;
    immunityGroundHalo.position.y = 0.09;
    immunityShieldGroup.add(immunityGroundHalo);

    immunityShieldGroup.visible = false;
    root.add(immunityShieldGroup);

    // 8. Floating 3D Callsign Tag (Hidden for personal view; visible to all other players!)
    const nameSprite = createPlayerNameSprite(callsign, skin, isHostReferee, team);
    nameSprite.visible = showNameTag;
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
      immunityBubble,
      immunityRing1,
      immunityRing2,
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
      callsign,
      team,
      isHostReferee
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
      new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthTest: true })
    );
    badgeSprite.scale.set(1.75, 0.44, 1);
    badgeSprite.position.set(0, 2.1, 0);
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
    playStepAudio: boolean = false,
    stance: 'stand' | 'crouch' | 'crawl' = 'stand',
    jumpY: number = 0,
    aimPitch: number = 0
  ): number => {
    const ud = hamsterGroup.userData;
    if (!ud) return walkPhase;
    let nextPhase = walkPhase;

    // Smoothly blend 3D tactical stance transitions (Stand <-> Crouch <-> Prone Crawl)
    const targetCrouch = stance === 'crouch' ? 1 : 0;
    const targetCrawl = stance === 'crawl' ? 1 : 0;
    ud.crouchBlend = THREE.MathUtils.damp(ud.crouchBlend ?? 0, targetCrouch, 14, dt);
    ud.crawlBlend = THREE.MathUtils.damp(ud.crawlBlend ?? 0, targetCrawl, 14, dt);
    const cr = ud.crouchBlend as number;
    const pr = ud.crawlBlend as number;
    const isAirborne = jumpY > 0.08;

    const phaseRate =
      stance === 'crawl' ? 10.2 : stance === 'crouch' ? 12.4 : 15.8;

    if (isMoving && !isAirborne) {
      nextPhase += dt * phaseRate;
      if (playStepAudio && stance !== 'crawl') {
        sfx.playFootstep();
      }
      const legSwing = Math.sin(nextPhase) * (0.78 * (1 - pr * 0.55) * (1 - cr * 0.25));
      if (ud.leftLeg) {
        ud.leftLeg.rotation.x = legSwing - cr * 0.55 + pr * 1.18;
        ud.leftLeg.position.y =
          0.38 - cr * 0.14 - pr * 0.18 + Math.max(0, Math.sin(nextPhase)) * (0.13 * (1 - pr * 0.6));
        ud.leftLeg.position.z = -pr * 0.55;
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x = -legSwing - cr * 0.55 + pr * 1.18;
        ud.rightLeg.position.y =
          0.38 - cr * 0.14 - pr * 0.18 + Math.max(0, -Math.sin(nextPhase)) * (0.13 * (1 - pr * 0.6));
        ud.rightLeg.position.z = -pr * 0.55;
      }
      if (ud.bodyGroup) {
        const bobY = Math.abs(Math.sin(nextPhase * 2)) * (0.14 * (1 - cr * 0.45 - pr * 0.72));
        ud.bodyGroup.position.y = bobY - cr * 0.38 - pr * 0.54;
        ud.bodyGroup.position.z = -pr * 0.22;
        ud.bodyGroup.rotation.z = Math.sin(nextPhase) * (0.075 * (1 - pr * 0.4));
        ud.bodyGroup.rotation.x = 0.08 + cr * 0.24 + pr * 0.96; // Forward crouch / belly-crawl pitch!
      }
      if (ud.headGroup) {
        ud.headGroup.rotation.z = -Math.sin(nextPhase) * 0.04;
        ud.headGroup.position.y =
          1.72 - cr * 0.38 - pr * 0.96 + Math.abs(Math.cos(nextPhase * 2)) * 0.03;
        ud.headGroup.position.z = cr * 0.16 + pr * 0.68;
        ud.headGroup.rotation.x = THREE.MathUtils.clamp(aimPitch * 0.65, -0.45, 0.45) - pr * 0.18;
      }
      if (ud.leftEar) ud.leftEar.rotation.z = 0.38 + Math.sin(nextPhase * 2) * 0.16;
      if (ud.rightEar) ud.rightEar.rotation.z = -0.38 - Math.sin(nextPhase * 2) * 0.16;
      if (ud.tail) ud.tail.rotation.y = Math.sin(nextPhase * 2.5) * 0.42;
      if (ud.hopperBallsGroup) {
        ud.hopperBallsGroup.position.y = Math.abs(Math.sin(nextPhase * 2)) * 0.03;
      }
    } else {
      nextPhase += dt * 2.8;
      const airTuck = isAirborne ? Math.min(1, jumpY * 1.1) : 0;
      if (ud.leftLeg) {
        ud.leftLeg.rotation.x = THREE.MathUtils.lerp(
          ud.leftLeg.rotation.x,
          -airTuck * 0.72 - cr * 0.58 + pr * 1.22,
          Math.min(1, dt * 14)
        );
        ud.leftLeg.position.y = 0.38 + airTuck * 0.18 - cr * 0.14 - pr * 0.18;
        ud.leftLeg.position.z = airTuck * 0.12 - pr * 0.55;
      }
      if (ud.rightLeg) {
        ud.rightLeg.rotation.x = THREE.MathUtils.lerp(
          ud.rightLeg.rotation.x,
          -airTuck * 0.52 - cr * 0.58 + pr * 1.22,
          Math.min(1, dt * 14)
        );
        ud.rightLeg.position.y = 0.38 + airTuck * 0.16 - cr * 0.14 - pr * 0.18;
        ud.rightLeg.position.z = airTuck * 0.08 - pr * 0.55;
      }
      if (ud.bodyGroup) {
        ud.bodyGroup.position.y = Math.sin(nextPhase) * 0.03 - cr * 0.38 - pr * 0.54;
        ud.bodyGroup.position.z = -pr * 0.22;
        ud.bodyGroup.rotation.z *= 0.84;
        ud.bodyGroup.rotation.x = THREE.MathUtils.lerp(
          ud.bodyGroup.rotation.x,
          -airTuck * 0.08 + cr * 0.22 + pr * 0.98,
          Math.min(1, dt * 14)
        );
      }
      if (ud.headGroup) {
        ud.headGroup.rotation.z = Math.sin(nextPhase * 0.5) * 0.02;
        ud.headGroup.position.y = 1.72 - cr * 0.38 - pr * 0.96 + Math.sin(nextPhase) * 0.015;
        ud.headGroup.position.z = cr * 0.16 + pr * 0.68;
        ud.headGroup.rotation.x = THREE.MathUtils.clamp(aimPitch * 0.65, -0.45, 0.45) - pr * 0.18;
      }
      if (ud.leftEar) ud.leftEar.rotation.z = 0.38 + airTuck * 0.18 + Math.sin(nextPhase) * 0.04;
      if (ud.rightEar) ud.rightEar.rotation.z = -0.38 - airTuck * 0.18 - Math.sin(nextPhase) * 0.04;
    }

    // Adjust Overhead Nameplate & Immunity Bubble height dynamically with Crouch / Crawl stance!
    if (ud.nameSprite) {
      ud.nameSprite.position.y = 3.15 - cr * 0.52 - pr * 1.08;
    }
    if (ud.immunityShieldGroup) {
      ud.immunityShieldGroup.position.y = 1.25 - cr * 0.28 - pr * 0.48;
    }

    // Mechanical Gun Shot Recoil, Vertical Aim Pitch, Stance Gun Lowering & Muzzle Blast Animation
    const runSwayY = isMoving ? Math.sin(nextPhase) * 0.032 : Math.sin(nextPhase) * 0.008;
    const baseGunY = 1.24 - cr * 0.34 - pr * 0.68 + runSwayY;
    const baseGunZ = 0.55 + cr * 0.08 + pr * 0.34;
    const clampedGunPitch = THREE.MathUtils.clamp(aimPitch, -0.58, 0.58);

    if (typeof ud.recoil === 'number' && ud.recoil > 0.01) {
      ud.recoil = Math.max(0, ud.recoil - dt * 6.8);
      if (ud.markerGroup) {
        ud.markerGroup.position.z = baseGunZ - ud.recoil * 0.26;
        ud.markerGroup.position.y = baseGunY + ud.recoil * 0.045;
        ud.markerGroup.rotation.x = clampedGunPitch - ud.recoil * 0.2;
      }
      if (ud.rightArmGroup) {
        ud.rightArmGroup.position.y = 1.18 - cr * 0.32 - pr * 0.62;
        ud.rightArmGroup.position.z = 0.42 + pr * 0.26 - ud.recoil * 0.18;
        ud.rightArmGroup.rotation.x = clampedGunPitch * 0.7 - ud.recoil * 0.16;
      }
      if (ud.boltMesh) {
        ud.boltMesh.position.z = -0.22 - Math.sin(ud.recoil * Math.PI) * 0.32;
      }
      if (ud.chamberBallMesh) {
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
        ud.markerGroup.position.z = baseGunZ;
        ud.markerGroup.position.y = baseGunY;
        ud.markerGroup.rotation.x = clampedGunPitch;
      }
      if (ud.rightArmGroup) {
        ud.rightArmGroup.position.y = 1.18 - cr * 0.32 - pr * 0.62;
        ud.rightArmGroup.position.z = 0.42 + pr * 0.26;
        ud.rightArmGroup.rotation.x = clampedGunPitch * 0.7;
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

    // Left Arm Crawl Motion or Long-Press Can Drinking / Charging 3D Pose
    if (ud.leftArmGroup && ud.heldCanMesh && ud.canAuraRing) {
      ud.leftArmGroup.position.y = 1.18 - cr * 0.32 - pr * 0.64;
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
        ud.leftArmGroup.rotation.x =
          pr > 0.2
            ? -0.95 + (isMoving ? Math.cos(nextPhase) * 0.42 : 0)
            : 0;
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

    spawnShockwaveRing(
      x,
      Math.max(0.08, y <= 1.2 ? 0.07 : y),
      z,
      colorHex,
      0.32,
      y <= 1.2 ? 1.85 : 2.35,
      0.26,
      true
    );

    const partMat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      clearcoat: 1.0,
      roughness: 0.1
    });
    for (let i = 0; i < 10; i++) {
      if (particles.length >= 150) break;
      const pMesh = new THREE.Mesh(sharedSplatSphereGeom, partMat);
      pMesh.position.set(x, Math.max(0.25, y), z);
      scene.add(pMesh);
      const theta = Math.random() * Math.PI * 2;
      particles.push({
        mesh: pMesh,
        vx: Math.cos(theta) * (2.5 + Math.random() * 8.5),
        vy: 3.4 + Math.random() * 6.2,
        vz: Math.sin(theta) * (2.5 + Math.random() * 8.5),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.2
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

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.32);
    sunLight.position.set(34, 68, 28);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 180;
    const d = 48;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Outer Park Meadow Backdrop so the horizon is bright, lush, and natural
    const outerMeadow = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshStandardMaterial({ color: 0x45942b, roughness: 0.9, metalness: 0.02 })
    );
    outerMeadow.rotation.x = -Math.PI / 2;
    outerMeadow.position.y = -0.04;
    scene.add(outerMeadow);

    // Compact Championship Speedball Turf (150m x 150m canvas, 76m x 64m playable field: x = ±38, z = ±32)
    // Red Squad Spawn at (0, -24) and Blue Squad Spawn at (0, +24) for immediate sightlines & fast action!
    const createProArenaTurfTexture = () => {
      const c = document.createElement('canvas');
      c.width = 2048;
      c.height = 2048;
      const ctx = c.getContext('2d')!;

      const planeSpan = 150;
      const toPxX = (wx: number) => (wx / planeSpan + 0.5) * 2048;
      const toPxY = (wz: number) => (wz / planeSpan + 0.5) * 2048;
      const toPxLen = (wLen: number) => (wLen / planeSpan) * 2048;

      // 1. Alternating Bright Mowed Championship Turf Stripes
      const stripeCount = 20;
      const stripeW = c.width / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#50a730' : '#61bd3d';
        ctx.fillRect(i * stripeW, 0, stripeW, c.height);
      }

      // Cross-hatch subtle grass blade texture
      for (let i = 0; i < 16000; i++) {
        const gx = Math.random() * c.width;
        const gy = Math.random() * c.height;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,40,10,0.07)';
        ctx.fillRect(gx, gy, 2, 4);
      }

      const fieldLeft = toPxX(-ARENA_HALF_W);
      const fieldRight = toPxX(ARENA_HALF_W);
      const fieldTop = toPxY(-ARENA_HALF_D);
      const fieldBottom = toPxY(ARENA_HALF_D);
      const fieldW = fieldRight - fieldLeft;
      const fieldH = fieldBottom - fieldTop;

      // 2. Stadium Outer Track Apron around the Playable Field
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.38)';
      ctx.lineWidth = toPxLen(3.2);
      ctx.strokeRect(
        fieldLeft - toPxLen(1.8),
        fieldTop - toPxLen(1.8),
        fieldW + toPxLen(3.6),
        fieldH + toPxLen(3.6)
      );

      // 3. Clean 3-Lane Speedball Sightline Markings (Center + Left/Right Wing Corridors)
      ctx.fillStyle = 'rgba(254, 249, 195, 0.24)';
      ctx.fillRect(toPxX(-2.2), toPxY(-TEAM_SPAWN_Z), toPxLen(4.4), toPxLen(TEAM_SPAWN_Z * 2));
      ctx.fillRect(fieldLeft + toPxLen(3), toPxY(-2.0), fieldW - toPxLen(6), toPxLen(4.0));

      ctx.save();
      ctx.strokeStyle = 'rgba(254, 249, 195, 0.3)';
      ctx.lineWidth = toPxLen(2.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(toPxX(0), toPxY(-20));
      ctx.lineTo(toPxX(-24), toPxY(0));
      ctx.lineTo(toPxX(0), toPxY(20));
      ctx.lineTo(toPxX(24), toPxY(0));
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // 4. Crisp White Stadium Boundary Lines (x = ±38, z = ±32)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.lineWidth = 10;
      ctx.strokeRect(fieldLeft, fieldTop, fieldW, fieldH);

      // Quarter-Field Tactical Lines (z = -13 and z = +13)
      ctx.save();
      ctx.setLineDash([20, 18]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fieldLeft, toPxY(-13));
      ctx.lineTo(fieldRight, toPxY(-13));
      ctx.moveTo(fieldLeft, toPxY(13));
      ctx.lineTo(fieldRight, toPxY(13));
      ctx.stroke();
      ctx.restore();

      // 50-Yard Horizontal Midfield Line (Separating North Red Half & South Blue Half)
      ctx.save();
      ctx.setLineDash([30, 16]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(fieldLeft, toPxY(0));
      ctx.lineTo(fieldRight, toPxY(0));
      ctx.stroke();
      ctx.restore();

      // Center Championship Circle (Unobstructed Open Center!)
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.beginPath();
      ctx.arc(toPxX(0), toPxY(0), toPxLen(8.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.95)';
      ctx.lineWidth = 9;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.88)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(toPxX(0), toPxY(0), toPxLen(5.4), 0, Math.PI * 2);
      ctx.stroke();

      // 5. TOP MIDDLE SPAWN AREA (RED SQUAD: centered at world x = 0, z = -24, 17m x 8.6m)
      const spW = toPxLen(17.0);
      const spH = toPxLen(8.6);
      const redTopX = toPxX(-8.5);
      const redTopY = toPxY(-TEAM_SPAWN_Z) - spH / 2;
      ctx.fillStyle = 'rgba(244, 63, 94, 0.62)';
      ctx.beginPath();
      ctx.roundRect(redTopX, redTopY, spW, spH, 24);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffe4e6';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px "Poppins", "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RED SQUAD SPAWN', toPxX(0), toPxY(-TEAM_SPAWN_Z));

      // 6. BOTTOM MIDDLE SPAWN AREA (BLUE SQUAD: centered at world x = 0, z = +24, 17m x 8.6m)
      const blueTopX = toPxX(-8.5);
      const blueTopY = toPxY(TEAM_SPAWN_Z) - spH / 2;
      ctx.fillStyle = 'rgba(37, 99, 235, 0.62)';
      ctx.beginPath();
      ctx.roundRect(blueTopX, blueTopY, spW, spH, 24);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#e0f2fe';
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 34px "Poppins", "Inter", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BLUE SQUAD SPAWN', toPxX(0), toPxY(TEAM_SPAWN_Z));

      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;
      return tex;
    };

    const groundMat = new THREE.MeshStandardMaterial({
      map: createProArenaTurfTexture(),
      roughness: 0.82,
      metalness: 0.04
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const obstacles: Array<{ x: number; z: number; r: number; h: number }> = [];

    // =========================================================
    // 3D TOP MIDDLE (RED: 0, -24) & BOTTOM MIDDLE (BLUE: 0, +24) SPAWN BASES
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

      // Compact 17m x 8.6m Team Spawn Base Perimeter Frame
      const borderMat = new THREE.MeshStandardMaterial({
        color: teamColorHex,
        emissive: teamColorHex,
        emissiveIntensity: 0.3,
        roughness: 0.28,
        metalness: 0.25
      });
      const halfW = 8.5;
      const halfD = 4.3;
      const barThick = 0.38;
      const barH = 0.16;

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

      // 4 Glowing Corner Beacons on the Spawn Perimeter
      const beaconGeom = new THREE.CylinderGeometry(0.28, 0.34, 0.58, 16);
      [
        [-halfW, -halfD],
        [halfW, -halfD],
        [-halfW, halfD],
        [halfW, halfD]
      ].forEach(([cx, cz]) => {
        const beacon = new THREE.Mesh(beaconGeom, borderMat);
        beacon.position.set(cx, 0.29, cz);
        spawnGroup.add(beacon);
      });

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
      bctx.font = '900 42px "Poppins", "Inter", system-ui, sans-serif';
      bctx.textAlign = 'center';
      bctx.textBaseline = 'middle';
      bctx.fillText(bannerLabel, 256, 64);
      const bannerTex = new THREE.CanvasTexture(bc);
      bannerTex.colorSpace = THREE.SRGBColorSpace;

      const groundPlaque = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 1.7),
        new THREE.MeshBasicMaterial({ map: bannerTex, polygonOffset: true, polygonOffsetFactor: -1 })
      );
      groundPlaque.rotation.x = -Math.PI / 2;
      groundPlaque.position.set(0, 0.04, z < 0 ? -halfD + 1.15 : halfD - 1.15);
      if (z < 0) {
        groundPlaque.rotation.z = Math.PI;
      }
      spawnGroup.add(groundPlaque);

      scene.add(spawnGroup);
    };

    createTeamCornerSpawnBase(0, -TEAM_SPAWN_Z, 0xf43f5e, 'RED SQUAD SPAWN', '#f43f5e');
    createTeamCornerSpawnBase(0, TEAM_SPAWN_Z, 0x2563eb, 'BLUE SQUAD SPAWN', '#38bdf8');

    // =========================================================
    // 3D COMPACT STADIUM PERIMETER DASHER WALLS (x = ±40, z = ±34 — 80m x 68m)
    // =========================================================
    const buildStadiumPerimeter = () => {
      const perimGroup = new THREE.Group();
      const wallBaseMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.35,
        metalness: 0.15
      });
      const redRailMat = new THREE.MeshStandardMaterial({
        color: 0xe11d48,
        emissive: 0xe11d48,
        emissiveIntensity: 0.18,
        roughness: 0.28
      });
      const blueRailMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        emissive: 0x2563eb,
        emissiveIntensity: 0.18,
        roughness: 0.28
      });
      const goldCapMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        metalness: 0.55,
        roughness: 0.25
      });

      const perimX = ARENA_HALF_W + 2; // ±40
      const perimZ = ARENA_HALF_D + 2; // ±34

      // North & South Perimeter Dasher Walls (at z = -34 and z = +34, width 80m)
      [-perimZ, perimZ].forEach(wz => {
        const isNorthRed = wz < 0;
        const wall = new THREE.Mesh(new THREE.BoxGeometry(perimX * 2, 1.12, 0.72), wallBaseMat);
        wall.position.set(0, 0.56, wz);
        wall.castShadow = true;
        wall.receiveShadow = true;
        perimGroup.add(wall);

        const topCushion = new THREE.Mesh(
          new THREE.BoxGeometry(perimX * 2 + 0.2, 0.24, 0.88),
          isNorthRed ? redRailMat : blueRailMat
        );
        topCushion.position.set(0, 1.22, wz);
        perimGroup.add(topCushion);
      });

      // West & East Perimeter Dasher Walls (split into Red North half & Blue South half, length 34m each)
      [-perimX, perimX].forEach(wx => {
        const nWall = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.12, perimZ), wallBaseMat);
        nWall.position.set(wx, 0.56, -perimZ / 2);
        nWall.castShadow = true;
        perimGroup.add(nWall);
        const nRail = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, perimZ), redRailMat);
        nRail.position.set(wx, 1.22, -perimZ / 2);
        perimGroup.add(nRail);

        const sWall = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.12, perimZ), wallBaseMat);
        sWall.position.set(wx, 0.56, perimZ / 2);
        sWall.castShadow = true;
        perimGroup.add(sWall);
        const sRail = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.24, perimZ), blueRailMat);
        sRail.position.set(wx, 1.22, perimZ / 2);
        perimGroup.add(sRail);

        const midPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 2.0, 20), goldCapMat);
        midPillar.position.set(wx, 1.0, 0);
        perimGroup.add(midPillar);
      });

      scene.add(perimGroup);
    };
    buildStadiumPerimeter();

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
        grad.addColorStop(0, 'rgba(0,0,0,0.22)');
        grad.addColorStop(0.2, 'rgba(255,255,255,0.22)');
        grad.addColorStop(0.8, 'rgba(255,255,255,0.06)');
        grad.addColorStop(1, 'rgba(0,0,0,0.25)');
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

      ctx.font = '900 36px "Poppins", "Inter", system-ui, sans-serif';
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
        metalness: 0.06,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        reflectivity: 0.9
      });

    // Full-Scale Championship Speedball Bunker Builders (3.9m - 4.9m tall & wide so barriers are substantially LARGER than the players for real tactical cover!)
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
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 2.55, 4.25, 3), mat);
      body.position.y = 2.125;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);

      const cap = new THREE.Mesh(
        new THREE.TorusGeometry(0.92, 0.26, 14, 24),
        new THREE.MeshPhysicalMaterial({ color: c3, clearcoat: 1.0, roughness: 0.15 })
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.y = 4.25;
      g.add(cap);

      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.3, h: 4.35 });
    };

    const createCan = (x: number, z: number, c1: string, c2: string, c3: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, c3, 'PRO CAN'));
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.22, 4.35, 28), mat);
      cyl.position.y = 2.175;
      cyl.castShadow = true;
      cyl.receiveShadow = true;
      g.add(cyl);

      const topRing = new THREE.Mesh(
        new THREE.TorusGeometry(2.04, 0.24, 12, 28),
        new THREE.MeshPhysicalMaterial({ color: c2, clearcoat: 1.0, roughness: 0.15 })
      );
      topRing.rotation.x = Math.PI / 2;
      topRing.position.y = 4.35;
      g.add(topRing);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.18, h: 4.4 });
    };

    const createLowSnakeShield = (x: number, z: number, rot: number, c1: string, c2: string) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(createProBunkerTexture(c1, c2, '#facc15', 'FORTRESS'));
      // 3 stacked horizontal mega-tubes + side vertical pillars reaching 3.9m tall (taller than players!)
      for (let i = 0; i < 3; i++) {
        const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.68, 3.8, 14, 22), mat);
        tube.rotation.z = Math.PI / 2;
        tube.position.y = 0.68 + i * 1.18;
        tube.castShadow = true;
        tube.receiveShadow = true;
        g.add(tube);
      }
      [-1.95, 1.95].forEach(px => {
        const pillar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.58, 0.64, 3.85, 18),
          new THREE.MeshPhysicalMaterial({ color: c2, clearcoat: 1.0, roughness: 0.18 })
        );
        pillar.position.set(px, 1.925, 0);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        g.add(pillar);
      });
      g.position.set(x, 0, z);
      g.rotation.y = rot;
      scene.add(g);
      obstacles.push({ x, z, r: 2.3, h: 3.95 });
    };

    const createCenterXBunker = (x: number, z: number, scale = 1.02) => {
      const g = new THREE.Group();
      const mat = makeInflatableMat(
        createProBunkerTexture('#0284c7', '#f43f5e', '#facc15', 'X-50')
      );
      const leg1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.92 * scale, 4.9 * scale, 16, 24), mat);
      leg1.position.y = 2.65 * scale;
      leg1.rotation.z = Math.PI / 4;
      leg1.castShadow = true;
      leg1.receiveShadow = true;
      g.add(leg1);

      const leg2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.92 * scale, 4.9 * scale, 16, 24), mat);
      leg2.position.y = 2.65 * scale;
      leg2.rotation.z = -Math.PI / 4;
      leg2.castShadow = true;
      leg2.receiveShadow = true;
      g.add(leg2);

      const coreHub = new THREE.Mesh(
        new THREE.CylinderGeometry(1.18 * scale, 1.18 * scale, 1.15 * scale, 20),
        new THREE.MeshPhysicalMaterial({ color: 0xfacc15, clearcoat: 1.0, roughness: 0.15 })
      );
      coreHub.rotation.x = Math.PI / 2;
      coreHub.position.y = 2.65 * scale;
      g.add(coreHub);

      g.position.set(x, 0, z);
      scene.add(g);
      obstacles.push({ x, z, r: 2.45 * scale, h: 4.85 * scale });
    };

    // =========================================================
    // COMPACT 14-BUNKER SYMMETRICAL 3-LANE SPEEDBALL LAYOUT (76m x 64m)
    // Full-height barriers (3.9m - 4.9m tall) taller than players with open center sightlines!
    // =========================================================
    // 1. Twin 50-Yard Giant X-Bunkers Flanking the Open Center Circle (2 bunkers)
    createCenterXBunker(-8.5, 0, 1.02);
    createCenterXBunker(8.5, 0, 1.02);

    // 2. Symmetrical Mid-Lane Tall Dorito Pyramids (4 bunkers)
    createDorito(-17.5, -8.5, '#f43f5e', '#facc15', '#ffffff', 0.35);
    createDorito(17.5, -8.5, '#0284c7', '#facc15', '#38bdf8', -0.35);
    createDorito(-17.5, 8.5, '#f43f5e', '#84cc16', '#ffffff', -0.35);
    createDorito(17.5, 8.5, '#0284c7', '#84cc16', '#38bdf8', 0.35);

    // 3. Symmetrical Outer Wing Mega Cans (4 bunkers)
    createCan(-28, -6.0, '#eab308', '#0f172a', '#fef08a');
    createCan(28, -6.0, '#eab308', '#0f172a', '#fef08a');
    createCan(-28, 6.0, '#10b981', '#0f172a', '#a7f3d0');
    createCan(28, 6.0, '#0ea5e9', '#0f172a', '#bae6fd');

    // 4. Symmetrical Home-Lane Tactical Fortress Walls (4 bunkers — taller than players in front of spawns)
    createLowSnakeShield(-11.0, -16, 0.16, '#e11d48', '#ffffff');
    createLowSnakeShield(11.0, -16, -0.16, '#e11d48', '#facc15');
    createLowSnakeShield(-11.0, 16, -0.16, '#2563eb', '#ffffff');
    createLowSnakeShield(11.0, 16, 0.16, '#2563eb', '#38bdf8');

    // =========================================================
    // 10 BALANCED 3D HEALTH CANS & DEFENCE CANS ACROSS THE COMPACT ARENA
    // =========================================================
    const powerupConfigs: Array<{ type: 'health' | 'shield'; x: number; z: number }> = [
      { type: 'shield', x: -13, z: 0 },
      { type: 'shield', x: 13, z: 0 },
      { type: 'health', x: -24, z: -12 },
      { type: 'health', x: 24, z: -12 },
      { type: 'health', x: -24, z: 12 },
      { type: 'health', x: 24, z: 12 },
      { type: 'health', x: -5, z: -10 },
      { type: 'shield', x: 5, z: -10 },
      { type: 'shield', x: -5, z: 10 },
      { type: 'health', x: 5, z: 10 }
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

    // =========================================================
    // COMPOSITE MULTI-PART STADIUM FLOODLIGHT & BANNER TOWERS (Outside ±40 x ±34 Perimeter)
    // =========================================================
    const buildStadiumFloodlightTower = (px: number, pz: number, accentHex: number) => {
      const tg = new THREE.Group();
      tg.position.set(px, 0, pz);

      const steelMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.78,
        roughness: 0.26
      });
      const pedestalMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.5,
        metalness: 0.4
      });
      const bannerMat = new THREE.MeshStandardMaterial({
        color: accentHex,
        emissive: accentHex,
        emissiveIntensity: 0.25,
        roughness: 0.3
      });

      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.25, 1.2, 16), pedestalMat);
      base.position.y = 0.6;
      base.castShadow = true;
      tg.add(base);

      [-0.36, 0.36].forEach(ox => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 11.0, 12), steelMat);
        col.position.set(ox, 6.0, 0);
        col.castShadow = true;
        tg.add(col);
      });

      for (let h = 2.5; h <= 10.2; h += 2.0) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.14, 0.16), steelMat);
        brace.position.set(0, h, 0);
        tg.add(brace);
      }

      const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 1.25), bannerMat);
      pennant.position.set(0, 6.8, px < 0 ? 0.75 : -0.75);
      tg.add(pennant);

      const hoodGroup = new THREE.Group();
      hoodGroup.position.set(0, 11.6, 0);
      hoodGroup.lookAt(0, 0, 0);

      const hoodBox = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.15, 0.5), pedestalMat);
      hoodGroup.add(hoodBox);

      const ledPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.15, 0.85),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3, side: THREE.DoubleSide })
      );
      ledPanel.position.z = 0.27;
      hoodGroup.add(ledPanel);

      tg.add(hoodGroup);
      scene.add(tg);
    };

    const bannerColors = [0xf43f5e, 0x38bdf8, 0x10b981, 0xfacc15];
    [
      [-43, -36.5],
      [0, -36.5],
      [43, -36.5],
      [-43, 36.5],
      [0, 36.5],
      [43, 36.5],
      [-43, 0],
      [43, 0]
    ].forEach(([px, pz], idx) => {
      buildStadiumFloodlightTower(px, pz, bannerColors[idx % bannerColors.length]);
    });

    // =========================================================
    // NATURAL OUTER PARK FOREST TREES AROUND STADIUM
    // =========================================================
    const createTree = (x: number, z: number, scale = 1) => {
      const tg = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45 * scale, 0.7 * scale, 3.6 * scale, 12),
        new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 })
      );
      trunk.position.y = 1.8 * scale;
      trunk.castShadow = true;
      tg.add(trunk);

      const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
      const leavesLightMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
      const l1 = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4 * scale, 1), leavesMat);
      l1.position.y = 4.4 * scale;
      l1.castShadow = true;
      tg.add(l1);

      const l2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8 * scale, 1), leavesLightMat);
      l2.position.set(0.8 * scale, 5.8 * scale, 0.35 * scale);
      l2.castShadow = true;
      tg.add(l2);

      const l3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 * scale, 1), leavesMat);
      l3.position.set(-0.7 * scale, 5.3 * scale, -0.3 * scale);
      l3.castShadow = true;
      tg.add(l3);

      tg.position.set(x, 0, z);
      scene.add(tg);
    };

    [
      [-50, -43, 1.3],
      [50, -43, 1.3],
      [-50, 43, 1.25],
      [50, 43, 1.3],
      [-24, -44, 1.18],
      [24, -44, 1.18],
      [-24, 44, 1.18],
      [24, 44, 1.2],
      [-52, -16, 1.2],
      [52, -16, 1.2],
      [-52, 16, 1.2],
      [52, 16, 1.2]
    ].forEach(([tx, tz, sc]) => createTree(tx, tz, sc));

    // =========================================================
    // 1 CHARACTER "TEACHER JAN" IN THE PARK DURING LOBBY ONLY!
    // =========================================================
    const teacherJanNpc = buildHighDefHamster(0, 'Teacher Jan', true, 'solo', true);
    teacherJanNpc.position.set(0, 0, -9.5);
    scene.add(teacherJanNpc);

    const isHostRole = stateSnapRef.current.role === 'host';
    const localLabel = isHostRole
      ? 'Teacher Jan'
      : stateSnapRef.current.matchMode === 'teams'
      ? `[${stateSnapRef.current.myTeam.toUpperCase()}] ${stateSnapRef.current.playerName || 'Student'}`
      : stateSnapRef.current.playerName || 'Student';

    // Hide nameSprite on localHamster (`showNameTag = false`) so personal view is 100% clean!
    const localHamster = buildHighDefHamster(
      selectedSkinIdx,
      localLabel,
      isHostRole,
      stateSnapRef.current.myTeam,
      false
    );

    const initialSpawn = getTeamSpawnPosition(
      stateSnapRef.current.myTeam,
      stateSnapRef.current.matchMode
    );
    const startX = isHostRole ? 0 : initialSpawn.x;
    const startZ = isHostRole ? 9.5 : initialSpawn.z;
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
    // Floor reticle & floor laser are permanently hidden: Aim is ALWAYS locked to the Center-Screen Crosshair!
    aimReticle.visible = false;
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
    aimLaserLine.visible = false;
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
      y: 0,
      jumpVy: 0,
      z: startZ,
      rotY: initYaw,
      camYaw: initYaw,
      camPitch: 0.12,
      camDistCurrent: 8.0,
      camHeightCurrent: 3.35,
      camShoulderCurrent: 1.22,
      camKick: 0,
      crouchLerp: 0,
      crawlLerp: 0,
      adsLerp: 0,
      recoilBloom: 0,
      shoulderSide: 1,
      virtualMouseLock: false,
      vx: 0,
      vz: 0,
      walkPhase: 0,
      keys: {},
      joyX: 0,
      joyZ: 0,
      mouseDown: false,
      isCameraDragging: false,
      dragMovedPx: 0,
      usingMouseAim: false,
      mouseScreenX: window.innerWidth / 2,
      mouseScreenY: window.innerHeight * 0.46,
      lastMouseX: window.innerWidth / 2,
      lastMouseY: window.innerHeight * 0.46,
      mouseInitialized: false,
      lookTouchId: null,
      lookTouchLastX: 0,
      lookTouchLastY: 0,
      lookTouchStartX: 0,
      lookTouchStartY: 0,
      aimWorldX: startX + Math.sin(initYaw) * 24,
      aimWorldY: 1.42,
      aimWorldZ: startZ + Math.cos(initYaw) * 24,
      lastShotTime: 0,
      hostCamX: 0,
      hostCamZ: 4,
      obstacles,
      powerups,
      projectiles: [],
      splatDecals: [],
      particles: [],
      shockwaves: [],
      remotePlayers: new Map(),
      broadcastChannel: broadcastChannelRef.current || undefined
    };

    // Re-populate any already-connected remote players into the freshly created scene
    stateSnapRef.current.roomPlayers.forEach(rp => {
      if (rp.id !== clientIdRef.current && rp.role === 'player' && !rp.kicked) {
        upsertRemotePlayer(rp);
      }
    });

    const isTypingInInput = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const mapCodeToKey = (code: string, fallbackKey: string): string => {
      switch (code) {
        case 'KeyW':
          return 'w';
        case 'KeyA':
          return 'a';
        case 'KeyS':
          return 's';
        case 'KeyD':
          return 'd';
        case 'ArrowUp':
          return 'arrowup';
        case 'ArrowDown':
          return 'arrowdown';
        case 'ArrowLeft':
          return 'arrowleft';
        case 'ArrowRight':
          return 'arrowright';
        case 'Space':
          return ' ';
        case 'KeyQ':
          return 'q';
        case 'KeyV':
          return 'v';
        case 'KeyH':
          return 'h';
        case 'KeyF':
          return 'f';
        case 'KeyE':
          return 'e';
        case 'KeyZ':
          return 'z';
        case 'KeyX':
          return 'x';
        case 'KeyC':
          return 'c';
        case 'ControlLeft':
        case 'ControlRight':
          return 'ctrl';
        case 'ShiftLeft':
        case 'ShiftRight':
          return 'shift';
        case 'Escape':
          return 'escape';
        case 'Digit1':
          return '1';
        case 'Digit2':
          return '2';
        default:
          return fallbackKey.toLowerCase();
      }
    };

    const getBaseFov = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      if (aspect < 1.0) {
        return THREE.MathUtils.clamp(50 / Math.pow(aspect, 0.42), 54, 72);
      }
      if (w < 1200) return 52;
      return 48;
    };

    // PUBG Keyboard Bindings: WASD Move, Space Jump, C/Ctrl Crouch ("Crunch"), Z/X Crawl ("Prone"), Shift/RMB Scope, E Swap Shoulder, V Camera
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameRef.current || isTypingInInput(e.target)) return;
      const g = gameRef.current;
      const snap = stateSnapRef.current;
      const k = mapCodeToKey(e.code, e.key);

      if (k === 'escape') {
        g.virtualMouseLock = false;
        setIsAimLocked(false);
        if (document.pointerLockElement) {
          try {
            document.exitPointerLock();
          } catch {}
        }
        return;
      }

      if (k === 'v' && !e.repeat && snap.role === 'player' && snap.screen === 'game' && !snap.isAnyModalOpen) {
        cycleCameraViewPreset();
        return;
      }

      // Enforce: Answer questions ONLY during the active game (`matchStatus === 'playing'`)
      if (
        k === 'q' &&
        !e.repeat &&
        snap.role === 'player' &&
        snap.screen === 'game' &&
        snap.matchStatus === 'playing'
      ) {
        setIsQuestionModalOpen(prev => !prev);
        return;
      }

      if (snap.isAnyModalOpen) {
        return;
      }

      // Laptop PUBG Stance, Jump, Scope & Shoulder-Swap Keys for Student Players
      if (snap.role === 'player' && snap.screen === 'game') {
        if (k === ' ') {
          e.preventDefault();
          if (!e.repeat) {
            triggerPlayerJump();
          }
          return;
        }
        if ((k === 'c' || k === 'ctrl') && !e.repeat) {
          e.preventDefault();
          togglePlayerStance('crouch');
          return;
        }
        if ((k === 'z' || k === 'x') && !e.repeat) {
          e.preventDefault();
          togglePlayerStance('crawl');
          return;
        }
        if (k === 'shift' && !e.repeat) {
          toggleAdsScope();
          return;
        }
        if (k === 'e' && !e.repeat) {
          g.shoulderSide = g.shoulderSide === 1 ? -1 : 1;
          sfx.playCameraSwitch();
          return;
        }
      }

      g.keys[k] = true;

      // Keyboard Long-Press Shortcuts for Health Can ('1' or 'h') & Defence Can ('2' or 'f')
      if (!e.repeat && snap.role === 'player' && snap.screen === 'game') {
        if (k === '1' || k === 'h') {
          startCanLongPress('health');
        } else if (k === '2' || k === 'f') {
          startCanLongPress('shield');
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!gameRef.current) return;
      const k = mapCodeToKey(e.code, e.key);
      gameRef.current.keys[k] = false;
      const rawLower = e.key.toLowerCase();
      gameRef.current.keys[rawLower] = false;
      if (k === '1' || k === 'h' || k === '2' || k === 'f') {
        stopCanLongPress();
      }
    };

    const handleWindowBlurOrHide = () => {
      resetAllActiveInputs();
      stopCanLongPress();
    };

    // Track recent touch activity so mobile browsers' synthetic mousemove events never cause sudden camera rotation
    let lastTouchEventTime = 0;

    // PUBG 360° Free Mouse-Look Aiming (Pointer Lock + Seamless Virtual Lock Fallback) + Separate Free-Cursor Mode
    const handleMouseMove = (e: MouseEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if (performance.now() - lastTouchEventTime < 1000) {
        g.lastMouseX = e.clientX;
        g.lastMouseY = e.clientY;
        return;
      }

      const snap = stateSnapRef.current;
      const isNativePointerLocked = document.pointerLockElement === renderer.domElement;
      const rawDx =
        isNativePointerLocked && typeof e.movementX === 'number'
          ? e.movementX
          : g.mouseInitialized
          ? e.clientX - g.lastMouseX
          : 0;
      const rawDy =
        isNativePointerLocked && typeof e.movementY === 'number'
          ? e.movementY
          : g.mouseInitialized
          ? e.clientY - g.lastMouseY
          : 0;

      g.lastMouseX = e.clientX;
      g.lastMouseY = e.clientY;
      g.mouseInitialized = true;
      g.usingMouseAim = true;
      g.mouseScreenX = e.clientX;
      g.mouseScreenY = e.clientY;

      if (snap.isAnyModalOpen) return;

      const isControllingCharacter =
        (snap.role === 'player' && snap.screen === 'game') ||
        (snap.role === 'host' && snap.screen === 'lobby');
      if (!isControllingCharacter) return;

      // Update Separate Aim Reticle coordinates smoothly when in 'separate' mode!
      if (snap.role === 'player' && snap.aimControlMode === 'separate' && !g.isCameraDragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const aimSens = snap.aimSensitivity || 1.0;
          const rawXPct = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 100, 8, 92);
          const rawYPct = THREE.MathUtils.clamp(((e.clientY - rect.top) / rect.height) * 100, 12, 86);
          const blend = Math.min(1, 0.48 * aimSens + 0.35);
          const nextX = aimReticlePctRef.current.x + (rawXPct - aimReticlePctRef.current.x) * blend;
          const nextY = aimReticlePctRef.current.y + (rawYPct - aimReticlePctRef.current.y) * blend;
          aimReticlePctRef.current = { x: nextX, y: nextY };
          setAimReticlePct({ x: nextX, y: nextY });
        }
      }

      // Guard against sudden large cursor jumps when mouse re-enters window or closes a modal
      if (!isNativePointerLocked && (Math.abs(rawDx) > 55 || Math.abs(rawDy) > 55)) {
        return;
      }

      const clampedDx = THREE.MathUtils.clamp(rawDx, -65, 65);
      const clampedDy = THREE.MathUtils.clamp(rawDy, -65, 65);

      const isPubgMouseAimActive =
        isNativePointerLocked ||
        (snap.role === 'player' &&
          snap.screen === 'game' &&
          snap.aimControlMode === 'shoulder' &&
          !snap.isTouchHudVisible &&
          g.virtualMouseLock);

      const isActivelyRotatingCamera =
        isPubgMouseAimActive ||
        g.isCameraDragging ||
        (snap.role === 'host' && (e.buttons & 2) === 2) ||
        (snap.aimControlMode === 'shoulder' && (e.buttons & 1) === 1 && g.dragMovedPx > 2);

      if (g.mouseDown || g.isCameraDragging) {
        g.dragMovedPx += Math.hypot(clampedDx, clampedDy);
      }

      if (isActivelyRotatingCamera) {
        const camSens = snap.cameraSensitivity || 1.0;
        const aimSens = snap.aimSensitivity || 1.0;
        const adsMult = snap.isAdsScoped ? 0.62 : 1.0;
        const combinedSens = camSens * (0.65 + aimSens * 0.35) * adsMult;
        const yawSpeed = isNativePointerLocked ? 0.0029 : 0.0045;
        const pitchSpeed = isNativePointerLocked ? 0.0023 : 0.0034;
        g.camYaw -= clampedDx * yawSpeed * combinedSens;
        // Full 3D PUBG vertical pitch: look high up (-0.44 rad) or down at prone targets (+0.52 rad)!
        g.camPitch = THREE.MathUtils.clamp(
          g.camPitch + clampedDy * pitchSpeed * combinedSens,
          -0.44,
          0.52
        );
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouchEventTime < 1000) return;
      if (!gameRef.current || stateSnapRef.current.isAnyModalOpen) return;
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== 'CANVAS') {
        return;
      }
      const g = gameRef.current;
      const snap = stateSnapRef.current;
      g.usingMouseAim = true;
      g.mouseScreenX = e.clientX;
      g.mouseScreenY = e.clientY;
      g.lastMouseX = e.clientX;
      g.lastMouseY = e.clientY;
      g.mouseInitialized = true;
      g.dragMovedPx = 0;

      // Right-Click on Student Player in Game toggles PUBG 2x ADS Scope! (In Separate mode or Host Lobby, orbits camera)
      if (e.button === 2) {
        if (snap.role === 'player' && snap.screen === 'game' && snap.aimControlMode === 'shoulder') {
          toggleAdsScope();
          if (!snap.isTouchHudVisible) {
            g.virtualMouseLock = true;
            setIsAimLocked(true);
            if (!document.pointerLockElement && renderer.domElement.requestPointerLock) {
              try {
                const lockRes = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
                if (lockRes && typeof lockRes.catch === 'function') lockRes.catch(() => {});
              } catch {}
            }
          }
          return;
        }
        g.isCameraDragging = true;
        return;
      }

      if (e.button === 1) {
        g.isCameraDragging = true;
        return;
      }

      if (e.button !== 0) return;
      g.mouseDown = true;

      // Engage PUBG Mouse Aim Lock on Laptop when clicking the 3D Arena Canvas!
      if (
        snap.role === 'player' &&
        snap.screen === 'game' &&
        snap.aimControlMode === 'shoulder' &&
        !snap.isTouchHudVisible
      ) {
        g.virtualMouseLock = true;
        setIsAimLocked(true);
        if (!document.pointerLockElement && renderer.domElement.requestPointerLock) {
          try {
            const lockRes = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined;
            if (lockRes && typeof lockRes.catch === 'function') lockRes.catch(() => {});
          } catch {}
        }
      }

      if (snap.role === 'player' && snap.screen === 'game' && snap.aimControlMode === 'separate') {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const rx = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 100, 8, 92);
          const ry = THREE.MathUtils.clamp(((e.clientY - rect.top) / rect.height) * 100, 12, 86);
          aimReticlePctRef.current = { x: rx, y: ry };
          setAimReticlePct({ x: rx, y: ry });
        }
      }

      if (
        (snap.role === 'player' && snap.screen === 'game') ||
        (snap.role === 'host' && snap.screen === 'lobby')
      ) {
        fireShot();
      }
    };

    const handleMouseUp = () => {
      if (!gameRef.current) return;
      gameRef.current.mouseDown = false;
      gameRef.current.isCameraDragging = false;
      gameRef.current.dragMovedPx = 0;
    };

    const handleCanvasContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'CANVAS') {
        e.preventDefault();
      }
    };

    // Mobile / Tablet Touch-Drag on Arena (PUBG Free-Look Swipe + Separate Aim Tap Support)
    const handleWindowTouchStart = (e: TouchEvent) => {
      lastTouchEventTime = performance.now();
      setDetectedTouchDevice(true);
      const g = gameRef.current;
      const snap = stateSnapRef.current;
      if (g) {
        g.usingMouseAim = false;
        g.virtualMouseLock = false;
      }
      const canControlTouchLook =
        !snap.isAnyModalOpen &&
        ((snap.role === 'player' && snap.screen === 'game') ||
          (snap.role === 'host' && snap.screen === 'lobby'));
      if (!g || !canControlTouchLook) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest('button, input, select, textarea, a, .host-lobby-interactive-panel, .pb-touch-joystick')
      ) {
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystickTouchIdRef.current) continue;
        const isBottomLeftJoystickZone =
          t.clientX < window.innerWidth * 0.34 && t.clientY > window.innerHeight * 0.52;
        if (!isBottomLeftJoystickZone && g.lookTouchId === null) {
          g.lookTouchId = t.identifier;
          g.lookTouchStartX = t.clientX;
          g.lookTouchStartY = t.clientY;
          g.lookTouchLastX = t.clientX;
          g.lookTouchLastY = t.clientY;
          g.mouseScreenX = t.clientX;
          g.mouseScreenY = t.clientY;

          // In Separate Camera & Aim mode on touch: tapping upper/center arena positions the Aim Reticle directly!
          if (
            snap.role === 'player' &&
            snap.aimControlMode === 'separate' &&
            t.clientX < window.innerWidth * 0.76 &&
            t.clientY < window.innerHeight * 0.74
          ) {
            const rect = renderer.domElement.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              const rx = THREE.MathUtils.clamp(((t.clientX - rect.left) / rect.width) * 100, 10, 90);
              const ry = THREE.MathUtils.clamp(((t.clientY - rect.top) / rect.height) * 100, 14, 78);
              aimReticlePctRef.current = { x: rx, y: ry };
              setAimReticlePct({ x: rx, y: ry });
            }
          }
          break;
        }
      }
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      lastTouchEventTime = performance.now();
      const g = gameRef.current;
      const snap = stateSnapRef.current;
      if (!g || g.lookTouchId === null || snap.isAnyModalOpen) return;
      g.usingMouseAim = false;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === g.lookTouchId) {
          const dx = t.clientX - g.lookTouchLastX;
          const dy = t.clientY - g.lookTouchLastY;
          g.lookTouchLastX = t.clientX;
          g.lookTouchLastY = t.clientY;
          g.mouseScreenX = t.clientX;
          g.mouseScreenY = t.clientY;
          if (Math.abs(dx) > 55 || Math.abs(dy) > 55) {
            break;
          }
          const camSens = snap.cameraSensitivity || 1.0;
          const aimSens = snap.aimSensitivity || 1.0;
          const adsMult = snap.isAdsScoped ? 0.62 : 1.0;
          const touchSens = camSens * (0.65 + aimSens * 0.35) * adsMult;
          g.camYaw -= dx * 0.0058 * touchSens;
          g.camPitch = THREE.MathUtils.clamp(
            g.camPitch + dy * 0.0042 * touchSens,
            -0.44,
            0.52
          );
          break;
        }
      }
    };

    const handleWindowTouchEnd = (e: TouchEvent) => {
      const g = gameRef.current;
      let joyStillActive = false;
      let lookStillActive = false;
      for (let i = 0; i < e.touches.length; i++) {
        const activeId = e.touches[i].identifier;
        if (activeId === joystickTouchIdRef.current) joyStillActive = true;
        if (g && activeId === g.lookTouchId) lookStillActive = true;
      }
      if (!joyStillActive && joystickTouchIdRef.current !== null) {
        joystickTouchIdRef.current = null;
        setJoystickVec({ x: 0, y: 0 });
        if (g) {
          g.joyX = 0;
          g.joyZ = 0;
        }
      }
      if (g && !lookStillActive) {
        g.lookTouchId = null;
      }
      if (e.touches.length === 0 && g) {
        g.shootButtonHeld = false;
      }
    };

    const handleResize = () => {
      if (!gameRef.current || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / Math.max(1, h);
      gameRef.current.camera.aspect = aspect;
      const baseFov = getBaseFov();
      gameRef.current.camera.fov = THREE.MathUtils.lerp(baseFov, 32, gameRef.current.adsLerp || 0);
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
    window.addEventListener('contextmenu', handleCanvasContextMenu);
    window.addEventListener('blur', handleWindowBlurOrHide);
    document.addEventListener('visibilitychange', handleWindowBlurOrHide);
    window.addEventListener('touchstart', handleWindowTouchStart, { passive: true });
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: true });
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    // =========================================================
    // MAIN 60FPS ANIMATION LOOP (PUBG TPS AIM + ADS 2X SCOPE + JUMP / CROUCH / CRAWL)
    // =========================================================
    let lastTime = performance.now();
    // Pre-allocated math objects for zero-GC 60fps raycasting
    const _aimRaycaster = new THREE.Raycaster();
    const _aimReticleNdc = new THREE.Vector2(0, 0.08);
    const _groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.1);
    const _aimPlaneHit = new THREE.Vector3();

    const getStanceHitHeight = (st?: 'stand' | 'crouch' | 'crawl') =>
      st === 'crawl' ? 1.42 : st === 'crouch' ? 2.35 : 3.45;

    const animate = (now: number) => {
      animFrameRef.current = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const g = gameRef.current;
      if (!g) return;
      const snapState = stateSnapRef.current;

      // Teacher Jan NPC is visible to students in the Lobby
      if (g.teacherJanNpc) {
        const showTeacherJanInLobby =
          snapState.matchStatus === 'lobby' && snapState.role !== 'host';
        g.teacherJanNpc.visible = showTeacherJanInLobby;
        if (showTeacherJanInLobby) {
          g.teacherJanNpc.position.set(0, 0, -9.5);
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

      // Keyboard WASD / Arrow Keys + Deadzone-Filtered Mobile Virtual Touch Joystick (Muted whenever any modal is open!)
      let rawX = 0;
      let rawZ = 0;
      if (!snapState.isAnyModalOpen) {
        rawX = Math.abs(g.joyX) > 0.08 ? g.joyX : 0;
        rawZ = Math.abs(g.joyZ) > 0.08 ? g.joyZ : 0;
        if (g.keys['w'] || g.keys['arrowup']) rawZ -= 1;
        if (g.keys['s'] || g.keys['arrowdown']) rawZ += 1;
        if (g.keys['a']) rawX -= 1;
        if (g.keys['d']) rawX += 1;

        // ArrowLeft / ArrowRight allow smooth keyboard camera look when playing without a mouse
        if (snapState.role === 'player' && snapState.screen === 'game') {
          if (g.keys['arrowleft']) {
            g.camYaw += 2.2 * (snapState.cameraSensitivity || 1.0) * dt;
          }
          if (g.keys['arrowright']) {
            g.camYaw -= 2.2 * (snapState.cameraSensitivity || 1.0) * dt;
          }
        } else {
          if (g.keys['arrowleft']) rawX -= 1;
          if (g.keys['arrowright']) rawX += 1;
        }
      }

      const isMoving = Math.hypot(rawX, rawZ) > 0.06;
      if (isMoving) {
        const len = Math.hypot(rawX, rawZ);
        if (len > 1) {
          rawX /= len;
          rawZ /= len;
        }
      } else {
        rawX = 0;
        rawZ = 0;
      }

      const serverNowMs = getServerNow();

      // Host controls their 3D character (`Teacher Jan`) freely in the Lobby, and switches to spectator/player-follow camera when the game starts!
      if (snapState.role === 'host' && snapState.screen === 'game') {
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

            remotes.forEach(rp => {
              if (rp.mesh.userData?.nameSprite) {
                rp.mesh.userData.nameSprite.visible = rp !== matchedEntry;
              }
            });

            const tx = matchedEntry.mesh.position.x;
            const ty = matchedEntry.mesh.position.y || 0;
            const tz = matchedEntry.mesh.position.z;
            const tYaw = matchedEntry.mesh.rotation.y || 0;
            const camAspect = camera.aspect || 1.5;
            const portraitOffset =
              camAspect < 1.0 ? Math.min(4.2, (1.0 - camAspect) * 8) : camAspect < 1.4 ? 1.0 : 0;
            const followDist = 8.4 + portraitOffset * 0.45;
            const followHeight = 5.2 + ty * 0.6 + portraitOffset * 0.35;
            const desiredCamX = THREE.MathUtils.clamp(
              tx - Math.sin(tYaw) * followDist,
              -ARENA_HALF_W,
              ARENA_HALF_W
            );
            const desiredCamZ = THREE.MathUtils.clamp(
              tz - Math.cos(tYaw) * followDist,
              -ARENA_HALF_D,
              ARENA_HALF_D
            );
            const lookX = tx + Math.sin(tYaw) * 11.0;
            const lookZ = tz + Math.cos(tYaw) * 11.0;
            g.hostCamX += (tx - g.hostCamX) * 8 * dt;
            g.hostCamZ += (tz - g.hostCamZ) * 8 * dt;
            camera.position.x += (desiredCamX - camera.position.x) * 8 * dt;
            camera.position.y += (followHeight - camera.position.y) * 8 * dt;
            camera.position.z += (desiredCamZ - camera.position.z) * 8 * dt;
            camera.lookAt(lookX, 1.8 + ty * 0.5, lookZ);
          } else {
            camera.position.x += (0 - camera.position.x) * 5 * dt;
            camera.position.y += (22.0 - camera.position.y) * 5 * dt;
            camera.position.z += (26.0 - camera.position.z) * 5 * dt;
            camera.lookAt(0, 1.4, 0);
          }
        } else {
          g.remotePlayers.forEach(rp => {
            if (rp.mesh.userData?.nameSprite) {
              rp.mesh.userData.nameSprite.visible = true;
            }
          });
          // Host Overview Camera across the compact 76m x 64m speedball park
          if (isMoving) {
            g.hostCamX = Math.max(-30, Math.min(30, g.hostCamX + rawX * 26 * dt));
            g.hostCamZ = Math.max(-24, Math.min(24, g.hostCamZ + rawZ * 26 * dt));
          }
          const camAspect = camera.aspect || 1.5;
          const portraitZoomOut = camAspect < 1.0 ? Math.min(10, (1.0 - camAspect) * 18) : 0;
          const targetY = 28 + portraitZoomOut;
          const targetZ = g.hostCamZ + 25 + portraitZoomOut * 0.7;
          camera.position.x += (g.hostCamX - camera.position.x) * 5 * dt;
          camera.position.y += (targetY - camera.position.y) * 5 * dt;
          camera.position.z += (targetZ - camera.position.z) * 5 * dt;
          camera.lookAt(g.hostCamX, 1.4, g.hostCamZ - 2);
        }
      } else {
        // ---------------------------------------------------
        // INTERACTIVE 3D CHARACTER MOVEMENT, JUMP, CROUCH & CRAWL
        // ---------------------------------------------------
        g.localHamster.visible = true;
        const activeStance = snapState.role === 'player' ? snapState.playerStance : 'stand';

        // 3D Vertical Jump Physics & Turf Landing Shockwave
        const prevY = g.y;
        if (g.y > 0 || g.jumpVy !== 0) {
          g.jumpVy -= 25.0 * dt;
          g.y += g.jumpVy * dt;
          if (g.y <= 0) {
            g.y = 0;
            if (prevY > 0.22 && g.jumpVy < -3.0) {
              sfx.playFootstep();
              spawnShockwaveRing(g.x, 0.06, g.z, 0xffffff, 0.35, 1.45, 0.24, false);
            }
            g.jumpVy = 0;
          }
        }

        // Stance & ADS Movement Speeds (Stand: 15.6, Crouch: 10.8, Prone Crawl: 6.2)
        const baseSpeed =
          activeStance === 'crawl' ? 6.2 : activeStance === 'crouch' ? 10.8 : 15.6;
        const speed = snapState.isAdsScoped ? baseSpeed * 0.78 : baseSpeed;

        const forwardInput = -rawZ;
        const rightInput = rawX;
        const fwdX = Math.sin(g.camYaw);
        const fwdZ = Math.cos(g.camYaw);
        const rightX = -Math.cos(g.camYaw);
        const rightZ = Math.sin(g.camYaw);

        const moveWorldX = fwdX * forwardInput + rightX * rightInput;
        const moveWorldZ = fwdZ * forwardInput + rightZ * rightInput;

        g.vx = moveWorldX * speed;
        g.vz = moveWorldZ * speed;

        g.x = Math.max(-(ARENA_HALF_W - 0.8), Math.min(ARENA_HALF_W - 0.8, g.x + g.vx * dt));
        g.z = Math.max(-(ARENA_HALF_D - 0.8), Math.min(ARENA_HALF_D - 0.8, g.z + g.vz * dt));

        // Opening Spawn Hold inside compact Red Spawn (0, -24) or Blue Spawn (0, +24)
        if (snapState.matchStatus === 'playing' && serverNowMs < snapState.spawnHoldUntil) {
          const isBluePlayer = snapState.myTeam === 'blue';
          const minSpawnX = -8.2;
          const maxSpawnX = 8.2;
          const minSpawnZ = isBluePlayer ? 19.8 : -28.2;
          const maxSpawnZ = isBluePlayer ? 28.2 : -19.8;
          g.x = Math.max(minSpawnX, Math.min(maxSpawnX, g.x));
          g.z = Math.max(minSpawnZ, Math.min(maxSpawnZ, g.z));
        }

        // Accessible Smooth Obstacle Collisions (Allows jumping onto or over low rims when airborne above obs.h!)
        g.obstacles.forEach(obs => {
          if (g.y > obs.h + 0.1) return;
          const dx = g.x - obs.x;
          const dz = g.z - obs.z;
          const d = Math.hypot(dx, dz);
          const minDist = obs.r + 0.95;
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
          if (dist < 2.8 && !closestCan) {
            closestCan = { id: pu.id, type: pu.type };
          }
          if (dist < 2.1) {
            if (pu.type === 'health' && snapState.healthCans < 3) {
              pu.active = false;
              pu.mesh.visible = false;
              pu.respawnAt = now + 11000;
              sfx.playCanPickup();
              setHealthCans(c => Math.min(3, c + 1));
              setPickupBannerText('🧪 COLLECTED HEALTH CAN (+45 HP)!');
              setTimeout(() => setPickupBannerText(null), 2200);
            } else if (pu.type === 'shield' && snapState.shieldCans < 3) {
              pu.active = false;
              pu.mesh.visible = false;
              pu.respawnAt = now + 11000;
              sfx.playCanPickup();
              setShieldCans(c => Math.min(3, c + 1));
              setPickupBannerText('🛡️ COLLECTED DEFENCE CAN (+50 SHIELD)!');
              setTimeout(() => setPickupBannerText(null), 2200);
            }
          }
        });
        setNearbyArenaCan(prev =>
          prev?.id === closestCan?.id && prev?.type === closestCan?.type ? prev : closestCan
        );

        // ---------------------------------------------------
        // PUBG TPS OVER-SHOULDER CAMERA + 2X ADS SCOPE ZOOM + STANCE EYE HEIGHT
        // ---------------------------------------------------
        const camAspect = camera.aspect || 1.5;
        const portraitOffset =
          camAspect < 1.0 ? Math.min(3.4, (1.0 - camAspect) * 6.4) : camAspect < 1.4 ? 0.75 : 0;

        const presetCfg =
          snapState.cameraViewPreset === 'close'
            ? { dist: 5.8, height: 2.65, shoulder: 1.34, lookDist: 26, lookRight: 1.1 }
            : snapState.cameraViewPreset === 'far'
            ? { dist: 11.0, height: 4.75, shoulder: 1.02, lookDist: 26, lookRight: 0.8 }
            : snapState.cameraViewPreset === 'tactical'
            ? { dist: 14.0, height: 7.5, shoulder: 0.54, lookDist: 24, lookRight: 0.42 }
            : { dist: 7.9, height: 3.25, shoulder: 1.24, lookDist: 26, lookRight: 0.98 };

        g.crouchLerp = THREE.MathUtils.damp(g.crouchLerp, activeStance === 'crouch' ? 1 : 0, 12, dt);
        g.crawlLerp = THREE.MathUtils.damp(g.crawlLerp, activeStance === 'crawl' ? 1 : 0, 12, dt);
        const prevAdsLerp = g.adsLerp;
        g.adsLerp = THREE.MathUtils.damp(g.adsLerp, snapState.isAdsScoped ? 1 : 0, 14, dt);
        if (Math.abs(g.adsLerp - prevAdsLerp) > 0.001) {
          const baseFov = getBaseFov();
          camera.fov = THREE.MathUtils.lerp(baseFov, 31, g.adsLerp);
          camera.updateProjectionMatrix();
        }

        const stanceCamDrop = g.crouchLerp * 0.78 + g.crawlLerp * 1.32;
        const adsDistScale = 1 - g.adsLerp * 0.42;
        const adsShoulderScale = 1 - g.adsLerp * 0.25;

        g.camKick = THREE.MathUtils.damp(g.camKick, 0, 18, dt);
        g.camDistCurrent = THREE.MathUtils.damp(
          g.camDistCurrent,
          (presetCfg.dist + portraitOffset * 0.42) * adsDistScale + g.camKick * 0.28,
          12,
          dt
        );
        g.camHeightCurrent = THREE.MathUtils.damp(
          g.camHeightCurrent,
          Math.max(
            0.95,
            presetCfg.height -
              stanceCamDrop +
              g.y * 0.78 +
              Math.sin(g.camPitch) * 3.6 +
              portraitOffset * 0.25 -
              g.adsLerp * 0.35
          ),
          12,
          dt
        );
        const rawShoulder =
          (camAspect < 0.85 ? presetCfg.shoulder * 0.78 : presetCfg.shoulder) *
          adsShoulderScale *
          g.shoulderSide;
        g.camShoulderCurrent = THREE.MathUtils.damp(g.camShoulderCurrent, rawShoulder, 12, dt);

        const camFwdX = Math.sin(g.camYaw);
        const camFwdZ = Math.cos(g.camYaw);
        const camRightX = -Math.cos(g.camYaw);
        const camRightZ = Math.sin(g.camYaw);

        const rawTargetCamX =
          g.x - camFwdX * g.camDistCurrent + camRightX * g.camShoulderCurrent;
        const rawTargetCamZ =
          g.z - camFwdZ * g.camDistCurrent + camRightZ * g.camShoulderCurrent;
        const clampedCamX = THREE.MathUtils.clamp(
          rawTargetCamX,
          -(ARENA_HALF_W + 3.5),
          ARENA_HALF_W + 3.5
        );
        const clampedCamZ = THREE.MathUtils.clamp(
          rawTargetCamZ,
          -(ARENA_HALF_D + 3.5),
          ARENA_HALF_D + 3.5
        );

        camera.position.x = THREE.MathUtils.damp(camera.position.x, clampedCamX, 18, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, g.camHeightCurrent, 18, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, clampedCamZ, 18, dt);

        const lookRightAmt =
          (camAspect < 0.85 ? presetCfg.lookRight * 0.78 : presetCfg.lookRight) *
          adsShoulderScale *
          g.shoulderSide;
        const camLookX = g.x + camFwdX * presetCfg.lookDist + camRightX * lookRightAmt;
        const camLookZ = g.z + camFwdZ * presetCfg.lookDist + camRightZ * lookRightAmt;
        const baseEyeY =
          (snapState.cameraViewPreset === 'tactical' ? 1.35 : 1.95) -
          stanceCamDrop * 0.82 +
          g.y * 0.78;
        // True PUBG 3D vertical pitch look target: look smoothly up into the sky or down onto the ground!
        const camLookY = THREE.MathUtils.clamp(
          baseEyeY - Math.tan(g.camPitch) * (presetCfg.lookDist * 0.58),
          -5.5,
          12.5
        );
        camera.lookAt(camLookX, camLookY, camLookZ);
        camera.updateMatrixWorld();

        // Update Dynamic PUBG Crosshair Bloom Spread (expands on move/jump/shot, tightens on crouch/crawl/ADS)
        g.recoilBloom = THREE.MathUtils.damp(g.recoilBloom, 0, 12, dt);
        const stanceBaseSpread =
          activeStance === 'crawl' ? 4 : activeStance === 'crouch' ? 6 : 9;
        const moveSpread = isMoving ? (activeStance === 'crawl' ? 3 : 6) : 0;
        const airSpread = g.y > 0.08 ? 11 : 0;
        const targetSpread = snapState.isAdsScoped
          ? Math.max(2, (stanceBaseSpread + g.recoilBloom) * 0.35)
          : stanceBaseSpread + moveSpread + airSpread + g.recoilBloom;
        const nextSpreadRounded = Math.round(
          THREE.MathUtils.damp(crosshairSpreadRef.current, targetSpread, 15, dt)
        );
        if (Math.abs(nextSpreadRounded - crosshairSpreadRef.current) >= 1) {
          crosshairSpreadRef.current = nextSpreadRounded;
          setCrosshairSpreadPx(nextSpreadRounded);
        }

        // Compute Reticle NDC: PUBG Center-Screen Sight (`x: 50%, y: 46%` => `(0, +0.08)`) OR Separate Free-Aim!
        if (snapState.role === 'player' && snapState.aimControlMode === 'separate') {
          const rPct = aimReticlePctRef.current;
          _aimReticleNdc.set((rPct.x / 100) * 2 - 1, 1 - (rPct.y / 100) * 2);
        } else {
          _aimReticleNdc.set(0, 0.08);
        }

        _aimRaycaster.setFromCamera(_aimReticleNdc, camera);
        const rayOrigin = _aimRaycaster.ray.origin;
        const rayDir = _aimRaycaster.ray.direction;

        // 1. Find nearest blocking arena bunker along the 3D reticle ray
        let nearestObsRayT = Infinity;
        for (let oi = 0; oi < g.obstacles.length; oi++) {
          const obs = g.obstacles[oi];
          const ocX = obs.x - rayOrigin.x;
          const ocZ = obs.z - rayOrigin.z;
          const horizLenSq = rayDir.x * rayDir.x + rayDir.z * rayDir.z;
          if (horizLenSq < 0.0001) continue;
          const projT = (ocX * rayDir.x + ocZ * rayDir.z) / horizLenSq;
          if (projT <= 2.0 || projT >= 56) continue;
          const rayYAtT = rayOrigin.y + rayDir.y * projT;
          if (rayYAtT > obs.h + 0.12 || rayYAtT < -0.2) continue;
          const perpX = rayOrigin.x + rayDir.x * projT - obs.x;
          const perpZ = rayOrigin.z + rayDir.z * projT - obs.z;
          if (perpX * perpX + perpZ * perpZ <= (obs.r + 0.15) * (obs.r + 0.15)) {
            if (projT < nearestObsRayT) nearestObsRayT = projT;
          }
        }

        // 2. Check if the 3D reticle ray intersects an enemy player's stance-adjusted 3D hitbox!
        const aimAssistRadius = THREE.MathUtils.clamp(
          1.45 + ((snapState.aimSensitivity || 1.0) - 1.0) * 0.22,
          1.25,
          1.95
        );
        let lockedEnemyT = Infinity;
        let lockedAimX = 0;
        let lockedAimY = 1.38;
        let lockedAimZ = 0;
        g.remotePlayers.forEach(entry => {
          if (
            snapState.matchMode === 'teams' &&
            entry.data.team === snapState.myTeam &&
            entry.data.team !== 'solo'
          ) {
            return;
          }
          const rx = entry.mesh.position.x;
          const ry = entry.mesh.position.y || 0;
          const rz = entry.mesh.position.z;
          const enemyH = getStanceHitHeight(entry.data.stance);
          const toEnemyX = rx - rayOrigin.x;
          const toEnemyZ = rz - rayOrigin.z;
          const horizLenSq = rayDir.x * rayDir.x + rayDir.z * rayDir.z;
          if (horizLenSq < 0.0001) return;
          const projT = (toEnemyX * rayDir.x + toEnemyZ * rayDir.z) / horizLenSq;
          if (projT <= 1.8 || projT >= nearestObsRayT || projT >= 56) return;
          const rayYAtT = rayOrigin.y + rayDir.y * projT;
          if (rayYAtT < ry - 0.25 || rayYAtT > ry + enemyH + 0.2) return;
          const perpX = rayOrigin.x + rayDir.x * projT - rx;
          const perpZ = rayOrigin.z + rayDir.z * projT - rz;
          if (perpX * perpX + perpZ * perpZ <= aimAssistRadius * aimAssistRadius && projT < lockedEnemyT) {
            lockedEnemyT = projT;
            lockedAimX = rx;
            lockedAimY = THREE.MathUtils.clamp(rayYAtT, ry + 0.42, ry + enemyH - 0.25);
            lockedAimZ = rz;
          }
        });

        const hasTargetLock = lockedEnemyT < Infinity;
        if (hasTargetLock !== isEnemyTargetedRef.current) {
          isEnemyTargetedRef.current = hasTargetLock;
          setIsEnemyTargeted(hasTargetLock);
          if (hasTargetLock && snapState.role === 'player' && snapState.screen === 'game') {
            sfx.playTargetLock();
          }
        }

        // 3. True 3D Target Point Resolution (Enemy 3D Hitbox -> Bunker Surface -> Ground Turf -> 3D Sky/Horizon Ray!)
        if (hasTargetLock) {
          g.aimWorldX = lockedAimX;
          g.aimWorldY = lockedAimY;
          g.aimWorldZ = lockedAimZ;
        } else if (nearestObsRayT < 54) {
          g.aimWorldX = rayOrigin.x + rayDir.x * nearestObsRayT;
          g.aimWorldY = Math.max(0.12, rayOrigin.y + rayDir.y * nearestObsRayT);
          g.aimWorldZ = rayOrigin.z + rayDir.z * nearestObsRayT;
        } else if (
          rayDir.y < -0.025 &&
          _aimRaycaster.ray.intersectPlane(_groundPlane, _aimPlaneHit) &&
          Math.hypot(_aimPlaneHit.x - rayOrigin.x, _aimPlaneHit.z - rayOrigin.z) < 48
        ) {
          g.aimWorldX = _aimPlaneHit.x;
          g.aimWorldY = 0.14;
          g.aimWorldZ = _aimPlaneHit.z;
        } else {
          const rayTargetDist = 34;
          g.aimWorldX = rayOrigin.x + rayDir.x * rayTargetDist;
          g.aimWorldY = THREE.MathUtils.clamp(rayOrigin.y + rayDir.y * rayTargetDist, 0.14, 12.0);
          g.aimWorldZ = rayOrigin.z + rayDir.z * rayTargetDist;
        }

        // Smoothly align Hamster hero toward 3D Aim Point & pitch gun/head vertically!
        const desiredBodyYaw = Math.atan2(g.aimWorldX - g.x, g.aimWorldZ - g.z);
        const yawDelta = shortestAngleDelta(g.rotY, desiredBodyYaw);
        g.rotY += yawDelta * Math.min(1, dt * 20);

        g.localHamster.position.set(g.x, g.y, g.z);
        g.localHamster.rotation.y = g.rotY;

        const aimHorizDist = Math.max(3.5, Math.hypot(g.aimWorldX - g.x, g.aimWorldZ - g.z));
        const shoulderY =
          g.y + (activeStance === 'crawl' ? 0.58 : activeStance === 'crouch' ? 0.92 : 1.32);
        const computedAimPitch = -Math.atan2((g.aimWorldY ?? 1.38) - shoulderY, aimHorizDist);

        const ud = g.localHamster.userData;
        if (ud && ud.nameSprite) {
          ud.nameSprite.visible = false;
        }
        if (ud && ud.markerGroup) {
          ud.markerGroup.rotation.y = -Math.atan2(0.82 * HAMSTER_HERO_SCALE, aimHorizDist);
        }

        g.walkPhase = animateHamsterRig(
          g.localHamster,
          isMoving,
          g.walkPhase,
          dt,
          snapState.holdingCanType,
          true,
          activeStance,
          g.y,
          computedAimPitch
        );

        // Update 3D 10-Second Respawn Immunity Forcefield Shield on Local Hamster
        if (ud && ud.immunityShieldGroup) {
          const isLocalImmune = serverNowMs < snapState.immuneUntil;
          ud.immunityShieldGroup.visible = isLocalImmune;
          if (isLocalImmune) {
            ud.immunityShieldGroup.rotation.y += dt * 3.4;
            const pulse = 1 + Math.sin(now * 0.012) * 0.06;
            ud.immunityShieldGroup.scale.setScalar(pulse);
            if (ud.immunityRing1) ud.immunityRing1.rotation.z += dt * 4.2;
            if (ud.immunityRing2) ud.immunityRing2.rotation.z -= dt * 3.8;
          }
        }

        if (g.aimReticle) g.aimReticle.visible = false;
        if (g.aimLaserLine) g.aimLaserLine.visible = false;

        if (
          !snapState.isAnyModalOpen &&
          (snapState.screen === 'game' ||
            (snapState.role === 'host' && snapState.screen === 'lobby')) &&
          (g.shootButtonHeld || g.mouseDown)
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

        if (Math.random() < 0.35 && g.particles.length < 120) {
          const trailDrop = new THREE.Mesh(
            sharedTrailSphereGeom,
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

        // Check Hits on Remote Players (Stance- & Jump-Aware 3D Hitbox!)
        if (!hit && p.ownerId === clientIdRef.current) {
          g.remotePlayers.forEach(entry => {
            if (hit) return;
            if (
              snapState.matchMode === 'teams' &&
              entry.data.team === snapState.myTeam &&
              entry.data.team !== 'solo'
            ) {
              return;
            }
            const rx = entry.mesh.position.x;
            const ry = entry.mesh.position.y || 0;
            const rz = entry.mesh.position.z;
            const hitMaxH = getStanceHitHeight(entry.data.stance);
            if (
              p.mesh.position.y >= ry - 0.2 &&
              p.mesh.position.y <= ry + hitMaxH &&
              Math.hypot(p.mesh.position.x - rx, p.mesh.position.z - rz) < 1.98
            ) {
              hit = true;
              if (
                typeof entry.data.immuneUntil === 'number' &&
                serverNowMs < entry.data.immuneUntil
              ) {
                sfx.playDamageHit();
                const remSec = Math.max(
                  1,
                  Math.ceil((entry.data.immuneUntil - serverNowMs) / 1000)
                );
                setPickupBannerText(
                  `🛡️ ${entry.data.name.toUpperCase()} HAS RESPAWN IMMUNITY (${remSec}s LEFT)!`
                );
                setTimeout(() => setPickupBannerText(null), 1500);
                return;
              }
              sfx.playSplat();
              spawnPaintSplatEffect(
                scene,
                g.splatDecals,
                g.particles,
                rx,
                ry + hitMaxH * 0.45,
                rz,
                p.color
              );
              spawnCombatHitFeedback(
                rx,
                ry + hitMaxH * 0.78,
                rz,
                p.damage,
                (entry.data.shield ?? 0) > 0,
                entry.data.name || 'Opponent'
              );
              const hitPts = 20 + Math.min(15, snapState.koStreak * 5);
              setHitsLanded(h => h + 1);
              awardPoints(hitPts, `🎯 PAINT HIT!`, '#38bdf8');
              const hitId = `hit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
              queueCombatEvent({
                id: hitId,
                type: 'hit',
                ownerId: clientIdRef.current,
                ownerName: snapState.playerName || 'Student',
                targetId: entry.data.id,
                attackerId: clientIdRef.current,
                attackerName: snapState.playerName || 'Student',
                damage: p.damage,
                ts: serverNowMs
              });
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
                syncPaintballPlayerApi(roomCode, {
                  id: clientIdRef.current,
                  lastHit: lastHitObj,
                  recentEvents: recentCombatEventsRef.current
                });
                setDoc(
                  getPlayerDocRef(roomCode, clientIdRef.current),
                  {
                    lastHit: lastHitObj,
                    recentEvents: recentCombatEventsRef.current
                  },
                  { merge: true }
                ).catch(() => {});
              }
            }
          });
        }

        // Check Hits on Local Student Player (Stance- & Jump-Aware 3D Hitbox!)
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
          const localHitMaxH = getStanceHitHeight(snapState.playerStance);
          if (
            !isFriendly &&
            p.mesh.position.y >= g.y - 0.2 &&
            p.mesh.position.y <= g.y + localHitMaxH &&
            Math.hypot(p.mesh.position.x - g.x, p.mesh.position.z - g.z) < 1.9
          ) {
            hit = true;
            if (serverNowMs < snapState.immuneUntil) {
              sfx.playDamageHit();
            } else {
              spawnPaintSplatEffect(
                scene,
                g.splatDecals,
                g.particles,
                g.x,
                g.y + localHitMaxH * 0.45,
                g.z,
                p.color
              );
              applyIncomingDamage(p.damage, p.ownerName || 'Opponent', p.ownerId);
            }
          }
        }

        // Ground Turf Impact
        if (!hit && p.mesh.position.y <= 0.12) {
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

      // Update Expanding 3D Shockwave Rings
      for (let i = g.shockwaves.length - 1; i >= 0; i--) {
        const sw = g.shockwaves[i];
        sw.life += dt;
        const t = Math.min(1, sw.life / sw.maxLife);
        const eased = 1 - Math.pow(1 - t, 3);
        sw.mesh.scale.setScalar(sw.startScale + (sw.endScale - sw.startScale) * eased);
        sw.mat.opacity = Math.max(0, (1 - t) * 0.85);
        if (sw.life >= sw.maxLife) {
          scene.remove(sw.mesh);
          sw.mat.dispose();
          g.shockwaves.splice(i, 1);
        }
      }

      // Guarantee All Remote Players in `mergedPlayersMapRef` and `roomPlayers` are Always Visible & Up-to-Date in the 3D Arena!
      mergedPlayersMapRef.current.forEach(({ state: rp }) => {
        if (rp.id !== clientIdRef.current && rp.role === 'player' && !rp.kicked) {
          upsertRemotePlayer(rp);
        }
      });
      snapState.roomPlayers.forEach(rp => {
        if (rp.id !== clientIdRef.current && rp.role === 'player' && !rp.kicked) {
          upsertRemotePlayer(rp);
        }
      });

      // Smooth Dead-Reckoned Interpolation, Jump Elevation, Stance Animation & Live Overhead Bars for Remote Hamsters
      const localRecvClock = Date.now();
      g.remotePlayers.forEach(entry => {
        const ageSec = entry.lastLocalRecvAt
          ? Math.min(0.16, Math.max(0, (localRecvClock - entry.lastLocalRecvAt) / 1000))
          : 0;
        const rvx = typeof entry.data.vx === 'number' ? entry.data.vx : 0;
        const rvz = typeof entry.data.vz === 'number' ? entry.data.vz : 0;
        const predX = THREE.MathUtils.clamp(
          entry.data.x + rvx * ageSec,
          -(ARENA_HALF_W - 0.8),
          ARENA_HALF_W - 0.8
        );
        const predZ = THREE.MathUtils.clamp(
          entry.data.z + rvz * ageSec,
          -(ARENA_HALF_D - 0.8),
          ARENA_HALF_D - 0.8
        );
        const targetRemoteY = Math.max(0, typeof entry.data.y === 'number' ? entry.data.y : 0);
        const dx = predX - entry.mesh.position.x;
        const dy = targetRemoteY - entry.mesh.position.y;
        const dz = predZ - entry.mesh.position.z;
        const dist = Math.hypot(dx, dz);
        const blend = Math.min(1, dt * 13);
        entry.mesh.position.x += dx * blend;
        entry.mesh.position.y += dy * Math.min(1, dt * 15);
        entry.mesh.position.z += dz * blend;

        const deltaYaw = shortestAngleDelta(entry.mesh.rotation.y, entry.data.rotY || 0);
        entry.mesh.rotation.y += deltaYaw * Math.min(1, dt * 15);

        const rUd = entry.mesh.userData;
        if (rUd) {
          const isRemoteImmune =
            typeof entry.data.immuneUntil === 'number' && serverNowMs < entry.data.immuneUntil;
          if (rUd.immunityShieldGroup) {
            rUd.immunityShieldGroup.visible = isRemoteImmune;
            if (isRemoteImmune) {
              rUd.immunityShieldGroup.rotation.y += dt * 3.4;
              const pulse = 1 + Math.sin(now * 0.012) * 0.06;
              rUd.immunityShieldGroup.scale.setScalar(pulse);
              if (rUd.immunityRing1) rUd.immunityRing1.rotation.z += dt * 4.2;
              if (rUd.immunityRing2) rUd.immunityRing2.rotation.z -= dt * 3.8;
            }
          }
          if (rUd.nameSprite) {
            const plateLabel =
              entry.data.team && entry.data.team !== 'solo'
                ? `[${entry.data.team.toUpperCase()}] ${entry.data.name}`
                : entry.data.name;
            updatePlayerOverheadPlate(
              rUd.nameSprite as THREE.Sprite,
              plateLabel,
              entry.data.team || 'solo',
              typeof entry.data.hp === 'number' ? entry.data.hp : 100,
              typeof entry.data.shield === 'number' ? entry.data.shield : 100,
              isRemoteImmune
            );
          }
        }
        const isRemoteMoving = dist > 0.06 || Math.hypot(rvx, rvz) > 0.6;
        entry.walkPhase = animateHamsterRig(
          entry.mesh,
          isRemoteMoving,
          entry.walkPhase,
          dt,
          null,
          false,
          entry.data.stance || 'stand',
          entry.mesh.position.y,
          0
        );
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
      window.removeEventListener('contextmenu', handleCanvasContextMenu);
      window.removeEventListener('blur', handleWindowBlurOrHide);
      document.removeEventListener('visibilitychange', handleWindowBlurOrHide);
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
      activeTeam,
      false
    );
    updatedHamster.position.set(g.x, g.y, g.z);
    updatedHamster.rotation.y = g.rotY;
    updatedHamster.visible = !(isHostRole && screen === 'game');
    g.scene.add(updatedHamster);
    g.localHamster = updatedHamster;

    if (g.aimReticle) {
      g.aimReticle.visible = false;
    }
    if (g.aimLaserLine) {
      g.aimLaserLine.visible = false;
    }
  }, [selectedSkinIdx, myTeam, matchMode, role, screen]);

  // -------------------------------------------------------------
  // 7. FIRE PAINTBALL DIRECTLY OUT OF THE 3D GUN BARREL MUZZLE TOWARD PUBG 3D CROSSHAIR TARGET
  // -------------------------------------------------------------
  const fireShot = () => {
    const g = gameRef.current;
    const snap = stateSnapRef.current;
    if (!g || snap.role !== 'player' || snap.screen !== 'game') return;
    const now = performance.now();
    if (now - g.lastShotTime < 185) return;

    const isPlayingMatch = snap.matchStatus === 'playing';

    if (isPlayingMatch) {
      if (snap.ammo <= 0) {
        g.shootButtonHeld = false;
        g.mouseDown = false;
        g.lastShotTime = now;
        sfx.playWrong();
        setPickupBannerText(
          `🎯 OUT OF PAINTBALLS! CLICK THE "QUESTIONS" BUTTON BELOW TO EARN +${snap.ballsPerQuestion || 10} BALLS!`
        );
        setTimeout(() => setPickupBannerText(null), 2400);
        return;
      }
      setAmmo(a => Math.max(0, a - 1));
    }

    g.lastShotTime = now;
    g.camKick = snap.isAdsScoped ? 0.32 : 0.55;
    g.recoilBloom = Math.min(20, g.recoilBloom + (snap.isAdsScoped ? 2.8 : 5.8));
    // Subtle authentic PUBG vertical recoil kick
    g.camPitch = THREE.MathUtils.clamp(
      g.camPitch - (snap.isAdsScoped ? 0.006 : 0.011),
      -0.44,
      0.52
    );
    sfx.playMarkerShot();

    // Enforce: Red Team ALWAYS fires Red Paint (0xef4444) and Blue Team ALWAYS fires Blue Paint (0x2563eb)!
    const activeTeam: TeamId =
      snap.matchMode === 'solo'
        ? 'solo'
        : snap.myTeam === 'blue'
        ? 'blue'
        : 'red';
    const teamPaint = resolveTeamPaintColor(activeTeam, undefined, snap.selectedSkinIdx);

    // 1. Align Hamster Body Directly Toward 3D Target Aim Point & Pitch Gun Barrel to Target Elevation!
    const dx = g.aimWorldX - g.x;
    const dz = g.aimWorldZ - g.z;
    const aimDist = Math.hypot(dx, dz);
    const bodyAngle = aimDist > 0.4 ? Math.atan2(dx, dz) : g.camYaw;
    g.rotY = bodyAngle;
    g.localHamster.position.set(g.x, g.y, g.z);
    g.localHamster.rotation.y = bodyAngle;

    const stanceGunBaseY =
      snap.playerStance === 'crawl' ? 0.58 : snap.playerStance === 'crouch' ? 0.92 : 1.38;
    const targetY = typeof g.aimWorldY === 'number' ? g.aimWorldY : stanceGunBaseY + g.y;
    const gunPitch = -Math.atan2(targetY - (g.y + stanceGunBaseY), Math.max(3.5, aimDist));

    // 2. Compute Exact 3D World Position of the Gun Barrel Tip (`muzzleTip`) BEFORE applying kickback!
    const muzzleWorldPos = new THREE.Vector3(
      g.x + Math.sin(bodyAngle) * 1.65,
      g.y + stanceGunBaseY,
      g.z + Math.cos(bodyAngle) * 1.65
    );
    const ud = g.localHamster.userData;
    if (ud) {
      if (ud.markerGroup) {
        ud.markerGroup.rotation.x = THREE.MathUtils.clamp(gunPitch, -0.58, 0.58);
        ud.markerGroup.rotation.y = -Math.atan2(0.82 * HAMSTER_HERO_SCALE, Math.max(4.5, aimDist));
      }
      g.localHamster.updateMatrixWorld(true);
      if (ud.muzzleTip) {
        ud.muzzleTip.getWorldPosition(muzzleWorldPos);
      }
      ud.recoil = 1.0;
    }

    // 3. Calculate Crisp 3D Ballistic Trajectory + Stance/ADS Precision Spread!
    const targetDx = g.aimWorldX - muzzleWorldPos.x;
    const targetDz = g.aimWorldZ - muzzleWorldPos.z;
    const targetDist = Math.hypot(targetDx, targetDz);
    const baseAngle = targetDist > 0.6 ? Math.atan2(targetDx, targetDz) : bodyAngle;
    const spreadRad = snap.isAdsScoped
      ? 0.002
      : snap.playerStance === 'crawl'
      ? 0.004
      : snap.playerStance === 'crouch'
      ? 0.008
      : g.y > 0.1
      ? 0.024
      : 0.013;
    const shotAngle = baseAngle + (Math.random() - 0.5) * spreadRad;
    const hSpeed = snap.isAdsScoped ? 64 : 58;
    const gravity = 1.85;
    const flightTime = Math.max(0.035, Math.min(0.9, targetDist / hSpeed));
    const computedVy = THREE.MathUtils.clamp(
      (targetY - muzzleWorldPos.y + 0.5 * gravity * flightTime * flightTime) / flightTime,
      -22.0,
      22.0
    );

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
      vx: Math.sin(shotAngle) * hSpeed,
      vy: computedVy,
      vz: Math.cos(shotAngle) * hSpeed,
      gravity,
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
      queueCombatEvent({
        id: shotId,
        type: 'shot',
        ownerId: clientIdRef.current,
        ownerName: snap.playerName || 'Student',
        ownerTeam: activeTeam,
        x: lastShotObj.x,
        z: lastShotObj.z,
        angle: lastShotObj.angle,
        paintColor: teamPaint,
        ts: getServerNow()
      });
      syncPaintballPlayerApi(roomCode, {
        id: clientIdRef.current,
        lastShot: lastShotObj,
        recentEvents: recentCombatEventsRef.current
      });
      setDoc(
        getPlayerDocRef(roomCode, clientIdRef.current),
        {
          lastShot: lastShotObj,
          recentEvents: recentCombatEventsRef.current
        },
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

  // Teacher Host Action: Start Match & Place All Red Players in Top-Middle Red Spawn (0, -24) and Blue Players in Bottom-Middle Blue Spawn (0, +24)
  const handleStartMultiplayerMatch = () => {
    const startTs = getServerNow();
    lastStartedAtRef.current = startTs;
    sfx.playKO();
    sfx.startMusic();
    setMatchStatus('playing');
    setIsTimerPaused(false);
    setMatchSeconds(configuredDurationSec);
    setHostCameraMode('auto_track');
    setHostFollowIndex(0);
    setScreen('game');

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
        vx: 0,
        vz: 0,
        rotY: sp.rotY,
        hp: 100,
        shield: 100,
        score: 0,
        kos: 0,
        hitsLanded: 0,
        bestStreak: 0,
        questionsAnswered: 0,
        questionsCorrect: 0,
        questionsWrong: 0,
        immuneUntil: 0,
        immuneRemainingMs: 0,
        seq: 0,
        matchEpoch: startTs,
        lastStartedAt: startTs,
        updatedAt: startTs
      };
      mergedPlayersMapRef.current.set(p.id, {
        state: nextP,
        lastSeenLocalAt: Date.now()
      });
      if (roomCode) {
        const playerResetPatch = {
          team: assignedTeam,
          x: sp.x,
          z: sp.z,
          vx: 0,
          vz: 0,
          rotY: sp.rotY,
          hp: 100,
          shield: 100,
          score: 0,
          kos: 0,
          hitsLanded: 0,
          bestStreak: 0,
          questionsAnswered: 0,
          questionsCorrect: 0,
          questionsWrong: 0,
          immuneUntil: 0,
          immuneRemainingMs: 0,
          seq: 0,
          matchEpoch: startTs,
          lastStartedAt: startTs,
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
      text: `🚀 Match Started! Red & Blue Squads deployed (${ballsPerQuestion} Balls/Question)!`,
      color: '#10b981',
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
        matchEpoch: startTs,
        hostApiOrigin: currentOrigin,
        joinUrl: liveJoinUrl,
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
        stripUndefinedFields(startRoomPayload),
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
        updatedAt: getServerNow()
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
          timerSyncedAt: getServerNow(),
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
          timerSyncedAt: getServerNow(),
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
    matchEndedEpochRef.current = Math.max(
      matchEndedEpochRef.current,
      lastStartedAtRef.current || getServerNow()
    );
    sfx.playKO();
    setIsQuestionModalOpen(false);
    setMatchStatus('results');
    setScreen('results');
    const bcChannel = broadcastChannelRef.current || gameRef.current?.broadcastChannel;
    if (bcChannel) {
      try {
        bcChannel.postMessage({
          type: 'match_end',
          id: clientIdRef.current
        });
      } catch {}
    }
    if (roomCode) {
      const endPatch = { matchStatus: 'results', endedAt: getServerNow() };
      syncPaintballRoomApi(roomCode, endPatch);
      setDoc(
        getRoomDocRef(roomCode),
        endPatch,
        { merge: true }
      ).catch(() => {});
    }
  };

  // Trivia Answer Handler (Only allowed once match has started -> `matchStatus === 'playing'`)
  const handleTriviaAnswer = (optIdx: number) => {
    if (matchStatus !== 'playing' || triviaFeedback !== null) return;
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
      setQuestionsCorrect(c => c + 1);
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
        `✅ CORRECT! +${earnedBalls} Paintballs (${bonusBreakdown.join(' • ')})!`
      );

      const evText = `🎯 ${playerName} answered correctly in ${QUESTION_TIME_LIMIT_SEC - questionTimeLeft}s (+${earnedBalls} Balls • ${nextStreak}x Streak)!`;
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
      setQuestionsWrong(w => w + 1);
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

  // Stabilized Standings List (Merges authoritative local student stats & sorts deterministically so Winner Podium never glitches!)
  const finalStandings = React.useMemo(() => {
    const byId = new Map<string, PlayerNetworkState>();
    roomPlayers.forEach(p => {
      if (p && p.id && !p.kicked) {
        byId.set(p.id, p);
      }
    });

    if (role === 'player' && hasJoinedRoomRef.current) {
      const existing = byId.get(clientIdRef.current);
      const localTeam: TeamId =
        matchMode === 'solo' ? 'solo' : myTeam === 'blue' ? 'blue' : 'red';
      const mergedLocal: PlayerNetworkState = {
        id: clientIdRef.current,
        name: playerName || existing?.name || 'Student',
        role: 'player',
        team: localTeam,
        skinIdx: selectedSkinIdx,
        x: existing?.x ?? 0,
        z: existing?.z ?? 0,
        rotY: existing?.rotY ?? 0,
        hp,
        shield,
        score: Math.max(score, existing?.score || 0),
        kos: Math.max(kos, existing?.kos || 0),
        hitsLanded: Math.max(hitsLanded, existing?.hitsLanded || 0),
        bestStreak: Math.max(bestStreak, existing?.bestStreak || 0),
        questionsAnswered: Math.max(questionsAnswered, existing?.questionsAnswered || 0),
        questionsCorrect: Math.max(questionsCorrect, existing?.questionsCorrect || 0),
        questionsWrong: Math.max(questionsWrong, existing?.questionsWrong || 0),
        updatedAt: existing?.updatedAt || Date.now()
      };
      byId.set(clientIdRef.current, mergedLocal);
    }

    const list = Array.from(byId.values());
    list.sort((a, b) => {
      const koDiff = (b.kos || 0) - (a.kos || 0);
      if (koDiff !== 0) return koDiff;
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      const correctDiff =
        (b.questionsCorrect ?? b.questionsAnswered ?? 0) -
        (a.questionsCorrect ?? a.questionsAnswered ?? 0);
      if (correctDiff !== 0) return correctDiff;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [
    roomPlayers,
    role,
    matchMode,
    myTeam,
    playerName,
    selectedSkinIdx,
    hp,
    shield,
    score,
    kos,
    hitsLanded,
    bestStreak,
    questionsAnswered,
    questionsCorrect,
    questionsWrong
  ]);

  // Compute Team Scores & Team Question Accuracy from `finalStandings`
  const teamTotals = React.useMemo(() => {
    const totals: Record<
      TeamId,
      {
        score: number;
        kos: number;
        count: number;
        correct: number;
        wrong: number;
        accuracy: number;
      }
    > = {
      solo: { score: 0, kos: 0, count: 0, correct: 0, wrong: 0, accuracy: 0 },
      red: { score: 0, kos: 0, count: 0, correct: 0, wrong: 0, accuracy: 0 },
      blue: { score: 0, kos: 0, count: 0, correct: 0, wrong: 0, accuracy: 0 },
      green: { score: 0, kos: 0, count: 0, correct: 0, wrong: 0, accuracy: 0 },
      gold: { score: 0, kos: 0, count: 0, correct: 0, wrong: 0, accuracy: 0 }
    };
    finalStandings.forEach(p => {
      const t = p.team || 'red';
      if (totals[t]) {
        const qStats = getPlayerQuestionStats(p);
        totals[t].score += p.score || 0;
        totals[t].kos += p.kos || 0;
        totals[t].count += 1;
        totals[t].correct += qStats.correct;
        totals[t].wrong += qStats.wrong;
      }
    });
    (Object.keys(totals) as TeamId[]).forEach(t => {
      const totQ = totals[t].correct + totals[t].wrong;
      totals[t].accuracy = totQ > 0 ? Math.round((totals[t].correct / totQ) * 100) : 0;
    });
    return totals;
  }, [finalStandings]);

  // Compute Overall Class Question Accuracy Analytics Summary
  const classAccuracySummary = React.useMemo(() => {
    let totalCorrect = 0;
    let totalWrong = 0;
    finalStandings.forEach(p => {
      const qStats = getPlayerQuestionStats(p);
      totalCorrect += qStats.correct;
      totalWrong += qStats.wrong;
    });
    const totalQuestions = totalCorrect + totalWrong;
    const avgAccuracy =
      totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
    return { totalQuestions, totalCorrect, totalWrong, avgAccuracy };
  }, [finalStandings]);

  // Compute Post-Match MVP Awards (Top Killer, Best Accuracy, Best Streak)
  const mvpAwards = React.useMemo(() => {
    if (finalStandings.length === 0) {
      return { topKiller: null, bestAccuracy: null, bestStreak: null };
    }

    let topKiller: PlayerNetworkState | null = null;
    let bestAccuracy: {
      player: PlayerNetworkState;
      accuracy: number;
      correct: number;
      wrong: number;
    } | null = null;
    let bestStreak: PlayerNetworkState | null = null;

    finalStandings.forEach(p => {
      const kills = p.kos || 0;
      if (kills > 0 && (!topKiller || kills > (topKiller.kos || 0))) {
        topKiller = p;
      }

      const qStats = getPlayerQuestionStats(p);
      if (qStats.total > 0) {
        if (
          !bestAccuracy ||
          qStats.accuracy > bestAccuracy.accuracy ||
          (qStats.accuracy === bestAccuracy.accuracy && qStats.correct > bestAccuracy.correct)
        ) {
          bestAccuracy = {
            player: p,
            accuracy: qStats.accuracy,
            correct: qStats.correct,
            wrong: qStats.wrong
          };
        }
      }

      const streak = p.bestStreak || 0;
      if (streak > 0 && (!bestStreak || streak > (bestStreak.bestStreak || 0))) {
        bestStreak = p;
      }
    });

    return { topKiller, bestAccuracy, bestStreak };
  }, [finalStandings]);

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
    const deadzonePx = 6;
    const dx = clientX - joystickOriginRef.current.x;
    const dy = clientY - joystickOriginRef.current.y;
    const rawDist = Math.hypot(dx, dy);
    if (rawDist < deadzonePx) {
      setJoystickVec({ x: 0, y: 0 });
      if (gameRef.current) {
        gameRef.current.joyX = 0;
        gameRef.current.joyZ = 0;
      }
      return;
    }
    const clampedDist = Math.min(maxRadius, rawDist);
    const normMag = (clampedDist - deadzonePx) / (maxRadius - deadzonePx);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * normMag;
    const ny = Math.sin(angle) * normMag;
    setJoystickVec({ x: nx, y: ny });
    if (gameRef.current) {
      gameRef.current.joyX = nx;
      gameRef.current.joyZ = ny;
    }
  };

  // =============================================================
  // RENDER INTERFACE — BRIGHT PLAYFUL ESL GAME STUDIO ARCADE UI
  // =============================================================
  const selectedHeroSkin = HAMSTER_SKINS[selectedSkinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
  const podiumPlayers = finalStandings.slice(0, 3);

  return (
    <div
      id="paintball-game-container"
      className="fixed inset-0 z-[60] w-full h-full max-w-full max-h-full xl:relative xl:inset-auto xl:z-auto xl:w-full xl:h-full flex-1 min-h-0 bg-sky-200 overflow-hidden font-sans select-none text-slate-900 touch-manipulation"
    >
      {/* 3D WebGL Canvas Layer (Isolated container, zero backdrop-filter overlays above it) */}
      <div
        ref={canvasContainerRef}
        className={`absolute inset-0 w-full h-full z-0 touch-none ${
          role === 'player' &&
          screen === 'game' &&
          !isAnyModalOpen &&
          !isTouchHudVisible &&
          aimControlMode === 'shoulder' &&
          isAimLocked
            ? 'cursor-none'
            : role === 'player' && screen === 'game' && !isAnyModalOpen
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
      />

      {/* -------------------------------------------------------------
          TOP ARCADE NAVIGATION HEADER (CLEAN, BRIGHT, NON-OVERLAPPING)
         ------------------------------------------------------------- */}
      <div className="absolute top-2 inset-x-2.5 sm:inset-x-4 z-30 flex items-center justify-between pointer-events-none gap-2 flex-nowrap">
        <button
          type="button"
          onClick={() => {
            if (role === 'player' && roomCode) {
              hasJoinedRoomRef.current = false;
              deletePaintballPlayerApi(roomCode, clientIdRef.current);
              deleteDoc(getPlayerDocRef(roomCode, clientIdRef.current)).catch(() => {});
            }
            onViewChange('games');
          }}
          className="pointer-events-auto shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-800 font-extrabold text-xs border-2 border-sky-200 border-b-4 border-b-sky-300 shadow-md transition active:translate-y-0.5 cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft size={14} className="text-sky-600" />
          <span>Back</span>
        </button>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 flex-nowrap justify-end min-w-0">
          {role === 'player' && screen === 'game' && (
            <>
              <button
                type="button"
                onClick={cycleCameraViewPreset}
                className="shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-800 border-2 border-sky-200 border-b-4 border-b-sky-300 flex items-center gap-1.5 transition shadow-md active:translate-y-0.5 cursor-pointer text-xs font-extrabold whitespace-nowrap"
                title="Switch Camera View Distance (Shortcut: V)"
              >
                <Video size={14} className="text-sky-600" />
                <span>
                  Cam:{' '}
                  {cameraViewPreset === 'close'
                    ? 'Close'
                    : cameraViewPreset === 'balanced'
                    ? 'Balanced'
                    : cameraViewPreset === 'far'
                    ? 'Far'
                    : 'Tactical'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAimControlMode(prev => (prev === 'shoulder' ? 'separate' : 'shoulder'));
                  sfx.playCameraSwitch();
                }}
                className={`hidden sm:flex shrink-0 px-2.5 py-1.5 rounded-xl border-2 border-b-4 items-center gap-1.5 transition shadow-md active:translate-y-0.5 cursor-pointer text-xs font-extrabold whitespace-nowrap ${
                  aimControlMode === 'separate'
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-600 border-b-emerald-700'
                    : 'bg-white hover:bg-sky-50 text-slate-800 border-sky-200 border-b-sky-300'
                }`}
                title="Toggle PUBG TPS Free-Look Aim vs Separate Free-Cursor Aim"
              >
                <Crosshair
                  size={14}
                  className={aimControlMode === 'separate' ? 'text-white' : 'text-emerald-600'}
                />
                <span>{aimControlMode === 'separate' ? 'Aim: Free Cursor' : 'Aim: PUBG TPS'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 border-2 border-amber-500 border-b-4 border-b-amber-600 flex items-center gap-1.5 transition shadow-md active:translate-y-0.5 cursor-pointer text-xs font-extrabold whitespace-nowrap"
            title="Camera, Aim & Audio Settings"
          >
            <Settings size={14} className="text-slate-900" />
            <span>Settings</span>
          </button>

          <FullscreenButton
            targetId="paintball-game-container"
            showLabel
            className="shrink-0 bg-white hover:bg-sky-50 text-slate-800 border-2 border-sky-200 border-b-4 border-b-sky-300 shadow-md text-xs font-extrabold px-3 py-1.5 rounded-xl"
          />
        </div>
      </div>

      {/* -------------------------------------------------------------
          GAME SETTINGS MODAL (BRIGHT ARCADE CARD)
         ------------------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border-2 border-sky-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[92dvh] overflow-y-auto p-4 sm:p-6 text-slate-900 relative space-y-3.5 my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders size={18} className="text-sky-600" />
                <h2 className="font-['Poppins',sans-serif] font-extrabold text-lg tracking-tight text-slate-900">
                  Camera, Aim &amp; Audio Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* 1. Camera View Distance Presets (Close / Balanced / Far / Tactical) */}
            <div className="bg-sky-50/90 rounded-2xl p-3.5 border border-sky-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Video size={14} className="text-sky-600" />
                  <span>Camera View Distance</span>
                </span>
                <span className="text-[11px] font-bold text-sky-700">Shortcut: V</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'close', label: 'Close', sub: 'Action' },
                    { id: 'balanced', label: 'Balanced', sub: 'Shoulder' },
                    { id: 'far', label: 'Far', sub: 'Wide' },
                    { id: 'tactical', label: 'Tactical', sub: 'High View' }
                  ] as const
                ).map(preset => {
                  const active = cameraViewPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCameraViewPreset(preset.id);
                        sfx.playCameraSwitch();
                      }}
                      className={`py-2 px-1.5 rounded-xl border transition cursor-pointer flex flex-col items-center justify-center whitespace-nowrap ${
                        active
                          ? 'bg-sky-600 text-white border-sky-700 border-b-2 shadow-sm'
                          : 'bg-white text-slate-700 border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      <span className="font-extrabold text-xs leading-tight">{preset.label}</span>
                      <span
                        className={`text-[9px] font-semibold mt-0.5 ${
                          active ? 'text-sky-100' : 'text-slate-500'
                        }`}
                      >
                        {preset.sub}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Aim Control Mode & Device HUD Layout (Laptop vs Touch Buttons) */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Crosshair size={14} className="text-emerald-600" />
                    <span>Aiming System</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAimControlMode('shoulder');
                      sfx.playCameraSwitch();
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      aimControlMode === 'shoulder'
                        ? 'bg-white border-sky-500 shadow-xs'
                        : 'bg-white/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs text-slate-900">PUBG TPS Aim</div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-snug">
                      360° free-look aim, dynamic recoil crosshair &amp; RMB 2x Scope zoom.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAimControlMode('separate');
                      sfx.playCameraSwitch();
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition cursor-pointer ${
                      aimControlMode === 'separate'
                        ? 'bg-white border-emerald-500 shadow-xs'
                        : 'bg-white/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-extrabold text-xs text-slate-900">Separate Cam &amp; Aim</div>
                    <div className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-snug">
                      Move cursor or tap anywhere on screen to aim; Right-drag orbits camera.
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-extrabold text-slate-800">
                    On-Screen Control HUD
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {isTouchHudVisible ? 'Showing Touch Controls' : 'Laptop Mode (Keys + Mouse)'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'auto', label: 'Auto Detect' },
                      { id: 'laptop', label: 'Laptop Keys' },
                      { id: 'touch', label: 'Touch Pad' }
                    ] as const
                  ).map(opt => {
                    const active = controlLayoutMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setControlLayoutMode(opt.id)}
                        className={`py-1.5 px-2 rounded-xl font-extrabold text-[11px] border transition cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Separate Camera Orbit & Aim Sensitivity Sliders */}
            <div className="bg-sky-50/70 rounded-2xl p-3.5 border border-sky-200 space-y-3">
              {/* Camera Sensitivity */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-extrabold text-slate-800">
                    Camera Rotation Sensitivity
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-xs text-sky-700">
                    {Math.round(cameraSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.05}
                  value={cameraSensitivity}
                  onChange={e => setCameraSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer h-2 bg-sky-200 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {[
                    { label: 'Steady', val: 0.6 },
                    { label: 'Normal', val: 1.0 },
                    { label: 'Fast', val: 1.5 },
                    { label: 'Pro', val: 2.0 }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setCameraSensitivity(p.val)}
                      className={`py-1 rounded-lg font-extrabold text-[11px] border transition cursor-pointer whitespace-nowrap ${
                        Math.abs(cameraSensitivity - p.val) < 0.06
                          ? 'bg-sky-600 text-white border-sky-700'
                          : 'bg-white text-slate-600 border-sky-200 hover:bg-sky-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aim Sensitivity */}
              <div className="pt-2.5 border-t border-sky-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-extrabold text-slate-800">
                    Aim &amp; Crosshair Sensitivity
                  </span>
                  <span className="font-mono tabular-nums font-extrabold text-xs text-emerald-700">
                    {Math.round(aimSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={2.5}
                  step={0.05}
                  value={aimSensitivity}
                  onChange={e => setAimSensitivity(parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-200 rounded-lg"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {[
                    { label: 'Precise', val: 0.65 },
                    { label: 'Balanced', val: 1.0 },
                    { label: 'Snappy', val: 1.45 },
                    { label: 'Ultra', val: 1.9 }
                  ].map(p => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setAimSensitivity(p.val)}
                      className={`py-1 rounded-lg font-extrabold text-[11px] border transition cursor-pointer whitespace-nowrap ${
                        Math.abs(aimSensitivity - p.val) < 0.06
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white text-slate-600 border-sky-200 hover:bg-emerald-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11px] text-slate-600 leading-snug pt-1">
                <b>Laptop Controls:</b> <b>WASD</b> Move · <b>Mouse</b> Aim · <b>Left-Click</b> Fire ·{' '}
                <b>Right-Click / Shift</b> 2x Scope · <b>Space</b> Jump · <b>C / Ctrl</b> Crouch ·{' '}
                <b>Z / X</b> Crawl · <b>E</b> Swap Shoulder · <b>Esc</b> Unlock Mouse.
              </p>
            </div>

            {/* 4. Audio Quick Toggles */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setMusicEnabled(!musicEnabled)}
                className={`py-2.5 px-3 rounded-xl font-extrabold text-xs border-2 flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap ${
                  musicEnabled
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
              >
                {musicEnabled ? <Volume2 size={15} className="text-emerald-600" /> : <VolumeX size={15} />}
                <span>{musicEnabled ? 'Music: On' : 'Music: Off'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`py-2.5 px-3 rounded-xl font-extrabold text-xs border-2 flex items-center justify-center gap-2 cursor-pointer transition whitespace-nowrap ${
                  soundEnabled
                    ? 'bg-sky-50 border-sky-400 text-sky-800'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
              >
                {soundEnabled ? <Volume2 size={15} className="text-sky-600" /> : <VolumeX size={15} />}
                <span>{soundEnabled ? 'Sound FX: On' : 'Sound FX: Off'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm border-b-4 border-sky-800 shadow-md transition active:translate-y-0.5 cursor-pointer"
            >
              Save &amp; Close
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 1: QUIZ EDITOR (GAME SETUP DESIGN)
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
          SCREEN 2: STUDENT JOIN & HERO CHARACTER CUSTOMIZER (MOBILE-FIRST ARCADE)
         ------------------------------------------------------------- */}
      {screen === 'join' && (
        <div className="absolute inset-0 z-40 w-full h-full bg-slate-900/40 flex items-center justify-center p-2 sm:p-4 pt-12 pb-2.5 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[640px] max-h-[90dvh] overflow-y-auto p-3.5 sm:p-5 flex flex-col border-2 border-sky-200 relative text-slate-900 my-auto">
            {/* Hero Spotlight Header + Live Room Status */}
            <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-100">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] font-extrabold text-sky-600 uppercase tracking-wider">
                  <span>Choose Your Champion</span>
                  {roomCode && (
                    <span className="text-slate-400 font-mono tabular-nums normal-case">
                      · Room {roomCode} ({roomPlayers.length} Online)
                    </span>
                  )}
                </div>
                <h1 className="font-['Poppins',sans-serif] font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 leading-tight mt-0.5">
                  {selectedHeroSkin.name}
                </h1>
                <div className="text-xs font-bold text-slate-500 mt-0.5">
                  {selectedHeroSkin.roleTitle} · Gear: {selectedHeroSkin.headgear}
                  {matchStatus === 'playing' && (
                    <span className="ml-2 text-emerald-600 font-extrabold">
                      · Match Live
                    </span>
                  )}
                </div>
              </div>

              <div
                className={`shrink-0 flex items-center justify-center p-2 rounded-2xl border-2 shadow-sm ${
                  matchMode === 'teams'
                    ? myTeam === 'blue'
                      ? 'bg-gradient-to-b from-sky-50 to-sky-100/90 border-sky-300'
                      : 'bg-gradient-to-b from-rose-50 to-rose-100/90 border-rose-300'
                    : 'bg-gradient-to-b from-emerald-50 to-emerald-100/90 border-emerald-300'
                }`}
              >
                <HamsterCharacterAvatar
                  skin={selectedHeroSkin}
                  size={68}
                  team={matchMode === 'teams' ? myTeam : 'solo'}
                />
              </div>
            </div>

            {/* All-Visible 12-Character Tactile Grid (4x3 Desktop, 3x4 Mobile — No Clipped Row) */}
            <div className="w-full bg-sky-50/75 rounded-2xl p-2 sm:p-2.5 mb-2.5 border border-sky-100">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[11px] font-extrabold text-slate-700">
                  12 Paintball Champions
                </span>
                <span className="text-[10px] font-bold text-sky-700">
                  Tap any hero to equip
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {HAMSTER_SKINS.map((skin, idx) => {
                  const isSelected = idx === selectedSkinIdx;
                  const activeBorderClass =
                    matchMode === 'teams'
                      ? myTeam === 'blue'
                        ? 'border-sky-600 bg-gradient-to-b from-white to-sky-50 ring-2 ring-sky-400/50 shadow-md -translate-y-0.5'
                        : 'border-rose-500 bg-gradient-to-b from-white to-rose-50 ring-2 ring-rose-400/50 shadow-md -translate-y-0.5'
                      : 'border-emerald-500 bg-gradient-to-b from-white to-emerald-50 ring-2 ring-emerald-400/50 shadow-md -translate-y-0.5';
                  const checkBgClass =
                    matchMode === 'teams'
                      ? myTeam === 'blue'
                        ? 'bg-sky-600'
                        : 'bg-rose-500'
                      : 'bg-emerald-500';
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      onClick={() => {
                        setSelectedSkinIdx(idx);
                        sfx.playCorrect();
                      }}
                      className={`py-1.5 px-1.5 rounded-xl border-2 flex flex-col items-center justify-center transition cursor-pointer relative ${
                        isSelected
                          ? activeBorderClass
                          : 'border-sky-100 bg-white hover:bg-sky-50/60 hover:border-sky-300'
                      }`}
                    >
                      {isSelected && (
                        <span
                          className={`absolute top-1 right-1 w-4 h-4 rounded-full ${checkBgClass} text-white flex items-center justify-center text-[9px] font-extrabold shadow-xs`}
                        >
                          ✓
                        </span>
                      )}
                      <HamsterCharacterAvatar
                        skin={skin}
                        size={48}
                        team={matchMode === 'teams' ? myTeam : 'solo'}
                      />
                      <span className="mt-0.5 font-extrabold text-[10px] sm:text-[11px] text-slate-900 leading-tight text-center truncate w-full">
                        {skin.name}
                      </span>
                      <span className="text-[9px] font-semibold text-slate-500 leading-none mt-0.5 truncate w-full text-center">
                        {skin.headgear}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team Squad Selector Cards */}
            {matchMode === 'teams' && (
              <div className="w-full grid grid-cols-2 gap-2 mb-2.5">
                {(['red', 'blue'] as TeamId[]).map(tId => {
                  const active = myTeam === tId;
                  const count = tId === 'red' ? teamTotals.red.count : teamTotals.blue.count;
                  return (
                    <button
                      key={tId}
                      type="button"
                      onClick={() => setMyTeam(tId)}
                      className={`py-2 px-3 rounded-xl font-extrabold text-xs sm:text-sm border-2 transition cursor-pointer flex items-center justify-between gap-2 whitespace-nowrap ${
                        active
                          ? tId === 'red'
                            ? 'bg-rose-500 text-white border-rose-600 border-b-4 border-b-rose-700 shadow-sm'
                            : 'bg-sky-600 text-white border-sky-700 border-b-4 border-b-sky-800 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{tId === 'red' ? 'Red Squad' : 'Blue Squad'}</span>
                      <span
                        className={`text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                          active ? 'bg-black/15 text-white' : 'bg-slate-200/80 text-slate-600'
                        }`}
                      >
                        {count}P
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Nickname & 6-Char Room Code Inputs (16px text-base prevents iOS Safari auto-zoom) */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2.5">
              <input
                type="text"
                maxLength={16}
                value={playerName === 'Teacher Jan' ? '' : playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Your Nickname"
                className="sm:col-span-2 h-10 sm:h-11 px-3.5 text-center sm:text-left text-base font-bold text-slate-900 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 focus:bg-white transition"
              />
              <input
                type="text"
                maxLength={6}
                value={roomCode}
                onChange={e =>
                  setRoomCode(e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6))
                }
                placeholder="ROOM"
                className="h-10 sm:h-11 px-2 text-center font-mono tabular-nums text-base sm:text-lg font-extrabold tracking-widest text-slate-900 bg-sky-50 border-2 border-sky-200 rounded-xl focus:outline-none focus:border-sky-600 focus:bg-white"
              />
            </div>

            {/* Join Arena Button */}
            <button
              type="button"
              onClick={() => {
                const cleanCode = roomCode.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);
                if (!cleanCode) return;
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

                const g = gameRef.current;
                const sp = getTeamSpawnPosition(myTeam, matchMode);
                if (g) {
                  g.x = sp.x;
                  g.z = sp.z;
                  g.rotY = sp.rotY;
                  g.camYaw = sp.rotY;
                  g.camPitch = 0.22;
                }

                const isAlreadyPlaying = stateSnapRef.current.matchStatus === 'playing';
                if (isAlreadyPlaying) {
                  setScreen('game');
                  triggerStudentMatchStart(
                    configuredDurationSec || 180,
                    matchMode,
                    lastStartedAtRef.current || getServerNow(),
                    isTimerPaused,
                    ballsPerQuestion
                  );
                } else {
                  setMatchStatus('lobby');
                  setScreen('game');
                }

                const initialPayload: PlayerNetworkState = {
                  id: clientIdRef.current,
                  name: cleanName,
                  role: 'player',
                  team: matchMode === 'solo' ? 'solo' : myTeam,
                  skinIdx: selectedSkinIdx,
                  x: sp.x,
                  z: sp.z,
                  vx: 0,
                  vz: 0,
                  rotY: sp.rotY,
                  hp: 100,
                  shield: 100,
                  score: isAlreadyPlaying ? 0 : score,
                  kos: isAlreadyPlaying ? 0 : kos,
                  questionsAnswered: isAlreadyPlaying ? 0 : questionsAnswered,
                  seq: nextPlayerSeq(),
                  lastStartedAt: lastStartedAtRef.current,
                  matchEpoch: lastStartedAtRef.current,
                  kicked: false,
                  updatedAt: getServerNow()
                };

                syncPaintballPlayerApi(cleanCode, initialPayload);
                setDoc(
                  getPlayerDocRef(cleanCode, clientIdRef.current),
                  stripUndefinedFields({
                    ...initialPayload,
                    lastSeen: serverTimestamp()
                  }),
                  { merge: true }
                ).catch(() => {});

                handleForceResyncRoom(cleanCode);
              }}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-white font-['Poppins',sans-serif] font-extrabold text-sm sm:text-base rounded-2xl shadow-lg transition flex items-center justify-center gap-2 border-2 border-emerald-600 border-b-4 border-b-emerald-700 cursor-pointer whitespace-nowrap"
            >
              <Play size={17} fill="currentColor" />
              <span>{matchStatus === 'playing' ? 'JOIN LIVE BATTLE' : 'JOIN ARENA LOBBY'}</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 3: BRIGHT PROJECTOR-READY HOST PARK LOBBY COMMAND DECK
         ------------------------------------------------------------- */}
      {screen === 'lobby' && role === 'host' && (
        <div className="absolute inset-0 z-25 flex flex-col justify-between px-3 sm:px-5 pt-14 sm:pt-16 pb-3 pointer-events-none overflow-y-auto">
          {isLobbyMinimized ? (
            /* Compact Collapsed Floating Host Bar so Teacher can inspect the 3D Arena freely */
            <div className="host-lobby-interactive-panel pointer-events-auto self-center bg-white px-4 py-2.5 rounded-2xl shadow-xl border-2 border-sky-200 border-b-4 border-b-sky-300 flex flex-wrap items-center gap-3 text-slate-900">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-sky-600" />
                <span className="font-extrabold text-xs sm:text-sm tabular-nums">
                  Room <span className="font-mono text-sky-700">{roomCode}</span> · {roomPlayers.length}{' '}
                  {roomPlayers.length === 1 ? 'Player' : 'Players'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(true)}
                className="px-2.5 py-1 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-extrabold text-xs cursor-pointer whitespace-nowrap"
              >
                Show QR
              </button>
              <button
                type="button"
                onClick={handleStartMultiplayerMatch}
                className="px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white border-b-2 border-emerald-700 font-extrabold text-xs flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Play size={12} fill="currentColor" />
                <span>Start Battle</span>
              </button>
              <button
                type="button"
                onClick={() => setIsLobbyMinimized(false)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs cursor-pointer whitespace-nowrap"
              >
                Open Arena Setup
              </button>
            </div>
          ) : (
            /* COHESIVE STADIUM 2-COLUMN COMMAND CENTER (RULES + INTEGRATED ADJACENT QR PASS) */
            <div className="host-lobby-interactive-panel pointer-events-auto w-full max-w-[920px] mx-auto my-auto bg-white rounded-3xl shadow-2xl border-2 border-sky-200 overflow-hidden text-slate-900">
              {/* Stadium Top Command Ribbon */}
              <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-4 sm:px-6 py-3 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                    <Radio size={16} className="text-amber-300" />
                  </div>
                  <div>
                    <div className="text-[10px] font-extrabold uppercase tracking-widest text-sky-100">
                      Classroom Multiplayer Arena
                    </div>
                    <h2 className="font-['Poppins',sans-serif] font-extrabold text-base sm:text-lg leading-tight">
                      Host Arena Setup
                    </h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScreen('editor')}
                    className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/30 font-extrabold text-xs flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap tabular-nums"
                    title="Edit Quiz Questions"
                  >
                    <Edit3 size={13} />
                    <span>Edit Quiz ({effectiveQuestions.length} Qs)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLobbyMinimized(true)}
                    className="px-3 py-1.5 rounded-xl bg-white text-slate-800 hover:bg-sky-50 font-extrabold text-xs transition cursor-pointer whitespace-nowrap shadow-xs"
                    title="Minimize setup deck to inspect the 3D Arena"
                  >
                    Inspect 3D Arena
                  </button>
                </div>
              </div>

              {/* 2-Column Body: Left = Match Settings & Squad Roster | Right = Classroom QR & Room Code Station */}
              <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* LEFT COLUMN (7 Cols): Match Rules, Squad Roster & START BATTLE */}
                <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col justify-between gap-3.5">
                  <div className="space-y-3">
                    {/* Battle Mode Segmented Selector */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          Battle Format
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          {matchMode === 'teams' ? '2 Squads · Team KOs' : 'Every Hamster for Themselves'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setMatchMode('teams')}
                          className={`py-2 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                            matchMode === 'teams'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Users size={14} className="text-rose-500" />
                          <span>Red vs Blue Squads</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMatchMode('solo')}
                          className={`py-2 px-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                            matchMode === 'solo'
                              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Trophy size={14} className="text-amber-500" />
                          <span>Free-For-All</span>
                        </button>
                      </div>
                    </div>

                    {/* Paintballs Reward + Match Timer Side-by-Side / Stacked */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Paintballs Per Correct Answer */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-xs font-extrabold text-slate-800">
                            Ammo / Answer
                          </span>
                          <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion - 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center cursor-pointer"
                            >
                              -
                            </button>
                            <span className="text-xs font-mono tabular-nums font-extrabold text-emerald-700 px-1.5">
                              +{ballsPerQuestion}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleHostUpdateBallsPerQuestion(ballsPerQuestion + 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs flex items-center justify-center cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {[5, 10, 15, 20, 25].map(bCount => (
                            <button
                              key={bCount}
                              type="button"
                              onClick={() => handleHostUpdateBallsPerQuestion(bCount)}
                              className={`py-1 rounded-lg font-extrabold text-[11px] transition cursor-pointer tabular-nums whitespace-nowrap ${
                                ballsPerQuestion === bCount
                                  ? 'bg-emerald-500 text-white border-b-2 border-emerald-700 shadow-xs'
                                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              +{bCount}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Match Timer */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="flex items-center gap-1 text-xs font-extrabold text-slate-800">
                            <Clock size={13} className="text-sky-600 shrink-0" />
                            <span>Match Timer</span>
                          </span>
                          <span className="font-mono tabular-nums font-extrabold text-xs text-sky-700">
                            {Math.floor(configuredDurationSec / 60)}:
                            {(configuredDurationSec % 60).toString().padStart(2, '0')}
                          </span>
                        </div>
                        <div className="grid grid-cols-6 sm:grid-cols-3 gap-1">
                          {[2, 3, 5, 8, 10, 15].map(mins => {
                            const sec = mins * 60;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => {
                                  setConfiguredDurationSec(sec);
                                  setMatchSeconds(sec);
                                }}
                                className={`py-1 rounded-lg font-extrabold text-[11px] transition cursor-pointer tabular-nums whitespace-nowrap ${
                                  configuredDurationSec === sec
                                    ? 'bg-sky-600 text-white border-b-2 border-sky-800 shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                {mins}m
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Live Connected Squad Roster */}
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-slate-800 mb-1.5">
                        <div className="flex items-center gap-2 tabular-nums">
                          <span>Connected Champions ({roomPlayers.length})</span>
                          {matchMode === 'teams' && (
                            <span className="text-[11px] font-bold text-slate-500">
                              <span className="text-rose-600">Red {teamTotals.red.count}</span> ·{' '}
                              <span className="text-sky-600">Blue {teamTotals.blue.count}</span>
                            </span>
                          )}
                        </div>
                        {roomPlayers.length > 0 && matchMode === 'teams' && (
                          <button
                            type="button"
                            onClick={handleShuffleTeams}
                            className="px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <Shuffle size={11} /> Balance Teams
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {roomPlayers.length === 0 ? (
                          <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-dashed border-sky-300 text-xs text-slate-600 font-semibold text-center">
                            Waiting for players — scan the QR code on the right or enter{' '}
                            <strong className="text-sky-700 font-mono tabular-nums">{roomCode}</strong>
                          </div>
                        ) : (
                          roomPlayers.map(p => {
                            const tCfg =
                              matchMode === 'teams'
                                ? TEAM_CONFIG[p.team || 'red']
                                : TEAM_CONFIG.solo;
                            const charSkin =
                              HAMSTER_SKINS[p.skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
                            const nextTeam: TeamId = p.team === 'red' ? 'blue' : 'red';
                            return (
                              <div
                                key={p.id}
                                className={`p-2 rounded-xl bg-white border ${tCfg.borderClass} flex items-center justify-between gap-2 shadow-2xs`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <HamsterCharacterAvatar
                                    skin={charSkin}
                                    size={32}
                                    team={matchMode === 'teams' ? p.team || 'red' : 'solo'}
                                  />
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-extrabold text-xs text-slate-900 truncate">
                                        {p.name}
                                      </span>
                                      <span
                                        className={`text-[10px] font-extrabold shrink-0 ${
                                          matchMode === 'teams'
                                            ? p.team === 'blue'
                                              ? 'text-sky-600'
                                              : 'text-rose-600'
                                            : 'text-emerald-600'
                                        }`}
                                      >
                                        ·{' '}
                                        {matchMode === 'teams'
                                          ? p.team === 'blue'
                                            ? 'Blue Squad'
                                            : 'Red Squad'
                                          : 'Solo'}
                                      </span>
                                    </div>
                                    <div className="text-[10px] font-semibold text-slate-500">
                                      {charSkin.name} · Ready in Spawn
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {matchMode === 'teams' && (
                                    <button
                                      type="button"
                                      onClick={() => handleMovePlayerTeam(p, nextTeam)}
                                      className={`px-2 py-1 rounded-lg font-extrabold text-[10px] border transition cursor-pointer whitespace-nowrap ${
                                        nextTeam === 'blue'
                                          ? 'bg-sky-50 hover:bg-sky-100 text-sky-700 border-sky-200'
                                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                      }`}
                                    >
                                      To {nextTeam === 'blue' ? 'Blue' : 'Red'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePlayer(p)}
                                    className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-200 transition cursor-pointer"
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
                  </div>

                  {/* Bold Emerald START BATTLE CTA */}
                  <button
                    type="button"
                    onClick={handleStartMultiplayerMatch}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-white font-['Poppins',sans-serif] font-extrabold text-base py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 border-2 border-emerald-600 border-b-4 border-b-emerald-700 cursor-pointer whitespace-nowrap"
                  >
                    <Play size={18} fill="currentColor" />
                    <span>START BATTLE ({roomPlayers.length} READY)</span>
                  </button>
                </div>

                {/* RIGHT COLUMN (5 Cols): Integrated Classroom QR & Room Code Join Station */}
                <div className="lg:col-span-5 bg-gradient-to-b from-sky-50/90 via-white to-sky-50/70 p-4 sm:p-5 flex flex-col items-center justify-between text-center gap-3">
                  <div className="w-full">
                    <div className="text-[11px] font-extrabold text-sky-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <QrCode size={14} className="text-sky-600" />
                      <span>Scan or Enter Room Code</span>
                    </div>

                    {/* Giant Copyable 6-Digit Room Code */}
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopyRoomCode}
                        className="bg-white border-2 border-sky-300 hover:border-sky-500 px-4 py-2 rounded-2xl text-slate-900 font-mono tabular-nums font-extrabold text-3xl tracking-[0.18em] leading-none cursor-pointer shadow-xs transition"
                        title="Click to copy Room Code"
                      >
                        {roomCode}
                      </button>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={handleCopyRoomCode}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 text-slate-700 font-extrabold text-[10px] border border-sky-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          {copiedType === 'code' ? (
                            <Check size={11} className="text-emerald-600" />
                          ) : (
                            <Copy size={11} />
                          )}
                          <span>{copiedType === 'code' ? 'Copied' : 'Code'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateNewRoomCode}
                          className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-50 text-amber-700 font-extrabold text-[10px] border border-amber-200 flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          title="Generate a fresh Room Code"
                        >
                          <RotateCw size={11} />
                          <span>New</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* High-Contrast Scannable QR Pass */}
                  <div
                    onClick={() => setIsQrModalOpen(true)}
                    className="p-3.5 bg-white rounded-3xl border-2 border-sky-200 hover:border-sky-400 shadow-md cursor-pointer transition hover:scale-[1.02]"
                    title="Click to open Full-Screen Projector QR"
                  >
                    <QRCodeSVG
                      value={liveJoinUrl}
                      size={188}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                    />
                  </div>

                  {/* Domain Routing Switch + Direct Link Actions */}
                  <div className="w-full space-y-2">
                    <div className="text-xs font-bold text-slate-600 truncate px-2">
                      Join at <span className="text-sky-700 font-extrabold">{liveDisplayHost}</span>
                    </div>

                    {!isCurrentOriginHamsterEnglish && (
                      <div className="inline-flex items-center gap-1 p-1 bg-sky-100/80 rounded-xl border border-sky-200">
                        <button
                          type="button"
                          onClick={() => setJoinDomainMode('current')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                            joinDomainMode === 'current'
                              ? 'bg-white text-sky-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Current URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setJoinDomainMode('hamsterenglish')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer whitespace-nowrap ${
                            joinDomainMode === 'hamsterenglish'
                              ? 'bg-white text-sky-700 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          hamsterenglish.online
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleCopyJoinLink}
                        className="py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs border-b-3 border-sky-800 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap shadow-xs"
                      >
                        {copiedType === 'link' ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copiedType === 'link' ? 'Copied Link' : 'Copy Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsQrModalOpen(true)}
                        className="py-2.5 px-3 rounded-xl bg-white hover:bg-sky-50 text-sky-800 font-extrabold text-xs border-2 border-sky-200 flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                      >
                        <QrCode size={13} />
                        <span>Large QR</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtle Bottom Park Roam Helper */}
          <div className="mx-auto mt-2 px-4 py-1.5 rounded-xl bg-white/95 border border-sky-200 text-[11px] sm:text-xs font-bold text-slate-700 shadow-md">
            Host Camera: W/A/S/D or Arrows to roam the 3D Arena · Drag to look around
          </div>

          {/* Enlarged Classroom QR Modal */}
          {isQrModalOpen && (
            <div className="pointer-events-auto absolute inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
              <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border-2 border-sky-200 flex flex-col items-center text-center relative">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="text-xs font-bold text-sky-600 mb-0.5">{liveDisplayHost}</div>
                <h3 className="font-['Poppins',sans-serif] font-extrabold text-2xl text-slate-900 tabular-nums">
                  Room Code: <span className="font-mono text-sky-700">{roomCode}</span>
                </h3>

                {/* Domain Switcher inside QR Modal (Only when not already on hamsterenglish.online) */}
                {!isCurrentOriginHamsterEnglish && (
                  <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-xl border border-sky-200 mt-3">
                    <button
                      type="button"
                      onClick={() => setJoinDomainMode('current')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        joinDomainMode === 'current'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Current URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinDomainMode('hamsterenglish')}
                      className={`px-3 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        joinDomainMode === 'hamsterenglish'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      hamsterenglish.online
                    </button>
                  </div>
                )}

                <div className="my-4 p-4 bg-white rounded-2xl border-2 border-sky-100 shadow-xs">
                  <QRCodeSVG
                    value={liveJoinUrl}
                    size={240}
                    level="H"
                    includeMargin={true}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <p className="text-xs font-semibold text-slate-500 break-all px-2 mb-4">
                  {liveJoinUrl}
                </p>
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    onClick={handleCopyJoinLink}
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-xs rounded-xl border-b-3 border-sky-800 shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Copy size={14} />
                    <span>{copiedType === 'link' ? 'Copied Link' : 'Copy Join Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 4: UNOBSTRUCTED BRIGHT ARCADE IN-GAME HUD
         ------------------------------------------------------------- */}
      {screen === 'game' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between px-2.5 sm:px-4 pt-12 sm:pt-14 pb-2.5 sm:pb-4 overflow-hidden">
          {/* SCREEN-EDGE INCOMING DAMAGE PAINT VIGNETTE */}
          {damageVignetteColor && (
            <div
              className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-200"
              style={{
                background: `radial-gradient(circle, transparent 54%, ${damageVignetteColor} 100%)`
              }}
            />
          )}

          {/* RETICLE HIT-MARKER FLASH (✕) */}
          {hitMarkerFlash && (
            <div
              className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${hitMarkerFlash.xPct}%`,
                top: `${hitMarkerFlash.yPct}%`
              }}
            >
              <div
                className={`w-8 h-8 flex items-center justify-center font-extrabold text-xl drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)] scale-110 transition-transform ${
                  hitMarkerFlash.isShield ? 'text-sky-300' : 'text-amber-300'
                }`}
              >
                ✕
              </div>
            </div>
          )}

          {/* 3D-PROJECTED FLOATING DAMAGE POPUPS */}
          {floatingDamages.map(fd => (
            <div
              key={fd.id}
              className="absolute pointer-events-none z-30 -translate-x-1/2 -translate-y-full"
              style={{
                left: `${fd.xPct}%`,
                top: `${fd.yPct}%`
              }}
            >
              <div
                className={`px-2 py-0.5 rounded-lg border-2 font-mono tabular-nums font-extrabold text-xs sm:text-sm shadow-md whitespace-nowrap ${
                  fd.isShield
                    ? 'bg-sky-600 border-white text-white'
                    : 'bg-rose-500 border-white text-white'
                }`}
              >
                -{fd.damage} {fd.isShield ? 'SHD' : 'HP'}
              </div>
            </div>
          ))}

          {/* TOP HUD BAR: CLEAN 3-ZONE ARCADE SCOREBAR */}
          <div className="w-full flex items-start justify-between gap-1.5 sm:gap-2.5 flex-nowrap">
            {role === 'player' ? (
              /* STUDENT TOP-LEFT: BRIGHT VITALS & CAN BELT CARD */
              <div
                className={`relative pointer-events-auto shrink-0 bg-white/95 rounded-2xl p-2 sm:p-2.5 w-[138px] min-[390px]:w-[152px] sm:w-52 md:w-60 border-2 shadow-md ${
                  matchMode === 'teams'
                    ? myTeam === 'blue'
                      ? 'border-sky-300'
                      : 'border-rose-300'
                    : 'border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-slate-100 min-w-0">
                  <div className="flex items-center gap-1 min-w-0">
                    {matchMode === 'teams' && (
                      <span
                        className={`text-[9px] sm:text-[10px] font-extrabold shrink-0 ${
                          myTeam === 'blue' ? 'text-sky-600' : 'text-rose-600'
                        }`}
                      >
                        {myTeam === 'blue' ? 'BLUE' : 'RED'} ·
                      </span>
                    )}
                    <span className="font-extrabold text-slate-900 text-[10px] sm:text-xs truncate">
                      {playerName}
                    </span>
                  </div>
                  <span className="font-mono tabular-nums text-[10px] font-extrabold text-amber-600 shrink-0">
                    {kos} KO
                  </span>
                </div>

                {/* HP & Shield Bars with Tabular Numerals */}
                <div className="space-y-1">
                  <div>
                    <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-extrabold text-emerald-700 leading-none mb-0.5 tabular-nums">
                      <span className="flex items-center gap-0.5">
                        <Heart size={9} className="text-rose-500 fill-rose-500" /> HP
                      </span>
                      <span>
                        {hp}/{maxHp}
                      </span>
                    </div>
                    <div className="w-full h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-150"
                        style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[8px] sm:text-[10px] font-extrabold text-sky-700 leading-none mb-0.5 tabular-nums">
                      <span className="flex items-center gap-0.5">
                        <Shield size={9} className="text-sky-500 fill-sky-500" /> SHD
                      </span>
                      <span>
                        {shield}/{maxShield}
                      </span>
                    </div>
                    <div className="w-full h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-150"
                        style={{ width: `${Math.max(0, (shield / maxShield) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Hold Can Belt Buttons (+HP / +DEF) */}
                <div className="grid grid-cols-2 gap-1 mt-1.5 pt-1.5 border-t border-slate-100">
                  <button
                    type="button"
                    onMouseDown={() => startCanLongPress('health')}
                    onMouseUp={stopCanLongPress}
                    onMouseLeave={stopCanLongPress}
                    onTouchStart={e => {
                      e.preventDefault();
                      startCanLongPress('health');
                    }}
                    onTouchEnd={stopCanLongPress}
                    onTouchCancel={stopCanLongPress}
                    className={`py-1 px-1.5 rounded-lg text-[9px] sm:text-[10px] font-extrabold border transition cursor-pointer tabular-nums whitespace-nowrap select-none ${
                      holdingCanType === 'health'
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : healthCans > 0
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title="Hold 1s (or press H) to restore +45 HP"
                  >
                    {holdingCanType === 'health' ? `${canHoldProgress}%` : `+HP (${healthCans})`}
                  </button>
                  <button
                    type="button"
                    onMouseDown={() => startCanLongPress('shield')}
                    onMouseUp={stopCanLongPress}
                    onMouseLeave={stopCanLongPress}
                    onTouchStart={e => {
                      e.preventDefault();
                      startCanLongPress('shield');
                    }}
                    onTouchEnd={stopCanLongPress}
                    onTouchCancel={stopCanLongPress}
                    className={`py-1 px-1.5 rounded-lg text-[9px] sm:text-[10px] font-extrabold border transition cursor-pointer tabular-nums whitespace-nowrap select-none ${
                      holdingCanType === 'shield'
                        ? 'bg-sky-500 text-white border-sky-600'
                        : shieldCans > 0
                        ? 'bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                    title="Hold 1s (or press F) to charge +50 Shield"
                  >
                    {holdingCanType === 'shield' ? `${canHoldProgress}%` : `+SHD (${shieldCans})`}
                  </button>
                </div>
              </div>
            ) : (
              /* HOST TOP-LEFT: BRIGHT CAMERA MODE & EVENT CARD */
              <div className="pointer-events-auto shrink-0 bg-white/95 rounded-2xl p-2 sm:p-2.5 w-40 sm:w-64 md:w-72 border-2 border-sky-200 shadow-md flex flex-col gap-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Video size={13} className="text-sky-600 shrink-0" />
                    <span className="font-extrabold text-[10px] sm:text-xs text-slate-800 truncate">
                      {hostCameraMode === 'overview'
                        ? 'Arena Overview'
                        : hostCameraMode === 'auto_track'
                        ? 'Auto Camera'
                        : 'Player Focus'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-sky-700 shrink-0 tabular-nums">
                    {roomPlayers.length > 0 && hostCameraMode !== 'overview'
                      ? roomPlayers[hostFollowIndex % roomPlayers.length]?.name
                      : `${roomPlayers.length}P`}
                  </span>
                </div>
                {liveEvents[0] && (
                  <div className="hidden sm:block text-[10px] font-semibold text-slate-600 truncate">
                    {liveEvents[0].text}
                  </div>
                )}
              </div>
            )}

            {/* CENTER: BRIGHT ARCADE SCOREBOARD & CLOCK-SYNCED COUNTDOWN TIMER */}
            <div className="pointer-events-auto flex flex-col items-center mx-auto shrink-0">
              {role === 'player' && matchStatus === 'lobby' ? (
                <div className="bg-white/95 px-3 py-1.5 rounded-2xl border-2 border-sky-200 shadow-md flex items-center gap-2">
                  <span className="text-[11px] sm:text-xs font-extrabold text-slate-800 whitespace-nowrap">
                    Warm-Up Park · Waiting for Host ({roomPlayers.length} Joined)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleForceResyncRoom(roomCode)}
                    className="px-2 py-0.5 rounded-lg bg-sky-100 hover:bg-sky-200 text-sky-800 font-extrabold text-[10px] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    title="Sync Room Status"
                  >
                    <RotateCw size={10} />
                    <span>Sync</span>
                  </button>
                </div>
              ) : (
                <div
                  className={`bg-white/95 px-2.5 sm:px-3.5 py-1.5 rounded-2xl flex flex-col items-center gap-1 border-2 shadow-md transition ${
                    matchStatus === 'playing' && matchSeconds <= 30
                      ? 'border-rose-400'
                      : 'border-sky-200'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    {matchMode === 'teams' && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tabular-nums">
                        <span className="text-rose-600">RED {teamTotals.red.kos}</span>
                        <span className="text-slate-300">·</span>
                      </div>
                    )}

                    <div
                      className={`flex items-center gap-1 font-mono tabular-nums font-extrabold text-xs sm:text-base px-2 py-0.5 rounded-xl border ${
                        isTimerPaused
                          ? 'bg-amber-50 border-amber-300 text-amber-800'
                          : matchSeconds <= 30
                          ? 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-sky-50 border-sky-200 text-slate-900'
                      }`}
                    >
                      <Clock
                        size={13}
                        className={matchSeconds <= 30 ? 'text-rose-600' : 'text-sky-600'}
                      />
                      <span>
                        {Math.floor(matchSeconds / 60)}:
                        {(matchSeconds % 60).toString().padStart(2, '0')}
                      </span>
                      {isTimerPaused && (
                        <span className="text-[9px] font-sans font-extrabold text-amber-700 ml-0.5">
                          PAUSED
                        </span>
                      )}
                    </div>

                    {matchMode === 'teams' && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold tabular-nums">
                        <span className="text-slate-300">·</span>
                        <span className="text-sky-600">BLUE {teamTotals.blue.kos}</span>
                      </div>
                    )}

                    {/* Host Live Timer & Balls/Question Controls */}
                    {role === 'host' && (
                      <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-200">
                        <button
                          type="button"
                          onClick={handleHostTogglePauseTimer}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 cursor-pointer whitespace-nowrap"
                          title={isTimerPaused ? 'Resume Timer' : 'Pause Timer'}
                        >
                          {isTimerPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleHostAddTime(30)}
                          className="px-2 py-0.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-[10px] font-extrabold text-sky-700 border border-sky-200 cursor-pointer tabular-nums whitespace-nowrap"
                          title="Add +30 Seconds"
                        >
                          +30s
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Clean Timer Progress Track */}
                  <div className="w-full min-w-[110px] sm:min-w-[180px] h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        matchSeconds <= 30
                          ? 'bg-rose-500'
                          : matchSeconds <= 60
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
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

            {/* TOP-RIGHT: HOST CAMERA, SCORES & FLAG END BUTTON */}
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 shrink-0">
              {role === 'host' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLobbyMinimized(false);
                      setScreen('lobby');
                    }}
                    className="h-8 px-2.5 rounded-xl bg-white hover:bg-sky-50 text-slate-800 border-2 border-sky-200 border-b-3 border-b-sky-300 font-extrabold text-xs flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap tabular-nums"
                  >
                    <Users size={13} className="text-sky-600" />
                    <span>Lobby ({roomPlayers.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setHostCameraMode('overview')}
                    className={`h-8 px-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap border-2 ${
                      hostCameraMode === 'overview'
                        ? 'bg-sky-600 text-white border-sky-700 border-b-3 border-b-sky-800'
                        : 'bg-white hover:bg-sky-50 text-slate-700 border-sky-200 border-b-3 border-b-sky-300'
                    }`}
                  >
                    <Eye size={13} />
                    <span className="hidden lg:inline">Overview</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLeaderboardOpen(true)}
                    className="h-8 px-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 border-2 border-amber-500 border-b-3 border-b-amber-600 font-extrabold text-xs flex items-center gap-1 transition shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <Trophy size={13} />
                    <span className="hidden sm:inline">Scores</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEndMatch}
                    className="h-8 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white border-2 border-rose-600 border-b-3 border-b-rose-700 font-extrabold text-xs flex items-center gap-1.5 transition shadow-sm active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                    title="End Match & Show Results"
                  >
                    <Flag size={13} fill="currentColor" />
                    <span>End</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* PUBG DYNAMIC EXPANDING 4-TICK CROSSHAIR & 2X TACTICAL ADS SCOPE OPTIC */}
          {role === 'player' && !isQuestionModalOpen && !isSettingsOpen && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20 flex flex-col items-center"
              style={{
                left: `${aimControlMode === 'separate' ? aimReticlePct.x : 50}%`,
                top: `${aimControlMode === 'separate' ? aimReticlePct.y : 46}%`
              }}
            >
              {isAdsScoped ? (
                /* PUBG 2X HOLOGRAPHIC / RED-DOT SCOPE OPTIC */
                <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-slate-900/90 shadow-[0_0_0_2px_rgba(255,255,255,0.35),0_12px_32px_rgba(0,0,0,0.45)] flex items-center justify-center">
                  {/* Fine Mil-Dot Stadia Crosslines */}
                  <div className="absolute inset-x-3 h-px bg-slate-900/45" />
                  <div className="absolute inset-y-3 w-px bg-slate-900/45" />
                  <div
                    className={`w-12 h-12 rounded-full border-[1.5px] transition-transform duration-75 ${
                      isEnemyTargeted
                        ? 'border-emerald-400 scale-95'
                        : 'border-rose-500/90'
                    }`}
                  />
                  {/* Illuminated Red/Emerald Center Optic Chevron Dot */}
                  <div
                    className={`absolute w-2 h-2 rounded-full border border-slate-950/70 shadow-xs ${
                      isEnemyTargeted ? 'bg-emerald-400 scale-125' : 'bg-rose-500'
                    }`}
                  />
                  <span className="absolute bottom-2.5 px-1.5 py-0.5 rounded bg-slate-900/85 text-amber-300 font-mono tabular-nums font-extrabold text-[9px] tracking-wider">
                    2X OPTIC
                  </span>
                </div>
              ) : (
                /* PUBG DYNAMIC 4-TICK EXPANDING CROSSHAIR (SPREAD RESPONDS TO MOVE / JUMP / STANCE / RECOIL) */
                <div className="relative w-20 h-20 flex items-center justify-center">
                  {/* Top Hairline Tick */}
                  <span
                    className={`absolute w-[3px] h-3 rounded-full border border-slate-950/80 shadow-xs ${
                      isEnemyTargeted ? 'bg-emerald-400' : 'bg-white'
                    }`}
                    style={{
                      transform: `translateY(-${crosshairSpreadPx + 6}px)`
                    }}
                  />
                  {/* Bottom Hairline Tick */}
                  <span
                    className={`absolute w-[3px] h-3 rounded-full border border-slate-950/80 shadow-xs ${
                      isEnemyTargeted ? 'bg-emerald-400' : 'bg-white'
                    }`}
                    style={{
                      transform: `translateY(${crosshairSpreadPx + 6}px)`
                    }}
                  />
                  {/* Left Hairline Tick */}
                  <span
                    className={`absolute h-[3px] w-3 rounded-full border border-slate-950/80 shadow-xs ${
                      isEnemyTargeted ? 'bg-emerald-400' : 'bg-white'
                    }`}
                    style={{
                      transform: `translateX(-${crosshairSpreadPx + 6}px)`
                    }}
                  />
                  {/* Right Hairline Tick */}
                  <span
                    className={`absolute h-[3px] w-3 rounded-full border border-slate-950/80 shadow-xs ${
                      isEnemyTargeted ? 'bg-emerald-400' : 'bg-white'
                    }`}
                    style={{
                      transform: `translateX(${crosshairSpreadPx + 6}px)`
                    }}
                  />

                  {/* Center Precision Dot */}
                  <span
                    className={`w-2 h-2 rounded-full border border-slate-950/85 shadow-xs ${
                      immunitySecondsLeft > 0
                        ? 'bg-amber-300'
                        : isEnemyTargeted
                        ? 'bg-emerald-400 scale-125'
                        : 'bg-white'
                    }`}
                  />
                </div>
              )}

              {/* Compact Non-Obstructing Status Readout Under Reticle */}
              {immunitySecondsLeft > 0 ? (
                <div className="mt-0.5 px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono tabular-nums font-extrabold text-[10px] border border-white shadow-md whitespace-nowrap">
                  IMMUNE {immunitySecondsLeft}s
                </div>
              ) : isEnemyTargeted ? (
                <div className="mt-0.5 px-1.5 py-0.5 rounded-md bg-emerald-500 text-white font-extrabold text-[9px] tracking-wider border border-white shadow-sm whitespace-nowrap">
                  TARGET
                </div>
              ) : !isTouchHudVisible && !isAimLocked && aimControlMode === 'shoulder' ? (
                <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-900/80 text-white font-bold text-[10px] border border-white/25 shadow-sm whitespace-nowrap">
                  Click Arena to Aim &amp; Fire
                </div>
              ) : null}
            </div>
          )}

          {/* STADIUM BROADCAST ALERTS: MATCH START ANNOUNCEMENT, STREAKS, 10s IMMUNITY & PICKUPS */}
          <div className="self-center flex flex-col items-center gap-1.5 max-w-[92vw]">
            {killStreakCallout && (
              <div
                className={`bg-gradient-to-r ${killStreakCallout.colorClass} border-2 px-5 py-2.5 rounded-2xl text-center shadow-2xl text-white`}
              >
                <div className="font-['Poppins',sans-serif] text-base sm:text-xl font-extrabold tracking-tight drop-shadow-xs">
                  {killStreakCallout.title}
                </div>
                <div className="text-[10px] sm:text-xs font-extrabold tracking-wide opacity-95">
                  {killStreakCallout.subtitle}
                </div>
              </div>
            )}

            {role === 'player' && matchStatus === 'playing' && spawnHoldSecondsLeft > 0 && (
              <div
                className={`rounded-3xl p-3.5 sm:p-4 text-center shadow-2xl border-2 text-white min-w-[270px] sm:min-w-[340px] ${
                  matchMode === 'teams'
                    ? myTeam === 'blue'
                      ? 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 border-sky-200'
                      : 'bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 border-rose-200'
                    : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 border-emerald-200'
                }`}
              >
                <div className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-widest opacity-90">
                  Championship Battle Announcement
                </div>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="text-left">
                    <div className="font-['Poppins',sans-serif] text-sm sm:text-lg font-extrabold leading-tight">
                      {matchMode === 'teams'
                        ? myTeam === 'blue'
                          ? 'Blue Squad — Prepare to Launch!'
                          : 'Red Squad — Prepare to Launch!'
                        : 'Free-For-All — Prepare to Launch!'}
                    </div>
                    <div className="text-[11px] font-semibold opacity-95 mt-0.5">
                      Tap <b>Questions</b> below anytime to reload +{ballsPerQuestion} Paintballs
                    </div>
                  </div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-400 text-slate-950 border-2 border-white font-['Poppins',sans-serif] font-extrabold text-xl sm:text-2xl tabular-nums flex items-center justify-center shrink-0 shadow-md">
                    {spawnHoldSecondsLeft}
                  </div>
                </div>
              </div>
            )}

            {role === 'player' && immunitySecondsLeft > 0 && (
              <div className="bg-gradient-to-r from-amber-400 via-yellow-300 to-sky-300 border-2 border-white px-4 py-1.5 rounded-2xl text-center shadow-xl min-w-[240px]">
                <div className="text-xs sm:text-sm font-extrabold text-slate-950 flex items-center justify-center gap-1.5 tabular-nums">
                  <Shield size={15} className="text-slate-950 fill-white" />
                  <span>RESPAWN SHIELD IMMUNITY · {immunitySecondsLeft}s</span>
                </div>
                <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-slate-900 rounded-full transition-all duration-200"
                    style={{ width: `${Math.min(100, (immunitySecondsLeft / 10) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {koBannerText && (
              <div className="bg-rose-600 border-2 border-white px-4 py-1.5 rounded-2xl text-center shadow-xl">
                <div className="text-xs sm:text-sm font-extrabold text-white">
                  {koBannerText}
                </div>
              </div>
            )}

            {pickupBannerText && (
              <div className="bg-white border-2 border-emerald-400 px-3.5 py-1 rounded-2xl text-center shadow-md">
                <div className="text-[11px] sm:text-xs font-extrabold text-emerald-800">
                  {pickupBannerText}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ROW: CLEAN LAPTOP KEYBIND DOCK OR INSET PUBG MOBILE TOUCH CONTROLS */}
          {role === 'player' ? (
            isTouchHudVisible ? (
              /* MOBILE / TABLET TOUCH MODE: PULLED AWAY FROM SCREEN EDGES + CRAWL/CROUCH/JUMP UNDER SHOOT */
              <div className="w-full flex items-end justify-between gap-3 sm:gap-6 pb-5 sm:pb-7 px-6 sm:px-10 flex-nowrap">
                {/* LEFT THUMB ZONE (INSET AWAY FROM BEZEL): REDESIGNED 360° TACTICAL THUMBSTICK */}
                <div className="flex flex-col items-center shrink-0">
                  <div
                    onTouchStart={handleJoystickStart}
                    onTouchMove={handleJoystickMove}
                    onTouchEnd={handleJoystickEnd}
                    onTouchCancel={handleJoystickEnd}
                    className="pb-touch-joystick pointer-events-auto w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900/55 border-2 border-white/75 flex items-center justify-center relative touch-none shadow-2xl select-none"
                  >
                    {/* Outer Directional Chevrons */}
                    <span className="absolute top-1.5 text-[9px] font-black text-white/70 leading-none">
                      ▲
                    </span>
                    <span className="absolute bottom-1.5 text-[9px] font-black text-white/70 leading-none">
                      ▼
                    </span>
                    <span className="absolute left-2 text-[9px] font-black text-white/70 leading-none">
                      ◀
                    </span>
                    <span className="absolute right-2 text-[9px] font-black text-white/70 leading-none">
                      ▶
                    </span>
                    {/* Inner Guide Ring */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border border-white/25 flex items-center justify-center">
                      {/* Tactile Grip Thumb Puck */}
                      <div
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-sky-400 to-sky-600 border-2 border-white shadow-lg flex items-center justify-center transition-transform duration-75"
                        style={{
                          transform: `translate(${joystickVec.x * 26}px, ${joystickVec.y * 26}px)`
                        }}
                      >
                        <div className="w-4 h-4 rounded-full border border-white/60 bg-white/25" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CENTER DOCK: PROMINENT EARN AMMO (QUIZ) BUTTON */}
                {matchStatus === 'playing' ? (
                  <div className="pointer-events-auto flex items-center justify-center min-w-0 shrink pb-1">
                    <button
                      type="button"
                      onClick={() => setIsQuestionModalOpen(true)}
                      className={`px-3.5 sm:px-5 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-xl border-2 border-b-4 transition flex items-center gap-2 cursor-pointer active:translate-y-0.5 whitespace-nowrap ${
                        ammo === 0
                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-500 border-b-amber-600'
                          : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-700 border-b-sky-800'
                      }`}
                      title="Answer Questions to Earn Paintballs"
                    >
                      <HelpCircle size={18} className="shrink-0" />
                      <div className="text-left leading-tight">
                        <div className="text-xs sm:text-sm font-['Poppins',sans-serif] font-extrabold">
                          {ammo === 0 ? 'Earn Ammo!' : 'Questions'}
                        </div>
                        <div
                          className={`text-[10px] sm:text-xs font-bold tabular-nums ${
                            ammo === 0 ? 'text-slate-800' : 'text-sky-100'
                          }`}
                        >
                          +{ballsPerQuestion} · Ammo {ammo}
                        </div>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="min-w-0 shrink" />
                )}

                {/* RIGHT THUMB ZONE (INSET AWAY FROM BEZEL): 2X SCOPE + SHOOT TRIGGER + CRAWL/CROUCH/JUMP UNDERNEATH */}
                <div className="pointer-events-auto flex flex-col items-end gap-2.5 shrink-0">
                  {/* Upper Combat Row: 2x ADS Scope + Redesigned Primary Shoot Trigger */}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onTouchStart={e => {
                        e.preventDefault();
                        toggleAdsScope();
                      }}
                      onClick={() => toggleAdsScope()}
                      className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl border-2 border-b-4 shadow-xl flex flex-col items-center justify-center font-extrabold text-[10px] transition active:translate-y-0.5 cursor-pointer select-none touch-none whitespace-nowrap ${
                        isAdsScoped
                          ? 'bg-amber-400 text-slate-950 border-white border-b-amber-600'
                          : 'bg-slate-900/80 text-white border-white/75 border-b-slate-950'
                      }`}
                      title="Toggle 2x Scope Zoom"
                    >
                      <Crosshair size={16} />
                      <span className="mt-0.5 leading-none">2X</span>
                    </button>

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
                      className={`w-[74px] h-[74px] sm:w-[84px] sm:h-[84px] rounded-full active:scale-95 border-3 border-white border-b-5 shadow-2xl flex flex-col items-center justify-center font-extrabold cursor-pointer select-none touch-none transition ${
                        matchStatus === 'playing' && ammo === 0
                          ? 'bg-slate-700 text-amber-300 border-b-slate-900'
                          : 'bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white border-b-rose-800'
                      }`}
                    >
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/45 bg-white/10 flex flex-col items-center justify-center">
                        <Crosshair size={20} />
                        <span className="text-[9px] sm:text-[10px] font-black tracking-wide leading-none mt-0.5 tabular-nums">
                          {matchStatus === 'playing' ? ammo : 'FIRE'}
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Stance & Agility Row Directly Under Shoot: Crawl, Crouch, Jump */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onTouchStart={e => {
                        e.preventDefault();
                        togglePlayerStance('crawl');
                      }}
                      onClick={() => togglePlayerStance('crawl')}
                      className={`min-w-[54px] h-11 sm:h-12 px-2.5 rounded-2xl border-2 border-b-4 shadow-lg flex flex-col items-center justify-center font-extrabold text-[10px] transition active:translate-y-0.5 cursor-pointer select-none touch-none whitespace-nowrap ${
                        playerStance === 'crawl'
                          ? 'bg-amber-400 text-slate-950 border-white border-b-amber-600'
                          : 'bg-slate-900/80 text-white border-white/70 border-b-slate-950'
                      }`}
                      title="Crawl / Prone"
                    >
                      <svg width="16" height="12" viewBox="0 0 20 12" fill="none" className="shrink-0">
                        <circle cx="16.5" cy="4.5" r="2.3" fill="currentColor" />
                        <path
                          d="M2 9.5H13.5L15 6.8H8.5L5.5 9.5"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="mt-0.5 leading-none">Crawl</span>
                    </button>

                    <button
                      type="button"
                      onTouchStart={e => {
                        e.preventDefault();
                        togglePlayerStance('crouch');
                      }}
                      onClick={() => togglePlayerStance('crouch')}
                      className={`min-w-[56px] h-11 sm:h-12 px-2.5 rounded-2xl border-2 border-b-4 shadow-lg flex flex-col items-center justify-center font-extrabold text-[10px] transition active:translate-y-0.5 cursor-pointer select-none touch-none whitespace-nowrap ${
                        playerStance === 'crouch'
                          ? 'bg-amber-400 text-slate-950 border-white border-b-amber-600'
                          : 'bg-slate-900/80 text-white border-white/70 border-b-slate-950'
                      }`}
                      title="Crouch / Duck Behind Cover"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                        <circle cx="10" cy="3.2" r="2.1" fill="currentColor" />
                        <path
                          d="M5.5 13.5L8.5 10.5L6.5 7.5L10.5 6.5L12.5 9.5"
                          stroke="currentColor"
                          strokeWidth="2.1"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="mt-0.5 leading-none">Crouch</span>
                    </button>

                    <button
                      type="button"
                      onTouchStart={e => {
                        e.preventDefault();
                        triggerPlayerJump();
                      }}
                      onClick={() => triggerPlayerJump()}
                      className="min-w-[54px] h-11 sm:h-12 px-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white border-2 border-white border-b-4 border-b-sky-700 shadow-lg flex flex-col items-center justify-center font-extrabold text-[10px] transition active:translate-y-0.5 cursor-pointer select-none touch-none whitespace-nowrap"
                      title="Jump"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                        <path
                          d="M8 13V3.5M8 3.5L4 7.5M8 3.5L12 7.5"
                          stroke="currentColor"
                          strokeWidth="2.3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="mt-0.5 leading-none">Jump</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* LAPTOP / DESKTOP MODE: NO TOUCH MOVE OR FIRE ICONS — CLEAN STANCE + KEYBIND DOCK */
              <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2.5 pb-3 sm:pb-4 px-4">
                {matchStatus === 'playing' && (
                  <button
                    type="button"
                    onClick={() => setIsQuestionModalOpen(true)}
                    className={`pointer-events-auto px-4 sm:px-5 py-2.5 rounded-2xl font-extrabold text-xs sm:text-sm shadow-xl border-2 border-b-4 transition flex items-center gap-2.5 cursor-pointer active:translate-y-0.5 whitespace-nowrap ${
                      ammo === 0
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-900 border-amber-500 border-b-amber-600'
                        : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-700 border-b-sky-800'
                    }`}
                    title="Press Q or Click to Answer Questions & Earn Paintballs"
                  >
                    <HelpCircle size={18} className="shrink-0" />
                    <div className="text-left leading-tight">
                      <div className="text-xs sm:text-sm font-['Poppins',sans-serif] font-extrabold">
                        {ammo === 0 ? 'Earn Ammo! [Q]' : 'Questions [Q]'}
                      </div>
                      <div
                        className={`text-[10px] sm:text-xs font-bold tabular-nums ${
                          ammo === 0 ? 'text-slate-800' : 'text-sky-100'
                        }`}
                      >
                        +{ballsPerQuestion} Balls · Ammo: {ammo}
                      </div>
                    </div>
                  </button>
                )}

                <div className="pointer-events-none bg-slate-900/85 text-white border border-white/25 rounded-2xl px-3.5 py-2 shadow-xl flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-bold">
                  <span className="font-mono tabular-nums font-extrabold text-amber-300 whitespace-nowrap">
                    {matchStatus === 'playing' ? `AMMO ${ammo}` : 'WARM-UP'}
                  </span>
                  <span className="text-white/30">|</span>
                  <span
                    className={`font-extrabold uppercase tracking-wide whitespace-nowrap ${
                      playerStance !== 'stand' ? 'text-amber-300' : 'text-sky-300'
                    }`}
                  >
                    {playerStance === 'crawl'
                      ? 'PRONE CRAWL'
                      : playerStance === 'crouch'
                      ? 'CROUCHED'
                      : 'STANDING'}
                    {isAdsScoped ? ' · 2X SCOPE' : ''}
                  </span>
                  <span className="hidden md:inline text-white/30">|</span>
                  <span className="hidden md:inline text-slate-200 whitespace-nowrap">
                    <b className="text-white">WASD</b> Move · <b className="text-white">Mouse</b> Aim ·{' '}
                    <b className="text-white">Click</b> Shoot · <b className="text-white">RMB</b> Scope ·{' '}
                    <b className="text-white">Space</b> Jump · <b className="text-white">C</b> Crouch ·{' '}
                    <b className="text-white">Z</b> Crawl
                  </span>
                </div>
              </div>
            )
          ) : (
            /* HOST COLLAPSIBLE BOTTOM CAMERA DOCK (ZERO VIEWPORT OCCLUSION) */
            <div className="pointer-events-auto w-full max-w-4xl mx-auto flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsLobbyMinimized(prev => !prev)}
                className="mb-1 px-3 py-1 rounded-t-xl bg-white/95 border-2 border-b-0 border-sky-200 text-[11px] font-extrabold text-slate-700 shadow-xs cursor-pointer whitespace-nowrap"
              >
                {isLobbyMinimized
                  ? `▲ Show Player Cameras (${roomPlayers.length})`
                  : '▼ Hide Camera Dock'}
              </button>

              {!isLobbyMinimized && (
                <div className="w-full bg-white/95 p-2.5 sm:p-3 rounded-2xl border-2 border-sky-200 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-slate-800 mb-2">
                    <div className="flex items-center gap-2 tabular-nums">
                      <span>Live Classroom Cameras ({roomPlayers.length})</span>
                      {roomPlayers.length > 0 && hostCameraMode !== 'overview' && (
                        <span className="text-sky-600 font-bold">
                          · Watching {roomPlayers[hostFollowIndex % roomPlayers.length]?.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHostCameraMode('track_one')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition whitespace-nowrap ${
                          hostCameraMode === 'track_one'
                            ? 'bg-sky-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Focus 1 Player
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostCameraMode('auto_track')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition whitespace-nowrap ${
                          hostCameraMode === 'auto_track'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Auto Rotate
                      </button>
                      <button
                        type="button"
                        onClick={() => setHostCameraMode('overview')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer transition whitespace-nowrap ${
                          hostCameraMode === 'overview'
                            ? 'bg-amber-400 text-slate-900'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        Full Arena
                      </button>
                    </div>
                  </div>
                  {roomPlayers.length === 0 ? (
                    <div className="text-xs text-slate-500 font-semibold text-center py-1.5">
                      No students connected yet. Click &quot;Lobby&quot; at the top right to display the QR code.
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
                        const qStats = getPlayerQuestionStats(rp);
                        return (
                          <button
                            key={rp.id}
                            type="button"
                            onClick={() => {
                              setHostCameraMode('track_one');
                              setHostFollowIndex(i);
                            }}
                            className={`shrink-0 px-3 py-1.5 rounded-xl border-2 text-left flex items-center gap-2 cursor-pointer transition ${
                              isWatched
                                ? 'bg-sky-50 border-sky-500 shadow-xs'
                                : `bg-white ${tCfg.borderClass} hover:bg-slate-50`
                            }`}
                          >
                            <HamsterCharacterAvatar
                              skin={HAMSTER_SKINS[rp.skinIdx] || HAMSTER_SKINS[0]}
                              size={26}
                              team={matchMode === 'teams' ? rp.team || 'red' : 'solo'}
                            />
                            <div className="tabular-nums">
                              <div className="font-extrabold text-xs text-slate-900">
                                {rp.name}
                              </div>
                              <div className="text-[10px] font-bold text-slate-500">
                                {rp.kos || 0} KO · {qStats.accuracy}% Quiz
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------
          SCREEN 5: CELEBRATORY PODIUM RESULTS, WINNER ANNOUNCEMENT & QUESTION ACCURACY ANALYTICS
         ------------------------------------------------------------- */}
      {screen === 'results' && (
        <div className="absolute inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto">
          <div className="bg-white border-2 border-sky-200 rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl my-auto text-center text-slate-900 max-h-[93dvh] flex flex-col">
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Grand Stadium Championship Header Banner */}
              {(() => {
                const redWins =
                  teamTotals.red.kos > teamTotals.blue.kos ||
                  (teamTotals.red.kos === teamTotals.blue.kos &&
                    teamTotals.red.score > teamTotals.blue.score) ||
                  (teamTotals.red.kos === teamTotals.blue.kos &&
                    teamTotals.red.score === teamTotals.blue.score &&
                    teamTotals.red.correct > teamTotals.blue.correct);
                const blueWins =
                  teamTotals.blue.kos > teamTotals.red.kos ||
                  (teamTotals.blue.kos === teamTotals.red.kos &&
                    teamTotals.blue.score > teamTotals.red.score) ||
                  (teamTotals.blue.kos === teamTotals.red.kos &&
                    teamTotals.blue.score === teamTotals.red.score &&
                    teamTotals.blue.correct > teamTotals.red.correct);

                const headlineText =
                  matchMode === 'teams'
                    ? redWins
                      ? 'Red Squad Wins!'
                      : blueWins
                      ? 'Blue Squad Wins!'
                      : 'Championship Draw!'
                    : `${finalStandings[0]?.name || playerName || 'Champion'} Wins!`;

                const bannerTheme =
                  matchMode === 'teams'
                    ? redWins
                      ? 'from-rose-600 via-rose-500 to-amber-500 text-white border-rose-300'
                      : blueWins
                      ? 'from-sky-600 via-blue-600 to-indigo-600 text-white border-sky-300'
                      : 'from-slate-800 via-sky-800 to-indigo-900 text-white border-sky-300'
                    : 'from-amber-500 via-orange-500 to-rose-500 text-white border-amber-300';

                return (
                  <div
                    className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 bg-gradient-to-br border-2 shadow-xl ${bannerTheme}`}
                  >
                    {/* Subtle Radial Stadium Spotlight Accent */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-25"
                      style={{
                        background:
                          'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.85) 0%, transparent 65%)'
                      }}
                    />

                    <div className="relative z-10 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 border-2 border-white shadow-lg flex items-center justify-center mb-2">
                        <Trophy size={24} />
                      </div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] opacity-90">
                        Grand Arena Championship
                      </div>
                      <h2 className="font-['Poppins',sans-serif] text-2xl sm:text-4xl font-extrabold tracking-tight mt-0.5 drop-shadow-xs">
                        {headlineText}
                      </h2>

                      {matchMode === 'teams' && (
                        <div className="mt-4 w-full grid grid-cols-2 gap-3 max-w-xl mx-auto tabular-nums">
                          <div
                            className={`bg-white/95 text-slate-900 rounded-2xl p-3 border-2 shadow-sm ${
                              redWins ? 'border-amber-300 ring-2 ring-amber-300/50' : 'border-rose-200'
                            }`}
                          >
                            <div className="text-[11px] font-extrabold text-rose-600 uppercase tracking-wider">
                              Red Squad {redWins ? '· Winner' : ''}
                            </div>
                            <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                              {teamTotals.red.kos} KOs · {teamTotals.red.score} pts
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                              {teamTotals.red.accuracy}% Quiz ({teamTotals.red.correct}✓ ·{' '}
                              {teamTotals.red.wrong}✗)
                            </div>
                          </div>

                          <div
                            className={`bg-white/95 text-slate-900 rounded-2xl p-3 border-2 shadow-sm ${
                              blueWins ? 'border-amber-300 ring-2 ring-amber-300/50' : 'border-sky-200'
                            }`}
                          >
                            <div className="text-[11px] font-extrabold text-sky-600 uppercase tracking-wider">
                              Blue Squad {blueWins ? '· Winner' : ''}
                            </div>
                            <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                              {teamTotals.blue.kos} KOs · {teamTotals.blue.score} pts
                            </div>
                            <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                              {teamTotals.blue.accuracy}% Quiz ({teamTotals.blue.correct}✓ ·{' '}
                              {teamTotals.blue.wrong}✗)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Elevated 3-Tier Championship Podium Stage (Clean Unboxed Typographic Metadata) */}
              {podiumPlayers.length > 0 && (
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4 items-end pt-5 pb-0 px-3 sm:px-6 bg-gradient-to-b from-sky-50/90 via-white to-slate-50 rounded-3xl border-2 border-sky-100 overflow-hidden">
                  {[1, 0, 2].map(rankIdx => {
                    const p = podiumPlayers[rankIdx];
                    if (!p) {
                      return <div key={`empty-${rankIdx}`} className="h-28" />;
                    }
                    const isFirst = rankIdx === 0;
                    const rankNum = rankIdx + 1;
                    const skin =
                      HAMSTER_SKINS[p.skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
                    const qStats = getPlayerQuestionStats(p);
                    return (
                      <div key={p.id} className="flex flex-col items-center justify-end">
                        <div className="relative mb-1">
                          {isFirst && (
                            <div className="mx-auto mb-1 w-7 h-7 rounded-full bg-amber-400 text-slate-950 border-2 border-white shadow-sm flex items-center justify-center">
                              <Award size={15} />
                            </div>
                          )}
                          <HamsterCharacterAvatar
                            skin={skin}
                            size={isFirst ? 92 : 70}
                            team={matchMode === 'teams' ? p.team || 'red' : 'solo'}
                          />
                        </div>

                        <div className="font-['Poppins',sans-serif] font-extrabold text-xs sm:text-base text-slate-900 truncate max-w-full">
                          {p.name}
                        </div>
                        <div className="text-[11px] sm:text-xs font-extrabold text-slate-700 tabular-nums">
                          {p.kos || 0} KOs · {p.score || 0} pts
                        </div>
                        <div className="text-[10px] sm:text-[11px] font-semibold text-slate-500 tabular-nums mb-2">
                          {qStats.accuracy}% Quiz ·{' '}
                          <span className="text-emerald-700 font-bold">{qStats.correct}✓</span>{' '}
                          <span className="text-rose-600 font-bold">{qStats.wrong}✗</span>
                        </div>

                        <div
                          className={`w-full rounded-t-2xl font-['Poppins',sans-serif] font-extrabold flex flex-col items-center justify-center shadow-md ${
                            isFirst
                              ? 'h-16 sm:h-20 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 text-xl sm:text-2xl border-2 border-b-0 border-amber-500'
                              : rankNum === 2
                              ? 'h-12 sm:h-14 bg-gradient-to-b from-sky-400 to-sky-600 text-white text-base sm:text-lg border-2 border-b-0 border-sky-600'
                              : 'h-10 sm:h-11 bg-gradient-to-b from-rose-400 to-rose-600 text-white text-sm sm:text-base border-2 border-b-0 border-rose-600'
                          }`}
                        >
                          <span>#{rankNum}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 4-Column Match Honors & Class Accuracy Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left tabular-nums">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-wider">
                    Class Accuracy
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {classAccuracySummary.avgAccuracy}%
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">
                    {classAccuracySummary.totalCorrect}✓ · {classAccuracySummary.totalWrong}✗
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-extrabold text-rose-600 uppercase tracking-wider">
                    Top Eliminations
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                    {mvpAwards.topKiller ? mvpAwards.topKiller.name : '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">
                    {mvpAwards.topKiller ? `${mvpAwards.topKiller.kos || 0} KOs` : '0 KOs'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">
                    Top Quiz Whiz
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                    {mvpAwards.bestAccuracy ? mvpAwards.bestAccuracy.player.name : '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">
                    {mvpAwards.bestAccuracy
                      ? `${mvpAwards.bestAccuracy.accuracy}% (${mvpAwards.bestAccuracy.correct}✓/${mvpAwards.bestAccuracy.wrong}✗)`
                      : 'No Answers'}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
                    Best Streak
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
                    {mvpAwards.bestStreak ? mvpAwards.bestStreak.name : '—'}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">
                    {mvpAwards.bestStreak ? `${mvpAwards.bestStreak.bestStreak || 0}x Streak` : '0x'}
                  </div>
                </div>
              </div>

              {/* Per-Player Question Accuracy & Match Standings Table */}
              <div className="bg-slate-50 rounded-2xl p-3 sm:p-3.5 border border-slate-200 text-left space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-slate-800">
                    Player Question Accuracy &amp; Standings ({finalStandings.length})
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Correct · Wrong · Accuracy
                  </span>
                </div>

                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {finalStandings.map((rp, i) => {
                    const qStats = getPlayerQuestionStats(rp);
                    const charSkin =
                      HAMSTER_SKINS[rp.skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0];
                    return (
                      <div
                        key={rp.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs gap-2 tabular-nums shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-lg font-extrabold flex items-center justify-center shrink-0 ${
                              i === 0
                                ? 'bg-amber-400 text-slate-950'
                                : i === 1
                                ? 'bg-sky-100 text-sky-800'
                                : i === 2
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <HamsterCharacterAvatar
                            skin={charSkin}
                            size={34}
                            team={matchMode === 'teams' ? rp.team || 'red' : 'solo'}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-900 font-extrabold truncate">
                                {rp.name}
                              </span>
                              {matchMode === 'teams' && (
                                <span
                                  className={`text-[10px] font-extrabold shrink-0 ${
                                    rp.team === 'blue' ? 'text-sky-600' : 'text-rose-600'
                                  }`}
                                >
                                  · {rp.team === 'blue' ? 'Blue' : 'Red'}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-500">
                              {rp.kos || 0} KOs · {rp.score || 0} pts · {qStats.total} Qs Answered
                            </div>
                          </div>
                        </div>

                        {/* Clean Tabular Accuracy Readout + Dual-Color Progress Bar */}
                        <div className="flex flex-col sm:items-end gap-1 shrink-0">
                          <div className="flex items-center gap-2.5 text-[11px] font-extrabold">
                            <span className="text-emerald-700">✓ {qStats.correct} Correct</span>
                            <span className="text-rose-600">✗ {qStats.wrong} Wrong</span>
                            <span className="text-slate-900 font-mono">{qStats.accuracy}%</span>
                          </div>
                          <div className="w-full sm:w-44 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${qStats.accuracy}%` }}
                            />
                            {qStats.wrong > 0 && (
                              <div
                                className="h-full bg-rose-400 transition-all duration-300"
                                style={{ width: `${Math.max(0, 100 - qStats.accuracy)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: Play Again (Same Room) or Back to Classroom Lobby */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {role === 'host' && (
                  <button
                    type="button"
                    onClick={handleStartMultiplayerMatch}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:translate-y-0.5 text-white font-['Poppins',sans-serif] font-extrabold text-sm rounded-2xl border-2 border-emerald-600 border-b-4 border-b-emerald-700 shadow-md cursor-pointer whitespace-nowrap"
                  >
                    Play Again (Same Room)
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMatchStatus('lobby');
                    if (role === 'host') {
                      setScreen('lobby');
                      if (roomCode) {
                        const lobbyPatch = { matchStatus: 'lobby', updatedAt: getServerNow() };
                        syncPaintballRoomApi(roomCode, lobbyPatch);
                        setDoc(getRoomDocRef(roomCode), lobbyPatch, { merge: true }).catch(() => {});
                      }
                    } else {
                      setScreen('game');
                    }
                  }}
                  className={`w-full py-3 bg-sky-600 hover:bg-sky-500 active:translate-y-0.5 text-white font-['Poppins',sans-serif] font-extrabold text-sm rounded-2xl border-2 border-sky-700 border-b-4 border-b-sky-800 shadow-md cursor-pointer whitespace-nowrap ${
                    role !== 'host' ? 'sm:col-span-2' : ''
                  }`}
                >
                  {role === 'host' ? 'Back to Classroom Lobby' : 'Return to Warm-Up Park'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          BRIGHT ESL GAME STUDIO LIVE TRIVIA OVERLAY (`matchStatus === 'playing'`)
         ------------------------------------------------------------- */}
      {isQuestionModalOpen && matchStatus === 'playing' && currentTriviaQ && (
        <div className="fixed inset-0 z-50 w-full h-full bg-gradient-to-b from-sky-100 via-sky-50 to-white text-slate-900 flex flex-col justify-between overflow-y-auto">
          {/* Bright Arcade Quiz Header */}
          <div className="bg-white px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-2 shrink-0 border-b-2 border-sky-200 shadow-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-sky-600 shrink-0" />
                <h3 className="font-['Poppins',sans-serif] font-extrabold text-sm sm:text-lg text-slate-900 leading-none truncate">
                  Answer to Earn +{ballsPerQuestion} Paintballs
                </h3>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-1 truncate tabular-nums">
                Question {(triviaDeckIndex % effectiveQuestions.length) + 1} of{' '}
                {effectiveQuestions.length} · Streak: {triviaStreak}x · Current Ammo: {ammo}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div
                className={`px-3 py-1.5 rounded-xl font-mono tabular-nums font-extrabold text-xs sm:text-sm flex items-center gap-1.5 border-2 ${
                  questionTimeLeft <= 5
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : questionTimeLeft >= 10
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}
              >
                <Clock size={14} />
                <span>{questionTimeLeft}s</span>
              </div>

              <button
                type="button"
                onClick={() => setIsQuestionModalOpen(false)}
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-extrabold text-xs sm:text-sm border-b-3 border-emerald-700 shadow-sm cursor-pointer whitespace-nowrap tabular-nums"
              >
                Back to Arena ({ammo})
              </button>
            </div>
          </div>

          {/* 15-Second Question Timer Bar */}
          <div className="w-full h-2 bg-sky-100 shrink-0 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                questionTimeLeft <= 5
                  ? 'bg-rose-500'
                  : questionTimeLeft >= 10
                  ? 'bg-emerald-500'
                  : 'bg-amber-400'
              }`}
              style={{
                width: `${Math.max(0, (questionTimeLeft / QUESTION_TIME_LIMIT_SEC) * 100)}%`
              }}
            />
          </div>

          {/* Question Card & 2x2 Color-Coded Arcade Answer Buttons */}
          {(() => {
            const parsedQuestion = parseOptionContent(currentTriviaQ.text || '');
            const displayQText = parsedQuestion.text || currentTriviaQ.text;
            const displayQImage = currentTriviaQ.image || parsedQuestion.imageUrl;
            const correctIdx =
              typeof currentTriviaQ.answerIndex === 'number' ? currentTriviaQ.answerIndex : 0;

            const optionBadgeStyles = [
              'bg-rose-500 text-white',
              'bg-amber-500 text-white',
              'bg-sky-500 text-white',
              'bg-violet-500 text-white',
              'bg-emerald-500 text-white',
              'bg-pink-500 text-white'
            ];

            return (
              <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-6 flex flex-col justify-between gap-4 overflow-y-auto">
                <div className="bg-white border-2 border-sky-200 rounded-3xl p-5 sm:p-7 flex flex-col items-center justify-center text-center shadow-lg my-auto">
                  {displayQImage && (
                    <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 max-h-44 sm:max-h-56 flex items-center justify-center">
                      <img
                        src={displayQImage}
                        alt={displayQText || 'Question'}
                        referrerPolicy="no-referrer"
                        className="max-h-44 sm:max-h-56 w-auto object-contain"
                      />
                    </div>
                  )}
                  <h2 className="font-['Poppins',sans-serif] font-extrabold text-xl sm:text-3xl md:text-4xl text-slate-900 leading-snug max-w-3xl">
                    {displayQText}
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-auto">
                  {currentTriviaQ.options.map((opt, idx) => {
                    const parsed = parseOptionContent(opt);
                    const isAnswered = selectedOptionIdx !== null;
                    const isThisSelected = selectedOptionIdx === idx;
                    const isThisCorrect = idx === correctIdx;

                    let btnClasses =
                      'bg-white hover:bg-sky-50 border-sky-200 hover:border-sky-400 border-b-4 border-b-sky-300 text-slate-900';
                    if (isAnswered) {
                      if (isThisCorrect) {
                        btnClasses =
                          'bg-emerald-500 border-emerald-600 border-b-4 border-b-emerald-700 text-white shadow-lg';
                      } else if (isThisSelected) {
                        btnClasses =
                          'bg-rose-500 border-rose-600 border-b-4 border-b-rose-700 text-white';
                      } else {
                        btnClasses = 'bg-slate-100 border-slate-200 text-slate-400 opacity-75';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswered}
                        onClick={() => handleTriviaAnswer(idx)}
                        className={`p-4 sm:p-5 rounded-2xl border-2 font-bold text-base sm:text-xl text-left transition shadow-sm cursor-pointer active:translate-y-0.5 flex items-center gap-3.5 ${btnClasses}`}
                      >
                        <span
                          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-['Poppins',sans-serif] font-extrabold text-base sm:text-lg shrink-0 ${
                            isAnswered && (isThisCorrect || isThisSelected)
                              ? 'bg-white/25 text-white'
                              : optionBadgeStyles[idx % optionBadgeStyles.length]
                          }`}
                        >
                          {OPTION_LETTERS[idx]}
                        </span>
                        {parsed.imageUrl && (
                          <img
                            src={parsed.imageUrl}
                            alt={parsed.text || 'Option'}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        )}
                        <span className="flex-1 leading-snug">{parsed.text || opt}</span>
                      </button>
                    );
                  })}
                </div>

                {triviaFeedback && (
                  <div
                    className={`p-3.5 text-white font-extrabold text-center text-sm sm:text-base rounded-2xl shadow-md ${
                      selectedOptionIdx === correctIdx ? 'bg-emerald-500' : 'bg-rose-500'
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
          HOST LIVE SCOREBOARD MODAL (BRIGHT CLASSROOM CARD)
         ------------------------------------------------------------- */}
      {isLeaderboardOpen && (
        <div className="absolute inset-0 z-50 bg-slate-900/55 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-2 border-sky-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-auto text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="text-amber-500" size={20} />
                <h3 className="font-['Poppins',sans-serif] font-extrabold text-base sm:text-lg text-slate-900">
                  Live Classroom Scoreboard
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLeaderboardOpen(false)}
                className="text-xs font-extrabold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            {matchMode === 'teams' && (
              <div className="grid grid-cols-2 gap-3 tabular-nums">
                <div className="p-3 rounded-2xl bg-rose-50 border-2 border-rose-200 text-center">
                  <div className="text-xs font-extrabold text-rose-600">Red Squad</div>
                  <div className="text-2xl font-extrabold text-slate-900">{teamTotals.red.kos} Kills</div>
                  <div className="text-[11px] font-semibold text-slate-500">{teamTotals.red.count} Players</div>
                </div>
                <div className="p-3 rounded-2xl bg-sky-50 border-2 border-sky-200 text-center">
                  <div className="text-xs font-extrabold text-sky-600">Blue Squad</div>
                  <div className="text-2xl font-extrabold text-slate-900">{teamTotals.blue.kos} Kills</div>
                  <div className="text-[11px] font-semibold text-slate-500">{teamTotals.blue.count} Players</div>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {finalStandings.length === 0 ? (
                <div className="text-xs text-slate-500 font-semibold text-center py-4">
                  No students connected yet. Room Code: <strong className="font-mono">{roomCode}</strong>
                </div>
              ) : (
                finalStandings.map((rp, idx) => {
                  const qStats = getPlayerQuestionStats(rp);
                  return (
                    <div
                      key={rp.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 tabular-nums gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 font-extrabold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <HamsterCharacterAvatar
                          skin={HAMSTER_SKINS[rp.skinIdx % HAMSTER_SKINS.length] || HAMSTER_SKINS[0]}
                          size={28}
                          team={matchMode === 'teams' ? rp.team || 'red' : 'solo'}
                        />
                        <span className="font-extrabold truncate">{rp.name}</span>
                        {matchMode === 'teams' && (
                          <span className="text-[11px] text-slate-500 shrink-0">
                            · {rp.team === 'blue' ? 'Blue' : 'Red'}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-extrabold text-slate-900">
                          {rp.kos || 0} KOs · {rp.score || 0} pts
                        </div>
                        <div className="flex items-center justify-end gap-1 mt-0.5 text-[10px]">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold">
                            ✓ {qStats.correct}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold">
                            ✗ {qStats.wrong}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-extrabold">
                            {qStats.accuracy}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
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
          <div className="fixed inset-0 bg-slate-900/65 flex items-center justify-center z-[9999] p-4">
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
          <div className="fixed inset-0 bg-slate-900/65 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
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
