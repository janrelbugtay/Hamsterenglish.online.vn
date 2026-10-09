import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

const keydownTarget = `      const leftMap: Record<string, number> = { w: 0, a: 1, s: 2, d: 3 };
      const rightMap: Record<string, number> = { arrowup: 0, arrowleft: 1, arrowdown: 2, arrowright: 3 };`;

const keydownReplacement = `      const leftOptsCount = stateRef.current.leftTeam?.q?.options?.length || 4;
      const rightOptsCount = stateRef.current.rightTeam?.q?.options?.length || 4;
      
      const leftMap: Record<string, number> = leftOptsCount === 2 
          ? { a: 0, w: 1, d: 1 } // A and W (or A and D)
          : { w: 0, a: 1, s: 2, d: 3 };
          
      const rightMap: Record<string, number> = rightOptsCount === 2
          ? { arrowleft: 0, arrowright: 1 }
          : { arrowup: 0, arrowleft: 1, arrowdown: 2, arrowright: 3 };`;

content = content.replace(keydownTarget, keydownReplacement);

const blueBtnTarget = `<span className="hidden md:inline text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-lg text-sm md:text-xl">{['W', 'A', 'S', 'D'][idx] || (idx + 1)}</span>`;
const blueBtnReplacement = `<span className="hidden md:inline text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-lg text-sm md:text-xl">{leftTeam.q?.options.length === 2 ? ['A', 'W'][idx] : ['W', 'A', 'S', 'D'][idx] || (idx + 1)}</span>`;

const redBtnTarget = `<span className="hidden md:inline text-red-400 font-bold bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg text-sm md:text-xl uppercase">{['↑', '←', '↓', '→'][idx] || (idx + 1)}</span>`;
const redBtnReplacement = `<span className="hidden md:inline text-red-400 font-bold bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg text-sm md:text-xl uppercase">{rightTeam.q?.options.length === 2 ? ['←', '→'][idx] : ['↑', '←', '↓', '→'][idx] || (idx + 1)}</span>`;

content = content.replace(blueBtnTarget, blueBtnReplacement);
content = content.replace(redBtnTarget, redBtnReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo keys");
