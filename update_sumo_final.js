import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// --- 1. Keybindings A and D ---
const keyMapTarget = `      const leftMap: Record<string, number> = leftOptsCount === 2 
          ? { a: 0, w: 1, d: 1 } // A and W (or A and D)
          : { w: 0, a: 1, s: 2, d: 3 };`;

const keyMapReplacement = `      const leftMap: Record<string, number> = leftOptsCount === 2 
          ? { a: 0, d: 1 } 
          : { w: 0, a: 1, s: 2, d: 3 };`;

content = content.replace(keyMapTarget, keyMapReplacement);

const blueBtnTarget = `<span className="hidden md:inline text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-lg text-sm md:text-xl">{leftTeam.q?.options.length === 2 ? ['A', 'W'][idx] : ['W', 'A', 'S', 'D'][idx] || (idx + 1)}</span>`;
const blueBtnReplacement = `<span className="hidden md:inline text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-lg text-sm md:text-xl">{leftTeam.q?.options.length === 2 ? ['A', 'D'][idx] : ['W', 'A', 'S', 'D'][idx] || (idx + 1)}</span>`;

content = content.replace(blueBtnTarget, blueBtnReplacement);

// --- 2. Add Sound Effects ---
const importsTarget = `import { useAuth } from "../contexts/AuthContext";`;
const importsReplacement = `import { useAuth } from "../contexts/AuthContext";

const playSFX = (type: 'push' | 'stun' | 'win') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'push') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'stun') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'win') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
      osc.start();
      osc.stop(ctx.currentTime + 1.0);
    }
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};
`;
content = content.replace(importsTarget, importsReplacement);

const answerPushTarget = `setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1 }));`;
const answerPushReplacement = `setTeamState((prev: any) => ({ ...prev, pushing: true, score: prev.score + 1 }));\n      playSFX('push');`;
content = content.replace(answerPushTarget, answerPushReplacement);

const answerStunTarget = `setTeamState((prev: any) => ({ ...prev, stunned: true }));`;
const answerStunReplacement = `setTeamState((prev: any) => ({ ...prev, stunned: true }));\n      playSFX('stun');`;
content = content.replace(answerStunTarget, answerStunReplacement);

const winBlueTarget = `setWinner('Blue Team'); 
           matchOver = true;`;
const winBlueReplacement = `setWinner('Blue Team'); 
           matchOver = true;
           playSFX('win');`;
content = content.replace(winBlueTarget, winBlueReplacement);

const winRedTarget = `setWinner('Red Team'); 
           matchOver = true;`;
const winRedReplacement = `setWinner('Red Team'); 
           matchOver = true;
           playSFX('win');`;
content = content.replace(winRedTarget, winRedReplacement);

// --- 3. Double Character Size & Fix Positioning ---
const charDefTarget = `const SumoCharacter = ({ team, isPushing, isStunned, hasLost, positionStyle, flip }: any) => {`;
const charDefReplacement = `const SumoCharacter = ({ team, isPushing, isStunned, hasLost, positionStyle, flip, className }: any) => {`;
content = content.replace(charDefTarget, charDefReplacement);

const charClassTarget = `className="absolute bottom-4 z-10 w-28 h-36 md:w-56 md:h-64 transition-all duration-200 ease-out origin-bottom"`;
const charClassReplacement = `className={\`absolute bottom-4 z-10 w-56 h-72 md:w-[448px] md:h-[512px] transition-all duration-200 ease-out origin-bottom \${className || ''}\`}`;
content = content.replace(charClassTarget, charClassReplacement);

const arenaTarget = `          <div className="absolute top-1/2 w-full h-0 transition-all duration-300 ease-out"
               style={{ left: \`\${battlePos}%\` }}>
            <SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              positionStyle={{ left: '-110px', bottom: '-1rem' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              positionStyle={{ left: '0px', bottom: '-1rem' }} />
          </div>`;

const arenaReplacement = `          <div className="absolute top-1/2 w-0 h-0 transition-all duration-300 ease-out flex justify-center items-end"
               style={{ left: \`\${battlePos}%\` }}>
            <SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              className="right-0"
              positionStyle={{ bottom: '-3rem', marginRight: '-15%' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              className="left-0"
              positionStyle={{ bottom: '-3rem', marginLeft: '-15%' }} />
          </div>`;
content = content.replace(arenaTarget, arenaReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo keybindings, sound effects, and character size!");
