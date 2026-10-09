import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Initial State
const stateInitTarget = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, q: null, stunned: false, pushing: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, q: null, stunned: false, pushing: false });`;
const stateInitReplacement = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false });`;
content = content.replace(stateInitTarget, stateInitReplacement);

// 2. generateQuestion
const generateQTarget = `  const generateQuestion = () => {
    const q = questionsDB[Math.floor(Math.random() * questionsDB.length)];`;
const generateQReplacement = `  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];`;
content = content.replace(generateQTarget, generateQReplacement);

// 3. startGame
const startGameTarget = `  const startGame = () => {
    setLeftTeam(prev => ({ ...prev, score: 0, q: generateQuestion(), stunned: false, pushing: false }));
    setRightTeam(prev => ({ ...prev, score: 0, q: generateQuestion(), stunned: false, pushing: false }));
    setBattlePos(50);
    setWinner(null);
    setScreen('playing');
  };`;
const startGameReplacement = `  const startGame = (continueMatch = false) => {
    setLeftTeam(prev => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestion(nextIndex), stunned: false, pushing: false };
    });
    setRightTeam(prev => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestion(nextIndex), stunned: false, pushing: false };
    });
    setBattlePos(50);
    setWinner(null);
    setScreen('playing');
  };`;
content = content.replace(startGameTarget, startGameReplacement);

// 4. startGame usage in menu
const menuStartTarget = `<button onClick={startGame} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-6 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto">`;
const menuStartReplacement = `<button onClick={() => startGame(false)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-6 rounded-full shadow-[0_8px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all w-full md:w-auto">`;
content = content.replace(menuStartTarget, menuStartReplacement);

// 5. handleAnswer next question
const nextQTarget = `      if (!matchOver) {
        setTimeout(() => {
          setTeamState((prev: any) => ({ ...prev, pushing: false, q: generateQuestion() }));
        }, 400);
      }`;
const nextQReplacement = `      if (!matchOver) {
        setTimeout(() => {
          setTeamState((prev: any) => {
             const nextIndex = prev.qIndex + 1;
             return { ...prev, pushing: false, qIndex: nextIndex, q: generateQuestion(nextIndex) };
          });
        }, 400);
      }`;
content = content.replace(nextQTarget, nextQReplacement);

// 6. End match screen buttons
const endScreenTarget = `          <button onClick={() => setScreen('menu')} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-12 py-5 rounded-full shadow-[0_6px_0_#ca8a04] active:translate-y-1 active:shadow-none transition-all">
            Play Again
          </button>`;
const endScreenReplacement = `          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button onClick={() => startGame(true)} className="bg-yellow-400 hover:bg-yellow-300 text-slate-900 text-2xl font-black px-8 py-5 rounded-full shadow-[0_6px_0_#ca8a04] active:translate-y-1 active:shadow-[0_0px_0_#ca8a04] transition-all">
              Continue
            </button>
            <button onClick={() => {
                setLeftTeam((prev: any) => ({ ...prev, wins: 0 }));
                setRightTeam((prev: any) => ({ ...prev, wins: 0 }));
                startGame(false);
              }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xl font-bold px-8 py-5 rounded-full shadow-[0_6px_0_#94a3b8] active:translate-y-1 active:shadow-[0_0px_0_#94a3b8] transition-all">
              Restart
            </button>
          </div>`;
content = content.replace(endScreenTarget, endScreenReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched chronological questions and Continue/Restart buttons");
