import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Let's replace the whole renderStartScreen block
    // Find the index of "const renderStartScreen" and "const renderGameOver"
    const startIdx = content.indexOf('const renderStartScreen');
    const endIdx = content.indexOf('const renderGameOver');
    
    if (startIdx !== -1 && endIdx !== -1) {
        const replacement = `  const handleStartCustomGame = () => {
    if (!setupTopic.trim()) {
      alert("Please enter a Topic.");
      return;
    }
    const validAnswers = setupAnswers
      .filter(a => a.text.trim() !== '')
      .map(a => ({ text: a.text.toUpperCase(), points: Number(a.points) || 0 }));
    
    if (validAnswers.length === 0) {
      alert("Please enter at least one answer.");
      return;
    }

    setCustomGameData([
      {
        id: "custom1",
        question: setupTopic,
        answers: validAnswers
      }
    ]);
    startGame();
  };

  const updateSetupAnswer = (index: number, field: 'text' | 'points', value: string) => {
    const newAnswers = [...setupAnswers];
    if (field === 'points') {
      newAnswers[index].points = parseInt(value) || 0;
    } else {
      newAnswers[index].text = value;
    }
    setSetupAnswers(newAnswers);
  };

  const renderSetupScreen = () => (
    <div className="absolute inset-0 z-40 flex flex-col items-center p-8 overflow-y-auto">
      <div className="relative z-10 flex flex-col items-center w-full max-w-4xl mt-12">
        <h2 className={\`text-5xl font-black mb-8 text-center \${isDark ? 'text-white' : 'text-slate-800'}\`} style={{ fontFamily: "'Fredoka', sans-serif" }}>
          Game Setup
        </h2>
        
        <div className={\`w-full \${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} rounded-[2rem] border p-8 shadow-2xl flex flex-col gap-6\`}>
          <div>
            <label className={\`block font-bold mb-2 \${isDark ? 'text-white' : 'text-slate-700'}\`}>Topic / Question</label>
            <input 
              type="text" 
              value={setupTopic}
              onChange={e => setSetupTopic(e.target.value)}
              className={\`w-full px-5 py-4 rounded-xl font-bold text-lg outline-none border-2 transition-all \${isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'}\`}
              placeholder="e.g. Name Something You Might Find In A Kitchen"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {setupAnswers.map((answer, i) => (
              <div key={i} className={\`flex gap-3 p-4 rounded-xl border \${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'}\`}>
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold flex-shrink-0 shadow-md">
                  {i + 1}
                </div>
                <input 
                  type="text"
                  value={answer.text}
                  onChange={e => updateSetupAnswer(i, 'text', e.target.value)}
                  className={\`flex-1 bg-transparent font-bold outline-none \${isDark ? 'text-white placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}\`}
                  placeholder="Answer"
                />
                <input 
                  type="number"
                  value={answer.points || ''}
                  onChange={e => updateSetupAnswer(i, 'points', e.target.value)}
                  className={\`w-20 bg-transparent font-bold outline-none text-right \${isDark ? 'text-indigo-400 placeholder-slate-600' : 'text-indigo-600 placeholder-slate-300'}\`}
                  placeholder="Pts"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleStartCustomGame}
            className="mt-6 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-2xl rounded-full shadow-xl hover:scale-105 active:scale-95 transition-all w-full"
          >
            START GAME
          </button>
        </div>
      </div>
    </div>
  );

  `;
        content = content.substring(0, startIdx) + replacement + content.substring(endIdx);
        fs.writeFileSync(filePath, content);
        console.log("Patched successfully");
    } else {
        console.log("Could not find blocks");
    }
};

patchFile('src/views/FamilyFeud.tsx');
