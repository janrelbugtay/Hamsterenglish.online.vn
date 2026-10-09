const fs = require('fs');
let code = fs.readFileSync('src/views/Home.tsx', 'utf-8');

if (!code.includes('GameThumbnail')) {
    code = code.replace(
        "import { motion } from 'framer-motion';",
        "import { motion } from 'framer-motion';\nimport { GameThumbnail } from '../components/GameThumbnail';"
    );
}

const targetStr = `{game.imageUrl ? (
        <>
          <img
            src={game.imageUrl}`;

const replacementStr = `{game.id === 'squid-game-picker' ? (
        <>
          <div className="w-full h-full scale-[1.12] group-hover:scale-[1.20] transition-transform duration-700 pointer-events-none">
             <GameThumbnail gameType={game.id} info={{...game, icon: game.imageUrl}} />
          </div>
          <div className="absolute inset-0 bg-brand-purple/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-30">
            <div className="w-16 h-16 bg-white dark:bg-slate-800/90 backdrop-blur-sm rounded-full flex items-center justify-center text-brand-purple shadow-lg transform scale-50 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-300 delay-75">
              <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        </>
      ) : game.imageUrl ? (
        <>
          <img
            src={game.imageUrl}`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacementStr);
    fs.writeFileSync('src/views/Home.tsx', code);
    console.log("Patched successfully");
} else {
    console.log("Target string not found");
}
