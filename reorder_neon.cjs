const fs = require('fs');

function reorderFile(filePath, searchStr, extractRegex, insertRegex) {
    let code = fs.readFileSync(filePath, 'utf-8');
    
    // Find the item
    const match = code.match(extractRegex);
    if (!match) {
        console.log("Could not find neon-chain block in " + filePath);
        return;
    }
    
    const block = match[0];
    
    // Remove it from current position
    code = code.replace(block, "");
    
    // Clean up double commas
    code = code.replace(/,\s*,/g, ",");
    
    // Insert it after squid-game-picker
    // Find the end of the squid-game-picker object
    const squidMatch = code.match(/\{\s*id:\s*"squid-game-picker"[^}]+\},?/);
    if (squidMatch) {
         code = code.replace(squidMatch[0], squidMatch[0] + "\n" + block + ",");
    }
    
    fs.writeFileSync(filePath, code);
    console.log("Reordered neon-chain in " + filePath);
}

// 1. Home.tsx
reorderFile(
    'src/views/Home.tsx',
    'neon-chain',
    /(\{\s*id:\s*"neon-chain"[^}]+\},?)/,
    // Insert regex not used directly here since we do a manual insert
);

// 2. GamesLibrary.tsx
reorderFile(
    'src/views/GamesLibrary.tsx',
    'neon-chain',
    /(\{\s*id:\s*"neon-chain"[^}]+\},?)/,
);

// 3. PublicDashboard.tsx
reorderFile(
    'src/views/PublicDashboard.tsx',
    'neon-chain',
    /(\{\s*id:\s*"neon-chain"[^}]+\},?)/,
);

