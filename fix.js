import fs from 'fs';
let content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');

const target = `                            ))}
                        </div><button onClick={() => setScreen('study')} className="group relative w-full sm:w-80 h-[380px] rounded-[3rem] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-2 cursor-pointer flex flex-col items-center justify-center p-8">`;

const replace = `                            ))}
                        </div>
                    </div>
                    
                    <button onClick={() => setScreen('study')} className="group relative w-full sm:w-80 h-[380px] rounded-[3rem] bg-white/20 dark:bg-slate-900/40 backdrop-blur-md border border-white/40 shadow-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:bg-white/30 hover:-translate-y-2 cursor-pointer flex flex-col items-center justify-center p-8">`;

content = content.replace(target, replace);
fs.writeFileSync('src/views/BubbleSentencePro.tsx', content);
