import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export function FullscreenButton({
  targetId,
  className = '',
}: {
  targetId?: string;
  className?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) {
      const el = (targetId && document.getElementById(targetId)) || document.documentElement;
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`w-11 h-11 rounded-full bg-white/80 dark:bg-slate-800/80 hover:bg-white text-slate-800 dark:text-white flex items-center justify-center shadow-md border border-slate-200 dark:border-slate-700 transition-all cursor-pointer ${className}`}
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
    </button>
  );
}
