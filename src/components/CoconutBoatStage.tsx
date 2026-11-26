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
    onStateChange?: (state: {
        phase: string;
        msg: string;
        eliminatedThisRound: string[];
        activeCount: number;
        chaseSecondsLeft?: number;
        cameraMode?: 'side' | 'dynamic' | 'high';
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

    startTropicalMusic() {
        this.stopTropicalMusic();
        this.init();
        const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
        const pattern = [0, 2, 3, 2, 4, 3, 1, 0, 2, 4, 5, 4, 3, 2, 1, 0];
        this.musicTimer = window.setInterval(() => {
            if (!this.sfxEnabled || !this.ctx) return;
            const freq = scale[pattern[this.melodyStep % pattern.length]];
            this.melodyStep++;
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.07 * this.volume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        }, 210);
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
    expression: 'happy' | 'excited' | 'dizzy' | 'shocked' | 'scream' | 'crown';
    floatAngle: number;
    floatDist: number;
    tubeColor: string;
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
}

interface FakeOutFlight {
    hamster: HamsterStudent;
    startX: number;
    startY: number;
    peakOutX: number;
    peakOutY: number;
    t: number;
    duration: number;
    savedTriggered: boolean;
    isClimaxFakeOut: boolean;
    trail: { x: number; y: number }[];
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
    } else if (expr === 'shocked' || expr === 'scream') {
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
    if (expr === 'scream' || expr === 'shocked') {
        targetCtx.fillStyle = '#D90429';
        targetCtx.beginPath();
        targetCtx.ellipse(0, radius * 0.16, radius * 0.17, radius * 0.21, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        // Little pink tongue inside mouth
        targetCtx.fillStyle = '#FF8FA3';
        targetCtx.beginPath();
        targetCtx.arc(0, radius * 0.24, radius * 0.09, 0, Math.PI, true);
        targetCtx.fill();
    } else {
        // Cute cat/hamster 'w' smile with tiny buck tooth
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.fillRect(-radius * 0.05, radius * 0.06, radius * 0.10, radius * 0.09);
        targetCtx.beginPath();
        targetCtx.arc(-radius * 0.09, radius * 0.05, radius * 0.09, 0, Math.PI);
        targetCtx.arc(radius * 0.09, radius * 0.05, radius * 0.09, 0, Math.PI);
        targetCtx.stroke();
    }

    // Animated Paws (raised in panic during chaos or gripping vest straps)
    const isPanic = expr === 'scream' || expr === 'shocked' || expr === 'dizzy';
    const pawWave = isPanic
        ? Math.sin(time * 24 + (hamster.bobOffset || 0)) * radius * 0.26
        : Math.sin(time * 4 + (hamster.bobOffset || 0)) * radius * 0.07;
    targetCtx.fillStyle = bellyColor;
    targetCtx.strokeStyle = '#3A1F0D';
    targetCtx.lineWidth = Math.max(1.8, radius * 0.08);
    [-1, 1].forEach(dir => {
        const px = dir * radius * (isPanic ? 0.78 : 0.56);
        const py = isPanic ? (-radius * 0.12 + dir * pawWave) : (radius * 0.48 - Math.abs(pawWave));
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
    onStateChange,
    onRoundComplete
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const soundRef = useRef<CoconutSoundEngine>(new CoconutSoundEngine());

    const gameRef = useRef({
        state: 'IDLE' as 'IDLE' | 'READY' | 'SLOW_SPIN' | 'CHAOS_SPIN' | 'LAUNCHING' | 'RESULT',
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
        students: [] as HamsterStudent[],
        targetsToEliminate: [] as string[],
        flyingHamsters: [] as FlyingHamster[],
        fakeOutFlight: null as FakeOutFlight | null,
        nextFakeOutTime: 1.25,
        didClimaxFakeOut: false,
        lastFakeOutId: '',
        particles: [] as Particle[],
        quoteTimer: 0,
        activeBanner: '',
        bannerExpiry: 0,
        lastReportedSec: -1,
        lotusPads: [
            { xRatio: 0.10, yRatio: 0.46, r: 26, rot: 0.4, flower: '#FF758F' as string | null },
            { xRatio: 0.89, yRatio: 0.49, r: 30, rot: 2.1, flower: '#FFD166' as string | null },
            { xRatio: 0.08, yRatio: 0.78, r: 36, rot: 1.2, flower: '#FF4D6D' as string | null },
            { xRatio: 0.91, yRatio: 0.82, r: 32, rot: 3.8, flower: '#FF8FA3' as string | null },
            { xRatio: 0.20, yRatio: 0.89, r: 28, rot: 5.1, flower: '#FFF8E7' as string | null },
            { xRatio: 0.81, yRatio: 0.66, r: 24, rot: 1.9, flower: null as string | null }
        ],
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
        return {
            id: `ham_${index}_${name}`,
            name: name.trim(),
            palette,
            vest,
            accessory,
            eliminated: false,
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

    const syncRoster = (names: string[]) => {
        const g = gameRef.current;
        g.students = names.map((n, i) => createHamsterFromName(n, i));
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
            g.flyingHamsters = [];
            g.fakeOutFlight = null;
            g.nextFakeOutTime = 1.15;
            g.didClimaxFakeOut = false;
            g.lastFakeOutId = '';
            g.state = 'READY';
            g.activeBanner = '';
            g.lastReportedSec = Math.ceil(g.roundDuration);

            onStateChangeRef.current?.({
                phase: 'COCONUT_READY',
                msg: '',
                eliminatedThisRound: [],
                activeCount: roster.length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode
            });
        },
        beginSpin: () => {
            const g = gameRef.current;
            g.phaseTimer = 0;
            g.quoteTimer = 1.1;
            g.slowMoFactor = 1.0;
            g.flyingHamsters = [];
            g.fakeOutFlight = null;
            g.nextFakeOutTime = 1.15;
            g.didClimaxFakeOut = false;
            g.lastFakeOutId = '';
            g.state = 'SLOW_SPIN';
            g.activeBanner = '🚣 NICE AND EASY… EVERYONE IS SAFE! 🐹';
            g.bannerExpiry = performance.now() + 2200;
            g.lastReportedSec = Math.ceil(g.roundDuration);

            soundRef.current.init();
            soundRef.current.playPop(580);
            soundRef.current.playPaddleSplash(0.8);
            soundRef.current.startTropicalMusic();

            onStateChangeRef.current?.({
                phase: 'SLOW_SPIN',
                msg: '🚣 NICE AND EASY… EVERYONE IS SAFE! 🐹',
                eliminatedThisRound: [],
                activeCount: g.students.filter(s => !s.eliminated).length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode
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
            g.flyingHamsters = [];
            g.fakeOutFlight = null;
            g.nextFakeOutTime = 1.15;
            g.didClimaxFakeOut = false;
            g.lastFakeOutId = '';
            g.state = 'SLOW_SPIN';
            g.activeBanner = '🚣 NICE AND EASY… EVERYONE IS SAFE! 🐹';
            g.bannerExpiry = performance.now() + 2200;
            g.lastReportedSec = Math.ceil(g.roundDuration);

            soundRef.current.init();
            soundRef.current.playPop(580);
            soundRef.current.startTropicalMusic();

            onStateChangeRef.current?.({
                phase: 'SLOW_SPIN',
                msg: '🚣 NICE AND EASY… EVERYONE IS SAFE! 🐹',
                eliminatedThisRound: [],
                activeCount: roster.length,
                chaseSecondsLeft: Math.ceil(g.roundDuration),
                cameraMode: g.cameraMode
            });
        },
        resetToIdle: (roster: string[]) => {
            const g = gameRef.current;
            soundRef.current.stopTropicalMusic();
            g.state = 'IDLE';
            g.flyingHamsters = [];
            g.fakeOutFlight = null;
            g.didClimaxFakeOut = false;
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

        const startFakeOutFlight = (w: number, h: number, isClimaxFakeOut = false) => {
            const g = gameRef.current;
            const active = g.students.filter(s => !s.eliminated);
            if (active.length === 0) return false;

            const targetSet = new Set(g.targetsToEliminate);
            let candidates = active.filter(s => s.id !== g.lastFakeOutId && (!isClimaxFakeOut || !targetSet.has(s.name)));
            if (candidates.length === 0) {
                candidates = active.filter(s => s.id !== g.lastFakeOutId);
            }
            if (candidates.length === 0) {
                candidates = active;
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            g.lastFakeOutId = chosen.id;

            const layout = getBoatLayoutMetrics(w, h);
            const { cx, cy, boatRadius, usableRadius, floatBaseRatio, safeLeft, safeRight, safeTop, safeBottom } = layout;

            const lx = (g.state === 'CHAOS_SPIN' ? chosen.curX : chosen.seatX) * usableRadius;
            const ly = (g.state === 'CHAOS_SPIN' ? chosen.curY : chosen.seatY) * usableRadius;
            const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.06, cx, cy);

            const baseAngle = Math.atan2(startProj.y - cy, startProj.x - cx);
            const outDist = boatRadius * Math.min(1.42, floatBaseRatio);
            const peakOutX = Math.max(safeLeft + 36, Math.min(safeRight - 36, cx + Math.cos(baseAngle) * outDist));
            const peakOutY = Math.max(safeTop + 56, Math.min(safeBottom - 36, cy + Math.sin(baseAngle) * outDist * Math.sin(g.cameraPitch) - 18));

            g.fakeOutFlight = {
                hamster: chosen,
                startX: startProj.x,
                startY: startProj.y,
                peakOutX,
                peakOutY,
                t: 0,
                duration: isClimaxFakeOut ? 1.55 : 1.35,
                savedTriggered: false,
                isClimaxFakeOut,
                trail: [{ x: startProj.x, y: startProj.y }]
            };

            const fakeLabel = `OH NOOOOO! 💦 ${chosen.name.toUpperCase()} IS FLYING OVER THE RIM!`;
            g.activeBanner = fakeLabel;
            g.bannerExpiry = performance.now() + 1800;
            soundRef.current.playFakeoutWhistle();

            const remSec = Math.max(0, Math.ceil(g.roundDuration - g.phaseTimer));
            onStateChangeRef.current?.({
                phase: g.state,
                msg: fakeLabel,
                eliminatedThisRound: [],
                activeCount: active.length,
                chaseSecondsLeft: remSec,
                cameraMode: g.cameraMode
            });
            return true;
        };

        const launchTargetVictims = (w: number, h: number) => {
            const g = gameRef.current;
            const active = g.students.filter(s => !s.eliminated);
            if (active.length === 0) return;

            const targetSet = new Set(g.targetsToEliminate);
            let victims = active.filter(s => targetSet.has(s.name));
            if (victims.length === 0) {
                victims = [active[Math.floor(Math.random() * active.length)]];
            }

            const layout = getBoatLayoutMetrics(w, h);
            const { cx, cy, boatRadius, usableRadius, floatBaseRatio, safeLeft, safeRight, safeTop, safeBottom } = layout;

            g.flyingHamsters = victims.map((victim, idx) => {
                const lx = victim.seatX * usableRadius;
                const ly = victim.seatY * usableRadius;
                const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.06, cx, cy);

                const splashAngle = (idx / Math.max(1, victims.length)) * Math.PI * 2 + Math.atan2(startProj.y - cy, startProj.x - cx);
                const targetDist = boatRadius * floatBaseRatio;
                const targetX = Math.max(safeLeft + 34, Math.min(safeRight - 34, cx + Math.cos(splashAngle) * targetDist));
                const targetY = Math.max(safeTop + 44, Math.min(safeBottom - 34, cy + Math.sin(splashAngle) * targetDist * Math.sin(g.cameraPitch)));

                victim.floatAngle = splashAngle;

                return {
                    hamster: victim,
                    startX: startProj.x,
                    startY: startProj.y,
                    targetX,
                    targetY,
                    t: 0,
                    delay: idx * 0.14,
                    splashed: false
                };
            });

            g.state = 'LAUNCHING';
            const label = victims.length === 1
                ? `OH NOOOOO! 💦 ${victims[0].name.toUpperCase()} FELL OFF THE BOAT!`
                : `OH NOOOOO! 💦 ${victims.length} HAMSTERS FELL OFF THE BOAT!`;
            g.activeBanner = label;
            g.bannerExpiry = performance.now() + 2000;
            soundRef.current.playFallWhistle();

            onStateChangeRef.current?.({
                phase: 'LAUNCHING',
                msg: label,
                eliminatedThisRound: [],
                activeCount: active.length,
                chaseSecondsLeft: 0,
                cameraMode: g.cameraMode
            });
        };

        const updateFakeOutFlight = (dt: number, w: number, h: number) => {
            const g = gameRef.current;
            const fo = g.fakeOutFlight;
            if (!fo) return;

            fo.t += dt / fo.duration;

            if (fo.t > 0.36 && fo.t < 0.56) {
                g.slowMoFactor = 0.52;
            } else {
                g.slowMoFactor = 1.0;
            }

            if (fo.t >= 0.54 && !fo.savedTriggered) {
                fo.savedTriggered = true;
                soundRef.current.playBoingSave();
                spawnSaveSparkles(fo.peakOutX, fo.peakOutY, true);

                const saveMsg = `😅 PHEW!! ${fo.hamster.name.toUpperCase()} FLEW BACK INTO THE BOAT!! 🛶✨`;
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
            }

            if (fo.t >= 1.0) {
                const layout = getBoatLayoutMetrics(w, h);
                const rockScale = Math.max(0.55, layout.cameraScale);
                const cx = layout.cx + Math.sin(g.boatRockPhase * 0.5) * 7 * rockScale;
                const cy = layout.cy + Math.cos(g.boatRockPhase * 0.8) * 5 * rockScale;
                const { boatRadius, usableRadius } = layout;
                const lx = (g.state === 'CHAOS_SPIN' ? fo.hamster.curX : fo.hamster.seatX) * usableRadius;
                const ly = (g.state === 'CHAOS_SPIN' ? fo.hamster.curY : fo.hamster.seatY) * usableRadius;
                const landProj = projectBoatPoint(lx, ly, -boatRadius * 0.06, cx, cy);

                spawnSaveSparkles(landProj.x, landProj.y, false);
                soundRef.current.playPop(740);
                fo.hamster.expression = 'happy';
                fo.hamster.wobbleAngle = 0;
                const wasClimax = fo.isClimaxFakeOut;
                g.fakeOutFlight = null;
                g.slowMoFactor = 1.0;

                if (wasClimax) {
                    launchTargetVictims(w, h);
                }
            }
        };

        const updateGameLogic = (dt: number, time: number, w: number, h: number) => {
            const g = gameRef.current;
            const activeList = g.students.filter(s => !s.eliminated);
            const activeCount = activeList.length;
            const eliminatedCount = g.students.length - activeCount;

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

            // Smoothly ease seated hamsters into updated ring coordinates between rounds
            if (g.state !== 'CHAOS_SPIN') {
                const seatEase = Math.min(1, 6.5 * dt);
                activeList.forEach(ham => {
                    ham.curX += (ham.seatX - ham.curX) * seatEase;
                    ham.curY += (ham.seatY - ham.curY) * seatEase;
                });
            }

            g.boatRockPhase += dt * (2.5 + g.boatSpeed * 10);

            let tiltIntensity = 0.08;
            if (g.state === 'SLOW_SPIN') tiltIntensity = 0.20;
            else if (g.state === 'CHAOS_SPIN') tiltIntensity = 0.34;
            else if (g.state === 'LAUNCHING') tiltIntensity = 0.28;
            // Slightly steadier tilt amplitude on mega-boats so outer-ring hamsters stay poised
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
                g.boatSpeed = 1.2 + (g.phaseTimer / totalDur) * 1.4;
                g.boatAngle += g.boatSpeed * dt;
                g.captainPaddlePhase += dt * 9;

                if (Math.random() < 0.14) {
                    soundRef.current.playPaddleSplash(0.5);
                }

                updateFakeOutFlight(dt, w, h);
                if (!g.fakeOutFlight && g.phaseTimer >= g.nextFakeOutTime && g.phaseTimer < totalDur - 0.9) {
                    startFakeOutFlight(w, h, false);
                    g.nextFakeOutTime = g.phaseTimer + 1.85;
                }

                const remSec = Math.max(0, Math.ceil(totalDur - g.phaseTimer));
                if (remSec !== g.lastReportedSec) {
                    g.lastReportedSec = remSec;
                    if (!g.fakeOutFlight) {
                        onStateChangeRef.current?.({
                            phase: 'SLOW_SPIN',
                            msg: '🚣 NICE AND EASY… EVERYONE IS SAFE! 🐹',
                            eliminatedThisRound: [],
                            activeCount,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }

                if (g.phaseTimer >= totalDur * 0.32) {
                    g.state = 'CHAOS_SPIN';
                    if (!g.fakeOutFlight) {
                        g.activeBanner = '🌪️ ACROBATIC COCONUT CHAOS!! 🌪️';
                        g.bannerExpiry = performance.now() + 1800;
                        onStateChangeRef.current?.({
                            phase: 'CHAOS_SPIN',
                            msg: '🌪️ ACROBATIC COCONUT CHAOS!! 🌪️',
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
                const chaosProgress = Math.min(1, (g.phaseTimer - totalDur * 0.32) / Math.max(0.1, totalDur * 0.68));
                g.boatSpeed = 2.2 + chaosProgress * 5.8;
                g.boatAngle += g.boatSpeed * dt;
                g.captainPaddlePhase += dt * 22;

                if (Math.random() < 0.28) {
                    soundRef.current.playPaddleSplash(1.2);
                }
                if (Math.random() < 0.08) {
                    soundRef.current.playSqueak();
                }

                updateFakeOutFlight(dt, w, h);
                if (!g.fakeOutFlight && g.phaseTimer >= g.nextFakeOutTime && g.phaseTimer < totalDur - 0.65) {
                    startFakeOutFlight(w, h, false);
                    g.nextFakeOutTime = g.phaseTimer + 1.75;
                }

                g.quoteTimer -= dt;
                if (g.quoteTimer <= 0 && !g.fakeOutFlight) {
                    const quote = CHAOS_QUOTES[Math.floor(Math.random() * CHAOS_QUOTES.length)];
                    g.activeBanner = quote;
                    g.bannerExpiry = performance.now() + 1300;
                    g.quoteTimer = 1.45;
                }

                // Keep outer-ring riders neatly inside the woven rim even under centrifugal push
                const maxPushOut = activeCount > 24 ? 0.08 : 0.14;
                activeList.forEach((ham, idx) => {
                    if (g.fakeOutFlight?.hamster.id === ham.id) return;
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
                    if (!g.fakeOutFlight) {
                        onStateChangeRef.current?.({
                            phase: 'CHAOS_SPIN',
                            msg: g.activeBanner || '🌪️ ACROBATIC COCONUT CHAOS!! 🌪️',
                            eliminatedThisRound: [],
                            activeCount,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }

                if (g.phaseTimer >= totalDur && !g.fakeOutFlight) {
                    if (!g.didClimaxFakeOut && activeCount > 1) {
                        g.didClimaxFakeOut = true;
                        startFakeOutFlight(w, h, true);
                    } else {
                        launchTargetVictims(w, h);
                    }
                }
            } else if (g.state === 'LAUNCHING') {
                g.boatAngle += g.boatSpeed * 0.35 * dt;
                let allFinished = true;
                let anyMidAir = false;

                g.flyingHamsters.forEach(fh => {
                    if (fh.delay > 0) {
                        fh.delay -= dt;
                        allFinished = false;
                        return;
                    }
                    fh.t += dt / 1.1;
                    if (fh.t > 0.15 && fh.t < 0.65) {
                        anyMidAir = true;
                    }
                    if (fh.t >= 1 && !fh.splashed) {
                        fh.splashed = true;
                        fh.hamster.eliminated = true;
                        fh.hamster.expression = 'happy';
                        fh.hamster.wobbleAngle = 0;
                        spawnWaterSplash(fh.targetX, fh.targetY);
                        soundRef.current.playBigSplash();
                    }
                    if (fh.t < 1.35) {
                        allFinished = false;
                    }
                });

                g.slowMoFactor = anyMidAir ? 0.48 : 1.0;

                if (allFinished) {
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

            // Detailed 3D Lotus Pads & Blooming Lotus Flowers
            g.lotusPads.forEach((pad, idx) => {
                const px = pad.xRatio * w + Math.sin(time * 1.2 + idx) * 6;
                const py = pad.yRatio * h + Math.cos(time * 1.5 + idx) * 4;
                const pr = pad.r * (w < 640 ? 0.75 : 1);
                ctx.save();
                ctx.translate(px, py);

                // Gentle water ripple ring around lotus pad
                ctx.strokeStyle = 'rgba(224, 242, 254, 0.35)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.ellipse(0, 2, pr * 1.22, pr * 0.68, 0, 0, Math.PI * 2);
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
                padGrad.addColorStop(0, '#74C69D');
                padGrad.addColorStop(0.75, '#40916C');
                padGrad.addColorStop(1, '#1B4332');
                ctx.fillStyle = padGrad;
                ctx.strokeStyle = '#1B4332';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.arc(0, 0, pr, 0.25, Math.PI * 2 - 0.25);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                if (pad.flower) {
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

        const renderScene = (time: number) => {
            const g = gameRef.current;
            const parent = canvas.parentElement;
            const w = parent ? parent.clientWidth : window.innerWidth;
            const h = parent ? parent.clientHeight : window.innerHeight;

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

            const eliminated = g.students.filter(s => s.eliminated);
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
            if (g.fakeOutFlight) {
                flyingIds.add(g.fakeOutFlight.hamster.id);
            }
            const renderEntities: {
                type: 'student' | 'captain';
                ham?: HamsterStudent;
                proj: ReturnType<typeof projectBoatPoint>;
                depth: number;
            }[] = [];

            active.forEach(ham => {
                if (flyingIds.has(ham.id)) return;
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

            // Foreground eliminated hamsters
            drawEliminatedSet(true);

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

            // Fake-out airborne hamster (always spotlight-prominent on top of crowd)
            if (g.fakeOutFlight) {
                const fo = g.fakeOutFlight;
                const t = Math.min(1, fo.t);
                const split = 0.54;
                let curX = 0;
                let curY = 0;
                let zoomScale = 1;

                const lx = (g.state === 'CHAOS_SPIN' ? fo.hamster.curX : fo.hamster.seatX) * usableRadius;
                const ly = (g.state === 'CHAOS_SPIN' ? fo.hamster.curY : fo.hamster.seatY) * usableRadius;
                const rNorm = Math.min(1, Math.hypot(lx, ly) / Math.max(1, boatRadius));
                const seatZ = -bowlDepth * 0.14 * (1 - rNorm * 0.65) + hamRadius * 0.42;
                const liveSeatProj = projectBoatPoint(lx, ly, seatZ, boatX, boatY);
                const arcScale = Math.max(0.68, cameraScale);

                if (t <= split) {
                    const p1 = t / split;
                    curX = fo.startX + (fo.peakOutX - fo.startX) * p1;
                    const arcHeight = Math.sin(p1 * Math.PI) * 175 * arcScale;
                    curY = fo.startY + (fo.peakOutY - fo.startY) * p1 - arcHeight;
                    zoomScale = 1 + Math.sin(p1 * Math.PI * 0.85) * 0.85;
                    fo.hamster.wobbleAngle = p1 * Math.PI * 5;
                    fo.hamster.expression = 'shocked';
                } else {
                    const p2 = (t - split) / (1 - split);
                    curX = fo.peakOutX + (liveSeatProj.x - fo.peakOutX) * p2;
                    const returnArc = Math.sin(p2 * Math.PI) * 200 * arcScale;
                    curY = fo.peakOutY + (liveSeatProj.y - fo.peakOutY) * p2 - returnArc;
                    zoomScale = 1 + (1 - p2) * 0.65 + Math.sin(p2 * Math.PI) * 0.35;
                    fo.hamster.wobbleAngle = -p2 * Math.PI * 4;
                    fo.hamster.expression = 'excited';

                    const ringAlpha = Math.max(0, 1 - p2 * 1.4);
                    if (ringAlpha > 0) {
                        ctx.save();
                        ctx.strokeStyle = `rgba(6, 214, 160, ${ringAlpha})`;
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.ellipse(fo.peakOutX, fo.peakOutY + 14, 24 + p2 * 55, 11 + p2 * 24, 0, 0, Math.PI * 2);
                        ctx.stroke();

                        ctx.strokeStyle = `rgba(255, 209, 102, ${ringAlpha})`;
                        ctx.lineWidth = 2.5;
                        ctx.beginPath();
                        ctx.ellipse(fo.peakOutX, fo.peakOutY + 14, 14 + p2 * 35, 6 + p2 * 15, 0, 0, Math.PI * 2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                fo.trail.push({ x: curX, y: curY });
                if (fo.trail.length > 16) fo.trail.shift();

                if (fo.trail.length > 2) {
                    ctx.save();
                    ctx.strokeStyle = t <= split ? 'rgba(255, 255, 255, 0.75)' : 'rgba(6, 214, 160, 0.85)';
                    ctx.lineWidth = 4;
                    ctx.setLineDash([8, 6]);
                    ctx.beginPath();
                    fo.trail.forEach((pt, idx) => {
                        if (idx === 0) ctx.moveTo(pt.x, pt.y);
                        else ctx.lineTo(pt.x, pt.y);
                    });
                    ctx.stroke();
                    ctx.restore();
                }

                const flyR = Math.max(20, hamRadius * zoomScale);
                drawHamsterCharacter(ctx, curX, curY, flyR, fo.hamster, time, false, g.captainPaddlePhase, false);
                const clampedTagY = Math.max(safeTop + 34, curY - flyR - 18);
                drawNameTag({
                    x: Math.max(safeLeft + 60, Math.min(safeRight - 60, curX)),
                    y: clampedTagY,
                    anchorX: curX,
                    anchorY: clampedTagY,
                    name: fo.hamster.name,
                    displayText: fo.hamster.name,
                    isCaptain: false,
                    priority: 'spotlight',
                    accentColor: fo.hamster.vest?.main,
                    fontSize: 13,
                    boxH: 24,
                    paddingX: 10,
                    maxWidth: 220
                });

                const badgeText = t <= split ? '😱 FLYING OUT!!' : '😅 BOUNCED BACK TO BOAT!! 🛶';
                const badgeBg = t <= split ? '#EF233C' : '#06D6A0';
                const badgeFg = t <= split ? '#FFFFFF' : '#073B4C';
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
            }

            // Flying launched hamsters (true eliminations at the end of the round)
            const launchArcScale = Math.max(0.68, cameraScale);
            g.flyingHamsters.forEach(fh => {
                if (fh.delay > 0 || fh.t > 1) return;
                const t = Math.min(1, fh.t);
                const curX = fh.startX + (fh.targetX - fh.startX) * t;
                const curY = fh.startY + (fh.targetY - fh.startY) * t - Math.sin(t * Math.PI) * 195 * launchArcScale;
                const zoomScale = 1 + Math.sin(t * Math.PI) * 0.78;
                const flyR = Math.max(20, hamRadius * zoomScale);

                fh.hamster.wobbleAngle = t * Math.PI * 6;
                fh.hamster.expression = 'shocked';
                drawHamsterCharacter(ctx, curX, curY, flyR, fh.hamster, time, false, g.captainPaddlePhase, false);
                const clampedTagY = Math.max(safeTop + 18, curY - flyR - 18);
                drawNameTag({
                    x: Math.max(safeLeft + 60, Math.min(safeRight - 60, curX)),
                    y: clampedTagY,
                    anchorX: curX,
                    anchorY: clampedTagY,
                    name: fh.hamster.name,
                    displayText: fh.hamster.name,
                    isCaptain: false,
                    priority: 'spotlight',
                    accentColor: fh.hamster.vest?.main,
                    fontSize: 13,
                    boxH: 24,
                    paddingX: 10,
                    maxWidth: 220
                });
            });

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
            className="w-full h-full block select-none"
        />
    );
});
