import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";

import { MediaPickerModal } from "../components/MediaPickerModal";
import {
  Plus,
  Trash2,
  Sparkles,
  Save,
  X,
  ArrowLeft,
  Maximize,
  Minimize,
  ClipboardList,
  Info,
  Copy,
  Image as ImageIcon,
  Settings,
  User,
  Pencil,
  Shuffle,
  Camera,
  CameraOff,
  Type,
  Users,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { playSound } from '../lib/audio';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";

export interface Question {
  id: number | string;
  text: string;
  options: string[];
  answerIndex: number;
  optionImages?: (string | null)[];
  image?: string;
  imageUrl?: string;
}

export interface Quiz {
  id: number | string;
  title: string;
  subject: string;
  topic?: string;
  classLevel?: string;
  questions: Question[];
  thumbnail: string;
  isFavorite?: boolean;
  folderId?: string;
  isPublic?: boolean;
}

export const isImageUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) return true;
  if (/^https?:\/\/.+/i.test(trimmed)) {
    if (/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i.test(trimmed)) return true;
    if (trimmed.includes('giphy.com') || trimmed.includes('unsplash.com') || trimmed.includes('googleusercontent.com') || trimmed.includes('drive.google.com/thumbnail')) return true;
    if (trimmed.includes('images.') || trimmed.includes('/images/') || trimmed.includes('/img/') || trimmed.includes('/photos/')) return true;
    if (!trimmed.includes(' ') && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) return true;
  }
  return false;
};

export interface StandingPoseConfig {
  id: string;
  type: 'emoji';
  value: string;
  name: string;
  shortHint: string;
}

// Practical, standing-only poses suitable for both Studio Mode and AI Camera Pose Detection
export const AVAILABLE_POSES: StandingPoseConfig[] = [
  { id: 'peace', type: 'emoji', value: '✌️', name: 'Peace Sign', shortHint: 'Hold up a V peace sign' },
  { id: 'hands-up', type: 'emoji', value: '🙌', name: 'Hands Up', shortHint: 'Raise both hands high' },
  { id: 'cross-arms', type: 'emoji', value: '🙅', name: 'Cross Arms', shortHint: 'Cross arms over chest' },
  { id: 'bunny', type: 'emoji', value: '🐰', name: 'Bunny Pose', shortHint: 'Two bunny ears above head' },
  { id: 'thumbs-up', type: 'emoji', value: '👍', name: 'Thumbs Up', shortHint: 'Show a thumbs up' },
  { id: 'namaste', type: 'emoji', value: '🙏', name: 'Namaste Hands', shortHint: 'Press palms together at chest' },
  { id: 'overhead-crown', type: 'emoji', value: '🙆', name: 'Overhead Arch', shortHint: 'Curve both hands above head' },
  { id: 'star-hands', type: 'emoji', value: '🖐️', name: 'Open Star', shortHint: 'Spread all 5 fingers wide' },
  { id: 'point-up', type: 'emoji', value: '☝️', name: 'Sky Point', shortHint: 'Point index finger straight up' },
  { id: 'rock-on', type: 'emoji', value: '🤘', name: 'Rock Pose', shortHint: 'Raise index & pinky fingers' },
  { id: 'power-fist', type: 'emoji', value: '💪', name: 'Power Flex', shortHint: 'Hold up a strong flexed fist' },
  { id: 'ok-pose', type: 'emoji', value: '👌', name: 'OK Ring', shortHint: 'Touch thumb & index in a circle' },
];

/**
 * Illustrated Standing Character SVG for each standing pose.
 * Shows a friendly standing figure performing the exact pose so players can copy it visually
 * without needing any text title on the option card.
 */
function StandingPoseFigure({
  poseId,
  emoji,
  size = 'md'
}: {
  poseId: string;
  emoji: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dimClass =
    size === 'sm'
      ? 'w-14 h-14 sm:w-16 sm:h-16'
      : size === 'lg'
      ? 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32'
      : 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28';

  return (
    <div className={`relative flex items-center justify-center select-none ${dimClass}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-sm overflow-visible">
        <defs>
          <linearGradient id={`shirt-${poseId}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
          <linearGradient id={`skin-${poseId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
        </defs>

        {/* Soft floor shadow */}
        <ellipse cx="60" cy="112" rx="26" ry="5" fill="rgba(13, 148, 136, 0.18)" />

        {/* Standing Legs (Always standing, never sitting!) */}
        <path
          d="M50 82 L47 108 M70 82 L73 108"
          stroke="#1e293b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Shoes */}
        <ellipse cx="45" cy="109" rx="7" ry="4" fill="#0f766e" />
        <ellipse cx="75" cy="109" rx="7" ry="4" fill="#0f766e" />

        {/* Standing Torso */}
        <rect x="42" y="48" width="36" height="37" rx="14" fill={`url(#shirt-${poseId})`} stroke="#0f766e" strokeWidth="2.5" />
        {/* Belt/Waistband */}
        <rect x="43" y="76" width="34" height="6" rx="3" fill="#0f172a" opacity="0.25" />

        {/* Head */}
        <circle cx="60" cy="30" r="15" fill={`url(#skin-${poseId})`} stroke="#d97706" strokeWidth="2" />
        {/* Energetic Headband */}
        <path d="M45 25 Q60 20 75 25" stroke="#f43f5e" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        {/* Eyes & Smile */}
        <circle cx="55" cy="30" r="2" fill="#1e293b" />
        <circle cx="65" cy="30" r="2" fill="#1e293b" />
        <path d="M55 36 Q60 40 65 36" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Pose-Specific Arms & Hands */}
        {poseId === 'hands-up' && (
          <g>
            <path d="M44 55 Q30 35 34 14" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" fill="none" />
            <path d="M76 55 Q90 35 86 14" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" fill="none" />
            <circle cx="34" cy="12" r="6" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="86" cy="12" r="6" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'bunny' && (
          <g>
            <path d="M44 54 Q34 32 48 14" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M76 54 Q86 32 72 14" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            {/* Bunny V-fingers */}
            <path d="M46 14 L43 3 M49 14 L51 3" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M71 14 L69 3 M74 14 L77 3" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="48" cy="14" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="72" cy="14" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'cross-arms' && (
          <g>
            <path d="M43 54 L74 70" stroke="#0d9488" strokeWidth="8.5" strokeLinecap="round" />
            <path d="M77 54 L46 70" stroke="#14b8a6" strokeWidth="8.5" strokeLinecap="round" />
            <circle cx="75" cy="70" r="5.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="45" cy="70" r="5.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'overhead-crown' && (
          <g>
            <path d="M44 54 Q26 26 55 8" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <path d="M76 54 Q94 26 65 8" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" fill="none" />
            <circle cx="56" cy="8" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="64" cy="8" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'namaste' && (
          <g>
            <path d="M44 54 L34 66 L56 60" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M76 54 L86 66 L64 60" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M58 50 L60 64 L62 50 Z" fill="#fcd34d" stroke="#d97706" strokeWidth="2" />
          </g>
        )}

        {poseId === 'peace' && (
          <g>
            <path d="M44 56 L34 74" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="34" cy="76" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <path d="M76 56 L92 38" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M90 36 L86 22 M94 36 L100 23" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="92" cy="37" r="5.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'thumbs-up' && (
          <g>
            <path d="M44 56 L34 74" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="34" cy="76" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <path d="M76 56 L94 52" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M94 50 L94 37" stroke="#d97706" strokeWidth="4" strokeLinecap="round" />
            <circle cx="94" cy="52" r="6" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'star-hands' && (
          <g>
            <path d="M44 56 L24 44" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M76 56 L96 44" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="22" cy="42" r="6" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <circle cx="98" cy="42" r="6" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'point-up' && (
          <g>
            <path d="M44 56 L34 74" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="34" cy="76" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <path d="M76 54 L90 28" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M90 26 L90 12" stroke="#d97706" strokeWidth="3.8" strokeLinecap="round" />
            <circle cx="90" cy="27" r="5.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'rock-on' && (
          <g>
            <path d="M44 56 L34 74" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="34" cy="76" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <path d="M76 56 L92 38" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <path d="M88 36 L85 22 M96 36 L100 22" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="92" cy="37" r="5.5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
          </g>
        )}

        {poseId === 'power-fist' && (
          <g>
            <path d="M44 56 L26 56 L28 36" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M76 56 L94 56 L92 36" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <circle cx="28" cy="34" r="6.5" fill="#fcd34d" stroke="#d97706" strokeWidth="2" />
            <circle cx="92" cy="34" r="6.5" fill="#fcd34d" stroke="#d97706" strokeWidth="2" />
          </g>
        )}

        {poseId === 'ok-pose' && (
          <g>
            <path d="M44 56 L34 74" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="34" cy="76" r="5" fill="#fcd34d" stroke="#d97706" strokeWidth="1.5" />
            <path d="M76 56 L92 42" stroke="#14b8a6" strokeWidth="7.5" strokeLinecap="round" />
            <circle cx="94" cy="38" r="6" fill="none" stroke="#d97706" strokeWidth="3" />
          </g>
        )}
      </svg>

      {/* Prominent Gesture Badge */}
      <div className="absolute -bottom-1 -right-1 bg-white rounded-full w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center shadow-md border-2 border-teal-300 text-xl sm:text-2xl leading-none">
        {emoji}
      </div>
    </div>
  );
}

/**
 * Evaluates which standing pose a player is performing based on MediaPipe Hand landmarks in their zone.
 * Works for 1-hand and 2-hand standing poses and prioritizes matching against the active option poses on screen.
 */
function detectStandingPoseFromHands(
  hands: Array<Array<{ x: number; y: number; z?: number }>>,
  candidatePoseIds: string[]
): { poseId: string | null; confidence: number } {
  if (!hands || hands.length === 0) {
    return { poseId: null, confidence: 0 };
  }

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const analyzeSingleHand = (lm: Array<{ x: number; y: number }>) => {
    const wrist = lm[0];
    const indexExtended = lm[8].y < lm[6].y - 0.015 && dist(lm[8], wrist) > dist(lm[6], wrist) * 1.1;
    const middleExtended = lm[12].y < lm[10].y - 0.015 && dist(lm[12], wrist) > dist(lm[10], wrist) * 1.1;
    const ringExtended = lm[16].y < lm[14].y - 0.015 && dist(lm[16], wrist) > dist(lm[14], wrist) * 1.08;
    const pinkyExtended = lm[20].y < lm[18].y - 0.015 && dist(lm[20], wrist) > dist(lm[18], wrist) * 1.08;

    const thumbSpread = dist(lm[4], lm[17]) > dist(lm[2], lm[17]) * 1.18;
    const thumbUp =
      lm[4].y < lm[3].y - 0.012 &&
      lm[3].y < lm[2].y &&
      lm[4].y < lm[5].y - 0.01 &&
      !indexExtended &&
      !middleExtended &&
      !ringExtended &&
      !pinkyExtended;

    const pinchDist = dist(lm[4], lm[8]);
    const isOkPinch = pinchDist < 0.075 && (middleExtended || ringExtended || pinkyExtended);

    const openCount =
      (indexExtended ? 1 : 0) +
      (middleExtended ? 1 : 0) +
      (ringExtended ? 1 : 0) +
      (pinkyExtended ? 1 : 0);

    const forearmHorizontal = Math.abs(lm[9].x - lm[0].x) > Math.abs(lm[9].y - lm[0].y) * 0.55;

    return {
      wrist,
      tipCenter: lm[9],
      indexTip: lm[8],
      middleTip: lm[12],
      indexExtended,
      middleExtended,
      ringExtended,
      pinkyExtended,
      thumbSpread,
      thumbUp,
      isOkPinch,
      openCount,
      forearmHorizontal,
    };
  };

  const analyzed = hands.map(analyzeSingleHand);
  const scores: Record<string, number> = {};

  // Score each pose
  // 1. Two-hand poses first when 2 hands are visible in the player's zone
  if (analyzed.length >= 2) {
    const [h1, h2] = analyzed;
    const avgY = (h1.wrist.y + h2.wrist.y) / 2;
    const wristDistX = Math.abs(h1.wrist.x - h2.wrist.x);
    const tipDistX = Math.abs(h1.indexTip.x - h2.indexTip.x);

    // Bunny Pose: 2 hands raised high with V-fingers or 1-2 fingers up
    if (
      avgY < 0.55 &&
      h1.indexExtended &&
      h1.middleExtended &&
      !h1.ringExtended &&
      h2.indexExtended &&
      h2.middleExtended &&
      !h2.ringExtended
    ) {
      scores['bunny'] = 0.96;
    } else if (avgY < 0.42 && h1.openCount <= 2 && h2.openCount <= 2 && h1.indexExtended && h2.indexExtended) {
      scores['bunny'] = 0.85;
    }

    // Overhead Arch / Crown: 2 hands high above head with fingertips coming close together
    if (avgY < 0.48 && tipDistX < 0.16 && wristDistX > tipDistX) {
      scores['overhead-crown'] = 0.92;
    }

    // Hands Up: 2 hands raised high with open palms
    if (avgY < 0.52 && h1.openCount >= 3 && h2.openCount >= 3 && tipDistX >= 0.12) {
      scores['hands-up'] = 0.94;
    }

    // Namaste Hands: 2 hands close together at chest level with fingers pointing up
    if (avgY >= 0.35 && wristDistX < 0.14 && tipDistX < 0.11 && (h1.openCount >= 2 || h2.openCount >= 2)) {
      scores['namaste'] = 0.93;
    }

    // Cross Arms: 2 hands in chest region tilted or crossed
    if (
      avgY >= 0.38 &&
      wristDistX < 0.28 &&
      (h1.forearmHorizontal || h2.forearmHorizontal || (h1.openCount === 0 && h2.openCount === 0))
    ) {
      scores['cross-arms'] = 0.89;
    }
  }

  // Single-hand (or either-hand) pose checks
  for (const h of analyzed) {
    // Peace Sign: Index + Middle extended, Ring + Pinky curled
    if (h.indexExtended && h.middleExtended && !h.ringExtended && !h.pinkyExtended) {
      scores['peace'] = Math.max(scores['peace'] || 0, 0.94);
      if (h.wrist.y < 0.42) {
        scores['bunny'] = Math.max(scores['bunny'] || 0, 0.78);
      }
    }

    // Thumbs Up
    if (h.thumbUp) {
      scores['thumbs-up'] = Math.max(scores['thumbs-up'] || 0, 0.95);
    }

    // OK Pose
    if (h.isOkPinch) {
      scores['ok-pose'] = Math.max(scores['ok-pose'] || 0, 0.92);
    }

    // Point Up (Only index extended)
    if (h.indexExtended && !h.middleExtended && !h.ringExtended && !h.pinkyExtended) {
      scores['point-up'] = Math.max(scores['point-up'] || 0, 0.93);
    }

    // Rock On (Index + Pinky extended, Middle + Ring curled)
    if (h.indexExtended && h.pinkyExtended && !h.middleExtended && !h.ringExtended) {
      scores['rock-on'] = Math.max(scores['rock-on'] || 0, 0.94);
    }

    // Open Star (All 5 fingers spread open)
    if (h.openCount === 4 && h.thumbSpread) {
      scores['star-hands'] = Math.max(scores['star-hands'] || 0, 0.90);
      if (h.wrist.y < 0.38) {
        scores['hands-up'] = Math.max(scores['hands-up'] || 0, 0.82);
      }
    }

    // Power Fist (All fingers curled into strong raised fist)
    if (h.openCount === 0 && !h.thumbUp && !h.isOkPinch) {
      if (h.forearmHorizontal) {
        scores['cross-arms'] = Math.max(scores['cross-arms'] || 0, 0.80);
      }
      scores['power-fist'] = Math.max(scores['power-fist'] || 0, 0.86);
    }
  }

  // First look for the highest scoring pose among the currently displayed option poses
  let bestCandidate: string | null = null;
  let bestCandidateScore = 0;

  for (const cid of candidatePoseIds) {
    const s = scores[cid] || 0;
    if (s > bestCandidateScore) {
      bestCandidateScore = s;
      bestCandidate = cid;
    }
  }

  if (bestCandidate && bestCandidateScore >= 0.75) {
    return { poseId: bestCandidate, confidence: bestCandidateScore };
  }

  // Otherwise return top overall detected pose if any
  let bestOverall: string | null = null;
  let bestOverallScore = 0;
  for (const [pid, s] of Object.entries(scores)) {
    if (s > bestOverallScore) {
      bestOverallScore = s;
      bestOverall = pid;
    }
  }

  return { poseId: bestOverall, confidence: bestOverallScore };
}

export function YogaQuiz({ onViewChange, initialGame }: { onViewChange: (view: ViewState, data?: any) => void, initialGame?: any }) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame && (
      (initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
      (initialGame.questions && initialGame.questions.length > 0)
    )
  );
  const [screen, setScreen] = useState<'editor' | 'game'>(initialGame && !initialGame.editMode && hasLoadedQuestions ? 'game' : 'editor');
  const [showModeModal, setShowModeModal] = useState(false);
  
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (initialGame && !initialGame.editMode && hasLoadedQuestions) {
      setScreen('game');
    } else {
      setScreen('editor');
    }
  }, [initialGame, hasLoadedQuestions]);

  useEffect(() => {
    if (user) {
      const fetchFolders = async () => {
        const qFolders = query(collection(db, "gameFolders"), where("userId", "==", user.uid));
        const foldersSnap = await getDocs(qFolders);
        const f: any[] = [];
        foldersSnap.forEach(doc => f.push({ id: doc.id, ...doc.data() }));
        setFolders(f);
      };
      fetchFolders();
    }
  }, [user]);

  const handleSaveQuiz = async (quiz: Quiz) => {
    if (!user) return;
    
    try {
      const gameToSave = {
        name: quiz.title || "Yoga Studio Quiz",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "yoga-quiz",
        customQuestions: quiz.questions,
        userId: user.uid,
        updatedAt: new Date().toISOString(),
        isPublic: quiz.isPublic ?? false,
      };

      if (initialGame?.id) {
        await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), {
          ...gameToSave,
          createdAt: new Date().toISOString(),
        });
      }
      onViewChange("games");
    } catch (error) {
      console.error("Error saving game:", error);
    }
  };

  const getQuizData = (): Quiz => {
    const fallbackQuestions: Question[] = [
      { id: 1, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."], answerIndex: 0 },
      { id: 2, text: "What is the past tense of 'eat'?", options: ["Ate", "Eated", "Eating", "Eats"], answerIndex: 0 },
      { id: 3, text: "Which of these is a fruit?", options: ["Apple", "Carrot", "Potato", "Broccoli"], answerIndex: 0 },
      { id: 4, text: "They ____ to school by bus every day.", options: ["go", "goes", "gone", "going"], answerIndex: 0 },
      { id: 5, text: "Choose the opposite of 'Difficult':", options: ["Easy", "Hard", "Tough", "Heavy"], answerIndex: 0 }
    ];

    if (initialGame && (initialGame.customQuestions || initialGame.questions || initialGame.id)) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : fallbackQuestions);

      const sanitized: Question[] = qList.map((q: any, i: number) => ({
        id: q.id || (i + 1),
        text: q.text || q.question || "",
        options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : ["Option 1", "Option 2"],
        answerIndex: typeof q.answerIndex === 'number' ? q.answerIndex : (typeof q.correctIndex === 'number' ? q.correctIndex : 0),
        optionImages: Array.isArray(q.optionImages) ? q.optionImages : undefined,
        image: q.image || q.imageUrl || undefined,
        imageUrl: q.imageUrl || q.image || undefined,
      }));

      return {
        id: initialGame.id || Date.now(),
        title: initialGame.name || initialGame.title || initialGame.topic || "Yoga Studio Quiz",
        subject: "Vocabulary",
        topic: initialGame.topic || initialGame.name || "",
        classLevel: initialGame.className || initialGame.classLevel || "",
        questions: sanitized,
        thumbnail: "🧘",
        folderId: initialGame.folderId,
        isPublic: initialGame.isPublic,
      };
    }
    return {
      id: Date.now(),
      title: "",
      subject: "Vocabulary",
      topic: "",
      classLevel: "",
      questions: [
        { 
          id: Date.now(), 
          text: "", 
          options: ["", ""], 
          answerIndex: 0, 
          optionImages: [null, null] 
        }
      ],
      thumbnail: "🧘",
      folderId: "",
      isPublic: false
    };
  };

  const currentQuizData = getQuizData();

  if (screen === 'editor') {
    return <QuizEditor quiz={currentQuizData} onSave={handleSaveQuiz} onCancel={() => onViewChange("games")} folders={folders} />;
  }

  return (
    <div id="game-container" className="w-full min-h-full flex-1 bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 text-slate-900 flex flex-col font-sans overflow-hidden relative selection:bg-teal-500/30 rounded-xl">
      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
            animation: fadeIn 0.35s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(20, 184, 166, 0.25); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(20, 184, 166, 0.45); }
      `}</style>

      <YogaGame 
        quiz={currentQuizData} 
        onBack={() => onViewChange("games")} 
        onSwitchMode={() => setShowModeModal(true)}
      />

      {/* Game Mode Selection Modal */}
      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: currentQuizData.id,
          name: currentQuizData.title,
          topic: currentQuizData.topic,
          className: currentQuizData.classLevel,
          gameType: 'yoga-quiz',
          customQuestions: currentQuizData.questions || []
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => {
          onViewChange(mode as ViewState, adaptedData);
        }}
      />
    </div>
  );
}

// --- Editor Component ---

function QuizEditor({ quiz, onSave, onCancel, folders }: { quiz: Quiz, onSave: (q: Quiz) => void, onCancel: () => void, folders: { id: string; name: string }[] }) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [questions, setQuestions] = useState<Question[]>(() => {
    return quiz.questions.map(q => ({
      ...q,
      options: q.options || ["", ""],
      optionImages: q.optionImages || Array(q.options?.length || 2).fill(null)
    }));
  });
  const [errorMsg, setErrorMsg] = useState("");
  
  const [activeMediaPicker, setActiveMediaPicker] = useState<
    | { type: 'option'; qId: number | string; optIndex: number }
    | { type: 'question'; qId: number | string }
    | null
  >(null);

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
      options: item.options || ["", "", "", ""],
      answerIndex: item.answerIndex || 0,
      optionImages: item.optionImages || Array(item.options?.length || 4).fill(null),
      image: item.image,
      imageUrl: item.imageUrl
    }));

    if (action === 'replace') {
      setQuestions(newItems);
    } else {
      setQuestions(prev => {
        if (prev.length === 1 && !prev[0].text.trim() && !prev[0].image) {
          return newItems;
        }
        return [...prev, ...newItems];
      });
    }

    setToastMsg(`✨ Added ${parsed.length} questions!`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
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
        options: item.options || ["", "", "", ""],
        answerIndex: item.answerIndex || 0,
        optionImages: item.optionImages || Array(item.options?.length || 4).fill(null),
        image: item.image,
        imageUrl: item.imageUrl
      }));

      setQuestions(prev => {
        const updated = [...prev];
        const current = updated[index];

        if (current && !current.text.trim() && !current.image) {
          updated.splice(index, 1, ...newItems);
        } else {
          updated.splice(index + 1, 0, ...newItems);
        }
        return updated;
      });

      setToastMsg(`✨ Automatically divided into ${parsedItems.length} questions!`);
      setTimeout(() => setToastMsg(""), 3500);

      setTimeout(() => {
        const targetIdx = index + parsedItems.length - (questions[index]?.text.trim() ? 0 : 1);
        const targetInput = document.getElementById(`question-input-${targetIdx}`);
        targetInput?.focus();
      }, 80);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      id: Date.now(), 
      text: '', 
      options: ['', ''], 
      answerIndex: 0,
      optionImages: [null, null] 
    }]);
  };

  const updateQuestion = (id: number | string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOptionText = (qId: number | string, optIndex: number, textValue: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        newOptions[optIndex] = textValue;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const updateOptionImage = (qId: number | string, optIndex: number, imgUrl: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptionImages = [...(q.optionImages || Array(q.options.length).fill(null))];
        while (newOptionImages.length < q.options.length) newOptionImages.push(null);
        newOptionImages[optIndex] = imgUrl;

        const newOptions = [...q.options];
        if (isImageUrl(newOptions[optIndex])) {
          newOptions[optIndex] = "";
        }
        return { ...q, options: newOptions, optionImages: newOptionImages };
      }
      return q;
    }));
  };

  const removeOptionImage = (qId: number | string, optIndex: number) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const newOptionImages = [...(q.optionImages || [])];
        if (newOptionImages[optIndex]) {
          newOptionImages[optIndex] = null;
        }
        const newOptions = [...q.options];
        if (isImageUrl(newOptions[optIndex])) {
          newOptions[optIndex] = "";
        }
        return { ...q, options: newOptions, optionImages: newOptionImages };
      }
      return q;
    }));
  };

  const updateQuestionImage = (qId: number | string, imgUrl: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        return { ...q, image: imgUrl, imageUrl: imgUrl };
      }
      return q;
    }));
  };

  const removeQuestionImage = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const copy = { ...q };
        delete copy.image;
        delete copy.imageUrl;
        return copy;
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length < 6) {
        const newImgs = q.optionImages ? [...q.optionImages, null] : Array(q.options.length + 1).fill(null);
        return { ...q, options: [...q.options, ''], optionImages: newImgs };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options.length > 2) {
        const newOptions = [...q.options];
        newOptions.pop();
        const newImgs = q.optionImages ? q.optionImages.slice(0, newOptions.length) : undefined;
        const newAnswerIndex = q.answerIndex >= newOptions.length ? newOptions.length - 1 : q.answerIndex;
        return { ...q, options: newOptions, answerIndex: newAnswerIndex, ...(newImgs ? { optionImages: newImgs } : {}) };
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

  const duplicateQuestion = (index: number) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      const qToCopy = prev[index];
      const duplicatedQ: Question = {
        ...qToCopy,
        id: Date.now() + Math.random(),
        options: [...qToCopy.options],
        optionImages: qToCopy.optionImages ? [...qToCopy.optionImages] : undefined,
        image: qToCopy.image,
        imageUrl: qToCopy.imageUrl
      };
      newQuestions.splice(index + 1, 0, duplicatedQ);
      return newQuestions;
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

  const handleSave = () => {
    const validQuestions = questions.filter(q => q.text.trim() || q.image || q.options.some((o, i) => o.trim() || q.optionImages?.[i]));
    if(validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question or picture question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const confirmSave = (isPublic: boolean) => {
    const generatedTitle = topic.trim() ? topic.trim() : "Yoga Studio Quiz";
    const validQuestions = questions.filter(q => q.text.trim() || q.image || q.options.some((o, i) => o.trim() || q.optionImages?.[i]));
    onSave({
      ...quiz,
      title: generatedTitle,
      folderId,
      topic,
      classLevel,
      questions: validQuestions,
      isPublic
    });
    setShowPublishModal(false);
  };

  return (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      <div className="w-full min-h-full flex flex-col items-center py-8 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
        <div className="bg-white dark:bg-slate-800/80 p-8 flex flex-col gap-6 border-b-2 border-teal-500/50">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🧘‍♀️</span>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">YOGA STUDIO SETUP</h2>
                    <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold">Students follow the standing pose of the correct choice in Studio or AI Camera Mode!</p>
                  </div>
                </div>
                <div className="flex gap-3 items-center">
                    <button onClick={onCancel} className="px-4 sm:px-5 py-2.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer text-sm">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-teal-500 text-white font-bold hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/30 cursor-pointer text-sm">
                        <Save size={18} /> Save Quiz
                    </button>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Topic</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Action Verbs, Grammar" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-teal-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Class Level</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Grade 3, Starters, KET" 
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-teal-500 placeholder-slate-400 dark:placeholder-slate-600 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Folder</label>
                    <select 
                      value={folderId}
                      onChange={(e) => setFolderId(e.target.value)}
                      className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white px-4 py-3 rounded-xl focus:border-teal-500 appearance-none cursor-pointer transition-colors"
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

        {toastMsg && (
          <div className="bg-teal-500/20 text-teal-600 dark:text-teal-300 p-3 mx-6 mt-6 rounded-xl font-bold text-center border border-teal-500/30 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center justify-center gap-2 shadow-sm">
            <Sparkles size={18} /> {toastMsg}
          </div>
        )}

        {/* Bulk Paste Modal */}
        {showBulkPasteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col gap-5 transform scale-100 animate-in fade-in zoom-in duration-200 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-500 flex items-center justify-center font-bold">
                    <ClipboardList size={22} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">
                      Bulk Paste & Auto-Divide
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paste numbered questions, option lines, image links, or Excel tabular data.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Paste Text Below (Supports questions with image URLs as options)
                </label>
                <textarea 
                  rows={7}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Example:\n1. Which sentence is correct?\na) She doesn't like apples.\nb) She don't like apples.\nc) She not like apples.\nAnswer: A"}
                  className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-teal-500 transition-colors custom-scrollbar"
                />
              </div>

              {bulkText.trim() && (
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-teal-500 mt-0.5"><Info size={16} /></div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found <span className="font-bold text-slate-800 dark:text-white">{parsePastedQuiz(bulkText).length}</span> items. 
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => handleApplyBulkPaste('replace')}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                >
                  Replace All
                </button>
                <button 
                  onClick={() => handleApplyBulkPaste('append')}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/30 cursor-pointer"
                >
                  Append to End
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
          {/* Smart Tip Bar */}
          <div className="bg-teal-500/10 dark:bg-teal-950/30 border border-teal-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-teal-900 dark:text-teal-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 font-bold">
                <ImageIcon size={18} />
              </div>
              <p className="text-xs sm:text-sm font-medium">
                <span className="font-bold">Picture Options Enabled:</span> Click <span className="text-teal-600 dark:text-teal-300 font-bold">+ Picture</span> on any option to add photos, uploaded images, or GIFs!
              </p>
            </div>
            <button
              onClick={() => setShowBulkPasteModal(true)}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
            >
              <ClipboardList size={14} /> Bulk Paste
            </button>
          </div>

          {questions.map((q, index) => (
            <div key={q.id} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-300 dark:border-slate-700 shadow-sm relative group">
              <button 
                onClick={() => duplicateQuestion(index)}
                title="Duplicate Question"
                className="absolute right-6 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-teal-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
              >
                <Copy size={14} />
              </button>
              <button 
                onClick={() => removeQuestion(q.id)}
                title="Delete Question"
                className="absolute -right-3 -top-3 w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white border-2 border-white dark:border-slate-800 cursor-pointer z-10"
              >
                <Trash2 size={14} />
              </button>
              
              {/* Question Row */}
              <div className="flex gap-3 mb-4 items-start">
                <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 font-bold flex items-center justify-center shrink-0 border border-teal-500/30">
                  {index + 1}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <input 
                      id={`question-input-${index}`}
                      type="text"
                      value={q.text}
                      onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      onPaste={(e) => handlePaste(e, index)}
                      placeholder="Type your question prompt here..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-teal-500 text-slate-800 dark:text-white font-medium text-sm sm:text-base"
                    />
                    <button 
                      type="button"
                      onClick={() => setActiveMediaPicker({ type: 'question', qId: q.id })}
                      className="px-3 py-3 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:hover:bg-teal-900 dark:text-teal-300 rounded-xl flex items-center gap-1.5 text-xs sm:text-sm font-bold border border-teal-200 dark:border-teal-800 transition-all shrink-0 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                      title="Attach picture to this question"
                    >
                      <ImageIcon size={16} />
                      <span className="hidden sm:inline">{q.image ? 'Change Picture' : '+ Clue Picture'}</span>
                    </button>
                  </div>
                  
                  {q.image && (
                    <div className="flex items-center gap-3 bg-teal-50/50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 rounded-xl p-2 w-fit">
                      <img src={q.image} alt="Question Visual" className="w-14 h-14 object-cover rounded-lg border border-teal-200 dark:border-teal-700" />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-teal-900 dark:text-teal-200">Question Clue Picture Attached</span>
                        <button 
                          type="button"
                          onClick={() => removeQuestionImage(q.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Options Grid */}
              <div className="ml-11 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {q.options.map((opt, optIndex) => {
                  const optImg = q.optionImages?.[optIndex] || (isImageUrl(opt) ? opt : null);
                  const optText = isImageUrl(opt) && !q.optionImages?.[optIndex] ? "" : opt;

                  return (
                    <div key={optIndex} className="flex flex-col gap-1.5 p-2 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center gap-2">
                        <input 
                          type="radio" 
                          name={`answer-${q.id}`} 
                          checked={q.answerIndex === optIndex}
                          onChange={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                          className="w-4 h-4 text-teal-500 focus:ring-teal-500 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 cursor-pointer"
                          title="Mark as correct answer"
                        />
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 w-5">
                          {String.fromCharCode(65 + optIndex)}.
                        </span>

                        {optImg ? (
                          <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 rounded-xl p-1.5 pr-2.5 shadow-xs">
                            <div 
                              onClick={() => setActiveMediaPicker({ type: 'option', qId: q.id, optIndex })}
                              className="relative group w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 shrink-0 cursor-pointer hover:border-teal-400 transition-colors"
                              title="Click to change picture"
                            >
                              <img src={optImg} alt="Option Visual" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                                <Pencil size={14} />
                              </div>
                            </div>
                            <input 
                              type="text"
                              value={optText}
                              onChange={(e) => updateOptionText(q.id, optIndex, e.target.value)}
                              placeholder="Label (optional)"
                              className="flex-1 min-w-0 bg-transparent outline-none text-slate-800 dark:text-white text-xs sm:text-sm font-medium"
                            />
                            <button 
                              type="button"
                              onClick={() => setActiveMediaPicker({ type: 'option', qId: q.id, optIndex })}
                              className="p-1.5 text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950 rounded-lg cursor-pointer transition-colors"
                              title="Change Picture"
                            >
                              <ImageIcon size={15} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => removeOptionImage(q.id, optIndex)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg cursor-pointer transition-colors"
                              title="Remove Picture"
                            >
                              <X size={15} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center gap-2">
                            <input 
                              type="text"
                              value={opt}
                              onChange={(e) => updateOptionText(q.id, optIndex, e.target.value)}
                              placeholder={`Option ${optIndex + 1}`}
                              className={`flex-1 min-w-0 bg-white dark:bg-slate-800 border ${
                                q.answerIndex === optIndex 
                                  ? 'border-teal-500/60 bg-teal-50/30 dark:bg-teal-950/20 text-teal-900 dark:text-teal-200 font-bold' 
                                  : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              } rounded-xl px-3 py-2 outline-none focus:border-teal-500 text-xs sm:text-sm font-medium transition-colors`}
                            />
                            <button 
                              type="button"
                              onClick={() => setActiveMediaPicker({ type: 'option', qId: q.id, optIndex })}
                              className="px-2.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:hover:bg-teal-900 dark:text-teal-300 rounded-xl flex items-center gap-1 text-xs font-bold border border-teal-200/80 dark:border-teal-800 transition-all shrink-0 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                              title="Add Picture / Photo / GIF to this option"
                            >
                              <ImageIcon size={14} className="text-teal-600 dark:text-teal-400" />
                              <span className="hidden sm:inline">+ Picture</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="ml-11 mt-3 flex gap-2">
                  <button onClick={() => addOption(q.id)} disabled={q.options.length >= 6} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer font-bold">+ Option</button>
                  <button onClick={() => removeOption(q.id)} disabled={q.options.length <= 2} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 cursor-pointer font-bold">- Option</button>
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
        isOpen={activeMediaPicker !== null}
        onClose={() => setActiveMediaPicker(null)}
        onSelect={(url) => {
          if (!activeMediaPicker) return;
          if (activeMediaPicker.type === 'option') {
            updateOptionImage(activeMediaPicker.qId, activeMediaPicker.optIndex, url);
          } else if (activeMediaPicker.type === 'question') {
            updateQuestionImage(activeMediaPicker.qId, url);
          }
          setActiveMediaPicker(null);
        }}
      />

      {showPublishModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div 
            className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-100 dark:border-slate-700 flex flex-col items-center text-center transform scale-100 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Publish Game?</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this Yoga Studio Quiz to the Community so other teachers can use it?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-4 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer text-lg"
              >
                Yes, Publish (Public)
              </button>
              <button 
                onClick={() => confirmSave(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer text-lg"
              >
                No, Keep Private
              </button>
              <button 
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
        const options = [
          parts[1] || "",
          parts[2] || "",
          parts[3] || "",
          parts[4] || ""
        ];
        const optionImages = options.map(o => isImageUrl(o) ? o : null);
        const cleanOptions = options.map(o => isImageUrl(o) ? "" : o);

        items.push({
          text: parts[0],
          options: cleanOptions,
          optionImages: optionImages,
          answerIndex: 0
        });
      }
    });
    if (items.length > 0) return items;
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
          currentQ = { text: "Question", options: ["", "", "", ""], optionImages: [null, null, null, null], answerIndex: 0 };
          items.push(currentQ);
       }
       
       const optText = optMatch[2].trim();
       const prefix = optMatch[1].toUpperCase();
       let expectedIndex = -1;
       if (/[A-E]/.test(prefix)) expectedIndex = prefix.charCodeAt(0) - 65;
       else if (/[1-4]/.test(prefix)) expectedIndex = parseInt(prefix) - 1;
       
       if (!currentQ.optionImages) {
         currentQ.optionImages = [null, null, null, null];
       }

       const isImg = isImageUrl(optText);
       if (expectedIndex >= 0 && expectedIndex < 4) {
           currentQ.options![expectedIndex] = isImg ? "" : optText;
           if (isImg) currentQ.optionImages[expectedIndex] = optText;
       } else {
           const emptyIdx = currentQ.options!.findIndex((o, idx) => o === "" && !currentQ?.optionImages?.[idx]);
           if (emptyIdx !== -1) {
             currentQ.options![emptyIdx] = isImg ? "" : optText;
             if (isImg) currentQ.optionImages[emptyIdx] = optText;
           }
       }
       
       if (inlineAnswerIndex !== -1) {
           currentQ.answerIndex = inlineAnswerIndex;
       }
    } else {
       const hasOptions = currentQ && currentQ.options!.some((o, idx) => o !== "" || Boolean(currentQ?.optionImages?.[idx]));
       const qText = line.replace(/^(?:\d+[\.\)\:\-]|\[\d+\])\s+/, "");
       
       if (!currentQ || hasOptions) {
           currentQ = { text: qText, options: ["", "", "", ""], optionImages: [null, null, null, null], answerIndex: 0 };
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

  return items;
}

// --- Main Yoga Studio Gameplay Component (Studio Mode + Split-Screen AI Camera Pose Mode) ---

interface PlayerCameraDetectionState {
  detectedPoseId: string | null;
  matchedOptionIdx: number | null;
  holdProgress: number; // 0 to 100
  wrongFeedbackText: string | null;
}

function YogaGame({ quiz, onBack, onSwitchMode }: { quiz: Quiz, onBack: () => void, onSwitchMode?: () => void }) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'end'>('start');
  const [playMode, setPlayMode] = useState<'studio' | 'camera'>('camera');

  const [activePoses, setActivePoses] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('yogaActiveStandingPoses_v5');
      if (saved) {
        const parsed = JSON.parse(saved);
        const validPoses = parsed.filter((p: string) => AVAILABLE_POSES.some(ap => ap.value === p));
        if (validPoses.length >= 4) return validPoses;
      }
    } catch (e) {}
    return AVAILABLE_POSES.map(p => p.value);
  });

  useEffect(() => {
    localStorage.setItem('yogaActiveStandingPoses_v5', JSON.stringify(activePoses));
  }, [activePoses]);

  const togglePose = (val: string) => {
    setActivePoses(prev => {
      if (prev.includes(val)) {
        if (prev.length <= 4) return prev; // Keep at least 4 poses so 4 options always have distinct poses
        return prev.filter(p => p !== val);
      }
      return [...prev, val];
    });
  };

  const [showSettings, setShowSettings] = useState(false);
  const [uiScale, setUiScale] = useState<'small' | 'medium' | 'big'>('medium');
  const [showFontPopover, setShowFontPopover] = useState(false);
  const [autoAdvanceDelay, setAutoAdvanceDelay] = useState<'manual' | 3 | 5 | 10>(3);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [teams, setTeams] = useState([
    { id: '1', name: 'Player 1', score: 0, colorIdx: 0 },
    { id: '2', name: 'Player 2', score: 0, colorIdx: 1 },
  ]);

  const teamColors = [
    { bg: 'bg-blue-500', border: 'border-blue-600', borderLight: 'border-blue-200', text: 'text-blue-600', hex: '#3b82f6' },
    { bg: 'bg-rose-500', border: 'border-rose-600', borderLight: 'border-rose-200', text: 'text-rose-600', hex: '#f43f5e' },
    { bg: 'bg-emerald-500', border: 'border-emerald-600', borderLight: 'border-emerald-200', text: 'text-emerald-600', hex: '#10b981' },
    { bg: 'bg-purple-500', border: 'border-purple-600', borderLight: 'border-purple-200', text: 'text-purple-600', hex: '#a855f7' },
    { bg: 'bg-amber-500', border: 'border-amber-600', borderLight: 'border-amber-200', text: 'text-amber-600', hex: '#f59e0b' },
    { bg: 'bg-cyan-500', border: 'border-cyan-600', borderLight: 'border-cyan-200', text: 'text-cyan-600', hex: '#06b6d4' }
  ];

  const addTeam = () => {
    const newId = Date.now().toString();
    setTeams([...teams, { id: newId, name: `Player ${teams.length + 1}`, score: 0, colorIdx: teams.length % teamColors.length }]);
  };

  const removeTeam = (id: string) => {
    if (teams.length <= 1) return;
    setTeams(teams.filter(t => t.id !== id));
  };

  const setPlayerPreset = (count: 1 | 2) => {
    if (count === 1) {
      setTeams([{ id: '1', name: teams[0]?.name || 'Player 1', score: 0, colorIdx: 0 }]);
    } else {
      setTeams([
        { id: '1', name: teams[0]?.name || 'Player 1', score: 0, colorIdx: 0 },
        { id: '2', name: teams[1]?.name || 'Player 2', score: 0, colorIdx: 1 },
      ]);
    }
  };

  const updateTeamScore = (id: string, delta: number) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, score: Math.max(0, t.score + delta) } : t));
  };

  const [isAnswering, setIsAnswering] = useState(false);
  const [roundWinnerBanner, setRoundWinnerBanner] = useState<string | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<{
    text: string;
    image?: string;
    isCorrect: boolean;
    poseId: string;
    poseValue: string;
  }[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  // Camera & MediaPipe Hands State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRunnerRef = useRef<{ stop: () => void } | null>(null);
  const handsInstanceRef = useRef<any>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Per-player live camera pose detection state (Index 0 = Player 1, Index 1 = Player 2)
  const [playerDetections, setPlayerDetections] = useState<[PlayerCameraDetectionState, PlayerCameraDetectionState]>([
    { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
    { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
  ]);

  const holdStateRef = useRef<
    Array<{
      optionIdx: number | null;
      poseId: string | null;
      progress: number;
      cooldownUntil: number;
      wrongBannerUntil: number;
    }>
  >([
    { optionIdx: null, poseId: null, progress: 0, cooldownUntil: 0, wrongBannerUntil: 0 },
    { optionIdx: null, poseId: null, progress: 0, cooldownUntil: 0, wrongBannerUntil: 0 },
  ]);

  // Keep latest state in refs for MediaPipe callback
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;
  const playModeRef = useRef(playMode);
  playModeRef.current = playMode;
  const isAnsweringRef = useRef(isAnswering);
  isAnsweringRef.current = isAnswering;
  const shuffledOptionsRef = useRef(shuffledOptions);
  shuffledOptionsRef.current = shuffledOptions;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const p = document.documentElement.requestFullscreen();
      if (p && p.catch) p.catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  const loadQuestion = useCallback((idx: number) => {
    setIsAnswering(false);
    setSelectedOption(null);
    setRoundWinnerBanner(null);
    holdStateRef.current = [
      { optionIdx: null, poseId: null, progress: 0, cooldownUntil: 0, wrongBannerUntil: 0 },
      { optionIdx: null, poseId: null, progress: 0, cooldownUntil: 0, wrongBannerUntil: 0 },
    ];
    setPlayerDetections([
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
    ]);

    const currentItem = quiz.questions[idx];
    if (!currentItem) return;

    const rawOptions = Array.isArray(currentItem.options) ? currentItem.options : [];
    const optionImages = Array.isArray(currentItem.optionImages) ? currentItem.optionImages : [];

    let validOpts = rawOptions.map((opt: any, i: number) => {
      const raw = typeof opt === 'string' ? opt : '';
      const imgField = optionImages[i];
      const image = isImageUrl(imgField) ? imgField : (isImageUrl(raw) ? raw : undefined);
      const displayText = isImageUrl(raw) && !imgField ? "" : raw;

      return {
        originalIndex: i,
        text: displayText,
        image: image,
        hasContent: Boolean(displayText.trim() || image)
      };
    }).filter(o => o.hasContent);

    if (validOpts.length < 2) {
      validOpts = [
        { originalIndex: 0, text: "Yes", image: undefined, hasContent: true },
        { originalIndex: 1, text: "No", image: undefined, hasContent: true }
      ];
    }

    const correctIndex = typeof currentItem.answerIndex === 'number' ? currentItem.answerIndex : 0;

    // Pick distinct active standing poses for each option on this question
    const availablePool = AVAILABLE_POSES.filter(p => activePoses.includes(p.value));
    const pool = availablePool.length >= validOpts.length ? [...availablePool] : [...AVAILABLE_POSES];
    // Shuffle pose pool for variety across questions
    pool.sort(() => Math.random() - 0.5);

    let opts = validOpts.map((opt) => ({
      text: opt.text,
      image: opt.image,
      isCorrect: opt.originalIndex === correctIndex,
    }));

    // Shuffle option order
    opts.sort(() => Math.random() - 0.5);

    setShuffledOptions(
      opts.map((opt, i) => {
        const assignedPose = pool[i % pool.length];
        return {
          ...opt,
          poseId: assignedPose.id,
          poseValue: assignedPose.value,
        };
      })
    );
  }, [quiz.questions, activePoses]);

  const countdownRef = useRef<any>(null);

  const advanceToNextQuestion = useCallback((fromIdx: number) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setTimer(null);
    setShowConfetti(false);
    setRoundWinnerBanner(null);
    const nextIdx = fromIdx + 1;
    if (nextIdx < quiz.questions.length) {
      setCurrentIdx(nextIdx);
      loadQuestion(nextIdx);
    } else {
      setGameState('end');
      playSound('win');
    }
  }, [quiz.questions.length, loadQuestion]);

  const handleAnswer = useCallback((index: number, isCorrect: boolean, winningPlayerIndex?: number) => {
    if (isAnsweringRef.current) return;
    setIsAnswering(true);
    isAnsweringRef.current = true;
    setSelectedOption(index);

    if (isCorrect) {
      playSound('correct');
      setShowConfetti(true);
      if (typeof winningPlayerIndex === 'number' && teamsRef.current[winningPlayerIndex]) {
        const winningTeam = teamsRef.current[winningPlayerIndex];
        setTeams(prev => prev.map((t, idx) => idx === winningPlayerIndex ? { ...t, score: t.score + 1 } : t));
        setRoundWinnerBanner(`🎉 ${winningTeam.name} matched the pose! +1 Point!`);
      } else if (teamsRef.current.length === 1) {
        setTeams(prev => prev.map((t, idx) => idx === 0 ? { ...t, score: t.score + 1 } : t));
        setRoundWinnerBanner(`🎉 Awesome Pose! +1 Point!`);
      } else {
        setRoundWinnerBanner(`🎉 Correct Pose!`);
      }
    } else {
      playSound('incorrect');
      setRoundWinnerBanner(`❌ Not quite! Look at the green pose!`);
    }

    if (autoAdvanceDelay === 'manual') {
      return;
    }

    let timeLeft = autoAdvanceDelay;
    setTimer(timeLeft);

    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft > 0) {
        setTimer(timeLeft);
      } else {
        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = null;
        advanceToNextQuestion(currentIdx);
      }
    }, 1000);
  }, [autoAdvanceDelay, currentIdx, advanceToNextQuestion]);

  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;

  const stopCamera = useCallback(() => {
    if (cameraRunnerRef.current) {
      cameraRunnerRef.current.stop();
      cameraRunnerRef.current = null;
    }
    if (handsInstanceRef.current && handsInstanceRef.current.close) {
      try {
        handsInstanceRef.current.close();
      } catch (e) {}
      handsInstanceRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();

      const win = window as any;
      if (!win.Hands) {
        setCameraError("Camera AI module is still loading. Please try again in a moment.");
        return;
      }

      const hands = new win.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 4,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      hands.onResults((results: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cw = canvas.width;
        const ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        const isTwoPlayers = teamsRef.current.length >= 2;
        const rawLandmarks: Array<Array<{ x: number; y: number; z?: number }>> =
          results.multiHandLandmarks || [];

        // Convert to mirrored screen coordinates (x: 0..1 from left to right on mirrored screen)
        const mirroredHands = rawLandmarks.map(lm =>
          lm.map(pt => ({
            x: 1.0 - pt.x,
            y: pt.y,
            z: pt.z
          }))
        );

        // Draw hand skeletons on the overlay canvas
        const connections = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [0, 9], [9, 10], [10, 11], [11, 12],
          [0, 13], [13, 14], [14, 15], [15, 16],
          [0, 17], [17, 18], [18, 19], [19, 20],
          [5, 9], [9, 13], [13, 17]
        ];

        mirroredHands.forEach(hand => {
          const wristX = hand[0]?.x ?? 0.5;
          const isRightSidePlayer = isTwoPlayers && wristX >= 0.5;
          const strokeColor = isRightSidePlayer ? '#f43f5e' : '#3b82f6';

          ctx.save();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          connections.forEach(([a, b]) => {
            const p1 = hand[a];
            const p2 = hand[b];
            if (p1 && p2) {
              ctx.beginPath();
              ctx.moveTo(p1.x * cw, p1.y * ch);
              ctx.lineTo(p2.x * cw, p2.y * ch);
              ctx.stroke();
            }
          });

          hand.forEach((pt, idx) => {
            ctx.fillStyle = idx % 4 === 0 ? '#ffffff' : strokeColor;
            ctx.beginPath();
            ctx.arc(pt.x * cw, pt.y * ch, idx % 4 === 0 ? 5 : 3.5, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
        });

        if (gameStateRef.current !== 'playing' || playModeRef.current !== 'camera' || isAnsweringRef.current) {
          return;
        }

        const now = performance.now();
        const currentOptions = shuffledOptionsRef.current;
        const candidatePoseIds = currentOptions.map(o => o.poseId);

        // Partition hands into Player 1 (and Player 2 if 2+ players)
        const playerHandGroups: [
          Array<Array<{ x: number; y: number; z?: number }>>,
          Array<Array<{ x: number; y: number; z?: number }>>
        ] = isTwoPlayers
          ? [
              mirroredHands.filter(h => (h[0]?.x ?? 0.5) < 0.5),
              mirroredHands.filter(h => (h[0]?.x ?? 0.5) >= 0.5).map(h =>
                // Normalize x within right-half (0.5..1.0 -> 0..1) so 2-hand distance thresholds remain consistent
                h.map(pt => ({ ...pt, x: (pt.x - 0.5) * 2 }))
              ),
            ]
          : [mirroredHands, []];

        // Normalize left-half x when in 2-player mode as well
        if (isTwoPlayers) {
          playerHandGroups[0] = playerHandGroups[0].map(h =>
            h.map(pt => ({ ...pt, x: pt.x * 2 }))
          );
        }

        const numActiveZones = isTwoPlayers ? 2 : 1;
        const nextUiStates: [PlayerCameraDetectionState, PlayerCameraDetectionState] = [
          { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
          { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
        ];

        for (let pIdx = 0; pIdx < numActiveZones; pIdx++) {
          const pHold = holdStateRef.current[pIdx];
          if (now < pHold.cooldownUntil) {
            nextUiStates[pIdx] = {
              detectedPoseId: null,
              matchedOptionIdx: null,
              holdProgress: 0,
              wrongFeedbackText: now < pHold.wrongBannerUntil ? 'Wrong pose! Try another pose!' : null,
            };
            continue;
          }

          const { poseId, confidence } = detectStandingPoseFromHands(
            playerHandGroups[pIdx],
            candidatePoseIds
          );

          const matchedIdx = poseId
            ? currentOptions.findIndex(o => o.poseId === poseId)
            : -1;

          if (poseId && matchedIdx !== -1 && confidence >= 0.75) {
            if (pHold.optionIdx === matchedIdx) {
              pHold.progress = Math.min(100, pHold.progress + 9);
            } else {
              pHold.optionIdx = matchedIdx;
              pHold.poseId = poseId;
              pHold.progress = 16;
            }
          } else {
            pHold.progress = Math.max(0, pHold.progress - 12);
            if (pHold.progress === 0) {
              pHold.optionIdx = null;
              pHold.poseId = null;
            }
          }

          nextUiStates[pIdx] = {
            detectedPoseId: poseId,
            matchedOptionIdx: pHold.optionIdx,
            holdProgress: pHold.progress,
            wrongFeedbackText: now < pHold.wrongBannerUntil ? 'Wrong pose! Try another!' : null,
          };

          // Check if player completed holding the pose (100%)
          if (pHold.progress >= 100 && pHold.optionIdx !== null) {
            const chosenOpt = currentOptions[pHold.optionIdx];
            const chosenIdx = pHold.optionIdx;
            pHold.progress = 0;
            pHold.optionIdx = null;

            if (chosenOpt) {
              if (chosenOpt.isCorrect || !isTwoPlayers) {
                // Either correct answer (wins round immediately) or 1-player mode
                handleAnswerRef.current(chosenIdx, chosenOpt.isCorrect, pIdx);
                break;
              } else {
                // In 2-player mode, if a player poses the wrong option, give them brief feedback so they or the other player can try the right pose!
                playSound('incorrect');
                pHold.cooldownUntil = now + 1100;
                pHold.wrongBannerUntil = now + 1400;
                nextUiStates[pIdx].wrongFeedbackText = 'Wrong pose! Try another!';
              }
            }
          }
        }

        setPlayerDetections(nextUiStates);
      });

      handsInstanceRef.current = hands;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 30 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve(null);
          } else {
            resolve(null);
          }
        });
        await videoRef.current.play();

        let active = true;
        let isProcessing = false;
        let lastFrameTime = 0;
        let animId: number | null = null;
        const TARGET_INTERVAL_MS = 38;

        const sendFrames = async (time: number) => {
          if (!active || !videoRef.current) return;
          if (
            videoRef.current.readyState >= 2 &&
            !isProcessing &&
            time - lastFrameTime >= TARGET_INTERVAL_MS
          ) {
            isProcessing = true;
            lastFrameTime = time;
            try {
              await hands.send({ image: videoRef.current });
            } catch (e) {
              // ignore dropped frames
            } finally {
              isProcessing = false;
            }
          }
          if (active) {
            animId = requestAnimationFrame(sendFrames);
          }
        };

        animId = requestAnimationFrame(sendFrames);

        cameraRunnerRef.current = {
          stop: () => {
            active = false;
            if (animId) cancelAnimationFrame(animId);
            stream.getTracks().forEach(t => t.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
          }
        };

        setIsCameraReady(true);
      }
    } catch (err: any) {
      console.error("Yoga camera setup error:", err);
      setCameraError(err?.message || "Camera access unavailable. You can still click choices or retry camera.");
      setIsCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (gameState === 'playing' && playMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [gameState, playMode, startCamera, stopCamera]);

  const startGame = () => {
    setCurrentIdx(0);
    setTeams(teams.map(t => ({ ...t, score: 0 })));
    setGameState('playing');
    loadQuestion(0);
  };

  const handleNextClick = () => {
    if (!isAnswering) return;
    advanceToNextQuestion(currentIdx);
  };

  // Automatic question & option text sizing based on text length + manual font size selector (small / medium / big)
  const currentQuestionText = quiz.questions[currentIdx]?.text || '';
  const getQuestionFontSizeClass = (text: string) => {
    const len = text.length;
    if (uiScale === 'small') {
      if (len > 90) return 'text-sm sm:text-base md:text-lg';
      if (len > 50) return 'text-base sm:text-lg md:text-xl';
      return 'text-lg sm:text-xl md:text-2xl';
    }
    if (uiScale === 'big') {
      if (len > 90) return 'text-lg sm:text-2xl md:text-3xl';
      if (len > 50) return 'text-xl sm:text-3xl md:text-4xl';
      return 'text-2xl sm:text-4xl md:text-5xl';
    }
    // medium (auto-scaled)
    if (len > 90) return 'text-base sm:text-lg md:text-2xl';
    if (len > 50) return 'text-lg sm:text-2xl md:text-3xl';
    return 'text-xl sm:text-3xl md:text-4xl';
  };

  const getOptionFontSizeClass = (text: string, isMany: boolean) => {
    const len = text.length;
    if (uiScale === 'small') {
      if (len > 45 || isMany) return 'text-xs sm:text-sm md:text-base';
      return 'text-sm sm:text-base md:text-lg';
    }
    if (uiScale === 'big') {
      if (len > 45 || isMany) return 'text-base sm:text-xl md:text-2xl';
      if (len > 22) return 'text-lg sm:text-2xl md:text-3xl';
      return 'text-xl sm:text-3xl md:text-4xl';
    }
    // medium (auto-scaled)
    if (len > 45 || isMany) return 'text-xs sm:text-base md:text-xl';
    if (len > 22) return 'text-sm sm:text-lg md:text-2xl';
    return 'text-base sm:text-xl md:text-3xl';
  };

  const isTwoPlayerCamera = playMode === 'camera' && teams.length >= 2;

  return (
    <div className={`flex-1 flex items-center justify-center p-2 md:p-4 mx-auto animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-teal-50 w-full h-full max-w-none' : 'w-full max-w-[1440px]'}`}>
      {showConfetti && <Confetti width={width} height={height} numberOfPieces={280} recycle={false} style={{ position: 'fixed', zIndex: 100, top: 0, left: 0 }} />}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-teal-950/50 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 max-w-3xl w-full shadow-2xl relative border-4 border-teal-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 text-rose-400 hover:text-rose-500 transition-colors cursor-pointer">
              <X size={36} strokeWidth={3} />
            </button>
            <h2 className="text-3xl md:text-4xl font-black text-teal-900 mb-6 tracking-tight">⚙️ Yoga Studio Settings</h2>

            <div className="space-y-6">
              {/* Game Mode Selector */}
              <div>
                <label className="block text-teal-800 font-black mb-3 text-lg">Gameplay Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setPlayMode('camera')}
                    className={`p-4 rounded-2xl border-4 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      playMode === 'camera'
                        ? 'bg-teal-500 text-white border-teal-600 shadow-lg'
                        : 'bg-teal-50 text-teal-800 border-teal-100 hover:bg-teal-100'
                    }`}
                  >
                    <Camera size={28} className="shrink-0" />
                    <div>
                      <div className="font-black text-lg">📷 AI Camera Pose Mode</div>
                      <div className={`text-xs font-semibold ${playMode === 'camera' ? 'text-teal-50' : 'text-teal-600'}`}>
                        Players stand & copy the pose! Auto-splits screen for 2 players.
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPlayMode('studio')}
                    className={`p-4 rounded-2xl border-4 text-left transition-all cursor-pointer flex items-center gap-3 ${
                      playMode === 'studio'
                        ? 'bg-teal-500 text-white border-teal-600 shadow-lg'
                        : 'bg-teal-50 text-teal-800 border-teal-100 hover:bg-teal-100'
                    }`}
                  >
                    <Sparkles size={28} className="shrink-0" />
                    <div>
                      <div className="font-black text-lg">🧘 Classic Studio Mode</div>
                      <div className={`text-xs font-semibold ${playMode === 'studio' ? 'text-teal-50' : 'text-teal-600'}`}>
                        Students strike the standing pose, then click the choice card.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Font & Interface Scale */}
              <div>
                <label className="block text-teal-800 font-black mb-3 text-lg">Question & Option Font Size</label>
                <div className="flex gap-3">
                  {(['small', 'medium', 'big'] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => setUiScale(size)}
                      className={`flex-1 py-3 rounded-2xl font-black text-lg capitalize transition-all border-4 shadow-xs cursor-pointer ${
                        uiScale === size
                          ? 'bg-teal-500 text-white border-teal-600 scale-[1.02]'
                          : 'bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100'
                      }`}
                    >
                      {size === 'big' ? 'Large' : size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Standing Poses (Practical Standing Poses Only) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-teal-800 font-black text-lg">
                    Active Standing Poses (Standing Only)
                  </label>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    {activePoses.length} of {AVAILABLE_POSES.length} Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold mb-3">
                  All poses below are practical standing gestures that students can perform standing in front of the camera or whiteboard.
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {AVAILABLE_POSES.map((pose) => {
                    const isSelected = activePoses.includes(pose.value);
                    return (
                      <button
                        key={pose.id}
                        onClick={() => togglePose(pose.value)}
                        title={pose.shortHint}
                        className={`rounded-2xl flex flex-col items-center justify-center border-3 transition-all relative overflow-hidden p-2 cursor-pointer ${
                          isSelected
                            ? 'border-teal-500 bg-teal-50/90 shadow-sm'
                            : 'border-slate-200 bg-slate-50 opacity-55 grayscale hover:grayscale-0 hover:opacity-90'
                        }`}
                      >
                        <StandingPoseFigure poseId={pose.id} emoji={pose.value} size="sm" />
                        <span className="text-[10px] font-black text-teal-900 truncate max-w-full mt-1">
                          {pose.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 bg-teal-500 text-white rounded-full p-0.5">
                            <CheckCircle2 size={12} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auto-advance Delay */}
              <div>
                <label className="block text-teal-800 font-black mb-3 text-lg">Auto-Advance After Answer</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([3, 5, 10, 'manual'] as const).map((delay) => (
                    <button
                      key={delay}
                      onClick={() => setAutoAdvanceDelay(delay)}
                      className={`py-3 rounded-2xl font-black text-base transition-all border-4 shadow-xs cursor-pointer ${
                        autoAdvanceDelay === delay
                          ? 'bg-indigo-500 text-white border-indigo-600'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100'
                      }`}
                    >
                      {delay === 'manual' ? 'Manual (Next)' : `${delay} Seconds`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="mt-8 w-full bg-teal-500 hover:bg-teal-600 text-white font-black text-xl py-4 rounded-2xl shadow-[0_5px_0_#0f766e] active:shadow-none active:translate-y-1 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {isAnswering && autoAdvanceDelay === 'manual' && (
        <div className="absolute bottom-8 left-0 right-0 z-[60] flex justify-center pointer-events-none animate-fade-in">
          <button
            onClick={handleNextClick}
            className="pointer-events-auto bg-indigo-600 hover:bg-indigo-700 text-white text-2xl md:text-3xl font-black py-4 px-12 rounded-full shadow-[0_8px_0_#3730a3] active:shadow-none active:translate-y-2 transition-all animate-bounce cursor-pointer"
          >
            NEXT QUESTION ➡️
          </button>
        </div>
      )}

      {/* Main Yoga Studio Container (No Sumo!) */}
      <div
        className={`w-full overflow-hidden border-4 md:border-8 border-teal-400/90 relative flex flex-col shadow-2xl ${
          isFullscreen ? 'h-full rounded-none border-0' : 'min-h-[82vh] rounded-[2.5rem]'
        }`}
        style={{
          background: 'linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 55%, #fef3c7 100%)'
        }}
      >
        {/* Subtle Yoga Studio Decor & Ambient Light */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-teal-300/25 blur-3xl" />
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-amber-200/50 to-transparent border-t-2 border-amber-300/40" />
        </div>

        {/* LOBBY / START SCREEN */}
        {gameState === 'start' && (
          <div className="flex flex-col h-full flex-grow relative overflow-y-auto items-center justify-center p-4 md:p-8 z-10">
            <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] w-full max-w-3xl shadow-2xl relative flex flex-col items-center p-6 sm:p-8 md:p-10 border-4 border-teal-300">
              {onSwitchMode && (
                <button
                  onClick={onSwitchMode}
                  className="absolute top-5 left-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black py-2 px-4 rounded-2xl flex items-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer text-xs sm:text-sm uppercase tracking-wide"
                  title="Choose another game mode"
                >
                  <Shuffle size={16} className="text-amber-300" />
                  <span>Switch Game</span>
                </button>
              )}
              <button onClick={onBack} className="absolute top-5 right-6 text-rose-400 hover:text-rose-500 transition-colors cursor-pointer">
                <X size={40} strokeWidth={3.5} />
              </button>

              {/* Standing Pose Preview Strip */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 mt-6 mb-3 bg-teal-50/90 px-5 py-3 rounded-3xl border-2 border-teal-200 shadow-inner">
                <StandingPoseFigure poseId="peace" emoji="✌️" size="sm" />
                <StandingPoseFigure poseId="hands-up" emoji="🙌" size="sm" />
                <StandingPoseFigure poseId="cross-arms" emoji="🙅" size="sm" />
                <StandingPoseFigure poseId="bunny" emoji="🐰" size="sm" />
              </div>

              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl sm:text-4xl">🧘‍♀️</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-teal-950 tracking-tight text-center">
                  Yoga Pose Studio
                </h1>
              </div>
              <p className="text-teal-700 font-bold text-xs sm:text-base mb-6 text-center max-w-lg">
                Stand up and copy the pose of the correct choice!
              </p>

              {/* Mode Patch Selector: Camera Mode vs Studio Mode */}
              <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setPlayMode('camera')}
                  className={`p-4 rounded-2xl border-4 text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                    playMode === 'camera'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-teal-600 shadow-lg scale-[1.02]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${playMode === 'camera' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-600'}`}>
                    <Camera size={26} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-base sm:text-lg">Camera Pose Mode</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${playMode === 'camera' ? 'bg-amber-300 text-slate-900' : 'bg-teal-100 text-teal-800'}`}>
                        NEW
                      </span>
                    </div>
                    <p className={`text-xs font-semibold leading-snug mt-0.5 ${playMode === 'camera' ? 'text-teal-50' : 'text-slate-500'}`}>
                      AI webcam detects which standing pose each player acts! Splits screen for 2 players.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setPlayMode('studio')}
                  className={`p-4 rounded-2xl border-4 text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                    playMode === 'studio'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-teal-600 shadow-lg scale-[1.02]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${playMode === 'studio' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-600'}`}>
                    <Sparkles size={26} />
                  </div>
                  <div>
                    <div className="font-black text-base sm:text-lg">Classic Studio Mode</div>
                    <p className={`text-xs font-semibold leading-snug mt-0.5 ${playMode === 'studio' ? 'text-teal-50' : 'text-slate-500'}`}>
                      Follow the standing pose together in class and click the matching answer card.
                    </p>
                  </div>
                </button>
              </div>

              {/* Players Setup */}
              <div className="w-full max-w-xl bg-teal-50/70 rounded-3xl p-4 sm:p-5 border-2 border-teal-200/80 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-teal-900 font-black text-base sm:text-lg">
                    <Users className="text-teal-600" size={22} />
                    <span>Players ({teams.length})</span>
                    {playMode === 'camera' && teams.length >= 2 && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                        2-Player Split Camera Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPlayerPreset(1)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer transition-all ${
                        teams.length === 1
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      1 Player
                    </button>
                    <button
                      onClick={() => setPlayerPreset(2)}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer transition-all ${
                        teams.length === 2
                          ? 'bg-teal-600 text-white shadow-xs'
                          : 'bg-white text-teal-700 border border-teal-200 hover:bg-teal-100'
                      }`}
                    >
                      2 Players (Split Screen)
                    </button>
                    {playMode === 'studio' && (
                      <button
                        onClick={addTeam}
                        className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-black text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Plus size={14} /> Add
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {teams.map((team, idx) => (
                    <div key={team.id} className="relative flex items-center">
                      {editingTeamId === team.id ? (
                        <input
                          autoFocus
                          defaultValue={team.name}
                          onBlur={(e) => {
                            const newName = e.target.value.trim();
                            if (newName) {
                              setTeams(teams.map(t => t.id === team.id ? { ...t, name: newName } : t));
                            }
                            setEditingTeamId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                          }}
                          className="bg-white text-teal-800 font-bold py-2 px-4 rounded-full border-2 border-teal-500 focus:outline-none text-sm w-36"
                        />
                      ) : (
                        <div className={`flex items-center gap-1.5 text-white font-bold py-2 px-4 rounded-full shadow-xs text-sm ${teamColors[team.colorIdx].bg}`}>
                          <button
                            onClick={() => setEditingTeamId(team.id)}
                            className="flex items-center gap-1.5 cursor-pointer"
                            title="Click to rename player"
                          >
                            <span>{team.name}</span>
                            {playMode === 'camera' && idx < 2 && (
                              <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full">
                                {idx === 0 ? 'Left Side' : 'Right Side'}
                              </span>
                            )}
                            <Pencil size={13} className="text-yellow-200" />
                          </button>
                          {teams.length > 1 && (
                            <button
                              onClick={() => removeTeam(team.id)}
                              className="ml-1 text-white/80 hover:text-white cursor-pointer"
                              title="Remove player"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full max-w-xl">
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-5 py-5 rounded-3xl bg-teal-100 hover:bg-teal-200 text-teal-800 font-black text-base flex items-center justify-center gap-2 border-2 border-teal-300 cursor-pointer transition-all shrink-0"
                  title="Customize Active Standing Poses"
                >
                  <Settings size={22} />
                  <span className="hidden sm:inline">Poses</span>
                </button>
                <button
                  onClick={startGame}
                  className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-black text-2xl md:text-3xl py-5 rounded-3xl shadow-[0_6px_0_#0f766e] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 cursor-pointer"
                >
                  <span>🚀 START YOGA STUDIO</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PLAYING SCREEN */}
        {gameState === 'playing' && (
          <div className="flex flex-col h-full flex-grow relative animate-fade-in min-h-0 overflow-hidden z-10 justify-between">
            {/* Top Navigation & Controls Bar */}
            <div className="w-full px-3 md:px-5 pt-2.5 pb-1.5 flex flex-wrap justify-between items-center gap-2 z-30 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={onBack}
                  className="px-3.5 py-2 text-teal-900 hover:bg-white rounded-2xl transition-colors font-black cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5"
                >
                  <ArrowLeft size={18} /> Exit
                </button>
                {onSwitchMode && (
                  <button
                    onClick={onSwitchMode}
                    className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl transition-all hover:scale-105 active:scale-95 font-black cursor-pointer shadow-sm text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5"
                    title="Switch Game Mode"
                  >
                    <Shuffle size={15} className="text-amber-300" />
                    <span className="hidden sm:inline">Switch Mode</span>
                  </button>
                )}

                {/* Quick Toggle: Camera Mode vs Studio Mode */}
                <button
                  onClick={() => setPlayMode(prev => prev === 'camera' ? 'studio' : 'camera')}
                  className={`px-3.5 py-2 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-sm border transition-all cursor-pointer ${
                    playMode === 'camera'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white/90 text-teal-900 border-teal-200 hover:bg-white'
                  }`}
                  title="Toggle AI Camera Pose Detection Mode"
                >
                  {playMode === 'camera' ? <Camera size={16} /> : <CameraOff size={16} />}
                  <span>{playMode === 'camera' ? 'Camera Mode: ON' : 'Camera Mode: OFF'}</span>
                </button>
              </div>

              {/* Players / Teams Scoreboard */}
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto max-w-[50vw] px-1">
                {teams.map((team) => {
                  const theme = teamColors[team.colorIdx];
                  return (
                    <div
                      key={team.id}
                      className={`flex items-stretch rounded-2xl shadow-sm border-3 ${theme.border} overflow-hidden shrink-0`}
                    >
                      <button
                        onClick={() => updateTeamScore(team.id, -1)}
                        className={`px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 transition-colors border-r-2 ${theme.borderLight} flex items-center justify-center cursor-pointer`}
                        title="Subtract 1 point"
                      >
                        <span className="font-black text-lg leading-none">-</span>
                      </button>
                      <button
                        onClick={() => updateTeamScore(team.id, 1)}
                        className={`px-3 py-1 font-black text-white ${theme.bg} hover:brightness-110 transition-all flex items-center gap-2 cursor-pointer`}
                        title="Add 1 point"
                      >
                        <span className="text-xs sm:text-sm">{team.name}</span>
                        <span className="bg-white/25 px-2 py-0.5 rounded-lg text-sm sm:text-base leading-none">
                          {team.score}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Right Controls: Progress, Font Size Popover (Small / Medium / Large), Settings, Fullscreen */}
              <div className="flex items-center gap-2 relative">
                <div className="font-bold text-teal-950 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-sm border border-teal-200 text-center flex items-center gap-1">
                  <span className="text-base sm:text-lg font-black">{currentIdx + 1}</span>
                  <span className="text-xs sm:text-sm opacity-70">/ {quiz.questions.length}</span>
                </div>

                {/* Font Size Pop-up Button (Small, Medium, Large) */}
                <div className="relative">
                  <button
                    onClick={() => setShowFontPopover(prev => !prev)}
                    className="w-10 h-10 text-teal-900 hover:bg-white rounded-2xl transition-colors font-black cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 flex items-center justify-center"
                    title="Change Font Size (Small / Medium / Large)"
                  >
                    <Type size={19} />
                  </button>
                  {showFontPopover && (
                    <div className="absolute right-0 mt-2 bg-white rounded-2xl shadow-2xl border-2 border-teal-200 p-2 z-50 flex flex-col gap-1 min-w-[140px] animate-fade-in">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-0.5">
                        Font Size
                      </span>
                      {([
                        { id: 'small', label: 'Small' },
                        { id: 'medium', label: 'Medium' },
                        { id: 'big', label: 'Large' },
                      ] as const).map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setUiScale(item.id);
                            setShowFontPopover(false);
                          }}
                          className={`px-3 py-2 rounded-xl text-left font-black text-xs flex items-center justify-between cursor-pointer transition-colors ${
                            uiScale === item.id
                              ? 'bg-teal-500 text-white'
                              : 'text-slate-700 hover:bg-teal-50'
                          }`}
                        >
                          <span>{item.label}</span>
                          {uiScale === item.id && <span>✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="w-10 h-10 text-teal-900 hover:bg-white rounded-2xl transition-colors font-bold cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 flex items-center justify-center"
                  title="Settings"
                >
                  <Settings size={19} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="w-10 h-10 text-teal-900 hover:bg-white rounded-2xl transition-colors font-bold cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 flex items-center justify-center"
                  title="Fullscreen"
                >
                  {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
                </button>
              </div>
            </div>

            {/* Round Winner / Pose Feedback Toast */}
            {roundWinnerBanner && (
              <div className="mx-auto px-5 py-1.5 rounded-full bg-teal-900/90 text-white font-black text-sm sm:text-base shadow-lg border-2 border-teal-300 animate-bounce z-30">
                {roundWinnerBanner}
              </div>
            )}

            {/* CAMERA MODE STAGE (1-Player Full or 2-Player Split Screen) */}
            {playMode === 'camera' && (
              <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 my-1 shrink-0">
                <div className="relative w-full h-36 sm:h-44 md:h-52 rounded-3xl overflow-hidden bg-slate-900 border-4 border-teal-500 shadow-xl">
                  {/* Mirrored Live Webcam Video */}
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100 opacity-90"
                  />
                  {/* Hand & Pose Landmark Skeleton Canvas */}
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={360}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />

                  {/* 2-Player Split Screen Divider & Zone Overlays */}
                  {isTwoPlayerCamera ? (
                    <div className="absolute inset-0 grid grid-cols-2 pointer-events-none">
                      {/* Player 1 Zone (Left Side) */}
                      <div className="relative border-r-2 border-dashed border-white/70 p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="bg-blue-600/90 backdrop-blur-xs text-white font-black text-xs sm:text-sm px-3 py-1 rounded-full shadow-md border border-blue-300">
                            👤 {teams[0]?.name || 'Player 1'}
                          </span>
                          {playerDetections[0].matchedOptionIdx !== null && (
                            <span className="bg-white/95 text-blue-900 font-black text-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                              <span>{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                              <span>Choice {String.fromCharCode(65 + playerDetections[0].matchedOptionIdx)}</span>
                            </span>
                          )}
                        </div>

                        {playerDetections[0].wrongFeedbackText && (
                          <div className="self-center bg-rose-600/95 text-white font-black text-xs px-3 py-1 rounded-full shadow-md animate-bounce">
                            {playerDetections[0].wrongFeedbackText}
                          </div>
                        )}

                        {/* Hold Progress Bar for Player 1 */}
                        <div className="w-full bg-black/50 backdrop-blur-xs rounded-full h-4 p-0.5 border border-white/30 overflow-hidden flex items-center">
                          <div
                            className="bg-gradient-to-r from-blue-400 to-cyan-300 h-full rounded-full transition-all duration-100"
                            style={{ width: `${playerDetections[0].holdProgress}%` }}
                          />
                          <span className="absolute inset-x-0 text-center text-[10px] font-black text-white drop-shadow">
                            {playerDetections[0].holdProgress > 0
                              ? `Hold Pose... ${playerDetections[0].holdProgress}%`
                              : 'Stand on Left & Copy Pose'}
                          </span>
                        </div>
                      </div>

                      {/* Player 2 Zone (Right Side) */}
                      <div className="relative border-l-2 border-dashed border-white/70 p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="bg-rose-600/90 backdrop-blur-xs text-white font-black text-xs sm:text-sm px-3 py-1 rounded-full shadow-md border border-rose-300">
                            👤 {teams[1]?.name || 'Player 2'}
                          </span>
                          {playerDetections[1].matchedOptionIdx !== null && (
                            <span className="bg-white/95 text-rose-900 font-black text-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
                              <span>{shuffledOptions[playerDetections[1].matchedOptionIdx]?.poseValue}</span>
                              <span>Choice {String.fromCharCode(65 + playerDetections[1].matchedOptionIdx)}</span>
                            </span>
                          )}
                        </div>

                        {playerDetections[1].wrongFeedbackText && (
                          <div className="self-center bg-rose-600/95 text-white font-black text-xs px-3 py-1 rounded-full shadow-md animate-bounce">
                            {playerDetections[1].wrongFeedbackText}
                          </div>
                        )}

                        {/* Hold Progress Bar for Player 2 */}
                        <div className="w-full bg-black/50 backdrop-blur-xs rounded-full h-4 p-0.5 border border-white/30 overflow-hidden flex items-center">
                          <div
                            className="bg-gradient-to-r from-rose-400 to-amber-300 h-full rounded-full transition-all duration-100"
                            style={{ width: `${playerDetections[1].holdProgress}%` }}
                          />
                          <span className="absolute inset-x-0 text-center text-[10px] font-black text-white drop-shadow">
                            {playerDetections[1].holdProgress > 0
                              ? `Hold Pose... ${playerDetections[1].holdProgress}%`
                              : 'Stand on Right & Copy Pose'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* 1-Player Camera Overlay */
                    <div className="absolute inset-0 p-3 flex flex-col justify-between pointer-events-none">
                      <div className="flex items-center justify-between">
                        <span className="bg-teal-600/90 backdrop-blur-xs text-white font-black text-xs sm:text-sm px-3 py-1 rounded-full shadow-md border border-teal-300">
                          📷 {teams[0]?.name || 'Player 1'} — Copy the Correct Standing Pose!
                        </span>
                        {playerDetections[0].matchedOptionIdx !== null && (
                          <span className="bg-white/95 text-teal-900 font-black text-xs sm:text-sm px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
                            <span className="text-lg leading-none">{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                            <span>Choice {String.fromCharCode(65 + playerDetections[0].matchedOptionIdx)}</span>
                          </span>
                        )}
                      </div>

                      <div className="w-full max-w-md mx-auto bg-black/50 backdrop-blur-xs rounded-full h-5 p-0.5 border border-white/30 overflow-hidden relative flex items-center">
                        <div
                          className="bg-gradient-to-r from-teal-400 to-emerald-300 h-full rounded-full transition-all duration-100"
                          style={{ width: `${playerDetections[0].holdProgress}%` }}
                        />
                        <span className="absolute inset-x-0 text-center text-[11px] font-black text-white drop-shadow">
                          {playerDetections[0].holdProgress > 0
                            ? `Hold Pose to Lock Answer... ${playerDetections[0].holdProgress}%`
                            : 'Stand in front of camera & copy the pose of the right answer!'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Camera Loading or Error Fallback */}
                  {!isCameraReady && (
                    <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white z-20">
                      {cameraError ? (
                        <>
                          <p className="text-xs sm:text-sm font-bold text-rose-300 mb-2 max-w-md">{cameraError}</p>
                          <button
                            onClick={startCamera}
                            className="px-4 py-1.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw size={14} /> Retry Camera
                          </button>
                        </>
                      ) : (
                        <p className="text-xs sm:text-sm font-bold text-teal-200 animate-pulse">
                          Starting AI Pose Camera...
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Question & Options Stage */}
            <div className="px-3 sm:px-6 pb-5 pt-1 flex-grow flex flex-col justify-center overflow-y-auto">
              {/* Question Prompt */}
              <div className="text-center mb-3 sm:mb-4 shrink-0">
                {quiz.questions[currentIdx]?.image && (
                  <div className="mb-2 max-h-28 sm:max-h-36 mx-auto rounded-2xl overflow-hidden border-4 border-teal-200 shadow-md inline-block bg-white p-1">
                    <img
                      src={quiz.questions[currentIdx]?.image}
                      alt="Question Clue"
                      className="max-h-24 sm:max-h-32 object-contain rounded-xl mx-auto"
                    />
                  </div>
                )}

                {currentQuestionText && (
                  <div>
                    <h2
                      className={`font-black text-slate-900 bg-white/95 backdrop-blur-md py-2.5 sm:py-3.5 px-5 sm:px-8 rounded-2xl sm:rounded-3xl border-4 border-teal-400 shadow-lg inline-block min-w-[45%] max-w-[95%] leading-snug ${getQuestionFontSizeClass(currentQuestionText)}`}
                    >
                      {currentQuestionText}
                    </h2>
                  </div>
                )}
              </div>

              {/* Options Grid — Standing Pose Illustration + Answer Choice (NO Pose Title!) */}
              <div
                className={`grid ${
                  shuffledOptions.length <= 2
                    ? 'grid-cols-2 max-w-3xl'
                    : shuffledOptions.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl'
                    : 'grid-cols-2 md:grid-cols-4 max-w-7xl'
                } gap-2.5 sm:gap-4 md:gap-5 w-full mx-auto justify-center items-stretch`}
              >
                {shuffledOptions.map((opt, index) => {
                  const isMany = shuffledOptions.length > 4;
                  const isImageOption = Boolean(opt.image);

                  const p1Locking = playMode === 'camera' && playerDetections[0].matchedOptionIdx === index && !isAnswering;
                  const p2Locking = isTwoPlayerCamera && playerDetections[1].matchedOptionIdx === index && !isAnswering;

                  let btnClasses = `flex-1 min-w-0 bg-white/95 border-3 sm:border-4 border-teal-100 text-slate-800 font-bold p-2.5 sm:p-3.5 md:p-4 rounded-3xl transition-all duration-200 flex flex-col items-center text-center shadow-lg relative group outline-none overflow-hidden `;

                  if (isAnswering) {
                    if (index === selectedOption) {
                      if (opt.isCorrect) {
                        btnClasses += "bg-emerald-100 border-emerald-600 text-emerald-950 scale-[1.03] z-10 shadow-2xl";
                      } else {
                        btnClasses += "bg-rose-100 border-rose-600 text-rose-950";
                      }
                    } else if (opt.isCorrect) {
                      btnClasses += "bg-emerald-100 border-emerald-600 text-emerald-950 scale-[1.03] z-10 shadow-2xl";
                    } else {
                      btnClasses += "opacity-55 scale-95";
                    }
                  } else if (p1Locking || p2Locking) {
                    btnClasses += "border-teal-500 bg-teal-50/95 scale-[1.03] shadow-2xl ring-4 ring-teal-400/50 cursor-pointer";
                  } else {
                    btnClasses += "hover:border-teal-400 hover:bg-teal-50/60 hover:shadow-xl hover:scale-[1.02] cursor-pointer";
                  }

                  return (
                    <button
                      key={index}
                      disabled={isAnswering}
                      onClick={() => handleAnswer(index, opt.isCorrect)}
                      className={btnClasses}
                    >
                      {/* Option Letter Badge (A, B, C, D) */}
                      <div className="absolute top-2.5 left-2.5 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-600 text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-xs">
                        {String.fromCharCode(65 + index)}
                      </div>

                      {/* Correct / Incorrect Indicator */}
                      {isAnswering && (index === selectedOption || opt.isCorrect) && (
                        <div
                          className={`absolute top-2 right-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-lg sm:text-2xl font-black shadow-md z-30 animate-bounce ${
                            opt.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        >
                          {opt.isCorrect ? '✓' : '✗'}
                        </div>
                      )}

                      {/* Floating Pose Icon Badge for Picture Options (No Pose Title Text!) */}
                      {isImageOption && (
                        <div className="absolute top-2 right-2 z-20 bg-white/95 backdrop-blur-xs border-2 border-teal-300 rounded-2xl p-1 shadow-md pointer-events-none">
                          <StandingPoseFigure poseId={opt.poseId} emoji={opt.poseValue} size="sm" />
                        </div>
                      )}

                      {/* Visual Box: Picture if Option has Image, otherwise Standing Pose Figure (NO Pose Title!) */}
                      <div
                        className={`w-full ${
                          playMode === 'camera'
                            ? 'h-24 sm:h-28 md:h-32'
                            : 'h-28 sm:h-36 md:h-44'
                        } rounded-2xl overflow-hidden relative bg-gradient-to-b from-teal-50/80 to-emerald-50/50 border-2 border-teal-100 mb-2 flex items-center justify-center shrink-0 p-2`}
                      >
                        {isImageOption ? (
                          <img
                            src={opt.image}
                            alt={opt.text || `Option ${index + 1}`}
                            className="w-full h-full object-contain rounded-xl"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <StandingPoseFigure
                            poseId={opt.poseId}
                            emoji={opt.poseValue}
                            size={playMode === 'camera' ? 'md' : 'lg'}
                          />
                        )}
                      </div>

                      {/* Option Answer Text (Auto-sized based on length) */}
                      {opt.text ? (
                        <span
                          className={`${getOptionFontSizeClass(opt.text, isMany)} font-black text-slate-800 leading-tight w-full flex items-center justify-center break-words px-1 flex-grow`}
                        >
                          {opt.text}
                        </span>
                      ) : isImageOption ? (
                        <span className="text-xs sm:text-sm font-extrabold text-teal-700 uppercase tracking-wider">
                          Choice {String.fromCharCode(65 + index)}
                        </span>
                      ) : null}

                      {/* Live Camera Hold-to-Select Bar on the Card */}
                      {(p1Locking || p2Locking) && (
                        <div className="w-full mt-2 space-y-1">
                          {p1Locking && (
                            <div className="w-full bg-blue-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full transition-all duration-100"
                                style={{ width: `${playerDetections[0].holdProgress}%` }}
                              />
                            </div>
                          )}
                          {p2Locking && (
                            <div className="w-full bg-rose-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-rose-600 h-full transition-all duration-100"
                                style={{ width: `${playerDetections[1].holdProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Progress Bar */}
            <div className="w-full bg-teal-200/70 h-3 absolute bottom-0 left-0 shrink-0 overflow-hidden">
              <div
                className="bg-teal-600 h-full transition-all duration-500 ease-out rounded-r-full"
                style={{ width: `${((currentIdx + (isAnswering ? 1 : 0)) / Math.max(1, quiz.questions.length)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* END / RESULTS SCREEN */}
        {gameState === 'end' && (
          <div className="p-8 md:p-16 text-center flex flex-col items-center justify-center flex-grow animate-fade-in z-10">
            <div className="text-[5rem] md:text-[8rem] mb-6 drop-shadow-xl animate-bounce">🏆</div>
            {(() => {
              const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
              const winner = sortedTeams[0];
              const isTie = sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score;

              if (isTie) {
                return <h1 className="text-4xl md:text-6xl font-black text-teal-900 mb-8">It's a Tie!</h1>;
              } else {
                return <h1 className="text-4xl md:text-6xl font-black text-teal-900 mb-8">{winner.name} Wins!</h1>;
              }
            })()}

            <div className="bg-white/90 border-4 border-teal-200 rounded-[2.5rem] p-6 md:p-10 mb-8 w-full max-w-3xl shadow-xl mx-auto">
              <p className="text-teal-600 font-black text-xl md:text-2xl uppercase tracking-widest mb-6">Final Scores</p>
              <div className="flex flex-wrap justify-center gap-4 md:gap-6">
                {[...teams].sort((a, b) => b.score - a.score).map((team, idx) => (
                  <div
                    key={team.id}
                    className={`flex flex-col items-center bg-teal-50/70 p-4 md:p-6 rounded-2xl border-4 min-w-[130px] ${
                      idx === 0 ? 'border-amber-400 scale-105 shadow-md bg-amber-50/60' : 'border-teal-100'
                    }`}
                  >
                    {idx === 0 && <span className="text-3xl mb-1">👑</span>}
                    <span className="font-bold text-base md:text-lg mb-1 text-slate-700">{team.name}</span>
                    <span className={`text-3xl md:text-5xl font-black ${teamColors[team.colorIdx].text}`}>
                      {team.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 w-full max-w-xl mx-auto">
              <button
                onClick={onBack}
                className="bg-white hover:bg-teal-50 text-teal-800 border-3 border-teal-300 font-black py-4 px-8 rounded-full text-xl transition transform hover:scale-105 shadow-md cursor-pointer flex items-center gap-2"
              >
                <ArrowLeft size={24} /> Exit
              </button>
              <button
                onClick={startGame}
                className="flex-1 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-black py-4 px-10 rounded-full text-2xl md:text-3xl transition transform hover:scale-105 shadow-[0_8px_0_#0f766e] active:translate-y-1 active:shadow-none cursor-pointer"
              >
                PLAY AGAIN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
