import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Camera, VideoOff, RefreshCw, Volume2, VolumeX, Maximize, Minimize,
    X, AlertTriangle, Shield, Play, Pause, RotateCcw, Crosshair, Users,
    Sparkles, Skull, Check, ChevronRight, Settings, Sliders
} from 'lucide-react';
import { getPlayerNumber, playSquidGameYouTubeAudio, pauseSquidGameYouTubeAudio, stopSquidGameYouTubeAudio } from '../views/SquidGamePicker';

interface RedLightCameraModeProps {
    students: string[];
    pickCount: number;
    onClose: () => void;
    onPickComplete?: (picked: string[]) => void;
    initialVolume?: number;
}

export const RedLightCameraMode: React.FC<RedLightCameraModeProps> = ({
    students,
    pickCount,
    onClose,
    onPickComplete,
    initialVolume = 80
}) => {
    // Camera state
    const [hasCamera, setHasCamera] = useState<boolean | null>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [isMirrored, setIsMirrored] = useState(true);
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
    
    // Game loop state
    const [gamePhase, setGamePhase] = useState<'IDLE' | 'GREEN_LIGHT' | 'TURNING' | 'RED_LIGHT' | 'ELIMINATING' | 'ROUND_OVER'>('IDLE');
    const [cycleCount, setCycleCount] = useState(0);
    const [motionLevel, setMotionLevel] = useState(0);
    const [motionThreshold, setMotionThreshold] = useState(14); // 14% motion threshold
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(initialVolume);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [chantSpeed, setChantSpeed] = useState<'normal' | 'fast' | 'random'>('normal');
    
    // Players / Roster state
    const [activeStudents, setActiveStudents] = useState<string[]>(() => [...students]);
    const [eliminatedStudents, setEliminatedStudents] = useState<string[]>([]);
    const [currentEliminated, setCurrentEliminated] = useState<string | null>(null);
    const [eliminationReason, setEliminationReason] = useState<string>('MOVED ON RED LIGHT');
    
    // Targeting visual coords
    const [targetPos, setTargetPos] = useState<{ x: number; y: number } | null>(null);
    const [isTargeting, setIsTargeting] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const motionCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const prevFrameRef = useRef<Uint8Array | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const gameLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const gamePhaseRef = useRef(gamePhase);

    useEffect(() => {
        gamePhaseRef.current = gamePhase;
    }, [gamePhase]);

    // Web Audio Sound Generator for authentic sound FX
    const getAudioContext = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const playTone = useCallback((freq: number, type: OscillatorType, duration: number, startVol = 0.3) => {
        if (isMuted || volume <= 0) return;
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const vol = (volume / 100) * startVol;
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio tone error', e);
        }
    }, [getAudioContext, isMuted, volume]);

    const playLaserSound = useCallback(() => {
        if (isMuted || volume <= 0) return;
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const vol = (volume / 100) * 0.45;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(1200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.35);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        } catch (e) {
            console.warn('Laser sound error', e);
        }
    }, [getAudioContext, isMuted, volume]);

    const playAlarmSound = useCallback(() => {
        if (isMuted || volume <= 0) return;
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const vol = (volume / 100) * 0.4;
            osc.type = 'square';
            osc.frequency.setValueAtTime(850, ctx.currentTime);
            osc.frequency.setValueAtTime(600, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.28);
        } catch (e) {
            console.warn('Alarm sound error', e);
        }
    }, [getAudioContext, isMuted, volume]);

    const playBoomSound = useCallback(() => {
        if (isMuted || volume <= 0) return;
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const vol = (volume / 100) * 0.6;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(vol, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
        } catch (e) {
            console.warn('Boom sound error', e);
        }
    }, [getAudioContext, isMuted, volume]);

    // Initialize Camera Stream
    const startCamera = useCallback(async (facing: 'user' | 'environment') => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            setCameraError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facing,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play().catch(e => console.warn("Video play err", e));
            }
            setHasCamera(true);
        } catch (err: any) {
            console.warn("Camera init failed:", err);
            setHasCamera(false);
            setCameraError(err.name === 'NotAllowedError' 
                ? 'Camera access denied. Please click the camera icon in your browser URL bar to allow camera access.'
                : 'Could not access camera. You can still play with manual doll picking or simulated motion!');
        }
    }, []);

    useEffect(() => {
        startCamera(facingMode);
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }
            stopSquidGameYouTubeAudio();
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
            if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
        };
    }, [facingMode, startCamera]);

    // Motion Detection Frame-Differencing Engine
    useEffect(() => {
        if (!hasCamera) return;

        const canvas = motionCanvasRef.current || document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 48;
        motionCanvasRef.current = canvas;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let isRunning = true;

        const checkMotion = () => {
            if (!isRunning) return;

            if (videoRef.current && videoRef.current.readyState >= 2 && ctx) {
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = frame.data;
                const totalPixels = canvas.width * canvas.height;
                const currentGray = new Uint8Array(totalPixels);

                for (let i = 0; i < totalPixels; i++) {
                    const idx = i * 4;
                    // Fast luminance
                    currentGray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
                }

                if (prevFrameRef.current) {
                    let diffPixels = 0;
                    let sumX = 0;
                    let sumY = 0;

                    for (let i = 0; i < totalPixels; i++) {
                        const diff = Math.abs(currentGray[i] - prevFrameRef.current[i]);
                        if (diff > 25) { // Sensitivity per-pixel threshold
                            diffPixels++;
                            const px = i % canvas.width;
                            const py = Math.floor(i / canvas.width);
                            sumX += px;
                            sumY += py;
                        }
                    }

                    const pct = Math.min(100, Math.round((diffPixels / (totalPixels * 0.25)) * 100));
                    setMotionLevel(pct);

                    if (diffPixels > 0) {
                        const avgX = (sumX / diffPixels) / canvas.width;
                        const avgY = (sumY / diffPixels) / canvas.height;
                        setTargetPos({ x: avgX, y: avgY });
                    }
                }

                prevFrameRef.current = currentGray;
            }

            animFrameRef.current = requestAnimationFrame(checkMotion);
        };

        animFrameRef.current = requestAnimationFrame(checkMotion);

        return () => {
            isRunning = false;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [hasCamera]);

    // Elimination Trigger: Dolls locks onto student
    const triggerEliminateStudent = useCallback((studentName?: string, reason = 'MOVED ON RED LIGHT') => {
        if (gamePhase === 'ELIMINATING' || gamePhase === 'ROUND_OVER') return;
        
        let victim = studentName;
        if (!victim) {
            const available = activeStudents.filter(s => !eliminatedStudents.includes(s));
            if (available.length === 0) return;
            const randIdx = Math.floor(Math.random() * available.length);
            victim = available[randIdx];
        }

        setIsTargeting(true);
        playAlarmSound();
        setTimeout(() => playLaserSound(), 200);
        setTimeout(() => playBoomSound(), 400);

        setCurrentEliminated(victim);
        setEliminationReason(reason);
        setGamePhase('ELIMINATING');

        const newEliminated = [...eliminatedStudents, victim];
        setEliminatedStudents(newEliminated);

        setTimeout(() => {
            setIsTargeting(false);
            if (newEliminated.length >= pickCount || newEliminated.length >= students.length) {
                // Target count reached!
                setGamePhase('ROUND_OVER');
                if (onPickComplete) {
                    onPickComplete(newEliminated);
                }
            } else {
                // Next cycle
                setGamePhase('IDLE');
                setCurrentEliminated(null);
            }
        }, 2800);
    }, [activeStudents, eliminatedStudents, gamePhase, onPickComplete, pickCount, playAlarmSound, playBoomSound, playLaserSound, students.length]);

    // Motion Trigger in Red Light
    useEffect(() => {
        if (gamePhase === 'RED_LIGHT') {
            if (motionLevel >= motionThreshold) {
                // Caught moving!
                triggerEliminateStudent(undefined, '❌ CAUGHT MOVING ON RED LIGHT!');
            }
        }
    }, [gamePhase, motionLevel, motionThreshold, triggerEliminateStudent]);

    // Main Game Loop
    const startGameCycle = useCallback(() => {
        if (gamePhase === 'ELIMINATING' || gamePhase === 'ROUND_OVER') return;

        setCycleCount(prev => prev + 1);
        setGamePhase('GREEN_LIGHT');
        setCurrentEliminated(null);

        // Green light chant audio
        playSquidGameYouTubeAudio(0, true);
        playTone(523, 'sine', 0.2, 0.4);

        // Chant duration
        let duration = 4600;
        if (chantSpeed === 'fast') duration = 3200;
        if (chantSpeed === 'random') duration = 2800 + Math.random() * 2600;

        gameLoopTimeoutRef.current = setTimeout(() => {
            // Turning phase
            pauseSquidGameYouTubeAudio();
            setGamePhase('TURNING');
            playTone(440, 'triangle', 0.3, 0.4);

            gameLoopTimeoutRef.current = setTimeout(() => {
                // Red light scan phase
                setGamePhase('RED_LIGHT');
                playTone(330, 'sawtooth', 0.4, 0.5);

                // Scan for 3 seconds
                gameLoopTimeoutRef.current = setTimeout(() => {
                    if (gamePhaseRef.current !== 'ELIMINATING' && gamePhaseRef.current !== 'ROUND_OVER') {
                        // Safe! Nobody was caught moving in this scan window
                        playTone(660, 'sine', 0.3, 0.4);
                        setGamePhase('IDLE');
                    }
                }, 3200);

            }, 800); // 800ms turn animation

        }, duration);

    }, [chantSpeed, gamePhase, playTone]);

    const stopGameCycle = useCallback(() => {
        pauseSquidGameYouTubeAudio();
        if (gameLoopTimeoutRef.current) clearTimeout(gameLoopTimeoutRef.current);
        setGamePhase('IDLE');
    }, []);

    const resetGame = useCallback(() => {
        stopGameCycle();
        setEliminatedStudents([]);
        setCurrentEliminated(null);
        setActiveStudents([...students]);
        setCycleCount(0);
        setGamePhase('IDLE');
    }, [stopGameCycle, students]);

    const toggleFullscreen = () => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
        }
    };

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden"
        >
            {/* Top Navigation HUD */}
            <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 z-30 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer"
                        title="Back to Red Light Menu"
                    >
                        <X className="w-4 h-4" />
                        <span className="hidden sm:inline">EXIT</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-rose-600/20 text-rose-400 border border-rose-500/30">
                            <Camera className="w-4 h-4" />
                        </span>
                        <div>
                            <div className="text-xs sm:text-sm font-black tracking-wider uppercase flex items-center gap-1.5">
                                <span>RED LIGHT • CAMERA MODE</span>
                                <span className="bg-rose-500/20 text-rose-400 text-[10px] px-1.5 py-0.5 rounded border border-rose-500/30">CLASSROOM</span>
                            </div>
                            <div className="text-[10px] sm:text-xs text-slate-400">The doll scans physical students for movement!</div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4">
                    {/* Targets to pick counter */}
                    <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1 rounded-xl border border-slate-700 text-xs sm:text-sm font-bold">
                        <span className="text-slate-400">Target Picks:</span>
                        <span className="text-rose-400 font-black">{eliminatedStudents.length} / {pickCount}</span>
                    </div>

                    {/* Camera switch / mirror */}
                    <button
                        onClick={() => setIsMirrored(prev => !prev)}
                        className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            isMirrored ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                        }`}
                        title="Toggle Mirror Video"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">{isMirrored ? 'Mirrored' : 'Normal'}</span>
                    </button>

                    {/* Facing mode */}
                    <button
                        onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                        title="Flip Front/Back Camera"
                    >
                        <Camera className="w-3.5 h-3.5" />
                    </button>

                    {/* Volume / Mute */}
                    <button
                        onClick={() => setIsMuted(prev => !prev)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                        title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
                    >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>

                    {/* Settings */}
                    <button
                        onClick={() => setShowSettings(prev => !prev)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                        title="Settings"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </button>

                    {/* Fullscreen */}
                    <button
                        onClick={toggleFullscreen}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="relative flex-1 flex flex-col md:flex-row bg-black overflow-hidden">
                {/* Left/Center: Video Feed & Doll Overlay */}
                <div className="relative flex-1 bg-slate-950 flex items-center justify-center overflow-hidden">
                    {/* Live Video Feed */}
                    {hasCamera ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover transition-transform ${isMirrored ? 'scale-x-[-1]' : ''}`}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
                            <VideoOff className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white mb-2">Camera Feed Inactive</h3>
                            <p className="text-xs text-slate-400 mb-4">{cameraError || 'Allow camera permission in browser to detect student motion.'}</p>
                            <button
                                onClick={() => startCamera(facingMode)}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-lg shadow-rose-600/30"
                            >
                                <RefreshCw className="w-4 h-4" /> Try Reconnecting Camera
                            </button>
                        </div>
                    )}

                    {/* Laser Scan Grid Overlay on Camera during Red Light */}
                    {gamePhase === 'RED_LIGHT' && (
                        <div className="absolute inset-0 pointer-events-none z-10">
                            {/* Scanning horizontal laser bar */}
                            <div className="w-full h-1 bg-red-500 shadow-[0_0_15px_#ff0000] animate-[scan_1.6s_ease-in-out_infinite] opacity-80" />
                            {/* Sci-fi HUD crosshair framing */}
                            <div className="absolute inset-4 sm:inset-8 border border-red-500/40 rounded-2xl pointer-events-none shadow-[inset_0_0_30px_rgba(239,68,68,0.2)]">
                                <div className="absolute top-2 left-2 text-[10px] font-mono text-red-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    OPTICAL MOTION SCANNER ENGAGED
                                </div>
                                <div className="absolute top-2 right-2 text-[10px] font-mono text-red-400">
                                    MOTION: {motionLevel}% / SENSITIVITY: {motionThreshold}%
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Target Lock Reticle (where motion or pick is happening) */}
                    {(isTargeting || (gamePhase === 'RED_LIGHT' && motionLevel > 8)) && targetPos && (
                        <div 
                            className="absolute pointer-events-none z-20 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                            style={{
                                left: `${(isMirrored ? (1 - targetPos.x) : targetPos.x) * 100}%`,
                                top: `${targetPos.y * 100}%`
                            }}
                        >
                            <div className="relative flex items-center justify-center">
                                <div className="w-24 h-24 border-2 border-red-500 rounded-full animate-ping opacity-75" />
                                <div className="absolute w-20 h-20 border-2 border-dashed border-red-400 rounded-full animate-spin" />
                                <Crosshair className="absolute w-12 h-12 text-red-500 drop-shadow-[0_0_12px_#ff0000]" />
                                <span className="absolute -bottom-6 bg-red-600 text-white font-black text-[10px] px-2 py-0.5 rounded shadow-lg uppercase tracking-wider whitespace-nowrap">
                                    TARGET LOCKED
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Animated Doll Visual Puppet */}
                    <div className="absolute top-3 left-3 sm:top-5 sm:left-5 z-20 pointer-events-auto flex flex-col items-center">
                        <div className="relative flex flex-col items-center bg-slate-900/85 backdrop-blur-md p-3 sm:p-4 rounded-2xl border-2 border-slate-700/80 shadow-2xl">
                            {/* Doll Head Container */}
                            <div className="relative w-20 h-24 sm:w-24 sm:h-28 flex items-center justify-center">
                                {/* Doll SVG Puppet with dynamic head rotation */}
                                <div 
                                    className={`relative w-full h-full transition-transform duration-700 ease-in-out ${
                                        gamePhase === 'GREEN_LIGHT' 
                                            ? 'scale-x-[-1] brightness-90 animate-pulse' 
                                            : gamePhase === 'TURNING'
                                            ? 'scale-x-[0.2] rotate-6' 
                                            : 'scale-x-100'
                                    }`}
                                >
                                    <svg viewBox="0 0 100 120" className="w-full h-full drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]">
                                        {/* Doll Body & Orange Dress */}
                                        <path d="M30 75 L70 75 L80 115 L20 115 Z" fill="#ea580c" stroke="#9a3412" strokeWidth="2" />
                                        <path d="M38 75 L62 75 L62 92 L38 92 Z" fill="#facc15" />
                                        {/* Doll Neck */}
                                        <rect x="44" y="65" width="12" height="12" fill="#ffd9c7" rx="3" />
                                        
                                        {/* Back of Head (Shown on Green Light) */}
                                        {gamePhase === 'GREEN_LIGHT' ? (
                                            <g>
                                                {/* Jet black hair back */}
                                                <circle cx="50" cy="42" r="26" fill="#18181b" />
                                                {/* Pigtails */}
                                                <ellipse cx="22" cy="50" rx="8" ry="16" fill="#18181b" transform="rotate(-15 22 50)" />
                                                <ellipse cx="78" cy="50" rx="8" ry="16" fill="#18181b" transform="rotate(15 78 50)" />
                                                {/* Pink Hair Clips */}
                                                <circle cx="28" cy="40" r="4" fill="#f43f5e" />
                                                <circle cx="72" cy="40" r="4" fill="#f43f5e" />
                                            </g>
                                        ) : (
                                            /* Front Face (Shown on Red Light & Turning) */
                                            <g>
                                                {/* Hair Base */}
                                                <circle cx="50" cy="42" r="26" fill="#18181b" />
                                                {/* Pigtails */}
                                                <ellipse cx="22" cy="50" rx="8" ry="16" fill="#18181b" transform="rotate(-15 22 50)" />
                                                <ellipse cx="78" cy="50" rx="8" ry="16" fill="#18181b" transform="rotate(15 78 50)" />
                                                <circle cx="28" cy="40" r="4" fill="#f43f5e" />
                                                <circle cx="72" cy="40" r="4" fill="#f43f5e" />
                                                
                                                {/* Face */}
                                                <ellipse cx="50" cy="46" rx="21" ry="20" fill="#ffd9c7" />
                                                
                                                {/* Hair Bangs */}
                                                <path d="M30 38 Q50 48 70 38 Q50 24 30 38 Z" fill="#18181b" />
                                                
                                                {/* Rosy Cheeks */}
                                                <circle cx="36" cy="53" r="4" fill="#f43f5e" opacity="0.45" />
                                                <circle cx="64" cy="53" r="4" fill="#f43f5e" opacity="0.45" />

                                                {/* Eyes (Glowing Crimson during Red Light) */}
                                                {gamePhase === 'RED_LIGHT' || gamePhase === 'ELIMINATING' ? (
                                                    <g>
                                                        <circle cx="40" cy="45" r="4.5" fill="#ff0000" className="animate-pulse" filter="drop-shadow(0 0 6px #ff0000)" />
                                                        <circle cx="60" cy="45" r="4.5" fill="#ff0000" className="animate-pulse" filter="drop-shadow(0 0 6px #ff0000)" />
                                                        <circle cx="40" cy="45" r="2" fill="#ffffff" />
                                                        <circle cx="60" cy="45" r="2" fill="#ffffff" />
                                                    </g>
                                                ) : (
                                                    <g>
                                                        <circle cx="40" cy="45" r="3.5" fill="#0f172a" />
                                                        <circle cx="60" cy="45" r="3.5" fill="#0f172a" />
                                                        <circle cx="41" cy="44" r="1.2" fill="#ffffff" />
                                                        <circle cx="61" cy="44" r="1.2" fill="#ffffff" />
                                                    </g>
                                                )}

                                                {/* Lips */}
                                                <path d="M46 56 Q50 59 54 56" stroke="#e11d48" strokeWidth="2" fill="none" strokeLinecap="round" />
                                            </g>
                                        )}
                                    </svg>
                                </div>
                            </div>

                            {/* Doll Status Label */}
                            <div className="mt-1 flex flex-col items-center">
                                <span className={`text-[11px] sm:text-xs font-black tracking-wider uppercase px-2 py-0.5 rounded-full border ${
                                    gamePhase === 'GREEN_LIGHT'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                                        : gamePhase === 'TURNING'
                                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 animate-ping'
                                        : gamePhase === 'RED_LIGHT'
                                        ? 'bg-red-500/30 text-red-400 border-red-500/50 shadow-[0_0_12px_#ef4444]'
                                        : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                    {gamePhase === 'GREEN_LIGHT' && '🟢 GREEN LIGHT'}
                                    {gamePhase === 'TURNING' && '🟡 FREEZE!'}
                                    {gamePhase === 'RED_LIGHT' && '🔴 RED LIGHT'}
                                    {gamePhase === 'ELIMINATING' && '💥 TARGET CAUGHT'}
                                    {gamePhase === 'IDLE' && '⚪ READY'}
                                    {gamePhase === 'ROUND_OVER' && '🏆 ROUND DONE'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Central Phase HUD Banner */}
                    <div className="absolute top-5 left-1/2 transform -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center text-center">
                        {gamePhase === 'GREEN_LIGHT' && (
                            <div className="bg-emerald-950/80 border-2 border-emerald-500/70 text-emerald-300 px-6 py-2.5 rounded-2xl shadow-[0_0_30px_rgba(16,185,129,0.5)] backdrop-blur animate-bounce">
                                <div className="text-xl sm:text-3xl font-black tracking-widest uppercase">
                                    GREEN LIGHT! MOVE!
                                </div>
                                <div className="text-[11px] sm:text-xs text-emerald-400 font-semibold tracking-wider">
                                    "Mugunghwa kkochi pieot seumnida..."
                                </div>
                            </div>
                        )}

                        {gamePhase === 'TURNING' && (
                            <div className="bg-amber-950/90 border-2 border-amber-500 text-amber-300 px-6 py-2.5 rounded-2xl shadow-[0_0_30px_rgba(245,158,11,0.6)] backdrop-blur scale-105 transition-all">
                                <div className="text-xl sm:text-3xl font-black tracking-widest uppercase flex items-center gap-2">
                                    <AlertTriangle className="w-6 h-6 text-amber-400 animate-spin" />
                                    TURNING... FREEZE!
                                </div>
                                <div className="text-[11px] sm:text-xs text-amber-300 font-bold tracking-wider">
                                    STOP ALL MOVEMENT IMMEDIATELY!
                                </div>
                            </div>
                        )}

                        {gamePhase === 'RED_LIGHT' && (
                            <div className="bg-red-950/90 border-2 border-red-500 text-red-300 px-6 py-2.5 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.7)] backdrop-blur animate-pulse">
                                <div className="text-xl sm:text-3xl font-black tracking-widest uppercase flex items-center gap-2">
                                    <Skull className="w-6 h-6 text-red-500" />
                                    RED LIGHT! DO NOT MOVE!
                                </div>
                                <div className="text-[11px] sm:text-xs text-red-400 font-bold tracking-wider">
                                    THE DOLL IS SCANNING THE ROOM...
                                </div>
                            </div>
                        )}

                        {gamePhase === 'IDLE' && (
                            <div className="bg-slate-900/80 border border-slate-700 text-slate-300 px-4 py-1.5 rounded-xl text-xs sm:text-sm font-bold backdrop-blur">
                                PRESS "START CHANT" TO BEGIN GAME
                            </div>
                        )}
                    </div>

                    {/* Bottom Floating Control Bar on Video */}
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 flex items-center gap-2 sm:gap-3 pointer-events-auto bg-slate-950/85 backdrop-blur-md px-3 sm:px-5 py-2.5 rounded-2xl border border-slate-700/80 shadow-2xl">
                        {gamePhase === 'IDLE' ? (
                            <button
                                onClick={startGameCycle}
                                className="px-6 py-2.5 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-black text-sm sm:text-base tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 hover:scale-105"
                            >
                                <Play className="w-5 h-5 fill-current" />
                                START CHANT
                            </button>
                        ) : (
                            <button
                                onClick={stopGameCycle}
                                className="px-5 py-2.5 sm:py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-600 rounded-xl font-bold text-xs sm:text-sm tracking-wider transition cursor-pointer flex items-center gap-2"
                            >
                                <Pause className="w-4 h-4" />
                                PAUSE CHANT
                            </button>
                        )}

                        {/* Force Red Light / Freeze Instant Button (Teacher delight!) */}
                        <button
                            onClick={() => {
                                pauseSquidGameYouTubeAudio();
                                setGamePhase('TURNING');
                                playTone(440, 'triangle', 0.3, 0.4);
                                setTimeout(() => {
                                    setGamePhase('RED_LIGHT');
                                    playTone(330, 'sawtooth', 0.4, 0.5);
                                    setTimeout(() => {
                                        if (gamePhaseRef.current !== 'ELIMINATING' && gamePhaseRef.current !== 'ROUND_OVER') {
                                            setGamePhase('IDLE');
                                        }
                                    }, 3000);
                                }, 700);
                            }}
                            className="px-4 py-2.5 sm:py-3 bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center gap-1.5"
                            title="Instantly turn doll to test student freeze response"
                        >
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            <span className="hidden sm:inline">FREEZE NOW</span>
                        </button>

                        {/* Doll Target Student Pick Button */}
                        <button
                            onClick={() => triggerEliminateStudent(undefined, 'TARGETED BY THE DOLL')}
                            className="px-4 py-2.5 sm:py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs sm:text-sm tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-rose-600/20 active:scale-95"
                            title="Doll locks onto and picks a student"
                        >
                            <Crosshair className="w-4 h-4" />
                            <span>DOLL PICK</span>
                        </button>

                        {/* Reset button */}
                        <button
                            onClick={resetGame}
                            className="p-2.5 sm:p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition cursor-pointer"
                            title="Reset Game & Roster"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Live Motion Detector Meter on Video */}
                    <div className="absolute bottom-4 right-4 z-20 pointer-events-none hidden lg:flex flex-col gap-1 bg-slate-900/85 backdrop-blur px-3 py-2 rounded-xl border border-slate-700/80 text-[10px]">
                        <div className="flex justify-between items-center text-slate-300 font-bold gap-3">
                            <span className="flex items-center gap-1">
                                <Sliders className="w-3 h-3 text-cyan-400" />
                                MOTION DETECTOR
                            </span>
                            <span className={motionLevel >= motionThreshold ? 'text-red-400 font-black' : 'text-emerald-400'}>
                                {motionLevel}% / {motionThreshold}%
                            </span>
                        </div>
                        <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                            <div 
                                className={`h-full transition-all duration-75 ${
                                    motionLevel >= motionThreshold ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, (motionLevel / Math.max(1, motionThreshold * 1.5)) * 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Right Panel: Student Roster HUD & Activity */}
                <div className="w-full md:w-80 lg:w-96 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 flex flex-col shrink-0 z-20 max-h-[35vh] md:max-h-full">
                    {/* Header */}
                    <div className="p-3 sm:p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/40">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-rose-400" />
                            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                                Student Roster ({students.length})
                            </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                            Alive: {students.length - eliminatedStudents.length}
                        </span>
                    </div>

                    {/* Student List */}
                    <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 custom-scrollbar">
                        {students.map((studentName, idx) => {
                            const isEliminated = eliminatedStudents.includes(studentName);
                            const playerNum = getPlayerNumber(studentName);
                            const isCurrentlyTarget = currentEliminated === studentName;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => {
                                        if (!isEliminated) {
                                            triggerEliminateStudent(studentName, 'TEACHER FLAGGED MOTION');
                                        }
                                    }}
                                    className={`flex items-center justify-between p-2 sm:p-2.5 rounded-xl border text-xs transition cursor-pointer ${
                                        isCurrentlyTarget
                                            ? 'bg-red-600/30 border-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse'
                                            : isEliminated
                                            ? 'bg-slate-950/60 border-slate-800 text-slate-500 opacity-60'
                                            : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-700/80 hover:border-slate-600'
                                    }`}
                                    title={isEliminated ? 'Eliminated' : 'Click to pick/eliminate this student'}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className={`text-[10px] font-black font-mono px-1.5 py-0.5 rounded border ${
                                            isEliminated 
                                                ? 'bg-slate-900 border-slate-800 text-slate-600' 
                                                : 'bg-rose-950 border-rose-500/40 text-rose-400'
                                        }`}>
                                            #{playerNum.padStart(3, '0')}
                                        </span>
                                        <span className={`font-bold truncate ${isEliminated ? 'line-through text-slate-500' : 'text-white'}`}>
                                            {studentName}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {isEliminated ? (
                                            <span className="flex items-center gap-1 text-[10px] text-red-400 font-bold bg-red-950/60 px-2 py-0.5 rounded border border-red-500/30">
                                                <Skull className="w-3 h-3 text-red-400" />
                                                PICKED
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                                                <Shield className="w-3 h-3 text-emerald-400" />
                                                SAFE
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Quick Info bar */}
                    <div className="p-3 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Click student name to flag manually</span>
                        <span className="text-rose-400 font-semibold">{eliminatedStudents.length} Picked</span>
                    </div>
                </div>
            </div>

            {/* Target Picked Dramatic Modal / Banner */}
            {gamePhase === 'ELIMINATING' && currentEliminated && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-red-950 border-4 border-red-600 rounded-3xl p-6 sm:p-10 max-w-md w-full text-center shadow-[0_0_60px_rgba(239,68,68,0.7)] flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-red-600/20 border-2 border-red-500 flex items-center justify-center mb-4 animate-pulse">
                            <Skull className="w-10 h-10 text-red-500" />
                        </div>
                        <div className="text-xs sm:text-sm font-black uppercase tracking-widest text-red-400 mb-1">
                            {eliminationReason}
                        </div>
                        <div className="text-2xl sm:text-4xl font-black text-white mb-2" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                            {currentEliminated}
                        </div>
                        <div className="text-sm font-mono font-bold text-slate-400 bg-slate-800 px-3 py-1 rounded-xl border border-slate-700 mb-4">
                            PLAYER #{getPlayerNumber(currentEliminated).padStart(3, '0')}
                        </div>
                        <div className="text-xs text-red-300 font-semibold tracking-wide">
                            LOCKED ON BY THE SQUID GAME DOLL
                        </div>
                    </div>
                </div>
            )}

            {/* Round Over / Final Target Ceremony Modal */}
            {gamePhase === 'ROUND_OVER' && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in zoom-in-95 duration-200">
                    <div className="bg-slate-900 border-4 border-rose-500 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center shadow-[0_0_60px_rgba(244,63,94,0.6)] flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-400 flex items-center justify-center mb-3">
                            <Sparkles className="w-8 h-8 text-rose-400" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1" style={{ fontFamily: "'Fredoka', sans-serif" }}>
                            {eliminatedStudents.length === 1 ? 'STUDENT PICKED BY DOLL' : `${eliminatedStudents.length} STUDENTS PICKED`}
                        </h2>
                        <p className="text-xs text-rose-400 font-bold uppercase tracking-wider mb-5">
                            Camera Mode Session Complete!
                        </p>

                        {/* List of picked students */}
                        <div className="w-full max-h-56 overflow-y-auto space-y-2 mb-6 custom-scrollbar">
                            {eliminatedStudents.map((name, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/90 border border-rose-500/40 text-left">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono font-black text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-500/30">
                                            #{getPlayerNumber(name).padStart(3, '0')}
                                        </span>
                                        <span className="text-base font-bold text-white">{name}</span>
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-rose-300 bg-rose-500/20 px-2.5 py-1 rounded-lg">
                                        TARGET #{i + 1}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <button
                                onClick={resetGame}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-sm tracking-wide transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30"
                            >
                                <RotateCcw className="w-4 h-4" /> PLAY AGAIN
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-sm tracking-wide border border-slate-700 transition cursor-pointer"
                            >
                                BACK TO MENU
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Overlay Drawer */}
            {showSettings && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
                    <div className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between h-full shadow-2xl">
                        <div>
                            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                                <h3 className="text-lg font-black text-white flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-rose-400" />
                                    Camera Mode Settings
                                </h3>
                                <button 
                                    onClick={() => setShowSettings(false)}
                                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Motion Sensitivity */}
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-300">Motion Sensitivity:</span>
                                    <span className="text-rose-400 font-mono">{motionThreshold}% ({motionThreshold <= 10 ? 'High' : motionThreshold <= 16 ? 'Normal' : 'Low'})</span>
                                </div>
                                <input
                                    type="range"
                                    min="6"
                                    max="30"
                                    value={motionThreshold}
                                    onChange={(e) => setMotionThreshold(parseInt(e.target.value))}
                                    className="w-full accent-rose-600 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                    <span>High Sensitivity (6%)</span>
                                    <span>Low Sensitivity (30%)</span>
                                </div>
                            </div>

                            {/* Chant Speed */}
                            <div className="space-y-2 mb-6">
                                <span className="text-xs font-bold text-slate-300">Doll Chant Speed:</span>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['normal', 'fast', 'random'] as const).map(speed => (
                                        <button
                                            key={speed}
                                            onClick={() => setChantSpeed(speed)}
                                            className={`py-2 px-2.5 rounded-xl text-xs font-bold border capitalize transition ${
                                                chantSpeed === speed
                                                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/30'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                                            }`}
                                        >
                                            {speed}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Sound Volume */}
                            <div className="space-y-2 mb-6">
                                <div className="flex justify-between items-center text-xs font-bold">
                                    <span className="text-slate-300">Sound Volume:</span>
                                    <span className="text-amber-400">{volume}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={volume}
                                    onChange={(e) => setVolume(parseInt(e.target.value))}
                                    className="w-full accent-amber-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSettings(false)}
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-700 transition"
                        >
                            CLOSE SETTINGS
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
