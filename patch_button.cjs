const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = `                        <Button size="lg" variant={gameMode === 'picker' ? 'primary' : 'success'} onClick={continueGame} className="mx-auto relative z-10 w-full shadow-[0_0_30px_rgba(16,185,129,0.5)]">
                                    <RotateCcw className="w-6 h-6 mr-2" /> 'CONTINUE'
                        </Button>`;

const replacement = `                        <Button size="lg" variant={gameMode === 'picker' ? 'primary' : 'success'} onClick={continueGame} className="mx-auto relative z-10 w-full shadow-[0_0_30px_rgba(16,185,129,0.5)] uppercase tracking-widest text-xl h-16 rounded-2xl font-black">
                            <RotateCcw className="w-6 h-6 mr-3" /> CONTINUE
                        </Button>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
