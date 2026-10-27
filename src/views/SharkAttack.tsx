import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Users,
  Play,
  ClipboardList,
  Image as ImageIcon,
  Info,
  Shuffle,
  Type,
  Edit3,
  Clock,
  Pause,
  RotateCcw,
  Check,
} from 'lucide-react';
import { ViewState } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { FullscreenButton } from '../components/FullscreenButton';
import { GameModeModal } from '../components/GameModeModal';
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from '../components/SetupSmartControls';
import { parseOptionContent, formatOptionContent, AnswerContentMode } from '../utils/mediaAndPresets';

// ============================================================================
// HELPER: STRIP CONFUSING A. / B. / C. / D. PREFIXES FROM OPTION TEXT
// ============================================================================
const stripOptionPrefix = (text: string): string => {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('http') || trimmed.startsWith('data:image')) return trimmed;
  return trimmed.replace(/^(?:[a-fA-F1-6][\.\)\:\-]|\([a-fA-F1-6]\))\s+/, '').trim();
};

// ============================================================================
// UPGRADED ARCADE AUDIO ENGINE (Round Win, Step Up Loss, Falling Whistle, Chomp & Victory Fanfare)
// ============================================================================
let sharedAudioCtx: AudioContext | null = null;
let soundMutedGlobal = false;

const playSFX = (
  type:
    | 'roundWin'
    | 'stepDanger'
    | 'splash'
    | 'stun'
    | 'freeze'
    | 'fallWhistle'
    | 'chomp'
    | 'win'
    | 'clack'
) => {
  if (soundMutedGlobal) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (type === 'roundWin') {
      // Bright celebratory 4-note arcade chime + harmonic sparkle
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        sub.type = 'sine';
        const t = now + i * 0.055;
        osc.frequency.setValueAtTime(freq, t);
        sub.frequency.setValueAtTime(freq * 1.5, t);
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        sub.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        sub.start(t);
        osc.stop(t + 0.24);
        sub.stop(t + 0.24);
      });
    } else if (type === 'stepDanger') {
      // Dramatic danger horn + wooden step thud when loser climbs closer to shark
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(310, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(145, now + 0.34);
      gain.gain.setValueAtTime(0.26, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + 0.06);
      osc.stop(now + 0.36);

      // Step plank thump
      const thud = ctx.createOscillator();
      const tGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(140, now);
      thud.frequency.exponentialRampToValueAtTime(48, now + 0.14);
      tGain.gain.setValueAtTime(0.32, now);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      thud.connect(tGain);
      tGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.14);
    } else if (type === 'splash') {
      const bufferSize = Math.floor(ctx.sampleRate * 0.32);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.1));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.3);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.32, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
    } else if (type === 'clack') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(760, now);
      osc.frequency.exponentialRampToValueAtTime(340, now + 0.08);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'stun') {
      // Dual-oscillator wrong answer buzzer
      [0, 1].forEach((idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx === 0 ? 185 : 173, now);
        osc.frequency.linearRampToValueAtTime(idx === 0 ? 110 : 98, now + 0.28);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      });
    } else if (type === 'freeze') {
      const freqs = [980, 1320, 1760];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        gain.gain.setValueAtTime(0.16, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.22);
      });
    } else if (type === 'fallWhistle') {
      // Classic cartoon falling whistle as hamster plunges off the top edge
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1180, now);
      osc.frequency.exponentialRampToValueAtTime(195, now + 0.55);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    } else if (type === 'chomp') {
      // Massive shark jaw snap + deep bass impact + water splash burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.42);
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);

      // Crunch & splash burst
      const bufferSize = Math.floor(ctx.sampleRate * 0.45);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.38, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
    } else if (type === 'win') {
      // Full championship victory fanfare
      const melody = [
        { f: 523.25, t: 0, d: 0.14 },
        { f: 523.25, t: 0.15, d: 0.14 },
        { f: 523.25, t: 0.3, d: 0.14 },
        { f: 659.25, t: 0.46, d: 0.28 },
        { f: 783.99, t: 0.76, d: 0.24 },
        { f: 1046.5, t: 1.02, d: 0.65 },
      ];
      melody.forEach((n) => {
        const osc = ctx.createOscillator();
        const harm = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        harm.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        harm.frequency.setValueAtTime(n.f * 0.5, now + n.t);
        gain.gain.setValueAtTime(0.28, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.008, now + n.t + n.d);
        osc.connect(gain);
        harm.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        harm.start(now + n.t);
        osc.stop(now + n.t + n.d);
        harm.stop(now + n.t + n.d);
      });
    }
  } catch (e) {
    console.error('Audio playback failed', e);
  }
};

// ============================================================================
// CUTE HAMSTER ROSTER & SVG COMPONENT
// ============================================================================
export type HamsterCharacterType = 'mochi' | 'ichigo' | 'captain' | 'boba' | 'yuki' | 'oreo';

export interface HamsterCharacterOption {
  id: HamsterCharacterType;
  name: string;
  title: string;
}

export const HAMSTER_CHARACTER_OPTIONS: HamsterCharacterOption[] = [
  { id: 'mochi', name: 'Mochi Hamster', title: 'Golden Cheeky Puff' },
  { id: 'ichigo', name: 'Ichigo Hamster', title: 'Strawberry Puff' },
  { id: 'captain', name: 'Captain Pip', title: 'Sailor Hamster' },
  { id: 'boba', name: 'Boba Hamster', title: 'Milk Tea Pearl' },
  { id: 'yuki', name: 'Yuki Hamster', title: 'Snow Marshmallow' },
  { id: 'oreo', name: 'Oreo Hamster', title: 'Cookies & Cream' },
];

export interface CuteHamsterCharacterProps {
  team: 'left' | 'right';
  character?: HamsterCharacterType;
  isPushing?: boolean;
  isClimbing?: boolean;
  isDangerEdge?: boolean;
  isStunned?: boolean;
  isFrozen?: boolean;
  hasLost?: boolean;
  isWinner?: boolean;
  compact?: boolean;
  size?: 'icon' | 'card' | 'compact' | 'normal';
  className?: string;
}

export const CuteHamsterCharacter: React.FC<CuteHamsterCharacterProps> = ({
  team,
  character = 'mochi',
  isPushing = false,
  isClimbing = false,
  isDangerEdge = false,
  isStunned = false,
  isFrozen = false,
  hasLost = false,
  isWinner = false,
  compact = false,
  size,
  className = '',
}) => {
  const isLeft = team === 'left';
  const teamMain = isLeft ? '#0055fe' : '#dc2626';
  const teamDark = isLeft ? '#1e3a8a' : '#7f1d1d';

  const palettes: Record<
    HamsterCharacterType,
    {
      furTop: string;
      furBase: string;
      furStroke: string;
      belly: string;
      earOuter: string;
      earInner: string;
      cheek: string;
      headPatch?: string;
    }
  > = {
    mochi: {
      furTop: '#fbbf24',
      furBase: '#f59e0b',
      furStroke: '#92400e',
      belly: '#fffbeb',
      earOuter: '#d97706',
      earInner: '#fda4af',
      cheek: '#fb7185',
      headPatch: '#d97706',
    },
    ichigo: {
      furTop: '#f9a8d4',
      furBase: '#f472b6',
      furStroke: '#9d174d',
      belly: '#fff1f2',
      earOuter: '#ec4899',
      earInner: '#fecdd3',
      cheek: '#f43f5e',
      headPatch: '#ec4899',
    },
    captain: {
      furTop: '#fdba74',
      furBase: '#ea580c',
      furStroke: '#7c2d12',
      belly: '#ffffff',
      earOuter: '#c2410c',
      earInner: '#fda4af',
      cheek: '#fb7185',
      headPatch: '#c2410c',
    },
    boba: {
      furTop: '#e6ccb2',
      furBase: '#c89f7c',
      furStroke: '#582f0e',
      belly: '#fdf8f5',
      earOuter: '#7f4f24',
      earInner: '#f4a261',
      cheek: '#f28482',
      headPatch: '#7f4f24',
    },
    yuki: {
      furTop: '#ffffff',
      furBase: '#e2e8f0',
      furStroke: '#475569',
      belly: '#ffffff',
      earOuter: '#93c5fd',
      earInner: '#fbcfe8',
      cheek: '#f472b6',
      headPatch: '#bae6fd',
    },
    oreo: {
      furTop: '#475569',
      furBase: '#1e293b',
      furStroke: '#0f172a',
      belly: '#f8fafc',
      earOuter: '#0f172a',
      earInner: '#fda4af',
      cheek: '#fb7185',
      headPatch: '#0f172a',
    },
  };

  const pal = palettes[character] || palettes.mochi;
  const resolvedSize = size || (compact ? 'compact' : 'normal');
  const uid = `${team}-${character}-${resolvedSize}`;

  const sizeClasses =
    resolvedSize === 'icon'
      ? 'w-[34px] h-[34px] sm:w-[42px] sm:h-[42px]'
      : resolvedSize === 'card'
        ? 'w-[70px] h-[70px] sm:w-[84px] sm:h-[84px] md:w-[96px] md:h-[96px]'
        : resolvedSize === 'compact'
          ? 'w-[100px] h-[100px] sm:w-[122px] sm:h-[122px] md:w-[140px] md:h-[140px]'
          : 'w-[74px] h-[74px] sm:w-[90px] sm:h-[90px] md:w-[104px] md:h-[104px] lg:w-[116px] lg:h-[116px]';

  const isPanic = isClimbing || isDangerEdge || hasLost;

  return (
    <div
      className={`relative z-20 ${sizeClasses} transition-all duration-300 ease-out select-none ${className}`}
      style={{
        transform: `${!isLeft ? 'scaleX(-1)' : 'scaleX(1)'} ${
          isPushing
            ? 'translateY(-14px) scale(1.1)'
            : isClimbing
              ? 'translateY(-14px) scale(1.06)'
              : ''
        }`,
      }}
    >
      <svg viewBox="0 0 140 140" className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={`ham-fur-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.furTop} />
            <stop offset="100%" stopColor={pal.furBase} />
          </linearGradient>
        </defs>

        {/* Ground Shadow */}
        {!hasLost && <ellipse cx="70" cy="126" rx="38" ry="8" fill="rgba(15, 23, 42, 0.32)" />}

        {/* Round Win Celebration Glow & Sparkles */}
        {(isPushing || isWinner) && (
          <g>
            <circle
              cx="70"
              cy="72"
              r="58"
              fill="rgba(250, 204, 21, 0.22)"
              stroke="#fde047"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <polygon
              points="16,32 19,40 27,40 21,45 23,53 16,48 9,53 11,45 5,40 13,40"
              fill="#facc15"
              stroke="#ca8a04"
              strokeWidth="1.2"
            />
            <polygon
              points="124,28 126,35 133,35 128,39 130,46 124,42 118,46 120,39 115,35 122,35"
              fill="#4ade80"
              stroke="#15803d"
              strokeWidth="1.2"
            />
          </g>
        )}

        {/* Round Stubby Hamster Tail */}
        <circle cx="34" cy="102" r="7.5" fill={pal.belly} stroke={pal.furStroke} strokeWidth="2.5" />

        {/* Cute Stubby Feet */}
        <ellipse
          cx="50"
          cy="120"
          rx="12"
          ry="6.5"
          fill="#fde2e4"
          stroke={pal.furStroke}
          strokeWidth="2.4"
          transform={isPanic ? 'rotate(-18 50 120)' : ''}
        />
        <ellipse
          cx="90"
          cy="120"
          rx="12"
          ry="6.5"
          fill="#fde2e4"
          stroke={pal.furStroke}
          strokeWidth="2.4"
          transform={isPanic ? 'rotate(18 90 120)' : ''}
        />

        {/* Round Hamster Ears */}
        <g transform={isPanic ? 'translate(0, -3)' : ''}>
          <circle cx="38" cy="34" r="15" fill={pal.earOuter} stroke={pal.furStroke} strokeWidth="2.8" />
          <circle cx="38" cy="35" r="8.5" fill={pal.earInner} />
          <circle cx="102" cy="34" r="15" fill={pal.earOuter} stroke={pal.furStroke} strokeWidth="2.8" />
          <circle cx="102" cy="35" r="8.5" fill={pal.earInner} />
        </g>

        {/* Chubby Potato/Mochi Hamster Body & Giant Cheeks */}
        <path
          d="M 34 56 C 22 74, 22 118, 70 120 C 118 118, 118 74, 106 56 C 98 32, 42 32, 34 56 Z"
          fill={`url(#ham-fur-${uid})`}
          stroke={pal.furStroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Head Fur Forehead Patch */}
        {pal.headPatch && (
          <path
            d="M 44 40 Q 70 62 96 40 Q 84 32 70 32 Q 56 32 44 40 Z"
            fill={pal.headPatch}
            opacity="0.85"
          />
        )}

        {/* Creamy White Belly & Lower Cheek Mask */}
        <path
          d="M 28 74 Q 44 62 70 66 Q 96 62 112 74 C 116 98, 102 119, 70 119 C 38 119, 24 98, 28 74 Z"
          fill={pal.belly}
        />

        {/* Puffy Chubby Cheeks */}
        <ellipse cx="35" cy="76" rx="14" ry="11" fill={pal.belly} />
        <ellipse cx="105" cy="76" rx="14" ry="11" fill={pal.belly} />
        <ellipse cx="38" cy="75" rx="7.5" ry="4.8" fill={pal.cheek} opacity="0.68" />
        <ellipse cx="102" cy="75" rx="7.5" ry="4.8" fill={pal.cheek} opacity="0.68" />

        {/* Team Bandana / Collar Scarf */}
        <path
          d="M 38 88 Q 70 100 102 88 L 96 97 Q 70 107 44 97 Z"
          fill={teamMain}
          stroke={teamDark}
          strokeWidth="2"
        />
        <polygon points="70,96 63,108 77,108" fill={teamMain} stroke={teamDark} strokeWidth="1.8" />
        <circle cx="70" cy="96" r="3.5" fill="#fbbf24" />

        {/* Character-Specific Hats & Accessories */}
        {character === 'mochi' && (
          <g>
            <path d="M 70 33 Q 70 20 78 16" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="81" cy="16" rx="7" ry="4" transform="rotate(-20 81 16)" fill="#4ade80" stroke="#15803d" strokeWidth="1.8" />
            <ellipse cx="64" cy="19" rx="6" ry="3.5" transform="rotate(25 64 19)" fill="#22c55e" stroke="#15803d" strokeWidth="1.8" />
          </g>
        )}
        {character === 'ichigo' && (
          <g>
            <ellipse cx="70" cy="30" rx="22" ry="10" fill="#f43f5e" stroke="#9f1239" strokeWidth="2.2" />
            <circle cx="62" cy="29" r="1.4" fill="#fef08a" />
            <circle cx="70" cy="32" r="1.4" fill="#fef08a" />
            <circle cx="78" cy="29" r="1.4" fill="#fef08a" />
            <path d="M 64 21 L 70 24 L 76 21 M 70 16 L 70 24" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
          </g>
        )}
        {character === 'captain' && (
          <g>
            <ellipse cx="70" cy="29" rx="23" ry="9" fill="#ffffff" stroke="#1e3a8a" strokeWidth="2.4" />
            <path d="M 49 32 Q 70 37 91 32 L 90 36 Q 70 41 50 36 Z" fill="#0284c7" />
            <circle cx="70" cy="27" r="3.5" fill="#fbbf24" stroke="#b45309" strokeWidth="1.2" />
          </g>
        )}
        {character === 'boba' && (
          <g>
            <circle cx="70" cy="31" r="4.5" fill="#451a03" />
            <ellipse cx="61" cy="31" rx="7" ry="4.5" fill="#f472b6" stroke="#9d174d" strokeWidth="1.8" />
            <ellipse cx="79" cy="31" rx="7" ry="4.5" fill="#f472b6" stroke="#9d174d" strokeWidth="1.8" />
          </g>
        )}
        {character === 'yuki' && (
          <g>
            <polygon
              points="56,33 59,19 66,27 70,17 74,27 81,19 84,33"
              fill="#facc15"
              stroke="#b45309"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle cx="70" cy="27" r="2.2" fill="#38bdf8" />
          </g>
        )}
        {character === 'oreo' && (
          <g>
            <polygon
              points="70,17 73,24 80,24 74,28 76,35 70,31 64,35 66,28 60,24 67,24"
              fill="#fbbf24"
              stroke="#b45309"
              strokeWidth="1.6"
            />
          </g>
        )}

        {/* Expressive Eyes, Nose, Whiskers & Mouth */}
        {isStunned ? (
          <g stroke="#0f172a" strokeWidth="2.8" strokeLinecap="round">
            <path d="M 48 56 L 56 64 M 56 56 L 48 64" />
            <path d="M 84 56 L 92 64 M 92 56 L 84 64" />
            <circle cx="70" cy="73" r="4" fill="#fb7185" />
          </g>
        ) : isPanic ? (
          <g>
            <circle cx="52" cy="60" r="8" fill="#ffffff" stroke="#0f172a" strokeWidth="2.4" />
            <circle cx="52" cy="60" r="3" fill="#0f172a" />
            <circle cx="88" cy="60" r="8" fill="#ffffff" stroke="#0f172a" strokeWidth="2.4" />
            <circle cx="88" cy="60" r="3" fill="#0f172a" />
            <ellipse cx="70" cy="66" rx="3.2" ry="2.2" fill="#fb7185" />
            <ellipse cx="70" cy="76" rx="7" ry="8.5" fill="#9f1239" stroke="#0f172a" strokeWidth="2" />
            <rect x="67.5" y="68" width="5" height="3.8" rx="1" fill="#ffffff" />
            {/* Flying panic sweat drops */}
            <path d="M 18 44 Q 13 53 18 57 Q 23 53 18 44 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
            <path d="M 122 44 Q 117 53 122 57 Q 127 53 122 44 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
          </g>
        ) : isPushing || isWinner ? (
          <g>
            {/* Happy cheering eyes ^ ^ */}
            <path d="M 45 61 Q 52 52 59 61" fill="none" stroke="#1e1b4b" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M 81 61 Q 88 52 95 61" fill="none" stroke="#1e1b4b" strokeWidth="3.4" strokeLinecap="round" />
            <ellipse cx="70" cy="66" rx="3.5" ry="2.4" fill="#f43f5e" />
            <path d="M 60 70 Q 70 82 80 70 Z" fill="#fb7185" stroke={pal.furStroke} strokeWidth="2" />
            <rect x="67.5" y="70" width="5" height="4" rx="1" fill="#ffffff" />
          </g>
        ) : (
          <g>
            <circle cx="52" cy="60" r="7.2" fill="#1e1b4b" />
            <circle cx="49.5" cy="57.5" r="2.8" fill="#ffffff" />
            <circle cx="54.5" cy="62.5" r="1.3" fill="#ffffff" />

            <circle cx="88" cy="60" r="7.2" fill="#1e1b4b" />
            <circle cx="85.5" cy="57.5" r="2.8" fill="#ffffff" />
            <circle cx="90.5" cy="62.5" r="1.3" fill="#ffffff" />

            <ellipse cx="70" cy="66" rx="3.5" ry="2.4" fill="#f43f5e" />

            <rect
              x="67.5"
              y="70.5"
              width="5"
              height="4.8"
              rx="1.2"
              fill="#ffffff"
              stroke={pal.furStroke}
              strokeWidth="1.4"
            />
            <path
              d="M 61 70 Q 65.5 75 70 70 Q 74.5 75 79 70"
              fill="none"
              stroke={pal.furStroke}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
        )}

        {/* Cute Whiskers */}
        <g stroke={pal.furStroke} strokeWidth="1.8" strokeLinecap="round" opacity="0.65">
          <line x1="18" y1="69" x2="31" y2="71" />
          <line x1="17" y1="76" x2="30" y2="76" />
          <line x1="122" y1="69" x2="109" y2="71" />
          <line x1="123" y1="76" x2="110" y2="76" />
        </g>

        {/* Little Hamster Paws */}
        {isWinner || isPushing || isPanic ? (
          <g>
            <ellipse
              cx="30"
              cy="82"
              rx="9"
              ry="6"
              transform="rotate(-40 30 82)"
              fill="#fde2e4"
              stroke={pal.furStroke}
              strokeWidth="2.2"
            />
            <ellipse
              cx="110"
              cy="82"
              rx="9"
              ry="6"
              transform="rotate(40 110 82)"
              fill="#fde2e4"
              stroke={pal.furStroke}
              strokeWidth="2.2"
            />
          </g>
        ) : (
          <g>
            <ellipse
              cx="53"
              cy="98"
              rx="8.5"
              ry="5.5"
              transform="rotate(18 53 98)"
              fill="#fde2e4"
              stroke={pal.furStroke}
              strokeWidth="2.2"
            />
            <ellipse
              cx="87"
              cy="98"
              rx="8.5"
              ry="5.5"
              transform="rotate(-18 87 98)"
              fill="#fde2e4"
              stroke={pal.furStroke}
              strokeWidth="2.2"
            />
            {character === 'mochi' && (
              <ellipse
                cx="70"
                cy="99"
                rx="5"
                ry="7.5"
                fill="#451a03"
                stroke="#fef3c7"
                strokeWidth="1.5"
              />
            )}
          </g>
        )}

        {/* Frozen Ice Cube Effect */}
        {isFrozen && (
          <g>
            <rect
              x="16"
              y="14"
              width="108"
              height="114"
              rx="20"
              fill="rgba(125, 211, 252, 0.52)"
              stroke="#e0f2fe"
              strokeWidth="4"
            />
            <line x1="30" y1="30" x2="55" y2="55" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
            <line x1="90" y1="80" x2="112" y2="105" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
          </g>
        )}
      </svg>
    </div>
  );
};

// ============================================================================
// IN-GAME HAMSTER PICKER MODAL
// ============================================================================
export const HamsterCharacterPickerModal: React.FC<{
  isOpen: boolean;
  leftCharacter: HamsterCharacterType;
  rightCharacter: HamsterCharacterType;
  onSelectLeft: (c: HamsterCharacterType) => void;
  onSelectRight: (c: HamsterCharacterType) => void;
  onClose: () => void;
}> = ({ isOpen, leftCharacter, rightCharacter, onSelectLeft, onSelectRight, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border-4 border-amber-400 rounded-[2.2rem] max-w-4xl w-full p-5 sm:p-7 shadow-2xl text-white max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-5">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase italic tracking-tight text-white">
              🐹 Choose Cute Hamsters
            </h2>
            <p className="text-xs sm:text-sm text-amber-300 font-bold">
              Pick a cute hamster climber for Blue Team and Red Team!
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Blue Team */}
          <div className="bg-blue-950/70 border-2 border-blue-500/50 rounded-3xl p-4">
            <div className="font-black text-blue-300 uppercase tracking-wider text-sm sm:text-base mb-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Blue Team Hamster
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {HAMSTER_CHARACTER_OPTIONS.map((opt) => {
                const selected = leftCharacter === opt.id;
                return (
                  <button
                    key={`modal-left-${opt.id}`}
                    onClick={() => onSelectLeft(opt.id)}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-amber-300 shadow-lg scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-blue-900/40 text-slate-200 border-blue-500/30'
                    }`}
                  >
                    <CuteHamsterCharacter team="left" character={opt.id} size="card" />
                    <div className="font-black text-xs mt-1 leading-tight">{opt.name}</div>
                    <div className="text-[10px] text-blue-200/80 font-semibold">{opt.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Red Team */}
          <div className="bg-red-950/70 border-2 border-red-500/50 rounded-3xl p-4">
            <div className="font-black text-red-300 uppercase tracking-wider text-sm sm:text-base mb-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
              Red Team Hamster
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {HAMSTER_CHARACTER_OPTIONS.map((opt) => {
                const selected = rightCharacter === opt.id;
                return (
                  <button
                    key={`modal-right-${opt.id}`}
                    onClick={() => onSelectRight(opt.id)}
                    className={`p-2.5 rounded-2xl border-2 flex flex-col items-center text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-amber-300 shadow-lg scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-red-900/40 text-slate-200 border-red-500/30'
                    }`}
                  >
                    <CuteHamsterCharacter team="right" character={opt.id} size="card" />
                    <div className="font-black text-xs mt-1 leading-tight">{opt.name}</div>
                    <div className="text-[10px] text-red-200/80 font-semibold">{opt.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-8 py-3 rounded-full bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-base shadow-[0_5px_0_#ca8a04] active:translate-y-0.5 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// IMPROVED GREAT WHITE MEGALODON SHARK & STAIRCASE LAGOON ARENA
// ============================================================================
const MAX_STAIR_STEPS = 5;

const SharkLagoonArena: React.FC<{
  leftStep: number;
  rightStep: number;
  leftFloatingFeedback: { text: string; color: string; id: number } | null;
  rightFloatingFeedback: { text: string; color: string; id: number } | null;
  leftCharacter: HamsterCharacterType;
  rightCharacter: HamsterCharacterType;
  leftPushing: boolean;
  rightPushing: boolean;
  leftStunned: boolean;
  rightStunned: boolean;
  leftFrozen: boolean;
  rightFrozen: boolean;
  sharkLungeSide: 'left' | 'right' | 'center' | null;
  fallingPhase: 'none' | 'diving' | 'chomped';
  winner: string | null;
  isRumbling: boolean;
  timeUpBanner?: string | null;
}> = ({
  leftStep,
  rightStep,
  leftFloatingFeedback,
  rightFloatingFeedback,
  leftCharacter,
  rightCharacter,
  leftPushing,
  rightPushing,
  leftStunned,
  rightStunned,
  leftFrozen,
  rightFrozen,
  sharkLungeSide,
  fallingPhase,
  winner,
  isRumbling,
  timeUpBanner,
}) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let rafId: number;
    const start = performance.now();
    const update = (now: number) => {
      setTick((now - start) / 1000);
      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const highestStep = Math.max(leftStep, rightStep);
  const dangerRatio = Math.min(1, highestStep / MAX_STAIR_STEPS);

  const targetLookBias =
    leftStep > rightStep ? -1 : rightStep > leftStep ? 1 : Math.sin(tick * 1.4) * 0.6;
  const swimSwayX = Math.sin(tick * 2.1) * 18 + targetLookBias * 24;
  const swimBobY = Math.cos(tick * 3.0) * 6 - dangerRatio * 18;
  const swimTilt = Math.sin(tick * 1.8) * 3.5 + targetLookBias * 6;
  const finWave = Math.sin(tick * 4.5) * 8;

  const isDiving = fallingPhase === 'diving';
  const isChomped = fallingPhase === 'chomped';
  const isLunging = sharkLungeSide !== null;

  // During 'diving' the shark opens its mouth wide (1.0) to catch the falling hamster;
  // During 'chomped' the shark snaps its jaws shut (0.12) and chomps!
  const baseJawOpen = 0.28 + dangerRatio * 0.42 + Math.sin(tick * 3.8) * 0.1;
  const jawOpen = isDiving
    ? 1.0
    : isChomped
      ? 0.16 + Math.abs(Math.sin(tick * 16)) * 0.25
      : isLunging
        ? 0.88
        : Math.max(0.2, Math.min(0.95, baseJawOpen));

  const sharkTranslateY = isDiving ? -52 : isChomped ? -34 : isLunging ? -28 : swimBobY;
  const sharkTranslateX =
    isDiving || isChomped
      ? 0
      : sharkLungeSide === 'left'
        ? -38
        : sharkLungeSide === 'right'
          ? 38
          : swimSwayX;

  const leftFell = leftStep > MAX_STAIR_STEPS;
  const rightFell = rightStep > MAX_STAIR_STEPS;

  // Vertical jump-up-and-down offsets for ONLY the hamsters (never shaking the arena!)
  const leftJumpY =
    leftFell || leftFrozen
      ? 0
      : leftPushing || sharkLungeSide === 'left' || winner === 'Blue Team' || isRumbling
        ? Math.abs(Math.sin(tick * 14)) * 22
        : leftStep >= MAX_STAIR_STEPS - 1
          ? Math.abs(Math.sin(tick * 9)) * 12
          : Math.abs(Math.sin(tick * 4.5)) * 6;

  const rightJumpY =
    rightFell || rightFrozen
      ? 0
      : rightPushing || sharkLungeSide === 'right' || winner === 'Red Team' || isRumbling
        ? Math.abs(Math.sin(tick * 14 + 0.8)) * 22
        : rightStep >= MAX_STAIR_STEPS - 1
          ? Math.abs(Math.sin(tick * 9 + 0.8)) * 12
          : Math.abs(Math.sin(tick * 4.5 + 0.8)) * 6;

  // Exact percentage alignment with SVG staircase planks (viewBox 1200x360)
  const getStepCoords = (side: 'left' | 'right', stepIdx: number) => {
    const s = Math.max(0, Math.min(MAX_STAIR_STEPS, stepIdx));
    const sx = side === 'left' ? 88 + s * 64 : 1200 - (88 + s * 64);
    const sy = 294 - s * 38;
    const xPct = (sx / 1200) * 100;
    const bottomPct = ((360 - sy + 4) / 360) * 100;
    return { xPct, bottomPct };
  };

  // Multi-stage parabolic falling trajectory straight into the shark's open mouth!
  const leftCoords = leftFell
    ? fallingPhase === 'diving'
      ? { xPct: 48.5, bottomPct: 42 }
      : { xPct: 50, bottomPct: 26 }
    : getStepCoords('left', leftStep);

  const rightCoords = rightFell
    ? fallingPhase === 'diving'
      ? { xPct: 51.5, bottomPct: 42 }
      : { xPct: 50, bottomPct: 26 }
    : getStepCoords('right', rightStep);

  // Quadratic Bezier point helper so teeth sit 100% flush along the curved gumline
  const bezierY = (t: number, y0: number, y1: number, y2: number) => {
    const mt = 1 - t;
    return mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
  };

  return (
    <div
      className="relative w-full h-full flex-1 min-h-[220px] sm:min-h-[275px] md:min-h-[310px] max-w-[1380px] mx-auto rounded-3xl overflow-hidden border-4 border-sky-300/70 shadow-2xl select-none"
      style={{
        background:
          'linear-gradient(180deg, #38bdf8 0%, #7dd3fc 32%, #0284c7 62%, #0369a1 82%, #0c4a6e 100%)',
      }}
    >
      {/* SUNNY TROPICAL SKY, SUN & CLOUDS */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-yellow-200/80 blur-md pointer-events-none" />
      <div className="absolute top-4 left-[18%] w-24 h-8 bg-white/75 rounded-full blur-[1px] pointer-events-none" />
      <div className="absolute top-6 right-[18%] w-28 h-9 bg-white/75 rounded-full blur-[1px] pointer-events-none" />

      {/* DRAMATIC MATCH VICTORY / SHARK CHOMP BANNER IN ARENA */}
      {winner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center gap-1 animate-bounce">
          {timeUpBanner && (
            <div className="px-4 py-1 rounded-full bg-rose-600 text-white font-black text-[11px] sm:text-xs uppercase tracking-wider shadow-lg border-2 border-white whitespace-nowrap">
              {timeUpBanner}
            </div>
          )}
          <div className="px-6 py-2 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 text-slate-950 font-black text-sm sm:text-xl md:text-2xl uppercase italic tracking-wider shadow-2xl border-4 border-white flex items-center gap-2 whitespace-nowrap">
            <span>🦈 CHOMP!!</span>
            <span className={winner === 'Blue Team' ? 'text-blue-700' : 'text-red-700'}>
              {winner} WINS!
            </span>
            <span>🏆</span>
          </div>
        </div>
      )}

      {/* STAIRCASE TOWERS & OCEAN HORIZON */}
      <svg
        viewBox="0 0 1200 360"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <rect x="0" y="165" width="1200" height="195" fill="#0369a1" opacity="0.45" />
        <path d="M 0 170 Q 140 125 290 170 Z" fill="#0d9488" opacity="0.55" />
        <path d="M 910 170 Q 1060 125 1200 170 Z" fill="#0d9488" opacity="0.55" />

        <path
          d={`M 0 250 Q 150 ${238 + Math.sin(tick * 2) * 8} 300 250 T 600 250 T 900 250 T 1200 250 L 1200 360 L 0 360 Z`}
          fill="#0284c7"
          opacity="0.7"
        />

        {/* Falling Dashed Arc Trail When Hamster Plunges Off Edge */}
        {leftFell && (
          <path
            d="M 408 104 Q 515 24 585 188"
            fill="none"
            stroke="#fde047"
            strokeWidth="4"
            strokeDasharray="10 8"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}
        {rightFell && (
          <path
            d="M 792 104 Q 685 24 615 188"
            fill="none"
            stroke="#fde047"
            strokeWidth="4"
            strokeDasharray="10 8"
            strokeLinecap="round"
            opacity="0.85"
          />
        )}

        {/* LEFT STAIRCASE STRUCTURE (BLUE TEAM) */}
        <g>
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const sx = 88 + s * 64;
            const sy = 294 - s * 38;
            return (
              <g key={`left-step-svg-${s}`}>
                <rect
                  x={sx - 10}
                  y={sy}
                  width="20"
                  height={360 - sy}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path
                  d={`M ${sx - 38} ${sy} L ${sx + 38} ${sy} L ${sx + 34} ${sy + 18} L ${sx - 34} ${sy + 18} Z`}
                  fill={s === MAX_STAIR_STEPS ? '#dc2626' : s <= leftStep ? '#2563eb' : '#334155'}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                />
                <rect
                  x={sx - 40}
                  y={sy - 6}
                  width="80"
                  height="10"
                  rx="4"
                  fill={
                    s === MAX_STAIR_STEPS
                      ? '#fbbf24'
                      : s === leftStep
                        ? '#60a5fa'
                        : s < leftStep
                          ? '#3b82f6'
                          : '#94a3b8'
                  }
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <text
                  x={sx}
                  y={sy + 14}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="900"
                >
                  {s === 0 ? 'SAFE' : s === MAX_STAIR_STEPS ? '⚠️ EDGE' : `STEP ${s}`}
                </text>
              </g>
            );
          })}
        </g>

        {/* RIGHT STAIRCASE STRUCTURE (RED TEAM) */}
        <g>
          {[0, 1, 2, 3, 4, 5].map((s) => {
            const sx = 1200 - (88 + s * 64);
            const sy = 294 - s * 38;
            return (
              <g key={`right-step-svg-${s}`}>
                <rect
                  x={sx - 10}
                  y={sy}
                  width="20"
                  height={360 - sy}
                  fill="#1e293b"
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <path
                  d={`M ${sx - 38} ${sy} L ${sx + 38} ${sy} L ${sx + 34} ${sy + 18} L ${sx - 34} ${sy + 18} Z`}
                  fill={s === MAX_STAIR_STEPS ? '#dc2626' : s <= rightStep ? '#dc2626' : '#334155'}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                />
                <rect
                  x={sx - 40}
                  y={sy - 6}
                  width="80"
                  height="10"
                  rx="4"
                  fill={
                    s === MAX_STAIR_STEPS
                      ? '#fbbf24'
                      : s === rightStep
                        ? '#f87171'
                        : s < rightStep
                          ? '#ef4444'
                          : '#94a3b8'
                  }
                  stroke="#0f172a"
                  strokeWidth="2"
                />
                <text
                  x={sx}
                  y={sy + 14}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="11"
                  fontWeight="900"
                >
                  {s === 0 ? 'SAFE' : s === MAX_STAIR_STEPS ? '⚠️ EDGE' : `STEP ${s}`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ==================================================================== */}
      {/* CENTER GIANT GREAT WHITE MEGALODON SHARK (IMPROVED MOUTH & JAWS)     */}
      {/* ==================================================================== */}
      <div
        className="absolute left-1/2 bottom-[-12px] z-20 pointer-events-none transition-transform duration-200 ease-out"
        style={{
          transform: `translateX(calc(-50% + ${sharkTranslateX}px)) translateY(${sharkTranslateY}px) rotate(${
            isDiving || isChomped ? 0 : swimTilt
          }deg) scale(${isDiving ? 1.12 : isChomped ? 1.16 : 1})`,
        }}
      >
        <div className="w-[215px] h-[200px] sm:w-[270px] sm:h-[245px] md:w-[308px] md:h-[275px] relative">
          <svg viewBox="0 0 280 250" className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="sharkDorsalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="48%" stopColor="#1d4ed8" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="sharkBellyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="68%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
              <radialGradient id="sharkThroatGrad" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#2e0210" />
                <stop offset="65%" stopColor="#6b0923" />
                <stop offset="100%" stopColor="#9f1239" />
              </radialGradient>
              <linearGradient id="sharkTongueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>

            {/* Water Foam Ring Around Shark Base */}
            <ellipse
              cx="140"
              cy="222"
              rx={100 + Math.sin(tick * 4) * 8}
              ry="18"
              fill="rgba(224, 242, 254, 0.55)"
            />
            <ellipse
              cx="140"
              cy="222"
              rx={80 - Math.sin(tick * 4) * 6}
              ry="11"
              fill="rgba(255, 255, 255, 0.78)"
            />

            {/* Top Dorsal Fin */}
            <path
              d={`M ${140 + finWave * 1.4} 34 C ${155 + finWave} 10, ${172 + finWave} 18, 162 58 Z`}
              fill="#1e3a8a"
              stroke="#0f172a"
              strokeWidth="3"
            />

            {/* Left & Right Pectoral Fins */}
            <path
              d={`M 55 156 C 12 ${162 + finWave}, 4 ${202 + finWave}, 36 206 C 54 206, 66 192, 72 182 Z`}
              fill="url(#sharkDorsalGrad)"
              stroke="#0f172a"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d={`M 225 156 C 268 ${162 - finWave}, 276 ${202 - finWave}, 244 206 C 226 206, 214 192, 208 182 Z`}
              fill="url(#sharkDorsalGrad)"
              stroke="#0f172a"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Main Torpedo Snout & Body */}
            <path
              d="M 140 18 C 90 22, 52 84, 50 156 C 48 205, 76 232, 140 232 C 204 232, 232 205, 230 156 C 228 84, 190 22, 140 18 Z"
              fill="url(#sharkDorsalGrad)"
              stroke="#0f172a"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* White Counter-Shaded Belly */}
            <path
              d="M 58 136 Q 94 86 140 86 Q 186 86 222 136 C 226 188, 202 230, 140 230 C 78 230, 54 188, 58 136 Z"
              fill="url(#sharkBellyGrad)"
            />

            {/* Gill Slits */}
            <g stroke="#1e293b" strokeWidth="2.8" strokeLinecap="round" opacity="0.75">
              <path d="M 62 146 Q 56 158 60 170" fill="none" />
              <path d="M 69 150 Q 63 162 67 174" fill="none" />
              <path d="M 76 154 Q 70 166 74 178" fill="none" />

              <path d="M 218 146 Q 224 158 220 170" fill="none" />
              <path d="M 211 150 Q 217 162 213 174" fill="none" />
              <path d="M 204 154 Q 210 166 206 178" fill="none" />
            </g>

            {/* Snout Nostrils */}
            <ellipse cx="112" cy="50" rx="4.5" ry="2.5" transform="rotate(-25 112 50)" fill="#0f172a" />
            <ellipse cx="168" cy="50" rx="4.5" ry="2.5" transform="rotate(25 168 50)" fill="#0f172a" />

            {/* Fierce Predator Eyes Tracking the Higher Hamster */}
            {([-1, 1] as const).map((dir) => {
              const ex = 140 + dir * 48;
              const ey = 72;
              const pupilShiftX = targetLookBias * 3.5;
              const pupilShiftY = -dangerRatio * 2;
              return (
                <g key={`shark-eye-${dir}`}>
                  <circle cx={ex} cy={ey} r="10.5" fill="#facc15" stroke="#0f172a" strokeWidth="2.8" />
                  <circle cx={ex + pupilShiftX} cy={ey + pupilShiftY} r="5.5" fill="#dc2626" />
                  <circle cx={ex + pupilShiftX} cy={ey + pupilShiftY} r="3" fill="#090d16" />
                  <circle cx={ex + pupilShiftX - 2} cy={ey + pupilShiftY - 2} r="2" fill="#ffffff" />
                  <path
                    d={`M ${ex - dir * 13} ${ey - 4} L ${ex + dir * 11} ${ey - 11}`}
                    stroke="#0f172a"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* ============================================================== */}
            {/* REDESIGNED GREAT WHITE SHARK MOUTH (CLEAN CLIPPED CAVITY,      */}
            {/* FLUSH BEZIER GUM ARCHES, RAZOR TEETH & NO CROSSING LINES)      */}
            {/* ============================================================== */}
            {(() => {
              const cornerLeftX = 76;
              const cornerRightX = 204;
              const cornerY = 144;
              const upperCtrlY = 82 - jawOpen * 22;
              const lowerCtrlY = 166 + jawOpen * 46;

              const mouthPath = `M ${cornerLeftX} ${cornerY} Q 140 ${upperCtrlY} ${cornerRightX} ${cornerY} Q 140 ${lowerCtrlY} ${cornerLeftX} ${cornerY} Z`;

              const upperTeethT = [0.13, 0.24, 0.35, 0.45, 0.55, 0.65, 0.76, 0.87];
              const lowerTeethT = [0.16, 0.27, 0.38, 0.5, 0.62, 0.73, 0.84];

              return (
                <g>
                  <clipPath id="sharkMouthInteriorClip">
                    <path d={mouthPath} />
                  </clipPath>

                  {/* Deep Throat Cavity */}
                  <path d={mouthPath} fill="url(#sharkThroatGrad)" />

                  {/* Clipped Interior: Tongue, Gums, and Interlocking Razor Teeth */}
                  <g clipPath="url(#sharkMouthInteriorClip)">
                    {/* Inner Dark Throat Depth Oval */}
                    <ellipse
                      cx="140"
                      cy={(upperCtrlY + lowerCtrlY) * 0.5 + 10}
                      rx="42"
                      ry={14 + jawOpen * 16}
                      fill="#1f020b"
                    />

                    {/* Thick Fleshy Shark Tongue */}
                    <path
                      d={`M 90 ${cornerY + 26} Q 118 ${cornerY - 6 + jawOpen * 10} 140 ${
                        cornerY + 2 + jawOpen * 10
                      } Q 162 ${cornerY - 6 + jawOpen * 10} 190 ${cornerY + 26} L 195 230 L 85 230 Z`}
                      fill="url(#sharkTongueGrad)"
                      stroke="#9f1239"
                      strokeWidth="2.2"
                    />
                    <path
                      d={`M 140 ${cornerY + 2 + jawOpen * 10} Q 140 ${cornerY + 22 + jawOpen * 14} 140 ${
                        cornerY + 42 + jawOpen * 14
                      }`}
                      stroke="#be123c"
                      strokeWidth="2"
                      strokeLinecap="round"
                      opacity="0.7"
                    />

                    {/* Upper Pink Gum Arch */}
                    <path
                      d={`M ${cornerLeftX - 6} ${cornerY + 4} Q 140 ${upperCtrlY - 12} ${
                        cornerRightX + 6
                      } ${cornerY + 4} Q 140 ${upperCtrlY + 14} ${cornerLeftX - 6} ${cornerY + 4} Z`}
                      fill="#f43f5e"
                    />

                    {/* Lower Pink Gum Arch */}
                    <path
                      d={`M ${cornerLeftX - 6} ${cornerY - 4} Q 140 ${lowerCtrlY - 14} ${
                        cornerRightX + 6
                      } ${cornerY - 4} Q 140 ${lowerCtrlY + 14} ${cornerLeftX - 6} ${cornerY - 4} Z`}
                      fill="#f43f5e"
                    />

                    {/* Upper Row of Serrated White Triangles (Pointing Downward) */}
                    {upperTeethT.map((t, idx) => {
                      const tx = cornerLeftX + (cornerRightX - cornerLeftX) * t;
                      const gumY = bezierY(t, cornerY, upperCtrlY + 4, cornerY);
                      const centerFactor = 1 - Math.abs(t - 0.5) * 1.15;
                      const toothHalfW = 5.5 + centerFactor * 2.5;
                      const toothLen = (14 + centerFactor * 9) * (0.55 + jawOpen * 0.45);
                      const tiltX = (0.5 - t) * 4;
                      return (
                        <g key={`u-tooth-${idx}`}>
                          <polygon
                            points={`${tx - toothHalfW},${gumY - 2} ${tx + toothHalfW},${gumY - 2} ${
                              tx + tiltX
                            },${gumY + toothLen}`}
                            fill="#ffffff"
                            stroke="#cbd5e1"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                          <polygon
                            points={`${tx},${gumY - 1} ${tx + toothHalfW},${gumY - 2} ${tx + tiltX},${
                              gumY + toothLen
                            }`}
                            fill="#e2e8f0"
                            opacity="0.55"
                          />
                        </g>
                      );
                    })}

                    {/* Lower Row of Serrated White Triangles (Pointing Upward) */}
                    {lowerTeethT.map((t, idx) => {
                      const tx = cornerLeftX + (cornerRightX - cornerLeftX) * t;
                      const gumY = bezierY(t, cornerY, lowerCtrlY - 4, cornerY);
                      const centerFactor = 1 - Math.abs(t - 0.5) * 1.15;
                      const toothHalfW = 5 + centerFactor * 2;
                      const toothLen = (12 + centerFactor * 7) * (0.55 + jawOpen * 0.45);
                      const tiltX = (0.5 - t) * 3;
                      return (
                        <g key={`l-tooth-${idx}`}>
                          <polygon
                            points={`${tx - toothHalfW},${gumY + 2} ${tx + toothHalfW},${gumY + 2} ${
                              tx + tiltX
                            },${gumY - toothLen}`}
                            fill="#ffffff"
                            stroke="#cbd5e1"
                            strokeWidth="1.2"
                            strokeLinejoin="round"
                          />
                          <polygon
                            points={`${tx},${gumY + 1} ${tx + toothHalfW},${gumY + 2} ${tx + tiltX},${
                              gumY - toothLen
                            }`}
                            fill="#e2e8f0"
                            opacity="0.55"
                          />
                        </g>
                      );
                    })}
                  </g>

                  {/* Crisp Outer Jaw Lip Outline (No lines crossing the teeth!) */}
                  <path
                    d={mouthPath}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="4"
                    strokeLinejoin="round"
                  />
                  {/* Cheek Crease Lines at Mouth Corners */}
                  <path
                    d={`M ${cornerLeftX - 7} ${cornerY - 7} Q ${cornerLeftX - 2} ${cornerY} ${
                      cornerLeftX - 5
                    } ${cornerY + 8}`}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    d={`M ${cornerRightX + 7} ${cornerY - 7} Q ${cornerRightX + 2} ${cornerY} ${
                      cornerRightX + 5
                    } ${cornerY + 8}`}
                    fill="none"
                    stroke="#0f172a"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </g>
              );
            })()}

            {/* HUGE WATER SPLASH FOUNTAIN WHEN HAMSTER PLUNGES & GETS CHOMPED */}
            {(isLunging || isDiving || isChomped) && (
              <g>
                <circle cx="42" cy="110" r="8" fill="#e0f2fe" />
                <circle cx="24" cy="80" r="6" fill="#ffffff" />
                <circle cx="238" cy="110" r="8" fill="#e0f2fe" />
                <circle cx="256" cy="80" r="6" fill="#ffffff" />
                {isChomped && (
                  <g>
                    <path
                      d="M 85 130 Q 45 45 20 85"
                      fill="none"
                      stroke="#bae6fd"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 195 130 Q 235 45 260 85"
                      fill="none"
                      stroke="#bae6fd"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                    <circle cx="58" cy="48" r="10" fill="#ffffff" />
                    <circle cx="222" cy="48" r="10" fill="#ffffff" />
                    <circle cx="105" cy="24" r="8" fill="#e0f2fe" />
                    <circle cx="175" cy="24" r="8" fill="#e0f2fe" />
                    {/* Comic CHOMP Starburst */}
                    <g transform="translate(140, 122)">
                      <polygon
                        points="0,-42 12,-16 40,-24 22,-2 44,18 14,18 0,42 -14,18 -44,18 -22,-2 -40,-24 -12,-16"
                        fill="#facc15"
                        stroke="#dc2626"
                        strokeWidth="3"
                      />
                      <text
                        x="0"
                        y="6"
                        textAnchor="middle"
                        fill="#991b1b"
                        fontSize="16"
                        fontWeight="900"
                        fontStyle="italic"
                      >
                        CHOMP!
                      </text>
                    </g>
                  </g>
                )}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* LEFT BLUE HAMSTER CLIMBER                                            */}
      {/* ==================================================================== */}
      <div
        className={`absolute z-30 pointer-events-none ${
          leftFell
            ? fallingPhase === 'diving'
              ? 'transition-all duration-500 ease-in rotate-[320deg] scale-90'
              : 'transition-all duration-300 ease-in rotate-[540deg] scale-0 opacity-0'
            : 'transition-[left,bottom] duration-300 ease-out'
        }`}
        style={{
          left: `${leftCoords.xPct}%`,
          bottom: `${leftCoords.bottomPct}%`,
          transform: `translateX(-50%) translateY(${-leftJumpY}px)`,
        }}
      >
        <div className="flex flex-col items-center relative">
          {/* Floating Action Feedback Popup */}
          {leftFloatingFeedback && (
            <div
              key={leftFloatingFeedback.id}
              className={`mb-1 px-3 py-0.5 rounded-full font-black text-[11px] sm:text-xs shadow-lg border-2 border-white animate-bounce whitespace-nowrap ${leftFloatingFeedback.color}`}
            >
              {leftFloatingFeedback.text}
            </div>
          )}

          <div className="mb-0.5 px-2.5 py-0.5 rounded-full bg-[#0055fe] text-white font-black text-[10px] sm:text-xs shadow-md border border-white/60 whitespace-nowrap">
            {leftFell
              ? '😱 AHHH!!'
              : leftStep === 0
                ? 'BLUE · SAFE'
                : leftStep >= MAX_STAIR_STEPS
                  ? '⚠️ DANGER EDGE!'
                  : `BLUE · STEP ${leftStep}/${MAX_STAIR_STEPS}`}
          </div>
          <CuteHamsterCharacter
            team="left"
            character={leftCharacter}
            isPushing={leftPushing}
            isClimbing={sharkLungeSide === 'left'}
            isDangerEdge={leftStep >= MAX_STAIR_STEPS - 1}
            isStunned={leftStunned}
            isFrozen={leftFrozen}
            hasLost={leftFell}
            isWinner={winner === 'Blue Team'}
          />
        </div>
      </div>

      {/* ==================================================================== */}
      {/* RIGHT RED HAMSTER CLIMBER                                            */}
      {/* ==================================================================== */}
      <div
        className={`absolute z-30 pointer-events-none ${
          rightFell
            ? fallingPhase === 'diving'
              ? 'transition-all duration-500 ease-in -rotate-[320deg] scale-90'
              : 'transition-all duration-300 ease-in -rotate-[540deg] scale-0 opacity-0'
            : 'transition-[left,bottom] duration-300 ease-out'
        }`}
        style={{
          left: `${rightCoords.xPct}%`,
          bottom: `${rightCoords.bottomPct}%`,
          transform: `translateX(-50%) translateY(${-rightJumpY}px)`,
        }}
      >
        <div className="flex flex-col items-center relative">
          {/* Floating Action Feedback Popup */}
          {rightFloatingFeedback && (
            <div
              key={rightFloatingFeedback.id}
              className={`mb-1 px-3 py-0.5 rounded-full font-black text-[11px] sm:text-xs shadow-lg border-2 border-white animate-bounce whitespace-nowrap ${rightFloatingFeedback.color}`}
            >
              {rightFloatingFeedback.text}
            </div>
          )}

          <div className="mb-0.5 px-2.5 py-0.5 rounded-full bg-[#cc0000] text-white font-black text-[10px] sm:text-xs shadow-md border border-white/60 whitespace-nowrap">
            {rightFell
              ? '😱 AHHH!!'
              : rightStep === 0
                ? 'RED · SAFE'
                : rightStep >= MAX_STAIR_STEPS
                  ? '⚠️ DANGER EDGE!'
                  : `RED · STEP ${rightStep}/${MAX_STAIR_STEPS}`}
          </div>
          <CuteHamsterCharacter
            team="right"
            character={rightCharacter}
            isPushing={rightPushing}
            isClimbing={sharkLungeSide === 'right'}
            isDangerEdge={rightStep >= MAX_STAIR_STEPS - 1}
            isStunned={rightStunned}
            isFrozen={rightFrozen}
            hasLost={rightFell}
            isWinner={winner === 'Red Team'}
          />
        </div>
      </div>

      {/* FOREGROUND ROLLING OCEAN WAVES */}
      <svg
        viewBox="0 0 1200 90"
        preserveAspectRatio="none"
        className="absolute bottom-0 left-0 w-full h-9 sm:h-12 z-30 pointer-events-none"
      >
        <path
          d={`M 0 38 Q 100 ${18 + Math.sin(tick * 3.2) * 10} 200 38 T 400 38 T 600 38 T 800 38 T 1000 38 T 1200 38 L 1200 90 L 0 90 Z`}
          fill="rgba(14, 165, 233, 0.82)"
        />
        <path
          d={`M 0 54 Q 120 ${36 + Math.cos(tick * 2.6) * 9} 240 54 T 480 54 T 720 54 T 960 54 T 1200 54 L 1200 90 L 0 90 Z`}
          fill="rgba(2, 132, 199, 0.94)"
        />
      </svg>
    </div>
  );
};

// ============================================================================
// DEFAULT QUESTIONS & QUIZ PARSER
// ============================================================================
interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  image?: string;
}

interface GameData {
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
  text: '',
  options: ['', '', '', ''],
  answerIndex: 0,
});

const DEFAULT_QUESTIONS: Question[] = [];

// ============================================================================
// MAIN SHARK ATTACK VIEW
// ============================================================================
export function SharkAttack({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  const hasLoadedQuestions = Boolean(
    initialGame &&
      ((initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
        (initialGame.questions && initialGame.questions.length > 0))
  );

  const [screen, setScreen] = useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>(
    initialGame && !initialGame.editMode && hasLoadedQuestions ? 'menu' : 'setup'
  );
  const [showModeModal, setShowModeModal] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [leftCharacter, setLeftCharacter] = useState<HamsterCharacterType>('mochi');
  const [rightCharacter, setRightCharacter] = useState<HamsterCharacterType>('ichigo');
  const [fontSizeScale, setFontSizeScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [showFontSizePopup, setShowFontSizePopup] = useState(false);

  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  const sanitizeQuestionsList = (rawList: Question[]): Question[] =>
    rawList.map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options.map((opt) => stripOptionPrefix(opt)) : [],
    }));

  const [activeGame, setActiveGame] = useState<GameData | null>(() => {
    if (initialGame) {
      const qList =
        initialGame.customQuestions && initialGame.customQuestions.length > 0
          ? initialGame.customQuestions
          : initialGame.questions && initialGame.questions.length > 0
            ? initialGame.questions
            : [BLANK_QUESTION()];
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || '',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions: sanitizeQuestionsList(qList),
        isPublic: initialGame.isPublic || false,
      };
    }
    return {
      id: Date.now(),
      title: '',
      folderId: '',
      topic: '',
      classLevel: '',
      questions: [BLANK_QUESTION()],
    };
  });

  useEffect(() => {
    if (initialGame) {
      const qList =
        initialGame.customQuestions && initialGame.customQuestions.length > 0
          ? initialGame.customQuestions
          : initialGame.questions && initialGame.questions.length > 0
            ? initialGame.questions
            : [BLANK_QUESTION()];

      setActiveGame({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || '',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions: sanitizeQuestionsList(qList),
        isPublic: initialGame.isPublic || false,
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('menu');
      } else {
        setScreen('setup');
      }
    }
  }, [initialGame]);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const snap = await getDocs(qFolders);
          const fData: { id: string; name: string }[] = [];
          snap.forEach((d) => fData.push({ id: d.id, name: d.data().name }));
          setFolders(fData);
        } catch (err) {
          console.error('Error loading folders', err);
        }
      };
      fetchFolders();
    }
  }, [user]);

  const saveGame = async (gameData: GameData) => {
    const cleanedGame: GameData = {
      ...gameData,
      questions: sanitizeQuestionsList(gameData.questions),
    };
    setActiveGame(cleanedGame);
    if (!user) {
      alert("You must be logged in to save games.");
      setScreen('menu');
      return;
    }

    try {
      const isPublicBool = Boolean(cleanedGame.isPublic);
      const now = new Date().toISOString();

      const isOwnExistingGame = Boolean(
        initialGame?.id &&
        !String(initialGame.id).startsWith('sample-') &&
        (!initialGame.userId || initialGame.userId === user.uid)
      );

      const gameToSave = JSON.parse(
        JSON.stringify({
          name: cleanedGame.title || cleanedGame.topic || 'Shark Attack',
          title: cleanedGame.title || cleanedGame.topic || 'Shark Attack',
          folderId: cleanedGame.folderId || '',
          topic: cleanedGame.topic || '',
          className: cleanedGame.classLevel || '',
          gameType: 'shark-attack',
          originalGameType: 'shark-attack',
          customQuestions: cleanedGame.questions,
          isPublic: isPublicBool,
          userId: user.uid,
          creatorName: user.displayName || user.email?.split('@')[0] || "Teacher",
          creatorEmail: user.email || "",
          updatedAt: now,
          publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
          createdAt: (isOwnExistingGame && initialGame?.createdAt) ? initialGame.createdAt : now,
        })
      );

      if (isOwnExistingGame) {
        try {
          await updateDoc(doc(db, 'mysteryBoxGames', initialGame.id), gameToSave);
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
      onViewChange('games');
    } catch (e: any) {
      console.error('Error saving game', e);
      alert("Failed to save game: " + (e?.message || String(e)));
      onViewChange('games');
    }
  };

  const questionsDB =
    activeGame?.questions && activeGame.questions.filter((q) => q.text.trim() || q.image).length > 0
      ? activeGame.questions.filter((q) => q.text.trim() || q.image)
      : DEFAULT_QUESTIONS;

  const [questionMode, setQuestionMode] = useState<'single' | 'split'>('single');
  const [showStartBattleModal, setShowStartBattleModal] = useState(false);
  const questionModeRef = useRef<'single' | 'split'>('single');
  const leftQuestionsRef = useRef<any[]>([]);
  const rightQuestionsRef = useRef<any[]>([]);

  useEffect(() => {
    questionModeRef.current = questionMode;
  }, [questionMode]);

  const generateQuestionObj = (q: any) => {
    if (!q) {
      return { text: 'Question', options: ['Option A', 'Option B'], correctIndex: 0 };
    }
    const rawOptions = Array.isArray(q.options)
      ? q.options.map((o: any) => (typeof o === 'string' ? stripOptionPrefix(o) : ''))
      : [];

    let validOptions = rawOptions.filter((o: string) => o !== '');
    const correctOpt = rawOptions[q.answerIndex] || validOptions[0] || 'Correct Answer';

    if (!validOptions.includes(correctOpt)) {
      validOptions.unshift(correctOpt);
    }
    if (validOptions.length < 2) {
      validOptions.push('Option B');
    } else if (validOptions.length > 4) {
      const wrongOpts = validOptions
        .filter((o: string) => o !== correctOpt)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      validOptions = [correctOpt, ...wrongOpts];
    }

    const shuffledOpts = [...validOptions].sort(() => Math.random() - 0.5);
    return {
      text: q.text || '',
      image: q.image,
      options: shuffledOpts,
      correctIndex: Math.max(0, shuffledOpts.indexOf(correctOpt)),
    };
  };

  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];
    return generateQuestionObj(q);
  };

  const generateQuestionFromList = (list: any[], index: number) => {
    if (!list || list.length === 0) return generateQuestion(index);
    const q = list[index % list.length];
    return generateQuestionObj(q);
  };

  const [leftTeam, setLeftTeam] = useState<any>({
    score: 0,
    wins: 0,
    step: 0,
    qIndex: 0,
    q: null,
    stunned: false,
    pushing: false,
    mistakes: 0,
    frozen: false,
    wrongOnCurrentQ: false,
  });
  const [rightTeam, setRightTeam] = useState<any>({
    score: 0,
    wins: 0,
    step: 0,
    qIndex: 0,
    q: null,
    stunned: false,
    pushing: false,
    mistakes: 0,
    frozen: false,
    wrongOnCurrentQ: false,
  });

  const [leftFeedback, setLeftFeedback] = useState<{ text: string; color: string; id: number } | null>(null);
  const [rightFeedback, setRightFeedback] = useState<{ text: string; color: string; id: number } | null>(null);

  const showTeamFeedback = useCallback((team: 'left' | 'right', text: string, color: string) => {
    const payload = { text, color, id: Date.now() + Math.random() };
    if (team === 'left') {
      setLeftFeedback(payload);
      setTimeout(() => {
        setLeftFeedback((prev) => (prev?.id === payload.id ? null : prev));
      }, 1250);
    } else {
      setRightFeedback(payload);
      setTimeout(() => {
        setRightFeedback((prev) => (prev?.id === payload.id ? null : prev));
      }, 1250);
    }
  }, []);

  const [winner, setWinner] = useState<string | null>(null);
  const [fallingPhase, setFallingPhase] = useState<'none' | 'diving' | 'chomped'>('none');
  const [activeKey, setActiveKey] = useState<{ team: 'left' | 'right'; index: number } | null>(null);
  const [isRumbling, setIsRumbling] = useState(false);
  const [sharkLungeSide, setSharkLungeSide] = useState<'left' | 'right' | 'center' | null>(null);
  const [soundMuted, setSoundMuted] = useState(false);

  // 1 to 10 Minutes Match Timer Slider & Countdown State
  const [timerMinutes, setTimerMinutes] = useState<number>(3);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(3 * 60);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const [timeUpBanner, setTimeUpBanner] = useState<string | null>(null);

  const handleTimerSliderChange = useCallback((mins: number) => {
    const clamped = Math.max(1, Math.min(10, mins));
    setTimerMinutes(clamped);
    setTimeLeftSeconds(clamped * 60);
    setTimerPaused(false);
  }, []);

  const formatTimer = (totalSec: number) => {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  useEffect(() => {
    soundMutedGlobal = soundMuted;
  }, [soundMuted]);

  const matchOverRef = useRef(false);
  const lastTouchTimeRef = useRef<number>(0);
  const stateRef = useRef({ screen, leftTeam, rightTeam });
  useEffect(() => {
    stateRef.current = { screen, leftTeam, rightTeam };
  }, [screen, leftTeam, rightTeam]);

  const startGame = (continueMatch = false, chosenMode?: 'single' | 'split') => {
    const activeMode = chosenMode || questionMode;
    if (chosenMode) {
      setQuestionMode(chosenMode);
      questionModeRef.current = chosenMode;
    }

    const shuffledLeft = [...questionsDB].sort(() => Math.random() - 0.5);
    const shuffledRight = [...questionsDB].sort(() => Math.random() - 0.5);
    leftQuestionsRef.current = shuffledLeft;
    rightQuestionsRef.current = shuffledRight;

    const initialSingleQ = generateQuestion(continueMatch ? leftTeam.qIndex : 0);

    setLeftTeam((prev: any) => {
      const nextIndex = continueMatch ? prev.qIndex : 0;
      return {
        ...prev,
        score: 0,
        step: 0,
        qIndex: nextIndex,
        q: activeMode === 'split' ? generateQuestionFromList(shuffledLeft, nextIndex) : initialSingleQ,
        stunned: false,
        pushing: false,
        mistakes: 0,
        frozen: false,
        wrongOnCurrentQ: false,
      };
    });
    setRightTeam((prev: any) => {
      const nextIndex = continueMatch ? prev.qIndex : 0;
      return {
        ...prev,
        score: 0,
        step: 0,
        qIndex: nextIndex,
        q: activeMode === 'split' ? generateQuestionFromList(shuffledRight, nextIndex) : initialSingleQ,
        stunned: false,
        pushing: false,
        mistakes: 0,
        frozen: false,
        wrongOnCurrentQ: false,
      };
    });

    setLeftFeedback(null);
    setRightFeedback(null);
    setWinner(null);
    setTimeUpBanner(null);
    setFallingPhase('none');
    setSharkLungeSide(null);
    setTimeLeftSeconds(timerMinutes * 60);
    setTimerPaused(false);
    matchOverRef.current = false;
    setShowStartBattleModal(false);
    setScreen('playing');
    playSFX('splash');
    setTimeout(() => playSFX('clack'), 200);
  };

  const triggerSharkVictory = useCallback((winningTeam: 'Blue Team' | 'Red Team') => {
    if (matchOverRef.current) return;
    matchOverRef.current = true;
    setWinner(winningTeam);
    setFallingPhase('diving');
    if (winningTeam === 'Blue Team') {
      setLeftTeam((prev: any) => ({ ...prev, wins: prev.wins + 1 }));
    } else {
      setRightTeam((prev: any) => ({ ...prev, wins: prev.wins + 1 }));
    }
    // Stage 1: Hamster plunges off the top edge with cartoon falling whistle
    playSFX('fallWhistle');
    // Stage 2: Hamster lands in shark jaws -> CHOMP + big splash!
    setTimeout(() => {
      setFallingPhase('chomped');
      setIsRumbling(true);
      playSFX('chomp');
      setTimeout(() => setIsRumbling(false), 500);
    }, 520);
    // Stage 3: Championship fanfare
    setTimeout(() => {
      playSFX('win');
    }, 950);
    // Transition to celebration screen
    setTimeout(() => {
      setScreen('end');
    }, 2600);
  }, []);

  // When the 1-10 minute timer ends, the character with the highest steps (closest to the edge) is eaten by the shark!
  const handleTimeExpired = useCallback(() => {
    if (matchOverRef.current || stateRef.current.screen !== 'playing') return;
    const lTeam = stateRef.current.leftTeam;
    const rTeam = stateRef.current.rightTeam;

    // Determine which hamster is closer to the edge (highest step); tie-break by lower score / more mistakes
    let blueEaten = false;
    if (lTeam.step > rTeam.step) {
      blueEaten = true;
    } else if (rTeam.step > lTeam.step) {
      blueEaten = false;
    } else if (lTeam.score < rTeam.score) {
      blueEaten = true;
    } else if (rTeam.score < lTeam.score) {
      blueEaten = false;
    } else {
      blueEaten = lTeam.mistakes > rTeam.mistakes;
    }

    if (blueEaten) {
      // Blue Hamster has highest step / closest to edge -> eaten by Shark! Red Team wins!
      setLeftTeam((prev: any) => ({ ...prev, step: MAX_STAIR_STEPS + 1 }));
      setSharkLungeSide('left');
      showTeamFeedback('left', '⏰ TIME UP! EATEN BY SHARK!', 'bg-red-600 text-white');
      showTeamFeedback('right', '🏆 SURVIVED! RED WINS!', 'bg-emerald-500 text-white');
      setTimeUpBanner(
        lTeam.step !== rTeam.step
          ? `⏰ TIME'S UP! Blue Hamster (Step ${lTeam.step}) was closest to the edge & eaten!`
          : `⏰ TIME'S UP! Blue Hamster was eaten by the Shark!`
      );
      triggerSharkVictory('Red Team');
    } else {
      // Red Hamster has highest step / closest to edge -> eaten by Shark! Blue Team wins!
      setRightTeam((prev: any) => ({ ...prev, step: MAX_STAIR_STEPS + 1 }));
      setSharkLungeSide('right');
      showTeamFeedback('right', '⏰ TIME UP! EATEN BY SHARK!', 'bg-red-600 text-white');
      showTeamFeedback('left', '🏆 SURVIVED! BLUE WINS!', 'bg-emerald-500 text-white');
      setTimeUpBanner(
        lTeam.step !== rTeam.step
          ? `⏰ TIME'S UP! Red Hamster (Step ${rTeam.step}) was closest to the edge & eaten!`
          : `⏰ TIME'S UP! Red Hamster was eaten by the Shark!`
      );
      triggerSharkVictory('Blue Team');
    }
  }, [showTeamFeedback, triggerSharkVictory]);

  useEffect(() => {
    if (screen !== 'playing' || timerPaused) return;
    const interval = setInterval(() => {
      if (matchOverRef.current) return;
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimeout(() => handleTimeExpired(), 0);
          return 0;
        }
        if (prev <= 11) {
          playSFX('clack');
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, timerPaused, handleTimeExpired]);

  const handleAnswer = useCallback(
    (teamStr: 'left' | 'right', selectedIndex: number) => {
      const state = stateRef.current;
      if (state.screen !== 'playing' || matchOverRef.current) return;

      const isLeft = teamStr === 'left';
      const teamState = isLeft ? state.leftTeam : state.rightTeam;
      const opponentState = isLeft ? state.rightTeam : state.leftTeam;
      const setTeamState = isLeft ? setLeftTeam : setRightTeam;
      const setOpponentState = isLeft ? setRightTeam : setLeftTeam;
      const winnerSide: 'left' | 'right' = isLeft ? 'left' : 'right';
      const loserSide: 'left' | 'right' = isLeft ? 'right' : 'left';

      if (teamState.stunned || teamState.pushing || teamState.frozen) return;

      if (selectedIndex === teamState.q?.correctIndex) {
        // ====================================================================
        // TEAM ANSWERED CORRECTLY FIRST!
        // 1. Winner steps down 1 step toward Safe Zone (or stays on Safe Zone)
        // 2. Loser climbs UP 1 step toward the Shark until they fall off the
        //    top edge and get eaten by the Shark!
        // ====================================================================
        const winnerStepBefore = teamState.step;
        const nextWinnerStep = winnerStepBefore > 0 ? winnerStepBefore - 1 : 0;

        playSFX('roundWin');
        if (winnerStepBefore > 0) {
          showTeamFeedback(winnerSide, '✨ -1 STEP (SAFE!)', 'bg-emerald-500 text-white');
        } else {
          showTeamFeedback(winnerSide, '✨ CORRECT! SAFE!', 'bg-emerald-500 text-white');
        }

        const loserStepBefore = opponentState.step;
        const nextLoserStep = loserStepBefore + 1;

        if (nextLoserStep <= MAX_STAIR_STEPS) {
          playSFX('stepDanger');
        }
        showTeamFeedback(
          loserSide,
          nextLoserStep > MAX_STAIR_STEPS ? '🦈 EATEN BY SHARK!' : '⬆️ +1 STEP!',
          'bg-red-600 text-white'
        );

        setTeamState((prev: any) => ({
          ...prev,
          pushing: true,
          score: prev.score + 1,
          step: nextWinnerStep,
          mistakes: 0,
          wrongOnCurrentQ: false,
        }));

        setOpponentState((prev: any) => ({
          ...prev,
          step: nextLoserStep,
          wrongOnCurrentQ: false,
        }));

        setIsRumbling(true);
        setSharkLungeSide(loserSide);
        setTimeout(() => {
          setIsRumbling(false);
          setSharkLungeSide(null);
        }, 420);

        if (nextLoserStep > MAX_STAIR_STEPS) {
          triggerSharkVictory(isLeft ? 'Blue Team' : 'Red Team');
          return;
        }

        if (questionModeRef.current === 'split') {
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const qList = isLeft ? leftQuestionsRef.current : rightQuestionsRef.current;
            setTeamState((prev: any) => ({
              ...prev,
              pushing: false,
              qIndex: nextIndex,
              q: generateQuestionFromList(qList, nextIndex),
              wrongOnCurrentQ: false,
            }));
          }, 340);
        } else {
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const newQ = generateQuestion(nextIndex);
            setLeftTeam((prev: any) => ({
              ...prev,
              pushing: false,
              stunned: false,
              qIndex: nextIndex,
              q: newQ,
              wrongOnCurrentQ: false,
            }));
            setRightTeam((prev: any) => ({
              ...prev,
              pushing: false,
              stunned: false,
              qIndex: nextIndex,
              q: newQ,
              wrongOnCurrentQ: false,
            }));
          }, 380);
        }
      } else {
        // ====================================================================
        // TEAM ANSWERED INCORRECTLY:
        // Neither team steps up on a wrong answer!
        // ====================================================================
        const bothWrongInSingleMode =
          questionModeRef.current === 'single' && opponentState.wrongOnCurrentQ;

        showTeamFeedback(winnerSide, '✕ WRONG!', 'bg-slate-800 text-rose-300');
        playSFX('stun');

        if (bothWrongInSingleMode) {
          setTeamState((prev: any) => ({ ...prev, stunned: true, wrongOnCurrentQ: true }));
          setTimeout(() => {
            if (matchOverRef.current) return;
            const nextIndex = teamState.qIndex + 1;
            const newQ = generateQuestion(nextIndex);
            setLeftTeam((prev: any) => ({
              ...prev,
              stunned: false,
              frozen: false,
              mistakes: 0,
              qIndex: nextIndex,
              q: newQ,
              wrongOnCurrentQ: false,
            }));
            setRightTeam((prev: any) => ({
              ...prev,
              stunned: false,
              frozen: false,
              mistakes: 0,
              qIndex: nextIndex,
              q: newQ,
              wrongOnCurrentQ: false,
            }));
          }, 650);
          return;
        }

        setTeamState((prev: any) => {
          const nextMistakes = prev.mistakes + 1;
          if (nextMistakes >= 2) {
            playSFX('freeze');
            setTimeout(
              () => setTeamState((p: any) => ({ ...p, frozen: false, mistakes: 0 })),
              2200
            );
            return { ...prev, frozen: true, mistakes: 0, wrongOnCurrentQ: true };
          }
          setTimeout(() => setTeamState((p: any) => ({ ...p, stunned: false })), 900);
          return { ...prev, stunned: true, mistakes: nextMistakes, wrongOnCurrentQ: true };
        });
      }
    },
    [showTeamFeedback, triggerSharkVictory]
  );

  const triggerOptionPress = (team: 'left' | 'right', idx: number) => {
    setActiveKey({ team, index: idx });
    setTimeout(() => setActiveKey(null), 160);
    handleAnswer(team, idx);
  };

  const getBlueKeyHints = (count: number): string[] => {
    if (count === 2) return ['A', 'D'];
    if (count === 3) return ['A', 'S', 'D'];
    return ['W', 'A', 'S', 'D'];
  };

  const getRedKeyHints = (count: number): string[] => {
    if (count === 2) return ['←', '→'];
    if (count === 3) return ['←', '↓', '→'];
    return ['↑', '←', '↓', '→'];
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.screen !== 'playing') return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

      const key = e.key.toLowerCase();
      const leftOptsCount = stateRef.current.leftTeam?.q?.options?.length || 4;
      const rightOptsCount = stateRef.current.rightTeam?.q?.options?.length || 4;

      let leftMap: Record<string, number> = {};
      if (leftOptsCount === 2) {
        leftMap = { a: 0, d: 1, 1: 0, 2: 1, q: 0, e: 1 };
      } else if (leftOptsCount === 3) {
        leftMap = { a: 0, s: 1, d: 2, 1: 0, 2: 1, 3: 2, q: 0, w: 1, e: 2 };
      } else {
        leftMap = { w: 0, a: 1, s: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      }

      let rightMap: Record<string, number> = {};
      if (rightOptsCount === 2) {
        rightMap = { arrowleft: 0, arrowright: 1, j: 0, l: 1, 7: 0, 8: 1 };
      } else if (rightOptsCount === 3) {
        rightMap = { arrowleft: 0, arrowdown: 1, arrowright: 2, j: 0, k: 1, l: 2, 7: 0, 8: 1, 9: 2 };
      } else {
        rightMap = {
          arrowup: 0,
          arrowleft: 1,
          arrowdown: 2,
          arrowright: 3,
          i: 0,
          j: 1,
          k: 2,
          l: 3,
          7: 0,
          8: 1,
          9: 2,
          0: 3,
        };
      }

      if (key in leftMap) {
        e.preventDefault();
        const idx = leftMap[key];
        setActiveKey({ team: 'left', index: idx });
        setTimeout(() => setActiveKey(null), 160);
        handleAnswer('left', idx);
      } else if (key in rightMap) {
        e.preventDefault();
        const idx = rightMap[key];
        setActiveKey({ team: 'right', index: idx });
        setTimeout(() => setActiveKey(null), 160);
        handleAnswer('right', idx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer]);

  const scaleShift = fontSizeScale === 'large' ? -1 : fontSizeScale === 'small' ? 1 : 0;

  const getQuestionFontSize = (text: string, isSplit = false) => {
    const len = (text || '').trim().length;
    if (isSplit) {
      let tier = 0;
      if (len <= 32) tier = 0;
      else if (len <= 60) tier = 1;
      else if (len <= 95) tier = 2;
      else if (len <= 135) tier = 3;
      else tier = 4;

      const idx = Math.max(-1, Math.min(4, tier + scaleShift));
      if (idx <= -1) return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl';
      if (idx === 0) return 'text-base sm:text-xl md:text-2xl lg:text-3xl';
      if (idx === 1) return 'text-sm sm:text-lg md:text-xl lg:text-2xl';
      if (idx === 2) return 'text-xs sm:text-base md:text-lg lg:text-xl';
      if (idx === 3) return 'text-xs sm:text-sm md:text-base lg:text-lg';
      return 'text-[11px] sm:text-xs md:text-sm lg:text-base';
    }

    let tier = 0;
    if (len <= 36) tier = 0;
    else if (len <= 68) tier = 1;
    else if (len <= 105) tier = 2;
    else if (len <= 145) tier = 3;
    else tier = 4;

    const idx = Math.max(-1, Math.min(4, tier + scaleShift));
    if (idx <= -1) return 'text-2xl sm:text-4xl md:text-5xl lg:text-[3.25rem]';
    if (idx === 0) return 'text-xl sm:text-3xl md:text-4xl lg:text-[2.75rem]';
    if (idx === 1) return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl';
    if (idx === 2) return 'text-base sm:text-xl md:text-2xl lg:text-3xl';
    if (idx === 3) return 'text-sm sm:text-lg md:text-xl lg:text-2xl';
    return 'text-xs sm:text-base md:text-lg lg:text-xl';
  };

  const getOptionFontSize = (text: string, count = 4) => {
    const len = (text || '').trim().length;
    let tier = 0;
    if (len <= 8) tier = 0;
    else if (len <= 15) tier = 1;
    else if (len <= 24) tier = 2;
    else if (len <= 36) tier = 3;
    else tier = 4;

    if (count <= 2) tier -= 1;

    const idx = Math.max(-1, Math.min(4, tier + scaleShift));
    if (idx <= -1) return 'text-lg sm:text-2xl md:text-3xl lg:text-4xl';
    if (idx === 0) return 'text-base sm:text-xl md:text-2xl lg:text-3xl';
    if (idx === 1) return 'text-sm sm:text-lg md:text-xl lg:text-2xl';
    if (idx === 2) return 'text-xs sm:text-base md:text-lg lg:text-xl';
    if (idx === 3) return 'text-[11px] sm:text-sm md:text-base lg:text-lg';
    return 'text-[10px] sm:text-xs md:text-sm lg:text-base';
  };

  const renderQuestionText = (text: string) => {
    if (!text) return '';
    const parts = text.split(/_{2,}/);
    if (parts.length === 1) {
      return text;
    }
    return (
      <span>
        {parts.map((part, i) => (
          <React.Fragment key={i}>
            <span>{part}</span>
            {i < parts.length - 1 && (
              <span className="inline-block border-b-4 md:border-b-[5px] border-[#0284c7] min-w-[2.5rem] sm:min-w-[4rem] md:min-w-[5rem] mx-1.5 align-baseline translate-y-[-2px]" />
            )}
          </React.Fragment>
        ))}
      </span>
    );
  };

  // ==========================================================================
  // SCREEN 1: GAME SETUP EDITOR
  // ==========================================================================
  if (screen === 'setup') {
    return (
      <GameEditor
        game={activeGame!}
        onSave={saveGame}
        onPlayNow={(updatedGame) => {
          setActiveGame({
            ...updatedGame,
            questions: sanitizeQuestionsList(updatedGame.questions),
          });
          setScreen('menu');
        }}
        onCancel={() => {
          if (hasLoadedQuestions) {
            setScreen('menu');
          } else {
            onViewChange('games');
          }
        }}
        folders={folders}
      />
    );
  }

  // ==========================================================================
  // SCREEN 2: STUDY MODE
  // ==========================================================================
  if (screen === 'study') {
    const studyQuestions = questionsDB;
    const currentQ = studyQuestions[studyIndex] || studyQuestions[0];

    return (
      <div
        id="game-container"
        className="w-full min-h-full flex-1 bg-white text-black flex flex-col font-sans p-4 sm:p-6 md:p-8 relative select-none"
      >
        <div className="flex items-center justify-between p-4 bg-white rounded-2xl mb-8 border-2 border-slate-200 shadow-xs">
          <button
            onClick={() => setScreen('menu')}
            className="flex items-center gap-2 py-2 px-4 rounded-full transition-all bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-bold cursor-pointer"
          >
            <ArrowLeft size={20} className="text-black" /> Back to Menu
          </button>
          <div className="flex items-center gap-3">
            <div className="text-lg sm:text-xl font-black text-black">
              Question {studyIndex + 1} of {studyQuestions.length}
            </div>
            <div className="relative">
              <button
                onClick={() => setShowFontSizePopup((prev) => !prev)}
                className="px-3.5 py-2 rounded-full bg-white hover:bg-slate-100 border-2 border-slate-300 text-black font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer"
                title="Change Font Size (Small, Medium, Large)"
              >
                <Type size={16} className="text-black" />
                <span className="capitalize">{fontSizeScale}</span>
              </button>
              {showFontSizePopup && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFontSizePopup(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border-2 border-slate-300 p-2 z-50">
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-2.5 py-1">
                      Font Size
                    </div>
                    {(
                      [
                        { id: 'small', label: 'Small', badge: 'A' },
                        { id: 'medium', label: 'Medium', badge: 'A+' },
                        { id: 'large', label: 'Large', badge: 'A++' },
                      ] as const
                    ).map((item) => {
                      const active = fontSizeScale === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setFontSizeScale(item.id);
                            setShowFontSizePopup(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer mb-1 last:mb-0 ${
                            active ? 'bg-black text-white' : 'text-black hover:bg-slate-100'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-black ${
                              active ? 'bg-white/20 text-white' : 'bg-slate-100 text-black'
                            }`}
                          >
                            {item.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full">
          {studyQuestions.length > 0 ? (
            <>
              {(() => {
                const qParsed = parseOptionContent(currentQ?.text || '');
                const qImg = currentQ?.image || qParsed.imageUrl;
                const qDisplayText = qParsed.text || currentQ?.text || '';
                return (
                  <div className="flex flex-col items-center justify-center gap-4 mb-10 w-full">
                    {qImg && (
                      <img
                        src={qImg}
                        alt="Question"
                        className="max-h-52 sm:max-h-64 w-auto rounded-2xl object-contain bg-slate-50 border-2 border-slate-200 p-2 shadow-md"
                      />
                    )}
                    {qDisplayText && (
                      <h1
                        className={`${getQuestionFontSize(
                          qDisplayText,
                          false
                        )} font-black text-black tracking-tight leading-snug text-center max-w-full break-words`}
                      >
                        {renderQuestionText(qDisplayText)}
                      </h1>
                    )}
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {currentQ?.options.map((rawOpt, i) => {
                  const opt = stripOptionPrefix(rawOpt);
                  if (!opt) return null;
                  const isSelected = studySelectedOption === i;
                  const isCorrect = i === currentQ.answerIndex;
                  const showAsCorrect = studySelectedOption !== null && isCorrect;
                  const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (studySelectedOption === null) {
                          setStudySelectedOption(i);
                        }
                      }}
                      disabled={studySelectedOption !== null}
                      className={`relative p-6 rounded-2xl ${getOptionFontSize(
                        opt,
                        2
                      )} font-bold transition-all duration-200 border-2 cursor-pointer touch-manipulation ${
                        showAsCorrect
                          ? 'bg-green-500 text-white border-green-600 shadow-[0_6px_0_#15803d] scale-[1.02] z-10'
                          : showAsIncorrect
                            ? 'bg-red-500 text-white border-red-600 shadow-[0_4px_0_#991b1b]'
                            : studySelectedOption !== null
                              ? 'bg-white text-black/40 border-slate-200 shadow-none'
                              : 'bg-white text-black border-slate-300 hover:border-black hover:bg-slate-50 shadow-[0_5px_0_#cbd5e1]'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-4">
                        {(() => {
                          const parsed = parseOptionContent(opt);
                          return (
                            <>
                              {parsed.imageUrl && (
                                <img
                                  src={parsed.imageUrl}
                                  alt={parsed.text || 'Option'}
                                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-xl bg-white p-1 shrink-0"
                                />
                              )}
                              {parsed.text && <span>{parsed.text}</span>}
                            </>
                          );
                        })()}
                        {showAsCorrect && <span className="text-2xl font-black">✓</span>}
                        {showAsIncorrect && <span className="text-2xl font-black">✕</span>}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div
                className={`mt-12 h-20 transition-all duration-300 ${
                  studySelectedOption !== null
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
              >
                <button
                  onClick={() => {
                    if (studyIndex < studyQuestions.length - 1) {
                      setStudyIndex(studyIndex + 1);
                      setStudySelectedOption(null);
                    } else {
                      setScreen('menu');
                      setStudyIndex(0);
                      setStudySelectedOption(null);
                    }
                  }}
                  className="px-10 py-4 bg-black hover:bg-slate-800 text-white font-black text-xl rounded-full shadow-[0_6px_0_#334155] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                >
                  {studyIndex < studyQuestions.length - 1 ? 'Next Question →' : 'Finish Study'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-black text-3xl font-bold">No questions available!</div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 3: CHOOSE CUTE HAMSTER MENU
  // ==========================================================================
  if (screen === 'menu') {
    const leftInfo = HAMSTER_CHARACTER_OPTIONS.find((c) => c.id === leftCharacter);
    const rightInfo = HAMSTER_CHARACTER_OPTIONS.find((c) => c.id === rightCharacter);

    return (
      <div
        id="game-container"
        className="w-full min-h-full flex-1 bg-gradient-to-b from-slate-900 via-sky-950 to-slate-950 text-white flex flex-col justify-between font-sans p-4 sm:p-6 md:p-8 overflow-y-auto relative select-none"
      >
        {/* TOP HEADER BAR */}
        <div className="w-full max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/15 z-20 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewChange('home')}
              className="flex items-center gap-2 p-2.5 rounded-full transition-colors bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft size={22} />
            </button>
            <FullscreenButton targetId="game-container" />
            <button
              onClick={() => setShowModeModal(true)}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Switch Game Mode"
            >
              <Shuffle size={15} className="text-amber-400" />
              <span>Switch Mode</span>
            </button>
            <button
              onClick={() => setScreen('setup')}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
              title="Edit Questions"
            >
              <Edit3 size={15} className="text-sky-400" />
              <span>Edit Quiz</span>
            </button>
          </div>

          <div className="text-center flex-1 min-w-[200px]">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-white italic uppercase tracking-tight leading-none drop-shadow">
              {activeGame?.title || 'SHARK ATTACK'}
            </h1>
            <p className="text-amber-300 font-bold text-xs sm:text-sm uppercase tracking-widest mt-1">
              {activeGame?.topic || 'Choose Your Cute Hamsters & Start Battle'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setStudyIndex(0);
                setStudySelectedOption(null);
                setScreen('study');
              }}
              className="px-4 sm:px-5 py-2.5 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all hover:scale-105 cursor-pointer"
            >
              <span>📖</span>
              <span>STUDY MODE</span>
            </button>
          </div>
        </div>

        {/* FULL-SCREEN CHOOSE CUTE HAMSTER ARENA */}
        <div className="w-full max-w-[1440px] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch my-4 z-20">
          {/* BLUE TEAM HAMSTER ROSTER (5 cols) */}
          <div className="lg:col-span-5 bg-blue-950/65 border-2 border-blue-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block shadow-[0_0_10px_#3b82f6]" />
                <span className="font-black text-base sm:text-lg md:text-xl text-blue-300 uppercase tracking-wider">
                  Choose Blue Hamster
                </span>
              </div>
              <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full shadow">
                {leftInfo?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
              {HAMSTER_CHARACTER_OPTIONS.map((opt) => {
                const selected = leftCharacter === opt.id;
                return (
                  <button
                    key={`menu-left-${opt.id}`}
                    onClick={() => setLeftCharacter(opt.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-amber-300 shadow-[0_0_20px_rgba(59,130,246,0.65)] scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-blue-900/50 text-slate-200 border-blue-500/30 hover:border-blue-400'
                    }`}
                  >
                    <div className="py-1 flex items-center justify-center">
                      <CuteHamsterCharacter team="left" character={opt.id} size="card" />
                    </div>
                    <div className="mt-1">
                      <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                      <div
                        className={`text-[10px] font-semibold mt-0.5 ${
                          selected ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {opt.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER LIVE MATCHUP SHOWCASE (2 cols) */}
          <div className="lg:col-span-2 bg-gradient-to-b from-sky-200 via-cyan-100 to-blue-300 text-slate-900 rounded-3xl p-4 sm:p-5 border-4 border-amber-400 shadow-2xl flex flex-col items-center justify-between gap-3">
            <div className="flex flex-col items-center text-center w-full">
              <span className="text-[11px] font-black uppercase tracking-wider text-white bg-blue-600 px-3 py-0.5 rounded-full shadow mb-1">
                Blue: {leftInfo?.name}
              </span>
              <CuteHamsterCharacter team="left" character={leftCharacter} compact />
            </div>

            <div className="w-12 h-12 rounded-full bg-amber-400 border-4 border-white shadow-lg flex items-center justify-center font-black italic text-xl text-slate-950 shrink-0">
              VS
            </div>

            <div className="flex flex-col items-center text-center w-full">
              <CuteHamsterCharacter team="right" character={rightCharacter} compact />
              <span className="text-[11px] font-black uppercase tracking-wider text-white bg-red-600 px-3 py-0.5 rounded-full shadow mt-1">
                Red: {rightInfo?.name}
              </span>
            </div>
          </div>

          {/* RED TEAM HAMSTER ROSTER (5 cols) */}
          <div className="lg:col-span-5 bg-red-950/65 border-2 border-red-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-[0_0_10px_#ef4444]" />
                <span className="font-black text-base sm:text-lg md:text-xl text-red-300 uppercase tracking-wider">
                  Choose Red Hamster
                </span>
              </div>
              <span className="bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full shadow">
                {rightInfo?.name}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
              {HAMSTER_CHARACTER_OPTIONS.map((opt) => {
                const selected = rightCharacter === opt.id;
                return (
                  <button
                    key={`menu-right-${opt.id}`}
                    onClick={() => setRightCharacter(opt.id)}
                    className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-amber-300 shadow-[0_0_20px_rgba(239,68,68,0.65)] scale-[1.03]'
                        : 'bg-slate-900/80 hover:bg-red-900/50 text-slate-200 border-red-500/30 hover:border-red-400'
                    }`}
                  >
                    <div className="py-1 flex items-center justify-center">
                      <CuteHamsterCharacter team="right" character={opt.id} size="card" />
                    </div>
                    <div className="mt-1">
                      <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                      <div
                        className={`text-[10px] font-semibold mt-0.5 ${
                          selected ? 'text-red-100' : 'text-slate-400'
                        }`}
                      >
                        {opt.title}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR + 1 TO 10 MINUTES TIMER SLIDER */}
        <div className="w-full max-w-[1440px] mx-auto flex flex-col lg:flex-row items-center justify-center gap-4 pt-2 z-20 shrink-0">
          {/* 1 to 10 Minutes Timer Slider Pill on Menu */}
          <div className="bg-slate-900/90 border-2 border-amber-400/80 rounded-full px-5 py-2.5 flex items-center gap-3 shadow-xl">
            <div className="flex items-center gap-1.5 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap">
              <Clock size={16} className="text-amber-400" />
              <span>Timer:</span>
              <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm">
                {timerMinutes} {timerMinutes === 1 ? 'Min' : 'Mins'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-400">1m</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={timerMinutes}
                onChange={(e) => handleTimerSliderChange(Number(e.target.value))}
                className="w-28 sm:w-36 accent-amber-400 cursor-pointer h-2 bg-slate-700 rounded-lg"
                title="Adjust Match Timer (1 to 10 Minutes)"
              />
              <span className="text-[11px] font-black text-slate-400">10m</span>
            </div>
          </div>

          <button
            onClick={() => setShowStartBattleModal(true)}
            className="bg-yellow-400 hover:bg-yellow-300 text-slate-950 text-xl sm:text-2xl md:text-3xl font-black px-14 py-4 sm:py-5 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full sm:w-auto cursor-pointer hover:scale-105"
          >
            🦈 START BATTLE
          </button>
          <button
            onClick={() => {
              setStudyIndex(0);
              setStudySelectedOption(null);
              setScreen('study');
            }}
            className="bg-white hover:bg-slate-100 text-slate-900 text-lg sm:text-xl font-black px-10 py-4 sm:py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-none transition-all w-full sm:w-auto flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>📖</span> STUDY MODE
          </button>
        </div>

        {/* Battle Mode Selection Modal */}
        {showStartBattleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 max-w-xl w-full text-center shadow-2xl border-4 border-amber-400 relative">
              <button
                onClick={() => setShowStartBattleModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
                title="Close"
              >
                <X size={24} />
              </button>

              <div className="flex justify-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md" />
                <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white shadow-md" />
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
                Choose Battle Mode
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-4">
                Choose how questions will appear in this Shark Attack battle:
              </p>

              {/* 1 to 10 Minutes Match Timer Slider in Modal */}
              <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 mb-5 text-left">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-600" />
                    Match Timer (1 – 10 Minutes)
                  </span>
                  <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                    {timerMinutes} {timerMinutes === 1 ? 'Minute' : 'Minutes'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500">1m</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={timerMinutes}
                    onChange={(e) => handleTimerSliderChange(Number(e.target.value))}
                    className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-300 rounded-lg"
                  />
                  <span className="text-xs font-bold text-slate-500">10m</span>
                </div>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">
                  When time ends, the hamster with the highest steps (closest to the edge) is eaten by the shark!
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
                <button
                  onClick={() => startGame(false, 'single')}
                  className="group p-5 rounded-3xl border-3 border-amber-300 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">🎯</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">
                        Single Question
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Both Blue and Red race to answer{' '}
                      <strong className="text-slate-900">1 shared question</strong> centered in the
                      middle of the arena.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-amber-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Single Battle →
                  </div>
                </button>

                <button
                  onClick={() => startGame(false, 'split')}
                  className="group p-5 rounded-3xl border-3 border-indigo-300 hover:border-indigo-500 bg-indigo-50/70 hover:bg-indigo-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">⚡</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">
                        Split Questions
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Each team has their own{' '}
                      <strong className="text-slate-900">randomized question order</strong>{' '}
                      appearing directly on Blue side and Red side.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-indigo-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Split Battle →
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowStartBattleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'shark-attack',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS,
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 4: MATCH END CELEBRATION
  // ==========================================================================
  if (screen === 'end') {
    return (
      <div
        id="game-container"
        className="w-full min-h-full flex-1 bg-slate-100 dark:bg-black/95 flex items-center justify-center font-sans p-2 sm:p-4 overflow-y-auto relative select-none"
      >
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
          <button
            onClick={() => onViewChange('home')}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20 cursor-pointer"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />
          <button
            onClick={() => setShowModeModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Shuffle size={14} className="text-amber-400" />
            <span>Switch Mode</span>
          </button>
          <button
            onClick={() => {
              setLeftTeam((prev: any) => ({ ...prev, wins: 0 }));
              setRightTeam((prev: any) => ({ ...prev, wins: 0 }));
              setScreen('menu');
            }}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 border-red-300/50 dark:border-red-500/20 shadow-sm cursor-pointer"
            title="Quit to Menu"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white p-10 md:p-16 rounded-[2.5rem] text-center shadow-2xl border-8 border-yellow-400 max-w-xl w-full">
          <div className="flex justify-center mb-4">
            <CuteHamsterCharacter
              team={winner === 'Blue Team' ? 'left' : 'right'}
              character={winner === 'Blue Team' ? leftCharacter : rightCharacter}
              isWinner
              compact
            />
          </div>
          {timeUpBanner && (
            <div className="mb-3 inline-block px-4 py-1.5 rounded-full bg-rose-100 border-2 border-rose-300 text-rose-700 font-black text-xs sm:text-sm uppercase tracking-wide">
              {timeUpBanner}
            </div>
          )}
          <h2
            className={`text-5xl md:text-7xl font-black mb-3 uppercase italic ${
              winner === 'Blue Team' ? 'text-blue-600' : 'text-red-600'
            }`}
          >
            {winner}
          </h2>
          <p className="text-2xl font-black text-slate-800 mb-10 uppercase tracking-widest">
            Wins the Match! 🦈
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={() => startGame(true)}
              className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-8 py-5 rounded-full shadow-[0_6px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            >
              Continue
            </button>
            <button
              onClick={() => {
                setLeftTeam((prev: any) => ({ ...prev, wins: 0 }));
                setRightTeam((prev: any) => ({ ...prev, wins: 0 }));
                startGame(false);
              }}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold px-8 py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-none transition-all cursor-pointer"
            >
              Restart
            </button>
          </div>
        </div>

        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'shark-attack',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS,
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

  // ==========================================================================
  // SCREEN 5: IN-GAME BATTLE ARENA
  // ==========================================================================
  const currentQText = leftTeam.q?.text || rightTeam.q?.text || DEFAULT_QUESTIONS[0].text;
  const isLowTime = timeLeftSeconds <= 30;

  return (
    <div
      id="game-container"
      className="w-full min-h-full flex-1 select-none overflow-hidden font-sans relative flex flex-col justify-between p-2 sm:p-3 md:p-4 bg-gradient-to-b from-sky-200 via-cyan-100 to-sky-300"
    >
      {/* TOP ROW */}
      <div className="w-full flex flex-wrap items-center justify-between shrink-0 z-50 relative gap-2 sm:gap-3 px-1 sm:px-2 mb-1.5 sm:mb-2">
        <button
          onClick={() => setScreen('menu')}
          className="p-2 sm:p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-slate-300 transition-all cursor-pointer hover:scale-105 active:scale-95"
          title="Back to Hamster Menu"
        >
          <ArrowLeft size={22} className="stroke-[2.5]" />
        </button>

        {/* Blue Team Banner, IN-GAME 1-10 MINUTES TIMER SLIDER, and Red Team Banner */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
          {/* Blue Team Scoreboard Banner */}
          <div className="bg-[#0055fe] rounded-2xl md:rounded-3xl px-2.5 sm:px-3.5 md:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-blue-500/25 border-b-4 border-[#0038b3]">
            <button
              onClick={() => setShowCharacterModal(true)}
              className="bg-white/95 hover:bg-white rounded-full p-0.5 shadow-sm flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
              title="Change Blue Team Hamster"
            >
              <CuteHamsterCharacter team="left" character={leftCharacter} size="icon" />
            </button>
            <span className="font-black italic text-xs sm:text-sm md:text-base lg:text-lg text-white uppercase tracking-wider select-none">
              BLUE TEAM
            </span>
            <div className="bg-white text-blue-700 font-black text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 rounded-full shadow-sm tracking-wide">
              {leftTeam.wins} WINS
            </div>
          </div>

          {/* IN-GAME 1 TO 10 MINUTES TIMER SLIDER & COUNTDOWN HUD */}
          <div
            className={`rounded-2xl md:rounded-3xl px-3 sm:px-4 py-1 sm:py-1.5 flex items-center gap-2 sm:gap-3 shadow-lg border-2 transition-colors ${
              isLowTime
                ? 'bg-rose-600 text-white border-amber-300 animate-pulse'
                : 'bg-slate-900/95 text-white border-amber-400'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Clock
                size={16}
                className={isLowTime ? 'text-yellow-300 animate-spin' : 'text-amber-400'}
              />
              <span className="font-mono font-black text-sm sm:text-base md:text-lg tracking-wider tabular-nums">
                {formatTimer(timeLeftSeconds)}
              </span>
            </div>

            {/* Interactive 1 to 10 Minutes Slider directly In-Game */}
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
              <span className="text-[10px] font-black text-amber-300">1m</span>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={timerMinutes}
                onChange={(e) => handleTimerSliderChange(Number(e.target.value))}
                className="w-20 sm:w-28 md:w-32 accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                title="In-Game Timer Slider (1 to 10 Minutes)"
              />
              <span className="text-[10px] font-black text-amber-300">10m</span>
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] whitespace-nowrap">
                {timerMinutes}m
              </span>
            </div>

            <button
              onClick={() => setTimerPaused((p) => !p)}
              className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer"
              title={timerPaused ? 'Resume Timer' : 'Pause Timer'}
            >
              {timerPaused ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              onClick={() => {
                setTimeLeftSeconds(timerMinutes * 60);
                setTimerPaused(false);
              }}
              className="p-1 rounded-full bg-white/15 hover:bg-white/25 text-white transition-all cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Red Team Scoreboard Banner */}
          <div className="bg-[#cc0000] rounded-2xl md:rounded-3xl px-2.5 sm:px-3.5 md:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-red-500/25 border-b-4 border-[#990000]">
            <div className="bg-white text-red-700 font-black text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 rounded-full shadow-sm tracking-wide">
              {rightTeam.wins} WINS
            </div>
            <span className="font-black italic text-xs sm:text-sm md:text-base lg:text-lg text-white uppercase tracking-wider select-none">
              RED TEAM
            </span>
            <button
              onClick={() => setShowCharacterModal(true)}
              className="bg-white/95 hover:bg-white rounded-full p-0.5 shadow-sm flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
              title="Change Red Team Hamster"
            >
              <CuteHamsterCharacter team="right" character={rightCharacter} size="icon" />
            </button>
          </div>
        </div>

        {/* TOP RIGHT CONTROLS */}
        <div className="relative flex items-center gap-1.5 sm:gap-2 bg-white/90 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full shadow-md border border-slate-200">
          <button
            onClick={() => setShowCharacterModal(true)}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[11px] sm:text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Choose Cute Hamsters"
          >
            <Users size={15} className="text-amber-700" />
            <span className="hidden sm:inline">Hamsters</span>
          </button>

          <button
            onClick={() => setShowStartBattleModal(true)}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-900 font-black text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer"
            title="Switch Single or Split Question Mode"
          >
            <span>{questionMode === 'single' ? '🎯 Single' : '⚡ Split'}</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowFontSizePopup((prev) => !prev)}
              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full font-black text-[11px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer ${
                showFontSizePopup
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-900'
              }`}
              title="Adjust Font Size"
            >
              <Type size={15} />
              <span className="hidden md:inline capitalize">{fontSizeScale}</span>
            </button>

            {showFontSizePopup && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFontSizePopup(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border-2 border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2.5 py-1">
                    Font Size
                  </div>
                  {(
                    [
                      { id: 'small', label: 'Small', badge: 'A' },
                      { id: 'medium', label: 'Medium', badge: 'A+' },
                      { id: 'large', label: 'Large', badge: 'A++' },
                    ] as const
                  ).map((item) => {
                    const active = fontSizeScale === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setFontSizeScale(item.id);
                          setShowFontSizePopup(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-black text-xs sm:text-sm transition-all cursor-pointer mb-1 last:mb-0 ${
                          active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{item.label}</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-black ${
                            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <FullscreenButton
            targetId="game-container"
            className="!p-1.5 sm:!p-2 !rounded-full !bg-blue-100 hover:!bg-blue-200 !text-blue-700 !border-0 !shadow-none cursor-pointer"
          />
          <button
            onClick={() => setSoundMuted(!soundMuted)}
            className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
            title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {soundMuted ? (
              <VolumeX size={20} className="text-red-500" />
            ) : (
              <Volume2 size={20} className="text-emerald-600" />
            )}
          </button>
          <button
            onClick={() => setShowModeModal(true)}
            className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
            title="Switch Game Mode"
          >
            <Shuffle size={20} />
          </button>
        </div>
      </div>

      {/* CENTER SHARK LAGOON & STAIRCASE ARENA + SINGLE QUESTION BANNER */}
      <div className="flex-1 w-full max-w-[1440px] mx-auto flex flex-col items-center justify-center relative pb-1.5 overflow-visible">
        <SharkLagoonArena
          leftStep={leftTeam.step}
          rightStep={rightTeam.step}
          leftFloatingFeedback={leftFeedback}
          rightFloatingFeedback={rightFeedback}
          leftCharacter={leftCharacter}
          rightCharacter={rightCharacter}
          leftPushing={leftTeam.pushing}
          rightPushing={rightTeam.pushing}
          leftStunned={leftTeam.stunned}
          rightStunned={rightTeam.stunned}
          leftFrozen={leftTeam.frozen}
          rightFrozen={rightTeam.frozen}
          sharkLungeSide={sharkLungeSide}
          fallingPhase={fallingPhase}
          winner={winner}
          isRumbling={isRumbling}
          timeUpBanner={timeUpBanner}
        />

        {questionMode === 'single' && (() => {
          const singleQ = leftTeam.q || rightTeam.q;
          const qParsed = parseOptionContent(currentQText || '');
          const qImg = singleQ?.image || qParsed.imageUrl;
          const qDisplayText = qParsed.text || currentQText;
          return (
            <div className="w-full max-w-5xl mx-auto pt-2 pb-1 px-4 text-center z-20 shrink-0 pointer-events-none">
              <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl py-3 sm:py-4 px-6 sm:px-10 shadow-xl border-2 border-sky-900/15 flex items-center justify-center gap-4">
                {qImg && (
                  <img
                    src={qImg}
                    alt="Question"
                    className="h-14 sm:h-20 w-auto max-w-[140px] rounded-xl object-contain bg-sky-50 border border-sky-200 p-1 shrink-0 shadow-sm"
                  />
                )}
                {qDisplayText && (
                  <div
                    className={`${getQuestionFontSize(
                      qDisplayText,
                      false
                    )} font-black text-[#0f172a] leading-snug tracking-tight drop-shadow-xs break-words`}
                  >
                    {renderQuestionText(qDisplayText)}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* BOTTOM ANSWER AREA (CLEAN OPTION TEXT WITH NO A/B/C/D PREFIX + TABLET MULTI-TOUCH SUPPORT) */}
      <div className="w-full max-w-[1440px] mx-auto flex flex-col md:flex-row gap-2 sm:gap-3 md:gap-5 shrink-0 z-20">
        {/* BLUE TEAM ANSWER CONTAINER (LEFT) */}
        <div
          className={`flex-1 bg-[#0055fe] rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-2 sm:p-4 md:p-5 shadow-2xl border-b-4 md:border-b-8 border-[#0038b3] flex flex-col justify-between transition-all duration-200 ${
            leftTeam.pushing
              ? 'ring-4 ring-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.65)] scale-[1.01]'
              : sharkLungeSide === 'left'
                ? 'ring-4 ring-rose-500 animate-pulse'
                : ''
          }`}
        >
          {questionMode === 'split' && (() => {
            const qParsed = parseOptionContent(leftTeam.q?.text || '');
            const qImg = leftTeam.q?.image || qParsed.imageUrl;
            const qDisplayText = qParsed.text || leftTeam.q?.text || '';
            return (
              <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl p-2.5 sm:p-4 mb-1.5 sm:mb-3.5 shadow-lg border-2 border-blue-400/40 text-center flex items-center justify-center gap-3 min-h-[56px] sm:min-h-[88px]">
                {qImg && (
                  <img
                    src={qImg}
                    alt="Question"
                    className="h-12 sm:h-16 w-auto max-w-[110px] rounded-xl object-contain bg-blue-50 border border-blue-200 p-1 shrink-0"
                  />
                )}
                {qDisplayText && (
                  <div
                    className={`${getQuestionFontSize(
                      qDisplayText,
                      true
                    )} font-black text-[#0f172a] leading-snug px-1.5 break-words`}
                  >
                    {renderQuestionText(qDisplayText)}
                  </div>
                )}
              </div>
            );
          })()}

          <div
            className={`grid gap-1.5 sm:gap-3 md:gap-4 ${
              (leftTeam.q?.options?.length || 4) === 2
                ? 'grid-cols-2'
                : (leftTeam.q?.options?.length || 4) === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
            }`}
          >
            {leftTeam.q?.options.map((rawOpt: string, idx: number) => {
              const opt = stripOptionPrefix(rawOpt);
              const keyHints = getBlueKeyHints(leftTeam.q?.options?.length || 4);
              const isKeyActive = activeKey?.team === 'left' && activeKey?.index === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                      e.preventDefault();
                      lastTouchTimeRef.current = Date.now();
                      triggerOptionPress('left', idx);
                    }
                  }}
                  onClick={() => {
                    if (Date.now() - lastTouchTimeRef.current < 450) return;
                    triggerOptionPress('left', idx);
                  }}
                  disabled={leftTeam.stunned || leftTeam.frozen}
                  className={`touch-manipulation select-none bg-white hover:bg-blue-50 active:translate-y-2 rounded-xl sm:rounded-2xl md:rounded-3xl p-1.5 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[56px] sm:min-h-[80px] md:min-h-[104px] lg:min-h-[118px] shadow-[0_3px_0_#cbd5e1] sm:shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                    isKeyActive
                      ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-blue-100 ring-4 ring-white'
                      : ''
                  } ${leftTeam.stunned || leftTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded sm:rounded-lg bg-[#dbeafe] flex items-center justify-center font-black text-[#0055fe] text-[9px] sm:text-xs md:text-sm shadow-xs mb-0.5 sm:mb-1 shrink-0">
                    {keyHints[idx] || idx + 1}
                  </div>
                  <div className="flex-1 w-full flex flex-col items-center justify-center gap-1 px-1 overflow-hidden">
                    {(() => {
                      const parsed = parseOptionContent(opt);
                      return (
                        <>
                          {parsed.imageUrl && (
                            <img
                              src={parsed.imageUrl}
                              alt={parsed.text || `Option ${idx + 1}`}
                              className={`${
                                parsed.text ? 'max-h-10 sm:max-h-12' : 'max-h-14 sm:max-h-20'
                              } w-full object-contain rounded-lg pointer-events-none`}
                            />
                          )}
                          {parsed.text && (
                            <span
                              className={`${getOptionFontSize(
                                parsed.text,
                                leftTeam.q?.options?.length || 4
                              )} font-black text-[#0f172a] text-center leading-tight [overflow-wrap:normal] whitespace-normal line-clamp-2 pointer-events-none`}
                            >
                              {parsed.text}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RED TEAM ANSWER CONTAINER (RIGHT) */}
        <div
          className={`flex-1 bg-[#cc0000] rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-2 sm:p-4 md:p-5 shadow-2xl border-b-4 md:border-b-8 border-[#990000] flex flex-col justify-between transition-all duration-200 ${
            rightTeam.pushing
              ? 'ring-4 ring-emerald-400 shadow-[0_0_28px_rgba(52,211,153,0.65)] scale-[1.01]'
              : sharkLungeSide === 'right'
                ? 'ring-4 ring-amber-400 animate-pulse'
                : ''
          }`}
        >
          {questionMode === 'split' && (
            <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-3xl p-2.5 sm:p-4 mb-1.5 sm:mb-3.5 shadow-lg border-2 border-red-400/40 text-center flex flex-col items-center justify-center min-h-[56px] sm:min-h-[88px] gap-1.5">
              {(() => {
                const parsedQ = parseOptionContent(rightTeam.q?.text || '');
                const qImg = rightTeam.q?.image || parsedQ.imageUrl;
                const qText = rightTeam.q?.image ? rightTeam.q?.text || '' : (parsedQ.text || rightTeam.q?.text || '');
                return (
                  <>
                    {qImg && (
                      <img
                        src={qImg}
                        alt="Question"
                        className="max-h-14 sm:max-h-20 md:max-h-24 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1 shadow-sm"
                      />
                    )}
                    {qText && (
                      <div
                        className={`${getQuestionFontSize(
                          qText,
                          true
                        )} font-black text-[#0f172a] leading-snug px-1.5 break-words`}
                      >
                        {renderQuestionText(qText)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div
            className={`grid gap-1.5 sm:gap-3 md:gap-4 ${
              (rightTeam.q?.options?.length || 4) === 2
                ? 'grid-cols-2'
                : (rightTeam.q?.options?.length || 4) === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
            }`}
          >
            {rightTeam.q?.options.map((rawOpt: string, idx: number) => {
              const opt = stripOptionPrefix(rawOpt);
              const keyHints = getRedKeyHints(rightTeam.q?.options?.length || 4);
              const isKeyActive = activeKey?.team === 'right' && activeKey?.index === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                      e.preventDefault();
                      lastTouchTimeRef.current = Date.now();
                      triggerOptionPress('right', idx);
                    }
                  }}
                  onClick={() => {
                    if (Date.now() - lastTouchTimeRef.current < 450) return;
                    triggerOptionPress('right', idx);
                  }}
                  disabled={rightTeam.stunned || rightTeam.frozen}
                  className={`touch-manipulation select-none bg-white hover:bg-red-50 active:translate-y-2 rounded-xl sm:rounded-2xl md:rounded-3xl p-1.5 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[56px] sm:min-h-[80px] md:min-h-[104px] lg:min-h-[118px] shadow-[0_3px_0_#cbd5e1] sm:shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                    isKeyActive
                      ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-red-100 ring-4 ring-white'
                      : ''
                  } ${rightTeam.stunned || rightTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded sm:rounded-lg bg-[#fee2e2] flex items-center justify-center font-black text-[#cc0000] text-[9px] sm:text-xs md:text-sm shadow-xs mb-0.5 sm:mb-1 shrink-0">
                    {keyHints[idx] || idx + 1}
                  </div>
                  <div className="flex-1 w-full flex flex-col items-center justify-center gap-1 px-1 overflow-hidden">
                    {(() => {
                      const parsed = parseOptionContent(opt);
                      return (
                        <>
                          {parsed.imageUrl && (
                            <img
                              src={parsed.imageUrl}
                              alt={parsed.text || `Option ${idx + 1}`}
                              className={`${
                                parsed.text ? 'max-h-10 sm:max-h-12' : 'max-h-14 sm:max-h-20'
                              } w-full object-contain rounded-lg pointer-events-none`}
                            />
                          )}
                          {parsed.text && (
                            <span
                              className={`${getOptionFontSize(
                                parsed.text,
                                rightTeam.q?.options?.length || 4
                              )} font-black text-[#0f172a] text-center leading-tight [overflow-wrap:normal] whitespace-normal line-clamp-2 pointer-events-none`}
                            >
                              {parsed.text}
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cute Hamster Picker Modal */}
      <HamsterCharacterPickerModal
        isOpen={showCharacterModal}
        leftCharacter={leftCharacter}
        rightCharacter={rightCharacter}
        onSelectLeft={setLeftCharacter}
        onSelectRight={setRightCharacter}
        onClose={() => setShowCharacterModal(false)}
      />

      {/* In-Game Question Mode Switcher Modal */}
      {showStartBattleModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 max-w-xl w-full text-center shadow-2xl border-4 border-amber-400 relative">
            <button
              onClick={() => setShowStartBattleModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              title="Close"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">
              Choose Question Mode
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-4">
              Switch between Single Shared Question and Split Questions:
            </p>

            {/* 1 to 10 Minutes Match Timer Slider in In-Game Modal */}
            <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 mb-5 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Clock size={15} className="text-amber-600" />
                  Match Timer (1 – 10 Minutes)
                </span>
                <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                  {timerMinutes} {timerMinutes === 1 ? 'Minute' : 'Minutes'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-500">1m</span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={timerMinutes}
                  onChange={(e) => handleTimerSliderChange(Number(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer h-2 bg-slate-300 rounded-lg"
                />
                <span className="text-xs font-bold text-slate-500">10m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
              <button
                onClick={() => startGame(false, 'single')}
                className="group p-5 rounded-3xl border-3 border-amber-300 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100/90 transition-all shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl">🎯</span>
                    <span className="font-black text-base sm:text-lg text-slate-900 uppercase">
                      Single Question
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Both Blue and Red race to answer 1 shared question centered under the arena.
                  </p>
                </div>
                <div className="mt-4 text-xs font-black text-amber-800 uppercase">
                  Play Single Mode →
                </div>
              </button>

              <button
                onClick={() => startGame(false, 'split')}
                className="group p-5 rounded-3xl border-3 border-indigo-300 hover:border-indigo-500 bg-indigo-50/70 hover:bg-indigo-100/90 transition-all shadow-md hover:shadow-xl cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-3xl">⚡</span>
                    <span className="font-black text-base sm:text-lg text-slate-900 uppercase">
                      Split Questions
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    Each team gets their own randomized question order on Blue side and Red side.
                  </p>
                </div>
                <div className="mt-4 text-xs font-black text-indigo-800 uppercase">
                  Play Split Mode →
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interchangeable Game Mode Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: activeGame?.id,
          name: activeGame?.title,
          topic: activeGame?.topic,
          className: activeGame?.classLevel,
          gameType: 'shark-attack',
          customQuestions: activeGame?.questions || DEFAULT_QUESTIONS,
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}

// ============================================================================
// GAME EDITOR
// ============================================================================
function GameEditor({
  game,
  onSave,
  onPlayNow,
  onCancel,
  folders,
}: {
  game: GameData;
  onSave: (q: GameData) => void;
  onPlayNow: (q: GameData) => void;
  onCancel: () => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(game.folderId || '');
  const [topic, setTopic] = useState(game.topic || '');
  const [classLevel, setClassLevel] = useState(game.classLevel || '');
  const [questions, setQuestions] = useState<Question[]>(() => {
    return game.questions.map((q) => {
      if (!q.options || q.options.length < 2) return { ...q, options: ['', ''], answerIndex: 0 };
      return { ...q, options: q.options.map((opt) => stripOptionPrefix(opt)) };
    });
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [activeGiphyInput, setActiveGiphyInput] = useState<{
    qId: number | string;
    optIndex: number | 'question';
    query?: string;
  } | null>(null);
  const [contentMode, setContentMode] = useState<AnswerContentMode>('both');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState<boolean>(true);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  const handleCopyAiPrompt = () => {
    navigator.clipboard.writeText(`Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`);
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 },
    ]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId) {
          const newOptions = [...q.options];
          newOptions[optIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const addOption = (qId: number | string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId && q.options.length < 6) {
          return { ...q, options: [...q.options, ''] };
        }
        return q;
      })
    );
  };

  const removeOption = (qId: number | string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId && q.options.length > 2) {
          const newOptions = [...q.options];
          newOptions.pop();
          const newAnswerIndex =
            q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
          return { ...q, options: newOptions, answerIndex: newAnswerIndex };
        }
        return q;
      })
    );
  };

  const removeQuestion = (id: number | string) => {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== id) : prev));
  };

  const duplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const qToCopy = prev[index];
      next.splice(index + 1, 0, {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options],
      });
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        addQuestion();
        setTimeout(() => {
          document.getElementById(`question-input-${index + 1}`)?.focus();
        }, 50);
      } else {
        document.getElementById(`question-input-${index + 1}`)?.focus();
      }
    }
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg('Please enter or paste at least one item.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const newItems: Question[] = parsed.map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || '',
      options: (item.options || ['', '']).map((o) => stripOptionPrefix(o)),
      answerIndex: item.answerIndex || 0,
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions((prev) => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }

    setShowBulkPasteModal(false);
    setBulkText('');
    setToastMsg(`Successfully added ${newItems.length} items!`);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleBulkPaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;
    const parsedItems = parsePastedQuiz(pastedText);
    if (
      parsedItems.length === 1 &&
      parsedItems[0].text === pastedText &&
      parsedItems[0].options?.every((o) => !o)
    ) {
      return;
    }
    if (parsedItems.length > 0) {
      e.preventDefault();
      const newItems: Question[] = parsedItems.map((item, i) => ({
        id: Date.now() + i + Math.random(),
        text: item.text || '',
        options: (item.options || ['', '']).map((o) => stripOptionPrefix(o)),
        answerIndex: item.answerIndex || 0,
      }));
      setQuestions((prev) => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
      setToastMsg(`Smart Paste: Added ${newItems.length} items`);
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const initiateSave = () => {
    const validQuestions = questions.filter((q) => q.text.trim() || q.image);
    if (validQuestions.length === 0) {
      setErrorMsg('Please add at least one complete question.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const handleSave = (isPublic: boolean) => {
    const validQuestions = questions
      .filter((q) => q.text.trim() || q.image)
      .map((q) => ({
        ...q,
        options: q.options.map((opt) => stripOptionPrefix(opt)),
      }));
    onSave({
      ...game,
      title: topic.trim() || 'Shark Attack',
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic,
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
          {toastMsg && (
            <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
              <div
                className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
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
                      onClick={() => { setShowBulkPasteModal(false); setBulkText(''); }}
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
                        <span>{copiedPromptInModal ? 'Copied Prompt!' : 'Copy AI Prompt'}</span>
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
                    placeholder={
                      'Example:\n1. What is the capital of France?\nA. London\nB. Paris\nC. Berlin\nD. Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!'
                    }
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

          {showPublishModal &&
            typeof document !== 'undefined' &&
            createPortal(
              <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                <div
                  className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 border border-slate-100 dark:border-slate-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white text-center">
                    Publish Game?
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 text-center font-medium">
                    Would you like to publish this game to the Community so other teachers can use
                    it?
                  </p>
                  <div className="flex flex-col gap-3 mt-4">
                    <button
                      onClick={() => handleSave(true)}
                      className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-lg shadow-lg transition-all cursor-pointer"
                    >
                      Yes, Publish (Public)
                    </button>
                    <button
                      onClick={() => handleSave(false)}
                      className="w-full py-4 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-lg transition-colors cursor-pointer"
                    >
                      No, Keep Private
                    </button>
                  </div>
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className="mt-2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                </div>
              </div>,
              document.body
            )}

          <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                GAME SETUP
              </h2>
              <div className="flex gap-3 items-center">
                <button
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const validQuestions = questions
                      .filter((q) => q.text.trim() || q.image)
                      .map((q) => ({
                        ...q,
                        options: q.options.map((opt) => stripOptionPrefix(opt)),
                      }));
                    onPlayNow({
                      ...game,
                      title: topic.trim() || 'Shark Attack',
                      folderId,
                      topic,
                      classLevel,
                      questions: validQuestions.length > 0 ? validQuestions : DEFAULT_QUESTIONS,
                    });
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 cursor-pointer"
                >
                  <Play size={18} /> Play Now
                </button>
                <button
                  onClick={initiateSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer"
                >
                  <Save size={18} /> Save GameData
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
              folders={folders}
              contentMode={contentMode}
              setContentMode={setContentMode}
              autoPhotosEnabled={autoPhotosEnabled}
              setAutoPhotosEnabled={setAutoPhotosEnabled}
              onApplyModeToAll={async (mode) => {
                const updated = await convertQuestionsContentMode(questions, mode);
                setQuestions(updated);
                setToastMsg(
                  mode === 'words'
                    ? '🔤 Switched all options to Words Only!'
                    : mode === 'photos_gifs'
                    ? '🖼️ Switched all options to Cartoon PNGs / GIFs!'
                    : '✨ Switched all options to Words + Cartoon PNGs!'
                );
                setTimeout(() => setToastMsg(''), 3000);
              }}
              onLoadStarterQuestions={(newQs, topicName) => {
                setQuestions(newQs);
                setToastMsg(`🦈 Loaded ${newQs.length} "${topicName}" questions with Cartoon PNGs!`);
                setTimeout(() => setToastMsg(''), 3500);
              }}
            />
          </div>

          {errorMsg && (
            <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
              {errorMsg}
            </div>
          )}

          <div
            className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50"
            onPaste={handleBulkPaste}
          >
            <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  <Info size={18} />
                </div>
                <p className="text-xs sm:text-sm font-medium">
                  <span className="font-bold">Smart Paste:</span> Paste multiple lines, numbered
                  Q&As, or Excel rows directly into any box below — they will automatically
                  populate!
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowVideoGuide(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer border border-purple-400/30"
                  title="Watch Video Tutorial: How to Bulk Paste with AI"
                >
                  <div className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                    <Play size={10} className="ml-0.5 fill-current" />
                  </div>
                  <span>How to Bulk Paste</span>
                </button>
                <button
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <ClipboardList size={14} /> Bulk Paste Modal
                </button>
              </div>
            </div>

            {questions.map((q, index) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group"
              >
                <button
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => removeQuestion(q.id)}
                  className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex gap-4 mb-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30 mt-2">
                    {index + 1}
                  </div>
                  <SmartQuestionInput
                    id={`question-input-${index}`}
                    value={q.text}
                    imageUrl={q.image}
                    onChange={(val) => updateQuestion(q.id, 'text', val)}
                    onChangeImage={(url) => updateQuestion(q.id, 'image', url)}
                    onOpenMediaPicker={(initialQ) =>
                      setActiveGiphyInput({ qId: q.id, optIndex: 'question', query: initialQ })
                    }
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    placeholder="Type your question here..."
                    autoPhotosEnabled={autoPhotosEnabled}
                  />
                </div>

                <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {q.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-start gap-2">
                      <input
                        type="radio"
                        name={`answer-${q.id}`}
                        checked={q.answerIndex === optIndex}
                        onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                        className="w-4 h-4 mt-3 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
                      />
                      <SmartOptionInput
                        value={opt}
                        onChange={(val) => updateOption(q.id, optIndex, val)}
                        onOpenMediaPicker={(initialQ) =>
                          setActiveGiphyInput({ qId: q.id, optIndex, query: initialQ })
                        }
                        placeholder={`Option ${optIndex + 1} (e.g. apple)`}
                        isCorrect={q.answerIndex === optIndex}
                        contentMode={contentMode}
                        autoPhotosEnabled={autoPhotosEnabled}
                      />
                    </div>
                  ))}
                </div>
                <div className="ml-12 mt-3 flex gap-2">
                  <button
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 6}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer"
                  >
                    + Option
                  </button>
                  <button
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
        initialQuery={activeGiphyInput?.query || ''}
        onClose={() => setActiveGiphyInput(null)}
        onSelect={(url) => {
          if (activeGiphyInput) {
            if (activeGiphyInput.optIndex === 'question') {
              updateQuestion(activeGiphyInput.qId, 'image', url);
            } else {
              const targetQ = questions.find((item) => item.id === activeGiphyInput.qId);
              const rawExisting = targetQ?.options[activeGiphyInput.optIndex] || '';
              const parsedExisting = parseOptionContent(rawExisting);
              const wordToKeep = parsedExisting.text || activeGiphyInput.query || '';
              const finalVal =
                contentMode === 'photos_gifs' || !wordToKeep
                  ? url
                  : formatOptionContent(wordToKeep, url, 'both');
              updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, finalVal);
            }
            setActiveGiphyInput(null);
          }
        }}
      />

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

function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim());
    lines.forEach((line) => {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length > 0) {
        items.push({
          text: parts[0],
          options: [
            stripOptionPrefix(parts[1] || ''),
            stripOptionPrefix(parts[2] || ''),
            stripOptionPrefix(parts[3] || ''),
            stripOptionPrefix(parts[4] || ''),
          ],
          answerIndex: 0,
        });
      }
    });
    if (items.length > 0) {
      items.forEach((q) => {
        if (q.options) {
          while (q.options.length > 2 && q.options[q.options.length - 1] === '') {
            q.options.pop();
          }
        }
      });
      return items;
    }
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  let currentQ: Partial<Question> | null = null;
  const optionRegex = /^([a-eA-E1-4])[\.\)\:\-]\s+(.*)/;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    const ansMatch = line.match(/^answer\s*[:=]?\s*([a-eA-E1-4])/i);
    if (ansMatch) {
      if (currentQ) {
        const val = ansMatch[1].toUpperCase();
        if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
        else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
      }
      continue;
    }

    const inlineAnswerMatch = line.match(/\banswer\s*[:=]?\s*([a-eA-E1-4])\b/i);
    let inlineAnswerIndex = -1;
    if (inlineAnswerMatch) {
      const val = inlineAnswerMatch[1].toUpperCase();
      if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
      else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
      line = line.replace(inlineAnswerMatch[0], '').trim();
    }

    if (line === '') continue;

    const optMatch = line.match(optionRegex);
    if (optMatch) {
      if (!currentQ) {
        currentQ = { text: 'Question', options: ['', '', '', ''], answerIndex: 0 };
        items.push(currentQ);
      }

      const optText = stripOptionPrefix(optMatch[2].trim());
      const prefix = optMatch[1].toUpperCase();
      let expectedIndex = -1;
      if (/[A-E]/.test(prefix)) expectedIndex = prefix.charCodeAt(0) - 65;
      else if (/[1-4]/.test(prefix)) expectedIndex = parseInt(prefix) - 1;

      if (expectedIndex >= 0 && expectedIndex < 4) {
        currentQ.options![expectedIndex] = optText;
      } else {
        const emptyIdx = currentQ.options!.findIndex((o) => o === '');
        if (emptyIdx !== -1) currentQ.options![emptyIdx] = optText;
      }

      if (inlineAnswerIndex !== -1) {
        currentQ.answerIndex = inlineAnswerIndex;
      }
    } else {
      const hasOptions = currentQ && currentQ.options!.some((o) => o !== '');
      const qText = line.replace(/^(?:\d+[\.\)\:\-]|\[\d+\])\s+/, '');

      if (!currentQ || hasOptions) {
        currentQ = { text: qText, options: ['', '', '', ''], answerIndex: 0 };
        items.push(currentQ);
        if (inlineAnswerIndex !== -1) {
          currentQ.answerIndex = inlineAnswerIndex;
        }
      } else {
        currentQ.text += ' ' + qText;
        if (inlineAnswerIndex !== -1) {
          currentQ.answerIndex = inlineAnswerIndex;
        }
      }
    }
  }

  items.forEach((q) => {
    if (q.options) {
      while (q.options.length < 4) {
        q.options.push('');
      }
    }
  });

  return items;
}
