import fs from 'fs';
let content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');

const target2 = `                    </button>
                </div>
                </div>
                
                <div className="flex flex-wrap justify-center gap-4 mt-12 relative z-10">`;

const replace2 = `                    </button>
                </div>
                
                <div className="flex flex-wrap justify-center gap-4 mt-12 relative z-10">`;

content = content.replace(target2, replace2);
fs.writeFileSync('src/views/BubbleSentencePro.tsx', content);
