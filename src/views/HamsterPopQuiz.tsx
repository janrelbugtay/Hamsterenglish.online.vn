import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
const Player: any = ReactPlayer;
import {
  Play, Pause, Video, Settings,
  CheckCircle, XCircle, Sparkles, Volume2, VolumeX,
  Plus, Trash2, Check, Loader2, Folder, FolderPlus,
  ArrowRight, ArrowLeft, RotateCcw, SkipForward, SkipBack,
  Edit3, Upload, Globe, Lock, AlertCircle, FileVideo, X,
  Clock, Maximize2, Minimize2
} from 'lucide-react';
import { ViewState } from "../types";
import { FullscreenButton } from "../components/FullscreenButton";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { persistUserGameToCloudAndCache } from "../utils/platformCache";
import {
  mergeUserFolders,
  fetchAllAvailableFolders,
  createUnifiedFolder,
  UnifiedFolderItem,
} from "../lib/gameStore";

const customStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  .vq-display { font-family: 'Outfit', sans-serif; }
  .vq-body { font-family: 'Plus Jakarta Sans', sans-serif; }
  .vq-mono { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }

  @keyframes vqPopIn {
    0% { transform: scale(0.96) translateY(8px); opacity: 0; }
    100% { transform: scale(1) translateY(0); opacity: 1; }
  }
  @keyframes vqFadeUp {
    0% { transform: translateY(12px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  @keyframes vqConfetti {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(100vh) rotate(540deg); opacity: 0; }
  }

  .animate-vq-pop { animation: vqPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .animate-vq-fade { animation: vqFadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

  .vq-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
  .vq-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.03); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb { background: rgba(245, 158, 11, 0.35); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(245, 158, 11, 0.6); }
`;

const CEFR_LEVELS = ['Starters', 'Movers', 'Flyers', 'KET', 'B1', 'B2'];
const QUESTION_TYPES = [
  'Fill in the Blanks',
  'Multiple Choice',
  'Grammar Choice',
  'True or False',
  'Vocabulary Meaning',
];
const QUESTION_COUNT_PRESETS = [5, 10, 15, 20, 30];

const POPULAR_GRAMMAR_TOPICS = [
  "Must and mustn't",
  'Should and shouldn\'t',
  'Present Perfect',
  'Past Simple',
  'Present Continuous',
  'Passive Voice',
  'Conditionals',
];

const normalizeEnglishLevel = (raw?: string): string => {
  const s = (raw || '').trim();
  if (!s) return 'Movers';
  if (CEFR_LEVELS.includes(s)) return s;
  const lower = s.toLowerCase();
  if (lower.includes('starter') || lower.includes('pre-a1') || lower === 'a1') return 'Starters';
  if (lower.includes('mover')) return 'Movers';
  if (lower.includes('flyer')) return 'Flyers';
  if (lower.includes('ket') || lower.includes('a2 key')) return 'KET';
  if (lower.includes('b1')) return 'B1';
  if (lower.includes('b2') || lower.includes('c1')) return 'B2';
  return 'Movers';
};

export interface QuizAnswerRecord {
  isCorrect: boolean;
  selectedIndex: number;
  responseTimeSec: number;
  earnedXp: number;
}

// Rich Multi-Harmonic Classroom Game-Show Sound Effects
class VideoQuizAudio {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playPop() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    sub.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(960, now + 0.12);
    sub.frequency.setValueAtTime(240, now);
    sub.frequency.exponentialRampToValueAtTime(480, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.16);
    sub.stop(now + 0.16);
  }

  playCorrect() {
    const ctx = this.getContext();
    if (!ctx) return;
    const baseTime = ctx.currentTime;

    // Bright, celebratory ascending chime arpeggio (C5 -> E5 -> G5 -> C6 -> E6)
    const chimeNotes = [
      { freq: 523.25, delay: 0.0, duration: 0.28, vol: 0.22 },
      { freq: 659.25, delay: 0.065, duration: 0.28, vol: 0.24 },
      { freq: 783.99, delay: 0.13, duration: 0.32, vol: 0.25 },
      { freq: 1046.5, delay: 0.195, duration: 0.45, vol: 0.28 },
      { freq: 1318.51, delay: 0.26, duration: 0.55, vol: 0.24 },
    ];

    chimeNotes.forEach(({ freq, delay, duration, vol }) => {
      const start = baseTime + delay;
      const mainOsc = ctx.createOscillator();
      const sparkleOsc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      mainOsc.type = 'triangle';
      sparkleOsc.type = 'sine';
      mainOsc.frequency.setValueAtTime(freq, start);
      sparkleOsc.frequency.setValueAtTime(freq * 2, start); // Shimmering octave harmonic

      const sparkleGain = ctx.createGain();
      sparkleGain.gain.setValueAtTime(0.35, start);

      noteGain.gain.setValueAtTime(0.001, start);
      noteGain.gain.linearRampToValueAtTime(vol, start + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      mainOsc.connect(noteGain);
      sparkleOsc.connect(sparkleGain);
      sparkleGain.connect(noteGain);
      noteGain.connect(ctx.destination);

      mainOsc.start(start);
      sparkleOsc.start(start);
      mainOsc.stop(start + duration + 0.02);
      sparkleOsc.stop(start + duration + 0.02);
    });

    // Warm triumphant major chord sustain underneath
    [523.25, 659.25, 783.99].forEach((chordFreq) => {
      const start = baseTime + 0.19;
      const padOsc = ctx.createOscillator();
      const padGain = ctx.createGain();
      padOsc.type = 'sine';
      padOsc.frequency.setValueAtTime(chordFreq, start);
      padGain.gain.setValueAtTime(0.001, start);
      padGain.gain.linearRampToValueAtTime(0.09, start + 0.03);
      padGain.gain.exponentialRampToValueAtTime(0.001, start + 0.6);
      padOsc.connect(padGain);
      padGain.connect(ctx.destination);
      padOsc.start(start);
      padOsc.stop(start + 0.62);
    });
  }

  playWrong() {
    const ctx = this.getContext();
    if (!ctx) return;
    const baseTime = ctx.currentTime;

    // Classic, unmistakable two-step descending game-show wrong answer buzz ("uh-oh / buzz")
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, baseTime);
    filter.connect(ctx.destination);

    const steps = [
      { startFreq: 311.13, endFreq: 277.18, delay: 0.0, duration: 0.18, vol: 0.22 }, // Eb4 -> C#4
      { startFreq: 233.08, endFreq: 164.81, delay: 0.16, duration: 0.34, vol: 0.25 }, // Bb3 -> E3
    ];

    steps.forEach(({ startFreq, endFreq, delay, duration, vol }) => {
      const start = baseTime + delay;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const stepGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      subOsc.type = 'triangle';

      osc1.frequency.setValueAtTime(startFreq, start);
      osc1.frequency.linearRampToValueAtTime(endFreq, start + duration);

      // Slight detune for rich game-show buzzer texture
      osc2.frequency.setValueAtTime(startFreq * 1.015, start);
      osc2.frequency.linearRampToValueAtTime(endFreq * 1.015, start + duration);

      subOsc.frequency.setValueAtTime(startFreq * 0.5, start);
      subOsc.frequency.linearRampToValueAtTime(endFreq * 0.5, start + duration);

      stepGain.gain.setValueAtTime(0.001, start);
      stepGain.gain.linearRampToValueAtTime(vol, start + 0.015);
      stepGain.gain.setValueAtTime(vol * 0.85, start + duration * 0.65);
      stepGain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc1.connect(stepGain);
      osc2.connect(stepGain);
      subOsc.connect(stepGain);
      stepGain.connect(filter);

      osc1.start(start);
      osc2.start(start);
      subOsc.start(start);
      osc1.stop(start + duration + 0.02);
      osc2.stop(start + duration + 0.02);
      subOsc.stop(start + duration + 0.02);
    });
  }

  playFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    });
  }
}

const vqAudio = new VideoQuizAudio();

const formatSeconds = (sec: number) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
};

const parseTimeInputToSeconds = (val: string): number | null => {
  const trimmed = (val || '').trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => Number(p.trim()));
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return Math.max(1, Math.floor(parts[0] * 60 + parts[1]));
    }
  }
  const num = Number(trimmed);
  if (Number.isFinite(num) && num >= 0) {
    return Math.max(1, Math.floor(num));
  }
  return null;
};

const isDirectVideoSource = (url: string) => {
  if (!url) return false;
  if (url.startsWith('blob:') || url.startsWith('data:video/')) return true;
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url);
};

const extractClientYouTubeId = (urlRaw?: string): string | null => {
  const s = (urlRaw || '').trim();
  if (!s) return null;
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

const isLegacyPlaceholderQuestion = (textRaw?: string): boolean => {
  const t = (textRaw || '').trim();
  if (!t) return true;
  return /what is the main focus of this scene|what does .* mean in this context|key details and actions related to|an unrelated topic not shown|a silent title card/i.test(
    t
  );
};

const hasOnlyDummyOptionPlaceholders = (options?: any[]): boolean => {
  if (!Array.isArray(options) || options.length === 0) return true;
  return options.every((o) => {
    const txt = (typeof o === 'string' ? o : o?.text || '').trim();
    return !txt || /^Option\s+[A-D1-4]$/i.test(txt);
  });
};

// Smart helper to infer a sensible missing word when a teacher types a Fill-in-the-Blank sentence like "He has____ at the mirror"
const inferSmartBlankAnswerFromQuestion = (questionText: string): {
  answer: string;
  acceptedAnswers: string[];
} => {
  const q = (questionText || '').trim();
  const lower = q.toLowerCase();

  // Check if verb hint is in brackets, e.g., "He has ____ (look) at the mirror"
  const bracketMatch = q.match(/\(([a-zA-Z\s]+)\)/);
  if (bracketMatch?.[1]) {
    const base = bracketMatch[1].trim().toLowerCase();
    const irregularV3: Record<string, string> = {
      be: 'been',
      do: 'done',
      go: 'gone',
      make: 'made',
      see: 'seen',
      take: 'taken',
      break: 'broken',
      choose: 'chosen',
      drive: 'driven',
      eat: 'eaten',
      fall: 'fallen',
      find: 'found',
      forget: 'forgotten',
      get: 'gotten',
      give: 'given',
      have: 'had',
      know: 'known',
      leave: 'left',
      lose: 'lost',
      put: 'put',
      run: 'run',
      say: 'said',
      sit: 'sat',
      speak: 'spoken',
      stand: 'stood',
      think: 'thought',
      wear: 'worn',
      write: 'written',
    };
    if (/\b(has|have|had)\b/i.test(lower)) {
      const v3 =
        irregularV3[base] ||
        (base.endsWith('e')
          ? `${base}d`
          : base.endsWith('y') && !/[aeiou]y$/.test(base)
          ? `${base.slice(0, -1)}ied`
          : `${base}ed`);
      return {
        answer: v3,
        acceptedAnswers: [v3, `has ${v3}`, `have ${v3}`],
      };
    }
    return { answer: base, acceptedAnswers: [base] };
  }

  if (/\bmirror\b/i.test(lower)) {
    if (/\b(has|have)\b/i.test(lower)) {
      return {
        answer: 'looked',
        acceptedAnswers: ['looked', 'has looked', 'stared', 'checked', 'seen himself'],
      };
    }
    return {
      answer: 'looks',
      acceptedAnswers: ['looks', 'looked', 'is looking', 'has looked'],
    };
  }

  if (/\b(sink|hands|water|tap|faucet)\b/i.test(lower)) {
    if (/\b(has|have)\b/i.test(lower)) {
      return {
        answer: 'washed',
        acceptedAnswers: ['washed', 'has washed', 'turned on', 'cleaned'],
      };
    }
    return {
      answer: 'washed',
      acceptedAnswers: ['washed', 'washes', 'is washing'],
    };
  }

  if (/\b(has|have)\s*_+/i.test(lower)) {
    return {
      answer: 'looked',
      acceptedAnswers: ['looked', 'made', 'done', 'tried', 'seen', 'gone'],
    };
  }

  return {
    answer: 'looked',
    acceptedAnswers: ['looked', 'done', 'made', 'tried'],
  };
};

const normalizeBlankQuestionText = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  // Ensure there's a clean space before and after ____ if attached to words like "has____"
  return trimmed.replace(/([a-zA-Z])(_+)/g, '$1 $2').replace(/(_+)([a-zA-Z])/g, '$1 $2');
};

const checkFillInBlankMatch = (
  userInputRaw: string,
  quiz: any
): { isCorrect: boolean; primaryAnswer: string } => {
  const cleanText = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[.,!?;:'"()[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const userClean = cleanText(userInputRaw);
  const correctOpt = (quiz?.options || []).find((o: any) => o?.isCorrect);
  const primaryAnswer = String(
    quiz?.answer || correctOpt?.text || quiz?.options?.[0]?.text || ''
  ).trim();

  if (!userClean) {
    return { isCorrect: false, primaryAnswer };
  }

  const candidatePool = new Set<string>();
  const addWithContractionVariants = (rawVal: string) => {
    const cleaned = cleanText(rawVal);
    if (!cleaned) return;
    candidatePool.add(cleaned);
    // Also allow with/without apostrophe from raw string
    const noApostrophe = rawVal
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[.,!?;:"()[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (noApostrophe) candidatePool.add(noApostrophe);

    const lowerRaw = rawVal.toLowerCase().replace(/’/g, "'").trim();
    const contractionPairs: Array<[RegExp, string]> = [
      [/\bmustn'?t\b/g, 'must not'],
      [/\bmust not\b/g, 'mustnt'],
      [/\bshouldn'?t\b/g, 'should not'],
      [/\bshould not\b/g, 'shouldnt'],
      [/\bcan'?t\b/g, 'cannot'],
      [/\bcannot\b/g, 'cant'],
      [/\bcouldn'?t\b/g, 'could not'],
      [/\bdon'?t\b/g, 'do not'],
      [/\bdoesn'?t\b/g, 'does not'],
      [/\bdidn'?t\b/g, 'did not'],
      [/\bhaven'?t\b/g, 'have not'],
      [/\bhasn'?t\b/g, 'has not'],
      [/\bwouldn'?t\b/g, 'would not'],
      [/\bwon'?t\b/g, 'will not'],
      [/\bisn'?t\b/g, 'is not'],
      [/\baren'?t\b/g, 'are not'],
      [/\bwasn'?t\b/g, 'was not'],
      [/\bweren'?t\b/g, 'were not'],
    ];
    contractionPairs.forEach(([pattern, replacement]) => {
      if (pattern.test(lowerRaw)) {
        candidatePool.add(cleanText(lowerRaw.replace(pattern, replacement)));
      }
    });
  };

  if (primaryAnswer) {
    addWithContractionVariants(primaryAnswer);
    if (primaryAnswer.includes('...')) {
      const parts = primaryAnswer
        .split('...')
        .map((p) => cleanText(p))
        .filter(Boolean);
      candidatePool.add(parts.join(' '));
      if (parts.length > 0) candidatePool.add(parts[parts.length - 1]);
    }
  }

  if (Array.isArray(quiz?.acceptedAnswers)) {
    quiz.acceptedAnswers.forEach((a: string) => {
      addWithContractionVariants(String(a || ''));
    });
  }

  Array.from(candidatePool).forEach((cand) => {
    const strippedAux = cand.replace(/^(has|have|had|is|are|was|were)\s+/i, '').trim();
    if (strippedAux) {
      candidatePool.add(strippedAux);
      candidatePool.add(`has ${strippedAux}`);
      candidatePool.add(`have ${strippedAux}`);
    }
  });

  const userNoApostrophe = userInputRaw
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[.,!?;:"()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    isCorrect: candidatePool.has(userClean) || (Boolean(userNoApostrophe) && candidatePool.has(userNoApostrophe)),
    primaryAnswer: primaryAnswer || 'must',
  };
};

const extractClientVideoSubject = (videoTitleRaw?: string, topicRaw?: string): string => {
  const combined = `${videoTitleRaw || ''} ${topicRaw || ''}`;
  if (/mr\.?\s*bean/i.test(combined)) return 'Mr. Bean';
  if (/pink\s*panther/i.test(combined)) return 'The Pink Panther';
  if (/tom\s*and\s*jerry/i.test(combined)) return 'Tom and Jerry';
  if (/spongebob/i.test(combined)) return 'SpongeBob';
  if (/peppa\s*pig/i.test(combined)) return 'Peppa Pig';
  if (/paddington/i.test(combined)) return 'Paddington';
  if (/harry\s*potter/i.test(combined)) return 'Harry Potter';
  if (/minion/i.test(combined)) return 'the Minions';
  if (/hamster/i.test(combined)) return 'the hamster';

  const cleanTitle = (videoTitleRaw || '')
    .replace(/\[.*?\]|\(.*?\)/g, ' ')
    .replace(
      /\b(4k|hd|official|video|clip|clips|funny|full|episode|seconds|minutes|hours|of|the|best|worst|ideas|ever|compilation|scene|scenes|movie|cartoon)\b/gi,
      ' '
    )
    .replace(/[|•:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanTitle.length >= 3 && cleanTitle.length <= 32) {
    return cleanTitle;
  }
  return 'the main character';
};

const generateDynamicQuestions = (config: any) => {
  const topic = (config?.topic || '').trim();
  const topicLower = topic.toLowerCase();
  const videoTitle = (config?.videoTitle || '').trim();
  const cleanTitle = videoTitle.replace(/\s*\|.*$/, '').trim() || 'this video';
  const types: string[] =
    Array.isArray(config?.selectedTypes) && config.selectedTypes.length > 0
      ? config.selectedTypes
      : ['Fill in the Blanks', 'Multiple Choice', 'Grammar Choice'];
  const count = Math.max(1, Math.min(100, Number(config?.count) || 5));
  const duration = Math.max(60, Number(config?.videoDuration) || 540);
  const usableStart = Math.max(8, Math.floor(duration * 0.04));
  const usableSpan = Math.max(30, Math.floor(duration * 0.90) - usableStart);

  const subject = extractClientVideoSubject(videoTitle, topic);
  const isPluralSubject = /\b(and|they|minions|kids|students|animals|friends|people)\b/i.test(subject);
  const hasAux = isPluralSubject ? 'have' : 'has';
  const wrongAux = isPluralSubject ? 'has' : 'have';
  const wasAux = isPluralSubject ? 'were' : 'was';
  const isAux = isPluralSubject ? 'are' : 'is';
  const wrongIsAux = isPluralSubject ? 'is' : 'are';
  const haveToPos = isPluralSubject ? 'have to' : 'has to';
  const haveToNeg = isPluralSubject ? "don't have to" : "doesn't have to";

  const isHospital = /\b(hospital|doctor|nurse|ambulance|clinic|patient|medical|health|emergency|dentist)\b/i.test(
    videoTitle
  );
  const isSchool = /\b(school|class|classroom|exam|test|student|teacher|study|library)\b/i.test(videoTitle);
  const isFood = /\b(restaurant|kitchen|cook|food|dinner|lunch|eat|waiter|menu|steak|cafe)\b/i.test(videoTitle);

  const scenes = isHospital
    ? [
        {
          sceneLabel: 'outside the hospital entrance by the ambulance',
          location: 'outside the hospital entrance',
          mustRule: 'keep the ambulance entrance clear for emergency vehicles',
          mustntRule: 'park a car directly behind the hospital ambulance',
          shouldAction: 'park in a regular parking space instead of blocking the ambulance',
          shouldntAction: 'block the emergency ambulance doors with his car',
          v1: 'park',
          v2: 'parked',
          v3: 'parked',
          ing: 'parking',
          phrase: 'near the ambulance outside the hospital entrance',
        },
        {
          sceneLabel: 'at the hospital reception and queue ticket machine',
          location: 'in the hospital waiting area',
          mustRule: 'take a numbered ticket and wait for his turn',
          mustntRule: "steal or swap another patient's queue ticket in the hospital",
          shouldAction: 'check his waiting-room ticket number carefully',
          shouldntAction: 'trick other patients to get an earlier ticket number',
          v1: 'take',
          v2: 'took',
          v3: 'taken',
          ing: 'taking',
          phrase: 'a numbered ticket in the hospital waiting room',
        },
        {
          sceneLabel: 'in the hospital waiting room chairs',
          location: 'in the hospital waiting room',
          mustRule: 'sit quietly and respect the injured patients nearby',
          mustntRule: 'annoy or disturb the bandaged patient sitting next to him',
          shouldAction: 'wait calmly on his chair until his number is called',
          shouldntAction: 'fidget noisily and bother the patients in the row',
          v1: 'wait',
          v2: 'waited',
          v3: 'waited',
          ing: 'waiting',
          phrase: 'on the chair next to the bandaged patient in the hospital',
        },
        {
          sceneLabel: 'showing his stuck hand to the medical staff',
          location: 'at the hospital reception desk',
          mustRule: 'explain his injury honestly to the doctor and nurse',
          mustntRule: 'hide his stuck teapot hand when his turn arrives',
          shouldAction: 'ask the nurse or doctor for help removing the teapot',
          shouldntAction: 'pull the stuck teapot off roughly by himself',
          v1: 'show',
          v2: 'showed',
          v3: 'shown',
          ing: 'showing',
          phrase: 'his stuck hand at the hospital desk',
        },
        {
          sceneLabel: 'watching the electronic number board in the hospital',
          location: 'by the hospital display screen',
          mustRule: 'watch the electronic display board and go when his number flashes',
          mustntRule: 'push ahead of injured patients when the nurse calls a number',
          shouldAction: 'listen carefully when the nurse calls the next number',
          shouldntAction: 'turn the ticket upside down and confuse the queue number',
          v1: 'check',
          v2: 'checked',
          v3: 'checked',
          ing: 'checking',
          phrase: 'the electronic number board in the hospital waiting room',
        },
        {
          sceneLabel: 'inside the hospital corridor',
          location: 'inside the hospital corridor',
          mustRule: 'follow the hospital signs and obey the medical staff',
          mustntRule: 'touch medical equipment or bandages belonging to other patients',
          shouldAction: 'walk carefully along the hospital corridor',
          shouldntAction: 'run or cause chaos near the wheelchairs',
          v1: 'follow',
          v2: 'followed',
          v3: 'followed',
          ing: 'following',
          phrase: 'the signs along the hospital corridor',
        },
      ]
    : isSchool
    ? [
        {
          sceneLabel: 'at the desk during the classroom exam',
          location: 'in the examination room',
          mustRule: 'write his own answers quietly on the test paper',
          mustntRule: "copy answers from the student sitting at the next desk",
          shouldAction: 'prepare the right pens and pencils before the exam starts',
          shouldntAction: 'waste time taking out toys on the desk',
          v1: 'write',
          v2: 'wrote',
          v3: 'written',
          ing: 'writing',
          phrase: 'the answers on the exam paper at the desk',
        },
        {
          sceneLabel: 'when the teacher is watching the class',
          location: 'inside the classroom',
          mustRule: 'stop writing immediately when the teacher says time is up',
          mustntRule: 'cheat or make loud noises during the test',
          shouldAction: 'read the instructions on the exam envelope carefully',
          shouldntAction: 'study the wrong topic before the test',
          v1: 'open',
          v2: 'opened',
          v3: 'opened',
          ing: 'opening',
          phrase: 'the question envelope on the classroom desk',
        },
      ]
    : isFood
    ? [
        {
          sceneLabel: 'at the dining table with the food and menu',
          location: 'at the restaurant table',
          mustRule: 'use clean cutlery and behave politely at the table',
          mustntRule: "hide unwanted food inside napkins, flowerpots, or someone's bag",
          shouldAction: 'order a meal from the menu that he actually likes',
          shouldntAction: 'make a mess with the food when the waiter looks away',
          v1: 'order',
          v2: 'ordered',
          v3: 'ordered',
          ing: 'ordering',
          phrase: 'a special dish from the menu at the table',
        },
      ]
    : [
        {
          sceneLabel: `at the start of "${cleanTitle}"`,
          location: `in "${cleanTitle}"`,
          mustRule: 'follow the rules and pay attention to what is happening',
          mustntRule: `break the rules or cause an accident in "${cleanTitle}"`,
          shouldAction: `think carefully before acting in "${cleanTitle}"`,
          shouldntAction: 'rush into a silly mistake without looking first',
          v1: 'arrive',
          v2: 'arrived',
          v3: 'arrived',
          ing: 'arriving',
          phrase: `at the main location in "${cleanTitle}"`,
        },
        {
          sceneLabel: `when the problem begins in "${cleanTitle}"`,
          location: `in this scene of "${cleanTitle}"`,
          mustRule: 'stay calm and respect the other people in the room',
          mustntRule: `annoy or push the other people in "${cleanTitle}"`,
          shouldAction: 'ask for help politely when something goes wrong',
          shouldntAction: 'hide the mistake or blame someone else',
          v1: 'try',
          v2: 'tried',
          v3: 'tried',
          ing: 'trying',
          phrase: `to solve the problem in "${cleanTitle}"`,
        },
        {
          sceneLabel: `during the middle scene of "${cleanTitle}"`,
          location: `in "${cleanTitle}"`,
          mustRule: 'keep the area safe and follow the instructions on the signs',
          mustntRule: `touch things that belong to other people in "${cleanTitle}"`,
          shouldAction: 'use the equipment properly and safely',
          shouldntAction: 'do something dangerous or against the rules',
          v1: 'look',
          v2: 'looked',
          v3: 'looked',
          ing: 'looking',
          phrase: `closely at what is happening in "${cleanTitle}"`,
        },
        {
          sceneLabel: `near the end of "${cleanTitle}"`,
          location: `toward the end of "${cleanTitle}"`,
          mustRule: 'learn from the mistake and follow the proper rule next time',
          mustntRule: `repeat the same silly mistake at the end of "${cleanTitle}"`,
          shouldAction: 'apologize and clean up any mess before leaving',
          shouldntAction: 'leave a big mess behind for other people',
          v1: 'finish',
          v2: 'finished',
          v3: 'finished',
          ing: 'finishing',
          phrase: `the funny scene in "${cleanTitle}"`,
        },
      ];

  return Array.from({ length: count }, (_, index) => {
    const scene = scenes[index % scenes.length];
    const requestedType = types[index % types.length];
    const timeTrigger = Math.min(
      Math.max(8, Math.round(usableStart + ((index + 0.5) / count) * usableSpan)),
      Math.max(15, duration - 6)
    );

    const isMustTopic = /\bmust\b|\bmustn'?t\b|\bmust\s+not\b/i.test(topicLower);
    const isShouldTopic = /\bshould\b|\bshouldn'?t\b/i.test(topicLower);
    const isCanTopic = /\bcan\b|\bcan'?t\b|\bcould\b|\bcouldn'?t\b/i.test(topicLower);
    const isHaveToTopic = /\bhave\s+to\b|\bhas\s+to\b|\bdon'?t\s+have\s+to\b/i.test(topicLower);
    const isPresentPerfect =
      topicLower.includes('present perf') ||
      topicLower.includes('present per') ||
      /\b(have|has|just|already|yet|ever|never|since|for)\b/i.test(topicLower);
    const isPastSimple = topicLower.includes('past simple') || topicLower.includes('simple past');
    const isPresentCont =
      topicLower.includes('present continuous') || topicLower.includes('present progressive');

    let question = '';
    let answer = '';
    let acceptedAnswers: string[] = [];
    let options: Array<{ text: string; isCorrect: boolean }> = [];
    let explanation = '';

    if (isMustTopic) {
      const askMustnt = index % 2 === 0;
      if (requestedType === 'Fill in the Blanks') {
        question = askMustnt
          ? `Look at ${subject} ${scene.sceneLabel}: ${subject} ____ (must / mustn't) ${scene.mustntRule}.`
          : `Complete the rule ${scene.location}: "${subject} ____ (must / mustn't) ${scene.mustRule}."`;
        answer = askMustnt ? "mustn't" : 'must';
        acceptedAnswers = askMustnt ? ["mustn't", 'must not', 'mustnt'] : ['must'];
        options = [
          { text: answer, isCorrect: true },
          { text: askMustnt ? 'must' : "mustn't", isCorrect: false },
          { text: 'must to', isCorrect: false },
          { text: 'musts', isCorrect: false },
        ];
        explanation = askMustnt
          ? `We use "mustn't" (must not) for prohibition — something that is forbidden ${scene.location}.`
          : `We use "must + base verb" for an important rule or obligation ${scene.location}.`;
      } else {
        question = askMustnt
          ? `Choose the correct modal verb ${scene.sceneLabel}: "${subject} ____ ${scene.mustntRule}!"`
          : `Which sentence uses "must" or "mustn't" correctly ${scene.sceneLabel}?`;
        answer = askMustnt ? "mustn't" : `${subject} must ${scene.mustRule}.`;
        options = askMustnt
          ? [
              { text: "mustn't", isCorrect: true },
              { text: 'must', isCorrect: false },
              { text: 'must to', isCorrect: false },
              { text: "don't must", isCorrect: false },
            ]
          : [
              { text: `${subject} must ${scene.mustRule}.`, isCorrect: true },
              { text: `${subject} musts ${scene.mustRule}.`, isCorrect: false },
              { text: `${subject} must to ${scene.mustRule}.`, isCorrect: false },
              { text: `${subject} mustn't ${scene.mustRule}.`, isCorrect: false },
            ];
        explanation = `Use "must" for rules/obligations and "mustn't" for prohibitions, followed by the base verb.`;
      }
    } else if (isShouldTopic) {
      const askShouldnt = index % 2 === 0;
      question = askShouldnt
        ? `Give advice ${scene.sceneLabel}: "${subject} ____ (should / shouldn't) ${scene.shouldntAction}."`
        : `Complete the advice ${scene.location}: "${subject} ____ (should / shouldn't) ${scene.shouldAction}."`;
      answer = askShouldnt ? "shouldn't" : 'should';
      acceptedAnswers = askShouldnt ? ["shouldn't", 'should not', 'shouldnt'] : ['should'];
      options = [
        { text: answer, isCorrect: true },
        { text: askShouldnt ? 'should' : "shouldn't", isCorrect: false },
        { text: 'should to', isCorrect: false },
        { text: 'shoulds', isCorrect: false },
      ];
      explanation = `We use "should" and "shouldn't" + base verb to give advice ${scene.location}.`;
    } else if (isCanTopic) {
      const askCant = index % 2 === 0;
      question = askCant
        ? `In the scene ${scene.sceneLabel}, ${subject} ____ (can / can't) ${scene.mustntRule}.`
        : `In the scene ${scene.sceneLabel}, ${subject} ____ (can / can't) ${scene.mustRule}.`;
      answer = askCant ? "can't" : 'can';
      acceptedAnswers = askCant ? ["can't", 'cannot', 'cant'] : ['can'];
      options = [
        { text: answer, isCorrect: true },
        { text: askCant ? 'can' : "can't", isCorrect: false },
        { text: 'can to', isCorrect: false },
        { text: 'cans', isCorrect: false },
      ];
      explanation = `Use "can" for ability/permission and "can't" when something is not allowed or possible.`;
    } else if (isHaveToTopic) {
      question = `Complete the obligation sentence ${scene.sceneLabel}: "${subject} ____ (${haveToPos} / ${haveToNeg}) ${scene.mustRule}."`;
      answer = haveToPos;
      acceptedAnswers = [haveToPos, 'must'];
      options = [
        { text: haveToPos, isCorrect: true },
        { text: haveToNeg, isCorrect: false },
        { text: isPluralSubject ? 'has to' : 'have to', isCorrect: false },
        { text: 'having to', isCorrect: false },
      ];
      explanation = `With "${subject}", we use "${haveToPos} + base verb" to express necessity.`;
    } else if (isPresentPerfect) {
      if (requestedType === 'Fill in the Blanks') {
        question = `In the scene ${scene.sceneLabel}, ${subject} ${hasAux} ____ (${scene.v1}) ${scene.phrase}.`;
        answer = scene.v3;
        acceptedAnswers = [scene.v3, `${hasAux} ${scene.v3}`];
        options = [
          { text: scene.v3, isCorrect: true },
          { text: scene.v1, isCorrect: false },
          { text: scene.ing, isCorrect: false },
          { text: `${wrongAux} ${scene.v1}`, isCorrect: false },
        ];
        explanation = `In the Present Perfect, use "${hasAux} + ${scene.v3}" (past participle of "${scene.v1}").`;
      } else {
        question = `Complete the Present Perfect sentence ${scene.sceneLabel}: "${subject} ____ just ____ (${scene.v1}) ${scene.phrase}!"`;
        answer = `${hasAux} ... ${scene.v3}`;
        acceptedAnswers = [`${hasAux} ${scene.v3}`, scene.v3];
        options = [
          { text: `${hasAux} ... ${scene.v3}`, isCorrect: true },
          { text: `${wrongAux} ... ${scene.v1}`, isCorrect: false },
          { text: `did ... ${scene.v3}`, isCorrect: false },
          { text: `${isAux} ... ${scene.ing}`, isCorrect: false },
        ];
        explanation = `Present Perfect uses "${hasAux} + past participle (${scene.v3})".`;
      }
    } else if (isPastSimple) {
      question = `In the scene ${scene.sceneLabel}, ${subject} ____ (${scene.v1}) ${scene.phrase}.`;
      answer = scene.v2;
      acceptedAnswers = [scene.v2];
      options = [
        { text: scene.v2, isCorrect: true },
        { text: scene.v1, isCorrect: false },
        { text: scene.ing, isCorrect: false },
        { text: `did ${scene.v2}`, isCorrect: false },
      ];
      explanation = `The Past Simple form of "${scene.v1}" is "${scene.v2}".`;
    } else if (isPresentCont) {
      question = `Look at the scene ${scene.sceneLabel}! ${subject} ${isAux} ____ (${scene.v1}) ${scene.phrase}.`;
      answer = scene.ing;
      acceptedAnswers = [scene.ing, `${isAux} ${scene.ing}`];
      options = [
        { text: scene.ing, isCorrect: true },
        { text: scene.v1, isCorrect: false },
        { text: scene.v2, isCorrect: false },
        { text: `${wrongIsAux} ${scene.ing}`, isCorrect: false },
      ];
      explanation = `Present Continuous uses "${isAux} + ${scene.ing}" for actions happening right now on screen.`;
    } else if (/\b(and|vs\.?|or|\/)\b/i.test(topic)) {
      const parts = topic
        .split(/\s+(?:and|vs\.?|or|\/)\s+/i)
        .map((s: string) => s.trim())
        .filter(Boolean);
      const choiceA = (parts[0] || topic).toLowerCase();
      const choiceB = (parts[1] || `not ${choiceA}`).toLowerCase();
      const useB = index % 2 === 0;
      question = useB
        ? `Complete the sentence ${scene.sceneLabel}: "${subject} ____ (${choiceA} / ${choiceB}) ${scene.mustntRule}."`
        : `Complete the sentence ${scene.sceneLabel}: "${subject} ____ (${choiceA} / ${choiceB}) ${scene.mustRule}."`;
      answer = useB ? choiceB : choiceA;
      acceptedAnswers = [answer];
      options = [
        { text: answer, isCorrect: true },
        { text: useB ? choiceA : choiceB, isCorrect: false },
        { text: `${choiceA} to`, isCorrect: false },
        { text: `${choiceB}s`, isCorrect: false },
      ];
      explanation = `"${answer}" is the accurate form for this scene ${scene.location}.`;
    } else {
      const topicPrefix = topic ? `(${topic}) ` : '';
      question = `${topicPrefix}In the scene ${scene.sceneLabel}, ${subject} ____ (${scene.v1}) ${scene.phrase}.`;
      answer = scene.v2;
      acceptedAnswers = [scene.v2, scene.v1, scene.v3, `${hasAux} ${scene.v3}`, `${isAux} ${scene.ing}`];
      options = [
        { text: scene.v2, isCorrect: true },
        { text: scene.ing, isCorrect: false },
        { text: `to ${scene.v1}`, isCorrect: false },
        { text: `${wasAux} ${scene.v1}`, isCorrect: false },
      ];
      explanation = `In this scene ${scene.location}, "${scene.v2}" accurately completes the sentence.`;
    }

    const rotatedOpts = options.map((o) => ({ ...o }));
    if (rotatedOpts.length > 2) {
      const shift = index % rotatedOpts.length;
      for (let s = 0; s < shift; s++) {
        const first = rotatedOpts.shift();
        if (first) rotatedOpts.push(first);
      }
    }

    return {
      id: index + 1,
      timeTrigger,
      type: requestedType,
      xp: 100,
      question,
      answer,
      acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : [answer],
      options: rotatedOpts,
      explanation,
    };
  });
};

export function HamsterPopQuiz({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();
  const [savedGameRecord, setSavedGameRecord] = useState<any>(initialGame || null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [isMuted, setIsMuted] = useState(false);

  const [isLockedPlayMode, setIsLockedPlayMode] = useState<boolean>(
    Boolean(initialGame && !initialGame.editMode)
  );

  const buildQuestionsFromInitialGame = useCallback((game: any) => {
    const raw = game?.customQuestions || game?.questions || [];
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const total = raw.length;
    const gameTopic = game?.topic || game?.name || game?.title || '';
    const gameVideoTitle = game?.lessonConfig?.videoTitle || '';
    const gameLevel = normalizeEnglishLevel(game?.classLevel || game?.className);

    const replacementPool = generateDynamicQuestions({
      topic: gameTopic,
      videoTitle: gameVideoTitle,
      level: gameLevel,
      count: total,
    });

    return raw.map((q: any, idx: number) => {
      const text = (q.text || q.question || '').trim();
      if (isLegacyPlaceholderQuestion(text)) {
        const rep = replacementPool[idx % replacementPool.length];
        return {
          ...rep,
          id: q.id || idx + 1,
          timeTrigger:
            typeof q.timeTrigger === 'number'
              ? q.timeTrigger
              : rep.timeTrigger || Math.round(((idx + 1) / (total + 1)) * 90) + 5,
        };
      }
      const opts = Array.isArray(q.options) && q.options.length >= 2 ? q.options : [];
      const foundCorrect = opts.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect));
      const ansIdx =
        typeof q.answerIndex === 'number'
          ? q.answerIndex
          : foundCorrect >= 0
          ? foundCorrect
          : 0;

      // Detect if saved question is Fill in the Blanks or had dummy Option A/B/C/D
      const isBlankQuestion =
        q.type === 'Fill in the Blanks' ||
        (text.includes('___') && hasOnlyDummyOptionPlaceholders(opts));

      if (isBlankQuestion) {
        const inferred = inferSmartBlankAnswerFromQuestion(text);
        const rawAns =
          q.answer ||
          (opts[ansIdx] && !/^Option\s+[A-D1-4]$/i.test(String(opts[ansIdx]?.text || opts[ansIdx]))
            ? typeof opts[ansIdx] === 'string'
              ? opts[ansIdx]
              : opts[ansIdx]?.text
            : '') ||
          inferred.answer;

        return {
          id: q.id || idx + 1,
          timeTrigger:
            typeof q.timeTrigger === 'number'
              ? q.timeTrigger
              : Math.round(((idx + 1) / (total + 1)) * 90) + 5,
          type: 'Fill in the Blanks',
          xp: q.xp || 100,
          question: normalizeBlankQuestionText(text),
          answer: rawAns,
          acceptedAnswers: Array.isArray(q.acceptedAnswers)
            ? q.acceptedAnswers
            : [rawAns, ...inferred.acceptedAnswers],
          options: [{ text: rawAns, isCorrect: true }],
          explanation: q.explanation || `Correct answer: "${rawAns}".`,
        };
      }

      const safeOpts = opts.length >= 2 ? opts : ['True', 'False'];
      return {
        id: q.id || idx + 1,
        timeTrigger:
          typeof q.timeTrigger === 'number'
            ? q.timeTrigger
            : Math.round(((idx + 1) / (total + 1)) * 90) + 5,
        type: q.type || 'Multiple Choice',
        xp: q.xp || 100,
        question: text,
        answer:
          q.answer ||
          (typeof safeOpts[ansIdx] === 'string' ? safeOpts[ansIdx] : safeOpts[ansIdx]?.text || ''),
        options: safeOpts.map((o: any, oIdx: number) => ({
          text: typeof o === 'string' ? o : o?.text || `Choice ${oIdx + 1}`,
          isCorrect: oIdx === ansIdx,
        })),
        explanation:
          q.explanation ||
          `Correct answer: ${
            typeof safeOpts[ansIdx] === 'string' ? safeOpts[ansIdx] : safeOpts[ansIdx]?.text || ''
          }`,
      };
    });
  }, []);

  const initialMappedQuestions = buildQuestionsFromInitialGame(initialGame);
  const hasInitialVideo = Boolean(initialGame?.videoUrl);
  const [currentView, setCurrentView] = useState<'setup' | 'player'>(
    initialMappedQuestions && hasInitialVideo ? 'player' : 'setup'
  );
  const [questions, setQuestions] = useState<any[]>(initialMappedQuestions || []);
  const [openEditorOnMount, setOpenEditorOnMount] = useState<boolean>(
    Boolean(initialGame?.editMode && !isLockedPlayMode)
  );
  const [lessonConfig, setLessonConfig] = useState<any>(
    initialGame
      ? {
          topic: initialGame.topic || initialGame.name || initialGame.title || '',
          videoTitle: initialGame.lessonConfig?.videoTitle || '',
          level: normalizeEnglishLevel(initialGame.classLevel || initialGame.className),
          count: initialGame.lessonConfig?.count || (initialMappedQuestions?.length || 5),
          className: initialGame.className || '',
          folderId: initialGame.folderId || '',
          folder: initialGame.folderName || '',
          isPublic: initialGame.isPublic ?? true,
        }
      : {
          topic: '', // Do NOT automatically load a quiz topic
          videoTitle: '',
          level: 'Movers',
          count: 5,
          className: '',
          folderId: '',
          folder: '',
          isPublic: true,
        }
  );

  const [videoUrl, setVideoUrl] = useState<string>(initialGame?.videoUrl || '');
  const [localVideoName, setLocalVideoName] = useState<string>('');
  const localBlobUrlRef = useRef<string | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [liveScoreCount, setLiveScoreCount] = useState(0);

  useEffect(() => {
    return () => {
      if (localBlobUrlRef.current) {
        URL.revokeObjectURL(localBlobUrlRef.current);
        localBlobUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setSavedGameRecord(initialGame || null);
    setIsLockedPlayMode(Boolean(initialGame && !initialGame.editMode));
    if (initialGame?.videoUrl) {
      setVideoUrl(initialGame.videoUrl);
      setLocalVideoName('');
    }
    const mapped = buildQuestionsFromInitialGame(initialGame);
    if (mapped) {
      setQuestions(mapped);
      setLessonConfig({
        topic: initialGame.topic || initialGame.name || initialGame.title || '',
        videoTitle: initialGame.lessonConfig?.videoTitle || '',
        level: normalizeEnglishLevel(initialGame.classLevel || initialGame.className),
        count: initialGame.lessonConfig?.count || mapped.length || 5,
        className: initialGame.className || '',
        folderId: initialGame.folderId || '',
        folder: initialGame.folderName || '',
        isPublic: initialGame.isPublic ?? true,
      });
      if (initialGame?.videoUrl) {
        setCurrentView('player');
      }
    }
  }, [initialGame, buildQuestionsFromInitialGame]);

  const handleSelectLocalVideoFile = (file: File) => {
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }
    const blobUrl = URL.createObjectURL(file);
    localBlobUrlRef.current = blobUrl;
    setVideoUrl(blobUrl);
    setLocalVideoName(file.name);
    setSetupError('');

    const cleanFileName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (cleanFileName) {
      setLessonConfig((prev: any) => ({ ...prev, videoTitle: cleanFileName }));
    }
  };

  const handleClearVideoSource = () => {
    if (localBlobUrlRef.current) {
      URL.revokeObjectURL(localBlobUrlRef.current);
      localBlobUrlRef.current = null;
    }
    setVideoUrl('');
    setLocalVideoName('');
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    vqAudio.muted = next;
  };

  const normalizeVideoUrl = (rawUrl: string) => {
    let finalUrl = (rawUrl || '').trim();
    if (!finalUrl) return '';
    if (finalUrl.startsWith('blob:') || finalUrl.startsWith('data:')) return finalUrl;
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    if (finalUrl.includes('youtube.com/shorts/')) {
      finalUrl = finalUrl.replace('youtube.com/shorts/', 'youtube.com/watch?v=');
    }
    return finalUrl;
  };

  const handleSaveVideoQuiz = async (saveOverrides?: {
    title?: string;
    className?: string;
    folderId?: string;
    folderName?: string;
    isPublic?: boolean;
    videoUrlOverride?: string;
  }): Promise<{ ok: boolean; message: string }> => {
    if (savingRef.current) return { ok: false, message: 'Already saving...' };
    savingRef.current = true;
    setIsSaving(true);
    try {
      const existing = savedGameRecord || initialGame;
      const resolvedTitle =
        saveOverrides?.title?.trim() ||
        lessonConfig?.topic?.trim() ||
        lessonConfig?.videoTitle?.trim() ||
        existing?.topic ||
        existing?.name ||
        existing?.title ||
        'Video Quiz';
      const resolvedClass =
        saveOverrides?.className !== undefined
          ? saveOverrides.className.trim()
          : lessonConfig?.className ||
            lessonConfig?.level ||
            existing?.classLevel ||
            existing?.className ||
            '';

      let resolvedFolderId =
        saveOverrides?.folderId !== undefined
          ? saveOverrides.folderId
          : lessonConfig?.folderId || existing?.folderId || '';
      let resolvedFolderName =
        saveOverrides?.folderName !== undefined
          ? saveOverrides.folderName
          : lessonConfig?.folder || existing?.folderName || '';

      if (!resolvedFolderId && resolvedFolderName && user?.uid) {
        try {
          const userFolders = mergeUserFolders(user.uid);
          const match = userFolders.find(
            (f) => f.name.toLowerCase().trim() === String(resolvedFolderName).toLowerCase().trim()
          );
          if (match) {
            resolvedFolderId = match.id;
            resolvedFolderName = match.name;
          }
        } catch {}
      }

      const resolvedIsPublic =
        saveOverrides?.isPublic !== undefined
          ? saveOverrides.isPublic
          : lessonConfig?.isPublic !== undefined
          ? Boolean(lessonConfig.isPublic)
          : existing?.isPublic !== undefined
          ? Boolean(existing.isPublic)
          : true;

      const rawTargetUrl = saveOverrides?.videoUrlOverride || videoUrl || existing?.videoUrl || '';
      const persistedVideoUrl = rawTargetUrl.startsWith('blob:') ? '' : normalizeVideoUrl(rawTargetUrl);

      const normalizedQuestions = (questions || []).map((q: any, idx: number) => {
        const rawOpts = Array.isArray(q.options) ? q.options : [];
        const optionTexts = rawOpts
          .map((o: any) => (typeof o === 'string' ? o : o?.text || ''))
          .filter(Boolean);
        const foundAnsIdx = rawOpts.findIndex((o: any) => typeof o === 'object' && Boolean(o?.isCorrect));
        const answerIndex = foundAnsIdx >= 0 ? foundAnsIdx : (typeof q.answerIndex === 'number' ? q.answerIndex : 0);
        return {
          id: q.id || idx + 1,
          text: q.question || q.text || '',
          answer: q.answer || optionTexts[answerIndex] || '',
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : undefined,
          options: optionTexts.length >= 1 ? optionTexts : [q.answer || 'looked'],
          answerIndex,
          timeTrigger:
            typeof q.timeTrigger === 'number'
              ? q.timeTrigger
              : Math.round(((idx + 1) / ((questions?.length || 1) + 1)) * 90) + 5,
          type: q.type || 'Multiple Choice',
          xp: q.xp || 100,
          explanation: q.explanation || '',
        };
      });

      const updatedConfig = {
        ...lessonConfig,
        topic: lessonConfig?.topic || '',
        className: resolvedClass,
        folderId: resolvedFolderId,
        folder: resolvedFolderName,
        isPublic: resolvedIsPublic,
      };
      setLessonConfig(updatedConfig);
      if (saveOverrides?.videoUrlOverride && !saveOverrides.videoUrlOverride.startsWith('blob:')) {
        setVideoUrl(persistedVideoUrl);
        setLocalVideoName('');
      }

      const gameToSave = {
        name: resolvedTitle,
        title: resolvedTitle,
        topic: lessonConfig?.topic || '',
        className: resolvedClass,
        classLevel: resolvedClass,
        folderId: resolvedFolderId,
        ...(resolvedFolderName ? { folderName: resolvedFolderName } : {}),
        gameType: 'hamster-pop-quiz',
        videoUrl: persistedVideoUrl,
        lessonConfig: updatedConfig,
        customQuestions: normalizedQuestions,
        isPublic: resolvedIsPublic,
      };

      const result = await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: existing,
      });
      setSavedGameRecord(result.savedGame);
      setIsLockedPlayMode(true);
      return {
        ok: true,
        message: result.cloudSynced
          ? 'Saved to My Games & Cloud'
          : 'Saved to My Games',
      };
    } catch (err) {
      console.error('Error saving Video Quiz:', err);
      return { ok: false, message: 'Failed to save quiz.' };
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleStartLesson = async (config: any) => {
    const cleanUrl = normalizeVideoUrl(config.videoUrl || videoUrl);
    if (!cleanUrl) {
      setSetupError('Please paste a video URL or upload a local video file first.');
      return;
    }
    setSetupError('');
    setVideoUrl(cleanUrl);
    setLessonConfig(config);
    setIsLockedPlayMode(false);
    setOpenEditorOnMount(false);

    // If the teacher already typed custom questions in Setup, start immediately with those
    if (Array.isArray(config.manualQuestions) && config.manualQuestions.length > 0) {
      setQuestions(config.manualQuestions);
      setCurrentView('player');
      return;
    }

    setIsGenerating(true);
    const desiredCount = Math.max(1, Math.min(100, Number(config.count) || 5));

    try {
      const res = await fetch('/api/generate-hamster-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: (config.topic || '').trim(),
          videoTitle: config.videoTitle || localVideoName || '',
          level: normalizeEnglishLevel(config.level),
          types: config.selectedTypes,
          count: desiredCount,
          videoUrl: cleanUrl.startsWith('blob:') ? localVideoName : cleanUrl,
        }),
      });
      const data = await res.json();
      const resolvedVidTitle = data?.videoTitle || config.videoTitle || '';
      const resolvedVidDuration = Number(data?.videoDuration) || Number(config.videoDuration) || 0;
      if (resolvedVidTitle || resolvedVidDuration) {
        setLessonConfig((prev: any) => ({
          ...prev,
          ...(resolvedVidTitle ? { videoTitle: resolvedVidTitle } : {}),
          ...(resolvedVidDuration > 0 ? { videoDuration: resolvedVidDuration } : {}),
        }));
      }
      const fallbackPool = generateDynamicQuestions({
        ...config,
        videoTitle: resolvedVidTitle,
        videoDuration: resolvedVidDuration || config.videoDuration,
        count: desiredCount,
      });

      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        const validFromApi = data.questions.filter(
          (q: any) =>
            q &&
            typeof q.question === 'string' &&
            !isLegacyPlaceholderQuestion(q.question) &&
            (q.type === 'Fill in the Blanks' ||
              (Array.isArray(q.options) && q.options.length >= 2))
        );
        const finalQs =
          validFromApi.length >= desiredCount
            ? validFromApi.slice(0, desiredCount)
            : [...validFromApi, ...fallbackPool.slice(validFromApi.length, desiredCount)].map(
                (q, i) => ({
                  ...q,
                  id: i + 1,
                })
              );
        setQuestions(finalQs);
      } else {
        setQuestions(fallbackPool);
      }
    } catch (e) {
      console.error(e);
      setQuestions(generateDynamicQuestions({ ...config, count: desiredCount }));
    } finally {
      setIsGenerating(false);
      setCurrentView('player');
    }
  };

  return (
    <div
      id="game-container"
      className="w-full min-h-full flex-1 text-slate-100 vq-body overflow-y-auto overflow-x-hidden bg-[#0B0914] relative selection:bg-amber-400 selection:text-slate-950 flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(circle at 18% 12%, rgba(245, 158, 11, 0.11), transparent 38%), radial-gradient(circle at 82% 18%, rgba(236, 72, 153, 0.11), transparent 42%), radial-gradient(circle at 50% 90%, rgba(139, 92, 246, 0.13), transparent 50%)',
      }}
    >
      <style>{customStyles}</style>

      {/* Clean Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-[#0E0B1A]/95 border-b border-white/10 px-3 sm:px-5 h-13 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <button
            onClick={() => onViewChange('games')}
            title="Back to Games"
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <FullscreenButton targetId="game-container" />
          <div className="flex items-center gap-2 text-left ml-0.5 min-w-0">
            <img
              src="/images/video-quiz-card-v3.jpg?v=3"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_3b5337e9.png';
              }}
              alt="Video Quiz"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-amber-400/40 shadow-sm shrink-0"
            />
            <span className="vq-display text-base sm:text-lg font-extrabold tracking-tight text-white truncate">
              Video <span className="text-amber-400">Quiz</span>
            </span>
            {currentView === 'player' && (lessonConfig?.topic || lessonConfig?.videoTitle || localVideoName) && (
              <>
                <span aria-hidden="true" className="text-white/20 hidden md:inline">·</span>
                <span className="hidden md:inline text-xs font-bold text-slate-300 truncate max-w-[260px]">
                  {lessonConfig?.topic || lessonConfig?.videoTitle || localVideoName}
                </span>
                {lessonConfig?.level && (
                  <span className="hidden lg:inline px-2 py-0.5 rounded-md bg-amber-400/15 text-amber-300 text-[11px] font-bold whitespace-nowrap">
                    {normalizeEnglishLevel(lessonConfig.level)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mode Switcher */}
        {!isLockedPlayMode && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            <button
              onClick={() => setCurrentView('setup')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'setup'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Setup
            </button>
            <button
              onClick={() => {
                if (!videoUrl.trim()) {
                  setSetupError('Please paste a video URL or upload a local video file first.');
                  setCurrentView('setup');
                  return;
                }
                setOpenEditorOnMount(false);
                setCurrentView('player');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'player'
                  ? 'bg-amber-400 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Player
            </button>
          </div>
        )}

        {/* Live Score (Top Right) & Audio Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          {currentView === 'player' && questions.length > 0 && (
            <div
              title="Live Score"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/50 text-emerald-300 font-extrabold text-xs sm:text-sm vq-mono flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle size={15} className="text-emerald-400 shrink-0" />
              <span>
                {liveScoreCount}/{questions.length}
              </span>
            </div>
          )}
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        className={`flex-1 w-full mx-auto flex flex-col ${
          currentView === 'player'
            ? 'max-w-[1920px] px-2 sm:px-4 py-2'
            : 'max-w-[1280px] px-4 sm:px-6 py-6'
        }`}
      >
        {currentView === 'setup' ? (
          <SetupStudioView
            videoUrl={videoUrl}
            setVideoUrl={(val: string) => {
              setVideoUrl(val);
              if (setupError) setSetupError('');
            }}
            localVideoName={localVideoName}
            onSelectLocalFile={handleSelectLocalVideoFile}
            onClearVideo={handleClearVideoSource}
            initialConfig={lessonConfig}
            existingQuestions={questions}
            setQuestions={setQuestions}
            setupError={setupError}
            setSetupError={setSetupError}
            onStartLesson={handleStartLesson}
            onOpenManual={(cfg: any) => {
              const cleanUrl = normalizeVideoUrl(cfg.videoUrl || videoUrl);
              if (!cleanUrl) {
                setSetupError('Please paste a video URL or upload a local video file first.');
                return;
              }
              setSetupError('');
              setVideoUrl(cleanUrl);
              setLessonConfig(cfg);
              setIsLockedPlayMode(false);
              setOpenEditorOnMount(false);
              setCurrentView('player');
            }}
            isGenerating={isGenerating}
          />
        ) : (
          <PlayerView
            user={user}
            config={lessonConfig}
            questions={questions}
            setQuestions={setQuestions}
            videoUrl={videoUrl}
            localVideoName={localVideoName}
            onSaveQuiz={handleSaveVideoQuiz}
            isSaving={isSaving}
            isPlayOnlyMode={isLockedPlayMode}
            initialOpenEditor={openEditorOnMount}
            onBackToSetup={() => setCurrentView('setup')}
            onScoreChange={setLiveScoreCount}
          />
        )}
      </main>
    </div>
  );
}

function SetupStudioView({
  videoUrl,
  setVideoUrl,
  localVideoName,
  onSelectLocalFile,
  onClearVideo,
  initialConfig,
  existingQuestions,
  setQuestions,
  setupError,
  setSetupError,
  onStartLesson,
  onOpenManual,
  isGenerating,
}: any) {
  const isBlobUrl = Boolean(videoUrl && videoUrl.startsWith('blob:'));
  const [urlInput, setUrlInput] = useState(isBlobUrl ? '' : videoUrl || '');
  // Do NOT automatically load a quiz topic — start blank unless user typed one
  const [topic, setTopic] = useState(initialConfig?.topic || '');
  const [detectedVideoTitle, setDetectedVideoTitle] = useState(initialConfig?.videoTitle || '');
  const [level, setLevel] = useState(normalizeEnglishLevel(initialConfig?.level));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialConfig?.selectedTypes || ['Fill in the Blanks', 'Multiple Choice', 'Grammar Choice']
  );

  // Allow typing ANY number of questions freely (not limited to 10!)
  const initialCountNum = Math.max(1, Math.min(100, Number(initialConfig?.count) || 5));
  const [quizCountInput, setQuizCountInput] = useState<string>(String(initialCountNum));
  const resolvedQuizCount = Math.max(1, Math.min(100, parseInt(quizCountInput, 10) || 5));

  // Direct inline question typing in Setup (supports Fill in the Blanks & Multiple Choice)
  const [directMode, setDirectMode] = useState<'Fill in the Blanks' | 'Multiple Choice'>('Fill in the Blanks');
  const [directTime, setDirectTime] = useState('0:15');
  const [directQuestion, setDirectQuestion] = useState('');
  const [directBlankAnswer, setDirectBlankAnswer] = useState('');
  const [directOptions, setDirectOptions] = useState<string[]>(['', '', '', '']);
  const [directCorrectIdx, setDirectCorrectIdx] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setUrlInput('');
    } else if (!videoUrl.startsWith('blob:')) {
      setUrlInput(videoUrl);
    }
  }, [videoUrl]);

  // Scan YouTube video title via oEmbed for accurate scene analysis without overwriting the user's quiz topic
  useEffect(() => {
    const trimmed = (urlInput || '').trim();
    if (!trimmed.includes('youtube.com') && !trimmed.includes('youtu.be')) {
      setDetectedVideoTitle('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(normalized)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.title) {
          setDetectedVideoTitle(String(data.title).trim());
        }
      } catch {}
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [urlInput]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.length > 1
          ? prev.filter((t) => t !== type)
          : prev
        : [...prev, type]
    );
  };

  const activeVideoSource = isBlobUrl ? videoUrl : urlInput.trim();
  const ytPreviewId = !isBlobUrl ? extractClientYouTubeId(activeVideoSource) : null;

  const buildPayload = (manualQs?: any[]) => {
    return {
      ...initialConfig,
      videoUrl: activeVideoSource,
      topic: topic.trim(), // Keep empty if user didn't enter a topic
      videoTitle:
        detectedVideoTitle ||
        (localVideoName ? localVideoName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') : ''),
      level: normalizeEnglishLevel(level),
      selectedTypes,
      count: resolvedQuizCount,
      ...(manualQs ? { manualQuestions: manualQs } : {}),
    };
  };

  const handleAddDirectQuestionInSetup = () => {
    const rawQText = directQuestion.trim();
    if (!rawQText) return;
    const sec = parseTimeInputToSeconds(directTime) ?? 15;
    const nextId =
      (existingQuestions || []).reduce((m: number, q: any) => Math.max(m, q.id || 0), 0) + 1;

    const nonEmptyOpts = directOptions.map((o) => o.trim()).filter(Boolean);
    const shouldBeFillBlank =
      directMode === 'Fill in the Blanks' ||
      (rawQText.includes('___') && nonEmptyOpts.length < 2) ||
      nonEmptyOpts.length === 0;

    let newQ: any;
    if (shouldBeFillBlank) {
      const qFormatted = rawQText.includes('___')
        ? normalizeBlankQuestionText(rawQText)
        : `${rawQText} ____`;
      const inferred = inferSmartBlankAnswerFromQuestion(qFormatted);
      const finalAns =
        directBlankAnswer.trim() || nonEmptyOpts[0] || inferred.answer;

      newQ = {
        id: nextId,
        timeTrigger: sec,
        type: 'Fill in the Blanks',
        xp: 100,
        question: qFormatted,
        answer: finalAns,
        acceptedAnswers: Array.from(
          new Set([finalAns, ...inferred.acceptedAnswers].filter(Boolean))
        ),
        options: [{ text: finalAns, isCorrect: true }],
        explanation: `Correct answer: "${finalAns}".`,
      };
    } else {
      const builtOpts = directOptions.map((opt, idx) => ({
        text: opt.trim() || `Choice ${['A', 'B', 'C', 'D'][idx]}`,
        isCorrect: idx === directCorrectIdx,
      }));
      const rightAns = builtOpts[directCorrectIdx]?.text || builtOpts[0]?.text || '';
      newQ = {
        id: nextId,
        timeTrigger: sec,
        type: 'Multiple Choice',
        xp: 100,
        question: rawQText,
        answer: rightAns,
        options: builtOpts,
        explanation: `Correct answer: "${rightAns}".`,
      };
    }

    const nextList = [...(existingQuestions || []), newQ].sort(
      (a, b) => a.timeTrigger - b.timeTrigger
    );
    setQuestions(nextList);
    setDirectQuestion('');
    setDirectBlankAnswer('');
    setDirectOptions(['', '', '', '']);
    setDirectCorrectIdx(0);
    setDirectTime(formatSeconds(sec + 20));
  };

  return (
    <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full animate-vq-fade">
      <div className="bg-[#161229] border border-white/10 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-white/10">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border-2 border-amber-400/50 shadow-lg bg-[#0B0914]">
            <img
              src="/images/video-quiz-card-v3.jpg?v=3"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_3b5337e9.png';
              }}
              alt="Video Quiz Mascot"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 text-center sm:text-left">
            <h1 className="vq-display text-2xl sm:text-3xl font-black text-white tracking-tight mb-1">
              Interactive <span className="text-amber-400">Video Quiz</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Paste a video URL or upload a video file. Auto-generate scene-accurate questions by scanning the video (with an optional grammar topic), or type your own Fill in the Blanks and Multiple Choice questions below.
            </p>
          </div>
        </div>

        {/* Main Setup Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Video Source, Topic, How Many Questions, English Level */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-300">
                  Video Source (URL or Local File)
                </label>
                {activeVideoSource && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      setDetectedVideoTitle('');
                      onClearVideo();
                    }}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <X size={13} /> Clear Video
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    onSelectLocalFile(file);
                  }
                  e.target.value = '';
                }}
              />

              {isBlobUrl ? (
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40 text-white">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center shrink-0">
                      <FileVideo size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-emerald-300 truncate">
                        {localVideoName || 'Uploaded Video File'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Local video ready for playback
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white shrink-0 cursor-pointer whitespace-nowrap"
                  >
                    Change File
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1 flex items-center">
                    <Video size={17} className="absolute left-3.5 text-amber-400 pointer-events-none" />
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="Paste YouTube or MP4 video URL..."
                      value={urlInput}
                      onChange={(e) => {
                        setUrlInput(e.target.value);
                        setVideoUrl(e.target.value);
                        if (setupError) setSetupError('');
                      }}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[#0E0B1A] border focus:outline-none text-sm font-medium text-white placeholder:text-slate-500 transition-colors ${
                        setupError
                          ? 'border-rose-500 focus:border-rose-400'
                          : 'border-white/15 focus:border-amber-400'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Upload size={15} className="text-amber-400" />
                    Upload Video
                  </button>
                </div>
              )}

              {(detectedVideoTitle || ytPreviewId) && !isBlobUrl && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center gap-3">
                  {ytPreviewId && (
                    <img
                      src={`https://i.ytimg.com/vi/${ytPreviewId}/hqdefault.jpg`}
                      alt="Scanned Video Preview"
                      referrerPolicy="no-referrer"
                      className="w-16 h-10 rounded-lg object-cover border border-amber-400/40 shrink-0"
                    />
                  )}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <Sparkles size={12} className="shrink-0" />
                      <span>Video Scanned & Ready for Scene Questions</span>
                    </div>
                    {detectedVideoTitle && (
                      <div className="text-xs font-extrabold text-white truncate">
                        {detectedVideoTitle}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {setupError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-300">
                    Grammar / Quiz Topic <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  {topic && (
                    <button
                      type="button"
                      onClick={() => setTopic('')}
                      className="text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Type topic or leave blank to scan video..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-semibold text-white placeholder:text-slate-500 transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_GRAMMAR_TOPICS.map((presetTopic) => {
                    const isSelected = topic.trim().toLowerCase() === presetTopic.toLowerCase();
                    return (
                      <button
                        key={presetTopic}
                        type="button"
                        onClick={() => setTopic(isSelected ? '' : presetTopic)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {presetTopic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">
                  How Many Questions <span className="text-slate-500 font-normal">(Type any number)</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 15"
                    value={quizCountInput}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                      if (digitsOnly === '') {
                        setQuizCountInput('');
                        return;
                      }
                      const num = Math.min(100, parseInt(digitsOnly, 10));
                      setQuizCountInput(String(num));
                    }}
                    onBlur={() => {
                      if (!quizCountInput || parseInt(quizCountInput, 10) < 1) {
                        setQuizCountInput('5');
                      }
                    }}
                    className="w-20 px-3 py-3 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-extrabold text-amber-400 text-center vq-mono"
                  />
                  <div className="flex-1 grid grid-cols-5 gap-1 p-1 rounded-xl bg-[#0E0B1A] border border-white/15">
                    {QUESTION_COUNT_PRESETS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuizCountInput(String(cnt))}
                        className={`py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          resolvedQuizCount === cnt
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* English Level Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                English Level
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {CEFR_LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLevel(l)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer border text-center ${
                      level === l
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-xs'
                        : 'bg-[#0E0B1A] text-slate-300 border-white/10 hover:border-white/25'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Question Types & Launch Actions */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                Question Formats
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUESTION_TYPES.map((type) => {
                  const active = selectedTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`p-2.5 rounded-xl border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                        active
                          ? 'bg-pink-500/15 border-pink-400/60 text-white'
                          : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          active ? 'bg-pink-500 text-white' : 'bg-white/10'
                        }`}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs font-bold truncate">{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Launch Buttons */}
            <div className="space-y-2.5">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  if (!activeVideoSource) {
                    setSetupError('Please paste a video URL or upload a local video file first.');
                    urlInputRef.current?.focus();
                    return;
                  }
                  onStartLesson(buildPayload());
                }}
                className="w-full py-3.5 px-5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Scanning Video & Generating {resolvedQuizCount} Questions...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Auto-Generate {resolvedQuizCount} {topic.trim() ? `${topic.trim()} ` : 'Video '}
                    {resolvedQuizCount === 1 ? 'Question' : 'Questions'} & Play
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isGenerating}
                onClick={() => {
                  if (!activeVideoSource) {
                    setSetupError('Please paste a video URL or upload a local video file first.');
                    urlInputRef.current?.focus();
                    return;
                  }
                  onOpenManual(buildPayload(existingQuestions));
                }}
                className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-colors cursor-pointer"
              >
                <Play size={14} className="text-amber-400" />
                Open Video Player & Type Questions Directly
              </button>
            </div>
          </div>
        </div>

        {/* Direct Question Typing Box in Setup (Supports Fill in the Blanks & Multiple Choice) */}
        <div className="pt-5 border-t border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                <Edit3 size={15} className="text-amber-400" />
                Directly Type Your Own Questions (Fill in the Blanks or Multiple Choice)
              </h3>
              <p className="text-[11px] text-slate-400">
                Choose <strong>Fill in the Blanks</strong> (use <code className="text-amber-300">____</code> for the blank) or <strong>Multiple Choice</strong>, set the timestamp, and click Add Question.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-1 rounded-xl bg-[#0E0B1A] border border-white/10">
                {(['Fill in the Blanks', 'Multiple Choice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDirectMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      directMode === m
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {Array.isArray(existingQuestions) && existingQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuestions([])}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 cursor-pointer ml-2"
                >
                  Clear All ({existingQuestions.length})
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#0E0B1A] border border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="flex items-center gap-1.5 bg-[#161229] border border-white/15 rounded-xl px-3 py-2.5 shrink-0">
                <Clock size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-slate-400">Time:</span>
                <input
                  type="text"
                  value={directTime}
                  onChange={(e) => setDirectTime(e.target.value)}
                  placeholder="0:15"
                  className="w-16 bg-transparent text-xs font-extrabold text-amber-300 vq-mono focus:outline-none text-center"
                />
              </div>
              <input
                type="text"
                value={directQuestion}
                onChange={(e) => setDirectQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddDirectQuestionInSetup();
                  }
                }}
                placeholder={
                  directMode === 'Fill in the Blanks'
                    ? 'e.g. He has ____ at the mirror.'
                    : 'Type your multiple choice question here...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#161229] border border-white/15 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white"
              />
              {directMode === 'Fill in the Blanks' && (
                <button
                  type="button"
                  onClick={() => setDirectQuestion((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}____ `)}
                  title="Insert blank ____"
                  className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-amber-300 text-xs font-extrabold cursor-pointer shrink-0"
                >
                  + Insert ____
                </button>
              )}
              <button
                type="button"
                onClick={handleAddDirectQuestionInSetup}
                disabled={!directQuestion.trim()}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                Add Question
              </button>
            </div>

            {directMode === 'Fill in the Blanks' ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40">
                <span className="text-xs font-extrabold text-emerald-300 shrink-0">
                  Correct Missing Word(s):
                </span>
                <input
                  type="text"
                  value={directBlankAnswer}
                  onChange={(e) => setDirectBlankAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDirectQuestionInSetup();
                    }
                  }}
                  placeholder="e.g. looked (students will type this to fill in the blank)"
                  className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-white placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {['A', 'B', 'C', 'D'].map((letter, idx) => {
                  const isRight = directCorrectIdx === idx;
                  return (
                    <div
                      key={letter}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                        isRight
                          ? 'bg-emerald-500/10 border-emerald-400/50'
                          : 'bg-[#161229] border-white/10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setDirectCorrectIdx(idx)}
                        title="Click to mark as correct answer"
                        className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 cursor-pointer ${
                          isRight
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        {letter}
                      </button>
                      <input
                        type="text"
                        value={directOptions[idx]}
                        onChange={(e) => {
                          const next = [...directOptions];
                          next[idx] = e.target.value;
                          setDirectOptions(next);
                        }}
                        placeholder={`Choice ${letter}${isRight ? ' (Correct)' : ''}`}
                        className="w-full bg-transparent text-xs font-medium text-white focus:outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* List of custom typed questions */}
          {Array.isArray(existingQuestions) && existingQuestions.length > 0 && (
            <div className="space-y-2 max-h-52 overflow-y-auto vq-scrollbar pr-1">
              {existingQuestions.map((q: any) => (
                <div
                  key={q.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/10 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 vq-mono font-bold shrink-0">
                      @{formatSeconds(q.timeTrigger)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-pink-500/15 text-pink-300 text-[10px] font-bold shrink-0">
                      {q.type || 'Multiple Choice'}
                    </span>
                    <span className="font-semibold text-white truncate">{q.question}</span>
                    {q.type === 'Fill in the Blanks' && q.answer && (
                      <span className="text-emerald-300 font-bold shrink-0">
                        Ans: {q.answer}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestions(existingQuestions.filter((item: any) => item.id !== q.id))
                    }
                    className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer shrink-0"
                    title="Remove question"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerView({
  user,
  config,
  questions,
  setQuestions,
  videoUrl,
  localVideoName,
  onSaveQuiz,
  isSaving,
  isPlayOnlyMode,
  initialOpenEditor,
  onBackToSetup,
  onScoreChange,
}: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [isReplayingClip, setIsReplayingClip] = useState(false);
  const [resultsMap, setResultsMap] = useState<Record<number, QuizAnswerRecord>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEditModal, setShowEditModal] = useState(Boolean(initialOpenEditor));
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  // Direct inline question typing right below the video (Supports Fill in the Blanks & Multiple Choice)
  const [inlineMode, setInlineMode] = useState<'Fill in the Blanks' | 'Multiple Choice'>('Fill in the Blanks');
  const [inlineTimeInput, setInlineTimeInput] = useState('0:15');
  const [inlineQuestionText, setInlineQuestionText] = useState('');
  const [inlineBlankAnswer, setInlineBlankAnswer] = useState('');
  const [inlineOptions, setInlineOptions] = useState<string[]>(['', '', '', '']);
  const [inlineCorrectIdx, setInlineCorrectIdx] = useState<number>(0);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<any>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(
    Math.max(60, Number(config?.videoDuration) || 120)
  );
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const cfgDur = Number(config?.videoDuration);
    if (cfgDur && cfgDur > 60 && videoDuration <= 120) {
      setVideoDuration(cfgDur);
    }
  }, [config?.videoDuration, videoDuration]);

  const useNativeVideo = isDirectVideoSource(videoUrl);

  const sortedQuestions = [...questions].sort((a, b) => a.timeTrigger - b.timeTrigger);
  const maxQuestionTrigger = sortedQuestions.reduce(
    (max, q) => Math.max(max, Number(q?.timeTrigger) || 0),
    0
  );
  const effectiveDuration = Math.max(
    videoDuration || 120,
    Number(config?.videoDuration) || 0,
    maxQuestionTrigger + 15,
    60
  );
  const correctCount = Object.values(resultsMap).filter((r) => r?.isCorrect).length;

  useEffect(() => {
    if (typeof onScoreChange === 'function') {
      onScoreChange(correctCount);
    }
  }, [correctCount, onScoreChange]);

  // Sync browser fullscreen changes with our stage fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      const doc: any = document;
      const fsElem =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      if (!fsElem && isStageFullscreen) {
        setIsStageFullscreen(false);
      } else if (fsElem && stageContainerRef.current && fsElem === stageContainerRef.current) {
        setIsStageFullscreen(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [isStageFullscreen]);

  const toggleStageFullscreen = async () => {
    const doc: any = document;
    const fsElem =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement;

    if (isStageFullscreen || fsElem) {
      setIsStageFullscreen(false);
      try {
        if (fsElem) {
          if (doc.exitFullscreen) await doc.exitFullscreen();
          else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        }
      } catch {}
    } else {
      setIsStageFullscreen(true);
      try {
        const el: any = stageContainerRef.current;
        if (el) {
          if (el.requestFullscreen) await el.requestFullscreen();
          else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        }
      } catch {
        // Fallback to CSS fixed fullscreen
      }
    }
  };

  // Sync play/pause with native video element when using direct/blob video
  useEffect(() => {
    if (!useNativeVideo || !nativeVideoRef.current) return;
    if (isPlaying && (!activeQuiz || isReplayingClip)) {
      nativeVideoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      nativeVideoRef.current.pause();
    }
  }, [isPlaying, activeQuiz, isReplayingClip, useNativeVideo, videoUrl]);

  const seekVideoTo = (seconds: number) => {
    const clamped = Math.max(0, Math.min(effectiveDuration, seconds));
    setCurrentTime(clamped);
    setInlineTimeInput(formatSeconds(Math.max(1, Math.round(clamped))));
    setProgress((clamped / effectiveDuration) * 100);
    if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.currentTime = clamped;
    } else if (videoRef.current) {
      if (typeof videoRef.current.seekTo === 'function') {
        videoRef.current.seekTo(clamped, 'seconds');
      } else if ('currentTime' in videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
    }
  };

  const triggerQuizNow = (quiz: any) => {
    setIsReplayingClip(false);
    setIsPlaying(false);
    seekVideoTo(quiz.timeTrigger);
    setActiveQuiz(quiz);
    vqAudio.playPop();
  };

  const handleReplayQuestionScene = () => {
    if (!activeQuiz) return;
    const startClipSec = Math.max(0, activeQuiz.timeTrigger - 5);
    seekVideoTo(startClipSec);
    setIsReplayingClip(true);
    setIsPlaying(true);
  };

  const evaluateTimeTrigger = (currentSeconds: number) => {
    setCurrentTime(currentSeconds);
    setProgress((currentSeconds / effectiveDuration) * 100);

    if (isReplayingClip && activeQuiz) {
      if (currentSeconds >= activeQuiz.timeTrigger) {
        setIsReplayingClip(false);
        setIsPlaying(false);
        seekVideoTo(activeQuiz.timeTrigger);
      }
      return;
    }

    const triggeredQuiz = questions.find(
      (q: any) =>
        resultsMap[q.id] === undefined &&
        Math.abs(q.timeTrigger - currentSeconds) < 0.65
    );

    if (triggeredQuiz && isPlaying && !activeQuiz) {
      triggerQuizNow(triggeredQuiz);
    }
  };

  const handleTimeUpdate = (e: any) => {
    const currentSeconds = e?.currentTarget?.currentTime || e?.target?.currentTime || 0;
    evaluateTimeTrigger(currentSeconds);
  };

  const handleQuizComplete = (result: {
    isCorrect: boolean;
    selectedIndex: number;
    responseTimeSec: number;
  }) => {
    if (!activeQuiz) return;

    if (result.isCorrect) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2200);
    }

    const updatedResults: Record<number, QuizAnswerRecord> = {
      ...resultsMap,
      [activeQuiz.id]: {
        isCorrect: result.isCorrect,
        selectedIndex: result.selectedIndex,
        responseTimeSec: result.responseTimeSec,
        earnedXp: result.isCorrect ? 100 : 0,
      },
    };
    setResultsMap(updatedResults);
    setActiveQuiz(null);
    setIsReplayingClip(false);

    setTimeout(() => {
      setIsPlaying(true);
    }, 220);
  };

  const handleResetQuiz = () => {
    setResultsMap({});
    setActiveQuiz(null);
    setIsReplayingClip(false);
    seekVideoTo(0);
    setIsPlaying(false);
  };

  const handleAddInlineQuestion = () => {
    const rawQText = inlineQuestionText.trim();
    if (!rawQText) return;
    const triggerSec =
      parseTimeInputToSeconds(inlineTimeInput) ?? Math.max(1, Math.round(currentTime || 15));
    const nextId = questions.reduce((max: number, q: any) => Math.max(max, q.id || 0), 0) + 1;

    const nonEmptyOpts = inlineOptions.map((o) => o.trim()).filter(Boolean);
    const shouldBeFillBlank =
      inlineMode === 'Fill in the Blanks' ||
      (rawQText.includes('___') && nonEmptyOpts.length < 2) ||
      nonEmptyOpts.length === 0;

    let newQ: any;
    if (shouldBeFillBlank) {
      const qFormatted = rawQText.includes('___')
        ? normalizeBlankQuestionText(rawQText)
        : `${rawQText} ____`;
      const inferred = inferSmartBlankAnswerFromQuestion(qFormatted);
      const finalAns =
        inlineBlankAnswer.trim() || nonEmptyOpts[0] || inferred.answer;

      newQ = {
        id: nextId,
        timeTrigger: triggerSec,
        type: 'Fill in the Blanks',
        xp: 100,
        question: qFormatted,
        answer: finalAns,
        acceptedAnswers: Array.from(
          new Set([finalAns, ...inferred.acceptedAnswers].filter(Boolean))
        ),
        options: [{ text: finalAns, isCorrect: true }],
        explanation: `Correct answer: "${finalAns}".`,
      };
    } else {
      const builtOpts = inlineOptions.map((opt, idx) => ({
        text: opt.trim() || `Choice ${['A', 'B', 'C', 'D'][idx]}`,
        isCorrect: idx === inlineCorrectIdx,
      }));
      const rightAns = builtOpts[inlineCorrectIdx]?.text || builtOpts[0]?.text || '';
      newQ = {
        id: nextId,
        timeTrigger: triggerSec,
        type: 'Multiple Choice',
        xp: 100,
        question: rawQText,
        answer: rightAns,
        options: builtOpts,
        explanation: `Correct answer: "${rightAns}".`,
      };
    }

    setQuestions([...questions, newQ].sort((a, b) => a.timeTrigger - b.timeTrigger));
    setInlineQuestionText('');
    setInlineBlankAnswer('');
    setInlineOptions(['', '', '', '']);
    setInlineCorrectIdx(0);
    setToastMessage(`Added ${newQ.type} question at ${formatSeconds(triggerSec)}`);
    setTimeout(() => setToastMessage(''), 2200);
  };

  const handleAutoGenerateTopicQuestions = async () => {
    setIsGeneratingMore(true);
    const desiredCount = Math.max(1, Math.min(100, Number(config?.count) || 5));
    try {
      const res = await fetch('/api/generate-hamster-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: (config?.topic || '').trim(),
          videoTitle: config?.videoTitle || localVideoName || '',
          level: normalizeEnglishLevel(config?.level),
          types: config?.selectedTypes || ['Fill in the Blanks', 'Multiple Choice', 'Grammar Choice'],
          count: desiredCount,
          videoDuration: videoDuration || 180,
          videoUrl: videoUrl.startsWith('blob:') ? localVideoName : videoUrl,
        }),
      });
      const data = await res.json();
      const fallbackPool = generateDynamicQuestions({
        ...config,
        videoTitle: data?.videoTitle || config?.videoTitle,
        count: desiredCount,
        videoDuration: videoDuration || 180,
      });

      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        const valid = data.questions.filter(
          (q: any) =>
            q &&
            typeof q.question === 'string' &&
            !isLegacyPlaceholderQuestion(q.question) &&
            (q.type === 'Fill in the Blanks' ||
              (Array.isArray(q.options) && q.options.length >= 2))
        );
        setQuestions(
          valid.length >= desiredCount
            ? valid.slice(0, desiredCount)
            : [...valid, ...fallbackPool.slice(valid.length, desiredCount)].map((q, i) => ({
                ...q,
                id: i + 1,
              }))
        );
      } else {
        setQuestions(fallbackPool);
      }
      setResultsMap({});
      setActiveQuiz(null);
      setToastMessage(
        `Scanned video & generated ${desiredCount} ${config?.topic ? `${config.topic} ` : ''}questions`
      );
      setTimeout(() => setToastMessage(''), 2500);
    } catch {
      const fallbackPool = generateDynamicQuestions({
        ...config,
        count: desiredCount,
        videoDuration: videoDuration || 180,
      });
      setQuestions(fallbackPool);
    } finally {
      setIsGeneratingMore(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col gap-3 pb-4 animate-vq-fade">
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-2xl flex items-center gap-2 animate-vq-pop">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {!isPlayOnlyMode && showEditModal && (
        <EditQuestionsModal
          questions={sortedQuestions}
          setQuestions={setQuestions}
          currentTime={currentTime}
          videoDuration={videoDuration}
          config={config}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveQuizModal
          user={user}
          config={config}
          videoUrl={videoUrl}
          localVideoName={localVideoName}
          isSaving={isSaving}
          onClose={() => setShowSaveModal(false)}
          onConfirmSave={async (saveData: any) => {
            const res = await onSaveQuiz(saveData);
            if (res?.ok) {
              setShowSaveModal(false);
            }
            setToastMessage(res?.message || 'Quiz Saved');
            setTimeout(() => setToastMessage(''), 3000);
          }}
        />
      )}

      {/* UNIFIED CINEMA VIDEO & QUESTION STAGE (Supports Fullscreen with Questions Inside!) */}
      <div
        ref={stageContainerRef}
        className={`w-full flex flex-col bg-[#141026] border border-white/10 overflow-hidden shadow-2xl ${
          isStageFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen bg-black'
            : 'rounded-2xl'
        }`}
      >
        {/* Clean Stage Header Bar (No 0:15 timestamp chips; Live Score on Top Right!) */}
        <div className="px-4 py-2 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 bg-[#0F0C1D] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="vq-display font-extrabold text-white text-sm sm:text-base truncate">
              {config?.topic || config?.videoTitle || localVideoName || 'Video Quiz'}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 text-[11px] font-bold whitespace-nowrap">
              {normalizeEnglishLevel(config?.level)}
            </span>
          </div>

          {/* Right Side: Action Controls + Live Score on the Top Right (e.g. 0/30) */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleResetQuiz}
              title="Reset Video & Questions"
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>

            {!isPlayOnlyMode && (
              <>
                <button
                  type="button"
                  onClick={handleAutoGenerateTopicQuestions}
                  disabled={isGeneratingMore}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                  title="Scan video & auto-generate questions"
                >
                  {isGeneratingMore ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} />
                  )}
                  <span className="hidden sm:inline">Auto-Generate</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowEditModal(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Settings size={13} className="text-amber-400" />
                  <span className="hidden sm:inline">Edit Questions</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setShowSaveModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Folder size={13} />}
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={toggleStageFullscreen}
              title={isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video & Quiz'}
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {isStageFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="hidden sm:inline">
                {isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </span>
            </button>

            {/* Prominent Live Score Badge on Top Right (e.g. 0/30) */}
            <div
              title="Live Score"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border-2 border-emerald-400/70 text-white font-black text-xs sm:text-sm vq-mono flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.25)] whitespace-nowrap"
            >
              <CheckCircle size={15} className="text-emerald-400 shrink-0" />
              <span>
                {correctCount}/{sortedQuestions.length}
              </span>
            </div>
          </div>
        </div>

        {/* Cinema Video Viewport */}
        <div
          id="vq-video-stage"
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden transition-all duration-200 ${
            isStageFullscreen
              ? 'flex-1 min-h-[240px]'
              : activeQuiz
              ? 'h-[52vh] sm:h-[58vh] lg:h-[62vh] min-h-[300px]'
              : 'h-[68vh] sm:h-[74vh] lg:h-[78vh] min-h-[400px]'
          }`}
        >
          <div className="absolute inset-0 w-full h-full">
            {useNativeVideo ? (
              <video
                ref={nativeVideoRef}
                src={videoUrl}
                controls
                playsInline
                onTimeUpdate={(e) => evaluateTimeTrigger(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && Number.isFinite(dur)) setVideoDuration(dur);
                }}
                onPlay={() => (!activeQuiz || isReplayingClip) && setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  vqAudio.playFanfare();
                }}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              <Player
                ref={videoRef}
                src={videoUrl}
                width="100%"
                height="100%"
                playing={isPlaying && (!activeQuiz || isReplayingClip)}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => {
                  setIsPlaying(false);
                  vqAudio.playFanfare();
                }}
                onDurationChange={(e: any) => {
                  const duration = e?.currentTarget?.duration || e?.target?.duration || 120;
                  if (duration && Number.isFinite(duration)) setVideoDuration(duration);
                }}
                controls={true}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            )}
          </div>

          {/* Center Play Button Overlay when paused and no active question */}
          {!isPlaying && !activeQuiz && (
            <div
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 cursor-pointer group"
            >
              <button
                type="button"
                aria-label="Play video"
                className="w-20 h-20 rounded-full bg-amber-400 group-hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.55)] transition-transform duration-200 group-hover:scale-105 cursor-pointer"
              >
                <Play fill="currentColor" size={36} className="ml-1" />
              </button>
            </div>
          )}

          {showConfetti && <Confetti />}
        </div>

        {/* Clean Progress Scrubber with Question Indicators Directly on the Video Slider */}
        <div className="px-4 py-2.5 bg-[#0F0C1D] border-t border-white/10 flex flex-col gap-2.5 shrink-0">
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seekVideoTo(ratio * effectiveDuration);
            }}
            className="relative h-3 bg-white/10 rounded-full cursor-pointer flex items-center my-1"
          >
            {/* Progress Fill */}
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-pink-500 rounded-full transition-all duration-150 pointer-events-none"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />

            {/* Question Indicator Markers on the Video Slider */}
            {sortedQuestions.map((q: any) => {
              const pct = Math.min(
                99,
                Math.max(1, ((Number(q.timeTrigger) || 0) / effectiveDuration) * 100)
              );
              const rec = resultsMap[q.id];
              const isAct = activeQuiz?.id === q.id;

              let markerClass =
                'bg-amber-400 border-[#0F0C1D] shadow-[0_0_8px_rgba(245,158,11,0.9)] hover:scale-125';
              if (isAct) {
                markerClass =
                  'bg-white border-amber-400 scale-135 ring-4 ring-amber-400/40 z-20';
              } else if (rec?.isCorrect === true) {
                markerClass =
                  'bg-emerald-400 border-[#0F0C1D] shadow-[0_0_8px_rgba(16,185,129,0.95)] hover:scale-125';
              } else if (rec?.isCorrect === false) {
                markerClass =
                  'bg-rose-500 border-[#0F0C1D] shadow-[0_0_8px_rgba(244,63,94,0.95)] hover:scale-125';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerQuizNow(q);
                  }}
                  aria-label="Question checkpoint"
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 transition-all cursor-pointer z-10 ${markerClass}`}
                  style={{ left: `${pct}%` }}
                />
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeQuiz && !isReplayingClip) {
                    handleReplayQuestionScene();
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                className="w-8 h-8 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center transition-colors cursor-pointer"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" className="ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => seekVideoTo(currentTime - 5)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Back 5s"
              >
                <SkipBack size={14} />
              </button>
              <button
                type="button"
                onClick={() => seekVideoTo(currentTime + 5)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Forward 5s"
              >
                <SkipForward size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {activeQuiz && (
                <button
                  type="button"
                  onClick={handleReplayQuestionScene}
                  className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  Replay Clip (-5s)
                </button>
              )}

              <button
                type="button"
                onClick={toggleStageFullscreen}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isStageFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isStageFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ACTIVE QUESTION DOCK — Inside the Stage Container so it works seamlessly in Fullscreen too! */}
        {activeQuiz && (
          <div className="w-full border-t-2 border-amber-400/50 bg-[#161229] shrink-0">
            <BelowVideoQuestionDock
              key={activeQuiz.id}
              quiz={activeQuiz}
              isReplayingClip={isReplayingClip}
              onReplayScene={handleReplayQuestionScene}
              onComplete={handleQuizComplete}
              onSkip={() => {
                setActiveQuiz(null);
                setIsReplayingClip(false);
                setIsPlaying(true);
              }}
            />
          </div>
        )}
      </div>

      {/* DIRECT INLINE QUESTION TYPING BAR (Supports Fill in the Blanks & Multiple Choice) */}
      {!isPlayOnlyMode && !activeQuiz && !isStageFullscreen && (
        <div className="w-full bg-[#141026] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Edit3 size={15} className="text-amber-400" />
              <span className="text-xs sm:text-sm font-extrabold text-white">
                Directly Type a Question at Specific Time
              </span>
              <div className="flex items-center p-0.5 rounded-xl bg-[#0E0B1A] border border-white/10">
                {(['Fill in the Blanks', 'Multiple Choice'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setInlineMode(m)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                      inlineMode === m
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setInlineTimeInput(formatSeconds(Math.max(1, Math.round(currentTime || 15))))
              }
              className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
            >
              Use Current Video Time ({formatSeconds(currentTime)})
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex items-center gap-1.5 bg-[#0E0B1A] border border-white/15 rounded-xl px-3 py-2 shrink-0">
              <Clock size={14} className="text-amber-400" />
              <input
                type="text"
                value={inlineTimeInput}
                onChange={(e) => setInlineTimeInput(e.target.value)}
                placeholder="0:15"
                title="Enter timestamp as MM:SS or seconds"
                className="w-16 bg-transparent text-xs font-extrabold text-amber-300 vq-mono focus:outline-none text-center"
              />
            </div>

            <input
              type="text"
              value={inlineQuestionText}
              onChange={(e) => setInlineQuestionText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddInlineQuestion();
                }
              }}
              placeholder={
                inlineMode === 'Fill in the Blanks'
                  ? 'e.g. He has ____ at the mirror.'
                  : 'Type your multiple choice question here...'
              }
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white"
            />

            {inlineMode === 'Fill in the Blanks' && (
              <button
                type="button"
                onClick={() =>
                  setInlineQuestionText(
                    (prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}____ `
                  )
                }
                title="Insert blank ____"
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-amber-300 text-xs font-extrabold cursor-pointer shrink-0"
              >
                + Insert ____
              </button>
            )}

            <button
              type="button"
              onClick={handleAddInlineQuestion}
              disabled={!inlineQuestionText.trim()}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus size={15} />
              Add Question
            </button>
          </div>

          {inlineMode === 'Fill in the Blanks' ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-400/40">
              <span className="text-xs font-extrabold text-emerald-300 shrink-0">
                Correct Missing Word(s):
              </span>
              <input
                type="text"
                value={inlineBlankAnswer}
                onChange={(e) => setInlineBlankAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddInlineQuestion();
                  }
                }}
                placeholder="e.g. looked (students type this answer when the video pauses)"
                className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {['A', 'B', 'C', 'D'].map((letter, idx) => {
                const isRight = inlineCorrectIdx === idx;
                return (
                  <div
                    key={letter}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                      isRight
                        ? 'bg-emerald-500/10 border-emerald-400/50'
                        : 'bg-[#0E0B1A] border-white/10'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setInlineCorrectIdx(idx)}
                      title="Click to mark as correct answer"
                      className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 cursor-pointer ${
                        isRight
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {letter}
                    </button>
                    <input
                      type="text"
                      value={inlineOptions[idx]}
                      onChange={(e) => {
                        const next = [...inlineOptions];
                        next[idx] = e.target.value;
                        setInlineOptions(next);
                      }}
                      placeholder={`Choice ${letter}${isRight ? ' (Correct)' : ''}`}
                      className="w-full bg-transparent text-xs font-medium text-white focus:outline-none"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Clean Below-Video Interactive Question Dock
 * Supports both Fill in the Blanks (student types missing word) and Multiple Choice (A/B/C/D).
 */
function BelowVideoQuestionDock({
  quiz,
  isReplayingClip,
  onReplayScene,
  onComplete,
  onSkip,
}: any) {
  const isFillInBlank =
    quiz?.type === 'Fill in the Blanks' ||
    hasOnlyDummyOptionPlaceholders(quiz?.options) ||
    (Array.isArray(quiz?.options) && quiz.options.length < 2);

  const [selected, setSelected] = useState<number | null>(null);
  const [typedBlank, setTypedBlank] = useState('');
  const [blankCorrect, setBlankCorrect] = useState<boolean>(false);
  const [resolvedBlankAnswer, setResolvedBlankAnswer] = useState<string>('');
  const [showExplanation, setShowExplanation] = useState(false);

  const startTimeRef = useRef<number>(performance.now());
  const blankInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    startTimeRef.current = performance.now();
    setSelected(null);
    setTypedBlank('');
    setBlankCorrect(false);
    setShowExplanation(false);
    if (isFillInBlank) {
      setTimeout(() => blankInputRef.current?.focus(), 60);
    }
  }, [quiz.id, isFillInBlank]);

  const handleSelect = useCallback(
    (idx: number) => {
      if (showExplanation) return;
      setSelected(idx);
      setShowExplanation(true);
      const isCorrect = Boolean(quiz.options?.[idx]?.isCorrect);
      if (isCorrect) vqAudio.playCorrect();
      else vqAudio.playWrong();
    },
    [showExplanation, quiz]
  );

  const handleSubmitFillInBlank = useCallback(() => {
    if (showExplanation || !typedBlank.trim()) return;
    const { isCorrect, primaryAnswer } = checkFillInBlankMatch(typedBlank, quiz);
    setBlankCorrect(isCorrect);
    setResolvedBlankAnswer(primaryAnswer);
    setShowExplanation(true);
    if (isCorrect) vqAudio.playCorrect();
    else vqAudio.playWrong();
  }, [showExplanation, typedBlank, quiz]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isFillInBlank) {
        if (showExplanation && e.key === 'Enter') {
          e.preventDefault();
          const timeTaken = Math.max(
            0.5,
            Number(((performance.now() - startTimeRef.current) / 1000).toFixed(1))
          );
          onComplete({
            isCorrect: blankCorrect,
            selectedIndex: 0,
            responseTimeSec: timeTaken,
          });
        }
        return;
      }

      if (!showExplanation) {
        const key = e.key.toUpperCase();
        const numIdx = ['1', '2', '3', '4'].indexOf(key);
        const charIdx = ['A', 'B', 'C', 'D'].indexOf(key);
        const idx = numIdx >= 0 ? numIdx : charIdx;
        if (idx >= 0 && idx < (quiz.options?.length || 0)) {
          e.preventDefault();
          handleSelect(idx);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const timeTaken = Math.max(
          0.5,
          Number(((performance.now() - startTimeRef.current) / 1000).toFixed(1))
        );
        onComplete({
          isCorrect: Boolean(quiz.options?.[selected!]?.isCorrect),
          selectedIndex: selected ?? 0,
          responseTimeSec: timeTaken,
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isFillInBlank,
    showExplanation,
    blankCorrect,
    selected,
    quiz,
    handleSelect,
    onComplete,
  ]);

  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/_+/g, 'blank'));
      u.lang = 'en-US';
      window.speechSynthesis.speak(u);
    }
  };

  const letters = ['A', 'B', 'C', 'D'];
  const optionCount = (quiz.options || []).length;
  const isFinalCorrect = isFillInBlank
    ? blankCorrect
    : Boolean(quiz.options?.[selected!]?.isCorrect);

  // Format question with live fill-in preview when it contains ____
  const renderFormattedQuestion = () => {
    const qStr = normalizeBlankQuestionText(String(quiz.question || ''));
    if (!qStr.includes('___')) return qStr;
    const parts = qStr.split(/(_+)/);
    return parts.map((part, idx) => {
      if (/^_+$/.test(part)) {
        const previewText = showExplanation
          ? isFinalCorrect
            ? typedBlank.trim() || resolvedBlankAnswer
            : resolvedBlankAnswer
          : typedBlank.trim() || '____';
        return (
          <span
            key={idx}
            className={`inline-block mx-1.5 px-3 py-0.5 rounded-lg border-b-2 font-black transition-colors ${
              showExplanation
                ? isFinalCorrect
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300'
                  : 'bg-amber-400/25 border-amber-400 text-amber-200'
                : typedBlank.trim()
                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                : 'bg-white/10 border-amber-400/70 text-amber-300'
            }`}
          >
            {previewText}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="w-full p-4 sm:p-5 animate-vq-pop text-white">
      {/* Question Prompt + Clean Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <h2 className="vq-display text-base sm:text-xl font-extrabold text-white leading-snug">
          {renderFormattedQuestion()}
        </h2>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onReplayScene}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-amber-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            {isReplayingClip ? 'Replaying...' : 'Replay (-5s)'}
          </button>

          <button
            type="button"
            onClick={() => speakText(quiz.question)}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 size={13} className="text-amber-400" />
            Read Aloud
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold cursor-pointer"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Fill in the Blanks Input OR Multiple Choice Options Grid */}
      {isFillInBlank ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              ref={blankInputRef}
              type="text"
              disabled={showExplanation}
              value={typedBlank}
              onChange={(e) => setTypedBlank(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !showExplanation) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmitFillInBlank();
                }
              }}
              placeholder="Type the missing word(s) to fill in the blank..."
              className={`w-full px-4 py-3.5 rounded-xl border-2 text-sm sm:text-base font-extrabold focus:outline-none transition-colors ${
                showExplanation
                  ? blankCorrect
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-rose-500/20 border-rose-400 text-rose-200'
                  : 'bg-[#0E0B1A] border-white/20 focus:border-amber-400 text-white placeholder:text-slate-500'
              }`}
            />
          </div>

          {!showExplanation && (
            <button
              type="button"
              disabled={!typedBlank.trim()}
              onClick={handleSubmitFillInBlank}
              className="px-6 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-lg"
            >
              <Check size={17} strokeWidth={3} />
              Check Answer
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid gap-2.5 ${
            optionCount === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {(quiz.options || []).map((opt: any, idx: number) => {
            let btnStyle =
              'bg-[#0E0B1A] border-white/15 text-slate-100 hover:border-amber-400 hover:bg-white/5';
            let badgeStyle = 'bg-white/10 text-amber-300';

            if (showExplanation) {
              if (opt.isCorrect) {
                btnStyle =
                  'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.2)]';
                badgeStyle = 'bg-emerald-400 text-slate-950';
              } else if (selected === idx) {
                btnStyle = 'bg-rose-500/20 border-rose-400 text-rose-200';
                badgeStyle = 'bg-rose-500 text-white';
              } else {
                btnStyle = 'bg-[#0E0B1A]/50 border-white/5 text-slate-500 opacity-60';
                badgeStyle = 'bg-white/5 text-slate-500';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={showExplanation}
                onClick={() => handleSelect(idx)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all flex items-start gap-3 cursor-pointer ${btnStyle}`}
              >
                <span
                  className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                >
                  {letters[idx] || idx + 1}
                </span>
                <span className="text-xs sm:text-sm font-bold leading-snug">{opt.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Instant Answer Explanation & Continue Bar */}
      {showExplanation && (
        <div className="mt-4 pt-3.5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 animate-vq-fade">
          <div className="flex items-start gap-2.5 text-left">
            {isFinalCorrect ? (
              <CheckCircle size={19} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={19} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              <span
                className={`font-extrabold mr-2 ${
                  isFinalCorrect ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isFinalCorrect ? 'Correct!' : 'Not quite.'}
              </span>
              {isFillInBlank && !isFinalCorrect && resolvedBlankAnswer && (
                <span className="text-amber-300 font-bold mr-2">
                  Correct answer: &ldquo;{resolvedBlankAnswer}&rdquo;.
                </span>
              )}
              <span className="text-slate-300">{quiz.explanation}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const timeTaken = Math.max(
                0.5,
                Number(((performance.now() - startTimeRef.current) / 1000).toFixed(1))
              );
              onComplete({
                isCorrect: isFinalCorrect,
                selectedIndex: selected ?? 0,
                responseTimeSec: timeTaken,
              });
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap shadow-lg"
          >
            Continue Video
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function SaveQuizModal({
  user,
  config,
  videoUrl,
  localVideoName,
  isSaving,
  onClose,
  onConfirmSave,
}: any) {
  const isBlobUrl = Boolean(videoUrl && videoUrl.startsWith('blob:'));
  const [title, setTitle] = useState(
    config?.topic || config?.videoTitle || localVideoName?.replace(/\.[^/.]+$/, '') || 'Video Quiz'
  );
  const [className, setClassName] = useState(
    config?.className || normalizeEnglishLevel(config?.level)
  );
  const [folders, setFolders] = useState<UnifiedFolderItem[]>(() => mergeUserFolders(user?.uid));
  const [selectedFolderId, setSelectedFolderId] = useState<string>(config?.folderId || '');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolderBusy, setCreatingFolderBusy] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(config?.isPublic ?? true);
  const [webUrlFallback, setWebUrlFallback] = useState(isBlobUrl ? '' : videoUrl || '');

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      fetchAllAvailableFolders(db, user.uid).then((list) => {
        if (active && Array.isArray(list)) {
          setFolders(list);
          if (!selectedFolderId && config?.folder) {
            const match = list.find(
              (f) => f.name.toLowerCase().trim() === String(config.folder).toLowerCase().trim()
            );
            if (match) setSelectedFolderId(match.id);
          }
        }
      });
    }
    return () => {
      active = false;
    };
  }, [user?.uid, config?.folder, selectedFolderId]);

  const handleCreateNewFolder = async () => {
    const clean = newFolderName.trim();
    if (!clean || creatingFolderBusy) return;
    setCreatingFolderBusy(true);
    try {
      const created = await createUnifiedFolder(db, user?.uid, clean);
      const next = mergeUserFolders(user?.uid, [created], folders);
      setFolders(next);
      setSelectedFolderId(created.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
    } finally {
      setCreatingFolderBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matchedFolder = folders.find((f) => String(f.id) === String(selectedFolderId));
    onConfirmSave({
      title: title.trim() || 'Video Quiz',
      className: className.trim(),
      folderId: selectedFolderId,
      folderName: matchedFolder?.name || '',
      isPublic,
      videoUrlOverride: isBlobUrl && webUrlFallback.trim() ? webUrlFallback.trim() : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-vq-pop">
      <form
        onSubmit={handleSubmit}
        className="bg-[#161229] border border-white/15 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
      >
        <div className="px-6 py-4 bg-[#120E22] border-b border-white/10 flex justify-between items-center">
          <h2 className="vq-display text-lg font-extrabold text-white flex items-center gap-2">
            <Folder size={18} className="text-amber-400" />
            Save Video Quiz
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] vq-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Quiz Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mr. Bean Video Quiz"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-semibold text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Class / Level
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Movers · B1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-semibold text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">Folder</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus size={12} />
                  {isCreatingFolder ? 'Cancel' : 'New Folder'}
                </button>
              </div>

              {isCreatingFolder ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name..."
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#0E0B1A] border border-amber-400/50 text-xs font-semibold text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={creatingFolderBusy || !newFolderName.trim()}
                    onClick={handleCreateNewFolder}
                    className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#0E0B1A] border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-semibold text-white"
                >
                  <option value="">No Folder (All Games)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Visibility Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isPublic
                    ? 'bg-amber-400/15 border-amber-400 text-white'
                    : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Globe size={16} className={isPublic ? 'text-amber-400 shrink-0' : 'text-slate-500 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Public Library</div>
                  <div className="text-[10px] text-slate-400 truncate">Shared with teachers</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  !isPublic
                    ? 'bg-pink-500/15 border-pink-400 text-white'
                    : 'bg-[#0E0B1A] border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Lock size={16} className={!isPublic ? 'text-pink-400 shrink-0' : 'text-slate-500 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Private</div>
                  <div className="text-[10px] text-slate-400 truncate">Only in My Games</div>
                </div>
              </button>
            </div>
          </div>

          {isBlobUrl && (
            <div className="p-3.5 rounded-2xl bg-[#0E0B1A] border border-amber-400/30 space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-300">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span>
                  You uploaded a local video file (<strong>{localVideoName}</strong>). Your questions will be saved, or you can paste an online video URL below to link permanently:
                </span>
              </div>
              <input
                type="text"
                value={webUrlFallback}
                onChange={(e) => setWebUrlFallback(e.target.value)}
                placeholder="Optional: https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-lg bg-[#161229] border border-white/15 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#120E22] border-t border-white/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 disabled:opacity-60 text-slate-950 flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {isSaving ? 'Saving...' : 'Save Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EditQuestionsModal({
  questions,
  setQuestions,
  currentTime,
  videoDuration,
  config,
  onClose,
}: any) {
  const [editedQuestions, setEditedQuestions] = useState<any[]>(() =>
    questions.map((q: any) => ({
      ...q,
      answer:
        q.answer ||
        (Array.isArray(q.options) ? q.options.find((o: any) => o?.isCorrect)?.text : '') ||
        '',
      options: (q.options && q.options.length >= 2
        ? q.options
        : [
            { text: q.answer || '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ]
      ).map((o: any) => ({ ...o })),
    }))
  );
  const [customTimeInput, setCustomTimeInput] = useState<string>(() =>
    formatSeconds(Math.max(1, Math.round(currentTime || 15)))
  );

  const updateQuestionField = (id: number, field: string, value: any) => {
    setEditedQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOptionText = (qId: number, optIdx: number, text: string) => {
    setEditedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = q.options.map((o: any, idx: number) =>
          idx === optIdx ? { ...o, text } : o
        );
        return { ...q, options: nextOpts };
      })
    );
  };

  const setCorrectOption = (qId: number, correctIdx: number) => {
    setEditedQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = q.options.map((o: any, idx: number) => ({
          ...o,
          isCorrect: idx === correctIdx,
        }));
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleDeleteQuestion = (id: number) => {
    setEditedQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddQuestionAtSpecificTime = (mode: 'blank' | 'mc' | 'auto') => {
    const nextId = editedQuestions.reduce((m, q) => Math.max(m, q.id || 0), 0) + 1;
    const parsedSec =
      parseTimeInputToSeconds(customTimeInput) ??
      Math.max(1, Math.round(currentTime || (editedQuestions.length + 1) * 15));

    if (mode === 'auto') {
      const pool = generateDynamicQuestions({
        ...config,
        count: editedQuestions.length + 2,
        videoDuration: videoDuration || 180,
      });
      const sample = pool[editedQuestions.length % pool.length];
      setEditedQuestions((prev) => [
        ...prev,
        {
          id: nextId,
          timeTrigger: parsedSec,
          type: sample?.type || 'Fill in the Blanks',
          xp: 100,
          question: sample?.question || '',
          answer: sample?.answer || '',
          acceptedAnswers: sample?.acceptedAnswers || [],
          options: (sample?.options || [
            { text: sample?.answer || '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ]).map((o: any) => ({ ...o })),
          explanation: sample?.explanation || '',
        },
      ]);
    } else if (mode === 'blank') {
      setEditedQuestions((prev) => [
        ...prev,
        {
          id: nextId,
          timeTrigger: parsedSec,
          type: 'Fill in the Blanks',
          xp: 100,
          question: '',
          answer: '',
          acceptedAnswers: [],
          options: [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ],
          explanation: '',
        },
      ]);
    } else {
      setEditedQuestions((prev) => [
        ...prev,
        {
          id: nextId,
          timeTrigger: parsedSec,
          type: 'Multiple Choice',
          xp: 100,
          question: '',
          answer: '',
          options: [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ],
          explanation: '',
        },
      ]);
    }
  };

  const handleSave = () => {
    const sorted = [...editedQuestions]
      .filter((q) => String(q.question || '').trim().length > 0)
      .map((q) => {
        const qText = String(q.question || '').trim();
        if (q.type === 'Fill in the Blanks') {
          const formattedQ = qText.includes('___')
            ? normalizeBlankQuestionText(qText)
            : `${qText} ____`;
          const inferred = inferSmartBlankAnswerFromQuestion(formattedQ);
          const ans = String(q.answer || q.options?.[0]?.text || inferred.answer).trim();
          return {
            ...q,
            question: formattedQ,
            answer: ans,
            acceptedAnswers: Array.from(
              new Set([ans, ...(q.acceptedAnswers || []), ...inferred.acceptedAnswers].filter(Boolean))
            ),
            options: [{ text: ans, isCorrect: true }],
            explanation: q.explanation || `Correct answer: "${ans}".`,
          };
        }
        return {
          ...q,
          options: (q.options || []).map((o: any, idx: number) => ({
            ...o,
            text: String(o.text || '').trim() || `Choice ${['A', 'B', 'C', 'D'][idx]}`,
          })),
        };
      })
      .sort((a, b) => Number(a.timeTrigger || 0) - Number(b.timeTrigger || 0));
    setQuestions(sorted);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 animate-vq-pop">
      <div className="bg-[#161229] border border-white/15 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-[#120E22] border-b border-white/10 flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="vq-display text-lg font-extrabold text-white flex items-center gap-2">
              <Settings size={18} className="text-amber-400" />
              Edit Video Questions
            </h2>
            <p className="text-[11px] text-slate-400">
              {config?.topic ? (
                <>
                  Topic: <span className="text-amber-300 font-bold">{config.topic}</span> ·{' '}
                </>
              ) : null}
              Level: <span className="text-amber-300 font-bold">{normalizeEnglishLevel(config?.level)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#0E0B1A] border border-white/15 rounded-xl px-2.5 py-1">
              <Clock size={13} className="text-amber-400" />
              <input
                type="text"
                value={customTimeInput}
                onChange={(e) => setCustomTimeInput(e.target.value)}
                placeholder="0:15"
                title="Enter specific time as MM:SS (e.g. 1:20) or seconds (e.g. 80)"
                className="w-16 bg-transparent text-xs font-extrabold text-amber-300 vq-mono focus:outline-none text-center"
              />
            </div>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('blank')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> + Fill in the Blank
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('mc')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} className="text-amber-400" /> + Multiple Choice
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('auto')}
              className="px-3 py-1.5 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Sparkles size={13} /> Auto-Generate
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 vq-scrollbar">
          {editedQuestions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/15 bg-[#0E0B1A] text-center space-y-3">
              <div className="text-sm font-extrabold text-white">
                No questions yet — add a Fill in the Blank or Multiple Choice question above
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Enter a timestamp (like <span className="text-amber-300 vq-mono">0:15</span>) and click <strong>+ Fill in the Blank</strong> or <strong>+ Multiple Choice</strong>.
              </p>
            </div>
          ) : (
            editedQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-[#0E0B1A] p-4 rounded-2xl border border-white/10 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400/15 text-amber-300 text-xs font-bold vq-mono">
                      @{formatSeconds(q.timeTrigger)}
                    </span>
                    <label className="text-[11px] text-slate-400 font-semibold">
                      Seconds:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={q.timeTrigger}
                      onChange={(e) =>
                        updateQuestionField(q.id, 'timeTrigger', Math.max(1, Number(e.target.value)))
                      }
                      className="w-20 px-2.5 py-1 rounded-lg bg-[#161229] border border-white/15 text-xs font-bold text-white vq-mono"
                    />
                    <select
                      value={q.type || 'Multiple Choice'}
                      onChange={(e) => updateQuestionField(q.id, 'type', e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-[#161229] border border-white/15 text-xs font-bold text-amber-300"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestionField(
                          q.id,
                          'timeTrigger',
                          Math.max(1, Math.round(currentTime || 10))
                        )
                      }
                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-slate-300 cursor-pointer"
                    >
                      Use Video Time ({formatSeconds(currentTime)})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Delete question"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={q.question}
                  onChange={(e) => updateQuestionField(q.id, 'question', e.target.value)}
                  placeholder={
                    q.type === 'Fill in the Blanks'
                      ? 'e.g. He has ____ at the mirror.'
                      : `Directly type your question for ${formatSeconds(q.timeTrigger)}...`
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#161229] border border-white/15 focus:border-amber-400 focus:outline-none text-xs sm:text-sm font-semibold text-white"
                />

                {q.type === 'Fill in the Blanks' ? (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-400/40">
                    <span className="text-xs font-extrabold text-emerald-300 shrink-0">
                      Correct Answer for Blank:
                    </span>
                    <input
                      type="text"
                      value={q.answer || ''}
                      onChange={(e) => updateQuestionField(q.id, 'answer', e.target.value)}
                      placeholder="e.g. looked"
                      className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-white focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt: any, oIdx: number) => (
                      <div
                        key={oIdx}
                        className={`flex items-center gap-2 p-2 rounded-xl border ${
                          opt.isCorrect
                            ? 'bg-emerald-500/10 border-emerald-400/50'
                            : 'bg-[#161229] border-white/10'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCorrectOption(q.id, oIdx)}
                          title="Mark as correct answer"
                          className={`w-6 h-6 rounded-md text-xs font-black flex items-center justify-center shrink-0 cursor-pointer ${
                            opt.isCorrect
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-white/10 text-slate-400 hover:text-white'
                          }`}
                        >
                          {['A', 'B', 'C', 'D'][oIdx] || oIdx + 1}
                        </button>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => updateOptionText(q.id, oIdx, e.target.value)}
                          placeholder={`Choice ${['A', 'B', 'C', 'D'][oIdx] || oIdx + 1}${
                            opt.isCorrect ? ' (Correct)' : ''
                          }`}
                          className="w-full bg-transparent text-xs font-medium text-white focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 bg-[#120E22] border-t border-white/10 flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={() => setEditedQuestions([])}
            className="px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 cursor-pointer"
          >
            Clear All
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={15} />
              Save Questions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            left: `${(i * 19) % 100}%`,
            top: `-16px`,
            backgroundColor: ['#f59e0b', '#ec4899', '#10b981', '#a855f7', '#fde047'][i % 5],
            animation: `vqConfetti ${1.4 + (i % 5) * 0.25}s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`,
            animationDelay: `${(i % 6) * 0.04}s`,
          }}
        />
      ))}
    </div>
  );
}
