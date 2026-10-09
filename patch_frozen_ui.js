import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Remove the old frozen overlay from the parent
const oldLeftFrozen = `{leftTeam.frozen && (
                <div className="absolute inset-[-1rem] bg-cyan-300/60 backdrop-blur-[2px] rounded-3xl border-4 border-cyan-100/80 shadow-[0_0_30px_rgba(34,211,238,0.6)] z-20 flex items-center justify-center animate-pulse">
                   <div className="absolute top-2 right-2 text-3xl">❄️</div>
                </div>
              )}`;
content = content.replace(oldLeftFrozen, '');

const oldRightFrozen = `{rightTeam.frozen && (
                <div className="absolute inset-[-1rem] bg-cyan-300/60 backdrop-blur-[2px] rounded-3xl border-4 border-cyan-100/80 shadow-[0_0_30px_rgba(34,211,238,0.6)] z-20 flex items-center justify-center animate-pulse">
                   <div className="absolute top-2 left-2 text-3xl">❄️</div>
                </div>
              )}`;
content = content.replace(oldRightFrozen, '');

// 2. Pass isFrozen to SumoCharacter
const sumoLeftTarget = `<SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} flip={false}
              hasLost={winner === 'Red Team'}
              className="right-0"
              positionStyle={{ bottom: '-3rem', marginRight: '-15%' }} />`;
const sumoLeftReplacement = `<SumoCharacter team="left" 
              isPushing={leftTeam.pushing} isStunned={leftTeam.stunned} isFrozen={leftTeam.frozen} flip={false}
              hasLost={winner === 'Red Team'}
              className="right-0"
              positionStyle={{ bottom: '-3rem', marginRight: '-15%' }} />`;
content = content.replace(sumoLeftTarget, sumoLeftReplacement);

const sumoRightTarget = `<SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} flip={true}
              hasLost={winner === 'Blue Team'}
              className="left-0"
              positionStyle={{ bottom: '-3rem', marginLeft: '-15%' }} />`;
const sumoRightReplacement = `<SumoCharacter team="right" 
              isPushing={rightTeam.pushing} isStunned={rightTeam.stunned} isFrozen={rightTeam.frozen} flip={true}
              hasLost={winner === 'Blue Team'}
              className="left-0"
              positionStyle={{ bottom: '-3rem', marginLeft: '-15%' }} />`;
content = content.replace(sumoRightTarget, sumoRightReplacement);

// 3. Update SumoCharacter component definition
const defTarget = `const SumoCharacter = ({ team, isPushing, isStunned, hasLost, positionStyle, flip, className }: any) => {`;
const defReplacement = `const SumoCharacter = ({ team, isPushing, isStunned, isFrozen, hasLost, positionStyle, flip, className }: any) => {`;
content = content.replace(defTarget, defReplacement);

// 4. Update SumoCharacter body (ice block drawing)
const svgTarget = `          <path d="M 38 78 L 62 78 L 58 112 L 42 112 Z" fill={clothingColor} />
          <path d={isPushing ? "M 55 60 L 105 50" : "M 55 60 Q 85 75 95 65"} fill="none" stroke="#ffdfc4" strokeWidth="16" strokeLinecap="round" />
          
        </g>
      </svg>
    </div>`;

const svgReplacement = `          <path d="M 38 78 L 62 78 L 58 112 L 42 112 Z" fill={clothingColor} />
          <path d={isPushing ? "M 55 60 L 105 50" : "M 55 60 Q 85 75 95 65"} fill="none" stroke="#ffdfc4" strokeWidth="16" strokeLinecap="round" />
          
          {isFrozen && (
            <g>
              {/* Ice block shape overlay */}
              <rect x="-10" y="5" width="120" height="110" rx="15" fill="rgba(165, 243, 252, 0.7)" stroke="rgba(103, 232, 249, 0.9)" strokeWidth="6" />
              <path d="M -5 20 L 15 5 M 10 110 L 30 95 M 85 5 L 105 20 M 80 100 L 115 110" stroke="rgba(255,255,255,0.7)" strokeWidth="4" strokeLinecap="round" />
              
              {/* Glare effects */}
              <rect x="5" y="15" width="20" height="40" rx="10" fill="rgba(255,255,255,0.5)" transform="rotate(15 15 35)" />
              <circle cx="95" cy="85" r="8" fill="rgba(255,255,255,0.6)" />
              <circle cx="100" cy="95" r="4" fill="rgba(255,255,255,0.5)" />
              
              {/* FROZEN text */}
              <g transform={flip ? "scale(-1, 1) translate(-100, 0)" : ""}>
                <text x="50" y="55" fontFamily="sans-serif" fontSize="22" fontWeight="900" fill="#083344" textAnchor="middle" transform="rotate(-10 50 55)" style={{ paintOrder: 'stroke', stroke: '#cffafe', strokeWidth: '4px' }}>
                  FROZEN
                </text>
              </g>
            </g>
          )}
        </g>
      </svg>
    </div>`;
content = content.replace(svgTarget, svgReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched SumoCharacter to render frozen block with FROZEN text.");
