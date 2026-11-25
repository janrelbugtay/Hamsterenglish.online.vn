import hamster01Sunny from '../assets/images/fullbody_hamster_sunny_1794846641651.jpg';
import hamster02Pip from '../assets/images/fullbody_hamster_pip_1794846644859.jpg';
import hamster03Pearl from '../assets/images/fullbody_hamster_pearl_1794846646372.jpg';
import hamster04Mocha from '../assets/images/fullbody_hamster_mocha_1794846648757.jpg';
import hamster05Caramel from '../assets/images/fullbody_hamster_caramel_1794846649517.jpg';
import hamster06Pudding from '../assets/images/fullbody_hamster_pudding_1794846650145.jpg';
import hamster07StarWand from '../assets/images/hamster_mascot_fullbody_1795367067754.jpg';
import hamster08VarsityRed from '../assets/images/fullbody_hamster_08_1795601801838.jpg';
import hamster09RoyalHoodie from '../assets/images/fullbody_hamster_09_1795601800887.jpg';
import hamster10TealTrack from '../assets/images/fullbody_hamster_10_1795601802716.jpg';
import hamster11RoseKnit from '../assets/images/fullbody_hamster_11_1795601804825.jpg';
import hamster12SunnyRaincoat from '../assets/images/fullbody_hamster_12_1795601806320.jpg';
import hamster13SailorBow from '../assets/images/fullbody_hamster_13_1795601807755.jpg';
import hamster14PlaidFlannel from '../assets/images/fullbody_hamster_14_1795601808705.jpg';
import hamster15ChefCoat from '../assets/images/fullbody_hamster_15_1795601839026.jpg';
import hamster16SkyPuffer from '../assets/images/fullbody_hamster_16_1795601839554.jpg';
import hamster17EmeraldStar from '../assets/images/fullbody_hamster_17_1795601839939.jpg';
import hamster18LavenderKnit from '../assets/images/fullbody_hamster_18_1795601843457.jpg';
import hamster19SafariRanger from '../assets/images/fullbody_hamster_19_1795601846624.jpg';
import hamster20RoyalKing from '../assets/images/fullbody_hamster_20_1795601847031.jpg';

export interface HamsterHeadAnchor {
  topPct: number;
  leftPct: number;
  tiltDeg: number;
  scale: number;
}

export interface CuteHamsterBreed {
  breedId: string;
  name: string;
  personality: string;
  imageUrl: string;
  accentColor: string;
  ringColors: [string, string];
  headAnchor: HamsterHeadAnchor;
}

/**
 * 20 Unique Full-Body 3D Studio Hamster Characters (No 2 Hamsters are the Same)
 * Shared between Class Rewards and Mystery Box 3D Team Picker
 */
export const CUTE_HAMSTER_BREEDS: CuteHamsterBreed[] = [
  {
    breedId: 'sunny_cream',
    name: 'Sunny Clover',
    personality: 'Olive Cardigan Scholar',
    imageUrl: hamster01Sunny,
    accentColor: '#10b981',
    ringColors: ['#34d399', '#059669'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
  },
  {
    breedId: 'cinnamon_peach',
    name: 'Captain Pip',
    personality: 'Varsity Blue H Captain',
    imageUrl: hamster02Pip,
    accentColor: '#0ea5e9',
    ringColors: ['#38bdf8', '#0284c7'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'snowy_pearl',
    name: 'Snowy Pearl',
    personality: 'Navy Hoodie Marshmallow',
    imageUrl: hamster03Pearl,
    accentColor: '#6366f1',
    ringColors: ['#818cf8', '#4338ca'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'mocha_latte',
    name: 'Mocha Cheer',
    personality: 'Orange Hoodie Hype Buddy',
    imageUrl: hamster04Mocha,
    accentColor: '#f97316',
    ringColors: ['#fb923c', '#ea580c'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
  },
  {
    breedId: 'caramel_butter',
    name: 'Caramel Sprout',
    personality: 'Denim Overalls Explorer',
    imageUrl: hamster05Caramel,
    accentColor: '#eab308',
    ringColors: ['#facc15', '#ca8a04'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'silver_pudding',
    name: 'Pudding Hop',
    personality: 'Emerald Argyle Peace Buddy',
    imageUrl: hamster06Pudding,
    accentColor: '#14b8a6',
    ringColors: ['#2dd4bf', '#0d9488'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
  },
  {
    breedId: 'star_wizard',
    name: 'Professor Star',
    personality: 'Golden Wand & Glasses',
    imageUrl: hamster07StarWand,
    accentColor: '#f59e0b',
    ringColors: ['#fbbf24', '#d97706'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'crimson_bomber',
    name: 'Ruby Striker',
    personality: 'Crimson Letterman Jacket',
    imageUrl: hamster08VarsityRed,
    accentColor: '#ef4444',
    ringColors: ['#f87171', '#dc2626'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'violet_hoodie',
    name: 'Cosmic Berry',
    personality: 'Royal Purple Zip Hoodie',
    imageUrl: hamster09RoyalHoodie,
    accentColor: '#8b5cf6',
    ringColors: ['#a78bfa', '#6d28d9'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'aqua_sprinter',
    name: 'Turbo Teal',
    personality: 'Turquoise Track Jacket',
    imageUrl: hamster10TealTrack,
    accentColor: '#06b6d4',
    ringColors: ['#22d3ee', '#0891b2'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'rose_blossom',
    name: 'Rosie Muffin',
    personality: 'Pink Chunky Knit Cardigan',
    imageUrl: hamster11RoseKnit,
    accentColor: '#ec4899',
    ringColors: ['#f472b6', '#db2777'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'sunny_raincoat',
    name: 'Cloudy Splash',
    personality: 'Sunny Yellow Raincoat',
    imageUrl: hamster12SunnyRaincoat,
    accentColor: '#eab308',
    ringColors: ['#fde047', '#ca8a04'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'nautical_sailor',
    name: 'Skipper Wave',
    personality: 'Navy Sailor Collar & Bow',
    imageUrl: hamster13SailorBow,
    accentColor: '#2563eb',
    ringColors: ['#60a5fa', '#1d4ed8'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'plaid_timber',
    name: 'Acorn Ranger',
    personality: 'Cozy Plaid Flannel Shirt',
    imageUrl: hamster14PlaidFlannel,
    accentColor: '#dc2626',
    ringColors: ['#fb7185', '#be123c'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'master_bistro',
    name: 'Chef Biscuit',
    personality: 'White Chef Coat & Ascot',
    imageUrl: hamster15ChefCoat,
    accentColor: '#f43f5e',
    ringColors: ['#fda4af', '#e11d48'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'glacier_puffer',
    name: 'Misty Frost',
    personality: 'Sky Quilted Puffer Vest',
    imageUrl: hamster16SkyPuffer,
    accentColor: '#38bdf8',
    ringColors: ['#7dd3fc', '#0284c7'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'emerald_ace',
    name: 'Clover Star',
    personality: 'Emerald Gold-Star Polo',
    imageUrl: hamster17EmeraldStar,
    accentColor: '#16a34a',
    ringColors: ['#4ade80', '#15803d'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'lavender_cable',
    name: 'Lilac Mochi',
    personality: 'Lavender Cable-Knit Sweater',
    imageUrl: hamster18LavenderKnit,
    accentColor: '#a855f7',
    ringColors: ['#c084fc', '#7e22ce'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'safari_scout',
    name: 'Scout Hazel',
    personality: 'Safari Pocket Vest & Scarf',
    imageUrl: hamster19SafariRanger,
    accentColor: '#65a30d',
    ringColors: ['#a3e635', '#4d7c0f'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'royal_sovereign',
    name: 'King Nibbles',
    personality: 'Royal Crimson & Gold Tunic',
    imageUrl: hamster20RoyalKing,
    accentColor: '#d97706',
    ringColors: ['#facc15', '#b45309'],
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
];

export interface HamsterGearTier {
  id:
    | 'sprout'
    | 'party_cone'
    | 'explorer_cap'
    | 'star_shades'
    | 'artist_beret'
    | 'propeller_cap'
    | 'wizard_hat'
    | 'dj_headphones'
    | 'royal_crown'
    | 'champion_wings'
    | 'cosmic_legend';
  name: string;
  shortName: string;
  minDollars: number;
  badgeEmoji: string;
  auraColor: string;
  description: string;
  sideItemLabel?: string;
}

export const HAMSTER_GEAR_TIERS: HamsterGearTier[] = [
  {
    id: 'sprout',
    name: 'Lucky Sprout Hat',
    shortName: 'Sprout Hat',
    minDollars: 1,
    badgeEmoji: '🌱',
    auraColor: '#22c55e',
    description: 'First $1 earned! Fresh lucky twin-leaf sprout hat.',
  },
  {
    id: 'party_cone',
    name: 'Confetti Party Hat',
    shortName: 'Party Hat',
    minDollars: 2,
    badgeEmoji: '🎉',
    auraColor: '#ec4899',
    description: 'Polka-dot celebration cone with golden pom-pom!',
  },
  {
    id: 'explorer_cap',
    name: 'Sunny Scholar Cap',
    shortName: 'Scholar Cap',
    minDollars: 3,
    badgeEmoji: '🎓',
    auraColor: '#3b82f6',
    description: 'Crisp varsity baseball cap with golden star crest!',
  },
  {
    id: 'star_shades',
    name: 'Starlight Bow & Ribbon',
    shortName: 'Star Bow',
    minDollars: 5,
    badgeEmoji: '🌟',
    auraColor: '#eab308',
    description: 'Sparkling golden star headband & emerald ribbon!',
    sideItemLabel: 'Star Pin',
  },
  {
    id: 'artist_beret',
    name: 'Master Artist Beret',
    shortName: 'Artist Beret',
    minDollars: 8,
    badgeEmoji: '🎨',
    auraColor: '#f43f5e',
    description: 'Plush crimson beret + golden creative brush!',
    sideItemLabel: 'Golden Brush',
  },
  {
    id: 'propeller_cap',
    name: 'Whirlwind Spinner Cap',
    shortName: 'Spinner Cap',
    minDollars: 12,
    badgeEmoji: '🚁',
    auraColor: '#06b6d4',
    description: 'Colorful spinner beanie with whirling top blades!',
    sideItemLabel: 'Pinwheel',
  },
  {
    id: 'wizard_hat',
    name: 'Starry Wizard Hat & Wand',
    shortName: 'Wizard Hat',
    minDollars: 16,
    badgeEmoji: '🪄',
    auraColor: '#8b5cf6',
    description: 'Enchanted indigo wizard hat & glowing starlight wand!',
    sideItemLabel: 'Magic Wand',
  },
  {
    id: 'dj_headphones',
    name: 'Golden Beat Crown',
    shortName: 'Gold Visor',
    minDollars: 22,
    badgeEmoji: '🎧',
    auraColor: '#f97316',
    description: 'Studio gold headphones & floating musical notes!',
    sideItemLabel: 'Music Note',
  },
  {
    id: 'royal_crown',
    name: 'Royal Emerald Crown',
    shortName: 'Royal Crown',
    minDollars: 30,
    badgeEmoji: '👑',
    auraColor: '#eab308',
    description: 'Solid gold sovereign crown set with emeralds & rubies!',
    sideItemLabel: 'Royal Gem',
  },
  {
    id: 'champion_wings',
    name: 'Winged Champion Crown',
    shortName: 'Winged Crown',
    minDollars: 40,
    badgeEmoji: '🏆',
    auraColor: '#10b981',
    description: 'Radiant golden champion crown + victory trophy cup!',
    sideItemLabel: 'Victory Cup',
  },
  {
    id: 'cosmic_legend',
    name: 'Cosmic Legend Halo',
    shortName: 'Legend Halo',
    minDollars: 55,
    badgeEmoji: '✨',
    auraColor: '#a855f7',
    description: 'Floating celestial halo, starlight scepter & legend aura!',
    sideItemLabel: 'Star Scepter',
  },
];

export function getUnlockedGearTiers(dollars: number): HamsterGearTier[] {
  const safe = Number(dollars) || 0;
  if (safe <= 0) return [];
  return HAMSTER_GEAR_TIERS.filter((t) => safe >= t.minDollars);
}

export function getActiveHamsterGear(
  dollars: number | undefined,
  equippedGearId?: string | null
): HamsterGearTier | null {
  if (dollars === undefined || dollars === null) return null;
  if (equippedGearId === 'none') return null;
  const unlocked = getUnlockedGearTiers(dollars);
  if (unlocked.length === 0) return null;
  if (equippedGearId && equippedGearId !== 'auto') {
    const chosen = unlocked.find((t) => t.id === equippedGearId);
    if (chosen) return chosen;
  }
  return unlocked[unlocked.length - 1];
}

export function getNextHamsterGear(dollars: number | undefined): HamsterGearTier | null {
  const safe = Number(dollars) || 0;
  return HAMSTER_GEAR_TIERS.find((t) => t.minDollars > safe) || null;
}

export function getNewlyUnlockedGear(prevDollars: number, nextDollars: number): HamsterGearTier | null {
  if (nextDollars <= prevDollars) return null;
  const crossed = HAMSTER_GEAR_TIERS.filter(
    (t) => prevDollars < t.minDollars && nextDollars >= t.minDollars
  );
  return crossed.length > 0 ? crossed[crossed.length - 1] : null;
}

export interface StudentCharacterDef {
  id: number;
  driveId: string;
  tag: string;
  title: string;
  breedIndex: number;
}

export const GOOGLE_DRIVE_STUDENTS: StudentCharacterDef[] = CUTE_HAMSTER_BREEDS.map(
  (breed, idx) => ({
    id: idx + 1,
    driveId: breed.breedId,
    tag: String(idx + 1).padStart(3, '0'),
    title: breed.name,
    breedIndex: idx,
  })
);

export const OFFICIAL_CHARACTER_NUMBERS = GOOGLE_DRIVE_STUDENTS.map((s) => s.id);

export function getStudentCharacter(
  num: number,
  _avatarStyle: 'cute' | 'classic' = 'cute'
): {
  id: number;
  tag: string;
  cuteUrl: string;
  classicUrl: string;
  driveUrl: string;
  thumbnailUrl: string;
  localUrl: string;
  title: string;
  breed: CuteHamsterBreed;
} {
  const safeNum = Math.max(1, num || 1);
  const index = (safeNum - 1) % CUTE_HAMSTER_BREEDS.length;
  const breed = CUTE_HAMSTER_BREEDS[index] || CUTE_HAMSTER_BREEDS[0];
  const def = GOOGLE_DRIVE_STUDENTS[index] || GOOGLE_DRIVE_STUDENTS[0];

  return {
    id: def.id,
    tag: def.tag,
    cuteUrl: breed.imageUrl,
    classicUrl: breed.imageUrl,
    localUrl: breed.imageUrl,
    driveUrl: breed.imageUrl,
    thumbnailUrl: breed.imageUrl,
    title: breed.name,
    breed,
  };
}
