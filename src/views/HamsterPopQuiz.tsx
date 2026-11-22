import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import ReactPlayer from 'react-player';
const Player: any = ReactPlayer;
import {
  Play, Pause, Video, Settings,
  CheckCircle, XCircle, Sparkles, Volume2, VolumeX,
  Plus, Trash2, Check, Loader2, Folder, FolderPlus,
  ArrowRight, ArrowLeft, RotateCcw, SkipForward, SkipBack,
  Edit3, Upload, Globe, Lock, AlertCircle, FileVideo, X,
  Clock, Maximize2, Minimize2, Trophy, ExternalLink, RefreshCw
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
  .vq-scrollbar::-webkit-scrollbar-track { background: rgba(79, 70, 229, 0.06); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb { background: rgba(79, 70, 229, 0.32); border-radius: 8px; }
  .vq-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(79, 70, 229, 0.55); }
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
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (m?.[1]) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return null;
};

interface CapturedVideoFrame {
  sec: number;
  dataUrl: string;
}

const captureLocalVideoFrames = async (
  sourceUrl: string
): Promise<{ frames: CapturedVideoFrame[]; durationSec: number }> => {
  if (typeof window === 'undefined' || !sourceUrl || !isDirectVideoSource(sourceUrl)) {
    return { frames: [], durationSec: 0 };
  }

  const runAttempt = (useCors: boolean): Promise<{ frames: CapturedVideoFrame[]; durationSec: number; loadFailed: boolean }> =>
    new Promise((resolve) => {
      const video = document.createElement('video');
      let settled = false;
      const frames: CapturedVideoFrame[] = [];
      let capturedDuration = 0;

      const cleanupAndResolve = (loadFailed = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {}
        resolve({ frames, durationSec: capturedDuration, loadFailed });
      };

      const safetyTimer = setTimeout(() => cleanupAndResolve(false), 18000);

      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      if (useCors) {
        video.crossOrigin = 'anonymous';
      }

      video.onerror = () => cleanupAndResolve(true);

      video.onloadedmetadata = async () => {
        const dur = Number.isFinite(video.duration) ? video.duration : 0;
        capturedDuration = dur > 0 ? Math.round(dur) : 0;
        const targetCount = dur <= 10 ? 5 : dur <= 30 ? 8 : dur <= 90 ? 12 : 16;
        const sampleTimes: number[] = [];
        if (dur > 1.5) {
          for (let i = 0; i < targetCount; i++) {
            const ratio = 0.04 + (i / Math.max(1, targetCount - 1)) * 0.90;
            const sec = Math.max(0.4, Math.min(dur - 0.3, dur * ratio));
            if (
              sampleTimes.length === 0 ||
              Math.abs(sec - sampleTimes[sampleTimes.length - 1]) >= 0.4
            ) {
              sampleTimes.push(sec);
            }
          }
        } else {
          sampleTimes.push(0.2);
        }

        const vw = video.videoWidth || 480;
        const vh = video.videoHeight || 270;
        const scale = Math.min(512 / vw, 288 / vh, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(160, Math.round(vw * scale));
        canvas.height = Math.max(90, Math.round(vh * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanupAndResolve(false);
          return;
        }

        let tainted = false;
        for (const targetSec of sampleTimes) {
          if (settled || tainted) break;
          await new Promise<void>((seekDone) => {
            let done = false;
            const finishSeek = () => {
              if (done) return;
              done = true;
              clearTimeout(seekTimer);
              video.removeEventListener('seeked', onSeeked);
              seekDone();
            };
            const onSeeked = () => {
              window.requestAnimationFrame(() => {
                try {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const dataUrl = canvas.toDataURL('image/jpeg', 0.62);
                  if (dataUrl && dataUrl.startsWith('data:image/jpeg;base64,')) {
                    frames.push({
                      sec: Math.round(targetSec),
                      dataUrl,
                    });
                  }
                } catch {
                  tainted = true;
                }
                finishSeek();
              });
            };
            const seekTimer = setTimeout(finishSeek, 1400);
            video.addEventListener('seeked', onSeeked);
            try {
              video.currentTime = targetSec;
            } catch {
              finishSeek();
            }
          });
        }
        cleanupAndResolve(false);
      };

      video.src = sourceUrl;
    });

  const isLocal = sourceUrl.startsWith('blob:') || sourceUrl.startsWith('data:');
  const firstTry = await runAttempt(!isLocal);
  if (!isLocal && firstTry.loadFailed) {
    const secondTry = await runAttempt(false);
    return { frames: secondTry.frames, durationSec: secondTry.durationSec };
  }
  return { frames: firstTry.frames, durationSec: firstTry.durationSec };
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
  return '';
};

const adaptClientPronoun = (phrase: string, subj: string): string => {
  if (subj !== 'She') return phrase;
  return phrase
    .replace(/\bhimself\b/gi, 'herself')
    .replace(/\bhis\b/gi, 'her')
    .replace(/\bhe\b/gi, 'she')
    .replace(/\bhim\b/gi, 'her');
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
  const duration = Math.max(60, Number(config?.videoDuration) || 240);
  const usableStart = Math.max(8, Math.floor(duration * 0.04));
  const usableSpan = Math.max(30, Math.floor(duration * 0.90) - usableStart);

  const namedSubject = extractClientVideoSubject(videoTitle, topic);
  const defaultSubject = namedSubject || 'He';
  const isPluralSubject = /\b(and|they|minions|kids|students|animals|friends|people)\b/i.test(
    defaultSubject
  );
  const hasAux = isPluralSubject ? 'have' : 'has';
  const wrongAux = isPluralSubject ? 'has' : 'have';
  const wasAux = isPluralSubject ? 'were' : 'was';
  const wrongWasAux = isPluralSubject ? 'was' : 'were';
  const isAux = isPluralSubject ? 'are' : 'is';
  const wrongIsAux = isPluralSubject ? 'is' : 'are';
  const doesAux = isPluralSubject ? 'do' : 'does';
  const doesntAux = isPluralSubject ? "don't" : "doesn't";
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
          sceneLabel: 'outside the hospital',
          location: 'outside the hospital',
          mustRule: 'park in a normal parking space',
          mustntRule: 'park in front of the ambulance',
          shouldAction: 'move his car away from the ambulance',
          shouldntAction: 'block the ambulance doors',
          v1: 'park',
          v2: 'parked',
          v3: 'parked',
          ing: 'parking',
          vs: 'parks',
          phrase: 'his car near the ambulance',
          passiveSubject: 'The ambulance',
          passiveV3: 'parked',
          passiveAux: 'is',
          adjBase: 'safe',
          adjComp: 'safer',
          adjSuper: 'safest',
        },
        {
          sceneLabel: 'at the hospital desk',
          location: 'in the hospital',
          mustRule: 'take a ticket and wait his turn',
          mustntRule: "take another person's ticket",
          shouldAction: 'wait for his number',
          shouldntAction: 'trick the other people',
          v1: 'take',
          v2: 'took',
          v3: 'taken',
          ing: 'taking',
          vs: 'takes',
          phrase: 'a number ticket at the hospital',
          passiveSubject: 'A ticket',
          passiveV3: 'taken',
          passiveAux: 'was',
          adjBase: 'polite',
          adjComp: 'more polite',
          adjSuper: 'most polite',
        },
        {
          sceneLabel: 'in the waiting room',
          location: 'in the waiting room',
          mustRule: 'sit quietly in the waiting room',
          mustntRule: 'bother the sick people',
          shouldAction: 'sit calmly on his chair',
          shouldntAction: 'make loud noises',
          v1: 'wait',
          v2: 'waited',
          v3: 'waited',
          ing: 'waiting',
          vs: 'waits',
          phrase: 'on a chair in the waiting room',
          passiveSubject: 'The patients',
          passiveV3: 'called',
          passiveAux: 'are',
          adjBase: 'quiet',
          adjComp: 'quieter',
          adjSuper: 'quietest',
        },
        {
          sceneLabel: 'with his hand stuck',
          location: 'at the hospital',
          mustRule: 'ask the doctor for help',
          mustntRule: 'hide his stuck hand',
          shouldAction: 'show his hand to the nurse',
          shouldntAction: 'pull the teapot off too hard',
          v1: 'show',
          v2: 'showed',
          v3: 'shown',
          ing: 'showing',
          vs: 'shows',
          phrase: 'his hand to the nurse',
          passiveSubject: 'The teapot',
          passiveV3: 'removed',
          passiveAux: 'was',
          adjBase: 'careful',
          adjComp: 'more careful',
          adjSuper: 'most careful',
        },
        {
          sceneLabel: 'watching the number screen',
          location: 'by the number screen',
          mustRule: 'watch the screen for his number',
          mustntRule: 'push in front of sick people',
          shouldAction: 'listen when the nurse calls',
          shouldntAction: 'turn his ticket upside down',
          v1: 'check',
          v2: 'checked',
          v3: 'checked',
          ing: 'checking',
          vs: 'checks',
          phrase: 'the number on the screen',
          passiveSubject: 'The number',
          passiveV3: 'shown',
          passiveAux: 'is',
          adjBase: 'fast',
          adjComp: 'faster',
          adjSuper: 'fastest',
        },
      ]
    : isSchool
    ? [
        {
          sceneLabel: 'during the test',
          location: 'in the classroom',
          mustRule: 'do his own work quietly',
          mustntRule: "copy another student's answers",
          shouldAction: 'bring the right pens for the test',
          shouldntAction: 'play with toys on his desk',
          v1: 'write',
          v2: 'wrote',
          v3: 'written',
          ing: 'writing',
          vs: 'writes',
          phrase: 'his answers on the paper',
          passiveSubject: 'The test',
          passiveV3: 'written',
          passiveAux: 'was',
          adjBase: 'careful',
          adjComp: 'more careful',
          adjSuper: 'most careful',
        },
        {
          sceneLabel: 'in the classroom',
          location: 'in class',
          mustRule: 'stop writing when the teacher says stop',
          mustntRule: 'cheat on the test',
          shouldAction: 'read the test questions carefully',
          shouldntAction: 'study the wrong page',
          v1: 'open',
          v2: 'opened',
          v3: 'opened',
          ing: 'opening',
          vs: 'opens',
          phrase: 'the paper on the desk',
          passiveSubject: 'The rules',
          passiveV3: 'explained',
          passiveAux: 'were',
          adjBase: 'easy',
          adjComp: 'easier',
          adjSuper: 'easiest',
        },
      ]
    : isFood
    ? [
        {
          sceneLabel: 'at the restaurant',
          location: 'at the table',
          mustRule: 'be polite at the table',
          mustntRule: "hide food in someone's bag",
          shouldAction: 'order food he likes from the menu',
          shouldntAction: 'make a mess with his food',
          v1: 'order',
          v2: 'ordered',
          v3: 'ordered',
          ing: 'ordering',
          vs: 'orders',
          phrase: 'a meal from the menu',
          passiveSubject: 'The meal',
          passiveV3: 'served',
          passiveAux: 'was',
          adjBase: 'good',
          adjComp: 'better',
          adjSuper: 'best',
        },
        {
          sceneLabel: 'at the dinner table',
          location: 'in the restaurant',
          mustRule: 'use polite table manners',
          mustntRule: 'throw food across the table',
          shouldAction: 'taste the food slowly',
          shouldntAction: 'argue with the waiter',
          v1: 'taste',
          v2: 'tasted',
          v3: 'tasted',
          ing: 'tasting',
          vs: 'tastes',
          phrase: 'the dish carefully',
          passiveSubject: 'The dish',
          passiveV3: 'prepared',
          passiveAux: 'was',
          adjBase: 'delicious',
          adjComp: 'more delicious',
          adjSuper: 'most delicious',
        },
      ]
    : [
        {
          sceneLabel: 'at the start of the video',
          location: 'at the start',
          mustRule: 'follow the rules',
          mustntRule: 'break the rules',
          shouldAction: 'look carefully before acting',
          shouldntAction: 'make a silly mistake',
          v1: 'arrive',
          v2: 'arrived',
          v3: 'arrived',
          ing: 'arriving',
          vs: 'arrives',
          phrase: `at the place in "${cleanTitle}"`,
          passiveSubject: 'The scene',
          passiveV3: 'shown',
          passiveAux: 'is',
          adjBase: 'careful',
          adjComp: 'more careful',
          adjSuper: 'most careful',
        },
        {
          sceneLabel: 'when the problem starts',
          location: 'in this scene',
          mustRule: 'be polite to other people',
          mustntRule: 'push or bother other people',
          shouldAction: 'ask for help politely',
          shouldntAction: 'blame someone else',
          v1: 'try',
          v2: 'tried',
          v3: 'tried',
          ing: 'trying',
          vs: 'tries',
          phrase: 'to fix the problem',
          passiveSubject: 'A plan',
          passiveV3: 'tried',
          passiveAux: 'was',
          adjBase: 'patient',
          adjComp: 'more patient',
          adjSuper: 'most patient',
        },
        {
          sceneLabel: 'in the middle of the video',
          location: 'in the room',
          mustRule: 'keep everyone safe',
          mustntRule: "touch other people's things",
          shouldAction: 'use things safely',
          shouldntAction: 'do something dangerous',
          v1: 'look',
          v2: 'looked',
          v3: 'looked',
          ing: 'looking',
          vs: 'looks',
          phrase: 'around the room',
          passiveSubject: 'The rules',
          passiveV3: 'followed',
          passiveAux: 'were',
          adjBase: 'safe',
          adjComp: 'safer',
          adjSuper: 'safest',
        },
        {
          sceneLabel: 'near the end of the video',
          location: 'at the end',
          mustRule: 'follow the right rules',
          mustntRule: 'make the same mistake again',
          shouldAction: 'say sorry and clean up',
          shouldntAction: 'leave a mess behind',
          v1: 'finish',
          v2: 'finished',
          v3: 'finished',
          ing: 'finishing',
          vs: 'finishes',
          phrase: 'what he was doing',
          passiveSubject: 'The lesson',
          passiveV3: 'learned',
          passiveAux: 'was',
          adjBase: 'good',
          adjComp: 'better',
          adjSuper: 'best',
        },
      ];

  const usedQuestions = new Set<string>();

  const articleBank = [
    { stem: 'sees ____ (a / an / the) funny yellow bag on the floor.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before a singular countable noun starting with a consonant sound ("funny").' },
    { stem: 'finds ____ (a / an / the) old umbrella beside the door.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a vowel sound ("old").' },
    { stem: 'looks at ____ (a / an / the) big clock on the wall.', ans: 'the', acc: ['the'], wrong: ['a', 'an', 'no article'], exp: 'Use "the" when referring to a specific object everyone can see in the scene.' },
    { stem: 'waits for ____ (a / an / the) hour near the entrance.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a silent "h" vowel sound ("hour").' },
    { stem: 'usually likes ____ (a / the / no article) music while relaxing.', ans: 'no article', acc: ['no article', '-', 'nothing', 'x'], wrong: ['a', 'an', 'the'], exp: 'Use no article when talking about uncountable nouns like "music" in general.' },
    { stem: 'picks up ____ (a / an / the) blue ticket from the desk.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before a consonant sound ("blue").' },
    { stem: 'spots ____ (a / an / the) empty seat in the front row.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a vowel sound ("empty").' },
    { stem: 'opens ____ (a / an / the) front door very slowly.', ans: 'the', acc: ['the'], wrong: ['a', 'an', 'no article'], exp: 'Use "the" for the specific front door of the building in the clip.' },
    { stem: 'carries ____ (a / an / the) heavy suitcase up the steps.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before a consonant sound ("heavy").' },
    { stem: 'has ____ (a / the / no article) breakfast before leaving home.', ans: 'no article', acc: ['no article', '-', 'nothing', 'x'], wrong: ['a', 'an', 'the'], exp: 'Use no article before meals like "breakfast", "lunch", or "dinner".' },
    { stem: 'takes ____ (a / an / the) orange notebook out of his pocket.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a vowel sound ("orange").' },
    { stem: 'points straight at ____ (a / an / the) sun through the window.', ans: 'the', acc: ['the'], wrong: ['a', 'an', 'no article'], exp: 'Use "the" for unique things in the sky like "the sun" and "the moon".' },
    { stem: 'wears ____ (a / an / the) bright uniform to look official.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before "uniform" because it starts with a /j/ consonant sound ("you-niform").' },
    { stem: 'writes ____ (a / an / the) honest note on the small card.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before "honest" because the "h" is silent.' },
    { stem: 'goes to ____ (a / the / no article) school by bus on weekdays.', ans: 'no article', acc: ['no article', '-', 'nothing', 'x'], wrong: ['a', 'an', 'the'], exp: 'Use no article in fixed expressions like "go to school" or "at home".' },
    { stem: 'checks ____ (a / an / the) mirror beside the bright lamp.', ans: 'the', acc: ['the'], wrong: ['a', 'an', 'no article'], exp: 'Use "the" for the specific mirror visible in the scene.' },
    { stem: 'buys ____ (a / an / the) cup of hot tea at the counter.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before a singular countable noun starting with a consonant sound ("cup").' },
    { stem: 'has ____ (a / an / the) great idea right after looking around.', ans: 'a', acc: ['a'], wrong: ['an', 'the', 'no article'], exp: 'Use "a" before a consonant sound ("great").' },
    { stem: 'eats ____ (a / an / the) apple quietly on the bench.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a vowel sound ("apple").' },
    { stem: 'rarely drinks ____ (a / the / no article) coffee late at night.', ans: 'no article', acc: ['no article', '-', 'nothing', 'x'], wrong: ['a', 'an', 'the'], exp: 'Use no article for drinks and uncountable nouns spoken about in general.' },
    { stem: 'puts ____ (a / an / the) key back onto the top shelf.', ans: 'the', acc: ['the'], wrong: ['a', 'an', 'no article'], exp: 'Use "the" when talking about the specific key already shown in the scene.' },
    { stem: 'hears ____ (a / an / the) unusual noise behind the curtain.', ans: 'an', acc: ['an'], wrong: ['a', 'the', 'no article'], exp: 'Use "an" before a vowel sound ("unusual").' },
  ];

  return Array.from({ length: count }, (_, index) => {
    const scene = scenes[index % scenes.length];
    const requestedType = types[index % types.length];
    const timeTrigger = Math.min(
      Math.max(8, Math.round(usableStart + ((index + 0.5) / count) * usableSpan)),
      Math.max(15, duration - 6)
    );

    const scSubj = namedSubject || (index % 2 === 0 ? 'He' : 'She');
    const scObj = isPluralSubject ? 'them' : scSubj === 'She' ? 'her' : 'him';
    const scPhrase = adaptClientPronoun(scene.phrase, scSubj);
    const scMustRule = adaptClientPronoun(scene.mustRule, scSubj);
    const scMustntRule = adaptClientPronoun(scene.mustntRule, scSubj);
    const scShouldAction = adaptClientPronoun(scene.shouldAction, scSubj);
    const scShouldntAction = adaptClientPronoun(scene.shouldntAction, scSubj);

    const isMustTopic = /\bmust\b|\bmustn'?t\b|\bmust\s+not\b/i.test(topicLower);
    const isShouldTopic = /\bshould\b|\bshouldn'?t\b/i.test(topicLower);
    const isCanTopic = /\bcan\b|\bcan'?t\b|\bcannot\b|\bcould\b|\bcouldn'?t\b/i.test(topicLower);
    const isHaveToTopic = /\bhave\s+to\b|\bhas\s+to\b|\bdon'?t\s+have\s+to\b|\bdoesn'?t\s+have\s+to\b/i.test(topicLower);
    const isPresentPerfect =
      /\bpresent\s*perf/i.test(topicLower) ||
      /\bpast\s*participle\b|\bv3\b/i.test(topicLower) ||
      /\b(just|already|yet|ever|never)\b/i.test(topicLower) ||
      /\bfor\s+(and|vs\.?|or|\/)\s+since\b|\bsince\s+(and|vs\.?|or|\/)\s+for\b/i.test(topicLower);
    const isPastSimple = topicLower.includes('past simple') || topicLower.includes('simple past');
    const isContinuous = topicLower.includes('continuous') || topicLower.includes('progressive');
    const isPresentSimple = topicLower.includes('present simple') || topicLower.includes('simple present');
    const isFuture = /\b(will|won'?t|going to|future)\b/i.test(topicLower);
    const isPassive = topicLower.includes('passive');
    const isConditional = topicLower.includes('conditional') || /\bif\s+clause/i.test(topicLower);
    const isComparative = topicLower.includes('comparative') || topicLower.includes('superlative');
    const isPreposition = topicLower.includes('preposition');
    const isArticle = topicLower.includes('article') || /\b(a\s*\/\s*an|a\s+and\s+an)\b/i.test(topicLower);
    const isRelative = topicLower.includes('relative');

    let question = '';
    let answer = '';
    let acceptedAnswers: string[] = [];
    let options: Array<{ text: string; isCorrect: boolean }> = [];
    let explanation = '';
    let resolvedType = requestedType;

    if (requestedType === 'True or False') {
      const statementAction = isMustTopic
        ? `${scSubj} must ${scMustRule}.`
        : isPresentPerfect
        ? `${scSubj} ${hasAux} ${scene.v3} ${scPhrase}.`
        : isPastSimple
        ? `${scSubj} ${scene.v2} ${scPhrase}.`
        : isContinuous
        ? `${scSubj} ${topicLower.includes('past') ? wasAux : isAux} ${scene.ing} ${scPhrase}.`
        : `${scSubj} ${scene.vs} ${scPhrase} ${scene.location}.`;
      question = `True or False: ${statementAction}`;
      answer = 'True';
      acceptedAnswers = ['True'];
      options = [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ];
      explanation = `True — that matches this moment in the video.`;
    } else if (isMustTopic) {
      const askMustnt = index % 2 === 0;
      if (requestedType === 'Fill in the Blanks') {
        question = askMustnt
          ? `${scSubj} ____ (must / mustn't) ${scMustntRule}.`
          : `${scSubj} ____ (must / mustn't) ${scMustRule}.`;
        answer = askMustnt ? "mustn't" : 'must';
        acceptedAnswers = askMustnt ? ["mustn't", 'must not', 'mustnt'] : ['must'];
        options = [
          { text: answer, isCorrect: true },
          { text: askMustnt ? 'must' : "mustn't", isCorrect: false },
          { text: 'must to', isCorrect: false },
          { text: 'musts', isCorrect: false },
        ];
        explanation = askMustnt
          ? `Use "mustn't" when something is not allowed.`
          : `Use "must" for an important rule.`;
      } else {
        question = askMustnt
          ? `${scSubj} ____ ${scMustntRule}!`
          : `Which sentence follows the rule ${scene.sceneLabel}?`;
        answer = askMustnt ? "mustn't" : `${scSubj} must ${scMustRule}.`;
        options = askMustnt
          ? [
              { text: "mustn't", isCorrect: true },
              { text: 'must', isCorrect: false },
              { text: 'must to', isCorrect: false },
              { text: "don't must", isCorrect: false },
            ]
          : [
              { text: `${scSubj} must ${scMustRule}.`, isCorrect: true },
              { text: `${scSubj} musts ${scMustRule}.`, isCorrect: false },
              { text: `${scSubj} must to ${scMustRule}.`, isCorrect: false },
              { text: `${scSubj} mustn't ${scMustRule}.`, isCorrect: false },
            ];
        explanation = `Use "must" + base verb (no "-s" or "to"), and "mustn't" for rules against something.`;
      }
    } else if (isShouldTopic) {
      const askShouldnt = index % 2 === 0;
      question = askShouldnt
        ? `${scSubj} ____ (should / shouldn't) ${scShouldntAction}.`
        : `${scSubj} ____ (should / shouldn't) ${scShouldAction}.`;
      answer = askShouldnt ? "shouldn't" : 'should';
      acceptedAnswers = askShouldnt ? ["shouldn't", 'should not', 'shouldnt'] : ['should'];
      options = [
        { text: answer, isCorrect: true },
        { text: askShouldnt ? 'should' : "shouldn't", isCorrect: false },
        { text: 'should to', isCorrect: false },
        { text: 'shoulds', isCorrect: false },
      ];
      explanation = `Use "should" for good advice and "shouldn't" for a bad idea.`;
    } else if (isCanTopic) {
      const useCould = /\bcould/i.test(topicLower);
      const posM = useCould ? 'could' : 'can';
      const negM = useCould ? "couldn't" : "can't";
      const askCant = index % 2 === 0;
      question = askCant
        ? `${scSubj} ____ (${posM} / ${negM}) ${scMustntRule}.`
        : `${scSubj} ____ (${posM} / ${negM}) ${scMustRule}.`;
      answer = askCant ? negM : posM;
      acceptedAnswers = askCant ? [negM, useCould ? 'could not' : 'cannot', useCould ? 'couldnt' : 'cant'] : [posM];
      options = [
        { text: answer, isCorrect: true },
        { text: askCant ? posM : negM, isCorrect: false },
        { text: `${posM} to`, isCorrect: false },
        { text: `${posM}s`, isCorrect: false },
      ];
      explanation = `Use "${posM}" when allowed or possible, and "${negM}" when not.`;
    } else if (isHaveToTopic) {
      question = `${scSubj} ____ (${haveToPos} / ${haveToNeg}) ${scMustRule}.`;
      answer = haveToPos;
      acceptedAnswers = [haveToPos, 'must'];
      options = [
        { text: haveToPos, isCorrect: true },
        { text: haveToNeg, isCorrect: false },
        { text: isPluralSubject ? 'has to' : 'have to', isCorrect: false },
        { text: 'having to', isCorrect: false },
      ];
      explanation = `With "${scSubj}", use "${haveToPos}" to talk about a rule.`;
    } else if (isPresentPerfect) {
      if (requestedType === 'Fill in the Blanks') {
        question = `${scSubj} ${hasAux} ____ (${scene.v1}) ${scPhrase}.`;
        answer = scene.v3;
        acceptedAnswers = [scene.v3, `${hasAux} ${scene.v3}`];
        options = [
          { text: scene.v3, isCorrect: true },
          { text: scene.v1, isCorrect: false },
          { text: scene.ing, isCorrect: false },
          { text: `${wrongAux} ${scene.v1}`, isCorrect: false },
        ];
        explanation = `Present Perfect uses "${hasAux} + ${scene.v3}".`;
      } else {
        question = `${scSubj} ____ just ${scene.v3} ${scPhrase}!`;
        answer = hasAux;
        acceptedAnswers = [hasAux];
        options = [
          { text: hasAux, isCorrect: true },
          { text: wrongAux, isCorrect: false },
          { text: 'did', isCorrect: false },
          { text: isAux, isCorrect: false },
        ];
        explanation = `With "${scSubj}", Present Perfect uses "${hasAux} + ${scene.v3}".`;
      }
    } else if (isPastSimple) {
      question = `${scSubj} ____ (${scene.v1}) ${scPhrase}.`;
      answer = scene.v2;
      acceptedAnswers = [scene.v2];
      options = [
        { text: scene.v2, isCorrect: true },
        { text: scene.v1, isCorrect: false },
        { text: scene.ing, isCorrect: false },
        { text: `did ${scene.v2}`, isCorrect: false },
      ];
      explanation = `The Past Simple form of "${scene.v1}" is "${scene.v2}".`;
    } else if (isContinuous) {
      const isPastCont = topicLower.includes('past');
      const beAux = isPastCont ? wasAux : isAux;
      const wrongBe = isPastCont ? wrongWasAux : wrongIsAux;
      if (index % 2 === 0) {
        question = `${scSubj} ${beAux} ____ (${scene.v1}) ${scPhrase}.`;
        answer = scene.ing;
        acceptedAnswers = [scene.ing, `${beAux} ${scene.ing}`];
        options = [
          { text: scene.ing, isCorrect: true },
          { text: scene.v1, isCorrect: false },
          { text: scene.v2, isCorrect: false },
          { text: scene.vs, isCorrect: false },
        ];
        explanation = `Use "${beAux} + ${scene.ing}" for an action in progress.`;
      } else {
        question = `${scSubj} ____ ${scene.ing} ${scPhrase}.`;
        answer = beAux;
        acceptedAnswers = [beAux];
        options = [
          { text: beAux, isCorrect: true },
          { text: wrongBe, isCorrect: false },
          { text: isPastCont ? 'did' : 'does', isCorrect: false },
          { text: hasAux, isCorrect: false },
        ];
        explanation = `With "${scSubj}", use "${beAux} + ${scene.ing}".`;
      }
    } else if (isPresentSimple) {
      const rightVerb = isPluralSubject ? scene.v1 : scene.vs;
      const wrongVerb = isPluralSubject ? scene.vs : scene.v1;
      if (index % 2 === 0) {
        question = `${scSubj} always ____ (${scene.v1}) ${scPhrase}.`;
        answer = rightVerb;
        acceptedAnswers = [rightVerb];
        options = [
          { text: rightVerb, isCorrect: true },
          { text: wrongVerb, isCorrect: false },
          { text: scene.ing, isCorrect: false },
          { text: `to ${scene.v1}`, isCorrect: false },
        ];
        explanation = `With "${scSubj}", Present Simple uses "${rightVerb}".`;
      } else {
        question = `${scSubj} ____ like to ${scMustntRule}.`;
        answer = doesntAux;
        acceptedAnswers = [doesntAux, doesAux === 'does' ? 'does not' : 'do not'];
        options = [
          { text: doesntAux, isCorrect: true },
          { text: isPluralSubject ? "doesn't" : "don't", isCorrect: false },
          { text: "isn't", isCorrect: false },
          { text: 'not', isCorrect: false },
        ];
        explanation = `Use "${doesntAux} + base verb" with "${scSubj}".`;
      }
    } else if (isFuture) {
      question = `Next, ${scSubj.toLowerCase()} ____ (${scene.v1}) ${scPhrase}.`;
      answer = `will ${scene.v1}`;
      acceptedAnswers = [`will ${scene.v1}`, `${isAux} going to ${scene.v1}`];
      options = [
        { text: `will ${scene.v1}`, isCorrect: true },
        { text: `will ${scene.v2}`, isCorrect: false },
        { text: `will to ${scene.v1}`, isCorrect: false },
        { text: `is ${scene.v1}`, isCorrect: false },
      ];
      explanation = `After "will", always use the base verb "${scene.v1}".`;
    } else if (isPassive) {
      question = `${scene.passiveSubject} ${scene.passiveAux} ____ (${scene.v1}) ${scene.location}.`;
      answer = scene.passiveV3;
      acceptedAnswers = [scene.passiveV3, `${scene.passiveAux} ${scene.passiveV3}`];
      options = [
        { text: scene.passiveV3, isCorrect: true },
        { text: scene.v1, isCorrect: false },
        { text: scene.ing, isCorrect: false },
        { text: scene.vs, isCorrect: false },
      ];
      explanation = `Passive Voice uses "be + past participle (${scene.passiveV3})".`;
    } else if (isConditional) {
      question = `If ${scSubj.toLowerCase()} is careful ${scene.sceneLabel}, things ____ (be) much better.`;
      answer = 'will be';
      acceptedAnswers = ['will be'];
      options = [
        { text: 'will be', isCorrect: true },
        { text: 'would been', isCorrect: false },
        { text: 'was being', isCorrect: false },
        { text: 'is be', isCorrect: false },
      ];
      explanation = `First Conditional uses "If + Present Simple, will + base verb".`;
    } else if (isComparative) {
      const useSuper = index % 2 === 1;
      if (useSuper) {
        question = `This is the ____ (${scene.adjBase}) moment ${scene.location}!`;
        answer = scene.adjSuper;
        acceptedAnswers = [scene.adjSuper];
        options = [
          { text: scene.adjSuper, isCorrect: true },
          { text: scene.adjComp, isCorrect: false },
          { text: `more ${scene.adjBase}`, isCorrect: false },
          { text: scene.adjBase, isCorrect: false },
        ];
        explanation = `Use the superlative "${scene.adjSuper}" after "the".`;
      } else {
        question = `It is much ____ (${scene.adjBase}) to follow the rules ${scene.location}.`;
        answer = scene.adjComp;
        acceptedAnswers = [scene.adjComp];
        options = [
          { text: scene.adjComp, isCorrect: true },
          { text: scene.adjSuper, isCorrect: false },
          { text: scene.adjBase, isCorrect: false },
          { text: `most ${scene.adjBase}`, isCorrect: false },
        ];
        explanation = `Use the comparative "${scene.adjComp}" to compare two choices.`;
      }
    } else if (isPreposition) {
      question = `${scSubj} is waiting ____ the room ${scene.sceneLabel}.`;
      answer = 'in';
      acceptedAnswers = ['in', 'inside'];
      options = [
        { text: 'in', isCorrect: true },
        { text: 'on', isCorrect: false },
        { text: 'under', isCorrect: false },
        { text: 'between', isCorrect: false },
      ];
      explanation = `Use "in" for an enclosed place like a room.`;
    } else if (isArticle) {
      const item = articleBank[index % articleBank.length];
      question = `${scSubj} ${adaptClientPronoun(item.stem, scSubj)}`;
      answer = item.ans;
      acceptedAnswers = item.acc;
      options = [
        { text: item.ans, isCorrect: true },
        ...item.wrong.map((w) => ({ text: w, isCorrect: false })),
      ];
      explanation = item.exp;
    } else if (isRelative) {
      question = `The person ____ helps ${scObj} ${scene.location} is very kind.`;
      answer = 'who';
      acceptedAnswers = ['who', 'that'];
      options = [
        { text: 'who', isCorrect: true },
        { text: 'which', isCorrect: false },
        { text: 'where', isCorrect: false },
        { text: 'what', isCorrect: false },
      ];
      explanation = `Use "who" when talking about a person.`;
    } else if (requestedType === 'Fill in the Blanks') {
      question = `${scSubj} ____ (${scene.v1}) ${scPhrase}.`;
      answer = scene.vs;
      acceptedAnswers = [scene.vs, scene.v2, `${isAux} ${scene.ing}`];
      options = [
        { text: scene.vs, isCorrect: true },
        { text: scene.ing, isCorrect: false },
        { text: `to ${scene.v1}`, isCorrect: false },
        { text: `didn't ${scene.v2}`, isCorrect: false },
      ];
      explanation = `${scSubj} ${scene.vs} ${scPhrase}.`;
    } else {
      question = `What does ${scSubj.toLowerCase()} do ${scene.sceneLabel}?`;
      answer = `${scSubj} ${scene.vs} ${scPhrase}.`;
      acceptedAnswers = [answer];
      options = [
        { text: `${scSubj} ${scene.vs} ${scPhrase}.`, isCorrect: true },
        { text: 'Everyone goes to sleep quietly.', isCorrect: false },
        { text: 'Nothing happens in this scene.', isCorrect: false },
        { text: 'The video shows an empty playground.', isCorrect: false },
      ];
      explanation = `In this scene, ${scSubj.toLowerCase()} ${scene.vs} ${scPhrase}.`;
    }

    if (usedQuestions.has(question)) {
      const altTimeTag = `At ${Math.floor(timeTrigger / 60)}:${String(timeTrigger % 60).padStart(2, '0')}, `;
      if (!question.startsWith('At ') && !question.startsWith('True or False:')) {
        question = `${altTimeTag}${question.charAt(0).toLowerCase()}${question.slice(1)}`;
      }
    }
    usedQuestions.add(question);

    const rotatedOpts = options.map((o) => ({ ...o }));
    if (rotatedOpts.length > 2) {
      const shift = index % rotatedOpts.length;
      for (let s = 0; s < shift; s++) {
        const first = rotatedOpts.shift();
        if (first) rotatedOpts.push(first);
      }
    }

    if (
      resolvedType === 'Fill in the Blanks' &&
      (!question.includes('___') || answer.split(/\s+/).length > 4)
    ) {
      resolvedType = 'Multiple Choice';
    }

    return {
      id: index + 1,
      timeTrigger,
      type: resolvedType,
      xp: 100,
      question,
      answer,
      acceptedAnswers: acceptedAnswers.length > 0 ? acceptedAnswers : [answer],
      options: rotatedOpts,
      explanation,
    };
  });
};

const THINKING_DURATION_MS = 4500;

function ThinkingAnalysisOverlay({
  elapsedMs,
  totalMs = THINKING_DURATION_MS,
  questionCount,
  topic,
  videoTitle,
}: {
  elapsedMs: number;
  totalMs?: number;
  questionCount: number;
  topic?: string;
  videoTitle?: string;
}) {
  const clampedElapsed = Math.min(totalMs, Math.max(0, elapsedMs));
  const pct = Math.min(100, Math.round((clampedElapsed / totalMs) * 100));
  const remainingSec = Math.max(0, Math.ceil((totalMs - clampedElapsed) / 1000));
  const stepIndex =
    clampedElapsed < totalMs * 0.34 ? 0 : clampedElapsed < totalMs * 0.68 ? 1 : 2;

  const steps = [
    {
      title: '1. Scanning Verified Transcript & Visual Frames',
      desc: 'Mapping exact timestamps, scene shifts, and spoken dialogue across the video.',
    },
    {
      title: '2. Deep Scene & Character Pronoun Analysis',
      desc: 'Matching real characters and actions (he/she/they) grounded in each timestamped clip.',
    },
    {
      title: '3. Grammar & Scene-Match Audit',
      desc: `Verifying ${questionCount} distinct, scene-accurate ${
        topic ? `${topic} ` : ''
      }questions.`,
    },
  ];

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/45 backdrop-blur-sm flex items-center justify-center p-4 animate-vq-fade">
      <div className="w-full max-w-lg bg-white border-2 border-indigo-200 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
              <Loader2 size={22} className="animate-spin" />
            </div>
            <div className="min-w-0">
              <h3 className="vq-display text-lg sm:text-xl font-black text-slate-900 leading-tight">
                Generating Scene-Matched Quiz
              </h3>
              <p className="text-xs text-slate-500 truncate">
                {videoTitle ? `Analyzing "${videoTitle}"` : 'Analyzing video transcript, scenes & grammar'}
              </p>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-2xl bg-amber-50 border border-amber-300 text-center shrink-0">
            <div className="vq-mono text-lg sm:text-xl font-black text-amber-700 leading-none">
              {remainingSec}s
            </div>
            <div className="text-[10px] font-bold text-amber-700/80 uppercase tracking-wider mt-0.5">
              matching
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-700">
              Building {questionCount} accurate {topic ? `${topic} ` : ''}questions from video scenes
            </span>
            <span className="vq-mono text-indigo-600">{pct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {steps.map((st, idx) => {
            const isDone = idx < stepIndex || remainingSec === 0;
            const isActive = idx === stepIndex && remainingSec > 0;
            return (
              <div
                key={st.title}
                className={`p-3 rounded-2xl border transition-colors flex items-start gap-3 ${
                  isDone
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : isActive
                    ? 'bg-indigo-50 border-indigo-300 text-slate-900'
                    : 'bg-[#FAF7F0] border-[#E6E0D4] text-slate-400'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle size={16} className="text-emerald-600" />
                  ) : isActive ? (
                    <Sparkles size={16} className="text-indigo-600 animate-pulse" />
                  ) : (
                    <Clock size={16} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold">{st.title}</div>
                  <div className="text-[11px] opacity-85 leading-relaxed mt-0.5">{st.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
          verifiedTranscript: initialGame.lessonConfig?.verifiedTranscript || '',
          sceneSummary: initialGame.lessonConfig?.sceneSummary || '',
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
          verifiedTranscript: '',
          sceneSummary: '',
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
  const processedLocalScanRef = useRef<{
    sourceUrl: string;
    frames: CapturedVideoFrame[];
    durationSec: number;
  } | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [thinkingState, setThinkingState] = useState<{
    elapsedMs: number;
    count: number;
    topic: string;
    videoTitle: string;
  } | null>(null);
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
        verifiedTranscript: initialGame.lessonConfig?.verifiedTranscript || '',
        sceneSummary: initialGame.lessonConfig?.sceneSummary || '',
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
    processedLocalScanRef.current = null;
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
    processedLocalScanRef.current = null;
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
    const ytId = extractClientYouTubeId(finalUrl);
    if (ytId) {
      return `https://www.youtube.com/watch?v=${ytId}`;
    }
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
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
    setLiveScoreCount(0);
    setVideoUrl(cleanUrl);
    setLessonConfig(config);
    setIsLockedPlayMode(false);
    setOpenEditorOnMount(false);

    const desiredCount = Math.max(1, Math.min(100, Number(config.count) || 5));
    setIsGenerating(true);
    const startedAt = Date.now();
    setThinkingState({
      elapsedMs: 0,
      count: desiredCount,
      topic: (config.topic || '').trim(),
      videoTitle: config.videoTitle || localVideoName || '',
    });

    const tickInterval = window.setInterval(() => {
      setThinkingState((prev) =>
        prev ? { ...prev, elapsedMs: Date.now() - startedAt } : prev
      );
    }, 200);

    try {
      const workPromise = (async () => {
        let capturedClientFrames: CapturedVideoFrame[] = [];
        let capturedLocalDuration = 0;
        if (cleanUrl.startsWith('blob:') || isDirectVideoSource(cleanUrl)) {
          if (processedLocalScanRef.current?.sourceUrl === cleanUrl) {
            capturedClientFrames = processedLocalScanRef.current.frames;
            capturedLocalDuration = processedLocalScanRef.current.durationSec;
          } else {
            const localScan = await captureLocalVideoFrames(cleanUrl);
            capturedClientFrames = localScan.frames;
            capturedLocalDuration = localScan.durationSec;
            processedLocalScanRef.current = {
              sourceUrl: cleanUrl,
              frames: localScan.frames,
              durationSec: localScan.durationSec,
            };
          }
        }

        const res = await fetch('/api/generate-hamster-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: (config.topic || '').trim(),
            videoTitle: config.videoTitle || localVideoName || '',
            level: normalizeEnglishLevel(config.level),
            types: config.selectedTypes,
            count: desiredCount,
            videoDuration: Number(config.videoDuration) || capturedLocalDuration || 0,
            videoUrl: cleanUrl.startsWith('blob:') ? localVideoName : cleanUrl,
            verifiedTranscript: (config.verifiedTranscript || '').trim(),
            sceneSummary: (config.sceneSummary || '').trim(),
            ...(capturedClientFrames.length > 0 ? { clientFrames: capturedClientFrames } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(
            data?.error ||
              'Could not analyze this video right now. Please check the video source or API key and try again.'
          );
        }
        if (!Array.isArray(data?.questions) || data.questions.length === 0) {
          throw new Error(
            'No scene-matched questions could be extracted from this video. Please verify the video is accessible and try again.'
          );
        }
        return { data, capturedLocalDuration };
      })();

      const minThinkingWait = new Promise<void>((resolve) =>
        window.setTimeout(resolve, THINKING_DURATION_MS)
      );

      const [{ data, capturedLocalDuration }] = await Promise.all([
        workPromise,
        minThinkingWait,
      ]);

      const resolvedVidTitle = data?.videoTitle || config.videoTitle || '';
      const resolvedVidDuration =
        Number(data?.videoDuration) || capturedLocalDuration || Number(config.videoDuration) || 0;
      if (resolvedVidTitle || resolvedVidDuration) {
        setLessonConfig((prev: any) => ({
          ...prev,
          ...(resolvedVidTitle ? { videoTitle: resolvedVidTitle } : {}),
          ...(resolvedVidDuration > 0 ? { videoDuration: resolvedVidDuration } : {}),
        }));
      }

      const validFromApi = data.questions.filter(
        (q: any) =>
          q &&
          typeof q.question === 'string' &&
          !isLegacyPlaceholderQuestion(q.question) &&
          (q.type === 'Fill in the Blanks' ||
            (Array.isArray(q.options) && q.options.length >= 2))
      );

      if (validFromApi.length === 0) {
        throw new Error(
          'Generated questions did not pass quality validation. Please try processing the video again.'
        );
      }

      setQuestions(
        validFromApi.slice(0, desiredCount).map((q: any, i: number) => ({
          ...q,
          id: i + 1,
        }))
      );
      setCurrentView('player');
    } catch (e: any) {
      console.error(e);
      const raw = String(e?.message || '');
      let cleanMsg = raw;
      const jIdx = raw.indexOf('{');
      if (jIdx >= 0) {
        try {
          const parsed = JSON.parse(raw.slice(jIdx));
          const inner = parsed?.error?.message || parsed?.message;
          if (typeof inner === 'string' && inner.trim()) cleanMsg = inner.trim();
        } catch {}
      }
      if (/prepayment credits|billing#prepay/i.test(cleanMsg)) {
        cleanMsg =
          'Gemini API prepayment credits are depleted on this project. Top up billing at ai.studio/projects or switch to an active GEMINI_API_KEY in Settings > Secrets.';
      }
      setSetupError(
        cleanMsg ||
          'Could not generate questions matching this video. Please check your video source or try again.'
      );
    } finally {
      window.clearInterval(tickInterval);
      setThinkingState(null);
      setIsGenerating(false);
    }
  };

  return (
    <div
      id="game-container"
      className="w-full min-h-full flex-1 text-slate-900 vq-body overflow-y-auto overflow-x-hidden bg-[#FAF7F0] relative selection:bg-indigo-600 selection:text-white flex flex-col"
      style={{
        backgroundImage:
          'radial-gradient(circle at 15% 12%, rgba(79, 70, 229, 0.08), transparent 42%), radial-gradient(circle at 85% 15%, rgba(245, 158, 11, 0.10), transparent 45%)',
      }}
    >
      <style>{customStyles}</style>

      {thinkingState && (
        <ThinkingAnalysisOverlay
          elapsedMs={thinkingState.elapsedMs}
          questionCount={thinkingState.count}
          topic={thinkingState.topic}
          videoTitle={thinkingState.videoTitle}
        />
      )}

      {/* Clean Bright Classroom Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#E6E0D4] px-3 sm:px-5 h-14 flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <button
            onClick={() => onViewChange('games')}
            title="Back to Games"
            className="w-9 h-9 rounded-xl bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] hover:border-indigo-300 flex items-center justify-center text-slate-700 hover:text-indigo-700 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={17} />
          </button>
          <FullscreenButton targetId="game-container" />
          <div className="flex items-center gap-2.5 text-left ml-0.5 min-w-0">
            <img
              src="/images/video-quiz-card-v3.jpg?v=3"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/assets/aistudio/image_3b5337e9.png';
              }}
              alt="Video Quiz"
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-lg object-cover border border-indigo-200 shadow-xs shrink-0"
            />
            <span className="vq-display text-base sm:text-lg font-extrabold tracking-tight text-slate-900 truncate">
              Video <span className="text-indigo-600">Quiz</span>
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        {!isLockedPlayMode && (
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#FAF7F0] border border-[#E6E0D4]">
            <button
              onClick={() => setCurrentView('setup')}
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'setup'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
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
              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                currentView === 'player'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              Player
            </button>
          </div>
        )}

        {/* Audio Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {currentView === 'setup' && questions.length > 0 && (
            <span className="hidden sm:inline text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg vq-mono whitespace-nowrap mr-1">
              {questions.length} {questions.length === 1 ? 'Q' : 'Qs'} ready
            </span>
          )}
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            className="w-9 h-9 rounded-xl bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] hover:border-indigo-300 flex items-center justify-center text-slate-700 hover:text-indigo-700 transition-colors cursor-pointer"
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
            onProcessedLocalScan={(scan: { sourceUrl: string; frames: CapturedVideoFrame[]; durationSec: number }) => {
              processedLocalScanRef.current = scan;
            }}
            initialConfig={lessonConfig}
            setupError={setupError}
            setSetupError={setSetupError}
            onStartLesson={handleStartLesson}
            onOpenManualPlayer={(config: any) => {
              const cleanUrl = normalizeVideoUrl(config?.videoUrl || videoUrl);
              if (cleanUrl) setVideoUrl(cleanUrl);
              setLessonConfig(config);
              setSetupError('');
              setOpenEditorOnMount(true);
              setCurrentView('player');
            }}
            isGenerating={isGenerating}
          />
        ) : (
          <PlayerView
            key={videoUrl || 'no-video'}
            user={user}
            config={lessonConfig}
            questions={questions}
            setQuestions={setQuestions}
            videoUrl={videoUrl}
            localVideoName={localVideoName}
            cachedVideoScan={processedLocalScanRef.current}
            onSaveQuiz={handleSaveVideoQuiz}
            isSaving={isSaving}
            isPlayOnlyMode={isLockedPlayMode}
            initialOpenEditor={openEditorOnMount}
            onBackToSetup={() => setCurrentView('setup')}
            onScoreChange={setLiveScoreCount}
            isAppMuted={isMuted}
            onToggleAppMute={toggleMute}
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
  onProcessedLocalScan,
  initialConfig,
  setupError,
  setSetupError,
  onStartLesson,
  onOpenManualPlayer,
  isGenerating,
}: any) {
  const isBlobUrl = Boolean(videoUrl && videoUrl.startsWith('blob:'));
  const [urlInput, setUrlInput] = useState(isBlobUrl ? '' : videoUrl || '');
  const [topic, setTopic] = useState(initialConfig?.topic || '');
  const [detectedVideoTitle, setDetectedVideoTitle] = useState(initialConfig?.videoTitle || '');
  const [detectedDurationSec, setDetectedDurationSec] = useState<number>(
    Number(initialConfig?.videoDuration) || 0
  );
  const [extractedTranscript, setExtractedTranscript] = useState<string>(
    initialConfig?.verifiedTranscript || ''
  );
  const [extractedSceneSummary, setExtractedSceneSummary] = useState<string>(
    initialConfig?.sceneSummary || ''
  );
  const [transcriptSourceType, setTranscriptSourceType] = useState<
    'captions' | 'visual_ai' | 'scene_metadata'
  >('captions');
  const [showTranscriptPanel, setShowTranscriptPanel] = useState<boolean>(
    Boolean(initialConfig?.verifiedTranscript || initialConfig?.sceneSummary)
  );
  const [scanMeta, setScanMeta] = useState<{
    hasTranscript?: boolean;
    chaptersCount?: number;
    framesCount?: number;
  } | null>(null);
  const [isScanningVideoTitle, setIsScanningVideoTitle] = useState(false);
  const [processedSourceKey, setProcessedSourceKey] = useState<string>(
    initialConfig?.videoTitle && initialConfig?.videoUrl ? initialConfig.videoUrl : ''
  );

  const [level, setLevel] = useState(normalizeEnglishLevel(initialConfig?.level));
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    initialConfig?.selectedTypes || ['Fill in the Blanks', 'Multiple Choice', 'Grammar Choice']
  );

  const initialCountNum = Math.max(1, Math.min(100, Number(initialConfig?.count) || 5));
  const [quizCountInput, setQuizCountInput] = useState<string>(String(initialCountNum));
  const resolvedQuizCount = Math.max(1, Math.min(100, parseInt(quizCountInput, 10) || 5));

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setUrlInput('');
      setDetectedVideoTitle('');
      setDetectedDurationSec(0);
      setExtractedTranscript('');
      setExtractedSceneSummary('');
      setShowTranscriptPanel(false);
      setScanMeta(null);
      setProcessedSourceKey('');
    } else if (!videoUrl.startsWith('blob:')) {
      setUrlInput(videoUrl);
    }
  }, [videoUrl]);

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

  const normalizeSetupUrl = (raw: string) => {
    const s = (raw || '').trim();
    if (!s || s.startsWith('blob:') || s.startsWith('data:')) return s;
    const ytId = extractClientYouTubeId(s);
    if (ytId) return `https://www.youtube.com/watch?v=${ytId}`;
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  const canonicalActiveSource = normalizeSetupUrl(activeVideoSource);
  const isCurrentSourceProcessed = Boolean(
    canonicalActiveSource && processedSourceKey && processedSourceKey === canonicalActiveSource
  );

  // Explicit user-triggered video processing: extracts transcript + scene summary and displays preview panel
  const handleProcessVideo = async () => {
    if (!activeVideoSource) {
      setSetupError('Please paste a video URL or upload a local video file first.');
      urlInputRef.current?.focus();
      return;
    }
    setSetupError('');
    setIsScanningVideoTitle(true);

    try {
      if (isBlobUrl || isDirectVideoSource(canonicalActiveSource)) {
        const targetSource = isBlobUrl ? videoUrl : canonicalActiveSource;
        const localScan = await captureLocalVideoFrames(targetSource);
        if (localScan.durationSec > 0) {
          setDetectedDurationSec(localScan.durationSec);
        }
        const fileSlug = (isBlobUrl ? localVideoName : canonicalActiveSource.split('/').pop()?.split('?')[0]) || '';
        const cleanLocalTitle =
          fileSlug.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() ||
          'Uploaded Video';
        setDetectedVideoTitle(cleanLocalTitle);
        if (typeof onProcessedLocalScan === 'function') {
          onProcessedLocalScan({
            sourceUrl: targetSource,
            frames: localScan.frames,
            durationSec: localScan.durationSec,
          });
        }

        // Send captured frames to /api/scan-video-info to extract visual scene summary & timeline
        let gotServerTimeline = false;
        try {
          const scanRes = await fetch('/api/scan-video-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: cleanLocalTitle,
              videoTitle: cleanLocalTitle,
              videoDuration: localScan.durationSec,
              clientFrames: localScan.frames,
            }),
          });
          if (scanRes.ok) {
            const info = await scanRes.json();
            if (typeof info?.transcriptText === 'string' && info.transcriptText.trim()) {
              setExtractedTranscript(info.transcriptText.trim());
              gotServerTimeline = true;
            }
            if (typeof info?.sceneSummary === 'string' && info.sceneSummary.trim()) {
              setExtractedSceneSummary(info.sceneSummary.trim());
            }
            if (info?.sourceType) {
              setTranscriptSourceType(info.sourceType);
            }
          }
        } catch {}

        if (!gotServerTimeline) {
          const fallbackLines = localScan.frames.map(
            (f, idx) =>
              `[${formatSeconds(f.sec)}] Scene #${idx + 1} captured from "${cleanLocalTitle}" at ${formatSeconds(f.sec)}.`
          );
          setExtractedTranscript(fallbackLines.join('\n'));
          setExtractedSceneSummary(
            `Uploaded video "${cleanLocalTitle}" (${formatSeconds(
              localScan.durationSec || 120
            )}) with ${localScan.frames.length} visual scene frames captured.`
          );
          setTranscriptSourceType('visual_ai');
        }

        setScanMeta({
          hasTranscript: true,
          framesCount: localScan.frames.length,
        });
        setShowTranscriptPanel(true);
        setProcessedSourceKey(canonicalActiveSource);
        return;
      }

      const ytId = extractClientYouTubeId(activeVideoSource);
      const targetUrl = ytId
        ? `https://www.youtube.com/watch?v=${ytId}`
        : canonicalActiveSource;

      let resolvedTitle = '';
      try {
        const scanRes = await fetch('/api/scan-video-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoUrl: targetUrl }),
        });
        if (scanRes.ok) {
          const info = await scanRes.json();
          if (info?.title) {
            resolvedTitle = String(info.title).trim();
            setDetectedVideoTitle(resolvedTitle);
          }
          if (Number(info?.durationSec) > 0) {
            setDetectedDurationSec(Number(info.durationSec));
          }
          if (typeof info?.transcriptText === 'string' && info.transcriptText.trim()) {
            setExtractedTranscript(info.transcriptText.trim());
          }
          if (typeof info?.sceneSummary === 'string' && info.sceneSummary.trim()) {
            setExtractedSceneSummary(info.sceneSummary.trim());
          }
          if (info?.sourceType) {
            setTranscriptSourceType(info.sourceType);
          }
          setScanMeta({
            hasTranscript: Boolean(info?.hasTranscript || info?.transcriptText),
            chaptersCount: Number(info?.chaptersCount) || 0,
            framesCount: Number(info?.framesCount) || 0,
          });
          setShowTranscriptPanel(true);
        }
      } catch {}

      if (!resolvedTitle && ytId) {
        try {
          const res = await fetch(
            `https://noembed.com/embed?url=${encodeURIComponent(
              `https://www.youtube.com/watch?v=${ytId}`
            )}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data?.title) {
              resolvedTitle = String(data.title).trim();
              setDetectedVideoTitle(resolvedTitle);
            }
          }
        } catch {}
      }

      setProcessedSourceKey(canonicalActiveSource);
    } catch {
      setSetupError('Could not scan this video automatically. You can still paste scene notes or generate questions.');
    } finally {
      setIsScanningVideoTitle(false);
    }
  };

  const buildPayload = () => {
    const canonicalVideoUrl = normalizeSetupUrl(activeVideoSource);
    const prevYtId = extractClientYouTubeId(initialConfig?.videoUrl || '');
    const currYtId = extractClientYouTubeId(canonicalVideoUrl);
    const isSameVideoAsInitial = Boolean(
      canonicalVideoUrl && initialConfig?.videoUrl && prevYtId && currYtId && prevYtId === currYtId
    );
    return {
      ...initialConfig,
      videoUrl: canonicalVideoUrl,
      videoDuration:
        detectedDurationSec > 0
          ? detectedDurationSec
          : isSameVideoAsInitial
          ? initialConfig?.videoDuration
          : 0,
      topic: topic.trim(),
      videoTitle:
        detectedVideoTitle ||
        (localVideoName ? localVideoName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ') : ''),
      verifiedTranscript: extractedTranscript.trim(),
      sceneSummary: extractedSceneSummary.trim(),
      level: normalizeEnglishLevel(level),
      selectedTypes,
      count: resolvedQuizCount,
    };
  };

  const transcriptLineCount = extractedTranscript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;

  return (
    <div className="flex-1 flex flex-col justify-center max-w-5xl mx-auto w-full animate-vq-fade">
      <div className="bg-white border border-[#E6E0D4] rounded-3xl p-5 sm:p-8 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-[#E6E0D4]">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 border-2 border-indigo-200 shadow-md bg-indigo-50">
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
            <h1 className="vq-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
              Interactive <span className="text-indigo-600">Video Quiz</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Paste a video URL or upload a video file, click <strong className="text-indigo-700">Process Video</strong> to preview its extracted transcript &amp; scene breakdown, then auto-generate 100% scene-accurate questions.
            </p>
          </div>
        </div>

        {/* Main Setup Form Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Video Source, Extracted Transcript & Scene Preview, Topic, Count, Level */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold text-slate-700">
                  Video Source (YouTube URL or Local Video File)
                </label>
                <div className="flex items-center gap-3">
                  {activeVideoSource && !showTranscriptPanel && (
                    <button
                      type="button"
                      onClick={() => setShowTranscriptPanel(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 size={12} /> Transcript &amp; Scenes
                    </button>
                  )}
                  {activeVideoSource && (
                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput('');
                        setDetectedVideoTitle('');
                        setDetectedDurationSec(0);
                        setExtractedTranscript('');
                        setExtractedSceneSummary('');
                        setShowTranscriptPanel(false);
                        setScanMeta(null);
                        setProcessedSourceKey('');
                        onClearVideo();
                      }}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                    >
                      <X size={13} /> Clear Video
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/webm,video/ogg,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setDetectedVideoTitle('');
                    setDetectedDurationSec(0);
                    setExtractedTranscript('');
                    setExtractedSceneSummary('');
                    setShowTranscriptPanel(false);
                    setScanMeta(null);
                    setProcessedSourceKey('');
                    onSelectLocalFile(file);
                  }
                  e.target.value = '';
                }}
              />

              {isBlobUrl ? (
                <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-slate-900">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <FileVideo size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-emerald-900 truncate">
                        {localVideoName || 'Uploaded Video File'}
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        {isCurrentSourceProcessed
                          ? `Processed${detectedDurationSec > 0 ? ` · ${formatSeconds(detectedDurationSec)}` : ''}${
                              scanMeta?.framesCount ? ` · ${scanMeta.framesCount} visual frames & scene summary ready` : ' · Ready'
                            }`
                          : 'Click Process Video to analyze frames, scenes & duration'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isScanningVideoTitle}
                      onClick={handleProcessVideo}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                    >
                      {isScanningVideoTitle ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Processing...
                        </>
                      ) : isCurrentSourceProcessed ? (
                        <>
                          <Check size={13} strokeWidth={3} />
                          Re-Process Video
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          Process Video
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-emerald-300 text-xs font-bold text-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      Change File
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Video size={17} className="absolute left-3.5 text-indigo-600 pointer-events-none" />
                    <input
                      ref={urlInputRef}
                      type="text"
                      placeholder="Paste YouTube or MP4 video URL..."
                      value={urlInput}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setUrlInput(nextVal);
                        setVideoUrl(nextVal);
                        setDetectedVideoTitle('');
                        setDetectedDurationSec(0);
                        setExtractedTranscript('');
                        setExtractedSceneSummary('');
                        setShowTranscriptPanel(false);
                        setScanMeta(null);
                        setProcessedSourceKey('');
                        if (setupError) setSetupError('');
                      }}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl bg-[#FAF7F0] border focus:bg-white focus:outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-colors ${
                        setupError
                          ? 'border-rose-400 focus:border-rose-500'
                          : 'border-[#D8D0C5] focus:border-indigo-600'
                      }`}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isScanningVideoTitle || !activeVideoSource}
                    onClick={handleProcessVideo}
                    className={`px-4 py-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-xs ${
                      isCurrentSourceProcessed
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-amber-500 hover:bg-amber-600 disabled:opacity-45 text-slate-950'
                    }`}
                  >
                    {isScanningVideoTitle ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentSourceProcessed ? (
                      <>
                        <Check size={14} strokeWidth={3} />
                        Processed
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Process Video
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-3 rounded-xl bg-[#FAF7F0] hover:bg-indigo-50 border border-[#D8D0C5] hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-xs font-extrabold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Upload size={15} className="text-indigo-600" />
                    Upload Video
                  </button>
                </div>
              )}

              {activeVideoSource && !isBlobUrl && (isScanningVideoTitle || isCurrentSourceProcessed || ytPreviewId) && (
                <div
                  className={`mt-2.5 p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isCurrentSourceProcessed
                      ? 'bg-emerald-50/90 border-emerald-200'
                      : 'bg-amber-50/90 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {ytPreviewId && (
                      <img
                        src={`https://i.ytimg.com/vi/${ytPreviewId}/hqdefault.jpg`}
                        alt="Video Preview"
                        referrerPolicy="no-referrer"
                        className="w-16 h-10 rounded-lg object-cover border border-slate-300 shrink-0 shadow-2xs"
                      />
                    )}
                    <div className="min-w-0 flex-1 text-left">
                      <div
                        className={`text-[11px] font-extrabold flex items-center gap-1.5 flex-wrap ${
                          isCurrentSourceProcessed ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {isScanningVideoTitle ? (
                          <>
                            <Loader2 size={12} className="animate-spin shrink-0" />
                            <span>Extracting video transcript, duration &amp; visual scenes...</span>
                          </>
                        ) : isCurrentSourceProcessed ? (
                          <>
                            <CheckCircle size={13} className="shrink-0 text-emerald-600" />
                            <span>
                              Processed
                              {detectedDurationSec > 0 ? ` · ${formatSeconds(detectedDurationSec)}` : ''}
                              {transcriptLineCount > 0
                                ? ` · ${transcriptLineCount} timestamped scene/dialogue lines ready`
                                : ' · Video Info & Scenes ready'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Clock size={12} className="shrink-0 text-amber-600" />
                            <span>Click Process Video to extract the transcript &amp; scene summary before generating</span>
                          </>
                        )}
                      </div>
                      {detectedVideoTitle && (
                        <div className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                          {detectedVideoTitle}
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrentSourceProcessed && (
                    <button
                      type="button"
                      onClick={() => setShowTranscriptPanel((prev) => !prev)}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-indigo-50 border border-emerald-300 text-indigo-700 text-[11px] font-extrabold shrink-0 cursor-pointer transition-colors"
                    >
                      {showTranscriptPanel ? 'Hide Transcript' : 'Review Transcript'}
                    </button>
                  )}
                </div>
              )}

              {/* Interactive Extracted Video Transcript & Scene Summary Preview / Editor */}
              {(showTranscriptPanel || isCurrentSourceProcessed) && (
                <div className="mt-3 rounded-2xl border-2 border-indigo-200 bg-[#FAF7F0] p-3.5 sm:p-4 space-y-3 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-[11px] font-extrabold">
                        <Sparkles size={12} />
                        Extracted Video Transcript &amp; Scene Summary
                      </span>
                      <span className="text-[11px] font-bold text-slate-600">
                        {transcriptSourceType === 'captions'
                          ? 'Official Captions + Scene Summary'
                          : transcriptSourceType === 'visual_ai'
                          ? 'AI Visual Scene Breakdown'
                          : 'Timestamped Scene Timeline'}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-indigo-700">
                      Editable — questions will strictly match this content
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Video Scene Summary (Characters, Setting &amp; Storyline)
                    </label>
                    <textarea
                      rows={2}
                      value={extractedSceneSummary}
                      onChange={(e) => setExtractedSceneSummary(e.target.value)}
                      placeholder="Brief overview of who is in the video, where they are, and what happens..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D8D0C5] focus:border-indigo-600 focus:outline-none text-xs font-medium text-slate-800 placeholder:text-slate-400 leading-relaxed vq-scrollbar"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-extrabold text-slate-700">
                        Timestamped Dialogue &amp; Visual Scene Breakdown ({transcriptLineCount}{' '}
                        {transcriptLineCount === 1 ? 'line' : 'lines'})
                      </label>
                      <span className="text-[10px] font-bold text-slate-500 vq-mono">
                        Format: [M:SS] Spoken dialogue or visible action
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      value={extractedTranscript}
                      onChange={(e) => setExtractedTranscript(e.target.value)}
                      placeholder="[0:10] Character walks into the room and opens a blue book..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D8D0C5] focus:border-indigo-600 focus:outline-none text-xs font-medium text-slate-800 placeholder:text-slate-400 leading-relaxed vq-mono vq-scrollbar"
                    />
                  </div>
                </div>
              )}

              {setupError && (
                <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 space-y-2">
                  <div className="flex items-start gap-2 font-bold leading-relaxed">
                    <AlertCircle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                    <span>{setupError}</span>
                  </div>
                  {activeVideoSource && typeof onOpenManualPlayer === 'function' && (
                    <div className="pl-5">
                      <button
                        type="button"
                        onClick={() => onOpenManualPlayer(buildPayload())}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-extrabold transition-colors cursor-pointer"
                      >
                        Open Video Player &amp; Add Questions Manually
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-extrabold text-slate-700">
                    Grammar / Quiz Topic <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {topic && (
                    <button
                      type="button"
                      onClick={() => setTopic('')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
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
                  className="w-full px-4 py-3 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5] focus:bg-white focus:border-indigo-600 focus:outline-none text-sm font-semibold text-slate-900 placeholder:text-slate-400 transition-colors"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {POPULAR_GRAMMAR_TOPICS.map((presetTopic) => {
                    const isSelected = topic.trim().toLowerCase() === presetTopic.toLowerCase();
                    return (
                      <button
                        key={presetTopic}
                        type="button"
                        onClick={() => setTopic(isSelected ? '' : presetTopic)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                            : 'bg-[#FAF7F0] border-[#E6E0D4] text-slate-600 hover:text-indigo-700 hover:border-indigo-300'
                        }`}
                      >
                        {presetTopic}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-2">
                  How Many Questions <span className="text-slate-400 font-normal">(Type any number)</span>
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
                    className="w-20 px-3 py-3 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5] focus:bg-white focus:border-indigo-600 focus:outline-none text-sm font-extrabold text-indigo-700 text-center vq-mono"
                  />
                  <div className="flex-1 grid grid-cols-5 gap-1 p-1 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5]">
                    {QUESTION_COUNT_PRESETS.map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setQuizCountInput(String(cnt))}
                        className={`py-2 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                          resolvedQuizCount === cnt
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white'
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
              <label className="block text-xs font-extrabold text-slate-700 mb-2">
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
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-[#FAF7F0] text-slate-700 border-[#D8D0C5] hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Question Types & Launch Action */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-2">
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
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-2xs'
                          : 'bg-[#FAF7F0] border-[#E6E0D4] text-slate-600 hover:text-slate-900 hover:border-[#D8D0C5]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          active ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-300'
                        }`}
                      >
                        {active && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span className="text-xs font-extrabold truncate">{type}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Tip Card */}
            <div className="p-3.5 rounded-2xl bg-[#FAF7F0] border border-[#E6E0D4] space-y-1.5">
              <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-600 shrink-0" />
                <span>100% Scene-Matched Questions</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Click <strong>Process Video</strong> first to inspect the extracted dialogue &amp; visual scenes. Every generated question is anchored to a real timestamp in your video.
              </p>
            </div>

            {/* Auto-Generate Button */}
            <div className="space-y-2">
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
                className="w-full py-4 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Analyzing &amp; Generating {resolvedQuizCount} Questions...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Auto-Generate {resolvedQuizCount} {topic.trim() ? `${topic.trim()} ` : 'Video '}
                    {resolvedQuizCount === 1 ? 'Question' : 'Questions'} &amp; Play
                  </>
                )}
              </button>
              <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
                <Clock size={12} className="text-indigo-600 shrink-0" />
                <span>Uses verified video transcript &amp; scene frames to prevent mismatched questions.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface YouTubeQuizHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  setMuted: (muted: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const loadYouTubeIframeAPI = (): Promise<any> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const win = window as any;
  if (win.YT && win.YT.Player) {
    return Promise.resolve(win.YT);
  }
  if (win.__vqYtApiPromise) {
    return win.__vqYtApiPromise;
  }
  win.__vqYtApiPromise = new Promise((resolve) => {
    const prevReady = win.onYouTubeIframeAPIReady;
    win.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === 'function') {
        try {
          prevReady();
        } catch {}
      }
      resolve(win.YT);
    };
    const existingScript = document.querySelector(
      'script[src*="youtube.com/iframe_api"]'
    );
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      document.head.appendChild(tag);
    } else {
      // If script was already injected by another view, poll briefly until YT.Player appears
      const poll = setInterval(() => {
        if (win.YT && win.YT.Player) {
          clearInterval(poll);
          resolve(win.YT);
        }
      }, 60);
    }
  });
  return win.__vqYtApiPromise;
};

const YouTubeQuizPlayer = forwardRef<
  YouTubeQuizHandle,
  {
    videoId: string;
    volume: number;
    muted: boolean;
    onReady: (info: { duration: number }) => void;
    onStateChange: (state: number) => void;
    onTimeTick: (timeSec: number, durationSec: number) => void;
    onError: (code: number) => void;
  }
>(function YouTubeQuizPlayer(
  { videoId, volume, muted, onReady, onStateChange, onTimeTick, onError },
  ref
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef<boolean>(false);
  const callbacksRef = useRef({ onReady, onStateChange, onTimeTick, onError });
  callbacksRef.current = { onReady, onStateChange, onTimeTick, onError };
  const volRef = useRef({ volume, muted });
  volRef.current = { volume, muted };

  useImperativeHandle(ref, () => ({
    play: () => {
      try {
        if (isReadyRef.current && playerRef.current?.playVideo) {
          playerRef.current.playVideo();
        }
      } catch {}
    },
    pause: () => {
      try {
        if (isReadyRef.current && playerRef.current?.pauseVideo) {
          playerRef.current.pauseVideo();
        }
      } catch {}
    },
    seekTo: (seconds: number) => {
      try {
        if (isReadyRef.current && playerRef.current?.seekTo) {
          playerRef.current.seekTo(Math.max(0, seconds), true);
        }
      } catch {}
    },
    setVolume: (vol: number) => {
      try {
        if (isReadyRef.current && playerRef.current?.setVolume) {
          playerRef.current.setVolume(Math.max(0, Math.min(100, Math.round(vol))));
        }
      } catch {}
    },
    setMuted: (isMutedVal: boolean) => {
      try {
        if (!isReadyRef.current || !playerRef.current) return;
        if (isMutedVal) playerRef.current.mute?.();
        else playerRef.current.unMute?.();
      } catch {}
    },
    getCurrentTime: () => {
      try {
        return Number(playerRef.current?.getCurrentTime?.()) || 0;
      } catch {
        return 0;
      }
    },
    getDuration: () => {
      try {
        return Number(playerRef.current?.getDuration?.()) || 0;
      } catch {
        return 0;
      }
    },
  }));

  useEffect(() => {
    if (!videoId || !hostRef.current) return;
    let destroyed = false;
    isReadyRef.current = false;

    const mountNode = document.createElement('div');
    mountNode.style.width = '100%';
    mountNode.style.height = '100%';
    hostRef.current.innerHTML = '';
    hostRef.current.appendChild(mountNode);

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (destroyed || !hostRef.current) return;
        playerRef.current = new YT.Player(mountNode, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev: any) => {
              if (destroyed) return;
              isReadyRef.current = true;
              try {
                const iframe = ev.target?.getIframe?.();
                if (iframe) {
                  iframe.style.width = '100%';
                  iframe.style.height = '100%';
                  iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen');
                }
              } catch {}
              try {
                if (volRef.current.muted) ev.target.mute?.();
                else ev.target.unMute?.();
                ev.target.setVolume?.(Math.max(0, Math.min(100, Math.round(volRef.current.volume))));
              } catch {}
              const dur = Number(ev.target?.getDuration?.()) || 0;
              callbacksRef.current.onReady({ duration: dur });
            },
            onStateChange: (ev: any) => {
              if (destroyed) return;
              callbacksRef.current.onStateChange(ev.data);
            },
            onError: (ev: any) => {
              if (destroyed) return;
              callbacksRef.current.onError(Number(ev.data) || 150);
            },
          },
        });
      })
      .catch(() => {
        if (!destroyed) callbacksRef.current.onError(150);
      });

    const tickInterval = setInterval(() => {
      if (destroyed || !isReadyRef.current || !playerRef.current) return;
      try {
        const state = playerRef.current.getPlayerState?.();
        const dur = Number(playerRef.current.getDuration?.()) || 0;
        const cur = Number(playerRef.current.getCurrentTime?.()) || 0;
        if (state === 1) {
          callbacksRef.current.onTimeTick(cur, dur);
        }
      } catch {}
    }, 180);

    return () => {
      destroyed = true;
      isReadyRef.current = false;
      clearInterval(tickInterval);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!isReadyRef.current || !playerRef.current) return;
    try {
      if (muted) playerRef.current.mute?.();
      else playerRef.current.unMute?.();
      playerRef.current.setVolume?.(Math.max(0, Math.min(100, Math.round(volume))));
    } catch {}
  }, [volume, muted]);

  return <div ref={hostRef} className="w-full h-full bg-black" />;
});

function PlayerView({
  user,
  config,
  questions,
  setQuestions,
  videoUrl,
  localVideoName,
  cachedVideoScan,
  onSaveQuiz,
  isSaving,
  isPlayOnlyMode,
  initialOpenEditor,
  onBackToSetup,
  onScoreChange,
  isAppMuted,
  onToggleAppMute,
}: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [isReplayingClip, setIsReplayingClip] = useState(false);
  const [resultsMap, setResultsMap] = useState<Record<number, QuizAnswerRecord>>({});
  const [skippedIds, setSkippedIds] = useState<Record<number, boolean>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [showEditModal, setShowEditModal] = useState(Boolean(initialOpenEditor));
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errorToast, setErrorToast] = useState('');
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [showEndScore, setShowEndScore] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  // Loading & Error tracking for clean video load screen
  const [playerStatus, setPlayerStatus] = useState<'loading' | 'ready' | 'error'>(
    videoUrl ? 'loading' : 'error'
  );
  const [playerErrorMsg, setPlayerErrorMsg] = useState('');
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [volume, setVolume] = useState(100);
  const [playerMuted, setPlayerMuted] = useState(Boolean(isAppMuted));
  const pendingPlayRef = useRef<boolean>(false);
  const [playerThinkingState, setPlayerThinkingState] = useState<{
    elapsedMs: number;
    count: number;
  } | null>(null);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<YouTubeQuizHandle | null>(null);
  const fallbackPlayerRef = useRef<any>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastEvaluatedTimeRef = useRef<number>(0);
  const seekGuardUntilRef = useRef<number>(0);
  const isSeekingRef = useRef<boolean>(false);
  const rescaledForDurationRef = useRef<number>(0);

  const ytVideoId = extractClientYouTubeId(videoUrl);
  const useNativeVideo = isDirectVideoSource(videoUrl);
  const useYouTubeIframe = Boolean(ytVideoId && !useNativeVideo);

  const [hasRealDuration, setHasRealDuration] = useState(false);
  const [videoDuration, setVideoDuration] = useState(
    Math.max(60, Number(config?.videoDuration) || 180)
  );
  const [currentTime, setCurrentTime] = useState(0);

  // Sync mute with header mute button
  useEffect(() => {
    setPlayerMuted(Boolean(isAppMuted));
  }, [isAppMuted]);

  // Safety loading timeout so stuck embeds cleanly surface Retry / Open on YouTube
  useEffect(() => {
    if (playerStatus !== 'loading') return;
    const t = setTimeout(() => {
      setPlayerStatus((prev) => {
        if (prev === 'loading') {
          setPlayerErrorMsg('Video took too long to load. Please check the link or try again.');
          return 'error';
        }
        return prev;
      });
    }, 12000);
    return () => clearTimeout(t);
  }, [playerStatus, playerReloadKey, videoUrl]);

  const sortedQuestions = [...questions].sort((a, b) => a.timeTrigger - b.timeTrigger);
  const maxQuestionTrigger = sortedQuestions.reduce(
    (max, q) => Math.max(max, Number(q?.timeTrigger) || 0),
    0
  );

  // Use exact real player duration as soon as loaded so the video plays 100% full to the end
  const effectiveDuration =
    hasRealDuration && videoDuration > 5
      ? videoDuration
      : Math.max(Number(config?.videoDuration) || 0, maxQuestionTrigger + 15, 60);

  // Rescale out-of-range auto-generated timestamps once the true video duration is known
  useEffect(() => {
    if (!hasRealDuration || videoDuration <= 10 || questions.length === 0) return;
    if (Math.abs(rescaledForDurationRef.current - videoDuration) < 2) return;
    const maxTrig = questions.reduce(
      (max: number, q: any) => Math.max(max, Number(q?.timeTrigger) || 0),
      0
    );
    if (maxTrig > videoDuration - 3) {
      rescaledForDurationRef.current = videoDuration;
      const maxAllowed = Math.max(10, Math.floor(videoDuration - 4));
      const sortedCopy = [...questions].sort(
        (a: any, b: any) => (Number(a.timeTrigger) || 0) - (Number(b.timeTrigger) || 0)
      );
      const rescaled = sortedCopy.map((q: any, idx: number) => {
        const ratio =
          maxTrig > 0
            ? (Number(q.timeTrigger) || 0) / maxTrig
            : (idx + 1) / (sortedCopy.length + 1);
        const mapped = Math.max(
          5,
          Math.min(maxAllowed, Math.round(5 + ratio * (maxAllowed - 5)))
        );
        return { ...q, timeTrigger: mapped };
      });
      setQuestions(rescaled);
    } else {
      rescaledForDurationRef.current = videoDuration;
    }
  }, [hasRealDuration, videoDuration, questions, setQuestions]);

  const totalQuestionsCount = sortedQuestions.length;
  const answeredCount = Object.keys(resultsMap).length;
  const correctCount = Object.values(resultsMap).filter((r) => r?.isCorrect).length;
  const incorrectCount = Object.values(resultsMap).filter((r) => r && !r.isCorrect).length;
  const unansweredCount = Math.max(0, totalQuestionsCount - answeredCount);
  const scorePercent =
    totalQuestionsCount > 0 ? Math.round((correctCount / totalQuestionsCount) * 100) : 0;

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

  // Sync play/pause & volume with native video element when using direct/blob video
  useEffect(() => {
    if (!useNativeVideo || !nativeVideoRef.current) return;
    nativeVideoRef.current.muted = playerMuted;
    nativeVideoRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    if (isPlaying && (!activeQuiz || isReplayingClip)) {
      nativeVideoRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      nativeVideoRef.current.pause();
    }
  }, [isPlaying, activeQuiz, isReplayingClip, useNativeVideo, videoUrl, volume, playerMuted]);

  const startPlayback = useCallback(() => {
    if (playerStatus === 'loading') {
      pendingPlayRef.current = true;
      return;
    }
    if (playerStatus === 'error') return;
    setShowEndScore(false);
    setIsPlaying(true);
    if (useYouTubeIframe) {
      ytPlayerRef.current?.play();
    } else if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.play().catch(() => {});
    }
  }, [playerStatus, useYouTubeIframe, useNativeVideo]);

  const pausePlayback = useCallback(() => {
    pendingPlayRef.current = false;
    setIsPlaying(false);
    if (useYouTubeIframe) {
      ytPlayerRef.current?.pause();
    } else if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.pause();
    }
  }, [useYouTubeIframe, useNativeVideo]);

  const seekVideoTo = useCallback(
    (seconds: number) => {
      const clamped = Math.max(0, Math.min(effectiveDuration, seconds));
      isSeekingRef.current = true;
      seekGuardUntilRef.current = Date.now() + 850;
      lastEvaluatedTimeRef.current = clamped;
      setCurrentTime(clamped);
      setProgress(effectiveDuration > 0 ? (clamped / effectiveDuration) * 100 : 0);
      if (!activeQuiz && clamped < effectiveDuration - 3) {
        setVideoEnded(false);
        setShowEndScore(false);
      }
      if (useYouTubeIframe && ytPlayerRef.current) {
        ytPlayerRef.current.seekTo(clamped);
      } else if (useNativeVideo && nativeVideoRef.current) {
        nativeVideoRef.current.currentTime = clamped;
      } else if (fallbackPlayerRef.current) {
        if ('currentTime' in fallbackPlayerRef.current) {
          fallbackPlayerRef.current.currentTime = clamped;
        } else if (typeof fallbackPlayerRef.current.seekTo === 'function') {
          fallbackPlayerRef.current.seekTo(clamped, 'seconds');
        }
      }
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 360);
    },
    [effectiveDuration, activeQuiz, useYouTubeIframe, useNativeVideo]
  );

  const triggerQuizNow = (quiz: any, shouldSeek = false) => {
    setSkippedIds((prev) => {
      if (!prev[quiz.id]) return prev;
      const next = { ...prev };
      delete next[quiz.id];
      return next;
    });
    setIsReplayingClip(false);
    pausePlayback();
    setShowEndScore(false);
    if (shouldSeek) {
      seekVideoTo(quiz.timeTrigger);
    }
    setActiveQuiz(quiz);
    vqAudio.playPop();
  };

  const handleReplayQuestionScene = () => {
    if (!activeQuiz) return;
    const startClipSec = Math.max(0, activeQuiz.timeTrigger - 5);
    seekVideoTo(startClipSec);
    setIsReplayingClip(true);
    setIsPlaying(true);
    if (useYouTubeIframe) {
      ytPlayerRef.current?.play();
    } else if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.play().catch(() => {});
    }
  };

  const evaluateTimeTrigger = (currentSeconds: number) => {
    if (!Number.isFinite(currentSeconds)) return;
    if (isSeekingRef.current || Date.now() < seekGuardUntilRef.current) {
      return;
    }

    const prevSeconds = lastEvaluatedTimeRef.current;

    if (currentSeconds === 0 && prevSeconds > 2) {
      return;
    }

    lastEvaluatedTimeRef.current = currentSeconds;
    setCurrentTime(currentSeconds);
    setProgress(effectiveDuration > 0 ? (currentSeconds / effectiveDuration) * 100 : 0);

    if (isReplayingClip && activeQuiz) {
      if (currentSeconds >= activeQuiz.timeTrigger) {
        setIsReplayingClip(false);
        pausePlayback();
      }
      return;
    }

    if (!isPlaying || activeQuiz) return;

    const triggeredQuiz = sortedQuestions.find((q: any) => {
      if (resultsMap[q.id] !== undefined || skippedIds[q.id]) return false;
      const trig = Number(q.timeTrigger) || 0;
      const delta = currentSeconds - prevSeconds;
      const crossedForward =
        delta >= 0 && delta <= 2.5 && prevSeconds < trig + 0.05 && currentSeconds >= trig;
      const nearTrigger = Math.abs(trig - currentSeconds) < 0.65;
      return crossedForward || nearTrigger;
    });

    if (triggeredQuiz) {
      triggerQuizNow(triggeredQuiz, false);
    }
  };

  const handleTogglePlayPause = () => {
    if (playerStatus !== 'ready') {
      if (playerStatus === 'loading') {
        pendingPlayRef.current = true;
      }
      return;
    }
    if (activeQuiz && !isReplayingClip) {
      handleReplayQuestionScene();
      return;
    }
    if (videoEnded) {
      seekVideoTo(0);
      setVideoEnded(false);
      setShowEndScore(false);
      startPlayback();
      return;
    }
    if (isPlaying) {
      pausePlayback();
    } else {
      startPlayback();
    }
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
    lastEvaluatedTimeRef.current = Math.max(
      currentTime,
      Number(activeQuiz.timeTrigger) || currentTime
    );
    setActiveQuiz(null);
    setIsReplayingClip(false);

    if (videoEnded) {
      setShowEndScore(true);
      return;
    }

    seekGuardUntilRef.current = Date.now() + 450;
    setIsPlaying(true);
    if (useYouTubeIframe) {
      ytPlayerRef.current?.play();
    } else if (useNativeVideo && nativeVideoRef.current) {
      nativeVideoRef.current.play().catch(() => {});
    }
  };

  const handleResetQuiz = () => {
    setResultsMap({});
    setSkippedIds({});
    setActiveQuiz(null);
    setIsReplayingClip(false);
    setVideoEnded(false);
    setShowEndScore(false);
    pausePlayback();
    seekVideoTo(0);
  };

  const handleUpdateSingleQuestion = (updatedQ: any) => {
    const nextList = questions
      .map((item: any) => (item.id === updatedQ.id ? updatedQ : item))
      .sort((a: any, b: any) => (Number(a.timeTrigger) || 0) - (Number(b.timeTrigger) || 0));
    setQuestions(nextList);
    setActiveQuiz(updatedQ);
    setToastMessage(`Updated Question at ${formatSeconds(updatedQ.timeTrigger)}`);
    setTimeout(() => setToastMessage(''), 2200);
  };

  const handleAutoGenerateTopicQuestions = async () => {
    setIsGeneratingMore(true);
    setErrorToast('');
    const desiredCount = Math.max(1, Math.min(100, Number(config?.count) || 5));
    const startedAt = Date.now();
    setPlayerThinkingState({ elapsedMs: 0, count: desiredCount });
    const tickInterval = window.setInterval(() => {
      setPlayerThinkingState((prev) =>
        prev ? { ...prev, elapsedMs: Date.now() - startedAt } : prev
      );
    }, 250);

    try {
      const workPromise = (async () => {
        let capturedClientFrames: CapturedVideoFrame[] = [];
        let capturedLocalDuration = 0;
        if (videoUrl.startsWith('blob:') || isDirectVideoSource(videoUrl)) {
          if (cachedVideoScan?.sourceUrl === videoUrl && Array.isArray(cachedVideoScan.frames)) {
            capturedClientFrames = cachedVideoScan.frames;
            capturedLocalDuration = cachedVideoScan.durationSec || 0;
          } else {
            const localScan = await captureLocalVideoFrames(videoUrl);
            capturedClientFrames = localScan.frames;
            capturedLocalDuration = localScan.durationSec;
          }
        }

        const res = await fetch('/api/generate-hamster-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: (config?.topic || '').trim(),
            videoTitle: config?.videoTitle || localVideoName || '',
            level: normalizeEnglishLevel(config?.level),
            types: config?.selectedTypes || ['Fill in the Blanks', 'Multiple Choice', 'Grammar Choice'],
            count: desiredCount,
            videoDuration: hasRealDuration
              ? videoDuration
              : capturedLocalDuration || config?.videoDuration || 180,
            videoUrl: videoUrl.startsWith('blob:') ? localVideoName : videoUrl,
            verifiedTranscript: (config?.verifiedTranscript || '').trim(),
            sceneSummary: (config?.sceneSummary || '').trim(),
            ...(capturedClientFrames.length > 0 ? { clientFrames: capturedClientFrames } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          throw new Error(
            data?.error ||
              'Could not analyze this video right now. Please check the video source or API key.'
          );
        }
        if (!Array.isArray(data?.questions) || data.questions.length === 0) {
          throw new Error(
            'Could not generate scene-matched questions from this video. Please try again.'
          );
        }
        return { data, capturedClientFrames, capturedLocalDuration };
      })();

      const minThinkingWait = new Promise<void>((resolve) =>
        window.setTimeout(resolve, THINKING_DURATION_MS)
      );

      const [{ data, capturedClientFrames, capturedLocalDuration }] = await Promise.all([
        workPromise,
        minThinkingWait,
      ]);

      const resolvedDuration = hasRealDuration
        ? videoDuration
        : Number(data?.videoDuration) || capturedLocalDuration || Number(videoDuration) || 180;
      if (!hasRealDuration && resolvedDuration > 0 && resolvedDuration !== videoDuration) {
        setVideoDuration(resolvedDuration);
      }

      const valid = data.questions.filter(
        (q: any) =>
          q &&
          typeof q.question === 'string' &&
          !isLegacyPlaceholderQuestion(q.question) &&
          (q.type === 'Fill in the Blanks' ||
            (Array.isArray(q.options) && q.options.length >= 2))
      );
      if (valid.length === 0) {
        throw new Error('Generated questions did not pass quality validation. Please try again.');
      }

      setQuestions(
        valid.slice(0, desiredCount).map((q: any, i: number) => ({
          ...q,
          id: i + 1,
        }))
      );
      setResultsMap({});
      setSkippedIds({});
      lastEvaluatedTimeRef.current = 0;
      setActiveQuiz(null);
      setVideoEnded(false);
      setShowEndScore(false);
      const sourceLabel = data?.hasTranscript
        ? 'Analyzed verified transcript & scenes'
        : data?.usedStoryboard
        ? 'Analyzed video storyboard scenes'
        : capturedClientFrames.length > 0
        ? `Analyzed ${capturedClientFrames.length} video frames`
        : 'Scanned video scenes';
      setToastMessage(
        `${sourceLabel} · Generated ${Math.min(valid.length, desiredCount)} ${
          config?.topic ? `${config.topic} ` : ''
        }questions`
      );
      setTimeout(() => setToastMessage(''), 2800);
    } catch (e: any) {
      setErrorToast(
        e?.message || 'Could not regenerate video-matched questions. Please try again.'
      );
      setTimeout(() => setErrorToast(''), 5500);
    } finally {
      window.clearInterval(tickInterval);
      setPlayerThinkingState(null);
      setIsGeneratingMore(false);
    }
  };

  const stageTitleDisplay =
    config?.videoTitle || config?.topic || localVideoName || 'Interactive Video Quiz';

  return (
    <div className="flex-1 w-full flex flex-col gap-3 pb-4 animate-vq-fade">
      {playerThinkingState && (
        <ThinkingAnalysisOverlay
          elapsedMs={playerThinkingState.elapsedMs}
          questionCount={playerThinkingState.count}
          topic={config?.topic}
          videoTitle={config?.videoTitle || localVideoName}
        />
      )}

      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-xl flex items-center gap-2 animate-vq-pop">
          <CheckCircle size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-xl flex items-center gap-2 max-w-xl animate-vq-pop">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {!isPlayOnlyMode && showEditModal && (
        <EditQuestionsModal
          questions={sortedQuestions}
          setQuestions={setQuestions}
          currentTime={currentTime}
          videoDuration={effectiveDuration}
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

      {/* UNIFIED CLASSROOM VIDEO & QUESTION STAGE */}
      <div
        ref={stageContainerRef}
        className={`w-full flex flex-col overflow-hidden shadow-xl ${
          isStageFullscreen
            ? 'fixed inset-0 z-50 rounded-none border-none h-screen w-screen bg-[#FAF7F0]'
            : 'bg-white border border-[#E6E0D4] rounded-2xl'
        }`}
      >
        {/* Standard Mode Header Bar */}
        {!isStageFullscreen && (
          <div className="px-4 py-2.5 border-b border-[#E6E0D4] flex flex-wrap items-center justify-between gap-2.5 bg-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="vq-display font-extrabold text-slate-900 text-sm sm:text-base lg:text-lg truncate">
                {config?.topic || config?.videoTitle || localVideoName || 'Video Quiz'}
              </span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-extrabold whitespace-nowrap">
                {normalizeEnglishLevel(config?.level)}
              </span>
              {sortedQuestions.length > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300 hidden md:inline">·</span>
                  <span className="hidden md:inline text-xs font-bold text-slate-500 vq-mono whitespace-nowrap">
                    {answeredCount}/{sortedQuestions.length} answered
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={handleResetQuiz}
                title="Reset Video & Questions"
                className="px-2.5 py-1.5 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#E6E0D4] text-slate-700 hover:text-slate-900 text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
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
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
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
                    className="px-2.5 py-1.5 rounded-xl bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] hover:border-indigo-200 text-slate-700 hover:text-indigo-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Settings size={13} className="text-indigo-600" />
                    <span className="hidden sm:inline">Edit Questions</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowSaveModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Folder size={13} />}
                    <span>{isSaving ? 'Saving...' : 'Save'}</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={toggleStageFullscreen}
                title="Fullscreen Video & Quiz"
                className="px-2.5 py-1.5 rounded-xl bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] hover:border-indigo-200 text-slate-800 hover:text-indigo-700 text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Maximize2 size={14} />
                <span className="hidden sm:inline">Fullscreen</span>
              </button>

              {/* Prominent Live Score Badge on Top Right */}
              <div
                title="Live Score"
                className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-black text-sm sm:text-base vq-mono flex items-center gap-1.5 shadow-xs whitespace-nowrap"
              >
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <span>
                  {correctCount}/{sortedQuestions.length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Cinema Video Viewport */}
        <div
          id="vq-video-stage"
          className={`relative w-full bg-slate-900 flex items-center justify-center overflow-hidden transition-all duration-200 ${
            isStageFullscreen
              ? 'flex-1 min-h-[200px]'
              : activeQuiz
              ? 'h-[38vh] sm:h-[44vh] lg:h-[46vh] min-h-[250px]'
              : 'aspect-video max-h-[72vh] min-h-[340px]'
          }`}
        >
          <div className="absolute inset-0 w-full h-full">
            {useNativeVideo ? (
              <video
                key={`native-${playerReloadKey}-${videoUrl}`}
                ref={nativeVideoRef}
                src={videoUrl}
                playsInline
                onTimeUpdate={(e) => evaluateTimeTrigger(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && Number.isFinite(dur) && dur > 0) {
                    setVideoDuration(dur);
                    setHasRealDuration(true);
                  }
                  setPlayerStatus('ready');
                  setPlayerErrorMsg('');
                  if (pendingPlayRef.current) {
                    pendingPlayRef.current = false;
                    setIsPlaying(true);
                    e.currentTarget.play().catch(() => {});
                  }
                }}
                onError={() => {
                  setPlayerStatus('error');
                  setPlayerErrorMsg('This video file format cannot be played in the browser.');
                }}
                onPlay={() => {
                  if (!activeQuiz || isReplayingClip) {
                    setShowEndScore(false);
                    setIsPlaying(true);
                  }
                }}
                onPause={() => {
                  if (!isSeekingRef.current && Date.now() > seekGuardUntilRef.current) {
                    setIsPlaying(false);
                  }
                }}
                onSeeking={() => {
                  isSeekingRef.current = true;
                  seekGuardUntilRef.current = Date.now() + 850;
                }}
                onSeeked={(e) => {
                  isSeekingRef.current = false;
                  seekGuardUntilRef.current = Date.now() + 450;
                  const t = e.currentTarget.currentTime;
                  if (Number.isFinite(t)) {
                    lastEvaluatedTimeRef.current = t;
                    setCurrentTime(t);
                    setProgress(effectiveDuration > 0 ? (t / effectiveDuration) * 100 : 0);
                  }
                }}
                onEnded={() => {
                  const finalDur = nativeVideoRef.current?.duration || effectiveDuration;
                  setIsPlaying(false);
                  setCurrentTime(finalDur);
                  setProgress(100);
                  setVideoEnded(true);
                  if (!activeQuiz) {
                    setShowEndScore(true);
                  }
                  vqAudio.playFanfare();
                }}
                onClick={handleTogglePlayPause}
                className="w-full h-full object-contain bg-black cursor-pointer"
              />
            ) : useYouTubeIframe && ytVideoId ? (
              <YouTubeQuizPlayer
                key={`yt-${playerReloadKey}-${ytVideoId}`}
                ref={ytPlayerRef}
                videoId={ytVideoId}
                volume={volume}
                muted={playerMuted}
                onReady={({ duration }) => {
                  if (duration > 0) {
                    setVideoDuration(duration);
                    setHasRealDuration(true);
                  }
                  setPlayerStatus('ready');
                  setPlayerErrorMsg('');
                  if (pendingPlayRef.current) {
                    pendingPlayRef.current = false;
                    setIsPlaying(true);
                    ytPlayerRef.current?.play();
                  }
                }}
                onStateChange={(state) => {
                  const realDur = ytPlayerRef.current?.getDuration() || 0;
                  if (realDur > 0) {
                    setVideoDuration(realDur);
                    setHasRealDuration(true);
                  }
                  if (state === 1) {
                    if (!activeQuiz || isReplayingClip) {
                      setShowEndScore(false);
                      setIsPlaying(true);
                    }
                  } else if (state === 2) {
                    if (!isSeekingRef.current && Date.now() > seekGuardUntilRef.current) {
                      setIsPlaying(false);
                    }
                  } else if (state === 0) {
                    const endSec = realDur > 0 ? realDur : effectiveDuration;
                    lastEvaluatedTimeRef.current = endSec;
                    setCurrentTime(endSec);
                    setProgress(100);
                    setIsPlaying(false);
                    setVideoEnded(true);
                    if (!activeQuiz) {
                      setShowEndScore(true);
                    }
                    vqAudio.playFanfare();
                  }
                }}
                onTimeTick={(curSec, durSec) => {
                  if (durSec > 0 && (!hasRealDuration || Math.abs(durSec - videoDuration) > 2)) {
                    setVideoDuration(durSec);
                    setHasRealDuration(true);
                  }
                  evaluateTimeTrigger(curSec);
                }}
                onError={(code) => {
                  setPlayerStatus('error');
                  if (code === 101 || code === 150) {
                    setPlayerErrorMsg(
                      'The YouTube owner disabled embedded playback for this video.'
                    );
                  } else if (code === 100) {
                    setPlayerErrorMsg('This YouTube video was removed or is private.');
                  } else {
                    setPlayerErrorMsg('Could not load this YouTube video. Please check the URL.');
                  }
                }}
              />
            ) : (
              <Player
                key={`rp-${playerReloadKey}-${videoUrl}`}
                ref={fallbackPlayerRef}
                src={videoUrl}
                width="100%"
                height="100%"
                playing={isPlaying && (!activeQuiz || isReplayingClip)}
                muted={playerMuted}
                volume={volume / 100}
                onReady={() => {
                  setPlayerStatus('ready');
                  setPlayerErrorMsg('');
                }}
                onTimeUpdate={(e: any) => {
                  const raw = e?.currentTarget?.currentTime ?? e?.target?.currentTime;
                  if (typeof raw === 'number' && Number.isFinite(raw)) {
                    evaluateTimeTrigger(raw);
                  }
                }}
                onPlay={() => {
                  if (!activeQuiz || isReplayingClip) {
                    setShowEndScore(false);
                    setIsPlaying(true);
                  }
                }}
                onPause={() => {
                  if (!isSeekingRef.current && Date.now() > seekGuardUntilRef.current) {
                    setIsPlaying(false);
                  }
                }}
                onEnded={() => {
                  setIsPlaying(false);
                  setProgress(100);
                  setVideoEnded(true);
                  if (!activeQuiz) setShowEndScore(true);
                  vqAudio.playFanfare();
                }}
                onDurationChange={(e: any) => {
                  const duration = e?.currentTarget?.duration || e?.target?.duration;
                  if (duration && Number.isFinite(duration) && duration > 0) {
                    setVideoDuration(duration);
                    setHasRealDuration(true);
                  }
                }}
                onError={() => {
                  setPlayerStatus('error');
                  setPlayerErrorMsg('Unable to load this video URL.');
                }}
                controls={false}
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
            )}
          </div>

          {/* Transparent Interactive Layer over YouTube iframe */}
          {useYouTubeIframe && playerStatus === 'ready' && !activeQuiz && !showEndScore && (
            <div
              onClick={handleTogglePlayPause}
              onDoubleClick={toggleStageFullscreen}
              className="absolute inset-0 z-[5] cursor-pointer"
            />
          )}

          {/* Fullscreen Top-Left Title Scrim & Top-Right Circular Score Badge */}
          {isStageFullscreen && (
            <>
              <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 px-4 pt-3 pb-10 bg-gradient-to-b from-black/75 via-black/30 to-transparent flex items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <div className="text-white font-bold text-sm sm:text-base truncate drop-shadow">
                    {stageTitleDisplay}
                  </div>
                  {(config?.topic || config?.level) && (
                    <div className="text-[11px] sm:text-xs font-semibold text-amber-300 truncate drop-shadow">
                      {[config?.topic, normalizeEnglishLevel(config?.level)].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!activeQuiz) setShowEndScore(true);
                }}
                title="View Score Summary"
                className="absolute top-3 right-3 sm:top-4 sm:right-5 z-25 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/95 text-slate-950 border-[3.5px] border-emerald-500 shadow-[0_8px_28px_rgba(0,0,0,0.45)] flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition-transform"
              >
                <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 leading-none tracking-tight">
                  Score
                </span>
                <span className="vq-display vq-mono text-xl sm:text-2xl font-black text-slate-950 leading-tight mt-0.5">
                  {correctCount}
                </span>
                <span className="w-7 sm:w-8 h-[1.5px] bg-slate-400 my-0.5" />
                <span className="vq-mono text-[11px] sm:text-xs font-extrabold text-slate-700 leading-none">
                  {sortedQuestions.length}
                </span>
              </button>
            </>
          )}

          {/* Video Loading Screen Overlay */}
          {playerStatus === 'loading' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#FAF7F0] overflow-hidden">
              {ytVideoId && (
                <img
                  src={`https://i.ytimg.com/vi/${ytVideoId}/hqdefault.jpg`}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm scale-105 pointer-events-none"
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center max-w-md">
                <div className="w-16 h-16 rounded-full bg-white border-2 border-indigo-200 flex items-center justify-center shadow-lg">
                  <Loader2 size={32} className="text-indigo-600 animate-spin" />
                </div>
                <div className="vq-display text-lg sm:text-xl font-extrabold text-slate-900">
                  Loading Video...
                </div>
                {stageTitleDisplay && (
                  <div className="text-xs sm:text-sm font-semibold text-slate-600 line-clamp-2">
                    {stageTitleDisplay}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Clean Video Error & Recovery Overlay */}
          {playerStatus === 'error' && (
            <div className="absolute inset-0 z-25 flex items-center justify-center bg-[#FAF7F0]/95 p-5">
              <div className="w-full max-w-md bg-white border border-rose-300 rounded-2xl p-6 text-center space-y-4 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h3 className="vq-display text-lg font-extrabold text-slate-900">
                    Video Could Not Load
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {playerErrorMsg || 'Unable to stream this video inside the player.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPlayerErrorMsg('');
                      setPlayerStatus('loading');
                      setPlayerReloadKey((k) => k + 1);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    Retry Video
                  </button>
                  {ytVideoId && (
                    <a
                      href={`https://www.youtube.com/watch?v=${ytVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#D8D0C5] text-slate-800 font-bold text-xs flex items-center gap-1.5"
                    >
                      <ExternalLink size={14} />
                      Open on YouTube
                    </a>
                  )}
                  {!isPlayOnlyMode && typeof onBackToSetup === 'function' && (
                    <button
                      type="button"
                      onClick={onBackToSetup}
                      className="px-4 py-2 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#D8D0C5] text-slate-700 font-bold text-xs cursor-pointer"
                    >
                      Change Video
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Center Play Button Overlay only when video is READY, paused, and no active question or end score */}
          {playerStatus === 'ready' && !isPlaying && !activeQuiz && !showEndScore && (
            <div
              onClick={handleTogglePlayPause}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/25 cursor-pointer group"
            >
              <button
                type="button"
                aria-label="Play video"
                className="w-20 h-20 rounded-full bg-indigo-600 group-hover:bg-indigo-500 text-white flex items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.55)] transition-transform duration-200 group-hover:scale-105 cursor-pointer border-4 border-white"
              >
                <Play fill="currentColor" size={36} className="ml-1" />
              </button>
            </div>
          )}

          {/* End-of-Video Score Summary Display (Bright Classroom Light Card) */}
          {showEndScore && !activeQuiz && (
            <div className="absolute inset-0 z-30 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto vq-scrollbar animate-vq-fade">
              <div className="w-full max-w-2xl bg-white border-2 border-[#E6E0D4] rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5 my-auto">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <span>Video Complete</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-indigo-600 font-extrabold">
                          {normalizeEnglishLevel(config?.level)}
                        </span>
                      </div>
                      <h2 className="vq-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {scorePercent >= 80
                          ? 'Great Job!'
                          : scorePercent >= 50
                          ? 'Well Done!'
                          : 'Keep Practicing!'}
                      </h2>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowEndScore(false)}
                    aria-label="Close score summary"
                    className="p-2 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#E6E0D4] text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Big Final Score Readout */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-[#FAF7F0] border border-[#E6E0D4]">
                  <div>
                    <div className="text-xs font-extrabold text-slate-500">Final Score</div>
                    <div className="vq-display vq-mono text-4xl sm:text-5xl font-black text-slate-900 mt-0.5">
                      {correctCount}
                      <span className="text-slate-400 text-2xl sm:text-3xl font-bold">
                        {' '}
                        / {totalQuestionsCount}
                      </span>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <div className="text-xs font-extrabold text-slate-500">Accuracy</div>
                    <div className="vq-display vq-mono text-3xl sm:text-4xl font-black text-indigo-600 mt-0.5">
                      {scorePercent}%
                    </div>
                  </div>
                </div>

                {/* Clean Breakdown Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-700">
                      <CheckCircle size={14} className="shrink-0" />
                      <span>Correct</span>
                    </div>
                    <div className="vq-mono text-xl sm:text-2xl font-black text-emerald-900 mt-1">
                      {correctCount}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700">
                      <XCircle size={14} className="shrink-0" />
                      <span>Incorrect</span>
                    </div>
                    <div className="vq-mono text-xl sm:text-2xl font-black text-rose-900 mt-1">
                      {incorrectCount}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#FAF7F0] border border-[#E6E0D4]">
                    <div className="text-xs font-extrabold text-slate-500">Unanswered</div>
                    <div className="vq-mono text-xl sm:text-2xl font-black text-slate-800 mt-1">
                      {unansweredCount}
                    </div>
                  </div>
                </div>

                {/* Scrollable Question Review List */}
                {sortedQuestions.length > 0 && (
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1 vq-scrollbar">
                    {sortedQuestions.map((q: any, idx: number) => {
                      const rec = resultsMap[q.id];
                      const correctOpt = q.options?.find((o: any) => o.isCorrect);
                      const displayAns = q.answer || correctOpt?.text || '';
                      return (
                        <div
                          key={q.id}
                          className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#E6E0D4] text-xs sm:text-sm"
                        >
                          <div className="mt-0.5 shrink-0">
                            {rec?.isCorrect === true ? (
                              <CheckCircle size={16} className="text-emerald-600" />
                            ) : rec?.isCorrect === false ? (
                              <XCircle size={16} className="text-rose-600" />
                            ) : (
                              <span className="inline-block w-4 h-4 rounded-full border border-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 leading-snug">
                              <span className="vq-mono text-indigo-600 mr-1.5">{idx + 1}.</span>
                              {q.question}
                            </div>
                            {displayAns && (
                              <div className="text-xs text-emerald-700 font-extrabold mt-0.5">
                                Answer: {displayAns}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
                  {!isPlayOnlyMode && typeof onBackToSetup === 'function' && (
                    <button
                      type="button"
                      onClick={onBackToSetup}
                      className="px-4 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#D8D0C5] text-slate-700 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ArrowLeft size={15} />
                      Back to Setup
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowEndScore(false)}
                    className="px-4 py-2.5 rounded-xl bg-[#FAF7F0] hover:bg-slate-100 border border-[#D8D0C5] text-slate-800 text-xs sm:text-sm font-extrabold transition-colors cursor-pointer"
                  >
                    Review Video
                  </button>
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-md transition-colors cursor-pointer"
                  >
                    <RotateCcw size={15} />
                    Play Again
                  </button>
                </div>
              </div>
            </div>
          )}

          {showConfetti && <Confetti />}
        </div>

        {/* ACTIVE QUESTION DOCK — Bright Classroom Light Surface */}
        {activeQuiz && (
          <div
            className={`w-full border-t-2 border-indigo-500 shrink-0 ${
              isStageFullscreen
                ? 'bg-[#FAF7F0]/98 backdrop-blur-md max-h-[52vh] overflow-y-auto vq-scrollbar'
                : 'bg-[#FAF7F0]'
            }`}
          >
            <BelowVideoQuestionDock
              key={activeQuiz.id}
              quiz={activeQuiz}
              questionNumber={Math.max(
                1,
                sortedQuestions.findIndex((q: any) => q.id === activeQuiz.id) + 1
              )}
              totalQuestions={sortedQuestions.length}
              isFullscreen={isStageFullscreen}
              isReplayingClip={isReplayingClip}
              canEdit={!isPlayOnlyMode}
              onUpdateQuestion={handleUpdateSingleQuestion}
              onReplayScene={handleReplayQuestionScene}
              onComplete={handleQuizComplete}
              onSkip={() => {
                lastEvaluatedTimeRef.current = Math.max(
                  currentTime,
                  Number(activeQuiz.timeTrigger) || currentTime
                );
                setSkippedIds((prev) => ({ ...prev, [activeQuiz.id]: true }));
                setActiveQuiz(null);
                setIsReplayingClip(false);
                if (videoEnded) {
                  setShowEndScore(true);
                } else {
                  startPlayback();
                }
              }}
            />
          </div>
        )}

        {/* Bottom Scrubber with Numbered Question Checkpoints & Transport Bar */}
        <div
          className={`flex flex-col shrink-0 ${
            isStageFullscreen
              ? 'bg-white/95 border-t border-[#E6E0D4] px-3 sm:px-5 pt-2 pb-2 gap-1.5'
              : 'bg-white border-t border-[#E6E0D4] px-4 py-2.5 gap-2'
          }`}
        >
          {/* Scrubber Bar with Numbered Circular Dots */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seekVideoTo(ratio * effectiveDuration);
            }}
            className="relative rounded-full cursor-pointer flex items-center my-1 h-4 bg-slate-200 border border-slate-300/80"
          >
            {/* Progress Fill */}
            <div
              className="h-full rounded-full transition-all duration-150 pointer-events-none bg-gradient-to-r from-indigo-600 to-emerald-500"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />

            {/* Numbered Question Checkpoint Circles directly on the bar (1, 2, 3...) */}
            {sortedQuestions.map((q: any, idx: number) => {
              const pct = Math.min(
                98.5,
                Math.max(1.5, ((Number(q.timeTrigger) || 0) / effectiveDuration) * 100)
              );
              const rec = resultsMap[q.id];
              const isAct = activeQuiz?.id === q.id;
              const isDense = sortedQuestions.length > 22;

              let markerClass =
                'bg-white text-slate-900 border-indigo-600 shadow-sm hover:scale-120';
              if (isAct) {
                markerClass =
                  'bg-amber-400 text-slate-950 border-slate-900 scale-125 ring-4 ring-amber-400/45 z-20';
              } else if (rec?.isCorrect === true) {
                markerClass =
                  'bg-emerald-500 text-white border-emerald-700 shadow-xs hover:scale-120';
              } else if (rec?.isCorrect === false) {
                markerClass =
                  'bg-rose-500 text-white border-rose-700 shadow-xs hover:scale-120';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerQuizNow(q, true);
                  }}
                  title={`Question ${idx + 1}`}
                  aria-label={`Open Question ${idx + 1}`}
                  className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 flex items-center justify-center font-black vq-mono leading-none transition-transform cursor-pointer z-10 ${
                    isDense ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'
                  } ${markerClass}`}
                  style={{ left: `${pct}%` }}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Compact Classroom Transport Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              <button
                type="button"
                onClick={handleTogglePlayPause}
                className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
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
                className="h-8 px-2 rounded-lg bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] text-slate-700 hover:text-indigo-700 flex items-center gap-1 text-[11px] font-extrabold transition-colors cursor-pointer shrink-0"
                title="Rewind 5 seconds"
              >
                <SkipBack size={13} />
                <span>5s</span>
              </button>

              <button
                type="button"
                onClick={() => seekVideoTo(currentTime + 5)}
                className="w-8 h-8 rounded-lg bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] text-slate-700 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Forward 5 seconds"
              >
                <SkipForward size={13} />
              </button>

              {/* Mute + Volume Slider */}
              <div className="flex items-center gap-1.5 pl-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !playerMuted;
                    setPlayerMuted(nextMuted);
                    vqAudio.muted = nextMuted;
                    if (typeof onToggleAppMute === 'function' && nextMuted !== isAppMuted) {
                      onToggleAppMute();
                    }
                  }}
                  title={playerMuted ? 'Unmute' : 'Mute'}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-indigo-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {playerMuted || volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={playerMuted ? 0 : volume}
                  onChange={(e) => {
                    const nextVol = Number(e.target.value);
                    setVolume(nextVol);
                    if (nextVol > 0 && playerMuted) {
                      setPlayerMuted(false);
                      vqAudio.muted = false;
                    }
                  }}
                  aria-label="Volume"
                  className="hidden sm:block w-16 md:w-20 h-1.5 accent-indigo-600 cursor-pointer"
                />
              </div>

              {/* Tabular Elapsed / Total Time Readout */}
              <span className="vq-mono text-xs sm:text-sm font-extrabold text-slate-700 whitespace-nowrap ml-1">
                {formatSeconds(currentTime)} / {formatSeconds(effectiveDuration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {(answeredCount > 0 || videoEnded) && !activeQuiz && (
                <button
                  type="button"
                  onClick={() => setShowEndScore(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trophy size={13} />
                  <span>View Score</span>
                </button>
              )}

              {activeQuiz && (
                <button
                  type="button"
                  onClick={handleReplayQuestionScene}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw size={13} />
                  <span>Replay (-5s)</span>
                </button>
              )}

              {isStageFullscreen && (
                <>
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    title="Reset Quiz"
                    className="px-2.5 py-1.5 rounded-lg bg-[#FAF7F0] hover:bg-slate-100 border border-[#E6E0D4] text-slate-700 hover:text-slate-900 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw size={13} />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleStageFullscreen}
                    title="Exit Fullscreen"
                    aria-label="Exit Fullscreen"
                    className="w-8 h-8 rounded-lg bg-[#FAF7F0] hover:bg-indigo-50 border border-[#E6E0D4] text-slate-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <Minimize2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CLICKABLE GENERATED QUESTION NUMBERS BAR */}
      {!isStageFullscreen && sortedQuestions.length > 0 && (
        <div className="w-full bg-white border border-[#E6E0D4] rounded-2xl p-4 sm:p-5 shadow-md space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-600 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                Generated Questions ({sortedQuestions.length})
              </span>
              <span className="text-[11px] sm:text-xs text-slate-500">
                Click any number to open{!isPlayOnlyMode ? ' & edit' : ''} that question
              </span>
            </div>
            {activeQuiz && (
              <button
                type="button"
                onClick={() => setActiveQuiz(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                Close Question
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {sortedQuestions.map((q: any, idx: number) => {
              const rec = resultsMap[q.id];
              const isAct = activeQuiz?.id === q.id;
              let btnClass =
                'bg-[#FAF7F0] border-[#D8D0C5] text-slate-800 hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50';
              if (isAct) {
                btnClass =
                  'bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30';
              } else if (rec?.isCorrect === true) {
                btnClass =
                  'bg-emerald-50 border-emerald-400 text-emerald-800 hover:bg-emerald-100';
              } else if (rec?.isCorrect === false) {
                btnClass =
                  'bg-rose-50 border-rose-400 text-rose-800 hover:bg-rose-100';
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => triggerQuizNow(q, true)}
                  title={`Question ${idx + 1} (${formatSeconds(q.timeTrigger)}) — ${q.question}`}
                  className={`min-w-[44px] h-10 px-3 rounded-xl border font-black text-xs sm:text-sm vq-mono flex items-center justify-center gap-1.5 transition-all cursor-pointer ${btnClass}`}
                >
                  <span>{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Large Classroom-Readable Below-Video Interactive Question Dock (Bright Classroom Light Theme)
 */
function BelowVideoQuestionDock({
  quiz,
  questionNumber,
  totalQuestions,
  isFullscreen,
  isReplayingClip,
  canEdit,
  onUpdateQuestion,
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

  // Direct inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTime, setEditTime] = useState(() => formatSeconds(quiz?.timeTrigger || 15));
  const [editType, setEditType] = useState<string>(quiz?.type || 'Multiple Choice');
  const [editQuestion, setEditQuestion] = useState<string>(quiz?.question || '');
  const [editBlankAnswer, setEditBlankAnswer] = useState<string>(quiz?.answer || '');
  const [editOptions, setEditOptions] = useState<string[]>(['', '', '', '']);
  const [editCorrectIdx, setEditCorrectIdx] = useState<number>(0);
  const [editExplanation, setEditExplanation] = useState<string>(quiz?.explanation || '');

  const startTimeRef = useRef<number>(performance.now());
  const blankInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    startTimeRef.current = performance.now();
    setSelected(null);
    setTypedBlank('');
    setBlankCorrect(false);
    setShowExplanation(false);
    setIsEditing(false);
    if (isFillInBlank) {
      setTimeout(() => blankInputRef.current?.focus(), 60);
    }
  }, [quiz.id, isFillInBlank]);

  const openInlineEditor = () => {
    const rawOpts = Array.isArray(quiz?.options) ? quiz.options : [];
    const optTexts = [0, 1, 2, 3].map((i) => String(rawOpts[i]?.text || ''));
    const rightIdx = Math.max(
      0,
      rawOpts.findIndex((o: any) => Boolean(o?.isCorrect))
    );
    const derivedBlankAns =
      quiz?.answer ||
      rawOpts.find((o: any) => Boolean(o?.isCorrect))?.text ||
      '';

    setEditTime(formatSeconds(quiz?.timeTrigger || 15));
    setEditType(quiz?.type || (isFillInBlank ? 'Fill in the Blanks' : 'Multiple Choice'));
    setEditQuestion(String(quiz?.question || ''));
    setEditBlankAnswer(String(derivedBlankAns));
    setEditOptions(optTexts);
    setEditCorrectIdx(rightIdx);
    setEditExplanation(String(quiz?.explanation || ''));
    setIsEditing(true);
  };

  const handleSaveInlineEdit = () => {
    const cleanQ = editQuestion.trim();
    if (!cleanQ || typeof onUpdateQuestion !== 'function') return;

    const nextSec = parseTimeInputToSeconds(editTime) ?? Number(quiz?.timeTrigger || 15);
    const targetType = editType || 'Multiple Choice';

    if (targetType === 'Fill in the Blanks') {
      const formattedQ = cleanQ.includes('___')
        ? normalizeBlankQuestionText(cleanQ)
        : `${cleanQ} ____`;
      const inferred = inferSmartBlankAnswerFromQuestion(formattedQ);
      const finalAns = editBlankAnswer.trim() || inferred.answer || 'answer';
      const updated = {
        ...quiz,
        timeTrigger: nextSec,
        type: 'Fill in the Blanks',
        question: formattedQ,
        answer: finalAns,
        acceptedAnswers: Array.from(
          new Set([finalAns, ...(Array.isArray(quiz?.acceptedAnswers) ? quiz.acceptedAnswers : [])].filter(Boolean))
        ),
        options: [{ text: finalAns, isCorrect: true }],
        explanation: editExplanation.trim() || `Correct answer: "${finalAns}".`,
      };
      onUpdateQuestion(updated);
      setIsEditing(false);
      return;
    }

    if (targetType === 'True or False') {
      const trueIsRight = editCorrectIdx === 0;
      const rightAns = trueIsRight ? 'True' : 'False';
      const updated = {
        ...quiz,
        timeTrigger: nextSec,
        type: 'True or False',
        question: cleanQ,
        answer: rightAns,
        acceptedAnswers: [rightAns],
        options: [
          { text: 'True', isCorrect: trueIsRight },
          { text: 'False', isCorrect: !trueIsRight },
        ],
        explanation: editExplanation.trim() || `Correct answer: "${rightAns}".`,
      };
      onUpdateQuestion(updated);
      setIsEditing(false);
      return;
    }

    const builtOpts = editOptions.map((opt, idx) => ({
      text: opt.trim() || `Choice ${['A', 'B', 'C', 'D'][idx]}`,
      isCorrect: idx === editCorrectIdx,
    }));
    const rightAns = builtOpts[editCorrectIdx]?.text || builtOpts[0]?.text || '';
    const updated = {
      ...quiz,
      timeTrigger: nextSec,
      type: targetType,
      question: cleanQ,
      answer: rightAns,
      acceptedAnswers: [rightAns],
      options: builtOpts,
      explanation: editExplanation.trim() || `Correct answer: "${rightAns}".`,
    };
    onUpdateQuestion(updated);
    setIsEditing(false);
  };

  const handleSelect = useCallback(
    (idx: number) => {
      if (showExplanation || isEditing) return;
      setSelected(idx);
      setShowExplanation(true);
      const isCorrect = Boolean(quiz.options?.[idx]?.isCorrect);
      if (isCorrect) vqAudio.playCorrect();
      else vqAudio.playWrong();
    },
    [showExplanation, isEditing, quiz]
  );

  const handleSubmitFillInBlank = useCallback(() => {
    if (showExplanation || isEditing || !typedBlank.trim()) return;
    const { isCorrect, primaryAnswer } = checkFillInBlankMatch(typedBlank, quiz);
    setBlankCorrect(isCorrect);
    setResolvedBlankAnswer(primaryAnswer);
    setShowExplanation(true);
    if (isCorrect) vqAudio.playCorrect();
    else vqAudio.playWrong();
  }, [showExplanation, isEditing, typedBlank, quiz]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return;

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
    isEditing,
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
  const maxOptLen = (quiz.options || []).reduce(
    (max: number, opt: any) => Math.max(max, String(opt?.text || '').length),
    0
  );
  const useTwoColGrid = optionCount === 2 || maxOptLen > 30;
  const isFinalCorrect = isFillInBlank
    ? blankCorrect
    : Boolean(quiz.options?.[selected!]?.isCorrect);

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
            className={`inline-block mx-1.5 px-3.5 py-0.5 rounded-xl border-b-[3px] font-black transition-colors ${
              showExplanation
                ? isFinalCorrect
                  ? 'bg-emerald-100 border-emerald-600 text-emerald-900'
                  : 'bg-amber-100 border-amber-500 text-amber-900'
                : typedBlank.trim()
                ? 'bg-indigo-100 border-indigo-600 text-indigo-900'
                : 'bg-indigo-50 border-indigo-500 text-indigo-700'
            }`}
          >
            {previewText}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  if (isEditing) {
    return (
      <div className="w-full p-5 sm:p-6 animate-vq-pop text-slate-900 max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-indigo-700">
            <Edit3 size={15} />
            <span>Editing Question {questionNumber || 1} of {totalQuestions || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#D8D0C5] text-slate-700 text-xs font-extrabold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveInlineEdit}
              disabled={!editQuestion.trim()}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} strokeWidth={3} />
              Save Changes
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center gap-1.5 bg-white border border-[#D8D0C5] rounded-xl px-3 py-2 shrink-0">
            <Clock size={14} className="text-indigo-600" />
            <span className="text-xs font-bold text-slate-600">Time:</span>
            <input
              type="text"
              value={editTime}
              onChange={(e) => setEditTime(e.target.value)}
              placeholder="0:15"
              className="w-16 bg-transparent text-xs font-extrabold text-indigo-700 vq-mono focus:outline-none text-center"
            />
          </div>

          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white border border-[#D8D0C5] text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
          >
            {QUESTION_TYPES.map((t) => (
              <option key={t} value={t} className="bg-white text-slate-900">
                {t}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={editQuestion}
            onChange={(e) => setEditQuestion(e.target.value)}
            placeholder="Edit question sentence..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C5] focus:border-indigo-600 focus:outline-none text-sm font-semibold text-slate-900"
          />

          {editType === 'Fill in the Blanks' && (
            <button
              type="button"
              onClick={() =>
                setEditQuestion((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '}____ `)
              }
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold cursor-pointer shrink-0"
            >
              + Insert ____
            </button>
          )}
        </div>

        {editType === 'Fill in the Blanks' ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300">
            <span className="text-xs font-extrabold text-emerald-800 shrink-0">
              Correct Missing Word(s):
            </span>
            <input
              type="text"
              value={editBlankAnswer}
              onChange={(e) => setEditBlankAnswer(e.target.value)}
              placeholder="Correct answer..."
              className="flex-1 bg-transparent text-sm font-bold text-emerald-950 placeholder:text-emerald-600/60 focus:outline-none"
            />
          </div>
        ) : editType === 'True or False' ? (
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-slate-700">Correct Answer:</span>
            {(['True', 'False'] as const).map((tf, idx) => (
              <button
                key={tf}
                type="button"
                onClick={() => setEditCorrectIdx(idx)}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                  editCorrectIdx === idx
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-slate-700 border-[#D8D0C5]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {['A', 'B', 'C', 'D'].map((letter, idx) => {
              const isRight = editCorrectIdx === idx;
              return (
                <div
                  key={letter}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border ${
                    isRight
                      ? 'bg-emerald-50 border-emerald-400'
                      : 'bg-white border-[#D8D0C5]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setEditCorrectIdx(idx)}
                    title="Click to mark as correct answer"
                    className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 cursor-pointer ${
                      isRight
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={editOptions[idx] || ''}
                    onChange={(e) => {
                      const next = [...editOptions];
                      next[idx] = e.target.value;
                      setEditOptions(next);
                    }}
                    placeholder={`Choice ${letter}${isRight ? ' (Correct)' : ''}`}
                    className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        )}

        <input
          type="text"
          value={editExplanation}
          onChange={(e) => setEditExplanation(e.target.value)}
          placeholder="Optional explanation shown after answering..."
          className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#D8D0C5] focus:border-indigo-600 focus:outline-none text-xs text-slate-800"
        />
      </div>
    );
  }

  return (
    <div className="w-full p-5 sm:p-7 animate-vq-pop text-slate-900 max-w-6xl mx-auto">
      {/* Question Metadata & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white vq-mono font-extrabold uppercase tracking-wider">
            Question {questionNumber || 1} of {totalQuestions || 1}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-slate-600 font-extrabold">{quiz?.type || 'Question'}</span>
          {quiz?.sceneContext && (
            <span className="hidden md:inline-block text-xs font-semibold text-slate-500 truncate max-w-md">
              ({quiz.sceneContext})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {canEdit && (
            <button
              type="button"
              onClick={openInlineEditor}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Edit3 size={14} />
              Edit
            </button>
          )}

          <button
            type="button"
            onClick={onReplayScene}
            className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw size={14} />
            {isReplayingClip ? 'Replaying...' : 'Replay (-5s)'}
          </button>

          <button
            type="button"
            onClick={() => speakText(quiz.question)}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#D8D0C5] text-slate-700 text-xs sm:text-sm font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Volume2 size={14} className="text-indigo-600" />
            Read Aloud
          </button>

          <button
            type="button"
            onClick={onSkip}
            className="px-3 py-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap"
          >
            Skip
          </button>
        </div>
      </div>

      {/* Big Classroom-Readable Question Heading */}
      <h2
        className={`vq-display font-extrabold text-slate-900 leading-snug tracking-tight mb-5 [text-wrap:balance] ${
          isFullscreen
            ? 'text-2xl sm:text-3xl lg:text-4xl'
            : 'text-xl sm:text-2xl md:text-[28px] lg:text-[32px]'
        }`}
      >
        {renderFormattedQuestion()}
      </h2>

      {/* Fill in the Blanks Input OR Large Multiple Choice Options Grid */}
      {isFillInBlank ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
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
              className={`w-full px-5 py-4 rounded-2xl border-2 text-lg sm:text-xl lg:text-2xl font-extrabold focus:outline-none transition-colors ${
                showExplanation
                  ? blankCorrect
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                    : 'bg-rose-50 border-rose-500 text-rose-900'
                  : 'bg-white border-[#D8D0C5] focus:border-indigo-600 text-slate-900 placeholder:text-slate-400 shadow-xs'
              }`}
            />
          </div>

          {!showExplanation && (
            <button
              type="button"
              disabled={!typedBlank.trim()}
              onClick={handleSubmitFillInBlank}
              className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-extrabold text-base sm:text-lg flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-md whitespace-nowrap"
            >
              <Check size={20} strokeWidth={3} />
              Check Answer
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid gap-3.5 ${
            useTwoColGrid
              ? 'grid-cols-1 md:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
          }`}
        >
          {(quiz.options || []).map((opt: any, idx: number) => {
            let btnStyle =
              'bg-white border-[#D8D0C5] text-slate-900 hover:border-indigo-600 hover:bg-indigo-50/60 shadow-xs';
            let badgeStyle = 'bg-indigo-50 border border-indigo-200 text-indigo-700';

            if (showExplanation) {
              if (opt.isCorrect) {
                btnStyle =
                  'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-md';
                badgeStyle = 'bg-emerald-600 text-white';
              } else if (selected === idx) {
                btnStyle = 'bg-rose-50 border-rose-500 text-rose-900';
                badgeStyle = 'bg-rose-600 text-white';
              } else {
                btnStyle = 'bg-white/60 border-slate-200 text-slate-400 opacity-65';
                badgeStyle = 'bg-slate-100 text-slate-400';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={showExplanation}
                onClick={() => handleSelect(idx)}
                className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all flex items-center gap-3.5 cursor-pointer ${btnStyle}`}
              >
                <span
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm sm:text-base font-black flex items-center justify-center shrink-0 ${badgeStyle}`}
                >
                  {letters[idx] || idx + 1}
                </span>
                <span className="text-base sm:text-lg lg:text-xl font-bold leading-snug">
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Instant Answer Explanation & Continue Bar */}
      {showExplanation && (
        <div className="mt-5 pt-4 border-t border-[#E6E0D4] flex flex-col sm:flex-row items-center justify-between gap-3.5 animate-vq-fade">
          <div className="flex items-start gap-3 text-left">
            {isFinalCorrect ? (
              <CheckCircle size={22} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={22} className="text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm sm:text-base text-slate-800 leading-relaxed">
              <span
                className={`font-extrabold mr-2 ${
                  isFinalCorrect ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isFinalCorrect ? 'Correct!' : 'Not quite.'}
              </span>
              {isFillInBlank && !isFinalCorrect && resolvedBlankAnswer && (
                <span className="text-indigo-700 font-extrabold mr-2">
                  Correct answer: &ldquo;{resolvedBlankAnswer}&rdquo;.
                </span>
              )}
              <span className="text-slate-600">{quiz.explanation}</span>
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
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shrink-0 cursor-pointer whitespace-nowrap shadow-md"
          >
            Continue Video
            <ArrowRight size={18} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-vq-pop">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#E6E0D4] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-900"
      >
        <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6E0D4] flex justify-between items-center">
          <h2 className="vq-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Folder size={18} className="text-indigo-600" />
            Save Video Quiz
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
          >
            <XCircle size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh] vq-scrollbar">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Quiz Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Mr. Bean Video Quiz"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5] focus:bg-white focus:border-indigo-600 focus:outline-none text-sm font-semibold text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
                Class / Level
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="e.g. Movers · B1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5] focus:bg-white focus:border-indigo-600 focus:outline-none text-xs font-semibold text-slate-900"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-extrabold text-slate-700">Folder</label>
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
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
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-[#FAF7F0] border border-indigo-400 text-xs font-semibold text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={creatingFolderBusy || !newFolderName.trim()}
                    onClick={handleCreateNewFolder}
                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0C5] focus:bg-white focus:border-indigo-600 focus:outline-none text-xs font-semibold text-slate-900"
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
            <label className="block text-xs font-extrabold text-slate-700 mb-1.5">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublic(true)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  isPublic
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-950'
                    : 'bg-[#FAF7F0] border-[#E6E0D4] text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe size={16} className={isPublic ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Public Library</div>
                  <div className="text-[10px] text-slate-500 truncate">Shared with teachers</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsPublic(false)}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-colors cursor-pointer ${
                  !isPublic
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-950'
                    : 'bg-[#FAF7F0] border-[#E6E0D4] text-slate-600 hover:text-slate-900'
                }`}
              >
                <Lock size={16} className={!isPublic ? 'text-indigo-600 shrink-0' : 'text-slate-400 shrink-0'} />
                <div className="min-w-0">
                  <div className="text-xs font-extrabold truncate">Private</div>
                  <div className="text-[10px] text-slate-500 truncate">Only in My Games</div>
                </div>
              </button>
            </div>
          </div>

          {isBlobUrl && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                <span>
                  You uploaded a local video file (<strong>{localVideoName}</strong>). Your questions will be saved, or you can paste an online video URL below to link permanently:
                </span>
              </div>
              <input
                type="text"
                value={webUrlFallback}
                onChange={(e) => setWebUrlFallback(e.target.value)}
                placeholder="Optional: https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 rounded-lg bg-white border border-amber-300 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6E0D4] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
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
    setCustomTimeInput(formatSeconds(parsedSec + 15));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-xs animate-vq-pop">
      <div className="bg-white border border-[#E6E0D4] w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-slate-900">
        <div className="px-6 py-4 bg-[#FAF7F0] border-b border-[#E6E0D4] flex flex-wrap justify-between items-center gap-3">
          <div>
            <h2 className="vq-display text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Settings size={18} className="text-indigo-600" />
              Edit Video Questions
            </h2>
            <p className="text-[11px] text-slate-500">
              {config?.topic ? (
                <>
                  Topic: <span className="text-indigo-700 font-extrabold">{config.topic}</span> ·{' '}
                </>
              ) : null}
              Level: <span className="text-indigo-700 font-extrabold">{normalizeEnglishLevel(config?.level)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-[#D8D0C5] rounded-xl px-2.5 py-1">
              <Clock size={13} className="text-indigo-600" />
              <input
                type="text"
                value={customTimeInput}
                onChange={(e) => setCustomTimeInput(e.target.value)}
                placeholder="0:15"
                title="Enter specific time as MM:SS (e.g. 1:20) or seconds (e.g. 80)"
                className="w-16 bg-transparent text-xs font-extrabold text-indigo-700 vq-mono focus:outline-none text-center"
              />
            </div>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('blank')}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} /> Fill in the Blank
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('mc')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-[#D8D0C5] text-slate-800 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} className="text-indigo-600" /> Multiple Choice
            </button>

            <button
              type="button"
              onClick={() => handleAddQuestionAtSpecificTime('auto')}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-extrabold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={13} /> Auto-Generate
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 vq-scrollbar">
          {editedQuestions.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#D8D0C5] bg-[#FAF7F0] text-center space-y-3">
              <div className="text-sm font-extrabold text-slate-900">
                No questions yet — add a Fill in the Blank or Multiple Choice question above
              </div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Enter a timestamp (like <span className="text-indigo-700 font-bold vq-mono">0:15</span>) and click <strong>Fill in the Blank</strong> or <strong>Multiple Choice</strong>.
              </p>
            </div>
          ) : (
            editedQuestions.map((q) => (
              <div
                key={q.id}
                className="bg-[#FAF7F0] p-4 rounded-2xl border border-[#E6E0D4] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-extrabold vq-mono">
                      @{formatSeconds(q.timeTrigger)}
                    </span>
                    <label className="text-[11px] text-slate-600 font-bold">
                      Seconds:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3600}
                      value={q.timeTrigger}
                      onChange={(e) =>
                        updateQuestionField(q.id, 'timeTrigger', Math.max(1, Number(e.target.value) || 1))
                      }
                      className="w-20 px-2.5 py-1 rounded-lg bg-white border border-[#D8D0C5] text-xs font-extrabold text-slate-900 vq-mono"
                    />
                    <select
                      value={q.type || 'Multiple Choice'}
                      onChange={(e) => updateQuestionField(q.id, 'type', e.target.value)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#D8D0C5] text-xs font-bold text-indigo-700"
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
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-[#D8D0C5] text-[10px] font-extrabold text-slate-700 cursor-pointer"
                    >
                      Use Video Time ({formatSeconds(currentTime)})
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#D8D0C5] focus:border-indigo-600 focus:outline-none text-xs sm:text-sm font-semibold text-slate-900"
                />

                {q.type === 'Fill in the Blanks' ? (
                  <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300">
                    <span className="text-xs font-extrabold text-emerald-800 shrink-0">
                      Correct Answer for Blank:
                    </span>
                    <input
                      type="text"
                      value={q.answer || ''}
                      onChange={(e) => updateQuestionField(q.id, 'answer', e.target.value)}
                      placeholder="e.g. looked"
                      className="flex-1 bg-transparent text-xs sm:text-sm font-bold text-emerald-950 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(q.options || []).map((opt: any, oIdx: number) => (
                      <div
                        key={oIdx}
                        className={`flex items-center gap-2 p-2 rounded-xl border ${
                          opt.isCorrect
                            ? 'bg-emerald-50 border-emerald-400'
                            : 'bg-white border-[#D8D0C5]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setCorrectOption(q.id, oIdx)}
                          title="Mark as correct answer"
                          className={`w-6 h-6 rounded-md text-xs font-black flex items-center justify-center shrink-0 cursor-pointer ${
                            opt.isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
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
                          className="w-full bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 bg-[#FAF7F0] border-t border-[#E6E0D4] flex justify-between items-center gap-3">
          <button
            type="button"
            onClick={() => setEditedQuestions([])}
            className="px-3 py-2 rounded-xl text-xs font-extrabold text-rose-600 hover:bg-rose-50 cursor-pointer"
          >
            Clear All
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 hover:bg-slate-200/60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 cursor-pointer shadow-sm"
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
