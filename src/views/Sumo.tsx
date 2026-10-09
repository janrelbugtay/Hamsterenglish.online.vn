import { MediaPickerModal } from "../components/MediaPickerModal";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, Info, ClipboardList, Copy, Trophy, Shuffle, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { SumoStadiumEnvironment } from "../components/SumoStadiumEnvironment";

let sharedAudioCtx: AudioContext | null = null;
let soundMutedGlobal = false;

const playSFX = (type: 'push' | 'stun' | 'win' | 'taiko' | 'clack' | 'freeze') => {
  if (soundMutedGlobal) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    const ctx = sharedAudioCtx;
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    if (type === 'push' || type === 'taiko') {
      // Deep resonant Taiko bass drum boom + impact
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);

      // Noise punch for tactile sumo impact
      const bufferSize = Math.floor(ctx.sampleRate * 0.08);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(320, ctx.currentTime);
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } else if (type === 'clack') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'stun') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(110, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } else if (type === 'win') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.5);
      });
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

import { doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
}

interface GameData {
  id: number | string;
  title?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

const DEFAULT_QUESTIONS: Question[] = [
  { id: 1, text: "He is happy, ____?", options: ["isn’t he?", "aren’t they?", "is he?", "aren’t you?"], answerIndex: 0 },
  { id: 2, text: "She is your friend, ____?", options: ["isn’t she?", "is she?", "doesn’t she?", "does she?"], answerIndex: 0 },
  { id: 3, text: "They can swim well, ____?", options: ["can’t they?", "can they?", "aren’t they?", "are they?"], answerIndex: 0 },
  { id: 4, text: "Tom plays football, ____?", options: ["doesn’t he?", "does he?", "isn’t he?", "is he?"], answerIndex: 0 },
  { id: 5, text: "You are happy today, ____?", options: ["aren’t you?", "are you?", "don’t you?", "do you?"], answerIndex: 0 },
  { id: 6, text: "We haven't met before, ____?", options: ["have we?", "haven’t we?", "did we?", "do we?"], answerIndex: 0 },
  { id: 7, text: "She will come tomorrow, ____?", options: ["won’t she?", "will she?", "doesn’t she?", "can’t she?"], answerIndex: 0 },
  { id: 8, text: "You didn't see him, ____?", options: ["did you?", "didn’t you?", "do you?", "don’t you?"], answerIndex: 0 }
];

const SumoCharacter = ({ team, isPushing, isOpponentPushing, isStunned, isFrozen, hasLost, isWinner, className }: any) => {
  const isLeft = team === 'left';

  // Character Fur Colors: Blue Team mascot is Blue in color, Red Team mascot is Red in color
  const furBase = isLeft ? "#2563eb" : "#dc2626";
  const furHighlight = isLeft ? "#60a5fa" : "#f87171";
  const furShadow = isLeft ? "#1d4ed8" : "#991b1b";
  const creamBelly = isLeft ? "#eff6ff" : "#fff1f2";
  const creamBellyShade = isLeft ? "#dbeafe" : "#ffe4e6";
  const innerEarColor = isLeft ? "#bfdbfe" : "#fecdd3";
  const cheekBlush = isLeft ? "#38bdf8" : "#fb7185";
  const whiskerColor = isLeft ? "#1e3a8a" : "#7f1d1d";
  const pawPadColor = isLeft ? "#bfdbfe" : "#fecdd3";
  const pawPadOutline = isLeft ? "#3b82f6" : "#ef4444";

  // Mawashi (Sumo Belt)
  const clothingColor = isLeft ? "#1e3a8a" : "#7f1d1d";
  const clothingHighlight = isLeft ? "#3b82f6" : "#ef4444";
  const clothingShadow = isLeft ? "#0f172a" : "#450a0a";
  const beltAccent = "#fbbf24";
  const beltAccentBorder = "#d97706";

  let rotation = 0;
  let translateX = 0;
  let translateY = 0;

  if (hasLost) {
    rotation = -65;
    translateX = -35;
    translateY = 24;
  } else if (isWinner) {
    rotation = -6;
    translateY = -16;
  } else if (isPushing) {
    // Forward lunge into opponent
    rotation = 12;
    translateX = 22;
    translateY = 2;
  } else if (isOpponentPushing) {
    // Bracing back slightly against push
    rotation = -12;
    translateX = -14;
    translateY = 3;
  } else if (isStunned) {
    rotation = -14; 
    translateX = -14;
    translateY = 8;
  } else {
    // Natural sumo stance facing center
    rotation = 3;
    translateX = 0;
  }

  // Right team is flipped horizontally with scaleX(-1) so both hamsters face each other!
  const isFlipped = !isLeft;
  const flipScale = isFlipped ? "scaleX(-1)" : "scaleX(1)";
  const transform = `${flipScale} rotate(${rotation}deg) translateX(${translateX}px) translateY(${translateY}px)`;
  const gradId = isLeft ? "blue" : "red";

  return (
    <div 
      className={`relative z-20 w-[170px] h-[180px] sm:w-[210px] sm:h-[225px] md:w-[255px] md:h-[270px] lg:w-[290px] lg:h-[310px] xl:w-[320px] xl:h-[340px] transition-transform duration-200 ease-out origin-center select-none ${className || ''}`}
      style={{ transform }}
    >
      <svg viewBox="0 0 120 120" className="w-full h-full overflow-visible drop-shadow-xl">
        <defs>
          <linearGradient id={`fur-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={furHighlight} />
            <stop offset="100%" stopColor={furBase} />
          </linearGradient>
          <linearGradient id={`belly-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={creamBelly} />
            <stop offset="100%" stopColor={creamBellyShade} />
          </linearGradient>
          <linearGradient id={`belt-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={clothingHighlight} />
            <stop offset="100%" stopColor={clothingColor} />
          </linearGradient>
        </defs>

        {/* Soft, grounded contact shadow on the dohyo dirt */}
        <ellipse cx="60" cy="112" rx="42" ry="9" fill="rgba(0,0,0,0.35)" />

        {/* Action dust & speed lines when charging forward */}
        {isPushing && (
          <g opacity="0.9">
            <circle cx="8" cy="106" r="7" fill="#fde047" opacity="0.6" className="animate-ping" />
            <circle cx="15" cy="102" r="8" fill="#f59e0b" opacity="0.5" />
            <line x1="-14" y1="52" x2="6" y2="52" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="-20" y1="40" x2="0" y2="44" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="-16" y1="72" x2="4" y2="68" stroke="#ffffff" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        )}

        {/* Cute Little Hamster Tail in Back */}
        <circle cx="16" cy="76" r="5.5" fill={`url(#fur-grad-${gradId})`} stroke={furShadow} strokeWidth="1.2" />

        {/* SOLID GROUNDED SUMO LEGS & FEET */}
        {/* Back Thigh & Foot */}
        <ellipse cx="32" cy="96" rx="10" ry="8" fill={furBase} />
        <ellipse cx="32" cy="104" rx="12" ry="5.5" fill={pawPadColor} stroke={pawPadOutline} strokeWidth="1.2" />
        <circle cx="30" cy="104" r="1.5" fill={pawPadOutline} opacity="0.6" />
        <circle cx="34" cy="104" r="1.5" fill={pawPadOutline} opacity="0.6" />

        {/* Front Thigh & Foot */}
        <ellipse cx="76" cy="96" rx="11" ry="8" fill={furBase} />
        <ellipse cx="78" cy="104" rx="12" ry="5.5" fill={pawPadColor} stroke={pawPadOutline} strokeWidth="1.2" />
        <circle cx="76" cy="104" r="1.5" fill={pawPadOutline} opacity="0.6" />
        <circle cx="80" cy="104" r="1.5" fill={pawPadOutline} opacity="0.6" />

        {/* Round Hamster Ears */}
        {/* Left Ear */}
        <g>
          <ellipse cx="34" cy="22" rx="11" ry="13" fill={`url(#fur-grad-${gradId})`} transform="rotate(-15 34 22)" />
          <ellipse cx="34" cy="22" rx="6.5" ry="8.5" fill={innerEarColor} transform="rotate(-15 34 22)" />
        </g>
        {/* Right Ear */}
        <g>
          <ellipse cx="78" cy="20" rx="11" ry="13" fill={`url(#fur-grad-${gradId})`} transform="rotate(15 78 20)" />
          <ellipse cx="78" cy="20" rx="6.5" ry="8.5" fill={innerEarColor} transform="rotate(15 78 20)" />
        </g>

        {/* Sumo Chonmage Topknot neatly centered on top */}
        <rect x="52" y="7" width="9" height="17" rx="4.5" fill="#2b231c" />
        <rect x="50" y="15" width="13" height="4" rx="2" fill={beltAccent} stroke={beltAccentBorder} strokeWidth="0.8" />

        {/* BIG CHUBBY SUMO BODY */}
        <ellipse cx="58" cy="74" rx="36" ry="30" fill={`url(#fur-grad-${gradId})`} />
        <ellipse cx="58" cy="46" rx="32" ry="28" fill={`url(#fur-grad-${gradId})`} />
        {/* Body Depth Shadow */}
        <path d="M 24 82 Q 58 104 92 82 Q 58 106 24 82 Z" fill={furShadow} opacity="0.32" />

        {/* Creamy White Tummy Patch */}
        <ellipse cx="60" cy="76" rx="24" ry="18" fill={`url(#belly-grad-${gradId})`} />

        {/* Creamy White Muzzle / Cheek Patch */}
        <ellipse cx="64" cy="49" rx="20" ry="16" fill={`url(#belly-grad-${gradId})`} />

        {/* Rosy Blushing Cheeks */}
        <ellipse cx="44" cy="51" rx="5.5" ry="3.5" fill={cheekBlush} opacity="0.45" />
        <ellipse cx="80" cy="51" rx="6" ry="3.5" fill={cheekBlush} opacity="0.45" />

        {/* Delicate Whiskers */}
        <line x1="38" y1="50" x2="26" y2="48" stroke={whiskerColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
        <line x1="38" y1="54" x2="28" y2="56" stroke={whiskerColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
        <line x1="84" y1="50" x2="96" y2="48" stroke={whiskerColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />
        <line x1="84" y1="54" x2="94" y2="56" stroke={whiskerColor} strokeWidth="1.2" strokeLinecap="round" opacity="0.65" />

        {/* EYES (Expressive Anime Eyes with Double Sparkles) */}
        {hasLost ? (
          <g>
            <path d="M 74 43 Q 78 37 78 47 T 70 43" fill="none" stroke={whiskerColor} strokeWidth="2.8" strokeLinecap="round" />
            <path d="M 50 43 Q 54 37 54 47 T 46 43" fill="none" stroke={whiskerColor} strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 78 46 L 96 60 M 46 46 L 28 60" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="4 3" className="animate-pulse" />
          </g>
        ) : isStunned ? (
          <g>
            <path d="M 70 40 L 78 48 M 78 40 L 70 48" stroke={whiskerColor} strokeWidth="3" strokeLinecap="round" />
            <path d="M 46 40 L 54 48 M 54 40 L 46 48" stroke={whiskerColor} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M 84 24 Q 92 34 84 38 Q 76 34 84 24 Z" fill="#60a5fa" stroke="#2563eb" strokeWidth="1" />
          </g>
        ) : isWinner ? (
          <g>
            <path d="M 68 44 Q 74 37 80 44" fill="none" stroke={whiskerColor} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 44 44 Q 50 37 56 44" fill="none" stroke={whiskerColor} strokeWidth="2.8" strokeLinecap="round" />
          </g>
        ) : isPushing ? (
          <g>
            <line x1="46" y1="36" x2="56" y2="39" stroke={whiskerColor} strokeWidth="2.8" strokeLinecap="round" />
            <line x1="68" y1="39" x2="80" y2="36" stroke={whiskerColor} strokeWidth="2.8" strokeLinecap="round" />
            <ellipse cx="50" cy="43" rx="5" ry="5.5" fill="#18181b" />
            <circle cx="51.5" cy="41.5" r="1.6" fill="#ffffff" />
            <ellipse cx="74" cy="43" rx="5.5" ry="6" fill="#18181b" />
            <circle cx="75.5" cy="41.5" r="2" fill="#ffffff" />
          </g>
        ) : (
          <g>
            {/* Left Eye */}
            <ellipse cx="50" cy="44" rx="5" ry="5.5" fill="#18181b" />
            <circle cx="51.5" cy="42" r="1.8" fill="#ffffff" />
            {/* Right Eye (facing center) */}
            <ellipse cx="74" cy="44" rx="5.8" ry="6.2" fill="#18181b" />
            <circle cx="75.5" cy="42" r="2.2" fill="#ffffff" />
            <circle cx="72.5" cy="46" r="1" fill="#ffffff" />
            {/* Subtle Eyebrows */}
            <path d="M 46 36 Q 50 34 54 36" fill="none" stroke={whiskerColor} strokeWidth="2" strokeLinecap="round" />
            <path d="M 70 36 Q 74 34 78 36" fill="none" stroke={whiskerColor} strokeWidth="2" strokeLinecap="round" />
          </g>
        )}

        {/* NOSE (Centered between eyes on the muzzle, with cute shine) */}
        <ellipse cx="68" cy="49" rx="3.5" ry="2.5" fill={cheekBlush} />
        <circle cx="67.2" cy="48.2" r="0.8" fill="#ffffff" />

        {/* MOUTH & BUCKTOOTH (Directly below the nose, completely clear of arms) */}
        {hasLost ? (
          <ellipse cx="68" cy="58" rx="6" ry="8" fill="#7f1d1d" stroke={whiskerColor} strokeWidth="1.2" />
        ) : isStunned ? (
          <path d="M 64 55 Q 68 52 72 55" fill="none" stroke={whiskerColor} strokeWidth="2" strokeLinecap="round" />
        ) : isWinner ? (
          <g>
            <path d="M 64 52 Q 68 62 72 52 Z" fill="#991b1b" stroke={whiskerColor} strokeWidth="1.2" />
            <rect x="66.5" y="52" width="3" height="2.5" rx="0.8" fill="#ffffff" />
          </g>
        ) : isPushing ? (
          <g>
            <path d="M 64 52 Q 68 60 72 52 Z" fill="#7f1d1d" stroke={whiskerColor} strokeWidth="1.5" />
            <rect x="66.5" y="52" width="3" height="2.5" rx="0.8" fill="#ffffff" />
          </g>
        ) : (
          <g>
            <path d="M 64 52 Q 68 56 72 52" fill="none" stroke={whiskerColor} strokeWidth="2" strokeLinecap="round" />
            <rect x="66.5" y="52" width="3" height="3" rx="0.8" fill="#ffffff" stroke={whiskerColor} strokeWidth="0.7" />
          </g>
        )}

        {/* THICK SUMO MAWASHI BELT WITH ACCENT */}
        <path d="M 24 74 Q 60 88 94 74 L 92 88 Q 60 102 26 88 Z" fill={`url(#belt-grad-${gradId})`} />
        <path d="M 25 75 Q 60 88 93 75" fill="none" stroke={clothingHighlight} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M 26 88 Q 60 102 92 88" fill="none" stroke={clothingShadow} strokeWidth="2" strokeLinecap="round" />

        {/* Front Hanging Loincloth Flap (Sagari) with Gold Trim */}
        <path d="M 54 82 L 67 82 L 65 102 L 56 102 Z" fill={clothingColor} />
        <path d="M 54 82 L 67 82" fill="none" stroke={beltAccent} strokeWidth="2" />
        <circle cx="60.5" cy="85" r="2.5" fill={beltAccent} stroke={beltAccentBorder} strokeWidth="0.8" />

        {/* SUMO ARMS: SYMMETRICALLY ATTACHED AT FLANKS / SHOULDERS (CLEAR OF MOUTH!) */}
        {hasLost ? (
          // Defeated: both arms flailing back
          <g>
            <path d="M 30 66 Q 18 64 14 74" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="14" cy="74" rx="4.5" ry="4" fill={innerEarColor} stroke={furShadow} strokeWidth="1" />
            <path d="M 86 66 Q 98 64 102 74" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="102" cy="74" rx="4.5" ry="4" fill={innerEarColor} stroke={furShadow} strokeWidth="1" />
          </g>
        ) : isWinner ? (
          // Winner: Both arms raised high in victory \o/
          <g>
            <path d="M 30 62 Q 22 42 26 24" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="26" cy="24" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1" />
            <path d="M 86 62 Q 94 42 90 24" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="90" cy="24" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1" />
          </g>
        ) : isPushing ? (
          // PUSHING: BOTH ARMS UP AND THRUSTING FORWARD TOGETHER!
          // Both arms anchored at shoulder level (y=64), thrusting forward cleanly below the mouth (y=52)!
          <g>
            {/* Left Arm: thrusting forward from left shoulder */}
            <path d="M 30 64 Q 52 60 76 62" stroke={furBase} strokeWidth="9" strokeLinecap="round" fill="none" />
            <ellipse cx="78" cy="62" rx="6" ry="5.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />

            {/* Right Arm: symmetrically thrusting forward from right shoulder, copying left arm's motion! */}
            <path d="M 86 64 L 108 62" stroke={furBase} strokeWidth="9.5" strokeLinecap="round" fill="none" />
            <ellipse cx="110" cy="62" rx="6.5" ry="5.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />

            {/* Comic clash star spark at paw impact point */}
            <g transform="translate(112, 62)">
              <polygon points="0,-12 3.5,-3.5 12,0 3.5,3.5 0,12 -3.5,3.5 -12,0 -3.5,-3.5" fill={beltAccent} />
              <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#ffffff" />
            </g>
          </g>
        ) : isOpponentPushing ? (
          // Defensive guard: both arms pulled up in front of chest (y=66-68, well below mouth!)
          <g>
            <path d="M 30 66 Q 44 66 54 68" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="56" cy="68" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />
            <path d="M 86 66 Q 74 66 64 68" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="62" cy="68" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />
          </g>
        ) : (
          // REST: BOTH ARMS DOWN SYMMETRICALLY ON FLANKS (CLEAR OF MOUTH!)
          <g>
            {/* Left Arm: attached on left flank at shoulder (y=66), resting DOWN along left side */}
            <path d="M 30 66 Q 22 74 24 82" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="24" cy="82" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />

            {/* Right Arm: attached on right flank at shoulder (y=66), copying left arm's position symmetrically! */}
            <path d="M 86 66 Q 94 74 92 82" stroke={furBase} strokeWidth="8.5" strokeLinecap="round" fill="none" />
            <ellipse cx="92" cy="82" rx="5" ry="4.5" fill={innerEarColor} stroke={furShadow} strokeWidth="1.2" />
          </g>
        )}

        {/* Frozen Ice Block Overlay */}
        {isFrozen && (
          <g>
            <rect x="-6" y="2" width="132" height="118" rx="18" fill="rgba(165, 243, 252, 0.78)" stroke="rgba(103, 232, 249, 0.95)" strokeWidth="5" />
            <path d="M 4 18 L 24 6 M 14 112 L 34 96 M 94 8 L 116 24 M 90 104 L 122 114" stroke="rgba(255,255,255,0.85)" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="8" y="16" width="22" height="40" rx="11" fill="rgba(255,255,255,0.55)" transform="rotate(15 19 36)" />
            <text 
              x={isFlipped ? "-60" : "60"} 
              y="62" 
              fontFamily="sans-serif" 
              fontSize="22" 
              fontWeight="900" 
              fill="#083344" 
              textAnchor="middle" 
              transform={isFlipped ? "scale(-1, 1) rotate(8 -60 62)" : "rotate(-8 60 62)"} 
              style={{ paintOrder: 'stroke', stroke: '#cffafe', strokeWidth: '5px' }}
            >
              FROZEN
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

export function Sumo({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'menu' : 'setup');
  const [showModeModal, setShowModeModal] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null); 
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : DEFAULT_QUESTIONS);

      setActiveGame({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Question Tags Showdown",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
        isPublic: initialGame.isPublic || false
      });

      if (!initialGame.editMode && hasLoadedQuestions) {
        setScreen('menu');
      } else {
        setScreen('setup');
      }
    }
  }, [initialGame]);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const snap = await getDocs(qFolders);
          const fData: { id: string; name: string }[] = [];
          snap.forEach(d => fData.push({ id: d.id, name: d.data().name }));
          setFolders(fData);
        } catch (err) {
          console.error("Error loading folders", err);
        }
      };
      fetchFolders();
    }
  }, [user]);

  const [activeGame, setActiveGame] = useState<GameData | null>(() => {
    if (initialGame) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : DEFAULT_QUESTIONS);
      return {
        id: initialGame.id,
        title: initialGame.name || initialGame.title || initialGame.topic || "Question Tags Showdown",
        folderId: initialGame.folderId || "",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: qList,
        isPublic: initialGame.isPublic || false
      };
    }
    return {
      id: Date.now(),
      title: "",
      folderId: "",
      topic: "",
      classLevel: "",
      questions: [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
    };
  });

  const saveGame = async (gameData: GameData) => {
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }

    onViewChange("games");

    try {
      const gameToSave = JSON.parse(JSON.stringify({
        name: gameData.title || "",
        folderId: gameData.folderId || "",
        topic: gameData.topic || "",
        className: gameData.classLevel || "",
        gameType: "sumo",
        customQuestions: gameData.questions,
        isPublic: gameData.isPublic ?? false,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
      }));

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error("Error saving game", e);
      alert("Failed to save game.");
    }
  };

  const questionsDB = (activeGame?.questions && activeGame.questions.length > 0) ? activeGame.questions : DEFAULT_QUESTIONS;

  const [questionMode, setQuestionMode] = useState<'single' | 'split'>('single');
  const [showStartBattleModal, setShowStartBattleModal] = useState(false);
  const questionModeRef = useRef<'single' | 'split'>('single');
  const leftQuestionsRef = useRef<any[]>([]);
  const rightQuestionsRef = useRef<any[]>([]);

  useEffect(() => {
    questionModeRef.current = questionMode;
  }, [questionMode]);

  const generateQuestionObj = (q: any) => {
    if (!q) {
      return { text: "Question", options: ["Option A", "Option B"], correctIndex: 0 };
    }
    
    // Get valid options
    let validOptions = Array.isArray(q.options) 
      ? [...q.options].filter(o => typeof o === 'string' && o.trim() !== "") 
      : [];
    
    const correctOpt = (Array.isArray(q.options) && q.options[q.answerIndex]) || validOptions[0] || "Correct Answer";
    
    // Ensure correct option is included
    if (!validOptions.includes(correctOpt)) {
       validOptions.unshift(correctOpt);
    }
    
    // Preserve natural option count for 2, 3, or 4 options (e.g. True/False or multiple choice)
    if (validOptions.length < 2) {
      validOptions.push("Option B");
    } else if (validOptions.length > 4) {
      // If there are more than 4, keep the correct one and 3 others
      const wrongOpts = validOptions.filter(o => o !== correctOpt).sort(() => Math.random() - 0.5).slice(0, 3);
      validOptions = [correctOpt, ...wrongOpts];
    }
    
    // Shuffle options
    const shuffledOpts = [...validOptions].sort(() => Math.random() - 0.5);
    
    return {
      text: q.text || "Question",
      options: shuffledOpts,
      correctIndex: Math.max(0, shuffledOpts.indexOf(correctOpt))
    };
  };

  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];
    return generateQuestionObj(q);
  };

  const generateQuestionFromList = (list: any[], index: number) => {
    if (!list || list.length === 0) return generateQuestion(index);
    const q = list[index % list.length];
    return generateQuestionObj(q);
  };

  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });
  const [battlePos, setBattlePos] = useState(50);
  const [winner, setWinner] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<{ team: 'left' | 'right'; index: number } | null>(null);
  const [isRumbling, setIsRumbling] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    soundMutedGlobal = soundMuted;
  }, [soundMuted]);

  const matchOverRef = useRef(false);
  const stateRef = useRef({ screen, leftTeam, rightTeam, battlePos });
  useEffect(() => {
    stateRef.current = { screen, leftTeam, rightTeam, battlePos };
  }, [screen, leftTeam, rightTeam, battlePos]);

  const startGame = (continueMatch = false, chosenMode?: 'single' | 'split') => {
    const activeMode = chosenMode || questionMode;
    if (chosenMode) {
      setQuestionMode(chosenMode);
      questionModeRef.current = chosenMode;
    }

    // For Split Mode: each team gets their own independently shuffled deck of questions!
    const shuffledLeft = [...questionsDB].sort(() => Math.random() - 0.5);
    const shuffledRight = [...questionsDB].sort(() => Math.random() - 0.5);
    leftQuestionsRef.current = shuffledLeft;
    rightQuestionsRef.current = shuffledRight;

    setLeftTeam((prev: any) => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       const qSource = activeMode === 'split' ? shuffledLeft : questionsDB;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestionFromList(qSource, nextIndex), stunned: false, pushing: false };
    });
    setRightTeam((prev: any) => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       const qSource = activeMode === 'split' ? shuffledRight : questionsDB;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestionFromList(qSource, nextIndex), stunned: false, pushing: false };
    });
    setBattlePos(50);
    setWinner(null);
    matchOverRef.current = false;
    setShowStartBattleModal(false);
    setScreen('playing');
    playSFX('taiko');
    setTimeout(() => playSFX('clack'), 220);
  };

  const handleAnswer = useCallback((teamStr: string, selectedIndex: number) => {
    const state = stateRef.current;
    if (state.screen !== 'playing') return;

    const isLeft = teamStr === 'left';
    const teamState = isLeft ? state.leftTeam : state.rightTeam;
    const setTeamState = isLeft ? setLeftTeam : setRightTeam;

    if (teamState.stunned || teamState.pushing || teamState.frozen) return;

    if (selectedIndex === teamState.q.correctIndex) {
      setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1, mistakes: 0 }));
      setIsRumbling(true);
      setTimeout(() => setIsRumbling(false), 240);
      playSFX('push');
      const shiftAmount = 14; 
      
      if (matchOverRef.current) return;
      
      const nextPos = isLeft ? state.battlePos + shiftAmount : state.battlePos - shiftAmount;
      let matchOver = false;
      
      // When pushed to the end of the arena (past the outer straw boundary), that character LOSES!
      if (nextPos >= 84) {
         matchOverRef.current = true;
         matchOver = true;
         setBattlePos(86);
         setWinner('Blue Team');
         setLeftTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 2000);
      } else if (nextPos <= 16) {
         matchOverRef.current = true;
         matchOver = true;
         setBattlePos(14);
         setWinner('Red Team');
         setRightTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 2000);
      } else {
         setBattlePos(nextPos);
      }

      if (!matchOver) {
        if (questionModeRef.current === 'split') {
          // SPLIT QUESTION MODE: Only the answering team advances to their own next question in their independent randomized order!
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const qList = isLeft ? leftQuestionsRef.current : rightQuestionsRef.current;
            setTeamState((prev: any) => ({
              ...prev,
              pushing: false,
              qIndex: nextIndex,
              q: generateQuestionFromList(qList, nextIndex)
            }));
          }, 350);
        } else {
          // SINGLE QUESTION MODE: Both teams advance together to the next question in the middle!
          setTimeout(() => {
            const nextIndex = teamState.qIndex + 1;
            const newQ = generateQuestion(nextIndex);
            setLeftTeam((prev: any) => ({
               ...prev,
               pushing: false,
               qIndex: nextIndex,
               q: newQ
            }));
            setRightTeam((prev: any) => ({
               ...prev,
               pushing: false,
               qIndex: nextIndex,
               q: newQ
            }));
          }, 400);
        }
      }
    } else {
      setTeamState((prev: any) => {
         const nextMistakes = prev.mistakes + 1;
         if (nextMistakes >= 2) {
             playSFX('freeze');
             setTimeout(() => setTeamState((p: any) => ({ ...p, frozen: false, mistakes: 0 })), 3000);
             return { ...prev, frozen: true, mistakes: 0 };
         }
         
         playSFX('stun');
         setTimeout(() => setTeamState((p: any) => ({ ...p, stunned: false })), 1000);
         return { ...prev, stunned: true, mistakes: nextMistakes };
      });

      if (!matchOverRef.current) {
        setBattlePos(prev => {
          const penalty = isLeft ? -6 : 6;
          const adjusted = prev + penalty;
          if (adjusted >= 84) {
             matchOverRef.current = true;
             setWinner('Blue Team');
             setLeftTeam(p => ({ ...p, wins: p.wins + 1 }));
             playSFX('win');
             setTimeout(() => setScreen('end'), 2000);
             return 86;
          } else if (adjusted <= 16) {
             matchOverRef.current = true;
             setWinner('Red Team');
             setRightTeam(p => ({ ...p, wins: p.wins + 1 }));
             playSFX('win');
             setTimeout(() => setScreen('end'), 2000);
             return 14;
          }
          return adjusted;
        });
      }
    }
  }, []);

  const getBlueKeyHints = (count: number): string[] => {
    if (count === 2) return ['A', 'D'];
    if (count === 3) return ['A', 'S', 'D'];
    return ['W', 'A', 'S', 'D'];
  };

  const getRedKeyHints = (count: number): string[] => {
    if (count === 2) return ['←', '→'];
    if (count === 3) return ['←', '↓', '→'];
    return ['↑', '←', '↓', '→'];
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.screen !== 'playing') return;
      const key = e.key.toLowerCase();
      
      const leftOptsCount = stateRef.current.leftTeam?.q?.options?.length || 4;
      const rightOptsCount = stateRef.current.rightTeam?.q?.options?.length || 4;
      
      let leftMap: Record<string, number> = {};
      if (leftOptsCount === 2) {
        // 2 Options: A and D
        leftMap = { a: 0, d: 1, 1: 0, 2: 1, q: 0, e: 1 };
      } else if (leftOptsCount === 3) {
        // 3 Options: A, S, D
        leftMap = { a: 0, s: 1, d: 2, 1: 0, 2: 1, 3: 2, q: 0, w: 1, e: 2 };
      } else {
        // 4 Options: W, A, S, D
        leftMap = { w: 0, a: 1, s: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };
      }
          
      let rightMap: Record<string, number> = {};
      if (rightOptsCount === 2) {
        // 2 Options: Left and Right arrows
        rightMap = { arrowleft: 0, arrowright: 1, 1: 0, 2: 1, j: 0, l: 1, 7: 0, 8: 1 };
      } else if (rightOptsCount === 3) {
        // 3 Options: Left, Down, Right arrows
        rightMap = { arrowleft: 0, arrowdown: 1, arrowright: 2, 1: 0, 2: 1, 3: 2, j: 0, k: 1, l: 2, 7: 0, 8: 1, 9: 2 };
      } else {
        // 4 Options: Up, Left, Down, Right arrows
        rightMap = { arrowup: 0, arrowleft: 1, arrowdown: 2, arrowright: 3, 1: 0, 2: 1, 3: 2, 4: 3, i: 0, j: 1, k: 2, l: 3, 7: 0, 8: 1, 9: 2, 0: 3 };
      }

      if (key in leftMap) {
         const idx = leftMap[key];
         setActiveKey({ team: 'left', index: idx });
         setTimeout(() => setActiveKey(null), 160);
         handleAnswer('left', idx);
      } else if (key in rightMap) {
         const idx = rightMap[key];
         setActiveKey({ team: 'right', index: idx });
         setTimeout(() => setActiveKey(null), 160);
         handleAnswer('right', idx);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer]);

  const getQuestionFontSize = (text: string) => {
    if (!text) return "text-xl sm:text-2xl md:text-3xl";
    const len = text.trim().length;
    if (len <= 28) {
      return "text-xl sm:text-2xl md:text-3xl lg:text-4xl";
    } else if (len <= 60) {
      return "text-lg sm:text-xl md:text-2xl lg:text-3xl";
    } else if (len <= 95) {
      return "text-base sm:text-lg md:text-xl lg:text-2xl";
    } else if (len <= 135) {
      return "text-sm sm:text-base md:text-lg lg:text-xl";
    } else {
      return "text-xs sm:text-sm md:text-base";
    }
  };

  const getOptionFontSize = (text: string, count = 4) => {
    if (!text) return "text-sm sm:text-base md:text-lg";
    const len = text.trim().length;
    if (count <= 2) {
      if (len <= 8) return "text-2xl sm:text-3xl md:text-4xl";
      if (len <= 14) return "text-xl sm:text-2xl md:text-3xl";
      if (len <= 24) return "text-lg sm:text-xl md:text-2xl";
      return "text-base sm:text-lg md:text-xl";
    }
    if (count === 3) {
      if (len <= 6) return "text-xl sm:text-2xl md:text-3xl";
      if (len <= 10) return "text-lg sm:text-xl md:text-2xl";
      if (len <= 18) return "text-base sm:text-lg md:text-xl";
      return "text-sm sm:text-base md:text-lg";
    }
    // 4 options (standard):
    if (len <= 5) {
      return "text-base sm:text-lg md:text-xl lg:text-2xl";
    } else if (len <= 8) {
      return "text-sm sm:text-base md:text-lg lg:text-xl";
    } else if (len <= 12) {
      return "text-xs sm:text-sm md:text-base lg:text-lg";
    } else if (len <= 18) {
      return "text-[11px] sm:text-xs md:text-sm lg:text-base";
    } else {
      return "text-[10px] sm:text-[11px] md:text-xs";
    }
  };

  const renderQuestionText = (text: string) => {
    if (!text) return "";
    const parts = text.split(/_{2,}/);
    if (parts.length === 1) {
      return text;
    }
    return (
      <div className="flex flex-col items-center justify-center">
        <span>{parts[0].trim()}</span>
        <div className="flex items-center justify-center mt-0.5 sm:mt-1 flex-wrap">
          <span className="inline-block border-b-4 md:border-b-6 border-[#8c5225] min-w-[2.5rem] sm:min-w-[3.5rem] md:min-w-[4.5rem] mx-1.5 sm:mx-2 align-baseline translate-y-[-2px]"></span>
          <span>{parts[1]?.trim() || "?"}</span>
        </div>
      </div>
    );
  };

  if (screen === 'setup') {
    return (
      <GameEditor 
        game={activeGame!} 
        onSave={saveGame} 
        onCancel={() => onViewChange("games")}
        folders={folders}
      />
    );
  }

  if (screen === 'study') {
    const studyQuestions = activeGame?.questions || DEFAULT_QUESTIONS;
    const currentQ = studyQuestions[studyIndex];
    
    return (
      <div id="game-container" className="h-[calc(100vh-2rem)] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col font-sans p-4 relative" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white/10 rounded-2xl backdrop-blur-md mb-8 border border-white/10">
           <button 
             onClick={() => setScreen('menu')}
             className="flex items-center gap-2 p-2 rounded-full transition-all bg-white/15 hover:bg-white/25 shadow-sm text-white font-bold px-4 cursor-pointer"
           >
             <ArrowLeft size={20} /> Back to Menu
           </button>
           <div className="text-xl font-black text-amber-300">
              Question {studyIndex + 1} of {studyQuestions.length}
           </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full">
           {studyQuestions.length > 0 ? (
              <>
                 <h1 className="text-3xl md:text-5xl font-black text-indigo-950 dark:text-white tracking-tight leading-tight text-center max-w-full break-words drop-shadow-sm mb-12">
                     {currentQ?.text}
                 </h1>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                     {currentQ?.options.map((opt, i) => {
                         if (!opt || opt.trim() === '') return null;
                         const isSelected = studySelectedOption === i;
                         const isCorrect = i === currentQ.answerIndex;
                         const showAsCorrect = studySelectedOption !== null && isCorrect;
                         const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;
                         
                         return (
                             <button
                                 key={i}
                                 onClick={() => {
                                     if (studySelectedOption === null) {
                                         setStudySelectedOption(i);
                                     }
                                 }}
                                 disabled={studySelectedOption !== null}
                                 className={`relative p-6 rounded-2xl text-xl md:text-2xl font-bold transition-all duration-300 transform ${
                                     showAsCorrect ? 'bg-green-500 text-white shadow-[0_6px_0_#15803d] scale-105 z-10' :
                                     showAsIncorrect ? 'bg-red-500 text-white opacity-90 scale-95 shadow-[0_4px_0_#991b1b]' :
                                     studySelectedOption !== null ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-50 shadow-none' :
                                     'bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-[1.02] shadow-[0_6px_0_#cbd5e1] dark:shadow-[0_6px_0_#334155] border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                                 }`}
                             >
                                 <div className="flex items-center justify-center gap-4">
                                     {opt}
                                     {showAsCorrect && <span className="text-3xl animate-bounce">✅</span>}
                                     {showAsIncorrect && <span className="text-3xl">❌</span>}
                                 </div>
                             </button>
                         );
                     })}
                 </div>
                 
                 <div className={`mt-12 h-20 transition-all duration-500 ${studySelectedOption !== null ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                     <button
                         onClick={() => {
                             if (studyIndex < studyQuestions.length - 1) {
                                 setStudyIndex(studyIndex + 1);
                                 setStudySelectedOption(null);
                             } else {
                                 setScreen('menu');
                                 setStudyIndex(0);
                                 setStudySelectedOption(null);
                             }
                         }}
                         className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl rounded-full shadow-[0_6px_0_#4338ca] active:translate-y-1 active:shadow-none transition-all"
                     >
                         {studyIndex < studyQuestions.length - 1 ? 'Next Question →' : 'Finish Study'}
                     </button>
                 </div>
              </>
           ) : (
              <div className="text-slate-500 text-3xl font-bold">No questions available!</div>
           )}
        </div>
      </div>
    );
  }

  if (screen === 'menu') {
    return (
      <div id="game-container" className="h-[calc(100vh-2rem)] bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center font-sans p-4 overflow-hidden relative" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
          <button 
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />
          <button
            onClick={() => setShowModeModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Switch to Bubble Pop or Yoga Quiz"
          >
            <Shuffle size={14} className="text-amber-400" />
            <span>Switch Mode</span>
          </button>
          <button 
            onClick={() => {
              setLeftTeam(prev => ({ ...prev, wins: 0 }));
              setRightTeam(prev => ({ ...prev, wins: 0 }));
              setScreen('menu');
            }}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 border-red-300/50 dark:border-red-500/20 shadow-sm"
            title="Quit Game"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] text-center shadow-2xl border-b-8 border-yellow-500 max-w-lg w-full">
          <div className="mb-6 flex justify-center gap-6 animate-pulse">
             <div className="w-12 h-12 bg-blue-600 rounded-full border-4 border-blue-900 shadow-lg"></div>
             <div className="w-12 h-12 bg-red-600 rounded-full border-4 border-red-900 shadow-lg"></div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-indigo-900 italic uppercase tracking-tighter leading-tight">{activeGame?.title || "QUESTION TAGS SHOWDOWN"}</h1>
          <p className="text-slate-500 mb-8 font-bold text-lg uppercase tracking-widest">{activeGame?.topic || "Master the Tags"}</p>
          <button 
            onClick={() => setShowStartBattleModal(true)} 
            className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-6 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto mb-4 cursor-pointer hover:scale-105"
          >
            START BATTLE
          </button>
          
          <button onClick={() => { setStudyIndex(0); setStudySelectedOption(null); setScreen('study'); }} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xl font-bold px-12 py-4 rounded-full shadow-[0_6px_0_#818cf8] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto flex items-center justify-center gap-3 mx-auto cursor-pointer">
             <span className="text-3xl">📖</span> STUDY MODE
          </button>
        </div>

        {/* Sumo Battle Mode Selection Modal (Single Question vs Split Questions) */}
        {showStartBattleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 md:p-10 max-w-xl w-full text-center shadow-2xl border-4 border-amber-400 relative">
              <button 
                onClick={() => setShowStartBattleModal(false)}
                className="absolute top-5 right-5 p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
                title="Close"
              >
                <X size={24} />
              </button>

              <div className="flex justify-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-md"></div>
                <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white shadow-md"></div>
              </div>

              <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight mb-2">
                Choose Battle Mode
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm font-semibold mb-6">
                Choose how questions will appear in this Sumo battle:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-left">
                {/* SINGLE QUESTION MODE BUTTON */}
                <button
                  onClick={() => startGame(false, 'single')}
                  className="group p-5 rounded-3xl border-3 border-amber-300 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">🎯</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">Single Question</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Both Red and Blue race to answer <strong className="text-slate-900">1 shared question</strong> centered in the middle of the arena.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-amber-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Single Battle →
                  </div>
                </button>

                {/* SPLIT QUESTION MODE BUTTON */}
                <button
                  onClick={() => startGame(false, 'split')}
                  className="group p-5 rounded-3xl border-3 border-indigo-300 hover:border-indigo-500 bg-indigo-50/70 hover:bg-indigo-100/90 transition-all shadow-md hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl">⚡</span>
                      <span className="font-black text-base sm:text-lg text-slate-900 uppercase">Split Questions</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      Each team has their own <strong className="text-slate-900">randomized question order</strong> appearing directly on Red side and Blue side.
                    </p>
                  </div>
                  <div className="mt-4 inline-flex items-center text-xs font-black text-indigo-800 uppercase tracking-wider group-hover:translate-x-1 transition-transform">
                    Start Split Battle →
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowStartBattleModal(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

  if (screen === 'end') {
    return (
      <div id="game-container" className="h-[calc(100vh-2rem)] bg-slate-100 dark:bg-black/95 flex items-center justify-center font-sans p-4 overflow-hidden relative" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
        <div className="absolute top-4 left-4 z-[60] flex items-center gap-2">
          <button 
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />
          <button
            onClick={() => setShowModeModal(true)}
            className="px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 dark:bg-white/10 dark:hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Switch to Bubble Pop or Yoga Quiz"
          >
            <Shuffle size={14} className="text-amber-400" />
            <span>Switch Mode</span>
          </button>
          <button 
            onClick={() => {
              setLeftTeam(prev => ({ ...prev, wins: 0 }));
              setRightTeam(prev => ({ ...prev, wins: 0 }));
              setScreen('menu');
            }}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 border-red-300/50 dark:border-red-500/20 shadow-sm"
            title="Quit Game"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white p-10 md:p-16 rounded-[2.5rem] text-center shadow-2xl border-8 border-yellow-400">
          <h2 className={`text-5xl md:text-7xl font-black mb-4 uppercase italic ${winner === 'Blue Team' ? 'text-blue-600' : 'text-red-600'}`}>
            {winner}
          </h2>
          <p className="text-2xl font-black text-slate-800 mb-10 uppercase tracking-widest">Wins the Match!</p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button onClick={() => startGame(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-8 py-5 rounded-full shadow-[0_6px_0_#ca8a04] active:translate-y-1 active:shadow-[0_0px_0_#ca8a04] transition-all">
              Continue
            </button>
            <button onClick={() => {
                setLeftTeam((prev: any) => ({ ...prev, wins: 0 }));
                setRightTeam((prev: any) => ({ ...prev, wins: 0 }));
                startGame(false);
              }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold px-8 py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-[0_0px_0_#94a3b8] transition-all">
              Restart
            </button>
          </div>
        </div>

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
  }

    const currentQText = leftTeam.q?.text || rightTeam.q?.text || DEFAULT_QUESTIONS[0].text;

    return (
      <div id="game-container" className="h-[calc(100vh-2rem)] w-full select-none overflow-hidden font-sans relative" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
        <SumoStadiumEnvironment 
          battlePos={battlePos} 
          winner={winner} 
          isRumbling={isRumbling}
        >
          {/* TOP ROW: Back icon on top left, Blue & Red team banners in the middle, 3 icons on top right */}
          <div className="w-full flex items-center justify-between shrink-0 z-50 relative gap-2 sm:gap-4 px-1 sm:px-2 mb-1 sm:mb-2">
            {/* TOP LEFT: Back Icon */}
            <button 
              onClick={() => onViewChange("home")}
              className="p-2 sm:p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-amber-900/15 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Exit to Games"
            >
              <ArrowLeft size={22} className="stroke-[2.5]" />
            </button>

            {/* TOP MIDDLE: Blue Team and Red Team Banners */}
            <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
              {/* Blue Team Banner */}
              <div className="bg-[#0055fe] rounded-2xl md:rounded-3xl px-3 sm:px-5 md:px-6 py-1 sm:py-1.5 md:py-2 flex items-center gap-2 sm:gap-3 shadow-lg shadow-blue-500/25 border-b-4 border-[#0038b3]">
                <span className="font-black italic text-xs sm:text-sm md:text-lg lg:text-xl text-white uppercase tracking-wider select-none">
                  BLUE TEAM
                </span>
                <div className="bg-white text-blue-700 font-black text-xs sm:text-sm md:text-base px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full shadow-sm tracking-wide">
                  {leftTeam.wins} WINS
                </div>
              </div>

              {/* Red Team Banner */}
              <div className="bg-[#cc0000] rounded-2xl md:rounded-3xl px-3 sm:px-5 md:px-6 py-1 sm:py-1.5 md:py-2 flex items-center gap-2 sm:gap-3 shadow-lg shadow-red-500/25 border-b-4 border-[#990000]">
                <div className="bg-white text-red-700 font-black text-xs sm:text-sm md:text-base px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full shadow-sm tracking-wide">
                  {rightTeam.wins} WINS
                </div>
                <span className="font-black italic text-xs sm:text-sm md:text-lg lg:text-xl text-white uppercase tracking-wider select-none">
                  RED TEAM
                </span>
              </div>
            </div>

            {/* TOP RIGHT: Three Icons (Fullscreen, Sound, Shuffle) */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-white/90 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full shadow-md border border-amber-900/15">
              <FullscreenButton 
                targetId="game-container" 
                className="!p-1.5 sm:!p-2 !rounded-full !bg-blue-100 hover:!bg-blue-200 !text-blue-700 !border-0 !shadow-none cursor-pointer" 
              />
              <button
                onClick={() => setSoundMuted(!soundMuted)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
                title={soundMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {soundMuted ? <VolumeX size={20} className="text-red-500" /> : <Volume2 size={20} className="text-emerald-600" />}
              </button>
              <button
                onClick={() => setShowModeModal(true)}
                className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
                title="Switch Mode"
              >
                <Shuffle size={20} />
              </button>
            </div>
          </div>

          {/* CENTER SUMO BATTLE STAGE (INTEGRATED DIRECTLY INTO STADIUM GROUND) */}
          <div className={`flex-1 w-full max-w-5xl mx-auto flex flex-col items-center justify-center relative min-h-[160px] sm:min-h-[200px] my-auto transition-transform duration-150 overflow-visible ${isRumbling ? 'scale-[1.015] translate-y-[-2px]' : ''}`}>
            
            {/* Arena Battle Field (Open Grounded Stage - No Circular Arena) */}
            <div className="w-[96%] sm:w-[92%] md:w-[88%] h-[140px] sm:h-[170px] md:h-[195px] relative flex items-center justify-center overflow-visible z-10">
              
              {/* Grounded Battle Mat / Center Stage (Grounded rect with soft rounded corners, not circular) */}
              <div className="absolute inset-x-2 sm:inset-x-6 top-1/2 -translate-y-1/2 h-[56px] sm:h-[72px] md:h-[84px] bg-gradient-to-r from-blue-950/40 via-amber-950/35 to-red-950/40 rounded-2xl sm:rounded-3xl border-y-2 border-amber-600/40 shadow-[inset_0_2px_14px_rgba(0,0,0,0.6)] flex items-center justify-between px-3 sm:px-6 pointer-events-none">
                {/* Left Blue Ring-Out Boundary Line */}
                <div className="h-4/5 w-2 sm:w-2.5 bg-gradient-to-b from-blue-400 to-blue-600 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.7)]"></div>

                {/* Center Shikiri-sen Starting Lines & Center Marker */}
                <div className="flex items-center gap-4 sm:gap-8 md:gap-12">
                  {/* Left Shikiri-sen */}
                  <div className="w-8 sm:w-14 md:w-16 h-2 sm:h-2.5 bg-white/95 rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.5)]"></div>
                  {/* Center Line Indicator */}
                  <div className="w-2 h-7 sm:h-9 bg-amber-400/70 rounded-full shadow-sm"></div>
                  {/* Right Shikiri-sen */}
                  <div className="w-8 sm:w-14 md:w-16 h-2 sm:h-2.5 bg-white/95 rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.5)]"></div>
                </div>

                {/* Right Red Ring-Out Boundary Line */}
                <div className="h-4/5 w-2 sm:w-2.5 bg-gradient-to-b from-red-400 to-red-600 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.7)]"></div>
              </div>

              {/* Edge Danger Alerts */}
              {battlePos <= 30 && !winner && (
                <div className="absolute -top-1 sm:top-1 left-2 sm:left-8 bg-red-600 text-white font-black text-xs sm:text-sm px-3.5 py-1 rounded-full animate-bounce shadow-md z-30">
                  BLUE RING-OUT DANGER!
                </div>
              )}
              {battlePos >= 70 && !winner && (
                <div className="absolute -top-1 sm:top-1 right-2 sm:right-8 bg-blue-600 text-white font-black text-xs sm:text-sm px-3.5 py-1 rounded-full animate-bounce shadow-md z-30">
                  RED RING-OUT DANGER!
                </div>
              )}

              {/* Clashing Sumo Hamsters Moving Across Arena to the Ends */}
              <div 
                className="absolute top-[50%] left-1/2 flex items-center justify-center transition-all duration-300 ease-out z-20 pointer-events-none"
                style={{ 
                  left: `${Math.max(12, Math.min(88, battlePos))}%`, 
                  transform: 'translate(-50%, -50%)' 
                }}
              >
                <div className="flex items-center -space-x-8 sm:-space-x-12 md:-space-x-16 lg:-space-x-20">
                  <SumoCharacter 
                    team="left"
                    isPushing={leftTeam.pushing}
                    isOpponentPushing={rightTeam.pushing}
                    isStunned={leftTeam.stunned}
                    isFrozen={leftTeam.frozen}
                    hasLost={winner === 'Red Team'}
                    isWinner={winner === 'Blue Team'}
                  />
                  <SumoCharacter 
                    team="right"
                    isPushing={rightTeam.pushing}
                    isOpponentPushing={leftTeam.pushing}
                    isStunned={rightTeam.stunned}
                    isFrozen={rightTeam.frozen}
                    hasLost={winner === 'Blue Team'}
                    isWinner={winner === 'Red Team'}
                  />
                </div>
              </div>

              {/* Dramatic Ring-Out Victory Callout Banner */}
              {winner && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] rounded-2xl z-50 animate-in fade-in duration-300 pointer-events-none">
                  <div className="bg-[#1f1a16]/95 border-2 border-amber-600/50 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex flex-col items-center text-center">
                    <div className="text-amber-400 font-black tracking-widest text-xs uppercase mb-0.5">
                      OSHIDASHI · RING-OUT!
                    </div>
                    <div className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow">
                      {winner.toUpperCase()} WINS!
                    </div>
                    <div className="text-xs text-amber-200/80 font-semibold mt-1">
                      {winner === 'Blue Team' ? 'Red Team' : 'Blue Team'} was pushed out of the arena!
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Grammar Question Centered Directly UNDER the Arena in Single Question Mode */}
            {questionMode === 'single' && (
              <div className="w-full max-w-4xl mx-auto pt-2 pb-1 px-4 text-center z-20 shrink-0 pointer-events-none">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl py-2.5 sm:py-3 px-5 sm:px-6 shadow-lg border-2 border-amber-900/15">
                  <span className={`${getQuestionFontSize(currentQText)} font-black text-[#0f172a] leading-tight tracking-tight drop-shadow-sm break-words`}>
                    {renderQuestionText(currentQText)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM ANSWER AREA (TWO HORIZONTAL CONTAINERS SIDE BY SIDE) */}
          <div className="w-full flex flex-col md:flex-row gap-3 md:gap-5 shrink-0 z-20">
            {/* BLUE ANSWER CONTAINER */}
            <div className="flex-1 bg-[#0055fe] rounded-3xl md:rounded-[2.5rem] p-3 sm:p-4 md:p-5 shadow-2xl border-b-6 md:border-b-8 border-[#0038b3] flex flex-col justify-between">
              {/* Split Mode: Blue Question displayed directly on Blue side */}
              {questionMode === 'split' && (
                <div className="bg-white rounded-2xl md:rounded-3xl p-3 sm:p-4 mb-2.5 sm:mb-3.5 shadow-lg border-2 border-blue-400/40 text-center flex flex-col justify-center min-h-[68px] sm:min-h-[82px]">
                  <div className={`${getQuestionFontSize(leftTeam.q?.text || "")} font-black text-[#0f172a] leading-tight px-1 break-words`}>
                    {renderQuestionText(leftTeam.q?.text || "")}
                  </div>
                </div>
              )}

              <div className={`grid gap-2 sm:gap-3 md:gap-4 ${
                (leftTeam.q?.options?.length || 4) === 2 
                  ? 'grid-cols-2' 
                  : (leftTeam.q?.options?.length || 4) === 3 
                    ? 'grid-cols-3' 
                    : 'grid-cols-4'
              }`}>
                {leftTeam.q?.options.map((opt: string, idx: number) => {
                  const keyHints = getBlueKeyHints(leftTeam.q?.options?.length || 4);
                  const isKeyActive = activeKey?.team === 'left' && activeKey?.index === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveKey({ team: 'left', index: idx });
                        setTimeout(() => setActiveKey(null), 160);
                        handleAnswer('left', idx);
                      }}
                      disabled={leftTeam.stunned || leftTeam.frozen}
                      className={`bg-white hover:bg-blue-50 active:translate-y-2 rounded-2xl md:rounded-3xl p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[76px] sm:min-h-[88px] md:min-h-[105px] lg:min-h-[120px] shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                        isKeyActive ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-blue-100 ring-4 ring-white' : ''
                      } ${leftTeam.stunned || leftTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-[#dbeafe] flex items-center justify-center font-black text-[#0055fe] text-[10px] sm:text-xs md:text-sm shadow-xs mb-1 shrink-0">
                        {keyHints[idx] || (idx + 1)}
                      </div>
                      <div className="flex-1 w-full flex items-center justify-center px-0.5 overflow-hidden">
                        <span className={`${getOptionFontSize(opt, leftTeam.q?.options?.length || 4)} font-black text-[#0f172a] text-center leading-tight break-normal whitespace-normal line-clamp-2`}>
                          {opt}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RED ANSWER CONTAINER */}
            <div className="flex-1 bg-[#cc0000] rounded-3xl md:rounded-[2.5rem] p-3 sm:p-4 md:p-5 shadow-2xl border-b-6 md:border-b-8 border-[#990000] flex flex-col justify-between">
              {/* Split Mode: Red Question displayed directly on Red side */}
              {questionMode === 'split' && (
                <div className="bg-white rounded-2xl md:rounded-3xl p-3 sm:p-4 mb-2.5 sm:mb-3.5 shadow-lg border-2 border-red-400/40 text-center flex flex-col justify-center min-h-[68px] sm:min-h-[82px]">
                  <div className={`${getQuestionFontSize(rightTeam.q?.text || "")} font-black text-[#0f172a] leading-tight px-1 break-words`}>
                    {renderQuestionText(rightTeam.q?.text || "")}
                  </div>
                </div>
              )}

              <div className={`grid gap-2 sm:gap-3 md:gap-4 ${
                (rightTeam.q?.options?.length || 4) === 2 
                  ? 'grid-cols-2' 
                  : (rightTeam.q?.options?.length || 4) === 3 
                    ? 'grid-cols-3' 
                    : 'grid-cols-4'
              }`}>
                {rightTeam.q?.options.map((opt: string, idx: number) => {
                  const keyHints = getRedKeyHints(rightTeam.q?.options?.length || 4);
                  const isKeyActive = activeKey?.team === 'right' && activeKey?.index === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveKey({ team: 'right', index: idx });
                        setTimeout(() => setActiveKey(null), 160);
                        handleAnswer('right', idx);
                      }}
                      disabled={rightTeam.stunned || rightTeam.frozen}
                      className={`bg-white hover:bg-red-50 active:translate-y-2 rounded-2xl md:rounded-3xl p-2 sm:p-2.5 md:p-3 flex flex-col items-center justify-between min-h-[76px] sm:min-h-[88px] md:min-h-[105px] lg:min-h-[120px] shadow-[0_5px_0_#cbd5e1] md:shadow-[0_7px_0_#94a3b8] active:shadow-[0_2px_0_#94a3b8] transition-all cursor-pointer ${
                        isKeyActive ? 'translate-y-2 shadow-[0_2px_0_#94a3b8] bg-red-100 ring-4 ring-white' : ''
                      } ${rightTeam.stunned || rightTeam.frozen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 rounded-md sm:rounded-lg bg-[#fee2e2] flex items-center justify-center font-black text-[#cc0000] text-[10px] sm:text-xs md:text-sm shadow-xs mb-1 shrink-0">
                        {keyHints[idx] || (idx + 1)}
                      </div>
                      <div className="flex-1 w-full flex items-center justify-center px-0.5 overflow-hidden">
                        <span className={`${getOptionFontSize(opt, rightTeam.q?.options?.length || 4)} font-black text-[#0f172a] text-center leading-tight break-normal whitespace-normal line-clamp-2`}>
                          {opt}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SumoStadiumEnvironment>

        {/* 3-Mode Selection Modal */}
        <GameModeModal
          isOpen={showModeModal}
          gameData={{
            id: activeGame?.id,
            name: activeGame?.title,
            topic: activeGame?.topic,
            className: activeGame?.classLevel,
            gameType: 'sumo',
            customQuestions: activeGame?.questions || DEFAULT_QUESTIONS
          }}
          onClose={() => setShowModeModal(false)}
          onSelectMode={(mode, adaptedData) => {
            onViewChange(mode as ViewState, adaptedData);
          }}
        />
      </div>
    );
}

function GameEditor({ game, onSave, onCancel, folders }: { game: GameData, onSave: (q: GameData) => void, onCancel: () => void, folders: { id: string; name: string }[] }) {
  const [folderId, setFolderId] = useState(game.folderId || "");
  const [topic, setTopic] = useState(game.topic || "");
  const [classLevel, setClassLevel] = useState(game.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(() => {
    return game.questions.map(q => {
        if (!q.options || q.options.length < 2) return { ...q, options: ['', ''], answerIndex: 0 };
        return { ...q, options: [...q.options] };
    });
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [activeGiphyInput, setActiveGiphyInput] = useState<{ qId: number | string, optIndex: number } | null>(null);

  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]);
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

  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

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
      options: item.options || ["", ""],
      answerIndex: item.answerIndex || 0,
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }
    
    setShowBulkPasteModal(false);
    setBulkText("");
    setToastMsg(`Successfully added ${newItems.length} items!`);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleBulkPaste = (e: React.ClipboardEvent) => {
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
        options: item.options || ["", ""],
        answerIndex: item.answerIndex || 0,
      }));

      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].text.trim()) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
      setToastMsg(`Smart Paste: Added ${newItems.length} items`);
      setTimeout(() => setToastMsg(""), 3000);
    }
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


  const initiateSave = () => {
    const validQuestions = questions.filter(q => q.text.trim());
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const handleSave = (isPublic: boolean) => {
    const generatedTitle = "Sumo Showdown";
    const validQuestions = questions.filter(q => q.text.trim());
    
    onSave({
      ...game,
      title: generatedTitle,
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
  
        {toastMsg && (
          <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
            <Sparkles size={18} /> {toastMsg}
          </div>
        )}

        {/* Bulk Paste Modal */}
        {showBulkPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">Bulk Add Q&As</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Paste text to automatically generate questions</p>
                  </div>
                </div>
                <button onClick={() => setShowBulkPasteModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/30">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 text-sm mb-2">Supported formats:</h4>
                <ul className="text-xs text-blue-600/80 dark:text-blue-400/80 space-y-1 list-disc list-inside">
                  <li><strong>Standard text:</strong> Paste a list of terms/questions, one per line.</li>
                  <li><strong>Excel/Sheets:</strong> Copy cells (Question | Option1 | Option2 | Option3 | Option4).</li>
                  <li><strong>Numbered Q&As:</strong> "1. Question?\nA. Option 1\nB. Option 2".</li>
                </ul>
              </div>

              <textarea 
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"Example:\n1. What is the capital of France?\nA. London\nB. Paris\nC. Berlin\nD. Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!"}
                className="w-full h-64 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-xl focus:border-cyan-500 resize-none font-medium text-sm leading-relaxed"
              ></textarea>

              {bulkText.trim() && (
                <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-lg text-sm font-bold animate-in fade-in">
                  <Sparkles size={16} />
                  <p>
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
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                >
                  Append to End
                </button>
              </div>
            </div>
          </div>
        )}

      {showPublishModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-6 transform scale-100 animate-in fade-in zoom-in-95 duration-150 border border-slate-100 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 dark:text-white text-center">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 text-center font-medium">
              Would you like to publish this game to the Community so other teachers can use it?
            </p>
            <div className="flex flex-col gap-3 mt-4">
              <button 
                onClick={() => handleSave(true)}
                className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 cursor-pointer"
              >
                Yes, Publish (Public)
              </button>
              <button 
                onClick={() => handleSave(false)}
                className="w-full py-4 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-lg transition-colors cursor-pointer"
              >
                No, Keep Private
              </button>
            </div>
            <button 
              onClick={() => setShowPublishModal(false)}
              className="mt-2 text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer text-center"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body
      )}
      <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">GAME SETUP</h2>
                <div className="flex gap-3 items-center">
                    <button onClick={onCancel} className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={initiateSave} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer">
                        <Save size={18} /> Save GameData
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Topic</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Present Simple" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Class Level</label>
                    <input 
                      type="text" 
                      placeholder="e.g. KET, Starters" 
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Folder</label>
                    <select 
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors"
                    >
                      <option value="">No Folder (Root)</option>
                      {folders.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                </div>
            </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/20 text-red-400 p-3 mx-6 mt-6 rounded-lg font-medium text-center border border-red-500/30 animate-pulse">
            {errorMsg}
          </div>
        )}

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50" onPaste={handleBulkPaste}>
          {/* Smart Paste Banner */}
          <div className="bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                <Info size={18} />
              </div>
              <p className="text-xs sm:text-sm font-medium">
                <span className="font-bold">Smart Paste:</span> Paste multiple lines, numbered Q&As, or Excel rows directly into any box below — they will automatically populate!
              </p>
            </div>
            <button
              onClick={() => setShowBulkPasteModal(true)}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
            >
              <ClipboardList size={14} /> Bulk Paste Modal
            </button>
          </div>

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
                className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
              
              <div className="flex gap-4 mb-4 items-start">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                  {index + 1}
                </div>
                <input 
                  id={`question-input-${index}`}
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  placeholder="Type your question here..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-slate-800 dark:text-white font-medium"
                />
              </div>

              <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {q.options.map((opt, optIndex) => (
                  <div key={optIndex} className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      name={`answer-${q.id}`} 
                      checked={q.answerIndex === optIndex}
                      onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                      className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                    />
                    {opt.startsWith('data:image') || opt.startsWith('http') ? (
                      <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 pr-3">
                        <img src={opt} alt="Option" className="w-8 h-8 rounded object-cover" />
                        <span className="text-xs text-slate-400 flex-1 truncate">Image/GIF</span>
                        <button onClick={() => updateOption(q.id, optIndex, '')} className="text-red-400 hover:text-red-300 cursor-pointer p-1">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center gap-2">
                        <input 
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(q.id, optIndex, e.target.value)}
                          placeholder={`Option ${optIndex + 1}`}
                          className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${q.answerIndex === optIndex ? 'border-blue-500/50 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'} rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium`}
                        />
                        <button 
                          onClick={() => setActiveGiphyInput({ qId: q.id, optIndex })}
                          className="bg-purple-500/20 text-purple-400 p-2 rounded-lg hover:bg-purple-500 hover:text-white transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                          title="Search Giphy"
                        >
                          <ImageIcon size={16} />
                        </button>
                      </div>
                    )}
                  </div>
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
        onSelect={(url) => {
          if (activeGiphyInput) {
            updateOption(activeGiphyInput.qId, activeGiphyInput.optIndex, url);
            setActiveGiphyInput(null);
          }
        }}
      />
    </div>
  );
}

function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];
  
  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter(line => line.trim());
    lines.forEach(line => {
      const parts = line.split('\t').map(p => p.trim());
      if (parts.length > 0) {
        items.push({
          text: parts[0],
          options: [
            parts[1] || "",
            parts[2] || "",
            parts[3] || "",
            parts[4] || ""
          ],
          answerIndex: 0
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
  
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentQ: Partial<Question> | null = null;
  const optionRegex = /^([a-eA-E1-4])[\.\)\:\-]\s+(.*)/;
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    const ansMatch = line.match(/^answer\s*[:=]?\s*([a-eA-E1-4])/i);
    if (ansMatch) {
       if (currentQ) {
          const val = ansMatch[1].toUpperCase();
          if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
          else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
       }
       continue;
    }

    let inlineAnswerMatch = line.match(/\banswer\s*[:=]?\s*([a-eA-E1-4])\b/i);
    let inlineAnswerIndex = -1;
    if (inlineAnswerMatch) {
       const val = inlineAnswerMatch[1].toUpperCase();
       if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
       else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
       line = line.replace(inlineAnswerMatch[0], '').trim();
    }
    
    if (line === '') continue;
    
    const optMatch = line.match(optionRegex);
    if (optMatch) {
       if (!currentQ) {
          currentQ = { text: "Question", options: ["", "", "", ""], answerIndex: 0 };
          items.push(currentQ);
       }
       
       const optText = optMatch[2].trim();
       const prefix = optMatch[1].toUpperCase();
       let expectedIndex = -1;
       if (/[A-E]/.test(prefix)) expectedIndex = prefix.charCodeAt(0) - 65;
       else if (/[1-4]/.test(prefix)) expectedIndex = parseInt(prefix) - 1;
       
       if (expectedIndex >= 0 && expectedIndex < 4) {
           currentQ.options![expectedIndex] = optText;
       } else {
           const emptyIdx = currentQ.options!.findIndex(o => o === "");
           if (emptyIdx !== -1) currentQ.options![emptyIdx] = optText;
       }
       
       if (inlineAnswerIndex !== -1) {
           currentQ.answerIndex = inlineAnswerIndex;
       }
    } else {
       const hasOptions = currentQ && currentQ.options!.some(o => o !== "");
       const qText = line.replace(/^(?:\d+[\.\)\:\-]|\[\d+\])\s+/, "");
       
       if (!currentQ || hasOptions) {
           currentQ = { text: qText, options: ["", "", "", ""], answerIndex: 0 };
           items.push(currentQ);
           if (inlineAnswerIndex !== -1) {
               currentQ.answerIndex = inlineAnswerIndex;
           }
       } else {
           currentQ.text += " " + qText;
           if (inlineAnswerIndex !== -1) {
               currentQ.answerIndex = inlineAnswerIndex;
           }
       }
    }
  }

  const allEmptyOptions = items.every(q => q.options!.every(o => o === ""));
  
  // Ensure each question has at least 4 options
  items.forEach(q => {
     if (q.options) {
        while (q.options.length < 4) {
            q.options.push("");
        }
     }
  });

  if (allEmptyOptions && items.length > 0) {
     return items; 
  }

  return items;
}
