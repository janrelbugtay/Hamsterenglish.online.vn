import React from 'react';
import { X, Play } from 'lucide-react';

export interface GameModeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameData: any;
  onSelectMode: (mode: 'bubble-pop' | 'yoga-quiz' | 'sumo' | 'bubble-sentence-pro' | 'mystery-box', adaptedGameData: any) => void;
}

export function GameModeModal({
  isOpen,
  onClose,
  gameData,
  onSelectMode,
}: GameModeSelectionModalProps) {
  if (!isOpen || !gameData) return null;

  const gameTitle = gameData.topic || gameData.name || gameData.title || "Custom Quiz";

  const handlePlayInterchangeable = (targetType: 'yoga-quiz' | 'bubble-pop' | 'sumo' | 'bubble-sentence-pro' | 'mystery-box') => {
    // Normalize questions to guarantee they work reliably and consistently across all games
    const rawQuestions = gameData.customQuestions || gameData.questions || [];
    
    const normalizedQuestions = (Array.isArray(rawQuestions) ? rawQuestions : []).map((q: any, idx: number) => {
      const text = q.text || q.question || `Question ${idx + 1}`;
      let options = Array.isArray(q.options) 
        ? q.options.filter((o: any) => typeof o === 'string' && o.trim() !== "")
        : [];
      
      let answerIndex = typeof q.answerIndex === 'number' 
        ? q.answerIndex 
        : (typeof q.correctIndex === 'number' ? q.correctIndex : 0);

      // If less than 2 valid options, fallback to Yes / No
      if (options.length < 2) {
        options = ["Yes", "No"];
        answerIndex = 0;
      }

      // Clamp answerIndex within bounds
      if (answerIndex < 0 || answerIndex >= options.length) {
        answerIndex = 0;
      }

      return {
        id: q.id || (idx + 1),
        text,
        options,
        answerIndex,
        ...(q.image || q.imageUrl ? { image: q.image || q.imageUrl, imageUrl: q.image || q.imageUrl } : {})
      };
    });

    const fallbackQuestions = [
      { id: 1, text: "Which sentence is grammatically correct?", options: ["She doesn't like apples.", "She don't like apples.", "She not like apples.", "She isn't like apples."], answerIndex: 0 },
      { id: 2, text: "What is the past tense of 'eat'?", options: ["Ate", "Eated", "Eating", "Eats"], answerIndex: 0 },
      { id: 3, text: "Which of these is a fruit?", options: ["Apple", "Carrot", "Potato", "Broccoli"], answerIndex: 0 },
      { id: 4, text: "They ____ to school by bus every day.", options: ["go", "goes", "gone", "going"], answerIndex: 0 },
      { id: 5, text: "Choose the opposite of 'Difficult':", options: ["Easy", "Hard", "Tough", "Heavy"], answerIndex: 0 }
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
      mode: targetType === 'bubble-sentence-pro' ? 'multiple-choice' : (gameData.mode || 'word'),
      customQuestions: finalQuestions,
      questions: finalQuestions,
      customSentences: finalQuestions,
      sentences: finalQuestions,
      editMode: false,
    };

    onSelectMode(targetType, adaptedGame);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-[32px] p-6 sm:p-8 w-full max-w-4xl shadow-2xl relative border-4 border-slate-100 dark:border-slate-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-10 h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors z-10 cursor-pointer"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 pr-8 sm:pr-0">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">
            Choose How to Play
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm sm:text-base mt-1">
            Play <span className="font-bold text-slate-800 dark:text-slate-200">"{gameTitle}"</span> in:
          </p>
        </div>

        {/* Game Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-2">
          {/* Option 1: Play in Yoga */}
          <div 
            onClick={() => handlePlayInterchangeable('yoga-quiz')}
            className="group relative flex flex-col bg-emerald-50/70 dark:bg-emerald-950/20 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-800/60 rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-center"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 border border-emerald-300 dark:border-emerald-700/50 shadow-md flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
              <img 
                src="https://drive.google.com/thumbnail?id=16viKskpD4hXygTg-0UaGSjfrWibNoqeQ&sz=w1000" 
                alt="Yoga Quiz"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-center z-0 p-4">
                <span className="text-5xl sm:text-6xl drop-shadow-md block">🧘‍♀️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 inline-block">Yoga Quiz</span>
              </div>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-0.5">
              Yoga
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Mindful poses & zen balance
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePlayInterchangeable('yoga-quiz'); }}
              className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm rounded-xl shadow-[0_3px_0_#065f46] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Play in Yoga
            </button>
          </div>

          {/* Option 2: Play in Bubble Pop */}
          <div 
            onClick={() => handlePlayInterchangeable('bubble-pop')}
            className="group relative flex flex-col bg-blue-50/70 dark:bg-blue-950/20 hover:bg-blue-100/70 dark:hover:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-800/60 rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-center"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br from-blue-500 via-sky-500 to-cyan-500 border border-blue-300 dark:border-blue-700/50 shadow-md flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
              <img 
                src="/images/bubble-pop.png" 
                alt="Bubble Pop"
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://drive.google.com/thumbnail?id=1AHwLQ7lCIsKt9fzMlWAJWMnRCfFE4mE-&sz=w1000";
                }}
              />
              <div className="text-center z-0 p-4">
                <span className="text-5xl sm:text-6xl drop-shadow-md block">🫧</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 inline-block">Bubble Pop</span>
              </div>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-0.5">
              Bubble Pop
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Motion camera & bubble popping
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePlayInterchangeable('bubble-pop'); }}
              className="w-full py-2.5 px-3 bg-blue-500 hover:bg-blue-600 text-white font-black text-sm rounded-xl shadow-[0_3px_0_#1e40af] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Play in Bubble Pop
            </button>
          </div>

          {/* Option 3: Play in Sumo */}
          <div 
            onClick={() => handlePlayInterchangeable('sumo')}
            className="group relative flex flex-col bg-rose-50/70 dark:bg-rose-950/20 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 border-2 border-rose-200 dark:border-rose-800/60 rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-center"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br from-rose-500 via-red-500 to-amber-500 border border-rose-300 dark:border-rose-700/50 shadow-md flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
              <img 
                src="/images/sumo.png" 
                alt="Sumo"
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "https://drive.google.com/thumbnail?id=19zB6Kpor6pry7TV3XvX3eIZdxpd3ys40&sz=w1000";
                }}
              />
              <div className="text-center z-0 p-4">
                <span className="text-5xl sm:text-6xl drop-shadow-md block">🤼</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 inline-block">Sumo Showdown</span>
              </div>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-0.5">
              Sumo
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Dojo bumper ring battles
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePlayInterchangeable('sumo'); }}
              className="w-full py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white font-black text-sm rounded-xl shadow-[0_3px_0_#991b1b] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Play in Sumo
            </button>
          </div>

          {/* Option 4: Play in Bubble Island (Multiple Choice Mode) */}
          <div 
            onClick={() => handlePlayInterchangeable('bubble-sentence-pro')}
            className="group relative flex flex-col bg-sky-50/70 dark:bg-sky-950/20 hover:bg-sky-100/70 dark:hover:bg-sky-900/30 border-2 border-sky-200 dark:border-sky-800/60 rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-center"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 border border-sky-300 dark:border-sky-700/50 shadow-md flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
              <img 
                src="https://drive.google.com/thumbnail?id=136UAXGhVDr4ZhJd3bRABHDKp40RJIQSJ&sz=w1000" 
                alt="Bubble Island"
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-center z-0 p-4">
                <span className="text-5xl sm:text-6xl drop-shadow-md block">🏝️</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 inline-block">Bubble Island</span>
              </div>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-0.5">
              Bubble Island
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Floating A, B, C, D bubble quiz
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePlayInterchangeable('bubble-sentence-pro'); }}
              className="w-full py-2.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-black text-sm rounded-xl shadow-[0_3px_0_#0369a1] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Play in Island
            </button>
          </div>

          {/* Option 5: Play in Mystery Box */}
          <div 
            onClick={() => handlePlayInterchangeable('mystery-box')}
            className="group relative flex flex-col bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-100/70 dark:hover:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-800/60 rounded-3xl p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl cursor-pointer text-center"
          >
            <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3.5 bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 border border-amber-300 dark:border-amber-700/50 shadow-md flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
              <img 
                src="https://drive.google.com/thumbnail?id=1ugM0rhtk40XdbSDrdDJja5QpLNkWebQn&sz=w1000" 
                alt="Mystery Box"
                className="w-full h-full object-cover absolute inset-0 z-10"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="text-center z-0 p-4">
                <span className="text-5xl sm:text-6xl drop-shadow-md block">🎁</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/90 bg-black/20 px-2 py-0.5 rounded-full mt-2 inline-block">Mystery Box</span>
              </div>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-slate-100 mb-0.5">
              Mystery Box
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 flex-1">
              Numbered boxes (1-30) & surprises
            </p>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); handlePlayInterchangeable('mystery-box'); }}
              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-xl shadow-[0_3px_0_#b45309] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" /> Play in Mystery Box
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
