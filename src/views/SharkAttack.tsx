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
import { persistUserGameToCloudAndCache } from '../utils/platformCache';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { FullscreenButton } from '../components/FullscreenButton';
import { GameModeModal } from '../components/GameModeModal';
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from '../components/SetupSmartControls';
import { parseOptionContent, formatOptionContent, AnswerContentMode } from '../utils/mediaAndPresets';
import {
  MysteryBox3DLobby,
  CuteHamsterAvatar,
  CUTE_HAMSTER_ICONS,
  TransparentCutoutImage,
  BoxDifficultyMode,
} from '../components/MysteryBox3DLobby';
import sharkAttackBannerImg from '../assets/images/shark_attack_banner_1795638231567.jpg';

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
let soundVolumeGlobal = 75;

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
  const volScale = Math.max(0, Math.min(1, soundVolumeGlobal / 100));
  if (soundMutedGlobal || volScale <= 0) return;
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
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volScale, now);
    masterGain.connect(ctx.destination);

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
        gain.connect(masterGain);
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
      gain.connect(masterGain);
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
      tGain.connect(masterGain);
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
      nGain.connect(masterGain);
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
      gain.connect(masterGain);
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
        gain.connect(masterGain);
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
        gain.connect(masterGain);
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
      gain.connect(masterGain);
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
      gain.connect(masterGain);
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
      nGain.connect(masterGain);
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
        gain.connect(masterGain);
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
// 20 UNIQUE 3D CUTE HAMSTER ROSTER & IN-GAME 3D CHARACTER COMPONENT
// ============================================================================
export type HamsterCharacterType =
  | number
  | 'mochi'
  | 'ichigo'
  | 'captain'
  | 'boba'
  | 'yuki'
  | 'oreo';

export interface HamsterCharacterOption {
  id: number;
  name: string;
  title: string;
}

export const HAMSTER_CHARACTER_OPTIONS: HamsterCharacterOption[] = CUTE_HAMSTER_ICONS.map(
  (icon) => ({
    id: icon.id,
    name: icon.name,
    title: icon.personality,
  })
);

export function resolveHamsterAvatarId(character?: HamsterCharacterType, fallback = 1): number {
  if (typeof character === 'number' && Number.isFinite(character)) {
    return ((Math.max(1, Math.round(character)) - 1) % CUTE_HAMSTER_ICONS.length) + 1;
  }
  const legacyMap: Record<string, number> = {
    mochi: 1,
    ichigo: 2,
    captain: 3,
    boba: 4,
    yuki: 5,
    oreo: 6,
  };
  if (typeof character === 'string' && character in legacyMap) {
    return legacyMap[character];
  }
  return fallback;
}

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
  character = 1,
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
  const avatarId = resolveHamsterAvatarId(character, isLeft ? 1 : 2);
  const meta = CUTE_HAMSTER_ICONS[avatarId - 1] || CUTE_HAMSTER_ICONS[0];
  const resolvedSize = size || (compact ? 'compact' : 'normal');

  if (resolvedSize === 'icon') {
    return (
      <CuteHamsterAvatar
        avatarId={avatarId}
        className={`w-[36px] h-[36px] sm:w-[44px] sm:h-[44px] ${className}`}
      />
    );
  }

  if (resolvedSize === 'card') {
    return (
      <CuteHamsterAvatar
        avatarId={avatarId}
        className={`w-[72px] h-[72px] sm:w-[86px] sm:h-[86px] ${className}`}
      />
    );
  }

  const sizeClasses =
    resolvedSize === 'compact'
      ? 'w-[108px] h-[108px] sm:w-[132px] sm:h-[132px] md:w-[152px] md:h-[152px]'
      : 'w-[80px] h-[80px] sm:w-[98px] sm:h-[98px] md:w-[114px] md:h-[114px] lg:w-[126px] lg:h-[126px]';

  const isPanic = isClimbing || isDangerEdge || hasLost;

  return (
    <div
      className={`relative z-20 ${sizeClasses} transition-all duration-300 ease-out select-none flex items-center justify-center ${className}`}
      style={{
        transform: `${
          isPushing
            ? 'translateY(-14px) scale(1.1)'
            : isClimbing
              ? 'translateY(-14px) scale(1.06)'
              : ''
        }`,
      }}
    >
      {/* Ground Shadow under 3D Hamster Feet */}
      {!hasLost && (
        <div
          className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 w-[66%] h-3 rounded-full"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.42) 0%, rgba(15,23,42,0) 75%)',
          }}
        />
      )}

      {/* Victory / Round Win Golden Glow Ring */}
      {(isPushing || isWinner) && (
        <div
          className="pointer-events-none absolute inset-1 rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(250,204,21,0.42) 0%, rgba(250,204,21,0) 72%)',
            boxShadow: '0 0 24px rgba(250, 204, 21, 0.75)',
          }}
        />
      )}

      {/* 3D Full-Body Hamster Character with Transparent Cutout Background */}
      <div
        className={`relative w-full h-full flex items-center justify-center ${
          isPanic ? 'animate-bounce' : ''
        }`}
      >
        <TransparentCutoutImage
          src={meta.imageSrc}
          alt={meta.name}
          className="w-full h-full object-contain drop-shadow-[0_6px_12px_rgba(15,23,42,0.42)] select-none pointer-events-none"
        />
      </div>

      {/* Stunned Dizzy Stars Overlay */}
      {isStunned && (
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-400/95 border-2 border-white shadow-md text-xs sm:text-sm font-black text-slate-950 animate-bounce whitespace-nowrap">
          💫 STUNNED!
        </div>
      )}

      {/* Frozen Ice Cube Overlay */}
      {isFrozen && (
        <div className="pointer-events-none absolute inset-1 rounded-2xl bg-sky-300/55 border-4 border-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.85)] flex items-center justify-center">
          <span className="px-2 py-0.5 rounded-full bg-sky-900/85 text-white font-black text-[10px] sm:text-xs border border-sky-200">
            ❄️ FROZEN
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// IN-GAME 20-CHARACTER 3D HAMSTER PICKER MODAL
// ============================================================================
export const HamsterCharacterPickerModal: React.FC<{
  isOpen: boolean;
  leftCharacter: HamsterCharacterType;
  rightCharacter: HamsterCharacterType;
  leftTeamName?: string;
  rightTeamName?: string;
  onSelectLeft: (c: number) => void;
  onSelectRight: (c: number) => void;
  onClose: () => void;
}> = ({
  isOpen,
  leftCharacter,
  rightCharacter,
  leftTeamName = 'Team 1',
  rightTeamName = 'Team 2',
  onSelectLeft,
  onSelectRight,
  onClose,
}) => {
  const [activeTeamSide, setActiveTeamSide] = useState<'left' | 'right'>('left');

  if (!isOpen) return null;

  const leftId = resolveHamsterAvatarId(leftCharacter, 1);
  const rightId = resolveHamsterAvatarId(rightCharacter, 2);

  return (
    <div
      className="fixed inset-0 z-[120] bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl rounded-[36px] p-5 sm:p-7 border-[5px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.55),0_8px_0_#4ca6ee] flex flex-col gap-5 max-h-[92vh] overflow-y-auto"
        style={{
          fontFamily: '"Fredoka", "Baloo 2", "Plus Jakarta Sans", "Nunito", sans-serif',
          background:
            'linear-gradient(180deg, #b8e1ff 0%, #dff2ff 24%, #f2faff 54%, #b5deff 100%)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl sm:text-3xl font-black text-[#0c2d57] uppercase tracking-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
            CHOOSE TEAM HAMSTERS
          </h2>

          {/* Team Switcher Tabs */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTeamSide('left')}
              className={`px-4 py-2 rounded-2xl font-black text-sm sm:text-base border-[2.5px] transition-all cursor-pointer flex items-center gap-2 ${
                activeTeamSide === 'left'
                  ? 'bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] text-white border-[#0c2d57] shadow-[0_4px_0_#0c2d57]'
                  : 'bg-white/80 text-[#0c2d57] border-[#0c2d57]/30 hover:bg-white'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-blue-400 border border-white" />
              <span>{leftTeamName}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTeamSide('right')}
              className={`px-4 py-2 rounded-2xl font-black text-sm sm:text-base border-[2.5px] transition-all cursor-pointer flex items-center gap-2 ${
                activeTeamSide === 'right'
                  ? 'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] text-white border-[#450a0a] shadow-[0_4px_0_#450a0a]'
                  : 'bg-white/80 text-[#0c2d57] border-[#0c2d57]/30 hover:bg-white'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-red-400 border border-white" />
              <span>{rightTeamName}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white hover:bg-rose-50 text-[#0c2d57] hover:text-rose-600 border-2 border-[#0c2d57]/20 shadow-[0_3px_0_rgba(12,45,87,0.2)] flex items-center justify-center cursor-pointer"
          >
            <X size={20} className="stroke-[3]" />
          </button>
        </div>

        {/* 20 Unique 3D Hamsters Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-3 items-center justify-items-center py-2">
          {CUTE_HAMSTER_ICONS.map((icon) => {
            const isLeftSelected = leftId === icon.id;
            const isRightSelected = rightId === icon.id;
            const isCurrentSelected =
              activeTeamSide === 'left' ? isLeftSelected : isRightSelected;

            const badgeLabel = isLeftSelected
              ? leftTeamName
              : isRightSelected
                ? rightTeamName
                : `${icon.id}`;

            return (
              <button
                key={icon.id}
                type="button"
                onClick={() => {
                  if (activeTeamSide === 'left') {
                    if (rightId === icon.id) onSelectRight(leftId);
                    onSelectLeft(icon.id);
                  } else {
                    if (leftId === icon.id) onSelectLeft(rightId);
                    onSelectRight(icon.id);
                  }
                }}
                className="group w-full flex flex-col items-center gap-1.5 cursor-pointer select-none transition-transform duration-150 hover:-translate-y-1"
                title={`${icon.name} — ${icon.personality}`}
              >
                <div
                  className={`rounded-full p-0.5 transition-all ${
                    isCurrentSelected
                      ? 'ring-4 ring-[#f97316] scale-105 shadow-[0_0_18px_rgba(249,115,22,0.85)]'
                      : 'group-hover:scale-105'
                  }`}
                >
                  <CuteHamsterAvatar
                    avatarId={icon.id}
                    className="w-16 h-16 sm:w-20 sm:h-20"
                  />
                </div>

                <div
                  className={`w-full max-w-[96px] py-0.5 px-1.5 rounded-lg border-2 flex items-center justify-center ${
                    isLeftSelected
                      ? 'bg-gradient-to-b from-[#3b82f6] to-[#1d4ed8] border-[#0c2d57] text-white'
                      : isRightSelected
                        ? 'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] border-[#450a0a] text-white'
                        : 'bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] border-[#78350f] text-[#2d1203]'
                  }`}
                >
                  <span className="text-[11px] sm:text-xs font-black truncate">
                    {badgeLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onClose}
            className="relative rounded-2xl px-8 py-3 bg-gradient-to-b from-[#4fd1ff] via-[#0ea5e9] to-[#0284c7] border-[3px] border-[#0c2d57] shadow-[0_5px_0_#0c2d57] hover:brightness-105 active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer text-white font-black text-lg"
          >
            <Check className="w-5 h-5 stroke-[3.5]" />
            <span>Okay</span>
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
  const [leftCharacter, setLeftCharacter] = useState<HamsterCharacterType>(1);
  const [rightCharacter, setRightCharacter] = useState<HamsterCharacterType>(2);
  const [playerNames, setPlayerNames] = useState<string[]>(['Team 1', 'Team 2']);
  const [selectedQuestionLimit, setSelectedQuestionLimit] = useState<number>(25);
  const [lobbyDifficulty, setLobbyDifficulty] = useState<BoxDifficultyMode>('normal');
  const [answerBonusPoints, setAnswerBonusPoints] = useState<boolean>(true);
  const [wrongAnswerPenalty, setWrongAnswerPenalty] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<string>('theme-ocean');
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

    try {
      const isPublicBool = Boolean(cleanedGame.isPublic);
      const now = new Date().toISOString();

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
          userId: user?.uid || 'local-user',
          creatorName: user?.displayName || user?.email?.split('@')[0] || "Teacher",
          creatorEmail: user?.email || "",
          updatedAt: now,
          publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
          createdAt: initialGame?.createdAt || now,
        })
      );

      await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: initialGame,
      });
      onViewChange('games');
    } catch (e: any) {
      console.error('Error saving game', e);
      onViewChange('games');
    }
  };

  const allQuestionsDB =
    activeGame?.questions && activeGame.questions.filter((q) => q.text.trim() || q.image).length > 0
      ? activeGame.questions.filter((q) => q.text.trim() || q.image)
      : DEFAULT_QUESTIONS;

  useEffect(() => {
    if (allQuestionsDB.length > 0) {
      setSelectedQuestionLimit(allQuestionsDB.length);
    }
  }, [allQuestionsDB.length]);

  const questionsDB =
    allQuestionsDB.length > 0
      ? allQuestionsDB.slice(0, Math.max(1, Math.min(allQuestionsDB.length, selectedQuestionLimit)))
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
  const [soundVolume, setSoundVolume] = useState<number>(75);
  const [showQuickVolume, setShowQuickVolume] = useState(false);

  // Match Timer Slider & Countdown State (0 = OFF in Lobby, or 1..20 Minutes)
  const [timerMinutes, setTimerMinutes] = useState<number>(0);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(3 * 60);
  const [timerPaused, setTimerPaused] = useState<boolean>(false);
  const [timeUpBanner, setTimeUpBanner] = useState<string | null>(null);

  const handleTimerSliderChange = useCallback((mins: number) => {
    const clamped = Math.max(0, Math.min(20, mins));
    setTimerMinutes(clamped);
    setTimeLeftSeconds(clamped > 0 ? clamped * 60 : 3 * 60);
    setTimerPaused(false);
  }, []);

  const formatTimer = (totalSec: number) => {
    const s = Math.max(0, Math.floor(totalSec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  // ============================================================================
  // YOUTUBE SOUNDTRACK ENGINE (MATCHES MYSTERY BOX 3D)
  // In-game BGM: https://www.youtube.com/watch?v=ldjZKkcu5_k
  // End-game sound: https://www.youtube.com/watch?v=BVQ_JHmvhCM
  // ============================================================================
  const SHARK_BGM_VIDEO_ID = 'ldjZKkcu5_k';
  const SHARK_END_VIDEO_ID = 'BVQ_JHmvhCM';

  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef<boolean>(false);
  const ytInitializingRef = useRef<boolean>(false);
  const ytTrackRef = useRef<'bgm' | 'end' | null>(null);
  const ytLoadedVideoIdRef = useRef<string | null>(null);
  const ytFailedRef = useRef<boolean>(false);
  const soundPopoverRef = useRef<HTMLDivElement | null>(null);

  const soundMutedRef = useRef<boolean>(soundMuted);
  const soundVolumeRef = useRef<number>(soundVolume);
  const screenRef = useRef(screen);
  const matchOverRef = useRef(false);

  soundMutedRef.current = soundMuted;
  soundVolumeRef.current = soundVolume;
  screenRef.current = screen;

  useEffect(() => {
    soundMutedGlobal = soundMuted;
    soundVolumeGlobal = soundVolume;
  }, [soundMuted, soundVolume]);

  const pauseSharkYouTube = useCallback(() => {
    try {
      if (ytReadyRef.current && ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
        ytPlayerRef.current.pauseVideo();
      }
    } catch {
      // ignore
    }
  }, []);

  const syncSharkYouTubeVolume = useCallback((nextVol: number, forceResume = false) => {
    try {
      const player = ytPlayerRef.current;
      if (!ytReadyRef.current || !player) return;
      const clamped = Math.max(0, Math.min(100, Math.round(nextVol)));
      if (soundMutedRef.current || clamped <= 0) {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
        return;
      }
      if (typeof player.unMute === 'function') player.unMute();
      if (typeof player.setVolume === 'function') player.setVolume(clamped);
      if (
        forceResume &&
        (screenRef.current === 'playing' || screenRef.current === 'end') &&
        ytTrackRef.current &&
        typeof player.playVideo === 'function'
      ) {
        player.playVideo();
      }
    } catch {
      // ignore
    }
  }, []);

  const ensureSharkYouTubePlayer = useCallback(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (ytPlayerRef.current || ytInitializingRef.current) return;
    ytInitializingRef.current = true;

    const mountPlayer = () => {
      const win = window as any;
      if (!win.YT || !win.YT.Player) {
        ytInitializingRef.current = false;
        return;
      }

      let hostEl = document.getElementById('shark-yt-audio-host');
      if (!hostEl) {
        hostEl = document.createElement('div');
        hostEl.id = 'shark-yt-audio-host';
        hostEl.style.position = 'fixed';
        hostEl.style.width = '1px';
        hostEl.style.height = '1px';
        hostEl.style.bottom = '0px';
        hostEl.style.left = '0px';
        hostEl.style.opacity = '0.001';
        hostEl.style.pointerEvents = 'none';
        hostEl.style.zIndex = '-1';
        const innerEl = document.createElement('div');
        innerEl.id = 'shark-yt-audio-iframe';
        hostEl.appendChild(innerEl);
        document.body.appendChild(hostEl);
      }

      const initialVideoId =
        ytTrackRef.current === 'end' ? SHARK_END_VIDEO_ID : SHARK_BGM_VIDEO_ID;
      ytLoadedVideoIdRef.current = initialVideoId;

      try {
        ytPlayerRef.current = new win.YT.Player('shark-yt-audio-iframe', {
          width: '64',
          height: '64',
          videoId: initialVideoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev: any) => {
              ytReadyRef.current = true;
              ytInitializingRef.current = false;
              ytFailedRef.current = false;
              try {
                const desiredTrack = ytTrackRef.current;
                const shouldPlay =
                  (screenRef.current === 'playing' || screenRef.current === 'end') &&
                  desiredTrack !== null &&
                  !soundMutedRef.current &&
                  soundVolumeRef.current > 0;
                const targetVideoId =
                  desiredTrack === 'end' ? SHARK_END_VIDEO_ID : SHARK_BGM_VIDEO_ID;
                ev.target.setVolume(Math.max(0, Math.min(100, Math.round(soundVolumeRef.current))));
                if (shouldPlay) {
                  ev.target.unMute();
                  if (ytLoadedVideoIdRef.current !== targetVideoId) {
                    ytLoadedVideoIdRef.current = targetVideoId;
                    ev.target.loadVideoById({ videoId: targetVideoId, startSeconds: 0 });
                  } else {
                    ev.target.playVideo();
                  }
                } else {
                  ev.target.pauseVideo();
                }
              } catch {
                // ignore
              }
            },
            onStateChange: (ev: any) => {
              // Loop in-game BGM seamlessly when it ends (YT.PlayerState.ENDED === 0)
              if (ev.data === 0) {
                if (
                  ytTrackRef.current === 'bgm' &&
                  screenRef.current === 'playing' &&
                  !matchOverRef.current &&
                  !soundMutedRef.current &&
                  soundVolumeRef.current > 0
                ) {
                  try {
                    ev.target.seekTo(0);
                    ev.target.playVideo();
                  } catch {
                    // ignore
                  }
                }
              }
            },
            onError: () => {
              ytFailedRef.current = true;
              ytInitializingRef.current = false;
              if (ytTrackRef.current === 'end') {
                playSFX('win');
              }
            },
          },
        });
      } catch {
        ytInitializingRef.current = false;
        ytFailedRef.current = true;
      }
    };

    const win = window as any;
    if (win.YT && win.YT.Player) {
      mountPlayer();
    } else {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
      const prevCallback = win.onYouTubeIframeAPIReady;
      win.onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') {
          try {
            prevCallback();
          } catch {
            // ignore
          }
        }
        mountPlayer();
      };
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.async = true;
        document.head.appendChild(tag);
      } else {
        let attempts = 0;
        const poll = setInterval(() => {
          attempts += 1;
          if (win.YT && win.YT.Player) {
            clearInterval(poll);
            mountPlayer();
          } else if (attempts > 40) {
            clearInterval(poll);
            ytInitializingRef.current = false;
          }
        }, 150);
      }
    }
  }, []);

  const playSharkYouTubeTrack = useCallback(
    (track: 'bgm' | 'end', forceRestart = false) => {
      ytTrackRef.current = track;
      ytFailedRef.current = false;
      const videoId = track === 'end' ? SHARK_END_VIDEO_ID : SHARK_BGM_VIDEO_ID;

      if (!ytPlayerRef.current) {
        ensureSharkYouTubePlayer();
        return;
      }
      if (!ytReadyRef.current) return;

      try {
        const player = ytPlayerRef.current;
        if (soundMutedRef.current || soundVolumeRef.current <= 0) {
          if (typeof player.pauseVideo === 'function') player.pauseVideo();
          return;
        }
        const targetVol = Math.max(0, Math.min(100, Math.round(soundVolumeRef.current)));
        if (typeof player.unMute === 'function') player.unMute();
        if (typeof player.setVolume === 'function') player.setVolume(targetVol);

        if (forceRestart || ytLoadedVideoIdRef.current !== videoId) {
          ytLoadedVideoIdRef.current = videoId;
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById({ videoId, startSeconds: 0 });
          }
        } else if (typeof player.playVideo === 'function') {
          player.playVideo();
        }
      } catch {
        ytFailedRef.current = true;
        if (track === 'end') playSFX('win');
      }
    },
    [ensureSharkYouTubePlayer]
  );

  // Pre-warm YouTube player on mount & destroy on unmount
  useEffect(() => {
    ensureSharkYouTubePlayer();
    return () => {
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === 'function') {
          ytPlayerRef.current.destroy();
        }
      } catch {
        // ignore
      }
      ytPlayerRef.current = null;
      ytReadyRef.current = false;
      ytInitializingRef.current = false;
      const hostEl = document.getElementById('shark-yt-audio-host');
      if (hostEl && hostEl.parentNode) {
        hostEl.parentNode.removeChild(hostEl);
      }
    };
  }, [ensureSharkYouTubePlayer]);

  // Pause YouTube audio whenever leaving active gameplay / end celebration
  useEffect(() => {
    if (screen !== 'playing' && screen !== 'end') {
      ytTrackRef.current = null;
      pauseSharkYouTube();
    }
  }, [screen, pauseSharkYouTube]);

  // Close quick sound popover when clicking outside
  useEffect(() => {
    if (!showQuickVolume) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (soundPopoverRef.current && !soundPopoverRef.current.contains(e.target as Node)) {
        setShowQuickVolume(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showQuickVolume]);

  const handleChangeSoundVolume = useCallback(
    (nextVol: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(nextVol)));
      setSoundVolume(clamped);
      soundVolumeRef.current = clamped;
      soundVolumeGlobal = clamped;
      const shouldMute = clamped <= 0;
      setSoundMuted(shouldMute);
      soundMutedRef.current = shouldMute;
      soundMutedGlobal = shouldMute;
      syncSharkYouTubeVolume(clamped, !shouldMute);
    },
    [syncSharkYouTubeVolume]
  );

  const handleToggleSoundMute = useCallback(() => {
    const nextMuted = !soundMutedRef.current;
    setSoundMuted(nextMuted);
    soundMutedRef.current = nextMuted;
    soundMutedGlobal = nextMuted;
    if (!nextMuted && soundVolumeRef.current <= 0) {
      setSoundVolume(75);
      soundVolumeRef.current = 75;
      soundVolumeGlobal = 75;
      syncSharkYouTubeVolume(75, true);
    } else if (nextMuted) {
      pauseSharkYouTube();
    } else {
      syncSharkYouTubeVolume(soundVolumeRef.current, true);
    }
  }, [pauseSharkYouTube, syncSharkYouTubeVolume]);

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
    setTimeLeftSeconds(timerMinutes > 0 ? timerMinutes * 60 : 3 * 60);
    setTimerPaused(false);
    matchOverRef.current = false;
    setShowStartBattleModal(false);
    screenRef.current = 'playing';
    setScreen('playing');
    playSharkYouTubeTrack('bgm', true);
    playSFX('splash');
    setTimeout(() => playSFX('clack'), 200);
  };

  const triggerSharkVictory = useCallback(
    (winningTeam: 'Blue Team' | 'Red Team') => {
      if (matchOverRef.current) return;
      matchOverRef.current = true;
      setWinner(winningTeam);
      setFallingPhase('diving');
      if (winningTeam === 'Blue Team') {
        setLeftTeam((prev: any) => ({ ...prev, wins: prev.wins + 1 }));
      } else {
        setRightTeam((prev: any) => ({ ...prev, wins: prev.wins + 1 }));
      }
      // Switch immediately from in-game BGM to the End-Game victory track (same as Mystery Box)
      playSharkYouTubeTrack('end', true);
      // Stage 1: Hamster plunges off the top edge with cartoon falling whistle
      playSFX('fallWhistle');
      // Stage 2: Hamster lands in shark jaws -> CHOMP + big splash!
      setTimeout(() => {
        setFallingPhase('chomped');
        setIsRumbling(true);
        playSFX('chomp');
        setTimeout(() => setIsRumbling(false), 500);
      }, 520);
      // Stage 3: Fallback Web Audio fanfare only if YouTube failed to load
      setTimeout(() => {
        if (ytFailedRef.current) {
          playSFX('win');
        }
      }, 950);
      // Transition to celebration screen
      setTimeout(() => {
        setScreen('end');
      }, 2600);
    },
    [playSharkYouTubeTrack]
  );

  // When the match timer ends, the character with the highest steps (closest to the edge) is eaten by the shark!
  const handleTimeExpired = useCallback(() => {
    if (matchOverRef.current || stateRef.current.screen !== 'playing') return;
    const lTeam = stateRef.current.leftTeam;
    const rTeam = stateRef.current.rightTeam;

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
    if (screen !== 'playing' || timerPaused || timerMinutes <= 0) return;
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
  }, [screen, timerPaused, timerMinutes, handleTimeExpired]);

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
            onViewChange('home', { __stepBack: true });
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

  const blueDisplayName =
    playerNames[0] && playerNames[0].trim() && playerNames[0].trim().toLowerCase() !== 'team 1'
      ? playerNames[0].trim()
      : 'Team 1';
  const redDisplayName =
    playerNames[1] && playerNames[1].trim() && playerNames[1].trim().toLowerCase() !== 'team 2'
      ? playerNames[1].trim()
      : 'Team 2';

  const leftAvatarId = resolveHamsterAvatarId(leftCharacter, 1);
  const rightAvatarId = resolveHamsterAvatarId(rightCharacter, 2);

  const renderChooseBattleModeModal = () => {
    if (!showStartBattleModal) return null;
    return (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-md animate-in fade-in duration-150"
        onClick={() => setShowStartBattleModal(false)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[620px] rounded-[40px] p-6 sm:p-8 border-[6px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.55),0_10px_0_#4ca6ee,inset_0_4px_14px_rgba(255,255,255,0.98)] flex flex-col items-center gap-6"
          style={{
            fontFamily: '"Fredoka", "Baloo 2", "Plus Jakarta Sans", "Nunito", sans-serif',
            background:
              'linear-gradient(180deg, #b8e1ff 0%, #dff2ff 24%, #f2faff 54%, #b5deff 100%)',
          }}
        >
          {/* Top Glossy Highlight */}
          <div className="pointer-events-none absolute inset-x-10 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white/95 to-transparent" />

          {/* Close Button */}
          <button
            type="button"
            onClick={() => setShowStartBattleModal(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white hover:bg-rose-50 text-[#0c2d57] hover:text-rose-600 border-2 border-[#0c2d57]/20 shadow-[0_3px_0_rgba(12,45,87,0.2)] flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5 stroke-[3]" />
          </button>

          {/* 2 Team 3D Hamster Avatars Showcase */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <CuteHamsterAvatar avatarId={leftAvatarId} className="w-14 h-14 sm:w-16 sm:h-16" />
            <div className="px-3 py-1 rounded-xl bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] border-[2.5px] border-[#451a03] shadow-[0_3px_0_#451a03] font-black text-sm sm:text-base text-[#2d1203] italic">
              VS
            </div>
            <CuteHamsterAvatar avatarId={rightAvatarId} className="w-14 h-14 sm:w-16 sm:h-16" />
          </div>

          {/* Clean Bold Title Only (Unnecessary words and redundant timer removed) */}
          <h2 className="text-3xl sm:text-4xl font-black text-[#0c2d57] uppercase tracking-tight text-center drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
            CHOOSE BATTLE MODE
          </h2>

          {/* Clean 2-Card Battle Mode Buttons */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <button
              type="button"
              onClick={() => startGame(false, 'single')}
              className="group relative rounded-[28px] p-6 sm:p-7 bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] border-[3.5px] border-[#451a03] shadow-[0_7px_0_#451a03,0_14px_24px_rgba(69,26,3,0.25)] hover:brightness-105 hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#451a03] transition-all duration-150 flex flex-col items-center justify-center gap-3 cursor-pointer"
            >
              <div className="pointer-events-none absolute inset-x-5 top-1.5 h-2.5 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/85 border-2 border-[#451a03]/20 shadow-inner flex items-center justify-center text-4xl sm:text-5xl group-hover:scale-110 transition-transform">
                🎯
              </div>
              <span className="text-xl sm:text-2xl font-black text-[#2d1203] uppercase tracking-tight text-center leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]">
                SINGLE QUESTION
              </span>
            </button>

            <button
              type="button"
              onClick={() => startGame(false, 'split')}
              className="group relative rounded-[28px] p-6 sm:p-7 bg-gradient-to-b from-[#4fd1ff] via-[#0ea5e9] to-[#0284c7] border-[3.5px] border-[#0c2d57] shadow-[0_7px_0_#0c2d57,0_14px_24px_rgba(12,45,87,0.28)] hover:brightness-105 hover:-translate-y-1 active:translate-y-1 active:shadow-[0_2px_0_#0c2d57] transition-all duration-150 flex flex-col items-center justify-center gap-3 cursor-pointer"
            >
              <div className="pointer-events-none absolute inset-x-5 top-1.5 h-2.5 rounded-full bg-gradient-to-b from-white/70 to-transparent" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/25 border-2 border-white/45 shadow-inner flex items-center justify-center text-4xl sm:text-5xl group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <span className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight text-center leading-tight drop-shadow-[0_2px_0_#035388]">
                SPLIT QUESTIONS
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================================================
  // SCREEN 3: MYSTERY BOX 3D LOBBY STYLE MENU (FIXED TO 2 TEAMS MODE)
  // ==========================================================================
  if (screen === 'menu') {
    return (
      <div
        id="game-container"
        className="w-full min-h-full flex-1 relative select-none"
      >
        <MysteryBox3DLobby
          headerBannerSrc={sharkAttackBannerImg}
          headerBannerAlt="Shark Attack - Explorer Hamster and Tropical Shark"
          showModeAndTheme={false}
          optionsSubtitle="Adjust Shark Attack sound volume, audio effects, and study options"
          fixedTeamCount={2}
          numPlayers={2}
          onSelectNumPlayers={() => {}}
          questionCount={allQuestionsDB.length}
          selectedQuestionLimit={selectedQuestionLimit}
          onSelectQuestionLimit={(limit) => setSelectedQuestionLimit(limit)}
          gameTimeMinutes={timerMinutes}
          onSelectGameTime={(mins) => handleTimerSliderChange(mins)}
          playerNames={playerNames}
          onChangePlayerName={(idx, value) => {
            setPlayerNames((prev) => {
              const next = [...prev];
              next[idx] = value;
              return next;
            });
          }}
          teamAvatars={[leftAvatarId, rightAvatarId]}
          onChangeTeamAvatar={(teamIndex, avatarId) => {
            if (teamIndex === 0) {
              if (rightAvatarId === avatarId) setRightCharacter(leftAvatarId);
              setLeftCharacter(avatarId);
            } else {
              if (leftAvatarId === avatarId) setLeftCharacter(rightAvatarId);
              setRightCharacter(avatarId);
            }
          }}
          onRandomizeTeamAvatars={() => {
            const pool = Array.from({ length: 20 }, (_, i) => i + 1);
            for (let i = pool.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            setLeftCharacter(pool[0]);
            setRightCharacter(pool[1]);
          }}
          difficulty={lobbyDifficulty}
          onSelectDifficulty={setLobbyDifficulty}
          answerBonusPoints={answerBonusPoints}
          onToggleBonus={() => setAnswerBonusPoints((v) => !v)}
          wrongAnswerPenalty={wrongAnswerPenalty}
          onTogglePenalty={() => setWrongAnswerPenalty((v) => !v)}
          isMuted={soundMuted}
          onToggleMute={handleToggleSoundMute}
          soundVolume={soundVolume}
          onChangeSoundVolume={handleChangeSoundVolume}
          selectedTheme={selectedTheme}
          onSelectTheme={(themeId) => setSelectedTheme(themeId)}
          onStartGame={() => setShowStartBattleModal(true)}
          onOpenStudy={() => {
            setStudyIndex(0);
            setStudySelectedOption(null);
            setScreen('study');
          }}
          onBack={() => onViewChange('home', { __stepBack: true })}
          onOpenGameSwitcher={() => setShowModeModal(true)}
          onOpenQuizEditor={() => setScreen('setup')}
        />

        {renderChooseBattleModeModal()}

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
    const winningDisplayName =
      winner === 'Blue Team' ? blueDisplayName : redDisplayName;

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
            {winningDisplayName}
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
  const currentQText = leftTeam.q?.text || rightTeam.q?.text || DEFAULT_QUESTIONS[0]?.text || '';
  const isLowTime = timerMinutes > 0 && timeLeftSeconds <= 30;

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

        {/* Blue Team Banner, IN-GAME TIMER HUD, and Red Team Banner */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 md:gap-4">
          {/* Blue Team Scoreboard Banner */}
          <div className="bg-[#0055fe] rounded-2xl md:rounded-3xl px-2.5 sm:px-3.5 md:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-blue-500/25 border-b-4 border-[#0038b3]">
            <button
              onClick={() => setShowCharacterModal(true)}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
              title="Change Blue Team Hamster"
            >
              <CuteHamsterCharacter team="left" character={leftCharacter} size="icon" />
            </button>
            <span className="font-black italic text-xs sm:text-sm md:text-base lg:text-lg text-white uppercase tracking-wider select-none">
              {blueDisplayName}
            </span>
            <div className="bg-white text-blue-700 font-black text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 rounded-full shadow-sm tracking-wide">
              {leftTeam.wins} WINS
            </div>
          </div>

          {/* IN-GAME TIMER SLIDER & COUNTDOWN HUD */}
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
                {timerMinutes > 0 ? formatTimer(timeLeftSeconds) : 'OFF'}
              </span>
            </div>

            {/* Interactive Timer Slider directly In-Game */}
            <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
              <span className="text-[10px] font-black text-amber-300">OFF</span>
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={Math.min(10, timerMinutes)}
                onChange={(e) => handleTimerSliderChange(Number(e.target.value))}
                className="w-20 sm:w-28 md:w-32 accent-amber-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                title="In-Game Timer Slider (OFF or 1 to 10 Minutes)"
              />
              <span className="text-[10px] font-black text-amber-300">10m</span>
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] whitespace-nowrap">
                {timerMinutes > 0 ? `${timerMinutes}m` : 'OFF'}
              </span>
            </div>

            {timerMinutes > 0 && (
              <>
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
              </>
            )}
          </div>

          {/* Red Team Scoreboard Banner */}
          <div className="bg-[#cc0000] rounded-2xl md:rounded-3xl px-2.5 sm:px-3.5 md:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 shadow-lg shadow-red-500/25 border-b-4 border-[#990000]">
            <div className="bg-white text-red-700 font-black text-xs sm:text-sm px-2 py-0.5 sm:px-2.5 rounded-full shadow-sm tracking-wide">
              {rightTeam.wins} WINS
            </div>
            <span className="font-black italic text-xs sm:text-sm md:text-base lg:text-lg text-white uppercase tracking-wider select-none">
              {redDisplayName}
            </span>
            <button
              onClick={() => setShowCharacterModal(true)}
              className="rounded-full flex items-center justify-center transition-all hover:scale-105 cursor-pointer"
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
          <div className="relative" ref={soundPopoverRef}>
            <button
              type="button"
              onClick={() => setShowQuickVolume((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${
                showQuickVolume ? 'bg-sky-100 ring-2 ring-sky-400' : 'hover:bg-slate-100'
              }`}
              title={
                soundMuted || soundVolume === 0
                  ? 'Sound Muted — Click to adjust volume'
                  : `Sound Volume: ${soundVolume}% — Click to adjust`
              }
            >
              {soundMuted || soundVolume === 0 ? (
                <VolumeX size={20} className="text-red-500" />
              ) : (
                <Volume2 size={20} className="text-emerald-600" />
              )}
            </button>

            {showQuickVolume && (
              <div className="absolute right-0 mt-2.5 w-60 rounded-2xl p-3.5 bg-white border-2 border-sky-300 shadow-2xl z-[80] flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Sound Volume
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[11px] font-black tabular-nums">
                    {soundMuted || soundVolume === 0 ? 'MUTED' : `${soundVolume}%`}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleToggleSoundMute}
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                      soundMuted || soundVolume === 0
                        ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                        : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    }`}
                    title={soundMuted || soundVolume === 0 ? 'Unmute Sound' : 'Mute Sound'}
                  >
                    {soundMuted || soundVolume === 0 ? (
                      <VolumeX size={16} />
                    ) : (
                      <Volume2 size={16} />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={soundMuted ? 0 : soundVolume}
                    onChange={(e) => handleChangeSoundVolume(Number(e.target.value))}
                    aria-label="Sound Volume"
                    className="w-full h-2 rounded-full appearance-none cursor-pointer accent-sky-500"
                    style={{
                      background: `linear-gradient(to right, #0284c7 0%, #38bdf8 ${
                        soundMuted ? 0 : soundVolume
                      }%, #cbd5e1 ${soundMuted ? 0 : soundVolume}%, #cbd5e1 100%)`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
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
        leftTeamName={blueDisplayName}
        rightTeamName={redDisplayName}
        onSelectLeft={setLeftCharacter}
        onSelectRight={setRightCharacter}
        onClose={() => setShowCharacterModal(false)}
      />

      {/* In-Game Question Mode Switcher Modal */}
      {renderChooseBattleModeModal()}

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
  const [contentMode, setContentMode] = useState<AnswerContentMode>('words');
  const [autoPhotosEnabled, setAutoPhotosEnabled] = useState<boolean>(false);
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
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-black text-sm transition-colors cursor-pointer border border-slate-300 dark:border-slate-600"
                  title="Go Back"
                >
                  <ArrowLeft size={18} />
                  <span>Back</span>
                </button>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                  GAME SETUP
                </h2>
              </div>
              <div className="flex gap-3 items-center">
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
