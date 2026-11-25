import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Edit3,
  Gamepad2,
  Volume2,
  VolumeX,
  Check,
  BookOpen,
  Flame,
  RefreshCw,
  Settings,
  Play,
  Users,
  HelpCircle,
  Clock,
  X,
  Sparkles,
} from 'lucide-react';
import { CUTE_HAMSTER_BREEDS } from '../lib/studentCharacters';

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
  selectedQuestionLimit?: number;
  onSelectQuestionLimit?: (limit: number) => void;
  gameTimeMinutes?: number;
  onSelectGameTime?: (minutes: number) => void;
  numPlayers: number;
  onSelectNumPlayers: (count: number) => void;
  playerNames: string[];
  onChangePlayerName: (index: number, value: string) => void;
  teamAvatars?: number[];
  onChangeTeamAvatar?: (teamIndex: number, avatarId: number) => void;
  onRandomizeTeamAvatars?: () => void;
  difficulty: BoxDifficultyMode;
  onSelectDifficulty: (mode: BoxDifficultyMode) => void;
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  soundVolume?: number;
  onChangeSoundVolume?: (vol: number) => void;
  selectedTheme: string;
  onSelectTheme: (themeId: ArenaThemeId) => void;
  onStartGame: () => void;
  onOpenStudy: () => void;
  onBack: () => void;
  onOpenGameSwitcher: () => void;
  onOpenQuizEditor: () => void;
  headerBannerSrc?: string;
  headerBannerAlt?: string;
  modeHeaderTitle?: string;
  startButtonText?: string;
  showModeAndTheme?: boolean;
  fixedTeamCount?: number;
}

/* ============================================================================
 * 20 UNIQUE NEW FULL-BODY 3D CLASS REWARDS HAMSTER CHARACTERS
 * Uses ONLY the 20 new full-body 3D hamster portraits (No 2 hamsters the same)
 * ============================================================================ */
export interface CuteHamsterIconMeta {
  id: number;
  name: string;
  personality: string;
  imageSrc: string;
  ringColors: [string, string];
  accentColor: string;
}

export const CUTE_HAMSTER_ICONS: CuteHamsterIconMeta[] = CUTE_HAMSTER_BREEDS.slice(0, 20).map(
  (breed, index) => ({
    id: index + 1,
    name: breed.name,
    personality: breed.personality,
    imageSrc: breed.imageUrl,
    ringColors: breed.ringColors,
    accentColor: breed.accentColor,
  })
);

export function CuteHamsterAvatar({
  avatarId = 1,
  className = 'w-16 h-16',
}: {
  avatarId?: number;
  className?: string;
}) {
  const safeId = ((Math.max(1, avatarId) - 1) % CUTE_HAMSTER_ICONS.length) + 1;
  const meta = CUTE_HAMSTER_ICONS[safeId - 1] || CUTE_HAMSTER_ICONS[0];

  return (
    <div
      className={`relative rounded-full p-[3.5px] select-none shrink-0 shadow-[0_8px_18px_rgba(9,30,66,0.28),0_3px_0_#0c2d57] ${className}`}
      style={{
        background: `linear-gradient(145deg, ${meta.ringColors[0]} 0%, ${meta.ringColors[1]} 100%)`,
      }}
      title={`${meta.name} — ${meta.personality}`}
    >
      {/* Pure White Studio Backdrop so the New Full-Body 3D Hamster Pops Clearly */}
      <div className="relative w-full h-full rounded-full overflow-hidden bg-white border-2 border-white flex items-center justify-center shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]">
        <img
          src={meta.imageSrc}
          alt={meta.name}
          referrerPolicy="no-referrer"
          className="w-[94%] h-[94%] object-contain scale-[1.06] select-none pointer-events-none block"
        />
      </div>
    </div>
  );
}

/* ============================================================================
 * Helper: Transparent Cutout & Auto-Trimmed Image (For Banner & In-Game 3D Hamsters)
 * ============================================================================ */
const cutoutCache = new Map<string, string>();

export function TransparentCutoutImage({
  src,
  alt,
  className = 'w-full h-full object-contain block',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(() => {
    return cutoutCache.get(src) || null;
  });

  useEffect(() => {
    const cached = cutoutCache.get(src);
    if (cached) {
      setProcessedSrc(cached);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedSrc(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const visited = new Uint8Array(w * h);
        const isBg = new Uint8Array(w * h);
        const queue = new Int32Array(w * h * 2);
        let qHead = 0;
        let qTail = 0;

        const push = (x: number, y: number) => {
          if (x < 0 || x >= w || y < 0 || y >= h) return;
          const idx = y * w + x;
          if (visited[idx]) return;
          visited[idx] = 1;
          queue[qTail++] = x;
          queue[qTail++] = y;
        };

        for (let x = 0; x < w; x++) {
          push(x, 0);
          push(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          push(0, y);
          push(w - 1, y);
        }

        while (qHead < qTail) {
          const x = queue[qHead++];
          const y = queue[qHead++];
          const idx = y * w + x;
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          if (minC > 234 && maxC - minC < 24) {
            isBg[idx] = 1;
            push(x + 1, y);
            push(x - 1, y);
            push(x, y + 1);
            push(x, y - 1);
          }
        }

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const p = idx * 4;
            if (isBg[idx]) {
              data[p + 3] = 0;
            } else {
              let bgNeighbors = 0;
              if (x > 0 && isBg[idx - 1]) bgNeighbors++;
              if (x < w - 1 && isBg[idx + 1]) bgNeighbors++;
              if (y > 0 && isBg[idx - w]) bgNeighbors++;
              if (y < h - 1 && isBg[idx + w]) bgNeighbors++;
              if (bgNeighbors > 0) {
                const r = data[p];
                const g = data[p + 1];
                const b = data[p + 2];
                const brightness = (r + g + b) / 3;
                if (brightness > 224) {
                  data[p + 3] = Math.max(45, Math.round(255 * (1 - (brightness - 224) / 36)));
                }
              }
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (maxX > minX && maxY > minY) {
          const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02);
          const sx = Math.max(0, minX - pad);
          const sy = Math.max(0, minY - pad);
          const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
          const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);

          const trimmed = document.createElement('canvas');
          trimmed.width = sw;
          trimmed.height = sh;
          const tCtx = trimmed.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            const dataUrl = trimmed.toDataURL('image/png');
            cutoutCache.set(src, dataUrl);
            setProcessedSrc(dataUrl);
            return;
          }
        }

        const fallbackUrl = canvas.toDataURL('image/png');
        cutoutCache.set(src, fallbackUrl);
        setProcessedSrc(fallbackUrl);
      } catch {
        setProcessedSrc(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setProcessedSrc(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={processedSrc || src}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
}

function TransparentBannerImage({ src, alt }: { src: string; alt: string }) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(() => {
    if (src.endsWith('.png')) return src;
    return cutoutCache.get(src) || null;
  });

  useEffect(() => {
    if (src.endsWith('.png')) {
      setProcessedSrc(src);
      return;
    }
    const cached = cutoutCache.get(src);
    if (cached) {
      setProcessedSrc(cached);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setProcessedSrc(src);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        const visited = new Uint8Array(w * h);
        const isBg = new Uint8Array(w * h);
        const queue = new Int32Array(w * h * 2);
        let qHead = 0;
        let qTail = 0;

        const push = (x: number, y: number) => {
          if (x < 0 || x >= w || y < 0 || y >= h) return;
          const idx = y * w + x;
          if (visited[idx]) return;
          visited[idx] = 1;
          queue[qTail++] = x;
          queue[qTail++] = y;
        };

        for (let x = 0; x < w; x++) {
          push(x, 0);
          push(x, h - 1);
        }
        for (let y = 0; y < h; y++) {
          push(0, y);
          push(w - 1, y);
        }

        while (qHead < qTail) {
          const x = queue[qHead++];
          const y = queue[qHead++];
          const idx = y * w + x;
          const p = idx * 4;
          const r = data[p];
          const g = data[p + 1];
          const b = data[p + 2];
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          if (minC > 232 && maxC - minC < 26) {
            isBg[idx] = 1;
            push(x + 1, y);
            push(x - 1, y);
            push(x, y + 1);
            push(x, y - 1);
          }
        }

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const p = idx * 4;
            if (isBg[idx]) {
              data[p + 3] = 0;
            } else {
              let bgNeighbors = 0;
              if (x > 0 && isBg[idx - 1]) bgNeighbors++;
              if (x < w - 1 && isBg[idx + 1]) bgNeighbors++;
              if (y > 0 && isBg[idx - w]) bgNeighbors++;
              if (y < h - 1 && isBg[idx + w]) bgNeighbors++;
              if (bgNeighbors > 0) {
                const r = data[p];
                const g = data[p + 1];
                const b = data[p + 2];
                const brightness = (r + g + b) / 3;
                if (brightness > 220) {
                  data[p + 3] = Math.max(40, Math.round(255 * (1 - (brightness - 220) / 40)));
                }
              }
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);

        if (maxX > minX && maxY > minY) {
          const padX = Math.round((maxX - minX) * 0.015);
          const padTop = Math.round((maxY - minY) * 0.02);
          const sx = Math.max(0, minX - padX);
          const sy = Math.max(0, minY - padTop);
          const sw = Math.min(w - sx, maxX - minX + 1 + padX * 2);
          const sh = Math.min(h - sy, maxY - minY + 1 + padTop);

          const trimmed = document.createElement('canvas');
          trimmed.width = sw;
          trimmed.height = sh;
          const tCtx = trimmed.getContext('2d');
          if (tCtx) {
            tCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
            const dataUrl = trimmed.toDataURL('image/png');
            cutoutCache.set(src, dataUrl);
            setProcessedSrc(dataUrl);
            return;
          }
        }

        const fallbackUrl = canvas.toDataURL('image/png');
        cutoutCache.set(src, fallbackUrl);
        setProcessedSrc(fallbackUrl);
      } catch {
        setProcessedSrc(src);
      }
    };
    img.onerror = () => {
      if (!cancelled) setProcessedSrc(src);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!processedSrc) {
    return <div className="w-full h-36 sm:h-44" />;
  }

  return (
    <img
      src={processedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      className="w-full h-auto max-h-[205px] sm:max-h-[240px] object-contain block drop-shadow-[0_10px_18px_rgba(9,54,107,0.32)]"
    />
  );
}

/* ============================================================================
 * 1. GameBackground — Harmonized Tropical Sky, Clouds, Sunbeams & Island Beach
 * ============================================================================ */
export function GameBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="mystery-box-container"
      className="relative w-full min-h-screen overflow-x-hidden overflow-y-auto flex flex-col items-center justify-between select-none"
      style={{
        fontFamily: '"Fredoka", "Baloo 2", "Plus Jakarta Sans", "Nunito", sans-serif',
        background:
          'linear-gradient(180deg, #1b9af7 0%, #44beff 26%, #7fdfff 58%, #9be8ff 76%, #61cdef 87%, #e8bc6e 95%, #cf9443 100%)',
      }}
    >
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[1150px] h-[520px] opacity-70"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(255,254,230,0.92) 0%, rgba(190,242,255,0.45) 45%, rgba(255,255,255,0) 75%)',
          }}
        />
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
 * 2 & 3. HamsterMascot + GameLogo — Seamless Alpha-Cutout 3D Hamster Banner
 * ============================================================================ */
export function HamsterMascot() {
  return null;
}

export function GameLogo({
  src = '/images/mb3d/header-banner-cutout.png',
  alt = 'Mystery Box 3D - Explorer Hamster and Golden Question Chest',
}: {
  src?: string;
  alt?: string;
}) {
  return (
    <div className="relative z-30 w-[94%] sm:w-[90%] max-w-[1000px] mx-auto -mb-3 sm:-mb-4 select-none pointer-events-none flex items-end justify-center">
      <TransparentBannerImage src={src} alt={alt} />
    </div>
  );
}

export function TreasureDecoration() {
  return null;
}

/* ============================================================================
 * 5. MainGamePanel — Supports Standard Cabinet Width or Full-Screen Character Picker
 * ============================================================================ */
export function MainGamePanel({
  children,
  fullScreen = false,
}: {
  children: React.ReactNode;
  fullScreen?: boolean;
}) {
  return (
    <div
      className={`relative z-20 mx-auto border-[6px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.46),0_10px_0_#4ca6ee,inset_0_4px_14px_rgba(255,255,255,0.98)] flex flex-col transition-all duration-200 ${
        fullScreen
          ? 'w-[98vw] max-w-[1720px] min-h-[85vh] rounded-[32px] sm:rounded-[42px] p-4 sm:p-6 md:p-8 justify-between gap-4'
          : 'w-[95%] sm:w-[92%] max-w-[1080px] rounded-[38px] sm:rounded-[48px] p-5 sm:p-7 md:p-8 gap-4 sm:gap-5'
      }`}
      style={{
        background:
          'linear-gradient(180deg, #b8e1ff 0%, #dff2ff 24%, #f2faff 54%, #b5deff 100%)',
      }}
    >
      <div className="pointer-events-none absolute inset-x-10 top-1.5 h-4 rounded-full bg-gradient-to-b from-white/95 to-transparent" />
      {children}
    </div>
  );
}

/* ============================================================================
 * 9 & 10. Redesigned BoxModeSelector + GameModifierControls
 * ============================================================================ */
export function GameModifierControls({
  answerBonusPoints,
  onToggleBonus,
  wrongAnswerPenalty,
  onTogglePenalty,
  isMuted,
  onToggleMute,
  soundVolume = 75,
  onChangeSoundVolume,
}: {
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  soundVolume?: number;
  onChangeSoundVolume?: (vol: number) => void;
}) {
  const effectiveVolume = isMuted ? 0 : Math.max(0, Math.min(100, soundVolume));

  return (
    <div className="flex flex-col gap-2.5 pt-1">
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={onToggleBonus}
          className={`relative h-11 sm:h-12 rounded-2xl px-3 border-2 flex items-center justify-between gap-1.5 font-extrabold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
            answerBonusPoints
              ? 'bg-gradient-to-b from-[#34d399] via-[#10b981] to-[#059669] border-[#a7f3d0] text-white shadow-[0_4px_0_#065f46,inset_0_2px_3px_rgba(255,255,255,0.55)]'
              : 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300 text-slate-600 shadow-[0_4px_0_#94a3b8]'
          }`}
        >
          <span className="whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            +50 Bonus
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${
              answerBonusPoints ? 'bg-white text-[#047857]' : 'bg-slate-300 text-slate-600'
            }`}
          >
            {answerBonusPoints ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={onTogglePenalty}
          className={`relative h-11 sm:h-12 rounded-2xl px-3 border-2 flex items-center justify-between gap-1.5 font-extrabold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
            wrongAnswerPenalty
              ? 'bg-gradient-to-b from-[#fb7185] via-[#f43f5e] to-[#e11d48] border-[#fecdd3] text-white shadow-[0_4px_0_#9f1239,inset_0_2px_3px_rgba(255,255,255,0.55)]'
              : 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300 text-slate-600 shadow-[0_4px_0_#94a3b8]'
          }`}
        >
          <span className="whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            -50 Penalty
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${
              wrongAnswerPenalty ? 'bg-white text-[#be123c]' : 'bg-slate-300 text-slate-600'
            }`}
          >
            {wrongAnswerPenalty ? 'ON' : 'OFF'}
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          className={`relative h-11 sm:h-12 rounded-2xl px-3 border-2 flex items-center justify-between gap-1.5 font-extrabold text-xs sm:text-[13px] tracking-tight transition-all cursor-pointer active:translate-y-0.5 ${
            !isMuted
              ? 'bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] border-[#bae6fd] text-white shadow-[0_4px_0_#075985,inset_0_2px_3px_rgba(255,255,255,0.55)]'
              : 'bg-gradient-to-b from-slate-100 to-slate-200 border-slate-300 text-slate-600 shadow-[0_4px_0_#94a3b8]'
          }`}
        >
          <span className="flex items-center gap-1 whitespace-nowrap drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">
            {!isMuted ? <Volume2 className="w-4 h-4 shrink-0" /> : <VolumeX className="w-4 h-4 shrink-0" />}
            <span>Sound FX</span>
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 shadow-2xs ${
              !isMuted ? 'bg-white text-[#0369a1]' : 'bg-slate-300 text-slate-600'
            }`}
          >
            {!isMuted ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* Sound Volume Slider (Lower or Increase Music & SFX Live) */}
      {onChangeSoundVolume && (
        <div className="rounded-2xl px-3.5 py-2.5 bg-gradient-to-b from-[#f0f9ff] to-[#e0f2fe] border-2 border-[#7dd3fc] shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_3px_0_#38bdf8] flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMute}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer border-2 active:scale-95 ${
              effectiveVolume > 0
                ? 'bg-gradient-to-b from-[#38bdf8] to-[#0284c7] border-[#bae6fd] text-white shadow-[0_2px_0_#075985]'
                : 'bg-slate-200 border-slate-300 text-slate-500 shadow-[0_2px_0_#94a3b8]'
            }`}
            title={effectiveVolume > 0 ? 'Mute Sound' : 'Unmute Sound'}
          >
            {effectiveVolume > 0 ? <Volume2 className="w-4 h-4 stroke-[2.6]" /> : <VolumeX className="w-4 h-4 stroke-[2.6]" />}
          </button>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-[#0c4a6e]">
                Sound Volume
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-black tabular-nums ${
                  effectiveVolume > 0
                    ? 'bg-[#0284c7] text-white'
                    : 'bg-slate-300 text-slate-600'
                }`}
              >
                {effectiveVolume === 0 ? 'MUTED' : `${effectiveVolume}%`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={effectiveVolume}
              onChange={(e) => onChangeSoundVolume(Number(e.target.value))}
              aria-label="Sound Volume"
              className="w-full h-2.5 rounded-full appearance-none cursor-pointer accent-[#0284c7]"
              style={{
                background: `linear-gradient(to right, #0284c7 0%, #38bdf8 ${effectiveVolume}%, #cbd5e1 ${effectiveVolume}%, #cbd5e1 100%)`,
              }}
            />
          </div>
        </div>
      )}
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
  soundVolume,
  onChangeSoundVolume,
  headerTitle = 'BOX MODE',
}: {
  difficulty: BoxDifficultyMode;
  onSelectDifficulty: (mode: BoxDifficultyMode) => void;
  answerBonusPoints: boolean;
  onToggleBonus: () => void;
  wrongAnswerPenalty: boolean;
  onTogglePenalty: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  soundVolume?: number;
  onChangeSoundVolume?: (vol: number) => void;
  headerTitle?: string;
}) {
  const modeLabel =
    difficulty === 'normal' ? 'Normal' : difficulty === 'medium' ? 'Exciting' : 'Chaos';

  return (
    <div
      className="relative rounded-[28px] p-4 sm:p-5 border-[3.5px] border-white ring-3 ring-[#a78bfa]/75 shadow-[0_10px_24px_rgba(91,33,182,0.16),0_6px_0_#8b5cf6,inset_0_2px_6px_rgba(255,255,255,0.95)] flex flex-col justify-between gap-3.5"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f5f3ff 55%, #ede9fe 100%)',
      }}
    >
      {/* Header Banner */}
      <div
        className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl border border-[#ddd6fe] shadow-[0_4px_0_#5b21b6,inset_0_2px_4px_rgba(255,255,255,0.35)]"
        style={{
          background: 'linear-gradient(90deg, #6d28d9 0%, #7c3aed 55%, #9333ea 100%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 drop-shadow" viewBox="0 0 36 36">
            <rect x="5" y="15" width="26" height="17" rx="3" fill="#ef4444" stroke="#7f1d1d" strokeWidth="2" />
            <rect x="3" y="10" width="30" height="7" rx="2.5" fill="#f87171" stroke="#7f1d1d" strokeWidth="2" />
            <rect x="15" y="10" width="6" height="22" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
            <rect x="5" y="21" width="26" height="5" fill="#facc15" stroke="#78350f" strokeWidth="1.5" />
            <path d="M18 10 C11 2, 6 7, 13 10 Z" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
            <path d="M18 10 C25 2, 30 7, 23 10 Z" fill="#fde047" stroke="#78350f" strokeWidth="1.5" />
          </svg>
          <span
            className="text-white font-black text-base sm:text-lg tracking-wide uppercase"
            style={{ textShadow: '0 2px 2px rgba(46,16,101,0.55)' }}
          >
            {headerTitle}
          </span>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-white/20 border border-white/35 text-white font-extrabold text-xs tracking-wide">
          {modeLabel}
        </span>
      </div>

      {/* 3 Mode Selection Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 my-auto">
        <button
          type="button"
          onClick={() => onSelectDifficulty('normal')}
          className={`group relative h-26 sm:h-[112px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'normal'
              ? 'bg-gradient-to-b from-[#a855f7] via-[#7c3aed] to-[#5b21b6] text-white border-[3px] border-[#fde047] ring-3 ring-[#f59e0b]/70 shadow-[0_6px_0_#4c1d95,0_8px_16px_rgba(124,58,237,0.35)] -translate-y-0.5'
              : 'bg-white hover:bg-[#faf5ff] text-[#2e1065] border-2 border-[#d8b4fe] shadow-[0_5px_0_#c4b5fd] hover:-translate-y-0.5'
          }`}
        >
          {difficulty === 'normal' && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#facc15] text-[#451a03] flex items-center justify-center shadow-xs">
              <Check className="w-3.5 h-3.5" strokeWidth={3.8} />
            </div>
          )}
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
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase leading-tight">
            Normal
          </span>
          <span
            className={`text-[10px] font-bold leading-none ${
              difficulty === 'normal' ? 'text-purple-100' : 'text-purple-700/75'
            }`}
          >
            Classic Boxes
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDifficulty('medium')}
          className={`group relative h-26 sm:h-[112px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'medium'
              ? 'bg-gradient-to-b from-[#a855f7] via-[#7c3aed] to-[#5b21b6] text-white border-[3px] border-[#fde047] ring-3 ring-[#f59e0b]/70 shadow-[0_6px_0_#4c1d95,0_8px_16px_rgba(124,58,237,0.35)] -translate-y-0.5'
              : 'bg-white hover:bg-[#faf5ff] text-[#2e1065] border-2 border-[#d8b4fe] shadow-[0_5px_0_#c4b5fd] hover:-translate-y-0.5'
          }`}
        >
          {difficulty === 'medium' && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#facc15] text-[#451a03] flex items-center justify-center shadow-xs">
              <Check className="w-3.5 h-3.5" strokeWidth={3.8} />
            </div>
          )}
          <svg className="w-8 h-8 sm:w-9 sm:h-9 drop-shadow-xs" viewBox="0 0 40 36">
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
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase leading-tight">
            Exciting
          </span>
          <span
            className={`text-[10px] font-bold leading-none ${
              difficulty === 'medium' ? 'text-purple-100' : 'text-purple-700/75'
            }`}
          >
            Big Swings
          </span>
        </button>

        <button
          type="button"
          onClick={() => onSelectDifficulty('difficult')}
          className={`group relative h-26 sm:h-[112px] rounded-2xl p-2.5 flex flex-col items-center justify-center gap-1 transition-all duration-150 cursor-pointer active:translate-y-0.5 ${
            difficulty === 'difficult'
              ? 'bg-gradient-to-b from-[#a855f7] via-[#7c3aed] to-[#5b21b6] text-white border-[3px] border-[#fde047] ring-3 ring-[#f59e0b]/70 shadow-[0_6px_0_#4c1d95,0_8px_16px_rgba(124,58,237,0.35)] -translate-y-0.5'
              : 'bg-white hover:bg-[#faf5ff] text-[#2e1065] border-2 border-[#d8b4fe] shadow-[0_5px_0_#c4b5fd] hover:-translate-y-0.5'
          }`}
        >
          {difficulty === 'difficult' && (
            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#facc15] text-[#451a03] flex items-center justify-center shadow-xs">
              <Check className="w-3.5 h-3.5" strokeWidth={3.8} />
            </div>
          )}
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
          <span className="font-black text-xs sm:text-sm tracking-wide uppercase leading-tight flex items-center gap-1">
            <span>Chaos</span>
            <Flame className="w-3.5 h-3.5 text-orange-400 fill-amber-300 shrink-0" />
          </span>
          <span
            className={`text-[10px] font-bold leading-none ${
              difficulty === 'difficult' ? 'text-purple-100' : 'text-purple-700/75'
            }`}
          >
            Wild Swaps
          </span>
        </button>
      </div>

      <GameModifierControls
        answerBonusPoints={answerBonusPoints}
        onToggleBonus={onToggleBonus}
        wrongAnswerPenalty={wrongAnswerPenalty}
        onTogglePenalty={onTogglePenalty}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        soundVolume={soundVolume}
        onChangeSoundVolume={onChangeSoundVolume}
      />
    </div>
  );
}

/* ============================================================================
 * 11. Redesigned ThemeCard & ArenaThemeSelector
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
          ? 'bg-gradient-to-b from-[#fef08a] to-[#facc15] border-[3px] border-[#d97706] ring-3 ring-[#fde047] shadow-[0_6px_0_#b45309,0_8px_16px_rgba(245,158,11,0.35)] -translate-y-0.5 z-10'
          : 'bg-white border-2 border-[#fde68a] shadow-[0_5px_0_#fcd34d] hover:-translate-y-0.5'
      }`}
    >
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-b from-[#f59e0b] to-[#b45309] border-2 border-white shadow-md flex items-center justify-center text-white">
          <Check className="w-3.5 h-3.5" strokeWidth={4} />
        </div>
      )}

      <div className="w-full h-14 sm:h-[64px] overflow-hidden rounded-t-xl relative bg-sky-100">
        <img
          src={`/images/mb3d/${id}.png`}
          alt={name}
          className="w-full h-full object-cover block group-hover:scale-105 transition-transform duration-200"
        />
      </div>

      <div
        className={`w-full py-1.5 px-2 flex items-center justify-center gap-1.5 font-black text-xs sm:text-[13px] tracking-wide uppercase ${
          isSelected ? 'bg-[#facc15] text-[#451a03]' : 'bg-white text-[#1e293b]'
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
    { id: 'theme-sky', name: 'Sky', icon: '☁️' },
    { id: 'theme-ocean', name: 'Ocean', icon: '🌊' },
    { id: 'theme-space', name: 'Space', icon: '🚀' },
    { id: 'theme-jungle', name: 'Jungle', icon: '🌴' },
    { id: 'theme-sunset', name: 'Sunset', icon: '🌅' },
    { id: 'theme-royal', name: 'Royal', icon: '👑' },
  ];

  const activeThemeObj = themes.find((t) => t.id === selectedTheme) || themes[0];

  return (
    <div
      className="relative rounded-[28px] p-4 sm:p-5 border-[3.5px] border-white ring-3 ring-[#fbbf24]/85 shadow-[0_10px_24px_rgba(180,83,9,0.16),0_6px_0_#f59e0b,inset_0_2px_6px_rgba(255,255,255,0.95)] flex flex-col justify-between gap-3.5"
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #fffbeb 55%, #fef3c7 100%)',
      }}
    >
      {/* Header Banner */}
      <div
        className="flex items-center justify-between gap-2.5 px-4 py-2.5 rounded-2xl border border-[#fde68a] shadow-[0_4px_0_#b45309,inset_0_2px_4px_rgba(255,255,255,0.45)]"
        style={{
          background: 'linear-gradient(90deg, #d97706 0%, #f59e0b 55%, #fbbf24 100%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-white/25 border border-white/50 flex items-center justify-center text-white shadow-2xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <span
            className="text-white font-black text-base sm:text-lg tracking-wide uppercase"
            style={{ textShadow: '0 2px 2px rgba(120,53,15,0.55)' }}
          >
            ARENA THEME
          </span>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-white/25 border border-white/40 text-white font-extrabold text-xs tracking-wide">
          {activeThemeObj.icon} {activeThemeObj.name}
        </span>
      </div>

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
 * 12. Clean, Non-Overlapping 3D Arcade Slider & Chunky 3D Buttons
 * ============================================================================ */
const GAME_TIME_STEPS = [
  { label: 'OFF', minutes: 0 },
  { label: '1m', minutes: 1 },
  { label: '2m', minutes: 2 },
  { label: '3m', minutes: 3 },
  { label: '5m', minutes: 5 },
  { label: '10m', minutes: 10 },
  { label: '15m', minutes: 15 },
  { label: '20m', minutes: 20 },
];

let sharedLobbyAudioCtx: AudioContext | null = null;
function playLobbySfx(type: 'select' | 'tick' = 'select') {
  try {
    if (!sharedLobbyAudioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) sharedLobbyAudioCtx = new AudioCtx();
    }
    const ctx = sharedLobbyAudioCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type === 'tick' ? 'sine' : 'triangle';
    const startFreq = type === 'tick' ? 760 : 540;
    const endFreq = type === 'tick' ? 980 : 920;
    const dur = type === 'tick' ? 0.035 : 0.075;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(type === 'tick' ? 0.14 : 0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  } catch {
    // ignore audio fallback
  }
}

function BaamboozleBlueButton({
  onClick,
  children,
  className = '',
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        playLobbySfx('select');
        onClick();
      }}
      title={title}
      className={`group relative rounded-2xl px-6 sm:px-8 py-3 sm:py-3.5 bg-gradient-to-b from-[#4fd1ff] via-[#0ea5e9] to-[#0284c7] border-[3px] border-[#0c2d57] shadow-[0_6px_0_#0c2d57,0_10px_18px_rgba(12,45,87,0.28)] hover:brightness-105 hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#0c2d57] transition-all duration-150 flex items-center justify-center gap-2.5 cursor-pointer text-white font-black tracking-wide ${className}`}
    >
      {/* Top glossy highlight */}
      <div className="pointer-events-none absolute inset-x-3 top-1 h-2.5 rounded-full bg-gradient-to-b from-white/70 to-transparent" />
      {children}
    </button>
  );
}

function BaamboozleSlider({
  min,
  max,
  value,
  displayValue,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  displayValue: string | number;
  onChange: (newVal: number) => void;
}) {
  const safeMax = Math.max(min, max);
  const clamped = Math.min(safeMax, Math.max(min, value));
  const percent = safeMax === min ? 0 : ((clamped - min) / (safeMax - min)) * 100;

  return (
    <div className="relative flex-1 pt-12 sm:pt-13 pb-2 px-5 sm:px-6 select-none">
      {/* Inner Relative Track Wrapper so 0%..100% stays strictly inside the padded area */}
      <div className="relative w-full">
        {/* Elevated 3D Floating Value Pill Directly Above the Slider Thumb (Zero Overlap) */}
        <div
          className="pointer-events-none absolute -top-11 sm:-top-12 -translate-x-1/2 z-10 flex flex-col items-center transition-all duration-75"
          style={{ left: `${percent}%` }}
        >
          <div className="px-3 py-0.5 rounded-xl bg-gradient-to-b from-[#1e3a8a] to-[#0c2d57] border-2 border-white shadow-[0_3px_8px_rgba(12,45,87,0.28)] text-white font-black text-base sm:text-lg leading-tight tabular-nums whitespace-nowrap">
            {displayValue}
          </div>
          {/* Small downward pointer triangle */}
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-[#0c2d57] -mt-[1px]" />
        </div>

        {/* Track Pill */}
        <div className="relative h-4 sm:h-5 w-full rounded-full bg-gradient-to-b from-[#0369a1]/25 to-[#0284c7]/35 border-[3px] border-white shadow-[inset_0_2px_4px_rgba(9,30,66,0.28),0_2px_4px_rgba(255,255,255,0.85)] flex items-center">
          {/* Filled Progress Bar */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#fde047] via-[#fb923c] to-[#f97316]"
            style={{ width: `${percent}%` }}
          />

          {/* Custom Glossy 3D Orange-Gold Circular Thumb */}
          <div
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-b from-[#ffd166] via-[#ff8c42] to-[#e04819] border-[3px] border-[#451a03] shadow-[0_4px_0_#451a03,0_6px_12px_rgba(0,0,0,0.25)] flex items-center justify-center transition-all duration-75"
            style={{ left: `${percent}%` }}
          >
            <div className="w-3 h-1.5 rounded-full bg-white/80 -mt-2.5 -ml-1.5 rotate-[-20deg]" />
          </div>

          {/* Native Invisible Range Input for Smooth Dragging & Keyboard Accessibility */}
          <input
            type="range"
            min={min}
            max={safeMax}
            step={1}
            value={clamped}
            onChange={(e) => {
              playLobbySfx('tick');
              onChange(Number(e.target.value));
            }}
            className="absolute -inset-x-4 -inset-y-4 w-[calc(100%+32px)] h-12 opacity-0 cursor-pointer z-20"
          />
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 13. MysteryBox3DLobby — Baamboozle 3-Stage Flow with Full-Screen 20-Character Picker
 * ============================================================================ */
export function MysteryBox3DLobby({
  questionCount,
  selectedQuestionLimit,
  onSelectQuestionLimit,
  gameTimeMinutes = 0,
  onSelectGameTime,
  numPlayers,
  onSelectNumPlayers,
  playerNames,
  onChangePlayerName,
  teamAvatars = [1, 2, 3, 4, 5, 6, 7, 8],
  onChangeTeamAvatar,
  onRandomizeTeamAvatars,
  difficulty,
  onSelectDifficulty,
  answerBonusPoints,
  onToggleBonus,
  wrongAnswerPenalty,
  onTogglePenalty,
  isMuted,
  onToggleMute,
  soundVolume,
  onChangeSoundVolume,
  selectedTheme,
  onSelectTheme,
  onStartGame,
  onOpenStudy,
  onBack,
  onOpenGameSwitcher,
  onOpenQuizEditor,
  headerBannerSrc = '/images/mb3d/header-banner-cutout.png',
  headerBannerAlt = 'Mystery Box 3D - Explorer Hamster and Golden Question Chest',
  modeHeaderTitle = 'BOX MODE',
  fixedTeamCount,
}: MysteryBox3DLobbyProps) {
  const [lobbyStep, setLobbyStep] = useState<'sliders' | 'teams' | 'picker'>('sliders');
  const [editingTeamIdx, setEditingTeamIdx] = useState<number>(0);
  const [showOptionsModal, setShowOptionsModal] = useState<boolean>(false);

  const effectiveNumPlayers = fixedTeamCount ?? numPlayers;
  const maxQuestions = Math.max(1, questionCount);
  const activeLimit = Math.min(
    maxQuestions,
    Math.max(1, selectedQuestionLimit ?? maxQuestions)
  );
  const perTeamCount = Math.max(1, Math.floor(activeLimit / Math.max(1, effectiveNumPlayers)));

  const currentTimeStepIdx = Math.max(
    0,
    GAME_TIME_STEPS.findIndex((s) => s.minutes === gameTimeMinutes)
  );

  // Local fallback if parent does not pass teamAvatars state
  const [localAvatars, setLocalAvatars] = useState<number[]>(teamAvatars);
  useEffect(() => {
    setLocalAvatars(teamAvatars);
  }, [teamAvatars]);

  const effectiveAvatars = onChangeTeamAvatar ? teamAvatars : localAvatars;

  const handleAssignAvatar = (teamIdx: number, avatarId: number) => {
    if (!isMuted) playLobbySfx('select');
    if (onChangeTeamAvatar) {
      onChangeTeamAvatar(teamIdx, avatarId);
    } else {
      setLocalAvatars((prev) => {
        const next = [...prev];
        const existingOwner = next.findIndex((id, i) => i < effectiveNumPlayers && id === avatarId);
        if (existingOwner !== -1 && existingOwner !== teamIdx) {
          next[existingOwner] = next[teamIdx];
        }
        next[teamIdx] = avatarId;
        return next;
      });
    }
  };

  const handleRandomizeAllAvatars = () => {
    if (!isMuted) playLobbySfx('select');
    if (onRandomizeTeamAvatars) {
      onRandomizeTeamAvatars();
      return;
    }
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const assigned = pool.slice(0, 8);
    setLocalAvatars(assigned);
  };

  const handleRandomizeSingleTeam = (teamIdx: number) => {
    if (!isMuted) playLobbySfx('select');
    const usedByOthers = new Set(
      effectiveAvatars.slice(0, effectiveNumPlayers).filter((_, idx) => idx !== teamIdx)
    );
    const available = Array.from({ length: 20 }, (_, i) => i + 1).filter(
      (id) => !usedByOthers.has(id) && id !== effectiveAvatars[teamIdx]
    );
    if (available.length > 0) {
      const pick = available[Math.floor(Math.random() * available.length)];
      handleAssignAvatar(teamIdx, pick);
    }
  };

  const isFullScreenPicker = lobbyStep === 'picker';

  return (
    <GameBackground>
      {/* Top Teacher Utility Controls */}
      <div
        className={`relative z-30 mx-auto pt-3 flex items-center justify-between gap-2 ${
          isFullScreenPicker
            ? 'w-[98vw] max-w-[1720px]'
            : 'w-[95%] sm:w-[92%] max-w-[1080px]'
        }`}
      >
        <button
          type="button"
          onClick={onBack}
          className="relative px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-white via-[#f0f9ff] to-[#d8efff] hover:from-white hover:to-[#e0f2fe] text-[#0c2d57] font-black text-xs sm:text-sm border-[2.5px] border-white ring-2 ring-[#0284c7]/60 shadow-[0_4px_0_#0369a1,0_6px_12px_rgba(3,105,161,0.28)] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
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
            className="relative px-4 sm:px-5 py-2 rounded-full bg-gradient-to-b from-white via-[#f0f9ff] to-[#d8efff] hover:from-white hover:to-[#e0f2fe] text-[#0c2d57] font-black text-xs sm:text-sm border-[2.5px] border-white ring-2 ring-[#0284c7]/60 shadow-[0_4px_0_#0369a1,0_6px_12px_rgba(3,105,161,0.28)] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
          >
            <Edit3 className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>Edit Questions ({questionCount})</span>
          </button>
        </div>
      </div>

      {/* Main Centered Tropical Adventure Stage */}
      <div className="relative z-20 w-full flex-1 flex flex-col items-center justify-center pb-4 sm:pb-6 pt-1">
        {/* Hide the large top banner during Full-Screen Character Picker so the 20 hamsters fill the screen */}
        {!isFullScreenPicker && <GameLogo src={headerBannerSrc} alt={headerBannerAlt} />}

        <MainGamePanel fullScreen={isFullScreenPicker}>
          {/* ================================================================
           * STEP 1: SLIDERS (TEAMS, QUESTIONS + EDIT, GAME TIME) + NEXT
           * ================================================================ */}
          {lobbyStep === 'sliders' && (
            <div className="w-full max-w-3xl mx-auto flex flex-col gap-3 sm:gap-4 py-2 sm:py-3">
              {/* ROW 1: TEAMS SLIDER */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="w-48 sm:w-56 flex items-center gap-3.5 shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#38bdf8] to-[#0284c7] border-2 border-white shadow-[0_4px_0_#0369a1,0_6px_10px_rgba(2,132,199,0.22)] flex items-center justify-center text-white shrink-0">
                    <Users className="w-6 h-6 stroke-[2.6]" />
                  </div>
                  <span className="text-2xl sm:text-[28px] font-black text-[#0c2d57] tracking-tight uppercase drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
                    TEAMS
                  </span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <BaamboozleSlider
                    min={1}
                    max={8}
                    value={effectiveNumPlayers}
                    displayValue={effectiveNumPlayers}
                    onChange={(val) => onSelectNumPlayers(fixedTeamCount ?? val)}
                  />
                  <div className="hidden sm:block w-[112px] shrink-0" />
                </div>
              </div>

              {/* ROW 2: QUESTIONS SLIDER + EDIT BUTTON */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="w-48 sm:w-56 flex items-center gap-3.5 shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#38bdf8] to-[#0284c7] border-2 border-white shadow-[0_4px_0_#0369a1,0_6px_10px_rgba(2,132,199,0.22)] flex items-center justify-center text-white shrink-0">
                    <HelpCircle className="w-6 h-6 stroke-[2.6]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl sm:text-[28px] font-black text-[#0c2d57] tracking-tight uppercase leading-none drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
                      QUESTIONS
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#0284c7]/15 text-[#0369a1] border border-[#0284c7]/30 font-extrabold text-xs sm:text-[13px] tracking-wide mt-1.5 w-fit">
                      {effectiveNumPlayers > 1 ? `${perTeamCount} each` : `${activeLimit} total`}
                    </span>
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <BaamboozleSlider
                    min={1}
                    max={maxQuestions}
                    value={activeLimit}
                    displayValue={activeLimit}
                    onChange={(val) => onSelectQuestionLimit && onSelectQuestionLimit(val)}
                  />

                  <BaamboozleBlueButton
                    onClick={onOpenQuizEditor}
                    className="!px-4 !py-2.5 !rounded-xl shrink-0 w-[112px]"
                    title="Edit Questions"
                  >
                    <Edit3 className="w-4 h-4 text-white drop-shadow-[0_1.5px_0_#035388] stroke-[2.8]" />
                    <span className="text-base sm:text-lg font-black text-white drop-shadow-[0_1.5px_0_#035388]">
                      Edit
                    </span>
                  </BaamboozleBlueButton>
                </div>
              </div>

              {/* ROW 3: GAME TIME SLIDER */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div className="w-48 sm:w-56 flex items-center gap-3.5 shrink-0">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-b from-[#38bdf8] to-[#0284c7] border-2 border-white shadow-[0_4px_0_#0369a1,0_6px_10px_rgba(2,132,199,0.22)] flex items-center justify-center text-white shrink-0">
                    <Clock className="w-6 h-6 stroke-[2.6]" />
                  </div>
                  <span className="text-2xl sm:text-[28px] font-black text-[#0c2d57] tracking-tight uppercase whitespace-nowrap drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
                    GAME TIME
                  </span>
                </div>

                <div className="flex-1 flex items-center gap-3">
                  <BaamboozleSlider
                    min={0}
                    max={GAME_TIME_STEPS.length - 1}
                    value={currentTimeStepIdx}
                    displayValue={GAME_TIME_STEPS[currentTimeStepIdx]?.label || 'OFF'}
                    onChange={(stepIdx) => {
                      const chosen = GAME_TIME_STEPS[stepIdx];
                      if (chosen && onSelectGameTime) {
                        onSelectGameTime(chosen.minutes);
                      }
                    }}
                  />
                  <div className="hidden sm:block w-[112px] shrink-0" />
                </div>
              </div>

              {/* BOTTOM NEXT BUTTON */}
              <div className="flex items-center justify-center pt-3">
                <BaamboozleBlueButton
                  onClick={() => setLobbyStep('teams')}
                  className="min-w-[210px] sm:min-w-[240px]"
                >
                  <ArrowRight className="w-6 h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[3.2]" />
                  <span className="text-2xl sm:text-3xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Next
                  </span>
                </BaamboozleBlueButton>
              </div>
            </div>
          )}

          {/* ================================================================
           * STEP 2: "TEAMS" VIEW (LARGE FULL-BODY 3D HAMSTERS + BACK/RANDOM/OPTIONS/START)
           * ================================================================ */}
          {lobbyStep === 'teams' && (
            <div className="w-full flex flex-col items-center justify-between gap-6 py-2 sm:py-3">
              {/* Top Title: TEAMS */}
              <div className="text-center">
                <h2 className="text-3xl sm:text-5xl font-black text-[#0c2d57] tracking-tight uppercase drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
                  TEAMS
                </h2>
                <p className="text-xs sm:text-sm font-extrabold text-[#0369a1] mt-1">
                  Click any hamster character or team name to choose from 20 unique hamsters!
                </p>
              </div>

              {/* Active Teams Large 3D Hamster Avatars + Golden Nameplates */}
              <div className="w-full flex flex-wrap items-center justify-center gap-6 sm:gap-8 py-2">
                {Array.from({ length: effectiveNumPlayers }).map((_, idx) => {
                  const avatarId = ((Math.max(1, effectiveAvatars[idx] || idx + 1) - 1) % 20) + 1;
                  const teamName =
                    playerNames[idx] || (effectiveNumPlayers === 1 ? 'Player 1' : `Team ${idx + 1}`);
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setEditingTeamIdx(idx);
                        setLobbyStep('picker');
                      }}
                      className="group flex flex-col items-center gap-3.5 cursor-pointer select-none transition-transform duration-150 hover:-translate-y-1.5"
                      title={`Click to choose hamster character & name for ${teamName}`}
                    >
                      <CuteHamsterAvatar
                        avatarId={avatarId}
                        className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 group-hover:scale-105 transition-transform"
                      />

                      {/* Chunky 3D Golden-Yellow Team Nameplate Button */}
                      <button
                        type="button"
                        className="relative min-w-[145px] sm:min-w-[175px] px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] border-[3px] border-[#451a03] shadow-[0_5px_0_#451a03,0_10px_16px_rgba(69,26,3,0.22)] group-hover:brightness-105 active:translate-y-0.5 flex items-center justify-center cursor-pointer"
                      >
                        <div className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
                        <span className="text-lg sm:text-2xl font-black text-[#2d1203] drop-shadow-[0_1px_0_rgba(255,255,255,0.85)] truncate max-w-[160px]">
                          {teamName}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Bottom 4 Blue Action Buttons: Back | Random | Options | Start */}
              <div className="w-full flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2">
                <BaamboozleBlueButton
                  onClick={() => setLobbyStep('sliders')}
                  className="min-w-[145px] sm:min-w-[170px]"
                >
                  <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[3.2]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Back
                  </span>
                </BaamboozleBlueButton>

                <BaamboozleBlueButton
                  onClick={handleRandomizeAllAvatars}
                  className="min-w-[145px] sm:min-w-[170px]"
                  title="Randomize Team Hamsters"
                >
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[3]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Random
                  </span>
                </BaamboozleBlueButton>

                <BaamboozleBlueButton
                  onClick={() => setShowOptionsModal(true)}
                  className="min-w-[145px] sm:min-w-[170px]"
                  title="Box Mode, Arena Theme & Study Options"
                >
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[2.8]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Options
                  </span>
                </BaamboozleBlueButton>

                <BaamboozleBlueButton
                  onClick={onStartGame}
                  className="min-w-[165px] sm:min-w-[195px]"
                >
                  <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white drop-shadow-[0_2px_0_#035388]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Start
                  </span>
                </BaamboozleBlueButton>
              </div>
            </div>
          )}

          {/* ================================================================
           * STEP 3: FULL-SCREEN 20 UNIQUE NEW 3D HAMSTER PICKER (10 x 2 LARGE GRID)
           * ================================================================ */}
          {lobbyStep === 'picker' && (
            <div className="w-full flex-1 flex flex-col items-center justify-between gap-4 sm:gap-6 py-1">
              {/* Top Team Navigation Bar: [ <- ]  [ Team 1 ]  [ -> ] */}
              <div className="w-full flex items-center justify-center gap-4 sm:gap-8">
                <button
                  type="button"
                  onClick={() =>
                    setEditingTeamIdx(
                      (prev) => (prev - 1 + effectiveNumPlayers) % effectiveNumPlayers
                    )
                  }
                  disabled={effectiveNumPlayers <= 1}
                  className="w-14 h-11 sm:w-16 sm:h-12 rounded-xl bg-gradient-to-b from-white to-slate-200 disabled:opacity-40 border-[2.5px] border-[#0c2d57] shadow-[0_4px_0_#0c2d57] flex items-center justify-center text-[#0c2d57] cursor-pointer active:translate-y-0.5"
                  title="Previous Team"
                >
                  <ArrowLeft className="w-6 h-6 stroke-[3]" />
                </button>

                {/* Editable Team Title Box */}
                <div className="px-6 py-2 rounded-2xl bg-gradient-to-b from-[#1d4ed8] to-[#1e3a8a] border-[3px] border-[#0c2d57] shadow-[0_4px_0_#0c2d57] flex items-center gap-2.5">
                  <input
                    type="text"
                    value={
                      playerNames[editingTeamIdx] ??
                      (effectiveNumPlayers === 1 ? 'Player 1' : `Team ${editingTeamIdx + 1}`)
                    }
                    onChange={(e) => onChangePlayerName(editingTeamIdx, e.target.value)}
                    aria-label="Edit Team Name"
                    className="w-40 sm:w-56 bg-transparent text-center text-white font-black text-2xl sm:text-4xl focus:outline-none drop-shadow-[0_2px_0_#091e42]"
                  />
                  <Edit3 className="w-5 h-5 text-sky-200 shrink-0" />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setEditingTeamIdx((prev) => (prev + 1) % effectiveNumPlayers)
                  }
                  disabled={effectiveNumPlayers <= 1}
                  className="w-14 h-11 sm:w-16 sm:h-12 rounded-xl bg-gradient-to-b from-white to-slate-200 disabled:opacity-40 border-[2.5px] border-[#0c2d57] shadow-[0_4px_0_#0c2d57] flex items-center justify-center text-[#0c2d57] cursor-pointer active:translate-y-0.5"
                  title="Next Team"
                >
                  <ArrowRight className="w-6 h-6 stroke-[3]" />
                </button>
              </div>

              {/* 20 Unique New 3D Hamsters in a Clean Full-Screen 10x2 Grid (Big Characters, Never Wraps 9+1) */}
              <div className="w-full flex-1 grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-3 sm:gap-4 md:gap-5 items-center justify-items-center py-2 px-1 sm:px-3">
                {CUTE_HAMSTER_ICONS.map((icon) => {
                  const ownerIdx = effectiveAvatars
                    .slice(0, effectiveNumPlayers)
                    .findIndex((id) => ((Math.max(1, id) - 1) % 20) + 1 === icon.id);
                  const isCurrentTeamIcon = ownerIdx === editingTeamIdx;
                  const isOtherTeamIcon = ownerIdx !== -1 && ownerIdx !== editingTeamIdx;
                  const ownerName =
                    ownerIdx !== -1
                      ? playerNames[ownerIdx] || `Team ${ownerIdx + 1}`
                      : `${icon.id}`;

                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => handleAssignAvatar(editingTeamIdx, icon.id)}
                      className="group w-full max-w-[148px] flex flex-col items-center gap-2 cursor-pointer select-none transition-transform duration-150 hover:-translate-y-1.5"
                      title={`${icon.name} — ${icon.personality}`}
                    >
                      <div
                        className={`rounded-full p-1 transition-all ${
                          isCurrentTeamIcon
                            ? 'ring-4 ring-[#f97316] scale-105 shadow-[0_0_22px_rgba(249,115,22,0.9)]'
                            : isOtherTeamIcon
                            ? 'opacity-50'
                            : 'group-hover:scale-105'
                        }`}
                      >
                        <CuteHamsterAvatar
                          avatarId={icon.id}
                          className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 xl:w-[126px] xl:h-[126px]"
                        />
                      </div>

                      {/* Crisp Number Plate (Yellow 1-20) or Blue Team Plate (Team 1 / Team 2) */}
                      <div
                        className={`w-full max-w-[128px] py-1 px-2 rounded-xl border-[2.5px] flex items-center justify-center ${
                          ownerIdx !== -1
                            ? 'bg-gradient-to-b from-[#38bdf8] via-[#0ea5e9] to-[#0284c7] border-[#0c2d57] shadow-[0_3px_0_#0c2d57]'
                            : 'bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] border-[#78350f] shadow-[0_3px_0_#78350f]'
                        }`}
                      >
                        <span
                          className={`text-xs sm:text-sm md:text-base font-black truncate leading-tight ${
                            ownerIdx !== -1
                              ? 'text-white drop-shadow-[0_1px_0_#035388]'
                              : 'text-[#2d1203] drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]'
                          }`}
                        >
                          {ownerName}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom Action Buttons: Random | Okay */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <BaamboozleBlueButton
                  onClick={() => handleRandomizeSingleTeam(editingTeamIdx)}
                  className="min-w-[175px] sm:min-w-[210px]"
                >
                  <RefreshCw className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[3]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Random
                  </span>
                </BaamboozleBlueButton>

                <BaamboozleBlueButton
                  onClick={() => setLobbyStep('teams')}
                  className="min-w-[175px] sm:min-w-[210px]"
                >
                  <Check className="w-6 h-6 text-white drop-shadow-[0_2px_0_#035388] stroke-[3.5]" />
                  <span className="text-xl sm:text-2xl font-black text-white drop-shadow-[0_2px_0_#035388]">
                    Okay
                  </span>
                </BaamboozleBlueButton>
              </div>
            </div>
          )}
        </MainGamePanel>
      </div>

      {/* REDESIGNED GAME OPTIONS MODAL */}
      {showOptionsModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setShowOptionsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[680px] rounded-[36px] p-5 sm:p-7 border-[5px] border-white ring-4 ring-[#6bc2ff]/85 shadow-[0_26px_65px_rgba(7,48,94,0.55),0_8px_0_#4ca6ee] flex flex-col gap-5 my-auto"
            style={{
              background:
                'linear-gradient(180deg, #b8e1ff 0%, #dff2ff 24%, #f2faff 54%, #b5deff 100%)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-b from-[#38bdf8] via-[#0284c7] to-[#0369a1] border-2 border-white shadow-[0_4px_0_#075985] flex items-center justify-center text-white shrink-0">
                  <Settings className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-[#0c2d57] tracking-tight uppercase leading-none drop-shadow-[0_2px_0_rgba(255,255,255,0.95)]">
                    GAME OPTIONS
                  </h2>
                  <p className="text-xs sm:text-sm font-bold text-[#0369a1] mt-1">
                    Choose your Mystery Box mode, bonus rules, and sound settings
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOptionsModal(false)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white hover:bg-rose-50 text-[#0c2d57] hover:text-rose-600 border-2 border-[#0c2d57]/20 shadow-[0_3px_0_rgba(12,45,87,0.2)] flex items-center justify-center transition-colors cursor-pointer"
                title="Close Options"
              >
                <X className="w-5 h-5 stroke-[3]" />
              </button>
            </div>

            {/* Single-Column Box Mode Selector (Arena Theme removed) */}
            <div className="w-full">
              <BoxModeSelector
                difficulty={difficulty}
                onSelectDifficulty={onSelectDifficulty}
                answerBonusPoints={answerBonusPoints}
                onToggleBonus={onToggleBonus}
                wrongAnswerPenalty={wrongAnswerPenalty}
                onTogglePenalty={onTogglePenalty}
                isMuted={isMuted}
                onToggleMute={onToggleMute}
                soundVolume={soundVolume}
                onChangeSoundVolume={onChangeSoundVolume}
                headerTitle={modeHeaderTitle}
              />
            </div>

            {/* Footer Action Bar: Study Questions & Done */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowOptionsModal(false);
                  onOpenStudy();
                }}
                className="relative px-6 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-b from-[#fff380] via-[#ffd426] to-[#f59e0b] hover:brightness-105 border-[3px] border-[#78350f] shadow-[0_5px_0_#78350f,0_8px_16px_rgba(120,53,15,0.22)] active:translate-y-0.5 flex items-center gap-2.5 cursor-pointer transition-all"
              >
                <div className="pointer-events-none absolute inset-x-3 top-1 h-2 rounded-full bg-gradient-to-b from-white/75 to-transparent" />
                <BookOpen className="w-5 h-5 text-[#451a03] stroke-[2.8]" />
                <span className="text-base sm:text-lg font-black text-[#451a03] tracking-wide uppercase drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                  Study Questions
                </span>
              </button>

              <BaamboozleBlueButton onClick={() => setShowOptionsModal(false)}>
                <Check className="w-5 h-5 text-white drop-shadow-[0_1.5px_0_#035388] stroke-[3.5]" />
                <span className="text-lg sm:text-xl font-black text-white uppercase drop-shadow-[0_1.5px_0_#035388]">
                  Done
                </span>
              </BaamboozleBlueButton>
            </div>
          </div>
        </div>
      )}

      <TreasureDecoration />
    </GameBackground>
  );
}
