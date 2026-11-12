import React from 'react';
import { ArrowLeft, Edit3, Play } from 'lucide-react';
import { FullscreenButton } from './FullscreenButton';

export interface PlayerModeOption {
  id: string | number;
  label: string;
  icon?: string;
  activeGradient?: string;
}

export interface PlayerNameField {
  id: string;
  badge: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  colorScheme?: 'blue' | 'red' | 'emerald' | 'amber' | 'purple';
}

export interface TimerOption {
  label: string;
  sec: number;
}

export interface UnifiedGameSetupProps {
  title: string;
  containerId?: string;
  questionCount?: number;
  onBack: () => void;
  onOpenSettings?: () => void;
  onOpenGameSwitcher?: () => void;
  onOpenQuizEditor?: () => void;
  topRightExtras?: React.ReactNode;

  // 1. Player / Team Mode Selection
  playerModeOptions?: PlayerModeOption[];
  selectedPlayerMode?: string | number;
  onSelectPlayerMode?: (id: any) => void;

  // 2. Player / Team Name Inputs
  playerNames?: PlayerNameField[];

  // 3. Game-Specific Rules Slot
  children?: React.ReactNode;

  // 4. Optional Match Timer Selector
  timerValue?: number;
  timerLabelDisplay?: string;
  timerOptions?: TimerOption[];
  onTimerChange?: (sec: number) => void;
  timerTitle?: string;

  // 5. Primary Action Bar (Start + Optional Study)
  startLabel?: string;
  onStart: () => void;
  startDisabled?: boolean;
  onStudy?: () => void;
  studyLabel?: string;
}

const COLOR_SCHEMES = {
  blue: {
    wrap: 'bg-blue-50/90 border-blue-200 border-b-blue-400',
    badge: 'from-blue-500 to-blue-700 border-blue-950'
  },
  red: {
    wrap: 'bg-red-50/90 border-red-200 border-b-red-400',
    badge: 'from-red-500 to-red-700 border-red-950'
  },
  emerald: {
    wrap: 'bg-emerald-50/90 border-emerald-200 border-b-emerald-400',
    badge: 'from-emerald-500 to-emerald-700 border-emerald-950'
  },
  amber: {
    wrap: 'bg-amber-50/90 border-amber-200 border-b-amber-400',
    badge: 'from-amber-500 to-amber-700 border-amber-950'
  },
  purple: {
    wrap: 'bg-purple-50/90 border-purple-200 border-b-purple-400',
    badge: 'from-purple-500 to-purple-700 border-purple-950'
  }
};

export const UnifiedGameSetup: React.FC<UnifiedGameSetupProps> = ({
  title,
  containerId,
  questionCount,
  onBack,
  onOpenSettings,
  onOpenGameSwitcher,
  onOpenQuizEditor,
  topRightExtras,
  playerModeOptions,
  selectedPlayerMode,
  onSelectPlayerMode,
  playerNames,
  children,
  timerValue,
  timerLabelDisplay,
  timerOptions = [
    { label: '1M', sec: 60 },
    { label: '2M', sec: 120 },
    { label: '3M', sec: 180 },
    { label: '4M', sec: 240 },
    { label: '5M', sec: 300 }
  ],
  onTimerChange,
  timerTitle = '⏱️ TIMER',
  startLabel = 'START ARENA',
  onStart,
  startDisabled = false,
  onStudy,
  studyLabel = 'STUDY'
}) => {
  const formatSec = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto custom-scrollbar bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50 select-none text-slate-900">
      {/* Ambient 3D Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-white/80 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-200/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[42rem] h-72 bg-emerald-200/45 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-3 z-20 flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft size={18} className="text-sky-600 shrink-0" />
          <span>BACK</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {topRightExtras}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 border-t border-amber-200 border-b-4 border-b-amber-600 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>⚙️ SETTINGS</span>
            </button>
          )}
          {onOpenGameSwitcher && (
            <button
              type="button"
              onClick={onOpenGameSwitcher}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-400 border-t border-sky-200 border-b-4 border-b-sky-700 text-white font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>🎮 GAMES</span>
            </button>
          )}
          {onOpenQuizEditor && (
            <button
              type="button"
              onClick={onOpenQuizEditor}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Edit3 size={18} className="text-sky-600 shrink-0" />
              <span>QUIZ{typeof questionCount === 'number' ? ` (${questionCount})` : ''}</span>
            </button>
          )}
          {containerId && (
            <FullscreenButton
              targetId={containerId}
              className="bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900"
            />
          )}
        </div>
      </div>

      {/* Centered Minimalist Immersive Setup Stage */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl my-auto">
        {/* Hero Title — Bold Only */}
        <h2 className="text-4xl sm:text-6xl font-black text-sky-950 drop-shadow-[0_4px_0_rgba(255,255,255,1)] tracking-tight text-center mb-5 uppercase">
          {title}
        </h2>

        {/* Main Immersive Minimalist Setup Card */}
        <div className="w-full bg-white/95 backdrop-blur-xl rounded-[2.4rem] border-2 border-sky-200 border-b-[10px] border-b-sky-300 p-5 sm:p-7 shadow-[0_20px_50px_rgba(14,165,233,0.2)] space-y-5">
          {/* 1. PLAYERS / TEAMS SELECTOR + BOLD NAME INPUTS */}
          {((playerModeOptions && playerModeOptions.length > 0) || (playerNames && playerNames.length > 0)) && (
            <div className="space-y-3">
              {playerModeOptions && playerModeOptions.length > 0 && (
                <div
                  className={`grid gap-3.5 ${
                    playerModeOptions.length === 1
                      ? 'grid-cols-1'
                      : playerModeOptions.length === 2
                      ? 'grid-cols-2'
                      : playerModeOptions.length === 3
                      ? 'grid-cols-1 sm:grid-cols-3'
                      : 'grid-cols-2 sm:grid-cols-4'
                  }`}
                >
                  {playerModeOptions.map((opt, idx) => {
                    const isSelected = selectedPlayerMode === opt.id;
                    const defaultGrad =
                      idx === 0
                        ? 'bg-gradient-to-b from-sky-400 via-blue-500 to-blue-600 border-t-2 border-sky-200 border-x border-sky-400 border-b-[7px] border-b-blue-800 shadow-[0_10px_24px_rgba(37,99,235,0.32)] -translate-y-0.5 text-white'
                        : 'bg-gradient-to-b from-red-500 via-rose-500 to-red-600 border-t-2 border-red-200 border-x border-red-400 border-b-[7px] border-b-red-900 shadow-[0_10px_24px_rgba(239,68,68,0.32)] -translate-y-0.5 text-white';

                    return (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => onSelectPlayerMode && onSelectPlayerMode(opt.id)}
                        className={`group relative overflow-hidden rounded-3xl p-4 sm:p-5 transition-all duration-200 cursor-pointer flex items-center justify-center gap-3 ${
                          isSelected
                            ? opt.activeGradient || defaultGrad
                            : 'bg-slate-50 border-2 border-sky-200 border-b-[7px] border-b-sky-300 hover:bg-white text-slate-900'
                        }`}
                      >
                        {opt.icon && <span className="text-2xl sm:text-3xl shrink-0">{opt.icon}</span>}
                        <span className="text-lg sm:text-2xl font-black tracking-tight uppercase whitespace-nowrap">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {playerNames && playerNames.length > 0 && (
                <div
                  className={`grid gap-3 ${
                    playerNames.length === 1
                      ? 'grid-cols-1'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {playerNames.map((field, idx) => {
                    const schemeKey =
                      field.colorScheme ||
                      (['blue', 'red', 'emerald', 'amber'][idx % 4] as keyof typeof COLOR_SCHEMES);
                    const scheme = COLOR_SCHEMES[schemeKey];
                    return (
                      <div
                        key={field.id}
                        className={`flex items-center gap-3 p-2.5 rounded-2xl border-2 border-b-4 ${scheme.wrap}`}
                      >
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-b ${scheme.badge} border-b-2 text-white flex items-center justify-center font-black text-sm sm:text-base shadow shrink-0`}
                        >
                          {field.badge}
                        </div>
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-slate-900 font-black placeholder-slate-400 outline-none text-lg px-1"
                          placeholder={field.placeholder}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 2. PLUGGABLE GAME-SPECIFIC RULES SLOT */}
          {children}

          {/* 3. OPTIONAL MATCH TIMER SELECTOR */}
          {typeof timerValue === 'number' && onTimerChange && (
            <div className="p-4 rounded-3xl bg-emerald-50/90 border-2 border-emerald-200 border-b-4 border-b-emerald-300 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-950">
                  {timerTitle}
                </span>
                <span className="px-3 py-0.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-black font-mono tabular-nums">
                  {timerLabelDisplay || formatSec(timerValue)}
                </span>
              </div>

              <div
                className={`grid gap-2 ${
                  timerOptions.length === 3
                    ? 'grid-cols-3'
                    : timerOptions.length === 4
                    ? 'grid-cols-4'
                    : 'grid-cols-5'
                }`}
              >
                {timerOptions.map(tm => {
                  const isSel = timerValue === tm.sec;
                  return (
                    <button
                      key={tm.sec}
                      type="button"
                      onClick={() => onTimerChange(tm.sec)}
                      className={`py-3 rounded-2xl font-black text-sm sm:text-base border-2 border-b-[5px] transition cursor-pointer tabular-nums ${
                        isSel
                          ? 'bg-emerald-500 border-emerald-300 border-b-emerald-800 text-white shadow-sm -translate-y-0.5'
                          : 'bg-white hover:bg-emerald-100/70 border-emerald-200 border-b-emerald-300 text-emerald-950'
                      }`}
                    >
                      {tm.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. BOTTOM ACTION BAR: START GAME + OPTIONAL STUDY MODE */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 pt-1">
            <button
              type="button"
              onClick={onStart}
              disabled={startDisabled}
              className={`${
                onStudy ? 'sm:col-span-8' : 'sm:col-span-12'
              } py-4.5 bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-50 text-white font-black text-2xl sm:text-3xl rounded-2xl border-t-2 border-emerald-200 border-b-[8px] border-b-emerald-800 shadow-[0_14px_30px_rgba(16,185,129,0.35)] active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-3 tracking-wide uppercase`}
            >
              <Play size={28} fill="currentColor" className="drop-shadow shrink-0" />
              <span>{startLabel}</span>
            </button>

            {onStudy && (
              <button
                type="button"
                onClick={onStudy}
                className="sm:col-span-4 py-4.5 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-black text-xl sm:text-2xl rounded-2xl border-t-2 border-white border-b-[8px] border-b-orange-600 shadow-lg active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-2.5 uppercase"
              >
                <span>📖</span>
                <span>{studyLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
