import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { MysteryBox3DLobby, BoxModeSelector, CuteHamsterAvatar } from "../components/MysteryBox3DLobby";
import treasureCaveBg from "../assets/images/treasure_cave_bg_1795603145753.jpg";
import treasureChestBlankShield from "../assets/images/treasure_chest_blank_shield_1795603185465.jpg";
import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
import { GameModeModal } from "../components/GameModeModal";
import { SetupCurriculumHeader, SmartOptionInput, SmartQuestionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { OptionContentMode, parseOptionContent, formatOptionContent } from "../utils/mediaAndPresets";
import { 
  ArrowLeft, Edit3, Trash2, Plus, Sparkles, Save, X, Play, 
  Image as ImageIcon, ClipboardList, Info, Copy, 
  Volume2, VolumeX, Eye, Check, RefreshCw, Trophy, Gift, ArrowRightLeft, Star, AlertTriangle, Skull, Bomb, Shuffle,
  Users, User, Minus, Flame, Zap, Crown, ShieldAlert, Coins, Settings
} from "lucide-react";
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { persistUserGameToCloudAndCache } from "../utils/platformCache";

// Cached transparent cutout for the 3D Treasure Chest on stone pedestal
let cachedTransparentChestUrl: string | null = null;
let pendingChestPromise: Promise<string> | null = null;

function getTransparentChestDataUrl(): Promise<string> {
  if (cachedTransparentChestUrl) return Promise.resolve(cachedTransparentChestUrl);
  if (pendingChestPromise) return pendingChestPromise;

  pendingChestPromise = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || 512;
        const h = img.naturalHeight || 512;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(treasureChestBlankShield);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;
        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const isBgWhite = (idx: number) => {
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          return r >= 232 && g >= 232 && b >= 230 && Math.abs(r - g) <= 22 && Math.abs(g - b) <= 22;
        };

        const enqueue = (x: number, y: number) => {
          if (x < 0 || x >= w || y < 0 || y >= h) return;
          const idx = y * w + x;
          if (visited[idx]) return;
          if (!isBgWhite(idx)) return;
          visited[idx] = 1;
          queue[tail++] = idx;
        };

        for (let x = 0; x < w; x++) {
          enqueue(x, 0);
          enqueue(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          enqueue(0, y);
          enqueue(w - 1, y);
        }

        while (head < tail) {
          const curr = queue[head++];
          data[curr * 4 + 3] = 0;
          const cx = curr % w;
          const cy = (curr - cx) / w;
          if (cx > 0) enqueue(cx - 1, cy);
          if (cx < w - 1) enqueue(cx + 1, cy);
          if (cy > 0) enqueue(cx, cy - 1);
          if (cy < h - 1) enqueue(cx, cy + 1);
        }

        // Feather 1px border for smooth anti-aliased edge
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = y * w + x;
            if (!visited[idx]) {
              const neighborsTransparent =
                visited[idx - 1] + visited[idx + 1] + visited[idx - w] + visited[idx + w];
              if (neighborsTransparent > 0) {
                const p = idx * 4;
                if (data[p] > 215 && data[p + 1] > 215 && data[p + 2] > 215) {
                  data[p + 3] = Math.round(data[p + 3] * 0.35);
                }
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Auto-crop transparent outer padding symmetrically around the center so the chest fills its cell richly
        // while keeping the golden shield plate dead-center at (50%, 50%)
        let minX = w, minY = h, maxX = 0, maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 25) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX > minX && maxY > minY) {
          const cxCenter = w / 2;
          const cyCenter = h / 2;
          const padX = Math.round(w * 0.012);
          const padY = Math.round(h * 0.012);
          const halfW = Math.min(cxCenter, Math.max(cxCenter - minX, maxX - cxCenter) + padX);
          const halfH = Math.min(cyCenter, Math.max(cyCenter - minY, maxY - cyCenter) + padY);
          const cropX = Math.max(0, Math.floor(cxCenter - halfW));
          const cropY = Math.max(0, Math.floor(cyCenter - halfH));
          const cropW = Math.min(w - cropX, Math.ceil(halfW * 2));
          const cropH = Math.min(h - cropY, Math.ceil(halfH * 2));

          const croppedCanvas = document.createElement('canvas');
          croppedCanvas.width = cropW;
          croppedCanvas.height = cropH;
          const croppedCtx = croppedCanvas.getContext('2d');
          if (croppedCtx) {
            croppedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            cachedTransparentChestUrl = croppedCanvas.toDataURL('image/png');
            resolve(cachedTransparentChestUrl);
            return;
          }
        }

        cachedTransparentChestUrl = canvas.toDataURL('image/png');
        resolve(cachedTransparentChestUrl);
      } catch {
        resolve(treasureChestBlankShield);
      }
    };
    img.onerror = () => resolve(treasureChestBlankShield);
    img.src = treasureChestBlankShield;
  });

  return pendingChestPromise;
}

function useTransparentTreasureChest(): string {
  const [src, setSrc] = useState<string>(cachedTransparentChestUrl || treasureChestBlankShield);
  useEffect(() => {
    let mounted = true;
    getTransparentChestDataUrl().then((url) => {
      if (mounted) setSrc(url);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return src;
}

function GoldenLaurelSprig({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 44 76"
      className={`w-7 h-12 sm:w-9 sm:h-14 shrink-0 pointer-events-none select-none drop-shadow-[0_2px_6px_rgba(251,191,36,0.45)] ${
        flip ? '-scale-x-100' : ''
      }`}
      fill="none"
    >
      <defs>
        <linearGradient id="goldLaurelGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
      </defs>
      <path
        d="M32 68 C16 54, 14 30, 26 10"
        stroke="url(#goldLaurelGrad)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M22 57 C11 55, 8 47, 17 45 C22 48, 23 53, 22 57 Z" fill="url(#goldLaurelGrad)" />
      <path d="M19 44 C8 41, 7 32, 16 31 C20 35, 20 40, 19 44 Z" fill="url(#goldLaurelGrad)" />
      <path d="M19 30 C10 26, 11 17, 19 18 C22 22, 21 26, 19 30 Z" fill="url(#goldLaurelGrad)" />
      <path d="M23 18 C17 13, 20 5, 27 8 C28 12, 26 16, 23 18 Z" fill="url(#goldLaurelGrad)" />
      <path d="M25 53 C33 49, 36 41, 28 39 C24 43, 24 49, 25 53 Z" fill="url(#goldLaurelGrad)" opacity="0.85" />
      <path d="M22 38 C30 34, 33 26, 25 25 C21 29, 21 34, 22 38 Z" fill="url(#goldLaurelGrad)" opacity="0.85" />
    </svg>
  );
}

type GameScreen = 'editor' | 'setup' | 'game' | 'study';

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  optionImages?: (string | null)[];
  image?: string;
}

interface Quiz {
  id: number | string;
  title?: string;
  subject?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

interface OutcomeResult {
  teams: Team[];
  deltas: Record<number, { amount: number; label: string; isPositive: boolean }>;
  summaryText: string;
}

interface Outcome {
  id: string;
  text: string;
  subtitle: string;
  icon: string;
  category: 'treasure' | 'jackpot' | 'multiplier' | 'trap' | 'bomb' | 'heist';
  color: string;
  badgeText: string;
  requiresTarget?: 'swap' | 'steal';
  execute: (teams: Team[], receiverIdx: number, targetIdx?: number) => OutcomeResult;
}

interface Team {
  id: number;
  name: string;
  score: number;
  streak?: number;
  avatarId?: number;
  color?: string;
  icon?: string;
  bg?: string;
  border?: string;
  ring?: string;
}

interface ScoreDeltaPopup {
  id: number;
  teamId: number;
  text: string;
  isPositive: boolean;
}

interface OpenedBoxRecord {
  icon: string;
  label: string;
  isPositive: boolean;
  teamName?: string;
}

const DEFAULT_TEAM_CONFIGS = [
  { id: 0, defaultName: "Team 1", color: "blue", bg: "bg-blue-600", gradient: "from-blue-600 to-cyan-500", border: "border-blue-400", light: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300", ring: "ring-blue-400", icon: "1" },
  { id: 1, defaultName: "Team 2", color: "red", bg: "bg-rose-600", gradient: "from-rose-600 to-pink-500", border: "border-rose-400", light: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", ring: "ring-rose-400", icon: "2" },
  { id: 2, defaultName: "Team 3", color: "emerald", bg: "bg-emerald-600", gradient: "from-emerald-600 to-teal-500", border: "border-emerald-400", light: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", ring: "ring-emerald-400", icon: "3" },
  { id: 3, defaultName: "Team 4", color: "amber", bg: "bg-amber-600", gradient: "from-amber-600 to-orange-500", border: "border-amber-400", light: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", ring: "ring-amber-400", icon: "4" },
  { id: 4, defaultName: "Team 5", color: "purple", bg: "bg-purple-600", gradient: "from-purple-600 to-indigo-500", border: "border-purple-400", light: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300", ring: "ring-purple-400", icon: "5" },
  { id: 5, defaultName: "Team 6", color: "pink", bg: "bg-pink-600", gradient: "from-pink-600 to-rose-500", border: "border-pink-400", light: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300", ring: "ring-pink-400", icon: "6" },
  { id: 6, defaultName: "Team 7", color: "teal", bg: "bg-teal-600", gradient: "from-teal-600 to-cyan-600", border: "border-teal-400", light: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300", ring: "ring-teal-400", icon: "7" },
  { id: 7, defaultName: "Team 8", color: "orange", bg: "bg-orange-600", gradient: "from-orange-600 to-red-500", border: "border-orange-400", light: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300", ring: "ring-orange-400", icon: "8" },
];

const MYSTERY_VIBE_HINTS = [
  "Sparks of golden treasure and ticking danger echo from inside...",
  "It feels unusually heavy... could it be a Mega Jackpot or a Bomb?",
  "A mysterious glow radiates through the keyhole! Keep it or bluff?",
  "You hear coins clinking... or is that a fuse burning?",
  "High risk, high reward! Will you trust your luck or pass the fate?",
  "Strange energy hums inside this crate. Choose wisely!"
];

const BLANK_MYSTERY_QUESTION: Question = {
  id: 1,
  text: "",
  options: ["", "", "", ""],
  answerIndex: 0,
  optionImages: [null, null, null, null],
};

// Smooth Animated Rolling Score Component for Live Point Adding & Deduction
function AnimatedScore({
  value,
  fromValue,
  duration = 750,
  className = "",
}: {
  value: number;
  fromValue?: number;
  duration?: number;
  className?: string;
}) {
  const [displayValue, setDisplayValue] = useState(fromValue !== undefined ? fromValue : value);
  const [bump, setBump] = useState<'up' | 'down' | null>(null);
  const prevRef = useRef(fromValue !== undefined ? fromValue : value);

  useEffect(() => {
    const startVal = prevRef.current;
    const endVal = value;
    if (startVal === endVal) {
      setDisplayValue(endVal);
      return;
    }

    setBump(endVal > startVal ? 'up' : 'down');
    const startTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayValue(current);
      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        prevRef.current = endVal;
        setTimeout(() => setBump(null), 450);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);

  const formatted = `${displayValue}`;

  return (
    <span
      className={`inline-block tabular-nums transition-all duration-200 ${
        bump === 'up'
          ? 'scale-125 text-emerald-400 drop-shadow-[0_0_16px_rgba(16,185,129,0.75)]'
          : bump === 'down'
          ? 'scale-125 text-rose-400 drop-shadow-[0_0_16px_rgba(244,63,94,0.75)]'
          : ''
      } ${className}`}
    >
      {formatted}
    </span>
  );
}

// 3D Treasure Adventure Scoreboard with Golden Laurel Wreaths & Active Golden Turn Highlight
interface MainScoreboardProps {
  teams: Team[];
  currentTeamIdx: number;
  scoreDeltas?: ScoreDeltaPopup[];
  highestScore: number;
  onSelectTeam?: (idx: number) => void;
  activeRevealTeamId?: number | null;
  activeRevealDelta?: number | null;
  className?: string;
  isCompact?: boolean;
}

function MainScoreboard({
  teams,
  currentTeamIdx,
  scoreDeltas = [],
  highestScore,
  onSelectTeam,
  activeRevealTeamId,
  activeRevealDelta,
  className = "",
  isCompact = false,
}: MainScoreboardProps) {
  return (
    <div className={`w-full max-w-7xl mx-auto px-2 sm:px-4 ${className}`}>
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
        <GoldenLaurelSprig />

        <div className="flex items-stretch justify-center gap-2 sm:gap-3.5 flex-wrap">
          {teams.map((t, idx) => {
            const isCurrent = currentTeamIdx === idx;
            const isLeader = teams.length > 1 && t.score > 0 && t.score === highestScore;
            const teamPopups = scoreDeltas.filter(d => d.teamId === t.id);
            const isAffectedReveal = activeRevealTeamId === t.id && activeRevealDelta !== undefined && activeRevealDelta !== null;
            const isPositiveReveal = isAffectedReveal && (activeRevealDelta ?? 0) >= 0;

            const rawTeamName = (t.name || '').trim();
            const displayTeamTitle = rawTeamName || `TEAM ${idx + 1}`;

            return (
              <div
                key={t.id}
                onClick={() => onSelectTeam && onSelectTeam(idx)}
                title={onSelectTeam ? "Click to set active turn" : undefined}
                className={`group relative rounded-[22px] sm:rounded-[26px] transition-all duration-300 flex flex-col justify-between overflow-visible select-none ${
                  onSelectTeam ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'
                } ${
                  isCompact
                    ? 'px-3.5 py-2.5 sm:px-4 sm:py-3 w-[185px] sm:w-[235px] md:w-[265px]'
                    : 'p-4 sm:p-5 w-[215px] sm:w-[260px] md:w-[290px]'
                } ${
                  isAffectedReveal
                    ? isPositiveReveal
                      ? 'border-[3px] border-emerald-400 bg-[#122620]/90 backdrop-blur-xl text-white ring-4 ring-emerald-400/50 shadow-[0_0_40px_rgba(16,185,129,0.55)] scale-105 z-20'
                      : 'border-[3px] border-rose-400 bg-[#2b1219]/90 backdrop-blur-xl text-white ring-4 ring-rose-400/50 shadow-[0_0_40px_rgba(244,63,94,0.55)] scale-105 z-20 animate-shake'
                    : isCurrent
                    ? 'border-[3px] border-[#fbbf24] bg-gradient-to-b from-[#231f39]/95 via-[#1c1830]/95 to-[#171329]/95 text-white shadow-[0_0_26px_rgba(251,191,36,0.55),inset_0_1px_12px_rgba(251,191,36,0.22)] z-10'
                    : 'border-[2.5px] border-[#8b5cf6]/70 bg-gradient-to-b from-[#35235c]/90 via-[#2a1b4e]/90 to-[#211440]/90 hover:border-[#a78bfa] text-white shadow-[0_8px_24px_rgba(15,8,35,0.65),inset_0_1px_10px_rgba(167,139,250,0.2)]'
                }`}
              >
                {/* Floating Live Point Delta Popups */}
                {teamPopups.map((popup) => (
                  <div
                    key={popup.id}
                    className={`absolute -top-9 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1 rounded-2xl font-black text-xs sm:text-sm whitespace-nowrap shadow-2xl pointer-events-none animate-live-pop border-2 ${
                      popup.isPositive
                        ? 'bg-emerald-500 text-slate-950 border-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                        : 'bg-rose-600 text-white border-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.7)]'
                    }`}
                  >
                    {popup.text.startsWith('+') ? `▲ ${popup.text}` : popup.text.startsWith('-') ? `▼ ${popup.text}` : popup.text}
                  </div>
                ))}

                {/* Active Turn Indicator or Affected Badge */}
                {isAffectedReveal ? (
                  <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 text-slate-950 font-black text-[10px] uppercase px-3 py-0.5 rounded-full shadow-lg tracking-wider flex items-center gap-1 whitespace-nowrap border ${
                    isPositiveReveal
                      ? 'bg-gradient-to-r from-emerald-400 to-teal-300 border-emerald-200'
                      : 'bg-gradient-to-r from-rose-400 to-red-300 border-rose-200'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                    {isPositiveReveal ? '▲ POINTS WON!' : '▼ PENALTY!'}
                  </div>
                ) : isCurrent ? (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-b from-[#fde047] via-[#fbbf24] to-[#f59e0b] text-[#1e1303] text-[10px] font-black uppercase px-3.5 py-0.5 rounded-full shadow-[0_4px_14px_rgba(251,191,36,0.65)] tracking-wider flex items-center gap-1 whitespace-nowrap border border-[#fef08a]">
                    <span>⚡</span>
                    <span>ACTIVE TURN</span>
                  </div>
                ) : null}

                {/* Top Row: Large Circular Hamster Character Avatar + Single Team Name */}
                <div className="flex items-center gap-3 min-w-0 pt-0.5">
                  <CuteHamsterAvatar
                    avatarId={t.avatarId || ((idx % 20) + 1)}
                    className={`${
                      isCompact
                        ? 'w-14 h-14 sm:w-16 sm:h-16 md:w-[68px] md:h-[68px]'
                        : 'w-16 h-16 sm:w-20 sm:h-20'
                    } shrink-0 !border-[3px] shadow-[0_4px_12px_rgba(0,0,0,0.45)]`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className={`${
                        isCompact ? 'text-sm sm:text-base md:text-lg' : 'text-base sm:text-lg md:text-xl'
                      } font-black tracking-wide truncate text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]`}>
                        {displayTeamTitle}
                      </p>
                      {isLeader && (
                        <span title="1st Place Leader" className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-400/25 text-amber-200 border border-amber-300/40 shrink-0">
                          👑
                        </span>
                      )}
                      {(t.streak || 0) >= 2 && (
                        <span className="text-[10px] font-black bg-orange-500 text-white px-1.5 py-0.5 rounded shrink-0">
                          🔥{t.streak}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Horizontal Divider + Large Score Row */}
                <div className={`${isCompact ? 'mt-2 pt-1.5' : 'mt-2.5 pt-2'} border-t flex items-baseline justify-between ${
                  isCurrent ? 'border-amber-300/30' : 'border-white/15'
                }`}>
                  <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-white/85">
                    SCORE
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <div className={`${
                      isCompact
                        ? 'text-3xl sm:text-4xl md:text-[42px]'
                        : 'text-4xl sm:text-5xl md:text-6xl'
                    } font-black tracking-tight tabular-nums leading-none ${
                      isCurrent
                        ? 'text-[#fbbf24] drop-shadow-[0_2px_12px_rgba(251,191,36,0.55)]'
                        : 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
                    }`}>
                      <AnimatedScore value={t.score} />
                    </div>
                    <span className={`text-xs sm:text-sm font-black uppercase ${
                      isCurrent ? 'text-[#fde68a]' : 'text-white/85'
                    }`}>
                      PTS
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <GoldenLaurelSprig flip />
      </div>
    </div>
  );
}

export function MysteryBox({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );

  const [screen, setScreen] = useState<GameScreen>(
    initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor'
  );
  const [showModeModal, setShowModeModal] = useState(false);
  const [showInGameSettings, setShowInGameSettings] = useState(false);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const transparentChestSrc = useTransparentTreasureChest();

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(d => f.push({ id: d.id, ...d.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);

  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame) {
      const raw = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_MYSTERY_QUESTION]);

      const sanitized = raw.map((q: any, i: number) => ({
        id: q.id || (i + 1),
        text: q.text || q.question || "",
        options: q.options && q.options.length >= 2 ? q.options : ["", "", "", ""],
        answerIndex: q.answerIndex !== undefined ? q.answerIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
        optionImages: q.optionImages || [null, null, null, null],
      }));

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: sanitized.length > 0 ? sanitized : [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
    };
  });

  useEffect(() => {
    if (initialGame) {
      const raw = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : [BLANK_MYSTERY_QUESTION]);

      const sanitized = raw.map((q: any, i: number) => ({
        id: q.id || (i + 1),
        text: q.text || q.question || "",
        options: q.options && q.options.length >= 2 ? q.options : ["", "", "", ""],
        answerIndex: q.answerIndex !== undefined ? q.answerIndex : (q.correctOptionIndex !== undefined ? q.correctOptionIndex : 0),
        optionImages: q.optionImages || [null, null, null, null],
      }));

      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: sanitized.length > 0 ? sanitized : [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    } else {
      setActiveQuiz({
        id: Date.now(),
        title: "",
        folderId: "",
        topic: "",
        classLevel: "",
        questions: [{ ...BLANK_MYSTERY_QUESTION, id: Date.now() }],
      });
      setScreen('editor');
    }
  }, [initialGame]);

  const savingQuizRef = useRef(false);
  const saveQuiz = async (quiz: Quiz) => {
    if (savingQuizRef.current) return;
    savingQuizRef.current = true;
    try {
      const sanitizedQuestions = quiz.questions;
      const isPublicBool = Boolean(quiz.isPublic);
      const now = new Date().toISOString();

      const gameToSave = JSON.parse(JSON.stringify({
        name: quiz.topic || quiz.title || "Mystery Box",
        title: quiz.title || quiz.topic || "Mystery Box",
        className: quiz.classLevel || "",
        topic: quiz.topic || "",
        folderId: quiz.folderId || "",
        gameType: "mystery-box",
        theme: selectedTheme,
        difficulty: difficulty,
        setupTeamCount: numPlayers,
        customQuestions: sanitizedQuestions,
        userId: user?.uid || 'local-user',
        creatorName: user?.displayName || user?.email?.split('@')[0] || "Teacher",
        creatorEmail: user?.email || "",
        updatedAt: now,
        publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
        createdAt: initialGame?.createdAt || now,
        isPublic: isPublicBool,
      }));

      await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: initialGame,
      });
      onViewChange("games");
    } catch (error: any) {
      console.error("Error saving game:", error);
      onViewChange("games");
    } finally {
      savingQuizRef.current = false;
    }
  };

  // --- GAME SETUP & PLAY STATE ---
  const [numPlayers, setNumPlayers] = useState(() => initialGame?.setupTeamCount || 2);
  const [playerNames, setPlayerNames] = useState<string[]>([
    "Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8"
  ]);
  const [teamAvatars, setTeamAvatars] = useState<number[]>([1, 2, 3, 4, 5, 6, 7, 8]);
  const [selectedQuestionLimit, setSelectedQuestionLimit] = useState<number>(() =>
    Math.max(1, initialGame?.customQuestions?.length || initialGame?.questions?.length || 10)
  );
  const [gameTimeMinutes, setGameTimeMinutes] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<'normal' | 'medium' | 'difficult'>('medium');
  const [selectedTheme, setSelectedTheme] = useState<string>(() => initialGame?.theme || 'theme-sky');
  const [isMuted, setIsMuted] = useState(false);
  const [wrongAnswerPenalty, setWrongAnswerPenalty] = useState(true);
  const [answerBonusPoints, setAnswerBonusPoints] = useState(true);

  useEffect(() => {
    setSelectedQuestionLimit(Math.max(1, activeQuiz.questions.length));
  }, [activeQuiz.questions.length]);

  useEffect(() => {
    if (screen !== 'game' || remainingSeconds === null || remainingSeconds <= 0) return;
    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen, remainingSeconds]);

  // In-Game state
  const [teams, setTeams] = useState<Team[]>([
    { id: 0, name: "Team 1", score: 0, streak: 0, avatarId: 19 }
  ]);
  const [currentTeamIdx, setCurrentTeamIdx] = useState(0);
  const [openedBoxes, setOpenedBoxes] = useState<number[]>([]);
  const [boxRecords, setBoxRecords] = useState<Record<number, OpenedBoxRecord>>({});
  const [selectedBoxAnimation, setSelectedBoxAnimation] = useState<number | null>(null);
  const [scoreDeltas, setScoreDeltas] = useState<ScoreDeltaPopup[]>([]);
  const [liveScoreFeed, setLiveScoreFeed] = useState<{ text: string; isPositive: boolean; id: number } | null>(null);
  const [manualGameEnded, setManualGameEnded] = useState(false);

  // Active question & mystery box modal state
  const [activeBoxNum, setActiveBoxNum] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<'correct' | 'incorrect' | null>(null);
  const [lastAnswerPointChange, setLastAnswerPointChange] = useState<number>(0);
  const [modalStep, setModalStep] = useState<'question' | 'decision' | 'give_away_selection' | 'unboxing' | 'target_selection' | 'reveal'>('question');
  const [currentOutcome, setCurrentOutcome] = useState<Outcome | null>(null);
  const [outcomeSummary, setOutcomeSummary] = useState<string>("");
  const [outcomeBeforeAfter, setOutcomeBeforeAfter] = useState<{ teamName: string; before: number; after: number; delta: number } | null>(null);
  const [teamScoreTransitions, setTeamScoreTransitions] = useState<Array<{
    id: number;
    name: string;
    icon: string;
    before: number;
    after: number;
    delta: number;
    label?: string;
    isPositive: boolean;
    isReceiver: boolean;
  }>>([]);
  const [revealScoreApplied, setRevealScoreApplied] = useState(false);
  const [targetTeamIdx, setTargetTeamIdx] = useState<number | null>(null);
  const [celebration, setCelebration] = useState<'win' | 'lose' | 'jackpot' | null>(null);
  const [unboxPreviewItem, setUnboxPreviewItem] = useState<{ icon: string; text: string; color: string }>({
    icon: "🎁",
    text: "+300 PTS",
    color: "from-amber-400 to-orange-500"
  });
  const [mysteryHint, setMysteryHint] = useState<string>(MYSTERY_VIBE_HINTS[0]);

  const autoAdvanceTimerRef = useRef<any>(null);
  const revealCountTimerRef = useRef<any>(null);
  const pendingTeamsRef = useRef<Team[] | null>(null);

  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      if (revealCountTimerRef.current) clearTimeout(revealCountTimerRef.current);
    };
  }, []);

  // Study Mode state (Interactive Full-Screen)
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);
  const [studyHistory, setStudyHistory] = useState<Record<number, { selected: number; isCorrect: boolean }>>({});

  // Rich Multi-Layered Web Audio Synthesizer + In-Game Adventure Background Music
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bgmStepRef = useRef<number>(0);
  const hasAnnouncedGameOverRef = useRef<boolean>(false);

  const ensureAudioContext = (): AudioContext | null => {
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    } catch {
      return null;
    }
  };

  const playSound = (type: string) => {
    if (isMuted) return;
    try {
      const ctx = ensureAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const playTone = (
        freq: number,
        oscType: OscillatorType,
        startOffset: number,
        duration: number,
        peakGain: number,
        endFreq?: number
      ) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = oscType;
        const t0 = now + startOffset;
        osc.frequency.setValueAtTime(freq, t0);
        if (endFreq !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + duration);
        }
        gain.gain.setValueAtTime(0.001, t0);
        gain.gain.linearRampToValueAtTime(peakGain, t0 + Math.min(0.014, duration * 0.25));
        gain.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration + 0.01);
      };

      if (type === 'hover') {
        // Subtle crisp wooden tick when hovering over treasure chests or options
        playTone(740, 'sine', 0, 0.032, 0.09, 980);
      } else if (type === 'click' || type === 'select') {
        // Crisp 2-stage arcade selection pop + harmonic lock-in chime
        playTone(540, 'triangle', 0, 0.065, 0.25, 860);
        playTone(1080, 'sine', 0.035, 0.085, 0.22, 1320);
      } else if (type === 'roulette_tick') {
        // Mechanical prize-wheel wooden peg click
        playTone(1080, 'triangle', 0, 0.042, 0.22, 460);
        playTone(1620, 'sine', 0, 0.025, 0.12, 720);
      } else if (type === 'coin_add') {
        // Bright arcade gold coin ding-ding-shimmer!
        playTone(987.77, 'sine', 0, 0.16, 0.28);
        playTone(1318.51, 'sine', 0.065, 0.32, 0.30);
        playTone(1975.53, 'triangle', 0.09, 0.26, 0.16);
      } else if (type === 'point_deduct') {
        // Distinct descending point loss thud-zap
        playTone(360, 'sawtooth', 0, 0.15, 0.24, 210);
        playTone(230, 'sawtooth', 0.09, 0.22, 0.24, 115);
        playTone(130, 'triangle', 0.09, 0.24, 0.26, 72);
      } else if (type === 'box_open') {
        // 3D Treasure Chest selection: wooden thump + metallic latch click + magical crystal arpeggio
        playTone(165, 'sine', 0, 0.12, 0.30, 75);
        playTone(1350, 'triangle', 0.03, 0.045, 0.22, 2100);
        [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((freq, i) => {
          playTone(freq, 'triangle', 0.05 + i * 0.05, 0.34, 0.24);
          playTone(freq * 1.5, 'sine', 0.05 + i * 0.05, 0.22, 0.10);
        });
      } else if (type === 'correct') {
        // Winning Answer Fanfare: Rich game-show major chord chime + high bell sparkle
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, i) => {
          playTone(freq, 'triangle', i * 0.065, 0.48, 0.30);
          playTone(freq * 2, 'sine', i * 0.065 + 0.015, 0.32, 0.14);
        });
        // Sustain celebratory triad at top
        [1046.5, 1318.51, 1567.98].forEach((freq) => {
          playTone(freq, 'sine', 0.28, 0.45, 0.18);
        });
      } else if (type === 'incorrect') {
        // Losing Answer Sound: Dual-oscillator game show wrong buzzer + descending "wah-wah" slide
        [185, 198].forEach((freq) => {
          playTone(freq, 'sawtooth', 0, 0.36, 0.24, freq * 0.78);
        });
        playTone(95, 'triangle', 0, 0.38, 0.26, 65);
        // Comedic descending minor "wah-wah" tail
        [329.63, 293.66, 246.94].forEach((freq, idx) => {
          const start = 0.18 + idx * 0.12;
          const dur = idx === 2 ? 0.32 : 0.11;
          playTone(freq, 'sawtooth', start, dur, 0.20, idx === 2 ? 185 : freq * 0.94);
          playTone(freq * 0.5, 'triangle', start, dur, 0.22, idx === 2 ? 92.5 : freq * 0.47);
        });
      } else if (type === 'suspense') {
        // Rising mystery shimmer
        playTone(293.66, 'sine', 0, 0.38, 0.18, 587.33);
        playTone(440, 'triangle', 0.08, 0.34, 0.15, 880);
      } else if (type === 'win' || type === 'jackpot') {
        // Triumphant Treasure Victory Fanfare + harmonic brass chord + coin cascade
        const notes = type === 'jackpot'
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
          : [440, 554.37, 659.25, 880, 1108.73];
        notes.forEach((freq, idx) => {
          playTone(freq, 'triangle', idx * 0.075, 0.56, 0.30);
          playTone(freq * 0.5, 'sine', idx * 0.075, 0.45, 0.18);
          playTone(freq * 1.5, 'sine', idx * 0.075 + 0.015, 0.35, 0.11);
        });
      } else if (type === 'lose') {
        // Comedic Sad Trombone "Wah-Wah-Wah-Waaaaah" losing sound effect
        const wahNotes = [392.0, 369.99, 349.23, 329.63];
        wahNotes.forEach((freq, idx) => {
          const start = idx * 0.16;
          const dur = idx === 3 ? 0.52 : 0.14;
          const endF = idx === 3 ? 233.08 : freq * 0.96;
          playTone(freq, 'sawtooth', start, dur, 0.24, endF);
          playTone(freq * 0.5, 'triangle', start, dur, 0.24, endF * 0.5);
        });
      } else if (type === 'bomb') {
        // Deep sub-bass explosion impact + filtered noise burst + losing trombone tail
        playTone(170, 'sine', 0, 0.68, 0.38, 32);
        playTone(110, 'sawtooth', 0, 0.45, 0.26, 40);

        try {
          const bufferSize = Math.floor(ctx.sampleRate * 0.55);
          const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = buffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1150, now);
          filter.frequency.exponentialRampToValueAtTime(80, now + 0.55);
          const noiseGain = ctx.createGain();
          noiseGain.gain.setValueAtTime(0.32, now);
          noiseGain.gain.linearRampToValueAtTime(0.001, now + 0.55);
          noise.connect(filter);
          filter.connect(noiseGain);
          noiseGain.connect(ctx.destination);
          noise.start(now);
          noise.stop(now + 0.55);
        } catch {
          // ignore
        }
      } else if (type === 'steal_swap') {
        // Sneaky pirate heist swoop + golden chime
        playTone(260, 'sine', 0, 0.22, 0.26, 940);
        playTone(940, 'triangle', 0.20, 0.26, 0.24, 420);
        playTone(1174.66, 'sine', 0.26, 0.28, 0.22);
      }
    } catch {
      // Audio fallback
    }
  };

  // Ambient In-Game Treasure Adventure Background Soundtrack (Plays during active gameplay)
  useEffect(() => {
    if (screen !== 'game' || isMuted || manualGameEnded) return;

    // Playful treasure-hunt marimba/pluck melody & warm bass groove in D Dorian / F Major
    const melodyNotes = [
      293.66, 349.23, 440.0, 523.25,
      587.33, 523.25, 440.0, 349.23,
      392.0, 440.0, 523.25, 659.25,
      587.33, 523.25, 440.0, 329.63,
    ];
    const bassNotes = [146.83, 146.83, 174.61, 196.0];

    const interval = setInterval(() => {
      try {
        const ctx = audioCtxRef.current;
        if (!ctx || ctx.state !== 'running') return;
        const step = bgmStepRef.current % 16;
        bgmStepRef.current += 1;

        const now = ctx.currentTime;
        // Duck background music softly when a question modal is open so SFX & speech stay crystal clear
        const duckFactor = activeBoxNum !== null ? 0.45 : 1.0;

        // Warm marimba melody note
        const melFreq = melodyNotes[step];
        if (melFreq) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(melFreq, now);
          gain.gain.setValueAtTime(0.0005, now);
          gain.gain.linearRampToValueAtTime(0.042 * duckFactor, now + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.23);
        }

        // Soft adventure bass pulse on every 4th beat
        if (step % 4 === 0) {
          const bassFreq = bassNotes[Math.floor(step / 4) % bassNotes.length];
          const bOsc = ctx.createOscillator();
          const bGain = ctx.createGain();
          bOsc.type = 'triangle';
          bOsc.frequency.setValueAtTime(bassFreq, now);
          bGain.gain.setValueAtTime(0.0005, now);
          bGain.gain.linearRampToValueAtTime(0.05 * duckFactor, now + 0.02);
          bGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.42);
          bOsc.connect(bGain);
          bGain.connect(ctx.destination);
          bOsc.start(now);
          bOsc.stop(now + 0.44);
        }

        // Gentle crystalline cave sparkle on beat 8 and 15
        if (step === 7 || step === 15) {
          const sOsc = ctx.createOscillator();
          const sGain = ctx.createGain();
          sOsc.type = 'sine';
          sOsc.frequency.setValueAtTime(step === 7 ? 1174.66 : 1318.51, now);
          sGain.gain.setValueAtTime(0.0005, now);
          sGain.gain.linearRampToValueAtTime(0.022 * duckFactor, now + 0.01);
          sGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.28);
          sOsc.connect(sGain);
          sGain.connect(ctx.destination);
          sOsc.start(now);
          sOsc.stop(now + 0.3);
        }
      } catch {
        // ignore audio errors
      }
    }, 290);

    return () => clearInterval(interval);
  }, [screen, isMuted, manualGameEnded, activeBoxNum]);

  // Trigger floating score delta badge on scoreboard + live banner
  const triggerScoreDeltaPopup = (teamId: number, text: string, isPositive: boolean) => {
    const popupId = Date.now() + Math.random();
    setScoreDeltas(prev => [...prev, { id: popupId, teamId, text, isPositive }]);
    setLiveScoreFeed({ id: popupId, text, isPositive });
    setTimeout(() => {
      setScoreDeltas(prev => prev.filter(p => p.id !== popupId));
    }, 1600);
    setTimeout(() => {
      setLiveScoreFeed(prev => (prev?.id === popupId ? null : prev));
    }, 2400);
  };

  // Manual Live Point Adjuster for Teacher on Scoreboard
  const handleManualScoreAdjust = (teamIdx: number, amount: number, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound(amount > 0 ? 'coin_add' : 'point_deduct');
    const team = teams[teamIdx];
    if (!team) return;
    setTeams(prev => prev.map((t, idx) => idx === teamIdx ? { ...t, score: t.score + amount } : t));
    const sign = amount > 0 ? `+${amount}` : `${amount}`;
    triggerScoreDeltaPopup(team.id, `${sign} PTS`, amount > 0);
  };

  // Start Playing
  const handleStartGame = () => {
    playSound('select');
    setTimeout(() => playSound('win'), 90);
    const configuredTeams: Team[] = [];
    for (let i = 0; i < numPlayers; i++) {
      const cfg = DEFAULT_TEAM_CONFIGS[i % DEFAULT_TEAM_CONFIGS.length];
      const rawName = playerNames[i]?.trim();
      const fallbackName = numPlayers === 1 ? "Player 1" : cfg.defaultName;
      configuredTeams.push({
        id: i,
        name: rawName || fallbackName,
        score: 0,
        streak: 0,
        avatarId: teamAvatars[i] || ((i % 20) + 1),
        color: cfg.color,
        icon: cfg.icon,
        bg: cfg.bg,
        border: cfg.border,
        ring: cfg.ring
      });
    }
    setTeams(configuredTeams);
    setCurrentTeamIdx(0);
    setOpenedBoxes([]);
    setBoxRecords({});
    setActiveBoxNum(null);
    setCelebration(null);
    setSelectedBoxAnimation(null);
    setScoreDeltas([]);
    setManualGameEnded(false);
    hasAnnouncedGameOverRef.current = false;
    setRemainingSeconds(gameTimeMinutes > 0 ? gameTimeMinutes * 60 : null);
    setScreen('game');
  };

  // Announce Winner with Fanfare, Confetti & Voice Synthesis
  const announceWinnerEffect = (currentTeams: Team[]) => {
    hasAnnouncedGameOverRef.current = true;
    playSound('jackpot');
    setTimeout(() => playSound('win'), 360);
    setTimeout(() => playSound('coin_add'), 720);
    setCelebration('jackpot');
    setTimeout(() => setCelebration(null), 4500);

    if (!isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window && currentTeams.length > 0) {
      try {
        window.speechSynthesis.cancel();
        const sorted = [...currentTeams].sort((a, b) => b.score - a.score);
        const topScore = sorted[0]?.score ?? 0;
        const winners = sorted.filter((t) => t.score === topScore);
        let speechText = '';
        if (currentTeams.length === 1) {
          speechText = `Game over! ${sorted[0].name} finished with ${topScore} points!`;
        } else if (winners.length > 1) {
          const names = winners.map((w) => w.name).join(' and ');
          speechText = `Game over! It is a tie between ${names} with ${topScore} points!`;
        } else {
          speechText = `Game over! The winner is ${winners[0].name} with ${topScore} points! Congratulations!`;
        }
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 1.0;
        utterance.pitch = 1.08;
        window.speechSynthesis.speak(utterance);
      } catch {
        // ignore speech synthesis errors
      }
    }
  };

  const handleEndGameAndAnnounceWinner = () => {
    playSound('select');
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (revealCountTimerRef.current) clearTimeout(revealCountTimerRef.current);
    let latestTeams = teams;
    if (pendingTeamsRef.current) {
      latestTeams = pendingTeamsRef.current;
      setTeams(pendingTeamsRef.current);
      pendingTeamsRef.current = null;
    }
    setActiveBoxNum(null);
    setAnswerResult(null);
    setManualGameEnded(true);
    announceWinnerEffect(latestTeams);
  };

  // Interactive Study Mode Handlers
  const handleOpenStudy = () => {
    playSound('select');
    setStudyIndex(0);
    setStudySelectedOption(null);
    setStudyHistory({});
    setScreen('study');
  };

  const handleStudyOptionClick = (optionIdx: number) => {
    const currentQ = activeQuiz.questions[studyIndex];
    if (!currentQ || studySelectedOption !== null) return;
    playSound('select');
    const isCorrect = optionIdx === currentQ.answerIndex;
    setStudySelectedOption(optionIdx);
    setTimeout(() => playSound(isCorrect ? 'correct' : 'incorrect'), 75);
    setStudyHistory(prev => ({
      ...prev,
      [studyIndex]: { selected: optionIdx, isCorrect }
    }));
  };

  const handleStudyNext = () => {
    playSound('select');
    if (studyIndex < activeQuiz.questions.length - 1) {
      const nextIdx = studyIndex + 1;
      setStudyIndex(nextIdx);
      setStudySelectedOption(studyHistory[nextIdx]?.selected ?? null);
    } else {
      setScreen('setup');
    }
  };

  const handleStudyPrev = () => {
    playSound('select');
    if (studyIndex > 0) {
      const prevIdx = studyIndex - 1;
      setStudyIndex(prevIdx);
      setStudySelectedOption(studyHistory[prevIdx]?.selected ?? null);
    }
  };

  const handleStudyRetry = () => {
    playSound('select');
    setStudySelectedOption(null);
    setStudyHistory(prev => {
      const copy = { ...prev };
      delete copy[studyIndex];
      return copy;
    });
  };

  const studyTotalAnswered = Object.keys(studyHistory).length;
  const studyCorrectCount = Object.values(studyHistory).filter(h => h.isCorrect).length;
  const studyAccuracy = studyTotalAnswered > 0 ? Math.round((studyCorrectCount / studyTotalAnswered) * 100) : 0;

  // Box Click Handler
  const handleBoxClick = (num: number) => {
    if (openedBoxes.includes(num)) return;
    if (selectedBoxAnimation !== null) return;

    playSound('select');
    playSound('box_open');
    setSelectedBoxAnimation(num);
    setMysteryHint(MYSTERY_VIBE_HINTS[(num * 7 + openedBoxes.length) % MYSTERY_VIBE_HINTS.length]);

    setTimeout(() => {
      playSound('suspense');
      setActiveBoxNum(num);
      setIsAnswerRevealed(false);
      setSelectedOptionIndex(null);
      setAnswerResult(null);
      setLastAnswerPointChange(0);
      setCurrentOutcome(null);
      setOutcomeBeforeAfter(null);
      setModalStep('question');
      setTargetTeamIdx(null);
      setSelectedBoxAnimation(null);
    }, 550);
  };

  // Proceed after Correct Answer -> Decision (or direct unbox for Solo)
  const proceedAfterCorrect = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    playSound('select');
    if (teams.length > 1) {
      setModalStep('decision');
    } else {
      handleExecuteDecision(0);
    }
  };

  // Proceed after Incorrect Answer -> Close modal & advance turn
  const proceedAfterIncorrect = () => {
    if (autoAdvanceTimerRef.current) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    playSound('select');
    if (activeBoxNum !== null && !openedBoxes.includes(activeBoxNum)) {
      setOpenedBoxes(prev => [...prev, activeBoxNum]);
      setBoxRecords(prev => ({
        ...prev,
        [activeBoxNum]: {
          icon: "✗",
          label: wrongAnswerPenalty ? "-50 pts" : "Missed",
          isPositive: false,
          teamName: teams[currentTeamIdx]?.name
        }
      }));
    }
    setActiveBoxNum(null);
    setAnswerResult(null);
    if (teams.length > 1) {
      setCurrentTeamIdx((currentTeamIdx + 1) % teams.length);
    }
  };

  // AUTO-REVEAL ON OPTION CLICK: Immediately plays selection + winning/losing sound effect & updates Live Points!
  const handleOptionSelect = (idx: number) => {
    if (isAnswerRevealed || activeBoxNum === null) return;
    const currentQ = activeQuiz.questions[activeBoxNum - 1];
    if (!currentQ) return;

    playSound('select');
    setSelectedOptionIndex(idx);
    setIsAnswerRevealed(true);

    const isCorrect = idx === currentQ.answerIndex;
    setAnswerResult(isCorrect ? 'correct' : 'incorrect');

    const activeTeam = teams[currentTeamIdx];

    if (isCorrect) {
      setTimeout(() => playSound('correct'), 65);
      const newStreak = (activeTeam?.streak || 0) + 1;
      const streakBonus = newStreak >= 2 ? (newStreak - 1) * 25 : 0;
      const basePoints = answerBonusPoints ? 50 + streakBonus : 0;
      setLastAnswerPointChange(basePoints);

      setTeams(prev => prev.map((t, i) => i === currentTeamIdx ? {
        ...t,
        score: t.score + basePoints,
        streak: newStreak
      } : t));

      if (basePoints > 0 && activeTeam) {
        const label = newStreak >= 2
          ? `+${basePoints} PTS (🔥${newStreak}x)`
          : `+${basePoints} PTS`;
        setTimeout(() => playSound('coin_add'), 240);
        triggerScoreDeltaPopup(activeTeam.id, label, true);
      }

      // Auto-advance to Mystery Box Decision after 1.7s so students see the green reveal first
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (teams.length > 1) {
          playSound('suspense');
          setModalStep('decision');
        } else {
          handleExecuteDecision(0);
        }
      }, 1750);
    } else {
      setTimeout(() => playSound('incorrect'), 65);
      const penalty = wrongAnswerPenalty ? -50 : 0;
      setLastAnswerPointChange(penalty);

      setTeams(prev => prev.map((t, i) => i === currentTeamIdx ? {
        ...t,
        score: t.score + penalty,
        streak: 0
      } : t));

      if (penalty < 0 && activeTeam) {
        setTimeout(() => playSound('point_deduct'), 260);
        triggerScoreDeltaPopup(activeTeam.id, `${penalty} PTS`, false);
      }

      // Auto-advance to next team after 2.4s so students clearly see the right answer highlighted in green
      if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = setTimeout(() => {
        setOpenedBoxes(prev => (activeBoxNum !== null && !prev.includes(activeBoxNum) ? [...prev, activeBoxNum] : prev));
        setBoxRecords(prev => activeBoxNum !== null ? ({
          ...prev,
          [activeBoxNum]: {
            icon: "✗",
            label: penalty < 0 ? `${penalty} pts` : "Missed",
            isPositive: false,
            teamName: activeTeam?.name
          }
        }) : prev);
        setActiveBoxNum(null);
        setAnswerResult(null);
        if (teams.length > 1) {
          setCurrentTeamIdx(prevIdx => (prevIdx + 1) % teams.length);
        }
      }, 2400);
    }
  };

  // Teacher manual reveal (when no student option was clicked yet)
  const handleTeacherRevealOnly = () => {
    if (isAnswerRevealed) return;
    playSound('suspense');
    setIsAnswerRevealed(true);
    setAnswerResult(null);
  };

  // Rich, Exciting Mystery Box Outcomes Pool
  const getOutcomesList = (): Outcome[] => {
    const makeSimpleOutcome = (
      id: string,
      text: string,
      subtitle: string,
      icon: string,
      category: Outcome['category'],
      color: string,
      badgeText: string,
      deltaAmount: number
    ): Outcome => ({
      id,
      text,
      subtitle,
      icon,
      category,
      color,
      badgeText,
      execute: (t, idx) => {
        const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + deltaAmount } : { ...team });
        const sign = deltaAmount > 0 ? `+${deltaAmount}` : `${deltaAmount}`;
        return {
          teams: updated,
          deltas: {
            [t[idx].id]: { amount: deltaAmount, label: `${sign} PTS`, isPositive: deltaAmount >= 0 }
          },
          summaryText: `${t[idx].name} ${deltaAmount >= 0 ? 'gained' : 'lost'} ${Math.abs(deltaAmount)} points!`
        };
      }
    });

    const normal: Outcome[] = [
      makeSimpleOutcome("add100", "+100 POINTS", "Lucky Bronze Coin Chest!", "🪙", "treasure", "from-teal-500 to-emerald-600", "+100", 100),
      makeSimpleOutcome("add200", "+200 POINTS", "Silver Treasure Stash!", "💰", "treasure", "from-emerald-500 to-green-600", "+200", 200),
      makeSimpleOutcome("add300", "+300 POINTS", "Golden Gem Vault!", "💎", "treasure", "from-amber-400 to-orange-500", "+300", 300),
      makeSimpleOutcome("add150", "+150 POINTS", "Super Star Boost!", "⭐", "treasure", "from-cyan-500 to-blue-600", "+150", 150),
      {
        id: "double_score",
        text: "DOUBLE POINTS (2X)!",
        subtitle: "Doubles your positive score (or +250 pts boost)!",
        icon: "⚡",
        category: "multiplier",
        color: "from-yellow-400 via-amber-500 to-orange-600",
        badgeText: "2X PTS",
        execute: (t, idx) => {
          const currentScore = t[idx].score;
          const gain = currentScore > 100 ? currentScore : 250;
          const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + gain } : { ...team });
          return {
            teams: updated,
            deltas: {
              [t[idx].id]: { amount: gain, label: `+${gain} (2X!)`, isPositive: true }
            },
            summaryText: `${t[idx].name} triggered a Power Multiplier for +${gain} points!`
          };
        }
      },
      makeSimpleOutcome("sub100", "-100 POINTS", "Booby-Trapped Crate!", "💣", "trap", "from-rose-500 to-red-600", "-100", -100),
      makeSimpleOutcome("sub150", "-150 POINTS", "Hidden Trapdoor!", "🕳️", "trap", "from-red-500 to-rose-700", "-150", -150),
      {
        id: "steal_150",
        text: "STEAL 150 POINTS!",
        subtitle: "Heist up to 150 points from another team!",
        icon: "🥷",
        category: "heist",
        color: "from-indigo-500 to-violet-600",
        badgeText: "STEAL 150",
        requiresTarget: "steal",
        execute: (t, idx, target) => {
          const victimIdx = target !== undefined ? target : (idx + 1) % t.length;
          if (victimIdx === idx || !t[victimIdx]) {
            const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + 150 } : { ...team });
            return {
              teams: updated,
              deltas: { [t[idx].id]: { amount: 150, label: "+150 PTS", isPositive: true } },
              summaryText: `${t[idx].name} claimed +150 bonus points!`
            };
          }
          const updated = t.map((team, i) => {
            if (i === idx) return { ...team, score: team.score + 150 };
            if (i === victimIdx) return { ...team, score: team.score - 150 };
            return { ...team };
          });
          return {
            teams: updated,
            deltas: {
              [t[idx].id]: { amount: 150, label: "+150 STOLEN!", isPositive: true },
              [t[victimIdx].id]: { amount: -150, label: "-150 ROBBED!", isPositive: false }
            },
            summaryText: `${t[idx].name} stole 150 points from ${t[victimIdx].name}!`
          };
        }
      }
    ];

    const medium: Outcome[] = [
      ...normal,
      makeSimpleOutcome("add500", "+500 ROYAL JACKPOT!", "Legendary Crown Treasure!", "👑", "jackpot", "from-amber-400 via-yellow-500 to-orange-600", "+500", 500),
      makeSimpleOutcome("sub250", "-250 DYNAMITE!", "Explosive TNT Barrel!", "💥", "bomb", "from-red-600 to-rose-800", "-250", -250),
      {
        id: "swap_team",
        text: "SWAP TOTAL SCORES!",
        subtitle: "Switch your entire score with another team!",
        icon: "🔄",
        category: "heist",
        color: "from-purple-500 via-fuchsia-500 to-indigo-600",
        badgeText: "SWAP",
        requiresTarget: "swap",
        execute: (t, idx, target) => {
          const otherIdx = target !== undefined ? target : (idx + 1) % t.length;
          if (otherIdx === idx || !t[otherIdx]) {
            const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + 200 } : { ...team });
            return {
              teams: updated,
              deltas: { [t[idx].id]: { amount: 200, label: "+200 PTS", isPositive: true } },
              summaryText: `${t[idx].name} gained +200 bonus points!`
            };
          }
          const scoreA = t[idx].score;
          const scoreB = t[otherIdx].score;
          const diffA = scoreB - scoreA;
          const diffB = scoreA - scoreB;
          const updated = t.map((team, i) => {
            if (i === idx) return { ...team, score: scoreB };
            if (i === otherIdx) return { ...team, score: scoreA };
            return { ...team };
          });
          return {
            teams: updated,
            deltas: {
              [t[idx].id]: { amount: diffA, label: `SWAPPED (${diffA >= 0 ? '+' : ''}${diffA})`, isPositive: diffA >= 0 },
              [t[otherIdx].id]: { amount: diffB, label: `SWAPPED (${diffB >= 0 ? '+' : ''}${diffB})`, isPositive: diffB >= 0 }
            },
            summaryText: `${t[idx].name} (${scoreA}→${scoreB}) swapped scores with ${t[otherIdx].name} (${scoreB}→${scoreA})!`
          };
        }
      },
      {
        id: "steal_250",
        text: "PIRATE HEIST: STEAL 250!",
        subtitle: "Plunder 250 points from any rival team!",
        icon: "🏴‍☠️",
        category: "heist",
        color: "from-blue-600 via-indigo-600 to-purple-700",
        badgeText: "STEAL 250",
        requiresTarget: "steal",
        execute: (t, idx, target) => {
          const victimIdx = target !== undefined ? target : (idx + 1) % t.length;
          if (victimIdx === idx || !t[victimIdx]) {
            const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + 250 } : { ...team });
            return {
              teams: updated,
              deltas: { [t[idx].id]: { amount: 250, label: "+250 PTS", isPositive: true } },
              summaryText: `${t[idx].name} plundered +250 points!`
            };
          }
          const updated = t.map((team, i) => {
            if (i === idx) return { ...team, score: team.score + 250 };
            if (i === victimIdx) return { ...team, score: team.score - 250 };
            return { ...team };
          });
          return {
            teams: updated,
            deltas: {
              [t[idx].id]: { amount: 250, label: "+250 PLUNDERED!", isPositive: true },
              [t[victimIdx].id]: { amount: -250, label: "-250 LOOTED!", isPositive: false }
            },
            summaryText: `${t[idx].name} plundered 250 points from ${t[victimIdx].name}!`
          };
        }
      },
      {
        id: "gift_rain",
        text: "GOLDEN GIFT RAIN!",
        subtitle: "+350 PTS to receiver, +100 PTS to everyone else!",
        icon: "🎁",
        category: "treasure",
        color: "from-emerald-400 via-teal-500 to-cyan-600",
        badgeText: "+350 ALL",
        execute: (t, idx) => {
          const deltas: OutcomeResult['deltas'] = {};
          const updated = t.map((team, i) => {
            const gain = i === idx ? 350 : 100;
            deltas[team.id] = { amount: gain, label: `+${gain} GIFT!`, isPositive: true };
            return { ...team, score: team.score + gain };
          });
          return {
            teams: updated,
            deltas,
            summaryText: `${t[idx].name} got +350 PTS and every other team got +100 PTS!`
          };
        }
      }
    ];

    const difficult: Outcome[] = [
      ...medium,
      makeSimpleOutcome("add1000", "+1,000 MEGA JACKPOT!!", "Ultimate Diamond Vault Unlocked!", "🎰", "jackpot", "from-yellow-400 via-amber-500 to-red-500", "+1000", 1000),
      makeSimpleOutcome("sub500", "-500 CURSED SKULL!", "Ancient Curse Drains Your Vault!", "💀", "bomb", "from-slate-800 via-rose-900 to-black", "-500", -500),
      {
        id: "nuke_all",
        text: "METEOR STRIKE: ALL -200!",
        subtitle: "Every team on the board loses 200 points!",
        icon: "☄️",
        category: "bomb",
        color: "from-orange-600 via-red-700 to-slate-900",
        badgeText: "ALL -200",
        execute: (t) => {
          const deltas: OutcomeResult['deltas'] = {};
          const updated = t.map((team) => {
            deltas[team.id] = { amount: -200, label: "-200 METEOR!", isPositive: false };
            return { ...team, score: team.score - 200 };
          });
          return {
            teams: updated,
            deltas,
            summaryText: `Meteor Strike hit the arena! All teams lost 200 points!`
          };
        }
      },
      {
        id: "robin_hood",
        text: "ROBIN HOOD: DRAIN LEADER!",
        subtitle: "Takes 300 PTS from 1st Place and gives to you!",
        icon: "🏹",
        category: "heist",
        color: "from-emerald-600 via-green-600 to-teal-700",
        badgeText: "ROBIN HOOD",
        execute: (t, idx) => {
          let leaderIdx = 0;
          t.forEach((team, i) => {
            if (team.score > t[leaderIdx].score) leaderIdx = i;
          });
          if (leaderIdx === idx || t.length === 1) {
            const updated = t.map((team, i) => i === idx ? { ...team, score: team.score + 300 } : { ...team });
            return {
              teams: updated,
              deltas: { [t[idx].id]: { amount: 300, label: "+300 HERO!", isPositive: true } },
              summaryText: `${t[idx].name} is already in the lead and claimed +300 Hero Points!`
            };
          }
          const updated = t.map((team, i) => {
            if (i === idx) return { ...team, score: team.score + 300 };
            if (i === leaderIdx) return { ...team, score: team.score - 300 };
            return { ...team };
          });
          return {
            teams: updated,
            deltas: {
              [t[idx].id]: { amount: 300, label: "+300 ROBIN HOOD!", isPositive: true },
              [t[leaderIdx].id]: { amount: -300, label: "-300 DRAINED!", isPositive: false }
            },
            summaryText: `${t[idx].name} drained 300 points from 1st-place leader ${t[leaderIdx].name}!`
          };
        }
      }
    ];

    if (difficulty === 'normal') return normal;
    if (difficulty === 'medium') return medium;
    return difficult;
  };

  // Apply Outcome & Trigger Live Scoreboard Popups + Audio + Auto-Transition
  const applyOutcomeToTeams = (outcome: Outcome, receiverIdx: number, chosenTargetIdx?: number) => {
    const beforeScore = teams[receiverIdx]?.score ?? 0;
    const result = outcome.execute(teams, receiverIdx, chosenTargetIdx);
    const afterScore = result.teams[receiverIdx]?.score ?? beforeScore;

    // Build per-team before/after transitions so the Reveal stage shows ALL teams updating live!
    const transitions = teams.map((t, i) => {
      const before = t.score;
      const after = result.teams[i]?.score ?? before;
      const delta = after - before;
      const dInfo = result.deltas[t.id];
      const cfg = DEFAULT_TEAM_CONFIGS[i % DEFAULT_TEAM_CONFIGS.length];
      return {
        id: t.id,
        name: t.name,
        icon: `#${i + 1}`,
        before,
        after,
        delta,
        label: dInfo?.label || (delta !== 0 ? `${delta > 0 ? '+' : ''}${delta} PTS` : undefined),
        isPositive: dInfo ? dInfo.isPositive : delta >= 0,
        isReceiver: i === receiverIdx,
      };
    });

    setTeamScoreTransitions(transitions);
    setRevealScoreApplied(false);
    pendingTeamsRef.current = result.teams;
    setOutcomeSummary(result.summaryText);
    setOutcomeBeforeAfter({
      teamName: teams[receiverIdx]?.name || "Team",
      before: beforeScore,
      after: afterScore,
      delta: afterScore - beforeScore
    });

    // Trigger floating live deltas for all affected teams
    Object.entries(result.deltas).forEach(([teamIdStr, d]) => {
      triggerScoreDeltaPopup(Number(teamIdStr), d.label, d.isPositive);
    });

    // Play appropriate dramatic winning or losing outcome sound effect
    const mainDelta = afterScore - beforeScore;
    if (outcome.category === 'bomb' || outcome.id.startsWith('sub500')) {
      playSound('bomb');
      setTimeout(() => playSound('lose'), 180);
      setTimeout(() => playSound('point_deduct'), 340);
      setCelebration('lose');
    } else if (outcome.category === 'trap' || mainDelta < 0) {
      playSound('lose');
      setTimeout(() => playSound('point_deduct'), 200);
      setCelebration('lose');
    } else if (outcome.category === 'heist') {
      playSound('steal_swap');
      setTimeout(() => playSound('win'), 180);
      setTimeout(() => playSound('coin_add'), 320);
      setCelebration('win');
    } else if (outcome.category === 'jackpot' || mainDelta >= 500) {
      playSound('jackpot');
      setTimeout(() => playSound('coin_add'), 250);
      setCelebration('jackpot');
    } else {
      playSound('win');
      setTimeout(() => playSound('coin_add'), 200);
      setCelebration('win');
    }

    setTimeout(() => setCelebration(null), 3200);

    if (activeBoxNum !== null) {
      if (!openedBoxes.includes(activeBoxNum)) {
        setOpenedBoxes(prev => [...prev, activeBoxNum]);
      }
      setBoxRecords(prev => ({
        ...prev,
        [activeBoxNum]: {
          icon: outcome.icon,
          label: outcome.badgeText,
          isPositive: mainDelta >= 0,
          teamName: teams[receiverIdx]?.name
        }
      }));
    }

    setModalStep('reveal');

    // Trigger live score count-up / count-down animation on the main scoreboard after 280ms
    if (revealCountTimerRef.current) clearTimeout(revealCountTimerRef.current);
    revealCountTimerRef.current = setTimeout(() => {
      setRevealScoreApplied(true);
      if (pendingTeamsRef.current) {
        setTeams(pendingTeamsRef.current);
        pendingTeamsRef.current = null;
      }
      // Play rapid score-counting ticks during the live score update
      [0, 120, 240, 360, 480, 620, 760].forEach((delay, idx) => {
        setTimeout(() => {
          playSound(idx === 6 ? (mainDelta >= 0 ? 'coin_add' : 'point_deduct') : 'roulette_tick');
        }, delay);
      });
    }, 280);

    // Automatically advance to the next team's turn after live score update completes!
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    autoAdvanceTimerRef.current = setTimeout(() => {
      setActiveBoxNum(null);
      setAnswerResult(null);
      if (teams.length > 1) {
        setCurrentTeamIdx(prevIdx => (prevIdx + 1) % teams.length);
      }
    }, 3400);
  };

  // Exciting Mystery Unboxing Spin before landing on Outcome
  const handleExecuteDecision = (receiverIdx: number) => {
    playSound('select');
    setTargetTeamIdx(receiverIdx);
    const outcomes = getOutcomesList();
    const chosenOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    setCurrentOutcome(chosenOutcome);

    // Start 0.95s unboxing reel spin
    setModalStep('unboxing');
    let ticks = 0;
    const maxTicks = 9;
    const spinInterval = setInterval(() => {
      ticks++;
      playSound('roulette_tick');
      const randomPreview = outcomes[(ticks * 3 + Math.floor(Math.random() * outcomes.length)) % outcomes.length];
      setUnboxPreviewItem({
        icon: randomPreview.icon,
        text: randomPreview.text,
        color: randomPreview.color
      });

      if (ticks >= maxTicks) {
        clearInterval(spinInterval);
        setUnboxPreviewItem({
          icon: chosenOutcome.icon,
          text: chosenOutcome.text,
          color: chosenOutcome.color
        });

        setTimeout(() => {
          if (chosenOutcome.requiresTarget && teams.length > 2) {
            playSound('suspense');
            setModalStep('target_selection');
          } else if (chosenOutcome.requiresTarget && teams.length === 2) {
            const autoOtherTeam = (receiverIdx + 1) % 2;
            applyOutcomeToTeams(chosenOutcome, receiverIdx, autoOtherTeam);
          } else {
            applyOutcomeToTeams(chosenOutcome, receiverIdx);
          }
        }, 220);
      }
    }, 95);
  };

  const handleTargetSelection = (chosenTargetIdx: number) => {
    playSound('select');
    if (currentOutcome && targetTeamIdx !== null) {
      applyOutcomeToTeams(currentOutcome, targetTeamIdx, chosenTargetIdx);
    }
  };

  const handleCloseReveal = () => {
    if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
    if (revealCountTimerRef.current) clearTimeout(revealCountTimerRef.current);
    if (pendingTeamsRef.current) {
      setTeams(pendingTeamsRef.current);
      pendingTeamsRef.current = null;
    }
    playSound('select');
    setActiveBoxNum(null);
    setAnswerResult(null);
    if (teams.length > 1) {
      setCurrentTeamIdx((currentTeamIdx + 1) % teams.length);
    }
  };

      const effectiveTotalBoxes = Math.min(
        activeQuiz.questions.length,
        Math.max(1, selectedQuestionLimit)
      );
      const isGameOver =
        (manualGameEnded ||
          (openedBoxes.length >= effectiveTotalBoxes && activeBoxNum === null) ||
          (remainingSeconds !== null && remainingSeconds <= 0 && activeBoxNum === null)) &&
        screen === 'game';

      useEffect(() => {
        if (isGameOver && !hasAnnouncedGameOverRef.current) {
          announceWinnerEffect(teams);
        }
      }, [isGameOver, teams]);

      // Find current 1st place team ID for crown indicator
      const highestScore = teams.length > 0 ? Math.max(...teams.map(t => t.score)) : 0;

      // --- THEME ATTRIBUTES ---
      const getThemeSetupBg = () => {
        if (selectedTheme === 'theme-ocean') return 'from-sky-700 via-cyan-800 to-slate-950';
        if (selectedTheme === 'theme-space') return 'from-slate-900 via-indigo-950 to-black';
        if (selectedTheme === 'theme-jungle') return 'from-emerald-800 via-green-900 to-slate-950';
        if (selectedTheme === 'theme-sunset') return 'from-orange-600 via-rose-800 to-slate-950';
        if (selectedTheme === 'theme-royal') return 'from-purple-900 via-indigo-950 to-slate-950';
        return 'from-blue-600 via-indigo-800 to-slate-950';
      };

      const getThemeGameBg = () => {
        if (selectedTheme === 'theme-ocean') return 'bg-gradient-to-b from-sky-900 via-cyan-950 to-slate-950';
        if (selectedTheme === 'theme-space') return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black';
        if (selectedTheme === 'theme-jungle') return 'bg-gradient-to-br from-green-950 via-emerald-900 to-slate-950';
        if (selectedTheme === 'theme-sunset') return 'bg-gradient-to-b from-amber-950 via-rose-950 to-slate-950';
        if (selectedTheme === 'theme-royal') return 'bg-gradient-to-br from-indigo-950 via-purple-900 to-slate-950';
        return 'bg-gradient-to-b from-sky-900 via-blue-950 to-slate-950';
      };

      const getThemeBoxClass = () => {
        if (selectedTheme === 'theme-ocean') return 'bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 border-cyan-200/80';
        if (selectedTheme === 'theme-space') return 'bg-gradient-to-br from-indigo-500 via-purple-600 to-slate-900 border-indigo-300/80';
        if (selectedTheme === 'theme-jungle') return 'bg-gradient-to-br from-emerald-400 via-green-500 to-teal-700 border-emerald-200/80';
        if (selectedTheme === 'theme-sunset') return 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 border-yellow-200/80';
        if (selectedTheme === 'theme-royal') return 'bg-gradient-to-br from-amber-400 via-orange-500 to-purple-700 border-amber-200/90';
        return 'bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600 border-amber-200/80';
      };

      return (
        <div id="game-container" className="w-full min-h-full flex-1 relative overflow-y-auto select-none">
          {/* 1. QUIZ EDITOR SCREEN (GAME SETUP, CAPPED AT 30 QUESTIONS) */}
          {screen === 'editor' && (
            <QuizEditor
              quiz={activeQuiz}
              onSave={saveQuiz}
              onCancel={() => onViewChange('home', { __stepBack: true })}
              folders={folders}
            />
          )}

          {/* 2. TROPICAL TREASURE ADVENTURE 3D LOBBY SCREEN (BAAMBOOZLE FLOW) */}
          {screen === 'setup' && (
            <MysteryBox3DLobby
              questionCount={activeQuiz.questions.length}
              selectedQuestionLimit={effectiveTotalBoxes}
              onSelectQuestionLimit={(limit) => {
                playSound('click');
                setSelectedQuestionLimit(limit);
              }}
              gameTimeMinutes={gameTimeMinutes}
              onSelectGameTime={(mins) => {
                playSound('click');
                setGameTimeMinutes(mins);
              }}
              numPlayers={numPlayers}
              onSelectNumPlayers={(count) => {
                playSound('click');
                setNumPlayers(count);
              }}
              playerNames={playerNames}
              onChangePlayerName={(idx, val) => {
                setPlayerNames((prev) => {
                  const updated = [...prev];
                  updated[idx] = val;
                  return updated;
                });
              }}
              teamAvatars={teamAvatars}
              onChangeTeamAvatar={(teamIdx, avatarId) => {
                playSound('click');
                setTeamAvatars((prev) => {
                  const next = [...prev];
                  const existingOwner = next.findIndex((id, i) => i < numPlayers && id === avatarId);
                  if (existingOwner !== -1 && existingOwner !== teamIdx) {
                    next[existingOwner] = next[teamIdx];
                  }
                  next[teamIdx] = avatarId;
                  return next;
                });
              }}
              onRandomizeTeamAvatars={() => {
                playSound('click');
                const pool = Array.from({ length: 20 }, (_, i) => i + 1);
                for (let i = pool.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [pool[i], pool[j]] = [pool[j], pool[i]];
                }
                setTeamAvatars(pool.slice(0, 8));
              }}
              difficulty={difficulty}
              onSelectDifficulty={(mode) => {
                playSound('click');
                setDifficulty(mode);
              }}
              answerBonusPoints={answerBonusPoints}
              onToggleBonus={() => {
                playSound('click');
                setAnswerBonusPoints((prev) => !prev);
              }}
              wrongAnswerPenalty={wrongAnswerPenalty}
              onTogglePenalty={() => {
                playSound('click');
                setWrongAnswerPenalty((prev) => !prev);
              }}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((prev) => !prev)}
              selectedTheme={selectedTheme}
              onSelectTheme={(themeId) => {
                playSound('click');
                setSelectedTheme(themeId);
              }}
              onStartGame={handleStartGame}
              onOpenStudy={handleOpenStudy}
              onBack={() => onViewChange('home', { __stepBack: true })}
              onOpenGameSwitcher={() => setShowModeModal(true)}
              onOpenQuizEditor={() => setScreen('editor')}
              showModeAndTheme={false}
            />
          )}

      {/* 3. FULL SCREEN INTERACTIVE STUDY MODE */}
      {screen === 'study' && (
        <div 
          id="study-fullscreen-container"
          className={`fixed inset-0 z-50 flex flex-col ${getThemeGameBg()} text-white select-none overflow-hidden`}
        >
          <div className="w-full h-2 bg-white/10 relative z-20">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${((studyIndex + 1) / Math.max(1, activeQuiz.questions.length)) * 100}%` }}
            />
          </div>

          <header className="px-6 py-4 bg-white/10 backdrop-blur-md border-b border-white/10 flex justify-between items-center z-20 relative shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setScreen('setup')} 
                className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl font-bold text-white transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" /> Back to Setup
              </button>
              <span className="text-amber-300 font-extrabold text-sm hidden sm:inline">
                📖 Study Mode
              </span>
            </div>

            <div className="font-black text-lg text-white">
              Question <span className="text-amber-300 font-black text-xl">{studyIndex + 1}</span> / {activeQuiz.questions.length}
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 text-emerald-300 font-bold text-sm">
                Score: <span className="font-black text-white">{studyCorrectCount}/{studyTotalAnswered}</span> ({studyAccuracy}%)
              </div>
              <button 
                onClick={() => setIsMuted(!isMuted)} 
                className="p-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <FullscreenButton targetId="study-fullscreen-container" />
            </div>
          </header>

          <main className="flex-1 flex flex-col justify-center items-center p-6 md:p-10 max-w-5xl mx-auto w-full z-10 overflow-y-auto custom-scrollbar">
            {activeQuiz.questions.length > 0 ? (
              <div className="w-full flex flex-col items-center my-auto">
                <span className="text-amber-400 font-black text-sm uppercase tracking-widest mb-3">
                  Question {studyIndex + 1}
                </span>

                {(() => {
                  const currentStudyQ = activeQuiz.questions[studyIndex];
                  const qParsed = parseOptionContent(currentStudyQ?.text || '');
                  const qImg = currentStudyQ?.image || qParsed.imageUrl;
                  const qDisplayText = qParsed.text || currentStudyQ?.text;
                  return (
                    <div className="w-full flex flex-col items-center mb-8 max-w-4xl">
                      {qImg && (
                        <div className="mb-4 max-h-56 sm:max-h-72 w-full flex items-center justify-center">
                          <img
                            src={qImg}
                            alt={qDisplayText || `Question ${studyIndex + 1}`}
                            className="max-h-52 sm:max-h-64 max-w-full rounded-2xl object-contain shadow-lg bg-white/10 p-2 border border-white/20"
                          />
                        </div>
                      )}
                      {qDisplayText && (
                        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white text-center leading-tight break-words">
                          {qDisplayText}
                        </h2>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-8">
                  {activeQuiz.questions[studyIndex]?.options.map((opt, i) => {
                    if (!opt || opt.trim() === '') return null;
                    const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i] || (i + 1);
                    const isSelected = studySelectedOption === i;
                    const isCorrectAnswer = i === activeQuiz.questions[studyIndex].answerIndex;
                    const hasAnswered = studySelectedOption !== null;

                    let btnStyle = "bg-white/10 hover:bg-white/20 border-white/20 text-white hover:border-amber-400";

                    if (hasAnswered) {
                      if (isCorrectAnswer) {
                        btnStyle = "bg-emerald-500 border-emerald-300 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)] scale-[1.02] z-10";
                      } else if (isSelected && !isCorrectAnswer) {
                        btnStyle = "bg-rose-500 border-rose-300 text-white animate-shake";
                      } else {
                        btnStyle = "bg-white/5 border-white/10 text-white/40 opacity-40";
                      }
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleStudyOptionClick(i)}
                        disabled={hasAnswered}
                        className={`p-5 sm:p-6 rounded-2xl text-lg sm:text-2xl font-bold border-2 transition-all duration-300 flex items-center justify-between text-left gap-4 cursor-pointer ${btnStyle}`}
                      >
                        <div className="flex items-center gap-3.5 flex-1">
                          <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shrink-0 ${
                            hasAnswered && isCorrectAnswer
                              ? 'bg-white text-emerald-600'
                              : hasAnswered && isSelected && !isCorrectAnswer
                              ? 'bg-white text-rose-600'
                              : 'bg-white/15 text-white'
                          }`}>
                            {letter}
                          </span>
                          <span className="flex-1 break-words">{opt}</span>
                        </div>
                        {hasAnswered && isCorrectAnswer && (
                          <span className="flex items-center gap-1 bg-white text-emerald-600 px-3 py-1 rounded-xl font-black text-xs shrink-0">
                            <Check size={16} strokeWidth={3} /> CORRECT
                          </span>
                        )}
                        {hasAnswered && isSelected && !isCorrectAnswer && (
                          <span className="flex items-center gap-1 bg-white text-rose-600 px-3 py-1 rounded-xl font-black text-xs shrink-0">
                            <X size={16} strokeWidth={3} /> WRONG
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {studySelectedOption !== null && (
                  <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 animate-pop-in">
                    <div>
                      {studySelectedOption === activeQuiz.questions[studyIndex]?.answerIndex ? (
                        <div className="text-emerald-300 font-black text-lg">
                          🎉 Spot On! Correct Answer!
                        </div>
                      ) : (
                        <div className="text-rose-200 font-bold text-base">
                          Correct Answer: <span className="font-black text-emerald-300 underline">{activeQuiz.questions[studyIndex]?.options[activeQuiz.questions[studyIndex]?.answerIndex]}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {studySelectedOption !== activeQuiz.questions[studyIndex]?.answerIndex && (
                        <button
                          onClick={handleStudyRetry}
                          className="px-5 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl font-bold text-white transition-all cursor-pointer flex items-center gap-2"
                        >
                          <RefreshCw size={16} /> Retry
                        </button>
                      )}
                      <button
                        onClick={handleStudyNext}
                        className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-base shadow-lg transition-all cursor-pointer"
                      >
                        {studyIndex < activeQuiz.questions.length - 1 ? 'Next Question →' : 'Finish Study 🏆'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-slate-400 font-bold text-2xl">No questions found in this quiz!</div>
            )}
          </main>

          <footer className="px-6 py-3.5 bg-white/5 backdrop-blur-md border-t border-white/10 flex justify-between items-center z-20 relative shrink-0">
            <button
              onClick={handleStudyPrev}
              disabled={studyIndex === 0}
              className="px-5 py-2.5 bg-white/15 hover:bg-white/25 disabled:opacity-20 rounded-xl font-bold text-white transition-all cursor-pointer"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60vw] py-1 px-2 custom-scrollbar">
              {activeQuiz.questions.map((_, dotIdx) => {
                const historyItem = studyHistory[dotIdx];
                let dotClass = "bg-white/15 text-white/60";
                if (dotIdx === studyIndex) {
                  dotClass = "bg-amber-400 text-slate-900 scale-110 font-black";
                } else if (historyItem) {
                  dotClass = historyItem.isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white";
                }
                return (
                  <button
                    key={dotIdx}
                    onClick={() => {
                      setStudyIndex(dotIdx);
                      setStudySelectedOption(studyHistory[dotIdx]?.selected ?? null);
                    }}
                    className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition-all cursor-pointer shrink-0 ${dotClass}`}
                  >
                    {dotIdx + 1}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleStudyNext}
              className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black transition-all cursor-pointer"
            >
              {studyIndex < activeQuiz.questions.length - 1 ? 'Next →' : 'Finish 🏆'}
            </button>
          </footer>
        </div>
      )}

      {/* 4. MAIN GAMEPLAY SCREEN (MYSTERY BOX 3D – PREMIUM TREASURE ADVENTURE GAME UI) */}
      {screen === 'game' && (() => {
        const activeQuestions = activeQuiz.questions.slice(0, effectiveTotalBoxes);
        const totalBoxes = activeQuestions.length;
        const numCols =
          totalBoxes <= 4
            ? Math.max(2, totalBoxes)
            : totalBoxes <= 8
            ? 4
            : totalBoxes <= 12
            ? 4
            : totalBoxes <= 20
            ? 5
            : totalBoxes <= 24
            ? 6
            : 6;
        const numRows = Math.max(1, Math.ceil(totalBoxes / numCols));
        const shieldNumSizeClass =
          numRows >= 5
            ? 'text-lg sm:text-2xl md:text-3xl lg:text-4xl'
            : numRows === 4
            ? 'text-xl sm:text-3xl md:text-4xl lg:text-[44px]'
            : 'text-2xl sm:text-4xl md:text-[46px] lg:text-[52px]';

        return (
          <div className={`h-screen max-h-screen w-full relative overflow-hidden flex flex-col justify-between select-none ${celebration === 'lose' ? 'animate-shake' : ''}`}>
            {/* Full-Screen 16:9 3D Magical Treasure Cave Environment Backdrop */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#18112c]">
              <img
                src={treasureCaveBg}
                alt="Magical Treasure Cave Adventure Backdrop"
                className="w-full h-full object-cover object-center"
              />
              {/* Subtle ambient vignette so top UI and central board pop cleanly */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 50% 54%, rgba(25,16,48,0.08) 0%, rgba(16,10,34,0.32) 100%)',
                }}
              />
            </div>

            {/* Confetti Explosion Visual Effect */}
            {(celebration === 'win' || celebration === 'jackpot') && (
              <div className="fixed inset-0 pointer-events-none z-[110] overflow-hidden">
                {Array.from({ length: celebration === 'jackpot' ? 75 : 45 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-3.5 h-3.5 rounded-sm animate-confetti-fall"
                    style={{
                      left: `${(i * 1.9) % 100}%`,
                      top: `-20px`,
                      backgroundColor: ['#fbbf24', '#10b981', '#38bdf8', '#f472b6', '#a855f7', '#fb7185'][i % 6],
                      animationDuration: `${1.8 + (i % 4) * 0.55}s`,
                      animationDelay: `${(i % 8) * 0.08}s`,
                      transform: `rotate(${i * 35}deg)`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Bomb / Negative Impact Visual Effect */}
            {celebration === 'lose' && (
              <div className="fixed inset-0 pointer-events-none z-[110] bg-rose-600/20 animate-pulse border-8 border-rose-500/60"></div>
            )}

            {/* Live Score Feed Toast Banner */}
            {liveScoreFeed && (
              <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[115] pointer-events-none animate-pop-in">
                <div className={`px-6 py-2 rounded-2xl font-black text-base sm:text-lg shadow-2xl border-2 flex items-center gap-2 ${
                  liveScoreFeed.isPositive
                    ? 'bg-emerald-500 text-white border-emerald-200 shadow-emerald-500/40'
                    : 'bg-rose-600 text-white border-rose-300 shadow-rose-600/40'
                }`}>
                  <span>{liveScoreFeed.isPositive ? '⚡' : '💥'}</span>
                  <span>{liveScoreFeed.text}</span>
                </div>
              </div>
            )}

            {/* 2. TOP NAVIGATION BAR (Slim Dark-Purple Translucent Bar) */}
            <header className="shrink-0 px-3 py-1.5 sm:px-5 sm:py-2 bg-[#23173e]/85 backdrop-blur-xl shadow-[0_4px_20px_rgba(10,5,24,0.65)] border-b border-[#8b5cf6]/30 flex flex-wrap justify-between items-center gap-3 z-30 relative">
              {/* LEFT: Rounded Back Button, Golden Gift Icon, Title & Boxes Left Subtitle */}
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => {
                    playSound('select');
                    setScreen('setup');
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#43306b]/90 hover:bg-[#563e88] text-white flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-95"
                  title="Return to Setup"
                >
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.6]" />
                </button>
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-b from-[#fcd34d] via-[#f59e0b] to-[#d97706] border border-[#fef08a] flex items-center justify-center shadow-[0_3px_10px_rgba(245,158,11,0.45)] text-lg shrink-0">
                  🎁
                </div>
                <div>
                  <h1 className="text-base sm:text-xl font-black text-white leading-none tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    Mystery Box
                  </h1>
                  <p className="text-[11px] sm:text-xs text-white/85 font-bold mt-0.5">
                    {totalBoxes - openedBoxes.length} of {totalBoxes} Boxes Left
                  </p>
                </div>
                {remainingSeconds !== null && (
                  <div className="ml-2 px-3 py-1 rounded-full bg-[#150d2a]/80 border border-amber-300/50 text-amber-300 font-black text-xs sm:text-sm tabular-nums shadow-inner">
                    ⏱ {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
                  </div>
                )}
              </div>

              {/* RIGHT: Yellow Settings Pill, Red/Gold End Game Pill, Circular Sound, Purple Switch Mode Pill */}
              <div className="flex items-center gap-2 sm:gap-2.5">
                <button
                  onClick={() => {
                    playSound('select');
                    setShowInGameSettings(true);
                  }}
                  className="px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-b from-[#fde047] via-[#fbbf24] to-[#f59e0b] hover:brightness-105 text-[#1e1303] border-2 border-[#fef08a] shadow-[0_3px_0_#b45309,0_6px_14px_rgba(245,158,11,0.4)] font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                  title="In-Game Settings (Box Mode & Bonus Rules)"
                >
                  <Settings className="w-4 h-4 stroke-[2.6]" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleEndGameAndAnnounceWinner}
                  className="px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-b from-[#fb7185] via-[#e11d48] to-[#be123c] hover:brightness-110 text-white border-2 border-[#fecdd3] shadow-[0_3px_0_#881337,0_6px_14px_rgba(225,29,72,0.45)] font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                  title="End Game & Announce the Winner"
                >
                  <Trophy className="w-4 h-4 text-[#fde047] stroke-[2.6]" />
                  <span>End Game</span>
                </button>
                <button
                  onClick={() => {
                    const nextMuted = !isMuted;
                    setIsMuted(nextMuted);
                    if (!nextMuted) {
                      setTimeout(() => ensureAudioContext(), 10);
                    }
                  }}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#43306b]/90 text-white hover:bg-[#563e88] flex items-center justify-center transition-all cursor-pointer border border-white/25 shadow-[0_2px_8px_rgba(0,0,0,0.4)] active:scale-95"
                  title="Toggle Sound"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Volume2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>
                <button
                  onClick={() => {
                    playSound('select');
                    setShowModeModal(true);
                  }}
                  className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-b from-[#6d48b5] to-[#4c2f87] hover:brightness-110 border border-[#a78bfa]/50 text-white font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_3px_10px_rgba(0,0,0,0.4)] active:scale-95"
                  title="Switch to Bubble Pop, Sumo, or Yoga Quiz"
                >
                  <Shuffle size={14} className="text-[#fbbf24]" />
                  <span>Switch Mode</span>
                </button>
              </div>
            </header>

            {/* 3. TEAM SCOREBOARD (Upper Center Directly Below Nav Bar with Golden Laurels) */}
            <div className="shrink-0 w-full max-w-6xl mx-auto px-3 sm:px-6 pt-2.5 pb-1 z-20 relative">
              <MainScoreboard
                teams={teams}
                currentTeamIdx={currentTeamIdx}
                scoreDeltas={scoreDeltas}
                highestScore={highestScore}
                isCompact={true}
                onSelectTeam={(idx) => {
                  playSound('select');
                  setCurrentTeamIdx(idx);
                }}
              />
            </div>

            {/* 4 & 5. GAME INSTRUCTION BAR + MAIN WOODEN TREASURE CHEST BOARD */}
            <main className="flex-1 min-h-0 w-full flex flex-col items-center justify-between px-3 sm:px-6 pb-3 sm:pb-5 pt-1 z-20 relative">
              {/* 4. Game Instruction Bar Capsule */}
              <div className="shrink-0 w-[90%] sm:w-[80%] lg:w-[73%] max-w-[1060px] mx-auto mb-1.5 sm:mb-2 rounded-full bg-gradient-to-r from-[#2c1d52]/90 via-[#382666]/90 to-[#2c1d52]/90 backdrop-blur-xl border-[2px] border-[#a78bfa]/60 shadow-[0_0_22px_rgba(139,92,246,0.4),inset_0_1px_8px_rgba(255,255,255,0.2)] px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2">
                {/* LEFT: Blue Team Pill Indicator */}
                <div className="flex items-center gap-2.5 sm:gap-3.5">
                  <span className="pl-1.5 pr-4 py-1 rounded-full bg-gradient-to-b from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] border border-[#93c5fd] text-white font-black text-xs sm:text-sm md:text-base shadow-[0_2px_8px_rgba(37,99,235,0.6)] flex items-center gap-2">
                    <CuteHamsterAvatar
                      avatarId={teams[currentTeamIdx]?.avatarId || ((currentTeamIdx % 20) + 1)}
                      className="w-8 h-8 sm:w-9 sm:h-9 !border-2"
                    />
                    <span>{teams[currentTeamIdx]?.name || `Team ${currentTeamIdx + 1}`}</span>
                  </span>

                  {/* CENTER: Main Instruction Text */}
                  <span className="text-white font-black text-sm sm:text-base md:text-lg tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                    Choose a Mystery Box to Unlock!
                  </span>
                </div>

                {/* RIGHT: Golden Lightning Icon & Helper Text */}
                <div className="hidden md:flex items-center gap-1.5 text-xs sm:text-[13px] font-extrabold text-[#fde68a] drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]">
                  <Zap size={15} className="text-[#fbbf24] fill-[#fbbf24]" />
                  <span>Click any answer to auto-reveal &amp; trigger live points!</span>
                </div>
              </div>

              {/* 5. MAIN MYSTERY BOX WOODEN TREASURE BOARD (Balanced, Larger Chests & Tighter Inner Frame) */}
              <div
                className="flex-1 min-h-0 w-[92%] sm:w-[82%] lg:w-[75%] max-w-[1180px] mx-auto rounded-[28px] sm:rounded-[34px] p-2 sm:p-2.5 md:p-3 relative flex flex-col justify-center"
                style={{
                  background:
                    'linear-gradient(180deg, #d99b4e 0%, #a86825 18%, #7c4714 52%, #a66724 85%, #e2a556 100%)',
                  boxShadow:
                    '0 18px 45px rgba(8,4,18,0.85), inset 0 3px 6px rgba(255,235,180,0.65), inset 0 -4px 8px rgba(48,24,5,0.85)',
                  border: '3px solid #f3c26f',
                }}
              >
                {/* Decorative Carved Inner Wooden Bevel & Dark Purple Treasure Cavern Recess */}
                <div
                  className="w-full h-full min-h-0 rounded-[20px] sm:rounded-[26px] px-2 py-1.5 sm:px-3.5 sm:py-2 relative flex flex-col justify-center overflow-hidden"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 45%, rgba(84,56,128,0.92) 0%, rgba(49,33,82,0.96) 58%, rgba(32,20,58,0.98) 100%)',
                    boxShadow:
                      'inset 0 8px 24px rgba(10,5,24,0.85), inset 0 0 28px rgba(245,158,11,0.18)',
                    border: '2.5px solid #593210',
                  }}
                >
                  {/* Dynamic Grid of 3D Treasure Chests on Stone Pedestals */}
                  <div
                    className="w-full h-full min-h-0 grid gap-1 sm:gap-1.5 md:gap-2 mx-auto my-auto place-items-center"
                    style={{
                      gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))`,
                    }}
                  >
                    {activeQuestions.map((q, idx) => {
                      const boxNum = idx + 1;
                      const isOpened = openedBoxes.includes(boxNum);
                      const record = boxRecords[boxNum];
                      const isAnimating = selectedBoxAnimation === boxNum;
                      const otherAnimating = selectedBoxAnimation !== null && selectedBoxAnimation !== boxNum;

                      return (
                        <button
                          key={q.id}
                          onClick={() => handleBoxClick(boxNum)}
                          onMouseEnter={() => {
                            if (!isOpened && selectedBoxAnimation === null) {
                              playSound('hover');
                            }
                          }}
                          disabled={isOpened || selectedBoxAnimation !== null}
                          className={`group relative w-full h-full min-h-0 flex items-center justify-center p-0.5 transition-all duration-300 select-none ${
                            isOpened
                              ? 'cursor-not-allowed opacity-85 scale-[0.96]'
                              : isAnimating
                              ? 'scale-110 z-50 drop-shadow-[0_0_35px_rgba(251,191,36,0.95)] rotate-2 cursor-pointer'
                              : otherAnimating
                              ? 'opacity-30 blur-[1px] scale-95'
                              : 'cursor-pointer hover:-translate-y-1.5 hover:scale-[1.06] active:scale-95'
                          }`}
                        >
                          {/* Subtle Golden Pedestal Glow Underneath Unopened Chests */}
                          {!isOpened && (
                            <div
                              className="pointer-events-none absolute bottom-[4%] left-1/2 -translate-x-1/2 w-[82%] h-[28%] rounded-full opacity-80 group-hover:opacity-100 transition-opacity blur-md"
                              style={{
                                background:
                                  'radial-gradient(ellipse at center, rgba(251,191,36,0.7) 0%, rgba(245,158,11,0.22) 60%, transparent 100%)',
                              }}
                            />
                          )}

                          {/* 3D Treasure Chest on Stone Pedestal (Cropped tightly & scaled prominently) */}
                          <div className="relative h-full w-full max-h-full max-w-full flex items-center justify-center">
                            <img
                              src={transparentChestSrc}
                              alt={`Treasure Chest ${boxNum}`}
                              className={`w-full h-full max-h-full object-contain pointer-events-none select-none transition-all duration-300 scale-[1.06] sm:scale-[1.1] ${
                                isOpened
                                  ? 'brightness-50 saturate-50 contrast-110'
                                  : 'drop-shadow-[0_10px_16px_rgba(0,0,0,0.68)] group-hover:drop-shadow-[0_14px_24px_rgba(251,191,36,0.6)]'
                              }`}
                            />

                            {/* Centered Number inside the Golden Shield Plate */}
                            {!isOpened && (
                              <div
                                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                                style={{
                                  paddingBottom: '13%',
                                }}
                              >
                                <span
                                  className={`font-black tabular-nums leading-none tracking-tight text-[#1e1638] group-hover:scale-105 transition-transform ${shieldNumSizeClass}`}
                                  style={{
                                    textShadow:
                                      '0 1px 0 rgba(255,250,210,0.95), 0 2px 4px rgba(0,0,0,0.25)',
                                  }}
                                >
                                  {boxNum}
                                </span>
                              </div>
                            )}

                            {/* Opened Chest Outcome Badge Overlay */}
                            {isOpened && (
                              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-1.5 text-center">
                                <div
                                  className={`px-2.5 py-1 rounded-2xl border-2 backdrop-blur-md shadow-lg flex flex-col items-center justify-center ${
                                    record?.isPositive
                                      ? 'bg-emerald-950/85 border-emerald-400/80 text-emerald-200'
                                      : 'bg-rose-950/85 border-rose-400/80 text-rose-200'
                                  }`}
                                >
                                  <span className="text-[10px] sm:text-xs font-black text-white/70 leading-none">
                                    #{boxNum}
                                  </span>
                                  {record && (
                                    <>
                                      <span className="text-sm sm:text-base leading-tight my-0.5">
                                        {record.icon}
                                      </span>
                                      <span
                                        className={`text-[8px] sm:text-[10px] font-black uppercase tracking-tight leading-none ${
                                          record.isPositive ? 'text-emerald-300' : 'text-rose-300'
                                        }`}
                                      >
                                        {record.label}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </main>

            {/* IN-GAME SETTINGS MODAL (BOX MODE & BONUS RULES ONLY — ARENA THEME REMOVED) */}
            {showInGameSettings && (
              <div
                className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
                onClick={() => setShowInGameSettings(false)}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-[650px] rounded-[34px] sm:rounded-[42px] p-4 sm:p-6 border-[5px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.6),0_8px_0_#4ca6ee,inset_0_4px_14px_rgba(255,255,255,0.98)] flex flex-col gap-4 animate-pop-in my-auto"
                  style={{
                    background:
                      'linear-gradient(180deg, #abdBFF 0%, #d8f0ff 22%, #eef9ff 54%, #a8d8ff 100%)',
                  }}
                >
                  {/* Top Modal Header */}
                  <div className="flex items-center justify-between gap-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-orange-500 border-2 border-white shadow-[0_4px_0_#b45309] flex items-center justify-center text-slate-950">
                        <Settings className="w-6 h-6 stroke-[2.6]" />
                      </div>
                      <div>
                        <h2
                          className="text-xl sm:text-2xl font-black text-[#092247] uppercase tracking-wide leading-none"
                          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.9)' }}
                        >
                          In-Game Settings
                        </h2>
                        <p className="text-xs sm:text-sm font-bold text-[#092247]/75 mt-0.5">
                          Customize Box Mode, Bonus/Penalty Rules &amp; Sound Live
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setShowInGameSettings(false);
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-b from-white to-slate-100 hover:from-rose-50 hover:to-rose-100 text-[#092247] hover:text-rose-600 border-[2.5px] border-[#60a5fa] shadow-[0_3px_0_#1d4ed8] flex items-center justify-center transition-all cursor-pointer active:translate-y-0.5"
                      title="Close Settings"
                    >
                      <X className="w-5 h-5 stroke-[3]" />
                    </button>
                  </div>

                  {/* Single-Column Box Mode Selector (Arena Theme removed) */}
                  <div className="w-full">
                    <BoxModeSelector
                      difficulty={difficulty}
                      onSelectDifficulty={(mode) => {
                        playSound('click');
                        setDifficulty(mode);
                      }}
                      answerBonusPoints={answerBonusPoints}
                      onToggleBonus={() => {
                        playSound('click');
                        setAnswerBonusPoints((prev) => !prev);
                      }}
                      wrongAnswerPenalty={wrongAnswerPenalty}
                      onTogglePenalty={() => {
                        playSound('click');
                        setWrongAnswerPenalty((prev) => !prev);
                      }}
                      isMuted={isMuted}
                      onToggleMute={() => setIsMuted((prev) => !prev)}
                      headerTitle="BOX MODE"
                    />
                  </div>

                  {/* Apply & Resume Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        playSound('click');
                        setShowInGameSettings(false);
                      }}
                      className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-b from-[#6ee7b7] via-[#16a34a] to-[#0d6e27] border-[3.5px] border-[#d1fae5] ring-3 ring-[#15803d]/80 shadow-[0_6px_0_#064e1c,0_12px_20px_rgba(6,78,28,0.35)] hover:brightness-105 active:translate-y-0.5 text-white font-black text-base sm:text-lg uppercase tracking-wide flex items-center justify-center gap-2 cursor-pointer transition-all"
                      style={{ textShadow: '0 2px 0 #064e1c' }}
                    >
                      <Check className="w-5 h-5 stroke-[3.5]" />
                      <span>Done &amp; Resume Game</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* ACTIVE BOX FULL-SCREEN QUESTION & MYSTERY UNBOXING / LIVE SCORE UPDATE STAGE */}
          {activeBoxNum !== null && (
            <div
              className={`fixed inset-0 z-[100] overflow-y-auto bg-slate-950/95 backdrop-blur-xl flex flex-col ${
                modalStep === 'question' ? 'p-0' : 'items-center justify-center p-3 sm:p-6'
              }`}
            >
              {/* 1. FULL-SCREEN QUESTION STAGE WITH AUTO-REVEAL & LIVE TEAM SCORES */}
              {modalStep === 'question' && (() => {
                const currentQ = activeQuiz.questions[activeBoxNum - 1];
                const activeTeam = teams[currentTeamIdx];
                return (
                  <div className="w-full min-h-screen flex flex-col justify-between bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white animate-pop-in">
                    
                    {/* FULL-SCREEN TOP HEADER BAR WITH REDESIGNED LIVE TEAM SCOREBOARD */}
                    <div className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 px-4 sm:px-8 py-3 sm:py-4 shadow-xl border-b-4 border-amber-300 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white text-orange-600 font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg tabular-nums shrink-0">
                          #{activeBoxNum}
                        </div>
                        <div className="text-left">
                          <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-amber-100 block">
                            Full-Screen Mystery Box Question
                          </span>
                          <div className="text-lg sm:text-2xl font-black text-white flex items-center gap-2 flex-wrap">
                            <span>{activeTeam?.name || `Team ${currentTeamIdx + 1}`}&apos;s Turn</span>
                            <span className="text-xs sm:text-sm bg-black/25 px-3 py-1 rounded-xl font-black tabular-nums border border-white/20">
                              <AnimatedScore value={activeTeam?.score ?? 0} /> PTS
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Live Big Team Scoreboard in Full-Screen Question Header (NO +/- SIGNS) */}
                      <div className="hidden lg:flex items-center gap-2.5 flex-wrap">
                        {teams.map((t, idx) => {
                          const isTurn = idx === currentTeamIdx;
                          const teamPopups = scoreDeltas.filter(d => d.teamId === t.id);
                          return (
                            <div
                              key={t.id}
                              className={`relative px-4 py-2 rounded-2xl flex items-center gap-2.5 transition-all duration-300 ${
                                isTurn
                                  ? 'bg-white text-slate-900 font-black shadow-lg scale-105 ring-4 ring-amber-200'
                                  : 'bg-black/30 text-white/90 font-bold border border-white/20'
                              }`}
                            >
                              <span className="px-2 py-0.5 rounded-lg bg-black/20 text-xs font-black">#{idx + 1}</span>
                              <div className="text-left">
                                <span className="text-xs uppercase tracking-wider max-w-[100px] truncate block leading-none">{t.name}</span>
                              </div>
                              <span className={`px-2.5 py-1 rounded-xl text-sm sm:text-base font-black tabular-nums ${
                                isTurn ? 'bg-amber-500 text-white' : 'bg-white/20 text-amber-300'
                              }`}>
                                <AnimatedScore value={t.score} /> PTS
                              </span>
                              {teamPopups.length > 0 && (
                                <span
                                  key={teamPopups[0].id}
                                  className={`absolute -bottom-6 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-md animate-bounce whitespace-nowrap z-30 ${
                                    teamPopups[0].isPositive ? 'bg-emerald-500 text-white' : 'bg-rose-600 text-white'
                                  }`}
                                >
                                  {teamPopups[0].text.replace('+', '')}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2">
                        <FullscreenButton targetId="game-container" className="!w-10 !h-10 sm:!w-11 sm:!h-11 !rounded-xl !bg-black/20 hover:!bg-black/35 !text-white !border-white/20 shadow-none" />
                        <button
                          onClick={() => {
                            if (autoAdvanceTimerRef.current) clearTimeout(autoAdvanceTimerRef.current);
                            setActiveBoxNum(null);
                          }}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-black/20 hover:bg-black/35 text-white flex items-center justify-center transition-colors cursor-pointer"
                          title="Close Question"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    {/* FULL-SCREEN CENTER QUESTION & GIANT OPTIONS STAGE */}
                    <div className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-10 py-6 sm:py-10 flex flex-col justify-center gap-6 sm:gap-8">
                      {/* Giant Question Card */}
                      {(() => {
                        const qParsed = parseOptionContent(currentQ?.text || '');
                        const qImg = currentQ?.image || qParsed.imageUrl;
                        const qDisplayText = qParsed.text || currentQ?.text;
                        return (
                          <div className="w-full bg-white text-slate-900 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 lg:p-12 border-4 border-amber-400 shadow-[0_20px_60px_rgba(0,0,0,0.5)] text-center flex flex-col items-center justify-center min-h-[160px] sm:min-h-[220px]">
                            <span className="px-4 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-xs sm:text-sm uppercase tracking-widest mb-3">
                              Question #{activeBoxNum} • 50 PTS Question
                            </span>
                            {qImg && (
                              <div className="mb-4 max-h-56 sm:max-h-72 w-full flex items-center justify-center">
                                <img
                                  src={qImg}
                                  alt={qDisplayText || `Question ${activeBoxNum}`}
                                  className="max-h-52 sm:max-h-64 max-w-full rounded-2xl object-contain shadow-md bg-slate-50 p-2 border-2 border-amber-300"
                                />
                              </div>
                            )}
                            {qDisplayText && (
                              <h3 className="text-2xl sm:text-4xl lg:text-5xl xl:text-6xl font-black text-slate-900 leading-tight break-words max-w-6xl">
                                {qDisplayText}
                              </h3>
                            )}
                          </div>
                        );
                      })()}

                      {/* Giant Full-Screen Options Grid: Clicking ANY Option Immediately Auto-Reveals! */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full">
                        {currentQ?.options.map((opt, i) => {
                          if (!opt || opt.trim() === '') return null;
                          const letter = ['A', 'B', 'C', 'D', 'E', 'F'][i] || (i + 1);
                          const isSelected = selectedOptionIndex === i;
                          const isCorrectOption = currentQ.answerIndex === i;
                          const isImageOpt = opt.startsWith('data:image') || opt.startsWith('http');

                          let optStyle =
                            "bg-white border-slate-200 text-slate-900 hover:border-amber-400 hover:bg-amber-50 hover:scale-[1.01] shadow-xl cursor-pointer";
                          let badgeColor =
                            "bg-slate-900 text-amber-400 group-hover:bg-amber-500 group-hover:text-white";

                          if (isAnswerRevealed) {
                            if (isCorrectOption) {
                              optStyle =
                                "bg-emerald-500 border-emerald-300 text-white scale-[1.02] shadow-[0_15px_45px_rgba(16,185,129,0.55)] z-10 font-black ring-4 ring-emerald-300/60";
                              badgeColor = "bg-white text-emerald-600";
                            } else if (isSelected && !isCorrectOption) {
                              optStyle =
                                "bg-rose-600 border-rose-300 text-white animate-shake shadow-[0_15px_40px_rgba(244,63,94,0.5)] font-black ring-4 ring-rose-300/60";
                              badgeColor = "bg-white text-rose-600";
                            } else {
                              optStyle =
                                "bg-slate-800/60 border-slate-700 text-slate-400 opacity-45 cursor-not-allowed";
                              badgeColor = "bg-slate-700 text-slate-400";
                            }
                          }

                          return (
                            <button
                              key={i}
                              onClick={() => handleOptionSelect(i)}
                              disabled={isAnswerRevealed}
                              className={`group p-5 sm:p-7 lg:p-8 rounded-3xl text-xl sm:text-3xl lg:text-4xl font-black border-4 transition-all duration-200 flex items-center justify-between text-left w-full gap-4 min-h-[96px] sm:min-h-[130px] ${optStyle}`}
                            >
                              <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
                                <span
                                  className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-xl sm:text-3xl shrink-0 transition-colors shadow-md ${badgeColor}`}
                                >
                                  {letter}
                                </span>
                                {(() => {
                                  const parsedOpt = parseOptionContent(opt);
                                  return (
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                      {parsedOpt.imageUrl && (
                                        <img
                                          src={parsedOpt.imageUrl}
                                          alt={parsedOpt.text || `Option ${letter}`}
                                          className="h-20 sm:h-24 w-auto rounded-2xl object-contain bg-white p-1.5 shrink-0"
                                        />
                                      )}
                                      {parsedOpt.text && (
                                        <span className="flex-1 break-words leading-snug">{parsedOpt.text}</span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>

                              {/* Auto-Revealed Status Indicator on Option */}
                              {isAnswerRevealed && isCorrectOption && (
                                <span className="flex items-center gap-1.5 bg-white text-emerald-600 px-4 py-2 rounded-2xl font-black text-sm sm:text-lg shrink-0 shadow-lg">
                                  <Check className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                                  {isSelected ? 'CORRECT!' : 'ANSWER'}
                                </span>
                              )}
                              {isAnswerRevealed && isSelected && !isCorrectOption && (
                                <span className="flex items-center gap-1.5 bg-white text-rose-600 px-4 py-2 rounded-2xl font-black text-sm sm:text-lg shrink-0 shadow-lg">
                                  <X className="w-5 h-5 sm:w-6 sm:h-6 stroke-[3]" />
                                  WRONG
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* FULL-SCREEN BOTTOM ACTION & LIVE SCORE FEEDBACK BAR */}
                    <div className="w-full bg-slate-950/90 border-t border-white/10 px-4 sm:px-10 py-4 sm:py-5 shrink-0">
                      <div className="max-w-[1600px] mx-auto">
                        {!isAnswerRevealed ? (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <p className="text-sm sm:text-base font-bold text-slate-300 flex items-center gap-2">
                              <Sparkles className="w-5 h-5 text-amber-400" />
                              Click any answer choice above to <span className="text-amber-400 font-black">auto-reveal</span> and update live team points!
                            </p>
                            <button
                              onClick={handleTeacherRevealOnly}
                              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" /> Teacher Reveal Only
                            </button>
                          </div>
                        ) : answerResult === 'correct' ? (
                          <div className="bg-emerald-500/20 border-2 border-emerald-400 rounded-2xl p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pop-in">
                            <div className="flex items-center gap-4 text-left">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                                <Check className="w-8 h-8 stroke-[3]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="text-xl sm:text-2xl font-black text-white">
                                    CORRECT ANSWER! 🎉
                                  </h4>
                                  {lastAnswerPointChange > 0 && (
                                    <span className="px-3 py-1 rounded-xl bg-emerald-500 text-white font-black text-xs sm:text-sm animate-bounce shadow">
                                      {lastAnswerPointChange} PTS ADDED LIVE!
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-emerald-200">
                                  Unlocking Mystery Box #{activeBoxNum} Decision...
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={proceedAfterCorrect}
                              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-xl font-black text-base sm:text-lg shadow-lg transition-all cursor-pointer shrink-0 hover:scale-105"
                            >
                              Open Mystery Box 🎁 →
                            </button>
                          </div>
                        ) : answerResult === 'incorrect' ? (
                          <div className="bg-rose-500/20 border-2 border-rose-400 rounded-2xl p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pop-in">
                            <div className="flex items-center gap-4 text-left">
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/30">
                                <X className="w-8 h-8 stroke-[3]" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="text-xl sm:text-2xl font-black text-white">
                                    INCORRECT!
                                  </h4>
                                  {lastAnswerPointChange < 0 && (
                                    <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-xs sm:text-sm animate-bounce shadow">
                                      {Math.abs(lastAnswerPointChange)} PTS DEDUCTED LIVE!
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-rose-200">
                                  Correct Answer: <span className="underline font-black text-emerald-300">{currentQ?.options[currentQ.answerIndex]}</span>
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={proceedAfterIncorrect}
                              className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-black text-base sm:text-lg shadow-lg transition-all cursor-pointer shrink-0"
                            >
                              Next Team&apos;s Turn →
                            </button>
                          </div>
                        ) : (
                          /* Teacher Manual Judgement Fallback */
                          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 animate-pop-in">
                            <button
                              onClick={proceedAfterIncorrect}
                              className="flex-1 max-w-[260px] mx-auto sm:mx-0 flex items-center justify-center gap-2 px-6 py-3.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-2 border-rose-400 rounded-2xl font-black text-lg transition-all cursor-pointer"
                            >
                              <X className="w-6 h-6" /> Mark Incorrect
                            </button>
                            <button
                              onClick={proceedAfterCorrect}
                              className="flex-1 max-w-[260px] mx-auto sm:mx-0 flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-lg shadow-lg transition-all cursor-pointer"
                            >
                              <Check className="w-6 h-6" /> Mark Correct
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. DECISION POPUP (KEEP IT OR GIVE IT AWAY BLUFFING STAGE) */}
              {modalStep === 'decision' && (
                <div className="w-full max-w-3xl my-auto animate-pop-in">
                  <div className="bg-white border-4 border-amber-400 rounded-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden text-center">
                    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 px-6 py-4 text-white flex items-center justify-between">
                      <span className="font-black text-sm sm:text-base uppercase tracking-wider flex items-center gap-2">
                        🎁 Mystery Box #{activeBoxNum} Unlocked!
                      </span>
                      <span className="text-xs font-bold bg-black/25 px-3 py-1 rounded-lg">
                        {teams[currentTeamIdx]?.name}: {teams[currentTeamIdx]?.score} PTS
                      </span>
                    </div>

                    <div className="p-6 sm:p-10">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-5xl shadow-lg shadow-amber-500/30 animate-bounce">
                        📦
                      </div>

                      <h3 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2">
                        Keep the Box or Give It Away?
                      </h3>

                      {/* Mystery Box Vibe / Hint */}
                      <p className="text-sm sm:text-base font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl py-2 px-4 inline-block mb-6">
                        ✨ &ldquo;{mysteryHint}&rdquo;
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <button 
                          onClick={() => handleExecuteDecision(currentTeamIdx)} 
                          className="group flex flex-col items-center justify-center gap-2 p-6 sm:p-8 bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-orange-700 border-3 border-orange-400 rounded-3xl transition-all cursor-pointer shadow-lg hover:scale-[1.03] active:scale-95"
                        >
                          <span className="text-5xl sm:text-6xl group-hover:scale-110 transition-transform">📦</span>
                          <span className="font-black text-2xl sm:text-3xl text-slate-900">KEEP IT!</span>
                          <span className="text-xs sm:text-sm font-bold bg-orange-500 text-white px-4 py-1 rounded-xl">
                            Open for {teams[currentTeamIdx]?.name}
                          </span>
                        </button>

                        <button 
                          onClick={() => {
                            playSound('click');
                            if (teams.length === 2) {
                              handleExecuteDecision((currentTeamIdx + 1) % teams.length);
                            } else {
                              setModalStep('give_away_selection');
                            }
                          }} 
                          className="group flex flex-col items-center justify-center gap-2 p-6 sm:p-8 bg-gradient-to-br from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border-3 border-purple-400 rounded-3xl transition-all cursor-pointer shadow-lg hover:scale-[1.03] active:scale-95"
                        >
                          <span className="text-5xl sm:text-6xl group-hover:rotate-12 transition-transform">🔄</span>
                          <span className="font-black text-2xl sm:text-3xl text-slate-900">GIVE IT AWAY!</span>
                          <span className="text-xs sm:text-sm font-bold bg-purple-600 text-white px-4 py-1 rounded-xl">
                            {teams.length === 2 ? `Force ${teams[(currentTeamIdx + 1) % teams.length]?.name} to Open` : "Pass Box to Another Team"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. PASS THE BOX POPUP (WHEN 3+ TEAMS AND GIVE IT AWAY SELECTED) */}
              {modalStep === 'give_away_selection' && (
                <div className="w-full max-w-3xl my-auto animate-pop-in">
                  <div className="bg-white border-4 border-purple-400 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl text-center">
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setModalStep('decision')}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 font-bold text-sm cursor-pointer"
                      >
                        <ArrowLeft size={16} /> Back
                      </button>
                      <span className="text-xs font-black uppercase tracking-widest text-purple-600">
                        Pass The Mystery Box
                      </span>
                      <div className="w-16" />
                    </div>

                    <h3 className="text-2xl sm:text-4xl font-black text-slate-900 mb-2">
                      Who Must Open Box #{activeBoxNum}?
                    </h3>
                    <p className="text-sm sm:text-base font-bold text-slate-500 mb-6">
                      {teams[currentTeamIdx]?.name} is giving the box away! Pick the team that receives its fate:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {teams.map((t, idx) => {
                        if (idx === currentTeamIdx) return null;
                        const cfg = DEFAULT_TEAM_CONFIGS[idx % DEFAULT_TEAM_CONFIGS.length];
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleExecuteDecision(idx)}
                            className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 hover:border-purple-500 bg-slate-50 hover:bg-purple-50 flex flex-col items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                          >
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.gradient} text-white font-black text-xl flex items-center justify-center shadow-md ring-2 ring-white/20`}>
                              #{idx + 1}
                            </div>
                            <span className="font-black text-lg text-slate-900">{t.name}</span>
                            <span className="text-xs font-bold text-slate-500 tabular-nums">
                              Current: {t.score > 0 ? `+${t.score}` : t.score} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. UNBOXING REEL SPIN ANIMATION */}
              {modalStep === 'unboxing' && (
                <div className="w-full max-w-xl my-auto animate-pop-in">
                  <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl sm:rounded-[2.5rem] p-8 sm:p-12 shadow-[0_0_80px_rgba(251,191,36,0.4)] text-center text-white">
                    <p className="text-sm font-black uppercase tracking-widest text-amber-400 mb-4 animate-pulse">
                      UNBOXING MYSTERY CRATE #{activeBoxNum}...
                    </p>
                    <div className={`my-4 mx-auto w-full rounded-3xl p-8 bg-gradient-to-br ${unboxPreviewItem.color} shadow-2xl flex flex-col items-center gap-3 border-4 border-white/80 transform scale-105 transition-all duration-75`}>
                      <span className="text-6xl sm:text-7xl animate-bounce">{unboxPreviewItem.icon}</span>
                      <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                        {unboxPreviewItem.text}
                      </h3>
                    </div>
                    <p className="text-sm font-bold text-white/70 mt-4">
                      Fate locked for <span className="text-amber-300 font-black">{teams[targetTeamIdx ?? currentTeamIdx]?.name}</span>!
                    </p>
                  </div>
                </div>
              )}

              {/* 5. TARGET SELECTION POPUP (FOR STEAL / SWAP WHEN 3+ TEAMS) */}
              {modalStep === 'target_selection' && currentOutcome && (
                <div className="w-full max-w-3xl my-auto animate-pop-in">
                  <div className="bg-white border-4 border-indigo-400 rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 shadow-2xl text-center">
                    <span className="text-xs font-black uppercase tracking-widest text-indigo-600 block mb-2">
                      🎯 Choose Target Team
                    </span>
                    <div className={`mb-6 mx-auto w-full max-w-md bg-gradient-to-r ${currentOutcome.color} rounded-2xl p-5 shadow-xl flex flex-col items-center gap-1 border-2 border-white text-white`}>
                      <span className="text-4xl">{currentOutcome.icon}</span>
                      <h3 className="text-2xl sm:text-3xl font-black">{currentOutcome.text}</h3>
                      <p className="text-xs text-white/90 font-semibold">{currentOutcome.subtitle}</p>
                    </div>
                    <p className="text-base sm:text-lg font-black text-slate-800 mb-5">
                      Which team will <span className="text-indigo-600">{teams[targetTeamIdx ?? 0]?.name}</span> target?
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                      {teams.map((t, idx) => {
                        if (idx === targetTeamIdx) return null;
                        const cfg = DEFAULT_TEAM_CONFIGS[idx % DEFAULT_TEAM_CONFIGS.length];
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleTargetSelection(idx)}
                            className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 bg-slate-50 hover:bg-indigo-50 flex flex-col items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                          >
                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${cfg.gradient} text-white font-black text-xl flex items-center justify-center shadow-md ring-2 ring-white/20`}>
                              #{idx + 1}
                            </div>
                            <span className="font-black text-lg text-slate-900">{t.name}</span>
                            <span className="text-xs font-bold text-slate-600 tabular-nums">
                              Score: {t.score > 0 ? `+${t.score}` : t.score} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. REVEAL STAGE WITH LIVE SCOREBOARD AT TOP & MYSTERY BOX OUTCOME */}
              {modalStep === 'reveal' && currentOutcome && (
                <div
                  onClick={handleCloseReveal}
                  className="w-full max-w-5xl my-auto flex flex-col items-center gap-6 animate-pop-in cursor-pointer select-none px-2 sm:px-4"
                  title="Click anywhere to skip to next turn immediately"
                >
                  {/* MAIN SCOREBOARD AT TOP SHOWING LIVE SCORE UPDATING */}
                  <div className="w-full">
                    <div className="flex items-center justify-center gap-2 mb-2 text-center">
                      <Trophy className="w-5 h-5 text-amber-400" />
                      <h4 className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300">
                        Live Scoreboard
                      </h4>
                    </div>
                    <MainScoreboard
                      teams={teams}
                      currentTeamIdx={targetTeamIdx !== null ? targetTeamIdx : currentTeamIdx}
                      scoreDeltas={scoreDeltas}
                      highestScore={highestScore}
                      activeRevealTeamId={targetTeamIdx !== null ? teams[targetTeamIdx]?.id : teams[currentTeamIdx]?.id}
                      activeRevealDelta={outcomeBeforeAfter?.delta}
                    />
                  </div>

                  {/* REVEALED MYSTERY BOX OUTCOME CARD (WITHOUT DUPLICATE SCORE IN BOX) */}
                  <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 lg:p-10 shadow-[0_25px_90px_rgba(0,0,0,0.85)] text-center text-white relative overflow-hidden w-full">
                    
                    {/* Top Outcome Header Banner */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <span className="px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest">
                        ✨ MYSTERY BOX #{activeBoxNum} REVEALED
                      </span>
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                        Live Scoreboard Updating...
                      </span>
                    </div>

                    {/* Revealed Outcome Card */}
                    <div className={`mx-auto w-full bg-gradient-to-r ${currentOutcome.color} rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col sm:flex-row items-center justify-center gap-5 border-4 border-white/90 text-white mb-6`}>
                      <span className="text-6xl sm:text-8xl drop-shadow-md animate-bounce shrink-0">{currentOutcome.icon}</span>
                      <div className="text-center sm:text-left">
                        <h3 className="text-3xl sm:text-5xl font-black tracking-tight leading-none mb-2">{currentOutcome.text}</h3>
                        <p className="text-base sm:text-xl font-bold text-white/95">{outcomeSummary || currentOutcome.subtitle}</p>
                      </div>
                    </div>

                    {/* Live Auto-Advancing Status Bar */}
                    <div className="max-w-md mx-auto flex flex-col items-center gap-2">
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all ease-linear ${
                            revealScoreApplied ? 'w-full duration-[2900ms]' : 'w-1/12 duration-300'
                          }`}
                        />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        Scores updated live on main board! Auto-switching to <span className="text-amber-300 font-black">{teams[(currentTeamIdx + 1) % teams.length]?.name}&apos;s Turn</span>...
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GAME OVER / WINNER ANNOUNCEMENT MODAL (PODIUM LEADERBOARD, BIG HAMSTER AVATAR & MEDALS) */}
          {isGameOver && (() => {
            const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
            const topScore = sortedTeams[0]?.score ?? 0;
            const tiedWinners = sortedTeams.filter((t) => t.score === topScore);
            const isTie = teams.length > 1 && tiedWinners.length > 1;
            const winnerTeam = sortedTeams[0];

            return (
              <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
                <div
                  className="border-[4px] border-[#fbbf24] rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-9 max-w-2xl w-full shadow-[0_25px_80px_rgba(0,0,0,0.85),0_0_40px_rgba(251,191,36,0.4)] my-auto animate-pop-in text-center text-white relative overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(180deg, #2b1d52 0%, #1d1238 55%, #140c29 100%)',
                  }}
                >
                  {/* Winning Hamster Character & Golden Trophy Header */}
                  <div className="relative mx-auto mb-4 flex flex-col items-center justify-center">
                    <div className="text-4xl sm:text-5xl mb-1 animate-bounce drop-shadow-[0_4px_12px_rgba(251,191,36,0.8)]">
                      👑
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      {(isTie ? tiedWinners : [winnerTeam]).filter(Boolean).map((wTeam) => (
                        <CuteHamsterAvatar
                          key={wTeam.id}
                          avatarId={wTeam.avatarId || ((wTeam.id % 20) + 1)}
                          className="w-24 h-24 sm:w-28 sm:h-28 !border-4 shadow-[0_0_30px_rgba(251,191,36,0.65)]"
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-black text-[#fde047] uppercase tracking-widest mb-1">
                    🏆 OFFICIAL WINNER ANNOUNCEMENT 🏆
                  </p>
                  <h2 className="text-3xl sm:text-5xl font-black text-white uppercase mb-2 drop-shadow-[0_3px_8px_rgba(0,0,0,0.6)]">
                    {teams.length === 1
                      ? `${winnerTeam?.name}: ${winnerTeam?.score} PTS!`
                      : isTie
                      ? `🤝 IT'S A TIE! (${topScore} PTS)`
                      : `👑 ${winnerTeam?.name} WINS!`}
                  </h2>
                  {teams.length > 1 && (
                    <p className="text-sm sm:text-base font-bold text-amber-200/90 mb-5">
                      {isTie
                        ? `${tiedWinners.map((w) => w.name).join(' & ')} tied for 1st Place with ${topScore} PTS!`
                        : `Congratulations to ${winnerTeam?.name} for claiming victory with ${topScore} PTS!`}
                    </p>
                  )}

                  {/* Leaderboard Rankings */}
                  <div className="w-full flex flex-col gap-2.5 mb-7 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
                    {sortedTeams.map((t, rank) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const medal = medals[rank] || `#${rank + 1}`;
                      const isWinner = t.score === topScore;
                      return (
                        <div
                          key={t.id}
                          className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all ${
                            isWinner
                              ? 'bg-gradient-to-r from-[#fbbf24]/25 via-[#f59e0b]/20 to-[#fbbf24]/25 border-[#fbbf24] text-white shadow-[0_0_20px_rgba(251,191,36,0.3)] font-black'
                              : 'bg-white/10 border-white/15 text-white/90'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-2xl sm:text-3xl shrink-0">{medal}</span>
                            <CuteHamsterAvatar
                              avatarId={t.avatarId || ((t.id % 20) + 1)}
                              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 !border-2"
                            />
                            <span className="text-lg sm:text-2xl font-black truncate">{t.name}</span>
                          </div>
                          <div className="text-2xl sm:text-3xl font-black text-[#fde047] tabular-nums shrink-0 ml-3">
                            {t.score} <span className="text-xs sm:text-sm uppercase">PTS</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <button
                      onClick={() => {
                        playSound('click');
                        setTeams(teams.map((t) => ({ ...t, score: 0, streak: 0 })));
                        setOpenedBoxes([]);
                        setBoxRecords({});
                        setManualGameEnded(false);
                        setRemainingSeconds(gameTimeMinutes > 0 ? gameTimeMinutes * 60 : null);
                      }}
                      className="flex-1 py-4 bg-gradient-to-b from-[#fde047] via-[#fbbf24] to-[#f59e0b] hover:brightness-105 text-[#1e1303] border-2 border-[#fef08a] font-black text-xl rounded-2xl shadow-lg transition-all cursor-pointer"
                    >
                      Play Again 🔄
                    </button>
                    <button
                      onClick={() => {
                        setManualGameEnded(false);
                        setScreen('setup');
                      }}
                      className="flex-1 py-4 bg-[#43306b] hover:bg-[#563e88] border-2 border-[#a78bfa]/60 text-white font-black text-xl rounded-2xl shadow-lg transition-all cursor-pointer"
                    >
                      Game Setup ⚙️
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        );
      })()}

      {/* Switch Game Mode Modal */}
      <GameModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        gameData={{
          ...activeQuiz,
          customQuestions: activeQuiz.questions,
          questions: activeQuiz.questions,
        }}
        onSelectMode={(mode, data) => {
          setShowModeModal(false);
          onViewChange(mode as ViewState, data);
        }}
      />
    </div>
  );
}

// ==========================================
// QUIZ EDITOR COMPONENT (EXACT COPY FROM BUBBLE POP, CAPPED AT 30 QUESTIONS)
// ==========================================

function QuizEditor({
  quiz,
  onSave,
  onCancel,
  folders
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onCancel: () => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [localFolders, setLocalFolders] = useState<{ id: string; name: string }[]>(folders || []);
  const [contentMode, setContentMode] = useState<OptionContentMode>("words");
  const [autoRecommendPhoto, setAutoRecommendPhoto] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>(() => (quiz.questions && quiz.questions.length > 0 ? quiz.questions : [{ id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0, optionImages: [null, null, null, null] }]));
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number | 'question', initialQuery?: string } | null>(null);

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);

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

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg("Please enter or paste at least one item.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    const newItems: Question[] = parsed.map((item, i) => ({
      id: Date.now() + i + Math.random(),
      text: item.text || "",
      options: item.options || ["", "", "", ""],
      answerIndex: item.answerIndex || 0,
      optionImages: [null, null, null, null],
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions(prev => {
        const isOnlyInitialBlank = prev.length === 1 && !prev[0].text.trim() && prev[0].options.every(o => !o.trim());
        const base = isOnlyInitialBlank ? [] : prev;
        const combined = [...base, ...newItems];
        return combined;
      });
    }

    setToastMsg(`✨ Added ${parsed.length} questions!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
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
        optionImages: [null, null, null, null],
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

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now() + Math.random(), text: '', options: ['', '', '', ''], answerIndex: 0, optionImages: [null, null, null, null] }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length < 6) {
        return { ...q, options: [...q.options, ''] };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const newOptions = [...q.options];
        newOptions.pop();
        const newAnswerIndex = q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
        return { ...q, options: newOptions, answerIndex: newAnswerIndex };
      }
      return q;
    }));
  };

  const removeQuestion = (id: number | string) => {
    setQuestions(prev => {
      if (prev.length > 1) {
        return prev.filter(q => q.id !== id);
      }
      return prev;
    });
  };

  const duplicateQuestion = (index: number) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      const qToCopy = prev[index];
      const duplicatedQ = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options]
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions;
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
      title: topic || "Mystery Box",
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        {/* CARD CONTAINER EXACTLY MATCHING USER SCREENSHOT */}
        <div className="w-full max-w-4xl bg-white dark:bg-slate-800/80 rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8 border border-slate-100 dark:border-slate-700">
          <div className="p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex flex-wrap justify-between items-center gap-3">
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
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
              </div>
              <div className="flex gap-3 items-center">
                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
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
            <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
              {errorMsg}
            </div>
          )}

          {toastMsg && (
            <div className="bg-cyan-500/20 text-cyan-500 dark:text-cyan-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-cyan-500/30 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-sm">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
            {/* Action Bar */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                QUESTIONS ({questions.length})
              </span>
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2.5 cursor-pointer"
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
              <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
                <button 
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button 
                  onClick={() => removeQuestion(q.id)}
                  title="Delete Question"
                  className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Trash2 size={14} />
                </button>
                
                <div className="flex gap-4 mb-4 items-start">
                  <div className="w-8 h-8 mt-2 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
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
                  <button onClick={() => addOption(q.id)} disabled={q.options.length >= 6} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">+ Option</button>
                  <button onClick={() => removeOption(q.id)} disabled={q.options.length <= 2} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer">- Option</button>
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
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this game to the Community so other teachers can use it?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
              >
                Yes, Publish (Public)
              </button>
              <button 
                onClick={() => confirmSave(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
              >
                No, Keep Private
              </button>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="w-full py-2 mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showBulkPasteModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste & Auto-Divide
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Paste multiple questions, numbered lists with options & answer (e.g. Answer: B), or tabular TSV data.
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
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
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
                    <span>{copiedPromptInModal ? "Copied Prompt!" : "Copy AI Prompt"}</span>
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
                Paste Text Below (Supports multi-line Q&A format or Excel copy)
              </label>
              <textarea 
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
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
                onClick={() => handleApplyBulkPaste('replace')}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Replace All
              </button>
              <button 
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

// --- PARSER HELPER ---
function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  // 1. TSV / Excel paste check
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length >= 2) {
        // Skip header row if present
        const p0Lower = parts[0].toLowerCase();
        if (p0Lower.includes('question') && (parts[1].toLowerCase().includes('option') || parts[1].toLowerCase().includes('answer'))) {
          return;
        }

        let qText = parts[0];
        let opts = ["", "", "", ""];
        let ansRaw = "";

        if (/^\d+$/.test(parts[0]) && parts.length >= 6) {
          // Format: ID \t Question \t Opt1 \t Opt2 \t Opt3 \t Opt4 \t Answer
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

  // 2. Multi-line / Standard Text Parsing
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;

  const isQuestionStart = (line: string) => {
    return /^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i.test(line);
  };

  const getQuestionText = (line: string) => {
    const m = line.match(/^(?:question\s*\d+|q\s*\d+|\d+)[\.\)\:\-]\s+(.+)/i);
    return m ? m[1].trim() : line;
  };

  const isAnswerLine = (line: string) => {
    return /^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i.test(line);
  };

  const extractAnswerIndex = (line: string, opts: string[] = ["", "", "", ""]) => {
    const m = line.match(/^(?:correct\s*)?(?:ans(?:wer)?|key)\s*(?:is)?\s*[:=\-]?\s*(.+)/i);
    if (!m) return -1;
    const raw = m[1].trim();

    const letter = raw.match(/[\(\[]?([A-Da-d])[\)\]\.\:]?/);
    if (letter) {
      return letter[1].toUpperCase().charCodeAt(0) - 65;
    }
    const num = raw.match(/^[1-4]$/);
    if (num) {
      return parseInt(num[0]) - 1;
    }
    const found = opts.findIndex(o => o && (o.toLowerCase() === raw.toLowerCase() || raw.toLowerCase().includes(o.toLowerCase())));
    if (found >= 0) return found;

    return 0;
  };

  const isOptionLine = (line: string) => {
    // Explicit letter options: A., A), A:, A -, (A), [A], a., a), (a), [a]
    if (/^(?:[\(\[]?[A-Da-d][\)\]\.\:\-]|[\(\[][A-Da-d][\)\]])\s*(.*)/.test(line)) {
      return true;
    }
    // Numbered option: (1), [1], 1) - but NEVER 1. (which is a numbered question)
    if (/^(?:[\(\[][1-4][\)\]]|[1-4]\))\s*(.*)/.test(line)) {
      return true;
    }
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

    // 1. Check if the line is an Answer line (e.g. "Answer: B", "Ans: Paris", "Correct: A")
    if (isAnswerLine(line)) {
      if (currentQ) {
        const ansIdx = extractAnswerIndex(line, currentQ.options || []);
        if (ansIdx >= 0) currentQ.answerIndex = ansIdx;
      }
      continue;
    }

    // 2. Check for inline answer at the end of the line (e.g. "... (Answer: B)")
    const inlineAnsMatch = line.match(/(?:\[|\(|\b)(?:ans(?:wer)?|correct)\s*[:=\-]?\s*([A-Da-d1-4])(?:\b|\)|\b)/i);
    let inlineAnswerIndex = -1;
    if (inlineAnsMatch) {
      const val = inlineAnsMatch[1].toUpperCase();
      if (/[A-D]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
      else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
      line = line.replace(inlineAnsMatch[0], "").trim();
    }
    if (!line) continue;

    // 3. Check if line is an option (e.g. "A) London", "(B) Paris", "C. Berlin", "D - Madrid")
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

        // Support multiple inline options on the same line if present (e.g. "A) London  B) Paris")
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

    // 4. Check if line is a numbered question start (e.g. "1. Question text", "2) Question text")
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

    // 5. Line does not match option, answer, or question start
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
