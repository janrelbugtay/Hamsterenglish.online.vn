import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

const blueBtnTarget = `<span className="hidden md:inline text-blue-400">{idx + 1}:</span>`;
const blueBtnReplacement = `<span className="hidden md:inline text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded-lg text-sm md:text-xl">{['W', 'A', 'S', 'D'][idx] || (idx + 1)}</span>`;

const redBtnTarget = `<span className="hidden md:inline text-red-400 uppercase">{idx + 1}:</span>`;
const redBtnReplacement = `<span className="hidden md:inline text-red-400 font-bold bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded-lg text-sm md:text-xl uppercase">{['↑', '←', '↓', '→'][idx] || (idx + 1)}</span>`;

content = content.replace(blueBtnTarget, blueBtnReplacement);
content = content.replace(redBtnTarget, redBtnReplacement);

// Make the font bigger and more immersive
const blueQTarget = `<p className="text-slate-800 dark:text-white text-lg md:text-2xl font-bold text-center leading-relaxed">`;
const blueQReplacement = `<p className="text-slate-800 dark:text-white text-2xl md:text-4xl font-black text-center leading-snug drop-shadow-sm">`;

const redQTarget = `<p className="text-slate-800 dark:text-white text-lg md:text-2xl font-bold text-center leading-relaxed">`;
const redQReplacement = `<p className="text-slate-800 dark:text-white text-2xl md:text-4xl font-black text-center leading-snug drop-shadow-sm">`;

content = content.replace(blueQTarget, blueQReplacement);
content = content.replace(redQTarget, redQReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo labels and font");
