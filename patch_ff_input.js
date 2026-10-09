import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Bottom Input Area
    const targetInputArea = `      {gameState === 'playing' && (
        <div className={\`absolute bottom-0 left-0 w-[calc(100%-11rem)] \${isDark ? 'bg-[#030712] border-[#1e293b]' : 'bg-white border-blue-200'} border-t-8 p-6 shadow-[0_-30px_60px_rgba(0,0,0,0.9)] z-20\`}>
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>`;
          
    const replacementInputArea = `      {gameState === 'playing' && (
        <div className={\`absolute bottom-0 left-0 w-[calc(100%-11rem)] \${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} border-t p-6 shadow-2xl z-20\`}>`;
        
    content = content.replace(targetInputArea, replacementInputArea);
    
    // Input Field
    const targetInput = `                 className={\`flex-1 \${isDark ? 'bg-[#0f172a] text-white border-[#334155]' : 'bg-slate-50 text-slate-900 border-slate-200'} placeholder-slate-600 px-8 py-5 rounded-2xl font-black text-3xl uppercase tracking-wider focus:outline-none focus:ring-4 focus:ring-yellow-500/50 border-[3px] border-[#334155] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] transition-all\`}`;
    
    const replacementInput = `                 className={\`flex-1 \${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-200'} placeholder-slate-400 px-8 py-5 rounded-2xl font-black text-2xl uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 border-2 shadow-sm transition-all\`}`;
    
    content = content.replace(targetInput, replacementInput);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud input in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
