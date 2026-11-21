export type EraTeamId = 'solo' | 'red' | 'blue' | 'green' | 'gold';

export interface EraTeamVisualSpec {
  id: EraTeamId;
  name: string;
  shortLabel: string;
  emblemLabel: string;
  hex: string;
  colorNum: number;
  hoverHex: string;
  darkEdgeHex: string;
  softTintHex: string;
  cardTintBg: string;
  glowRgba: string;
  softGlowRgba: string;
  borderRgba: string;
  buttonTextHex: string;
  outfitPrimaryNum: number;
  outfitSecondaryNum: number;
  outfitSecondaryHex: string;
  outfitDarkTrimNum: number;
  targetHueDeg: number;
  targetSat: number;
  secondaryHueDeg: number;
  secondarySat: number;
}

export const ERA_TEAM_PALETTE: Record<EraTeamId, EraTeamVisualSpec> = {
  solo: {
    id: 'solo',
    name: 'Solo Arena',
    shortLabel: 'SOLO',
    emblemLabel: 'Free-For-All',
    hex: '#00B982',
    colorNum: 0x00b982,
    hoverHex: '#00A372',
    darkEdgeHex: '#007F59',
    softTintHex: '#F0FDF9',
    cardTintBg: 'linear-gradient(180deg, #FFFFFF 0%, #F2FBF8 100%)',
    glowRgba: 'rgba(0, 185, 130, 0.26)',
    softGlowRgba: 'rgba(0, 185, 130, 0.12)',
    borderRgba: 'rgba(0, 185, 130, 0.42)',
    buttonTextHex: '#FFFFFF',
    outfitPrimaryNum: 0x00b982,
    outfitSecondaryNum: 0x5cecc0,
    outfitSecondaryHex: '#5CECC0',
    outfitDarkTrimNum: 0x007a56,
    targetHueDeg: 162.2,
    targetSat: 0.86,
    secondaryHueDeg: 158,
    secondarySat: 0.78
  },
  red: {
    id: 'red',
    name: 'Red Team',
    shortLabel: 'RED',
    emblemLabel: 'Crimson Vanguard',
    hex: '#F20D45',
    colorNum: 0xf20d45,
    hoverHex: '#DC0A3D',
    darkEdgeHex: '#B30731',
    softTintHex: '#FFF1F4',
    cardTintBg: 'linear-gradient(180deg, #FFFFFF 0%, #FFF1F4 100%)',
    glowRgba: 'rgba(242, 13, 69, 0.28)',
    softGlowRgba: 'rgba(242, 13, 69, 0.14)',
    borderRgba: 'rgba(242, 13, 69, 0.48)',
    buttonTextHex: '#FFFFFF',
    outfitPrimaryNum: 0xf20d45,
    outfitSecondaryNum: 0xff7597,
    outfitSecondaryHex: '#FF7597',
    outfitDarkTrimNum: 0xa3082e,
    targetHueDeg: 345.3,
    targetSat: 0.89,
    secondaryHueDeg: 349,
    secondarySat: 0.84
  },
  blue: {
    id: 'blue',
    name: 'Blue Team',
    shortLabel: 'BLUE',
    emblemLabel: 'Cobalt Strikers',
    hex: '#2583F5',
    colorNum: 0x2583f5,
    hoverHex: '#1973E2',
    darkEdgeHex: '#1357B3',
    softTintHex: '#EFF6FF',
    cardTintBg: 'linear-gradient(180deg, #FFFFFF 0%, #EEF6FF 100%)',
    glowRgba: 'rgba(37, 131, 245, 0.28)',
    softGlowRgba: 'rgba(37, 131, 245, 0.14)',
    borderRgba: 'rgba(37, 131, 245, 0.48)',
    buttonTextHex: '#FFFFFF',
    outfitPrimaryNum: 0x2583f5,
    outfitSecondaryNum: 0x7cc0ff,
    outfitSecondaryHex: '#7CC0FF',
    outfitDarkTrimNum: 0x1656a8,
    targetHueDeg: 212.9,
    targetSat: 0.89,
    secondaryHueDeg: 201,
    secondarySat: 0.88
  },
  green: {
    id: 'green',
    name: 'Green Team',
    shortLabel: 'GREEN',
    emblemLabel: 'Emerald Rangers',
    hex: '#00B982',
    colorNum: 0x00b982,
    hoverHex: '#00A372',
    darkEdgeHex: '#007E58',
    softTintHex: '#ECFDF7',
    cardTintBg: 'linear-gradient(180deg, #FFFFFF 0%, #EAFCF6 100%)',
    glowRgba: 'rgba(0, 185, 130, 0.28)',
    softGlowRgba: 'rgba(0, 185, 130, 0.14)',
    borderRgba: 'rgba(0, 185, 130, 0.48)',
    buttonTextHex: '#FFFFFF',
    outfitPrimaryNum: 0x00b982,
    outfitSecondaryNum: 0x5cecc0,
    outfitSecondaryHex: '#5CECC0',
    outfitDarkTrimNum: 0x007a56,
    targetHueDeg: 162.2,
    targetSat: 0.88,
    secondaryHueDeg: 156,
    secondarySat: 0.80
  },
  gold: {
    id: 'gold',
    name: 'Gold Team',
    shortLabel: 'GOLD',
    emblemLabel: 'Solar Champions',
    hex: '#FFAD18',
    colorNum: 0xffad18,
    hoverHex: '#F09D07',
    darkEdgeHex: '#C47C00',
    softTintHex: '#FFFBEB',
    cardTintBg: 'linear-gradient(180deg, #FFFFFF 0%, #FFF9E6 100%)',
    glowRgba: 'rgba(255, 173, 24, 0.32)',
    softGlowRgba: 'rgba(255, 173, 24, 0.16)',
    borderRgba: 'rgba(255, 173, 24, 0.54)',
    buttonTextHex: '#0F172A',
    outfitPrimaryNum: 0xffad18,
    outfitSecondaryNum: 0xffe074,
    outfitSecondaryHex: '#FFE074',
    outfitDarkTrimNum: 0xc27803,
    targetHueDeg: 38.7,
    targetSat: 0.94,
    secondaryHueDeg: 48,
    secondarySat: 0.92
  }
};

const portraitImageCache = new Map<string, Promise<HTMLImageElement>>();
const recoloredDataUrlCache = new Map<string, string>();
const inFlightRecolorCache = new Map<string, Promise<string>>();

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / Math.max(1e-5, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rgbToHsl(r255: number, g255: number, b255: number): [number, number, number] {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s <= 0.0001) {
    const v = Math.round(clamp01(l) * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(clamp01(hue2rgb(p, q, h + 1 / 3)) * 255);
  const g = Math.round(clamp01(hue2rgb(p, q, h)) * 255);
  const b = Math.round(clamp01(hue2rgb(p, q, h - 1 / 3)) * 255);
  return [r, g, b];
}

function loadPortraitImage(url: string): Promise<HTMLImageElement> {
  const existing = portraitImageCache.get(url);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = err => {
      portraitImageCache.delete(url);
      reject(err);
    };
    img.src = url;
  });

  portraitImageCache.set(url, promise);
  return promise;
}

export function getCachedTeamPortrait(skinId: string, team: EraTeamId): string | undefined {
  return recoloredDataUrlCache.get(`${skinId}|${team}`);
}

/**
 * Generates a high-resolution transparent cutout of a hamster portrait and
 * selectively recolors its clothing, paintball marker, hopper paintballs, footwear,
 * and subtle fur rim accents to match the chosen team while preserving eyes, nose,
 * rosy blush cheeks, facial expression, and breed identity.
 */
export async function buildTeamRecoloredPortrait(
  skinId: string,
  portraitUrl: string,
  team: EraTeamId
): Promise<string> {
  const cacheKey = `${skinId}|${team}`;
  const cached = recoloredDataUrlCache.get(cacheKey);
  if (cached) return cached;

  const inflight = inFlightRecolorCache.get(cacheKey);
  if (inflight) return inflight;

  const job = (async () => {
    try {
      const img = await loadPortraitImage(portraitUrl);
      if (typeof document === 'undefined') return portraitUrl;

      const SIZE = 320;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return portraitUrl;

      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      const data = imageData.data;
      const totalPx = SIZE * SIZE;

      // 1. Corner BFS Flood-Fill to cleanly knock out exterior white background
      // without touching enclosed white fur (Snowy Pearl), white bellies, or eye catchlights
      const exterior = new Uint8Array(totalPx);
      const queue = new Int32Array(totalPx);
      let qHead = 0;
      let qTail = 0;

      const isExteriorCandidate = (pxIdx: number): boolean => {
        const o = pxIdx * 4;
        const r = data[o];
        const g = data[o + 1];
        const b = data[o + 2];
        const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
        const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
        return minC >= 235 && maxC - minC <= 24;
      };

      const trySeed = (pxIdx: number) => {
        if (exterior[pxIdx] === 0 && isExteriorCandidate(pxIdx)) {
          exterior[pxIdx] = 1;
          queue[qTail++] = pxIdx;
        }
      };

      for (let x = 0; x < SIZE; x++) {
        trySeed(x);
        trySeed((SIZE - 1) * SIZE + x);
      }
      for (let y = 1; y < SIZE - 1; y++) {
        trySeed(y * SIZE);
        trySeed(y * SIZE + (SIZE - 1));
      }

      while (qHead < qTail) {
        const cur = queue[qHead++];
        const cx = cur % SIZE;
        const cy = (cur / SIZE) | 0;
        if (cx > 0) trySeed(cur - 1);
        if (cx < SIZE - 1) trySeed(cur + 1);
        if (cy > 0) trySeed(cur - SIZE);
        if (cy < SIZE - 1) trySeed(cur + SIZE);
      }

      for (let i = 0; i < totalPx; i++) {
        if (exterior[i] === 1) {
          data[i * 4 + 3] = 0;
        }
      }

      // Soft 1px edge anti-aliasing along silhouette border
      for (let y = 1; y < SIZE - 1; y++) {
        const rowOff = y * SIZE;
        for (let x = 1; x < SIZE - 1; x++) {
          const idx = rowOff + x;
          if (exterior[idx] === 1) continue;
          if (
            exterior[idx - 1] === 1 ||
            exterior[idx + 1] === 1 ||
            exterior[idx - SIZE] === 1 ||
            exterior[idx + SIZE] === 1
          ) {
            const o = idx * 4;
            const r = data[o];
            const g = data[o + 1];
            const b = data[o + 2];
            const lum = (r * 77 + g * 150 + b * 29) >> 8;
            const maxC = Math.max(r, g, b);
            const minC = Math.min(r, g, b);
            if (lum > 208 && maxC - minC < 30) {
              data[o + 3] = Math.max(20, Math.min(255, Math.round(((252 - lum) / 44) * 255)));
            }
          }
        }
      }

      // 2. Selective Garment, Accessories, Marker, Hopper Paintballs & Fur Accent Recoloring
      if (team !== 'solo') {
        const spec = ERA_TEAM_PALETTE[team];

        for (let y = 0; y < SIZE; y++) {
          const ny = y / SIZE;
          const rowOff = y * SIZE;
          for (let x = 0; x < SIZE; x++) {
            const idx = rowOff + x;
            const o = idx * 4;
            if (data[o + 3] === 0) continue;

            const r = data[o];
            const g = data[o + 1];
            const b = data[o + 2];
            const [hDeg, s, l] = rgbToHsl(r, g, b);

            // Preserve crisp dark ink outlines & eye pupils
            if (l < 0.155) continue;
            // Preserve pure white eye catchlights, teeth & bright white belly center
            if (l > 0.91 && s < 0.14) continue;

            const nx = x / SIZE;
            let primaryWeight = 0;
            let secondaryWeight = 0;
            let darkFabricLift = false;
            let furAccentWeight = 0;

            if (skinId === 'sunny_clover') {
              // Cardigan, teal marker, lime hopper paintballs, and sneakers
              if (hDeg >= 66 && hDeg <= 262 && s >= 0.13) {
                primaryWeight = smoothstep(0.13, 0.25, s);
              } else if (ny > 0.42 && hDeg >= 41 && hDeg < 66 && s >= 0.44) {
                // Metallic trim & cardigan buttons harmonize subtly
                secondaryWeight = team === 'gold' ? 0.25 : 0.42;
              } else if (
                hDeg >= 24 &&
                hDeg <= 50 &&
                s >= 0.18 &&
                ny < 0.86 &&
                !(ny >= 0.24 && ny <= 0.44 && nx >= 0.30 && nx <= 0.68 && l < 0.38)
              ) {
                furAccentWeight = 0.15;
              }
            } else if (skinId === 'cinnamon_pip') {
              // Sky-blue varsity jacket, striped cuffs/collar, marker, tank, cyan paintballs
              if (hDeg >= 162 && hDeg <= 265 && s >= 0.12) {
                primaryWeight = smoothstep(0.12, 0.24, s);
              } else if (
                ny > 0.47 &&
                ny < 0.76 &&
                l > 0.74 &&
                s < 0.32 &&
                (nx < 0.43 || nx > 0.63)
              ) {
                // Cream varsity sleeves receive a soft team-tinted cream warmth
                furAccentWeight = 0.20;
              } else if (
                hDeg >= 16 &&
                hDeg <= 40 &&
                s >= 0.24 &&
                !(ny >= 0.25 && ny <= 0.44 && nx >= 0.31 && nx <= 0.69 && (l < 0.38 || hDeg < 18))
              ) {
                furAccentWeight = 0.14;
              }
            } else if (skinId === 'snowy_pearl') {
              // Deep navy blazer, cobalt marker & blue marbled hopper paintballs
              if (hDeg >= 184 && hDeg <= 278 && s >= 0.13) {
                primaryWeight = smoothstep(0.13, 0.24, s);
                darkFabricLift = true;
              } else if (
                s < 0.14 &&
                l >= 0.68 &&
                l <= 0.90 &&
                !(ny >= 0.26 && ny <= 0.45 && nx >= 0.28 && nx <= 0.72)
              ) {
                // Delicate pearlescent team rim accent on outer snowy fur shading
                furAccentWeight = 0.13;
              }
            } else if (skinId === 'mocha_cheer') {
              // Protect inner face expression (eyes, rosy cheeks, pink nose) & inner ear hollows
              const inFace =
                ((nx - 0.495) / 0.162) ** 2 + ((ny - 0.345) / 0.095) ** 2 <= 1.0;
              const inLeftEar =
                ((nx - 0.335) / 0.052) ** 2 + ((ny - 0.168) / 0.062) ** 2 <= 1.0;
              const inRightEar =
                ((nx - 0.648) / 0.052) ** 2 + ((ny - 0.168) / 0.062) ** 2 <= 1.0;
              const inHopper =
                ((nx - 0.368) / 0.095) ** 2 + ((ny - 0.474) / 0.086) ** 2 <= 1.0;

              if (inHopper && hDeg >= 3 && hDeg <= 36 && s >= 0.35) {
                primaryWeight = smoothstep(0.35, 0.48, s);
              } else if (
                !inFace &&
                !inLeftEar &&
                !inRightEar &&
                hDeg >= 3 &&
                hDeg <= 25.5 &&
                s >= 0.38
              ) {
                const satRamp = smoothstep(0.38, 0.51, s);
                const hueRamp = ny > 0.45 ? 1 - smoothstep(23.0, 26.0, hDeg) : 1 - smoothstep(21.0, 24.5, hDeg);
                primaryWeight = satRamp * hueRamp;
              } else if (!inFace && s >= 0.16 && s <= 0.44 && l >= 0.22 && l <= 0.76) {
                furAccentWeight = 0.14;
              }
            } else if (skinId === 'caramel_sprout') {
              const inHopper =
                ((nx - 0.368) / 0.088) ** 2 + ((ny - 0.468) / 0.088) ** 2 <= 1.0;
              // Denim overalls & blue gun barrel/grip
              if (hDeg >= 176 && hDeg <= 268 && s >= 0.12) {
                primaryWeight = smoothstep(0.12, 0.24, s);
                darkFabricLift = l < 0.38;
              } else if (inHopper && hDeg >= 36 && hDeg <= 68 && s >= 0.38) {
                primaryWeight = smoothstep(0.38, 0.50, s);
              } else if (ny > 0.845 && hDeg >= 10 && hDeg <= 34 && s >= 0.38) {
                // Sneakers at bottom
                primaryWeight = smoothstep(0.38, 0.50, s);
              } else if (ny > 0.43 && ny <= 0.845 && hDeg >= 41 && hDeg <= 68 && s >= 0.44) {
                // Yellow tee-shirt & gun receiver transform into coordinated secondary team tone
                secondaryWeight = smoothstep(0.44, 0.56, s);
              } else if (
                hDeg >= 24 &&
                hDeg <= 40 &&
                s >= 0.22 &&
                !(ny >= 0.23 && ny <= 0.46 && nx >= 0.26 && nx <= 0.68 && l < 0.38)
              ) {
                furAccentWeight = 0.14;
              }
            } else if (skinId === 'pudding_hop') {
              // Mint-teal argyle vest, aqua marker, tank & turquoise paintballs
              if (hDeg >= 130 && hDeg <= 220 && s >= 0.11) {
                primaryWeight = smoothstep(0.11, 0.22, s);
              } else if (
                s < 0.12 &&
                l >= 0.40 &&
                l <= 0.86 &&
                !(ny >= 0.24 && ny <= 0.45 && nx >= 0.28 && nx <= 0.72)
              ) {
                furAccentWeight = 0.15;
              }
            }

            if (primaryWeight > 0.01) {
              let nextL = darkFabricLift
                ? clamp01(0.15 + l * 1.24 + (team === 'gold' ? 0.09 : 0.04))
                : clamp01(l * 0.94 + (team === 'gold' ? 0.05 : -0.01));
              nextL = Math.max(0.16, Math.min(0.87, nextL));
              const nextS = Math.max(0.28, Math.min(0.95, s * 0.38 + spec.targetSat * 0.65));
              const [nr, ng, nb] = hslToRgb(spec.targetHueDeg, nextS, nextL);
              data[o] = Math.round(r + (nr - r) * primaryWeight);
              data[o + 1] = Math.round(g + (ng - g) * primaryWeight);
              data[o + 2] = Math.round(b + (nb - b) * primaryWeight);
            } else if (secondaryWeight > 0.01) {
              const nextL = Math.max(0.26, Math.min(0.89, l * 0.95 + 0.04));
              const nextS = Math.max(0.32, Math.min(0.92, s * 0.35 + spec.secondarySat * 0.62));
              const [nr, ng, nb] = hslToRgb(spec.secondaryHueDeg, nextS, nextL);
              data[o] = Math.round(r + (nr - r) * secondaryWeight);
              data[o + 1] = Math.round(g + (ng - g) * secondaryWeight);
              data[o + 2] = Math.round(b + (nb - b) * secondaryWeight);
            } else if (furAccentWeight > 0.01) {
              // Subtle luminance-preserving fur rim harmony toward the team color
              const lumKeep = l;
              const [tr, tg, tb] = hslToRgb(spec.targetHueDeg, Math.min(0.65, spec.targetSat * 0.65), lumKeep);
              data[o] = Math.round(r + (tr - r) * furAccentWeight);
              data[o + 1] = Math.round(g + (tg - g) * furAccentWeight);
              data[o + 2] = Math.round(b + (tb - b) * furAccentWeight);
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const outUrl = canvas.toDataURL('image/png');
      recoloredDataUrlCache.set(cacheKey, outUrl);
      return outUrl;
    } catch {
      return portraitUrl;
    } finally {
      inFlightRecolorCache.delete(cacheKey);
    }
  })();

  inFlightRecolorCache.set(cacheKey, job);
  return job;
}

/**
 * Pre-warms transparent cutouts and team color variants in idle chunks
 * so switching characters or teams in the UI is 0ms instant.
 */
export function prewarmTeamPortraits(
  skins: ReadonlyArray<{ id: string; portraitUrl: string }>,
  priorityTeam: EraTeamId = 'red'
): void {
  if (typeof window === 'undefined') return;
  const orderedTeams: EraTeamId[] = [
    priorityTeam,
    ...(['red', 'blue', 'green', 'gold', 'solo'] as EraTeamId[]).filter(t => t !== priorityTeam)
  ];

  let taskIdx = 0;
  const tasks: Array<() => void> = [];
  for (const t of orderedTeams) {
    for (const sk of skins) {
      const key = `${sk.id}|${t}`;
      if (!recoloredDataUrlCache.has(key)) {
        tasks.push(() => {
          void buildTeamRecoloredPortrait(sk.id, sk.portraitUrl, t);
        });
      }
    }
  }

  const step = () => {
    if (taskIdx >= tasks.length) return;
    // Process 2 portraits per frame slice (~3.5ms) so main thread stays 60fps silky smooth
    tasks[taskIdx++]?.();
    if (taskIdx < tasks.length) {
      tasks[taskIdx++]?.();
    }
    if (taskIdx < tasks.length) {
      window.setTimeout(step, 16);
    }
  };

  window.setTimeout(step, 8);
}
