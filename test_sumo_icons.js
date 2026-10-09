import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Add Trophy to lucide-react imports
const importsTarget = `import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, Info, ClipboardList, Copy } from "lucide-react";`;
const importsReplacement = `import { ArrowLeft, Edit3, Trash2, Heart, Plus, Sparkles, BookOpen, Search, Save, X, Play, Folder, Image as ImageIcon, Info, ClipboardList, Copy, Trophy } from "lucide-react";`;
content = content.replace(importsTarget, importsReplacement);

// 2. Add score property to leftTeam and rightTeam initializations
const stateInitTarget = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, q: null, stunned: false, pushing: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, q: null, stunned: false, pushing: false });`;
const stateInitReplacement = `  const [leftTeam, setLeftTeam] = useState<any>({ score: 0, wins: 0, q: null, stunned: false, pushing: false });
  const [rightTeam, setRightTeam] = useState<any>({ score: 0, wins: 0, q: null, stunned: false, pushing: false });`;
content = content.replace(stateInitTarget, stateInitReplacement);

// 3. Keep wins but reset everything else on startGame
const startGameTarget = `  const startGame = () => {
    setLeftTeam({ score: 0, q: generateQuestion(), stunned: false, pushing: false });
    setRightTeam({ score: 0, q: generateQuestion(), stunned: false, pushing: false });
    setBattlePos(50);
    setWinner(null);
    setScreen('playing');
  };`;
const startGameReplacement = `  const startGame = () => {
    setLeftTeam(prev => ({ ...prev, score: 0, q: generateQuestion(), stunned: false, pushing: false }));
    setRightTeam(prev => ({ ...prev, score: 0, q: generateQuestion(), stunned: false, pushing: false }));
    setBattlePos(50);
    setWinner(null);
    setScreen('playing');
  };`;
content = content.replace(startGameTarget, startGameReplacement);

// 4. Update wins when match is over
const winBlueTarget = `setWinner('Blue Team'); 
           matchOver = true;
           playSFX('win');`;
const winBlueReplacement = `setWinner('Blue Team');
           setLeftTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
           matchOver = true;
           playSFX('win');`;
content = content.replace(winBlueTarget, winBlueReplacement);

const winRedTarget = `setWinner('Red Team'); 
           matchOver = true;
           playSFX('win');`;
const winRedReplacement = `setWinner('Red Team');
           setRightTeam(prev => ({ ...prev, wins: prev.wins + 1 }));
           matchOver = true;
           playSFX('win');`;
content = content.replace(winRedTarget, winRedReplacement);

// 5. Update scoring UI to show trophies instead of numbers
const blueScoreTarget = `<div className="bg-slate-200 dark:bg-black/30 px-3 md:px-4 py-1 md:py-2 rounded-xl text-xl md:text-3xl font-black text-slate-800 dark:text-white">{leftTeam.score}</div>`;
const blueScoreReplacement = `<div className="flex gap-1 bg-slate-200 dark:bg-black/30 px-3 md:px-4 py-2 rounded-xl">
              {Array.from({ length: leftTeam.wins }).map((_, i) => (
                <Trophy key={i} size={24} className="text-yellow-500 fill-yellow-500" />
              ))}
              {leftTeam.wins === 0 && <span className="text-slate-400 text-sm md:text-base font-bold px-2 flex items-center">0 WINS</span>}
            </div>`;
content = content.replace(blueScoreTarget, blueScoreReplacement);

const redScoreTarget = `<div className="bg-slate-200 dark:bg-black/30 px-3 md:px-4 py-1 md:py-2 rounded-xl text-xl md:text-3xl font-black text-slate-800 dark:text-white order-2 md:order-1">{rightTeam.score}</div>`;
const redScoreReplacement = `<div className="flex gap-1 bg-slate-200 dark:bg-black/30 px-3 md:px-4 py-2 rounded-xl order-2 md:order-1">
              {Array.from({ length: rightTeam.wins }).map((_, i) => (
                <Trophy key={i} size={24} className="text-yellow-500 fill-yellow-500" />
              ))}
              {rightTeam.wins === 0 && <span className="text-slate-400 text-sm md:text-base font-bold px-2 flex items-center">0 WINS</span>}
            </div>`;
content = content.replace(redScoreTarget, redScoreReplacement);

// 6. Add Quit Button next to Fullscreen in playing view
const controlsTarget = `<button 
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />`;

const controlsReplacement = `<button 
            onClick={() => onViewChange("home")}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white bg-slate-200/50 dark:bg-black/20 hover:bg-slate-300/50 dark:hover:bg-black/50 border-slate-300/50 dark:border-white/20"
          >
            <ArrowLeft size={24} />
          </button>
          <FullscreenButton targetId="game-container" />
          <button 
            onClick={() => {
              setLeftTeam(prev => ({ ...prev, wins: 0 }));
              setRightTeam(prev => ({ ...prev, wins: 0 }));
              setScreen('setup');
            }}
            className="flex items-center gap-2 p-2 rounded-full transition-colors backdrop-blur-md border text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 bg-red-100/80 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 border-red-300/50 dark:border-red-500/20 shadow-sm"
            title="Quit Game"
          >
            <X size={24} />
          </button>`;

// Need to replace this in two places (playing view and end view, but mostly just the playing view). I'll replace all instances.
content = content.replaceAll(controlsTarget, controlsReplacement);


fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo to use Trophies and added Quit button");
