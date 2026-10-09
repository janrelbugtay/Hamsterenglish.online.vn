const fs = require('fs');
let code = fs.readFileSync('src/views/Home.tsx', 'utf-8');

// Find the second instance of squid-game-picker and neon-chain blocks and remove them
code = code.replace(/\{\s*id:\s*"squid-game-picker"[\s\S]*?icon:\s*"🎯",\s*\},/g, (match, offset) => offset > 2000 ? "" : match);
code = code.replace(/\{\s*id:\s*"neon-chain"[\s\S]*?icon:\s*"⚡",\s*\},/g, (match, offset) => offset > 2000 ? "" : match);

// Remove duplicate commas
code = code.replace(/,\s*,/g, ",");

fs.writeFileSync('src/views/Home.tsx', code);
