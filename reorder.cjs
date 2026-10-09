const fs = require('fs');

function reorderFile(filePath, searchStr, extractRegex, insertRegex) {
    let code = fs.readFileSync(filePath, 'utf-8');
    
    // Find the item
    const match = code.match(extractRegex);
    if (!match) {
        console.log("Could not find squid-game-picker block in " + filePath);
        return;
    }
    
    const block = match[0];
    
    // Remove it from current position
    code = code.replace(block, "");
    
    // Clean up any double commas or weird spacing left behind
    code = code.replace(/,\s*,/g, ",");
    
    // Insert it at the top
    code = code.replace(insertRegex, "$1\n" + block + ",");
    
    fs.writeFileSync(filePath, code);
    console.log("Reordered " + filePath);
}

// 1. Home.tsx
reorderFile(
    'src/views/Home.tsx',
    'squid-game-picker',
    /(\{\s*id:\s*"squid-game-picker"[^}]+\},?)/,
    /(const allGames = \[)/
);

// 2. GamesLibrary.tsx
reorderFile(
    'src/views/GamesLibrary.tsx',
    'squid-game-picker',
    /(\{\s*id:\s*"squid-game-picker"[^}]+\},?)/,
    /(const allGameTemplates = \[)/
);

// 3. PublicDashboard.tsx
reorderFile(
    'src/views/PublicDashboard.tsx',
    'squid-game-picker',
    /(\{\s*id:\s*"squid-game-picker"[^}]+\},?)/,
    /(const allGames = \[)/
);

