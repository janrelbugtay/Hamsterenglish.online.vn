import React from 'react';

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
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-[#140a05] select-none">
      {/* Keyframe Animations */}
      <style>{`
        @keyframes crowd-cheer-left {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(-1deg); }
        }
        @keyframes crowd-cheer-right {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes flash-star-1 {
          0%, 93%, 100% { opacity: 0; transform: scale(0.5); }
          95% { opacity: 0.95; transform: scale(1.4); }
          97% { opacity: 0.1; transform: scale(0.9); }
        }
        @keyframes flash-star-2 {
          0%, 87%, 100% { opacity: 0; transform: scale(0.5); }
          89% { opacity: 0.9; transform: scale(1.3); }
          91% { opacity: 0.1; transform: scale(0.9); }
        }
        .anim-cheer-left { animation: crowd-cheer-left 2s infinite ease-in-out; }
        .anim-cheer-right { animation: crowd-cheer-right 2.2s infinite ease-in-out; }
        .anim-flash-1 { animation: flash-star-1 4.2s infinite ease-out; }
        .anim-flash-2 { animation: flash-star-2 3.6s infinite ease-out 1.2s; }
      `}</style>

      {/* CIRCULAR AUDIENCE STADIUM BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Ambient Stadium Lighting Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_45%,_rgba(245,158,11,0.22)_0%,_rgba(180,83,9,0.12)_35%,_rgba(30,12,6,0.92)_70%,_#0e0502_100%)]"></div>

        {/* Dynamic Overhead Center Arena Spotlight tracking battle */}
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] pointer-events-none opacity-50 mix-blend-screen transition-all duration-300"
          style={{
            background: `radial-gradient(ellipse 60% 50% at ${battlePos}% 42%, rgba(255,250,220,0.65) 0%, rgba(245,158,11,0.25) 45%, transparent 75%)`
          }}
        ></div>

        {/* Concentric Circular Stadium Arena Bowl with Sweeping Audience Tiers */}
        <svg 
          viewBox="0 0 1200 640" 
          preserveAspectRatio="xMidYMid slice" 
          className="w-full h-full absolute inset-0 overflow-visible opacity-95"
        >
          <defs>
            {/* Gradients for Tiered Seating Arcs */}
            <linearGradient id="tier-outer-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#241108" />
              <stop offset="100%" stopColor="#3d1d0f" />
            </linearGradient>
            <linearGradient id="tier-mid-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d1d0f" />
              <stop offset="100%" stopColor="#552915" />
            </linearGradient>
            <linearGradient id="tier-inner-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#552915" />
              <stop offset="100%" stopColor="#6e351b" />
            </linearGradient>
            <linearGradient id="arena-floor-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#552611" />
              <stop offset="35%" stopColor="#431e0d" />
              <stop offset="100%" stopColor="#240f06" />
            </linearGradient>
          </defs>

          {/* CIRCULAR STADIUM SEATING BOWLS (Curving around the center) */}

          {/* TIER 3 (Upper Outer Curving Bowl) */}
          <path 
            d="M 50,280 Q 600,80 1150,280 L 1170,330 Q 600,120 30,330 Z" 
            fill="url(#tier-outer-grad)" 
            stroke="#5c2e17" 
            strokeWidth="3"
          />
          {/* Upper Tier Audience Spectator Silhouettes in a sweeping circle */}
          <g opacity="0.6">
            {Array.from({ length: 32 }).map((_, i) => {
              const t = i / 31;
              // Quadratic bezier curve point
              const x = (1 - t) * (1 - t) * 70 + 2 * (1 - t) * t * 600 + t * t * 1130;
              const y = (1 - t) * (1 - t) * 270 + 2 * (1 - t) * t * 85 + t * t * 270;
              const isBlue = i < 14;
              const isRed = i > 17;
              const color = isBlue ? '#2563eb' : isRed ? '#dc2626' : '#92400e';
              return (
                <g key={`t3-${i}`} transform={`translate(${x}, ${y})`}>
                  <circle cx="0" cy="-10" r="5" fill={color} />
                  <path d="M -7,-5 Q 0,-7 7,-5 L 8,4 L -8,4 Z" fill={color} opacity="0.9" />
                </g>
              );
            })}
          </g>

          {/* Camera Flashes on Upper Tier */}
          <circle cx="340" cy="140" r="6" fill="#ffffff" className="anim-flash-1" filter="drop-shadow(0 0 8px #ffffff)" />
          <circle cx="860" cy="145" r="5" fill="#fef08a" className="anim-flash-2" filter="drop-shadow(0 0 8px #fef08a)" />
          <circle cx="600" cy="115" r="5" fill="#67e8f9" className="anim-flash-1" filter="drop-shadow(0 0 8px #67e8f9)" />

          {/* TIER 2 (Middle Curving Bowl Tier) */}
          <path 
            d="M 80,330 Q 600,150 1120,330 L 1145,390 Q 600,195 55,390 Z" 
            fill="url(#tier-mid-grad)" 
            stroke="#78391a" 
            strokeWidth="3"
          />
          {/* Middle Tier Cheering Spectators (Blue supporters on left, Red on right) */}
          <g>
            {Array.from({ length: 28 }).map((_, i) => {
              const t = i / 27;
              const x = (1 - t) * (1 - t) * 105 + 2 * (1 - t) * t * 600 + t * t * 1095;
              const y = (1 - t) * (1 - t) * 320 + 2 * (1 - t) * t * 155 + t * t * 320;
              const isBlue = i < 12;
              const isRed = i > 15;
              const animClass = isBlue ? 'anim-cheer-left' : isRed ? 'anim-cheer-right' : '';
              const headColor = isBlue ? '#1d4ed8' : isRed ? '#b91c1c' : '#78350f';
              const bodyColor = isBlue ? '#3b82f6' : isRed ? '#ef4444' : '#b45309';
              const hasFan = i % 3 === 0;

              return (
                <g key={`t2-${i}`} transform={`translate(${x}, ${y})`} className={animClass}>
                  {/* Waving fan */}
                  {hasFan && (
                    <circle 
                      cx={i % 2 === 0 ? -10 : 10} 
                      cy="-18" 
                      r="5.5" 
                      fill={isBlue ? '#60a5fa' : isRed ? '#f87171' : '#fde047'} 
                      stroke="#ffffff" 
                      strokeWidth="1" 
                    />
                  )}
                  {/* Headband / Head */}
                  <circle cx="0" cy="-12" r="7" fill={headColor} />
                  <rect x="-7" y="-13" width="14" height="2" fill="#ffffff" rx="1" />
                  {/* Cheering Torso */}
                  <path d="M -9,-5 Q 0,-8 9,-5 L 11,8 L -11,8 Z" fill={bodyColor} />
                </g>
              );
            })}
          </g>

          {/* TIER 1 (Lower Ringside Tamari-seki Tier wrapping closely around Dohyo) */}
          <path 
            d="M 120,390 Q 600,210 1080,390 L 1105,455 Q 600,265 95,455 Z" 
            fill="url(#tier-inner-grad)" 
            stroke="#94441e" 
            strokeWidth="3.5"
          />
          {/* Ringside Audience Spectators Sitting around the Circular Ring */}
          <g>
            {Array.from({ length: 24 }).map((_, i) => {
              const t = i / 23;
              const x = (1 - t) * (1 - t) * 145 + 2 * (1 - t) * t * 600 + t * t * 1055;
              const y = (1 - t) * (1 - t) * 380 + 2 * (1 - t) * t * 218 + t * t * 380;
              const isBlue = i < 10;
              const isRed = i > 13;
              const headColor = isBlue ? '#1e40af' : isRed ? '#991b1b' : '#92400e';
              const bodyColor = isBlue ? '#2563eb' : isRed ? '#dc2626' : '#d97706';

              return (
                <g key={`t1-${i}`} transform={`translate(${x}, ${y})`}>
                  {/* Clapping / Raising hands on sides */}
                  {(isBlue || isRed) && i % 2 === 0 && (
                    <circle cx={isBlue ? -9 : 9} cy="-20" r="3" fill="#fed7aa" />
                  )}
                  {/* Spectator Head */}
                  <circle cx="0" cy="-14" r="8" fill={headColor} />
                  {/* Torso sitting on floor cushion */}
                  <path d="M -11,-6 Q 0,-10 11,-6 L 13,10 L -13,10 Z" fill={bodyColor} />
                  {/* Floor Cushion (Zabuton) */}
                  <rect x="-14" y="9" width="28" height="4" rx="2" fill={isBlue ? '#1e3a8a' : isRed ? '#7f1d1d' : '#451a03'} />
                </g>
              );
            })}
          </g>

          {/* GROUNDED STADIUM FLOOR (Wide arena floor beneath circular audience tiers) */}
          <path 
            d="M 0,430 Q 600,280 1200,430 L 1200,640 L 0,640 Z" 
            fill="url(#arena-floor-grad)" 
            stroke="#6e351b" 
            strokeWidth="2"
          />
          {/* Subtle natural clay markings */}
          <path d="M 40,490 Q 600,350 1160,490" fill="none" stroke="#78391a" strokeWidth="2" strokeDasharray="18,12" opacity="0.4" />
          <path d="M 20,560 Q 600,420 1180,560" fill="none" stroke="#5c2b12" strokeWidth="2" opacity="0.35" />
        </svg>
      </div>

      {/* FOREGROUND GAME CONTENT (Top Scoreboard, Dohyo Center Arena, Question & Answer Cards) */}
      <div className="relative z-30 flex flex-col justify-between h-full p-2 sm:p-4 md:p-5">
        {children}
      </div>
    </div>
  );
};
