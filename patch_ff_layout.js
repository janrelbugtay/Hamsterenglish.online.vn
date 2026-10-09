import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace the main game board
    const targetBoard = `    <div className={\`relative border-[12px] border-[#d4af37] rounded-[2rem] p-4 md:p-8 bg-gradient-to-b \${isDark ? 'from-[#0a1526] to-[#04080f]' : 'from-blue-100 to-white'} shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_80px_rgba(212,175,55,0.3),inset_0_0_40px_rgba(0,0,0,0.9)] w-full max-w-5xl\`}>
      <div className="absolute inset-0 border-[4px] border-[#ffd700]/30 rounded-[1.4rem] pointer-events-none"></div>

      {/* Decorative side lights */}
      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex-col gap-6 hidden lg:flex">
        {[1,2,3,4].map(i => <div key={i} className="w-4 h-16 bg-gradient-to-b from-yellow-300 to-yellow-600 rounded-full shadow-[0_0_15px_rgba(253,224,71,0.8),inset_0_2px_4px_rgba(255,255,255,0.5)]"></div>)}
      </div>
      <div className="absolute -right-14 top-1/2 -translate-y-1/2 flex-col gap-6 hidden lg:flex">
        {[1,2,3,4].map(i => <div key={i} className="w-4 h-16 bg-gradient-to-b from-yellow-300 to-yellow-600 rounded-full shadow-[0_0_15px_rgba(253,224,71,0.8),inset_0_2px_4px_rgba(255,255,255,0.5)]"></div>)}
      </div>`;
      
    const replacementBoard = `    <div className={\`relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t-4 border-indigo-500 rounded-[2rem] p-4 md:p-8 shadow-2xl w-full max-w-5xl overflow-hidden\`}>
      {/* Clean modern overlay replacing the heavy gold styling */}
      <div className="absolute inset-0 pointer-events-none rounded-[2rem] border border-slate-200 dark:border-white/10"></div>`;
      
    content = content.replace(targetBoard, replacementBoard);
    
    
    // Replace the question display panel (which uses a dark blue gradient and border-b-8 blue-500/80)
    const targetQPanel = `        <div className={\`bg-gradient-to-r \${isDark ? 'from-blue-950 via-blue-900 to-blue-950' : 'from-blue-100 via-blue-50 to-blue-100'} border-y-4 border-b-8 border-blue-500/80 rounded-2xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.9),inset_0_4px_10px_rgba(255,255,255,0.1)] text-center relative overflow-hidden\`}>
          <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
          {/* Subtle glowing dots */}
          <div className="absolute top-2 left-4 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse"></div>
          <div className="absolute top-2 right-4 w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_#60a5fa] animate-pulse delay-150"></div>`;
          
    const replacementQPanel = `        <div className={\`bg-slate-100 dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 text-center relative overflow-hidden\`}>`;
    
    content = content.replace(targetQPanel, replacementQPanel);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud layout in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
