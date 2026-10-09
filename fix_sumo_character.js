import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Update SumoCharacter component definition
const charTarget = `const SumoCharacter = ({ team, isPushing, isStunned, positionStyle, flip }: any) => {
  const isLeft = team === 'left';
  const clothingColor = isLeft ? "#2563eb" : "#dc2626";

  let rotation = 0;
  let translateX = 0;
  let translateY = 0;

  if (isPushing) {
    rotation = isLeft ? 15 : -15;
    translateX = isLeft ? 35 : -35;
  } else if (isStunned) {
    rotation = isLeft ? -25 : 25; 
    translateX = isLeft ? -25 : 25;
    translateY = 15;
  }

  const transform = \`rotate(\${rotation}deg) translateX(\${translateX}px) translateY(\${translateY}px)\`;`;

const charReplacement = `const SumoCharacter = ({ team, isPushing, isStunned, hasLost, positionStyle, flip }: any) => {
  const isLeft = team === 'left';
  const clothingColor = isLeft ? "#2563eb" : "#dc2626";

  let rotation = 0;
  let translateX = 0;
  let translateY = 0;

  if (hasLost) {
    rotation = isLeft ? -75 : 75;
    translateX = isLeft ? -100 : 100;
    translateY = 20;
  } else if (isPushing) {
    rotation = isLeft ? 15 : -15;
    translateX = isLeft ? 45 : -45;
  } else if (isStunned) {
    rotation = isLeft ? -25 : 25; 
    translateX = isLeft ? -25 : 25;
    translateY = 15;
  }

  const transform = \`rotate(\${rotation}deg) translateX(\${translateX}px) translateY(\${translateY}px)\`;`;

content = content.replace(charTarget, charReplacement);

// 2. Update SumoCharacter SVG
const svgTarget = `          {isStunned ? (
            <g>
              <path d="M 35 45 L 45 55 M 45 45 L 35 55" stroke="#1f2937" strokeWidth="3" />
              <path d="M 65 45 L 75 55 M 75 45 L 65 55" stroke="#1f2937" strokeWidth="3" />
              <path d="M 45 65 Q 55 60 65 65" fill="none" stroke="#1f2937" strokeWidth="2" />
            </g>
          ) : (
            <g>
              <circle cx="45" cy="50" r="4" fill="#1f2937" />
              <circle cx="75" cy="50" r="4" fill="#1f2937" />
              <path d="M 50 62 Q 55 68 60 62" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          <path d="M 8 68 Q 50 90 92 68 L 88 82 Q 50 102 12 82 Z" fill={clothingColor} />
          <path d="M 38 78 L 62 78 L 58 112 L 42 112 Z" fill={clothingColor} />
          <path d={isPushing ? "M 55 60 L 105 50" : "M 55 60 Q 85 75 95 65"} fill="none" stroke="#ffdfc4" strokeWidth="16" strokeLinecap="round" />
        </g>
      </svg>`;

const svgReplacement = `          {hasLost ? (
             <g>
               {/* Dizzy spirals */}
               <path d="M 40 50 Q 45 45 45 55 T 35 50" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
               <path d="M 70 50 Q 75 45 75 55 T 65 50" fill="none" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" />
               {/* Big open mouth */}
               <ellipse cx="55" cy="68" rx="8" ry="12" fill="#7f1d1d" />
               {/* Tears flying out */}
               <path d="M 35 55 L 20 70 M 65 55 L 80 70" stroke="#60a5fa" strokeWidth="4" strokeDasharray="4 4" className="animate-pulse" />
             </g>
          ) : isStunned ? (
            <g>
              <path d="M 35 45 L 45 55 M 45 45 L 35 55" stroke="#1f2937" strokeWidth="3" />
              <path d="M 65 45 L 75 55 M 75 45 L 65 55" stroke="#1f2937" strokeWidth="3" />
              <path d="M 45 65 Q 55 60 65 65" fill="none" stroke="#1f2937" strokeWidth="2" />
              {/* Sweat drop */}
              <path d="M 75 35 Q 82 45 75 48 Q 68 45 75 35" fill="#93c5fd" />
            </g>
          ) : (
            <g>
              <circle cx="45" cy="50" r="4" fill="#1f2937" />
              <circle cx="75" cy="50" r="4" fill="#1f2937" />
              <path d="M 50 62 Q 55 68 60 62" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
            </g>
          )}
          <path d="M 8 68 Q 50 90 92 68 L 88 82 Q 50 102 12 82 Z" fill={clothingColor} />
          <path d="M 38 78 L 62 78 L 58 112 L 42 112 Z" fill={clothingColor} />
          <path d={isPushing ? "M 55 60 L 105 50" : "M 55 60 Q 85 75 95 65"} fill="none" stroke="#ffdfc4" strokeWidth="16" strokeLinecap="round" />
          
          {/* Action lines for pushing (dust/impact) */}
          {isPushing && (
             <g stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" className="animate-pulse" opacity="0.6">
               <line x1="-20" y1="50" x2="10" y2="50" />
               <line x1="-15" y1="30" x2="5" y2="40" />
               <line x1="-15" y1="70" x2="5" y2="60" />
             </g>
          )}
        </g>
      </svg>`;

content = content.replace(svgTarget, svgReplacement);

// 3. Update battle logic to have a delay
const answerTarget = `      setBattlePos(prev => {
        const next = isLeft ? prev + shiftAmount : prev - shiftAmount;
        if (next >= 98) { setWinner('Blue Team'); setScreen('end'); }
        if (next <= 2) { setWinner('Red Team'); setScreen('end'); }
        return next;
      });
      
      setTimeout(() => {
        setTeamState((prev: any) => ({ ...prev, pushing: false, q: generateQuestion() }));
      }, 400);`;

const answerReplacement = `      let matchOver = false;
      setBattlePos(prev => {
        const next = isLeft ? prev + shiftAmount : prev - shiftAmount;
        if (next >= 98) { 
           setWinner('Blue Team'); 
           matchOver = true;
           setTimeout(() => setScreen('end'), 1500); 
        } else if (next <= 2) { 
           setWinner('Red Team'); 
           matchOver = true;
           setTimeout(() => setScreen('end'), 1500); 
        }
        return next;
      });
      
      if (!matchOver) {
        setTimeout(() => {
          setTeamState((prev: any) => ({ ...prev, pushing: false, q: generateQuestion() }));
        }, 400);
      } else {
        // Keep them pushing so the impact is strong
      }`;

content = content.replace(answerTarget, answerReplacement);

// 4. Update the Arena rendering of Sumos
const arenaTarget = `            <SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              positionStyle={{ left: '-110px', bottom: '-1rem' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              positionStyle={{ left: '0px', bottom: '-1rem' }} />`;

const arenaReplacement = `            <SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              positionStyle={{ left: '-110px', bottom: '-1rem' }} />
            <SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              positionStyle={{ left: '0px', bottom: '-1rem' }} />`;

content = content.replace(arenaTarget, arenaReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo character logic and SVGs");
