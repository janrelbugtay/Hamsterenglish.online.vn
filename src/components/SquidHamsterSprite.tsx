import React, { useState, useEffect } from 'react';
import { getStudentCharacter } from '../lib/studentCharacters';

export interface SquidHamsterSpriteProps {
  number: number; // 1 to 40
  name?: string;
  size?: number;
  dollars?: number;
  showBadge?: boolean;
  className?: string;
  avatarUrl?: string | null;
  liveDelta?: { amount: number; key: number } | null;
}

export const SquidHamsterSprite: React.FC<SquidHamsterSpriteProps> = ({
  number,
  name,
  size = 120,
  dollars,
  showBadge = true,
  className = '',
  avatarUrl,
  liveDelta = null,
}) => {
  const char = getStudentCharacter(number || 1);

  // Fallback progression: localUrl -> driveUrl -> thumbnailUrl -> student_001.png
  const [imgSrc, setImgSrc] = useState<string>(() => avatarUrl || char.localUrl);
  const [failCount, setFailCount] = useState<number>(0);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => {
    setImgSrc(avatarUrl || char.localUrl);
    setFailCount(0);
  }, [avatarUrl, char.localUrl, char.id]);

  useEffect(() => {
    if (liveDelta) {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [liveDelta]);

  const handleError = () => {
    setFailCount(prev => {
      const next = prev + 1;
      if (next === 1) {
        setImgSrc(char.driveUrl);
      } else if (next === 2) {
        setImgSrc(char.thumbnailUrl);
      } else if (next === 3) {
        setImgSrc('/images/student_001.png');
      }
      return next;
    });
  };

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Borderless Floating Character with bounce animation & natural drop-shadow */}
      <div className={`w-full h-full flex items-center justify-center transition-transform duration-200 ${isBouncing ? 'animate-character-bounce' : ''}`}>
        <img 
          src={imgSrc} 
          alt={name || `${char.title} (#${char.tag})`}
          className="w-full h-full object-contain select-none drop-shadow-sm hover:drop-shadow-md transition-all duration-200"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={handleError}
        />
      </div>

      {/* LIVE FLOATING DOLLAR POPUP (WHEN ADDING OR DEDUCTING) */}
      {liveDelta && (
        <div 
          key={liveDelta.key}
          className={`absolute -top-3 z-30 pointer-events-none animate-live-pop flex items-center gap-1 font-black px-3 py-1 rounded-full shadow-2xl border-2 border-white text-xs sm:text-sm tracking-tight whitespace-nowrap ${
            liveDelta.amount >= 0 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white ring-2 ring-emerald-300/60' 
              : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white ring-2 ring-rose-300/60'
          }`}
        >
          <span>{liveDelta.amount >= 0 ? `+$${liveDelta.amount}` : `-$${Math.abs(liveDelta.amount)}`}</span>
          <span className="text-[11px]">{liveDelta.amount >= 0 ? '✨' : '⚠️'}</span>
        </div>
      )}

      {/* BIGGER, PROMINENT DOLLAR BADGE IN TOP-RIGHT */}
      {showBadge && dollars !== undefined && (
        <div 
          className={`absolute -top-1.5 -right-1.5 rounded-full text-white font-black flex items-center justify-center shadow-lg border-[2.5px] border-white z-20 pointer-events-none transform transition-transform hover:scale-110 tracking-tight ${
            dollars < 0 
              ? 'bg-rose-600 ring-2 ring-rose-500/30 shadow-rose-600/30' 
              : 'bg-[#10b981] ring-2 ring-emerald-500/25'
          } ${
            size >= 90 
              ? 'min-w-[42px] h-[32px] px-2.5 text-sm sm:text-base' 
              : 'min-w-[28px] h-[24px] px-1.5 text-xs'
          }`}
        >
          {dollars < 0 ? `-$${Math.abs(dollars)}` : `$${dollars}`}
        </div>
      )}
    </div>
  );
};
