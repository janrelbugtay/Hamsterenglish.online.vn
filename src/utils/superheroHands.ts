/**
 * Superhero Hands Canvas Renderer for Camera Mode
 * Left Side: Spider-Man's Web-Shooter Hand (Red & Navy suit, Webbing, Web-Shooter)
 * Right Side: Thanos's Infinity Gauntlet (Golden Titan Armor, 6 Glowing Infinity Stones)
 *
 * Designed with aspect-ratio-aware object-cover mapping so hands perfectly align
 * with the user's real camera feed without any stretching, flattening, or distortion.
 */

export interface Landmark {
  x: number;
  y: number;
  z?: number;
}

export interface SuperheroHandOptions {
  ctx: CanvasRenderingContext2D;
  hands: Landmark[][];
  cw: number;
  ch: number;
  isTwoPlayers: boolean;
  playerDetections: Array<{
    holdProgress: number;
    matchedOptionIdx: number | null;
  }>;
  time?: number;
  videoW?: number;
  videoH?: number;
}

/**
 * Aspect-ratio-aware coordinate projection matching CSS `object-cover`.
 * Converts normalized video landmarks (0..1) to isotropic canvas pixel coordinates.
 */
export function toPx(
  lm: Landmark,
  cw: number,
  ch: number,
  videoW = 1280,
  videoH = 720
): { x: number; y: number } {
  const vW = videoW > 0 ? videoW : 1280;
  const vH = videoH > 0 ? videoH : 720;
  const videoAspect = vW / vH;
  const canvasAspect = cw / (ch || 1);

  if (canvasAspect > videoAspect) {
    // Canvas is wider than video: scale to fit width, cropped vertically
    const renderedH = cw / videoAspect;
    const offsetY = (ch - renderedH) / 2;
    return {
      x: lm.x * cw,
      y: lm.y * renderedH + offsetY,
    };
  } else {
    // Canvas is taller than video: scale to fit height, cropped horizontally
    const renderedW = ch * videoAspect;
    const offsetX = (cw - renderedW) / 2;
    return {
      x: lm.x * renderedW + offsetX,
      y: lm.y * ch,
    };
  }
}

/** Euclidean distance between two pixel points */
export function distPx(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/** Interpolate between two pixel points */
export function lerpPx(p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/**
 * Draw Spider-Man's Hand (Left Side / Player 1)
 * High-tech comic-accurate red glove, curved web grid, navy side plates,
 * silver web-shooter at wrist, and live web-shooting effects on lock-in.
 */
export function drawSpidermanHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking: boolean,
  holdProgress: number,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.55);
  const fingerWidth = Math.max(10, palmScale * 0.26);

  // Arm/Hand orientation angle
  const armAngle = Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x);
  const perp = { x: -Math.sin(armAngle), y: Math.cos(armAngle) };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Forearm Bracer (Red & Navy Suit Sleeve)
  const forearmOffset = palmScale * 0.65;
  const bracerBase = {
    x: wrist.x - Math.cos(armAngle) * forearmOffset,
    y: wrist.y - Math.sin(armAngle) * forearmOffset,
  };
  const bracerHalfW = palmScale * 0.45;

  ctx.beginPath();
  ctx.moveTo(wrist.x + perp.x * bracerHalfW * 0.85, wrist.y + perp.y * bracerHalfW * 0.85);
  ctx.lineTo(wrist.x - perp.x * bracerHalfW * 0.85, wrist.y - perp.y * bracerHalfW * 0.85);
  ctx.lineTo(bracerBase.x - perp.x * bracerHalfW, bracerBase.y - perp.y * bracerHalfW);
  ctx.lineTo(bracerBase.x + perp.x * bracerHalfW, bracerBase.y + perp.y * bracerHalfW);
  ctx.closePath();

  const sleeveGrad = ctx.createLinearGradient(bracerBase.x, bracerBase.y, wrist.x, wrist.y);
  sleeveGrad.addColorStop(0, '#be123c');
  sleeveGrad.addColorStop(1, '#e11d48');
  ctx.fillStyle = sleeveGrad;
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.05);
  ctx.stroke();

  // 2. Palm & Hand Dorsal Plate (Vibrant Crimson Red)
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();

  const palmGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, palmScale * 0.15,
    palmCenter.x, palmCenter.y, palmScale * 1.1
  );
  palmGrad.addColorStop(0, '#fb7185'); // highlight crimson
  palmGrad.addColorStop(0.55, '#e11d48'); // classic spider-red
  palmGrad.addColorStop(1, '#9f1239'); // deep shadow red
  ctx.fillStyle = palmGrad;
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(3, palmScale * 0.06);
  ctx.stroke();

  // Navy Blue Side Panel
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.lineTo(lerpPx(pts[17], palmCenter, 0.4).x, lerpPx(pts[17], palmCenter, 0.4).y);
  ctx.closePath();
  ctx.fillStyle = '#1e3a8a';
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Fingers (Anatomical Segments with Charcoal Seams)
  const fingers = [
    [1, 2, 3, 4],   // Thumb
    [5, 6, 7, 8],   // Index
    [9, 10, 11, 12],// Middle
    [13, 14, 15, 16],// Ring
    [17, 18, 19, 20] // Pinky
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.05 : fIdx === 4 ? 0.85 : 0.95;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.14);

      // Outer seam border
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = baseW * taper + 3.5;
      ctx.stroke();

      // Red glove fill
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#fb7185' : '#e11d48';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Knuckle seam line (not a huge circle)
      const mid = lerpPx(p1, p2, 0.5);
      const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const segPerp = { x: -Math.sin(segAngle), y: Math.cos(segAngle) };
      const seamHalfW = (baseW * taper) * 0.42;

      ctx.beginPath();
      ctx.moveTo(mid.x - segPerp.x * seamHalfW, mid.y - segPerp.y * seamHalfW);
      ctx.lineTo(mid.x + segPerp.x * seamHalfW, mid.y + segPerp.y * seamHalfW);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Finger Tip Pads
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 4. Dynamic Spider-Man Webbing on Palm
  const knucklePts = [pts[2], pts[5], pts[9], pts[13], pts[17]];
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = Math.max(1.5, palmScale * 0.035);

  // Radial web spokes connecting palm center to knuckles
  knucklePts.forEach(k => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // Cross web arcs curving toward palm center
  for (const fraction of [0.4, 0.72]) {
    for (let k = 0; k < knucklePts.length - 1; k++) {
      const pA = lerpPx(palmCenter, knucklePts[k], fraction);
      const pB = lerpPx(palmCenter, knucklePts[k + 1], fraction);
      const control = lerpPx(palmCenter, lerpPx(pA, pB, 0.5), 0.7);

      ctx.beginPath();
      ctx.moveTo(pA.x, pA.y);
      ctx.quadraticCurveTo(control.x, control.y, pB.x, pB.y);
      ctx.stroke();
    }
  }

  // 5. Stylized Spider Emblem in Palm
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(armAngle + Math.PI / 2);
  ctx.fillStyle = '#0f172a';

  // Spider Body & Head
  ctx.beginPath();
  ctx.ellipse(0, 0, palmScale * 0.08, palmScale * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -palmScale * 0.11, palmScale * 0.06, 0, Math.PI * 2);
  ctx.fill();

  // Spider Legs (4 pairs)
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.8, palmScale * 0.032);
  [-1, 1].forEach(dir => {
    for (let l = 0; l < 4; l++) {
      const yOff = (l - 1.5) * palmScale * 0.055;
      const kneeX = dir * palmScale * (0.16 + l * 0.03);
      const kneeY = yOff + (l < 2 ? -palmScale * 0.09 : palmScale * 0.09);
      const tipX = dir * palmScale * (0.24 + l * 0.02);
      const tipY = kneeY + (l < 2 ? -palmScale * 0.06 : palmScale * 0.07);

      ctx.beginPath();
      ctx.moveTo(0, yOff);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }
  });
  ctx.restore();

  // 6. Silver Chrome Web-Shooter at Wrist
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(armAngle);

  // Metallic bracelet band
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-palmScale * 0.18, -palmScale * 0.28, palmScale * 0.36, palmScale * 0.56, 5);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chrome nozzle
  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.roundRect(-palmScale * 0.08, -palmScale * 0.12, palmScale * 0.22, palmScale * 0.24, 4);
  ctx.fill();

  // Glowing Cyan Web-Trigger LED
  const pulse = Math.sin(time * 0.008) * 0.35 + 0.65;
  const ledGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, palmScale * 0.2);
  ledGlow.addColorStop(0, '#ffffff');
  ledGlow.addColorStop(0.35, '#38bdf8');
  ledGlow.addColorStop(0.8, 'rgba(6, 182, 212, 0.6)');
  ledGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');
  ctx.fillStyle = ledGlow;
  ctx.beginPath();
  ctx.arc(0, 0, palmScale * (0.12 + pulse * 0.06), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 7. Dynamic Web-Shooting Beam & Web-Net on Lock-In
  if (isLocking && holdProgress > 0) {
    const shootDist = palmScale * (1.5 + (holdProgress / 100) * 3.5);
    const targetX = middleKnuckle.x + Math.cos(armAngle) * shootDist;
    const targetY = middleKnuckle.y + Math.sin(armAngle) * shootDist;

    ctx.save();
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 16;

    // Glowing main web strand
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, palmScale * 0.05);
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();

    // Spiral / tensile web coil
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = 18;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const basePt = lerpPx(wrist, { x: targetX, y: targetY }, t);
      const wave = Math.sin(t * Math.PI * 6 + time * 0.02) * palmScale * 0.12 * (1 - t * 0.4);
      const wavePt = {
        x: basePt.x + perp.x * wave,
        y: basePt.y + perp.y * wave,
      };
      if (s === 0) ctx.moveTo(wavePt.x, wavePt.y);
      else ctx.lineTo(wavePt.x, wavePt.y);
    }
    ctx.stroke();

    // Web-Net Burst at the impact head
    const netRadius = palmScale * (0.3 + (holdProgress / 100) * 0.5);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(targetX, targetY, netRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    for (let w = 0; w < 6; w++) {
      const angle = (w * Math.PI) / 3 + time * 0.006;
      ctx.beginPath();
      ctx.moveTo(targetX, targetY);
      ctx.lineTo(targetX + Math.cos(angle) * netRadius, targetY + Math.sin(angle) * netRadius);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Label badge above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(225, 29, 72, 0.92)';
  ctx.beginPath();
  ctx.roundRect(middleKnuckle.x - 70, topY - 14, 140, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🕷️ SPIDER-MAN', middleKnuckle.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Thanos's Infinity Gauntlet (Right Side / Player 2)
 * Titan golden armor, segmented metal plates, and the 6 Canonical Infinity Stones:
 * - Mind Stone (Yellow - large diamond core in center of gauntlet)
 * - Power Stone (Purple - index knuckle)
 * - Space Stone (Blue - middle knuckle)
 * - Reality Stone (Red - ring knuckle)
 * - Soul Stone (Orange - pinky knuckle)
 * - Time Stone (Green - thumb knuckle)
 *
 * Polished, anatomically fitted armor with tight cosmic energy aura
 * and NO giant distorted bicycle-wheel covering the screen.
 */
export function drawThanosHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking: boolean,
  holdProgress: number,
  time = performance.now(),
  videoW = 1280,
  videoH = 720
) {
  if (!hand || hand.length < 21) return;

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.52);
  const fingerWidth = Math.max(12, palmScale * 0.28);

  // Arm/Hand orientation angle
  const armAngle = Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x);
  const perp = { x: -Math.sin(armAngle), y: Math.cos(armAngle) };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Heavy Titan Golden Bracer / Forearm Vambrace
  const vambraceLength = palmScale * 0.75;
  const vambraceBase = {
    x: wrist.x - Math.cos(armAngle) * vambraceLength,
    y: wrist.y - Math.sin(armAngle) * vambraceLength,
  };
  const vambraceW = palmScale * 0.52;

  ctx.beginPath();
  ctx.moveTo(wrist.x + perp.x * vambraceW * 0.9, wrist.y + perp.y * vambraceW * 0.9);
  ctx.lineTo(wrist.x - perp.x * vambraceW * 0.9, wrist.y - perp.y * vambraceW * 0.9);
  ctx.lineTo(vambraceBase.x - perp.x * vambraceW, vambraceBase.y - perp.y * vambraceW);
  ctx.lineTo(vambraceBase.x + perp.x * vambraceW, vambraceBase.y + perp.y * vambraceW);
  ctx.closePath();

  const vambraceGrad = ctx.createLinearGradient(vambraceBase.x, vambraceBase.y, wrist.x, wrist.y);
  vambraceGrad.addColorStop(0, '#78350f'); // bronze shadow
  vambraceGrad.addColorStop(0.4, '#b45309'); // metallic bronze
  vambraceGrad.addColorStop(0.75, '#f59e0b'); // radiant gold
  vambraceGrad.addColorStop(1, '#fef08a'); // gold rim highlight
  ctx.fillStyle = vambraceGrad;
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = Math.max(3, palmScale * 0.06);
  ctx.stroke();

  // Inset Titan studs on cuff
  for (let s = -2; s <= 2; s++) {
    const studPos = {
      x: wrist.x + perp.x * (s * vambraceW * 0.35) - Math.cos(armAngle) * (palmScale * 0.2),
      y: wrist.y + perp.y * (s * vambraceW * 0.35) - Math.sin(armAngle) * (palmScale * 0.2),
    };
    ctx.beginPath();
    ctx.arc(studPos.x, studPos.y, palmScale * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // 2. Heavy Golden Gauntlet Dorsal Plate
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();

  const goldGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, palmScale * 0.1,
    palmCenter.x, palmCenter.y, palmScale * 1.2
  );
  goldGrad.addColorStop(0, '#fef08a'); // central gold gleam
  goldGrad.addColorStop(0.35, '#f59e0b'); // amber gold
  goldGrad.addColorStop(0.75, '#d97706'); // burnished bronze
  goldGrad.addColorStop(1, '#78350f'); // deep shadow bronze
  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = Math.max(3.5, palmScale * 0.07);
  ctx.stroke();

  // Engraved Carvings connecting knuckles to Mind Stone center
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.7)';
  ctx.lineWidth = Math.max(1.8, palmScale * 0.035);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach(target => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });

  // 3. Articulated Golden Armor Fingers
  const fingers = [
    [1, 2, 3, 4],   // Thumb
    [5, 6, 7, 8],   // Index
    [9, 10, 11, 12],// Middle
    [13, 14, 15, 16],// Ring
    [17, 18, 19, 20] // Pinky
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.1 : fIdx === 4 ? 0.88 : 0.98;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.13);

      // Deep bronze shadow border
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = baseW * taper + 4;
      ctx.stroke();

      // Golden metallic segment
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#fef08a' : '#f59e0b';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Articulated joint seam line
      const mid = lerpPx(p1, p2, 0.5);
      const segAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const segPerp = { x: -Math.sin(segAngle), y: Math.cos(segAngle) };
      const seamHalfW = (baseW * taper) * 0.44;

      ctx.beginPath();
      ctx.moveTo(mid.x - segPerp.x * seamHalfW, mid.y - segPerp.y * seamHalfW);
      ctx.lineTo(mid.x + segPerp.x * seamHalfW, mid.y + segPerp.y * seamHalfW);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Heavy Golden Finger Claws / Beveled Tips
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // 4. THE 6 CANONICAL INFINITY STONES
  const stoneData = [
    {
      name: 'Power Stone',
      color: '#c084fc',
      core: '#a855f7',
      glow: '#9333ea',
      pt: pts[5], // Index knuckle
      size: palmScale * 0.12,
    },
    {
      name: 'Space Stone',
      color: '#60a5fa',
      core: '#3b82f6',
      glow: '#2563eb',
      pt: pts[9], // Middle knuckle
      size: palmScale * 0.12,
    },
    {
      name: 'Reality Stone',
      color: '#f87171',
      core: '#ef4444',
      glow: '#dc2626',
      pt: pts[13], // Ring knuckle
      size: palmScale * 0.12,
    },
    {
      name: 'Soul Stone',
      color: '#fb923c',
      core: '#f97316',
      glow: '#ea580c',
      pt: pts[17], // Pinky knuckle
      size: palmScale * 0.11,
    },
    {
      name: 'Time Stone',
      color: '#34d399',
      core: '#10b981',
      glow: '#059669',
      pt: pts[2], // Thumb knuckle
      size: palmScale * 0.12,
    },
    {
      name: 'Mind Stone',
      color: '#fef08a',
      core: '#facc15',
      glow: '#eab308',
      pt: palmCenter, // Giant Center Mind Stone
      size: palmScale * 0.21,
      isCenter: true,
    },
  ];

  // Render each Infinity Stone with ornate golden bezel, gem facets, and radiant pulse
  stoneData.forEach(stone => {
    const isMind = stone.isCenter;
    const pulse = Math.sin(time * 0.008 + (isMind ? 0 : 2)) * 0.2 + 1.0;
    const r = stone.size * (isLocking ? pulse * 1.25 : pulse);

    ctx.save();
    // 1. Bronze & Gold Gem Socket Bezel
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Cosmic Ambient Glow
    const glowRad = ctx.createRadialGradient(
      stone.pt.x, stone.pt.y, r * 0.2,
      stone.pt.x, stone.pt.y, r * (isLocking ? 2.5 : 1.8)
    );
    glowRad.addColorStop(0, '#ffffff');
    glowRad.addColorStop(0.35, stone.color);
    glowRad.addColorStop(0.75, stone.glow);
    glowRad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glowRad;
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * (isLocking ? 2.5 : 1.8), 0, Math.PI * 2);
    ctx.fill();

    // 3. Faceted Gem Core
    ctx.beginPath();
    if (isMind) {
      // Mind Stone has distinctive diamond/oval shape
      ctx.ellipse(stone.pt.x, stone.pt.y, r * 1.15, r * 0.82, armAngle, 0, Math.PI * 2);
    } else {
      ctx.arc(stone.pt.x, stone.pt.y, r * 0.9, 0, Math.PI * 2);
    }
    ctx.fillStyle = stone.core;
    ctx.fill();

    // 4. White Diamond Specular Glint
    ctx.beginPath();
    ctx.arc(stone.pt.x - r * 0.26, stone.pt.y - r * 0.26, r * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  });

  // 5. TIGHT COSMIC GAUNTLET AURA ON LOCK-IN (Clean, no huge bicycle wheel!)
  if (isLocking && holdProgress > 0) {
    const surgeRadius = palmScale * (0.65 + (holdProgress / 100) * 0.45);
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = Math.max(3, palmScale * 0.05);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 18;

    // Tight Cosmic Energy Halo around Gauntlet Carapace
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, surgeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric shimmering golden pulse
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, surgeRadius * 1.25, 0, Math.PI * 2);
    ctx.stroke();

    // Crackling Cosmic Lightning Arcs between knuckle stones and central Mind Stone
    for (let s = 0; s < 5; s++) {
      const kPt = stoneData[s].pt;
      ctx.beginPath();
      ctx.moveTo(palmCenter.x, palmCenter.y);
      const midX = lerpPx(palmCenter, kPt, 0.5).x + (Math.sin(time * 0.01 + s) * palmScale * 0.1);
      const midY = lerpPx(palmCenter, kPt, 0.5).y + (Math.cos(time * 0.01 + s) * palmScale * 0.1);
      ctx.lineTo(midX, midY);
      ctx.lineTo(kPt.x, kPt.y);
      ctx.strokeStyle = stoneData[s].color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(217, 119, 6, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 72, topY - 14, 144, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥊 THANOS GAUNTLET', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Wicked Witch's Hand
 * Eerie pale emerald/shadow skin, long sharp curved black witch claws,
 * glowing purple & emerald arcane runes, enchanted amethyst ring, and witch flame sparks!
 */
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

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.52);
  const fingerWidth = Math.max(8, palmScale * 0.22);
  const armAngle = Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x);
  const perp = { x: -Math.sin(armAngle), y: Math.cos(armAngle) };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Tattered Witch Sleeve (Dark Black/Purple Velvet)
  const sleeveLen = palmScale * 0.7;
  const sleeveBase = {
    x: wrist.x - Math.cos(armAngle) * sleeveLen,
    y: wrist.y - Math.sin(armAngle) * sleeveLen,
  };
  const sleeveW = palmScale * 0.5;

  ctx.beginPath();
  ctx.moveTo(wrist.x + perp.x * sleeveW * 0.85, wrist.y + perp.y * sleeveW * 0.85);
  ctx.lineTo(wrist.x - perp.x * sleeveW * 0.85, wrist.y - perp.y * sleeveW * 0.85);
  ctx.lineTo(sleeveBase.x - perp.x * sleeveW, sleeveBase.y - perp.y * sleeveW);
  ctx.lineTo(sleeveBase.x + perp.x * sleeveW, sleeveBase.y + perp.y * sleeveW);
  ctx.closePath();

  const sleeveGrad = ctx.createLinearGradient(sleeveBase.x, sleeveBase.y, wrist.x, wrist.y);
  sleeveGrad.addColorStop(0, '#09090b');
  sleeveGrad.addColorStop(0.7, '#1e1b4b');
  sleeveGrad.addColorStop(1, '#581c87');
  ctx.fillStyle = sleeveGrad;
  ctx.fill();
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Pale Emerald Witch Skin Palm Base
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();

  const skinGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, palmScale * 0.1,
    palmCenter.x, palmCenter.y, palmScale * 1.15
  );
  skinGrad.addColorStop(0, '#a7f3d0');
  skinGrad.addColorStop(0.45, '#34d399');
  skinGrad.addColorStop(0.85, '#059669');
  skinGrad.addColorStop(1, '#064e3b');
  ctx.fillStyle = skinGrad;
  ctx.fill();
  ctx.strokeStyle = '#022c22';
  ctx.lineWidth = Math.max(2.5, palmScale * 0.05);
  ctx.stroke();

  // Swirling Witchcraft Arcane Glyph in Palm Center
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(time * 0.002);
  ctx.strokeStyle = 'rgba(167, 243, 208, 0.65)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, palmScale * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  for (let r = 0; r < 5; r++) {
    const a = (r * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * palmScale * 0.24, Math.sin(a) * palmScale * 0.24);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Slender Witch Fingers with Long Obsidian Claws
  const fingers = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.0 : fIdx === 4 ? 0.82 : 0.92;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.16);

      // Dark shadow edge
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = baseW * taper + 3;
      ctx.stroke();

      // Pale green witch skin segment
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#6ee7b7' : '#34d399';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Knuckle wrinkle ring
      const mid = lerpPx(p1, p2, 0.5);
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseW * taper * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = '#065f46';
      ctx.fill();
    }

    // Long Curved Sharp Witch Obsidian Claw
    const tip = pts[chain[chain.length - 1]];
    const prevTip = pts[chain[chain.length - 2]];
    const tipAngle = Math.atan2(tip.y - prevTip.y, tip.x - prevTip.x);
    const clawLen = baseW * 1.6;

    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(tipAngle);

    // Sharp curved claw
    ctx.beginPath();
    ctx.moveTo(-baseW * 0.4, -baseW * 0.35);
    ctx.lineTo(clawLen, 0); // sharp tip
    ctx.lineTo(-baseW * 0.4, baseW * 0.35);
    ctx.closePath();
    ctx.fillStyle = '#09090b';
    ctx.fill();

    // Glowing poison-green claw tip
    ctx.beginPath();
    ctx.arc(clawLen * 0.75, 0, baseW * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#4ade80';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.restore();
  });

  // 4. Witchcraft Rings on Index & Ring Knuckles
  [pts[5], pts[13]].forEach((kPt, idx) => {
    ctx.beginPath();
    ctx.arc(kPt.x, kPt.y, fingerWidth * 0.65, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1b4b';
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Amethyst gem core
    ctx.beginPath();
    ctx.arc(kPt.x, kPt.y, fingerWidth * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = idx === 0 ? '#c084fc' : '#34d399';
    ctx.fill();
  });

  // Witch Pop Aura / Magic Flames on action
  if (isLocking && holdProgress > 0) {
    const auraR = palmScale * (0.6 + (holdProgress / 100) * 0.5);
    ctx.save();
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, auraR, 0, Math.PI * 2);
    ctx.stroke();

    // Emerald magic flame sparks
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5 + time * 0.007;
      const fx = palmCenter.x + Math.cos(a) * auraR;
      const fy = palmCenter.y + Math.sin(a) * auraR;
      ctx.beginPath();
      ctx.arc(fx, fy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#a7f3d0';
      ctx.fill();
    }
    ctx.restore();
  }

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(5, 150, 105, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 65, topY - 14, 130, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#a7f3d0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🧙‍♀️ WICKED WITCH', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Incredible Hulk's Hand
 * Massive muscular gamma-green hand, heavy knuckles, pulsing neon-lime veins,
 * torn purple superhero wristband, and earth-shattering shockwave punch!
 */
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

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(34, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.5);
  const fingerWidth = Math.max(14, palmScale * 0.36); // Massive Hulk fingers!
  const armAngle = Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x);
  const perp = { x: -Math.sin(armAngle), y: Math.cos(armAngle) };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Torn Purple Superhero Wristband / Fabric
  const bandLen = palmScale * 0.65;
  const bandBase = {
    x: wrist.x - Math.cos(armAngle) * bandLen,
    y: wrist.y - Math.sin(armAngle) * bandLen,
  };
  const bandW = palmScale * 0.58;

  ctx.beginPath();
  ctx.moveTo(wrist.x + perp.x * bandW, wrist.y + perp.y * bandW);
  ctx.lineTo(wrist.x - perp.x * bandW, wrist.y - perp.y * bandW);
  ctx.lineTo(bandBase.x - perp.x * bandW * 1.1, bandBase.y - perp.y * bandW * 1.1);
  ctx.lineTo(bandBase.x + perp.x * bandW * 1.1, bandBase.y + perp.y * bandW * 1.1);
  ctx.closePath();

  const bandGrad = ctx.createLinearGradient(bandBase.x, bandBase.y, wrist.x, wrist.y);
  bandGrad.addColorStop(0, '#581c87');
  bandGrad.addColorStop(0.5, '#7e22ce');
  bandGrad.addColorStop(1, '#a855f7');
  ctx.fillStyle = bandGrad;
  ctx.fill();
  ctx.strokeStyle = '#3b0764';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2. Heavy Muscular Gamma-Green Dorsal Palm
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();

  const hulkGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, palmScale * 0.1,
    palmCenter.x, palmCenter.y, palmScale * 1.3
  );
  hulkGrad.addColorStop(0, '#86efac'); // bright gamma highlight
  hulkGrad.addColorStop(0.35, '#22c55e'); // classic hulk green
  hulkGrad.addColorStop(0.75, '#16a34a'); // deep muscle green
  hulkGrad.addColorStop(1, '#14532d'); // shadow green
  ctx.fillStyle = hulkGrad;
  ctx.fill();
  ctx.strokeStyle = '#052e16';
  ctx.lineWidth = Math.max(4, palmScale * 0.08);
  ctx.stroke();

  // Pulsing Neon-Lime Gamma Veins along back of hand
  ctx.strokeStyle = 'rgba(190, 242, 100, 0.75)';
  ctx.lineWidth = Math.max(2, palmScale * 0.04);
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach(k => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    const mid = lerpPx(palmCenter, k, 0.5);
    ctx.lineTo(mid.x + (Math.random() - 0.5) * 4, mid.y + (Math.random() - 0.5) * 4);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // 3. Bulky Heavy Gamma Fingers
  const fingers = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.2 : fIdx === 4 ? 0.95 : 1.08;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.1);

      // Dark shadow border
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = baseW * taper + 4;
      ctx.stroke();

      // Green muscular finger segment
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#4ade80' : '#22c55e';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Heavy knuckle wrinkle
      const mid = lerpPx(p1, p2, 0.5);
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseW * taper * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#166534';
      ctx.fill();
    }

    // Heavy blunt fingernails
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#bbf7d0';
    ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // Gamma Smash Aura on Action
  if (isLocking && holdProgress > 0) {
    const smashR = palmScale * (0.8 + (holdProgress / 100) * 0.6);
    ctx.save();
    ctx.strokeStyle = '#84cc16';
    ctx.lineWidth = Math.max(3.5, palmScale * 0.07);
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(palmCenter.x, palmCenter.y, smashR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(22, 101, 52, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 65, topY - 14, 130, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#86efac';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🟢 THE HULK', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Iron Man's Repulsor Glove
 * Hot rod crimson armor, gold titanium knuckles, and glowing cyan/white palm Repulsor Core!
 */
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

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.52);
  const fingerWidth = Math.max(11, palmScale * 0.27);
  const armAngle = Math.atan2(middleKnuckle.y - wrist.y, middleKnuckle.x - wrist.x);
  const perp = { x: -Math.sin(armAngle), y: Math.cos(armAngle) };

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Forearm Stark Vambrace (Hot Rod Red & Titanium Gold)
  const vambraceLen = palmScale * 0.72;
  const vambraceBase = {
    x: wrist.x - Math.cos(armAngle) * vambraceLen,
    y: wrist.y - Math.sin(armAngle) * vambraceLen,
  };
  const vambraceW = palmScale * 0.5;

  ctx.beginPath();
  ctx.moveTo(wrist.x + perp.x * vambraceW, wrist.y + perp.y * vambraceW);
  ctx.lineTo(wrist.x - perp.x * vambraceW, wrist.y - perp.y * vambraceW);
  ctx.lineTo(vambraceBase.x - perp.x * vambraceW * 0.95, vambraceBase.y - perp.y * vambraceW * 0.95);
  ctx.lineTo(vambraceBase.x + perp.x * vambraceW * 0.95, vambraceBase.y + perp.y * vambraceW * 0.95);
  ctx.closePath();

  const redGrad = ctx.createLinearGradient(vambraceBase.x, vambraceBase.y, wrist.x, wrist.y);
  redGrad.addColorStop(0, '#7f1d1d');
  redGrad.addColorStop(0.5, '#dc2626');
  redGrad.addColorStop(1, '#ef4444');
  ctx.fillStyle = redGrad;
  ctx.fill();
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 2. Armor Dorsal Plate (Crimson with Gold Titanium Inset)
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();
  ctx.fillStyle = '#b91c1c';
  ctx.fill();
  ctx.strokeStyle = '#450a0a';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // 3. Gold Titanium Armored Fingers
  const fingers = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.1 : fIdx === 4 ? 0.88 : 0.98;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.13);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = baseW * taper + 4;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 1 ? '#ef4444' : '#facc15';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();
    }

    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // 4. GLOWING ARC REPULSOR IN PALM CENTER
  const repulsorR = palmScale * 0.26;
  const pulse = Math.sin(time * 0.01) * 0.2 + 0.8;

  // Outer repulsor metallic bezel
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repulsorR * 1.35, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Cyan & White Arc Light Glow
  const glowGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, repulsorR * 0.15,
    palmCenter.x, palmCenter.y, repulsorR * (isLocking ? 3.0 : 2.0)
  );
  glowGrad.addColorStop(0, '#ffffff');
  glowGrad.addColorStop(0.3, '#38bdf8');
  glowGrad.addColorStop(0.7, 'rgba(14, 165, 233, 0.6)');
  glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repulsorR * (isLocking ? 3.0 : 2.0), 0, Math.PI * 2);
  ctx.fill();

  // Core repulsor lens
  ctx.beginPath();
  ctx.arc(palmCenter.x, palmCenter.y, repulsorR * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#0284c7';
  ctx.shadowBlur = 18 * pulse;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(185, 28, 28, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 65, topY - 14, 130, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#fde047';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🤖 IRON MAN', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Frost Mage / Elsa's Ice Crystalline Hand
 * Glacial cyan crystal plates, icicle claw tips, snowflake runes, and swirling winter frost!
 */
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

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.52);
  const fingerWidth = Math.max(9, palmScale * 0.24);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Glacial Ice Palm
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();

  const iceGrad = ctx.createRadialGradient(
    palmCenter.x, palmCenter.y, palmScale * 0.1,
    palmCenter.x, palmCenter.y, palmScale * 1.2
  );
  iceGrad.addColorStop(0, '#ffffff');
  iceGrad.addColorStop(0.35, '#bae6fd');
  iceGrad.addColorStop(0.75, '#38bdf8');
  iceGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = iceGrad;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Ice Snowflake Sigil in Palm
  ctx.save();
  ctx.translate(palmCenter.x, palmCenter.y);
  ctx.rotate(time * 0.003);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (let s = 0; s < 6; s++) {
    const a = (s * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * palmScale * 0.3, Math.sin(a) * palmScale * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  // Ice Fingers with Sharp Icicle Tips
  const fingers = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ];

  fingers.forEach((chain, fIdx) => {
    const baseW = fingerWidth * (fIdx === 0 ? 1.05 : 0.95);

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.14);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = baseW * taper + 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();
    }

    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fill();
  });

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(2, 132, 199, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 65, topY - 14, 130, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('❄️ FROST MAGE', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Cyberpunk / Laser Mecha Hand
 * Dark graphite chassis with illuminated neon cyan & magenta laser circuit lines!
 */
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

  const pts = hand.map(p => toPx(p, cw, ch, videoW, videoH));
  const wrist = pts[0];
  const middleKnuckle = pts[9];
  const palmScale = Math.max(30, distPx(wrist, middleKnuckle));
  const palmCenter = lerpPx(wrist, middleKnuckle, 0.52);
  const fingerWidth = Math.max(10, palmScale * 0.25);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Mecha Palm Chassis
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[1].x, pts[1].y);
  ctx.lineTo(pts[2].x, pts[2].y);
  ctx.lineTo(pts[5].x, pts[5].y);
  ctx.lineTo(pts[9].x, pts[9].y);
  ctx.lineTo(pts[13].x, pts[13].y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.closePath();
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Neon Circuit Traces
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 2;
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach(k => {
    ctx.beginPath();
    ctx.moveTo(palmCenter.x, palmCenter.y);
    ctx.lineTo(k.x, k.y);
    ctx.stroke();
  });

  // Robotic Jointed Fingers
  const fingers = [
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9, 10, 11, 12],
    [13, 14, 15, 16],
    [17, 18, 19, 20]
  ];

  fingers.forEach((chain) => {
    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = fingerWidth * 0.9 + 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = fingerWidth * 0.9;
      ctx.stroke();
    }

    // Laser Emitter Tip
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, fingerWidth * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 12;
    ctx.fill();
  });

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 65, topY - 14, 130, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡ CYBER MECHA', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

export type HandCharacterType = 'spiderman' | 'thanos' | 'witch' | 'hulk' | 'ironman' | 'frost' | 'cyberpunk';

/**
 * Universal character hand renderer for Bubble Pop & Yoga Quiz
 */
export function drawCharacterHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  character: HandCharacterType = 'spiderman',
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
      drawSpidermanHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'thanos':
      drawThanosHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'witch':
      drawWitchHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'hulk':
      drawHulkHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'ironman':
      drawIronManHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'frost':
      drawFrostMageHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    case 'cyberpunk':
      drawCyberpunkHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
      break;
    default:
      drawSpidermanHand(ctx, hand, cw, ch, isLocking, holdProgress, time, videoW, videoH);
  }
}

/**
 * Main dispatcher: automatically applies Spider-Man on Left Side
 * and Thanos on Right Side based on hand position and active players!
 */
export function drawSuperheroHands({
  ctx,
  hands,
  cw,
  ch,
  isTwoPlayers,
  playerDetections,
  time = performance.now(),
  videoW = 1280,
  videoH = 720,
}: SuperheroHandOptions) {
  if (!hands || hands.length === 0) return;

  hands.forEach(hand => {
    if (!hand || hand.length < 21) return;

    // Check hand center position on screen (0.0 = left edge, 1.0 = right edge)
    const palmX = hand[9]?.x ?? hand[0]?.x ?? 0.5;
    const isLeftSide = palmX < 0.5;

    // Determine lock-in progress for the matching zone
    const playerIdx = isLeftSide ? 0 : 1;
    const detection = playerDetections[playerIdx] || { holdProgress: 0, matchedOptionIdx: null };
    const isLocking = detection.matchedOptionIdx !== null && detection.holdProgress > 0;

    if (isLeftSide) {
      // Left side of the screen: SPIDER-MAN HAND
      drawSpidermanHand(ctx, hand, cw, ch, isLocking, detection.holdProgress, time, videoW, videoH);
    } else {
      // Right side of the screen: THANOS INFINITY GAUNTLET HAND
      drawThanosHand(ctx, hand, cw, ch, isLocking, detection.holdProgress, time, videoW, videoH);
    }
  });
}
