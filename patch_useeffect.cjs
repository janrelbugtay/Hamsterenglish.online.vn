const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = `    useEffect(() => {
        if (gameState.phase === 'WINNER' && gameMode === 'picker') {
            chosenOnes.forEach((name, idx) => {
                setTimeout(() => {
                    const pNum = students.indexOf(name) + 1;
                    announce(\`Player \${pNum}, eliminated.\`);
                }, idx * 1500);
            });
        } else if (gameState.phase === 'ELIMINATED' && gameMode === 'survival') {
            if (gameState.eliminatedThisRound && gameState.eliminatedThisRound.length > 0) {
                gameState.eliminatedThisRound.forEach((name: string, idx: number) => {
                    setTimeout(() => {
                        const pNum = students.indexOf(name) + 1;
                        announce(\`Player \${pNum}, eliminated.\`);
                    }, idx * 1500);
                });
            }
        }
    }, [gameState.phase, chosenOnes, gameMode, students, gameState.eliminatedThisRound]);`;

const replacement = `    useEffect(() => {
        const timeouts: (ReturnType<typeof setTimeout>)[] = [];
        if (gameState.phase === 'WINNER' && gameMode === 'picker') {
            chosenOnes.forEach((name, idx) => {
                timeouts.push(setTimeout(() => {
                    const pNum = students.indexOf(name) + 1;
                    announce(\`Player \${pNum}, eliminated.\`);
                }, idx * 1500));
            });
        } else if (gameState.phase === 'ELIMINATED' && gameMode === 'survival') {
            if (gameState.eliminatedThisRound && gameState.eliminatedThisRound.length > 0) {
                gameState.eliminatedThisRound.forEach((name: string, idx: number) => {
                    timeouts.push(setTimeout(() => {
                        const pNum = students.indexOf(name) + 1;
                        announce(\`Player \${pNum}, eliminated.\`);
                    }, idx * 1500));
                });
            }
        }
        return () => timeouts.forEach(clearTimeout);
    }, [gameState.phase, chosenOnes, gameMode, students, gameState.eliminatedThisRound]);`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
