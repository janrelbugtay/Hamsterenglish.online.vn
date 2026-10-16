import React from 'react';

export type SumoCharacterType = 'rikishi' | 'panda' | 'shiba' | 'tiger' | 'bear' | 'hamster';

export type SumoCameraMode = 'dynamic' | 'closeup' | 'low' | 'overhead' | 'wide';

export interface SumoCharacterOption {
  id: SumoCharacterType;
  name: string;
  title: string;
  badge: string;
}

export const SUMO_CHARACTER_OPTIONS: SumoCharacterOption[] = [
  { id: 'rikishi', name: 'Yokozuna Taro', title: 'Grand Sumo Champion', badge: '🥋' },
  { id: 'panda', name: 'Bao Panda', title: 'Bamboo Heavyweight', badge: '🐼' },
  { id: 'shiba', name: 'Hachi Shiba', title: 'Golden Sumo Shiba', badge: '🐕' },
  { id: 'tiger', name: 'Tora Tiger', title: 'Striped Powerhouse', badge: '🐯' },
  { id: 'bear', name: 'Kuma Bear', title: 'Mountain Grizzly', badge: '🐻' },
  { id: 'hamster', name: 'Mochi Hamster', title: 'Chubby Cheek Rikishi', badge: '🐹' },
];

export const SUMO_CAMERA_OPTIONS: { id: SumoCameraMode; label: string; shortLabel: string }[] = [
  { id: 'dynamic', label: 'Dynamic Action Cam', shortLabel: 'Dynamic' },
  { id: 'closeup', label: 'Close-Up Clash Cam', shortLabel: 'Close-Up' },
  { id: 'low', label: 'Heroic Low-Angle Cam', shortLabel: 'Low Angle' },
  { id: 'overhead', label: 'Ringside Top-Tilt Cam', shortLabel: 'Ringside' },
  { id: 'wide', label: 'Wide Stadium Cam', shortLabel: 'Wide' },
];

export interface SumoCharacterProps {
  team: 'left' | 'right';
  character?: SumoCharacterType;
  isPushing?: boolean;
  isOpponentPushing?: boolean;
  isStunned?: boolean;
  isFrozen?: boolean;
  hasLost?: boolean;
  isWinner?: boolean;
  compact?: boolean;
  size?: 'icon' | 'card' | 'compact' | 'normal';
  className?: string;
}

export const SumoCharacter: React.FC<SumoCharacterProps> = ({
  team,
  character = 'rikishi',
  isPushing = false,
  isOpponentPushing = false,
  isStunned = false,
  isFrozen = false,
  hasLost = false,
  isWinner = false,
  compact = false,
  size,
  className = ''
}) => {
  const isLeft = team === 'left';

  // Team Mawashi Belt & Hachimaki Headband Colors (Blue Team vs Red Team)
  const beltMain = isLeft ? '#0055fe' : '#dc2626';
  const beltLight = isLeft ? '#60a5fa' : '#f87171';
  const beltDark = isLeft ? '#1e3a8a' : '#7f1d1d';
  const goldAccent = '#fbbf24';
  const goldDark = '#b45309';

  // Character-Specific Natural Palettes
  const palettes: Record<SumoCharacterType, {
    bodyBase: string;
    bodyLight: string;
    bodyShadow: string;
    bellyBase: string;
    bellyShade: string;
    earOuter: string;
    earInner: string;
    cheek: string;
    nose: string;
  }> = {
    rikishi: {
      bodyBase: '#fbaf73',
      bodyLight: '#fed7aa',
      bodyShadow: '#c2410c',
      bellyBase: '#ffedd5',
      bellyShade: '#fed7aa',
      earOuter: '#fbaf73',
      earInner: '#ea580c',
      cheek: '#fb7185',
      nose: '#c2410c',
    },
    panda: {
      bodyBase: '#f8fafc',
      bodyLight: '#ffffff',
      bodyShadow: '#94a3b8',
      bellyBase: '#ffffff',
      bellyShade: '#e2e8f0',
      earOuter: '#1e293b',
      earInner: '#475569',
      cheek: '#fda4af',
      nose: '#0f172a',
    },
    shiba: {
      bodyBase: '#f59e0b',
      bodyLight: '#fbbf24',
      bodyShadow: '#92400e',
      bellyBase: '#fffbeb',
      bellyShade: '#fef3c7',
      earOuter: '#d97706',
      earInner: '#fef3c7',
      cheek: '#fb7185',
      nose: '#1e293b',
    },
    tiger: {
      bodyBase: '#fb923c',
      bodyLight: '#fdba74',
      bodyShadow: '#9a3412',
      bellyBase: '#fff7ed',
      bellyShade: '#ffedd5',
      earOuter: '#ea580c',
      earInner: '#fed7aa',
      cheek: '#fb7185',
      nose: '#f43f5e',
    },
    bear: {
      bodyBase: '#92400e',
      bodyLight: '#b45309',
      bodyShadow: '#451a03',
      bellyBase: '#fef3c7',
      bellyShade: '#fde68a',
      earOuter: '#78350f',
      earInner: '#d97706',
      cheek: '#f87171',
      nose: '#1c1917',
    },
    hamster: {
      bodyBase: '#f59e0b',
      bodyLight: '#fde047',
      bodyShadow: '#b45309',
      bellyBase: '#ffffff',
      bellyShade: '#fef3c7',
      earOuter: '#d97706',
      earInner: '#fda4af',
      cheek: '#fb7185',
      nose: '#f43f5e',
    },
  };

  const pal = palettes[character] || palettes.rikishi;

  // Grounded Movement Physics — Upright & Grounded (Never sideways-distorted)
  let rotation = 0;
  let translateX = 0;
  let translateY = 0;
  let animStateClass = 'anim-sumo-idle';

  if (hasLost) {
    rotation = -38;
    translateX = -42;
    translateY = 14;
    animStateClass = 'anim-sumo-ringout';
  } else if (isWinner) {
    rotation = 0;
    translateX = 0;
    translateY = -10;
    animStateClass = 'anim-sumo-win';
  } else if (isPushing) {
    rotation = 0;
    translateX = 22;
    translateY = 2;
    animStateClass = 'anim-sumo-push';
  } else if (isOpponentPushing) {
    rotation = 0;
    translateX = -16;
    translateY = 2;
    animStateClass = 'anim-sumo-recoil';
  } else if (isStunned) {
    rotation = -3;
    translateX = -8;
    translateY = 2;
    animStateClass = 'anim-sumo-stun';
  }

  // Right team mirrors horizontally to face Left team
  const isFlipped = !isLeft;
  const flipScale = isFlipped ? 'scaleX(-1)' : 'scaleX(1)';
  const transform = `${flipScale} translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg)`;
  const resolvedSize = size || (compact ? 'compact' : 'normal');
  const uid = `${team}-${character}-${resolvedSize}`;

  // Character sizing across icon, card, compact, and normal close-up arena views
  const sizeClasses =
    resolvedSize === 'icon'
      ? 'w-[34px] h-[34px] sm:w-[42px] sm:h-[42px]'
      : resolvedSize === 'card'
        ? 'w-[68px] h-[68px] sm:w-[82px] sm:h-[82px] md:w-[94px] md:h-[94px]'
        : resolvedSize === 'compact'
          ? 'w-[104px] h-[104px] sm:w-[128px] sm:h-[128px] md:w-[148px] md:h-[148px]'
          : 'w-[155px] h-[155px] sm:w-[205px] sm:h-[205px] md:w-[255px] md:h-[255px] lg:w-[295px] lg:h-[295px] xl:w-[320px] xl:h-[320px]';

  const limbFill = character === 'panda' ? '#1e293b' : `url(#body-${uid})`;
  const limbStroke = character === 'panda' ? '#0f172a' : pal.bodyShadow;
  const handFill = character === 'rikishi' ? pal.bodyLight : pal.bellyBase;

  return (
    <div
      className={`relative z-20 ${sizeClasses} transition-all duration-300 ease-out origin-bottom select-none ${className}`}
      style={{ transform }}
    >
      <div className={`w-full h-full ${animStateClass}`}>
        <svg viewBox="0 0 175 155" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id={`body-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pal.bodyLight} />
              <stop offset="65%" stopColor={pal.bodyBase} />
              <stop offset="100%" stopColor={pal.bodyShadow} />
            </linearGradient>
            <linearGradient id={`belly-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={pal.bellyBase} />
              <stop offset="100%" stopColor={pal.bellyShade} />
            </linearGradient>
            <linearGradient id={`belt-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={beltLight} />
              <stop offset="50%" stopColor={beltMain} />
              <stop offset="100%" stopColor={beltDark} />
            </linearGradient>
          </defs>

          {/* 1. GROUNDED CONTACT SHADOW ON CLAY FLOOR */}
          <ellipse cx="86" cy="140" rx="58" ry="11" fill="rgba(69, 26, 3, 0.38)" />

          {/* Explosive Clay Dust & Speed Lines when Pushing */}
          {isPushing && (
            <g>
              <circle cx="24" cy="136" r="10" fill="#d9b382" opacity="0.9" />
              <circle cx="12" cy="128" r="8" fill="#fde68a" opacity="0.85" />
              <circle cx="36" cy="139" r="7" fill="#c89662" opacity="0.85" />
              <line x1="-14" y1="62" x2="14" y2="62" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="-20" y1="80" x2="10" y2="80" stroke="#fef08a" strokeWidth="4.5" strokeLinecap="round" />
              <line x1="-10" y1="98" x2="16" y2="98" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
            </g>
          )}

          {/* Skidding Clay Puffs when Pushed Back */}
          {isOpponentPushing && (
            <g opacity="0.9">
              <circle cx="126" cy="137" r="9" fill="#d9b382" />
              <circle cx="138" cy="132" r="7" fill="#fef3c7" />
              <circle cx="60" cy="138" r="8" fill="#d9b382" />
            </g>
          )}

          {/* 2. CHARACTER TAIL (Behind Body) */}
          {character === 'shiba' && (
            <path
              d="M 36 96 Q 14 76 24 60 Q 34 50 42 66 Q 38 78 40 90"
              fill={pal.bodyBase}
              stroke={pal.bodyShadow}
              strokeWidth="2.2"
            />
          )}
          {character === 'tiger' && (
            <g>
              <path d="M 36 100 Q 12 86 16 66" fill="none" stroke={pal.bodyBase} strokeWidth="9.5" strokeLinecap="round" />
              <path d="M 20 86 L 27 82 M 15 74 L 23 72" stroke="#1c1917" strokeWidth="3.2" strokeLinecap="round" />
            </g>
          )}
          {(character === 'panda' || character === 'bear' || character === 'hamster') && (
            <circle cx="34" cy="98" r="8.5" fill={character === 'panda' ? '#1e293b' : pal.bodyBase} stroke={pal.bodyShadow} strokeWidth="1.8" />
          )}

          {/* 3. FAR / FRONT-REACHING ARM (TUCKED NATURALLY BEHIND THE FAR SHOULDER — NEVER CROSSING THE BELLY) */}
          {isWinner ? (
            <g>
              {/* Raised Far Victory Arm emerging from far shoulder (x=114, y=72) */}
              <path
                d="M 108 74 C 124 66, 138 48, 134 30 C 131 22, 120 24, 118 34 C 118 46, 108 58, 98 66 Z"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Wrist Tape */}
              <path d="M 121 37 L 133 35" stroke={beltMain} strokeWidth="5.5" strokeLinecap="round" />
              {/* Open Hand */}
              <circle cx="127" cy="26" r="8.5" fill={handFill} stroke={limbStroke} strokeWidth="2" />
            </g>
          ) : isPushing ? (
            <g className="anim-sumo-palm-thrust">
              {/* Far Arm Thrusting Forward from Far Shoulder (x=112, y=72) */}
              <path
                d="M 106 66 C 124 62, 140 60, 152 60 C 156 60, 158 74, 150 76 C 136 78, 120 80, 104 82 Z"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Curved Team Wristband */}
              <rect x="139" y="59" width="8" height="17" rx="3" fill={beltMain} stroke={beltDark} strokeWidth="1.2" />
              {/* Open Sumo Palm Pushing Forward */}
              <ellipse cx="155" cy="66" rx="7.5" ry="10.5" fill={handFill} stroke={limbStroke} strokeWidth="2" />
              <circle cx="151" cy="58" r="3.5" fill={handFill} stroke={limbStroke} strokeWidth="1.5" />
            </g>
          ) : (
            <g className="anim-sumo-arms-ready">
              {/* Ready Far Arm Emerging Naturally from Behind the Far Shoulder (x=110, y=72) */}
              <path
                d="M 104 68 C 120 66, 134 68, 144 65 C 150 64, 152 77, 144 80 C 132 84, 118 84, 102 82 Z"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Team Wristband */}
              <rect x="131" y="65" width="7.5" height="15.5" rx="3" fill={beltMain} stroke={beltDark} strokeWidth="1.2" transform="rotate(-6 135 73)" />
              {/* Sculpted Grappling Hand & Thumb */}
              <ellipse cx="146" cy="71" rx="8" ry="8.5" fill={handFill} stroke={limbStroke} strokeWidth="2" />
              <circle cx="142" cy="64" r="3.5" fill={handFill} stroke={limbStroke} strokeWidth="1.5" />
            </g>
          )}

          {/* 4. WIDE GROUNDED SUMO LEGS (PLANTED FLAT ON THE DOHYO FLOOR) */}
          {/* Back Leg (Braced wide on the left) */}
          <g className={!hasLost && !isWinner ? 'anim-sumo-foot-back' : ''}>
            <ellipse cx="52" cy="116" rx="18" ry="16" fill={limbFill} stroke={limbStroke} strokeWidth="2.2" />
            <path d="M 38 120 Q 52 125 66 120" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
            <ellipse cx="48" cy="133" rx="17" ry="7.5" fill={handFill} stroke={limbStroke} strokeWidth="2.2" />
          </g>

          {/* Front Leg (Braced wide forward toward opponent) */}
          <g className={!hasLost && !isWinner ? 'anim-sumo-foot-front' : ''}>
            <ellipse cx="112" cy="116" rx="18" ry="16" fill={limbFill} stroke={limbStroke} strokeWidth="2.2" />
            <path d="M 98 120 Q 112 125 126 120" fill="none" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
            <ellipse cx="116" cy="133" rx="17" ry="7.5" fill={handFill} stroke={limbStroke} strokeWidth="2.2" />
          </g>

          {/* 5. POWERFUL ROUND SUMO TORSO & BELLY */}
          <g>
            {/* Main Sumo Torso Mass with Broad Shoulders */}
            <path
              d="M 42 74 C 36 92, 42 124, 82 124 C 122 124, 128 92, 120 74 C 114 60, 50 60, 42 74 Z"
              fill={`url(#body-${uid})`}
              stroke={pal.bodyShadow}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />

            {/* Panda Black Shoulder Saddle Across Upper Chest */}
            {character === 'panda' && (
              <path
                d="M 41 75 C 48 61, 114 61, 121 75 L 119 88 Q 82 76 43 88 Z"
                fill="#1e293b"
              />
            )}

            {/* Tiger Back Stripes */}
            {character === 'tiger' && (
              <g stroke="#1c1917" strokeWidth="3.5" strokeLinecap="round">
                <path d="M 43 80 L 55 83" />
                <path d="M 40 90 L 53 93" />
                <path d="M 43 100 L 54 101" />
              </g>
            )}

            {/* Round Sumo Belly & Chest Patch */}
            <ellipse cx="87" cy="93" rx="32" ry="25" fill={`url(#belly-${uid})`} />

            {/* Subtle Sumo Pectoral / Chest Definition */}
            <path
              d="M 66 77 Q 76 83 84 77 M 88 77 Q 96 83 106 77"
              fill="none"
              stroke={pal.bodyShadow}
              strokeWidth="1.8"
              strokeLinecap="round"
              opacity="0.35"
            />

            {/* Bear Golden Chest Crescent */}
            {character === 'bear' && (
              <path d="M 73 76 Q 87 86 101 76 Q 87 94 73 76 Z" fill="#f59e0b" opacity="0.7" />
            )}

            {/* Cute Sumo Belly Button */}
            <ellipse cx="91" cy="90" rx="3.2" ry="2.2" fill={pal.bodyShadow} opacity="0.45" />

            {/* 6. TRADITIONAL SUMO MAWASHI BELT & KESHO-MAWASHI APRON */}
            <path
              d="M 38 95 Q 82 109 124 93 L 121 112 Q 82 128 41 112 Z"
              fill={`url(#belt-${uid})`}
              stroke={beltDark}
              strokeWidth="2.2"
            />
            {/* Top & Bottom Gold Rope Trim on Mawashi */}
            <path d="M 39 96 Q 82 110 123 94" fill="none" stroke={goldAccent} strokeWidth="3.2" strokeLinecap="round" />
            <path d="M 42 111 Q 82 127 120 111" fill="none" stroke={goldDark} strokeWidth="2.4" strokeLinecap="round" />

            {/* Center Sumo Apron & Gold Sagari Tassels */}
            <rect x="77" y="101" width="23" height="21" rx="4.5" fill={beltDark} stroke={goldAccent} strokeWidth="2.2" />
            <circle cx="88.5" cy="110" r="4.2" fill={goldAccent} />
            <line x1="68" y1="103" x2="67" y2="119" stroke={goldAccent} strokeWidth="2.8" strokeLinecap="round" />
            <line x1="108" y1="103" x2="109" y2="119" stroke={goldAccent} strokeWidth="2.8" strokeLinecap="round" />
          </g>

          {/* 7. NEAR / FRONT GUARDING ARM (ANATOMICALLY ATTACHED TO THE NEAR SHOULDER AT X=44, Y=74) */}
          {isWinner ? (
            <g>
              {/* Raised Near Victory Arm seamlessly attached to left shoulder */}
              <path
                d="M 52 74 C 36 66, 24 48, 28 30 C 31 22, 42 24, 44 34 C 44 46, 52 58, 60 68"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M 29 35 L 41 37" stroke={beltMain} strokeWidth="5.5" strokeLinecap="round" />
              <circle cx="35" cy="26" r="8.5" fill={handFill} stroke={limbStroke} strokeWidth="2" />
            </g>
          ) : isPushing ? (
            <g className="anim-sumo-palm-thrust">
              {/* Near Shoulder & Arm Thrusting Forward in Double-Palm Tsuppari Strike */}
              <path
                d="M 48 68 C 68 66, 98 68, 126 68 C 132 68, 132 82, 124 83 C 96 85, 64 86, 44 82 C 38 80, 40 70, 48 68 Z"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Curved Team Wristband */}
              <rect x="112" y="67" width="8" height="16.5" rx="3" fill={beltMain} stroke={beltDark} strokeWidth="1.2" />
              {/* Open Sumo Palm & Thumb */}
              <ellipse cx="129" cy="75" rx="7.5" ry="10.5" fill={handFill} stroke={limbStroke} strokeWidth="2" />
              <circle cx="125" cy="67" r="3.5" fill={handFill} stroke={limbStroke} strokeWidth="1.5" />

              {/* Golden Tsuppari Impact Burst */}
              <ellipse cx="164" cy="71" rx="5.5" ry="20" fill="none" stroke="#fef08a" strokeWidth="3.2" />
              <polygon points="164,53 168,66 178,71 168,76 164,89 160,76 150,71 160,66" fill={goldAccent} />
            </g>
          ) : (
            <g className="anim-sumo-arms-ready">
              {/* Anatomically Sculpted Near Shoulder + Bent Elbow + Forearm Guard (Connected at Shoulder x=44, y=72) */}
              <path
                d="M 55 70 C 42 70, 34 80, 40 91 C 45 100, 66 96, 86 90 C 92 88, 92 75, 83 76 C 68 78, 56 81, 53 77"
                fill={limbFill}
                stroke={limbStroke}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Contoured Team Wristband */}
              <rect x="72" y="75" width="7.5" height="15" rx="3" fill={beltMain} stroke={beltDark} strokeWidth="1.2" transform="rotate(-12 76 82)" />
              {/* Sculpted Near Grappling Hand & Thumb */}
              <ellipse cx="89" cy="81" rx="8.5" ry="8" fill={handFill} stroke={limbStroke} strokeWidth="2" />
              <circle cx="85" cy="74" r="3.5" fill={handFill} stroke={limbStroke} strokeWidth="1.5" />
            </g>
          )}

          {/* 8. UPRIGHT, CRISP CHARACTER HEAD (TOP LAYER SO ARMS NEVER OVERLAP THE FACE) */}
          <g transform="translate(8, 2)">
            {/* Character Ears */}
            {character === 'rikishi' ? (
              <g>
                <ellipse cx="42" cy="48" rx="6.5" ry="9.5" fill={pal.bodyBase} stroke={pal.bodyShadow} strokeWidth="2" />
                <ellipse cx="110" cy="48" rx="6.5" ry="9.5" fill={pal.bodyBase} stroke={pal.bodyShadow} strokeWidth="2" />
              </g>
            ) : character === 'shiba' ? (
              <g>
                <polygon points="44,32 36,7 64,21" fill={pal.earOuter} stroke={pal.bodyShadow} strokeWidth="2.2" strokeLinejoin="round" />
                <polygon points="47,28 41,12 59,21" fill={pal.earInner} />
                <polygon points="90,21 116,7 108,32" fill={pal.earOuter} stroke={pal.bodyShadow} strokeWidth="2.2" strokeLinejoin="round" />
                <polygon points="93,21 111,12 105,28" fill={pal.earInner} />
              </g>
            ) : (
              <g>
                <circle cx="46" cy="22" r="12.5" fill={pal.earOuter} stroke={pal.bodyShadow} strokeWidth="2.2" />
                <circle cx="46" cy="22" r="7" fill={pal.earInner} />
                <circle cx="106" cy="22" r="12.5" fill={pal.earOuter} stroke={pal.bodyShadow} strokeWidth="2.2" />
                <circle cx="106" cy="22" r="7" fill={pal.earInner} />
              </g>
            )}

            {/* Sumo Chonmage Topknot */}
            <g>
              <ellipse cx="76" cy="14" rx="11" ry="5.5" fill="#18181b" />
              <rect x="70" y="2" width="12" height="16" rx="6" fill="#27272a" stroke="#09090b" strokeWidth="1.5" />
              <rect x="68" y="12" width="16" height="4.5" rx="2" fill={goldAccent} stroke={goldDark} strokeWidth="1" />
            </g>

            {/* Main Head Shape */}
            <ellipse
              cx="76"
              cy="45"
              rx="35"
              ry="27.5"
              fill={`url(#body-${uid})`}
              stroke={pal.bodyShadow}
              strokeWidth="2.2"
            />

            {/* Classic Rikishi Black Sumo Hair Sideburns & Crown */}
            {character === 'rikishi' && (
              <path
                d="M 42 42 Q 43 17 76 17 Q 109 17 110 42 Q 105 28 96 26 Q 76 22 56 26 Q 47 28 42 42 Z"
                fill="#18181b"
              />
            )}

            {/* Tiger Forehead & Cheek Stripes */}
            {character === 'tiger' && (
              <g stroke="#1c1917" strokeWidth="3" strokeLinecap="round">
                <line x1="76" y1="21" x2="76" y2="30" />
                <line x1="68" y1="23" x2="71" y2="29" />
                <line x1="84" y1="23" x2="81" y2="29" />
                <line x1="44" y1="44" x2="52" y2="45" />
                <line x1="45" y1="50" x2="53" y2="50" />
                <line x1="108" y1="44" x2="100" y2="45" />
                <line x1="107" y1="50" x2="99" y2="50" />
              </g>
            )}

            {/* Team Hachimaki Headband Across Forehead */}
            <path
              d="M 44 31 Q 76 37 108 31 L 109 36 Q 76 42 43 36 Z"
              fill={beltMain}
              stroke={beltDark}
              strokeWidth="1.2"
            />
            <circle cx="76" cy="34" r="3.8" fill="#ffffff" stroke={goldAccent} strokeWidth="1.5" />

            {/* Muzzle / Cheek Patch */}
            {character !== 'rikishi' && (
              <ellipse cx="80" cy="52" rx="22.5" ry="14" fill={`url(#belly-${uid})`} />
            )}

            {/* Shiba White Eyebrow Dots */}
            {character === 'shiba' && (
              <g fill="#fffbeb">
                <ellipse cx="66" cy="37" rx="4.2" ry="2.4" />
                <ellipse cx="90" cy="37" rx="4.2" ry="2.4" />
              </g>
            )}

            {/* Panda Iconic Black Eye Patches */}
            {character === 'panda' && (
              <g fill="#1e293b">
                <ellipse cx="65" cy="44" rx="8.8" ry="7.2" transform="rotate(-10 65 44)" />
                <ellipse cx="91" cy="44" rx="8.8" ry="7.2" transform="rotate(10 91 44)" />
              </g>
            )}

            {/* Rosy Cheeks */}
            <ellipse cx="55" cy="52" rx="6.5" ry="4" fill={pal.cheek} opacity="0.62" />
            <ellipse cx="99" cy="52" rx="6.5" ry="4" fill={pal.cheek} opacity="0.62" />

            {/* Expressive Eyes */}
            {hasLost ? (
              <g stroke={character === 'panda' ? '#ffffff' : '#18181b'} strokeWidth="2.8" strokeLinecap="round" fill="none">
                <path d="M 61 41 L 69 48 M 69 41 L 61 48" />
                <path d="M 87 41 L 95 48 M 95 41 L 87 48" />
              </g>
            ) : isStunned ? (
              <g stroke={character === 'panda' ? '#ffffff' : '#18181b'} strokeWidth="2.6" strokeLinecap="round" fill="none">
                <circle cx="65" cy="44" r="4.8" />
                <circle cx="91" cy="44" r="4.8" />
              </g>
            ) : isWinner ? (
              <g stroke={character === 'panda' ? '#ffffff' : '#18181b'} strokeWidth="3.2" strokeLinecap="round" fill="none">
                <path d="M 60 45 Q 65 38 70 45" />
                <path d="M 86 45 Q 91 38 96 45" />
              </g>
            ) : (
              <g>
                <line x1="59" y1="37" x2="71" y2="40" stroke={character === 'panda' ? '#ffffff' : '#18181b'} strokeWidth="2.8" strokeLinecap="round" />
                <line x1="85" y1="40" x2="97" y2="37" stroke={character === 'panda' ? '#ffffff' : '#18181b'} strokeWidth="2.8" strokeLinecap="round" />
                <circle cx="66" cy="44" r="5.2" fill="#18181b" />
                <circle cx="67.5" cy="42.5" r="2.1" fill="#ffffff" />
                <circle cx="90" cy="44" r="5.2" fill="#18181b" />
                <circle cx="91.5" cy="42.5" r="2.1" fill="#ffffff" />
              </g>
            )}

            {/* Nose & Mouth */}
            {character === 'rikishi' ? (
              <g>
                <path d="M 77 45 Q 81 48 77 50" fill="none" stroke={pal.nose} strokeWidth="2.2" strokeLinecap="round" />
                {isPushing ? (
                  <rect x="71" y="53" width="14" height="6" rx="3" fill="#ffffff" stroke="#18181b" strokeWidth="1.5" />
                ) : (
                  <path d="M 71 55 Q 78 60 85 55" fill="none" stroke="#18181b" strokeWidth="2.5" strokeLinecap="round" />
                )}
              </g>
            ) : (
              <g>
                <ellipse cx="79" cy="50" rx="4.2" ry="3" fill={pal.nose} />
                <path d="M 73 55 Q 79 59 85 55" fill="none" stroke="#18181b" strokeWidth="2.3" strokeLinecap="round" />
                {character === 'hamster' && (
                  <rect x="77" y="56" width="4.2" height="4" rx="1" fill="#ffffff" stroke="#18181b" strokeWidth="0.8" />
                )}
                {character === 'tiger' && (
                  <g fill="#ffffff">
                    <polygon points="74,56 76,60 78,56" />
                    <polygon points="81,56 83,60 85,56" />
                  </g>
                )}
              </g>
            )}
          </g>

          {/* Frozen Ice Block Overlay */}
          {isFrozen && (
            <g>
              <rect x="10" y="6" width="150" height="136" rx="18" fill="rgba(165, 243, 252, 0.78)" stroke="rgba(103, 232, 249, 0.95)" strokeWidth="4" />
              <text
                x={isFlipped ? '-85' : '85'}
                y="78"
                fontFamily="sans-serif"
                fontSize="22"
                fontWeight="900"
                fill="#083344"
                textAnchor="middle"
                transform={isFlipped ? 'scale(-1, 1)' : undefined}
                style={{ paintOrder: 'stroke', stroke: '#cffafe', strokeWidth: '5px' }}
              >
                FROZEN
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

export interface CircularSumoArenaProps {
  battlePos: number;
  winner: string | null;
  isRumbling: boolean;
  leftPushing: boolean;
  rightPushing: boolean;
  leftStunned?: boolean;
  rightStunned?: boolean;
  leftFrozen?: boolean;
  rightFrozen?: boolean;
  leftCharacter?: SumoCharacterType;
  rightCharacter?: SumoCharacterType;
  cameraMode?: SumoCameraMode;
  onCycleCamera?: () => void;
  compact?: boolean;
}

export const CircularSumoArena: React.FC<CircularSumoArenaProps> = ({
  battlePos,
  winner,
  isRumbling,
  leftPushing,
  rightPushing,
  leftStunned = false,
  rightStunned = false,
  leftFrozen = false,
  rightFrozen = false,
  leftCharacter = 'rikishi',
  rightCharacter = 'panda',
  cameraMode = 'dynamic',
  onCycleCamera,
  compact = false
}) => {
  // 40 braided golden rice-straw bales (Tawara) forming a large, deep circular Sumo ring
  const strawBales = Array.from({ length: 40 }).map((_, i) => {
    const angle = (i / 40) * Math.PI * 2;
    const rx = 420;
    const ry = 128;
    const cx = 500 + Math.cos(angle) * rx;
    const cy = 186 + Math.sin(angle) * ry;
    const deg = (angle * 180) / Math.PI + 90;
    const isCardinal = i === 0 || i === 10 || i === 20 || i === 30;
    return { cx, cy, deg, isCardinal, i };
  });

  const normOffset = (battlePos - 50) / 38;
  const circleArcY = Math.max(0, (1 - normOffset * normOffset) * 8);

  // Fixed stationary Close-Up Cam framing — the arena never moves or pans!
  const closeUpArenaStyle: React.CSSProperties = {
    transform: `perspective(1100px) scale(${compact ? 1.18 : 1.28}) translate(0%, 4%)`,
  };

  return (
    <div
      className={`w-[99%] sm:w-[96%] lg:w-[92%] max-w-[1440px] mx-auto relative flex items-center justify-center overflow-visible z-10 ${
        compact
          ? 'h-[175px] sm:h-[210px] md:h-[240px]'
          : 'h-[250px] sm:h-[310px] md:h-[365px] lg:h-[410px]'
      }`}
    >
      {/* STATIONARY CLOSE-UP CAMERA RIG CONTAINER FOR ARENA & FIGHTERS */}
      <div
        className="w-full h-full relative flex items-center justify-center origin-center"
        style={closeUpArenaStyle}
      >
        {/* LARGE GROUNDED CIRCULAR SUMO DOHYO ARENA EMBEDDED IN THE PARK LAWN */}
        <svg
          viewBox="0 0 1000 375"
          className="w-full h-full overflow-visible pointer-events-none select-none"
        >
          <defs>
            {/* Packed Circular Sumo Clay Gradient */}
            <radialGradient id="dohyo-clay-circle" cx="50%" cy="46%" r="54%">
              <stop offset="0%" stopColor="#fae1c3" />
              <stop offset="52%" stopColor="#e6bc8a" />
              <stop offset="85%" stopColor="#c89662" />
              <stop offset="100%" stopColor="#9c6b3b" />
            </radialGradient>

            {/* Sloped Earthen Mound Foundation (3D Terraced Dohyo Base on the Ground) */}
            <linearGradient id="dohyo-earth-slope" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b47b44" />
              <stop offset="45%" stopColor="#85582c" />
              <stop offset="85%" stopColor="#5c3a1a" />
              <stop offset="100%" stopColor="#3f2711" />
            </linearGradient>

            {/* Golden Braided Straw Bale (Tawara) Gradient */}
            <linearGradient id="tawara-straw-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="45%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>

          {/* 1. WIDE PARK TURF & GRAVEL FOUNDATION RING ON THE GRASS FLOOR */}
          <ellipse cx="500" cy="248" rx="496" ry="122" fill="#14532d" opacity="0.48" />
          <ellipse cx="500" cy="240" rx="486" ry="116" fill="#15803d" opacity="0.65" />
          <ellipse cx="500" cy="233" rx="474" ry="110" fill="#d6d3d1" stroke="#a8a29e" strokeWidth="3.5" />
          <ellipse cx="500" cy="228" rx="462" ry="104" fill="#e7e5e4" />

          {/* 2. SLOPED 3D EARTHEN CLAY MOUND (TRAPEZOIDAL DOHYO BASE ROOTED TO THE GROUND) */}
          <path
            d="M 55,186 L 22,240 Q 500,358 978,240 L 945,186 Z"
            fill="url(#dohyo-earth-slope)"
            stroke="#451a03"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />

          {/* Wooden Retaining Logs Around the Earthen Base */}
          {Array.from({ length: 23 }).map((_, idx) => {
            const t = idx / 22;
            const angle = Math.PI * (0.05 + t * 0.9);
            const lx = 500 - Math.cos(angle) * 458;
            const ly = 196 + Math.sin(angle) * 116;
            return (
              <rect
                key={`stake-${idx}`}
                x={lx - 5.5}
                y={ly - 8}
                width="11"
                height="26"
                rx="3"
                fill="#78350f"
                stroke="#451a03"
                strokeWidth="1.5"
              />
            );
          })}

          {/* Front Stone & Timber Steps Leading Up From the Park Grass onto the Dohyo */}
          <g>
            <rect x="432" y="298" width="136" height="17" rx="4" fill="#a8a29e" stroke="#57534e" strokeWidth="2" />
            <rect x="442" y="282" width="116" height="16" rx="4" fill="#d6d3d1" stroke="#57534e" strokeWidth="2" />
            <rect x="452" y="266" width="96" height="15" rx="4" fill="#e7e5e4" stroke="#57534e" strokeWidth="2" />
          </g>

          {/* 3. TOP SURFACE OF THE EARTHEN MOUND & SACRED SAND BORDER (JANOME-NO-SUNA) */}
          <ellipse
            cx="500"
            cy="186"
            rx="452"
            ry="140"
            fill="#fef3c7"
            stroke="#b45309"
            strokeWidth="3.5"
          />

          {/* 4. MAIN CIRCULAR SUMO DOHYO CLAY RING */}
          <ellipse
            cx="500"
            cy="186"
            rx="420"
            ry="128"
            fill="url(#dohyo-clay-circle)"
          />

          {/* 5. CONCENTRIC CLAY SWEEP RINGS INSIDE THE CIRCLE */}
          <ellipse
            cx="500"
            cy="186"
            rx="350"
            ry="105"
            fill="none"
            stroke="#b47b44"
            strokeWidth="2.2"
            strokeDasharray="12 9"
            opacity="0.52"
          />
          <ellipse
            cx="500"
            cy="186"
            rx="250"
            ry="75"
            fill="none"
            stroke="#b47b44"
            strokeWidth="2"
            strokeDasharray="9 7"
            opacity="0.45"
          />

          {/* 6. BLUE & RED TEAM TERRITORY ARCS INSIDE THE CIRCLE */}
          <path
            d="M 122,140 A 395,116 0 0,0 122,232"
            fill="none"
            stroke="#0055fe"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.72"
          />
          <path
            d="M 878,140 A 395,116 0 0,1 878,232"
            fill="none"
            stroke="#dc2626"
            strokeWidth="10"
            strokeLinecap="round"
            opacity="0.72"
          />

          {/* 7. CENTER SHIKIRI-SEN (TWO WHITE SUMO STARTING LINES IN THE CIRCLE) */}
          <g>
            <ellipse
              cx="500"
              cy="186"
              rx="36"
              ry="13"
              fill="rgba(251, 191, 36, 0.28)"
              stroke="#d97706"
              strokeWidth="2.2"
            />
            <rect
              x="432"
              y="158"
              width="14"
              height="56"
              rx="7"
              fill="#ffffff"
              stroke="#92400e"
              strokeWidth="1.8"
            />
            <rect
              x="554"
              y="158"
              width="14"
              height="56"
              rx="7"
              fill="#ffffff"
              stroke="#92400e"
              strokeWidth="1.8"
            />
          </g>

          {/* 8. FULL 360° CIRCLE OF BRAIDED GOLDEN STRAW BALES (TAWARA) */}
          {strawBales.map((b) => (
            <g
              key={b.i}
              transform={`translate(${b.cx}, ${b.cy}) rotate(${b.deg})`}
            >
              <rect
                x="-25"
                y="-8"
                width="50"
                height="16"
                rx="8"
                fill={b.isCardinal ? '#f59e0b' : 'url(#tawara-straw-grad)'}
                stroke="#78350f"
                strokeWidth="2.2"
              />
              <line x1="-10" y1="-7" x2="-10" y2="7" stroke="#78350f" strokeWidth="2" />
              <line x1="0" y1="-8" x2="0" y2="8" stroke="#78350f" strokeWidth="2.4" />
              <line x1="10" y1="-7" x2="10" y2="7" stroke="#78350f" strokeWidth="2" />
            </g>
          ))}

          {/* 9. FOREGROUND PARK GRASS TUFTS & WILDFLOWERS GROWING AROUND THE BASE OF THE MOUND */}
          {[
            { x: 75, y: 268 },
            { x: 175, y: 298 },
            { x: 295, y: 318 },
            { x: 405, y: 326 },
            { x: 595, y: 326 },
            { x: 705, y: 318 },
            { x: 825, y: 298 },
            { x: 925, y: 268 },
          ].map((g, idx) => (
            <g key={`turf-${idx}`} transform={`translate(${g.x}, ${g.y})`}>
              <path
                d="M -15,6 Q -10,-12 -19,-16 M -6,6 Q -4,-14 -9,-20 M 0,6 L 2,-18 M 8,6 Q 11,-12 18,-16"
                fill="none"
                stroke="#15803d"
                strokeWidth="3.8"
                strokeLinecap="round"
              />
              <circle cx="-6" cy="-14" r="4" fill={idx % 2 === 0 ? '#fef08a' : '#ffffff'} />
              <circle cx="9" cy="-12" r="3.5" fill="#fbcfe8" />
            </g>
          ))}
        </svg>

        {/* Edge Ring-Out Danger Callouts */}
        {battlePos <= 30 && !winner && (
          <div className="absolute top-1 sm:top-3 left-4 sm:left-12 bg-red-600 text-white font-black text-xs sm:text-sm md:text-base px-4 py-1 rounded-full animate-bounce shadow-xl border-2 border-white z-30">
            BLUE RING-OUT DANGER!
          </div>
        )}
        {battlePos >= 70 && !winner && (
          <div className="absolute top-1 sm:top-3 right-4 sm:right-12 bg-blue-600 text-white font-black text-xs sm:text-sm md:text-base px-4 py-1 rounded-full animate-bounce shadow-xl border-2 border-white z-30">
            RED RING-OUT DANGER!
          </div>
        )}

        {/* HEROIC GROUNDED SUMO WRESTLERS STANDING ON THE DOHYO CLAY FLOOR */}
        <div
          className="absolute top-[45%] flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.22,1.35,0.36,1)] z-20 pointer-events-none"
          style={{
            left: `${Math.max(14, Math.min(86, battlePos))}%`,
            transform: `translate(-50%, calc(-56% - ${circleArcY}px))`
          }}
        >
          <div className={`relative flex items-center ${compact ? '-space-x-2 sm:-space-x-3' : '-space-x-3 sm:-space-x-5 md:-space-x-6'}`}>
            <SumoCharacter
              team="left"
              character={leftCharacter}
              isPushing={leftPushing}
              isOpponentPushing={rightPushing}
              isStunned={leftStunned}
              isFrozen={leftFrozen}
              hasLost={winner === 'Red Team'}
              isWinner={winner === 'Blue Team'}
              compact={compact}
            />

            {/* Live Sumo Clash Shockwave Between Wrestlers */}
            {!winner && (leftPushing || rightPushing || isRumbling) && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-300/90 animate-ping" />
              </div>
            )}

            <SumoCharacter
              team="right"
              character={rightCharacter}
              isPushing={rightPushing}
              isOpponentPushing={leftPushing}
              isStunned={rightStunned}
              isFrozen={rightFrozen}
              hasLost={winner === 'Blue Team'}
              isWinner={winner === 'Red Team'}
              compact={compact}
            />
          </div>
        </div>
      </div>

      {/* Dramatic Ring-Out Victory Callout Banner */}
      {winner && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] rounded-full z-50 animate-in fade-in duration-300 pointer-events-none">
          <div className="bg-[#1f1a16]/95 border-2 border-amber-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center text-center">
            <div className="text-amber-400 font-black tracking-widest text-xs uppercase mb-0.5">
              OSHIDASHI · RING-OUT!
            </div>
            <div className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white drop-shadow">
              {winner.toUpperCase()} WINS!
            </div>
            <div className="text-xs text-amber-200/90 font-semibold mt-0.5">
              {winner === 'Blue Team' ? 'Red Team' : 'Blue Team'} was pushed out of the circular sumo ring!
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export interface SumoCharacterPickerModalProps {
  isOpen: boolean;
  leftCharacter: SumoCharacterType;
  rightCharacter: SumoCharacterType;
  onSelectLeft: (char: SumoCharacterType) => void;
  onSelectRight: (char: SumoCharacterType) => void;
  onClose: () => void;
}

export const SumoCharacterPickerModal: React.FC<SumoCharacterPickerModalProps> = ({
  isOpen,
  leftCharacter,
  rightCharacter,
  onSelectLeft,
  onSelectRight,
  onClose,
}) => {
  if (!isOpen) return null;

  const leftInfo = SUMO_CHARACTER_OPTIONS.find((c) => c.id === leftCharacter);
  const rightInfo = SUMO_CHARACTER_OPTIONS.find((c) => c.id === rightCharacter);

  return (
    <div className="fixed inset-0 z-[120] w-screen h-screen bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 md:p-8 overflow-y-auto animate-in fade-in duration-200 select-none">
      {/* Top Bar */}
      <div className="w-full max-w-[1440px] mx-auto flex items-center justify-between gap-4 pb-3 border-b border-white/15 shrink-0">
        <div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white uppercase tracking-tight italic">
            Choose Your Sumo Fighters
          </h2>
          <p className="text-xs sm:text-sm font-semibold text-amber-300">
            Click any Sumo character below for Blue Team and Red Team
          </p>
        </div>
        <button
          onClick={onClose}
          className="px-6 sm:px-8 py-3 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm sm:text-base md:text-lg shadow-[0_5px_0_#b45309] active:translate-y-1 active:shadow-none transition-all cursor-pointer shrink-0"
        >
          CONFIRM FIGHTERS ✓
        </button>
      </div>

      {/* Main Full-Screen Split Roster & Live Matchup Preview */}
      <div className="w-full max-w-[1440px] mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch my-4">
        {/* BLUE TEAM FIGHTER ROSTER (5 cols) */}
        <div className="lg:col-span-5 bg-blue-950/60 border-2 border-blue-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-blue-500 inline-block shadow-[0_0_10px_#3b82f6]" />
              <span className="font-black text-base sm:text-lg md:text-xl text-blue-300 uppercase tracking-wider">
                Blue Team Fighter
              </span>
            </div>
            <span className="bg-blue-600 text-white font-black text-xs px-3 py-1 rounded-full">
              {leftInfo?.name}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
            {SUMO_CHARACTER_OPTIONS.map((opt) => {
              const selected = leftCharacter === opt.id;
              return (
                <button
                  key={`modal-left-${opt.id}`}
                  onClick={() => onSelectLeft(opt.id)}
                  className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                    selected
                      ? 'bg-gradient-to-b from-blue-500 to-blue-700 text-white border-amber-300 shadow-[0_0_20px_rgba(59,130,246,0.6)] scale-[1.03]'
                      : 'bg-slate-900/80 hover:bg-blue-900/50 text-slate-200 border-blue-500/30 hover:border-blue-400'
                  }`}
                >
                  <div className="py-1 flex items-center justify-center">
                    <SumoCharacter team="left" character={opt.id} size="card" />
                  </div>
                  <div className="mt-1">
                    <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                    <div className={`text-[10px] font-semibold mt-0.5 ${selected ? 'text-blue-100' : 'text-slate-400'}`}>
                      {opt.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER VS STAGE PREVIEW (2 cols) */}
        <div className="lg:col-span-2 bg-gradient-to-b from-sky-200 via-emerald-100 to-emerald-300 text-slate-900 rounded-3xl p-4 border-4 border-amber-400 shadow-2xl flex flex-col items-center justify-center gap-3">
          <div className="flex flex-col items-center text-center">
            <span className="text-[11px] font-black uppercase tracking-wider text-white bg-blue-600 px-3 py-0.5 rounded-full shadow">
              {leftInfo?.name}
            </span>
            <SumoCharacter team="left" character={leftCharacter} compact />
          </div>

          <div className="w-12 h-12 rounded-full bg-amber-400 border-4 border-white shadow-lg flex items-center justify-center font-black italic text-xl text-slate-950">
            VS
          </div>

          <div className="flex flex-col items-center text-center">
            <SumoCharacter team="right" character={rightCharacter} compact />
            <span className="text-[11px] font-black uppercase tracking-wider text-white bg-red-600 px-3 py-0.5 rounded-full shadow mt-1">
              {rightInfo?.name}
            </span>
          </div>
        </div>

        {/* RED TEAM FIGHTER ROSTER (5 cols) */}
        <div className="lg:col-span-5 bg-red-950/60 border-2 border-red-500/50 rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-[0_0_10px_#ef4444]" />
              <span className="font-black text-base sm:text-lg md:text-xl text-red-300 uppercase tracking-wider">
                Red Team Fighter
              </span>
            </div>
            <span className="bg-red-600 text-white font-black text-xs px-3 py-1 rounded-full">
              {rightInfo?.name}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1">
            {SUMO_CHARACTER_OPTIONS.map((opt) => {
              const selected = rightCharacter === opt.id;
              return (
                <button
                  key={`modal-right-${opt.id}`}
                  onClick={() => onSelectRight(opt.id)}
                  className={`p-2.5 sm:p-3 rounded-2xl border-2 flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                    selected
                      ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-amber-300 shadow-[0_0_20px_rgba(239,68,68,0.6)] scale-[1.03]'
                      : 'bg-slate-900/80 hover:bg-red-900/50 text-slate-200 border-red-500/30 hover:border-red-400'
                  }`}
                >
                  <div className="py-1 flex items-center justify-center">
                    <SumoCharacter team="right" character={opt.id} size="card" />
                  </div>
                  <div className="mt-1">
                    <div className="font-black text-xs sm:text-sm leading-tight">{opt.name}</div>
                    <div className={`text-[10px] font-semibold mt-0.5 ${selected ? 'text-red-100' : 'text-slate-400'}`}>
                      {opt.title}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface SumoStadiumEnvironmentProps {
  battlePos: number;
  winner: string | null;
  isRumbling: boolean;
  children: React.ReactNode;
}

export const SumoStadiumEnvironment: React.FC<SumoStadiumEnvironmentProps> = ({
  battlePos,
  winner,
  isRumbling,
  children
}) => {
  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-sky-200 select-none">
      {/* Keyframe Animations for Outdoor Park & Grounded Sumo Movements */}
      <style>{`
        @keyframes cloud-drift-slow {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(32px); }
        }
        @keyframes tree-sway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(1.5deg); }
        }
        @keyframes sumo-stance-breathe {
          0%, 100% { transform: translateY(0px) scaleY(1) scaleX(1); }
          50% { transform: translateY(2.5px) scaleY(0.97) scaleX(1.02); }
        }
        @keyframes sumo-foot-back-step {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(-2px, -2px); }
        }
        @keyframes sumo-foot-front-step {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(2px, -2px); }
        }
        @keyframes sumo-arms-grapple {
          0%, 100% { transform: translate(0px, 0px); }
          50% { transform: translate(3px, -2px); }
        }
        @keyframes sumo-palm-thrust {
          0%, 100% { transform: translateX(0px); }
          50% { transform: translateX(6px); }
        }
        @keyframes sumo-push-surge {
          0% { transform: translateX(0px) scale(1); }
          35% { transform: translateX(16px) scale(1.05); }
          100% { transform: translateX(10px) scale(1.02); }
        }
        @keyframes sumo-recoil-slide {
          0% { transform: translateX(0px); }
          45% { transform: translateX(-14px); }
          100% { transform: translateX(-8px); }
        }
        @keyframes sumo-stun-shake {
          0%, 100% { transform: translateX(0px); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        @keyframes sumo-victory-hop {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-14px) scale(1.05); }
        }
        @keyframes sumo-ringout-spin {
          0% { transform: translate(0, 0) rotate(0deg); }
          100% { transform: translate(-10px, 6px) rotate(-14deg); }
        }
        .anim-cloud-slow { animation: cloud-drift-slow 14s infinite ease-in-out; }
        .anim-tree-sway { animation: tree-sway 5s infinite ease-in-out; transform-origin: bottom center; }
        .anim-sumo-idle { animation: sumo-stance-breathe 1.2s infinite ease-in-out; }
        .anim-sumo-foot-back { animation: sumo-foot-back-step 0.85s infinite ease-in-out; }
        .anim-sumo-foot-front { animation: sumo-foot-front-step 0.85s infinite ease-in-out 0.4s; }
        .anim-sumo-arms-ready { animation: sumo-arms-grapple 0.75s infinite ease-in-out; }
        .anim-sumo-palm-thrust { animation: sumo-palm-thrust 0.18s infinite ease-in-out; }
        .anim-sumo-push { animation: sumo-push-surge 0.35s ease-out forwards; }
        .anim-sumo-recoil { animation: sumo-recoil-slide 0.35s ease-out forwards; }
        .anim-sumo-stun { animation: sumo-stun-shake 0.35s infinite ease-in-out; }
        .anim-sumo-win { animation: sumo-victory-hop 0.65s infinite ease-in-out; }
        .anim-sumo-ringout { animation: sumo-ringout-spin 0.45s ease-out forwards; }
      `}</style>

      {/* BALANCED SUNNY OUTDOOR PARK BACKGROUND — HORIZON MEETS THE TOP OF THE LARGE GROUNDED ARENA */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg
          viewBox="0 0 1200 680"
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full absolute inset-0 overflow-visible"
        >
          <defs>
            <linearGradient id="park-sky-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#bae6fd" />
              <stop offset="100%" stopColor="#fef9c3" />
            </linearGradient>

            <linearGradient id="far-hill-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#4ade80" />
            </linearGradient>
            <linearGradient id="mid-hill-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>

            {/* Lush Park Lawn */}
            <linearGradient id="park-lawn-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" />
              <stop offset="35%" stopColor="#22c55e" />
              <stop offset="75%" stopColor="#16a34a" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            <radialGradient id="green-canopy" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="55%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </radialGradient>
            <radialGradient id="sakura-canopy" cx="40%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fce7f3" />
              <stop offset="55%" stopColor="#f9a8d4" />
              <stop offset="100%" stopColor="#ec4899" />
            </radialGradient>
          </defs>

          {/* 1. SUNNY SKY */}
          <rect x="0" y="0" width="1200" height="265" fill="url(#park-sky-grad)" />

          {/* Warm Glowing Sun */}
          <g transform="translate(1015, 72)">
            <circle cx="0" cy="0" r="64" fill="#fef08a" opacity="0.28" />
            <circle cx="0" cy="0" r="44" fill="#fde047" opacity="0.48" />
            <circle cx="0" cy="0" r="30" fill="#facc15" />
          </g>

          {/* Drifting Clouds */}
          <g className="anim-cloud-slow" opacity="0.94">
            <g transform="translate(210, 68) scale(0.95)">
              <ellipse cx="0" cy="10" rx="48" ry="18" fill="#ffffff" />
              <circle cx="-18" cy="0" r="22" fill="#ffffff" />
              <circle cx="10" cy="-6" r="27" fill="#ffffff" />
              <circle cx="34" cy="4" r="18" fill="#ffffff" />
            </g>
            <g transform="translate(590, 52) scale(0.82)">
              <ellipse cx="0" cy="10" rx="52" ry="18" fill="#ffffff" />
              <circle cx="-20" cy="-2" r="22" fill="#ffffff" />
              <circle cx="12" cy="-6" r="28" fill="#ffffff" />
              <circle cx="36" cy="4" r="18" fill="#ffffff" />
            </g>
          </g>

          {/* 2. ROLLING PARK HILLS (BALANCED HORIZON AT Y=195..235) */}
          <path d="M -50,210 Q 280,145 620,192 T 1250,182 L 1250,275 L -50,275 Z" fill="url(#far-hill-grad)" opacity="0.9" />
          <path d="M -50,228 Q 350,175 680,216 T 1250,210 L 1250,285 L -50,285 Z" fill="url(#mid-hill-grad)" />

          {/* Park Bushes Along the Horizon */}
          <g fill="#16a34a">
            <circle cx="130" cy="212" r="26" />
            <circle cx="170" cy="206" r="32" />
            <circle cx="215" cy="213" r="24" />
            <circle cx="390" cy="204" r="24" />
            <circle cx="430" cy="199" r="30" />
            <circle cx="775" cy="200" r="30" />
            <circle cx="815" cy="205" r="24" />
            <circle cx="990" cy="212" r="26" />
            <circle cx="1030" cy="206" r="32" />
            <circle cx="1075" cy="212" r="25" />
          </g>

          {/* Classic Park Lamp Posts Along the Fence */}
          {[310, 890].map((lx, idx) => (
            <g key={`lamp-${idx}`} transform={`translate(${lx}, 152)`}>
              <rect x="-3" y="0" width="6" height="68" fill="#1e293b" />
              <rect x="-7" y="62" width="14" height="8" rx="2" fill="#334155" />
              <path d="M -10,0 L 10,0 L 7,-14 L -7,-14 Z" fill="#fef08a" stroke="#1e293b" strokeWidth="2" />
              <polygon points="-13,-14 13,-14 0,-22" fill="#1e293b" />
            </g>
          ))}

          {/* Wooden Park Fence Along the Horizon (y=202..224) */}
          <g stroke="#92400e" strokeWidth="1.2">
            <rect x="40" y="202" width="1120" height="6" rx="3" fill="#d97706" />
            <rect x="40" y="214" width="1120" height="6" rx="3" fill="#b45309" />
            {Array.from({ length: 29 }).map((_, i) => (
              <rect key={`post-${i}`} x={50 + i * 39} y="194" width="8" height="32" rx="3" fill="#f59e0b" />
            ))}
          </g>

          {/* 3. LUSH GREEN PARK LAWN (Y=222 TO 680 — FRAMING THE LARGE DOHYO RING) */}
          <path d="M 0,222 Q 600,204 1200,222 L 1200,680 L 0,680 Z" fill="url(#park-lawn-grad)" />

          {/* Perspective Mowed Lawn Stripes */}
          <g opacity="0.16" fill="#86efac">
            <polygon points="450,214 515,214 360,680 230,680" />
            <polygon points="568,214 632,214 655,680 545,680" />
            <polygon points="685,214 750,214 970,680 840,680" />
          </g>

          {/* Park Benches Tucked Naturally Next to the Fence & Trees (Not Floating in the Lawn) */}
          <g transform="translate(225, 224)">
            <ellipse cx="0" cy="22" rx="34" ry="5" fill="rgba(0,0,0,0.18)" />
            <rect x="-28" y="0" width="56" height="6" rx="2" fill="#b45309" stroke="#78350f" strokeWidth="1.2" />
            <rect x="-30" y="8" width="60" height="5" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.2" />
            <rect x="-22" y="13" width="6" height="10" fill="#451a03" />
            <rect x="16" y="13" width="6" height="10" fill="#451a03" />
          </g>

          <g transform="translate(975, 224)">
            <ellipse cx="0" cy="22" rx="34" ry="5" fill="rgba(0,0,0,0.18)" />
            <rect x="-28" y="0" width="56" height="6" rx="2" fill="#b45309" stroke="#78350f" strokeWidth="1.2" />
            <rect x="-30" y="8" width="60" height="5" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1.2" />
            <rect x="-22" y="13" width="6" height="10" fill="#451a03" />
            <rect x="16" y="13" width="6" height="10" fill="#451a03" />
          </g>

          {/* Festive Blue & Red Sumo Nobori Flags Flanking the Park Arena */}
          <g transform="translate(155, 175)">
            <ellipse cx="0" cy="88" rx="14" ry="4" fill="rgba(0,0,0,0.22)" />
            <rect x="-2.5" y="0" width="5" height="88" rx="2" fill="#78350f" />
            <rect x="2.5" y="4" width="26" height="56" rx="3" fill="#0055fe" stroke="#ffffff" strokeWidth="2" />
            <circle cx="15.5" cy="22" r="6" fill="#fbbf24" />
            <rect x="10" y="34" width="11" height="18" rx="2" fill="#ffffff" opacity="0.85" />
          </g>

          <g transform="translate(1045, 175)">
            <ellipse cx="0" cy="88" rx="14" ry="4" fill="rgba(0,0,0,0.22)" />
            <rect x="-2.5" y="0" width="5" height="88" rx="2" fill="#78350f" />
            <rect x="-28.5" y="4" width="26" height="56" rx="3" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
            <circle cx="-15.5" cy="22" r="6" fill="#fbbf24" />
            <rect x="-21" y="34" width="11" height="18" rx="2" fill="#ffffff" opacity="0.85" />
          </g>

          {/* Large Lush Sakura & Green Park Trees Framing Left & Right */}
          <g className="anim-tree-sway" transform="translate(68, 258)">
            <ellipse cx="0" cy="14" rx="42" ry="10" fill="rgba(0,0,0,0.22)" />
            <path d="M -15,14 Q -10,-48 -18,-98 L 18,-98 Q 10,-48 16,14 Z" fill="#78350f" />
            <circle cx="-36" cy="-124" r="48" fill="url(#sakura-canopy)" />
            <circle cx="34" cy="-126" r="46" fill="url(#sakura-canopy)" />
            <circle cx="0" cy="-152" r="56" fill="url(#sakura-canopy)" />
          </g>

          <g className="anim-tree-sway" transform="translate(1132, 258)">
            <ellipse cx="0" cy="14" rx="42" ry="10" fill="rgba(0,0,0,0.22)" />
            <path d="M -15,14 Q -10,-48 -18,-98 L 18,-98 Q 10,-48 16,14 Z" fill="#78350f" />
            <circle cx="-34" cy="-126" r="46" fill="url(#green-canopy)" />
            <circle cx="36" cy="-124" r="48" fill="url(#green-canopy)" />
            <circle cx="0" cy="-152" r="56" fill="url(#green-canopy)" />
          </g>
        </svg>
      </div>

      {/* FOREGROUND GAME CONTENT */}
      <div className="relative z-30 flex flex-col justify-between h-full p-2 sm:p-3 md:p-4 overflow-y-auto">
        {children}
      </div>
    </div>
  );
};
