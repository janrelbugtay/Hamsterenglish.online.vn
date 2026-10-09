import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// Blue Options
content = content.replace(
  'text-sm md:text-2xl font-black shadow-[0_4px_0_#1e3a8a]',
  'text-base md:text-3xl font-black shadow-[0_6px_0_#1e3a8a]'
);

// Red Options
content = content.replace(
  'text-sm md:text-2xl font-black shadow-[0_4px_0_#991b1b]',
  'text-base md:text-3xl font-black shadow-[0_6px_0_#991b1b]'
);

fs.writeFileSync('src/views/Sumo.tsx', content);
