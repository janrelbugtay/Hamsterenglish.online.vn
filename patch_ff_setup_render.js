import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Add topic state
    content = content.replace(
      `const [classLevel, setClassLevel] = useState(initialGame?.className || "");`,
      `const [topic, setTopic] = useState(initialGame?.topic || "");\n  const [classLevel, setClassLevel] = useState(initialGame?.className || "");`
    );
    
    const targetRenderStart = `  const renderSetupScreen = () => (`;
    const targetRenderEnd = `  const renderGameOver = () => {`;
    
    const startIdx = content.indexOf(targetRenderStart);
    const endIdx = content.indexOf(targetRenderEnd);
    
    if (startIdx !== -1 && endIdx !== -1) {
      const newRender = `  const renderSetupScreen = () => (
    <div className="absolute inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col items-center overflow-y-auto w-full">
      <div className="w-full max-w-5xl mt-12 mb-20">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 flex flex-col gap-6">
          
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-6">
            <h2 className="text-4xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Game Setup</h2>
            <div className="flex items-center gap-4">
              <button onClick={() => onViewChange("games")} className="px-6 py-2.5 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button onClick={() => setShowPublishModal(true)} className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors shadow-md shadow-blue-500/20">
                <Save size={20} /> Save Game
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Game Mode</label>
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-700 dark:text-slate-300">
                Family Feud
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Topic</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Everyday Items" className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium dark:text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Class Level</label>
              <input type="text" value={classLevel} onChange={e => setClassLevel(e.target.value)} placeholder="e.g. KET, Starters" className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium dark:text-white" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Folder</label>
              <select value={folderId} onChange={e => setFolderId(e.target.value)} className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium dark:text-white appearance-none">
                <option value="">No Folder (Root)</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-8">
            {rounds.map((round, rIndex) => (
              <div key={rIndex} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative group">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3 w-full">
                    <span className="text-slate-400 font-bold text-xl">Topic {rIndex + 1}</span>
                    <input 
                      type="text" 
                      value={round.question}
                      onChange={e => updateSetupTopic(rIndex, e.target.value)}
                      className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-lg outline-none focus:border-blue-500 dark:text-white placeholder-slate-400"
                      placeholder="Enter the survey question/topic..."
                    />
                  </div>
                  <button 
                    onClick={() => deleteTopic(rIndex)}
                    className="ml-4 p-3 text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 hover:text-red-600 rounded-xl transition-colors shrink-0 disabled:opacity-30"
                    disabled={rounds.length === 1}
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {round.answers.map((answer: any, aIndex: number) => (
                    <div key={aIndex} className="flex gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all">
                      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
                        {aIndex + 1}
                      </div>
                      <input 
                        type="text"
                        value={answer.text}
                        onChange={e => updateSetupAnswer(rIndex, aIndex, 'text', e.target.value)}
                        className="flex-1 bg-transparent font-bold outline-none text-slate-700 dark:text-white placeholder-slate-400"
                        placeholder="Answer"
                      />
                      <input 
                        type="number"
                        value={answer.points || ''}
                        onChange={e => updateSetupAnswer(rIndex, aIndex, 'points', e.target.value)}
                        className="w-16 bg-transparent font-bold outline-none text-right text-indigo-500 dark:text-indigo-400 placeholder-slate-300"
                        placeholder="Pts"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            <button
              onClick={addTopic}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 dark:text-slate-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={24} /> ADD TOPIC
            </button>
          </div>
          
          <button
            onClick={handleStartCustomGame}
            className="mt-6 px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-2xl rounded-2xl shadow-xl shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all w-full flex items-center justify-center gap-3"
          >
             START PLAYING NOW
          </button>
        </div>
      </div>
      
      {showPublishModal && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border-2 border-blue-500/30 flex flex-col items-center text-center">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Save Game</h3>
            <p className="text-slate-600 dark:text-slate-300 mb-8 font-medium">Would you like to publish this game to the public gallery so others can play it, or keep it private?</p>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={() => confirmSave(true)}
                className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-sky-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-transform"
              >
                🌍 Publish to Public
              </button>
              <button 
                onClick={() => confirmSave(false)}
                className="w-full py-3.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                🔒 Keep Private
              </button>
              <button 
                onClick={() => setShowPublishModal(false)}
                className="w-full py-2 mt-2 text-slate-500 dark:text-slate-400 font-medium hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

`;
      content = content.substring(0, startIdx) + newRender + content.substring(endIdx);
      fs.writeFileSync(filePath, content);
      console.log("Patched FamilyFeud setup render block.");
    }
};

patchFile('src/views/FamilyFeud.tsx');
