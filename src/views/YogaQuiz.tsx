import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ViewState } from "../types";

import { MediaPickerModal } from "../components/MediaPickerModal";
import { BulkPasteVideoModal } from "../components/BulkPasteVideoModal";
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
  RefreshCw,
  Play,
  Check
} from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { playSound } from '../lib/audio';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { drawSuperheroHands } from "../utils/superheroHands";

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
  type: 'emoji' | 'image';
  value: string;
  name: string;
  shortHint: string;
  category: 'classic' | 'hand' | 'both';
  family: string;
}

// Classic Yoga Poses (retrieved for Classic Studio Mode)
export const CLASSIC_YOGA_POSES: StandingPoseConfig[] = [
  { id: 'tree-pose', type: 'emoji', value: '🌳', name: 'Tree Pose', shortHint: 'Balance on one leg with palms together', category: 'classic', family: 'tree-family' },
  { id: 'warrior-pose', type: 'emoji', value: '⚔️', name: 'Warrior Pose', shortHint: 'Wide lunge stance with arms stretched out', category: 'classic', family: 'warrior-family' },
  { id: 'star-pose', type: 'emoji', value: '⭐', name: 'Star Pose', shortHint: 'Spread arms and legs wide like a star', category: 'both', family: 'star-family' },
  { id: 'mountain-pose', type: 'emoji', value: '🏔️', name: 'Mountain Reach', shortHint: 'Stand tall and reach both arms high', category: 'classic', family: 'mountain-family' },
  { id: 'airplane-pose', type: 'emoji', value: '✈️', name: 'Airplane Balance', shortHint: 'Spread arms wide like airplane wings', category: 'classic', family: 'airplane-family' },
  { id: 'chair-pose', type: 'emoji', value: '🪑', name: 'Chair Squat', shortHint: 'Bend knees into an invisible chair', category: 'classic', family: 'chair-family' },
  { id: 'crescent-pose', type: 'emoji', value: '🌙', name: 'Crescent Moon', shortHint: 'Arch both arms overhead to the side', category: 'classic', family: 'crescent-family' },
  { id: 'dancer-pose', type: 'emoji', value: '💃', name: 'Dancer Pose', shortHint: 'Hold one foot back and reach forward', category: 'classic', family: 'dancer-family' },
  { id: 'cobra-pose', type: 'emoji', value: '🐍', name: 'Cobra Stretch', shortHint: 'Open chest wide with elbows back', category: 'classic', family: 'cobra-family' },
  { id: 'namaste', type: 'emoji', value: '🙏', name: 'Lotus Namaste', shortHint: 'Press palms together at chest', category: 'both', family: 'namaste-family' },
  { id: 'cross-arms', type: 'emoji', value: '🙅', name: 'Eagle Cross', shortHint: 'Cross both arms over chest', category: 'both', family: 'cross-family' },
  { id: 'power-fist', type: 'emoji', value: '💪', name: 'Hero Flex', shortHint: 'Strong superhero double bicep flex', category: 'both', family: 'fist-family' },
];

// Pure Hand Gestures for Camera Mode (1 finger, 2 finger, 3 finger, fist, rock, etc.)
export const CAMERA_HAND_POSES: StandingPoseConfig[] = [
  { id: '1-finger', type: 'emoji', value: '☝️', name: '1 Finger', shortHint: 'Hold up 1 index finger', category: 'hand', family: 'finger-1' },
  { id: '2-finger', type: 'emoji', value: '✌️', name: '2 Fingers', shortHint: 'Hold up 2 fingers (peace sign)', category: 'hand', family: 'finger-2' },
  { id: '3-finger', type: 'emoji', value: '🤟', name: '3 Fingers', shortHint: 'Hold up 3 fingers', category: 'hand', family: 'finger-3' },
  { id: 'fist', type: 'emoji', value: '✊', name: 'Fist', shortHint: 'Make a closed fist', category: 'hand', family: 'fist' },
  { id: 'rock', type: 'emoji', value: '🤘', name: 'Rock On', shortHint: 'Index & pinky fingers up', category: 'hand', family: 'rock' },
  { id: '5-finger', type: 'emoji', value: '🖐️', name: '5 Fingers', shortHint: 'Open all 5 fingers wide', category: 'hand', family: 'finger-5' },
  { id: 'thumbs-up', type: 'emoji', value: '👍', name: 'Thumbs Up', shortHint: 'Show a clear thumbs up', category: 'hand', family: 'thumb' },
  { id: 'ok-sign', type: 'emoji', value: '👌', name: 'OK Sign', shortHint: 'Touch thumb & index in a circle', category: 'hand', family: 'ok' },
  { id: '4-finger', type: 'emoji', value: '🖖', name: '4 Fingers', shortHint: 'Hold up 4 fingers', category: 'hand', family: 'finger-4' },
  { id: 'shaka', type: 'emoji', value: '🤙', name: 'Shaka', shortHint: 'Thumb and pinky extended', category: 'hand', family: 'shaka' },
];

export const AVAILABLE_POSES: StandingPoseConfig[] = [
  ...CAMERA_HAND_POSES,
  ...CLASSIC_YOGA_POSES.filter(cp => !CAMERA_HAND_POSES.some(hp => hp.id === cp.id)),
];

export const DEFAULT_CLASSIC_POSE_VALUES = CLASSIC_YOGA_POSES.map(p => p.value);
export const DEFAULT_CAMERA_HAND_VALUES = CAMERA_HAND_POSES.map(p => p.value);
export const DEFAULT_CAMERA_COMBINATION_VALUES = DEFAULT_CAMERA_HAND_VALUES;

export const getPoseName = (poseId?: string | null, poseValue?: string | null): string => {
  if (poseId) {
    const found = AVAILABLE_POSES.find(p => p.id === poseId);
    if (found) return found.name;
  }
  if (poseValue) {
    const found = AVAILABLE_POSES.find(p => p.value === poseValue);
    if (found) return found.name;
    if (poseValue === '☝️') return '1 Finger';
    if (poseValue === '✌️') return '2 Fingers';
    if (poseValue === '🤟') return '3 Fingers';
    if (poseValue === '✊') return 'Fist';
    if (poseValue === '🤘') return 'Rock On';
    if (poseValue === '🖐️') return '5 Fingers';
    if (poseValue === '👍') return 'Thumbs Up';
    if (poseValue === '👌') return 'OK Sign';
    if (poseValue === '🖖') return '4 Fingers';
    if (poseValue === '🤙') return 'Shaka';
  }
  return 'Pose';
};

/**
 * Animated Floating Score Badge when points are awarded (+1, +5, etc.)
 */
function FloatingScoreBadge({ delta, idKey }: { delta: number; idKey: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(timer);
  }, [idKey]);

  if (!visible) return null;

  return (
    <div
      key={idKey}
      className={`absolute -top-7 left-1/2 -translate-x-1/2 pointer-events-none font-black text-xl sm:text-2xl z-50 animate-score-float drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] select-none ${
        delta > 0 ? 'text-emerald-300' : 'text-rose-400'
      }`}
    >
      {delta > 0 ? `+${delta}` : delta}
    </div>
  );
}

/**
 * Clean Pose & Hand Emoji Display (No person cartoon images).
 * Displays pure vibrant emojis or custom image assets.
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
  if (isImageUrl(emoji)) {
    const dimClass = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-11 h-11';
    return (
      <div className={`relative flex items-center justify-center select-none ${dimClass}`}>
        <img src={emoji} alt={poseId} className="w-full h-full object-contain rounded-lg drop-shadow-xs" />
      </div>
    );
  }

  const textClass = size === 'sm' ? 'text-2xl sm:text-3xl' : size === 'lg' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl';

  return (
    <div className="relative flex items-center justify-center select-none p-1">
      <span className={`${textClass} leading-none drop-shadow-xs transform transition-transform hover:scale-110`}>
        {emoji}
      </span>
    </div>
  );
}

/**
 * Scale-invariant anatomical hand gesture detector.
 * Evaluates MediaPipe 21-point hand landmarks:
 * Supports: 1 Finger, 2 Fingers, 3 Fingers, Fist, Rock, 5 Fingers, Thumbs Up, OK Sign, 4 Fingers, Shaka.
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
    const palmCenter = lm[9];
    const palmSize = Math.max(0.035, dist(palmCenter, wrist));

    // Distance of finger tips and PIP joints from wrist
    const dIndexTip = dist(lm[8], wrist);
    const dIndexPip = Math.max(0.01, dist(lm[6], wrist));
    const dMiddleTip = dist(lm[12], wrist);
    const dMiddlePip = Math.max(0.01, dist(lm[10], wrist));
    const dRingTip = dist(lm[16], wrist);
    const dRingPip = Math.max(0.01, dist(lm[14], wrist));
    const dPinkyTip = dist(lm[20], wrist);
    const dPinkyPip = Math.max(0.01, dist(lm[18], wrist));

    const indexRatio = dIndexTip / dIndexPip;
    const middleRatio = dMiddleTip / dMiddlePip;
    const ringRatio = dRingTip / dRingPip;
    const pinkyRatio = dPinkyTip / dPinkyPip;

    const indexTipToMcp = dist(lm[8], lm[5]);
    const indexPipToMcp = Math.max(0.005, dist(lm[6], lm[5]));
    const middleTipToMcp = dist(lm[12], lm[9]);
    const middlePipToMcp = Math.max(0.005, dist(lm[10], lm[9]));
    const ringTipToMcp = dist(lm[16], lm[13]);
    const ringPipToMcp = Math.max(0.005, dist(lm[14], lm[13]));
    const pinkyTipToMcp = dist(lm[20], lm[17]);
    const pinkyPipToMcp = Math.max(0.005, dist(lm[18], lm[17]));

    // Multi-criteria scale-invariant finger extension (ratio + knuckle geometry + wrist distance)
    const indexExtended = (indexRatio > 1.05 && (indexTipToMcp > indexPipToMcp * 1.15 || dist(lm[8], lm[5]) > palmSize * 0.44)) || (dist(lm[8], wrist) > dist(lm[6], wrist) * 1.08);
    const middleExtended = (middleRatio > 1.05 && (middleTipToMcp > middlePipToMcp * 1.15 || dist(lm[12], lm[9]) > palmSize * 0.44)) || (dist(lm[12], wrist) > dist(lm[10], wrist) * 1.08);
    const ringExtended = (ringRatio > 1.04 && (ringTipToMcp > ringPipToMcp * 1.12 || dist(lm[16], lm[13]) > palmSize * 0.40)) || (dist(lm[16], wrist) > dist(lm[14], wrist) * 1.06);
    const pinkyExtended = (pinkyRatio > 1.04 && (pinkyTipToMcp > pinkyPipToMcp * 1.10 || dist(lm[20], lm[17]) > palmSize * 0.36)) || (dist(lm[20], wrist) > dist(lm[18], wrist) * 1.06);

    // Thumb metrics
    const thumbTip = lm[4];
    const thumbMcp = lm[2];
    const thumbIp = lm[3];
    const thumbSpread = dist(thumbTip, lm[5]) > palmSize * 0.48 && dist(thumbTip, lm[17]) > dist(thumbMcp, lm[17]) * 1.12;
    const thumbUpVertical = (thumbTip.y < thumbIp.y - palmSize * 0.05) && (thumbTip.y < lm[5].y - palmSize * 0.05);

    // Number of extended fingers (index, middle, ring, pinky)
    const fourFingersCount =
      (indexExtended ? 1 : 0) +
      (middleExtended ? 1 : 0) +
      (ringExtended ? 1 : 0) +
      (pinkyExtended ? 1 : 0);

    const totalOpenCount = fourFingersCount + (thumbSpread ? 1 : 0);

    // Closed fist: all 4 fingers curled down tightly
    const fingersCurled = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended;

    // Pinch distance for OK sign
    const pinchDist = dist(thumbTip, lm[8]) / palmSize;
    const isOkPinch = pinchDist < 0.55 && (middleExtended || ringExtended || pinkyExtended);

    // Relative extension dominances
    const peaceDominance = Math.min(indexRatio, middleRatio) - Math.max(ringRatio, pinkyRatio);
    const pointDominance = indexRatio - Math.max(middleRatio, ringRatio, pinkyRatio);
    const rockDominance = Math.min(indexRatio, pinkyRatio) - Math.max(middleRatio, ringRatio);

    return {
      wrist,
      palmCenter,
      palmSize,
      indexRatio,
      middleRatio,
      ringRatio,
      pinkyRatio,
      indexExtended,
      middleExtended,
      ringExtended,
      pinkyExtended,
      thumbSpread,
      thumbUpVertical,
      fourFingersCount,
      totalOpenCount,
      fingersCurled,
      isOkPinch,
      peaceDominance,
      pointDominance,
      rockDominance,
    };
  };

  const analyzed = hands.map(analyzeSingleHand);
  const scores: Record<string, number> = {};

  for (const h of analyzed) {
    // 1. Closed Fist (✊) - all 4 fingers curled down
    if (h.fingersCurled && !h.thumbUpVertical && !h.isOkPinch) {
      scores['fist'] = Math.max(scores['fist'] || 0, 0.99);
      scores['power-fist'] = Math.max(scores['power-fist'] || 0, 0.95);
    }

    // 2. 1 Finger / Point Up (☝️) - ONLY index extended, middle, ring, and pinky MUST be curled
    const otherThreeCurled = !h.middleExtended && !h.ringExtended && !h.pinkyExtended && h.pinkyRatio < 1.08 && h.middleRatio < 1.08;
    if (
      h.indexExtended && otherThreeCurled && !h.isOkPinch &&
      (h.fourFingersCount === 1 || h.pointDominance > 0.15)
    ) {
      scores['1-finger'] = Math.max(scores['1-finger'] || 0, 0.99);
      scores['point-up'] = Math.max(scores['point-up'] || 0, 0.99);
    }

    // 3. 2 Fingers / Peace (✌️) - index and middle extended, ring and pinky curled
    if (
      (h.indexExtended && h.middleExtended && !h.ringExtended && !h.pinkyExtended) ||
      (h.fourFingersCount === 2 && h.indexExtended && h.middleExtended && !h.pinkyExtended) ||
      (h.peaceDominance > 0.12 && !h.pinkyExtended)
    ) {
      scores['2-finger'] = Math.max(scores['2-finger'] || 0, 0.99);
      scores['peace'] = Math.max(scores['peace'] || 0, 0.99);
    }

    // 4. 3 Fingers / Sign (🤟) - accepts:
    //    a) Index + Pinky extended (with thumb either extended or tucked, middle/ring curled) -> ASL 🤟 or 🤘
    //    b) Index + Middle + Ring extended (classic 3 fingers)
    //    c) Thumb + Index + Middle extended (European 3)
    //    d) Exactly 3 fingers extended
    const isRockOrIly = (h.indexExtended && h.pinkyExtended && !h.middleExtended && !h.ringExtended) || (h.rockDominance > 0.10);
    const isClassic3 = (h.indexExtended && h.middleExtended && h.ringExtended && !h.pinkyExtended);
    const isEuro3 = (h.thumbSpread && h.indexExtended && h.middleExtended && !h.ringExtended && !h.pinkyExtended);
    const isAny3 = h.fourFingersCount === 3 || (h.totalOpenCount === 3 && h.indexExtended);

    if (isRockOrIly || isClassic3 || isEuro3 || isAny3) {
      scores['3-finger'] = Math.max(scores['3-finger'] || 0, 0.99);
      if (isRockOrIly) {
        scores['rock'] = Math.max(scores['rock'] || 0, 0.99);
        scores['rock-on'] = Math.max(scores['rock-on'] || 0, 0.99);
      }
    }

    // 5. 4 Fingers (🖖) - all 4 fingers extended, thumb curled
    if (h.fourFingersCount === 4 && !h.thumbSpread) {
      scores['4-finger'] = Math.max(scores['4-finger'] || 0, 0.97);
    }

    // 6. 5 Fingers / Open Palm (🖐️) - all fingers open wide
    if (h.fourFingersCount >= 4 && (h.thumbSpread || h.totalOpenCount >= 5)) {
      scores['5-finger'] = Math.max(scores['5-finger'] || 0, 0.99);
      scores['star-hands'] = Math.max(scores['star-hands'] || 0, 0.99);
      scores['hands-up'] = Math.max(scores['hands-up'] || 0, 0.95);
    }

    // 7. Rock On (🤘) - index and pinky extended, middle and ring curled
    if (isRockOrIly) {
      scores['rock'] = Math.max(scores['rock'] || 0, 0.99);
      scores['rock-on'] = Math.max(scores['rock-on'] || 0, 0.99);
    }

    // 8. Thumbs Up (👍) - thumb pointing up and fingers curled
    if (h.thumbUpVertical && (h.fingersCurled || h.fourFingersCount <= 1)) {
      scores['thumbs-up'] = Math.max(scores['thumbs-up'] || 0, 0.98);
    }

    // 9. OK Sign (👌) - thumb and index pinched into circle
    if (h.isOkPinch) {
      scores['ok-sign'] = Math.max(scores['ok-sign'] || 0, 0.97);
      scores['ok-pose'] = Math.max(scores['ok-pose'] || 0, 0.97);
    }

    // 10. Shaka / Call Me (🤙) - thumb and pinky extended, middle 3 curled
    if (h.thumbSpread && h.pinkyExtended && !h.indexExtended && !h.middleExtended && !h.ringExtended) {
      scores['shaka'] = Math.max(scores['shaka'] || 0, 0.97);
    }
  }

  // Match against candidate poses on screen with robust alias resolution
  let bestCandidate: string | null = null;
  let bestCandidateScore = 0;

  for (const cid of candidatePoseIds) {
    const s = scores[cid] ||
      (cid === '1-finger' ? scores['point-up'] : 0) ||
      (cid === 'point-up' ? scores['1-finger'] : 0) ||
      (cid === '2-finger' ? scores['peace'] : 0) ||
      (cid === 'peace' ? scores['2-finger'] : 0) ||
      (cid === '3-finger' ? Math.max(scores['3-finger'] || 0, scores['rock'] || 0, scores['rock-on'] || 0) : 0) ||
      (cid === 'rock' ? Math.max(scores['rock'] || 0, scores['3-finger'] || 0) : 0) ||
      (cid === 'rock-on' ? Math.max(scores['rock-on'] || 0, scores['3-finger'] || 0) : 0) ||
      (cid === '5-finger' ? (scores['star-hands'] || scores['hands-up']) : 0) ||
      (cid === 'star-hands' ? scores['5-finger'] : 0) ||
      (cid === 'fist' ? scores['power-fist'] : 0) ||
      (cid === 'power-fist' ? scores['fist'] : 0) ||
      (cid === 'ok-sign' ? scores['ok-pose'] : 0) ||
      (cid === 'ok-pose' ? scores['ok-sign'] : 0);

    if (s > bestCandidateScore) {
      bestCandidateScore = s;
      bestCandidate = cid;
    }
  }

  if (bestCandidate && bestCandidateScore >= 0.70) {
    return { poseId: bestCandidate, confidence: bestCandidateScore };
  }

  let bestOverall: string | null = null;
  let bestOverallScore = 0;
  for (const [pid, s] of Object.entries(scores)) {
    if (s > bestOverallScore) {
      bestOverallScore = s;
      bestOverall = pid;
    }
  }

  return { poseId: bestOverallScore >= 0.74 ? bestOverall : null, confidence: bestOverallScore };
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
    if (!user) {
      alert("You must be logged in to save games.");
      return;
    }
    
    try {
      const isPublicBool = Boolean(quiz.isPublic);
      const now = new Date().toISOString();

      const isOwnExistingGame = Boolean(
        initialGame?.id &&
        !String(initialGame.id).startsWith('sample-') &&
        (!initialGame.userId || initialGame.userId === user.uid)
      );

      const gameToSave = {
        name: quiz.title || quiz.topic || "Yoga Studio Quiz",
        title: quiz.title || quiz.topic || "Yoga Studio Quiz",
        folderId: quiz.folderId || "",
        topic: quiz.topic || "",
        className: quiz.classLevel || "",
        gameType: "yoga-quiz",
        customQuestions: quiz.questions,
        userId: user.uid,
        creatorName: user.displayName || user.email?.split('@')[0] || "Teacher",
        creatorEmail: user.email || "",
        updatedAt: now,
        publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
        createdAt: (isOwnExistingGame && initialGame?.createdAt) ? initialGame.createdAt : now,
        isPublic: isPublicBool,
      };

      if (isOwnExistingGame) {
        try {
          await updateDoc(doc(db, "mysteryBoxGames", initialGame.id), gameToSave);
        } catch (err: any) {
          if (err?.code === 'not-found') {
            await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
          } else {
            throw err;
          }
        }
      } else {
        await addDoc(collection(db, "mysteryBoxGames"), gameToSave);
      }
      onViewChange("games");
    } catch (error: any) {
      console.error("Error saving game:", error);
      alert("Failed to save game: " + (error?.message || String(error)));
      onViewChange("games");
    }
  };

  const getQuizData = (): Quiz => {
    const blankQuestions: Question[] = [
      { id: Date.now(), text: "", options: ["", "", "", ""], answerIndex: 0 }
    ];

    if (initialGame && (initialGame.customQuestions || initialGame.questions || initialGame.id)) {
      const qList = (initialGame.customQuestions && initialGame.customQuestions.length > 0)
        ? initialGame.customQuestions
        : (initialGame.questions && initialGame.questions.length > 0 ? initialGame.questions : blankQuestions);

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
  const [showVideoGuide, setShowVideoGuide] = useState(false);
  const [copiedPromptInModal, setCopiedPromptInModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleCopyAiPrompt = () => {
    const promptText = `Create 50 fill-in-the-blank questions on the topic of Passive Voice. Each question should have 4 multiple-choice options (A, B, C, and D) and include the correct answer.`;
    navigator.clipboard.writeText(promptText);
    setCopiedPromptInModal(true);
    setTimeout(() => setCopiedPromptInModal(false), 2500);
  };

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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowVideoGuide(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Watch Video Tutorial"
                  >
                    <Play size={13} className="fill-current text-purple-500" />
                    <span>Video Guide</span>
                  </button>
                  <button 
                    onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Walkthrough Banner: 3 Simple Steps */}
              <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-teal-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Sparkles size={14} /> 3 Simple Steps to Generate 50+ Questions
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {copiedPromptInModal ? (
                      <>
                        <Check size={12} className="text-green-300" />
                        <span>Copied Prompt!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy AI Prompt</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-purple-500/20 flex flex-col gap-1">
                    <span className="font-bold text-purple-600 dark:text-purple-400">1. Prompt ChatGPT / Claude</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Click &ldquo;Copy AI Prompt&rdquo; above and paste it into ChatGPT, Claude, or Gemini.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-indigo-500/20 flex flex-col gap-1">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">2. Copy AI Output</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Copy the 50 numbered questions and answer choices directly from the AI.</span>
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-xl border border-teal-500/20 flex flex-col gap-1">
                    <span className="font-bold text-teal-600 dark:text-teal-400">3. Paste Here &amp; Click Apply</span>
                    <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">Paste in the box below and click &ldquo;Append&rdquo; or &ldquo;Replace All&rdquo; to auto-divide!</span>
                  </div>
                </div>
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
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setShowVideoGuide(true)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-1.5 cursor-pointer border border-purple-400/30"
                title="Watch Video Tutorial: How to Bulk Paste with AI"
              >
                <div className="w-4 h-4 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                  <Play size={10} className="ml-0.5 fill-current" />
                </div>
                <span>How to Bulk Paste</span>
              </button>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ClipboardList size={14} /> Bulk Paste
              </button>
            </div>
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

      <BulkPasteVideoModal
        isOpen={showVideoGuide}
        onClose={() => setShowVideoGuide(false)}
        onOpenBulkPasteWithSample={(sample) => {
          setBulkText(sample);
          setShowBulkPasteModal(true);
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

function getInitialClassicPoses(): string[] {
  try {
    // Check current classic key and any legacy localStorage keys to retrieve previous poses
    const keysToCheck = [
      'yogaClassicPoses_v6',
      'yogaActivePoses',
      'yogaActivePoses_v4',
      'yogaActivePoses_v3',
      'yogaActivePoses_v2',
      'yogaActivePoses_v1',
    ];
    for (const key of keysToCheck) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter(
            (p: any) =>
              typeof p === 'string' &&
              (AVAILABLE_POSES.some(ap => ap.value === p) || isImageUrl(p))
          );
          if (valid.length >= 4) return valid;
        }
      }
    }
  } catch (e) {}
  return DEFAULT_CLASSIC_POSE_VALUES;
}

function getInitialCameraHandPoses(): string[] {
  try {
    const raw = localStorage.getItem('yogaCameraHandPoses_v7');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((p: any) => CAMERA_HAND_POSES.some(ap => ap.value === p));
        if (valid.length >= 4) return valid;
      }
    }
  } catch (e) {}
  return DEFAULT_CAMERA_HAND_VALUES;
}

function YogaGame({ quiz, onBack, onSwitchMode }: { quiz: Quiz, onBack: () => void, onSwitchMode?: () => void }) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'end'>('start');
  const [playMode, setPlayMode] = useState<'studio' | 'camera'>('camera');

  // Persisted pose selections: Classic Mode uses previous yoga poses; Camera Mode uses pure hand gestures
  const [classicPoses, setClassicPoses] = useState<string[]>(getInitialClassicPoses);
  const [cameraHandPoses, setCameraHandPoses] = useState<string[]>(getInitialCameraHandPoses);

  const activePoses = playMode === 'studio' ? classicPoses : cameraHandPoses;

  useEffect(() => {
    try {
      localStorage.setItem('yogaClassicPoses_v7', JSON.stringify(classicPoses));
    } catch (e) {}
  }, [classicPoses]);

  useEffect(() => {
    try {
      localStorage.setItem('yogaCameraHandPoses_v7', JSON.stringify(cameraHandPoses));
    } catch (e) {}
  }, [cameraHandPoses]);

  const togglePose = (val: string) => {
    const updater = (prev: string[]) => {
      if (prev.includes(val)) {
        if (prev.length <= 4) return prev; // Keep at least 4 poses so 4 options always have distinct poses
        return prev.filter(p => p !== val);
      }
      return [...prev, val];
    };
    if (playMode === 'studio') {
      setClassicPoses(updater);
    } else {
      setCameraHandPoses(updater);
    }
  };

  const applyPosePreset = (preset: 'classic' | 'hand') => {
    if (preset === 'classic') {
      setClassicPoses(DEFAULT_CLASSIC_POSE_VALUES);
    } else {
      setCameraHandPoses(DEFAULT_CAMERA_HAND_VALUES);
    }
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

  const [scorePops, setScorePops] = useState<Record<string, { delta: number; key: number }>>({});
  const [teamStreaks, setTeamStreaks] = useState<Record<string, number>>({});

  const updateTeamScore = (id: string, delta: number) => {
    setTeams(prev => prev.map(t => t.id === id ? { ...t, score: Math.max(0, t.score + delta) } : t));
    if (delta > 0) {
      playSound('correct');
      setScorePops(prev => ({ ...prev, [id]: { delta, key: Date.now() + Math.random() } }));
      setTeamStreaks(prev => ({ ...prev, [id]: (prev[id] || 0) + delta }));
    } else if (delta < 0) {
      playSound('click');
      setScorePops(prev => ({ ...prev, [id]: { delta, key: Date.now() + Math.random() } }));
      setTeamStreaks(prev => ({ ...prev, [id]: 0 }));
    }
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
  // Cache each question's assigned options/poses per mode so Classic Mode can retrieve previous poses cleanly
  const questionOptionsCacheRef = useRef<
    Record<
      string,
      Array<{
        text: string;
        image?: string;
        isCorrect: boolean;
        poseId: string;
        poseValue: string;
      }>
    >
  >({});

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
      lastUpdateTime: number;
      lastMatchedTime: number;
      recentPoses: Array<string | null>;
      cooldownUntil: number;
      wrongBannerUntil: number;
    }>
  >([
    { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: 0, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0 },
    { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: 0, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0 },
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

  const loadQuestion = useCallback((idx: number, retrievePreviousIfCached: boolean = false) => {
    setIsAnswering(false);
    setSelectedOption(null);
    setRoundWinnerBanner(null);
    const now = performance.now();
    holdStateRef.current = [
      { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: now, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0 },
      { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: now, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0 },
    ];
    setPlayerDetections([
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
    ]);

    const currentItem = quiz.questions[idx];
    if (!currentItem) return;

    const cacheKey = `${playMode}-${idx}`;
    if (retrievePreviousIfCached && questionOptionsCacheRef.current[cacheKey]) {
      setShuffledOptions(questionOptionsCacheRef.current[cacheKey]);
      return;
    }

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

    // Build mode-appropriate pose assignments:
    // - Camera Mode: ONLY USE HANDS (1 finger, 2 finger, 3 finger, fist, rock, etc.)
    // - Classic Studio Mode: Retrieve previous classic yoga poses (Tree, Warrior, Star, etc.)
    let opts = validOpts.map((opt) => ({
      text: opt.text,
      image: opt.image,
      isCorrect: opt.originalIndex === correctIndex,
    }));

    // Shuffle option order
    opts.sort(() => Math.random() - 0.5);

    let computedOptions;
    if (playMode === 'camera') {
      // Pure hand gestures in clear ordered priority for intuitive answering:
      // Choice A: 1 Finger (☝️)
      // Choice B: 2 Fingers (✌️)
      // Choice C: 3 Fingers (🤟)
      // Choice D: Fist (✊)
      // Choice E: Rock On (🤘)
      // Choice F: 5 Fingers (🖐️)
      const handPriorityOrder = ['1-finger', '2-finger', '3-finger', 'fist', 'rock', '5-finger', 'thumbs-up', 'ok-sign', '4-finger', 'shaka'];
      const activeHandCatalog = CAMERA_HAND_POSES.filter(p => cameraHandPoses.includes(p.value));
      const sourceCatalog = activeHandCatalog.length >= opts.length ? activeHandCatalog : CAMERA_HAND_POSES;

      const chosenHands: StandingPoseConfig[] = [];
      for (const hid of handPriorityOrder) {
        const found = sourceCatalog.find(p => p.id === hid);
        if (found && !chosenHands.some(c => c.id === found.id)) {
          chosenHands.push(found);
        }
      }
      for (const p of sourceCatalog) {
        if (!chosenHands.some(c => c.id === p.id)) {
          chosenHands.push(p);
        }
      }

      computedOptions = opts.map((opt, i) => {
        const assignedPose = chosenHands[i % chosenHands.length] || CAMERA_HAND_POSES[i % CAMERA_HAND_POSES.length];
        return {
          ...opt,
          poseId: assignedPose.id,
          poseValue: assignedPose.value,
        };
      });
    } else {
      // Classic Studio Mode: classic full-body yoga poses
      const availableClassic: StandingPoseConfig[] = [];
      for (const val of classicPoses) {
        const found = CLASSIC_YOGA_POSES.find(p => p.value === val);
        if (found) availableClassic.push(found);
        else if (isImageUrl(val)) {
          availableClassic.push({
            id: `custom-${availableClassic.length}`,
            type: 'image',
            value: val,
            name: 'Pose',
            shortHint: 'Copy this pose',
            category: 'classic',
            family: `custom-${availableClassic.length}`,
          });
        }
      }
      const pool = availableClassic.length >= opts.length ? availableClassic : CLASSIC_YOGA_POSES;
      computedOptions = opts.map((opt, i) => {
        const assignedPose = pool[i % pool.length];
        return {
          ...opt,
          poseId: assignedPose.id,
          poseValue: assignedPose.value,
        };
      });
    }

    questionOptionsCacheRef.current[cacheKey] = computedOptions;
    setShuffledOptions(computedOptions);
  }, [quiz.questions, activePoses, playMode]);

  // When switching between Classic Mode and Camera Mode during gameplay, reload current question's mode-specific poses
  useEffect(() => {
    if (gameState === 'playing') {
      loadQuestion(currentIdx, true);
    }
  }, [playMode]);

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
      loadQuestion(nextIdx, false);
    } else {
      setGameState('end');
      playSound('win');
    }
  }, [quiz.questions.length, loadQuestion]);

  const goToPreviousQuestion = useCallback(() => {
    if (currentIdx <= 0) return;
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setTimer(null);
    setShowConfetti(false);
    setRoundWinnerBanner(null);
    const prevIdx = currentIdx - 1;
    setCurrentIdx(prevIdx);
    // Retrieve the exact previous pose & options from cache
    loadQuestion(prevIdx, true);
  }, [currentIdx, loadQuestion]);

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
        const teamId = winningTeam.id;
        setTeams(prev => prev.map((t, idx) => idx === winningPlayerIndex ? { ...t, score: t.score + 1 } : t));
        setRoundWinnerBanner(`🎉 ${winningTeam.name} matched the pose! +1 Point!`);
        setScorePops(prev => ({ ...prev, [teamId]: { delta: 1, key: Date.now() + Math.random() } }));
        setTeamStreaks(prev => ({ ...prev, [teamId]: (prev[teamId] || 0) + 1 }));
      } else if (teamsRef.current.length === 1) {
        const teamId = teamsRef.current[0].id;
        setTeams(prev => prev.map((t, idx) => idx === 0 ? { ...t, score: t.score + 1 } : t));
        setRoundWinnerBanner(`🎉 Awesome Pose! +1 Point!`);
        setScorePops(prev => ({ ...prev, [teamId]: { delta: 1, key: Date.now() + Math.random() } }));
        setTeamStreaks(prev => ({ ...prev, [teamId]: (prev[teamId] || 0) + 1 }));
      } else {
        setRoundWinnerBanner(`🎉 Correct Pose!`);
      }
    } else {
      playSound('incorrect');
      setRoundWinnerBanner(`❌ Not quite! Look at the green pose!`);
      if (typeof winningPlayerIndex === 'number' && teamsRef.current[winningPlayerIndex]) {
        const teamId = teamsRef.current[winningPlayerIndex].id;
        setTeamStreaks(prev => ({ ...prev, [teamId]: 0 }));
      }
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

      // Use modelComplexity: 0 and maxNumHands: 2 for lightning-fast tracking with minimal CPU load
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 0,
        minDetectionConfidence: 0.40,
        minTrackingConfidence: 0.40
      });

      hands.onResults((results: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Dynamically sync canvas internal resolution with displayed size
        const targetW = canvas.clientWidth || window.innerWidth;
        const targetH = canvas.clientHeight || window.innerHeight;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

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

        const videoEl = videoRef.current;
        const videoW = videoEl?.videoWidth || 1280;
        const videoH = videoEl?.videoHeight || 720;

        // Render Spider-Man's hand on the left side and Thanos's Infinity Gauntlet on the right side!
        drawSuperheroHands({
          ctx,
          hands: mirroredHands,
          cw,
          ch,
          isTwoPlayers,
          playerDetections: holdStateRef.current.map(h => ({
            holdProgress: h.progress,
            matchedOptionIdx: h.optionIdx
          })),
          time: performance.now(),
          videoW,
          videoH,
        });

        if (gameStateRef.current !== 'playing' || playModeRef.current !== 'camera' || isAnsweringRef.current) {
          return;
        }

        const now = performance.now();
        const currentOptions = shuffledOptionsRef.current;
        const candidatePoseIds = currentOptions.map(o => o.poseId);

        // Partition hands into Player 1 (left half) and Player 2 (right half) WITHOUT distorting aspect ratio!
        const playerHandGroups: [
          Array<Array<{ x: number; y: number; z?: number }>>,
          Array<Array<{ x: number; y: number; z?: number }>>
        ] = isTwoPlayers
          ? [
              mirroredHands.filter(h => ((h[9]?.x ?? h[0]?.x ?? 0.5) < 0.5)),
              mirroredHands.filter(h => ((h[9]?.x ?? h[0]?.x ?? 0.5) >= 0.5)),
            ]
          : [mirroredHands, []];

        const numActiveZones = isTwoPlayers ? 2 : 1;
        const nextUiStates: [PlayerCameraDetectionState, PlayerCameraDetectionState] = [
          { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
          { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null },
        ];

        for (let pIdx = 0; pIdx < numActiveZones; pIdx++) {
          const pHold = holdStateRef.current[pIdx];
          const dtMs = Math.min(120, Math.max(16, now - (pHold.lastUpdateTime || now)));
          pHold.lastUpdateTime = now;

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

          // Push into 3-frame rolling smoothing buffer for instantaneous response without lag
          const validFramePose = poseId && confidence >= 0.68 ? poseId : null;
          pHold.recentPoses.push(validFramePose);
          if (pHold.recentPoses.length > 3) {
            pHold.recentPoses.shift();
          }

          // Determine smoothed pose: prefer current valid pose immediately
          let smoothedPoseId: string | null = validFramePose;
          if (!smoothedPoseId) {
            const counts: Record<string, number> = {};
            for (const rp of pHold.recentPoses) {
              if (rp) counts[rp] = (counts[rp] || 0) + 1;
            }
            let topPose: string | null = null;
            let topCount = 0;
            for (const [k, c] of Object.entries(counts)) {
              if (c > topCount) {
                topCount = c;
                topPose = k;
              }
            }
            if (topPose && topCount >= 2) {
              smoothedPoseId = topPose;
            }
          }

          const matchedIdx = smoothedPoseId
            ? currentOptions.findIndex(o => o.poseId === smoothedPoseId)
            : -1;

          if (smoothedPoseId && matchedIdx !== -1) {
            pHold.lastMatchedTime = now;
            if (pHold.optionIdx === matchedIdx) {
              // Ultra-fast ~0.32s responsive lock-in (starts at 42% and adds ~190% per second)
              pHold.progress = Math.min(100, Math.round(pHold.progress + (dtMs / 1000) * 190));
            } else {
              pHold.optionIdx = matchedIdx;
              pHold.poseId = smoothedPoseId;
              pHold.progress = 42;
            }
          } else {
            // Generous 220ms grace period so rapid micro-movements don't drop progress
            if (now - pHold.lastMatchedTime > 220) {
              pHold.progress = Math.max(0, Math.round(pHold.progress - (dtMs / 1000) * 110));
              if (pHold.progress === 0) {
                pHold.optionIdx = null;
                pHold.poseId = null;
              }
            }
          }

          nextUiStates[pIdx] = {
            detectedPoseId: smoothedPoseId || poseId,
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
            pHold.recentPoses = [];

            if (chosenOpt) {
              if (chosenOpt.isCorrect || !isTwoPlayers) {
                handleAnswerRef.current(chosenIdx, chosenOpt.isCorrect, pIdx);
                break;
              } else {
                playSound('incorrect');
                pHold.cooldownUntil = now + 950;
                pHold.wrongBannerUntil = now + 1300;
                nextUiStates[pIdx].wrongFeedbackText = 'Wrong pose! Try another!';
              }
            }
          }
        }

        setPlayerDetections(nextUiStates);
      });

      handsInstanceRef.current = hands;

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Camera is not supported on this browser. You can play using click-based choices!");
        setIsCameraReady(false);
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 960 },
            height: { ideal: 540 },
            frameRate: { ideal: 30 }
          }
        });
      } catch (e1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' }
          });
        } catch (e2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true
            });
          } catch (e3: any) {
            console.warn("Yoga camera unavailable:", e3?.name || e3?.message);
            setCameraError("Camera not found or permission denied. You can play directly using click/tap mode!");
            setIsCameraReady(false);
            return;
          }
        }
      }

      if (!stream) {
        setIsCameraReady(false);
        return;
      }

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
        const TARGET_INTERVAL_MS = 16;

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
      console.warn("Yoga camera setup notice:", err?.name || err?.message);
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
    questionOptionsCacheRef.current = {};
    setCurrentIdx(0);
    setTeams(teams.map(t => ({ ...t, score: 0 })));
    setGameState('playing');
    loadQuestion(0, false);
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
      if (len > 80) return 'text-sm sm:text-base md:text-lg';
      if (len > 40) return 'text-base sm:text-lg md:text-xl';
      return 'text-lg sm:text-xl md:text-2xl';
    }
    if (uiScale === 'big') { // Large
      if (len > 80) return 'text-xl sm:text-2xl md:text-3xl';
      if (len > 40) return 'text-2xl sm:text-3xl md:text-4xl';
      return 'text-3xl sm:text-4xl md:text-5xl';
    }
    // Medium (default)
    if (len > 80) return 'text-base sm:text-lg md:text-xl';
    if (len > 40) return 'text-lg sm:text-xl md:text-2xl';
    return 'text-xl sm:text-2xl md:text-3xl';
  };

  const getOptionFontSizeClass = (text: string, isMany: boolean) => {
    const len = text.length;
    if (uiScale === 'small') {
      if (len > 40 || isMany) return 'text-xs sm:text-sm md:text-base';
      return 'text-sm sm:text-base md:text-lg';
    }
    if (uiScale === 'big') { // Large
      if (len > 40 || isMany) return 'text-lg sm:text-xl md:text-2xl';
      if (len > 20) return 'text-xl sm:text-2xl md:text-3xl';
      return 'text-2xl sm:text-3xl md:text-4xl';
    }
    // Medium (default)
    if (len > 40 || isMany) return 'text-sm sm:text-base md:text-lg';
    if (len > 20) return 'text-base sm:text-lg md:text-xl';
    return 'text-lg sm:text-xl md:text-2xl';
  };

  const isTwoPlayerCamera = playMode === 'camera' && teams.length >= 2;
  const posesForCurrentModeSettings = playMode === 'studio' ? CLASSIC_YOGA_POSES : CAMERA_HAND_POSES;

  return (
    <div className={`flex-1 flex items-center justify-center p-1.5 md:p-3 mx-auto animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-teal-50 w-full h-full max-w-none' : 'w-full max-w-[1480px]'}`}>
      {showConfetti && <Confetti width={width} height={height} numberOfPieces={280} recycle={false} style={{ position: 'fixed', zIndex: 100, top: 0, left: 0 }} />}

      <style>{`
        @keyframes scoreFloat {
          0% { transform: translate(-50%, 0) scale(0.6); opacity: 0; }
          15% { transform: translate(-50%, -8px) scale(1.3); opacity: 1; }
          75% { transform: translate(-50%, -28px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -46px) scale(0.8); opacity: 0; }
        }
        .animate-score-float {
          animation: scoreFloat 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes scorePopPulse {
          0% { transform: scale(1); }
          40% { transform: scale(1.35); }
          100% { transform: scale(1); }
        }
        .animate-score-pulse {
          animation: scorePopPulse 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
      `}</style>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-teal-950/50 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] p-6 md:p-10 max-w-4xl w-full shadow-2xl relative border-4 border-teal-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                      <div className="font-black text-lg">📷 AI Camera Hand Mode</div>
                      <div className={`text-xs font-semibold ${playMode === 'camera' ? 'text-teal-50' : 'text-teal-600'}`}>
                        Only hand gestures! 1 finger, 2 fingers, 3 fingers, fist, rock & more.
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
                        Retrieves classic yoga poses (Tree, Warrior, Star, Chair, Airplane, etc.).
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

              {/* Mode-Specific Pose Selection */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <label className="block text-teal-800 font-black text-lg">
                      {playMode === 'studio'
                        ? '🧘 Classic Yoga Poses (Classic Mode)'
                        : '✋ Hand Gestures for Camera Mode (1 Finger, 2 Fingers, 3 Fingers, Fist, Rock...)'}
                    </label>
                    <p className="text-xs text-slate-500 font-semibold">
                      {playMode === 'studio'
                        ? 'Classic Studio Mode retrieves the previous full-body yoga poses.'
                        : 'Camera Mode uses only hand gestures for fast, accurate AI detection.'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    {activePoses.length} Active Gestures
                  </span>
                </div>

                {/* Quick Preset Filters */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {playMode === 'camera' ? (
                    <button
                      onClick={() => applyPosePreset('hand')}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs cursor-pointer shadow-xs"
                    >
                      ✋ Restore All Hand Gestures (1, 2, 3, Fist, Rock...)
                    </button>
                  ) : (
                    <button
                      onClick={() => applyPosePreset('classic')}
                      className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs cursor-pointer shadow-xs"
                    >
                      🔄 Restore All Classic Yoga Poses
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {posesForCurrentModeSettings.map((pose) => {
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

      {/* Main Yoga Studio Container */}
      <div
        className={`w-full overflow-hidden border-4 md:border-8 border-teal-400/90 relative flex flex-col shadow-2xl ${
          isFullscreen ? 'h-full rounded-none border-0' : 'min-h-[86vh] rounded-[2.5rem]'
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

              {/* Mode-Aware Pose Preview Strip */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 mt-6 mb-3 bg-teal-50/90 px-5 py-3 rounded-3xl border-2 border-teal-200 shadow-inner">
                {playMode === 'studio' ? (
                  <>
                    <StandingPoseFigure poseId="tree-pose" emoji="🌳" size="sm" />
                    <StandingPoseFigure poseId="warrior-pose" emoji="⚔️" size="sm" />
                    <StandingPoseFigure poseId="star-pose" emoji="⭐" size="sm" />
                    <StandingPoseFigure poseId="chair-pose" emoji="🪑" size="sm" />
                  </>
                ) : (
                  <>
                    <StandingPoseFigure poseId="1-finger" emoji="☝️" size="sm" />
                    <StandingPoseFigure poseId="2-finger" emoji="✌️" size="sm" />
                    <StandingPoseFigure poseId="3-finger" emoji="🤟" size="sm" />
                    <StandingPoseFigure poseId="fist" emoji="✊" size="sm" />
                    <StandingPoseFigure poseId="rock" emoji="🤘" size="sm" />
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl sm:text-4xl">🧘‍♀️</span>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-teal-950 tracking-tight text-center">
                  Yoga Pose Studio
                </h1>
              </div>
              <p className="text-teal-700 font-bold text-xs sm:text-base mb-6 text-center max-w-lg">
                {playMode === 'studio'
                  ? 'Classic Yoga Mode: Follow the classic full-body yoga poses and click to answer!'
                  : 'Camera Hand Mode: Show hand gestures (1 finger, 2 fingers, 3 fingers, fist, rock) to answer!'}
              </p>

              {/* Mode Selector: Camera Mode vs Classic Studio Mode */}
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
                      <span className="font-black text-base sm:text-lg">Camera Hand Mode</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${playMode === 'camera' ? 'bg-amber-300 text-slate-900' : 'bg-teal-100 text-teal-800'}`}>
                        HAND AI
                      </span>
                    </div>
                    <p className={`text-xs font-semibold leading-snug mt-0.5 ${playMode === 'camera' ? 'text-teal-50' : 'text-slate-500'}`}>
                      Only hand gestures! 1 finger, 2 fingers, 3 fingers, fist, rock & more.
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
                      Uses classic yoga poses (Tree, Warrior, Star, Chair, Airplane) & click to answer.
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
                  <span className="hidden sm:inline">Poses ({activePoses.length})</span>
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
            {/* Fullscreen Camera Backdrop for Camera Mode */}
            {playMode === 'camera' && (
              <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 bg-slate-950">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-90"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {/* Subtle dark vignette gradient to ensure HUD and cards are ultra-legible */}
                <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-transparent to-slate-950/85 pointer-events-none" />

                {/* 2-Player Split Screen Center Line & Player HUD Labels */}
                {isTwoPlayerCamera ? (
                  <div className="absolute inset-0 grid grid-cols-2 pointer-events-none">
                    {/* Player 1 Zone (Left: Spider-Man) */}
                    <div className="relative border-r-2 border-dashed border-white/40 flex flex-col justify-between p-4 pt-24 pb-44">
                      <div className="flex items-center justify-end gap-2">
                        {playerDetections[0].matchedOptionIdx !== null && (
                          <span className="bg-white/95 text-rose-950 font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-rose-400 animate-pulse">
                            <span className="text-xl leading-none">{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                            <span>Locking Answer</span>
                          </span>
                        )}
                      </div>

                      {playerDetections[0].wrongFeedbackText && (
                        <div className="self-center bg-rose-600/95 text-white font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg animate-bounce">
                          {playerDetections[0].wrongFeedbackText}
                        </div>
                      )}

                      {/* Hold Progress Bar for Player 1 */}
                      <div className="w-full max-w-sm mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                        <div
                          className="bg-gradient-to-r from-rose-500 to-red-400 h-full rounded-full transition-all duration-75"
                          style={{ width: `${playerDetections[0].holdProgress}%` }}
                        />
                        <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                          {playerDetections[0].holdProgress > 0
                            ? `Locking ${shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue || 'Answer'}... ${playerDetections[0].holdProgress}%`
                            : 'Stand on Left & Shoot Web Pose'}
                        </span>
                      </div>
                    </div>

                    {/* Player 2 Zone (Right: Thanos) */}
                    <div className="relative border-l-2 border-dashed border-white/40 flex flex-col justify-between p-4 pt-24 pb-44">
                      <div className="flex items-center justify-start gap-2">
                        {playerDetections[1].matchedOptionIdx !== null && (
                          <span className="bg-white/95 text-amber-950 font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-amber-400 animate-pulse">
                            <span className="text-xl leading-none">{shuffledOptions[playerDetections[1].matchedOptionIdx]?.poseValue}</span>
                            <span>Locking Answer</span>
                          </span>
                        )}
                      </div>

                      {playerDetections[1].wrongFeedbackText && (
                        <div className="self-center bg-rose-600/95 text-white font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg animate-bounce">
                          {playerDetections[1].wrongFeedbackText}
                        </div>
                      )}

                      {/* Hold Progress Bar for Player 2 */}
                      <div className="w-full max-w-sm mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-yellow-300 h-full rounded-full transition-all duration-75"
                          style={{ width: `${playerDetections[1].holdProgress}%` }}
                        />
                        <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                          {playerDetections[1].holdProgress > 0
                            ? `Locking ${shuffledOptions[playerDetections[1].matchedOptionIdx]?.poseValue || 'Answer'}... ${playerDetections[1].holdProgress}%`
                            : 'Stand on Right & Use Infinity Gauntlet'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 1-Player Camera Overlay */
                  <div className="absolute inset-0 p-4 pt-16 pb-44 flex flex-col justify-between pointer-events-none">
                    <div className="flex items-center justify-between px-2">
                      <span className="bg-slate-900/85 backdrop-blur-md text-white font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md border border-teal-300 flex items-center gap-2">
                        <span>🕷️ Left: Spider-Man</span>
                        <span className="text-slate-400">|</span>
                        <span>🥊 Right: Thanos Gauntlet</span>
                      </span>
                      {playerDetections[0].matchedOptionIdx !== null && (
                        <span className="bg-white/95 text-teal-950 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 border-2 border-teal-400 animate-pulse">
                          <span className="text-xl leading-none">{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                          <span>Locking Answer</span>
                        </span>
                      )}
                    </div>

                    <div className="w-full max-w-md mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                      <div
                        className="bg-gradient-to-r from-teal-400 to-emerald-300 h-full rounded-full transition-all duration-75"
                        style={{ width: `${playerDetections[0].holdProgress}%` }}
                      />
                      <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                        {playerDetections[0].holdProgress > 0
                          ? `Locking ${shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue || 'Answer'}... ${playerDetections[0].holdProgress}%`
                          : 'Stand in front of camera & copy the pose of the right answer!'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Camera Loading or Error Fallback */}
                {!isCameraReady && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center text-white z-30 pointer-events-auto">
                    {cameraError ? (
                      <>
                        <p className="text-xs sm:text-sm font-bold text-rose-300 mb-2 max-w-md">{cameraError}</p>
                        <button
                          onClick={startCamera}
                          className="px-4 py-1.5 rounded-full bg-teal-500 hover:bg-teal-600 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
                        >
                          <RefreshCw size={14} /> Retry Camera
                        </button>
                      </>
                    ) : (
                      <p className="text-sm sm:text-base font-bold text-teal-200 animate-pulse">
                        Starting High-Speed AI Pose Camera...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Top Navigation, Interactive Scoreboards & Question Header (Docked at the TOP) */}
            <div className="w-full flex flex-col z-30 shrink-0">
              <div className="w-full px-3 md:px-5 pt-2 pb-1.5 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onBack}
                    className="px-3 py-1.5 text-teal-900 hover:bg-white rounded-2xl transition-colors font-black cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <ArrowLeft size={16} /> Exit
                  </button>
                  {onSwitchMode && (
                    <button
                      onClick={onSwitchMode}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl transition-all hover:scale-105 active:scale-95 font-black cursor-pointer shadow-sm text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5"
                      title="Switch Game Mode"
                    >
                      <Shuffle size={14} className="text-amber-300" />
                      <span className="hidden sm:inline">Switch Mode</span>
                    </button>
                  )}

                  {/* Quick Toggle: Camera Mode vs Classic Studio Mode */}
                  <button
                    onClick={() => setPlayMode(prev => prev === 'camera' ? 'studio' : 'camera')}
                    className={`px-3 py-1.5 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 shadow-sm border transition-all cursor-pointer ${
                      playMode === 'camera'
                        ? 'bg-emerald-600 text-white border-emerald-700'
                        : 'bg-white/90 text-teal-900 border-teal-200 hover:bg-white'
                    }`}
                    title="Toggle between AI Camera Mode and Classic Studio Mode"
                  >
                    {playMode === 'camera' ? <Camera size={15} /> : <CameraOff size={15} />}
                    <span>{playMode === 'camera' ? 'Camera Mode' : 'Classic Mode'}</span>
                  </button>

                  {/* Retrieve Previous Question / Pose button */}
                  {currentIdx > 0 && (
                    <button
                      onClick={goToPreviousQuestion}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white text-teal-900 rounded-2xl font-black text-xs sm:text-sm border border-teal-200 shadow-sm cursor-pointer flex items-center gap-1"
                      title="Retrieve previous question and pose"
                    >
                      <span>⬅️ Prev Pose</span>
                    </button>
                  )}
                </div>

                {/* Right Controls: Progress, Font Size Popover (Small / Medium / Large), Settings, Fullscreen */}
                <div className="flex items-center gap-1.5 relative">
                  <div className="font-bold text-teal-950 bg-white/90 backdrop-blur-md px-3 py-1 rounded-2xl shadow-sm border border-teal-200 text-center flex items-center gap-1">
                    <span className="text-sm sm:text-base font-black">{currentIdx + 1}</span>
                    <span className="text-xs opacity-70">/ {quiz.questions.length}</span>
                  </div>

                  {/* Directly visible Text Size Adjuster: Small / Medium / Large */}
                  <div className="flex items-center bg-white/95 backdrop-blur-md rounded-2xl border-2 border-teal-200 p-0.5 shadow-sm">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-teal-900 px-2 flex items-center gap-1 select-none">
                      <Type size={13} className="text-teal-700" />
                      <span className="hidden md:inline">Text:</span>
                    </span>
                    {(['small', 'medium', 'big'] as const).map(scale => (
                      <button
                        key={scale}
                        onClick={() => setUiScale(scale)}
                        className={`px-2 sm:px-2.5 py-1 rounded-xl font-black text-xs transition-all cursor-pointer ${
                          uiScale === scale
                            ? 'bg-teal-600 text-white shadow-xs scale-105'
                            : 'text-slate-600 hover:text-teal-950 hover:bg-teal-50'
                        }`}
                        title={`Change font size to ${scale === 'big' ? 'Large' : scale}`}
                      >
                        {scale === 'small' ? 'Small' : scale === 'medium' ? 'Medium' : 'Large'}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-9 h-9 text-teal-900 hover:bg-white rounded-2xl transition-colors font-bold cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 flex items-center justify-center"
                    title="Settings & Pose Selection"
                  >
                    <Settings size={17} />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="w-9 h-9 text-teal-900 hover:bg-white rounded-2xl transition-colors font-bold cursor-pointer bg-white/90 backdrop-blur-md shadow-sm border border-teal-200 flex items-center justify-center"
                    title="Fullscreen"
                  >
                    {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                  </button>
                </div>
              </div>

              {/* TOP HUD ROW: Interactive Superhero Scoreboards + Question Banner (DOUBLES AS LIVE SCORE DASHBOARD) */}
              {playMode === 'camera' && isTwoPlayerCamera ? (
                <div className="w-full px-3 md:px-5 py-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                  {/* Player 1 (Spider-Man) Interactive Scoreboard */}
                  <div className="lg:col-span-3 bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.35)] p-2.5 flex items-center justify-between gap-2.5 relative transition-all hover:scale-[1.01] pointer-events-auto">
                    {scorePops[teams[0]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[0]?.id].delta} idKey={scorePops[teams[0]?.id].key} />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-red-700 flex items-center justify-center text-xl shadow-md shrink-0 border border-rose-400">
                        🕷️
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase tracking-wider text-rose-300 truncate">
                            {teams[0]?.name || 'Player 1'}
                          </span>
                        </div>
                        {teamStreaks[teams[0]?.id] >= 2 ? (
                          <span className="text-[10px] font-black text-amber-300 flex items-center gap-0.5 animate-pulse">
                            🔥 {teamStreaks[teams[0]?.id]}x STREAK!
                          </span>
                        ) : (
                          <span className="text-[9px] text-rose-300/80 font-bold tracking-wider uppercase">Spider-Man</span>
                        )}
                      </div>
                    </div>

                    {/* Big Score & Live Increment/Decrement */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateTeamScore(teams[0]?.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-black text-base active:scale-90 transition-all border border-slate-700 cursor-pointer"
                        title="Deduct 1 point"
                      >
                        -
                      </button>

                      <div
                        onClick={() => updateTeamScore(teams[0]?.id, 1)}
                        className="cursor-pointer px-1 flex flex-col items-center group"
                        title="Click to add +1 point"
                      >
                        <span
                          className={`text-3xl sm:text-4xl font-black text-white tabular-nums drop-shadow-[0_0_12px_rgba(244,63,94,0.8)] leading-none transition-transform duration-200 ${
                            scorePops[teams[0]?.id] ? 'animate-score-pulse text-rose-300' : ''
                          }`}
                        >
                          {teams[0]?.score || 0}
                        </span>
                        <span className="text-[8px] text-rose-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                          +1
                        </span>
                      </div>

                      <button
                        onClick={() => updateTeamScore(teams[0]?.id, 1)}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-rose-600/40 active:scale-90 transition-all border border-rose-400 cursor-pointer"
                        title="Add 1 point"
                      >
                        +1
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Banner (TOP OF SCREEN, NOT MIDDLE) */}
                  <div className="lg:col-span-6 flex items-center justify-center gap-2">
                    {quiz.questions[currentIdx]?.image && (
                      <div className="h-12 sm:h-14 rounded-xl overflow-hidden border-2 border-teal-300 shadow-md bg-white p-0.5 shrink-0">
                        <img
                          src={quiz.questions[currentIdx]?.image}
                          alt="Question Clue"
                          className="h-full w-auto object-contain rounded-lg"
                        />
                      </div>
                    )}
                    {currentQuestionText && (
                      <h2
                        className={`w-full font-black text-slate-950 bg-white/95 backdrop-blur-md py-2 sm:py-2.5 px-4 sm:px-6 rounded-2xl border-2 sm:border-3 border-teal-400 shadow-xl text-center leading-snug mx-auto ${
                          uiScale === 'small'
                            ? (currentQuestionText.length > 80 ? 'text-xs sm:text-sm md:text-base' : currentQuestionText.length > 40 ? 'text-sm sm:text-base md:text-lg' : 'text-base sm:text-lg md:text-xl')
                            : uiScale === 'big'
                            ? (currentQuestionText.length > 80 ? 'text-base sm:text-lg md:text-xl' : currentQuestionText.length > 40 ? 'text-lg sm:text-xl md:text-2xl' : 'text-xl sm:text-2xl md:text-3xl')
                            : (currentQuestionText.length > 80 ? 'text-sm sm:text-base md:text-lg' : currentQuestionText.length > 40 ? 'text-base sm:text-lg md:text-xl' : 'text-lg sm:text-xl md:text-2xl')
                        }`}
                      >
                        {currentQuestionText}
                      </h2>
                    )}
                  </div>

                  {/* Player 2 (Thanos) Interactive Scoreboard */}
                  <div className="lg:col-span-3 bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)] p-2.5 flex items-center justify-between gap-2.5 relative transition-all hover:scale-[1.01] pointer-events-auto">
                    {scorePops[teams[1]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[1]?.id].delta} idKey={scorePops[teams[1]?.id].key} />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-xl shadow-md shrink-0 border border-amber-300">
                        🥊
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase tracking-wider text-amber-300 truncate">
                            {teams[1]?.name || 'Player 2'}
                          </span>
                        </div>
                        {teamStreaks[teams[1]?.id] >= 2 ? (
                          <span className="text-[10px] font-black text-yellow-300 flex items-center gap-0.5 animate-pulse">
                            👑 {teamStreaks[teams[1]?.id]}x TITAN!
                          </span>
                        ) : (
                          <span className="text-[9px] text-amber-300/80 font-bold tracking-wider uppercase">Thanos Gauntlet</span>
                        )}
                      </div>
                    </div>

                    {/* Big Score & Live Increment/Decrement */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateTeamScore(teams[1]?.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center font-black text-base active:scale-90 transition-all border border-slate-700 cursor-pointer"
                        title="Deduct 1 point"
                      >
                        -
                      </button>

                      <div
                        onClick={() => updateTeamScore(teams[1]?.id, 1)}
                        className="cursor-pointer px-1 flex flex-col items-center group"
                        title="Click to add +1 point"
                      >
                        <span
                          className={`text-3xl sm:text-4xl font-black text-white tabular-nums drop-shadow-[0_0_12px_rgba(251,191,36,0.8)] leading-none transition-transform duration-200 ${
                            scorePops[teams[1]?.id] ? 'animate-score-pulse text-amber-300' : ''
                          }`}
                        >
                          {teams[1]?.score || 0}
                        </span>
                        <span className="text-[8px] text-amber-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">
                          +1
                        </span>
                      </div>

                      <button
                        onClick={() => updateTeamScore(teams[1]?.id, 1)}
                        className="w-8 h-8 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-white flex items-center justify-center font-black text-sm shadow-md shadow-amber-500/40 active:scale-90 transition-all border border-amber-300 cursor-pointer"
                        title="Add 1 point"
                      >
                        +1
                      </button>
                    </div>
                  </div>
                </div>
              ) : playMode === 'camera' ? (
                /* 1-Player Camera Mode Top HUD */
                <div className="w-full px-3 md:px-5 py-1 flex flex-col sm:flex-row items-center gap-3">
                  <div className="bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.35)] p-2.5 flex items-center justify-between gap-3 relative transition-all hover:scale-[1.01] pointer-events-auto shrink-0 w-full sm:w-auto min-w-[240px]">
                    {scorePops[teams[0]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[0]?.id].delta} idKey={scorePops[teams[0]?.id].key} />
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-xl shadow-md border border-teal-300">
                        ⚡
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-xs uppercase tracking-wider text-teal-300">
                          {teams[0]?.name || 'Player 1'}
                        </span>
                        {teamStreaks[teams[0]?.id] >= 2 && (
                          <span className="text-[10px] font-black text-amber-300 animate-pulse">
                            🔥 {teamStreaks[teams[0]?.id]}x STREAK!
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateTeamScore(teams[0]?.id, -1)}
                        className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-black text-base active:scale-90 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-3xl font-black text-white tabular-nums px-1">
                        {teams[0]?.score || 0}
                      </span>
                      <button
                        onClick={() => updateTeamScore(teams[0]?.id, 1)}
                        className="w-8 h-8 rounded-lg bg-teal-500 hover:bg-teal-400 text-white flex items-center justify-center font-black text-sm active:scale-90 cursor-pointer shadow-md"
                      >
                        +1
                      </button>
                    </div>
                  </div>

                  {/* Question Banner */}
                  {(currentQuestionText || quiz.questions[currentIdx]?.image) && (
                    <div className="flex-1 w-full flex items-center justify-center gap-2">
                      {quiz.questions[currentIdx]?.image && (
                        <div className="h-12 sm:h-14 rounded-xl overflow-hidden border-2 border-teal-300 shadow-md bg-white p-0.5 shrink-0">
                          <img
                            src={quiz.questions[currentIdx]?.image}
                            alt="Question Clue"
                            className="h-full w-auto object-contain rounded-lg"
                          />
                        </div>
                      )}
                      {currentQuestionText && (
                        <h2
                          className={`w-full font-black text-slate-950 bg-white/95 backdrop-blur-md py-2 sm:py-2.5 px-4 sm:px-6 rounded-2xl border-2 sm:border-3 border-teal-400 shadow-xl text-center leading-snug mx-auto ${
                            uiScale === 'small' ? 'text-sm sm:text-base md:text-lg' : uiScale === 'big' ? 'text-lg sm:text-xl md:text-2xl' : 'text-base sm:text-lg md:text-xl'
                          }`}
                        >
                          {currentQuestionText}
                        </h2>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Classic Studio Mode Top HUD */
                <div className="w-full px-3 md:px-5 py-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {teams.map((team) => {
                      const theme = teamColors[team.colorIdx];
                      return (
                        <div
                          key={team.id}
                          className={`flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-2xl border-2 ${theme.border} shadow-sm relative`}
                        >
                          {scorePops[team.id]?.key && (
                            <FloatingScoreBadge delta={scorePops[team.id].delta} idKey={scorePops[team.id].key} />
                          )}
                          <span className="font-black text-xs sm:text-sm text-slate-800">{team.name}</span>
                          <span className={`text-xl sm:text-2xl font-black tabular-nums ${theme.text}`}>
                            {team.score}
                          </span>
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => updateTeamScore(team.id, -1)}
                              className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-black text-xs active:scale-90 cursor-pointer"
                            >
                              -
                            </button>
                            <button
                              onClick={() => updateTeamScore(team.id, 1)}
                              className={`w-7 h-7 rounded-lg ${theme.bg} hover:brightness-110 text-white flex items-center justify-center font-black text-xs active:scale-90 cursor-pointer shadow-sm`}
                            >
                              +1
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Middle Camera Viewport (Face & Upper Body completely unblocked!) */}
            <div className="flex-1 min-h-[100px] pointer-events-none flex flex-col items-center justify-center relative z-20">
              {roundWinnerBanner && (
                <div className="px-6 py-2.5 rounded-full bg-slate-950/90 text-white font-black text-sm sm:text-base shadow-2xl border-2 border-teal-400 animate-bounce">
                  {roundWinnerBanner}
                </div>
              )}
            </div>


            {/* Question & Options Stage */}
            <div
              className={`px-3 sm:px-5 ${
                playMode === 'camera'
                  ? 'pb-4 pt-1 shrink-0'
                  : 'pb-5 pt-1 flex-grow flex flex-col justify-center overflow-y-auto'
              }`}
            >
              {/* Question Prompt in Classic Studio Mode */}
              {playMode === 'studio' && (
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
              )}

              {/* Options Grid — Pose Illustration + Answer Choice */}
              <div
                className={`grid ${
                  shuffledOptions.length <= 2
                    ? 'grid-cols-2 max-w-3xl'
                    : shuffledOptions.length === 3
                    ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl'
                    : 'grid-cols-2 md:grid-cols-4 max-w-[1400px]'
                } gap-2 sm:gap-3.5 w-full mx-auto justify-center items-stretch`}
              >
                {shuffledOptions.map((opt, index) => {
                  const isMany = shuffledOptions.length > 4;
                  const isImageOption = Boolean(opt.image);

                  const p1Locking = playMode === 'camera' && playerDetections[0].matchedOptionIdx === index && !isAnswering;
                  const p2Locking = isTwoPlayerCamera && playerDetections[1].matchedOptionIdx === index && !isAnswering;

                  let btnClasses = `flex-1 min-w-0 bg-white/95 border-3 sm:border-4 border-teal-100 text-slate-800 font-bold p-3 sm:p-4 rounded-3xl transition-all duration-200 flex flex-col items-center justify-between text-center shadow-lg relative group outline-none overflow-hidden min-h-[92px] sm:min-h-[112px] `;

                  if (isAnswering) {
                    if (index === selectedOption) {
                      if (opt.isCorrect) {
                        btnClasses += "bg-emerald-100 border-emerald-600 text-emerald-950 scale-[1.02] z-10 shadow-2xl";
                      } else {
                        btnClasses += "bg-rose-100 border-rose-600 text-rose-950";
                      }
                    } else if (opt.isCorrect) {
                      btnClasses += "bg-emerald-100 border-emerald-600 text-emerald-950 scale-[1.02] z-10 shadow-2xl";
                    } else {
                      btnClasses += "opacity-55 scale-95";
                    }
                  } else if (p1Locking || p2Locking) {
                    btnClasses += "border-teal-500 bg-teal-50/95 scale-[1.02] shadow-2xl ring-4 ring-teal-400/50 cursor-pointer";
                  } else {
                    btnClasses += "hover:border-teal-400 hover:bg-teal-50/60 hover:shadow-xl hover:scale-[1.01] cursor-pointer";
                  }

                  return (
                    <button
                      key={index}
                      disabled={isAnswering}
                      onClick={() => handleAnswer(index, opt.isCorrect)}
                      className={btnClasses}
                    >
                      {/* Correct / Incorrect Indicator */}
                      {isAnswering && (index === selectedOption || opt.isCorrect) && (
                        <div
                          className={`absolute top-2 right-2 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-base sm:text-xl font-black shadow-md z-30 animate-bounce ${
                            opt.isCorrect ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        >
                          {opt.isCorrect ? '✓' : '✗'}
                        </div>
                      )}

                      {/* Picture if Option has Image (clean, no person cartoon) */}
                      {isImageOption && (
                        <div className="w-full h-20 sm:h-28 my-1 rounded-xl overflow-hidden bg-slate-50 border border-teal-100 flex items-center justify-center shrink-0">
                          <img
                            src={opt.image}
                            alt={opt.text || `Option ${index + 1}`}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Option Answer Text: BIGGER & PROMINENT */}
                      {opt.text ? (
                        <span
                          className={`${getOptionFontSizeClass(opt.text, isMany)} font-black text-slate-900 leading-snug w-full flex items-center justify-center break-words px-2 py-1.5 flex-grow`}
                        >
                          {opt.text}
                        </span>
                      ) : null}

                      {/* Gesture Emoji: BIGGER & NO WORDS */}
                      <div className="mt-1.5 inline-flex items-center justify-center p-2 sm:p-2.5 bg-gradient-to-b from-teal-50 to-teal-100/90 border-2 border-teal-200/90 rounded-2xl shadow-xs shrink-0 select-none group-hover:scale-110 transition-transform">
                        <span className="text-3xl sm:text-4xl md:text-5xl leading-none">{opt.poseValue}</span>
                      </div>

                      {/* Live Camera Hold-to-Select Bar on the Card */}
                      {(p1Locking || p2Locking) && (
                        <div className="w-full mt-2 space-y-1">
                          {p1Locking && (
                            <div className="w-full bg-blue-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-600 h-full transition-all duration-75"
                                style={{ width: `${playerDetections[0].holdProgress}%` }}
                              />
                            </div>
                          )}
                          {p2Locking && (
                            <div className="w-full bg-rose-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-rose-600 h-full transition-all duration-75"
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
            <div className="w-full bg-teal-200/70 h-2.5 absolute bottom-0 left-0 shrink-0 overflow-hidden">
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
