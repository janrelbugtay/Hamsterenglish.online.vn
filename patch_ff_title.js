import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Title
    const targetTitle = `        <div className={\`text-7xl md:text-[10rem] font-black \${isDark ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-amber-600' : 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-500 via-amber-600 to-amber-800'} drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] text-center leading-[0.85] tracking-tighter\`} style={{ fontFamily: 'Impact, sans-serif' }}>`;
    
    const replacementTitle = `        <div className={\`text-6xl md:text-[8rem] font-black \${isDark ? 'text-white' : 'text-slate-800'} drop-shadow-xl text-center leading-[0.9] tracking-tight\`} style={{ fontFamily: "'Fredoka', sans-serif" }}>`;
    
    content = content.replace(targetTitle, replacementTitle);
    
    // "Enter Studio" button
    const targetBtn = `        <button 
        onClick={startGame}
        className="group relative px-12 py-6 bg-gradient-to-b from-blue-500 to-blue-800 text-white rounded-full font-black text-3xl hover:from-blue-400 hover:to-blue-700 transition-all border-[6px] border-blue-300 shadow-[0_0_40px_rgba(59,130,246,0.8),inset_0_4px_10px_rgba(255,255,255,0.4)] flex items-center gap-4 transform hover:scale-105 active:scale-95"
      >
        <Play fill="currentColor" size={32} className="drop-shadow-md" /> ENTER STUDIO
      </button>`;
      
    const replacementBtn = `        <button 
        onClick={startGame}
        className="group relative px-10 py-5 bg-indigo-600 text-white rounded-full font-bold text-2xl hover:bg-indigo-500 transition-all shadow-xl flex items-center gap-3 transform hover:scale-105 active:scale-95"
      >
        <Play fill="currentColor" size={28} /> ENTER STUDIO
      </button>`;
      
    content = content.replace(targetBtn, replacementBtn);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud title in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
