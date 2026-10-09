import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 1. Add state variables for setup
    const targetState = `  const [gameState, setGameState] = useState('start');`;
    const replacementState = `  const [gameState, setGameState] = useState('setup');
  const [setupTopic, setSetupTopic] = useState('');
  const [setupAnswers, setSetupAnswers] = useState(
    Array.from({ length: 8 }, () => ({ text: '', points: 0 }))
  );
  const [customGameData, setCustomGameData] = useState<any>(null);`;
    content = content.replace(targetState, replacementState);
    
    // 2. Modify gameData to use customGameData if available
    const targetGameData = `  const gameData = initialGame?.customQuestions || GAME_DATA;`;
    const replacementGameData = `  const gameData = customGameData || initialGame?.customQuestions || GAME_DATA;`;
    content = content.replace(targetGameData, replacementGameData);
    
    // 3. Instead of start screen, render a setup screen similar to Bubble Island
    const targetStartScreen = `  const renderStartScreen = () => (
    <div className="flex flex-col items-center justify-center h-full space-y-12 animate-in fade-in zoom-in mt-16">
      <div className="relative">
        <div className={\`text-6xl md:text-[8rem] font-black \${isDark ? 'text-white' : 'text-slate-800'} drop-shadow-xl text-center leading-[0.9] tracking-tight\`} style={{ fontFamily: "'Fredoka', sans-serif" }}>
          FAMILY
          <br/>
          FEUD
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-yellow-500/20 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
        {/* Subtle decorative stars */}
        <div className="absolute -top-10 -left-10 text-yellow-300/50 text-4xl animate-pulse">✨</div>
        <div className="absolute -bottom-10 -right-10 text-yellow-300/40 text-5xl animate-pulse delay-300">✨</div>
      </div>
      <button 
        onClick={startGame}
        className="group relative px-10 py-5 bg-indigo-600 text-white rounded-full font-bold text-2xl hover:bg-indigo-500 transition-all shadow-xl flex items-center gap-3 transform hover:scale-105 active:scale-95"
      >
        <Play fill="currentColor" size={28} /> ENTER STUDIO
      </button>
    </div>
  );`;

    const replacementSetupScreen = `  const handleStartCustomGame = () => {
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

  const renderStartScreen = () => null; // Removed

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
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold flex-shrink-0">
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
  );`;
  
    content = content.replace(targetStartScreen, replacementSetupScreen);
    
    // 4. Update the render logic to include setup
    const targetRender = `        {gameState === 'start' && renderStartScreen()}
        {gameState === 'game_over' && renderGameOver()}`;
    const replacementRender = `        {gameState === 'setup' && renderSetupScreen()}
        {gameState === 'game_over' && renderGameOver()}`;
    content = content.replace(targetRender, replacementRender);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched FamilyFeud setup screen in ${filePath}`);
};

patchFile('src/views/FamilyFeud.tsx');
