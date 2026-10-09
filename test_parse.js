import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');
const target = `    } else {
       const hasOptions = currentQ && currentQ.options!.some(o => o !== "");`;
console.log(content.includes(target));
