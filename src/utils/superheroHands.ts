// ============================================================================
// SUPERHERO & FANTASY HAND RENDERERS FOR BUBBLE POP
// Anatomically proportioned, distortion-free 3D glove & gauntlet rendering
// with accurate 1:1 mirrored coordinate mapping and natural finger articulation.
// ============================================================================

export type HandCharacter =
  | 'spiderman'
  | 'thanos'
  | 'witch'
  | 'hulk'
  | 'ironman'
  | 'frost'
  | 'cyberpunk';

export type HandCharacterType = HandCharacter;

export interface SuperheroHandRenderOptions {
  ctx: CanvasRenderingContext2D;
  hands: Landmark[][];
  cw: number;
  ch: number;
  isTwoPlayers?: boolean;
  playerDetections?: Array<{
    holdProgress: number;
    matchedOptionIdx: number | null;
  }>;
  time?: number;
  videoW?: number;
  videoH?: number;
  character?: HandCharacterType;
}

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Convert normalized landmark [0..1] (already mirrored in x by onHandsResults/onFaceResults)
 * to canvas pixel coordinates, accounting for object-cover aspect ratio scaling.
 */
export function toPx(
  pt: Landmark,
  cw: number,
  ch: number,
  videoW = 1280,
  videoH = 720
): Point2D {
  if (!videoW || !videoH || videoW <= 0 || videoH <= 0) {
    return {
      x: pt.x * cw,
      y: pt.y * ch,
    };
  }
  const scale = Math.max(cw / videoW, ch / videoH);
  const drawW = videoW * scale;
  const drawH = videoH * scale;
  const offsetX = (cw - drawW) / 2;
  const offsetY = (ch - drawH) / 2;

  return {
    x: pt.x * drawW + offsetX,
    y: pt.y * drawH + offsetY,
  };
}

export function distPx(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerpPx(a: Point2D, b: Point2D, t: number): Point2D {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

interface HandAnatomy {
  pts: Point2D[];
  wrist: Point2D;
  middleKnuckle: Point2D;
  palmCenter: Point2D;
  palmScale: number;
  fingerWidth: number;
  armAngle: number;
  dir: Point2D;
  perp: Point2D;
  thumbSign: number;
  wristThumb: Point2D;
  wristPinky: Point2D;
  cuffBaseThumb: Point2D;
  cuffBasePinky: Point2D;
  cuffCenter: Point2D;
}

const FINGER_CHAINS: number[][] = [
  [1, 2, 3, 4],     // Thumb
  [5, 6, 7, 8],     // Index
  [9, 10, 11, 12],  // Middle
  [13, 14, 15, 16], // Ring
  [17, 18, 19, 20], // Pinky
];

/**
 * Computes distortion-free anatomical metrics for a 21-landmark hand.
 */
function computeHandAnatomy(
  hand: Landmark[],
  cw: number,
  ch: number,
  videoW: number,
  videoH: number,
  thicknessMultiplier = 1.0
): HandAnatomy {
  const pts = hand.map((p) => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];

  // Knuckle arch centroid (index, middle, ring, pinky MCPs)
  const knuckleMid = {
    x: (pts[5].x + pts[9].x + pts[13].x + pts[17].x) * 0.25,
    y: (pts[5].y + pts[9].y + pts[13].y + pts[17].y) * 0.25,
  };

  const palmLength = distPx(wrist, pts[9]);
  const knuckleSpan = distPx(pts[5], pts[17]);

  // Balanced anatomical scale clamped so close-up hands never explode
  const maxAllowedScale = Math.max(48, Math.min(cw, ch) * 0.28);
  const rawScale = Math.max(palmLength * 0.88, knuckleSpan * 1.08);
  const palmScale = Math.max(24, Math.min(maxAllowedScale, rawScale));

  const palmCenter = {
    x: wrist.x * 0.42 + knuckleMid.x * 0.48 + pts[2].x * 0.1,
    y: wrist.y * 0.42 + knuckleMid.y * 0.48 + pts[2].y * 0.1,
  };

  const armAngle = Math.atan2(knuckleMid.y - wrist.y, knuckleMid.x - wrist.x);
  const dir = { x: Math.cos(armAngle), y: Math.sin(armAngle) };
  const perp = { x: -dir.y, y: dir.x };

  // Determine which side of `perp` the thumb (landmark 5 / 2) lies on
  const toThumbX = pts[5].x - pts[17].x;
  const toThumbY = pts[5].y - pts[17].y;
  const dot = toThumbX * perp.x + toThumbY * perp.y;
  const thumbSign = dot >= 0 ? 1 : -1;

  // Wide anatomical wrist heel (prevents sharp V-point diamond distortion)
  const wristHalfW = Math.max(palmScale * 0.4, Math.min(palmScale * 0.58, knuckleSpan * 0.46)) * thicknessMultiplier;
  const wristThumb = {
    x: wrist.x + perp.x * thumbSign * wristHalfW * 0.92,
    y: wrist.y + perp.y * thumbSign * wristHalfW * 0.92,
  };
  const wristPinky = {
    x: wrist.x - perp.x * thumbSign * wristHalfW * 0.96,
    y: wrist.y - perp.y * thumbSign * wristHalfW * 0.96,
  };

  const cuffLen = palmScale * 0.42;
  const cuffCenter = {
    x: wrist.x - dir.x * cuffLen * 0.5,
    y: wrist.y - dir.y * cuffLen * 0.5,
  };
  const cuffBaseThumb = {
    x: wristThumb.x - dir.x * cuffLen + perp.x * thumbSign * (wristHalfW * 0.06),
    y: wristThumb.y - dir.y * cuffLen + perp.y * thumbSign * (wristHalfW * 0.06),
  };
  const cuffBasePinky = {
    x: wristPinky.x - dir.x * cuffLen - perp.x * thumbSign * (wristHalfW * 0.06),
    y: wristPinky.y - dir.y * cuffLen - perp.y * thumbSign * (wristHalfW * 0.06),
  };

  const fingerWidth = Math.max(7, Math.min(palmScale * 0.25 * thicknessMultiplier, 25 * thicknessMultiplier));

  return {
    pts,
    wrist,
    middleKnuckle: pts[9],
    palmCenter,
    palmScale,
    fingerWidth,
    armAngle,
    dir,
    perp,
    thumbSign,
    wristThumb,
    wristPinky,
    cuffBaseThumb,
    cuffBasePinky,
    cuffCenter,
  };
}

/**
 * Traces a smooth, organic, rounded glove palm contour using quadratic curves.
 */
function traceSmoothPalmPath(ctx: CanvasRenderingContext2D, h: HandAnatomy) {
  const { pts, wrist, wristThumb, wristPinky, palmCenter, perp, thumbSign, dir, palmScale } = h;

  const pad = palmScale * 0.1;
  const p1Out = {
    x: pts[1].x + perp.x * thumbSign * pad * 0.85,
    y: pts[1].y + perp.y * thumbSign * pad * 0.85,
  };
  const p2Out = {
    x: pts[2].x + perp.x * thumbSign * pad * 0.45,
    y: pts[2].y + perp.y * thumbSign * pad * 0.45,
  };
  const webSaddle = {
    x: (pts[2].x + pts[5].x) * 0.5 + (palmCenter.x - (pts[2].x + pts[5].x) * 0.5) * 0.25,
    y: (pts[2].y + pts[5].y) * 0.5 + (palmCenter.y - (pts[2].y + pts[5].y) * 0.5) * 0.25,
  };
  const p5Top = {
    x: pts[5].x + dir.x * pad * 0.45 + perp.x * thumbSign * pad * 0.35,
    y: pts[5].y + dir.y * pad * 0.45 + perp.y * thumbSign * pad * 0.35,
  };
  const p9Top = {
    x: pts[9].x + dir.x * pad * 0.55,
    y: pts[9].y + dir.y * pad * 0.55,
  };
  const p13Top = {
    x: pts[13].x + dir.x * pad * 0.5,
    y: pts[13].y + dir.y * pad * 0.5,
  };
  const p17Out = {
    x: pts[17].x + dir.x * pad * 0.35 - perp.x * thumbSign * pad * 0.75,
    y: pts[17].y + dir.y * pad * 0.35 - perp.y * thumbSign * pad * 0.75,
  };
  const pinkyEdgeMid = {
    x: (p17Out.x + wristPinky.x) * 0.5 - perp.x * thumbSign * pad * 0.8,
    y: (p17Out.y + wristPinky.y) * 0.5 - perp.y * thumbSign * pad * 0.8,
  };
  const wristHeelCtrl = {
    x: wrist.x - dir.x * pad * 0.95,
    y: wrist.y - dir.y * pad * 0.95,
  };

  const startPt = lerpPx(wristThumb, p1Out, 0.5);

  ctx.beginPath();
  ctx.moveTo(startPt.x, startPt.y);
  ctx.quadraticCurveTo(p1Out.x, p1Out.y, p2Out.x, p2Out.y);
  ctx.quadraticCurveTo(webSaddle.x, webSaddle.y, p5Top.x, p5Top.y);
  ctx.quadraticCurveTo(lerpPx(p5Top, p9Top, 0.5).x, lerpPx(p5Top, p9Top, 0.5).y, p9Top.x, p9Top.y);
  ctx.quadraticCurveTo(lerpPx(p9Top, p13Top, 0.5).x, lerpPx(p9Top, p13Top, 0.5).y, p13Top.x, p13Top.y);
  ctx.quadraticCurveTo(lerpPx(p13Top, p17Out, 0.5).x, lerpPx(p13Top, p17Out, 0.5).y, p17Out.x, p17Out.y);
  ctx.quadraticCurveTo(pinkyEdgeMid.x, pinkyEdgeMid.y, wristPinky.x, wristPinky.y);
  ctx.quadraticCurveTo(wristHeelCtrl.x, wristHeelCtrl.y, wristThumb.x, wristThumb.y);
  ctx.quadraticCurveTo(wristThumb.x, wristThumb.y, startPt.x, startPt.y);
  ctx.closePath();
}

/**
 * Traces a rounded wristband / gauntlet cuff anchored cleanly behind the wrist heel.
 */
function traceWristCuffPath(ctx: CanvasRenderingContext2D, h: HandAnatomy) {
  const { wristThumb, wristPinky, cuffBasePinky, cuffBaseThumb, dir, palmScale } = h;
  const ctrlTop = {
    x: (wristThumb.x + wristPinky.x) * 0.5 + dir.x * palmScale * 0.05,
    y: (wristThumb.y + wristPinky.y) * 0.5 + dir.y * palmScale * 0.05,
  };
  const ctrlBottom = {
    x: (cuffBaseThumb.x + cuffBasePinky.x) * 0.5 - dir.x * palmScale * 0.07,
    y: (cuffBaseThumb.y + cuffBasePinky.y) * 0.5 - dir.y * palmScale * 0.07,
  };

  ctx.beginPath();
  ctx.moveTo(wristThumb.x, wristThumb.y);
  ctx.quadraticCurveTo(ctrlTop.x, ctrlTop.y, wristPinky.x, wristPinky.y);
  ctx.lineTo(cuffBasePinky.x, cuffBasePinky.y);
  ctx.quadraticCurveTo(ctrlBottom.x, ctrlBottom.y, cuffBaseThumb.x, cuffBaseThumb.y);
  ctx.closePath();
}

interface FingerStyleOptions {
  outlineColor: string;
  baseColor: string;
  midColor?: string;
  tipColor: string;
  highlightColor: string;
  jointColor?: string;
  outlineExtra?: number;
}

/**
 * Renders all 5 articulated fingers ON TOP of the palm so that both extended
 * and bent/curled fingers (e.g. pointing one finger or making a fist) remain
 * 100% visible and track every finger movement accurately.
 */
function drawSculptedFingers(
  ctx: CanvasRenderingContext2D,
  h: HandAnatomy,
  style: FingerStyleOptions,
  onFingerExtra?: (chain: number[], fIdx: number, baseW: number) => void
) {
  const { pts, fingerWidth } = h;
  const outlineExtra = style.outlineExtra ?? 3.5;

  FINGER_CHAINS.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.06 : fIdx === 1 ? 0.96 : fIdx === 2 ? 1.0 : fIdx === 3 ? 0.94 : 0.82;
    const baseW = fingerWidth * fScale;
    const fPts = [pts[chain[0]], pts[chain[1]], pts[chain[2]], pts[chain[3]]];

    // 1. Dark outer contour pass along the 3 phalanges
    for (let i = 0; i < fPts.length - 1; i++) {
      const p1 = fPts[i];
      const p2 = fPts[i + 1];
      const taper = 1.0 - i * 0.11;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = style.outlineColor;
      ctx.lineWidth = baseW * taper + outlineExtra;
      ctx.stroke();
    }

    // 2. Main colored 3D finger body pass
    for (let i = 0; i < fPts.length - 1; i++) {
      const p1 = fPts[i];
      const p2 = fPts[i + 1];
      const taper = 1.0 - i * 0.11;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle =
        i === 2
          ? style.tipColor
          : i === 1 && style.midColor
            ? style.midColor
            : style.baseColor;
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // 3D cylindrical specular highlight along the center of each phalanx
      const inset1 = lerpPx(p1, p2, 0.2);
      const inset2 = lerpPx(p1, p2, 0.8);
      ctx.beginPath();
      ctx.moveTo(inset1.x, inset1.y);
      ctx.lineTo(inset2.x, inset2.y);
      ctx.strokeStyle = style.highlightColor;
      ctx.lineWidth = Math.max(1.4, baseW * taper * 0.26);
      ctx.stroke();

      // Subtle anatomical knuckle crease / armor seam at joints
      if (i > 0 && style.jointColor) {
        const jPt = fPts[i];
        const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const segPerp = { x: -Math.sin(segAngle), y: Math.cos(segAngle) };
        const halfSeam = baseW * taper * 0.34;

        ctx.beginPath();
        ctx.moveTo(jPt.x - segPerp.x * halfSeam, jPt.y - segPerp.y * halfSeam);
        ctx.lineTo(jPt.x + segPerp.x * halfSeam, jPt.y + segPerp.y * halfSeam);
        ctx.strokeStyle = style.jointColor;
        ctx.lineWidth = Math.max(1.4, baseW * 0.11);
        ctx.stroke();
      }
    }

    if (onFingerExtra) {
      onFingerExtra(chain, fIdx, baseW);
    }
  });
}

// ============================================================================
// 1. SPIDER-MAN HAND
// ============================================================================
export function drawSpidermanHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.0);
  const { pts, wrist, palmCenter, palmScale, fingerWidth } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(239, 68, 68, 0.7)' : 'rgba(15, 23, 42, 0.45)';
  ctx.shadowBlur = isLocking ? 16 : 10;

  // 1. Navy & Red Spider-Suit Wrist Cuff
  traceWristCuffPath(ctx, h);
  const cuffGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  cuffGrad.addColorStop(0, '#0f172a');
  cuffGrad.addColorStop(0.55, '#1e3a8a');
  cuffGrad.addColorStop(1, '#dc2626');
  ctx.fillStyle = cuffGrad;
  ctx.fill();
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.055);
  ctx.stroke();

  // 2. Smooth Rounded Spider-Suit Palm
  traceSmoothPalmPath(ctx, h);
  const palmGrad = ctx.createRadialGradient(
    palmCenter.x - palmScale * 0.1,
    palmCenter.y - palmScale * 0.1,
    palmScale * 0.08,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.05
  );
  palmGrad.addColorStop(0, '#f87171');
  palmGrad.addColorStop(0.35, '#ef4444');
  palmGrad.addColorStop(0.78, '#dc2626');
  palmGrad.addColorStop(1, '#991b1b');
  ctx.fillStyle = palmGrad;
  ctx.fill();
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.055);
  ctx.stroke();

  // Concentric Spider-Webbing Etched on the Red Glove
  ctx.save();
  traceSmoothPalmPath(ctx, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = Math.max(1.2, palmScale * 0.025);
  const webTargets = [pts[2], pts[5], pts[9], pts[13], pts[17], wrist];
  webTargets.forEach((target) => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });

  [0.32, 0.58, 0.82].forEach((ringFactor) => {
    ctx.beginPath();
    for (let i = 0; i < webTargets.length; i++) {
      const a = lerpPx(palmCenter, webTargets[i], ringFactor);
      const b = lerpPx(palmCenter, webTargets[(i + 1) % webTargets.length], ringFactor);
      const mid = lerpPx(a, b, 0.5);
      const sag = lerpPx(mid, palmCenter, 0.14);
      if (i === 0) ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(sag.x, sag.y, b.x, b.y);
    }
    ctx.stroke();
  });
  ctx.restore();

  // 3. Crisp Black Spider Emblem in Center of Palm
  const spiderSize = Math.max(8, palmScale * 0.18);
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(h.armAngle + Math.PI / 2);
  ctx.fillStyle = '#090d16';
  ctx.strokeStyle = '#090d16';
  ctx.lineWidth = Math.max(1.5, spiderSize * 0.16);

  ctx.beginPath();
  ctx.ellipse(0, 3, spiderSize * 0.34, spiderSize * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -spiderSize * 0.34, spiderSize * 0.24, 0, Math.PI * 2);
  ctx.fill();

  [-1, 1].forEach((side) => {
    [-0.55, -0.18, 0.22, 0.6].forEach((angleOffset, legIdx) => {
      ctx.beginPath();
      ctx.moveTo(side * spiderSize * 0.2, (legIdx - 1.5) * spiderSize * 0.14);
      const kneeX = side * spiderSize * 0.72;
      const kneeY = angleOffset * spiderSize * 0.75;
      const footX = side * spiderSize * 0.95;
      const footY = (angleOffset + (legIdx < 2 ? -0.35 : 0.4)) * spiderSize * 1.05;
      ctx.quadraticCurveTo(kneeX, kneeY, footX, footY);
      ctx.stroke();
    });
  });
  ctx.restore();

  // 4. Sculpted Spider-Suit Fingers (drawn on top so curled/pointing fingers are always visible)
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#090d16',
      baseColor: '#dc2626',
      midColor: '#ef4444',
      tipColor: '#f87171',
      highlightColor: 'rgba(254, 202, 202, 0.45)',
      jointColor: 'rgba(15, 23, 42, 0.65)',
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, baseW * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.fill();
    }
  );

  // 5. Mechanical Silver & Cyan Web-Shooter at Wrist
  const shooterW = Math.max(12, palmScale * 0.32);
  const shooterH = Math.max(8, palmScale * 0.2);
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(h.armAngle + Math.PI / 2);

  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-shooterW / 2, -shooterH / 2, shooterW, shooterH, 5);
  ctx.fill();
  ctx.stroke();

  const webPulse = Math.sin(time * 0.01) * 0.15 + 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, shooterH * 0.32 * webPulse, 0, Math.PI * 2);
  ctx.fillStyle = isLocking ? '#ffffff' : '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.restore();

  if (isLocking && holdProgress > 0) {
    const ringRadius = palmScale * 0.55 + (holdProgress / 100) * palmScale * 0.45;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, fingerWidth * 0.16);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 2. THANOS INFINITY GAUNTLET
// ============================================================================
export function drawThanosHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.08);
  const { pts, wrist, palmCenter, palmScale } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(250, 204, 21, 0.85)' : 'rgba(69, 26, 3, 0.6)';
  ctx.shadowBlur = isLocking ? 20 : 12;

  // 1. Armored Golden Vambrace Wrist Cuff
  traceWristCuffPath(ctx, h);
  const vambraceGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  vambraceGrad.addColorStop(0, '#78350f');
  vambraceGrad.addColorStop(0.45, '#b45309');
  vambraceGrad.addColorStop(0.8, '#f59e0b');
  vambraceGrad.addColorStop(1, '#fef08a');
  ctx.fillStyle = vambraceGrad;
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = Math.max(3, palmScale * 0.06);
  ctx.stroke();

  // 2. Heavy Rounded Golden Gauntlet Dorsal Carapace
  traceSmoothPalmPath(ctx, h);
  const goldGrad = ctx.createRadialGradient(
    palmCenter.x - palmScale * 0.1,
    palmCenter.y - palmScale * 0.1,
    palmScale * 0.08,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.15
  );
  goldGrad.addColorStop(0, '#fef08a');
  goldGrad.addColorStop(0.35, '#f59e0b');
  goldGrad.addColorStop(0.75, '#d97706');
  goldGrad.addColorStop(1, '#78350f');
  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = Math.max(3, palmScale * 0.065);
  ctx.stroke();

  // Engraved Titan Carvings connecting knuckles to Mind Stone center
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.65)';
  ctx.lineWidth = Math.max(1.6, palmScale * 0.032);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach((target) => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });

  // 3. Articulated Golden Armor Fingers (drawn before stones so knuckle stones crown the joints)
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#451a03',
      baseColor: '#d97706',
      midColor: '#f59e0b',
      tipColor: '#fde047',
      highlightColor: 'rgba(254, 249, 195, 0.65)',
      jointColor: '#78350f',
      outlineExtra: 4,
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, baseW * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#fef08a';
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  );

  // 4. THE 6 CANONICAL INFINITY STONES
  const stoneData = [
    { color: '#c084fc', core: '#a855f7', glow: '#9333ea', pt: pts[5], size: palmScale * 0.11 },
    { color: '#60a5fa', core: '#3b82f6', glow: '#2563eb', pt: pts[9], size: palmScale * 0.115 },
    { color: '#f87171', core: '#ef4444', glow: '#dc2626', pt: pts[13], size: palmScale * 0.11 },
    { color: '#fb923c', core: '#f97316', glow: '#ea580c', pt: pts[17], size: palmScale * 0.1 },
    { color: '#34d399', core: '#10b981', glow: '#059669', pt: pts[2], size: palmScale * 0.11 },
    { color: '#fef08a', core: '#facc15', glow: '#eab308', pt: palmCenter, size: palmScale * 0.19, isCenter: true },
  ];

  stoneData.forEach((stone) => {
    const isMind = stone.isCenter;
    const pulse = Math.sin(time * 0.008 + (isMind ? 0 : 2)) * 0.16 + 1.0;
    const r = stone.size * (isLocking ? pulse * 1.2 : pulse);

    ctx.save();
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * 1.28, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    const glowRad = ctx.createRadialGradient(
      stone.pt.x,
      stone.pt.y,
      r * 0.2,
      stone.pt.x,
      stone.pt.y,
      r * (isLocking ? 2.2 : 1.65)
    );
    glowRad.addColorStop(0, '#ffffff');
    glowRad.addColorStop(0.35, stone.color);
    glowRad.addColorStop(0.75, stone.glow);
    glowRad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glowRad;
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * (isLocking ? 2.2 : 1.65), 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    if (isMind) {
      ctx.ellipse(stone.pt.x, stone.pt.y, r * 1.12, r * 0.82, h.armAngle, 0, Math.PI * 2);
    } else {
      ctx.arc(stone.pt.x, stone.pt.y, r * 0.88, 0, Math.PI * 2);
    }
    ctx.fillStyle = stone.core;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(stone.pt.x - r * 0.25, stone.pt.y - r * 0.25, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  });

  if (isLocking && holdProgress > 0) {
    const surgeRadius = palmScale * (0.62 + (holdProgress / 100) * 0.42);
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = Math.max(2.5, palmScale * 0.045);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, surgeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 3. WICKED WITCH HAND
// ============================================================================
export function drawWitchHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 0.94);
  const { pts, wrist, palmCenter, palmScale, fingerWidth } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(168, 85, 247, 0.85)' : 'rgba(16, 185, 129, 0.5)';
  ctx.shadowBlur = isLocking ? 18 : 12;

  // 1. Dark Velvet Witch Sleeve Cuff
  traceWristCuffPath(ctx, h);
  const sleeveGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  sleeveGrad.addColorStop(0, '#09090b');
  sleeveGrad.addColorStop(0.65, '#1e1b4b');
  sleeveGrad.addColorStop(1, '#581c87');
  ctx.fillStyle = sleeveGrad;
  ctx.fill();
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = Math.max(2, palmScale * 0.045);
  ctx.stroke();

  // 2. Smooth Emerald Witch Palm
  traceSmoothPalmPath(ctx, h);
  const skinGrad = ctx.createRadialGradient(
    palmCenter.x,
    palmCenter.y,
    palmScale * 0.08,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.1
  );
  skinGrad.addColorStop(0, '#a7f3d0');
  skinGrad.addColorStop(0.45, '#34d399');
  skinGrad.addColorStop(0.82, '#059669');
  skinGrad.addColorStop(1, '#064e3b');
  ctx.fillStyle = skinGrad;
  ctx.fill();
  ctx.strokeStyle = '#022c22';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.05);
  ctx.stroke();

  // Swirling Arcane Pentagram Rune in Palm Center
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(time * 0.002);
  const runeR = palmScale * 0.25;
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, runeR, 0, Math.PI * 2);
  ctx.stroke();
  for (let r = 0; r < 5; r++) {
    const a = (r * Math.PI * 2) / 5;
    const b = (((r + 2) % 5) * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * runeR, Math.sin(a) * runeR);
    ctx.lineTo(Math.cos(b) * runeR, Math.sin(b) * runeR);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Slender Emerald Witch Fingers with Curved Obsidian Claws
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#022c22',
      baseColor: '#10b981',
      midColor: '#34d399',
      tipColor: '#6ee7b7',
      highlightColor: 'rgba(209, 250, 229, 0.45)',
      jointColor: '#065f46',
      outlineExtra: 3,
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      const prevTip = pts[chain[2]];
      const tipAngle = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);
      const clawLen = baseW * 1.35;

      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(tipAngle);

      ctx.beginPath();
      ctx.moveTo(-baseW * 0.32, -baseW * 0.3);
      ctx.quadraticCurveTo(clawLen * 0.45, -baseW * 0.22, clawLen, 0);
      ctx.quadraticCurveTo(clawLen * 0.45, baseW * 0.22, -baseW * 0.32, baseW * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#09090b';
      ctx.fill();
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(clawLen * 0.68, 0, baseW * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.restore();
    }
  );

  // Enchanted Rings on Index & Ring Knuckles
  [pts[5], pts[13]].forEach((kPt, idx) => {
    ctx.beginPath();
    ctx.arc(kPt.x, kPt.y, fingerWidth * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(kPt.x, kPt.y, fingerWidth * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? '#e879f9' : '#4ade80';
    ctx.fill();
  });

  if (isLocking && holdProgress > 0) {
    const auraR = palmScale * (0.58 + (holdProgress / 100) * 0.45);
    ctx.save();
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.88)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, auraR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 4. INCREDIBLE HULK HAND
// ============================================================================
export function drawHulkHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.18);
  const { pts, wrist, palmCenter, palmScale } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(74, 222, 128, 0.9)' : 'rgba(5, 46, 22, 0.6)';
  ctx.shadowBlur = isLocking ? 22 : 12;

  // 1. Torn Purple Superhero Wristband
  traceWristCuffPath(ctx, h);
  const bandGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  bandGrad.addColorStop(0, '#4c1d95');
  bandGrad.addColorStop(0.5, '#7e22ce');
  bandGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = bandGrad;
  ctx.fill();
  ctx.strokeStyle = '#2e1065';
  ctx.lineWidth = Math.max(3, palmScale * 0.06);
  ctx.stroke();

  // 2. Heavy Rounded Muscular Gamma-Green Palm
  traceSmoothPalmPath(ctx, h);
  const hulkGrad = ctx.createRadialGradient(
    palmCenter.x - palmScale * 0.08,
    palmCenter.y - palmScale * 0.08,
    palmScale * 0.1,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.2
  );
  hulkGrad.addColorStop(0, '#86efac');
  hulkGrad.addColorStop(0.38, '#22c55e');
  hulkGrad.addColorStop(0.78, '#16a34a');
  hulkGrad.addColorStop(1, '#14532d');
  ctx.fillStyle = hulkGrad;
  ctx.fill();
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = Math.max(3.5, palmScale * 0.07);
  ctx.stroke();

  // Deterministic Pulsing Gamma Veins along the Back of the Hand
  const veinPulse = 0.55 + Math.sin(time * 0.008) * 0.25;
  ctx.strokeStyle = `rgba(190, 242, 100, ${veinPulse})`;
  ctx.lineWidth = Math.max(1.8, palmScale * 0.036);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach((k, idx) => {
    const mid = lerpPx(palmCenter, k, 0.52);
    const offset = (idx % 2 === 0 ? 1 : -1) * palmScale * 0.04;
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.quadraticCurveTo(mid.x + h.perp.x * offset, mid.y + h.perp.y * offset, k.x, k.y);
    ctx.stroke();
  });

  // Glowing Gamma Emblem in Palm Center
  const radR = palmScale * 0.17;
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, radR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20, 83, 45, 0.75)';
  ctx.fill();
  ctx.strokeStyle = '#bef264';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, radR * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = '#bef264';
  ctx.fill();

  // 3. Muscular Gamma-Green Fingers
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#052e16',
      baseColor: '#16a34a',
      midColor: '#22c55e',
      tipColor: '#4ade80',
      highlightColor: 'rgba(187, 247, 208, 0.45)',
      jointColor: '#14532d',
      outlineExtra: 4.5,
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, baseW * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(220, 252, 231, 0.55)';
      ctx.fill();
    }
  );

  if (isLocking && holdProgress > 0) {
    const smashR = palmScale * (0.65 + (holdProgress / 100) * 0.55);
    ctx.save();
    ctx.strokeStyle = 'rgba(163, 230, 53, 0.9)';
    ctx.lineWidth = Math.max(3, palmScale * 0.055);
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, smashR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 5. IRON MAN MARK LXXXV GAUNTLET
// ============================================================================
export function drawIronManHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.04);
  const { pts, wrist, palmCenter, palmScale } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(56, 189, 248, 0.9)' : 'rgba(239, 68, 68, 0.5)';
  ctx.shadowBlur = isLocking ? 22 : 12;

  // 1. Stark Hot-Rod Red & Gold Armored Cuff
  traceWristCuffPath(ctx, h);
  const cuffGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  cuffGrad.addColorStop(0, '#7f1d1d');
  cuffGrad.addColorStop(0.55, '#dc2626');
  cuffGrad.addColorStop(1, '#fbbf24');
  ctx.fillStyle = cuffGrad;
  ctx.fill();
  ctx.strokeStyle = '#450a0a';
  ctx.lineWidth = Math.max(2.8, palmScale * 0.055);
  ctx.stroke();

  // 2. Smooth Armored Stark Gauntlet Palm
  traceSmoothPalmPath(ctx, h);
  const armorGrad = ctx.createRadialGradient(
    palmCenter.x,
    palmCenter.y,
    palmScale * 0.08,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.15
  );
  armorGrad.addColorStop(0, '#fef08a');
  armorGrad.addColorStop(0.28, '#f59e0b');
  armorGrad.addColorStop(0.62, '#dc2626');
  armorGrad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = armorGrad;
  ctx.fill();
  ctx.strokeStyle = '#450a0a';
  ctx.lineWidth = Math.max(3, palmScale * 0.06);
  ctx.stroke();

  // Gold Titanium Seam Lines to Knuckles
  ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
  ctx.lineWidth = Math.max(1.5, palmScale * 0.03);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // Iconic Glowing Arc Reactor Repulsor Core in Palm Center
  const repulsorPulse = 1 + Math.sin(time * 0.012) * 0.1;
  const repR = palmScale * 0.24 * (isLocking ? 1.2 : repulsorPulse);

  ctx.save();
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repR * 1.24, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = Math.max(2, palmScale * 0.04);
  ctx.stroke();

  const coreGrad = ctx.createRadialGradient(
    palmCenter.x,
    palmCenter.y,
    repR * 0.1,
    palmCenter.x,
    palmCenter.y,
    repR * 1.45
  );
  coreGrad.addColorStop(0, '#ffffff');
  coreGrad.addColorStop(0.45, '#e0f2fe');
  coreGrad.addColorStop(0.75, '#38bdf8');
  coreGrad.addColorStop(1, 'rgba(2, 132, 199, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repR * 1.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repR * 0.72, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  // 3. Articulated Red & Gold Titanium Fingers with Repulsor Tips
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#450a0a',
      baseColor: '#dc2626',
      midColor: '#f59e0b',
      tipColor: '#ef4444',
      highlightColor: 'rgba(254, 240, 138, 0.65)',
      jointColor: '#78350f',
      outlineExtra: 3.8,
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, baseW * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#e0f2fe';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.fill();
    }
  );

  if (isLocking && holdProgress > 0) {
    const blastR = palmScale * (0.58 + (holdProgress / 100) * 0.48);
    ctx.save();
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = Math.max(2.5, palmScale * 0.05);
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, blastR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 6. FROST MAGE GLACIAL GAUNTLET
// ============================================================================
export function drawFrostMageHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.0);
  const { pts, wrist, palmCenter, palmScale } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(186, 230, 253, 0.9)' : 'rgba(14, 165, 233, 0.55)';
  ctx.shadowBlur = isLocking ? 20 : 12;

  // 1. Royal Cryo-Armor Wrist Cuff
  traceWristCuffPath(ctx, h);
  const cuffGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  cuffGrad.addColorStop(0, '#0c4a6e');
  cuffGrad.addColorStop(0.55, '#0284c7');
  cuffGrad.addColorStop(1, '#bae6fd');
  ctx.fillStyle = cuffGrad;
  ctx.fill();
  ctx.strokeStyle = '#082f49';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.055);
  ctx.stroke();

  // 2. Smooth Rounded Glacial Gauntlet Palm
  traceSmoothPalmPath(ctx, h);
  const iceGrad = ctx.createRadialGradient(
    palmCenter.x - palmScale * 0.08,
    palmCenter.y - palmScale * 0.08,
    palmScale * 0.06,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.12
  );
  iceGrad.addColorStop(0, '#f0f9ff');
  iceGrad.addColorStop(0.32, '#bae6fd');
  iceGrad.addColorStop(0.68, '#38bdf8');
  iceGrad.addColorStop(1, '#0369a1');
  ctx.fillStyle = iceGrad;
  ctx.fill();
  ctx.strokeStyle = '#082f49';
  ctx.lineWidth = Math.max(2.8, palmScale * 0.058);
  ctx.stroke();

  // Frost Facet Lines radiating from Palm Center to Knuckles
  ctx.strokeStyle = 'rgba(240, 249, 255, 0.65)';
  ctx.lineWidth = Math.max(1.5, palmScale * 0.028);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // Rotating 6-Pointed Crystalline Snowflake Emblem Inside the Palm
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(time * 0.0018);
  const flakeR = palmScale * 0.22;

  ctx.beginPath();
  ctx.arc(0, 0, flakeR * 1.15, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12, 74, 110, 0.55)';
  ctx.fill();
  ctx.strokeStyle = '#bae6fd';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.8, palmScale * 0.032);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x2 = Math.cos(a) * flakeR;
    const y2 = Math.sin(a) * flakeR;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const bx = Math.cos(a) * (flakeR * 0.58);
    const by = Math.sin(a) * (flakeR * 0.58);
    [-0.55, 0.55].forEach((da) => {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a + da) * (flakeR * 0.34), by + Math.sin(a + da) * (flakeR * 0.34));
      ctx.stroke();
    });
  }
  ctx.restore();

  // 3. Sculpted Crystalline Ice Fingers
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#082f49',
      baseColor: '#0284c7',
      midColor: '#38bdf8',
      tipColor: '#7dd3fc',
      highlightColor: 'rgba(240, 249, 255, 0.75)',
      jointColor: 'rgba(12, 74, 110, 0.7)',
      outlineExtra: 3.8,
    },
    (chain, _fIdx, baseW) => {
      const tip = pts[chain[3]];
      const prev = pts[chain[2]];
      const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
      const r = baseW * 0.34;

      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(r * 1.35, 0);
      ctx.lineTo(0, -r * 0.85);
      ctx.lineTo(-r * 0.85, 0);
      ctx.lineTo(0, r * 0.85);
      ctx.closePath();
      ctx.fillStyle = '#f0f9ff';
      ctx.fill();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  );

  if (isLocking && holdProgress > 0) {
    const blizzardR = palmScale * (0.58 + (holdProgress / 100) * 0.45);
    ctx.save();
    ctx.strokeStyle = '#f0f9ff';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, blizzardR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ============================================================================
// 7. CYBERPUNK MECHA HAND
// ============================================================================
export function drawCyberpunkHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const h = computeHandAnatomy(hand, cw, ch, videoW, videoH, 1.02);
  const { pts, wrist, palmCenter, palmScale } = h;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = isLocking ? 'rgba(34, 211, 238, 0.9)' : 'rgba(217, 70, 239, 0.65)';
  ctx.shadowBlur = isLocking ? 20 : 12;

  // 1. Matte Carbon & Neon Magenta Cyber Cuff
  traceWristCuffPath(ctx, h);
  const cuffGrad = ctx.createLinearGradient(h.cuffCenter.x, h.cuffCenter.y, wrist.x, wrist.y);
  cuffGrad.addColorStop(0, '#09090b');
  cuffGrad.addColorStop(0.65, '#1e1b4b');
  cuffGrad.addColorStop(1, '#312e81');
  ctx.fillStyle = cuffGrad;
  ctx.fill();
  ctx.strokeStyle = '#d946ef';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.05);
  ctx.stroke();

  // 2. Smooth Rounded Carbon-Fiber Cyber Palm
  traceSmoothPalmPath(ctx, h);
  const chasGrad = ctx.createRadialGradient(
    palmCenter.x,
    palmCenter.y,
    palmScale * 0.08,
    palmCenter.x,
    palmCenter.y,
    palmScale * 1.15
  );
  chasGrad.addColorStop(0, '#334155');
  chasGrad.addColorStop(0.55, '#1e293b');
  chasGrad.addColorStop(1, '#09090b');
  ctx.fillStyle = chasGrad;
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.052);
  ctx.stroke();

  // Neon Magenta PCB Traces to Knuckle Nodes
  ctx.strokeStyle = '#d946ef';
  ctx.lineWidth = Math.max(1.8, palmScale * 0.032);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach((k) => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // Spinning Holographic Cyber Core in Palm Center
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(-time * 0.003);
  const holoR = palmScale * 0.21;

  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const hx = Math.cos(a) * holoR;
    const hy = Math.sin(a) * holoR;
    if (i === 0) ctx.moveTo(hx, hy);
    else ctx.lineTo(hx, hy);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(34, 211, 238, 0.28)';
  ctx.fill();
  ctx.strokeStyle = '#22d3ee';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, holoR * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = '#f0abfc';
  ctx.fill();
  ctx.restore();

  // 3. Matte-Black Mecha Fingers with Neon Cyan & Magenta Circuitry
  drawSculptedFingers(
    ctx,
    h,
    {
      outlineColor: '#09090b',
      baseColor: '#1e293b',
      midColor: '#334155',
      tipColor: '#0f172a',
      highlightColor: 'rgba(34, 211, 238, 0.65)',
      jointColor: '#d946ef',
      outlineExtra: 3.8,
    },
    (chain, _fIdx, baseW) => {
      const k = pts[chain[0]];
      ctx.beginPath();
      ctx.arc(k.x, k.y, baseW * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = '#09090b';
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const tip = pts[chain[3]];
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, baseW * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
      ctx.strokeStyle = '#f0abfc';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  );

  if (isLocking && holdProgress > 0) {
    const empR = palmScale * (0.58 + (holdProgress / 100) * 0.48);
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, empR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Dispatcher for single-character hand rendering
 */
export function drawCharacterHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  character: HandCharacter,
  cw: number,
  ch: number,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  switch (character) {
    case 'spiderman':
      return drawSpidermanHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'thanos':
      return drawThanosHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'witch':
      return drawWitchHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'hulk':
      return drawHulkHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'ironman':
      return drawIronManHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'frost':
      return drawFrostMageHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    case 'cyberpunk':
      return drawCyberpunkHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
    default:
      return drawSpidermanHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
  }
}

/**
 * Renders detected hands with either an options object (used by YogaQuiz) or positional arguments
 */
export function drawSuperheroHands(
  ctxOrOpts: CanvasRenderingContext2D | SuperheroHandRenderOptions,
  hands?: Landmark[][],
  character: HandCharacter = 'spiderman',
  cw = 1280,
  ch = 720,
  isLocking = false,
  holdProgress = 0,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if ('ctx' in ctxOrOpts) {
    const opts = ctxOrOpts;
    if (!opts.hands || !opts.hands.length) return;
    const t = opts.time ?? performance.now();
    const vW = opts.videoW ?? 1280;
    const vH = opts.videoH ?? 720;

    opts.hands.forEach((mirroredHand, idx) => {
      if (!mirroredHand || mirroredHand.length < 21) return;
      const wristMirroredX = mirroredHand[0]?.x ?? 0.5;
      const pIdx = opts.isTwoPlayers ? (wristMirroredX < 0.5 ? 0 : 1) : 0;
      const det = opts.playerDetections?.[pIdx] || opts.playerDetections?.[idx];
      const locking = Boolean(det && det.matchedOptionIdx !== null && det.holdProgress > 0);
      const prog = det?.holdProgress ?? 0;
      const char: HandCharacter =
        opts.character ?? (opts.isTwoPlayers ? (wristMirroredX < 0.5 ? 'spiderman' : 'thanos') : idx % 2 === 0 ? 'spiderman' : 'thanos');

      drawCharacterHand(opts.ctx, mirroredHand, char, opts.cw, opts.ch, locking, prog, t, vW, vH);
    });
    return;
  }

  if (!hands || !hands.length) return;
  hands.forEach((hand) => {
    drawCharacterHand(ctxOrOpts, hand, character, cw, ch, isLocking, holdProgress, time, videoW, videoH);
  });
}
