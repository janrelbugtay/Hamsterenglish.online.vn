import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace ["", "", "", ""] with ["", ""] in map
    content = content.replace(/options: item\.options \|\| \["", "", "", ""\]/g, 'options: item.options || ["", ""]');
    
    fs.writeFileSync(filePath, content);
    console.log(`Patched bulk paste in ${filePath}`);
};

patchFile('src/views/Sumo.tsx');
patchFile('src/views/BubblePop.tsx');
