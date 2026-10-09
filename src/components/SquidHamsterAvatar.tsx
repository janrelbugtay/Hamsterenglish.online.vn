import React from 'react';

export interface SquidHamsterProps {
  id?: string;
  name?: string;
  seed?: number;
  size?: number | string;
  className?: string;
  type?: 'player' | 'guard-circle' | 'guard-triangle' | 'guard-square' | 'frontman' | 'leader';
  tracksuitColor?: string;
  playerNumber?: string;
  points?: number;
  showBadge?: boolean;
  currencySymbol?: string;
}

// Preset color themes inspired by ClassDojo + Squid Game
const HAMSTER_FUR_THEMES = [
  { fur: '#f59e0b', furLight: '#fde68a', shadow: '#d97706', ear: '#fca5a5', belly: '#fef3c7' }, // Golden
  { fur: '#ec4899', furLight: '#fbcfe8', shadow: '#db2777', ear: '#f472b6', belly: '#fdf2f8' }, // Pink Dojo
  { fur: '#3b82f6', furLight: '#bfdbfe', shadow: '#2563eb', ear: '#93c5fd', belly: '#eff6ff' }, // Blue Dojo
  { fur: '#8b5cf6', furLight: '#ddd6fe', shadow: '#7c3aed', ear: '#c4b5fd', belly: '#f5f3ff' }, // Purple
  { fur: '#10b981', furLight: '#a7f3d0', shadow: '#059669', ear: '#6ee7b7', belly: '#ecfdf5' }, // Mint
  { fur: '#f97316', furLight: '#fed7aa', shadow: '#ea580c', ear: '#fdba74', belly: '#fff7ed' }, // Coral
  { fur: '#06b6d4', furLight: '#cffafe', shadow: '#0891b2', ear: '#67e8f9', belly: '#f0fdfa' }, // Cyan
  { fur: '#eab308', furLight: '#fef08a', shadow: '#ca8a04', ear: '#fde047', belly: '#fefce8' }, // Yellow
  { fur: '#d97706', furLight: '#fde68a', shadow: '#b45309', ear: '#fca5a5', belly: '#fffbeb' }, // Caramel
  { fur: '#64748b', furLight: '#e2e8f0', shadow: '#475569', ear: '#cbd5e1', belly: '#f8fafc' }, // Ash Silver
];

const TRACKSUIT_COLORS = [
  '#0d6e4f', // Iconic Squid Game Forest Green
  '#0a5c41', // Darker Teal Green
  '#0f766e', // Deep Teal
  '#0369a1', // Player Blue
  '#be185d', // Guard Pink
  '#15803d', // Shamrock Green
  '#047857', // Emerald Tracksuit
];

export const SquidHamsterAvatar: React.FC<SquidHamsterProps> = ({
  name = 'Player',
  seed,
  size = 96,
  className = '',
  type = 'player',
  tracksuitColor,
  playerNumber,
  points,
  showBadge = true,
  currencySymbol = '$',
}) => {
  // Generate deterministic properties based on student name or seed
  const numSeed = seed ?? (name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0));
  const theme = HAMSTER_FUR_THEMES[Math.abs(numSeed) % HAMSTER_FUR_THEMES.length];
  const suitColor = tracksuitColor || TRACKSUIT_COLORS[Math.abs(numSeed * 7) % TRACKSUIT_COLORS.length];
  const derivedNumber = playerNumber || String((Math.abs(numSeed * 13) % 456) + 1).padStart(3, '0');
  const moodVariant = Math.abs(numSeed * 3) % 3; // 0: happy, 1: wink, 2: excited
  const accessory = Math.abs(numSeed * 5) % 4; // 0: dalgona star, 1: squid game card, 2: medal, 3: hands on hips

  const isGuard = type.startsWith('guard');
  const guardShape = type === 'guard-circle' ? 'circle' : type === 'guard-triangle' ? 'triangle' : 'square';

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg 
        viewBox="0 0 120 125" 
        className="w-full h-full overflow-visible drop-shadow-md transition-transform duration-200 hover:scale-105"
      >
        <defs>
          <filter id={`shadow-${numSeed}`} x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodOpacity="0.2" />
          </filter>
          <linearGradient id={`suit-grad-${numSeed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isGuard ? '#f43f5e' : suitColor} />
            <stop offset="100%" stopColor={isGuard ? '#be123c' : '#04422e'} />
          </linearGradient>
          <linearGradient id={`fur-grad-${numSeed}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.furLight} />
            <stop offset="100%" stopColor={theme.fur} />
          </linearGradient>
        </defs>

        {/* Ground shadow */}
        <ellipse cx="60" cy="118" rx="34" ry="6" fill="rgba(0,0,0,0.12)" />

        {/* SQUID GAME TRACKSUIT / BODY */}
        {/* Tracksuit pants & legs */}
        <g id="legs">
          {/* Left leg */}
          <rect x="42" y="94" width="14" height="18" rx="6" fill={`url(#suit-grad-${numSeed})`} />
          <rect x="43" y="96" width="3" height="15" rx="1.5" fill="#ffffff" opacity="0.9" />
          {/* Right leg */}
          <rect x="64" y="94" width="14" height="18" rx="6" fill={`url(#suit-grad-${numSeed})`} />
          <rect x="74" y="96" width="3" height="15" rx="1.5" fill="#ffffff" opacity="0.9" />
          {/* White Squid Game slip-on shoes */}
          <ellipse cx="49" cy="112" rx="9" ry="4.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <ellipse cx="71" cy="112" rx="9" ry="4.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
        </g>

        {/* Torso in Squid Game Tracksuit Jacket */}
        <path 
          d="M 32,68 C 30,86 38,102 60,102 C 82,102 90,86 88,68 C 88,62 82,58 60,58 C 38,58 32,62 32,68 Z" 
          fill={`url(#suit-grad-${numSeed})`} 
          stroke={isGuard ? '#9f1239' : '#033423'} 
          strokeWidth="1.5" 
        />

        {/* White Tracksuit Stripes across shoulders and down sleeves */}
        <path d="M 34,70 Q 60,65 86,70" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.95" />
        <path d="M 35,74 Q 60,69 85,74" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9" />

        {/* Zipper down the middle with cream/white collar opening */}
        <path d="M 60,58 L 60,98" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 1" />
        <polygon points="56,58 64,58 60,68" fill="#ffffff" />

        {/* Player Number Tag (e.g. 456) or Guard symbol */}
        {isGuard ? (
          <circle cx="60" cy="78" r="8" fill="#18181b" />
        ) : (
          <g transform="translate(47, 73)">
            <rect x="0" y="0" width="26" height="11" rx="3" fill="#ffffff" stroke="#04422e" strokeWidth="0.8" />
            <text x="13" y="8.5" fontSize="8" fontWeight="bold" textAnchor="middle" fill="#04422e" fontFamily="monospace">
              {derivedNumber}
            </text>
          </g>
        )}

        {/* Guard Symbol if guard */}
        {isGuard && guardShape === 'circle' && (
          <circle cx="60" cy="78" r="4.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        )}
        {isGuard && guardShape === 'triangle' && (
          <polygon points="60,73.5 55.5,81.5 64.5,81.5" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        )}
        {isGuard && guardShape === 'square' && (
          <rect x="56" y="74" width="8" height="8" fill="none" stroke="#ffffff" strokeWidth="1.5" />
        )}

        {/* CUTE HAMSTER HEAD & CHUBBY CHEEKS */}
        {/* Left Ear */}
        <g>
          <circle cx="34" cy="24" r="13" fill={`url(#fur-grad-${numSeed})`} stroke={theme.shadow} strokeWidth="1.2" />
          <circle cx="34" cy="24" r="7.5" fill={theme.ear} />
        </g>
        {/* Right Ear */}
        <g>
          <circle cx="86" cy="24" r="13" fill={`url(#fur-grad-${numSeed})`} stroke={theme.shadow} strokeWidth="1.2" />
          <circle cx="86" cy="24" r="7.5" fill={theme.ear} />
        </g>

        {/* Main Head (fluffy chubby hamster silhouette) */}
        <path 
          d="M 32,38 C 22,46 20,62 36,66 C 44,68 52,66 60,66 C 68,66 76,68 84,66 C 100,62 98,46 88,38 C 84,24 36,24 32,38 Z" 
          fill={`url(#fur-grad-${numSeed})`} 
          stroke={theme.shadow} 
          strokeWidth="1.5"
        />

        {/* Lighter muzzle / belly area */}
        <ellipse cx="60" cy="52" rx="19" ry="13" fill={theme.belly} />

        {/* Soft Pink Hamster Cheeks (Rosy blush) */}
        <ellipse cx="34" cy="52" rx="6.5" ry="4" fill="#fb7185" opacity="0.5" />
        <ellipse cx="86" cy="52" rx="6.5" ry="4" fill="#fb7185" opacity="0.5" />

        {/* Squid Game Green Bandana or Headband (cute touch!) */}
        {numSeed % 2 === 0 && (
          <path d="M 30,32 Q 60,26 90,32 L 91,37 Q 60,31 29,37 Z" fill={suitColor} stroke="#ffffff" strokeWidth="0.8" />
        )}

        {/* Cute Big Hamster Eyes */}
        {moodVariant === 1 ? (
          // Winking Hamster
          <g>
            <circle cx="48" cy="42" r="5.5" fill="#1e1b4b" />
            <circle cx="46.5" cy="40" r="2.2" fill="#ffffff" />
            <circle cx="49.5" cy="43.5" r="1" fill="#ffffff" />
            <path d="M 68,43 Q 73,38 78,43" stroke="#1e1b4b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        ) : (
          // Big sparkly eyes
          <g>
            <circle cx="47" cy="42" r="5.5" fill="#1e1b4b" />
            <circle cx="45.5" cy="40" r="2.2" fill="#ffffff" />
            <circle cx="48.5" cy="43.5" r="1" fill="#ffffff" />

            <circle cx="73" cy="42" r="5.5" fill="#1e1b4b" />
            <circle cx="71.5" cy="40" r="2.2" fill="#ffffff" />
            <circle cx="74.5" cy="43.5" r="1" fill="#ffffff" />
          </g>
        )}

        {/* Tiny Pink Hamster Nose */}
        <ellipse cx="60" cy="47" rx="2.5" ry="1.8" fill="#f43f5e" />

        {/* Cute Hamster Mouth & Buck Tooth */}
        <path d="M 57,49 Q 60,52 63,49" stroke="#713f12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <rect x="58.8" y="49.5" width="2.4" height="2.5" rx="0.5" fill="#ffffff" stroke="#713f12" strokeWidth="0.6" />

        {/* Hamster Whiskers */}
        <g stroke="#92400e" strokeWidth="1" strokeLinecap="round" opacity="0.6">
          <line x1="28" y1="48" x2="16" y2="46" />
          <line x1="28" y1="52" x2="15" y2="54" />
          <line x1="92" y1="48" x2="104" y2="46" />
          <line x1="92" y1="52" x2="105" y2="54" />
        </g>

        {/* ARMS & LITTLE PAWS */}
        {/* Left Arm */}
        <g>
          <path d="M 32,70 Q 22,78 30,86 Q 36,88 38,80 Z" fill={`url(#suit-grad-${numSeed})`} stroke={isGuard ? '#9f1239' : '#033423'} strokeWidth="1.2" />
          <circle cx="30" cy="85" r="4.5" fill={theme.belly} stroke={theme.shadow} strokeWidth="0.8" />
        </g>
        {/* Right Arm */}
        <g>
          <path d="M 88,70 Q 98,78 90,86 Q 84,88 82,80 Z" fill={`url(#suit-grad-${numSeed})`} stroke={isGuard ? '#9f1239' : '#033423'} strokeWidth="1.2" />
          <circle cx="90" cy="85" r="4.5" fill={theme.belly} stroke={theme.shadow} strokeWidth="0.8" />
        </g>

        {/* CUTE ACCESSORY (Dalgona Umbrella/Star or Squid Game Invitation Card) */}
        {accessory === 0 && (
          // Dalgona candy cookie in hand!
          <g transform="translate(86, 75)">
            <circle cx="6" cy="6" r="7" fill="#f59e0b" stroke="#d97706" strokeWidth="1" />
            <polygon points="6,2 7.2,5 10,5 7.8,6.8 8.5,9.5 6,8 3.5,9.5 4.2,6.8 2,5 4.8,5" fill="#b45309" />
          </g>
        )}
        {accessory === 1 && (
          // Squid Game Brown Invitation Card
          <g transform="translate(84, 76) rotate(-15)">
            <rect x="0" y="0" width="11" height="7" rx="1" fill="#78350f" stroke="#451a03" strokeWidth="0.8" />
            <circle cx="3" cy="3.5" r="1.2" fill="#fef08a" />
            <polygon points="6,2 4.8,5 7.2,5" fill="#fef08a" />
            <rect x="8" y="2.2" width="2" height="2.5" fill="#fef08a" />
          </g>
        )}
      </svg>

      {/* SQUID GAME DOLLARS BADGE IN TOP-RIGHT */}
      {showBadge && points !== undefined && (
        <div 
          className="absolute -top-1.5 -right-1.5 min-w-[28px] h-[26px] px-1.5 rounded-full bg-[#10b981] text-white font-black text-[11px] sm:text-xs flex items-center justify-center shadow-md border-2 border-white ring-2 ring-emerald-500/20 z-20 pointer-events-none transform transition-transform hover:scale-110 tracking-tight"
        >
          {currencySymbol}{points}
        </div>
      )}
    </div>
  );
};

// WHOLE CLASS AVATAR (Group of cute colorful Squid Game hamsters huddled together)
export const SquidClassGroupAvatar: React.FC<{ size?: number; points?: number; currencySymbol?: string }> = ({ size = 96, points = 130, currencySymbol = '$' }) => {
  return (
    <div className="relative inline-flex items-center justify-center select-none" style={{ width: size, height: size }}>
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Background Hamsters */}
        <div className="absolute -top-1 -left-2 transform scale-75 opacity-90">
          <SquidHamsterAvatar name="Alpha" seed={1} size={size * 0.65} showBadge={false} tracksuitColor="#be185d" />
        </div>
        <div className="absolute -top-2 right-0 transform scale-75 opacity-90">
          <SquidHamsterAvatar name="Beta" seed={2} size={size * 0.65} showBadge={false} tracksuitColor="#0284c7" />
        </div>
        <div className="absolute top-2 left-6 transform scale-75 opacity-95">
          <SquidHamsterAvatar name="Gamma" seed={3} size={size * 0.65} showBadge={false} tracksuitColor="#d97706" />
        </div>
        {/* Foreground Leader Hamster */}
        <div className="relative z-10 transform scale-90 translate-y-2">
          <SquidHamsterAvatar name="Leader" seed={7} size={size * 0.8} showBadge={false} tracksuitColor="#0d6e4f" playerNumber="456" />
        </div>
      </div>
      {/* Total Class Prize Pool Dollars Badge */}
      {points !== undefined && (
        <div className="absolute -top-1.5 -right-1.5 min-w-[34px] h-[28px] px-2 rounded-full bg-[#10b981] text-white font-black text-xs sm:text-sm flex items-center justify-center shadow-md border-2 border-white ring-2 ring-emerald-500/20 z-20 pointer-events-none tracking-tight">
          {currencySymbol}{points}
        </div>
      )}
    </div>
  );
};
