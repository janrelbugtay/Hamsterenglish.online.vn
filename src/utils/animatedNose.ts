/**
 * Animated Nose Renderer for Bubble Pop Nose Tracker Mode
 * Renders authentic, high-fidelity animated noses directly over the player's face:
 * - 'real': Cute 3D Anatomical Sniffing Nose with nostrils, breathing & sniff puffs
 * - 'clown': Glossy bouncing red clown nose with squeaky squash-and-stretch
 * - 'rudolph': Glowing festive ruby beacon with fairy dust sparkle aura
 * - 'pig': Funny wiggling pink piggy snout with cartoon snort puffs
 * - 'cat': Cute wet button nose with twitching whiskers
 * - 'pinocchio': Wooden nose with funny extension animation
 */

export type NoseStyle = 'real' | 'clown' | 'rudolph' | 'pig' | 'cat' | 'pinocchio';

export interface AnimatedNoseOptions {
  ctx: CanvasRenderingContext2D;
  noseTip: { x: number; y: number };
  noseBridge?: { x: number; y: number };
  noseSize?: number;
  angle?: number;
  style?: NoseStyle;
  isPopping?: boolean;
  time?: number;
}

export function drawAnimatedNose({
  ctx,
  noseTip,
  noseBridge,
  noseSize = 36,
  angle = 0,
  style = 'real',
  isPopping = false,
  time = performance.now(),
}: AnimatedNoseOptions) {
  if (!noseTip || isNaN(noseTip.x) || isNaN(noseTip.y)) return;

  const R = Math.max(18, Math.min(65, noseSize));
  const breath = Math.sin(time * 0.005) * 0.06;
  const popScale = isPopping ? 1.35 : 1.0;
  const currentScale = (1.0 + breath) * popScale;

  ctx.save();
  ctx.translate(noseTip.x, noseTip.y);
  ctx.rotate(angle);
  ctx.scale(currentScale, currentScale);

  switch (style) {
    case 'real': {
      // 1. CUTE 3D ANATOMICAL SNIFFING NOSE
      // Nose bridge upper contour
      const bridgeH = R * 0.9;
      const bridgeW = R * 0.45;
      const bridgeGrad = ctx.createLinearGradient(0, -bridgeH, 0, 0);
      bridgeGrad.addColorStop(0, 'rgba(254, 215, 170, 0.4)');
      bridgeGrad.addColorStop(0.5, 'rgba(251, 146, 60, 0.6)');
      bridgeGrad.addColorStop(1, 'rgba(244, 114, 182, 0.85)');

      ctx.beginPath();
      ctx.moveTo(-bridgeW * 0.6, -bridgeH);
      ctx.lineTo(bridgeW * 0.6, -bridgeH);
      ctx.lineTo(bridgeW, 0);
      ctx.lineTo(-bridgeW, 0);
      ctx.closePath();
      ctx.fillStyle = bridgeGrad;
      ctx.fill();

      // Left & Right Nostril Shadows
      const nostrilW = R * 0.45;
      const nostrilH = R * 0.32;
      const nostrilOffset = R * 0.48;

      // Left Nostril
      ctx.beginPath();
      ctx.ellipse(-nostrilOffset, R * 0.12, nostrilW, nostrilH, -0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#451a03';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Right Nostril
      ctx.beginPath();
      ctx.ellipse(nostrilOffset, R * 0.12, nostrilW, nostrilH, 0.2, 0, Math.PI * 2);
      ctx.fillStyle = '#451a03';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Central Nose Bulb (Soft 3D sphere with rosy peach glow)
      const bulbGrad = ctx.createRadialGradient(-R * 0.18, -R * 0.18, R * 0.1, 0, 0, R * 0.7);
      bulbGrad.addColorStop(0, '#fff1ee'); // soft specular core
      bulbGrad.addColorStop(0.3, '#fbcfe8'); // rosy blush
      bulbGrad.addColorStop(0.7, '#f472b6'); // cute pink tone
      bulbGrad.addColorStop(1, '#db2777'); // soft shadow edge

      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.62, R * 0.52, 0, 0, Math.PI * 2);
      ctx.fillStyle = bulbGrad;
      ctx.shadowColor = 'rgba(219, 39, 119, 0.35)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Specular Shiny Tip Highlight
      ctx.beginPath();
      ctx.ellipse(-R * 0.18, -R * 0.16, R * 0.2, R * 0.14, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();

      // Animated Sniffing Air Puffs from Nostrils
      const sniffCycle = (time * 0.006) % 1;
      const sniffAlpha = (1 - sniffCycle) * 0.75;
      const sniffDist = R * (0.6 + sniffCycle * 0.7);

      ctx.strokeStyle = `rgba(255, 255, 255, ${sniffAlpha})`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';

      // Left sniff puff
      ctx.beginPath();
      ctx.moveTo(-nostrilOffset, R * 0.2);
      ctx.quadraticCurveTo(-nostrilOffset - sniffDist * 0.5, R * 0.4 + sniffDist, -nostrilOffset - sniffDist, R * 0.3 + sniffDist * 0.8);
      ctx.stroke();

      // Right sniff puff
      ctx.beginPath();
      ctx.moveTo(nostrilOffset, R * 0.2);
      ctx.quadraticCurveTo(nostrilOffset + sniffDist * 0.5, R * 0.4 + sniffDist, nostrilOffset + sniffDist, R * 0.3 + sniffDist * 0.8);
      ctx.stroke();

      // Extra pop burst swirls when popping a bubble
      if (isPopping) {
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.25, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'clown': {
      // 2. GLOSSY BOUNCING CLOWN NOSE
      const bounce = Math.sin(time * 0.01) * 0.08;
      const squishX = 1 + bounce;
      const squishY = 1 - bounce;
      ctx.scale(squishX, squishY);

      // Deep red glossy sphere
      const clownGrad = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
      clownGrad.addColorStop(0, '#ffffff'); // bright shine
      clownGrad.addColorStop(0.2, '#f87171');
      clownGrad.addColorStop(0.7, '#dc2626');
      clownGrad.addColorStop(1, '#7f1d1d');

      ctx.beginPath();
      ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = clownGrad;
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Bright white curved reflection gleam
      ctx.beginPath();
      ctx.arc(-R * 0.28, -R * 0.28, R * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Little secondary shine
      ctx.beginPath();
      ctx.arc(R * 0.25, R * 0.25, R * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();

      if (isPopping) {
        // Comic spring "SQUEAK / BOING" shockwave rings
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, R * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'rudolph': {
      // 3. RUDOLPH GLOWING BEACON NOSE
      const pulse = Math.sin(time * 0.009) * 0.25 + 0.75;

      // Outer golden-red radiant halo
      const haloGrad = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 2.2);
      haloGrad.addColorStop(0, 'rgba(254, 240, 138, 0.9)');
      haloGrad.addColorStop(0.35, 'rgba(239, 68, 68, 0.75)');
      haloGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.3)');
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Glowing core ruby gem
      const rubyGrad = ctx.createRadialGradient(-R * 0.25, -R * 0.25, R * 0.1, 0, 0, R * 0.9);
      rubyGrad.addColorStop(0, '#ffffff');
      rubyGrad.addColorStop(0.3, '#fb7185');
      rubyGrad.addColorStop(0.75, '#e11d48');
      rubyGrad.addColorStop(1, '#9f1239');

      ctx.beginPath();
      ctx.arc(0, 0, R * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = rubyGrad;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 24 * pulse;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Floating fairy stardust sparkles
      for (let s = 0; s < 4; s++) {
        const spAngle = (s * Math.PI) / 2 + time * 0.003;
        const spDist = R * (1.1 + Math.sin(time * 0.008 + s) * 0.25);
        const sx = Math.cos(spAngle) * spDist;
        const sy = Math.sin(spAngle) * spDist;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fef08a';
        ctx.fill();
      }
      break;
    }

    case 'pig': {
      // 4. FUNNY PIGGY SNOUT
      // Outer pink oval
      const snoutGrad = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.6);
      snoutGrad.addColorStop(0, '#fbcfe8');
      snoutGrad.addColorStop(0.5, '#f472b6');
      snoutGrad.addColorStop(1, '#db2777');

      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.9, R * 0.65, 0, 0, Math.PI * 2);
      ctx.fillStyle = snoutGrad;
      ctx.fill();
      ctx.strokeStyle = '#be185d';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Two dark oval nostrils with snort wiggle
      const nostrilWiggle = Math.sin(time * 0.015) * (R * 0.04);
      [-R * 0.35, R * 0.35].forEach((nx, i) => {
        ctx.beginPath();
        ctx.ellipse(nx, nostrilWiggle * (i === 0 ? 1 : -1), R * 0.16, R * 0.26, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#831843';
        ctx.fill();
        ctx.strokeStyle = '#fbcfe8';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Highlight gleam
      ctx.beginPath();
      ctx.ellipse(0, -R * 0.35, R * 0.5, R * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
      break;
    }

    case 'cat': {
      // 5. CUTE CAT / DOG WHISKERS NOSE
      // Shiny Black Button Nose
      const leatherGrad = ctx.createRadialGradient(-R * 0.15, -R * 0.15, R * 0.05, 0, 0, R * 0.55);
      leatherGrad.addColorStop(0, '#64748b');
      leatherGrad.addColorStop(0.4, '#1e293b');
      leatherGrad.addColorStop(1, '#020617');

      // Heart / inverted rounded triangle nose button
      ctx.beginPath();
      ctx.moveTo(0, R * 0.32);
      ctx.bezierCurveTo(-R * 0.55, R * 0.1, -R * 0.55, -R * 0.35, -R * 0.15, -R * 0.35);
      ctx.bezierCurveTo(0, -R * 0.25, 0, -R * 0.25, 0, -R * 0.25);
      ctx.bezierCurveTo(0, -R * 0.25, 0, -R * 0.25, R * 0.15, -R * 0.35);
      ctx.bezierCurveTo(R * 0.55, -R * 0.35, R * 0.55, R * 0.1, 0, R * 0.32);
      ctx.closePath();
      ctx.fillStyle = leatherGrad;
      ctx.fill();
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Specular glint
      ctx.beginPath();
      ctx.ellipse(-R * 0.16, -R * 0.18, R * 0.15, R * 0.08, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      // 3 Twitching Whiskers on Each Side
      const twitch = Math.sin(time * 0.01) * 3;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';

      // Left Whiskers
      [-15, 0, 15].forEach((wY, idx) => {
        ctx.beginPath();
        ctx.moveTo(-R * 0.45, wY * 0.4);
        ctx.quadraticCurveTo(-R * 1.5, wY + (idx - 1) * twitch, -R * 2.5, wY * 1.8 + twitch);
        ctx.stroke();
      });

      // Right Whiskers
      [-15, 0, 15].forEach((wY, idx) => {
        ctx.beginPath();
        ctx.moveTo(R * 0.45, wY * 0.4);
        ctx.quadraticCurveTo(R * 1.5, wY - (idx - 1) * twitch, R * 2.5, wY * 1.8 - twitch);
        ctx.stroke();
      });
      break;
    }

    case 'pinocchio': {
      // 6. PINOCCHIO WOODEN NOSE
      const woodLen = R * (isPopping ? 2.6 : 1.6);
      const woodGrad = ctx.createLinearGradient(0, -woodLen, 0, 0);
      woodGrad.addColorStop(0, '#fef08a');
      woodGrad.addColorStop(0.3, '#d97706');
      woodGrad.addColorStop(0.8, '#b45309');
      woodGrad.addColorStop(1, '#78350f');

      // Tapered wooden cone pointing forward
      ctx.beginPath();
      ctx.moveTo(-R * 0.35, 0);
      ctx.lineTo(R * 0.35, 0);
      ctx.lineTo(R * 0.15, -woodLen);
      ctx.arc(0, -woodLen, R * 0.15, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = woodGrad;
      ctx.fill();
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Wood grain rings
      for (let g = 0.25; g <= 0.85; g += 0.25) {
        ctx.beginPath();
        const gy = -woodLen * g;
        const gw = (R * 0.35) * (1 - g * 0.5);
        ctx.ellipse(0, gy, gw, gw * 0.35, 0, 0, Math.PI * 2);
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}
