const fs = require('fs');
let content = fs.readFileSync('src/views/SquidGamePicker.tsx', 'utf8');

const target = `                        <div className="flex flex-col gap-6 mb-10 relative z-10">
                            {chosenOnes.map((name, i) => (
                                <div key={i} className="bg-black/50 p-6 rounded-2xl border border-slate-700">
                                    <div className="text-xl text-rose-300 font-bold mb-2 tracking-widest uppercase">
                                        PLAYER #{(students.indexOf(name) + 1).toString()}
                                    </div>
                                    <div className="text-5xl text-white font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                        {name}
                                    </div>
                                </div>
                            ))}
                        </div>`;

const replacement = `                        <div className="flex flex-col gap-6 mb-10 relative z-10">
                            {chosenOnes.map((name, i) => {
                                const playerNum = (students.indexOf(name) + 1).toString();
                                const playerImage = \`https://api.dicebear.com/7.x/notionists/svg?seed=\${name}\`;
                                return (
                                    <div key={i} className="flex items-center gap-6 bg-black/50 p-6 rounded-2xl border border-slate-700">
                                        <div className="w-24 h-24 shrink-0 rounded-xl bg-slate-800 border-2 border-rose-500 overflow-hidden flex items-center justify-center">
                                            <img src={playerImage} alt="Player Avatar" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-xl text-rose-300 font-bold mb-2 tracking-widest uppercase">
                                                PLAYER #{playerNum}
                                            </div>
                                            <div className="text-5xl text-white font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400 uppercase" style={{fontFamily: "'Fredoka', sans-serif"}}>
                                                {name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/views/SquidGamePicker.tsx', content);
    console.log("Success");
} else {
    console.log("Target not found");
}
