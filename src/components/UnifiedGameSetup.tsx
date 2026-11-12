import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Edit3, Play, Timer, Camera, RefreshCw } from 'lucide-react';
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

export interface ARCameraSetupConfig {
  label?: string;
  badgeText?: string;
  helperText?: string;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
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

  // 2b. Optional Built-in Unified AR Camera Preview Card
  arCameraConfig?: ARCameraSetupConfig;

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
    wrap: 'bg-blue-50/95 border-blue-200 border-b-blue-400',
    badge: 'from-blue-500 to-blue-700 border-blue-950'
  },
  red: {
    wrap: 'bg-red-50/95 border-red-200 border-b-red-400',
    badge: 'from-red-500 to-red-700 border-red-950'
  },
  emerald: {
    wrap: 'bg-emerald-50/95 border-emerald-200 border-b-emerald-400',
    badge: 'from-emerald-500 to-emerald-700 border-emerald-950'
  },
  amber: {
    wrap: 'bg-amber-50/95 border-amber-200 border-b-amber-400',
    badge: 'from-amber-500 to-amber-700 border-amber-950'
  },
  purple: {
    wrap: 'bg-purple-50/95 border-purple-200 border-b-purple-400',
    badge: 'from-purple-500 to-purple-700 border-purple-950'
  }
};

export const UnifiedARCameraPreviewCard: React.FC<{ config: ARCameraSetupConfig }> = ({ config }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);

  const isEnabled = config.enabled !== false;

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const retrieveCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    setCameraLoading(true);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch {
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  }, [stopStream]);

  useEffect(() => {
    if (isEnabled) {
      retrieveCamera();
    } else {
      stopStream();
    }
    return () => {
      stopStream();
    };
  }, [isEnabled, retrieveCamera, stopStream]);

  return (
    <div className="p-4 rounded-3xl bg-sky-50/95 border-2 border-sky-200 border-b-4 border-b-sky-300 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm sm:text-base font-black uppercase tracking-wider text-sky-950 flex items-center gap-1.5">
            <Camera size={18} className="text-sky-600 shrink-0" />
            <span>{config.label || 'AR CAMERA & MOTION TRACKER'}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              if (config.onToggleEnabled && !isEnabled) {
                config.onToggleEnabled(true);
              }
              retrieveCamera();
            }}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
              cameraActive
                ? 'bg-emerald-100 hover:bg-emerald-200 border-emerald-300 text-emerald-900'
                : 'bg-blue-600 hover:bg-blue-500 border-blue-700 text-white'
            }`}
            title="Retrieve or reconnect your webcam for AR tracking"
          >
            <RefreshCw size={12} className={cameraLoading ? 'animate-spin' : ''} />
            <span>{cameraActive ? 'Camera Ready (Refresh)' : 'Retrieve Camera'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {config.badgeText && (
            <span className="px-3 py-1 rounded-xl bg-sky-600 text-white text-xs font-black uppercase tracking-wide">
              {config.badgeText}
            </span>
          )}
          {typeof config.onToggleEnabled === 'function' && (
            <button
              type="button"
              onClick={() => config.onToggleEnabled!(!isEnabled)}
              className={`px-3 py-1 rounded-xl text-xs font-black transition cursor-pointer ${
                isEnabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {isEnabled ? 'CAMERA ON' : 'MOUSE ONLY'}
            </button>
          )}
        </div>
      </div>

      {isEnabled && (
        <div className="relative w-full h-32 sm:h-36 rounded-2xl overflow-hidden bg-slate-900 border-2 border-sky-300 shadow-inner flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-300 ${
              cameraActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center">
              <span className="text-xs font-bold text-sky-200">
                {cameraLoading
                  ? 'Connecting to webcam...'
                  : 'Click "Retrieve Camera" above to preview live AR tracking (or play with Mouse/Touch)'}
              </span>
              {!cameraLoading && (
                <button
                  type="button"
                  onClick={retrieveCamera}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-black shadow cursor-pointer"
                >
                  📷 Retrieve Camera Now
                </button>
              )}
            </div>
          )}
          {cameraActive && config.helperText && (
            <div className="absolute bottom-2 inset-x-3 bg-slate-950/65 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-xl text-center">
              {config.helperText}
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  arCameraConfig,
  children,
  timerValue,
  timerLabelDisplay,
  timerOptions = [
    { label: '1 Min', sec: 60 },
    { label: '2 Mins', sec: 120 },
    { label: '3 Mins', sec: 180 },
    { label: '5 Mins', sec: 300 },
    { label: '10 Mins', sec: 600 }
  ],
  onTimerChange,
  timerTitle = 'Timer (Minutes)',
  startLabel = 'START ARENA',
  onStart,
  startDisabled = false,
  onStudy,
  studyLabel = 'STUDY'
}) => {
  const currentMinutes = typeof timerValue === 'number' ? Math.max(1, Math.round(timerValue / 60)) : 3;
  const maxMinutes = Math.max(
    10,
    ...timerOptions.map((o) => Math.max(1, Math.round(o.sec / 60)))
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-3 sm:p-5 overflow-y-auto custom-scrollbar bg-gradient-to-b from-sky-200 via-sky-100 to-amber-50 select-none text-slate-900">
      {/* Ambient 3D Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-24 left-1/4 w-96 h-96 bg-white/80 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-amber-200/50 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[42rem] h-72 bg-emerald-200/45 rounded-full blur-3xl" />
      </div>

      {/* Single Clean Top Navigation Bar (Step 2 of Unified Flow) */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-2.5 z-20 flex-wrap gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
        >
          <ArrowLeft size={18} className="text-sky-600 shrink-0" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {topRightExtras}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 border-t border-amber-200 border-b-4 border-b-amber-600 text-slate-900 font-black text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>⚙️ Settings</span>
            </button>
          )}
          {onOpenGameSwitcher && (
            <button
              type="button"
              onClick={onOpenGameSwitcher}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-500 hover:bg-sky-400 border-t border-sky-200 border-b-4 border-b-sky-700 text-white font-black text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>🎮 Games</span>
            </button>
          )}
          {onOpenQuizEditor && (
            <button
              type="button"
              onClick={onOpenQuizEditor}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-sky-50 border-2 border-sky-200 border-b-4 border-b-sky-300 text-slate-900 font-black text-sm shadow-md active:translate-y-0.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Edit3 size={16} className="text-sky-600 shrink-0" />
              <span>Edit Questions{typeof questionCount === 'number' ? ` (${questionCount})` : ''}</span>
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
        {/* Hero Title */}
        <h2 className="text-3xl sm:text-5xl font-black text-sky-950 drop-shadow-[0_3px_0_rgba(255,255,255,1)] tracking-tight text-center mb-3.5 uppercase">
          {title}
        </h2>

        {/* Main Immersive Setup Card */}
        <div className="w-full bg-white/95 backdrop-blur-xl rounded-[2.2rem] border-2 border-sky-200 border-b-[8px] border-b-sky-300 p-4 sm:p-6 shadow-[0_20px_50px_rgba(14,165,233,0.18)] space-y-4">
          {/* 1. PLAYERS / TEAMS SELECTOR + BOLD NAME INPUTS */}
          {((playerModeOptions && playerModeOptions.length > 0) || (playerNames && playerNames.length > 0)) && (
            <div className="space-y-3">
              {playerModeOptions && playerModeOptions.length > 0 && (
                <div
                  className={`grid gap-3 ${
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
                        ? 'bg-gradient-to-b from-sky-400 via-blue-500 to-blue-600 border-t-2 border-sky-200 border-x border-sky-400 border-b-[6px] border-b-blue-800 shadow-[0_8px_20px_rgba(37,99,235,0.28)] -translate-y-0.5 text-white'
                        : 'bg-gradient-to-b from-red-500 via-rose-500 to-red-600 border-t-2 border-red-200 border-x border-red-400 border-b-[6px] border-b-red-900 shadow-[0_8px_20px_rgba(239,68,68,0.28)] -translate-y-0.5 text-white';

                    return (
                      <button
                        key={String(opt.id)}
                        type="button"
                        onClick={() => onSelectPlayerMode && onSelectPlayerMode(opt.id)}
                        className={`group relative overflow-hidden rounded-2xl p-3.5 sm:p-4 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2.5 ${
                          isSelected
                            ? opt.activeGradient || defaultGrad
                            : 'bg-slate-50 border-2 border-sky-200 border-b-[6px] border-b-sky-300 hover:bg-white text-slate-900'
                        }`}
                      >
                        {opt.icon && <span className="text-xl sm:text-2xl shrink-0">{opt.icon}</span>}
                        <span className="text-base sm:text-xl font-black tracking-tight uppercase whitespace-nowrap">
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
                        className={`flex items-center gap-3 p-2 rounded-2xl border-2 border-b-4 ${scheme.wrap}`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-b ${scheme.badge} border-b-2 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow shrink-0`}
                        >
                          {field.badge}
                        </div>
                        <input
                          type="text"
                          value={field.value}
                          onChange={e => field.onChange(e.target.value)}
                          className="flex-1 min-w-0 bg-transparent text-slate-900 font-black placeholder-slate-400 outline-none text-base sm:text-lg px-1"
                          placeholder={field.placeholder}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 1b. OPTIONAL BUILT-IN LIVE AR CAMERA TRACKER PREVIEW */}
          {arCameraConfig && <UnifiedARCameraPreviewCard config={arCameraConfig} />}

          {/* 2. PLUGGABLE GAME-SPECIFIC RULES SLOT */}
          {children}

          {/* 3. MATCH TIMER WITH SLIDER & "MINUTES" LABEL */}
          {typeof timerValue === 'number' && onTimerChange && (
            <div className="p-4 rounded-3xl bg-emerald-50/95 border-2 border-emerald-200 border-b-4 border-b-emerald-300 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                  <Timer size={18} className="text-emerald-600 shrink-0" />
                  <span>{timerTitle}</span>
                </span>
                <span className="px-3.5 py-1 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-black tabular-nums shadow-xs">
                  {timerLabelDisplay || `${currentMinutes} ${currentMinutes === 1 ? 'Minute' : 'Minutes'}`}
                </span>
              </div>

              {/* Interactive Minutes Slider */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-emerald-800 whitespace-nowrap">1 Min</span>
                  <input
                    type="range"
                    min={1}
                    max={maxMinutes}
                    step={1}
                    value={currentMinutes}
                    onChange={(e) => onTimerChange(Number(e.target.value) * 60)}
                    className="w-full h-2.5 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />
                  <span className="text-xs font-black text-emerald-800 whitespace-nowrap">{maxMinutes} Minutes</span>
                </div>
              </div>

              {/* Quick Minute Preset Buttons */}
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
                  const mins = Math.max(1, Math.round(tm.sec / 60));
                  return (
                    <button
                      key={tm.sec}
                      type="button"
                      onClick={() => onTimerChange(tm.sec)}
                      className={`py-2 rounded-xl font-black text-xs sm:text-sm border-2 border-b-4 transition cursor-pointer tabular-nums ${
                        isSel
                          ? 'bg-emerald-600 border-emerald-400 border-b-emerald-900 text-white shadow-sm -translate-y-0.5'
                          : 'bg-white hover:bg-emerald-100/70 border-emerald-200 border-b-emerald-300 text-emerald-950'
                      }`}
                    >
                      {mins} {mins === 1 ? 'Minute' : 'Minutes'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. BOTTOM ACTION BAR: START GAME + OPTIONAL STUDY MODE */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            <button
              type="button"
              onClick={onStart}
              disabled={startDisabled}
              className={`${
                onStudy ? 'sm:col-span-8' : 'sm:col-span-12'
              } py-4 bg-gradient-to-b from-emerald-400 via-green-500 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 disabled:opacity-50 text-white font-black text-xl sm:text-2xl rounded-2xl border-t-2 border-emerald-200 border-b-[7px] border-b-emerald-800 shadow-[0_12px_26px_rgba(16,185,129,0.32)] active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-3 tracking-wide uppercase`}
            >
              <Play size={26} fill="currentColor" className="drop-shadow shrink-0" />
              <span>{startLabel}</span>
            </button>

            {onStudy && (
              <button
                type="button"
                onClick={onStudy}
                className="sm:col-span-4 py-4 bg-gradient-to-b from-amber-300 via-amber-400 to-orange-400 hover:from-amber-200 hover:to-orange-300 text-slate-950 font-black text-lg sm:text-xl rounded-2xl border-t-2 border-white border-b-[7px] border-b-orange-600 shadow-lg active:translate-y-1 transition-all cursor-pointer flex items-center justify-center gap-2 uppercase"
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
