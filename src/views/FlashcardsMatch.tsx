import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { SetupCurriculumHeader } from '../components/SetupSmartControls';
import {
  AnswerContentMode,
  parseOptionContent,
  isDirectMediaUrl,
  formatOptionContent,
  getInstantCartoonPng,
  fetchRecommendedCartoonPng,
  normalizeKeyword,
} from '../utils/mediaAndPresets';
import { fetchAllAvailableFolders, mergeAllFolders, createUnifiedFolder } from '../lib/gameStore';
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
  ArrowLeftRight,
  Check,
  CheckCircle2,
  Layers,
  Image as ImageIcon,
  Palette,
  Undo2,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { persistUserGameToCloudAndCache } from '../utils/platformCache';
import { CUTE_HAMSTER_BREEDS } from '../lib/studentCharacters';

/*************************************************************
 * 1. THEMES DEFINITION (5 ILLUSTRATED STAGE THEMES)
 *************************************************************/
export interface FlashcardTheme {
  id: 'london' | 'cyber' | 'jungle' | 'space' | 'classroom';
  name: string;
  subtitle: string;
  badge: string;
  cardFont: string;
  previewBgClass: string;
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
    previewBgClass: 'bg-gradient-to-br from-slate-800 via-slate-600 to-rose-600',
    deckCardBg: 'bg-gradient-to-b from-amber-50 via-white to-slate-100 border-amber-400 text-slate-700',
    emblemSvg: (
      <svg viewBox="0 0 120 100" className="w-24 h-20 sm:w-28 sm:h-24 text-amber-500 fill-current drop-shadow">
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
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#334155]" />
        <svg viewBox="0 0 1440 800" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="fogGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.15" />
              <stop offset="70%" stopColor="#1e293b" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#334155" stopOpacity="0.65" />
            </linearGradient>
          </defs>
          <g opacity="0.45" transform="translate(610, 60)">
            <path d="M40 90 C40 30, 120 30, 120 90 Z" fill="#64748b" />
            <rect x="35" y="90" width="90" height="580" fill="#475569" />
            <rect x="48" y="130" width="22" height="40" rx="11" fill="#fef08a" opacity="0.55" />
            <rect x="90" y="130" width="22" height="40" rx="11" fill="#fef08a" opacity="0.55" />
            <rect x="48" y="210" width="22" height="40" rx="11" fill="#94a3b8" />
            <rect x="90" y="210" width="22" height="40" rx="11" fill="#94a3b8" />
          </g>
          <g opacity="0.85" transform="translate(960, -20)">
            <polygon points="90,0 45,120 135,120" fill="#64748b" />
            <rect x="40" y="120" width="100" height="580" fill="#475569" stroke="#64748b" strokeWidth="3" />
            <rect x="30" y="160" width="120" height="110" fill="#334155" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="90" cy="215" r="38" fill="#fef9c3" stroke="#eab308" strokeWidth="5" />
            <line x1="90" y1="215" x2="90" y2="190" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="90" y1="215" x2="110" y2="225" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g opacity="0.55" transform="translate(45, 75)">
            <path d="M20 75 C20 15, 290 15, 290 75 Z" fill="#991b1b" />
            <rect x="15" y="75" width="280" height="680" rx="8" fill="#b91c1c" stroke="#7f1d1d" strokeWidth="6" />
            <rect x="45" y="150" width="95" height="520" fill="#38bdf8" opacity="0.35" />
            <rect x="165" y="150" width="95" height="520" fill="#38bdf8" opacity="0.35" />
          </g>
          <g className="bus-bob" opacity="0.75" transform="translate(680, 460)">
            <rect x="0" y="0" width="330" height="220" rx="18" fill="#dc2626" />
            <rect x="15" y="20" width="65" height="55" rx="6" fill="#fef08a" opacity="0.85" />
            <rect x="92" y="20" width="65" height="55" rx="6" fill="#fef08a" opacity="0.85" />
            <rect x="170" y="20" width="65" height="55" rx="6" fill="#fef08a" opacity="0.85" />
            <rect x="248" y="20" width="65" height="55" rx="6" fill="#fef08a" opacity="0.85" />
            <rect x="10" y="95" width="310" height="16" fill="#fde047" opacity="0.9" />
            <rect x="90" y="125" width="145" height="65" rx="6" fill="#bae6fd" />
            <circle cx="65" cy="220" r="28" fill="#0f172a" />
            <circle cx="65" cy="220" r="14" fill="#64748b" />
            <circle cx="265" cy="220" r="28" fill="#0f172a" />
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
    previewBgClass: 'bg-gradient-to-br from-slate-900 via-purple-900 to-pink-500',
    deckCardBg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 border-cyan-400 text-cyan-400',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28 text-cyan-400 fill-none stroke-current drop-shadow-[0_0_12px_rgba(34,211,238,0.8)]" strokeWidth="4">
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
    previewBgClass: 'bg-gradient-to-br from-emerald-800 via-emerald-600 to-amber-500',
    deckCardBg: 'bg-gradient-to-b from-amber-100 to-amber-200 border-amber-700 text-amber-800',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28 text-amber-800/75 fill-current">
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
    cardFont: "font-['Plus_Jakarta_Sans',sans-serif]",
    previewBgClass: 'bg-gradient-to-br from-slate-950 via-blue-900 to-sky-400',
    deckCardBg: 'bg-gradient-to-b from-indigo-950 to-slate-900 border-sky-400 text-sky-400',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28 text-sky-400 fill-current drop-shadow">
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
    previewBgClass: 'bg-gradient-to-br from-green-900 via-green-800 to-yellow-600',
    deckCardBg: 'bg-gradient-to-b from-amber-50 to-orange-100 border-amber-400 text-amber-600',
    emblemSvg: (
      <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-28 sm:h-28 text-amber-500 fill-current drop-shadow">
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

/**
 * Smart Flashcard Side Input matching AR Games (SmartOptionInput / SmartQuestionInput):
 * - Auto-recommends Cartoon PNGs/GIFs when Display Only Images or Both is active
 * - Displays inline Media button on the right, or clickable attached thumbnail with Change / Delete popover
 */
function SmartFlashcardSideInput({
  textValue,
  mediaValue,
  onChangeText,
  onChangeMedia,
  onOpenMediaPicker,
  placeholder,
  contentMode,
  accentColor = 'blue',
}: {
  textValue: string;
  mediaValue?: string;
  onChangeText: (val: string) => void;
  onChangeMedia: (val: string) => void;
  onOpenMediaPicker: (initialQuery: string) => void;
  placeholder: string;
  contentMode: 'text' | 'photo' | 'both';
  accentColor?: 'blue' | 'emerald' | 'indigo';
}) {
  const safeText = typeof textValue === 'string' ? textValue : '';
  const isAutoPhotos = contentMode !== 'text';
  const [menuOpen, setMenuOpen] = useState(false);
  const [dismissedAutoUrl, setDismissedAutoUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const onChangeMediaRef = useRef(onChangeMedia);
  onChangeMediaRef.current = onChangeMedia;

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  // Auto-recommend Cartoon PNG when typing and Display Only Images or Both is selected
  useEffect(() => {
    if (!isAutoPhotos) return;
    const clean = normalizeKeyword(safeText);
    if (!clean || clean.length < 2) return;
    if (mediaValue && mediaValue.trim() && mediaValue !== '✨') return;

    const instant = getInstantCartoonPng(clean);
    if (instant && instant !== dismissedAutoUrl) {
      onChangeMediaRef.current(instant);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const url = await fetchRecommendedCartoonPng(clean);
      if (!cancelled && url && url !== dismissedAutoUrl) {
        onChangeMediaRef.current(url);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [safeText, isAutoPhotos, mediaValue, dismissedAutoUrl]);

  const cleanMedia = (mediaValue || '').trim();
  const hasMedia = Boolean(cleanMedia && cleanMedia !== '✨');
  const isUrl = isDirectMediaUrl(cleanMedia);

  const focusRingClass =
    accentColor === 'emerald'
      ? 'focus-within:border-emerald-500'
      : accentColor === 'indigo'
      ? 'focus-within:border-indigo-500'
      : 'focus-within:border-blue-500';

  return (
    <div
      className={`flex-1 flex items-center gap-2 min-w-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 transition-colors ${focusRingClass}`}
    >
      <input
        type="text"
        value={safeText.replace(/\n/g, ' ')}
        onChange={(e) => {
          setDismissedAutoUrl(null);
          onChangeText(e.target.value);
        }}
        placeholder={
          contentMode === 'photo'
            ? 'Type word to generate image...'
            : placeholder
        }
        className={`flex-1 min-w-0 bg-transparent outline-none py-1.5 ${
          contentMode === 'photo'
            ? 'text-xs text-slate-600 dark:text-slate-300 font-medium'
            : 'text-sm text-slate-800 dark:text-white font-semibold'
        }`}
      />

      {hasMedia ? (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="w-11 h-11 rounded-xl border-2 border-purple-400/80 hover:border-purple-600 bg-white dark:bg-slate-800 p-0.5 flex items-center justify-center overflow-hidden shadow-xs cursor-pointer transition-all"
            title="Click to Change or Delete media"
          >
            {isUrl ? (
              <img
                src={cleanMedia}
                alt={safeText || 'Card Media'}
                className="w-full h-full object-contain rounded-lg"
              />
            ) : (
              <span className="text-xl leading-none select-none">{cleanMedia}</span>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5 flex items-center gap-1.5 min-w-max">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenMediaPicker(normalizeKeyword(safeText) || safeText.trim() || '');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw size={12} />
                <span>Change</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (cleanMedia) setDismissedAutoUrl(cleanMedia);
                  onChangeMedia('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 size={12} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onOpenMediaPicker(normalizeKeyword(safeText) || safeText.trim() || '')}
          className="bg-purple-500/15 hover:bg-purple-600 text-purple-600 dark:text-purple-300 hover:text-white px-3 py-2 rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-purple-500/30 shadow-xs"
          title="Add Photo or GIPHY GIF"
        >
          <ImageIcon size={16} />
          <span>Media</span>
        </button>
      )}
    </div>
  );
}

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
  const [contentMode, setContentMode] = useState<'text' | 'photo' | 'both'>('text');
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
  const [autoSpeak, setAutoSpeak] = useState<boolean>(false);
  const [fontSizeStep, setFontSizeStep] = useState<number>(0); // -2 to +2 around smart auto-fit

  // Cute Hamster Card Dealer on the Small Deck + Live Flip Animation State
  const [dealerHamsterIdx, setDealerHamsterIdx] = useState<number>(0);
  const [deckAnimState, setDeckAnimState] = useState<{
    type: 'deal' | 'flip' | 'shuffle' | 'undo' | null;
    key: number;
    caption: string;
  }>({ type: null, key: 0, caption: 'Tap deck or Flip!' });
  const deckAnimTimeoutRef = useRef<number | null>(null);

  // Modals & UI Helpers
  const [showPlayThemeModal, setShowPlayThemeModal] = useState<boolean>(false);
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [gameId, setGameId] = useState<string | null>(
    initialGame?.id && !String(initialGame.id).startsWith('sample-') ? initialGame.id : null
  );
  const [shuffleBeforeDeal, setShuffleBeforeDeal] = useState<boolean>(true);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState<boolean>(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState<boolean>(false);
  const [showSpotlightModal, setShowSpotlightModal] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>('');
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  // Active Media Picker target: { cardIndex: number; side: 'front' | 'back' } | null
  const [activeMediaTarget, setActiveMediaTarget] = useState<{
    cardIndex: number;
    side: 'front' | 'back';
    query?: string;
  } | null>(null);

  // Web Audio Synthesizer ref & cached noise buffer for realistic paper flip sounds
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseBufferRef = useRef<AudioBuffer | null>(null);

  const triggerDeckHamsterAnimation = (
    type: 'deal' | 'flip' | 'shuffle' | 'undo',
    customCaption?: string
  ) => {
    if (deckAnimTimeoutRef.current) {
      window.clearTimeout(deckAnimTimeoutRef.current);
    }
    const defaultCaptions: Record<'deal' | 'flip' | 'shuffle' | 'undo', string[]> = {
      deal: ['Flip & Deal! 🎴', 'Here it comes! ✨', 'Fresh card! 🐾', 'Watch me deal! 🌟'],
      flip: ['Hamster Flip! 🔄', 'Turn it over! ✨', 'Check the other side! 🐾', 'Whoosh flip! 🎯'],
      shuffle: ['Riffle Shuffle! 🔀', 'Mixing cards! 🐾', 'Super shuffle! ✨'],
      undo: ['Back to deck! ⏪', 'Rewinding card! 🐾'],
    };
    const pool = defaultCaptions[type];
    const caption = customCaption || pool[Math.floor(Math.random() * pool.length)];
    setDeckAnimState((prev) => ({
      type,
      key: prev.key + 1,
      caption,
    }));
    deckAnimTimeoutRef.current = window.setTimeout(() => {
      setDeckAnimState((prev) => ({
        ...prev,
        type: null,
      }));
    }, 680);
  };

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

      const resolvedSides: 1 | 2 =
        initialGame.cardSides === 1 || initialGame.cardSides === 2
          ? initialGame.cardSides
          : cardSides;
      if (initialGame.cardSides === 1 || initialGame.cardSides === 2) {
        setCardSides(initialGame.cardSides);
      }
      if (initialGame.contentMode) setContentMode(initialGame.contentMode);
      if (initialGame.theme && THEMES[initialGame.theme]) setTheme(initialGame.theme);

      const rawQuestions =
        Array.isArray(initialGame.customQuestions) && initialGame.customQuestions.length > 0
          ? initialGame.customQuestions
          : Array.isArray(initialGame.questions) && initialGame.questions.length > 0
          ? initialGame.questions
          : [];

      let loadedCards: FlashcardItem[] = [];
      if (Array.isArray(initialGame.cards) && initialGame.cards.length > 0) {
        loadedCards = initialGame.cards.map((c: any, i: number) => {
          const q = rawQuestions[i];
          const rawFront =
            typeof (c?.frontText ?? c?.front ?? c?.text) === 'string'
              ? (c.frontText ?? c.front ?? c.text)
              : '';
          const rawBack =
            typeof (c?.backText ?? c?.back ?? c?.answer) === 'string'
              ? (c.backText ?? c.back ?? c.answer)
              : '';

          const parsedFront = parseOptionContent(rawFront);
          const parsedBack = parseOptionContent(rawBack);

          const parsedQPrompt = parseOptionContent(q?.text || q?.question || '');
          const qOpt0 = q ? (q.options?.[q.answerIndex || 0] || q.options?.[0] || '') : '';
          const parsedQAns = parseOptionContent(qOpt0);

          const frontMedia =
            (typeof (c?.frontMedia ?? c?.image) === 'string' ? (c.frontMedia ?? c.image) : '') ||
            parsedFront.imageUrl ||
            parsedQPrompt.imageUrl ||
            q?.image ||
            '';

          let backMedia =
            (typeof c?.backMedia === 'string' ? c.backMedia : '') ||
            parsedBack.imageUrl ||
            parsedQAns.imageUrl ||
            (Array.isArray(q?.optionImages) ? q.optionImages[q.answerIndex || 0] || q.optionImages[0] || '' : '') ||
            '';

          const frontText = parsedFront.text || parsedQPrompt.text || '';
          let backText = parsedBack.text || (!backMedia ? parsedQAns.text : '');

          if (
            resolvedSides === 2 &&
            !backMedia &&
            frontText &&
            (!backText || backText.trim().toLowerCase() === frontText.trim().toLowerCase())
          ) {
            const autoImg = getInstantCartoonPng(frontText);
            if (autoImg) {
              backMedia = autoImg;
              backText = '';
            }
          } else if (
            backMedia &&
            backText &&
            frontText &&
            backText.trim().toLowerCase() === frontText.trim().toLowerCase()
          ) {
            backText = '';
          }

          return {
            id: c?.id || q?.id || `c_${Date.now()}_${i}`,
            frontText,
            backText,
            frontMedia,
            backMedia,
          };
        });
      } else if (rawQuestions.length > 0) {
        loadedCards = rawQuestions.map((q: any, i: number) => {
          const parsedPrompt = parseOptionContent(q.text || q.question || '');
          const opt0 = q.options?.[q.answerIndex || 0] || q.options?.[0] || '';
          const parsedAns = parseOptionContent(opt0);

          const frontMedia = parsedPrompt.imageUrl || q.image || '';
          let backMedia =
            parsedAns.imageUrl ||
            (Array.isArray(q.optionImages) ? q.optionImages[q.answerIndex || 0] || q.optionImages[0] || '' : '') ||
            '';

          const frontText = parsedPrompt.text || q.text || '';
          let backText = parsedAns.text || (!backMedia ? opt0 : '');

          if (
            resolvedSides === 2 &&
            !backMedia &&
            frontText &&
            (!backText || backText.trim().toLowerCase() === frontText.trim().toLowerCase())
          ) {
            const autoImg = getInstantCartoonPng(frontText);
            if (autoImg) {
              backMedia = autoImg;
              backText = '';
            }
          } else if (
            backMedia &&
            backText &&
            frontText &&
            backText.trim().toLowerCase() === frontText.trim().toLowerCase()
          ) {
            backText = '';
          }

          return {
            id: q.id || `c_${Date.now()}_${i}`,
            frontText,
            frontMedia,
            backText,
            backMedia,
          };
        });
      }

      if (loadedCards.length > 0) {
        setCards(loadedCards);
      }

      if (!initialGame.editMode) {
        const sourceCards = loadedCards.length > 0 ? loadedCards : cards;
        const validDeck = sourceCards.filter(
          (c) =>
            (c.frontText && c.frontText.trim()) ||
            (c.backText && c.backText.trim()) ||
            c.frontMedia ||
            c.backMedia
        );
        const deckCopy = [...validDeck];
        if (shuffleBeforeDeal) {
          for (let i = deckCopy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deckCopy[i], deckCopy[j]] = [deckCopy[j], deckCopy[i]];
          }
        }
        setUndealtDeck(deckCopy);
        setDealtHistory([]);
        setCurrentCard(null);
        setIsCurrentFlipped(resolvedSides === 2 ? !dealFrontFirst : false);
        setScreen('play');
      }
    }
  }, [initialGame]);

  // Load Folders from Firestore
  useEffect(() => {
    setFolders(mergeAllFolders());
    fetchAllAvailableFolders(db, user?.uid).then((loaded) => {
      setFolders(loaded);
    });
  }, [user]);

  // Realistic Multi-Layered Card Flipping, Dealing & Shuffling Sound Engine
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

      // Ensure white noise buffer for tactile paper-card flick & aerodynamic whoosh
      if (!noiseBufferRef.current) {
        const sr = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, Math.floor(sr * 0.35), sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        noiseBufferRef.current = buffer;
      }

      const now = ctx.currentTime;

      const triggerPaperBurst = (
        startTime: number,
        duration: number,
        startFreq: number,
        peakFreq: number,
        endFreq: number,
        q: number,
        peakGain: number
      ) => {
        if (!noiseBufferRef.current) return;
        const src = ctx.createBufferSource();
        src.buffer = noiseBufferRef.current;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(q, startTime);
        filter.frequency.setValueAtTime(startFreq, startTime);
        filter.frequency.exponentialRampToValueAtTime(peakFreq, startTime + duration * 0.45);
        filter.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(peakGain, startTime + duration * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(startTime);
        src.stop(startTime + duration + 0.01);
      };

      if (type === 'flip') {
        // 1. Crisp card-edge thumb flick snap
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(1650, now);
        snapOsc.frequency.exponentialRampToValueAtTime(340, now + 0.032);
        snapGain.gain.setValueAtTime(0.24, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.start(now);
        snapOsc.stop(now + 0.036);

        // 2. Aerodynamic paper card-flip whoosh
        triggerPaperBurst(now + 0.01, 0.16, 480, 2600, 620, 2.2, 0.34);

        // 3. Soft card settle tap on table
        const landOsc = ctx.createOscillator();
        const landGain = ctx.createGain();
        landOsc.type = 'sine';
        landOsc.frequency.setValueAtTime(210, now + 0.11);
        landOsc.frequency.exponentialRampToValueAtTime(78, now + 0.19);
        landGain.gain.setValueAtTime(0.18, now + 0.11);
        landGain.gain.exponentialRampToValueAtTime(0.001, now + 0.195);
        landOsc.connect(landGain);
        landGain.connect(ctx.destination);
        landOsc.start(now + 0.11);
        landOsc.stop(now + 0.2);

        // 4. Subtle cheerful flip harmonic
        const chimeOsc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chimeOsc.type = 'sine';
        chimeOsc.frequency.setValueAtTime(587.33, now + 0.03);
        chimeOsc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        chimeGain.gain.setValueAtTime(0.09, now + 0.03);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        chimeOsc.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chimeOsc.start(now + 0.03);
        chimeOsc.stop(now + 0.165);
      } else if (type === 'deal') {
        // 1. Thumb peel & crisp card slide off deck
        triggerPaperBurst(now, 0.19, 700, 3100, 820, 2.6, 0.36);

        // 2. Card launch & stage landing pop
        const dealOsc = ctx.createOscillator();
        const dealGain = ctx.createGain();
        dealOsc.type = 'triangle';
        dealOsc.frequency.setValueAtTime(280, now);
        dealOsc.frequency.exponentialRampToValueAtTime(690, now + 0.085);
        dealOsc.frequency.exponentialRampToValueAtTime(195, now + 0.19);
        dealGain.gain.setValueAtTime(0.24, now);
        dealGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        dealOsc.connect(dealGain);
        dealGain.connect(ctx.destination);
        dealOsc.start(now);
        dealOsc.stop(now + 0.205);

        // 3. Soft landing tap
        triggerPaperBurst(now + 0.12, 0.07, 1400, 900, 350, 3.0, 0.2);
      } else if (type === 'undo') {
        // Reverse paper slide back into deck
        triggerPaperBurst(now, 0.15, 2200, 1100, 420, 2.5, 0.28);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(230, now + 0.15);
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.165);
      } else if (type === 'shuffle') {
        // 8-card rapid riffle shuffle cascade + deck tap
        for (let i = 0; i < 8; i++) {
          const t = now + i * 0.046;
          triggerPaperBurst(t, 0.042, 900 + i * 140, 2600 + i * 120, 750, 3.2, 0.24);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(320 + i * 58, t);
          osc.frequency.exponentialRampToValueAtTime(180 + i * 30, t + 0.038);
          gain.gain.setValueAtTime(0.13, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.042);
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
    setShowPlayThemeModal(false);
    setScreen('play');
    playSoundFx('shuffle');
    triggerDeckHamsterAnimation('shuffle', 'Ready to deal! 🐾');
  };

  const handleDealNext = () => {
    if (undealtDeck.length === 0) {
      showToast('All cards dealt! Click Shuffle to deal again.');
      return;
    }
    const [next, ...rest] = undealtDeck;
    const nextFlipped = cardSides === 2 ? !dealFrontFirst : false;
    setUndealtDeck(rest);
    setDealtHistory((prev) => [...prev, next]);
    setCurrentCard(next);
    setIsCurrentFlipped(nextFlipped);
    playSoundFx('deal');
    triggerDeckHamsterAnimation('deal', `Dealt #${dealtHistory.length + 1}! 🎴`);
    if (autoSpeak) {
      setTimeout(() => {
        const textToRead = nextFlipped ? next.backText : next.frontText;
        if (textToRead && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(textToRead.replace(/\n/g, ' '));
          const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(textToRead);
          u.lang = isVi ? 'vi-VN' : 'en-US';
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        }
      }, 240);
    }
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
    triggerDeckHamsterAnimation('undo', 'Card returned! ⏪');
  };

  const handleFlip = () => {
    if (cardSides !== 2 || !currentCard) return;
    const nextSideFlipped = !isCurrentFlipped;
    setIsCurrentFlipped(nextSideFlipped);
    playSoundFx('flip');
    triggerDeckHamsterAnimation(
      'flip',
      nextSideFlipped ? 'Flipped to Back! 🔄' : 'Flipped to Front! ✨'
    );
    if (autoSpeak) {
      setTimeout(() => {
        const textToRead = nextSideFlipped ? currentCard.backText : currentCard.frontText;
        if (textToRead && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(textToRead.replace(/\n/g, ' '));
          const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(textToRead);
          u.lang = isVi ? 'vi-VN' : 'en-US';
          u.rate = 0.95;
          window.speechSynthesis.speak(u);
        }
      }, 220);
    }
  };

  const handleShuffle = () => {
    const existingCombined = [...dealtHistory, ...undealtDeck];
    const combined =
      existingCombined.length > 0
        ? existingCombined
        : cards.filter(
            (c) =>
              (c.frontText && c.frontText.trim()) ||
              (c.backText && c.backText.trim()) ||
              c.frontMedia ||
              c.backMedia
          );
    for (let i = combined.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [combined[i], combined[j]] = [combined[j], combined[i]];
    }
    setUndealtDeck(combined);
    setDealtHistory([]);
    setCurrentCard(null);
    setIsCurrentFlipped(cardSides === 2 ? !dealFrontFirst : false);
    playSoundFx('shuffle');
    triggerDeckHamsterAnimation('shuffle', 'Deck shuffled! 🔀');
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
    triggerDeckHamsterAnimation('undo', 'Saved for review! 🔁');
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

    try {
      const now = new Date().toISOString();
      const isPublicBool = Boolean(isPublic);

      // Sanitize cards so NO property is undefined (Firestore rejects undefined)
      const cleanCards = valid.map((c, i) => ({
        id: c.id || `card_${Date.now()}_${i + 1}`,
        frontText: (c.frontText || '').trim(),
        frontMedia: c.frontMedia || '',
        backText: (c.backText || '').trim(),
        backMedia: c.backMedia || '',
      }));

      // Build questions for full multi-mode compatibility (Bubble Pop, Roller Coaster, Shark Attack, etc.)
      const baseOptMode = contentMode === 'photo' ? 'photos_gifs' : contentMode === 'text' ? 'words' : 'both';
      const formattedQuestions = cleanCards.map((c, i) => {
        const id = c.id || `q_${i + 1}`;
        if (cardSides === 1) {
          // 1-Side Card
          const text = c.frontText || topic || 'Flashcard';
          const directImg = isDirectMediaUrl(c.frontMedia) ? c.frontMedia : null;
          const effectiveMode = directImg ? (c.frontText ? 'both' : 'photos_gifs') : baseOptMode;

          const correctOpt = formatOptionContent(
            text,
            directImg,
            effectiveMode
          );

          const otherCards = cleanCards.filter((_, idx) => idx !== i);
          const distractors = otherCards.slice(0, 3).map((oc) => {
            const ocImg = isDirectMediaUrl(oc.frontMedia) ? oc.frontMedia : null;
            const ocMode = ocImg ? (oc.frontText ? 'both' : 'photos_gifs') : baseOptMode;
            return formatOptionContent(
              oc.frontText || 'Option',
              ocImg,
              ocMode
            );
          });

          while (distractors.length < 1) {
            distractors.push('Other Option');
          }

          return {
            id,
            text,
            image: directImg || null,
            options: [correctOpt, ...distractors],
            optionImages: [directImg || null, ...otherCards.slice(0, 3).map((oc) => (isDirectMediaUrl(oc.frontMedia) ? oc.frontMedia : null))],
            answerIndex: 0,
          };
        } else {
          // 2-Side Card
          const promptText = c.frontText || 'Question';
          const promptImg = isDirectMediaUrl(c.frontMedia) ? c.frontMedia : null;

          const answerImg = isDirectMediaUrl(c.backMedia) ? c.backMedia : null;
          const answerEmoji = !answerImg && c.backMedia ? c.backMedia.trim() : '';
          const cleanBackText = (c.backText || '').trim() || answerEmoji;
          const answerText = cleanBackText || (answerImg ? '' : promptText);
          const effectiveAnsMode = answerImg ? (cleanBackText ? 'both' : 'photos_gifs') : baseOptMode;

          const correctOpt = formatOptionContent(
            answerText,
            answerImg,
            effectiveAnsMode
          );

          const otherCards = cleanCards.filter((_, idx) => idx !== i);
          const distractors = otherCards.slice(0, 3).map((oc) => {
            const ocImg = isDirectMediaUrl(oc.backMedia) ? oc.backMedia : null;
            const ocEmoji = !ocImg && oc.backMedia ? oc.backMedia.trim() : '';
            const ocCleanBack = (oc.backText || '').trim() || ocEmoji;
            const ocAns = ocCleanBack || (ocImg ? '' : oc.frontText || 'Option');
            const ocMode = ocImg ? (ocCleanBack ? 'both' : 'photos_gifs') : baseOptMode;
            return formatOptionContent(
              ocAns,
              ocImg,
              ocMode
            );
          });

          while (distractors.length < 1) {
            distractors.push('Other Option');
          }

          return {
            id,
            text: promptText,
            image: promptImg || null,
            options: [correctOpt, ...distractors],
            optionImages: [answerImg || null, ...otherCards.slice(0, 3).map((oc) => (isDirectMediaUrl(oc.backMedia) ? oc.backMedia : null))],
            answerIndex: 0,
          };
        }
      });

      const rawPayload: any = {
        name: topic?.trim() || 'Flashcard Deck',
        title: topic?.trim() || 'Flashcard Deck',
        topic: topic?.trim() || '',
        className: classLevel?.trim() || '',
        classLevel: classLevel?.trim() || '',
        folderId: folderId || '',
        gameType: 'flashcards-match',
        originalGameType: 'flashcards-match',
        cardSides,
        contentMode,
        theme,
        cards: cleanCards,
        questions: formattedQuestions,
        customQuestions: formattedQuestions,
        isPublic: isPublicBool,
        publishedAt: isPublicBool ? (initialGame?.publishedAt || now) : null,
        userId: user ? user.uid : 'guest-user',
        creatorName: user?.displayName || user?.email?.split('@')[0] || 'Teacher',
        creatorEmail: user?.email || '',
        updatedAt: now,
      };

      // Strip any possible undefined values so Firestore does not reject with "Unsupported field value: undefined"
      const cleanPayload = JSON.parse(JSON.stringify(rawPayload));

      const candidateId =
        gameId ||
        (initialGame?.id && !String(initialGame.id).startsWith('sample-') ? String(initialGame.id) : null);

      const result = await persistUserGameToCloudAndCache(db, user, cleanPayload, {
        existingGame: initialGame,
        candidateId,
      });

      setGameId(result.id);

      if (user) {
        if (result.cloudSynced) {
          showToast(isPublicBool ? '🚀 Published flashcards to Community!' : '🔒 Saved private flashcard deck!');
        } else {
          showToast(
            isPublicBool
              ? '🚀 Published flashcards & saved to server!'
              : '💾 Saved flashcard deck to library!'
          );
        }
      } else {
        showToast('💾 Saved flashcard deck to local library!');
      }
      setTimeout(() => onViewChange('home'), 450);
    } catch (err: any) {
      console.error('Could not save flashcard deck:', err);
      showToast('⚠️ Save issue: ' + (err?.message || 'Please try again'));
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk Paste Handler
  const parseBulkCards = (raw: string): FlashcardItem[] => {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.map((line, i) => {
      const parts = line.includes('|') ? line.split('|') : line.split('\t');
      return {
        id: `bulk_${Date.now()}_${i}`,
        frontText: (parts[0] || '').trim(),
        backText: (parts[1] || '').trim(),
        frontMedia: (parts[2] || '').trim(),
        backMedia: (parts[3] || '').trim(),
      };
    });
  };

  const handleApplyBulkPaste = (mode: 'replace' | 'append') => {
    if (!bulkText.trim()) return;
    const parsed = parseBulkCards(bulkText);
    if (parsed.length === 0) return;

    if (mode === 'replace') {
      setCards(parsed);
    } else {
      setCards((prev) => [...prev, ...parsed]);
    }
    setShowBulkPasteModal(false);
    setBulkText('');
    showToast(`✨ ${mode === 'replace' ? 'Replaced with' : 'Added'} ${parsed.length} flashcards!`);
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

  const getAdaptiveCardFontClasses = (rawText: string, hasMediaOnSide: boolean): string => {
    const cleaned = rawText.trim();
    const len = cleaned.length;
    const words = cleaned.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const longestWord = words.reduce((max, w) => Math.max(max, w.length), 0);

    // Scale tiers from 0 (smallest for paragraphs) to 7 (largest for 1 short word)
    let tier = 4;

    if (hasMediaOnSide) {
      // Side has BOTH text and image/GIF
      if (wordCount <= 1 && len <= 8) tier = 5;
      else if (wordCount <= 2 && len <= 16 && longestWord <= 10) tier = 4;
      else if (len <= 30) tier = 3;
      else if (len <= 55) tier = 2;
      else if (len <= 90) tier = 1;
      else tier = 0;
    } else {
      // Side has ONLY text (1 word, 2+ words, or sentence)
      if (wordCount === 1 && len <= 6) tier = 7;
      else if (wordCount === 1 && len <= 11) tier = 6;
      else if (wordCount <= 2 && len <= 15 && longestWord <= 10) tier = 6;
      else if (wordCount <= 3 && len <= 22 && longestWord <= 12) tier = 5;
      else if (len <= 36) tier = 4;
      else if (len <= 60) tier = 3;
      else if (len <= 95) tier = 2;
      else if (len <= 140) tier = 1;
      else tier = 0;
    }

    const adjustedTier = Math.max(0, Math.min(7, tier + fontSizeStep));

    const tierClasses: Record<number, string> = {
      0: 'text-xl sm:text-2xl lg:text-3xl xl:text-4xl leading-snug',
      1: 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl leading-snug',
      2: 'text-3xl sm:text-4xl lg:text-5xl xl:text-6xl leading-tight',
      3: 'text-3xl sm:text-5xl lg:text-6xl xl:text-7xl leading-tight',
      4: 'text-4xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] leading-[1.12]',
      5: 'text-5xl sm:text-6xl lg:text-7xl xl:text-[6.25rem] leading-[1.1]',
      6: 'text-5xl sm:text-7xl lg:text-8xl xl:text-[7.5rem] leading-[1.06]',
      7: 'text-6xl sm:text-8xl lg:text-[7.5rem] xl:text-[9.25rem] leading-none',
    };

    return tierClasses[adjustedTier] || tierClasses[4];
  };

  const renderCardMediaBox = (media?: string, isSoloMedia: boolean = false) => {
    if (!media) return null;
    const trimmedMedia = media.trim();
    const isUrl =
      isDirectMediaUrl(trimmedMedia) ||
      trimmedMedia.startsWith('/images/') ||
      trimmedMedia.startsWith('blob:');
    if (isUrl) {
      if (isSoloMedia) {
        return (
          <div className="w-full h-full flex items-center justify-center p-1 sm:p-2 overflow-hidden">
            <img
              src={trimmedMedia}
              alt="Card visual"
              referrerPolicy="no-referrer"
              className="w-full h-full max-w-full max-h-full object-contain drop-shadow-xl rounded-3xl"
            />
          </div>
        );
      }
      return (
        <div className="w-full h-full flex items-center justify-center p-1 sm:p-2 overflow-hidden">
          <img
            src={trimmedMedia}
            alt="Card visual"
            referrerPolicy="no-referrer"
            className="w-full h-full max-w-full max-h-[54vh] object-contain drop-shadow-lg rounded-3xl"
          />
        </div>
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center p-2">
        <div
          className={`${
            isSoloMedia
              ? 'text-[10rem] sm:text-[14rem] lg:text-[18rem] xl:text-[21rem]'
              : 'text-[7rem] sm:text-[10rem] lg:text-[13rem] xl:text-[15rem]'
          } leading-none select-none drop-shadow-md`}
        >
          {trimmedMedia}
        </div>
      </div>
    );
  };

  const renderCardContentHTML = (text: string, media?: string, side?: 'front' | 'back') => {
    const rawText = typeof text === 'string' ? text : '';
    const parsedFromText = parseOptionContent(rawText);
    const cleanMedia = (media || parsedFromText.imageUrl || '').trim();
    const hasMedia = Boolean(cleanMedia && cleanMedia !== '✨');

    let safeText = parsedFromText.imageUrl ? parsedFromText.text : rawText;
    if (
      side === 'back' &&
      hasMedia &&
      currentCard?.frontText &&
      safeText.trim().toLowerCase() === currentCard.frontText.trim().toLowerCase()
    ) {
      safeText = '';
    }

    const showText = contentMode !== 'photo' || !hasMedia;
    const hasText = Boolean(showText && safeText.trim() !== '');
    const themeObj = THEMES[theme] || THEMES.london;

    if (hasText && hasMedia) {
      const sizeClass = getAdaptiveCardFontClasses(safeText, true);

      return (
        <div className="w-full h-full grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-center min-h-0">
          <div className="md:col-span-6 h-full flex flex-col items-center justify-center text-center px-2 sm:px-6 overflow-y-auto min-h-0">
            <div className={`${themeObj.cardFont} ${sizeClass} font-extrabold text-slate-900 tracking-tight break-words [word-break:keep-all] [overflow-wrap:break-word] w-full`}>
              {safeText.split('\n').map((line, idx) => (
                <React.Fragment key={idx}>
                  {line}
                  {idx < safeText.split('\n').length - 1 && <br />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="md:col-span-6 w-full h-full flex items-center justify-center min-h-0 overflow-hidden">
            {renderCardMediaBox(cleanMedia, false)}
          </div>
        </div>
      );
    }

    if (hasMedia && !hasText) {
      return (
        <div className="w-full h-full flex items-center justify-center min-h-0 overflow-hidden">
          {renderCardMediaBox(cleanMedia, true)}
        </div>
      );
    }

    if (hasText && !hasMedia) {
      const sizeClass = getAdaptiveCardFontClasses(safeText, false);

      return (
        <div className="w-full h-full flex items-center justify-center text-center px-4 sm:px-8 overflow-y-auto min-h-0">
          <div className={`${themeObj.cardFont} ${sizeClass} font-extrabold text-slate-900 tracking-tight break-words [word-break:keep-all] [overflow-wrap:break-word] max-w-full`}>
            {safeText.split('\n').map((line, idx) => (
              <React.Fragment key={idx}>
                {line}
                {idx < safeText.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }

    return <div className="text-slate-400 font-medium text-lg">No content on this side</div>;
  };

  const themeObj = THEMES[theme] || THEMES.london;

  return (
    <div
      id="flashcard-game-container"
      className="w-full min-h-full flex-1 bg-slate-100 text-slate-800 flex flex-col font-['Plus_Jakarta_Sans','DM_Sans',sans-serif] overflow-x-hidden relative rounded-xl select-none"
    >
      <style>{`
        @keyframes dealFadeSlide {
          0% {
            opacity: 0;
            transform: perspective(1800px) translate3d(-140px, 24px, -80px) rotateY(-65deg) rotateZ(-6deg) scale(0.82);
          }
          60% {
            opacity: 1;
            transform: perspective(1800px) translate3d(10px, -6px, 30px) rotateY(6deg) rotateZ(0.8deg) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: perspective(1800px) translate3d(0, 0, 0) rotateY(0deg) rotateZ(0deg) scale(1);
          }
        }
        .animate-deal-stage {
          animation: dealFadeSlide 0.52s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes hamsterDealerIdle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(2deg); }
        }
        .animate-hamster-dealer-idle {
          animation: hamsterDealerIdle 2.6s ease-in-out infinite;
        }
        @keyframes hamsterDealerFlipHop {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          28% { transform: translate(14px, -22px) scale(1.16) rotate(14deg); }
          62% { transform: translate(6px, -10px) scale(1.08) rotate(-8deg); }
          100% { transform: translate(0, 0) scale(1) rotate(0deg); }
        }
        .animate-hamster-dealer-hop {
          animation: hamsterDealerFlipHop 0.56s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes hamsterPawFlick {
          0% { transform: translate(0, 0) rotate(-18deg) scale(1); }
          35% { transform: translate(26px, -34px) rotate(42deg) scale(1.25); }
          70% { transform: translate(10px, -14px) rotate(12deg) scale(1.1); }
          100% { transform: translate(0, 0) rotate(-18deg) scale(1); }
        }
        .animate-hamster-paw-flick {
          animation: hamsterPawFlick 0.54s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes smallDeckCardFlip3D {
          0% {
            transform: perspective(1000px) translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) rotateZ(0deg) scale(1);
          }
          35% {
            transform: perspective(1000px) translate3d(18px, -42px, 70px) rotateX(16deg) rotateY(95deg) rotateZ(8deg) scale(1.12);
          }
          70% {
            transform: perspective(1000px) translate3d(6px, -16px, 35px) rotateX(-8deg) rotateY(210deg) rotateZ(-4deg) scale(1.05);
          }
          100% {
            transform: perspective(1000px) translate3d(0, 0, 0) rotateX(0deg) rotateY(360deg) rotateZ(0deg) scale(1);
          }
        }
        .animate-small-deck-flip {
          animation: smallDeckCardFlip3D 0.62s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes smallCardDealLaunch {
          0% {
            opacity: 1;
            transform: perspective(1000px) translate3d(0, 0, 0) rotateY(0deg) rotateZ(0deg) scale(0.95);
          }
          45% {
            opacity: 1;
            transform: perspective(1000px) translate3d(140px, -54px, 90px) rotateY(180deg) rotateZ(14deg) scale(1.14);
          }
          100% {
            opacity: 0;
            transform: perspective(1000px) translate3d(340px, -12px, 140px) rotateY(360deg) rotateZ(20deg) scale(1.25);
          }
        }
        .animate-small-card-launch {
          animation: smallCardDealLaunch 0.54s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes bigCardFlipPopFront {
          0% { transform: perspective(1800px) translateZ(0px) rotateY(180deg) scale(1); }
          45% { transform: perspective(1800px) translateZ(75px) translateY(-10px) rotateY(90deg) rotateZ(-1.5deg) scale(1.035); }
          100% { transform: perspective(1800px) translateZ(0px) rotateY(0deg) scale(1); }
        }
        @keyframes bigCardFlipPopBack {
          0% { transform: perspective(1800px) translateZ(0px) rotateY(0deg) scale(1); }
          45% { transform: perspective(1800px) translateZ(75px) translateY(-10px) rotateY(90deg) rotateZ(1.5deg) scale(1.035); }
          100% { transform: perspective(1800px) translateZ(0px) rotateY(180deg) scale(1); }
        }
        @keyframes shuffleRiffleLeft {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-22px, -14px) rotate(-9deg); }
          50% { transform: translate(18px, 8px) rotate(7deg); }
          75% { transform: translate(-12px, 5px) rotate(-5deg); }
        }
        .animate-shuffle {
          animation: shuffleRiffleLeft 0.58s ease-in-out;
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
        .fc-perspective-stage {
          perspective: 1800px;
        }
        .fc-flip-container {
          transform-style: preserve-3d;
          transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .fc-flipped-true {
          transform: rotateY(180deg);
          animation: bigCardFlipPopBack 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .fc-flipped-false {
          transform: rotateY(0deg);
          animation: bigCardFlipPopFront 0.6s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .fc-card-face-front {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(0deg);
        }
        .fc-card-face-back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transform: rotateY(180deg);
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
              {/* Top Header Card — Clean AR-Games Setup Layout */}
              <div className="bg-white dark:bg-slate-800/80 p-6 sm:p-8 flex flex-col gap-5 border-b-2 border-blue-500/50">
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onViewChange('home')}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-black text-sm transition-colors cursor-pointer border border-slate-300 dark:border-slate-600 whitespace-nowrap shrink-0"
                    >
                      <ArrowLeft size={18} />
                      <span>Back</span>
                    </button>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide whitespace-nowrap">
                      FLASHCARD SETUP
                    </h2>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleStartPlay(shuffleBeforeDeal)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors shadow-lg shadow-emerald-500/30 cursor-pointer text-sm sm:text-base whitespace-nowrap shrink-0"
                    >
                      <Play size={18} className="fill-current" />
                      <span>Play Deck</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveClick}
                      disabled={isSaving}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg shadow-blue-500/30 cursor-pointer text-sm sm:text-base disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      <Save size={18} />
                      <span>{isSaving ? 'Saving...' : 'Save Quiz'}</span>
                    </button>
                    <FullscreenButton
                      targetId="flashcard-game-container"
                      className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600"
                    />
                  </div>
                </div>

                {/* Unified AR-Style Setup Header: Topic, Class Level, Folder + Generate Images / GIFs */}
                <SetupCurriculumHeader
                  topic={topic}
                  setTopic={setTopic}
                  classLevel={classLevel}
                  setClassLevel={setClassLevel}
                  folderId={folderId}
                  setFolderId={setFolderId}
                  folders={folders}
                  contentMode={
                    contentMode === 'photo'
                      ? 'photos_gifs'
                      : contentMode === 'both'
                      ? 'both'
                      : 'words'
                  }
                  setContentMode={(mode: AnswerContentMode) => {
                    const mapped = mode === 'photos_gifs' ? 'photo' : mode === 'both' ? 'both' : 'text';
                    setContentMode(mapped);
                  }}
                  autoPhotosEnabled={contentMode !== 'text'}
                  onApplyModeToAll={async (mode: AnswerContentMode) => {
                    const mapped = mode === 'photos_gifs' ? 'photo' : mode === 'both' ? 'both' : 'text';
                    setContentMode(mapped);

                    if (mapped === 'text') {
                      setCards((prev) =>
                        prev.map((c) => ({
                          ...c,
                          frontMedia: '',
                          backMedia: '',
                        }))
                      );
                      showToast('🔤 Switched all cards to Text Only!');
                      return;
                    }

                    const updatedCards = await Promise.all(
                      cards.map(async (c) => {
                        let nextFrontMedia = c.frontMedia || '';
                        let nextBackMedia = c.backMedia || '';

                        if (
                          c.frontText?.trim() &&
                          (!nextFrontMedia || nextFrontMedia === '✨' || !isDirectMediaUrl(nextFrontMedia))
                        ) {
                          const foundFront =
                            getInstantCartoonPng(c.frontText) ||
                            (await fetchRecommendedCartoonPng(c.frontText));
                          if (foundFront) nextFrontMedia = foundFront;
                        }

                        if (
                          cardSides === 2 &&
                          c.backText?.trim() &&
                          (!nextBackMedia || nextBackMedia === '✨' || !isDirectMediaUrl(nextBackMedia))
                        ) {
                          const foundBack =
                            getInstantCartoonPng(c.backText) ||
                            (await fetchRecommendedCartoonPng(c.backText));
                          if (foundBack) nextBackMedia = foundBack;
                        }

                        return {
                          ...c,
                          frontMedia: nextFrontMedia,
                          backMedia: nextBackMedia,
                        };
                      })
                    );

                    setCards(updatedCards);
                    showToast(
                      mapped === 'photo'
                        ? '🖼️ Switched all cards to Images Only!'
                        : '✨ Switched all cards to Words + Images!'
                    );
                  }}
                />

                {/* Clean Single-Row Card Side Mode Selector */}
                <div className="bg-slate-50/90 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <ArrowLeftRight size={16} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        Card Side Mode
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                        · {cardSides === 1 ? '1-Sided: Deals face-up' : '2-Sided: Flip Front & Back'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 w-full sm:w-auto bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-1 rounded-xl gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCardSides(1)}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        cardSides === 1
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Square size={13} />
                      <span>1-Side</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCardSides(2)}
                      className={`px-4 py-2 rounded-lg text-xs font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        cardSides === 2
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <RotateCw size={13} />
                      <span>Double-Side</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Cards List Area */}
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
                        className="px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeftRight size={14} className="text-indigo-600 dark:text-indigo-400" />
                        <span>Swap All Front/Back</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowBulkPasteModal(true)}
                      className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                      <ClipboardList size={18} />
                      <span>Bulk Paste</span>
                    </button>
                  </div>
                </div>

                {/* Card Items */}
                <div className="flex flex-col gap-4">
                  {cards.map((card, idx) => {
                    if (cardSides === 1) {
                      // 1-SIDED CARD LAYOUT (AR-Style Inline Media)
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
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                              {idx + 1}
                            </div>

                            <SmartFlashcardSideInput
                              textValue={card.frontText}
                              mediaValue={card.frontMedia}
                              onChangeText={(val) => updateCard(idx, 'frontText', val)}
                              onChangeMedia={(val) => updateCard(idx, 'frontMedia', val)}
                              onOpenMediaPicker={(initialQ) =>
                                setActiveMediaTarget({
                                  cardIndex: idx,
                                  side: 'front',
                                  query: initialQ,
                                })
                              }
                              placeholder="Type card word, phrase, or question here..."
                              contentMode={contentMode}
                              accentColor="blue"
                            />
                          </div>
                        </div>
                      );
                    }

                    // 2-SIDED (DOUBLE-SIDED FLIP) CARD LAYOUT (AR-Style Inline Media)
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
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                              {idx + 1}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                              Front Side (Word / Prompt)
                            </span>
                            <SmartFlashcardSideInput
                              textValue={card.frontText}
                              mediaValue={card.frontMedia}
                              onChangeText={(val) => updateCard(idx, 'frontText', val)}
                              onChangeMedia={(val) => updateCard(idx, 'frontMedia', val)}
                              onOpenMediaPicker={(initialQ) =>
                                setActiveMediaTarget({
                                  cardIndex: idx,
                                  side: 'front',
                                  query:
                                    initialQ.trim() ||
                                    normalizeKeyword(card.backText || '') ||
                                    (card.backText || '').trim(),
                                })
                              }
                              placeholder="Front text (e.g. apple, happy, dog)..."
                              contentMode={contentMode}
                              accentColor="emerald"
                            />
                          </div>

                          {/* BACK SIDE */}
                          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800/70 border border-indigo-200 dark:border-indigo-900/60 flex flex-col gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              Back Side (Answer / Meaning)
                            </span>
                            <SmartFlashcardSideInput
                              textValue={card.backText}
                              mediaValue={card.backMedia}
                              onChangeText={(val) => updateCard(idx, 'backText', val)}
                              onChangeMedia={(val) => updateCard(idx, 'backMedia', val)}
                              onOpenMediaPicker={(initialQ) =>
                                setActiveMediaTarget({
                                  cardIndex: idx,
                                  side: 'back',
                                  query:
                                    initialQ.trim() ||
                                    normalizeKeyword(card.frontText || '') ||
                                    (card.frontText || '').trim(),
                                })
                              }
                              placeholder="Back text (e.g. meaning or answer)..."
                              contentMode={contentMode}
                              accentColor="indigo"
                            />
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
                    setCards((prev) => [...prev, BLANK_CARD(String(prev.length + 1))]);
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <Plus size={20} className="group-hover:scale-110 transition" />
                  <span>Add Another Flashcard</span>
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
        <div className="absolute inset-0 z-40 flex flex-col justify-between overflow-hidden select-none">
          {/* Dynamic Illustrated Background Stage */}
          {themeObj.stageSvg}

          {/* TOP HUD BAR (Back to Setup + Deck Title | Controls + Theme + Sound + Fullscreen) */}
          <header className="relative z-20 px-4 sm:px-8 pt-4 pb-2 flex flex-wrap items-center justify-between gap-4">
            {/* Left: Setup Button + High-Contrast Glass Title Pill */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setScreen('setup')}
                title="Return to Setup (Esc)"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/75 hover:bg-slate-800 text-white backdrop-blur-md border border-white/25 shadow-lg transition-colors cursor-pointer text-xs sm:text-sm font-bold whitespace-nowrap shrink-0"
              >
                <ArrowLeft size={15} />
                <span>Setup</span>
              </button>

              <div className="flex items-center gap-2 min-w-0 px-3.5 py-1.5 rounded-xl bg-slate-900/65 backdrop-blur-md border border-white/20 text-white shadow-md">
                <h2 className="font-extrabold text-sm sm:text-base leading-tight truncate max-w-[180px] sm:max-w-[300px]">
                  {topic || 'Flashcards'}
                </h2>
                {classLevel && (
                  <>
                    <span className="text-white/50 text-xs" aria-hidden="true">•</span>
                    <span className="text-xs text-amber-300 font-bold truncate max-w-[130px]">
                      {classLevel}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Progress Count, Front/Back Toggle, Auto-Speak, Theme, Audio & Fullscreen */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end">
              <span className="px-3.5 py-1.5 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/25 text-white text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap shadow-md">
                Card {dealtHistory.length} / {dealtHistory.length + undealtDeck.length}
              </span>

              {cardSides === 2 && (
                <div className="hidden md:flex items-center bg-slate-900/75 backdrop-blur-md p-1 rounded-xl border border-white/25 text-white text-xs shadow-md">
                  <button
                    type="button"
                    onClick={() => {
                      setDealFrontFirst(true);
                      if (currentCard) {
                        setIsCurrentFlipped(false);
                        playSoundFx('flip');
                        triggerDeckHamsterAnimation('flip', 'Front First! ✨');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      dealFrontFirst ? 'bg-white text-slate-900 shadow-xs' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Front First
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDealFrontFirst(false);
                      if (currentCard) {
                        setIsCurrentFlipped(true);
                        playSoundFx('flip');
                        triggerDeckHamsterAnimation('flip', 'Back First! 🔄');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                      !dealFrontFirst ? 'bg-white text-slate-900 shadow-xs' : 'text-white/80 hover:text-white'
                    }`}
                  >
                    Back First
                  </button>
                </div>
              )}

              {/* Auto-Read Voice Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  showToast(next ? '🔊 Auto-Speak ON when flipping/dealing' : '🔇 Auto-Speak OFF');
                }}
                title="Automatically read card aloud when dealt or flipped"
                className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold backdrop-blur-md transition cursor-pointer flex items-center gap-1.5 shadow-md ${
                  autoSpeak
                    ? 'bg-emerald-600/90 border-emerald-300 text-white'
                    : 'bg-slate-900/70 hover:bg-slate-800/85 border-white/25 text-white/85'
                }`}
              >
                <Sparkles size={13} className={autoSpeak ? 'text-amber-200' : 'text-slate-300'} />
                <span className="hidden sm:inline">Auto Voice</span>
              </button>

              {/* Theme Switcher on Top */}
              <div className="relative flex items-center bg-slate-900/75 hover:bg-slate-800/90 border border-white/25 rounded-xl px-2.5 py-1.5 backdrop-blur-md text-white transition-colors shadow-md">
                <Palette size={15} className="text-amber-300 shrink-0 mr-1.5 pointer-events-none" />
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as any)}
                  title="Switch Stage Theme"
                  aria-label="Stage Theme"
                  className="bg-transparent text-white text-xs sm:text-sm font-bold outline-none cursor-pointer pr-1"
                >
                  <option value="london" className="text-slate-900">London Fog</option>
                  <option value="cyber" className="text-slate-900">Cyber Neon</option>
                  <option value="jungle" className="text-slate-900">Jungle Safari</option>
                  <option value="space" className="text-slate-900">Space Odyssey</option>
                  <option value="classroom" className="text-slate-900">Chalkboard</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextSound = !soundEnabled;
                  setSoundEnabled(nextSound);
                }}
                title={soundEnabled ? 'Mute Card Flip Sound Effects' : 'Enable Card Flip Sound Effects'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-900/75 hover:bg-slate-800/90 text-white border border-white/25 flex items-center justify-center transition cursor-pointer shrink-0 shadow-md"
              >
                {soundEnabled ? <Volume2 size={17} className="text-amber-300" /> : <VolumeX size={17} className="text-rose-400" />}
              </button>

              <FullscreenButton
                targetId="flashcard-game-container"
                showLabel
                className="!px-3.5 !py-2 !rounded-xl bg-slate-900/80 hover:bg-slate-800 border-white/25 shadow-md"
              />
            </div>
          </header>

          {/* CENTER STAGE: LEFT 3D SMALL DECK WITH BIG HAMSTER DEALER AT BOTTOM-LEFT + LARGE ACTIVE CARD */}
          <div className="relative z-10 flex-1 w-full max-w-[1880px] mx-auto px-3 sm:px-6 lg:px-10 py-1 flex flex-col lg:flex-row items-center justify-center gap-5 lg:gap-8 min-h-0">
            {/* LEFT COLUMN: SMALL 3D STACKED DECK WITH BIG CUTE HAMSTER DEALER AT BOTTOM-LEFT */}
            <div className="w-full lg:w-[21%] xl:w-[20%] flex flex-col items-center justify-center shrink-0">
              {(() => {
                const activeHamster =
                  CUTE_HAMSTER_BREEDS[dealerHamsterIdx % CUTE_HAMSTER_BREEDS.length] ||
                  CUTE_HAMSTER_BREEDS[0];
                const isAnimating = Boolean(deckAnimState.type);
                const stackDepth = Math.min(undealtDeck.length, 5);
                const stackOffsetClasses = [
                  'translate-y-0',
                  'translate-y-1.5',
                  'translate-y-3',
                  'translate-y-4.5',
                  'translate-y-6',
                ];

                return (
                  <div className="w-full max-w-[230px] sm:max-w-[265px] lg:max-w-[290px] flex flex-col items-center">
                    {/* SMALL 3D STACKED DECK CARD + BIG HAMSTER DEALER ANCHORED AT BOTTOM-LEFT */}
                    <div
                      onClick={handleDealNext}
                      className={`relative w-full aspect-[4/3] cursor-pointer group select-none ${
                        deckAnimState.type === 'shuffle' ? 'animate-shuffle' : ''
                      }`}
                    >
                      {undealtDeck.length === 0 ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShuffle();
                          }}
                          className="absolute inset-0 rounded-3xl border-2 border-dashed border-amber-300/70 bg-slate-900/65 hover:bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center shadow-2xl transition"
                        >
                          <Shuffle size={38} className="text-amber-300 mb-2 animate-pulse" />
                          <p className="font-extrabold text-sm sm:text-base">Deck Complete!</p>
                          <p className="text-xs text-amber-200/90 mt-1">Click to Shuffle &amp; Deal Again</p>
                        </div>
                      ) : (
                        <div className="absolute inset-0 transition-transform duration-200 group-hover:-translate-y-1.5">
                          {/* Deep 3D Base Shadow */}
                          <div className="absolute inset-x-1 top-5 -bottom-3 rounded-3xl bg-slate-950/65 border-2 border-white/15 shadow-[0_26px_50px_rgba(0,0,0,0.65)]" />

                          {/* Stacked Cards in Deck */}
                          {Array.from({ length: stackDepth })
                            .map((_, i) => i)
                            .reverse()
                            .map((i) => {
                              const isTop = i === 0;
                              const offsetClass = stackOffsetClasses[i] || 'translate-y-6';
                              return (
                                <div
                                  key={`stack-${i}-${isTop ? deckAnimState.key : 'base'}`}
                                  className={`absolute inset-0 rounded-3xl ${themeObj.deckCardBg} border-4 shadow-xl flex items-center justify-center p-4 transition-all ${offsetClass} ${
                                    isTop && (deckAnimState.type === 'flip' || deckAnimState.type === 'deal')
                                      ? 'animate-small-deck-flip ring-4 ring-amber-300/90'
                                      : ''
                                  }`}
                                >
                                  <div className="w-full h-full rounded-2xl border-2 border-current/30 flex flex-col items-center justify-center relative overflow-hidden">
                                    <span className="absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 border-current/50" />
                                    <span className="absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 border-current/50" />
                                    <span className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 border-current/50" />
                                    <span className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 border-current/50" />
                                    {isTop && (
                                      <div className="scale-110 transition-transform duration-300 group-hover:scale-125">
                                        {themeObj.emblemSvg}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                          {/* Flying 3D Card Animation Launching from Small Deck to Big Stage on Deal */}
                          {deckAnimState.type === 'deal' && (
                            <div
                              key={`launch-${deckAnimState.key}`}
                              className={`absolute inset-0 rounded-3xl ${themeObj.deckCardBg} border-4 border-amber-300 shadow-2xl flex items-center justify-center p-4 pointer-events-none z-40 animate-small-card-launch`}
                            >
                              <div className="w-full h-full rounded-2xl border-2 border-current/40 flex flex-col items-center justify-center">
                                {themeObj.emblemSvg}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* BIG CUTE HAMSTER DEALER AT THE BOTTOM-LEFT OF THE SMALL CARD */}
                      <div
                        key={`hamster-${deckAnimState.key}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (cardSides === 2 && currentCard) {
                            handleFlip();
                          } else {
                            handleDealNext();
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDealerHamsterIdx((prev) => (prev + 1) % CUTE_HAMSTER_BREEDS.length);
                          playSoundFx('flip');
                          triggerDeckHamsterAnimation('flip');
                        }}
                        title="Click Dealer Hamster to Flip / Deal! (Right-click to switch hamster)"
                        className={`absolute -bottom-7 -left-5 sm:-bottom-8 sm:-left-6 z-30 cursor-pointer group/hamster flex items-center justify-center ${
                          isAnimating ? 'animate-hamster-dealer-hop' : 'animate-hamster-dealer-idle'
                        }`}
                      >
                        {/* Golden Glow Aura When Flipping/Dealing */}
                        <div
                          className={`absolute -inset-2.5 rounded-full blur-md transition-opacity duration-300 ${
                            isAnimating
                              ? 'bg-amber-400/85 opacity-100 scale-110'
                              : 'bg-amber-300/30 opacity-70 group-hover/hamster:opacity-100'
                          }`}
                        />

                        {/* Big Cute Hamster Portrait at Bottom-Left of Deck */}
                        <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full border-4 border-amber-300 bg-gradient-to-b from-amber-50 to-orange-100 shadow-[0_14px_30px_rgba(0,0,0,0.55)] overflow-hidden flex items-center justify-center transition-transform group-hover/hamster:scale-105">
                          <img
                            src={activeHamster.imageUrl}
                            alt={activeHamster.name}
                            className="w-full h-full object-cover scale-110"
                          />
                        </div>

                        {/* Animated Right Paw Flicking & Flipping the Deck Card */}
                        <div
                          className={`absolute -right-3 top-2 w-9 h-7 sm:w-10 sm:h-8 rounded-full bg-amber-200 border-2 border-amber-700/70 shadow-lg flex items-center justify-center ${
                            isAnimating ? 'animate-hamster-paw-flick' : '-rotate-12 group-hover/hamster:rotate-12 transition-transform'
                          }`}
                        >
                          <RotateCw size={14} className="text-amber-700" />
                        </div>

                        {/* Clean Dealer Tag at Bottom-Left of Hamster */}
                        <div className="absolute -bottom-2 left-2 px-2.5 py-0.5 rounded-full bg-slate-900/90 text-amber-300 text-[10px] font-black uppercase tracking-wider border border-amber-300/50 shadow-md">
                          Dealer
                        </div>
                      </div>
                    </div>

                    {/* Minimal Remaining Deck Count */}
                    <div className="mt-8 flex items-center justify-center">
                      <span className="px-4 py-1 rounded-full bg-slate-900/80 border border-white/20 text-white text-xs sm:text-sm font-extrabold tabular-nums shadow-md backdrop-blur-md">
                        {undealtDeck.length} left
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* RIGHT COLUMN: MUCH LARGER ACTIVE DEALT CARD */}
            <div className="w-full lg:w-[79%] xl:w-[80%] h-full flex flex-col items-center justify-center min-h-0">
              <div className="relative w-full h-[64vh] sm:h-[74vh] lg:h-[81vh] max-h-[860px] min-h-[400px] fc-perspective-stage">
                {!currentCard ? (
                  <div
                    onClick={handleDealNext}
                    className="absolute inset-0 rounded-[2.25rem] border-2 border-dashed border-white/50 bg-slate-900/45 hover:bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center text-white p-8 text-center cursor-pointer transition shadow-2xl group"
                  >
                    <div className="w-24 h-24 rounded-3xl bg-amber-400/20 border-2 border-amber-300/60 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                      <Layers size={48} className="text-amber-300" />
                    </div>
                    <h3 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                      Ready to Deal
                    </h3>
                    <p className="text-base sm:text-lg text-white/85 mt-3 max-w-md">
                      Click the deck on the left or press <span className="text-amber-300 font-bold">Deal</span> to flip out your first card!
                    </p>
                  </div>
                ) : (
                  <div
                    key={currentCard.id}
                    className="w-full h-full animate-deal-stage fc-perspective-stage"
                  >
                    <div
                      onClick={() => (cardSides === 2 ? handleFlip() : handleDealNext())}
                      className={`relative w-full h-full rounded-[2.25rem] cursor-pointer fc-flip-container ${
                        cardSides === 2 && isCurrentFlipped ? 'fc-flipped-true' : 'fc-flipped-false'
                      }`}
                    >
                      {/* FRONT FACE */}
                      <div
                        aria-hidden={cardSides === 2 && isCurrentFlipped}
                        className={`absolute inset-0 rounded-[2.25rem] bg-gradient-to-b from-white via-slate-50 to-slate-100 border-[6px] border-white shadow-[0_32px_75px_-16px_rgba(0,0,0,0.7)] flex flex-col justify-between p-5 sm:p-7 lg:p-9 overflow-hidden fc-card-face-front transition-opacity duration-200 ${
                          cardSides === 2 && isCurrentFlipped
                            ? 'opacity-0 invisible pointer-events-none'
                            : 'opacity-100 visible pointer-events-auto'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 z-10 shrink-0">
                          <div className="flex items-center gap-2">
                            {cardSides === 2 ? (
                              <span className="px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-2xs">
                                Front
                              </span>
                            ) : (
                              <span className="px-3.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                                Card #{dealtHistory.length}
                              </span>
                            )}
                          </div>
                          <div
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Font Size Adjuster Pill (A- / Auto / A+) */}
                            <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => setFontSizeStep((prev) => Math.max(-2, prev - 1))}
                                disabled={fontSizeStep <= -2}
                                title="Decrease Font Size"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-black text-slate-700 hover:bg-white hover:text-slate-900 disabled:opacity-35 transition cursor-pointer"
                              >
                                A-
                              </button>
                              {fontSizeStep !== 0 && (
                                <button
                                  type="button"
                                  onClick={() => setFontSizeStep(0)}
                                  title="Reset to Smart Auto-Fit Font Size"
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-blue-600 hover:bg-white transition cursor-pointer"
                                >
                                  Auto
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setFontSizeStep((prev) => Math.min(2, prev + 1))}
                                disabled={fontSizeStep >= 2}
                                title="Increase Font Size"
                                className="px-2.5 py-1.5 rounded-lg text-xs font-black text-slate-700 hover:bg-white hover:text-slate-900 disabled:opacity-35 transition cursor-pointer"
                              >
                                A+
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => speakCard('front')}
                              title="Speak Card Aloud"
                              className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 border border-slate-200 flex items-center justify-center transition cursor-pointer shadow-2xs"
                            >
                              <Volume2 size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 w-full my-1.5 flex items-center justify-center overflow-hidden">
                          {renderCardContentHTML(currentCard.frontText, currentCard.frontMedia, 'front')}
                        </div>

                        <div className="flex items-center justify-between pt-2.5 z-10 shrink-0 border-t border-slate-200/70">
                          <span className="text-xs sm:text-sm font-bold text-slate-400 tabular-nums">
                            #{dealtHistory.length} / {dealtHistory.length + undealtDeck.length}
                          </span>

                          <div onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={handleRequeueCurrent}
                              title="Put card back into deck to review again"
                              className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                            >
                              <RotateCw size={14} /> Review Again
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* BACK FACE (2-SIDED MODE) */}
                      {cardSides === 2 && (
                        <div
                          aria-hidden={!isCurrentFlipped}
                          className={`absolute inset-0 rounded-[2.25rem] bg-gradient-to-b from-indigo-50 via-white to-slate-50 border-[6px] border-indigo-300 shadow-[0_32px_75px_-16px_rgba(0,0,0,0.7)] flex flex-col justify-between p-5 sm:p-7 lg:p-9 overflow-hidden fc-card-face-back transition-opacity duration-200 ${
                            isCurrentFlipped
                              ? 'opacity-100 visible pointer-events-auto'
                              : 'opacity-0 invisible pointer-events-none'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 z-10 shrink-0">
                            <span className="px-3.5 py-1 rounded-full bg-indigo-600 text-white text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-xs">
                              Back • Answer
                            </span>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Font Size Adjuster Pill (A- / Auto / A+) */}
                              <div className="inline-flex items-center bg-indigo-100/80 border border-indigo-200 rounded-xl p-0.5 shadow-2xs">
                                <button
                                  type="button"
                                  onClick={() => setFontSizeStep((prev) => Math.max(-2, prev - 1))}
                                  disabled={fontSizeStep <= -2}
                                  title="Decrease Font Size"
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-black text-indigo-700 hover:bg-white hover:text-indigo-900 disabled:opacity-35 transition cursor-pointer"
                                >
                                  A-
                                </button>
                                {fontSizeStep !== 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setFontSizeStep(0)}
                                    title="Reset to Smart Auto-Fit Font Size"
                                    className="px-2 py-1 rounded-lg text-[11px] font-bold text-indigo-600 hover:bg-white transition cursor-pointer"
                                  >
                                    Auto
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setFontSizeStep((prev) => Math.min(2, prev + 1))}
                                  disabled={fontSizeStep >= 2}
                                  title="Increase Font Size"
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-black text-indigo-700 hover:bg-white hover:text-indigo-900 disabled:opacity-35 transition cursor-pointer"
                                >
                                  A+
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => speakCard('back')}
                                title="Speak Answer Aloud"
                                className="w-11 h-11 rounded-xl bg-indigo-100/80 hover:bg-indigo-600 hover:text-white text-indigo-700 flex items-center justify-center transition cursor-pointer"
                              >
                                <Volume2 size={20} />
                              </button>
                            </div>
                          </div>

                          <div className="flex-1 min-h-0 w-full my-1.5 flex items-center justify-center overflow-hidden">
                            {renderCardContentHTML(currentCard.backText, currentCard.backMedia, 'back')}
                          </div>

                          <div className="flex items-center justify-between pt-2.5 z-10 shrink-0 border-t border-indigo-100">
                            <span className="text-xs sm:text-sm font-bold text-indigo-400 tabular-nums">
                              #{dealtHistory.length} / {dealtHistory.length + undealtDeck.length}
                            </span>

                            <div onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={handleRequeueCurrent}
                                title="Put card back in deck to review later"
                                className="px-3.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer"
                              >
                                <RotateCw size={14} /> Review Again
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

          {/* CLEAN BOTTOM DEALER CONTROLS */}
          <footer className="relative z-20 px-4 sm:px-8 pb-5 pt-2 flex items-center justify-center bg-gradient-to-t from-black/60 via-black/25 to-transparent">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <button
                type="button"
                onClick={handleShuffle}
                className="px-5 sm:px-7 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-sm sm:text-base border border-white/35 shadow-lg backdrop-blur-md transition transform active:scale-95 flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Shuffle size={18} />
                <span>Shuffle</span>
              </button>

              <button
                type="button"
                onClick={handleUndo}
                disabled={dealtHistory.length === 0}
                className="px-5 sm:px-7 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-white font-semibold text-sm sm:text-base border border-white/35 shadow-lg backdrop-blur-md transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Undo2 size={18} />
                <span>Undo</span>
              </button>

              {cardSides === 2 && (
                <button
                  type="button"
                  onClick={handleFlip}
                  disabled={!currentCard}
                  className="px-5 sm:px-7 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm sm:text-base border border-indigo-300/70 shadow-lg backdrop-blur-md transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <RotateCw size={18} />
                  <span>Flip</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDealNext}
                disabled={undealtDeck.length === 0}
                className="px-6 sm:px-9 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base border border-emerald-200/60 shadow-xl transition transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>Deal</span>
                <Layers size={18} />
              </button>
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
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            setShowBulkPasteModal(false);
            setBulkText('');
          }}
        >
          <div
            className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <ClipboardList size={20} />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Bulk Paste Flashcards
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBulkPasteModal(false);
                  setBulkText('');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"apples\nbananas\noranges\ngrapes"}
              className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:border-blue-500 outline-none font-mono text-sm text-slate-800 dark:text-white"
            />

            {bulkText.trim() && (
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 px-1">
                Found <span className="text-blue-600 dark:text-blue-400">{parseBulkCards(bulkText).length}</span> cards.
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleApplyBulkPaste('replace')}
                disabled={!bulkText.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                Replace All
              </button>
              <button
                type="button"
                onClick={() => handleApplyBulkPaste('append')}
                disabled={!bulkText.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus size={18} />
                <span>Add</span>
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
                  setNewFolderName('');
                  setShowNewFolderModal(false);
                  const created = await createUnifiedFolder(db, user?.uid, name);
                  setFolders((prev) => mergeAllFolders([created], prev));
                  setFolderId(created.id);
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
                      className={`h-20 w-full rounded-xl mb-3 flex items-center justify-center relative overflow-hidden shadow-inner ${t.previewBgClass}`}
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

    </div>
  );
}
