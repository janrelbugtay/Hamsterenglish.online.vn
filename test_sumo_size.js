import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Double the size of SumoCharacter
const charClassTarget = `className="absolute bottom-4 z-10 w-28 h-36 md:w-56 md:h-64 transition-all duration-200 ease-out origin-bottom"`;
const charClassReplacement = `className="absolute bottom-4 z-10 w-56 h-72 md:w-[448px] md:h-[512px] transition-all duration-200 ease-out origin-bottom"`;
content = content.replace(charClassTarget, charClassReplacement);

// 2. Update the positioning in the Arena
const arenaTarget = `<SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              positionStyle={{ left: '-110px', bottom: '-1rem' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              positionStyle={{ left: '0px', bottom: '-1rem' }} />`;

const arenaReplacement = `<SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              className="absolute transform -translate-x-full"
              positionStyle={{ left: '-10px', bottom: '-2rem' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              className="absolute transform translate-x-0"
              positionStyle={{ left: '10px', bottom: '-2rem' }} />`;

// Wait, the SumoCharacter component doesn't take a className prop. I should fix SumoCharacter to use the position more cleanly.
