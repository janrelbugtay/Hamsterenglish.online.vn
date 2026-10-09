import React from 'react';
import { Gamepad2 } from 'lucide-react';

export const GameThumbnail = ({ gameType, info }: { gameType: string, info: any }) => {
  if (gameType === 'bubble-sentence-pro') {
    return (
      <div className="absolute inset-0 w-full h-full bg-sky-200 overflow-hidden flex flex-col pointer-events-none">
        {/* Sun */}
        <div className="absolute top-[-10%] right-[-10%] w-24 h-24 bg-yellow-300 rounded-full blur-[2px]"></div>
        {/* Clouds */}
        <div className="absolute top-[20%] left-[-5%] w-20 h-8 bg-white/60 rounded-full blur-[1px]"></div>
        <div className="absolute top-[40%] right-[10%] w-16 h-6 bg-white/50 rounded-full blur-[1px]"></div>
        
        {/* Progress Ring */}
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-4 border-green-400 bg-white flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-bold text-slate-700">59</span>
        </div>

        {/* Bubbles */}
        <div className="absolute top-[35%] left-[20%] px-3 py-1.5 bg-white/90 rounded-full shadow-md border border-white flex items-center justify-center transform -rotate-12">
            <span className="text-xs font-bold text-blue-900">a</span>
        </div>
        <div className="absolute top-[45%] left-[45%] px-4 py-2 bg-white/90 rounded-full shadow-md border border-white flex items-center justify-center transform rotate-6">
            <span className="text-sm font-bold text-blue-900">pencil</span>
        </div>
        <div className="absolute top-[30%] right-[15%] px-3 py-1.5 bg-white/90 rounded-full shadow-md border border-white flex items-center justify-center transform rotate-12">
            <span className="text-xs font-bold text-blue-900">It's</span>
        </div>

        {/* Bottom Panel */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[90%] h-12 bg-white/40 backdrop-blur-sm rounded-xl border border-white/50 flex items-center justify-center gap-2 shadow-sm">
            <div className="w-8 h-6 rounded-full border-2 border-dashed border-white/60"></div>
            <div className="w-8 h-6 rounded-full border-2 border-dashed border-white/60"></div>
            <div className="w-8 h-6 rounded-full border-2 border-dashed border-white/60"></div>
        </div>
      </div>
    );
  }

  if (gameType === 'sumo') {
    return (
      <div className="absolute inset-0 w-full h-full bg-indigo-50 flex items-center justify-center pointer-events-none">
         <div className="w-3/4 h-3/4 rounded-full border-4 border-yellow-500 bg-orange-100 flex items-center justify-center relative shadow-inner">
            <div className="w-1/2 h-1/2 rounded-full border-2 border-yellow-600/30"></div>
            <div className="absolute left-2 w-4 h-4 bg-blue-600 rounded-full shadow-md"></div>
            <div className="absolute right-2 w-4 h-4 bg-red-600 rounded-full shadow-md"></div>
         </div>
      </div>
    );
  }

  if (gameType === 'hamster-pop-quiz') {
    return (
      <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-sky-300 via-cyan-200 to-yellow-100 flex flex-col items-center justify-center pointer-events-none p-2">
         <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl mb-2 shadow-sm">🐹</div>
         <div className="w-3/4 h-3 bg-white/80 rounded-full mb-1"></div>
         <div className="w-1/2 h-3 bg-white/80 rounded-full"></div>
      </div>
    );
  }

  if (gameType === 'tic-tac-toe') {
    return (
      <div className="absolute inset-0 w-full h-full bg-gray-900 flex items-center justify-center pointer-events-none p-4">
         <div className="grid grid-cols-3 gap-1 w-full aspect-square max-w-[80%] bg-gray-700 p-1 rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <div className="bg-gray-800 rounded flex items-center justify-center text-blue-500 font-black text-2xl">X</div>
            <div className="bg-gray-800 rounded flex items-center justify-center text-red-500 font-black text-2xl">O</div>
            <div className="bg-gray-800 rounded"></div>
            <div className="bg-gray-800 rounded flex items-center justify-center text-red-500 font-black text-2xl">O</div>
            <div className="bg-gray-800 rounded flex items-center justify-center text-blue-500 font-black text-2xl">X</div>
            <div className="bg-gray-800 rounded"></div>
            <div className="bg-gray-800 rounded"></div>
            <div className="bg-gray-800 rounded"></div>
            <div className="bg-gray-800 rounded flex items-center justify-center text-blue-500 font-black text-2xl">X</div>
         </div>
      </div>
    );
  }

  if (gameType === 'mystery-box') {
    return (
      <div className="absolute inset-0 w-full h-full bg-slate-100 flex items-center justify-center pointer-events-none">
         <div className="grid grid-cols-2 gap-2 p-2">
            <div className="w-10 h-10 bg-blue-500 rounded-lg border-b-4 border-blue-600 shadow-sm flex items-center justify-center font-black text-white text-sm">1</div>
            <div className="w-10 h-10 bg-red-500 rounded-lg border-b-4 border-red-600 shadow-sm flex items-center justify-center font-black text-white text-sm">2</div>
            <div className="w-10 h-10 bg-green-500 rounded-lg border-b-4 border-green-600 shadow-sm flex items-center justify-center font-black text-white text-sm">3</div>
            <div className="w-10 h-10 bg-yellow-500 rounded-lg border-b-4 border-yellow-600 shadow-sm flex items-center justify-center font-black text-white text-sm">4</div>
         </div>
      </div>
    );
  }

  if (gameType === 'neon-chain') {
    return (
      <div className="absolute inset-0 w-full h-full bg-slate-900 flex flex-col items-center justify-center pointer-events-none p-2 gap-2">
         <div className="w-full h-6 rounded-full border border-cyan-500 bg-cyan-950 flex items-center justify-center text-[8px] text-cyan-400 font-black tracking-widest shadow-[0_0_10px_rgba(6,182,212,0.5)]">START</div>
         <div className="w-1 h-3 bg-cyan-500/50"></div>
         <div className="w-full h-6 rounded-full border border-purple-500 bg-purple-950 flex items-center justify-center text-[8px] text-purple-400 font-black tracking-widest shadow-[0_0_10px_rgba(168,85,247,0.5)]">CONNECT</div>
      </div>
    );
  }

  if (gameType === 'bubble-pop') {
    return (
      <div className="absolute inset-0 w-full h-full bg-[#0f172a] flex items-center justify-center overflow-hidden pointer-events-none">
         <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-[0_0_15px_#3b82f6] text-xs font-bold border border-blue-400">Aa</div>
         <div className="absolute top-2 left-2 w-6 h-6 bg-purple-500 rounded-full blur-[2px] opacity-70"></div>
         <div className="absolute bottom-2 right-2 w-8 h-8 bg-emerald-500 rounded-full blur-[2px] opacity-70"></div>
      </div>
    );
  }

  if (gameType === 'squid-game-picker') {
    const src = info.imageUrl || info.icon || '/images/name-picker-card.png';
    return (
      <img
        src={src}
        referrerPolicy="no-referrer"
        alt={info.title}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    );
  }

  // Fallback to Image or Generic Icon
  if (info.icon && (info.icon.startsWith("http") || info.icon.startsWith("/"))) {
    return <img src={info.icon} referrerPolicy="no-referrer" alt={info.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />;
  }

  return <Gamepad2 size={64} className={`opacity-20 ${info.color} relative z-10`} />;
}
