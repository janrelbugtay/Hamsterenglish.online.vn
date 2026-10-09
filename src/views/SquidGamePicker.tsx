import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import {
    Users, Play, Check, MousePointerClick, Skull, UserRound, VolumeX,
    Volume2, Volume1, Power, Crown, RotateCcw, Square, Circle, Triangle, Gamepad2, ClipboardList,
    Maximize, Minimize, Tag, Clock, GraduationCap, X, Sparkles, Plus, Trash2, Shuffle, CheckSquare
} from 'lucide-react';
import { ViewState } from '../types';
import { getSavedClasses, DojoClass } from './ClassRecord';
import { SquidHamsterSprite } from '../components/SquidHamsterSprite';

const generateSeed = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return hash;
};

const randomSeeded = (seed: number) => {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
};

const getSavedRoster = () => {
    const saved = localStorage.getItem('squid_roster');
    if (saved) {
        try { 
            const parsed = JSON.parse(saved); 
            if (Array.isArray(parsed) && parsed.length > 0) {
                // If the saved roster contains legacy preloaded mock names, purge them
                const legacyMockNames = [
                    'Anh Tài', 'Bui', 'Công Danh', 'Gia Bảo', 'Gia Hân', 'Hải Đăng', 
                    'Hoàng Ân', 'Hoàng Gia Bảo', 'Hoàng Gia Huy', 'Hữu Bảo', 'Kim Ngọc', 
                    'Minh An', 'Minh Anh', 'Thùy Dung', 'Quốc Bảo', 'Thanh Mai', 'Tuấn Kiệt', 
                    'Bảo Ngọc', 'Đức Huy', 'Khánh Linh', 'Minh Khôi', 'Phương Thảo', 
                    'Trọng Hiếu', 'Hồng Ánh', 'Văn Nam'
                ];
                const hasMock = parsed.some(p => legacyMockNames.includes(p));
                if (!hasMock) {
                    return parsed;
                }
            }
        } catch(e) {}
    }

    // Default to user's first class students if available
    try {
        const savedClasses = getSavedClasses();
        if (savedClasses.length > 0 && savedClasses[0].students.length > 0) {
            return savedClasses[0].students.map(s => s.name);
        }
    } catch(e) {}

    return Array.from({ length: 30 }, (_, i) => `Player ${i + 1}`);
};

export const getPlayerNumber = (name: string): string => {
    if (!name) return '001';
    const match = name.match(/\d+/);
    if (match) {
        return match[0];
    }
    const seed = generateSeed(name);
    return ((Math.abs(seed) % 456) + 1).toString();
};

class SeededRNG {
    s: number;
    constructor(seed: number) {
        this.s = Math.abs(seed) || 12345;
    }
    next(): number {
        this.s = (this.s * 9301 + 49297) % 233280;
        return this.s / 233280;
    }
    range(min: number, max: number): number {
        return min + this.next() * (max - min);
    }
    int(min: number, max: number): number {
        return Math.floor(this.range(min, max + 1));
    }
    choice<T>(arr: T[]): T {
        return arr[this.int(0, arr.length - 1)];
    }
    chance(prob: number): boolean {
        return this.next() < prob;
    }
}

const SKIN_PALETTES = [
    { skin: '#ffd9c7', shadow: '#e5baa3', lip: '#cf6874', blush: 'rgba(244, 63, 94, 0.25)' },
    { skin: '#f8d2b2', shadow: '#dbae8b', lip: '#c55c65', blush: 'rgba(239, 68, 68, 0.22)' },
    { skin: '#f5c197', shadow: '#d1986e', lip: '#b8525b', blush: 'rgba(225, 29, 72, 0.24)' },
    { skin: '#e9b585', shadow: '#c48b59', lip: '#a64a51', blush: 'rgba(225, 29, 72, 0.22)' },
    { skin: '#dea16c', shadow: '#b2743f', lip: '#8f3e40', blush: 'rgba(190, 24, 93, 0.20)' },
    { skin: '#c6824c', shadow: '#9a5722', lip: '#7b3133', blush: 'rgba(159, 18, 57, 0.20)' },
    { skin: '#a56333', shadow: '#773e13', lip: '#662728', blush: 'rgba(136, 19, 55, 0.18)' },
    { skin: '#7d451e', shadow: '#532808', lip: '#4d1c1d', blush: 'rgba(112, 26, 44, 0.18)' },
    { skin: '#542d13', shadow: '#351906', lip: '#3a1516', blush: 'rgba(90, 20, 35, 0.16)' },
    { skin: '#3a1e0c', shadow: '#200f04', lip: '#260e0f', blush: 'rgba(70, 15, 25, 0.16)' }
];

const HAIR_PALETTES = [
    { color: 0x18181b, hex: '#18181b', name: 'Jet Black' },
    { color: 0x271c19, hex: '#271c19', name: 'Dark Espresso' },
    { color: 0x3d2314, hex: '#3d2314', name: 'Chestnut Brown' },
    { color: 0x5c3217, hex: '#5c3217', name: 'Caramel Auburn' },
    { color: 0x8a4b18, hex: '#8a4b18', name: 'Copper Auburn' },
    { color: 0xb87d3b, hex: '#b87d3b', name: 'Golden Blonde' },
    { color: 0xe2b874, hex: '#e2b874', name: 'Platinum Blonde' },
    { color: 0x71717a, hex: '#71717a', name: 'Silver Ash' },
    { color: 0x581c87, hex: '#581c87', name: 'Deep Purple' },
    { color: 0x0e7490, hex: '#0e7490', name: 'Teal Blue' }
];

function buildHairMesh(hairStyle: number, matHair: THREE.Material, matAccent: THREE.Material, rng: SeededRNG): THREE.Group {
    const hairGroup = new THREE.Group();

    if (hairStyle === 0) {
        // Messy Anime Spikes
        const cap = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.35, 1.24), matHair);
        cap.position.set(0, 0.52, -0.02);
        hairGroup.add(cap);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.6, 0.2), matHair);
        back.position.set(0, 0.2, -0.58);
        hairGroup.add(back);

        const spikeGeo = new THREE.ConeGeometry(0.18, 0.45, 4);
        spikeGeo.rotateX(Math.PI / 2);
        const spikes = [
            { pos: [0, 0.72, 0.1], rot: [-0.3, 0, 0], scale: 1.2 },
            { pos: [-0.3, 0.7, 0.15], rot: [-0.35, 0, 0.25], scale: 1.0 },
            { pos: [0.3, 0.7, 0.15], rot: [-0.35, 0, -0.25], scale: 1.0 },
            { pos: [-0.45, 0.62, 0.35], rot: [-0.5, 0, 0.4], scale: 0.9 },
            { pos: [0.45, 0.62, 0.35], rot: [-0.5, 0, -0.4], scale: 0.9 },
            { pos: [0, 0.62, 0.48], rot: [-0.7, 0, 0], scale: 1.1 },
            { pos: [-0.22, 0.6, 0.46], rot: [-0.65, 0, 0.2], scale: 0.95 },
            { pos: [0.22, 0.6, 0.46], rot: [-0.65, 0, -0.2], scale: 0.95 },
            { pos: [0, 0.65, -0.3], rot: [0.3, 0, 0], scale: 1.0 }
        ];
        spikes.forEach(s => {
            const m = new THREE.Mesh(spikeGeo, matHair);
            m.position.set(s.pos[0], s.pos[1], s.pos[2]);
            m.rotation.set(s.rot[0], s.rot[1], s.rot[2]);
            m.scale.setScalar(s.scale);
            hairGroup.add(m);
        });
    } else if (hairStyle === 1) {
        // Classic Side-Part Undercut / K-Drama
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.32, 1.24), matHair);
        top.position.set(0, 0.58, -0.02);
        hairGroup.add(top);

        const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.3), matHair);
        sweep.position.set(0.18, 0.48, 0.55);
        sweep.rotation.z = -0.12;
        hairGroup.add(sweep);

        const sbL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.25), matHair);
        sbL.position.set(-0.62, 0.15, 0.2);
        const sbR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.25), matHair);
        sbR.position.set(0.62, 0.15, 0.2);
        hairGroup.add(sbL, sbR);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.7, 0.18), matHair);
        back.position.set(0, 0.15, -0.58);
        hairGroup.add(back);
    } else if (hairStyle === 2) {
        // Sleek Bob with Straight Fringe / Bangs
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.3, 1.26), matHair);
        top.position.set(0, 0.58, 0);
        hairGroup.add(top);

        const bangs = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.26, 0.16), matHair);
        bangs.position.set(0, 0.42, 0.62);
        hairGroup.add(bangs);

        const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 1.2), matHair);
        sideL.position.set(-0.64, 0.1, 0.05);
        const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 1.2), matHair);
        sideR.position.set(0.64, 0.1, 0.05);
        hairGroup.add(sideL, sideR);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.85, 0.16), matHair);
        back.position.set(0, 0.1, -0.64);
        hairGroup.add(back);
    } else if (hairStyle === 3) {
        // Samurai Topknot / High Bun
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.28, 1.24), matHair);
        top.position.set(0, 0.55, -0.02);
        hairGroup.add(top);

        const bun = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.32, 10), matHair);
        bun.position.set(0, 0.82, -0.25);
        bun.rotation.x = 0.2;
        hairGroup.add(bun);

        const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 10), matAccent);
        tie.position.set(0, 0.7, -0.23);
        tie.rotation.x = 0.2;
        hairGroup.add(tie);

        const strandL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.12), matHair);
        strandL.position.set(-0.54, 0.25, 0.6);
        const strandR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.12), matHair);
        strandR.position.set(0.54, 0.25, 0.6);
        hairGroup.add(strandL, strandR);
    } else if (hairStyle === 4) {
        // Textured Fluffy Curls / Afro Volume
        const curlGeo = new THREE.DodecahedronGeometry(0.26);
        const curlPositions = [
            [0, 0.72, 0], [-0.35, 0.7, 0], [0.35, 0.7, 0],
            [0, 0.7, -0.35], [-0.32, 0.68, -0.32], [0.32, 0.68, -0.32],
            [-0.55, 0.5, 0.1], [0.55, 0.5, 0.1],
            [-0.55, 0.5, -0.25], [0.55, 0.5, -0.25],
            [0, 0.65, 0.35], [-0.3, 0.62, 0.35], [0.3, 0.62, 0.35],
            [0, 0.35, -0.58], [-0.35, 0.35, -0.56], [0.35, 0.35, -0.56]
        ];
        curlPositions.forEach(pos => {
            const curl = new THREE.Mesh(curlGeo, matHair);
            curl.position.set(pos[0], pos[1], pos[2]);
            hairGroup.add(curl);
        });
    } else if (hairStyle === 5) {
        // Athletic Headband + Spiky Tuft
        const headband = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.16, 1.26), matAccent);
        headband.position.set(0, 0.38, 0);
        hairGroup.add(headband);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.27, 0.04, 1.27), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        stripe.position.set(0, 0.38, 0);
        hairGroup.add(stripe);

        const spikeGeo = new THREE.ConeGeometry(0.2, 0.5, 4);
        spikeGeo.rotateX(Math.PI / 2);
        const tufts = [
            [0, 0.68, 0.05, -0.2, 0, 0],
            [-0.28, 0.65, 0.1, -0.25, 0, 0.25],
            [0.28, 0.65, 0.1, -0.25, 0, -0.25],
            [0, 0.62, 0.3, -0.4, 0, 0],
            [-0.2, 0.6, 0.3, -0.4, 0, 0.15],
            [0.2, 0.6, 0.3, -0.4, 0, -0.15],
            [0, 0.6, -0.25, 0.2, 0, 0],
        ];
        tufts.forEach(t => {
            const m = new THREE.Mesh(spikeGeo, matHair);
            m.position.set(t[0], t[1], t[2]);
            m.rotation.set(t[3], t[4], t[5]);
            hairGroup.add(m);
        });

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 0.16), matHair);
        back.position.set(0, 0.2, -0.58);
        hairGroup.add(back);
    } else if (hairStyle === 6) {
        // Squid Game Green Baseball Cap (Forwards)
        const matCap = new THREE.MeshStandardMaterial({ color: 0x1b4d3e, roughness: 0.8 });
        const capDome = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.35, 1.26), matCap);
        capDome.position.set(0, 0.55, 0);
        hairGroup.add(capDome);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.52), matCap);
        visor.position.set(0, 0.44, 0.78);
        visor.rotation.x = -0.1;
        hairGroup.add(visor);

        const button = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
        button.position.set(0, 0.74, 0);
        hairGroup.add(button);

        const hairBack = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.45, 0.18), matHair);
        hairBack.position.set(0, 0.15, -0.58);
        const sbL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), matHair);
        sbL.position.set(-0.62, 0.18, 0.2);
        const sbR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), matHair);
        sbR.position.set(0.62, 0.18, 0.2);
        hairGroup.add(hairBack, sbL, sbR);
    } else if (hairStyle === 7) {
        // Squid Game Green Baseball Cap (Backwards)
        const matCap = new THREE.MeshStandardMaterial({ color: 0x1b4d3e, roughness: 0.8 });
        const capDome = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.35, 1.26), matCap);
        capDome.position.set(0, 0.55, 0);
        hairGroup.add(capDome);

        const visor = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.06, 0.5), matCap);
        visor.position.set(0, 0.44, -0.78);
        visor.rotation.x = 0.15;
        hairGroup.add(visor);

        const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 0.2), matHair);
        bangs.position.set(0, 0.36, 0.58);
        hairGroup.add(bangs);

        const sbL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), matHair);
        sbL.position.set(-0.62, 0.18, 0.2);
        const sbR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.35, 0.25), matHair);
        sbR.position.set(0.62, 0.18, 0.2);
        hairGroup.add(sbL, sbR);
    } else if (hairStyle === 8) {
        // Two-Block Curtain Bangs (Modern K-Pop)
        const top = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.35, 1.24), matHair);
        top.position.set(0, 0.58, -0.02);
        hairGroup.add(top);

        const bangL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.22), matHair);
        bangL.position.set(-0.35, 0.38, 0.58);
        bangL.rotation.z = -0.15;
        const bangR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.35, 0.22), matHair);
        bangR.position.set(0.35, 0.38, 0.58);
        bangR.rotation.z = 0.15;
        hairGroup.add(bangL, bangR);

        const back = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.65, 0.18), matHair);
        back.position.set(0, 0.18, -0.58);
        const sbL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.3), matHair);
        sbL.position.set(-0.62, 0.15, 0.15);
        const sbR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.3), matHair);
        sbR.position.set(0.62, 0.15, 0.15);
        hairGroup.add(back, sbL, sbR);
    } else {
        // Beanie Hat (Rolled Cuff)
        const beanieColor = rng.choice([0x27272a, 0x991b1b, 0xd97706, 0x1e293b]);
        const matBeanie = new THREE.MeshStandardMaterial({ color: beanieColor, roughness: 0.9 });
        const dome = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.45, 1.26), matBeanie);
        dome.position.set(0, 0.65, -0.02);
        hairGroup.add(dome);

        const cuff = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 1.3), matBeanie);
        cuff.position.set(0, 0.42, -0.02);
        hairGroup.add(cuff);

        const strand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.16), matHair);
        strand.position.set(-0.1, 0.32, 0.6);
        strand.rotation.z = -0.1;
        hairGroup.add(strand);
    }

    hairGroup.traverse((c: any) => { if (c.isMesh) c.castShadow = true; });
    return hairGroup;
}

function buildGlassesMesh(glassesType: number): THREE.Group {
    const glassesGroup = new THREE.Group();
    const matFrame = glassesType === 2 
        ? new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.8 })
        : (glassesType === 1 
            ? new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
            : new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.3 }));

    const frameZ = 0.65;
    const frameY = 0.08;

    if (glassesType === 0) {
        // Round Wireframe Glasses
        const rimGeo = new THREE.TorusGeometry(0.18, 0.025, 8, 16);
        const rimL = new THREE.Mesh(rimGeo, matFrame);
        rimL.position.set(-0.25, frameY, frameZ);
        const rimR = new THREE.Mesh(rimGeo, matFrame);
        rimR.position.set(0.25, frameY, frameZ);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.02), matFrame);
        bridge.position.set(0, frameY + 0.04, frameZ);

        glassesGroup.add(rimL, rimR, bridge);
    } else if (glassesType === 1) {
        // Modern Rectangular Glasses
        const rimL = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.04), matFrame);
        rimL.position.set(-0.25, frameY, frameZ);
        const rimR = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 0.04), matFrame);
        rimR.position.set(0.25, frameY, frameZ);

        const matLens = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.35, roughness: 0.1 });
        const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.02), matLens);
        lensL.position.set(-0.25, frameY, frameZ + 0.01);
        const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.02), matLens);
        lensR.position.set(0.25, frameY, frameZ + 0.01);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05, 0.04), matFrame);
        bridge.position.set(0, frameY + 0.05, frameZ);

        glassesGroup.add(rimL, rimR, lensL, lensR, bridge);
    } else {
        // Cool Sunglasses
        const shadeGeo = new THREE.BoxGeometry(0.42, 0.3, 0.05);
        const matDarkLens = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.15, metalness: 0.5 });
        const shadeL = new THREE.Mesh(shadeGeo, matDarkLens);
        shadeL.position.set(-0.25, frameY, frameZ);
        const shadeR = new THREE.Mesh(shadeGeo, matDarkLens);
        shadeR.position.set(0.25, frameY, frameZ);

        const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.05), matDarkLens);
        bridge.position.set(0, frameY + 0.08, frameZ);

        glassesGroup.add(shadeL, shadeR, bridge);
    }

    const templeL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.65), matFrame);
    templeL.position.set(-0.62, frameY + 0.02, 0.32);
    const templeR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.65), matFrame);
    templeR.position.set(0.62, frameY + 0.02, 0.32);
    glassesGroup.add(templeL, templeR);

    return glassesGroup;
}





class AudioEngine {
    ctx: AudioContext;
    muted: boolean;
    volume: number;
    masterGain: GainNode;
    bgmGain: GainNode;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.muted = false;
        this.volume = 0.8;
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.connect(this.masterGain);
        this.bgmGain.gain.value = 0.05;
    }

    setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(1, vol));
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        }
    }

    setMuted(muted: boolean) {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        }
    }

    play(type = 'click', freq = 400) {
        if (this.muted || this.ctx.state === 'suspended') return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.start(); osc.stop(this.ctx.currentTime + 0.1);
        } else if (type === 'pop') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.start(); osc.stop(this.ctx.currentTime + 0.1);
        } else if (type === 'boom') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.6);
            osc.start(); osc.stop(this.ctx.currentTime + 0.6);
        } else if (type === 'spin') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(100, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(300, this.ctx.currentTime + 3);
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3);
            osc.start(); osc.stop(this.ctx.currentTime + 3);
        } else if (type === 'alarm') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.2);
            osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
            osc.start(); osc.stop(this.ctx.currentTime + 0.6);
        } else if (type === 'win') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, this.ctx.currentTime);
            osc.frequency.setValueAtTime(600, this.ctx.currentTime + 0.2);
            osc.frequency.setValueAtTime(800, this.ctx.currentTime + 0.4);
            osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.6);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.0);
            osc.start(); osc.stop(this.ctx.currentTime + 2.0);
        } else if (type === 'bonk') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq || 160, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
            osc.start(); osc.stop(this.ctx.currentTime + 0.15);
        } else if (type === 'tick') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq || 850, this.ctx.currentTime);
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.05);
            osc.start(); osc.stop(this.ctx.currentTime + 0.05);
        } else if (type === 'lock') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq || 220, this.ctx.currentTime);
            osc.frequency.setValueAtTime(120, this.ctx.currentTime + 0.08);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
            osc.start(); osc.stop(this.ctx.currentTime + 0.25);
        } else if (type === 'laser') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq || 1400, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(250, this.ctx.currentTime + 0.35);
            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);
            osc.start(); osc.stop(this.ctx.currentTime + 0.35);
        } else if (type === 'gong') {
            const now = this.ctx.currentTime;
            const osc1 = this.ctx.createOscillator();
            const gain1 = this.ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(110, now);
            osc1.frequency.exponentialRampToValueAtTime(65, now + 1.8);
            gain1.gain.setValueAtTime(0.35, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
            osc1.connect(gain1);
            gain1.connect(this.masterGain);
            osc1.start(now); osc1.stop(now + 1.8);

            const osc2 = this.ctx.createOscillator();
            const gain2 = this.ctx.createGain();
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(275, now);
            osc2.frequency.exponentialRampToValueAtTime(210, now + 1.4);
            gain2.gain.setValueAtTime(0.18, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
            osc2.connect(gain2);
            gain2.connect(this.masterGain);
            osc2.start(now); osc2.stop(now + 1.4);
            return;
        } else if (type === 'stamp') {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(190, now);
            osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(now); osc.stop(now + 0.25);
            return;
        } else if (type === 'ghost') {
            const now = this.ctx.currentTime;
            const freqs = [523.25, 659.25, 783.99, 1046.50];
            freqs.forEach((f, idx) => {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.type = 'sine';
                o.frequency.setValueAtTime(f, now + idx * 0.12);
                g.gain.setValueAtTime(0, now + idx * 0.12);
                g.gain.linearRampToValueAtTime(0.08, now + idx * 0.12 + 0.05);
                g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
                o.connect(g);
                g.connect(this.masterGain);
                o.start(now + idx * 0.12);
                o.stop(now + idx * 0.12 + 0.6);
            });
            return;
        }
        
        osc.connect(gain);
        gain.connect(this.masterGain);
    }
    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime);
        }
        return this.muted;
    }
    resume() { if(this.ctx.state === 'suspended') this.ctx.resume(); }
}
let globalAudio: AudioEngine | null = null;

export const stopAnnounce = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
};

const announce = (text: string) => {
    if (globalAudio?.muted) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    
    // Attempt to grab voices
    let voices = window.speechSynthesis.getVoices();
    
    const speak = () => {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
        voices = window.speechSynthesis.getVoices();
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Try to find a female voice
        const femaleVoice = voices.find(v => 
            v.name.includes('Female') || 
            v.name.includes('Samantha') || 
            v.name.includes('Zira') || 
            v.name.includes('Google UK English Female') ||
            (v.name.includes('Google US English') && v.name.includes('Female')) ||
            v.name.includes('Microsoft Hazel') ||
            v.name.includes('Microsoft Zira') ||
            v.name.includes('Karen') ||
            v.name.includes('Tessa') ||
            v.name.includes('Moira')
        );
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        } else if (voices.length > 0) {
            // Fallback to first voice, maybe modify pitch to simulate female
            utterance.pitch = 1.4;
        }
        
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speak();
        };
    } else {
        speak();
    }
};


const GameEngine = {
    generateGameSequence: (studentNames: string[], mode = 'picker', pickCount = 1) => {
        let activePlayers = [...studentNames];
        let rounds = [];

        if (mode === 'picker') {
            // True Fisher-Yates shuffle for unpredictable randomness
            let shuffled = [...activePlayers];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            let eliminated = shuffled.slice(0, pickCount);
            let survivors = shuffled.slice(pickCount);
            
            let numDoors = Math.min(5, Math.max(2, Math.min(activePlayers.length, 6))); 
            
            // True Mingle Door Lockout:
            // All doors are safe shelters. Contestants scramble to enter before doors lock.
            // Players who CANNOT get inside the door before the buzzer are locked out and eliminated!
            const pattern = 'lockout';
            
            let distribution: string[][] = Array.from({length: numDoors}, () => []);
            let safeDoors: number[] = [];
            for (let i = 0; i < numDoors; i++) safeDoors.push(i);
            let trapDoors: number[] = []; // No redundant trap rooms! All rooms are safe havens.

            // Distribute survivors across all open doors (they successfully enter inside!)
            survivors.forEach((p, i) => {
                distribution[i % numDoors].push(p);
            });
            
            // Assign each eliminated player a door they desperately sprint toward (they will fail to enter and get locked out outside)
            eliminated.forEach(p => {
                const targetDoor = Math.floor(Math.random() * numDoors);
                distribution[targetDoor].push(p);
            });

            rounds.push({
                roundNum: 1, 
                activePlayers: [...activePlayers], 
                numDoors, 
                distribution, 
                survivors, 
                eliminated, 
                safeDoors, 
                trapDoors,
                pattern
            });
            
            return { chosenOnes: eliminated, rounds: rounds, mode: mode };
        } else {
            let roundNum = 1;
            let maxSafetyRounds = 15; 

            while(activePlayers.length > 1 && maxSafetyRounds > 0) {
                let numDoors = 3;
                if(activePlayers.length <= 3) numDoors = 2;
                else if(activePlayers.length <= 6) numDoors = 3;
                else if(activePlayers.length <= 12) numDoors = 4;
                else numDoors = 5;

                let distribution: string[][] = Array.from({length: numDoors}, () => []);
                let shuffled = [...activePlayers].sort(() => 0.5 - Math.random());
                
                // In survival mode, 1 or 2 contestants cannot enter the doors in time and get eliminated
                const elimCount = activePlayers.length > 6 ? 2 : 1;
                const roundEliminated = shuffled.slice(0, elimCount);
                const roundSurvivors = shuffled.slice(elimCount);

                let safeDoors: number[] = [];
                for(let i = 0; i < numDoors; i++) safeDoors.push(i);
                let trapDoors: number[] = []; // No redundant trap rooms!

                // Survivors successfully distribute and enter inside the doors
                roundSurvivors.forEach((p, i) => {
                    distribution[i % numDoors].push(p);
                });

                // Eliminated players sprint toward doors but get locked out at threshold
                roundEliminated.forEach((p) => {
                    const doorIdx = Math.floor(Math.random() * numDoors);
                    distribution[doorIdx].push(p);
                });

                rounds.push({
                    roundNum, 
                    activePlayers: [...activePlayers], 
                    numDoors, 
                    distribution, 
                    survivors: roundSurvivors, 
                    eliminated: roundEliminated, 
                    safeDoors, 
                    trapDoors,
                    pattern: 'lockout'
                });
                activePlayers = roundSurvivors;
                roundNum++;
                maxSafetyRounds--;
            }

            return { chosenOnes: [activePlayers[0]], rounds: rounds, mode: mode };
        }
    }
};

export function generateStaticPlayerAvatar(name: string, numberStr: string): string {
    const seed = generateSeed(name);
    const rng = new SeededRNG(seed);
    const skinPalette = SKIN_PALETTES[rng.int(0, SKIN_PALETTES.length - 1)];
    const hairPalette = HAIR_PALETTES[rng.int(0, HAIR_PALETTES.length - 1)];

    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Studio backdrop gradient
    const bgGrad = ctx.createRadialGradient(160, 140, 20, 160, 160, 180);
    bgGrad.addColorStop(0, '#1e293b');
    bgGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 320, 320);

    // Subtle Squid Game geometry symbol in background
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.lineWidth = 4;
    const shapeType = rng.int(0, 2);
    if (shapeType === 0) {
        ctx.beginPath();
        ctx.arc(160, 130, 80, 0, Math.PI * 2);
        ctx.stroke();
    } else if (shapeType === 1) {
        ctx.beginPath();
        ctx.moveTo(160, 50);
        ctx.lineTo(235, 180);
        ctx.lineTo(85, 180);
        ctx.closePath();
        ctx.stroke();
    } else {
        ctx.strokeRect(95, 65, 130, 130);
    }

    // Torso / Shoulders (Green Tracksuit)
    ctx.fillStyle = '#1b4d3e';
    ctx.beginPath();
    ctx.moveTo(40, 320);
    ctx.quadraticCurveTo(80, 230, 130, 220);
    ctx.lineTo(190, 220);
    ctx.quadraticCurveTo(240, 230, 280, 320);
    ctx.closePath();
    ctx.fill();

    // White shoulder stripes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(60, 320);
    ctx.quadraticCurveTo(85, 250, 110, 230);
    ctx.lineTo(122, 235);
    ctx.quadraticCurveTo(95, 260, 75, 320);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(260, 320);
    ctx.quadraticCurveTo(235, 250, 210, 230);
    ctx.lineTo(198, 235);
    ctx.quadraticCurveTo(225, 260, 245, 320);
    ctx.closePath();
    ctx.fill();

    // Neck Collar
    ctx.fillStyle = '#153e32';
    ctx.fillRect(135, 205, 50, 25);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(140, 207, 40, 4);

    // Front Zipper
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(158, 225, 4, 95);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(155, 235, 10, 14);

    // Left chest participant number badge
    ctx.fillStyle = '#ffffff';
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(85, 255, 56, 34, 6);
        ctx.fill();
    } else {
        ctx.fillRect(85, 255, 56, 34);
    }
    ctx.fillStyle = '#1b4d3e';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numberStr, 113, 272);

    // Neck
    ctx.fillStyle = skinPalette.shadow;
    ctx.fillRect(142, 185, 36, 25);

    // Head Base
    ctx.fillStyle = skinPalette.skin;
    if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(105, 80, 110, 115, 12);
        ctx.fill();
    } else {
        ctx.fillRect(105, 80, 110, 115);
    }

    // 3D Nose
    ctx.fillStyle = skinPalette.shadow;
    ctx.fillRect(152, 136, 16, 14);

    // Ears
    ctx.fillStyle = skinPalette.skin;
    ctx.fillRect(96, 120, 10, 26);
    ctx.fillRect(214, 120, 10, 26);
    ctx.fillStyle = skinPalette.shadow;
    ctx.fillRect(99, 124, 6, 18);
    ctx.fillRect(215, 124, 6, 18);

    // Eyes
    const eyeY = 124;
    const eyeSpacing = 24;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(160 - eyeSpacing - 12, eyeY, 18, 14);
    ctx.fillRect(160 + eyeSpacing - 6, eyeY, 18, 14);
    ctx.fillStyle = hairPalette.hex;
    ctx.fillRect(160 - eyeSpacing - 8, eyeY + 2, 12, 12);
    ctx.fillRect(160 + eyeSpacing - 4, eyeY + 2, 12, 12);
    ctx.fillStyle = '#000000';
    ctx.fillRect(160 - eyeSpacing - 6, eyeY + 4, 8, 8);
    ctx.fillRect(160 + eyeSpacing - 2, eyeY + 4, 8, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(160 - eyeSpacing - 5, eyeY + 3, 3, 3);
    ctx.fillRect(160 + eyeSpacing - 1, eyeY + 3, 3, 3);

    // Eyebrows
    ctx.fillStyle = hairPalette.hex;
    ctx.fillRect(160 - eyeSpacing - 14, eyeY - 8, 22, 5);
    ctx.fillRect(160 + eyeSpacing - 8, eyeY - 8, 22, 5);

    // Mouth
    ctx.fillStyle = skinPalette.lip;
    ctx.fillRect(146, 166, 28, 6);

    // Blush / Accents
    ctx.fillStyle = skinPalette.blush;
    ctx.beginPath();
    ctx.arc(125, 148, 10, 0, Math.PI * 2);
    ctx.arc(195, 148, 10, 0, Math.PI * 2);
    ctx.fill();

    // Hair Style
    const hairStyle = rng.int(0, 9);
    ctx.fillStyle = hairPalette.hex;

    if (hairStyle === 6) { // Forward Green Cap
        ctx.fillStyle = '#1b4d3e';
        ctx.fillRect(100, 62, 120, 42);
        ctx.fillStyle = '#153e32';
        ctx.fillRect(92, 96, 136, 14);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(156, 56, 8, 8);
    } else if (hairStyle === 8) { // Beanie
        ctx.fillStyle = '#334155';
        ctx.fillRect(100, 52, 120, 52);
        ctx.fillStyle = '#475569';
        ctx.fillRect(96, 92, 128, 16);
    } else { // Hair
        ctx.fillRect(100, 58, 120, 36);
        ctx.fillRect(96, 75, 14, 45);
        ctx.fillRect(210, 75, 14, 45);

        if (hairStyle === 0) { // Spikes
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.moveTo(105 + i * 25, 62);
                ctx.lineTo(118 + i * 25, 34);
                ctx.lineTo(130 + i * 25, 62);
                ctx.closePath();
                ctx.fill();
            }
        } else if (hairStyle === 3) { // Topknot / Ponytail
            ctx.beginPath();
            ctx.arc(160, 40, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f43f5e';
            ctx.fillRect(150, 54, 20, 6);
        } else if (hairStyle === 4) { // Curls
            for (let i = 0; i < 6; i++) {
                ctx.beginPath();
                ctx.arc(110 + i * 20, 58, 16, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    // Glasses if rolled
    const hasGlasses = rng.chance(0.35);
    if (hasGlasses) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 3;
        ctx.strokeRect(120, 118, 28, 22);
        ctx.strokeRect(172, 118, 28, 22);
        ctx.beginPath();
        ctx.moveTo(148, 128);
        ctx.lineTo(172, 128);
        ctx.stroke();
    }

    return canvas.toDataURL('image/png');
}

class ThreeManager {
    containerId: string;
    scene: THREE.Scene | null = null;
    camera: THREE.PerspectiveCamera | null = null;
    renderer: THREE.WebGLRenderer | null = null;
    characters: any = {};
    playerAvatars: Record<string, string> = {};
    doors: any[] = [];
    guards: any[] = [];
    innerPlatform: any = null; 
    isAnimating = false;
    labels: any = {}; 
    labelSmoothedPos: Record<string, { x: number; y: number; offsetY: number }> = {};
    labelContainer: HTMLDivElement | null = null;
    currentRoundData: any = null;
    onStateChange: any = null; 
    uniformTextures: any = {}; 
    faceTextures: any = {}; 
    baseLightIntensity = 0.8;
    ambientLight: any = null;
    dirLight: any = null;
    spotLight: any = null;
    alarmLight: any = null;
    shapes = ['star', 'triangle', 'umbrella', 'circle', 'square'];
    currentDoorRadius = 20;
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    spinTarget = 0;
    spinTimeout: any = null;
    waitingForSpinResolve: any = null;
    waitingForTagStartResolve: any = null;
    clickHandler: ((e: MouseEvent) => void) | null = null;
    resizeObserver: ResizeObserver | null = null;
    gameType: 'mingle' | 'tag' = 'mingle';
    mingleEnvGroup: THREE.Group | null = null;
    tagEnvGroup: THREE.Group | null = null;
    itPlayerName: string = '';
    tagRoundCount: number = 0;
    lastCaughtPlayer: string | null = null;
    tagTimer: number = 15;
    activeChaseInterval: any = null;
    activeDoorCountdownInterval: any = null;
    stopEvasion: (() => void) | null = null;
    mingleSpinCount: number = 0;
    currentCamLookAt: THREE.Vector3 = new THREE.Vector3(0, 0, 1.5);
    tagCamTargetPos: THREE.Vector3 | null = null;
    tagCamTargetLook: THREE.Vector3 | null = null;

    triggerPlayerTrip(char: any, isVictimSlip: boolean = false) {
        if (!char || !char.userData || !char.userData.isAlive || char.userData.isFallen || char.userData.wasTagged) return;
        char.userData.isFallen = true;
        char.userData.fallState = 'tripping';
        char.userData.isCustomArmAnim = true;

        const parts = char.userData.parts;
        // Phase 1: Lurch forward losing balance (0.2s)
        if (parts?.torso) gsap.to(parts.torso.rotation, { x: 0.55, duration: 0.2, overwrite: 'auto' });
        if (parts?.head) gsap.to(parts.head.rotation, { x: 0.35, duration: 0.2, overwrite: 'auto' });
        if (parts?.armL) gsap.to(parts.armL.rotation, { x: -Math.PI * 0.75, z: 0.35, duration: 0.2, overwrite: 'auto' });
        if (parts?.armR) gsap.to(parts.armR.rotation, { x: -Math.PI * 0.75, z: -0.35, duration: 0.2, overwrite: 'auto' });

        // Phase 2: Fall down flat onto grass/knees (0.35s)
        gsap.to(char.position, {
            y: 0.38,
            duration: 0.35,
            delay: 0.18,
            ease: "bounce.out"
        });
        const tiltRoll = (Math.random() > 0.5 ? 0.35 : -0.35);
        gsap.to(char.rotation, {
            x: Math.PI * 0.42,
            z: tiltRoll,
            duration: 0.35,
            delay: 0.18,
            ease: "power2.out",
            onComplete: () => {
                char.userData.fallState = 'fallen';
                if (!char.userData.wasTagged) {
                    const stayDownTime = isVictimSlip ? 750 : 850 + Math.random() * 450;
                    setTimeout(() => {
                        if (!char.userData.isAlive || char.userData.wasTagged) return;
                        char.userData.fallState = 'standing_up';

                        // Phase 3: Push back up and stand up!
                        gsap.to(char.position, { y: 1.0, duration: 0.45, ease: "power2.out" });
                        gsap.to(char.rotation, { x: 0, z: 0, duration: 0.45, ease: "power2.out" });
                        if (parts?.torso) gsap.to(parts.torso.rotation, { x: 0, duration: 0.4 });
                        if (parts?.head) gsap.to(parts.head.rotation, { x: 0, y: 0, duration: 0.4 });
                        if (parts?.armL) gsap.to(parts.armL.rotation, { x: 0, z: 0, duration: 0.35 });
                        if (parts?.armR) gsap.to(parts.armR.rotation, { x: 0, z: 0, duration: 0.35 });

                        setTimeout(() => {
                            if (!char.userData.isAlive) return;
                            char.userData.isFallen = false;
                            char.userData.fallState = 'upright';
                            char.userData.isCustomArmAnim = false;
                            char.userData.sprintBoost = 1.45;
                            setTimeout(() => {
                                if (char.userData) char.userData.sprintBoost = 1.0;
                            }, 1500);
                        }, 480);
                    }, stayDownTime);
                }
            }
        });
    }

    setTagTimer(seconds: number) {
        this.tagTimer = Math.max(5, Math.min(60, seconds));
    }

    cancelChase() {
        if (this.activeChaseInterval) {
            clearInterval(this.activeChaseInterval);
            this.activeChaseInterval = null;
        }
        if (this.activeDoorCountdownInterval) {
            clearInterval(this.activeDoorCountdownInterval);
            this.activeDoorCountdownInterval = null;
        }
        if (this.stopEvasion) {
            this.stopEvasion();
            this.stopEvasion = null;
        }
        if (this.waitingForTagStartResolve) {
            this.waitingForTagStartResolve = null;
        }
        if (this.waitingForSpinResolve) {
            this.waitingForSpinResolve = null;
        }
        if (this.onStateChange) {
            this.onStateChange({ chaseSecondsLeft: undefined, isMusicPlaying: false });
        }
        if (this.gameType === 'tag') {
            this.updateCameraFraming(false);
        }
    }

    isStandbyActive: boolean = true;
    activeEliminationEffects: Array<{
        type: 'shockwave' | 'dizzy_stars' | 'ghost' | 'smoke_puff';
        mesh: THREE.Object3D;
        update: (time: number, delta: number) => boolean;
    }> = [];

    stopStandbyMode() {
        this.isStandbyActive = false;
        Object.values(this.characters).forEach((char: any) => {
            if (char && char.userData) {
                char.userData.isStandbyMoving = false;
                if (!char.userData.isCustomArmAnim) {
                    if (char.userData.parts?.armL) char.userData.parts.armL.rotation.set(0, 0, 0);
                    if (char.userData.parts?.armR) char.userData.parts.armR.rotation.set(0, 0, 0);
                }
                if (char.userData.parts?.head) char.userData.parts.head.rotation.set(0, 0, 0);
                if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.set(0, 0, 0);
                if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.set(0, 0, 0);
            }
        });
    }

    addEliminationEffect(effect: {
        type: 'shockwave' | 'dizzy_stars' | 'ghost' | 'smoke_puff';
        mesh: THREE.Object3D;
        update: (time: number, delta: number) => boolean;
    }) {
        if (this.scene && effect.mesh) {
            this.scene.add(effect.mesh);
        }
        this.activeEliminationEffects.push(effect);
    }

    updateEliminationEffects(time: number, delta: number = 0.016) {
        for (let i = this.activeEliminationEffects.length - 1; i >= 0; i--) {
            const eff = this.activeEliminationEffects[i];
            const keep = eff.update(time, delta);
            if (!keep) {
                if (eff.mesh && eff.mesh.parent) {
                    eff.mesh.parent.remove(eff.mesh);
                }
                this.activeEliminationEffects.splice(i, 1);
            }
        }
    }

    clearEliminationEffects() {
        this.activeEliminationEffects.forEach(eff => {
            if (eff.mesh && eff.mesh.parent) {
                eff.mesh.parent.remove(eff.mesh);
            }
        });
        this.activeEliminationEffects = [];
    }

    createDizzyStars(targetChar: THREE.Object3D) {
        const starGroup = new THREE.Group();
        starGroup.position.set(0, 3.4, 0);
        
        const matStar = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffb700,
            emissiveIntensity: 0.8,
            metalness: 0.5,
            roughness: 0.2
        });
        
        const starCount = 4;
        const radius = 0.85;
        for (let i = 0; i < starCount; i++) {
            const angle = (i / starCount) * Math.PI * 2;
            const starMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), matStar);
            starMesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
            starGroup.add(starMesh);
        }
        targetChar.add(starGroup);

        let elapsed = 0;
        this.addEliminationEffect({
            type: 'dizzy_stars',
            mesh: starGroup,
            update: (time: number, delta: number) => {
                elapsed += delta;
                starGroup.rotation.y = time * 4.5;
                starGroup.children.forEach((star, idx) => {
                    star.position.y = Math.sin(time * 6 + idx * 1.5) * 0.12;
                    star.rotation.x = time * 3;
                    star.rotation.z = time * 3;
                });
                return elapsed < 8.0;
            }
        });
    }

    createGhostHamster(worldPos: THREE.Vector3) {
        const ghostGroup = new THREE.Group();
        ghostGroup.position.set(worldPos.x, worldPos.y + 0.5, worldPos.z);

        const matGhost = new THREE.MeshStandardMaterial({
            color: 0xe0f2fe,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.85,
            roughness: 0.3
        });
        const matBlack = new THREE.MeshBasicMaterial({ color: 0x0f172a });
        const matHalo = new THREE.MeshStandardMaterial({
            color: 0xfef08a,
            emissive: 0xfacc15,
            emissiveIntensity: 0.9,
            metalness: 0.8,
            roughness: 0.2
        });

        // Chubby ghost body
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), matGhost);
        body.scale.set(0.85, 1.25, 0.75);
        ghostGroup.add(body);

        // Cute glowing halo
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.05, 8, 20), matHalo);
        halo.rotation.x = Math.PI / 2.2;
        halo.position.set(0, 1.15, 0);
        ghostGroup.add(halo);

        // Ghost hamster ears
        [-0.45, 0.45].forEach(x => {
            const ear = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), matGhost);
            ear.position.set(x, 0.65, 0.05);
            ghostGroup.add(ear);
        });

        // Cute smiling eyes
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), matBlack);
        eyeL.position.set(-0.2, 0.18, 0.5);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), matBlack);
        eyeR.position.set(0.2, 0.18, 0.5);
        ghostGroup.add(eyeL, eyeR);

        // Waving ghost arm
        const armGroup = new THREE.Group();
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 12), matGhost);
        arm.position.set(0, -0.25, 0);
        armGroup.add(arm);
        armGroup.position.set(0.55, 0.1, 0.1);
        ghostGroup.add(armGroup);

        let elapsed = 0;
        const startY = ghostGroup.position.y;
        this.addEliminationEffect({
            type: 'ghost',
            mesh: ghostGroup,
            update: (time: number, delta: number) => {
                elapsed += delta;
                ghostGroup.position.y = startY + elapsed * 1.6;
                ghostGroup.position.x = worldPos.x + Math.sin(time * 3.5) * 0.35;
                ghostGroup.rotation.y = Math.sin(time * 2.5) * 0.3;
                halo.rotation.z = time * 3;
                armGroup.rotation.z = Math.sin(time * 10) * 0.4 - 0.5;

                if (elapsed > 2.0) {
                    const fade = Math.max(0, 1 - (elapsed - 2.0) / 1.5);
                    matGhost.opacity = 0.85 * fade;
                    matHalo.opacity = fade;
                    if (fade <= 0) return false;
                }
                return elapsed < 3.8;
            }
        });
    }

    createEliminationShockwave(pos: THREE.Vector3) {
        const ringGeo = new THREE.RingGeometry(0.4, 0.9, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff1e56,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = -Math.PI / 2;
        ringMesh.position.set(pos.x, 0.08, pos.z);

        let elapsed = 0;
        this.addEliminationEffect({
            type: 'shockwave',
            mesh: ringMesh,
            update: (time: number, delta: number) => {
                elapsed += delta;
                const scale = 1 + elapsed * 10;
                ringMesh.scale.set(scale, scale, 1);
                ringMat.opacity = Math.max(0, 0.95 * (1 - elapsed / 0.85));
                return elapsed < 0.85;
            }
        });
    }

    createSmokePuffs(pos: THREE.Vector3) {
        const puffGroup = new THREE.Group();
        puffGroup.position.set(pos.x, 0.2, pos.z);
        const puffCount = 6;
        const matPuff = new THREE.MeshStandardMaterial({
            color: 0xf1f5f9,
            roughness: 0.9,
            transparent: true,
            opacity: 0.8
        });

        const puffs: { mesh: THREE.Mesh; vx: number; vz: number }[] = [];
        for (let i = 0; i < puffCount; i++) {
            const ang = (i / puffCount) * Math.PI * 2;
            const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35 + Math.random() * 0.15, 8, 8), matPuff);
            puffGroup.add(puff);
            puffs.push({
                mesh: puff,
                vx: Math.cos(ang) * (0.8 + Math.random() * 0.6),
                vz: Math.sin(ang) * (0.8 + Math.random() * 0.6)
            });
        }

        let elapsed = 0;
        this.addEliminationEffect({
            type: 'smoke_puff',
            mesh: puffGroup,
            update: (time: number, delta: number) => {
                elapsed += delta;
                puffs.forEach(p => {
                    p.mesh.position.x += p.vx * delta * 2.5;
                    p.mesh.position.z += p.vz * delta * 2.5;
                    p.mesh.position.y += delta * 0.8;
                    const sc = 1 + elapsed * 1.5;
                    p.mesh.scale.set(sc, sc, sc);
                });
                matPuff.opacity = Math.max(0, 0.8 * (1 - elapsed / 0.75));
                return elapsed < 0.75;
            }
        });
    }

    async executeEliminationSequence(eliminatedNames: string[], pattern: string = 'trap_room') {
        if (!eliminatedNames || eliminatedNames.length === 0) return;

        // 1. Play dramatic audio
        if (globalAudio) {
            globalAudio.play('alarm');
            setTimeout(() => globalAudio?.play('boom'), 250);
            setTimeout(() => globalAudio?.play('gong'), 350);
            setTimeout(() => globalAudio?.play('ghost'), 1100);
        }

        // 2. Compute camera target framing
        const victimChars = eliminatedNames.map(n => this.characters[n]).filter(Boolean);
        if (victimChars.length > 0 && this.camera) {
            const centroid = new THREE.Vector3();
            victimChars.forEach(c => {
                const wp = new THREE.Vector3();
                c.getWorldPosition(wp);
                centroid.add(wp);
            });
            centroid.divideScalar(victimChars.length);

            // Spotlight target
            if (this.spotLight) {
                this.spotLight.intensity = 25;
                this.spotLight.color.setHex(0xff0033);
                this.spotLight.position.set(centroid.x, 22, centroid.z);
                this.spotLight.target.position.copy(centroid);
                this.scene?.add(this.spotLight.target);
            }

            // Smooth dramatic camera zoom toward victims
            const camTargetX = centroid.x * 0.6;
            const camTargetZ = centroid.z + (centroid.z > 0 ? 12 : -12);
            gsap.to(this.camera.position, {
                x: camTargetX,
                y: 10,
                z: camTargetZ,
                duration: 0.9,
                ease: "power2.out"
            });
            this.currentCamLookAt.copy(centroid);
            this.camera.lookAt(centroid);
        }

        // 3. Surrounding survivors react in terror
        Object.entries(this.characters).forEach(([name, c]: [string, any]) => {
            if (!eliminatedNames.includes(name) && c && c.userData?.isAlive && !c.userData?.isFallen) {
                c.userData.isCustomArmAnim = true;
                gsap.to(c.position, {
                    y: 2.2,
                    duration: 0.22,
                    yoyo: true,
                    repeat: 1,
                    ease: "power1.out"
                });
                if (c.userData.parts?.armL) {
                    gsap.to(c.userData.parts.armL.rotation, { x: -Math.PI * 0.8, z: 0.35, duration: 0.25 });
                }
                if (c.userData.parts?.armR) {
                    gsap.to(c.userData.parts.armR.rotation, { x: -Math.PI * 0.8, z: -0.35, duration: 0.25 });
                }
            }
        });

        // 4. Victims perform multi-stage dramatic elimination
        victimChars.forEach((char: any) => {
            char.userData.isAlive = false;
            char.userData.isMoving = false;
            char.userData.isCustomArmAnim = true;

            const worldPos = new THREE.Vector3();
            char.getWorldPosition(worldPos);

            // Ground FX
            this.createEliminationShockwave(worldPos);
            this.createSmokePuffs(worldPos);

            const parts = char.userData.parts;
            // Phase 1: Comic jump & hands on head in horror
            if (parts?.armL) gsap.to(parts.armL.rotation, { x: -Math.PI * 0.9, z: 0.3, duration: 0.3 });
            if (parts?.armR) gsap.to(parts.armR.rotation, { x: -Math.PI * 0.9, z: -0.3, duration: 0.3 });
            if (parts?.head) gsap.to(parts.head.rotation, { x: -0.4, duration: 0.3 });

            gsap.to(char.position, {
                y: 2.6,
                duration: 0.35,
                ease: "power2.out",
                onComplete: () => {
                    // Phase 2: Comic spin and collapse onto turf
                    gsap.to(char.rotation, {
                        x: Math.PI / 2,
                        y: char.rotation.y + Math.PI * 2.5,
                        z: 0.3,
                        duration: 0.5,
                        ease: "bounce.out"
                    });
                    gsap.to(char.position, {
                        y: 0.32,
                        duration: 0.5,
                        ease: "bounce.out",
                        onComplete: () => {
                            // Phase 3: Dizzy stars & ghost hamster
                            this.createDizzyStars(char);
                            this.createGhostHamster(worldPos);
                        }
                    });
                }
            });

            // Turn character materials to muted grey
            char.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map((mat: any) => {
                            const m = mat.clone();
                            if (m.color) m.color.setHex(0x555555);
                            return m;
                        });
                    } else if (child.material.color) {
                        child.material = child.material.clone();
                        child.material.color.setHex(0x555555);
                    }
                }
            });
        });

        // 5. Notify React UI of elimination with pattern
        this.onStateChange({
            phase: 'ELIMINATED',
            eliminatedThisRound: eliminatedNames,
            eliminationPattern: pattern,
            isMusicPlaying: false
        });

        // Hold dramatic sequence for 2.6 seconds so player can enjoy it
        await new Promise(r => setTimeout(r, 2600));

        // Restore survivors' arms
        Object.entries(this.characters).forEach(([name, c]: [string, any]) => {
            if (!eliminatedNames.includes(name) && c && c.userData?.isAlive) {
                c.userData.isCustomArmAnim = false;
                if (c.userData.parts?.armL) gsap.to(c.userData.parts.armL.rotation, { x: 0, z: 0, duration: 0.4 });
                if (c.userData.parts?.armR) gsap.to(c.userData.parts.armR.rotation, { x: 0, z: 0, duration: 0.4 });
            }
        });

        // Restore camera
        if (this.camera) {
            gsap.to(this.camera.position, {
                x: 0,
                y: Math.max(20, this.currentDoorRadius * 1.2),
                z: Math.max(35, this.currentDoorRadius * 1.8),
                duration: 1.2,
                ease: "power2.out"
            });
            this.currentCamLookAt.set(0, 0, 0);
        }
    }

    updateStandbyMovement(time: number) {
        const delta = 0.016;

        Object.values(this.characters).forEach((char: any) => {
            if (!char || !char.userData || !char.userData.isAlive || char.userData.isFallen) return;

            char.userData.standbyTimer = (char.userData.standbyTimer || 3.0) - delta;

            const homePos = char.userData.homePos || char.position.clone();
            if (!char.userData.homePos) {
                char.userData.homePos = homePos.clone();
            }

            // Sentry patrol for Squid Guard or IT in Tag mode
            if (char.userData.name === '__GUARD__' || (this.gameType === 'tag' && char.userData.name === this.itPlayerName)) {
                if (char.userData.standbyTimer <= 0) {
                    char.userData.standbyTimer = 3.0 + Math.random() * 2.0;
                    const patrolX = (char.position.x > 0 ? -1 : 1) * (4 + Math.random() * 5);
                    char.userData.standbyTarget = new THREE.Vector3(patrolX, 1, 17);
                    char.userData.isStandbyMoving = true;
                }

                if (char.userData.isStandbyMoving && char.userData.standbyTarget) {
                    const dx = char.userData.standbyTarget.x - char.position.x;
                    if (Math.abs(dx) > 0.2) {
                        const step = Math.sign(dx) * 0.04;
                        char.position.x += step;
                        char.lookAt(char.userData.standbyTarget.x, 1, char.position.z);
                        if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.x = Math.sin(time * 7) * 0.45;
                        if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.x = -Math.sin(time * 7) * 0.45;
                    } else {
                        char.userData.isStandbyMoving = false;
                        char.lookAt(0, 1, -10);
                        if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.x = 0;
                        if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.x = 0;
                    }
                }
                return;
            }

            // General Player Contestant Standby Logic
            if (char.userData.standbyTimer <= 0) {
                const rand = Math.random();
                if (rand < 0.45) {
                    // Wander/pace within radius 1.8 of homePos
                    const angle = Math.random() * Math.PI * 2;
                    const r = 0.8 + Math.random() * 1.5;
                    let targetX = homePos.x + Math.cos(angle) * r;
                    let targetZ = homePos.z + Math.sin(angle) * r;
                    
                    const distFromCenter = Math.sqrt(targetX * targetX + targetZ * targetZ);
                    if (distFromCenter > 22.0) {
                        targetX = homePos.x;
                        targetZ = homePos.z;
                    }
                    char.userData.standbyTarget = new THREE.Vector3(targetX, 1, targetZ);
                    char.userData.isStandbyMoving = true;
                    char.userData.standbyAction = 'walk';
                    char.userData.standbyTimer = 2.5 + Math.random() * 2.5;
                } else if (rand < 0.65) {
                    char.userData.isStandbyMoving = false;
                    char.userData.standbyAction = 'wave';
                    char.userData.standbyTimer = 2.0 + Math.random() * 1.5;
                    char.lookAt(0, 1, 10);
                } else if (rand < 0.85) {
                    char.userData.isStandbyMoving = false;
                    char.userData.standbyAction = 'warmup';
                    char.userData.standbyTimer = 2.2 + Math.random() * 2.0;
                } else {
                    char.userData.isStandbyMoving = false;
                    char.userData.standbyAction = 'lookAround';
                    char.userData.standbyTimer = 2.0 + Math.random() * 2.0;
                }
            }

            // Execute current action
            if (char.userData.isStandbyMoving && char.userData.standbyTarget) {
                const toTarget = new THREE.Vector3().subVectors(char.userData.standbyTarget, char.position);
                toTarget.y = 0;
                const dist = toTarget.length();
                if (dist > 0.15) {
                    toTarget.normalize();
                    const walkSpeed = char.userData.standbySpeed || 0.032;
                    char.position.x += toTarget.x * walkSpeed;
                    char.position.z += toTarget.z * walkSpeed;
                    char.position.y = 1.0 + Math.abs(Math.sin(time * 7 + char.userData.moveTime)) * 0.08;

                    char.lookAt(char.userData.standbyTarget.x, 1, char.userData.standbyTarget.z);

                    if (char.userData.parts?.legLGroup) {
                        char.userData.parts.legLGroup.rotation.x = Math.sin(time * 7 + char.userData.moveTime) * 0.45;
                    }
                    if (char.userData.parts?.legRGroup) {
                        char.userData.parts.legRGroup.rotation.x = Math.sin(time * 7 + char.userData.moveTime + Math.PI) * 0.45;
                    }
                    if (!char.userData.isCustomArmAnim && char.userData.parts?.armL && char.userData.parts?.armR) {
                        char.userData.parts.armL.rotation.x = Math.sin(time * 7 + char.userData.moveTime + Math.PI) * 0.35;
                        char.userData.parts.armR.rotation.x = Math.sin(time * 7 + char.userData.moveTime) * 0.35;
                    }
                } else {
                    char.userData.isStandbyMoving = false;
                    char.userData.standbyAction = 'idle';
                    char.userData.standbyTimer = 1.5 + Math.random() * 2.0;
                    char.lookAt(0, 1, 0);
                    if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.x = 0;
                    if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.x = 0;
                }
            } else {
                if (char.userData.parts?.torso) {
                    char.userData.parts.torso.scale.y = 1 + Math.sin(time * 2.5 + char.userData.moveTime) * 0.02;
                }

                if (char.userData.standbyAction === 'wave') {
                    if (char.userData.parts?.armR) {
                        char.userData.parts.armR.rotation.x = -Math.PI * 0.82;
                        char.userData.parts.armR.rotation.z = 0.2 + Math.sin(time * 12) * 0.35;
                    }
                    if (char.userData.parts?.head) {
                        char.userData.parts.head.rotation.z = -0.15;
                    }
                    char.position.y = 1.0 + Math.abs(Math.sin(time * 5)) * 0.04;
                } else if (char.userData.standbyAction === 'warmup') {
                    char.position.y = 1.0 + Math.abs(Math.sin(time * 8 + char.userData.moveTime)) * 0.18;
                    if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.x = Math.sin(time * 8) * 0.25;
                    if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.x = -Math.sin(time * 8) * 0.25;
                    if (char.userData.parts?.armL) char.userData.parts.armL.rotation.x = Math.sin(time * 8) * 0.3;
                    if (char.userData.parts?.armR) char.userData.parts.armR.rotation.x = -Math.sin(time * 8) * 0.3;
                } else if (char.userData.standbyAction === 'lookAround') {
                    if (char.userData.parts?.head) {
                        char.userData.parts.head.rotation.y = Math.sin(time * 1.5 + char.userData.moveTime) * 0.55;
                        char.userData.parts.head.rotation.x = Math.sin(time * 2.0 + char.userData.moveTime) * 0.1;
                    }
                    char.rotation.z = Math.sin(time * 2.0 + char.userData.moveTime) * 0.04;
                    if (char.userData.parts?.armL) char.userData.parts.armL.rotation.set(0, 0, 0);
                    if (char.userData.parts?.armR) char.userData.parts.armR.rotation.set(0, 0, 0);
                } else {
                    char.rotation.z = Math.sin(time * 1.8 + char.userData.moveTime) * 0.03;
                    if (char.userData.parts?.legLGroup) char.userData.parts.legLGroup.rotation.x = 0;
                    if (char.userData.parts?.legRGroup) char.userData.parts.legRGroup.rotation.x = 0;
                    if (char.userData.parts?.armL) char.userData.parts.armL.rotation.x = Math.sin(time * 2 + char.userData.moveTime) * 0.08;
                    if (char.userData.parts?.armR) char.userData.parts.armR.rotation.x = -Math.sin(time * 2 + char.userData.moveTime) * 0.08;
                    if (char.userData.parts?.head) char.userData.parts.head.rotation.set(0, 0, 0);
                    char.position.y = 1.0;
                }
            }
        });
    }

    constructor(containerId: string) {
        this.containerId = containerId;
    }

    init(onStateChangeCallback: any) {
        this.onStateChange = onStateChangeCallback;
        const container = document.getElementById(this.containerId);
        if(!container) return;
        
        this.labelContainer = document.createElement('div');
        this.labelContainer.style.position = 'absolute';
        this.labelContainer.style.top = '0';
        this.labelContainer.style.left = '0';
        this.labelContainer.style.width = '100%';
        this.labelContainer.style.height = '100%';
        this.labelContainer.style.pointerEvents = 'none';
        container.appendChild(this.labelContainer);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#87CEEB'); 
        this.scene.fog = new THREE.FogExp2('#87CEEB', 0.015);

        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || Math.round(window.innerHeight * 0.85);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, Math.max(20, this.currentDoorRadius * 1.2), Math.max(35, this.currentDoorRadius * 1.8));
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupEnvironment();
        this.setupInteraction();

        window.addEventListener('resize', this.onWindowResize.bind(this));
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.onWindowResize();
            });
            this.resizeObserver.observe(container);
        }
        
        this.animate = this.animate.bind(this);
        this.isAnimating = true;
        requestAnimationFrame(this.animate);
    }

    setupLights() {
        if(!this.scene) return;
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, this.baseLightIntensity);
        this.dirLight.position.set(20, 40, 20);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 150;
        this.scene.add(this.dirLight);
        
        this.spotLight = new THREE.SpotLight(0xffaa00, 0); 
        this.spotLight.position.set(0, 30, 0);
        this.spotLight.angle = Math.PI / 6;
        this.spotLight.penumbra = 0.5;
        this.scene.add(this.spotLight);

        this.alarmLight = new THREE.PointLight(0xff0000, 0, 100);
        this.alarmLight.position.set(0, 15, 0);
        this.scene.add(this.alarmLight);
    }

    createPlaygroundEnvironment(): THREE.Group {
        const group = new THREE.Group();

        // 1. Lush Park Grass Ground - Expansive cylinder spanning radius 240
        const grassGeo = new THREE.CylinderGeometry(240, 240, 2.5, 64);
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.85 }); // vibrant playground grass
        const grass = new THREE.Mesh(grassGeo, grassMat);
        grass.position.y = -1.25;
        grass.receiveShadow = true;
        group.add(grass);

        // Surrounding darker park meadow ring (radius 26.5 to 235)
        const outerFieldGeo = new THREE.RingGeometry(26.5, 235, 64);
        const outerFieldMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
        const outerField = new THREE.Mesh(outerFieldGeo, outerFieldMat);
        outerField.rotation.x = -Math.PI / 2;
        outerField.position.y = 0.01;
        outerField.receiveShadow = true;
        group.add(outerField);

        // 2. Large Circular Play Area Boundary Ring (radius 26, wide chalk line)
        const boundaryGeo = new THREE.RingGeometry(25.3, 26.0, 96);
        const boundaryMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
        boundary.rotation.x = -Math.PI / 2;
        boundary.position.y = 0.02;
        group.add(boundary);

        // Inner decorative circle (radius 13) with dashed-like appearance or soft tint
        const innerRingGeo = new THREE.RingGeometry(12.8, 13.2, 64);
        const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, opacity: 0.6, transparent: true });
        const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
        innerRing.rotation.x = -Math.PI / 2;
        innerRing.position.y = 0.02;
        group.add(innerRing);

        // Center park logo / star emblem
        const centerCircleGeo = new THREE.CircleGeometry(2, 32);
        const centerCircleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
        const centerCircle = new THREE.Mesh(centerCircleGeo, centerCircleMat);
        centerCircle.rotation.x = -Math.PI / 2;
        centerCircle.position.y = 0.025;
        group.add(centerCircle);

        // 3. Boundary Cones along the edge (Radius 27.2)
        const numCones = 16;
        for (let i = 0; i < numCones; i++) {
            const angle = (Math.PI * 2 / numCones) * i;
            const cx = Math.cos(angle) * 27.2;
            const cz = Math.sin(angle) * 27.2;

            const coneGroup = new THREE.Group();
            const coneBase = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.1, 1.2),
                new THREE.MeshStandardMaterial({ color: 0xf97316 })
            );
            coneBase.position.y = 0.05;
            coneGroup.add(coneBase);

            const coneBody = new THREE.Mesh(
                new THREE.ConeGeometry(0.5, 1.4, 16),
                new THREE.MeshStandardMaterial({ color: 0xf97316 })
            );
            coneBody.position.y = 0.75;
            coneGroup.add(coneBody);

            const stripe = new THREE.Mesh(
                new THREE.CylinderGeometry(0.3, 0.38, 0.3, 16),
                new THREE.MeshBasicMaterial({ color: 0xffffff })
            );
            stripe.position.y = 0.7;
            coneGroup.add(stripe);

            coneGroup.position.set(cx, 0, cz);
            group.add(coneGroup);
        }

        // 4. Stylized Park Trees in the background and perimeter
        const treeLocations = [
            // Inner perimeter trees
            { x: -33, z: -15, scale: 1.2 },
            { x: -28, z: -30, scale: 1.4 },
            { x: -10, z: -38, scale: 1.5 },
            { x: 12, z: -37, scale: 1.3 },
            { x: 30, z: -28, scale: 1.4 },
            { x: 36, z: -12, scale: 1.2 },
            { x: -38, z: 12, scale: 1.3 },
            { x: -32, z: 28, scale: 1.1 },
            { x: 33, z: 26, scale: 1.2 },
            { x: 39, z: 10, scale: 1.4 },
            { x: 22, z: 38, scale: 1.3 },
            { x: -20, z: 38, scale: 1.2 },
            // Outer forest / depth trees for full rich park horizon
            { x: -55, z: -40, scale: 1.8 },
            { x: -45, z: -60, scale: 2.0 },
            { x: 0, z: -65, scale: 2.2 },
            { x: 42, z: -55, scale: 1.9 },
            { x: 60, z: -35, scale: 1.7 },
            { x: 65, z: 15, scale: 1.8 },
            { x: 50, z: 50, scale: 2.0 },
            { x: -50, z: 50, scale: 1.8 },
            { x: -65, z: 0, scale: 2.1 },
        ];

        treeLocations.forEach(loc => {
            const tree = new THREE.Group();
            // Trunk
            const trunkGeo = new THREE.CylinderGeometry(0.5 * loc.scale, 0.7 * loc.scale, 3.5 * loc.scale, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.75 * loc.scale;
            trunk.castShadow = true;
            tree.add(trunk);

            // 3-tiered foliage
            const greens = [0x15803d, 0x16a34a, 0x22c55e];
            for (let t = 0; t < 3; t++) {
                const foliageGeo = new THREE.ConeGeometry((2.6 - t * 0.5) * loc.scale, 2.5 * loc.scale, 8);
                const foliageMat = new THREE.MeshStandardMaterial({ color: greens[t], roughness: 0.8 });
                const foliage = new THREE.Mesh(foliageGeo, foliageMat);
                foliage.position.y = (3.2 + t * 1.6) * loc.scale;
                foliage.castShadow = true;
                tree.add(foliage);
            }

            tree.position.set(loc.x, 0, loc.z);
            group.add(tree);
        });

        // 5. Park Benches (Placed at edge for park feel)
        const benchAngles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];
        benchAngles.forEach(ang => {
            const bx = Math.cos(ang) * 31;
            const bz = Math.sin(ang) * 31;
            const bench = new THREE.Group();

            // Seat
            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(4, 0.2, 1.2),
                new THREE.MeshStandardMaterial({ color: 0x92400e })
            );
            seat.position.y = 0.9;
            bench.add(seat);

            // Backrest
            const back = new THREE.Mesh(
                new THREE.BoxGeometry(4, 1.0, 0.2),
                new THREE.MeshStandardMaterial({ color: 0x92400e })
            );
            back.position.set(0, 1.6, -0.5);
            bench.add(back);

            // Legs
            const legMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
            const legGeo = new THREE.BoxGeometry(0.2, 0.9, 1.2);
            const legL = new THREE.Mesh(legGeo, legMat);
            legL.position.set(-1.6, 0.45, 0);
            const legR = new THREE.Mesh(legGeo, legMat);
            legR.position.set(1.6, 0.45, 0);
            bench.add(legL);
            bench.add(legR);

            bench.position.set(bx, 0, bz);
            bench.lookAt(0, 0, 0);
            group.add(bench);
        });

        // 6. Playground Swing Set (positioned at x = -30, z = 0)
        const swingSet = new THREE.Group();
        const metalMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }); // bright blue
        const frameBarGeo = new THREE.CylinderGeometry(0.15, 0.15, 7, 12);
        
        // A-frame left
        const aL1 = new THREE.Mesh(frameBarGeo, metalMat);
        aL1.position.set(-3, 3, 1.2);
        aL1.rotation.x = 0.35;
        const aL2 = new THREE.Mesh(frameBarGeo, metalMat);
        aL2.position.set(-3, 3, -1.2);
        aL2.rotation.x = -0.35;
        swingSet.add(aL1);
        swingSet.add(aL2);

        // A-frame right
        const aR1 = new THREE.Mesh(frameBarGeo, metalMat);
        aR1.position.set(3, 3, 1.2);
        aR1.rotation.x = 0.35;
        const aR2 = new THREE.Mesh(frameBarGeo, metalMat);
        aR2.position.set(3, 3, -1.2);
        aR2.rotation.x = -0.35;
        swingSet.add(aR1);
        swingSet.add(aR2);

        // Top beam
        const topBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 7, 12), metalMat);
        topBeam.rotation.z = Math.PI / 2;
        topBeam.position.set(0, 5.8, 0);
        swingSet.add(topBeam);

        // Swings (2 seats)
        [-1.3, 1.3].forEach(sx => {
            const seat = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 0.15, 0.5),
                new THREE.MeshStandardMaterial({ color: 0xef4444 })
            );
            seat.position.set(sx, 1.2, 0);
            swingSet.add(seat);

            const chainMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
            const chainGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.5);
            const chainL = new THREE.Mesh(chainGeo, chainMat);
            chainL.position.set(sx - 0.5, 3.5, 0);
            const chainR = new THREE.Mesh(chainGeo, chainMat);
            chainR.position.set(sx + 0.5, 3.5, 0);
            swingSet.add(chainL);
            swingSet.add(chainR);
        });

        swingSet.position.set(-32, 0, 0);
        swingSet.lookAt(0, 0, 0);
        group.add(swingSet);

        // 7. Playground Slide (positioned at x = 32, z = 0)
        const slideGroup = new THREE.Group();
        const slideMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 }); // yellow slide
        const slideRamp = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 7), slideMat);
        slideRamp.position.set(0, 2.5, 1.5);
        slideRamp.rotation.x = -Math.PI / 5;
        slideGroup.add(slideRamp);

        // Platform & Ladder
        const platform = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), slideMat);
        platform.position.set(0, 4.5, -1.8);
        slideGroup.add(platform);

        const legSlideMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
        const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 4.6);
        [-0.8, 0.8].forEach(px => {
            [-2.6, -1.0].forEach(pz => {
                const post = new THREE.Mesh(postGeo, legSlideMat);
                post.position.set(px, 2.3, pz);
                slideGroup.add(post);
            });
        });

        slideGroup.position.set(32, 0, 0);
        slideGroup.lookAt(0, 0, 0);
        group.add(slideGroup);

        return group;
    }

    setupEnvironment() {
        if(!this.scene) return;

        // 1. Mingle Game Arena (Park meadow ground, outer park perimeter, center base, and animated guards)
        const mingleGroup = new THREE.Group();

        // Expansive park grass ground extending into horizon (radius 260)
        const parkGrassGeo = new THREE.CylinderGeometry(260, 260, 2, 64);
        const parkGrassMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.85 }); // vibrant lush park grass
        const parkGrass = new THREE.Mesh(parkGrassGeo, parkGrassMat);
        parkGrass.position.y = -1.5;
        parkGrass.receiveShadow = true;
        mingleGroup.add(parkGrass);

        // Surrounding darker park meadow ring (radius 30 to 240)
        const parkMeadowGeo = new THREE.RingGeometry(30, 240, 64);
        const parkMeadowMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9 });
        const parkMeadow = new THREE.Mesh(parkMeadowGeo, parkMeadowMat);
        parkMeadow.rotation.x = -Math.PI / 2;
        parkMeadow.position.y = -0.48;
        parkMeadow.receiveShadow = true;
        mingleGroup.add(parkMeadow);

        // Inner park paving border around the platform (radius 27 to 32)
        const outerFloorGeo = new THREE.RingGeometry(27.5, 33, 64);
        const outerFloorMat = new THREE.MeshStandardMaterial({ color: 0xebd5b3, roughness: 0.9 });
        const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
        outerFloor.rotation.x = -Math.PI / 2;
        outerFloor.position.y = -0.45; 
        outerFloor.receiveShadow = true;
        mingleGroup.add(outerFloor);
        
        // Raised center turntable foundation base (radius 27.5)
        const centerBaseGeo = new THREE.CylinderGeometry(27.5, 27.5, 0.9, 64);
        const centerBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
        const centerBase = new THREE.Mesh(centerBaseGeo, centerBaseMat);
        centerBase.position.y = -0.95;
        mingleGroup.add(centerBase);

        // Park Trees scattered naturally around the perimeter
        const parkTrees = [
            { x: -38, z: -20, scale: 1.4 },
            { x: -32, z: -38, scale: 1.6 },
            { x: -14, z: -44, scale: 1.5 },
            { x: 16, z: -42, scale: 1.5 },
            { x: 36, z: -32, scale: 1.6 },
            { x: 42, z: -14, scale: 1.4 },
            { x: -44, z: 14, scale: 1.5 },
            { x: -36, z: 34, scale: 1.3 },
            { x: 38, z: 32, scale: 1.4 },
            { x: 44, z: 12, scale: 1.5 },
            { x: 24, z: 44, scale: 1.5 },
            { x: -24, z: 44, scale: 1.4 },
            // Outer park forest horizon
            { x: -65, z: -45, scale: 2.1 },
            { x: 0, z: -70, scale: 2.4 },
            { x: 60, z: -55, scale: 2.2 },
            { x: 70, z: 15, scale: 2.3 },
            { x: -70, z: 15, scale: 2.2 },
            { x: 45, z: 60, scale: 2.2 },
            { x: -45, z: 60, scale: 2.2 },
        ];

        parkTrees.forEach(loc => {
            const tree = new THREE.Group();
            const trunkGeo = new THREE.CylinderGeometry(0.5 * loc.scale, 0.7 * loc.scale, 3.8 * loc.scale, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 1.9 * loc.scale;
            trunk.castShadow = true;
            tree.add(trunk);

            const foliageColors = [0x15803d, 0x16a34a, 0x22c55e];
            for (let t = 0; t < 3; t++) {
                const fGeo = new THREE.ConeGeometry((2.7 - t * 0.5) * loc.scale, 2.6 * loc.scale, 8);
                const fMat = new THREE.MeshStandardMaterial({ color: foliageColors[t], roughness: 0.8 });
                const f = new THREE.Mesh(fGeo, fMat);
                f.position.y = (3.4 + t * 1.6) * loc.scale;
                f.castShadow = true;
                tree.add(f);
            }
            tree.position.set(loc.x, 0, loc.z);
            mingleGroup.add(tree);
        });

        // Park Benches around the edge
        const benchAngles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];
        benchAngles.forEach(ang => {
            const bx = Math.cos(ang) * 36;
            const bz = Math.sin(ang) * 36;
            const bench = new THREE.Group();
            const seat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.2), new THREE.MeshStandardMaterial({ color: 0x92400e }));
            seat.position.y = 0.9;
            bench.add(seat);
            const back = new THREE.Mesh(new THREE.BoxGeometry(4, 1.0, 0.2), new THREE.MeshStandardMaterial({ color: 0x92400e }));
            back.position.set(0, 1.6, -0.5);
            bench.add(back);
            const legMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
            const legGeo = new THREE.BoxGeometry(0.2, 0.9, 1.2);
            const legL = new THREE.Mesh(legGeo, legMat);
            legL.position.set(-1.6, 0.45, 0);
            const legR = new THREE.Mesh(legGeo, legMat);
            legR.position.set(1.6, 0.45, 0);
            bench.add(legL, legR);
            bench.position.set(bx, 0, bz);
            bench.lookAt(0, 0, 0);
            mingleGroup.add(bench);
        });

        // Animated Squid Guards (Unarmed, patrolling & watching around the arena radius 34)
        this.guards = [];
        const numGuards = 12;
        for(let i=0; i<numGuards; i++) {
            const angle = (Math.PI * 2 / numGuards) * i;
            const radius = 34; 
            const shape = this.shapes[i % 3]; 
            const isLeader = (i === 0 || i === 6);
            const guard = this.createGuard(shape, angle, radius, isLeader);
            this.guards.push(guard);
            mingleGroup.add(guard);
        }

        this.scene.add(mingleGroup);
        this.mingleEnvGroup = mingleGroup;

        // 2. Mingle Inner Rotating Platform - EXPANDED BIGGER (Radius 27 instead of 18)
        const innerPlatformGroup = new THREE.Group();
        const innerFloorGeo = new THREE.CylinderGeometry(27, 27, 1, 64);
        const innerFloorMat = new THREE.MeshStandardMaterial({ color: 0xebd5b3, roughness: 0.9 });
        const innerFloor = new THREE.Mesh(innerFloorGeo, innerFloorMat);
        innerFloor.position.y = -0.5;
        innerFloor.receiveShadow = true;
        innerPlatformGroup.add(innerFloor);

        // Prominent glowing white perimeter boundary ring
        const ringGeo = new THREE.RingGeometry(26.2, 27, 96);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        innerPlatformGroup.add(ring);

        // Decorative inner dashed ring for stylish game area
        const dashRingGeo = new THREE.RingGeometry(17.8, 18.2, 64);
        const dashRingMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, opacity: 0.5, transparent: true });
        const dashRing = new THREE.Mesh(dashRingGeo, dashRingMat);
        dashRing.rotation.x = -Math.PI / 2;
        dashRing.position.y = 0.025;
        innerPlatformGroup.add(dashRing);
        
        this.scene.add(innerPlatformGroup);
        this.innerPlatform = innerPlatformGroup;

        // 3. Tag Playground Environment (Grass, playground, trees, benches, cones)
        const tagGroup = this.createPlaygroundEnvironment();
        this.scene.add(tagGroup);
        this.tagEnvGroup = tagGroup;

        // Set initial visibility based on gameType
        if (this.gameType === 'tag') {
            this.mingleEnvGroup.visible = false;
            this.innerPlatform.visible = false;
            this.tagEnvGroup.visible = true;
        } else {
            this.mingleEnvGroup.visible = true;
            this.innerPlatform.visible = true;
            this.tagEnvGroup.visible = false;
        }
    }

    updateCameraFraming(immediate = false) {
        if (!this.camera) return;
        const container = document.getElementById(this.containerId);
        const width = container?.clientWidth || window.innerWidth;
        const height = container?.clientHeight || Math.round(window.innerHeight * 0.85);
        const aspect = width / Math.max(1, height);

        if (this.gameType === 'tag') {
            // Precise camera matching the user's reference view:
            // Centered overview looking down into the ring, perfectly showing the whole playground
            const aspectScale = aspect < 1.65 ? 1.65 / Math.max(0.65, aspect) : 1.0;
            const targetX = 0;
            const targetY = 40 * aspectScale;
            const targetZ = 48 * aspectScale;
            const lookTarget = new THREE.Vector3(0, 0, 1.5);

            this.tagCamTargetPos = new THREE.Vector3(targetX, targetY, targetZ);
            this.tagCamTargetLook = lookTarget.clone();

            gsap.killTweensOf(this.camera.position);

            if (immediate) {
                this.camera.position.set(targetX, targetY, targetZ);
                this.currentCamLookAt.copy(lookTarget);
                this.camera.lookAt(lookTarget);
            }
        } else {
            const targetY = Math.max(20, this.currentDoorRadius * 1.2);
            const targetZ = Math.max(35, this.currentDoorRadius * 1.8);
            const lookTarget = new THREE.Vector3(0, 0, 0);

            if (immediate) {
                this.camera.position.set(0, targetY, targetZ);
                this.camera.lookAt(lookTarget);
            } else {
                gsap.killTweensOf(this.camera.position);
                gsap.to(this.camera.position, {
                    x: 0,
                    y: targetY,
                    z: targetZ,
                    duration: 1.0,
                    ease: "power2.out",
                    onUpdate: () => {
                        this.camera?.lookAt(lookTarget);
                    },
                    onComplete: () => {
                        this.camera?.lookAt(lookTarget);
                    }
                });
            }
        }
    }

    setGameType(type: 'mingle' | 'tag') {
        this.gameType = type;
        if (type === 'mingle') {
            this.tagRoundCount = 0;
            this.lastCaughtPlayer = null;
            this.mingleSpinCount = 0;
        }
        if (this.mingleEnvGroup) this.mingleEnvGroup.visible = (type === 'mingle');
        if (this.tagEnvGroup) this.tagEnvGroup.visible = (type === 'tag');
        if (this.innerPlatform) this.innerPlatform.visible = (type === 'mingle');

        if (type === 'tag') {
            // Remove any doors in tag mode
            this.doors.forEach(d => {
                if (d.group && d.group.parent) d.group.parent.remove(d.group);
            });
            this.doors = [];

            if (this.scene) {
                this.scene.background = new THREE.Color('#38bdf8'); // bright sunny sky
                this.scene.fog = new THREE.FogExp2('#38bdf8', 0.005);
            }
            if (this.dirLight) {
                this.dirLight.intensity = 1.15;
            }
            if (this.ambientLight) {
                this.ambientLight.intensity = 0.85;
            }
            this.updateCameraFraming(false);
        } else {
            if (this.scene) {
                this.scene.background = new THREE.Color('#87CEEB');
                this.scene.fog = new THREE.FogExp2('#87CEEB', 0.015);
            }
            if (this.dirLight) {
                this.dirLight.intensity = this.baseLightIntensity;
            }
            if (this.ambientLight) {
                this.ambientLight.intensity = 0.7;
            }
            this.updateCameraFraming(false);
        }
    }

    setupInteraction() {
        const container = document.getElementById(this.containerId);
        if(!container) return;

        this.clickHandler = (event: MouseEvent) => {
            if (!this.camera) return;
            if (this.gameType === 'tag') {
                if (this.waitingForTagStartResolve) {
                    this.startTagChase();
                }
                return;
            }

            if (!this.innerPlatform) return;
            const rect = container.getBoundingClientRect();
            this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.innerPlatform, true);
            
            if (intersects.length > 0 || this.waitingForSpinResolve) {
                this.manualSpin();
            }
        };

        container.addEventListener('click', this.clickHandler);
    }

    startTagChase() {
        this.stopStandbyMode();
        if (this.waitingForTagStartResolve) {
            const resolve = this.waitingForTagStartResolve;
            this.waitingForTagStartResolve = null;
            if (globalAudio) globalAudio.resume();
            this.onStateChange({ phase: 'DOORS', msg: '', isMusicPlaying: true });
            resolve();
        }
    }

    manualSpin() {
        if (this.gameType === 'tag') {
            this.startTagChase();
            return;
        }

        if (!this.innerPlatform) return;
        this.stopStandbyMode();
        if (globalAudio) globalAudio.resume();
        this.onStateChange({ phase: 'SPINNING', msg: 'SPINNING...', isMusicPlaying: true });
        
        if (!this.spinTarget || isNaN(this.spinTarget)) {
            this.spinTarget = this.innerPlatform.rotation.y;
        }
        
        const isFirstSpin = (this.mingleSpinCount === 0);
        this.mingleSpinCount++;

        // Randomize the spin rotations and final angle offset so the platform never stops at the same pattern!
        const randomExtraAngle = (Math.PI * 2) * (0.05 + Math.random() * 0.9);
        const randomRotations = isFirstSpin ? (6 + Math.floor(Math.random() * 6)) : (2 + Math.floor(Math.random() * 3));
        const spinDuration = isFirstSpin ? (8.0 + Math.random() * 3.5) : (2.5 + Math.random() * 1.5);
        const spinRadianAddition = (Math.PI * 2 * randomRotations) + randomExtraAngle;

        this.spinTarget += spinRadianAddition; 
        
        const ytPlayer = document.getElementById('yt-player') as HTMLIFrameElement;
        if (ytPlayer && ytPlayer.contentWindow) {
             ytPlayer.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
        }
        
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }
        
        gsap.to(this.innerPlatform.rotation, {
            y: this.spinTarget,
            duration: spinDuration,
            ease: isFirstSpin ? "power2.inOut" : "power3.out",
            overwrite: true,
            onComplete: () => {
                if (this.waitingForSpinResolve) {
                    this.spinTimeout = setTimeout(() => {
                        if (this.waitingForSpinResolve) {
                            this.waitingForSpinResolve();
                            this.waitingForSpinResolve = null;
                        }
                    }, 800);
                }
            }
        });
    }

    createFaceTexture(name: string, numberStr: string, skinPalette: any, hairPalette: any, rng: SeededRNG) {
        const cacheKey = `${name}_face`;
        if (this.faceTextures[cacheKey]) return this.faceTextures[cacheKey];

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base skin background
        ctx.fillStyle = skinPalette.skin;
        ctx.fillRect(0, 0, 512, 512);

        // Subtle skin tone gradient/lighting
        const grad = ctx.createRadialGradient(256, 230, 40, 256, 256, 280);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);

        // Rosy cheeks / blush (optional or subtle)
        if (rng.chance(0.65)) {
            ctx.fillStyle = skinPalette.blush;
            ctx.beginPath();
            ctx.ellipse(140, 290, 45, 22, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(372, 290, 45, 22, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Freckles (chance 25%)
        if (rng.chance(0.25)) {
            ctx.fillStyle = skinPalette.shadow;
            for (let i = 0; i < 14; i++) {
                const fx = rng.range(120, 392);
                const fy = rng.range(270, 320);
                const fr = rng.range(1.5, 3.5);
                ctx.beginPath();
                ctx.arc(fx, fy, fr, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Eye Archetypes: 0 = determined/sharp, 1 = round/curious, 2 = tired/stressed, 3 = cheerful
        const eyeStyle = rng.int(0, 3);
        const irisColor = rng.choice(['#261914', '#1c1917', '#3b2f2f', '#1e293b', '#2e1065', '#164e63']);
        const eyeY = 220;
        const eyeLX = 150;
        const eyeRX = 362;
        const eyeW = 46;
        const eyeH = eyeStyle === 1 ? 40 : (eyeStyle === 2 ? 26 : 32);

        // Eye Sclera (whites of eyes)
        ctx.fillStyle = '#f8fafc';
        [eyeLX, eyeRX].forEach(cx => {
            ctx.beginPath();
            ctx.ellipse(cx, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 4;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.stroke();
        });

        // Iris
        [eyeLX, eyeRX].forEach((cx) => {
            const lookOffset = (rng.next() - 0.5) * 6;
            ctx.fillStyle = irisColor;
            ctx.beginPath();
            ctx.arc(cx + lookOffset, eyeY + (eyeStyle === 2 ? 3 : 0), 22, 0, Math.PI * 2);
            ctx.fill();

            // Pupil
            ctx.fillStyle = '#09090b';
            ctx.beginPath();
            ctx.arc(cx + lookOffset, eyeY + (eyeStyle === 2 ? 3 : 0), 12, 0, Math.PI * 2);
            ctx.fill();

            // Eye reflection glint
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(cx + lookOffset - 6, eyeY - 6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx + lookOffset + 7, eyeY + 6, 3, 0, Math.PI * 2);
            ctx.fill();
        });

        // Eyebrows: 0 = determined/sharp, 1 = arched/raised, 2 = worried/slanted, 3 = thick bushy
        const browStyle = rng.int(0, 3);
        const browColor = hairPalette.hex || '#18181b';
        ctx.strokeStyle = browColor;
        ctx.fillStyle = browColor;
        ctx.lineCap = 'round';

        const browY = eyeY - 50;
        if (browStyle === 0) {
            ctx.lineWidth = 14;
            ctx.beginPath();
            ctx.moveTo(100, browY + 12);
            ctx.lineTo(200, browY - 6);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(412, browY + 12);
            ctx.lineTo(312, browY - 6);
            ctx.stroke();
        } else if (browStyle === 1) {
            ctx.lineWidth = 11;
            ctx.beginPath();
            ctx.quadraticCurveTo(150, browY - 18, 200, browY);
            ctx.stroke();

            ctx.beginPath();
            ctx.quadraticCurveTo(362, browY - 18, 312, browY);
            ctx.stroke();
        } else if (browStyle === 2) {
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(100, browY - 10);
            ctx.lineTo(200, browY + 8);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(412, browY - 10);
            ctx.lineTo(312, browY + 8);
            ctx.stroke();
        } else {
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.moveTo(100, browY);
            ctx.lineTo(205, browY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(412, browY);
            ctx.lineTo(307, browY);
            ctx.stroke();
        }

        // Under-eye bags for stressed players (chance 40%)
        if (eyeStyle === 2 || rng.chance(0.4)) {
            ctx.strokeStyle = skinPalette.shadow;
            ctx.lineWidth = 4;
            [eyeLX, eyeRX].forEach(cx => {
                ctx.beginPath();
                ctx.arc(cx, eyeY + 28, 28, 0.1 * Math.PI, 0.9 * Math.PI);
                ctx.stroke();
            });
        }

        // Facial Hair / Beard / Moustache / Stubble (chance 35%)
        if (rng.chance(0.35)) {
            const facialType = rng.int(0, 3);
            ctx.fillStyle = hairPalette.hex || '#18181b';
            ctx.strokeStyle = hairPalette.hex || '#18181b';
            if (facialType === 0) {
                // Classic moustache
                ctx.beginPath();
                ctx.ellipse(215, 360, 35, 14, 0.15, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.ellipse(297, 360, 35, 14, -0.15, 0, Math.PI * 2);
                ctx.fill();
            } else if (facialType === 1) {
                // Chin goatee
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(226, 420, 60, 45, 10);
                    ctx.fill();
                } else {
                    ctx.fillRect(226, 420, 60, 45);
                }
            } else if (facialType === 2) {
                // 5 o'clock stubble shade
                ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
                ctx.beginPath();
                ctx.ellipse(256, 395, 120, 75, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Soul patch
                ctx.beginPath();
                ctx.ellipse(256, 415, 16, 12, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Mouth Expressions: 0 = smirk, 1 = grit with teeth, 2 = tense line, 3 = gentle smile
        const mouthStyle = rng.int(0, 3);
        const mouthY = 385;
        ctx.lineCap = 'round';

        if (mouthStyle === 0) {
            ctx.strokeStyle = skinPalette.lip;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(190, mouthY + 5);
            ctx.quadraticCurveTo(256, mouthY + 18, 325, mouthY - 8);
            ctx.stroke();
        } else if (mouthStyle === 1) {
            ctx.fillStyle = '#450a0a';
            ctx.beginPath();
            ctx.ellipse(256, mouthY, 50, 24, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(226, mouthY - 12, 60, 12);
            ctx.strokeStyle = skinPalette.lip;
            ctx.lineWidth = 6;
            ctx.stroke();
        } else if (mouthStyle === 2) {
            ctx.strokeStyle = skinPalette.lip;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(195, mouthY);
            ctx.lineTo(317, mouthY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(195, mouthY);
            ctx.lineTo(185, mouthY + 8);
            ctx.moveTo(317, mouthY);
            ctx.lineTo(327, mouthY + 8);
            ctx.stroke();
        } else {
            ctx.strokeStyle = skinPalette.lip;
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(190, mouthY - 4);
            ctx.quadraticCurveTo(256, mouthY + 20, 322, mouthY - 4);
            ctx.stroke();
        }

        // Scars, bandages, or beauty marks (chance 30%)
        if (rng.chance(0.3)) {
            const markType = rng.int(0, 2);
            if (markType === 0) {
                // Battle scar across left cheek
                ctx.strokeStyle = 'rgba(185, 28, 28, 0.45)';
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.moveTo(125, 150);
                ctx.lineTo(155, 275);
                ctx.stroke();
            } else if (markType === 1) {
                // Adhesive cheek bandage
                ctx.fillStyle = '#fde68a';
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2;
                ctx.save();
                ctx.translate(365, 310);
                ctx.rotate(-0.2);
                ctx.fillRect(-28, -12, 56, 24);
                ctx.strokeRect(-28, -12, 56, 24);
                ctx.fillStyle = '#fef3c7';
                ctx.fillRect(-12, -8, 24, 16);
                ctx.restore();
            } else {
                // Beauty mark / mole
                ctx.fillStyle = '#3f1c10';
                ctx.beginPath();
                ctx.arc(330, 345, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        this.faceTextures[cacheKey] = tex;
        return tex;
    }

    createFrontTorsoTexture(numberStr: string) {
        const playerNum = numberStr;
        const cacheKey = `${playerNum}_front`;
        if (this.uniformTextures[cacheKey]) return this.uniformTextures[cacheKey];

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base green tracksuit fabric
        ctx.fillStyle = '#1b4d3e';
        ctx.fillRect(0, 0, 512, 512);

        // White racing shoulder stripes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(50, 0, 36, 512);
        ctx.fillRect(426, 0, 36, 512);

        // White zipper down the middle
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(250, 0, 12, 512);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(244, 90, 24, 34);

        // Left chest number patch (White badge with bold green number on the jacket)
        ctx.fillStyle = '#f8fafc';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(100, 100, 130, 85, 14);
            ctx.fill();
            ctx.strokeStyle = '#0f2921';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else {
            ctx.fillRect(100, 100, 130, 85);
            ctx.strokeStyle = '#0f2921';
            ctx.lineWidth = 4;
            ctx.strokeRect(100, 100, 130, 85);
        }

        ctx.fillStyle = '#0f382c';
        const fontSize = playerNum.length > 3 ? 42 : playerNum.length === 3 ? 50 : 58;
        ctx.font = `900 ${fontSize}px "Arial Black", Impact, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(playerNum, 165, 143);

        // Bottom elastic hem band
        ctx.fillStyle = '#153e32';
        ctx.fillRect(0, 480, 512, 32);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 8;
        this.uniformTextures[cacheKey] = tex;
        return tex;
    }

    createBackTorsoTexture(numberStr: string) {
        const playerNum = numberStr;
        const cacheKey = `${playerNum}_back`;
        if (this.uniformTextures[cacheKey]) return this.uniformTextures[cacheKey];

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base green tracksuit
        ctx.fillStyle = '#1b4d3e';
        ctx.fillRect(0, 0, 512, 512);

        // White racing shoulder stripes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(50, 0, 36, 512);
        ctx.fillRect(426, 0, 36, 512);

        // Center spine seam
        ctx.fillStyle = '#153e32';
        ctx.fillRect(252, 0, 8, 512);

        // Big bold printed participant number on back of jacket
        ctx.fillStyle = '#ffffff';
        const backFontSize = playerNum.length > 3 ? 125 : playerNum.length === 3 ? 148 : 170;
        ctx.font = `900 ${backFontSize}px "Arial Black", Impact, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(playerNum, 256, 225);

        // Bottom elastic hem band
        ctx.fillStyle = '#153e32';
        ctx.fillRect(0, 480, 512, 32);

        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 8;
        this.uniformTextures[cacheKey] = tex;
        return tex;
    }

    createPlayerTexture(name: string, numberStr: string) {
        return this.createFrontTorsoTexture(numberStr);
    }

    createCharacter(name: string, numberStr: string) {
        const seed = generateSeed(name);
        const rng = new SeededRNG(seed);
        const group = new THREE.Group();
        group.rotation.order = 'YXZ';

        const skinPalette = SKIN_PALETTES[rng.int(0, SKIN_PALETTES.length - 1)];
        const hairPalette = HAIR_PALETTES[rng.int(0, HAIR_PALETTES.length - 1)];

        const skinTone = new THREE.Color(skinPalette.skin);
        const uniformColor = new THREE.Color(0x1b4d3e);
        const stripeWhite = new THREE.Color(0xffffff);

        const matSkin = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.7 });
        const matUniform = new THREE.MeshStandardMaterial({ color: uniformColor, roughness: 0.85 });
        const matWhite = new THREE.MeshStandardMaterial({ color: stripeWhite, roughness: 0.7 });

        const matFace = new THREE.MeshStandardMaterial({
            map: this.createFaceTexture(name, numberStr, skinPalette, hairPalette, rng) || undefined,
            roughness: 0.7
        });

        const matTorsoFront = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: this.createFrontTorsoTexture(numberStr) || undefined,
            roughness: 0.85
        });
        const matTorsoBack = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: this.createBackTorsoTexture(numberStr) || undefined,
            roughness: 0.85
        });

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.y = 2.6;

        // Head Box: +Z face is index 4, which receives the textured face
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), [
            matSkin, matSkin, matSkin, matSkin, matFace, matSkin
        ]);
        head.castShadow = true;
        headGroup.add(head);

        // Stylized 3D Nose
        const noseTone = new THREE.Color(skinPalette.shadow);
        const noseMat = new THREE.MeshStandardMaterial({ color: noseTone, roughness: 0.8 });
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.12), noseMat);
        nose.position.set(0, -0.06, 0.64);
        nose.castShadow = true;
        headGroup.add(nose);

        // 3D Ears
        const earGeo = new THREE.BoxGeometry(0.12, 0.28, 0.2);
        const earL = new THREE.Mesh(earGeo, matSkin);
        earL.position.set(-0.62, 0, 0.05);
        earL.castShadow = true;
        const earR = new THREE.Mesh(earGeo, matSkin);
        earR.position.set(0.62, 0, 0.05);
        earR.castShadow = true;
        headGroup.add(earL, earR);

        // Procedural 3D Hair
        const hairStyle = rng.int(0, 9);
        const matHair = new THREE.MeshStandardMaterial({ color: hairPalette.color, roughness: 0.85 });
        const matAccent = new THREE.MeshStandardMaterial({
            color: rng.choice([0xef4444, 0x06b6d4, 0xf59e0b, 0xffffff, 0xec4899]),
            roughness: 0.7
        });
        const hairMesh = buildHairMesh(hairStyle, matHair, matAccent, rng);
        headGroup.add(hairMesh);

        // Glasses for a percentage of players (22%)
        if (rng.chance(0.22)) {
            const glassesType = rng.int(0, 2);
            const glassesMesh = buildGlassesMesh(glassesType);
            headGroup.add(glassesMesh);
        }

        group.add(headGroup);

        // Torso with front and back jersey prints
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 0.8), [
            matUniform, matUniform, matUniform, matUniform, matTorsoFront, matTorsoBack
        ]);
        torso.position.y = 1.2;
        torso.castShadow = true;
        group.add(torso);

        // White Collar Rim
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.55), matWhite);
        collar.position.set(0, 2.05, 0);
        collar.castShadow = true;
        group.add(collar);

        // Arms with white racing stripes and skin hands
        const armGeo = new THREE.BoxGeometry(0.4, 1.6, 0.4);
        armGeo.translate(0, -0.6, 0);

        const createArm = (isLeft: boolean) => {
            const armGroup = new THREE.Group();
            const armSleeve = new THREE.Mesh(armGeo, matUniform);
            armSleeve.castShadow = true;
            armGroup.add(armSleeve);

            // Racing stripe on outer arm
            const stripeGeo = new THREE.BoxGeometry(0.04, 1.3, 0.12);
            stripeGeo.translate(0, -0.45, 0);
            const stripe = new THREE.Mesh(stripeGeo, matWhite);
            stripe.position.x = isLeft ? -0.21 : 0.21;
            armGroup.add(stripe);

            // Hand / cuff
            const cuffGeo = new THREE.BoxGeometry(0.42, 0.1, 0.42);
            const cuff = new THREE.Mesh(cuffGeo, matWhite);
            cuff.position.set(0, -1.2, 0);
            armGroup.add(cuff);

            const handGeo = new THREE.BoxGeometry(0.34, 0.28, 0.34);
            const hand = new THREE.Mesh(handGeo, matSkin);
            hand.position.set(0, -1.35, 0);
            hand.castShadow = true;
            armGroup.add(hand);

            armGroup.position.set(isLeft ? -0.9 : 0.9, 1.8, 0);
            return armGroup;
        };

        const armL = createArm(true);
        const armR = createArm(false);
        group.add(armL, armR);

        // Legs with racing stripes and sneakers
        const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
        legGeo.translate(0, -0.6, 0);

        const createLeg = (isLeft: boolean) => {
            const legGroup = new THREE.Group();
            const legMesh = new THREE.Mesh(legGeo, matUniform);
            legMesh.castShadow = true;
            legGroup.add(legMesh);

            // Side stripe on pants
            const legStripeGeo = new THREE.BoxGeometry(0.04, 1.2, 0.14);
            legStripeGeo.translate(0, -0.6, 0);
            const legStripe = new THREE.Mesh(legStripeGeo, matWhite);
            legStripe.position.x = isLeft ? -0.26 : 0.26;
            legGroup.add(legStripe);

            // White slip-on sneaker
            const shoeGeo = new THREE.BoxGeometry(0.55, 0.24, 0.68);
            const shoe = new THREE.Mesh(shoeGeo, matWhite);
            shoe.position.set(0, -1.28, 0.08);
            shoe.castShadow = true;
            legGroup.add(shoe);

            // Green accent band on sneaker
            const shoeAccent = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.32), matUniform);
            shoeAccent.position.set(0, -1.22, 0.1);
            legGroup.add(shoeAccent);

            legGroup.position.set(isLeft ? -0.4 : 0.4, 0.4, 0);
            legGroup.castShadow = true;
            return legGroup;
        };

        const legLGroup = createLeg(true);
        const legRGroup = createLeg(false);
        group.add(legLGroup, legRGroup);

        group.userData = { 
            name, isAlive: true, isMoving: false, moveTime: rng.range(0, 10),
            behavior: 'normal',
            parts: { head: headGroup, torso, armL, armR, legLGroup, legRGroup },
            localAngle: 0, localRadius: 0,
            homePos: new THREE.Vector3(0, 1, 0),
            standbyTimer: rng.range(0.5, 3.5),
            standbyAction: 'idle',
            standbyTarget: new THREE.Vector3(0, 1, 0),
            isStandbyMoving: false,
            standbySpeed: rng.range(0.025, 0.038)
        };
        return group;
    }

    getPlayerAvatar(name: string, numberStr?: string): string {
        if (this.playerAvatars[name]) return this.playerAvatars[name];
        const num = numberStr || getPlayerNumber(name);
        const avatar = generateStaticPlayerAvatar(name, num);
        this.playerAvatars[name] = avatar;
        return avatar;
    }

    createGuard(shapeType: string, angle: number, radius: number, isLeader: boolean = false) {
        const group = new THREE.Group();
        group.rotation.order = 'YXZ';

        // Vibrant Squid Game palette with Hamster styling
        const matSuit = new THREE.MeshStandardMaterial({ color: 0xef233c, roughness: 0.7 });
        const matInnerEar = new THREE.MeshStandardMaterial({ color: 0xfba1b7, roughness: 0.6 });
        const matMask = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.35 });
        const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const matBlack = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const matBuckle = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
        const matGoldFur = new THREE.MeshStandardMaterial({ color: 0xdf944a, roughness: 0.85 });
        const matWhiteFur = new THREE.MeshStandardMaterial({ color: 0xfaf8f5, roughness: 0.85 });
        const matNose = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
        const matGun = new THREE.MeshStandardMaterial({ color: 0x24272c, metalness: 0.7, roughness: 0.35 });

        // Chubby Hamster Body in Pink Jumpsuit (Potbelly)
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.6, 24), matSuit);
        torso.position.y = 1.15;
        group.add(torso);

        // Center zipper line
        const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.08), matBlack);
        zipper.position.set(0, 1.15, 1.05);
        group.add(zipper);

        // Tactical Waist Belt
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.22, 24), matBlack);
        belt.position.y = 0.85;
        group.add(belt);

        // Belt Buckle (front)
        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.12), matBuckle);
        buckle.position.set(0, 0.85, 1.18);
        group.add(buckle);

        // Side Utility Pouches
        const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), matBlack);
        pouchL.position.set(-1.18, 0.85, 0);
        const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), matBlack);
        pouchR.position.set(1.18, 0.85, 0);
        group.add(pouchL, pouchR);

        // Tactical Shoulder Harness Straps
        const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.06), matBlack);
        strapL.position.set(-0.55, 1.55, 0.9);
        strapL.rotation.z = -0.15;
        const strapR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.85, 0.06), matBlack);
        strapR.position.set(0.55, 1.55, 0.9);
        strapR.rotation.z = 0.15;
        group.add(strapL, strapR);

        // Cute Hamster Tail in Back
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), matSuit);
        tail.position.set(0, 0.7, -1.15);
        group.add(tail);

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 2.5, 0);

        // Pink Hood
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 24), matSuit);
        headGroup.add(hood);

        // Round Hamster Ears Poking Out of the Hood
        [-0.72, 0.72].forEach((x) => {
            const earGroup = new THREE.Group();
            earGroup.position.set(x, 0.75, 0.05);
            earGroup.rotation.z = x > 0 ? -0.28 : 0.28;
            earGroup.rotation.x = -0.12;

            const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), matSuit);
            outerEar.scale.set(1, 1, 0.45);
            earGroup.add(outerEar);

            const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), matInnerEar);
            innerEar.scale.set(1, 1, 0.3);
            innerEar.position.z = 0.1;
            earGroup.add(innerEar);

            headGroup.add(earGroup);
        });

        if (isLeader) {
            // Leader Hamster: Exposed cute chubby hamster face matching cover photo!
            const faceGroup = new THREE.Group();
            faceGroup.position.set(0, -0.05, 0.35);

            // Upper golden-tan fur
            const upperFace = new THREE.Mesh(new THREE.SphereGeometry(0.66, 18, 18), matGoldFur);
            upperFace.position.set(0, 0.16, 0.2);
            faceGroup.add(upperFace);

            // Chubby white fur cheeks
            const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), matWhiteFur);
            cheekL.position.set(-0.35, -0.14, 0.36);
            const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 16), matWhiteFur);
            cheekR.position.set(0.35, -0.14, 0.36);
            faceGroup.add(cheekL, cheekR);

            // Big glossy dark eyes
            const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), matBlack);
            eyeL.position.set(-0.28, 0.18, 0.65);
            const glintL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), matWhite);
            glintL.position.set(-0.04, 0.04, 0.12);
            eyeL.add(glintL);

            const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), matBlack);
            eyeR.position.set(0.28, 0.18, 0.65);
            const glintR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), matWhite);
            glintR.position.set(-0.04, 0.04, 0.12);
            eyeR.add(glintR);
            faceGroup.add(eyeL, eyeR);

            // Determined cute eyebrows
            const browL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), matBlack);
            browL.position.set(-0.28, 0.34, 0.65);
            browL.rotation.z = -0.2;
            const browR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.05), matBlack);
            browR.position.set(0.28, 0.34, 0.65);
            browR.rotation.z = 0.2;
            faceGroup.add(browL, browR);

            // Cute pink nose
            const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), matNose);
            nose.position.set(0, 0.02, 0.74);
            faceGroup.add(nose);

            // Whiskers
            [-1, 1].forEach((dir) => {
                for (let w = -1; w <= 1; w++) {
                    const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 6), matWhite);
                    whisker.rotation.z = Math.PI / 2 + (w * 0.15 * dir);
                    whisker.rotation.y = dir * 0.3;
                    whisker.position.set(dir * 0.38, -0.02 + w * 0.06, 0.62);
                    faceGroup.add(whisker);
                }
            });

            // Black Visor Cap on forehead with Square symbol
            const cap = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.38), matMask);
            cap.position.set(0, 0.48, 0.58);
            const squareSymbol = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.05), matWhite);
            squareSymbol.position.set(0, 0, 0.2);
            cap.add(squareSymbol);
            faceGroup.add(cap);

            headGroup.add(faceGroup);
        } else {
            // Masked Hamster Guard with Squid Game symbol
            const mask = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 20), matMask);
            mask.position.set(0, 0, 0.3);
            mask.scale.set(0.95, 0.95, 0.65);
            headGroup.add(mask);

            let shapeMesh;
            if (shapeType === 'circle') {
                shapeMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 10, 28), matWhite);
            } else if (shapeType === 'triangle') {
                shapeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.08, 3), matWhite);
                shapeMesh.rotation.x = Math.PI / 2;
                shapeMesh.rotation.y = Math.PI;
            } else {
                shapeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.08), matWhite);
            }
            shapeMesh.position.set(0, 0.05, 0.76);
            headGroup.add(shapeMesh);
        }

        group.add(headGroup);

        // Arms & Cute Official Guard Stance (Unarmed referee / security guard posture)
        const armGeo = new THREE.CylinderGeometry(0.28, 0.26, 1.0, 14);
        armGeo.translate(0, -0.4, 0);

        // Left arm
        const armLGroup = new THREE.Group();
        armLGroup.position.set(-0.95, 1.45, 0.1);
        armLGroup.rotation.x = -0.2;
        armLGroup.rotation.z = -0.15;
        const armL = new THREE.Mesh(armGeo, matSuit);
        const gloveL = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), matBlack);
        gloveL.position.set(0, -0.9, 0);
        armLGroup.add(armL, gloveL);
        group.add(armLGroup);

        // Right arm
        const armRGroup = new THREE.Group();
        armRGroup.position.set(0.95, 1.45, 0.1);
        armRGroup.rotation.x = -0.2;
        armRGroup.rotation.z = 0.15;
        const armR = new THREE.Mesh(armGeo, matSuit);
        const gloveR = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 12), matBlack);
        gloveR.position.set(0, -0.9, 0);
        armRGroup.add(armR, gloveR);
        group.add(armRGroup);

        // Short Chubby Legs in Pink Trousers with groups for walking animation
        const legGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.65, 14);
        legGeo.translate(0, -0.25, 0);

        const legLGroup = new THREE.Group();
        legLGroup.position.set(-0.42, 0.55, 0);
        const legL = new THREE.Mesh(legGeo, matSuit);
        const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.7), matBlack);
        bootL.position.set(0, -0.45, 0.12);
        legLGroup.add(legL, bootL);
        group.add(legLGroup);

        const legRGroup = new THREE.Group();
        legRGroup.position.set(0.42, 0.55, 0);
        const legR = new THREE.Mesh(legGeo, matSuit);
        const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.32, 0.7), matBlack);
        bootR.position.set(0, -0.45, 0.12);
        legRGroup.add(legR, bootR);
        group.add(legRGroup);

        group.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
        group.lookAt(0, 1, 0);
        group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) child.castShadow = true;
        });

        group.userData = {
            torso,
            headGroup,
            armL: armLGroup,
            armR: armRGroup,
            legLGroup,
            legRGroup,
            baseAngle: angle,
            baseRadius: radius,
            idleOffset: angle * 2,
            patrolSpeed: 0.15 + (angle % 3) * 0.05,
            patrolDir: (angle % 2 === 0 ? 1 : -1)
        };

        return group;
    }

    createDoors(numDoors: number) {
        if(!this.scene) return;
        this.doors.forEach(d => {
             if (d.group && d.group.parent) d.group.parent.remove(d.group);
        });
        this.doors = [];

        // No doors in Tag game mode!
        if (this.gameType === 'tag') {
            return;
        }

        const radius = Math.max(20, (numDoors * 8) / (Math.PI * 2));
        this.currentDoorRadius = radius; 
        const angleStep = (Math.PI * 2) / numDoors;

        for(let i=0; i<numDoors; i++) {
            const angle = i * angleStep;
            const doorGroup = new THREE.Group();
            
            const frameGeo = new THREE.BoxGeometry(6, 9, 1);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            doorGroup.add(frame);

            const panelGeo = new THREE.BoxGeometry(5, 8, 1.2);
            const doorColor = new THREE.Color().setHSL(i/numDoors, 0.8, 0.5);
            const panelMat = new THREE.MeshStandardMaterial({ color: doorColor, emissive: doorColor, emissiveIntensity: 0.2 });
            panelGeo.translate(2.5, 0, 0); const panel = new THREE.Mesh(panelGeo, panelMat);
            panel.position.set(-2.5, 0, 0.1);
            
            const shapeType = this.shapes[i % this.shapes.length];
            const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
            let doorShape;
            if (shapeType === 'circle') {
                doorShape = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 8, 24), matWhite);
            } else if (shapeType === 'triangle') {
                doorShape = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.3, 3), matWhite);
                doorShape.rotation.x = Math.PI / 2; doorShape.rotation.y = Math.PI;
            } else if (shapeType === 'square') {
                doorShape = new THREE.Mesh(new THREE.TorusGeometry(1, 0.2, 4, 4), matWhite);
                doorShape.rotation.z = Math.PI / 4;
            } else if (shapeType === 'star') {
                const starShape = new THREE.Shape();
                const outerRadius = 1.2;
                const innerRadius = 0.5;
                for (let j = 0; j < 10; j++) {
                    const a = (j * Math.PI) / 5;
                    const r = (j % 2 === 0) ? outerRadius : innerRadius;
                    if (j === 0) starShape.moveTo(Math.sin(a) * r, Math.cos(a) * r);
                    else starShape.lineTo(Math.sin(a) * r, Math.cos(a) * r);
                }
                const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.2, bevelEnabled: false });
                starGeo.center();
                doorShape = new THREE.Mesh(starGeo, matWhite);
            } else if (shapeType === 'umbrella') {
                doorShape = new THREE.Group();
                const domeGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32, 1, false, 0, Math.PI);
                const dome = new THREE.Mesh(domeGeo, matWhite);
                dome.rotation.x = Math.PI / 2;
                const stickGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.0);
                const stick = new THREE.Mesh(stickGeo, matWhite);
                stick.position.y = -0.5;
                const hookGeo = new THREE.TorusGeometry(0.25, 0.1, 8, 16, Math.PI);
                const hook = new THREE.Mesh(hookGeo, matWhite);
                hook.position.set(0.25, -1.0, 0);
                hook.rotation.z = Math.PI;
                doorShape.add(dome); doorShape.add(stick); doorShape.add(hook);
                doorShape.scale.set(0.8, 0.8, 0.8);
            }
            doorShape.position.set(2.5, 1, 0.65);
            panel.add(doorShape);

            doorGroup.add(panel);
            doorGroup.position.set(Math.cos(angle) * radius, 4.5, Math.sin(angle) * radius);
            doorGroup.lookAt(0, 4.5, 0);

            this.scene.add(doorGroup);
            this.doors.push({ group: doorGroup, panel, angle, color: doorColor });
        }
    }

    createTaggerGuard() {
        const group = new THREE.Group();
        group.rotation.order = 'YXZ';

        const matSuit = new THREE.MeshStandardMaterial({ color: 0xef233c, roughness: 0.7 });
        const matInnerEar = new THREE.MeshStandardMaterial({ color: 0xfba1b7, roughness: 0.6 });
        const matMask = new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.35 });
        const matWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const matBlack = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 });
        const matBuckle = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.2 });
        const matGlove = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6 });

        // Chubby torso
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 1.6, 24), matSuit);
        torso.position.y = 1.15;
        torso.castShadow = true;
        group.add(torso);

        // Center zipper
        const zipper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.5, 0.08), matBlack);
        zipper.position.set(0, 1.15, 1.05);
        group.add(zipper);

        // Belt & buckle
        const belt = new THREE.Mesh(new THREE.CylinderGeometry(1.17, 1.17, 0.22, 24), matBlack);
        belt.position.y = 0.85;
        group.add(belt);

        const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.12), matBuckle);
        buckle.position.set(0, 0.85, 1.18);
        group.add(buckle);

        // Side pouches
        const pouchL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), matBlack);
        pouchL.position.set(-1.18, 0.85, 0);
        const pouchR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.28), matBlack);
        pouchR.position.set(1.18, 0.85, 0);
        group.add(pouchL, pouchR);

        // Cute tail
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), matSuit);
        tail.position.set(0, 0.7, -1.15);
        group.add(tail);

        // Head Group
        const headGroup = new THREE.Group();
        headGroup.position.set(0, 2.5, 0);

        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.95, 24, 24), matSuit);
        hood.castShadow = true;
        headGroup.add(hood);

        // Mask
        const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.95, 24), matMask);
        mask.rotation.x = Math.PI / 2;
        mask.position.set(0, -0.05, 0.42);
        headGroup.add(mask);

        // Triangle emblem on mask (Squid Game Soldier)
        const triShape = new THREE.Shape();
        triShape.moveTo(0, 0.22);
        triShape.lineTo(0.2, -0.16);
        triShape.lineTo(-0.2, -0.16);
        triShape.closePath();
        const triGeo = new THREE.ShapeGeometry(triShape);
        const emblem = new THREE.Mesh(triGeo, matWhite);
        emblem.position.set(0, 0.05, 1.1);
        headGroup.add(emblem);

        // Hamster Ears
        [-0.72, 0.72].forEach((x) => {
            const earGroup = new THREE.Group();
            earGroup.position.set(x, 0.75, 0.05);
            earGroup.rotation.z = x > 0 ? -0.28 : 0.28;
            earGroup.rotation.x = -0.12;

            const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), matSuit);
            outerEar.scale.set(1, 1, 0.45);
            earGroup.add(outerEar);

            const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), matInnerEar);
            innerEar.scale.set(1, 1, 0.3);
            innerEar.position.z = 0.1;
            earGroup.add(innerEar);

            headGroup.add(earGroup);
        });

        group.add(headGroup);

        // Dynamic arms for running & catching
        const armGeo = new THREE.BoxGeometry(0.4, 1.1, 0.4);
        armGeo.translate(0, -0.55, 0);

        const createArm = (isLeft: boolean) => {
            const armGroup = new THREE.Group();
            const sleeve = new THREE.Mesh(armGeo, matSuit);
            sleeve.castShadow = true;
            armGroup.add(sleeve);

            const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.42), matBlack);
            cuff.position.set(0, -1.1, 0);
            armGroup.add(cuff);

            const glove = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.36), matGlove);
            glove.position.set(0, -1.25, 0);
            glove.castShadow = true;
            armGroup.add(glove);

            armGroup.position.set(isLeft ? -1.05 : 1.05, 1.85, 0);
            return armGroup;
        };

        const armL = createArm(true);
        const armR = createArm(false);
        group.add(armL, armR);

        // Running legs
        const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
        legGeo.translate(0, -0.6, 0);

        const createLeg = (isLeft: boolean) => {
            const legGroup = new THREE.Group();
            const pants = new THREE.Mesh(legGeo, matSuit);
            pants.castShadow = true;
            legGroup.add(pants);

            const boot = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.35, 0.72), matBlack);
            boot.position.set(0, -1.25, 0.08);
            boot.castShadow = true;
            legGroup.add(boot);

            legGroup.position.set(isLeft ? -0.42 : 0.42, 0.4, 0);
            return legGroup;
        };

        const legLGroup = createLeg(true);
        const legRGroup = createLeg(false);
        group.add(legLGroup, legRGroup);

        group.userData = {
            name: '__GUARD__',
            isAlive: true,
            isMoving: false,
            moveTime: 0,
            behavior: 'normal',
            parts: { head: headGroup, torso, armL, armR, legLGroup, legRGroup },
            isCustomArmAnim: false,
            homePos: new THREE.Vector3(0, 1, 17),
            standbyTimer: 2.0,
            standbyAction: 'patrol',
            standbyTarget: new THREE.Vector3(-6, 1, 17),
            isStandbyMoving: true,
            standbySpeed: 0.035
        };

        return group;
    }

    spawnPlayers(players: string[], designatedIT?: string) {
        this.clearEliminationEffects();
        this.isStandbyActive = true;
        Object.values(this.characters).forEach((c: any) => {
            if (c && c.parent) c.parent.remove(c);
        });
        this.characters = {};
        if(this.labelContainer) this.labelContainer.innerHTML = '';
        this.labels = {};
        this.labelSmoothedPos = {};

        // In Tag Game: IT is placed in front (z = 17) and other players in the far opposite arc!
        if (this.gameType === 'tag') {
            const isFirstGame = (this.tagRoundCount === 0 || !this.lastCaughtPlayer);
            let itName = '';

            if (isFirstGame) {
                // First game: IT is NOT a player, it is the Squid Guard!
                itName = '__GUARD__';
                this.itPlayerName = '__GUARD__';

                const guardChar = this.createTaggerGuard();
                guardChar.position.set(0, 1, 17);
                guardChar.lookAt(0, 1, -10);
                guardChar.userData.homePos = new THREE.Vector3(0, 1, 17);
                guardChar.userData.standbyTarget = new THREE.Vector3(0, 1, 17);
                guardChar.userData.standbyAction = 'patrol';
                guardChar.userData.standbyTimer = 2.0;
                guardChar.userData.isStandbyMoving = false;
                if (this.scene) this.scene.add(guardChar);
                this.characters['__GUARD__'] = guardChar;
                // No floating label on Squid Guard
            } else {
                // Second game onwards: IT is the player caught in the previous round!
                itName = designatedIT || this.lastCaughtPlayer || (players.length > 0 ? players[0] : '');
                this.itPlayerName = itName;

                if (itName) {
                    const itNumberStr = getPlayerNumber(itName);
                    const itChar = this.createCharacter(itName, itNumberStr);
                    itChar.position.set(0, 1, 17);
                    itChar.lookAt(0, 1, -10);
                    itChar.userData.isAlive = true;
                    itChar.userData.isMoving = false;
                    itChar.userData.homePos = new THREE.Vector3(0, 1, 17);
                    itChar.userData.standbyTarget = new THREE.Vector3(0, 1, 17);
                    itChar.userData.standbyAction = 'patrol';
                    itChar.userData.standbyTimer = 2.0;
                    itChar.userData.isStandbyMoving = false;
                    if (this.scene) this.scene.add(itChar);
                    this.characters[itName] = itChar;

                    if (this.labelContainer) {
                        const label = document.createElement('div');
                        label.className = 'character-label tag-it-label';
                        label.innerHTML = `<span style="background:#ef4444; color:white; padding:2px 8px; border-radius:6px; font-weight:bold; margin-right:4px; box-shadow:0 0 10px rgba(239,68,68,0.8);">🏃 IT (CAUGHT)</span> ${itName}`;
                        label.style.position = 'absolute';
                        label.style.left = '0px';
                        label.style.top = '0px';
                        label.style.background = 'rgba(15, 23, 42, 0.92)';
                        label.style.border = '2px solid #ef4444';
                        label.style.color = 'white';
                        label.style.padding = '3px 10px';
                        label.style.borderRadius = '8px';
                        label.style.fontFamily = "'Fredoka', sans-serif";
                        label.style.fontSize = '14px';
                        label.style.fontWeight = '700';
                        label.style.pointerEvents = 'none';
                        label.style.willChange = 'transform';
                        label.style.backfaceVisibility = 'hidden';
                        (label.style as any).webkitFontSmoothing = 'antialiased';
                        (label.style as any).textRendering = 'optimizeLegibility';
                        label.style.zIndex = '10';
                        label.style.whiteSpace = 'nowrap';
                        label.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
                        this.labelContainer.appendChild(label);
                        this.labels[itName] = label;
                    }
                }
            }

            // Spawn other players (runners) distributed across the playground opposite IT
            const otherPlayers = isFirstGame ? players : players.filter(p => p !== itName);
            const nOthers = otherPlayers.length;

            for (let i = 0; i < nOthers; i++) {
                const name = otherPlayers[i];
                const numberStr = getPlayerNumber(name);
                const char = this.createCharacter(name, numberStr);

                // Natural organic dispersion across the opposite half of the playground
                const t = nOthers > 1 ? i / (nOthers - 1) : 0.5;
                const baseAngle = Math.PI * (0.58 + 0.84 * t);
                const ringTier = i % 4;
                const baseRadius = ringTier === 0 ? 8.5 : ringTier === 1 ? 13.5 : ringTier === 2 ? 18.0 : 11.0;
                const r = Math.min(21.0, Math.max(6.5, baseRadius + ((i * 3.7) % 2.5) - 1.25));
                const px = Math.cos(baseAngle) * r;
                const pz = Math.sin(baseAngle) * r;

                char.position.set(px, 1, pz);
                char.lookAt(0, 1, 10); // looking toward IT and center
                char.userData.isAlive = true;
                char.userData.isMoving = false;
                char.userData.isFallen = false;
                char.userData.fallState = 'upright';
                char.userData.sprintBoost = 1.0;
                char.userData.homePos = new THREE.Vector3(px, 1, pz);
                char.userData.standbyTarget = new THREE.Vector3(px, 1, pz);
                char.userData.standbyAction = (i % 3 === 0) ? 'warmup' : (i % 3 === 1) ? 'lookAround' : 'wave';
                char.userData.standbyTimer = 0.5 + Math.random() * 2.5;
                char.userData.isStandbyMoving = false;

                if (this.scene) this.scene.add(char);
                this.characters[name] = char;

                if (this.labelContainer) {
                    const label = document.createElement('div');
                    label.className = 'character-label';
                    label.innerHTML = `${name}`;
                    label.style.position = 'absolute';
                    label.style.left = '0px';
                    label.style.top = '0px';
                    label.style.background = 'rgba(15, 23, 42, 0.88)';
                    label.style.border = '2px solid #10b981';
                    label.style.color = 'white';
                    label.style.padding = '2px 8px';
                    label.style.borderRadius = '8px';
                    label.style.fontFamily = "'Fredoka', sans-serif";
                    label.style.fontSize = '14px';
                    label.style.fontWeight = '600';
                    label.style.pointerEvents = 'none';
                    label.style.willChange = 'transform';
                    label.style.backfaceVisibility = 'hidden';
                    (label.style as any).webkitFontSmoothing = 'antialiased';
                    (label.style as any).textRendering = 'optimizeLegibility';
                    label.style.zIndex = '5';
                    label.style.whiteSpace = 'nowrap';
                    label.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
                    this.labelContainer.appendChild(label);
                    this.labels[name] = label;
                }
            }

            this.updateCameraFraming(false);
            return;
        }

        // Mingle game standard concentric rings placement - spaced generously across the enlarged platform
        let currentRing = 0;
        let playersPlaced = 0;
        let baseRadius = 8; // expanded from 5 to give spacious room

        while (playersPlaced < players.length) {
            let capacity = 10 + currentRing * 8; 
            let playersInRing = Math.min(capacity, players.length - playersPlaced);
            let radius = baseRadius + currentRing * 4.5;
            let angleStep = (Math.PI * 2) / playersInRing;

            for (let i = 0; i < playersInRing; i++) {
                const name = players[playersPlaced];
                const numberStr = getPlayerNumber(name);
                const char = this.createCharacter(name, numberStr);
                const angle = i * angleStep;
                
                char.userData.localAngle = angle;
                char.userData.localRadius = radius;
                
                const spawnX = Math.cos(angle) * radius;
                const spawnZ = Math.sin(angle) * radius;
                char.position.set(spawnX, 1, spawnZ);
                char.lookAt(0, 1, 0); 
                char.userData.homePos = new THREE.Vector3(spawnX, 1, spawnZ);
                char.userData.standbyTarget = char.userData.homePos.clone();
                char.userData.standbyTimer = 0.5 + Math.random() * 2.5;
                char.userData.standbyAction = (playersPlaced % 4 === 0) ? 'walk' : (playersPlaced % 4 === 1) ? 'wave' : (playersPlaced % 4 === 2) ? 'warmup' : 'lookAround';
                char.userData.isStandbyMoving = false; 

                if(this.innerPlatform) this.innerPlatform.add(char);
                this.characters[name] = char;

                if(this.labelContainer) {
                    const label = document.createElement('div');
                    label.className = 'character-label';
                    label.innerHTML = `${name}`;
                    label.style.position = 'absolute';
                    label.style.left = '0px';
                    label.style.top = '0px';
                    label.style.background = 'rgba(15, 23, 42, 0.85)';
                    label.style.border = '2px solid #10b981';
                    label.style.color = 'white';
                    label.style.padding = '2px 8px';
                    label.style.borderRadius = '8px';
                    label.style.fontFamily = "'Fredoka', sans-serif";
                    label.style.fontSize = '14px';
                    label.style.fontWeight = '600';
                    label.style.pointerEvents = 'none';
                    label.style.willChange = 'transform';
                    label.style.backfaceVisibility = 'hidden';
                    (label.style as any).webkitFontSmoothing = 'antialiased';
                    (label.style as any).textRendering = 'optimizeLegibility';
                    label.style.transition = 'opacity 0.3s';
                    label.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
                    label.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
                    label.style.zIndex = '5';
                    label.style.whiteSpace = 'nowrap';
                    this.labelContainer.appendChild(label);
                    this.labels[name] = label;
                }
                playersPlaced++;
            }
            currentRing++;
        }

        if(this.camera) {
            const targetY = Math.max(20, 10 + currentRing * 2);
            const targetZ = Math.max(35, 20 + currentRing * 4);

            gsap.fromTo(this.camera.position, 
                { x: 0, y: targetY + 20, z: targetZ + 25 },
                { x: 0, y: targetY, z: targetZ, duration: 2, ease: "power2.out" }
            );
        }
    }

    updateLabels() {
        if(!this.camera) return;
        
        const width = this.renderer?.domElement.clientWidth || window.innerWidth;
        const height = this.renderer?.domElement.clientHeight || window.innerHeight;

        const visibleItems: Array<{
            name: string;
            label: HTMLElement;
            x: number;
            y: number;
            screenZ: number;
            orderKey: number;
            offsetY: number;
        }> = [];

        Object.keys(this.characters).forEach(name => {
            const char = this.characters[name];
            const label = this.labels[name];
            if(!char || !label) return;

            if(char.userData.isAlive || char.userData.wasTagged) {
                // Read base character position to isolate name tag from dynamic mesh banking/hop jitter
                const charPos = new THREE.Vector3();
                char.getWorldPosition(charPos);
                const vector = new THREE.Vector3(
                    charPos.x,
                    charPos.y + (this.gameType === 'tag' ? 4.2 : 4.0),
                    charPos.z
                );
                vector.project(this.camera!);

                if (vector.z > 1.0 || vector.x < -1.1 || vector.x > 1.1 || vector.y < -1.1 || vector.y > 1.1) {
                    label.style.opacity = '0';
                } else {
                    const screenX = (vector.x * 0.5 + 0.5) * width;
                    const screenY = (vector.y * -0.5 + 0.5) * height;
                    const pNum = parseInt(getPlayerNumber(name), 10) || 0;

                    visibleItems.push({
                        name,
                        label,
                        x: screenX,
                        y: screenY,
                        screenZ: vector.z,
                        orderKey: pNum,
                        offsetY: 0
                    });
                }
            } else {
                label.style.opacity = '0';
            }
        });

        // STABLE deterministic sort by player number.
        // Sorting by fluctuating screenX causes index swapping at 60Hz which was the main source of jitter!
        visibleItems.sort((a, b) => a.orderKey - b.orderKey);

        for (let i = 0; i < visibleItems.length; i++) {
            const current = visibleItems[i];
            for (let j = 0; j < i; j++) {
                const prev = visibleItems[j];
                const dx = Math.abs(current.x - prev.x);
                const dy = Math.abs((current.y + current.offsetY) - (prev.y + prev.offsetY));
                
                // If two labels overlap in screen space:
                if (dx < 70 && dy < 24) {
                    current.offsetY = prev.offsetY - 26; // Stagger vertically with stable precedence
                }
            }
        }

        // Apply smooth temporal LERP interpolation to completely eliminate position jumping & jitter
        for (let i = 0; i < visibleItems.length; i++) {
            const item = visibleItems[i];
            const targetX = item.x;
            const targetY = item.y;
            const targetOffsetY = item.offsetY;

            if (!this.labelSmoothedPos[item.name]) {
                this.labelSmoothedPos[item.name] = {
                    x: targetX,
                    y: targetY,
                    offsetY: targetOffsetY
                };
            } else {
                const smoothed = this.labelSmoothedPos[item.name];
                // Smooth LERP factor 0.35 gives responsive tracking while absorbing all micro-jitter
                smoothed.x += (targetX - smoothed.x) * 0.35;
                smoothed.y += (targetY - smoothed.y) * 0.35;
                // Slower lerp on vertical collision offset (0.2) ensures buttery smooth stack transitions
                smoothed.offsetY += (targetOffsetY - smoothed.offsetY) * 0.2;
            }

            const smoothed = this.labelSmoothedPos[item.name];
            const finalY = smoothed.y + smoothed.offsetY;
            item.label.style.opacity = '1';
            item.label.style.transform = `translate3d(${smoothed.x.toFixed(1)}px, ${finalY.toFixed(1)}px, 0) translate(-50%, -100%)`;
            const depthZ = Math.round(2000 - item.screenZ * 1000);
            item.label.style.zIndex = `${depthZ + (Math.abs(smoothed.offsetY) > 2 ? 50 : 0)}`;
        }
    }

    async playTagRound(roundData: any) {
        if(!globalAudio) return;
        this.currentRoundData = roundData;
        this.updateCameraFraming(false);
        
        // 1. Determine IT: Round 1 is strictly the Squid Guard with NO player names!
        // Round 2 onwards is the player caught in the preceding round.
        const isFirstGame = (roundData.roundNum === 1);
        let itName = '';

        if (isFirstGame) {
            this.tagRoundCount = 0;
            this.lastCaughtPlayer = null;
            itName = '__GUARD__';
            this.itPlayerName = '__GUARD__';
            if (!this.characters['__GUARD__']) {
                const guardChar = this.createTaggerGuard();
                if (this.scene) this.scene.add(guardChar);
                this.characters['__GUARD__'] = guardChar;
            }
        } else {
            // Remove the Squid Guard from round 1 so only player is IT
            if (this.characters['__GUARD__']) {
                if (this.scene) this.scene.remove(this.characters['__GUARD__']);
                if (this.labels['__GUARD__']) {
                    this.labels['__GUARD__'].remove();
                    delete this.labels['__GUARD__'];
                }
                delete this.characters['__GUARD__'];
            }

            itName = this.lastCaughtPlayer || (roundData.activePlayers.length > 0 ? roundData.activePlayers[0] : '');
            this.itPlayerName = itName;

            if (!this.characters[itName]) {
                const itNumStr = getPlayerNumber(itName);
                const caughtChar = this.createCharacter(itName, itNumStr);
                if (this.scene) this.scene.add(caughtChar);
                this.characters[itName] = caughtChar;
            }
        }

        const itChar = this.characters[itName];
        if (itChar) {
            itChar.position.set(0, 1, 17);
            itChar.rotation.set(0, 0, 0);
            itChar.lookAt(0, 1, -10);
            itChar.userData.isAlive = true;
            itChar.userData.isMoving = false;
            itChar.userData.isCustomArmAnim = false;
            itChar.userData.homePos = new THREE.Vector3(0, 1, 17);
            itChar.userData.standbyTarget = new THREE.Vector3(0, 1, 17);
            itChar.userData.standbyAction = 'patrol';
            itChar.userData.standbyTimer = 2.0;
            itChar.userData.isStandbyMoving = false;
        }

        // Place other players naturally dispersed around the wide arena ring (so they are spread out rather than huddled in one clump)
        const others = isFirstGame ? roundData.activePlayers : roundData.activePlayers.filter((p: string) => p !== itName);
        const nOthers = others.length;
        others.forEach((name: string, i: number) => {
            const c = this.characters[name];
            if (c) {
                // Distribute across the upper 240 degrees (avoiding right next to IT at (0, 1, 17))
                const angleSpread = Math.PI * 1.35;
                const startAngle = Math.PI * 0.5 - angleSpread / 2;
                const t = nOthers > 1 ? i / (nOthers - 1) : 0.5;
                const jitterAngle = ((i * 13) % 7 - 3) * 0.04;
                const angle = startAngle + t * angleSpread + jitterAngle;
                
                const ringTier = i % 3;
                const baseRadius = ringTier === 0 ? 11.0 : ringTier === 1 ? 15.5 : 19.5;
                const jitterR = ((i * 17) % 5 - 2) * 0.6;
                const r = Math.min(21.5, Math.max(8.5, baseRadius + jitterR));
                
                const px = Math.cos(angle) * r;
                const pz = -Math.abs(Math.sin(angle) * r) * 0.95; // mostly across negative Z (opposite IT)
                
                c.position.set(px, 1, pz);
                c.rotation.set(0, 0, 0);
                c.lookAt(0, 1, 12);
                c.userData.isAlive = true;
                c.userData.isMoving = false;
                c.userData.wasTagged = false;
                c.userData.isCustomArmAnim = false;
                c.userData.isFallen = false;
                c.userData.fallState = 'upright';
                c.userData.sprintBoost = 1.0;
                c.userData.homePos = new THREE.Vector3(px, 1, pz);
                c.userData.standbyTarget = new THREE.Vector3(px, 1, pz);
                c.userData.standbyAction = (i % 3 === 0) ? 'warmup' : (i % 3 === 1) ? 'lookAround' : 'wave';
                c.userData.standbyTimer = 0.5 + Math.random() * 2.0;
                c.userData.isStandbyMoving = false;
            }
        });

        // Set labels and state - Squid Guard has no label; player IT gets IT badge
        const itNum = isFirstGame ? 'GUARD' : getPlayerNumber(itName);

        if (isFirstGame) {
            if (this.labels['__GUARD__']) {
                this.labels['__GUARD__'].remove();
                delete this.labels['__GUARD__'];
            }
        } else {
            const itLabel = this.labels[itName];
            if (itLabel) {
                itLabel.innerHTML = `<span style="background:#ef4444; color:white; padding:2px 8px; border-radius:6px; font-weight:bold; margin-right:4px; box-shadow:0 0 10px rgba(239,68,68,0.8);">🏃 IT</span> ${itName}`;
            }
        }

        // Prompt user in-game to click to start tag round & music!
        this.onStateChange({ 
            phase: 'TAG_READY', 
            round: roundData.roundNum, 
            msg: `ROUND ${roundData.roundNum}`,
            isMusicPlaying: false 
        });

        this.isStandbyActive = true;

        // Wait for user to explicitly click to start!
        await new Promise<void>(resolve => {
            this.waitingForTagStartResolve = resolve;
        });

        this.stopStandbyMode();

        // Evasion loop: players run avoiding IT, strictly staying inside the circle!
        let evasionActive = true;
        this.stopEvasion = () => { evasionActive = false; };
        const circleMaxRadius = 22.5;
        let currentTargetName: string | null = null;
        let currentChaseProgress = 0;
        let lastRandomTripTime = Date.now();

        const evasionLoop = () => {
            if (!evasionActive) return;
            const itPos = itChar ? itChar.position : new THREE.Vector3(0, 1, 0);

            // Dynamic fall/stumble events: upright runners occasionally stumble and get back up
            if (Date.now() - lastRandomTripTime > 3200 && others.length > 2) {
                lastRandomTripTime = Date.now();
                const candidates = others.filter((n: string) => {
                    const char = this.characters[n];
                    return char && char.userData.isAlive && !char.userData.isFallen && !char.userData.wasTagged && n !== currentTargetName;
                });
                if (candidates.length > 0) {
                    const pickedName = candidates[Math.floor(Math.random() * candidates.length)];
                    const pickedChar = this.characters[pickedName];
                    if (pickedChar) {
                        this.triggerPlayerTrip(pickedChar, false);
                    }
                }
            }

            others.forEach((name: string, idx: number) => {
                const c = this.characters[name];
                if (!c || !c.userData.isAlive) return;

                c.userData.isMoving = true;
                c.userData.moveTime = (c.userData.moveTime || 0) + 0.05;

                const awayDir = new THREE.Vector2(c.position.x - itPos.x, c.position.z - itPos.z);
                awayDir.normalize();

                const perpDir = new THREE.Vector2(-awayDir.y, awayDir.x);
                const isTarget = (name === currentTargetName);

                // If fallen and recovering on the turf: crawl slowly away
                if (c.userData.isFallen) {
                    const crawlSpeed = 0.035;
                    let crawlX = c.position.x + awayDir.x * crawlSpeed;
                    let crawlZ = c.position.z + awayDir.y * crawlSpeed;
                    const dCenter = Math.sqrt(crawlX * crawlX + crawlZ * crawlZ);
                    if (dCenter > circleMaxRadius) {
                        const ang = Math.atan2(crawlZ, crawlX);
                        crawlX = Math.cos(ang) * circleMaxRadius;
                        crawlZ = Math.sin(ang) * circleMaxRadius;
                    }
                    c.position.x = crawlX;
                    c.position.z = crawlZ;
                    return;
                }

                // Flocking separation between runners to prevent overlapping clumps with gentle force
                let repulseX = 0;
                let repulseZ = 0;
                others.forEach((otherName: string) => {
                    if (otherName === name) return;
                    const oc = this.characters[otherName];
                    if (!oc || !oc.userData.isAlive) return;
                    const diffX = c.position.x - oc.position.x;
                    const diffZ = c.position.z - oc.position.z;
                    const dSq = diffX * diffX + diffZ * diffZ;
                    if (dSq < 9.0 && dSq > 0.01) {
                        const d = Math.sqrt(dSq);
                        const force = (3.0 - d) / 3.0;
                        repulseX += (diffX / d) * force * 0.08;
                        repulseZ += (diffZ / d) * force * 0.08;
                    }
                });

                const distToIt = Math.sqrt(
                    (c.position.x - itPos.x) * (c.position.x - itPos.x) +
                    (c.position.z - itPos.z) * (c.position.z - itPos.z)
                );

                let baseSpeed = 0.20;
                let dodgeMult = 0.25;
                if (isTarget) {
                    if (currentChaseProgress < 0.85) {
                        baseSpeed = distToIt < 4.8 ? 0.28 : 0.24;
                        dodgeMult = 0.35;
                        c.userData.runSpeed = distToIt < 6 ? 20 : 16;
                    } else {
                        // Final stretch: slow down so IT makes the dramatic catch
                        baseSpeed = 0.13;
                        dodgeMult = 0.12;
                        c.userData.runSpeed = 13;
                    }
                } else {
                    if (distToIt < 7.5) {
                        baseSpeed = 0.24;
                        c.userData.runSpeed = 19; // panic sprint
                    } else {
                        baseSpeed = 0.17;
                        c.userData.runSpeed = 14;
                    }
                }

                if (c.userData.sprintBoost) {
                    baseSpeed *= c.userData.sprintBoost;
                }

                const dodgeOffset = Math.sin(Date.now() * 0.0028 + idx * 1.8) * dodgeMult;
                const moveVec = awayDir.clone().multiplyScalar(baseSpeed)
                    .add(perpDir.clone().multiplyScalar(dodgeOffset))
                    .add(new THREE.Vector2(repulseX, repulseZ));

                let newX = c.position.x + moveVec.x;
                let newZ = c.position.z + moveVec.y;

                // Smooth inward boundary deflection to keep players inside playing field without vibrating at walls
                const currentDistFromCenter = Math.sqrt(newX * newX + newZ * newZ);
                if (currentDistFromCenter > 18.0) {
                    const steerForce = (currentDistFromCenter - 18.0) / (circleMaxRadius - 18.0);
                    newX -= (newX / currentDistFromCenter) * steerForce * 0.26;
                    newZ -= (newZ / currentDistFromCenter) * steerForce * 0.26;
                }
                const clampedDist = Math.sqrt(newX * newX + newZ * newZ);
                if (clampedDist > circleMaxRadius) {
                    const angle = Math.atan2(newZ, newX);
                    newX = Math.cos(angle) * circleMaxRadius;
                    newZ = Math.sin(angle) * circleMaxRadius;
                }

                c.position.x = newX;
                c.position.z = newZ;

                // Smooth character facing angle without sudden jerks
                if (moveVec.lengthSq() > 0.001) {
                    const targetAngle = Math.atan2(moveVec.x, moveVec.y);
                    let diff = targetAngle - c.rotation.y;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    c.rotation.y += diff * 0.25;
                }

                // Gentle body banking roll into evasive turns
                c.rotation.z = -dodgeOffset * 0.10;

                // Panicked backward glance towards IT
                if (Math.random() < 0.012 && c.userData.parts?.head && !c.userData.isGlancing) {
                    c.userData.isGlancing = true;
                    const head = c.userData.parts.head;
                    const glanceSide = (idx % 2 === 0 ? 1 : -1) * 0.75;
                    gsap.to(head.rotation, {
                        y: glanceSide,
                        duration: 0.22,
                        yoyo: true,
                        repeat: 1,
                        ease: "power1.inOut",
                        onComplete: () => {
                            if (c.userData) c.userData.isGlancing = false;
                        }
                    });
                }

                // Panicked hop / jump
                if (Math.random() < 0.006 && !c.userData.isHopping && distToIt < 12) {
                    c.userData.isHopping = true;
                    gsap.to(c.position, {
                        y: 1.55,
                        duration: 0.2,
                        yoyo: true,
                        repeat: 1,
                        ease: "power1.out",
                        onComplete: () => {
                            if (c.userData) c.userData.isHopping = false;
                        }
                    });
                }

                c.position.x = newX;
                c.position.z = newZ;
            });

            requestAnimationFrame(evasionLoop);
        };
        requestAnimationFrame(evasionLoop);

        // IT catches designated target(s)
        let targetsToCatch: string[] = roundData.eliminated.filter((name: string) => name !== itName);
        if (targetsToCatch.length === 0 && others.length > 0) {
            targetsToCatch = [others[Math.floor(Math.random() * others.length)]];
        }

        const totalDuration = this.tagTimer || 15;
        const perTargetDurationSec = Math.max(5, Math.round(totalDuration / Math.max(1, targetsToCatch.length)));
        const chaseDurationMs = perTargetDurationSec * 1000;

        for (let tIdx = 0; tIdx < targetsToCatch.length; tIdx++) {
            const victimName = targetsToCatch[tIdx];
            const victimChar = this.characters[victimName];
            const victimNum = getPlayerNumber(victimName);

            if (!victimChar || !itChar) continue;

            currentTargetName = victimName;
            currentChaseProgress = 0;
            itChar.userData.isMoving = true;
            this.onStateChange({ isMusicPlaying: true });

            // Random decoy diversions: Pick 1 to 3 other alive players that IT briefly lunges/feints toward before locking in on victim
            const aliveDecoys = others.filter((n: string) => n !== victimName && this.characters[n]?.userData.isAlive);
            const shuffledDecoys = [...aliveDecoys].sort(() => Math.random() - 0.5).slice(0, Math.min(3, aliveDecoys.length));

            await new Promise<void>((resolveCatch) => {
                const chaseStart = Date.now();
                let lastReportedSec = -1;
                let activeChaseTargetName = shuffledDecoys.length > 0 ? shuffledDecoys[0] : victimName;
                let currentFacingAngle = itChar.rotation.y;

                const chaseInterval = setInterval(() => {
                    if (!itChar || !victimChar) {
                        clearInterval(chaseInterval);
                        this.activeChaseInterval = null;
                        this.onStateChange({ chaseSecondsLeft: undefined });
                        resolveCatch();
                        return;
                    }

                    const elapsed = Date.now() - chaseStart;
                    const progress = Math.min(1, elapsed / chaseDurationMs);
                    currentChaseProgress = progress;
                    const secLeft = Math.max(0, Math.ceil((chaseDurationMs - elapsed) / 1000));

                    if (secLeft !== lastReportedSec) {
                        lastReportedSec = secLeft;
                        this.onStateChange({ chaseSecondsLeft: secLeft });
                    }

                    itChar.userData.moveTime = (itChar.userData.moveTime || 0) + 0.08;

                    // Unpredictable dynamic targeting schedule:
                    // - 0% to ~28%: Lunge at Decoy 1 (if available)
                    // - ~28% to ~55%: Swerve and feint toward Decoy 2 (or 1)
                    // - >= 55%: Unrelentingly lock onto the actual victim for the climax!
                    if (progress < 0.28 && shuffledDecoys.length > 0) {
                        activeChaseTargetName = shuffledDecoys[0];
                    } else if (progress < 0.55 && shuffledDecoys.length > 1) {
                        activeChaseTargetName = shuffledDecoys[1];
                    } else {
                        activeChaseTargetName = victimName;
                    }

                    const activeTargetChar = this.characters[activeChaseTargetName] || victimChar;
                    const isFocusingActualVictim = (activeChaseTargetName === victimName);

                    const targetX = activeTargetChar.position.x;
                    const targetZ = activeTargetChar.position.z;
                    const dx = targetX - itChar.position.x;
                    const dz = targetZ - itChar.position.z;
                    const distToActive = Math.sqrt(dx * dx + dz * dz);

                    // Distance to actual victim (for camera and catch trigger)
                    const distToVictim = Math.sqrt(
                        (victimChar.position.x - itChar.position.x) * (victimChar.position.x - itChar.position.x) +
                        (victimChar.position.z - itChar.position.z) * (victimChar.position.z - itChar.position.z)
                    );

                    // Smooth turning toward whichever player IT is currently menacing
                    if (distToActive > 0.1) {
                        const desiredAngle = Math.atan2(dx, dz);
                        let angleDiff = desiredAngle - currentFacingAngle;
                        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                        currentFacingAngle += angleDiff * 0.18;
                        itChar.rotation.y = currentFacingAngle;
                    }

                    // Immersive Stable Progressive Camera: Gently zooms closer synchronized with timer without fast panning or spinning
                    if (this.camera) {
                        const midX = (itChar.position.x + activeTargetChar.position.x) * 0.5;
                        const midZ = (itChar.position.z + activeTargetChar.position.z) * 0.5;

                        const container = document.getElementById(this.containerId);
                        const width = container?.clientWidth || window.innerWidth;
                        const height = container?.clientHeight || Math.round(window.innerHeight * 0.85);
                        const aspect = width / Math.max(1, height);
                        const aspectScale = aspect < 1.65 ? 1.65 / Math.max(0.65, aspect) : 1.0;

                        const baseY = 40 * aspectScale;
                        const baseZ = 48 * aspectScale;

                        // Very gentle zoom: from 1.0 down to ~0.76 as timer counts down
                        const zoomFactor = 1.0 - (0.24 * Math.pow(progress, 0.9));

                        // Stable overhead vantage point: gentle X tracking clamped to ±5 units so names remain clear and readable
                        const camX = Math.max(-5, Math.min(5, midX * 0.18));
                        const camY = baseY * zoomFactor;
                        const camZ = baseZ * zoomFactor;

                        // Clamped smooth lookAt target centered on chase action
                        const lookX = Math.max(-6, Math.min(6, midX * 0.35));
                        const lookZ = Math.max(-6, Math.min(6, midZ * 0.35 + 1.2));
                        const targetLook = new THREE.Vector3(lookX, 1.2, lookZ);

                        this.tagCamTargetPos = new THREE.Vector3(camX, camY, camZ);
                        this.tagCamTargetLook = targetLook;
                    }

                    // Target victim dramatic slip/stumble as IT closes in during the final stretch
                    if (progress >= 0.74 && !victimChar.userData.isFallen && !victimChar.userData.wasTagged) {
                        this.triggerPlayerTrip(victimChar, true);
                    }

                    // IT reaches arms forward to touch/catch the player
                    if (distToActive < 3.2 && distToActive > 1.35) {
                        if (itChar.userData.parts?.armR && itChar.userData.parts?.armL) {
                            itChar.userData.isCustomArmAnim = true;
                            gsap.to(itChar.userData.parts.armR.rotation, {
                                x: -Math.PI * 0.72,
                                z: -0.22,
                                duration: 0.18,
                                overwrite: "auto"
                            });
                            gsap.to(itChar.userData.parts.armL.rotation, {
                                x: -Math.PI * 0.70,
                                z: 0.22,
                                duration: 0.18,
                                overwrite: "auto"
                            });
                        }
                        if (itChar.userData.parts?.torso) {
                            gsap.to(itChar.userData.parts.torso.rotation, {
                                x: 0.32,
                                duration: 0.18,
                                overwrite: "auto"
                            });
                        }
                    }

                    // Pacing of IT:
                    let itSpeed = 0.25;
                    if (progress < 0.55) {
                        // Decoy pursuit phase: fast erratic dashes keeping all players on edge
                        itSpeed = distToActive > 4.5 ? 0.32 : 0.24;
                    } else if (progress < 0.85) {
                        // Pursuit phase locked on real victim: stay on victim's heels
                        if (distToVictim > 5.5) {
                            itSpeed = 0.35;
                        } else if (distToVictim > 3.8) {
                            itSpeed = 0.26;
                        } else {
                            itSpeed = 0.20;
                        }
                    } else {
                        // Final stretch: surge to tag victim!
                        itSpeed = 0.44 + (progress - 0.85) * 0.9;
                    }

                    // Contact condition strictly for actual victim (or timeout finish):
                    const isContact = isFocusingActualVictim && (
                        (distToVictim <= 1.35 && progress >= 0.80) || 
                        (progress >= 1.0 && distToVictim <= 2.2) || 
                        elapsed >= (chaseDurationMs + 800)
                    );

                    if (!isContact) {
                        if (distToActive > 0.1) {
                            itChar.position.x += (dx / distToActive) * itSpeed;
                            itChar.position.z += (dz / distToActive) * itSpeed;
                        }
                    } else {
                        // Contact! TOUCH / CATCH!
                        clearInterval(chaseInterval);
                        this.activeChaseInterval = null;
                        this.onStateChange({ chaseSecondsLeft: undefined, isMusicPlaying: false });

                        // Physical hand tap/touch impact
                        if (itChar.userData.parts?.armR) {
                            gsap.to(itChar.userData.parts.armR.position, {
                                z: 0.35,
                                duration: 0.1,
                                yoyo: true,
                                repeat: 1
                            });
                        }

                        globalAudio?.play('boom', 420);
                        globalAudio?.play('pop', 350);

                        victimChar.userData.isAlive = false;
                        victimChar.userData.wasTagged = true;
                        victimChar.userData.isMoving = false;

                        // Victim physical reaction to being touched: arms fly up in shock
                        if (victimChar.userData.parts) {
                            victimChar.userData.isCustomArmAnim = true;
                            gsap.to(victimChar.userData.parts.armL.rotation, { x: -Math.PI * 0.85, z: -0.25, duration: 0.2 });
                            gsap.to(victimChar.userData.parts.armR.rotation, { x: -Math.PI * 0.85, z: 0.25, duration: 0.2 });
                        }

                        // Victim stumbles forward from touch impact
                        const impactDx = victimChar.position.x - itChar.position.x;
                        const impactDz = victimChar.position.z - itChar.position.z;
                        const impactDist = Math.max(0.1, Math.sqrt(impactDx * impactDx + impactDz * impactDz));
                        gsap.to(victimChar.position, {
                            x: victimChar.position.x + (impactDx / impactDist) * 0.75,
                            z: victimChar.position.z + (impactDz / impactDist) * 0.75,
                            duration: 0.25,
                            ease: "power1.out"
                        });

                        // Victim sits down on turf
                        gsap.to(victimChar.position, {
                            y: 0.4,
                            duration: 0.4,
                            delay: 0.15,
                            ease: "bounce.out"
                        });
                        gsap.to(victimChar.rotation, {
                            z: Math.PI / 2.2,
                            y: victimChar.rotation.y + 0.4,
                            duration: 0.4,
                            delay: 0.15
                        });

                        const vLabel = this.labels[victimName];
                        if (vLabel) {
                            vLabel.innerHTML = `<span style="background:#e11d48; color:white; padding:2px 8px; border-radius:6px; font-weight:bold; margin-right:4px; box-shadow:0 0 12px rgba(225,29,72,0.8);">💥 CAUGHT!</span> ${victimName}`;
                            vLabel.style.border = '2px solid #e11d48';
                            vLabel.style.boxShadow = '0 0 15px rgba(225,29,72,0.8)';
                        }

                        // Store this caught player as the IT for the NEXT game round!
                        this.lastCaughtPlayer = victimName;
                        this.tagRoundCount++;

                        // Rich dramatic elimination visual effects
                        this.createDizzyStars(victimChar);
                        const vPos = new THREE.Vector3();
                        victimChar.getWorldPosition(vPos);
                        this.createEliminationShockwave(vPos);
                        this.createSmokePuffs(vPos);
                        this.createGhostHamster(vPos);

                        if (globalAudio) {
                            globalAudio.play('bonk', 120);
                            globalAudio.play('boom');
                            globalAudio.play('gong');
                            globalAudio.play('ghost');
                        }

                        // IT player triumphant victory pose & hop
                        if (itChar) {
                            itChar.userData.isCustomArmAnim = true;
                            if (itChar.userData.parts?.armL) gsap.to(itChar.userData.parts.armL.rotation, { x: -Math.PI * 0.9, duration: 0.25 });
                            if (itChar.userData.parts?.armR) gsap.to(itChar.userData.parts.armR.rotation, { x: -Math.PI * 0.9, duration: 0.25 });
                            gsap.to(itChar.position, { y: 2.3, duration: 0.25, yoyo: true, repeat: 2, ease: "bounce.out" });
                        }

                        this.onStateChange({
                            phase: 'ELIMINATED',
                            msg: `${victimName} WAS CAUGHT!`,
                            eliminatedThisRound: targetsToCatch.slice(0, tIdx + 1),
                            isMusicPlaying: false
                        });

                        // Hold close camera framing for 2.2s so user enjoys the dramatic catch
                        setTimeout(() => {
                            // Smoothly restore wide arena framing
                            this.updateCameraFraming(false);
                            if (itChar.userData.parts?.torso) {
                                gsap.to(itChar.userData.parts.torso.rotation, { x: 0, duration: 0.4 });
                            }
                            itChar.userData.isCustomArmAnim = false;
                            victimChar.userData.isCustomArmAnim = false;
                            resolveCatch();
                        }, 2200);
                    }
                }, 16);

                this.activeChaseInterval = chaseInterval;
            });
        }

        // Stop evasion movement
        evasionActive = false;
        this.stopEvasion = null;
        this.activeChaseInterval = null;
        this.onStateChange({ chaseSecondsLeft: undefined, isMusicPlaying: false });
        if (itChar) itChar.userData.isMoving = false;

        // Survivors celebrate escaping!
        roundData.survivors.forEach((sName: string) => {
            const sChar = this.characters[sName];
            if (sChar && sChar.userData.isAlive) {
                sChar.userData.isMoving = false;
                sChar.lookAt(0, 1, 0);
                gsap.to(sChar.position, {
                    y: 2.2,
                    duration: 0.25,
                    yoyo: true,
                    repeat: 3,
                    ease: "power1.out"
                });
            }
        });

        // IT victory hop
        if (itChar) {
            gsap.to(itChar.position, {
                y: 2.5,
                duration: 0.3,
                yoyo: true,
                repeat: 3,
                ease: "power1.out"
            });
        }

        await new Promise(r => setTimeout(r, 2200));

        this.onStateChange({
            phase: 'IDLE',
            msg: `${roundData.survivors.length} PLAYERS ESCAPED!`,
            eliminatedThisRound: roundData.eliminated,
            isMusicPlaying: false
        });

        await new Promise(r => setTimeout(r, 1500));
    }

    async playRound(roundData: any) {
        if(!globalAudio) return;
        if (this.gameType === 'tag') {
            return this.playTagRound(roundData);
        }
        this.currentRoundData = roundData;
        this.createDoors(roundData.numDoors);
        
        // Zoom camera to see all doors
        if (this.camera) {
            gsap.to(this.camera.position, {
                x: 0,
                y: Math.max(20, this.currentDoorRadius * 1.2),
                z: Math.max(35, this.currentDoorRadius * 1.8),
                duration: 2,
                ease: "power2.out"
            });
        }
        
        this.onStateChange({ phase: 'SPINNING', round: roundData.roundNum, msg: `ROUND ${roundData.roundNum}`, isMusicPlaying: false });
        
        // Wait for user to manually spin and finish spinning
        await new Promise<void>(resolve => {
            this.waitingForSpinResolve = resolve;
        });

        this.onStateChange({ phase: 'DOORS', msg: 'CHOOSE A ROOM!', isMusicPlaying: true, chaseSecondsLeft: 10 });
        globalAudio.play('pop', 300);
        
        this.doors.forEach(d => {
            gsap.to(d.panel.rotation, { y: Math.PI / 1.8, duration: 0.8, ease: "power2.inOut" }); 
        });
        await new Promise(r => setTimeout(r, 1000));
        
        Object.keys(this.characters).forEach(name => {
            const char = this.characters[name];
            if(char && char.userData.isAlive) {
                const worldPos = new THREE.Vector3();
                char.getWorldPosition(worldPos);
                const worldQuat = new THREE.Quaternion();
                char.getWorldQuaternion(worldQuat);
                
                if(this.scene) this.scene.add(char);
                char.position.copy(worldPos);
                char.quaternion.copy(worldQuat);
            }
        });

        // 10-second countdown in header HUD and audio ticks
        let doorSecondsRemaining = 10;
        if (this.activeDoorCountdownInterval) {
            clearInterval(this.activeDoorCountdownInterval);
        }
        this.activeDoorCountdownInterval = setInterval(() => {
            doorSecondsRemaining--;
            if (doorSecondsRemaining >= 0) {
                this.onStateChange({ chaseSecondsLeft: doorSecondsRemaining });
                if (globalAudio) {
                    if (doorSecondsRemaining <= 3 && doorSecondsRemaining > 0) {
                        globalAudio.play('alarm');
                    } else if (doorSecondsRemaining > 0) {
                        globalAudio.play('pop', 700 + (10 - doorSecondsRemaining) * 50);
                    }
                }
            }
            if (doorSecondsRemaining <= 0) {
                clearInterval(this.activeDoorCountdownInterval);
                this.activeDoorCountdownInterval = null;
            }
        }, 1000);

        const movePromises: Promise<void>[] = [];
        let isRunning = true;
        const footstepLoop = () => {
            if (!isRunning) return;
            if (globalAudio) globalAudio.play('footstep');
            setTimeout(footstepLoop, 100 + Math.random() * 50); // fast scattered steps
        };
        footstepLoop();

        const numDoorsTotal = this.doors.length;

        roundData.distribution.forEach((doorGroup: string[], doorIndex: number) => {
            const door = this.doors[doorIndex];
            const doorDir = door.group.position.clone().normalize();
            const roomPos = door.group.position.clone().add(doorDir.multiplyScalar(3.2)); 

            // Pick an alternate door across the arena for indecisive players who switch doors
            const otherDoorIndex = (doorIndex + 1 + Math.floor(Math.random() * (numDoorsTotal - 1))) % numDoorsTotal;
            const otherDoor = this.doors[otherDoorIndex];
            const otherDoorDir = otherDoor.group.position.clone().normalize();
            const otherRoomPos = otherDoor.group.position.clone().add(otherDoorDir.multiplyScalar(3.2));

            doorGroup.forEach((playerName, playerIdxInDoor) => {
                const char = this.characters[playerName];
                if(!char) return;
                
                const isEliminated = roundData.eliminated.includes(playerName);
                char.userData.isMoving = true;

                const offset = new THREE.Vector3((Math.random() - 0.5) * 3.0, 0, (Math.random() - 0.5) * 3.0);
                let finalPos = roomPos.clone().add(offset);
                
                // In Mingle Game: The player who cannot go inside the door is locked out outside and eliminated!
                if (isEliminated) {
                    // Locked out outside the closed door threshold
                    finalPos = roomPos.clone().sub(doorDir.clone().multiplyScalar(2.2)).add(new THREE.Vector3((Math.random() - 0.5) * 1.6, 0, (Math.random() - 0.5) * 1.6));
                }
                
                finalPos.y = 1;
                
                const totalDuration = 9.2 + Math.random() * 0.4; // Matches the 10-second countdown timer

                // Distinct running drama variants:
                // 1) Fall & Crawl: trips, falls flat on belly/knees, crawls forward, scrambles back up
                // 2) Stumble & Sprint: brief trip/wobble with recovery sprint
                // 3) Pure Natural Sprint: smooth high-speed dash straight into safety
                const runnerStuntType = isEliminated 
                    ? 'fall_and_crawl' 
                    : (playerIdxInDoor % 3 === 0 ? 'fall_and_crawl' : playerIdxInDoor % 3 === 1 ? 'stumble_and_sprint' : 'pure_sprint');

                movePromises.push(new Promise<void>(resolve => {
                    const tl = gsap.timeline({ onComplete: () => {
                        char.userData.isMoving = false;
                        char.userData.behavior = 'normal';
                        char.userData.isCustomArmAnim = false;
                        char.userData.isFallen = false;
                        resolve();
                    }});

                    const currentWorldPos = char.position.clone();
                    const directVector = roomPos.clone().sub(currentWorldPos);
                    const totalDist = Math.max(1, directVector.length());
                    const runDir = directVector.clone().normalize();
                    
                    if (isEliminated) {
                        // ELIMINATED PLAYER: Runs toward door, trips, falls down flat, crawls desperately on turf, gets up, rushes to door only for it to slam shut!
                        const tripDist = Math.min(totalDist * 0.35, 10);
                        const tripPos = currentWorldPos.clone().add(runDir.clone().multiplyScalar(tripDist));
                        const crawlDist = Math.min(totalDist * 0.28, 8);
                        const crawlEndPos = tripPos.clone().add(runDir.clone().multiplyScalar(crawlDist));
                        const approachPos = roomPos.clone().sub(doorDir.clone().multiplyScalar(1.2));
                        
                        // Phase 1: Smooth natural sprint towards door (smooth lookAt)
                        tl.call(() => {
                            char.lookAt(tripPos.x, 1, tripPos.z);
                            char.userData.runSpeed = 16;
                        });
                        tl.to(char.position, {
                            x: tripPos.x,
                            z: tripPos.z,
                            duration: totalDuration * 0.26,
                            ease: "power1.inOut"
                        });

                        // Phase 2: Dramatic trip and fall flat down onto the grass!
                        tl.call(() => {
                            char.userData.isFallen = true;
                            char.userData.behavior = 'crawl';
                            char.userData.isCustomArmAnim = true;
                            if (globalAudio) globalAudio.play('bonk', 180);
                            if (char.userData.parts?.armL && char.userData.parts?.armR) {
                                gsap.to(char.userData.parts.armL.rotation, { x: -Math.PI * 0.8, z: 0.3, duration: 0.2 });
                                gsap.to(char.userData.parts.armR.rotation, { x: -Math.PI * 0.8, z: -0.3, duration: 0.2 });
                            }
                        });
                        tl.to(char.position, { y: 0.38, duration: 0.3, ease: "power2.out" });
                        tl.to(char.rotation, { x: Math.PI * 0.42, z: 0.25, duration: 0.3, ease: "power2.out" }, "<");

                        // Phase 3: Desperately crawl forward along the ground
                        tl.to(char.position, {
                            x: crawlEndPos.x,
                            z: crawlEndPos.z,
                            duration: totalDuration * 0.26,
                            ease: "linear"
                        });

                        // Phase 4: Push back up onto feet and frantic last-second sprint!
                        tl.call(() => {
                            char.userData.isFallen = false;
                            char.userData.behavior = 'normal';
                            char.userData.isCustomArmAnim = false;
                            char.lookAt(approachPos.x, 1, approachPos.z);
                            char.userData.runSpeed = 22;
                        });
                        tl.to(char.position, { y: 1.0, duration: 0.35, ease: "power2.out" });
                        tl.to(char.rotation, { x: 0, z: 0, duration: 0.35, ease: "power2.out" }, "<");
                        tl.to(char.position, {
                            x: approachPos.x,
                            z: approachPos.z,
                            duration: totalDuration * 0.32,
                            ease: "power2.in"
                        });

                        // Door slams shut right at their face!
                        tl.call(() => {
                            if (globalAudio) {
                                globalAudio.play('bonk', 120);
                                globalAudio.play('alarm');
                            }
                        });
                        // Smooth bounce back from closed door
                        tl.to(char.position, { 
                            x: finalPos.x, 
                            z: finalPos.z, 
                            y: 0.6, 
                            duration: 0.35, 
                            ease: "power2.out" 
                        });
                        tl.to(char.rotation, { x: 0.25, duration: 0.25 }, "<");

                        // Desperately bang hands on the closed door
                        tl.call(() => {
                            char.lookAt(roomPos.x, 1, roomPos.z);
                            if (char.userData.parts?.armL && char.userData.parts?.armR) {
                                gsap.to(char.userData.parts.armL.rotation, { x: -Math.PI * 0.7, yoyo: true, repeat: 5, duration: 0.1 });
                                gsap.to(char.userData.parts.armR.rotation, { x: -Math.PI * 0.7, yoyo: true, repeat: 5, duration: 0.1, delay: 0.05 });
                            }
                            if (globalAudio) globalAudio.play('bonk', 140);
                        });
                        tl.to({}, { duration: 0.5 }); // banging duration

                        // Collapse down to knees in despair outside the locked doors
                        tl.to(char.position, { y: 0.45, duration: 0.45, ease: "power2.out" });
                        tl.to(char.rotation, { x: Math.PI / 2.3, duration: 0.45, ease: "power2.out" }, "<");

                    } else if (runnerStuntType === 'fall_and_crawl') {
                        // SURVIVOR: Trips, falls down, scrambles crawling on grass, pushes up, smoothly enters room!
                        const tripDist = Math.min(totalDist * 0.3, 8);
                        const tripPos = currentWorldPos.clone().add(runDir.clone().multiplyScalar(tripDist));
                        const crawlDist = Math.min(totalDist * 0.25, 6);
                        const crawlEndPos = tripPos.clone().add(runDir.clone().multiplyScalar(crawlDist));
                        const thresholdPos = roomPos.clone().sub(doorDir.clone().multiplyScalar(0.4));

                        // Phase 1: Natural smooth run to trip point
                        tl.call(() => {
                            char.lookAt(tripPos.x, 1, tripPos.z);
                            char.userData.runSpeed = 16;
                        });
                        tl.to(char.position, {
                            x: tripPos.x,
                            z: tripPos.z,
                            duration: totalDuration * 0.25,
                            ease: "power1.inOut"
                        });

                        // Phase 2: Stumble and fall to knees/belly on grass
                        tl.call(() => {
                            char.userData.isFallen = true;
                            char.userData.behavior = 'crawl';
                            char.userData.isCustomArmAnim = true;
                            if (globalAudio) globalAudio.play('bonk', 200);
                        });
                        tl.to(char.position, { y: 0.4, duration: 0.28, ease: "power2.out" });
                        tl.to(char.rotation, { x: Math.PI * 0.4, z: -0.2, duration: 0.28, ease: "power2.out" }, "<");

                        // Phase 3: Desperate crawl on grass
                        tl.to(char.position, {
                            x: crawlEndPos.x,
                            z: crawlEndPos.z,
                            duration: totalDuration * 0.24,
                            ease: "linear"
                        });

                        // Phase 4: Push back up to feet
                        tl.call(() => {
                            char.userData.isFallen = false;
                            char.userData.behavior = 'normal';
                            char.userData.isCustomArmAnim = false;
                            char.lookAt(thresholdPos.x, 1, thresholdPos.z);
                            char.userData.runSpeed = 18;
                        });
                        tl.to(char.position, { y: 1.0, duration: 0.35, ease: "power2.out" });
                        tl.to(char.rotation, { x: 0, z: 0, duration: 0.35, ease: "power2.out" }, "<");

                        // Phase 5: Smooth sprint right through the door into room
                        tl.to(char.position, {
                            x: thresholdPos.x,
                            z: thresholdPos.z,
                            duration: totalDuration * 0.35,
                            ease: "power1.out"
                        });
                        tl.to(char.position, {
                            x: finalPos.x,
                            z: finalPos.z,
                            duration: totalDuration * 0.16,
                            ease: "power1.out"
                        });

                        // Phase 6: Inside the room celebration
                        tl.call(() => {
                            char.lookAt(door.group.position.x, 1, door.group.position.z);
                            if (char.userData.parts?.armL && char.userData.parts?.armR) {
                                gsap.to(char.userData.parts.armL.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                                gsap.to(char.userData.parts.armR.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                            }
                        });
                        tl.to(char.position, { y: "+=1.2", duration: 0.22, yoyo: true, repeat: 2, ease: "power1.out" });
                        tl.to([
                            char.userData.parts?.armL?.rotation, 
                            char.userData.parts?.armR?.rotation, 
                            char.userData.parts?.legLGroup?.rotation, 
                            char.userData.parts?.legRGroup?.rotation,
                            char.userData.parts?.head?.rotation
                        ].filter(Boolean), { x: 0, duration: 0.3 });

                    } else if (runnerStuntType === 'stumble_and_sprint') {
                        // SURVIVOR: Smooth sprint, momentary stumble, then fast smooth stride into safety
                        const stumbleDist = Math.min(totalDist * 0.4, 10);
                        const stumblePos = currentWorldPos.clone().add(runDir.clone().multiplyScalar(stumbleDist));
                        const thresholdPos = roomPos.clone().sub(doorDir.clone().multiplyScalar(0.4));

                        tl.call(() => {
                            char.lookAt(stumblePos.x, 1, stumblePos.z);
                            char.userData.runSpeed = 16;
                        });
                        tl.to(char.position, {
                            x: stumblePos.x,
                            z: stumblePos.z,
                            duration: totalDuration * 0.38,
                            ease: "power1.inOut"
                        });

                        // Subtle natural stumble
                        tl.to(char.position, { y: 0.65, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" });
                        tl.to(char.rotation, { x: 0.35, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" }, "<");

                        // Smooth sprint to threshold and into room
                        tl.call(() => {
                            char.lookAt(thresholdPos.x, 1, thresholdPos.z);
                            char.userData.runSpeed = 20;
                        });
                        tl.to(char.position, {
                            x: thresholdPos.x,
                            z: thresholdPos.z,
                            duration: totalDuration * 0.44,
                            ease: "power1.out"
                        });
                        tl.to(char.position, {
                            x: finalPos.x,
                            z: finalPos.z,
                            duration: totalDuration * 0.18,
                            ease: "power1.out"
                        });

                        // Relief celebration inside
                        tl.call(() => {
                            char.lookAt(door.group.position.x, 1, door.group.position.z);
                            if (char.userData.parts?.armL && char.userData.parts?.armR) {
                                gsap.to(char.userData.parts.armL.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                                gsap.to(char.userData.parts.armR.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                            }
                        });
                        tl.to(char.position, { y: "+=1.2", duration: 0.22, yoyo: true, repeat: 2, ease: "power1.out" });
                        tl.to([
                            char.userData.parts?.armL?.rotation, 
                            char.userData.parts?.armR?.rotation, 
                            char.userData.parts?.legLGroup?.rotation, 
                            char.userData.parts?.legRGroup?.rotation,
                            char.userData.parts?.head?.rotation
                        ].filter(Boolean), { x: 0, duration: 0.3 });

                    } else {
                        // SURVIVOR: Pure natural continuous sprint from platform straight into room
                        const thresholdPos = roomPos.clone().sub(doorDir.clone().multiplyScalar(0.4));

                        tl.call(() => {
                            char.lookAt(thresholdPos.x, 1, thresholdPos.z);
                            char.userData.runSpeed = 18;
                        });

                        tl.to(char.position, {
                            x: thresholdPos.x,
                            z: thresholdPos.z,
                            duration: totalDuration * 0.82,
                            ease: "power1.inOut"
                        });
                        tl.to(char.position, {
                            x: finalPos.x,
                            z: finalPos.z,
                            duration: totalDuration * 0.18,
                            ease: "power1.out"
                        });

                        // Relief celebration inside
                        tl.call(() => {
                            char.lookAt(door.group.position.x, 1, door.group.position.z);
                            if (char.userData.parts?.armL && char.userData.parts?.armR) {
                                gsap.to(char.userData.parts.armL.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                                gsap.to(char.userData.parts.armR.rotation, { x: -Math.PI * 0.8, duration: 0.3 });
                            }
                        });
                        tl.to(char.position, { y: "+=1.2", duration: 0.22, yoyo: true, repeat: 2, ease: "power1.out" });
                        tl.to([
                            char.userData.parts?.armL?.rotation, 
                            char.userData.parts?.armR?.rotation, 
                            char.userData.parts?.legLGroup?.rotation, 
                            char.userData.parts?.legRGroup?.rotation,
                            char.userData.parts?.head?.rotation
                        ].filter(Boolean), { x: 0, duration: 0.3 });
                    }
                }));
            });
        });
        
        await Promise.all(movePromises);
        isRunning = false; // stop footstep loop
        if (this.activeDoorCountdownInterval) {
            clearInterval(this.activeDoorCountdownInterval);
            this.activeDoorCountdownInterval = null;
        }
        this.onStateChange({ chaseSecondsLeft: undefined });
        
        // Door panels slam shut with heavy locking clank!
        if (globalAudio) {
            globalAudio.play('bonk', 100);
            globalAudio.play('pop', 150);
        }
        this.doors.forEach(d => { 
            gsap.to(d.panel.rotation, { y: 0, duration: 0.4, ease: "power3.in" }); 
        });
        await new Promise(r => setTimeout(r, 800));

        // MINGLE GAME EVALUATION:
        // Players who made it inside doors are safe!
        // Players who could not go inside the door are locked out and eliminated!
        this.onStateChange({ phase: 'EVALUATING', msg: 'DOORS LOCKED! CONTESTANTS LOCKED OUT!', isMusicPlaying: false });
        if (globalAudio) globalAudio.play('alarm');
        
        gsap.to(this.ambientLight, { intensity: 0.08, duration: 0.5 });
        gsap.to(this.dirLight, { intensity: 0.08, duration: 0.5 });
        if(this.scene) gsap.to(this.scene.fog, { density: 0.035, duration: 1 });

        // Highlight locked out contestants outside with dramatic red spotlights
        if (roundData.eliminated.length > 0 && this.spotLight) {
            const firstVictim = this.characters[roundData.eliminated[0]];
            if (firstVictim) {
                this.spotLight.intensity = 18;
                this.spotLight.color.setHex(0xff0044);
                this.spotLight.position.set(firstVictim.position.x, 20, firstVictim.position.z);
                this.spotLight.target = firstVictim;
            }
        }
        gsap.to(this.alarmLight, { intensity: 10, duration: 0.4, yoyo: true, repeat: 4 });
        await new Promise(r => setTimeout(r, 1800));

        if(roundData.eliminated.length > 0) {
            await this.executeEliminationSequence(roundData.eliminated, 'lockout');
        }

        gsap.to(this.ambientLight, { intensity: 0.7, duration: 1 });
        gsap.to(this.dirLight, { intensity: this.baseLightIntensity, duration: 1 });
        if(this.scene) gsap.to(this.scene.fog, { density: 0.015, duration: 1 });
        gsap.to(this.alarmLight, { intensity: 0, duration: 1 });

        // All doors that players entered glow safe green!
        if (globalAudio) globalAudio.play('pop', 400);
        this.doors.forEach((d) => {
            gsap.to(d.panel.rotation, { y: Math.PI / 1.8, duration: 0.8, ease: "power2.out" }); 
            d.panel.material.color.setHex(0x00ff00); 
            d.panel.material.emissive.setHex(0x005500);
        });
        
        await new Promise(r => setTimeout(r, 2000));

        if (roundData.survivors.length > 0) {
            const returnPromises: Promise<void>[] = [];
            if(this.innerPlatform) {
                this.innerPlatform.rotation.y = 0;
                this.spinTarget = 0;
            } 
            
            roundData.survivors.forEach((playerName: string, i: number) => {
                const char = this.characters[playerName];
                const angle = (Math.PI * 2 / roundData.survivors.length) * i;
                const radius = Math.min(18, 9 + Math.floor(i / 10) * 4);
                
                char.userData.localAngle = angle;
                char.userData.localRadius = radius;
                
                const finalPos = new THREE.Vector3(Math.cos(angle)*radius, 1, Math.sin(angle)*radius);
                
                char.lookAt(finalPos);
                char.userData.isMoving = true;

                returnPromises.push(new Promise(resolve => {
                    gsap.to(char.position, {
                        x: finalPos.x, z: finalPos.z, duration: 2, ease: "power2.inOut",
                        onComplete: () => {
                            char.userData.isMoving = false;
                            gsap.to([char.userData.parts.armL.rotation, char.userData.parts.armR.rotation, char.userData.parts.legLGroup.rotation, char.userData.parts.legRGroup.rotation], {x: 0, duration: 0.2});
                            char.lookAt(0,1,0);
                            
                            if(this.innerPlatform) this.innerPlatform.add(char);
                            char.position.set(finalPos.x, 1, finalPos.z);
                            resolve();
                        }
                    });
                }));
            });
            await Promise.all(returnPromises);
        }

        this.onStateChange({ phase: 'CLEANUP', eliminatedThisRound: [], isMusicPlaying: false });

        this.doors.forEach(d => {
             gsap.to(d.group.position, { y: -10, duration: 1.5, ease:"power2.in" });
        });
        
        await new Promise(r => setTimeout(r, 1500));
    }

    async playWinnerSequence(chosenOnes: string[], mode: string) {
        if(!globalAudio) return;
        const winnerMsg = this.gameType === 'tag'
            ? (mode === 'picker' ? (chosenOnes.length > 1 ? 'PLAYERS CAUGHT' : 'PLAYER CAUGHT') : 'SOLE SURVIVOR • ESCAPED ALL TAGS!')
            : (mode === 'picker' ? 'ELIMINATION COMPLETE' : 'SOLE SURVIVOR');
        this.onStateChange({ phase: 'WINNER', msg: winnerMsg, isMusicPlaying: false });
        
        if (this.gameType === 'tag') {
            gsap.to(this.spotLight, { intensity: 6, duration: 2 });
            gsap.to(this.ambientLight, { intensity: 0.6, duration: 2 });
            gsap.to(this.dirLight, { intensity: 0.8, duration: 2 });
            if(this.scene) this.scene.background = new THREE.Color('#38bdf8');
        } else {
            gsap.to(this.spotLight, { intensity: 10, duration: 2 });
            gsap.to(this.ambientLight, { intensity: 0.1, duration: 2 });
            gsap.to(this.dirLight, { intensity: 0.1, duration: 2 });
            if(this.scene) this.scene.background = new THREE.Color('#0f172a'); 
        } 

        if (mode === 'picker') {
            let centerX = 0, centerZ = 0;
            let validCount = 0;
            chosenOnes.forEach(name => {
                let c = this.characters[name];
                if (c) {
                    let wp = new THREE.Vector3();
                    c.getWorldPosition(wp);
                    centerX += wp.x;
                    centerZ += wp.z;
                    validCount++;
                }
            });
            if (validCount > 0) {
                centerX /= validCount;
                centerZ /= validCount;
            }

            this.spotLight.position.set(centerX, 20, centerZ);
            this.spotLight.target.position.set(centerX, 0, centerZ);
            this.spotLight.target.updateMatrixWorld();

            if(this.camera) {
                gsap.to(this.camera.position, {
                    x: centerX, y: 6, z: centerZ + 12, duration: 3, ease: "power2.out"
                });
                
                const lookTarget = new THREE.Vector3(0,0,0);
                gsap.to(lookTarget, {
                    x: centerX, y: 1, z: centerZ, duration: 2,
                    onUpdate: () => this.camera?.lookAt(lookTarget)
                });
            }
            globalAudio.play('boom');

        } else {
            const char = this.characters[chosenOnes[0]];
            const worldPos = new THREE.Vector3();
            char.getWorldPosition(worldPos);

            if(this.camera) {
                gsap.to(this.camera.position, {
                    x: worldPos.x, y: worldPos.y + 3, z: worldPos.z + 10, duration: 3, ease: "power2.out"
                });
                
                const lookTarget = new THREE.Vector3(0,0,0);
                gsap.to(lookTarget, {
                    x: worldPos.x, y: worldPos.y + 2, z: worldPos.z, duration: 2,
                    onUpdate: () => this.camera?.lookAt(lookTarget)
                });
            }

            globalAudio.play('win');

            gsap.to(char.position, { y: 4, yoyo: true, repeat: -1, duration: 0.5, ease: "power1.inOut" });
            gsap.to(char.rotation, { y: Math.PI * 2, repeat: -1, duration: 2, ease: "linear" });
            gsap.to([char.userData.parts.armL.rotation, char.userData.parts.armR.rotation], { x: Math.PI, duration: 0.5 });
        }
    }

    onWindowResize() {
        const container = document.getElementById(this.containerId);
        if(!container || !this.camera || !this.renderer) return;
        const width = container.clientWidth || window.innerWidth;
        const height = container.clientHeight || Math.round(window.innerHeight * 0.85);
        if (width <= 0 || height <= 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.updateCameraFraming(true);
    }

    animate() {
        if(!this.isAnimating) return;
        requestAnimationFrame(this.animate);
        
        const time = Date.now() * 0.001;
        Object.values(this.characters).forEach((char: any) => {
            if(char && char.userData?.isAlive) {
                if (char.userData.parts?.torso && !char.userData.isFallen) {
                    char.userData.parts.torso.scale.y = 1 + Math.sin(time * 3 + (char.userData.moveTime || 0)) * 0.02;
                }
                if(char.userData.isMoving && !char.userData.isFallen) {
                    const speed = char.userData.runSpeed || 15;
                    if (char.userData.parts?.legLGroup) {
                        char.userData.parts.legLGroup.rotation.x = Math.sin(time * speed) * 0.6;
                    }
                    if (char.userData.parts?.legRGroup) {
                        char.userData.parts.legRGroup.rotation.x = Math.sin(time * speed + Math.PI) * 0.6;
                    }
                    if (!char.userData.isCustomArmAnim && char.userData.parts?.armL && char.userData.parts?.armR) {
                        if (char.userData.behavior === 'crawl') {
                            const crawlSpeed = 10;
                            char.userData.parts.armL.rotation.x = -Math.PI * 0.72 + Math.sin(time * crawlSpeed) * 0.35;
                            char.userData.parts.armR.rotation.x = -Math.PI * 0.72 + Math.sin(time * crawlSpeed + Math.PI) * 0.35;
                        } else {
                            char.userData.parts.armL.rotation.x = Math.sin(time * speed + Math.PI) * 0.6;
                            char.userData.parts.armR.rotation.x = Math.sin(time * speed) * 0.6;
                        }
                    }
                } else if (char.userData.isFallen && char.userData.isMoving) {
                    // Subtle scrambling kicks while crawling on the turf
                    if (char.userData.parts?.legLGroup) {
                        char.userData.parts.legLGroup.rotation.x = Math.sin(time * 8) * 0.22;
                    }
                    if (char.userData.parts?.legRGroup) {
                        char.userData.parts.legRGroup.rotation.x = Math.sin(time * 8 + Math.PI) * 0.22;
                    }
                }
            }
        });

        this.guards.forEach((guard: any) => {
            if (guard && guard.userData) {
                const u = guard.userData;
                if (u.torso) {
                    u.torso.scale.y = 1 + Math.sin(time * 2.5 + u.idleOffset) * 0.015;
                }

                // Guard animated movement: patrol along perimeter arc with walking/marching steps
                const speed = u.patrolSpeed || 0.18;
                const dir = u.patrolDir || 1;
                const sweepAngle = Math.sin(time * speed + u.idleOffset) * 0.45 * dir;
                const currentAngle = (u.baseAngle || 0) + sweepAngle;
                const rad = (u.baseRadius || 34) + Math.cos(time * 0.8 + u.idleOffset) * 0.8;
                
                const targetX = Math.cos(currentAngle) * rad;
                const targetZ = Math.sin(currentAngle) * rad;
                guard.position.x = targetX;
                guard.position.z = targetZ;
                guard.position.y = 1.0 + Math.abs(Math.sin(time * 4 + u.idleOffset)) * 0.08;

                // Turn facing inward toward the center arena / players
                guard.lookAt(0, 1, 0);

                // Arm swing while marching/patrolling
                if (u.armL) {
                    u.armL.rotation.x = Math.sin(time * 4 + u.idleOffset) * 0.35;
                }
                if (u.armR) {
                    u.armR.rotation.x = -Math.sin(time * 4 + u.idleOffset) * 0.35;
                }

                // Leg walking / marching step motion
                if (u.legLGroup) {
                    u.legLGroup.rotation.x = -Math.sin(time * 4 + u.idleOffset) * 0.45;
                }
                if (u.legRGroup) {
                    u.legRGroup.rotation.x = Math.sin(time * 4 + u.idleOffset) * 0.45;
                }

                // Periodic head looking around
                if (u.headGroup) {
                    u.headGroup.rotation.y = Math.sin(time * 1.5 + u.idleOffset) * 0.25;
                }
            }
        });

        if (this.gameType === 'tag' && this.camera && this.tagCamTargetPos && this.tagCamTargetLook) {
            this.camera.position.lerp(this.tagCamTargetPos, 0.04);
            this.currentCamLookAt.lerp(this.tagCamTargetLook, 0.04);
            this.camera.lookAt(this.currentCamLookAt);
        }

        if (this.isStandbyActive) {
            this.updateStandbyMovement(time);
        }
        this.updateEliminationEffects(time);

        this.updateLabels();
        if(this.scene && this.camera) this.renderer?.render(this.scene, this.camera);
    }

    destroy() {
        this.isAnimating = false;
        this.cancelChase();
        this.clearEliminationEffects();
        if (this.renderer && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
        if (this.labelContainer && this.labelContainer.parentNode) {
            this.labelContainer.parentNode.removeChild(this.labelContainer);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }
        window.removeEventListener('resize', this.onWindowResize.bind(this));
    }
}

const Button = ({ children, onClick, variant = 'primary', className = '', size='md', active=false }: any) => {
    const baseStyle = "font-bold rounded-xl shadow-[0_4px_0_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_rgba(0,0,0,0)] active:translate-y-1 transition-all flex items-center justify-center gap-2";
    const variants: any = {
        primary: "bg-gradient-to-b from-rose-500 to-rose-700 text-white hover:from-rose-400 hover:to-rose-600 border-2 border-rose-800",
        success: "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:from-emerald-400 hover:to-emerald-600 border-2 border-emerald-800",
        warning: "bg-gradient-to-b from-orange-400 to-orange-600 text-white border-2 border-orange-800",
        secondary: "bg-slate-700 text-white hover:bg-slate-600 border-2 border-slate-900"
    };
    
    let activeStyle = "";
    if (active) {
        if (variant === 'primary') activeStyle = "ring-4 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.6)]";
        if (variant === 'success') activeStyle = "ring-4 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.6)]";
    }

    const sizes: any = {
        sm: "px-3 py-1 text-sm",
        md: "px-6 py-3 text-lg",
        lg: "px-10 py-5 text-2xl uppercase tracking-wider"
    };
    return (
        <button 
            onClick={() => { globalAudio?.play('click'); onClick(); }} 
            className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className} ${activeStyle}`}
        >
            {children}
        </button>
    );
};

const StudentManager = ({ students, setStudents, onBack, onViewChange }: any) => {
    const [tab, setTab] = useState<'manual' | 'classes'>('manual');
    const [input, setInput] = useState(students.join('\n'));

    // Load available classes from Class Rewards economy
    const savedClasses: DojoClass[] = useMemo(() => {
        return getSavedClasses();
    }, []);

    const [selectedClassId, setSelectedClassId] = useState<string>(() => {
        return savedClasses.length > 0 ? savedClasses[0].id : '';
    });

    const activeClass = useMemo(() => {
        return savedClasses.find(c => c.id === selectedClassId) || (savedClasses.length > 0 ? savedClasses[0] : null);
    }, [savedClasses, selectedClassId]);

    // Track checked students per class ID (Set of student names)
    const [selectedStudentNames, setSelectedStudentNames] = useState<Record<string, string[]>>(() => {
        const initialMap: Record<string, string[]> = {};
        if (savedClasses.length > 0) {
            savedClasses.forEach(cls => {
                initialMap[cls.id] = cls.students.map(s => s.name.trim()).filter(Boolean);
            });
        }
        return initialMap;
    });

    // Helper to get currently checked student names for the active class
    const currentClassCheckedNames = useMemo(() => {
        if (!activeClass) return [];
        return selectedStudentNames[activeClass.id] ?? activeClass.students.map(s => s.name.trim()).filter(Boolean);
    }, [activeClass, selectedStudentNames]);

    const handleSelectClass = (cls: DojoClass) => {
        setSelectedClassId(cls.id);
        const checkedForClass = selectedStudentNames[cls.id] ?? cls.students.map(s => s.name.trim()).filter(Boolean);
        setInput(checkedForClass.join('\n'));
        globalAudio?.play('click');
    };

    const handleToggleStudent = (studentName: string) => {
        if (!activeClass) return;
        const currentList = selectedStudentNames[activeClass.id] ?? activeClass.students.map(s => s.name.trim()).filter(Boolean);
        const exists = currentList.includes(studentName);
        const updated = exists 
            ? currentList.filter(name => name !== studentName)
            : [...currentList, studentName];

        setSelectedStudentNames(prev => ({
            ...prev,
            [activeClass.id]: updated
        }));
        setInput(updated.join('\n'));
        globalAudio?.play('click');
    };

    const handleSelectAll = (selectAll: boolean) => {
        if (!activeClass) return;
        const updated = selectAll ? activeClass.students.map(s => s.name.trim()).filter(Boolean) : [];
        setSelectedStudentNames(prev => ({
            ...prev,
            [activeClass.id]: updated
        }));
        setInput(updated.join('\n'));
        globalAudio?.play('click');
    };

    const handleSave = () => {
        const list = input
            .split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
        if (list.length > 0) {
            setStudents(list);
            localStorage.setItem('squid_roster', JSON.stringify(list));
        }
        globalAudio?.play('click');
        onBack();
    };

    const parsedCount = input.split('\n').map(s => s.trim()).filter(Boolean).length;

    return (
        <div className="flex-1 bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 flex flex-col items-center justify-center pointer-events-auto h-full overflow-y-auto z-20">
            <div className="bg-slate-900 border-2 border-slate-700 p-5 sm:p-7 rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col max-h-[90vh]">
                
                {/* HEADER - MINIMALIST */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl text-white font-bold tracking-tight">
                            Player Roster
                        </h2>
                        <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-emerald-400 border border-slate-700">
                            {parsedCount}
                        </span>
                    </div>
                    <button 
                        onClick={onBack} 
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* TABS: ENTER NAMES / CHOOSE FROM CLASSES */}
                <div className="flex items-center gap-2 my-4 p-1 bg-slate-950 rounded-2xl border border-slate-800 shrink-0">
                    <button
                        type="button"
                        onClick={() => { setTab('manual'); globalAudio?.play('click'); }}
                        className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                            tab === 'manual'
                                ? 'bg-rose-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        Enter Names
                    </button>

                    <button
                        type="button"
                        onClick={() => { 
                            setTab('classes'); 
                            globalAudio?.play('click');
                            if (activeClass) {
                                const checked = selectedStudentNames[activeClass.id] ?? activeClass.students.map(s => s.name.trim()).filter(Boolean);
                                setInput(checked.join('\n'));
                            }
                        }}
                        className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                            tab === 'classes'
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                    >
                        Choose from Classes
                    </button>
                </div>

                {/* TAB 1: ENTER NAMES - MINIMALIST */}
                {tab === 'manual' && (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <textarea
                            className="w-full h-80 min-h-[220px] bg-slate-950 text-emerald-400 p-4 rounded-2xl border border-slate-800 focus:border-rose-500 outline-none font-mono text-sm leading-relaxed resize-none shadow-inner"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Enter names..."
                            autoFocus
                        />
                    </div>
                )}

                {/* TAB 2: CHOOSE FROM CLASSES */}
                {tab === 'classes' && (
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden space-y-3">
                        {savedClasses.length === 0 ? (
                            <div className="flex-1 py-14 flex flex-col items-center justify-center text-center p-6 bg-slate-950/50 rounded-2xl border border-slate-800">
                                <GraduationCap size={40} className="text-slate-500 mb-3" />
                                <p className="text-base font-bold text-slate-200 mb-1">
                                    Please create classes on Class rewards section.
                                </p>
                                {onViewChange && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onViewChange('class-rewards' as any);
                                            onBack();
                                        }}
                                        className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md"
                                    >
                                        Go to Class Rewards
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* CLASS LIST SELECTION */}
                                <div className="space-y-2 max-h-40 overflow-y-auto pr-1 shrink-0">
                                    {savedClasses.map(cls => {
                                        const isSelected = cls.id === activeClass?.id;
                                        return (
                                            <div
                                                key={cls.id}
                                                onClick={() => handleSelectClass(cls)}
                                                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-emerald-950/40 border-emerald-500 shadow-sm'
                                                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{cls.icon}</span>
                                                    <div>
                                                        <h4 className="font-bold text-sm text-white">{cls.name}</h4>
                                                        <p className="text-xs text-slate-400">{cls.grade} • {cls.students.length} students</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isSelected ? (
                                                        <span className="text-xs font-bold text-emerald-400 px-3 py-1 rounded-xl bg-emerald-900/50 border border-emerald-700/50 flex items-center gap-1.5">
                                                            <Check size={14} className="stroke-[3]" /> Selected
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-400 px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 hover:text-white transition-colors">
                                                            Select
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* STUDENTS WITH CHECKMARKS FOR SELECTED CLASS */}
                                {activeClass && (
                                    <div className="flex-1 flex flex-col min-h-0 bg-slate-950/70 rounded-2xl border border-slate-800/80 p-3 overflow-hidden">
                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/60 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-300">
                                                    {activeClass.name} Students
                                                </span>
                                                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/50">
                                                    {currentClassCheckedNames.length} / {activeClass.students.length}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectAll(true)}
                                                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                                                >
                                                    Check all
                                                </button>
                                                <span className="text-slate-600 text-xs">•</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectAll(false)}
                                                    className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                                                >
                                                    Uncheck all
                                                </button>
                                            </div>
                                        </div>

                                        {activeClass.students.length === 0 ? (
                                            <p className="text-xs text-slate-500 text-center py-6">No students found in this class.</p>
                                        ) : (
                                            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                {activeClass.students.map((student) => {
                                                    const isChecked = currentClassCheckedNames.includes(student.name.trim());
                                                    return (
                                                        <div
                                                            key={student.id}
                                                            onClick={() => handleToggleStudent(student.name.trim())}
                                                            className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all ${
                                                                isChecked
                                                                    ? 'bg-emerald-950/30 border-emerald-600/50 text-white'
                                                                    : 'bg-slate-900/40 border-slate-800/60 text-slate-400 hover:border-slate-700'
                                                            }`}
                                                        >
                                                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                                                                isChecked
                                                                    ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                                                    : 'border-slate-600 bg-slate-950'
                                                            }`}>
                                                                {isChecked && <Check size={12} className="stroke-[3]" />}
                                                            </div>
                                                            <span className="text-xs font-medium truncate flex-1">
                                                                {student.name}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                                                #{student.number || student.name.match(/\d+/)?.[0] || '—'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* FOOTER */}
                <div className="pt-4 mt-4 border-t border-slate-800 shrink-0 flex items-center justify-end gap-3">
                    <Button variant="secondary" onClick={onBack}>Cancel</Button>
                    <Button variant="success" onClick={handleSave}>
                        <Check className="w-4 h-4" /> Update Roster
                    </Button>
                </div>

            </div>
        </div>
    );
};

const TagMusicPlayer = ({ isPlaying, isMuted, volume = 80 }: { isPlaying: boolean; isMuted: boolean; volume?: number }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mounted, setMounted] = useState(false);

    const sendCommand = (func: string, args: any[] = []) => {
        if (!iframeRef.current?.contentWindow) return;
        try {
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func, args }),
                '*'
            );
        } catch {
            // Ignore cross-origin warnings
        }
    };

    useEffect(() => {
        if (isPlaying) {
            setMounted(true);
        }
    }, [isPlaying]);

    const handleIframeLoad = () => {
        if (isPlaying && !isMuted && volume > 0) {
            sendCommand('unMute');
            sendCommand('setVolume', [volume]);
            sendCommand('playVideo');
        } else if (isPlaying && (isMuted || volume === 0)) {
            sendCommand('mute');
            sendCommand('playVideo');
        } else {
            sendCommand('pauseVideo');
        }
    };

    useEffect(() => {
        if (!iframeRef.current || !mounted) return;
        if (isPlaying && !isMuted && volume > 0) {
            sendCommand('unMute');
            sendCommand('setVolume', [volume]);
            sendCommand('playVideo');
        } else if (isPlaying && (isMuted || volume === 0)) {
            sendCommand('mute');
            sendCommand('playVideo');
        } else {
            sendCommand('pauseVideo');
        }
    }, [isPlaying, isMuted, volume, mounted]);

    if (!mounted) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: -9999,
                left: -9999,
                width: '320px',
                height: '240px',
                pointerEvents: 'none',
                opacity: 0.001,
                zIndex: -999
            }}
            aria-hidden="true"
        >
            <iframe
                ref={iframeRef}
                width="320"
                height="240"
                src="https://www.youtube-nocookie.com/embed/ENWFOepUlFw?enablejsapi=1&autoplay=1&loop=1&playlist=ENWFOepUlFw&controls=0&disablekb=1&fs=0&playsinline=1"
                title="Tag Soundtrack"
                allow="autoplay; encrypted-media"
                style={{ border: 0 }}
                onLoad={handleIframeLoad}
            />
        </div>
    );
};

const MingleMusicPlayer = ({ isPlaying, isMuted, volume = 80 }: { isPlaying: boolean; isMuted: boolean; volume?: number }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [mounted, setMounted] = useState(false);

    const sendCommand = (func: string, args: any[] = []) => {
        if (!iframeRef.current?.contentWindow) return;
        try {
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: 'command', func, args }),
                '*'
            );
        } catch {
            // Ignore cross-origin warnings
        }
    };

    useEffect(() => {
        if (isPlaying) {
            setMounted(true);
        }
    }, [isPlaying]);

    const handleIframeLoad = () => {
        if (isPlaying && !isMuted && volume > 0) {
            sendCommand('unMute');
            sendCommand('setVolume', [volume]);
            sendCommand('playVideo');
        } else if (isPlaying && (isMuted || volume === 0)) {
            sendCommand('mute');
            sendCommand('playVideo');
        } else {
            sendCommand('pauseVideo');
        }
    };

    useEffect(() => {
        if (!iframeRef.current || !mounted) return;
        if (isPlaying && !isMuted && volume > 0) {
            sendCommand('unMute');
            sendCommand('setVolume', [volume]);
            sendCommand('playVideo');
        } else if (isPlaying && (isMuted || volume === 0)) {
            sendCommand('mute');
            sendCommand('playVideo');
        } else {
            sendCommand('pauseVideo');
        }
    }, [isPlaying, isMuted, volume, mounted]);

    if (!mounted) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: -9999,
                left: -9999,
                width: '320px',
                height: '240px',
                pointerEvents: 'none',
                opacity: 0.001,
                zIndex: -999
            }}
            aria-hidden="true"
        >
            <iframe
                id="yt-player"
                ref={iframeRef}
                width="320"
                height="240"
                src="https://www.youtube-nocookie.com/embed/SbAKYgfYET8?enablejsapi=1&autoplay=1&loop=1&playlist=SbAKYgfYET8&controls=0&disablekb=1&fs=0&playsinline=1"
                title="Mingle Soundtrack"
                allow="autoplay; encrypted-media"
                style={{ border: 0 }}
                onLoad={handleIframeLoad}
            />
        </div>
    );
};

interface SquidGamePickerProps {
    onViewChange?: (view: ViewState) => void;
}

export default function SquidGamePicker({ onViewChange }: SquidGamePickerProps) {
    const [view, setView] = useState('home'); 
    const [activeGame, setActiveGame] = useState<'mingle' | 'tag'>('mingle');
    const [students, setStudents] = useState<string[]>(getSavedRoster());
    const [gameState, setGameState] = useState<any>({ phase: 'IDLE', msg: '', eliminatedThisRound: [], isMusicPlaying: false }); 
    const [chosenOnes, setChosenOnes] = useState<string[]>([]);
    const [totalEliminated, setTotalEliminated] = useState(0);
    const [gameMode, setGameMode] = useState('picker');
    const [pickCount, setPickCount] = useState(1);
    const [tagTimer, setTagTimer] = useState<number>(15);
    
    // Mingle game is strictly picker mode - never survival
    useEffect(() => {
        if (activeGame === 'mingle' && gameMode !== 'picker') {
            setGameMode('picker');
        }
    }, [activeGame, gameMode]);

    const threeManagerRef = useRef<ThreeManager | null>(null);
    const isFirstMountRef = useRef(true);
    const isAudioMuted = useRef(false);
    const [muteUI, setMuteUI] = useState(false);
    const [volume, setVolume] = useState<number>(80);
    const [showVolumeSlider, setShowVolumeSlider] = useState<boolean>(false);
    const gameVolumeRef = useRef<HTMLDivElement>(null);
    const homeVolumeRef = useRef<HTMLDivElement>(null);
    const nextRoundResolverRef = useRef<(() => void) | null>(null);

    const handleVolumeChange = (newVal: number) => {
        setVolume(newVal);
        if (newVal === 0) {
            setMuteUI(true);
            if (globalAudio) globalAudio.setMuted(true);
        } else {
            if (muteUI) {
                setMuteUI(false);
                if (globalAudio) globalAudio.setMuted(false);
            }
            if (globalAudio) globalAudio.setVolume(newVal / 100);
        }
    };

    const toggleMute = () => {
        if (muteUI || volume === 0) {
            setMuteUI(false);
            if (globalAudio) globalAudio.setMuted(false);
            if (volume === 0) {
                setVolume(80);
                if (globalAudio) globalAudio.setVolume(0.8);
            } else {
                if (globalAudio) globalAudio.setVolume(volume / 100);
            }
        } else {
            setMuteUI(true);
            if (globalAudio) globalAudio.setMuted(true);
        }
    };

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                (!gameVolumeRef.current || !gameVolumeRef.current.contains(target)) &&
                (!homeVolumeRef.current || !homeVolumeRef.current.contains(target))
            ) {
                setShowVolumeSlider(false);
            }
        };
        if (showVolumeSlider) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showVolumeSlider]);

    useEffect(() => {
        if (!globalAudio) {
            globalAudio = new AudioEngine();
        }
        
        const tm = new ThreeManager('canvas-container');
        tm.init((stateUpdate: any) => {
            setGameState((prev: any) => ({...prev, ...stateUpdate}));
        });
        threeManagerRef.current = tm;
        tm.spawnPlayers(students);
        
        return () => {
            if (threeManagerRef.current) {
                threeManagerRef.current.destroy();
                threeManagerRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (isFirstMountRef.current) {
            isFirstMountRef.current = false;
            return;
        }
        if(view === 'home' && threeManagerRef.current && gameState.phase === 'IDLE') {
            threeManagerRef.current.setGameType(activeGame);
            threeManagerRef.current.spawnPlayers(students);
        }
    }, [students, view, gameState.phase, activeGame]);
    
    useEffect(() => {
        if (gameState.eliminatedThisRound && gameState.eliminatedThisRound.length > 0) {
             setTotalEliminated(prev => prev + gameState.eliminatedThisRound.length);
        }
    }, [gameState.eliminatedThisRound]);

    useEffect(() => {
        const timeouts: (ReturnType<typeof setTimeout>)[] = [];
        // Only announce if there are 3 or fewer players eliminated to prevent auditory overload
        if (gameState.phase === 'WINNER' && gameMode === 'picker') {
            if (chosenOnes.length <= 3) {
                chosenOnes.forEach((name, idx) => {
                    timeouts.push(setTimeout(() => {
                        const pNum = getPlayerNumber(name);
                        announce(`Player ${pNum}, eliminated.`);
                    }, idx * 1500));
                });
            }
        } else if (gameState.phase === 'ELIMINATED' && gameMode === 'survival') {
            if (gameState.eliminatedThisRound && gameState.eliminatedThisRound.length > 0 && gameState.eliminatedThisRound.length <= 3) {
                gameState.eliminatedThisRound.forEach((name: string, idx: number) => {
                    timeouts.push(setTimeout(() => {
                        const pNum = getPlayerNumber(name);
                        announce(`Player ${pNum}, eliminated.`);
                    }, idx * 1500));
                });
            }
        }
        return () => {
            timeouts.forEach(clearTimeout);
            stopAnnounce();
        };
    }, [gameState.phase, chosenOnes, gameMode, students, gameState.eliminatedThisRound]);

    useEffect(() => {
        if (view !== 'game') {
            stopAnnounce();
        }
    }, [view]);

    useEffect(() => {
        return () => {
            stopAnnounce();
        };
    }, []);

    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                const elem = document.getElementById('squid-picker-root') || document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                }
            }
        } catch (err) {
            console.error("Error attempting to toggle fullscreen:", err);
            try {
                if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (e) {
                console.error("Fallback fullscreen error:", e);
            }
        }
    };

    const startGameWith = async (roster: string[]) => {
        stopAnnounce();
        const currentMode = activeGame === 'mingle' ? 'picker' : gameMode;
        if(roster.length < (currentMode === 'picker' ? pickCount + 1 : 2)) {
            alert(`Need at least ${currentMode === 'picker' ? pickCount + 1 : 2} players for this mode!`);
            setView('home');
            return;
        }
        if (globalAudio) globalAudio.resume(); 
        setView('game');
        setChosenOnes([]);
        setTotalEliminated(0);
        setGameState({ phase: 'SETUP', msg: 'GET READY', eliminatedThisRound: [], isMusicPlaying: false });
        
        const tm = threeManagerRef.current;
        if(!tm) return;
        
        // Reset Tag and Mingle round state when starting
        tm.lastCaughtPlayer = null;
        tm.tagRoundCount = 0;
        tm.mingleSpinCount = 0;
        tm.setTagTimer(tagTimer);
        
        // Spawn players before starting sequence in proper game type
        tm.setGameType(activeGame);
        tm.spawnPlayers(roster);
        if(tm.ambientLight) tm.ambientLight.intensity = activeGame === 'tag' ? 0.6 : 0.7;
        if(tm.dirLight) tm.dirLight.intensity = activeGame === 'tag' ? 0.8 : tm.baseLightIntensity;
        if(tm.spotLight) tm.spotLight.intensity = 0;
        if(tm.scene) tm.scene.background = new THREE.Color(activeGame === 'tag' ? '#38bdf8' : '#87CEEB'); 

        const engine = GameEngine.generateGameSequence(roster, currentMode, pickCount);
        
        for (let i = 0; i < engine.rounds.length; i++) {
            const round = engine.rounds[i];
            
            await tm.playRound(round);
            
            if (i < engine.rounds.length - 1) {
                 tm.isStandbyActive = true;
                 setGameState({ 
                     phase: 'ROUND_INTERMISSION', 
                     msg: `${round.survivors.length} PLAYERS REMAIN`, 
                     eliminatedThisRound: round.eliminated, 
                     isMusicPlaying: false,
                     nextRoundNum: round.roundNum + 1,
                     totalRounds: engine.rounds.length
                 });
                 
                 // Wait for user to explicitly click to start next round!
                 await new Promise<void>(resolve => {
                     nextRoundResolverRef.current = resolve;
                 });
                 tm.stopStandbyMode();
            }
        }

        setChosenOnes(engine.chosenOnes);
        await tm.playWinnerSequence(engine.chosenOnes, engine.mode);
    };

    const startGame = async () => startGameWith(students);

    
    const continueGame = () => {
        stopAnnounce();
        // Remove eliminated players from the students roster
        const remainingStudents = students.filter(s => !chosenOnes.includes(s));
        setStudents(remainingStudents);
        localStorage.setItem('squid_roster', JSON.stringify(remainingStudents));
        
        if (gameMode === 'picker') {
            startGameWith(remainingStudents);
        } else {
            // Reset the game back to the home screen ready for the next round
            setGameState({ phase: 'IDLE', msg: '', eliminatedThisRound: [], isMusicPlaying: false });
            setView('home');
            setChosenOnes([]);
            setTotalEliminated(0);
            if (threeManagerRef.current) {
                threeManagerRef.current.lastCaughtPlayer = null;
                threeManagerRef.current.tagRoundCount = 0;
                threeManagerRef.current.setGameType(activeGame);
                threeManagerRef.current.spawnPlayers(remainingStudents);
            }
        }
    };

    const resetGame = () => {
        stopAnnounce();
        if (nextRoundResolverRef.current) {
            nextRoundResolverRef.current();
            nextRoundResolverRef.current = null;
        }
        setGameState({ phase: 'IDLE', msg: '', eliminatedThisRound: [], isMusicPlaying: false });
        setView('home');
        setChosenOnes([]);
        setTotalEliminated(0);
        if (threeManagerRef.current) {
            threeManagerRef.current.cancelChase();
            threeManagerRef.current.lastCaughtPlayer = null;
            threeManagerRef.current.tagRoundCount = 0;
            threeManagerRef.current.setGameType(activeGame);
            threeManagerRef.current.spawnPlayers(students);
        }
    };

    const renderHome = () => (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-sm pointer-events-auto z-20">
            <div className="text-center bg-slate-900/95 p-10 rounded-[3rem] border-4 border-rose-600 shadow-[0_0_60px_rgba(244,63,94,0.4)] relative overflow-hidden w-full max-w-xl">
                
                <div className="text-5xl mb-4 text-rose-500 flex justify-center gap-6 relative z-10 items-center">
                    <Circle className="w-12 h-12 animate-pulse" />
                    <Triangle className="w-12 h-12 animate-pulse" style={{animationDelay: '0.3s'}} />
                    <Square className="w-12 h-12 animate-pulse" style={{animationDelay: '0.6s'}} />
                </div>
                <h1 className="text-5xl text-white font-bold mb-2 tracking-wide text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 relative z-10" style={{fontFamily: "'Fredoka', sans-serif"}}>
                    {activeGame === 'tag' ? 'TAG' : 'MINGLE'} <span className="text-rose-500">GAME</span>
                </h1>
                <p className="text-lg text-emerald-400 mb-8 font-medium tracking-widest uppercase relative z-10">
                    {activeGame === 'tag' ? 'Tag • Will your number be called?' : 'Mingle Game • Will your number be called?'}
                </p>
                
                <div className="bg-slate-800/80 rounded-2xl p-4 mb-8 border border-slate-700">
                    {activeGame === 'tag' && (
                        <div className="flex gap-4 justify-center mb-4">
                            <Button 
                                variant={gameMode === 'picker' ? 'primary' : 'secondary'} 
                                onClick={() => setGameMode('picker')} 
                                active={gameMode === 'picker'}
                                className="flex-1 text-sm py-2"
                            >
                                <MousePointerClick className="w-4 h-4" /> Tag Picker
                            </Button>
                            <Button 
                                variant={gameMode === 'survival' ? 'success' : 'secondary'} 
                                onClick={() => setGameMode('survival')} 
                                active={gameMode === 'survival'}
                                className="flex-1 text-sm py-2"
                            >
                                <Tag className="w-4 h-4" /> Tag Survival
                            </Button>
                        </div>
                    )}
                    
                    {(activeGame === 'mingle' || gameMode === 'picker') && (
                        <div className="flex flex-col gap-2 bg-slate-900 p-4 rounded-xl border border-slate-700/50">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 font-bold text-sm uppercase tracking-wider">Targets:</span>
                                <span className="text-rose-500 font-bold text-xl bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 shadow-inner">{pickCount}</span>
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={pickCount} 
                                onChange={(e) => setPickCount(parseInt(e.target.value))}
                                className="w-full mt-2 accent-rose-600 cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-slate-500 font-bold px-1 mt-1">
                                <span>1</span>
                                <span>10</span>
                            </div>
                        </div>
                    )}
                    {activeGame === 'tag' && (
                        <div className="flex flex-col gap-2 bg-slate-900 p-4 rounded-xl border border-slate-700/50">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-300 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-amber-400" />
                                    Chase Timer:
                                </span>
                                <span className="text-amber-400 font-bold text-lg bg-slate-800 px-3 py-1 rounded-lg border border-slate-700 shadow-inner">
                                    {tagTimer === 60 ? '1 Min' : `${tagTimer}s`}
                                </span>
                            </div>
                            <input 
                                type="range" 
                                min="5" 
                                max="60" 
                                step="5"
                                value={tagTimer} 
                                onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    setTagTimer(val);
                                    threeManagerRef.current?.setTagTimer(val);
                                }}
                                className="w-full mt-2 accent-amber-500 cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-slate-500 font-bold px-1 mt-1">
                                <span>5s</span>
                                <span>30s</span>
                                <span>60s (1 min)</span>
                            </div>
                        </div>
                    )}
                    {activeGame === 'tag' && gameMode === 'survival' && (
                        <div className="text-emerald-400 text-sm font-bold tracking-widest py-2">
                            MULTIPLE ROUNDS • ONE SOLE SURVIVOR
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-4 items-center relative z-10">
                    <Button size="lg" onClick={startGame} className="w-full">
                        <Play className="w-6 h-6" /> START
                    </Button>
                    <Button variant="secondary" onClick={() => setView('students')} className="w-full">
                        <UserRound className="w-5 h-5" /> MANAGE ROSTER ({students.length})
                    </Button>
                </div>
            </div>
        </div>
    );

    const renderGameUI = () => (
        <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between">
            <div className="flex justify-between items-start p-6">
                <div className="flex gap-4 pointer-events-auto">
                    <div className="bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-2xl border-2 border-slate-700 shadow-lg flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-emerald-400 text-xs font-bold tracking-widest mb-1 uppercase">Players Alive</div>
                            <div className="text-4xl font-bold text-white leading-none" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                {gameState.phase === 'WINNER' ? (gameMode === 'survival' ? 1 : (threeManagerRef.current?.currentRoundData?.activePlayers.length || students.length) - pickCount) : 
                                 threeManagerRef.current?.currentRoundData?.activePlayers.length || students.length}
                            </div>
                        </div>
                    </div>
                    <div className="bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-2xl border-2 border-slate-700 shadow-lg flex items-center gap-4">
                        <div className="text-center">
                            <div className="text-rose-500 text-xs font-bold tracking-widest mb-1 uppercase">Eliminated</div>
                            <div className="text-4xl font-bold text-white leading-none" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                {totalEliminated}
                            </div>
                        </div>
                    </div>
                    {activeGame === 'tag' && gameState.chaseSecondsLeft !== undefined && (
                        <div className="bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-2xl border-2 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.35)] flex items-center gap-4">
                            <div className="text-center">
                                <div className="text-amber-400 text-xs font-bold tracking-widest mb-1 uppercase flex items-center justify-center gap-1.5">
                                    <Clock className={`w-3.5 h-3.5 ${gameState.chaseSecondsLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`} />
                                    Chase Timer
                                </div>
                                <div className={`text-4xl font-bold leading-none ${gameState.chaseSecondsLeft <= 5 ? 'text-rose-500 animate-pulse' : 'text-amber-300'}`} style={{fontFamily: "'Fredoka', sans-serif"}}>
                                    {gameState.chaseSecondsLeft}s
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="flex gap-3 pointer-events-auto">
                    <button 
                        onClick={toggleFullscreen} 
                        className="w-12 h-12 bg-slate-900/90 rounded-full text-white hover:bg-slate-700 transition border-2 border-slate-700 flex items-center justify-center shadow-lg"
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        {isFullscreen ? <Minimize className="w-5 h-5 text-emerald-400" /> : <Maximize className="w-5 h-5 text-slate-200" />}
                    </button>

                    <div className="relative" ref={gameVolumeRef}>
                        <button
                            onClick={() => setShowVolumeSlider(prev => !prev)}
                            className={`w-12 h-12 bg-slate-900/90 rounded-full transition border-2 flex items-center justify-center shadow-lg ${
                                showVolumeSlider
                                    ? 'border-emerald-400 bg-slate-800 text-emerald-400 ring-2 ring-emerald-500/30'
                                    : muteUI || volume === 0
                                    ? 'border-red-900/70 text-red-500 hover:bg-slate-800'
                                    : 'border-slate-700 text-emerald-400 hover:text-white hover:bg-slate-700'
                            }`}
                            title="Volume Control"
                        >
                            {muteUI || volume === 0 ? (
                                <VolumeX className="w-5 h-5 text-red-500" />
                            ) : volume < 40 ? (
                                <Volume1 className="w-5 h-5 text-emerald-400" />
                            ) : (
                                <Volume2 className="w-5 h-5 text-emerald-400" />
                            )}
                        </button>

                        {showVolumeSlider && (
                            <div className="absolute right-0 top-14 bg-slate-900/95 backdrop-blur-md border-2 border-slate-700 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={toggleMute}
                                    className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                                    title={muteUI || volume === 0 ? "Unmute" : "Mute"}
                                >
                                    {muteUI || volume === 0 ? (
                                        <VolumeX className="w-4 h-4 text-red-400" />
                                    ) : (
                                        <Volume2 className="w-4 h-4 text-emerald-400" />
                                    )}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={muteUI ? 0 : volume}
                                    onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                    className="w-28 sm:w-36 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                                />
                                <span className="text-xs font-bold text-slate-300 w-8 text-right font-mono select-none">
                                    {muteUI ? '0%' : `${volume}%`}
                                </span>
                            </div>
                        )}
                    </div>

                    <button onClick={resetGame} className="w-12 h-12 bg-slate-900/90 rounded-full text-white hover:bg-rose-600 hover:border-rose-700 transition border-2 border-slate-700 flex items-center justify-center shadow-lg" title="Reset Game">
                        <Power />
                    </button>
                </div>
            </div>

            {/* Full-screen Danger Vignette during Elimination */}
            {gameState.phase === 'ELIMINATED' && (
                <div className="absolute inset-0 pointer-events-none z-30 shadow-[inset_0_0_140px_rgba(244,63,94,0.75)] animate-pulse" />
            )}

            {/* Corner eliminated roster widget */}
            {gameState.eliminatedThisRound && gameState.eliminatedThisRound.length > 0 && gameState.phase !== 'ELIMINATED' && (
                <div className="absolute right-6 top-1/4 w-72 flex flex-col gap-2 pointer-events-none z-20">
                    {gameState.eliminatedThisRound.map((name: string, idx: number) => {
                        const playerNum = getPlayerNumber(name);
                        return (
                            <div key={idx} className="bg-slate-900/90 border-l-4 border-rose-500 text-white p-3 rounded-r-lg shadow-lg flex items-center gap-3 transition-all" style={{animation: 'fade-in-right 0.3s ease-out forwards', animationDelay: `${idx * 0.1}s`, opacity: 0, transform: 'translateX(20px)'}}>
                                <Skull className="text-rose-500 w-5 h-5" />
                                <div>
                                    <span className="font-mono text-emerald-400 font-bold mr-2">#{playerNum}</span>
                                    <span className="text-sm font-semibold">{name}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fade-in-right {
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes stamp-slam {
                    0% { opacity: 0; transform: scale(2.2) rotate(-28deg); }
                    70% { transform: scale(0.95) rotate(-10deg); }
                    100% { opacity: 1; transform: scale(1) rotate(-12deg); }
                }
            `}} />

            {gameState.msg && gameState.phase !== 'WINNER' && (
                <div className="absolute top-24 left-1/2 transform -translate-x-1/2 w-full text-center pointer-events-none z-30 flex flex-col items-center gap-3 px-4">
                    <div className="inline-block bg-slate-900/90 backdrop-blur-md border-b-4 border-rose-600 px-8 py-3 rounded-xl shadow-[0_10px_40px_rgba(244,63,94,0.4)]">
                        <h2 className="text-2xl md:text-4xl text-white tracking-widest uppercase drop-shadow-md font-bold" style={{fontFamily: "'Fredoka', sans-serif"}}>
                            {gameState.msg}
                        </h2>
                    </div>

                    {/* Mingle Door Selection Urgency 10s Countdown Timer Visual */}
                    {activeGame === 'mingle' && gameState.phase === 'DOORS' && gameState.chaseSecondsLeft !== undefined && (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-200">
                            <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl border-2 backdrop-blur-md transition-all duration-300 shadow-2xl ${
                                gameState.chaseSecondsLeft <= 3 
                                    ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_40px_rgba(244,63,94,0.8)] scale-110 animate-bounce' 
                                    : gameState.chaseSecondsLeft <= 5
                                    ? 'bg-amber-950/90 border-amber-500 text-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.6)] animate-pulse'
                                    : 'bg-slate-900/90 border-emerald-500/70 text-emerald-300 shadow-[0_0_25px_rgba(16,185,129,0.4)]'
                            }`}>
                                <div className="flex items-center gap-2">
                                    <Clock className={`w-6 h-6 ${
                                        gameState.chaseSecondsLeft <= 3 ? 'text-rose-400 animate-spin' : gameState.chaseSecondsLeft <= 5 ? 'text-amber-400 animate-pulse' : 'text-emerald-400'
                                    }`} />
                                    <span className="text-xs uppercase tracking-widest font-black" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                        DOORS CLOSING IN
                                    </span>
                                </div>
                                <div className={`text-4xl md:text-5xl font-black font-mono leading-none tracking-tight ${
                                    gameState.chaseSecondsLeft <= 3 ? 'text-rose-400' : gameState.chaseSecondsLeft <= 5 ? 'text-amber-300' : 'text-emerald-300'
                                }`}>
                                    00:0{gameState.chaseSecondsLeft}
                                </div>
                            </div>

                            {/* Urgency Progress Bar */}
                            <div className="w-56 md:w-72 h-2.5 bg-slate-900/80 rounded-full border border-slate-700 overflow-hidden mt-1 p-0.5 shadow-inner">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                        gameState.chaseSecondsLeft <= 3 
                                            ? 'bg-gradient-to-r from-red-600 to-rose-500' 
                                            : gameState.chaseSecondsLeft <= 5 
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                            : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                    }`}
                                    style={{ width: `${Math.max(0, Math.min(100, (gameState.chaseSecondsLeft / 10) * 100))}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tag in-game manual start button: only clicks start chase & music */}
            {activeGame === 'tag' && gameState.phase === 'TAG_READY' && (
                <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 pointer-events-auto z-30 flex flex-col items-center">
                    <button
                        onClick={() => threeManagerRef.current?.startTagChase()}
                        className="px-10 py-4 bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white rounded-2xl font-black text-2xl tracking-wider shadow-[0_0_50px_rgba(244,63,94,0.7)] border-4 border-rose-300/80 flex items-center gap-3 active:scale-95 hover:scale-105 transition-all cursor-pointer animate-pulse"
                        style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                        <Play className="w-8 h-8 fill-white text-white" />
                        START CHASE
                    </button>
                </div>
            )}

            {/* Mingle in-game manual spin button: only clicks start platform spin & music */}
            {activeGame === 'mingle' && gameState.phase === 'SPINNING' && (
                <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 pointer-events-auto z-30 flex flex-col items-center">
                    <button
                        onClick={() => threeManagerRef.current?.manualSpin()}
                        className="px-10 py-4 bg-gradient-to-r from-rose-600 via-emerald-600 to-teal-500 hover:from-rose-500 hover:to-emerald-400 text-white rounded-2xl font-black text-2xl tracking-wider shadow-[0_0_50px_rgba(244,63,94,0.7)] border-4 border-rose-300/80 flex items-center gap-3 active:scale-95 hover:scale-105 transition-all cursor-pointer animate-pulse"
                        style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                        <Play className="w-8 h-8 fill-white text-white" />
                        CLICK TO SPIN
                    </button>
                </div>
            )}

            {/* Intermission button: between rounds, click to advance to the next round */}
            {gameState.phase === 'ROUND_INTERMISSION' && (
                <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 pointer-events-auto z-30 flex flex-col items-center">
                    <button
                        onClick={() => {
                            if (nextRoundResolverRef.current) {
                                const res = nextRoundResolverRef.current;
                                nextRoundResolverRef.current = null;
                                res();
                            }
                        }}
                        className="px-10 py-4 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500 hover:from-emerald-500 hover:to-cyan-400 text-white rounded-2xl font-black text-2xl tracking-wider shadow-[0_0_50px_rgba(16,185,129,0.7)] border-4 border-emerald-300/80 flex items-center gap-3 active:scale-95 hover:scale-105 transition-all cursor-pointer animate-pulse"
                        style={{ fontFamily: "'Fredoka', sans-serif" }}
                    >
                        <Play className="w-8 h-8 fill-white text-white" />
                        START ROUND {gameState.nextRoundNum || ''}
                    </button>
                </div>
            )}

            {gameState.phase === 'WINNER' && (
                <div className="absolute inset-0 z-40 flex items-center justify-center p-4 sm:p-6 md:p-8 pointer-events-auto">
                    <div className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900/95 border-4 border-rose-600 p-6 sm:p-8 md:p-10 rounded-[2rem] shadow-[0_0_100px_rgba(244,63,94,0.6)] relative overflow-hidden transition-transform animate-fade-in backdrop-blur-xl">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-900/30 to-transparent pointer-events-none"></div>
                        
                        <div className="text-rose-500 text-5xl sm:text-6xl mb-2 relative z-10 flex justify-center shrink-0">
                            {gameMode === 'picker' ? <Skull className="w-12 h-12 sm:w-16 sm:h-16" /> : <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-emerald-400" />}
                        </div>
                        
                        <h2 className="text-xl sm:text-2xl text-emerald-400 font-bold mb-4 tracking-widest text-center uppercase relative z-10 shrink-0">
                            {gameMode === 'picker' ? (chosenOnes.length > 1 ? `${chosenOnes.length} PLAYERS ELIMINATED` : 'PLAYER ELIMINATED') : 'SOLE SURVIVOR'}
                        </h2>
                        
                        <div className={`grid gap-3 sm:gap-4 my-2 relative z-10 overflow-y-auto pr-1 max-h-[58vh] ${
                            chosenOnes.length === 1 
                                ? 'grid-cols-1 max-w-xl mx-auto w-full' 
                                : chosenOnes.length <= 4 
                                    ? 'grid-cols-1 sm:grid-cols-2' 
                                    : chosenOnes.length <= 8 
                                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                        }`}>
                            {chosenOnes.map((name, i) => {
                                const playerNum = getPlayerNumber(name);
                                const playerAvatar = threeManagerRef.current?.getPlayerAvatar(name, playerNum) || 
                                                     generateStaticPlayerAvatar(name, playerNum);
                                return (
                                    <div key={i} className={`flex items-center gap-3.5 bg-slate-950/85 rounded-2xl border-2 border-slate-700/80 shadow-lg backdrop-blur-md transition-all hover:border-rose-500/60 ${
                                        chosenOnes.length <= 2 ? 'p-5 sm:p-6' : chosenOnes.length <= 6 ? 'p-3.5 sm:p-4' : 'p-2.5 sm:p-3'
                                    }`}>
                                        <div className={`shrink-0 rounded-xl bg-slate-900 border-2 overflow-hidden flex items-center justify-center relative shadow-md ${
                                            gameMode === "picker" ? "border-rose-500" : "border-emerald-500"
                                        } ${
                                            chosenOnes.length <= 2 
                                                ? 'w-20 h-20 sm:w-24 sm:h-24' 
                                                : chosenOnes.length <= 6 
                                                    ? 'w-14 h-14 sm:w-16 sm:h-16' 
                                                    : 'w-11 h-11 sm:w-12 sm:h-12'
                                        }`}>
                                            <img src={playerAvatar} alt={name} className="w-full h-full object-cover" />
                                            <div className="absolute bottom-0.5 right-0.5 bg-black/85 backdrop-blur-sm border border-emerald-500/50 px-1 py-0.2 rounded text-[9px] font-mono font-bold text-emerald-400">
                                                #{playerNum}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="text-[11px] sm:text-xs text-rose-300 font-bold tracking-widest uppercase truncate">
                                                PLAYER #{playerNum}
                                            </div>
                                            <div className={`text-white font-bold truncate tracking-wide ${
                                                chosenOnes.length <= 2 
                                                    ? 'text-2xl sm:text-3xl' 
                                                    : chosenOnes.length <= 6 
                                                        ? 'text-lg sm:text-xl' 
                                                        : 'text-sm sm:text-base'
                                            }`} style={{fontFamily: "'Fredoka', sans-serif"}}>
                                                {name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="pt-4 mt-auto relative z-10 shrink-0">
                            <Button size="lg" variant={gameMode === 'picker' ? 'primary' : 'success'} onClick={continueGame} className="mx-auto w-full shadow-[0_0_30px_rgba(16,185,129,0.5)] uppercase tracking-widest text-lg sm:text-xl h-14 sm:h-16 rounded-2xl font-black">
                                <RotateCcw className="w-6 h-6 mr-3" /> CONTINUE
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div 
            id="squid-picker-root" 
            className={`w-full bg-[#0f172a] text-slate-100 flex relative overflow-hidden transition-all duration-300 ${
                isFullscreen 
                    ? 'fixed inset-0 z-50 h-screen w-screen rounded-none' 
                    : 'min-h-[85vh] h-[85vh] rounded-3xl shadow-2xl border border-slate-800'
            }`}
        >
            {/* Absolute positioning for the Three.js canvas so it stays under the UI layer and takes full space */}
            <div id="canvas-container" className="absolute inset-0 z-10" />

            {/* YouTube Audio Player for Tag Game */}
            {activeGame === 'tag' && (
                <TagMusicPlayer
                    isPlaying={!muteUI && volume > 0 && Boolean(gameState.isMusicPlaying) && view === 'game'}
                    isMuted={muteUI || volume === 0}
                    volume={volume}
                />
            )}

            {/* YouTube Audio Player for Mingle Game */}
            {activeGame === 'mingle' && (
                <MingleMusicPlayer
                    isPlaying={!muteUI && volume > 0 && Boolean(gameState.isMusicPlaying) && view === 'game'}
                    isMuted={muteUI || volume === 0}
                    volume={volume}
                />
            )}

            {/* UI Layer wrapper - must have pointer-events-none so interactions pass through to canvas if needed (except for the sidebar) */}
            <div id="ui-layer" className="absolute inset-0 z-20 flex font-sans text-slate-100 pointer-events-none">
                
                {(view === 'home' || view === 'students') && (
                    <div className="w-72 bg-slate-900/95 backdrop-blur border-r border-slate-700 flex flex-col pointer-events-auto shadow-2xl z-30">
                        <div className="p-8 border-b border-slate-800 flex items-center gap-4">
                            <div className="w-12 h-12 bg-rose-600 rounded-xl flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                                {activeGame === 'tag' ? <Tag className="text-white w-6 h-6" /> : <Square className="text-white w-6 h-6" />}
                            </div>
                            <div>
                                <h2 className="font-bold text-2xl leading-none text-white tracking-wide" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                    {activeGame === 'tag' ? 'TAG' : 'MINGLE'}<br/><span className="text-rose-500">GAME</span>
                                </h2>
                                <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase block mt-1">
                                    {activeGame === 'tag' ? 'Tag Active' : 'Mingle Active'}
                                </span>
                            </div>
                        </div>
                        
                        <nav className="flex-1 p-6 flex flex-col gap-3">
                            <button 
                                onClick={() => setView('students')} 
                                className={`flex items-center gap-4 p-4 rounded-xl transition font-medium ${view === 'students' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                                title="Player Roster"
                            >
                                <ClipboardList className="w-6 h-6 text-center" /> 
                                <span className="font-semibold">Player Roster</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setActiveGame('mingle');
                                    setGameMode('picker');
                                    setView('home');
                                    if (threeManagerRef.current) {
                                        threeManagerRef.current.setGameType('mingle');
                                        threeManagerRef.current.spawnPlayers(students);
                                    }
                                }} 
                                className={`flex items-center gap-4 p-4 rounded-xl transition font-medium ${view === 'home' && activeGame === 'mingle' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                                title="Mingle Game"
                            >
                                <Users className="w-6 h-6 text-center text-rose-400" /> 
                                <span className="font-semibold text-white">Mingle Game</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setActiveGame('tag');
                                    setView('home');
                                    if (threeManagerRef.current) {
                                        threeManagerRef.current.setGameType('tag');
                                        threeManagerRef.current.spawnPlayers(students);
                                    }
                                }} 
                                className={`flex items-center gap-4 p-4 rounded-xl transition font-medium ${view === 'home' && activeGame === 'tag' ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
                                title="Tag"
                            >
                                <Tag className="w-6 h-6 text-center text-rose-400" /> 
                                <span className="font-semibold text-white">Tag</span>
                            </button>
                        </nav>
                        
                        <div className="p-6 border-t border-slate-800 text-xs text-slate-600 text-center uppercase tracking-widest font-bold flex flex-col gap-1">
                            <span>Version 3.0</span>
                            <span className={activeGame === 'mingle' || gameMode === 'picker' ? 'text-rose-500' : 'text-emerald-500'}>
                                {activeGame === 'tag' ? `Tag • ${gameMode === 'picker' ? 'Picker Active' : 'Survival Active'}` : 'Mingle • Picker Active'}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex-1 relative">
                    {(view === 'home' || view === 'students') && (
                        <div className="absolute top-6 right-6 z-40 flex items-center gap-3 pointer-events-auto">
                            <button
                                onClick={toggleFullscreen}
                                className="w-12 h-12 bg-slate-900/90 hover:bg-slate-700 rounded-full text-white transition border-2 border-slate-700 flex items-center justify-center shadow-lg"
                                title={isFullscreen ? "Exit Fullscreen" : "Full Screen"}
                            >
                                {isFullscreen ? <Minimize className="w-5 h-5 text-emerald-400" /> : <Maximize className="w-5 h-5 text-slate-200" />}
                            </button>

                            <div className="relative" ref={homeVolumeRef}>
                                <button
                                    onClick={() => setShowVolumeSlider(prev => !prev)}
                                    className={`w-12 h-12 bg-slate-900/90 rounded-full transition border-2 flex items-center justify-center shadow-lg ${
                                        showVolumeSlider
                                            ? 'border-emerald-400 bg-slate-800 text-emerald-400 ring-2 ring-emerald-500/30'
                                            : muteUI || volume === 0
                                            ? 'border-red-900/70 text-red-500 hover:bg-slate-800'
                                            : 'border-slate-700 text-emerald-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                    title="Volume Control"
                                >
                                    {muteUI || volume === 0 ? (
                                        <VolumeX className="w-5 h-5 text-red-500" />
                                    ) : volume < 40 ? (
                                        <Volume1 className="w-5 h-5 text-emerald-400" />
                                    ) : (
                                        <Volume2 className="w-5 h-5 text-emerald-400" />
                                    )}
                                </button>

                                {showVolumeSlider && (
                                    <div className="absolute right-0 top-14 bg-slate-900/95 backdrop-blur-md border-2 border-slate-700 shadow-2xl rounded-2xl p-3.5 flex items-center gap-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                                        <button
                                            onClick={toggleMute}
                                            className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                                            title={muteUI || volume === 0 ? "Unmute" : "Mute"}
                                        >
                                            {muteUI || volume === 0 ? (
                                                <VolumeX className="w-4 h-4 text-red-400" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 text-emerald-400" />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            value={muteUI ? 0 : volume}
                                            onChange={(e) => handleVolumeChange(Number(e.target.value))}
                                            className="w-28 sm:w-36 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                                        />
                                        <span className="text-xs font-bold text-slate-300 w-8 text-right font-mono select-none">
                                            {muteUI ? '0%' : `${volume}%`}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {view === 'home' && renderHome()}
                    {view === 'students' && <StudentManager students={students} setStudents={setStudents} onBack={() => setView('home')} onViewChange={onViewChange} />}
                    {view === 'game' && renderGameUI()}
                </div>
            </div>

        </div>
    );
}
