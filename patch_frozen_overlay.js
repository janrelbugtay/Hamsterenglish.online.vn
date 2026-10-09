import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

const target = `          {/* Action lines for pushing (dust/impact) */}
          {isPushing && (
             <g stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" className="animate-pulse" opacity="0.6">
               <line x1="-20" y1="50" x2="10" y2="50" />
               <line x1="-15" y1="30" x2="5" y2="40" />
               <line x1="-15" y1="70" x2="5" y2="60" />
             </g>
          )}
        </g>
      </svg>
    </div>`;

const replacement = `          {/* Action lines for pushing (dust/impact) */}
          {isPushing && (
             <g stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" className="animate-pulse" opacity="0.6">
               <line x1="-20" y1="50" x2="10" y2="50" />
               <line x1="-15" y1="30" x2="5" y2="40" />
               <line x1="-15" y1="70" x2="5" y2="60" />
             </g>
          )}
          
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

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/Sumo.tsx', content);
    console.log("Successfully replaced SVG");
} else {
    console.log("TARGET NOT FOUND. Check your code string.");
}
