import React, { useRef } from 'react';
import { ViewState } from '../types';
import { ArrowLeft, Maximize } from 'lucide-react';

export function PhonemicMaster({ onViewChange }: { onViewChange: (view: ViewState) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current && containerRef.current.requestFullscreen) {
        const p = containerRef.current.requestFullscreen();
        if (p && p.catch) p.catch(() => {});
      }
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div ref={containerRef} id="game-container" className="w-full h-full flex flex-col -mx-4 md:-mx-8 -my-4 md:-my-8 relative bg-white dark:bg-slate-900">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm z-10">
        <button
          onClick={() => onViewChange("games")}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-bold transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Games
        </button>
        <button 
          onClick={toggleFullScreen}
          className="flex items-center gap-2 text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 transition-colors font-semibold text-sm"
        >
          <Maximize className="w-5 h-5" />
          Fullscreen
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src="/phonemic-master.html"
        className="w-full flex-1 border-none bg-slate-50 dark:bg-slate-950"
        title="Phonemic Master"
        allow="microphone"
      />
    </div>
  );
}
