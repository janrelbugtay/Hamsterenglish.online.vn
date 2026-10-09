import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Add matchOverRef
const refTarget = `  const stateRef = useRef({ screen, leftTeam, rightTeam, battlePos });`;
const refReplacement = `  const matchOverRef = useRef(false);
  const stateRef = useRef({ screen, leftTeam, rightTeam, battlePos });`;
content = content.replace(refTarget, refReplacement);

// 2. Reset matchOverRef on startGame
const startTarget = `    setScreen('playing');
  };`;
const startReplacement = `    matchOverRef.current = false;
    setScreen('playing');
  };`;
content = content.replace(startTarget, startReplacement);

// 3. Fix handleAnswer side-effects
const handleAnswerTarget = `      let matchOver = false;
      setBattlePos(prev => {
        const next = isLeft ? prev + shiftAmount : prev - shiftAmount;
        if (next >= 98) { 
           setWinner('Blue Team');
           setLeftTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
           matchOver = true;
           playSFX('win');
           setTimeout(() => setScreen('end'), 1500); 
        } else if (next <= 2) { 
           setWinner('Red Team');
           setRightTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
           matchOver = true;
           playSFX('win');
           setTimeout(() => setScreen('end'), 1500); 
        }
        return next;
      });
      
      if (!matchOver) {`;

const handleAnswerReplacement = `      if (matchOverRef.current) return;
      
      const nextPos = isLeft ? state.battlePos + shiftAmount : state.battlePos - shiftAmount;
      let matchOver = false;
      
      if (nextPos >= 98) {
         matchOverRef.current = true;
         matchOver = true;
         setWinner('Blue Team');
         setLeftTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 1500);
      } else if (nextPos <= 2) {
         matchOverRef.current = true;
         matchOver = true;
         setWinner('Red Team');
         setRightTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
         playSFX('win');
         setTimeout(() => setScreen('end'), 1500);
      }
      
      setBattlePos(prev => {
        const next = isLeft ? prev + shiftAmount : prev - shiftAmount;
        return next;
      });

      if (!matchOver) {`;

content = content.replace(handleAnswerTarget, handleAnswerReplacement);

// 4. Change Quit Button 'setup' to 'menu'
content = content.replaceAll(`setScreen('setup');`, `setScreen('menu');`);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Trophies StrictMode bug and Quit button destination.");
