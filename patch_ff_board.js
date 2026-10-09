import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Answer board container
    const targetRow = `              className={\`h-20 md:h-[6.5rem] relative overflow-hidden rounded-xl border-[3px] \${isDark ? 'border-[#1e293b] bg-[#020617]' : 'border-blue-200 bg-blue-50'} shadow-[0_10px_20px_rgba(0,0,0,0.6)]\`}`;
    const replacementRow = `              className={\`h-20 md:h-[6.5rem] relative overflow-hidden rounded-xl border-2 \${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'} shadow-md\`}`;
    content = content.replace(targetRow, replacementRow);
    
    // Number circle (blue gradient)
    const targetNumber = `                  <div className="w-16 h-12 md:w-24 md:h-16 rounded-full bg-[#0a1930] border-[4px] border-blue-300 flex items-center justify-center shadow-[inset_0_4px_10px_rgba(0,0,0,0.8),0_4px_15px_rgba(0,0,0,0.6)] relative overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                    <span className="text-white font-black text-3xl md:text-4xl drop-shadow-[0_3px_3px_rgba(0,0,0,1)] relative z-10" style={{ fontFamily: 'Impact, sans-serif' }}>`;
    const replacementNumber = `                  <div className="w-16 h-12 md:w-24 md:h-16 rounded-full bg-indigo-600 border-4 border-indigo-300 flex items-center justify-center shadow-inner relative overflow-hidden">
                    <span className="text-white font-black text-3xl md:text-4xl drop-shadow-md relative z-10" style={{ fontFamily: 'Impact, sans-serif' }}>`;
    content = content.replace(targetNumber, replacementNumber);
    
    // Covered State Flap
    const targetFlap = `              <div 
                className={\`absolute inset-0 bg-gradient-to-b from-blue-500 via-blue-600 to-blue-900 border-[3px] border-blue-400 flex items-center justify-center transition-all duration-[800ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] origin-top \${isRevealed ? 'rotate-x-90 opacity-0' : 'rotate-x-0 opacity-100 shadow-[inset_0_0_30px_rgba(0,0,0,0.8)]'}\`}
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {/* Pattern Overlay */}
                <div className="absolute top-0 left-0 w-full h-[45%] bg-gradient-to-b from-white/30 to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')] opacity-50"></div>`;
                
    const replacementFlap = `              <div 
                className={\`absolute inset-0 bg-indigo-500 border-2 border-indigo-400 flex items-center justify-center transition-all duration-500 origin-top \${isRevealed ? 'rotate-x-90 opacity-0' : 'rotate-x-0 opacity-100 shadow-inner'}\`}
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              >
                {/* Pattern Overlay */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>`;
                
    content = content.replace(targetFlap, replacementFlap);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud board in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
