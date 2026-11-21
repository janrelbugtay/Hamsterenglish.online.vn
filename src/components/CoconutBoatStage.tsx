import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface CoconutBoatStageHandle {
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
    { body: '#FFE5B4', belly: '#FFFDF9', ear: '#F4A261', name: 'Cream' },
    { body: '#E09F67', belly: '#FFF8EB', ear: '#B5651D', name: 'Golden' },
    { body: '#D4A373', belly: '#FEFAE0', ear: '#9C6644', name: 'Cinnamon' },
    { body: '#FFFDF7', belly: '#FFFFFF', ear: '#FFB5A7', name: 'Snowy' },
    { body: '#B7B7A4', belly: '#F0EFEB', ear: '#6B705C', name: 'Silver' },
    { body: '#F6BD60', belly: '#FFF8E7', ear: '#E07A5F', name: 'Butterscotch' },
    { body: '#E5989B', belly: '#FFF0F3', ear: '#B5838D', name: 'Strawberry' },
    { body: '#C8B6FF', belly: '#F8F7FF', ear: '#9D4EDD', name: 'Lavender' },
    { body: '#A8DADC', belly: '#F1FAEE', ear: '#457B9D', name: 'Minty' }
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
    "HOLD ONTO YOUR WHISKERS!",
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
    accessory: string;
    eliminated: boolean;
    seatX: number;
    seatY: number;
    seatType: 'bench' | 'rim' | 'floor';
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

    // Turquoise neck scarf fluttering
    targetCtx.fillStyle = '#00BBF9';
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.ellipse(0, r * 1.02, r * 0.62, r * 0.18, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Conical Nón Lá Straw Hat
    const hatGrad = targetCtx.createLinearGradient(-r, -r * 0.7, r, 0);
    hatGrad.addColorStop(0, '#FFF8E7');
    hatGrad.addColorStop(0.5, '#F3D5B5');
    hatGrad.addColorStop(1, '#D4A373');
    targetCtx.fillStyle = hatGrad;
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2.5;
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 1.25, r * 0.05);
    targetCtx.lineTo(0, -r * 0.78);
    targetCtx.lineTo(r * 1.25, r * 0.05);
    targetCtx.quadraticCurveTo(0, r * 0.28, -r * 1.25, r * 0.05);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    // Woven rings on the conical hat
    targetCtx.strokeStyle = 'rgba(92, 58, 33, 0.35)';
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.75, -r * 0.22);
    targetCtx.quadraticCurveTo(0, -r * 0.08, r * 0.75, -r * 0.22);
    targetCtx.stroke();

    targetCtx.restore();

    // Long Bamboo Oar / Paddle dipping deep into the river water on the side
    const strokeAngle = Math.sin(captainPaddlePhase) * 0.48;
    targetCtx.save();
    targetCtx.translate(r * 0.45, r * 0.15);
    targetCtx.rotate(0.55 + strokeAngle);

    targetCtx.strokeStyle = '#DDB892';
    targetCtx.lineWidth = Math.max(5, r * 0.24);
    targetCtx.lineCap = 'round';
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.9, -r * 0.4);
    targetCtx.lineTo(r * 2.1, r * 0.9);
    targetCtx.stroke();

    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.moveTo(-r * 0.9, -r * 0.4);
    targetCtx.lineTo(r * 2.1, r * 0.9);
    targetCtx.stroke();

    targetCtx.fillStyle = '#B08968';
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2.2;
    targetCtx.beginPath();
    targetCtx.ellipse(r * 2.25, r * 0.98, r * 0.48, r * 0.22, 0.4, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    targetCtx.beginPath();
    targetCtx.arc(r * 2.45, r * 1.05, r * 0.22, 0, Math.PI * 2);
    targetCtx.arc(r * 2.05, r * 1.12, r * 0.16, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.restore();
}

function drawHamsterAccessory(targetCtx: CanvasRenderingContext2D, r: number, type: string) {
    targetCtx.save();
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2;

    if (type === 'pink_bow') {
        targetCtx.translate(-r * 0.45, -r * 0.72);
        targetCtx.fillStyle = '#FF4D6D';
        targetCtx.beginPath();
        targetCtx.ellipse(-r * 0.18, 0, r * 0.2, r * 0.13, -0.2, 0, Math.PI * 2);
        targetCtx.ellipse(r * 0.18, 0, r * 0.2, r * 0.13, 0.2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else if (type === 'sunglasses') {
        targetCtx.fillStyle = '#1D3557';
        targetCtx.fillRect(-r * 0.62, -r * 0.3, r * 0.5, r * 0.28);
        targetCtx.fillRect(r * 0.12, -r * 0.3, r * 0.5, r * 0.28);
        targetCtx.beginPath();
        targetCtx.moveTo(-r * 0.12, -r * 0.18);
        targetCtx.lineTo(r * 0.12, -r * 0.18);
        targetCtx.stroke();
    } else if (type === 'sailor_hat') {
        targetCtx.translate(0, -r * 0.85);
        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.4, Math.PI, 0);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#3A86FF';
        targetCtx.fillRect(-r * 0.4, -r * 0.12, r * 0.8, r * 0.12);
    } else if (type === 'headband') {
        targetCtx.fillStyle = '#FF006E';
        targetCtx.fillRect(-r * 0.78, -r * 0.52, r * 1.56, r * 0.18);
        targetCtx.strokeRect(-r * 0.78, -r * 0.52, r * 1.56, r * 0.18);
    } else if (type === 'flower') {
        targetCtx.translate(r * 0.45, -r * 0.72);
        targetCtx.fillStyle = '#FFBE0B';
        for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            targetCtx.beginPath();
            targetCtx.arc(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16, r * 0.12, 0, Math.PI * 2);
            targetCtx.fill();
        }
        targetCtx.fillStyle = '#FB5607';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
        targetCtx.fill();
    } else if (type === 'propeller_cap') {
        targetCtx.translate(0, -r * 0.82);
        targetCtx.fillStyle = '#06D6A0';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, r * 0.42, Math.PI, 0);
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.fillStyle = '#EF476F';
        targetCtx.fillRect(-r * 0.35, -r * 0.52, r * 0.7, r * 0.09);
    } else if (type === 'straw_hat') {
        targetCtx.translate(0, -r * 0.82);
        targetCtx.fillStyle = '#F4D35E';
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, r * 0.72, r * 0.18, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else if (type === 'leaf_sprout') {
        targetCtx.translate(0, -r * 0.88);
        targetCtx.fillStyle = '#80ED99';
        targetCtx.beginPath();
        targetCtx.ellipse(-r * 0.15, -r * 0.15, r * 0.2, r * 0.1, -0.4, 0, Math.PI * 2);
        targetCtx.ellipse(r * 0.15, -r * 0.15, r * 0.2, r * 0.1, 0.4, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    }

    targetCtx.restore();
}

function drawWinnerCrown(targetCtx: CanvasRenderingContext2D, r: number) {
    targetCtx.save();
    targetCtx.translate(0, -r * 1.05);
    targetCtx.fillStyle = '#FFD700';
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2.5;
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

    // Soft drop shadow
    targetCtx.fillStyle = 'rgba(74, 44, 17, 0.22)';
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 0.78, radius * 0.85, radius * 0.38, 0, 0, Math.PI * 2);
    targetCtx.fill();

    const palette = hamster.palette || FUR_PALETTES[0];
    const furColor = isCaptain ? '#D97706' : palette.body;
    const bellyColor = isCaptain ? '#FEF3C7' : palette.belly;
    const earInner = isCaptain ? '#F59E0B' : palette.ear;

    // Round little ears
    const earSpread = radius * 0.68;
    const earY = -radius * 0.65;
    [-1, 1].forEach(dir => {
        targetCtx.fillStyle = furColor;
        targetCtx.strokeStyle = '#4A2C11';
        targetCtx.lineWidth = Math.max(2, radius * 0.1);
        targetCtx.beginPath();
        targetCtx.arc(dir * earSpread, earY, radius * 0.34, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.fillStyle = '#FFCAD4';
        targetCtx.beginPath();
        targetCtx.arc(dir * earSpread, earY, radius * 0.18, 0, Math.PI * 2);
        targetCtx.fill();
    });

    // Chubby 3D-shaded potato-shaped body
    const bodyGrad = targetCtx.createRadialGradient(-radius * 0.28, -radius * 0.28, radius * 0.08, 0, 0, radius * 1.05);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.2, furColor);
    bodyGrad.addColorStop(0.85, furColor);
    bodyGrad.addColorStop(1, earInner);
    targetCtx.fillStyle = bodyGrad;
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = Math.max(2.2, radius * 0.11);
    targetCtx.beginPath();
    targetCtx.ellipse(0, 0, radius * 0.96, radius * 0.9, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Fluffy top head fur tuft
    targetCtx.fillStyle = furColor;
    targetCtx.beginPath();
    targetCtx.moveTo(-radius * 0.16, -radius * 0.84);
    targetCtx.quadraticCurveTo(0, -radius * 1.08, radius * 0.06, -radius * 0.88);
    targetCtx.quadraticCurveTo(radius * 0.18, -radius * 1.04, radius * 0.18, -radius * 0.82);
    targetCtx.fill();
    targetCtx.stroke();

    // Fluffy cream belly patch
    targetCtx.fillStyle = bellyColor;
    targetCtx.beginPath();
    targetCtx.ellipse(0, radius * 0.24, radius * 0.58, radius * 0.48, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // Rosy pink cheeks & delicate whiskers
    targetCtx.fillStyle = 'rgba(255, 105, 135, 0.7)';
    [-1, 1].forEach(dir => {
        targetCtx.beginPath();
        targetCtx.ellipse(dir * radius * 0.54, radius * 0.06, radius * 0.23, radius * 0.15, 0, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.strokeStyle = 'rgba(74, 44, 17, 0.65)';
        targetCtx.lineWidth = Math.max(1.2, radius * 0.055);
        targetCtx.beginPath();
        targetCtx.moveTo(dir * radius * 0.68, radius * 0.02);
        targetCtx.lineTo(dir * radius * 1.06, -radius * 0.05);
        targetCtx.moveTo(dir * radius * 0.68, radius * 0.11);
        targetCtx.lineTo(dir * radius * 1.04, radius * 0.14);
        targetCtx.stroke();
    });

    // Expressive eyes
    const expr = isCaptain ? 'captain' : (hamster.expression || 'happy');
    const eyeX = radius * 0.34;
    const eyeY = -radius * 0.14;

    if (expr === 'dizzy') {
        targetCtx.strokeStyle = '#4A2C11';
        targetCtx.lineWidth = 2.2;
        [-1, 1].forEach(dir => {
            targetCtx.save();
            targetCtx.translate(dir * eyeX, eyeY);
            targetCtx.rotate(time * 8 * dir);
            targetCtx.beginPath();
            targetCtx.arc(0, 0, radius * 0.17, 0, Math.PI * 1.5);
            targetCtx.stroke();
            targetCtx.restore();
        });
    } else if (expr === 'shocked' || expr === 'scream') {
        [-1, 1].forEach(dir => {
            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.strokeStyle = '#4A2C11';
            targetCtx.lineWidth = 2;
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.22, 0, Math.PI * 2);
            targetCtx.fill();
            targetCtx.stroke();

            targetCtx.fillStyle = '#2B180A';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.09, 0, Math.PI * 2);
            targetCtx.fill();
        });
    } else {
        [-1, 1].forEach(dir => {
            targetCtx.fillStyle = '#2B180A';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX, eyeY, radius * 0.18, 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.fillStyle = '#FFFFFF';
            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX - radius * 0.055, eyeY - radius * 0.055, radius * 0.07, 0, Math.PI * 2);
            targetCtx.fill();

            targetCtx.beginPath();
            targetCtx.arc(dir * eyeX + radius * 0.05, eyeY + radius * 0.05, radius * 0.032, 0, Math.PI * 2);
            targetCtx.fill();
        });
    }

    // Cute tiny pink nose & mouth
    targetCtx.fillStyle = '#FF758F';
    targetCtx.beginPath();
    targetCtx.ellipse(0, -radius * 0.01, radius * 0.1, radius * 0.07, 0, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2;
    if (expr === 'scream' || expr === 'shocked') {
        targetCtx.fillStyle = '#E63946';
        targetCtx.beginPath();
        targetCtx.ellipse(0, radius * 0.18, radius * 0.16, radius * 0.2, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    } else {
        targetCtx.beginPath();
        targetCtx.arc(-radius * 0.09, radius * 0.07, radius * 0.09, 0, Math.PI);
        targetCtx.arc(radius * 0.09, radius * 0.07, radius * 0.09, 0, Math.PI);
        targetCtx.stroke();
    }

    // Little paws
    const pawWave = (expr === 'scream' || expr === 'shocked')
        ? Math.sin(time * 24) * radius * 0.25
        : Math.sin(time * 4 + (hamster.bobOffset || 0)) * radius * 0.08;
    targetCtx.fillStyle = bellyColor;
    targetCtx.strokeStyle = '#4A2C11';
    targetCtx.lineWidth = 2;
    [-1, 1].forEach(dir => {
        targetCtx.beginPath();
        targetCtx.arc(dir * radius * 0.58, radius * 0.22 - Math.abs(pawWave), radius * 0.17, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();
    });

    if (!isCaptain && hamster.eatingSeed && isIdleState) {
        targetCtx.fillStyle = '#3D405B';
        targetCtx.beginPath();
        targetCtx.ellipse(0, radius * 0.22, radius * 0.12, radius * 0.18, 0.3, 0, Math.PI * 2);
        targetCtx.fill();
    }

    if (isCaptain) {
        drawCaptainHatAndPaddle(targetCtx, radius, captainPaddlePhase);
    } else {
        if (hamster.expression === 'crown') {
            drawWinnerCrown(targetCtx, radius);
        } else if (hamster.accessory) {
            drawHamsterAccessory(targetCtx, radius, hamster.accessory);
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
        state: 'IDLE' as 'IDLE' | 'BOARDING' | 'SLOW_SPIN' | 'CHAOS_SPIN' | 'LAUNCHING' | 'RESULT',
        boatAngle: 0,
        boatSpeed: 0.28,
        boatRockPhase: 0,
        boatTiltRoll: 0,
        boatTiltPitch: 0,
        cameraMode: 'side' as 'side' | 'dynamic' | 'high',
        cameraPitch: 0.58,
        captainPaddlePhase: 0,
        phaseTimer: 0,
        roundDuration: 7.0,
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
            { xRatio: 0.11, yRatio: 0.44, r: 24, rot: 0.4, flower: '#FF758F' as string | null },
            { xRatio: 0.89, yRatio: 0.48, r: 28, rot: 2.1, flower: '#FFD166' as string | null },
            { xRatio: 0.08, yRatio: 0.78, r: 34, rot: 1.2, flower: '#FF4D6D' as string | null },
            { xRatio: 0.91, yRatio: 0.81, r: 30, rot: 3.8, flower: null as string | null },
            { xRatio: 0.21, yRatio: 0.88, r: 26, rot: 5.1, flower: '#FFF8E7' as string | null }
        ],
        koiShadows: [
            { angle: 0.5, dist: 0.36, speed: 0.22, size: 16 },
            { angle: 2.8, dist: 0.42, speed: -0.18, size: 14 },
            { angle: 4.5, dist: 0.31, speed: 0.26, size: 18 }
        ],
        bgBoats: [
            { xRatio: 0.14, yOffset: 18, phase: 0.5, color: '#3A86FF', umbrella: '#4CC9F0' },
            { xRatio: 0.85, yOffset: 26, phase: 2.4, color: '#FFBE0B', umbrella: '#FF006E' }
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
        const seed = hashString(name) + index;
        const palette = FUR_PALETTES[seed % FUR_PALETTES.length];
        const accessory = ACCESSORIES[seed % ACCESSORIES.length];
        return {
            id: `ham_${index}_${name}`,
            name: name.trim(),
            palette,
            accessory,
            eliminated: false,
            seatX: 0,
            seatY: 0,
            seatType: 'floor',
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

    const arrangeHamstersInBoat = () => {
        const g = gameRef.current;
        const active = g.students.filter(s => !s.eliminated);
        const count = active.length;
        if (count === 0) return;

        if (count === 1) {
            active[0].seatX = 0;
            active[0].seatY = 0;
            active[0].seatType = 'bench';
            active[0].curX = 0;
            active[0].curY = 0;
        } else {
            active.forEach((h, i) => {
                if (count <= 6) {
                    const ang = (i / count) * Math.PI * 2 + 0.3;
                    const r = i % 2 === 0 ? 0.42 : 0.64;
                    h.seatX = Math.cos(ang) * r;
                    h.seatY = Math.sin(ang) * r;
                    h.seatType = r > 0.5 ? 'rim' : 'bench';
                } else if (count <= 16) {
                    const innerCount = Math.min(5, Math.floor(count * 0.35));
                    if (i < innerCount) {
                        const spread = (i / Math.max(1, innerCount - 1)) - 0.5;
                        h.seatX = spread * 0.72;
                        h.seatY = (i % 2 === 0 ? 0.08 : -0.08);
                        h.seatType = 'bench';
                    } else {
                        const outerCount = count - innerCount;
                        const j = i - innerCount;
                        const ang = (j / outerCount) * Math.PI * 2 + 0.25;
                        h.seatX = Math.cos(ang) * 0.66;
                        h.seatY = Math.sin(ang) * 0.66;
                        h.seatType = 'rim';
                    }
                } else {
                    const ring1 = 5;
                    const ring2 = 10;
                    const ring3 = Math.max(1, count - ring1 - ring2);
                    if (i < ring1) {
                        const ang = (i / ring1) * Math.PI * 2;
                        h.seatX = Math.cos(ang) * 0.25;
                        h.seatY = Math.sin(ang) * 0.25;
                        h.seatType = 'bench';
                    } else if (i < ring1 + ring2) {
                        const j = i - ring1;
                        const ang = (j / ring2) * Math.PI * 2 + 0.2;
                        h.seatX = Math.cos(ang) * 0.48;
                        h.seatY = Math.sin(ang) * 0.48;
                        h.seatType = 'floor';
                    } else {
                        const k = i - ring1 - ring2;
                        const ang = (k / ring3) * Math.PI * 2 + 0.1;
                        h.seatX = Math.cos(ang) * 0.70;
                        h.seatY = Math.sin(ang) * 0.70;
                        h.seatType = 'rim';
                    }
                }
                h.curX = h.seatX;
                h.curY = h.seatY;
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
        arrangeHamstersInBoat();
    };

    useEffect(() => {
        if (gameRef.current.state === 'IDLE') {
            syncRoster(students);
        }
    }, [students]);

    useImperativeHandle(ref, () => ({
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
            const accessory = ACCESSORIES[seed % ACCESSORIES.length];

            // Tropical lagoon circle backdrop
            const bgGrad = oCtx.createRadialGradient(80, 80, 15, 80, 80, 80);
            bgGrad.addColorStop(0, '#ADE8F4');
            bgGrad.addColorStop(1, '#0096C7');
            oCtx.fillStyle = bgGrad;
            oCtx.fillRect(0, 0, 160, 160);

            // Inner tube
            const tubeColor = ['#FF595E', '#FFCA3A', '#8AC926', '#1982C4', '#F72585', '#FF924C'][seed % 6];
            oCtx.fillStyle = tubeColor;
            oCtx.strokeStyle = '#4A2C11';
            oCtx.lineWidth = 4;
            oCtx.beginPath();
            oCtx.ellipse(80, 118, 52, 24, 0, 0, Math.PI * 2);
            oCtx.fill();
            oCtx.stroke();

            drawHamsterCharacter(
                oCtx,
                80,
                92,
                44,
                {
                    name,
                    palette,
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

        const startFakeOutFlight = (w: number, h: number, isClimaxFakeOut = false) => {
            const g = gameRef.current;
            const active = g.students.filter(s => !s.eliminated);
            if (active.length === 0) return false;

            const targetSet = new Set(g.targetsToEliminate);
            // Prefer non-target students for fake-outs when possible so someone unexpected flies out and survives!
            let candidates = active.filter(s => s.id !== g.lastFakeOutId && (!isClimaxFakeOut || !targetSet.has(s.name)));
            if (candidates.length === 0) {
                candidates = active.filter(s => s.id !== g.lastFakeOutId);
            }
            if (candidates.length === 0) {
                candidates = active;
            }

            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            g.lastFakeOutId = chosen.id;

            const cx = w / 2;
            const cy = h * 0.57;
            const boatRadius = Math.min(w, h) * (w < 640 ? 0.34 : 0.31);
            const usableRadius = boatRadius * 0.80;

            const lx = (g.state === 'CHAOS_SPIN' ? chosen.curX : chosen.seatX) * usableRadius;
            const ly = (g.state === 'CHAOS_SPIN' ? chosen.curY : chosen.seatY) * usableRadius;
            const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.18, cx, cy);

            // Fly outward over the rim toward the open water on the left or right side for maximum visibility
            const baseAngle = Math.atan2(startProj.y - cy, startProj.x - cx);
            const outDist = boatRadius * 1.46;
            const peakOutX = cx + Math.cos(baseAngle) * outDist;
            const peakOutY = cy + Math.sin(baseAngle) * outDist * Math.sin(g.cameraPitch) - 18;

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

            const cx = w / 2;
            const cy = h * 0.57;
            const boatRadius = Math.min(w, h) * (w < 640 ? 0.34 : 0.31);
            const usableRadius = boatRadius * 0.80;

            g.flyingHamsters = victims.map((victim, idx) => {
                const lx = victim.seatX * usableRadius;
                const ly = victim.seatY * usableRadius;
                const startProj = projectBoatPoint(lx, ly, -boatRadius * 0.2, cx, cy);

                const splashAngle = (idx / Math.max(1, victims.length)) * Math.PI * 2 + Math.atan2(startProj.y - cy, startProj.x - cx);
                const targetDist = boatRadius * 1.48;
                const targetX = cx + Math.cos(splashAngle) * targetDist;
                const targetY = cy + Math.sin(splashAngle) * targetDist * Math.sin(g.cameraPitch);

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

            // Dramatic brief slow-motion right when hovering outside the rim over the water!
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
                const cx = w / 2 + Math.sin(g.boatRockPhase * 0.5) * 7;
                const cy = h * 0.57 + Math.cos(g.boatRockPhase * 0.8) * 5;
                const boatRadius = Math.min(w, h) * (w < 640 ? 0.34 : 0.31);
                const usableRadius = boatRadius * 0.80;
                const lx = (g.state === 'CHAOS_SPIN' ? fo.hamster.curX : fo.hamster.seatX) * usableRadius;
                const ly = (g.state === 'CHAOS_SPIN' ? fo.hamster.curY : fo.hamster.seatY) * usableRadius;
                const landProj = projectBoatPoint(lx, ly, -boatRadius * 0.2, cx, cy);

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

            if (g.cameraMode === 'side') {
                g.cameraPitch += (0.56 - g.cameraPitch) * 5 * dt;
            } else if (g.cameraMode === 'high') {
                g.cameraPitch += (0.98 - g.cameraPitch) * 5 * dt;
            } else if (g.cameraMode === 'dynamic') {
                const targetPitch = 0.52 + Math.sin(time * 0.85) * 0.18;
                g.cameraPitch += (targetPitch - g.cameraPitch) * 4 * dt;
            }

            g.boatRockPhase += dt * (2.5 + g.boatSpeed * 10);

            let tiltIntensity = 0.10;
            if (g.state === 'SLOW_SPIN') tiltIntensity = 0.22;
            else if (g.state === 'CHAOS_SPIN') tiltIntensity = 0.44;
            else if (g.state === 'LAUNCHING') tiltIntensity = 0.35;

            g.boatTiltRoll = Math.sin(g.boatRockPhase) * tiltIntensity;
            g.boatTiltPitch = Math.cos(g.boatRockPhase * 0.85) * (tiltIntensity * 0.65);

            if (g.state === 'IDLE') {
                g.boatAngle += 0.28 * dt;
                g.captainPaddlePhase += dt * 3.8;
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
                            activeCount: g.students.filter(s => !s.eliminated).length,
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
                            activeCount: g.students.filter(s => !s.eliminated).length,
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

                const active = g.students.filter(s => !s.eliminated);
                active.forEach((ham, idx) => {
                    if (g.fakeOutFlight?.hamster.id === ham.id) return;
                    ham.wobbleAngle = Math.sin(time * 18 + idx) * 0.38 - g.boatTiltRoll * 0.6;
                    const pushOut = 1 + Math.min(0.26, chaosProgress * 0.24);
                    const slideGravityX = Math.sin(g.boatTiltRoll) * 0.14;
                    ham.curX = ham.seatX * pushOut + slideGravityX + Math.cos(time * 12 + idx) * 0.04;
                    ham.curY = ham.seatY * pushOut + Math.sin(time * 12 + idx) * 0.04;
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
                            activeCount: active.length,
                            chaseSecondsLeft: remSec,
                            cameraMode: g.cameraMode
                        });
                    }
                }

                if (g.phaseTimer >= totalDur && !g.fakeOutFlight) {
                    if (!g.didClimaxFakeOut && active.length > 1) {
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
                    arrangeHamstersInBoat();
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

        const drawPalmFrondCluster = (x: number, baseY: number, size: number, stemColor: string, leafColor: string, detailed: boolean) => {
            ctx.save();
            ctx.translate(x, baseY);
            const angles = [-0.95, -0.5, -0.1, 0.35, 0.8];
            angles.forEach((ang, idx) => {
                ctx.save();
                ctx.rotate(ang);
                const len = size * (0.85 + (idx % 2) * 0.25);

                ctx.strokeStyle = stemColor;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(len * 0.15, -len * 0.55, len * 0.35, -len);
                ctx.stroke();

                ctx.fillStyle = idx % 2 === 0 ? leafColor : stemColor;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(-len * 0.22, -len * 0.5, len * 0.35, -len);
                ctx.quadraticCurveTo(len * 0.48, -len * 0.45, 0, 0);
                ctx.fill();

                if (detailed) {
                    ctx.strokeStyle = '#95D5B2';
                    ctx.lineWidth = 1.2;
                    for (let k = 1; k <= 5; k++) {
                        const fy = -len * (k / 6);
                        ctx.beginPath();
                        ctx.moveTo(len * 0.08 * (k / 6), fy);
                        ctx.lineTo(len * 0.08 * (k / 6) - 12, fy - 6);
                        ctx.moveTo(len * 0.08 * (k / 6), fy);
                        ctx.lineTo(len * 0.08 * (k / 6) + 14, fy - 4);
                        ctx.stroke();
                    }
                }
                ctx.restore();
            });
            ctx.restore();
        };

        const drawTropicalLagoon = (w: number, h: number, time: number) => {
            const g = gameRef.current;
            const horizonY = Math.max(125, h * 0.24);

            const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
            skyGrad.addColorStop(0, '#48CAE4');
            skyGrad.addColorStop(0.45, '#ADE8F4');
            skyGrad.addColorStop(1, '#FFF3B0');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, w, horizonY);

            const sunX = w * 0.82;
            const sunY = horizonY * 0.42;
            ctx.save();
            ctx.translate(sunX, sunY);
            const sunGlow = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
            sunGlow.addColorStop(0, 'rgba(255, 243, 176, 0.95)');
            sunGlow.addColorStop(0.4, 'rgba(255, 209, 102, 0.45)');
            sunGlow.addColorStop(1, 'rgba(255, 209, 102, 0)');
            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(0, 0, 110, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#FFF8E7';
            ctx.beginPath();
            ctx.arc(0, 0, 28, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            ctx.fillStyle = 'rgba(82, 183, 136, 0.35)';
            ctx.beginPath();
            ctx.moveTo(0, horizonY);
            for (let mx = 0; mx <= w; mx += w / 6) {
                const mh = 35 + Math.sin(mx * 0.015) * 24;
                ctx.quadraticCurveTo(mx - w / 12, horizonY - mh, mx, horizonY);
            }
            ctx.closePath();
            ctx.fill();

            for (let c = 0; c < 4; c++) {
                const cx = ((c * w * 0.28 + time * 12) % (w + 180)) - 90;
                const cy = 36 + (c % 2) * 22;
                ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
                ctx.beginPath();
                ctx.arc(cx, cy, 24, 0, Math.PI * 2);
                ctx.arc(cx + 22, cy - 7, 31, 0, Math.PI * 2);
                ctx.arc(cx + 46, cy, 23, 0, Math.PI * 2);
                ctx.fill();
            }

            // Nipa Palm Forest
            const clumpCount = Math.ceil(w / 70) + 2;
            for (let i = 0; i < clumpCount; i++) {
                const bx = i * 70 - 20;
                const sway = Math.sin(time * 1.4 + i * 0.7) * 4;
                drawPalmFrondCluster(bx + sway, horizonY + 6, 82, '#1B4332', '#2D6A4F', false);
            }
            for (let i = 0; i < clumpCount; i++) {
                const fx = i * 72 + 12;
                const sway = Math.cos(time * 1.8 + i * 0.9) * 5;
                drawPalmFrondCluster(fx + sway, horizonY + 10, 68, '#40916C', '#74C69D', true);
            }
            ctx.fillStyle = '#3A2210';
            ctx.fillRect(0, horizonY + 4, w, 5);

            const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
            waterGrad.addColorStop(0, '#2D6A4F');
            waterGrad.addColorStop(0.12, '#40916C');
            waterGrad.addColorStop(0.32, '#2EC4B6');
            waterGrad.addColorStop(0.68, '#00B4D8');
            waterGrad.addColorStop(1, '#0077B6');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, horizonY, w, h - horizonY);

            ctx.save();
            g.koiShadows.forEach((koi, idx) => {
                const a = koi.angle + time * koi.speed;
                const kx = w * 0.5 + Math.cos(a) * (w * koi.dist);
                const ky = h * 0.6 + Math.sin(a) * (h * 0.22);
                const heading = a + (koi.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
                ctx.save();
                ctx.translate(kx, ky);
                ctx.rotate(heading);
                ctx.fillStyle = 'rgba(7, 59, 76, 0.16)';
                ctx.beginPath();
                ctx.ellipse(0, 0, koi.size, koi.size * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();
                const tailWiggle = Math.sin(time * 8 + idx) * 4;
                ctx.beginPath();
                ctx.moveTo(-koi.size * 0.85, 0);
                ctx.lineTo(-koi.size * 1.45, -6 + tailWiggle);
                ctx.lineTo(-koi.size * 1.45, 6 + tailWiggle);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });
            ctx.restore();

            ctx.fillStyle = 'rgba(27, 67, 50, 0.28)';
            for (let i = 0; i < 18; i++) {
                const rx = (i / 18) * w + Math.sin(time * 2 + i) * 10;
                const rw = 40 + (i % 3) * 25;
                ctx.fillRect(rx, horizonY + 4 + (i % 4) * 7, rw, 4);
            }

            ctx.save();
            for (let i = 1; i <= 14; i++) {
                const p = Math.pow(i / 14, 1.65);
                const wy = horizonY + p * (h - horizonY);
                const waveLen = 35 + p * 110;
                const alpha = 0.14 + p * 0.24;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1.5 + p * 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                for (let x = -50; x < w + 50; x += waveLen * 1.9) {
                    const offset = Math.sin(time * (1.5 + p) + i * 1.7) * 22 * (i % 2 === 0 ? 1 : -1);
                    ctx.moveTo(x + offset, wy);
                    ctx.quadraticCurveTo(x + offset + waveLen * 0.5, wy - 4 * p, x + offset + waveLen, wy);
                }
                ctx.stroke();
            }

            g.lotusPads.forEach((pad, idx) => {
                const px = pad.xRatio * w + Math.sin(time * 1.2 + idx) * 6;
                const py = pad.yRatio * h + Math.cos(time * 1.5 + idx) * 4;
                const pr = pad.r * (w < 640 ? 0.75 : 1);
                ctx.save();
                ctx.translate(px, py);
                ctx.scale(1, 0.58);
                ctx.rotate(pad.rot + Math.sin(time * 0.8 + idx) * 0.08);

                ctx.fillStyle = 'rgba(10, 50, 60, 0.25)';
                ctx.beginPath();
                ctx.arc(2, 5, pr, 0.25, Math.PI * 2 - 0.25);
                ctx.lineTo(2, 5);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#52B788';
                ctx.strokeStyle = '#1B4332';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(0, 0, pr, 0.25, Math.PI * 2 - 0.25);
                ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                if (pad.flower) {
                    ctx.fillStyle = pad.flower;
                    ctx.strokeStyle = '#4A2C11';
                    ctx.lineWidth = 1.8;
                    for (let p = 0; p < 6; p++) {
                        const pa = (p / 6) * Math.PI * 2;
                        ctx.beginPath();
                        ctx.ellipse(Math.cos(pa) * pr * 0.28, Math.sin(pa) * pr * 0.28, pr * 0.24, pr * 0.14, pa, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.stroke();
                    }
                    ctx.fillStyle = '#FFD166';
                    ctx.beginPath();
                    ctx.arc(0, 0, pr * 0.14, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            });
            ctx.restore();

            g.bgBoats.forEach(b => {
                const bx = w * b.xRatio + Math.sin(time * 0.5 + b.phase) * 18;
                const by = horizonY + b.yOffset + Math.cos(time * 2 + b.phase) * 2.5;
                ctx.save();
                ctx.translate(bx, by);
                ctx.scale(0.42, 0.42);

                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.ellipse(0, 18, 68, 14, 0, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#5C3A21';
                ctx.strokeStyle = '#2B180A';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(0, 0, 52, 0, Math.PI);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = b.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, 55, 16, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = '#4A2C11';
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

        const drawNameTag = (x: number, y: number, text: string, isCaptain = false) => {
            ctx.save();
            ctx.font = isCaptain ? "700 13px 'Fredoka', sans-serif" : "700 14px 'Quicksand', sans-serif";
            const paddingX = 10;
            const metrics = ctx.measureText(text);
            const boxW = metrics.width + paddingX * 2;
            const boxH = 23;

            ctx.translate(x, y);

            ctx.fillStyle = 'rgba(43, 24, 10, 0.28)';
            ctx.beginPath();
            ctx.roundRect(-boxW / 2, -boxH / 2 + 3, boxW, boxH, 10);
            ctx.fill();

            ctx.fillStyle = isCaptain ? '#5C3A21' : 'rgba(255, 253, 245, 0.96)';
            ctx.strokeStyle = isCaptain ? '#FFD166' : '#4A2C11';
            ctx.lineWidth = 2.4;

            ctx.beginPath();
            ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(-4, boxH / 2);
            ctx.lineTo(4, boxH / 2);
            ctx.lineTo(0, boxH / 2 + 4);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = isCaptain ? '#FFD166' : '#3A2210';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 0, 1);
            ctx.restore();
        };

        const renderScene = (time: number) => {
            const g = gameRef.current;
            const parent = canvas.parentElement;
            const w = parent ? parent.clientWidth : window.innerWidth;
            const h = parent ? parent.clientHeight : window.innerHeight;
            const cx = w / 2;
            const cy = h * 0.57;

            drawTropicalLagoon(w, h, time);

            const boatRadius = Math.min(w, h) * (w < 640 ? 0.34 : 0.31);
            const bowlDepth = boatRadius * 0.66;
            const eliminated = g.students.filter(s => s.eliminated);
            const sinCam = Math.sin(g.cameraPitch);

            const drawEliminatedSet = (isForeground: boolean) => {
                eliminated.forEach((ham, idx) => {
                    const floatR = boatRadius * 1.48 + (idx % 2) * 34;
                    const ang = ham.floatAngle + Math.sin(time * 0.45 + idx) * 0.08;
                    const sinA = Math.sin(ang);
                    if (isForeground ? (sinA < 0) : (sinA >= 0)) return;

                    const fx = cx + Math.cos(ang) * floatR;
                    const fy = cy + sinA * floatR * sinCam + Math.sin(time * 3 + idx) * 4;
                    const depthScale = 0.85 + (sinA + 1) * 0.12;

                    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.ellipse(fx, fy + 6, 30 * depthScale, 15 * depthScale, 0, 0, Math.PI * 2);
                    ctx.stroke();

                    const tubeGrad = ctx.createRadialGradient(fx - 6 * depthScale, fy - 2 * depthScale, 3 * depthScale, fx, fy + 4, 26 * depthScale);
                    tubeGrad.addColorStop(0, '#FFFFFF');
                    tubeGrad.addColorStop(0.25, ham.tubeColor);
                    tubeGrad.addColorStop(1, ham.tubeColor);
                    ctx.fillStyle = tubeGrad;
                    ctx.strokeStyle = '#4A2C11';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.ellipse(fx, fy + 4, 25 * depthScale, 14.5 * depthScale, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    drawHamsterCharacter(ctx, fx, fy - 4 * depthScale, 16 * depthScale, ham, time, false, g.captainPaddlePhase, g.state === 'IDLE');
                    drawNameTag(fx, fy - 30 * depthScale, ham.name, false);
                });
            };

            drawEliminatedSet(false);

            const rockX = Math.sin(g.boatRockPhase * 0.5) * 7;
            const rockY = Math.cos(g.boatRockPhase * 0.8) * 5;
            const boatX = cx + rockX;
            const boatY = cy + rockY;

            const active = g.students.filter(s => !s.eliminated);
            const hamRadius = Math.max(15, Math.min(28, boatRadius * (active.length > 18 ? 0.12 : active.length > 10 ? 0.15 : 0.19)));
            const usableRadius = boatRadius * 0.80;
            const nameTagQueue: { x: number; y: number; name: string; isCaptain: boolean }[] = [];

            // Sample 3D points along the top circular rim and bottom hull base
            const SEGMENTS = 24;
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
                const pMid0 = projectBoatPoint(cos0 * boatRadius * 0.86, sin0 * boatRadius * 0.86, -bowlDepth * 0.58, boatX, boatY);
                const pMid1 = projectBoatPoint(cos1 * boatRadius * 0.86, sin1 * boatRadius * 0.86, -bowlDepth * 0.58, boatX, boatY);
                const pBot0 = projectBoatPoint(cos0 * boatRadius * 0.48, sin0 * boatRadius * 0.48, -bowlDepth, boatX, boatY);
                const pBot1 = projectBoatPoint(cos1 * boatRadius * 0.48, sin1 * boatRadius * 0.48, -bowlDepth, boatX, boatY);

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

            // Churning wake underneath boat
            ctx.save();
            const wakeRx = boatRadius * 1.18;
            const wakeRy = boatRadius * Math.sin(g.cameraPitch) * 1.05;
            ctx.translate(boatX, boatY + bowlDepth * 0.36);

            ctx.fillStyle = 'rgba(12, 74, 96, 0.32)';
            ctx.beginPath();
            ctx.ellipse(0, 8, wakeRx * 0.96, wakeRy * 0.92, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
            ctx.lineWidth = 5 + Math.min(8, g.boatSpeed * 1.3);
            ctx.setLineDash([22, 14]);
            ctx.lineDashOffset = -time * 75;
            ctx.beginPath();
            ctx.ellipse(0, 0, wakeRx, wakeRy, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();

            // Interior concave basket bowl
            ctx.save();
            ctx.beginPath();
            rimPoints.forEach((seg, idx) => {
                if (idx === 0) ctx.moveTo(seg.pRim0.x, seg.pRim0.y);
                else ctx.lineTo(seg.pRim0.x, seg.pRim0.y);
            });
            ctx.closePath();

            const centerFloor = projectBoatPoint(0, 0, -bowlDepth, boatX, boatY);
            const intGrad = ctx.createRadialGradient(centerFloor.x, centerFloor.y, boatRadius * 0.08, boatX, boatY, boatRadius * 1.05);
            intGrad.addColorStop(0, '#B07D4F');
            intGrad.addColorStop(0.48, '#E6CCB2');
            intGrad.addColorStop(0.82, '#DDB892');
            intGrad.addColorStop(1, '#6C462B');
            ctx.fillStyle = intGrad;
            ctx.fill();
            ctx.clip();

            [0.25, 0.45, 0.65, 0.84].forEach(rRatio => {
                const zLevel = -bowlDepth * (1 - rRatio * rRatio * 0.75);
                ctx.strokeStyle = 'rgba(92, 58, 33, 0.48)';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                for (let i = 0; i <= SEGMENTS; i++) {
                    const a = (i / SEGMENTS) * Math.PI * 2;
                    const pt = projectBoatPoint(Math.cos(a) * boatRadius * rRatio, Math.sin(a) * boatRadius * rRatio, zLevel, boatX, boatY);
                    if (i === 0) ctx.moveTo(pt.x, pt.y);
                    else ctx.lineTo(pt.x, pt.y);
                }
                ctx.stroke();
            });

            for (let i = 0; i < 16; i++) {
                const a = (i / 16) * Math.PI * 2;
                const pTop = projectBoatPoint(Math.cos(a) * boatRadius * 0.96, Math.sin(a) * boatRadius * 0.96, -2, boatX, boatY);
                const pMid = projectBoatPoint(Math.cos(a) * boatRadius * 0.68, Math.sin(a) * boatRadius * 0.68, -bowlDepth * 0.68, boatX, boatY);
                const pBot = projectBoatPoint(Math.cos(a) * boatRadius * 0.22, Math.sin(a) * boatRadius * 0.22, -bowlDepth * 0.96, boatX, boatY);

                ctx.strokeStyle = '#5C3A21';
                ctx.lineWidth = 6.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(pTop.x, pTop.y);
                ctx.quadraticCurveTo(pMid.x, pMid.y, pBot.x, pBot.y);
                ctx.stroke();

                ctx.strokeStyle = '#F3D5B5';
                ctx.lineWidth = 3.2;
                ctx.beginPath();
                ctx.moveTo(pTop.x, pTop.y);
                ctx.quadraticCurveTo(pMid.x, pMid.y, pBot.x, pBot.y);
                ctx.stroke();
            }

            // Wooden cross-bench plank
            const benchZ = -bowlDepth * 0.28;
            const halfLen = boatRadius * 0.84;
            const halfWid = boatRadius * 0.19;
            const corners = [
                projectBoatPoint(-halfLen, -halfWid, benchZ, boatX, boatY),
                projectBoatPoint(halfLen, -halfWid, benchZ, boatX, boatY),
                projectBoatPoint(halfLen, halfWid, benchZ, boatX, boatY),
                projectBoatPoint(-halfLen, halfWid, benchZ, boatX, boatY)
            ];
            ctx.fillStyle = '#E6CCB2';
            ctx.strokeStyle = '#5C3A21';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            ctx.lineTo(corners[1].x, corners[1].y);
            ctx.lineTo(corners[2].x, corners[2].y);
            ctx.lineTo(corners[3].x, corners[3].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

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

                const letters: Record<number, string> = { 2: 'C', 3: 'O', 4: 'C', 5: 'O', 14: 'C', 15: 'H', 16: 'A', 17: 'O', 18: 'S' };
                if (letters[i] && pMid0.y > pRim0.y + 8) {
                    const lx = (pRim0.x + pRim1.x + pMid0.x + pMid1.x) * 0.25;
                    const ly = (pRim0.y + pRim1.y + pMid0.y + pMid1.y) * 0.25;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                    ctx.font = "900 13px 'Fredoka', sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(letters[i], lx, ly);
                }
                ctx.restore();
            };

            const drawColorfulRimSegment = (seg: typeof rimPoints[number]) => {
                const { pRim0, pRim1, i } = seg;
                const color = RIM_COLORS[i % RIM_COLORS.length];
                const rimThickness = 15;

                ctx.save();
                ctx.strokeStyle = '#3A2210';
                ctx.lineWidth = rimThickness + 5;
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

                ctx.fillStyle = '#3A2210';
                ctx.beginPath();
                ctx.arc(pRim0.x, pRim0.y, rimThickness * 0.48, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            };

            // Back rim segments
            rimPoints.forEach(seg => {
                if (seg.avgDepth < 0) {
                    drawHullWallSegment(seg);
                    drawColorfulRimSegment(seg);
                }
            });

            // Depth-sorted hamsters & Captain Coconut inside the boat
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
                const lx = (g.state === 'CHAOS_SPIN' ? ham.curX : ham.seatX) * usableRadius;
                const ly = (g.state === 'CHAOS_SPIN' ? ham.curY : ham.seatY) * usableRadius;
                const rNorm = Math.min(1, Math.hypot(lx, ly) / boatRadius);
                const seatZ = -bowlDepth * (1 - rNorm * rNorm * 0.82) + hamRadius * 0.35;
                const proj = projectBoatPoint(lx, ly, seatZ, boatX, boatY);
                renderEntities.push({ type: 'student', ham, proj, depth: proj.depth });
            });

            const capBounce = Math.abs(Math.sin(g.captainPaddlePhase)) * 8;
            const capProj = projectBoatPoint(0, -boatRadius * 0.78, hamRadius * 0.55 + capBounce, boatX, boatY);
            renderEntities.push({ type: 'captain', proj: capProj, depth: capProj.depth });

            renderEntities.sort((a, b) => a.depth - b.depth);

            renderEntities.forEach(ent => {
                if (ent.type === 'captain') {
                    const capR = Math.max(24, boatRadius * 0.20);
                    drawHamsterCharacter(
                        ctx,
                        ent.proj.x,
                        ent.proj.y,
                        capR,
                        { wobbleAngle: Math.sin(time * 10) * 0.14 - g.boatTiltRoll * 0.5 },
                        time,
                        true,
                        g.captainPaddlePhase,
                        g.state === 'IDLE'
                    );
                    nameTagQueue.push({
                        x: ent.proj.x,
                        y: ent.proj.y - capR - 22,
                        name: 'CAPTAIN COCONUT 🥥',
                        isCaptain: true
                    });
                } else if (ent.ham) {
                    const ham = ent.ham;
                    const screenX = ent.proj.x;
                    const screenY = ent.proj.y + Math.sin(time * 5 + ham.bobOffset) * 2.5;
                    const scale = 0.92 + (ent.proj.depth / (boatRadius * 2)) * 0.18;

                    drawHamsterCharacter(ctx, screenX, screenY, hamRadius * scale, ham, time, false, g.captainPaddlePhase, g.state === 'IDLE');
                    nameTagQueue.push({
                        x: screenX,
                        y: screenY - hamRadius * scale - 14,
                        name: ham.name,
                        isCaptain: false
                    });
                }
            });

            // Front hull wall & front rim segments
            const frontSegments = rimPoints.filter(seg => seg.avgDepth >= 0).sort((a, b) => a.avgDepth - b.avgDepth);
            frontSegments.forEach(seg => drawHullWallSegment(seg));
            frontSegments.forEach(seg => drawColorfulRimSegment(seg));

            // Foreground eliminated hamsters
            drawEliminatedSet(true);

            // Render upright name tags
            nameTagQueue.forEach(tag => drawNameTag(tag.x, tag.y, tag.name, tag.isCaptain));

            // Fake-out airborne hamster (flies over rim toward water, then miraculously curves back into the boat!)
            if (g.fakeOutFlight) {
                const fo = g.fakeOutFlight;
                const t = Math.min(1, fo.t);
                const split = 0.54;
                let curX = 0;
                let curY = 0;
                let zoomScale = 1;

                const lx = (g.state === 'CHAOS_SPIN' ? fo.hamster.curX : fo.hamster.seatX) * usableRadius;
                const ly = (g.state === 'CHAOS_SPIN' ? fo.hamster.curY : fo.hamster.seatY) * usableRadius;
                const rNorm = Math.min(1, Math.hypot(lx, ly) / boatRadius);
                const seatZ = -bowlDepth * (1 - rNorm * rNorm * 0.82) + hamRadius * 0.35;
                const liveSeatProj = projectBoatPoint(lx, ly, seatZ, boatX, boatY);

                if (t <= split) {
                    // Phase 1: Launching high out over the rim toward the water
                    const p1 = t / split;
                    curX = fo.startX + (fo.peakOutX - fo.startX) * p1;
                    const arcHeight = Math.sin(p1 * Math.PI) * 185;
                    curY = fo.startY + (fo.peakOutY - fo.startY) * p1 - arcHeight;
                    zoomScale = 1 + Math.sin(p1 * Math.PI * 0.85) * 0.78;
                    fo.hamster.wobbleAngle = p1 * Math.PI * 5;
                    fo.hamster.expression = 'shocked';
                } else {
                    // Phase 2: Miraculous boomerang/spring bounce back into the boat!
                    const p2 = (t - split) / (1 - split);
                    curX = fo.peakOutX + (liveSeatProj.x - fo.peakOutX) * p2;
                    const returnArc = Math.sin(p2 * Math.PI) * 215;
                    curY = fo.peakOutY + (liveSeatProj.y - fo.peakOutY) * p2 - returnArc;
                    zoomScale = 1 + (1 - p2) * 0.65 + Math.sin(p2 * Math.PI) * 0.35;
                    fo.hamster.wobbleAngle = -p2 * Math.PI * 4;
                    fo.hamster.expression = 'excited';

                    // Draw mid-air water-skim bounce ring at peakOut point
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

                // Dashed acrobatic swoosh trail
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

                drawHamsterCharacter(ctx, curX, curY, hamRadius * zoomScale, fo.hamster, time, false, g.captainPaddlePhase, false);
                drawNameTag(curX, curY - hamRadius * zoomScale - 18, fo.hamster.name, false);

                // Dramatic status badge above name tag
                const badgeText = t <= split ? '😱 FLYING OUT!!' : '😅 BOUNCED BACK TO BOAT!! 🛶';
                const badgeBg = t <= split ? '#EF233C' : '#06D6A0';
                const badgeFg = t <= split ? '#FFFFFF' : '#073B4C';
                ctx.save();
                ctx.font = "800 12px 'Fredoka', sans-serif";
                const bWidth = ctx.measureText(badgeText).width + 18;
                const bx = curX;
                const by = curY - hamRadius * zoomScale - 45;
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
            g.flyingHamsters.forEach(fh => {
                if (fh.delay > 0 || fh.t > 1) return;
                const t = Math.min(1, fh.t);
                const curX = fh.startX + (fh.targetX - fh.startX) * t;
                const curY = fh.startY + (fh.targetY - fh.startY) * t - Math.sin(t * Math.PI) * 210;
                const zoomScale = 1 + Math.sin(t * Math.PI) * 0.72;

                fh.hamster.wobbleAngle = t * Math.PI * 6;
                fh.hamster.expression = 'shocked';
                drawHamsterCharacter(ctx, curX, curY, hamRadius * zoomScale, fh.hamster, time, false, g.captainPaddlePhase, false);
                drawNameTag(curX, curY - hamRadius * zoomScale - 18, fh.hamster.name, false);
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
