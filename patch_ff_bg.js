import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace bgColors
    const targetBgColors = `  const bgColors: Record<string, Record<string, string>> = {
    dark: {
      idle: 'from-slate-900 via-[#061022] to-black',
      correct: 'from-green-950 via-[#0a2012] to-black',
      wrong: 'from-red-950 via-[#250909] to-black'
    },
    light: {
      idle: 'from-slate-100 via-blue-50 to-white',
      correct: 'from-green-100 via-emerald-50 to-white',
      wrong: 'from-red-100 via-rose-50 to-white'
    }
  };`;
    
    const replacementBgColors = `  const bgColors: Record<string, Record<string, string>> = {
    dark: {
      idle: 'bg-[#0f172a]',
      correct: 'bg-green-950',
      wrong: 'bg-red-950'
    },
    light: {
      idle: 'bg-slate-50',
      correct: 'bg-green-100',
      wrong: 'bg-red-100'
    }
  };`;
  
    content = content.replace(targetBgColors, replacementBgColors);
    
    // Replace container div
    const targetContainer = `    <div ref={gameContainerRef} className={\`h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] \${bgColors[theme][feedback]} font-sans \${isDark ? 'text-white' : 'text-slate-900'} flex flex-col relative selection:bg-blue-500/30 transition-colors duration-500 overflow-hidden\`} style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>`;
    
    const replacementContainer = `    <div ref={gameContainerRef} className={\`h-[calc(100vh-2rem)] w-full -m-4 md:-m-8 \${bgColors[theme][feedback]} font-sans \${isDark ? 'text-white' : 'text-slate-900'} flex flex-col relative selection:bg-blue-500/30 transition-colors duration-500 overflow-hidden\`} style={{ margin: '-1rem', height: 'calc(100% + 2rem)' }}>`;
    
    content = content.replace(targetContainer, replacementContainer);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud background in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
