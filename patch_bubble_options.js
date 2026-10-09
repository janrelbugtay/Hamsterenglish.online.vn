import fs from 'fs';
let content = fs.readFileSync('src/views/BubblePop.tsx', 'utf-8');

const studyTarget = `{activeQuiz.questions[studyIndex]?.options.map((opt, i) => {
                                const isSelected = studySelectedOption === i;
                                const isCorrect = i === activeQuiz.questions[studyIndex].answerIndex;`;

const studyReplacement = `{activeQuiz.questions[studyIndex]?.options.map((opt, i) => {
                                if (!opt || opt.trim() === '') return null;
                                const isSelected = studySelectedOption === i;
                                const isCorrect = i === activeQuiz.questions[studyIndex].answerIndex;`;

content = content.replace(studyTarget, studyReplacement);

fs.writeFileSync('src/views/BubblePop.tsx', content);
console.log("Patched BubblePop.tsx");
