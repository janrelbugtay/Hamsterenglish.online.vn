import React, { useState, useEffect } from 'react';
import {
  getStudentCharacter,
  getActiveHamsterGear,
  HamsterGearTier,
} from '../lib/studentCharacters';

export interface LiveRewardDelta {
  amount: number;
  key: number;
  unlockedGear?: HamsterGearTier | null;
  comboStep?: number;
}

export interface SquidHamsterSpriteProps {
  number: number;
  name?: string;
  size?: number;
  dollars?: number;
  showBadge?: boolean;
  showGear?: boolean;
  equippedGearId?: string | null;
  avatarStyle?: 'cute' | 'classic';
  className?: string;
  avatarUrl?: string | null;
  liveDelta?: LiveRewardDelta | null;
}

function getSizeClass(size: number): string {
  if (size <= 21) return 'w-5 h-5';
  if (size <= 24) return 'w-6 h-6';
  if (size <= 32) return 'w-8 h-8';
  if (size <= 40) return 'w-10 h-10';
  if (size <= 56) return 'w-14 h-14';
  if (size <= 64) return 'w-16 h-16';
  if (size <= 74) return 'w-[72px] h-[72px]';
  if (size <= 90) return 'w-[88px] h-[88px]';
  if (size <= 122) return 'w-[120px] h-[120px]';
  if (size <= 136) return 'w-32 h-32';
  return 'w-[150px] h-[150px]';
}

const HatArtwork: React.FC<{ gearId: HamsterGearTier['id'] }> = ({ gearId }) => {
  switch (gearId) {
    case 'sprout':
      return (
        <g>
          <path
            d="M0,4 C0,-6 1,-12 0,-18"
            stroke="#15803d"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M0,-14 C-4,-24 -18,-24 -19,-14 C-19,-6 -7,-6 0,-13 Z"
            fill="url(#sproutLeafGrad)"
            stroke="#14532d"
            strokeWidth="1.4"
          />
          <path
            d="M0,-16 C5,-26 19,-25 20,-15 C20,-7 8,-7 0,-15 Z"
            fill="url(#sproutLeafGrad)"
            stroke="#14532d"
            strokeWidth="1.4"
          />
          <circle cx="-10" cy="-16" r="1.8" fill="#dcfce7" opacity="0.9" />
          <circle cx="11" cy="-17" r="1.6" fill="#dcfce7" opacity="0.9" />
        </g>
      );

    case 'party_cone':
      return (
        <g>
          <polygon
            points="-15,4 15,4 0,-25"
            fill="url(#partyConeGrad)"
            stroke="#831843"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <ellipse cx="0" cy="4" rx="16" ry="3.5" fill="#fde047" stroke="#a16207" strokeWidth="1.2" />
          <circle cx="-5" cy="-4" r="2.3" fill="#fef08a" />
          <circle cx="5" cy="-8" r="2.1" fill="#67e8f9" />
          <circle cx="-2" cy="-15" r="1.9" fill="#bbf7d0" />
          <circle cx="0" cy="-27" r="5" fill="#facc15" stroke="#a16207" strokeWidth="1.3" />
          <circle cx="-1.5" cy="-28.5" r="1.5" fill="#fef9c3" />
        </g>
      );

    case 'explorer_cap':
      return (
        <g>
          <path
            d="M-18,3 C-18,-13 18,-13 18,3 Z"
            fill="url(#scholarCapGrad)"
            stroke="#92400e"
            strokeWidth="1.5"
          />
          <path
            d="M-16,2 C-4,-1 14,-1 25,4 C23,8 6,7 -16,4 Z"
            fill="#1d4ed8"
            stroke="#1e3a8a"
            strokeWidth="1.3"
          />
          <circle cx="0" cy="-10" r="2.4" fill="#1d4ed8" />
          <polygon
            points="0,-7 1.6,-3.8 5,-3.3 2.5,-1 3.1,2.2 0,0.6 -3.1,2.2 -2.5,-1 -5,-3.3 -1.6,-3.8"
            fill="#ffffff"
          />
        </g>
      );

    case 'star_shades':
      return (
        <g>
          <path
            d="M-19,4 Q0,-8 19,4"
            stroke="#f59e0b"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
          <polygon
            points="-9,-4 -7,-9 -2,-9 -6,-12 -4,-17 -9,-14 -14,-17 -12,-12 -16,-9 -11,-9"
            fill="#fde047"
            stroke="#b45309"
            strokeWidth="1.2"
          />
          <polygon
            points="9,-4 11,-9 16,-9 12,-12 14,-17 9,-14 4,-17 6,-12 2,-9 7,-9"
            fill="#fde047"
            stroke="#b45309"
            strokeWidth="1.2"
          />
          <circle cx="0" cy="-3" r="3" fill="#10b981" stroke="#065f46" strokeWidth="1.2" />
        </g>
      );

    case 'artist_beret':
      return (
        <g>
          <path
            d="M-21,2 C-24,-10 -6,-18 14,-13 C24,-10 23,1 15,3 C5,5 -13,5 -21,2 Z"
            fill="url(#beretGrad)"
            stroke="#881337"
            strokeWidth="1.5"
          />
          <rect x="-15" y="1.5" width="30" height="3.5" rx="1.7" fill="#1e293b" />
          <path d="M2,-14 Q4,-19 8,-18" stroke="#881337" strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <circle cx="-8" cy="-6" r="2.2" fill="#fda4af" opacity="0.65" />
        </g>
      );

    case 'propeller_cap':
      return (
        <g>
          <path d="M-18,4 C-18,-12 18,-12 18,4 Z" fill="#06b6d4" stroke="#0e7490" strokeWidth="1.5" />
          <path d="M-8,4 C-8,-11 8,-11 8,4 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
          <rect x="-19" y="2" width="38" height="3.8" rx="1.9" fill="#ec4899" stroke="#9d174d" strokeWidth="1.1" />
          <line x1="0" y1="-9" x2="0" y2="-16" stroke="#475569" strokeWidth="2.4" />
          <ellipse cx="-9" cy="-16" rx="9" ry="2.4" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
          <ellipse cx="9" cy="-16" rx="9" ry="2.4" fill="#22c55e" stroke="#166534" strokeWidth="1" />
          <circle cx="0" cy="-16" r="2.8" fill="#fde047" stroke="#a16207" strokeWidth="1.1" />
        </g>
      );

    case 'wizard_hat':
      return (
        <g>
          <ellipse cx="0" cy="3.5" rx="24" ry="5" fill="#312e81" stroke="#1e1b4b" strokeWidth="1.5" />
          <path
            d="M-16,3 L-3,-26 C0,-31 7,-29 11,-24 L6,-16 L16,3 Z"
            fill="url(#wizardGrad)"
            stroke="#1e1b4b"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M-15,1 Q0,4 15,1" stroke="#facc15" strokeWidth="3" fill="none" />
          <circle cx="-3" cy="-9" r="2.2" fill="#fde047" />
          <path d="M4,-16 C1,-16 0,-13 2,-11 C0,-11 -2,-14 0,-17 C1,-18 3,-18 4,-16 Z" fill="#fef08a" />
        </g>
      );

    case 'dj_headphones':
      return (
        <g>
          <path
            d="M-24,14 C-25,-12 25,-12 24,14"
            stroke="url(#goldCrownGrad)"
            strokeWidth="5"
            fill="none"
            strokeLinecap="round"
          />
          <rect x="-28" y="8" width="7.5" height="13" rx="3.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1.4" />
          <rect x="20.5" y="8" width="7.5" height="13" rx="3.5" fill="#f59e0b" stroke="#92400e" strokeWidth="1.4" />
          <circle cx="0" cy="-6" r="3.5" fill="#2dd4bf" stroke="#0f766e" strokeWidth="1.2" />
        </g>
      );

    case 'royal_crown':
      return (
        <g>
          <path
            d="M-18,4 L-21,-14 L-10,-5 L0,-20 L10,-5 L21,-14 L18,4 Z"
            fill="url(#goldCrownGrad)"
            stroke="#92400e"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <rect x="-18" y="1" width="36" height="4.5" rx="2" fill="#dc2626" stroke="#92400e" strokeWidth="1.2" />
          <circle cx="0" cy="-6" r="3.2" fill="#10b981" stroke="#ffffff" strokeWidth="0.9" />
          <circle cx="-10" cy="-2" r="2.2" fill="#ef4444" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="10" cy="-2" r="2.2" fill="#3b82f6" stroke="#ffffff" strokeWidth="0.8" />
          <circle cx="-21" cy="-15" r="2.2" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
          <circle cx="0" cy="-21.5" r="2.6" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
          <circle cx="21" cy="-15" r="2.2" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
        </g>
      );

    case 'champion_wings':
      return (
        <g>
          <path
            d="M-17,1 C-29,-3 -34,-13 -26,-17 C-22,-18 -19,-13 -16,-9 C-23,-11 -26,-6 -17,1 Z"
            fill="#fef08a"
            stroke="#ca8a04"
            strokeWidth="1.3"
          />
          <path
            d="M17,1 C29,-3 34,-13 26,-17 C22,-18 19,-13 16,-9 C23,-11 26,-6 17,1 Z"
            fill="#fef08a"
            stroke="#ca8a04"
            strokeWidth="1.3"
          />
          <path
            d="M-16,4 L-19,-13 L-9,-5 L0,-20 L9,-5 L19,-13 L16,4 Z"
            fill="url(#goldCrownGrad)"
            stroke="#92400e"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-6" r="3.3" fill="#10b981" stroke="#ffffff" strokeWidth="1" />
          <circle cx="-9" cy="-2" r="2" fill="#ec4899" />
          <circle cx="9" cy="-2" r="2" fill="#06b6d4" />
        </g>
      );

    case 'cosmic_legend':
      return (
        <g>
          <ellipse
            cx="0"
            cy="-16"
            rx="21"
            ry="5.5"
            fill="none"
            stroke="#fde047"
            strokeWidth="4"
          />
          <ellipse
            cx="0"
            cy="-16"
            rx="21"
            ry="5.5"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1.4"
          />
          <path
            d="M-14,3 L-16,-10 L-7,-4 L0,-15 L7,-4 L16,-10 L14,3 Z"
            fill="url(#cosmicCrownGrad)"
            stroke="#581c87"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="-4" r="2.8" fill="#fef08a" />
          <polygon points="-25,-16 -22,-18 -20,-21 -18,-18 -15,-16 -18,-14 -20,-11 -22,-14" fill="#fef08a" />
          <polygon points="25,-16 22,-18 20,-21 18,-18 15,-16 18,-14 20,-11 22,-14" fill="#fef08a" />
        </g>
      );
  }
};

const SideItemArtwork: React.FC<{ gearId: HamsterGearTier['id'] }> = ({ gearId }) => {
  switch (gearId) {
    case 'artist_beret':
      return (
        <g transform="translate(82, 73) rotate(22)">
          <rect x="-2" y="-12" width="4" height="18" rx="2" fill="#f59e0b" stroke="#92400e" strokeWidth="1.2" />
          <path d="M-3,-12 L3,-12 L0,-20 Z" fill="#ec4899" stroke="#831843" strokeWidth="1.1" />
        </g>
      );
    case 'propeller_cap':
      return (
        <g transform="translate(82, 72)">
          <line x1="0" y1="0" x2="0" y2="14" stroke="#92400e" strokeWidth="2" />
          <circle cx="0" cy="-2" r="7" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.2" />
          <path d="M0,-2 L7,-2 A7,7 0 0,0 0,-9 Z" fill="#facc15" />
          <path d="M0,-2 L-7,-2 A7,7 0 0,0 0,5 Z" fill="#f43f5e" />
          <circle cx="0" cy="-2" r="2" fill="#ffffff" />
        </g>
      );
    case 'wizard_hat':
      return (
        <g transform="translate(83, 72) rotate(-18)">
          <rect x="-1.8" y="-8" width="3.6" height="20" rx="1.8" fill="#7c3aed" stroke="#3b0764" strokeWidth="1.2" />
          <polygon
            points="0,-17 2.5,-11.5 8.5,-11 4,-7 5.2,-1 0,-4.2 -5.2,-1 -4,-7 -8.5,-11 -2.5,-11.5"
            fill="#fde047"
            stroke="#ca8a04"
            strokeWidth="1.2"
          />
        </g>
      );
    case 'dj_headphones':
      return (
        <g transform="translate(83, 66)">
          <path
            d="M-3,6 L-3,-6 L6,-8 L6,4"
            stroke="#f59e0b"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="-5" cy="6" r="3.2" fill="#f59e0b" />
          <circle cx="4" cy="4" r="3.2" fill="#f59e0b" />
        </g>
      );
    case 'royal_crown':
      return (
        <g transform="translate(82, 75)">
          <polygon
            points="0,-9 8,-2 5,8 -5,8 -8,-2"
            fill="#10b981"
            stroke="#064e3b"
            strokeWidth="1.3"
          />
          <polygon points="0,-6 4,-1 0,5 -4,-1" fill="#6ee7b7" />
        </g>
      );
    case 'champion_wings':
      return (
        <g transform="translate(82, 73)">
          <path
            d="M-7,-9 L7,-9 L5,1 C4,5 -4,5 -5,1 Z"
            fill="url(#goldCrownGrad)"
            stroke="#92400e"
            strokeWidth="1.3"
          />
          <rect x="-2" y="3" width="4" height="4" fill="#ca8a04" />
          <rect x="-6" y="7" width="12" height="3" rx="1.2" fill="#92400e" />
        </g>
      );
    case 'cosmic_legend':
      return (
        <g transform="translate(83, 71) rotate(-14)">
          <rect x="-1.8" y="-6" width="3.6" height="20" rx="1.8" fill="#eab308" stroke="#854d0e" strokeWidth="1.2" />
          <polygon points="0,-18 7,-10 0,-3 -7,-10" fill="#67e8f9" stroke="#0e7490" strokeWidth="1.3" />
          <circle cx="0" cy="-10" r="2.2" fill="#ffffff" />
        </g>
      );
    default:
      return null;
  }
};

export const SquidHamsterSprite: React.FC<SquidHamsterSpriteProps> = ({
  number,
  name,
  size = 120,
  dollars,
  showBadge = true,
  showGear = true,
  equippedGearId,
  avatarStyle = 'cute',
  className = '',
  avatarUrl,
  liveDelta = null,
}) => {
  const char = getStudentCharacter(number || 1, avatarStyle);
  const activeGear = showGear ? getActiveHamsterGear(dollars, equippedGearId) : null;

  const [imgSrc, setImgSrc] = useState<string>(() => avatarUrl || char.localUrl);
  const [failCount, setFailCount] = useState<number>(0);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    setImgSrc(avatarUrl || char.localUrl);
    setFailCount(0);
  }, [avatarUrl, char.localUrl, char.id, avatarStyle]);

  useEffect(() => {
    if (liveDelta) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 1250);
      return () => clearTimeout(timer);
    }
  }, [liveDelta]);

  const handleError = () => {
    setFailCount((prev) => {
      const next = prev + 1;
      if (next === 1) {
        setImgSrc(char.classicUrl);
      } else if (next === 2) {
        setImgSrc(char.driveUrl);
      } else if (next === 3) {
        setImgSrc('/images/student_001.png');
      }
      return next;
    });
  };

  const isPositiveGlow = Boolean(liveDelta && liveDelta.amount >= 0);
  const isNegativeGlow = Boolean(liveDelta && liveDelta.amount < 0);
  const anchor =
    avatarStyle === 'classic'
      ? { topPct: 14, leftPct: 50, tiltDeg: 0, scale: 0.95 }
      : char.breed.headAnchor;

  const sizeClass = getSizeClass(size);
  const showHatOverlay = showGear && size >= 36 && (activeGear !== null || (dollars !== undefined && dollars < 0));
  const showSideAccessory = showGear && size >= 62 && activeGear !== null;

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${sizeClass} ${className}`}
    >
      {/* RADIANT REWARD / DEDUCTION GLOWING AURA */}
      {liveDelta && (
        <div
          key={`glow_${liveDelta.key}`}
          className={`absolute -inset-3 rounded-full pointer-events-none z-0 animate-character-glow ${
            isPositiveGlow
              ? 'bg-radial from-amber-300/85 via-emerald-400/45 to-transparent ring-4 ring-amber-300/70'
              : 'bg-radial from-rose-400/75 via-pink-500/35 to-transparent ring-4 ring-rose-400/70'
          }`}
        />
      )}

      {/* HIGH-RANK PASSIVE LEGEND SHIMMER ($30+) */}
      {!liveDelta && dollars !== undefined && dollars >= 30 && size >= 68 && (
        <div className="absolute -inset-1.5 rounded-full pointer-events-none z-0 bg-radial from-amber-200/45 via-emerald-200/15 to-transparent" />
      )}

      {/* SPARKLE STARBURST PARTICLES WHEN ADDING DOLLARS */}
      {liveDelta && isPositiveGlow && size >= 50 && (
        <svg
          key={`sparkles_${liveDelta.key}`}
          viewBox="0 0 100 100"
          className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+24px)] pointer-events-none z-30 animate-sparkle-orbit overflow-visible"
        >
          <polygon points="14,22 16,17 18,22 23,24 18,26 16,31 14,26 9,24" fill="#fde047" />
          <polygon points="86,20 88,15 90,20 95,22 90,24 88,29 86,24 81,22" fill="#34d399" />
          <polygon points="12,76 14,72 16,76 20,78 16,80 14,84 12,80 8,78" fill="#fbbf24" />
          <polygon points="88,76 90,71 92,76 97,78 92,80 90,85 88,80 83,78" fill="#fde047" />
          <circle cx="50" cy="6" r="3" fill="#fef08a" />
          <circle cx="94" cy="50" r="2.6" fill="#6ee7b7" />
        </svg>
      )}

      {/* HAMSTER CHARACTER PORTRAIT + COLLECTIBLE SVG HATS & ACCESSORIES */}
      <div
        className={`relative w-full h-full flex items-center justify-center z-10 transition-transform duration-200 ${
          isBouncing
            ? isNegativeGlow
              ? 'animate-shake'
              : 'animate-character-bounce'
            : ''
        } ${
          isBouncing && isPositiveGlow
            ? 'drop-shadow-[0_0_16px_rgba(250,204,21,0.9)]'
            : isBouncing && isNegativeGlow
              ? 'drop-shadow-[0_0_14px_rgba(244,63,94,0.8)]'
              : ''
        }`}
      >
        {failCount >= 4 ? (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="28" cy="28" r="13" fill="#f59e0b" />
            <circle cx="72" cy="28" r="13" fill="#f59e0b" />
            <circle cx="28" cy="28" r="7" fill="#fda4af" />
            <circle cx="72" cy="28" r="7" fill="#fda4af" />
            <ellipse cx="50" cy="56" rx="34" ry="32" fill="#fbbf24" />
            <ellipse cx="50" cy="64" rx="24" ry="20" fill="#fef3c7" />
            <circle cx="38" cy="48" r="4.5" fill="#1e293b" />
            <circle cx="62" cy="48" r="4.5" fill="#1e293b" />
            <ellipse cx="50" cy="55" rx="4" ry="3" fill="#fb7185" />
          </svg>
        ) : (
          <img
            src={imgSrc}
            alt={name || `${char.title} (#${char.tag})`}
            className={`w-full h-full object-contain select-none transition-all duration-200 ${
              avatarStyle === 'cute'
                ? 'mix-blend-multiply dark:mix-blend-normal dark:rounded-2xl'
                : 'drop-shadow-sm'
            }`}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={handleError}
          />
        )}

        {/* DYNAMIC DOLLAR-EVOLUTION HATS & SIDE ACCESSORIES */}
        {showHatOverlay && (
          <svg
            key={liveDelta?.unlockedGear ? `hat_unlock_${liveDelta.key}` : `hat_${activeGear?.id || 'neg'}`}
            viewBox="0 0 100 100"
            className={`absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20 ${
              liveDelta?.unlockedGear ? 'animate-hat-float' : ''
            }`}
          >
            <defs>
              <linearGradient id="sproutLeafGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
              <linearGradient id="partyConeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#db2777" />
              </linearGradient>
              <linearGradient id="scholarCapGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
              <linearGradient id="beretGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="100%" stopColor="#e11d48" />
              </linearGradient>
              <linearGradient id="wizardGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#312e81" />
              </linearGradient>
              <linearGradient id="goldCrownGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="55%" stopColor="#facc15" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              <linearGradient id="cosmicCrownGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="50%" stopColor="#ec4899" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>

            {activeGear ? (
              <>
                <g
                  transform={`translate(${anchor.leftPct}, ${anchor.topPct}) rotate(${anchor.tiltDeg}) scale(${anchor.scale})`}
                >
                  <HatArtwork gearId={activeGear.id} />
                </g>
                {showSideAccessory && <SideItemArtwork gearId={activeGear.id} />}
              </>
            ) : dollars !== undefined && dollars < 0 ? (
              /* Cute motivation bandage + sweat drop when negative balance */
              <g transform={`translate(${anchor.leftPct + 8}, ${anchor.topPct + 9}) rotate(14)`}>
                <rect x="-8" y="-3" width="16" height="6" rx="2.5" fill="#fed7aa" stroke="#c2410c" strokeWidth="1" />
                <line x1="-2" y1="-3" x2="-2" y2="3" stroke="#fb923c" strokeWidth="1" />
                <line x1="2" y1="-3" x2="2" y2="3" stroke="#fb923c" strokeWidth="1" />
                <path d="M13,2 C13,2 17,8 17,10.5 A3.2,3.2 0 1,1 10.6,10.5 C10.6,8 13,2 13,2 Z" fill="#38bdf8" />
              </g>
            ) : null}
          </svg>
        )}
      </div>

      {/* LIVE FLOATING DOLLAR POPUP + NEW ITEM UNLOCK BANNER */}
      {liveDelta && (
        <div
          key={`pop_${liveDelta.key}`}
          className="absolute -top-5 z-40 pointer-events-none animate-live-pop flex flex-col items-center gap-1"
        >
          <div
            className={`flex items-center gap-1 font-black px-3 py-1 rounded-full shadow-2xl border-2 border-white text-xs sm:text-sm tracking-tight whitespace-nowrap ${
              liveDelta.amount >= 0
                ? 'bg-gradient-to-r from-amber-400 via-emerald-500 to-teal-500 text-white ring-2 ring-amber-300/80'
                : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white ring-2 ring-rose-300/70'
            }`}
          >
            <span>
              {liveDelta.amount >= 0 ? `+$${liveDelta.amount}` : `-$${Math.abs(liveDelta.amount)}`}
            </span>
            <span className="text-[11px]">{liveDelta.amount >= 0 ? '✨' : '⚠️'}</span>
          </div>

          {liveDelta.unlockedGear && (
            <div className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shadow-lg border border-white whitespace-nowrap flex items-center gap-1">
              <span>{liveDelta.unlockedGear.badgeEmoji}</span>
              <span>NEW! {liveDelta.unlockedGear.shortName}</span>
            </div>
          )}
        </div>
      )}

      {/* PROMINENT DOLLAR BADGE IN TOP-RIGHT + EQUIPPED ITEM MINI ICON */}
      {showBadge && dollars !== undefined && (
        <div
          className={`absolute -top-1.5 -right-1.5 rounded-full text-white font-black flex items-center justify-center gap-1 shadow-lg border-[2.5px] border-white z-30 pointer-events-none transform transition-all tabular-nums tracking-tight ${
            isBouncing && isPositiveGlow ? 'scale-118 ring-4 ring-amber-300/80' : ''
          } ${
            dollars < 0
              ? 'bg-rose-600 ring-2 ring-rose-500/30 shadow-rose-600/30'
              : dollars >= 30
                ? 'bg-gradient-to-r from-amber-500 to-emerald-600 ring-2 ring-amber-400/40'
                : 'bg-[#10b981] ring-2 ring-emerald-500/25'
          } ${
            size >= 90
              ? 'min-w-[44px] h-[32px] px-2.5 text-sm sm:text-base'
              : 'min-w-[28px] h-[24px] px-1.5 text-xs'
          }`}
        >
          <span>{dollars < 0 ? `-$${Math.abs(dollars)}` : `$${dollars}`}</span>
        </div>
      )}

      {/* SUBTLE UNLOCKED HAT / ITEM TAG IN BOTTOM-LEFT ON FULL CARDS */}
      {showBadge && showGear && activeGear && size >= 110 && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-2 py-0.5 rounded-full bg-white/95 dark:bg-slate-800/95 border border-amber-200/90 dark:border-slate-700 shadow-xs flex items-center gap-1 whitespace-nowrap"
          title={`${activeGear.name}: ${activeGear.description}`}
        >
          <span className="text-[11px] leading-none">{activeGear.badgeEmoji}</span>
          <span className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 leading-none">
            {activeGear.shortName}
          </span>
        </div>
      )}
    </div>
  );
};
