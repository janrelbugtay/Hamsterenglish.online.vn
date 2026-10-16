import React from 'react';
import { X, Play } from 'lucide-react';
import { ViewState } from '../types';

export interface GameModeSelectionModalProps {
  isOpen: boolean;
  gameData: any;
  onClose: () => void;
  onSelectMode: (mode: ViewState, adaptedGameData: any) => void;
}

export function GameModeModal({
  isOpen,
  gameData,
  onClose,
  onSelectMode,
}: GameModeSelectionModalProps) {
  if (!isOpen || !gameData) return null;

  const gameTitle = gameData.topic || gameData.name || gameData.title || "Custom Quiz";

  const handlePlayInterchangeable = (targetType: ViewState) => {
    const rawQuestions = gameData.customQuestions || gameData.questions || [];
    
    const normalizedQuestions = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q: any, idx: number) => {
      const text = q.text || q.question || `Question ${idx + 1}`;
      let options = Array.isArray(q.options) 
        ? q.options.filter((o: any) => typeof o === 'string' && o.trim() !== "")
        : [];
      
      let answerIndex = typeof q.answerIndex === 'number' 
        ? q.answerIndex 
        : (typeof q.correctIndex === 'number' ? q.correctIndex : 0);

      if (options.length < 2) {
        options = ["Yes", "No"];
        answerIndex = 0;
      }

      if (answerIndex < 0 || answerIndex >= options.length) {
        answerIndex = 0;
      }

      return {
        id: q.id || (idx + 1),
        text,
        options,
        answerIndex,
        ...(Array.isArray(q.optionImages) ? { optionImages: q.optionImages } : {}),
        ...(q.image || q.imageUrl ? { image: q.image || q.imageUrl, imageUrl: q.image || q.imageUrl } : {})
      };
    });

    const fallbackQuestions = [
      { id: 1, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples."], answerIndex: 0 }
    ];

    const finalQuestions = (normalizedQuestions.length > 0 ? normalizedQuestions : fallbackQuestions).slice(0, 30);

    const adaptedGame = {
      ...gameData,
      id: gameData.id || Date.now(),
      topic: gameTitle,
      name: gameTitle,
      title: gameTitle,
      className: gameData.className || gameData.classLevel || "",
      classLevel: gameData.classLevel || gameData.className || "",
      gameType: targetType,
      customQuestions: finalQuestions,
      questions: finalQuestions,
      editMode: false,
    };

    onSelectMode(targetType, adaptedGame);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-5">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Switch Game Mode</h3>
            <p className="text-xs text-slate-500 font-bold">{gameTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handlePlayInterchangeable('yoga-quiz')}
            className="p-4 rounded-2xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 border-2 border-teal-200 dark:border-teal-800 flex flex-col items-center text-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <span className="text-4xl">🧘</span>
            <span className="font-black text-teal-800 dark:text-teal-200 text-sm">Yoga Quiz</span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">Physical Poses & Picture Cards</span>
          </button>

          <button
            onClick={() => handlePlayInterchangeable('bubble-pop')}
            className="p-4 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border-2 border-sky-200 dark:border-sky-800 flex flex-col items-center text-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <span className="text-4xl">🫧</span>
            <span className="font-black text-sky-800 dark:text-sky-200 text-sm">Bubble Pop</span>
            <span className="text-[10px] text-sky-600 dark:text-sky-400 font-bold">Pop Floating Answer Bubbles</span>
          </button>

          <button
            onClick={() => handlePlayInterchangeable('sumo')}
            className="p-4 rounded-2xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border-2 border-amber-200 dark:border-amber-800 flex flex-col items-center text-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <span className="text-4xl">🤼</span>
            <span className="font-black text-amber-800 dark:text-amber-200 text-sm">Sumo Showdown</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Head-to-Head Clash Battle</span>
          </button>

          <button
            onClick={() => handlePlayInterchangeable('mystery-box')}
            className="p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border-2 border-purple-200 dark:border-purple-800 flex flex-col items-center text-center gap-2 transition-all hover:scale-105 cursor-pointer"
          >
            <span className="text-4xl">🎁</span>
            <span className="font-black text-purple-800 dark:text-purple-200 text-sm">Mystery Box</span>
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">Points & Surprises</span>
          </button>
        </div>
      </div>
    </div>
  );
}
