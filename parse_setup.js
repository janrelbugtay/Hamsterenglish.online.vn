import fs from 'fs';
const content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');
const setupStart = content.indexOf("{screen === 'setup' && (");
let idx = setupStart;
let depth = 0;
let setupEnd = -1;
for (let i = setupStart; i < content.length; i++) {
    if (content.substring(i, i+4) === '<div') {
        depth++;
    } else if (content.substring(i, i+6) === '</div') {
        depth--;
        if (depth === 0) {
            // Check if this is the end of setup
            const nextClosing = content.indexOf(')}', i);
            if (nextClosing !== -1 && nextClosing - i < 20) {
                setupEnd = nextClosing + 2;
                break;
            }
        }
    }
}
console.log("Found end?", setupEnd !== -1);
if (setupEnd !== -1) {
    const setupBlock = content.substring(setupStart, setupEnd);
    console.log(setupBlock);
}
