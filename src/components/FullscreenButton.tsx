import React, { useState, useEffect } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export function FullscreenButton({ targetId, className }: { targetId?: string, className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const target = targetId ? document.getElementById(targetId) : document.documentElement;
        if (target) {
          await target.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className={`flex items-center justify-center p-2 rounded-full transition-colors backdrop-blur-md border text-slate-500 hover:text-slate-800 bg-white/50 hover:bg-white border-slate-200 dark:text-white/80 dark:hover:text-white dark:bg-black/20 dark:hover:bg-black/50 dark:border-white/20 ${className || ''}`}
      title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
    >
      {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
    </button>
  );
}
