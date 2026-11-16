import hamsterSunnyCream from '../assets/images/fullbody_hamster_sunny_1794846641651.jpg';
import hamsterCinnamonPeach from '../assets/images/fullbody_hamster_pip_1794846644859.jpg';
import hamsterSnowyPearl from '../assets/images/fullbody_hamster_pearl_1794846646372.jpg';
import hamsterMochaLatte from '../assets/images/fullbody_hamster_mocha_1794846648757.jpg';
import hamsterCaramelButter from '../assets/images/fullbody_hamster_caramel_1794846649517.jpg';
import hamsterSilverPudding from '../assets/images/fullbody_hamster_pudding_1794846650145.jpg';

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
  headAnchor: HamsterHeadAnchor;
}

export const CUTE_HAMSTER_BREEDS: CuteHamsterBreed[] = [
  {
    breedId: 'sunny_cream',
    name: 'Sunny Clover',
    personality: 'Tropical Cardigan Scholar',
    imageUrl: hamsterSunnyCream,
    accentColor: '#10b981',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
  },
  {
    breedId: 'cinnamon_peach',
    name: 'Cinnamon Pip',
    personality: 'Island Varsity Captain',
    imageUrl: hamsterCinnamonPeach,
    accentColor: '#0ea5e9',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'snowy_pearl',
    name: 'Snowy Pearl',
    personality: 'Beach Hoodie Marshmallow',
    imageUrl: hamsterSnowyPearl,
    accentColor: '#6366f1',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'mocha_latte',
    name: 'Mocha Cheer',
    personality: 'Sunny Hoodie Hype Buddy',
    imageUrl: hamsterMochaLatte,
    accentColor: '#f97316',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
  },
  {
    breedId: 'caramel_butter',
    name: 'Caramel Sprout',
    personality: 'Tropical Denim Explorer',
    imageUrl: hamsterCaramelButter,
    accentColor: '#eab308',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: 0, scale: 1.08 },
  },
  {
    breedId: 'silver_pudding',
    name: 'Pudding Hop',
    personality: 'Joyful Island Argyle',
    imageUrl: hamsterSilverPudding,
    accentColor: '#14b8a6',
    headAnchor: { topPct: 14.5, leftPct: 50, tiltDeg: -2, scale: 1.08 },
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

const RAW_DRIVE_IDS: Array<{ id: number; driveId: string; tag: string }> = [
  { id: 1, driveId: '1u9s1Xu8uza3W8ZpwWX5NqKVPA4F9gBz7', tag: '001' },
  { id: 2, driveId: '1Yww-WssC4zOP56Syalqa6mw-rmImoymq', tag: '002' },
  { id: 3, driveId: '1--gLzDjWZb5o8xyUruCm0CAlgT5yWH9d', tag: '003' },
  { id: 4, driveId: '1rHWCqfAcDeTg4zNZDoCzqQlVG3q-UvJ8', tag: '004' },
  { id: 5, driveId: '1-vu3sEk0FKaC4NlGANnHiw1YnBRz3F9o', tag: '005' },
  { id: 6, driveId: '1UgKip6JWFFoubn64WLXrvoUVXtjXPocX', tag: '006' },
  { id: 7, driveId: '1lW6qzVWDBoVgp8w9AmrtKBTbhB6PrbjA', tag: '007' },
  { id: 8, driveId: '1171GyfDvSgQL98DraWZ-cADZCqfkeVrc', tag: '008' },
  { id: 10, driveId: '1qav0p4elcuPV6TUIDHTvQitEOPZMeEsa', tag: '010' },
  { id: 11, driveId: '1I_SaYxnyONbabGB9ejXCM7KBSR53E7yj', tag: '011' },
  { id: 12, driveId: '1fo6TScqbfu2SCzp-QrKiGhf80xDHzadC', tag: '012' },
  { id: 13, driveId: '12MMb4sFoNOt00wb3Nk-5jb9EGAAF9LwU', tag: '013' },
  { id: 14, driveId: '1lWoBpy-sUmIXntaKaDICyxTmMPgJ6Agw', tag: '014' },
  { id: 15, driveId: '18Hdg_pM5Fa4io4mG8_Hg9QQxtFjXIElr', tag: '015' },
  { id: 16, driveId: '1FwjKBgbyCoR7IRkZylV4w-hWW3rRKLPl', tag: '016' },
  { id: 17, driveId: '1V6eQ0YIR2hwX6raQ3R0SIWrcVCiNmWr3', tag: '017' },
  { id: 18, driveId: '10gg_NEq7ONS2PUA6L4pFSxp1gR5T5J7t', tag: '018' },
  { id: 19, driveId: '1ERvXVhbZGsSbEF_UNwOokzpwR7UQfcfe', tag: '019' },
  { id: 20, driveId: '1a6an-aimnGmpt-wGDI4unHQ8N2Mp-b0F', tag: '020' },
  { id: 21, driveId: '161y2_mK2y0KhzXL1hPNNTZq70JwVZqi1', tag: '021' },
  { id: 22, driveId: '1HnOQ7YWkZud8aSP_8HH3qp3D5yhmQChI', tag: '022' },
  { id: 23, driveId: '1zjux6UA6uVRx8aNCxsZl03asRgvHQ_DQ', tag: '023' },
  { id: 24, driveId: '1xMCSDYL9YcWLbxuQoVgOui2GuDSe5htU', tag: '024' },
  { id: 25, driveId: '1AgWXbJz4xDtTYqixedKjke4SNf9xBL3m', tag: '025' },
  { id: 26, driveId: '1NfkVET4BBzSan_xCBv-2PSqar81HVWM2', tag: '026' },
  { id: 27, driveId: '1d78anitTb6rqyMMNBpG1RlwcFgFg13bU', tag: '027' },
  { id: 28, driveId: '107lPDseyCr8xrctT5Vvxa0AkVkaph_NOE', tag: '028' },
  { id: 29, driveId: '1eqS7ftNN91QpbMNYeS2Do1vCpF7cRP23', tag: '029' },
  { id: 30, driveId: '1pqTJC9_owR5H5GLtamSxtZzh-vwn8CWl', tag: '030' },
  { id: 31, driveId: '1clpP1axyiONpHb1Fes81iASnALPajPHH', tag: '031' },
  { id: 32, driveId: '1DRgkKgK5bcfHHPU30JZvprpUS0qRg9eY', tag: '032' },
  { id: 33, driveId: '1BRSfxo2Ssv5l3bPyvmKfMncksfbyO_5m', tag: '033' },
  { id: 34, driveId: '1m-WXLMBYKOtB-Qcsx8KwJlCD5XYc_ONb', tag: '034' },
  { id: 35, driveId: '180PjF8dXPAE6ExtfkLY_uL4sdKHDSWNZ', tag: '035' },
  { id: 36, driveId: '1Orld290vuz8QpO2mqUrPNJ9w0LVDolpE', tag: '036' },
  { id: 37, driveId: '1pbgtlPINic0Al87nImN9IEzxz29puUpa', tag: '037' },
  { id: 38, driveId: '1xA7AUGgB-yk7YaxbI8nZKQuUXryhGFyv', tag: '038' },
  { id: 39, driveId: '1v1PAXLnqIuZ9dFTX-eLi3NNkq0uGeE4F', tag: '039' },
  { id: 40, driveId: '1Sgp-htwMyn2AfNkxrwoPcmQxW9C9yPHo', tag: '040' },
];

const HAMSTER_NICKNAMES = [
  'Sunny Clover',
  'Cinnamon Pip',
  'Snowy Pearl',
  'Mocha Cheer',
  'Caramel Sprout',
  'Pudding Hop',
  'Honey Biscuit',
  'Ginger Acorn',
  'Cloudy Mochi',
  'Cocoa Bean',
  'Buttercup Muffin',
  'Misty Pebble',
];

export const GOOGLE_DRIVE_STUDENTS: StudentCharacterDef[] = RAW_DRIVE_IDS.map((item, idx) => ({
  ...item,
  breedIndex: idx % CUTE_HAMSTER_BREEDS.length,
  title: HAMSTER_NICKNAMES[idx % HAMSTER_NICKNAMES.length],
}));

export const OFFICIAL_CHARACTER_NUMBERS = GOOGLE_DRIVE_STUDENTS.map((s) => s.id);

export function getStudentCharacter(
  num: number,
  avatarStyle: 'cute' | 'classic' = 'cute'
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
  let def = GOOGLE_DRIVE_STUDENTS.find((s) => s.id === num);

  if (!def) {
    const safeNum = Math.max(1, num || 1);
    const index = (safeNum - 1) % GOOGLE_DRIVE_STUDENTS.length;
    def = GOOGLE_DRIVE_STUDENTS[index] || GOOGLE_DRIVE_STUDENTS[0];
  }

  const breed = CUTE_HAMSTER_BREEDS[def.breedIndex] || CUTE_HAMSTER_BREEDS[0];
  const padded = String(def.id).padStart(3, '0');
  const classicUrl = `/images/student_${padded}.png`;

  return {
    id: def.id,
    tag: def.tag,
    cuteUrl: breed.imageUrl,
    classicUrl,
    localUrl: avatarStyle === 'classic' ? classicUrl : breed.imageUrl,
    driveUrl: `https://lh3.googleusercontent.com/d/${def.driveId}`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${def.driveId}&sz=w1000`,
    title: def.title,
    breed,
  };
}
