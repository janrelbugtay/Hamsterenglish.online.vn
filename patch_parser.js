import fs from 'fs';

const targetBlock = `    let inlineAnswerMatch = line.match(/\\banswer\\s*[:=]?\\s*([a-eA-E1-4])\\b/i);
    let inlineAnswerIndex = -1;
    if (inlineAnswerMatch) {
       const val = inlineAnswerMatch[1].toUpperCase();
       if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
       else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
       line = line.replace(inlineAnswerMatch[0], '').trim();
    }
    
    const ansMatch = line.match(/^answer\\s*[:=]?\\s*([a-eA-E1-4])/i);
    if (ansMatch || line === '') {
       if (currentQ && (ansMatch || inlineAnswerIndex !== -1)) {
          const val = ansMatch ? ansMatch[1].toUpperCase() : inlineAnswerMatch![1].toUpperCase();
          if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
          else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
       }
       continue;
    }`;

const replacementBlock = `    const ansMatch = line.match(/^answer\\s*[:=]?\\s*([a-eA-E1-4])/i);
    if (ansMatch) {
       if (currentQ) {
          const val = ansMatch[1].toUpperCase();
          if (/[A-E]/.test(val)) currentQ.answerIndex = val.charCodeAt(0) - 65;
          else if (/[1-4]/.test(val)) currentQ.answerIndex = parseInt(val) - 1;
       }
       continue;
    }

    let inlineAnswerMatch = line.match(/\\banswer\\s*[:=]?\\s*([a-eA-E1-4])\\b/i);
    let inlineAnswerIndex = -1;
    if (inlineAnswerMatch) {
       const val = inlineAnswerMatch[1].toUpperCase();
       if (/[A-E]/.test(val)) inlineAnswerIndex = val.charCodeAt(0) - 65;
       else if (/[1-4]/.test(val)) inlineAnswerIndex = parseInt(val) - 1;
       line = line.replace(inlineAnswerMatch[0], '').trim();
    }
    
    if (line === '') continue;`;

function patchFile(filepath) {
    if (fs.existsSync(filepath)) {
        let content = fs.readFileSync(filepath, 'utf-8');
        if (content.includes(targetBlock)) {
            content = content.replace(targetBlock, replacementBlock);
            fs.writeFileSync(filepath, content);
            console.log(`Patched ${filepath}`);
        } else {
            console.log(`Could not find target block in ${filepath}`);
        }
    }
}

patchFile('src/views/BubblePop.tsx');
patchFile('src/views/Sumo.tsx');
patchFile('src/views/YogaQuiz.tsx');
