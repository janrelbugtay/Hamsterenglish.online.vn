const fs = require('fs');
let code = fs.readFileSync('src/views/Home.tsx', 'utf-8');
if (!code.includes('import { GameThumbnail }')) {
    code = code.replace(
        'import { cn } from "../lib/utils";',
        'import { cn } from "../lib/utils";\nimport { GameThumbnail } from "../components/GameThumbnail";'
    );
    fs.writeFileSync('src/views/Home.tsx', code);
    console.log("Fixed import");
} else {
    console.log("Import already exists");
}
