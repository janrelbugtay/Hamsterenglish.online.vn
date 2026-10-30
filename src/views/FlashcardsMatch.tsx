import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { GameModeModal } from '../components/GameModeModal';
import { parseOptionContent, isDirectMediaUrl, formatOptionContent } from '../utils/mediaAndPresets';
import {
  ArrowLeft,
  BookOpen,
  Plus,
  Sparkles,
  Save,
  X,
  Play,
  Copy,
  Trash2,
  FolderPlus,
  Shuffle,
  RotateCw,
  Square,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Pause,
  Clock,
  ArrowLeftRight,
  Check,
  Search,
  CheckCircle2,
  Layers,
  Image as ImageIcon,
  Palette,
  Undo2,
  HelpCircle,
  Folder,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

/*************************************************************
 * 1. THEMES DEFINITION (5 ILLUSTRATED STAGE THEMES)
 *************************************************************/
export interface FlashcardTheme {
  id: 'london' | 'cyber' | 'jungle' | 'space' | 'classroom';
  name: string;
  subtitle: string;
  badge: string;
  cardFont: string;
  previewBg: string;
  deckCardBg: string;
  emblemSvg: React.ReactNode;
  stageSvg: React.ReactNode;
}

const THEMES: Record<string, FlashcardTheme> = {
  london: {
    id: 'london',
    name: 'London Fog',
    subtitle: 'Big Ben, Red Bus & Crown',
    badge: '🇬🇧 London Fog',
    cardFont: "font-['Playfair_Display',Georgia,serif]",
    previewBg: 'linear-gradient(135deg, #64748b 0%, #94a3b8 50%, #ef4444 100%)',
    deckCardBg: 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-400 text-slate-600',
    emblemSvg: (
      <svg viewBox="0 0 120 100" className="w-28 h-24 sm:w-36 sm:h-32 text-slate-500/75 fill-current drop-shadow">
        <rect x="53" y="6" width="14" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="4" />
        <path d="M56 20 H64 V30 H56 Z" />
        <path d="M22 65 C18 42, 35 30, 58 34 C45 42, 42 54, 45 65 Z" opacity="0.85" />
        <path d="M98 65 C102 42, 85 30, 62 34 C75 42, 78 54, 75 65 Z" opacity="0.85" />
        <path d="M25 65 H95 L88 84 H32 Z" />
        <rect x="28" y="87" width="64" height="7" rx="3" />
        <circle cx="32" cy="48" r="4" />
        <circle cx="60" cy="44" r="5" />
        <circle cx="88" cy="48" r="4" />
      </svg>
    ),
    stageSvg: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#6993c7] via-[#9ab5d6] to-[#cbd5e1]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="fogGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="70%" stopColor="#e2e8f0" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#cbd5e1" stopOpacity="0.85" />
            </linearGradient>
          </defs>
          <g opacity="0.55" transform="translate(610, 60)">
            <path d="M40 90 C40 30, 120 30, 120 90 Z" fill="#e2e8f0" />
            <rect x="35" y="90" width="90" height="580" fill="#cbd5e1" />
            <rect x="48" y="130" width="22" height="40" rx="11" fill="#94a3b8" />
            <rect x="90" y="130" width="22" height="40" rx="11" fill="#94a3b8" />
            <rect x="48" y="210" width="22" height="40" rx="11" fill="#94a3b8" />
            <rect x="90" y="210" width="22" height="40" rx="11" fill="#94a3b8" />
          </g>
          <g opacity="0.75" transform="translate(960, -20)">
            <polygon points="90,0 45,120 135,120" fill="#94a3b8" />
            <rect x="40" y="120" width="100" height="580" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="3" />
            <rect x="30" y="160" width="120" height="110" fill="#e2e8f0" stroke="#64748b" strokeWidth="4" />
            <circle cx="90" cy="215" r="38" fill="#f8fafc" stroke="#475569" strokeWidth="5" />
            <line x1="90" y1="215" x2="90" y2="190" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="90" y1="215" x2="110" y2="225" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g opacity="0.65" transform="translate(45, 75)">
            <path d="M20 75 C20 15, 290 15, 290 75 Z" fill="#b91c1c" />
            <rect x="15" y="75" width="280" height="680" rx="8" fill="#dc2626" stroke="#991b1b" strokeWidth="6" />
            <rect x="45" y="150" width="95" height="520" fill="#7dd3fc" opacity="0.45" />
            <rect x="165" y="150" width="95" height="520" fill="#7dd3fc" opacity="0.45" />
          </g>
          <g className="bus-bob" opacity="0.7" transform="translate(680, 460)">
            <rect x="0" y="0" width="330" height="220" rx="18" fill="#dc2626" />
            <rect x="15" y="20" width="65" height="55" rx="6" fill="#93c5fd" />
            <rect x="92" y="20" width="65" height="55" rx="6" fill="#93c5fd" />
            <rect x="170" y="20" width="65" height="55" rx="6" fill="#93c5fd" />
            <rect x="248" y="20" width="65" height="55" rx="6" fill="#93c5fd" />
            <rect x="10" y="95" width="310" height="16" fill="#fef08a" opacity="0.8" />
            <rect x="90" y="125" width="145" height="65" rx="6" fill="#93c5fd" />
            <circle cx="65" cy="220" r="28" fill="#1e293b" />
            <circle cx="65" cy="220" r="14" fill="#64748b" />
            <circle cx="265" cy="220" r="28" fill="#1e293b" />
            <circle cx="265" cy="220" r="14" fill="#64748b" />
          </g>
          <rect width="1440" height="800" fill="url(#fogGrad)" />
        </svg>
      </div>
    ),
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Neon',
    subtitle: 'Synthwave Grid & Neon Pulse',
    badge: '⚡ Cyber Neon',
    cardFont: "font-['Orbitron',sans-serif]",
    previewBg: 'linear-gradient(135deg, #0f172a 0%, #4c1d95 55%, #ec4899 100%)',
    deckCardBg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 border-cyan-400 text-cyan-400',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-36 sm:h-36 text-cyan-400 fill-none stroke-current drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]" strokeWidth="4">
        <polygon points="60,8 106,34 106,86 60,112 14,86 14,34" />
        <polygon points="60,22 92,40 92,80 60,98 28,80 28,40" stroke="#f472b6" />
        <path d="M64 36 L44 64 H62 L56 86 L78 56 H60 Z" fill="currentColor" />
      </svg>
    ),
    stageSvg: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#090418] via-[#1e0b36] to-[#3b0764]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="720" cy="390" r="185" fill="url(#sunGrad)" opacity="0.8" />
          <polygon points="0,480 220,370 430,450 670,350 920,460 1190,360 1440,480 1440,800 0,800" fill="#090418" />
          <g stroke="#22d3ee" strokeWidth="1.5" opacity="0.45">
            <line x1="0" y1="480" x2="1440" y2="480" />
            <line x1="0" y1="520" x2="1440" y2="520" />
            <line x1="0" y1="570" x2="1440" y2="570" />
            <line x1="0" y1="635" x2="1440" y2="635" />
            <line x1="0" y1="715" x2="1440" y2="715" />
            <line x1="720" y1="480" x2="-200" y2="800" />
            <line x1="720" y1="480" x2="150" y2="800" />
            <line x1="720" y1="480" x2="460" y2="800" />
            <line x1="720" y1="480" x2="720" y2="800" />
            <line x1="720" y1="480" x2="980" y2="800" />
            <line x1="720" y1="480" x2="1290" y2="800" />
            <line x1="720" y1="480" x2="1640" y2="800" />
          </g>
        </svg>
      </div>
    ),
  },
  jungle: {
    id: 'jungle',
    name: 'Jungle Safari',
    subtitle: 'Tropical Leaves & Explorer Compass',
    badge: '🌴 Jungle Safari',
    cardFont: "font-['Fredoka',sans-serif]",
    previewBg: 'linear-gradient(135deg, #065f46 0%, #10b981 55%, #f59e0b 100%)',
    deckCardBg: 'bg-gradient-to-b from-amber-100 to-amber-200 border-amber-700 text-amber-800',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-36 sm:h-36 text-amber-800/75 fill-current">
        <circle cx="60" cy="60" r="46" fill="none" stroke="currentColor" strokeWidth="6" />
        <polygon points="60,18 70,50 102,60 70,70 60,102 50,70 18,60 50,50" />
        <circle cx="60" cy="60" r="8" fill="#fef3c7" />
      </svg>
    ),
    stageSvg: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#064e3b] via-[#047857] to-[#065f46]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <polygon points="200,0 450,0 900,800 400,800" fill="#fef08a" opacity="0.08" />
          <polygon points="700,0 950,0 1350,800 950,800" fill="#fef08a" opacity="0.08" />
          <path d="M0 560 Q360 450 720 550 T1440 520 L1440 800 L0 800 Z" fill="#065f46" opacity="0.8" />
          <path d="M0 640 Q420 540 860 640 T1440 600 L1440 800 L0 800 Z" fill="#022c22" opacity="0.7" />
          <path d="M120,0 Q150,180 90,320" stroke="#10b981" strokeWidth="8" fill="none" opacity="0.5" />
          <path d="M1320,0 Q1260,210 1340,360" stroke="#10b981" strokeWidth="8" fill="none" opacity="0.5" />
        </svg>
      </div>
    ),
  },
  space: {
    id: 'space',
    name: 'Space Odyssey',
    subtitle: 'Galactic Planets & Starfleet Rocket',
    badge: '🚀 Space Odyssey',
    cardFont: "font-['Inter',sans-serif]",
    previewBg: 'linear-gradient(135deg, #090d16 0%, #1e3a8a 55%, #38bdf8 100%)',
    deckCardBg: 'bg-gradient-to-b from-indigo-950 to-slate-900 border-sky-400 text-sky-400',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-36 sm:h-36 text-sky-400 fill-current drop-shadow">
        <path d="M60 14 C78 34, 82 62, 78 82 L94 96 L76 96 L60 88 L44 96 L26 96 L42 82 C38 62, 42 34, 60 14 Z" />
        <circle cx="60" cy="52" r="10" fill="#0f172a" />
      </svg>
    ),
    stageSvg: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-[#030712] via-[#0f172a] to-[#1e1b4b]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <g fill="#ffffff" opacity="0.8">
            <circle cx="150" cy="120" r="2" />
            <circle cx="380" cy="80" r="3" />
            <circle cx="620" cy="160" r="1.5" />
            <circle cx="890" cy="95" r="2.5" />
            <circle cx="1180" cy="150" r="2" />
            <circle cx="1350" cy="70" r="3" />
            <circle cx="240" cy="340" r="2" />
            <circle cx="1060" cy="310" r="2.5" />
            <circle cx="1290" cy="410" r="1.5" />
          </g>
          <g className="float-slow" transform="translate(1050, 140)">
            <circle cx="120" cy="120" r="85" fill="#6366f1" />
            <ellipse cx="120" cy="125" rx="155" ry="32" fill="none" stroke="#38bdf8" strokeWidth="12" opacity="0.65" transform="rotate(-18 120 120)" />
          </g>
          <circle cx="210" cy="210" r="55" fill="#f43f5e" opacity="0.65" />
        </svg>
      </div>
    ),
  },
  classroom: {
    id: 'classroom',
    name: 'Classic Chalkboard',
    subtitle: 'Warm Green Board & Gold Trophy',
    badge: '🏫 Chalkboard',
    cardFont: "font-['Fredoka',sans-serif]",
    previewBg: 'linear-gradient(135deg, #14532d 0%, #166534 60%, #ca8a04 100%)',
    deckCardBg: 'bg-gradient-to-b from-amber-50 to-orange-100 border-amber-400 text-amber-600',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-28 h-28 sm:w-36 sm:h-36 text-amber-500 fill-current drop-shadow">
        <polygon points="60,15 73,44 105,48 81,70 87,102 60,86 33,102 39,70 15,48 47,44" />
      </svg>
    ),
    stageSvg: (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute inset-0 bg-[#1b4332] border-[16px] border-[#92400e]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full opacity-20">
          <text x="120" y="160" fill="#ffffff" fontSize="42" fontFamily="serif">A B C • 1 2 3</text>
          <circle cx="1240" cy="180" r="70" fill="none" stroke="#ffffff" strokeWidth="4" strokeDasharray="10 8" />
        </svg>
      </div>
    ),
  },
};

export interface FlashcardItem {
  id: string | number;
  frontText: string;
  backText: string;
  frontMedia?: string;
  backMedia?: string;
}

const BLANK_CARD = (idSuffix: string = ''): FlashcardItem => ({
  id: `card_${Date.now()}_${idSuffix || Math.random().toString(36).substring(2, 6)}`,
  frontText: '',
  backText: '',
  frontMedia: '',
  backMedia: '',
});

export function FlashcardsMatch({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  // Setup / Activity Metadata
  const [topic, setTopic] = useState('');
  const [classLevel, setClassLevel] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  // Config: 1-Sided vs 2-Sided & Content Mode & Theme
  const [cardSides, setCardSides] = useState<1 | 2>(2); // 1 = Single Side, 2 = Double-Side Flip
  const [contentMode, setContentMode] = useState<'text' | 'photo' | 'both'>('both');
  const [theme, setTheme] = useState<'london' | 'cyber' | 'jungle' | 'space' | 'classroom'>('london');
  const [cards, setCards] = useState<FlashcardItem[]>([BLANK_CARD('1')]);

  // Play / Dealer State
  const [screen, setScreen] = useState<'setup' | 'play'>('setup');
  const [undealtDeck, setUndealtDeck] = useState<FlashcardItem[]>([]);
  const [dealtHistory, setDealtHistory] = useState<FlashcardItem[]>([]);
  const [currentCard, setCurrentCard] = useState<FlashcardItem | null>(null);
  const [isCurrentFlipped, setIsCurrentFlipped] = useState<boolean>(false);
  const [dealFrontFirst, setDealFrontFirst] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Timer & Controls
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);

  // Modals & UI Helpers
  const [showModeModal, setShowModeModal] = useState<boolean>(false);
  const [showPlayThemeModal, setShowPlayThemeModal] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string | null>(
    initialGame?.id && !String(initialGame.id).startsWith('sample-') ? initialGame.id : null
  );
  const [shuffleBeforeDeal, setShuffleBeforeDeal] = useState<boolean>(true);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState<boolean>(false);
  const [showHowToBulkModal, setShowHowToBulkModal] = useState<boolean>(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showSpotlightModal, setShowSpotlightModal] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [bulkReplace, setBulkReplace] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Active Media Picker target: { cardIndex: number; side: 'front' | 'back' } | null
  const [activeMediaTarget, setActiveMediaTarget] = useState<{
    cardIndex: number;
    side: 'front' | 'back';
    query?: string;
  } | null>(null);

  // Web Audio Synthesizer ref
  const audioCtxRef = useRef<AudioContext | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2800);
  };

  // Convert incoming initialGame
  useEffect(() => {
    if (initialGame) {
      if (initialGame.id && !String(initialGame.id).startsWith('sample-')) {
        setGameId(initialGame.id);
      }
      const gTopic = initialGame.topic || initialGame.name || initialGame.title || 'Flashcards';
      setTopic(gTopic);
      if (initialGame.className || initialGame.classLevel) {
        setClassLevel(initialGame.className || initialGame.classLevel);
      }
      if (initialGame.folderId) setFolderId(initialGame.folderId);
      if (initialGame.cardSides === 1 || initialGame.cardSides === 2) {
        setCardSides(initialGame.cardSides);
      }
      if (initialGame.contentMode) setContentMode(initialGame.contentMode);
      if (initialGame.theme && THEMES[initialGame.theme]) setTheme(initialGame.theme);

      if (Array.isArray(initialGame.cards) && initialGame.cards.length > 0) {
        setCards(initialGame.cards);
      } else if (
        Array.isArray(initialGame.customQuestions) &&
        initialGame.customQuestions.length > 0
      ) {
        const converted: FlashcardItem[] = initialGame.customQuestions.map((q: any, i: number) => {
          const parsedPrompt = parseOptionContent(q.text || '');
          const opt0 = q.options?.[q.answerIndex || 0] || q.options?.[0] || '';
          const parsedAns = parseOptionContent(opt0);
          return {
            id: q.id || `c_${Date.now()}_${i}`,
            frontText: parsedPrompt.text || q.text || '',
            frontMedia: parsedPrompt.imageUrl || q.image || '',
            backText: parsedAns.text || opt0 || '',
            backMedia: parsedAns.imageUrl || '',
          };
        });
        setCards(converted);
      }

      if (!initialGame.editMode) {
        setScreen('play');
      }
    }
  }, [initialGame]);

  // Load Folders from Firestore
  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const snap = await getDocs(qFolders);
          const f: any[] = [];
          snap.forEach((d) => f.push({ id: d.id, ...d.data() }));
          setFolders(f);
        } catch (err) {
          console.warn('Could not load folders:', err);
        }
      };
      fetchFolders();
    }
  }, [user]);

  // Play Timer effect
  useEffect(() => {
    if (screen !== 'play' || isTimerPaused) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, isTimerPaused]);

  // Web Audio Synth
  const playSoundFx = (type: 'deal' | 'flip' | 'undo' | 'shuffle') => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) audioCtxRef.current = new AudioCtxClass();
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      if (type === 'deal') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.09);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } else if (type === 'flip') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.11);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'undo') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'shuffle') {
        for (let i = 0; i < 6; i++) {
          const t = now + i * 0.055;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(300 + i * 65, t);
          gain.gain.setValueAtTime(0.14, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.045);
        }
      }
    } catch {}
  };

  // Keyboard Navigation in Play Mode
  useEffect(() => {
    if (screen !== 'play') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showSpotlightModal) {
        if (e.key === 'Escape') setShowSpotlightModal(false);
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowRight') {
        e.preventDefault();
        handleDealNext();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'KeyF') {
        if (cardSides === 2 && currentCard) {
          e.preventDefault();
          handleFlip();
        }
      } else if (e.code === 'ArrowLeft' || e.code === 'Backspace') {
        e.preventDefault();
        handleUndo();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        handleShuffle();
      } else if (e.code === 'Escape') {
        setScreen('setup');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, cardSides, currentCard, showSpotlightModal, undealtDeck, dealtHistory, isCurrentFlipped, dealFrontFirst]);

  // Game Action Handlers
  const handlePlayButtonClick = () => {
    const valid = cards.filter(
      (c) =>
        (c.frontText && c.frontText.trim()) ||
        (c.backText && c.backText.trim()) ||
        c.frontMedia ||
        c.backMedia
    );
    if (valid.length === 0) {
      showToast('Please add at least 1 card with text or media before playing!');
      return;
    }
    setShowPlayThemeModal(true);
  };

  const handleStartPlay = (shouldShuffle: boolean = shuffleBeforeDeal) => {
    const valid = cards.filter(
      (c) =>
        (c.frontText && c.frontText.trim()) ||
        (c.backText && c.backText.trim()) ||
        c.frontMedia ||
        c.backMedia
    );
    if (valid.length === 0) {
      showToast('Please add at least 1 card with text or media!');
      return;
    }
    let deck = [...valid];
    if (shouldShuffle) {
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    setUndealtDeck(deck);
    setDealtHistory([]);
    setCurrentCard(null);
    setIsCurrentFlipped(cardSides === 2 ? !dealFrontFirst : false);
    setTimerSeconds(0);
    setIsTimerPaused(false);
    setShowPlayThemeModal(false);
    setScreen('play');
    playSoundFx('shuffle');
  };

  const handleDealNext = () => {
    if (undealtDeck.length === 0) {
      showToast('All cards dealt! Click Shuffle to deal again.');
      return;
    }
    const [next, ...rest] = undealtDeck;
    setUndealtDeck(rest);
    setDealtHistory((prev) => [...prev, next]);
    setCurrentCard(next);
    setIsCurrentFlipped(cardSides === 2 ? !dealFrontFirst : false);
    playSoundFx('deal');
  };

  const handleUndo = () => {
    if (dealtHistory.length === 0) return;
    const historyCopy = [...dealtHistory];
    const returned = historyCopy.pop()!;
    setDealtHistory(historyCopy);
    setUndealtDeck((prev) => [returned, ...prev]);
    setCurrentCard(historyCopy[historyCopy.length - 1] || null);
    setIsCurrentFlipped(cardSides === 2 ? !dealFrontFirst : false);
    playSoundFx('undo');
  };

  const handleFlip = () => {
    if (cardSides !== 2 || !currentCard) return;
    setIsCurrentFlipped((prev) => !prev);
    playSoundFx('flip');
  };

  const handleShuffle = () => {
    const combined = [...dealtHistory, ...undealtDeck];
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    setUndealtDeck(combined);
    setDealtHistory([]);
    setCurrentCard(null);
    setIsCurrentFlipped(!dealFrontFirst);
    playSoundFx('shuffle');
    showToast('Deck shuffled!');
  };

  const handleRequeueCurrent = () => {
    if (!currentCard) return;
    const historyCopy = [...dealtHistory];
    const popped = historyCopy.pop()!;
    setDealtHistory(historyCopy);
    const insertIdx = Math.floor(Math.random() * (undealtDeck.length + 1));
    const deckCopy = [...undealtDeck];
    deckCopy.splice(insertIdx, 0, popped);
    setUndealtDeck(deckCopy);
    setCurrentCard(historyCopy[historyCopy.length - 1] || null);
    playSoundFx('undo');
    showToast('Card placed back into deck for review!');
  };

  // Text To Speech
  const speakCard = (side: 'front' | 'back') => {
    if (!currentCard || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const raw = side === 'front' ? currentCard.frontText : currentCard.backText;
    if (!raw) return;
    const u = new SpeechSynthesisUtterance(raw.replace(/\n/g, ' '));
    const isVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(raw);
    u.lang = isVietnamese ? 'vi-VN' : 'en-US';
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  // Save to Firebase with Publish / Private prompt
  const handleSaveClick = () => {
    const valid = cards.filter((c) => {
      if (cardSides === 1) {
        return Boolean(c.frontText?.trim() || c.frontMedia?.trim());
      }
      return Boolean(
        c.frontText?.trim() ||
        c.backText?.trim() ||
        c.frontMedia?.trim() ||
        c.backMedia?.trim()
      );
    });

    if (valid.length === 0) {
      showToast('⚠️ Please add at least one complete card before saving.');
      return;
    }

    if (!user) {
      showToast('⚠️ Please log in to save your game to your account.');
      return;
    }

    setShowPublishModal(true);
  };

  const confirmSave = async (isPublic: boolean) => {
    setShowPublishModal(false);
    setIsSaving(true);

    const valid = cards.filter((c) => {
      if (cardSides === 1) {
        return Boolean(c.frontText?.trim() || c.frontMedia?.trim());
      }
      return Boolean(
        c.frontText?.trim() ||
        c.backText?.trim() ||
        c.frontMedia?.trim() ||
        c.backMedia?.trim()
      );
    });

    if (valid.length === 0) {
      setIsSaving(false);
      showToast('⚠️ Please add at least one card.');
      return;
    }

    if (!user) {
      setIsSaving(false);
      showToast('⚠️ Please sign in to save your game to the cloud.');
      return;
    }

    try {
      const now = new Date().toISOString();
      const isPublicBool = Boolean(isPublic);

      // Build questions for full multi-mode compatibility (Bubble Pop, Roller Coaster, Shark Attack, etc.)
      const optMode = contentMode === 'photo' ? 'photos_gifs' : contentMode === 'text' ? 'words' : 'both';
      const formattedQuestions = valid.map((c, i) => {
        const id = c.id || `q_${i + 1}`;
        if (cardSides === 1) {
          // 1-Side Card
          const text = c.frontText?.trim() || topic || 'Flashcard';
          const directImg = isDirectMediaUrl(c.frontMedia || '') ? c.frontMedia : undefined;

          const correctOpt = formatOptionContent(
            text,
            directImg ? c.frontMedia : null,
            optMode
          );

          const otherCards = valid.filter((_, idx) => idx !== i);
          const distractors = otherCards.slice(0, 3).map((oc) => {
            const ocImg = isDirectMediaUrl(oc.frontMedia || '') ? oc.frontMedia : null;
            return formatOptionContent(
              oc.frontText?.trim() || 'Option',
              ocImg,
              optMode
            );
          });

          while (distractors.length < 1) {
            distractors.push('Other Option');
          }

          return {
            id,
            text,
            image: directImg,
            options: [correctOpt, ...distractors],
            answerIndex: 0,
          };
        } else {
          // 2-Side Card
          const promptText = c.frontText?.trim() || 'Question';
          const promptImg = isDirectMediaUrl(c.frontMedia || '') ? c.frontMedia : undefined;

          const answerText = c.backText?.trim() || promptText;
          const answerImg = isDirectMediaUrl(c.backMedia || '') ? c.backMedia : null;
          const correctOpt = formatOptionContent(
            answerText,
            answerImg,
            optMode
          );

          const otherCards = valid.filter((_, idx) => idx !== i);
          const distractors = otherCards.slice(0, 3).map((oc) => {
            const ocAns = oc.backText?.trim() || oc.frontText?.trim() || 'Option';
            const ocImg = isDirectMediaUrl(oc.backMedia || '') ? oc.backMedia : null;
            return formatOptionContent(
              ocAns,
              ocImg,
              optMode
            );
          });

          while (distractors.length < 1) {
            distractors.push('Other Option');
          }

          return {
            id,
            text: promptText,
            image: promptImg,
            options: [correctOpt, ...distractors],
            answerIndex: 0,
          };
        }
      });

      const payload: any = {
        name: topic || 'Flashcard Deck',
        title: topic || 'Flashcard Deck',
        topic: topic || '',
        className: classLevel || '',
        classLevel: classLevel || '',
        folderId: folderId || '',
        gameType: 'flashcards-match',
        cardSides,
        contentMode,
        theme,
        cards: valid,
        questions: formattedQuestions,
        customQuestions: formattedQuestions,
        isPublic: isPublicBool,
        publishedAt: isPublicBool ? (initialGame?.publishedAt || now) : null,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || 'Teacher',
        creatorEmail: user.email || '',
        updatedAt: now,
      };

      const targetId = gameId || (initialGame?.id && !String(initialGame.id).startsWith('sample-') ? initialGame.id : null);

      if (targetId) {
        await updateDoc(doc(db, 'mysteryBoxGames', targetId), payload);
        showToast(isPublicBool ? '🚀 Published flashcards to Community!' : '🔒 Saved private flashcard deck!');
      } else {
        payload.createdAt = now;
        const docRef = await addDoc(collection(db, 'mysteryBoxGames'), payload);
        setGameId(docRef.id);
        showToast(isPublicBool ? '🚀 Published flashcards to Community!' : '🔒 Saved private flashcard deck!');
      }
    } catch (err: any) {
      console.error('Could not save flashcard deck:', err);
      showToast('⚠️ Could not save deck to cloud. Check network or log in again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Paste Handler
  const handleApplyBulkPaste = () => {
    if (!bulkText.trim()) return;
    const lines = bulkText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsed: FlashcardItem[] = lines.map((line, i) => {
      const parts = line.includes('|') ? line.split('|') : line.split('\t');
      return {
        id: `bulk_${Date.now()}_${i}`,
        frontText: (parts[0] || '').trim(),
        backText: (parts[1] || '').trim(),
        frontMedia: (parts[2] || '✨').trim(),
        backMedia: (parts[3] || '').trim(),
      };
    });

    if (bulkReplace) {
      setCards(parsed);
    } else {
      setCards((prev) => [...prev, ...parsed].slice(0, 50));
    }
    setShowBulkPasteModal(false);
    setBulkText('');
    showToast(`✨ Imported ${parsed.length} flashcards!`);
  };

  // Card list mutation helpers
  const updateCard = (idx: number, field: keyof FlashcardItem, val: string) => {
    setCards((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const duplicateCard = (idx: number) => {
    if (cards.length >= 50) {
      showToast('Max 50 cards per deck reached');
      return;
    }
    const copy = { ...cards[idx], id: `c_${Date.now()}` };
    const nextCards = [...cards];
    nextCards.splice(idx + 1, 0, copy);
    setCards(nextCards);
  };

  const deleteCard = (idx: number) => {
    if (cards.length <= 1) {
      showToast('Deck must have at least 1 card!');
      return;
    }
    setCards((prev) => prev.filter((_, i) => i !== idx));
  };

  const swapSingleCard = (idx: number) => {
    setCards((prev) => {
      const copy = [...prev];
      const c = copy[idx];
      copy[idx] = {
        ...c,
        frontText: c.backText,
        backText: c.frontText,
        frontMedia: c.backMedia,
        backMedia: c.frontMedia,
      };
      return copy;
    });
    playSoundFx('flip');
  };

  const swapAllSides = () => {
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        frontText: c.backText,
        backText: c.frontText,
        frontMedia: c.backMedia,
        backMedia: c.frontMedia,
      }))
    );
    playSoundFx('flip');
    showToast('Swapped Front & Back for all cards!');
  };

  const renderCardMediaBox = (media?: string) => {
    if (!media) return null;
    if (isDirectMediaUrl(media)) {
      return (
        <div className="w-full h-full max-h-[440px] rounded-3xl overflow-hidden shadow-xl border-4 border-slate-100 bg-white flex items-center justify-center p-3">
          <img src={media} alt="Card visual" className="w-full h-full object-contain rounded-2xl" />
        </div>
      );
    }
    return (
      <div className="w-full h-full max-h-[440px] rounded-3xl bg-slate-100/75 border-2 border-slate-200/80 shadow-inner flex items-center justify-center p-6">
        <div className="text-[7rem] sm:text-[9.5rem] lg:text-[12rem] xl:text-[14rem] leading-none select-none drop-shadow-md">
          {media}
        </div>
      </div>
    );
  };

  const renderCardContentHTML = (text: string, media?: string) => {
    const showText = contentMode === 'text' || contentMode === 'both';
    const showPhoto = contentMode === 'photo' || contentMode === 'both';
    const hasText = Boolean(showText && text && text.trim() !== '');
    const hasMedia = Boolean(showPhoto && media && media.trim() !== '');
    const themeObj = THEMES[theme] || THEMES.london;

    if (hasText && hasMedia) {
      const len = text.trim().length;
      let sizeClass = 'text-3xl sm:text-5xl lg:text-6xl xl:text-7xl';
      if (len > 55) sizeClass = 'text-xl sm:text-2xl lg:text-3xl';
      else if (len > 28) sizeClass = 'text-2xl sm:text-4xl lg:text-5xl';

      return (
        <div className="w-full h-full grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-8 items-center">
          <div className="md:col-span-7 h-full flex flex-col items-center md:items-start justify-center text-center md:text-left px-2 sm:px-6 overflow-y-auto">
            <div className={`${themeObj.cardFont} ${sizeClass} font-extrabold text-slate-900 tracking-tight leading-[1.15] break-words w-full`}>
              {text.split('\n').map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < text.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="md:col-span-5 h-full flex items-center justify-center min-h-0">
            {renderCardMediaBox(media)}
          </div>
        </div>
      );
    }

    if (hasMedia && !hasText) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          {renderCardMediaBox(media)}
        </div>
      );
    }

    if (hasText && !hasMedia) {
      const len = text.trim().length;
      let sizeClass = 'text-4xl sm:text-6xl lg:text-7xl xl:text-8xl';
      if (len > 60) sizeClass = 'text-2xl sm:text-4xl lg:text-5xl';
      else if (len > 30) sizeClass = 'text-3xl sm:text-5xl lg:text-6xl';

      return (
        <div className="w-full h-full flex items-center justify-center text-center px-4">
          <div className={`${themeObj.cardFont} ${sizeClass} font-extrabold text-slate-900 tracking-tight leading-tight break-words max-w-full`}>
            {text.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < text.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-slate-400 italic text-xl">(Empty Side)</div>;
  };

  const themeObj = THEMES[theme] || THEMES.london;

  return (
    <div
      id="flashcard-game-container"
      className="w-full min-h-full flex-1 bg-slate-100 text-slate-800 flex flex-col font-['Inter',sans-serif] overflow-x-hidden relative rounded-xl select-none"
    >
      <style>{`
        .perspective-1200 { perspective: 1400px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .card-flip-inner {
          transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
          transform-style: preserve-3d;
        }
        .card-flip-inner.is-flipped {
          transform: rotateY(180deg);
        }
        @keyframes dealFlyIn {
          0% {
            opacity: 0;
            transform: translate3d(-340px, -30px, 120px) scale(0.72) rotateZ(-8deg) rotateY(-65deg);
          }
          65% {
            opacity: 1;
            transform: translate3d(14px, -6px, 30px) scale(1.03) rotateZ(1.5deg) rotateY(6deg);
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1) rotateZ(0deg) rotateY(0deg);
          }
        }
        .animate-deal {
          animation: dealFlyIn 0.52s cubic-bezier(0.2, 0.9, 0.3, 1.05) forwards;
        }
        @keyframes undoFlyBack {
          0% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(-320px, -20px, 80px) scale(0.7) rotateZ(-10deg);
          }
        }
        .animate-undo {
          animation: undoFlyBack 0.36s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes shuffleRiffleLeft {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-36px, -18px) rotate(-9deg); }
          50% { transform: translate(22px, 10px) rotate(6deg); }
          75% { transform: translate(-15px, 6px) rotate(-4deg); }
        }
        .animate-shuffle {
          animation: shuffleRiffleLeft 0.55s ease-in-out;
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .float-slow {
          animation: floatSlow 5s ease-in-out infinite;
        }
        @keyframes busDrive {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(18px); }
        }
        .bus-bob {
          animation: busDrive 8s ease-in-out infinite;
        }
      `}</style>

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-[100] px-4 py-2.5 rounded-2xl bg-slate-900 text-white border border-slate-700 shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 1: GAME SETUP VIEW (MODERN EDTECH DASHBOARD)         */}
      {/* ========================================================= */}
      {screen === 'setup' && (
        <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
          <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
            <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
              {/* Top Header Card */}
              <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onViewChange('home')}
                      className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-2"
                    >
                      <ArrowLeft size={18} />
                      <span>Cancel</span>
                    </button>
                    <div>
                      <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                        FLASHCARD SETUP
                      </h2>
                    </div>
                  </div>

                  <div className="flex gap-2.5 items-center flex-wrap">
                    <button
                      onClick={() => setShowModeModal(true)}
                      className="px-4 py-2.5 rounded-xl text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 font-bold transition flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <Shuffle size={16} />
                      <span>Switch Mode</span>
                    </button>
                    <button
                      onClick={handleSaveClick}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer text-sm disabled:opacity-60"
                    >
                      <Save size={18} />
                      <span>{isSaving ? 'Saving...' : 'Save Quiz'}</span>
                    </button>
                    <button
                      onClick={handlePlayButtonClick}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold transition-all shadow-lg shadow-emerald-500/30 active:scale-95 cursor-pointer text-sm"
                    >
                      <Play size={18} className="fill-current" />
                      <span>Play Game</span>
                    </button>
                  </div>
                </div>

                {/* Row 1: Topic, Class Level, Folder */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Topic */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                      Topic
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Animals, Feelings, Daily Routine..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                    />
                  </div>

                  {/* Class Level */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Class Level
                      </label>
                      <div className="flex gap-1">
                        {['Starters', 'Grade 5', 'IELTS'].map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setClassLevel(lvl)}
                            className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 hover:text-indigo-600 font-medium text-slate-600 dark:text-slate-300 transition cursor-pointer"
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Kindergarten, Grade 3, Starters..."
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
                    />
                  </div>

                  {/* Folder */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Folder
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewFolderModal(true)}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <FolderPlus size={12} />
                        <span>+ New Folder</span>
                      </button>
                    </div>
                    <div className="relative">
                      <select
                        value={folderId}
                        onChange={(e) => setFolderId(e.target.value)}
                        className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-3.5 py-2.5 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors pr-8"
                      >
                        <option value="">No Folder (Root Library)</option>
                        <option value="Vocabulary & Idioms">Vocabulary &amp; Idioms</option>
                        <option value="Grammar Drills">Grammar Drills</option>
                        <option value="Cambridge Starters/Movers">Cambridge Starters/Movers</option>
                        {folders.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 2: Card Side Mode & Option Content Mode */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card Side Mode */}
                  <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <ArrowLeftRight size={15} />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                          Card Side Mode
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {cardSides === 1 ? '1-Sided: Deals face-up' : '2-Sided: Flip Front & Back'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 bg-slate-200/75 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setCardSides(1)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          cardSides === 1
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <Square size={13} />
                        <span>1-Side</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCardSides(2)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          cardSides === 2
                            ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <RotateCw size={13} />
                        <span>Double-Side</span>
                      </button>
                    </div>
                  </div>

                  {/* Option Content Mode */}
                  <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <Layers size={15} />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                          Option Content Mode
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {contentMode === 'text'
                            ? 'Text Only'
                            : contentMode === 'photo'
                            ? 'Photos Only'
                            : 'Word & Picture'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 bg-slate-200/75 dark:bg-slate-800 p-1 rounded-xl gap-1 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => setContentMode('text')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          contentMode === 'text'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <span>Text Only</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentMode('photo')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          contentMode === 'photo'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <span>Photos</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setContentMode('both')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                          contentMode === 'both'
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        <Sparkles size={13} />
                        <span>Word &amp; Pic</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards / Questions List Area */}
              <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
                {/* Action Bar */}
                <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                    Cards ({cards.length})
                  </span>
                  <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    {cardSides === 2 && (
                      <button
                        type="button"
                        onClick={swapAllSides}
                        className="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowLeftRight size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Swap All Front/Back</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowBulkPasteModal(true)}
                      className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer"
                    >
                      <span>Bulk Paste</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowHowToBulkModal(true)}
                      className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer border border-purple-400/30"
                    >
                      <Play size={13} className="fill-current" />
                      <span>How to Bulk Paste</span>
                    </button>
                  </div>
                </div>

                {/* Card Items */}
                <div className="flex flex-col gap-4">
                  {cards.map((card, idx) => {
                    const showTextInput = contentMode === 'text' || contentMode === 'both';
                    const showMediaBtn = contentMode === 'photo' || contentMode === 'both';

                    if (cardSides === 1) {
                      // 1-SIDED CARD LAYOUT
                      return (
                        <div
                          key={card.id}
                          className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group"
                        >
                          <button
                            type="button"
                            onClick={() => duplicateCard(idx)}
                            title="Duplicate Card"
                            className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCard(idx)}
                            title="Delete Card"
                            className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                          >
                            <Trash2 size={14} />
                          </button>

                          <div className="flex gap-4 items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                              {idx + 1}
                            </div>

                            <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                              {showTextInput ? (
                                <input
                                  type="text"
                                  value={card.frontText.replace(/\n/g, ' ')}
                                  onChange={(e) => updateCard(idx, 'frontText', e.target.value)}
                                  placeholder="Type card word, phrase, or question here..."
                                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-blue-500 outline-none text-sm font-semibold transition"
                                />
                              ) : (
                                <div className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <ImageIcon size={16} className="text-purple-500" />
                                  <span>Photo-Only Mode: Select an image on the right</span>
                                </div>
                              )}

                              {showMediaBtn && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMediaTarget({
                                      cardIndex: idx,
                                      side: 'front',
                                      query: card.frontText || '',
                                    })
                                  }
                                  className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition cursor-pointer"
                                >
                                  {card.frontMedia ? (
                                    isDirectMediaUrl(card.frontMedia) ? (
                                      <>
                                        <img
                                          src={card.frontMedia}
                                          alt="Media"
                                          className="w-6 h-6 rounded object-cover border border-purple-300"
                                        />
                                        <span>Change Pic</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-lg leading-none">{card.frontMedia}</span>
                                        <span>Media</span>
                                      </>
                                    )
                                  ) : (
                                    <>
                                      <ImageIcon size={16} />
                                      <span>Add Media</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // 2-SIDED (DOUBLE-SIDED FLIP) CARD LAYOUT
                    return (
                      <div
                        key={card.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group space-y-4"
                      >
                        <button
                          type="button"
                          onClick={() => duplicateCard(idx)}
                          title="Duplicate Card"
                          className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCard(idx)}
                          title="Delete Card"
                          className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                        >
                          <Trash2 size={14} />
                        </button>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                              {idx + 1}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              2-Sided Flip Card
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => swapSingleCard(idx)}
                            title="Swap Front & Back of this card"
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <ArrowLeftRight size={13} />
                            <span>Swap Sides</span>
                          </button>
                        </div>

                        {/* Two Columns: Front Side & Back Side */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {/* FRONT SIDE */}
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                Front Side (Word / Prompt)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {showTextInput ? (
                                <input
                                  type="text"
                                  value={card.frontText.replace(/\n/g, ' ')}
                                  onChange={(e) => updateCard(idx, 'frontText', e.target.value)}
                                  placeholder="Front text (e.g. apple, happy, dog)..."
                                  className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white focus:border-emerald-500 outline-none text-sm font-semibold transition"
                                />
                              ) : (
                                <div className="flex-1 text-xs text-slate-400 italic px-2">
                                  Photo-only front side
                                </div>
                              )}
                              {showMediaBtn && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMediaTarget({
                                      cardIndex: idx,
                                      side: 'front',
                                      query: card.frontText || '',
                                    })
                                  }
                                  className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                                >
                                  {card.frontMedia ? (
                                    isDirectMediaUrl(card.frontMedia) ? (
                                      <>
                                        <img
                                          src={card.frontMedia}
                                          alt="Front pic"
                                          className="w-6 h-6 rounded object-cover border border-purple-300"
                                        />
                                        <span>Pic</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-base">{card.frontMedia}</span>
                                        <span>Pic</span>
                                      </>
                                    )
                                  ) : (
                                    <>
                                      <ImageIcon size={14} />
                                      <span>Pic</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* BACK SIDE */}
                          <div className="p-3.5 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                Back Side (Answer / Meaning)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {showTextInput ? (
                                <input
                                  type="text"
                                  value={card.backText.replace(/\n/g, ' ')}
                                  onChange={(e) => updateCard(idx, 'backText', e.target.value)}
                                  placeholder="Back text (e.g. quả táo, vui vẻ)..."
                                  className="flex-1 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-slate-900 dark:text-white focus:border-indigo-500 outline-none text-sm font-semibold transition"
                                />
                              ) : (
                                <div className="flex-1 text-xs text-indigo-400 italic px-2">
                                  Photo-only back side
                                </div>
                              )}
                              {showMediaBtn && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMediaTarget({
                                      cardIndex: idx,
                                      side: 'back',
                                      query: card.backText || '',
                                    })
                                  }
                                  className="px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs flex items-center gap-1.5 shrink-0 transition cursor-pointer"
                                >
                                  {card.backMedia ? (
                                    isDirectMediaUrl(card.backMedia) ? (
                                      <>
                                        <img
                                          src={card.backMedia}
                                          alt="Back pic"
                                          className="w-6 h-6 rounded object-cover border border-purple-300"
                                        />
                                        <span>Pic</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-base">{card.backMedia}</span>
                                        <span>Pic</span>
                                      </>
                                    )
                                  ) : (
                                    <>
                                      <ImageIcon size={14} />
                                      <span>Pic</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ADD ANOTHER FLASHCARD BUTTON */}
                <button
                  type="button"
                  onClick={() => {
                    if (cards.length >= 50) {
                      showToast('Maximum 50 cards per deck reached');
                      return;
                    }
                    setCards((prev) => [...prev, BLANK_CARD(String(prev.length + 1))]);
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Plus size={20} className="group-hover:scale-110 transition" />
                  <span>+ Add Another Flashcard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: FULL-SCREEN PLAY / CARD DEALER VIEW               */}
      {/* ========================================================= */}
      {screen === 'play' && (
        <div className="fixed inset-0 z-40 flex flex-col justify-between overflow-hidden select-none">
          {/* Dynamic Illustrated Background Stage */}
          {themeObj.stageSvg}

          {/* TOP HUD BAR */}
          <header className="relative z-20 px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between gap-4">
            {/* Left: Deck Title & Level */}
            <div className="flex items-center gap-3 bg-slate-900/45 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-white shadow-lg">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                {themeObj.badge.split(' ')[0]}
              </div>
              <div>
                <h2 className="font-bold text-sm sm:text-base leading-tight line-clamp-1">
                  {topic}
                </h2>
                <div className="flex items-center gap-2 text-[11px] text-white/80 font-medium">
                  <span>{classLevel}</span>
                  <span>•</span>
                  <span className="text-amber-300 font-semibold">
                    {cardSides === 2 ? '2-Sided Flip' : '1-Sided Direct'}
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Close / Back to Setup Button */}
            <button
              onClick={() => setScreen('setup')}
              title="Return to Game Setup (Esc)"
              className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/55 hover:bg-rose-600/90 text-white backdrop-blur-md border border-white/25 shadow-lg transition duration-200 cursor-pointer"
            >
              <X size={16} />
              <span className="text-xs font-bold tracking-wide hidden sm:inline">Edit Setup</span>
            </button>

            {/* Right: Progress Counter & Deal Direction Toggle */}
            <div className="flex items-center gap-2.5">
              {cardSides === 2 && (
                <div className="hidden md:flex items-center bg-slate-900/45 backdrop-blur-md p-1 rounded-xl border border-white/20 text-white text-xs">
                  <button
                    onClick={() => {
                      setDealFrontFirst(true);
                      if (currentCard) setIsCurrentFlipped(false);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      dealFrontFirst ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Front First
                  </button>
                  <button
                    onClick={() => {
                      setDealFrontFirst(false);
                      if (currentCard) setIsCurrentFlipped(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                      !dealFrontFirst ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    Back First
                  </button>
                </div>
              )}

              <div className="bg-slate-900/45 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-white shadow-lg flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
                    Dealt Cards
                  </div>
                  <div className="text-sm sm:text-base font-extrabold leading-none">
                    <span>{dealtHistory.length}</span>{' '}
                    <span className="text-white/50">/</span>{' '}
                    <span>{dealtHistory.length + undealtDeck.length}</span>
                  </div>
                </div>
                <div className="w-16 sm:w-24 h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-300"
                    style={{
                      width: `${
                        dealtHistory.length + undealtDeck.length > 0
                          ? Math.round(
                              (dealtHistory.length / (dealtHistory.length + undealtDeck.length)) * 100
                            )
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </header>

          {/* CENTER STAGE: LEFT 3D DECK STACK + RIGHT MASSIVE DEALT ACTIVE CARD */}
          <div className="relative z-10 flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 py-2 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-10 min-h-0">
            {/* LEFT COLUMN: 3D STACKED DECK */}
            <div className="w-full lg:w-[28%] xl:w-[26%] flex flex-col items-center justify-center shrink-0">
              <div
                onClick={handleDealNext}
                className="relative w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[380px] aspect-[4/3] cursor-pointer group select-none"
              >
                {/* Empty Deck Placeholder */}
                {undealtDeck.length === 0 ? (
                  <div className="absolute inset-0 rounded-3xl border-4 border-dashed border-white/40 bg-slate-900/30 backdrop-blur-sm flex flex-col items-center justify-center text-white/80 p-6 text-center">
                    <Layers size={48} className="text-white/60 mb-2" />
                    <p className="font-bold text-base">All Cards Dealt!</p>
                    <p className="text-xs text-white/70 mt-1">Click Shuffle to restart the deck</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 transition-transform duration-300 group-hover:-translate-y-1.5">
                    {/* Bottom 3D depth block */}
                    <div
                      className="absolute inset-x-0 top-3 bottom-0 rounded-3xl bg-slate-500/90 border-2 border-slate-600/80 shadow-[0_24px_45px_rgba(0,0,0,0.55)]"
                      style={{ transform: `translateY(${Math.min(undealtDeck.length, 6) * 7}px)` }}
                    />
                    {Array.from({ length: Math.min(undealtDeck.length, 6) })
                      .map((_, i) => i)
                      .reverse()
                      .map((i) => {
                        const offsetY = i * 5;
                        const isTop = i === 0;
                        return (
                          <div
                            key={i}
                            className={`absolute inset-0 rounded-3xl ${themeObj.deckCardBg} border-4 shadow-md flex items-center justify-center p-4 transition-all`}
                            style={{ transform: `translateY(${offsetY}px)` }}
                          >
                            <div className="w-full h-full rounded-2xl border-2 border-current/30 flex flex-col items-center justify-center relative">
                              <span className="absolute top-2 left-2 w-2.5 h-2.5 border-t-2 border-l-2 border-current/50" />
                              <span className="absolute top-2 right-2 w-2.5 h-2.5 border-t-2 border-r-2 border-current/50" />
                              <span className="absolute bottom-2 left-2 w-2.5 h-2.5 border-b-2 border-l-2 border-current/50" />
                              <span className="absolute bottom-2 right-2 w-2.5 h-2.5 border-b-2 border-r-2 border-current/50" />
                              {isTop && themeObj.emblemSvg}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Remaining counter pill under deck */}
              <div className="mt-6 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 text-white text-xs sm:text-sm font-bold shadow-md">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {undealtDeck.length > 0
                    ? `${undealtDeck.length} cards in deck — Click deck or Deal`
                    : '0 cards left in deck'}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: MASSIVE ACTIVE DEALT CARD AREA FITTING SCREEN */}
            <div className="w-full lg:w-[72%] xl:w-[74%] h-full flex flex-col items-center justify-center min-h-0">
              <div className="relative w-full h-[52vh] sm:h-[62vh] lg:h-[72vh] max-h-[700px] min-h-[350px] perspective-1200">
                {/* Waiting to Deal State */}
                {!currentCard ? (
                  <div
                    onClick={handleDealNext}
                    className="absolute inset-0 rounded-[2rem] border-4 border-dashed border-white/45 bg-white/10 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center cursor-pointer hover:bg-white/15 transition shadow-2xl"
                  >
                    <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-4 animate-bounce text-4xl">
                      👆
                    </div>
                    <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                      Ready to Deal!
                    </h3>
                    <p className="text-sm sm:text-base text-white/85 mt-2 max-w-md">
                      Click the deck on the left or press{' '}
                      <kbd className="px-2.5 py-1 bg-black/40 rounded-lg border border-white/30 font-mono">
                        Space
                      </kbd>{' '}
                      or <strong>Deal</strong> to draw your first flashcard.
                    </p>
                  </div>
                ) : (
                  /* Active Dealt Card Wrapper with Flip */
                  <div className="w-full h-full perspective-1200 animate-deal">
                    <div
                      onClick={() => (cardSides === 2 ? handleFlip() : handleDealNext())}
                      className={`card-flip-inner relative w-full h-full rounded-[2rem] cursor-pointer ${
                        cardSides === 2 && isCurrentFlipped ? 'is-flipped' : ''
                      }`}
                    >
                      {/* FRONT FACE OF DEALT CARD */}
                      <div className="backface-hidden absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white via-slate-50 to-slate-100 border-[6px] border-white shadow-[0_30px_70px_-15px_rgba(0,0,0,0.65)] flex flex-col justify-between p-5 sm:p-8 lg:p-10 overflow-hidden">
                        {/* Top Utility Bar */}
                        <div className="flex items-center justify-between gap-2 z-10 shrink-0">
                          <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wider bg-slate-900/10 text-slate-700">
                            {cardSides === 2 ? 'Front • Prompt' : 'Flashcard'}
                          </span>
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => speakCard('front')}
                              title="Listen (Text-to-Speech)"
                              className="w-11 h-11 rounded-2xl bg-slate-200/80 hover:bg-blue-600 hover:text-white text-slate-700 flex items-center justify-center transition shadow-sm cursor-pointer"
                            >
                              <Volume2 size={20} />
                            </button>
                            <button
                              onClick={() => setShowSpotlightModal(true)}
                              title="Classroom Spotlight Zoom"
                              className="w-11 h-11 rounded-2xl bg-slate-200/80 hover:bg-indigo-600 hover:text-white text-slate-700 flex items-center justify-center transition shadow-sm cursor-pointer"
                            >
                              <Maximize2 size={20} />
                            </button>
                          </div>
                        </div>

                        {/* Card Center Content */}
                        <div className="flex-1 min-h-0 w-full my-3 flex items-center justify-center overflow-hidden">
                          {renderCardContentHTML(currentCard.frontText, currentCard.frontMedia)}
                        </div>

                        {/* Card Bottom Footer */}
                        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 pt-3 border-t border-slate-200/90 z-10 shrink-0">
                          <span className="font-extrabold text-slate-400">
                            #{dealtHistory.length}
                          </span>
                          {cardSides === 2 && (
                            <span className="font-bold text-indigo-600 flex items-center gap-1.5 animate-pulse">
                              <RotateCw size={16} /> Click card or press Up/Down to Flip
                            </span>
                          )}
                          <div
                            className="flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={handleRequeueCurrent}
                              title="Put card back into deck to review again"
                              className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <RotateCw size={13} /> Again
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BACK FACE OF DEALT CARD (FOR 2-SIDED MODE) */}
                      {cardSides === 2 && (
                        <div className="backface-hidden rotate-y-180 absolute inset-0 rounded-[2rem] bg-gradient-to-b from-indigo-50 via-white to-blue-50 border-[6px] border-indigo-300 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.65)] flex flex-col justify-between p-5 sm:p-8 lg:p-10 overflow-hidden">
                          {/* Top Bar */}
                          <div className="flex items-center justify-between gap-2 z-10 shrink-0">
                            <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
                              Back • Answer / Meaning
                            </span>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => speakCard('back')}
                                title="Listen (Text-to-Speech)"
                                className="w-11 h-11 rounded-2xl bg-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-700 flex items-center justify-center transition shadow-sm cursor-pointer"
                              >
                                <Volume2 size={20} />
                              </button>
                              <button
                                onClick={() => setShowSpotlightModal(true)}
                                title="Classroom Spotlight Zoom"
                                className="w-11 h-11 rounded-2xl bg-indigo-100 hover:bg-indigo-600 hover:text-white text-indigo-700 flex items-center justify-center transition shadow-sm cursor-pointer"
                              >
                                <Maximize2 size={20} />
                              </button>
                            </div>
                          </div>

                          {/* Back Center Content */}
                          <div className="flex-1 min-h-0 w-full my-3 flex items-center justify-center overflow-hidden">
                            {renderCardContentHTML(currentCard.backText, currentCard.backMedia)}
                          </div>

                          {/* Back Bottom Footer */}
                          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 pt-3 border-t border-indigo-100 z-10 shrink-0">
                            <span className="font-extrabold text-indigo-400">
                              #{dealtHistory.length}
                            </span>
                            <span className="font-bold text-indigo-600 flex items-center gap-1.5">
                              <RotateCw size={16} /> Click card to Flip to Front
                            </span>
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={handleRequeueCurrent}
                                title="Put card back in deck to review later"
                                className="px-3.5 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <RotateCw size={13} /> Review Again
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* BOTTOM CONTROL DOCK */}
          <footer className="relative z-20 px-4 sm:px-8 pb-4 pt-2 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-t from-black/65 via-black/30 to-transparent">
            {/* Left: Pause & Classroom Timer */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTimerPaused(!isTimerPaused)}
                title="Pause / Resume Timer"
                className="w-11 h-11 rounded-full bg-white text-slate-900 hover:bg-slate-200 shadow-lg flex items-center justify-center transition transform active:scale-95 cursor-pointer"
              >
                {isTimerPaused ? (
                  <Play size={18} className="fill-current text-emerald-600 ml-0.5" />
                ) : (
                  <Pause size={18} className="fill-current" />
                )}
              </button>
              <div className="px-3 py-1.5 rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/20 text-white text-xs font-mono font-bold tracking-wider">
                <span>
                  {String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:
                  {String(timerSeconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {/* Center: Main Dealer Controls (Shuffle | Undo | Flip | Deal) */}
            <div className="flex items-center gap-2 sm:gap-3 mx-auto">
              <button
                onClick={handleShuffle}
                className="px-5 sm:px-7 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 text-white font-semibold text-sm sm:text-base border-2 border-white/60 shadow-lg backdrop-blur-md transition transform active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Shuffle size={18} />
                <span>Shuffle</span>
              </button>

              <button
                onClick={handleUndo}
                disabled={dealtHistory.length === 0}
                className="px-5 sm:px-7 py-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/90 text-white font-semibold text-sm sm:text-base border-2 border-white/60 shadow-lg backdrop-blur-md transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
              >
                <Undo2 size={18} />
                <span>Undo</span>
              </button>

              {cardSides === 2 && (
                <button
                  onClick={handleFlip}
                  disabled={!currentCard}
                  className="px-5 sm:px-7 py-2.5 rounded-xl bg-indigo-600/85 hover:bg-indigo-500 text-white font-semibold text-sm sm:text-base border-2 border-indigo-200/80 shadow-lg backdrop-blur-md transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
                >
                  <RotateCw size={18} />
                  <span>Flip</span>
                </button>
              )}

              <button
                onClick={handleDealNext}
                disabled={undealtDeck.length === 0}
                className="px-6 sm:px-9 py-2.5 rounded-xl bg-slate-900/80 hover:bg-emerald-600 text-white font-bold text-sm sm:text-base border-2 border-white shadow-xl backdrop-blur-md transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer"
              >
                <span>Deal</span>
                <Layers size={18} />
              </button>
            </div>

            {/* Right: Quick Theme Switcher, Audio Toggle, Fullscreen */}
            <div className="flex items-center gap-2">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                title="Switch Theme Instantly"
                className="px-3 py-2 rounded-xl bg-slate-900/65 text-white text-xs font-bold border border-white/30 backdrop-blur-md outline-none cursor-pointer hidden sm:block"
              >
                <option value="london">🇬🇧 London Fog</option>
                <option value="cyber">⚡ Cyber Neon</option>
                <option value="jungle">🌴 Jungle Safari</option>
                <option value="space">🚀 Space Odyssey</option>
                <option value="classroom">🏫 Chalkboard</option>
              </select>

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title="Toggle Sound Effects"
                className="w-10 h-10 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-white border border-white/25 flex items-center justify-center transition cursor-pointer"
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} className="text-rose-400" />}
              </button>

              <FullscreenButton targetId="flashcard-game-container" />
            </div>
          </footer>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: MEDIA PICKER MODAL                               */}
      {/* ========================================================= */}
      <MediaPickerModal
        isOpen={Boolean(activeMediaTarget)}
        onClose={() => setActiveMediaTarget(null)}
        initialQuery={activeMediaTarget?.query || ''}
        onSelect={(url) => {
          if (!activeMediaTarget) return;
          const { cardIndex, side } = activeMediaTarget;
          const field = side === 'front' ? 'frontMedia' : 'backMedia';
          updateCard(cardIndex, field, url);
          setActiveMediaTarget(null);
          showToast('Media added to card!');
        }}
      />

      {/* ========================================================= */}
      {/* MODAL 2: BULK PASTE MODAL                                 */}
      {/* ========================================================= */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <span>Bulk Paste Flashcards</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Paste one card per line. Use{' '}
                  <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-800">
                    |
                  </code>{' '}
                  or Tab to separate Front, Back, and Media URL.
                </p>
              </div>
              <button
                onClick={() => setShowBulkPasteModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Miserable | Khổ sở, vô cùng buồn bã | 😭&#10;Ecstatic | Vô cùng hạnh phúc | 🤩&#10;Exhausted | Kiệt sức, mệt nhoài | 🥵"
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-mono text-xs sm:text-sm text-slate-800"
            />

            <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkReplace}
                  onChange={(e) => setBulkReplace(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>Replace existing cards (unchecked = append to list)</span>
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBulkPasteModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyBulkPaste}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Import Cards Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: HOW TO BULK PASTE GUIDE                          */}
      {/* ========================================================= */}
      {showHowToBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles size={20} className="text-purple-600" />
                <span>How to Bulk Paste from Excel / Word / Notion</span>
              </h3>
              <button
                onClick={() => setShowHowToBulkModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3 text-xs sm:text-sm text-slate-600 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-800 mb-1">1. For Double-Sided (Flip) Cards:</p>
                <code className="block bg-white p-2.5 rounded-xl border border-slate-200 font-mono text-xs text-indigo-700">
                  Front Word | Back Meaning | Emoji or Image URL
                </code>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-800 mb-1">2. Copy-Pasting from Spreadsheets:</p>
                <p>
                  Highlight 2 or 3 columns in Excel or Google Sheets and paste directly into the Bulk
                  Paste box. Tabs are automatically detected!
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowHowToBulkModal(false);
                  setShowBulkPasteModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer"
              >
                Try Bulk Paste Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: NEW FOLDER MODAL                                 */}
      {/* ========================================================= */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FolderPlus size={20} className="text-amber-500" />
              <span>Create New Library Folder</span>
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. IELTS Speaking Vocabulary"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!newFolderName.trim()) return;
                  const name = newFolderName.trim();
                  setFolderId(name);
                  if (user) {
                    try {
                      await addDoc(collection(db, 'gameFolders'), {
                        name,
                        userId: user.uid,
                        createdAt: new Date().toISOString(),
                      });
                      setFolders((prev) => [...prev, { id: Date.now().toString(), name }]);
                    } catch {}
                  }
                  setNewFolderName('');
                  setShowNewFolderModal(false);
                  showToast(`Folder "${name}" created!`);
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer"
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SPOTLIGHT CINEMA ZOOM FOR CLASSROOM PROJECTOR    */}
      {/* ========================================================= */}
      {showSpotlightModal && currentCard && (
        <div
          onClick={() => setShowSpotlightModal(false)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[2.5rem] max-w-6xl w-full h-[80vh] p-8 sm:p-14 shadow-2xl border-8 border-indigo-400 flex flex-col justify-between overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <span className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-700">
                Classroom Spotlight Zoom • {isCurrentFlipped ? 'Back Face' : 'Front Face'}
              </span>
              <button
                onClick={() => setShowSpotlightModal(false)}
                className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 min-h-0 my-4 flex items-center justify-center">
              {renderCardContentHTML(
                isCurrentFlipped ? currentCard.backText : currentCard.frontText,
                isCurrentFlipped ? currentCard.backMedia : currentCard.frontMedia
              )}
            </div>
            <div className="text-center text-xs text-slate-400">
              Click anywhere outside or press Escape to close zoom
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: SELECT GAME STAGE THEME & CARD BACK POPUP        */}
      {/* ========================================================= */}
      {showPlayThemeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-6 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette size={24} className="text-purple-600" />
                  <span>Select Game Stage Theme &amp; Card Back</span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Choose the animated stage scenery, card deck emblem, and sound vibe for this gameplay session
                </p>
              </div>
              <button
                onClick={() => setShowPlayThemeModal(false)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Themes Grid (5 Themes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Object.values(THEMES).map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`group relative rounded-2xl p-3.5 text-left transition-all border-2 overflow-hidden cursor-pointer ${
                      isSelected
                        ? 'border-purple-600 ring-4 ring-purple-500/20 bg-purple-50/60 dark:bg-purple-950/30 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800/80'
                    }`}
                  >
                    <div
                      className="h-20 w-full rounded-xl mb-3 flex items-center justify-center relative overflow-hidden shadow-inner"
                      style={{ background: t.previewBg }}
                    >
                      <div className="scale-[0.5] opacity-90 text-white">{t.emblemSvg}</div>
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white text-purple-600 flex items-center justify-center shadow font-black">
                          <Check size={14} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{t.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                      {t.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dealing Options Row */}
            <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={shuffleBeforeDeal}
                    onChange={(e) => setShuffleBeforeDeal(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Shuffle cards before dealing</span>
                </label>
              </div>

              {cardSides === 2 && (
                <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Deal Side First:
                  </span>
                  <div className="inline-flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1">
                    <button
                      type="button"
                      onClick={() => setDealFrontFirst(true)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        dealFrontFirst
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Front (Prompt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDealFrontFirst(false)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                        !dealFrontFirst
                          ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Back (Answer)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPlayThemeModal(false)}
                className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStartPlay(shuffleBeforeDeal)}
                className="px-7 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-500/30 transition transform active:scale-95 flex items-center gap-2 cursor-pointer"
              >
                <Play size={18} className="fill-current" />
                <span>Enter Card Stage &amp; Play</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: PUBLISH CONFIRMATION MODAL (COMMUNITY / PRIVATE) */}
      {/* ========================================================= */}
      {showPublishModal && (
        <div 
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setShowPublishModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-950/40 text-blue-500 dark:text-blue-400 flex items-center justify-center mb-4">
              <BookOpen size={32} />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium text-sm leading-relaxed">
              Would you like to publish this flashcard deck to the Community so other teachers can discover and use it?
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => confirmSave(true)}
                disabled={isSaving}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-base flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>Yes, Publish (Public)</span>
              </button>
              <button
                onClick={() => confirmSave(false)}
                disabled={isSaving}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-base disabled:opacity-50"
              >
                <span>No, Keep Private</span>
              </button>
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={isSaving}
                className="w-full py-2 mt-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 8: GAME MODE SWITCHER MODAL                         */}
      {/* ========================================================= */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: gameId || initialGame?.id,
          name: topic,
          topic: topic,
          className: classLevel,
          classLevel: classLevel,
          gameType: 'flashcards-match',
          customQuestions: cards.map((c, i) => ({
            id: c.id || i + 1,
            text: c.frontText,
            image: isDirectMediaUrl(c.frontMedia || '') ? c.frontMedia : undefined,
            options: [c.backText || c.frontText, 'Sample Option'],
            answerIndex: 0,
          })),
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}
