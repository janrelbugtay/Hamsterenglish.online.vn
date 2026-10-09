import fs from 'fs';
let content = fs.readFileSync('src/views/Sumo.tsx', 'utf-8');

const targetGenerate = `  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];
    let options = [...q.options].filter(o => o.trim() !== "");
    if (options.length < 2) options = ["Yes", "No"];
    
    // Pick the correct answer and a random wrong answer
    const correctOpt = q.options[q.answerIndex] || options[0];
    const wrongOpts = options.filter((_, i) => i !== q.answerIndex);
    const wrongOpt = wrongOpts.length > 0 ? wrongOpts[Math.floor(Math.random() * wrongOpts.length)] : (correctOpt === options[0] ? options[1] : options[0]);

    // Randomize position
    const shuffledOpts = Math.random() > 0.5 ? [correctOpt, wrongOpt] : [wrongOpt, correctOpt];
    
    return {
      text: q.text,
      options: shuffledOpts,
      correctIndex: shuffledOpts.indexOf(correctOpt)
    };
  };`;

const replacementGenerate = `  const generateQuestion = (index: number) => {
    const q = questionsDB[index % questionsDB.length];
    
    // Get valid options
    let validOptions = [...q.options].filter(o => o.trim() !== "");
    if (validOptions.length < 2) validOptions = ["Yes", "No"];
    
    const correctOpt = q.options[q.answerIndex] || validOptions[0];
    
    // Ensure correct option is included
    if (!validOptions.includes(correctOpt)) {
       validOptions[0] = correctOpt;
    }
    
    // Shuffle all valid options
    const shuffledOpts = [...validOptions].sort(() => Math.random() - 0.5);
    
    return {
      text: q.text,
      options: shuffledOpts,
      correctIndex: shuffledOpts.indexOf(correctOpt)
    };
  };`;

content = content.replace(targetGenerate, replacementGenerate);

// Now patch Study Mode in Sumo.tsx
const studyTarget = `{currentQ?.options.map((opt, i) => {
                         const isSelected = studySelectedOption === i;
                         const isCorrect = i === currentQ.answerIndex;`;

const studyReplacement = `{currentQ?.options.map((opt, i) => {
                         if (!opt || opt.trim() === '') return null;
                         const isSelected = studySelectedOption === i;
                         const isCorrect = i === currentQ.answerIndex;`;

content = content.replace(studyTarget, studyReplacement);

fs.writeFileSync('src/views/Sumo.tsx', content);
console.log("Patched Sumo.tsx");
