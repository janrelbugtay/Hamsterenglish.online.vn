import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Update useState for screen
content = content.replace(
  "useState<'menu' | 'playing' | 'end' | 'setup'>",
  "useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>"
);

// 2. Add study mode state
const stateTarget = `  const [screen, setScreen] = useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>(initialGame && !initialGame.editMode ? 'menu' : 'setup');`;
const stateReplacement = `  const [screen, setScreen] = useState<'menu' | 'playing' | 'end' | 'setup' | 'study'>(initialGame && !initialGame.editMode ? 'menu' : 'setup');
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedOption, setStudySelectedOption] = useState<number | null>(null);`;
content = content.replace(stateTarget, stateReplacement);

// 3. Add Study button in menu
const menuTarget = `<button onClick={() => startGame(false)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-6 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto">
            START BATTLE
          </button>`;
const menuReplacement = `<button onClick={() => startGame(false)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-6 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto mb-4">
            START BATTLE
          </button>
          
          <button onClick={() => { setStudyIndex(0); setStudySelectedOption(null); setScreen('study'); }} className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 text-xl font-bold px-12 py-4 rounded-full shadow-[0_6px_0_#818cf8] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto flex items-center justify-center gap-3 mx-auto">
             <span className="text-3xl">📖</span> STUDY MODE
          </button>`;
content = content.replace(menuTarget, menuReplacement);

// 4. Add the Study Screen view
const studyTarget = `  if (screen === 'menu') {`;
const studyScreen = `  if (screen === 'study') {
    const studyQuestions = activeGame?.questions || DEFAULT_QUESTIONS;
    const currentQ = studyQuestions[studyIndex];
    
    return (
      <div id="game-container" className="h-[calc(100vh-2rem)] bg-indigo-50 dark:bg-indigo-950 flex flex-col font-sans p-4 relative" style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-black/20 rounded-2xl backdrop-blur-md mb-8">
           <button 
             onClick={() => setScreen('menu')}
             className="flex items-center gap-2 p-2 rounded-full transition-colors bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 shadow-sm text-indigo-900 dark:text-indigo-100 font-bold px-4"
           >
             <ArrowLeft size={20} /> Back to Menu
           </button>
           <div className="text-xl font-black text-indigo-900 dark:text-indigo-100">
              Question {studyIndex + 1} of {studyQuestions.length}
           </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl mx-auto w-full">
           {studyQuestions.length > 0 ? (
              <>
                 <h1 className="text-3xl md:text-5xl font-black text-indigo-950 dark:text-white tracking-tight leading-tight text-center max-w-full break-words drop-shadow-sm mb-12">
                     {currentQ?.text}
                 </h1>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                     {currentQ?.options.map((opt, i) => {
                         const isSelected = studySelectedOption === i;
                         const isCorrect = i === currentQ.answerIndex;
                         const showAsCorrect = studySelectedOption !== null && isCorrect;
                         const showAsIncorrect = studySelectedOption !== null && isSelected && !isCorrect;
                         
                         return (
                             <button
                                 key={i}
                                 onClick={() => {
                                     if (studySelectedOption === null) {
                                         setStudySelectedOption(i);
                                     }
                                 }}
                                 disabled={studySelectedOption !== null}
                                 className={\`relative p-6 rounded-2xl text-xl md:text-2xl font-bold transition-all duration-300 transform \${
                                     showAsCorrect ? 'bg-green-500 text-white shadow-[0_6px_0_#15803d] scale-105 z-10' :
                                     showAsIncorrect ? 'bg-red-500 text-white opacity-90 scale-95 shadow-[0_4px_0_#991b1b]' :
                                     studySelectedOption !== null ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 opacity-50 shadow-none' :
                                     'bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-[1.02] shadow-[0_6px_0_#cbd5e1] dark:shadow-[0_6px_0_#334155] border-2 border-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                                 }\`}
                             >
                                 <div className="flex items-center justify-center gap-4">
                                     {opt}
                                     {showAsCorrect && <span className="text-3xl animate-bounce">✅</span>}
                                     {showAsIncorrect && <span className="text-3xl">❌</span>}
                                 </div>
                             </button>
                         );
                     })}
                 </div>
                 
                 <div className={\`mt-12 h-20 transition-all duration-500 \${studySelectedOption !== null ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}\`}>
                     <button
                         onClick={() => {
                             if (studyIndex < studyQuestions.length - 1) {
                                 setStudyIndex(studyIndex + 1);
                                 setStudySelectedOption(null);
                             } else {
                                 setScreen('menu');
                                 setStudyIndex(0);
                                 setStudySelectedOption(null);
                             }
                         }}
                         className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xl rounded-full shadow-[0_6px_0_#4338ca] active:translate-y-1 active:shadow-none transition-all"
                     >
                         {studyIndex < studyQuestions.length - 1 ? 'Next Question →' : 'Finish Study'}
                     </button>
                 </div>
              </>
           ) : (
              <div className="text-slate-500 text-3xl font-bold">No questions available!</div>
           )}
        </div>
      </div>
    );
  }

  if (screen === 'menu') {`;
content = content.replace(studyTarget, studyScreen);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched study mode.");
