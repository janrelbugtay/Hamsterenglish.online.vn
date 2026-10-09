import fs from 'fs';
const patchFile = (filePath) => {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Replace the end of the function
    const targetTail = `  const allEmptyOptions = items.every(q => q.options!.every(o => o === ""));
  if (allEmptyOptions && items.length > 0) {
     return items; 
  }

  return items;
}`;
    const replacementTail = `  const allEmptyOptions = items.every(q => q.options!.every(o => o === ""));
  
  // Clean up trailing empty options, keeping minimum 2 options
  items.forEach(q => {
     if (q.options) {
        while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
            q.options.pop();
        }
     }
  });

  if (allEmptyOptions && items.length > 0) {
     return items; 
  }

  return items;
}`;
    
    if (content.includes(targetTail)) {
        content = content.replace(targetTail, replacementTail);
        console.log(`Patched tail of ${filePath}`);
    } else {
        console.log(`Tail not found in ${filePath}`);
    }
    
    // Replace the TSV return
    const targetTsv = `    if (items.length > 0) return items;`;
    const replacementTsv = `    if (items.length > 0) {
      items.forEach(q => {
         if (q.options) {
            while (q.options.length > 2 && q.options[q.options.length - 1] === "") {
                q.options.pop();
            }
         }
      });
      return items;
    }`;
    
    if (content.includes(targetTsv)) {
        content = content.replace(targetTsv, replacementTsv);
        console.log(`Patched TSV return of ${filePath}`);
    } else {
        console.log(`TSV return not found in ${filePath}`);
    }
    
    fs.writeFileSync(filePath, content);
};

patchFile('src/views/Sumo.tsx');
patchFile('src/views/BubblePop.tsx');
