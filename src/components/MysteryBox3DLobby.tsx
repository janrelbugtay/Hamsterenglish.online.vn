import React, { useRef } from 'react';
import {
  ArrowLeft,
  Edit3,
  Gamepad2,
  Volume2,
  VolumeX,
  Check,
  BookOpen,
  Flame,
  Zap,
} from 'lucide-react';

export type BoxDifficultyMode = 'normal' | 'medium' | 'difficult';
export type ArenaThemeId =
  | 'theme-sky'
  | 'theme-ocean'
  | 'theme-space'
  | 'theme-jungle'
  | 'theme-sunset'
  | 'theme-royal';

export interface MysteryBox3DLobbyProps {
  questionCount: number;
  numPlayers: number;
  onSelectNumPlayers: (count: number) => void;
  playerNames: string[];
  onChangePlayerName: (index: number, value: string) => void;
  difficulty: BoxDifficultyMode;
  onSelectDifficulty: (mode: BoxDifficultyMode) => void;
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  selectedTheme: string;
  onSelectTheme: (themeId: ArenaThemeId) => void;
  onStartGame: () => void;
  onOpenStudy: () => void;
  onBack: () => void;
  onOpenGameSwitcher: () => void;
  onOpenQuizEditor: () => void;
}

const TEAM_PANEL_STYLES = [
  {
    badge: 'T1',
    panelBg: 'bg-gradient-to-b from-[#f0f9ff] via-[#d8efff] to-[#b8dfff]',
    panelBorder: 'border-[#3b82f6]',
    panelShadow: 'shadow-[0_5px_0_#1d4ed8,0_8px_14px_rgba(29,78,216,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#38bdf8] via-[#2563eb] to-[#1d4ed8]',
    badgeBorder: 'border-[#bae6fd]',
    badgeShadow: 'shadow-[0_3px_0_#1e3a8a,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#1d4ed8] bg-white/70 hover:bg-white border border-[#93c5fd]',
  },
  {
    badge: 'T2',
    panelBg: 'bg-gradient-to-b from-[#fff5f9] via-[#ffe0ee] to-[#ffc2dd]',
    panelBorder: 'border-[#ec4899]',
    panelShadow: 'shadow-[0_5px_0_#be185d,0_8px_14px_rgba(190,24,93,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#fb7185] via-[#e11d48] to-[#9f1239]',
    badgeBorder: 'border-[#fecdd3]',
    badgeShadow: 'shadow-[0_3px_0_#881337,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#be185d] bg-white/70 hover:bg-white border border-[#f9a8d4]',
  },
  {
    badge: 'T3',
    panelBg: 'bg-gradient-to-b from-[#ecfdf5] via-[#d1fae5] to-[#a7f3d0]',
    panelBorder: 'border-[#10b981]',
    panelShadow: 'shadow-[0_5px_0_#047857,0_8px_14px_rgba(4,120,87,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#34d399] via-[#059669] to-[#065f46]',
    badgeBorder: 'border-[#6ee7b7]',
    badgeShadow: 'shadow-[0_3px_0_#064e3b,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#047857] bg-white/70 hover:bg-white border border-[#6ee7b7]',
  },
  {
    badge: 'T4',
    panelBg: 'bg-gradient-to-b from-[#fffbeb] via-[#fef3c7] to-[#fde68a]',
    panelBorder: 'border-[#f59e0b]',
    panelShadow: 'shadow-[0_5px_0_#b45309,0_8px_14px_rgba(180,83,9,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#fbbf24] via-[#d97706] to-[#92400e]',
    badgeBorder: 'border-[#fde68a]',
    badgeShadow: 'shadow-[0_3px_0_#78350f,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#b45309] bg-white/70 hover:bg-white border border-[#fcd34d]',
  },
  {
    badge: 'T5',
    panelBg: 'bg-gradient-to-b from-[#faf5ff] via-[#f3e8ff] to-[#e9d5ff]',
    panelBorder: 'border-[#a855f7]',
    panelShadow: 'shadow-[0_5px_0_#6b21a8,0_8px_14px_rgba(107,33,168,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#c084fc] via-[#9333ea] to-[#581c87]',
    badgeBorder: 'border-[#d8b4fe]',
    badgeShadow: 'shadow-[0_3px_0_#3b0764,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#6b21a8] bg-white/70 hover:bg-white border border-[#d8b4fe]',
  },
  {
    badge: 'T6',
    panelBg: 'bg-gradient-to-b from-[#ecfeff] via-[#cffafe] to-[#a5f3fc]',
    panelBorder: 'border-[#06b6d4]',
    panelShadow: 'shadow-[0_5px_0_#0e7490,0_8px_14px_rgba(14,116,144,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#22d3ee] via-[#0891b2] to-[#155e75]',
    badgeBorder: 'border-[#67e8f9]',
    badgeShadow: 'shadow-[0_3px_0_#164e63,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#0e7490] bg-white/70 hover:bg-white border border-[#67e8f9]',
  },
  {
    badge: 'T7',
    panelBg: 'bg-gradient-to-b from-[#fff7ed] via-[#ffedd5] to-[#fed7aa]',
    panelBorder: 'border-[#f97316]',
    panelShadow: 'shadow-[0_5px_0_#c2410c,0_8px_14px_rgba(194,65,12,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#fb923c] via-[#ea580c] to-[#9a3412]',
    badgeBorder: 'border-[#fdba74]',
    badgeShadow: 'shadow-[0_3px_0_#7c2d12,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#c2410c] bg-white/70 hover:bg-white border border-[#fdba74]',
  },
  {
    badge: 'T8',
    panelBg: 'bg-gradient-to-b from-[#fdf2f8] via-[#fce7f3] to-[#fbcfe8]',
    panelBorder: 'border-[#db2777]',
    panelShadow: 'shadow-[0_5px_0_#9d174d,0_8px_14px_rgba(157,23,77,0.22),inset_0_2px_4px_rgba(255,255,255,0.98)]',
    badgeBg: 'bg-gradient-to-b from-[#f472b6] via-[#db2777] to-[#831843]',
    badgeBorder: 'border-[#f9a8d4]',
    badgeShadow: 'shadow-[0_3px_0_#500724,inset_0_2px_3px_rgba(255,255,255,0.6)]',
    iconColor: 'text-[#9d174d] bg-white/70 hover:bg-white border border-[#f9a8d4]',
  },
];

/* ============================================================================
 * 1. GameBackground — Harmonized Tropical Sky, Clouds, Sunbeams & Island Beach
 * ============================================================================ */
export function GameBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="mystery-box-container"
      className="relative w-full min-h-screen overflow-x-hidden overflow-y-auto flex flex-col items-center justify-between select-none"
      style={{
        fontFamily: 'var(--font-cartoon, "Fredoka", "Baloo 2", "Nunito", sans-serif)',
        background:
          'linear-gradient(180deg, #1b9af7 0%, #44beff 26%, #7fdfff 58%, #9be8ff 76%, #61cdef 87%, #e8bc6e 95%, #cf9443 100%)',
      }}
    >
      {/* Tropical Sky Atmosphere, Soft Clouds & Sandy Beach Floor */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Warm Tropical Sunburst Behind the Mascot & Wooden Sign */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[1150px] h-[520px] opacity-70"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,254,230,0.92) 0%, rgba(190,242,255,0.45) 45%, rgba(255,255,255,0) 75%)',
          }}
        />

        {/* Soft Fluffy Sky Clouds (Left & Right Horizon) */}
        <div
          className="absolute top-[14%] left-[6%] w-72 h-24 rounded-full opacity-35 blur-xl"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 72%)' }}
        />
        <div
          className="absolute top-[18%] right-[7%] w-80 h-28 rounded-full opacity-35 blur-xl"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 72%)' }}
        />
        <div
          className="absolute top-[46%] left-[3%] w-64 h-20 rounded-full opacity-30 blur-xl"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 72%)' }}
        />
        <div
          className="absolute top-[48%] right-[4%] w-64 h-20 rounded-full opacity-30 blur-xl"
          style={{ background: 'radial-gradient(circle, #ffffff 0%, transparent 72%)' }}
        />

        {/* Sandy Treasure Island Beach Floor at Very Bottom */}
        <div
          className="absolute inset-x-0 bottom-0 h-16"
          style={{
            background:
              'linear-gradient(180deg, rgba(232,188,110,0) 0%, rgba(227,178,96,0.92) 48%, #c58a38 100%)',
          }}
        />
      </div>

      {children}
    </div>
  );
}

/* ============================================================================
 * 2 & 3. HamsterMascot + GameLogo — Seamless Alpha-Cutout 3D Explorer Hamster,
 *        Wooden Sign "MYSTERY BOX 3D", Floating Gems & Golden '?' Chest
 * ============================================================================ */
export function HamsterMascot() {
  return null;
}

export function GameLogo() {
  return (
    <div className="relative z-30 w-[94%] sm:w-[90%] max-w-[1000px] mx-auto -mb-3 sm:-mb-4 select-none pointer-events-none flex items-end justify-center">
      <img
        src="/images/mb3d/header-banner-cutout.png"
        alt="Mystery Box 3D - Explorer Hamster and Golden Question Chest"
        className="w-full h-auto object-contain block drop-shadow-[0_10px_18px_rgba(9,54,107,0.32)]"
      />
    </div>
  );
}

/* ============================================================================
 * 4. TreasureDecoration — Kept empty so no background side pictures appear
 * ============================================================================ */
export function TreasureDecoration() {
  return null;
}

/* ============================================================================
 * 5. MainGamePanel — Balanced 1040px Glossy Ice-Blue 3D Arcade Cabinet
 * ============================================================================ */
export function MainGamePanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative z-20 w-[95%] sm:w-[92%] max-w-[1040px] mx-auto rounded-[38px] sm:rounded-[48px] p-4 sm:p-6 md:p-7 border-[6px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.46),0_10px_0_#4ca6ee,inset_0_4px_14px_rgba(255,255,255,0.98)] flex flex-col gap-3.5 sm:gap-4"
      style={{
        background:
          'linear-gradient(180deg, #abdBFF 0%, #d8f0ff 22%, #eef9ff 54%, #a8d8ff 100%)',
      }}
    >
      {/* Top Inner Gloss Highlight */}
      <div className="pointer-events-none absolute inset-x-10 top-1.5 h-4 rounded-full bg-gradient-to-b from-white/95 to-transparent" />
      {children}
    </div>
  );
}

/* ============================================================================
 * 6. PlayerModeSelector — Chunky 1 PLAYER vs. TEAMS (N) 3D Arcade Capsules
 * ============================================================================ */
export function PlayerModeSelector({
  numPlayers,
  onSelectSolo,
  onSelectTeams,
}: {
  numPlayers: number;
  onSelectSolo: () => void;
  onSelectTeams: () => void;
}) {
  const isSolo = numPlayers === 1;
  const teamCount = Math.max(2, numPlayers);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-5">
      {/* LEFT BUTTON: 1 PLAYER */}
      <button
        type="button"
        onClick={onSelectSolo}
        className={`group relative h-15 sm:h-[68px] rounded-full px-6 flex items-center justify-center gap-3.5 transition-all duration-150 cursor-pointer active:translate-y-1 ${
          isSolo
            ? 'bg-gradient-to-b from-[#ffffff] via-[#dff2ff] to-[#9ed4ff] border-[4px] border-[#0284c7] ring-4 ring-[#38bdf8]/80 shadow-[0_7px_0_#0369a1,0_14px_24px_rgba(2,132,199,0.4),inset_0_3px_6px_rgba(255,255,255,1)] -translate-y-0.5'
            : 'bg-gradient-to-b from-[#ffffff] via-[#ecf7ff] to-[#c4e4ff] border-[4px] border-[#2563eb] shadow-[0_6px_0_#1d4ed8,0_10px_18px_rgba(29,78,216,0.24),inset_0_3px_6px_rgba(255,255,255,1)] hover:-translate-y-0.5'
        }`}
      >
        {/* Top Specular Gloss Strip */}
        <div className="pointer-events-none absolute inset-x-7 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white to-transparent" />

        {/* 3D Blue Single-Person Avatar Icon */}
        <svg className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-[0_3px_4px_rgba(15,23,42,0.28)]" viewBox="0 0 40 40">
          <defs>
            <linearGradient id="bluePersonGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="55%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
          <circle cx="20" cy="13" r="7.5" fill="url(#bluePersonGrad)" stroke="#172554" strokeWidth="2.2" />
          <circle cx="18" cy="11" r="2.2" fill="#bfdbfe" />
          <path
            d="M7 33 C7 24, 33 24, 33 33 Z"
            fill="url(#bluePersonGrad)"
            stroke="#172554"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>

        <span
          className="text-xl sm:text-2xl md:text-[26px] font-black tracking-wide text-[#092247] uppercase whitespace-nowrap"
          style={{ textShadow: '0 1px 0 rgba(255,255,255,0.9)' }}
        >
          1 PLAYER
        </span>
      </button>

      {/* RIGHT BUTTON: TEAMS (N) */}
      <button
        type="button"
        onClick={onSelectTeams}
        className={`group relative h-15 sm:h-[68px] rounded-full px-6 flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer active:translate-y-1 ${
          !isSolo
            ? 'bg-gradient-to-b from-[#ff8ec7] via-[#ff218c] to-[#c40062] border-[4px] border-[#ffe0f0] ring-4 ring-[#fbbf24]/85 shadow-[0_7px_0_#8a0045,0_14px_26px_rgba(216,0,108,0.48),0_0_18px_rgba(251,191,36,0.55),inset_0_3px_6px_rgba(255,255,255,0.65)] -translate-y-0.5'
            : 'bg-gradient-to-b from-[#ff9ece] via-[#f43f8e] to-[#be185d] border-[4px] border-[#fbcfe8] shadow-[0_6px_0_#831843,0_10px_18px_rgba(190,24,93,0.28)] opacity-85 hover:opacity-100 hover:-translate-y-0.5'
        }`}
      >
        {/* Top Specular Gloss Strip */}
        <div className="pointer-events-none absolute inset-x-7 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white/75 to-transparent" />

        {/* White Two-Person Icon */}
        <svg className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 drop-shadow-[0_3px_4px_rgba(131,24,67,0.6)]" viewBox="0 0 48 40">
          <defs>
            <linearGradient id="whitePeopleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fbcfe8" />
            </linearGradient>
          </defs>
          {/* Back Person */}
          <circle cx="31" cy="13" r="6" fill="url(#whitePeopleGrad)" stroke="#831843" strokeWidth="2" />
          <path d="M21 31 C21 23, 42 23, 42 31 Z" fill="url(#whitePeopleGrad)" stroke="#831843" strokeWidth="2" />
          {/* Front Person */}
          <circle cx="18" cy="14" r="6.8" fill="#ffffff" stroke="#831843" strokeWidth="2.2" />
          <path d="M6 33 C6 24, 30 24, 30 33 Z" fill="#ffffff" stroke="#831843" strokeWidth="2.2" />
        </svg>

        {/* Golden Lightning Symbol */}
        <Zap
          className="w-6 h-6 sm:w-7 sm:h-7 text-[#fde047] fill-[#facc15] drop-shadow-[0_2px_4px_rgba(131,24,67,0.75)] shrink-0"
          strokeWidth={2.5}
        />

        <span
          className="text-xl sm:text-2xl md:text-[26px] font-black tracking-wide text-white uppercase whitespace-nowrap"
          style={{ textShadow: '0 2px 0 #831843, 0 4px 8px rgba(131,24,67,0.75)' }}
        >
          TEAMS ({teamCount})
        </span>
      </button>
    </div>
  );
}

/* ============================================================================
 * 7. TeamNameEditor — Glossy 3D Team Name Pills (Team 1 Blue, Team 2 Pink...)
 * ============================================================================ */
export function TeamNameEditor({
  numPlayers,
  playerNames,
  onChangePlayerName,
}: {
  numPlayers: number;
  playerNames: string[];
  onChangePlayerName: (index: number, value: string) => void;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div
      className={`grid gap-3 sm:gap-4 ${
        numPlayers === 1 ? 'grid-cols-1 max-w-md mx-auto w-full' : 'grid-cols-1 sm:grid-cols-2'
      }`}
    >
      {Array.from({ length: numPlayers }).map((_, idx) => {
        const style = TEAM_PANEL_STYLES[idx % TEAM_PANEL_STYLES.length];
        const badgeLabel = numPlayers === 1 ? 'P1' : `T${idx + 1}`;
        const defaultName = numPlayers === 1 ? 'Player 1' : `Team ${idx + 1}`;
        const currentVal = playerNames[idx] ?? defaultName;

        return (
          <div
            key={idx}
            className={`relative h-13 sm:h-[58px] rounded-full px-2.5 sm:px-3.5 border-[3.5px] ${style.panelBg} ${style.panelBorder} ${style.panelShadow} flex items-center justify-between gap-3 transition-all`}
          >
            {/* Top Specular Gloss */}
            <div className="pointer-events-none absolute inset-x-6 top-1 h-2.5 rounded-full bg-gradient-to-b from-white/90 to-transparent" />

            {/* Left Rounded Team Badge (T1 / T2) */}
            <div
              className={`w-11 h-10 sm:w-12 sm:h-10 rounded-full border-2 ${style.badgeBg} ${style.badgeBorder} ${style.badgeShadow} flex items-center justify-center font-black text-white text-sm sm:text-base tracking-tight shrink-0`}
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
            >
              {badgeLabel}
            </div>

            {/* Editable Team Name Input */}
            <input
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              value={currentVal}
              onChange={(e) => onChangePlayerName(idx, e.target.value)}
              placeholder={defaultName}
              aria-label={`Edit ${defaultName} name`}
              className="flex-1 min-w-0 bg-transparent text-[#092247] font-black text-base sm:text-lg tracking-tight placeholder:text-[#092247]/45 focus:outline-none truncate"
            />

            {/* Right Pencil Edit Button */}
            <button
              type="button"
              onClick={() => {
                const input = inputRefs.current[idx];
                if (input) {
                  input.focus();
                  input.select();
                }
              }}
              title={`Edit ${defaultName} name`}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs ${style.iconColor}`}
            >
              <Edit3 className="w-4 h-4 sm:w-4.5 sm:h-4.5" strokeWidth={2.6} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 8. TeamCountSelector — Deep Royal-Blue "NUMBER OF TEAMS" 3D Bar (2 to 8)
 * ============================================================================ */
export function TeamCountSelector({
  numPlayers,
  onSelectCount,
}: {
  numPlayers: number;
  onSelectCount: (count: number) => void;
}) {
  if (numPlayers <= 1) return null;

  return (
    <div
      className="relative rounded-3xl sm:rounded-full p-1.5 sm:p-2 border-[3.5px] border-[#8cd0ff] shadow-[0_6px_0_#0a2e6e,0_10px_18px_rgba(10,46,110,0.32),inset_0_2px_5px_rgba(255,255,255,0.55)] flex flex-col md:flex-row items-center justify-between gap-2.5"
      style={{
        background: 'linear-gradient(90deg, #0b3786 0%, #1a5ed4 48%, #3183f0 100%)',
      }}
    >
      {/* Left Dark-Navy Chevron Badge */}
      <div
        className="w-full md:w-auto flex items-center justify-center md:justify-start gap-2.5 px-4 sm:px-5 py-2 rounded-full md:rounded-r-2xl border border-[#60a5fa]/50 shadow-[inset_0_2px_5px_rgba(0,0,0,0.38)] shrink-0"
        style={{
          background: 'linear-gradient(90deg, #061f52 0%, #0d388a 100%)',
        }}
      >
        {/* Two-Person White Icon */}
        <svg className="w-6 h-5 shrink-0 drop-shadow" viewBox="0 0 36 28">
          <circle cx="23" cy="9" r="4.5" fill="#bfdbfe" />
          <path d="M15 23 C15 17, 31 17, 31 23 Z" fill="#bfdbfe" />
          <circle cx="13" cy="10" r="5.2" fill="#ffffff" />
          <path d="M3 25 C3 18, 23 18, 23 25 Z" fill="#ffffff" />
        </svg>
        <span
          className="text-white font-black text-xs sm:text-sm md:text-[15px] tracking-wider uppercase whitespace-nowrap"
          style={{ textShadow: '0 2px 3px rgba(0,0,0,0.55)' }}
        >
          NUMBER OF TEAMS
        </span>
      </div>

      {/* Right 7 Individual Chunky 3D Selection Buttons: 2 | 3 | 4 | 5 | 6 | 7 | 8 */}
      <div className="w-full md:flex-1 grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {[2, 3, 4, 5, 6, 7, 8].map((count) => {
          const isSelected = numPlayers === count;
          return (
            <button
              key={count}
              type="button"
              onClick={() => onSelectCount(count)}
              className={`relative h-11 sm:h-[46px] rounded-2xl sm:rounded-full font-black text-base sm:text-xl tabular-nums transition-all duration-150 cursor-pointer flex items-center justify-center active:translate-y-0.5 ${
                isSelected
                  ? 'bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] text-white border-[3px] border-[#e0f2fe] ring-4 ring-[#00e5ff]/85 shadow-[0_0_16px_rgba(0,229,255,0.9),0_4px_0_#075985,inset_0_2px_4px_rgba(255,255,255,0.8)] scale-105 z-10'
                  : 'bg-gradient-to-b from-white via-[#eef8ff] to-[#cce7ff] text-[#092247] border-[2.5px] border-[#60a5fa] shadow-[0_4px_0_#1e40af,inset_0_2px_3px_rgba(255,255,255,0.95)] hover:from-white hover:to-[#e0f2fe] hover:-translate-y-0.5'
              }`}
            >
              <div className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-gradient-to-b from-white/85 to-transparent" />
              <span style={isSelected ? { textShadow: '0 2px 3px rgba(7,89,133,0.8)' } : undefined}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
 * 9 & 10. BoxModeSelector + GameModifierControls (Lower-Left Lavender 3D Card)
 * ============================================================================ */
export function GameModifierControls({
  answerBonusPoints,
  onToggleBonus,
  wrongAnswerPenalty,
  onTogglePenalty,
  isMuted,
  onToggleMute,
}: {
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-2.5 pt-1">
      {/* BONUS CONTROL */}
      <button
        type="button"
        onClick={onToggleBonus}
        className={`relative h-11 sm:h-[46px] rounded-full px-2.5 sm:px-3 border-[2.5px] flex items-center justify-between gap-1 font-black text-[11px] sm:text-xs tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
          answerBonusPoints
            ? 'bg-gradient-to-b from-[#4ade80] via-[#16a34a] to-[#15803d] border-[#bbf7d0] text-white shadow-[0_4px_0_#14532d,inset_0_2px_3px_rgba(255,255,255,0.65)]'
            : 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400 text-slate-600 shadow-[0_4px_0_#64748b]'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-gradient-to-b from-white/60 to-transparent" />
        <span className="whitespace-nowrap">+50 BONUS {answerBonusPoints ? 'ON' : 'OFF'}</span>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
            answerBonusPoints ? 'bg-white text-[#15803d]' : 'bg-slate-400 text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
        </span>
      </button>

      {/* PENALTY CONTROL */}
      <button
        type="button"
        onClick={onTogglePenalty}
        className={`relative h-11 sm:h-[46px] rounded-full px-2.5 sm:px-3 border-[2.5px] flex items-center justify-between gap-1 font-black text-[11px] sm:text-xs tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
          wrongAnswerPenalty
            ? 'bg-gradient-to-b from-[#fb7185] via-[#e11d48] to-[#be123c] border-[#fecdd3] text-white shadow-[0_4px_0_#881337,inset_0_2px_3px_rgba(255,255,255,0.65)]'
            : 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400 text-slate-600 shadow-[0_4px_0_#64748b]'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-gradient-to-b from-white/60 to-transparent" />
        <span className="whitespace-nowrap">-50 PENALTY {wrongAnswerPenalty ? 'ON' : 'OFF'}</span>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
            wrongAnswerPenalty ? 'bg-white text-[#be123c]' : 'bg-slate-400 text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
        </span>
      </button>

      {/* SOUND EFFECT CONTROL */}
      <button
        type="button"
        onClick={onToggleMute}
        className={`relative h-11 sm:h-[46px] rounded-full px-2.5 sm:px-3 border-[2.5px] flex items-center justify-between gap-1 font-black text-[11px] sm:text-xs tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
          !isMuted
            ? 'bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] border-[#bae6fd] text-white shadow-[0_4px_0_#0c4a6e,inset_0_2px_3px_rgba(255,255,255,0.65)]'
            : 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400 text-slate-600 shadow-[0_4px_0_#64748b]'
        }`}
      >
        <div className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-gradient-to-b from-white/60 to-transparent" />
        <span className="flex items-center gap-1 whitespace-nowrap">
          {!isMuted ? <Volume2 className="w-3.5 h-3.5 shrink-0" /> : <VolumeX className="w-3.5 h-3.5 shrink-0" />}
          <span>SFX {!isMuted ? 'ON' : 'OFF'}</span>
        </span>
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
            !isMuted ? 'bg-white text-[#0284c7]' : 'bg-slate-400 text-white'
          }`}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
        </span>
      </button>
    </div>
  );
}

export function BoxModeSelector({
  difficulty,
  onSelectDifficulty,
  answerBonusPoints,
  onToggleBonus,
  wrongAnswerPenalty,
  onTogglePenalty,
  isMuted,
  onToggleMute,
}: {
  difficulty: BoxDifficultyMode;
  onSelectDifficulty: (mode: BoxDifficultyMode) => void;
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}) {
  return (
    <div
      className="relative rounded-[28px] p-3.5 sm:p-4 border-[4px] border-white/90 ring-3 ring-[#c084fc] shadow-[0_8px_0_rgba(126,34,206,0.32),0_12px_22px_rgba(88,28,135,0.18),inset_0_2px_6px_rgba(255,255,255,0.95)] flex flex-col justify-between gap-3"
      style={{
        background: 'linear-gradient(180deg, #f5ebff 0%, #ead5ff 55%, #d8b4fe 100%)',
      }}
    >
      {/* Header Banner: Gift Icon + BOX MODE */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-[#e9d5ff] shadow-[0_3px_0_rgba(107,33,168,0.25),inset_0_2px_4px_rgba(255,255,255,0.4)]"
        style={{
          background: 'linear-gradient(90deg, #7e22ce 0%, #9333ea 52%, rgba(192,132,252,0.3) 100%)',
        }}
      >
        {/* 3D Red & Gold Gift Box Icon */}
        <svg className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 drop-shadow" viewBox="0 0 36 36">
          <rect x="5" y="15" width="26" height="17" rx="3" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
          <rect x="3" y="10" width="30" height="7" rx="2.5" fill="#f87171" stroke="#7f1d1d" strokeWidth="2" />
          <rect x="15" y="10" width="6" height="22" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
          <rect x="5" y="21" width="26" height="5" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
          <path d="M18 10 C11 2, 6 7, 13 10 Z" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
          <path d="M18 10 C25 2, 30 7, 23 10 Z" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
        </svg>
        <span
          className="text-white font-black text-sm sm:text-base tracking-wider uppercase"
          style={{ textShadow: '0 2px 3px rgba(59,7,100,0.65)' }}
        >
          BOX MODE
        </span>
      </div>

      {/* Three Chunky 3D Mode Cards: NORMAL | EXCITING | CHAOS */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-auto">
        {/* A. NORMAL */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('normal')}
          title="Standard gameplay with normal rewards and penalties"
          className={`group relative h-24 sm:h-[106px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'normal'
              ? 'bg-gradient-to-b from-[#e879f9] via-[#a855f7] to-[#6b21a8] text-white border-[3.5px] border-[#fde047] ring-4 ring-[#f59e0b]/75 shadow-[0_6px_0_#4c1d95,0_0_18px_rgba(250,204,21,0.75),inset_0_2px_4px_rgba(255,255,255,0.6)] -translate-y-0.5'
              : 'bg-gradient-to-b from-white via-[#faf5ff] to-[#e9d5ff] text-[#1e1b4b] border-[3px] border-[#c084fc] shadow-[0_5px_0_rgba(147,51,234,0.32),inset_0_2px_4px_rgba(255,255,255,1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
          {/* Purple Gift Box Icon */}
          <svg className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-xs" viewBox="0 0 36 36">
            <rect
              x="6"
              y="15"
              width="24"
              height="16"
              rx="3"
              fill={difficulty === 'normal' ? '#fde047' : '#a855f7'}
              stroke="#4c1d95"
              strokeWidth="2"
            />
            <rect
              x="4"
              y="10"
              width="28"
              height="6"
              rx="2"
              fill={difficulty === 'normal' ? '#fef08a' : '#c084fc'}
              stroke="#4c1d95"
              strokeWidth="2"
            />
            <rect x="15.5" y="10" width="5" height="21" fill="#f5d0fe" />
            <path d="M18 10 C12 3, 7 7, 14 10 Z" fill="#d946ef" stroke="#4c1d95" strokeWidth="1.5" />
            <path d="M18 10 C24 3, 29 7, 22 10 Z" fill="#d946ef" stroke="#4c1d95" strokeWidth="1.5" />
          </svg>
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase">NORMAL</span>
        </button>

        {/* B. EXCITING */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('medium')}
          title="More exciting rewards and unpredictable gameplay"
          className={`group relative h-24 sm:h-[106px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'medium'
              ? 'bg-gradient-to-b from-[#e879f9] via-[#a855f7] to-[#6b21a8] text-white border-[3.5px] border-[#fde047] ring-4 ring-[#f59e0b]/85 shadow-[0_6px_0_#4c1d95,0_0_22px_rgba(250,204,21,0.85),inset_0_2px_4px_rgba(255,255,255,0.6)] -translate-y-0.5'
              : 'bg-gradient-to-b from-white via-[#faf5ff] to-[#e9d5ff] text-[#1e1b4b] border-[3px] border-[#c084fc] shadow-[0_5px_0_rgba(147,51,234,0.32),inset_0_2px_4px_rgba(255,255,255,1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
          {/* Golden 3D Crown Icon */}
          <svg className="w-9 h-9 sm:w-10 sm:h-10 drop-shadow-[0_3px_4px_rgba(0,0,0,0.3)]" viewBox="0 0 40 36">
            <path
              d="M5 27 L8 11 L15 19 L20 7 L25 19 L32 11 L35 27 Z"
              fill="#facc15"
              stroke="#92400e"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <rect x="5" y="27" width="30" height="4.5" rx="2" fill="#f59e0b" stroke="#92400e" strokeWidth="2" />
            <circle cx="8" cy="9" r="2.2" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
            <circle cx="20" cy="5.5" r="2.6" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
            <circle cx="32" cy="9" r="2.2" fill="#fef08a" stroke="#92400e" strokeWidth="1.5" />
          </svg>
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase">EXCITING</span>
        </button>

        {/* C. CHAOS */}
        <button
          type="button"
          onClick={() => onSelectDifficulty('difficult')}
          title="Unexpected events and unpredictable challenges"
          className={`group relative h-24 sm:h-[106px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'difficult'
              ? 'bg-gradient-to-b from-[#e879f9] via-[#a855f7] to-[#6b21a8] text-white border-[3.5px] border-[#fde047] ring-4 ring-[#f59e0b]/75 shadow-[0_6px_0_#4c1d95,0_0_18px_rgba(250,204,21,0.75),inset_0_2px_4px_rgba(255,255,255,0.6)] -translate-y-0.5'
              : 'bg-gradient-to-b from-white via-[#faf5ff] to-[#e9d5ff] text-[#1e1b4b] border-[3px] border-[#c084fc] shadow-[0_5px_0_rgba(147,51,234,0.32),inset_0_2px_4px_rgba(255,255,255,1)] hover:-translate-y-0.5'
          }`}
        >
          <div className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
          {/* Purple Spiral Vortex Icon */}
          <svg className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-xs" viewBox="0 0 36 36" fill="none">
            <circle
              cx="18"
              cy="18"
              r="13"
              fill={difficulty === 'difficult' ? '#fde047' : '#9333ea'}
              opacity="0.22"
            />
            <path
              d="M18 18 C18 15, 22 15, 22 18 C22 22, 14 23, 13 18 C12 12, 24 10, 26 18 C28 26, 10 28, 8 18 C6 9, 25 5, 30 15"
              stroke={difficulty === 'difficult' ? '#fef08a' : '#7e22ce'}
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase flex items-center gap-1">
            <span>CHAOS</span>
            <Flame className="w-4 h-4 text-orange-500 fill-amber-400 shrink-0" />
          </span>
        </button>
      </div>

      {/* Modifier Toggles: +50 BONUS ON | -50 PENALTY ON | SFX ON */}
      <GameModifierControls
        answerBonusPoints={answerBonusPoints}
        onToggleBonus={onToggleBonus}
        wrongAnswerPenalty={wrongAnswerPenalty}
        onTogglePenalty={onTogglePenalty}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
      />
    </div>
  );
}

/* ============================================================================
 * 11. ThemeCard & ArenaThemeSelector (Lower-Right Golden 3D Panel)
 * ============================================================================ */
export function ThemeCard({
  id,
  name,
  icon,
  isSelected,
  onSelect,
}: {
  id: ArenaThemeId;
  name: string;
  icon: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative rounded-2xl overflow-hidden flex flex-col transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
        isSelected
          ? 'bg-gradient-to-b from-[#fef08a] to-[#facc15] border-[3.5px] border-[#d97706] ring-4 ring-[#fde047] shadow-[0_6px_0_#b45309,0_0_18px_rgba(250,204,21,0.9)] -translate-y-0.5 z-10'
          : 'bg-gradient-to-b from-white to-[#f1f5f9] border-[3px] border-white shadow-[0_5px_0_rgba(180,83,9,0.3)] hover:-translate-y-0.5'
      }`}
    >
      {/* Selected Checkmark Badge in Upper-Right Corner */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-[#fbbf24] to-[#d97706] border-2 border-white shadow-md flex items-center justify-center text-white">
          <Check className="w-3.5 h-3.5" strokeWidth={4} />
        </div>
      )}

      {/* Illustrated Landscape Thumbnail from Reference Art */}
      <div className="w-full h-14 sm:h-[62px] overflow-hidden rounded-t-xl relative bg-sky-200">
        <img
          src={`/images/mb3d/${id}.png`}
          alt={name}
          className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-200"
        />
      </div>

      {/* Bottom Theme Label Strip */}
      <div
        className={`w-full py-1.5 px-2 flex items-center justify-center gap-1.5 font-black text-xs sm:text-sm tracking-wide uppercase ${
          isSelected ? 'bg-[#facc15] text-[#2d1203]' : 'bg-white/95 text-[#0f172a]'
        }`}
      >
        <span className="text-sm leading-none">{icon}</span>
        <span>{name}</span>
      </div>
    </button>
  );
}

export function ArenaThemeSelector({
  selectedTheme,
  onSelectTheme,
}: {
  selectedTheme: string;
  onSelectTheme: (themeId: ArenaThemeId) => void;
}) {
  const themes: { id: ArenaThemeId; name: string; icon: string }[] = [
    { id: 'theme-sky', name: 'SKY', icon: '☁️' },
    { id: 'theme-ocean', name: 'OCEAN', icon: '🌊' },
    { id: 'theme-space', name: 'SPACE', icon: '🚀' },
    { id: 'theme-jungle', name: 'JUNGLE', icon: '🌴' },
    { id: 'theme-sunset', name: 'SUNSET', icon: '🌅' },
    { id: 'theme-royal', name: 'ROYAL', icon: '👑' },
  ];

  return (
    <div
      className="relative rounded-[28px] p-3.5 sm:p-4 border-[4px] border-white/90 ring-3 ring-[#fbbf24] shadow-[0_8px_0_rgba(217,119,6,0.32),0_12px_22px_rgba(180,83,9,0.18),inset_0_2px_6px_rgba(255,255,255,0.95)] flex flex-col justify-between gap-3"
      style={{
        background: 'linear-gradient(180deg, #fffbeb 0%, #fef3c7 52%, #fde68a 100%)',
      }}
    >
      {/* Header Banner: Purple Game Controller Icon + ARENA THEME */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border border-[#fde047] shadow-[0_3px_0_rgba(217,119,6,0.22),inset_0_2px_4px_rgba(255,255,255,0.7)]"
        style={{
          background: 'linear-gradient(90deg, #fcd34d 0%, #fbbf24 55%, rgba(254,240,138,0.4) 100%)',
        }}
      >
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-gradient-to-b from-[#a855f7] to-[#6b21a8] border border-[#e9d5ff] flex items-center justify-center text-white shadow-xs shrink-0">
          <Gamepad2 className="w-4 h-4" />
        </div>
        <span className="text-[#2d1203] font-black text-sm sm:text-base tracking-wider uppercase">
          ARENA THEME
        </span>
      </div>

      {/* 3-Column by 2-Row Grid of Illustrated Theme Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-auto">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            id={t.id}
            name={t.name}
            icon={t.icon}
            isSelected={selectedTheme === t.id}
            onSelect={() => onSelectTheme(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 12. StartGameButton & StudyButton — Extra-Tall Chunky 3D Arcade Action Buttons
 * ============================================================================ */
export function StartGameButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex-1 h-16 sm:h-[74px] rounded-full px-6 sm:px-8 bg-gradient-to-b from-[#6ee7b7] via-[#16a34a] to-[#0d6e27] border-[4.5px] border-[#d1fae5] ring-4 ring-[#15803d]/85 shadow-[0_8px_0_#064e1c,0_16px_28px_rgba(6,78,28,0.45),inset_0_3px_6px_rgba(255,255,255,0.65)] hover:brightness-105 hover:-translate-y-0.5 active:translate-y-1 transition-all duration-150 flex items-center justify-center gap-3.5 cursor-pointer"
    >
      {/* Top Specular Gloss Highlight */}
      <div className="pointer-events-none absolute inset-x-9 top-1.5 h-4 rounded-full bg-gradient-to-b from-white/80 to-transparent" />

      {/* 3D Golden-Cream Play Triangle Icon */}
      <svg className="w-8 h-8 sm:w-9 sm:h-9 shrink-0 drop-shadow-[0_3px_4px_rgba(6,78,28,0.7)]" viewBox="0 0 36 36">
        <path
          d="M8 5 L31 18 L8 31 Z"
          fill="#fef9c3"
          stroke="#14532d"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>

      <span
        className="text-xl sm:text-2xl md:text-[31px] font-black tracking-wide text-white uppercase whitespace-nowrap"
        style={{
          WebkitTextStroke: '1.5px #064e1c',
          textShadow: '0 3px 0 #064e1c, 0 6px 12px rgba(0,0,0,0.38)',
        }}
      >
        START MYSTERY BOX
      </span>
    </button>
  );
}

export function StudyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative sm:w-[33%] min-w-[200px] h-16 sm:h-[74px] rounded-full px-6 bg-gradient-to-b from-[#fef08a] via-[#facc15] to-[#d97706] border-[4.5px] border-[#fef9c3] ring-4 ring-[#b45309]/80 shadow-[0_8px_0_#92400e,0_16px_28px_rgba(146,64,14,0.42),inset_0_3px_6px_rgba(255,255,255,0.8)] hover:brightness-105 hover:-translate-y-0.5 active:translate-y-1 transition-all duration-150 flex items-center justify-center gap-3 cursor-pointer"
    >
      {/* Top Specular Gloss Highlight */}
      <div className="pointer-events-none absolute inset-x-7 top-1.5 h-4 rounded-full bg-gradient-to-b from-white/90 to-transparent" />

      {/* 3D Illustrated Open Book Icon */}
      <BookOpen
        className="w-7 h-7 sm:w-8 sm:h-8 text-[#451a03] fill-[#fef3c7] drop-shadow-[0_2px_2px_rgba(255,255,255,0.7)] shrink-0"
        strokeWidth={2.5}
      />

      <span
        className="text-xl sm:text-2xl md:text-[31px] font-black tracking-wide text-[#2d1203] uppercase whitespace-nowrap"
        style={{
          textShadow: '0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        STUDY
      </span>
    </button>
  );
}

/* ============================================================================
 * 13. MysteryBox3DLobby — Complete Assembled Tropical Treasure Adventure Lobby
 * ============================================================================ */
export function MysteryBox3DLobby({
  questionCount,
  numPlayers,
  onSelectNumPlayers,
  playerNames,
  onChangePlayerName,
  difficulty,
  onSelectDifficulty,
  answerBonusPoints,
  onToggleBonus,
  wrongAnswerPenalty,
  onTogglePenalty,
  isMuted,
  onToggleMute,
  selectedTheme,
  onSelectTheme,
  onStartGame,
  onOpenStudy,
  onBack,
  onOpenGameSwitcher,
  onOpenQuizEditor,
}: MysteryBox3DLobbyProps) {
  return (
    <GameBackground>
      {/* Top Teacher Utility Controls Aligned to the 1040px Arcade Cabinet */}
      <div className="relative z-30 w-[95%] sm:w-[92%] max-w-[1040px] mx-auto pt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="relative px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-white via-[#f0f9ff] to-[#d8efff] hover:from-white hover:to-[#e0f2fe] text-[#092247] font-black text-xs sm:text-sm border-[2.5px] border-white ring-2 ring-[#0284c7]/60 shadow-[0_4px_0_#0369a1,0_6px_12px_rgba(3,105,161,0.28)] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 stroke-[3]" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenGameSwitcher}
            className="relative px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] hover:brightness-105 text-white font-black text-xs sm:text-sm border-[2.5px] border-[#bae6fd] shadow-[0_4px_0_#075985,0_6px_12px_rgba(3,105,161,0.32)] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Games</span>
          </button>

          <button
            type="button"
            onClick={onOpenQuizEditor}
            className="relative px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-white via-[#f0f9ff] to-[#d8efff] hover:from-white hover:to-[#e0f2fe] text-[#092247] font-black text-xs sm:text-sm border-[2.5px] border-white ring-2 ring-[#0284c7]/60 shadow-[0_4px_0_#0369a1,0_6px_12px_rgba(3,105,161,0.28)] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>Edit Questions ({questionCount})</span>
          </button>
        </div>
      </div>

      {/* Main Centered Tropical Adventure Stage */}
      <div className="relative z-20 w-full flex-1 flex flex-col items-center justify-center pb-6 pt-1">
        {/* Top Branding Header: Seamless Cutout 3D Explorer Hamster + Wooden Sign Logo + Golden '?' Chest */}
        <GameLogo />

        {/* Central Ice-Blue 3D Arcade Cabinet Container */}
        <MainGamePanel>
          {/* 1. Player Mode Selection */}
          <PlayerModeSelector
            numPlayers={numPlayers}
            onSelectSolo={() => onSelectNumPlayers(1)}
            onSelectTeams={() => onSelectNumPlayers(numPlayers === 1 ? 2 : numPlayers)}
          />

          {/* 2. Team Name Panels */}
          <TeamNameEditor
            numPlayers={numPlayers}
            playerNames={playerNames}
            onChangePlayerName={onChangePlayerName}
          />

          {/* 3. Number of Teams Selector (2 to 8) */}
          <TeamCountSelector
            numPlayers={numPlayers}
            onSelectCount={(count) => onSelectNumPlayers(count)}
          />

          {/* 4. Two-Column Lower Split: Box Mode + Modifiers (Left) & Arena Theme (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
            <BoxModeSelector
              difficulty={difficulty}
              onSelectDifficulty={onSelectDifficulty}
              answerBonusPoints={answerBonusPoints}
              onToggleBonus={onToggleBonus}
              wrongAnswerPenalty={wrongAnswerPenalty}
              onTogglePenalty={onTogglePenalty}
              isMuted={isMuted}
              onToggleMute={onToggleMute}
            />

            <ArenaThemeSelector
              selectedTheme={selectedTheme}
              onSelectTheme={onSelectTheme}
            />
          </div>

          {/* 5. Main Action Buttons: START MYSTERY BOX & STUDY */}
          <div className="flex flex-col sm:flex-row items-stretch justify-between gap-3.5 sm:gap-4 pt-1">
            <StartGameButton onClick={onStartGame} />
            <StudyButton onClick={onOpenStudy} />
          </div>
        </MainGamePanel>
      </div>

      {/* Kept empty so no background side pictures appear */}
      <TreasureDecoration />
    </GameBackground>
  );
}
