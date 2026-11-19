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
  Check,
  Volume2,
  VolumeX,
  Snowflake,
  Trophy
} from 'lucide-react';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { playSound } from '../lib/audio';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { GameModeModal } from "../components/GameModeModal";
import { drawSuperheroHands } from "../utils/superheroHands";
import { SetupCurriculumHeader, SmartQuestionInput, SmartOptionInput, convertQuestionsContentMode } from "../components/SetupSmartControls";
import { OptionContentMode, getInstantCartoonPng, fetchRecommendedCartoonPng, parseOptionContent, formatOptionContent } from "../utils/mediaAndPresets";
import { BodyHeadToFeetSetupScanner, CityPoseChase3DGameplay, normalizeChaseQuestions } from "./CityPoseChase";
import { UnifiedGameSetup } from "../components/UnifiedGameSetup";
import { FullscreenButton } from "../components/FullscreenButton";
import { persistUserGameToCloudAndCache } from "../utils/platformCache";

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

// Shared pre-warmed MediaPipe Hands singleton for zero-wait camera startup
let sharedYogaHandsInstance: any = null;
let sharedYogaHandsInitPromise: Promise<any> | null = null;
let sharedYogaHandsResultsListener: ((results: any) => void) | null = null;

function getOrPrewarmYogaHands(): Promise<any> {
  if (sharedYogaHandsInstance) {
    return Promise.resolve(sharedYogaHandsInstance);
  }
  if (sharedYogaHandsInitPromise) {
    return sharedYogaHandsInitPromise;
  }

  sharedYogaHandsInitPromise = new Promise((resolve, reject) => {
    const tryInit = (attempt = 0) => {
      const win = typeof window !== 'undefined' ? (window as any) : null;
      if (!win || !win.Hands) {
        if (attempt < 25) {
          setTimeout(() => tryInit(attempt + 1), 120);
          return;
        }
        sharedYogaHandsInitPromise = null;
        reject(new Error('Camera AI module is still loading. Please try again in a moment.'));
        return;
      }

      try {
        const hands = new win.Hands({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45,
        });

        hands.onResults((results: any) => {
          if (sharedYogaHandsResultsListener) {
            sharedYogaHandsResultsListener(results);
          }
        });

        sharedYogaHandsInstance = hands;
        if (typeof hands.initialize === 'function') {
          Promise.resolve(hands.initialize())
            .then(() => resolve(hands))
            .catch(() => resolve(hands));
        } else {
          resolve(hands);
        }
      } catch (err) {
        sharedYogaHandsInitPromise = null;
        reject(err);
      }
    };

    tryInit();
  });

  return sharedYogaHandsInitPromise;
}

/**
 * Scale-invariant & aspect-corrected biomechanical hand gesture detector.
 * Evaluates MediaPipe 21-point hand landmarks using phalanx joint angles (PIP cosine curl),
 * tip-to-wrist vs PIP/DIP distances, tip-to-MCP span, and relative finger dominance.
 * Supports: 1 Finger, 2 Fingers, 3 Fingers, Fist, Rock, 5 Fingers, Thumbs Up, OK Sign, 4 Fingers, Shaka.
 */
function detectStandingPoseFromHands(
  hands: Array<Array<{ x: number; y: number; z?: number }>>,
  candidatePoseIds: string[],
  videoAspect = 1.5
): { poseId: string | null; confidence: number } {
  if (!hands || hands.length === 0) {
    return { poseId: null, confidence: 0 };
  }

  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const normRange = (v: number, min: number, max: number) =>
    clamp01((v - min) / Math.max(1e-5, max - min));

  // Aspect-corrected 3D-aware distance so tilted hands have consistent geometry
  const dist = (
    a: { x: number; y: number; z?: number },
    b: { x: number; y: number; z?: number }
  ) => {
    const dx = (a.x - b.x) * videoAspect;
    const dy = a.y - b.y;
    const dz = ((a.z ?? 0) - (b.z ?? 0)) * 0.35;
    return Math.hypot(dx, dy, dz);
  };

  // Joint straightness cosine between (mcp -> pip) and (pip -> tip):
  // +1.0 = straight extended finger, < 0.25 = curled/folded finger
  const fingerStraightCos = (
    mcp: { x: number; y: number; z?: number },
    pip: { x: number; y: number; z?: number },
    tip: { x: number; y: number; z?: number }
  ) => {
    const v1x = (pip.x - mcp.x) * videoAspect;
    const v1y = pip.y - mcp.y;
    const v2x = (tip.x - pip.x) * videoAspect;
    const v2y = tip.y - pip.y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);
    if (mag1 < 1e-4 || mag2 < 1e-4) return 0;
    return (v1x * v2x + v1y * v2y) / (mag1 * mag2);
  };

  const analyzeSingleHand = (lm: Array<{ x: number; y: number; z?: number }>) => {
    const wrist = lm[0];
    const palmLength = dist(lm[9], wrist);
    const knuckleWidth = dist(lm[5], lm[17]);
    const palmSize = Math.max(0.04, Math.max(palmLength, knuckleWidth * 1.15));

    const computeFingerScore = (
      mcpIdx: number,
      pipIdx: number,
      dipIdx: number,
      tipIdx: number,
      isPinky = false
    ) => {
      const mcp = lm[mcpIdx];
      const pip = lm[pipIdx];
      const dip = lm[dipIdx];
      const tip = lm[tipIdx];

      const dTipWrist = dist(tip, wrist);
      const dDipWrist = Math.max(0.01, dist(dip, wrist));
      const dPipWrist = Math.max(0.01, dist(pip, wrist));
      const dMcpWrist = Math.max(0.01, dist(mcp, wrist));

      const wristRatio = dTipWrist / dPipWrist;
      const dipRatio = dTipWrist / dDipWrist;
      const mcpRatio = dTipWrist / dMcpWrist;
      const mcpSpan = dist(tip, mcp) / palmSize;
      const cosStraight = fingerStraightCos(mcp, pip, tip);

      // If fingertip is closer to wrist than DIP/PIP or folded back sharply, it is definitely curled
      if (dipRatio < 0.96 || wristRatio < 1.02 || cosStraight < 0.05) {
        return {
          score: clamp01(normRange(wristRatio, 0.85, 1.05) * 0.25),
          wristRatio,
          cosStraight,
          mcpSpan,
        };
      }

      const cosPart = normRange(cosStraight, 0.12, 0.82);
      const ratioPart = normRange(wristRatio, 1.04, isPinky ? 1.24 : 1.28);
      const spanPart = normRange(mcpSpan, isPinky ? 0.34 : 0.42, isPinky ? 0.72 : 0.82);
      const mcpPart = normRange(mcpRatio, 1.12, isPinky ? 1.50 : 1.62);

      const score = clamp01(cosPart * 0.38 + ratioPart * 0.30 + spanPart * 0.18 + mcpPart * 0.14);
      return { score, wristRatio, cosStraight, mcpSpan };
    };

    const idxF = computeFingerScore(5, 6, 7, 8, false);
    const midF = computeFingerScore(9, 10, 11, 12, false);
    const rngF = computeFingerScore(13, 14, 15, 16, false);
    const pnkF = computeFingerScore(17, 18, 19, 20, true);

    const indexScore = idxF.score;
    const middleScore = midF.score;
    const ringScore = rngF.score;
    const pinkyScore = pnkF.score;

    const indexExtended = indexScore >= 0.52;
    const middleExtended = middleScore >= 0.52;
    const ringExtended = ringScore >= 0.50;
    const pinkyExtended = pinkyScore >= 0.48;

    // Thumb metrics
    const thumbTip = lm[4];
    const thumbIp = lm[3];
    const thumbMcp = lm[2];
    const thumbToIndexMcp = dist(thumbTip, lm[5]) / palmSize;
    const thumbToMiddlePip = dist(thumbTip, lm[10]) / palmSize;
    const thumbSpread =
      thumbToIndexMcp > 0.52 &&
      dist(thumbTip, lm[17]) > dist(thumbMcp, lm[17]) * 1.14 &&
      thumbToMiddlePip > 0.45;

    // Distinct vertical thumbs-up (thumb extended well above curled knuckles)
    const thumbUpVertical =
      thumbTip.y < thumbIp.y - palmSize * 0.08 &&
      thumbTip.y < lm[5].y - palmSize * 0.12 &&
      thumbToIndexMcp > 0.48;

    const fourFingersCount =
      (indexExtended ? 1 : 0) +
      (middleExtended ? 1 : 0) +
      (ringExtended ? 1 : 0) +
      (pinkyExtended ? 1 : 0);

    const totalOpenCount = fourFingersCount + (thumbSpread ? 1 : 0);
    const maxFourScore = Math.max(indexScore, middleScore, ringScore, pinkyScore);
    const avgFourScore = (indexScore + middleScore + ringScore + pinkyScore) * 0.25;

    // Closed fist: all 4 fingers curled down
    const fingersCurled =
      (fourFingersCount === 0 && maxFourScore < 0.52) ||
      (maxFourScore < 0.46 && avgFourScore < 0.36);

    // Pinch distance for OK sign
    const pinchDist = dist(thumbTip, lm[8]) / palmSize;
    const isOkPinch =
      pinchDist < 0.42 &&
      middleScore > 0.52 &&
      ringScore > 0.48 &&
      indexScore < 0.65;

    // Relative extension dominances using continuous scores
    const pointDominance = indexScore - Math.max(middleScore, ringScore, pinkyScore);
    const middleDominance = middleScore - Math.max(indexScore, ringScore, pinkyScore);
    const peaceDominance = Math.min(indexScore, middleScore) - Math.max(ringScore, pinkyScore);
    const rockDominance = Math.min(indexScore, pinkyScore) - Math.max(middleScore, ringScore);
    const classic3Dominance = Math.min(indexScore, middleScore, ringScore) - pinkyScore;

    // Middle finger ("dirty finger") check: middle finger distinctly extended while index, ring, and pinky are curled down
    const dMidTip = dist(lm[12], wrist);
    const dIdxTip = dist(lm[8], wrist);
    const dRngTip = dist(lm[16], wrist);
    const dPnkTip = dist(lm[20], wrist);
    const isMiddleFingerOnly =
      !isOkPinch &&
      middleScore >= 0.58 &&
      Math.max(indexScore, ringScore, pinkyScore) < 0.42 &&
      middleDominance >= 0.24 &&
      dMidTip > dIdxTip * 1.15 &&
      dMidTip > dRngTip * 1.15 &&
      dMidTip > dPnkTip * 1.18;

    return {
      indexScore,
      middleScore,
      ringScore,
      pinkyScore,
      indexExtended,
      middleExtended,
      ringExtended,
      pinkyExtended,
      thumbSpread,
      thumbUpVertical,
      fourFingersCount,
      totalOpenCount,
      maxFourScore,
      avgFourScore,
      fingersCurled,
      isOkPinch,
      pointDominance,
      middleDominance,
      isMiddleFingerOnly,
      peaceDominance,
      rockDominance,
      classic3Dominance,
    };
  };

  const analyzed = hands.map(analyzeSingleHand);

  // Immediate priority check for bad action (middle finger gesture)
  for (const h of analyzed) {
    if (h.isMiddleFingerOnly) {
      return { poseId: 'dirty-finger', confidence: 0.96 };
    }
  }

  const scores: Record<string, number> = {};
  const expectsThumbsUp = candidatePoseIds.includes('thumbs-up');

  for (const h of analyzed) {
    // 1. Closed Fist (✊) - all 4 fingers curled
    if (h.fingersCurled && !h.isOkPinch && (!expectsThumbsUp || !h.thumbUpVertical)) {
      const fistConf = clamp01(0.88 + (0.48 - h.avgFourScore) * 0.25);
      scores['fist'] = Math.max(scores['fist'] || 0, fistConf);
      scores['power-fist'] = Math.max(scores['power-fist'] || 0, fistConf * 0.98);
    }

    // 2. 1 Finger / Point Up (☝️) - index extended, middle/ring/pinky curled
    const othersMaxFor1 = Math.max(h.middleScore, h.ringScore, h.pinkyScore);
    if (
      !h.isOkPinch &&
      h.indexScore >= 0.50 &&
      ((othersMaxFor1 < 0.48 && h.pointDominance >= 0.16) ||
        (h.indexScore >= 0.62 && othersMaxFor1 < 0.53 && h.pointDominance >= 0.24))
    ) {
      const oneConf = clamp01(0.86 + h.pointDominance * 0.22);
      scores['1-finger'] = Math.max(scores['1-finger'] || 0, oneConf);
      scores['point-up'] = Math.max(scores['point-up'] || 0, oneConf);
    }

    // 3. 2 Fingers / Peace (✌️) - index & middle extended, ring & pinky curled
    const minIdxMid = Math.min(h.indexScore, h.middleScore);
    const maxRingPinky = Math.max(h.ringScore, h.pinkyScore);
    if (
      minIdxMid >= 0.50 &&
      ((maxRingPinky < 0.48 && h.peaceDominance >= 0.14) ||
        (minIdxMid >= 0.60 && maxRingPinky < 0.53 && h.peaceDominance >= 0.22))
    ) {
      const twoConf = clamp01(0.86 + h.peaceDominance * 0.22);
      scores['2-finger'] = Math.max(scores['2-finger'] || 0, twoConf);
      scores['peace'] = Math.max(scores['peace'] || 0, twoConf);
    }

    // 4. 3 Fingers / Sign (🤟) - supports:
    //    a) ASL 🤟 / Rock 🤘: Index + Pinky extended, Middle + Ring curled
    //    b) Classic 3 Fingers: Index + Middle + Ring extended, Pinky curled
    //    c) Middle + Ring + Pinky extended, Index curled (non-pinch 3 fingers)
    const isRockOrIly =
      Math.min(h.indexScore, h.pinkyScore) >= 0.48 &&
      Math.max(h.middleScore, h.ringScore) < 0.49 &&
      h.rockDominance >= 0.12;
    const isClassic3 =
      Math.min(h.indexScore, h.middleScore, h.ringScore) >= 0.50 &&
      h.pinkyScore < 0.47 &&
      h.classic3Dominance >= 0.14;
    const isOuter3 =
      !h.isOkPinch &&
      Math.min(h.middleScore, h.ringScore, h.pinkyScore) >= 0.50 &&
      h.indexScore < 0.45;

    if (isRockOrIly || isClassic3 || isOuter3) {
      const dom3 = Math.max(
        isRockOrIly ? h.rockDominance : 0,
        isClassic3 ? h.classic3Dominance : 0,
        isOuter3 ? Math.min(h.middleScore, h.ringScore, h.pinkyScore) - h.indexScore : 0
      );
      const threeConf = clamp01(0.86 + dom3 * 0.22);
      scores['3-finger'] = Math.max(scores['3-finger'] || 0, threeConf);
      if (isRockOrIly) {
        scores['rock'] = Math.max(scores['rock'] || 0, threeConf);
        scores['rock-on'] = Math.max(scores['rock-on'] || 0, threeConf);
      }
    }

    // 5. 4 Fingers (🖖) - all 4 fingers extended, thumb tucked
    const minAll4 = Math.min(h.indexScore, h.middleScore, h.ringScore, h.pinkyScore);
    if (minAll4 >= 0.52 && !h.thumbSpread) {
      scores['4-finger'] = Math.max(scores['4-finger'] || 0, clamp01(0.85 + minAll4 * 0.14));
    }

    // 6. 5 Fingers / Open Palm (🖐️) - all 4 fingers + thumb open wide
    if (minAll4 >= 0.50 && (h.thumbSpread || h.totalOpenCount >= 5)) {
      const fiveConf = clamp01(0.87 + h.avgFourScore * 0.12);
      scores['5-finger'] = Math.max(scores['5-finger'] || 0, fiveConf);
      scores['star-hands'] = Math.max(scores['star-hands'] || 0, fiveConf);
      scores['hands-up'] = Math.max(scores['hands-up'] || 0, fiveConf * 0.96);
    }

    // 7. Thumbs Up (👍) - thumb pointing up and fingers curled
    if (h.thumbUpVertical && h.maxFourScore < 0.50) {
      scores['thumbs-up'] = Math.max(scores['thumbs-up'] || 0, 0.94);
    }

    // 8. OK Sign (👌) - thumb and index pinched into circle with outer fingers extended
    if (h.isOkPinch) {
      scores['ok-sign'] = Math.max(scores['ok-sign'] || 0, 0.94);
      scores['ok-pose'] = Math.max(scores['ok-pose'] || 0, 0.94);
    }

    // 9. Shaka / Call Me (🤙) - thumb and pinky extended, index/middle/ring curled
    if (
      h.thumbSpread &&
      h.pinkyScore >= 0.50 &&
      Math.max(h.indexScore, h.middleScore, h.ringScore) < 0.46
    ) {
      scores['shaka'] = Math.max(scores['shaka'] || 0, 0.94);
    }
  }

  // Match against candidate poses on screen with highest graded score winning
  let bestCandidate: string | null = null;
  let bestCandidateScore = 0;

  for (const cid of candidatePoseIds) {
    const s =
      scores[cid] ||
      (cid === '1-finger' ? scores['point-up'] : 0) ||
      (cid === 'point-up' ? scores['1-finger'] : 0) ||
      (cid === '2-finger' ? scores['peace'] : 0) ||
      (cid === 'peace' ? scores['2-finger'] : 0) ||
      (cid === '3-finger'
        ? Math.max(scores['3-finger'] || 0, scores['rock'] || 0, scores['rock-on'] || 0)
        : 0) ||
      (cid === 'rock' ? Math.max(scores['rock'] || 0, scores['3-finger'] || 0) : 0) ||
      (cid === 'rock-on' ? Math.max(scores['rock-on'] || 0, scores['3-finger'] || 0) : 0) ||
      (cid === '5-finger' ? scores['star-hands'] || scores['hands-up'] : 0) ||
      (cid === 'star-hands' ? scores['5-finger'] : 0) ||
      (cid === 'fist' ? scores['power-fist'] : 0) ||
      (cid === 'power-fist' ? scores['fist'] : 0) ||
      (cid === 'ok-sign' ? scores['ok-pose'] : 0) ||
      (cid === 'ok-pose' ? scores['ok-sign'] : 0) ||
      0;

    if (s > bestCandidateScore) {
      bestCandidateScore = s;
      bestCandidate = cid;
    }
  }

  if (bestCandidate && bestCandidateScore >= 0.72) {
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

  return { poseId: bestOverallScore >= 0.75 ? bestOverall : null, confidence: bestOverallScore };
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

  const savingQuizRef = useRef(false);
  const handleSaveQuiz = async (quiz: Quiz) => {
    if (savingQuizRef.current) return;
    savingQuizRef.current = true;
    try {
      const isPublicBool = Boolean(quiz.isPublic);
      const now = new Date().toISOString();

      const gameToSave = JSON.parse(
        JSON.stringify({
          name: quiz.title || quiz.topic || "Yoga Studio Quiz",
          title: quiz.title || quiz.topic || "Yoga Studio Quiz",
          folderId: quiz.folderId || "",
          topic: quiz.topic || "",
          className: quiz.classLevel || "",
          gameType: "yoga-quiz",
          customQuestions: quiz.questions,
          userId: user?.uid || 'local-user',
          creatorName: user?.displayName || user?.email?.split('@')[0] || "Teacher",
          creatorEmail: user?.email || "",
          updatedAt: now,
          publishedAt: isPublicBool ? now : (initialGame?.publishedAt || null),
          createdAt: initialGame?.createdAt || now,
          isPublic: isPublicBool,
        })
      );

      await persistUserGameToCloudAndCache(db, user, gameToSave, {
        existingGame: initialGame,
      });
      onViewChange("games");
    } catch (error: any) {
      console.error("Error saving game:", error);
      onViewChange("games");
    } finally {
      savingQuizRef.current = false;
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

  const [activeQuizOverride, setActiveQuizOverride] = useState<Quiz | null>(null);
  const currentQuizData = activeQuizOverride || getQuizData();

  if (screen === 'editor') {
    return (
      <div id="yoga-editor-container" className="w-full min-h-full flex-1 relative">
        <QuizEditor
          quiz={currentQuizData}
          onSave={handleSaveQuiz}
          onPlayDirect={(updatedQuiz) => {
            setActiveQuizOverride(updatedQuiz);
            setScreen('game');
          }}
          onCancel={() => onViewChange("games")}
          folders={folders}
        />
      </div>
    );
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
        onEditQuestions={() => setScreen('editor')}
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

function QuizEditor({
  quiz,
  onSave,
  onPlayDirect,
  onCancel,
  folders
}: {
  quiz: Quiz;
  onSave: (q: Quiz) => void;
  onPlayDirect?: (q: Quiz) => void;
  onCancel: () => void;
  folders: { id: string; name: string }[];
}) {
  const [folderId, setFolderId] = useState(quiz.folderId || "");
  const [topic, setTopic] = useState(quiz.topic || "");
  const [classLevel, setClassLevel] = useState(quiz.classLevel || "");
  const [localFolders, setLocalFolders] = useState<{ id: string; name: string }[]>(folders || []);
  const [contentMode, setContentMode] = useState<OptionContentMode>("words");
  const [autoRecommendPhoto, setAutoRecommendPhoto] = useState<boolean>(false);
  const [questions, setQuestions] = useState<Question[]>(() => {
    return quiz.questions.map(q => ({
      ...q,
      options: q.options || ["", ""],
      optionImages: q.optionImages || Array(q.options?.length || 2).fill(null)
    }));
  });
  const [errorMsg, setErrorMsg] = useState("");
  
  const [activeMediaPicker, setActiveMediaPicker] = useState<
    | { type: 'option'; qId: number | string; optIndex: number; initialQuery?: string }
    | { type: 'question'; qId: number | string; initialQuery?: string }
    | null
  >(null);

  useEffect(() => {
    setLocalFolders(folders || []);
  }, [folders]);

  const handleContentModeChange = async (nextMode: OptionContentMode) => {
    setContentMode(nextMode);
    if (nextMode === "words") {
      setQuestions((prev) =>
        prev.map((q) => ({
          ...q,
          optionImages: Array(q.options.length).fill(null),
        }))
      );
      setToastMsg("📝 Switched options to Words Only!");
      setTimeout(() => setToastMsg(""), 3000);
      return;
    }

    const updated = await Promise.all(
      questions.map(async (q) => {
        const nextImgs = [...(q.optionImages || Array(q.options.length).fill(null))];
        for (let i = 0; i < q.options.length; i++) {
          const word = (q.options[i] || "").trim();
          if (!nextImgs[i] && word) {
            const pic = getInstantCartoonPng(word) || (await fetchRecommendedCartoonPng(word));
            if (pic) nextImgs[i] = pic;
          }
        }
        return { ...q, optionImages: nextImgs };
      })
    );
    setQuestions(updated);
    setToastMsg(
      nextMode === "photos_gifs"
        ? "🎨 Auto-matched Cartoon PNGs for options!"
        : "✨ Enabled Both (Words + Auto Cartoon PNGs)!"
    );
    setTimeout(() => setToastMsg(""), 3000);
  };

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
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOptionCombined = (qId: number | string, optIndex: number, combinedVal: string) => {
    const parsed = parseOptionContent(combinedVal);
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        const newOptions = [...q.options];
        const newImgs = [...(q.optionImages || Array(q.options.length).fill(null))];
        while (newImgs.length < q.options.length) newImgs.push(null);

        if (parsed.mode === 'image') {
          newImgs[optIndex] = parsed.imageUrl || null;
        } else if (parsed.mode === 'both') {
          newOptions[optIndex] = parsed.text;
          newImgs[optIndex] = parsed.imageUrl || null;
        } else {
          newOptions[optIndex] = parsed.text;
          newImgs[optIndex] = null;
        }
        return { ...q, options: newOptions, optionImages: newImgs };
      }
      return q;
    }));
  };

  const updateOptionImage = (qId: number | string, optIndex: number, imgUrl: string) => {
    setQuestions(prev => prev.map(q => {
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

  const updateQuestionImage = (qId: number | string, imgUrl: string | null) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId) {
        const parsedQ = parseOptionContent(q.text || '');
        const copy = { ...q, text: parsedQ.text };
        if (imgUrl) {
          copy.image = imgUrl;
          copy.imageUrl = imgUrl;
        } else {
          delete copy.image;
          delete copy.imageUrl;
        }
        return copy;
      }
      return q;
    }));
  };

  const addOption = (qId: number | string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qId && q.options.length < 6) {
        const newImgs = q.optionImages ? [...q.optionImages, null] : Array(q.options.length + 1).fill(null);
        return { ...q, options: [...q.options, ''], optionImages: newImgs };
      }
      return q;
    }));
  };

  const removeOption = (qId: number | string) => {
    setQuestions(prev => prev.map(q => {
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

  const sanitizeQuestionsForSave = (): Question[] => {
    return questions
      .filter(q => (q.text && q.text.trim()) || q.image || q.options.some((o, i) => (o && o.trim()) || q.optionImages?.[i]))
      .map(q => {
        const parsedQ = parseOptionContent(q.text || '');
        const cleanQImg = q.image || q.imageUrl || parsedQ.imageUrl || undefined;
        const nextOpts = [...q.options];
        const nextImgs = [...(q.optionImages || Array(q.options.length).fill(null))];
        for (let i = 0; i < nextOpts.length; i++) {
          const parsedOpt = parseOptionContent(nextOpts[i] || '');
          const img = nextImgs[i] || parsedOpt.imageUrl || (contentMode !== 'words' ? getInstantCartoonPng(parsedOpt.text) : null);
          nextImgs[i] = img || null;
          nextOpts[i] = contentMode === 'photos_gifs' && img ? '' : parsedOpt.text;
        }
        const nextQ: Question = {
          id: q.id,
          text: parsedQ.text,
          options: nextOpts,
          answerIndex: q.answerIndex,
          optionImages: nextImgs,
        };
        if (cleanQImg) {
          nextQ.image = cleanQImg;
          nextQ.imageUrl = cleanQImg;
        }
        return nextQ;
      });
  };

  const handleSave = () => {
    const validQuestions = sanitizeQuestionsForSave();
    if (validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question or picture question.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    setShowPublishModal(true);
  };

  const handlePlayArena = () => {
    const validQuestions = sanitizeQuestionsForSave();
    if (validQuestions.length === 0) {
      setErrorMsg("Please add at least one complete question before playing.");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }
    if (onPlayDirect) {
      onPlayDirect({
        ...quiz,
        title: topic.trim() ? topic.trim() : (quiz.title || "Yoga Studio Quiz"),
        folderId,
        topic,
        classLevel,
        questions: validQuestions,
      });
    }
  };

  const confirmSave = (isPublic: boolean) => {
    const generatedTitle = topic.trim() ? topic.trim() : "Yoga Studio Quiz";
    const validQuestions = sanitizeQuestionsForSave();
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
      <div className="w-full min-h-full flex flex-col items-center py-6 px-4">
      <div className="w-full max-w-4xl glass-panel rounded-3xl overflow-hidden flex flex-col shadow-2xl mb-8">
        <div className="bg-white dark:bg-slate-800/80 p-6 sm:p-8 flex flex-col gap-6 border-b-2 border-blue-500/50">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-black text-sm transition-colors cursor-pointer border border-slate-300 dark:border-slate-600"
                  >
                    <ArrowLeft size={18} />
                    <span>Back</span>
                  </button>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-wide">
                    YOGA QUIZ SETUP
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2.5 items-center">
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-lg shadow-blue-500/30 cursor-pointer text-sm sm:text-base"
                    >
                        <Save size={18} />
                        <span>Save Quiz</span>
                    </button>
                    <FullscreenButton targetId="yoga-editor-container" className="bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-600" />
                </div>
            </div>
            
            <SetupCurriculumHeader
              topic={topic}
              setTopic={setTopic}
              classLevel={classLevel}
              setClassLevel={setClassLevel}
              folderId={folderId}
              setFolderId={setFolderId}
              folders={localFolders}
              onCreateFolder={(name) => {
                const newF = { id: `folder_${Date.now()}`, name };
                setLocalFolders((prev) => [...prev, newF]);
                setFolderId(newF.id);
              }}
              contentMode={contentMode}
              setContentMode={handleContentModeChange}
              autoRecommendPhoto={autoRecommendPhoto}
              setAutoRecommendPhoto={setAutoRecommendPhoto}
              onApplyStarterTopic={(starterQs) => {
                const formatted: Question[] = starterQs.map((sq, i) => ({
                  id: Date.now() + i + Math.random(),
                  text: sq.text,
                  options: sq.options,
                  answerIndex: sq.answerIndex,
                  optionImages:
                    contentMode === "words"
                      ? Array(sq.options.length).fill(null)
                      : sq.options.map((w) => getInstantCartoonPng(w) || null),
                }));
                setQuestions(formatted);
                setToastMsg(`✨ Loaded ${formatted.length} "${topic}" questions with auto Cartoon PNGs!`);
                setTimeout(() => setToastMsg(""), 3500);
              }}
            />
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

        {/* Clean Bulk Paste Modal */}
        {showBulkPasteModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div
              className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-500 flex items-center justify-center font-bold shrink-0">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white">
                    Bulk Paste
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyAiPrompt}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copiedPromptInModal ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    <span>{copiedPromptInModal ? "Copied!" : "Copy AI Prompt"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVideoGuide(true)}
                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play size={12} className="fill-current" />
                    <span>How to Bulk Paste</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowBulkPasteModal(false); setBulkText(""); }}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <textarea 
                rows={8}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={"1. Which sentence is correct?\na) She doesn't like apples.\nb) She don't like apples.\nc) She not like apples.\nAnswer: A"}
                className="w-full text-sm font-medium bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 outline-none text-slate-800 dark:text-white p-4 rounded-2xl focus:border-teal-500 transition-colors custom-scrollbar"
              />

              {bulkText.trim() && (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Info size={16} className="text-teal-500 shrink-0" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Found <span className="font-bold text-slate-800 dark:text-white">{parsePastedQuiz(bulkText).length}</span> questions.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-teal-500 hover:bg-teal-600 transition-colors shadow-lg shadow-teal-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>+ Add</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col gap-6 bg-slate-100 dark:bg-slate-900/50">
          {/* Questions Action Bar */}
          <div className="bg-teal-500/10 dark:bg-teal-950/30 border border-teal-500/20 rounded-2xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <span className="font-bold text-sm text-teal-900 dark:text-teal-200 uppercase tracking-wider">
              Questions ({questions.length})
            </span>
            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setShowBulkPasteModal(true)}
                className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-teal-500/25 flex items-center gap-2.5 cursor-pointer"
              >
                <ClipboardList size={20} />
                <span>Bulk Paste</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVideoGuide(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-sm sm:text-base font-bold transition-all shadow-md shadow-purple-500/25 flex items-center gap-2 cursor-pointer border border-purple-400/30"
                title="Watch Video Tutorial: How to Bulk Paste"
              >
                <div className="w-5 h-5 rounded-full bg-white text-purple-700 flex items-center justify-center shrink-0">
                  <Play size={11} className="ml-0.5 fill-current" />
                </div>
                <span>How to Bulk Paste</span>
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
              <div className="flex gap-4 mb-4 items-start">
                <div className="w-8 h-8 mt-2 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 border border-blue-500/30">
                  {index + 1}
                </div>
                <SmartQuestionInput
                  id={`question-input-${index}`}
                  value={q.text}
                  imageUrl={q.image || q.imageUrl}
                  onChange={(newVal) => updateQuestion(q.id, 'text', newVal)}
                  onChangeImage={(newImg) => updateQuestionImage(q.id, newImg)}
                  onOpenMediaPicker={(initialQ) =>
                    setActiveMediaPicker({ type: 'question', qId: q.id, initialQuery: initialQ })
                  }
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handlePaste(e, index)}
                  placeholder="Type your question here..."
                  autoPhotosEnabled={autoRecommendPhoto}
                />
              </div>

              {/* Options Grid */}
              <div className="ml-12 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {q.options.map((opt, optIndex) => {
                  const optImg = q.optionImages?.[optIndex] || (isImageUrl(opt) ? opt : null);
                  const optText = isImageUrl(opt) && !q.optionImages?.[optIndex] ? "" : opt;
                  const combinedVal = optImg
                    ? contentMode === 'photos_gifs'
                      ? optImg
                      : formatOptionContent(optText, optImg, 'both')
                    : optText;

                  return (
                    <SmartOptionInput
                      key={optIndex}
                      value={combinedVal}
                      optionIndex={optIndex}
                      isCorrect={q.answerIndex === optIndex}
                      onSelectCorrect={() => updateQuestion(q.id, 'answerIndex', optIndex)}
                      onChangeValue={(val) => updateOptionCombined(q.id, optIndex, val)}
                      onOpenMediaPicker={(initialQ) =>
                        setActiveMediaPicker({ type: 'option', qId: q.id, optIndex, initialQuery: initialQ })
                      }
                      contentMode={contentMode}
                      autoRecommendPhoto={autoRecommendPhoto}
                      placeholder={`Option ${optIndex + 1}`}
                      radioName={`answer-${q.id}`}
                    />
                  );
                })}
              </div>
              <div className="ml-12 mt-3 flex gap-2">
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
        initialQuery={activeMediaPicker?.initialQuery || ""}
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
  frozenUntil: number;
  frozenRemainingSec: number;
  lastWrongOptionIdx: number | null;
  penaltyType?: 'freeze' | 'bad-action' | null;
}

interface RoundWinnerInfo {
  playerIdx: number | null;
  playerName: string;
  heroTitle: string;
  heroIcon: string;
  themeColor: 'rose' | 'amber' | 'teal';
  answerText: string;
  streak: number;
  isCorrect: boolean;
}

const YOGA_FREEZE_DURATION_MS = 3000;
const YOGA_BAD_ACTION_PENALTY_MS = 3500;

function playYogaArenaSfx(type: 'correct' | 'freeze' | 'win' | 'bad-penalty') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'correct') {
      // Radiant ascending major 9th victory chord chime
      const notes = [523.25, 659.25, 783.99, 1046.5, 1174.66];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i % 2 === 0 ? 'triangle' : 'sine';
        const start = now + i * 0.055;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.46);
      });
    } else if (type === 'freeze') {
      // Crystalline icy shatter + deep freeze hum
      const crystalFreqs = [1480, 1174.66, 880, 622.25, 440];
      crystalFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        const start = now + i * 0.045;
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.72, start + 0.18);
        gain.gain.setValueAtTime(0.13, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    } else if (type === 'bad-penalty') {
      // Two-cycle penalty siren sweep + serene zen temple bell resonance
      const sirenOsc = ctx.createOscillator();
      const sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.setValueAtTime(540, now);
      sirenOsc.frequency.linearRampToValueAtTime(880, now + 0.24);
      sirenOsc.frequency.linearRampToValueAtTime(520, now + 0.48);
      sirenOsc.frequency.linearRampToValueAtTime(880, now + 0.72);
      sirenOsc.frequency.linearRampToValueAtTime(480, now + 1.0);
      sirenGain.gain.setValueAtTime(0.22, now);
      sirenGain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start(now);
      sirenOsc.stop(now + 1.08);

      // Serene singing-bowl / zen chime harmonics
      const sereneBowlFreqs = [432, 648, 864];
      sereneBowlFreqs.forEach((freq, idx) => {
        const bellOsc = ctx.createOscillator();
        const bellGain = ctx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(freq, now + 0.08);
        bellGain.gain.setValueAtTime(0.001, now + 0.08);
        bellGain.gain.linearRampToValueAtTime(0.14 / (idx + 1), now + 0.14);
        bellGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.65);
        bellOsc.connect(bellGain);
        bellGain.connect(ctx.destination);
        bellOsc.start(now + 0.08);
        bellOsc.stop(now + 1.68);
      });
    } else if (type === 'win') {
      // Grand Championship Fanfare
      const fanfare = [
        { f: 523.25, t: 0, d: 0.16 },
        { f: 659.25, t: 0.14, d: 0.16 },
        { f: 783.99, t: 0.28, d: 0.18 },
        { f: 1046.5, t: 0.46, d: 0.55 },
        { f: 783.99, t: 0.46, d: 0.55 },
      ];
      fanfare.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.2, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.02);
      });
    }
  } catch (e) {}
}

function formatQuestionForNaturalSpeech(rawText: string, filledAnswer?: string): string {
  if (!rawText) return '';
  const cleanReplacement = filledAnswer ? ` ${filledAnswer} ` : ', blank, ';
  return rawText
    .replace(/_{2,}|\.\.\.+|\[\s*blank\s*\]|\(\s*\)/gi, cleanReplacement)
    .replace(/\s+/g, ' ')
    .trim();
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

function YogaGame({
  quiz,
  onBack,
  onEditQuestions,
  onSwitchMode
}: {
  quiz: Quiz;
  onBack: () => void;
  onEditQuestions?: () => void;
  onSwitchMode?: () => void;
}) {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'end'>('start');
  const [playMode, setPlayMode] = useState<'studio' | 'camera' | 'pose-chase'>('camera');
  const [yogaTimerMinutes, setYogaTimerMinutes] = useState<number>(3);

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
  const [chaseSpeedMultiplier, setChaseSpeedMultiplier] = useState<number>(1.0);
  const [chaseVoiceEnabled, setChaseVoiceEnabled] = useState<boolean>(true);

  // Natural Question Reading (TTS) State & Voice Selection
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('yogaNaturalVoiceEnabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const preferredVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('yogaNaturalVoiceEnabled', String(voiceEnabled));
    } catch {}
    if (!voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const pickBestNaturalVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const englishVoices = voices.filter(v => /^en(-|_|$)/i.test(v.lang));
      const pool = englishVoices.length ? englishVoices : voices;
      const priorityPatterns = [
        /Natural/i,
        /Online/i,
        /Aria/i,
        /Jenny/i,
        /Sonia/i,
        /Libby/i,
        /Ryan/i,
        /Google US English/i,
        /Google UK English Female/i,
        /Samantha/i,
        /Ava/i,
        /Victoria/i,
        /Karen/i,
        /Daniel/i,
        /Moira/i,
      ];
      for (const pat of priorityPatterns) {
        const match = pool.find(v => pat.test(v.name));
        if (match) {
          preferredVoiceRef.current = match;
          return;
        }
      }
      preferredVoiceRef.current = pool.find(v => !v.localService) || pool[0] || null;
    };
    pickBestNaturalVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickBestNaturalVoice);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', pickBestNaturalVoice);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speakNaturalText = useCallback((textToSpeak: string, forceSpeak: boolean = false) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!forceSpeak && !voiceEnabledRef.current) return;
    const cleaned = textToSpeak.trim();
    if (!cleaned) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleaned);
      if (preferredVoiceRef.current) {
        utterance.voice = preferredVoiceRef.current;
      }
      utterance.lang = preferredVoiceRef.current?.lang || 'en-US';
      utterance.rate = 0.96;
      utterance.pitch = 1.04;
      utterance.volume = 1.0;
      utterance.onstart = () => setIsSpeakingQuestion(true);
      utterance.onend = () => setIsSpeakingQuestion(false);
      utterance.onerror = () => setIsSpeakingQuestion(false);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeakingQuestion(false);
    }
  }, []);

  const speakQuestionByIndex = useCallback(
    (qIdx: number, forceSpeak: boolean = false) => {
      const q = quiz.questions[qIdx];
      if (!q?.text) return;
      const naturalPrompt = formatQuestionForNaturalSpeech(q.text);
      speakNaturalText(naturalPrompt, forceSpeak);
    },
    [quiz.questions, speakNaturalText]
  );

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
  const teamStreaksRef = useRef(teamStreaks);
  teamStreaksRef.current = teamStreaks;

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
  const [roundWinnerInfo, setRoundWinnerInfo] = useState<RoundWinnerInfo | null>(null);
  const [winningPlayerIdx, setWinningPlayerIdx] = useState<number | null>(null);
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
    { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null, frozenUntil: 0, frozenRemainingSec: 0, lastWrongOptionIdx: null, penaltyType: null },
    { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null, frozenUntil: 0, frozenRemainingSec: 0, lastWrongOptionIdx: null, penaltyType: null },
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
      lastWrongOptionIdx: number | null;
      penaltyType: 'freeze' | 'bad-action' | null;
    }>
  >([
    { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: 0, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0, lastWrongOptionIdx: null, penaltyType: null },
    { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: 0, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0, lastWrongOptionIdx: null, penaltyType: null },
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
  const currentIdxRef = useRef(currentIdx);
  currentIdxRef.current = currentIdx;

  // Trigger a 3-second icy freeze penalty on a player when they lock in or click a wrong answer
  const triggerPlayerFreeze = useCallback((pIdx: number, wrongOptionIdx: number | null) => {
    const now = performance.now();
    const freezeUntil = now + YOGA_FREEZE_DURATION_MS;
    const pHold = holdStateRef.current[pIdx];
    if (pHold) {
      pHold.progress = 0;
      pHold.optionIdx = null;
      pHold.poseId = null;
      pHold.recentPoses = [];
      pHold.cooldownUntil = freezeUntil;
      pHold.wrongBannerUntil = freezeUntil;
      pHold.lastWrongOptionIdx = wrongOptionIdx;
      pHold.penaltyType = 'freeze';
    }

    const team = teamsRef.current[pIdx];
    if (team) {
      setTeamStreaks(prev => ({ ...prev, [team.id]: 0 }));
    }

    playSound('incorrect');
    playYogaArenaSfx('freeze');

    setPlayerDetections(prev => {
      const next: [PlayerCameraDetectionState, PlayerCameraDetectionState] = [{ ...prev[0] }, { ...prev[1] }];
      next[pIdx] = {
        detectedPoseId: null,
        matchedOptionIdx: null,
        holdProgress: 0,
        wrongFeedbackText: '🥶 FROZEN! Wrong answer!',
        frozenUntil: freezeUntil,
        frozenRemainingSec: Number((YOGA_FREEZE_DURATION_MS / 1000).toFixed(1)),
        lastWrongOptionIdx: wrongOptionIdx,
        penaltyType: 'freeze',
      };
      return next;
    });
  }, []);
  const triggerPlayerFreezeRef = useRef(triggerPlayerFreeze);
  triggerPlayerFreezeRef.current = triggerPlayerFreeze;

  // Trigger a Bad Action Penalty when a player makes a middle finger ("dirty finger") gesture:
  // Resets their score to 0, plays a serene/siren penalty sound, and shows BAD ACTION PENALTY on screen!
  const triggerBadActionPenalty = useCallback((pIdx: number) => {
    const now = performance.now();
    const penaltyUntil = now + YOGA_BAD_ACTION_PENALTY_MS;
    const pHold = holdStateRef.current[pIdx];
    if (pHold) {
      pHold.progress = 0;
      pHold.optionIdx = null;
      pHold.poseId = null;
      pHold.recentPoses = [];
      pHold.cooldownUntil = penaltyUntil;
      pHold.wrongBannerUntil = penaltyUntil;
      pHold.lastWrongOptionIdx = null;
      pHold.penaltyType = 'bad-action';
    }

    const team = teamsRef.current[pIdx];
    if (team) {
      const prevScore = team.score || 0;
      setTeams(prev => prev.map((t, idx) => (idx === pIdx ? { ...t, score: 0 } : t)));
      setTeamStreaks(prev => ({ ...prev, [team.id]: 0 }));
      if (prevScore > 0) {
        setScorePops(prev => ({ ...prev, [team.id]: { delta: -prevScore, key: Date.now() + Math.random() } }));
      }
    }

    playYogaArenaSfx('bad-penalty');
    if (voiceEnabledRef.current) {
      const pName = team?.name || `Player ${pIdx + 1}`;
      speakNaturalText(`Bad action penalty! ${pName} score reset to zero!`);
    }

    setPlayerDetections(prev => {
      const next: [PlayerCameraDetectionState, PlayerCameraDetectionState] = [{ ...prev[0] }, { ...prev[1] }];
      next[pIdx] = {
        detectedPoseId: null,
        matchedOptionIdx: null,
        holdProgress: 0,
        wrongFeedbackText: '🚨 BAD ACTION PENALTY! Score Reset to 0!',
        frozenUntil: penaltyUntil,
        frozenRemainingSec: Number((YOGA_BAD_ACTION_PENALTY_MS / 1000).toFixed(1)),
        lastWrongOptionIdx: null,
        penaltyType: 'bad-action',
      };
      return next;
    });
  }, [speakNaturalText]);
  const triggerBadActionPenaltyRef = useRef(triggerBadActionPenalty);
  triggerBadActionPenaltyRef.current = triggerBadActionPenalty;

  // Smoothly tick down frozenRemainingSec every 100ms even if the frozen/penalized player lowers their hands
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      const now = performance.now();
      const h0 = holdStateRef.current[0];
      const h1 = holdStateRef.current[1];
      const rem0 = h0 && now < h0.cooldownUntil ? Number(((h0.cooldownUntil - now) / 1000).toFixed(1)) : 0;
      const rem1 = h1 && now < h1.cooldownUntil ? Number(((h1.cooldownUntil - now) / 1000).toFixed(1)) : 0;

      setPlayerDetections(prev => {
        if (prev[0].frozenRemainingSec === rem0 && prev[1].frozenRemainingSec === rem1) {
          return prev;
        }
        return [
          {
            ...prev[0],
            frozenRemainingSec: rem0,
            penaltyType: rem0 > 0 ? h0.penaltyType : null,
            wrongFeedbackText:
              rem0 > 0
                ? h0.penaltyType === 'bad-action'
                  ? '🚨 BAD ACTION PENALTY! Score Reset to 0!'
                  : '🥶 FROZEN! Wrong answer!'
                : null,
            lastWrongOptionIdx: rem0 > 0 ? h0.lastWrongOptionIdx : null,
          },
          {
            ...prev[1],
            frozenRemainingSec: rem1,
            penaltyType: rem1 > 0 ? h1.penaltyType : null,
            wrongFeedbackText:
              rem1 > 0
                ? h1.penaltyType === 'bad-action'
                  ? '🚨 BAD ACTION PENALTY! Score Reset to 0!'
                  : '🥶 FROZEN! Wrong answer!'
                : null,
            lastWrongOptionIdx: rem1 > 0 ? h1.lastWrongOptionIdx : null,
          },
        ];
      });
    }, 100);
    return () => clearInterval(interval);
  }, [gameState]);

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
    isAnsweringRef.current = false;
    setSelectedOption(null);
    setRoundWinnerBanner(null);
    setRoundWinnerInfo(null);
    setWinningPlayerIdx(null);
    const now = performance.now();
    holdStateRef.current = [
      { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: now, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0, lastWrongOptionIdx: null, penaltyType: null },
      { optionIdx: null, poseId: null, progress: 0, lastUpdateTime: now, lastMatchedTime: 0, recentPoses: [], cooldownUntil: 0, wrongBannerUntil: 0, lastWrongOptionIdx: null, penaltyType: null },
    ];
    setPlayerDetections([
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null, frozenUntil: 0, frozenRemainingSec: 0, lastWrongOptionIdx: null, penaltyType: null },
      { detectedPoseId: null, matchedOptionIdx: null, holdProgress: 0, wrongFeedbackText: null, frozenUntil: 0, frozenRemainingSec: 0, lastWrongOptionIdx: null, penaltyType: null },
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
      const parsedOpt = parseOptionContent(raw);
      const imgField = optionImages[i];
      const image = isImageUrl(imgField) ? imgField : (parsedOpt.imageUrl || undefined);
      const displayText = parsedOpt.mode === 'image' ? "" : parsedOpt.text;

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

    let opts = validOpts.map((opt) => ({
      text: opt.text,
      image: opt.image,
      isCorrect: opt.originalIndex === correctIndex,
    }));

    // Shuffle option order
    opts.sort(() => Math.random() - 0.5);

    let computedOptions;
    if (playMode === 'camera') {
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
  }, [quiz.questions, activePoses, playMode, cameraHandPoses, classicPoses]);

  // Automatically read the current question naturally when a question loads during gameplay
  useEffect(() => {
    if (gameState === 'playing') {
      const timerId = setTimeout(() => {
        speakQuestionByIndex(currentIdx, false);
      }, 220);
      return () => clearTimeout(timerId);
    }
  }, [gameState, currentIdx, speakQuestionByIndex]);

  // Announce the grand winner naturally when the game ends
  const announceGrandWinner = useCallback((forceSpeak: boolean = false) => {
    const sorted = [...teamsRef.current].sort((a, b) => b.score - a.score);
    if (!sorted.length) return;
    const isTwoP = sorted.length >= 2;
    const isTie = isTwoP && sorted[0].score === sorted[1].score;
    if (isTie) {
      speakNaturalText(
        `What an incredible match! It is a tie at ${sorted[0].score} ${sorted[0].score === 1 ? 'point' : 'points'} each!`,
        forceSpeak
      );
    } else {
      const winTeam = sorted[0];
      const originalIdx = teamsRef.current.findIndex(t => t.id === winTeam.id);
      const heroName = isTwoP
        ? originalIdx === 0
          ? 'Spider-Man'
          : 'Thanos Gauntlet'
        : 'Yoga Champion';
      speakNaturalText(
        `Congratulations ${winTeam.name}! ${heroName} wins the championship with ${winTeam.score} ${winTeam.score === 1 ? 'point' : 'points'}!`,
        forceSpeak
      );
    }
  }, [speakNaturalText]);

  useEffect(() => {
    if (gameState === 'end') {
      setShowConfetti(true);
      playYogaArenaSfx('win');
      const t = setTimeout(() => {
        announceGrandWinner(false);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [gameState, announceGrandWinner]);

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
    setRoundWinnerInfo(null);
    setWinningPlayerIdx(null);
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
    setRoundWinnerInfo(null);
    setWinningPlayerIdx(null);
    const prevIdx = currentIdx - 1;
    setCurrentIdx(prevIdx);
    // Retrieve the exact previous pose & options from cache
    loadQuestion(prevIdx, true);
  }, [currentIdx, loadQuestion]);

  const handleAnswer = useCallback((index: number, isCorrect: boolean, winningPlayerIndex?: number) => {
    if (isAnsweringRef.current) return;

    // If a player clicks a wrong option on screen, freeze that player for 3 seconds instead of skipping the question!
    if (!isCorrect) {
      const targetPlayer = typeof winningPlayerIndex === 'number' ? winningPlayerIndex : 0;
      triggerPlayerFreezeRef.current(targetPlayer, index);
      return;
    }

    setIsAnswering(true);
    isAnsweringRef.current = true;
    setSelectedOption(index);

    const matchedOpt = shuffledOptionsRef.current[index];
    const winningAnswerWord = matchedOpt?.text || 'Correct';
    const currentQ = quiz.questions[currentIdxRef.current];

    playSound('correct');
    playYogaArenaSfx('correct');
    setShowConfetti(true);

    const isTwoP = teamsRef.current.length >= 2;
    const resolvedPlayerIdx =
      typeof winningPlayerIndex === 'number' && teamsRef.current[winningPlayerIndex]
        ? winningPlayerIndex
        : 0;
    const winningTeam = teamsRef.current[resolvedPlayerIdx] || teamsRef.current[0];

    if (winningTeam) {
      const teamId = winningTeam.id;
      const newStreak = (teamStreaksRef.current[teamId] || 0) + 1;
      setWinningPlayerIdx(resolvedPlayerIdx);
      setTeams(prev => prev.map((t, idx) => idx === resolvedPlayerIdx ? { ...t, score: t.score + 1 } : t));
      setScorePops(prev => ({ ...prev, [teamId]: { delta: 1, key: Date.now() + Math.random() } }));
      setTeamStreaks(prev => ({ ...prev, [teamId]: newStreak }));

      const heroTitle = isTwoP
        ? resolvedPlayerIdx === 0
          ? 'Spider-Man'
          : 'Thanos Gauntlet'
        : 'Yoga Champion';
      const heroIcon = isTwoP ? (resolvedPlayerIdx === 0 ? '🕷️' : '🥊') : '⚡';
      const themeColor: 'rose' | 'amber' | 'teal' = isTwoP
        ? resolvedPlayerIdx === 0
          ? 'rose'
          : 'amber'
        : 'teal';

      setRoundWinnerBanner(`🎉 ${winningTeam.name} (${heroTitle}) scored +1 Point!`);
      setRoundWinnerInfo({
        playerIdx: resolvedPlayerIdx,
        playerName: winningTeam.name,
        heroTitle,
        heroIcon,
        themeColor,
        answerText: winningAnswerWord,
        streak: newStreak,
        isCorrect: true,
      });
    }

    // Read the completed sentence or answer naturally!
    if (voiceEnabledRef.current && currentQ?.text) {
      const hasBlank = /_{2,}|\.\.\.+|\[\s*blank\s*\]|\(\s*\)/i.test(currentQ.text);
      if (hasBlank && winningAnswerWord) {
        const completedSentence = formatQuestionForNaturalSpeech(currentQ.text, winningAnswerWord);
        speakNaturalText(`Correct! ${completedSentence}`);
      } else if (winningAnswerWord) {
        speakNaturalText(`Correct! ${winningAnswerWord}`);
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
  }, [autoAdvanceDelay, currentIdx, advanceToNextQuestion, quiz.questions, speakNaturalText]);

  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;

  // Pre-warm MediaPipe Hands in the background as soon as YogaGame mounts for instant camera startup
  useEffect(() => {
    getOrPrewarmYogaHands().catch(() => {});
  }, []);

  const stopCamera = useCallback(() => {
    sharedYogaHandsResultsListener = null;
    if (cameraRunnerRef.current) {
      cameraRunnerRef.current.stop();
      cameraRunnerRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      stopCamera();

      if (!navigator?.mediaDevices?.getUserMedia) {
        setCameraError("Camera is not supported on this browser. You can play using click-based choices!");
        setIsCameraReady(false);
        return;
      }

      // Start camera stream and pre-warmed MediaPipe Hands in parallel for ultra-low loading time
      const streamPromise = (async (): Promise<MediaStream | null> => {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
            },
          });
        } catch (e1) {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
            });
          } catch (e2) {
            return await navigator.mediaDevices.getUserMedia({
              video: true,
            });
          }
        }
      })();

      let stream: MediaStream | null = null;
      try {
        stream = await streamPromise;
      } catch (camErr: any) {
        console.warn("Yoga camera unavailable:", camErr?.name || camErr?.message);
        setCameraError("Camera not found or permission denied. You can play directly using click/tap mode!");
        setIsCameraReady(false);
        return;
      }

      if (!stream) {
        setIsCameraReady(false);
        return;
      }

      // Attach video stream immediately so player sees live camera right away without waiting for AI init
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
        setIsCameraReady(true);
      }

      const hands = await getOrPrewarmYogaHands();
      handsInstanceRef.current = hands;

      sharedYogaHandsResultsListener = (results: any) => {
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
        const videoW = videoEl?.videoWidth || 640;
        const videoH = videoEl?.videoHeight || 480;
        const videoAspect = videoW / Math.max(1, videoH);

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
          {
            detectedPoseId: null,
            matchedOptionIdx: null,
            holdProgress: 0,
            wrongFeedbackText: null,
            frozenUntil: 0,
            frozenRemainingSec: 0,
            lastWrongOptionIdx: null,
            penaltyType: null,
          },
          {
            detectedPoseId: null,
            matchedOptionIdx: null,
            holdProgress: 0,
            wrongFeedbackText: null,
            frozenUntil: 0,
            frozenRemainingSec: 0,
            lastWrongOptionIdx: null,
            penaltyType: null,
          },
        ];

        for (let pIdx = 0; pIdx < numActiveZones; pIdx++) {
          const pHold = holdStateRef.current[pIdx];
          const dtMs = Math.min(120, Math.max(16, now - (pHold.lastUpdateTime || now)));
          pHold.lastUpdateTime = now;

          if (now < pHold.cooldownUntil) {
            const remSec = Number(((pHold.cooldownUntil - now) / 1000).toFixed(1));
            nextUiStates[pIdx] = {
              detectedPoseId: null,
              matchedOptionIdx: null,
              holdProgress: 0,
              wrongFeedbackText:
                pHold.penaltyType === 'bad-action'
                  ? `🚨 BAD ACTION PENALTY! Score Reset to 0!`
                  : `🥶 FROZEN! ${remSec}s`,
              frozenUntil: pHold.cooldownUntil,
              frozenRemainingSec: remSec,
              lastWrongOptionIdx: pHold.lastWrongOptionIdx,
              penaltyType: pHold.penaltyType,
            };
            continue;
          } else if (pHold.lastWrongOptionIdx !== null || pHold.penaltyType !== null) {
            pHold.lastWrongOptionIdx = null;
            pHold.penaltyType = null;
          }

          const { poseId, confidence } = detectStandingPoseFromHands(
            playerHandGroups[pIdx],
            candidatePoseIds,
            videoAspect
          );

          // Push into 3-frame rolling smoothing buffer for instantaneous response without lag
          const validFramePose = poseId && confidence >= 0.68 ? poseId : null;
          pHold.recentPoses.push(validFramePose);
          if (pHold.recentPoses.length > 3) {
            pHold.recentPoses.shift();
          }

          // Check for Bad Action (middle finger / dirty finger): 2 frames in buffer triggers immediate score reset penalty!
          const dirtyFingerCount = pHold.recentPoses.filter(p => p === 'dirty-finger').length;
          if (validFramePose === 'dirty-finger' && dirtyFingerCount >= 2) {
            triggerBadActionPenaltyRef.current(pIdx);
            const penaltyRem = Number((YOGA_BAD_ACTION_PENALTY_MS / 1000).toFixed(1));
            nextUiStates[pIdx] = {
              detectedPoseId: 'dirty-finger',
              matchedOptionIdx: null,
              holdProgress: 0,
              wrongFeedbackText: '🚨 BAD ACTION PENALTY! Score Reset to 0!',
              frozenUntil: pHold.cooldownUntil,
              frozenRemainingSec: penaltyRem,
              lastWrongOptionIdx: null,
              penaltyType: 'bad-action',
            };
            continue;
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
              // Ultra-fast ~0.16s lock-in (starts at 56% and adds ~280% per second)
              pHold.progress = Math.min(100, Math.round(pHold.progress + (dtMs / 1000) * 280));
            } else {
              pHold.optionIdx = matchedIdx;
              pHold.poseId = smoothedPoseId;
              pHold.progress = 56;
            }
          } else {
            // Generous 260ms grace period so rapid micro-movements don't drop progress
            if (now - pHold.lastMatchedTime > 260) {
              pHold.progress = Math.max(0, Math.round(pHold.progress - (dtMs / 1000) * 140));
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
            wrongFeedbackText: null,
            frozenUntil: 0,
            frozenRemainingSec: 0,
            lastWrongOptionIdx: null,
            penaltyType: null,
          };

          // Check if player completed holding the pose (100%)
          if (pHold.progress >= 100 && pHold.optionIdx !== null) {
            const chosenOpt = currentOptions[pHold.optionIdx];
            const chosenIdx = pHold.optionIdx;
            pHold.progress = 0;
            pHold.optionIdx = null;
            pHold.recentPoses = [];

            if (chosenOpt) {
              if (chosenOpt.isCorrect) {
                handleAnswerRef.current(chosenIdx, true, pIdx);
                break;
              } else {
                // Wrong answer freezes the player in ice for 3.0 seconds!
                triggerPlayerFreezeRef.current(pIdx, chosenIdx);
                const freezeRem = Number((YOGA_FREEZE_DURATION_MS / 1000).toFixed(1));
                nextUiStates[pIdx] = {
                  detectedPoseId: null,
                  matchedOptionIdx: null,
                  holdProgress: 0,
                  wrongFeedbackText: `🥶 FROZEN! ${freezeRem}s`,
                  frozenUntil: pHold.cooldownUntil,
                  frozenRemainingSec: freezeRem,
                  lastWrongOptionIdx: chosenIdx,
                  penaltyType: 'freeze',
                };
              }
            }
          }
        }

        setPlayerDetections(nextUiStates);
      };

      if (videoRef.current) {
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
    setTeamStreaks({});
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
      if (len > 85) return 'text-lg sm:text-xl md:text-2xl';
      if (len > 45) return 'text-xl sm:text-2xl md:text-3xl';
      return 'text-2xl sm:text-3xl md:text-4xl';
    }
    if (uiScale === 'big') { // Large
      if (len > 85) return 'text-2xl sm:text-3xl md:text-4xl';
      if (len > 45) return 'text-3xl sm:text-4xl md:text-5xl';
      return 'text-4xl sm:text-5xl md:text-6xl';
    }
    // Medium (default) — prominently sized for classroom visibility
    if (len > 85) return 'text-xl sm:text-2xl md:text-3xl';
    if (len > 45) return 'text-2xl sm:text-3xl md:text-4xl';
    return 'text-3xl sm:text-4xl md:text-5xl';
  };

  const getOptionFontSizeClass = (text: string, isMany: boolean) => {
    const len = text.length;
    if (uiScale === 'small') {
      if (len > 40 || isMany) return 'text-sm sm:text-base md:text-lg';
      return 'text-base sm:text-lg md:text-xl';
    }
    if (uiScale === 'big') { // Large
      if (len > 40 || isMany) return 'text-xl sm:text-2xl md:text-3xl';
      if (len > 20) return 'text-2xl sm:text-3xl md:text-4xl';
      return 'text-3xl sm:text-4xl md:text-5xl';
    }
    // Medium (default)
    if (len > 40 || isMany) return 'text-base sm:text-lg md:text-xl';
    if (len > 20) return 'text-lg sm:text-xl md:text-2xl';
    return 'text-xl sm:text-2xl md:text-3xl';
  };

  // Render Question Text with glowing filled-in blank when answered correctly
  const correctOptionText = shuffledOptions.find(o => o.isCorrect)?.text || '';
  const renderFormattedQuestionContent = (rawText: string) => {
    if (!isAnswering || !correctOptionText) {
      return rawText;
    }
    const blankRegex = /(_{2,}|\.\.\.+|\[\s*blank\s*\]|\(\s*\))/i;
    if (!blankRegex.test(rawText)) {
      return (
        <>
          <span>{rawText}</span>
          <span className="inline-flex items-center gap-1 bg-emerald-500 text-white px-3 py-0.5 rounded-xl shadow-md ml-2 text-[0.85em] align-middle animate-bounce">
            ✓ {correctOptionText}
          </span>
        </>
      );
    }
    const parts = rawText.split(blankRegex);
    let replacedFirst = false;
    return (
      <>
        {parts.map((part, i) => {
          if (!replacedFirst && blankRegex.test(part)) {
            replacedFirst = true;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3.5 py-0.5 rounded-xl shadow-lg mx-1.5 border-2 border-emerald-300 align-baseline animate-bounce"
              >
                <span>{correctOptionText}</span>
              </span>
            );
          }
          return <React.Fragment key={i}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  const isTwoPlayerCamera = playMode === 'camera' && teams.length >= 2;
  const posesForCurrentModeSettings = playMode === 'studio' ? CLASSIC_YOGA_POSES : CAMERA_HAND_POSES;

  return (
    <div className={`flex-1 flex items-center justify-center p-1.5 md:p-3 mx-auto animate-fade-in ${isFullscreen ? 'fixed inset-0 z-50 bg-teal-50 w-full h-full max-w-none' : 'w-full max-w-[1480px]'}`}>
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          numberOfPieces={gameState === 'end' ? 360 : 300}
          recycle={gameState === 'end'}
          style={{ position: 'fixed', zIndex: 100, top: 0, left: 0 }}
        />
      )}

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
        @keyframes icePulseGlow {
          0%, 100% { box-shadow: inset 0 0 55px rgba(34, 211, 238, 0.75), 0 0 25px rgba(6, 182, 212, 0.55); }
          50% { box-shadow: inset 0 0 85px rgba(103, 232, 249, 0.95), 0 0 40px rgba(34, 211, 238, 0.85); }
        }
        .animate-ice-glow {
          animation: icePulseGlow 1.1s ease-in-out infinite;
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

              {/* Natural Voice Question Reading Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-teal-50 border-2 border-teal-200">
                <div>
                  <div className="text-teal-900 font-black text-lg flex items-center gap-2">
                    <Volume2 size={22} className="text-teal-600" />
                    <span>Read Questions Naturally (Voice Narration)</span>
                  </div>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    Automatically reads each question aloud with natural phrasing and speaks completed sentences when answered.
                  </p>
                </div>
                <button
                  onClick={() => setVoiceEnabled(v => !v)}
                  className={`px-5 py-2.5 rounded-2xl font-black text-sm transition-all border-3 cursor-pointer flex items-center gap-2 ${
                    voiceEnabled
                      ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                      : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}
                >
                  {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  <span>{voiceEnabled ? 'Voice ON' : 'Voice OFF'}</span>
                </button>
              </div>

              {/* Hand Gesture Selection */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <label className="block text-teal-800 font-black text-lg">
                      ✋ Hand Gestures for Camera Mode (1 Finger, 2 Fingers, 3 Fingers, Fist, Rock...)
                    </label>
                    <p className="text-xs text-slate-500 font-semibold">
                      Camera Mode uses hand gestures for fast, accurate AI detection.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
                    {activePoses.length} Active Gestures
                  </span>
                </div>

                {/* Quick Preset Filter */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <button
                    onClick={() => applyPosePreset('hand')}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs cursor-pointer shadow-xs"
                  >
                    ✋ Restore All Hand Gestures (1, 2, 3, Fist, Rock...)
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                  {CAMERA_HAND_POSES.map((pose) => {
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
          <UnifiedGameSetup
            title={quiz.title || 'YOGA QUIZ 3D'}
            questionCount={quiz.questions.length}
            onBack={onBack}
            onOpenQuizEditor={onEditQuestions}
            onOpenSettings={() => setShowSettings(true)}
            onOpenGameSwitcher={onSwitchMode}
            playerModeOptions={[
              { id: 1, label: '1 PLAYER', icon: '🧘' },
              { id: 2, label: '2 PLAYERS', icon: '⚡' }
            ]}
            selectedPlayerMode={teams.length >= 2 ? 2 : 1}
            onSelectPlayerMode={(count: number) => setPlayerPreset(count === 2 ? 2 : 1)}
            playerNames={teams.map((team, idx) => ({
              id: String(team.id),
              badge: `P${idx + 1}`,
              value: team.name,
              placeholder: `Player ${idx + 1}`,
              colorScheme: (['blue', 'red', 'emerald', 'amber'][idx % 4] as 'blue' | 'red' | 'emerald' | 'amber'),
              onChange: (val: string) =>
                setTeams(prev => prev.map(t => (t.id === team.id ? { ...t, name: val } : t)))
            }))}
            timerValue={yogaTimerMinutes * 60}
            timerLabelDisplay={`${yogaTimerMinutes} ${yogaTimerMinutes === 1 ? 'Minute' : 'Minutes'}`}
            timerOptions={[
              { sec: 60, label: '1 Minute' },
              { sec: 120, label: '2 Minutes' },
              { sec: 180, label: '3 Minutes' },
              { sec: 300, label: '5 Minutes' }
            ]}
            onTimerChange={(sec: number) => setYogaTimerMinutes(Math.max(1, Math.round(sec / 60)))}
            arCameraConfig={{
              enabled: true,
              label: 'AR Camera Tracker',
              helperText: 'Show your hand gesture in front of the camera to select answers!'
            }}
            startLabel="START YOGA STUDIO"
            onStart={startGame}
          >
            {/* 1. HAND AI GESTURE PREVIEW */}
            <div className="p-4 rounded-3xl bg-teal-50/90 border-2 border-teal-200 border-b-4 border-b-teal-300 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm sm:text-base font-black uppercase tracking-wider text-teal-950">
                  📷 HAND AI GESTURES
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-teal-600 text-white font-black text-xs uppercase">
                  POSES ({activePoses.length})
                </span>
              </div>

              {/* Active Pose Preview Strip */}
              <div className="flex items-center justify-center gap-3 sm:gap-5 bg-white/90 px-4 py-2.5 rounded-2xl border-2 border-teal-200">
                <StandingPoseFigure poseId="1-finger" emoji="☝️" size="sm" />
                <StandingPoseFigure poseId="2-finger" emoji="✌️" size="sm" />
                <StandingPoseFigure poseId="3-finger" emoji="🤟" size="sm" />
                <StandingPoseFigure poseId="fist" emoji="✊" size="sm" />
                <StandingPoseFigure poseId="rock" emoji="🤘" size="sm" />
              </div>
            </div>
          </UnifiedGameSetup>
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
                    <div
                      className={`relative border-r-2 border-dashed border-white/40 flex flex-col justify-between p-4 pt-24 pb-44 transition-all duration-300 ${
                        playerDetections[0].frozenRemainingSec > 0
                          ? playerDetections[0].penaltyType === 'bad-action'
                            ? 'bg-rose-600/35 backdrop-blur-[3px] border-4 border-rose-400 shadow-[inset_0_0_90px_rgba(225,29,72,0.75)]'
                            : 'bg-cyan-500/30 backdrop-blur-[3px] border-4 border-cyan-300 animate-ice-glow'
                          : isAnswering && winningPlayerIdx === 0
                          ? 'bg-emerald-500/20 ring-4 ring-inset ring-emerald-400 shadow-[inset_0_0_80px_rgba(16,185,129,0.55)]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-end gap-2">
                        {playerDetections[0].matchedOptionIdx !== null && playerDetections[0].frozenRemainingSec <= 0 && (
                          <span className="bg-white/95 text-rose-950 font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-rose-400 animate-pulse">
                            <span className="text-xl leading-none">{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                            <span>Locking Answer</span>
                          </span>
                        )}
                      </div>

                      {/* Icy Freeze or Bad Action Penalty Overlay for Player 1 */}
                      {playerDetections[0].frozenRemainingSec > 0 && (
                        playerDetections[0].penaltyType === 'bad-action' ? (
                          <div className="self-center my-auto flex flex-col items-center text-center bg-gradient-to-b from-rose-950/95 via-red-950/95 to-slate-950/95 border-4 border-rose-400 rounded-3xl px-6 py-4 shadow-[0_0_45px_rgba(244,63,94,0.95)] max-w-xs animate-bounce">
                            <div className="flex items-center gap-2 text-2xl sm:text-3xl mb-1">
                              <span>🚨</span>
                              <span>🚫</span>
                              <span>🔔</span>
                            </div>
                            <div className="text-rose-200 font-black text-base sm:text-xl uppercase tracking-wider">
                              BAD ACTION PENALTY!
                            </div>
                            <div className="text-amber-300 font-black text-sm sm:text-base uppercase tracking-wide mt-0.5">
                              {teams[0]?.name || 'Player 1'} Score Reset to 0!
                            </div>
                            <div className="text-white font-black text-2xl sm:text-3xl tabular-nums my-0.5">
                              {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                            </div>
                            <p className="text-rose-200/90 text-[11px] sm:text-xs font-bold">
                              Keep gestures respectful & positive!
                            </p>
                            <div className="w-full bg-rose-900/90 h-2.5 rounded-full mt-2.5 overflow-hidden border border-rose-400/60">
                              <div
                                className="bg-gradient-to-r from-rose-400 via-amber-400 to-red-500 h-full transition-all duration-100"
                                style={{
                                  width: `${Math.min(100, (playerDetections[0].frozenRemainingSec / (YOGA_BAD_ACTION_PENALTY_MS / 1000)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="self-center my-auto flex flex-col items-center text-center bg-cyan-950/90 border-3 border-cyan-300 rounded-3xl px-6 py-4 shadow-[0_0_35px_rgba(34,211,238,0.85)] max-w-xs animate-bounce">
                            <div className="flex items-center gap-2 text-2xl sm:text-3xl mb-1">
                              <span>❄️</span>
                              <span>🥶</span>
                              <span>🧊</span>
                            </div>
                            <div className="text-cyan-200 font-black text-base sm:text-xl uppercase tracking-wider">
                              {teams[0]?.name || 'Player 1'} FROZEN!
                            </div>
                            <div className="text-white font-black text-2xl sm:text-3xl tabular-nums my-0.5">
                              {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                            </div>
                            <p className="text-cyan-200/90 text-[11px] sm:text-xs font-bold">
                              Wrong answer! Wait for ice to thaw!
                            </p>
                            <div className="w-full bg-cyan-900/90 h-2.5 rounded-full mt-2.5 overflow-hidden border border-cyan-400/50">
                              <div
                                className="bg-gradient-to-r from-cyan-300 to-sky-400 h-full transition-all duration-100"
                                style={{
                                  width: `${Math.min(100, (playerDetections[0].frozenRemainingSec / (YOGA_FREEZE_DURATION_MS / 1000)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}

                      {/* Hold Progress Bar for Player 1 */}
                      <div className="w-full max-w-sm mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                        <div
                          className={`h-full rounded-full transition-all duration-75 ${
                            playerDetections[0].frozenRemainingSec > 0
                              ? playerDetections[0].penaltyType === 'bad-action'
                                ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-red-500'
                                : 'bg-gradient-to-r from-cyan-400 to-sky-300'
                              : 'bg-gradient-to-r from-rose-500 to-red-400'
                          }`}
                          style={{
                            width:
                              playerDetections[0].frozenRemainingSec > 0
                                ? `${Math.min(
                                    100,
                                    (playerDetections[0].frozenRemainingSec /
                                      ((playerDetections[0].penaltyType === 'bad-action'
                                        ? YOGA_BAD_ACTION_PENALTY_MS
                                        : YOGA_FREEZE_DURATION_MS) /
                                        1000)) *
                                      100
                                  )}%`
                                : `${playerDetections[0].holdProgress}%`,
                          }}
                        />
                        <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                          {playerDetections[0].frozenRemainingSec > 0
                            ? playerDetections[0].penaltyType === 'bad-action'
                              ? `🚨 BAD ACTION PENALTY • SCORE = 0 (${playerDetections[0].frozenRemainingSec.toFixed(1)}s)`
                              : `❄️ FROZEN (${playerDetections[0].frozenRemainingSec.toFixed(1)}s)`
                            : playerDetections[0].holdProgress > 0
                            ? `Locking ${shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue || 'Answer'}... ${playerDetections[0].holdProgress}%`
                            : 'Stand on Left & Shoot Web Pose'}
                        </span>
                      </div>
                    </div>

                    {/* Player 2 Zone (Right: Thanos) */}
                    <div
                      className={`relative border-l-2 border-dashed border-white/40 flex flex-col justify-between p-4 pt-24 pb-44 transition-all duration-300 ${
                        playerDetections[1].frozenRemainingSec > 0
                          ? playerDetections[1].penaltyType === 'bad-action'
                            ? 'bg-rose-600/35 backdrop-blur-[3px] border-4 border-rose-400 shadow-[inset_0_0_90px_rgba(225,29,72,0.75)]'
                            : 'bg-cyan-500/30 backdrop-blur-[3px] border-4 border-cyan-300 animate-ice-glow'
                          : isAnswering && winningPlayerIdx === 1
                          ? 'bg-emerald-500/20 ring-4 ring-inset ring-emerald-400 shadow-[inset_0_0_80px_rgba(16,185,129,0.55)]'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-start gap-2">
                        {playerDetections[1].matchedOptionIdx !== null && playerDetections[1].frozenRemainingSec <= 0 && (
                          <span className="bg-white/95 text-amber-950 font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 border-2 border-amber-400 animate-pulse">
                            <span className="text-xl leading-none">{shuffledOptions[playerDetections[1].matchedOptionIdx]?.poseValue}</span>
                            <span>Locking Answer</span>
                          </span>
                        )}
                      </div>

                      {/* Icy Freeze or Bad Action Penalty Overlay for Player 2 */}
                      {playerDetections[1].frozenRemainingSec > 0 && (
                        playerDetections[1].penaltyType === 'bad-action' ? (
                          <div className="self-center my-auto flex flex-col items-center text-center bg-gradient-to-b from-rose-950/95 via-red-950/95 to-slate-950/95 border-4 border-rose-400 rounded-3xl px-6 py-4 shadow-[0_0_45px_rgba(244,63,94,0.95)] max-w-xs animate-bounce">
                            <div className="flex items-center gap-2 text-2xl sm:text-3xl mb-1">
                              <span>🚨</span>
                              <span>🚫</span>
                              <span>🔔</span>
                            </div>
                            <div className="text-rose-200 font-black text-base sm:text-xl uppercase tracking-wider">
                              BAD ACTION PENALTY!
                            </div>
                            <div className="text-amber-300 font-black text-sm sm:text-base uppercase tracking-wide mt-0.5">
                              {teams[1]?.name || 'Player 2'} Score Reset to 0!
                            </div>
                            <div className="text-white font-black text-2xl sm:text-3xl tabular-nums my-0.5">
                              {playerDetections[1].frozenRemainingSec.toFixed(1)}s
                            </div>
                            <p className="text-rose-200/90 text-[11px] sm:text-xs font-bold">
                              Keep gestures respectful & positive!
                            </p>
                            <div className="w-full bg-rose-900/90 h-2.5 rounded-full mt-2.5 overflow-hidden border border-rose-400/60">
                              <div
                                className="bg-gradient-to-r from-rose-400 via-amber-400 to-red-500 h-full transition-all duration-100"
                                style={{
                                  width: `${Math.min(100, (playerDetections[1].frozenRemainingSec / (YOGA_BAD_ACTION_PENALTY_MS / 1000)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="self-center my-auto flex flex-col items-center text-center bg-cyan-950/90 border-3 border-cyan-300 rounded-3xl px-6 py-4 shadow-[0_0_35px_rgba(34,211,238,0.85)] max-w-xs animate-bounce">
                            <div className="flex items-center gap-2 text-2xl sm:text-3xl mb-1">
                              <span>❄️</span>
                              <span>🥶</span>
                              <span>🧊</span>
                            </div>
                            <div className="text-cyan-200 font-black text-base sm:text-xl uppercase tracking-wider">
                              {teams[1]?.name || 'Player 2'} FROZEN!
                            </div>
                            <div className="text-white font-black text-2xl sm:text-3xl tabular-nums my-0.5">
                              {playerDetections[1].frozenRemainingSec.toFixed(1)}s
                            </div>
                            <p className="text-cyan-200/90 text-[11px] sm:text-xs font-bold">
                              Wrong answer! Wait for ice to thaw!
                            </p>
                            <div className="w-full bg-cyan-900/90 h-2.5 rounded-full mt-2.5 overflow-hidden border border-cyan-400/50">
                              <div
                                className="bg-gradient-to-r from-cyan-300 to-sky-400 h-full transition-all duration-100"
                                style={{
                                  width: `${Math.min(100, (playerDetections[1].frozenRemainingSec / (YOGA_FREEZE_DURATION_MS / 1000)) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        )
                      )}

                      {/* Hold Progress Bar for Player 2 */}
                      <div className="w-full max-w-sm mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                        <div
                          className={`h-full rounded-full transition-all duration-75 ${
                            playerDetections[1].frozenRemainingSec > 0
                              ? playerDetections[1].penaltyType === 'bad-action'
                                ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-red-500'
                                : 'bg-gradient-to-r from-cyan-400 to-sky-300'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                          }`}
                          style={{
                            width:
                              playerDetections[1].frozenRemainingSec > 0
                                ? `${Math.min(
                                    100,
                                    (playerDetections[1].frozenRemainingSec /
                                      ((playerDetections[1].penaltyType === 'bad-action'
                                        ? YOGA_BAD_ACTION_PENALTY_MS
                                        : YOGA_FREEZE_DURATION_MS) /
                                        1000)) *
                                      100
                                  )}%`
                                : `${playerDetections[1].holdProgress}%`,
                          }}
                        />
                        <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                          {playerDetections[1].frozenRemainingSec > 0
                            ? playerDetections[1].penaltyType === 'bad-action'
                              ? `🚨 BAD ACTION PENALTY • SCORE = 0 (${playerDetections[1].frozenRemainingSec.toFixed(1)}s)`
                              : `❄️ FROZEN (${playerDetections[1].frozenRemainingSec.toFixed(1)}s)`
                            : playerDetections[1].holdProgress > 0
                            ? `Locking ${shuffledOptions[playerDetections[1].matchedOptionIdx]?.poseValue || 'Answer'}... ${playerDetections[1].holdProgress}%`
                            : 'Stand on Right & Use Infinity Gauntlet'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* 1-Player Camera Overlay */
                  <div
                    className={`absolute inset-0 p-4 pt-16 pb-44 flex flex-col justify-between pointer-events-none transition-all duration-300 ${
                      playerDetections[0].frozenRemainingSec > 0
                        ? playerDetections[0].penaltyType === 'bad-action'
                          ? 'bg-rose-600/35 backdrop-blur-[3px] border-4 border-rose-400 shadow-[inset_0_0_90px_rgba(225,29,72,0.75)]'
                          : 'bg-cyan-500/30 backdrop-blur-[3px] border-4 border-cyan-300 animate-ice-glow'
                        : isAnswering
                        ? 'bg-emerald-500/15 ring-4 ring-inset ring-emerald-400'
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between px-2">
                      <span className="bg-slate-900/85 backdrop-blur-md text-white font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-md border border-teal-300 flex items-center gap-2">
                        <span>🕷️ Left: Spider-Man</span>
                        <span className="text-slate-400">|</span>
                        <span>🥊 Right: Thanos Gauntlet</span>
                      </span>
                      {playerDetections[0].matchedOptionIdx !== null && playerDetections[0].frozenRemainingSec <= 0 && (
                        <span className="bg-white/95 text-teal-950 font-black text-xs sm:text-sm px-4 py-1.5 rounded-full shadow-lg flex items-center gap-2 border-2 border-teal-400 animate-pulse">
                          <span className="text-xl leading-none">{shuffledOptions[playerDetections[0].matchedOptionIdx]?.poseValue}</span>
                          <span>Locking Answer</span>
                        </span>
                      )}
                    </div>

                    {playerDetections[0].frozenRemainingSec > 0 && (
                      playerDetections[0].penaltyType === 'bad-action' ? (
                        <div className="self-center my-auto flex flex-col items-center text-center bg-gradient-to-b from-rose-950/95 via-red-950/95 to-slate-950/95 border-4 border-rose-400 rounded-3xl px-7 py-5 shadow-[0_0_45px_rgba(244,63,94,0.95)] max-w-sm animate-bounce">
                          <div className="flex items-center gap-2 text-3xl mb-1">
                            <span>🚨</span>
                            <span>🚫</span>
                            <span>🔔</span>
                          </div>
                          <div className="text-rose-200 font-black text-lg sm:text-2xl uppercase tracking-wider">
                            BAD ACTION PENALTY!
                          </div>
                          <div className="text-amber-300 font-black text-sm sm:text-lg uppercase tracking-wide mt-0.5">
                            Score Reset to 0!
                          </div>
                          <div className="text-white font-black text-3xl sm:text-4xl tabular-nums my-0.5">
                            {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                          </div>
                          <p className="text-rose-200/90 text-xs sm:text-sm font-bold">
                            Bad finger action detected! Keep gestures positive!
                          </p>
                        </div>
                      ) : (
                        <div className="self-center my-auto flex flex-col items-center text-center bg-cyan-950/90 border-3 border-cyan-300 rounded-3xl px-7 py-5 shadow-[0_0_40px_rgba(34,211,238,0.85)] max-w-sm animate-bounce">
                          <div className="flex items-center gap-2 text-3xl mb-1">
                            <span>❄️</span>
                            <span>🥶</span>
                            <span>🧊</span>
                          </div>
                          <div className="text-cyan-200 font-black text-lg sm:text-2xl uppercase tracking-wider">
                            PLAYER FROZEN!
                          </div>
                          <div className="text-white font-black text-3xl sm:text-4xl tabular-nums my-0.5">
                            {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                          </div>
                          <p className="text-cyan-200/90 text-xs sm:text-sm font-bold">
                            Wrong gesture! Wait for the ice to thaw & try another pose!
                          </p>
                        </div>
                      )
                    )}

                    <div className="w-full max-w-md mx-auto bg-black/60 backdrop-blur-md rounded-full h-6 p-0.5 border border-white/40 overflow-hidden relative flex items-center">
                      <div
                        className={`h-full rounded-full transition-all duration-75 ${
                          playerDetections[0].frozenRemainingSec > 0
                            ? playerDetections[0].penaltyType === 'bad-action'
                              ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-red-500'
                              : 'bg-gradient-to-r from-cyan-400 to-sky-300'
                            : 'bg-gradient-to-r from-teal-400 to-emerald-300'
                        }`}
                        style={{
                          width:
                            playerDetections[0].frozenRemainingSec > 0
                              ? `${Math.min(
                                  100,
                                  (playerDetections[0].frozenRemainingSec /
                                    ((playerDetections[0].penaltyType === 'bad-action'
                                      ? YOGA_BAD_ACTION_PENALTY_MS
                                      : YOGA_FREEZE_DURATION_MS) /
                                      1000)) *
                                    100
                                )}%`
                              : `${playerDetections[0].holdProgress}%`,
                        }}
                      />
                      <span className="absolute inset-x-0 text-center text-xs font-black text-white drop-shadow">
                        {playerDetections[0].frozenRemainingSec > 0
                          ? playerDetections[0].penaltyType === 'bad-action'
                            ? `🚨 BAD ACTION PENALTY • SCORE = 0 (${playerDetections[0].frozenRemainingSec.toFixed(1)}s)`
                            : `❄️ FROZEN (${playerDetections[0].frozenRemainingSec.toFixed(1)}s)`
                          : playerDetections[0].holdProgress > 0
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
                <div className="flex items-center gap-2 flex-wrap">
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

                  {/* Read Question Naturally Button + Auto-Voice Toggle */}
                  <button
                    onClick={() => speakQuestionByIndex(currentIdx, true)}
                    className={`px-3 py-1.5 rounded-2xl font-black text-xs sm:text-sm border shadow-sm cursor-pointer flex items-center gap-1.5 transition-all ${
                      isSpeakingQuestion
                        ? 'bg-emerald-500 text-white border-emerald-300 ring-2 ring-emerald-300 animate-pulse'
                        : 'bg-white/95 hover:bg-white text-teal-900 border-teal-200'
                    }`}
                    title="Read this question aloud naturally"
                  >
                    <Volume2 size={15} className={isSpeakingQuestion ? 'text-white' : 'text-teal-600'} />
                    <span>{isSpeakingQuestion ? 'Reading...' : 'Read Question'}</span>
                  </button>

                  <button
                    onClick={() => setVoiceEnabled(v => !v)}
                    className={`px-2.5 py-1.5 rounded-2xl font-black text-xs border shadow-sm cursor-pointer flex items-center gap-1 transition-all ${
                      voiceEnabled
                        ? 'bg-teal-600/95 hover:bg-teal-600 text-white border-teal-400'
                        : 'bg-white/85 hover:bg-white text-slate-600 border-slate-300'
                    }`}
                    title={voiceEnabled ? 'Auto-read questions ON (Click to mute)' : 'Auto-read questions OFF (Click to enable)'}
                  >
                    {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    <span className="hidden md:inline">{voiceEnabled ? 'Voice ON' : 'Voice OFF'}</span>
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
                <div className="w-full px-3 md:px-5 py-1.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
                  {/* Player 1 (Spider-Man) Interactive Scoreboard */}
                  <div
                    className={`w-full lg:w-auto lg:min-w-[215px] lg:max-w-[245px] shrink-0 bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 p-2.5 flex items-center justify-between gap-2 relative transition-all hover:scale-[1.01] pointer-events-auto ${
                      playerDetections[0].frozenRemainingSec > 0
                        ? playerDetections[0].penaltyType === 'bad-action'
                          ? 'border-rose-400 shadow-[0_0_28px_rgba(244,63,94,0.9)]'
                          : 'border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.75)]'
                        : isAnswering && winningPlayerIdx === 0
                        ? 'border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.85)] scale-[1.03]'
                        : 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                    }`}
                  >
                    {scorePops[teams[0]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[0]?.id].delta} idKey={scorePops[teams[0]?.id].key} />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md shrink-0 border ${
                          playerDetections[0].frozenRemainingSec > 0
                            ? playerDetections[0].penaltyType === 'bad-action'
                              ? 'bg-rose-600 border-rose-200 animate-pulse'
                              : 'bg-cyan-500 border-cyan-200 animate-pulse'
                            : 'bg-gradient-to-tr from-rose-600 to-red-700 border-rose-400'
                        }`}
                      >
                        {playerDetections[0].frozenRemainingSec > 0
                          ? playerDetections[0].penaltyType === 'bad-action'
                            ? '🚨'
                            : '🥶'
                          : '🕷️'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase tracking-wider text-rose-300 truncate">
                            {teams[0]?.name || 'Player 1'}
                          </span>
                        </div>
                        {playerDetections[0].frozenRemainingSec > 0 ? (
                          playerDetections[0].penaltyType === 'bad-action' ? (
                            <span className="text-[10px] font-black text-rose-300 flex items-center gap-0.5 animate-pulse">
                              🚨 BAD ACTION (0 PTS)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-cyan-300 flex items-center gap-0.5 animate-pulse">
                              ❄️ FROZEN {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                            </span>
                          )
                        ) : teamStreaks[teams[0]?.id] >= 2 ? (
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

                  {/* Question Prompt Banner (TOP OF SCREEN, LARGE & PROMINENT, CLICK TO READ NATURALLY) */}
                  <div className="flex-1 min-w-0 flex items-center justify-center gap-3">
                    {quiz.questions[currentIdx]?.image && (
                      <div className="h-14 sm:h-16 md:h-20 rounded-2xl overflow-hidden border-2 border-teal-300 shadow-lg bg-white p-0.5 shrink-0">
                        <img
                          src={quiz.questions[currentIdx]?.image}
                          alt="Question Clue"
                          className="h-full w-auto object-contain rounded-xl"
                        />
                      </div>
                    )}
                    {currentQuestionText && (
                      <div
                        onClick={() => speakQuestionByIndex(currentIdx, true)}
                        title="Click to hear question read naturally"
                        className={`w-full relative group cursor-pointer bg-white/95 backdrop-blur-md py-3 sm:py-3.5 px-5 sm:px-7 rounded-2xl sm:rounded-3xl border-3 sm:border-4 transition-all shadow-2xl text-center mx-auto ${
                          isAnswering
                            ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.45)]'
                            : 'border-teal-400 hover:border-teal-500'
                        }`}
                      >
                        <h2
                          className={`font-black text-slate-950 leading-snug ${getQuestionFontSizeClass(currentQuestionText)}`}
                        >
                          {renderFormattedQuestionContent(currentQuestionText)}
                        </h2>
                        <span
                          className={`absolute top-2 right-2.5 p-1.5 rounded-full transition-all ${
                            isSpeakingQuestion
                              ? 'bg-emerald-500 text-white animate-pulse opacity-100'
                              : 'bg-teal-50 text-teal-600 opacity-70 group-hover:opacity-100'
                          }`}
                        >
                          <Volume2 size={16} />
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Player 2 (Thanos) Interactive Scoreboard */}
                  <div
                    className={`w-full lg:w-auto lg:min-w-[215px] lg:max-w-[245px] shrink-0 bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 p-2.5 flex items-center justify-between gap-2 relative transition-all hover:scale-[1.01] pointer-events-auto ${
                      playerDetections[1].frozenRemainingSec > 0
                        ? playerDetections[1].penaltyType === 'bad-action'
                          ? 'border-rose-400 shadow-[0_0_28px_rgba(244,63,94,0.9)]'
                          : 'border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.75)]'
                        : isAnswering && winningPlayerIdx === 1
                        ? 'border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.85)] scale-[1.03]'
                        : 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
                    }`}
                  >
                    {scorePops[teams[1]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[1]?.id].delta} idKey={scorePops[teams[1]?.id].key} />
                    )}
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shadow-md shrink-0 border ${
                          playerDetections[1].frozenRemainingSec > 0
                            ? playerDetections[1].penaltyType === 'bad-action'
                              ? 'bg-rose-600 border-rose-200 animate-pulse'
                              : 'bg-cyan-500 border-cyan-200 animate-pulse'
                            : 'bg-gradient-to-tr from-amber-500 to-yellow-600 border-amber-300'
                        }`}
                      >
                        {playerDetections[1].frozenRemainingSec > 0
                          ? playerDetections[1].penaltyType === 'bad-action'
                            ? '🚨'
                            : '🥶'
                          : '🥊'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs uppercase tracking-wider text-amber-300 truncate">
                            {teams[1]?.name || 'Player 2'}
                          </span>
                        </div>
                        {playerDetections[1].frozenRemainingSec > 0 ? (
                          playerDetections[1].penaltyType === 'bad-action' ? (
                            <span className="text-[10px] font-black text-rose-300 flex items-center gap-0.5 animate-pulse">
                              🚨 BAD ACTION (0 PTS)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-cyan-300 flex items-center gap-0.5 animate-pulse">
                              ❄️ FROZEN {playerDetections[1].frozenRemainingSec.toFixed(1)}s
                            </span>
                          )
                        ) : teamStreaks[teams[1]?.id] >= 2 ? (
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
                <div className="w-full px-3 md:px-5 py-1.5 flex flex-col sm:flex-row items-center gap-3">
                  <div
                    className={`bg-slate-950/85 backdrop-blur-md rounded-2xl border-2 p-2.5 flex items-center justify-between gap-3 relative transition-all hover:scale-[1.01] pointer-events-auto shrink-0 w-full sm:w-auto min-w-[220px] ${
                      playerDetections[0].frozenRemainingSec > 0
                        ? playerDetections[0].penaltyType === 'bad-action'
                          ? 'border-rose-400 shadow-[0_0_28px_rgba(244,63,94,0.9)]'
                          : 'border-cyan-300 shadow-[0_0_25px_rgba(34,211,238,0.75)]'
                        : 'border-teal-400 shadow-[0_0_20px_rgba(45,212,191,0.35)]'
                    }`}
                  >
                    {scorePops[teams[0]?.id]?.key && (
                      <FloatingScoreBadge delta={scorePops[teams[0]?.id].delta} idKey={scorePops[teams[0]?.id].key} />
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-xl shadow-md border border-teal-300">
                        {playerDetections[0].frozenRemainingSec > 0
                          ? playerDetections[0].penaltyType === 'bad-action'
                            ? '🚨'
                            : '🥶'
                          : '⚡'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-xs uppercase tracking-wider text-teal-300">
                          {teams[0]?.name || 'Player 1'}
                        </span>
                        {playerDetections[0].frozenRemainingSec > 0 ? (
                          playerDetections[0].penaltyType === 'bad-action' ? (
                            <span className="text-[10px] font-black text-rose-300 animate-pulse">
                              🚨 BAD ACTION PENALTY (0 PTS)
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-cyan-300 animate-pulse">
                              ❄️ FROZEN {playerDetections[0].frozenRemainingSec.toFixed(1)}s
                            </span>
                          )
                        ) : (
                          teamStreaks[teams[0]?.id] >= 2 && (
                            <span className="text-[10px] font-black text-amber-300 animate-pulse">
                              🔥 {teamStreaks[teams[0]?.id]}x STREAK!
                            </span>
                          )
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
                    <div className="flex-1 w-full flex items-center justify-center gap-3">
                      {quiz.questions[currentIdx]?.image && (
                        <div className="h-14 sm:h-16 md:h-20 rounded-2xl overflow-hidden border-2 border-teal-300 shadow-lg bg-white p-0.5 shrink-0">
                          <img
                            src={quiz.questions[currentIdx]?.image}
                            alt="Question Clue"
                            className="h-full w-auto object-contain rounded-xl"
                          />
                        </div>
                      )}
                      {currentQuestionText && (
                        <div
                          onClick={() => speakQuestionByIndex(currentIdx, true)}
                          title="Click to hear question read naturally"
                          className={`w-full relative group cursor-pointer bg-white/95 backdrop-blur-md py-3 sm:py-3.5 px-5 sm:px-7 rounded-2xl sm:rounded-3xl border-3 sm:border-4 transition-all shadow-2xl text-center mx-auto ${
                            isAnswering
                              ? 'border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.45)]'
                              : 'border-teal-400 hover:border-teal-500'
                          }`}
                        >
                          <h2
                            className={`font-black text-slate-950 leading-snug ${getQuestionFontSizeClass(currentQuestionText)}`}
                          >
                            {renderFormattedQuestionContent(currentQuestionText)}
                          </h2>
                          <span
                            className={`absolute top-2 right-2.5 p-1.5 rounded-full transition-all ${
                              isSpeakingQuestion
                                ? 'bg-emerald-500 text-white animate-pulse opacity-100'
                                : 'bg-teal-50 text-teal-600 opacity-70 group-hover:opacity-100'
                            }`}
                          >
                            <Volume2 size={16} />
                          </span>
                        </div>
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

            {/* Clear Middle Camera Viewport + Superhero Round Winner Announcement Card */}
            <div className="flex-1 min-h-[100px] pointer-events-none flex flex-col items-center justify-center relative z-20 px-4">
              {roundWinnerInfo ? (
                <div
                  className={`px-6 py-4 rounded-3xl bg-slate-950/92 backdrop-blur-md text-white shadow-[0_0_45px_rgba(16,185,129,0.65)] border-3 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 animate-bounce ${
                    roundWinnerInfo.themeColor === 'rose'
                      ? 'border-rose-400'
                      : roundWinnerInfo.themeColor === 'amber'
                      ? 'border-amber-400'
                      : 'border-emerald-400'
                  }`}
                >
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shadow-lg border-2 ${
                      roundWinnerInfo.themeColor === 'rose'
                        ? 'bg-gradient-to-tr from-rose-600 to-red-500 border-rose-300'
                        : roundWinnerInfo.themeColor === 'amber'
                        ? 'bg-gradient-to-tr from-amber-500 to-yellow-500 border-amber-200'
                        : 'bg-gradient-to-tr from-emerald-500 to-teal-500 border-emerald-200'
                    }`}
                  >
                    {roundWinnerInfo.heroIcon}
                  </div>
                  <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-emerald-300">
                        🏆 ROUND WINNER
                      </span>
                      {roundWinnerInfo.streak >= 2 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase">
                          🔥 {roundWinnerInfo.streak}x STREAK!
                        </span>
                      )}
                    </div>
                    <div className="text-lg sm:text-2xl font-black tracking-tight text-white">
                      {roundWinnerInfo.playerName} <span className="text-teal-300">({roundWinnerInfo.heroTitle})</span>
                    </div>
                    {roundWinnerInfo.answerText && (
                      <div className="text-xs sm:text-sm font-bold text-slate-300 mt-0.5">
                        Correct Answer: <span className="text-emerald-300 font-black">“{roundWinnerInfo.answerText}”</span>
                      </div>
                    )}
                  </div>
                  <div className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-base sm:text-xl shadow-md border border-emerald-300">
                    +1 PT!
                  </div>
                </div>
              ) : (
                roundWinnerBanner && (
                  <div className="px-6 py-2.5 rounded-full bg-slate-950/90 text-white font-black text-sm sm:text-base shadow-2xl border-2 border-teal-400 animate-bounce">
                    {roundWinnerBanner}
                  </div>
                )
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
                        onClick={() => speakQuestionByIndex(currentIdx, true)}
                        className={`font-black text-slate-900 bg-white/95 backdrop-blur-md py-2.5 sm:py-3.5 px-5 sm:px-8 rounded-2xl sm:rounded-3xl border-4 border-teal-400 shadow-lg inline-block min-w-[45%] max-w-[95%] leading-snug cursor-pointer ${getQuestionFontSizeClass(currentQuestionText)}`}
                      >
                        {renderFormattedQuestionContent(currentQuestionText)}
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
                  const isFrozenWrongCard =
                    !isAnswering &&
                    ((playerDetections[0].frozenRemainingSec > 0 && playerDetections[0].lastWrongOptionIdx === index) ||
                      (playerDetections[1].frozenRemainingSec > 0 && playerDetections[1].lastWrongOptionIdx === index));

                  let btnClasses = `flex-1 min-w-0 bg-white/95 border-3 sm:border-4 border-teal-100 text-slate-800 font-bold p-3 sm:p-4 rounded-3xl transition-all duration-200 flex flex-col items-center justify-between text-center shadow-lg relative group outline-none overflow-hidden min-h-[92px] sm:min-h-[112px] `;

                  if (isAnswering) {
                    if (opt.isCorrect) {
                      btnClasses += "bg-gradient-to-b from-emerald-50 to-emerald-100 border-emerald-500 text-emerald-950 scale-[1.04] z-10 shadow-[0_0_35px_rgba(16,185,129,0.75)] ring-4 ring-emerald-400";
                    } else if (index === selectedOption) {
                      btnClasses += "bg-rose-100 border-rose-600 text-rose-950";
                    } else {
                      btnClasses += "opacity-50 scale-95";
                    }
                  } else if (isFrozenWrongCard) {
                    btnClasses += "bg-cyan-50/95 border-cyan-400 text-cyan-950 ring-4 ring-cyan-300/70 shadow-[0_0_25px_rgba(34,211,238,0.6)]";
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
                      {/* Correct / Incorrect / Frozen Wrong Indicator */}
                      {isAnswering && opt.isCorrect && (
                        <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-xs sm:text-sm font-black shadow-md z-30 flex items-center gap-1 animate-bounce">
                          <span>✓</span>
                          <span>CORRECT!</span>
                        </div>
                      )}
                      {isFrozenWrongCard && (
                        <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-cyan-600 text-white text-[11px] sm:text-xs font-black shadow-md z-30 flex items-center gap-1 animate-pulse">
                          <span>❄️</span>
                          <span>WRONG</span>
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
                            <div className="w-full bg-rose-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-rose-600 h-full transition-all duration-75"
                                style={{ width: `${playerDetections[0].holdProgress}%` }}
                              />
                            </div>
                          )}
                          {p2Locking && (
                            <div className="w-full bg-amber-100 h-2.5 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full transition-all duration-75"
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

        {/* END / GRAND CHAMPIONSHIP WINNER ANNOUNCEMENT SCREEN */}
        {gameState === 'end' && (
          <div className="p-6 md:p-12 text-center flex flex-col items-center justify-center flex-grow animate-fade-in z-10">
            {(() => {
              const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
              const winner = sortedTeams[0];
              const isTwoP = teams.length >= 2;
              const isTie = sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score;
              const winnerOriginalIdx = teams.findIndex(t => t.id === winner?.id);
              const winnerHeroTitle = isTwoP
                ? winnerOriginalIdx === 0
                  ? 'Spider-Man'
                  : 'Thanos Gauntlet'
                : 'Grand Yoga Champion';
              const winnerHeroIcon = isTwoP ? (winnerOriginalIdx === 0 ? '🕷️' : '🥊') : '⚡';

              return (
                <>
                  {/* Grand Champion Banner Card */}
                  <div className="relative bg-gradient-to-b from-slate-900 via-teal-950 to-slate-950 text-white border-4 border-amber-400 rounded-[2.5rem] p-6 md:p-10 mb-8 w-full max-w-3xl shadow-[0_20px_60px_rgba(15,118,110,0.45)] mx-auto overflow-hidden">
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-400/20 blur-3xl pointer-events-none" />

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border border-amber-300/60 text-amber-300 font-black text-xs sm:text-sm uppercase tracking-widest mb-4">
                      <Trophy size={16} />
                      <span>{isTie ? 'CHAMPIONSHIP DRAW' : 'GRAND CHAMPIONSHIP WINNER'}</span>
                    </div>

                    <div className="flex items-center justify-center gap-4 mb-3">
                      <div className="text-5xl md:text-7xl animate-bounce">🏆</div>
                      {!isTie && (
                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-4xl md:text-5xl shadow-xl border-3 border-white">
                          {winnerHeroIcon}
                        </div>
                      )}
                      <div className="text-5xl md:text-7xl animate-bounce">👑</div>
                    </div>

                    {isTie ? (
                      <>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-2 tracking-tight">
                          It&apos;s an Epic Tie!
                        </h1>
                        <p className="text-teal-200 font-bold text-base md:text-xl mb-6">
                          Both heroes matched pose for pose with {winner?.score || 0} points!
                        </p>
                      </>
                    ) : (
                      <>
                        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 mb-2 tracking-tight">
                          {winner?.name} Wins!
                        </h1>
                        <p className="text-teal-200 font-black text-lg md:text-2xl mb-6 flex items-center justify-center gap-2">
                          <span>{winnerHeroIcon}</span>
                          <span>{winnerHeroTitle} Champion</span>
                          <span>•</span>
                          <span className="text-amber-300">{winner?.score || 0} Points</span>
                        </p>
                      </>
                    )}

                    {/* Podium Cards */}
                    <div className="flex flex-wrap justify-center items-end gap-4 md:gap-6 mt-2">
                      {sortedTeams.map((team, idx) => {
                        const origIdx = teams.findIndex(t => t.id === team.id);
                        const heroIcon = isTwoP ? (origIdx === 0 ? '🕷️' : '🥊') : '⚡';
                        const heroLabel = isTwoP ? (origIdx === 0 ? 'Spider-Man' : 'Thanos Gauntlet') : 'Yoga Hero';
                        const isFirst = idx === 0;
                        return (
                          <div
                            key={team.id}
                            className={`flex flex-col items-center rounded-3xl border-3 p-5 md:p-6 min-w-[165px] transition-all ${
                              isFirst
                                ? 'bg-gradient-to-b from-amber-400/25 to-amber-500/10 border-amber-300 scale-105 shadow-[0_0_30px_rgba(251,191,36,0.35)]'
                                : 'bg-white/10 border-teal-400/40'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-2xl">{isFirst ? '🥇' : '🥈'}</span>
                              <span className="text-2xl">{heroIcon}</span>
                            </div>
                            <span className="font-black text-lg md:text-xl text-white">{team.name}</span>
                            <span className="text-xs font-bold uppercase tracking-wider text-teal-200 mb-2">
                              {heroLabel}
                            </span>
                            <div className="px-4 py-1.5 rounded-2xl bg-black/40 border border-white/15">
                              <span className="text-3xl md:text-5xl font-black text-amber-300 tabular-nums">
                                {team.score}
                              </span>
                              <span className="text-xs font-black text-slate-300 ml-1 uppercase">pts</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Replay Voice Winner Announcement Button */}
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => announceGrandWinner(true)}
                        className="px-5 py-2 rounded-full bg-white/15 hover:bg-white/25 text-amber-200 border border-amber-300/50 font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-all"
                      >
                        <Volume2 size={16} />
                        <span>Announce Winner Aloud</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 w-full max-w-xl mx-auto">
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
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
