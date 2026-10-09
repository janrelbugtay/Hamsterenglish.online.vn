import fs from 'fs';

const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 1. Fix select text color
    content = content.replace(
      'className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium dark:text-white appearance-none"',
      'className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 font-medium text-slate-900 dark:text-white appearance-none"'
    );
    
    // 2. Add bulk paste state and logic
    const stateTarget = `  const [showPublishModal, setShowPublishModal] = useState(false);`;
    const stateReplacement = `  const [showPublishModal, setShowPublishModal] = useState(false);
  
  // Bulk Paste State
  const [showBulkPasteModal, setShowBulkPasteModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  
  const parseFamilyFeudText = (rawText: string) => {
    if (!rawText.trim()) return [];
    const blocks = rawText.split(/\\n\\s*\\n/).filter(b => b.trim());
    const parsedRounds: any[] = [];
    
    for (const block of blocks) {
      const lines = block.split(/\\r?\\n/).map((l: string) => l.trim()).filter((l: string) => l);
      if (lines.length < 2) continue; 
      
      const question = lines[0];
      const answers: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        let points = 10;
        
        let text = line;
        if (line.includes('\\t')) {
           const parts = line.split('\\t');
           const lastPart = parseInt(parts[parts.length - 1], 10);
           if (!isNaN(lastPart)) {
             points = lastPart;
             text = parts.slice(0, -1).join(' ').trim();
           }
        } else {
           const match = line.match(/(.*?)(?:\\s*[-:]?\\s*\\(?(\\d+)\\)?)?\\s*$/);
           if (match && match[2]) {
             text = match[1].trim();
             points = parseInt(match[2], 10);
           }
        }
        
        text = text.replace(/[-:]$/, '').trim();
        if (text) answers.push({ text, points });
      }
      
      while (answers.length < 8) {
        answers.push({ text: '', points: 0 });
      }
      
      parsedRounds.push({ question, answers: answers.slice(0, 8) });
    }
    return parsedRounds;
  };

  const handleApplyBulkPaste = (action: 'replace' | 'append') => {
    const parsed = parseFamilyFeudText(bulkText);
    if (parsed.length === 0) {
      alert("Could not find any topics/answers. Please format correctly.");
      return;
    }
    if (action === 'replace') {
      setRounds(parsed);
    } else {
      setRounds([...rounds, ...parsed]);
    }
    setToastMsg(\`✨ Added \${parsed.length} topics!\`);
    setTimeout(() => setToastMsg(""), 3500);
    setShowBulkPasteModal(false);
    setBulkText("");
  };`;
  
    content = content.replace(stateTarget, stateReplacement);
    
    // 3. Add ClipboardList import
    if (!content.includes('ClipboardList')) {
        content = content.replace("Maximize, Minimize } from 'lucide-react';", "Maximize, Minimize, ClipboardList, Info, Check } from 'lucide-react';");
    }

    // 4. Add the button in the UI next to ADD TOPIC
    const addTopicBtn = `            <button
              onClick={addTopic}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 dark:text-slate-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={24} /> ADD TOPIC
            </button>`;
    
    const addTopicReplacement = `            <div className="flex gap-4">
              <button
                onClick={addTopic}
                className="flex-1 py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 dark:text-slate-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={24} /> ADD TOPIC
              </button>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="flex-1 py-6 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-500 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <ClipboardList size={24} /> BULK PASTE
              </button>
            </div>`;
    
    content = content.replace(addTopicBtn, addTopicReplacement);
    
    // 5. Add Bulk Paste Modal at the end of renderSetupScreen
    const bulkPasteModal = `
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-6 py-3 rounded-full font-bold shadow-xl shadow-slate-900/20 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <Check size={20} className="text-green-400" />
          {toastMsg}
        </div>
      )}

      {/* Bulk Paste Modal */}
      {showBulkPasteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
                <ClipboardList size={22} className="text-blue-500" />
                Bulk Paste Topics
              </h3>
              <button 
                onClick={() => setShowBulkPasteModal(false)}
                className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-white p-2 rounded-full transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl text-sm font-medium border border-blue-100 dark:border-blue-800/50 flex gap-3">
                <Info size={20} className="shrink-0 text-blue-500" />
                <p>
                  Paste your questions and answers here. Separate each topic with a <strong>blank line</strong>. <br/>
                  The <strong>first line</strong> of a block is the Topic. The following lines are answers, with points at the end.<br/>
                  <span className="opacity-75 mt-2 block font-mono text-xs">
                    Topic 1<br/>
                    Answer One 50<br/>
                    Answer Two 30<br/>
                    <br/>
                    Topic 2<br/>
                    Another Answer 40
                  </span>
                </p>
              </div>

              <textarea 
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Paste your text here..."
                className="w-full h-64 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 font-mono text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />

              {bulkText.trim() && (
                <div className="flex justify-center -mt-2 mb-2">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-600">
                    Found <span className="font-bold text-slate-800 dark:text-white">{parseFamilyFeudText(bulkText).length}</span> topics. 
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button 
                  onClick={() => handleApplyBulkPaste('replace')}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  Replace All
                </button>
                <button 
                  onClick={() => handleApplyBulkPaste('append')}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30"
                >
                  Append to End
                </button>
              </div>
            </div>
          </div>
        </div>
      )}`;
      
    // Insert modal before the final `</div>` of the renderSetupScreen component
    const targetEndDiv = `  );`;
    const lastParenIdx = content.lastIndexOf(targetEndDiv, content.indexOf('const renderGameOver'));
    
    content = content.substring(0, lastParenIdx) + bulkPasteModal + '\n' + content.substring(lastParenIdx);
    
    fs.writeFileSync(filePath, content);
};

patchFile('src/views/FamilyFeud.tsx');
