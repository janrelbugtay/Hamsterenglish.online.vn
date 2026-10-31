import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ViewState } from '../types';
import { FullscreenButton } from '../components/FullscreenButton';
import { MediaPickerModal } from '../components/MediaPickerModal';
import { BulkPasteVideoModal } from '../components/BulkPasteVideoModal';
import { GameModeModal } from '../components/GameModeModal';
import {
  SetupCurriculumHeader,
  SmartOptionInput,
  SmartQuestionInput,
  convertQuestionsContentMode,
} from '../components/SetupSmartControls';
import { parseOptionContent, formatOptionContent, AnswerContentMode } from '../utils/mediaAndPresets';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Sparkles,
  Save,
  X,
  Play,
  ClipboardList,
  Info,
  Settings,
  Copy,
  Volume2,
  VolumeX,
  Shuffle,
  Check,
  Camera,
  Gauge,
  Edit3,
  User,
  CheckCircle2,
  RefreshCw,
  Zap,
  Shield,
} from 'lucide-react';
import { collection, query, where, getDocs, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

export interface ChaseQuestion {
  id: number | string;
  text: string;
  image?: string;
  options: [string, string] | string[];
  answerIndex: number;
}

interface ChaseQuiz {
  id: number | string;
  title?: string;
  subject?: string;
  folderId?: string;
  topic?: string;
  classLevel?: string;
  questions: ChaseQuestion[];
  isPublic?: boolean;
}

export type FullBodyPoseId =
  | 'dancer'
  | 'star-jump'
  | 'tree'
  | 'sky-reach'
  | 'hero-flex'
  | 'warrior';

export interface FullBodyPoseSpec {
  id: FullBodyPoseId;
  name: string;
  emoji: string;
  instruction: string;
  shortTag: string;
}

export const FULL_BODY_POSES: FullBodyPoseSpec[] = [
  {
    id: 'dancer',
    name: 'Dancer Pose',
    emoji: '💃',
    instruction: 'Reach one arm forward & lift one knee/foot up!',
    shortTag: '1 Arm Out + Lift Leg',
  },
  {
    id: 'star-jump',
    name: 'Star Jump Pose',
    emoji: '⭐',
    instruction: 'Jump & spread both arms and legs wide like a star!',
    shortTag: 'Arms & Legs Wide',
  },
  {
    id: 'tree',
    name: 'Tree Balance Pose',
    emoji: '🌳',
    instruction: 'Bring hands together & balance with one knee lifted!',
    shortTag: 'Palms Together + Balance',
  },
  {
    id: 'sky-reach',
    name: 'Sky Jump Reach',
    emoji: '🙌',
    instruction: 'Jump up & stretch both hands high above your head!',
    shortTag: 'Both Hands High Up',
  },
  {
    id: 'hero-flex',
    name: 'Superhero Double Flex',
    emoji: '💪',
    instruction: 'Raise both elbows & flex both fists strong!',
    shortTag: 'Double Bicep Flex',
  },
  {
    id: 'warrior',
    name: 'Warrior Wide Pose',
    emoji: '⚔️',
    instruction: 'Step wide & stretch both arms straight out horizontally!',
    shortTag: 'Wide Stance + T-Arms',
  },
];

export interface BodyDetectionTelemetry {
  headDetected: boolean;
  torsoArmsDetected: boolean;
  hipsDetected: boolean;
  legsFeetDetected: boolean;
  coveragePct: number; // 0 to 100
  isCalibrated: boolean;
  lane: -1 | 0 | 1; // -1 = Left, 0 = Center, 1 = Right
  normalizedX: number; // 0..1 (left to right on mirrored screen)
  isJumping: boolean;
  isPunching: boolean;
  punchSide: -1 | 0 | 1;
  isWallKicking: boolean;
  kickSide: -1 | 0 | 1;
  activePose: FullBodyPoseId | null;
  statusLabel: string;
}

const SAMPLE_CHASE_QUESTIONS: ChaseQuestion[] = [
  { id: 201, text: 'The meat from a cow is called ___.', options: ['beef', 'pork'], answerIndex: 0 },
  { id: 202, text: 'She ___ through the city park every morning.', options: ['runs', 'run'], answerIndex: 0 },
  { id: 203, text: 'What is the past tense of "catch"?', options: ['Caught', 'Catched'], answerIndex: 0 },
  { id: 204, text: 'Which animal has the longest neck in Zootopia?', options: ['Giraffe', ' Hippo'], answerIndex: 0 },
  { id: 205, text: 'Stop at the red traffic ___!', options: ['light', 'lite'], answerIndex: 0 },
  { id: 206, text: 'Opposite of "DANGEROUS"?', options: ['Safe', 'Wild'], answerIndex: 0 },
  { id: 207, text: 'Police officers help keep the city ___.', options: ['safe', 'loud'], answerIndex: 0 },
  { id: 208, text: 'They ___ jumping over the barrier right now!', options: ['are', 'is'], answerIndex: 0 },
];

export function normalizeChaseQuestions(rawQuestions: any[]): ChaseQuestion[] {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return SAMPLE_CHASE_QUESTIONS;
  }
  return rawQuestions.map((q: any, idx: number) => {
    const rawOpts = Array.isArray(q.options) ? q.options : ['', ''];
    const origAnswerIdx =
      typeof q.answerIndex === 'number' ? q.answerIndex : typeof q.correct === 'number' ? q.correct : 0;
    const correctOpt = rawOpts[origAnswerIdx] ?? rawOpts[0] ?? 'Option A';
    let secondOpt = rawOpts.find(
      (_: any, i: number) => i !== origAnswerIdx && typeof _ === 'string' && _.trim() !== ''
    );
    if (secondOpt === undefined) {
      secondOpt = rawOpts[origAnswerIdx === 0 ? 1 : 0] ?? 'Option B';
    }
    const keepOrder = origAnswerIdx === 1;
    return {
      id: q.id || Date.now() + idx + Math.random(),
      text: q.text || q.question || 'Choose the correct option!',
      image: q.image || q.imageUrl,
      options: keepOrder ? [secondOpt, correctOpt] : [correctOpt, secondOpt],
      answerIndex: keepOrder ? 1 : 0,
    };
  });
}

// Helper to ensure @mediapipe/pose is loaded on window.Pose
let poseScriptPromise: Promise<any> | null = null;
export function ensureMediaPipePoseLoaded(): Promise<any> {
  const win = window as any;
  if (win.Pose) return Promise.resolve(win.Pose);
  if (poseScriptPromise) return poseScriptPromise;
  poseScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src*="@mediapipe/pose"]');
    if (existing) {
      let checks = 0;
      const timer = setInterval(() => {
        checks++;
        if ((window as any).Pose || checks > 40) {
          clearInterval(timer);
          resolve((window as any).Pose);
        }
      }, 100);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve((window as any).Pose);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return poseScriptPromise;
}

/**
 * Evaluates 33 MediaPipe Pose landmarks from Head (0) to Feet (27-32)
 * and extracts full-body coverage, lane position, jump, punch, wall kick, and yoga/action pose!
 */
export function analyzeFullBodyLandmarks(
  rawLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }>,
  baselineRef: {
    shoulderY: number | null;
    hipY: number | null;
    ankleY: number | null;
    prevLeftWrist: { x: number; y: number; z: number; t: number } | null;
    prevRightWrist: { x: number; y: number; z: number; t: number } | null;
    calibrated: boolean;
  },
  nowMs: number
): BodyDetectionTelemetry {
  if (!rawLandmarks || rawLandmarks.length < 29) {
    return {
      headDetected: false,
      torsoArmsDetected: false,
      hipsDetected: false,
      legsFeetDetected: false,
      coveragePct: 0,
      isCalibrated: baselineRef.calibrated,
      lane: 0,
      normalizedX: 0.5,
      isJumping: false,
      isPunching: false,
      punchSide: 0,
      isWallKicking: false,
      kickSide: 0,
      activePose: null,
      statusLabel: 'Step in front of camera (Head to Feet)',
    };
  }

  // Mirror X coordinates so moving left on screen = smaller X (0..1)
  const lm = rawLandmarks.map((p) => ({
    x: 1.0 - p.x,
    y: p.y,
    z: p.z ?? 0,
    v: p.visibility ?? 0.5,
  }));

  const nose = lm[0];
  const lShoulder = lm[11];
  const rShoulder = lm[12];
  const lElbow = lm[13];
  const rElbow = lm[14];
  const lWrist = lm[15];
  const rWrist = lm[16];
  const lHip = lm[23];
  const rHip = lm[24];
  const lKnee = lm[25];
  const rKnee = lm[26];
  const lAnkle = lm[27];
  const rAnkle = lm[28];
  const lFoot = lm[31] || lAnkle;
  const rFoot = lm[32] || rAnkle;

  const inFrame = (pt: { x: number; y: number; v: number }, minV = 0.35) =>
    pt && pt.v >= minV && pt.x >= 0.02 && pt.x <= 0.98 && pt.y >= 0.01 && pt.y <= 0.99;

  const headDetected = inFrame(nose, 0.4);
  const torsoArmsDetected =
    (inFrame(lShoulder, 0.35) || inFrame(rShoulder, 0.35)) &&
    (inFrame(lWrist, 0.3) || inFrame(rWrist, 0.3) || inFrame(lElbow, 0.35) || inFrame(rElbow, 0.35));
  const hipsDetected = inFrame(lHip, 0.32) || inFrame(rHip, 0.32);
  const legsFeetDetected =
    inFrame(lAnkle, 0.28) ||
    inFrame(rAnkle, 0.28) ||
    inFrame(lFoot, 0.28) ||
    inFrame(rFoot, 0.28) ||
    (baselineRef.calibrated && (inFrame(lKnee, 0.3) || inFrame(rKnee, 0.3)));

  let zonesCount = 0;
  if (headDetected) zonesCount += 25;
  if (torsoArmsDetected) zonesCount += 25;
  if (hipsDetected) zonesCount += 25;
  if (legsFeetDetected) zonesCount += 25;
  if (baselineRef.calibrated && zonesCount >= 50) {
    zonesCount = 100;
  }

  // Center X of body (average of nose, shoulders, hips)
  const midShoulderX = (lShoulder.x + rShoulder.x) * 0.5;
  const midShoulderY = (lShoulder.y + rShoulder.y) * 0.5;
  const midHipX = (lHip.x + rHip.x) * 0.5;
  const midHipY = (lHip.y + rHip.y) * 0.5;
  const bodyX = headDetected ? nose.x * 0.4 + midShoulderX * 0.6 : midShoulderX;

  const torsoLen = Math.max(0.12, Math.abs(midHipY - midShoulderY));
  const shoulderWidth = Math.max(0.08, Math.abs(lShoulder.x - rShoulder.x));

  // Maintain adaptive standing baseline for Shoulder Y, Hip Y, and Ankle Y
  if (baselineRef.shoulderY === null) {
    baselineRef.shoulderY = midShoulderY;
    baselineRef.hipY = midHipY;
    baselineRef.ankleY = (lAnkle.y + rAnkle.y) * 0.5;
  } else {
    // Slowly adapt baseline when not jumping
    const dyShoulder = baselineRef.shoulderY - midShoulderY;
    if (dyShoulder < torsoLen * 0.22) {
      baselineRef.shoulderY = baselineRef.shoulderY * 0.96 + midShoulderY * 0.04;
      baselineRef.hipY = (baselineRef.hipY ?? midHipY) * 0.96 + midHipY * 0.04;
      baselineRef.ankleY = (baselineRef.ankleY ?? (lAnkle.y + rAnkle.y) * 0.5) * 0.96 + (lAnkle.y + rAnkle.y) * 0.5 * 0.04;
    }
  }

  // 1. Lane Dodge Left / Center / Right
  // Also factor upper body lean angle (midShoulderX - midHipX) so leaning OR stepping works!
  const leanOffset = hipsDetected ? (midShoulderX - midHipX) * 1.35 : 0;
  const effectiveX = THREE.MathUtils.clamp(bodyX + leanOffset, 0, 1);
  let lane: -1 | 0 | 1 = 0;
  if (effectiveX < 0.41) lane = -1;
  else if (effectiveX > 0.59) lane = 1;

  // 2. Jump Detection (Head + Shoulders + Hips/Feet rise up OR Both Hands + Shoulders surge up)
  const shoulderRise = (baselineRef.shoulderY ?? midShoulderY) - midShoulderY;
  const bothHandsAboveHead = lWrist.y < nose.y - 0.02 && rWrist.y < nose.y - 0.02;
  const isJumping =
    shoulderRise > Math.max(0.042, torsoLen * 0.24) ||
    (bothHandsAboveHead && shoulderRise > 0.022);

  // 3. Punch Detection (Fast wrist thrust or extended boxing punch at shoulder height)
  let lVel = 0;
  let rVel = 0;
  if (baselineRef.prevLeftWrist) {
    const dt = Math.max(16, nowMs - baselineRef.prevLeftWrist.t) / 1000;
    const dxy = Math.hypot(lWrist.x - baselineRef.prevLeftWrist.x, lWrist.y - baselineRef.prevLeftWrist.y);
    const dz = Math.max(0, baselineRef.prevLeftWrist.z - lWrist.z);
    lVel = (dxy + dz * 1.4) / dt;
  }
  if (baselineRef.prevRightWrist) {
    const dt = Math.max(16, nowMs - baselineRef.prevRightWrist.t) / 1000;
    const dxy = Math.hypot(rWrist.x - baselineRef.prevRightWrist.x, rWrist.y - baselineRef.prevRightWrist.y);
    const dz = Math.max(0, baselineRef.prevRightWrist.z - rWrist.z);
    rVel = (dxy + dz * 1.4) / dt;
  }
  baselineRef.prevLeftWrist = { x: lWrist.x, y: lWrist.y, z: lWrist.z, t: nowMs };
  baselineRef.prevRightWrist = { x: rWrist.x, y: rWrist.y, z: rWrist.z, t: nowMs };

  const lArmReach = Math.hypot(lWrist.x - lShoulder.x, lWrist.y - lShoulder.y);
  const rArmReach = Math.hypot(rWrist.x - rShoulder.x, rWrist.y - rShoulder.y);
  const lPunchPosture =
    inFrame(lWrist, 0.3) &&
    lWrist.y > nose.y - 0.08 &&
    lWrist.y < midHipY &&
    (lVel > 1.25 || (lArmReach > shoulderWidth * 1.25 && lWrist.z < lShoulder.z - 0.12));
  const rPunchPosture =
    inFrame(rWrist, 0.3) &&
    rWrist.y > nose.y - 0.08 &&
    rWrist.y < midHipY &&
    (rVel > 1.25 || (rArmReach > shoulderWidth * 1.25 && rWrist.z < rShoulder.z - 0.12));

  const isPunching = lPunchPosture || rPunchPosture;
  let punchSide: -1 | 0 | 1 = 0;
  if (isPunching) {
    if (lane !== 0) punchSide = lane;
    else punchSide = lPunchPosture && !rPunchPosture ? -1 : rPunchPosture && !lPunchPosture ? 1 : effectiveX < 0.5 ? -1 : 1;
  }

  // 4. Wall Kick Detection (One knee or ankle lifted high relative to the other leg, or high side kick!)
  const kneeDiffY = Math.abs(lKnee.y - rKnee.y);
  const ankleDiffY = Math.abs(lAnkle.y - rAnkle.y);
  const lKneeHigh = inFrame(lKnee, 0.25) && (rKnee.y - lKnee.y > torsoLen * 0.25 || lKnee.y < midHipY + torsoLen * 0.42);
  const rKneeHigh = inFrame(rKnee, 0.25) && (lKnee.y - rKnee.y > torsoLen * 0.25 || rKnee.y < midHipY + torsoLen * 0.42);
  const lAnkleKick = inFrame(lAnkle, 0.25) && rAnkle.y - lAnkle.y > torsoLen * 0.28;
  const rAnkleKick = inFrame(rAnkle, 0.25) && lAnkle.y - rAnkle.y > torsoLen * 0.28;

  const isWallKicking = lKneeHigh || rKneeHigh || lAnkleKick || rAnkleKick || kneeDiffY > torsoLen * 0.28 || ankleDiffY > torsoLen * 0.3;
  let kickSide: -1 | 0 | 1 = lane;
  if (isWallKicking && kickSide === 0) {
    kickSide = lKneeHigh || lAnkleKick ? -1 : 1;
  }

  // 5. Full-Body Pose Classification (for Yellow Pose Wall Options!)
  let activePose: FullBodyPoseId | null = null;
  const wristsDist = Math.hypot(lWrist.x - rWrist.x, lWrist.y - rWrist.y);
  const anklesDist = Math.hypot(lAnkle.x - rAnkle.x, lAnkle.y - rAnkle.y);
  const lArmOut = Math.abs(lWrist.x - lShoulder.x) > shoulderWidth * 0.85;
  const rArmOut = Math.abs(rWrist.x - rShoulder.x) > shoulderWidth * 0.85;

  if (bothHandsAboveHead && wristsDist < shoulderWidth * 1.35) {
    activePose = 'sky-reach';
  } else if (
    (bothHandsAboveHead || (lWrist.y < lShoulder.y && rWrist.y < rShoulder.y)) &&
    wristsDist >= shoulderWidth * 1.35 &&
    (anklesDist > shoulderWidth * 0.9 || isJumping)
  ) {
    activePose = 'star-jump';
  } else if (wristsDist < shoulderWidth * 0.68 && lWrist.y < midHipY) {
    activePose = 'tree';
  } else if ((lArmOut || rArmOut) && isWallKicking) {
    activePose = 'dancer';
  } else if (lArmOut && rArmOut && Math.abs(lWrist.y - lShoulder.y) < torsoLen * 0.55 && Math.abs(rWrist.y - rShoulder.y) < torsoLen * 0.55) {
    activePose = 'warrior';
  } else if (lWrist.y < lElbow.y && rWrist.y < rElbow.y && lWrist.y < lShoulder.y + 0.05 && rWrist.y < rShoulder.y + 0.05) {
    activePose = 'hero-flex';
  } else if (lArmOut || rArmOut) {
    activePose = 'dancer';
  }

  let statusLabel = 'CENTER LANE';
  if (isPunching) statusLabel = `🥊 PUNCHING ${punchSide < 0 ? 'LEFT' : 'RIGHT'}!`;
  else if (isWallKicking) statusLabel = `🦵 WALL KICK ${kickSide < 0 ? 'LEFT' : 'RIGHT'}!`;
  else if (isJumping && activePose) statusLabel = `⬆️ JUMP + ${activePose.toUpperCase()} POSE!`;
  else if (isJumping) statusLabel = '⬆️ JUMPING!';
  else if (activePose) statusLabel = `🧘 POSE: ${activePose.toUpperCase()}`;
  else if (lane < 0) statusLabel = '⬅️ DODGING LEFT';
  else if (lane > 0) statusLabel = '➡️ DODGING RIGHT';

  return {
    headDetected,
    torsoArmsDetected,
    hipsDetected,
    legsFeetDetected,
    coveragePct: zonesCount,
    isCalibrated: zonesCount === 100 || baselineRef.calibrated,
    lane,
    normalizedX: effectiveX,
    isJumping,
    isPunching,
    punchSide,
    isWallKicking,
    kickSide,
    activePose,
    statusLabel,
  };
}

/**
 * Draws the 33-point Head-to-Feet Neon Skeleton & Human Body Frame on a 2D Canvas
 */
export function drawFullBodySkeletonOverlay(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  rawLandmarks: Array<{ x: number; y: number; z?: number; visibility?: number }> | null,
  telemetry: BodyDetectionTelemetry,
  showSilhouetteGuide = true
) {
  ctx.clearRect(0, 0, cw, ch);

  // 1. Optional Head-to-Feet Human Silhouette Calibration Guide
  if (showSilhouetteGuide) {
    ctx.save();
    const isLocked = telemetry.coveragePct >= 75 || telemetry.isCalibrated;
    ctx.strokeStyle = isLocked ? 'rgba(52, 211, 153, 0.7)' : 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);

    // Head guide circle
    const cx = cw * 0.5;
    ctx.beginPath();
    ctx.arc(cx, ch * 0.14, Math.min(cw, ch) * 0.065, 0, Math.PI * 2);
    ctx.stroke();

    // Torso & Legs bounding guide from Head (5%) to Feet (95%)
    ctx.strokeRect(cw * 0.26, ch * 0.04, cw * 0.48, ch * 0.92);

    // Horizontal zone dividers: HEAD | TORSO | HIPS | FEET
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    [0.22, 0.54, 0.78].forEach((yRatio) => {
      ctx.beginPath();
      ctx.moveTo(cw * 0.26, ch * yRatio);
      ctx.lineTo(cw * 0.74, ch * yRatio);
      ctx.stroke();
    });
    ctx.restore();
  }

  // 2. Lane Dividers (Left Dodge | Center | Right Dodge)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cw * 0.41, 0);
  ctx.lineTo(cw * 0.41, ch);
  ctx.moveTo(cw * 0.59, 0);
  ctx.lineTo(cw * 0.59, ch);
  ctx.stroke();
  ctx.restore();

  if (!rawLandmarks || rawLandmarks.length < 29) return;

  const pts = rawLandmarks.map((p) => ({
    x: (1.0 - p.x) * cw,
    y: p.y * ch,
    v: p.visibility ?? 0.5,
  }));

  // Connections from Head to Feet
  const connections: Array<[number, number, string]> = [
    // Torso
    [11, 12, '#38bdf8'],
    [11, 23, '#38bdf8'],
    [12, 24, '#38bdf8'],
    [23, 24, '#38bdf8'],
    // Left Arm
    [11, 13, '#fbbf24'],
    [13, 15, '#fbbf24'],
    // Right Arm
    [12, 14, '#fbbf24'],
    [14, 16, '#fbbf24'],
    // Left Leg & Foot
    [23, 25, '#34d399'],
    [25, 27, '#34d399'],
    [27, 29, '#34d399'],
    [27, 31, '#34d399'],
    // Right Leg & Foot
    [24, 26, '#34d399'],
    [26, 28, '#34d399'],
    [28, 30, '#34d399'],
    [28, 32, '#34d399'],
  ];

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [a, b, color] of connections) {
    const pa = pts[a];
    const pb = pts[b];
    if (!pa || !pb || (pa.v < 0.25 && pb.v < 0.25)) continue;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
    ctx.stroke();
  }

  // Head Halo around Nose (0)
  const nose = pts[0];
  if (nose && nose.v >= 0.3) {
    ctx.strokeStyle = '#fde047';
    ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(nose.x, nose.y, Math.max(12, cw * 0.045), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Boxing Gloves on Wrists (15, 16) & Boots on Ankles/Feet (27, 28, 31, 32)
  [15, 16].forEach((idx) => {
    const p = pts[idx];
    if (!p || p.v < 0.25) return;
    ctx.fillStyle = telemetry.isPunching ? '#ef4444' : '#f59e0b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, telemetry.isPunching ? 11 : 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  [27, 28, 31, 32].forEach((idx) => {
    const p = pts[idx];
    if (!p || p.v < 0.22) return;
    ctx.fillStyle = telemetry.isWallKicking ? '#ec4899' : '#10b981';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, telemetry.isWallKicking ? 10 : 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

/********************************************************************
 * REUSABLE SETUP COMPONENT: FULL-BODY HEAD-TO-FEET DETECTION SCANNER
 ********************************************************************/
export function BodyHeadToFeetSetupScanner({
  onCalibratedChange,
  compact = false,
}: {
  onCalibratedChange?: (isReady: boolean, telemetry: BodyDetectionTelemetry) => void;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<BodyDetectionTelemetry>({
    headDetected: false,
    torsoArmsDetected: false,
    hipsDetected: false,
    legsFeetDetected: false,
    coveragePct: 0,
    isCalibrated: false,
    lane: 0,
    normalizedX: 0.5,
    isJumping: false,
    isPunching: false,
    punchSide: 0,
    isWallKicking: false,
    kickSide: 0,
    activePose: null,
    statusLabel: 'Initializing Full-Body AI Scanner...',
  });

  const baselineRef = useRef<{
    shoulderY: number | null;
    hipY: number | null;
    ankleY: number | null;
    prevLeftWrist: { x: number; y: number; z: number; t: number } | null;
    prevRightWrist: { x: number; y: number; z: number; t: number } | null;
    calibrated: boolean;
  }>({
    shoulderY: null,
    hipY: null,
    ankleY: null,
    prevLeftWrist: null,
    prevRightWrist: null,
    calibrated: false,
  });

  const onCalibratedChangeRef = useRef(onCalibratedChange);
  onCalibratedChangeRef.current = onCalibratedChange;

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let poseDetector: any = null;
    let lastUpdateUi = 0;

    const startScanner = async () => {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setCameraReady(true);
        }

        const PoseClass = await ensureMediaPipePoseLoaded();
        if (!active) return;

        if (PoseClass) {
          poseDetector = new PoseClass({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
          });
          poseDetector.setOptions({
            modelComplexity: 0,
            smoothLandmarks: true,
            minDetectionConfidence: 0.35,
            minTrackingConfidence: 0.35,
          });
          poseDetector.onResults((results: any) => {
            if (!active) return;
            const now = performance.now();
            const lms = results?.poseLandmarks || null;
            const info = analyzeFullBodyLandmarks(lms, baselineRef.current, now);

            const canvas = canvasRef.current;
            if (canvas) {
              const cw = canvas.clientWidth || 320;
              const ch = canvas.clientHeight || 240;
              if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
              }
              const ctx = canvas.getContext('2d');
              if (ctx) {
                drawFullBodySkeletonOverlay(ctx, cw, ch, lms, info, true);
              }
            }

            if (now - lastUpdateUi > 80) {
              lastUpdateUi = now;
              setTelemetry(info);
              onCalibratedChangeRef.current?.(info.coveragePct >= 75 || info.isCalibrated, info);
            }
          });

          let busy = false;
          const processFrame = async () => {
            if (!active) return;
            const v = videoRef.current;
            if (v && v.readyState >= 2 && !busy && poseDetector) {
              busy = true;
              try {
                await poseDetector.send({ image: v });
              } catch {
                // ignore frame drop
              }
              busy = false;
            }
            if (active) rafId = requestAnimationFrame(processFrame);
          };
          rafId = requestAnimationFrame(processFrame);
        }
      } catch (err: any) {
        if (!active) return;
        setCameraError('Camera access needed for Full-Body Head-to-Feet tracking (Keyboard/Touch controls also enabled).');
      }
    };

    startScanner();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (poseDetector && poseDetector.close) {
        try {
          poseDetector.close();
        } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleManualCalibrate = () => {
    baselineRef.current.calibrated = true;
    baselineRef.current.shoulderY = null;
    const updated: BodyDetectionTelemetry = {
      ...telemetry,
      coveragePct: 100,
      isCalibrated: true,
      legsFeetDetected: true,
      statusLabel: '✅ HEAD-TO-FEET CALIBRATED!',
    };
    setTelemetry(updated);
    onCalibratedChangeRef.current?.(true, updated);
  };

  return (
    <div className="bg-slate-950/85 border-2 border-cyan-400/50 rounded-3xl p-4 sm:p-5 text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-slate-950 flex items-center justify-center font-black text-lg shadow-md">
            🧍
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm sm:text-base text-white tracking-wide">
                FULL-BODY DETECTION (HEAD TO FEET)
              </h4>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  telemetry.coveragePct >= 75 || telemetry.isCalibrated
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-amber-400 text-slate-950'
                }`}
              >
                {telemetry.coveragePct}% LOCKED
              </span>
            </div>
            <p className="text-[11px] text-cyan-200/85 font-semibold">
              Stand back so your Head, Arms, Torso, Legs &amp; Feet fit inside the scanner frame!
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleManualCalibrate}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <CheckCircle2 size={14} />
          <span>{telemetry.isCalibrated ? 'Re-Calibrate Stance' : 'Lock / Calibrate Body Now'}</span>
        </button>
      </div>

      <div className={`grid grid-cols-1 ${compact ? 'md:grid-cols-12' : 'lg:grid-cols-12'} gap-4 items-stretch`}>
        {/* Live Mirrored Full-Body Camera Feed + 33-Point Skeleton Overlay */}
        <div className="md:col-span-6 lg:col-span-5 relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-400/60 min-h-[210px] sm:min-h-[240px] flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
          />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

          {/* Top Status Pill */}
          <div className="absolute top-2 inset-x-2 z-20 flex items-center justify-between gap-1 pointer-events-none">
            <span className="px-2.5 py-0.5 rounded-md bg-slate-950/85 border border-cyan-400/40 text-[10px] font-black text-cyan-300 uppercase tracking-wider">
              HEAD ↑
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-950/90 border border-amber-400/50 text-[10px] font-black text-amber-300 truncate">
              {telemetry.statusLabel}
            </span>
          </div>

          {/* Bottom Feet Marker */}
          <div className="absolute bottom-2 inset-x-2 z-20 flex items-center justify-between pointer-events-none">
            <span className="px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-black text-emerald-300">
              ⬅️ LEFT
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-slate-950/85 border border-emerald-400/40 text-[10px] font-black text-emerald-300 uppercase tracking-wider">
              FEET ↓
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-950/80 text-[10px] font-black text-rose-300">
              RIGHT ➡️
            </span>
          </div>

          {!cameraReady && cameraError && (
            <div className="relative z-30 p-4 text-center text-xs font-bold text-amber-200 bg-slate-950/90">
              {cameraError}
            </div>
          )}
        </div>

        {/* Right Side: 4 Anatomical Head-to-Feet Checklists & Live Action Tester */}
        <div className="md:col-span-6 lg:col-span-7 flex flex-col justify-between gap-3">
          {/* 4 Body Zones Checklist */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '1. HEAD', sub: 'Nose & Eyes', ok: telemetry.headDetected, icon: '🗣️' },
              { label: '2. ARMS / HANDS', sub: 'Punch & Reach', ok: telemetry.torsoArmsDetected, icon: '🥊' },
              { label: '3. CORE / HIPS', sub: 'Dodge Left/Right', ok: telemetry.hipsDetected, icon: '🕺' },
              { label: '4. LEGS & FEET', sub: 'Jump & Wall Kick', ok: telemetry.legsFeetDetected, icon: '🦵' },
            ].map((z) => (
              <div
                key={z.label}
                className={`p-2.5 rounded-2xl border flex flex-col items-center text-center transition-all ${
                  z.ok
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                    : 'bg-white/5 border-white/15 text-white/60'
                }`}
              >
                <span className="text-xl mb-0.5">{z.icon}</span>
                <span className="text-[11px] font-black tracking-wide">{z.label}</span>
                <span className="text-[9px] opacity-80">{z.sub}</span>
                <span
                  className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-black ${
                    z.ok ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-white/70'
                  }`}
                >
                  {z.ok ? 'DETECTED ✓' : 'SCANNING...'}
                </span>
              </div>
            ))}
          </div>

          {/* Coverage Progress Bar */}
          <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
            <div className="flex justify-between items-center text-xs font-black mb-1.5">
              <span className="text-cyan-300">Head-to-Feet Body Visibility</span>
              <span className="text-emerald-300">{telemetry.coveragePct}%</span>
            </div>
            <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 transition-all duration-150"
                style={{ width: `${Math.max(8, telemetry.coveragePct)}%` }}
              />
            </div>
          </div>

          {/* Live Move Tester Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-center">
            <div
              className={`p-2 rounded-xl border text-[10px] font-black ${
                telemetry.lane !== 0
                  ? 'bg-sky-500 text-slate-950 border-white scale-105'
                  : 'bg-white/5 border-white/15 text-white/80'
              }`}
            >
              ⬅️➡️ DODGE
              <div className="text-[9px] opacity-80 mt-0.5">
                {telemetry.lane < 0 ? 'LEFT' : telemetry.lane > 0 ? 'RIGHT' : 'CENTER'}
              </div>
            </div>
            <div
              className={`p-2 rounded-xl border text-[10px] font-black ${
                telemetry.isJumping
                  ? 'bg-amber-400 text-slate-950 border-white scale-105'
                  : 'bg-white/5 border-white/15 text-white/80'
              }`}
            >
              ⬆️ JUMP
              <div className="text-[9px] opacity-80 mt-0.5">{telemetry.isJumping ? 'ACTIVE!' : 'Jump Up'}</div>
            </div>
            <div
              className={`p-2 rounded-xl border text-[10px] font-black ${
                telemetry.activePose
                  ? 'bg-yellow-400 text-slate-950 border-white scale-105'
                  : 'bg-white/5 border-white/15 text-white/80'
              }`}
            >
              🧘 POSE WALL
              <div className="text-[9px] opacity-80 mt-0.5">{telemetry.activePose || 'Strike Pose'}</div>
            </div>
            <div
              className={`p-2 rounded-xl border text-[10px] font-black ${
                telemetry.isPunching
                  ? 'bg-rose-500 text-white border-white scale-105'
                  : 'bg-white/5 border-white/15 text-white/80'
              }`}
            >
              🥊 PUNCH
              <div className="text-[9px] opacity-80 mt-0.5">{telemetry.isPunching ? 'POW!' : 'Throw Fist'}</div>
            </div>
            <div
              className={`p-2 rounded-xl border text-[10px] font-black ${
                telemetry.isWallKicking
                  ? 'bg-fuchsia-500 text-white border-white scale-105'
                  : 'bg-white/5 border-white/15 text-white/80'
              }`}
            >
              🦵 WALL KICK
              <div className="text-[9px] opacity-80 mt-0.5">{telemetry.isWallKicking ? 'KICK!' : 'Lift Knee/Leg'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/********************************************************************
 * 3D ZOOTOPIA CITY POSE CHASE & PARKOUR ACTION ENGINE
 * - Yellow Pose Wall: Jump & Follow the Pose of the Correct Option
 * - Punch Enemy: Punch the Bandit holding the Correct Option (PUNCH!)
 * - Wall Kick: Wall Kick the Correct Option Target / Chief Roadblock
 * - Obstacle Avoidance: Dodge Left / Right or Jump over STOP Barriers
 ********************************************************************/
type ChallengeKind = 'pose-wall' | 'punch-enemy' | 'wall-kick' | 'obstacle';

interface StreetCheckpoint {
  id: number;
  z: number; // Negative Z along the street
  kind: ChallengeKind;
  questionIndex?: number;
  questionText?: string;
  questionImage?: string;
  leftOption?: string;
  rightOption?: string;
  correctSide: -1 | 1; // -1 = Left, 1 = Right (or safe lane for obstacle)
  brokenLanes?: Array<-1 | 0 | 1>; // For obstacles: which lanes have STOP barriers / police cars
  requireJumpObstacle?: boolean;
  leftPose?: FullBodyPoseSpec;
  rightPose?: FullBodyPoseSpec;
  resolved: boolean;
  promptTriggered: boolean;
  group: THREE.Group;
  leftTargetGroup?: THREE.Group;
  rightTargetGroup?: THREE.Group;
  poseWallMesh?: THREE.Mesh;
}

export function CityPoseChase3DGameplay({
  questions,
  riderName,
  speedMultiplier,
  onChangeSpeedMultiplier,
  timerMinutes,
  initialLives,
  voiceEnabled,
  onChangeVoiceEnabled,
  onExitToSetup,
}: {
  questions: ChaseQuestion[];
  riderName: string;
  speedMultiplier: number;
  onChangeSpeedMultiplier: (v: number) => void;
  timerMinutes: number;
  initialLives: number;
  voiceEnabled: boolean;
  onChangeVoiceEnabled: (v: boolean) => void;
  onExitToSetup: () => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const skelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [score, setScore] = useState(0);
  const [distanceLeftM, setDistanceLeftM] = useState(500);
  const [progressPct, setProgressPct] = useState(0);
  const [livesLeft, setLivesLeft] = useState(initialLives);
  const [remainingSeconds, setRemainingSeconds] = useState(timerMinutes * 60);
  const [streak, setStreak] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [telemetry, setTelemetry] = useState<BodyDetectionTelemetry>({
    headDetected: true,
    torsoArmsDetected: true,
    hipsDetected: true,
    legsFeetDetected: true,
    coveragePct: 100,
    isCalibrated: true,
    lane: 0,
    normalizedX: 0.5,
    isJumping: false,
    isPunching: false,
    punchSide: 0,
    isWallKicking: false,
    kickSide: 0,
    activePose: null,
    statusLabel: 'READY TO RUN!',
  });

  const [activeEncounter, setActiveEncounter] = useState<{
    kind: ChallengeKind;
    questionNumber: number;
    totalQuestions: number;
    questionText: string;
    questionImage?: string;
    leftOption: string;
    rightOption: string;
    correctSide: -1 | 1;
    leftPose?: FullBodyPoseSpec;
    rightPose?: FullBodyPoseSpec;
    safeLane?: -1 | 0 | 1;
    requireJump?: boolean;
  } | null>(null);

  const [actionBanner, setActionBanner] = useState<{
    text: string;
    sub?: string;
    color: string;
  } | null>(null);

  const [victoryModal, setVictoryModal] = useState<{
    score: number;
    maxStreak: number;
    livesLeft: number;
    questionsCleared: number;
    totalQuestions: number;
  } | null>(null);

  const [gameOverModal, setGameOverModal] = useState<{
    reason: string;
    score: number;
    questionsCleared: number;
    totalQuestions: number;
  } | null>(null);

  const telemetryRef = useRef<BodyDetectionTelemetry>(telemetry);
  const manualLaneRef = useRef<-1 | 0 | 1 | null>(null);
  const manualActionRef = useRef<{
    type: 'jump-pose' | 'punch' | 'wall-kick' | null;
    side?: -1 | 1;
    poseId?: FullBodyPoseId;
    until: number;
  }>({ type: null, until: 0 });

  const speedMultRef = useRef(speedMultiplier);
  speedMultRef.current = speedMultiplier;
  const voiceEnabledRef = useRef(voiceEnabled);
  voiceEnabledRef.current = voiceEnabled;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const pausedRef = useRef(false);
  pausedRef.current = showSettingsModal || Boolean(victoryModal) || Boolean(gameOverModal);

  const showBanner = useCallback((text: string, color = 'from-amber-400 to-orange-500', sub?: string) => {
    setActionBanner({ text, color, sub });
    setTimeout(() => {
      setActionBanner((prev) => (prev?.text === text ? null : prev));
    }, 1350);
  }, []);

  // Simple Web Audio SFX
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playSfx = useCallback((type: 'punch' | 'kick' | 'pose' | 'dodge' | 'hit' | 'win') => {
    if (isMutedRef.current) return;
    try {
      const AudioC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioC) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioC();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const tone = (freq: number, oscType: OscillatorType, dur: number, gainVal: number, slideTo?: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = oscType;
        osc.frequency.setValueAtTime(freq, now);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(25, slideTo), now + dur);
        g.gain.setValueAtTime(gainVal, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur);
      };

      if (type === 'punch') {
        tone(190, 'sawtooth', 0.16, 0.28, 55);
        setTimeout(() => tone(520, 'triangle', 0.18, 0.22, 880), 60);
      } else if (type === 'kick') {
        tone(260, 'square', 0.14, 0.24, 90);
        setTimeout(() => tone(660, 'sine', 0.22, 0.25, 1120), 50);
      } else if (type === 'pose') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          setTimeout(() => tone(f, 'triangle', 0.16, 0.22), i * 55);
        });
      } else if (type === 'dodge') {
        tone(420, 'sine', 0.1, 0.15, 640);
      } else if (type === 'hit') {
        tone(160, 'sawtooth', 0.35, 0.28, 48);
      } else if (type === 'win') {
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
          setTimeout(() => tone(f, 'triangle', 0.22, 0.24), i * 75);
        });
      }
    } catch {}
  }, []);

  const speakPrompt = useCallback((text: string) => {
    if (!voiceEnabledRef.current || isMutedRef.current || typeof window === 'undefined' || !('speechSynthesis' in window))
      return;
    try {
      window.speechSynthesis.cancel();
      const clean = parseOptionContent(text).text;
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.04;
      u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    } catch {}
  }, []);

  // Countdown Timer
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setGameOverModal({
            reason: 'Time ran out during the Zootopia City Chase!',
            score,
            questionsCleared: 0,
            totalQuestions: questions.length,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [questions.length, score]);

  // Full-Body MediaPipe Pose Camera Loop
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let rafId = 0;
    let poseDetector: any = null;
    let lastUiUpdate = 0;

    const baseline = {
      shoulderY: null as number | null,
      hipY: null as number | null,
      ankleY: null as number | null,
      prevLeftWrist: null as { x: number; y: number; z: number; t: number } | null,
      prevRightWrist: null as { x: number; y: number; z: number; t: number } | null,
      calibrated: true,
    };

    const startCam = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const PoseClass = await ensureMediaPipePoseLoaded();
        if (!active || !PoseClass) return;

        poseDetector = new PoseClass({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        poseDetector.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          minDetectionConfidence: 0.35,
          minTrackingConfidence: 0.35,
        });

        poseDetector.onResults((results: any) => {
          if (!active) return;
          const now = performance.now();
          const lms = results?.poseLandmarks || null;
          const info = analyzeFullBodyLandmarks(lms, baseline, now);
          telemetryRef.current = info;

          const canvas = skelCanvasRef.current;
          if (canvas) {
            const cw = canvas.clientWidth || 220;
            const ch = canvas.clientHeight || 165;
            if (canvas.width !== cw || canvas.height !== ch) {
              canvas.width = cw;
              canvas.height = ch;
            }
            const ctx = canvas.getContext('2d');
            if (ctx) {
              drawFullBodySkeletonOverlay(ctx, cw, ch, lms, info, false);
            }
          }

          if (now - lastUiUpdate > 90) {
            lastUiUpdate = now;
            setTelemetry(info);
          }
        });

        let busy = false;
        const loop = async () => {
          if (!active) return;
          const v = videoRef.current;
          if (v && v.readyState >= 2 && !busy && poseDetector) {
            busy = true;
            try {
              await poseDetector.send({ image: v });
            } catch {}
            busy = false;
          }
          if (active) rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch {
        // Fallback to keyboard/buttons if webcam unavailable
      }
    };

    startCam();

    return () => {
      active = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (poseDetector && poseDetector.close) {
        try {
          poseDetector.close();
        } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Trigger manual or keyboard actions
  const triggerPlayerAction = useCallback(
    (
      actionType: 'jump-pose' | 'punch' | 'wall-kick',
      side?: -1 | 1,
      poseId?: FullBodyPoseId
    ) => {
      if (side) {
        manualLaneRef.current = side;
      }
      manualActionRef.current = {
        type: actionType,
        side,
        poseId,
        until: performance.now() + 900,
      };
      if (actionType === 'punch') playSfx('punch');
      else if (actionType === 'wall-kick') playSfx('kick');
      else playSfx('dodge');
    },
    [playSfx]
  );

  // Keyboard shortcuts for testing & hybrid play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        manualLaneRef.current = Math.max(-1, (manualLaneRef.current ?? telemetryRef.current.lane) - 1) as -1 | 0 | 1;
        playSfx('dodge');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        manualLaneRef.current = Math.min(1, (manualLaneRef.current ?? telemetryRef.current.lane) + 1) as -1 | 0 | 1;
        playSfx('dodge');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        manualLaneRef.current = 0;
      } else if (e.key === ' ') {
        e.preventDefault();
        triggerPlayerAction('jump-pose');
      } else if (e.key === 'j' || e.key === 'J' || e.key === 'Enter') {
        triggerPlayerAction('punch');
      } else if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        triggerPlayerAction('wall-kick');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [playSfx, triggerPlayerAction]);

  // Main Three.js Zootopia City Street Scene & Game Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5cc8ff);
    scene.fog = new THREE.FogExp2(0x7fd4ff, 0.0042);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 420);
    camera.position.set(0, 2.5, 6);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // Studio & Sunny City Lighting
    const hemiLight = new THREE.HemisphereLight(0xbbeeff, 0xfde68a, 1.15);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
    sunLight.position.set(35, 65, 40);
    sunLight.castShadow = !isSoftwareGl;
    scene.add(sunLight);

    // Helper: Create crisp 2D Canvas Sign Texture
    const makeSignTexture = (
      drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
      w = 512,
      h = 256
    ) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d')!;
      drawFn(ctx, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    // Build Checkpoints (Interleaving Question Encounters & Street Obstacles)
    const checkpoints: StreetCheckpoint[] = [];
    const spacingZ = 44;
    let currentZ = -48;

    const actionTypes: Array<'pose-wall' | 'punch-enemy' | 'wall-kick'> = [
      'pose-wall',
      'punch-enemy',
      'wall-kick',
    ];

    questions.forEach((q, qIdx) => {
      // 1. Create Question Action Checkpoint (cycles Pose Wall -> Punch Enemy -> Wall Kick)
      const kind = actionTypes[qIdx % actionTypes.length];
      const swap = Math.random() > 0.5;
      const rawOpt0 = q.options[0] || 'Option A';
      const rawOpt1 = q.options[1] || 'Option B';
      const leftOpt = swap ? rawOpt1 : rawOpt0;
      const rightOpt = swap ? rawOpt0 : rawOpt1;
      const correctSide: -1 | 1 =
        (q.answerIndex === 0 && !swap) || (q.answerIndex === 1 && swap) ? -1 : 1;

      const poseA = FULL_BODY_POSES[(qIdx * 2) % FULL_BODY_POSES.length];
      const poseB = FULL_BODY_POSES[(qIdx * 2 + 1) % FULL_BODY_POSES.length];

      const cpGroup = new THREE.Group();
      cpGroup.position.set(0, 0, currentZ);
      scene.add(cpGroup);

      let leftTargetGroup: THREE.Group | undefined;
      let rightTargetGroup: THREE.Group | undefined;
      let poseWallMesh: THREE.Mesh | undefined;

      if (kind === 'pose-wall') {
        // Giant Bright Yellow Pose Wall across the street (like image_97450044.png!)
        const wallTex = makeSignTexture((ctx, w, h) => {
          ctx.fillStyle = '#facc15';
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 12;
          ctx.strokeRect(6, 6, w - 12, h - 12);

          // Draw Left & Right Pose Silhouettes + Option Labels
          const drawPoseSilhouette = (cx: number, pose: FullBodyPoseSpec, optStr: string, sideLabel: string) => {
            const parsed = parseOptionContent(optStr);
            ctx.fillStyle = '#0f172a';
            ctx.font = '900 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${sideLabel}: ${pose.emoji} ${pose.name.toUpperCase()}`, cx, 38);

            // Stick-figure silhouette cutout like image_97450044.png
            ctx.save();
            ctx.translate(cx, 128);
            ctx.strokeStyle = '#1e293b';
            ctx.fillStyle = '#1e293b';
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Head
            ctx.beginPath();
            ctx.arc(0, -42, 16, 0, Math.PI * 2);
            ctx.fill();

            // Torso
            ctx.beginPath();
            ctx.moveTo(0, -24);
            ctx.lineTo(0, 18);
            ctx.stroke();

            if (pose.id === 'dancer') {
              // Dancer pose silhouette (exact match to image_97450044.png!)
              ctx.beginPath();
              ctx.moveTo(0, -14);
              ctx.lineTo(-42, -16);
              ctx.moveTo(0, -14);
              ctx.lineTo(28, -28);
              ctx.lineTo(36, 4);
              ctx.moveTo(0, 18);
              ctx.lineTo(0, 58);
              ctx.moveTo(0, 18);
              ctx.lineTo(36, 4);
              ctx.stroke();
            } else if (pose.id === 'star-jump') {
              ctx.beginPath();
              ctx.moveTo(0, -12);
              ctx.lineTo(-40, -34);
              ctx.moveTo(0, -12);
              ctx.lineTo(40, -34);
              ctx.moveTo(0, 18);
              ctx.lineTo(-30, 56);
              ctx.moveTo(0, 18);
              ctx.lineTo(30, 56);
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.moveTo(0, -14);
              ctx.lineTo(-34, -36);
              ctx.moveTo(0, -14);
              ctx.lineTo(34, -36);
              ctx.moveTo(0, 18);
              ctx.lineTo(-18, 56);
              ctx.moveTo(0, 18);
              ctx.lineTo(26, 26);
              ctx.stroke();
            }
            ctx.restore();

            // Option Banner Pill
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(cx - 110, h - 54, 220, 40);
            ctx.fillStyle = '#ffffff';
            ctx.font = '900 24px sans-serif';
            ctx.fillText((parsed.text || 'Answer').slice(0, 18), cx, h - 26);
          };

          drawPoseSilhouette(w * 0.27, poseA, leftOpt, 'LEFT');
          drawPoseSilhouette(w * 0.73, poseB, rightOpt, 'RIGHT');

          // Center divider
          ctx.strokeStyle = 'rgba(15,23,42,0.25)';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(w * 0.5, 20);
          ctx.lineTo(w * 0.5, h - 20);
          ctx.stroke();
        }, 1024, 512);

        const wallMat = new THREE.MeshStandardMaterial({
          map: wallTex,
          roughness: 0.35,
          metalness: 0.05,
        });
        poseWallMesh = new THREE.Mesh(new THREE.BoxGeometry(11.2, 5.4, 0.45), wallMat);
        poseWallMesh.position.set(0, 2.7, 0);
        poseWallMesh.castShadow = true;
        cpGroup.add(poseWallMesh);
      } else if (kind === 'punch-enemy') {
        // Two 3D Street Bandit Enemies with Orange Duffle Bags & Cyan "PUNCH!" Badge (matching image_1ef7ac84.png!)
        const buildBanditEnemy = (sideX: number, optStr: string, isLeft: boolean) => {
          const g = new THREE.Group();
          g.position.set(sideX, 0, 0);

          // Legs / Dark Shorts
          const shortsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
          const furMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.55 });
          const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
          const bagMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 });

          const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.3, 12), shortsMat);
          leftLeg.position.set(-0.32, 0.65, 0);
          const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 1.3, 12), shortsMat);
          rightLeg.position.set(0.32, 0.65, 0);
          g.add(leftLeg, rightLeg);

          // Slender Weasel Torso + White Shirt
          const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.42, 1.85, 14), shirtMat);
          torso.position.set(0, 2.1, 0);
          g.add(torso);

          // Orange Duffle Bag held in front (exact match to image_1ef7ac84.png!)
          const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.25, 16), bagMat);
          bag.rotation.z = Math.PI * 0.5;
          bag.position.set(0, 2.25, 0.52);
          g.add(bag);

          // Head + Big Cartoon Eyes + Snout
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), furMat);
          head.position.set(0, 3.45, 0.1);
          g.add(head);

          const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
          const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
          [-0.2, 0.2].forEach((ex) => {
            const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), eyeWhiteMat);
            eye.position.set(ex, 3.55, 0.55);
            const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), pupilMat);
            pupil.position.set(ex, 3.55, 0.68);
            g.add(eye, pupil);
          });

          // Floating Cyan "PUNCH!" Badge + Option Text above Enemy
          const badgeTex = makeSignTexture((ctx, w, h) => {
            const parsed = parseOptionContent(optStr);
            // Glowing Cyan Circle
            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.beginPath();
            ctx.arc(w * 0.5, 95, 76, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();

            ctx.font = '900 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🥊', w * 0.5, 112);

            ctx.fillStyle = '#38bdf8';
            ctx.strokeStyle = '#0f172a';
            ctx.lineWidth = 8;
            ctx.font = '900 40px sans-serif';
            ctx.strokeText('PUNCH!', w * 0.5, 200);
            ctx.fillText('PUNCH!', w * 0.5, 200);

            // Option Answer Plate
            ctx.fillStyle = isLeft ? '#2563eb' : '#e11d48';
            ctx.fillRect(24, 218, w - 48, 76);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.strokeRect(24, 218, w - 48, 76);

            ctx.fillStyle = '#ffffff';
            ctx.font = '900 34px sans-serif';
            ctx.fillText((parsed.text || 'Option').slice(0, 18), w * 0.5, 268);
          }, 512, 310);

          const signPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(3.8, 2.3),
            new THREE.MeshBasicMaterial({ map: badgeTex, transparent: true })
          );
          signPlane.position.set(0, 5.1, 0.2);
          g.add(signPlane);

          cpGroup.add(g);
          return g;
        };

        leftTargetGroup = buildBanditEnemy(-2.7, leftOpt, true);
        rightTargetGroup = buildBanditEnemy(2.7, rightOpt, false);
      } else {
        // Wall Kick Encounter: Left & Right Parkour Kick Boards + Chief Bull Cruiser in Center
        const buildKickBoard = (sideX: number, optStr: string, isLeft: boolean) => {
          const g = new THREE.Group();
          g.position.set(sideX, 0, 0);

          const boardTex = makeSignTexture((ctx, w, h) => {
            const parsed = parseOptionContent(optStr);
            ctx.fillStyle = isLeft ? '#0284c7' : '#d97706';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 14;
            ctx.strokeRect(7, 7, w - 14, h - 14);

            ctx.fillStyle = '#fde047';
            ctx.font = '900 38px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('🦵 WALL KICK!', w * 0.5, 68);

            ctx.fillStyle = '#ffffff';
            ctx.font = '900 44px sans-serif';
            ctx.fillText((parsed.text || 'Option').slice(0, 16), w * 0.5, 165);
          }, 512, 256);

          const board = new THREE.Mesh(
            new THREE.BoxGeometry(3.8, 3.2, 0.45),
            new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.3 })
          );
          board.position.set(0, 2.6, 0);
          g.add(board);

          cpGroup.add(g);
          return g;
        };

        leftTargetGroup = buildKickBoard(-3.3, leftOpt, true);
        rightTargetGroup = buildKickBoard(3.3, rightOpt, false);
      }

      checkpoints.push({
        id: qIdx * 10 + 1,
        z: currentZ,
        kind,
        questionIndex: qIdx,
        questionText: q.text,
        questionImage: q.image,
        leftOption: leftOpt,
        rightOption: rightOpt,
        correctSide,
        leftPose: poseA,
        rightPose: poseB,
        resolved: false,
        promptTriggered: false,
        group: cpGroup,
        leftTargetGroup,
        rightTargetGroup,
        poseWallMesh,
      });

      currentZ -= spacingZ;

      // 2. Interleave Non-Question Street Obstacles (STOP Road Barriers & Chief Bull Police Blockade)
      // Easy = 1 obstacle every 2 questions, Medium = 1 after every question, Hard = 2 after every question
      const obsCount = speedMultiplier < 0.85 ? (qIdx % 2 === 0 ? 1 : 0) : speedMultiplier > 1.2 ? 2 : 1;
      for (let o = 0; o < obsCount; o++) {
        const obsGroup = new THREE.Group();
        obsGroup.position.set(0, 0, currentZ);
        scene.add(obsGroup);

        const safeSide: -1 | 1 = Math.random() > 0.5 ? -1 : 1;
        const blockedLanes: Array<-1 | 0 | 1> = safeSide === -1 ? [0, 1] : [-1, 0];

        // Build Yellow-and-Black Striped Road Barriers with Octagonal Red STOP Signs (matching image_cdbbbbe4.png!)
        const stopTex = makeSignTexture((ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          // Red Octagon
          const cx = w * 0.5;
          const cy = h * 0.5;
          const r = w * 0.44;
          ctx.fillStyle = '#dc2626';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 14;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const ang = (i * Math.PI) / 4 + Math.PI / 8;
            const px = cx + Math.cos(ang) * r;
            const py = cy + Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = '900 72px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('STOP', cx, cy + 4);
        }, 256, 256);

        const yellowPostMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
        const darkStripeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

        blockedLanes.forEach((laneVal) => {
          const bx = laneVal * 3.4;
          const barrier = new THREE.Group();
          barrier.position.set(bx, 0, 0);

          const postL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.9, 0.28), yellowPostMat);
          postL.position.set(-1.35, 0.95, 0);
          const postR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.9, 0.28), yellowPostMat);
          postR.position.set(1.35, 0.95, 0);

          const railTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.26, 0.2), yellowPostMat);
          railTop.position.set(0, 1.45, 0);
          const railMid = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.22, 0.22), darkStripeMat);
          railMid.position.set(0, 0.95, 0);

          const stopSign = new THREE.Mesh(
            new THREE.PlaneGeometry(1.35, 1.35),
            new THREE.MeshBasicMaterial({ map: stopTex, transparent: true })
          );
          stopSign.position.set(0, 1.25, 0.16);

          barrier.add(postL, postR, railTop, railMid, stopSign);
          obsGroup.add(barrier);
        });

        checkpoints.push({
          id: qIdx * 10 + 2 + o,
          z: currentZ,
          kind: 'obstacle',
          correctSide: safeSide,
          brokenLanes: blockedLanes,
          resolved: false,
          promptTriggered: false,
          group: obsGroup,
        });

        currentZ -= spacingZ * 0.72;
      }
    });

    const totalRunLengthZ = Math.abs(currentZ) + 30;

    // Build the Zootopia City Avenue, Sidewalks, Buildings, Giraffe Bus, Streetlamps & Distant Skyline!
    const roadLen = totalRunLengthZ + 220;
    const roadGeo = new THREE.PlaneGeometry(12.5, roadLen);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -roadLen * 0.45);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // Sidewalks Left & Right
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75 });
    [-11.2, 11.2].forEach((sx) => {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(10, 0.35, roadLen), sidewalkMat);
      sw.position.set(sx, 0.175, -roadLen * 0.45);
      sw.receiveShadow = true;
      scene.add(sw);
    });

    // Dashed Lane Lines
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let z = 10; z > -roadLen * 0.9; z -= 7) {
      [-1.85, 1.85].forEach((lx) => {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 3.2), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(lx, 0.02, z);
        scene.add(dash);
      });
    }

    // Colorful Zootopia Buildings, Palm Trees, Green Streetlamps & Giraffe Bus along the street
    const buildingPalette = [0xf4a261, 0xe76f51, 0xf9a8d4, 0x6ee7b7, 0x93c5fd, 0xfde047, 0xc4b5fd];
    const windowMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.5 });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.3 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    for (let z = 0; z > -roadLen * 0.88; z -= 22) {
      // Left & Right Colorful Cartoon Buildings
      [-15.5, 15.5].forEach((bx, sideIdx) => {
        const bHeight = 14 + ((Math.abs(z * 7 + sideIdx * 13) % 18));
        const bWidth = 7.5;
        const bDepth = 14;
        const color = buildingPalette[Math.abs(Math.floor(z / 22) + sideIdx * 3) % buildingPalette.length];
        const bGroup = new THREE.Group();
        bGroup.position.set(bx, 0, z);

        const body = new THREE.Mesh(
          new THREE.BoxGeometry(bWidth, bHeight, bDepth),
          new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
        );
        body.position.y = bHeight * 0.5;
        bGroup.add(body);

        // Roof cornice
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(bWidth + 0.6, 0.9, bDepth + 0.6),
          new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
        );
        roof.position.y = bHeight + 0.45;
        bGroup.add(roof);

        // Windows facing the street
        const winX = sideIdx === 0 ? bWidth * 0.5 + 0.05 : -bWidth * 0.5 - 0.05;
        for (let wy = 3.5; wy < bHeight - 2; wy += 3.5) {
          for (let wz = -3.5; wz <= 3.5; wz += 3.5) {
            const wMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 1.5), windowMat);
            wMesh.position.set(winX, wy, wz);
            bGroup.add(wMesh);
          }
        }
        scene.add(bGroup);
      });

      // Green Ornate Streetlamps (like image_cdbbbbe4.png & image_97450044.png)
      [-6.8, 6.8].forEach((lx) => {
        const lamp = new THREE.Group();
        lamp.position.set(lx, 0.35, z + 6);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 6.2, 10), poleMat);
        pole.position.y = 3.1;
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.12), poleMat);
        arm.position.set(0, 6.1, 0);
        const globeL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bulbMat);
        globeL.position.set(-0.65, 5.85, 0);
        const globeR = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), bulbMat);
        globeR.position.set(0.65, 5.85, 0);
        lamp.add(pole, arm, globeL, globeR);
        scene.add(lamp);
      });
    }

    // Distant Zootopia Downtown Skyscraper Horizon (follows player Z so skyline is always majestic ahead!)
    const skylineGroup = new THREE.Group();
    const skyColors = [0x38bdf8, 0xf472b6, 0x818cf8, 0x34d399, 0xfbbf24];
    for (let i = -9; i <= 9; i++) {
      const th = 45 + (Math.abs(i * 17) % 65);
      const tw = 9 + (Math.abs(i * 7) % 6);
      const tower = new THREE.Mesh(
        new THREE.BoxGeometry(tw, th, 12),
        new THREE.MeshStandardMaterial({
          color: skyColors[Math.abs(i) % skyColors.length],
          roughness: 0.4,
          metalness: 0.2,
        })
      );
      tower.position.set(i * 11, th * 0.5 - 2, 0);
      skylineGroup.add(tower);
    }
    scene.add(skylineGroup);

    // First-Person Player Cartoon Fists (attached to camera like image_1ef7ac84.png!)
    const handsRig = new THREE.Group();
    const fistMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.1 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 });

    const buildFist = (isLeft: boolean) => {
      const fg = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), fistMat);
      palm.scale.set(1.0, 0.88, 1.25);
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), fistMat);
      thumb.position.set(isLeft ? 0.22 : -0.22, 0.04, 0.08);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.25, 14), cuffMat);
      cuff.rotation.x = Math.PI * 0.35;
      cuff.position.set(0, -0.18, -0.25);
      fg.add(palm, thumb, cuff);
      return fg;
    };

    const leftFist = buildFist(true);
    leftFist.position.set(-0.68, -0.58, -1.15);
    const rightFist = buildFist(false);
    rightFist.position.set(0.68, -0.58, -1.15);
    handsRig.add(leftFist, rightFist);
    camera.add(handsRig);
    scene.add(camera);

    // Animation & Physics State
    const clock = new THREE.Clock();
    let frameId = 0;
    let playerZ = 6;
    let playerX = 0;
    let playerY = 2.55;
    let jumpVelY = 0;
    let jumpOffsetY = 0;
    let cameraRoll = 0;
    let punchAnimProgress = 0;
    let kickAnimProgress = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let totalScore = 0;
    let currentLives = initialLives;
    let questionsCleared = 0;
    let gameEnded = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      const dt = Math.min(0.05, clock.getDelta());
      const nowMs = performance.now();

      if (!pausedRef.current && !gameEnded) {
        const liveTel = telemetryRef.current;
        const manualAct = manualActionRef.current.until > nowMs ? manualActionRef.current : null;

        // Effective Lane (-1 = Left, 0 = Center, 1 = Right)
        const targetLane: -1 | 0 | 1 =
          manualLaneRef.current !== null ? manualLaneRef.current : liveTel.lane;
        const targetX = targetLane * 3.2;
        playerX = THREE.MathUtils.damp(playerX, targetX, 7.5, dt);

        // Trigger Jump Physics when player jumps on webcam or presses Space
        const wantJump = liveTel.isJumping || manualAct?.type === 'jump-pose';
        if (wantJump && jumpOffsetY <= 0.05) {
          jumpVelY = 9.2;
        }
        if (jumpOffsetY > 0 || jumpVelY > 0) {
          jumpOffsetY += jumpVelY * dt;
          jumpVelY -= 22.0 * dt;
          if (jumpOffsetY <= 0) {
            jumpOffsetY = 0;
            jumpVelY = 0;
          }
        }

        // Trigger Punch / Wall Kick animations on First-Person Hands & Camera
        if (liveTel.isPunching || manualAct?.type === 'punch') {
          punchAnimProgress = 1.0;
        } else {
          punchAnimProgress = Math.max(0, punchAnimProgress - dt * 3.2);
        }

        if (liveTel.isWallKicking || manualAct?.type === 'wall-kick') {
          kickAnimProgress = 1.0;
        } else {
          kickAnimProgress = Math.max(0, kickAnimProgress - dt * 2.8);
        }

        // Advance forward along -Z
        // Slow down slightly when inside a Question Encounter window so player can strike the pose / punch / kick!
        let activeCp: StreetCheckpoint | null = null;
        for (const cp of checkpoints) {
          if (!cp.resolved && cp.z < playerZ + 2 && playerZ - cp.z <= 28) {
            activeCp = cp;
            break;
          }
        }

        const isNearQuestion = activeCp && activeCp.kind !== 'obstacle' && playerZ - activeCp.z < 18;
        const baseSpeed = 14.5 * speedMultRef.current * (isNearQuestion ? 0.52 : 1.0);
        playerZ -= baseSpeed * dt;

        // Update Distance & Progress Bar
        const traveled = Math.max(0, 6 - playerZ);
        const pct = Math.min(100, Math.round((traveled / totalRunLengthZ) * 100));
        const metersLeft = Math.max(0, Math.round((totalRunLengthZ - traveled) * 0.85));
        setProgressPct(pct);
        setDistanceLeftM(metersLeft);

        // Camera Position & Bobbing
        const runBob = jumpOffsetY > 0.05 ? 0 : Math.sin(traveled * 1.4) * 0.11;
        camera.position.set(playerX, playerY + jumpOffsetY + runBob, playerZ);

        const targetRoll =
          kickAnimProgress > 0.1
            ? (targetLane >= 0 ? -0.22 : 0.22) * kickAnimProgress
            : (targetX - playerX) * -0.04;
        cameraRoll = THREE.MathUtils.damp(cameraRoll, targetRoll, 8, dt);
        camera.rotation.set(-0.04, 0, cameraRoll);

        // Animate First-Person Cartoon Fists
        const fistSwing = Math.sin(traveled * 1.4) * 0.08;
        leftFist.position.set(
          -0.62,
          -0.55 + fistSwing + jumpOffsetY * 0.08,
          -1.1 - punchAnimProgress * 0.95
        );
        rightFist.position.set(
          0.62,
          -0.55 - fistSwing + jumpOffsetY * 0.08,
          -1.1 - punchAnimProgress * 1.15
        );

        // Keep Distant Skyline ahead
        skylineGroup.position.z = playerZ - 190;

        // Check Checkpoints
        if (activeCp) {
          if (!activeCp.promptTriggered) {
            activeCp.promptTriggered = true;
            if (activeCp.kind !== 'obstacle') {
              setActiveEncounter({
                kind: activeCp.kind,
                questionNumber: (activeCp.questionIndex ?? 0) + 1,
                totalQuestions: questions.length,
                questionText: activeCp.questionText || '',
                questionImage: activeCp.questionImage,
                leftOption: activeCp.leftOption || 'Option A',
                rightOption: activeCp.rightOption || 'Option B',
                correctSide: activeCp.correctSide,
                leftPose: activeCp.leftPose,
                rightPose: activeCp.rightPose,
              });
              speakPrompt(activeCp.questionText || '');
            } else {
              setActiveEncounter({
                kind: 'obstacle',
                questionNumber: 0,
                totalQuestions: questions.length,
                questionText: 'DODGE THE BARRIER OBSTACLE!',
                leftOption: 'LEFT LANE',
                rightOption: 'RIGHT LANE',
                correctSide: activeCp.correctSide,
                safeLane: activeCp.correctSide,
              });
            }
          }

          const distToGate = playerZ - activeCp.z;

          // Early Action Resolution for Question Gates when player performs the required Pose / Punch / Wall Kick!
          if (activeCp.kind !== 'obstacle' && distToGate < 15.5) {
            const chosenSide: -1 | 1 =
              manualAct?.side ??
              (playerX < -0.5 ? -1 : playerX > 0.5 ? 1 : liveTel.punchSide !== 0 ? (liveTel.punchSide as -1 | 1) : activeCp.correctSide);

            let actionPerformed = false;
            if (activeCp.kind === 'pose-wall') {
              const targetPose = chosenSide === -1 ? activeCp.leftPose?.id : activeCp.rightPose?.id;
              const poseMatched =
                manualAct?.type === 'jump-pose' ||
                (liveTel.activePose !== null && (liveTel.activePose === targetPose || liveTel.isJumping)) ||
                distToGate <= 1.6;
              actionPerformed = poseMatched && distToGate <= 8.5;
            } else if (activeCp.kind === 'punch-enemy') {
              actionPerformed =
                liveTel.isPunching || manualAct?.type === 'punch' || distToGate <= 1.6;
            } else if (activeCp.kind === 'wall-kick') {
              actionPerformed =
                liveTel.isWallKicking ||
                liveTel.isJumping ||
                manualAct?.type === 'wall-kick' ||
                distToGate <= 1.6;
            }

            if (actionPerformed) {
              activeCp.resolved = true;
              manualLaneRef.current = null;
              setActiveEncounter(null);

              const finalSide: -1 | 1 =
                manualAct?.side ?? (playerX < 0 ? -1 : playerX > 0 ? 1 : chosenSide);
              const isCorrect = finalSide === activeCp.correctSide;

              if (isCorrect) {
                currentStreak += 1;
                maxStreak = Math.max(maxStreak, currentStreak);
                questionsCleared += 1;
                totalScore += 100 + currentStreak * 20;
                setScore(totalScore);
                setStreak(currentStreak);

                if (activeCp.kind === 'punch-enemy') {
                  playSfx('punch');
                  const targetGrp = finalSide === -1 ? activeCp.leftTargetGroup : activeCp.rightTargetGroup;
                  if (targetGrp) {
                    targetGrp.position.y += 4.5;
                    targetGrp.rotation.x = -Math.PI * 0.45;
                  }
                  showBanner('🥊 POW! PUNCHED THE CORRECT ENEMY! +100', 'from-cyan-400 to-blue-600');
                } else if (activeCp.kind === 'wall-kick') {
                  playSfx('kick');
                  showBanner('🦵 EPIC WALL KICK! CORRECT! +100', 'from-fuchsia-500 to-purple-600');
                } else {
                  playSfx('pose');
                  if (activeCp.poseWallMesh) activeCp.poseWallMesh.visible = false;
                  showBanner('⭐ POSE & JUMP MATCHED! +100', 'from-amber-400 to-emerald-500');
                }
              } else {
                currentStreak = 0;
                setStreak(0);
                currentLives = Math.max(0, currentLives - 1);
                setLivesLeft(currentLives);
                playSfx('hit');
                showBanner('❌ WRONG OPTION! WATCH OUT!', 'from-rose-500 to-red-700');
                if (currentLives <= 0) {
                  gameEnded = true;
                  setGameOverModal({
                    reason: 'Out of lives! Remember to match the pose, punch, or wall kick the correct answer!',
                    score: totalScore,
                    questionsCleared,
                    totalQuestions: questions.length,
                  });
                }
              }
            }
          } else if (activeCp.kind === 'obstacle' && distToGate <= 1.8) {
            // Evaluate Obstacle Dodge (Left / Right or High Jump)
            activeCp.resolved = true;
            setActiveEncounter(null);

            const playerLaneNow: -1 | 0 | 1 = playerX < -1.5 ? -1 : playerX > 1.5 ? 1 : 0;
            const hitBarrier =
              activeCp.brokenLanes?.includes(playerLaneNow) && jumpOffsetY < 1.35;

            if (!hitBarrier) {
              totalScore += 50;
              setScore(totalScore);
              playSfx('dodge');
              showBanner('⚡ SMOOTH DODGE! +50', 'from-emerald-400 to-teal-500');
            } else {
              currentStreak = 0;
              setStreak(0);
              currentLives = Math.max(0, currentLives - 1);
              setLivesLeft(currentLives);
              playSfx('hit');
              showBanner('💥 HIT STOP BARRIER! DODGE LEFT/RIGHT!', 'from-rose-500 to-red-700');
              if (currentLives <= 0) {
                gameEnded = true;
                setGameOverModal({
                  reason: 'Crashed into the city roadblocks! Dodge Left/Right or Jump to avoid obstacles!',
                  score: totalScore,
                  questionsCleared,
                  totalQuestions: questions.length,
                });
              }
            }
          }
        }

        // Check Finish Line
        if (traveled >= totalRunLengthZ && !gameEnded) {
          gameEnded = true;
          playSfx('win');
          setVictoryModal({
            score: totalScore,
            maxStreak,
            livesLeft: currentLives,
            questionsCleared,
            totalQuestions: questions.length,
          });
        }
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, [initialLives, playSfx, questions, showBanner, speakPrompt]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      id="city-pose-chase-viewport"
      className="relative w-full h-full flex-1 bg-sky-900 overflow-hidden select-none font-['Fredoka',sans-serif]"
    >
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full z-0" />

      {/* TOP PROGRESS BAR & DISTANCE METERS (Matches image_97450044.png & image_1ef7ac84.png) */}
      <div className="absolute top-2 inset-x-4 z-30 flex flex-col gap-1.5 pointer-events-none">
        <div className="w-full max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex-1 h-3.5 bg-slate-900/75 rounded-full overflow-hidden border border-white/25 p-0.5 shadow-lg">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 via-amber-400 to-lime-400 rounded-full transition-all duration-150"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div
            className="text-white font-black text-xl sm:text-2xl tabular-nums drop-shadow-[0_3px_4px_rgba(0,0,0,0.85)]"
            style={{ WebkitTextStroke: '1px #0f172a' }}
          >
            {distanceLeftM}m
          </div>
        </div>

        {/* Top Control & Score Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={onExitToSetup}
              className="px-3.5 py-1.5 rounded-full bg-slate-950/85 hover:bg-slate-900 text-white font-black text-xs border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-lg"
            >
              <ArrowLeft size={14} /> Setup
            </button>
            <div className="px-3.5 py-1.5 rounded-full bg-slate-950/85 border border-white/20 text-white flex items-center gap-3 text-xs font-black shadow-lg">
              <span className="text-amber-300">⭐ {score}</span>
              <span>|</span>
              <span className="text-rose-400">{'❤️'.repeat(Math.max(0, livesLeft))}</span>
              <span>|</span>
              <span className="text-cyan-300 tabular-nums">⏱️ {formatTimer(remainingSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/90 text-slate-950 font-black text-[11px] uppercase tracking-wider shadow">
              🧍 Full-Body Head-to-Feet AI Active
            </span>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shadow-lg"
            >
              <Settings size={14} /> Settings
            </button>
            <FullscreenButton targetId="city-pose-chase-viewport" />
          </div>
        </div>
      </div>

      {/* ACTIVE QUESTION / ACTION PROMPT OVERLAY */}
      {activeEncounter && (
        <div className="absolute top-16 inset-x-0 z-30 flex flex-col items-center px-3 pointer-events-none">
          {activeEncounter.kind === 'obstacle' ? (
            <div className="bg-slate-950/90 border-2 border-red-500 rounded-2xl px-5 py-2.5 text-center shadow-2xl">
              <div className="text-xs font-black uppercase tracking-widest text-red-400">
                🛑 ROADBLOCK OBSTACLE AHEAD!
              </div>
              <div className="text-base sm:text-xl font-black text-white mt-0.5">
                Dodge to the{' '}
                <span className="text-emerald-400 underline">
                  {activeEncounter.safeLane === -1 ? 'LEFT LANE ⬅️' : 'RIGHT LANE ➡️'}
                </span>{' '}
                or <span className="text-amber-300">⬆️ JUMP</span>!
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl bg-slate-950/90 border-2 border-cyan-400/70 rounded-3xl p-3.5 sm:p-4 shadow-2xl pointer-events-auto">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[11px] uppercase tracking-wider">
                  {activeEncounter.kind === 'pose-wall'
                    ? '🧘 YELLOW POSE WALL — JUMP & FOLLOW POSE OF CORRECT OPTION!'
                    : activeEncounter.kind === 'punch-enemy'
                    ? '🥊 ENEMY BANDITS — PUNCH THE CORRECT ENEMY!'
                    : '🦵 PARKOUR WALL — WALL KICK THE CORRECT OPTION!'}
                </span>
                <span className="text-xs font-black text-cyan-300">
                  Q {activeEncounter.questionNumber}/{activeEncounter.totalQuestions}
                </span>
              </div>

              <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white text-center mb-3">
                {parseOptionContent(activeEncounter.questionText).text}
              </h2>

              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    side: -1 as const,
                    label: 'LEFT OPTION',
                    opt: activeEncounter.leftOption,
                    pose: activeEncounter.leftPose,
                    bg: 'from-blue-600/90 to-sky-700/90 border-sky-300',
                  },
                  {
                    side: 1 as const,
                    label: 'RIGHT OPTION',
                    opt: activeEncounter.rightOption,
                    pose: activeEncounter.rightPose,
                    bg: 'from-rose-600/90 to-orange-600/90 border-rose-300',
                  },
                ].map((card) => {
                  const parsed = parseOptionContent(card.opt);
                  return (
                    <button
                      key={card.side}
                      onClick={() => {
                        if (activeEncounter.kind === 'pose-wall') {
                          triggerPlayerAction('jump-pose', card.side, card.pose?.id);
                        } else if (activeEncounter.kind === 'punch-enemy') {
                          triggerPlayerAction('punch', card.side);
                        } else {
                          triggerPlayerAction('wall-kick', card.side);
                        }
                      }}
                      className={`p-3 rounded-2xl bg-gradient-to-br ${card.bg} border-2 text-left text-white flex flex-col justify-between gap-2 hover:scale-[1.02] active:scale-95 transition cursor-pointer shadow-lg`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider">
                        <span>{card.side === -1 ? '⬅️ LEFT' : 'RIGHT ➡️'}</span>
                        {activeEncounter.kind === 'pose-wall' && card.pose && (
                          <span className="px-2 py-0.5 rounded-full bg-yellow-300 text-slate-950 font-black">
                            {card.pose.emoji} {card.pose.name}
                          </span>
                        )}
                        {activeEncounter.kind === 'punch-enemy' && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-300 text-slate-950 font-black">
                            🥊 PUNCH!
                          </span>
                        )}
                        {activeEncounter.kind === 'wall-kick' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-300 text-slate-950 font-black">
                            🦵 WALL KICK!
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {parsed.imageUrl && (
                          <img
                            src={parsed.imageUrl}
                            alt={parsed.text}
                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white object-contain p-1 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="text-base sm:text-xl font-black leading-tight">
                          {parsed.text || 'Option'}
                        </div>
                      </div>

                      {activeEncounter.kind === 'pose-wall' && card.pose && (
                        <div className="text-[11px] font-bold text-yellow-200 bg-black/30 rounded-lg px-2 py-1">
                          Jump &amp; Pose: {card.pose.shortTag}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTION FEEDBACK BANNER */}
      {actionBanner && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <div
            className={`px-6 py-3 rounded-3xl bg-gradient-to-r ${actionBanner.color} text-slate-950 font-black text-xl sm:text-3xl shadow-2xl border-4 border-white text-center`}
          >
            {actionBanner.text}
          </div>
        </div>
      )}

      {/* BOTTOM DOCK: FULL-BODY HEAD-TO-FEET LIVE WEBCAM TRACKER + ON-SCREEN ACTION CONTROLS */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-30 flex items-end gap-2.5 max-w-[96vw]">
        {/* Left Action Controls */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => {
              manualLaneRef.current = -1;
              playSfx('dodge');
            }}
            className="px-3.5 py-2 rounded-2xl bg-slate-950/90 hover:bg-sky-500 hover:text-slate-950 text-white font-black text-xs border-2 border-sky-400 shadow-lg cursor-pointer transition active:scale-95"
          >
            ⬅️ Dodge Left
          </button>
          <button
            onClick={() => triggerPlayerAction('punch', -1)}
            className="px-3.5 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs border-2 border-white shadow-lg cursor-pointer transition active:scale-95"
          >
            🥊 Punch Left
          </button>
        </div>

        {/* Center Live Full-Body Head-to-Feet Camera Box */}
        <div className="relative w-44 h-32 sm:w-52 sm:h-36 rounded-2xl overflow-hidden bg-slate-950 border-2 border-cyan-400 shadow-2xl shrink-0">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 opacity-90"
          />
          <canvas ref={skelCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-10" />

          <div className="absolute top-1 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
            <span className="px-1.5 py-0.5 rounded bg-slate-950/85 text-[9px] font-black text-emerald-300 border border-emerald-400/40">
              HEAD-TO-FEET AI
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-950/85 text-[9px] font-black text-amber-300 truncate max-w-[110px]">
              {telemetry.statusLabel}
            </span>
          </div>

          <div className="absolute bottom-1 inset-x-1.5 z-20 flex items-center justify-between text-[8px] font-black text-white bg-slate-950/80 px-2 py-0.5 rounded">
            <span className={telemetry.headDetected ? 'text-emerald-300' : 'text-white/40'}>HEAD ✓</span>
            <span className={telemetry.torsoArmsDetected ? 'text-emerald-300' : 'text-white/40'}>ARMS ✓</span>
            <span className={telemetry.hipsDetected ? 'text-emerald-300' : 'text-white/40'}>HIPS ✓</span>
            <span className={telemetry.legsFeetDetected ? 'text-emerald-300' : 'text-white/40'}>FEET ✓</span>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <button
              onClick={() => triggerPlayerAction('jump-pose')}
              className="px-3.5 py-2 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs border-2 border-white shadow-lg cursor-pointer transition active:scale-95"
            >
              ⬆️ Jump &amp; Pose
            </button>
            <button
              onClick={() => triggerPlayerAction('wall-kick')}
              className="px-3.5 py-2 rounded-2xl bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-black text-xs border-2 border-white shadow-lg cursor-pointer transition active:scale-95"
            >
              🦵 Wall Kick
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => triggerPlayerAction('punch', 1)}
              className="px-3.5 py-2 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs border-2 border-white shadow-lg cursor-pointer transition active:scale-95"
            >
              🥊 Punch Right
            </button>
            <button
              onClick={() => {
                manualLaneRef.current = 1;
                playSfx('dodge');
              }}
              className="px-3.5 py-2 rounded-2xl bg-slate-950/90 hover:bg-rose-500 text-white font-black text-xs border-2 border-rose-400 shadow-lg cursor-pointer transition active:scale-95"
            >
              Dodge Right ➡️
            </button>
          </div>
        </div>
      </div>

      {/* IN-GAME SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-cyan-400 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">⚙️ City Pose Chase Settings</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-xs font-black uppercase text-cyan-300 block mb-2">
                Difficulty (Speed &amp; Obstacles)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Easy', val: 0.7 },
                  { label: 'Medium', val: 1.0 },
                  { label: 'Hard', val: 1.45 },
                ].map((d) => (
                  <button
                    key={d.label}
                    onClick={() => onChangeSpeedMultiplier(d.val)}
                    className={`py-2.5 rounded-xl font-black text-xs cursor-pointer border ${
                      speedMultiplier === d.val
                        ? 'bg-amber-400 text-slate-950 border-white'
                        : 'bg-white/10 text-white border-white/15'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-bold">Voice Question Reader</span>
              <button
                onClick={() => onChangeVoiceEnabled(!voiceEnabled)}
                className={`px-4 py-1.5 rounded-full font-black text-xs cursor-pointer ${
                  voiceEnabled ? 'bg-emerald-400 text-slate-950' : 'bg-white/15 text-white'
                }`}
              >
                {voiceEnabled ? 'Voice On' : 'Voice Off'}
              </button>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-slate-950 font-black text-base cursor-pointer"
            >
              Resume City Chase
            </button>
          </div>
        </div>
      )}

      {/* VICTORY MODAL */}
      {victoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-amber-400 rounded-3xl max-w-md w-full p-7 text-center text-white shadow-2xl">
            <div className="text-6xl mb-2">🏆</div>
            <h2 className="text-3xl font-black text-amber-300 mb-1">CITY CHASE COMPLETE!</h2>
            <p className="text-xs text-slate-300 mb-5">
              Awesome full-body jumping, posing, punching, and wall-kicking, {riderName}!
            </p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-slate-800 p-3 rounded-2xl border border-amber-400/30">
                <div className="text-[10px] font-bold text-amber-300 uppercase">Total Score</div>
                <div className="text-2xl font-black mt-0.5">{victoryModal.score}</div>
              </div>
              <div className="bg-slate-800 p-3 rounded-2xl border border-emerald-400/30">
                <div className="text-[10px] font-bold text-emerald-300 uppercase">Gates Cleared</div>
                <div className="text-2xl font-black mt-0.5">
                  {victoryModal.questionsCleared}/{victoryModal.totalQuestions}
                </div>
              </div>
            </div>
            <button
              onClick={onExitToSetup}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-lg cursor-pointer"
            >
              Back to Setup
            </button>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameOverModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-4 border-rose-500 rounded-3xl max-w-md w-full p-7 text-center text-white shadow-2xl">
            <div className="text-6xl mb-2">💥</div>
            <h2 className="text-3xl font-black text-rose-400 mb-1">CHASE STOPPED!</h2>
            <p className="text-xs text-slate-300 mb-5">{gameOverModal.reason}</p>
            <div className="bg-slate-800 p-3 rounded-2xl border border-white/10 mb-6">
              <div className="text-xs font-bold text-amber-300">Final Score: {gameOverModal.score}</div>
            </div>
            <button
              onClick={onExitToSetup}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-lg cursor-pointer"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/********************************************************************
 * STANDALONE VIEW: CITY POSE CHASE (Editor + Setup + 3D Game)
 ********************************************************************/
export function CityPoseChase({
  onViewChange,
  initialGame,
}: {
  onViewChange: (view: ViewState, data?: any) => void;
  initialGame?: any;
}) {
  const { user } = useAuth();
  const hasLoadedQuestions = Boolean(
    initialGame &&
      ((initialGame.customQuestions && initialGame.customQuestions.length > 0) ||
        (initialGame.questions && initialGame.questions.length > 0))
  );

  const [screen, setScreen] = useState<'setup' | 'game'>('setup');
  const [riderName, setRiderName] = useState('Officer Hopps');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [timerMinutes, setTimerMinutes] = useState<number>(3);
  const [initialLives, setInitialLives] = useState<number>(3);
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const [showModeModal, setShowModeModal] = useState(false);

  const questions = hasLoadedQuestions
    ? normalizeChaseQuestions(initialGame.customQuestions || initialGame.questions)
    : SAMPLE_CHASE_QUESTIONS;

  if (screen === 'game') {
    return (
      <CityPoseChase3DGameplay
        questions={questions}
        riderName={riderName}
        speedMultiplier={speedMultiplier}
        onChangeSpeedMultiplier={setSpeedMultiplier}
        timerMinutes={timerMinutes}
        initialLives={initialLives}
        voiceEnabled={voiceEnabled}
        onChangeVoiceEnabled={setVoiceEnabled}
        onExitToSetup={() => setScreen('setup')}
      />
    );
  }

  return (
    <div
      id="city-pose-chase-setup"
      className="w-full min-h-full flex-1 bg-gradient-to-b from-sky-600 via-blue-700 to-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-8 overflow-y-auto relative font-['Fredoka',sans-serif]"
    >
      <div className="w-full max-w-6xl space-y-6 my-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onViewChange('home')}
              className="p-2.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase">
                Single Player Full-Body AI Mode
              </span>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mt-1">
                3D CITY POSE &amp; ACTION CHASE
              </h1>
            </div>
          </div>

          <button
            onClick={() => setShowModeModal(true)}
            className="px-4 py-2 rounded-full bg-white/15 hover:bg-white/25 border border-white/25 font-black text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Shuffle size={14} className="text-amber-300" />
            <span>Switch Game Mode</span>
          </button>
        </div>

        {/* Mandatory Head-to-Feet Body Detection Setup Scanner */}
        <BodyHeadToFeetSetupScanner />

        {/* Game Settings & Start Button */}
        <div className="bg-white/10 border border-white/20 rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <label className="text-xs font-black uppercase text-cyan-200 block mb-1.5">
              Runner Name
            </label>
            <input
              type="text"
              value={riderName}
              onChange={(e) => setRiderName(e.target.value)}
              className="w-full bg-slate-900/80 border border-white/25 rounded-2xl px-4 py-2.5 text-white font-bold outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-cyan-200 block mb-1.5">
              Difficulty &amp; Speed
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Easy', val: 0.7 },
                { label: 'Medium', val: 1.0 },
                { label: 'Hard', val: 1.45 },
              ].map((d) => (
                <button
                  key={d.label}
                  onClick={() => setSpeedMultiplier(d.val)}
                  className={`py-2.5 rounded-xl font-black text-xs cursor-pointer border ${
                    speedMultiplier === d.val
                      ? 'bg-amber-400 text-slate-950 border-white'
                      : 'bg-slate-900/60 text-white border-white/15'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => setScreen('game')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-slate-950 font-black text-xl shadow-2xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="fill-current" size={22} />
            <span>START 3D CITY CHASE!</span>
          </button>
        </div>
      </div>

      <GameModeModal
        isOpen={showModeModal}
        gameData={{
          id: initialGame?.id || Date.now(),
          name: initialGame?.name || 'City Pose Chase',
          gameType: 'roller-coaster-quiz',
          customQuestions: questions,
        }}
        onClose={() => setShowModeModal(false)}
        onSelectMode={(mode, adaptedData) => onViewChange(mode as ViewState, adaptedData)}
      />
    </div>
  );
}
export default CityPoseChase;
