import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface CoconutBoatStageHandle {
    prepareRound: (roster: string[], targetsToPick: string[], durationSec: number) => void;
    beginSpin: () => void;
    startRound: (roster: string[], targetsToPick: string[], durationSec: number) => void;
    resetToIdle: (roster: string[]) => void;
    cycleCameraMode: () => 'side' | 'dynamic' | 'high';
    getHamsterAvatar: (name: string) => string;
}

interface CoconutBoatStageProps {
    students: string[];
    isMuted: boolean;
    volume: number; // 0..100
    canClickToSpin?: boolean;
    onStageClick?: () => void;
    onStateChange?: (state: {
        phase: string;
        msg: string;
        eliminatedThisRound: string[];
        activeCount: number;
        chaseSecondsLeft?: number;
        cameraMode?: 'side' | 'dynamic' | 'high';
        isMusicPlaying?: boolean;
    }) => void;
    onRoundComplete?: (eliminatedNames: string[]) => void;
}

const FUR_PALETTES = [
    { body: '#FFE5B4', belly: '#FFFDF9', ear: '#F4A261', shadow: '#D99B52', name: 'Cream' },
    { body: '#E8A86B', belly: '#FFF8EB', ear: '#B5651D', shadow: '#B87333', name: 'Golden' },
    { body: '#D4A373', belly: '#FEFAE0', ear: '#9C6644', shadow: '#9C6B3B', name: 'Cinnamon' },
    { body: '#FFFDF7', belly: '#FFFFFF', ear: '#FFB5A7', shadow: '#D8D2C5', name: 'Snowy' },
    { body: '#C2C5BB', belly: '#F4F5F0', ear: '#6B705C', shadow: '#8C9284', name: 'Silver' },
    { body: '#F6BD60', belly: '#FFF8E7', ear: '#E07A5F', shadow: '#C98A2C', name: 'Butterscotch' },
    { body: '#F2A6B3', belly: '#FFF0F3', ear: '#B56576', shadow: '#C46D7E', name: 'Strawberry' },
    { body: '#C8B6FF', belly: '#F8F7FF', ear: '#9D4EDD', shadow: '#9378E8', name: 'Lavender' },
    { body: '#A8DADC', belly: '#F1FAEE', ear: '#457B9D', shadow: '#6BA8AC', name: 'Minty' }
];

const VEST_COLORS = [
    { main: '#FF6B35', dark: '#C84B1C', stripe: '#FFE66D' },
    { main: '#EF233C', dark: '#B81428', stripe: '#FFFFFF' },
    { main: '#06D6A0', dark: '#049A72', stripe: '#FFF3B0' },
    { main: '#00BBF9', dark: '#0086B8', stripe: '#FFE66D' },
    { main: '#FFB703', dark: '#CC8E00', stripe: '#FFFFFF' },
    { main: '#F72585', dark: '#B5175E', stripe: '#90E0EF' }
];

const ACCESSORIES = [
    'pink_bow',
    'sunglasses',
    'sailor_hat',
    'headband',
    'flower',
    'propeller_cap',
    'straw_hat',
    'leaf_sprout'
];

const CHAOS_QUOTES = [
    "WHY IS IT GETTING FASTER?!",
    "CAPTAIN, SLOW DOWN!",
    "MY TAIL!!!",
    "THIS WAS NOT IN THE AGREEMENT!",
    "EVERY HAMSTER FOR THEMSELVES!",
    "I DROPPED MY SUNFLOWER SEED!",
    "HOLD ONTO YOUR LIFE VESTS!",
    "I'M GETTING DIZZY!! 🌀"
];

const LILY_PANIC_QUOTES = [
    "DON'T EAT ME!! 😱",
    "I'M JUST A LILY PAD! 🙈",
    "I TASTE TERRIBLE!! 🤢",
    "PICK SOMEONE ELSE! 👉",
    "MOMMY!! 😭",
    "RIBBIT! I'M A FROG! 🐸",
    "NOPE NOPE NOPE!! 💦",
    "MY SUNFLOWER SEEDS! 🌻"
];

const ESCAPE_QUOTES = [
    "TOO SLOW!! 😜",
    "NOT TODAY, CROC!! 💨",
    "HAHA! MISSED ME!! 🏃",
    "WHOA! CLOSE CALL!! 😅",
    "CAN'T CATCH ME!! ✨",
    "BOING!! BYE-BYE!! 🪷"
];

const RIM_COLORS = ['#EF233C', '#FFD166', '#00BBF9', '#06D6A0'];

class CoconutSoundEngine {
    ctx: AudioContext | null = null;
    sfxEnabled = true;
    volume = 0.8;
    musicTimer: number | null = null;
    melodyStep = 0;

    init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (AudioCtx) this.ctx = new AudioCtx();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    }

    setAudioConfig(muted: boolean, vol: number) {
        this.sfxEnabled = !muted && vol > 0;
        this.volume = Math.max(0, Math.min(1, vol / 100));
    }

    playPop(freq = 520) {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.7, now + 0.09);
        gain.gain.setValueAtTime(0.22 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playSqueak() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const base = 900 + Math.random() * 400;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.06);
        osc.frequency.exponentialRampToValueAtTime(base * 0.9, now + 0.13);
        gain.gain.setValueAtTime(0.16 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
    }

    playPaddleSplash(intensity = 1) {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.09);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 650 + intensity * 350;
        filter.Q.value = 1.8;

        const gain = this.ctx.createGain();
        gain.gain.value = Math.min(0.18, 0.07 + intensity * 0.05) * this.volume;

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }

    playFallWhistle() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1250, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.85);
        gain.gain.setValueAtTime(0.25 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.88);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.9);
    }

    playFakeoutWhistle() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1180, now);
        osc.frequency.exponentialRampToValueAtTime(360, now + 0.55);
        gain.gain.setValueAtTime(0.23 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.58);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playBoingSave() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.28);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.45);
        gain.gain.setValueAtTime(0.28 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.48);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playBigSplash() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.55);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);
        filter.frequency.exponentialRampToValueAtTime(280, now + 0.55);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.45 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }

    playLilyBounce() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Playful springy boing + cheerful marimba chime
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(760, now + 0.14);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
        osc.frequency.exponentialRampToValueAtTime(980, now + 0.36);
        gain.gain.setValueAtTime(0.26 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.39);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);

        // Sparkle confirmation note
        const chime = this.ctx.createOscillator();
        const chimeGain = this.ctx.createGain();
        chime.type = 'triangle';
        chime.frequency.setValueAtTime(1046.5, now + 0.12);
        chime.frequency.setValueAtTime(1318.5, now + 0.21);
        chimeGain.gain.setValueAtTime(0.16 * this.volume, now + 0.12);
        chimeGain.gain.exponentialRampToValueAtTime(0.005, now + 0.42);
        chime.connect(chimeGain);
        chimeGain.connect(this.ctx.destination);
        chime.start(now + 0.12);
        chime.stop(now + 0.44);
    }

    playCrocGrowl() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(115, now);
        osc.frequency.linearRampToValueAtTime(145, now + 0.14);
        osc.frequency.exponentialRampToValueAtTime(72, now + 0.42);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(420, now);

        gain.gain.setValueAtTime(0.22 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.45);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
    }

    playCrocChomp() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Snappy jaw-clap percussive thump
        const thump = this.ctx.createOscillator();
        const thumpGain = this.ctx.createGain();
        thump.type = 'triangle';
        thump.frequency.setValueAtTime(220, now);
        thump.frequency.exponentialRampToValueAtTime(48, now + 0.14);
        thumpGain.gain.setValueAtTime(0.55 * this.volume, now);
        thumpGain.gain.exponentialRampToValueAtTime(0.008, now + 0.18);
        thump.connect(thumpGain);
        thumpGain.connect(this.ctx.destination);
        thump.start(now);
        thump.stop(now + 0.2);

        // Crisp teeth-snap noise burst
        const snapSize = Math.floor(this.ctx.sampleRate * 0.12);
        const snapBuf = this.ctx.createBuffer(1, snapSize, this.ctx.sampleRate);
        const snapData = snapBuf.getChannelData(0);
        for (let i = 0; i < snapSize; i++) {
            snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapSize * 0.22));
        }
        const snapSrc = this.ctx.createBufferSource();
        snapSrc.buffer = snapBuf;
        const snapFilter = this.ctx.createBiquadFilter();
        snapFilter.type = 'bandpass';
        snapFilter.frequency.setValueAtTime(1600, now);
        snapFilter.Q.setValueAtTime(1.6, now);
        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.52 * this.volume, now);
        snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        snapSrc.connect(snapFilter);
        snapFilter.connect(snapGain);
        snapGain.connect(this.ctx.destination);
        snapSrc.start(now);

        // Water splash tail
        this.playBigSplash();
    }

    playCrocMissSnap() {
        if (!this.sfxEnabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Hollow comedic jaw clack on empty air
        const clack = this.ctx.createOscillator();
        const clackGain = this.ctx.createGain();
        clack.type = 'square';
        clack.frequency.setValueAtTime(340, now);
        clack.frequency.exponentialRampToValueAtTime(110, now + 0.08);
        clackGain.gain.setValueAtTime(0.26 * this.volume, now);
        clackGain.gain.exponentialRampToValueAtTime(0.008, now + 0.09);
        clack.connect(clackGain);
        clackGain.connect(this.ctx.destination);
        clack.start(now);
        clack.stop(now + 0.1);

        // Grumpy cartoon trombone grumble ("womp-grrr")
        const grump = this.ctx.createOscillator();
        const grumpGain = this.ctx.createGain();
        grump.type = 'sawtooth';
        grump.frequency.setValueAtTime(175, now + 0.12);
        grump.frequency.exponentialRampToValueAtTime(88, now + 0.48);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(380, now + 0.12);
        grumpGain.gain.setValueAtTime(0.18 * this.volume, now + 0.12);
        grumpGain.gain.exponentialRampToValueAtTime(0.008, now + 0.5);
        grump.connect(filter);
        filter.connect(grumpGain);
        grumpGain.connect(this.ctx.destination);
        grump.start(now + 0.12);
        grump.stop(now + 0.52);
    }

    startTropicalMusic() {
        // Background music is handled by the Coconut Boat YouTube music player (W16EsK4JCKM)
        this.stopTropicalMusic();
    }

    stopTropicalMusic() {
        if (this.musicTimer !== null) {
            clearInterval(this.musicTimer);
            this.musicTimer = null;
        }
    }
}

interface HamsterStudent {
    id: string;
    name: string;
    palette: typeof FUR_PALETTES[number];
    vest: typeof VEST_COLORS[number];
    accessory: string;
    eliminated: boolean;
    onLilyPadIndex: number | null;
    lilyLandTime: number;
    chompedByCroc: boolean;
    panicStyle: 'terrified' | 'hiding' | 'crying_funny';
    speechBubble: string;
    speechExpiry: number;
    relievedUntil: number;
    seatX: number;
    seatY: number;
    seatType: 'bench' | 'rim' | 'floor';
    ringIndex: number;
    curX: number;
    curY: number;
    boardDelay: number;
    boardProgress: number;
    bobOffset: number;
    eatingSeed: boolean;
    wobbleAngle: number;
    expression: 'happy' | 'excited' | 'dizzy' | 'shocked' | 'scream' | 'crown' | 'terrified' | 'hiding' | 'crying_funny' | 'relieved_smug';
    floatAngle: number;
    floatDist: number;
    tubeColor: string;
}

interface LotusPadState {
    xRatio: number;
    yRatio: number;
    r: number;
    rot: number;
    flower: string | null;
    bounce: number;
    bounceVel: number;
    ripple: number;
    occupantId: string | null;
}

interface FlyingHamster {
    hamster: HamsterStudent;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    t: number;
    delay: number;
    splashed: boolean;
    fromLilyPad?: boolean;
    trail: { x: number; y: number }[];
}

interface LilySafeFlight {
    hamster: HamsterStudent;
    padIndex: number;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    t: number;
    duration: number;
    isClimaxFlight: boolean;
    trail: { x: number; y: number }[];
}

interface EscapeJump {
    hamster: HamsterStudent;
    startX: number;
    startY: number;
    targetPadIndex: number | null; // null = leaps all the way back to the boat!
    targetX: number;
    targetY: number;
    t: number;
    duration: number;
    escapeQuote: string;
    trail: { x: number; y: number }[];
}

interface CrocodileState {
    phase: 'PATROL' | 'STALKING' | 'LILY_ROAM' | 'LILY_STALK' | 'LILY_LUNGE' | 'LILY_MISS_GRUMP' | 'SURFACING' | 'OPEN_JAWS' | 'CHOMP' | 'HAPPY_CHEW';
    initialized: boolean;
    x: number;
    y: number;
    angle: number;
    facingDir: number;
    patrolAngle: number;
    swimPhase: number;
    jawOpen: number;
    jawTarget: number;
    surfaceHeight: number;
    blinkTimer: number;
    isBlinking: boolean;
    teaseSnapTimer: number;
    chompImpact: number;
    chompTextTimer: number;
    chewTimer: number;
    targetX: number;
    targetY: number;
    caughtHamsters: HamsterStudent[];
    bubbleTimer: number;
    huntTargetPadIndex: number | null;
    huntTimer: number;
    huntEscapeTriggered: boolean;
    grumpTimer: number;
    petalOnNose: boolean;
    lastHuntedHamsterId: string;
    escapeCount: number;
}

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    size: number;
    color: string;
    life: number;
    maxLife: number;
    shape: 'circle' | 'rect';
}

interface NameTagItem {
    x: number;
    y: number;
    anchorX: number;
    anchorY: number;
    name: string;
    displayText?: string;
    isCaptain: boolean;
    accentColor?: string;
    priority?: 'normal' | 'captain' | 'spotlight';
    fontSize?: number;
    boxH?: number;
    paddingX?: number;
    maxWidth?: number;
}

interface BoatLayoutMetrics {
    cx: number;
    cy: number;
    baseRadius: number;
    boatScale: number;
    cameraScale: number;
    boatRadius: number;
    bowlDepth: number;
    usableRadius: number;
    hamRadius: number;
    captainRadius: number;
    hullSegments: number;
    radialRibs: number;
    weaveRings: number[];
    benchOffsets: number[];
    floatBaseRatio: number;
    floatStepPx: number;
    safeTop: number;
    safeBottom: number;
    safeLeft: number;
    safeRight: number;
    tagTier: {
        fontSize: number;
        boxH: number;
        paddingX: number;
        maxChars: number;
        maxWidth: number;
    };
}

const formatSmartTagName = (rawName: string, maxChars: number): string => {
    const clean = rawName.trim();
    if (clean.length <= maxChars) return clean;
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const first = parts[0];
        const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
        const compact = `${first} ${lastInitial}.`;
        if (compact.length <= maxChars + 1) return compact;
        if (first.length <= maxChars) return first;
    }
    return clean.slice(0, Math.max(3, maxChars - 1)).trimEnd() + '…';
};

const hashString = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (h << 5) - h + str.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
};

function drawCaptainHatAndPaddle(targetCtx: CanvasRenderingContext2D, r: number, captainPaddlePhase: number) {
    targetCtx.save();
    targetCtx.translate(0, -r * 0.72);

    // Red & Gold Captain Neckerchief
    targetCtx.fillStyle = '#EF233C';
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(0, r * 1.02, r * 0.68, r * 0.2, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Golden Captain Whistle on cord
    targetCtx.fillStyle = '#FFD166';
    targetCtx.beginPath();
    targetCtx.arc(0, r * 1.18, r * 0.13, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Detailed Vietnamese Conical Nón Lá Straw Hat
    const hatGrad = targetCtx.createLinearGradient(-r * 1.35, -r * 0.85, r * 1.35, r * 0.15);
    hatGrad.addColorStop(0, '#FFFDF5');
    hatGrad.addColorStop(0.45, '#F5DEB3');
    hatGrad.addColorStop(0.85, '#DEB887');
    hatGrad.addColorStop(1, '#B8860B');
    targetCtx.fillStyle = hatGrad;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = 2.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 1.38, r * 0.08);
    targetCtx.lineTo(0, -r * 0.88);
    targetCtx.lineTo(r * 1.38, r * 0.08);
    targetCtx.quadraticCurveTo(0, r * 0.34, -r * 1.38, r * 0.08);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    // Woven bamboo concentric rings on conical hat
    targetCtx.strokeStyle = 'rgba(92, 58, 33, 0.38)';
    targetCtx.lineWidth = 1.4;
    [0.25, 0.5, 0.75].forEach(t => {
        const hw = r * 1.38 * t;
        const hy = -r * 0.88 + (r * 0.96) * t;
        targetCtx.beginPath();
        targetCtx.moveTo(-hw, hy);
        targetCtx.quadraticCurveTo(0, hy + r * 0.18 * t, hw, hy);
        targetCtx.stroke();
    });

    targetCtx.restore();

    // Long Bamboo Oar / Paddle dipping into the lagoon water
    const strokeAngle = Math.sin(captainPaddlePhase) * 0.46;
    targetCtx.save();
    targetCtx.translate(r * 0.48, r * 0.25);
    targetCtx.rotate(0.52 + strokeAngle);

    // Bamboo shaft with nodes
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(7, r * 0.28);
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.95, -r * 0.42);
    targetCtx.lineTo(r * 2.15, r * 0.92);
    targetCtx.stroke();

    targetCtx.strokeStyle = '#E6C280';
    targetCtx.lineWidth = Math.max(4.5, r * 0.18);
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.95, -r * 0.42);
    targetCtx.lineTo(r * 2.15, r * 0.92);
    targetCtx.stroke();

    // Paddle blade
    const bladeGrad = targetCtx.createLinearGradient(r * 1.8, r * 0.7, r * 2.7, r * 1.2);
    bladeGrad.addColorStop(0, '#D4A373');
    bladeGrad.addColorStop(1, '#8D5B4C');
    targetCtx.fillStyle = bladeGrad;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = 2.2;
    targetCtx.beginPath();
    targetCtx.ellipse(r * 2.32, r * 1.0, r * 0.54, r * 0.24, 0.4, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Water foam splash on paddle blade
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    targetCtx.beginPath();
    targetCtx.arc(r * 2.52, r * 1.08, r * 0.22, 0, Math.PI * 2);
    targetCtx.arc(r * 2.12, r * 1.15, r * 0.16, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.restore();
}

function drawHamsterAccessory(targetCtx: CanvasRenderingContext2D, r: number, type: string, time = 0) {
    targetCtx.save();
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(1.8, r * 0.08);

    if (type === 'pink_bow') {
        targetCtx.translate(-r * 0.44, -r * 0.78);
        targetCtx.rotate(-0.18);
        targetCtx.fillStyle = '#FF4D6D';
        targetCtx.beginPath();
        targetCtx.ellipse(-r * 0.22, 0, r * 0.24, r * 0.15, -0.25, 0, Math.PI * 2);
        targetCtx.ellipse(r * 0.22, 0, r * 0.24, r * 0.15, 0.25, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#FF8FA3';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.11, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else if (type === 'sunglasses') {
        targetCtx.fillStyle = '#111827';
        targetCtx.beginPath();
        targetCtx.roundRect(-r * 0.66, -r * 0.30, r * 0.54, r * 0.32, r * 0.08);
        targetCtx.roundRect(r * 0.12, -r * 0.30, r * 0.54, r * 0.32, r * 0.08);
        targetCtx.fill();
        targetCtx.stroke();
        // Lens glare
        targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        targetCtx.lineWidth = Math.max(1.5, r * 0.06);
        targetCtx.beginPath();
        targetCtx.moveTo(-r * 0.54, -r * 0.22);
        targetCtx.lineTo(-r * 0.38, -r * 0.08);
        targetCtx.moveTo(r * 0.24, -r * 0.22);
        targetCtx.lineTo(r * 0.40, -r * 0.08);
        targetCtx.stroke();
        // Gold bridge
        targetCtx.strokeStyle = '#FFD166';
        targetCtx.lineWidth = Math.max(2, r * 0.08);
        targetCtx.beginPath();
        targetCtx.moveTo(-r * 0.12, -r * 0.18);
        targetCtx.lineTo(r * 0.12, -r * 0.18);
        targetCtx.stroke();
    } else if (type === 'sailor_hat') {
        targetCtx.translate(0, -r * 0.86);
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.46, Math.PI, 0);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#1D4ED8';
        targetCtx.fillRect(-r * 0.46, -r * 0.14, r * 0.92, r * 0.14);
        targetCtx.strokeRect(-r * 0.46, -r * 0.14, r * 0.92, r * 0.14);
        // Tiny gold anchor dot
        targetCtx.fillStyle = '#FFD166';
        targetCtx.beginPath();
        targetCtx.arc(0, -r * 0.28, r * 0.07, 0, Math.PI * 2);
        targetCtx.fill();
    } else if (type === 'headband') {
        targetCtx.fillStyle = '#EF233C';
        targetCtx.beginPath();
        targetCtx.roundRect(-r * 0.82, -r * 0.56, r * 1.64, r * 0.20, r * 0.08);
        targetCtx.fill();
        targetCtx.stroke();
        // White center stripe
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.fillRect(-r * 0.78, -r * 0.48, r * 1.56, r * 0.05);
    } else if (type === 'flower') {
        targetCtx.translate(r * 0.46, -r * 0.76);
        targetCtx.fillStyle = '#FF5D8F';
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            targetCtx.beginPath();
            targetCtx.arc(Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17, r * 0.13, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.stroke();
        }
        targetCtx.fillStyle = '#FFD166';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.10, 0, Math.PI * 2);
        targetCtx.fill();
    } else if (type === 'propeller_cap') {
        targetCtx.translate(0, -r * 0.84);
        targetCtx.fillStyle = '#06D6A0';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.45, Math.PI, 0);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#FFD166';
        targetCtx.beginPath();
        targetCtx.moveTo(0, -r * 0.45);
        targetCtx.lineTo(0, -r * 0.58);
        targetCtx.stroke();
        const spinW = Math.max(0.25, Math.abs(Math.cos(time * 14))) * r * 0.44;
        targetCtx.fillStyle = '#EF476F';
        targetCtx.beginPath();
        targetCtx.ellipse(0, -r * 0.58, spinW, r * 0.07, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else if (type === 'straw_hat') {
        targetCtx.translate(0, -r * 0.82);
        // Cute mini Nón Lá / sun straw hat
        targetCtx.fillStyle = '#F4D35E';
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, r * 0.84, r * 0.20, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(0, -r * 0.02, r * 0.46, Math.PI, 0);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#EF233C';
        targetCtx.fillRect(-r * 0.45, -r * 0.10, r * 0.90, r * 0.09);
    } else if (type === 'leaf_sprout') {
        targetCtx.translate(0, -r * 0.88);
        targetCtx.strokeStyle = '#2D6A4F';
        targetCtx.lineWidth = Math.max(2, r * 0.09);
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(0, -r * 0.22);
        targetCtx.stroke();
        targetCtx.fillStyle = '#52B788';
        targetCtx.strokeStyle = '#1B4332';
        targetCtx.lineWidth = 1.6;
        targetCtx.beginPath();
        targetCtx.ellipse(-r * 0.17, -r * 0.22, r * 0.20, r * 0.10, -0.4, 0, Math.PI * 2);
        targetCtx.ellipse(r * 0.17, -r * 0.22, r * 0.20, r * 0.10, 0.4, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    }

    targetCtx.restore();
}

function drawWinnerCrown(targetCtx: CanvasRenderingContext2D, r: number) {
    targetCtx.save();
    targetCtx.translate(0, -r * 1.05);
    targetCtx.fillStyle = '#FFD700';
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = 2.4;
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.48, 0);
    targetCtx.lineTo(-r * 0.55, -r * 0.45);
    targetCtx.lineTo(-r * 0.2, -r * 0.2);
    targetCtx.lineTo(0, -r * 0.55);
    targetCtx.lineTo(r * 0.2, -r * 0.2);
    targetCtx.lineTo(r * 0.55, -r * 0.45);
    targetCtx.lineTo(r * 0.48, 0);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
    targetCtx.restore();
}

function drawHamsterCharacter(
    targetCtx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    hamster: Partial<HamsterStudent>,
    time: number,
    isCaptain = false,
    captainPaddlePhase = 0,
    isIdleState = false
) {
    targetCtx.save();
    targetCtx.translate(x, y);

    const wobble = hamster.wobbleAngle || 0;
    targetCtx.rotate(wobble);

    const palette = hamster.palette || FUR_PALETTES[0];
    const vest = isCaptain
        ? { main: '#D90429', dark: '#9B001A', stripe: '#FFD166' }
        : (hamster.vest || VEST_COLORS[0]);
    const furColor = isCaptain ? '#E08E45' : palette.body;
    const bellyColor = isCaptain ? '#FFF8E7' : palette.belly;
    const earInner = isCaptain ? '#F4A261' : palette.ear;
    const furShadow = isCaptain ? '#A85D1E' : palette.shadow;

    // Soft ambient contact shadow under torso
    targetCtx.fillStyle = 'rgba(28, 16, 8, 0.28)';
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 1.05, radius * 0.92, radius * 0.36, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // Puffy life-vest neck float collar behind head
    targetCtx.fillStyle = vest.main;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(2, radius * 0.09);
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 0.32, radius * 0.96, radius * 0.42, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Upper Torso & Colorful Life Vest
    const vestGrad = targetCtx.createLinearGradient(-radius * 0.85, radius * 0.25, radius * 0.85, radius * 1.05);
    vestGrad.addColorStop(0, vest.main);
    vestGrad.addColorStop(0.7, vest.main);
    vestGrad.addColorStop(1, vest.dark);
    targetCtx.fillStyle = vestGrad;
    targetCtx.beginPath();
    targetCtx.roundRect(-radius * 0.82, radius * 0.26, radius * 1.64, radius * 0.78, radius * 0.38);
    targetCtx.fill();
    targetCtx.stroke();

    // Cream furry chest V-neck visible in center of life vest
    targetCtx.fillStyle = bellyColor;
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 0.56, radius * 0.28, radius * 0.36, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // Reflective safety stripes on life vest sides
    targetCtx.fillStyle = vest.stripe;
    targetCtx.fillRect(-radius * 0.72, radius * 0.46, radius * 0.34, radius * 0.13);
    targetCtx.fillRect(radius * 0.38, radius * 0.46, radius * 0.34, radius * 0.13);

    // Black life vest buckle strap across chest
    targetCtx.fillStyle = '#1F2937';
    targetCtx.fillRect(-radius * 0.68, radius * 0.70, radius * 1.36, radius * 0.13);
    targetCtx.fillStyle = '#9CA3AF';
    targetCtx.fillRect(-radius * 0.14, radius * 0.68, radius * 0.28, radius * 0.17);

    // Round 3D ears with dark outline and pink inner cup
    const earSpread = radius * 0.68;
    const earY = -radius * 0.64;
    [-1, 1].forEach(dir => {
        targetCtx.fillStyle = furColor;
        targetCtx.strokeStyle = '#3A1F0D';
        targetCtx.lineWidth = Math.max(2, radius * 0.10);
        targetCtx.beginPath();
        targetCtx.arc(dir * earSpread, earY, radius * 0.34, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.fillStyle = '#FFAEBC';
        targetCtx.beginPath();
        targetCtx.arc(dir * earSpread, earY, radius * 0.19, 0, Math.PI * 2);
        targetCtx.fill();
    });

    // Chubby 3D-shaded hamster head with cheeks
    const headGrad = targetCtx.createRadialGradient(-radius * 0.26, -radius * 0.34, radius * 0.08, 0, -radius * 0.05, radius * 1.05);
    headGrad.addColorStop(0, '#FFFFFF');
    headGrad.addColorStop(0.18, furColor);
    headGrad.addColorStop(0.78, furColor);
    headGrad.addColorStop(1, furShadow);
    targetCtx.fillStyle = headGrad;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(2.2, radius * 0.11);
    targetCtx.beginPath();
    targetCtx.ellipse(0, -radius * 0.06, radius * 0.95, radius * 0.82, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Cream lower muzzle / cheek patch
    targetCtx.fillStyle = bellyColor;
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 0.14, radius * 0.64, radius * 0.42, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // Fluffy top head fur tuft
    targetCtx.fillStyle = furColor;
    targetCtx.beginPath();
    targetCtx.moveTo(-radius * 0.16, -radius * 0.84);
    targetCtx.quadraticCurveTo(0, -radius * 1.08, radius * 0.06, -radius * 0.88);
    targetCtx.quadraticCurveTo(radius * 0.18, -radius * 1.04, radius * 0.18, -radius * 0.82);
    targetCtx.fill();
    targetCtx.stroke();

    // Rosy pink cheeks & crisp whiskers
    targetCtx.fillStyle = 'rgba(255, 92, 138, 0.72)';
    [-1, 1].forEach(dir => {
        targetCtx.beginPath();
        targetCtx.ellipse(dir * radius * 0.56, radius * 0.04, radius * 0.22, radius * 0.14, 0, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.strokeStyle = 'rgba(58, 31, 13, 0.72)';
        targetCtx.lineWidth = Math.max(1.2, radius * 0.055);
        targetCtx.beginPath();
        targetCtx.moveTo(dir * radius * 0.70, -radius * 0.01);
        targetCtx.lineTo(dir * radius * 1.08, -radius * 0.08);
        targetCtx.moveTo(dir * radius * 0.70, radius * 0.09);
        targetCtx.lineTo(dir * radius * 1.06, radius * 0.13);
        targetCtx.stroke();
    });

    // Expressive eyes
    const expr = isCaptain ? 'captain' : (hamster.expression || 'happy');
    const eyeX = radius * 0.35;
    const eyeY = -radius * 0.18;

    if (expr === 'dizzy') {
        targetCtx.strokeStyle = '#3A1F0D';
        targetCtx.lineWidth = Math.max(2, radius * 0.09);
        [-1, 1].forEach(dir => {
            targetCtx.save();
            targetCtx.translate(dir * eyeX, eyeY);
            targetCtx.rotate(time * 9 * dir);
            targetCtx.beginPath();
            targetCtx.arc(0, 0, radius * 0.18, 0, Math.PI * 1.55);
            targetCtx.stroke();
            targetCtx.restore();
        });
    } else if (expr === 'terrified') {
        // Huge bulging terrified eyes with tiny vibrating pupils + flying cartoon sweat drop!
        const jitterX = Math.sin(time * 58) * radius * 0.04;
        const jitterY = Math.cos(time * 64) * radius * 0.04;
        [-1, 1].forEach(dir => {
            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.strokeStyle = '#3A1F0D';
            targetCtx.lineWidth = Math.max(1.8, radius * 0.085);
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.27, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.stroke();

            targetCtx.fillStyle = '#1F1209';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX + jitterX, eyeY + jitterY, radius * 0.065, 0, Math.PI * 2);
            targetCtx.fill();
        });
        // Panic blue sweat drop flying off forehead
        const dropY = -radius * 0.56 + Math.sin(time * 14) * radius * 0.08;
        targetCtx.fillStyle = '#38BDF8';
        targetCtx.strokeStyle = '#0369A1';
        targetCtx.lineWidth = 1.4;
        targetCtx.beginPath();
        targetCtx.moveTo(radius * 0.62, dropY - radius * 0.18);
        targetCtx.quadraticCurveTo(radius * 0.78, dropY + radius * 0.06, radius * 0.62, dropY + radius * 0.14);
        targetCtx.quadraticCurveTo(radius * 0.46, dropY + radius * 0.06, radius * 0.62, dropY - radius * 0.18);
        targetCtx.fill();
        targetCtx.stroke();
    } else if (expr === 'crying_funny') {
        // Anime cartoon waterfall tears streaming out from "> <" squished eyes!
        const tearFlow = (time * 18) % 6;
        [-1, 1].forEach(dir => {
            // Curved cyan waterfall stream
            targetCtx.fillStyle = 'rgba(56, 189, 248, 0.85)';
            targetCtx.beginPath();
            targetCtx.moveTo(dir * (eyeX - radius * 0.06), eyeY + radius * 0.06);
            targetCtx.quadraticCurveTo(dir * (eyeX + radius * 0.22), eyeY + radius * 0.34, dir * (eyeX + radius * 0.12), eyeY + radius * 0.62);
            targetCtx.lineTo(dir * (eyeX - radius * 0.08), eyeY + radius * 0.58);
            targetCtx.quadraticCurveTo(dir * (eyeX + radius * 0.02), eyeY + radius * 0.30, dir * (eyeX - radius * 0.06), eyeY + radius * 0.06);
            targetCtx.fill();

            // Little animated splash droplets
            targetCtx.fillStyle = '#BAE6FD';
            targetCtx.beginPath();
            targetCtx.arc(dir * (eyeX + radius * 0.14), eyeY + radius * (0.28 + tearFlow * 0.055), radius * 0.075, 0, Math.PI * 2);
            targetCtx.fill();

            // Squished "> <" eyes
            targetCtx.strokeStyle = '#3A1F0D';
            targetCtx.lineWidth = Math.max(2.2, radius * 0.1);
            targetCtx.lineCap = 'round';
            targetCtx.beginPath();
            targetCtx.moveTo(dir * (eyeX + radius * 0.16), eyeY - radius * 0.12);
            targetCtx.lineTo(dir * (eyeX - radius * 0.06), eyeY);
            targetCtx.lineTo(dir * (eyeX + radius * 0.16), eyeY + radius * 0.12);
            targetCtx.stroke();
        });
    } else if (expr === 'relieved_smug') {
        // Joyful relieved "^ ^" closed curved eyes!
        targetCtx.strokeStyle = '#3A1F0D';
        targetCtx.lineWidth = Math.max(2.2, radius * 0.1);
        targetCtx.lineCap = 'round';
        [-1, 1].forEach(dir => {
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY + radius * 0.05, radius * 0.17, Math.PI * 1.15, Math.PI * 1.85);
            targetCtx.stroke();
        });
    } else if (expr === 'shocked' || expr === 'scream' || expr === 'hiding') {
        [-1, 1].forEach(dir => {
            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.strokeStyle = '#3A1F0D';
            targetCtx.lineWidth = Math.max(1.8, radius * 0.08);
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.23, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.stroke();

            targetCtx.fillStyle = '#1F1209';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.10, 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX - radius * 0.04, eyeY - radius * 0.04, radius * 0.04, 0, Math.PI * 2);
            targetCtx.fill();
        });
    } else {
        [-1, 1].forEach(dir => {
            targetCtx.fillStyle = '#1F1209';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.19, 0, Math.PI * 2);
            targetCtx.fill();

            // Dual anime eye catchlights
            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX - radius * 0.06, eyeY - radius * 0.06, radius * 0.075, 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX + radius * 0.05, eyeY + radius * 0.05, radius * 0.036, 0, Math.PI * 2);
            targetCtx.fill();
        });
    }

    // Cute 3D pink nose & expressive mouth
    targetCtx.fillStyle = '#FF5D8F';
    targetCtx.beginPath();
    targetCtx.ellipse(0, -radius * 0.03, radius * 0.11, radius * 0.075, 0, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(1.8, radius * 0.08);
    if (expr === 'terrified') {
        // Chattering zig-zag scared teeth box!
        const chatter = Math.sin(time * 48) * radius * 0.03;
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.beginPath();
        targetCtx.roundRect(-radius * 0.25, radius * 0.08 + chatter, radius * 0.50, radius * 0.22, radius * 0.08);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.moveTo(-radius * 0.22, radius * 0.19 + chatter);
        targetCtx.lineTo(radius * 0.22, radius * 0.19 + chatter);
        targetCtx.moveTo(-radius * 0.08, radius * 0.08 + chatter);
        targetCtx.lineTo(-radius * 0.08, radius * 0.30 + chatter);
        targetCtx.moveTo(radius * 0.08, radius * 0.08 + chatter);
        targetCtx.lineTo(radius * 0.08, radius * 0.30 + chatter);
        targetCtx.stroke();
    } else if (expr === 'scream' || expr === 'shocked' || expr === 'crying_funny') {
        targetCtx.fillStyle = '#D90429';
        targetCtx.beginPath();
        targetCtx.ellipse(0, radius * 0.16, radius * 0.18, radius * 0.22, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        // Little pink tongue inside mouth
        targetCtx.fillStyle = '#FF8FA3';
        targetCtx.beginPath();
        targetCtx.arc(0, radius * 0.24, radius * 0.09, 0, Math.PI, true);
        targetCtx.fill();
    } else if (expr === 'relieved_smug') {
        // Cheeky victorious smile with playful tongue sticking out!
        targetCtx.beginPath();
        targetCtx.arc(0, radius * 0.07, radius * 0.20, 0.1 * Math.PI, 0.9 * Math.PI);
        targetCtx.stroke();
        targetCtx.fillStyle = '#FF5D8F';
        targetCtx.beginPath();
        targetCtx.ellipse(radius * 0.08, radius * 0.22, radius * 0.11, radius * 0.14, 0.25, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else {
        // Cute cat/hamster 'w' smile with tiny buck tooth
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.fillRect(-radius * 0.05, radius * 0.06, radius * 0.10, radius * 0.09);
        targetCtx.beginPath();
        targetCtx.arc(-radius * 0.09, radius * 0.05, radius * 0.09, 0, Math.PI);
        targetCtx.arc(radius * 0.09, radius * 0.05, radius * 0.09, 0, Math.PI);
        targetCtx.stroke();
    }

    // Animated Paws (hiding over eyes, Home-Alone cheeks pose, frantic panic wave, or relaxed grip)
    const isPanic = expr === 'scream' || expr === 'shocked' || expr === 'dizzy' || expr === 'crying_funny';
    const pawWave = isPanic
        ? Math.sin(time * 24 + (hamster.bobOffset || 0)) * radius * 0.26
        : Math.sin(time * 4 + (hamster.bobOffset || 0)) * radius * 0.07;
    targetCtx.fillStyle = bellyColor;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(1.8, radius * 0.08);
    [-1, 1].forEach(dir => {
        let px = dir * radius * (isPanic ? 0.78 : 0.56);
        let py = isPanic ? (-radius * 0.12 + dir * pawWave) : (radius * 0.48 - Math.abs(pawWave));
        if (expr === 'terrified') {
            // Paws clutched tightly to cheeks in comical shock!
            px = dir * radius * 0.62;
            py = radius * 0.12 + Math.sin(time * 44) * radius * 0.05;
        } else if (expr === 'hiding') {
            // Both paws covering eyes while peeking nervously!
            px = dir * radius * 0.34;
            py = -radius * 0.12 + Math.sin(time * 16) * radius * 0.03;
        } else if (expr === 'relieved_smug') {
            // Celebratory waving paws!
            px = dir * radius * 0.76;
            py = -radius * 0.06 + Math.sin(time * 12 + dir) * radius * 0.14;
        }
        targetCtx.beginPath();
        targetCtx.arc(px, py, radius * 0.18, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    });

    if (!isCaptain && hamster.eatingSeed && isIdleState) {
        targetCtx.fillStyle = '#3D405B';
        targetCtx.strokeStyle = '#FFFFFF';
        targetCtx.lineWidth = 1.2;
        targetCtx.beginPath();
        targetCtx.ellipse(0, radius * 0.32, radius * 0.12, radius * 0.18, 0.3, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    }

    if (isCaptain) {
        drawCaptainHatAndPaddle(targetCtx, radius, captainPaddlePhase);
    } else {
        if (hamster.expression === 'crown') {
            drawWinnerCrown(targetCtx, radius);
        } else if (hamster.accessory) {
            drawHamsterAccessory(targetCtx, radius, hamster.accessory, time);
        }
    }

    targetCtx.restore();
}

export const CoconutBoatStage = forwardRef<CoconutBoatStageHandle, CoconutBoatStageProps>(({
    students,
    isMuted,
    volume,
    canClickToSpin = false,
    onStageClick,
    onStateChange,
    onRoundComplete
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const soundRef = useRef<CoconutSoundEngine>(new CoconutSoundEngine());

    const gameRef = useRef({
        state: 'IDLE' as 'IDLE' | 'READY' | 'SLOW_SPIN' | 'CHAOS_SPIN' | 'LILY_HUNT' | 'LAUNCHING' | 'RESULT',
        boatAngle: 0,
        boatSpeed: 0.28,
        boatRockPhase: 0,
        boatTiltRoll: 0,
        boatTiltPitch: 0,
        cameraMode: 'side' as 'side' | 'dynamic' | 'high',
        cameraPitch: 0.62,
        currentBoatScale: 1.0,
        currentCameraScale: 1.0,
        currentEliminatedMargin: 0,
        hasInitializedFraming: false,
        captainPaddlePhase: 0,
        phaseTimer: 0,
        roundDuration: 10.0,
        slowMoFactor: 1.0,
        screenShake: 0,
        students: [] as HamsterStudent[],
        targetsToEliminate: [] as string[],
        flyingHamsters: [] as FlyingHamster[],
        lilyFlights: [] as LilySafeFlight[],
        escapeJumps: [] as EscapeJump[],
        nextLilyFlightTime: 1.15,
        didClimaxLilyFlight: false,
        particles: [] as Particle[],
        quoteTimer: 0,
        activeBanner: '',
        bannerExpiry: 0,
        lastReportedSec: -1,
        crocodile: {
            phase: 'PATROL',
            initialized: false,
            x: 0,
            y: 0,
            angle: 0,
            facingDir: 1,
            patrolAngle: 0.9,
            swimPhase: 0,
            jawOpen: 0,
            jawTarget: 0,
            surfaceHeight: 0,
            blinkTimer: 2.2,
            isBlinking: false,
            teaseSnapTimer: 1.1,
            chompImpact: 0,
            chompTextTimer: 0,
            chewTimer: 0,
            targetX: 0,
            targetY: 0,
            caughtHamsters: [],
            bubbleTimer: 0.4,
            huntTargetPadIndex: null,
            huntTimer: 0,
            huntEscapeTriggered: false,
            grumpTimer: 0,
            petalOnNose: false,
            lastHuntedHamsterId: '',
            escapeCount: 0
        } as CrocodileState,
        lotusPads: [
            { xRatio: 0.08, yRatio: 0.43, r: 30, rot: 0.4, flower: '#FF758F', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.92, yRatio: 0.44, r: 32, rot: 2.1, flower: '#FFD166', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.13, yRatio: 0.61, r: 31, rot: 3.1, flower: '#FF8FA3', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.87, yRatio: 0.62, r: 30, rot: 1.5, flower: '#FFF8E7', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.09, yRatio: 0.79, r: 35, rot: 1.2, flower: '#FF4D6D', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.91, yRatio: 0.80, r: 34, rot: 3.8, flower: '#FF758F', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.22, yRatio: 0.88, r: 31, rot: 5.1, flower: '#FFD166', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null },
            { xRatio: 0.78, yRatio: 0.88, r: 31, rot: 2.7, flower: '#FF8FA3', bounce: 0, bounceVel: 0, ripple: 0, occupantId: null }
        ] as LotusPadState[],
        koiShadows: [
            { angle: 0.5, dist: 0.35, speed: 0.22, size: 17, color: 'rgba(255, 123, 37, 0.42)' },
            { angle: 2.6, dist: 0.41, speed: -0.18, size: 15, color: 'rgba(239, 35, 60, 0.36)' },
            { angle: 4.4, dist: 0.31, speed: 0.25, size: 18, color: 'rgba(255, 183, 3, 0.40)' },
            { angle: 1.5, dist: 0.38, speed: 0.19, size: 14, color: 'rgba(255, 123, 37, 0.38)' }
        ],
        bgBoats: [
            { xRatio: 0.15, yOffset: 24, phase: 0.5, color: '#00BBF9', umbrella: '#FFD166' },
            { xRatio: 0.84, yOffset: 28, phase: 2.4, color: '#06D6A0', umbrella: '#FF4D6D' }
        ],
        lanterns: [
            { xRatio: 0.05, yOffset: -28, color: '#EF233C', phase: 0.2 },
            { xRatio: 0.11, yOffset: -20, color: '#FFD166', phase: 1.1 },
            { xRatio: 0.17, yOffset: -24, color: '#06D6A0', phase: 2.0 },
            { xRatio: 0.83, yOffset: -24, color: '#F72585', phase: 0.7 },
            { xRatio: 0.89, yOffset: -20, color: '#FFD166', phase: 1.6 },
            { xRatio: 0.95, yOffset: -28, color: '#00BBF9', phase: 2.5 }
        ]
    });

    const onStateChangeRef = useRef(onStateChange);
    const onRoundCompleteRef = useRef(onRoundComplete);
    useEffect(() => {
        onStateChangeRef.current = onStateChange;
        onRoundCompleteRef.current = onRoundComplete;
    }, [onStateChange, onRoundComplete]);

    useEffect(() => {
        soundRef.current.setAudioConfig(isMuted, volume);
    }, [isMuted, volume]);

    const createHamsterFromName = (name: string, index: number): HamsterStudent => {
        const seed = hashString(name) + index * 7;
        const palette = FUR_PALETTES[seed % FUR_PALETTES.length];
        const vest = VEST_COLORS[(seed + index) % VEST_COLORS.length];
        const accessory = ACCESSORIES[seed % ACCESSORIES.length];
        const panicStyles: ('terrified' | 'hiding' | 'crying_funny')[] = ['terrified', 'crying_funny', 'hiding'];
        return {
            id: `ham_${index}_${name}`,
            name: name.trim(),
            palette,
            vest,
            accessory,
            eliminated: false,
            onLilyPadIndex: null,
            lilyLandTime: 0,
            chompedByCroc: false,
            panicStyle: panicStyles[seed % panicStyles.length],
            speechBubble: '',
            speechExpiry: 0,
            relievedUntil: 0,
            seatX: 0,
            seatY: 0,
            seatType: 'floor',
            ringIndex: 0,
            curX: 0,
            curY: 0,
            boardDelay: index * 0.05,
            boardProgress: 1,
            bobOffset: (seed % 100) * 0.06,
            eatingSeed: index % 4 === 0,
            wobbleAngle: 0,
            expression: 'happy',
            floatAngle: (index * 1.1) % (Math.PI * 2),
            floatDist: 1.48 + (index % 3) * 0.14,
            tubeColor: ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#F72585', '#FF924C'][seed % 6]
        };
    };

    // Spread student seats across the entire basket boat interior in adaptive concentric rings
    // scaled to class size while keeping Captain Coconut's bow helm spot at (0, -0.84) clear
    const arrangeHamstersInBoat = (snapPositions = true) => {
        const g = gameRef.current;
        const active = g.students.filter(s => !s.eliminated);
        const count = active.length;
        if (count === 0) return;

        if (count === 1) {
            active[0].seatX = 0;
            active[0].seatY = 0.06;
            active[0].seatType = 'bench';
            active[0].ringIndex = 0;
            if (snapPositions) {
                active[0].curX = active[0].seatX;
                active[0].curY = active[0].seatY;
            }
        } else if (count <= 6) {
            active.forEach((h, i) => {
                const t = (i + 0.5) / count;
                const ang = -Math.PI * 0.34 + t * Math.PI * 1.68;
                const r = count <= 3 ? 0.44 : (i % 2 === 0 ? 0.56 : 0.38);
                h.seatX = Math.cos(ang) * r;
                h.seatY = Math.sin(ang) * r;
                h.seatType = r > 0.45 ? 'rim' : 'bench';
                h.ringIndex = 0;
                if (snapPositions) {
                    h.curX = h.seatX;
                    h.curY = h.seatY;
                }
            });
        } else {
            // Adaptive multi-ring generator (2 to 7 rings) based on class size
            const numRings =
                count <= 12 ? 2 :
                count <= 22 ? 3 :
                count <= 36 ? 4 :
                count <= 54 ? 5 :
                Math.min(7, 5 + Math.ceil((count - 54) / 22));

            const useCenterSeat = count >= 26 && numRings >= 4;
            const ringSeatsTotal = useCenterSeat ? count - 1 : count;

            const innerR =
                numRings === 2 ? 0.33 :
                numRings === 3 ? 0.24 :
                numRings === 4 ? 0.20 :
                numRings === 5 ? 0.17 :
                0.15;
            const outerR =
                numRings <= 2 ? 0.74 :
                numRings === 3 ? 0.81 :
                numRings === 4 ? 0.85 :
                0.88;

            const rings: { radius: number; gapHalfRad: number; span: number; weight: number; seats: number }[] = [];
            for (let ri = 0; ri < numRings; ri++) {
                const frac = numRings === 1 ? 1 : ri / (numRings - 1);
                const radius = innerR + (outerR - innerR) * frac;
                // Reserve a clean bow helm arc around -PI/2 on outer rings so nobody hides behind Captain Coconut
                let gapHalfRad = 0;
                if (radius >= 0.72) {
                    gapHalfRad = Math.PI * 0.16;
                } else if (radius >= 0.56) {
                    gapHalfRad = Math.PI * 0.10;
                }
                const span = Math.PI * 2 - gapHalfRad * 2;
                const weight = radius * span;
                rings.push({ radius, gapHalfRad, span, weight, seats: 0 });
            }

            // Allocate seats across rings proportional to available circumference
            const totalWeight = rings.reduce((acc, r) => acc + r.weight, 0);
            let assigned = 0;
            const remainders: { idx: number; frac: number }[] = [];

            rings.forEach((ring, idx) => {
                const exact = (ring.weight / totalWeight) * ringSeatsTotal;
                const floorVal = Math.max(idx === 0 ? 3 : 4, Math.floor(exact));
                ring.seats = floorVal;
                assigned += floorVal;
                remainders.push({ idx, frac: exact - Math.floor(exact) });
            });

            // Trim if minimum floors slightly exceeded ringSeatsTotal
            while (assigned > ringSeatsTotal) {
                let bestIdx = 0;
                for (let ri = 1; ri < rings.length; ri++) {
                    if (rings[ri].seats > rings[bestIdx].seats) bestIdx = ri;
                }
                rings[bestIdx].seats--;
                assigned--;
            }

            // Distribute remaining seats to highest fractional remainders (outer-biased on ties)
            remainders.sort((a, b) => b.frac - a.frac || b.idx - a.idx);
            let remCursor = 0;
            while (assigned < ringSeatsTotal) {
                rings[remainders[remCursor % remainders.length].idx].seats++;
                assigned++;
                remCursor++;
            }

            let studentIdx = 0;
            if (useCenterSeat && studentIdx < count) {
                const centerHam = active[studentIdx++];
                centerHam.seatX = 0;
                centerHam.seatY = 0.03;
                centerHam.seatType = 'bench';
                centerHam.ringIndex = 0;
                if (snapPositions) {
                    centerHam.curX = centerHam.seatX;
                    centerHam.curY = centerHam.seatY;
                }
            }

            rings.forEach((ring, ri) => {
                const n = ring.seats;
                if (n <= 0) return;
                const isFullCircle = ring.gapHalfRad === 0;
                const step = ring.span / n;
                // Stagger alternating rings by half a step so back-row hamsters peek between front-row neighbors
                const stagger = (ri % 2 === 1) ? step * 0.5 : 0;

                for (let k = 0; k < n && studentIdx < count; k++) {
                    const h = active[studentIdx++];
                    let ang: number;
                    if (isFullCircle) {
                        ang = -Math.PI * 0.5 + (k + 0.5) * step + stagger;
                    } else {
                        const startAng = -Math.PI * 0.5 + ring.gapHalfRad;
                        const jitter = (ri % 2 === 1 && n > 2) ? step * 0.12 : 0;
                        ang = startAng + (k + 0.5) * step + (k % 2 === 0 ? jitter : -jitter);
                    }
                    h.seatX = Math.cos(ang) * ring.radius;
                    h.seatY = Math.sin(ang) * ring.radius;
                    h.seatType = ri === rings.length - 1 ? 'rim' : ri === 0 ? 'bench' : 'floor';
                    h.ringIndex = ri + (useCenterSeat ? 1 : 0);
                    if (snapPositions) {
                        h.curX = h.seatX;
                        h.curY = h.seatY;
                    }
                }
            });
        }

        const eliminated = g.students.filter(s => s.eliminated);
        eliminated.forEach((h, idx) => {
            h.floatAngle = (idx / Math.max(1, eliminated.length)) * Math.PI * 2 + 0.35;
        });
    };

    const resetRoundEntities = () => {
        const g = gameRef.current;
        g.flyingHamsters = [];
        g.lilyFlights = [];
        g.nextLilyFlightTime = 1.1;
        g.didClimaxLilyFlight = false;
        g.screenShake = 0;
        g.lotusPads.forEach(pad => {
            pad.occupantId = null;
            pad.bounce = 0;
            pad.bounceVel = 0;
            pad.ripple = 0;
        });
        g.escapeJumps = [];
        g.students.forEach(s => {
            s.onLilyPadIndex = null;
            s.lilyLandTime = 0;
            s.chompedByCroc = false;
            s.speechBubble = '';
            s.speechExpiry = 0;
            s.relievedUntil = 0;
        });
        g.crocodile.phase = 'PATROL';
        g.crocodile.jawTarget = 0;
        g.crocodile.jawOpen = 0;
        g.crocodile.surfaceHeight = 0;
        g.crocodile.chompImpact = 0;
        g.crocodile.chompTextTimer = 0;
        g.crocodile.chewTimer = 0;
        g.crocodile.caughtHamsters = [];
        g.crocodile.huntTargetPadIndex = null;
        g.crocodile.huntTimer = 0;
        g.crocodile.huntEscapeTriggered = false;
        g.crocodile.grumpTimer = 0;
        g.crocodile.petalOnNose = false;
        g.crocodile.lastHuntedHamsterId = '';
        g.crocodile.escapeCount = 0;
    };

    const syncRoster = (names: string[]) => {
        const g = gameRef.current;
        g.students = names.map((n, i) => createHamsterFromName(n, i));
        resetRoundEntities();
        arrangeHamstersInBoat(true);
    };

    useEffect(() => {
        if (gameRef.current.state === 'IDLE' || gameRef.current.state === 'READY') {
            syncRoster(students);
        }
    }, [students]);

    useImperativeHandle(ref, () => ({
        prepareRound: (roster: string[], targetsToPick: string[], durationSec: number) => {
            const g = gameRef.current;
            soundRef.current.stopTropicalMusic();
            syncRoster(roster);
            g.targetsToEliminate = targetsToPick;
            g.roundDuration = Math.max(4, durationSec);
            g.phaseTimer = 0;
            g.quoteTimer = 1.1;
            g.slowMoFactor = 1.0;
            g.boatSpeed = 0.25;
            g.state = 'READY';
            g.activeBanner = '';
            g.lastReportedSec = Math.ceil(g.roundDuration);

            onStateChangeRef.current?.({
                phase: 'COCONUT_READY',
                msg: '',
                eliminatedThisRound: [],
                activeCount: roster.length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode,
                isMusicPlaying: false
            });
        },
        beginSpin: () => {
            const g = gameRef.current;
            if (g.state !== 'READY' && g.state !== 'IDLE') return;
            resetRoundEntities();
            g.phaseTimer = 0;
            g.quoteTimer = 1.1;
            g.slowMoFactor = 1.0;
            g.state = 'SLOW_SPIN';
            g.activeBanner = '🚣 HOLD ON! LAND ON A WATER LILY TO STAY SAFE! 🪷';
            g.bannerExpiry = performance.now() + 2400;
            g.lastReportedSec = Math.ceil(g.roundDuration);

            soundRef.current.init();
            soundRef.current.playPop(580);
            soundRef.current.playPaddleSplash(0.8);
            soundRef.current.startTropicalMusic();

            onStateChangeRef.current?.({
                phase: 'SLOW_SPIN',
                msg: '🚣 HOLD ON! LAND ON A WATER LILY TO STAY SAFE! 🪷',
                eliminatedThisRound: [],
                activeCount: g.students.filter(s => !s.eliminated).length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode,
                isMusicPlaying: true
            });
        },
        startRound: (roster: string[], targetsToPick: string[], durationSec: number) => {
            const g = gameRef.current;
            syncRoster(roster);
            g.targetsToEliminate = targetsToPick;
            g.roundDuration = Math.max(4, durationSec);
            g.phaseTimer = 0;
            g.quoteTimer = 1.1;
            g.slowMoFactor = 1.0;
            g.state = 'SLOW_SPIN';
            g.activeBanner = '🚣 HOLD ON! LAND ON A WATER LILY TO STAY SAFE! 🪷';
            g.bannerExpiry = performance.now() + 2400;
            g.lastReportedSec = Math.ceil(g.roundDuration);

            soundRef.current.init();
            soundRef.current.playPop(580);
            soundRef.current.startTropicalMusic();

            onStateChangeRef.current?.({
                phase: 'SLOW_SPIN',
                msg: '🚣 HOLD ON! LAND ON A WATER LILY TO STAY SAFE! 🪷',
                eliminatedThisRound: [],
                activeCount: roster.length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode,
                isMusicPlaying: true
            });
        },
        resetToIdle: (roster: string[]) => {
            const g = gameRef.current;
            soundRef.current.stopTropicalMusic();
            g.state = 'IDLE';
            g.slowMoFactor = 1.0;
            g.boatSpeed = 0.28;
            g.activeBanner = '';
            syncRoster(roster);
        },
        cycleCameraMode: () => {
            const g = gameRef.current;
            const modes: ('side' | 'dynamic' | 'high')[] = ['side', 'dynamic', 'high'];
            const next = modes[(modes.indexOf(g.cameraMode) + 1) % modes.length];
            g.cameraMode = next;
            soundRef.current.playPop(640);
            return next;
        },
        getHamsterAvatar: (name: string) => {
            const offscreen = document.createElement('canvas');
            offscreen.width = 160;
            offscreen.height = 160;
            const oCtx = offscreen.getContext('2d');
            if (!oCtx) return '';

            const seed = hashString(name);
            const palette = FUR_PALETTES[seed % FUR_PALETTES.length];
            const vest = VEST_COLORS[seed % VEST_COLORS.length];
            const accessory = ACCESSORIES[seed % ACCESSORIES.length];

            // Tropical lagoon circle backdrop
            const bgGrad = oCtx.createRadialGradient(80, 80, 15, 80, 80, 80);
            bgGrad.addColorStop(0, '#48CAE4');
            bgGrad.addColorStop(1, '#0077B6');
            oCtx.fillStyle = bgGrad;
            oCtx.fillRect(0, 0, 160, 160);

            // Inner tube
            const tubeColor = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#F72585', '#FF924C'][seed % 6];
            oCtx.fillStyle = tubeColor;
            oCtx.strokeStyle = '#3A1F0D';
            oCtx.lineWidth = 4;
            oCtx.beginPath();
            oCtx.ellipse(80, 122, 52, 22, 0, 0, Math.PI * 2);
            oCtx.fill();
            oCtx.stroke();

            drawHamsterCharacter(
                oCtx,
                80,
                90,
                40,
                {
                    name,
                    palette,
                    vest,
                    accessory,
                    expression: 'shocked',
                    wobbleAngle: 0
                },
                1.0,
                false
            );
            return offscreen.toDataURL('image/png');
        }
    }));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId = 0;
        let lastFrameTime = performance.now();

        const handleResize = () => {
            if (!canvas) return;
            const parent = canvas.parentElement;
            const w = parent ? parent.clientWidth : window.innerWidth;
            const h = parent ? parent.clientHeight : window.innerHeight;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        handleResize();
        window.addEventListener('resize', handleResize);

        const projectBoatPoint = (lx: number, ly: number, lz: number, boatCenterX: number, boatCenterY: number) => {
            const g = gameRef.current;
            const cosA = Math.cos(g.boatAngle);
            const sinA = Math.sin(g.boatAngle);
            const rx = lx * cosA - ly * sinA;
            const ry = lx * sinA + ly * cosA;
            const rz = lz;

            const cosRoll = Math.cos(g.boatTiltRoll);
            const sinRoll = Math.sin(g.boatTiltRoll);
            const x1 = rx * cosRoll - rz * sinRoll;
            const z1 = rx * sinRoll + rz * cosRoll;
            const y1 = ry;

            const cosPitch = Math.cos(g.boatTiltPitch);
            const sinPitch = Math.sin(g.boatTiltPitch);
            const y2 = y1 * cosPitch - z1 * sinPitch;
            const z2 = y1 * sinPitch + z1 * cosPitch;
            const x2 = x1;

            const sinCam = Math.sin(g.cameraPitch);
            const cosCam = Math.cos(g.cameraPitch);

            return {
                x: boatCenterX + x2,
                y: boatCenterY + y2 * sinCam - z2 * cosCam,
                depth: y2 * cosCam + z2 * sinCam,
                worldX: x2,
                worldY: y2,
                worldZ: z2
            };
        };

        const spawnWaterSplash = (x: number, y: number) => {
            const g = gameRef.current;
            const colors = ['#FFFFFF', '#CAF0F8', '#90E0EF', '#48CAE4'];
            for (let i = 0; i < 36; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 40 + Math.random() * 190;
                g.particles.push({
                    x,
                    y,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - 90,
                    gravity: 340,
                    size: 4 + Math.random() * 7,
                    color: colors[i % colors.length],
                    life: 0.6 + Math.random() * 0.5,
                    maxLife: 1.1,
                    shape: 'circle'
                });
            }
        };

        const spawnSaveSparkles = (x: number, y: number, isWaterBounce = false) => {
            const g = gameRef.current;
            const colors = isWaterBounce
                ? ['#FFFFFF', '#FFD166', '#06D6A0', '#90E0EF']
                : ['#FFD166', '#06D6A0', '#FFFFFF', '#FF9F1C'];
            const count = isWaterBounce ? 28 : 22;
            for (let i = 0; i < count; i++) {
                const ang = (i / count) * Math.PI * 2 + Math.random() * 0.25;
                const spd = 45 + Math.random() * 145;
                g.particles.push({
                    x,
                    y,
                    vx: Math.cos(ang) * spd,
                    vy: Math.sin(ang) * spd - (isWaterBounce ? 95 : 65),
                    gravity: 220,
                    size: 4 + Math.random() * 5.5,
                    color: colors[i % colors.length],
                    life: 0.45 + Math.random() * 0.35,
                    maxLife: 0.8,
                    shape: 'circle'
                });
            }
        };

        // Unified boat scaling & smooth camera auto-framing engine
        const computeTargetBoatScale = (activeCount: number): number => {
            const extra = Math.max(0, activeCount - 10);
            return 1 + Math.min(0.92, Math.sqrt(extra) * 0.12 + extra * 0.0045);
        };

        const computeAutoFramingTargets = (
            w: number,
            h: number,
            activeCount: number,
            eliminatedCount: number,
            cameraPitch: number
        ) => {
            const isNarrow = w < 640;
            const baseRadius = Math.min(w, h) * (isNarrow ? 0.35 : 0.32);
            const targetBoatScale = computeTargetBoatScale(activeCount);
            const targetElimMargin = eliminatedCount > 0 ? 1 : 0;

            const safeTop = Math.max(76, h * (isNarrow ? 0.12 : 0.115));
            const safeBottom = h - Math.max(84, h * (isNarrow ? 0.125 : 0.12));
            const safeLeft = Math.max(20, w * 0.03);
            const safeRight = w - safeLeft;
            const safeW = Math.max(180, safeRight - safeLeft);
            const safeH = Math.max(180, safeBottom - safeTop);

            const scaleProgress = Math.max(0, Math.min(1, (targetBoatScale - 1) / 0.92));
            const rawBoatRadius = baseRadius * targetBoatScale;
            const rawBowlDepth = rawBoatRadius * (0.48 - 0.10 * scaleProgress);
            const sinCam = Math.sin(cameraPitch);

            const floatBaseRatio = activeCount > 28 ? 1.26 : activeCount > 16 ? 1.35 : 1.46;
            const boatHalfX = rawBoatRadius * 1.15 + 22;
            const elimHalfX = rawBoatRadius * (floatBaseRatio + 0.06) + 32;
            const reqHalfX = boatHalfX + (elimHalfX - boatHalfX) * targetElimMargin;

            const baseTopHalfY = rawBoatRadius * sinCam * 0.96 + 52;
            const baseBotHalfY = rawBoatRadius * sinCam * 1.0 + rawBowlDepth * 0.45 + 22;
            const elimVertHalfY = rawBoatRadius * (floatBaseRatio + 0.03) * sinCam + 38;

            const topHalfY = baseTopHalfY + Math.max(0, elimVertHalfY - baseTopHalfY) * targetElimMargin;
            const botHalfY = baseBotHalfY + Math.max(0, elimVertHalfY - baseBotHalfY) * targetElimMargin;

            const fitX = (safeW * 0.5) / Math.max(1, reqHalfX);
            const fitY = safeH / Math.max(1, topHalfY + botHalfY);
            const targetCameraScale = Math.max(0.46, Math.min(1.0, fitX, fitY));

            return {
                baseRadius,
                targetBoatScale,
                targetCameraScale,
                targetElimMargin,
                safeTop,
                safeBottom,
                safeLeft,
                safeRight
            };
        };

        const getBoatLayoutMetrics = (w: number, h: number): BoatLayoutMetrics => {
            const g = gameRef.current;
            const activeCount = g.students.filter(s => !s.eliminated).length;
            const isNarrow = w < 640;
            const baseRadius = Math.min(w, h) * (isNarrow ? 0.35 : 0.32);

            const safeTop = Math.max(76, h * (isNarrow ? 0.12 : 0.115));
            const safeBottom = h - Math.max(84, h * (isNarrow ? 0.125 : 0.12));
            const safeLeft = Math.max(20, w * 0.03);
            const safeRight = w - safeLeft;
            const safeH = Math.max(180, safeBottom - safeTop);

            const boatScale = g.currentBoatScale;
            const cameraScale = g.currentCameraScale;
            const scaleProgress = Math.max(0, Math.min(1, (boatScale - 1) / 0.92));

            const boatRadius = baseRadius * boatScale * cameraScale;
            const bowlDepth = boatRadius * (0.48 - 0.10 * scaleProgress);
            const usableRadius = boatRadius * (0.86 + 0.03 * scaleProgress);

            const sinCam = Math.sin(g.cameraPitch);
            const floatBaseRatio = activeCount > 28 ? 1.26 : activeCount > 16 ? 1.35 : 1.46;
            const elimFactor = g.currentEliminatedMargin;
            const baseTopHalfY = boatRadius * sinCam * 0.96 + 50;
            const baseBotHalfY = boatRadius * sinCam * 1.0 + bowlDepth * 0.45 + 22;
            const elimVertHalfY = boatRadius * (floatBaseRatio + 0.03) * sinCam + 36;
            const topHalfY = baseTopHalfY + Math.max(0, elimVertHalfY - baseTopHalfY) * elimFactor;
            const botHalfY = baseBotHalfY + Math.max(0, elimVertHalfY - baseBotHalfY) * elimFactor;

            const cx = w / 2;
            const cy = safeTop + safeH * (topHalfY / Math.max(1, topHalfY + botHalfY));

            // Smooth continuous hamster radius: stays chunky for small classes and crisp/legible for 40–70+ students
            const viewportScale = Math.max(0.68, Math.min(1.18, Math.min(w, h) / 720));
            const smoothDensity = 1 / (1 + Math.pow(Math.max(0, activeCount - 6) / 20, 0.88));
            const rawHam = (11.2 + 16.8 * smoothDensity) * viewportScale;
            const hamRadius = Math.max(11.5, Math.min(28, rawHam));
            const captainRadius = Math.max(19, Math.min(34, Math.max(hamRadius * 1.26 + 3.5, boatRadius * 0.115)));

            // Structural hull richness scales up smoothly with boat size (multiples of 4 keep RIM_COLORS symmetrical)
            const hullSegments =
                boatScale >= 1.62 ? 36 :
                boatScale >= 1.36 ? 32 :
                boatScale >= 1.16 ? 28 :
                24;
            const radialRibs =
                boatScale >= 1.56 ? 24 :
                boatScale >= 1.24 ? 20 :
                16;
            const weaveRings =
                boatScale >= 1.52
                    ? [0.18, 0.34, 0.50, 0.66, 0.80, 0.91]
                    : boatScale >= 1.22
                        ? [0.21, 0.40, 0.58, 0.74, 0.88]
                        : [0.25, 0.46, 0.66, 0.85];
            const benchOffsets =
                boatScale >= 1.58
                    ? [-0.54, -0.18, 0.18, 0.52]
                    : boatScale >= 1.26
                        ? [-0.43, 0.0, 0.41]
                        : [-0.28, 0.26];

            const tagTier =
                activeCount <= 16
                    ? { fontSize: 12, boxH: 20, paddingX: 9, maxChars: 18, maxWidth: 185 }
                    : activeCount <= 30
                        ? { fontSize: 11, boxH: 18.5, paddingX: 7.5, maxChars: 14, maxWidth: 145 }
                        : activeCount <= 48
                            ? { fontSize: 10, boxH: 17, paddingX: 6.5, maxChars: 11, maxWidth: 116 }
                            : { fontSize: 9.5, boxH: 15.5, paddingX: 5.5, maxChars: 9, maxWidth: 96 };

            return {
                cx,
                cy,
                baseRadius,
                boatScale,
                cameraScale,
                boatRadius,
                bowlDepth,
                usableRadius,
                hamRadius,
                captainRadius,
                hullSegments,
                radialRibs,
                weaveRings,
                benchOffsets,
                floatBaseRatio,
                floatStepPx: Math.max(18, 30 * cameraScale),
                safeTop,
                safeBottom,
                safeLeft,
                safeRight,
                tagTier
            };
        };

        const getLotusPadScreenPos = (
            pad: LotusPadState,
            idx: number,
            w: number,
            h: number,
            time: number,
            layout?: BoatLayoutMetrics
        ) => {
            const horizonY = h * 0.22;
            const pr = pad.r * (w < 640 ? 0.78 : 1.0);
            let px = pad.xRatio * w + Math.sin(time * 1.15 + idx * 1.4) * 5;
            let py = pad.yRatio * h + Math.cos(time * 1.45 + idx * 1.2) * 3.5;

            if (layout) {
                const g = gameRef.current;
                const sinCam = Math.sin(g.cameraPitch);
                const rx = layout.boatRadius * 1.14 + pr * 0.9;
                const ry = layout.boatRadius * sinCam * 1.14 + layout.bowlDepth * 0.28 + pr * 0.65;
                const dx = px - layout.cx;
                const dy = py - layout.cy;
                const normDist = Math.hypot(dx / Math.max(1, rx), dy / Math.max(1, ry));
                if (normDist < 1.0 && normDist > 0.001) {
                    const push = 1.02 / normDist;
                    px = layout.cx + dx * push;
                    py = layout.cy + dy * push;
                }
                px = Math.max(layout.safeLeft + pr + 4, Math.min(layout.safeRight - pr - 4, px));
                py = Math.max(horizonY + pr + 18, Math.min(h - pr - 16, py));
            }
            return { x: px, y: py, r: pr };
        };

        const pickCrocCatchSpot = (w: number, h: number, layout: BoatLayoutMetrics, time: number) => {
            const g = gameRef.current;
            const sinCam = Math.sin(g.cameraPitch);
            const preferredSide = g.crocodile.x >= layout.cx ? 1 : -1;
            const candidateSpots = [
                {
                    x: layout.cx + preferredSide * Math.min(w * 0.24, layout.boatRadius * 1.08 + 46),
                    y: Math.min(h - 72, layout.cy + layout.boatRadius * sinCam * 0.72 + 54)
                },
                {
                    x: layout.cx - preferredSide * Math.min(w * 0.24, layout.boatRadius * 1.08 + 46),
                    y: Math.min(h - 72, layout.cy + layout.boatRadius * sinCam * 0.72 + 54)
                },
                {
                    x: layout.cx,
                    y: Math.min(h - 64, layout.cy + layout.boatRadius * sinCam * 1.02 + layout.bowlDepth * 0.42 + 44)
                }
            ];

            let bestSpot = candidateSpots[0];
            let bestClearance = -1;

            candidateSpots.forEach(spot => {
                const cx = Math.max(layout.safeLeft + 92, Math.min(layout.safeRight - 92, spot.x));
                const cy = Math.max(h * 0.36, Math.min(h - 62, spot.y));
                let minPadDist = Infinity;
                g.lotusPads.forEach((pad, idx) => {
                    const pos = getLotusPadScreenPos(pad, idx, w, h, time, layout);
                    minPadDist = Math.min(minPadDist, Math.hypot(cx - pos.x, cy - pos.y) - pos.r);
                });
                if (minPadDist > bestClearance) {
                    bestClearance = minPadDist;
                    bestSpot = { x: cx, y: cy };
                }
            });

            return bestSpot;
        };

        const startLilySafeFlight = (
            w: number,
            h: number,
            time: number,
            isClimaxFlight = false,
            allowTarget = false,
            preferTarget = false
        ) => {
            const g = gameRef.current;
            const targetSet = new Set(g.targetsToEliminate);
            const inFlightIds = new Set([
                ...g.lilyFlights.map(f => f.hamster.id),
                ...g.escapeJumps.map(e => e.hamster.id)
            ]);
            const targetedPadIndices = new Set([
                ...g.lilyFlights.map(f => f.padIndex),
                ...g.escapeJumps.filter(e => e.targetPadIndex !== null).map(e => e.targetPadIndex as number)
            ]);

            let candidates = g.students.filter(
                s => !s.eliminated && s.onLilyPadIndex === null && !inFlightIds.has(s.id) && (allowTarget || !targetSet.has(s.name))
            );
            if (candidates.length === 0) return false;

            if (preferTarget) {
                const targetCandidates = candidates.filter(s => targetSet.has(s.name));
                if (targetCandidates.length > 0) {
                    candidates = targetCandidates;
                }
            }

            const freePadIndices = g.lotusPads
                .map((pad, idx) => ({ pad, idx }))
                .filter(({ pad, idx }) => pad.occupantId === null && !targetedPadIndices.has(idx))
                .map(({ idx }) => idx);
            if (freePadIndices.length === 0) return false;

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            const layout = getBoatLayoutMetrics(w, h);
            const { cx, cy, boatRadius, usableRadius } = layout;

            const lx = (g.state === 'CHAOS_SPIN' ? chosen.curX : chosen.seatX) * usableRadius;
            const ly = (g.state === 'CHAOS_SPIN' ? chosen.curY : chosen.seatY) * usableRadius;
            const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.06, cx, cy);

            // Pick a water lily pad naturally on the outward side of where this hamster is spinning
            let bestPadIdx = freePadIndices[0];
            let bestScore = Infinity;
            freePadIndices.forEach(padIdx => {
                const pos = getLotusPadScreenPos(g.lotusPads[padIdx], padIdx, w, h, time, layout);
                const dist = Math.hypot(pos.x - startProj.x, pos.y - startProj.y);
                const jitter = Math.random() * 85;
                if (dist + jitter < bestScore) {
                    bestScore = dist + jitter;
                    bestPadIdx = padIdx;
                }
            });

            const padPos = getLotusPadScreenPos(g.lotusPads[bestPadIdx], bestPadIdx, w, h, time, layout);

            g.lilyFlights.push({
                hamster: chosen,
                padIndex: bestPadIdx,
                startX: startProj.x,
                startY: startProj.y,
                targetX: padPos.x,
                targetY: padPos.y,
                t: 0,
                duration: isClimaxFlight ? 1.12 : (g.roundDuration >= 20 ? 0.84 : 1.02),
                isClimaxFlight,
                trail: [{ x: startProj.x, y: startProj.y }]
            });

            const flyLabel = `😱 WHOA!! ${chosen.name.toUpperCase()} FLEW OUT TOWARD A WATER LILY! 🪷`;
            g.activeBanner = flyLabel;
            g.bannerExpiry = performance.now() + 1700;
            soundRef.current.playFakeoutWhistle();

            const remSec = Math.max(0, Math.ceil(g.roundDuration - g.phaseTimer));
            onStateChangeRef.current?.({
                phase: g.state,
                msg: flyLabel,
                eliminatedThisRound: [],
                activeCount: g.students.filter(s => !s.eliminated).length,
                chaseSecondsLeft: remSec,
                cameraMode: g.cameraMode
            });
            return true;
        };

        const triggerLilyEscapeJump = (
            hamster: HamsterStudent,
            fromPadIndex: number,
            w: number,
            h: number,
            time: number,
            layout: BoatLayoutMetrics
        ) => {
            const g = gameRef.current;
            const fromPad = g.lotusPads[fromPadIndex];
            const fromPos = fromPad
                ? getLotusPadScreenPos(fromPad, fromPadIndex, w, h, time, layout)
                : { x: g.crocodile.x, y: g.crocodile.y, r: 30 };

            if (fromPad) {
                fromPad.occupantId = null;
                fromPad.bounce = 1.1;
                fromPad.bounceVel = -8.5;
                fromPad.ripple = 1.0;
            }
            hamster.onLilyPadIndex = null;

            const targetedPadIndices = new Set([
                ...g.lilyFlights.map(f => f.padIndex),
                ...g.escapeJumps.filter(e => e.targetPadIndex !== null).map(e => e.targetPadIndex as number)
            ]);
            const freePadIndices = g.lotusPads
                .map((pad, idx) => ({ pad, idx }))
                .filter(({ pad, idx }) => idx !== fromPadIndex && pad.occupantId === null && !targetedPadIndices.has(idx))
                .map(({ idx }) => idx);

            // Pick either the farthest free lily pad from the crocodile OR a comedic bounce back into the boat!
            let targetPadIndex: number | null = null;
            let targetX = layout.cx;
            let targetY = layout.cy;
            const shouldBounceToBoat = freePadIndices.length === 0 || (g.crocodile.escapeCount % 3 === 2 && g.students.filter(s => !s.eliminated).length > 1);

            if (!shouldBounceToBoat && freePadIndices.length > 0) {
                let farthestPad = freePadIndices[0];
                let maxDist = -1;
                freePadIndices.forEach(idx => {
                    const pos = getLotusPadScreenPos(g.lotusPads[idx], idx, w, h, time, layout);
                    const d = Math.hypot(pos.x - fromPos.x, pos.y - fromPos.y);
                    if (d > maxDist) {
                        maxDist = d;
                        farthestPad = idx;
                    }
                });
                targetPadIndex = farthestPad;
                const dest = getLotusPadScreenPos(g.lotusPads[farthestPad], farthestPad, w, h, time, layout);
                targetX = dest.x;
                targetY = dest.y - 6;
            } else {
                const lx = hamster.seatX * layout.usableRadius;
                const ly = hamster.seatY * layout.usableRadius;
                const seatProj = projectBoatPoint(lx, ly, -layout.boatRadius * 0.06, layout.cx, layout.cy);
                targetX = seatProj.x;
                targetY = seatProj.y;
            }

            const escapeQuote = ESCAPE_QUOTES[g.crocodile.escapeCount % ESCAPE_QUOTES.length];
            g.crocodile.escapeCount += 1;

            g.escapeJumps.push({
                hamster,
                startX: fromPos.x,
                startY: fromPos.y - 10,
                targetPadIndex,
                targetX,
                targetY,
                t: 0,
                duration: 0.92,
                escapeQuote,
                trail: [{ x: fromPos.x, y: fromPos.y - 10 }]
            });

            spawnSaveSparkles(fromPos.x, fromPos.y - 8, true);
            soundRef.current.playBoingSave();

            const escMsg = `💨 WHOA!! ${hamster.name.toUpperCase()} ESCAPED THE CROCODILE!! "${escapeQuote}"`;
            g.activeBanner = escMsg;
            g.bannerExpiry = performance.now() + 2100;
            const remSec = Math.max(0, Math.ceil(g.roundDuration - g.phaseTimer));
            onStateChangeRef.current?.({
                phase: g.state,
                msg: escMsg,
                eliminatedThisRound: [],
                activeCount: g.students.filter(s => !s.eliminated).length,
                chaseSecondsLeft: remSec,
                cameraMode: g.cameraMode
            });
        };

        const updateEscapeJumps = (dt: number, time: number, w: number, h: number) => {
            const g = gameRef.current;
            if (g.escapeJumps.length === 0) return;

            const layout = getBoatLayoutMetrics(w, h);
            for (let i = g.escapeJumps.length - 1; i >= 0; i--) {
                const ej = g.escapeJumps[i];
                ej.t += dt / ej.duration;

                if (ej.targetPadIndex !== null) {
                    const pad = g.lotusPads[ej.targetPadIndex];
                    if (pad) {
                        const dest = getLotusPadScreenPos(pad, ej.targetPadIndex, w, h, time, layout);
                        ej.targetX = dest.x;
                        ej.targetY = dest.y - 6;
                    }
                } else {
                    const lx = ej.hamster.seatX * layout.usableRadius;
                    const ly = ej.hamster.seatY * layout.usableRadius;
                    const seatProj = projectBoatPoint(lx, ly, -layout.boatRadius * 0.06, layout.cx, layout.cy);
                    ej.targetX = seatProj.x;
                    ej.targetY = seatProj.y;
                }

                if (ej.t >= 1.0) {
                    if (ej.targetPadIndex !== null) {
                        const pad = g.lotusPads[ej.targetPadIndex];
                        if (pad && pad.occupantId === null) {
                            pad.occupantId = ej.hamster.id;
                            pad.bounce = 1.0;
                            pad.bounceVel = -7.5;
                            pad.ripple = 1.0;
                            ej.hamster.onLilyPadIndex = ej.targetPadIndex;
                            ej.hamster.lilyLandTime = time;
                        }
                    }
                    ej.hamster.expression = 'relieved_smug';
                    ej.hamster.relievedUntil = time + 2.6;
                    ej.hamster.speechBubble = ej.escapeQuote;
                    ej.hamster.speechExpiry = time + 2.4;
                    ej.hamster.wobbleAngle = 0;

                    spawnSaveSparkles(ej.targetX, ej.targetY, true);
                    soundRef.current.playLilyBounce();
                    g.escapeJumps.splice(i, 1);
                }
            }
        };

        const launchTargetVictims = (w: number, h: number, time: number) => {
            const g = gameRef.current;
            const active = g.students.filter(s => !s.eliminated);
            if (active.length === 0) return;

            // Cancel any in-flight escape jumps so targets are clean
            g.escapeJumps.forEach(ej => {
                ej.hamster.expression = 'happy';
            });
            g.escapeJumps = [];

            const targetSet = new Set(g.targetsToEliminate);
            let victims = active.filter(s => targetSet.has(s.name));
            if (victims.length === 0) {
                const lilyRiders = active.filter(s => s.onLilyPadIndex !== null);
                const pool = lilyRiders.length > 0 ? lilyRiders : active;
                victims = [pool[Math.floor(Math.random() * pool.length)]];
            }

            const layout = getBoatLayoutMetrics(w, h);
            const { cx, cy, boatRadius, usableRadius } = layout;

            // If single target is currently on a water lily pad (Extended 20s+ Hunt finale!),
            // have the crocodile lunge right beneath their lily pad as their final panic jump fails!
            const primaryOnLily = victims.length === 1 && victims[0].onLilyPadIndex !== null;
            let catchSpot = pickCrocCatchSpot(w, h, layout, time);
            if (primaryOnLily && victims[0].onLilyPadIndex !== null) {
                const padIdx = victims[0].onLilyPadIndex;
                const padPos = getLotusPadScreenPos(g.lotusPads[padIdx], padIdx, w, h, time, layout);
                catchSpot = {
                    x: Math.max(layout.safeLeft + 76, Math.min(layout.safeRight - 76, padPos.x)),
                    y: Math.max(h * 0.36, Math.min(h - 60, padPos.y + 10))
                };
            }

            // Set crocodile to rush to the catch spot and open its jaws wide!
            const croc = g.crocodile;
            croc.phase = 'SURFACING';
            croc.huntTargetPadIndex = null;
            croc.petalOnNose = false;
            croc.targetX = catchSpot.x;
            croc.targetY = catchSpot.y;
            croc.facingDir = catchSpot.x >= cx ? -1 : 1;
            croc.jawTarget = 1.0;
            croc.caughtHamsters = [];
            croc.chewTimer = 0;

            g.flyingHamsters = victims.map((victim, idx) => {
                let startX = cx;
                let startY = cy;
                let fromLilyPad = false;

                if (victim.onLilyPadIndex !== null) {
                    const prevPad = g.lotusPads[victim.onLilyPadIndex];
                    const padPos = prevPad
                        ? getLotusPadScreenPos(prevPad, victim.onLilyPadIndex, w, h, time, layout)
                        : { x: catchSpot.x, y: catchSpot.y - 10, r: 30 };
                    startX = padPos.x;
                    startY = padPos.y - 10;
                    fromLilyPad = true;
                    if (prevPad) {
                        prevPad.occupantId = null;
                        prevPad.bounce = 1.2;
                        prevPad.bounceVel = -9;
                        prevPad.ripple = 1.0;
                    }
                    victim.onLilyPadIndex = null;
                } else {
                    const lx = victim.curX * usableRadius;
                    const ly = victim.curY * usableRadius;
                    const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.06, cx, cy);
                    startX = startProj.x;
                    startY = startProj.y;
                }

                return {
                    hamster: victim,
                    startX,
                    startY,
                    targetX: catchSpot.x,
                    targetY: catchSpot.y - 16,
                    t: 0,
                    delay: idx * 0.85,
                    splashed: false,
                    fromLilyPad,
                    trail: [{ x: startX, y: startY }]
                };
            });

            g.state = 'LAUNCHING';
            const label = victims.length === 1
                ? (primaryOnLily
                    ? `🐊 NO ESCAPE!! ${victims[0].name.toUpperCase()} SLIPPED INTO THE CROCODILE'S MOUTH!!`
                    : `🐊 WATCH OUT!! ${victims[0].name.toUpperCase()} IS FALLING INTO THE CROCODILE'S MOUTH!!`)
                : `🐊 WATCH OUT!! ${victims.length} STUDENTS ARE HEADED FOR THE CROCODILE!!`;
            g.activeBanner = label;
            g.bannerExpiry = performance.now() + 2400;
            soundRef.current.playFallWhistle();
            soundRef.current.playCrocGrowl();

            onStateChangeRef.current?.({
                phase: 'LAUNCHING',
                msg: label,
                eliminatedThisRound: [],
                activeCount: active.length,
                chaseSecondsLeft: 0,
                cameraMode: g.cameraMode
            });
        };

        const updateLilyFlights = (dt: number, time: number, w: number, h: number) => {
            const g = gameRef.current;
            if (g.lilyFlights.length === 0) return;

            const layout = getBoatLayoutMetrics(w, h);
            let triggerLaunchAfterClimax = false;

            for (let i = g.lilyFlights.length - 1; i >= 0; i--) {
                const lf = g.lilyFlights[i];
                lf.t += dt / lf.duration;

                const pad = g.lotusPads[lf.padIndex];
                if (pad) {
                    const livePad = getLotusPadScreenPos(pad, lf.padIndex, w, h, time, layout);
                    lf.targetX = livePad.x;
                    lf.targetY = livePad.y - 4;
                }

                if (lf.t >= 1.0) {
                    if (pad) {
                        pad.occupantId = lf.hamster.id;
                        pad.bounce = 1.0;
                        pad.bounceVel = -7.5;
                        pad.ripple = 1.0;
                    }
                    lf.hamster.onLilyPadIndex = lf.padIndex;
                    lf.hamster.lilyLandTime = time;
                    lf.hamster.expression = 'happy';
                    lf.hamster.wobbleAngle = 0;

                    spawnSaveSparkles(lf.targetX, lf.targetY, true);
                    soundRef.current.playLilyBounce();

                    const saveMsg = `🪷 SAFE ON THE WATER LILY!! ${lf.hamster.name.toUpperCase()} LANDED! ✨`;
                    g.activeBanner = saveMsg;
                    g.bannerExpiry = performance.now() + 1700;

                    const remSec = Math.max(0, Math.ceil(g.roundDuration - g.phaseTimer));
                    onStateChangeRef.current?.({
                        phase: g.state,
                        msg: saveMsg,
                        eliminatedThisRound: [],
                        activeCount: g.students.filter(s => !s.eliminated).length,
                        chaseSecondsLeft: remSec,
                        cameraMode: g.cameraMode
                    });

                    const wasClimax = lf.isClimaxFlight;
                    g.lilyFlights.splice(i, 1);
                    if (wasClimax) {
                        triggerLaunchAfterClimax = true;
                    }
                }
            }

            if (triggerLaunchAfterClimax && g.lilyFlights.length === 0) {
                launchTargetVictims(w, h, time);
            }
        };

        const updateCrocodile = (dt: number, time: number, w: number, h: number, layout: BoatLayoutMetrics) => {
            const g = gameRef.current;
            const croc = g.crocodile;
            const sinCam = Math.sin(g.cameraPitch);
            const orbitRx = Math.min(w * 0.39, layout.boatRadius * 1.38 + 42);
            const orbitRy = Math.min(h * 0.30, layout.boatRadius * sinCam * 1.35 + layout.bowlDepth * 0.32 + 34);
            const orbitCy = Math.min(h - 70, layout.cy + 14);

            if (!croc.initialized) {
                croc.initialized = true;
                croc.x = layout.cx + Math.cos(croc.patrolAngle) * orbitRx;
                croc.y = orbitCy + Math.sin(croc.patrolAngle) * orbitRy;
                croc.angle = croc.patrolAngle + Math.PI * 0.5;
            }

            // Blinking animation
            croc.blinkTimer -= dt;
            if (croc.blinkTimer <= 0) {
                if (croc.isBlinking) {
                    croc.isBlinking = false;
                    croc.blinkTimer = 2.2 + Math.random() * 2.6;
                } else {
                    croc.isBlinking = true;
                    croc.blinkTimer = 0.14;
                }
            }

            // Decay chomp squash/flash
            if (croc.chompImpact > 0) {
                croc.chompImpact = Math.max(0, croc.chompImpact - dt * 3.2);
            }
            if (croc.chompTextTimer > 0) {
                croc.chompTextTimer = Math.max(0, croc.chompTextTimer - dt);
            }

            if (croc.phase === 'PATROL' || croc.phase === 'STALKING') {
                const isStalking = g.state === 'CHAOS_SPIN';
                croc.phase = isStalking ? 'STALKING' : 'PATROL';
                const angularSpeed = isStalking ? 0.62 : 0.24;
                croc.patrolAngle += angularSpeed * dt;
                croc.swimPhase += dt * (isStalking ? 10.5 : 4.8);

                const desiredX = Math.max(layout.safeLeft + 74, Math.min(layout.safeRight - 74, layout.cx + Math.cos(croc.patrolAngle) * orbitRx));
                const desiredY = Math.max(h * 0.31, Math.min(h - 56, orbitCy + Math.sin(croc.patrolAngle) * orbitRy));

                const dx = desiredX - croc.x;
                const dy = desiredY - croc.y;
                const moveEase = Math.min(1, (isStalking ? 5.2 : 2.8) * dt);
                croc.x += dx * moveEase;
                croc.y += dy * moveEase;

                if (Math.hypot(dx, dy) > 0.6) {
                    const desiredAngle = Math.atan2(dy, dx);
                    let diff = desiredAngle - croc.angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    croc.angle += diff * Math.min(1, 5.5 * dt);
                }

                croc.surfaceHeight += (0 - croc.surfaceHeight) * Math.min(1, 6 * dt);

                if (isStalking) {
                    croc.teaseSnapTimer -= dt;
                    if (croc.teaseSnapTimer <= 0) {
                        croc.jawTarget = 0.58;
                        croc.teaseSnapTimer = 1.25 + Math.random() * 0.7;
                    } else if (croc.jawOpen > 0.45) {
                        croc.jawTarget = 0;
                    }
                } else {
                    croc.jawTarget = 0.05 + Math.sin(time * 2.2) * 0.04;
                }
                croc.jawOpen += (croc.jawTarget - croc.jawOpen) * Math.min(1, 14 * dt);

                croc.bubbleTimer -= dt;
                if (croc.bubbleTimer <= 0) {
                    croc.bubbleTimer = isStalking ? 0.16 : 0.42;
                    const snoutX = croc.x + Math.cos(croc.angle) * 44;
                    const snoutY = croc.y + Math.sin(croc.angle) * 26;
                    g.particles.push({
                        x: snoutX + (Math.random() - 0.5) * 8,
                        y: snoutY + (Math.random() - 0.5) * 6,
                        vx: (Math.random() - 0.5) * 16,
                        vy: -22 - Math.random() * 24,
                        gravity: -8,
                        size: 2.8 + Math.random() * 3.2,
                        color: 'rgba(224, 242, 254, 0.85)',
                        life: 0.45 + Math.random() * 0.35,
                        maxLife: 0.8,
                        shape: 'circle'
                    });
                }
            } else if (croc.phase === 'LILY_ROAM') {
                // Extended 20s+ Hunt: Crocodile prowls menacingly around the water lilies!
                croc.swimPhase += dt * 9.5;
                croc.surfaceHeight += (0 - croc.surfaceHeight) * Math.min(1, 7 * dt);
                croc.petalOnNose = false;
                croc.huntTimer += dt;

                // Pick an occupied lily pad to stalk! Prefer non-targets (or any pad if only 1 player)
                const targetSet = new Set(g.targetsToEliminate);
                const occupied = g.lotusPads
                    .map((pad, idx) => {
                        const ham = pad.occupantId ? g.students.find(s => s.id === pad.occupantId && !s.eliminated) : null;
                        return { pad, idx, ham };
                    })
                    .filter(item => item.ham !== null) as { pad: LotusPadState; idx: number; ham: HamsterStudent }[];

                if (croc.huntTargetPadIndex === null || !occupied.some(o => o.idx === croc.huntTargetPadIndex)) {
                    let huntPool = occupied.filter(o => !targetSet.has(o.ham.name) && o.ham.id !== croc.lastHuntedHamsterId);
                    if (huntPool.length === 0) {
                        huntPool = occupied.filter(o => !targetSet.has(o.ham.name));
                    }
                    if (huntPool.length === 0) {
                        huntPool = occupied;
                    }
                    if (huntPool.length > 0) {
                        const pick = huntPool[Math.floor(Math.random() * huntPool.length)];
                        croc.huntTargetPadIndex = pick.idx;
                        croc.huntTimer = 0;
                    }
                }

                if (croc.huntTargetPadIndex !== null) {
                    const pad = g.lotusPads[croc.huntTargetPadIndex];
                    const padPos = getLotusPadScreenPos(pad, croc.huntTargetPadIndex, w, h, time, layout);
                    // Approach the lily pad from the lagoon-center side so the crocodile stays nicely visible
                    const inwardDirX = padPos.x < layout.cx ? 1 : -1;
                    const desiredX = padPos.x + inwardDirX * (padPos.r + 54);
                    const desiredY = padPos.y + 18;
                    const dx = desiredX - croc.x;
                    const dy = desiredY - croc.y;
                    const dist = Math.hypot(dx, dy);

                    // Swim smoothly with subtle S-sway
                    const speed = Math.min(340, 210 + dist * 0.65);
                    if (dist > 6) {
                        croc.x += (dx / dist) * speed * dt;
                        croc.y += (dy / dist) * speed * dt;
                        const desiredAngle = Math.atan2(dy, dx);
                        let diff = desiredAngle - croc.angle;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        croc.angle += diff * Math.min(1, 6.5 * dt);
                    }

                    croc.jawTarget = 0.25 + Math.sin(time * 9) * 0.14;
                    croc.jawOpen += (croc.jawTarget - croc.jawOpen) * Math.min(1, 12 * dt);

                    if (dist < 42 || croc.huntTimer > 2.2) {
                        croc.phase = 'LILY_STALK';
                        croc.huntTimer = 0;
                        const victimHam = g.students.find(s => s.id === pad.occupantId);
                        if (victimHam) {
                            victimHam.speechBubble = 'OH NO!! IT PICKED ME!! 😱';
                            victimHam.speechExpiry = time + 1.8;
                            soundRef.current.playSqueak();
                            const stalkMsg = `🐊 UH-OH!! THE CROCODILE IS STALKING ${victimHam.name.toUpperCase()} ON THE WATER LILY!!`;
                            g.activeBanner = stalkMsg;
                            g.bannerExpiry = performance.now() + 1800;
                            onStateChangeRef.current?.({
                                phase: 'LILY_HUNT',
                                msg: stalkMsg,
                                eliminatedThisRound: [],
                                activeCount: g.students.filter(s => !s.eliminated).length,
                                chaseSecondsLeft: Math.max(0, Math.ceil(g.roundDuration - g.phaseTimer)),
                                cameraMode: g.cameraMode
                            });
                        }
                    }
                } else {
                    // Fallback cruise while waiting for a pad to fill
                    croc.patrolAngle += 0.55 * dt;
                    const desiredX = layout.cx + Math.cos(croc.patrolAngle) * orbitRx;
                    const desiredY = orbitCy + Math.sin(croc.patrolAngle) * orbitRy;
                    croc.x += (desiredX - croc.x) * Math.min(1, 4 * dt);
                    croc.y += (desiredY - croc.y) * Math.min(1, 4 * dt);
                }
            } else if (croc.phase === 'LILY_STALK') {
                // Tight menacing circling right around the targeted water lily!
                croc.swimPhase += dt * 13;
                croc.huntTimer += dt;
                const padIdx = croc.huntTargetPadIndex;
                const pad = padIdx !== null ? g.lotusPads[padIdx] : null;
                if (!pad || !pad.occupantId) {
                    croc.phase = 'LILY_ROAM';
                    croc.huntTargetPadIndex = null;
                } else {
                    const padPos = getLotusPadScreenPos(pad, padIdx!, w, h, time, layout);
                    const orbitAng = time * 3.8;
                    const desiredX = Math.max(layout.safeLeft + 62, Math.min(layout.safeRight - 62, padPos.x + Math.cos(orbitAng) * (padPos.r + 44)));
                    const desiredY = Math.max(h * 0.34, Math.min(h - 50, padPos.y + Math.sin(orbitAng) * (padPos.r * 0.65 + 24)));
                    const dx = desiredX - croc.x;
                    const dy = desiredY - croc.y;
                    croc.x += dx * Math.min(1, 7.5 * dt);
                    croc.y += dy * Math.min(1, 7.5 * dt);

                    // Keep snout pointed wickedly toward the trembling lily pad!
                    const aimAngle = Math.atan2(padPos.y - croc.y, padPos.x - croc.x);
                    let diff = aimAngle - croc.angle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    croc.angle += diff * Math.min(1, 9 * dt);

                    croc.jawTarget = 0.45 + Math.sin(time * 14) * 0.18;
                    croc.jawOpen += (croc.jawTarget - croc.jawOpen) * Math.min(1, 16 * dt);

                    // Dramatic bubbles around lily pad
                    if (Math.random() < 0.35) {
                        g.particles.push({
                            x: padPos.x + (Math.random() - 0.5) * 45,
                            y: padPos.y + (Math.random() - 0.5) * 20,
                            vx: (Math.random() - 0.5) * 18,
                            vy: -20 - Math.random() * 20,
                            gravity: -4,
                            size: 3 + Math.random() * 3,
                            color: '#E0F2FE',
                            life: 0.4,
                            maxLife: 0.4,
                            shape: 'circle'
                        });
                    }

                    // Time remaining check: only lunge if enough time left before finale!
                    const timeLeft = g.roundDuration - g.phaseTimer;
                    if (croc.huntTimer >= 1.15 && timeLeft > 1.35) {
                        croc.phase = 'LILY_LUNGE';
                        croc.huntTimer = 0;
                        croc.huntEscapeTriggered = false;
                        croc.targetX = padPos.x;
                        croc.targetY = padPos.y + 10;
                        croc.facingDir = croc.x <= padPos.x ? 1 : -1;
                        croc.jawTarget = 1.0;
                        soundRef.current.playCrocGrowl();
                    }
                }
            } else if (croc.phase === 'LILY_LUNGE') {
                // Crocodile lunges UP with wide-open jaws at the water lily — BUT THE STUDENT ESCAPES AT THE LAST SECOND!
                croc.swimPhase += dt * 15;
                croc.huntTimer += dt;
                const padIdx = croc.huntTargetPadIndex;
                const pad = padIdx !== null ? g.lotusPads[padIdx] : null;
                if (pad && padIdx !== null) {
                    const padPos = getLotusPadScreenPos(pad, padIdx, w, h, time, layout);
                    croc.targetX = padPos.x;
                    croc.targetY = padPos.y + 10;
                }

                croc.x += (croc.targetX - croc.x) * Math.min(1, 9.5 * dt);
                croc.y += (croc.targetY - croc.y) * Math.min(1, 9.5 * dt);
                croc.surfaceHeight += (1 - croc.surfaceHeight) * Math.min(1, 10 * dt);

                if (croc.huntTimer < 0.52) {
                    croc.jawTarget = 1.0;
                    croc.jawOpen += (croc.jawTarget - croc.jawOpen) * Math.min(1, 16 * dt);
                }

                // Trigger last-second hilarious escape jump right before the jaws slam shut!
                if (!croc.huntEscapeTriggered && croc.huntTimer >= 0.32 && pad && padIdx !== null && pad.occupantId) {
                    croc.huntEscapeTriggered = true;
                    const victimHam = g.students.find(s => s.id === pad.occupantId);
                    if (victimHam) {
                        croc.lastHuntedHamsterId = victimHam.id;
                        triggerLilyEscapeJump(victimHam, padIdx, w, h, time, layout);
                    }
                }

                // Jaws SLAM SHUT on empty air — missed bite!
                if (croc.huntTimer >= 0.54) {
                    croc.phase = 'LILY_MISS_GRUMP';
                    croc.grumpTimer = 0;
                    croc.jawOpen = 0;
                    croc.jawTarget = 0;
                    croc.chompImpact = 0.85;
                    croc.petalOnNose = true;
                    croc.huntTargetPadIndex = null;
                    g.screenShake = 5.5;
                    spawnWaterSplash(croc.x, croc.y - 6);
                    soundRef.current.playCrocMissSnap();
                }
            } else if (croc.phase === 'LILY_MISS_GRUMP') {
                // Comical grumpy crocodile reaction after snapping empty air!
                croc.swimPhase += dt * 8;
                croc.grumpTimer += dt;
                croc.jawOpen = Math.abs(Math.sin(croc.grumpTimer * 18)) * 0.08;
                croc.surfaceHeight += (0.78 - croc.surfaceHeight) * Math.min(1, 6 * dt);

                if (croc.grumpTimer >= 1.05) {
                    croc.phase = 'LILY_ROAM';
                    croc.petalOnNose = false;
                    croc.huntTimer = 0;
                }
            } else if (croc.phase === 'SURFACING' || croc.phase === 'OPEN_JAWS') {
                croc.swimPhase += dt * 13;
                const rushEase = Math.min(1, 8.5 * dt);
                croc.x += (croc.targetX - croc.x) * rushEase;
                croc.y += (croc.targetY - croc.y) * rushEase;
                croc.surfaceHeight += (1 - croc.surfaceHeight) * Math.min(1, 8.5 * dt);
                croc.jawTarget = 1.0;
                croc.jawOpen += (croc.jawTarget - croc.jawOpen) * Math.min(1, 13 * dt);

                if (Math.hypot(croc.targetX - croc.x, croc.targetY - croc.y) < 16 && croc.surfaceHeight > 0.72) {
                    croc.phase = 'OPEN_JAWS';
                }

                if (Math.random() < 0.45) {
                    const ang = Math.random() * Math.PI * 2;
                    g.particles.push({
                        x: croc.x + Math.cos(ang) * (24 + Math.random() * 24),
                        y: croc.y + Math.sin(ang) * 14 + 14,
                        vx: Math.cos(ang) * 25,
                        vy: -18 - Math.random() * 28,
                        gravity: 50,
                        size: 3 + Math.random() * 4.5,
                        color: Math.random() < 0.5 ? '#FFFFFF' : '#CAF0F8',
                        life: 0.42,
                        maxLife: 0.42,
                        shape: 'circle'
                    });
                }
            } else if (croc.phase === 'CHOMP') {
                croc.swimPhase += dt * 9;
                croc.jawOpen += (0 - croc.jawOpen) * Math.min(1, 30 * dt);
                croc.surfaceHeight += (0.88 - croc.surfaceHeight) * Math.min(1, 6 * dt);
            } else if (croc.phase === 'HAPPY_CHEW') {
                croc.swimPhase += dt * 7;
                croc.chewTimer += dt;
                croc.jawOpen = Math.abs(Math.sin(croc.chewTimer * 14)) * 0.16;
                croc.surfaceHeight += (0.76 - croc.surfaceHeight) * Math.min(1, 5 * dt);
            }
        };

        const updateGameLogic = (dt: number, time: number, w: number, h: number) => {
            const g = gameRef.current;
            const activeList = g.students.filter(s => !s.eliminated);
            const activeCount = activeList.length;
            const eliminatedCount = g.students.length - activeCount;
            const isExtendedHunt = g.roundDuration >= 20;

            if (g.screenShake > 0) {
                g.screenShake = Math.max(0, g.screenShake - dt * 28);
            }

            // Spring-physics bounce & ripple update for every water lily pad
            g.lotusPads.forEach(pad => {
                if (pad.bounce !== 0 || pad.bounceVel !== 0) {
                    const springK = 140;
                    const damping = 9.5;
                    const acc = -springK * pad.bounce - damping * pad.bounceVel;
                    pad.bounceVel += acc * dt;
                    pad.bounce += pad.bounceVel * dt;
                    if (Math.abs(pad.bounce) < 0.005 && Math.abs(pad.bounceVel) < 0.02) {
                        pad.bounce = 0;
                        pad.bounceVel = 0;
                    }
                }
                if (pad.ripple > 0) {
                    pad.ripple = Math.max(0, pad.ripple - dt * 1.15);
                }
            });

            // Gentle pitch elevation for larger classes so concentric seating rings read clearly from above
            const largeClassPitchBoost = Math.min(0.08, Math.max(0, (activeCount - 14) / 38) * 0.08);
            let targetPitch = 0.62 + largeClassPitchBoost;
            if (g.cameraMode === 'high') {
                targetPitch = 0.96;
            } else if (g.cameraMode === 'dynamic') {
                targetPitch = 0.60 + largeClassPitchBoost * 0.75 + Math.sin(time * 0.85) * 0.14;
            }

            const framingTargets = computeAutoFramingTargets(w, h, activeCount, eliminatedCount, targetPitch);
            if (!g.hasInitializedFraming) {
                g.cameraPitch = targetPitch;
                g.currentBoatScale = framingTargets.targetBoatScale;
                g.currentCameraScale = framingTargets.targetCameraScale;
                g.currentEliminatedMargin = framingTargets.targetElimMargin;
                g.hasInitializedFraming = true;
            } else {
                const pitchRate = Math.min(1, (g.cameraMode === 'dynamic' ? 4 : 5) * dt);
                const frameRate = Math.min(1, 4.5 * dt);
                g.cameraPitch += (targetPitch - g.cameraPitch) * pitchRate;
                g.currentBoatScale += (framingTargets.targetBoatScale - g.currentBoatScale) * frameRate;
                g.currentCameraScale += (framingTargets.targetCameraScale - g.currentCameraScale) * frameRate;
                g.currentEliminatedMargin += (framingTargets.targetElimMargin - g.currentEliminatedMargin) * frameRate;
            }

            const layout = getBoatLayoutMetrics(w, h);
            updateCrocodile(dt, time, w, h, layout);
            updateEscapeJumps(dt, time, w, h);

            // Smoothly ease seated hamsters into updated ring coordinates between rounds
            if (g.state !== 'CHAOS_SPIN') {
                const seatEase = Math.min(1, 6.5 * dt);
                activeList.forEach(ham => {
                    if (ham.onLilyPadIndex !== null) return;
                    ham.curX += (ham.seatX - ham.curX) * seatEase;
                    ham.curY += (ham.seatY - ham.curY) * seatEase;
                });
            }

            g.boatRockPhase += dt * (2.5 + g.boatSpeed * 10);

            let tiltIntensity = 0.08;
            if (g.state === 'SLOW_SPIN') tiltIntensity = 0.20;
            else if (g.state === 'CHAOS_SPIN') tiltIntensity = 0.34;
            else if (g.state === 'LILY_HUNT') tiltIntensity = 0.15;
            else if (g.state === 'LAUNCHING') tiltIntensity = 0.28;
            const stabilityFactor = 1 / (1 + Math.max(0, g.currentBoatScale - 1) * 0.35);
            tiltIntensity *= stabilityFactor;

            g.boatTiltRoll = Math.sin(g.boatRockPhase) * tiltIntensity;
            g.boatTiltPitch = Math.cos(g.boatRockPhase * 0.85) * (tiltIntensity * 0.65);

            if (g.state === 'IDLE' || g.state === 'READY') {
                g.boatAngle += 0.22 * dt;
                g.captainPaddlePhase += dt * 3.2;
            } else if (g.state === 'SLOW_SPIN') {
                g.phaseTimer += dt;
                const totalDur = g.roundDuration;
                const slowEnd = isExtendedHunt ? totalDur * 0.14 : totalDur * 0.32;
                g.boatSpeed = 1.2 + (g.phaseTimer / Math.max(1, slowEnd)) * 1.4;
                g.boatAngle += g.boatSpeed * dt;
                g.captainPaddlePhase += dt * 9;

                if (Math.random() < 0.14) {
                    soundRef.current.playPaddleSplash(0.5);
                }

                updateLilyFlights(dt, time, w, h);
                if (g.lilyFlights.length === 0 && g.phaseTimer >= g.nextLilyFlightTime && g.phaseTimer < totalDur - 0.9) {
                    if (startLilySafeFlight(w, h, time, false, isExtendedHunt, false)) {
                        g.nextLilyFlightTime = g.phaseTimer + (isExtendedHunt ? 0.72 : 1.55);
                    } else {
                        g.nextLilyFlightTime = g.phaseTimer + 1.4;
                    }
                }

                const remSec = Math.max(0, Math.ceil(totalDur - g.phaseTimer));
                if (remSec !== g.lastReportedSec) {
                    g.lastReportedSec = remSec;
                    if (g.lilyFlights.length === 0) {
                        onStateChangeRef.current?.({
                            phase: 'SLOW_SPIN',
                            msg: '🚣 HOLD ON! LAND ON A WATER LILY TO STAY SAFE! 🪷',
                            eliminatedThisRound: [],
                            activeCount,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }

                if (g.phaseTimer >= slowEnd) {
                    g.state = 'CHAOS_SPIN';
                    if (g.lilyFlights.length === 0) {
                        const msg = isExtendedHunt
                            ? '🌪️ FLYING TO THE WATER LILIES!! WATCH THE CROCODILE!! 🐊'
                            : '🐊 THE CROCODILE IS CIRCLING! HANG ON!! 🌪️';
                        g.activeBanner = msg;
                        g.bannerExpiry = performance.now() + 1800;
                        onStateChangeRef.current?.({
                            phase: 'CHAOS_SPIN',
                            msg,
                            eliminatedThisRound: [],
                            activeCount,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }
            } else if (g.state === 'CHAOS_SPIN') {
                g.phaseTimer += dt;
                const totalDur = g.roundDuration;
                const chaosStart = isExtendedHunt ? totalDur * 0.14 : totalDur * 0.32;
                const chaosEnd = isExtendedHunt ? totalDur * 0.36 : totalDur;
                const chaosProgress = Math.min(1, (g.phaseTimer - chaosStart) / Math.max(0.1, chaosEnd - chaosStart));
                g.boatSpeed = 2.2 + chaosProgress * 5.8;
                g.boatAngle += g.boatSpeed * dt;
                g.captainPaddlePhase += dt * 22;

                if (Math.random() < 0.28) {
                    soundRef.current.playPaddleSplash(1.2);
                }
                if (Math.random() < 0.08) {
                    soundRef.current.playSqueak();
                }

                updateLilyFlights(dt, time, w, h);

                const occupiedCount = g.lotusPads.filter(p => p.occupantId !== null).length;
                const maxConcurrentFlights = isExtendedHunt ? 2 : 2;
                const lilyCooldown = isExtendedHunt ? 0.58 : 1.35;

                if (
                    g.lilyFlights.length < maxConcurrentFlights &&
                    g.phaseTimer >= g.nextLilyFlightTime &&
                    g.phaseTimer < chaosEnd - 0.35
                ) {
                    // In 20s+ mode, ensure the target also flies onto a lily pad so everyone's guessing during the hunt!
                    const targetSet = new Set(g.targetsToEliminate);
                    const targetOnLily = activeList.some(s => targetSet.has(s.name) && s.onLilyPadIndex !== null);
                    const targetInFlight = g.lilyFlights.some(f => targetSet.has(f.hamster.name));
                    const preferTarget = isExtendedHunt && !targetOnLily && !targetInFlight && (occupiedCount >= 2 || activeCount <= 2);

                    if (startLilySafeFlight(w, h, time, false, isExtendedHunt, preferTarget)) {
                        g.nextLilyFlightTime = g.phaseTimer + lilyCooldown;
                    } else {
                        g.nextLilyFlightTime = g.phaseTimer + 1.2;
                    }
                }

                g.quoteTimer -= dt;
                if (g.quoteTimer <= 0 && g.lilyFlights.length === 0) {
                    const quote = CHAOS_QUOTES[Math.floor(Math.random() * CHAOS_QUOTES.length)];
                    g.activeBanner = quote;
                    g.bannerExpiry = performance.now() + 1300;
                    g.quoteTimer = 1.45;
                }

                const inLilyFlightIds = new Set(g.lilyFlights.map(f => f.hamster.id));
                const maxPushOut = activeCount > 24 ? 0.08 : 0.14;
                activeList.forEach((ham, idx) => {
                    if (ham.onLilyPadIndex !== null || inLilyFlightIds.has(ham.id)) return;
                    ham.wobbleAngle = Math.sin(time * 18 + idx) * 0.32 - g.boatTiltRoll * 0.45;
                    const pushOut = 1 + Math.min(maxPushOut, chaosProgress * maxPushOut);
                    const slideGravityX = Math.sin(g.boatTiltRoll) * 0.06;
                    const rawX = ham.seatX * pushOut + slideGravityX + Math.cos(time * 12 + idx) * 0.025;
                    const rawY = ham.seatY * pushOut + Math.sin(time * 12 + idx) * 0.025;
                    const dist = Math.hypot(rawX, rawY);
                    if (dist > 0.93) {
                        ham.curX = (rawX / dist) * 0.93;
                        ham.curY = (rawY / dist) * 0.93;
                    } else {
                        ham.curX = rawX;
                        ham.curY = rawY;
                    }
                    ham.expression = idx % 2 === 0 ? 'dizzy' : 'scream';
                });

                const remSec = Math.max(0, Math.ceil(totalDur - g.phaseTimer));
                if (remSec !== g.lastReportedSec) {
                    g.lastReportedSec = remSec;
                    if (g.lilyFlights.length === 0) {
                        onStateChangeRef.current?.({
                            phase: 'CHAOS_SPIN',
                            msg: g.activeBanner || '🐊 THE CROCODILE IS CIRCLING! HANG ON!! 🌪️',
                            eliminatedThisRound: [],
                            activeCount,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }

                if (isExtendedHunt && g.phaseTimer >= chaosEnd) {
                    // Enter Extended Act 2: LILY_HUNT!
                    g.state = 'LILY_HUNT';
                    g.crocodile.phase = 'LILY_ROAM';
                    g.crocodile.huntTargetPadIndex = null;
                    g.crocodile.huntTimer = 0;
                    const huntMsg = '🐊 UH-OH!! THE CROCODILE IS HUNTING AROUND THE WATER LILIES!! 😱';
                    g.activeBanner = huntMsg;
                    g.bannerExpiry = performance.now() + 2600;
                    soundRef.current.playCrocGrowl();
                    onStateChangeRef.current?.({
                        phase: 'LILY_HUNT',
                        msg: huntMsg,
                        eliminatedThisRound: [],
                        activeCount,
                        chaseSecondsLeft: remSec,
                        cameraMode: g.cameraMode
                    });
                } else if (!isExtendedHunt && g.phaseTimer >= totalDur && g.lilyFlights.length === 0) {
                    if (!g.didClimaxLilyFlight && activeCount > 1) {
                        g.didClimaxLilyFlight = true;
                        const launchedSafe = startLilySafeFlight(w, h, time, true, false, false);
                        if (!launchedSafe) {
                            launchTargetVictims(w, h, time);
                        }
                    } else {
                        launchTargetVictims(w, h, time);
                    }
                }
            } else if (g.state === 'LILY_HUNT') {
                // Extended 20s+ Act 2: Crocodile prowls water lilies, scaring hamsters with funny emotions & near-miss escapes!
                g.phaseTimer += dt;
                const totalDur = g.roundDuration;
                g.boatSpeed += (1.15 - g.boatSpeed) * Math.min(1, 2.5 * dt);
                g.boatAngle += g.boatSpeed * dt;
                g.captainPaddlePhase += dt * 7;

                updateLilyFlights(dt, time, w, h);

                // Keep lily pads lively if a pad opens up and there's plenty of time left
                const occupiedCount = g.lotusPads.filter(p => p.occupantId !== null).length;
                const targetSet = new Set(g.targetsToEliminate);
                const targetOnLily = activeList.some(s => targetSet.has(s.name) && s.onLilyPadIndex !== null);
                const targetInFlight = g.lilyFlights.some(f => targetSet.has(f.hamster.name));

                if (
                    g.lilyFlights.length === 0 &&
                    g.phaseTimer < totalDur - 3.2 &&
                    g.phaseTimer >= g.nextLilyFlightTime &&
                    (occupiedCount < Math.min(6, activeCount) || !targetOnLily)
                ) {
                    const preferTarget = !targetOnLily && !targetInFlight;
                    if (startLilySafeFlight(w, h, time, false, true, preferTarget)) {
                        g.nextLilyFlightTime = g.phaseTimer + 2.4;
                    } else {
                        g.nextLilyFlightTime = g.phaseTimer + 2.0;
                    }
                }

                // Boat riders watch nervously!
                activeList.forEach((ham, idx) => {
                    if (ham.onLilyPadIndex !== null) return;
                    ham.wobbleAngle = Math.sin(time * 8 + idx) * 0.14;
                    ham.expression = ham.relievedUntil > time ? 'relieved_smug' : 'shocked';
                });

                // Lily pad hamsters react live with funny scared emotions & panic speech bubbles when the crocodile approaches!
                activeList.forEach(ham => {
                    if (ham.onLilyPadIndex === null) return;
                    const pad = g.lotusPads[ham.onLilyPadIndex];
                    if (!pad) return;
                    const pos = getLotusPadScreenPos(pad, ham.onLilyPadIndex, w, h, time, layout);
                    const distToCroc = Math.hypot(g.crocodile.x - pos.x, g.crocodile.y - pos.y);
                    const isStalked = g.crocodile.huntTargetPadIndex === ham.onLilyPadIndex;

                    if (isStalked || distToCroc < 185) {
                        ham.expression = isStalked ? 'terrified' : ham.panicStyle;
                        if (time > ham.speechExpiry && Math.random() < (isStalked ? 0.08 : 0.025)) {
                            ham.speechBubble = LILY_PANIC_QUOTES[Math.floor(Math.random() * LILY_PANIC_QUOTES.length)];
                            ham.speechExpiry = time + 2.1;
                        }
                    } else if (ham.relievedUntil > time) {
                        ham.expression = 'relieved_smug';
                    } else {
                        ham.expression = 'happy';
                    }
                });

                const remSec = Math.max(0, Math.ceil(totalDur - g.phaseTimer));
                if (remSec !== g.lastReportedSec) {
                    g.lastReportedSec = remSec;
                    onStateChangeRef.current?.({
                        phase: 'LILY_HUNT',
                        msg: g.activeBanner || '🐊 THE CROCODILE IS PROWLING THE WATER LILIES!! 😱',
                        eliminatedThisRound: [],
                        activeCount,
                        chaseSecondsLeft: remSec,
                        cameraMode: g.cameraMode
                    });
                }

                // Grand Finale! Once timer finishes (and any active mid-lunge completes), catch the real target!
                const crocReadyForFinale =
                    g.crocodile.phase !== 'LILY_LUNGE' &&
                    g.lilyFlights.length === 0 &&
                    g.escapeJumps.length === 0;
                if (g.phaseTimer >= totalDur && crocReadyForFinale) {
                    launchTargetVictims(w, h, time);
                }
            } else if (g.state === 'LAUNCHING') {
                g.boatAngle += g.boatSpeed * 0.35 * dt;
                let allChomped = true;
                let anyMidAir = false;
                let anyUpcoming = false;

                g.flyingHamsters.forEach(fh => {
                    if (fh.delay > 0) {
                        fh.delay -= dt;
                        allChomped = false;
                        anyUpcoming = true;
                        return;
                    }
                    if (!fh.splashed) {
                        fh.t += dt / 1.18;
                        if (fh.t > 0.22 && fh.t < 0.84) {
                            anyMidAir = true;
                        }
                        if (fh.t >= 1) {
                            fh.t = 1;
                            fh.splashed = true;
                            fh.hamster.eliminated = true;
                            fh.hamster.chompedByCroc = true;
                            fh.hamster.expression = 'shocked';
                            fh.hamster.wobbleAngle = 0;

                            // Crocodile CHOMP impact!
                            const croc = g.crocodile;
                            croc.phase = 'CHOMP';
                            croc.jawOpen = 0;
                            croc.jawTarget = 0;
                            croc.chompImpact = 1.0;
                            croc.chompTextTimer = 1.25;
                            croc.caughtHamsters.push(fh.hamster);
                            g.screenShake = 11;

                            spawnWaterSplash(croc.x, croc.y - 6);
                            spawnSaveSparkles(croc.x, croc.y - 16, true);
                            soundRef.current.playCrocChomp();

                            const chompMsg = `🐊 CHOMP!! ${fh.hamster.name.toUpperCase()} FELL INTO THE CROCODILE'S MOUTH!!`;
                            g.activeBanner = chompMsg;
                            g.bannerExpiry = performance.now() + 2200;
                            const hasMoreTargets = g.flyingHamsters.some(other => !other.splashed);
                            onStateChangeRef.current?.({
                                phase: 'LAUNCHING',
                                msg: chompMsg,
                                eliminatedThisRound: croc.caughtHamsters.map(h => h.name),
                                activeCount: g.students.filter(s => !s.eliminated).length,
                                chaseSecondsLeft: 0,
                                cameraMode: g.cameraMode,
                                isMusicPlaying: hasMoreTargets
                            });
                        } else {
                            allChomped = false;
                            if (g.crocodile.phase === 'CHOMP' && fh.t > 0.15) {
                                g.crocodile.phase = 'OPEN_JAWS';
                                g.crocodile.jawTarget = 1.0;
                            }
                        }
                    }
                });

                g.slowMoFactor = anyMidAir ? 0.48 : 1.0;

                if (allChomped && !anyUpcoming) {
                    if (g.crocodile.phase !== 'HAPPY_CHEW') {
                        g.crocodile.phase = 'HAPPY_CHEW';
                        g.crocodile.chewTimer = 0;
                    }
                    if (g.crocodile.chewTimer >= 1.15) {
                        g.slowMoFactor = 1.0;
                        const eliminatedNames = g.flyingHamsters.map(f => f.hamster.name);
                        g.flyingHamsters = [];
                        arrangeHamstersInBoat(false);
                        g.students.filter(s => !s.eliminated).forEach(ham => {
                            ham.expression = 'happy';
                            ham.wobbleAngle = 0;
                        });
                        soundRef.current.stopTropicalMusic();
                        g.state = 'RESULT';
                        onRoundCompleteRef.current?.(eliminatedNames);
                    }
                }
            }

            for (let i = g.particles.length - 1; i >= 0; i--) {
                const p = g.particles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.gravity) p.vy += p.gravity * dt;
                p.life -= dt;
                if (p.life <= 0) g.particles.splice(i, 1);
            }
        };

        // Lush curved coconut palm tree & nipa fronds for Hoi An Bay Mau forest
        const drawCoconutPalmTree = (
            baseX: number,
            baseY: number,
            scale: number,
            lean: number,
            sway: number,
            isBackLayer: boolean
        ) => {
            ctx.save();
            ctx.translate(baseX, baseY);
            ctx.scale(scale, scale);

            const topX = lean * 28 + sway;
            const topY = -92;

            // Curved segmented coconut trunk
            ctx.strokeStyle = isBackLayer ? '#4A3525' : '#6C4A32';
            ctx.lineWidth = 11;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.quadraticCurveTo(topX * 0.35, topY * 0.5, topX, topY);
            ctx.stroke();

            // Trunk ring ridges
            if (!isBackLayer) {
                ctx.strokeStyle = '#3E2718';
                ctx.lineWidth = 2;
                for (let r = 1; r <= 5; r++) {
                    const t = r / 6;
                    const rx = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * (topX * 0.35) + t * t * topX;
                    const ry = (1 - t) * (1 - t) * 8 + 2 * (1 - t) * t * (topY * 0.5) + t * t * topY;
                    ctx.beginPath();
                    ctx.moveTo(rx - 4, ry);
                    ctx.lineTo(rx + 4, ry);
                    ctx.stroke();
                }
            }

            // Graceful arching palm fronds radiating from crown
            ctx.translate(topX, topY);
            const frondAngles = [-2.35, -1.75, -1.1, -0.45, 0.25, 0.85];
            frondAngles.forEach((ang, idx) => {
                ctx.save();
                const dir = ang < -0.9 ? -1 : 1;
                const frondLen = 58 + (idx % 2) * 14;
                const droop = dir * 24;

                ctx.strokeStyle = isBackLayer ? '#1B4332' : '#2D6A4F';
                ctx.lineWidth = 2.8;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(Math.cos(ang) * frondLen * 0.6, Math.sin(ang) * frondLen * 0.6 - 10, Math.cos(ang) * frondLen, Math.sin(ang) * frondLen + Math.abs(droop));
                ctx.stroke();

                // Lush curved leaf silhouette with individual leaflet serrations
                const leafGrad = ctx.createLinearGradient(0, 0, Math.cos(ang) * frondLen, Math.sin(ang) * frondLen);
                if (isBackLayer) {
                    leafGrad.addColorStop(0, '#1B4332');
                    leafGrad.addColorStop(1, '#2D6A4F');
                } else {
                    leafGrad.addColorStop(0, '#2D6A4F');
                    leafGrad.addColorStop(0.6, '#52B788');
                    leafGrad.addColorStop(1, '#95D5B2');
                }
                ctx.fillStyle = leafGrad;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(
                    Math.cos(ang) * frondLen * 0.55,
                    Math.sin(ang) * frondLen * 0.55 - 22,
                    Math.cos(ang) * frondLen,
                    Math.sin(ang) * frondLen + Math.abs(droop)
                );
                ctx.quadraticCurveTo(
                    Math.cos(ang) * frondLen * 0.48,
                    Math.sin(ang) * frondLen * 0.48 + 10,
                    0,
                    0
                );
                ctx.fill();
                ctx.restore();
            });

            // Cluster of golden/green coconuts under the crown
            if (!isBackLayer) {
                const cocoOffsets = [[-5, 5], [5, 4], [0, 9]];
                cocoOffsets.forEach(([cx, cy]) => {
                    ctx.fillStyle = '#D97706';
                    ctx.strokeStyle = '#3A1F0D';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                });
            }

            ctx.restore();
        };

        // Wooden riverside pier & glowing Hoi An silk lanterns
        const drawHoiAnRiversidePiersAndLanterns = (w: number, horizonY: number, time: number) => {
            const g = gameRef.current;

            // Left & Right wooden riverside piers
            [0, 1].forEach(side => {
                const isLeft = side === 0;
                const pierW = Math.min(220, w * 0.19);
                const px = isLeft ? 0 : w - pierW;
                const py = horizonY + 4;

                ctx.save();
                // Wooden pier posts in water
                const postPositions = isLeft ? [pierW * 0.25, pierW * 0.62, pierW * 0.92] : [px + pierW * 0.08, px + pierW * 0.38, px + pierW * 0.75];
                postPositions.forEach(postX => {
                    // Water reflection under post
                    ctx.fillStyle = 'rgba(43, 24, 10, 0.28)';
                    ctx.fillRect(postX - 5, py + 12, 10, 20);

                    // Bamboo/timber post
                    ctx.fillStyle = '#5C3A21';
                    ctx.strokeStyle = '#2B180A';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(postX - 6, py - 42, 12, 58, 4);
                    ctx.fill();
                    ctx.stroke();

                    // Gold cap on post
                    ctx.fillStyle = '#F4A261';
                    ctx.fillRect(postX - 7, py - 44, 14, 5);
                });

                // Wooden boardwalk deck plank
                ctx.fillStyle = '#7F4F24';
                ctx.strokeStyle = '#3A1F0D';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.roundRect(isLeft ? -8 : px, py - 6, pierW + 8, 14, 5);
                ctx.fill();
                ctx.stroke();

                // Hanging lantern cord between posts
                ctx.strokeStyle = '#2B180A';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(postPositions[0], py - 38);
                ctx.quadraticCurveTo(postPositions[1], py - 22, postPositions[2], py - 38);
                ctx.stroke();
                ctx.restore();
            });

            // Glowing Hoi An silk lanterns with soft water reflections
            g.lanterns.forEach((lan, idx) => {
                const lx = lan.xRatio * w + Math.sin(time * 1.8 + lan.phase) * 3;
                const ly = horizonY + lan.yOffset;

                ctx.save();
                // Warm reflection on the lagoon water below
                const reflGrad = ctx.createRadialGradient(lx, horizonY + 26, 2, lx, horizonY + 26, 28);
                reflGrad.addColorStop(0, lan.color + '66');
                reflGrad.addColorStop(1, 'rgba(255, 209, 102, 0)');
                ctx.fillStyle = reflGrad;
                ctx.beginPath();
                ctx.ellipse(lx, horizonY + 26, 26, 10, 0, 0, Math.PI * 2);
                ctx.fill();

                // Outer lantern halo
                const glowGrad = ctx.createRadialGradient(lx, ly, 3, lx, ly, 24);
                glowGrad.addColorStop(0, '#FFF8E7');
                glowGrad.addColorStop(0.45, lan.color + '88');
                glowGrad.addColorStop(1, 'rgba(255, 209, 102, 0)');
                ctx.fillStyle = glowGrad;
                ctx.beginPath();
                ctx.arc(lx, ly, 24, 0, Math.PI * 2);
                ctx.fill();

                // Silk diamond/oval lantern body
                ctx.fillStyle = lan.color;
                ctx.strokeStyle = '#3A1F0D';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.ellipse(lx, ly, 10, 8, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Inner warm core
                ctx.fillStyle = 'rgba(255, 248, 220, 0.75)';
                ctx.beginPath();
                ctx.ellipse(lx, ly, 5, 5.5, 0, 0, Math.PI * 2);
                ctx.fill();

                // Gold top/bottom caps & red silk tassel
                ctx.fillStyle = '#FFD166';
                ctx.fillRect(lx - 4, ly - 9.5, 8, 2.5);
                ctx.fillRect(lx - 4, ly + 7, 8, 2.5);
                ctx.strokeStyle = '#EF233C';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(lx, ly + 9.5);
                ctx.lineTo(lx + Math.sin(time * 3 + idx) * 2, ly + 16);
                ctx.stroke();
                ctx.restore();
            });
        };

        const drawTropicalLagoon = (w: number, h: number, time: number) => {
            const g = gameRef.current;
            const horizonY = Math.max(130, h * 0.25);

            // Warm tropical sky gradient
            const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
            skyGrad.addColorStop(0, '#38BDF8');
            skyGrad.addColorStop(0.52, '#A5F3FC');
            skyGrad.addColorStop(0.85, '#FEF08A');
            skyGrad.addColorStop(1, '#FDE68A');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, horizonY);

            // Glowing tropical sun & soft rays
            const sunX = w * 0.80;
            const sunY = horizonY * 0.40;
            ctx.save();
            ctx.translate(sunX, sunY);
            const sunGlow = ctx.createRadialGradient(0, 0, 12, 0, 0, 130);
            sunGlow.addColorStop(0, 'rgba(255, 251, 235, 0.98)');
            sunGlow.addColorStop(0.38, 'rgba(253, 224, 71, 0.48)');
            sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(0, 0, 130, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFFBEB';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Fluffy drifting clouds
            for (let c = 0; c < 4; c++) {
                const cx = ((c * w * 0.28 + time * 10) % (w + 200)) - 100;
                const cy = 34 + (c % 2) * 24;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
                ctx.beginPath();
                ctx.arc(cx, cy, 22, 0, Math.PI * 2);
                ctx.arc(cx + 22, cy - 8, 30, 0, Math.PI * 2);
                ctx.arc(cx + 46, cy - 2, 24, 0, Math.PI * 2);
                ctx.arc(cx + 64, cy + 4, 18, 0, Math.PI * 2);
                ctx.fill();
            }

            // Layered misty distant karst hills
            ctx.fillStyle = 'rgba(45, 106, 79, 0.25)';
            ctx.beginPath();
            ctx.moveTo(0, horizonY);
            for (let mx = 0; mx <= w + 120; mx += 140) {
                const mh = 42 + Math.sin(mx * 0.012) * 26;
                ctx.quadraticCurveTo(mx - 70, horizonY - mh, mx, horizonY);
            }
            ctx.closePath();
            ctx.fill();

            // Lush Hoi An Coconut Palm Grove along the riverbank
            const palmSpacing = 92;
            const palmCount = Math.ceil(w / palmSpacing) + 2;
            for (let i = 0; i < palmCount; i++) {
                const px = i * palmSpacing - 30;
                const sway = Math.sin(time * 1.3 + i * 0.8) * 4;
                const lean = ((i % 3) - 1) * 0.45;
                drawCoconutPalmTree(px, horizonY + 6, 0.78, lean, sway, true);
            }
            for (let i = 0; i < palmCount; i++) {
                const px = i * palmSpacing + 16;
                const sway = Math.cos(time * 1.6 + i * 1.1) * 5;
                const lean = ((i % 2 === 0 ? 1 : -1)) * 0.55;
                drawCoconutPalmTree(px, horizonY + 10, 0.92, lean, sway, false);
            }

            // Lush mossy riverbank edge
            const bankGrad = ctx.createLinearGradient(0, horizonY - 2, 0, horizonY + 12);
            bankGrad.addColorStop(0, '#40916C');
            bankGrad.addColorStop(0.5, '#5C3A21');
            bankGrad.addColorStop(1, '#1B4332');
            ctx.fillStyle = bankGrad;
            ctx.fillRect(0, horizonY, w, 10);

            // Crystal emerald-to-turquoise lagoon water gradient
            const waterGrad = ctx.createLinearGradient(0, horizonY + 8, 0, h);
            waterGrad.addColorStop(0, '#1B4332');
            waterGrad.addColorStop(0.10, '#2D6A4F');
            waterGrad.addColorStop(0.28, '#14B8A6');
            waterGrad.addColorStop(0.62, '#06B6D4');
            waterGrad.addColorStop(1, '#0284C7');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, horizonY + 8, w, h - horizonY);

            // Soft golden sunlight shimmer path on water
            const shimmerGrad = ctx.createRadialGradient(sunX, horizonY + 40, 10, sunX, horizonY + 180, w * 0.35);
            shimmerGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
            shimmerGrad.addColorStop(0.5, 'rgba(165, 243, 252, 0.14)');
            shimmerGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
            ctx.fillStyle = shimmerGrad;
            ctx.fillRect(0, horizonY + 8, w, h - horizonY);

            // Swimming Koi Fish with soft ripple wakes
            ctx.save();
            g.koiShadows.forEach((koi, idx) => {
                const a = koi.angle + time * koi.speed;
                const kx = w * 0.5 + Math.cos(a) * (w * koi.dist);
                const ky = h * 0.6 + Math.sin(a) * (h * 0.22);
                const heading = a + (koi.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
                ctx.save();
                ctx.translate(kx, ky);
                ctx.rotate(heading);

                ctx.fillStyle = koi.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, koi.size, koi.size * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();

                const tailWiggle = Math.sin(time * 8 + idx) * 4.5;
                ctx.beginPath();
                ctx.moveTo(-koi.size * 0.82, 0);
                ctx.lineTo(-koi.size * 1.48, -6.5 + tailWiggle);
                ctx.lineTo(-koi.size * 1.48, 6.5 + tailWiggle);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });
            ctx.restore();

            // Organic shimmering water wave ribbons (smooth curved waves instead of flat dashes)
            ctx.save();
            for (let i = 1; i <= 12; i++) {
                const p = Math.pow(i / 12, 1.55);
                const wy = horizonY + 16 + p * (h - horizonY - 24);
                const waveSpan = 75 + p * 130;
                const alpha = 0.08 + p * 0.16;
                ctx.strokeStyle = `rgba(224, 242, 254, ${alpha})`;
                ctx.lineWidth = 1.4 + p * 2.2;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let x = -40; x < w + 60; x += waveSpan * 1.75) {
                    const drift = Math.sin(time * (1.1 + p * 0.8) + i * 1.9) * 26 * (i % 2 === 0 ? 1 : -1);
                    const wx = x + drift;
                    ctx.moveTo(wx, wy);
                    ctx.bezierCurveTo(
                        wx + waveSpan * 0.33,
                        wy - 5 * p,
                        wx + waveSpan * 0.66,
                        wy + 5 * p,
                        wx + waveSpan,
                        wy
                    );
                }
                ctx.stroke();
            }
            ctx.restore();

            // Wooden piers & glowing Hoi An lanterns along the riverbanks
            drawHoiAnRiversidePiersAndLanterns(w, horizonY, time);

            // Detailed 3D Lotus Pads & Blooming Lotus Flowers (interactive safe landing zones!)
            const padLayout = getBoatLayoutMetrics(w, h);
            g.lotusPads.forEach((pad, idx) => {
                const pos = getLotusPadScreenPos(pad, idx, w, h, time, padLayout);
                const px = pos.x;
                const py = pos.y + pad.bounce * 8;
                const pr = pos.r * (1 + pad.bounce * 0.16);
                const isOccupied = pad.occupantId !== null;
                ctx.save();
                ctx.translate(px, py);

                // Expanding splash ripple when a student lands safely
                if (pad.ripple > 0) {
                    const expand = 1 - pad.ripple;
                    ctx.strokeStyle = `rgba(116, 198, 157, ${pad.ripple * 0.85})`;
                    ctx.lineWidth = 3.2 * pad.ripple;
                    ctx.beginPath();
                    ctx.ellipse(0, 3, pr * (1.2 + expand * 1.45), pr * (0.68 + expand * 0.82), 0, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.strokeStyle = `rgba(255, 255, 255, ${pad.ripple * 0.9})`;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(0, 3, pr * (1.05 + expand * 0.95), pr * (0.60 + expand * 0.54), 0, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // Gentle water ripple ring around lotus pad (golden-emerald glow when occupied!)
                ctx.strokeStyle = isOccupied ? 'rgba(6, 214, 160, 0.78)' : 'rgba(224, 242, 254, 0.38)';
                ctx.lineWidth = isOccupied ? 2.6 : 1.5;
                ctx.beginPath();
                ctx.ellipse(0, 2, pr * 1.24, pr * 0.69, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.scale(1, 0.58);
                ctx.rotate(pad.rot + Math.sin(time * 0.8 + idx) * 0.08);

                // Drop shadow on water
                ctx.fillStyle = 'rgba(7, 42, 56, 0.28)';
                ctx.beginPath();
                ctx.arc(2, 6, pr, 0.25, Math.PI * 2 - 0.25);
                ctx.lineTo(2, 6);
                ctx.closePath();
                ctx.fill();

                // Shaded green lily pad with veins
                const padGrad = ctx.createRadialGradient(-pr * 0.2, -pr * 0.2, 2, 0, 0, pr);
                padGrad.addColorStop(0, isOccupied ? '#95D5B2' : '#74C69D');
                padGrad.addColorStop(0.72, '#40916C');
                padGrad.addColorStop(1, '#1B4332');
                ctx.fillStyle = padGrad;
                ctx.strokeStyle = isOccupied ? '#D8F3DC' : '#1B4332';
                ctx.lineWidth = isOccupied ? 2.8 : 2.4;
                ctx.beginPath();
                ctx.arc(0, 0, pr, 0.25, Math.PI * 2 - 0.25);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Leaf radial veins for botanical richness
                ctx.strokeStyle = 'rgba(216, 243, 220, 0.32)';
                ctx.lineWidth = 1.2;
                for (let v = 0; v < 6; v++) {
                    const va = 0.6 + (v / 6) * (Math.PI * 2 - 1.1);
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(Math.cos(va) * pr * 0.84, Math.sin(va) * pr * 0.84);
                    ctx.stroke();
                }

                if (pad.flower) {
                    const flowerOffset = isOccupied ? pr * 0.42 : 0;
                    ctx.save();
                    ctx.translate(flowerOffset, -flowerOffset * 0.3);
                    const fScale = isOccupied ? 0.72 : 1;
                    ctx.scale(fScale, fScale);
                    ctx.fillStyle = pad.flower;
                    ctx.strokeStyle = '#3A1F0D';
                    ctx.lineWidth = 1.6;
                    for (let p = 0; p < 8; p++) {
                        const pa = (p / 8) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.ellipse(Math.cos(pa) * pr * 0.30, Math.sin(pa) * pr * 0.30, pr * 0.26, pr * 0.14, pa, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#FFD166';
                    ctx.beginPath();
                    ctx.arc(0, 0, pr * 0.15, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();
            });

            // Distant background basket boats
            g.bgBoats.forEach(b => {
                const bx = w * b.xRatio + Math.sin(time * 0.5 + b.phase) * 18;
                const by = horizonY + b.yOffset + Math.cos(time * 2 + b.phase) * 2.5;
                ctx.save();
                ctx.translate(bx, by);
                ctx.scale(0.44, 0.44);

                ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(0, 18, 70, 15, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#5C3A21';
                ctx.strokeStyle = '#2B180A';
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.arc(0, 0, 52, 0, Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, 55, 16, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = '#3A1F0D';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(-10, 0);
                ctx.lineTo(-15, -55);
                ctx.stroke();

                ctx.fillStyle = b.umbrella;
                ctx.beginPath();
                ctx.arc(-15, -45, 38, Math.PI, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            });
        };

        // Smart multi-pass collision solver with safe viewport clamping so every student name stays readable
        const resolveNameTagCollisions = (
            tags: NameTagItem[],
            fontCtx: CanvasRenderingContext2D,
            bounds: { left: number; right: number; top: number; bottom: number }
        ) => {
            const boxes = tags.map(t => {
                const fontSize = t.fontSize || (t.isCaptain ? 12 : 11.5);
                const paddingX = t.paddingX ?? 8;
                const boxH = t.boxH ?? (t.isCaptain ? 22 : 19);
                const label = t.displayText ?? t.name;
                fontCtx.font = t.isCaptain || t.priority === 'spotlight'
                    ? `800 ${fontSize}px 'Fredoka', sans-serif`
                    : `700 ${fontSize}px 'Quicksand', sans-serif`;
                const textW = fontCtx.measureText(label).width;
                const dotSpace = !t.isCaptain && t.accentColor ? 6 : 0;
                const maxW = t.maxWidth ?? 185;
                return {
                    tag: t,
                    w: Math.min(maxW, textW + paddingX * 2 + dotSpace),
                    h: boxH + 1
                };
            });

            const passes = tags.length > 32 ? 10 : tags.length > 18 ? 8 : 6;
            for (let pass = 0; pass < passes; pass++) {
                for (let i = 0; i < boxes.length; i++) {
                    for (let j = i + 1; j < boxes.length; j++) {
                        const a = boxes[i];
                        const b = boxes[j];
                        const dx = b.tag.x - a.tag.x;
                        const dy = b.tag.y - a.tag.y;
                        const minW = (a.w + b.w) * 0.51;
                        const minH = (a.h + b.h) * 0.54;

                        if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
                            const overlapY = minH - Math.abs(dy);
                            const overlapX = minW - Math.abs(dx);
                            const aWeight = a.tag.isCaptain || a.tag.priority === 'spotlight' ? 0.22 : 0.5;
                            const bWeight = b.tag.isCaptain || b.tag.priority === 'spotlight' ? 0.22 : 0.5;
                            const wSum = aWeight + bWeight;
                            const aRatio = aWeight / wSum;
                            const bRatio = bWeight / wSum;

                            if (overlapY <= overlapX * 1.15) {
                                const dirY = dy === 0 ? (i % 2 === 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
                                const push = overlapY * 0.96;
                                a.tag.y -= push * aRatio * dirY;
                                b.tag.y += push * bRatio * dirY;
                            } else {
                                const dirX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : (dx > 0 ? 1 : -1);
                                const push = overlapX * 0.85;
                                a.tag.x -= push * aRatio * dirX;
                                b.tag.x += push * bRatio * dirX;
                            }
                        }
                    }
                }

                // Gentle spring toward original hamster anchor + strict safe-viewport clamping
                for (let i = 0; i < boxes.length; i++) {
                    const box = boxes[i];
                    box.tag.x += (box.tag.anchorX - box.tag.x) * 0.08;
                    box.tag.y += (box.tag.anchorY - box.tag.y) * 0.08;

                    const halfW = box.w * 0.5;
                    const halfH = box.h * 0.5;
                    const minX = bounds.left + halfW;
                    const maxX = Math.max(minX, bounds.right - halfW);
                    const minY = bounds.top + halfH;
                    const maxY = Math.max(minY, bounds.bottom - halfH);

                    box.tag.x = Math.max(minX, Math.min(maxX, box.tag.x));
                    box.tag.y = Math.max(minY, Math.min(maxY, box.tag.y));
                }
            }
        };

        const drawNameTag = (item: NameTagItem) => {
            ctx.save();
            const isSpotlight = item.priority === 'spotlight';
            const fontSize = item.fontSize ?? (isSpotlight ? 13 : item.isCaptain ? 12 : 11.5);
            const paddingX = item.paddingX ?? (isSpotlight ? 10 : 8.5);
            const boxH = item.boxH ?? (isSpotlight ? 24 : item.isCaptain ? 22 : 19);
            const label = item.displayText ?? item.name;

            ctx.font = item.isCaptain || isSpotlight
                ? `800 ${fontSize}px 'Fredoka', sans-serif`
                : `700 ${fontSize}px 'Quicksand', sans-serif`;

            const hasDot = !item.isCaptain && Boolean(item.accentColor);
            const dotSpace = hasDot ? 6 : 0;
            const metrics = ctx.measureText(label);
            const boxW = Math.min(item.maxWidth ?? 210, metrics.width + paddingX * 2 + dotSpace);
            const radius = Math.min(9, boxH * 0.45);

            // Subtle tether line + tiny anchor pip if anti-overlap nudged the tag away from its hamster
            const distMoved = Math.hypot(item.x - item.anchorX, item.y - item.anchorY);
            if (distMoved > 7 && !isSpotlight) {
                ctx.strokeStyle = 'rgba(58, 31, 13, 0.48)';
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(item.x, item.y + (item.anchorY >= item.y ? boxH * 0.42 : -boxH * 0.42));
                ctx.lineTo(item.anchorX, item.anchorY + 5);
                ctx.stroke();

                ctx.fillStyle = item.accentColor || '#3A1F0D';
                ctx.beginPath();
                ctx.arc(item.anchorX, item.anchorY + 5, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.translate(item.x, item.y);

            // Soft drop shadow
            ctx.fillStyle = isSpotlight ? 'rgba(239, 35, 60, 0.32)' : 'rgba(28, 16, 8, 0.28)';
            ctx.beginPath();
            ctx.roundRect(-boxW / 2, -boxH / 2 + 2.2, boxW, boxH, radius);
            ctx.fill();

            ctx.fillStyle = item.isCaptain
                ? '#3A1F0D'
                : isSpotlight
                    ? '#FFFBEB'
                    : 'rgba(255, 253, 247, 0.96)';
            ctx.strokeStyle = item.isCaptain
                ? '#FFD166'
                : isSpotlight
                    ? '#F59E0B'
                    : '#3A1F0D';
            ctx.lineWidth = isSpotlight ? 2.6 : (boxH < 17 ? 1.5 : 1.9);

            ctx.beginPath();
            ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, radius);
            ctx.fill();
            ctx.stroke();

            // Left color accent dot for student life vest color
            if (hasDot && item.accentColor) {
                const dotR = boxH < 17 ? 2.4 : 3;
                ctx.fillStyle = item.accentColor;
                ctx.beginPath();
                ctx.arc(-boxW / 2 + paddingX * 0.72, 0, dotR, 0, Math.PI * 2);
                ctx.fill();
            }

            // Pointer triangle only when tag sits right above its hamster
            if (distMoved <= 12) {
                ctx.fillStyle = item.isCaptain
                    ? '#3A1F0D'
                    : isSpotlight
                        ? '#FFFBEB'
                        : 'rgba(255, 253, 247, 0.96)';
                ctx.beginPath();
                ctx.moveTo(-3, boxH / 2);
                ctx.lineTo(3, boxH / 2);
                ctx.lineTo(0, boxH / 2 + 3.2);
                ctx.closePath();
                ctx.fill();
            }

            ctx.fillStyle = item.isCaptain ? '#FFD166' : '#2B180A';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, hasDot ? 2.5 : 0, 0.5, boxW - paddingX * 1.4 - dotSpace);
            ctx.restore();
        };

        // Expressive Animated Cartoon Lagoon Crocodile (Swimming Patrol + Lunging Open-Jaws Chomp)
        const drawCrocodileSwimming = (croc: CrocodileState, time: number, scale: number) => {
            ctx.save();
            ctx.translate(croc.x, croc.y);
            ctx.scale(scale, scale);

            // Water shadow & V-shaped swimming wake ripples
            ctx.save();
            ctx.rotate(croc.angle);
            ctx.strokeStyle = 'rgba(224, 242, 254, 0.52)';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            const wakePulse = Math.sin(time * 6) * 4;
            ctx.beginPath();
            ctx.moveTo(42, 0);
            ctx.quadraticCurveTo(10, -28 - wakePulse * 0.5, -62, -40 - wakePulse);
            ctx.moveTo(42, 0);
            ctx.quadraticCurveTo(10, 28 + wakePulse * 0.5, -62, 40 + wakePulse);
            ctx.stroke();

            // Subtle underwater body shadow
            ctx.fillStyle = 'rgba(6, 38, 48, 0.34)';
            ctx.beginPath();
            ctx.ellipse(-8, 5, 58, 20, 0, 0, Math.PI * 2);
            ctx.fill();

            // Articulated S-wave swimming tail (7 tapered emerald segments + dorsal ridge spikes)
            const tailSegments = 7;
            for (let i = tailSegments; i >= 1; i--) {
                const frac = i / tailSegments;
                const tx = -18 - i * 11.5;
                const ty = Math.sin(croc.swimPhase - i * 0.68) * (5.5 + i * 2.1);
                const segR = Math.max(4.5, 16.5 * (1 - frac * 0.72));

                ctx.fillStyle = i % 2 === 0 ? '#2D6A4F' : '#40916C';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.ellipse(tx, ty, segR * 1.25, segR * 0.82, Math.cos(croc.swimPhase - i * 0.68) * 0.22, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Dorsal ridge scute along spine
                ctx.fillStyle = '#1B4332';
                ctx.beginPath();
                ctx.ellipse(tx, ty, segR * 0.48, segR * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Stubby webbed paddling legs stroking rhythmically
            const legStroke = Math.sin(croc.swimPhase) * 0.45;
            const drawLeg = (lx: number, side: number, phaseSign: number) => {
                ctx.save();
                ctx.translate(lx, side * 15);
                ctx.rotate(side * (0.55 + legStroke * phaseSign));
                ctx.fillStyle = '#40916C';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.ellipse(0, side * 9, 7.5, 11.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                // Cute 3 webbed toes
                ctx.fillStyle = '#74C69D';
                for (let t = -1; t <= 1; t++) {
                    ctx.beginPath();
                    ctx.arc(t * 4.5, side * 18, 2.6, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            };
            drawLeg(-16, -1, 1);
            drawLeg(-16, 1, -1);
            drawLeg(12, -1, -1);
            drawLeg(12, 1, 1);

            // Muscular torpedo torso
            const torsoGrad = ctx.createLinearGradient(-28, -18, 24, 18);
            torsoGrad.addColorStop(0, '#74C69D');
            torsoGrad.addColorStop(0.55, '#40916C');
            torsoGrad.addColorStop(1, '#1B4332');
            ctx.fillStyle = torsoGrad;
            ctx.strokeStyle = '#143324';
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.ellipse(-2, 0, 28, 17, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Armored dorsal scute plates along torso back
            for (let s = -2; s <= 1; s++) {
                ctx.fillStyle = '#2D6A4F';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(s * 10 - 3, -8, 7.5, 5.5, 2.5);
                ctx.roundRect(s * 10 - 3, 2.5, 7.5, 5.5, 2.5);
                ctx.fill();
                ctx.stroke();
            }

            // Head & expressive snapping snout
            const headYaw = Math.sin(croc.swimPhase * 0.5) * 0.06;
            ctx.save();
            ctx.translate(22, 0);
            ctx.rotate(headYaw);

            // Snout tease-open glow inside jaws when stalking
            if (croc.jawOpen > 0.08) {
                ctx.fillStyle = '#B91C1C';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(22, 0, 18 + croc.jawOpen * 7, 9 + croc.jawOpen * 7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Cute pink tongue peek
                ctx.fillStyle = '#FB7185';
                ctx.beginPath();
                ctx.ellipse(20, 0, 10, 5 + croc.jawOpen * 3, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Rounded zig-zag white cartoon teeth peeking along jawline
            ctx.fillStyle = '#FFFFFF';
            ctx.strokeStyle = '#143324';
            ctx.lineWidth = 1.4;
            const teethSpread = croc.jawOpen * 3.5;
            [-1, 1].forEach(side => {
                [12, 20, 28].forEach(tx => {
                    ctx.beginPath();
                    ctx.moveTo(tx - 3, side * (9.5 + teethSpread));
                    ctx.lineTo(tx, side * (14.5 + teethSpread));
                    ctx.lineTo(tx + 3, side * (9.5 + teethSpread));
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });
            });

            // Sculpted crocodile snout & skull
            const headGrad = ctx.createLinearGradient(0, -14, 38, 14);
            headGrad.addColorStop(0, '#74C69D');
            headGrad.addColorStop(0.6, '#40916C');
            headGrad.addColorStop(1, '#2D6A4F');
            ctx.fillStyle = headGrad;
            ctx.strokeStyle = '#143324';
            ctx.lineWidth = 2.8;
            ctx.beginPath();
            ctx.moveTo(-6, -13);
            ctx.quadraticCurveTo(10, -14, 24, -10.5);
            ctx.quadraticCurveTo(40, -9, 41, 0);
            ctx.quadraticCurveTo(40, 9, 24, 10.5);
            ctx.quadraticCurveTo(10, 14, -6, 13);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Snout bridge highlight & bumpy nostrils
            ctx.fillStyle = 'rgba(183, 228, 199, 0.45)';
            ctx.beginPath();
            ctx.ellipse(18, -3, 14, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#143324';
            ctx.beginPath();
            ctx.arc(34, -4.2, 2.1, 0, Math.PI * 2);
            ctx.arc(34, 4.2, 2.1, 0, Math.PI * 2);
            ctx.fill();

            // Bulging yellow cartoon eyes with sneaky eyebrows & blinking
            [-1, 1].forEach(side => {
                ctx.fillStyle = '#52B788';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(4, side * 9.5, 7.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                if (croc.isBlinking) {
                    ctx.strokeStyle = '#143324';
                    ctx.lineWidth = 2.2;
                    ctx.beginPath();
                    ctx.moveTo(1, side * 9.5);
                    ctx.lineTo(8, side * 9.5);
                    ctx.stroke();
                } else {
                    ctx.fillStyle = '#FDE047';
                    ctx.beginPath();
                    ctx.arc(5, side * 9.5, 5.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Expressive vertical slit pupil tracking forward
                    ctx.fillStyle = '#143324';
                    ctx.beginPath();
                    ctx.ellipse(6.5, side * 9.5, 2.0, 3.6, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Specular catchlight
                    ctx.fillStyle = '#FFFFFF';
                    ctx.beginPath();
                    ctx.arc(3.8, side * 8.2, 1.6, 0, Math.PI * 2);
                    ctx.fill();
                }
            });

            ctx.restore();
            ctx.restore();
            ctx.restore();
        };

        // Dramatic Heroic Lunging / Open-Jaws / Chomp / Happy-Chew Crocodile (supports 2-pass layering so falling hamster drops INSIDE the jaws!)
        const drawCrocodileLunging = (
            croc: CrocodileState,
            time: number,
            scale: number,
            pass: 'back' | 'front'
        ) => {
            const impactSquash = croc.chompImpact;
            const sx = scale * (1 + impactSquash * 0.22) * croc.facingDir;
            const sy = scale * (1 - impactSquash * 0.16);
            const bobY = croc.phase === 'HAPPY_CHEW'
                ? Math.sin(time * 9) * 4.5
                : Math.sin(time * 12) * 2.5;
            const riseY = (1 - croc.surfaceHeight) * 32;

            ctx.save();
            ctx.translate(croc.x, croc.y + bobY + riseY);

            if (pass === 'back') {
                // Turbulent water swirl & foaming surface collar
                const swirlR = (46 + croc.jawOpen * 14 + Math.sin(time * 10) * 4) * scale;
                ctx.save();
                const waterRingGrad = ctx.createRadialGradient(0, 14 * scale, 4, 0, 14 * scale, swirlR * 1.25);
                waterRingGrad.addColorStop(0, 'rgba(6, 48, 66, 0.45)');
                waterRingGrad.addColorStop(0.7, 'rgba(202, 240, 248, 0.45)');
                waterRingGrad.addColorStop(1, 'rgba(202, 240, 248, 0)');
                ctx.fillStyle = waterRingGrad;
                ctx.beginPath();
                ctx.ellipse(0, 14 * scale, swirlR * 1.25, swirlR * 0.56, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 3 * scale;
                ctx.beginPath();
                ctx.ellipse(0, 15 * scale, swirlR, swirlR * 0.44, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(144, 224, 239, 0.65)';
                ctx.lineWidth = 2 * scale;
                ctx.beginPath();
                ctx.ellipse(0, 17 * scale, swirlR * 1.28, swirlR * 0.56, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }

            ctx.scale(sx, sy);

            const jawAngle = croc.jawOpen * 0.92; // opens wide (~53 deg upper + ~32 deg lower!)

            if (pass === 'back') {
                // Wagging tail curling behind the surfacing croc
                ctx.save();
                const tailWave = Math.sin(croc.swimPhase) * 10;
                ctx.fillStyle = '#2D6A4F';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-24, 10);
                ctx.quadraticCurveTo(-56, 8 + tailWave, -74, -8 + tailWave * 1.2);
                ctx.quadraticCurveTo(-50, 26 + tailWave * 0.5, -18, 22);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();

                // Surfacing emerald chest & ribbed cream-yellow belly
                const bodyGrad = ctx.createLinearGradient(-26, -10, 24, 22);
                bodyGrad.addColorStop(0, '#52B788');
                bodyGrad.addColorStop(0.55, '#2D6A4F');
                bodyGrad.addColorStop(1, '#1B4332');
                ctx.fillStyle = bodyGrad;
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.ellipse(-6, 8, 34, 22, -0.12, Math.PI, 0, false);
                ctx.quadraticCurveTo(26, 22, -4, 24);
                ctx.quadraticCurveTo(-34, 24, -40, 10);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Warm cream segmented belly
                ctx.fillStyle = '#E9F5DB';
                ctx.beginPath();
                ctx.ellipse(8, 12, 18, 12, 0.15, 0, Math.PI * 2);
                ctx.fill();

                // Raised cartoon claws gripping the air / water
                [-1, 1].forEach(side => {
                    ctx.save();
                    ctx.translate(side < 0 ? -18 : 14, 14);
                    ctx.rotate(side * 0.4 + Math.sin(time * 10) * 0.12);
                    ctx.fillStyle = '#40916C';
                    ctx.strokeStyle = '#143324';
                    ctx.lineWidth = 2.4;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 10, 6.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                });

                // OPEN MOUTH INTERIOR (deep throat & wiggling pink tongue)
                if (croc.jawOpen > 0.06) {
                    ctx.save();
                    ctx.translate(-8, -8);
                    const throatGrad = ctx.createRadialGradient(18, -8, 4, 22, -4, 38);
                    throatGrad.addColorStop(0, '#7F1D1D');
                    throatGrad.addColorStop(0.65, '#B91C1C');
                    throatGrad.addColorStop(1, '#DC2626');
                    ctx.fillStyle = throatGrad;
                    ctx.beginPath();
                    ctx.moveTo(-4, 4);
                    ctx.lineTo(Math.cos(-jawAngle - 0.18) * 52, Math.sin(-jawAngle - 0.18) * 52);
                    ctx.quadraticCurveTo(38, -10, Math.cos(jawAngle * 0.55) * 48, Math.sin(jawAngle * 0.55) * 48);
                    ctx.closePath();
                    ctx.fill();

                    // Wiggling pink tongue inside open jaws
                    const tongueWiggle = Math.sin(time * 16) * 3;
                    ctx.fillStyle = '#FB7185';
                    ctx.strokeStyle = '#881337';
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.ellipse(20, 4 + tongueWiggle * 0.4, 16, 7.5, 0.12, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }

                // LOWER JAW (hinged down so falling hamster drops right onto it!)
                ctx.save();
                ctx.translate(-8, -4);
                ctx.rotate(jawAngle * 0.52);

                const lowerGrad = ctx.createLinearGradient(0, 0, 48, 18);
                lowerGrad.addColorStop(0, '#52B788');
                lowerGrad.addColorStop(0.6, '#40916C');
                lowerGrad.addColorStop(1, '#2D6A4F');
                ctx.fillStyle = lowerGrad;
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(-8, -2);
                ctx.lineTo(48, 0);
                ctx.quadraticCurveTo(54, 10, 42, 16);
                ctx.quadraticCurveTo(14, 20, -10, 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cream underside of lower jaw
                ctx.fillStyle = '#E9F5DB';
                ctx.beginPath();
                ctx.ellipse(20, 11, 22, 4.5, 0.04, 0, Math.PI * 2);
                ctx.fill();

                // Lower row of chunky cartoon white teeth
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 1.8;
                [8, 18, 28, 38].forEach((tx, ti) => {
                    const th = ti === 3 ? 9.5 : 8;
                    ctx.beginPath();
                    ctx.moveTo(tx - 4.2, 1);
                    ctx.lineTo(tx, -th);
                    ctx.lineTo(tx + 4.2, 1);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });
                ctx.restore();
            }

            if (pass === 'front') {
                // UPPER JAW & EXPRESSIVE FACE (rendered IN FRONT of the falling hamster so it truly chomps over it!)
                ctx.save();
                ctx.translate(-8, -8);
                ctx.rotate(-jawAngle * 0.92);

                // Upper row of chunky rounded white cartoon teeth
                ctx.fillStyle = '#FFFFFF';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 1.8;
                [10, 20, 30, 40].forEach((tx, ti) => {
                    const th = ti === 2 ? 10 : 8.5;
                    ctx.beginPath();
                    ctx.moveTo(tx - 4.4, -1);
                    ctx.lineTo(tx, th);
                    ctx.lineTo(tx + 4.4, -1);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                });

                // Upper snout & brow
                const upperGrad = ctx.createLinearGradient(-10, -24, 52, 4);
                upperGrad.addColorStop(0, '#95D5B2');
                upperGrad.addColorStop(0.5, '#52B788');
                upperGrad.addColorStop(1, '#2D6A4F');
                ctx.fillStyle = upperGrad;
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.moveTo(-14, 0);
                ctx.quadraticCurveTo(-12, -22, 4, -22);
                ctx.quadraticCurveTo(18, -22, 24, -14);
                ctx.quadraticCurveTo(44, -15, 52, -6);
                ctx.quadraticCurveTo(56, 1, 46, 2);
                ctx.lineTo(-10, 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                // Cute rosy cheek blush when happily chewing!
                if (croc.phase === 'HAPPY_CHEW' || croc.phase === 'CHOMP') {
                    ctx.fillStyle = 'rgba(255, 117, 143, 0.55)';
                    ctx.beginPath();
                    ctx.ellipse(2, -4, 7.5, 4.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Raised nostril bump at snout tip
                ctx.fillStyle = '#40916C';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(44, -11, 5.5, Math.PI, 0);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#143324';
                ctx.beginPath();
                ctx.arc(45, -10.5, 2.2, 0, Math.PI * 2);
                ctx.fill();

                // Cute pink lotus petal stuck comically on crocodile's snout after missing a bite!
                if (croc.petalOnNose) {
                    ctx.save();
                    ctx.translate(46, -15);
                    ctx.rotate(0.45);
                    ctx.fillStyle = '#FF758F';
                    ctx.strokeStyle = '#881337';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }

                // Expressive Cartoon Eyes
                const drawEye = (ex: number, ey: number, er: number) => {
                    ctx.fillStyle = '#52B788';
                    ctx.strokeStyle = '#143324';
                    ctx.lineWidth = 2.6;
                    ctx.beginPath();
                    ctx.arc(ex, ey, er + 2.5, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    if (croc.phase === 'HAPPY_CHEW') {
                        ctx.fillStyle = '#FDE047';
                        ctx.beginPath();
                        ctx.arc(ex, ey, er, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.strokeStyle = '#143324';
                        ctx.lineWidth = 2.8;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.arc(ex, ey + 2.5, er * 0.56, Math.PI * 1.15, Math.PI * 1.85);
                        ctx.stroke();
                    } else if (croc.phase === 'LILY_MISS_GRUMP') {
                        // Grumpy annoyed squinted eyes after missing the student!
                        ctx.fillStyle = '#FEF08A';
                        ctx.beginPath();
                        ctx.arc(ex, ey, er, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = '#143324';
                        ctx.beginPath();
                        ctx.arc(ex + 1, ey + 1, er * 0.35, 0, Math.PI * 2);
                        ctx.fill();

                        // Heavy slanted grumpy brow
                        ctx.fillStyle = '#2D6A4F';
                        ctx.strokeStyle = '#143324';
                        ctx.lineWidth = 2.6;
                        ctx.beginPath();
                        ctx.moveTo(ex - er - 2, ey - er * 0.65);
                        ctx.lineTo(ex + er + 3, ey + er * 0.1);
                        ctx.lineTo(ex + er + 2, ey - er - 3);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = '#FEF08A';
                        ctx.beginPath();
                        ctx.arc(ex, ey, er, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = '#143324';
                        ctx.beginPath();
                        ctx.ellipse(ex + 2, ey - 2.2, er * 0.36, er * 0.56, -0.2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#FFFFFF';
                        ctx.beginPath();
                        ctx.arc(ex - 1.5, ey - 3.2, er * 0.28, 0, Math.PI * 2);
                        ctx.fill();
                    }
                };
                drawEye(11, -21, 6.2);
                drawEye(-1, -18, 7.6);

                ctx.restore();

                // Water splash lip across chest base so crocodile sits seamlessly IN the lagoon
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.beginPath();
                ctx.ellipse(0, 22, 34, 6.5, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();

            // Comic "CHOMP!!", "MISSED! GRRR!", & caught student playful badges (rendered upright in front pass)
            if (pass === 'front') {
                if (croc.phase === 'OPEN_JAWS' || croc.phase === 'SURFACING' || croc.phase === 'LILY_LUNGE') {
                    ctx.save();
                    const pulse = 1 + Math.sin(time * 16) * 0.08;
                    ctx.translate(croc.x, croc.y + 42 * scale);
                    ctx.scale(pulse, pulse);
                    const lbl = croc.phase === 'LILY_LUNGE' ? '🐊 SNAPPING!!' : '🐊 OPEN WIDE!!';
                    ctx.font = "900 13px 'Fredoka', sans-serif";
                    const bw = ctx.measureText(lbl).width + 20;
                    ctx.fillStyle = '#EF233C';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.6;
                    ctx.beginPath();
                    ctx.roundRect(-bw / 2, -13, bw, 26, 13);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(lbl, 0, 1);
                    ctx.restore();
                }

                if (croc.phase === 'LILY_MISS_GRUMP') {
                    // Comical red cartoon anger vein mark 💢 + grumpy "GRRR!! MISSED!!" bubble
                    ctx.save();
                    const pulse = 1 + Math.sin(time * 22) * 0.08;
                    ctx.translate(croc.x, croc.y - 54 * scale);
                    ctx.scale(pulse, pulse);
                    const grumpLbl = '😤 GRRR!! MISSED!! 💢';
                    ctx.font = "900 13.5px 'Fredoka', sans-serif";
                    const gw = ctx.measureText(grumpLbl).width + 22;
                    ctx.fillStyle = '#FFF7ED';
                    ctx.strokeStyle = '#EA580C';
                    ctx.lineWidth = 2.8;
                    ctx.beginPath();
                    ctx.roundRect(-gw / 2, -14, gw, 28, 14);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#9A3412';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(grumpLbl, 0, 0.5);
                    ctx.restore();
                }

                if (croc.chompTextTimer > 0) {
                    const alpha = Math.min(1, croc.chompTextTimer * 1.4);
                    const popScale = 1 + Math.sin(Math.min(1, (1.25 - croc.chompTextTimer) * 6) * Math.PI) * 0.35;
                    ctx.save();
                    ctx.globalAlpha = alpha;
                    ctx.translate(croc.x, croc.y - 68 * scale);
                    ctx.scale(popScale, popScale);
                    ctx.rotate(-0.08);

                    // Spiky comic starburst behind CHOMP!!
                    ctx.fillStyle = '#FFD166';
                    ctx.strokeStyle = '#DC2626';
                    ctx.lineWidth = 3.2;
                    ctx.beginPath();
                    const spikes = 12;
                    for (let i = 0; i < spikes * 2; i++) {
                        const r = i % 2 === 0 ? 58 : 38;
                        const a = (i / (spikes * 2)) * Math.PI * 2 + time * 1.2;
                        const sx2 = Math.cos(a) * r;
                        const sy2 = Math.sin(a) * r * 0.56;
                        if (i === 0) ctx.moveTo(sx2, sy2);
                        else ctx.lineTo(sx2, sy2);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();

                    ctx.font = "900 22px 'Fredoka', sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.lineWidth = 5;
                    ctx.strokeStyle = '#7F1D1D';
                    ctx.strokeText('CHOMP!! 🐊', 0, 1);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillText('CHOMP!! 🐊', 0, 1);
                    ctx.restore();
                }

                if (croc.caughtHamsters.length > 0 && (croc.phase === 'CHOMP' || croc.phase === 'HAPPY_CHEW')) {
                    const latest = croc.caughtHamsters[croc.caughtHamsters.length - 1];
                    ctx.save();
                    for (let s = 0; s < 3; s++) {
                        const sa = time * 5.2 + (s * Math.PI * 2) / 3;
                        const stX = croc.x + Math.cos(sa) * 34 * scale;
                        const stY = croc.y - 34 * scale + Math.sin(sa) * 10 * scale;
                        ctx.fillStyle = s % 2 === 0 ? '#FFD166' : '#FFFFFF';
                        ctx.strokeStyle = '#3A1F0D';
                        ctx.lineWidth = 1.4;
                        ctx.beginPath();
                        ctx.arc(stX, stY, 4.5, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                    ctx.restore();

                    const caughtLabel = croc.caughtHamsters.length === 1
                        ? `🐊 GOT ${latest.name.toUpperCase()}!`
                        : `🐊 GOT ${croc.caughtHamsters.length} STUDENTS!`;
                    ctx.save();
                    ctx.font = "900 13.5px 'Fredoka', sans-serif";
                    const cw = ctx.measureText(caughtLabel).width + 24;
                    const cyBadge = croc.y + 42 * scale;
                    ctx.fillStyle = '#143324';
                    ctx.strokeStyle = '#FFD166';
                    ctx.lineWidth = 2.8;
                    ctx.beginPath();
                    ctx.roundRect(croc.x - cw / 2, cyBadge - 14, cw, 28, 14);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#FFD166';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(caughtLabel, croc.x, cyBadge + 0.5);
                    ctx.restore();
                }
            }
        };

        const renderScene = (time: number) => {
            const g = gameRef.current;
            const parent = canvas.parentElement;
            const w = parent ? parent.clientWidth : window.innerWidth;
            const h = parent ? parent.clientHeight : window.innerHeight;

            ctx.save();
            if (g.screenShake > 0.1) {
                const sx = (Math.random() - 0.5) * g.screenShake * 1.4;
                const sy = (Math.random() - 0.5) * g.screenShake * 1.4;
                ctx.translate(sx, sy);
            }

            drawTropicalLagoon(w, h, time);

            const layout = getBoatLayoutMetrics(w, h);
            const {
                cx,
                cy,
                boatRadius,
                bowlDepth,
                usableRadius,
                hamRadius,
                captainRadius,
                hullSegments,
                radialRibs,
                weaveRings,
                benchOffsets,
                floatBaseRatio,
                floatStepPx,
                cameraScale,
                safeTop,
                safeBottom,
                safeLeft,
                safeRight,
                tagTier
            } = layout;

            const croc = g.crocodile;
            const crocScale = Math.max(0.76, Math.min(1.18, Math.min(w, h) / 680));
            const isCrocSwimming =
                croc.phase === 'PATROL' ||
                croc.phase === 'STALKING' ||
                croc.phase === 'LILY_ROAM' ||
                croc.phase === 'LILY_STALK';
            const crocBehindBoat = isCrocSwimming && croc.y < cy + boatRadius * Math.sin(g.cameraPitch) * 0.15;

            // Draw patrolling/stalking crocodile behind the boat when it orbits to the far side of the lagoon
            if (crocBehindBoat) {
                drawCrocodileSwimming(croc, time, crocScale * 0.94);
            }

            const eliminated = g.students.filter(s => s.eliminated && !s.chompedByCroc);
            const sinCam = Math.sin(g.cameraPitch);
            const nameTagQueue: NameTagItem[] = [];

            const drawEliminatedSet = (isForeground: boolean) => {
                const elimScale = Math.max(0.72, Math.min(1.0, cameraScale + 0.14));
                eliminated.forEach((ham, idx) => {
                    const floatR = boatRadius * floatBaseRatio + (idx % 2) * floatStepPx;
                    const ang = ham.floatAngle + Math.sin(time * 0.45 + idx) * 0.08;
                    const sinA = Math.sin(ang);
                    if (isForeground ? (sinA < 0) : (sinA >= 0)) return;

                    const rawFx = cx + Math.cos(ang) * floatR;
                    const rawFy = cy + sinA * floatR * sinCam + Math.sin(time * 3 + idx) * 4;
                    const fx = Math.max(safeLeft + 26, Math.min(safeRight - 26, rawFx));
                    const fy = Math.max(safeTop + 28, Math.min(safeBottom - 22, rawFy));
                    const depthScale = (0.85 + (sinA + 1) * 0.12) * elimScale;

                    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(fx, fy + 6 * depthScale, 30 * depthScale, 15 * depthScale, 0, 0, Math.PI * 2);
                    ctx.stroke();

                    const tubeGrad = ctx.createRadialGradient(fx - 6 * depthScale, fy - 2 * depthScale, 3 * depthScale, fx, fy + 4 * depthScale, 26 * depthScale);
                    tubeGrad.addColorStop(0, '#FFFFFF');
                    tubeGrad.addColorStop(0.25, ham.tubeColor);
                    tubeGrad.addColorStop(1, ham.tubeColor);
                    ctx.fillStyle = tubeGrad;
                    ctx.strokeStyle = '#3A1F0D';
                    ctx.lineWidth = Math.max(2, 2.8 * depthScale);
                    ctx.beginPath();
                    ctx.ellipse(fx, fy + 4 * depthScale, 25 * depthScale, 14.5 * depthScale, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    drawHamsterCharacter(ctx, fx, fy - 4 * depthScale, 16 * depthScale, ham, time, false, g.captainPaddlePhase, g.state === 'IDLE' || g.state === 'READY');
                    const elimTagY = fy - 28 * depthScale;
                    nameTagQueue.push({
                        x: fx,
                        y: elimTagY,
                        anchorX: fx,
                        anchorY: elimTagY,
                        name: ham.name,
                        displayText: formatSmartTagName(ham.name, Math.max(10, tagTier.maxChars)),
                        isCaptain: false,
                        accentColor: ham.vest?.main,
                        fontSize: Math.max(10, tagTier.fontSize),
                        boxH: Math.max(17, tagTier.boxH),
                        paddingX: Math.max(6.5, tagTier.paddingX),
                        maxWidth: tagTier.maxWidth
                    });
                });
            };

            drawEliminatedSet(false);

            const rockScale = Math.max(0.55, cameraScale);
            const rockX = Math.sin(g.boatRockPhase * 0.5) * 7 * rockScale;
            const rockY = Math.cos(g.boatRockPhase * 0.8) * 5 * rockScale;
            const boatX = cx + rockX;
            const boatY = cy + rockY;

            const active = g.students.filter(s => !s.eliminated);
            const SEGMENTS = hullSegments;
            const rimPoints: {
                i: number;
                pRim0: ReturnType<typeof projectBoatPoint>;
                pRim1: ReturnType<typeof projectBoatPoint>;
                pMid0: ReturnType<typeof projectBoatPoint>;
                pMid1: ReturnType<typeof projectBoatPoint>;
                pBot0: ReturnType<typeof projectBoatPoint>;
                pBot1: ReturnType<typeof projectBoatPoint>;
                avgDepth: number;
            }[] = [];

            for (let i = 0; i < SEGMENTS; i++) {
                const ang = (i / SEGMENTS) * Math.PI * 2;
                const nextAng = ((i + 1) / SEGMENTS) * Math.PI * 2;
                const cos0 = Math.cos(ang), sin0 = Math.sin(ang);
                const cos1 = Math.cos(nextAng), sin1 = Math.sin(nextAng);

                const pRim0 = projectBoatPoint(cos0 * boatRadius, sin0 * boatRadius, 0, boatX, boatY);
                const pRim1 = projectBoatPoint(cos1 * boatRadius, sin1 * boatRadius, 0, boatX, boatY);
                const pMid0 = projectBoatPoint(cos0 * boatRadius * 0.88, sin0 * boatRadius * 0.88, -bowlDepth * 0.56, boatX, boatY);
                const pMid1 = projectBoatPoint(cos1 * boatRadius * 0.88, sin1 * boatRadius * 0.88, -bowlDepth * 0.56, boatX, boatY);
                const pBot0 = projectBoatPoint(cos0 * boatRadius * 0.52, sin0 * boatRadius * 0.52, -bowlDepth, boatX, boatY);
                const pBot1 = projectBoatPoint(cos1 * boatRadius * 0.52, sin1 * boatRadius * 0.52, -bowlDepth, boatX, boatY);

                rimPoints.push({
                    i,
                    pRim0,
                    pRim1,
                    pMid0,
                    pMid1,
                    pBot0,
                    pBot1,
                    avgDepth: (pRim0.depth + pRim1.depth) * 0.5
                });
            }

            // Smooth organic concentric foam wake rings around the boat
            ctx.save();
            const wakeRx = boatRadius * 1.13;
            const wakeRy = boatRadius * sinCam * 1.01;
            ctx.translate(boatX, boatY + bowlDepth * 0.34);

            // Deep water shadow under boat hull
            ctx.fillStyle = 'rgba(7, 42, 56, 0.36)';
            ctx.beginPath();
            ctx.ellipse(0, 8, wakeRx * 0.94, wakeRy * 0.90, 0, 0, Math.PI * 2);
            ctx.fill();

            // Smooth pulsing water ripple rings (adds an extra grand ripple on large boats)
            const wakeRingScales = layout.boatScale >= 1.35 ? [1.0, 1.11, 1.22] : [1.0, 1.14];
            wakeRingScales.forEach((ringScale, rIdx) => {
                const pulse = Math.sin(time * 3.2 - rIdx * 1.3) * 0.028;
                const rx = wakeRx * (ringScale + pulse);
                const ry = wakeRy * (ringScale + pulse);
                ctx.strokeStyle = rIdx === 0
                    ? 'rgba(224, 242, 254, 0.62)'
                    : rIdx === 1
                        ? 'rgba(165, 243, 252, 0.36)'
                        : 'rgba(165, 243, 252, 0.18)';
                ctx.lineWidth = rIdx === 0 ? (3.5 + Math.min(4, g.boatSpeed * 0.8)) : rIdx === 1 ? 2.0 : 1.4;
                ctx.beginPath();
                ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
                ctx.stroke();
            });
            ctx.restore();

            // Dynamically place painted hull letters so they stay centered regardless of hullSegments count
            const cocoStart = Math.round(SEGMENTS * 0.08);
            const chaosStart = Math.round(SEGMENTS * 0.58);
            const hullLetters: Record<number, string> = {
                [cocoStart]: 'C',
                [cocoStart + 1]: 'O',
                [cocoStart + 2]: 'C',
                [cocoStart + 3]: 'O',
                [chaosStart]: 'C',
                [chaosStart + 1]: 'H',
                [chaosStart + 2]: 'A',
                [chaosStart + 3]: 'O',
                [chaosStart + 4]: 'S'
            };

            // Exterior hull wall segments drawn BEFORE interior bowl so the basket interior is never occluded
            const drawHullWallSegment = (seg: typeof rimPoints[number]) => {
                const { pRim0, pRim1, pMid0, pMid1, pBot0, pBot1, i } = seg;
                if (pMid0.y <= pRim0.y - 2 && pMid1.y <= pRim1.y - 2) return;

                ctx.save();
                const stripeColors = ['#4A2C11', '#5C3A21', '#D90429', '#F4A261', '#1D3557', '#2A9D8F'];
                const panelColor = (i % 3 === 0) ? stripeColors[Math.floor(i / 3) % stripeColors.length] : ((i % 2 === 0) ? '#5C3A21' : '#4A2C11');

                ctx.fillStyle = panelColor;
                ctx.strokeStyle = '#3A2210';
                ctx.lineWidth = 1.8;

                ctx.beginPath();
                ctx.moveTo(pRim0.x, pRim0.y);
                ctx.lineTo(pRim1.x, pRim1.y);
                ctx.lineTo(pMid1.x, pMid1.y);
                ctx.lineTo(pBot1.x, pBot1.y);
                ctx.lineTo(pBot0.x, pBot0.y);
                ctx.lineTo(pMid0.x, pMid0.y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                const letter = hullLetters[i];
                if (letter && pMid0.y > pRim0.y + 8) {
                    const lx = (pRim0.x + pRim1.x + pMid0.x + pMid1.x) * 0.25;
                    const ly = (pRim0.y + pRim1.y + pMid0.y + pMid1.y) * 0.25;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.font = `900 ${Math.max(10, Math.round(12 * Math.max(0.85, cameraScale)))}px 'Fredoka', sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(letter, lx, ly);
                }
                ctx.restore();
            };

            const rimThickness = Math.max(11, Math.min(16, 13.5 * (0.85 + cameraScale * 0.22)));
            const drawColorfulRimSegment = (seg: typeof rimPoints[number]) => {
                const { pRim0, pRim1, i } = seg;
                const color = RIM_COLORS[i % RIM_COLORS.length];

                ctx.save();
                ctx.strokeStyle = '#3A2210';
                ctx.lineWidth = rimThickness + 4.8;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pRim0.x, pRim0.y);
                ctx.lineTo(pRim1.x, pRim1.y);
                ctx.stroke();

                ctx.strokeStyle = color;
                ctx.lineWidth = rimThickness;
                ctx.beginPath();
                ctx.moveTo(pRim0.x, pRim0.y);
                ctx.lineTo(pRim1.x, pRim1.y);
                ctx.stroke();

                // Gloss highlight along painted bamboo rim
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx.lineWidth = 2.8;
                ctx.beginPath();
                ctx.moveTo(pRim0.x, pRim0.y - 2);
                ctx.lineTo(pRim1.x, pRim1.y - 2);
                ctx.stroke();

                // Rattan lashing band at segment joint
                ctx.fillStyle = '#3A2210';
                ctx.beginPath();
                ctx.arc(pRim0.x, pRim0.y, rimThickness * 0.46, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            };

            // Draw exterior hull walls underneath the top rim plane
            const sortedHullSegments = [...rimPoints].sort((a, b) => a.avgDepth - b.avgDepth);
            sortedHullSegments.forEach(seg => drawHullWallSegment(seg));

            // Interior concave woven bamboo basket bowl
            ctx.save();
            ctx.beginPath();
            rimPoints.forEach((seg, idx) => {
                if (idx === 0) ctx.moveTo(seg.pRim0.x, seg.pRim0.y);
                else ctx.lineTo(seg.pRim0.x, seg.pRim0.y);
            });
            ctx.closePath();

            const centerFloor = projectBoatPoint(0, 0, -bowlDepth * 0.45, boatX, boatY);
            const intGrad = ctx.createRadialGradient(centerFloor.x, centerFloor.y, boatRadius * 0.08, boatX, boatY, boatRadius * 1.05);
            intGrad.addColorStop(0, '#C6925E');
            intGrad.addColorStop(0.45, '#E9CEB0');
            intGrad.addColorStop(0.82, '#D8B088');
            intGrad.addColorStop(1, '#7D5233');
            ctx.fillStyle = intGrad;
            ctx.fill();
            ctx.clip();

            // Woven bamboo concentric rings (scales up with boat size)
            weaveRings.forEach(rRatio => {
                const zLevel = -bowlDepth * 0.35 * (1 - rRatio * rRatio * 0.75);
                ctx.strokeStyle = 'rgba(92, 58, 33, 0.40)';
                ctx.lineWidth = 2.8;
                ctx.beginPath();
                for (let i = 0; i <= SEGMENTS; i++) {
                    const a = (i / SEGMENTS) * Math.PI * 2;
                    const pt = projectBoatPoint(Math.cos(a) * boatRadius * rRatio, Math.sin(a) * boatRadius * rRatio, zLevel, boatX, boatY);
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            });

            // Radial bamboo ribs (scales from 16 up to 24 ribs on larger boats)
            for (let i = 0; i < radialRibs; i++) {
                const a = (i / radialRibs) * Math.PI * 2;
                const pTop = projectBoatPoint(Math.cos(a) * boatRadius * 0.96, Math.sin(a) * boatRadius * 0.96, -2, boatX, boatY);
                const pMid = projectBoatPoint(Math.cos(a) * boatRadius * 0.62, Math.sin(a) * boatRadius * 0.62, -bowlDepth * 0.25, boatX, boatY);
                const pBot = projectBoatPoint(Math.cos(a) * boatRadius * 0.16, Math.sin(a) * boatRadius * 0.16, -bowlDepth * 0.42, boatX, boatY);

                ctx.strokeStyle = '#6C4325';
                ctx.lineWidth = radialRibs > 20 ? 4.6 : 5.4;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pTop.x, pTop.y);
                ctx.quadraticCurveTo(pMid.x, pMid.y, pBot.x, pBot.y);
                ctx.stroke();

                ctx.strokeStyle = '#F3D5B5';
                ctx.lineWidth = radialRibs > 20 ? 2.1 : 2.5;
                ctx.beginPath();
                ctx.moveTo(pTop.x, pTop.y);
                ctx.quadraticCurveTo(pMid.x, pMid.y, pBot.x, pBot.y);
                ctx.stroke();
            }

            // Wooden seating benches inside the basket boat (2 to 4 benches depending on boat size)
            const benchHalfWidthRatio = benchOffsets.length >= 4 ? 0.085 : benchOffsets.length === 3 ? 0.105 : 0.13;
            benchOffsets.forEach(yOffsetRatio => {
                const benchZ = -bowlDepth * 0.14;
                const halfLen = boatRadius * Math.sqrt(Math.max(0.18, 0.90 - yOffsetRatio * yOffsetRatio));
                const halfWid = boatRadius * benchHalfWidthRatio;
                const cyOff = boatRadius * yOffsetRatio;
                const corners = [
                    projectBoatPoint(-halfLen, cyOff - halfWid, benchZ, boatX, boatY),
                    projectBoatPoint(halfLen, cyOff - halfWid, benchZ, boatX, boatY),
                    projectBoatPoint(halfLen, cyOff + halfWid, benchZ, boatX, boatY),
                    projectBoatPoint(-halfLen, cyOff + halfWid, benchZ, boatX, boatY)
                ];
                ctx.fillStyle = '#E6CCB2';
                ctx.strokeStyle = '#5C3A21';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.moveTo(corners[0].x, corners[0].y);
                ctx.lineTo(corners[1].x, corners[1].y);
                ctx.lineTo(corners[2].x, corners[2].y);
                ctx.lineTo(corners[3].x, corners[3].y);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            });
            ctx.restore();

            // Back rim segments
            rimPoints.forEach(seg => {
                if (seg.avgDepth < 0) {
                    drawColorfulRimSegment(seg);
                }
            });

            // Front rim segments drawn BEFORE foreground characters so front-row hamsters peek over the rim
            const frontSegments = rimPoints.filter(seg => seg.avgDepth >= 0).sort((a, b) => a.avgDepth - b.avgDepth);
            frontSegments.forEach(seg => drawColorfulRimSegment(seg));

            // Depth-sorted hamsters & Captain Coconut inside the boat across all concentric rings
            const flyingIds = new Set(g.flyingHamsters.filter(f => f.delay <= 0).map(f => f.hamster.id));
            g.lilyFlights.forEach(lf => flyingIds.add(lf.hamster.id));
            g.escapeJumps.forEach(ej => flyingIds.add(ej.hamster.id));
            const renderEntities: {
                type: 'student' | 'captain';
                ham?: HamsterStudent;
                proj: ReturnType<typeof projectBoatPoint>;
                depth: number;
            }[] = [];

            active.forEach(ham => {
                if (flyingIds.has(ham.id) || ham.onLilyPadIndex !== null) return;
                const lx = ham.curX * usableRadius;
                const ly = ham.curY * usableRadius;
                const rNorm = Math.min(1, Math.hypot(lx, ly) / Math.max(1, boatRadius));
                const seatZ = -bowlDepth * 0.14 * (1 - rNorm * 0.65) + hamRadius * 0.42;
                const proj = projectBoatPoint(lx, ly, seatZ, boatX, boatY);
                renderEntities.push({ type: 'student', ham, proj, depth: proj.depth });
            });

            const capBounce = Math.abs(Math.sin(g.captainPaddlePhase)) * 7 * Math.max(0.7, cameraScale);
            const capProj = projectBoatPoint(0, -boatRadius * 0.84, hamRadius * 0.65 + capBounce, boatX, boatY);
            renderEntities.push({ type: 'captain', proj: capProj, depth: capProj.depth });

            renderEntities.sort((a, b) => a.depth - b.depth);

            const isIdleLike = g.state === 'IDLE' || g.state === 'READY';

            renderEntities.forEach(ent => {
                if (ent.type === 'captain') {
                    const capR = captainRadius;
                    drawHamsterCharacter(
                        ctx,
                        ent.proj.x,
                        ent.proj.y,
                        capR,
                        { wobbleAngle: Math.sin(time * 10) * 0.12 - g.boatTiltRoll * 0.45 },
                        time,
                        true,
                        g.captainPaddlePhase,
                        isIdleLike
                    );
                    const tagY = ent.proj.y - capR - 20;
                    nameTagQueue.push({
                        x: ent.proj.x,
                        y: tagY,
                        anchorX: ent.proj.x,
                        anchorY: tagY,
                        name: 'CAPTAIN COCONUT 🥥',
                        displayText: active.length > 36 ? 'CAPTAIN 🥥' : 'CAPTAIN COCONUT 🥥',
                        isCaptain: true,
                        priority: 'captain',
                        fontSize: active.length > 36 ? 11 : 12,
                        boxH: active.length > 36 ? 20 : 22,
                        paddingX: 8.5,
                        maxWidth: 190
                    });
                } else if (ent.ham) {
                    const ham = ent.ham;
                    const screenX = ent.proj.x;
                    const screenY = ent.proj.y + Math.sin(time * 5 + ham.bobOffset) * 2.0;
                    const depthFactor = Math.max(-1, Math.min(1, ent.proj.depth / Math.max(1, boatRadius)));
                    const scale = 0.90 + (depthFactor + 1) * 0.10;
                    const drawnR = hamRadius * scale;

                    drawHamsterCharacter(ctx, screenX, screenY, drawnR, ham, time, false, g.captainPaddlePhase, isIdleLike);
                    const tagOffset = Math.max(10, drawnR + (tagTier.boxH * 0.68));
                    const tagY = screenY - tagOffset;
                    nameTagQueue.push({
                        x: screenX,
                        y: tagY,
                        anchorX: screenX,
                        anchorY: tagY,
                        name: ham.name,
                        displayText: formatSmartTagName(ham.name, tagTier.maxChars),
                        isCaptain: false,
                        priority: 'normal',
                        accentColor: ham.vest?.main,
                        fontSize: tagTier.fontSize,
                        boxH: tagTier.boxH,
                        paddingX: tagTier.paddingX,
                        maxWidth: tagTier.maxWidth
                    });
                }
            });

            // Foreground eliminated hamsters (if any legacy inner-tube floaters)
            drawEliminatedSet(true);

            // Students perched on floating water lilies — react dynamically with funny scared/relieved emotions!
            const speechBubbleQueue: { x: number; y: number; text: string; isScared: boolean }[] = [];
            active.forEach(ham => {
                if (ham.onLilyPadIndex === null) return;
                const pad = g.lotusPads[ham.onLilyPadIndex];
                if (!pad) return;
                const pos = getLotusPadScreenPos(pad, ham.onLilyPadIndex, w, h, time, layout);
                const isStalked = croc.huntTargetPadIndex === ham.onLilyPadIndex && (croc.phase === 'LILY_STALK' || croc.phase === 'LILY_LUNGE');
                const isScared = ham.expression === 'terrified' || ham.expression === 'crying_funny' || ham.expression === 'hiding';
                const isRelieved = ham.expression === 'relieved_smug';

                // Pulsing red danger ring under the water lily currently being hunted by the crocodile!
                if (isStalked) {
                    ctx.save();
                    const pulseR = pos.r * (1.32 + Math.sin(time * 18) * 0.14);
                    ctx.strokeStyle = 'rgba(239, 35, 60, 0.9)';
                    ctx.lineWidth = 3.4;
                    ctx.setLineDash([7, 5]);
                    ctx.beginPath();
                    ctx.ellipse(pos.x, pos.y + 2, pulseR, pulseR * 0.58, 0, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Tremble wildly when scared, hop cheerfully when safe/relieved!
                const shiverX = isScared ? Math.sin(time * (isStalked ? 62 : 44) + ham.bobOffset) * (isStalked ? 3.5 : 2.1) : 0;
                const happyHop = isScared
                    ? Math.abs(Math.sin(time * 22 + ham.bobOffset)) * 2.5
                    : Math.abs(Math.sin((time - ham.lilyLandTime) * 5.5)) * 5;
                const sx = pos.x + shiverX;
                const sy = pos.y + pad.bounce * 8 - 10 - happyHop;
                const safeR = Math.max(15, Math.min(22, hamRadius * 0.95));

                if (g.state !== 'LILY_HUNT') {
                    ham.expression = ham.relievedUntil > time ? 'relieved_smug' : 'happy';
                }
                ham.wobbleAngle = isScared
                    ? Math.sin(time * 36 + ham.bobOffset) * 0.16
                    : Math.sin(time * 6 + ham.bobOffset) * 0.08;
                drawHamsterCharacter(ctx, sx, sy, safeR, ham, time, false, g.captainPaddlePhase, false);

                // Dynamic status badge below the lily pad
                ctx.save();
                const statusBadge = isStalked
                    ? '😱 DANGER!!'
                    : isScared
                        ? '😰 UH-OH!!'
                        : isRelieved
                            ? '💨 ESCAPED!'
                            : 'SAFE! 🪷';
                const badgeFill = isStalked
                    ? '#EF233C'
                    : isScared
                        ? '#F59E0B'
                        : '#06D6A0';
                const badgeTextCol = isStalked ? '#FFFFFF' : '#073B4C';
                ctx.font = "800 10.5px 'Fredoka', sans-serif";
                const sbw = ctx.measureText(statusBadge).width + 12;
                const sbx = Math.max(safeLeft + sbw / 2, Math.min(safeRight - sbw / 2, sx));
                const sby = Math.min(h - 14, pos.y + pos.r * 0.65 + 10);
                ctx.fillStyle = badgeFill;
                ctx.strokeStyle = isStalked ? '#FFFFFF' : '#143324';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(sbx - sbw / 2, sby - 9, sbw, 18, 9);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = badgeTextCol;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(statusBadge, sbx, sby + 0.5);
                ctx.restore();

                const safeTagY = sy - safeR - 14;
                nameTagQueue.push({
                    x: sx,
                    y: safeTagY,
                    anchorX: sx,
                    anchorY: safeTagY,
                    name: ham.name,
                    displayText: formatSmartTagName(ham.name, Math.max(11, tagTier.maxChars)),
                    isCaptain: false,
                    priority: isStalked ? 'spotlight' : 'normal',
                    accentColor: isStalked ? '#EF233C' : '#06D6A0',
                    fontSize: Math.max(10.5, tagTier.fontSize),
                    boxH: Math.max(18, tagTier.boxH),
                    paddingX: Math.max(7, tagTier.paddingX),
                    maxWidth: tagTier.maxWidth
                });

                if (ham.speechBubble && time < ham.speechExpiry) {
                    speechBubbleQueue.push({
                        x: sx,
                        y: safeTagY - 24,
                        text: ham.speechBubble,
                        isScared: isScared || isStalked
                    });
                }
            });

            // Foreground patrolling/stalking crocodile
            if (isCrocSwimming && !crocBehindBoat) {
                drawCrocodileSwimming(croc, time, crocScale * 1.05);
            }

            // Lunging crocodile BACK pass (water foam, body, tail, open throat, tongue, lower jaw)
            if (!isCrocSwimming) {
                drawCrocodileLunging(croc, time, crocScale * 1.15, 'back');
            }

            // Render funny panic / escape comic speech bubbles above lily-pad hamsters
            speechBubbleQueue.forEach(sb => {
                ctx.save();
                ctx.font = "800 11.5px 'Fredoka', sans-serif";
                const bw = ctx.measureText(sb.text).width + 18;
                const bx = Math.max(safeLeft + bw / 2 + 4, Math.min(safeRight - bw / 2 - 4, sb.x));
                const by = Math.max(safeTop + 14, sb.y);
                ctx.fillStyle = sb.isScared ? '#FFFBEB' : '#ECFDF5';
                ctx.strokeStyle = sb.isScared ? '#EA580C' : '#059669';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.roundRect(bx - bw / 2, by - 11, bw, 22, 11);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = sb.isScared ? '#9A3412' : '#065F46';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(sb.text, bx, by + 0.5);
                ctx.restore();
            });

            // Resolve overlapping name tags cleanly within safe HUD bounds and render upright badges
            resolveNameTagCollisions(nameTagQueue, ctx, {
                left: safeLeft,
                right: safeRight,
                top: safeTop - 16,
                bottom: safeBottom + 12
            });
            // Draw normal tags first, Captain on top
            nameTagQueue
                .slice()
                .sort((a, b) => (a.isCaptain ? 1 : 0) - (b.isCaptain ? 1 : 0))
                .forEach(tag => drawNameTag(tag));

            // Airborne hamsters flying safely toward floating water lilies
            const arcScale = Math.max(0.68, cameraScale);
            g.lilyFlights.forEach(lf => {
                const t = Math.min(1, lf.t);
                const curX = lf.startX + (lf.targetX - lf.startX) * t;
                const arcHeight = Math.sin(t * Math.PI) * 185 * arcScale;
                const curY = lf.startY + (lf.targetY - lf.startY) * t - arcHeight;
                const zoomScale = 1 + Math.sin(t * Math.PI) * 0.72;

                lf.trail.push({ x: curX, y: curY });
                if (lf.trail.length > 16) lf.trail.shift();

                if (lf.trail.length > 2) {
                    ctx.save();
                    ctx.strokeStyle = t < 0.55 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(6, 214, 160, 0.9)';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([8, 6]);
                    ctx.beginPath();
                    lf.trail.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.stroke();
                    ctx.restore();
                }

                // Target highlight ring on destination water lily
                ctx.save();
                ctx.strokeStyle = `rgba(6, 214, 160, ${0.45 + Math.sin(time * 16) * 0.35})`;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(lf.targetX, lf.targetY + 4, 34, 19, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                lf.hamster.wobbleAngle = t * Math.PI * 4.5;
                lf.hamster.expression = t < 0.65 ? 'shocked' : 'excited';
                const flyR = Math.max(19, hamRadius * zoomScale);
                drawHamsterCharacter(ctx, curX, curY, flyR, lf.hamster, time, false, g.captainPaddlePhase, false);

                const clampedTagY = Math.max(safeTop + 34, curY - flyR - 18);
                drawNameTag({
                    x: Math.max(safeLeft + 60, Math.min(safeRight - 60, curX)),
                    y: clampedTagY,
                    anchorX: curX,
                    anchorY: clampedTagY,
                    name: lf.hamster.name,
                    displayText: lf.hamster.name,
                    isCaptain: false,
                    priority: 'spotlight',
                    accentColor: '#06D6A0',
                    fontSize: 13,
                    boxH: 24,
                    paddingX: 10,
                    maxWidth: 220
                });

                const badgeText = t < 0.6 ? '😱 FLYING OUT!!' : '🪷 LANDING ON LILY PAD!!';
                const badgeBg = t < 0.6 ? '#F59E0B' : '#06D6A0';
                const badgeFg = t < 0.6 ? '#FFFFFF' : '#073B4C';
                ctx.save();
                ctx.font = "800 12px 'Fredoka', sans-serif";
                const bWidth = ctx.measureText(badgeText).width + 18;
                const bx = Math.max(safeLeft + bWidth / 2, Math.min(safeRight - bWidth / 2, curX));
                const by = Math.max(safeTop + 12, clampedTagY - 26);
                ctx.fillStyle = badgeBg;
                ctx.strokeStyle = '#3A2210';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.roundRect(bx - bWidth / 2, by - 11, bWidth, 22, 11);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = badgeFg;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(badgeText, bx, by);
                ctx.restore();
            });

            // Hilarious last-second escape jumps over the crocodile's snapping jaws!
            g.escapeJumps.forEach(ej => {
                const t = Math.min(1, ej.t);
                const curX = ej.startX + (ej.targetX - ej.startX) * t;
                const arcH = Math.sin(t * Math.PI) * 210 * arcScale;
                const curY = ej.startY + (ej.targetY - ej.startY) * t - arcH;
                const zoomScale = 1 + Math.sin(t * Math.PI) * 0.78;

                ej.trail.push({ x: curX, y: curY });
                if (ej.trail.length > 18) ej.trail.shift();
                if (ej.trail.length > 2) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255, 209, 102, 0.92)';
                    ctx.lineWidth = 4.5;
                    ctx.setLineDash([7, 5]);
                    ctx.beginPath();
                    ej.trail.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.stroke();
                    ctx.restore();
                }

                ej.hamster.wobbleAngle = -t * Math.PI * 4;
                ej.hamster.expression = t < 0.45 ? 'terrified' : 'relieved_smug';
                const flyR = Math.max(20, hamRadius * zoomScale);
                drawHamsterCharacter(ctx, curX, curY, flyR, ej.hamster, time, false, g.captainPaddlePhase, false);

                const clampedTagY = Math.max(safeTop + 34, curY - flyR - 18);
                drawNameTag({
                    x: Math.max(safeLeft + 60, Math.min(safeRight - 60, curX)),
                    y: clampedTagY,
                    anchorX: curX,
                    anchorY: clampedTagY,
                    name: ej.hamster.name,
                    displayText: ej.hamster.name,
                    isCaptain: false,
                    priority: 'spotlight',
                    accentColor: '#FFD166',
                    fontSize: 13,
                    boxH: 24,
                    paddingX: 10,
                    maxWidth: 220
                });

                const escBadge = `💨 ESCAPED!! ${ej.escapeQuote}`;
                ctx.save();
                ctx.font = "900 12px 'Fredoka', sans-serif";
                const ew = ctx.measureText(escBadge).width + 18;
                const ex = Math.max(safeLeft + ew / 2, Math.min(safeRight - ew / 2, curX));
                const ey = Math.max(safeTop + 12, clampedTagY - 26);
                ctx.fillStyle = '#06D6A0';
                ctx.strokeStyle = '#143324';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.roundRect(ex - ew / 2, ey - 11, ew, 22, 11);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#073B4C';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(escBadge, ex, ey);
                ctx.restore();
            });

            // Chosen target hamster(s) arcing straight down into the crocodile's wide-open jaws!
            const launchArcScale = Math.max(0.72, cameraScale);
            g.flyingHamsters.forEach(fh => {
                if (fh.delay > 0 || fh.splashed) return;
                const t = Math.min(1, fh.t);
                const curX = fh.startX + (fh.targetX - fh.startX) * t;
                const arcPeak = fh.fromLilyPad ? 185 : 215;
                const curY = fh.startY + (fh.targetY - fh.startY) * t - Math.sin(t * Math.PI) * arcPeak * launchArcScale;
                // Shrink slightly right as the hamster drops inside the open mouth (t = 0.85..1.0)
                const mouthDropScale = t > 0.84 ? Math.max(0.45, 1 - ((t - 0.84) / 0.16) * 0.55) : 1;
                const zoomScale = (1 + Math.sin(t * Math.PI) * 0.82) * mouthDropScale;
                const flyR = Math.max(16, hamRadius * zoomScale);

                fh.trail.push({ x: curX, y: curY });
                if (fh.trail.length > 18) fh.trail.shift();
                if (fh.trail.length > 2) {
                    ctx.save();
                    ctx.strokeStyle = 'rgba(239, 35, 60, 0.88)';
                    ctx.lineWidth = 4.5;
                    ctx.setLineDash([8, 6]);
                    ctx.beginPath();
                    fh.trail.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.stroke();
                    ctx.restore();
                }

                fh.hamster.wobbleAngle = t * Math.PI * 6;
                fh.hamster.expression = 'scream';
                drawHamsterCharacter(ctx, curX, curY, flyR, fh.hamster, time, false, g.captainPaddlePhase, false);

                if (t < 0.92) {
                    const clampedTagY = Math.max(safeTop + 34, curY - flyR - 18);
                    drawNameTag({
                        x: Math.max(safeLeft + 60, Math.min(safeRight - 60, curX)),
                        y: clampedTagY,
                        anchorX: curX,
                        anchorY: clampedTagY,
                        name: fh.hamster.name,
                        displayText: fh.hamster.name,
                        isCaptain: false,
                        priority: 'spotlight',
                        accentColor: '#EF233C',
                        fontSize: 13.5,
                        boxH: 25,
                        paddingX: 10,
                        maxWidth: 230
                    });

                    const dangerBadge = '🐊 FALLING TO THE CROC!!';
                    ctx.save();
                    ctx.font = "900 12px 'Fredoka', sans-serif";
                    const dw = ctx.measureText(dangerBadge).width + 18;
                    const dx = Math.max(safeLeft + dw / 2, Math.min(safeRight - dw / 2, curX));
                    const dy = Math.max(safeTop + 12, clampedTagY - 26);
                    ctx.fillStyle = '#EF233C';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2.4;
                    ctx.beginPath();
                    ctx.roundRect(dx - dw / 2, dy - 11, dw, 22, 11);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = '#FFFFFF';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(dangerBadge, dx, dy);
                    ctx.restore();
                }
            });

            // Lunging crocodile FRONT pass (upper jaw, teeth, brow, eyes, CHOMP!! sunburst & happy-chew badge)
            // Drawn AFTER falling hamsters so the upper jaw truly chomps OVER the falling student!
            if (!isCrocSwimming) {
                drawCrocodileLunging(croc, time, crocScale * 1.15, 'front');
            }

            // Splash & sparkle particles
            g.particles.forEach(p => {
                ctx.save();
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });

            ctx.restore();
        };

        const loop = (now: number) => {
            const rawDt = Math.min(0.05, (now - lastFrameTime) / 1000);
            lastFrameTime = now;
            const g = gameRef.current;
            const dt = rawDt * g.slowMoFactor;
            const time = now / 1000;

            const parent = canvas.parentElement;
            const w = parent ? parent.clientWidth : window.innerWidth;
            const h = parent ? parent.clientHeight : window.innerHeight;

            updateGameLogic(dt, time, w, h);
            renderScene(time);

            animId = requestAnimationFrame(loop);
        };

        syncRoster(students);
        animId = requestAnimationFrame(loop);

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
            soundRef.current.stopTropicalMusic();
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            onClick={() => {
                if (canClickToSpin && onStageClick) {
                    onStageClick();
                }
            }}
            className={`w-full h-full block select-none ${canClickToSpin ? 'cursor-pointer' : ''}`}
        />
    );
});
