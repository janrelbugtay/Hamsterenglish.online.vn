import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  Save,
  X,
  Sparkles,
  Volume2,
  VolumeX,
  RotateCcw,
  Users,
  Play,
  BookOpen,
  Edit3,
  Gamepad2,
  ClipboardList,
  Image as ImageIcon,
  Info,
  Trophy,
  Anchor,
  Zap,
  Shield,
  Skull,
  Type,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { ViewState } from '../types';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { FullscreenButton } from '../components/FullscreenButton';
import { GameModeModal } from '../components/GameModeModal';

interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  cat?: string;
}

interface Quiz {
  id: number | string;
  title: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  isPublic?: boolean;
}

type ScreenState = 'editor' | 'setup' | 'game' | 'study';

interface AvatarCharacter {
  id: string;
  name: string;
  title: string;
  primary: string;
  secondary: string;
  hatColor: string;
  skin: string;
  blush: string;
  svg: string;
}

const CHARACTERS: AvatarCharacter[] = [
  {
    id: 'hamster',
    name: 'Captain Hamster',
    title: 'Temp Avatar',
    primary: '#f59e0b',
    secondary: '#fde68a',
    hatColor: '#06b6d4',
    skin: '#fef3c7',
    blush: '#fb7185',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <circle cx="18" cy="20" r="7" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>
      <circle cx="18" cy="20" r="4" fill="#fde68a"/>
      <circle cx="46" cy="20" r="7" fill="#f59e0b" stroke="#b45309" stroke-width="2"/>
      <circle cx="46" cy="20" r="4" fill="#fde68a"/>
      <circle cx="32" cy="37" r="18" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>
      <ellipse cx="32" cy="41" rx="13" ry="11" fill="#fffbeb"/>
      <ellipse cx="19" cy="39" rx="4" ry="2.4" fill="#fb7185" opacity="0.7"/>
      <ellipse cx="45" cy="39" rx="4" ry="2.4" fill="#fb7185" opacity="0.7"/>
      <rect x="17" y="25" width="30" height="11" rx="5.5" fill="#38bdf8" opacity="0.45" stroke="#0284c7" stroke-width="2"/>
      <circle cx="25" cy="31" r="3.4" fill="#1e1b4b"/>
      <circle cx="23.8" cy="29.8" r="1.2" fill="#ffffff"/>
      <circle cx="39" cy="31" r="3.4" fill="#1e1b4b"/>
      <circle cx="37.8" cy="29.8" r="1.2" fill="#ffffff"/>
      <ellipse cx="32" cy="37" rx="2.5" ry="1.8" fill="#fb7185"/>
      <path d="M28 41 Q32 45 36 41" stroke="#92400e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <rect x="30.5" y="42.5" width="3" height="3.2" rx="0.8" fill="#ffffff" stroke="#92400e" stroke-width="0.8"/>
    </svg>`,
  },
  {
    id: 'bunny',
    name: 'Mochi Bunny',
    title: 'Berry Hop',
    primary: '#fb7185',
    secondary: '#fda4af',
    hatColor: '#f43f5e',
    skin: '#fff1f2',
    blush: '#fb7185',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <ellipse cx="22" cy="18" rx="6" ry="15" transform="rotate(-10 22 18)" fill="#fff1f2" stroke="#fda4af" stroke-width="2"/>
      <ellipse cx="22" cy="19" rx="3" ry="10" transform="rotate(-10 22 19)" fill="#fecdd3"/>
      <ellipse cx="42" cy="18" rx="6" ry="15" transform="rotate(10 42 18)" fill="#fff1f2" stroke="#fda4af" stroke-width="2"/>
      <ellipse cx="42" cy="19" rx="3" ry="10" transform="rotate(10 42 19)" fill="#fecdd3"/>
      <circle cx="32" cy="39" r="17" fill="#fff1f2" stroke="#fda4af" stroke-width="2"/>
      <ellipse cx="20" cy="42" rx="3.5" ry="2" fill="#fb7185" opacity="0.65"/>
      <ellipse cx="44" cy="42" rx="3.5" ry="2" fill="#fb7185" opacity="0.65"/>
      <circle cx="25" cy="37" r="3.5" fill="#1e1b4b"/>
      <circle cx="23.8" cy="35.6" r="1.3" fill="#ffffff"/>
      <circle cx="39" cy="37" r="3.5" fill="#1e1b4b"/>
      <circle cx="37.8" cy="35.6" r="1.3" fill="#ffffff"/>
      <path d="M29 42 Q32 45 35 42" stroke="#be123c" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <circle cx="32" cy="24" r="4.5" fill="#f43f5e"/>
      <path d="M29 20 L32 23 L35 20" stroke="#4ade80" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'axolotl',
    name: 'Boba Lotl',
    title: 'Pink Gill',
    primary: '#ec4899',
    secondary: '#f472b6',
    hatColor: '#38bdf8',
    skin: '#fce7f3',
    blush: '#f43f5e',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <path d="M16 28 L6 22 M14 35 L4 34 M16 42 L7 45" stroke="#ec4899" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M48 28 L58 22 M50 35 L60 34 M48 42 L57 45" stroke="#ec4899" stroke-width="4.5" stroke-linecap="round"/>
      <ellipse cx="32" cy="37" rx="18" ry="15" fill="#fce7f3" stroke="#f9a8d4" stroke-width="2"/>
      <ellipse cx="20" cy="40" rx="3.5" ry="2" fill="#f43f5e" opacity="0.55"/>
      <ellipse cx="44" cy="40" rx="3.5" ry="2" fill="#f43f5e" opacity="0.55"/>
      <circle cx="24" cy="35" r="3.6" fill="#0f172a"/>
      <circle cx="22.8" cy="33.5" r="1.4" fill="#ffffff"/>
      <circle cx="40" cy="35" r="3.6" fill="#0f172a"/>
      <circle cx="38.8" cy="33.5" r="1.4" fill="#ffffff"/>
      <path d="M28 40 Q32 44 36 40" stroke="#be185d" stroke-width="2.3" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'shiba',
    name: 'Pudding Shiba',
    title: 'Good Boy',
    primary: '#f59e0b',
    secondary: '#fef3c7',
    hatColor: '#ef4444',
    skin: '#fbbf24',
    blush: '#fb7185',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <polygon points="15,30 12,12 28,21" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
      <polygon points="49,30 52,12 36,21" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
      <circle cx="32" cy="37" r="17" fill="#fbbf24" stroke="#d97706" stroke-width="2"/>
      <path d="M17 40 Q32 28 47 40 Q44 53 32 53 Q20 53 17 40 Z" fill="#fffbeb"/>
      <ellipse cx="25" cy="29" rx="2.5" ry="1.5" fill="#fffbeb"/>
      <ellipse cx="39" cy="29" rx="2.5" ry="1.5" fill="#fffbeb"/>
      <circle cx="24.5" cy="35" r="3.4" fill="#1e1b4b"/>
      <circle cx="23.5" cy="33.8" r="1.2" fill="#ffffff"/>
      <circle cx="39.5" cy="35" r="3.4" fill="#1e1b4b"/>
      <circle cx="38.5" cy="33.8" r="1.2" fill="#ffffff"/>
      <ellipse cx="32" cy="39" rx="2.8" ry="2" fill="#1e1b4b"/>
      <path d="M28 43 Q32 46 36 43" stroke="#92400e" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'penguin',
    name: 'Pip Penguin',
    title: 'Chilly Puff',
    primary: '#38bdf8',
    secondary: '#fde047',
    hatColor: '#0284c7',
    skin: '#e0f2fe',
    blush: '#fb7185',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <circle cx="32" cy="37" r="17" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
      <path d="M18 36 Q24 25 32 33 Q40 25 46 36 Q46 52 32 52 Q18 52 18 36 Z" fill="#ffffff"/>
      <ellipse cx="20" cy="41" rx="3.2" ry="1.8" fill="#fb7185" opacity="0.65"/>
      <ellipse cx="44" cy="41" rx="3.2" ry="1.8" fill="#fb7185" opacity="0.65"/>
      <circle cx="25" cy="35" r="3.3" fill="#0f172a"/>
      <circle cx="24" cy="33.7" r="1.2" fill="#ffffff"/>
      <circle cx="39" cy="35" r="3.3" fill="#0f172a"/>
      <circle cx="38" cy="33.7" r="1.2" fill="#ffffff"/>
      <ellipse cx="32" cy="39" rx="4.5" ry="2.8" fill="#fb923c"/>
      <ellipse cx="32" cy="19" rx="10" ry="4" fill="#fde047"/>
    </svg>`,
  },
  {
    id: 'cat',
    name: 'Neko Star',
    title: 'Cosmic Kitty',
    primary: '#a855f7',
    secondary: '#facc15',
    hatColor: '#9333ea',
    skin: '#f3e8ff',
    blush: '#f472b6',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <polygon points="15,31 13,12 29,22" fill="#f3e8ff" stroke="#c084fc" stroke-width="2"/>
      <polygon points="17,28 16,16 26,23" fill="#f472b6"/>
      <polygon points="49,31 51,12 35,22" fill="#f3e8ff" stroke="#c084fc" stroke-width="2"/>
      <polygon points="47,28 48,16 38,23" fill="#f472b6"/>
      <circle cx="32" cy="37" r="17" fill="#f3e8ff" stroke="#c084fc" stroke-width="2"/>
      <circle cx="32" cy="26" r="3" fill="#facc15"/>
      <circle cx="24.5" cy="36" r="3.6" fill="#3b0764"/>
      <circle cx="23.3" cy="34.6" r="1.3" fill="#ffffff"/>
      <circle cx="39.5" cy="36" r="3.6" fill="#3b0764"/>
      <circle cx="38.3" cy="34.6" r="1.3" fill="#ffffff"/>
      <path d="M28 42 Q30 45 32 42 Q34 45 36 42" stroke="#6b21a8" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    </svg>`,
  },
  {
    id: 'dino',
    name: 'Chomp Dino',
    title: 'Tiny Rex',
    primary: '#10b981',
    secondary: '#fde047',
    hatColor: '#facc15',
    skin: '#a7f3d0',
    blush: '#fb7185',
    svg: `<svg viewBox="0 0 64 64" class="w-full h-full">
      <polygon points="26,20 32,10 38,20" fill="#fde047" stroke="#eab308" stroke-width="1.5"/>
      <circle cx="32" cy="37" r="17" fill="#6ee7b7" stroke="#10b981" stroke-width="2"/>
      <ellipse cx="20" cy="41" rx="3.5" ry="2" fill="#fb7185" opacity="0.6"/>
      <ellipse cx="44" cy="41" rx="3.5" ry="2" fill="#fb7185" opacity="0.6"/>
      <circle cx="24.5" cy="35" r="3.5" fill="#064e3b"/>
      <circle cx="23.3" cy="33.6" r="1.3" fill="#ffffff"/>
      <circle cx="39.5" cy="35" r="3.5" fill="#064e3b"/>
      <circle cx="38.3" cy="33.6" r="1.3" fill="#ffffff"/>
      <path d="M26 42 Q32 47 38 42" stroke="#065f46" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <polygon points="29,43 30.5,46 32,43" fill="#ffffff"/>
      <polygon points="33,43 34.5,46 36,43" fill="#ffffff"/>
    </svg>`,
  },
];

const BUILTIN_QUESTIONS: Question[] = [
  { id: 101, cat: 'ocean', text: 'How many bones does a shark have in its entire body?', options: ['Zero (Cartilage only)', '206 bones', '128 bones', '54 bones'], answerIndex: 0 },
  { id: 102, cat: 'ocean', text: 'Which species is the largest fish in the ocean?', options: ['Great White Shark', 'Whale Shark', 'Basking Shark', 'Tiger Shark'], answerIndex: 1 },
  { id: 103, cat: 'ocean', text: 'What is the deepest known trench in Earth’s oceans?', options: ['Java Trench', 'Tonga Trench', 'Mariana Trench', 'Puerto Rico Trench'], answerIndex: 2 },
  { id: 104, cat: 'ocean', text: 'How many hearts does a giant Pacific octopus have?', options: ['1 Heart', '2 Hearts', '3 Hearts', '4 Hearts'], answerIndex: 2 },
  { id: 105, cat: 'ocean', text: 'Which ancient prehistoric shark could grow over 50 feet long?', options: ['Helicoprion', 'Megalodon', 'Dunkleosteus', 'Mosasaurus'], answerIndex: 1 },
  { id: 106, cat: 'ocean', text: 'What special sense lets sharks detect electrical fields of prey?', options: ['Sonar Echo', 'Ampullae of Lorenzini', 'Infrared Eyes', 'Thermal Scales'], answerIndex: 1 },
  { id: 107, cat: 'science', text: 'Which planet in our solar system has the most moons?', options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], answerIndex: 1 },
  { id: 108, cat: 'science', text: 'What is the chemical symbol for Gold on the periodic table?', options: ['Gd', 'Go', 'Ag', 'Au'], answerIndex: 3 },
  { id: 109, cat: 'science', text: 'Which gas makes up about 78% of Earth’s atmosphere?', options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], answerIndex: 2 },
  { id: 110, cat: 'science', text: 'What part of the cell is famously known as its "powerhouse"?', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi Body'], answerIndex: 2 },
  { id: 111, cat: 'gaming', text: 'In Minecraft, what material is required to mine Obsidian?', options: ['Iron Pickaxe', 'Gold Pickaxe', 'Diamond or Netherite Pickaxe', 'Stone Pickaxe'], answerIndex: 2 },
  { id: 112, cat: 'gaming', text: 'What is the name of Mario’s dinosaur companion?', options: ['Birdo', 'Yoshi', 'Bowser', 'Toad'], answerIndex: 1 },
  { id: 113, cat: 'math', text: 'What is 15 × 6 − 10?', options: ['70', '80', '85', '90'], answerIndex: 1 },
  { id: 114, cat: 'math', text: 'What is the square root of 144?', options: ['11', '12', '13', '14'], answerIndex: 1 },
  { id: 115, cat: 'geography', text: 'Which country has the most natural lakes in the world?', options: ['USA', 'Russia', 'Canada', 'Brazil'], answerIndex: 2 },
  { id: 116, cat: 'geography', text: 'What is the capital city of Australia?', options: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], answerIndex: 2 },
];

function parsePastedQuiz(rawText: string): Partial<Question>[] {
  if (!rawText || !rawText.trim()) return [];
  const items: Partial<Question>[] = [];

  if (rawText.includes('\t')) {
    const lines = rawText.split(/\r?\n/).filter((line) => line.trim());
    lines.forEach((line) => {
      const parts = line.split('\t').map((p) => p.trim());
      if (parts.length > 0 && parts[0]) {
        const opts = [parts[1] || '', parts[2] || '', parts[3] || '', parts[4] || ''].filter(Boolean);
        while (opts.length < 4) opts.push('');
        let ansIdx = 0;
        if (parts[5]) {
          const ansUpper = parts[5].toUpperCase().trim();
          if (ansUpper === 'B' || ansUpper === '2') ansIdx = 1;
          else if (ansUpper === 'C' || ansUpper === '3') ansIdx = 2;
          else if (ansUpper === 'D' || ansUpper === '4') ansIdx = 3;
        }
        items.push({
          text: parts[0],
          options: opts,
          answerIndex: ansIdx,
        });
      }
    });
    if (items.length > 0) return items;
  }

  const blocks = rawText.split(/\n\s*\n/).filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const qText = lines[0].replace(/^\d+[\.\)\-]\s*/, '').trim();
    const opts: string[] = [];
    let ansIdx = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const ansMatch = line.match(/^(?:answer|correct|ans)\s*[:\-]?\s*([A-Da-d1-4])/i);
      if (ansMatch) {
        const val = ansMatch[1].toUpperCase();
        if (val === 'A' || val === '1') ansIdx = 0;
        else if (val === 'B' || val === '2') ansIdx = 1;
        else if (val === 'C' || val === '3') ansIdx = 2;
        else if (val === 'D' || val === '4') ansIdx = 3;
        continue;
      }
      const isMarkedCorrect = line.startsWith('*') || line.endsWith('*') || line.includes('(correct)');
      const cleanOpt = line
        .replace(/^\*/, '')
        .replace(/\*$/, '')
        .replace(/\(correct\)/gi, '')
        .replace(/^[A-Fa-f][\.\)\-]\s*/, '')
        .trim();
      if (cleanOpt) {
        if (isMarkedCorrect) ansIdx = opts.length;
        opts.push(cleanOpt);
      }
    }

    while (opts.length < 4) opts.push('');
    items.push({
      text: qText,
      options: opts.slice(0, 6),
      answerIndex: Math.min(ansIdx, Math.max(0, opts.length - 1)),
    });
  }

  return items;
}

export function SharkAttack({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();

  const normalizeLoadedQuestions = (rawList: any[]): Question[] => {
    if (!Array.isArray(rawList) || rawList.length === 0) return [];
    return rawList
      .map((q: any, idx: number) => {
        const text = (q.text || q.question || q.q || '').toString().trim();
        const rawOpts = Array.isArray(q.options)
          ? q.options
          : Array.isArray(q.o)
          ? q.o
          : Array.isArray(q.answers)
          ? q.answers.map((a: any) => (typeof a === 'string' ? a : a?.text || ''))
          : [];
        const opts = rawOpts.map((o: any) => (typeof o === 'string' ? o : o?.text || '')).slice(0, 6);
        while (opts.length < 4) opts.push(`Option ${opts.length + 1}`);
        const ansIdx =
          typeof q.answerIndex === 'number'
            ? q.answerIndex
            : typeof q.correct === 'number'
            ? q.correct
            : typeof q.correctOptionIndex === 'number'
            ? q.correctOptionIndex
            : typeof q.a === 'number'
            ? q.a
            : 0;
        return {
          id: q.id || idx + 1,
          text,
          options: opts,
          answerIndex: Math.max(0, Math.min(opts.length - 1, ansIdx)),
          cat: q.cat || 'Custom Quiz',
        };
      })
      .filter((q) => q.text.length > 0);
  };

  const initialLoadedQuestions = initialGame
    ? normalizeLoadedQuestions(initialGame.customQuestions || initialGame.questions || [])
    : [];
  const hasLoadedQuestions = initialLoadedQuestions.length > 0;

  const [screen, setScreen] = useState<ScreenState>(
    initialGame && !initialGame.editMode && hasLoadedQuestions ? 'setup' : 'editor'
  );
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [showModeModal, setShowModeModal] = useState(false);

  const [activeQuiz, setActiveQuiz] = useState<Quiz>(() => {
    if (initialGame) {
      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || 'Shark Attack Quiz',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions:
          initialLoadedQuestions.length > 0
            ? initialLoadedQuestions
            : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }],
      };
    }
    return {
      id: Date.now(),
      title: '',
      folderId: '',
      topic: '',
      classLevel: '',
      questions: [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }],
    };
  });

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        try {
          const qFolders = query(collection(db, 'gameFolders'), where('userId', '==', user.uid));
          const snap = await getDocs(qFolders);
          const list: { id: string; name: string }[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...(d.data() as any) }));
          setFolders(list);
        } catch (e) {
          console.warn('Folders fetch error:', e);
        }
      };
      fetchFolders();
    }
  }, [user]);

  useEffect(() => {
    if (initialGame) {
      const loaded = normalizeLoadedQuestions(initialGame.customQuestions || initialGame.questions || []);
      setActiveQuiz({
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || 'Shark Attack Quiz',
        folderId: initialGame.folderId || '',
        topic: initialGame.topic || initialGame.name || '',
        classLevel: initialGame.className || initialGame.classLevel || '',
        questions:
          loaded.length > 0
            ? loaded
            : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }],
      });
      if (!initialGame.editMode && loaded.length > 0) {
        setScreen('setup');
      } else {
        setScreen('editor');
      }
    }
  }, [initialGame]);

  const saveQuiz = async (quizToSave: Quiz) => {
    setActiveQuiz(quizToSave);
    if (!user) {
      setScreen('setup');
      return;
    }

    onViewChange('games');

    try {
      const payload = JSON.parse(
        JSON.stringify({
          name: quizToSave.topic || quizToSave.title || 'Shark Attack Game',
          folderId: quizToSave.folderId || '',
          topic: quizToSave.topic || '',
          className: quizToSave.classLevel || '',
          gameType: 'shark-attack',
          originalGameType: 'shark-attack',
          customQuestions: quizToSave.questions,
          userId: user.uid,
          updatedAt: new Date().toISOString(),
          isPublic: quizToSave.isPublic ?? false,
        })
      );

      if (initialGame?.id && typeof initialGame.id === 'string') {
        await updateDoc(doc(db, 'mysteryBoxGames', initialGame.id), payload);
      } else {
        await addDoc(collection(db, 'mysteryBoxGames'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error saving Shark Attack game:', err);
    }
  };

  // --- Sound Engine ---
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.15, slideTo?: number) => {
    if (!soundEnabledRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) {
        osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
      }
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (e) {}
  };

  const sfx = {
    lockIn: () => playTone(520, 'sine', 0.1, 0.12, 740),
    correct: () => {
      playTone(523.25, 'triangle', 0.12, 0.18);
      setTimeout(() => playTone(659.25, 'triangle', 0.12, 0.18), 90);
      setTimeout(() => playTone(783.99, 'triangle', 0.25, 0.2), 180);
    },
    stepUpDanger: () => {
      playTone(190, 'sawtooth', 0.22, 0.2, 95);
      setTimeout(() => playTone(145, 'sawtooth', 0.28, 0.22, 70), 180);
    },
    sharkChomp: () => {
      playTone(120, 'sawtooth', 0.35, 0.3, 42);
      setTimeout(() => playTone(260, 'square', 0.25, 0.25, 55), 150);
      setTimeout(() => playTone(90, 'sawtooth', 0.45, 0.35, 35), 300);
    },
    ropeSafe: () => playTone(400, 'sine', 0.15, 0.18, 800),
  };

  // --- Match Setup & Live Game State ---
  const [p1Name, setP1Name] = useState('Player 1');
  const [p2Name, setP2Name] = useState('Player 2');
  const [p1CharIndex, setP1CharIndex] = useState(0); // Default Captain Hamster temp avatar
  const [p2CharIndex, setP2CharIndex] = useState(1); // Default Mochi Bunny temp avatar
  const [p2Mode, setP2Mode] = useState<'human' | 'ai_normal' | 'ai_hard'>('human');
  const [ruleMode, setRuleMode] = useState<'classic' | 'speed'>('classic');
  const [maxSteps, setMaxSteps] = useState<number>(5);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('custom');

  // Font size scaling (Small / Medium / Large popup)
  const [fontScale, setFontScale] = useState<'small' | 'medium' | 'large'>('medium');
  const [showFontMenu, setShowFontMenu] = useState(false);

  // Study mode state
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);

  // React state mirrors for UI HUD
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<'setup' | 'question' | 'reveal' | 'animating' | 'gameover'>('setup');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timerLeft, setTimerLeft] = useState(15);
  const [arenaBannerText, setArenaBannerText] = useState("DON'T CLIMB TO THE TOP!");
  const [shakeScreen, setShakeScreen] = useState(false);

  const [p1Hud, setP1Hud] = useState({
    step: 0,
    selectedOption: null as number | null,
    lockTime: null as number | null,
    streak: 0,
    hasRope: false,
  });
  const [p2Hud, setP2Hud] = useState({
    step: 0,
    selectedOption: null as number | null,
    lockTime: null as number | null,
    streak: 0,
    hasRope: false,
  });

  const [gameOverInfo, setGameOverInfo] = useState<{
    p1Fell: boolean;
    p2Fell: boolean;
    rounds: number;
    accuracy: number;
  } | null>(null);

  // Mutable ref state for 60fps Canvas & Timer loop
  const engineRef = useRef({
    round: 1,
    maxSteps: 5,
    ruleMode: 'classic' as 'classic' | 'speed',
    phase: 'setup' as 'setup' | 'question' | 'reveal' | 'animating' | 'gameover',
    timerMax: 15,
    timerLeft: 15,
    lastTick: performance.now(),
    questionPool: [] as Question[],
    currentQuestion: null as Question | null,
    totalQuestionsAsked: 0,
    totalCorrectAnswers: 0,
    players: {
      1: {
        name: 'Player 1',
        charIndex: 0,
        step: 0,
        visualStep: 0,
        selectedOption: null as number | null,
        lockTime: null as number | null,
        streak: 0,
        hasRope: false,
        falling: false,
        fallProgress: 0,
        emotion: 'idle' as 'idle' | 'happy' | 'scared' | 'eaten',
      },
      2: {
        name: 'Player 2',
        charIndex: 1,
        mode: 'human' as 'human' | 'ai_normal' | 'ai_hard',
        step: 0,
        visualStep: 0,
        selectedOption: null as number | null,
        lockTime: null as number | null,
        streak: 0,
        hasRope: false,
        falling: false,
        fallProgress: 0,
        emotion: 'idle' as 'idle' | 'happy' | 'scared' | 'eaten',
      },
    },
    shark: {
      mouthAngle: 0.35,
      targetMouthAngle: 0.35,
      lungeY: 0,
      targetLungeY: 0,
      lookDir: 0,
    },
    particles: [] as Array<{
      normX: number;
      normY: number;
      vx: number;
      vy: number;
      r: number;
      color: string;
      alpha: number;
    }>,
    floatingTexts: [] as Array<{
      normX: number;
      normY: number;
      text: string;
      color: string;
      alpha: number;
      vy: number;
    }>,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const aiTimerRef = useRef<any>(null);
  const roundTimeoutRef = useRef<any>(null);

  const syncHudFromEngine = () => {
    const eng = engineRef.current;
    setRound(eng.round);
    setPhase(eng.phase);
    setCurrentQuestion(eng.currentQuestion);
    setP1Hud({
      step: eng.players[1].step,
      selectedOption: eng.players[1].selectedOption,
      lockTime: eng.players[1].lockTime,
      streak: eng.players[1].streak,
      hasRope: eng.players[1].hasRope,
    });
    setP2Hud({
      step: eng.players[2].step,
      selectedOption: eng.players[2].selectedOption,
      lockTime: eng.players[2].lockTime,
      streak: eng.players[2].streak,
      hasRope: eng.players[2].hasRope,
    });
  };

  const spawnFloatingText = (normX: number, normY: number, text: string, color: string) => {
    engineRef.current.floatingTexts.push({
      normX,
      normY,
      text,
      color,
      alpha: 1,
      vy: -0.0008,
    });
  };

  const spawnSplashParticles = (normX: number, normY: number, count = 24) => {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI * 0.15 - Math.random() * Math.PI * 0.7;
      const speed = 2 + Math.random() * 6;
      engineRef.current.particles.push({
        normX,
        normY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        r: 3 + Math.random() * 5,
        color: Math.random() > 0.3 ? '#38bdf8' : '#e0f2fe',
        alpha: 1,
      });
    }
  };

  const buildQuestionPool = () => {
    const validCustom = activeQuiz.questions.filter(
      (q) => q.text.trim() && q.options.filter((o) => o.trim()).length >= 2
    );

    let source: Question[] = [];
    if (selectedTopicFilter === 'custom' && validCustom.length > 0) {
      source = validCustom.map((q) => {
        const opts = [...q.options];
        while (opts.length < 4) opts.push('—');
        return {
          ...q,
          options: opts.slice(0, 4),
          answerIndex: Math.min(3, Math.max(0, q.answerIndex)),
          cat: activeQuiz.topic || activeQuiz.title || 'Custom Quiz',
        };
      });
    } else if (selectedTopicFilter === 'all' || validCustom.length === 0) {
      source = [...BUILTIN_QUESTIONS];
    } else {
      source = BUILTIN_QUESTIONS.filter((q) => q.cat === selectedTopicFilter);
      if (source.length === 0) source = [...BUILTIN_QUESTIONS];
    }

    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    engineRef.current.questionPool = source;
  };

  const useRopePowerup = (pid: 1 | 2) => {
    const eng = engineRef.current;
    const p = eng.players[pid];
    if (!p.hasRope || p.step <= 0 || eng.phase !== 'question') return;
    p.hasRope = false;
    p.step = Math.max(0, p.step - 1);
    sfx.ropeSafe();
    spawnFloatingText(pid === 1 ? 0.22 : 0.78, 0.35, '⚓ ROPE SAVED -1 STEP!', '#34d399');
    syncHudFromEngine();
  };

  const triggerFallIntoShark = (p1Fell: boolean, p2Fell: boolean) => {
    const eng = engineRef.current;
    sfx.sharkChomp();
    eng.shark.targetLungeY = -48;
    eng.shark.targetMouthAngle = 0.95;

    if (p1Fell) {
      eng.players[1].falling = true;
      eng.players[1].emotion = 'eaten';
    }
    if (p2Fell) {
      eng.players[2].falling = true;
      eng.players[2].emotion = 'eaten';
    }

    setArenaBannerText('🦈 CHOMP!! EATEN BY THE MEGALODON!');
    syncHudFromEngine();

    setTimeout(() => {
      eng.shark.targetMouthAngle = 0.05;
      eng.shark.targetLungeY = 10;
      sfx.sharkChomp();
      spawnSplashParticles(0.5, 0.78, 35);
    }, 700);

    setTimeout(() => {
      eng.phase = 'gameover';
      const acc =
        eng.totalQuestionsAsked > 0
          ? Math.round((eng.totalCorrectAnswers / eng.totalQuestionsAsked) * 100)
          : 100;
      setGameOverInfo({
        p1Fell,
        p2Fell,
        rounds: eng.round,
        accuracy: acc,
      });
      syncHudFromEngine();
    }, 2100);
  };

  const resolveQuestionRound = () => {
    const eng = engineRef.current;
    if (eng.phase !== 'question' || !eng.currentQuestion) return;
    eng.phase = 'reveal';
    eng.totalQuestionsAsked += 2;

    const correctIdx = eng.currentQuestion.answerIndex;
    const p1 = eng.players[1];
    const p2 = eng.players[2];
    const p1Right = p1.selectedOption === correctIdx;
    const p2Right = p2.selectedOption === correctIdx;

    if (p1Right) eng.totalCorrectAnswers++;
    if (p2Right) eng.totalCorrectAnswers++;

    let p1Climbs = !p1Right;
    let p2Climbs = !p2Right;
    let speedPushMsg = '';

    if (eng.ruleMode === 'speed' && p1Right && p2Right && p1.lockTime !== null && p2.lockTime !== null) {
      if (p1.lockTime > p2.lockTime + 0.25) {
        p1Climbs = true;
        speedPushMsg = `⚡ ${p2.name} was faster! ${p1.name} climbs!`;
      } else if (p2.lockTime > p1.lockTime + 0.25) {
        p2Climbs = true;
        speedPushMsg = `⚡ ${p1.name} was faster! ${p2.name} climbs!`;
      }
    }

    [
      { pid: 1 as const, right: p1Right, climbs: p1Climbs },
      { pid: 2 as const, right: p2Right, climbs: p2Climbs },
    ].forEach(({ pid, right, climbs }) => {
      const p = eng.players[pid];
      if (right && !climbs) {
        p.streak++;
        p.emotion = 'happy';
        if (p.streak >= 3) {
          p.streak = 0;
          if (p.step > 0 && !p.hasRope) {
            p.hasRope = true;
            spawnFloatingText(pid === 1 ? 0.2 : 0.8, 0.28, '⚓ EARNED ROPE LIFELINE!', '#38bdf8');
          }
        }
      } else {
        p.streak = 0;
        p.emotion = 'scared';
      }
    });

    if (p1Climbs || p2Climbs) {
      sfx.stepUpDanger();
      setShakeScreen(true);
      setTimeout(() => setShakeScreen(false), 500);
    } else {
      sfx.correct();
    }

    if (p1Climbs) {
      p1.step++;
      spawnFloatingText(0.24, 0.42, '⬆️ CLIMB +1 STEP!', '#fb7185');
    } else {
      spawnFloatingText(0.24, 0.42, '🛡️ STAY SAFE!', '#34d399');
    }

    if (p2Climbs) {
      p2.step++;
      spawnFloatingText(0.76, 0.42, '⬆️ CLIMB +1 STEP!', '#fbbf24');
    } else {
      spawnFloatingText(0.76, 0.42, '🛡️ STAY SAFE!', '#34d399');
    }

    const highestStep = Math.max(p1.step, p2.step);
    eng.shark.targetMouthAngle = 0.35 + (highestStep / (eng.maxSteps + 1)) * 0.55;
    eng.shark.lookDir = p1.step > p2.step ? -1 : p2.step > p1.step ? 1 : 0;

    if (speedPushMsg) {
      setArenaBannerText(speedPushMsg);
    } else if (p1Climbs && p2Climbs) {
      setArenaBannerText('BOTH CLIMBED UP TOWARD THE SHARK!');
    } else if (p1Climbs) {
      setArenaBannerText(`${p1.name.toUpperCase()} CLIMBS UP A STEP!`);
    } else if (p2Climbs) {
      setArenaBannerText(`${p2.name.toUpperCase()} CLIMBS UP A STEP!`);
    } else {
      setArenaBannerText('BOTH PLAYERS ANSWERED CORRECTLY & HELD GROUND!');
    }

    syncHudFromEngine();

    const p1Fell = p1.step > eng.maxSteps;
    const p2Fell = p2.step > eng.maxSteps;

    if (p1Fell || p2Fell) {
      eng.phase = 'animating';
      syncHudFromEngine();
      roundTimeoutRef.current = setTimeout(() => {
        triggerFallIntoShark(p1Fell, p2Fell);
      }, 900);
    } else {
      roundTimeoutRef.current = setTimeout(() => {
        eng.round++;
        startNewQuestionRound();
      }, 2400);
    }
  };

  const handlePlayerInput = (pid: 1 | 2, optionIndex: number, fromAI = false) => {
    const eng = engineRef.current;
    if (eng.phase !== 'question') return;
    const p = eng.players[pid];
    if (pid === 2 && eng.players[2].mode !== 'human' && !fromAI) return;
    if (p.selectedOption !== null) return;

    p.selectedOption = optionIndex;
    p.lockTime = Math.max(0.1, eng.timerMax - eng.timerLeft);
    sfx.lockIn();
    syncHudFromEngine();

    if (eng.players[1].selectedOption !== null && eng.players[2].selectedOption !== null) {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      resolveQuestionRound();
    }
  };

  const startNewQuestionRound = () => {
    const eng = engineRef.current;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);

    if (eng.questionPool.length === 0) {
      buildQuestionPool();
    }
    const nextQ = eng.questionPool.pop() || BUILTIN_QUESTIONS[0];
    eng.currentQuestion = nextQ;
    eng.phase = 'question';
    eng.timerMax = 15;
    eng.timerLeft = 15;
    eng.lastTick = performance.now();

    ([1, 2] as const).forEach((pid) => {
      const p = eng.players[pid];
      p.selectedOption = null;
      p.lockTime = null;
      p.emotion = p.step >= eng.maxSteps ? 'scared' : 'idle';
    });

    setTimerLeft(15);
    setArenaBannerText(`ROUND ${eng.round}: P1 [WASD] vs P2 [ARROW KEYS]!`);
    syncHudFromEngine();

    if (eng.players[2].mode !== 'human') {
      const isHard = eng.players[2].mode === 'ai_hard';
      const delayMs = isHard ? 1800 + Math.random() * 2500 : 3000 + Math.random() * 4000;
      aiTimerRef.current = setTimeout(() => {
        if (engineRef.current.phase !== 'question' || !engineRef.current.currentQuestion) return;
        const acc = isHard ? 0.84 : 0.62;
        const ans = engineRef.current.currentQuestion.answerIndex;
        let choice = ans;
        if (Math.random() > acc) {
          const wrongOpts = [0, 1, 2, 3].filter((x) => x !== ans);
          choice = wrongOpts[Math.floor(Math.random() * wrongOpts.length)];
        }
        if (engineRef.current.players[2].hasRope && engineRef.current.players[2].step >= 2) {
          useRopePowerup(2);
        }
        handlePlayerInput(2, choice, true);
      }, delayMs);
    }
  };

  const startMatch = () => {
    const eng = engineRef.current;
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    if (roundTimeoutRef.current) clearTimeout(roundTimeoutRef.current);

    const resolvedP1Name = p1Name.trim() || 'Player 1';
    let resolvedP2Name = p2Name.trim() || 'Player 2';
    if (p2Mode !== 'human' && resolvedP2Name === 'Player 2') {
      resolvedP2Name = p2Mode === 'ai_hard' ? 'Robo-Shark AI' : 'Bot Finny';
    }

    eng.round = 1;
    eng.maxSteps = maxSteps;
    eng.ruleMode = ruleMode;
    eng.totalQuestionsAsked = 0;
    eng.totalCorrectAnswers = 0;

    eng.players[1] = {
      name: resolvedP1Name,
      charIndex: p1CharIndex,
      step: 0,
      visualStep: 0,
      selectedOption: null,
      lockTime: null,
      streak: 0,
      hasRope: false,
      falling: false,
      fallProgress: 0,
      emotion: 'idle',
    };
    eng.players[2] = {
      name: resolvedP2Name,
      charIndex: p2CharIndex,
      mode: p2Mode,
      step: 0,
      visualStep: 0,
      selectedOption: null,
      lockTime: null,
      streak: 0,
      hasRope: false,
      falling: false,
      fallProgress: 0,
      emotion: 'idle',
    };

    eng.shark.lungeY = 0;
    eng.shark.targetLungeY = 0;
    eng.shark.mouthAngle = 0.35;
    eng.shark.targetMouthAngle = 0.35;
    eng.particles = [];
    eng.floatingTexts = [];

    setGameOverInfo(null);
    buildQuestionPool();
    setScreen('game');
    startNewQuestionRound();
  };

  // Keyboard listener for WASD (Player 1) and Arrow Keys (Player 2)
  useEffect(() => {
    if (screen !== 'game') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if (engineRef.current.phase !== 'question') return;

      const upper = e.key.toUpperCase();
      const p1Map: Record<string, number> = { W: 0, A: 1, S: 2, D: 3 };
      if (upper in p1Map) {
        e.preventDefault();
        handlePlayerInput(1, p1Map[upper]);
        return;
      }

      const p2Map: Record<string, number> = {
        ArrowUp: 0,
        ArrowLeft: 1,
        ArrowDown: 2,
        ArrowRight: 3,
      };
      if (e.key in p2Map) {
        e.preventDefault();
        handlePlayerInput(2, p2Map[e.key]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen]);

  // 60FPS HTML5 Canvas Loop for Shark Attack Arena
  useEffect(() => {
    if (screen !== 'game') return;
    let animId: number;

    const getStairPosition = (
      side: 'left' | 'right',
      stepFloat: number,
      width: number,
      height: number,
      maxS: number
    ) => {
      const clampedStep = Math.min(maxS, Math.max(0, stepFloat));
      const progress = clampedStep / maxS;

      const baseGroundY = height * 0.8;
      const topLedgeY = height * 0.24;
      const outerMarginX = width * 0.08;
      const innerAbyssX = width * 0.37;

      const y = baseGroundY - progress * (baseGroundY - topLedgeY);
      const x =
        side === 'left'
          ? outerMarginX + progress * (innerAbyssX - outerMarginX)
          : width - outerMarginX - progress * (innerAbyssX - outerMarginX);

      const frac = stepFloat % 1;
      const hopOffset = Math.sin(frac * Math.PI) * 26;
      return { x, y: y - hopOffset };
    };

    const drawGiantShark = (
      ctx: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      width: number,
      time: number
    ) => {
      const eng = engineRef.current;
      ctx.save();
      const bob = Math.sin(time * 0.0045) * 6;
      const sway = Math.cos(time * 0.0025) * 0.03;
      ctx.translate(cx, cy + bob);
      ctx.rotate(sway);

      const scale = Math.min(1.18, Math.max(0.74, width / 880));
      ctx.scale(scale, scale);

      const jawSpread = 44 + eng.shark.mouthAngle * 46;

      // Swirling water vortex ring
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.beginPath();
      ctx.ellipse(0, 48, jawSpread + 55, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Pectoral fins
      ctx.fillStyle = '#0f294a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-jawSpread - 10, 15);
      ctx.quadraticCurveTo(-jawSpread - 68, 22, -jawSpread - 52, 52);
      ctx.quadraticCurveTo(-jawSpread - 20, 44, -jawSpread, 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(jawSpread + 10, 15);
      ctx.quadraticCurveTo(jawSpread + 68, 22, jawSpread + 52, 52);
      ctx.quadraticCurveTo(jawSpread + 20, 44, jawSpread, 34);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shark head & V-jaws
      const bodyGrad = ctx.createLinearGradient(0, -108, 0, 62);
      bodyGrad.addColorStop(0, '#38bdf8');
      bodyGrad.addColorStop(0.35, '#0284c7');
      bodyGrad.addColorStop(0.75, '#1e3a8a');
      bodyGrad.addColorStop(1, '#09152b');

      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(0, 62);
      ctx.bezierCurveTo(-jawSpread - 45, 25, -jawSpread - 42, -35, -jawSpread - 18, -104);
      ctx.quadraticCurveTo(-jawSpread * 0.45, -35, -10, -6);
      ctx.quadraticCurveTo(0, 8, 10, -6);
      ctx.quadraticCurveTo(jawSpread * 0.45, -35, jawSpread + 18, -104);
      ctx.bezierCurveTo(jawSpread + 42, -35, jawSpread + 45, 25, 0, 62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-jawSpread - 12, -92);
      ctx.quadraticCurveTo(-jawSpread * 0.5, -25, 0, 4);
      ctx.quadraticCurveTo(jawSpread * 0.5, -25, jawSpread + 12, -92);
      ctx.stroke();

      // Deep cavernous mouth
      const mouthGrad = ctx.createLinearGradient(0, -88, 0, 10);
      mouthGrad.addColorStop(0, '#4c0519');
      mouthGrad.addColorStop(0.6, '#881337');
      mouthGrad.addColorStop(1, '#be123c');

      ctx.fillStyle = mouthGrad;
      ctx.beginPath();
      ctx.moveTo(-jawSpread - 12, -90);
      ctx.quadraticCurveTo(-jawSpread * 0.42, -26, 0, 2);
      ctx.quadraticCurveTo(jawSpread * 0.42, -26, jawSpread + 12, -90);
      ctx.quadraticCurveTo(0, -52, -jawSpread - 12, -90);
      ctx.closePath();
      ctx.fill();

      // Tongue
      const tongueWave = Math.sin(time * 0.008) * 5;
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.moveTo(-24, -18);
      ctx.quadraticCurveTo(tongueWave, -44, 24, -18);
      ctx.quadraticCurveTo(0, 4, -24, -18);
      ctx.fill();

      // Razor teeth
      const numTeeth = 6;
      for (const side of [-1, 1]) {
        for (let t = 0; t < numTeeth; t++) {
          const frac1 = (t + 0.1) / numTeeth;
          const frac2 = (t + 0.88) / numTeeth;
          const x1 = side * (8 + frac1 * (jawSpread + 6));
          const y1 = -4 - frac1 * 84;
          const x2 = side * (8 + frac2 * (jawSpread + 6));
          const y2 = -4 - frac2 * 84;
          const tipX = (x1 + x2) * 0.5 - side * 18;
          const tipY = (y1 + y2) * 0.5 + 7;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(tipX, tipY);
          ctx.lineTo(x2, y2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }

      // Fierce glowing eyes
      ([-1, 1] as const).forEach((side) => {
        const ex = side * (jawSpread * 0.65 + 16);
        const ey = -24;

        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ex, ey, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const lookOffset = eng.shark.lookDir * 2.5;
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(ex + lookOffset, ey - 1, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(ex + lookOffset, ey - 1, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + lookOffset - 1.5, ey - 2.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
    };

    const drawPlayerCharacter = (
      ctx: CanvasRenderingContext2D,
      pid: 1 | 2,
      side: 'left' | 'right',
      width: number,
      height: number,
      time: number
    ) => {
      const eng = engineRef.current;
      const p = eng.players[pid];
      const charDef = CHARACTERS[p.charIndex] || CHARACTERS[0];

      let x = 0;
      let y = 0;
      let rotation = 0;

      if (p.falling) {
        p.fallProgress = Math.min(1, p.fallProgress + 0.026);
        const startPos = getStairPosition(side, eng.maxSteps, width, height, eng.maxSteps);
        const targetX = width * 0.5 + (pid === 1 ? -10 : 10);
        const targetY = height * 0.72;

        x = startPos.x + (targetX - startPos.x) * p.fallProgress;
        const arc = -Math.sin(p.fallProgress * Math.PI) * 98;
        y = startPos.y + (targetY - startPos.y) * (p.fallProgress * p.fallProgress) + arc;
        rotation = p.fallProgress * (pid === 1 ? 9 : -9);

        if (p.fallProgress >= 0.95) return;
      } else {
        const pos = getStairPosition(side, p.visualStep, width, height, eng.maxSteps);
        x = pos.x;
        y = pos.y;
      }

      ctx.save();
      const isPanic = p.emotion === 'scared' || p.step >= eng.maxSteps || p.falling;
      const bounceSpeed = isPanic ? 0.018 : 0.006;
      const idleBounce = Math.sin(time * bounceSpeed + pid * 2) * (isPanic ? 4.5 : 3);
      const squash = 1 + Math.sin(time * bounceSpeed + pid * 2) * 0.04;

      ctx.translate(x, y - 24 + idleBounce);
      ctx.rotate(rotation);

      if (p.step >= eng.maxSteps && !p.falling) {
        ctx.translate((Math.random() - 0.5) * 3.5, 0);
      }

      if (!p.falling) {
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.beginPath();
        ctx.ellipse(0, 24 - idleBounce, 15, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.scale(squash, 2 - squash);

      // Feet
      const footKick = Math.sin(time * 0.015 + pid) * (isPanic ? 5 : 1.5);
      ctx.fillStyle = charDef.secondary;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-6, 20 + footKick, 4.5, 3.2, 0, 0, Math.PI * 2);
      ctx.ellipse(6, 20 - footKick, 4.5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Torso
      ctx.fillStyle = charDef.primary;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-11, 2, 22, 17, 9);
      ctx.fill();
      ctx.stroke();

      // Tummy patch
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 11, 6, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Arms
      const armWave = isPanic ? Math.sin(time * 0.03) * 14 - 12 : Math.sin(time * 0.007) * 4;
      ctx.fillStyle = charDef.skin;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-14, 8 + armWave * 0.4, 4.5, 3.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(14, 8 - armWave * 0.4, 4.5, 3.5, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Ears / Frills
      ctx.save();
      if (charDef.id === 'hamster') {
        ([-1, 1] as const).forEach((dir) => {
          ctx.fillStyle = '#f59e0b';
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dir * 11, -21, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.beginPath();
          ctx.arc(dir * 11, -21, 2.8, 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (charDef.id === 'bunny') {
        const earWiggle = Math.sin(time * 0.008 + pid) * 0.12;
        ([-1, 1] as const).forEach((dir) => {
          ctx.save();
          ctx.translate(dir * 7, -20);
          ctx.rotate(dir * 0.22 + earWiggle * dir);
          ctx.fillStyle = charDef.skin;
          ctx.strokeStyle = '#fda4af';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -8, 4.5, 11, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      } else if (charDef.id === 'axolotl') {
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ([-1, 1] as const).forEach((dir) => {
          for (let f = -1; f <= 1; f++) {
            ctx.beginPath();
            ctx.moveTo(dir * 13, -10 + f * 4.5);
            ctx.lineTo(dir * 20, -12 + f * 6 + Math.sin(time * 0.01 + f) * 1.5);
            ctx.stroke();
          }
        });
      } else if (charDef.id === 'shiba' || charDef.id === 'cat') {
        ([-1, 1] as const).forEach((dir) => {
          ctx.fillStyle = charDef.skin;
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(dir * 4, -21);
          ctx.lineTo(dir * 14, -30);
          ctx.lineTo(dir * 15, -15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      } else if (charDef.id === 'dino') {
        ctx.fillStyle = '#fde047';
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 1.5;
        for (let sp = -1; sp <= 1; sp++) {
          ctx.beginPath();
          ctx.moveTo(sp * 6 - 3.5, -21);
          ctx.lineTo(sp * 6, -29);
          ctx.lineTo(sp * 6 + 3.5, -21);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();

      // Chibi Head
      ctx.fillStyle = charDef.skin;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, -10, 15.5, 13.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Blush
      ctx.fillStyle = charDef.blush || '#fb7185';
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.ellipse(-9, -7, 3.2, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(9, -7, 3.2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Eyes & Mouth
      if (isPanic) {
        ([-1, 1] as const).forEach((dir) => {
          const ex = dir * 5.5;
          const ey = -11;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(ex, ey, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(ex, ey, 1.7, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#be123c';
        ctx.beginPath();
        ctx.ellipse(0, -4.5, 4, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ([-1, 1] as const).forEach((dir) => {
          const ex = dir * 5.5;
          const ey = -11;
          ctx.fillStyle = '#1e1b4b';
          ctx.beginPath();
          ctx.arc(ex, ey, 3.6, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex - 1.2, ey - 1.3, 1.5, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-3.5, -5.5);
        ctx.quadraticCurveTo(-1.7, -3.5, 0, -5.5);
        ctx.quadraticCurveTo(1.7, -3.5, 3.5, -5.5);
        ctx.stroke();
      }

      // Floating Player Name Tag
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      const tagText = pid === 1 ? `P1: ${p.name}` : `P2: ${p.name}`;
      const tagW = ctx.measureText(tagText).width + 14;
      ctx.fillStyle = pid === 1 ? 'rgba(225, 29, 72, 0.92)' : 'rgba(217, 119, 6, 0.92)';
      ctx.beginPath();
      ctx.roundRect(-tagW / 2, -45, tagW, 17, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, 0, -33);

      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(renderFrame);
        return;
      }
      const rect = canvas.parentElement?.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (rect && (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr))) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const eng = engineRef.current;

      const dt = Math.min(0.1, (now - eng.lastTick) / 1000);
      eng.lastTick = now;

      if (eng.phase === 'question') {
        eng.timerLeft = Math.max(0, eng.timerLeft - dt);
        setTimerLeft(eng.timerLeft);
        if (eng.timerLeft <= 0) {
          if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
          resolveQuestionRound();
        }
      }

      ([1, 2] as const).forEach((pid) => {
        const p = eng.players[pid];
        const target = Math.min(eng.maxSteps, p.step);
        p.visualStep += (target - p.visualStep) * 0.12;
      });
      eng.shark.mouthAngle += (eng.shark.targetMouthAngle - eng.shark.mouthAngle) * 0.12;
      eng.shark.lungeY += (eng.shark.targetLungeY - eng.shark.lungeY) * 0.14;

      ctx.clearRect(0, 0, width, height);

      // Abyss glow
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.68,
        15,
        width * 0.5,
        height * 0.45,
        width * 0.65
      );
      bgGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
      bgGrad.addColorStop(0.5, 'rgba(14, 116, 144, 0.12)');
      bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Bubbles
      ctx.fillStyle = 'rgba(186, 230, 253, 0.18)';
      for (let b = 0; b < 12; b++) {
        const bx = (b * 97 + Math.sin(now * 0.001 + b) * 25) % width;
        const by = height - ((now * 0.03 + b * 45) % height);
        const br = 2 + (b % 4) * 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D Stone Staircases
      const maxS = eng.maxSteps;
      const baseGroundY = height * 0.8;
      const topLedgeY = height * 0.24;
      const outerX = width * 0.05;
      const innerX = width * 0.375;
      const stepW = (innerX - outerX) / maxS;
      const stepH = (baseGroundY - topLedgeY) / maxS;

      (['left', 'right'] as const).forEach((side) => {
        ctx.save();
        ctx.beginPath();
        if (side === 'left') {
          ctx.moveTo(0, height);
          ctx.lineTo(0, baseGroundY);
          ctx.lineTo(outerX + stepW * 0.4, baseGroundY);
          for (let s = 1; s <= maxS; s++) {
            const sx = outerX + (s - 0.6) * stepW;
            const sy = baseGroundY - s * stepH;
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx + stepW, sy);
          }
          const topInnerX = outerX + (maxS + 0.4) * stepW;
          ctx.lineTo(topInnerX, height);
        } else {
          ctx.moveTo(width, height);
          ctx.lineTo(width, baseGroundY);
          ctx.lineTo(width - (outerX + stepW * 0.4), baseGroundY);
          for (let s = 1; s <= maxS; s++) {
            const sx = width - (outerX + (s - 0.6) * stepW);
            const sy = baseGroundY - s * stepH;
            ctx.lineTo(sx, sy);
            ctx.lineTo(sx - stepW, sy);
          }
          const topInnerX = width - (outerX + (maxS + 0.4) * stepW);
          ctx.lineTo(topInnerX, height);
        }
        ctx.closePath();

        const stoneGrad = ctx.createLinearGradient(0, topLedgeY, 0, height);
        stoneGrad.addColorStop(0, '#334155');
        stoneGrad.addColorStop(0.55, '#1e293b');
        stoneGrad.addColorStop(1, '#09101d');
        ctx.fillStyle = stoneGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = side === 'left' ? '#fb7185' : '#fbbf24';
        ctx.stroke();
        ctx.restore();

        for (let s = 0; s <= maxS; s++) {
          const pos = getStairPosition(side, s, width, height, maxS);
          ctx.save();
          const isTop = s === maxS;
          ctx.fillStyle = isTop ? '#ef4444' : side === 'left' ? '#fb7185' : '#fbbf24';
          ctx.beginPath();
          ctx.roundRect(pos.x - 20, pos.y - 2, 40, 6, 3);
          ctx.fill();

          ctx.font = '800 10px sans-serif';
          ctx.fillStyle = isTop ? '#fca5a5' : 'rgba(255,255,255,0.55)';
          ctx.textAlign = 'center';
          ctx.fillText(s === 0 ? 'SAFE' : isTop ? '⚠️ EDGE' : `STEP ${s}`, pos.x, pos.y + 15);
          ctx.restore();
        }
      });

      // Giant Shark in Center Pit
      drawGiantShark(ctx, width * 0.5, height * 0.78 + eng.shark.lungeY, width, now);

      // Players
      drawPlayerCharacter(ctx, 1, 'left', width, height, now);
      drawPlayerCharacter(ctx, 2, 'right', width, height, now);

      // Foreground Waves
      const waveBaseY = height * 0.85;
      for (let layer = 0; layer < 2; layer++) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 20) {
          const waveY =
            waveBaseY +
            layer * 12 +
            Math.sin(x * 0.02 + now * 0.004 + layer * 2) * 7 +
            Math.cos(x * 0.035 - now * 0.003) * 4;
          ctx.lineTo(x, waveY);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = layer === 0 ? 'rgba(2, 132, 199, 0.55)' : 'rgba(14, 165, 233, 0.82)';
        ctx.fill();
        ctx.restore();
      }

      // Particles & Floating Text
      for (let i = eng.particles.length - 1; i >= 0; i--) {
        const pt = eng.particles[i];
        pt.normX += pt.vx / width;
        pt.normY += pt.vy / height;
        pt.vy += 0.28;
        pt.alpha -= 0.02;
        if (pt.alpha <= 0) {
          eng.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.normX * width, pt.normY * height, pt.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = eng.floatingTexts.length - 1; i >= 0; i--) {
        const ft = eng.floatingTexts[i];
        ft.normY += ft.vy * 16;
        ft.alpha -= 0.014;
        if (ft.alpha <= 0) {
          eng.floatingTexts.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.font = '800 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.normX * width, ft.normY * height);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.normX * width, ft.normY * height);
        ctx.restore();
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [screen]);

  // Question font size auto-adjust helper
  const getQuestionFontClass = (text: string) => {
    const len = (text || '').length;
    if (fontScale === 'small') {
      if (len > 110) return 'text-sm sm:text-base';
      if (len > 65) return 'text-base sm:text-lg';
      return 'text-lg sm:text-xl';
    }
    if (fontScale === 'large') {
      if (len > 110) return 'text-xl sm:text-2xl';
      if (len > 65) return 'text-2xl sm:text-3xl';
      return 'text-2xl sm:text-4xl';
    }
    // medium
    if (len > 110) return 'text-base sm:text-lg';
    if (len > 65) return 'text-lg sm:text-xl lg:text-2xl';
    return 'text-xl sm:text-2xl lg:text-3xl';
  };

  const getOptionFontClass = (text: string) => {
    const len = (text || '').length;
    if (fontScale === 'small') return len > 45 ? 'text-xs' : 'text-xs sm:text-sm';
    if (fontScale === 'large') return len > 45 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl';
    return len > 45 ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  };

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 font-sans select-none">
      {/* SCREEN 1: GAME SETUP EDITOR (Exact Bubble Pop Setup Design) */}
      {screen === 'editor' && (
        <SharkQuizEditor
          quiz={activeQuiz}
          folders={folders}
          onSave={saveQuiz}
          onPlayNow={(updatedQuiz) => {
            setActiveQuiz(updatedQuiz);
            setScreen('setup');
          }}
          onCancel={() => {
            if (hasLoadedQuestions) {
              setScreen('setup');
            } else {
              onViewChange('games');
            }
          }}
        />
      )}

      {/* SCREEN 2: SHARK ATTACK LOBBY / AVATAR & RULES SETUP */}
      {screen === 'setup' && (
        <div className="absolute inset-0 z-30 bg-gradient-to-b from-[#06101e] via-[#0b213a] to-[#071324] overflow-y-auto custom-scrollbar p-4 sm:p-6 flex flex-col items-center justify-center">
          <div className="bg-slate-900/95 border-2 border-cyan-500/40 rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl my-auto">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-cyan-500/25">
                  🦈
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    SHARK ATTACK SETUP
                  </h2>
                  <p className="text-xs sm:text-sm text-cyan-300/80 font-medium">
                    Choose temporary climber avatars, opponent mode, and staircase rules!
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreen('editor')}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <Edit3 size={15} />
                  <span>Game Setup (Questions)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudyIndex(0);
                    setStudySelectedOption(null);
                    setScreen('study');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <BookOpen size={15} />
                  <span>Study Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowModeModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Gamepad2 size={15} />
                  <span>Other Games</span>
                </button>
                <button
                  type="button"
                  onClick={() => onViewChange('games')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ArrowLeft size={15} />
                  <span>Back</span>
                </button>
              </div>
            </div>

            {/* Players Temporary Avatar Picker Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {/* Player 1 */}
              <div className="bg-slate-800/70 border border-rose-500/40 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <label className="font-black text-rose-400 text-sm uppercase tracking-wider">
                    Left Stairs: Player 1
                  </label>
                  <input
                    type="text"
                    value={p1Name}
                    maxLength={14}
                    onChange={(e) => setP1Name(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white w-40 focus:outline-none focus:border-rose-400"
                    placeholder="Player 1"
                  />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CHARACTERS.map((char, idx) => {
                    const selected = p1CharIndex === idx;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setP1CharIndex(idx)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          selected
                            ? 'bg-rose-500/25 border-rose-400 shadow-lg scale-[1.03]'
                            : 'bg-slate-900/70 border-slate-700 hover:border-slate-500 opacity-80'
                        }`}
                      >
                        <div
                          className="w-11 h-11"
                          dangerouslySetInnerHTML={{ __html: char.svg }}
                        />
                        <span className="text-[11px] font-bold text-white leading-tight truncate w-full">
                          {char.name}
                        </span>
                        <span className="text-[9px] text-rose-300/80 font-semibold">
                          {char.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player 2 */}
              <div className="bg-slate-800/70 border border-amber-500/40 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2">
                    <label className="font-black text-amber-400 text-sm uppercase tracking-wider">
                      Right Stairs:
                    </label>
                    <select
                      value={p2Mode}
                      onChange={(e) => setP2Mode(e.target.value as any)}
                      className="bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-300 focus:outline-none cursor-pointer"
                    >
                      <option value="human">2P Human</option>
                      <option value="ai_normal">AI Bot (Normal)</option>
                      <option value="ai_hard">AI Bot (Smart)</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={p2Name}
                    maxLength={14}
                    onChange={(e) => setP2Name(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-white w-36 focus:outline-none focus:border-amber-400"
                    placeholder="Player 2"
                  />
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {CHARACTERS.map((char, idx) => {
                    const selected = p2CharIndex === idx;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setP2CharIndex(idx)}
                        className={`p-2 rounded-xl border text-center transition-all flex flex-col items-center gap-1 cursor-pointer ${
                          selected
                            ? 'bg-amber-500/25 border-amber-400 shadow-lg scale-[1.03]'
                            : 'bg-slate-900/70 border-slate-700 hover:border-slate-500 opacity-80'
                        }`}
                      >
                        <div
                          className="w-11 h-11"
                          dangerouslySetInnerHTML={{ __html: char.svg }}
                        />
                        <span className="text-[11px] font-bold text-white leading-tight truncate w-full">
                          {char.name}
                        </span>
                        <span className="text-[9px] text-amber-300/80 font-semibold">
                          {char.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rules & Deck Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-800/70 border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <label className="font-black text-cyan-300 text-sm uppercase tracking-wider block mb-2">
                    📚 Question Deck Source
                  </label>
                  <select
                    value={selectedTopicFilter}
                    onChange={(e) => setSelectedTopicFilter(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white mb-3 focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="custom">
                      🎯 Custom Setup Questions ({activeQuiz.questions.filter((q) => q.text.trim()).length} Qs)
                    </option>
                    <option value="all">🌟 Built-in All-Rounder Mix (All Categories)</option>
                    <option value="ocean">🦈 Built-in: Ocean, Sharks & Marine Life</option>
                    <option value="science">🧪 Built-in: Science, Space & Nature</option>
                    <option value="gaming">🎮 Built-in: Gaming & Pop Culture</option>
                    <option value="math">🧮 Built-in: Quick Math & Logic</option>
                    <option value="geography">🌍 Built-in: World Geography</option>
                  </select>
                </div>

                <div className="bg-slate-900/90 border border-cyan-500/20 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">
                      Active Topic: {activeQuiz.topic || activeQuiz.title || 'Shark Attack Trivia'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activeQuiz.questions.filter((q) => q.text.trim()).length} custom questions configured
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScreen('editor')}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-400/40 text-blue-300 hover:bg-blue-500 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Edit Questions
                  </button>
                </div>
              </div>

              <div className="bg-slate-800/70 border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <label className="font-black text-cyan-300 text-sm uppercase tracking-wider block mb-2">
                    ⚙️ Staircase Rules
                  </label>
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="sharkRuleMode"
                        checked={ruleMode === 'classic'}
                        onChange={() => setRuleMode('classic')}
                        className="mt-0.5 accent-cyan-400"
                      />
                      <div>
                        <span className="font-bold text-white block">Classic Rule (Default)</span>
                        <span className="text-slate-400 text-[11px]">
                          Correct answer = Stay Safe! Wrong answer or Timeout = Climb 1 step toward the shark!
                        </span>
                      </div>
                    </label>
                    <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-900/80 border border-slate-700 cursor-pointer">
                      <input
                        type="radio"
                        name="sharkRuleMode"
                        checked={ruleMode === 'speed'}
                        onChange={() => setRuleMode('speed')}
                        className="mt-0.5 accent-cyan-400"
                      />
                      <div>
                        <span className="font-bold text-amber-300 block">Speed Pressure Twist</span>
                        <span className="text-slate-400 text-[11px]">
                          Wrong = Climb 1 step. PLUS if both players answer correctly, the slower player still climbs 1 step!
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-700/70 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">Steps to Fall in Shark Jaws:</span>
                  <select
                    value={maxSteps}
                    onChange={(e) => setMaxSteps(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 font-bold text-cyan-300 cursor-pointer"
                  >
                    <option value={3}>3 Steps (Quick Blitz)</option>
                    <option value={5}>5 Steps (Standard)</option>
                    <option value={7}>7 Steps (Marathon)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Start Button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={startMatch}
                className="w-full sm:w-auto px-9 py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 hover:from-emerald-300 hover:to-blue-400 text-slate-950 font-black text-lg tracking-wide shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 transition-all"
              >
                <Play size={22} fill="currentColor" />
                <span>START SHARK ATTACK!</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 3: STUDY MODE (Pure White Background, Black Text, Green Correct, Red Incorrect, Font Size Pop-Up) */}
      {screen === 'study' && (
        <div className="absolute inset-0 z-40 bg-white text-black flex flex-col overflow-hidden select-none">
          {/* Pure White Header */}
          <div className="h-16 px-4 sm:px-8 border-b border-slate-200 flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setScreen('setup')}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-black font-bold text-sm flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Back to Setup</span>
              </button>
              <span className="font-black text-lg tracking-tight text-black">
                🦈 Shark Attack · Study Mode
              </span>
            </div>

            <div className="flex items-center gap-3 relative">
              <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-full border border-slate-300 text-black">
                Question {studyIndex + 1} / {Math.max(1, activeQuiz.questions.filter((q) => q.text.trim()).length || BUILTIN_QUESTIONS.length)}
              </span>

              {/* Top-Right Font Size Pop-Up Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFontMenu((prev) => !prev)}
                  className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-black flex items-center gap-1.5 font-bold text-xs cursor-pointer"
                  title="Change Font Size"
                >
                  <Type size={16} />
                  <span className="hidden sm:inline capitalize">{fontScale}</span>
                </button>
                {showFontMenu && (
                  <div className="absolute right-0 mt-2 w-36 bg-white border border-slate-300 rounded-2xl shadow-xl p-1.5 z-50">
                    {(['small', 'medium', 'large'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setFontScale(sz);
                          setShowFontMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold capitalize cursor-pointer ${
                          fontScale === sz ? 'bg-slate-900 text-white' : 'text-black hover:bg-slate-100'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Study Content Body */}
          {(() => {
            const validList = activeQuiz.questions.filter((q) => q.text.trim());
            const studyQuestions = validList.length > 0 ? validList : BUILTIN_QUESTIONS;
            const currentQ = studyQuestions[studyIndex] || studyQuestions[0];

            return (
              <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center max-w-4xl mx-auto w-full gap-8 bg-white">
                <div className="w-full text-center p-6 sm:p-8 rounded-3xl border-2 border-slate-200 bg-white shadow-sm">
                  <h3 className={`font-black text-black leading-snug ${getQuestionFontClass(currentQ.text)}`}>
                    {currentQ.text}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                  {currentQ.options.map((opt, idx) => {
                    const isPicked = studySelectedOption === idx;
                    const isCorrect = idx === currentQ.answerIndex;
                    let cardStyle = 'bg-white border-slate-300 text-black hover:border-slate-500';
                    if (studySelectedOption !== null) {
                      if (isCorrect) {
                        cardStyle = 'bg-emerald-600 border-emerald-700 text-white';
                      } else if (isPicked && !isCorrect) {
                        cardStyle = 'bg-red-600 border-red-700 text-white';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setStudySelectedOption(idx)}
                        className={`p-5 rounded-2xl border-2 font-bold text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${cardStyle}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-xl border border-current flex items-center justify-center font-black text-sm shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {opt.startsWith('http') || opt.startsWith('data:image') ? (
                            <img src={opt} alt="Option" className="h-20 w-20 object-cover rounded-xl" />
                          ) : (
                            <span className={`font-bold break-words ${getOptionFontClass(opt)}`}>{opt}</span>
                          )}
                        </div>
                        {studySelectedOption !== null && isCorrect && <CheckCircle2 size={22} className="shrink-0" />}
                        {studySelectedOption !== null && isPicked && !isCorrect && <XCircle size={22} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between w-full pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={studyIndex === 0}
                    onClick={() => {
                      setStudyIndex((i) => Math.max(0, i - 1));
                      setStudySelectedOption(null);
                    }}
                    className="px-6 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 text-black font-bold text-sm cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (studyIndex < studyQuestions.length - 1) {
                        setStudyIndex((i) => i + 1);
                        setStudySelectedOption(null);
                      } else {
                        setScreen('setup');
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-black text-white font-bold text-sm cursor-pointer hover:bg-slate-800"
                  >
                    {studyIndex < studyQuestions.length - 1 ? 'Next Question' : 'Finish Study'}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* SCREEN 4: ACTIVE SHARK ATTACK ARENA */}
      {screen === 'game' && (
        <div
          className={`min-h-[calc(100vh-4rem)] h-full flex flex-col justify-between bg-gradient-to-b from-[#06101e] via-[#0b213a] to-[#071324] text-slate-100 overflow-y-auto ${
            shakeScreen ? 'animate-bounce' : ''
          }`}
        >
          {/* Top Game Header */}
          <header className="w-full px-3 py-2 bg-slate-900/85 backdrop-blur-md border-b border-cyan-500/20 flex items-center justify-between z-30 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-300/40 text-lg">
                🦈
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-wide bg-gradient-to-r from-cyan-300 via-white to-amber-300 bg-clip-text text-transparent leading-none">
                  SHARK ATTACK
                </h1>
                <p className="text-[10px] text-cyan-300/70 font-bold tracking-wider uppercase">
                  Wrong Answer = Climb to the Jaws!
                </p>
              </div>
            </div>

            {/* Center Info */}
            <div className="hidden md:flex items-center gap-3 bg-slate-800/90 px-4 py-1.5 rounded-full border border-slate-700">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={13} />
                <span>{activeQuiz.topic || activeQuiz.title || 'Shark Trivia'}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-extrabold text-cyan-300">ROUND {round}</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs text-emerald-400 font-semibold">
                {ruleMode === 'speed' ? '⚡ Speed Push Rule' : '🛡️ Classic Rule'}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 relative">
              {/* Font size popup */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFontMenu((prev) => !prev)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-600 font-bold text-xs flex items-center gap-1 cursor-pointer"
                  title="Question Font Size"
                >
                  <Type size={14} />
                  <span className="hidden sm:inline capitalize">{fontScale}</span>
                </button>
                {showFontMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1 z-50">
                    {(['small', 'medium', 'large'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setFontScale(sz);
                          setShowFontMenu(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                          fontScale === sz ? 'bg-cyan-500 text-slate-950' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setScreen('setup')}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Users size={14} />
                <span className="hidden sm:inline">Setup / Avatars</span>
              </button>
              <button
                type="button"
                onClick={() => setScreen('editor')}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={14} />
                <span className="hidden sm:inline">Edit Quiz</span>
              </button>
              <button
                type="button"
                onClick={startMatch}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                title="Restart Match"
              >
                <RotateCcw size={14} />
                <span className="hidden sm:inline">Restart</span>
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center justify-center border border-slate-600 cursor-pointer"
                title="Toggle Sound"
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} className="text-rose-400" />}
              </button>
              <FullscreenButton className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 flex items-center justify-center border border-slate-600" />
            </div>
          </header>

          {/* Main Arena Container */}
          <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-2 sm:px-4 py-2 gap-2 relative overflow-hidden">
            {/* UPPER VISUAL ARENA: STAIRS + TEMPORARY AVATARS + MEGALODON SHARK */}
            <section className="relative w-full h-[270px] sm:h-[330px] lg:h-[370px] bg-gradient-to-b from-[#0c192c] via-[#112c4a] to-[#08304b] rounded-2xl border-2 border-cyan-500/30 shadow-2xl overflow-hidden shrink-0">
              {/* Player 1 HUD Card */}
              <div className="absolute top-2.5 left-2.5 z-20 bg-slate-900/85 backdrop-blur-md border border-rose-500/40 rounded-2xl p-2 sm:px-3.5 sm:py-2 flex items-center gap-2.5 shadow-lg">
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center overflow-hidden shrink-0"
                  dangerouslySetInnerHTML={{
                    __html: (CHARACTERS[p1CharIndex] || CHARACTERS[0]).svg,
                  }}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <h2 className="font-bold text-xs sm:text-sm text-rose-300">{p1Name}</h2>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {Array.from({ length: maxSteps }).map((_, idx) => {
                      const s = idx + 1;
                      const filled = s <= p1Hud.step;
                      const isDanger = s === maxSteps;
                      return (
                        <span
                          key={s}
                          className={`w-3 h-2 rounded-xs border transition-all ${
                            filled
                              ? isDanger
                                ? 'bg-red-500 border-red-300 animate-pulse'
                                : 'bg-rose-400 border-rose-200'
                              : 'bg-slate-800 border-slate-600'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p1Hud.step === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : p1Hud.step >= maxSteps
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-amber-500/20 text-amber-200'
                      }`}
                    >
                      {p1Hud.step === 0
                        ? 'Ground (Safe)'
                        : p1Hud.step >= maxSteps
                        ? '⚠️ TOP LEDGE!'
                        : `Stair ${p1Hud.step}/${maxSteps}`}
                    </span>
                    {p1Hud.hasRope && p1Hud.step > 0 && phase === 'question' && (
                      <button
                        type="button"
                        onClick={() => useRopePowerup(1)}
                        className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-1.5 py-0.5 rounded animate-bounce flex items-center gap-1 cursor-pointer"
                      >
                        <Anchor size={10} /> -1 STEP
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Banner */}
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
                <div className="px-4 py-1 rounded-full bg-slate-950/80 border border-cyan-400/30 text-cyan-200 text-xs sm:text-sm font-bold tracking-wide shadow-lg flex items-center gap-2">
                  <Skull size={14} className="text-amber-400" />
                  <span>{arenaBannerText}</span>
                </div>
              </div>

              {/* Player 2 HUD Card */}
              <div className="absolute top-2.5 right-2.5 z-20 bg-slate-900/85 backdrop-blur-md border border-amber-500/40 rounded-2xl p-2 sm:px-3.5 sm:py-2 flex items-center gap-2.5 shadow-lg text-right">
                <div>
                  <div className="flex items-center justify-end gap-1.5">
                    <h2 className="font-bold text-xs sm:text-sm text-amber-300">{p2Name}</h2>
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {Array.from({ length: maxSteps }).map((_, idx) => {
                      const s = idx + 1;
                      const filled = s <= p2Hud.step;
                      const isDanger = s === maxSteps;
                      return (
                        <span
                          key={s}
                          className={`w-3 h-2 rounded-xs border transition-all ${
                            filled
                              ? isDanger
                                ? 'bg-red-500 border-red-300 animate-pulse'
                                : 'bg-amber-400 border-amber-200'
                              : 'bg-slate-800 border-slate-600'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {p2Hud.hasRope && p2Hud.step > 0 && phase === 'question' && (
                      <button
                        type="button"
                        onClick={() => useRopePowerup(2)}
                        className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-1.5 py-0.5 rounded animate-bounce flex items-center gap-1 cursor-pointer"
                      >
                        <Anchor size={10} /> -1 STEP
                      </button>
                    )}
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        p2Hud.step === 0
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : p2Hud.step >= maxSteps
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-amber-500/20 text-amber-200'
                      }`}
                    >
                      {p2Hud.step === 0
                        ? 'Ground (Safe)'
                        : p2Hud.step >= maxSteps
                        ? '⚠️ TOP LEDGE!'
                        : `Stair ${p2Hud.step}/${maxSteps}`}
                    </span>
                  </div>
                </div>
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center overflow-hidden shrink-0"
                  dangerouslySetInnerHTML={{
                    __html: (CHARACTERS[p2CharIndex] || CHARACTERS[1]).svg,
                  }}
                />
              </div>

              <canvas ref={canvasRef} className="w-full h-full block" />
            </section>

            {/* LOWER 3-COLUMN DECK: P1 CONTROLS | QUESTION & CHOICES | P2 CONTROLS */}
            <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch flex-1 min-h-[225px]">
              {/* Left: Player 1 Controls (WASD) */}
              <div className="lg:col-span-3 order-2 lg:order-1 bg-slate-900/90 border-2 border-rose-500/40 rounded-2xl p-3 flex flex-col justify-between shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs">
                      P1 (LEFT)
                    </span>
                    <span className="text-[11px] text-rose-200/90 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Keys: W A S D
                    </span>
                  </div>
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                      phase === 'reveal'
                        ? p1Hud.selectedOption === currentQuestion?.answerIndex
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-red-600 text-white'
                        : p1Hud.selectedOption !== null
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {phase === 'reveal'
                      ? p1Hud.selectedOption === null
                        ? '⏰ TIME OUT!'
                        : p1Hud.selectedOption === currentQuestion?.answerIndex
                        ? `✅ Picked ${['A', 'B', 'C', 'D'][p1Hud.selectedOption]}`
                        : `❌ Picked ${['A', 'B', 'C', 'D'][p1Hud.selectedOption]}`
                      : p1Hud.selectedOption !== null
                      ? '🔒 LOCKED IN!'
                      : 'Choosing...'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 flex-1 items-stretch">
                  <div className="hidden sm:flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    WASD
                  </div>
                  {[
                    { idx: 0, label: 'A', keyHint: '▲ W', colClass: '' },
                    { idx: -1, label: '', keyHint: '', colClass: 'hidden sm:block' },
                    { idx: 1, label: 'B', keyHint: '◀ A', colClass: '' },
                    { idx: 2, label: 'C', keyHint: '▼ S', colClass: '' },
                    { idx: 3, label: 'D', keyHint: 'D ▶', colClass: '' },
                  ].map((item, i) => {
                    if (item.idx === -1) return <div key={i} className="hidden sm:block" />;
                    const optIdx = item.idx;
                    const isLocked = p1Hud.selectedOption !== null || phase !== 'question';
                    const isPicked = p1Hud.selectedOption === optIdx;
                    const isRight = currentQuestion?.answerIndex === optIdx;
                    let ringClass = '';
                    if (phase === 'reveal' && isPicked) {
                      ringClass = isRight ? 'ring-4 ring-emerald-300' : 'ring-4 ring-red-400';
                    } else if (p2Mode !== 'human' && isPicked) {
                      ringClass = 'ring-4 ring-white';
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handlePlayerInput(1, optIdx)}
                        className={`min-h-[54px] rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 disabled:opacity-60 text-white font-black flex flex-col items-center justify-center border-2 border-rose-200/40 py-1 cursor-pointer active:translate-y-0.5 transition-all ${ringClass}`}
                      >
                        <span className="text-lg leading-none">{item.label}</span>
                        <span className="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/45 text-[10px] font-black text-rose-100">
                          {item.keyHint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Streak: <strong className="text-rose-300">{p1Hud.streak}</strong>/3 for Lifeline
                  </span>
                  {p1Hud.lockTime !== null && (
                    <span className="text-[11px] text-cyan-400 font-semibold">
                      ⏱️ {p1Hud.lockTime.toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>

              {/* Center: Question & 4 Answer Choices */}
              <div className="lg:col-span-6 order-1 lg:order-2 bg-slate-900/95 border-2 border-cyan-400/50 rounded-2xl p-3 sm:p-4 flex flex-col justify-between shadow-2xl">
                {/* Timer Bar */}
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2 border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-100"
                    style={{ width: `${Math.max(0, Math.min(100, (timerLeft / 15) * 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-cyan-300/90 mb-1">
                  <span className="uppercase tracking-wider bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                    {currentQuestion?.cat || activeQuiz.topic || 'Shark Trivia'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-amber-300">
                    {timerLeft.toFixed(1)}s
                  </span>
                </div>

                <div className="my-auto py-1.5 text-center">
                  <h3
                    className={`font-black text-white leading-snug ${getQuestionFontClass(
                      currentQuestion?.text || ''
                    )}`}
                  >
                    {currentQuestion?.text || 'Loading question...'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const optText = currentQuestion?.options[idx] || `Option ${idx + 1}`;
                    const keyBadges = ['W / ↑', 'A / ←', 'S / ↓', 'D / →'];
                    const isReveal = phase === 'reveal' || phase === 'animating' || phase === 'gameover';
                    const isCorrect = currentQuestion?.answerIndex === idx;
                    const isImage = optText.startsWith('http') || optText.startsWith('data:image');

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                          isReveal
                            ? isCorrect
                              ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-[1.02] shadow-lg'
                              : 'bg-slate-900/60 border-slate-800 opacity-50'
                            : 'bg-slate-800/90 border-slate-600/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-black flex items-center justify-center text-sm shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          {isImage ? (
                            <img
                              src={optText}
                              alt={`Option ${idx + 1}`}
                              className="h-11 w-14 object-cover rounded-lg border border-white/20"
                            />
                          ) : (
                            <span
                              className={`font-semibold text-slate-100 leading-tight break-words ${getOptionFontClass(
                                optText
                              )}`}
                            >
                              {optText}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-700 shrink-0">
                          {keyBadges[idx]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Player 2 Controls (Arrows or AI) */}
              <div className="lg:col-span-3 order-3 bg-slate-900/90 border-2 border-amber-500/40 rounded-2xl p-3 flex flex-col justify-between shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                  <span
                    className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                      phase === 'reveal'
                        ? p2Hud.selectedOption === currentQuestion?.answerIndex
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-red-600 text-white'
                        : p2Hud.selectedOption !== null
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {phase === 'reveal'
                      ? p2Hud.selectedOption === null
                        ? '⏰ TIME OUT!'
                        : p2Hud.selectedOption === currentQuestion?.answerIndex
                        ? `✅ Picked ${['A', 'B', 'C', 'D'][p2Hud.selectedOption]}`
                        : `❌ Picked ${['A', 'B', 'C', 'D'][p2Hud.selectedOption]}`
                      : p2Hud.selectedOption !== null
                      ? '🔒 LOCKED IN!'
                      : 'Choosing...'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-amber-200/90 font-bold bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {p2Mode === 'human' ? 'Keys: ↑ ← ↓ →' : '🤖 AI Controlled'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs">
                      P2 (RIGHT)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 flex-1 items-stretch">
                  <div className="hidden sm:block" />
                  {[
                    { idx: 0, label: 'A', keyHint: '▲ UP' },
                    { idx: -1, label: 'ARROWS', keyHint: '' },
                    { idx: 1, label: 'B', keyHint: '◀ LEFT' },
                    { idx: 2, label: 'C', keyHint: '▼ DOWN' },
                    { idx: 3, label: 'D', keyHint: 'RIGHT ▶' },
                  ].map((item, i) => {
                    if (item.idx === -1) {
                      return (
                        <div
                          key={i}
                          className="hidden sm:flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase tracking-wider"
                        >
                          ARROWS
                        </div>
                      );
                    }
                    const optIdx = item.idx;
                    const isLocked =
                      p2Mode !== 'human' || p2Hud.selectedOption !== null || phase !== 'question';
                    const isPicked = p2Hud.selectedOption === optIdx;
                    const isRight = currentQuestion?.answerIndex === optIdx;
                    let ringClass = '';
                    if (phase === 'reveal' && isPicked) {
                      ringClass = isRight ? 'ring-4 ring-emerald-300' : 'ring-4 ring-red-400';
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={isLocked}
                        onClick={() => handlePlayerInput(2, optIdx)}
                        className={`min-h-[54px] rounded-xl bg-gradient-to-b from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 text-slate-950 font-black flex flex-col items-center justify-center border-2 border-amber-100/60 py-1 cursor-pointer active:translate-y-0.5 transition-all ${ringClass}`}
                      >
                        <span className="text-lg leading-none">{item.label}</span>
                        <span className="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/25 text-[10px] font-black text-slate-950">
                          {item.keyHint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  {p2Hud.lockTime !== null ? (
                    <span className="text-[11px] text-cyan-400 font-semibold">
                      ⏱️ {p2Hud.lockTime.toFixed(1)}s
                    </span>
                  ) : (
                    <span />
                  )}
                  <span>
                    Streak: <strong className="text-amber-300">{p2Hud.streak}</strong>/3 for Lifeline
                  </span>
                </div>
              </div>
            </section>
          </main>

          {/* Game Over Modal */}
          {gameOverInfo && (
            <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-slate-900 border-2 border-amber-400/60 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl">
                <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-slate-950 text-4xl shadow-lg">
                  <Trophy size={40} />
                </div>
                <h2 className="text-3xl font-black text-white mb-1">
                  {gameOverInfo.p1Fell && gameOverInfo.p2Fell
                    ? 'DOUBLE SHARK SNACK!'
                    : gameOverInfo.p1Fell
                    ? `${p2Name.toUpperCase()} WINS!`
                    : `${p1Name.toUpperCase()} WINS!`}
                </h2>
                <p className="text-sm text-rose-300 font-semibold mb-4">
                  {gameOverInfo.p1Fell && gameOverInfo.p2Fell
                    ? `Both ${p1Name} and ${p2Name} tumbled off the top stairs into the shark's jaws!`
                    : gameOverInfo.p1Fell
                    ? `${p1Name} climbed too high, fell into the abyss, and got eaten by the shark!`
                    : `${p2Name} climbed too high, fell into the abyss, and got eaten by the shark!`}
                </p>

                <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 mb-5 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-slate-900">
                    <span className="text-slate-400 block">Total Rounds</span>
                    <strong className="text-lg text-cyan-300 font-black">{gameOverInfo.rounds}</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-900">
                    <span className="text-slate-400 block">Match Accuracy</span>
                    <strong className="text-lg text-emerald-400 font-black">
                      {gameOverInfo.accuracy}%
                    </strong>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setGameOverInfo(null);
                      setScreen('setup');
                    }}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-600 cursor-pointer"
                  >
                    Change Setup
                  </button>
                  <button
                    type="button"
                    onClick={startMatch}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-base flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={16} />
                    <span>Play Again</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interchangeable Game Mode Selector Modal */}
      <GameModeModal
        isOpen={showModeModal}
        onClose={() => setShowModeModal(false)}
        gameData={{
          id: activeQuiz.id,
          name: activeQuiz.topic || activeQuiz.title || 'Shark Attack Quiz',
          topic: activeQuiz.topic || activeQuiz.title || 'Shark Attack Quiz',
          classLevel: activeQuiz.classLevel || '',
          gameType: 'shark-attack',
          originalGameType: 'shark-attack',
          customQuestions: activeQuiz.questions,
        }}
        onSelectMode={(mode, adaptedData) => {
          setShowModeModal(false);
          if (mode === 'shark-attack') {
            setScreen('setup');
          } else {
            onViewChange(mode as ViewState, adaptedData);
          }
        }}
      />
    </div>
  );
}

// --- EXACT BUBBLE POP STYLE GAME SETUP EDITOR ---
function SharkQuizEditor({
  quiz,
  folders,
  onSave,
  onPlayNow,
  onCancel,
}: {
  quiz: Quiz;
  folders: { id: string; name: string }[];
  onSave: (q: Quiz) => void;
  onPlayNow: (q: Quiz) => void;
  onCancel: () => void;
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || '');
  const [topic, setTopic] = useState(quiz.topic || '');
  const [classLevel, setClassLevel] = useState(quiz.classLevel || '');
  const [questions, setQuestions] = useState<Question[]>(
    quiz.questions.length > 0
      ? quiz.questions
      : [{ id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [activeGiphyInput, setActiveGiphyInput] = useState<{
    qId: number | string;
    optIndex: number;
  } | null>(null);

  const handleApplyBulkPaste = (mode: 'replace' | 'append') => {
    const parsed = parsePastedQuiz(bulkText);
    if (parsed.length === 0) {
      setErrorMsg('Could not detect valid questions in your pasted text.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }

    const formatted: Question[] = parsed.map((item, idx) => ({
      id: Date.now() + idx + Math.random(),
      text: item.text || '',
      options: item.options && item.options.length >= 2 ? item.options : ['', '', '', ''],
      answerIndex: item.answerIndex || 0,
    }));

    if (mode === 'replace') {
      setQuestions(formatted);
    } else {
      const existingNonEmpty = questions.filter(
        (q) => q.text.trim() !== '' || q.options.some((o) => o.trim() !== '')
      );
      setQuestions([...existingNonEmpty, ...formatted]);
    }

    setShowBulkPasteModal(false);
    setBulkText('');
    setToastMsg(`✨ Successfully imported ${formatted.length} questions!`);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now() + Math.random(), text: '', options: ['', '', '', ''], answerIndex: 0 },
    ]);
  };

  const updateQuestion = (id: number | string, field: string, value: any) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  const updateOption = (qId: number | string, optIndex: number, value: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId) {
          const newOpts = [...q.options];
          newOpts[optIndex] = value;
          return { ...q, options: newOpts };
        }
        return q;
      })
    );
  };

  const addOption = (qId: number | string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId && q.options.length < 6) {
          return { ...q, options: [...q.options, ''] };
        }
        return q;
      })
    );
  };

  const removeOption = (qId: number | string) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === qId && q.options.length > 2) {
          const newOptions = [...q.options];
          newOptions.pop();
          const newAnswerIndex =
            q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
          return { ...q, options: newOptions, answerIndex: newAnswerIndex };
        }
        return q;
      })
    );
  };

  const removeQuestion = (id: number | string) => {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== id) : prev));
  };

  const duplicateQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const src = prev[index];
      next.splice(index + 1, 0, {
        ...src,
        id: Date.now() + Math.random(),
        options: [...src.options],
      });
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index === questions.length - 1) {
        addQuestion();
        setTimeout(() => {
          document.getElementById(`shark-question-input-${index + 1}`)?.focus();
        }, 50);
      } else {
        document.getElementById(`shark-question-input-${index + 1}`)?.focus();
      }
    }
  };

  const handleSave = () => {
    const validQuestions = questions.filter((q) => q.text.trim());
    if (validQuestions.length === 0) {
      setErrorMsg('Please add at least one complete question.');
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const validQuestions = questions.filter((q) => q.text.trim());
    onSave({
      ...quiz,
      title: topic.trim() || 'Shark Attack Game',
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic,
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
        <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
          <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex justify-between items-center flex-wrap gap-3">
              <h2 className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                GAME SETUP
              </h2>
              <div className="flex gap-3 items-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const validQuestions = questions.filter((q) => q.text.trim());
                    onPlayNow({
                      ...quiz,
                      title: topic.trim() || 'Shark Attack Game',
                      folderId,
                      topic,
                      classLevel,
                      questions: validQuestions.length > 0 ? validQuestions : BUILTIN_QUESTIONS,
                    });
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/30 cursor-pointer"
                >
                  <Play size={18} /> Play Now
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer"
                >
                  <Save size={18} /> Save Quiz
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Topic
                </label>
                <input
                  type="text"
                  placeholder="e.g. Present Simple"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Class Level
                </label>
                <input
                  type="text"
                  placeholder="e.g. KET, Starters"
                  value={classLevel}
                  onChange={(e) => setClassLevel(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Folder
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-blue-500 appearance-none cursor-pointer transition-colors"
                >
                  <option value="">No Folder (Root)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
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

          {toastMsg && (
            <div className="bg-cyan-500/20 text-cyan-500 dark:text-cyan-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-cyan-500/30 flex items-center justify-center gap-2 shadow-sm">
              <Sparkles size={18} /> {toastMsg}
            </div>
          )}

          <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
            {/* Bulk Paste Action Bar */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="font-bold text-sm text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                Questions ({questions.length})
              </span>
              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setShowBulkPasteModal(true)}
                  className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-blue-500/25 flex items-center gap-2.5 cursor-pointer"
                >
                  <ClipboardList size={22} className="stroke-[2.5]" />
                  <span>Bulk Paste</span>
                </button>
              </div>
            </div>

            {questions.map((q, index) => (
              <div
                key={q.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group"
              >
                <button
                  type="button"
                  onClick={() => duplicateQuestion(index)}
                  title="Duplicate Question"
                  className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Copy size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  title="Delete Question"
                  className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
                >
                  <Trash2 size={14} />
                </button>

                <div className="flex gap-4 mb-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                    {index + 1}
                  </div>
                  <input
                    id={`shark-question-input-${index}`}
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
                        name={`shark-answer-${q.id}`}
                        checked={q.answerIndex === optIndex}
                        onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                        className="w-4 h-4 text-blue-500 focus:ring-blue-500 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600"
                      />
                      {opt.startsWith('data:image') || opt.startsWith('http') ? (
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-1.5 pr-3">
                          <img src={opt} alt="Option" className="w-8 h-8 rounded object-cover" />
                          <span className="text-xs text-slate-400 flex-1 truncate">Image/GIF</span>
                          <button
                            type="button"
                            onClick={() => updateOption(q.id, optIndex, '')}
                            className="text-red-400 hover:text-red-300 cursor-pointer p-1"
                          >
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
                            className={`flex-1 min-w-0 bg-slate-50 dark:bg-slate-900 border ${
                              q.answerIndex === optIndex
                                ? 'border-blue-500/50 bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            } rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-sm font-medium`}
                          />
                          <button
                            type="button"
                            onClick={() => setActiveGiphyInput({ qId: q.id, optIndex })}
                            className="bg-purple-500/20 text-purple-400 p-2 rounded-lg hover:bg-purple-500 hover:text-white transition-colors shrink-0 cursor-pointer flex items-center justify-center"
                            title="Search Media / Giphy"
                          >
                            <ImageIcon size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="ml-12 mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 6}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer"
                  >
                    + Option
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOption(q.id)}
                    disabled={q.options.length <= 2}
                    className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer"
                  >
                    - Option
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
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

      {showPublishModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                Publish Game?
              </h3>
              <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">
                Would you like to publish this Shark Attack game to the Community so other teachers can use it?
              </p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  type="button"
                  onClick={() => confirmSave(true)}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
                >
                  Yes, Publish (Public)
                </button>
                <button
                  type="button"
                  onClick={() => confirmSave(false)}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
                >
                  No, Keep Private
                </button>
                <button
                  type="button"
                  onClick={() => setShowPublishModal(false)}
                  className="w-full py-2 mt-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {showBulkPasteModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste & Auto-Divide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paste multiple questions, numbered lists with options & answer (e.g. Answer: B), or tabular TSV data.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkPasteModal(false);
                    setBulkText('');
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Paste Text Below (Supports multi-line Q&A format or Excel copy)
                </label>
                <textarea
                  rows={7}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={
                    'Example:\n1. What is the capital of France?\na) London\nb) Paris\nc) Berlin\nd) Madrid\nAnswer: B\n\nOr paste tabular data directly from Excel!'
                  }
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-cyan-500 transition-colors custom-scrollbar"
                />
              </div>

              {bulkText.trim() && (
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-cyan-500 mt-0.5">
                    <Info size={16} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found{' '}
                    <span className="font-bold text-slate-800 dark:text-white">
                      {parsePastedQuiz(bulkText).length}
                    </span>{' '}
                    items.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleApplyBulkPaste('replace')}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  Replace All
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyBulkPaste('append')}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30 cursor-pointer"
                >
                  Append to End
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <BulkPasteVideoModal
        isOpen={showVideoGuide}
        onClose={() => setShowVideoGuide(false)}
        onOpenBulkPasteWithSample={(sample) => {
          setBulkText(sample);
          setShowBulkPasteModal(true);
        }}
      />
    </div>
  );
}
