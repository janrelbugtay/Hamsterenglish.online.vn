import fs from 'fs';

const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // 1. Replace parseFamilyFeudText
    const targetParseStart = `  const parseFamilyFeudText = (rawText: string) => {`;
    const targetParseEnd = `  const handleApplyBulkPaste = (action: 'replace' | 'append') => {`;
    
    const parseStartIdx = content.indexOf(targetParseStart);
    const parseEndIdx = content.indexOf(targetParseEnd);
    
    const newParseLogic = `  const parseFamilyFeudText = (rawText: string) => {
    if (!rawText.trim()) return [];
    const blocks = rawText.split(/\\n\\s*\\n/).filter(b => b.trim());
    const parsedRounds: any[] = [];
    let pendingTopic = "";
    
    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split(/\\r?\\n/).map((l: string) => l.trim()).filter((l: string) => l);
      if (lines.length === 0) continue; 
      
      if (lines.length === 1 && pendingTopic === "") {
        pendingTopic = lines[0];
        continue;
      }
      
      let question = "";
      let startIndex = 0;
      if (pendingTopic) {
        question = pendingTopic;
        startIndex = 0;
        pendingTopic = "";
      } else {
        question = lines[0];
        startIndex = 1;
      }
      
      const answers: any[] = [];
      for (let j = startIndex; j < lines.length; j++) {
        let line = lines[j];
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
        text = text.replace(/^([a-eA-E1-8])[\\.\\)\\:\\-]\\s+/, '');
        
        if (text) answers.push({ text, points });
      }
      
      while (answers.length < 8) {
        answers.push({ text: '', points: 0 });
      }
      
      question = question.replace(/^(topic|question)\\s*\\d*[:.-]?\\s*/i, '');
      parsedRounds.push({ question, answers: answers.slice(0, 8) });
    }
    return parsedRounds;
  };

`;

    content = content.substring(0, parseStartIdx) + newParseLogic + content.substring(parseEndIdx);
    
    // 2. Remove bottom buttons
    const oldButtons = `            <div className="flex gap-4">
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
    
    const newButton = `            <button
              onClick={addTopic}
              className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-slate-500 hover:text-blue-500 dark:text-slate-400 font-bold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={24} /> ADD TOPIC
            </button>`;
            
    content = content.replace(oldButtons, newButton);
    
    // 3. Add Smart Paste Bar
    const targetDiv = `<div className="mt-8 flex flex-col gap-8">
            {rounds.map((round, rIndex) => (`;
            
    const newDiv = `<div className="mt-8 flex flex-col gap-8">
            {/* Smart Tip Bar */}
            <div className="bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-blue-900 dark:text-blue-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                  <Info size={18} />
                </div>
                <p className="text-xs sm:text-sm font-medium">
                  <span className="font-bold">Smart Paste:</span> Paste multiple topics and answers with points directly.
                </p>
              </div>
              <button
                onClick={() => setShowBulkPasteModal(true)}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer self-end sm:self-auto"
              >
                <ClipboardList size={14} /> Bulk Paste
              </button>
            </div>

            {rounds.map((round, rIndex) => (`;
            
    content = content.replace(targetDiv, newDiv);
    
    fs.writeFileSync(filePath, content);
};

patchFile('src/views/FamilyFeud.tsx');
