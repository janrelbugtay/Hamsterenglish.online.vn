import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    content = content.replace("import { useAuth } from '../context/AuthContext';", "import { useAuth } from '../contexts/AuthContext';");
    content = content.replace("import { db } from '../firebase';", "import { db } from '../lib/firebase';");
    
    fs.writeFileSync(filePath, content);
};
patchFile('src/views/FamilyFeud.tsx');
