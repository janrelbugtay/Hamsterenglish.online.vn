import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Presentation, 
  Play, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy, 
  Sparkles, 
  Volume2, 
  ArrowLeft, 
  ArrowRight, 
  Maximize2, 
  Minimize2, 
  Clock, 
  CheckCircle2, 
  Layers, 
  Search, 
  X, 
  MousePointer,
  Award,
  GraduationCap,
  Lightbulb,
  BookOpen,
  QrCode,
  Share2,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ViewState } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { 
  CAMBRIDGE_COURSES, 
  ALL_GRADES, 
  CambridgeType, 
  GradeType,
  extractCambridgeCourse,
  extractGradeNumber
} from './PublicDashboard';
import { FALLBACK_COMMUNITY_GAMES } from '../utils/platformCache';
import {
  StartersMonsterArtStudio,
  STARTERS_MONSTER_ART_DECK,
  STARTERS_MONSTER_ART_DECK_ID,
} from '../components/StartersMonsterArtStudio';
import { CreateHomeworkModal } from '../components/CreateHomeworkModal';
import { convertSlideDeckToHomeworkObject } from '../utils/homeworkService';

export type SlideType = 'title' | 'vocab' | 'question' | 'grammar' | 'discussion';

export const GLOBAL_SUCCESS_LEVELS = [
  { id: 'Global Success 6', grade: 6, label: 'Global Success 6' },
  { id: 'Global Success 7', grade: 7, label: 'Global Success 7' },
  { id: 'Global Success 8', grade: 8, label: 'Global Success 8' },
  { id: 'Global Success 9', grade: 9, label: 'Global Success 9' },
  { id: 'Global Success 1-5', grade: null, label: 'Global Success 1–5' },
  { id: 'Global Success 10-12', grade: null, label: 'Global Success 10–12' },
];

export interface SlideItem {
  id: string;
  type: SlideType;
  title?: string;
  subtitle?: string;
  // Vocab fields
  word?: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition?: string;
  exampleSentence?: string;
  imageUrl?: string;
  // Question fields
  questionText?: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  // Grammar fields
  grammarRule?: string;
  formula?: string;
  examples?: string[];
  // Discussion fields
  discussionPrompt?: string;
  discussionQuestions?: string[];
  targetLevel?: string;
  // Notes for teacher
  notes?: string;
}

export interface SlideDeck {
  id: string;
  title: string;
  description: string;
  category: 'cambridge' | 'vocab' | 'grammar' | 'warmup' | 'custom' | 'global-success';
  gradeLevel: string; // e.g. "Grade 4" or "Starters"
  cambridgeLevel?: CambridgeType;
  schoolGrade?: GradeType;
  curriculum?: string; // e.g. "Global Success 6", "Global Success 7", etc.
  theme: 'indigo' | 'emerald' | 'sunset' | 'slate' | 'cyber';
  slides: SlideItem[];
  updatedAt: number;
  authorName?: string;
}

export function matchGlobalSuccess(deck: any, gsId: string): boolean {
  if (!deck || !gsId || gsId === 'all') return true;
  const combined = `${deck.curriculum || ''} ${deck.gradeLevel || ''} ${deck.title || ''} ${deck.description || ''}`.toLowerCase();
  
  if (gsId === 'Global Success 6') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*6\b/i.test(combined) || (deck.schoolGrade === 'Grade 6' && /global|success/i.test(combined));
  }
  if (gsId === 'Global Success 7') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*7\b/i.test(combined) || (deck.schoolGrade === 'Grade 7' && /global|success/i.test(combined));
  }
  if (gsId === 'Global Success 8') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*8\b/i.test(combined) || (deck.schoolGrade === 'Grade 8' && /global|success/i.test(combined));
  }
  if (gsId === 'Global Success 9') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*9\b/i.test(combined) || (deck.schoolGrade === 'Grade 9' && /global|success/i.test(combined));
  }
  if (gsId === 'Global Success 1-5') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*[1-5]\b/i.test(combined);
  }
  if (gsId === 'Global Success 10-12') {
    return /\b(?:global\s*success|gs|tiếng\s*anh)\s*(?:1[0-2])\b/i.test(combined);
  }

  return combined.includes(gsId.toLowerCase());
}

export function MySlides({ onViewChange }: { onViewChange: (view: ViewState, data?: any) => void }) {
  const { user } = useAuth();
  const isAdmin = Boolean(
    user && !user.isAnonymous && user.email?.toLowerCase().trim() === 'janrelbugtay03@gmail.com'
  );

  // Track explicitly deleted deck IDs so deleted built-in or cached decks stay deleted
  const [deletedDeckIds, setDeletedDeckIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('hamster_deleted_slide_ids');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  // Load real slide decks created by the Admin, plus official Cambridge Starters Monster Art Class Studio
  const [decks, setDecks] = useState<SlideDeck[]>(() => {
    let deletedIds: string[] = [];
    try {
      const rawDel = localStorage.getItem('hamster_deleted_slide_ids');
      if (rawDel) {
        const parsedDel = JSON.parse(rawDel);
        if (Array.isArray(parsedDel)) deletedIds = parsedDel;
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem('hamster_my_slides');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          // Strictly remove pre-generated demo mock decks & deleted decks
          const realUserDecks = parsed.filter(
            d =>
              d &&
              !deletedIds.includes(d.id) &&
              !d.id?.startsWith('deck-cambridge-flyers') &&
              !d.id?.startsWith('deck-phonics-magic-e') &&
              !d.id?.startsWith('deck-grammar-past-vs-present')
          );
          const updatedDecks = realUserDecks.map(d =>
            d.id === STARTERS_MONSTER_ART_DECK_ID && (d.updatedAt || 0) < STARTERS_MONSTER_ART_DECK.updatedAt
              ? STARTERS_MONSTER_ART_DECK
              : d
          );
          const hasStartersMonsterArt = updatedDecks.some(
            d => d.id === STARTERS_MONSTER_ART_DECK_ID
          );
          if (!hasStartersMonsterArt && !deletedIds.includes(STARTERS_MONSTER_ART_DECK_ID)) {
            return [STARTERS_MONSTER_ART_DECK, ...updatedDecks];
          }
          return updatedDecks;
        }
      }
    } catch (e) {}
    return deletedIds.includes(STARTERS_MONSTER_ART_DECK_ID) ? [] : [STARTERS_MONSTER_ART_DECK];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCambridge, setSelectedCambridge] = useState<CambridgeType | 'all'>('all');
  const [selectedGrade, setSelectedGrade] = useState<GradeType | 'all'>('all');
  const [selectedGlobalSuccess, setSelectedGlobalSuccess] = useState<string | 'all'>('all');
  
  // Presenter Mode state
  const [presentingDeck, setPresentingDeck] = useState<SlideDeck | null>(null);
  const [forceStandardSlideView, setForceStandardSlideView] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBlackout, setIsBlackout] = useState(false);
  const [revealedQuestionAnswer, setRevealedQuestionAnswer] = useState(false);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<number | null>(null);
  const [showLaserPointer, setShowLaserPointer] = useState(false);
  const [laserPos, setLaserPos] = useState({ x: -100, y: -100 });
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Editor Modal & Undo Delete state
  const [editingDeck, setEditingDeck] = useState<SlideDeck | null>(null);
  const [deckForHomework, setDeckForHomework] = useState<any | null>(null);
  const [deckForShareQr, setDeckForShareQr] = useState<SlideDeck | null>(null);
  const [copiedSlideLink, setCopiedSlideLink] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastDeletedDeck, setLastDeletedDeck] = useState<SlideDeck | null>(null);

  const presenterRef = useRef<HTMLDivElement>(null);

  // Auto-open deck if ?slideId=... is present in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const slideId = params.get('slideId');
    if (slideId && decks.length > 0 && !presentingDeck) {
      const target = decks.find((d) => d.id === slideId);
      if (target) {
        setForceStandardSlideView(false);
        setPresentingDeck(target);
        setCurrentSlideIndex(0);
      }
    }
  }, [decks]);

  // Persist decks and deleted IDs locally
  useEffect(() => {
    try {
      localStorage.setItem('hamster_my_slides', JSON.stringify(decks));
    } catch (e) {}
  }, [decks]);

  useEffect(() => {
    try {
      localStorage.setItem('hamster_deleted_slide_ids', JSON.stringify(deletedDeckIds));
    } catch (e) {}
  }, [deletedDeckIds]);

  // Real-time public subscription to Firestore `mySlides` so all public users see Admin's slides
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'mySlides'),
      (snap) => {
        const cloudDecks: SlideDeck[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as SlideDeck;
          if (
            data &&
            data.id &&
            Array.isArray(data.slides) &&
            !data.id.startsWith('deck-cambridge-flyers') &&
            !data.id.startsWith('deck-phonics-magic-e') &&
            !data.id.startsWith('deck-grammar-past-vs-present')
          ) {
            cloudDecks.push(data);
          }
        });

        if (cloudDecks.length > 0) {
          setDecks((prev) => {
            const mergedMap = new Map<string, SlideDeck>();
            // Start with cloud decks that haven't been locally deleted
            cloudDecks.forEach((cd) => {
              if (!deletedDeckIds.includes(cd.id)) {
                mergedMap.set(cd.id, cd);
              }
            });
            // Keep any local decks not yet in cloud (unless deleted)
            prev.forEach((ld) => {
              if (!deletedDeckIds.includes(ld.id) && !mergedMap.has(ld.id)) {
                mergedMap.set(ld.id, ld);
              }
            });
            if (
              !mergedMap.has(STARTERS_MONSTER_ART_DECK_ID) &&
              !deletedDeckIds.includes(STARTERS_MONSTER_ART_DECK_ID)
            ) {
              mergedMap.set(STARTERS_MONSTER_ART_DECK_ID, STARTERS_MONSTER_ART_DECK);
            }
            return Array.from(mergedMap.values());
          });
        }
      },
      () => {}
    );
    return () => unsub();
  }, [deletedDeckIds]);

  const saveDeckToCloud = (deck: SlideDeck) => {
    if (!isAdmin || !user) return;
    setDoc(
      doc(db, 'mySlides', deck.id),
      {
        ...deck,
        userId: user.uid,
        authorName: user.displayName || 'Admin',
        updatedAt: Date.now(),
      },
      { merge: true }
    ).catch(() => {});
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sound effects generator
  const playSlideSound = (type: 'whoosh' | 'correct' | 'wrong') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = ctx.currentTime;
      if (type === 'whoosh') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.15);
      } else if (type === 'correct') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.setValueAtTime(523.25, now);
        osc1.frequency.setValueAtTime(659.25, now + 0.08);
        osc2.frequency.setValueAtTime(783.99, now + 0.16);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start();
        osc2.start(now + 0.16);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
      } else if (type === 'wrong') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(170, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.25);
      }
    } catch (e) {}
  };

  // Speech pronunciation helper
  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
      triggerToast(`Pronouncing: "${text}"`);
    }
  };

  // Filtered decks list
  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      // Global Success curriculum match (e.g. Global Success 6, 7, 8, 9)
      if (selectedGlobalSuccess !== 'all') {
        if (!matchGlobalSuccess(deck, selectedGlobalSuccess)) {
          return false;
        }
      }

      // Cambridge level match
      if (selectedCambridge !== 'all') {
        const detectedCourse = deck.cambridgeLevel || extractCambridgeCourse(deck);
        const matchesCambridge = detectedCourse === selectedCambridge || 
          deck.gradeLevel?.toLowerCase().includes(selectedCambridge.toLowerCase()) ||
          deck.title.toLowerCase().includes(selectedCambridge.toLowerCase());
        if (!matchesCambridge) return false;
      }

      // School grade match
      if (selectedGrade !== 'all') {
        const gradeNumMatch = selectedGrade.match(/\d+/);
        const gradeNum = gradeNumMatch ? parseInt(gradeNumMatch[0], 10) : null;
        const deckGradeNum = extractGradeNumber(deck);
        const matchesGrade = (gradeNum !== null && deckGradeNum === gradeNum) ||
          deck.gradeLevel?.toLowerCase().includes(selectedGrade.toLowerCase()) ||
          deck.title.toLowerCase().includes(selectedGrade.toLowerCase());
        if (!matchesGrade) return false;
      }

      // Search query match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
          deck.title.toLowerCase().includes(q) ||
          deck.description.toLowerCase().includes(q) ||
          (deck.gradeLevel && deck.gradeLevel.toLowerCase().includes(q)) ||
          (deck.curriculum && deck.curriculum.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [decks, selectedGlobalSuccess, selectedCambridge, selectedGrade, searchQuery]);

  // Launch presentation mode
  const startPresenting = (deck: SlideDeck, slideIdx = 0) => {
    setPresentingDeck(deck);
    setCurrentSlideIndex(slideIdx);
    setRevealedQuestionAnswer(false);
    setSelectedAnswerIndex(null);
    setIsBlackout(false);
    playSlideSound('whoosh');
  };

  const closePresentation = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setPresentingDeck(null);
    setIsFullscreen(false);
    setIsTimerRunning(false);
    setTimerSeconds(null);
  };

  const goToNextSlide = () => {
    if (!presentingDeck) return;
    if (currentSlideIndex < presentingDeck.slides.length - 1) {
      setCurrentSlideIndex(prev => prev + 1);
      setRevealedQuestionAnswer(false);
      setSelectedAnswerIndex(null);
      playSlideSound('whoosh');
    }
  };

  const goToPrevSlide = () => {
    if (!presentingDeck) return;
    if (currentSlideIndex > 0) {
      setCurrentSlideIndex(prev => prev - 1);
      setRevealedQuestionAnswer(false);
      setSelectedAnswerIndex(null);
      playSlideSound('whoosh');
    }
  };

  // Keyboard navigation listener
  useEffect(() => {
    if (!presentingDeck) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingDeck) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goToNextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPrevSlide();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setIsBlackout(prev => !prev);
      } else if (e.key === 'Escape') {
        if (!document.fullscreenElement) {
          closePresentation();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [presentingDeck, currentSlideIndex, editingDeck]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      presenterRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Classroom Timer countdown
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSeconds !== null && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(prev => {
          if (prev === null || prev <= 1) {
            setIsTimerRunning(false);
            playSlideSound('correct');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSeconds]);

  // Delete Deck (Admin only — instant delete without blocked window.confirm, plus Undo support)
  const handleDeleteDeck = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAdmin) {
      triggerToast('Only the Admin can delete slide decks.');
      return;
    }
    const targetDeck = decks.find((d) => d.id === id) || null;
    if (targetDeck) {
      setLastDeletedDeck(targetDeck);
    }
    setDeletedDeckIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setDecks((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      try {
        localStorage.setItem('hamster_my_slides', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
    deleteDoc(doc(db, 'mySlides', id)).catch(() => {});
    triggerToast('Slide deck erased.');
  };

  const handleUndoDelete = () => {
    if (!isAdmin || !lastDeletedDeck) return;
    const restored = lastDeletedDeck;
    setLastDeletedDeck(null);
    setDeletedDeckIds((prev) => prev.filter((id) => id !== restored.id));
    setDecks((prev) => [restored, ...prev.filter((d) => d.id !== restored.id)]);
    saveDeckToCloud(restored);
    triggerToast(`Restored "${restored.title}"!`);
  };

  // Duplicate Deck (Admin only)
  const handleDuplicateDeck = (deck: SlideDeck, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAdmin) return;
    const duplicated: SlideDeck = {
      ...deck,
      id: `deck-${Date.now()}`,
      title: `${deck.title} (Copy)`,
      updatedAt: Date.now(),
    };
    setDecks((prev) => [duplicated, ...prev]);
    saveDeckToCloud(duplicated);
    triggerToast('Slide deck duplicated!');
  };

  // Helper to convert games/lessons into a slide deck
  const convertGameToSlideDeck = (g: any, i: number, isGS = false): SlideDeck => {
    const questions = Array.isArray(g.customQuestions) && g.customQuestions.length > 0 
      ? g.customQuestions 
      : Array.isArray(g.questions) && g.questions.length > 0 
      ? g.questions 
      : [];

    const cambridge = extractCambridgeCourse(g);
    const gradeNum = extractGradeNumber(g);
    let gsLevel: string | undefined = undefined;
    if (gradeNum === 6) gsLevel = 'Global Success 6';
    else if (gradeNum === 7) gsLevel = 'Global Success 7';
    else if (gradeNum === 8) gsLevel = 'Global Success 8';
    else if (gradeNum === 9) gsLevel = 'Global Success 9';

    const gradeLabel = gsLevel || (gradeNum ? `Grade ${gradeNum}` : cambridge || 'General English');

    const slides: SlideItem[] = [
      {
        id: `s-title-${i}`,
        type: 'title',
        title: g.title || g.name || g.topic || 'Classroom Review Deck',
        subtitle: `${g.className || g.classLevel || gradeLabel} · ${questions.length} Interactive Slides`,
      },
      ...questions.slice(0, 15).map((q: any, qIdx: number) => {
        const opts = Array.isArray(q.options) && q.options.length > 0 ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'];
        return {
          id: `s-q-${i}-${qIdx}`,
          type: 'question' as SlideType,
          title: `Question ${qIdx + 1}`,
          questionText: q.question || q.text || 'Choose the correct answer:',
          options: opts,
          correctOptionIndex: typeof q.correct === 'number' ? q.correct : typeof q.answerIndex === 'number' ? q.answerIndex : 0,
          explanation: q.explanation || 'Great job answering!',
          notes: `Question ${qIdx + 1} from ${g.title || 'Lesson'}`,
        };
      }),
      {
        id: `s-summary-${i}`,
        type: 'discussion',
        title: 'Round Summary & Speaking Check',
        discussionPrompt: `Excellent effort reviewing "${g.title || g.topic || 'Lesson'}"!`,
        discussionQuestions: [
          'Which question was the trickiest?',
          'Use one new vocabulary word in a sentence with your partner.'
        ]
      }
    ];

    return {
      id: `deck-imported-${g.id || Date.now()}-${i}`,
      title: `${g.title || g.name || 'Lesson Deck'} (Slides)`,
      description: `Classroom slide presentation for ${g.title || 'lesson'} with ${questions.length} questions.`,
      category: isGS ? 'global-success' : 'custom',
      gradeLevel: gradeLabel,
      cambridgeLevel: cambridge || undefined,
      schoolGrade: gradeNum ? (`Grade ${gradeNum}` as GradeType) : undefined,
      curriculum: gsLevel,
      theme: (['emerald', 'indigo', 'sunset', 'cyber'][i % 4] as any) || 'indigo',
      updatedAt: Date.now(),
      slides
    };
  };

  // Convert Custom Games from My Games into Slide Decks (Admin only)
  const handleImportFromGames = () => {
    if (!isAdmin) return;
    try {
      const cached = localStorage.getItem('hamster_cached_user_games');
      const customGames = cached ? JSON.parse(cached) : [];
      if (!Array.isArray(customGames) || customGames.length === 0) {
        triggerToast("No games found in your custom library yet! Create a game first in My Games.");
        return;
      }

      const importedDecks: SlideDeck[] = customGames.map((g: any, i: number) => convertGameToSlideDeck(g, i, false));
      importedDecks.forEach((d) => saveDeckToCloud(d));
      setDecks(prev => [...importedDecks, ...prev]);
      triggerToast(`Imported ${importedDecks.length} slide deck(s) from My Games!`);
    } catch (e) {
      triggerToast("Failed to import games from My Games.");
    }
  };

  // Import Global Success 6 to 9 Lesson Slide Decks directly (Admin only)
  const handleImportGlobalSuccessDecks = () => {
    if (!isAdmin) return;
    try {
      const gsGames = FALLBACK_COMMUNITY_GAMES.filter(g => {
        const title = (g.title || g.name || g.topic || '').toLowerCase();
        return title.includes('global success 6') || 
               title.includes('global success 7') || 
               title.includes('global success 8') || 
               title.includes('global success 9');
      });

      if (gsGames.length === 0) {
        triggerToast("No Global Success 6–9 lesson packs found.");
        return;
      }

      const newGSDecks: SlideDeck[] = gsGames.map((g: any, i: number) => convertGameToSlideDeck(g, i, true));
      
      // Avoid duplicate decks
      setDecks(prev => {
        const existingTitles = new Set(prev.map(d => d.title.toLowerCase()));
        const filtered = newGSDecks.filter(d => !existingTitles.has(d.title.toLowerCase()));
        if (filtered.length === 0) {
          triggerToast("Global Success 6–9 decks are already loaded in your slides!");
          return prev;
        }
        filtered.forEach((d) => saveDeckToCloud(d));
        triggerToast(`Added ${filtered.length} Global Success 6 to 9 slide decks!`);
        return [...filtered, ...prev];
      });
    } catch (e) {
      triggerToast("Failed to load Global Success slide decks.");
    }
  };

  const getThemeGradient = (theme: SlideDeck['theme']) => {
    switch (theme) {
      case 'emerald':
        return 'from-emerald-600 via-teal-700 to-slate-950';
      case 'sunset':
        return 'from-amber-600 via-orange-600 to-rose-950';
      case 'slate':
        return 'from-slate-700 via-slate-800 to-slate-950';
      case 'cyber':
        return 'from-cyan-600 via-blue-700 to-purple-950';
      case 'indigo':
      default:
        return 'from-indigo-600 via-purple-700 to-slate-950';
    }
  };

  const currentSlide: SlideItem | undefined = presentingDeck?.slides[currentSlideIndex];
  const hasActiveFilters = selectedCambridge !== 'all' || selectedGrade !== 'all' || selectedGlobalSuccess !== 'all' || searchQuery.trim().length > 0;

  const resetFilters = () => {
    setSelectedCambridge('all');
    setSelectedGrade('all');
    setSelectedGlobalSuccess('all');
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 text-sm font-semibold">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <span>{toastMessage}</span>
          {isAdmin && lastDeletedDeck && (
            <button
              onClick={handleUndoDelete}
              className="ml-2 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition cursor-pointer"
            >
              Undo
            </button>
          )}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-brand-purple dark:text-purple-400 mb-1">
              <Presentation className="w-4 h-4" />
              <span>Teaching Slide Decks</span>
              <span>·</span>
              <span>Classroom Projector Ready</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span>My Slides</span>
              <span className="text-sm font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
                {decks.length} {decks.length === 1 ? 'Deck' : 'Decks'}
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl font-medium">
              Present interactive lesson slide decks for classroom TV and projector displays. Filter by Cambridge, School Grade, or Global Success 6–9.
            </p>
          </div>

          {/* Admin-Only Management Action Buttons */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleImportGlobalSuccessDecks()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors shadow-xs cursor-pointer"
                title="Add official Global Success 6 to 9 curriculum slide decks"
              >
                <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Import Global Success (6–9)</span>
              </button>
              <button
                onClick={() => handleImportFromGames()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-bold text-sm hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors shadow-xs cursor-pointer"
                title="Convert question sets from My Games into slide presentations"
              >
                <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Import from My Games</span>
              </button>
              <button
                onClick={() => {
                  const newDeck: SlideDeck = {
                    id: `deck-${Date.now()}`,
                    title: 'New Lesson Slide Deck',
                    description: 'Add your vocabulary words, phonics drills, and quiz questions.',
                    category: 'global-success',
                    gradeLevel: 'Global Success 6',
                    curriculum: 'Global Success 6',
                    schoolGrade: 'Grade 6',
                    theme: 'emerald',
                    updatedAt: Date.now(),
                    slides: [
                      {
                        id: `s-${Date.now()}-1`,
                        type: 'title',
                        title: 'Global Success 6: Unit Title',
                        subtitle: 'Lesson Objective & Target Vocabulary',
                      },
                      {
                        id: `s-${Date.now()}-2`,
                        type: 'vocab',
                        word: 'Neighbourhood',
                        phonetic: '/ˈneɪ.bə.hʊd/',
                        partOfSpeech: 'Noun',
                        definition: "The area of a town that surrounds someone's home.",
                        exampleSentence: 'My neighbourhood is very peaceful and friendly.',
                        imageUrl:
                          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=1000&auto=format&fit=crop',
                      },
                    ],
                  };
                  setEditingDeck(newDeck);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-purple text-white font-extrabold text-sm shadow-md shadow-purple-500/20 hover:bg-purple-700 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Slide Deck</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter and Search Box (Matches Screenshot & Global Success 6-9 Extension) */}
        <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs mb-8 space-y-4">
          {/* Top Search Bar & Filter Summary */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search slide titles or topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition cursor-pointer self-end sm:self-auto"
              >
                <X size={14} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Row 1: Cambridge Course Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 shrink-0 flex items-center gap-1 min-w-[125px]">
              <Award size={13} /> CAMBRIDGE:
            </span>
            <button
              onClick={() => setSelectedCambridge('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                selectedCambridge === 'all'
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {CAMBRIDGE_COURSES.map((c) => {
              const isSelected = selectedCambridge === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCambridge(isSelected ? 'all' : c.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-indigo-50/70 hover:bg-indigo-100/80 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/40'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Row 2: School Grades Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0 flex items-center gap-1 min-w-[125px]">
              <GraduationCap size={13} /> GRADES:
            </span>
            {ALL_GRADES.map((grade) => {
              const isSelected = selectedGrade === grade;
              return (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(isSelected ? 'all' : grade)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/40'
                  }`}
                >
                  {grade}
                </button>
              );
            })}
          </div>

          {/* Row 3: Global Success (6 to 9) Pills directly under the grades */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-slate-100 dark:border-slate-700/40">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1 min-w-[125px]">
              <BookOpen size={13} /> GLOBAL SUCCESS:
            </span>
            {GLOBAL_SUCCESS_LEVELS.map((gs) => {
              const isSelected = selectedGlobalSuccess === gs.id;
              return (
                <button
                  key={gs.id}
                  onClick={() => setSelectedGlobalSuccess(isSelected ? 'all' : gs.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 border ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/40'
                  }`}
                >
                  {gs.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slide Decks Grid */}
        {filteredDecks.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center my-6">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-brand-purple flex items-center justify-center mb-4">
              <Presentation className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {hasActiveFilters ? 'No Matching Slide Decks' : 'No Slide Decks Yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6">
              {hasActiveFilters 
                ? 'Try adjusting your Cambridge, Grade, or Global Success filters to view your slide decks.'
                : 'Create your first classroom presentation from scratch, or import official Global Success 6 to 9 lesson packs!'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {hasActiveFilters ? (
                <button
                  onClick={resetFilters}
                  className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : isAdmin ? (
                <>
                  <button
                    onClick={() => handleImportGlobalSuccessDecks()}
                    className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl font-bold text-sm hover:bg-emerald-100 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <BookOpen size={16} />
                    <span>Import Global Success 6–9</span>
                  </button>
                  <button
                    onClick={() => handleImportFromGames()}
                    className="px-5 py-2.5 bg-purple-50 dark:bg-purple-950/40 text-brand-purple border border-purple-200 dark:border-purple-800 rounded-xl font-bold text-sm hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    Import from My Games
                  </button>
                  <button
                    onClick={() => {
                      const newDeck: SlideDeck = {
                        id: `deck-${Date.now()}`,
                        title: 'Global Success 6: Unit 1 Lesson Deck',
                        description: 'Vocabulary, grammar formulas, and interactive quiz checks.',
                        category: 'global-success',
                        gradeLevel: 'Global Success 6',
                        curriculum: 'Global Success 6',
                        schoolGrade: 'Grade 6',
                        theme: 'emerald',
                        updatedAt: Date.now(),
                        slides: [
                          {
                            id: `s-${Date.now()}-1`,
                            type: 'title',
                            title: 'Global Success 6: Unit 1',
                            subtitle: 'My New School · Classroom Lesson Deck',
                          },
                        ],
                      };
                      setEditingDeck(newDeck);
                    }}
                    className="px-5 py-2.5 bg-brand-purple text-white rounded-xl font-bold text-sm shadow-md hover:bg-purple-700 transition-colors cursor-pointer"
                  >
                    Create Deck
                  </button>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDecks.map((deck) => {
              const slideCount = deck.slides.length;
              const titleSlide = deck.slides.find(s => s.type === 'title') || deck.slides[0];

              return (
                <div
                  key={deck.id}
                  className="group bg-white dark:bg-slate-800 rounded-[28px] border border-slate-200 dark:border-slate-700/80 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden hover:-translate-y-1"
                >
                  {/* Top Deck Banner Card */}
                  <div
                    onClick={() => {
                      setForceStandardSlideView(false);
                      startPresenting(deck);
                    }}
                    className={`relative aspect-[16/10] bg-gradient-to-br ${getThemeGradient(deck.theme)} p-6 flex flex-col justify-between cursor-pointer overflow-hidden group/thumb`}
                  >
                    {deck.id === STARTERS_MONSTER_ART_DECK_ID && (
                      <img
                        src="/assets/aistudio/image_7db17f83.png"
                        alt="Monster Art Class"
                        className="absolute inset-0 w-full h-full object-cover opacity-55 group-hover/thumb:scale-105 transition-transform duration-500 pointer-events-none"
                      />
                    )}
                    {deck.id === STARTERS_MONSTER_ART_DECK_ID && (
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-indigo-950/45 to-slate-950/35 pointer-events-none" />
                    )}
                    <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/10 blur-xl pointer-events-none group-hover/thumb:scale-125 transition-transform duration-500" />
                    
                    <div className="flex items-center justify-between gap-2 z-10">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white px-2.5 py-1 rounded-full border border-white/25">
                        {deck.curriculum || deck.gradeLevel}
                      </span>
                      <span className="text-xs font-black text-white/90 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {deck.id === STARTERS_MONSTER_ART_DECK_ID
                            ? '🎨 Interactive Studio + 8 Cards'
                            : `${slideCount} Slides`}
                        </span>
                      </span>
                    </div>

                    <div className="z-10 mt-auto">
                      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-md line-clamp-2">
                        {deck.title}
                      </h3>
                      {titleSlide?.subtitle && (
                        <p className="text-xs text-white/80 font-medium line-clamp-1 mt-1">
                          {titleSlide.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center z-20">
                      <div className="w-14 h-14 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-xl transform scale-75 group-hover/thumb:scale-100 transition-transform">
                        <Play className="w-6 h-6 fill-current ml-1 text-brand-purple" />
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 leading-relaxed mb-4">
                        {deck.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        {deck.id === STARTERS_MONSTER_ART_DECK_ID ? (
                          <>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                              👆 Part 1A Point
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                              🃏 Part 1B 8 Cards
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                              🔍 Part 2 Q&A
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                              🎙️ Voice & Shields
                            </span>
                          </>
                        ) : (
                          <>
                            {deck.slides.slice(0, 4).map((s, idx) => (
                              <span 
                                key={idx}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                              >
                                {s.type === 'vocab' ? `🔤 ${s.word || 'Vocab'}` : s.type === 'question' ? '❓ Quiz' : s.type === 'grammar' ? '📐 Grammar' : '💬 Speak'}
                              </span>
                            ))}
                            {slideCount > 4 && (
                              <span className="text-[10px] font-bold text-slate-400 px-1.5 py-0.5">
                                +{slideCount - 4} more
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Bottom Deck Actions */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setForceStandardSlideView(false);
                          startPresenting(deck);
                        }}
                        className="flex-1 py-2 px-3 rounded-xl bg-brand-purple text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-purple-700 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>
                          {deck.id === STARTERS_MONSTER_ART_DECK_ID ? 'Launch Studio' : 'Present'}
                        </span>
                      </button>

                      {/* Send Slide Deck as Homework */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeckForHomework(convertSlideDeckToHomeworkObject(deck));
                        }}
                        className="px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                        title="Send this slide deck as Homework"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Homework</span>
                      </button>

                      {/* Share & QR Code on hamsterenglish.online */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopiedSlideLink(false);
                          setDeckForShareQr(deck);
                        }}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Share Slide Link & QR Code (hamsterenglish.online)"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingDeck(deck);
                            }}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Edit slides (Admin)"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDuplicateDeck(deck, e)}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            title="Duplicate deck (Admin)"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDeleteDeck(deck.id, e)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Erase deck (Admin)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          FULLSCREEN CLASSROOM PRESENTER THEATER
      ========================================================================= */}
      {presentingDeck && presentingDeck.id === STARTERS_MONSTER_ART_DECK_ID && !forceStandardSlideView ? (
        <StartersMonsterArtStudio
          onClose={closePresentation}
          onSwitchToStandardSlides={() => setForceStandardSlideView(true)}
        />
      ) : presentingDeck && (
        <div 
          ref={presenterRef}
          onMouseMove={(e) => {
            if (showLaserPointer) {
              setLaserPos({ x: e.clientX, y: e.clientY });
            }
          }}
          className={`fixed inset-0 z-[300] bg-slate-950 text-white flex flex-col overflow-hidden select-none font-sans ${showLaserPointer ? 'cursor-none' : ''}`}
        >
          {/* Laser Pointer Spot */}
          {showLaserPointer && (
            <div 
              className="pointer-events-none fixed w-6 h-6 rounded-full bg-rose-500/80 shadow-[0_0_20px_#f43f5e] -translate-x-1/2 -translate-y-1/2 z-[350] border-2 border-white animate-pulse"
              style={{ left: laserPos.x, top: laserPos.y }}
            />
          )}

          {/* Top Control Bar */}
          <div className="h-16 px-6 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 backdrop-blur-md z-30">
            <div className="flex items-center gap-3">
              <button
                onClick={closePresentation}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Exit presentation (Esc)"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              {presentingDeck.id === STARTERS_MONSTER_ART_DECK_ID && (
                <button
                  onClick={() => setForceStandardSlideView(false)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Interactive Studio</span>
                </button>
              )}
              <div>
                <h2 className="font-extrabold text-base text-white truncate max-w-sm sm:max-w-md">
                  {presentingDeck.title}
                </h2>
                <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <span>Slide {currentSlideIndex + 1} of {presentingDeck.slides.length}</span>
                  <span>·</span>
                  <span className="uppercase text-brand-purple">{currentSlide?.type}</span>
                </div>
              </div>
            </div>

            {/* Presenter Utilities */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-mono font-bold text-amber-300">
                  {timerSeconds !== null 
                    ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}`
                    : 'Timer'}
                </span>
                <button
                  onClick={() => {
                    if (isTimerRunning) {
                      setIsTimerRunning(false);
                    } else if (timerSeconds === null || timerSeconds === 0) {
                      setTimerSeconds(60);
                      setIsTimerRunning(true);
                    } else {
                      setIsTimerRunning(true);
                    }
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  {isTimerRunning ? 'Pause' : 'Start (1m)'}
                </button>
                <button
                  onClick={() => {
                    setTimerSeconds(120);
                    setIsTimerRunning(true);
                  }}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                >
                  2m
                </button>
              </div>

              {/* Laser Pointer toggle */}
              <button
                onClick={() => setShowLaserPointer(prev => !prev)}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${showLaserPointer ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                title="Toggle Laser Pointer"
              >
                <MousePointer className="w-4 h-4" />
              </button>

              {/* Blackout toggle (B) */}
              <button
                onClick={() => setIsBlackout(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${isBlackout ? 'bg-amber-500 text-slate-950 font-black' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                title="Blackout screen for attention (B key)"
              >
                {isBlackout ? 'Resume' : 'Blackout (B)'}
              </button>

              {/* Toggle Fullscreen (F) */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Toggle Fullscreen (F)"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Exit */}
              <button
                onClick={closePresentation}
                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Slide Stage Area */}
          <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-slate-950">
            {isBlackout ? (
              <div 
                onClick={() => setIsBlackout(false)}
                className="absolute inset-0 bg-black flex flex-col items-center justify-center cursor-pointer z-40 animate-in fade-in"
              >
                <p className="text-xl font-bold text-slate-500 tracking-wider">Screen Paused · Focus on Teacher</p>
                <span className="text-xs text-slate-600 mt-2">Click anywhere or press B to resume</span>
              </div>
            ) : null}

            {/* Slide Canvas Card */}
            {currentSlide && !isBlackout && (
              <div className="w-full max-w-5xl aspect-[16/9] bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-3xl p-6 sm:p-12 shadow-2xl border-2 border-slate-800 relative flex flex-col justify-between overflow-hidden animate-in fade-in duration-200">
                {/* 1. TITLE SLIDE */}
                {currentSlide.type === 'title' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple/20 text-purple-300 border border-purple-400/30 text-xs font-black uppercase tracking-widest mb-6">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Classroom Lesson Slide Deck</span>
                    </div>
                    <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight drop-shadow-xl max-w-3xl leading-tight mb-4">
                      {currentSlide.title || presentingDeck.title}
                    </h1>
                    {currentSlide.subtitle && (
                      <p className="text-xl sm:text-2xl text-purple-200/90 font-semibold max-w-2xl leading-relaxed">
                        {currentSlide.subtitle}
                      </p>
                    )}
                    <div className="mt-8 flex items-center gap-3 text-sm font-bold text-slate-400">
                      <span>{presentingDeck.curriculum || presentingDeck.gradeLevel}</span>
                      <span>·</span>
                      <span>Hamster ESL Studio</span>
                    </div>
                  </div>
                )}

                {/* 2. VOCABULARY SLIDE */}
                {currentSlide.type === 'vocab' && (
                  <div className="flex-1 flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="flex-1 space-y-5 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          {currentSlide.partOfSpeech || 'Target Word'}
                        </span>
                        {currentSlide.phonetic && (
                          <span className="text-sm font-mono text-slate-400">
                            {currentSlide.phonetic}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight">
                          {currentSlide.word}
                        </h2>
                        {currentSlide.word && (
                          <button
                            onClick={() => speakWord(currentSlide.word!)}
                            className="p-3.5 rounded-2xl bg-brand-purple hover:bg-purple-600 text-white shadow-lg shadow-purple-500/30 active:scale-95 transition-all cursor-pointer"
                            title="Listen to native audio pronunciation"
                          >
                            <Volume2 className="w-6 h-6" />
                          </button>
                        )}
                      </div>

                      {currentSlide.definition && (
                        <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/80">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Meaning</span>
                          <p className="text-base sm:text-lg text-slate-200 font-medium">
                            {currentSlide.definition}
                          </p>
                        </div>
                      )}

                      {currentSlide.exampleSentence && (
                        <div className="bg-purple-950/30 rounded-2xl p-4 border border-purple-800/40">
                          <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block mb-1">Example Sentence</span>
                          <p className="text-lg sm:text-xl text-white font-bold leading-relaxed italic">
                            "{currentSlide.exampleSentence}"
                          </p>
                        </div>
                      )}
                    </div>

                    {currentSlide.imageUrl && (
                      <div className="w-full md:w-80 aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700 shrink-0 bg-slate-800">
                        <img 
                          src={currentSlide.imageUrl} 
                          alt={currentSlide.word || 'Illustration'} 
                          className="w-full h-full object-cover"
                          onError={(e: any) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. MULTIPLE-CHOICE QUESTION SLIDE */}
                {currentSlide.type === 'question' && (
                  <div className="flex-1 flex flex-col justify-between text-left relative z-10">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                          Interactive Quiz Check
                        </span>
                        <button
                          onClick={() => {
                            setRevealedQuestionAnswer(prev => !prev);
                            playSlideSound('correct');
                          }}
                          className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Lightbulb className="w-3.5 h-3.5" />
                          <span>{revealedQuestionAnswer ? 'Hide Answer' : 'Reveal Answer'}</span>
                        </button>
                      </div>

                      <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight mb-8">
                        {currentSlide.questionText}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {currentSlide.options?.map((opt, optIdx) => {
                        const isCorrect = optIdx === currentSlide.correctOptionIndex;
                        const isSelected = selectedAnswerIndex === optIdx;
                        const showResult = revealedQuestionAnswer || isSelected;

                        let btnStyle = "bg-slate-800/90 border-slate-700 hover:bg-slate-700/80 text-white";
                        if (showResult) {
                          if (isCorrect) {
                            btnStyle = "bg-emerald-600 border-emerald-400 text-white font-black shadow-lg shadow-emerald-600/30 scale-[1.02]";
                          } else if (isSelected) {
                            btnStyle = "bg-rose-700 border-rose-500 text-white font-bold";
                          }
                        }

                        const letters = ['A', 'B', 'C', 'D'];

                        return (
                          <button
                            key={optIdx}
                            onClick={() => {
                              setSelectedAnswerIndex(optIdx);
                              setRevealedQuestionAnswer(true);
                              if (isCorrect) {
                                playSlideSound('correct');
                              } else {
                                playSlideSound('wrong');
                              }
                            }}
                            className={`p-4 sm:p-5 rounded-2xl border-2 text-left text-base sm:text-xl font-bold flex items-center gap-3 transition-all cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-9 h-9 rounded-xl bg-black/30 flex items-center justify-center text-sm font-black shrink-0">
                              {letters[optIdx] || optIdx + 1}
                            </span>
                            <span className="flex-1">{opt}</span>
                            {showResult && isCorrect && (
                              <CheckCircle2 className="w-6 h-6 text-emerald-200 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {revealedQuestionAnswer && currentSlide.explanation && (
                      <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs sm:text-sm text-emerald-300 font-semibold animate-in fade-in">
                        💡 {currentSlide.explanation}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. GRAMMAR & RULES SLIDE */}
                {currentSlide.type === 'grammar' && (
                  <div className="flex-1 flex flex-col justify-between text-left relative z-10">
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 mb-4 inline-block">
                        Grammar Rule & Structure
                      </span>
                      <h2 className="text-3xl sm:text-4xl font-black text-white mb-4">
                        {currentSlide.title || 'Grammar Spotlight'}
                      </h2>
                      {currentSlide.grammarRule && (
                        <p className="text-base sm:text-xl text-slate-300 font-medium leading-relaxed mb-6">
                          {currentSlide.grammarRule}
                        </p>
                      )}
                    </div>

                    {currentSlide.formula && (
                      <div className="bg-gradient-to-r from-cyan-950/60 to-blue-950/60 p-5 rounded-2xl border-2 border-cyan-500/40 shadow-inner">
                        <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block mb-1">Sentence Formula</span>
                        <code className="text-xl sm:text-2xl font-black text-cyan-200 font-mono">
                          {currentSlide.formula}
                        </code>
                      </div>
                    )}

                    {currentSlide.examples && currentSlide.examples.length > 0 && (
                      <div className="space-y-2.5 mt-4">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">Examples in Context</span>
                        {currentSlide.examples.map((ex, idx) => (
                          <div key={idx} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                            <span className="text-cyan-400 font-mono font-bold">{idx + 1}.</span>
                            <span>{ex}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. DISCUSSION / SPEAKING WARMUP SLIDE */}
                {currentSlide.type === 'discussion' && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 relative z-10">
                    <span className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-400/30 mb-6">
                      Classroom Speaking Activity
                    </span>
                    <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-3xl leading-tight mb-8">
                      {currentSlide.discussionPrompt}
                    </h2>

                    {currentSlide.discussionQuestions && (
                      <div className="w-full max-w-2xl space-y-3 text-left">
                        {currentSlide.discussionQuestions.map((q, idx) => (
                          <div key={idx} className="p-4 rounded-2xl bg-slate-800/90 border border-slate-700 text-base sm:text-lg font-bold text-pink-200 flex items-center gap-3">
                            <span className="w-7 h-7 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center text-xs font-black">
                              {idx + 1}
                            </span>
                            <span>{q}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Slide Strip & Controls */}
          <div className="h-20 px-6 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-4 shrink-0 z-30">
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none text-white font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            <div className="flex items-center gap-2 overflow-x-auto max-w-2xl px-2 custom-scrollbar">
              {presentingDeck.slides.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setCurrentSlideIndex(idx);
                    setRevealedQuestionAnswer(false);
                    setSelectedAnswerIndex(null);
                    playSlideSound('whoosh');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
                    currentSlideIndex === idx
                      ? 'bg-brand-purple text-white shadow-md scale-105'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{idx + 1}</span>
                  <span className="hidden md:inline ml-1 opacity-70">
                    {s.type === 'title' ? 'Intro' : s.type === 'vocab' ? 'Word' : s.type === 'question' ? 'Q' : s.type === 'grammar' ? 'Rule' : 'Talk'}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={goToNextSlide}
              disabled={currentSlideIndex === presentingDeck.slides.length - 1}
              className="px-5 py-2.5 rounded-xl bg-brand-purple hover:bg-purple-600 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all cursor-pointer"
            >
              <span className="hidden sm:inline">Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SLIDE DECK EDITOR MODAL
      ========================================================================= */}
      {editingDeck && (
        <div 
          className="fixed inset-0 z-[250] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setEditingDeck(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-[32px] w-full max-w-4xl p-6 sm:p-8 border-2 border-slate-200 dark:border-slate-800 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  Edit Slide Deck
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Set Cambridge level, school grade, Global Success curriculum, and create classroom slides.
                </p>
              </div>
              <button
                onClick={() => setEditingDeck(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Deck Title
                  </label>
                  <input
                    type="text"
                    value={editingDeck.title}
                    onChange={(e) => setEditingDeck({ ...editingDeck, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Target Label (e.g. Global Success 7 or Grade 7)
                  </label>
                  <input
                    type="text"
                    value={editingDeck.gradeLevel}
                    onChange={(e) => setEditingDeck({ ...editingDeck, gradeLevel: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-purple"
                  />
                </div>
              </div>

              {/* Cambridge, Grade, and Global Success Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block mb-1 flex items-center gap-1">
                    <Award size={13} /> Cambridge Level
                  </label>
                  <select
                    value={editingDeck.cambridgeLevel || ''}
                    onChange={(e) => {
                      const val = e.target.value as CambridgeType | '';
                      setEditingDeck({ 
                        ...editingDeck, 
                        cambridgeLevel: val ? (val as CambridgeType) : undefined,
                        gradeLevel: val || editingDeck.gradeLevel
                      });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="">None / General</option>
                    {CAMBRIDGE_COURSES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-600 dark:text-amber-400 block mb-1 flex items-center gap-1">
                    <GraduationCap size={13} /> School Grade
                  </label>
                  <select
                    value={editingDeck.schoolGrade || ''}
                    onChange={(e) => {
                      const val = e.target.value as GradeType | '';
                      setEditingDeck({ 
                        ...editingDeck, 
                        schoolGrade: val ? (val as GradeType) : undefined,
                        gradeLevel: val || editingDeck.gradeLevel
                      });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="">None / All Grades</option>
                    {ALL_GRADES.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1 flex items-center gap-1">
                    <BookOpen size={13} /> Global Success
                  </label>
                  <select
                    value={editingDeck.curriculum || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingDeck({ 
                        ...editingDeck, 
                        curriculum: val || undefined,
                        gradeLevel: val || editingDeck.gradeLevel
                      });
                    }}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="">None / Other</option>
                    {GLOBAL_SUCCESS_LEVELS.map(gs => (
                      <option key={gs.id} value={gs.id}>{gs.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editingDeck.description}
                  onChange={(e) => setEditingDeck({ ...editingDeck, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-purple"
                />
              </div>

              {/* Theme Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-2">
                  Theme Palette
                </label>
                <div className="flex items-center gap-3">
                  {[
                    { id: 'indigo', label: 'Indigo Purple' },
                    { id: 'emerald', label: 'Emerald Mint' },
                    { id: 'sunset', label: 'Sunset Amber' },
                    { id: 'cyber', label: 'Cyan Cyber' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditingDeck({ ...editingDeck, theme: t.id as any })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all cursor-pointer ${
                        editingDeck.theme === t.id
                          ? 'border-brand-purple bg-purple-50 dark:bg-purple-950/40 text-brand-purple'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slides List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Slides ({editingDeck.slides.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newSlide: SlideItem = {
                        id: `s-${Date.now()}`,
                        type: 'vocab',
                        word: 'New Word',
                        definition: 'Enter definition here',
                        exampleSentence: 'Use word in a complete sentence.'
                      };
                      setEditingDeck({
                        ...editingDeck,
                        slides: [...editingDeck.slides, newSlide]
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-brand-purple font-bold text-xs hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Slide</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {editingDeck.slides.map((s, idx) => (
                    <div 
                      key={s.id} 
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-brand-purple/20 text-brand-purple flex items-center justify-center text-xs font-black">
                            {idx + 1}
                          </span>
                          <select
                            value={s.type}
                            onChange={(e) => {
                              const updatedSlides = [...editingDeck.slides];
                              updatedSlides[idx] = { ...s, type: e.target.value as SlideType };
                              setEditingDeck({ ...editingDeck, slides: updatedSlides });
                            }}
                            className="text-xs font-bold px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
                          >
                            <option value="title">Title Slide</option>
                            <option value="vocab">Vocabulary Slide</option>
                            <option value="question">Question / Quiz Slide</option>
                            <option value="grammar">Grammar Rule Slide</option>
                            <option value="discussion">Speaking / Discussion Slide</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updatedSlides = editingDeck.slides.filter((_, i) => i !== idx);
                            setEditingDeck({ ...editingDeck, slides: updatedSlides });
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {s.type === 'vocab' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <input
                            type="text"
                            placeholder="Word (e.g. Apple)"
                            value={s.word || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, word: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Phonetic (e.g. /ˈæp.əl/)"
                            value={s.phonetic || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, phonetic: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                          <input
                            type="text"
                            placeholder="Definition"
                            value={s.definition || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, definition: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="p-2 sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                      )}

                      {s.type === 'question' && (
                        <div className="space-y-2 text-xs">
                          <input
                            type="text"
                            placeholder="Question Prompt"
                            value={s.questionText || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, questionText: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            {s.options?.map((opt, oIdx) => (
                              <input
                                key={oIdx}
                                type="text"
                                placeholder={`Option ${oIdx + 1}`}
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...(s.options || [])];
                                  opts[oIdx] = e.target.value;
                                  const updated = [...editingDeck.slides];
                                  updated[idx] = { ...s, options: opts };
                                  setEditingDeck({ ...editingDeck, slides: updated });
                                }}
                                className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {s.type === 'title' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <input
                            type="text"
                            placeholder="Slide Title"
                            value={s.title || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, title: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Subtitle / Lesson Goal"
                            value={s.subtitle || ''}
                            onChange={(e) => {
                              const updated = [...editingDeck.slides];
                              updated[idx] = { ...s, subtitle: e.target.value };
                              setEditingDeck({ ...editingDeck, slides: updated });
                            }}
                            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingDeck(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isAdmin) return;
                  const savedDeck = { ...editingDeck, updatedAt: Date.now() };
                  setDeletedDeckIds((prev) => prev.filter((id) => id !== savedDeck.id));
                  setDecks((prev) => {
                    const idx = prev.findIndex((d) => d.id === savedDeck.id);
                    if (idx >= 0) {
                      const updated = [...prev];
                      updated[idx] = savedDeck;
                      return updated;
                    }
                    return [savedDeck, ...prev];
                  });
                  saveDeckToCloud(savedDeck);
                  triggerToast('Slide deck saved successfully!');
                  setEditingDeck(null);
                }}
                className="px-6 py-2.5 rounded-xl bg-brand-purple text-white text-xs font-black shadow-md hover:bg-purple-700 transition-colors cursor-pointer"
              >
                Save Deck
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Slide Deck & QR Code Modal (hamsterenglish.online) */}
      {deckForShareQr && (
        <div className="fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 text-left">
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-brand-purple flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                    Share Slide Deck & QR
                  </h3>
                  <p className="text-[11px] text-slate-400">hamsterenglish.online</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeckForShareQr(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h4 className="text-base font-black text-slate-900 dark:text-white line-clamp-1">
                {deckForShareQr.title}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {deckForShareQr.curriculum || deckForShareQr.gradeLevel} · {deckForShareQr.slides.length} Slides
              </p>
            </div>

            <div className="p-4 bg-white rounded-2xl border-2 border-purple-200 shadow-inner inline-flex mx-auto">
              <QRCodeSVG
                value={`https://hamsterenglish.online/?slideId=${encodeURIComponent(deckForShareQr.id)}`}
                size={180}
                level="H"
                includeMargin={false}
              />
            </div>

            <div className="text-xs font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl flex items-center justify-between gap-2 overflow-hidden border border-slate-200 dark:border-slate-700">
              <span className="truncate">
                https://hamsterenglish.online/?slideId={deckForShareQr.id}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `https://hamsterenglish.online/?slideId=${encodeURIComponent(deckForShareQr.id)}`
                  );
                  setCopiedSlideLink(true);
                  setTimeout(() => setCopiedSlideLink(false), 2000);
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-brand-purple text-white font-bold text-xs flex items-center gap-1 hover:bg-purple-700 cursor-pointer"
              >
                {copiedSlideLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSlideLink ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const target = deckForShareQr;
                  setDeckForShareQr(null);
                  setDeckForHomework(convertSlideDeckToHomeworkObject(target));
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Send as Homework (PIN & Grading)</span>
              </button>
              <button
                type="button"
                onClick={() => setDeckForShareQr(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Homework Modal for Slide Decks */}
      <CreateHomeworkModal
        isOpen={Boolean(deckForHomework)}
        game={deckForHomework}
        onClose={() => setDeckForHomework(null)}
        onCreated={() => {
          triggerToast('Slide deck assigned as homework on hamsterenglish.online!');
        }}
        onNavigateToHomework={() => {
          setDeckForHomework(null);
          onViewChange('homework');
        }}
      />
    </div>
  );
}
