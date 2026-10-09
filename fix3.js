import fs from 'fs';
let content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');

const target3 = `                <div className="flex flex-wrap justify-center gap-4 mt-12 relative z-10">
                  <button onClick={() => onViewChange('games')} className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={24} /> Back to Games
                  </button>
                </div>
            </div>
        </div>
      )}`;

const replace3 = `                <div className="flex flex-wrap justify-center gap-4 mt-12 relative z-10">
                  <button onClick={() => onViewChange('games')} className="px-8 py-4 rounded-full bg-white/20 backdrop-blur-md shadow-lg hover:bg-white/30 text-xl font-bold text-white border border-white/40 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                    <ArrowLeft size={24} /> Back to Games
                  </button>
                </div>
        </div>
      )}`;

content = content.replace(target3, replace3);
fs.writeFileSync('src/views/BubbleSentencePro.tsx', content);
