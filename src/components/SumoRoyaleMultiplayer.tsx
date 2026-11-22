import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Copy,
  Check,
  QrCode,
  Users,
  Zap,
  Trophy,
  Play,
  Shuffle,
  Volume2,
  VolumeX,
  Settings,
  X,
  Bot,
  Shield,
  Swords,
  Clock,
  Crown,
  RotateCcw,
  Eye,
  ArrowRight
} from 'lucide-react';
import {
  SumoCharacter,
  CircularSumoArena,
  SumoStadiumEnvironment,
  SUMO_CHARACTER_OPTIONS,
  SumoCharacterType
} from './SumoStadiumEnvironment';
import { parseOptionContent } from '../utils/mediaAndPresets';
import { db, isFirestoreQuotaExhausted } from '../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export interface SumoRoyaleQuestion {
  id: number | string;
  text: string;
  image?: string;
  options: string[];
  answerIndex: number;
}

export interface SumoRoyalePlayer {
  id: string;
  name: string;
  character: SumoCharacterType;
  energy: number;
  maxEnergy: number;
  teamId?: string | null;
  eliminated: boolean;
  eliminatedRound?: number;
  wins: number;
  correctCount: number;
  totalTimeMs: number;
  isBot?: boolean;
  kicked?: boolean;
  lastByeRound?: number;
  // Current 1-minute live-action round tug-of-war state
  answeredRound?: number;
  roundPushes?: number;
  roundWrong?: number;
  lastPushAt?: number;
  streak?: number;
  shield?: boolean;
  answerIndex?: number | null;
  answerTimeMs?: number | null;
  isCorrect?: boolean | null;
  updatedAt?: number;
}

export interface SumoRoyaleTeam {
  id: string;
  name: string;
  character: SumoCharacterType;
  colorHex: string;
  bgClass: string;
  borderClass: string;
  energy: number;
  maxEnergy: number;
  eliminated: boolean;
  eliminatedRound?: number;
  wins: number;
  lastByeRound?: number;
}

export interface SumoRoyaleMatchup {
  id: string;
  leftId: string; // playerId in solo mode, teamId in teams mode
  rightId: string | null; // null if isBye
  isBye?: boolean;
  // Live 1-minute tug-of-war Dohyo Arena state
  battlePos?: number; // 15..85 (50 = center; >= 84 = Left Ring-Out Win; <= 16 = Right Ring-Out Win)
  leftPushes?: number;
  rightPushes?: number;
  lastPusher?: 'left' | 'right' | null;
  lastPushAt?: number;
  ringOutWinnerId?: string | null;
  // Resolved results during CLASH_RESULT (Winner Showcase)
  winnerId?: string | null;
  loserId?: string | null;
  isDraw?: boolean;
  reason?:
    | 'ring_out'
    | 'time_dominance'
    | 'faster_push'
    | 'both_idle'
    | 'bye'
    | 'faster_correct'
    | 'correct_vs_wrong'
    | 'both_wrong';
  leftCorrect?: boolean;
  rightCorrect?: boolean;
  leftTimeMs?: number | null;
  rightTimeMs?: number | null;
  leftAnswerIndex?: number | null;
  rightAnswerIndex?: number | null;
}

export type SumoRoyalePhase =
  | 'SETTINGS'
  | 'LOBBY'
  | 'VS_INTRO'
  | 'QUESTION'
  | 'CLASH_RESULT'
  | 'CHAMPION';

export interface SumoRoyaleRoomState {
  roomCode: string;
  title: string;
  matchType: 'solo' | 'teams';
  startingEnergy: number;
  questionOrder: 'random' | 'ordered';
  phase: SumoRoyalePhase;
  roundNumber: number;
  roundDurationMs: number;
  roundStartedAt?: number;
  roundServerStartedAt?: number;
  currentQuestion?: SumoRoyaleQuestion | null;
  questionPool?: SumoRoyaleQuestion[];
  matchups: SumoRoyaleMatchup[];
  teams: SumoRoyaleTeam[];
  serverNow?: number;
  hostClosed?: boolean;
}

const PUSH_STEP_PERCENT = 12; // 3 net pushes (50 -> 86 or 50 -> 14) achieves a full Oshidashi Ring-Out!
const MATCH_DURATION_MS = 60000; // 1-minute (60s) live-action Sumo match

const DOJO_TEAM_PRESETS: Array<{
  id: string;
  name: string;
  character: SumoCharacterType;
  colorHex: string;
  bgClass: string;
  borderClass: string;
}> = [
  {
    id: 'team-rikishi',
    name: 'Thunder Rikishi',
    character: 'rikishi',
    colorHex: '#2563EB',
    bgClass: 'from-blue-600 to-indigo-700',
    borderClass: 'border-blue-300'
  },
  {
    id: 'team-panda',
    name: 'Bamboo Pandas',
    character: 'panda',
    colorHex: '#059669',
    bgClass: 'from-emerald-600 to-teal-700',
    borderClass: 'border-emerald-300'
  },
  {
    id: 'team-shiba',
    name: 'Golden Shibas',
    character: 'shiba',
    colorHex: '#D97706',
    bgClass: 'from-amber-500 to-orange-600',
    borderClass: 'border-amber-300'
  },
  {
    id: 'team-tiger',
    name: 'Crimson Tigers',
    character: 'tiger',
    colorHex: '#DC2626',
    bgClass: 'from-rose-600 to-red-700',
    borderClass: 'border-rose-300'
  },
  {
    id: 'team-bear',
    name: 'Iron Bears',
    character: 'bear',
    colorHex: '#7C3AED',
    bgClass: 'from-violet-600 to-purple-700',
    borderClass: 'border-violet-300'
  },
  {
    id: 'team-hamster',
    name: 'Sakura Hamsters',
    character: 'hamster',
    colorHex: '#DB2777',
    bgClass: 'from-pink-600 to-rose-600',
    borderClass: 'border-pink-300'
  }
];

const BOT_NAMES = [
  'Yokozuna Ken',
  'Rikishi Ryu',
  'Master Mochi',
  'Sensei Taro',
  'Shogun Kuma',
  'Dojo Hachi',
  'Panda Bao',
  'Tiger Tora',
  'Kabuki Kai',
  'Samurai Sora',
  'Kitsune Ren',
  'Tanuki Jin'
];

let sharedRoyaleAudioCtx: AudioContext | null = null;

function playRoyaleSFX(
  type: 'horn' | 'taiko' | 'clash' | 'shatter' | 'lock' | 'victory' | 'stun' | 'combo' | 'heavy' | 'shield',
  muted: boolean
) {
  if (muted) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!sharedRoyaleAudioCtx) {
      sharedRoyaleAudioCtx = new AudioCtx();
    }
    const ctx = sharedRoyaleAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    if (type === 'taiko' || type === 'clash') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'stun' || type === 'shatter') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.linearRampToValueAtTime(95, now + 0.3);
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    } else if (type === 'lock') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.07);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } else if (type === 'horn') {
      const notes = [392.0, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.22, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.09 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.29);
      });
    } else if (type === 'victory') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.28, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.12 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.52);
      });
    } else if (type === 'combo') {
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.22, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    } else if (type === 'heavy') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.34);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'shield') {
      const notes = [587.33, 880, 1174.66];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0.24, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.24);
      });
    }
  } catch {}
}

function formatMatchTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Segmented Lightning Energy Bar
function EnergyBar({
  energy,
  maxEnergy,
  side = 'left',
  size = 'md',
  justLostEnergy = false
}: {
  energy: number;
  maxEnergy: number;
  side?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  justLostEnergy?: boolean;
}) {
  const segments = Array.from({ length: Math.max(1, maxEnergy) }, (_, i) => i < energy);
  const fillClass =
    side === 'left'
      ? 'bg-gradient-to-b from-cyan-300 via-blue-500 to-blue-700 border-cyan-200'
      : 'bg-gradient-to-b from-amber-300 via-orange-500 to-red-600 border-amber-200';
  const heightClass = size === 'lg' ? 'h-6 sm:h-7' : size === 'md' ? 'h-4 sm:h-5' : 'h-3';

  return (
    <div
      className={`inline-flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border-2 border-amber-500 shadow-[0_3px_0_rgba(0,0,0,0.25)] ${
        justLostEnergy ? 'animate-bounce ring-4 ring-rose-500' : ''
      }`}
    >
      {side === 'left' && (
        <Zap
          className={`${
            size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
          } text-blue-600 fill-cyan-400 shrink-0 -rotate-12`}
        />
      )}
      <div className="flex items-center gap-1">
        {segments.map((filled, idx) => {
          const isShattering = justLostEnergy && idx === energy;
          return (
            <div
              key={idx}
              className={`${
                maxEnergy >= 10
                  ? 'w-1.5 sm:w-2'
                  : maxEnergy >= 7
                  ? 'w-2 sm:w-3'
                  : 'w-3 sm:w-4'
              } ${heightClass} -skew-x-12 rounded-xs border transition-all duration-300 ${
                filled
                  ? `${fillClass} shadow-xs`
                  : isShattering
                  ? 'bg-rose-500 border-rose-300 scale-125 animate-ping'
                  : 'bg-slate-200 border-slate-300 opacity-50'
              }`}
            />
          );
        })}
      </div>
      <span className="text-xs sm:text-sm font-black text-slate-800 tabular-nums ml-0.5">
        {Math.max(0, energy)}
      </span>
      {side === 'right' && (
        <Zap
          className={`${
            size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
          } text-orange-500 fill-amber-400 shrink-0 rotate-12`}
        />
      )}
    </div>
  );
}

export function SumoRoyaleMultiplayer({
  role: initialRole,
  initialRoomCode,
  gameTitle,
  questions,
  onExit
}: {
  role: 'host' | 'student';
  initialRoomCode?: string;
  gameTitle: string;
  questions: SumoRoyaleQuestion[];
  onExit: () => void;
}) {
  const [role] = useState<'host' | 'student'>(initialRole);
  const [soundMuted, setSoundMuted] = useState(false);

  // ============================================================================
  // HOST SETTINGS & ROOM STATE
  // ============================================================================
  const [roomCode, setRoomCode] = useState<string>(() => {
    if (initialRoomCode) return initialRoomCode.toUpperCase();
    return String(Math.floor(100000 + Math.random() * 900000));
  });

  const [matchType, setMatchType] = useState<'solo' | 'teams'>('solo');
  const [startingEnergy, setStartingEnergy] = useState<number>(5);
  const [questionOrder, setQuestionOrder] = useState<'random' | 'ordered'>('random');
  const [phase, setPhase] = useState<SumoRoyalePhase>(
    initialRole === 'host' ? 'SETTINGS' : 'LOBBY'
  );

  const [players, setPlayers] = useState<SumoRoyalePlayer[]>([]);
  const [teams, setTeams] = useState<SumoRoyaleTeam[]>([]);
  const [matchups, setMatchups] = useState<SumoRoyaleMatchup[]>([]);
  const [roundNumber, setRoundNumber] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<SumoRoyaleQuestion | null>(null);
  const [roundQuestionPool, setRoundQuestionPool] = useState<SumoRoyaleQuestion[]>([]);
  const [roundStartedAt, setRoundStartedAt] = useState<number>(0);
  const [roundDurationMs] = useState<number>(MATCH_DURATION_MS);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);

  const [copiedLink, setCopiedLink] = useState(false);
  const [showLargeQR, setShowLargeQR] = useState(false);

  // ============================================================================
  // STUDENT LOCAL STATE (Continuous 1-Minute Dohyo Tug-of-War Arena)
  // ============================================================================
  const [studentId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem('sumo_royale_student_id');
      if (existing) return existing;
      const created = 'sr_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('sumo_royale_student_id', created);
      return created;
    } catch {
      return 'sr_' + Math.random().toString(36).slice(2, 10);
    }
  });

  const [studentName, setStudentName] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('sumo_saved_nickname') ||
        localStorage.getItem('paintball_saved_nickname') ||
        ''
      );
    } catch {
      return '';
    }
  });
  const [studentCharacter, setStudentCharacter] = useState<SumoCharacterType>('rikishi');
  const [studentRoomInput, setStudentRoomInput] = useState<string>(
    initialRoomCode ? initialRoomCode.toUpperCase() : ''
  );
  const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState<boolean>(false);

  // Continuous per-student question progression during the 1-minute arena match
  const [studentQuestionIdx, setStudentQuestionIdx] = useState<number>(0);
  const [studentLocalPushes, setStudentLocalPushes] = useState<number>(0);
  const [studentLocalWrong, setStudentLocalWrong] = useState<number>(0);
  const [studentStreak, setStudentStreak] = useState<number>(0);
  const [studentShield, setStudentShield] = useState<boolean>(false);
  const [studentPowerCallout, setStudentPowerCallout] = useState<string | null>(null);
  const [studentStunned, setStudentStunned] = useState<boolean>(false);
  const [studentPushingAnim, setStudentPushingAnim] = useState<boolean>(false);
  const [studentLastFeedback, setStudentLastFeedback] = useState<'correct' | 'wrong' | null>(
    null
  );
  const [studentActiveRoundTracker, setStudentActiveRoundTracker] = useState<number>(0);

  // Refs for host loop & question deck
  const playersRef = useRef<SumoRoyalePlayer[]>(players);
  playersRef.current = players;
  const teamsRef = useRef<SumoRoyaleTeam[]>(teams);
  teamsRef.current = teams;
  const matchupsRef = useRef<SumoRoyaleMatchup[]>(matchups);
  matchupsRef.current = matchups;
  const phaseRef = useRef<SumoRoyalePhase>(phase);
  phaseRef.current = phase;
  const roundNumberRef = useRef<number>(roundNumber);
  roundNumberRef.current = roundNumber;
  const roundQuestionPoolRef = useRef<SumoRoyaleQuestion[]>(roundQuestionPool);
  roundQuestionPoolRef.current = roundQuestionPool;
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Build normalized question pool
  const normalizedQuestions: SumoRoyaleQuestion[] = React.useMemo(() => {
    const valid = (questions || []).filter(
      (q) => q && (q.text?.trim() || q.image) && Array.isArray(q.options)
    );
    if (valid.length > 0) {
      return valid.map((q, idx) => {
        const cleanOpts = q.options.filter((o) => typeof o === 'string' && o.trim() !== '');
        const finalOpts =
          cleanOpts.length >= 2 ? cleanOpts.slice(0, 4) : ['Option A', 'Option B'];
        return {
          id: q.id || `sr-q-${idx}`,
          text: q.text || 'Choose the correct answer:',
          image: q.image,
          options: finalOpts,
          answerIndex:
            typeof q.answerIndex === 'number' &&
            q.answerIndex >= 0 &&
            q.answerIndex < finalOpts.length
              ? q.answerIndex
              : 0
        };
      });
    }
    return [
      {
        id: 'default-1',
        text: 'The cat is sleeping ______ the table.',
        options: ['under', 'above', 'between', 'opposite'],
        answerIndex: 0
      },
      {
        id: 'default-2',
        text: 'Two Sumo fighters are standing ______ the circular ring.',
        options: ['inside', 'above', 'through', 'onto'],
        answerIndex: 0
      },
      {
        id: 'default-3',
        text: 'The golden trophy sits ______ the two championship flags.',
        options: ['between', 'under', 'into', 'across'],
        answerIndex: 0
      },
      {
        id: 'default-4',
        text: 'Hang the paper lantern ______ the dojo entrance.',
        options: ['above', 'inside', 'under', 'between'],
        answerIndex: 0
      }
    ];
  }, [questions]);

  const buildRoundQuestionDeck = useCallback((): SumoRoyaleQuestion[] => {
    const base = [...normalizedQuestions];
    if (questionOrder === 'random') {
      base.sort(() => Math.random() - 0.5);
    }
    return base.map((rawQ) => {
      const correctText = rawQ.options[rawQ.answerIndex] ?? rawQ.options[0];
      const shuffledOptions = [...rawQ.options].sort(() => Math.random() - 0.5);
      const newAnswerIndex = Math.max(0, shuffledOptions.indexOf(correctText));
      return {
        ...rawQ,
        options: shuffledOptions,
        answerIndex: newAnswerIndex
      };
    });
  }, [normalizedQuestions, questionOrder]);

  // ============================================================================
  // AUTO-BALANCE DOJO TEAMS HELPER
  // ============================================================================
  const computeAutoBalancedTeams = useCallback(
    (
      currentPlayers: SumoRoyalePlayer[],
      energyPerTeam: number,
      shuffleOrder = false
    ): { updatedPlayers: SumoRoyalePlayer[]; updatedTeams: SumoRoyaleTeam[] } => {
      const activeList = currentPlayers.filter((p) => !p.kicked);
      if (activeList.length === 0) {
        return { updatedPlayers: currentPlayers, updatedTeams: [] };
      }

      const teamCount =
        activeList.length <= 3
          ? 2
          : activeList.length <= 6
          ? 3
          : activeList.length <= 12
          ? 4
          : Math.min(6, Math.ceil(activeList.length / 3));

      const chosenPresets = DOJO_TEAM_PRESETS.slice(0, teamCount);
      const createdTeams: SumoRoyaleTeam[] = chosenPresets.map((preset) => ({
        ...preset,
        energy: energyPerTeam,
        maxEnergy: energyPerTeam,
        eliminated: false,
        wins: 0
      }));

      const orderedPlayers = shuffleOrder
        ? [...activeList].sort(() => Math.random() - 0.5)
        : [...activeList];

      const assignmentMap = new Map<string, string>();
      orderedPlayers.forEach((p, idx) => {
        const assignedTeam = createdTeams[idx % createdTeams.length];
        assignmentMap.set(p.id, assignedTeam.id);
      });

      const nextPlayers = currentPlayers.map((p) => ({
        ...p,
        teamId: assignmentMap.get(p.id) || createdTeams[0].id
      }));

      return { updatedPlayers: nextPlayers, updatedTeams: createdTeams };
    },
    []
  );

  // ============================================================================
  // LIVE DOHYO TUG-OF-WAR RECALCULATION HELPER
  // ============================================================================
  const recomputeLiveMatchups = useCallback(
    (
      currentMatchups: SumoRoyaleMatchup[],
      currentPlayers: SumoRoyalePlayer[],
      currentRound: number
    ): SumoRoyaleMatchup[] => {
      const getContenderStats = (contenderId: string) => {
        if (matchType === 'solo') {
          const p = currentPlayers.find((pl) => pl.id === contenderId);
          if (!p || p.answeredRound !== currentRound) {
            return { pushes: 0, lastPushAt: 0 };
          }
          return {
            pushes: p.roundPushes || 0,
            lastPushAt: p.lastPushAt || 0
          };
        } else {
          const members = currentPlayers.filter(
            (pl) => pl.teamId === contenderId && !pl.kicked && pl.answeredRound === currentRound
          );
          const pushes = members.reduce((sum, m) => sum + (m.roundPushes || 0), 0);
          const lastPushAt = members.reduce(
            (latest, m) => Math.max(latest, m.lastPushAt || 0),
            0
          );
          return { pushes, lastPushAt };
        }
      };

      return currentMatchups.map((m) => {
        if (m.isBye || !m.rightId) {
          return {
            ...m,
            battlePos: 50,
            leftPushes: 0,
            rightPushes: 0,
            winnerId: m.leftId,
            reason: 'bye'
          };
        }

        const leftStats = getContenderStats(m.leftId);
        const rightStats = getContenderStats(m.rightId);

        // If a Ring-Out already occurred in this arena, lock the ring-out position & winner
        if (m.ringOutWinnerId) {
          return {
            ...m,
            leftPushes: leftStats.pushes,
            rightPushes: rightStats.pushes,
            battlePos: m.ringOutWinnerId === m.leftId ? 85 : 15
          };
        }

        const netDiff = leftStats.pushes - rightStats.pushes;
        const rawPos = 50 + netDiff * PUSH_STEP_PERCENT;
        const clampedPos = Math.max(15, Math.min(85, rawPos));

        let ringOutWinnerId: string | null = null;
        if (clampedPos >= 84) {
          ringOutWinnerId = m.leftId;
        } else if (clampedPos <= 16) {
          ringOutWinnerId = m.rightId;
        }

        let lastPusher: 'left' | 'right' | null = m.lastPusher || null;
        let lastPushAt = m.lastPushAt || 0;
        if (leftStats.lastPushAt > rightStats.lastPushAt && leftStats.lastPushAt > 0) {
          lastPusher = 'left';
          lastPushAt = leftStats.lastPushAt;
        } else if (rightStats.lastPushAt > leftStats.lastPushAt && rightStats.lastPushAt > 0) {
          lastPusher = 'right';
          lastPushAt = rightStats.lastPushAt;
        }

        return {
          ...m,
          battlePos: ringOutWinnerId ? (ringOutWinnerId === m.leftId ? 85 : 15) : clampedPos,
          leftPushes: leftStats.pushes,
          rightPushes: rightStats.pushes,
          lastPusher,
          lastPushAt,
          ringOutWinnerId
        };
      });
    },
    [matchType]
  );

  // ============================================================================
  // HOST & STUDENT REAL-TIME SYNC (SERVER + BROADCASTCHANNEL + FIRESTORE)
  // ============================================================================
  const pushHostStateToServer = useCallback(
    async (
      overrideRoom?: Partial<SumoRoyaleRoomState>,
      overridePlayers?: SumoRoyalePlayer[],
      replacePlayers = false
    ) => {
      if (role !== 'host') return;
      const roomPayload: SumoRoyaleRoomState = {
        roomCode,
        title: gameTitle || 'Sumo Royale: Dojo Showdown',
        matchType,
        startingEnergy,
        questionOrder,
        phase: overrideRoom?.phase ?? phaseRef.current,
        roundNumber: overrideRoom?.roundNumber ?? roundNumberRef.current,
        roundDurationMs,
        roundStartedAt: overrideRoom?.roundStartedAt ?? roundStartedAt,
        currentQuestion:
          overrideRoom?.currentQuestion !== undefined
            ? overrideRoom.currentQuestion
            : currentQuestion,
        questionPool:
          overrideRoom?.questionPool !== undefined
            ? overrideRoom.questionPool
            : roundQuestionPoolRef.current,
        matchups: overrideRoom?.matchups ?? matchupsRef.current,
        teams: overrideRoom?.teams ?? teamsRef.current,
        hostClosed: overrideRoom?.hostClosed ?? false
      };

      const playersPayload = overridePlayers ?? playersRef.current;

      // 1. Broadcast to same-browser tabs immediately
      try {
        broadcastChannelRef.current?.postMessage({
          type: 'host_state_update',
          room: roomPayload,
          players: playersPayload
        });
      } catch {}

      // 2. Push to authoritative Express server
      try {
        const res = await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}/room`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room: roomPayload,
            players: playersPayload,
            replacePlayers
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.players) && !replacePlayers) {
            setPlayers(data.players.filter((p: any) => !p.kicked));
          }
        }
      } catch {}

      // 3. Mirror lightweight room discovery document to Firestore if quota available
      if (!isFirestoreQuotaExhausted()) {
        try {
          await setDoc(
            doc(db, 'ttt_rooms', `sumo_room_${roomCode}`),
            {
              roomCode,
              isUninitialized: Boolean(roomPayload.hostClosed),
              hostClosed: Boolean(roomPayload.hostClosed),
              phase: roomPayload.phase,
              updatedAt: Date.now()
            },
            { merge: true }
          );
        } catch {}
      }
    },
    [
      role,
      roomCode,
      gameTitle,
      matchType,
      startingEnergy,
      questionOrder,
      roundDurationMs,
      roundStartedAt,
      currentQuestion
    ]
  );

  // Setup BroadcastChannel for instant local tab discovery & updates
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined' || !roomCode) return;
    const channelName = `sumo_royale_net_${roomCode}`;
    const bc = new BroadcastChannel(channelName);
    broadcastChannelRef.current = bc;

    bc.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      if (role === 'host' && msg.type === 'ping_host') {
        bc.postMessage({ type: 'pong_host', roomCode });
      } else if (role === 'student' && msg.type === 'host_state_update') {
        if (msg.room) {
          setPhase(msg.room.phase || 'LOBBY');
          setMatchType(msg.room.matchType || 'solo');
          setStartingEnergy(msg.room.startingEnergy || 5);
          setRoundNumber(msg.room.roundNumber || 0);
          setCurrentQuestion(msg.room.currentQuestion || null);
          if (Array.isArray(msg.room.questionPool) && msg.room.questionPool.length > 0) {
            setRoundQuestionPool(msg.room.questionPool);
          }
          setMatchups(Array.isArray(msg.room.matchups) ? msg.room.matchups : []);
          setTeams(Array.isArray(msg.room.teams) ? msg.room.teams : []);
          if (msg.room.roundStartedAt) setRoundStartedAt(msg.room.roundStartedAt);
        }
        if (Array.isArray(msg.players)) {
          setPlayers(msg.players.filter((p: any) => !p.kicked));
        }
      }
    };

    return () => {
      try {
        bc.close();
      } catch {}
      broadcastChannelRef.current = null;
    };
  }, [roomCode, role]);

  // Host polling loop: fetch joined students & live arena pushes every 350ms
  useEffect(() => {
    if (role !== 'host' || phase === 'SETTINGS') return;

    pushHostStateToServer();

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.exists) {
          pushHostStateToServer();
          return;
        }
        if (Array.isArray(data.players)) {
          const remotePlayers: SumoRoyalePlayer[] = data.players.filter((p: any) => !p.kicked);
          const map = new Map<string, SumoRoyalePlayer>();
          playersRef.current.forEach((p) => map.set(p.id, p));

          remotePlayers.forEach((rp) => {
            const local = map.get(rp.id);
            if (!local) {
              map.set(rp.id, {
                ...rp,
                energy: startingEnergy,
                maxEnergy: startingEnergy,
                eliminated: false,
                wins: 0,
                correctCount: 0,
                totalTimeMs: 0,
                roundPushes: 0,
                roundWrong: 0
              });
            } else {
              const canPlay = !local.eliminated && local.energy > 0;
              const isCurrentRound = canPlay && rp.answeredRound === roundNumberRef.current;
              const nextPushes = isCurrentRound
                ? Math.max(local.roundPushes || 0, rp.roundPushes || 0)
                : local.roundPushes || 0;
              const nextWrong = isCurrentRound
                ? Math.max(local.roundWrong || 0, rp.roundWrong || 0)
                : local.roundWrong || 0;
              const nextLastPushAt = isCurrentRound
                ? Math.max(local.lastPushAt || 0, rp.lastPushAt || 0)
                : local.lastPushAt || 0;

              map.set(rp.id, {
                ...local,
                name: rp.name || local.name,
                character: rp.character || local.character,
                answeredRound: isCurrentRound ? rp.answeredRound : local.answeredRound,
                roundPushes: nextPushes,
                roundWrong: nextWrong,
                lastPushAt: nextLastPushAt,
                streak: isCurrentRound ? (rp.streak ?? local.streak ?? 0) : 0,
                shield: isCurrentRound ? Boolean(rp.shield ?? local.shield) : false
              });
            }
          });

          const mergedPlayers = Array.from(map.values());
          setPlayers(mergedPlayers);

          // If in active 1-minute QUESTION arena bout, recompute live Dohyo battlePos and broadcast
          if (phaseRef.current === 'QUESTION') {
            const updatedMatchups = recomputeLiveMatchups(
              matchupsRef.current,
              mergedPlayers,
              roundNumberRef.current
            );
            setMatchups(updatedMatchups);
            pushHostStateToServer({ matchups: updatedMatchups }, mergedPlayers);
          }
        }
      } catch {}
    }, 350);

    const heartbeat = window.setInterval(() => {
      pushHostStateToServer();
    }, 3500);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(heartbeat);
    };
  }, [
    role,
    phase,
    roomCode,
    startingEnergy,
    recomputeLiveMatchups,
    pushHostStateToServer
  ]);

  // Auto-assign teams in lobby whenever matchType === 'teams' and player count changes
  useEffect(() => {
    if (role !== 'host' || phase !== 'LOBBY' || matchType !== 'teams') return;
    const unassigned = players.some((p) => !p.teamId);
    if (unassigned || teams.length === 0) {
      const { updatedPlayers, updatedTeams } = computeAutoBalancedTeams(
        players,
        startingEnergy,
        false
      );
      setPlayers(updatedPlayers);
      setTeams(updatedTeams);
      pushHostStateToServer({ teams: updatedTeams }, updatedPlayers);
    }
  }, [
    role,
    phase,
    matchType,
    players.length,
    startingEnergy,
    teams.length,
    computeAutoBalancedTeams,
    pushHostStateToServer
  ]);

  // Student polling loop once joined
  useEffect(() => {
    if (role !== 'student' || !hasJoinedRoom || !roomCode) return;

    const pollRoom = async () => {
      try {
        const res = await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.room) {
          const r = data.room as SumoRoyaleRoomState;
          setPhase(r.phase || 'LOBBY');
          setMatchType(r.matchType || 'solo');
          setStartingEnergy(r.startingEnergy || 5);
          setRoundNumber(r.roundNumber || 0);
          setCurrentQuestion(r.currentQuestion || null);
          if (Array.isArray(r.questionPool) && r.questionPool.length > 0) {
            setRoundQuestionPool(r.questionPool);
          }
          setMatchups(Array.isArray(r.matchups) ? r.matchups : []);
          setTeams(Array.isArray(r.teams) ? r.teams : []);
          if (r.roundStartedAt) setRoundStartedAt(r.roundStartedAt);
        }
        if (Array.isArray(data?.players)) {
          const me = data.players.find((p: any) => p.id === studentId);
          if (me?.kicked) {
            setHasJoinedRoom(false);
            setJoinError('You were removed from the room by the host.');
            return;
          }
          setPlayers(data.players.filter((p: any) => !p.kicked));
        }
      } catch {}
    };

    pollRoom();
    const interval = window.setInterval(pollRoom, 350);
    return () => window.clearInterval(interval);
  }, [role, hasJoinedRoom, roomCode, studentId]);

  // Reset student's per-round tug-of-war counters when a new QUESTION round starts
  useEffect(() => {
    if (phase === 'QUESTION' && roundNumber > 0 && studentActiveRoundTracker !== roundNumber) {
      setStudentActiveRoundTracker(roundNumber);
      setStudentQuestionIdx(0);
      setStudentLocalPushes(0);
      setStudentLocalWrong(0);
      setStudentStreak(0);
      setStudentShield(false);
      setStudentPowerCallout(null);
      setStudentStunned(false);
      setStudentPushingAnim(false);
      setStudentLastFeedback(null);
    }
  }, [phase, roundNumber, studentActiveRoundTracker]);

  // ============================================================================
  // HOST ROUND ENGINE: START ROUND -> VS_INTRO -> 1-MIN LIVE ARENA -> WINNER SHOWCASE
  // ============================================================================
  const beginNextRound = useCallback(
    (
      currentRoundNum: number,
      currentPlayersList: SumoRoyalePlayer[],
      currentTeamsList: SumoRoyaleTeam[]
    ) => {
      const nextRound = currentRoundNum + 1;
      const deck = buildRoundQuestionDeck();
      const firstQ = deck[0] || normalizedQuestions[0];

      // Clear previous round tug-of-war stats on players and strictly mark 0-energy players as eliminated
      const clearedPlayers: SumoRoyalePlayer[] = currentPlayersList.map((p) => {
        const isOut = p.eliminated || p.energy <= 0;
        return {
          ...p,
          energy: Math.max(0, p.energy),
          eliminated: isOut,
          answeredRound: isOut ? p.answeredRound : nextRound,
          roundPushes: 0,
          roundWrong: 0,
          lastPushAt: 0,
          streak: 0,
          shield: false,
          answerIndex: null,
          answerTimeMs: null,
          isCorrect: null
        };
      });

      const newMatchups: SumoRoyaleMatchup[] = [];

      if (matchType === 'solo') {
        const alive = clearedPlayers.filter((p) => !p.eliminated && p.energy > 0);
        if (alive.length <= 1) {
          setPhase('CHAMPION');
          playRoyaleSFX('victory', soundMuted);
          pushHostStateToServer({ phase: 'CHAMPION' }, clearedPlayers);
          return;
        }

        const shuffled = [...alive].sort(() => Math.random() - 0.5);

        // When odd number of living players (e.g. Player 1, Player 2, Player 3),
        // pair the odd player against one of the already-paired players so every pairing is distinct
        // (e.g. Player 1 vs Player 2 AND Player 1 vs Player 3).
        let oddPlayer: SumoRoyalePlayer | null = null;
        if (shuffled.length % 2 === 1) {
          oddPlayer = shuffled.pop() || null;
        }

        for (let i = 0; i < shuffled.length; i += 2) {
          const left = shuffled[i];
          const right = shuffled[i + 1];
          newMatchups.push({
            id: `m-${nextRound}-${i}`,
            leftId: left.id,
            rightId: right.id,
            isBye: false,
            battlePos: 50,
            leftPushes: 0,
            rightPushes: 0,
            lastPusher: null,
            lastPushAt: 0,
            ringOutWinnerId: null
          });
        }

        if (oddPlayer && shuffled.length > 0) {
          // Pick a distinct challenger from the paired players (rotating via lastByeRound and highest energy)
          const candidates = [...shuffled].sort((a, b) => {
            const aRecent = a.lastByeRound === currentRoundNum ? 1 : 0;
            const bRecent = b.lastByeRound === currentRoundNum ? 1 : 0;
            if (aRecent !== bRecent) return aRecent - bRecent;
            return b.energy - a.energy;
          });
          const doubleFighter = candidates[0];
          doubleFighter.lastByeRound = nextRound;

          newMatchups.push({
            id: `m-${nextRound}-double`,
            leftId: doubleFighter.id,
            rightId: oddPlayer.id,
            isBye: false,
            battlePos: 50,
            leftPushes: 0,
            rightPushes: 0,
            lastPusher: null,
            lastPushAt: 0,
            ringOutWinnerId: null
          });
        }
      } else {
        const syncedTeams = currentTeamsList.map((t) => ({
          ...t,
          energy: Math.max(0, t.energy),
          eliminated: t.eliminated || t.energy <= 0
        }));
        const aliveTeams = syncedTeams.filter((t) => !t.eliminated && t.energy > 0);
        if (aliveTeams.length <= 1) {
          setPhase('CHAMPION');
          playRoyaleSFX('victory', soundMuted);
          pushHostStateToServer(
            { phase: 'CHAMPION', teams: syncedTeams },
            clearedPlayers
          );
          return;
        }

        const shuffledTeams = [...aliveTeams].sort(() => Math.random() - 0.5);
        let oddTeam: SumoRoyaleTeam | null = null;
        if (shuffledTeams.length % 2 === 1) {
          oddTeam = shuffledTeams.pop() || null;
        }

        for (let i = 0; i < shuffledTeams.length; i += 2) {
          const leftT = shuffledTeams[i];
          const rightT = shuffledTeams[i + 1];
          newMatchups.push({
            id: `mt-${nextRound}-${i}`,
            leftId: leftT.id,
            rightId: rightT.id,
            isBye: false,
            battlePos: 50,
            leftPushes: 0,
            rightPushes: 0,
            lastPusher: null,
            lastPushAt: 0,
            ringOutWinnerId: null
          });
        }

        if (oddTeam && shuffledTeams.length > 0) {
          const candidates = [...shuffledTeams].sort((a, b) => {
            const aRecent = a.lastByeRound === currentRoundNum ? 1 : 0;
            const bRecent = b.lastByeRound === currentRoundNum ? 1 : 0;
            if (aRecent !== bRecent) return aRecent - bRecent;
            return b.energy - a.energy;
          });
          const doubleTeam = candidates[0];
          doubleTeam.lastByeRound = nextRound;

          newMatchups.push({
            id: `mt-${nextRound}-double`,
            leftId: doubleTeam.id,
            rightId: oddTeam.id,
            isBye: false,
            battlePos: 50,
            leftPushes: 0,
            rightPushes: 0,
            lastPusher: null,
            lastPushAt: 0,
            ringOutWinnerId: null
          });
        }
      }

      setRoundNumber(nextRound);
      setCurrentQuestion(firstQ);
      setRoundQuestionPool(deck);
      setMatchups(newMatchups);
      setPlayers(clearedPlayers);
      setTeams(currentTeamsList);
      setPhase('VS_INTRO');
      playRoyaleSFX('horn', soundMuted);

      pushHostStateToServer(
        {
          phase: 'VS_INTRO',
          roundNumber: nextRound,
          currentQuestion: firstQ,
          questionPool: deck,
          matchups: newMatchups,
          teams: currentTeamsList
        },
        clearedPlayers,
        true
      );
    },
    [buildRoundQuestionDeck, normalizedQuestions, matchType, soundMuted, pushHostStateToServer]
  );

  // Transition from VS_INTRO -> 1-Minute Live Dohyo Arena (QUESTION) after 3.4s
  useEffect(() => {
    if (role !== 'host' || phase !== 'VS_INTRO') return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setRoundStartedAt(now);
      setSecondsLeft(Math.ceil(roundDurationMs / 1000));
      setPhase('QUESTION');
      playRoyaleSFX('taiko', soundMuted);
      pushHostStateToServer({
        phase: 'QUESTION',
        roundStartedAt: now
      });
    }, 3400);
    return () => window.clearTimeout(timer);
  }, [role, phase, roundDurationMs, soundMuted, pushHostStateToServer]);

  // Continuous Dojo Bot tug-of-war pushing during the 1-minute QUESTION arena phase
  useEffect(() => {
    if (role !== 'host' || phase !== 'QUESTION') return;

    const botInterval = window.setInterval(() => {
      if (phaseRef.current !== 'QUESTION') return;

      const currentMatchups = matchupsRef.current;
      const currentPlayers = [...playersRef.current];
      let anyBotPushed = false;

      const updatedPlayers = currentPlayers.map((bot) => {
        if (!bot.isBot || bot.eliminated || bot.energy <= 0) return bot;

        const botContenderId = matchType === 'solo' ? bot.id : bot.teamId;
        const hasActiveBotMatchup = currentMatchups.some(
          (m) =>
            (m.leftId === botContenderId || m.rightId === botContenderId) &&
            !m.isBye &&
            !m.ringOutWinnerId
        );
        if (!hasActiveBotMatchup) {
          return bot;
        }

        // Each tick (every 2.8s), each active bot has a 48% chance to score a correct push
        if (Math.random() < 0.48) {
          anyBotPushed = true;
          return {
            ...bot,
            answeredRound: roundNumberRef.current,
            roundPushes: (bot.roundPushes || 0) + 1,
            correctCount: (bot.correctCount || 0) + 1,
            lastPushAt: Date.now()
          };
        }
        return bot;
      });

      if (anyBotPushed) {
        const nextMatchups = recomputeLiveMatchups(
          currentMatchups,
          updatedPlayers,
          roundNumberRef.current
        );
        setPlayers(updatedPlayers);
        setMatchups(nextMatchups);
        playRoyaleSFX('taiko', soundMuted);
        pushHostStateToServer({ matchups: nextMatchups }, updatedPlayers);
      }
    }, 2800);

    return () => window.clearInterval(botInterval);
  }, [role, phase, matchType, soundMuted, recomputeLiveMatchups, pushHostStateToServer]);

  // Resolve 1-Minute Arena Matchups -> Transition to Winner Showcase (CLASH_RESULT)
  const resolveRoundClashes = useCallback(() => {
    if (role !== 'host' || phaseRef.current !== 'QUESTION') return;

    const currentPlayers = [...playersRef.current];
    const currentTeams = [...teamsRef.current];
    const latestMatchups = recomputeLiveMatchups(
      matchupsRef.current,
      currentPlayers,
      roundNumberRef.current
    );

    const playerMap = new Map<string, SumoRoyalePlayer>();
    currentPlayers.forEach((p) => {
      const pushes = p.answeredRound === roundNumberRef.current ? p.roundPushes || 0 : 0;
      playerMap.set(p.id, {
        ...p,
        correctCount: (p.correctCount || 0) + (p.isBot ? 0 : pushes)
      });
    });

    if (matchType === 'solo') {
      const resolvedMatchups: SumoRoyaleMatchup[] = latestMatchups.map((m) => {
        if (m.isBye || !m.rightId) {
          return { ...m, winnerId: m.leftId, reason: 'bye', battlePos: 50 };
        }
        const leftP = playerMap.get(m.leftId);
        const rightP = playerMap.get(m.rightId);
        if (!leftP || !rightP) return m;

        const leftPushes = m.leftPushes || 0;
        const rightPushes = m.rightPushes || 0;
        const pos = m.battlePos ?? 50;

        let winnerId: string | null = null;
        let loserId: string | null = null;
        let isDraw = false;
        let reason: SumoRoyaleMatchup['reason'] = 'both_idle';

        if (m.ringOutWinnerId) {
          winnerId = m.ringOutWinnerId;
          loserId = winnerId === leftP.id ? rightP.id : leftP.id;
          reason = 'ring_out';
        } else if (pos > 50 || leftPushes > rightPushes) {
          winnerId = leftP.id;
          loserId = rightP.id;
          reason = 'time_dominance';
        } else if (pos < 50 || rightPushes > leftPushes) {
          winnerId = rightP.id;
          loserId = leftP.id;
          reason = 'time_dominance';
        } else if (leftPushes > 0 && leftPushes === rightPushes) {
          // Equal pushes at 1:00 timer expiry: whoever landed the faster/earlier push lead wins
          if ((leftP.lastPushAt || 9999999999999) <= (rightP.lastPushAt || 9999999999999)) {
            winnerId = leftP.id;
            loserId = rightP.id;
          } else {
            winnerId = rightP.id;
            loserId = leftP.id;
          }
          reason = 'faster_push';
        } else {
          isDraw = true;
          reason = 'both_idle';
        }

        if (winnerId) {
          const w = playerMap.get(winnerId);
          if (w) w.wins = (w.wins || 0) + 1;
        }
        if (loserId) {
          const l = playerMap.get(loserId);
          if (l) {
            l.energy = Math.max(0, l.energy - 1);
            if (l.energy <= 0) {
              l.eliminated = true;
              l.eliminatedRound = roundNumberRef.current;
            }
          }
        }

        return {
          ...m,
          winnerId,
          loserId,
          isDraw,
          reason,
          battlePos:
            reason === 'ring_out'
              ? winnerId === leftP.id
                ? 85
                : 15
              : pos
        };
      });

      const nextPlayers = Array.from(playerMap.values());
      // Guarantee at least one contender retains energy > 0 if everyone dropped to 0 simultaneously in a double-arena final
      const survivors = nextPlayers.filter((p) => !p.eliminated && p.energy > 0);
      if (survivors.length === 0 && nextPlayers.length > 0) {
        const roundWinners = resolvedMatchups
          .map((m) => (m.winnerId ? playerMap.get(m.winnerId) : undefined))
          .filter((p): p is SumoRoyalePlayer => Boolean(p));
        const candidates = roundWinners.length > 0 ? roundWinners : nextPlayers;
        const topSurvivor = [...candidates].sort((a, b) => {
          if ((b.roundPushes || 0) !== (a.roundPushes || 0)) {
            return (b.roundPushes || 0) - (a.roundPushes || 0);
          }
          if ((b.wins || 0) !== (a.wins || 0)) {
            return (b.wins || 0) - (a.wins || 0);
          }
          return (b.correctCount || 0) - (a.correctCount || 0);
        })[0];
        if (topSurvivor) {
          topSurvivor.energy = 1;
          topSurvivor.eliminated = false;
          topSurvivor.eliminatedRound = undefined;
        }
      }

      setPlayers(nextPlayers);
      setMatchups(resolvedMatchups);
      setPhase('CLASH_RESULT');
      playRoyaleSFX('clash', soundMuted);
      window.setTimeout(() => playRoyaleSFX('shatter', soundMuted), 240);

      pushHostStateToServer(
        {
          phase: 'CLASH_RESULT',
          matchups: resolvedMatchups
        },
        nextPlayers,
        true
      );
    } else {
      const teamMap = new Map<string, SumoRoyaleTeam>();
      currentTeams.forEach((t) => teamMap.set(t.id, { ...t }));

      const resolvedMatchups: SumoRoyaleMatchup[] = latestMatchups.map((m) => {
        if (m.isBye || !m.rightId) {
          return { ...m, winnerId: m.leftId, reason: 'bye', battlePos: 50 };
        }
        const leftT = teamMap.get(m.leftId);
        const rightT = teamMap.get(m.rightId);
        if (!leftT || !rightT) return m;

        const leftPushes = m.leftPushes || 0;
        const rightPushes = m.rightPushes || 0;
        const pos = m.battlePos ?? 50;

        let winnerId: string | null = null;
        let loserId: string | null = null;
        let isDraw = false;
        let reason: SumoRoyaleMatchup['reason'] = 'both_idle';

        if (m.ringOutWinnerId) {
          winnerId = m.ringOutWinnerId;
          loserId = winnerId === leftT.id ? rightT.id : leftT.id;
          reason = 'ring_out';
        } else if (pos > 50 || leftPushes > rightPushes) {
          winnerId = leftT.id;
          loserId = rightT.id;
          reason = 'time_dominance';
        } else if (pos < 50 || rightPushes > leftPushes) {
          winnerId = rightT.id;
          loserId = leftT.id;
          reason = 'time_dominance';
        } else if (leftPushes > 0 && leftPushes === rightPushes) {
          winnerId = leftT.id;
          loserId = rightT.id;
          reason = 'faster_push';
        } else {
          isDraw = true;
          reason = 'both_idle';
        }

        if (winnerId) {
          const w = teamMap.get(winnerId);
          if (w) w.wins = (w.wins || 0) + 1;
        }
        if (loserId) {
          const l = teamMap.get(loserId);
          if (l) {
            l.energy = Math.max(0, l.energy - 1);
            if (l.energy <= 0) {
              l.eliminated = true;
              l.eliminatedRound = roundNumberRef.current;
            }
          }
        }

        return {
          ...m,
          winnerId,
          loserId,
          isDraw,
          reason,
          battlePos:
            reason === 'ring_out'
              ? winnerId === leftT.id
                ? 85
                : 15
              : pos
        };
      });

      const nextTeams = Array.from(teamMap.values());
      const teamSurvivors = nextTeams.filter((t) => !t.eliminated && t.energy > 0);
      if (teamSurvivors.length === 0 && nextTeams.length > 0) {
        const roundWinners = resolvedMatchups
          .map((m) => (m.winnerId ? teamMap.get(m.winnerId) : undefined))
          .filter((t): t is SumoRoyaleTeam => Boolean(t));
        const candidates = roundWinners.length > 0 ? roundWinners : nextTeams;
        const topTeam = [...candidates].sort((a, b) => (b.wins || 0) - (a.wins || 0))[0];
        if (topTeam) {
          topTeam.energy = 1;
          topTeam.eliminated = false;
          topTeam.eliminatedRound = undefined;
        }
      }

      const nextPlayers = Array.from(playerMap.values()).map((p) => {
        const myTeam = p.teamId ? teamMap.get(p.teamId) : null;
        if (!myTeam) return p;
        return {
          ...p,
          energy: myTeam.energy,
          maxEnergy: myTeam.maxEnergy,
          eliminated: myTeam.eliminated,
          eliminatedRound: myTeam.eliminatedRound
        };
      });

      setTeams(nextTeams);
      setPlayers(nextPlayers);
      setMatchups(resolvedMatchups);
      setPhase('CLASH_RESULT');
      playRoyaleSFX('clash', soundMuted);
      window.setTimeout(() => playRoyaleSFX('shatter', soundMuted), 240);

      pushHostStateToServer(
        {
          phase: 'CLASH_RESULT',
          matchups: resolvedMatchups,
          teams: nextTeams
        },
        nextPlayers,
        true
      );
    }
  }, [role, matchType, soundMuted, recomputeLiveMatchups, pushHostStateToServer]);

  // 1-Minute Countdown Timer & All-Arenas-Ring-Out check during QUESTION phase
  useEffect(() => {
    if (phase !== 'QUESTION') return;

    const tick = () => {
      const elapsed = Date.now() - (roundStartedAt || Date.now());
      const remSec = Math.max(0, Math.ceil((roundDurationMs - elapsed) / 1000));
      setSecondsLeft(remSec);

      if (role === 'host') {
        const activeBouts = matchupsRef.current.filter((m) => !m.isBye && m.rightId);
        const allArenasFinishedByRingOut =
          activeBouts.length > 0 && activeBouts.every((m) => Boolean(m.ringOutWinnerId));

        if (remSec <= 0 || allArenasFinishedByRingOut) {
          resolveRoundClashes();
        }
      }
    };

    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [phase, roundStartedAt, roundDurationMs, role, resolveRoundClashes]);

  // Manual Host "Continue" handler on the Winner Showcase (CLASH_RESULT) screen
  const handleHostContinueAfterWinner = useCallback(() => {
    if (role !== 'host' || phaseRef.current !== 'CLASH_RESULT') return;
    if (matchType === 'solo') {
      const alive = playersRef.current.filter((p) => !p.eliminated && p.energy > 0);
      if (alive.length <= 1) {
        setPhase('CHAMPION');
        playRoyaleSFX('victory', soundMuted);
        pushHostStateToServer({ phase: 'CHAMPION' });
      } else {
        beginNextRound(roundNumberRef.current, playersRef.current, teamsRef.current);
      }
    } else {
      const aliveTeams = teamsRef.current.filter((t) => !t.eliminated && t.energy > 0);
      if (aliveTeams.length <= 1) {
        setPhase('CHAMPION');
        playRoyaleSFX('victory', soundMuted);
        pushHostStateToServer({ phase: 'CHAMPION' });
      } else {
        beginNextRound(roundNumberRef.current, playersRef.current, teamsRef.current);
      }
    }
  }, [role, matchType, soundMuted, beginNextRound, pushHostStateToServer]);

  // ============================================================================
  // HOST ACTIONS: ADD BOT, KICK PLAYER, SHUFFLE TEAMS, START TOURNAMENT, RESET
  // ============================================================================
  const handleAddBot = () => {
    const existingNames = new Set(players.map((p) => p.name));
    const availableNames = BOT_NAMES.filter((n) => !existingNames.has(n));
    const botName =
      availableNames[Math.floor(Math.random() * availableNames.length)] ||
      `Dojo Bot ${players.length + 1}`;
    const randomChar =
      SUMO_CHARACTER_OPTIONS[
        Math.floor(Math.random() * SUMO_CHARACTER_OPTIONS.length)
      ].id;

    const newBot: SumoRoyalePlayer = {
      id: `bot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: botName,
      character: randomChar,
      energy: startingEnergy,
      maxEnergy: startingEnergy,
      eliminated: false,
      wins: 0,
      correctCount: 0,
      totalTimeMs: 0,
      roundPushes: 0,
      roundWrong: 0,
      isBot: true
    };

    const nextList = [...players, newBot];
    if (matchType === 'teams') {
      const { updatedPlayers, updatedTeams } = computeAutoBalancedTeams(
        nextList,
        startingEnergy,
        false
      );
      setPlayers(updatedPlayers);
      setTeams(updatedTeams);
      pushHostStateToServer({ teams: updatedTeams }, updatedPlayers);
    } else {
      setPlayers(nextList);
      pushHostStateToServer(undefined, nextList);
    }
    playRoyaleSFX('lock', soundMuted);
  };

  const handleKickPlayer = async (targetId: string) => {
    const nextList = players.filter((p) => p.id !== targetId);
    setPlayers(nextList);
    try {
      await fetch(
        `/api/sumo/room/${encodeURIComponent(roomCode)}/player/${encodeURIComponent(targetId)}`,
        { method: 'DELETE' }
      );
    } catch {}
    if (matchType === 'teams') {
      const { updatedPlayers, updatedTeams } = computeAutoBalancedTeams(
        nextList,
        startingEnergy,
        false
      );
      setPlayers(updatedPlayers);
      setTeams(updatedTeams);
      pushHostStateToServer({ teams: updatedTeams }, updatedPlayers, true);
    } else {
      pushHostStateToServer(undefined, nextList, true);
    }
  };

  const handleShuffleTeams = () => {
    const { updatedPlayers, updatedTeams } = computeAutoBalancedTeams(
      players,
      startingEnergy,
      true
    );
    setPlayers(updatedPlayers);
    setTeams(updatedTeams);
    pushHostStateToServer({ teams: updatedTeams }, updatedPlayers, true);
    playRoyaleSFX('lock', soundMuted);
  };

  const handleStartTournament = () => {
    let workingPlayers = [...players];
    while (workingPlayers.length < 2) {
      const botChar =
        SUMO_CHARACTER_OPTIONS[
          workingPlayers.length % SUMO_CHARACTER_OPTIONS.length
        ].id;
      workingPlayers.push({
        id: `bot_auto_${Date.now()}_${workingPlayers.length}`,
        name: BOT_NAMES[workingPlayers.length % BOT_NAMES.length],
        character: botChar,
        energy: startingEnergy,
        maxEnergy: startingEnergy,
        eliminated: false,
        wins: 0,
        correctCount: 0,
        totalTimeMs: 0,
        roundPushes: 0,
        roundWrong: 0,
        isBot: true
      });
    }

    workingPlayers = workingPlayers.map((p) => ({
      ...p,
      energy: startingEnergy,
      maxEnergy: startingEnergy,
      eliminated: false,
      eliminatedRound: undefined,
      wins: 0,
      correctCount: 0,
      totalTimeMs: 0,
      roundPushes: 0,
      roundWrong: 0,
      lastByeRound: undefined
    }));

    let workingTeams = [...teams];
    if (matchType === 'teams') {
      const balanced = computeAutoBalancedTeams(workingPlayers, startingEnergy, false);
      workingPlayers = balanced.updatedPlayers;
      workingTeams = balanced.updatedTeams;
    }

    beginNextRound(0, workingPlayers, workingTeams);
  };

  const handlePlayAgainInSameRoom = () => {
    const resetPlayers = players.map((p) => ({
      ...p,
      energy: startingEnergy,
      maxEnergy: startingEnergy,
      eliminated: false,
      eliminatedRound: undefined,
      wins: 0,
      correctCount: 0,
      totalTimeMs: 0,
      answeredRound: 0,
      roundPushes: 0,
      roundWrong: 0,
      lastPushAt: 0,
      answerIndex: null,
      answerTimeMs: null,
      isCorrect: null
    }));
    let resetTeams: SumoRoyaleTeam[] = teams.map((t) => ({
      ...t,
      energy: startingEnergy,
      maxEnergy: startingEnergy,
      eliminated: false,
      eliminatedRound: undefined,
      wins: 0
    }));
    if (matchType === 'teams') {
      const balanced = computeAutoBalancedTeams(resetPlayers, startingEnergy, false);
      setPlayers(balanced.updatedPlayers);
      resetTeams = balanced.updatedTeams;
      setTeams(resetTeams);
    } else {
      setPlayers(resetPlayers);
    }
    setMatchups([]);
    setRoundNumber(0);
    setPhase('LOBBY');
    pushHostStateToServer(
      {
        phase: 'LOBBY',
        roundNumber: 0,
        matchups: [],
        teams: resetTeams
      },
      resetPlayers,
      true
    );
  };

  // ============================================================================
  // STUDENT ACTIONS: JOIN ROOM, CHANGE CHARACTER, CONTINUOUS ARENA PUSH ANSWER
  // ============================================================================
  const handleStudentJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = studentName.trim();
    const cleanCode = studentRoomInput.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6);

    if (!cleanName) {
      setJoinError('Please enter your nickname to enter the Dojo!');
      return;
    }
    if (!cleanCode || cleanCode.length < 6) {
      setJoinError('Please enter the 6-character Game ID from your teacher.');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      localStorage.setItem('sumo_saved_nickname', cleanName);
      localStorage.setItem('paintball_saved_nickname', cleanName);
    } catch {}

    try {
      const res = await fetch(`/api/sumo/room/${encodeURIComponent(cleanCode)}/player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: {
            id: studentId,
            name: cleanName,
            character: studentCharacter
          }
        })
      });

      if (!res.ok) {
        let existsInFirestore = false;
        if (!isFirestoreQuotaExhausted()) {
          try {
            const snap = await getDoc(doc(db, 'ttt_rooms', `sumo_room_${cleanCode}`));
            existsInFirestore = Boolean(
              snap.exists() && !snap.data()?.hostClosed && !snap.data()?.isUninitialized
            );
          } catch {}
        }
        if (!existsInFirestore) {
          setJoinError(
            `Game ID "${cleanCode}" was not found. Make sure your teacher clicked Host Now!`
          );
          setIsJoining(false);
          return;
        }
      } else {
        const data = await res.json();
        if (data?.room) {
          setPhase(data.room.phase || 'LOBBY');
          setMatchType(data.room.matchType || 'solo');
          setStartingEnergy(data.room.startingEnergy || 5);
          setRoundNumber(data.room.roundNumber || 0);
          setCurrentQuestion(data.room.currentQuestion || null);
          if (Array.isArray(data.room.questionPool) && data.room.questionPool.length > 0) {
            setRoundQuestionPool(data.room.questionPool);
          }
          setMatchups(Array.isArray(data.room.matchups) ? data.room.matchups : []);
          setTeams(Array.isArray(data.room.teams) ? data.room.teams : []);
        }
        if (Array.isArray(data?.players)) {
          setPlayers(data.players.filter((p: any) => !p.kicked));
        }
      }

      setRoomCode(cleanCode);
      setHasJoinedRoom(true);
      playRoyaleSFX('lock', soundMuted);
    } catch {
      setJoinError('Could not connect to the Dojo server. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleStudentCharacterChange = async (newChar: SumoCharacterType) => {
    setStudentCharacter(newChar);
    if (!hasJoinedRoom) return;
    try {
      await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}/player`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player: {
            id: studentId,
            name: studentName.trim(),
            character: newChar
          }
        })
      });
    } catch {}
  };

  // Continuous 1-minute tug-of-war answer handler on Student Arena screen
  const handleStudentArenaAnswer = async (
    optIndex: number,
    activeQ: SumoRoyaleQuestion,
    myMatchupsList: SumoRoyaleMatchup[],
    myContenderId: string | null,
    canPlay: boolean
  ) => {
    const hasOpenBout = myMatchupsList.some((m) => !m.isBye && !m.ringOutWinnerId);
    if (
      phase !== 'QUESTION' ||
      studentStunned ||
      !canPlay ||
      !myContenderId ||
      !hasOpenBout
    ) {
      return;
    }

    const isCorrect = optIndex === activeQ.answerIndex;
    const now = Date.now();

    if (isCorrect) {
      const nextStreak = studentStreak + 1;
      const unlocksShield = nextStreak === 3;
      const nextShield = studentShield || unlocksShield;
      // Combo push power: 1x = +1 push, 2x = +2 pushes (Tsuppari Heavy Push), 3x = +2 pushes + Shield, 4x+ = +3 pushes (Yokozuna Fury)
      const pushGain = nextStreak >= 4 ? 3 : nextStreak >= 2 ? 2 : 1;
      const nextPushes = studentLocalPushes + pushGain;

      setStudentStreak(nextStreak);
      setStudentShield(nextShield);
      setStudentLocalPushes(nextPushes);
      setStudentPushingAnim(true);
      setStudentLastFeedback('correct');
      setStudentQuestionIdx((idx) => idx + 1);

      if (nextStreak >= 4) {
        playRoyaleSFX('heavy', soundMuted);
        setStudentPowerCallout(`⚡ ${nextStreak}x YOKOZUNA SHOCKWAVE FURY! (+3 PUSHES!)`);
      } else if (nextStreak === 3) {
        playRoyaleSFX('heavy', soundMuted);
        setStudentPowerCallout('🛡️ 3x STREAK! 2X HEAVY PUSH + IRON MAWASHI SHIELD!');
      } else if (nextStreak === 2) {
        playRoyaleSFX('combo', soundMuted);
        setStudentPowerCallout('🔥 2x COMBO! TSUPPARI HEAVY PUSH (+2 PUSHES!)');
      } else {
        playRoyaleSFX('taiko', soundMuted);
        setStudentPowerCallout(null);
      }

      window.setTimeout(() => {
        setStudentPushingAnim(false);
        setStudentLastFeedback(null);
      }, 450);

      // Optimistic local arena battlePos update across all active arenas this contender is fighting in
      const myMatchupIds = new Set(
        myMatchupsList
          .filter((m) => !m.isBye && !m.ringOutWinnerId)
          .map((m) => m.id)
      );
      if (myMatchupIds.size > 0) {
        setMatchups((prev) =>
          prev.map((m) => {
            if (!myMatchupIds.has(m.id) || m.ringOutWinnerId) return m;
            const isLeftInBout = m.leftId === myContenderId;
            const nextLeft = isLeftInBout ? (m.leftPushes || 0) + pushGain : m.leftPushes || 0;
            const nextRight = !isLeftInBout ? (m.rightPushes || 0) + pushGain : m.rightPushes || 0;
            const rawPos = 50 + (nextLeft - nextRight) * PUSH_STEP_PERCENT;
            const clamped = Math.max(15, Math.min(85, rawPos));
            const ringOutWinnerId =
              clamped >= 84 ? m.leftId : clamped <= 16 ? m.rightId : null;
            return {
              ...m,
              leftPushes: nextLeft,
              rightPushes: nextRight,
              battlePos: ringOutWinnerId
                ? ringOutWinnerId === m.leftId
                  ? 85
                  : 15
                : clamped,
              lastPusher: isLeftInBout ? 'left' : 'right',
              lastPushAt: now,
              ringOutWinnerId
            };
          })
        );
      }

      try {
        await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}/player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: {
              id: studentId,
              name: studentName.trim(),
              character: studentCharacter,
              answeredRound: roundNumber,
              roundPushes: nextPushes,
              roundWrong: studentLocalWrong,
              lastPushAt: now,
              streak: nextStreak,
              shield: nextShield
            }
          })
        });
      } catch {}
    } else {
      // Wrong answer: if Iron Mawashi Shield is active, absorb the stun penalty!
      const nextWrong = studentLocalWrong + 1;
      setStudentLocalWrong(nextWrong);
      setStudentStreak(0);

      if (studentShield) {
        setStudentShield(false);
        setStudentPowerCallout('🛡️ IRON MAWASHI SHIELD ABSORBED THE STUN!');
        setStudentQuestionIdx((idx) => idx + 1);
        playRoyaleSFX('shield', soundMuted);
        window.setTimeout(() => {
          setStudentPowerCallout(null);
        }, 1200);
      } else {
        setStudentStunned(true);
        setStudentLastFeedback('wrong');
        setStudentPowerCallout(null);
        playRoyaleSFX('stun', soundMuted);

        window.setTimeout(() => {
          setStudentStunned(false);
          setStudentLastFeedback(null);
          setStudentQuestionIdx((idx) => idx + 1);
        }, 1350);
      }

      try {
        await fetch(`/api/sumo/room/${encodeURIComponent(roomCode)}/player`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: {
              id: studentId,
              name: studentName.trim(),
              character: studentCharacter,
              answeredRound: roundNumber,
              roundPushes: studentLocalPushes,
              roundWrong: nextWrong,
              streak: 0,
              shield: false
            }
          })
        });
      } catch {}
    }
  };

  // Construct join link for QR code and Copy button
  const joinUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?game=sumo&room=${roomCode}`
      : `https://play.eslgamestudio.com/?game=sumo&room=${roomCode}`;

  const displayHostDomain =
    typeof window !== 'undefined' ? window.location.host : 'play.eslgamestudio.com';

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch {}
  };

  // Lookup helper for contenders (either Player in Solo mode or Team in Teams mode)
  const getContenderDisplay = (contenderId?: string | null) => {
    if (!contenderId) return null;
    if (matchType === 'solo') {
      const p = players.find((pl) => pl.id === contenderId);
      if (!p) return null;
      const isMe = role === 'student' && p.id === studentId;
      return {
        id: p.id,
        name: p.name,
        character: p.character,
        energy: p.energy,
        maxEnergy: p.maxEnergy,
        eliminated: p.eliminated,
        pushes: p.answeredRound === roundNumber ? p.roundPushes || 0 : 0,
        streak: isMe ? studentStreak : (p.answeredRound === roundNumber ? p.streak || 0 : 0),
        shield: isMe ? studentShield : Boolean(p.answeredRound === roundNumber && p.shield),
        subLabel: p.isBot ? 'Dojo Bot' : 'Fighter'
      };
    } else {
      const t = teams.find((tm) => tm.id === contenderId);
      if (!t) return null;
      const members = players.filter((p) => p.teamId === t.id && !p.kicked);
      const pushes = members.reduce(
        (sum, m) => sum + (m.answeredRound === roundNumber ? m.roundPushes || 0 : 0),
        0
      );
      const maxStreak = members.reduce(
        (mx, m) =>
          Math.max(
            mx,
            role === 'student' && m.id === studentId
              ? studentStreak
              : m.answeredRound === roundNumber
              ? m.streak || 0
              : 0
          ),
        0
      );
      const anyShield = members.some((m) =>
        role === 'student' && m.id === studentId
          ? studentShield
          : Boolean(m.answeredRound === roundNumber && m.shield)
      );
      return {
        id: t.id,
        name: t.name,
        character: t.character,
        energy: t.energy,
        maxEnergy: t.maxEnergy,
        eliminated: t.eliminated,
        pushes,
        streak: maxStreak,
        shield: anyShield,
        subLabel: `${members.length} Fighter${members.length === 1 ? '' : 's'}`
      };
    }
  };

  // ============================================================================
  // RENDER 1: STUDENT JOIN, LIVE 1-MINUTE DOHYO ARENA & WINNER SHOWCASE
  // ============================================================================
  if (role === 'student') {
    const me = players.find((p) => p.id === studentId);
    const myContenderId = matchType === 'solo' ? studentId : me?.teamId || null;
    const myMatchups = matchups.filter(
      (m) => m.leftId === myContenderId || m.rightId === myContenderId
    );
    const isDoubleArena = myMatchups.length > 1;
    const myMatchup = myMatchups[0];
    const amILeft = myMatchup ? myMatchup.leftId === myContenderId : true;
    const myContender = getContenderDisplay(myContenderId);
    const canStudentPlay = Boolean(
      myContender && !myContender.eliminated && myContender.energy > 0
    );
    const opponentId = myMatchup
      ? amILeft
        ? myMatchup.rightId
        : myMatchup.leftId
      : null;
    const opponentContender = getContenderDisplay(opponentId);

    const leftFighter = amILeft ? myContender : opponentContender;
    const rightFighter = amILeft ? opponentContender : myContender;

    // 1A. Student Pre-Join Screen
    if (!hasJoinedRoom) {
      return (
        <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-red-950 to-amber-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden">
          <div className="w-full max-w-lg bg-white text-slate-900 rounded-[2rem] shadow-2xl border-4 border-amber-400 overflow-hidden relative z-10">
            <div className="bg-gradient-to-r from-red-900 via-rose-800 to-amber-700 border-b-4 border-amber-400 px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow border-2 border-white">
                  <Swords className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase tracking-widest text-amber-200">
                    Imperial Dojo Showdown
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                    Sumo Royale
                  </h1>
                </div>
              </div>
              <button
                onClick={onExit}
                className="p-2 rounded-xl bg-black/25 hover:bg-black/40 text-white cursor-pointer"
                title="Exit"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStudentJoin} className="p-6 space-y-5">
              {joinError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-700 text-xs sm:text-sm font-bold text-center">
                  {joinError}
                </div>
              )}

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Dojo Game ID (6 Digits)
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={studentRoomInput}
                  onChange={(e) =>
                    setStudentRoomInput(
                      e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
                    )
                  }
                  placeholder="800803"
                  className="w-full px-4 py-3 text-2xl font-black tracking-widest text-center uppercase rounded-2xl border-2 border-amber-300 focus:border-rose-600 focus:outline-none bg-amber-50/50 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-1.5">
                  Your Sumo Nickname
                </label>
                <input
                  type="text"
                  maxLength={18}
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-4 py-3 text-lg font-black rounded-2xl border-2 border-slate-300 focus:border-rose-600 focus:outline-none bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                  Pick Your Sumo Fighter
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SUMO_CHARACTER_OPTIONS.map((opt) => {
                    const selected = studentCharacter === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setStudentCharacter(opt.id)}
                        className={`p-2 rounded-2xl border-2 border-b-4 flex flex-col items-center transition-all cursor-pointer ${
                          selected
                            ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 border-amber-200 border-b-orange-700 -translate-y-0.5 shadow-md'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-800 border-slate-200 border-b-slate-300'
                        }`}
                      >
                        <div className="scale-75 -my-2">
                          <SumoCharacter team="left" character={opt.id} size="card" />
                        </div>
                        <span className="text-[11px] font-black uppercase truncate w-full text-center mt-1">
                          {opt.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={isJoining}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 active:translate-y-0.5 text-white font-black text-xl uppercase tracking-wider border-b-[6px] border-red-900 shadow-lg transition-all cursor-pointer"
              >
                {isJoining ? 'Entering Dojo...' : '⚔️ Enter Dojo Showdown'}
              </button>
            </form>
          </div>
        </div>
      );
    }

    // 1B. Student Waiting Lobby
    if (phase === 'LOBBY' || phase === 'SETTINGS') {
      const myTeam =
        matchType === 'teams' && me?.teamId
          ? teams.find((t) => t.id === me.teamId)
          : null;

      return (
        <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-red-950 to-amber-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none">
          <div className="flex items-center justify-between bg-gradient-to-r from-red-900 via-rose-800 to-amber-700 border-b-4 border-amber-400 px-5 py-3.5 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2.5">
              <span className="font-black text-sm sm:text-base uppercase tracking-wider">
                Dojo ID: {roomCode}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <EnergyBar
                energy={me?.energy ?? startingEnergy}
                maxEnergy={me?.maxEnergy ?? startingEnergy}
                side="left"
                size="sm"
              />
              <button
                onClick={onExit}
                className="p-2 rounded-xl bg-black/25 hover:bg-black/40 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="my-auto flex flex-col items-center text-center max-w-md mx-auto w-full bg-white text-slate-900 rounded-[2rem] p-6 shadow-2xl border-4 border-amber-400">
            <div className="text-xs font-black uppercase tracking-widest text-rose-600 mb-1">
              {matchType === 'teams' ? 'Dojo Squad Battle Royale' : 'Solo 1v1 Battle Royale'}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">
              {me?.name || studentName}
            </h2>

            {myTeam && (
              <div className="mb-3 px-4 py-1.5 rounded-xl bg-amber-100 border-2 border-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider">
                Squad: {myTeam.name}
              </div>
            )}

            <div className="my-2 p-4 rounded-3xl bg-gradient-to-b from-amber-50 to-orange-50 border-2 border-amber-300">
              <SumoCharacter team="left" character={studentCharacter} compact />
            </div>

            <div className="my-3">
              <EnergyBar
                energy={me?.energy ?? startingEnergy}
                maxEnergy={me?.maxEnergy ?? startingEnergy}
                side="left"
                size="md"
              />
            </div>

            <p className="text-xs font-bold text-slate-500 mb-3">
              Switch your Sumo Fighter while waiting for the host:
            </p>
            <div className="grid grid-cols-3 gap-2 w-full">
              {SUMO_CHARACTER_OPTIONS.map((opt) => {
                const active = studentCharacter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleStudentCharacterChange(opt.id)}
                    className={`px-2 py-2 rounded-xl border-2 font-black text-[11px] uppercase truncate cursor-pointer transition-all ${
                      active
                        ? 'bg-rose-600 text-white border-rose-800 shadow-sm'
                        : 'bg-slate-100 hover:bg-amber-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-center font-black text-amber-300 text-base sm:text-lg drop-shadow">
            Waiting for teacher to start the 1-Minute Dohyo Arena... ({players.length} in Dojo)
          </div>
        </div>
      );
    }

    // 1C. Student VS_INTRO Screen
    if (phase === 'VS_INTRO') {
      return (
        <div className="w-full min-h-full flex-1 relative overflow-hidden bg-slate-950 flex flex-col justify-between p-4 sm:p-6 select-none text-white">
          <div className="absolute inset-0 flex pointer-events-none">
            <div className="w-1/2 h-full bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-950" />
            <div className="w-1/2 h-full bg-gradient-to-bl from-orange-500 via-amber-600 to-red-800" />
          </div>

          <div className="relative z-10 text-center pt-2">
            <div className="inline-block px-5 py-1.5 rounded-2xl bg-amber-400 text-slate-950 font-black text-sm uppercase tracking-widest border-2 border-white shadow-lg">
              Round {roundNumber} •{' '}
              {isDoubleArena
                ? 'Double-Arena Challenger (2 Simultaneous Bouts!)'
                : '1:00 Live Dohyo Match'}
            </div>
          </div>

          {!canStudentPlay ? (
            <div className="relative z-10 my-auto max-w-md mx-auto bg-slate-900/90 border-4 border-rose-500 rounded-3xl p-6 text-center shadow-2xl">
              <Eye className="w-12 h-12 text-amber-400 mx-auto mb-2" />
              <h2 className="text-2xl font-black uppercase mb-1">
                Out of Energy — Eliminated
              </h2>
              <p className="text-sm text-slate-300 font-semibold">
                Your fighter has 0 energy and cannot play anymore. Spectate the remaining Dohyo battles!
              </p>
            </div>
          ) : isDoubleArena ? (
            <div className="relative z-10 my-auto grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto w-full">
              {myMatchups.map((m, bIdx) => {
                const bLeft = getContenderDisplay(m.leftId);
                const bRight = getContenderDisplay(m.rightId);
                return (
                  <div
                    key={m.id}
                    className="bg-slate-900/90 border-4 border-amber-400 rounded-3xl p-4 shadow-2xl flex flex-col items-center"
                  >
                    <div className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest mb-3">
                      Arena {bIdx + 1} of {myMatchups.length}
                    </div>
                    <div className="grid grid-cols-11 items-center gap-2 w-full">
                      <div className="col-span-5 flex flex-col items-center">
                        <div className="bg-[#0055fe] border border-white px-2.5 py-0.5 rounded-lg font-black text-xs uppercase truncate max-w-full mb-1.5">
                          {bLeft?.name || 'Blue'} {m.leftId === myContenderId ? '(YOU)' : ''}
                        </div>
                        <SumoCharacter
                          team="left"
                          character={bLeft?.character || studentCharacter}
                          size="card"
                        />
                        <div className="mt-1.5">
                          <EnergyBar
                            energy={bLeft?.energy ?? startingEnergy}
                            maxEnergy={bLeft?.maxEnergy ?? startingEnergy}
                            side="left"
                            size="sm"
                          />
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black italic text-base flex items-center justify-center border-2 border-white">
                          VS
                        </div>
                      </div>
                      <div className="col-span-5 flex flex-col items-center">
                        <div className="bg-[#cc0000] border border-white px-2.5 py-0.5 rounded-lg font-black text-xs uppercase truncate max-w-full mb-1.5">
                          {bRight?.name || 'Red'} {m.rightId === myContenderId ? '(YOU)' : ''}
                        </div>
                        <SumoCharacter
                          team="right"
                          character={bRight?.character || 'panda'}
                          size="card"
                        />
                        <div className="mt-1.5">
                          <EnergyBar
                            energy={bRight?.energy ?? startingEnergy}
                            maxEnergy={bRight?.maxEnergy ?? startingEnergy}
                            side="right"
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative z-10 my-auto grid grid-cols-1 sm:grid-cols-11 items-center gap-4 max-w-4xl mx-auto w-full">
              <div className="sm:col-span-5 flex flex-col items-center">
                <div className="bg-[#0055fe] border-2 border-white px-5 py-1 rounded-xl font-black text-base sm:text-lg uppercase tracking-wide shadow-md -rotate-2 mb-3">
                  {leftFighter?.name || 'Blue Fighter'}{' '}
                  {amILeft ? '(YOU)' : ''}
                </div>
                <div className="p-4 rounded-3xl bg-slate-900/80 border-4 border-blue-400 shadow-[0_10px_30px_rgba(59,130,246,0.5)] -rotate-2">
                  <SumoCharacter
                    team="left"
                    character={leftFighter?.character || studentCharacter}
                    compact
                  />
                </div>
                <div className="mt-3">
                  <EnergyBar
                    energy={leftFighter?.energy ?? startingEnergy}
                    maxEnergy={leftFighter?.maxEnergy ?? startingEnergy}
                    side="left"
                    size="lg"
                  />
                </div>
              </div>

              <div className="sm:col-span-1 flex items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 border-4 border-white shadow-2xl flex items-center justify-center font-black italic text-3xl text-slate-950 rotate-3">
                  VS
                </div>
              </div>

              <div className="sm:col-span-5 flex flex-col items-center">
                <div className="bg-[#cc0000] border-2 border-white px-5 py-1 rounded-xl font-black text-base sm:text-lg uppercase tracking-wide shadow-md rotate-2 mb-3">
                  {rightFighter?.name || 'Red Fighter'}{' '}
                  {!amILeft ? '(YOU)' : ''}
                </div>
                <div className="p-4 rounded-3xl bg-slate-900/80 border-4 border-red-400 shadow-[0_10px_30px_rgba(239,68,68,0.5)] rotate-2">
                  <SumoCharacter
                    team="right"
                    character={rightFighter?.character || 'panda'}
                    compact
                  />
                </div>
                <div className="mt-3">
                  <EnergyBar
                    energy={rightFighter?.energy ?? startingEnergy}
                    maxEnergy={rightFighter?.maxEnergy ?? startingEnergy}
                    side="right"
                    size="lg"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="relative z-10 text-center font-black text-amber-300 uppercase tracking-widest text-sm">
            1-Minute Live Dohyo Tug-of-War! Answer Fast to Push Your Opponent Out!
          </div>
        </div>
      );
    }

    // 1D. Student LIVE-ACTION SUMO DOHYO ARENA Screen (1-Minute Match)
    if (phase === 'QUESTION') {
      const activePool =
        roundQuestionPool.length > 0 ? roundQuestionPool : normalizedQuestions;
      const activeQ =
        activePool[studentQuestionIdx % activePool.length] ||
        currentQuestion ||
        normalizedQuestions[0];

      const parsedQ = parseOptionContent(activeQ?.text || '');
      const qImg = activeQ?.image || parsedQ.imageUrl;
      const qText = activeQ?.image
        ? activeQ.text
        : parsedQ.text || activeQ?.text || '';

      // If spectator, show live arena spectator view of the first active matchup
      const displayMatchup =
        canStudentPlay && myMatchup && !myMatchup.isBye
          ? myMatchup
          : matchups.find((m) => !m.isBye && m.rightId) || myMatchup;

      const arenaLeft = displayMatchup
        ? getContenderDisplay(displayMatchup.leftId)
        : leftFighter;
      const arenaRight = displayMatchup
        ? getContenderDisplay(displayMatchup.rightId)
        : rightFighter;

      const liveBattlePos = displayMatchup?.battlePos ?? 50;
      const ringOutWinnerName = displayMatchup?.ringOutWinnerId
        ? displayMatchup.ringOutWinnerId === displayMatchup.leftId
          ? arenaLeft?.name || 'Blue Team'
          : arenaRight?.name || 'Red Team'
        : null;

      const allMyArenasFinished =
        myMatchups.length > 0 && myMatchups.every((m) => Boolean(m.ringOutWinnerId));

      const recentPushAge = Date.now() - (displayMatchup?.lastPushAt || 0);
      const isLeftPushingNow =
        (amILeft && studentPushingAnim) ||
        (displayMatchup?.lastPusher === 'left' && recentPushAge < 650);
      const isRightPushingNow =
        (!amILeft && studentPushingAnim) ||
        (displayMatchup?.lastPusher === 'right' && recentPushAge < 650);

      const mySideTheme = amILeft
        ? {
            deckBg: 'bg-[#0055fe] border-[#0038b3]',
            btnHover: 'hover:bg-blue-50',
            label: 'BLUE SIDE (YOU)'
          }
        : {
            deckBg: 'bg-[#cc0000] border-[#990000]',
            btnHover: 'hover:bg-red-50',
            label: 'RED SIDE (YOU)'
          };

      return (
        <div className="w-full h-full min-h-screen flex-1 relative overflow-hidden select-none">
          <SumoStadiumEnvironment
            battlePos={liveBattlePos}
            winner={isDoubleArena ? null : ringOutWinnerName}
            isRumbling={isLeftPushingNow || isRightPushingNow}
          >
            {/* TOP BAR: Fighter Banners + 1:00 Match Countdown */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 px-1 sm:px-3 pt-1 z-30 shrink-0">
              <button
                type="button"
                onClick={onExit}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md border border-amber-900/15 cursor-pointer"
                title="Leave Game"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              {isDoubleArena && canStudentPlay ? (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <div className="bg-slate-900/95 border-2 border-amber-400 rounded-2xl px-3 py-1 flex items-center gap-2 shadow-lg">
                    <SumoCharacter
                      team={amILeft ? 'left' : 'right'}
                      character={myContender?.character || studentCharacter}
                      size="icon"
                    />
                    <div className="text-left">
                      <div className="font-black text-xs sm:text-sm text-white uppercase">
                        {myContender?.name || studentName} • 2 Arenas
                      </div>
                      <div className="text-[10px] font-black text-amber-300 uppercase">
                        Each Push Powers Both Arenas!
                      </div>
                    </div>
                    <EnergyBar
                      energy={myContender?.energy ?? startingEnergy}
                      maxEnergy={myContender?.maxEnergy ?? startingEnergy}
                      side="left"
                      size="sm"
                    />
                  </div>

                  <div className="px-3.5 py-1.5 rounded-2xl bg-slate-950/90 border-2 border-amber-400 text-amber-300 font-black text-sm sm:text-lg tabular-nums shadow-xl flex items-center gap-1.5">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <span>{formatMatchTimer(secondsLeft)}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  {/* LEFT (BLUE) FIGHTER BANNER */}
                  <div className="bg-[#0055fe] rounded-2xl sm:rounded-3xl px-2.5 sm:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2.5 shadow-lg border-b-4 border-[#0038b3]">
                    <div className="bg-white/95 rounded-full p-0.5 shadow-xs">
                      <SumoCharacter
                        team="left"
                        character={arenaLeft?.character || 'rikishi'}
                        size="icon"
                      />
                    </div>
                    <div className="text-left">
                      <div className="font-black italic text-xs sm:text-base text-white uppercase tracking-wide truncate max-w-[110px] sm:max-w-[160px]">
                        {arenaLeft?.name || 'Blue Fighter'}
                      </div>
                      <div className="text-[10px] font-black text-blue-100 uppercase">
                        {displayMatchup?.leftPushes || 0} Pushes
                      </div>
                    </div>
                    <EnergyBar
                      energy={arenaLeft?.energy ?? startingEnergy}
                      maxEnergy={arenaLeft?.maxEnergy ?? startingEnergy}
                      side="left"
                      size="sm"
                    />
                  </div>

                  {/* 1-MINUTE MATCH COUNTDOWN TIMER */}
                  <div className="px-3.5 py-1.5 rounded-2xl bg-slate-950/90 border-2 border-amber-400 text-amber-300 font-black text-sm sm:text-lg tabular-nums shadow-xl flex items-center gap-1.5">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    <span>{formatMatchTimer(secondsLeft)}</span>
                  </div>

                  {/* RIGHT (RED) FIGHTER BANNER */}
                  <div className="bg-[#cc0000] rounded-2xl sm:rounded-3xl px-2.5 sm:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2.5 shadow-lg border-b-4 border-[#990000]">
                    <EnergyBar
                      energy={arenaRight?.energy ?? startingEnergy}
                      maxEnergy={arenaRight?.maxEnergy ?? startingEnergy}
                      side="right"
                      size="sm"
                    />
                    <div className="text-right">
                      <div className="font-black italic text-xs sm:text-base text-white uppercase tracking-wide truncate max-w-[110px] sm:max-w-[160px]">
                        {arenaRight?.name || 'Red Fighter'}
                      </div>
                      <div className="text-[10px] font-black text-red-100 uppercase">
                        {displayMatchup?.rightPushes || 0} Pushes
                      </div>
                    </div>
                    <div className="bg-white/95 rounded-full p-0.5 shadow-xs">
                      <SumoCharacter
                        team="right"
                        character={arenaRight?.character || 'panda'}
                        size="icon"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSoundMuted((m) => !m)}
                className="p-2 rounded-full bg-white/90 hover:bg-white text-slate-700 shadow-md cursor-pointer"
                title={soundMuted ? 'Unmute' : 'Mute'}
              >
                {soundMuted ? (
                  <VolumeX className="w-5 h-5 text-rose-500" />
                ) : (
                  <Volume2 className="w-5 h-5 text-emerald-600" />
                )}
              </button>
            </div>

            {/* CENTER: LIVE-ACTION CIRCULAR SUMO DOHYO ARENA(S) + QUESTION CARD */}
            <div className="flex-1 w-full max-w-[1380px] mx-auto flex flex-col items-center justify-center relative min-h-[190px] sm:min-h-[250px] overflow-visible">
              {isDoubleArena && canStudentPlay ? (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-2.5 px-2 items-center">
                  {myMatchups.map((m, idx) => {
                    const bLeft = getContenderDisplay(m.leftId);
                    const bRight = getContenderDisplay(m.rightId);
                    const bPos = m.battlePos ?? 50;
                    const bLeftIsMe = m.leftId === myContenderId;
                    const bAge = Date.now() - (m.lastPushAt || 0);
                    const bLeftPushing =
                      (bLeftIsMe && studentPushingAnim) ||
                      (m.lastPusher === 'left' && bAge < 650);
                    const bRightPushing =
                      (!bLeftIsMe && studentPushingAnim) ||
                      (m.lastPusher === 'right' && bAge < 650);
                    const bRingOutName = m.ringOutWinnerId
                      ? m.ringOutWinnerId === m.leftId
                        ? bLeft?.name || 'Blue'
                        : bRight?.name || 'Red'
                      : null;

                    return (
                      <div
                        key={m.id}
                        className="bg-slate-950/35 backdrop-blur-xs rounded-2xl border-2 border-amber-400/70 px-2 pt-1.5 pb-1 shadow-lg flex flex-col items-center"
                      >
                        <div className="w-full flex items-center justify-between gap-1 px-1 mb-0.5">
                          <div className="bg-[#0055fe] text-white px-2 py-0.5 rounded-lg font-black text-[10px] sm:text-xs uppercase truncate max-w-[42%]">
                            {bLeft?.name || 'Blue'} ({m.leftPushes || 0})
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                            Arena {idx + 1}
                          </span>
                          <div className="bg-[#cc0000] text-white px-2 py-0.5 rounded-lg font-black text-[10px] sm:text-xs uppercase truncate max-w-[42%]">
                            {bRight?.name || 'Red'} ({m.rightPushes || 0})
                          </div>
                        </div>
                        <CircularSumoArena
                          battlePos={bPos}
                          winner={bRingOutName}
                          isRumbling={bLeftPushing || bRightPushing}
                          leftPushing={bLeftPushing}
                          rightPushing={bRightPushing}
                          leftStunned={bLeftIsMe && studentStunned}
                          rightStunned={!bLeftIsMe && studentStunned}
                          leftCharacter={bLeft?.character || 'rikishi'}
                          rightCharacter={bRight?.character || 'panda'}
                          leftName={bLeft?.name || 'Blue Team'}
                          rightName={bRight?.name || 'Red Team'}
                          leftStreak={bLeft?.streak || 0}
                          rightStreak={bRight?.streak || 0}
                          leftShield={Boolean(bLeft?.shield)}
                          rightShield={Boolean(bRight?.shield)}
                          powerCallout={idx === 0 ? studentPowerCallout : null}
                          compact
                          mini
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <CircularSumoArena
                  battlePos={liveBattlePos}
                  winner={ringOutWinnerName}
                  isRumbling={isLeftPushingNow || isRightPushingNow}
                  leftPushing={isLeftPushingNow}
                  rightPushing={isRightPushingNow}
                  leftStunned={amILeft && studentStunned}
                  rightStunned={!amILeft && studentStunned}
                  leftCharacter={arenaLeft?.character || 'rikishi'}
                  rightCharacter={arenaRight?.character || 'panda'}
                  leftName={arenaLeft?.name || 'Blue Team'}
                  rightName={arenaRight?.name || 'Red Team'}
                  leftStreak={arenaLeft?.streak || 0}
                  rightStreak={arenaRight?.streak || 0}
                  leftShield={Boolean(arenaLeft?.shield)}
                  rightShield={Boolean(arenaRight?.shield)}
                  powerCallout={studentPowerCallout}
                />
              )}

              {/* Live Push / Stun Floating Callout */}
              {studentLastFeedback === 'correct' && !studentPowerCallout && (
                <div className="absolute top-2 z-40 px-5 py-1.5 rounded-full bg-emerald-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border-2 border-white animate-bounce">
                  💥 SUMO PUSH! Keep Answering!
                </div>
              )}
              {studentLastFeedback === 'wrong' && (
                <div className="absolute top-2 z-40 px-5 py-1.5 rounded-full bg-rose-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl border-2 border-white animate-bounce">
                  😵 STUNNED! Wait 1.4s...
                </div>
              )}

              {/* Question Card Centered Directly Under the Circular Dohyo Ring */}
              <div className="w-full max-w-4xl mx-auto pt-1 pb-1.5 px-3 text-center z-20 shrink-0">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl py-2 sm:py-3 px-5 sm:px-8 shadow-xl border-2 border-amber-900/15 flex flex-col sm:flex-row items-center justify-center gap-3">
                  {qImg && (
                    <img
                      src={qImg}
                      alt="Question"
                      className="max-h-12 sm:max-h-16 object-contain rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-xs"
                    />
                  )}
                  <div className="text-base sm:text-xl md:text-2xl font-black text-[#0f172a] leading-snug">
                    {qText}
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM: PLAYER'S 4 SUMO ANSWER BUTTONS (Without Letter/Number Badges) + COMBO STREAK HUD */}
            <div className="w-full max-w-5xl mx-auto pb-1 z-20 shrink-0">
              {!canStudentPlay ? (
                <div className="bg-slate-900/95 text-white rounded-3xl p-4 text-center border-2 border-rose-500 shadow-xl">
                  <div className="font-black text-base sm:text-lg uppercase text-rose-400">
                    ⚡ 0 Energy — Eliminated from Tournament
                  </div>
                  <p className="text-xs text-slate-300">
                    Players without energy cannot play anymore. Spectating the remaining contenders!
                  </p>
                </div>
              ) : allMyArenasFinished ? (
                <div className="bg-slate-900/95 text-white rounded-3xl p-4 text-center border-2 border-amber-400 shadow-xl">
                  <div className="font-black text-base sm:text-xl uppercase text-amber-300">
                    🏆 OSHIDASHI RING-OUT! Arena Complete!
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Waiting for remaining arenas or timer to finish...
                  </p>
                </div>
              ) : (
                <div
                  className={`${mySideTheme.deckBg} rounded-2xl sm:rounded-3xl md:rounded-[2.25rem] p-2 sm:p-3.5 md:p-4 shadow-2xl border-b-4 md:border-b-8`}
                >
                  {/* Live Combo Streak & Power-Up Status Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 mb-2 border-b border-white/20 text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white/90">
                        Combo Streak:
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-black text-xs uppercase ${
                          studentStreak >= 4
                            ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-rose-500 text-slate-950 animate-pulse'
                            : studentStreak >= 2
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-black/25 text-white'
                        }`}
                      >
                        {studentStreak >= 4
                          ? `⚡ ${studentStreak}x YOKOZUNA FURY (+3 PUSHES)`
                          : studentStreak === 3
                          ? '🔥 3x HEAVY PUSH (+2 PUSHES)'
                          : studentStreak === 2
                          ? '🔥 2x TSUPPARI COMBO (+2 PUSHES)'
                          : `${studentStreak}x`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {studentShield ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black text-[11px] sm:text-xs uppercase shadow-xs border border-white">
                          🛡️ Iron Mawashi Shield Ready
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-white/80">
                          {studentStreak < 3
                            ? `${3 - studentStreak} more in a row for 🛡️ Shield`
                            : 'Keep streak alive for +3 Pushes!'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    {activeQ.options.map((opt, idx) => {
                      const parsedOpt = parseOptionContent(opt);
                      const cleanOptText = (parsedOpt.text || '').replace(
                        /^[A-Da-d][.)]\s+/,
                        ''
                      );
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={studentStunned}
                          onClick={() =>
                            handleStudentArenaAnswer(
                              idx,
                              activeQ,
                              myMatchups,
                              myContenderId,
                              canStudentPlay
                            )
                          }
                          className={`bg-white ${mySideTheme.btnHover} active:translate-y-1.5 rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col items-center justify-center min-h-[64px] sm:min-h-[84px] md:min-h-[96px] shadow-[0_4px_0_#cbd5e1] sm:shadow-[0_6px_0_#94a3b8] transition-all cursor-pointer ${
                            studentStunned ? 'opacity-45 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="flex-1 flex flex-col items-center justify-center px-1 gap-1">
                            {parsedOpt.imageUrl && (
                              <img
                                src={parsedOpt.imageUrl}
                                alt={cleanOptText || `Option ${idx + 1}`}
                                className="max-h-12 sm:max-h-14 object-contain rounded-lg"
                              />
                            )}
                            {cleanOptText && (
                              <span className="font-black text-slate-900 text-sm sm:text-lg md:text-xl text-center leading-tight line-clamp-2">
                                {cleanOptText}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SumoStadiumEnvironment>
        </div>
      );
    }

    // 1E. Student WINNER SHOWCASE Screen (CLASH_RESULT — Waits for Host to Click Continue)
    if (phase === 'CLASH_RESULT') {
      const showcaseMatchup =
        myMatchup || matchups.find((m) => !m.isBye && m.rightId) || matchups[0];
      const didIWin = myMatchups.some((m) => m.winnerId === myContenderId);
      const didILose = myMatchups.some((m) => m.loserId === myContenderId);
      const isDraw = Boolean(showcaseMatchup?.isDraw);
      const winnerDisplay = showcaseMatchup?.winnerId
        ? getContenderDisplay(showcaseMatchup.winnerId)
        : null;
      const loserDisplay = showcaseMatchup?.loserId
        ? getContenderDisplay(showcaseMatchup.loserId)
        : null;

      return (
        <div className="w-full h-full min-h-screen flex-1 relative overflow-hidden select-none">
          <SumoStadiumEnvironment
            battlePos={showcaseMatchup?.battlePos ?? 50}
            winner={isDoubleArena ? null : winnerDisplay?.name || null}
            isRumbling={false}
          >
            {/* Top Status Header */}
            <div className="w-full flex items-center justify-between px-3 pt-2 z-30">
              <div className="px-4 py-1.5 rounded-2xl bg-slate-950/90 border-2 border-amber-400 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                Round {roundNumber} • Arena Winner Showcase
              </div>
              <EnergyBar
                energy={myContender?.energy ?? 0}
                maxEnergy={myContender?.maxEnergy ?? startingEnergy}
                side={amILeft ? 'left' : 'right'}
                size="md"
                justLostEnergy={didILose}
              />
            </div>

            {/* Live Dohyo Arena(s) Showing the Winner & Loser Position */}
            <div className="w-full max-w-5xl mx-auto my-auto flex flex-col items-center px-2">
              {isDoubleArena ? (
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                  {myMatchups.map((m, idx) => {
                    const bLeft = getContenderDisplay(m.leftId);
                    const bRight = getContenderDisplay(m.rightId);
                    const bWin = m.winnerId ? getContenderDisplay(m.winnerId) : null;
                    return (
                      <div
                        key={m.id}
                        className="bg-slate-950/45 backdrop-blur-xs rounded-2xl border-2 border-amber-400 p-2 flex flex-col items-center"
                      >
                        <div className="text-xs font-black uppercase text-amber-300 mb-1">
                          Arena {idx + 1} •{' '}
                          {bWin ? `Winner: ${bWin.name}` : 'Draw Match'}
                        </div>
                        <CircularSumoArena
                          battlePos={m.battlePos ?? 50}
                          winner={bWin?.name || null}
                          isRumbling={false}
                          leftPushing={false}
                          rightPushing={false}
                          leftCharacter={bLeft?.character || 'rikishi'}
                          rightCharacter={bRight?.character || 'panda'}
                          leftName={bLeft?.name || 'Blue Fighter'}
                          rightName={bRight?.name || 'Red Fighter'}
                          compact
                          mini
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <CircularSumoArena
                  battlePos={showcaseMatchup?.battlePos ?? 50}
                  winner={winnerDisplay?.name || null}
                  isRumbling={false}
                  leftPushing={false}
                  rightPushing={false}
                  leftCharacter={leftFighter?.character || 'rikishi'}
                  rightCharacter={rightFighter?.character || 'panda'}
                  leftName={leftFighter?.name || 'Blue Fighter'}
                  rightName={rightFighter?.name || 'Red Fighter'}
                  compact
                />
              )}

              {/* Winner Announcement Card */}
              <div className="max-w-lg w-full bg-white/95 backdrop-blur-md text-slate-900 rounded-[2rem] p-5 sm:p-6 text-center shadow-2xl border-4 border-amber-400 mt-2">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs uppercase tracking-widest mb-2">
                  <Trophy className="w-4 h-4 text-amber-600" />
                  <span>
                    {isDoubleArena
                      ? 'Double-Arena Results'
                      : showcaseMatchup?.reason === 'ring_out'
                      ? 'Oshidashi • Ring-Out Victory!'
                      : isDraw
                      ? 'Center Ring Draw'
                      : '1-Minute Ring Dominance!'}
                  </span>
                </div>

                {isDoubleArena ? (
                  <div className="space-y-1.5 mb-3">
                    {myMatchups.map((m, idx) => {
                      const bWin = m.winnerId ? getContenderDisplay(m.winnerId) : null;
                      const bLose = m.loserId ? getContenderDisplay(m.loserId) : null;
                      return (
                        <div
                          key={m.id}
                          className="text-xs sm:text-sm font-black text-slate-800 bg-amber-50 rounded-xl px-3 py-1.5 border border-amber-200"
                        >
                          Arena {idx + 1}:{' '}
                          {bWin && bLose
                            ? `🏆 ${bWin.name} defeated ${bLose.name} (-1⚡)`
                            : '🤝 Draw Match'}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <h2
                      className={`text-2xl sm:text-3xl font-black uppercase mb-1 ${
                        didIWin
                          ? 'text-emerald-600'
                          : didILose
                          ? 'text-rose-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {winnerDisplay
                        ? `🏆 Winner: ${winnerDisplay.name}!`
                        : '🤝 Draw Match — No Energy Lost!'}
                    </h2>

                    <p className="text-xs sm:text-sm font-bold text-slate-600 mb-3">
                      {winnerDisplay && loserDisplay
                        ? `${winnerDisplay.name} (${
                            showcaseMatchup?.winnerId === showcaseMatchup?.leftId
                              ? showcaseMatchup?.leftPushes || 0
                              : showcaseMatchup?.rightPushes || 0
                          } pushes) defeated ${loserDisplay.name} (${
                            showcaseMatchup?.loserId === showcaseMatchup?.leftId
                              ? showcaseMatchup?.leftPushes || 0
                              : showcaseMatchup?.rightPushes || 0
                          } pushes) • ${loserDisplay.name} loses 1⚡ Energy!`
                        : 'Neither fighter gained ring control during the 1-minute match.'}
                    </p>
                  </>
                )}

                {(myContender?.energy ?? 0) <= 0 && (
                  <div className="mb-3 px-3 py-1.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 font-black text-xs uppercase">
                    ⚡ 0 Energy Remaining — You are eliminated from future rounds
                  </div>
                )}

                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Waiting for Host to click Continue...</span>
                </div>
              </div>
            </div>

            <div className="h-2" />
          </SumoStadiumEnvironment>
        </div>
      );
    }

    // 1F. Student CHAMPION Screen
    if (phase === 'CHAMPION') {
      const isGrandChampion =
        myContender && !myContender.eliminated && myContender.energy > 0;
      return (
        <div className="w-full min-h-full flex-1 bg-gradient-to-b from-amber-500 via-orange-600 to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none">
          <div className="max-w-md w-full bg-white text-slate-900 rounded-[2.5rem] p-6 sm:p-8 text-center shadow-2xl border-4 border-amber-300">
            <Crown className="w-14 h-14 text-amber-500 fill-amber-400 mx-auto mb-2" />
            <h1 className="text-2xl sm:text-3xl font-black uppercase mb-1">
              {isGrandChampion ? '🏆 GRAND YOKOZUNA CHAMPION!' : 'Tournament Complete!'}
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-500 mb-4">
              {isGrandChampion
                ? 'You conquered the Dojo Showdown!'
                : `You won ${me?.wins || 0} arena match${(me?.wins || 0) === 1 ? '' : 'es'} in the Dojo!`}
            </p>
            <div className="my-4 flex justify-center">
              <SumoCharacter
                team="left"
                character={myContender?.character || studentCharacter}
                compact
              />
            </div>
            <EnergyBar
              energy={myContender?.energy ?? 0}
              maxEnergy={myContender?.maxEnergy ?? startingEnergy}
              side="left"
              size="lg"
            />
          </div>
        </div>
      );
    }
  }

  // ============================================================================
  // RENDER 2: HOST SETTINGS VIEW (Imperial Sumo Dojo Control Deck + Slider)
  // ============================================================================
  if (phase === 'SETTINGS') {
    const energyPaceLabel =
      startingEnergy <= 2
        ? 'Sudden Death Showdown'
        : startingEnergy <= 4
        ? 'Fast-Paced Dojo Blitz'
        : startingEnergy <= 6
        ? 'Balanced Championship'
        : startingEnergy <= 8
        ? 'Endurance Clash'
        : 'Grand Yokozuna Marathon';

    return (
      <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-[#2a080c] to-[#431407] flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-y-auto">
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center opacity-20">
          <div className="w-[620px] h-[620px] rounded-full border-[18px] border-amber-500/40" />
          <div className="absolute w-[780px] h-[780px] rounded-full border-4 border-dashed border-rose-500/30" />
        </div>

        <div className="w-full max-w-3xl bg-[#fffdf7] text-slate-900 rounded-[2.25rem] shadow-[0_25px_70px_rgba(0,0,0,0.65)] border-4 border-amber-400 overflow-hidden relative z-10 my-auto">
          <div className="bg-gradient-to-r from-[#7f1d1d] via-[#b91c1c] to-[#9a3412] border-b-4 border-amber-400 px-5 sm:px-8 py-5 text-white relative overflow-hidden">
            <div className="flex items-center justify-between gap-3 relative z-10">
              <button
                onClick={onExit}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/30 hover:bg-black/45 border border-amber-300/40 text-amber-100 font-black text-xs sm:text-sm cursor-pointer transition shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-center min-w-0">
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] sm:text-xs uppercase tracking-widest mb-1 shadow">
                  <Swords className="w-3.5 h-3.5" />
                  <span>Sumo Royale • 1-Min Live Dohyo Arena</span>
                </div>
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white truncate drop-shadow">
                  {gameTitle || 'Sumo Royale'}
                </h1>
              </div>

              <div className="hidden sm:flex items-center gap-1 bg-black/25 px-3 py-1.5 rounded-2xl border border-amber-300/30 shrink-0">
                <Trophy className="w-4 h-4 text-amber-300" />
                <span className="text-xs font-black text-amber-200 uppercase">
                  {normalizedQuestions.length} Qs
                </span>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/15 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="scale-75 -my-4">
                  <SumoCharacter team="left" character="rikishi" size="card" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-200 hidden sm:inline">
                  Yokozuna Taro
                </span>
              </div>

              <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black italic text-sm flex items-center justify-center border-2 border-white shadow">
                VS
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-200 hidden sm:inline">
                  Bao Panda
                </span>
                <div className="scale-75 -my-4">
                  <SumoCharacter team="right" character="panda" size="card" />
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-amber-200 shadow-sm flex flex-col justify-between">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black uppercase tracking-widest text-rose-700">
                      01. Match Format
                    </span>
                    <span className="text-xs font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-lg">
                      {matchType === 'solo' ? '1v1 Free-For-All' : 'Auto-Balanced'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {matchType === 'solo' ? 'Solo 1v1 Showdown' : 'Dojo Team Squads'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {matchType === 'solo'
                      ? 'Every student battles in a 1-minute live Dohyo tug-of-war arena.'
                      : 'Students are grouped into balanced Sumo squads pushing together.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { id: 'solo', label: 'Solo (1v1)', icon: Swords },
                    { id: 'teams', label: 'Dojo Teams', icon: Users }
                  ] as const).map((item) => {
                    const Icon = item.icon;
                    const active = matchType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setMatchType(item.id)}
                        className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm border-2 border-b-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          active
                            ? 'bg-gradient-to-b from-rose-600 to-red-700 text-white border-rose-400 border-b-red-950 shadow-md -translate-y-0.5'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-600 border-slate-200 border-b-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-4 sm:p-5 border-2 border-amber-200 shadow-sm flex flex-col justify-between">
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black uppercase tracking-widest text-rose-700">
                      02. Question Flow
                    </span>
                    <span className="text-xs font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-lg">
                      {questionOrder === 'random' ? 'Shuffled Deck' : '1 → End'}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900">
                    {questionOrder === 'random' ? 'Random Shuffle' : 'Sequential Order'}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {questionOrder === 'random'
                      ? 'Shuffles questions during each 1-minute arena match.'
                      : 'Presents questions in exact curriculum order during each match.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    { id: 'random', label: 'Random', icon: Shuffle },
                    { id: 'ordered', label: 'Ordered', icon: Check }
                  ] as const).map((item) => {
                    const Icon = item.icon;
                    const active = questionOrder === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setQuestionOrder(item.id)}
                        className={`py-2.5 px-3 rounded-2xl font-black text-xs sm:text-sm border-2 border-b-4 flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          active
                            ? 'bg-gradient-to-b from-amber-500 to-orange-600 text-slate-950 border-amber-300 border-b-orange-800 shadow-md -translate-y-0.5'
                            : 'bg-slate-50 hover:bg-amber-50 text-slate-600 border-slate-200 border-b-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50/90 via-white to-orange-50/80 rounded-3xl p-5 sm:p-6 border-2 border-amber-300 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-rose-700 mb-0.5">
                    03. Starting Energy Slider
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                    <span>
                      Starting Energy per {matchType === 'solo' ? 'Fighter' : 'Dojo Team'}
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                      {energyPaceLabel}
                    </span>
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <EnergyBar
                    energy={startingEnergy}
                    maxEnergy={startingEnergy}
                    side="right"
                    size="md"
                  />
                  <div className="px-4 py-1.5 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 text-slate-950 font-black text-lg sm:text-xl border-2 border-amber-700 shadow tabular-nums">
                    {startingEnergy} ⚡
                  </div>
                </div>
              </div>

              <div className="px-1">
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={startingEnergy}
                  onChange={(e) => setStartingEnergy(Number(e.target.value))}
                  aria-label="Starting Energy per Player"
                  className="w-full h-3.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-rose-600 focus:outline-none"
                />

                <div className="grid grid-cols-10 gap-1 mt-2.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                    const isSelected = startingEnergy === num;
                    const isFilled = num <= startingEnergy;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setStartingEnergy(num)}
                        className={`py-1.5 rounded-xl font-black text-xs sm:text-sm tabular-nums transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-rose-600 text-white border-rose-800 shadow scale-110'
                            : isFilled
                            ? 'bg-amber-100 text-amber-950 border-amber-300 hover:bg-amber-200'
                            : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setPhase('LOBBY');
                playRoyaleSFX('lock', soundMuted);
              }}
              className="w-full py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 active:translate-y-0.5 text-white font-black text-xl sm:text-2xl uppercase tracking-wider border-b-[6px] border-red-950 shadow-xl transition-all cursor-pointer flex items-center justify-center gap-3"
            >
              <Swords className="w-6 h-6 text-amber-300" />
              <span>Open Dojo Lobby • Host Now</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER 3: HOST LOBBY VIEW (Imperial Sumo Dojo Theme + QR & Link Join)
  // ============================================================================
  if (phase === 'LOBBY') {
    const contenderCount =
      matchType === 'solo'
        ? players.length
        : teams.filter((t) => players.some((p) => p.teamId === t.id)).length;
    const neededMore = Math.max(0, 2 - players.length);

    return (
      <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-[#2a080c] to-[#431407] text-white flex flex-col select-none relative overflow-hidden">
        <div className="bg-gradient-to-r from-[#7f1d1d] via-[#991b1b] to-[#9a3412] border-b-[6px] border-amber-400 px-4 sm:px-8 py-3 flex flex-wrap items-center justify-between gap-4 shadow-2xl z-20">
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={() => setShowLargeQR(true)}
              className="bg-white p-2 rounded-xl shadow-md hover:scale-105 transition cursor-pointer shrink-0 border-2 border-amber-300"
              title="Click to enlarge QR Code"
            >
              <QRCodeSVG value={joinUrl} size={84} level="M" />
            </button>

            <div className="text-center sm:text-left">
              <div className="text-xs font-black uppercase tracking-widest text-amber-300 mb-0.5">
                Scan QR or Join Online
              </div>
              <div className="text-base sm:text-xl font-bold text-white/95 leading-snug">
                Go to{' '}
                <span className="underline font-black decoration-amber-300 decoration-2">
                  {displayHostDomain}
                </span>
              </div>
              <div className="text-base sm:text-xl font-bold text-amber-100 leading-snug">
                and enter Dojo Game ID:
              </div>
            </div>
          </div>

          <div className="px-5 py-1.5 rounded-2xl bg-black/30 border-2 border-amber-400/50 text-5xl sm:text-7xl md:text-8xl font-black tracking-wider text-amber-300 tabular-nums drop-shadow-[0_5px_0_rgba(0,0,0,0.45)]">
            {roomCode}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition shadow"
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 text-emerald-800" />
                  <span>Copied Link!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Join Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSoundMuted((m) => !m)}
              className="p-2.5 rounded-xl bg-black/30 hover:bg-black/45 border border-white/20 text-white cursor-pointer"
              title={soundMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => setPhase('SETTINGS')}
              className="p-2.5 rounded-xl bg-black/30 hover:bg-black/45 border border-white/20 text-white cursor-pointer"
              title="Sumo Royale Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                pushHostStateToServer({ hostClosed: true });
                onExit();
              }}
              className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              title="Close Room"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl w-full mx-auto px-4 sm:px-8 pt-6 pb-4 flex flex-wrap items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 border border-amber-400/30 text-2xl sm:text-3xl font-black tabular-nums shadow">
              <span>{players.length}</span>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-amber-300" />
            </div>

            <button
              type="button"
              onClick={handleAddBot}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border-2 border-amber-300/40 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition shadow"
              title="Add an AI Dojo Bot fighter to the tournament"
            >
              <Bot className="w-4 h-4 text-amber-300" />
              <span>+ Add Dojo Bot</span>
            </button>

            {matchType === 'teams' && players.length >= 2 && (
              <button
                type="button"
                onClick={handleShuffleTeams}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition shadow"
              >
                <Shuffle className="w-4 h-4" />
                <span>Shuffle Teams</span>
              </button>
            )}
          </div>

          <div className="text-center">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-amber-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.45)]">
              Sumo Royale
            </h1>
            <div className="text-xs font-black uppercase tracking-widest text-amber-100/90">
              {matchType === 'solo'
                ? `Solo 1v1 Live Dohyo • 1:00 Matches • ${startingEnergy}⚡ Energy`
                : `Dojo Squads Live Dohyo • 1:00 Matches • ${startingEnergy}⚡ Energy`}
            </div>
          </div>

          <button
            type="button"
            onClick={handleStartTournament}
            className={`px-7 py-3.5 rounded-2xl font-black text-xl sm:text-2xl border-b-[6px] shadow-xl transition-all cursor-pointer flex items-center gap-2 ${
              players.length >= 2 && contenderCount >= 2
                ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 border-orange-700 animate-pulse'
                : 'bg-white/90 hover:bg-white text-slate-900 border-slate-400'
            }`}
          >
            {neededMore > 0 ? (
              <span>{neededMore} More (or Click for Bot)</span>
            ) : (
              <>
                <Play className="w-6 h-6 fill-current" />
                <span>Start Battle</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-4 overflow-y-auto z-10">
          {players.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center bg-black/30 backdrop-blur-xs rounded-3xl border-2 border-dashed border-amber-400/40 p-6">
              <QrCode className="w-12 h-12 text-amber-300 mb-2" />
              <div className="text-xl sm:text-2xl font-black text-white">
                Waiting for Sumo Fighters to Enter the Dojo...
              </div>
              <p className="text-xs sm:text-sm font-bold text-amber-200/80 mt-1">
                Scan the QR code, share the join link, or click &ldquo;+ Add Dojo Bot&rdquo; to practice!
              </p>
            </div>
          ) : matchType === 'solo' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="group relative bg-[#fffdf7] text-slate-900 rounded-3xl p-3.5 shadow-xl border-2 border-amber-300 border-b-4 border-b-amber-500 flex flex-col items-center text-center animate-in zoom-in-95 duration-150"
                >
                  <button
                    type="button"
                    onClick={() => handleKickPlayer(p.id)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Remove player"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="scale-90 -my-1">
                    <SumoCharacter team="left" character={p.character} size="card" />
                  </div>
                  <div className="font-black text-sm sm:text-base text-slate-900 truncate w-full mt-1">
                    {p.name}
                  </div>
                  <div className="mt-1.5">
                    <EnergyBar
                      energy={p.energy}
                      maxEnergy={p.maxEnergy}
                      side="left"
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => {
                const members = players.filter((p) => p.teamId === team.id);
                return (
                  <div
                    key={team.id}
                    className="bg-[#fffdf7] text-slate-900 rounded-3xl overflow-hidden shadow-xl border-2 border-amber-300 border-b-4 border-b-amber-500 flex flex-col"
                  >
                    <div
                      className={`bg-gradient-to-r ${team.bgClass} text-white px-4 py-3 flex items-center justify-between`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="scale-75 -my-4 -ml-2">
                          <SumoCharacter
                            team="left"
                            character={team.character}
                            size="card"
                          />
                        </div>
                        <div>
                          <div className="font-black text-base uppercase tracking-wide">
                            {team.name}
                          </div>
                          <div className="text-[11px] font-bold text-white/80">
                            {members.length} Fighter{members.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      <EnergyBar
                        energy={team.energy}
                        maxEnergy={team.maxEnergy}
                        side="left"
                        size="sm"
                      />
                    </div>

                    <div className="p-3.5 flex flex-wrap gap-2">
                      {members.map((m) => (
                        <div
                          key={m.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 font-black text-xs text-slate-800"
                        >
                          <span>{m.name}</span>
                          <button
                            type="button"
                            onClick={() => handleKickPlayer(m.id)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showLargeQR && (
          <div
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setShowLargeQR(false)}
          >
            <div
              className="bg-white text-slate-900 rounded-[2.5rem] p-8 max-w-md w-full text-center shadow-2xl border-4 border-amber-400"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-black uppercase tracking-widest text-rose-600 mb-1">
                Scan to Enter Sumo Royale
              </div>
              <div className="text-4xl font-black text-slate-900 mb-4 tabular-nums">
                ID: {roomCode}
              </div>
              <div className="bg-white p-4 rounded-3xl border-4 border-amber-200 inline-block shadow-inner">
                <QRCodeSVG value={joinUrl} size={260} level="M" />
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setShowLargeQR(false)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 text-white font-black text-base uppercase cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER 4: HOST ACTIVE TOURNAMENT (LIVE MINI-ARENAS & WINNER SHOWCASE + CONTINUE)
  // ============================================================================
  if (phase === 'VS_INTRO' || phase === 'QUESTION' || phase === 'CLASH_RESULT') {
    const aliveCount =
      matchType === 'solo'
        ? players.filter((p) => !p.eliminated && p.energy > 0).length
        : teams.filter((t) => !t.eliminated && t.energy > 0).length;

    return (
      <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-[#2a080c] to-slate-900 text-white flex flex-col justify-between select-none relative overflow-hidden">
        {/* Top Host Tournament Control Bar */}
        <div className="bg-gradient-to-r from-[#7f1d1d] via-[#991b1b] to-[#9a3412] border-b-4 border-amber-400 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-black/30 border border-amber-300/30 font-black text-xs sm:text-sm uppercase tracking-wider text-amber-300">
              Round {roundNumber}
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-300/40 font-black text-xs sm:text-sm text-amber-100">
              {aliveCount} Contender{aliveCount === 1 ? '' : 's'} Alive
            </div>
            <div className="hidden md:block text-xs font-bold text-amber-200">
              Dojo ID: <span className="font-black text-white tabular-nums">{roomCode}</span>
            </div>
          </div>

          {/* Center 1:00 Live Match Timer OR Winner Showcase Continue Banner */}
          {phase === 'QUESTION' && (
            <div className="flex items-center gap-2 px-5 py-1.5 rounded-2xl bg-amber-400 text-slate-950 font-black text-lg sm:text-xl tabular-nums shadow-lg border-2 border-white">
              <Clock className="w-5 h-5" />
              <span>{formatMatchTimer(secondsLeft)}</span>
            </div>
          )}

          {phase === 'CLASH_RESULT' && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs sm:text-sm font-black uppercase tracking-wider text-amber-200">
                All Players Seeing Arena Winners
              </span>
              <button
                type="button"
                onClick={handleHostContinueAfterWinner}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500 hover:from-emerald-300 hover:to-amber-300 text-slate-950 font-black text-sm sm:text-base uppercase tracking-wider border-2 border-white border-b-4 border-b-amber-700 shadow-xl flex items-center gap-2 cursor-pointer animate-pulse"
              >
                <span>
                  {aliveCount <= 1 ? '🏆 Crown Grand Yokozuna' : 'Continue to Next Round'}
                </span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {phase === 'QUESTION' && (
              <button
                type="button"
                onClick={resolveRoundClashes}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase cursor-pointer"
                title="End 1-minute match early and show winners"
              >
                Show Winners Now →
              </button>
            )}
            <button
              type="button"
              onClick={() => setSoundMuted((m) => !m)}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white cursor-pointer"
            >
              {soundMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('CHAMPION');
                playRoyaleSFX('victory', soundMuted);
                pushHostStateToServer({ phase: 'CHAMPION' });
              }}
              className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase cursor-pointer"
            >
              End Tournament
            </button>
          </div>
        </div>

        {/* Main Host Body: Live Mini-Dohyo Arenas & Winner Showcase */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 overflow-y-auto z-10 flex flex-col justify-center">
          {phase === 'VS_INTRO' && (
            <div className="text-center mb-4">
              <div className="inline-block px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-600 text-slate-950 font-black text-xl sm:text-3xl uppercase tracking-wider shadow-xl border-2 border-white">
                ⚔️ Round {roundNumber} — Entering 1-Minute Live Dohyo Arenas!
              </div>
            </div>
          )}

          {phase === 'CLASH_RESULT' && (
            <div className="text-center mb-4">
              <div className="inline-flex flex-wrap items-center justify-center gap-3 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-lg sm:text-2xl uppercase tracking-wider shadow-xl border-2 border-white">
                <Trophy className="w-6 h-6 text-rose-700" />
                <span>Round {roundNumber} Arena Winners — Click Continue When Ready!</span>
              </div>
            </div>
          )}

          <div
            className={`grid gap-5 ${
              matchups.length === 1
                ? 'grid-cols-1 max-w-4xl mx-auto w-full'
                : 'grid-cols-1 lg:grid-cols-2'
            }`}
          >
            {matchups.map((m) => {
              const left = getContenderDisplay(m.leftId);
              const right = getContenderDisplay(m.rightId);
              if (!left) return null;

              if (m.isBye || !right) {
                return (
                  <div
                    key={m.id}
                    className="bg-gradient-to-r from-emerald-800 to-teal-900 border-4 border-emerald-400 rounded-3xl p-5 flex items-center justify-between shadow-xl"
                  >
                    <div className="flex items-center gap-3">
                      <SumoCharacter
                        team="left"
                        character={left.character}
                        size="card"
                      />
                      <div>
                        <div className="text-xs font-black uppercase text-emerald-300">
                          🛡️ Dojo Bye — Automatically Advances
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-white">
                          {left.name}
                        </div>
                      </div>
                    </div>
                    <EnergyBar
                      energy={left.energy}
                      maxEnergy={left.maxEnergy}
                      side="left"
                      size="md"
                    />
                  </div>
                );
              }

              const leftWon =
                (phase === 'CLASH_RESULT' && m.winnerId === left.id) ||
                m.ringOutWinnerId === left.id;
              const rightWon =
                (phase === 'CLASH_RESULT' && m.winnerId === right.id) ||
                m.ringOutWinnerId === right.id;
              const leftLost = phase === 'CLASH_RESULT' && m.loserId === left.id;
              const rightLost = phase === 'CLASH_RESULT' && m.loserId === right.id;

              const winnerName = leftWon
                ? left.name
                : rightWon
                ? right.name
                : null;

              const recentPushAge = Date.now() - (m.lastPushAt || 0);
              const leftPushingNow =
                phase === 'QUESTION' && m.lastPusher === 'left' && recentPushAge < 650;
              const rightPushingNow =
                phase === 'QUESTION' && m.lastPusher === 'right' && recentPushAge < 650;

              return (
                <div
                  key={m.id}
                  className={`relative rounded-[2rem] overflow-hidden border-4 shadow-2xl transition-all ${
                    phase === 'CLASH_RESULT'
                      ? 'border-amber-400 bg-gradient-to-b from-sky-200 via-emerald-100 to-emerald-700'
                      : 'border-amber-300 bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-600'
                  }`}
                >
                  {/* Top Arena Fighter Header Bar (Blue vs Red with Live Pushes & Energy) */}
                  <div className="bg-slate-950/85 backdrop-blur-xs px-4 py-2.5 flex items-center justify-between gap-2 border-b-2 border-amber-400/50">
                    {/* Left Contender Header */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg font-black text-xs sm:text-sm uppercase truncate ${
                          leftWon
                            ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                            : 'bg-[#0055fe] text-white'
                        }`}
                      >
                        {leftWon ? '🏆 ' : ''}
                        {left.name}
                      </span>
                      <span className="text-xs font-black text-cyan-300 tabular-nums shrink-0">
                        {m.leftPushes || 0} Push{(m.leftPushes || 0) === 1 ? '' : 'es'}
                      </span>
                      <EnergyBar
                        energy={left.energy}
                        maxEnergy={left.maxEnergy}
                        side="left"
                        size="sm"
                        justLostEnergy={leftLost}
                      />
                    </div>

                    <div className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-slate-950 font-black italic text-xs shrink-0">
                      VS
                    </div>

                    {/* Right Contender Header */}
                    <div className="flex items-center gap-2 min-w-0 justify-end">
                      <EnergyBar
                        energy={right.energy}
                        maxEnergy={right.maxEnergy}
                        side="right"
                        size="sm"
                        justLostEnergy={rightLost}
                      />
                      <span className="text-xs font-black text-orange-300 tabular-nums shrink-0">
                        {m.rightPushes || 0} Push{(m.rightPushes || 0) === 1 ? '' : 'es'}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-lg font-black text-xs sm:text-sm uppercase truncate ${
                          rightWon
                            ? 'bg-amber-400 text-slate-950 ring-2 ring-white'
                            : 'bg-[#cc0000] text-white'
                        }`}
                      >
                        {rightWon ? '🏆 ' : ''}
                        {right.name}
                      </span>
                    </div>
                  </div>

                  {/* LIVE CIRCULAR SUMO DOHYO ARENA */}
                  <div className="py-2 px-2 relative">
                    <CircularSumoArena
                      battlePos={m.battlePos ?? 50}
                      winner={winnerName}
                      isRumbling={leftPushingNow || rightPushingNow}
                      leftPushing={leftPushingNow}
                      rightPushing={rightPushingNow}
                      leftCharacter={left.character}
                      rightCharacter={right.character}
                      leftName={left.name}
                      rightName={right.name}
                      leftStreak={left.streak || 0}
                      rightStreak={right.streak || 0}
                      leftShield={Boolean(left.shield)}
                      rightShield={Boolean(right.shield)}
                      compact
                    />
                  </div>

                  {/* Bottom Winner Showcase / Live Tug-of-War Footer */}
                  <div className="bg-slate-950/90 px-4 py-2.5 text-center border-t-2 border-amber-400/40">
                    {phase === 'CLASH_RESULT' ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {m.isDraw ? (
                          <span className="text-xs sm:text-sm font-black uppercase text-amber-300">
                            🤝 Center Ring Draw — 0 Energy Lost
                          </span>
                        ) : (
                          <>
                            <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs sm:text-sm uppercase">
                              🏆 WINNER: {leftWon ? left.name : right.name}
                            </span>
                            <span className="text-xs font-bold text-amber-100">
                              {m.reason === 'ring_out'
                                ? `Oshidashi Ring-Out! (${leftLost ? left.name : right.name} -1⚡)`
                                : `1-Min Ring Dominance (${leftLost ? left.name : right.name} -1⚡)`}
                            </span>
                            {((leftLost && left.energy <= 0) ||
                              (rightLost && right.energy <= 0)) && (
                              <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[11px] uppercase">
                                Eliminated!
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    ) : m.ringOutWinnerId ? (
                      <span className="text-xs sm:text-sm font-black uppercase text-amber-300">
                        🏆 OSHIDASHI RING-OUT! {winnerName} Won This Arena!
                      </span>
                    ) : (
                      <div className="flex items-center justify-between text-xs font-black uppercase text-amber-200">
                        <span>← {left.name} Pushing</span>
                        <span className="text-amber-400 tabular-nums">
                          Ring Balance: {Math.round(m.battlePos ?? 50)}%
                        </span>
                        <span>{right.name} Pushing →</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prominent Bottom Host "Continue" Bar During Winner Showcase */}
          {phase === 'CLASH_RESULT' && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleHostContinueAfterWinner}
                className="px-10 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-amber-400 to-orange-500 hover:from-emerald-300 hover:to-amber-300 text-slate-950 font-black text-xl sm:text-2xl uppercase tracking-wider border-2 border-white border-b-[6px] border-b-amber-800 shadow-2xl flex items-center gap-3 cursor-pointer hover:scale-105 active:scale-95 transition-all"
              >
                <span>
                  {aliveCount <= 1
                    ? '🏆 Crown Grand Yokozuna Champion'
                    : `Continue to Round ${roundNumber + 1}`}
                </span>
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER 5: GRAND YOKOZUNA CHAMPION PODIUM (CHAMPION PHASE)
  // ============================================================================
  const rankedContenders =
    matchType === 'solo'
      ? [...players].sort((a, b) => {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          if (b.energy !== a.energy) return b.energy - a.energy;
          if ((b.eliminatedRound || 999) !== (a.eliminatedRound || 999)) {
            return (b.eliminatedRound || 999) - (a.eliminatedRound || 999);
          }
          if (b.wins !== a.wins) return b.wins - a.wins;
          return (b.correctCount || 0) - (a.correctCount || 0);
        })
      : [...teams].sort((a, b) => {
          if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
          if (b.energy !== a.energy) return b.energy - a.energy;
          if ((b.eliminatedRound || 999) !== (a.eliminatedRound || 999)) {
            return (b.eliminatedRound || 999) - (a.eliminatedRound || 999);
          }
          return b.wins - a.wins;
        });

  const grandChampion = rankedContenders[0];

  return (
    <div className="w-full min-h-full flex-1 bg-gradient-to-br from-slate-950 via-[#2a080c] to-[#431407] text-white flex flex-col items-center justify-center p-4 sm:p-8 select-none overflow-y-auto">
      <div className="max-w-4xl w-full bg-[#fffdf7] text-slate-900 rounded-[2.5rem] p-6 sm:p-10 shadow-2xl border-4 border-amber-400 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 font-black text-xs uppercase tracking-widest mb-2">
          <Trophy className="w-4 h-4 text-amber-600" />
          <span>Sumo Royale: Dojo Showdown</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 uppercase tracking-tight mb-2">
          {grandChampion ? `🏆 ${grandChampion.name}` : 'Tournament Complete'}
        </h1>
        <p className="text-sm sm:text-base font-bold text-slate-500 mb-6">
          Grand Yokozuna Champion of the Dojo!
        </p>

        {grandChampion && (
          <div className="flex flex-col items-center mb-8">
            <div className="p-6 rounded-3xl bg-gradient-to-b from-amber-100 via-amber-50 to-white border-4 border-amber-400 shadow-xl mb-3">
              <SumoCharacter
                team="left"
                character={grandChampion.character}
                compact
              />
            </div>
            <EnergyBar
              energy={grandChampion.energy}
              maxEnergy={grandChampion.maxEnergy}
              side="left"
              size="lg"
            />
          </div>
        )}

        <div className="text-left max-h-64 overflow-y-auto rounded-2xl border-2 border-amber-200 divide-y divide-amber-100 mb-6">
          {rankedContenders.map((c, idx) => (
            <div
              key={c.id}
              className={`px-4 py-3 flex items-center justify-between ${
                idx === 0 ? 'bg-amber-50/90' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center ${
                    idx === 0
                      ? 'bg-amber-400 text-slate-950'
                      : idx === 1
                      ? 'bg-slate-300 text-slate-900'
                      : idx === 2
                      ? 'bg-amber-700 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  #{idx + 1}
                </span>
                <span className="font-black text-sm sm:text-base text-slate-900">
                  {c.name}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  • {c.wins} Arena Win{c.wins === 1 ? '' : 's'}
                </span>
              </div>
              <EnergyBar
                energy={c.energy}
                maxEnergy={c.maxEnergy}
                side="left"
                size="sm"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handlePlayAgainInSameRoom}
            className="px-8 py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black text-lg uppercase tracking-wider border-b-[6px] border-red-950 flex items-center gap-2 cursor-pointer transition shadow-lg"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Play Again (Same Room)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              pushHostStateToServer({ hostClosed: true });
              onExit();
            }}
            className="px-6 py-4 rounded-2xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-black text-base uppercase tracking-wider cursor-pointer transition"
          >
            Back to Sumo Menu
          </button>
        </div>
      </div>
    </div>
  );
}
