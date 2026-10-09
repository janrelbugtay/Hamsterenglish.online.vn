import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Patch addQuestion
    const targetAdd = `setQuestions([...questions, { id: Date.now(), text: '', options: ['', '', '', ''], answerIndex: 0 }]);`;
    const replacementAdd = `setQuestions([...questions, { id: Date.now(), text: '', options: ['', ''], answerIndex: 0 }]);`;
    content = content.replace(targetAdd, replacementAdd);
    
    // Patch GameEditor state initialization
    const targetState = `  const [questions, setQuestions] = useState<Question[]>(game.questions);`;
    const replacementState = `  const [questions, setQuestions] = useState<Question[]>(() => {
    return game.questions.map(q => {
        if (!q.options) return q;
        const newOpts = [...q.options];
        while (newOpts.length > 2 && newOpts[newOpts.length - 1] === "") {
            newOpts.pop();
        }
        return { ...q, options: newOpts };
    });
  });`;
    content = content.replace(targetState, replacementState);
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched GameEditor in ${filePath}`);
};

patchFile('src/views/Sumo.tsx');
patchFile('src/views/BubblePop.tsx');
