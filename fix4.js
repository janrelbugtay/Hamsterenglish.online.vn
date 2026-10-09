import fs from 'fs';
let content = fs.readFileSync('src/views/BubbleSentencePro.tsx', 'utf-8');

const t = `                  </button>
                </div>
            </div>
        </div>
      )}
      
      {screen === 'study' && (`;

const r = `                  </button>
                </div>
        </div>
      )}
      
      {screen === 'study' && (`;

// Since there is a chance the spacing or empty lines is different, let's use a regex replacement.
// Replace `</div>\n        </div>\n      )}` with `</div>\n      )}` or similar.
