/**
 * Superhero Hands Canvas Renderer for Camera Mode
 * Left Side: Spider-Man's Web-Shooter Hand (Red & Navy suit, Webbing, Web-Shooter)
 * Right Side: Thanos's Infinity Gauntlet (Golden Titan Armor, 6 Glowing Infinity Stones)
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
}

/** Helper to convert normalized landmark to canvas pixels */
function toPx(lm: Landmark, cw: number, ch: number) {
  return { x: lm.x * cw, y: lm.y * ch };
}

/** Euclidean distance between two pixel points */
function distPx(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

/** Interpolate between two pixel points */
function lerpPx(p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) {
  return {
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t,
  };
}

/**
 * Draw Spider-Man's Hand (Left Side / Player 1)
 * High-tech comic-accurate red glove, black web grid, navy side plates,
 * silver web-shooter at wrist, and live web-shooting effects on lock-in!
 */
export function drawSpidermanHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking: boolean,
  holdProgress: number,
  time = performance.now()
) {
  if (!hand || hand.length < 21) return;

  const pts = hand.map(p => toPx(p, cw, ch));
  const wrist = pts[0];
  const palmCenter = pts[9];
  const palmScale = Math.max(30, distPx(wrist, palmCenter));
  const fingerWidth = Math.max(10, palmScale * 0.28);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Palm Base (Deep Red Marvel Spidey Suit)
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
    palmCenter.x, palmCenter.y, palmScale * 0.2,
    palmCenter.x, palmCenter.y, palmScale * 1.3
  );
  palmGrad.addColorStop(0, '#f43f5e'); // vibrant crimson highlight
  palmGrad.addColorStop(0.65, '#e11d48'); // Spider-Man red
  palmGrad.addColorStop(1, '#9f1239'); // deep shadow red

  ctx.fillStyle = palmGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(3, palmScale * 0.08);
  ctx.strokeStyle = '#0f172a'; // dark charcoal suit seam
  ctx.stroke();

  // 2. Navy Blue Side Accents (Classic Spider-Man costume motif)
  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.lineTo(lerpPx(pts[17], palmCenter, 0.35).x, lerpPx(pts[17], palmCenter, 0.35).y);
  ctx.lineTo(wrist.x, wrist.y);
  ctx.fillStyle = '#1e3a8a'; // iconic Spider-Man navy blue
  ctx.fill();

  // 3. Spider-Man Fingers (Segmented red glove with knuckle armor)
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

    // Draw finger segment lines with tapered red glove armor
    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.16);

      // Black outer seam
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = baseW * taper + 4;
      ctx.stroke();

      // Red glove fill
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#fb7185' : '#e11d48';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Knuckle web seam rings
      const mid = lerpPx(p1, p2, 0.5);
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseW * taper * 0.45, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Finger Tip Pads (black/red grip pad with spider-grip texture)
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#be123c';
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // 4. Iconic Spider-Web Grid on Palm
  const palmWebCenter = lerpPx(wrist, palmCenter, 0.45);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.lineWidth = Math.max(1.5, palmScale * 0.035);

  // Concentric spider web arcs
  for (let r = 0.25; r <= 0.85; r += 0.3) {
    ctx.beginPath();
    ctx.arc(palmWebCenter.x, palmWebCenter.y, palmScale * r, -Math.PI * 0.85, Math.PI * 0.15);
    ctx.stroke();
  }

  // Radial web spokes connecting to knuckles
  [pts[2], pts[5], pts[9], pts[13], pts[17]].forEach(target => {
    ctx.beginPath();
    ctx.moveTo(palmWebCenter.x, palmWebCenter.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  });

  // 5. Stylized Spider Emblem in Palm
  ctx.save();
  ctx.translate(palmWebCenter.x, palmWebCenter.y);
  ctx.fillStyle = '#0f172a';
  // Spider Body
  ctx.beginPath();
  ctx.ellipse(0, 0, palmScale * 0.11, palmScale * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -palmScale * 0.15, palmScale * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // 8 Spider Legs
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(2, palmScale * 0.04);
  const legDirs = [-1, 1];
  legDirs.forEach(dir => {
    for (let l = 0; l < 4; l++) {
      ctx.beginPath();
      const yOffset = (l - 1.5) * palmScale * 0.07;
      ctx.moveTo(0, yOffset);
      const kneeX = dir * palmScale * (0.22 + l * 0.04);
      const kneeY = yOffset + (l < 2 ? -palmScale * 0.12 : palmScale * 0.12);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(dir * palmScale * (0.32 + l * 0.03), kneeY + (l < 2 ? -palmScale * 0.08 : palmScale * 0.1));
      ctx.stroke();
    }
  });
  ctx.restore();

  // 6. Wrist Web-Shooter Mechanism (Metallic silver with glowing cyan nozzle)
  const shooterAngle = Math.atan2(palmCenter.y - wrist.y, palmCenter.x - wrist.x);
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.rotate(shooterAngle);

  // Metallic bracelet base
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.roundRect(-palmScale * 0.35, -palmScale * 0.18, palmScale * 0.7, palmScale * 0.36, 6);
  ctx.fill();
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Chrome cartridge nozzle
  ctx.fillStyle = '#cbd5e1';
  ctx.beginPath();
  ctx.roundRect(-palmScale * 0.15, -palmScale * 0.1, palmScale * 0.3, palmScale * 0.2, 4);
  ctx.fill();

  // Glowing Web Fluid Trigger (Cyan LED)
  const pulse = 0.5 + Math.sin(time * 0.008) * 0.5;
  const cyanGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, palmScale * 0.25);
  cyanGlow.addColorStop(0, '#ffffff');
  cyanGlow.addColorStop(0.3, '#38bdf8');
  cyanGlow.addColorStop(0.8, 'rgba(6, 182, 212, 0.7)');
  cyanGlow.addColorStop(1, 'rgba(6, 182, 212, 0)');

  ctx.fillStyle = cyanGlow;
  ctx.beginPath();
  ctx.arc(0, 0, palmScale * (0.16 + pulse * 0.08), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 7. Interactive Web Shooters & Sparks when Locking In
  if (isLocking && holdProgress > 0) {
    const webLength = (holdProgress / 100) * palmScale * 3.8;
    const shootDirX = Math.cos(shooterAngle);
    const shootDirY = Math.sin(shooterAngle);

    // Glowing Web Fluid Strands
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = Math.max(2.5, palmScale * 0.06);
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 18;

    for (let s = -2; s <= 2; s++) {
      const spread = s * 0.18;
      const tx = wrist.x + Math.cos(shooterAngle + spread) * webLength;
      const ty = wrist.y + Math.sin(shooterAngle + spread) * webLength;
      ctx.beginPath();
      ctx.moveTo(wrist.x, wrist.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Web cross-bars
      if (webLength > palmScale * 0.8) {
        const mx = wrist.x + Math.cos(shooterAngle + spread) * (webLength * 0.65);
        const my = wrist.y + Math.sin(shooterAngle + spread) * (webLength * 0.65);
        ctx.beginPath();
        ctx.arc(mx, my, 4 + Math.sin(time * 0.02 + s) * 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Label tag above hand
  ctx.save();
  const topY = Math.min(...pts.map(p => p.y)) - 24;
  ctx.fillStyle = 'rgba(225, 29, 72, 0.95)';
  ctx.beginPath();
  ctx.roundRect(palmCenter.x - 72, topY - 14, 144, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🕷️ SPIDER-MAN', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
}

/**
 * Draw Thanos's Hand (Right Side / Player 2)
 * Titan golden-bronze armor, segmented metal plates, and the 6 Canonical Infinity Stones:
 * - Mind Stone (Yellow - large in center of palm)
 * - Power Stone (Purple - index knuckle)
 * - Space Stone (Blue - middle knuckle)
 * - Reality Stone (Red - ring knuckle)
 * - Soul Stone (Orange - pinky knuckle)
 * - Time Stone (Green - thumb knuckle)
 * With cosmic energy lightning and intense glow effects!
 */
export function drawThanosHand(
  ctx: CanvasRenderingContext2D,
  hand: Landmark[],
  cw: number,
  ch: number,
  isLocking: boolean,
  holdProgress: number,
  time = performance.now()
) {
  if (!hand || hand.length < 21) return;

  const pts = hand.map(p => toPx(p, cw, ch));
  const wrist = pts[0];
  const palmCenter = pts[9];
  const palmScale = Math.max(30, distPx(wrist, palmCenter));
  const fingerWidth = Math.max(12, palmScale * 0.32);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Palm & Gauntlet Base (Heavy Titan Gold Armor)
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
    palmCenter.x, palmCenter.y, palmScale * 1.4
  );
  goldGrad.addColorStop(0, '#fef08a'); // bright gold highlight
  goldGrad.addColorStop(0.3, '#f59e0b'); // amber gold
  goldGrad.addColorStop(0.7, '#d97706'); // deep metallic bronze
  goldGrad.addColorStop(1, '#78350f'); // shadow bronze

  ctx.fillStyle = goldGrad;
  ctx.fill();
  ctx.lineWidth = Math.max(3.5, palmScale * 0.09);
  ctx.strokeStyle = '#451a03'; // deep carved bronze border
  ctx.stroke();

  // Ancient Titan Carvings & Armor Insets
  ctx.strokeStyle = 'rgba(120, 53, 15, 0.75)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[2].x, pts[2].y);
  ctx.lineTo(palmCenter.x, palmCenter.y);
  ctx.lineTo(pts[17].x, pts[17].y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(wrist.x, wrist.y);
  ctx.lineTo(palmCenter.x, palmCenter.y);
  ctx.stroke();

  // 2. Heavy Articulated Golden Gauntlet Fingers
  const fingers = [
    [1, 2, 3, 4],   // Thumb
    [5, 6, 7, 8],   // Index
    [9, 10, 11, 12],// Middle
    [13, 14, 15, 16],// Ring
    [17, 18, 19, 20] // Pinky
  ];

  fingers.forEach((chain, fIdx) => {
    const fScale = fIdx === 0 ? 1.15 : fIdx === 4 ? 0.9 : 1.0;
    const baseW = fingerWidth * fScale;

    for (let i = 0; i < chain.length - 1; i++) {
      const p1 = pts[chain[i]];
      const p2 = pts[chain[i + 1]];
      const taper = 1.0 - (i * 0.14);

      // Dark bronze armor bevel
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = baseW * taper + 4;
      ctx.stroke();

      // Gold articulated segment
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = i === 2 ? '#fde047' : '#f59e0b';
      ctx.lineWidth = baseW * taper;
      ctx.stroke();

      // Segment joint band (golden ring bevel)
      const mid = lerpPx(p1, p2, 0.5);
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, baseW * taper * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = '#b45309';
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Heavy Golden Finger Claws / Beveled Tips
    const tip = pts[chain[chain.length - 1]];
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, baseW * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = '#fde047';
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });

  // 3. Wrist Gauntlet Cuff Band with Heavy Gold Plates
  ctx.save();
  ctx.translate(wrist.x, wrist.y);
  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.roundRect(-palmScale * 0.42, -palmScale * 0.16, palmScale * 0.84, palmScale * 0.32, 8);
  ctx.fill();
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inset Bronze Studs
  for (let s = -2; s <= 2; s++) {
    ctx.beginPath();
    ctx.arc(s * (palmScale * 0.16), 0, palmScale * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // 4. THE 6 INFINITY STONES
  // Stone definitions with canonical colors, positions, and glows
  const stoneData = [
    {
      name: 'Power Stone',
      color: '#c084fc',
      core: '#a855f7',
      glow: '#9333ea',
      pt: pts[5], // Index knuckle
      size: palmScale * 0.13,
    },
    {
      name: 'Space Stone',
      color: '#60a5fa',
      core: '#3b82f6',
      glow: '#2563eb',
      pt: pts[9], // Middle knuckle
      size: palmScale * 0.13,
    },
    {
      name: 'Reality Stone',
      color: '#f87171',
      core: '#ef4444',
      glow: '#dc2626',
      pt: pts[13], // Ring knuckle
      size: palmScale * 0.13,
    },
    {
      name: 'Soul Stone',
      color: '#fb923c',
      core: '#f97316',
      glow: '#ea580c',
      pt: pts[17], // Pinky knuckle
      size: palmScale * 0.12,
    },
    {
      name: 'Time Stone',
      color: '#34d399',
      core: '#10b981',
      glow: '#059669',
      pt: pts[2], // Thumb knuckle
      size: palmScale * 0.13,
    },
    {
      name: 'Mind Stone',
      color: '#fef08a',
      core: '#facc15',
      glow: '#eab308',
      pt: lerpPx(wrist, palmCenter, 0.52), // Giant Center Palm Stone
      size: palmScale * 0.22, // Largest Stone
      isCenter: true,
    },
  ];

  // Draw energy veins connecting knuckle stones to central Mind Stone
  const centerPt = stoneData[5].pt;
  ctx.save();
  ctx.lineWidth = Math.max(1.5, palmScale * 0.03);
  for (let s = 0; s < 5; s++) {
    const kPt = stoneData[s].pt;
    const pulseOffset = Math.sin(time * 0.007 + s) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(254, 240, 138, ${0.45 * pulseOffset})`;
    ctx.beginPath();
    ctx.moveTo(kPt.x, kPt.y);
    ctx.lineTo(centerPt.x, centerPt.y);
    ctx.stroke();
  }
  ctx.restore();

  // Render each Infinity Stone with jewel socket, facets, and cosmic flare
  stoneData.forEach(stone => {
    const isMind = stone.isCenter;
    const pulse = Math.sin(time * 0.009 + (isMind ? 0 : 2)) * 0.25 + 1.0;
    const r = stone.size * (isLocking ? pulse * 1.25 : pulse);

    ctx.save();
    // 1. Bronze Gem Socket Bezel
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * 1.35, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 2. Radiant Outer Cosmic Glow
    const glowRad = ctx.createRadialGradient(
      stone.pt.x, stone.pt.y, r * 0.2,
      stone.pt.x, stone.pt.y, r * (isLocking ? 2.8 : 2.0)
    );
    glowRad.addColorStop(0, '#ffffff');
    glowRad.addColorStop(0.3, stone.color);
    glowRad.addColorStop(0.7, stone.glow);
    glowRad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = glowRad;
    ctx.beginPath();
    ctx.arc(stone.pt.x, stone.pt.y, r * (isLocking ? 2.8 : 2.0), 0, Math.PI * 2);
    ctx.fill();

    // 3. Faceted Gem Core
    ctx.beginPath();
    if (isMind) {
      // Mind Stone is distinct diamond/oval shape
      ctx.ellipse(stone.pt.x, stone.pt.y, r * 1.15, r * 0.85, Math.PI * 0.25, 0, Math.PI * 2);
    } else {
      ctx.arc(stone.pt.x, stone.pt.y, r * 0.9, 0, Math.PI * 2);
    }
    ctx.fillStyle = stone.core;
    ctx.fill();

    // 4. Sparkling White Specular Glint
    ctx.beginPath();
    ctx.arc(stone.pt.x - r * 0.28, stone.pt.y - r * 0.28, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  });

  // 5. Cosmic Infinity Surge when Locking In
  if (isLocking && holdProgress > 0) {
    const surgeRadius = palmScale * (1.2 + (holdProgress / 100) * 1.4);
    ctx.save();
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
    ctx.lineWidth = Math.max(3, palmScale * 0.07);
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 24;

    // Cosmic Energy Shockwave Rings
    ctx.beginPath();
    ctx.arc(centerPt.x, centerPt.y, surgeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Electric Cosmic Lightning Arcs
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + time * 0.005;
      const lx = centerPt.x + Math.cos(angle) * surgeRadius;
      const ly = centerPt.y + Math.sin(angle) * surgeRadius;
      ctx.beginPath();
      ctx.moveTo(centerPt.x, centerPt.y);
      const mid1x = lerpPx(centerPt, { x: lx, y: ly }, 0.45).x + (Math.random() - 0.5) * 20;
      const mid1y = lerpPx(centerPt, { x: lx, y: ly }, 0.45).y + (Math.random() - 0.5) * 20;
      ctx.lineTo(mid1x, mid1y);
      ctx.lineTo(lx, ly);
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
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🥊 THANOS GAUNTLET', palmCenter.x, topY);
  ctx.restore();

  ctx.restore();
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
      drawSpidermanHand(ctx, hand, cw, ch, isLocking, detection.holdProgress, time);
    } else {
      // Right side of the screen: THANOS INFINITY GAUNTLET HAND
      drawThanosHand(ctx, hand, cw, ch, isLocking, detection.holdProgress, time);
    }
  });
}
