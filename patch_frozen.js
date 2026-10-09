import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Initial State
const stateInitTarget = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false });`;
const stateInitReplacement = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, qIndex: 0, q: null, stunned: false, pushing: false, mistakes: 0, frozen: false });`;
content = content.replace(stateInitTarget, stateInitReplacement);

// 2. startGame
const startGameTarget = `  const startGame = (continueMatch = false) => {
    matchOverRef.current = false;
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
const startGameReplacement = `  const startGame = (continueMatch = false) => {
    matchOverRef.current = false;
    setLeftTeam(prev => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestion(nextIndex), stunned: false, pushing: false, mistakes: 0, frozen: false };
    });
    setRightTeam(prev => {
       const nextIndex = continueMatch ? prev.qIndex : 0;
       return { ...prev, score: 0, qIndex: nextIndex, q: generateQuestion(nextIndex), stunned: false, pushing: false, mistakes: 0, frozen: false };
    });
    setBattlePos(50);
    setWinner(null);
    setScreen('playing');
  };`;
content = content.replace(startGameTarget, startGameReplacement);

// 3. handleAnswer
const handleAnswerTarget = `    if (teamState.stunned || teamState.pushing) return;

    if (selectedIndex === teamState.q.correctIndex) {
      setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1 }));`;
const handleAnswerReplacement = `    if (teamState.stunned || teamState.pushing || teamState.frozen) return;

    if (selectedIndex === teamState.q.correctIndex) {
      setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1, mistakes: 0 }));`;
content = content.replace(handleAnswerTarget, handleAnswerReplacement);

const wrongAnswerTarget = `    } else {
      setTeamState((prev: any) => ({ ...prev, stunned: true }));
      playSFX('stun');
      setBattlePos(prev => Math.max(2, Math.min(98, isLeft ? prev - 10 : prev + 10)));
      setTimeout(() => setTeamState((prev: any) => ({ ...prev, stunned: false })), 1200);
    }`;

const wrongAnswerReplacement = `    } else {
      setTeamState((prev: any) => {
         const nextMistakes = prev.mistakes + 1;
         if (nextMistakes >= 2) {
             playSFX('stun'); // or a freeze sound
             setTimeout(() => setTeamState((p: any) => ({ ...p, frozen: false, mistakes: 0 })), 3000);
             return { ...prev, frozen: true, mistakes: 0 };
         }
         
         playSFX('stun');
         setTimeout(() => setTeamState((p: any) => ({ ...p, stunned: false })), 1200);
         return { ...prev, stunned: true, mistakes: nextMistakes };
      });
      setBattlePos(prev => Math.max(2, Math.min(98, isLeft ? prev - 10 : prev + 10)));
    }`;
content = content.replace(wrongAnswerTarget, wrongAnswerReplacement);

// 4. Visuals for characters
const leftCharTarget = `<div className={\`absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out \${leftTeam.pushing ? 'scale-110 z-10' : leftTeam.stunned ? 'opacity-50' : 'scale-100 z-0'}\`}`;
const leftCharReplacement = `<div className={\`absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out \${leftTeam.pushing ? 'scale-110 z-10' : leftTeam.stunned ? 'opacity-50' : 'scale-100 z-0'}\`} style={{ left: \`calc(\${battlePos}% - 12rem)\` }}>
              
              {leftTeam.frozen && (
                <div className="absolute inset-[-1rem] bg-cyan-300/60 backdrop-blur-[2px] rounded-3xl border-4 border-cyan-100/80 shadow-[0_0_30px_rgba(34,211,238,0.6)] z-20 flex items-center justify-center animate-pulse">
                   <div className="absolute top-2 right-2 text-3xl">❄️</div>
                </div>
              )}`;
content = content.replace(leftCharTarget + ` style={{ left: \`calc(\${battlePos}% - 12rem)\` }}>`, leftCharReplacement);

const rightCharTarget = `<div className={\`absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out \${rightTeam.pushing ? 'scale-110 z-10' : rightTeam.stunned ? 'opacity-50' : 'scale-100 z-0'}\`}`;
const rightCharReplacement = `<div className={\`absolute top-1/2 -translate-y-1/2 transition-all duration-300 ease-out \${rightTeam.pushing ? 'scale-110 z-10' : rightTeam.stunned ? 'opacity-50' : 'scale-100 z-0'}\`} style={{ left: \`calc(\${battlePos}% + 2rem)\` }}>
              
              {rightTeam.frozen && (
                <div className="absolute inset-[-1rem] bg-cyan-300/60 backdrop-blur-[2px] rounded-3xl border-4 border-cyan-100/80 shadow-[0_0_30px_rgba(34,211,238,0.6)] z-20 flex items-center justify-center animate-pulse">
                   <div className="absolute top-2 left-2 text-3xl">❄️</div>
                </div>
              )}`;
content = content.replace(rightCharTarget + ` style={{ left: \`calc(\${battlePos}% + 2rem)\` }}>`, rightCharReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched freeze mechanic.");
