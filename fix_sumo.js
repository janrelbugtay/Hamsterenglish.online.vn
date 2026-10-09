import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

// 1. Update key down handler
const keydownTarget = `    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.screen !== 'playing') return;
      const key = e.key.toLowerCase();
      // Left Team Controls: A and D
      if (key === 'a') handleAnswer('left', 0);
      if (key === 'd') handleAnswer('left', 1);
      // Right Team Controls: Left Arrow and Right Arrow
      if (key === 'arrowleft') handleAnswer('right', 0);
      if (key === 'arrowright') handleAnswer('right', 1);
    };`;

const keydownReplacement = `    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.screen !== 'playing') return;
      const key = e.key.toLowerCase();
      
      const leftMap: Record<string, number> = { w: 0, a: 1, s: 2, d: 3 };
      const rightMap: Record<string, number> = { arrowup: 0, arrowleft: 1, arrowdown: 2, arrowright: 3 };

      if (key in leftMap) {
         handleAnswer('left', leftMap[key]);
      } else if (key in rightMap) {
         handleAnswer('right', rightMap[key]);
      }
    };`;

content = content.replace(keydownTarget, keydownReplacement);

// 2. Fix renderQuestionText
const renderQTarget = `  const renderQuestionText = (text: string) => {
    const parts = text.split('____');
    if (parts.length === 1) return text;
    return parts.map((part, i, arr) => (
      <React.Fragment key={i}>
        {part}
        {i !== arr.length - 1 && (
          <span className="inline-block border-b-4 border-yellow-400 min-w-[3rem] mx-1 text-yellow-300">
            &nbsp;
          </span>
        )}
      </React.Fragment>
    ));
  };`;

const renderQReplacement = `  const renderQuestionText = (text: string) => {
    // Some users might have varied length of blanks, split on 3 or more underscores
    const parts = text.split(/_{3,}/);
    if (parts.length === 1) return text;
    return parts.map((part, i, arr) => (
      <React.Fragment key={i}>
        {part}
        {i !== arr.length - 1 && (
          <span className="inline-block border-b-4 border-white/60 min-w-[4rem] mx-2 align-baseline translate-y-[-4px]">
          </span>
        )}
      </React.Fragment>
    ));
  };`;

content = content.replace(renderQTarget, renderQReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo.tsx");
