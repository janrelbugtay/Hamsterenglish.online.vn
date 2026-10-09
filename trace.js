import fs from 'fs';
const content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');
const lines = content.split('\n');

let balance = 0;
let started = false;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("{screen === 'setup' && (")) {
        started = true;
    }
    
    if (started) {
        const opens = (line.match(/<div[\s>]/g) || []).length;
        const closes = (line.match(/<\/div>/g) || []).length;
        balance += opens;
        balance -= closes;
        
        console.log(`Line ${i+1}: Balance ${balance} | opens ${opens} closes ${closes} | ${line.trim()}`);
        
        if (line.includes(')}')) {
            if (balance <= 0) {
                console.log("End of setup block.");
                break;
            }
        }
    }
}
